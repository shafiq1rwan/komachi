// Komachi — simulation: time, road routing, residents and their schedules, ambient traffic, block lifecycle
import * as THREE from 'three';
import { GIVEN, FAMILY, SKIN, SHIRTS, HAIR, CARS } from './palette.js';
import { rand, pick, clamp, lerp, smooth, hash } from './utils.js';
import { S } from './state.js';
import { N, HALF, cx, cz, townGroup, peopleGroup, disposeGroup } from './scene.js';
import { box, cyl, colorize, mergeMesh } from './geometry.js';
import { cells, cell, DIR4, treeSpec, lotAdjacent8, blocks, units, STAGE_HOURS, unitCap, refreshWorld, onWorldChange, STATION } from './world.js';
import { rebuildUnitMesh } from './buildings.js';
import { toast } from './toast.js';

// ───────────────────────────── time ─────────────────────────────
const HPS = 0.1;                // game hours per real second at 1×  (one day ≈ 4 min)
const hourOf = () => S.T % 24, dayOf = () => Math.floor(S.T / 24) + 1;
function daylight() { const h = hourOf(); return smooth((h - 5.5) / 1.5) * smooth((19.5 - h) / 1.5); }

// ───────────────────────────── routing over roads ─────────────────────────────
const pathCache = new Map();
const bfsParent = new Int32Array(N * N), bfsQueue = new Int32Array(N * N);
function roadNeighbors(c) { const out = []; for (const [di, dj] of DIR4) { const n = cell(c.i + di, c.j + dj); if (n && n.type === 'road') out.push(n); } return out; }
function routeCells(srcs, dsts) {
  if (!srcs.length || !dsts.length) return null;
  bfsParent.fill(-1); const target = new Set(dsts.map(c => c.j * N + c.i));
  let qh = 0, qt = 0;
  for (const s of srcs) { const k = s.j * N + s.i; if (bfsParent[k] === -1) { bfsParent[k] = k; bfsQueue[qt++] = k; } }
  while (qh < qt) {
    const k = bfsQueue[qh++];
    if (target.has(k)) { const path = []; let cur = k; while (true) { path.push(cells[cur]); if (bfsParent[cur] === cur) break; cur = bfsParent[cur]; } return path.reverse(); }
    const i = k % N, j = (k - i) / N;
    for (const [di, dj] of DIR4) { const n = cell(i + di, j + dj); if (!n || n.type !== 'road') continue; const nk = n.j * N + n.i; if (bfsParent[nk] !== -1) continue; bfsParent[nk] = k; bfsQueue[qt++] = nk; }
  }
  return null;
}
function routeUnits(a, b) {
  const key = a.id + '>' + b.id; if (pathCache.has(key)) return pathCache.get(key);
  const p = routeCells(roadNeighbors(a.cell), roadNeighbors(b.cell)); pathCache.set(key, p); return p;
}
const unitPos = u => new THREE.Vector3(cx(u.cell.i), 0, cz(u.cell.j));
function buildPoints(cellPath, start, end, side, y) {
  const pts = [start.clone().setY(y)];
  const n = cellPath.length;
  for (let k = 0; k < n; k++) {
    const c = cellPath[k], p = new THREE.Vector3(cx(c.i), y, cz(c.j));
    const prev = k > 0 ? cellPath[k - 1] : null, next = k < n - 1 ? cellPath[k + 1] : null;
    let dx = 0, dz = 0;
    if (prev) { dx += c.i - prev.i; dz += c.j - prev.j; }
    if (next) { dx += next.i - c.i; dz += next.j - c.j; }
    if (!prev && !next) { dx = end.x - start.x; dz = end.z - start.z; }
    const len = Math.hypot(dx, dz) || 1; dx /= len; dz /= len;
    p.x += -dz * side; p.z += dx * side;      // right-hand offset
    pts.push(p);
  }
  pts.push(end.clone().setY(y));
  return pts;
}

// ───────────────────────────── meshes: people, cars, cats ─────────────────────────────
const carMeshes = [];
function makePerson(r) {
  const grp = new THREE.Group(); const g = [];
  g.push(box(0.15, 0.13, 0.11, r.pants, 0, 0.065, 0));
  g.push(box(0.17, 0.2, 0.12, r.shirt, 0, 0.23, 0));
  g.push(box(0.05, 0.16, 0.05, r.shirt, -0.11, 0.24, 0)); g.push(box(0.05, 0.16, 0.05, r.shirt, 0.11, 0.24, 0));
  const head = new THREE.SphereGeometry(0.085, 8, 6); head.translate(0, 0.42, 0); g.push(colorize(head, r.skin));
  if (r.hat) { g.push(cyl(0.11, 0.11, 0.03, r.hatColor, 0, 0.47, 0, 10)); g.push(cyl(0.07, 0.075, 0.07, r.hatColor, 0, 0.51, 0, 10)); }
  else { const hair = new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2); hair.translate(0, 0.43, 0); g.push(colorize(hair, r.hair)); }
  const m = mergeMesh(g, false); m.castShadow = true; grp.add(m); grp.visible = false; grp.userData.res = r; peopleGroup.add(grp); return grp;
}
function makeCar(color) {
  const grp = new THREE.Group(); const g = [];
  g.push(box(0.5, 0.16, 0.28, color, 0, 0.14, 0));
  g.push(box(0.28, 0.14, 0.24, color, -0.02, 0.29, 0));
  g.push(box(0.29, 0.1, 0.22, '#d8e3e8', -0.02, 0.29, 0));
  for (const [x, z] of [[-0.16, -0.13], [0.16, -0.13], [-0.16, 0.13], [0.16, 0.13]]) { const wgm = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8); wgm.rotateX(Math.PI / 2); wgm.translate(x, 0.07, z); g.push(colorize(wgm, '#4a4340')); }
  const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2; grp.add(inner);   // model faces +x; forward is +z
  const m = mergeMesh(g, false); inner.add(m);
  const lights = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.24), new THREE.MeshStandardMaterial({ color: '#fff6dd', emissive: '#ffe2a8', emissiveIntensity: 0 })); lights.position.set(0.25, 0.13, 0); inner.add(lights); grp.userData.lights = lights;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: '#d98b7a', emissive: '#e07060', emissiveIntensity: 0 })); tail.position.set(-0.25, 0.13, 0); inner.add(tail); grp.userData.tail = tail;
  carMeshes.push(grp); grp.visible = false; peopleGroup.add(grp); return grp;
}
function makeCat(color) {
  const grp = new THREE.Group(); const g = [];
  g.push(box(0.2, 0.09, 0.1, color, 0, 0.08, 0)); const hd = new THREE.SphereGeometry(0.06, 7, 5); hd.translate(0.12, 0.14, 0); g.push(colorize(hd, color));
  g.push(box(0.03, 0.04, 0.03, color, 0.14, 0.19, -0.03)); g.push(box(0.03, 0.04, 0.03, color, 0.14, 0.19, 0.03));
  g.push(box(0.12, 0.03, 0.03, color, -0.14, 0.13, 0, 0)); for (const [x, z] of [[-0.07, -0.03], [0.07, -0.03], [-0.07, 0.03], [0.07, 0.03]]) g.push(box(0.03, 0.05, 0.03, color, x, 0.025, z));
  const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2; grp.add(inner);
  const m = mergeMesh(g, false); inner.add(m); peopleGroup.add(grp); return grp;
}

// ───────────────────────────── residents ─────────────────────────────
const residents = []; const wanderers = [];
const HOME_ACTS = ['relaxing at home', 'cooking dinner', 'watering the plants', 'reading a book', 'watching TV', 'tidying up', 'playing games', 'napping'];
const WORK_ACTS = ['working', 'in a meeting', 'on a call', 'typing away', 'sketching ideas', 'taking a tea break'];
const SHOP_STAFF_ACTS = ['serving customers', 'restocking shelves', 'wiping tables', 'at the register'];
const SHOP_ACTS = ['browsing', 'sipping coffee', 'buying groceries', 'chatting with the owner', 'picking a snack', 'trying samples'];

const WAIT_ACTS = ['waiting for a home', 'reading the timetable', 'studying the town map', 'people-watching', 'checking their phone', 'chatting with a neighbour', 'humming a tune', 'watching the clouds'];
const VEND_ACTS = ['buying a can of tea', 'choosing a soda', 'getting a hot coffee', 'buying a melon soda'];

// ── newcomers: everyone arrives by underground train and waits at the station until a home has room ──
function spawnNewcomer() {
  const r = {
    id: S.nextId++, name: `${pick(GIVEN)} ${pick(FAMILY)}`, home: null, job: null, at: null, state: 'inside', activity: 'arriving', next: S.T,
    wake: rand(6.5, 9), workEnd: rand(16.5, 18.5), hasCar: Math.random() < 0.35, lastWorkDay: -1, lastLeisureDay: -1, lunched: -1, returnTo: null, shopUntil: 0, jobSearchAt: S.T + rand(0.2, 1),
    skin: pick(SKIN), shirt: pick(SHIRTS), pants: pick(['#6b6f7a', '#8a7a6f', '#4a4340', '#9aa4aa', '#7f9b7a']), hair: pick(HAIR), hat: Math.random() < 0.3, hatColor: pick(SHIRTS),
    trip: null, mesh: null, car: null, carColor: pick(CARS), phase: rand(0, 6.28), spot: null, vendingAt: null, movingIn: false, arrivedDay: dayOf(),
  };
  r.mesh = makePerson(r); residents.push(r);
  const anchor = STATION.anchor; r.at = anchor; anchor.inside.add(r);
  r.mesh.position.copy(STATION.entrance); r.mesh.rotation.y = 0; r.mesh.visible = true;
  const spot = takeSpot(r);
  if (spot) startDirectTrip(r, STATION.entrance, spot.pos.clone().setY(0.12), 'looking for a seat', () => sitDown(r));
  else { r.state = 'inside'; r.activity = 'waiting for a home'; }
  return r;
}
function freeSpot(r) { if (r.spot) { r.spot.taken = null; r.spot = null; } if (r.vendingAt) { r.vendingAt.taken = null; r.vendingAt = null; } }
function takeSpot(r) {
  const spot = STATION.seats.find(s => !s.taken) || STATION.stands.find(s => !s.taken);
  if (spot) { spot.taken = r; r.spot = spot; } return spot;
}
function sitDown(r) {
  const s = r.spot; if (!s) { r.state = 'inside'; r.next = S.T; return; }
  r.mesh.visible = true; r.mesh.position.copy(s.pos); r.mesh.rotation.y = s.rot;
  r.state = 'inside'; r.trip = null; r.activity = s.kind === 'seat' ? 'waiting for a home' : 'waiting by the planters'; r.next = S.T + rand(0.3, 0.9);
}
function freeSpots() { return STATION.seats.filter(s => !s.taken).length + STATION.stands.filter(s => !s.taken).length; }
/** A short walk that ignores roads (inside the plaza, or across the grass), with a callback on arrival. */
function startDirectTrip(r, from, to, label, onArrive, y = 0.12) {
  const pts = [from.clone().setY(y), to.clone().setY(y)];
  r.trip = { pts, i: 0, t: 0, dest: null, drive: false, speed: 0.85 * rand(0.9, 1.1), baseY: y, onArrive };
  r.state = 'walking'; r.activity = label; r.mesh.visible = true; r.mesh.position.copy(pts[0]);
}
function waitDecide(r) {
  const h = hourOf();
  if (r.vendingAt) {   // finished at the machine: back to the seat
    r.vendingAt.taken = null; r.vendingAt = null;
    if (!r.spot) takeSpot(r);
    if (r.spot) startDirectTrip(r, r.mesh.position, r.spot.pos.clone().setY(0.12), 'heading back to the bench', () => sitDown(r));
    else { r.activity = 'waiting for a home'; r.next = S.T + 0.5; }
    return;
  }
  if (!r.spot && takeSpot(r)) { startDirectTrip(r, r.mesh.position, r.spot.pos.clone().setY(0.12), 'looking for a seat', () => sitDown(r)); return; }
  const v = STATION.vending.find(x => !x.taken);
  if (v && h >= 6 && h < 23 && Math.random() < 0.28) {
    v.taken = r; r.vendingAt = v;
    startDirectTrip(r, r.mesh.position, v.pos, 'going to the vending machine', () => { r.state = 'inside'; r.trip = null; r.mesh.rotation.y = v.rot; r.activity = pick(VEND_ACTS); r.next = S.T + rand(0.12, 0.2); });
    return;
  }
  r.activity = (h >= 23 || h < 5.5) ? pick(['dozing on the bench', 'sleeping under a coat', 'counting stars']) : pick(WAIT_ACTS);
  r.next = S.T + rand(0.4, 1.0);
}
function assignHome(r, u) {
  r.home = u; u.residents.push(r); u.incoming++; r.movingIn = true; r.jobSearchAt = S.T + rand(0.3, 1);
  freeSpot(r); if (r.at) r.at.inside.delete(r); r.at = null;
  const start = r.mesh.position.clone().setY(0);
  const path = routeCells(roadNeighbors(STATION.anchor.cell), roadNeighbors(u.cell));
  if (path) startTrip(r, path, start, unitPos(u), u, 'moving into a new home');
  else startDirectTrip(r, start, unitPos(u), 'moving in the long way round', () => enterUnit(r, u), 0.06);   // no road yet: cut across the grass
}
function enterUnit(r, u) {
  r.trip = null; r.mesh.visible = false; if (r.car) r.car.visible = false;
  if (u.removed) { returnToStation(r, r.mesh.position); return; }
  r.at = u; u.inside.add(r); r.state = 'inside'; r.next = S.T;
  if (r.movingIn && u === r.home) { r.movingIn = false; u.incoming = Math.max(0, u.incoming - 1); r.activity = 'unpacking boxes'; r.next = S.T + rand(0.5, 1); }
}
/** Lost their home (or their destination vanished): head back to the station and wait again. */
function returnToStation(r, fromPos) {
  r.home = null; r.movingIn = false; r.returnTo = null; r.shopUntil = 0;
  if (r.job) { r.job.staff.splice(r.job.staff.indexOf(r), 1); r.job = null; }
  const c = cellAt(fromPos); let start = fromPos.clone().setY(0), path = null;
  if (c) { const roads = c.type === 'road' ? [c] : roadNeighbors(c); if (roads.length) { start = new THREE.Vector3(cx(roads[0].i), 0, cz(roads[0].j)); path = routeCells(roads, roadNeighbors(STATION.anchor.cell)); } }
  if (path) startTrip(r, path, start, STATION.entrance, STATION.anchor, 'heading back to the station');
  else startDirectTrip(r, start, STATION.entrance, 'walking back to the station', () => arriveAtStation(r), 0.06);
}
function arriveAtStation(r) {
  r.trip = null; if (r.car) r.car.visible = false;
  r.at = STATION.anchor; STATION.anchor.inside.add(r); r.state = 'inside';
  if (takeSpot(r)) startDirectTrip(r, r.mesh.position, r.spot.pos.clone().setY(0.12), 'looking for a seat', () => sitDown(r));
  else { r.mesh.visible = true; r.activity = 'waiting for a home'; r.next = S.T + 0.5; }
}
function removeResident(r) {
  freeSpot(r); if (r.at) r.at.inside.delete(r);
  if (r.job) { r.job.staff.splice(r.job.staff.indexOf(r), 1); }
  if (r.home) r.home.residents.splice(r.home.residents.indexOf(r), 1);
  peopleGroup.remove(r.mesh); disposeGroup(r.mesh); if (r.car) { peopleGroup.remove(r.car); disposeGroup(r.car); const ci = carMeshes.indexOf(r.car); if (ci >= 0) carMeshes.splice(ci, 1); }
  residents.splice(residents.indexOf(r), 1);
}

// ── trains ──
let nextTrain = 7.4;
const arrivals = [];             // pending passenger arrival times
const nextTrainAt = () => nextTrain;
function updateStation() {
  if (S.T >= nextTrain) {
    const h = hourOf();
    if (h < 5.9) nextTrain = Math.floor(S.T / 24) * 24 + 6;
    else {
      const vacancies = blocks.filter(b => b.type === 'res' && b.stage === 3).reduce((s, b) => s + b.units.reduce((t, u) => t + Math.max(0, unitCap(u) - u.residents.length), 0), 0);
      const waiting = residents.filter(r => !r.home).length;
      let n = vacancies > 0 ? 1 + Math.ceil(vacancies / 2) : (waiting < 3 ? 1 : 0);
      n = Math.max(0, Math.min(3, n, freeSpots() - arrivals.length));
      for (let k = 0; k < n; k++) arrivals.push(S.T + 0.03 + k * 0.07);
      STATION.block.trains++;
      if (n > 0 && STATION.block.trains <= 2) toast(n === 1 ? 'A train pulled in. Someone is looking for a home.' : `A train pulled in. ${n} newcomers are looking for homes.`);
      nextTrain = h >= 22 ? Math.floor(S.T / 24) * 24 + 30 : S.T + 1.5;
    }
  }
  while (arrivals.length && S.T >= arrivals[0]) { arrivals.shift(); spawnNewcomer(); }
}
function waitingNewcomer() { return residents.find(r => !r.home && !r.movingIn && r.state === 'inside' && r.at === STATION.anchor); }
const shopUnits = () => blocks.filter(b => b.type === 'shop' && b.stage === 3).flatMap(b => b.units);
const jobUnits = () => blocks.filter(b => (b.type === 'work' || b.type === 'shop') && b.stage === 3).flatMap(b => b.units);
function findJob(r) {
  let best = null, bestLen = 1e9;
  for (const u of jobUnits()) {
    if (u.staff.length >= unitCap(u)) continue;
    const p = routeUnits(r.home, u); if (!p) continue;
    const len = p.length + (u.block.type === 'shop' ? 2 : 0) + Math.random() * 3;
    if (len < bestLen) { bestLen = len; best = u; }
  }
  if (best) { r.job = best; best.staff.push(r); }
}
function findShop(r, from) {
  const list = shopUnits().filter(u => routeUnits(from, u)); if (!list.length) return null;
  list.sort((a, b) => routeUnits(from, a).length - routeUnits(from, b).length);
  return list[Math.min(list.length - 1, Math.floor(Math.random() * Math.random() * list.length))];
}
function startTrip(r, cellPath, start, end, destUnit, label) {
  const drive = r.hasCar && cellPath.length > 6 && destUnit && destUnit !== STATION.anchor && r.at !== STATION.anchor;
  const pts = buildPoints(cellPath, start, end, drive ? 0.17 : 0.34, drive ? 0.1 : 0.08);
  r.trip = { pts, i: 0, t: 0, dest: destUnit, drive, speed: drive ? 2.6 : 0.9 * rand(0.85, 1.15), baseY: 0.08 };
  r.state = drive ? 'driving' : 'walking'; r.activity = label;
  if (drive) { if (!r.car) r.car = makeCar(r.carColor); r.car.visible = true; r.mesh.visible = false; r.car.position.copy(pts[0]); }
  else { r.mesh.visible = true; r.mesh.position.copy(pts[0]); }
}
function go(r, dest, label) {
  const from = r.at; const path = routeUnits(from, dest);
  if (!path) { r.next = S.T + rand(0.4, 0.9); return false; }
  const start = from === STATION.anchor ? r.mesh.position.clone().setY(0) : unitPos(from);
  if (from === STATION.anchor) freeSpot(r);
  from.inside.delete(r); r.at = null;
  startTrip(r, path, start, unitPos(dest), dest, label); return true;
}
function stroll(r) {
  const roads = cells.filter(c => c.type === 'road'); if (!roads.length) return false;
  const from = r.at; let path = null;
  for (let k = 0; k < 5 && !path; k++) { const t = pick(roads); path = routeCells(roadNeighbors(from.cell), [t]); if (path && path.length < 3) path = null; }
  if (!path) return false;
  from.inside.delete(r); r.at = null; r.strollHome = true;
  const last = path[path.length - 1];
  startTrip(r, path, unitPos(from), new THREE.Vector3(cx(last.i), 0, cz(last.j)), null, pick(['taking a walk', 'out for a stroll', 'walking the dog', 'going jogging']));
  return true;
}
function arrive(r) {
  const tr = r.trip;
  if (tr.onArrive) { r.trip = null; tr.onArrive(); return; }
  r.trip = null; r.mesh.visible = false; if (r.car) r.car.visible = false;
  const endPos = tr.pts[tr.pts.length - 1];
  if (!tr.dest) {   // strolled to a road cell: turn around and head home
    if (!r.home) { returnToStation(r, endPos); return; }
    const c = cellAt(endPos); const path = c ? routeCells([c], roadNeighbors(r.home.cell)) : null;
    if (path) startTrip(r, path, endPos.clone().setY(0), unitPos(r.home), r.home, 'heading home');
    else { r.at = r.home; r.home.inside.add(r); r.state = 'inside'; r.next = S.T; }
    return;
  }
  if (tr.dest === STATION.anchor) { r.mesh.position.copy(endPos); arriveAtStation(r); return; }
  if (tr.dest.removed) { returnToStation(r, endPos); return; }
  enterUnit(r, tr.dest);
  if (tr.dest.block.type === 'shop' && tr.dest !== r.job) { tr.dest.block.visitScore += 1; r.shopUntil = 0; }
}
function cellAt(p) { return cell(Math.floor(p.x + HALF), Math.floor(p.z + HALF)); }

function decide(r) {
  const h = hourOf(), day = dayOf(), u = r.at, shops = shopUnits().length > 0;
  if (!u) { r.next = S.T + 0.5; return; }
  if (u === STATION.anchor) { waitDecide(r); return; }
  if (!r.home) { go(r, STATION.anchor, 'heading back to the station'); return; }
  if (u === r.home) {
    if (h >= r.wake && h < 11.5) {
      if (r.job && r.lastWorkDay !== day) { r.lastWorkDay = day; if (go(r, r.job, 'heading to work')) return; }
      if (!r.job && r.lastLeisureDay !== day) { r.lastLeisureDay = day; const s = shops ? findShop(r, u) : null; if (s && Math.random() < 0.65) { if (go(r, s, 'going shopping')) return; } else if (stroll(r)) return; }
    }
    if (h >= 17 && h < 21 && shops && Math.random() < 0.18) { const s = findShop(r, u); if (s && go(r, s, 'popping out to the shops')) return; }
    if ((h >= 13 && h < 17) && !r.job && Math.random() < 0.12 && stroll(r)) return;
    if (h >= 22 || h < r.wake - 0.5) { r.activity = 'sleeping'; const wakeT = Math.floor(S.T / 24) * 24 + r.wake + (h >= r.wake ? 24 : 0); r.next = wakeT + rand(0, 0.3); return; }
    r.activity = pick(HOME_ACTS); r.next = S.T + rand(0.6, 1.4); return;
  }
  if (u === r.job) {
    if (h >= r.workEnd || h < 5) { const s = shops && Math.random() < 0.4 ? findShop(r, u) : null; if (s && s !== u && go(r, s, 'shopping after work')) return; go(r, r.home, 'heading home'); return; }
    if (h >= 12 && h < 13.5 && r.lunched !== day && shops && Math.random() < 0.5) { r.lunched = day; const s = findShop(r, u); if (s && s !== u) { r.returnTo = u; if (go(r, s, 'going for lunch')) return; } }
    r.activity = pick(u.block.type === 'shop' ? SHOP_STAFF_ACTS : WORK_ACTS); r.next = S.T + rand(0.5, 1.2); return;
  }
  // visiting a shop
  if (!r.shopUntil) { r.shopUntil = S.T + rand(0.5, 1.2); r.activity = pick(SHOP_ACTS); }
  if (S.T >= r.shopUntil) {
    r.shopUntil = 0;
    if (r.returnTo && hourOf() < r.workEnd) { const d = r.returnTo; r.returnTo = null; if (go(r, d, 'back to work')) return; }
    r.returnTo = null; go(r, r.home, 'heading home'); return;
  }
  r.next = Math.min(r.shopUntil, S.T + 0.3);
}

function moveAlong(obj, tr, dist) {
  const pts = tr.pts;
  while (dist > 0 && tr.i < pts.length - 1) {
    const a = pts[tr.i], b = pts[tr.i + 1], segLen = a.distanceTo(b) || 0.0001, remain = segLen - tr.t;
    if (dist < remain) { tr.t += dist; dist = 0; } else { dist -= remain; tr.i++; tr.t = 0; }
  }
  if (tr.i >= pts.length - 1) { obj.position.copy(pts[pts.length - 1]); return true; }
  const a = pts[tr.i], b = pts[tr.i + 1], k = tr.t / (a.distanceTo(b) || 1);
  obj.position.lerpVectors(a, b, k);
  const ang = Math.atan2(b.x - a.x, b.z - a.z); let d = ang - obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); obj.rotation.y += d * 0.35;
  return false;
}
function updateResidents(simDt, realT) {
  for (const r of residents) {
    if (r.state === 'inside') {
      if (S.T >= r.next) decide(r);
      if (r.home && !r.job && S.T >= r.jobSearchAt) { findJob(r); r.jobSearchAt = S.T + rand(1.5, 3); }
      continue;
    }
    const tr = r.trip; if (!tr) { r.state = 'inside'; continue; }
    if (tr.drive) {
      const done = moveAlong(r.car, tr, tr.speed * simDt);
      if (done) arrive(r);
    } else {
      const done = moveAlong(r.mesh, tr, tr.speed * simDt);
      r.mesh.position.y = tr.baseY + Math.abs(Math.sin(realT * 9 + r.phase)) * 0.025 * Math.min(1, S.speed);
      if (done) arrive(r);
    }
  }
}

// ───────────────────────────── ambient wanderers (cars & cats) ─────────────────────────────
function roadCellsList() { return cells.filter(c => c.type === 'road'); }
function spawnWanderer(kind) {
  const roads = roadCellsList(); if (!roads.length) return;
  const c = pick(roads);
  const w = { kind, cell: c, mesh: kind === 'car' ? makeCar(pick(CARS)) : makeCat(pick(['#e9d5b8', '#7a706a', '#f0b48b', '#4a4340', '#f7efe2'])), trip: null, pause: 0, dead: false };
  w.mesh.visible = true; w.mesh.position.set(cx(c.i), kind === 'car' ? 0.1 : 0.08, cz(c.j)); wanderers.push(w);
}
function wanderPick(w) {
  const roads = roadCellsList(); for (let k = 0; k < 6; k++) {
    const t = pick(roads); if (t === w.cell) continue; const path = routeCells([w.cell], [t]); if (!path || path.length < 3) continue;
    const y = w.kind === 'car' ? 0.1 : 0.08, side = w.kind === 'car' ? 0.17 : 0.36;
    const pts = buildPoints(path, w.mesh.position.clone().setY(y), new THREE.Vector3(cx(t.i), y, cz(t.j)), side, y); pts.pop();
    w.trip = { pts, i: 0, t: 0, speed: w.kind === 'car' ? rand(2.0, 2.8) : rand(0.35, 0.6), last: t }; return;
  }
  w.pause = rand(1, 4);
}
function updateWanderers(simDt) {
  const R = roadCellsList().length;
  const wantCars = Math.min(8, Math.floor(R / 16)), wantCats = Math.min(4, Math.floor(R / 22));
  const cars = wanderers.filter(w => w.kind === 'car'), cats = wanderers.filter(w => w.kind === 'cat');
  if (cars.length < wantCars) spawnWanderer('car'); if (cats.length < wantCats) spawnWanderer('cat');
  for (let k = wanderers.length - 1; k >= 0; k--) {
    const w = wanderers[k];
    const excess = (w.kind === 'car' && cars.length > wantCars) || (w.kind === 'cat' && cats.length > wantCats);
    if (w.dead || (excess && !w.trip)) { peopleGroup.remove(w.mesh); disposeGroup(w.mesh); const ci = carMeshes.indexOf(w.mesh); if (ci >= 0) carMeshes.splice(ci, 1); wanderers.splice(k, 1); continue; }
    if (w.pause > 0) { w.pause -= simDt; continue; }
    if (!w.trip) { wanderPick(w); continue; }
    if (moveAlong(w.mesh, w.trip, w.trip.speed * simDt)) { w.cell = w.trip.last; w.trip = null; w.pause = w.kind === 'cat' ? rand(2, 8) : rand(0.2, 1.5); }
    if (w.kind === 'cat') w.mesh.position.y = 0.08 + Math.abs(Math.sin(performance.now() * 0.012)) * 0.01;
  }
}

// ───────────────────────────── block lifecycle ─────────────────────────────
let lastDay = dayOf();
function growthAllowed(b) {
  const town = blocks.filter(x => x.type !== 'station');
  const types = new Set(town.filter(x => x.stage === 3).map(x => x.type));
  if (b.level === 1) return town.length >= 3 && (b.type === 'res' ? (types.has('work') || types.has('shop')) : types.has('res'));
  if (b.level === 2) return town.length >= 6 && types.size === 3;
  return false;
}
function updateBlocks(dh) {
  const dl = daylight();
  const day = dayOf(); if (day !== lastDay) { lastDay = day; for (const b of blocks) b.visitScore *= 0.5; }
  if (STATION.block) updateStation();
  for (const b of blocks) {
    if (b.type === 'station') continue;
    if (b.stage < 3) {
      b.stageT += dh * lerp(0.35, 1, dl);
      if (b.stageT >= STAGE_HOURS[b.stage]) { b.stage++; b.stageT = 0; for (const u of b.units) rebuildUnitMesh(u, true); if (b.stage === 3) toast(`${b.name} is finished`); }
      continue;
    }
    let occ = 0;
    if (b.type === 'res') {
      let n = 0, capSum = 0;
      for (const u of b.units) {
        const cap = unitCap(u); capSum += cap; n += u.residents.length;
        if (u.residents.length < cap && S.T - u.lastMoveIn > 0.4) { const r = waitingNewcomer(); if (r) { u.lastMoveIn = S.T; assignHome(r, u); } }
      }
      occ = capSum ? n / capSum : 0;
    } else if (b.type === 'work') {
      let n = 0, capSum = 0; for (const u of b.units) { capSum += unitCap(u); n += u.staff.length; } occ = capSum ? n / capSum : 0;
    } else {
      const staff = b.units.reduce((s, u) => s + u.staff.length, 0); occ = (staff > 0 ? 0.5 : 0) + 0.5 * clamp(b.visitScore / (4 * b.level), 0, 1);
    }
    if (occ >= 0.6) b.occT += dh; else b.occT = Math.max(0, b.occT - dh * 0.5);
    if (b.occT >= 20 && b.level < 3 && growthAllowed(b)) { b.level++; b.occT = 0; for (const u of b.units) rebuildUnitMesh(u, true); toast(`${b.name} grew to level ${b.level}`); }
  }
}

// ───────────────────────────── removing a block ─────────────────────────────
function removeBlock(block) {
  if (block.type === 'station') return;
  for (const u of block.units) {
    u.removed = true;
    for (const r of u.staff.slice()) { r.job = null; r.returnTo = null; }
    // residents lose their home and go back to the station to wait; anyone else inside just leaves
    for (const r of u.residents.slice()) {
      u.residents.splice(u.residents.indexOf(r), 1); r.home = null;
      if (r.at === u) { u.inside.delete(r); r.at = null; returnToStation(r, unitPos(u)); }
      else if (r.state === 'inside' && r.at) r.next = S.T;           // decide() will send them to the station
      else if (r.trip && r.trip.dest === u) { /* arrive() notices u.removed */ }
      else r.movingIn = false;
    }
    for (const r of Array.from(u.inside)) { if (r.at === u) { u.inside.delete(r); r.at = null; if (r.home) { const roads = roadNeighbors(u.cell); const path = roads.length ? routeCells(roads, roadNeighbors(r.home.cell)) : null; if (path) startTrip(r, path, new THREE.Vector3(cx(roads[0].i), 0, cz(roads[0].j)), unitPos(r.home), r.home, 'heading home'); else { r.at = r.home; r.home.inside.add(r); } } else returnToStation(r, unitPos(u)); } }
    if (u.mesh) { townGroup.remove(u.mesh); disposeGroup(u.mesh); }
    u.cell.type = 'empty'; u.cell.block = null; u.cell.unit = null; units.delete(u.id);
  }
  blocks.splice(blocks.indexOf(block), 1);
  for (const c of cells) if (c.type === 'road' && !lotAdjacent8(c)) { c.type = 'empty'; if (hash(c.j, c.i) < 0.18) c.tree = treeSpec(c.i, c.j); }
  for (const w of wanderers) if (w.cell && w.cell.type !== 'road') w.dead = true;
  refreshWorld();
}

onWorldChange(() => pathCache.clear());

export { HPS, hourOf, dayOf, daylight, routeCells, routeUnits, carMeshes, residents, wanderers, shopUnits, jobUnits,
  updateResidents, updateWanderers, updateBlocks, growthAllowed, removeBlock, nextTrainAt, spawnNewcomer, removeResident };
