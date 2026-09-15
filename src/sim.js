// Komachi — simulation: time, road routing, residents and their schedules, ambient traffic, block lifecycle
import * as THREE from 'three';
import { PAL, GIVEN, FAMILY, SKIN, SHIRTS, HAIR, CARS } from './palette.js';
import { rand, pick, clamp, smooth, hash } from './utils.js';
import { S } from './state.js';
import { N, HALF, cx, cz, townGroup, peopleGroup, disposeGroup, cam, camera } from './scene.js';
import { box, colorize, mergeMesh } from './geometry.js';
import { attachCharacter, detachCharacter } from './characters.js';
import { cells, cell, DIR4, treeSpec, lotAdjacent8, blocks, units, DONE, stageHours, unitCap, refreshWorld, onWorldChange, STATION, terrainY } from './world.js';
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
function makePerson(r) {
  const grp = new THREE.Group(); grp.userData = { res: r }; grp.visible = false; peopleGroup.add(grp);
  attachCharacter(grp, r);   // rigged model when loaded, box person otherwise
  return grp;
}
/** sitting: the rigged model bends at the hips and knees; the box fallback swings its legs forward */
function setPose(r, sitting) {
  const d = r.mesh && r.mesh.userData; if (!d) return;
  if (d.char) { d.char.sitting = sitting; return; }
  if (d.legs) { d.legs.rotation.x = sitting ? -Math.PI / 2 : 0; d.upper.rotation.x = sitting ? -0.08 : 0; }
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
  const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2; inner.scale.setScalar(0.8); grp.add(inner);   // model faces +x; forward is +z; a touch smaller than the boxes suggest
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

const BREAKFAST_ACTS = ['having breakfast out', 'a coffee and a pastry', 'eating a morning set', 'reading the paper over coffee'];
const LUNCH_ACTS = ['having lunch', 'eating ramen', 'having a set meal', 'sharing a pastry', 'finishing a coffee'];
const DINNER_ACTS = ['eating dinner out', 'having ramen for dinner', 'sharing a set meal', 'lingering over dessert', 'finishing a coffee'];
const VISIT_ACTS = ['chatting over tea', 'catching up with a friend', 'playing cards', 'watching a film together', 'sharing snacks'];

// ── households: people who live together. Booked when their home is nearly finished; they ride the same train,
//    sit together and move in together. Solo arrivals are a household of one. ──
const households = [];
const bookings = [];             // { hh, spawned }: households due on the next train
function makeHousehold(size, home) {
  const kind = size === 1 ? 'solo' : size === 2 ? (Math.random() < 0.7 ? 'couple' : 'flatmates') : Math.random() < 0.8 ? 'family' : 'flatmates';
  const hh = { id: S.nextId++, kind, size, surname: pick(FAMILY), members: [], home };
  households.push(hh); return hh;
}
function hhName(hh) { return hh.kind === 'flatmates' ? (hh.members.map(m => m.name.split(' ')[1]).join(' & ') || 'Flatmates') : `The ${hh.surname} ${hh.kind === 'solo' ? 'home' : 'household'}`; }
function hhLabel(hh) { return { solo: 'Lives alone', couple: 'A couple', family: `A family of ${hh.size}`, flatmates: `${hh.size} flatmates` }[hh.kind]; }
/** how a unit's beds split into households (mostly couples and small families) */
function splitHouseholds(cap) { const out = []; let rem = cap; while (rem > 0) { const n = Math.min(rem, pick([1, 2, 2, 2, 3, 3])); out.push(n); rem -= n; } return out; }
/** part of a household moves out into a household of its own (when no home fits them all) */
function splitOff(hh, members) {
  const nh = makeHousehold(members.length, null); const names = new Set(members.map(m => m.name.split(' ')[1]));
  nh.kind = members.length === 1 ? 'solo' : names.size === 1 ? (members.length === 2 ? 'couple' : 'family') : 'flatmates'; nh.surname = members[0].name.split(' ')[1];
  for (const m of members) { hh.members.splice(hh.members.indexOf(m), 1); nh.members.push(m); m.hh = nh; }
  dropHousehold(hh); return nh;
}
function dropHousehold(hh) { const i = households.indexOf(hh); if (i >= 0 && !hh.members.length) households.splice(i, 1); }

// ── needs: each runs 0 (desperate) … 1 (satisfied). They drain while awake and refill through what people do. ──
const DRAIN = { energy: 0.04, food: 0.09, fun: 0.05, social: 0.04, supplies: 0.03 };
function freshNeeds() { return { energy: rand(0.7, 0.95), food: rand(0.45, 0.85), fun: rand(0.5, 0.8), social: rand(0.5, 0.8), supplies: rand(0.3, 0.8) }; }
function tickNeeds(r) {
  const dt = Math.max(0, S.T - r.needsT); r.needsT = S.T; if (!dt) return;
  const n = r.needs, k = r.actKind;
  for (const key in DRAIN) n[key] -= DRAIN[key] * dt;
  if (k === 'sleep') { n.energy += (DRAIN.energy + 0.14) * dt; n.food += DRAIN.food * 0.6 * dt; }
  else if (k === 'home') { n.fun += 0.06 * dt; if (r.home && r.hh.members.some(m => m !== r && m.at === r.home)) n.social += 0.12 * dt; }
  else if (k === 'work') n.social += 0.06 * dt;
  else if (k === 'eat') { n.food += 0.9 * dt; n.social += 0.15 * dt; }
  else if (k === 'shop') { n.supplies += 1.2 * dt; n.fun += 0.2 * dt; n.social += 0.15 * dt; }
  else if (k === 'visit') { n.social += 0.6 * dt; n.fun += 0.3 * dt; }
  else if (k === 'stroll') { n.fun += 0.5 * dt; n.energy -= 0.02 * dt; }
  else if (k === 'wait') n.fun -= 0.02 * dt;
  for (const key in n) n[key] = clamp(n[key], 0, 1);
}
/** the card shows needs as words, never as numbers */
function moodWords(r) {
  const n = r.needs, w = [];
  if (n.food < 0.35) w.push(n.food < 0.15 ? 'starving' : 'hungry');
  if (n.energy < 0.3) w.push(n.energy < 0.12 ? 'exhausted' : 'tired');
  if (n.fun < 0.3) w.push('restless');
  if (n.social < 0.3) w.push('lonely');
  if (n.supplies < 0.25) w.push('out of groceries');
  if (!w.length) w.push(n.energy > 0.7 && n.food > 0.6 ? 'content' : 'doing fine');
  return w.slice(0, 2).join(', ');
}

function baseResident(name, hh) {
  const wake = rand(6.5, 9);
  return {
    id: S.nextId++, name, hh, home: null, job: null, at: null, state: 'inside', activity: 'arriving', next: S.T, plan: '',
    wake, workStart: clamp(wake + rand(0.5, 1.5), 7, 10.5), workEnd: rand(16.5, 18.5), hasCar: Math.random() < 0.35, lastWorkDay: -1, lunched: -1, returnTo: null, until: 0, purpose: null, jobSearchAt: S.T + rand(0.2, 1),
    needs: freshNeeds(), needsT: S.T, actKind: 'wait', far: false, lodDist: 0, carAt: null,
    skin: pick(SKIN), shirt: pick(SHIRTS), pants: pick(['#6b6f7a', '#8a7a6f', '#4a4340', '#9aa4aa', '#7f9b7a']), hair: pick(HAIR), hat: Math.random() < 0.3, hatColor: pick(SHIRTS), bag: Math.random() < 0.45, bagColor: pick(['#4a4340', '#a3764a', '#d98b7a', '#6f9a96']),
    trip: null, mesh: null, car: null, carColor: pick(CARS), carKind: pick(['kei', 'kei', 'kei', 'hatch', 'van']), phase: rand(0, 6.28), spot: null, vendingAt: null, movingIn: false, arrivedDay: dayOf(), arrivedT: S.T,
  };
}

// ── newcomers: everyone arrives by underground train and waits at the station until a home has room ──
function spawnNewcomer(hh = null) {
  if (!hh) hh = makeHousehold(1, null);
  const r = baseResident(`${pick(GIVEN)} ${hh.kind === 'flatmates' ? pick(FAMILY) : hh.surname}`, hh);
  hh.members.push(r);
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
// Walks across the plaza go round the stair house in the centre cell instead of through it: if the straight
// line crosses the centre cell, detour along the side nearer the walker, past the cell's front and back corners.
const PLAZA_C = { x: STATION.entrance.x, z: STATION.entrance.z - 0.9 };
function plazaDetour(from, to) {
  const hx = 0.56, hz = 0.64; let hit = false;
  for (let t = 0; t <= 1 && !hit; t += 0.04) { const x = from.x + (to.x - from.x) * t, z = from.z + (to.z - from.z) * t; hit = Math.abs(x - PLAZA_C.x) < hx && Math.abs(z - PLAZA_C.z) < hz; }
  if (!hit) return [];
  const side = Math.sign(from.x + to.x - 2 * PLAZA_C.x) || 1, sx = PLAZA_C.x + side * hx;
  const z1 = PLAZA_C.z + (Math.sign(from.z - PLAZA_C.z) || 1) * 0.6, z2 = PLAZA_C.z + (Math.sign(to.z - PLAZA_C.z) || 1) * 0.6;
  const pts = [new THREE.Vector3(sx, 0.12, z1)]; if (Math.abs(z2 - z1) > 0.01) pts.push(new THREE.Vector3(sx, 0.12, z2));
  return pts;
}
function startDirectTrip(r, from, to, label, onArrive, y = 0.12) {
  const pts = [from.clone().setY(y), ...plazaDetour(from, to).map(p => p.setY(y)), to.clone().setY(y)];
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
    startDirectTrip(r, r.mesh.position, v.pos, 'going to the vending machine', () => { r.state = 'inside'; r.trip = null; r.mesh.rotation.y = v.rot; r.activity = pick(VEND_ACTS); r.needs.food = Math.min(1, r.needs.food + 0.15); r.next = waitNext(rand(0.12, 0.2)); });
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
  r.at = u; u.inside.add(r); r.state = 'inside'; r.next = S.T; r.until = 0;
  const p = r.purpose; r.purpose = null;
  if (p === 'eat') { r.actKind = 'eat'; r.activity = pick(hourOf() < 10.5 ? BREAKFAST_ACTS : hourOf() < 15.5 ? LUNCH_ACTS : DINNER_ACTS); r.until = S.T + rand(0.5, 0.8); }
  else if (p === 'shop') { r.actKind = 'shop'; r.activity = pick(SHOP_ACTS); r.until = S.T + rand(0.4, 0.9); }
  else if (p === 'visit') { r.actKind = 'visit'; r.activity = pick(VISIT_ACTS); r.until = S.T + rand(0.8, 1.4); }
  else if (u === r.job) r.actKind = 'work';
  else if (u === r.home) r.actKind = 'home';
  if (r.movingIn && u === r.home) { r.movingIn = false; u.incoming = Math.max(0, u.incoming - 1); r.activity = 'unpacking boxes'; r.actKind = 'home'; r.next = S.T + rand(0.5, 1); if (r.hasCar) r.carAt = u; }   // the car arrives with the household
}
/** Lost their home (or their destination vanished): head back to the station and wait again. */
function returnToStation(r, fromPos) {
  r.home = null; r.movingIn = false; r.returnTo = null; r.until = 0; r.purpose = null; r.carAt = null; if (r.hh) r.hh.home = null;
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
  detachCharacter(r.mesh); peopleGroup.remove(r.mesh); disposeGroup(r.mesh); if (r.car) { peopleGroup.remove(r.car); disposeGroup(r.car); const ci = carMeshes.indexOf(r.car); if (ci >= 0) carMeshes.splice(ci, 1); }
  residents.splice(residents.indexOf(r), 1);
}

/** Rebuild a resident from saved data. Nobody is restored mid-trip: they start at home, on the plaza, or in the city. */
function restoreResident(d, hh, home, job) {
  const r = baseResident(d.name, hh); Object.assign(r, d, { hh, home: null, job: null, needs: { ...freshNeeds(), ...(d.needs || {}) }, needsT: S.T, next: S.T + rand(0.05, 0.5) });
  r.mesh = makePerson(r); residents.push(r); hh.members.push(r);
  if (job && job.staff.length < unitCap(job)) { r.job = job; job.staff.push(r); }
  if (home) {
    r.home = home; home.residents.push(r); r.at = home; home.inside.add(r); r.state = 'inside'; if (r.hasCar) r.carAt = home; r.actKind = hourOf() >= 22 || hourOf() < 5 ? 'sleep' : 'home'; r.activity = r.actKind === 'sleep' ? 'sleeping' : 'settling back in';
    r.mesh.visible = false; r.mesh.position.copy(unitPos(home));
  } else if (d.state === 'away') { r.state = 'away'; r.activity = 'staying in the city tonight'; r.mesh.visible = false; }
  else { r.at = STATION.anchor; STATION.anchor.inside.add(r); r.state = 'inside'; r.mesh.position.copy(STATION.entrance); if (takeSpot(r)) sitDown(r); else { r.mesh.visible = true; r.activity = 'waiting for a home'; } }
  return r;
}
/** a household record from a save; members attach through restoreResident */
function restoreHousehold(d, home) { const hh = { id: d.id, kind: d.kind, size: d.size, surname: d.surname, members: [], home }; households.push(hh); return hh; }

// ── trains ──
const trainListeners = [];
function onTrain(fn) { trainListeners.push(fn); }
let nextTrain = 7.4;
const arrivals = [];             // pending arrivals: { t, r } (r = a resident returning from the city, else a newcomer)
const nextTrainAt = () => nextTrain;
function updateStation() {
  if (S.T >= nextTrain) {
    const h = hourOf();
    if (h < 5.9) nextTrain = Math.floor(S.T / 24) * 24 + 6;
    else {
      const beds = u => Math.max(0, unitCap(u) - u.residents.length - u.incoming);
      const vacancies = blocks.filter(b => b.type === 'res' && b.stage === DONE).reduce((s, b) => s + b.units.reduce((t, u) => t + beds(u), 0), 0);
      const unbooked = r => !r.home && !(r.hh && r.hh.home && !r.hh.home.removed);
      const waiting = residents.filter(r => unbooked(r) && r.state !== 'away').length;
      const returning = h < 7 ? residents.filter(r => r.state === 'away') : [];   // night-trippers ride the first morning train only
      let room = Math.max(0, freeSpots() - arrivals.length - returning.length);
      let t = S.T + 0.03, total = 0;
      for (const r of returning) arrivals.push({ t: (t += 0.07), r });            // night-trippers come home first
      // households whose home is nearly finished ride together, whole households only
      for (let k = bookings.length - 1; k >= 0; k--) {
        const bk = bookings[k];
        if (!bk.hh.home || bk.hh.home.removed) { bookings.splice(k, 1); dropHousehold(bk.hh); continue; }
        if (h >= 21.5 || bk.hh.size > room) continue;
        bookings.splice(k, 1); room -= bk.hh.size; total += bk.hh.size;
        for (let m = 0; m < bk.hh.size; m++) arrivals.push({ t: (t += 0.07), r: null, hh: bk.hh });
      }
      // singles for beds that are already free (a removed home, an unfilled bed), minus those already here or en route
      const enRoute = arrivals.filter(a => !a.r && !a.hh).length;
      let n = Math.max(0, vacancies - waiting - enRoute);
      if (STATION.block.trains === 0 && n === 0 && total === 0) n = 1;            // one hopeful on the very first train
      if (h >= 21.5) n = 0;                                                        // nobody arrives just to leave again at 22:00
      n = Math.min(n, room, 4); total += n;
      for (const size of splitHouseholds(n)) { const hh = makeHousehold(size, null); for (let k = 0; k < size; k++) arrivals.push({ t: (t += 0.07), r: null, hh }); }
      STATION.block.trains++;
      for (const fn of trainListeners) fn(h);
      if (total > 0 && STATION.block.trains <= 2) toast(total === 1 ? 'A train pulled in. Someone is looking for a home.' : `A train pulled in. ${total} newcomers are looking for homes.`);
      nextTrain = h >= 22 ? Math.floor(S.T / 24) * 24 + 30 : S.T + 1.5;
    }
  }
  while (arrivals.length && S.T >= arrivals[0].t) { const a = arrivals.shift(); if (a.r) returnFromCity(a.r); else spawnNewcomer(a.hh || null); }
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
const isWaiting = r => !r.home && !r.movingIn && r.state === 'inside' && r.at === STATION.anchor;
/** households with at least one member waiting on the plaza */
function waitingHouseholds() { return households.filter(hh => hh.members.some(isWaiting)); }
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
function startTrip(r, cellPath, start, end, destUnit, label, from = null) {
  const drive = r.hasCar && cellPath.length > 6 && destUnit && destUnit !== STATION.anchor && from && from === r.carAt;
  if (drive) r.carAt = destUnit;   // the car will be parked at the destination
  if (drive) { if (Array.isArray(start)) start = start[start.length - 1]; if (Array.isArray(end)) end = end[0]; }   // cars stop at the kerb
  const pts = drive ? buildPoints(cellPath, start, end, 0.17, 0.08, -1) : buildPoints(cellPath, start, end, 0.34, 0.1);
  r.trip = { pts, i: 0, t: 0, dest: destUnit, drive, speed: drive ? 2.6 : 0.9 * rand(0.85, 1.15), baseY: drive ? 0.08 : 0.1 };
  if (!drive) setPose(r, false);
  r.state = drive ? 'driving' : 'walking'; r.activity = label;
  if (drive) { if (!r.car) r.car = makeCar(r.carColor, r.carKind); r.car.visible = true; r.mesh.visible = false; r.car.position.copy(pts[0]); }
  else { r.mesh.visible = true; r.mesh.position.copy(pts[0]); }
}
function go(r, dest, label, purpose = null) {
  const from = r.at; const path = routeUnits(from, dest);
  if (!path) { r.next = S.T + rand(0.4, 0.9); return false; }
  const start = from === STATION.anchor ? [r.mesh.position.clone().setY(0.12), ...plazaDetour(r.mesh.position, new THREE.Vector3(cx(path[0].i), 0, cz(path[0].j)))] : exitPts(from);
  if (from === STATION.anchor) freeSpot(r);
  from.inside.delete(r); r.at = null; r.purpose = purpose; r.until = 0; r.actKind = 'travel'; r.plan = label;
  startTrip(r, path, start, dest === STATION.anchor ? STATION.entrance : entryPts(dest), dest, label, from); return true;
}
function stroll(r) {
  const roads = cells.filter(c => c.type === 'road'); if (!roads.length) return false;
  const from = r.at; let path = null;
  for (let k = 0; k < 5 && !path; k++) { const t = pick(roads); path = routeCells(frontRoad(from), [t]); if (path && path.length < 3) path = null; }
  if (!path) return false;
  from.inside.delete(r); r.at = null; r.strollHome = true; r.actKind = 'stroll'; r.until = 0; r.purpose = null;
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
  if (tr.dest.block.type === 'shop' && tr.dest !== r.job) { tr.dest.block.visitScore += 1; }
}
function cellAt(p) { return cell(Math.floor(p.x + HALF), Math.floor(p.z + HALF)); }

const FOODIE = { cafe: 1, bakery: 0.9, ramen: 1.1, grocery: 0.5, konbini: 0.8, florist: 0.15, books: 0.25 };
const GROCER = { grocery: 1.2, konbini: 1.1, bakery: 0.7, florist: 0.6, books: 0.6, cafe: 0.4, ramen: 0.3 };
/** the best reachable shop for a purpose: weight by kind, discount by distance, add a little whim */
function pickShop(r, from, weights) {
  let best = null, bs = 0;
  for (const u of shopUnits()) {
    if (u === r.job) continue; const w = weights[u.block.kind] || 0.5; const p = routeUnits(from, u); if (!p) continue;
    const sc = w * (1 + Math.random() * 0.6) / (1 + p.length / 14); if (sc > bs) { bs = sc; best = u; }
  }
  return best;
}
function pickVisit(r) {
  const hosts = residents.filter(x => x.home && x.home !== r.home && x.hh !== r.hh && x.at === x.home && x.actKind !== 'sleep' && routeUnits(r.at, x.home));
  return hosts.length ? pick(hosts).home : null;
}
function stay(r, kind, label, dur) { r.actKind = kind; r.activity = label; r.plan = ''; r.next = S.T + dur; return true; }
function sleep(r) { r.plan = ''; const h = hourOf(), wakeT = Math.floor(S.T / 24) * 24 + r.wake + (h >= r.wake ? 24 : 0); r.actKind = 'sleep'; r.activity = 'sleeping'; r.next = wakeT + rand(0, 0.3); return true; }
function eatAtHome(r) {
  const h = hourOf(), meal = h < 10.5 ? 'breakfast' : h < 15 ? 'lunch' : 'dinner';
  const company = r.hh.members.some(m => m !== r && m.at === r.home && m.actKind !== 'sleep');
  return stay(r, 'eat', company ? `having ${meal} with ${r.hh.kind === 'flatmates' ? 'the flatmates' : r.hh.kind === 'couple' ? 'their partner' : 'the family'}` : meal === 'dinner' ? 'cooking dinner' : `having ${meal}`, rand(0.5, 0.8));
}
/**
 * Decisions are made when `r.next` comes round, never per frame: every option gets a score from how much
 * it answers the strongest need, whether the hour suits it, and a little randomness; the best one runs.
 */
function decide(r) {
  const h = hourOf(), day = dayOf(), u = r.at;
  if (!u) { r.next = S.T + 0.5; return; }
  if (u === STATION.anchor) { r.actKind = 'wait'; tickNeeds(r); waitDecide(r); return; }
  if (!r.home) { go(r, STATION.anchor, 'heading back to the station'); return; }
  tickNeeds(r);
  const n = r.needs, atHome = u === r.home, atWork = !!r.job && u === r.job, workHours = !!r.job && h >= r.workStart && h < r.workEnd;
  const night = h >= 22 || h < 5, shops = shopUnits().length > 0;
  if (!atHome && !atWork && r.until && S.T < r.until) { r.next = Math.min(r.until, S.T + 0.3); return; }   // a meal, a visit or a shop runs its course
  const opts = [];
  const add = (score, run) => opts.push({ score: score + Math.random() * 0.12, run });
  if (r.returnTo && workHours && !atWork) { const d = r.returnTo; add(1.7, () => { r.returnTo = null; return go(r, d, 'back to work'); }); }
  else r.returnTo = null;
  if (night || n.energy < 0.15 || (h >= 21 && n.energy < 0.5)) add((1 - n.energy) * 1.6 + (night ? 1.2 : 0.3), () => atHome ? sleep(r) : go(r, r.home, 'heading home to sleep'));
  if (workHours && !atWork && r.lastWorkDay !== day) add(1.5, () => { r.lastWorkDay = day; return go(r, r.job, 'heading to work'); });
  if (atWork && workHours) {
    add(1.25, () => stay(r, 'work', pick(u.block.type === 'shop' ? SHOP_STAFF_ACTS : WORK_ACTS), rand(0.5, 1.2)));
    if (h >= 11.5 && h < 13.5 && n.food < 0.55 && r.lunched !== day && shops) { const sh = pickShop(r, u, FOODIE); if (sh) add((1 - n.food) * 1.5 + 0.3, () => { r.lunched = day; r.returnTo = u; return go(r, sh, 'going for lunch', 'eat'); }); }
  }
  const mealTime = (h >= 6.5 && h < 9.5) || (h >= 11.5 && h < 14) || (h >= 17.5 && h < 20.5);
  if (atHome && n.food < 0.65 && (mealTime || n.food < 0.3)) add((1 - n.food) * 1.4 + (h >= 17.5 && r.hh.members.some(m => m !== r && m.at === u) ? 0.35 : 0), () => eatAtHome(r));
  if (!atWork && shops && n.food < 0.5 && ((h >= 11 && h < 14) || (h >= 17.5 && h < 20.5))) { const sh = pickShop(r, u, FOODIE); if (sh) add((1 - n.food) * 1.1 + 0.25 + (1 - n.fun) * 0.3, () => go(r, sh, pick(h < 10.5 ? ['going out for breakfast', 'off to the bakery'] : h < 15 ? ['going out for lunch', 'heading out to eat', 'off for a bite'] : ['going out for dinner', 'heading out to eat', 'off to the ramen shop']), 'eat')); }
  if (!atWork && shops && h >= 9 && h < 20 && n.supplies < 0.5) { const sh = pickShop(r, u, GROCER); if (sh) add((1 - n.supplies) * 1.3, () => go(r, sh, pick(['going shopping', 'popping out for groceries', 'off to the shops']), 'shop')); }
  if (!atWork && h >= 7 && h < 19 && n.fun < 0.7) add((1 - n.fun) * 0.9 + 0.15, () => stroll(r));
  if (!atWork && h >= 10 && h < 20.5 && n.social < 0.5) { const v = pickVisit(r); if (v) add((1 - n.social) * 1.15, () => go(r, v, `visiting ${v.block.name}`, 'visit')); }
  if (atHome) add(0.55 + n.fun * 0.2, () => stay(r, 'home', pick(HOME_ACTS), rand(0.6, 1.4)));
  else if (!(atWork && workHours)) add(0.5, () => go(r, r.home, 'heading home'));
  opts.sort((a, b) => b.score - a.score);
  for (const o of opts) if (o.run() !== false) return;
  r.next = S.T + rand(0.3, 0.8);
}

function moveAlong(obj, tr, dist) {
  const pts = tr.pts;
  while (dist > 0 && tr.i < pts.length - 1) {
    const a = pts[tr.i], b = pts[tr.i + 1], segLen = a.distanceTo(b) || 0.0001, remain = segLen - tr.t;
    if (dist < remain) { tr.t += dist; dist = 0; } else { dist -= remain; tr.i++; tr.t = 0; }
  }
  // trip points carry a height above the ground (kerb, doorstep); the ground itself comes from the terrain
  if (tr.i >= pts.length - 1) { const e = pts[pts.length - 1]; obj.position.set(e.x, e.y + terrainY(e.x, e.z), e.z); return true; }
  const a = pts[tr.i], b = pts[tr.i + 1], k = tr.t / (a.distanceTo(b) || 1);
  obj.position.lerpVectors(a, b, k); obj.position.y += terrainY(obj.position.x, obj.position.z);
  const ang = Math.atan2(b.x - a.x, b.z - a.z); let d = ang - obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); obj.rotation.y += d * 0.35;
  return false;
}
let frameNo = 0; const lodV = new THREE.Vector3();
/**
 * Walkers on screen move every frame with a bob; walkers off screen (or when zoomed right out) bank their
 * distance and move in one step every sixth frame. Decisions never run per frame (see decide()).
 */
function updateResidents(simDt, realT) {
  frameNo++;
  const farZoom = cam.view > 34;
  for (const r of residents) {
    if (r.state === 'away') continue;
    if (r.state === 'inside') {
      if (S.T >= r.next) decide(r);
      if (r.home && !r.job && S.T >= r.jobSearchAt) { findJob(r); r.jobSearchAt = S.T + rand(1.5, 3); }
      continue;
    }
    const tr = r.trip; if (!tr) { r.state = 'inside'; continue; }
    const obj = tr.drive ? r.car : r.mesh;
    if ((frameNo + r.id) % 20 === 0) { lodV.copy(obj.position).project(camera); r.far = farZoom || Math.abs(lodV.x) > 1.15 || Math.abs(lodV.y) > 1.15; }
    r.lodDist += tr.speed * simDt;
    if (r.far && (frameNo + r.id) % 6 !== 0) continue;
    const done = moveAlong(obj, tr, r.lodDist); r.lodDist = 0;
    if (!tr.drive && !r.far && !r.mesh.userData.char) r.mesh.position.y += Math.abs(Math.sin(realT * 9 + r.phase)) * 0.018 * Math.min(1, S.speed);
    if (done) arrive(r);
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
    if (w.kind === 'cat') w.mesh.position.y = terrainY(w.mesh.position.x, w.mesh.position.z) + 0.1 + Math.abs(Math.sin(performance.now() * 0.012)) * 0.01;
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
      if (b.type === 'res' && b.stage === DONE - 1 && !b.summoned) { b.summoned = true; for (const u of b.units) for (const size of splitHouseholds(unitCap(u))) bookings.push({ hh: makeHousehold(size, u) }); }
      if (b.stageT >= stageHours(b)[b.stage]) { b.stage++; b.stageT = 0; for (const u of b.units) rebuildUnitMesh(u, true); if (b.stage === DONE) toast(`${b.name} is finished`); }
      continue;
    }
    if (b.renoT > 0) { b.renoT -= dh; if (b.renoT <= 0) { b.renoT = 0; for (const u of b.units) rebuildUnitMesh(u); } }
    let occ = 0;
    if (b.type === 'res') {
      let n = 0, capSum = 0;
      for (const u of b.units) {
        const cap = unitCap(u); capSum += cap; n += u.residents.length;
        const free = cap - u.residents.length - u.incoming;
        if (free > 0 && S.T - u.lastMoveIn > 0.3) {
          // the household booked for this home first, then any waiting household that fits
          const list = waitingHouseholds();
          let hh = list.find(x => x.home === u) || list.find(x => (!x.home || x.home.removed) && x.members.filter(isWaiting).length <= free);
          if (!hh) { const old = list.find(x => (!x.home || x.home.removed) && x.members.some(m => isWaiting(m) && S.T - m.arrivedT > 3)); if (old) hh = splitOff(old, old.members.filter(isWaiting).slice(0, free)); }
          if (hh) { hh.home = u; u.lastMoveIn = S.T; for (const r of hh.members.filter(isWaiting).slice(0, free)) assignHome(r, u); }
        }
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
      u.residents.splice(u.residents.indexOf(r), 1); r.home = null; r.hh.home = null; r.until = 0; r.purpose = null; r.carAt = null;
      if (r.at === u) { u.inside.delete(r); r.at = null; returnToStation(r, unitPos(u)); }
      else if (r.state === 'inside' && r.at) r.next = S.T;           // decide() will send them to the station
      else if (r.trip && r.trip.dest === u) { /* arrive() notices u.removed */ }
      else r.movingIn = false;
    }
    for (const r of Array.from(u.inside)) { if (r.carAt === u) r.carAt = r.home; if (r.at === u) { u.inside.delete(r); r.at = null; if (r.home) { const roads = roadNeighbors(u.cell); const path = roads.length ? routeCells(roads, frontRoad(r.home)) : null; if (path) startTrip(r, path, new THREE.Vector3(cx(roads[0].i), 0, cz(roads[0].j)), unitPos(r.home), r.home, 'heading home'); else { r.at = r.home; r.home.inside.add(r); } } else returnToStation(r, unitPos(u)); } }
    if (u.mesh) { townGroup.remove(u.mesh); disposeGroup(u.mesh); }
    u.cell.type = 'empty'; u.cell.block = null; u.cell.unit = null; units.delete(u.id);
  }
  blocks.splice(blocks.indexOf(block), 1);
  for (const c of cells) if (c.type === 'road' && !c.keep && !lotAdjacent8(c)) { c.type = 'empty'; if (hash(c.j, c.i) < 0.18) c.tree = treeSpec(c.i, c.j); }
  refreshWorld();
}

onWorldChange(() => { pathCache.clear(); for (const w of wanderers) if (w.cell && w.cell.type !== 'road') w.dead = true; });   // a street built over sends its traffic away

export { HPS, hourOf, dayOf, daylight, routeCells, routeUnits, carMeshes, residents, wanderers, shopUnits, jobUnits, households, hhName, hhLabel, moodWords, restoreResident, restoreHousehold,
  updateResidents, updateWanderers, updateBlocks, growthAllowed, removeBlock, nextTrainAt, spawnNewcomer, removeResident,
  roadNeighbors, frontRoad, buildPoints, makePerson, makeCar, moveAlong, unitPos, setProgressRate, onTrain };
