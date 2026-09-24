// Headless smoke test: builds nothing itself — run `npm run build` first.
// Serves dist/ with `vite preview`, drives the game through the window.MT dev hooks,
// checks placement rules, construction, residents and removal, and saves screenshots to scripts/out/.
//
// Needs a Chromium-based browser. Set BROWSER_PATH if it is not at one of the default locations.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const pw = process.env.LOCALAPPDATA ? (() => { try { return readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter(d => d.startsWith('chromium-')).sort().reverse().map(d => process.env.LOCALAPPDATA + '/ms-playwright/' + d + '/chrome-win64/chrome.exe'); } catch { return []; } })() : [];
const candidates = [process.env.BROWSER_PATH, ...pw,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const executablePath = candidates.find(p => existsSync(p));
if (!executablePath) { console.error('No Chromium browser found. Set BROWSER_PATH.'); process.exit(2); }

const PORT = 4179;
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
// on Windows the server runs under a shell, and kill() stops only the shell: end the whole tree, also when the run fails early
let stopped = false;
const stopServer = () => { if (stopped) return; stopped = true; if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill(); };
process.on('exit', stopServer);
for (let k = 0; k < 60; k++) { try { if ((await fetch('http://localhost:' + PORT + '/')).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }
mkdirSync('scripts/out', { recursive: true });

let failures = 0;
const failedNames = [];
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) { failures++; failedNames.push(name); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1500,950'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1500, height: 950 });
  await page.evaluateOnNewDocument(() => { const oe = console.error.bind(console); console.error = (...a) => { oe(...a); if (String(a[0]).includes('NaN')) { let where = ''; try { const bad = []; window.MT.scene.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; const arr = o.geometry.attributes.position.array; for (let q = 0; q < arr.length; q += 3) if (!isFinite(arr[q])) { const chain = []; for (let p = o; p; p = p.parent) chain.push(p.name || p.type + (p.userData && p.userData.unit ? ':' + p.userData.unit.block.name + '/' + (p.userData.unit.block.kind || p.userData.unit.variant) : p.userData && p.userData.res ? ':person ' + p.userData.res.name : p.userData && p.userData.worker ? ':worker' : p.userData && p.userData.lights !== undefined ? ':vehicle' : '')); bad.push(chain.join('<') + ' n=' + arr.length / 3); break; } }); where = bad.slice(0, 4).join(' ; '); } catch (e) { where = 'scan failed ' + e.message; } window.__nanStack = (window.__nanStack || '') + ' NaN mesh at error time: ' + (where || 'none found') + ' ## '; } }; });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // ── interaction on an empty island ──
  await page.goto(`http://localhost:${PORT}/?seed=7&look=classic`, { waitUntil: 'networkidle0', timeout: 60000 }); await sleep(800);   // a fixed island keeps the checks deterministic; the checks run in the lighter classic look (same simulation, far quicker frames under software GL), the screenshots in the standard one
  let s = await page.evaluate(() => ({ blocks: MT.blocks.length, type: MT.blocks[0]?.type, centre: MT.cell(20, 20).type, ring: MT.cell(20, 22).type }));
  check('station is placed at the centre with a ring road', s.blocks === 1 && s.type === 'station' && s.centre === 'lot' && s.ring === 'road', JSON.stringify(s));
  await page.evaluate(() => MT.fastForward(6));
  s = await page.evaluate(() => ({ waiting: MT.residents.filter(r => !r.home).length, seated: MT.residents.filter(r => r.spot).length, station: document.querySelector('#s-wait').textContent }));
  check('newcomers arrive by train and wait at the station', s.waiting >= 1 && s.seated >= 1, JSON.stringify(s));
  await page.click('#intro-go');
  const startTool = await page.evaluate(() => document.querySelector('.tool.on')?.dataset.tool);
  check('the welcome button leaves the player in Explore', startTool === 'explore', startTool);
  await page.click('.tool[data-tool="res"]');   // then the player picks Homes
  const pts = await page.evaluate(() => [[17, 18], [17, 19], [17, 20], [17, 21]].map(([i, j]) => MT.project(i, j)));
  await page.mouse.move(pts[0].x, pts[0].y); await page.mouse.down();
  for (const p of pts) { await page.mouse.move(p.x, p.y, { steps: 5 }); await sleep(40); }
  await page.mouse.up(); await sleep(200);
  s = await page.evaluate(() => { const b = MT.blocks[1]; const net = MT.townNet(); return { blocks: MT.blocks.length, n: b?.cells.length, roads: MT.roadCount(), front: b ? b.street.map(c => c.type) : [], inside: MT.cell(17, 19).type, joined: b ? b.street.length > 0 && b.street.every(c => net.has(c)) : false }; });
  check('drag across 4 cells makes one block of 3', s.blocks === 2 && s.n === 3, JSON.stringify(s));
  check('the block stands beside the station ring and faces it', s.front.length >= 3 && s.front.every(t => t === 'road') && s.inside === 'lot' && s.joined, JSON.stringify(s));

  await page.evaluate(() => MT.drawRoad(MT.cell(17, 22), MT.cell(17, 26)));   // a side street off the ring
  await page.keyboard.press('Digit3'); const sp = await page.evaluate(() => MT.project(16, 23)); await page.mouse.click(sp.x, sp.y); await sleep(200);
  s = await page.evaluate(() => { const b = MT.blocks[2]; const net = MT.townNet(); return { blocks: MT.blocks.length, types: MT.blocks.map(b => b.type), street: b ? b.street.map(c => [c.i, c.j]) : [], joined: b ? b.street.every(c => net.has(c)) : false, facing: b ? b.units[0].facing : null }; });
  check('single click places a shop beside a drawn street, facing it', s.blocks === 3 && s.types[2] === 'shop' && s.street.length === 1 && s.joined && s.facing === Math.PI / 2, JSON.stringify(s));

  await page.keyboard.press('Digit4'); const rp = await page.evaluate(() => MT.project(20, 22)); await page.mouse.click(rp.x, rp.y); await sleep(200);
  s = await page.evaluate(() => MT.blocks.length); check("cannot build on the station's ring road", s === 3);
  await page.evaluate(() => { MT.cam.view = MT.cam.tView = 42; }); await sleep(300);
  const hc = await page.evaluate(() => { const c = MT.cells.find(c => c.type === 'hill'); return c ? MT.project(c.i, c.j) : null; });
  if (hc) { await page.mouse.click(hc.x, hc.y); await sleep(200); }
  s = await page.evaluate(() => ({ blocks: MT.blocks.length, hills: MT.cells.filter(c => c.type === 'hill').length }));
  check('the steep parts of the hill cannot be built on', s.blocks === 3 && s.hills >= 12, JSON.stringify(s));
  s = await page.evaluate(() => {
    MT.openHill();
    const plot = MT.cells.find(c => c.type === 'empty' && c.h > 0 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => { const n = MT.cell(c.i + di, c.j + dj); return n && n.type === 'road' && !n.ramp && n.h === c.h; }));   // beside the island's terrace street
    if (!plot) return null;
    const b = MT.placeBlock('res', [plot]); const u = b.units[0];
    return { h: plot.h, meshY: u.mesh.position.y, ground: MT.terrainY(plot.i - 20 + 0.5, plot.j - 20 + 0.5), ramps: MT.cells.filter(c => c.ramp).length, ring: [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => { const n = MT.cell(plot.i + di, plot.j + dj); return n && n.type === 'road'; }) };
  });
  check('a home can be built on a hill terrace at its height', !!s && s.meshY === s.h && s.ground === s.h && s.ramps >= 1 && s.ring, JSON.stringify(s));
  // the hill opening is a milestone: the card shows, the road crew stands at the top, the lanterns light one by one, and "Go and look" glides there
  const ms = { card: await page.evaluate(() => MT.milestoneShown()), crew: await page.evaluate(() => MT.hillCrew.length), lit: 0, glided: false };
  for (let k = 0; k < 60 && ms.lit < 6; k++) { await sleep(250); ms.lit = await page.evaluate(() => MT.lanterns.filter(L => L.head.material.emissiveIntensity > 1).length); }
  await page.evaluate(() => document.querySelector('#milestone .ms-look').click());
  for (let k = 0; k < 40 && !ms.glided; k++) { await sleep(150); ms.glided = await page.evaluate(() => MT.gliding() && MT.cam.tView < 18); }
  ms.gone = await page.evaluate(() => { MT.cancelGlide(); MT.cam.target.set(0, 0, 0); return !MT.milestoneShown(); });
  const lm = await page.evaluate(() => {   // landmarks: a lighthouse, the arched bridge and the park pavilion, each keeping its cells
    const kinds = MT.landmarks.map(l => l.kind), res = MT.cells.filter(c => c.landmark);
    const bridge = res.find(c => c.landmark === 'bridge'), side = bridge && MT.cells.find(c => c.landmark === 'bridge-end');
    return { kinds, reserved: res.length, zonable: res.some(c => MT.placeable(c, [c])), bridgeRoad: bridge ? !!MT.drawRoad(side, bridge) : null, bridgeType: bridge && bridge.type };
  });
  const qy = await page.evaluate(() => { const P = MT.pierFrame(); const lot = MT.cells.find(c => c.landmark === 'pier-park'); return { quay: !!P, spots: P ? P.spots.length : 0, pier: MT.landmarks.some(l => l.kind === 'pier' && l.fish), lot: !!lot, lotFree: lot ? MT.placeable(lot, [lot]) : null }; });
  check('the stone quay: fishing places along its edges, a car park cell kept for it', qy.quay && qy.spots >= 6 && qy.pier && qy.lot && qy.lotFree === false, JSON.stringify(qy));
  check('landmarks: lighthouse, arched bridge and park pavilion stand on cells nobody can build over', ['lighthouse', 'bridge', 'pavilion'].every(k => lm.kinds.includes(k)) && lm.reserved >= 5 && !lm.zonable && lm.bridgeRoad === false && lm.bridgeType === 'canal', JSON.stringify(lm));
  check('the hill opening is a milestone: card, road crew at the top, lanterns light one by one, a glide to look', ms.card && ms.crew === 3 && ms.lit === 6 && ms.glided && ms.gone, JSON.stringify(ms));
  await page.evaluate(() => { const b = MT.blocks[MT.blocks.length - 1]; if (b.cells[0].h > 0) MT.removeBlock(b); });
  await page.evaluate(() => { MT.cam.view = MT.cam.tView = 18; }); await sleep(300);
  const wp = await page.evaluate(() => MT.project(16, 25)); await page.mouse.click(wp.x, wp.y); await sleep(200);
  s = await page.evaluate(() => { const b = MT.blocks[3]; return { blocks: MT.blocks.length, cell: MT.cell(16, 25).type, street: b ? b.street.length : 0 }; });
  check('a building can be zoned further along the same street', s.blocks === 4 && s.cell === 'lot' && s.street >= 1, JSON.stringify(s));
  const np = await page.evaluate(() => MT.project(14, 25)); await page.mouse.click(np.x, np.y); await sleep(200);
  s = await page.evaluate(() => MT.blocks.length); check('nothing is zoned away from a street', s === 4);
  // the Road tool: drag draws a permanent street, crossing streets get a light, Remove takes a drawn cell away
  await page.keyboard.press('Digit5');
  const ra = await page.evaluate(() => MT.project(27, 17)), rb = await page.evaluate(() => MT.project(27, 23));
  await page.mouse.move(ra.x, ra.y); await page.mouse.down(); await page.mouse.move(rb.x, rb.y, { steps: 6 }); await sleep(60); await page.mouse.up(); await sleep(200);
  s = await page.evaluate(() => { MT.drawRoad(MT.cell(24, 20), MT.cell(28, 20)); return { drawn: MT.cells.filter(c => c.drawn).length, types: [17, 18, 19, 20, 21, 22, 23].map(j => MT.cell(27, j).type), signal: MT.signalCells.has(MT.cell(27, 20)) }; });
  check('the Road tool draws a street by dragging; two through-streets crossing get a traffic light', s.drawn === 16 && s.types.every(t => t === 'road') && s.signal, JSON.stringify(s));
  await page.keyboard.press('Digit6'); const rc = await page.evaluate(() => MT.project(27, 17)); await page.mouse.click(rc.x, rc.y); await sleep(200);
  s = await page.evaluate(() => ({ drawn: MT.cells.filter(c => c.drawn).length, cell: MT.cell(27, 17).type }));
  check('Remove takes a drawn street cell away', s.drawn === 15 && s.cell === 'empty', JSON.stringify(s));
  s = await page.evaluate(() => ({ refused: !MT.eraseRoad(MT.cell(17, 23)), still: MT.cell(17, 23).type }));
  check('a street a building opens onto cannot be removed', s.refused && s.still === 'road', JSON.stringify(s));

  await page.evaluate(() => MT.fastForward(40));
  s = await page.evaluate(() => ({ stages: MT.blocks.filter(b => b.type !== 'station').map(b => b.stage), done: MT.DONE, residents: MT.residents.length, housed: MT.residents.filter(r => r.home).length, beds: MT.blocks.filter(b => b.type === 'res').flatMap(b => b.units).reduce((n, u) => n + MT.unitCap(u), 0), shopJob: MT.residents.some(r => r.job && r.job.block.type === 'shop'), working: MT.residents.filter(r => r.job || r.commuter).length }));
  check('construction completes and newcomers fill every bed', s.stages.every(x => x === s.done) && s.beds >= 6 && s.housed === s.beds, JSON.stringify(s));
  check('residents take local jobs or commute by train', s.working >= 4, JSON.stringify({ shopJob: s.shopJob, working: s.working }));
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

  const shopStreet = await page.evaluate(() => MT.blocks[2].street.map(c => [c.i, c.j]));
  await page.keyboard.press('Digit6'); await page.mouse.click(sp.x, sp.y); await sleep(200);
  s = await page.evaluate(sc => { const net = MT.townNet(); return { blocks: MT.blocks.length, cell: MT.cell(16, 23).type, street: sc.map(([i, j]) => MT.cell(i, j).type), kept: MT.blocks[1].street.every(c => c.type === 'road' && net.has(c)), residents: MT.residents.length }; }, shopStreet);
  check('remove tool clears a block; the street it stood on stays', s.blocks === 3 && s.cell === 'empty' && s.street.every(t => t === 'road') && s.kept, JSON.stringify(s));
  await page.evaluate(() => MT.fastForward(30));

  // ── save and load: the town survives a reload ──
  const before = await page.evaluate(() => { MT.save(); return { blocks: MT.blocks.length, residents: MT.residents.length, housed: MT.residents.filter(r => r.home).length, hh: MT.households.filter(h => h.members.length).length, T: Math.floor(MT.T) }; });
  await page.goto(`http://localhost:${PORT}/?look=classic`, { waitUntil: 'networkidle0', timeout: 60000 }); await sleep(800);
  s = await page.evaluate(() => ({ blocks: MT.blocks.length, residents: MT.residents.length, housed: MT.residents.filter(r => r.home).length, hh: MT.households.filter(h => h.members.length).length, T: Math.floor(MT.T) }));
  check('save and load restores the town', s.blocks === before.blocks && s.residents === before.residents && s.housed === before.housed && s.hh === before.hh && s.T === before.T, JSON.stringify({ before, after: s }));
  await page.evaluate(() => MT.clearSave());

  // ── demo town screenshots ──
  await page.goto(`http://localhost:${PORT}/?demo&seed=7&look=classic`, { waitUntil: 'networkidle0', timeout: 60000 }); await sleep(2000);
  // the screenshots show the standard (rich) look: post chain on, it must keep rendering
  const rich0 = await page.evaluate(() => { MT.setLook('rich'); return MT.T; }); await sleep(2500);
  await page.screenshot({ path: 'scripts/out/day.png' });
  const hour0 = await page.evaluate(() => MT.T); await page.evaluate(() => MT.setHour(21.5)); await sleep(1500);
  await page.screenshot({ path: 'scripts/out/night.png' });
  const rich = await page.evaluate(() => ({ on: document.body.classList.contains('rich'), ticking: MT.T > 0 }));
  check('the standard rich look renders and the town keeps running under it', rich.on && rich.ticking && hour0 > rich0, JSON.stringify({ ...rich, advanced: +(hour0 - rich0).toFixed(3) }));
  await page.evaluate(() => MT.setLook('classic')); await sleep(300);
  s = await page.evaluate(() => ({ blocks: MT.blocks.length, residents: MT.residents.length, jobs: MT.residents.filter(r => r.job).length }));
  check('demo town populated', s.blocks === 8 && s.residents >= 10 && s.jobs >= 8, JSON.stringify(s));
  s = await page.evaluate(() => { MT.drawRoad(MT.cell(30, 17), MT.cell(30, 31)); MT.drawRoad(MT.cell(26, 22), MT.cell(34, 22)); MT.setSpeed(0); let away = 0; for (let k = 0; k < 48; k++) { MT.fastForward(0.5); away = Math.max(away, MT.residents.filter(r => r.state === 'away' && r.home).length); } return { commuters: MT.residents.filter(r => r.commuter).length, away, parked: MT.carMeshes.filter(c => c.visible && c.userData.parked).length, bikes: MT.residents.filter(r => r.hasBike).length, signals: MT.signalCells.size }; });
  const cn = await page.evaluate(() => { const canal = MT.cells.filter(c => c.canal); let built = null; for (const c of canal) { if (c.bridge) continue; for (const [di, dj] of [[1, 0], [0, 1]]) { const a = MT.cell(c.i - 2 * di, c.j - 2 * dj), b = MT.cell(c.i + 2 * di, c.j + 2 * dj), a1 = MT.cell(c.i - di, c.j - dj), b1 = MT.cell(c.i + di, c.j + dj); const ok = x => x && x.type === 'empty' && !x.h; if (ok(a) && ok(b) && ok(a1) && ok(b1)) { const laid = MT.drawRoad(a, b); built = { laid: laid ? laid.length : 0, bridge: c.bridge, afterRemove: null }; if (laid) for (const x of laid) if (x !== c) MT.eraseRoad(x); MT.eraseRoad(c); built.afterRemove = c.bridge; break; } } if (built) break; } return { canal: canal.length, coast: MT.cells.filter(c => c.coast).length, built }; });
  check('a canal and a coast road exist; a street drawn across the canal becomes a bridge and goes when erased', cn.canal >= 8 && cn.coast >= 40 && !!cn.built && cn.built.laid === 5 && cn.built.bridge === true && cn.built.afterRemove === false, JSON.stringify(cn));
  check('commuters ride the train, vehicles park beside buildings, crossroads have lights', s.commuters >= 1 && s.away >= 1 && s.parked >= 1 && s.signals >= 1, JSON.stringify(s));
  s = await page.evaluate(async () => { const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const us = MT.blocks.flatMap(b => b.units); MT.setHour(10); await frame(); const dayOut = us.filter(u => u.laundry && u.laundry.visible).length; MT.setHour(21); await frame(); const nightOut = us.filter(u => u.laundry && u.laundry.visible).length; return { laundry: us.filter(u => u.laundry).length, dayOut, nightOut, roofs: [...new Set(MT.blocks.map(b => b.roofStyle).filter(Boolean))], parks: MT.parkCells.size, matsu: MT.cells.filter(c => c.tree && c.tree.kind === 'matsu').length, bamboo: MT.cells.filter(c => c.tree && c.tree.kind === 'bamboo').length }; });
  const eco = await page.evaluate(() => {   // customers are counted per day; a quiet shop with neighbours changes trade at the day's turn
    const shops = MT.blocks.filter(b => b.type === 'shop');
    const counted = shops.some(b => (b.lastVisits || 0) + (b.visitsToday || 0) > 0);
    MT.drawRoad(MT.cell(24, 23), MT.cell(24, 27)); const extra = MT.placeBlock('shop', [MT.cell(25, 25)]); extra.stage = MT.DONE; for (const u of extra.units) MT.rebuildUnitMesh(u);
    const q = shops[shops.length - 1]; const was = q.kind; q.quietDays = 2; q.visitsToday = 0; q.created = -100;
    if (!q.units[0].staff.length) { const r = MT.residents.find(r => r.home); if (r) { r.job = q.units[0]; q.units[0].staff.push(r); } }
    MT.setHour(23.97); q.visitsToday = 0; MT.fastForward(0.1); const changed = q.kind !== was && q.changing === true; MT.fastForward(3.5);   // counted just before the day's turn: no late customer can spoil it
    return { counted, changed, reopened: !q.changing && q.renoT === 0, kind: q.kind, was };
  });
  check('economy: customers are counted daily and a quiet shop changes trade, then reopens', eco.counted && eco.changed && eco.reopened, JSON.stringify(eco));
  const tiers = await page.evaluate(() => { const out = {}; for (const b of MT.blocks) { if (b.type === 'station' || b.summoned) continue; const n = Math.min(3, b.cells.length), k = b.type === 'res' ? b.units[0].variant : b.kind; (out[b.type + n] = out[b.type + n] || new Set()).add(k); } const ok = Object.entries(out).every(([key, set]) => { const type = key.slice(0, -1), n = +key.slice(-1); return [...set].every(k => MT.TIERS[type][n].includes(k)); }); return { ok, seen: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]])), label: MT.tierLabel('res', 3) }; });
  check('size tiers: every block\'s kind or variant comes from its cell-count tier', tiers.ok && tiers.label.startsWith('3 cells'), JSON.stringify(tiers));
  const cp = await page.evaluate(() => {   // Car park tool: a cell beside a street becomes a car park and a nearby home's car takes a bay
    MT.drawRoad(MT.cell(24, 23), MT.cell(24, 29)); const spots = []; for (const i of [23, 25]) for (let j = 23; j <= 29; j++) { const c = MT.cell(i, j); if (MT.placeable(c, [c])) spots.push(c); }
    const home = MT.placeBlock('res', [spots[0]]); home.stage = MT.DONE; for (const u of home.units) MT.rebuildUnitMesh(u);
    const pc = spots.find(c => !c.block && MT.placeable(c, [c])); const park = pc && MT.placeCarPark([pc]); const r = MT.residents.find(r => r.car); let bay = null;
    if (r && pc) { r.carAt = home.units[0]; MT.parkVehicle(r.car, home.units[0], 'car'); bay = r.car.userData.bayCell === pc ? r.car.userData.bay : null; }
    return { spots: spots.length, placed: !!park, flag: pc && pc.park, count: MT.carParks.length, bay, label: MT.tierLabel('park', 2), station: !!MT.scene.getObjectByName('Komachi_Subway_Station') };
  });
  check('car park tool: a cell beside a street takes four bays and a nearby home parks there; kit station pavilion present', cp.placed && cp.flag === 'public' && cp.bay !== null && cp.label.includes('8 bays') && cp.station, JSON.stringify(cp));
  const cv = await page.evaluate(() => {   // Civic zone: one-cell utilities from the civic kit, each a different kind first, two workers each, a notice board on the corner
    const road = MT.drawRoad(MT.cell(20, 27), MT.cell(20, 31)); const spots = []; for (const i of [19, 21]) for (let j = 27; j <= 31; j++) { const c = MT.cell(i, j); if (MT.placeable(c, [c])) spots.push(c); }
    const made = []; for (const c of spots.slice(0, 3)) { if (!MT.placeable(c, [c])) continue; const b = MT.placeBlock('civic', [c]); b.stage = MT.DONE; for (const u of b.units) MT.rebuildUnitMesh(u); made.push(b); }
    const kinds = made.map(b => b.kind), names = { substation: 'Komachi_substation', waterworks: 'Komachi_water_tower', recycling: 'Komachi_recycling_row', clinic: 'Komachi_clinic', firestation: 'Komachi_fire_station', community: 'Komachi_community_centre' };
    const kits = made.map(b => !!b.units[0].mesh.getObjectByName(names[b.kind])), boards = made.map(b => !!b.units[0].mesh.getObjectByName('Komachi_notice_board'));
    return { road: !!road, spots: spots.length, kinds, distinct: new Set(kinds).size === kinds.length, inPool: kinds.every(k => MT.TIERS.civic[1].includes(k)), kits, boards, cap: made.length ? MT.unitCap(made[0].units[0]) : 0, label: MT.tierLabel('civic', 2) };
  });
  const fx = await page.evaluate(() => {   // civic effects: a water works greens the homes within reach; on a collection day bags stand at the kerb and the truck sets out
    const home = MT.blocks.find(b => b.type === 'res' && b.stage === MT.DONE); const hc = home.cells[0];
    const spots = MT.cells.filter(c => c.type === 'empty' && !c.h && MT.placeable(c, [c]) && Math.abs(c.i - hc.i) + Math.abs(c.j - hc.j) <= 5);
    const mk = kind => { const c = spots.find(c => !c.block && MT.placeable(c, [c])); if (!c) return null; const b = MT.placeBlock('civic', [c]); b.kind = kind; b.stage = MT.DONE; for (const u of b.units) MT.rebuildUnitMesh(u); return b; };
    const ww = mk('waterworks'), rc = mk('recycling'); MT.refreshCivicFlags();
    MT.setHour(5.9); let guard = 0; while (MT.dayOf() % 3 !== 0 && guard++ < 4) MT.fastForward(24); for (const r of MT.residents) if (r.home) r.next = 0;
    let bags = 0; for (let k = 0; k < 120 && !bags; k++) { MT.fastForward(0.02); bags = MT.blocks.filter(b => b.bags).length; }   // someone carries them out, or they appear by 7:15
    MT.setHour(7.45); let truck = false; for (let k = 0; k < 40 && !truck; k++) { MT.fastForward(0.01); truck = MT.wanderers.some(w => w.truck); }   // polled: a short round can be over within a fifth of an hour
    return { ww: !!ww, rc: !!rc, watered: home.watered === true, bags, truck, day: MT.dayOf() };
  });
  const ts = await page.evaluate(() => {   // town services: a two-cell town hall from the kit; a household registers there and comes home with a folder
    const spots = MT.cells.filter(c => c.type === 'empty' && !c.h && MT.placeable(c, [c])); let th = null;
    for (const a of spots) { const b2 = spots.find(o => o !== a && !o.block && Math.abs(o.i - a.i) + Math.abs(o.j - a.j) === 1 && MT.placeable(o, [a])); if (!a.block && b2 && MT.placeable(a, [a, b2])) { th = MT.placeBlock('civic', [a, b2]); break; } }
    if (!th) return { th: false };
    th.kind = 'townhall'; th.stage = MT.DONE; for (const u of th.units) MT.rebuildUnitMesh(u);
    const kit = !!th.units[0].mesh.getObjectByName('Komachi_town_hall');
    const hhs = MT.households.filter(h => h.home && h.members.length); if (!hhs.length) return { th: true, kit, hh: false };   // every settled household starts unregistered: commuters are away all day, so any one may register
    for (const h of hhs) { h.registered = false; for (const m of h.members) m.next = 0; }
    const done = () => hhs.some(h => h.registered), members = hhs.flatMap(h => h.members);
    MT.setHour(8.5); let went = false, folder = false; for (let k = 0; k < 700 && !(folder || done()); k++) { MT.fastForward(0.02); for (const m of members) { if (m.purpose === 'register' || (m.at && m.at.block === th)) went = true; const ch = m.mesh && m.mesh.userData.char; if (ch && ch.accessory && ch.accessory.userData.propKind === 'folder') folder = true; } }
    return { th: true, kit, hh: true, went, registered: done(), folder, label: MT.tierLabel('civic', 2) };
  });
  const se = await page.evaluate(() => {   // seasons: the calendar turns every six days; autumn brings falling leaves and a chronicle line
    const day0 = MT.dayOf(), s0 = MT.seasonOf(); MT.setWeather('clear', 40);
    let turned = false; for (let k = 0; k < 8 && !turned; k++) { MT.fastForward(24); turned = MT.seasonOf() !== s0; }
    while (MT.seasonOf() !== 'autumn') MT.fastForward(24);
    MT.setHour(12); MT.setSpeed(1); return { day0, s0, s1: MT.seasonOf(), turned, chron: MT.chronicle.some(e => /came to Komachi/.test(e.text)) };
  });
  let leaves = 0; for (let k = 0; k < 30 && leaves < 3; k++) { await sleep(200); leaves = Math.max(leaves, await page.evaluate(() => MT.scene.children.filter(o => o.visible && o.renderOrder === 6 && o.geometry && o.geometry.type === 'PlaneGeometry' && o.geometry.parameters.width < 0.1).length)); }   // poll: leaves drift in over a few frames
  await page.evaluate(() => MT.setSpeed(0));
  check('seasons: the calendar turns and autumn leaves fall', se.turned && se.s1 === 'autumn' && se.chron && leaves >= 3, JSON.stringify({ ...se, leaves }));
  let tk = { talks: 0, kinds: [] }, bub = 0;   // up to three tries: find a talk whose pair is visible and close, pause, and look for its bubble
  await page.evaluate(() => { while (MT.seasonOf() !== 'summer') MT.fastForward(24); MT.setHour(9.5); MT.setWeather('clear', 12); });
  for (let round = 0; round < 3 && !bub; round++) {
    tk = await page.evaluate(() => { const good = t => t.a.mesh.visible && t.b.mesh.visible && t.a.mesh.position.distanceTo(t.b.mesh.position) < 1.1; let ok = null; for (let k = 0; k < 500 && !ok; k++) { MT.fastForward(0.02); ok = MT.talks.find(good); } if (ok) { ok.until = MT.T + 2; MT.cam.tView = MT.cam.view = 6; MT.cam.target.copy(ok.a.mesh.position); } MT.setSpeed(0); return { talks: MT.talks.length, kinds: MT.talks.map(t => t.topic), found: !!ok }; });
    for (let k = 0; k < 30 && !bub; k++) { await sleep(150); bub = await page.evaluate(() => document.querySelectorAll('#bubbles .bubble').length); }
  }
  check('speech bubbles: a chat pairs two residents and a bubble shows over the speaker', tk.talks >= 1 && bub >= 1, JSON.stringify({ ...tk, bub }));
  const pd = await page.evaluate(() => { MT.setWeather('rain', 4); for (let k = 0; k < 30; k++) MT.fastForward(0.05); const wet = MT.weather.wet; MT.setWeather('clear', 12); for (let k = 0; k < 30; k++) MT.fastForward(0.05); return { wet: +wet.toFixed(2), after: +MT.weather.wet.toFixed(2), spots: MT.puddleSpots.length }; });
  check('puddles: streets pool in the rain and dry after', pd.spots > 0 && pd.wet > 0.5 && pd.after < pd.wet, JSON.stringify(pd));
  const sn = await page.evaluate(() => { while (MT.seasonOf() !== 'winter') MT.fastForward(24); MT.fastForward(6); const pav = MT.STATION.block.units.find(u => u.stationLit); let kit = 0, lit = 0; if (pav) pav.mesh.traverse(o => { if (!o.isMesh || !o.material.userData) return; if (pav.stationLit.includes(o)) lit += o.material.userData.snow ? 1 : 0; else kit += o.material.userData.snow ? 1 : 0; });
    return { season: MT.seasonOf(), snow: +MT.weather.snow.toFixed(2), winter: MT.weather.winter, kit, lit }; });
  check('winter: snow settles over the town, the kit station pavilion included', sn.season === 'winter' && sn.winter && sn.snow > 0.5 && sn.kit > 0, JSON.stringify(sn));
  const wx = await page.evaluate(() => {   // weather: a rain spell dims the sun, greys the sky, puts clouds out, wets the streets and opens umbrellas
    MT.setWeather('clear', 9); for (let k = 0; k < 20; k++) MT.fastForward(0.05); MT.setHour(12); MT.fastForward(0.01);
    const before = { clouds: MT.scene.children.filter(o => o.visible && o.castShadow && o.position.y > 5).length };
    MT.setWeather('rain', 9); for (let k = 0; k < 24; k++) MT.fastForward(0.05); MT.setHour(12); MT.fastForward(0.01);
    const clouds = MT.scene.children.filter(o => o.visible && o.castShadow && o.position.y > 5).length;
    const rainMesh = MT.scene.children.find(o => o.isLineSegments && o.renderOrder === 7);
    let umbrellas = 0; for (let k = 0; k < 40 && !umbrellas; k++) { MT.fastForward(0.05); umbrellas = MT.residents.filter(r => r.state === 'walking' && r.mesh.userData.char && r.mesh.userData.char.accessory && r.mesh.userData.char.accessory.userData.propKind === 'umbrella').length; }
    return { kind: MT.weather.kind, cover: +MT.weather.cover.toFixed(2), rain: +MT.weather.rain.toFixed(2), cloudsBefore: before.clouds, clouds, rainVisible: !!(rainMesh && rainMesh.visible), umbrellas, day: document.getElementById('day').textContent };
  });
  check('weather: a rain spell brings clouds, falling rain and umbrellas', wx.kind === 'rain' && wx.rain > 0.6 && wx.clouds > wx.cloudsBefore && wx.rainVisible && wx.umbrellas >= 1, JSON.stringify(wx));   // the clock card's note repaints on the next frame, so it is not asserted
  const ch = await page.evaluate(() => ({ n: MT.chronicle.length, sample: MT.chronicle.slice(0, 3).map(e => e.text), hasRegister: MT.chronicle.some(e => /registered/.test(e.text)) }));
  check('town chronicle: milestones are recorded (a registration among them)', ch.n >= 1 && ch.hasRegister, JSON.stringify(ch));
  check('town services: the town hall comes from the kit and a new household registers there, coming home with a folder', ts.th && ts.kit && ts.hh && ts.went && ts.registered && ts.label.toLowerCase().includes('town hall'), JSON.stringify(ts));
  check('civic effects: a water works greens nearby gardens; collection day puts bags at the kerb and the truck sets out', fx.ww && fx.rc && fx.watered && fx.bags >= 1 && fx.truck, JSON.stringify(fx));
  check('civic zone: utilities come from the civic kit, distinct kinds first, two workers, a notice board each', cv.kinds.length >= 2 && cv.distinct && cv.inPool && cv.kits.every(Boolean) && cv.boards.every(Boolean) && cv.cap === 2 && cv.label.includes('public bath'), JSON.stringify(cv));
  const vv = await page.evaluate(() => {   // the same unit, rebuilt with different seeds, takes different looks
    const ru = MT.blocks.find(b => b.type === 'res').units[0], su = MT.blocks.find(b => b.type === 'shop').units[0], wu = MT.blocks.find(b => b.type === 'work' && b.kind === 'office')?.units[0];
    const styles = new Set(), finishes = new Set(), facades = new Set();
    for (let k = 0; k < 8; k++) { ru.variant = 'detached'; ru.seed = (k + 0.5) / 8; MT.rebuildUnitMesh(ru); styles.add(ru.style); su.seed = (k + 0.5) / 8; MT.rebuildUnitMesh(su); finishes.add(su.finish); if (wu) { wu.seed = (k + 0.5) / 8; MT.rebuildUnitMesh(wu); facades.add(wu.facade); } }
    return { styles: [...styles], finishes: [...finishes], facades: [...facades], office: !!wu };
  });
  check('building variety: three detached styles, three shop finishes, three office facades from the seed', vv.styles.length === 3 && vv.finishes.length === 3 && (!vv.office || vv.facades.length === 3), JSON.stringify(vv));
  check('Japanese identity: laundry out by day only, kawara roofs, a pocket park, pines and bamboo', s.laundry >= 1 && s.dayOut >= 1 && s.nightOut === 0 && s.roofs.length && s.roofs.every(r => ['kawara', 'tile', 'metal'].includes(r)) && s.parks >= 1 && s.matsu >= 1 && s.bamboo >= 1, JSON.stringify(s));
  const hm = await page.evaluate(() => {   // the hill plot market: a settled, employed household gets a villa and moves up
    MT.openHill(true); MT.drawRoad(MT.cell(17, 27), MT.cell(17, 29));   // join the coast road to the town so the hill can be reached
    const hh = MT.households.find(h => h.home && (h.home.cell.h || 0) === 0 && h.members.length >= 1 && h.members.every(m => m.state !== 'away'));
    if (!hh) return { hh: false };
    for (const m of hh.members) { m.arrivedT = -100; if (!m.job && !m.commuter) m.commuter = true; }
    MT.setHour(23.9); MT.fastForward(0.3);
    const villa = MT.blocks.find(b => b.variant === 'villa'); if (!villa) return { hh: true, villa: false, plots: MT.hillPlots().length };
    for (let k = 0; k < 80 && villa.stage < MT.DONE; k++) MT.fastForward(0.5);
    for (let k = 0; k < 8; k++) MT.fastForward(0.25);
    const owner = MT.households.find(h => h.home === villa.units[0]);   // whichever settled household the town picked
    return { hh: true, villa: true, onHill: (villa.cells[0].h || 0) > 0, done: villa.stage === MT.DONE, movedUp: !!owner && owner.members.every(m => m.home === villa.units[0] && villa.units[0].residents.includes(m)) };   // a lodger may fill the spare bed
  });
  check('hill plot market: a settled household builds a villa on the terrace and moves up', hm.hh && hm.villa && hm.onHill && hm.done && hm.movedUp, JSON.stringify(hm));
  const fy = await page.evaluate(() => {   // the ferry: slip and yard by the pier; a call comes in, queued cars roll off and drive into town
    const f = MT.ferry; if (!f.ready) return { ready: false };
    MT.setHour(6.5); f.queue.push({ kind: 'wanderer', color: '#e9b7b0', vkind: 'kei' });
    const before = MT.ferry.ashore || 0; const seen = new Set();
    for (let k = 0; k < 80 && (MT.ferry.ashore || 0) <= before; k++) { MT.fastForward(0.05); seen.add(f.state); }   // poll until a car is ashore (the larger hull berths further out), never a fixed count
    return { ready: true, slip: !!f.slip, yard: !!f.yard, states: [...seen], calls: f.calls > 0, rolledOff: (MT.ferry.ashore || 0) > before, ashore: MT.ferry.ashore || 0 };
  });
  const tr = await page.evaluate(() => {   // tourism: a visitor off the train walks out to a landmark and raises a camera; the bus stops get their shelters
    MT.setSpeed(0); MT.setWeather('clear', 30); MT.tourism.forceWeekend = true; MT.setHour(9.5); MT.fastForward(0.1);
    const t = MT.spawnTourist(); if (!t) return { spawned: false, lm: MT.landmarks.length };
    let photo = false, cam = false; for (let k = 0; k < 320 && !photo; k++) { MT.fastForward(0.04); if (t.state === 'visit') { photo = true; const ch = t.mesh.userData.char; cam = !ch || !!(ch.item && ch.item.userData.handItem); } }
    MT.tourism.forceWeekend = false;
    return { spawned: true, photo, cam, seen: t.seen, stops: !!MT.bus.stops, shelters: MT.bus.shelters.length };
  });
  check('tourists: a visitor walks out to a landmark and takes photos; the tourist bus stops have shelters', tr.spawned && tr.photo && tr.cam && (!tr.stops || tr.shelters === 2), JSON.stringify(tr));
  check('car ferry: it calls at the slipway and queued cars roll off into town', fy.ready && fy.slip && fy.yard && fy.states.includes('berthed') && fy.calls && fy.rolledOff, JSON.stringify(fy));
  const nanStack = await page.evaluate(() => { const bad = []; MT.scene.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; const arr = o.geometry.attributes.position.array; for (let i = 0; i < arr.length; i++) if (!isFinite(arr[i])) { const chain = []; for (let p = o; p; p = p.parent) chain.push(p.name || p.type + (p.userData && p.userData.unit ? ':' + p.userData.unit.block.name + '/' + (p.userData.unit.block.kind || p.userData.unit.variant) : p.userData && p.userData.res ? ':person' : p.userData && p.userData.lights !== undefined ? ':vehicle' : '')); bad.push(chain.join('<') + ' n=' + arr.length / 3); break; } }); return (window.__nanStack || '') + (bad.length ? ' NaN meshes: ' + bad.slice(0, 6).join(' ; ') : ''); });
  const ev = await page.evaluate(() => {   // the town square: a three-cell civic drag makes one; Sunday brings the market, the first Saturday of summer the festival
    MT.setSpeed(0); const station = MT.STATION.block.cells.flatMap(s => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => MT.cell(s.i + a, s.j + b))).filter(n => n && n.type === 'road');
    let sel = null;
    for (const c of MT.cells) for (const [di, dj] of [[1, 0], [0, 1]]) {
      const cs = [0, 1, 2].map(k => MT.cell(c.i + di * k, c.j + dj * k)); if (!cs.every(x => x && MT.placeable(x, cs))) continue;
      const side = [[dj, di], [-dj, -di]].find(([a, b]) => cs.every(x => { const n = MT.cell(x.i + a, x.j + b); return n && n.type === 'road'; })); if (!side) continue;
      const p = MT.routeCells(station, [MT.cell(cs[1].i + side[0], cs[1].j + side[1])]); if (p && (!sel || p.length < sel.len)) { sel = cs; sel.len = p.length; }
    }
    if (!sel) return { placed: false };
    const b = MT.placeBlock('civic', sel); b.stage = MT.DONE; for (const u of b.units) MT.rebuildUnitMesh(u);
    let d = Math.floor(MT.T / 24) + 1; while (d % 7 !== 0) d++; MT.setDay(d, 7.2); MT.fastForward(0.3);
    const market = MT.eventOn() && MT.eventOn().kind;
    d = Math.floor(MT.T / 24) + 1; for (let k = 0; k < 40 && !MT.festivalDay(d); k++) d++; MT.setDay(d, 16.1); MT.fastForward(0.2);
    const fest = MT.eventOn(), props = fest ? fest.group.children.length : 0;
    let went = 0; for (let k = 0; k < 120 && !went; k++) { MT.fastForward(0.04); went = MT.eventOn() ? MT.eventOn().spots.reduce((s, x) => s + x.taken, 0) : 0; }
    return { placed: true, kind: b.kind, market, festival: fest && fest.kind, props, went, chron: MT.chronicle.some(e => /first summer festival/.test(e.text)) };
  });
  check('town square: markets on Sundays, the summer festival with stalls and a crowd', ev.placed && ev.kind === 'square' && ev.market === 'market' && ev.festival === 'festival' && ev.props >= 8 && ev.went >= 1 && ev.chron, JSON.stringify(ev));
  const ry = await page.evaluate(() => {   // the ryokan: on the hill, weekend visitors after midday stay the night
    MT.setSpeed(0); MT.openHill(true); if (!MT.hillPlots().length) MT.hillMarket(); let plots = MT.hillPlots().filter(c => !c.block); if (!plots.length) plots = MT.cells.filter(c => MT.placeable(c, [c]));   // a hill plot if there is one; the check is about the guests
    if (!plots.length) return { plot: false };
    const b = MT.placeBlock('shop', [plots[0]], { kind: 'ryokan', roofStyle: 'kawara' }); b.stage = MT.DONE; for (const u of b.units) MT.rebuildUnitMesh(u);
    MT.tourism.forceWeekend = true; MT.setHour(12); const ts = []; for (let k = 0; k < 8 && !ts.some(t => t.staying); k++) { const t = MT.spawnTourist(); if (t) ts.push(t); }
    const guest = ts.find(t => t.staying) || MT.tourists.find(t => t.staying && t.state !== 'atInn') || MT.tourists.find(t => t.staying); let inn = false; for (let k = 0; k < 400 && guest && !inn; k++) { MT.fastForward(0.04); inn = guest.state === 'atInn'; }   // the six rooms may already be booked by earlier visitors: follow one of them
    MT.tourism.forceWeekend = false; return { plot: true, kind: b.kind, guest: !!guest, inn, spawned: ts.length, guests: MT.tourists.filter(t => t.staying).length, h: +(MT.T % 24).toFixed(2), stage: b.stage };
  });
  check('ryokan: a visitor stays the night at the inn on the hill', ry.plot && ry.kind === 'ryokan' && ry.guest && ry.inn, JSON.stringify(ry));
  const fsh = await page.evaluate(() => {   // Phase 7 fishing: the boat goes out at dawn and its catch lays out the quay stall
    MT.setSpeed(0); MT.setWeather('clear', 30); MT.fastForward((29.2 - MT.T % 24) % 24); const b = MT.scene.getObjectByName('quay-boat'); if (!b) return { boat: false };
    const home = b.position.clone(); MT.fastForward(2.5); const away = b.position.distanceTo(home); MT.fastForward(4.5);
    return { boat: true, away: +away.toFixed(2), catch: MT.catchToday(), market: MT.landmarkRoads().some(o => o.l.kind === 'fishmarket'), chron: MT.chronicle.some(e => /first catch/.test(e.text)) };
  });
  check('fishing: the boat sails at dawn and its catch opens the quay fish stall', fsh.boat && fsh.away > 1.5 && fsh.catch && fsh.market && fsh.chron, JSON.stringify(fsh));
  const fm = await page.evaluate(() => {   // Phase 7 farming: a farm zone, a farmhouse on its first cell, farmers out in the fields in season
    MT.setSpeed(0); const station = MT.STATION.block.cells.flatMap(s => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([a, b]) => MT.cell(s.i + a, s.j + b))).filter(n => n && n.type === 'road');
    let sel = null, best = 1e9; for (const c of MT.cells) for (const [di, dj] of [[1, 0], [0, 1]]) { const cs = [c, MT.cell(c.i + di, c.j + dj)]; if (!cs.every(x => x && MT.placeable(x, cs))) continue; const f = MT.frontRoads(cs); const p = f.length && MT.routeCells(station, f); if (p && p.length < best) { best = p.length; sel = cs; } }   // the closest free pair to the station, so the walk there is short
    if (!sel) return { placed: false };
    const b = MT.placeBlock('farm', sel); b.stage = MT.DONE; for (const u of b.units) MT.rebuildUnitMesh(u);
    const home = r => r.home && r.state === 'inside' && r.at === r.home, idle = [...MT.residents.filter(home), ...MT.residents.filter(r => r.home && !home(r) && r.state !== 'away')].slice(0, 3);   // at home first, else anyone in town
    for (const r of idle) { if (r.job) { const i = r.job.staff.indexOf(r); if (i >= 0) r.job.staff.splice(i, 1); } r.homemaker = false; r.commuter = false; r.job = b.units[0]; b.units[0].staff.push(r); r.workStart = 6; r.workEnd = 16; r.lastWorkDay = -1; }
    while (MT.seasonOf() !== 'summer') MT.fastForward(24); MT.setWeather('clear', 20); MT.weather.rain = MT.weather.tRain = 0; MT.setHour(6.2); for (const r of idle) r.next = MT.T;   // no lingering shower: farmers work indoors in the rain
    let out = false; for (let k = 0; k < 400 && !out; k++) { MT.fastForward(0.04); out = MT.residents.some(r => r.job && r.job.block === b && r.outside > MT.T); }
    return { placed: true, kind: b.kind, label: MT.tierLabel('farm', 2), farmers: b.units[0].staff.length, out, dbg: out ? null : { h: +(MT.T % 24).toFixed(2), rain: +MT.weather.rain.toFixed(2), season: MT.seasonOf(), f: idle.map(r => [r.state, r.activity, r.at === r.job ? 'J' : r.at === r.home ? 'H' : '-', r.lastWorkDay, +(r.next - MT.T).toFixed(2), r.job === b.units[0]]) } };
  });
  check('farming: a farm zone with farmers out in the fields in summer', fm.placed && fm.kind === 'field' && fm.farmers >= 1 && fm.out, JSON.stringify(fm));
  const pkr = await page.evaluate(() => {   // the building picker: a strip of kinds for a zone tool; a picked kind is built as that kind and a shop keeps its trade
    MT.setTool('civic'); const chips = document.querySelectorAll('#picker .chip').length, open = document.getElementById('picker').classList.contains('show');
    const c = MT.cells.find(c => MT.placeable(c, [c])); if (!c) return { chips, open, placed: false };
    const b = MT.placeBlock('civic', [c], { kind: 'clinic', picked: true }); MT.setTool('explore');
    return { chips, open, placed: true, kind: b.kind, picked: b.picked, closed: !document.getElementById('picker').classList.contains('show') };
  });
  check('building picker: a strip of kinds per zone tool, and a picked kind is built as chosen', pkr.open && pkr.chips >= 10 && pkr.placed && pkr.kind === 'clinic' && pkr.picked && pkr.closed, JSON.stringify(pkr));
  const stp = await page.evaluate(() => {   // Streets and Car park share one dock button: its strip switches between them
    MT.setTool('road'); const strip = document.getElementById('picker'), modes = strip.querySelectorAll('.chip[data-mode]').length, dock = !document.querySelector('.tool[data-tool="park"]');
    strip.querySelector('.chip[data-mode="park"]').click();
    const parkOn = strip.querySelector('.chip.on')?.dataset.mode === 'park', streetsLit = document.querySelector('.tool[data-tool="road"]').classList.contains('on');
    MT.setTool('explore'); return { modes, dock, parkOn, streetsLit };
  });
  const busy = await page.evaluate(() => {   // quality: low turns busy details off (half the rain and leaves, fewer birds, far people animate less often)
    const card = document.getElementById('options'), pick = v => card.querySelector('[data-set="preset"] button[data-v="' + v + '"]').click();
    const before = MT.quality.preset; pick('low'); const low = MT.quality.busy, sw = card.querySelector('[data-toggle="busy"]'), swOff = sw && !sw.classList.contains('on');
    pick('high'); const high = MT.quality.busy; pick(before === 'custom' ? 'auto' : before);
    return { low, high, swOff, back: MT.quality.preset };
  });
  check('quality: the low preset turns busy details off, high keeps them', busy.low === false && busy.high === true && busy.swOff, JSON.stringify(busy));
  check('Streets button: a Street | Car park strip, and car parks sit under Streets', stp.modes === 2 && stp.dock && stp.parkOn && stp.streetsLit, JSON.stringify(stp));
  const hrs = await page.evaluate(() => {   // every workplace keeps its own hours: the bakery before dawn, the ramen shop late, the factory in two shifts
    const b = k => ({ type: 'shop', kind: k });
    return { bakery7: MT.isOpen(b('bakery'), 7), bakery16: MT.isOpen(b('bakery'), 16), ramen21: MT.isOpen(b('ramen'), 21), ramen9: MT.isOpen(b('ramen'), 9),
      factory: MT.hoursOf({ type: 'work', kind: 'factory' }).shifts.length, bakeryStart: MT.hoursOf(b('bakery')).shifts[0][0] };
  });
  check('working hours: shops keep their own opening hours, a factory runs two shifts', hrs.bakery7 && !hrs.bakery16 && hrs.ramen21 && !hrs.ramen9 && hrs.factory === 2 && hrs.bakeryStart < 6, JSON.stringify(hrs));
  const trf = await page.evaluate(() => {   // traffic: trips between the same two streets vary their route, and each crossing keeps its own light cycle
    const roads = MT.cells.filter(c => c.type === 'road' && !c.h); let best = null, most = 0;   // some pairs have one sensible way only: try several
    for (let k = 0; k < 120 && most < 2; k++) {
      const a = roads[Math.floor(Math.random() * roads.length)], b = roads[Math.floor(Math.random() * roads.length)], p = MT.routeCells([a], [b]); if (!p || p.length < 9) continue;
      best = [a, b]; const seen = new Set(); for (let q = 0; q < 16; q++) { const v = MT.routeVaried([a], [b], true); if (v) seen.add(v.map(c => c.i + ',' + c.j).join(';')); } most = Math.max(most, seen.size);
    }
    const seen = { size: most };
    const sig = [...MT.signalCells]; let differ = sig.length < 2; const states = new Set();
    for (let k = 0; k < 40; k++) { const h = 12 + k * 0.03; MT.setHour(h); if (sig.length >= 2 && MT.signalState(sig[0], 'ns') !== MT.signalState(sig[1], 'ns')) differ = true; if (sig.length) states.add(MT.signalState(sig[0], 'ns')); }
    return { pair: !!best, routes: seen.size, signals: sig.length, differ, states: [...states].sort().join(',') };
  });
  check('traffic: routes between two streets vary, crossings keep their own cycles with amber', trf.pair && trf.routes >= 2 && trf.differ && (trf.signals === 0 || trf.states.includes('amber')), JSON.stringify(trf));
  const qu = await page.evaluate(() => {   // many plots at once: only three crews work, the rest wait roped off in line; an empty finished home shows a for-rent board
    MT.setSpeed(0); const free = () => MT.cells.filter(c => MT.placeable(c, [c]) && !c.h);
    const made = []; for (let k = 0; k < 7; k++) { const c = free()[0]; if (!c) break; made.push(MT.placeBlock('res', [c])); }
    MT.fastForward(0.01, 0.00167);
    const waiting = made.filter(b => b.waiting && b.queuePos > 0).length, maxPos = Math.max(0, ...made.map(b => b.queuePos || 0));
    const c = free()[0]; let home = null; if (c) { home = MT.placeBlock('res', [c]); home.stage = MT.DONE; for (const u of home.units) MT.rebuildUnitMesh(u); }
    window.__qHome = home; return { made: made.length, waiting, maxPos };
  });
  let noticeOn = false; for (let k = 0; k < 20 && !noticeOn; k++) { await sleep(150); noticeOn = await page.evaluate(() => !!(window.__qHome && window.__qHome.units[0].notice && window.__qHome.units[0].notice.visible)); }
  check('build queue: extra plots wait roped off in line; an empty home shows a for-rent board', qu.made >= 5 && qu.waiting >= 2 && qu.maxPos >= 2 && noticeOn, JSON.stringify({ ...qu, noticeOn }));
  await page.evaluate(() => { for (const b of MT.blocks.filter(b => b.waiting || b === window.__qHome)) MT.removeBlock(b); });   // tidy up for the checks after
  let svc = null;   // the service vehicles: the post van's morning round, the postman on his motorbike with a rider aboard, the ambulance parked at a clinic
  for (let k = 0; k < 40 && !(svc && svc.ready); k++) { await sleep(250); svc = await page.evaluate(() => ({ ready: MT.serviceReady() })); }
  svc = await page.evaluate(() => {
    MT.setSpeed(0);
    const c = MT.cells.find(c => MT.placeable(c, [c]) && !c.h); let clinic = null; if (c) { clinic = MT.placeBlock('civic', [c], { kind: 'clinic', picked: true }); clinic.stage = MT.DONE; for (const u of clinic.units) MT.rebuildUnitMesh(u); }
    const next = h => MT.fastForward(Math.floor(MT.T / 24) * 24 + 24 + h - MT.T, 0.04);
    let d = MT.dayOf(); if ((d + 1) % 7 === 6) { next(8); }   // not a Sunday
    next(8.9); let post = null; for (let k = 0; k < 60 && !post; k++) { MT.fastForward(0.02); post = MT.wanderers.find(w => w.round === 'post'); }
    const ambulance = MT.carMeshes.find(v => v.userData.service === 'ambulance' && v.userData.parked);
    MT.setHour(13.45); let mail = null; for (let k = 0; k < 80 && !mail; k++) { MT.fastForward(0.02); mail = MT.wanderers.find(w => w.round === 'mail'); }
    return { post: !!post, postKind: post && post.mesh.userData.service, mail: !!mail, rider: !!(mail && mail.rider && mail.rider.mesh.visible !== undefined), ambulance: !!ambulance, clinic: !!clinic };
  });
  check('service vehicles: the post van goes round, the postman rides out, an ambulance waits at the clinic', svc.post && svc.postKind === 'postal-van' && svc.mail && svc.rider && svc.ambulance, JSON.stringify(svc));
  let pwa = null;   // the installable app: a manifest, and a service worker that has cached the build for offline play (polled)
  for (let k = 0; k < 60; k++) {
    pwa = await page.evaluate(async () => { const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); let n = 0; for (const k of await caches.keys()) n += (await (await caches.open(k)).keys()).length; const m = await (await fetch('./manifest.webmanifest')).json(); return { active: !!(reg && reg.active), cached: n, icons: m.icons.length }; });
    if (pwa.active && pwa.cached > 30) break; await sleep(500);
  }
  check('PWA: manifest with icons, and the service worker has cached the game', pwa.active && pwa.cached > 30 && pwa.icons >= 3, JSON.stringify(pwa));
  check('no page errors', errors.length === 0, errors.join(' | ') + (nanStack ? ' @ ' + nanStack.slice(0, 600) : ''));
} finally {
  await browser.close(); stopServer();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
