/* global MT */
// Retakes the five README screenshots in docs/ from the dense demo town (run npm run build first): node scripts/capture-readme.mjs
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync } from 'node:fs';
const PORT = 4401, ROOT = process.cwd();
const pw = process.env.LOCALAPPDATA ? (() => { try { return readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter(d => d.startsWith('chromium-')).sort().reverse().map(d => process.env.LOCALAPPDATA + '/ms-playwright/' + d + '/chrome-win64/chrome.exe'); } catch { return []; } })() : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
if (!executablePath) throw Error('No Chromium browser found');
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', shell: process.platform === 'win32' });
const stop = () => { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill(); };
process.on('exit', stop);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const up = () => new Promise(res => { const s = net.connect(PORT, '127.0.0.1'); s.on('connect', () => { s.end(); res(true); }); s.on('error', () => res(false)); });
for (let k = 0; k < 60 && !(await up()); k++) await sleep(250);
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1500,950'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1500, height: 950 });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto(`http://localhost:${PORT}/?seed=7&demo=dense`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(7000);
  await page.evaluate(async () => { for (let k = 0; k < 60 && !(MT.characterAvailable() && MT.serviceReady()); k++) await new Promise(r => setTimeout(r, 250)); });
  const rendered = () => page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
  const settle = async (card = false) => { await page.evaluate(c => { MT.setSpeed(1); const i = document.getElementById('inspect'); if (i) i.style.display = c ? '' : 'none'; const m = document.getElementById('milestone'); if (m) m.style.display = 'none'; }, card); await sleep(1400); await rendered(); };
  // the town finished, a clear late morning, the plaza busy
  await page.evaluate(() => { document.getElementById('intro')?.remove(); MT.setSpeed(0); MT.setWeather('clear', 60); for (const b of MT.blocks) { if (b.type === 'station') continue; b.stage = MT.DONE; b.renoT = 0; for (const u of b.units) MT.rebuildUnitMesh(u); } MT.setDay(3, 10.4); for (let k = 0; k < 30; k++) MT.fastForward(0.01); });
  await page.evaluate(() => { MT.cam.target.set(0.5, 0, 0.5); MT.cam.view = MT.cam.tView = 13; MT.cam.tYaw = MT.cam.yaw = 0.6; });
  await settle(); await page.screenshot({ path: 'docs/screenshot-day.png' });
  // night, the same view
  await page.evaluate(() => { MT.setHour(20.6); for (let k = 0; k < 20; k++) MT.fastForward(0.01); });
  await settle(); await page.screenshot({ path: 'docs/screenshot-night.png' });
  // the station plaza at night, close
  await page.evaluate(() => { const E = MT.STATION.entrance; MT.cam.target.set(E.x, 0.1, E.z - 0.9); MT.cam.view = MT.cam.tView = 5.2; MT.cam.tYaw = MT.cam.yaw = 0.35; MT.cam.pitch = 0.62; });
  await settle(); await page.screenshot({ path: 'docs/screenshot-station.png' });
  // the whole island, afternoon
  await page.evaluate(() => { MT.setHour(15.5); for (let k = 0; k < 10; k++) MT.fastForward(0.01); MT.cam.target.set(0.5, 0, 0.5); MT.cam.view = MT.cam.tView = 34; MT.cam.tYaw = MT.cam.yaw = 0.6; MT.cam.pitch = 0.7; });
  await settle(); await page.screenshot({ path: 'docs/screenshot-island.png' });
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
  await settle(true); await page.screenshot({ path: 'docs/screenshot-construction.png' });
} finally { await browser.close(); stop(); }
