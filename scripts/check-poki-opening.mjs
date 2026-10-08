/* global MT */
// Exercises the Poki opening through real mouse placement and normal-speed simulation steps.
// Render-independent advancement keeps software WebGL speed from changing the pacing measurement.
// Run after build:poki: node scripts/check-poki-opening.mjs
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync } from 'node:fs';
const PORT = 4453, ROOT = process.cwd();
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
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/?new&seed=2026&guided&log`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.MT && MT.pokiOnboardingState().locked, { timeout: 60000 });
  const initial = await page.evaluate(() => ({ ...MT.pokiOnboardingState(), roads: MT.progressFacts().drawnConnected }));
  check('fresh Poki town has a ready connected street and one placement spotlight', initial.locked && initial.roads >= 2, JSON.stringify(initial));
  await page.screenshot({ path: 'scripts/out/poki-opening-home.png' });
  await page.click('[data-tool="road"]');
  check('the spotlight prevents changing tools', await page.evaluate(() => document.querySelector('[data-tool="res"]').classList.contains('on')));
  const position = await page.evaluate(() => { const p = MT.pokiOnboardingState().plot; return MT.project(p.i, p.j); });
  await page.mouse.click(position.x, position.y);
  await page.waitForFunction(() => !MT.pokiOnboardingState().locked && MT.blocks.some(b => b.type === 'res'), { timeout: 10000 });
  check('clicking the highlighted world plot builds a home and releases control', true);
  await page.evaluate(() => { for (let k = 0; k < 75 && MT.pokiOnboardingState().stage !== 'request'; k++) MT.advanceOpening(1); });
  check('the household sequence reaches the shop request', await page.evaluate(() => MT.pokiOnboardingState().stage === 'request'), JSON.stringify(await page.evaluate(() => ({ state: MT.pokiOnboardingState(), stages: MT.blocks.map(b => [b.type, b.stage]), residents: MT.residents.map(r => [r.state, !!r.home, r.movingIn]) }))));
  const arrived = await page.evaluate(() => ({ elapsed: MT.pokiOnboardingState().elapsed, housed: MT.progressFacts().housed }));
  check('first neighbours arrive within 75 active seconds at normal speed', arrived.housed > 0 && arrived.elapsed < 75, JSON.stringify(arrived));
  await page.screenshot({ path: 'scripts/out/poki-opening-neighbour.png' });
  await page.click('[data-kind="bakery"][data-intro="build"]');
  const shopPosition = await page.evaluate(() => { const p = MT.progressCue().cells[0]; return MT.project(p.i, p.j); });
  await page.mouse.click(shopPosition.x, shopPosition.y);
  await page.evaluate(() => { for (let k = 0; k < 110 && MT.pokiOnboardingState().stage !== 'reward'; k++) MT.advanceOpening(1); });
  check('the shop sequence reaches its customer reward', await page.evaluate(() => MT.pokiOnboardingState().stage === 'reward'), JSON.stringify(await page.evaluate(() => ({ state: MT.pokiOnboardingState(), stages: MT.blocks.map(b => [b.type, b.stage]), residents: MT.residents.map(r => [r.state, r.purpose, r.at?.block.type]) }))));
  const reward = await page.evaluate(() => ({ elapsed: MT.pokiOnboardingState().elapsed, visits: MT.blocks.find(b => b.type === 'shop').visitsToday, terrace: MT.canBuild('res', 'terrace') }));
  check('a real shop visit earns terrace homes within three active minutes', reward.visits > 0 && reward.terrace && reward.elapsed < 180, JSON.stringify(reward));
  await page.screenshot({ path: 'scripts/out/poki-opening-reward.png' });
  await page.click('[data-intro="finish"]');
  check('completion returns to regular town goals', await page.evaluate(() => !document.body.classList.contains('poki-onboarding')));
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`http://localhost:${PORT}/?new&seed=37&guided`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.MT && MT.pokiOnboardingState().locked, { timeout: 60000 });
  await page.screenshot({ path: 'scripts/out/poki-opening-mobile.png' });
  const layout = await page.evaluate(() => { const c = document.getElementById('poki-opening-card').getBoundingClientRect(); const s = document.getElementById('poki-spotlight').getBoundingClientRect(); return { cardFits: c.left >= 0 && c.right <= innerWidth && c.bottom <= innerHeight, plotClear: s.bottom < c.top || s.top > c.bottom || s.right < c.left || s.left > c.right }; });
  check('phone spotlight and card fit without covering each other', layout.cardFits && layout.plotClear, JSON.stringify(layout));
  await page.click('[data-intro="skip"]');
  check('Skip restores unrestricted play', await page.evaluate(() => !MT.pokiOnboardingState().locked && !document.body.classList.contains('poki-onboarding')));
  check('no page errors throughout the first neighbourhood', errors.length === 0, errors.join(' | '));
} finally { await browser.close(); stop(); }
console.log(failed ? `${failed} check(s) failed` : 'all Poki opening checks passed'); process.exit(failed ? 1 : 0);
