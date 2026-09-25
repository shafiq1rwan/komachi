/* global MT */
// Run against the development server: node scripts/preview-harbor.mjs [url] [seed]
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
const root = process.env.LOCALAPPDATA;
const pw = root && existsSync(root + '/ms-playwright') ? readdirSync(root + '/ms-playwright').filter(n => n.startsWith('chromium-')).sort().reverse().map(n => root + '/ms-playwright/' + n + '/chrome-win64/chrome.exe') : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(p => p && existsSync(p));
const base = process.argv[2] || 'http://127.0.0.1:4412';
mkdirSync('docs/opening', {recursive:true});
const browser=await puppeteer.launch({executablePath,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();await page.setViewport({width:1400,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(`${base}/?new&seed=7`,{waitUntil:'domcontentloaded',timeout:120000});
 await page.waitForFunction(()=>window.MT&&MT.characterAvailable(),{timeout:120000});
 await page.addStyleTag({content:'body > :not(#c):not(#bubbles) {visibility:hidden!important}'});
 await page.evaluate(async()=>{const loaded=p=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===p)?.name||p);window.testOpening=await loaded('/src/opening.js');window.testChars=await loaded('/src/characters.js');window.testScene=await loaded('/src/scene.js');window.testItems=await loaded('/src/hand-items.js');MT.setSpeed(0);MT.startOpening();});
 for(const [name,yaw] of [['front',0.65],['cab',1.3],['rear',-0.7]]){
 const png=await page.evaluate(yaw=>{MT.opening.t=6.6;testOpening.updateOpening(0);testChars.updateCharacters(0);const {camera,renderer,scene}=testScene;const v=2.5,a=innerWidth/innerHeight;camera.left=-v*a/2;camera.right=v*a/2;camera.top=v/2;camera.bottom=-v/2;camera.updateProjectionMatrix();camera.position.set(420+Math.sin(yaw)*6,2.8,Math.cos(yaw)*6);camera.lookAt(420,0.4,0);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');},yaw);
 writeFileSync(`docs/opening/train-${process.argv[3]||'review'}-${name}.png`,Buffer.from(png.split(',')[1],'base64'));
 }
 console.log(JSON.stringify({errors}));
}finally{await browser.close();}
