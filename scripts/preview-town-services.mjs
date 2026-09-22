import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const executablePath=[process.env.BROWSER_PATH,`${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
const server=await createServer({server:{open:false,port:4201,strictPort:true}});await server.listen();let browser;
try {
  browser=await puppeteer.launch({executablePath,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1500,height:1050,deviceScaleFactor:1});
  await page.goto('http://localhost:4201/docs/town-services-preview.html',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.townServicesPreview);
  mkdirSync('docs/town-services',{recursive:true});
  const result=await page.evaluate(async()=>{
    const {Box3,Vector3}=await import('/node_modules/three/build/three.module.js');const result=[];
    for(const entry of window.townServicesPreview.models){
      const model=entry.mesh;let triangles=0;model.traverse(o=>{if(!o.isMesh)return;const g=o.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3;
        for(const key of ['position','normal','color']){if(!g.attributes[key])throw Error(`Missing ${key}: ${entry.kind}`);for(const v of g.attributes[key].array)if(!Number.isFinite(v))throw Error(`Invalid ${key}: ${entry.kind}`);}if(o.material.map)throw Error('External texture dependency');});
      const bounds=new Box3().setFromObject(model),size=bounds.getSize(new Vector3()).toArray();
      if(Math.abs(bounds.min.y)>1e-5)throw Error(`Not grounded: ${entry.kind}`);
      if(triangles!==entry.triangles)throw Error(`Triangle count differs: ${entry.kind}`);
      // Gallery transforms are on the wrapper; validate exact asset bounds at identity.
      const clone=model.clone();clone.updateMatrixWorld(true);const localSize=new Box3().setFromObject(clone).getSize(new Vector3()).toArray();
      if(localSize.some((v,i)=>Math.abs(v-entry.size[i])>1e-5))throw Error(`Size differs: ${entry.kind}`);
      if(entry.kind==='town-hall'&&(localSize[0]>1.901||localSize[2]>.901||localSize[1]>1.211))throw Error('Town hall footprint/height');
      if(['clinic','fire-station','community-centre'].includes(entry.kind)&&(localSize[0]>1||localSize[2]>1))throw Error(`One-cell overflow: ${entry.kind}`);
      result.push({kind:entry.kind,triangles,size:localSize});
    }
    const models=window.townServicesPreview.models;
    const hall=models.find(o=>o.kind==='town-hall').mesh.getObjectByName('Komachi_town_hall');
    if(!hall.userData.newcomerStop)throw Error('Missing porch stop');
    const station=models.find(o=>o.kind==='fire-station').mesh;
    if(!station.getObjectByName('Parked_Kei_Fire_Truck'))throw Error('Missing removable truck');
    const truck=models.find(o=>o.kind==='kei-fire-truck').mesh;
    for(const side of ['Left','Right'])for(const axle of ['Front','Rear'])if(!truck.getObjectByName(`Wheel_${side}_${axle}`))throw Error('Missing wheel pivot');
    return result;
  });
  await page.screenshot({path:'docs/town-services/collection.png'});
  for(const {kind}of result)for(const rear of [false,true]){
    await page.evaluate(({kind,rear})=>window.townServicesPreview.select(kind,rear),{kind,rear});await page.screenshot({path:`docs/town-services/${kind}${rear?'-rear':''}.png`});
  }
  for(const kind of ['clinic','fire-station']){
    await page.evaluate(kind=>{window.townServicesPreview.select(kind);window.townServicesPreview.showDetail();},kind);
    await page.screenshot({path:`docs/town-services/${kind}-detail.png`});
  }
  if(errors.length)throw Error(errors.join('\n'));
  writeFileSync('docs/town-services/validation.json',JSON.stringify({passed:true,models:result},null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
} finally {await browser?.close();await server.close();}
