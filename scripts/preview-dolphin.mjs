import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
const executablePath=[process.env.BROWSER_PATH,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean).find(existsSync);
const server=await createServer({server:{open:false,port:4184,strictPort:true}});await server.listen();let browser;
try {
  browser=await puppeteer.launch({executablePath,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage();await page.setViewport({width:1400,height:950,deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4184/docs/dolphin-preview.html',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.dolphinPreview);
  mkdirSync('docs/characters',{recursive:true});await page.screenshot({path:'docs/characters/komachi-dolphin-preview.png'});
  const asset=await page.evaluate(async()=>{
    const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const {Box3,AnimationMixer}=await import('/node_modules/three/build/three.module.js');
    const gltf=await new GLTFLoader().loadAsync('/assets/characters/dolphin/komachi-dolphin.glb');
    const bounds=new Box3().setFromObject(gltf.scene),mixer=new AnimationMixer(gltf.scene);mixer.clipAction(gltf.animations[0]).play();mixer.update(.4);
    return {clips:gltf.animations.map(c=>c.name),length:bounds.max.z-bounds.min.z,tailAngle:gltf.scene.getObjectByName('Tail').rotation.x};
  });
  if(errors.length||!asset.clips.includes('swim')||asset.length<2.5||asset.tailAngle<.15)throw new Error(JSON.stringify({errors,asset}));
  await page.click('#motion');await page.waitForFunction(()=>Math.abs(window.dolphinPreview.dolphin.getObjectByName('Tail').rotation.x)>.1);
  await page.click('#motion');
  await page.evaluate(()=>{const p=window.dolphinPreview;p.camera.position.set(5,.9,0);p.controls.target.set(0,.95,0);p.controls.update();p.renderer.render(p.scene,p.camera);});
  await page.screenshot({path:'docs/characters/komachi-dolphin-side.png'});
  await page.evaluate(()=>{const p=window.dolphinPreview;p.camera.position.set(0,8,-.09);p.controls.target.set(0,.95,-.1);p.controls.update();p.renderer.render(p.scene,p.camera);});
  await page.screenshot({path:'docs/characters/komachi-dolphin-top.png'});
  console.log('Dolphin preview and animated GLB passed:',JSON.stringify(asset));
}finally{await browser?.close();await server.close();}
