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
 const flow=await page.evaluate(()=>{
   const o=MT.opening,failures=[];
   for(let n=0;n<=560;n++){
     const t=n/40;o.t=t;testOpening.updateOpening(0);testChars.updateCharacters(0.025);
     const stopped=Math.abs(o.train.position.x)<0.001,open=Math.abs(o.doors[0].position.x)>0.5;
     if(t<6.5&&o.people.some(p=>!p.mesh.userData.char.sitting))failures.push('stood before arrival');
     if(t<6.5&&o.people.some(p=>!p.paused))failures.push('walked before doors opened');
     for(const p of o.people)if(p.mesh.position.z<0.70&&p.mesh.position.z>0.29&&(!stopped||!open))failures.push('crossed a moving/closed doorway');
     if(t>10.9&&t<11.9&&o.people.some(p=>p.mesh.position.z>0.29))failures.push('doors closed before boarding');
     if(t>11.9&&Math.abs(o.doors[0].position.x)>0.166)failures.push('departed with open doors');
   }
   const passersExited=o.passers.every(p=>!p.mesh.visible);MT.stopOpening();MT.startOpening();
   return {failures:[...new Set(failures)],passers:o.passers.length,passersExited,seatedAtReplay:o.people.every(p=>p.mesh.userData.char.sitting),benchFacesTrain:o.people.every(p=>Math.abs(p.mesh.rotation.y-Math.PI)<0.01)};
 });
 for(const [name,t] of [['talk',1],['arrive',5],['doors',6.6],['standing',7.1],['boarding',9.2],['aboard',10.6]]){
  await page.evaluate(t=>{MT.opening.t=t;testOpening.updateOpening(0);},t);
  await page.screenshot({path:`docs/opening/${name}.png`});
 }
 for(const [name,yaw] of [['front',0.65],['cab',1.3],['rear',-0.7]]){
  const png=await page.evaluate(yaw=>{MT.opening.t=10.6;testOpening.updateOpening(0);const {camera,renderer,scene}=testScene;const v=2.5,a=innerWidth/innerHeight;camera.left=-v*a/2;camera.right=v*a/2;camera.top=v/2;camera.bottom=-v/2;camera.updateProjectionMatrix();camera.position.set(420+Math.sin(yaw)*6,2.8,Math.cos(yaw)*6);camera.lookAt(420,0.4,0);renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');},yaw);
  writeFileSync(`docs/opening/train-after-${name}.png`,Buffer.from(png.split(',')[1],'base64'));
 }
 const report=await page.evaluate(()=>{const o=MT.opening;const results={people:o.people.length,aboard:o.people.every(p=>p.mesh.position.z<0.3),doors:o.doors.map(d=>d.position.x)};MT.stopOpening();results.hidden=o.people.every(p=>!p.mesh.visible);MT.startOpening();results.replayTalk=!!o.people[0].talk;results.replayPosition=o.people.map(p=>p.mesh.position.toArray());return results;});
 const png=await page.evaluate(()=>{const c=MT.opening.people[0].mesh.userData.char;c.sitting=true;c.sitBlend=1;c.fidget='phone';testChars.holdItem(c,testItems.createPhone());MT.opening.people[0].mesh.rotation.y=0;MT.opening.people[0].mesh.position.set(0,0.2,1.2);MT.opening.people[1].mesh.visible=false;testChars.updateCharacters(0.1);const {camera}=testScene;camera.left=-0.28;camera.right=0.28;camera.top=0.18;camera.bottom=-0.18;camera.updateProjectionMatrix();camera.position.set(420.6,0.65,2.3);camera.lookAt(420,0.4,1.2);testScene.renderer.render(testScene.scene,camera);return testScene.renderer.domElement.toDataURL('image/png');});
 // Render explicitly so the normal town camera cannot overwrite this close-up.
 writeFileSync('docs/opening/phone.png',Buffer.from(png.split(',')[1],'base64'));
 const extra=await page.evaluate(()=>{MT.stopOpening();MT.setSpeed(0);MT.playOpening(()=>{window.finishedOpening=true;});document.getElementById('skip-opening').click();return {skip:window.finishedOpening&&!MT.opening.active,hidden:document.getElementById('iris').hidden};});Object.assign(report,extra);
 Object.assign(report,{flow});console.log(JSON.stringify({report,errors}));writeFileSync('docs/opening/check.json',JSON.stringify({report,errors},null,2));
 if(!flow.benchFacesTrain||flow.failures.length||!flow.passersExited||!flow.seatedAtReplay||errors.length||report.people!==2||!report.aboard||!report.hidden||!report.replayTalk||!report.skip||!report.hidden)process.exitCode=1;
}finally{await browser.close();}
