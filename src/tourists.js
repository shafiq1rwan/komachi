// Komachi — visitors for the day. Tourists come up the station stairs off the morning trains (a few on fine weekend days, now
// and then on a weekday), walk out to one or two of the island's landmarks, raise a camera and take a few photos (a little
// flash each time), often stop at a shop on the way back (the visit counts for the shop, and they leave with a paper bag),
// and go home on an afternoon train. They are not residents: no home, no needs, not saved (a reload sends them home).
// On weekends the tourist bus comes over on the 7:00 ferry, runs between a stop by the station and a stop near the
// lighthouse, carrying the visitors who are going that way, and leaves on the 17:00 ferry. Its two shelters stay on the
// pavement once the stops exist. Nothing here is counted or scored: the effect is people, a bus and busier shops.
import * as THREE from 'three';
import { S } from './state.js';
import { pick, rand } from './utils.js';
import { GIVEN, FAMILY, SKIN, HAIR } from './palette.js';
import { peopleGroup, disposeGroup, cx, cz, scene, HALF } from './scene.js';
import { cell, STATION, stationStairs, blocks, DONE, isOpen } from './world.js';
import { hourOf, dayOf, routeCells, roadNeighbors, frontRoad, buildPoints, makePerson, moveAlong, onTrain, carMeshes, shopUnits, trafficFactor } from './sim.js';
import { landmarkRoads } from './landmarks.js';
import { detachCharacter, holdItem, dropItem } from './characters.js';
import { equipCharacterProp, clearCharacterProp } from './character-props.js';
import { unitDoorPoints } from './buildings.js';
import { createFestivalLandmark } from './festival-landmark-kit.js';
import { createStreetFurniture } from './street-furniture.js';
import { ferry, shipVehicle, boardCar } from './ferry.js';
import { chronicle, record } from './chronicle.js';
import { toast } from './toast.js';
import { W } from './weather.js';
import { eventVisit, festivalDay } from './events.js';

const tourists = [];
const tourism = { forceWeekend: false };   // dev hook: treat today as a weekend (tests)
const isWeekend = () => tourism.forceWeekend || [6, 0].includes(dayOf() % 7);
const once = (text, note) => { if (!chronicle.some(e => e.text === text)) { record(text); if (note) toast(note); } };
const stationRoads = () => roadNeighbors(STATION.anchor.cell);

// ── the camera, built in code: a small dark body, a lens toward +z, a flash window that lights for a moment ──
const camMat = new THREE.MeshStandardMaterial({ color: '#3d4247', roughness: 0.6 }), trimMat = new THREE.MeshStandardMaterial({ color: '#c9c6bd', roughness: 0.5 });
const flashMat = new THREE.MeshBasicMaterial({ color: '#fffbe8', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
function makeCamera() {
  const g = new THREE.Group(); g.userData.handItem = true;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.045, 0.03), camMat); g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 0.022), camMat); top.position.set(-0.012, 0.028, 0); g.add(top);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.028, 10), camMat); lens.rotation.x = Math.PI / 2; lens.position.set(0.006, -0.002, 0.028); g.add(lens);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.0185, 0.0185, 0.006, 10), trimMat); ring.rotation.x = Math.PI / 2; ring.position.set(0.006, -0.002, 0.041); g.add(ring);
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.008, 0.004), trimMat); win.position.set(-0.024, 0.012, 0.016); g.add(win);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), flashMat); flash.position.set(-0.024, 0.012, 0.03); flash.visible = false; g.add(flash);
  g.userData.flash = flash; g.traverse(o => { if (o.isMesh) o.castShadow = o !== flash; });
  return g;
}

// ── visitors ──
function makeTourist() {
  const t = { id: S.nextId++, name: `${pick(GIVEN)} ${pick(FAMILY)}`, tourist: true, state: 'arriving', trip: null, road: null, leave: null, onArrive: null,
    activity: 'up from the station', seen: [], plan: [], until: 0, flashAt: 0, flashOff: 0, poseAt: 0, busAt: null, busTo: null, waitUntil: 0, gone: false,
    skin: pick(SKIN), shirt: pick(['#e9d8a6', '#a9d3c4', '#f1c6b3', '#c4b7d6', '#fbf6ec', '#a7c7d9']), pants: pick(['#6b6f7a', '#8a7a6f', '#9aa4aa', '#c8b9a0']),
    hair: pick(HAIR), hat: Math.random() < 0.55, hatColor: pick(['#f3ead8', '#e9d8a6', '#d6c3a0', '#fbf6ec']), bag: Math.random() < 0.7, bagColor: pick(['#6f9a96', '#d98b7a', '#a3764a', '#6b6f7a']) };
  t.mesh = makePerson(t); t.mesh.userData.res = null; t.mesh.userData.tourist = t;
  return t;
}
/** from where the visitor stands (its road, or the station) to a road cell, then on to the end points */
function walkTo(t, destRoad, end, label, onArrive) {
  const from = t.road ? [t.road] : stationRoads();
  const path = t.road === destRoad ? [destRoad] : routeCells(from, [destRoad]); if (!path) return false;
  const start = t.leave && t.leave.length ? t.leave : [t.mesh.position.clone().setY(0.1)];
  t.trip = { pts: buildPoints(path, start, end, 0.34, 0.1), i: 0, t: 0, speed: 0.95 * rand(0.9, 1.1) };
  t.leave = null; t.road = destRoad; t.state = 'walking'; t.activity = label; t.onArrive = onArrive; t.mesh.visible = true;
  return true;
}
function spawnTourist() {
  const opts = landmarkRoads().filter(o => o.l.kind !== 'pier' && o.l.kind !== 'fishmarket' && routeCells(stationRoads(), [o.road])); if (!opts.length) return null;
  const t = makeTourist(); tourists.push(t);
  t.leave = stationStairs(true); t.mesh.position.copy(t.leave[0]); t.mesh.visible = true;   // up the pavilion's stairs first
  const pool = opts.slice().sort(() => Math.random() - 0.5), first = pool[0], lh = pool.find(o => o.l.kind === 'lighthouse');
  const picks = [bus.state !== 'away' && lh && Math.random() < 0.6 ? lh : first];   // with the bus running, most ride out to the lighthouse
  const second = pool.find(o => o !== picks[0]); if (second && Math.random() < 0.5) picks.push(second);
  t.plan = [...picks.map(o => ({ kind: 'landmark', ...o })), ...(Math.random() < 0.75 ? [{ kind: 'shop' }] : []), { kind: 'home' }];
  if (festivalDay(dayOf()) && hourOf() >= 13) t.plan = [...(Math.random() < 0.6 ? [{ kind: 'landmark', ...first }] : []), { kind: 'event' }, { kind: 'event' }, { kind: 'home' }];   // here for the festival
  const inn = innUnit();   // a night at the ryokan: weekend and festival visitors who came after midday, while it has rooms
  if (inn && hourOf() >= 11 && (isWeekend() || festivalDay(dayOf())) && innGuests() < INN_ROOMS && Math.random() < 0.55) {
    t.staying = inn; t.plan = t.plan.filter(p => p.kind !== 'home').concat([{ kind: 'inn' }]);
    const ch = t.mesh.userData.char; if (ch) equipCharacterProp(ch, 'briefcase', pick(['#6b6f7a', '#a3764a', '#4a4340']));   // their overnight bag
  }
  once('The first visitors came to see the island', 'Visitors came up from the station to see the sights');
  next(t); return t;
}
/** the visitor's next step: out to a landmark (by bus if it is running and they are at the station), a shop, or home */
function next(t) {
  const festDay = festivalDay(dayOf()) && hourOf() < 21.4;
  if (hourOf() >= 14.5) t.plan = t.plan.filter(p => p.kind === 'home' || p.kind === 'inn' || (p.kind === 'shop' && hourOf() < 16.5) || (festDay && (p.kind === 'event' || (p.kind === 'landmark' && hourOf() < 16))));
  if (t.plan[0] && t.plan[0].kind === 'event' && !eventVisit() && hourOf() < 16 && festDay) { t.state = 'standing'; t.until = S.T + 0.25; t.activity = 'waiting for the festival to start'; t.state = 'loiter'; return; }   // the afternoon: a last shop at most, then the station
  const step = t.plan.shift() || { kind: 'home' };
  if (step.kind === 'landmark') {
    const { l, road } = step;
    if (t.busTo === null && bus.stops && road === bus.stops.B && busRunning() && !t.road) {   // take the bus from the station stop
      t.busStop = 'A'; if (walkTo(t, bus.stops.A, [bus.stops.waitA.clone()], 'walking to the bus stop', () => { t.busStop = null; t.state = 'waitBus'; t.busAt = 'A'; t.busTo = 'B'; t.pending = step; t.waitUntil = S.T + 2.2; t.activity = 'waiting for the tourist bus'; faceRoad(t, bus.stops.A); })) return;
    }
    const w = l.walk(road), kerb = w[0];   // stand back from the landmark to take its picture: about a cell away, on the way in from the street
    let pts = w.slice(0, 2);
    if (l.target) {   // the spot and the line to it stay on dry, open ground (never the canal, the sea or a building's plot)
      const d = kerb.clone().setY(0).sub(l.target.clone().setY(0)), L = d.length(); d.normalize();
      const dry = p => { const c = cell(Math.floor(p.x + HALF), Math.floor(p.z + HALF)); return c && (c.type === 'road' || c.type === 'empty' || (c.landmark && c.type !== 'canal')); };
      const clear = r => { for (let q = r; q <= L; q += 0.08) if (!dry(l.target.clone().addScaledVector(d, q))) return false; return true; };
      let best = null; for (let r = 1.05; r < L - 0.02 && !best; r += 0.1) if (clear(r)) best = r;
      pts = best ? [kerb, l.target.clone().setY(0.1).addScaledVector(d, best)] : [kerb];
    }
    if (!walkTo(t, road, pts, `walking out to ${l.name}`, () => arriveAt(t, l, road, pts))) return next(t);
  } else if (step.kind === 'inn') {   // up to the ryokan for the night
    const u = t.staying && t.staying.block && !t.staying.block.removed ? t.staying : innUnit(); if (!u || !frontRoad(u).length) { t.staying = null; return next(t); }
    const [door, kerb] = unitDoorPoints(u);
    if (!walkTo(t, frontRoad(u)[0], [kerb, door], `walking up to ${u.block.name} for the night`, () => {
      t.state = 'atInn'; t.mesh.visible = false; t.staying = u; t.activity = `staying the night at ${u.block.name}`;
      t.until = (Math.floor(S.T / 24) + (hourOf() >= 4 ? 1 : 0)) * 24 + rand(8.4, 9.8);   // checks out in the morning
      u.block.visitsToday = (u.block.visitsToday || 0) + 1; u.block.visitScore = (u.block.visitScore || 0) + 1;
    })) { t.staying = null; return next(t); }
  } else if (step.kind === 'event') {
    const v = eventVisit(); if (!v) return next(t);
    const pts = v.l.walk();
    if (!walkTo(t, v.road, pts, 'off to the summer festival', () => { arriveAt(t, v.l, v.road, pts); v.spot.taken++; t.eventSpot = v.spot; t.until = S.T + rand(1.0, 1.8); t.activity = 'at the summer festival'; })) return next(t);
  } else if (step.kind === 'shop') {
    const shops = shopUnits().filter(u => hourOf() < 19 && !u.block.changing && u.block.kind !== 'ryokan' && isOpen(u.block, hourOf() + 0.2) && frontRoad(u).length);   // an open shop, not the inn if (!shops.length) return next(t);
    const here = t.road ? [t.road] : stationRoads(); let best = null, bl = Infinity;
    for (const u of shops) { const p = routeCells(here, frontRoad(u)); if (p && p.length < bl) { bl = p.length; best = u; } }
    if (!best) return next(t);
    const [door, kerb] = unitDoorPoints(best);
    if (!walkTo(t, frontRoad(best)[0], [kerb, door], `looking round ${best.block.name}`, () => {
      t.state = 'inShop'; t.mesh.visible = false; t.until = S.T + rand(0.25, 0.45); t.shop = best; t.activity = `browsing in ${best.block.name}`;
      best.block.visitsToday = (best.block.visitsToday || 0) + 1; best.block.visitScore = (best.block.visitScore || 0) + 1;   // a customer like any other
    })) return next(t);
  } else {   // home: back down the station stairs
    if (!walkTo(t, stationRoads()[0], stationStairs(false), 'heading back to the station', () => removeTourist(t))) removeTourist(t);
  }
}
function faceRoad(t, road) { t.mesh.rotation.y = Math.atan2(cx(road.i) - t.mesh.position.x, cz(road.j) - t.mesh.position.z); }
function arriveAt(t, l, road, pts) {
  t.state = 'visit'; t.until = S.T + rand(0.35, 0.65); t.activity = `taking photos of ${l.name}`; t.seen.push(l.name);
  if (l.target) t.mesh.rotation.y = Math.atan2(l.target.x - t.mesh.position.x, l.target.z - t.mesh.position.z);
  const ch = t.mesh.userData.char; if (ch) { if (!t.camera) t.camera = makeCamera(); holdItem(ch, t.camera); ch.fidget = 'camera'; }
  t.poseAt = S.T + rand(0.03, 0.08); t.leave = pts.slice().reverse().map(p => p.clone()); t.road = road; t.lm = l;
}
function leaveLandmark(t) {
  const ch = t.mesh.userData.char; if (ch) { ch.fidget = 'camera'; }
  if (t.eventSpot) { t.eventSpot.taken = Math.max(0, t.eventSpot.taken - 1); t.eventSpot = null; }
  if (t.lm && bus.stops && t.road === bus.stops.B && busRunning() && hourOf() < 14.2) {   // back by bus if it is still running
    const step = t.plan[0];
    t.busStop = 'B'; if (walkTo(t, bus.stops.B, [bus.stops.waitB.clone()], 'walking back to the bus stop', () => { t.busStop = null; t.state = 'waitBus'; t.busAt = 'B'; t.busTo = 'A'; t.waitUntil = S.T + 2.2; t.activity = 'waiting for the bus back'; faceRoad(t, bus.stops.B); })) { void step; return; }
  }
  next(t);
}
function removeTourist(t) {
  t.gone = true; t.state = 'gone'; t.activity = 'gone home on the train';
  const ch = t.mesh.userData.char; if (ch) { dropItem(ch); clearCharacterProp(ch); }
  detachCharacter(t.mesh); peopleGroup.remove(t.mesh); disposeGroup(t.mesh); tourists.splice(tourists.indexOf(t), 1);
}

// ── the tourist bus ──
const bus = { state: 'away', mesh: null, trip: null, at: null, until: 0, riders: [], stops: null, shelters: [], ordered: false, stopsDay: -1, retryAt: 0 };
const busRunning = () => bus.state === 'toA' || bus.state === 'toB' || bus.state === 'dwell';
const BS = 0.51;   // the kit bus is 0.55 wide and 1.08 long: 0.28 × 0.55 here, inside a 0.34 lane
function makeBus() {
  const grp = new THREE.Group(), m = createFestivalLandmark('tourist-bus'); m.scale.setScalar(BS); grp.add(m);
  m.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const lm = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: '#ffd79a', emissiveIntensity: 0 }), tm = new THREE.MeshStandardMaterial({ color: '#b24a3c', emissive: '#e0503c', emissiveIntensity: 0 });
  const lights = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.02), lm); lights.position.set(0, 0.1, 0.36); grp.add(lights);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.02), tm); tail.position.set(0, 0.1, -0.36); grp.add(tail);
  grp.userData.lights = lights; grp.userData.tail = tail; grp.userData.bus = true;
  carMeshes.push(grp); peopleGroup.add(grp); return grp;
}
const centre = c => new THREE.Vector3(cx(c.i), 0.08, cz(c.j));
/** the lane point the bus stops at at the end of a path, and the pavement side it is on */
function laneEnd(path) {
  const a = path[path.length - 2], b = path[path.length - 1], d = new THREE.Vector3(b.i - a.i, 0, b.j - a.j).normalize(), side = new THREE.Vector3(d.z, 0, -d.x);   // keep left
  return { stop: centre(b).addScaledVector(side, 0.17).addScaledVector(d, 0.2), side, dir: d };   // pulls up just past the shelter
}
/** a stop by the station (on its ring, near the stairs) and one on the road nearest the lighthouse, with a clear pavement */
function findStops() {
  const lh = landmarkRoads().find(o => o.l.kind === 'lighthouse'); if (!lh) return null;
  const si = Math.floor(STATION.entrance.x + HALF), sj = Math.floor(STATION.entrance.z - 0.9 + HALF), B = lh.road;
  for (const [di, dj] of [[1, 2], [-1, 2], [2, 1], [-2, 1], [1, -2], [-1, -2]]) {
    const A = cell(si + di, sj + dj); if (!A || A.type !== 'road' || A.ramp) continue;
    const path = routeCells([A], [B]); if (!path || path.length < 6) continue;
    const back = path.slice().reverse(), atA = laneEnd(back), atB = laneEnd(path);
    const pav = (c, side) => { const n = cell(c.i + Math.round(side.x), c.j + Math.round(side.z)); return n && n.type !== 'road' && n.type !== 'water' && n.type !== 'canal'; };
    if (!pav(A, atA.side) || !pav(B, atB.side)) continue;
    const shelterAt = (c, e) => { const p = centre(c).addScaledVector(e.side, 0.41).addScaledVector(e.dir, -0.27).setY(0.1); return { p, ry: Math.atan2(-e.side.x, -e.side.z) }; };
    const sA = shelterAt(A, atA), sB = shelterAt(B, atB);
    const wait = s => s.p.clone().addScaledVector(new THREE.Vector3(Math.sin(s.ry), 0, Math.cos(s.ry)), 0.03).setY(0.1);
    return { A, B, path, back, stopA: atA.stop, stopB: atB.stop, sA, sB, waitA: wait(sA), waitB: wait(sB) };
  }
  return null;
}
function placeShelters() {
  for (const m of bus.shelters) scene.remove(m); bus.shelters.length = 0;
  if (!bus.stops) return;
  for (const s of [bus.stops.sA, bus.stops.sB]) { const m = createStreetFurniture('bus-stop'); m.scale.setScalar(0.4); m.position.copy(s.p); m.rotation.y = s.ry; m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(m); bus.shelters.push(m); }
}
function driveTo(to) {   // 'A' or 'B'
  const path = to === 'B' ? bus.stops.path : bus.stops.back, end = to === 'B' ? bus.stops.stopB : bus.stops.stopA;
  const pts = buildPoints(path, bus.mesh.position.clone().setY(0.08), end.clone(), 0.17, 0.08, -1);
  bus.trip = { pts, i: 0, t: 0, speed: 2.8 }; bus.state = to === 'B' ? 'toB' : 'toA'; bus.mesh.userData.parked = false;
}
function arriveBus(at) {
  bus.state = 'dwell'; bus.at = at; bus.until = S.T + 0.3;
  { const e = laneEnd(at === 'A' ? bus.stops.back : bus.stops.path); bus.mesh.position.copy(e.stop); bus.mesh.rotation.set(0, Math.atan2(e.dir.x, e.dir.z), 0); }   // squared up at the kerb
  const wait = at === 'A' ? bus.stops.waitA : bus.stops.waitB, road = at === 'A' ? bus.stops.A : bus.stops.B;
  for (const t of bus.riders.splice(0)) {   // everyone off: out at the shelter, then on with the day
    t.mesh.position.copy(wait); t.mesh.visible = true; t.road = road; t.leave = [wait.clone()]; t.busAt = null;
    if (t.busTo === 'B' && t.pending) { const step = t.pending; t.pending = null; t.plan.unshift(step); }
    t.busTo = null; next(t);
  }
}
function updateBus(simDt) {
  const h = hourOf();
  if (h >= 4 && (dayOf() !== bus.stopsDay || (!bus.stops && S.T >= bus.retryAt))) {   // the stops are worked out each morning (and retried while there are none), from whatever streets there are
    if (dayOf() !== bus.stopsDay) bus.ordered = false;
    bus.stopsDay = dayOf(); bus.retryAt = S.T + 0.5; const s = findStops();
    const moved = !bus.stops || !s || s.A !== bus.stops.A || s.B !== bus.stops.B;
    if (bus.state === 'away' || !s) { bus.stops = s; if (moved) placeShelters(); }
  }
  if (bus.state === 'away' && !bus.ordered && isWeekend() && h >= 4 && h < 11.5 && bus.stops && ferry.ready) {
    bus.ordered = true;
    shipVehicle({ make: makeBus, dest: () => bus.stops && bus.stops.A, onArrive: mesh => { bus.mesh = mesh; arriveBus('A'); once('The tourist bus made its first run', 'The tourist bus is running between the station and the lighthouse'); } });
  }
  if (!bus.mesh) return;
  if (bus.state === 'toA' || bus.state === 'toB') {
    if (moveAlong(bus.mesh, bus.trip, bus.trip.speed * simDt * trafficFactor(bus.mesh))) arriveBus(bus.state === 'toB' ? 'B' : 'A');
  } else if (bus.state === 'dwell') {
    const here = bus.at;
    for (const t of tourists) if (t.state === 'waitBus' && t.busAt === here) { t.state = 'onBus'; t.mesh.visible = false; t.activity = 'riding the tourist bus'; bus.riders.push(t); }
    if (S.T >= bus.until && S.T < bus.until + 0.4 && tourists.some(t => t.state === 'walking' && t.busStop === here)) bus.until = Math.min(bus.until + 0.05, S.T + 0.05);   // hold for visitors already on their way to the stop
    if (S.T >= bus.until) {
      const done = h >= 14.6 || !isWeekend();   // a leg can take a couple of hours on a winding town: finish in time for the 17:00 ferry
      if (done && !bus.riders.length) {   // the day's service is over: down to the slipway for the 17:00 ferry
        const slip = ferry.lane || ferry.slip, from = here === 'A' ? bus.stops.A : bus.stops.B, path = slip ? routeCells([from], [slip]) : null;
        for (const t of tourists) if (t.state === 'waitBus') t.waitUntil = S.T;   // anyone still waiting walks
        if (path) { bus.trip = { pts: buildPoints(path, bus.mesh.position.clone().setY(0.08), centre(slip), 0.17, 0.08, -1), i: 0, t: 0, speed: 1.9 }; bus.state = 'leaving'; }
        else { const ci = carMeshes.indexOf(bus.mesh); if (ci >= 0) carMeshes.splice(ci, 1); peopleGroup.remove(bus.mesh); bus.mesh = null; bus.state = 'away'; }
      } else driveTo(here === 'A' ? 'B' : 'A');
    }
  } else if (bus.state === 'leaving') {
    if (moveAlong(bus.mesh, bus.trip, bus.trip.speed * simDt * trafficFactor(bus.mesh))) { boardCar(bus.mesh); bus.mesh = null; bus.state = 'away'; }
  }
}

// ── arrivals: off the morning trains ──
let pendingSpawns = [];
onTrain(h => {
  const fest = festivalDay(dayOf()) && squareExists();
  if (fest && h >= 13.4 && h <= 18.5) { for (let k = 0; k < 3 + Math.floor(Math.random() * 3); k++) pendingSpawns.push(S.T + 0.08 + k * 0.06); return; }   // festival visitors
  if (h < 8.5 || h > 13 || W.rain > 0.25 || W.winter && W.snow > 0.8 && Math.random() < 0.5) return;
  const n = isWeekend() ? 2 + Math.floor(Math.random() * 3) : (Math.random() < 0.3 ? 1 : 0);
  for (let k = 0; k < n; k++) pendingSpawns.push(S.T + 0.08 + k * 0.07);
});
const squareExists = () => blocks.some(b => b.type === 'civic' && b.kind === 'square' && b.stage === DONE);

let lastReal = 0;
/** once a frame (and in fastForward) */
function updateTourists(simDt, realT = lastReal) {
  lastReal = realT;
  updateBus(simDt);
  if (pendingSpawns.length && S.T >= pendingSpawns[0]) { pendingSpawns.shift(); spawnTourist(); }
  for (let k = tourists.length - 1; k >= 0; k--) {
    const t = tourists[k];
    if ((hourOf() >= 23.8 || hourOf() < 4) && !t.staying) { removeTourist(t); continue; }   // anyone still out at midnight caught the last train (the inn's guests are in for the night)
    if (t.state === 'walking') { if (moveAlong(t.mesh, t.trip, t.trip.speed * simDt)) { const f = t.onArrive; t.onArrive = null; t.trip = null; t.state = 'standing'; if (f) f(); } }
    else if (t.state === 'visit') {
      const ch = t.mesh.userData.char;
      if (S.T >= t.poseAt && ch) { ch.fidget = ch.fidget === 'photo' ? 'camera' : 'photo'; t.poseAt = S.T + (ch.fidget === 'photo' ? rand(0.06, 0.12) : rand(0.04, 0.09)); if (ch.fidget === 'photo') t.flashAt = realT + rand(0.3, 0.8); }
      const fl = t.camera && t.camera.userData.flash;
      if (fl) { if (ch && ch.fidget === 'photo' && realT >= t.flashAt && !fl.visible) { fl.visible = true; t.flashOff = realT + 0.09; t.flashAt = realT + rand(0.9, 1.8); } if (fl.visible && realT >= t.flashOff) fl.visible = false; }
      if (S.T >= t.until) { if (fl) fl.visible = false; leaveLandmark(t); }
    } else if (t.state === 'inShop') {
      if (S.T >= t.until) {
        const ch = t.mesh.userData.char, [door] = unitDoorPoints(t.shop);
        t.mesh.position.copy(door); t.mesh.visible = true; t.leave = [door.clone(), unitDoorPoints(t.shop)[1].clone()];
        if (ch) { dropItem(ch); ch.fidget = null; equipCharacterProp(ch, 'shopping-bag', t.shop.block.awning ? t.shop.block.awning[0] : undefined); }
        t.state = 'standing'; next(t);
      }
    } else if (t.state === 'atInn') {   // checking out: a last sight if there is time, then the train home, bag in hand
      if (S.T >= t.until) {
        const u = t.staying, [door, kerb] = unitDoorPoints(u);
        t.mesh.position.copy(door); t.mesh.visible = true; t.leave = [door.clone(), kerb.clone()]; t.road = frontRoad(u)[0]; t.state = 'standing'; t.staying = null;
        const ch = t.mesh.userData.char; if (ch) { dropItem(ch); ch.fidget = null; equipCharacterProp(ch, 'briefcase', '#6b6f7a'); }
        const more = landmarkRoads().filter(o => o.l.kind !== 'pier' && !t.seen.includes(o.l.name));
        t.plan = [...(more.length && Math.random() < 0.6 ? [{ kind: 'landmark', ...more[0] }] : []), { kind: 'home' }];
        t.activity = `checking out of ${u.block.name}`; next(t);
      }
    } else if (t.state === 'loiter') {   // early for the festival: a slow look round, then try again
      if (S.T >= t.until) { t.state = 'standing'; next(t); }
    } else if (t.state === 'waitBus') {
      if (S.T >= t.waitUntil || !busRunning()) {   // no bus after all: walk
        t.state = 'standing'; t.leave = [t.mesh.position.clone().setY(0.1)];
        if (t.busTo === 'B' && t.pending) { t.plan.unshift(t.pending); t.pending = null; }
        t.busAt = null; t.busTo = null; next(t);
      }
    }
  }
}
const INN_ROOMS = 6;
function innUnit() { const b = blocks.find(x => x.type === 'shop' && x.kind === 'ryokan' && x.stage === DONE); return b ? b.units[0] : null; }
const innGuests = () => tourists.filter(t => t.staying).length;
export { tourists, tourism, bus, updateTourists, spawnTourist, isWeekend, innGuests, INN_ROOMS };
