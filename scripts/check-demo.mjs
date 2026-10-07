/* global MT */
// Checks the web demo build (npm run build:demo first): serves dist-demo/, loads it headless and verifies the demo's shape: the
// "Demo" link in the brand card, no New town / Load town rows on the title once a town exists, the town kept in sessionStorage
// (not localStorage), the offer card after DEMO_DAYS with a link to the store and a Keep playing button that puts it away while
// the town carries on. Run: npm run check:demo
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync } from 'node:fs';
const PORT = 4453, ROOT = process.cwd();
const pw = process.env.LOCALAPPDATA ? (() => { try { return readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter(d => d.startsWith('chromium-')).sort().reverse().map(d => process.env.LOCALAPPDATA + '/ms-playwright/' + d + '/chrome-win64/chrome.exe'); } catch { return []; } })() : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
if (!executablePath) throw Error('No Chromium browser found');
if (!existsSync('dist-demo/index.html')) { console.error('FAIL  dist-demo/ missing: run npm run build:demo first'); process.exit(1); }
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--outDir', 'dist-demo', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', shell: process.platform === 'win32' });
const stop = () => { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill(); };
process.on('exit', stop);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const up = () => new Promise(res => { const s = net.connect(PORT, '127.0.0.1'); s.on('connect', () => { s.end(); res(true); }); s.on('error', () => res(false)); });
for (let k = 0; k < 60 && !(await up()); k++) await sleep(250);
let failed = 0; const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); if (!ok) failed++; };
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 800 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/?look=classic`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(async () => { for (let k = 0; k < 160 && !document.getElementById('loading').classList.contains('gone'); k++) await new Promise(r => setTimeout(r, 250)); });
  await sleep(500);
  const st = await page.evaluate(() => MT.demoState());
  check('the build is the demo', st.demo === true, JSON.stringify(st));
  const tag = await page.evaluate(() => { const a = document.getElementById('demo-tag'); return a ? { href: a.href, target: a.target, text: a.textContent } : null; });
  check('a Demo link to the store sits in the brand card', tag && /itch\.io/.test(tag.href) && tag.target === '_blank', JSON.stringify(tag));
  // start a town from the title, skip the opening, then look at the title again
  await page.evaluate(() => document.querySelector('#menu [data-act="start"], #menu [data-act="continue"]').click());
  await page.evaluate(async () => { const wait = async (f, n) => { for (let k = 0; k < n; k++) { if (f()) return; await new Promise(r => setTimeout(r, 100)); } }; await wait(() => MT.opening.active || !document.getElementById('menu').classList.contains('show'), 40); if (MT.opening.active) { dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' })); await wait(() => !MT.opening.active, 60); } });
  const storage = await page.evaluate(() => ({ session: Object.keys(sessionStorage).filter(k => k.startsWith('komachi.slot')).length, local: Object.keys(localStorage).filter(k => k.startsWith('komachi.slot')).length }));
  check('the town is kept for the session only (sessionStorage, not localStorage)', storage.session >= 1 && storage.local === 0, JSON.stringify(storage));
  await page.evaluate(() => document.getElementById('btn-menu').click()); await sleep(400);
  await page.evaluate(() => document.querySelector('#menu [data-act="title"]')?.click()); await sleep(600);
  const rows = await page.evaluate(() => [...document.querySelectorAll('#menu .mm-btn, #menu .mm-link')].map(b => b.dataset.act || b.textContent.trim().slice(0, 24)));
  check('the title has no New town, Load town, export or import', !rows.includes('new') && !rows.includes('towns') && !rows.includes('import'), rows.join(' '));
  check('the title offers the full game instead', rows.some(r => /full game/i.test(r)), rows.join(' '));
  await page.evaluate(() => document.querySelector('#menu [data-act="continue"], #menu [data-act="start"]')?.click()); await sleep(600);
  // day 8: the offer card, with a store link; Keep playing puts it away and the clock keeps running
  await page.evaluate(() => { MT.setDay(8, 9); MT.setSpeed(1); });
  let demo = null; for (let k = 0; k < 60 && !(demo && demo.open); k++) { await sleep(250); demo = await page.evaluate(() => MT.demoState()); }
  const cardInfo = await page.evaluate(() => { const c = document.getElementById('demo-card'); const a = c && c.querySelector('a.dc-get'); return { open: c && c.classList.contains('show'), href: a && a.href, target: a && a.target }; });
  check('after the demo days a card offers the full game with a store link', cardInfo.open && /itch\.io/.test(cardInfo.href) && cardInfo.target === '_blank', JSON.stringify(cardInfo));
  const t0 = await page.evaluate(() => MT.T); await page.evaluate(() => document.querySelector('#demo-card .dc-keep').click()); await sleep(1500);
  const after = await page.evaluate(() => ({ open: document.getElementById('demo-card').classList.contains('show'), T: MT.T, speed: MT.demoState().speed }));
  check('Keep playing puts the card away and the town carries on', !after.open && after.T > t0 && after.speed > 0, JSON.stringify({ before: t0, after }));
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
} finally { await browser.close(); stop(); }
if (failed) { console.log(`${failed} check(s) failed`); process.exit(1); } else console.log('all demo checks passed');
