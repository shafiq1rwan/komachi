/* global MT */
// Run against the development server: node scripts/preview-harbor.mjs [url] [seed]
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
const root = process.env.LOCALAPPDATA;
const pw = root && existsSync(root + '/ms-playwright') ? readdirSync(root + '/ms-playwright').filter(n => n.startsWith('chromium-')).sort().reverse().map(n => root + '/ms-playwright/' + n + '/chrome-win64/chrome.exe') : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(p => p && existsSync(p));
const base = process.argv[2] || 'http://127.0.0.1:4412', seed = process.argv[3] || '7';
mkdirSync('docs/harbor-island', { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1500, height: 1050 });
  const errors = [];page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/?new&seed=${seed}&demo=dense&look=rich`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => window.MT && MT.characterAvailable() && MT.serviceReady() && document.getElementById('loading').classList.contains('gone'), { timeout: 120000 });
  await page.addStyleTag({ content: 'body > :not(#c) { visibility: hidden !important; }' });
  await page.evaluate(() => {
    MT.setSpeed(0); MT.setWeather('clear', 60); MT.setDay(3, 13);
    for (const b of MT.blocks) { if (b.type === 'station') continue; b.stage = MT.DONE; b.renoT = 0; for (const u of b.units) MT.rebuildUnitMesh(u); }
    MT.fastForward(0.2, 0.01);
    MT.cam.target.set(0, 0, 1); MT.cam.view = MT.cam.tView = 33; MT.cam.yaw = MT.cam.tYaw = 0.6; MT.cam.pitch = 0.70;
  });
  const frames = () => page.evaluate(() => new Promise(resolve => { let n = 0; const frame = () => ++n >= 8 ? resolve() : requestAnimationFrame(frame); requestAnimationFrame(frame); }));
  await frames(); await page.screenshot({ path: `docs/harbor-island/island-${seed}.png` });
  const report = await page.evaluate(async () => {
    const loaded = path => import(performance.getEntriesByType('resource').find(e => new URL(e.name).pathname === path)?.name || path);
    const { S } = await loaded('/src/state.js'), { harbor } = await loaded('/src/harbor.js');
    const { radius, hillCentre, isLand, coastPoint } = await loaded('/src/island.js');
    const f = MT.ferry;
    const segmentDistance = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz))); return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t); };
    let clearance = Infinity;
    for (let i=0;i<=100;i++) {const t=i/100,x=f.berth.x+(f.offshore.x-f.berth.x)*t,z=f.berth.z+(f.offshore.z-f.berth.z)*t;for(const arm of harbor.arms)clearance=Math.min(clearance,segmentDistance(x,z,arm.a,arm.b)-arm.halfWidth);}
    return { terrainVersion: S.terrainVersion, ferry: {ready:f.ready,slip:[f.slip?.i,f.slip?.j],berth:f.berth?.toArray(),offshore:f.offshore?.toArray(),connected:MT.townNet().has(f.slip),clearance}, harbor, hillCentre, bayDepth: (radius(1.0)+radius(2.14))/2-radius(Math.PI/2), landCells:MT.cells.filter(c=>isLand(c.i-19.5,c.j-19.5)).length, flatEmpty:MT.cells.filter(c=>c.type==='empty'&&!c.h).length, roadsOffLand:MT.cells.filter(c=>c.type==='road'&&!isLand(c.i-19.5,c.j-19.5)&&!c.slip).map(c=>[c.i,c.j]),landmarks:MT.landmarks.map(l=>l.kind),canalCells:MT.canalCells.size, coast: [0,Math.PI/2,Math.PI,Math.PI*1.5].map(t=>coastPoint(t)) };
  });
  console.log(JSON.stringify({ ...report, errors }, null, 2));
  writeFileSync(`docs/harbor-island/check-${seed}.json`, JSON.stringify({ ...report, errors }, null, 2));
  await page.evaluate(() => {const f=MT.ferry; MT.cam.target.set(f.edge.x-1,0,f.edge.z+2);MT.cam.view=MT.cam.tView=17;});
  await frames(); await page.screenshot({ path: `docs/harbor-island/harbor-${seed}.png` });
  if (errors.length || !report.ferry.ready || !report.ferry.connected || report.ferry.clearance < 1.1 || report.roadsOffLand.length) process.exitCode = 1;
} finally { await browser.close(); }
