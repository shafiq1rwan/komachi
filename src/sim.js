// Komachi — simulation: time, road routing, residents and their schedules, ambient traffic, block lifecycle
import * as THREE from 'three';
import { GIVEN, FAMILY, SKIN, SHIRTS, HAIR, CARS } from './palette.js';
import { rand, pick, clamp, smooth, hash } from './utils.js';
import { S } from './state.js';
import { N, HALF, cx, cz, townGroup, peopleGroup, disposeGroup, cam, camera } from './scene.js';
import { createCat, updateCat, CAT_COATS } from './cats.js';
import { createDog, updateDog, DOG_COATS } from './dogs.js';
import { attachCharacter, detachCharacter } from './characters.js';
import { attachVehicle } from './vehicles.js';
import { cells, cell, DIR4, treeSpec, lotAdjacent8, blocks, units, DONE, stageHours, unitCap, refreshWorld, onWorldChange, STATION, terrainY, connectHillRoads, connectCanal, hill, openHill, HILL_UNLOCK, signalRed, updateSignals } from './world.js';
import { bicycle } from './kit.js';
import { unitLocal } from './buildings.js';
import { mergeMesh } from './geometry.js';
import { rebuildUnitMesh, unitDoorPoints } from './buildings.js';
import { toast } from './toast.js';

// ───────────────────────────── time ─────────────────────────────
const HPS = 0.1;                // game hours per real second at 1×  (one day ≈ 4 min)
const hourOf = () => S.T % 24, dayOf = () => Math.floor(S.T / 24) + 1;
function daylight() { const h = hourOf(); return smooth((h - 5.5) / 1.5) * smooth((19.5 - h) / 1.5); }

// ───────────────────────────── routing over roads ─────────────────────────────
const pathCache = new Map();
const bfsParent = new Int32Array(N * N), bfsQueue = new Int32Array(N * N);
/** can traffic pass from road cell a to its neighbour b (stepping di, dj)? Same height, or along a slope road's axis. */
function roadLinked(a, b, di, dj) {
  const r = a.ramp || b.ramp;
  if (!r) return Math.abs((a.h || 0) - (b.h || 0)) < 1e-6;
  if (a.ramp && b.ramp) return false;
  if (di !== r.di && di !== -r.di || dj !== r.dj && dj !== -r.dj) return false;   // only along the slope
  const ramp = a.ramp ? a : b, other = a.ramp ? b : a, up = a.ramp ? (di === r.di && dj === r.dj) : (di === -r.di && dj === -r.dj);
  return Math.abs((other.h || 0) - (up ? r.h1 : r.h0)) < 1e-6 && !!ramp;
}
function roadNeighbors(c) { const out = []; for (const [di, dj] of DIR4) { const n = cell(c.i + di, c.j + dj); if (n && n.type === 'road' && roadLinked(c, n, di, dj)) out.push(n); } return out; }
function routeCells(srcs, dsts) {
  if (!srcs.length || !dsts.length) return null;
  bfsParent.fill(-1); const target = new Set(dsts.map(c => c.j * N + c.i));
  let qh = 0, qt = 0;
  for (const s of srcs) { const k = s.j * N + s.i; if (bfsParent[k] === -1) { bfsParent[k] = k; bfsQueue[qt++] = k; } }
  while (qh < qt) {
    const k = bfsQueue[qh++];
    if (target.has(k)) { const path = []; let cur = k; while (true) { path.push(cells[cur]); if (bfsParent[cur] === cur) break; cur = bfsParent[cur]; } return path.reverse(); }
    const i = k % N, j = (k - i) / N;
    const c0 = cells[k];
    for (const [di, dj] of DIR4) { const n = cell(i + di, j + dj); if (!n || n.type !== 'road' || !roadLinked(c0, n, di, dj)) continue; const nk = n.j * N + n.i; if (bfsParent[nk] !== -1) continue; bfsParent[nk] = k; bfsQueue[qt++] = nk; }
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
/** a vehicle group whose forward is +z: the Car Kit model when loaded, a box car until then (see vehicles.js) */
function makeCar(color, kind = 'kei') {
  const grp = new THREE.Group(); attachVehicle(grp, color, kind);
  carMeshes.push(grp); grp.visible = false; peopleGroup.add(grp); return grp;
}
function makeCat(color) {
  const grp = createCat(color); peopleGroup.add(grp); return grp;
}
function makeDog(color) {
  const grp = createDog(color); peopleGroup.add(grp); return grp;
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
    wake, workStart: clamp(wake + rand(0.5, 1.5), 7, 10.5), workEnd: rand(16.5, 18.5), hasCar: Math.random() < 0.35, hasBike: false, lastWorkDay: -1, lunched: -1, returnTo: null, until: 0, purpose: null, jobSearchAt: S.T + rand(0.2, 1),
    needs: freshNeeds(), needsT: S.T, actKind: 'wait', far: false, lodDist: 0, carAt: null, bikeAt: null, bike: null, commuter: false, returnAt: 0,
    skin: pick(SKIN), shirt: pick(SHIRTS), pants: pick(['#6b6f7a', '#8a7a6f', '#4a4340', '#9aa4aa', '#7f9b7a']), hair: pick(HAIR), hat: Math.random() < 0.3, hatColor: pick(SHIRTS), bag: Math.random() < 0.45, bagColor: pick(['#4a4340', '#a3764a', '#d98b7a', '#6f9a96']),
    trip: null, mesh: null, car: null, carColor: pick(CARS), carKind: pick(['kei', 'kei', 'hatch', 'hatch', 'suv', 'van']), phase: rand(0, 6.28), spot: null, vendingAt: null, movingIn: false, arrivedDay: dayOf(), arrivedT: S.T,
  };
}

// ── newcomers: everyone arrives by underground train and waits at the station until a home has room ──
function spawnNewcomer(hh = null) {
  if (!hh) hh = makeHousehold(1, null);
  const r = baseResident(`${pick(GIVEN)} ${hh.kind === 'flatmates' ? pick(FAMILY) : hh.surname}`, hh);
  hh.members.push(r);
  r.hasBike = !r.hasCar && Math.random() < 0.45;
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
// ── taxis: two wait at a rank on the plaza's south edge; a household moving to a far home rides together ──
const taxis = [];
function makeTaxis() {
  for (const side of [-0.3, 0.3]) {
    const mesh = makeCar('#e8cf7a', 'taxi'); const t = { mesh, state: 'rank', passengers: [], dest: null, trip: null, departAt: 0, slot: side };
    parkTaxi(t); taxis.push(t);
  }
}
function parkTaxi(t) { const p = unitLocal(STATION.anchor, t.slot, 0.22, 0.12); t.mesh.position.copy(p); t.mesh.rotation.set(0, 0, 0); t.mesh.visible = true; t.mesh.userData.parked = true; t.state = 'rank'; t.dest = null; t.trip = null; }
function boardTaxi(r, u, path) {
  let t = taxis.find(t => t.state === 'boarding' && t.dest === u && t.passengers.length < 3) || taxis.find(t => t.state === 'rank');
  if (!t) return false;
  if (t.state === 'rank') { t.state = 'boarding'; t.dest = u; t.path = path; t.departAt = S.T + 0.06; }
  t.passengers.push(r); r.taxi = t; r.state = 'riding'; r.activity = 'taking a taxi home'; r.trip = null; r.mesh.visible = false; return true;
}
function updateTaxis(simDt) {
  if (!taxis.length && STATION.anchor) makeTaxis();
  for (const t of taxis) {
    if (t.state === 'boarding' && S.T >= t.departAt) {
      const pts = buildPoints(t.path, t.mesh.position.clone(), entryPts(t.dest)[0], 0.17, 0.08, -1);
      t.trip = { pts, i: 0, t: 0, speed: 2.4 }; t.state = 'out'; t.mesh.userData.parked = false;
    } else if (t.state === 'out' || t.state === 'back') {
      if (!moveAlong(t.mesh, t.trip, t.trip.speed * simDt * trafficFactor(t.mesh))) continue;
      if (t.state === 'out') {
        const kerb = t.trip.pts[t.trip.pts.length - 1];
        for (const r of t.passengers) { r.taxi = null; r.mesh.position.copy(kerb); r.state = 'walking'; if (t.dest.removed) returnToStation(r, kerb); else enterUnit(r, t.dest); }
        t.passengers.length = 0;
        const back = routeCells(frontRoad(t.dest), roadNeighbors(STATION.anchor.cell));
        if (!back) { parkTaxi(t); continue; }
        const rank = unitLocal(STATION.anchor, t.slot, 0.22, 0.12);
        t.trip = { pts: buildPoints(back, kerb.clone(), [rank], 0.17, 0.08, -1), i: 0, t: 0, speed: 2.4 }; t.state = 'back';
      } else parkTaxi(t);
    }
  }
}
function assignHome(r, u) {
  r.home = u; u.residents.push(r); u.incoming++; r.movingIn = true; r.jobSearchAt = S.T + rand(0.3, 1);
  freeSpot(r); if (r.at) r.at.inside.delete(r); r.at = null;
  const start = r.mesh.position.clone().setY(0);
  const path = routeCells(roadNeighbors(STATION.anchor.cell), frontRoad(u));
  if (path && path.length >= 7 && boardTaxi(r, u, path)) return;   // a long way to go: take a taxi from the rank
  if (path) startTrip(r, path, start, entryPts(u), u, 'moving into a new home');
  else startDirectTrip(r, start, exitPts(u)[0], 'moving in the long way round', () => enterUnit(r, u), 0.06);   // no road yet: cut across the grass
}
// ── parking: a resident's car or bike waits on the plot beside the building while they are inside ──
const PARK_SLOTS = [[0.33, 0.2], [-0.33, 0.2], [0.33, -0.22], [-0.33, -0.22]];
function parkVehicle(mesh, u, kind) {
  const used = new Set(residents.filter(x => (kind === 'car' ? x.car : x.bike) && (kind === 'car' ? x.car : x.bike) !== mesh && (kind === 'car' ? x.carAt : x.bikeAt) === u && (kind === 'car' ? x.car : x.bike).userData.slot !== undefined).map(x => (kind === 'car' ? x.car : x.bike).userData.slot));
  let slot = PARK_SLOTS.findIndex((_, k) => !used.has(k)); if (slot < 0) slot = 0;
  const [lx, lz] = PARK_SLOTS[slot], p = unitLocal(u, lx * (kind === 'bike' ? 1.15 : 1), lz, 0.12);
  mesh.position.set(p.x, 0.12 + (u.cell.h || 0), p.z); mesh.rotation.set(0, (u.facing || 0) + (kind === 'bike' ? Math.PI / 2 : 0), 0);
  mesh.visible = true; mesh.userData.parked = true; mesh.userData.slot = slot;
}
function makeBike(r) {
  const g = []; bicycle(g, 0, 0, 0, r.carColor); const m = mergeMesh(g, false); m.castShadow = true;
  const grp = new THREE.Group(); grp.add(m); grp.userData.lights = null; grp.visible = false; peopleGroup.add(grp); return grp;
}
function enterUnit(r, u) {
  r.trip = null; r.mesh.visible = false;
  if (r.car && r.carAt === u && !u.removed) parkVehicle(r.car, u, 'car'); else if (r.car) r.car.visible = false;
  if (r.bike && r.bikeAt === u && !u.removed) parkVehicle(r.bike, u, 'bike'); else if (r.bike) r.bike.visible = false;
  if (u.removed) { returnToStation(r, r.mesh.position); return; }
  r.at = u; u.inside.add(r); r.state = 'inside'; r.next = S.T; r.until = 0;
  const p = r.purpose; r.purpose = null;
  if (p === 'eat') { r.actKind = 'eat'; r.activity = pick(hourOf() < 10.5 ? BREAKFAST_ACTS : hourOf() < 15.5 ? LUNCH_ACTS : DINNER_ACTS); r.until = S.T + rand(0.5, 0.8); }
  else if (p === 'shop') { r.actKind = 'shop'; r.activity = pick(SHOP_ACTS); r.until = S.T + rand(0.4, 0.9); }
  else if (p === 'visit') { r.actKind = 'visit'; r.activity = pick(VISIT_ACTS); r.until = S.T + rand(0.8, 1.4); }
  else if (u === r.job) r.actKind = 'work';
  else if (u === r.home) r.actKind = 'home';
  if (r.movingIn && u === r.home) {   // the car or bike arrives with the household
    r.movingIn = false; u.incoming = Math.max(0, u.incoming - 1); r.activity = 'unpacking boxes'; r.actKind = 'home'; r.next = S.T + rand(0.5, 1);
    if (!r.commuter && Math.random() < 0.25) { r.commuter = true; r.workStart = rand(7, 8.6); r.workEnd = rand(17.2, 19); }   // a quarter keep a job in the city and commute by train
    if (r.hasCar) { r.carAt = u; if (!r.car) r.car = makeCar(r.carColor, r.carKind); parkVehicle(r.car, u, 'car'); }
    if (r.hasBike) { r.bikeAt = u; if (!r.bike) r.bike = makeBike(r); parkVehicle(r.bike, u, 'bike'); }
  }
}
/** Lost their home (or their destination vanished): head back to the station and wait again. */
function returnToStation(r, fromPos) {
  r.home = null; r.movingIn = false; r.returnTo = null; r.until = 0; r.purpose = null; r.carAt = null; r.bikeAt = null; r.commuter = false; if (r.car) r.car.visible = false; if (r.bike) r.bike.visible = false; if (r.hh) r.hh.home = null;
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
  if (r.taxi) { const i = r.taxi.passengers.indexOf(r); if (i >= 0) r.taxi.passengers.splice(i, 1); r.taxi = null; }
  if (r.job) { r.job.staff.splice(r.job.staff.indexOf(r), 1); }
  if (r.home) r.home.residents.splice(r.home.residents.indexOf(r), 1);
  detachCharacter(r.mesh); peopleGroup.remove(r.mesh); disposeGroup(r.mesh); if (r.car) { peopleGroup.remove(r.car); disposeGroup(r.car); const ci = carMeshes.indexOf(r.car); if (ci >= 0) carMeshes.splice(ci, 1); } if (r.bike) { peopleGroup.remove(r.bike); disposeGroup(r.bike); }
  residents.splice(residents.indexOf(r), 1);
}

/** Rebuild a resident from saved data. Nobody is restored mid-trip: they start at home, on the plaza, or in the city. */
function restoreResident(d, hh, home, job) {
  const r = baseResident(d.name, hh); Object.assign(r, d, { hh, home: null, job: null, needs: { ...freshNeeds(), ...(d.needs || {}) }, needsT: S.T, next: S.T + rand(0.05, 0.5) });
  r.mesh = makePerson(r); residents.push(r); hh.members.push(r);
  if (job && job.staff.length < unitCap(job)) { r.job = job; job.staff.push(r); }
  if (home) {
    r.home = home; home.residents.push(r); r.at = home; home.inside.add(r); r.state = 'inside';
    if (r.hasCar) { r.carAt = home; r.car = makeCar(r.carColor, r.carKind); parkVehicle(r.car, home, 'car'); }
    if (r.hasBike) { r.bikeAt = home; r.bike = makeBike(r); parkVehicle(r.bike, home, 'bike'); } r.actKind = hourOf() >= 22 || hourOf() < 5 ? 'sleep' : 'home'; r.activity = r.actKind === 'sleep' ? 'sleeping' : 'settling back in';
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
      // night-trippers ride the first morning train; commuters come home on the first train after their day ends
      const returning = residents.filter(r => r.state === 'away' && !arrivals.some(a => a.r === r) && (r.home ? S.T >= r.returnAt : h < 7));
      let room = Math.max(0, freeSpots() - arrivals.length - returning.filter(r => !r.home).length);
      let t = S.T + 0.03, total = 0;
      for (const r of returning) arrivals.push({ t: (t += 0.05), r });            // returners step off first
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
      // a hopeful now and then even when every bed is taken: someone visibly looking for a home keeps the plaza alive
      if (n === 0 && total === 0 && waiting + enRoute < 2 && h >= 6 && h < 20 && Math.random() < 0.6) n = 1;
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
  r.needsT = S.T;   // the day away is not charged to their needs all at once
  if (r.home) {
    r.needs.food = Math.max(0.15, r.needs.food - 0.35); r.needs.energy = Math.max(0.2, r.needs.energy - 0.3); r.purpose = null;
    // most of them catch their breath on the plaza first: a bench, the planters, a drink, and then the walk home
    if (Math.random() < 0.7 && takeSpot(r)) { startDirectTrip(r, STATION.entrance, r.spot.pos.clone().setY(0.12), 'back from the city', () => restAtStation(r, pick(PLAZA_ACTS), S.T + rand(0.12, 0.35))); return; }
    r.activity = 'back from the city'; r.next = S.T + 0.02; return;
  }
  if (takeSpot(r)) startDirectTrip(r, STATION.entrance, r.spot.pos.clone().setY(0.12), 'back from the city', () => sitDown(r));
  else { r.activity = 'waiting for a home'; r.next = S.T + 0.5; }
}
const PLAZA_ACTS = ['stretching after the ride', 'waiting for a neighbour off the same train', 'checking messages before the walk home', 'catching their breath on the bench', 'watching the plaza for a while'];
/** someone with a home pausing on a station spot (a commuter waiting for the train, or just off it) */
function restAtStation(r, activity, next) {
  const s = r.spot; if (!s) { r.state = 'inside'; r.next = S.T; return; }
  r.mesh.visible = true; r.mesh.position.copy(s.pos); r.mesh.rotation.y = s.rot; setPose(r, s.kind === 'seat');
  r.state = 'inside'; r.trip = null; r.activity = activity; r.next = next;
}
/** down to the platform and away to the city until the evening */
function departForCity(r) {
  freeSpot(r); if (r.at) r.at.inside.delete(r);
  r.purpose = null; r.mesh.visible = false; r.state = 'away'; r.actKind = 'work'; r.activity = 'at work in the city'; r.at = null; r.trip = null;
  r.returnAt = Math.floor(S.T / 24) * 24 + r.workEnd; r.next = r.returnAt;
}
const isWaiting = r => !r.home && !r.movingIn && r.state === 'inside' && r.at === STATION.anchor;
/** households with at least one member waiting on the plaza */
function waitingHouseholds() { return households.filter(hh => hh.members.some(isWaiting)); }
const shopUnits = () => blocks.filter(b => b.type === 'shop' && b.stage === DONE).flatMap(b => b.units);
const jobUnits = () => blocks.filter(b => (b.type === 'work' || b.type === 'shop') && b.stage === DONE).flatMap(b => b.units);
function findJob(r) {
  let best = null, bestLen = 1e9;
  if (r.commuter) return;
  for (const u of jobUnits()) {
    if (u.staff.length >= unitCap(u)) continue;
    const p = routeUnits(r.home, u); if (!p) continue;
    const len = p.length + (u.block.type === 'shop' ? 2 : 0) + Math.random() * 3;
    if (len < bestLen) { bestLen = len; best = u; }
  }
  if (best) { r.job = best; best.staff.push(r); }
  else if (!r.commuter && Math.random() < 0.35) { r.commuter = true; r.workStart = rand(7, 8.6); r.workEnd = rand(17.2, 19); }   // no work in town: take the train to the city instead
}
function startTrip(r, cellPath, start, end, destUnit, label, from = null) {
  const toUnit = destUnit && destUnit !== STATION.anchor;
  const drive = r.hasCar && cellPath.length > 6 && toUnit && from && from === r.carAt;
  const ride = !drive && r.hasBike && cellPath.length > 3 && toUnit && from && from === r.bikeAt;
  const kerbEnd = Array.isArray(end) ? end[0] : end, kerbStart = Array.isArray(start) ? start[start.length - 1] : start;
  if (drive) { r.carAt = destUnit; if (!r.car) r.car = makeCar(r.carColor, r.carKind); start = r.car.userData.parked ? [r.car.position.clone(), kerbStart] : kerbStart; end = kerbEnd; }   // from the parking spot to the kerb, then the road
  if (ride) { r.bikeAt = destUnit; if (!r.bike) r.bike = makeBike(r); start = r.bike.userData.parked ? [r.bike.position.clone(), kerbStart] : kerbStart; end = kerbEnd; }
  const pts = drive ? buildPoints(cellPath, start, end, 0.17, 0.08, -1) : ride ? buildPoints(cellPath, start, end, 0.27, 0.08, -1) : buildPoints(cellPath, start, end, 0.34, 0.1);
  r.trip = { pts, i: 0, t: 0, dest: destUnit, drive, ride, speed: drive ? 2.6 : ride ? 1.7 : 0.9 * rand(0.85, 1.15), baseY: drive || ride ? 0.08 : 0.1 };
  setPose(r, ride);
  r.state = drive ? 'driving' : 'walking'; r.activity = label;
  if (drive) { r.car.visible = true; r.car.userData.parked = false; r.mesh.visible = false; r.car.position.copy(pts[0]); }
  else if (ride) { r.bike.visible = true; r.bike.userData.parked = false; r.bike.position.copy(pts[0]); r.mesh.visible = true; }
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
  if (tr.dest === STATION.anchor && r.purpose === 'commute') {   // the train is due soon: wait for it on the plaza; otherwise straight down to the platform
    if (nextTrain - S.T < 0.6 && takeSpot(r)) {
      r.at = STATION.anchor; STATION.anchor.inside.add(r); r.mesh.position.copy(endPos);
      const at = nextTrain; startDirectTrip(r, endPos, r.spot.pos.clone().setY(0.12), 'waiting for the train', () => restAtStation(r, 'waiting for the train', at)); return;
    }
    departForCity(r); return;
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
  if (u === STATION.anchor && !r.home) { r.actKind = 'wait'; tickNeeds(r); waitDecide(r); return; }
  if (u === STATION.anchor && r.purpose === 'commute') { departForCity(r); return; }   // the train they were waiting for has pulled in
  if (!r.home) { go(r, STATION.anchor, 'heading back to the station'); return; }
  tickNeeds(r);
  if (u === STATION.anchor) {   // just off the train: home, or a bite first
    const sh = shopUnits().length && r.needs.food < 0.35 && h < 20.5 ? pickShop(r, u, FOODIE) : null;
    if (sh && go(r, sh, 'grabbing a bite on the way home', 'eat')) return;
    if (!go(r, r.home, 'heading home from the train')) r.next = S.T + 0.3; return;
  }
  if (r.commuter && !r.job && r.lastWorkDay !== day && h >= r.workStart && h < r.workStart + 2.5) {
    r.lastWorkDay = day; if (go(r, STATION.anchor, 'off to catch the train', 'commute')) return;
  }
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

// ── traffic: a vehicle slows for another one close ahead in its own lane (same heading, small side offset) ──
const tfFwd = new THREE.Vector3(), tfRel = new THREE.Vector3();
function trafficFactor(obj) {
  let f = 1; tfFwd.set(Math.sin(obj.rotation.y), 0, Math.cos(obj.rotation.y));
  updateSignals();   // lights follow game time, so they also cycle inside fastForward
  // a red light: stop short of the junction cell ahead (a car already inside it carries on)
  const here = cellAt(obj.position), aheadCell = cell(Math.floor(obj.position.x + tfFwd.x * 0.6 + HALF), Math.floor(obj.position.z + tfFwd.z * 0.6 + HALF));
  if (aheadCell && aheadCell !== here && signalRed(aheadCell, Math.abs(tfFwd.x) > Math.abs(tfFwd.z) ? 'ew' : 'ns')) {
    const ahead = (cx(aheadCell.i) - obj.position.x) * tfFwd.x + (cz(aheadCell.j) - obj.position.z) * tfFwd.z;   // distance to the junction's centre
    f = Math.min(f, clamp((ahead - 0.74) / 0.14, 0, 1));
  }
  for (const v of carMeshes) {
    if (v === obj || !v.visible || v.userData.parked) continue;
    tfRel.subVectors(v.position, obj.position); tfRel.y = 0;
    const ahead = tfRel.dot(tfFwd); if (ahead <= 0.05 || ahead > 1.1) continue;
    const cross = tfRel.x * tfFwd.z - tfRel.z * tfFwd.x, side = Math.abs(cross);
    const same = Math.sin(v.rotation.y) * tfFwd.x + Math.cos(v.rotation.y) * tfFwd.z;
    if (same > 0.3) { if (side <= 0.18) f = Math.min(f, clamp((ahead - 0.74) / 0.25, 0, 1)); }   // a queue: about a quarter of a car length between bumpers          // a queue: hold back from the car in front
    else if (same > -0.3 && side <= 0.4 && cross > 0) f = Math.min(f, clamp((ahead - 0.55) / 0.2, 0, 1));   // a junction: give way to a car crossing from the left (never mutual, so no deadlock)
  }
  return f;
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
  if (obj.userData.lights) {   // vehicles pitch nose-up on a slope (walkers stay upright)
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
    const yA = terrainY(obj.position.x - ux * 0.15, obj.position.z - uz * 0.15), yB = terrainY(obj.position.x + ux * 0.15, obj.position.z + uz * 0.15);
    obj.rotation.order = 'YXZ'; obj.rotation.x += (-Math.atan2(yB - yA, 0.3) - obj.rotation.x) * 0.3;
  }
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
  updateTaxis(simDt);
  for (const r of residents) {
    if (r.state === 'away' || r.state === 'riding') continue;
    if (r.state === 'inside') {
      if (S.T >= r.next) decide(r);
      if (r.home && !r.job && S.T >= r.jobSearchAt) { findJob(r); r.jobSearchAt = S.T + rand(1.5, 3); }
      continue;
    }
    const tr = r.trip; if (!tr) { r.state = 'inside'; continue; }
    const obj = tr.drive ? r.car : tr.ride ? r.bike : r.mesh;
    if ((frameNo + r.id) % 20 === 0) { lodV.copy(obj.position).project(camera); r.far = farZoom || Math.abs(lodV.x) > 1.15 || Math.abs(lodV.y) > 1.15; }
    r.lodDist += tr.speed * simDt;
    if (r.far && (frameNo + r.id) % 6 !== 0) continue;
    if (tr.drive) r.lodDist *= trafficFactor(obj);
    const done = moveAlong(obj, tr, r.lodDist); r.lodDist = 0;
    if (tr.ride) { r.mesh.position.copy(r.bike.position); r.mesh.position.y += 0.1; r.mesh.rotation.y = r.bike.rotation.y; }   // the rider sits on the bike
    else if (!tr.drive && !r.far && !r.mesh.userData.char) r.mesh.position.y += Math.abs(Math.sin(realT * 9 + r.phase)) * 0.018 * Math.min(1, S.speed);
    if (done) arrive(r);
  }
}

// ───────────────────────────── ambient wanderers (cars, cats & neighbourhood Shibas) ─────────────────────────────
function roadCellsList() { return cells.filter(c => c.type === 'road'); }
function spawnWanderer(kind) {
  const roads = roadCellsList(); if (!roads.length) return;
  const c = pick(roads);
  if (kind === 'car' && carMeshes.some(m => m.visible && Math.hypot(m.position.x - cx(c.i), m.position.z - cz(c.j)) < 0.6)) return;   // do not spawn onto another car
  const mesh = kind === 'car' ? makeCar(pick(CARS), pick(['kei', 'van', 'truck', 'truck', 'taxi', 'hatch', 'suv', 'delivery'])) : kind === 'dog' ? makeDog(pick(DOG_COATS)) : makeCat(pick(CAT_COATS));
  const w = { kind, cell: c, mesh, trip: null, pause: 0, dead: false };
  w.mesh.visible = true; w.mesh.position.set(cx(c.i), (c.h || 0) + (kind === 'car' ? 0.08 : 0.1), cz(c.j)); wanderers.push(w);
}
function wanderPick(w) {
  const roads = roadCellsList(); for (let k = 0; k < 6; k++) {
    const t = pick(roads); if (t === w.cell) continue; const path = routeCells([w.cell], [t]); if (!path || path.length < 3) continue;
    const y = w.kind === 'car' ? 0.08 : 0.1, side = w.kind === 'car' ? 0.17 : 0.36;
    const pts = buildPoints(path, w.mesh.position.clone().setY(y), new THREE.Vector3(cx(t.i), y, cz(t.j)), side, y, w.kind === 'car' ? -1 : (w.lane || (w.lane = Math.random() < 0.5 ? 1 : -1))); pts.pop();
    w.trip = { pts, i: 0, t: 0, speed: w.kind === 'car' ? rand(2.0, 2.8) : w.kind === 'dog' ? rand(.38, .56) : rand(0.35, 0.6), last: t }; return;
  }
  w.pause = rand(1, 4);
}
function updateWanderers(simDt) {
  const R = roadCellsList().length;
  const wantCars = Math.min(8, Math.floor(R / 16)), wantCats = Math.min(4, Math.floor(R / 22)), wantDogs = Math.min(2, Math.floor(R / 50));
  const cars = wanderers.filter(w => w.kind === 'car'), cats = wanderers.filter(w => w.kind === 'cat'), dogs = wanderers.filter(w => w.kind === 'dog');
  if (cars.length < wantCars) spawnWanderer('car'); if (cats.length < wantCats) spawnWanderer('cat'); if (dogs.length < wantDogs) spawnWanderer('dog');
  for (let k = wanderers.length - 1; k >= 0; k--) {
    const w = wanderers[k];
    const excess = (w.kind === 'car' && cars.length > wantCars) || (w.kind === 'cat' && cats.length > wantCats) || (w.kind === 'dog' && dogs.length > wantDogs);
    if (w.dead || (excess && !w.trip)) { peopleGroup.remove(w.mesh); disposeGroup(w.mesh); const ci = carMeshes.indexOf(w.mesh); if (ci >= 0) carMeshes.splice(ci, 1); wanderers.splice(k, 1); continue; }
    if (w.kind === 'cat') updateCat(w.mesh, simDt, w.pause <= 0 && !!w.trip);
    if (w.kind === 'dog') updateDog(w.mesh, simDt, w.pause <= 0 && !!w.trip, w.pause > 3, w.pause > 0 && w.pause <= 3);
    if (w.pause > 0) { w.pause -= simDt; continue; }
    if (!w.trip) { wanderPick(w); continue; }
    if (moveAlong(w.mesh, w.trip, w.trip.speed * simDt * (w.kind === 'car' ? trafficFactor(w.mesh) : 1))) { w.cell = w.trip.last; w.trip = null; w.pause = w.kind === 'cat' ? rand(2, 8) : w.kind === 'dog' ? rand(2, 7) : rand(0.2, 1.5); }
    if (w.kind === 'cat') { w.mesh.position.y = terrainY(w.mesh.position.x, w.mesh.position.z) + 0.1; if (!w.trip) updateCat(w.mesh, 0, false); }
    if (w.kind === 'dog') w.mesh.position.y = terrainY(w.mesh.position.x, w.mesh.position.z) + .1;
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
  if (!hill.open && residents.filter(r => r.home).length >= HILL_UNLOCK) openHill();
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
      else if (r.state === 'riding') { /* the taxi notices u.removed on arrival */ }
      else if (r.state === 'inside' && r.at) r.next = S.T;           // decide() will send them to the station
      else if (r.trip && r.trip.dest === u) { /* arrive() notices u.removed */ }
      else r.movingIn = false;
    }
    for (const r of residents) { if (r.carAt === u) { r.carAt = r.home; if (r.car) { if (r.home && r.at === r.home) parkVehicle(r.car, r.home, 'car'); else r.car.visible = false; } } if (r.bikeAt === u) { r.bikeAt = r.home; if (r.bike) { if (r.home && r.at === r.home) parkVehicle(r.bike, r.home, 'bike'); else r.bike.visible = false; } } }
    for (const r of Array.from(u.inside)) { if (r.at === u) { u.inside.delete(r); r.at = null; if (r.home) { const roads = roadNeighbors(u.cell); const path = roads.length ? routeCells(roads, frontRoad(r.home)) : null; if (path) startTrip(r, path, new THREE.Vector3(cx(roads[0].i), 0, cz(roads[0].j)), unitPos(r.home), r.home, 'heading home'); else { r.at = r.home; r.home.inside.add(r); } } else returnToStation(r, unitPos(u)); } }
    if (u.mesh) { townGroup.remove(u.mesh); disposeGroup(u.mesh); }
    u.cell.type = 'empty'; u.cell.block = null; u.cell.unit = null; units.delete(u.id);
  }
  blocks.splice(blocks.indexOf(block), 1);
  for (const c of cells) if (c.type === 'road' && !c.keep && !c.bridge && !lotAdjacent8(c)) { c.type = 'empty'; if (c.dyn) { c.ramp = null; c.dyn = false; } c.link = false; if (hash(c.j, c.i) < 0.18) c.tree = treeSpec(c.i, c.j); }
  connectHillRoads();   // hill links were cleared with the orphans; rebuild them for the blocks that remain
  connectCanal();       // a bridge whose banks lost their roads goes back to water
  refreshWorld();
}

onWorldChange(() => { pathCache.clear(); for (const w of wanderers) if (w.cell && w.cell.type !== 'road') w.dead = true; });   // a street built over sends its traffic away

export { HPS, hourOf, dayOf, daylight, routeCells, routeUnits, carMeshes, residents, wanderers, shopUnits, jobUnits, households, hhName, hhLabel, moodWords, restoreResident, restoreHousehold,
  updateResidents, updateWanderers, updateBlocks, growthAllowed, removeBlock, nextTrainAt, spawnNewcomer, removeResident,
  roadNeighbors, frontRoad, buildPoints, makePerson, makeCar, moveAlong, trafficFactor, unitPos, setProgressRate, onTrain };
