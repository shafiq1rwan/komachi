import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
const executablePath = [process.env.BROWSER_PATH, `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
const server = await createServer({ server: { port: 4193, strictPort: true } }); await server.listen(); let browser;
try {
 browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
 const page = await browser.newPage(); await page.setViewport({width:1000,height:800});
 await page.goto('http://localhost:4193/?seed=7',{waitUntil:'domcontentloaded',timeout:120000}); await page.waitForFunction(()=>window.MT?.characterAvailable() && MT.serviceReady(),{timeout:120000});
 const result = await page.evaluate(async resident=>{
  const T = await import('/node_modules/three/build/three.module.js'); MT.setSpeed(0);
  const p = MT.stageService('police-bike',0,0,0,{name:resident ? 'cargo tricycle rider' : 'police officer'});
  if (resident) {
   const { createResidentTricycle } = await import('/src/service-vehicles.js');
   const cargo = createResidentTricycle('#91b8ac'); cargo.position.copy(p.mesh.position); p.mesh.removeFromParent();
   p.mesh = cargo; p.rider.bike = cargo;
  }
  const { updateCharacters } = await import('/src/characters.js'); updateCharacters(1, c => c.grp === p.rider.mesh);
  const scene = new T.Scene(); scene.background = new T.Color('#ede9df'); scene.add(p.mesh,p.rider.mesh); p.mesh.position.y -= .08; p.rider.mesh.position.y -= .08;
  scene.add(new T.HemisphereLight(0xffffff,0x89968d,3)); const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,2);scene.add(light);
  const floor=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshStandardMaterial({color:'#ede9df'}));floor.rotation.x=-Math.PI/2;floor.position.y=-.001;scene.add(floor);
  const renderer = new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true}); renderer.setSize(1000,800);
  const camera = new T.PerspectiveCamera(32,1.25,.001,10);camera.position.set(.70,.30,.45);camera.lookAt(0,.16,0);
  document.body.replaceChildren(renderer.domElement);renderer.render(scene,camera);
  window.policePreview={scene,camera,renderer,p};
  scene.updateMatrixWorld(true);
  if (!p.mesh.userData.grip) throw Error('Missing handlebar grip');
  const { seat, grip, wheels, wheelRadius } = p.mesh.userData;
  if (seat.y < .10 || seat.y > .11 || grip[1] < .12 || grip[1] > .13) throw Error('Bicycle too tall for Kenney rider');
  if (Math.abs(new T.Box3().setFromObject(p.mesh).min.y) > 1e-6) throw Error('Tyres off the ground');
  if (wheels.length !== 3 || Math.abs(wheelRadius - .0408) > 1e-6) throw Error('Tricycle dimensions or pivots changed');
  for (const wheel of wheels) {
   const expected = wheel.name.includes('Rear') ? .02448 : .0408;
   if (Math.abs(wheel.userData.wheelRadius - expected) > 1e-6) throw Error('Kid tricycle wheel proportions');
  }
  const travel = .01, start = p.mesh.position.clone();
  MT.moveAlong(p.mesh,{pts:[start.clone(),start.clone().add(new T.Vector3(0,0,1))],i:0,t:0},travel);
  for (const wheel of wheels) {
   if (Math.abs(wheel.rotation.x - travel / wheel.userData.wheelRadius) > 1e-6) throw Error('Wheel travel does not match wheel size');
   wheel.rotation.x = 0;
  }
  p.mesh.position.copy(start);
  if (new T.Box3().setFromObject(p.mesh).getSize(new T.Vector3()).y > .135) throw Error('Tricycle too tall for the short Kenney body');
  return {seat:p.mesh.userData.seat,grip:p.mesh.userData.grip,size:new T.Box3().setFromObject(p.mesh).getSize(new T.Vector3()).toArray()};
 }, process.argv[2] === 'cargo-tricycle');
 mkdirSync('scripts/out',{recursive:true});await page.screenshot({path:`scripts/out/police-bike-${process.argv[2]||'preview'}.png`});
 await page.evaluate(()=>{const {camera,renderer,scene}=window.policePreview;camera.position.set(.65,.28,-.50);camera.lookAt(0,.16,0);renderer.render(scene,camera);});
 await page.screenshot({path:`scripts/out/${process.argv[2] === 'cargo-tricycle' ? 'cargo-tricycle' : 'police-tricycle'}-rear.png`});console.log(result);
} finally {await browser?.close();await server.close();}
