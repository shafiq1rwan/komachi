/* global MT */
// Checks the Poki build (npm run build:poki first): serves dist-poki/, loads the game headless and verifies Poki's rules:
// no request to any host but the page itself and Poki's SDK CDN, no service worker, the SDK fetched, the menu without an
// Exit row or outbound links, and gameLoadingFinished / gameplayStart / gameplayStop sent at the right moments (the SDK's own
// calls are recorded by src/poki.js whether or not the CDN answered). Run: npm run check:poki
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync } from 'node:fs';
const PORT = 4451, ROOT = process.cwd();
const pw = process.env.LOCALAPPDATA ? (() => { try { return readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter(d => d.startsWith('chromium-')).sort().reverse().map(d => process.env.LOCALAPPDATA + '/ms-playwright/' + d + '/chrome-win64/chrome.exe'); } catch { return []; } })() : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
if (!executablePath) throw Error('No Chromium browser found');
if (!existsSync('dist-poki/index.html')) { console.error('FAIL  dist-poki/ missing: run npm run build:poki first'); process.exit(1); }
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--outDir', 'dist-poki', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', shell: process.platform === 'win32' });
const stop = () => { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill(); };
process.on('exit', stop);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const up = () => new Promise(res => { const s = net.connect(PORT, '127.0.0.1'); s.on('connect', () => { s.end(); res(true); }); s.on('error', () => res(false)); });
for (let k = 0; k < 60 && !(await up()); k++) await sleep(250);
let failed = 0; const check = (name, ok, info = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); if (!ok) failed++; };
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,800'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 800 });
  const hosts = new Set(), gameHosts = new Set();   // gameHosts: requests the page itself made (the SDK's own ad stack is Poki's business)
  page.on('request', r => { try { const h = new URL(r.url()).host; hosts.add(h); const init = r.initiator(); const bySdk = (init && JSON.stringify(init).includes('poki')) || /poki|doubleclick|googlesyndication|imasdk.googleapis|amazon-adsystem/.test(h); if (!bySdk) gameHosts.add(h); } catch { /* data: */ } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  // a plain visit, as Poki's iframe would make it: the loading screen, then the title menu
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(async () => { for (let k = 0; k < 160 && !document.getElementById('loading').classList.contains('gone'); k++) await new Promise(r => setTimeout(r, 250)); });
  await sleep(500);
  const own = `localhost:${PORT}`, foreign = [...gameHosts].filter(h => h !== own && h !== 'game-cdn.poki.com');
  check('no request leaves the game except for the Poki SDK', foreign.length === 0, foreign.join(', ') || `game: ${[...gameHosts].join(', ')}; via SDK: ${[...hosts].filter(h => !gameHosts.has(h)).join(', ')}`);
  const sw = await page.evaluate(async () => { const r = await fetch('./sw.js'); return `${r.status} ${r.headers.get('content-type') || ''}`; });   // vite preview answers any path with index.html
  check('no service worker in the build', !/javascript/.test(sw), `sw.js → ${sw}`);
  const swReg = await page.evaluate(async () => !!(navigator.serviceWorker && (await navigator.serviceWorker.getRegistration())));
  check('no service worker registered', !swReg);
  const st = await page.evaluate(() => MT.pokiState());
  check('the build is the Poki build', st.poki === true);
  check('the SDK script was requested', hosts.has('game-cdn.poki.com'));
  check('gameLoadingFinished sent after init, once the loading screen is gone', !st.ready || (st.calls.indexOf('init') < st.calls.indexOf('gameLoadingFinished')), st.ready ? st.calls.join(' ') : 'SDK did not initialise here (offline or blocked): calls skipped by design');
  const menu = await page.evaluate(() => ({ open: document.getElementById('menu').classList.contains('show'), exit: !!document.querySelector('#menu [data-act="exit"]'), install: (() => { const e = document.getElementById('opt-install'); return !!e && getComputedStyle(e).display !== 'none'; })() }));
  check('title menu up, no Exit row, no install button', menu.open && !menu.exit && !menu.install, JSON.stringify(menu));
  await page.evaluate(() => document.querySelector('#menu [data-act="credits"]').click()); await sleep(200);
  const links = await page.evaluate(() => document.querySelectorAll('#menu a[href^="http"]').length);
  check('credits page has no outbound links', links === 0, `${links} links`);
  await page.evaluate(() => document.querySelector('#menu [data-act="back"]').click()); await sleep(200);
  // start: a break (instant without the SDK), then play; the opening is skipped with Esc
  await page.evaluate(() => document.querySelector('#menu [data-act="start"]').click()); await sleep(800);
  await page.keyboard.press('Escape'); await sleep(600);
  const after = await page.evaluate(() => ({ menu: document.getElementById('menu').classList.contains('show'), calls: MT.pokiState().calls, ready: MT.pokiState().ready, playing: MT.pokiState().playing }));
  check('play began after Start', !after.menu, JSON.stringify(after));
  check('gameplayStart sent (when the SDK is live)', !after.ready || after.calls.includes('gameplayStart'), after.calls.join(' ') || 'no SDK');
  await page.keyboard.press('Escape'); await sleep(300);
  const paused = await page.evaluate(() => ({ menu: document.getElementById('menu').classList.contains('show'), calls: MT.pokiState().calls, ready: MT.pokiState().ready }));
  check('gameplayStop sent when the pause menu opens (when the SDK is live)', paused.menu && (!paused.ready || paused.calls.includes('gameplayStop')), paused.calls.join(' ') || 'no SDK');
  check('fonts loaded from the build itself', await page.evaluate(() => document.fonts.check('800 16px Nunito') && document.fonts.check('600 16px Caveat')));
  check('no page errors', errors.length === 0, errors.join(' | '));
  await page.screenshot({ path: 'scripts/out/poki.png' });
  // Poki runs the game in a cross-origin iframe: a page on another origin embeds the build and the game must still load and start
  const host = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(`<html><body style="margin:0"><iframe id="g" src="http://localhost:${PORT}/" style="border:0;width:1280px;height:800px" allow="autoplay; fullscreen"></iframe></body></html>`); }).listen(PORT + 1);
  try {
    const page2 = await browser.newPage(); await page2.setViewport({ width: 1280, height: 800 });
    const errs2 = []; page2.on('pageerror', e => errs2.push(e.message)); page2.on('console', m => { if (m.type() === 'error') errs2.push(m.text()); });
    await page2.goto(`http://127.0.0.1:${PORT + 1}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const frame = await (await page2.waitForSelector('#g')).contentFrame();
    const gone = await frame.evaluate(async () => { for (let k = 0; k < 160; k++) { const l = document.getElementById('loading'); if (l && l.classList.contains('gone')) return true; await new Promise(r => setTimeout(r, 250)); } return false; });
    check('loads inside a cross-origin iframe (loading screen gone within 40 s)', gone);
    const fr = await frame.evaluate(() => ({ menu: document.getElementById('menu').classList.contains('show'), canvas: !!document.querySelector('canvas'), storage: (() => { try { localStorage.setItem('k', '1'); return true; } catch { return false; } })() }));
    check('title menu shows inside the iframe', fr.menu, JSON.stringify(fr));
    check('no errors inside the iframe', errs2.length === 0, errs2.slice(0, 3).join(' | '));
    await page2.screenshot({ path: 'scripts/out/poki-iframe.png' });
  } finally { host.close(); }
} finally { await browser.close(); stop(); }
console.log(failed ? `${failed} check(s) failed` : 'all Poki checks passed'); process.exit(failed ? 1 : 0);
