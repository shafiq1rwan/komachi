// Komachi — the car ferry (Phase 5). Nothing on wheels appears out of thin air: a small ro-ro ferry calls at a slipway
// beside the pier three times a day. Visiting cars roll off it and drive back to it to leave, a resident's car comes
// off the sailing after they move in, and the building materials on its deck are unloaded into a builders' yard by
// the slipway that the delivery trucks load from. Everything here is visual and demand-driven: nothing is counted or
// gated, and construction time is untouched (the yard only looks fuller while more sites are under way).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PAL } from './palette.js';
import { S } from './state.js';
import { scene, peopleGroup, cx, cz, HALF } from './scene.js';
import { box, cyl, colorize, mergeMesh } from './geometry.js';
import { cells, cell, blocks, DONE, refreshWorld } from './world.js';
import { coastPoint, pierAngle, islandEllipse, coastDist, shoreKind, canalMouths } from './island.js';
const [SX, SZ] = islandEllipse;
import { makeCar, moveAlong, buildPoints, routeCells, roadNeighbors, frontRoad, carMeshes, parkVehicle, adoptWanderer, setVehicleSource, hourOf } from './sim.js';
import { setYardStart } from './construction.js';
import { toast } from './toast.js';
import shipMapUrl from '../assets/watercraft/Textures/colormap.png?url';

const CALLS = [7, 12, 17];          // sailings arrive on these hours; the ferry waits about half an hour each time
const SAIL = 0.35, WAIT = 0.45;     // game hours: the run in from the horizon, and the time at the berth
const WATER_Y = -0.78;
const FERRY_SCALE = 1.3;   // the ro-ro is a size up from the pier's fishing boat
export const ferry = { state: 'away', t: 0, mesh: null, pos: new THREE.Vector3(), queue: [], runs: [], boarding: [], slip: null, yard: null, berth: null, land: null, deck: null, theta: 0, calls: 0, ready: false };
const rand = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];

/** the slipway beside the pier: a coast-road cell near the berth, the beach landing and the berth out on the water */
function placeSlip() {
  const base = pierAngle(); if (base === null) return false;
  // candidates: straight coast-road cells (two road neighbours opposite each other) whose seaward side, along the grid,
  // is clear ground with a clean shore: no rocky stretch and no canal mouth (its waterfall) within a quarter turn
  const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  const seaward = c => {   // the grid direction from a straight road cell toward the sea, or null
    const x = cx(c.i), z = cz(c.j), ns = [cell(c.i, c.j - 1), cell(c.i, c.j + 1)].every(n => n && n.type === 'road'), ew = [cell(c.i - 1, c.j), cell(c.i + 1, c.j)].every(n => n && n.type === 'road');
    if (ns === ew) return null;
    const dirs = ns ? [[1, 0], [-1, 0]] : [[0, 1], [0, -1]];
    dirs.sort((a, b) => coastDist(x + a[0], z + a[1]) - coastDist(x + b[0], z + b[1]));   // the side where the coast is nearer
    const [dx, dz] = dirs[0], n1 = cell(c.i + dx, c.j + dz);
    if (n1 && (n1.type === 'road' || n1.canal || n1.block || (n1.h || 0) > 0)) return null;
    return [dx, dz];
  };
  const okShore = (x, z) => { const th = Math.atan2(z / SZ, x / SX); return shoreKind(th) !== 'rock' && canalMouths.every(m => angDiff(m, th) > 0.45); };
  let best = null, bd = 1e9;
  for (const dth of [0.34, -0.34, 0.5, -0.5, 0.7, -0.7, 0.9, -0.9, 1.2, -1.2, 1.6, -1.6, 2.0, -2.0]) {   // a little round the shore from the pier, whichever side has coast road
    const th = base + dth, [lx, lz] = coastPoint(th, -0.6);
    for (const c of cells) {
      if (!c.coast || c.bridge || c.type !== 'road') continue;
      const dir = seaward(c); if (!dir) continue;
      const [sx, sz] = coastPoint(Math.atan2(cz(c.j) / SZ, cx(c.i) / SX), 0.3); if (!okShore(sx, sz)) continue;
      const d = Math.hypot(cx(c.i) - lx, cz(c.j) - lz); if (d < bd) { bd = d; best = { c, th, dir }; }
    }
    if (best && bd < 2.2) break;
  }
  if (!best) {   // no clean straight stretch: the old rule, nearest coast road cell to the pier's side
    for (const c of cells) { if (!c.coast || c.bridge || c.type !== 'road') continue; const d = Math.hypot(cx(c.i) - coastPoint(base + 0.34, -0.6)[0], cz(c.j) - coastPoint(base + 0.34, -0.6)[1]); if (d < bd) { bd = d; best = { c, th: base + 0.34, dir: null }; } }
    if (!best) return false;
  }
  ferry.slip = best.c; best.c.slip = true;   // the streets pass: no stop sign or car park on the slipway cell
  const x0 = cx(best.c.i), z0 = cz(best.c.j);
  // the lane leaves the road at right angles along the grid (or, failing a straight cell, along the ray from the island's centre)
  let ux, uz; if (best.dir) { [ux, uz] = best.dir; } else { const th = Math.atan2(z0 / SZ, x0 / SX); ux = Math.cos(th) * SX; uz = Math.sin(th) * SZ; const l = Math.hypot(ux, uz); ux /= l; uz /= l; }
  const march = target => { let t = 0; while (t < 14 && coastDist(x0 + ux * t, z0 + uz * t) > target) t += 0.02; return [x0 + ux * t, z0 + uz * t]; };   // the first point along the lane where the shore distance drops to `target`
  const [ex, ez] = march(0.12), [lx, lz] = march(-0.55), [bx, bz] = march(-2.05), [ox, oz] = march(-9);   // the berth sits a little further out for the larger hull
  ferry.theta = Math.atan2(ez / SZ, ex / SX);
  ferry.edge = new THREE.Vector3(ex, 0.08, ez);          // the last of the grass: the flat lane ends here
  ferry.land = new THREE.Vector3(lx, -0.5, lz);          // the landing on the beach, where the ship's ramp comes down
  ferry.berth = new THREE.Vector3(bx, WATER_Y, bz); ferry.offshore = new THREE.Vector3(ox, WATER_Y, oz);
  for (let k = 1; k <= 3; k++) { const c = cell(best.c.i + Math.round(ux * k), best.c.j + Math.round(uz * k)); if (c && c.type === 'empty' && Math.hypot(cx(c.i) - x0, cz(c.j) - z0) <= Math.hypot(ex - x0, ez - z0) + 0.6) { c.tree = null; c.slip = true; } }   // the lane's ground: cleared, and reserved
  // the yard: the inland neighbour of the slip cell that is free ground
  const dx = Math.sign(cx(best.c.i) - lx), dz = Math.sign(cz(best.c.j) - lz);
  const cand = [cell(best.c.i + dx, best.c.j), cell(best.c.i, best.c.j + dz), cell(best.c.i + dx, best.c.j + dz)].filter(n => n && n.type === 'empty' && !(n.h > 0));
  if (cand.length) { ferry.yard = cand[0]; ferry.yard.yard = true; ferry.yard.tree = null; }
  return true;
}
/** slipway (concrete ramp from the road down to the beach), yard fence, sign; the stacked materials are rebuilt as sites change */
let slipMesh = null, yardMesh = null, yardCount = -1;
function buildSlip() {
  const g = [], s = ferry.slip, x0 = cx(s.i), z0 = cz(s.j), E = ferry.edge, L = ferry.land;
  const ang = Math.atan2(E.x - x0, E.z - z0), ux = Math.sin(ang), uz = Math.cos(ang), flat = Math.max(0.3, Math.hypot(E.x - x0, E.z - z0)), drop = Math.hypot(L.x - E.x, L.z - E.z);
  // a flat asphalt lane with cream kerbs from the coast road across the grass to the edge
  g.push(box(0.8, 0.08, flat + 0.2, PAL.asphalt, (x0 + E.x) / 2, 0.04, (z0 + E.z) / 2, ang));
  for (const sd of [-1, 1]) g.push(box(0.1, 0.1, flat + 0.2, PAL.sidewalk, (x0 + E.x) / 2 + Math.cos(ang) * sd * 0.44, 0.05, (z0 + E.z) / 2 - Math.sin(ang) * sd * 0.44, ang));
  for (let k = 0; k < Math.floor(flat / 0.5); k++) g.push(box(0.025, 0.004, 0.2, PAL.cream2, x0 + ux * (0.4 + k * 0.5), 0.082, z0 + uz * (0.4 + k * 0.5), ang));
  // the ramp down the beach edge to the landing
  const rampLen = Math.hypot(drop, 0.58), tilt = Math.atan2(0.58, drop);
  const ramp = new THREE.BoxGeometry(0.8, 0.06, rampLen + 0.1); ramp.rotateX(tilt); ramp.rotateY(ang); ramp.translate((E.x + L.x) / 2, (0.08 - 0.5) / 2 + 0.01, (E.z + L.z) / 2); g.push(colorize(ramp, PAL.concrete));
  for (const sd of [-1, 1]) { const kerb = new THREE.BoxGeometry(0.06, 0.06, rampLen + 0.1); kerb.rotateX(tilt); kerb.rotateY(ang); kerb.translate((E.x + L.x) / 2 + Math.cos(ang) * sd * 0.4, (0.08 - 0.5) / 2 + 0.05, (E.z + L.z) / 2 - Math.sin(ang) * sd * 0.4); g.push(colorize(kerb, PAL.cream2)); }
  for (let k = 0; k < 4; k++) g.push(box(0.04, 0.02, 0.36, k % 2 ? PAL.cream2 : '#4a4340', L.x + ux * 0.1 + Math.cos(ang) * (-0.3 + k * 0.2), -0.47, L.z + uz * 0.1 - Math.sin(ang) * (-0.3 + k * 0.2), ang));   // striped landing edge
  for (const sd of [-1, 1]) { g.push(cyl(0.025, 0.03, 0.5, PAL.lamp, x0 + Math.cos(ang) * sd * 0.46 + ux * 0.3, 0.08 + 0.25, z0 - Math.sin(ang) * sd * 0.46 + uz * 0.3, 6)); g.push(box(0.14, 0.1, 0.02, PAL.cream2, x0 + Math.cos(ang) * sd * 0.46 + ux * 0.3, 0.08 + 0.46, z0 - Math.sin(ang) * sd * 0.46 + uz * 0.3, ang)); }   // ferry signs at the lane's start
  if (ferry.yard) {   // fence round the yard with an open gate toward the slip
    const y = ferry.yard, yx = cx(y.i), yz = cz(y.j);
    for (let k = 0; k <= 8; k++) for (const [ex, ez] of [[-0.46 + k * 0.115, -0.46], [-0.46 + k * 0.115, 0.46], [-0.46, -0.46 + k * 0.115], [0.46, -0.46 + k * 0.115]]) { if (Math.abs(ex - (s.i - y.i) * 0.46) < 0.2 && Math.abs(ez - (s.j - y.j) * 0.46) < 0.2 && ((s.i - y.i) || (s.j - y.j))) continue; g.push(box(0.02, 0.16, 0.02, '#7d8a94', yx + ex, 0.08, yz + ez)); }
    g.push(box(0.94, 0.012, 0.012, '#7d8a94', yx, 0.14, yz - 0.46)); g.push(box(0.94, 0.012, 0.012, '#7d8a94', yx, 0.14, yz + 0.46)); g.push(box(0.012, 0.012, 0.94, '#7d8a94', yx - 0.46, 0.14, yz)); g.push(box(0.012, 0.012, 0.94, '#7d8a94', yx + 0.46, 0.14, yz));
    g.push(box(0.9, 0.02, 0.9, PAL.dirt, yx, 0.01, yz));
    g.push(box(0.36, 0.2, 0.2, PAL.roofTeal, yx + 0.24, 0.1, yz - 0.28)); for (let k = 0; k < 5; k++) g.push(box(0.012, 0.18, 0.21, '#5e8a86', yx + 0.1 + k * 0.07, 0.1, yz - 0.28));   // a container
    g.push(box(0.3, 0.1, 0.018, PAL.cream2, yx, 0.28, yz + 0.42)); g.push(box(0.02, 0.24, 0.02, PAL.wood2, yx - 0.13, 0.13, yz + 0.42)); g.push(box(0.02, 0.24, 0.02, PAL.wood2, yx + 0.13, 0.13, yz + 0.42)); g.push(box(0.2, 0.03, 0.02, PAL.roofRose, yx, 0.29, yz + 0.43));   // the yard's sign
  }
  slipMesh = mergeMesh(g, true); slipMesh.receiveShadow = true; scene.add(slipMesh);
}
/** stacked timber, sacks and pallets: as many as there are sites under way (capped), purely visual */
function buildYardStock() {
  const n = Math.min(4, blocks.filter(b => b.type !== 'station' && b.stage < DONE).length);
  if (n === yardCount || !ferry.yard) return; yardCount = n;
  if (yardMesh) { scene.remove(yardMesh); yardMesh.geometry.dispose(); yardMesh = null; }
  const g = [], yx = cx(ferry.yard.i), yz = cz(ferry.yard.j);
  for (let k = 0; k < n; k++) {
    const px = yx - 0.3 + (k % 2) * 0.28, pz = yz + 0.18 - Math.floor(k / 2) * 0.3;
    g.push(box(0.22, 0.03, 0.18, PAL.wood, px, 0.035, pz));
    if (k % 3 === 0) for (let q = 0; q < 3; q++) g.push(box(0.2, 0.03, 0.03, PAL.wood2, px, 0.065 + q * 0.03, pz - 0.05 + q * 0.05));   // timber
    else if (k % 3 === 1) for (let q = 0; q < 4; q++) g.push(box(0.08, 0.05, 0.06, PAL.cream2, px - 0.05 + (q % 2) * 0.1, 0.075 + Math.floor(q / 2) * 0.05, pz));   // sacks
    else { g.push(box(0.14, 0.12, 0.12, PAL.roofBlue, px, 0.11, pz)); g.push(box(0.06, 0.06, 0.06, PAL.roofPeach, px + 0.1, 0.08, pz + 0.04)); }   // crates
  }
  if (g.length) { yardMesh = mergeMesh(g, true); scene.add(yardMesh); }
}
/** the ferry itself: a flat-decked ro-ro with a wheelhouse aft and a bow ramp; a Kenney ship-*.glb replaces the hull if present */
function buildFerry() {
  const grp = new THREE.Group(); const g = [];
  g.push(box(2.1, 0.22, 0.95, PAL.cream2, 0, 0.11, 0)); g.push(box(2.14, 0.05, 0.99, PAL.roofTeal, 0, 0.14, 0));            // hull and waterline stripe
  const bow = new THREE.BoxGeometry(0.5, 0.22, 0.7); bow.rotateY(Math.PI / 4); bow.translate(1.05, 0.11, 0); g.push(colorize(bow, PAL.cream2));
  g.push(box(2.0, 0.03, 0.86, PAL.concrete2, 0, 0.24, 0));                                                                   // car deck
  for (const sd of [-1, 1]) g.push(box(2.0, 0.08, 0.03, PAL.cream2, 0, 0.28, sd * 0.43));                                   // bulwarks
  g.push(box(0.5, 0.36, 0.7, PAL.cream2, -0.75, 0.42, 0)); g.push(box(0.54, 0.04, 0.74, PAL.roofTeal, -0.75, 0.62, 0));       // wheelhouse
  g.push(box(0.36, 0.14, 0.02, PAL.window, -0.5, 0.5, 0)); g.push(cyl(0.05, 0.06, 0.3, PAL.cream2, -0.9, 0.78, 0, 8)); g.push(box(0.1, 0.03, 0.1, K_RED, -0.9, 0.94, 0));   // windows, funnel
  g.push(box(0.02, 0.4, 0.02, PAL.lamp, -0.6, 0.84, 0.2)); g.push(box(0.14, 0.08, 0.01, K_RED, -0.6, 1.0, 0.2));            // mast and flag
  const hull = mergeMesh(g, true); hull.castShadow = true; grp.add(hull);
  const ramp = new THREE.Mesh(colorize(new THREE.BoxGeometry(0.5, 0.03, 0.8), PAL.concrete2), hull.material); ramp.position.set(1.28, 0.25, 0); ramp.rotation.z = 1.2; grp.add(ramp); grp.userData.ramp = ramp;
  grp.userData.deck = new THREE.Vector3(0.3, 0.26, 0); grp.scale.setScalar(FERRY_SCALE); ferry.deck = grp.userData.deck.clone().multiplyScalar(FERRY_SCALE);
  grp.position.copy(ferry.offshore); grp.visible = false; scene.add(grp); ferry.mesh = grp;
  const ships = import.meta.glob('../assets/watercraft/ship-*.glb', { eager: true, query: '?url', import: 'default' });
  const url = ships[Object.keys(ships).find(k => k.includes('ship-cargo-a'))] || Object.values(ships)[0];   // the open-decked cargo ship reads best as a ro-ro
  // the kit ship is long along z, the hull here along x, so the model is turned a quarter
  const manager = new THREE.LoadingManager(); manager.setURLModifier(u => /colormap\.png$/i.test(u) ? shipMapUrl : u);
  if (url) new GLTFLoader(manager).loadAsync(url).then(gltf => { const bb = new THREE.Box3().setFromObject(gltf.scene); const size = bb.getSize(new THREE.Vector3()); const s = 2.2 / Math.max(size.x, size.z); gltf.scene.scale.setScalar(s); gltf.scene.rotation.y = -Math.PI / 2; gltf.scene.position.y = -bb.min.y * s; gltf.scene.traverse(o => { if (o.isMesh) o.castShadow = true; }); hull.visible = false; grp.add(gltf.scene); }).catch(() => {});
}
const K_RED = '#c9564b';

/** the world-space point for a spot on the deck, given the ferry's heading */
function deckPoint(k = 0) { const p = ferry.deck.clone(); p.x -= k * 0.42; p.applyAxisAngle(new THREE.Vector3(0, 1, 0), ferry.mesh.rotation.y); return p.add(ferry.mesh.position).setY(WATER_Y + 0.275 * FERRY_SCALE); }
/** the drive from the deck down the ramp onto the slipway and then along the streets; returns trip points */
function offPath(dest, endPos) {
  const road = routeCells([ferry.slip], dest); if (!road) return null;
  const s = ferry.slip, top = new THREE.Vector3(cx(s.i), 0.08, cz(s.j));
  const onRoad = buildPoints(road, top, endPos, 0.17, 0.08, -1);
  return { pts: [deckPoint(), ferry.land.clone(), ferry.edge.clone(), ...onRoad], cells: road };
}
function requestWanderer(color, vkind) { ferry.queue.push({ kind: 'wanderer', color, vkind }); }
function orderCar(r) { if (!ferry.queue.some(q => q.kind === 'carFor' && q.r === r)) ferry.queue.push({ kind: 'carFor', r }); }
/** a visiting car heading home: it drives to the slip, waits at the landing if the ferry is out, and boards when it is in */
function boardCar(mesh) {   // wait in a line down the slipway lane until the ferry is in
  mesh.userData.parked = true; const k = ferry.boarding.length; const s = ferry.slip, top = new THREE.Vector3(cx(s.i), 0.08, cz(s.j));
  mesh.position.lerpVectors(top, ferry.edge, Math.min(0.9, 0.3 + 0.22 * k)); mesh.position.y = 0.085; mesh.rotation.set(0, Math.atan2(ferry.edge.x - top.x, ferry.edge.z - top.z), 0);
  ferry.boarding.push({ mesh, t: 0 });
}

/** put one queued vehicle ashore; false if it cannot reach anywhere yet (it stays aboard for the next call) */
function launch(q) {
  if (q.kind === 'wanderer') {
    const roads = cells.filter(c => c.type === 'road' && c !== ferry.slip && !c.bridge && !c.coast); if (!roads.length) return false;   // visitors head into town, not round the coast
    let trip = null; for (let k = 0; k < 6 && !trip; k++) { const t = pick(roads); const p = offPath([t], new THREE.Vector3(cx(t.i), 0.08, cz(t.j))); if (p && p.cells.length >= 3) trip = { ...p, last: t }; }
    if (!trip) return false;
    const mesh = makeCar(q.color, q.vkind); mesh.visible = true; mesh.position.copy(trip.pts[0]); mesh.userData.parked = false;
    adoptWanderer({ kind: 'car', cell: ferry.slip, mesh, trip: { pts: trip.pts, i: 0, t: 0, speed: rand(2.0, 2.8), last: trip.last, cells: trip.cells }, pause: 0, dead: false, fromFerry: true });
    return true;
  } else if (q.kind === 'carFor') {
    const r = q.r; if (!r.home || r.home.removed || r.car) { r.carOrdered = false; return true; }   // no longer wanted
    const front = frontRoad(r.home); if (!front.length) return false;
    const p = offPath(front, new THREE.Vector3(cx(front[0].i), 0.08, cz(front[0].j))); if (!p) return false;
    const mesh = makeCar(r.carColor, r.carKind); mesh.visible = true; mesh.position.copy(p.pts[0]); r.car = mesh; r.carOrdered = false;
    ferry.runs.push({ mesh, trip: { pts: p.pts, i: 0, t: 0, speed: 2.4, cells: p.cells }, onArrive: () => { r.carAt = r.home; parkVehicle(mesh, r.home, 'car'); } });
    toast(`A car for the ${r.hh ? r.hh.surname : r.name.split(' ')[1]} household came off the ferry`);
    return true;
  }
  return true;
}
export function initFerry() {
  if (ferry.ready || !placeSlip()) return;
  buildSlip(); buildFerry(); buildYardStock(); ferry.ready = true;
  setVehicleSource({ requestWanderer, orderCar, boardCar, slip: () => ferry.slip });
  setYardStart(() => ferry.slip);
  ferry.state = 'away';
  refreshWorld();
}
export function updateFerry(dh, simDt) {
  if (!ferry.ready) return;
  buildYardStock();
  const m = ferry.mesh, ramp = m.userData.ramp;
  if (ferry.state === 'away') {   // a sailing starts its run in whenever the clock enters a call's window, once per call per day (robust to time jumps)
    const h = hourOf(), day = Math.floor(S.T / 24);
    if (ferry.lastCallT !== undefined && S.T < ferry.lastCallT) ferry.lastCall = null;   // the clock went backwards (a test): that call can come again
    for (const c of CALLS) if (h >= c - SAIL && h < c && ferry.lastCall !== day * 100 + c) { ferry.lastCall = day * 100 + c; ferry.lastCallT = S.T; ferry.state = 'arriving'; ferry.t = 0; m.visible = true; break; }
  }
  else if (ferry.state === 'arriving') {
    ferry.t += dh / SAIL; const k = Math.min(1, ferry.t), e = 1 - Math.pow(1 - k, 2);
    m.position.lerpVectors(ferry.offshore, ferry.berth, e); m.rotation.y = Math.atan2(ferry.land.x - m.position.x, ferry.land.z - m.position.z) - Math.PI / 2;
    if (k >= 1) { ferry.state = 'berthed'; ferry.t = 0; ferry.calls++; if (ferry.queue.length || ferry.boarding.length) toast(ferry.queue.length ? 'The ferry is in, and cars are rolling off' : 'The ferry is in'); }
  } else if (ferry.state === 'berthed') {
    ferry.t += dh; ramp.rotation.z += (0.05 - ramp.rotation.z) * Math.min(1, simDt * 4);
    const next = ferry.queue.find(q => !q.tried);
    if (next && ferry.t > 0.04 * (1 + (ferry.launched || 0))) {
      ferry.launched = (ferry.launched || 0) + 1;
      if (launch(next)) { ferry.queue.splice(ferry.queue.indexOf(next), 1); ferry.ashore = (ferry.ashore || 0) + 1; }
      else { next.tried = true; ferry.failed = (ferry.failed || 0) + 1; if (!ferry.warned) { ferry.warned = true; toast('The ferry is in, but no street joins the slipway to town yet; the cars wait aboard'); } }
    }
    for (let k = ferry.boarding.length - 1; k >= 0; k--) { const b = ferry.boarding[k]; b.mesh.visible = false; const ci = carMeshes.indexOf(b.mesh); if (ci >= 0) carMeshes.splice(ci, 1); peopleGroup.remove(b.mesh); ferry.boarding.splice(k, 1); }   // aboard and gone
    if (ferry.t >= WAIT + 0.04 * Math.min(6, ferry.queue.length)) { ferry.state = 'leaving'; ferry.t = 0; ferry.launched = 0; for (const q of ferry.queue) q.tried = false; }   // sails on time; anything not yet ashore comes back next call
  } else if (ferry.state === 'leaving') {
    ferry.t += dh / SAIL; const k = Math.min(1, ferry.t); ramp.rotation.z += (1.2 - ramp.rotation.z) * Math.min(1, simDt * 4);
    m.position.lerpVectors(ferry.berth, ferry.offshore, k * k);
    if (k >= 1) { ferry.state = 'away'; m.visible = false; }
  }
  m.position.y = WATER_Y + 0.02 + Math.sin(S.T * 40) * 0.01;
  // cars on their way from the ferry to a driveway
  for (let k = ferry.runs.length - 1; k >= 0; k--) { const run = ferry.runs[k]; if (moveAlong(run.mesh, run.trip, run.trip.speed * simDt)) { run.onArrive(); ferry.runs.splice(k, 1); } }
}
export const slipCell = () => ferry.slip;
void HALF; void roadNeighbors;
