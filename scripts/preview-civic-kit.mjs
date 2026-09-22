import {createServer} from 'vite';
import puppeteer from 'puppeteer-core';
import {existsSync,mkdirSync} from 'node:fs';
const executablePath=[process.env.BROWSER_PATH,`${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
const server=await createServer({server:{open:false,port:4198,strictPort:true}});await server.listen();let browser;
try{
  browser=await puppeteer.launch({executablePath,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1500,height:1050,deviceScaleFactor:1});
  await page.goto('http://localhost:4198/docs/civic-preview.html',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.kitPreview);
  mkdirSync('docs/civic',{recursive:true});
  const result=await page.evaluate(async()=>{
    const {Box3}=await import('/node_modules/three/build/three.module.js');const result=[];
    for(const entry of window.kitPreview.models){const m=entry.mesh;m.updateMatrixWorld(true);let triangles=0;
      m.traverse(o=>{if(!o.isMesh)return;const g=o.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3;for(const key of ['position','normal','color']){if(!g.attributes[key])throw Error(`Missing ${key}: ${entry.kind}`);for(const v of g.attributes[key].array)if(!Number.isFinite(v))throw Error(`Invalid ${key}: ${entry.kind}`);}if(o.material.map)throw Error('External texture');});
      if(triangles!==entry.triangles)throw Error(`Triangle mismatch: ${entry.kind}`);
      if(new Box3().setFromObject(m).min.y<-.001)throw Error(`Below ground: ${entry.kind}`);result.push({kind:entry.kind,kit:entry.kit,triangles});
    }return result;
  });
  for(const kit of ['civic']){
    await page.evaluate(kit=>window.kitPreview.setKit(kit),kit);await page.screenshot({path:`docs/civic/${kit}.png`});
    for(const {kind} of result.filter(o=>o.kit===kit))for(const rear of [false,true]){
      await page.evaluate(({kind,rear})=>window.kitPreview.select(kind,rear),{kind,rear});await page.screenshot({path:`docs/civic/${kind}${rear?'-rear':''}.png`});
    }
  }
  await page.evaluate(()=>{const p=window.kitPreview;p.select('hose-box');const door=p.models.find(o=>o.kind==='hose-box').mesh.getObjectByName('Hose_Box_Door');if(!door)throw Error('Missing hinged door');door.rotation.y=-Math.PI*.65;p.render();});
  await page.screenshot({path:'docs/civic/hose-box-open.png'});
  if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();await server.close();}
