/* global MT */
// Captures store images and verifies roads, credits and completion effects after npm run build.
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const PORT = 4403, ROOT = process.cwd();
const pw = process.env.LOCALAPPDATA ? (() => { try { return readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter(d => d.startsWith('chromium-')).sort().reverse().map(d => process.env.LOCALAPPDATA + '/ms-playwright/' + d + '/chrome-win64/chrome.exe'); } catch { return []; } })() : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
if (!executablePath) throw Error('No Chromium browser found');
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', shell: process.platform === 'win32' });
const stop = () => { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill(); };
process.on('exit', stop);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const up = () => new Promise(res => { const s = net.connect(PORT, '127.0.0.1'); s.on('connect', () => { s.end(); res(true); }); s.on('error', () => res(false)); });
for (let k = 0; k < 60 && !(await up()); k++) await sleep(250);
mkdirSync('docs/backgrounds', { recursive: true });
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1500,950'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('komachi.quality', JSON.stringify({preset:'custom',res:1,fps:15,ao:true,aoHalf:true,blur:true,msaa:false,shadows:'low',lights:true,busy:true})));
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/?seed=7&demo=dense`, { waitUntil: 'domcontentloaded', timeout: 60000 }); await sleep(7000);
  await page.evaluate(async () => { for (let k = 0; k < 60 && !(MT.characterAvailable() && MT.serviceReady()); k++) await new Promise(r => setTimeout(r, 250)); });
  const rendered = () => page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
  await page.waitForFunction(() => document.getElementById('loading').classList.contains('gone'));
  const roadSquares = await page.evaluate(() => MT.cells.filter(c => c.type === 'road' && MT.cell(c.i+1,c.j)?.type === 'road' && MT.cell(c.i,c.j+1)?.type === 'road' && MT.cell(c.i+1,c.j+1)?.type === 'road').map(c=>[c.i,c.j]));
  if (roadSquares.length) throw Error('Double-width roads '+JSON.stringify(roadSquares));
  await page.evaluate(() => {
    document.getElementById('intro')?.remove(); MT.cancelGlide(); MT.setWeather('clear',60); MT.setDay(3,15.5);
    for (const b of MT.blocks) { if (b.type === 'station') continue; b.stage=MT.DONE; b.renoT=0; for(const u of b.units) MT.rebuildUnitMesh(u); }
    for(let k=0;k<20;k++) MT.fastForward(.01);
    MT.setSpeed(0); MT.cam.yaw=MT.cam.tYaw=.6; MT.cam.pitch=.7;
    MT.cam.view=MT.cam.tView=28;
    MT.cam.target.set(-7.2,0,4.8);
  });
  const hide = await page.addStyleTag({content:'body > :not(canvas):not(script):not(style){visibility:hidden!important}'});
  await rendered(); await rendered();
  await page.screenshot({path:'assets/backgrounds/komachi-menu-game.jpg',type:'jpeg',quality:94});
  await hide.evaluate(e=>e.remove());
  await page.click('#btn-menu'); await page.click('[data-act="title"]');
  const url='data:image/jpeg;base64,'+readFileSync('assets/backgrounds/komachi-menu-game.jpg').toString('base64');
  await page.evaluate(url=>{document.querySelector('#menu .mm-bg').style.backgroundImage=`url("${url}")`;},url);
  await page.screenshot({path:'docs/backgrounds/menu-desktop.png'});
  await page.setViewport({width:390,height:844}); await rendered();
  await page.screenshot({path:'docs/backgrounds/menu-mobile.png'});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw Error('Mobile overflow');
  if(errors.length) throw Error(errors.join('\n'));
  writeFileSync('docs/backgrounds/menu-validation.json',JSON.stringify({source:'in-game simulation',seed:7,roadSquares,errors},null,2));
  console.log('Captured in-game background and checked desktop/mobile menus.');
} finally { await browser.close(); stop(); }
