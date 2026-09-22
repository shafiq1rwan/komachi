// Headless smoke test: builds nothing itself — run `npm run build` first.
// Serves dist/ with `vite preview`, drives the game through the window.MT dev hooks,
// checks placement rules, construction, residents and removal, and saves screenshots to scripts/out/.
//
// Needs a Chromium-based browser. Set BROWSER_PATH if it is not at one of the default locations.
import { spawn } from 'node:child_process';
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
await new Promise(r => setTimeout(r, 2500));
mkdirSync('scripts/out', { recursive: true });

let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); if (!ok) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1500,950'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1500, height: 950 });
  await page.evaluateOnNewDocument(() => { const oe = console.error.bind(console); console.error = (...a) => { oe(...a); if (String(a[0]).includes('NaN')) { let where = ''; try { const bad = []; window.MT.scene.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; const arr = o.geometry.attributes.position.array; for (let q = 0; q < arr.length; q += 3) if (!isFinite(arr[q])) { const chain = []; for (let p = o; p; p = p.parent) chain.push(p.name || p.type + (p.userData && p.userData.unit ? ':' + p.userData.unit.block.name + '/' + (p.userData.unit.block.kind || p.userData.unit.variant) : p.userData && p.userData.res ? ':person ' + p.userData.res.name : p.userData && p.userData.worker ? ':worker' : p.userData && p.userData.lights !== undefined ? ':vehicle' : '')); bad.push(chain.join('<') + ' n=' + arr.length / 3); break; } }); where = bad.slice(0, 4).join(' ; '); } catch (e) { where = 'scan failed ' + e.message; } window.__nanStack = (window.__nanStack || '') + ' NaN mesh at error time: ' + (where || 'none found') + ' ## '; } }; });
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // ── interaction on an empty island ──
  await page.goto(`http://localhost:${PORT}/?seed=7`, { waitUntil: 'networkidle0', timeout: 60000 }); await sleep(800);   // a fixed island keeps the checks deterministic
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
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0', timeout: 60000 }); await sleep(800);
  s = await page.evaluate(() => ({ blocks: MT.blocks.length, residents: MT.residents.length, housed: MT.residents.filter(r => r.home).length, hh: MT.households.filter(h => h.members.length).length, T: Math.floor(MT.T) }));
  check('save and load restores the town', s.blocks === before.blocks && s.residents === before.residents && s.housed === before.housed && s.hh === before.hh && s.T === before.T, JSON.stringify({ before, after: s }));
  await page.evaluate(() => MT.clearSave());

  // ── demo town screenshots ──
  await page.goto(`http://localhost:${PORT}/?demo&seed=7`, { waitUntil: 'networkidle0', timeout: 60000 }); await sleep(2000);
  await page.screenshot({ path: 'scripts/out/day.png' });
  await page.evaluate(() => MT.setHour(21.5)); await sleep(1000);
  await page.screenshot({ path: 'scripts/out/night.png' });
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
    MT.setHour(23.9); MT.fastForward(0.3); const changed = q.kind !== was && q.changing === true; MT.fastForward(3.5);
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
    const kinds = made.map(b => b.kind), names = { substation: 'Komachi_substation', waterworks: 'Komachi_water_tower', recycling: 'Komachi_recycling_row' };
    const kits = made.map(b => !!b.units[0].mesh.getObjectByName(names[b.kind])), boards = made.map(b => !!b.units[0].mesh.getObjectByName('Komachi_notice_board'));
    return { road: !!road, spots: spots.length, kinds, distinct: new Set(kinds).size === kinds.length, inPool: kinds.every(k => MT.TIERS.civic[1].includes(k)), kits, boards, cap: made.length ? MT.unitCap(made[0].units[0]) : 0, label: MT.tierLabel('civic', 2) };
  });
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
  check('car ferry: it calls at the slipway and queued cars roll off into town', fy.ready && fy.slip && fy.yard && fy.states.includes('berthed') && fy.calls && fy.rolledOff, JSON.stringify(fy));
  const nanStack = await page.evaluate(() => { const bad = []; MT.scene.traverse(o => { if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return; const arr = o.geometry.attributes.position.array; for (let i = 0; i < arr.length; i++) if (!isFinite(arr[i])) { const chain = []; for (let p = o; p; p = p.parent) chain.push(p.name || p.type + (p.userData && p.userData.unit ? ':' + p.userData.unit.block.name + '/' + (p.userData.unit.block.kind || p.userData.unit.variant) : p.userData && p.userData.res ? ':person' : p.userData && p.userData.lights !== undefined ? ':vehicle' : '')); bad.push(chain.join('<') + ' n=' + arr.length / 3); break; } }); return (window.__nanStack || '') + (bad.length ? ' NaN meshes: ' + bad.slice(0, 6).join(' ; ') : ''); });
  check('no page errors', errors.length === 0, errors.join(' | ') + (nanStack ? ' @ ' + nanStack.slice(0, 600) : ''));
} finally {
  await browser.close(); server.kill();
}
console.log(failures ? `\n${failures} check(s) failed` : '\nall checks passed');
process.exit(failures ? 1 : 0);
