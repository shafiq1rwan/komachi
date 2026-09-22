import {createServer} from 'vite';import puppeteer from 'puppeteer-core';import {existsSync,mkdirSync} from 'node:fs';
const executablePath=[process.env.BROWSER_PATH,`${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
const server=await createServer({server:{open:false,port:4199,strictPort:true}});await server.listen();let browser;
try{
  browser=await puppeteer.launch({executablePath,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1500,height:1050,deviceScaleFactor:1});
  await page.goto('http://localhost:4199/docs/subway-station-preview.html',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.stationPreview);mkdirSync('docs/subway-station',{recursive:true});
  const result=await page.evaluate(async()=>{
    const {Box3,Vector3,Raycaster}=await import('/node_modules/three/build/three.module.js');const p=window.stationPreview,m=p.model;
    m.position.y=0;m.updateMatrixWorld(true);const bounds=new Box3().setFromObject(m),size=bounds.getSize(new Vector3());
    if(size.x>.9||size.z>.9||bounds.max.y>.705||bounds.max.y<.67)throw Error('Station exceeds requested envelope');
    const names=['Window_Band','Name_Board','Lamp_L','Lamp_R'],mats=names.map(n=>{const o=m.getObjectByName(n);if(!o?.isMesh)throw Error(`Missing light mesh ${n}`);return o.material;});
    if(new Set(mats).size!==4)throw Error('Light materials are shared');
    mats[0].emissive.setHex(0xff0000);if(mats.slice(1).some(a=>a.emissive.getHex()!==0))throw Error('Light isolation failed');mats[0].emissive.setHex(0);
    let triangles=0;m.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const key of ['position','normal'])for(const v of o.geometry.attributes[key].array)if(!Number.isFinite(v))throw Error(`Invalid ${key}`);if(o.material.map)throw Error('Texture dependency');}});
    const ray=new Raycaster(),treads=[];
    for(let i=0;i<7;i++)for(const x of [-.08,0,.08]){
      const z=.30-i*.09,y=-i*.05;ray.set(new Vector3(x,.35,z),new Vector3(0,-1,0));const hit=ray.intersectObject(m,true)[0];
      if(!hit||Math.abs(hit.point.y-y)>.0001)throw Error(`Blocked tread ${i} at ${x}: ${hit?.object.name}`);
      ray.set(new Vector3(x,y-.002,z),new Vector3(0,-1,0));if(ray.intersectObject(m,true).length)throw Error(`Floor under tread ${i}`);
      ray.set(new Vector3(x,y+.004,z),new Vector3(0,1,0));const ceiling=ray.intersectObject(m,true)[0];if(ceiling&&ceiling.distance<.345)throw Error(`Walker headroom ${i}`);
      if(x===0)treads.push({y,z});
    }
    ray.set(new Vector3(0,-.30,-.30),new Vector3(0,-1,0));if(ray.intersectObject(m,true).length)throw Error('Bottom spawn is capped');
    m.position.y=.12;m.updateMatrixWorld(true);p.render();return{size:size.toArray(),min:bounds.min.toArray(),max:bounds.max.toArray(),triangles,independentLightMaterials:names,clearTreads:treads};
  });
  await page.screenshot({path:'docs/subway-station/komachi-subway-station.png'});
  await page.evaluate(()=>window.stationPreview.setNight(true));await page.screenshot({path:'docs/subway-station/night.png'});
  await page.evaluate(()=>{const p=window.stationPreview;p.setNight(false);p.camera.position.set(-1.4,1.1,-2.15);p.controls.update();p.render();});await page.screenshot({path:'docs/subway-station/rear.png'});
  await page.evaluate(()=>{const p=window.stationPreview;p.model.getObjectByName('Kawara_Hip_And_Gable_Roof').visible=false;p.model.getObjectByName('Eaves_And_Ceiling').visible=false;for(const name of ['Clock_Face','Clock_Hour_Hand','Clock_Minute_Hand'])p.model.getObjectByName(name).visible=false;p.camera.position.set(.80,1.35,1.45);p.controls.target.set(0,.12,0);p.controls.update();p.render();});await page.screenshot({path:'docs/subway-station/stairwell.png'});
  if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();await server.close();}
