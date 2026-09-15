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

  await page.keyboard.press('Digit4'); const rp = await page.evaluate(() => MT.project(20, 22)); await page.mouse.click(rp.x, rp.y); await sleep(200);
  s = await page.evaluate(() => MT.blocks.length); check("cannot build on the station's ring road", s === 3);
  await page.evaluate(() => { MT.cam.view = MT.cam.tView = 42; }); await sleep(300);
  const hc = await page.evaluate(() => { const c = MT.cells.find(c => c.type === 'hill'); return c ? MT.project(c.i, c.j) : null; });
  if (hc) { await page.mouse.click(hc.x, hc.y); await sleep(200); }
  s = await page.evaluate(() => ({ blocks: MT.blocks.length, hills: MT.cells.filter(c => c.type === 'hill').length }));
  check('the steep parts of the hill cannot be built on', s.blocks === 3 && s.hills >= 12, JSON.stringify(s));
  s = await page.evaluate(() => {
    const plot = MT.cells.find(c => c.type === 'empty' && c.h > 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => { const n = MT.cell(c.i + di, c.j + dj); return n && n.type === 'empty' && n.h === c.h; }));
    if (!plot) return null;
    const b = MT.placeBlock('res', [plot]); const u = b.units[0];
    return { h: plot.h, meshY: u.mesh.position.y, ground: MT.terrainY(plot.i - 20 + 0.5, plot.j - 20 + 0.5), ramps: MT.cells.filter(c => c.ramp).length, ring: [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => { const n = MT.cell(plot.i + di, plot.j + dj); return n && n.type === 'road'; }) };
  });
  check('a home can be built on a hill terrace at its height', !!s && s.meshY === s.h && s.ground === s.h && s.ramps >= 1 && s.ring, JSON.stringify(s));
  await page.evaluate(() => { const b = MT.blocks[MT.blocks.length - 1]; if (b.cells[0].h > 0) MT.removeBlock(b); });
  await page.evaluate(() => { MT.cam.view = MT.cam.tView = 18; }); await sleep(300);
  const wp = await page.evaluate(() => MT.project(17, 22)); await page.mouse.click(wp.x, wp.y); await sleep(200);
  s = await page.evaluate(() => ({ blocks: MT.blocks.length, cell: MT.cell(17, 22).type, side: MT.cell(16, 22).type }));
  check('a street between blocks can be built over', s.blocks === 4 && s.cell === 'lot' && s.side === 'road', JSON.stringify(s));

  await page.evaluate(() => MT.fastForward(40));
  s = await page.evaluate(() => ({ stages: MT.blocks.filter(b => b.type !== 'station').map(b => b.stage), done: MT.DONE, residents: MT.residents.length, housed: MT.residents.filter(r => r.home).length, beds: MT.blocks.filter(b => b.type === 'res').flatMap(b => b.units).reduce((n, u) => n + MT.unitCap(u), 0), shopJob: MT.residents.some(r => r.job && r.job.block.type === 'shop') }));
  check('construction completes and newcomers fill every bed', s.stages.every(x => x === s.done) && s.beds >= 6 && s.housed === s.beds, JSON.stringify(s));
  check('a resident takes the shop job', s.shopJob);
  s = await page.evaluate(() => { const seen = new Set(); for (let k = 0; k < 96; k++) { MT.fastForward(0.25); for (const r of MT.residents) seen.add(r.actKind); } return { kinds: [...seen], hh: MT.households.filter(h => h.members.length).length, moods: MT.residents.map(r => Object.values(r.needs).every(v => v >= 0 && v <= 1)).every(Boolean) }; });
  check('residents live by their needs (sleep, meals, errands) in households', s.kinds.includes('sleep') && s.kinds.includes('eat') && (s.kinds.includes('shop') || s.kinds.includes('stroll') || s.kinds.includes('visit')) && s.hh >= 1 && s.moods, JSON.stringify(s));

  // hover: pause the town so a passer-by cannot steal the pick, then poll (the card refreshes on a frame
  // accumulator, so slow software-rendered CI runners need a few seconds)
  await page.keyboard.press('Digit1'); await page.evaluate(() => MT.setSpeed(0));
  const hp = await page.evaluate(() => MT.project(17, 19, 0.5)); await page.mouse.move(hp.x - 2, hp.y - 2); await page.mouse.move(hp.x, hp.y);
  let inspectText = '';
  const cardOk = t => /Residents/.test(t) && /\d+ \/ \d+/.test(t);
  for (let k = 0; k < 40 && !cardOk(inspectText); k++) { await sleep(250); inspectText = await page.evaluate(() => document.getElementById('inspect').innerText); }
  check('hover opens inspect card', cardOk(inspectText), inspectText.slice(0, 140).replace(/\n+/g, ' | '));
  await page.evaluate(() => MT.setSpeed(1));

  await page.keyboard.press('Digit5'); await page.mouse.click(sp.x, sp.y); await sleep(200);
  s = await page.evaluate(() => ({ blocks: MT.blocks.length, orphan: MT.cell(17, 24).type, kept: MT.cell(17, 21).type, residents: MT.residents.length }));
  check('remove tool clears block and orphan roads', s.blocks === 3 && s.orphan === 'empty' && s.kept === 'road', JSON.stringify(s));
  await page.evaluate(() => MT.fastForward(30));

  // ── save and load: the town survives a reload ──
  const before = await page.evaluate(() => { MT.save(); return { blocks: MT.blocks.length, residents: MT.residents.length, housed: MT.residents.filter(r => r.home).length, hh: MT.households.filter(h => h.members.length).length, T: Math.floor(MT.T) }; });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0', timeout: 60000 }); await sleep(800);
  s = await page.evaluate(() => ({ blocks: MT.blocks.length, residents: MT.residents.length, housed: MT.residents.filter(r => r.home).length, hh: MT.households.filter(h => h.members.length).length, T: Math.floor(MT.T) }));
  check('save and load restores the town', s.blocks === before.blocks && s.residents === before.residents && s.housed === before.housed && s.hh === before.hh && s.T === before.T, JSON.stringify({ before, after: s }));
  await page.evaluate(() => MT.clearSave());

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
