import {createServer} from 'vite';import puppeteer from 'puppeteer-core';import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
const executablePath=[process.env.BROWSER_PATH,`${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
const server=await createServer({server:{open:false,port:4204,strictPort:true}});await server.listen();let browser;
try{browser=await puppeteer.launch({executablePath,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1500,height:1050,deviceScaleFactor:1});await page.goto('http://localhost:4204/docs/work-trucks-preview.html',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.kitPreview);mkdirSync('docs/work-trucks',{recursive:true});
const result=await page.evaluate(async()=>{
  const {Box3,Vector3}=await import('/node_modules/three/build/three.module.js');const result=[];
  for(const entry of window.kitPreview.models){const model=entry.mesh.clone();model.updateMatrixWorld(true);let triangles=0;
    model.traverse(o=>{if(!o.isMesh)return;const g=o.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3;for(const key of o.name==='Body_Paint'?['position','normal']:['position','normal','color']){if(!g.attributes[key])throw Error(`Missing ${key}`);for(const v of g.attributes[key].array)if(!Number.isFinite(v))throw Error('Invalid vertex');}if(o.material.map)throw Error('Texture dependency');});
    const bounds=new Box3().setFromObject(model),size=bounds.getSize(new Vector3()).toArray();
    if(size[0]<.28||size[0]>.32||size[2]<.55||size[2]>.65||Math.abs(bounds.min.y)>1e-6)throw Error('Dimensions/grounding: '+entry.kind);
    if(triangles!==entry.triangles)throw Error('Triangle mismatch');
    for(const name of ['Body_Paint','Headlights','Taillights',...entry.cargoMeshes])if(!model.getObjectByName(name)?.isMesh)throw Error('Missing '+name);
    for(const side of ['Left','Right'])for(const axle of ['Front','Rear']){const wheel=model.getObjectByName(`Wheel_${side}_${axle}`);if(!wheel)throw Error('Missing wheel');wheel.geometry.computeBoundingBox();if(wheel.geometry.boundingBox.getCenter(new Vector3()).length()>.006)throw Error('Wheel pivot off axle');if(Math.abs(wheel.position.y-.052)>1e-6)throw Error('Wheel height');}
    const body=model.getObjectByName('Body_Paint'),head=model.getObjectByName('Headlights'),tail=model.getObjectByName('Taillights');
    if(body.material.vertexColors)throw Error('Paint material must accept direct colour');
    if(head.material===tail.material||body.material===head.material)throw Error('Light/paint material coupling');
    if(entry.kind==='builder'&&!model.getObjectByName('Crane_Arm'))throw Error('Missing crane');
    result.push({kind:entry.kind,triangles,size,ground:bounds.min.y,namedParts:entry.meshes});
  }return result;
});
await page.screenshot({path:'docs/work-trucks/collection.png'});
for(const {kind}of result){for(const rear of [false,true]){await page.evaluate(({kind,rear})=>window.kitPreview.select(kind,rear),{kind,rear});await page.screenshot({path:`docs/work-trucks/${kind}${rear?'-rear':''}.png`});}
if(kind!=='fish-van'){await page.evaluate(kind=>{const p=window.kitPreview;p.select(kind,true);const m=p.models.find(o=>o.kind===kind).mesh;for(const name of ['Cargo_Crates','Cargo_Timber']){const cargo=m.getObjectByName(name);if(cargo)cargo.visible=false;}p.render();},kind);await page.screenshot({path:`docs/work-trucks/${kind}-empty.png`});}}
await page.evaluate(()=>{const p=window.kitPreview;p.select('kei-farm');const m=p.models.find(o=>o.kind==='kei-farm').mesh;m.getObjectByName('Body_Paint').material.color.set('#8fb0c9');m.getObjectByName('Headlights').material.emissive.set('#ffd08a');m.getObjectByName('Headlights').material.emissiveIntensity=1;p.render();});await page.screenshot({path:'docs/work-trucks/paint-and-lights-check.png'});
if(errors.length)throw Error(errors.join('\n'));writeFileSync('docs/work-trucks/validation.json',JSON.stringify({passed:true,models:result},null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();await server.close();}
