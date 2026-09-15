// Komachi — simulation: time, road routing, residents and their schedules, ambient traffic, block lifecycle
import * as THREE from 'three';
import { PAL, GIVEN, FAMILY, SKIN, SHIRTS, HAIR, CARS } from './palette.js';
import { rand, pick, clamp, smooth, hash } from './utils.js';
import { S } from './state.js';
import { N, HALF, cx, cz, townGroup, peopleGroup, disposeGroup } from './scene.js';
import { box, cyl, colorize, mergeMesh } from './geometry.js';
import { cells, cell, DIR4, treeSpec, lotAdjacent8, blocks, units, DONE, stageHours, unitCap, refreshWorld, onWorldChange, STATION } from './world.js';
import { rebuildUnitMesh, unitDoorPoints } from './buildings.js';
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
/** The road cell a unit's door opens onto (falls back to any adjacent road). Trips begin and end there. */
function frontRoad(u) {
  if (u.block.type === 'station') return roadNeighbors(u.cell);
  const ry = u.facing || 0, c = cell(u.cell.i + Math.round(Math.sin(ry)), u.cell.j + Math.round(Math.cos(ry)));
  return c && c.type === 'road' ? [c] : roadNeighbors(u.cell);
}
function routeUnits(a, b) {
  const key = a.id + '>' + b.id; if (pathCache.has(key)) return pathCache.get(key);
  const p = routeCells(frontRoad(a), frontRoad(b)); pathCache.set(key, p); return p;
}
const unitPos = u => new THREE.Vector3(cx(u.cell.i), 0, cz(u.cell.j));
const exitPts = u => unitDoorPoints(u);                 // doorstep → kerb
const entryPts = u => unitDoorPoints(u).reverse();      // kerb → doorstep
/**
 * Turn a cell path into world points that follow one side of the road.
 * start / end may be a point or an ordered list (doorstep, kerb). `side` is the lateral offset.
 * lane: +1 keeps to the right of travel, -1 to the left (Japan drives on the left); null = pedestrian:
 * pick the sidewalk nearest the start, stay on it, and cross perpendicularly in the last cell if the
 * destination is on the other side. Corners use a mitre so walkers hug the kerb instead of cutting it.
 */
function buildPoints(cellPath, start, end, side, y, lane = null) {
  const sArr = Array.isArray(start) ? start : [start], eArr = Array.isArray(end) ? end : [end];
  const keepY = p => p.y > 0 ? p.clone() : p.clone().setY(y);
  const pts = sArr.map(keepY);
  const n = cellPath.length, C = cellPath.map(c => new THREE.Vector3(cx(c.i), y, cz(c.j)));
  const dirs = [];
  for (let k = 0; k < n - 1; k++) dirs.push(C[k + 1].clone().sub(C[k]).setY(0).normalize());
  if (!dirs.length) { const d = eArr[0].clone().sub(sArr[sArr.length - 1]).setY(0); dirs.push(d.lengthSq() ? d.normalize() : new THREE.Vector3(0, 0, 1)); }
  const rightOf = d => new THREE.Vector3(-d.z, 0, d.x);
  const kerbS = sArr[sArr.length - 1], kerbE = eArr[0];
  const r0 = rightOf(dirs[0]);
  const laneSign = lane !== null ? lane : (Math.sign(r0.dot(kerbS.clone().sub(C[0]).setY(0))) || 1);
  for (let k = 0; k < n; k++) {
    const n1 = rightOf(k > 0 ? dirs[k - 1] : dirs[0]), n2 = rightOf(k < n - 1 ? dirs[k] : dirs[dirs.length - 1]);
    const dot = n1.dot(n2);
    const off = dot > 0.99 ? n1 : n1.clone().add(n2).multiplyScalar(1 / (1 + dot));   // mitre offset
    pts.push(C[k].clone().addScaledVector(off, side * laneSign));
  }
  if (lane === null && n > 0) {
    const rL = rightOf(dirs[dirs.length - 1]), endSide = Math.sign(rL.dot(kerbE.clone().sub(C[n - 1]).setY(0))) || laneSign;
    if (endSide !== laneSign) pts.push(C[n - 1].clone().addScaledVector(rL, side * endSide));   // cross the road here
  }
  for (const p of eArr) pts.push(keepY(p));
  return pts;
}

// ───────────────────────────── meshes: people, cars, cats ─────────────────────────────
const carMeshes = [];
const PERSON_SCALE = 0.7;   // a floor is ~0.55 units; people read as a bit over half a storey tall
function makePerson(r) {
  const grp = new THREE.Group(), rig = new THREE.Group(); rig.scale.setScalar(PERSON_SCALE); grp.add(rig);
  // legs hang from a hip pivot so they can swing forward when sitting
  const legs = mergeMesh([box(0.15, 0.13, 0.11, r.pants, 0, -0.065, 0)], false); legs.position.y = 0.13; legs.castShadow = true; rig.add(legs);
  const g = [];
  g.push(box(0.17, 0.2, 0.12, r.shirt, 0, 0.23, 0));
  g.push(box(0.05, 0.16, 0.05, r.shirt, -0.11, 0.24, 0)); g.push(box(0.05, 0.16, 0.05, r.shirt, 0.11, 0.24, 0));
  const head = new THREE.SphereGeometry(0.085, 8, 6); head.translate(0, 0.42, 0); g.push(colorize(head, r.skin));
  if (r.hat) { g.push(cyl(0.11, 0.11, 0.03, r.hatColor, 0, 0.47, 0, 10)); g.push(cyl(0.07, 0.075, 0.07, r.hatColor, 0, 0.51, 0, 10)); }
  else { const hair = new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2); hair.translate(0, 0.43, 0); g.push(colorize(hair, r.hair)); }
  if (r.bag) g.push(box(0.06, 0.1, 0.05, r.bagColor, -0.15, 0.2, 0.0));
  const upper = mergeMesh(g, false); upper.castShadow = true; rig.add(upper);
  grp.userData = { res: r, legs, upper }; grp.visible = false; peopleGroup.add(grp); return grp;
}
/** sitting: legs swing forward from the hip, torso leans back a touch */
function setPose(r, sitting) {
  const d = r.mesh && r.mesh.userData; if (!d || !d.legs) return;
  d.legs.rotation.x = sitting ? -Math.PI / 2 : 0; d.upper.rotation.x = sitting ? -0.08 : 0;
}
function makeCar(color, kind = 'kei') {
  const grp = new THREE.Group(); const g = [];
  const dark = '#4a4340', glass = '#d8e3e8';
  if (kind === 'van') {          // boxy delivery van
    g.push(box(0.52, 0.3, 0.28, color, 0, 0.21, 0)); g.push(box(0.12, 0.12, 0.24, glass, 0.2, 0.28, 0)); g.push(box(0.26, 0.1, 0.29, glass, -0.08, 0.28, 0)); g.push(box(0.3, 0.04, 0.3, PAL.cream2, -0.06, 0.37, 0));
  } else if (kind === 'truck') { // kei truck with a flat bed
    g.push(box(0.16, 0.26, 0.26, color, 0.16, 0.2, 0)); g.push(box(0.1, 0.12, 0.22, glass, 0.21, 0.27, 0)); g.push(box(0.3, 0.06, 0.28, color, -0.09, 0.14, 0));
    for (const zz of [-0.13, 0.13]) g.push(box(0.3, 0.08, 0.02, color, -0.09, 0.2, zz)); g.push(box(0.02, 0.08, 0.28, color, -0.23, 0.2, 0));
    if (Math.random() < 0.6) g.push(box(0.14, 0.1, 0.14, PAL.wood2, -0.1, 0.22, 0));
  } else if (kind === 'taxi') {  // pastel taxi with a roof sign
    g.push(box(0.5, 0.15, 0.28, '#e8cf7a', 0, 0.135, 0)); g.push(box(0.28, 0.13, 0.24, '#e8cf7a', -0.02, 0.27, 0)); g.push(box(0.29, 0.09, 0.22, glass, -0.02, 0.27, 0)); g.push(box(0.08, 0.04, 0.12, PAL.roofRose, -0.02, 0.355, 0));
  } else if (kind === 'hatch') { // compact hatchback
    g.push(box(0.5, 0.16, 0.28, color, 0, 0.14, 0)); g.push(box(0.28, 0.14, 0.24, color, -0.02, 0.29, 0)); g.push(box(0.29, 0.1, 0.22, glass, -0.02, 0.29, 0));
  } else {                       // kei car: short, tall, upright cabin
    g.push(box(0.42, 0.16, 0.27, color, 0, 0.14, 0)); g.push(box(0.32, 0.16, 0.25, color, -0.03, 0.3, 0)); g.push(box(0.33, 0.1, 0.23, glass, -0.03, 0.31, 0)); g.push(box(0.04, 0.03, 0.2, dark, -0.2, 0.2, 0));
  }
  const wheelX = kind === 'kei' ? 0.13 : 0.16;
  for (const [x, z] of [[-wheelX, -0.13], [wheelX, -0.13], [-wheelX, 0.13], [wheelX, 0.13]]) { const wgm = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8); wgm.rotateX(Math.PI / 2); wgm.translate(x, 0.07, z); g.push(colorize(wgm, dark)); }
  const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2; grp.add(inner);   // model faces +x; forward is +z
  const m = mergeMesh(g, false); inner.add(m);
  const front = kind === 'kei' ? 0.21 : kind === 'van' || kind === 'truck' ? 0.26 : 0.25;
  const lights = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.24), new THREE.MeshStandardMaterial({ color: '#fff6dd', emissive: '#ffe2a8', emissiveIntensity: 0 })); lights.position.set(front, 0.13, 0); inner.add(lights); grp.userData.lights = lights;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.22), new THREE.MeshStandardMaterial({ color: '#d98b7a', emissive: '#e07060', emissiveIntensity: 0 })); tail.position.set(-front, 0.13, 0); inner.add(tail); grp.userData.tail = tail;
  carMeshes.push(grp); grp.visible = false; peopleGroup.add(grp); return grp;
}
function makeCat(color) {
  const grp = new THREE.Group(); const g = [];
  g.push(box(0.2, 0.09, 0.1, color, 0, 0.08, 0)); const hd = new THREE.SphereGeometry(0.06, 7, 5); hd.translate(0.12, 0.14, 0); g.push(colorize(hd, color));
  g.push(box(0.03, 0.04, 0.03, color, 0.14, 0.19, -0.03)); g.push(box(0.03, 0.04, 0.03, color, 0.14, 0.19, 0.03));
  g.push(box(0.12, 0.03, 0.03, color, -0.14, 0.13, 0, 0)); for (const [x, z] of [[-0.07, -0.03], [0.07, -0.03], [-0.07, 0.03], [0.07, 0.03]]) g.push(box(0.03, 0.05, 0.03, color, x, 0.025, z));
  const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2; inner.scale.setScalar(0.8); grp.add(inner);
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
    skin: pick(SKIN), shirt: pick(SHIRTS), pants: pick(['#6b6f7a', '#8a7a6f', '#4a4340', '#9aa4aa', '#7f9b7a']), hair: pick(HAIR), hat: Math.random() < 0.3, hatColor: pick(SHIRTS), bag: Math.random() < 0.45, bagColor: pick(['#4a4340', '#a3764a', '#d98b7a', '#6f9a96']),
    trip: null, mesh: null, car: null, carColor: pick(CARS), carKind: pick(['kei', 'kei', 'kei', 'hatch', 'van']), phase: rand(0, 6.28), spot: null, vendingAt: null, movingIn: false, arrivedDay: dayOf(),
  };
  r.mesh = makePerson(r); residents.push(r);
  const anchor = STATION.anchor; r.at = anchor; anchor.inside.add(r);
  r.mesh.position.copy(STATION.entrance); r.mesh.rotation.y = 0; r.mesh.visible = true;
  const spot = takeSpot(r);
  if (spot) startDirectTrip(r, STATION.entrance, spot.pos.clone().setY(0.12), 'looking for a seat', () => sitDown(r));
  else { r.state = 'inside'; r.activity = 'waiting for a home'; }
  return r;
}
/** next decision time for someone waiting at the station: never sleeps past the 22:00 last train */
const waitNext = dt => { const t = S.T + dt, lastTrain = Math.floor(S.T / 24) * 24 + 22.02; return hourOf() < 22 ? Math.min(t, lastTrain) : t; };
function freeSpot(r) { if (r.spot) { r.spot.taken = null; r.spot = null; } if (r.vendingAt) { r.vendingAt.taken = null; r.vendingAt = null; } }
function takeSpot(r) {
  const spot = STATION.seats.find(s => !s.taken) || STATION.stands.find(s => !s.taken);
  if (spot) { spot.taken = r; r.spot = spot; } return spot;
}
function sitDown(r) {
  const s = r.spot; if (!s) { r.state = 'inside'; r.next = S.T; return; }
  r.mesh.visible = true; r.mesh.position.copy(s.pos); r.mesh.rotation.y = s.rot; setPose(r, s.kind === 'seat');
  r.state = 'inside'; r.trip = null; r.activity = s.kind === 'seat' ? 'waiting for a home' : 'waiting by the planters'; r.next = waitNext(rand(0.3, 0.9));
}
function freeSpots() { return STATION.seats.filter(s => !s.taken).length + STATION.stands.filter(s => !s.taken).length; }
/** A short walk that ignores roads (inside the plaza, or across the grass), with a callback on arrival. */
function startDirectTrip(r, from, to, label, onArrive, y = 0.12) {
  const pts = [from.clone().setY(y), to.clone().setY(y)];
  r.trip = { pts, i: 0, t: 0, dest: null, drive: false, speed: 0.85 * rand(0.9, 1.1), baseY: y, onArrive };
  r.state = 'walking'; r.activity = label; r.mesh.visible = true; r.mesh.position.copy(pts[0]); setPose(r, false);
}
function waitDecide(r) {
  const h = hourOf();
  if (h >= 22 || h < 5.5) { freeSpot(r); startDirectTrip(r, r.mesh.position, STATION.entrance, 'taking the last train to the city', () => leaveForCity(r)); return; }
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
    startDirectTrip(r, r.mesh.position, v.pos, 'going to the vending machine', () => { r.state = 'inside'; r.trip = null; r.mesh.rotation.y = v.rot; r.activity = pick(VEND_ACTS); r.next = waitNext(rand(0.12, 0.2)); });
    return;
  }
  r.activity = pick(WAIT_ACTS);
  r.next = waitNext(rand(0.4, 1.0));
}
function assignHome(r, u) {
  r.home = u; u.residents.push(r); u.incoming++; r.movingIn = true; r.jobSearchAt = S.T + rand(0.3, 1);
  freeSpot(r); if (r.at) r.at.inside.delete(r); r.at = null;
  const start = r.mesh.position.clone().setY(0);
  const path = routeCells(roadNeighbors(STATION.anchor.cell), frontRoad(u));
  if (path) startTrip(r, path, start, entryPts(u), u, 'moving into a new home');
  else startDirectTrip(r, start, exitPts(u)[0], 'moving in the long way round', () => enterUnit(r, u), 0.06);   // no road yet: cut across the grass
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
const trainListeners = [];
function onTrain(fn) { trainListeners.push(fn); }
let nextTrain = 7.4;
const arrivals = [];             // pending arrivals: { t, r } (r = a resident returning from the city, else a newcomer)
let pendingSummoned = 0;         // beds in homes about to finish; their households ride the next train
const nextTrainAt = () => nextTrain;
function updateStation() {
  if (S.T >= nextTrain) {
    const h = hourOf();
    if (h < 5.9) nextTrain = Math.floor(S.T / 24) * 24 + 6;
    else {
      const beds = u => Math.max(0, unitCap(u) - u.residents.length - u.incoming);
      const vacancies = blocks.filter(b => b.type === 'res' && b.stage === DONE).reduce((s, b) => s + b.units.reduce((t, u) => t + beds(u), 0), 0);
      const waiting = residents.filter(r => !r.home && r.state !== 'away').length;
      const returning = h < 7 ? residents.filter(r => r.state === 'away') : [];   // night-trippers ride the first morning train only
      let room = Math.max(0, freeSpots() - arrivals.length - returning.length);
      let t = S.T + 0.03;
      for (const r of returning) arrivals.push({ t: (t += 0.07), r });            // night-trippers come home first
      const enRoute = arrivals.filter(a => !a.r).length;
      let n = Math.max(0, vacancies + pendingSummoned - waiting - enRoute);       // people who will have a bed, minus those already here
      if (STATION.block.trains === 0 && n === 0) n = 1;                          // one hopeful on the very first train
      if (h >= 21.5) n = 0;                                                        // nobody arrives just to leave again at 22:00
      n = Math.min(n, room, 4); if (n > 0 || h < 21.5) pendingSummoned = 0;
      for (let k = 0; k < n; k++) arrivals.push({ t: (t += 0.07), r: null });
      STATION.block.trains++;
      for (const fn of trainListeners) fn(h);
      if (n > 0 && STATION.block.trains <= 2) toast(n === 1 ? 'A train pulled in. Someone is looking for a home.' : `A train pulled in. ${n} newcomers are looking for homes.`);
      nextTrain = h >= 22 ? Math.floor(S.T / 24) * 24 + 30 : S.T + 1.5;
    }
  }
  while (arrivals.length && S.T >= arrivals[0].t) { const a = arrivals.shift(); if (a.r) returnFromCity(a.r); else spawnNewcomer(); }
}
/** Late evening: nobody sleeps on a bench. Waiting newcomers take the last train to the city and are back at 06:00. */
function leaveForCity(r) {
  freeSpot(r); if (r.at) r.at.inside.delete(r); r.at = null;
  r.trip = null; r.mesh.visible = false; r.state = 'away'; r.activity = 'staying in the city tonight'; r.next = S.T + 24;
}
function returnFromCity(r) {
  r.state = 'inside'; r.at = STATION.anchor; STATION.anchor.inside.add(r); r.mesh.position.copy(STATION.entrance); r.mesh.visible = true;
  if (takeSpot(r)) startDirectTrip(r, STATION.entrance, r.spot.pos.clone().setY(0.12), 'back from the city', () => sitDown(r));
  else { r.activity = 'waiting for a home'; r.next = S.T + 0.5; }
}
function waitingNewcomer() { return residents.find(r => !r.home && !r.movingIn && r.state === 'inside' && r.at === STATION.anchor); }
const shopUnits = () => blocks.filter(b => b.type === 'shop' && b.stage === DONE).flatMap(b => b.units);
const jobUnits = () => blocks.filter(b => (b.type === 'work' || b.type === 'shop') && b.stage === DONE).flatMap(b => b.units);
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
  if (drive) { if (Array.isArray(start)) start = start[start.length - 1]; if (Array.isArray(end)) end = end[0]; }   // cars stop at the kerb
  const pts = drive ? buildPoints(cellPath, start, end, 0.17, 0.08, -1) : buildPoints(cellPath, start, end, 0.34, 0.1);
  r.trip = { pts, i: 0, t: 0, dest: destUnit, drive, speed: drive ? 2.6 : 0.9 * rand(0.85, 1.15), baseY: drive ? 0.08 : 0.1 };
  if (!drive) setPose(r, false);
  r.state = drive ? 'driving' : 'walking'; r.activity = label;
  if (drive) { if (!r.car) r.car = makeCar(r.carColor, r.carKind); r.car.visible = true; r.mesh.visible = false; r.car.position.copy(pts[0]); }
  else { r.mesh.visible = true; r.mesh.position.copy(pts[0]); }
}
function go(r, dest, label) {
  const from = r.at; const path = routeUnits(from, dest);
  if (!path) { r.next = S.T + rand(0.4, 0.9); return false; }
  const start = from === STATION.anchor ? r.mesh.position.clone().setY(0) : exitPts(from);
  if (from === STATION.anchor) freeSpot(r);
  from.inside.delete(r); r.at = null;
  startTrip(r, path, start, dest === STATION.anchor ? STATION.entrance : entryPts(dest), dest, label); return true;
}
function stroll(r) {
  const roads = cells.filter(c => c.type === 'road'); if (!roads.length) return false;
  const from = r.at; let path = null;
  for (let k = 0; k < 5 && !path; k++) { const t = pick(roads); path = routeCells(frontRoad(from), [t]); if (path && path.length < 3) path = null; }
  if (!path) return false;
  from.inside.delete(r); r.at = null; r.strollHome = true;
  const last = path[path.length - 1];
  startTrip(r, path, exitPts(from), new THREE.Vector3(cx(last.i), 0, cz(last.j)), null, pick(['taking a walk', 'out for a stroll', 'walking the dog', 'going jogging']));
  return true;
}
function arrive(r) {
  const tr = r.trip;
  if (tr.onArrive) { r.trip = null; tr.onArrive(); return; }
  r.trip = null; r.mesh.visible = false; if (r.car) r.car.visible = false;
  const endPos = tr.pts[tr.pts.length - 1];
  if (!tr.dest) {   // strolled to a road cell: turn around and head home
    if (!r.home) { returnToStation(r, endPos); return; }
    const c = cellAt(endPos); const path = c ? routeCells([c], frontRoad(r.home)) : null;
    if (path) startTrip(r, path, endPos.clone().setY(0), entryPts(r.home), r.home, 'heading home');
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
    if (r.state === 'away') continue;
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
      r.mesh.position.y += Math.abs(Math.sin(realT * 9 + r.phase)) * 0.018 * Math.min(1, S.speed);
      if (done) arrive(r);
    }
  }
}

// ───────────────────────────── ambient wanderers (cars & cats) ─────────────────────────────
function roadCellsList() { return cells.filter(c => c.type === 'road'); }
function spawnWanderer(kind) {
  const roads = roadCellsList(); if (!roads.length) return;
  const c = pick(roads);
  const w = { kind, cell: c, mesh: kind === 'car' ? makeCar(pick(CARS), pick(['kei', 'van', 'truck', 'truck', 'taxi', 'hatch'])) : makeCat(pick(['#e9d5b8', '#7a706a', '#f0b48b', '#4a4340', '#f7efe2'])), trip: null, pause: 0, dead: false };
  w.mesh.visible = true; w.mesh.position.set(cx(c.i), kind === 'car' ? 0.08 : 0.1, cz(c.j)); wanderers.push(w);
}
function wanderPick(w) {
  const roads = roadCellsList(); for (let k = 0; k < 6; k++) {
    const t = pick(roads); if (t === w.cell) continue; const path = routeCells([w.cell], [t]); if (!path || path.length < 3) continue;
    const y = w.kind === 'car' ? 0.08 : 0.1, side = w.kind === 'car' ? 0.17 : 0.36;
    const pts = buildPoints(path, w.mesh.position.clone().setY(y), new THREE.Vector3(cx(t.i), y, cz(t.j)), side, y, w.kind === 'car' ? -1 : (w.lane || (w.lane = Math.random() < 0.5 ? 1 : -1))); pts.pop();
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
    if (w.kind === 'cat') w.mesh.position.y = 0.1 + Math.abs(Math.sin(performance.now() * 0.012)) * 0.01;
  }
}

// ───────────────────────────── block lifecycle ─────────────────────────────
let lastDay = dayOf();
/** how fast a site builds right now (crew-hours per game hour); construction.js installs the real rule */
let progressRate = () => 1;
function setProgressRate(fn) { progressRate = fn; }
function growthAllowed(b) {
  const town = blocks.filter(x => x.type !== 'station');
  const types = new Set(town.filter(x => x.stage === DONE).map(x => x.type));
  if (b.level === 1) return town.length >= 3 && (b.type === 'res' ? (types.has('work') || types.has('shop')) : types.has('res'));
  if (b.level === 2) return town.length >= 6 && types.size === 3;
  return false;
}
function updateBlocks(dh) {
  const day = dayOf(); if (day !== lastDay) { lastDay = day; for (const b of blocks) b.visitScore *= 0.5; }
  if (STATION.block) updateStation();
  for (const b of blocks) {
    if (b.type === 'station') continue;
    if (b.stage < DONE) {
      b.stageT += dh * progressRate(b);
      if (b.type === 'res' && b.stage === DONE - 1 && !b.summoned) { b.summoned = true; pendingSummoned += b.units.reduce((n, u) => n + unitCap(u), 0); }
      if (b.stageT >= stageHours(b)[b.stage]) { b.stage++; b.stageT = 0; for (const u of b.units) rebuildUnitMesh(u, true); if (b.stage === DONE) toast(`${b.name} is finished`); }
      continue;
    }
    if (b.renoT > 0) { b.renoT -= dh; if (b.renoT <= 0) { b.renoT = 0; for (const u of b.units) rebuildUnitMesh(u); } }
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
    if (b.occT >= 20 && b.level < 3 && growthAllowed(b)) { b.level++; b.occT = 0; b.renoT = 2.5; for (const u of b.units) rebuildUnitMesh(u, true); toast(`${b.name} is being extended`); }
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
    for (const r of Array.from(u.inside)) { if (r.at === u) { u.inside.delete(r); r.at = null; if (r.home) { const roads = roadNeighbors(u.cell); const path = roads.length ? routeCells(roads, frontRoad(r.home)) : null; if (path) startTrip(r, path, new THREE.Vector3(cx(roads[0].i), 0, cz(roads[0].j)), unitPos(r.home), r.home, 'heading home'); else { r.at = r.home; r.home.inside.add(r); } } else returnToStation(r, unitPos(u)); } }
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
  updateResidents, updateWanderers, updateBlocks, growthAllowed, removeBlock, nextTrainAt, spawnNewcomer, removeResident,
  roadNeighbors, frontRoad, buildPoints, makePerson, makeCar, moveAlong, unitPos, setProgressRate, onTrain };
