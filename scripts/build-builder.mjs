// Clone is retained separately; author the derivative and preserve all source animations.
import {createServer} from 'vite';
import puppeteer from 'puppeteer-core';
import {existsSync,mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
const out='assets/characters/builder';mkdirSync(out,{recursive:true});
if(!existsSync(`${out}/kenney-source.glb`))copyFileSync('assets/characters/kenney/character-male-b.glb',`${out}/kenney-source.glb`);
const executablePath=[process.env.BROWSER_PATH,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean).find(existsSync);
const server=await createServer({server:{open:false,port:4185,strictPort:true}});await server.listen();let browser;
try{
 browser=await puppeteer.launch({executablePath,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();await page.setViewport({width:1400,height:950,deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4185/docs/builder-preview.html?source',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.builderPreview);
 const bytes=await page.evaluate(async()=>Array.from(new Uint8Array(await window.builderPreview.exportAsset())));writeFileSync(`${out}/komachi-builder.glb`,Buffer.from(bytes));
 await page.goto('http://localhost:4185/docs/builder-preview.html',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.builderPreview);
 mkdirSync('docs/characters',{recursive:true});await page.screenshot({path:'docs/characters/komachi-builder-preview.png'});
 const result=await page.evaluate(()=>{const p=window.builderPreview;let skins=0,triangles=0;p.gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skins++;if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});const helmet=p.gltf.scene.getObjectByName('Builder_HardHat');return {skins,triangles,clips:p.gltf.animations.map(c=>c.name),helmetParent:helmet?.parent.name,textured:(()=>{let count=0;p.gltf.scene.traverse(o=>{if(o.isMesh&&o.material.map)count++;});return count;})()};});
 for(const clip of ['walk','attack-melee-right','crouch','holding-both']){await page.select('#pose',clip);await page.evaluate(()=>window.builderPreview.mixer.update(.3));await page.screenshot({path:`docs/characters/komachi-builder-${clip}.png`});}
 if(errors.length||result.skins!==2||result.helmetParent!=='head'||result.clips.length!==32||result.textured)throw new Error(JSON.stringify({errors,result}));
 console.log('Builder exported and reloaded:',JSON.stringify(result));
}finally{await browser?.close();await server.close();}
