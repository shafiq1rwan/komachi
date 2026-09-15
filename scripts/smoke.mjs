// Headless smoke test: builds nothing itself — run `npm run build` first.
// Serves dist/ with `vite preview`, drives the game through the window.MT dev hooks,
// checks placement rules, construction, residents and removal, and saves screenshots to scripts/out/.
//
// Needs a Chromium-based browser. Set BROWSER_PATH if it is not at one of the default locations.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const candidates = [process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const executablePath = candidates.find(p => existsSync(p));
if (!executablePath) { console.error('No Chromium browser found. Set BROWSER_PATH.'); process.exit(2); }

const PORT = 4179;
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
await new Promise(r => setTimeout(r, 2500));
mkdirSync('scripts/out', { recursive: true });

let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1500,950'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1500, height: 950 });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // ── interaction on an empty island ──
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0', timeout: 60000 }); await sleep(800);
  let s = await page.evaluate(() => ({ blocks: MT.blocks.length, type: MT.blocks[0]?.type, centre: MT.cell(20, 20).type, ring: MT.cell(20, 22).type }));
  check('station is placed at the centre with a ring road', s.blocks === 1 && s.type === 'station' && s.centre === 'lot' && s.ring === 'road', JSON.stringify(s));
  await page.evaluate(() => MT.fastForward(6));
  s = await page.evaluate(() => ({ waiting: MT.residents.filter(r => !r.home).length, seated: MT.residents.filter(r => r.spot).length, station: document.querySelector('#s-wait').textContent }));
  check('newcomers arrive by train and wait at the station', s.waiting >= 1 && s.seated >= 1, JSON.stringify(s));
  await page.click('#intro-go');
  const pts = await page.evaluate(() => [[17, 18], [17, 19], [17, 20], [17, 21]].map(([i, j]) => MT.project(i, j)));
  await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
  for (const p of pts) { await page.mouse.move(p.x, p.y, { steps: 5 }); await sleep(40); }
  await page.mouse.up(); await sleep(200);
  s = await page.evaluate(() => ({ blocks: MT.blocks.length, n: MT.blocks[1]?.cells.length, roads: MT.roadCount(), ring: MT.cell(16, 19).type, inside: MT.cell(17, 19).type, shared: MT.cell(18, 19).type }));
  check('drag across 4 cells makes one block of 3', s.blocks === 2 && s.n === 3, JSON.stringify(s));
  check('roads ring the block and join the station ring', s.ring === 'road' && s.inside === 'lot' && s.shared === 'road');

  await page.keyboard.press('Digit3'); const sp = await page.evaluate(() => MT.project(17, 23)); await page.mouse.click(sp.x, sp.y); await sleep(200);
  s = await page.evaluate(() => ({ blocks: MT.blocks.length, types: MT.blocks.map(b => b.type), between: MT.cell(17, 22).type }));
  check('single click places a shop; road between blocks', s.blocks === 3 && s.types[2] === 'shop' && s.between === 'road', JSON.stringify(s));

  await page.keyboard.press('Digit4'); const rp = await page.evaluate(() => MT.project(17, 22)); await page.mouse.click(rp.x, rp.y); await sleep(200);
  s = await page.evaluate(() => MT.blocks.length); check('cannot build on a road', s === 3);

  await page.evaluate(() => MT.fastForward(40));
  s = await page.evaluate(() => ({ stages: MT.blocks.filter(b => b.type !== 'station').map(b => b.stage), residents: MT.residents.length, housed: MT.residents.filter(r => r.home).length, beds: MT.blocks.filter(b => b.type === 'res').flatMap(b => b.units).reduce((n, u) => n + MT.unitCap(u), 0), jobs: MT.residents.filter(r => r.job).length }));
  check('construction completes and newcomers fill every bed', s.stages.every(x => x === 3) && s.beds >= 6 && s.housed === s.beds, JSON.stringify(s));
  check('a resident takes the shop job', s.jobs === 1);

  // hover: pause the town so a passer-by cannot steal the pick, then poll (the card refreshes on a frame
  // accumulator, so slow software-rendered CI runners need a few seconds)
  await page.keyboard.press('Digit1'); await page.evaluate(() => MT.setSpeed(0));
  const hp = await page.evaluate(() => MT.project(17, 19, 0.5)); await page.mouse.move(hp.x - 2, hp.y - 2); await page.mouse.move(hp.x, hp.y);
  let inspectText = '';
  for (let k = 0; k < 40 && !(/Residents/.test(inspectText) && /d+ / d+/.test(inspectText)); k++) { await sleep(250); inspectText = await page.evaluate(() => document.getElementById('inspect').innerText); }
  check('hover opens inspect card', /Residents/.test(inspectText) && /d+ / d+/.test(inspectText), inspectText.slice(0, 140).replace(/
+/g, ' | '));
  await page.evaluate(() => MT.setSpeed(1));

  await page.keyboard.press('Digit5'); await page.mouse.click(sp.x, sp.y); await sleep(200);
  s = await page.evaluate(() => ({ blocks: MT.blocks.length, orphan: MT.cell(17, 24).type, kept: MT.cell(17, 21).type, residents: MT.residents.length }));
  check('remove tool clears block and orphan roads', s.blocks === 2 && s.orphan === 'empty' && s.kept === 'road', JSON.stringify(s));
  await page.evaluate(() => MT.fastForward(30));

  // ── demo town screenshots ──
  await page.goto(`http://localhost:${PORT}/?demo`, { waitUntil: 'networkidle0', timeout: 60000 }); await sleep(2000);
  await page.screenshot({ path: 'scripts/out/day.png' });
  await page.evaluate(() => MT.setHour(21.5)); await sleep(1000);
  await page.screenshot({ path: 'scripts/out/night.png' });
  s = await page.evaluate(() => ({ blocks: MT.blocks.length, residents: MT.residents.length, jobs: MT.residents.filter(r => r.job).length }));
  check('demo town populated', s.blocks === 8 && s.residents >= 10 && s.jobs >= 8, JSON.stringify(s));
  check('no page errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close(); server.kill();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
