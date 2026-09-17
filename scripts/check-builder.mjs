// Verify that real construction workers select the derivative and still hold tools.
import {createServer} from 'vite';
import puppeteer from 'puppeteer-core';
import {existsSync} from 'node:fs';
const executablePath=[process.env.BROWSER_PATH,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe','/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean).find(existsSync);
const server=await createServer({server:{open:false,port:4186,strictPort:true}});await server.listen();let browser;
try{
 browser=await puppeteer.launch({executablePath,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:4186/?seed=7',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.MT?.characterAvailable());
 const result=await page.evaluate(async()=>{
  const {characterReady}=await import('/src/characters.js');await characterReady;
  MT.setSpeed(0);MT.setHour(8);MT.placeBlock('res',[MT.cell(17,19)]);
  for(let i=0;i<100&&!MT.workers.some(w=>w.tool&&w.toolName!=='barrow');i++)MT.fastForward(.08);
  const workers=MT.workers.map(w=>({hat:w.mesh.getObjectByName('Builder_HardHat')?.parent.name,tool:w.toolName,hand:w.tool?.parent.name,clips:['idle','walk','sit'].every(n=>!!w.mesh.userData.char?.[n])}));
  return {workers,regularHasHelmet:MT.residents.some(r=>r.mesh?.getObjectByName('Builder_HardHat'))};
 });
 if(errors.length||!result.workers.length||result.workers.some(w=>w.hat!=='head'||!w.clips)||!result.workers.some(w=>w.hand==='arm-right')||result.regularHasHelmet)throw new Error(JSON.stringify({errors,result}));
 console.log('Construction builder selection and tool attachment passed:',JSON.stringify(result));
}finally{await browser?.close();await server.close();}
