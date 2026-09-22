import {createServer} from 'vite';
import puppeteer from 'puppeteer-core';
import {existsSync,mkdirSync} from 'node:fs';
const executablePath=[process.env.BROWSER_PATH,`${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
const server=await createServer({server:{open:false,port:4197,strictPort:true}});await server.listen();let browser;
try{
  browser=await puppeteer.launch({executablePath,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1500,height:1050,deviceScaleFactor:1});
  await page.goto('http://localhost:4197/docs/neighbourhood-preview.html',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.kitPreview);
  mkdirSync('docs/neighbourhood',{recursive:true});
  const result=await page.evaluate(async()=>{
    const {Box3}=await import('/node_modules/three/build/three.module.js');const result=[];
    for(const entry of window.kitPreview.models){const m=entry.mesh;m.updateMatrixWorld(true);let triangles=0;
      m.traverse(o=>{if(!o.isMesh)return;const g=o.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3;for(const key of ['position','normal','color']){if(!g.attributes[key])throw Error(`Missing ${key}: ${entry.kind}`);for(const v of g.attributes[key].array)if(!Number.isFinite(v))throw Error(`Invalid ${key}: ${entry.kind}`);}if(o.material.map)throw Error('External texture');});
      if(triangles!==entry.triangles)throw Error(`Triangle mismatch: ${entry.kind}`);
      if(new Box3().setFromObject(m).min.y<-.001)throw Error(`Below ground: ${entry.kind}`);result.push({kind:entry.kind,kit:entry.kit,triangles});
    }return result;
  });
  for(const kit of ['utility','shop-facade','home-yard']){
    await page.evaluate(kit=>window.kitPreview.setKit(kit),kit);await page.screenshot({path:`docs/neighbourhood/${kit}.png`});
    for(const {kind} of result.filter(o=>o.kit===kit))for(const rear of [false,true]){
      await page.evaluate(({kind,rear})=>window.kitPreview.select(kind,rear),{kind,rear});await page.screenshot({path:`docs/neighbourhood/${kind}${rear?'-rear':''}.png`});
    }
  }
  if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();await server.close();}
