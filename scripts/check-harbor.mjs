/* global MT */
// Integration checks for the default procedural harbor; run against a Vite development server.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
const root = process.env.LOCALAPPDATA;
const pw = root && existsSync(root + '/ms-playwright') ? readdirSync(root + '/ms-playwright').filter(n => n.startsWith('chromium-')).sort().reverse().map(n => root + '/ms-playwright/' + n + '/chrome-win64/chrome.exe') : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(p => p && existsSync(p));
const base = process.argv[2] || 'http://127.0.0.1:4412';
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const reports=[];
try {
  const page=await browser.newPage();await page.setViewport({width:640,height:480});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for (const seed of process.argv[3] === 'legacy' ? [] : [7,1,42,123,2026,98765]) {
    await page.goto(`${base}/?new&seed=${seed}&look=classic`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.MT && MT.ferry.ready,{timeout:60000});
    const result=await page.evaluate(async()=>{
      MT.setSpeed(0);document.body.classList.add('menu-full');
      const loaded=path=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name||path);
      const {S}=await loaded('/src/state.js'),island=await loaded('/src/island.js'),{harbor}=await loaded('/src/harbor.js'),{waterUniforms}=await loaded('/src/water.js');
      const {snapshot,save}=await loaded('/src/save.js');
      const f=MT.ferry,net=MT.townNet();
      const segmentDistance=(p,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);};
      let clearance=Infinity;
      // Include the stern-first departure and sideways turn, not only the arrival center line.
      const paths=[[f.berth,f.offshore]];
      const turn=f.berth.clone().lerp(f.offshore,.24);turn.x-=.9;paths.push([f.berth,turn],[turn,f.offshore]);
      for(const [a,b] of paths)for(let k=0;k<=100;k++){const t=k/100,p=[a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t];for(const arm of harbor.arms)clearance=Math.min(clearance,segmentDistance(p,arm.a,arm.b)-arm.halfWidth);}
      const cliffsOffLand=MT.cells.filter(c=>c.h>0&&!island.isLand(c.i-19.5,c.j-19.5)).length;
      const flat=MT.cells.filter(c=>c.type==='empty'&&!c.h&&!c.keep);
      MT.openHill(true);
      const hillPlots=MT.hillPlots().length;
      const roadCells=MT.cells.filter(c=>c.type==='road'),offLand=roadCells.filter(c=>!island.isLand(c.i-19.5,c.j-19.5)&&!c.slip).length;
      let built=null;
      for(const c of flat){if(!MT.placeable(c,[c])||!MT.frontRoads([c]).some(r=>net.has(r)))continue;built=MT.placeBlock('res',[c]);if(built)break;}
      const plot=built?.cells.map(c=>[c.i,c.j]);save();
      return {seed:S.seed,terrainVersion:S.terrainVersion,waterBayDepth:waterUniforms.uBay.value.z,ready:f.ready,connected:net.has(f.slip),coastRoads:roadCells.filter(c=>c.coast).length,disconnectedCoast:roadCells.filter(c=>c.coast&&!net.has(c)).length,clearance,armCount:harbor.arms.length,flatPlots:flat.length,cliffsOffLand,offLand,hillPlots,canal:MT.canalCells.size,landmarks:MT.landmarks.map(l=>l.kind),plot,savedVersion:snapshot().terrainVersion,coast: Array.from({length:16},(_,k)=>island.radius(k*Math.PI/8))};
    });
    console.log(JSON.stringify(result));reports.push(result);
    assert.equal(result.terrainVersion,2);assert.ok(result.waterBayDepth>0);assert.ok(result.ready&&result.connected,`seed ${seed}: ferry connected`);
    assert.equal(result.armCount,4);assert.ok(result.clearance>1.1,`seed ${seed}: ship clearance ${result.clearance}`);assert.equal(result.disconnectedCoast,0);
    assert.ok(result.flatPlots>250);assert.equal(result.offLand,0);assert.equal(result.cliffsOffLand,0);assert.ok(result.hillPlots>0);assert.ok(result.canal>0);
    assert.ok(result.landmarks.includes('lighthouse'));assert.ok(result.plot);assert.equal(result.savedVersion,2);
    // Normal reload must restore the same generator version and the player's building.
    await page.goto(`${base}/?seed=${seed}&look=classic`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.MT && MT.ferry.ready,{timeout:60000});
    const restored=await page.evaluate(async()=>{MT.setSpeed(0);document.body.classList.add('menu-full');const loaded=path=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name||path);const {S}=await loaded('/src/state.js'),{radius}=await loaded('/src/island.js');return {version:S.terrainVersion,plots:MT.blocks.filter(b=>b.type==='res').map(b=>b.cells.map(c=>[c.i,c.j])),coast:Array.from({length:16},(_,k)=>radius(k*Math.PI/8))};});
    assert.equal(restored.version,2);assert.deepEqual(restored.coast,result.coast);assert.deepEqual(restored.plots,[result.plot]);
  }
  // Simulate an existing town written before the terrain-version field existed.
  await page.goto(`${base}/?new&seed=7&terrain=1&look=classic`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.MT && MT.ferry.ready,{timeout:60000});
  const legacy=await page.evaluate(async()=>{
    MT.setSpeed(0);document.body.classList.add('menu-full');
    const loaded=path=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name||path);
    const {snapshot}=await loaded('/src/save.js'),{radius}=await loaded('/src/island.js');
    const data=snapshot();delete data.terrainVersion;localStorage.setItem('komachi.slot.legacy-harbor-test',JSON.stringify(data));
    localStorage.setItem('komachi.active','legacy-harbor-test');sessionStorage.removeItem('komachi.scratch');
    return Array.from({length:16},(_,k)=>radius(k*Math.PI/8));
  });
  // A separate named slot avoids the outgoing scratch tab's autosave replacing this old-format fixture.
  await page.goto(`${base}/?look=classic`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.MT && MT.ferry.ready,{timeout:60000});
  const old=await page.evaluate(async()=>{MT.setSpeed(0);document.body.classList.add('menu-full');const loaded=path=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name||path);const {S}=await loaded('/src/state.js'),{radius}=await loaded('/src/island.js'),{harbor}=await loaded('/src/harbor.js');return {version:S.terrainVersion,arms:harbor.arms.length,coast:Array.from({length:16},(_,k)=>radius(k*Math.PI/8))};});
  assert.equal(old.version,1);assert.equal(old.arms,0);assert.deepEqual(old.coast,legacy);assert.deepEqual(errors,[]);
  mkdirSync('docs/harbor-island',{recursive:true});if(reports.length)writeFileSync('docs/harbor-island/validation.json',JSON.stringify(reports,null,2));
  writeFileSync('docs/harbor-island/legacy-validation.json',JSON.stringify({legacySaveWithoutVersion:'passed',coastlinePreserved:true},null,2));
  console.log(`PASS: ${reports.length} new seeds checked; old saves retain their original coastline.`);
} finally {await browser.close();}
