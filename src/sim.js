// Komachi — simulation: time, road routing, residents and their schedules, ambient traffic, block lifecycle
import * as THREE from 'three';
import { GIVEN, FAMILY, SKIN, SHIRTS, HAIR, CARS, SHOP_NAMES, uniqueName, PAL } from './palette.js';
import { rand, pick, clamp, smooth, hash } from './utils.js';
import { S } from './state.js';
import { N, HALF, cx, cz, townGroup, peopleGroup, disposeGroup, cam, camera } from './scene.js';
import { blob, mergeMesh } from './geometry.js';
import { createCat, updateCat, CAT_COATS } from './cats.js';
import { createDog, updateDog, DOG_COATS } from './dogs.js';
import { createTeaCan } from './tea-can.js';
import { createPhone, createNewspaper } from './hand-items.js';
import { record, chronicle } from './chronicle.js';
import { W } from './weather.js';
import { startTalk, endTalk } from './bubbles.js';
import { landmarkRoads } from './landmarks.js';
import { eventOn, eventVisit } from './events.js';
import { onCatch, catchToday } from './fishing.js';
import { seasonOf } from './seasons.js';
/** what two people would talk about right now: the weather when it is doing something, otherwise the town */
function pickTopic(r) { if (W.rain > 0.2 || W.snow > 0.3) return 'weather'; const h = hourOf(); if ((h >= 11 && h < 14) || (h >= 17.5 && h < 20)) return 'food'; if (r && r.hh && !r.hh.registered) return 'home'; return pick(['shop', 'train', 'home', 'heart', null]); }
import { attachCharacter, detachCharacter, holdItem, dropItem } from './characters.js';
import { equipCharacterProp, clearCharacterProp } from './character-props.js';
const PARK_REACH = 6;   // cells: how far a home or workplace sends its cars to a car park
const CARRY_HOME = new Set(['grocery', 'supermarket', 'konbini', 'arcade', 'bakery']);   // shops you leave with a bag
import { attachVehicle } from './vehicles.js';
import { cells, cell, DIR4, blocks, units, DONE, stageHours, unitCap, refreshWorld, onWorldChange, STATION, terrainY, hill, openHill, HILL_UNLOCK, signalRed, signalState, signalCells, updateSignals, rebuildNetwork, KIND_LABEL, hillPlots, placeBlock, drawRoad, chooseKind, clearCarPark, carParks, parkBay, refreshCivicFlags, maxLevel, hoursOf, isOpen } from './world.js';
import { hillCentre } from './island.js';
import { createBike, rollBike, BIKE_SEAT } from './bikes.js';
import { createService, serviceReady } from './service-vehicles.js';
import { unitLocal } from './buildings.js';
import { rebuildUnitMesh, unitDoorPoints } from './buildings.js';
import { toast } from './toast.js';

// ───────────────────────────── time ─────────────────────────────
const PEOPLE = 0.85;              // people and their bikes against the street: a person about 0.26 tall, a lane 0.34 wide (decided 2026-09-24)
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
// ── the route actually travelled: the shortest way with a little personal taste in it ──
// routeCells (above) gives the plain shortest path, cached for "can I get there, and how far". A trip itself takes routeVaried:
// each road cell costs 1 plus a small random amount drawn fresh for every trip, and a turn costs a little, so people and drivers
// going the same way spread over parallel streets instead of forming a single file. Drivers also shy away from cells with cars
// in them and from signalled crossings, so a busy street sheds traffic to the next one.
const dCost = new Float64Array(N * N), dPar = new Int32Array(N * N), busyCells = new Uint8Array(N * N);
function routeVaried(srcs, dsts, drive = false) {
  if (!srcs.length || !dsts.length) return null;
  dCost.fill(Infinity); dPar.fill(-1);
  const target = new Set(dsts.map(c => c.j * N + c.i)), seed = Math.random() * 977, spread = drive ? 0.55 : 0.3, heap = [];
  if (drive) { busyCells.fill(0); for (const v of carMeshes) if (v.visible && !v.userData.parked) { const c = cellAt(v.position); if (c) busyCells[c.j * N + c.i] = Math.min(9, busyCells[c.j * N + c.i] + 1); } }
  const push = (d, k) => { heap.push([d, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; for (let i = 0; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const s of srcs) { const k = s.j * N + s.i; if (dCost[k] > 0) { dCost[k] = 0; dPar[k] = k; push(0, k); } }
  while (heap.length) {
    const [d, k] = pop(); if (d > dCost[k]) continue;
    if (target.has(k)) { const path = []; let cur = k; while (true) { path.push(cells[cur]); if (dPar[cur] === cur) break; cur = dPar[cur]; } return path.reverse(); }
    const i = k % N, j = (k - i) / N, c0 = cells[k], pk = dPar[k], pdi = pk === k ? 0 : i - pk % N, pdj = pk === k ? 0 : j - Math.floor(pk / N);
    for (const [di, dj] of DIR4) {
      const n = cell(i + di, j + dj); if (!n || n.type !== 'road' || !roadLinked(c0, n, di, dj)) continue;
      const nk = n.j * N + n.i, jit = ((Math.sin(nk * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1;
      const w = 1 + jit * spread + ((pdi || pdj) && (di !== pdi || dj !== pdj) ? 0.35 : 0) + (drive ? busyCells[nk] * 0.6 + (signalCells.has(n) ? 0.5 : 0) : 0);
      if (d + w < dCost[nk]) { dCost[nk] = d + w; dPar[nk] = k; push(d + w, nk); }
    }
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
    if (endSide !== laneSign) {   // cross the road here; remember where, so a walker can wait for the light
      const d = dirs[dirs.length - 1]; pts.crossAt = pts.length - 1; pts.crossCell = cellPath[n - 1]; pts.crossAxis = Math.abs(d.x) > Math.abs(d.z) ? 'ew' : 'ns';
      pts.push(C[n - 1].clone().addScaledVector(rL, side * endSide));
    }
  }
  for (const p of eArr) pts.push(keepY(p));
  return pts;
}

// ───────────────────────────── meshes: people, cars, cats ─────────────────────────────
const carMeshes = [];
function makePerson(r) {
  const grp = new THREE.Group(); grp.userData = { res: r }; grp.visible = false; grp.scale.setScalar(PEOPLE); peopleGroup.add(grp);   // the whole person, with whatever they hold, at the town's scale
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
// farm work by the season: what they are doing out in the field, the prop in hand and the pose
const FIELD_WORK = {
  spring: [['planting seedlings', null, 'crouch'], ['hoeing the ridges', null, 'swing'], ['watering the seedlings', 'watering-can', null]],
  summer: [['weeding the rows', null, 'crouch'], ['watering the crops', 'watering-can', null], ['checking the plants', null, 'crouch']],
  autumn: [['bringing in the harvest', null, 'pickup'], ['filling crates with vegetables', null, 'pickup'], ['cutting the rice', null, 'crouch']],
};
const FARM_INDOOR = ['sorting seed', 'mending tools', 'packing vegetables', 'tending the seedlings under glass', 'doing the farm accounts'];
/** out in the field for a spell: a spot on one of the block's cells, facing along the rows, a tool or a pose */
function fieldWork(r, u) {
  const b = u.block, season = seasonOf(), h = hourOf(), ch = r.mesh.userData.char;
  if (season === 'winter' || W.rain > 0.3 || h < 7 || h >= 17 || !ch || b.kind === 'greenhouse' && Math.random() < 0.6) return stay(r, 'work', pick(b.kind === 'greenhouse' ? ['tending the seedlings under glass', 'potting up plants', 'watering under glass'] : FARM_INDOOR), rand(0.5, 1));
  const cellU = pick(b.units), lx = rand(-0.3, 0.35), lz = rand(-0.3, 0.35);
  const p = unitLocal(cellU, lx, lz, 0.12); p.y = 0.12 + terrainY(p.x, p.z);
  const [label, prop, pose] = pick(b.kind === 'paddy' && season !== 'autumn' ? [['tending the rice', null, 'crouch'], ['checking the water in the paddies', null, null]] : FIELD_WORK[season]);
  r.mesh.position.copy(p); r.mesh.rotation.y = (cellU.facing || 0) + (Math.random() < 0.5 ? 0 : Math.PI); r.mesh.visible = true;
  if (prop) equipCharacterProp(ch, prop); ch.pose = pose;
  const dur = rand(0.4, 0.9); r.outside = S.T + dur; return stay(r, 'work', label, dur);
}
const KEEP_ACTS = ['hanging out the washing', 'sweeping the step', 'cooking for the family', 'folding laundry', 'tidying the house', 'watering the plants', 'making tea'];
const HOME_ACTS = ['relaxing at home', 'cooking dinner', 'watering the plants', 'reading a book', 'watching TV', 'tidying up', 'playing games', 'napping'];
const WORK_ACTS = ['working', 'in a meeting', 'on a call', 'typing away', 'sketching ideas', 'taking a tea break'];
const CIVIC_ACTS = { townhall: ['stamping forms', 'filing records', 'at the counter', 'answering the phone'], clinic: ['seeing a patient', 'updating charts', 'sterilising instruments', 'at reception'], firestation: ['checking the hoses', 'polishing the truck', 'on standby', 'inspecting the ladder'], community: ['setting out chairs', 'updating the chronicle', 'brewing tea for the class', 'sweeping the hall'], substation: ['checking the transformers', 'reading the meters', 'logging the load', 'tightening a clamp'], waterworks: ['reading the gauges', 'testing the water', 'checking the pumps', 'greasing a valve'], recycling: ['sorting bottles', 'flattening boxes', 'weighing the cans', 'sweeping the pad'], bathhouse: ['stoking the boiler', 'folding towels', 'scrubbing the tubs', 'minding the counter'] };
const CLINIC_ACTS = ['waiting to be seen', 'having a check-up', 'picking up a prescription', 'reading in the waiting room'];
const CHRONICLE_ACTS = ['reading the town chronicle', 'looking at old photos of the town', 'reading the notices'];
const civicUnit = kind => { const b = blocks.find(b => b.type === 'civic' && b.kind === kind && b.stage === DONE); return b ? b.units[0] : null; };
const BATH_ACTS = ['soaking in the bath', 'washing off the day', 'chatting in the changing room', 'cooling down with a bottle of milk', 'drying off in the steam'];
const bathUnits = () => blocks.filter(b => b.type === 'civic' && b.kind === 'bathhouse' && b.stage === DONE).map(b => b.units[0]);
const SHOP_STAFF_ACTS = ['serving customers', 'restocking shelves', 'wiping tables', 'at the register'];
const SHOP_ACTS = ['browsing', 'sipping coffee', 'buying groceries', 'chatting with the owner', 'picking a snack', 'trying samples'];

const WAIT_ACTS = ['waiting for a home', 'reading the timetable', 'studying the town map', 'people-watching', 'checking their phone', 'chatting with a neighbour', 'humming a tune', 'watching the clouds'];
const VEND_ACTS = ['buying a can of tea', 'choosing a tea', 'getting a cold tea'];
const DRINK_ACTS = ['sipping a can of tea', 'enjoying a quiet tea break', 'finishing a can of tea'];
function makeCan() { return createTeaCan(); }

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
  const hh = { id: S.nextId++, kind, size, surname: pick(FAMILY), members: [], home, registered: false };
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
  else if (k === 'bath') { n.fun += 0.6 * dt; n.energy += 0.3 * dt; n.social += 0.2 * dt; }
  else if (k === 'clinic') { n.energy += 0.5 * dt; }
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
  r.hasBike = !r.hasCar && Math.random() < 0.45; r.bikeKind = r.hasBike && Math.random() < 0.3 ? 'scooter' : 'bike';   // a gentsuki for about a third of them
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
function freeSpot(r) { clearFidget(r); if (r.spot) { r.spot.taken = null; r.spot = null; } if (r.vendingAt) { r.vendingAt.taken = null; r.vendingAt = null; } r.sipAt = 0; const ch = r.mesh && r.mesh.userData.char; if (ch && (ch.item || ch.pose === 'press' || ch.pose === 'drink')) { dropItem(ch); ch.pose = null; } }
function takeSpot(r) {
  const spot = STATION.seats.find(s => !s.taken) || STATION.stands.find(s => !s.taken);
  if (spot) { spot.taken = r; r.spot = spot; } return spot;
}
// ── bench life: a seated person shifts, glances, checks a phone, reads, chats with a bench neighbour, stretches ──
const PHONE_ACTS = ['checking messages', 'scrolling the news', 'texting a friend', 'looking up train times'];
function gazeTo(r, p) { let a = Math.atan2(p.x - r.mesh.position.x, p.z - r.mesh.position.z) - r.mesh.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); return clamp(a, -0.9, 0.9) || 0.001; }
function benchNeighbour(r) { const s = r.spot; if (!s) return null; const n = STATION.seats.find(o => o !== s && o.taken && o.taken.state === 'inside' && o.taken.mesh.visible && !o.taken.vendingAt && o.taken.mesh.position.distanceTo(o.pos) < 0.05 && Math.abs(o.pos.x - s.pos.x) < 0.3 && Math.abs(o.pos.z - s.pos.z) < 0.01); return n ? n.taken : null; }   // a neighbour actually on the seat, not off at the machine
function clearFidget(r) {
  const ch = r.mesh && r.mesh.userData.char; if (!r.fidget) { if (ch) ch.gaze = 0; return; }
  const f = r.fidget; r.fidget = null;
  if (ch) { if (ch.item && ch.item.userData.handItem) dropItem(ch); ch.fidget = null; ch.gaze = 0; }
  if (f.kind === 'stretch' && r.spot) { r.mesh.position.copy(r.spot.pos); setPose(r, true); }
  if (f.base !== undefined) r.activity = f.base;
  if (f.kind === 'chat') endTalk(r);
  if (f.partner && f.partner.fidget && f.partner.fidget.kind === 'chat') clearFidget(f.partner);
}
function tickSitter(r) {
  const ch = r.mesh.userData.char; if (!ch) return;
  if (r.fidget) { if (S.T >= r.fidget.until) clearFidget(r); else if (r.fidget.at && r.fidget.at.mesh) ch.gaze = gazeTo(r, r.fidget.at.mesh.position); return; }
  if (S.T < (r.fidgetAt || 0)) {   // between things: eyes follow whoever walks past
    const passer = residents.find(x => x !== r && x.state === 'walking' && x.mesh.visible && x.mesh.position.distanceTo(r.mesh.position) < 0.8);
    ch.gaze = passer ? gazeTo(r, passer.mesh.position) : 0; return;
  }
  const nb = benchNeighbour(r), opts = [['phone', 3], ['paper', 1.5], ['stairs', 2], ['stretch', 1]]; if (nb && !nb.fidget) opts.push(['chat', 4]);
  let t = Math.random() * opts.reduce((s, o) => s + o[1], 0), kind = opts[0][0]; for (const [k, w] of opts) { t -= w; if (t <= 0) { kind = k; break; } }
  const dur = rand(0.25, 0.7), f = { kind, until: S.T + dur, base: r.activity };
  if (kind === 'phone') { holdItem(ch, createPhone()); ch.fidget = 'phone'; r.activity = pick(PHONE_ACTS); }
  else if (kind === 'paper') { holdItem(ch, createNewspaper()); ch.fidget = 'paper'; r.activity = 'reading the paper'; }
  else if (kind === 'stairs') { ch.gaze = gazeTo(r, STATION.entrance); r.activity = 'watching the stairs for the next train'; }
  else if (kind === 'stretch') { setPose(r, false); r.mesh.position.copy(r.spot.pos).add(new THREE.Vector3(Math.sin(r.spot.rot) * 0.14, 0, Math.cos(r.spot.rot) * 0.14)); r.activity = 'stretching their legs'; f.until = S.T + rand(0.15, 0.3); }
  else if (kind === 'chat') {
    const nch = nb.mesh.userData.char; f.partner = nb; f.at = nb; ch.fidget = 'nod'; r.activity = 'chatting about the town';
    nb.fidget = { kind: 'chat', until: f.until, base: nb.activity, at: r, partner: r }; if (nch) nch.gaze = gazeTo(nb, r.mesh.position); nb.activity = 'chatting about the town';
    startTalk(r, nb, pickTopic(r), f.until);
  }
  r.fidget = f; r.fidgetAt = f.until + rand(0.3, 1.4);
}
function sitDown(r) {
  const s = r.spot; if (!s) { r.state = 'inside'; r.next = S.T; return; }
  r.mesh.visible = true; r.mesh.position.copy(s.pos); r.mesh.rotation.y = s.rot; setPose(r, s.kind === 'seat');
  r.state = 'inside'; r.trip = null; r.activity = s.kind === 'seat' ? 'waiting for a home' : 'waiting by the planters'; r.next = waitNext(rand(0.3, 0.9)); r.fidgetAt = S.T + rand(0.15, 0.6);
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
  clearFidget(r);
  const pts = [from.clone().setY(y), ...plazaDetour(from, to).map(p => p.setY(y)), to.clone().setY(y)];
  r.trip = { pts, i: 0, t: 0, dest: null, drive: false, speed: 0.85 * rand(0.9, 1.1), baseY: y, onArrive };
  r.state = 'walking'; r.activity = label; r.mesh.visible = true; r.mesh.position.copy(pts[0]); setPose(r, false);
}
function waitDecide(r) {
  const h = hourOf();
  if (h >= 22 || h < 5.5) { freeSpot(r); startDirectTrip(r, r.mesh.position, STATION.entrance, 'taking the last train to the city', () => leaveForCity(r)); return; }
  if (r.vendingAt) {   // finished at the machine: the empty can goes in the bin, then back to the seat
    r.vendingAt.taken = null; r.vendingAt = null; r.sipAt = 0; const ch = r.mesh.userData.char; if (ch) { dropItem(ch); ch.pose = null; }
    if (!r.spot) takeSpot(r);
    if (r.spot) startDirectTrip(r, r.mesh.position, r.spot.pos.clone().setY(0.12), 'heading back to the bench', () => sitDown(r));
    else { r.activity = 'waiting for a home'; r.next = S.T + 0.5; }
    return;
  }
  if (!r.spot && takeSpot(r)) { startDirectTrip(r, r.mesh.position, r.spot.pos.clone().setY(0.12), 'looking for a seat', () => sitDown(r)); return; }
  const v = STATION.vending.find(x => !x.taken);
  if (v && h >= 6 && h < 23 && Math.random() < 0.28) {
    v.taken = r; r.vendingAt = v;
    startDirectTrip(r, r.mesh.position, v.pos, 'going to the vending machine', () => { r.state = 'inside'; r.trip = null; r.mesh.rotation.y = v.rot; r.activity = pick(VEND_ACTS); r.needs.food = Math.min(1, r.needs.food + 0.15); r.next = waitNext(rand(0.22, 0.32));
      const ch = r.mesh.userData.char; if (ch) { ch.pose = 'press'; r.sipAt = S.T + 0.06; }
    });   // a moment at the buttons, then the drink (see the inside loop)
    return;
  }
  r.activity = pick(WAIT_ACTS);
  r.next = waitNext(rand(0.4, 1.0));
}
// ── taxis: two wait at a rank on the plaza's south edge; a household moving to a far home rides together ──
const taxis = [];
function makeTaxis() {
  for (const side of [-0.3, 0.3]) {
    const mesh = makeCar('#e8cf7a', 'taxi'); const t = { mesh, state: 'rank', passengers: [], dest: null, trip: null, departAt: 0, slot: side, bay: side < 0 ? 0 : 1 };
    parkTaxi(t); taxis.push(t);
  }
}
/** where a taxi waits: a bay in the car park across the ring road, else the old rank on the plaza edge */
function rankPos(t) { const c = STATION.taxiPark; if (!c) return { p: unitLocal(STATION.anchor, t.slot, 0.22, 0.12), rot: 0 }; const b = parkBay(c, t.bay); return { p: new THREE.Vector3(b.x, 0.085, b.z), rot: b.rot }; }
function parkTaxi(t) { const { p, rot } = rankPos(t); t.mesh.position.copy(p); t.mesh.rotation.set(0, rot, 0); t.mesh.visible = true; t.mesh.userData.parked = true; t.state = 'rank'; t.dest = null; t.trip = null; }
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
        const back = routeCells(frontRoad(t.dest), STATION.taxiPark ? [STATION.taxiPark.parkRoad] : roadNeighbors(STATION.anchor.cell));
        if (!back) { parkTaxi(t); continue; }
        const rank = rankPos(t).p;
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
// ── parking: a resident's bike waits on the plot beside the building; their car waits at the kerb of the street in front ──
const PARK_SLOTS = [[0.33, 0.2], [-0.33, 0.2], [0.33, -0.22], [-0.33, -0.22]];
function parkVehicle(mesh, u, kind) {
  const veh = x => kind === 'car' ? x.car : x.bike, at = x => kind === 'car' ? x.carAt : x.bikeAt;
  const used = new Set(residents.filter(x => veh(x) && veh(x) !== mesh && at(x) === u && veh(x).userData.slot !== undefined).map(x => veh(x).userData.slot));
  if (kind === 'car') {   // the nearest of the player's car parks within reach with a free bay, nose-in from its street
    const near = carParks.filter(c => Math.abs(c.i - u.cell.i) + Math.abs(c.j - u.cell.j) <= PARK_REACH).sort((a, b) => Math.abs(a.i - u.cell.i) + Math.abs(a.j - u.cell.j) - Math.abs(b.i - u.cell.i) - Math.abs(b.j - u.cell.j));
    for (const c of near) {
      const usedB = new Set(residents.filter(x => x.car && x.car !== mesh && x.car.userData.bayCell === c).map(x => x.car.userData.bay));
      const bay = [0, 1, 2, 3].find(k => !usedB.has(k)); if (bay === undefined) continue;
      const p = parkBay(c, bay); mesh.position.set(p.x, 0.085 + p.h, p.z); mesh.rotation.set(0, p.rot, 0); mesh.visible = true; mesh.userData.parked = true; mesh.userData.bay = bay; mesh.userData.bayCell = c; mesh.userData.slot = undefined; u.block.kerbFull = false; return;
    }
  }
  mesh.userData.bay = undefined; mesh.userData.bayCell = undefined;
  if (kind === 'car') {   // the plot is too small for a car: it waits at the kerb of the street in front, half on the pavement, with the home on its left
    const road = frontRoad(u)[0];
    if (road) {
      const dx = Math.sign(u.cell.i - road.i), dz = Math.sign(u.cell.j - road.j);   // from the street toward the home
      let slot = [0, 1].find(k => !used.has(k));
      if (slot === undefined) { slot = 0; u.block.kerbFull = true; if (!u.block.parkHint) { u.block.parkHint = true; toast(`Cars are lining the kerb outside ${u.block.name}. A car park nearby would give them room (Streets → Car park, 7)`); } }
      else u.block.kerbFull = false;
      const along = (slot ? -1 : 1) * 0.28, ax = -dz, az = dx;   // two bays along the kerb
      mesh.position.set(cx(road.i) + dx * 0.42 + ax * along, 0.085 + (road.h || 0), cz(road.j) + dz * 0.42 + az * along);
      mesh.rotation.set(0, Math.atan2(-dz, dx), 0);   // heading with the home on the driver's left (Japan keeps left)
      mesh.visible = true; mesh.userData.parked = true; mesh.userData.slot = slot; return;
    }
  }
  let slot = PARK_SLOTS.findIndex((_, k) => !used.has(k)); if (slot < 0) slot = 0;
  const [lx, lz] = PARK_SLOTS[slot], p = unitLocal(u, lx * (kind === 'bike' ? 1.15 : 1), lz, 0.12);
  mesh.position.set(p.x, 0.12 + (u.cell.h || 0), p.z); mesh.rotation.set(0, (u.facing || 0) + (kind === 'bike' ? Math.PI / 2 : 0), 0);
  mesh.visible = true; mesh.userData.parked = true; mesh.userData.slot = slot;
}
function makeBike(r) {
  const sc = r.bikeKind === 'scooter' && serviceReady() ? createService('scooter') : null;   // the commuter gentsuki is modelled at street scale already
  const grp = sc || createBike(r.carColor); if (!sc) { grp.scale.setScalar(PEOPLE); grp.userData.lights = null; }
  grp.visible = false; peopleGroup.add(grp); return grp;   // a bicycle at the rider's scale and without a lamp; the scooter keeps its own lamps (daynight.js)
}
function enterUnit(r, u) {
  r.trip = null; r.mesh.visible = false;
  if (r.mesh.userData.char && r.mesh.userData.char.accessory) clearCharacterProp(r.mesh.userData.char);   // the bag comes indoors with them
  if (r.mesh.userData.char && r.mesh.userData.char.item && !r.vendingAt) dropItem(r.mesh.userData.char);   // the empty can goes in the bin at the door
  if (r.car && r.carAt === u && !u.removed) parkVehicle(r.car, u, 'car'); else if (r.car) r.car.visible = false;
  if (r.bike && r.bikeAt === u && !u.removed) parkVehicle(r.bike, u, 'bike'); else if (r.bike) r.bike.visible = false;
  if (u.removed) { returnToStation(r, r.mesh.position); return; }
  r.at = u; u.inside.add(r); r.state = 'inside'; r.next = S.T; r.until = 0;
  const p = r.purpose; r.purpose = null;
  if (p === 'eat') { r.actKind = 'eat'; r.activity = pick(hourOf() < 10.5 ? BREAKFAST_ACTS : hourOf() < 15.5 ? LUNCH_ACTS : DINNER_ACTS); r.until = S.T + rand(0.5, 0.8); }
  else if (p === 'shop') { r.actKind = 'shop'; r.activity = pick(SHOP_ACTS); r.until = S.T + rand(0.4, 0.9); r.canPending = u.block.kind === 'konbini' && Math.random() < 0.5; r.bagPending = !r.canPending && CARRY_HOME.has(u.block.kind); }   // they will leave with a bag, or a can from the konbini
  else if (p === 'visit') { r.actKind = 'visit'; r.activity = pick(VISIT_ACTS); r.until = S.T + rand(0.8, 1.4); const host = u.residents.find(x => x.at === u && x !== r); if (host) { host.activity = 'catching up with a friend'; r.visitHost = host; } }
  else if (p === 'bath') { r.actKind = 'bath'; r.activity = pick(BATH_ACTS); r.until = S.T + rand(0.5, 0.9); u.block.visitsToday = (u.block.visitsToday || 0) + 1; }
  else if (p === 'register') { r.actKind = 'visit'; r.activity = 'registering at the town office'; r.until = S.T + rand(0.15, 0.3); r.folderPending = true; if (r.hh) r.hh.registered = true; const line = `${r.name.split(' ')[0]} ${r.hh && r.hh.kind !== 'solo' ? 'registered the ' + r.hh.surname + ' household' : 'registered as a resident'} at ${u.block.name}`; toast(line); record(line); }
  else if (p === 'clinic') { r.actKind = 'clinic'; r.activity = pick(CLINIC_ACTS); r.until = S.T + rand(0.3, 0.6); u.block.visitsToday = (u.block.visitsToday || 0) + 1; }
  else if (p === 'chronicle') { r.actKind = 'visit'; r.activity = pick(CHRONICLE_ACTS); r.until = S.T + rand(0.25, 0.5); u.block.visitsToday = (u.block.visitsToday || 0) + 1; }
  else if (u === r.job) r.actKind = 'work';
  else if (u === r.home) r.actKind = 'home';
  if (r.movingIn && u === r.home) {   // the car or bike arrives with the household
    r.movingIn = false; u.incoming = Math.max(0, u.incoming - 1); r.activity = 'unpacking boxes'; r.actKind = 'home'; r.next = S.T + rand(0.5, 1);
    if (!r.commuter && Math.random() < 0.25) { r.commuter = true; r.workStart = rand(7, 8.6); r.workEnd = rand(17.2, 19); }   // a quarter keep a job in the city and commute by train
    if (r.hasCar) { if (r.car) { r.carAt = u; parkVehicle(r.car, u, 'car'); } else if (vehicleSource) { r.carOrdered = true; vehicleSource.orderCar(r); } else { r.carAt = u; r.car = makeCar(r.carColor, r.carKind); parkVehicle(r.car, u, 'car'); } }   // the car comes off the next ferry
    if (r.hasBike) { r.bikeAt = u; if (!r.bike) r.bike = makeBike(r); parkVehicle(r.bike, u, 'bike'); }
  }
  const hh = hourOf();
  if (u === r.home && u.block.watered && r.mesh.userData.char && ((hh >= 7 && hh < 10) || (hh >= 16 && hh < 19)) && Math.random() < 0.35) {   // near the water works the garden gets a watering before they go in
    r.outside = S.T + rand(0.12, 0.2); r.mesh.visible = true; r.activity = 'watering the garden'; r.actKind = 'home'; r.next = Math.max(r.next, r.outside);
    equipCharacterProp(r.mesh.userData.char, 'watering-can');
  }
}
/** Lost their home (or their destination vanished): head back to the station and wait again. */
function returnToStation(r, fromPos) {
  if (r.mesh.userData.char) clearCharacterProp(r.mesh.userData.char);
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
function restoreHousehold(d, home) { const hh = { id: d.id, kind: d.kind, size: d.size, surname: d.surname, registered: !!d.registered, members: [], home }; households.push(hh); return hh; }

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
const jobUnits = () => blocks.filter(b => (b.type === 'work' || b.type === 'shop' || b.type === 'civic' || b.type === 'farm') && b.stage === DONE).flatMap(b => b.units);
/** the new hire takes the workplace's next shift (early, then late, in turn), a few minutes either way, and wakes in time to
 *  walk there: the commute is about 0.07 h a cell, so a far job means leaving earlier */
function takeShift(r, u, path) {
  const sh = hoursOf(u.block).shifts, n = u.staff.length - 1, [a, z] = sh[n % sh.length];
  // one-shift offices, workshops, factories and civic jobs keep flexitime: three waves about twenty minutes apart
  const wave = sh.length === 1 && u.block.type !== 'shop' && u.block.type !== 'farm' ? (Math.floor(n / sh.length) % 3 - 1) * 0.35 : 0;
  r.workStart = a + wave + rand(-0.15, 0.15); r.workEnd = z + wave + rand(-0.1, 0.2);
  r.commuteH = clamp((path ? path.length : 6) * 0.1 + 0.15, 0.25, 1.5);   // about 0.1 h a cell on foot, and a moment at the doors
  r.wake = clamp(Math.min(r.wake, r.workStart - r.commuteH - rand(0.4, 0.8)), 5, 9);
}
function findJob(r) {
  let best = null, bestLen = 1e9;
  if (r.commuter || r.homemaker) return;
  if (r.hh && !r.hh.homemakerSet && !r.hh.members.some(m => m !== r && m.homemaker) && r.hh.members.length >= 2 && ['couple', 'family'].includes(r.hh.kind)) {   // decided once per household
    r.hh.homemakerSet = true;
    if (hash(r.hh.id, 7) < 0.55) { r.homemaker = true; r.activity = 'settling in at home'; return; }
  }
  for (const u of jobUnits()) {
    if (u.staff.length >= unitCap(u)) continue;
    const p = routeUnits(r.home, u); if (!p) continue;
    const len = p.length + (u.block.type === 'shop' ? 2 : 0) + Math.random() * 3;
    if (len < bestLen) { bestLen = len; best = u; }
  }
  if (best) { r.job = best; best.staff.push(r); takeShift(r, best, routeUnits(r.home, best)); }
  else if (!r.commuter && Math.random() < 0.35) { r.commuter = true; r.workStart = rand(7, 8.6); r.workEnd = rand(17.2, 19); }   // no work in town: take the train to the city instead
}
function startTrip(r, cellPath, start, end, destUnit, label, from = null) {
  clearFidget(r); r.outside = 0; r.meetUntil = 0; endTalk(r);
  { const ch = r.mesh.userData.char; if (ch && W.rain > 0.25 && !ch.accessory && !r.hasCar) equipCharacterProp(ch, 'umbrella', pick([PAL.roofTeal, PAL.roofRose, PAL.indigo, PAL.cream2])); }   // rain: an umbrella for the walk, unless the hands are full   // whatever they were doing on the bench (phone, paper, chat) or in the garden stops before they set off
  const toUnit = destUnit && destUnit !== STATION.anchor;
  const drive = r.hasCar && cellPath.length > 6 && toUnit && from && from === r.carAt;
  const ride = !drive && r.hasBike && cellPath.length > 3 && toUnit && from && from === r.bikeAt;
  if (cellPath.length > 2) { const v = routeVaried([cellPath[0]], [cellPath[cellPath.length - 1]], drive); if (v) cellPath = v; }
  const kerbEnd = Array.isArray(end) ? end[0] : end, kerbStart = Array.isArray(start) ? start[start.length - 1] : start;
  if (drive) { r.carAt = destUnit; if (!r.car) r.car = makeCar(r.carColor, r.carKind); start = r.car.userData.parked ? [r.car.position.clone(), kerbStart] : kerbStart; end = kerbEnd; }   // from the parking spot to the kerb, then the road
  if (ride) { r.bikeAt = destUnit; if (!r.bike) r.bike = makeBike(r); start = r.bike.userData.parked ? [r.bike.position.clone(), kerbStart] : kerbStart; end = kerbEnd; }
  const pts = drive ? buildPoints(cellPath, start, end, 0.17, 0.08, -1) : ride ? buildPoints(cellPath, start, end, 0.315, 0.08, -1) : buildPoints(cellPath, start, end, 0.35 + hash(r.id, 31) * 0.08, 0.1);   // each walker keeps their own line across the pavement (0.35–0.43 from the centre), so passers-by do not walk through each other
  r.trip = { pts, i: 0, t: 0, dest: destUnit, drive, ride, speed: drive ? 2.6 : ride ? (r.bike.userData.service ? 2.3 : 1.7) : 0.9 * rand(0.85, 1.15), baseY: drive || ride ? 0.08 : 0.1, cells: cellPath, label, from };
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
  const ch = r.mesh.userData.char;
  if (ch && r.bagPending && from.block && from.block.type === 'shop') equipCharacterProp(ch, 'shopping-bag', from.block.awning ? from.block.awning[0] : undefined);   // shopping done: carry the bag home
  else if (ch && r.folderPending) { r.folderPending = false; equipCharacterProp(ch, 'folder'); if (label) label = 'heading home with the papers'; }   // registered: the folder comes home
  else if (ch && r.canPending && from.block && from.block.type === 'shop') { holdItem(ch, makeCan(r)); if (label && !label.includes('can')) label += ' with a can of tea'; }   // a small purchase, sipped on the way
  r.bagPending = false; r.canPending = false;
  from.inside.delete(r); r.at = null; r.purpose = purpose; r.until = 0; r.actKind = 'travel'; r.plan = label;
  startTrip(r, path, start, dest === STATION.anchor ? STATION.entrance : entryPts(dest), dest, label, from); return true;
}
// a stroll out to one of the island's landmarks: along the streets to the nearest one, then off the kerb to the spot; they
// look out to sea, cross to the crown of the bridge or sit a while in the pavilion, then walk back the same way and home
function visitLandmark(r, from, given = null) {
  const opts = given ? [given] : landmarkRoads().filter(o => o.l.kind !== 'fishmarket'); if (!opts.length) return false;
  const quay = !given && opts.find(o => o.l.kind === 'pier');   // fishing off the quay is a favourite
  const { l, road } = quay && Math.random() < 0.4 ? quay : pick(opts), path = routeCells(frontRoad(from), [road]); if (!path || path.length < 1) return false;
  from.inside.delete(r); r.at = null; r.strollHome = true; r.actKind = 'stroll'; r.until = 0; r.purpose = null;
  const walk = l.walk(road);
  startTrip(r, path, exitPts(from), walk, null, l.label);
  if (r.trip) Object.assign(r.trip, { landmark: l, lmRoad: road, lmWalk: walk });
  return true;
}
function atLandmark(r, tr) {
  const l = tr.landmark;
  if (!tr.held) {   // there: stand and look, or take a free bench in the pavilion
    tr.held = true; tr.holdUntil = S.T + rand(l.hold[0], l.hold[1]); r.activity = l.kind === 'event' && hourOf() >= 19.9 && l.activity.includes('festival') ? 'watching the fireworks' : l.activity; r.paused = true; r.heldAct = null;
    if (l.spot) l.spot.taken++;
    if (l.fish) { const ch = r.mesh.userData.char; if (ch) equipCharacterProp(ch, 'fishing-rod', pick([PAL.indigo, PAL.roofTeal, '#b24a3c'])); }
    const seat = l.seats && l.seats.find(s => !s.taken || !s.taken.trip || s.taken.trip.seat !== s);
    if (seat) { seat.taken = r; tr.seat = seat; r.mesh.position.copy(seat.pos); r.mesh.rotation.y = seat.rot; setPose(r, true); }
    else if (l.face !== undefined) r.mesh.rotation.y = l.face;
    return;
  }
  r.paused = false;
  if (tr.seat) { tr.seat.taken = null; setPose(r, false); }
  if (l.spot) l.spot.taken = Math.max(0, l.spot.taken - 1);
  if (l.fish) { const ch = r.mesh.userData.char; if (ch) clearCharacterProp(ch); }
  if (l.bag) { const ch = r.mesh.userData.char; if (ch) equipCharacterProp(ch, 'shopping-bag', '#c9a36a'); }   // something from the market
  const back = tr.lmWalk.slice().reverse().map(p => p.clone());
  if (!r.home) { r.trip = null; returnToStation(r, back[back.length - 1]); return; }
  const path = routeCells([tr.lmRoad], frontRoad(r.home));
  if (path) startTrip(r, path, back, entryPts(r.home), r.home, 'heading home');
  else { r.trip = null; r.mesh.visible = false; r.at = r.home; r.home.inside.add(r); r.state = 'inside'; r.next = S.T; }
}
function stroll(r) {
  const roads = cells.filter(c => c.type === 'road'); if (!roads.length) return false;
  const from = r.at; let path = null;
  if (W.rain < 0.25 && Math.random() < 0.3 && visitLandmark(r, from)) return true;   // fine weather: out to a landmark now and then
  const boards = blocks.filter(b => b.type === 'civic' && b.stage === DONE && b.street && b.street.length), toBoard = boards.length && Math.random() < 0.35;   // a civic corner has a notice board worth a look
  if (toBoard) { const bb = pick(boards); path = routeCells(frontRoad(from), [pick(bb.street)]); if (path && path.length < 2) path = null; }
  for (let k = 0; k < 5 && !path; k++) { const t = pick(roads); path = routeCells(frontRoad(from), [t]); if (path && path.length < 3) path = null; }
  if (!path) return false;
  from.inside.delete(r); r.at = null; r.strollHome = true; r.actKind = 'stroll'; r.until = 0; r.purpose = null;
  const last = path[path.length - 1];
  startTrip(r, path, exitPts(from), new THREE.Vector3(cx(last.i), 0, cz(last.j)), null, toBoard && path ? 'going to see the notice board' : pick(['taking a walk', 'out for a stroll', 'walking the dog', 'going jogging']));
  if (toBoard && r.trip) r.trip.holdAtEnd = rand(0.1, 0.2);   // a pause at the board before turning for home
  return true;
}
function arrive(r) {
  const tr = r.trip;
  if (tr.onArrive) { r.trip = null; tr.onArrive(); return; }
  if (tr.landmark) { atLandmark(r, tr); return; }
  if (!tr.dest && tr.holdAtEnd && !tr.held) { tr.held = true; tr.holdUntil = S.T + tr.holdAtEnd; r.activity = 'reading the notices'; r.paused = true; r.heldAct = null; return; }   // paused: stands still instead of walking on the spot   // stand and read; the walk home follows
  r.trip = null; r.mesh.visible = false; if (r.car) r.car.visible = false;
  const endPos = tr.pts[tr.pts.length - 1];
  if (!tr.dest) {   // strolled to a road cell: turn around and head home
    if (!r.home) { returnToStation(r, endPos); return; }
    const c = cellAt(endPos); if (c && (c.h || 0) > 0) hillVisits++;   // a stroll up the hill counts too
    const path = c ? routeCells([c], frontRoad(r.home)) : null;
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
  if ((tr.dest.cell.h || 0) > 0) hillVisits++;   // someone made it up the hill
  if (tr.dest.removed) { returnToStation(r, endPos); return; }
  enterUnit(r, tr.dest);
  if (tr.dest.block.type === 'shop' && tr.dest !== r.job) { tr.dest.block.visitScore += 1; tr.dest.block.visitsToday = (tr.dest.block.visitsToday || 0) + 1; }
}
function cellAt(p) { return cell(Math.floor(p.x + HALF), Math.floor(p.z + HALF)); }

const FOODIE = { ryokan: 0.3, cafe: 1, bakery: 0.9, ramen: 1.1, grocery: 0.5, konbini: 0.8, florist: 0.15, books: 0.25, restaurant: 1.25, supermarket: 0.6, arcade: 0.9, teahouse: 0.95 };
const GROCER = { ryokan: 0, grocery: 1.2, konbini: 1.1, bakery: 0.7, florist: 0.6, books: 0.6, cafe: 0.4, ramen: 0.3, restaurant: 0.3, supermarket: 1.5, arcade: 1.0, teahouse: 0.2 };
/** the best reachable shop for a purpose: weight by kind, discount by distance, add a little whim */
const REACH = { ryokan: 22, teahouse: 22, supermarket: 26, arcade: 24, restaurant: 17, cafe: 16, grocery: 15, konbini: 13, ramen: 14, bakery: 12, florist: 11, books: 12 };
function pickShop(r, from, weights) {
  let best = null, bs = 0;
  for (const u of shopUnits()) {
    if (u === r.job || u.block.renoT > 0 && u.block.changing) continue;   // a shop changing trade is shuttered
    if (u.block.quietDays && hourOf() >= 19) continue;   // a quiet shop shutters early
    if (!isOpen(u.block, hourOf() + 0.2)) continue;   // closed (or closing by the time they get there)
    const w = weights[u.block.kind] || 0.5; const p = routeUnits(from, u); if (!p) continue;
    const reach = REACH[u.block.kind] || 12;   // a supermarket or arcade draws people from further than a corner bakery
    const sc = w * (1 + Math.random() * 0.6) / (1 + p.length / reach); if (sc > bs) { bs = sc; best = u; }
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
  const n = r.needs, atHome = u === r.home, atWork = !!r.job && u === r.job, setOff = r.job ? r.workStart - (r.commuteH || 0.4) : 99;
  const workHours = !!r.job && h >= setOff - 0.05 && h < r.workEnd;
  const free = !atWork && !(r.job && r.lastWorkDay !== day && h > setOff - 1.8 && h < r.workEnd);   // no long outing when the shift is near
  const night = h >= 22 || h < 5, shops = shopUnits().length > 0;
  if (!atHome && !atWork && r.until && S.T < r.until) { r.next = Math.min(r.until, S.T + 0.3); return; }   // a meal, a visit or a shop runs its course
  const opts = [];
  const add = (score, run) => opts.push({ score: score + Math.random() * 0.12, run });
  if (r.returnTo && workHours && !atWork) { const d = r.returnTo; add(1.7, () => { r.returnTo = null; return go(r, d, 'back to work'); }); }
  else r.returnTo = null;
  if (night || n.energy < 0.15 || (h >= 21 && n.energy < 0.5)) add((1 - n.energy) * 1.6 + (night ? 1.2 : 0.3), () => atHome ? sleep(r) : go(r, r.home, 'heading home to sleep'));
  const leaveFor = !!r.job && !atWork && r.lastWorkDay !== day && h >= setOff && h < r.workEnd - 0.5;   // set off in time to arrive for the shift
  if (leaveFor) add(1.5, () => { r.lastWorkDay = day; return go(r, r.job, h < r.workStart ? 'heading to work' : 'heading to work, a little late'); });
  if (atWork && workHours) {
    if (u.block.type === 'farm') add(1.3, () => fieldWork(r, u));
    else add(1.25, () => stay(r, 'work', pick(u.block.type === 'shop' ? SHOP_STAFF_ACTS : u.block.type === 'civic' ? (CIVIC_ACTS[u.block.kind] || WORK_ACTS) : WORK_ACTS), rand(0.5, 1.2)));
    if (h >= 11.5 && h < 13.5 && n.food < 0.55 && r.lunched !== day && shops) { const sh = pickShop(r, u, FOODIE); if (sh) add((1 - n.food) * 1.5 + 0.3, () => { r.lunched = day; r.returnTo = u; return go(r, sh, 'going for lunch', 'eat'); }); }
  }
  const mealTime = (h >= 6.5 && h < 9.5) || (h >= 11.5 && h < 14) || (h >= 17.5 && h < 20.5);
  if (atHome && n.food < 0.65 && (mealTime || n.food < 0.3)) add((1 - n.food) * 1.4 + (h >= 17.5 && r.hh.members.some(m => m !== r && m.at === u) ? 0.35 : 0), () => eatAtHome(r));
  if (!atWork && shops && n.food < 0.5 && ((h >= 11 && h < 14) || (h >= 17.5 && h < 20.5))) { const sh = pickShop(r, u, FOODIE); if (sh) add((1 - n.food) * 1.1 + 0.25 + (1 - n.fun) * 0.3, () => go(r, sh, pick(h < 10.5 ? ['going out for breakfast', 'off to the bakery'] : h < 15 ? ['going out for lunch', 'heading out to eat', 'off for a bite'] : ['going out for dinner', 'heading out to eat', 'off to the ramen shop']), 'eat')); }
  if (!atWork && shops && h >= 9 && h < 20 && n.supplies < 0.5) { const sh = pickShop(r, u, GROCER); if (sh) add((1 - n.supplies) * 1.3, () => go(r, sh, pick(['going shopping', 'popping out for groceries', 'off to the shops']), 'shop')); }
  if (free && h >= 7 && h < 19 && n.fun < 0.7) add((1 - n.fun) * 0.9 + 0.15, () => stroll(r));
  if (atHome && r.hh && !r.hh.registered && h >= 9 && h < 16.5 && !r.hh.members.some(m => m.purpose === 'register')) {   // one member walks to the town office (the kōban until a town hall stands)
    const th = civicUnit('townhall') || STATION.anchor; if (th && routeUnits(u, th)) add(1.75, () => { if (th === STATION.anchor) { r.hh.registered = true; return go(r, STATION.anchor, 'registering at the kōban'); } return go(r, th, 'off to register at the town office', 'register'); });
  }
  if (!atWork && h >= 9 && h < 17 && n.energy < 0.3 && r.clinicDay !== day) { const cu = civicUnit('clinic'); if (cu && cu !== u && routeUnits(u, cu)) add((1 - n.energy) * 1.3, () => { r.clinicDay = day; return go(r, cu, 'feeling run down, off to the clinic', 'clinic'); }); }
  if (free && h >= 10 && h < 19 && n.fun < 0.6 && Math.random() < 0.3) { const cc = civicUnit('community'); if (cc && cc !== u && routeUnits(u, cc)) add((1 - n.fun) * 0.7 + 0.1, () => go(r, cc, 'going to read the town chronicle', 'chronicle')); }
  if (!atWork && h >= 17 && h < 21 && n.fun < 0.65 && r.bathDay !== day) { const bu = bathUnits().find(x => x !== u && routeUnits(u, x)); if (bu) add((1 - n.fun) * 1.2 + 0.3, () => { r.bathDay = day; return go(r, bu, 'off to the bath house', 'bath'); }); }   // an evening soak
  if (free && h >= 10 && h < 20.5 && n.social < 0.5) { const v = pickVisit(r); if (v) add((1 - n.social) * 1.15, () => go(r, v, `visiting ${v.block.name}`, 'visit')); }
  if (atHome && u.block.bagsDue && r.mesh.userData.char && h >= 6 && h < 10.5) add(1.6, () => carryBags(r));   // collection morning: someone takes the bags out
  if (r.homemaker && atHome && h >= 8.5 && h < 17.5) {   // the one who keeps the house: errands in the day while the others are at work
    if (shops && n.supplies < 0.85 && r.errandDay !== day) { const sh = pickShop(r, u, GROCER); if (sh) add(0.95 + (1 - n.supplies) * 0.6, () => { r.errandDay = day; return go(r, sh, pick(['doing the day\'s shopping', 'off to the shops for the family', 'fetching groceries']), 'shop'); }); }
    add(0.7, () => stay(r, 'home', pick(KEEP_ACTS), rand(0.5, 1.1)));
  }
  if (free && catchToday() && h >= 10.5 && h < 18.2 && r.fishBuy !== day && (r.homemaker || Math.random() < 0.6)) {   // the catch is in: fish for supper from the quay stall
    const m = landmarkRoads().find(o => o.l.kind === 'fishmarket');
    if (m) add((r.homemaker ? 1.3 : 0.8) + (1 - n.supplies) * 0.8 + (1 - n.food) * 0.2, () => { r.fishBuy = day; return visitLandmark(r, u, m); });
  }
  if (free && ((h >= 5.5 && h < 8.5) || (h >= 15.5 && h < 18.5)) && W.rain < 0.3 && r.fishDay !== day) {   // early morning and late afternoon: off to fish from the quay (some are keen anglers)
    const keen = r.id % 4 === 0, q = landmarkRoads().find(o => o.l.kind === 'pier');
    if (q && (keen || Math.random() < 0.35)) add((keen ? 0.95 : 0.45) + (1 - n.fun) * 0.5, () => { r.fishDay = day; return visitLandmark(r, u, q); });
  }
  { const ev = eventOn(); if (ev && free && r.eventDone !== day + ev.kind) {   // the square is busy: the market in the morning, the festival in the evening
    const fest = ev.kind === 'festival', sc = fest ? 1.45 + (1 - n.fun) * 0.5 : (r.homemaker ? 1.25 : 0.55) + (1 - n.supplies) * 0.7 + (1 - n.fun) * 0.25;
    add(sc, () => { const v = eventVisit(); if (!v) return false; r.eventDone = day + ev.kind; return visitLandmark(r, u, v); });
  } }
  if (atHome) add(0.55 + n.fun * 0.2, () => stay(r, 'home', pick(HOME_ACTS), rand(0.6, 1.4)));
  else if (!(atWork && workHours)) add(0.5, () => go(r, r.home, 'heading home'));
  opts.sort((a, b) => b.score - a.score);
  for (const o of opts) if (o.run() !== false) { keepShift(r); return; }
  r.next = S.T + rand(0.3, 0.8); keepShift(r);
}
/** whatever someone settles into before work (breakfast, a sit at home, sleep), it ends in time to leave for the shift */
function keepShift(r) {
  if (!r.job || r.at === r.job || r.state !== 'inside' || r.lastWorkDay === dayOf()) return;
  const leave = Math.floor(S.T / 24) * 24 + r.workStart - (r.commuteH || 0.4);
  if (S.T < leave && r.next > leave) r.next = leave;
}

// ── traffic: a vehicle slows for another one close ahead in its own lane (same heading, small side offset) ──
const tfFwd = new THREE.Vector3(), tfRel = new THREE.Vector3();
const claims = new Map();   // junction cell index → the vehicle inside it
const isJunction = c => c && c.type === 'road' && roadNeighbors(c).length >= 3;
/** is this vehicle driving right now (its traffic check ran this step), rather than stopped for a delivery or waiting at a stop? */
const driving = v => S.T - (v.userData.tfAt ?? -9) < 0.05;
function trafficFactor(obj, tr = null) {
  let f = 1; tfFwd.set(Math.sin(obj.rotation.y), 0, Math.cos(obj.rotation.y));
  updateSignals();   // lights follow game time, so they also cycle inside fastForward
  const ud = obj.userData; ud.tfAt = S.T; const here = cellAt(obj.position), aheadCell = cell(Math.floor(obj.position.x + tfFwd.x * 0.6 + HALF), Math.floor(obj.position.z + tfFwd.z * 0.6 + HALF));
  // a red light stops the car short of the crossing; at amber only a car that can still stop comfortably does (a car already inside carries on)
  if (aheadCell && aheadCell !== here && signalRed(aheadCell, Math.abs(tfFwd.x) > Math.abs(tfFwd.z) ? 'ew' : 'ns')) {
    const ahead = (cx(aheadCell.i) - obj.position.x) * tfFwd.x + (cz(aheadCell.j) - obj.position.z) * tfFwd.z;   // distance to the junction's centre
    const amber = signalState(aheadCell, Math.abs(tfFwd.x) > Math.abs(tfFwd.z) ? 'ew' : 'ns') === 'amber';
    if (!(amber && ahead < 0.86)) f = Math.min(f, clamp((ahead - 0.74) / 0.14, 0, 1));
  }
  // junctions are claimed: the vehicle inside one holds it, and another may follow it in or pass it in the other lane, but a car
  // crossing its path (a right turn over the oncoming lane, a side street joining) waits at the edge. A long wait lets it go anyway.
  const hk = here ? here.j * N + here.i : -1;
  if (ud.claim !== undefined && ud.claim !== hk) { if (claims.get(ud.claim) === obj) claims.delete(ud.claim); ud.claim = undefined; }
  if (isJunction(here)) { const o = claims.get(hk); if (!o || o === obj || !o.visible || o.userData.parked || !driving(o) || cellAt(o.position) !== here) { claims.set(hk, obj); ud.claim = hk; } }
  let held = false;
  if (aheadCell && aheadCell !== here && isJunction(aheadCell)) {
    const ak = aheadCell.j * N + aheadCell.i, o = claims.get(ak);
    if (o && o !== obj && o.visible && !o.userData.parked && driving(o) && cellAt(o.position) === aheadCell) {
      const dot = Math.sin(o.rotation.y) * tfFwd.x + Math.cos(o.rotation.y) * tfFwd.z;
      tfRel.subVectors(o.position, obj.position); const side = Math.abs(tfRel.x * tfFwd.z - tfRel.z * tfFwd.x);
      if (!(dot > 0.7 || (dot < -0.7 && side > 0.2))) { const ahead = (cx(aheadCell.i) - obj.position.x) * tfFwd.x + (cz(aheadCell.j) - obj.position.z) * tfFwd.z; f = Math.min(f, clamp((ahead - 0.7) / 0.14, 0, 1)); held = f < 0.05; }
    }
  }
  // pulling out of a parking bay or off the kerb: wait for a gap in the traffic passing the kerb point
  ud.pullingOut = !!(tr && tr.drive && tr.i === 0 && tr.pts.length > 1);
  if (ud.pullingOut) {   // only traffic that is coming towards the kerb point counts; another car pulling out does not
    const kerb = tr.pts[1];
    for (const v of carMeshes) {
      if (v === obj || !v.visible || v.userData.parked || v.userData.pullingOut || !driving(v)) continue;
      tfRel.subVectors(kerb, v.position); tfRel.y = 0; if (tfRel.length() > 0.6) continue;
      if (tfRel.x * Math.sin(v.rotation.y) + tfRel.z * Math.cos(v.rotation.y) > -0.1) { f = 0; held = true; break; }
    }
  }
  for (const v of carMeshes) {
    if (v === obj || !v.visible || v.userData.parked) continue;
    tfRel.subVectors(v.position, obj.position); tfRel.y = 0;
    const ahead = tfRel.dot(tfFwd);
    if (Math.abs(ahead) <= 0.05) {   // two vehicles on top of each other (set off from the same spot): the younger one waits until the other has gone
      const sameHere = Math.sin(v.rotation.y) * tfFwd.x + Math.cos(v.rotation.y) * tfFwd.z, sideHere = Math.abs(tfRel.x * tfFwd.z - tfRel.z * tfFwd.x);
      if (sameHere > 0.3 && sideHere <= 0.18 && obj.id > v.id && driving(v)) f = 0;
      continue;
    }
    if (ahead < 0 || ahead > 1.1) continue;   // only what is in front matters
    const cross = tfRel.x * tfFwd.z - tfRel.z * tfFwd.x, side = Math.abs(cross);
    if (!driving(v) && side <= 0.2 && ahead < 0.9) { f = Math.min(f, clamp((ahead - 0.45) / 0.2, 0, 1)); if (f < 0.05) held = true; continue; }   // a van stopped for a delivery or a bus at its stop: wait behind it, whichever way it faces
    const same = Math.sin(v.rotation.y) * tfFwd.x + Math.cos(v.rotation.y) * tfFwd.z;
    if (ahead < 0.4 && side < 0.3) {   // last resort, whatever the headings: never drive into a vehicle right in front (face to face, the younger one waits)
      const back = -(tfRel.x * Math.sin(v.rotation.y) + tfRel.z * Math.cos(v.rotation.y)), mutual = back > 0 && Math.abs(tfRel.x * Math.cos(v.rotation.y) - tfRel.z * Math.sin(v.rotation.y)) < 0.3;
      if (!mutual || obj.id > v.id) { f = Math.min(f, clamp((ahead - 0.3) / 0.1, 0, 1)); if (f < 0.05) held = true; }
    }
    if (same > 0.3) { if (side <= 0.18) f = Math.min(f, clamp((ahead - 0.66) / 0.22, 0, 1)); }   // a queue: about a quarter of a car length between bumpers          // a queue: hold back from the car in front
    else if (same > -0.3 && side <= 0.4 && cross > 0) f = Math.min(f, clamp((ahead - 0.55) / 0.2, 0, 1));   // a junction: give way to a car crossing from the left (never mutual, so no deadlock)
  }
  if (held) { ud.heldSince ||= S.T; if (S.T - ud.heldSince > 1) f = Math.max(f, 0.35); } else ud.heldSince = 0;   // after ~10 s at 1× it edges on: never a gridlock
  return f;
}
function moveAlong(obj, tr, dist) {
  const requested = dist;
  const pts = tr.pts;
  while (dist > 0 && tr.i < pts.length - 1) {
    const a = pts[tr.i], b = pts[tr.i + 1], segLen = a.distanceTo(b) || 0.0001, remain = segLen - tr.t;
    if (dist < remain) { tr.t += dist; dist = 0; } else { dist -= remain; tr.i++; tr.t = 0; }
  }
  if (obj.bikeParts) rollBike(obj, requested - dist);
  if (obj.userData.wheels) { const a = (requested - dist) / (obj.userData.wheelRadius || 0.05); for (const w of obj.userData.wheels) w.rotation.x += a; }   // work trucks roll their wheels
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
      if (r.outside) { if (S.T < r.outside) continue; r.outside = 0; r.mesh.visible = false; const ch = r.mesh.userData.char; if (ch) { clearCharacterProp(ch); ch.pose = null; } }   // done in the garden: indoors
      if (r.spot && r.spot.kind === 'seat' && r.mesh.visible && !r.vendingAt) tickSitter(r);
      if (r.sipAt && S.T >= r.sipAt) { r.sipAt = 0; const ch = r.mesh.userData.char; if (ch && r.vendingAt) { holdItem(ch, makeCan(r)); ch.pose = 'drink'; r.activity = pick(DRINK_ACTS); r.mesh.rotation.y = r.vendingAt.rot + Math.PI * 0.85; } }   // turn from the machine and drink
      if (S.T >= r.next) decide(r);
      if (r.home && !r.job && S.T >= r.jobSearchAt) { findJob(r); r.jobSearchAt = S.T + rand(1.5, 3); }
      continue;
    }
    const tr = r.trip; if (!tr) { r.state = 'inside'; continue; }
    if (tr.holdUntil) { if (S.T < tr.holdUntil) continue; tr.holdUntil = 0; r.paused = false; arrive(r); continue; }
    const obj = tr.drive ? r.car : tr.ride ? r.bike : r.mesh;
    if ((frameNo + r.id) % 20 === 0) { lodV.copy(obj.position).project(camera); r.far = farZoom || Math.abs(lodV.x) > 1.15 || Math.abs(lodV.y) > 1.15; }
    r.lodDist += tr.speed * simDt;
    if (r.far && (frameNo + r.id) % 6 !== 0) continue;
    if (tr.drive) r.lodDist *= trafficFactor(obj, tr);
    const P = tr.pts;   // at a signalled crossing a walker waits at the kerb while the cars along the street have the green
    if (!tr.drive && !tr.ride && P.crossAt !== undefined && tr.i === P.crossAt && tr.t < 0.03 && signalCells.has(P.crossCell) && signalState(P.crossCell, P.crossAxis) !== 'red') { if (!r.paused) { r.paused = true; r.heldAct = r.activity; r.activity = 'waiting to cross'; } r.lodDist = 0; continue; }
    if (r.paused) { r.paused = false; if (r.heldAct) r.activity = r.heldAct; }
    if (r.meetUntil) { if (S.T < r.meetUntil) { r.lodDist = 0; continue; } r.meetUntil = 0; if (r.heldAct) r.activity = r.heldAct; }   // stopped for a word with a neighbour
    if (!tr.drive && !tr.ride && !r.far && (frameNo + r.id) % 15 === 0 && S.T - (r.metAt || -9) > 3) meetPasser(r);
    const done = moveAlong(obj, tr, r.lodDist); r.lodDist = 0;
    if (tr.ride) {
      seatRider(r.mesh, r.bike);
    }
    else if (!tr.drive && !r.far && !r.mesh.userData.char) r.mesh.position.y += Math.abs(Math.sin(realT * 9 + r.phase)) * 0.018 * Math.min(1, S.speed);
    if (done) arrive(r);
  }
}

// ───────────────────────────── ambient wanderers (cars, cats & neighbourhood Shibas) ─────────────────────────────
/** do two residents know each other? the same household, home block or workplace */
function knows(a, b) { return a.hh === b.hh || (a.home && b.home && a.home.block === b.home.block) || (a.job && b.job && a.job.block === b.job.block); }
/** two walkers who know each other, crossing on the pavement: both stop, face each other and have a word, then carry on */
function meetPasser(r) {
  const p = r.mesh.position;
  for (const o of residents) {
    if (o === r || o.state !== 'walking' || !o.trip || o.trip.drive || o.trip.ride || o.meetUntil || o.paused || !o.mesh.visible) continue;
    if (Math.abs(o.mesh.position.x - p.x) > 0.4 || Math.abs(o.mesh.position.z - p.z) > 0.4 || S.T - (o.metAt || -9) < 3 || !knows(r, o)) continue;
    if (Math.random() < 0.5) return;
    const until = S.T + rand(0.12, 0.22);
    for (const [x, y] of [[r, o], [o, r]]) { x.meetUntil = until; x.metAt = S.T; x.heldAct = x.activity; x.activity = 'stopping to say hello'; x.mesh.rotation.y = Math.atan2(y.mesh.position.x - x.mesh.position.x, y.mesh.position.z - x.mesh.position.z); }
    startTalk(r, o, pickTopic(r), until); return;
  }
}
function roadCellsList() { return cells.filter(c => c.type === 'road'); }
let vehicleSource = null;   // the ferry registers here; cars then arrive and leave by sea
function setVehicleSource(src) { vehicleSource = src; }
function adoptWanderer(w) { wanderers.push(w); }
function spawnWanderer(kind) {
  const roads = roadCellsList(); if (!roads.length) return;
  if (kind === 'car' && vehicleSource) { if (!wanderers.some(w => w.kind === 'car' && w.fromFerry === 'queued')) { vehicleSource.requestWanderer(pick(CARS), pick(['kei', 'van', 'truck', 'hatch', 'suv', 'delivery'])); wanderers.push({ kind: 'car', fromFerry: 'queued', mesh: null, trip: null, pause: 0, dead: false }); } return; }
  const c = pick(roads);
  if (kind === 'car' && carMeshes.some(m => m.visible && Math.hypot(m.position.x - cx(c.i), m.position.z - cz(c.j)) < 0.6)) return;   // do not spawn onto another car
  const mesh = kind === 'car' ? makeCar(pick(CARS), pick(['kei', 'van', 'truck', 'truck', 'taxi', 'hatch', 'suv', 'delivery'])) : kind === 'dog' ? makeDog(pick(DOG_COATS)) : makeCat(pick(CAT_COATS));
  const w = { kind, cell: c, mesh, trip: null, pause: 0, dead: false };
  w.mesh.visible = true; w.mesh.position.set(cx(c.i), (c.h || 0) + (kind === 'car' ? 0.08 : 0.1), cz(c.j)); wanderers.push(w);
}
function wanderPick(w) {
  if (w.truck) {   // the collection truck follows its plan, then returns to the centre and is done
    while (w.plan && w.plan.length) { const t = w.plan.shift(); if (driveTo(w, t, true)) return; }
    if (!w.goingBack) { w.goingBack = true; for (const c of w.mesh.userData.cargo || []) c.visible = false; if (driveTo(w, w.back, false)) return; }   // round done: back with an empty bed
    w.dead = true; return;
  }
  const roads = roadCellsList();
  const homes = w.kind === 'car' && Math.random() < 0.15 ? blocks.filter(b => b.type === 'res' && b.stage === DONE && b.street && b.street.length) : null;
  for (let k = 0; k < 6; k++) {
    const t = homes && homes.length ? pick(pick(homes).street) : pick(roads); if (t === w.cell) continue; const path = w.kind === 'car' ? routeVaried([w.cell], [t], true) : routeCells([w.cell], [t]); if (!path || path.length < 3) continue;
    const y = w.kind === 'car' ? 0.08 : 0.1, side = w.kind === 'car' ? 0.17 : 0.36;
    const pts = buildPoints(path, w.mesh.position.clone().setY(y), new THREE.Vector3(cx(t.i), y, cz(t.j)), side, y, w.kind === 'car' ? -1 : (w.lane || (w.lane = Math.random() < 0.5 ? 1 : -1))); pts.pop();
    w.trip = { pts, i: 0, t: 0, speed: w.kind === 'car' ? rand(2.0, 2.8) : w.kind === 'dog' ? rand(.38, .56) : rand(0.35, 0.6), last: t, cells: path, delivery: !!homes }; return;
  }
  w.pause = rand(1, 4);
}
// ── collection day (Phase 5.5): with a recycling centre, every third day homes put bags at the kerb at 6:00 and the
// centre's kei truck does a round from 7:30, clearing each kerb as it stops. Nothing is counted; it is only seen ──
const collection = { day: -1, bagsOut: false, truck: null, truckDay: -1 };
const recyclingCentre = () => blocks.find(b => b.type === 'civic' && b.kind === 'recycling' && b.stage === DONE);
function bagKerb(b) { const u = b.units[0], road = frontRoad(u)[0]; if (!road) return null; const dx = Math.sign(road.i - u.cell.i), dz = Math.sign(road.j - u.cell.j); return { x: cx(u.cell.i) + dx * 0.44 - dz * 0.3, z: cz(u.cell.j) + dz * 0.44 + dx * 0.3, y: (u.cell.h || 0) + 0.1, road }; }
/** collection morning: a resident steps out with the bags, walks to the kerb, sets them down and goes back in */
function carryBags(r) {
  const b = r.home.block, k = bagKerb(b); if (!k) { b.bagsDue = false; putBags(b); return true; }
  b.bagsDue = false; const ch = r.mesh.userData.char; equipCharacterProp(ch, 'shopping-bag', PAL.sky2);
  r.home.inside.delete(r); r.at = null; r.actKind = 'home'; r.until = 0; r.purpose = null;
  startDirectTrip(r, exitPts(r.home)[0], new THREE.Vector3(k.x, 0.1, k.z), 'taking the bags out', () => {
    clearCharacterProp(ch); putBags(b); r.activity = 'back inside';
    startDirectTrip(r, r.mesh.position.clone(), exitPts(r.home)[0], 'heading back in', () => { r.mesh.visible = false; r.at = r.home; r.home.inside.add(r); r.state = 'inside'; r.next = S.T; }, 0.1);
  }, 0.1);
  return true;
}
function putBags(b) {
  const k = bagKerb(b); if (!k || b.bags) return; const g = [], n = 1 + Math.round(hash(b.id, 3));
  for (let i = 0; i <= n; i++) g.push(blob(0.05, i % 2 ? PAL.sky2 : PAL.cream2, k.x + (i - n / 2) * 0.07, k.y + 0.05, k.z + (i % 2) * 0.03, 0, 0.8));
  const m = mergeMesh(g, true); if (m) { townGroup.add(m); b.bags = m; b.bagRoad = k.road; }
}
function clearBags(b) { if (b.bags) { townGroup.remove(b.bags); b.bags.geometry.dispose(); b.bags = null; b.bagRoad = null; } }
const fireRound = { day: -1, truck: null };
function updateFireRound() {
  const st = blocks.find(b => b.type === 'civic' && b.kind === 'firestation' && b.stage === DONE), day = dayOf(), h = hourOf();
  if (fireRound.truck && (fireRound.truck.dead || !wanderers.includes(fireRound.truck))) { fireRound.truck = null; if (st) { st.truckOut = false; if (st.units[0].parkedTruck) st.units[0].parkedTruck.visible = true; } }
  if (!st || fireRound.truck || fireRound.day === day || h < 8.5 || h >= 10) return;
  const start = frontRoad(st.units[0])[0]; if (!start) return;
  const roads = roadCellsList().filter(c => !c.ramp && !c.bridge), stops = []; for (let k = 0; k < 4 && roads.length; k++) stops.push(pick(roads));   // a check round: a few street corners, then home
  const mesh = makeCar('#c9564b', 'kei'); mesh.visible = true; mesh.position.set(cx(start.i), (start.h || 0) + 0.08, cz(start.j));
  const w = { kind: 'car', truck: true, fire: true, cell: start, mesh, trip: null, pause: 0, dead: false, plan: stops, back: start }; wanderers.push(w); fireRound.truck = w; fireRound.day = day;
  st.truckOut = true; if (st.units[0].parkedTruck) st.units[0].parkedTruck.visible = false;
}
const VEG_SHOPS = new Set(['grocery', 'supermarket', 'konbini', 'restaurant', 'ramen', 'cafe', 'florist', 'teahouse']);
let produceDay = -1;
function produceRound() {
  const day = dayOf(), h = hourOf(), season = seasonOf(); if (produceDay === day || h < 8.5 || h >= 11 || (season !== 'summer' && season !== 'autumn')) return;
  produceDay = day;
  const farms = blocks.filter(b => b.type === 'farm' && b.stage === DONE && b.units.some(u => u.staff.length)); if (!farms.length) return;
  const farm = farms[day % farms.length], start = frontRoad(farm.units[0])[0]; if (!start) return;
  const greens = farm.kind === 'greenhouse';   // flowers and seedlings go to the florist, vegetables everywhere else
  const shops = blocks.filter(b => b.type === 'shop' && b.stage === DONE && VEG_SHOPS.has(b.kind) && (greens ? b.kind === 'florist' || b.kind === 'grocery' : b.kind !== 'florist') && !b.changing && frontRoad(b.units[0]).length);
  if (!shops.length) return;
  const stops = [], left = new Set(shops); let at = start;
  while (left.size) { let best = null, bd = 1e9; for (const b of left) { const r = frontRoad(b.units[0])[0], d = Math.abs(r.i - at.i) + Math.abs(r.j - at.j); if (d < bd) { bd = d; best = b; } } left.delete(best); const r = frontRoad(best.units[0])[0]; if (!stops.includes(r)) stops.push(r); at = r; }
  const mesh = makeCar(null, 'kei-farm'); mesh.visible = true; mesh.position.set(cx(start.i), (start.h || 0) + 0.08, cz(start.j));   // the farm's keitora, crates in the bed
  wanderers.push({ kind: 'car', truck: true, fishVan: true, cell: start, mesh, trip: null, pause: 0, dead: false, plan: stops, back: start,
    onStop: road => { for (const b of shops) if (frontRoad(b.units[0])[0] === road && b.produceDay !== day) { b.produceDay = day; for (const u of b.units) rebuildUnitMesh(u); } } });
  if (!chronicle.some(e => /first harvest/.test(e.text))) record(`The first harvest from ${farm.name} went to the town's shops`);
}
const FISH_SHOPS = new Set(['grocery', 'supermarket', 'ramen', 'restaurant', 'konbini']);   // the konbini sells it as bento
onCatch(day => {
  const q = landmarkRoads().find(o => o.l.kind === 'pier' || o.l.kind === 'fishmarket'); if (!q) return;
  const shops = blocks.filter(b => b.type === 'shop' && b.stage === DONE && FISH_SHOPS.has(b.kind) && !b.changing && b.units[0] && frontRoad(b.units[0]).length);
  if (!shops.length) return;
  const start = q.road, stops = [], left = new Set(shops); let at = start;
  while (left.size) { let best = null, bd = 1e9; for (const b of left) { const r = frontRoad(b.units[0])[0], d = Math.abs(r.i - at.i) + Math.abs(r.j - at.j); if (d < bd) { bd = d; best = b; } } left.delete(best); const r = frontRoad(best.units[0])[0]; if (!stops.includes(r)) stops.push(r); at = r; }
  const mesh = makeCar(null, 'fish-van'); mesh.visible = true; mesh.position.set(cx(start.i), (start.h || 0) + 0.08, cz(start.j));
  wanderers.push({ kind: 'car', truck: true, fishVan: true, cell: start, mesh, trip: null, pause: 0, dead: false, plan: stops, back: start,
    onStop: road => { for (const b of shops) if (frontRoad(b.units[0])[0] === road && b.fishDay !== day) { b.fishDay = day; for (const u of b.units) rebuildUnitMesh(u); } } });
  if (!chronicle.some(e => /fresh fish/.test(e.text))) record('Fresh fish from the quay reached the town\'s shops');
});
function updateCollection() {
  updateFireRound(); produceRound(); serviceRounds();
  const centre = recyclingCentre(), day = dayOf(), h = hourOf(), isDay = day % 3 === 0;
  if (!centre) { if (collection.bagsOut) { for (const b of blocks) clearBags(b); collection.bagsOut = false; } return; }
  if (isDay && h >= 6 && h < 11 && collection.day !== day) { collection.day = day; collection.bagsOut = true; for (const b of blocks) if (b.type === 'res' && b.stage === DONE) { b.bagsDue = true; b.bagsBy = S.T + 1.2; } }   // someone at home carries them out; unclaimed bags appear by 7:15
  if (collection.bagsOut) for (const b of blocks) if (b.bagsDue && S.T >= b.bagsBy) { b.bagsDue = false; putBags(b); }
  if (collection.bagsOut && (h >= 11 || !isDay)) { for (const b of blocks) { clearBags(b); b.bagsDue = false; } collection.bagsOut = false; }
  if (collection.truck && (collection.truck.dead || !wanderers.includes(collection.truck))) collection.truck = null;
  if (isDay && h >= 7.5 && h < 10 && !collection.truck && collection.truckDay !== day) {
    const start = frontRoad(centre.units[0])[0]; if (!start) return;
    const left = new Set(blocks.filter(b => b.bags && b.bagRoad)), stops = []; let at = start;   // nearest-first round of every kerb with bags
    while (left.size) { let best = null, bd = 1e9; for (const b of left) { const d = Math.abs(b.bagRoad.i - at.i) + Math.abs(b.bagRoad.j - at.j); if (d < bd) { bd = d; best = b; } } left.delete(best); if (!stops.includes(best.bagRoad)) stops.push(best.bagRoad); at = best.bagRoad; }
    const mesh = makeCar('#dfe6ea', 'garbage'); mesh.visible = true; mesh.position.set(cx(start.i), (start.h || 0) + 0.08, cz(start.j));
    const w = { kind: 'car', truck: true, cell: start, mesh, trip: null, pause: 0, dead: false, plan: stops, back: start }; wanderers.push(w); collection.truck = w; collection.truckDay = day;
  }
}
// ── the service rounds (src/service-vehicles.js): the post, the clinic's ambulance, the kōban's bicycle, food deliveries ──
/** put a rider on a two-wheeler's seat, facing its way (the seat is in the vehicle's own units, before its group scale) */
function seatRider(mesh, bike) {
  const s = bike.userData.seat || BIKE_SEAT, k = bike.scale.x;
  mesh.position.copy(bike.position); mesh.position.y += s.y * k - 0.09 * PEOPLE;
  mesh.position.x += Math.sin(bike.rotation.y) * s.z * k; mesh.position.z += Math.cos(bike.rotation.y) * s.z * k;
  mesh.rotation.y = bike.rotation.y; mesh.visible = bike.visible;
}
/** a person for a service round: not a resident, seated on the vehicle; characters.js poses the arms at its grips */
function makeRider(look, bike) {
  const o = { id: S.nextId++, name: look.name || '', skin: pick(SKIN), hair: pick(HAIR), pants: '#4a4340', bag: false, ...look, state: 'walking', paused: false, trip: { ride: true }, bike };
  const mesh = makePerson(o); mesh.userData.res = null; mesh.userData.rider = o; mesh.visible = true; o.mesh = mesh;
  if (mesh.userData.char) mesh.userData.char.sitting = true;
  return o;
}
/** dev hook: stand a service vehicle (with a rider on a two-wheeler) at a spot, for renders and tests */
function stageService(kind, x, z, ry, look = {}) {
  const two = kind !== 'postal-van' && kind !== 'ambulance', mesh = two ? createService(kind) : makeCar(null, kind); if (!mesh) return null;
  if (two) peopleGroup.add(mesh); mesh.visible = true; mesh.userData.parked = true; mesh.position.set(x, 0.08, z); mesh.rotation.y = ry;
  const rider = two ? makeRider({ shirt: '#5d6b8a', hat: false, ...look }, mesh) : null; if (rider) seatRider(rider.mesh, mesh);
  return { mesh, rider };
}
function dropRider(o) { detachCharacter(o.mesh); peopleGroup.remove(o.mesh); disposeGroup(o.mesh); }
/** a two-wheeler with its rider, as a wanderer following a plan of kerbs; it waits at each */
function twoWheelRound(kind, start, stops, look, stopPause, extra = {}) {
  const mesh = createService(kind); if (!mesh) return null;
  mesh.visible = true; mesh.position.set(cx(start.i), (start.h || 0) + 0.08, cz(start.j)); peopleGroup.add(mesh);
  if (kind === 'police-bike') mesh.userData.pedals = true;
  const w = { kind: 'moto', truck: true, service: true, cell: start, mesh, trip: null, pause: 0, dead: false, plan: stops, back: start, side: 0.315, speed: kind === 'police-bike' ? 1.5 : 2.2, stopPause, ...extra };
  w.rider = makeRider(look, mesh); seatRider(w.rider.mesh, mesh); wanderers.push(w); return w;
}
const roundDone = {};   // round name → the day it last ran
const busyRound = name => wanderers.some(w => w.round === name && !w.dead);
function nearestFirst(start, cellsList) { const left = new Set(cellsList), out = []; let at = start; while (left.size) { let best = null, bd = 1e9; for (const c of left) { const d = Math.abs(c.i - at.i) + Math.abs(c.j - at.j); if (d < bd) { bd = d; best = c; } } left.delete(best); if (!out.includes(best)) out.push(best); at = best; } return out; }
let ambulance = null;   // { mesh, unit }: parked at the clinic's kerb between its rounds
function serviceRounds() {
  if (!serviceReady()) return;
  const day = dayOf(), h = hourOf(), sunday = day % 7 === 6, stationRoad = STATION.anchor ? roadNeighbors(STATION.anchor.cell)[0] : null;
  const homes = blocks.filter(b => b.type === 'res' && b.stage === DONE && b.units.some(u => u.residents.length) && frontRoad(b.units[0]).length);
  // the post van: a morning round collecting from the post boxes outside the shops (not on Sundays)
  if (!sunday && h >= 9 && h < 10.5 && roundDone.post !== day && stationRoad) {
    roundDone.post = day;
    const shops = blocks.filter(b => b.type === 'shop' && b.stage === DONE && frontRoad(b.units[0]).length).map(b => frontRoad(b.units[0])[0]);
    if (shops.length) {
      const mesh = makeCar(null, 'postal-van'); mesh.visible = true; mesh.position.set(cx(stationRoad.i), (stationRoad.h || 0) + 0.08, cz(stationRoad.j));
      wanderers.push({ kind: 'car', truck: true, service: true, round: 'post', cell: stationRoad, mesh, trip: null, pause: 0, dead: false, plan: nearestFirst(stationRoad, shops.slice(0, 6)), back: stationRoad, stopPause: 2.5 });
    }
  }
  // the postman on the red motorbike: letters to the homes in the afternoon
  if (!sunday && h >= 13.5 && h < 15 && roundDone.mail !== day && stationRoad && homes.length) {
    roundDone.mail = day;
    const stops = nearestFirst(stationRoad, homes.sort(() => Math.random() - 0.5).slice(0, 7).map(b => frontRoad(b.units[0])[0]));
    twoWheelRound('postal-bike', stationRoad, stops, { name: 'the postman', shirt: '#5d6b8a', hat: false }, 1.2, { round: 'mail' });
  }
  // the kōban's officer on the white bicycle: a patrol of the streets round the station, mid-morning and late afternoon
  for (const [name, from, to] of [['patrolAM', 10, 11.5], ['patrolPM', 15.5, 17]]) {
    if (h >= from && h < to && roundDone[name] !== day && stationRoad && !busyRound('patrol')) {
      roundDone[name] = day;
      const near = roadCellsList().filter(c => !(c.h || 0) && Math.abs(c.i - stationRoad.i) + Math.abs(c.j - stationRoad.j) <= 7 && c !== stationRoad);
      const stops = nearestFirst(stationRoad, near.sort(() => Math.random() - 0.5).slice(0, 4));
      if (stops.length) twoWheelRound('police-bike', stationRoad, stops, { name: 'the officer', shirt: '#3f4f6b', pants: '#2f3a4f', hat: false }, 3, { round: 'patrol' });
    }
  }
  // food deliveries: at lunch and supper a ramen shop or restaurant with staff sends a scooter to a home and back
  for (const [name, from, to] of [['lunch', 11.8, 13], ['supper', 18.3, 20.3]]) {
    if (h < from || h >= to || roundDone[name] === day || !homes.length) continue;
    const kitchens = blocks.filter(b => b.type === 'shop' && b.stage === DONE && (b.kind === 'ramen' || b.kind === 'restaurant') && b.units.some(u => u.staff.length) && frontRoad(b.units[0]).length);
    if (!kitchens.length) continue;
    roundDone[name] = day;
    const k = pick(kitchens), start = frontRoad(k.units[0])[0], home = pick(homes);
    twoWheelRound('delivery-scooter', start, [frontRoad(home.units[0])[0]], { name: 'the delivery rider', shirt: '#f3e6cf', hat: false }, 1.5, { round: 'food' });
  }
  // the clinic's ambulance: parked at its kerb, out once a day on a quiet home visit with its beacons pulsing
  const clinic = blocks.find(b => b.type === 'civic' && b.kind === 'clinic' && b.stage === DONE);
  if (!clinic) { if (ambulance) { peopleGroup.remove(ambulance.mesh); disposeGroup(ambulance.mesh); const ci = carMeshes.indexOf(ambulance.mesh); if (ci >= 0) carMeshes.splice(ci, 1); ambulance = null; } return; }
  if (!ambulance || ambulance.unit.block !== clinic) { ambulance = { mesh: makeCar(null, 'ambulance'), unit: clinic.units[0] }; parkVehicle(ambulance.mesh, ambulance.unit, 'car'); ambulance.mesh.visible = true; }
  const beacons = ambulance.mesh.userData.beacons || [], out = busyRound('clinic');
  if (beacons.length) beacons[0].material.emissiveIntensity = out ? 0.8 + 0.8 * Math.sin(S.T * 150) : 0;
  if (h >= 10.3 && h < 11.5 && roundDone.clinic !== day && homes.length && !out) {
    roundDone.clinic = day;
    const start = frontRoad(clinic.units[0])[0], who = residents.filter(r => r.home && r.at === r.home).sort((a, b) => a.needs.energy - b.needs.energy)[0], target = who ? frontRoad(who.home)[0] : frontRoad(pick(homes).units[0])[0];
    if (start && target) {
      const m = ambulance.mesh; m.userData.parked = false; m.position.set(cx(start.i), (start.h || 0) + 0.08, cz(start.j));
      wanderers.push({ kind: 'car', truck: true, service: true, round: 'clinic', keepMesh: true, cell: start, mesh: m, trip: null, pause: 0, dead: false, plan: [target], back: start, stopPause: 4,
        onDone: () => { parkVehicle(m, ambulance.unit, 'car'); m.visible = true; } });
    }
  }
}
/** a planned drive for the truck: to `t`, stopping there when `stop` */
function driveTo(w, t, stop) {
  if (!t || w.cell === t) return false; const path = routeVaried([w.cell], [t], true); if (!path || path.length < 2) return false;
  const pts = buildPoints(path, w.mesh.position.clone().setY(0.08), new THREE.Vector3(cx(t.i), 0.08, cz(t.j)), w.side || 0.17, 0.08, -1); if (pts.length > 2) pts.pop();   // stop in the lane by the kerb, not in the middle of the road
  w.trip = { pts, i: 0, t: 0, speed: w.speed || 1.9, last: t, cells: path, stop }; return true;
}
function updateWanderers(simDt) {
  updateCollection();
  const R = roadCellsList().length;
  const wantCars = Math.min(8, Math.floor(R / 16)), wantCats = Math.min(4, Math.floor(R / 22)), wantDogs = Math.min(2, Math.floor(R / 50));
  const cars = wanderers.filter(w => w.kind === 'car'), cats = wanderers.filter(w => w.kind === 'cat'), dogs = wanderers.filter(w => w.kind === 'dog');
  if (cars.length < wantCars) spawnWanderer('car'); if (cats.length < wantCats) spawnWanderer('cat'); if (dogs.length < wantDogs) spawnWanderer('dog');
  for (let k = wanderers.length - 1; k >= 0; k--) {
    const w = wanderers[k];
    const excess = (w.kind === 'car' && !w.truck && cars.length > wantCars) || (w.kind === 'cat' && cats.length > wantCats) || (w.kind === 'dog' && dogs.length > wantDogs);
    if (w.fromFerry === 'queued') { if (wanderers.some(x => x !== w && x.kind === 'car' && x.fromFerry === true && !x.seen)) { wanderers.splice(k, 1); const nw = wanderers.find(x => x.kind === 'car' && x.fromFerry === true && !x.seen); if (nw) nw.seen = true; } continue; }   // waiting for the sailing
    if (!w.mesh) { wanderers.splice(k, 1); continue; }
    if (w.dead && w.keepMesh) { w.onDone && w.onDone(); if (w.rider) dropRider(w.rider); wanderers.splice(k, 1); continue; }   // the ambulance goes back to its bay
    if (w.dead && w.rider) dropRider(w.rider);
    if (w.dead || (excess && !w.trip && !w.leaving && !vehicleSource)) { peopleGroup.remove(w.mesh); disposeGroup(w.mesh); const ci = carMeshes.indexOf(w.mesh); if (ci >= 0) carMeshes.splice(ci, 1); wanderers.splice(k, 1); continue; }
    if (excess && !w.trip && !w.leaving && vehicleSource && w.kind === 'car') {   // time to go: drive to the slipway and wait for the ferry
      const slip = vehicleSource.slip ? vehicleSource.slip() : null; const path = slip && w.cell ? routeCells([w.cell], [slip]) : null;
      if (path && path.length >= 2) { const pts = buildPoints(path, w.mesh.position.clone().setY(0.08), new THREE.Vector3(cx(slip.i), 0.08, cz(slip.j)), 0.17, 0.08, -1); w.trip = { pts, i: 0, t: 0, speed: rand(2.0, 2.6), last: slip, cells: path }; w.leaving = true; }
      else { w.dead = true; }
      continue;
    }
    if (w.leaving && !w.trip) { vehicleSource.boardCar(w.mesh); wanderers.splice(k, 1); continue; }
    if (w.kind === 'cat') updateCat(w.mesh, simDt, w.pause <= 0 && !!w.trip);
    if (w.kind === 'dog') updateDog(w.mesh, simDt, w.pause <= 0 && !!w.trip, w.pause > 3, w.pause > 0 && w.pause <= 3);
    if (w.pause > 0) { w.pause -= simDt; continue; }
    if (!w.trip) { wanderPick(w); continue; }
    const moved = moveAlong(w.mesh, w.trip, w.trip.speed * simDt * (w.kind === 'car' || w.kind === 'moto' ? trafficFactor(w.mesh) : 1));
    if (w.rider) seatRider(w.rider.mesh, w.mesh);
    if (moved) {
      const dl = w.trip.delivery, stop = w.truck && w.trip.stop, last = w.trip.last; w.cell = last; w.trip = null;
      if (stop && !w.fishVan && !w.service) for (const b of blocks) if (b.bags && b.bagRoad === last) clearBags(b);   // the truck takes the bags from this kerb
      if (stop && w.onStop) w.onStop(last);   // the fish van leaves the catch here
      w.pause = w.stopPause && stop ? w.stopPause : w.kind === 'cat' ? rand(2, 8) : w.kind === 'dog' ? rand(2, 7) : stop ? (w.fire ? 3 : 5) : dl ? rand(6, 12) : rand(0.2, 1.5);   // a delivery van waits at the kerb a while; the fire truck a moment at each corner
    }
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
  if (b.level === 1) return town.length >= 3 && (b.type === 'res' ? (types.has('work') || types.has('shop') || types.has('civic')) : types.has('res'));
  if (b.level === 2) return town.length >= 6 && types.size === 3;
  return false;
}
/** at the turn of the day: a shop's customers become its standing. Busy shops hang nobori banners; a shop nobody visits
 *  for three days, in a town with other shops, closes and reopens as another trade of its size (never the town's last shop). */
function reckonShops() {
  const shops = blocks.filter(b => b.type === 'shop' && b.stage === DONE);
  for (const b of shops) if ((b.fishDay && b.fishDay < dayOf()) || (b.produceDay && b.produceDay < dayOf())) { if (b.fishDay < dayOf()) b.fishDay = 0; if (b.produceDay < dayOf()) b.produceDay = 0; for (const u of b.units) rebuildUnitMesh(u); }   // yesterday's crates are gone
  for (const b of shops) {
    b.lastVisits = b.visitsToday || 0; b.visitsToday = 0;
    const staffed = b.units.some(u => u.staff.length);
    const popular = b.lastVisits >= 5 * b.level;
    if (popular !== !!b.popular) { b.popular = popular; for (const u of b.units) rebuildUnitMesh(u); }
    if (b.renoT > 0) continue;
    if (b.kind === 'ryokan' || b.picked) { b.quietDays = 0; continue; }   // the inn, and a shop the player chose, keep their trade through quiet weeks
    if (b.lastVisits < b.level && staffed && S.T - b.created > 30 && shops.length >= 3) b.quietDays = (b.quietDays || 0) + 1; else b.quietDays = 0;
    if (b.quietDays >= 3) changeTrade(b);
  }
}
function changeTrade(b) {
  const next = chooseKind('shop', b.cells, b.kind); if (!next) return;   // whatever the neighbourhood lacks
  const old = b.name;
  for (const u of b.units) for (const r of u.staff.slice()) { r.job = null; r.returnTo = null; if (r.at === u) r.next = S.T; } for (const u of b.units) u.staff.length = 0;
  b.kind = next; b.name = uniqueName(SHOP_NAMES[b.kind]); b.visitScore = 0; b.quietDays = 0; b.popular = false; b.occT = 0;
  b.renoT = 3; b.changing = true;   // shutters down and scaffold up while the fit-out happens
  for (const u of b.units) rebuildUnitMesh(u, true);
  toast(`${old} has closed. A ${(KIND_LABEL[b.kind] || b.kind).toLowerCase()} is opening in its place`);
}
let hillVisits = 0, hillVisitsYesterday = 0;
/** the hill plot market: a settled, fully employed household builds a villa with a view; once people walk up, a tea house opens */
function hillMarket() {
  hillVisitsYesterday = hillVisits; hillVisits = 0;
  if (!hill.open) return;
  if (!hillPlots().length) layTerraceLane();   // with streets first, the hill has only its slopes: the town lays one short lane along a terrace
  const plots = hillPlots(); if (!plots.length) return;
  const villas = blocks.filter(b => b.type === 'res' && b.variant === 'villa');
  const settled = hh => hh.home && !hh.home.removed && (hh.home.cell.h || 0) === 0 && hh.members.length && hh.members.every(m => (m.job || m.commuter) && S.T - m.arrivedT > 48 && m.state !== 'away');
  if (!blocks.some(b => b.type === 'res' && b.variant === 'villa' && b.stage < DONE)) {   // one villa going up at a time
    const hh = pick(households.filter(settled).concat([null]).slice(0, -1) || []) || null;
    if (hh && (Math.random() < 0.6 || !villas.length)) {   // the first villa comes as soon as someone qualifies
      const plot = plots.sort((a, b) => (b.h - a.h) || (Math.hypot(cx(b.i), cz(b.j)) - Math.hypot(cx(a.i), cz(a.j))))[0];   // the highest plot with the widest view
      const b = placeBlock('res', [plot], { variant: 'villa', name: `${hh.surname} Villa`, summoned: true, villaFor: hh.id, roofStyle: 'kawara' });
      if (b) toast(`The ${hh.surname} household is building a villa on the hill`);
    }
  }
  const tea = blocks.some(b => b.type === 'shop' && b.kind === 'teahouse');
  if (!tea && villas.length >= 1 && (hillVisitsYesterday >= 6 || window.__forceVisits)) {
    if (!hillPlots().length) layTerraceLane();
    const left = hillPlots(); if (!left.length) return;
    const plot = left.sort((a, b) => Math.hypot(cx(a.i) - hillCentre.x, cz(a.j) - hillCentre.z) - Math.hypot(cx(b.i) - hillCentre.x, cz(b.j) - hillCentre.z))[0];   // nearest the shrine path
    const b = placeBlock('shop', [plot], { kind: 'teahouse', roofStyle: 'kawara' }); if (b) b.name = uniqueName(SHOP_NAMES.teahouse);   // named for its trade, not the tier's draw
    if (b) toast(`${b.name} is being built on the hill, where the walkers go`);
  }
  const inn = blocks.some(b => b.type === 'shop' && b.kind === 'ryokan'), visitors = chronicle.some(e => /first visitors came/.test(e.text));
  if (!inn && tea && visitors) {   // visitors are coming and the hill has its tea house: an inn for those who stay the night
    if (!hillPlots().length) layTerraceLane();
    const left = hillPlots(); if (!left.length) return;
    const plot = left.sort((a, b) => (b.h - a.h) || (Math.hypot(cx(b.i), cz(b.j)) - Math.hypot(cx(a.i), cz(a.j))))[0];   // high, with the view out to sea
    const b = placeBlock('shop', [plot], { kind: 'ryokan', roofStyle: 'kawara' });
    if (b) { b.name = uniqueName(SHOP_NAMES.ryokan); toast(`${b.name}, a ryokan for visitors, is being built on the hill`); record(`Work began on ${b.name}, the town's first ryokan`); }
  }
}
/** a short permanent lane along a terrace from the top of an island slope, so the hill has plots the town can take up */
function layTerraceLane() {
  for (const r of cells) {
    if (!r.ramp || !r.keep) continue;
    const { di, dj, h1 } = r.ramp, H = cell(r.i + di, r.j + dj); if (!H || H.type !== 'road') continue;
    for (const [pi, pj] of [[-dj, di], [dj, -di]]) {
      // the lane may run through the terrace woods: those cells are cleared first, and so are the plots either side of it
      const ok = c => !!c && !c.keep && !c.ramp && !c.landmark && Math.abs((c.h || 0) - h1) < 1e-6 && (c.type === 'empty' || c.type === 'hill' || c.type === 'road');
      const run = []; for (let k = 1; k <= 3; k++) { const c = cell(H.i + pi * k, H.j + pj * k); if (!ok(c)) break; run.push(c); }
      if (run.length < 2) continue;
      for (const c of run) if (c.type === 'hill') { c.type = 'empty'; c.tree = null; }
      if (!drawRoad(run[0], run[run.length - 1])) continue;
      for (const c of run) for (const [a, b] of DIR4) { const n = cell(c.i + a, c.j + b); if (n && n.type === 'hill' && !n.keep && !n.ramp && Math.abs((n.h || 0) - h1) < 1e-6) { n.type = 'empty'; n.tree = null; } }
      refreshWorld(); toast('A lane was laid along the terrace, and plots cleared beside it'); return true;
    }
  }
  return false;
}
/** a household moves up to its finished villa; their old home frees up for newcomers */
function moveUp(hh, u) {
  const old = hh.home; hh.home = u;
  for (const r of hh.members) {
    if (old && old.residents.includes(r)) old.residents.splice(old.residents.indexOf(r), 1);
    r.home = u; u.residents.push(r); u.incoming++; r.movingIn = true; r.returnTo = null; r.until = 0;
    if (r.carAt === old) { r.carAt = u; if (r.car) parkVehicle(r.car, u, 'car'); }
    if (r.bikeAt === old) { r.bikeAt = u; if (r.bike) parkVehicle(r.bike, u, 'bike'); }
    if (r.state === 'inside' && r.at) { if (!go(r, u, 'moving up to the villa')) r.next = S.T; } else r.next = S.T;
  }
  if (old) old.lastMoveIn = S.T;
  toast(`The ${hh.surname} household has moved up to ${u.block.name}`);
}
function updateBlocks(dh) {
  const day = dayOf(); if (day !== lastDay) { lastDay = day; for (const b of blocks) b.visitScore *= 0.5; reckonShops(); hillMarket(); }
  if (!hill.open && residents.filter(r => r.home).length >= HILL_UNLOCK) openHill();
  if (STATION.block) updateStation();
  for (const b of blocks) {
    if (b.type === 'station') continue;
    if (b.stage < DONE) {
      b.stageT += dh * progressRate(b);
      if (b.type === 'res' && b.stage === DONE - 1 && !b.summoned) { b.summoned = true; for (const u of b.units) for (const size of splitHouseholds(unitCap(u))) bookings.push({ hh: makeHousehold(size, u) }); }
      if (b.stageT >= stageHours(b)[b.stage]) {
        b.stage++; b.stageT = 0; for (const u of b.units) rebuildUnitMesh(u, true); if (b.stage === DONE) { toast(`${b.name} is finished`); if (b.type === 'civic') { refreshCivicFlags(); record(`${b.name} opened`); } else if (!blocks.some(x => x !== b && x.type === b.type && x.stage === DONE)) record(b.type === 'res' ? `The first home, ${b.name}, was finished` : b.type === 'shop' ? `The first shop, ${b.name}, opened` : `The first workplace, ${b.name}, opened`); }
        if (b.stage === DONE && b.villaFor) {   // the household that ordered the villa moves up; if they are gone, it is let like any home
          const hh = households.find(h => h.id === b.villaFor); b.villaFor = null;
          if (hh && hh.home && hh.members.length) moveUp(hh, b.units[0]); else b.summoned = false;
        }
      }
      continue;
    }
    if (b.renoT > 0) { b.renoT -= dh; if (b.renoT <= 0) { b.renoT = 0; if (b.changing) { b.changing = false; toast(`${b.name} is open`); } for (const u of b.units) rebuildUnitMesh(u); } }
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
    if (b.occT >= 20 && b.level < maxLevel(b) && b.variant !== 'villa' && growthAllowed(b)) { b.level++; b.occT = 0; b.renoT = 2.5; for (const u of b.units) rebuildUnitMesh(u, true); toast(`${b.name} is being extended`); if (b.level === 3) record(`${b.name} grew to three storeys`); }
  }
}

// ───────────────────────────── removing a block ─────────────────────────────
/** the Remove tool on a car park: its cars go back to their homes' kerbs, then the ground is cleared */
function removeCarPark(c) {
  if (c.park !== 'public') return false;
  const cars = residents.filter(r => r.car && r.car.userData.bayCell === c);
  clearCarPark(c);
  for (const r of cars) { r.car.userData.bayCell = undefined; if (r.carAt && !r.carAt.removed && r.car.visible) parkVehicle(r.car, r.carAt, 'car'); }
  return true;
}
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
  rebuildNetwork();     // hill slopes, links and bridges settle for the blocks that remain; streets are the player's and stay
  refreshWorld();
}

onWorldChange(() => {   // a street removed or built over: ambient traffic on it leaves, residents on it find another way
  pathCache.clear();
  const gone = tr => !!tr && !!tr.cells && tr.cells.some(c => c.type !== 'road');
  for (const w of wanderers) if ((w.cell && w.cell.type !== 'road') || gone(w.trip)) w.dead = true;
  for (const r of residents) {
    const tr = r.trip; if (!gone(tr)) continue;
    const obj = tr.drive ? r.car : tr.ride ? r.bike : r.mesh, here = cellAt(obj.position), dest = tr.dest;
    const targets = dest ? frontRoad(dest) : [];
    const path = here && here.type === 'road' && targets.length ? routeCells([here], targets) : null;
    if (path && dest) { startTrip(r, path, obj.position.clone().setY(0), dest === STATION.anchor ? STATION.entrance : entryPts(dest), dest, tr.label || r.activity, tr.from); continue; }
    // stranded with no street under them: they slip indoors (home, or the station plaza) and carry on from there
    r.trip = null; if (r.car) r.car.visible = false; if (r.bike) r.bike.visible = false; r.mesh.visible = false; r.paused = false;
    const at = r.home || STATION.anchor; r.at = at; at.inside.add(r); r.state = 'inside'; r.next = S.T + 0.05; r.purpose = null;
  }
});

export { stageService, routeVaried, removeCarPark, setVehicleSource, adoptWanderer, parkVehicle, reckonShops, changeTrade, hillMarket, HPS, hourOf, dayOf, daylight, routeCells, routeUnits, carMeshes, residents, wanderers, shopUnits, jobUnits, households, hhName, hhLabel, moodWords, restoreResident, restoreHousehold,
  updateResidents, updateWanderers, updateBlocks, growthAllowed, removeBlock, nextTrainAt, spawnNewcomer, removeResident,
  roadNeighbors, frontRoad, buildPoints, makePerson, makeCar, moveAlong, trafficFactor, unitPos, setProgressRate, onTrain };
