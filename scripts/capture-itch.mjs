/* global MT */
// Captures store images and verifies roads, credits and completion effects after npm run build.
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
const PORT = 4402, ROOT = process.cwd();
const pw = process.env.LOCALAPPDATA ? (() => { try { return readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter(d => d.startsWith('chromium-')).sort().reverse().map(d => process.env.LOCALAPPDATA + '/ms-playwright/' + d + '/chrome-win64/chrome.exe'); } catch { return []; } })() : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
if (!executablePath) throw Error('No Chromium browser found');
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', shell: process.platform === 'win32' });
const stop = () => { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill(); };
process.on('exit', stop);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const up = () => new Promise(res => { const s = net.connect(PORT, '127.0.0.1'); s.on('connect', () => { s.end(); res(true); }); s.on('error', () => res(false)); });
for (let k = 0; k < 60 && !(await up()); k++) await sleep(250);
mkdirSync('output/itch', { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1500,950'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('komachi.quality', JSON.stringify({preset:'custom',res:1,fps:15,ao:true,aoHalf:true,blur:true,msaa:false,shadows:'low',lights:true,busy:true})));
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/?seed=7&demo=dense`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(7000);
  await page.evaluate(async () => { for (let k = 0; k < 60 && !(MT.characterAvailable() && MT.serviceReady()); k++) await new Promise(r => setTimeout(r, 250)); });
  const rendered = () => page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
  const settle = async (card = false) => { await page.evaluate(c => { MT.setSpeed(1); const i = document.getElementById('inspect'); if (i) i.style.display = c ? '' : 'none'; const m = document.getElementById('milestone'); if (m) m.style.display = 'none'; }, card); await sleep(1400); await rendered(); };
  console.log('Town ready; checking roads and menus');
  await page.waitForFunction(() => !document.getElementById('loading') || document.getElementById('loading').classList.contains('gone'));
  const roads = await page.evaluate(() => MT.cells.filter(c => c.type === 'road' && MT.cell(c.i+1,c.j)?.type === 'road' && MT.cell(c.i,c.j+1)?.type === 'road' && MT.cell(c.i+1,c.j+1)?.type === 'road').map(c=>[c.i,c.j]));
  if (roads.length) throw Error('Double-width road patches: '+JSON.stringify(roads));
  await page.click('#btn-menu'); await page.click('[data-act="credits"]');
  await page.screenshot({path:'output/itch/credits-desktop.png'});
  if (!(await page.$eval('.mm-credits', e => e.textContent)).includes('Freesound')) throw Error('Missing credits');
  await page.setViewport({width:390,height:844});
  await page.screenshot({path:'output/itch/credits-mobile.png'});
  if (await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('Mobile overflow');
  await page.click('[data-act="back"]'); await page.click('[data-act="settings"]');
  await page.click('#opt-effects');
  if ((await page.evaluate(()=>MT.audioState())).effects) throw Error('Effects toggle failed');
  await page.click('#opt-effects'); await page.click('[data-act="back"]'); await page.click('[data-act="resume"]');
  await page.setViewport({width:1920,height:1080});
  await page.addStyleTag({content:'#hud,#tools,#inspect,#minimap,#toast,#hint,#tips,#picker,#milestone,#trailer-hud,#photo-bar,#tags,#bars,#bubbles,#tier,.tag,.bar{display:none!important}'});
  // the town finished, a clear late morning, the plaza busy
  await page.evaluate(() => { document.getElementById('intro')?.remove(); MT.setSpeed(0); MT.setWeather('clear', 60); for (const b of MT.blocks) { if (b.type === 'station') continue; b.stage = MT.DONE; b.renoT = 0; for (const u of b.units) MT.rebuildUnitMesh(u); } MT.setDay(3, 10.4); for (let k = 0; k < 30; k++) MT.fastForward(0.01); });
  await page.evaluate(() => { MT.cam.target.set(0.5, 0, 0.5); MT.cam.view = MT.cam.tView = 13; MT.cam.tYaw = MT.cam.yaw = 0.6; });
  await settle(); await page.screenshot({ path: 'output/itch/komachi-day.png' });
  // night, the same view
  await page.evaluate(() => { MT.setHour(20.6); for (let k = 0; k < 20; k++) MT.fastForward(0.01); });
  await settle(); await page.screenshot({ path: 'output/itch/komachi-night.png' });
  // the station plaza at night, close
  await page.evaluate(() => { const E = MT.STATION.entrance; MT.cam.target.set(E.x, 0.1, E.z - 0.9); MT.cam.view = MT.cam.tView = 5.2; MT.cam.tYaw = MT.cam.yaw = 0.35; MT.cam.pitch = 0.62; });
  await settle(); await page.screenshot({ path: 'output/itch/komachi-station.png' });
  // the whole island, afternoon
  await page.evaluate(() => { MT.setHour(15.5); for (let k = 0; k < 10; k++) MT.fastForward(0.01); MT.cam.target.set(0.5, 0, 0.5); MT.cam.view = MT.cam.tView = 34; MT.cam.tYaw = MT.cam.yaw = 0.6; MT.cam.pitch = 0.7; });
  await settle(); await page.screenshot({ path: 'output/itch/komachi-island.png' });
  // the harbour: the ferry coming in for the five o'clock call, late light
  const harbour = await page.evaluate(() => {
    MT.setHour(16.6); for (let k = 0; k < 400 && !(MT.ferry.state === 'arriving' && MT.ferry.t > 0.62); k++) MT.fastForward(0.01);
    const b = MT.ferry.mesh.position; MT.cam.target.set(b.x, 0, b.z - 1.2); MT.cam.view = MT.cam.tView = 10; MT.cam.tYaw = MT.cam.yaw = 0.6; MT.cam.pitch = 0.62;
    return { state: MT.ferry.state, hour: +(MT.T % 24).toFixed(2), at: [+b.x.toFixed(1), +b.z.toFixed(1)], visible: MT.ferry.mesh.visible };
  });
  console.log('HARBOUR', JSON.stringify(harbour));
  await settle(); await page.screenshot({ path: 'output/itch/komachi-harbour.png' });
  // a shop going up: place one beside a street and run until the crew is at work on the frame
  const site = await page.evaluate(() => {
    MT.setHour(9);
    const roads = MT.cells.filter(c => c.type === 'road' && c.drawn);
    let b = null;
    for (const r of roads) { for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = MT.cell(r.i + di, r.j + dj), c2 = MT.cell(r.i + di * 2, r.j + dj * 2); if (!c || c.type !== 'empty') continue; const sel = c2 && c2.type === 'empty' && MT.placeable(c2, [c, c2]) ? [c, c2] : [c]; if (!MT.placeable(c, sel)) continue; b = MT.placeBlock('shop', sel); if (b) break; } if (b) break; }
    if (!b) return null;
    for (let k = 0; k < 900 && !(b.stage >= 2 && b.crew.length && b.crew.some(w => w.state === 'working')); k++) MT.fastForward(0.01);
    const u = b.units[0]; MT.cam.target.set(u.mesh.position.x, 0.1, u.mesh.position.z); MT.cam.view = MT.cam.tView = 5.5; MT.cam.tYaw = MT.cam.yaw = 0.5; MT.cam.pitch = 0.6;
    return { stage: b.stage, crew: b.crew.length, name: b.name, hour: +(MT.T % 24).toFixed(2), trucks: MT.trucks.length };
  });
  console.log('SITE', JSON.stringify(site));
  await settle(true); await page.screenshot({ path: 'output/itch/komachi-construction.png' });
  const celebration = await page.evaluate(() => {
    const b = MT.blocks.find(b => b.type !== 'station' && b.stage < MT.DONE);
    if (!b) throw Error('No construction site for celebration check');
    for (let i=0;i<2500 && b.stage < MT.DONE;i++) MT.fastForward(0.01);
    return {finished:b.stage === MT.DONE, bursts:MT.scene.children.filter(c=>c.name === 'Building completion confetti').length};
  });
  if (!celebration.finished || !celebration.bursts) throw Error('Missing completion celebration '+JSON.stringify(celebration));
  await page.screenshot({path:'output/itch/celebration-check.png'});
  await page.waitForFunction(()=>!MT.scene.children.some(c=>c.name === 'Building completion confetti'), {timeout:60000});
  if(errors.length) throw Error(errors.join('\n'));
  writeFileSync('output/itch/validation.json',JSON.stringify({roadSquares:roads,celebration,errors,viewport:[1920,1080]},null,2));
  console.log('Itch screenshots, single-cell roads, credits, audio control and celebration checks passed.');
} finally { await browser.close(); stop(); }

