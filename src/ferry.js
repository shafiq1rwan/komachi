// Komachi — the car ferry (Phase 5). Nothing on wheels appears out of thin air: a small ro-ro ferry calls at a slipway
// beside the pier three times a day. Visiting cars roll off it and drive back to it to leave, a resident's car comes
// off the sailing after they move in, and the building materials on its deck are unloaded into a builders' yard by
// the slipway that the delivery trucks load from. Everything here is visual and demand-driven: nothing is counted or
// gated, and construction time is untouched (the yard only looks fuller while more sites are under way).
import * as THREE from 'three';
import { PAL } from './palette.js';
import { S } from './state.js';
import { scene, peopleGroup, cx, cz, HALF } from './scene.js';
import { box, cyl, colorize, mergeMesh } from './geometry.js';
import { cells, cell, blocks, DONE, refreshWorld } from './world.js';
import { coastPoint, pierAngle, islandEllipse, coastDist, shoreKind, canalMouths, beachExtra, seaRocks, harborIsland } from './island.js';
import { buildHarbor } from './harbor.js';
const [SX, SZ] = islandEllipse;
import { makeCar, moveAlong, buildPoints, routeCells, roadNeighbors, frontRoad, carMeshes, parkVehicle, adoptWanderer, setVehicleSource, hourOf } from './sim.js';
import { setYardStart } from './construction.js';
import { toast } from './toast.js';
import { record } from './chronicle.js';
import { createIslandFerry } from './island-ferry-model.js';

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
  const clear = th => canalMouths.every(m => angDiff(m, th) > 0.55) && angDiff(base, th) > 0.45;   // away from every waterfall and from the pier itself
  /** march from a road cell along a direction until the shore distance drops to `target` (radial units) */
  const marchFrom = (x0, z0, ux, uz, target) => { let t = 0; while (t < 30 && coastDist(x0 + ux * t, z0 + uz * t) > target) t += 0.02; return [x0 + ux * t, z0 + uz * t]; };
  /** the full slipway geometry for a road cell and a lane direction, or null when the shore there is no good: a rocky
   *  stretch at the landing, a waterfall or the pier close by, or a sea boulder on the berth or the sailing line */
  const layout = (c, ux, uz, strict) => {
    const x0 = cx(c.i), z0 = cz(c.j);
    const [ex, ez] = marchFrom(x0, z0, ux, uz, -0.12); const thE = Math.atan2(ez / SZ, ex / SX), be = beachExtra(thE);   // the edge sits just past the land's bevel, so the slope starts clear of it
    if (coastDist(ex, ez) > 0.2) return null;   // never reached the shore
    const dl = Math.hypot(ex - x0, ez - z0); if (dl > 6.5) return null;   // the lane must reach the shore within a few cells, not run along it
    for (let k = 1; k <= Math.ceil(dl); k++) { const n = cell(c.i + ux * k, c.j + uz * k); if (!n) break; if (coastDist(cx(n.i), cz(n.j)) < 0.35) break; if (n.type !== 'empty' || (n.h || 0) > 0 || n.canal || n.block) return null; }   // and cross only free flat ground
    if (strict && (shoreKind(thE) === 'rock' || shoreKind(thE + 0.1) === 'rock' || shoreKind(thE - 0.1) === 'rock')) return null;
    if (strict && !clear(thE)) return null;
    const [lx, lz] = marchFrom(x0, z0, ux, uz, -be + 0.12), [bx, bz] = marchFrom(x0, z0, ux, uz, -be - 1.55), [ox, oz] = marchFrom(x0, z0, ux, uz, -be - 7);
    if (strict) for (const r of seaRocks) {   // distance from the boulder to the sailing line between berth and horizon, and to the berth itself
      const dx = ox - bx, dz = oz - bz, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((r.x - bx) * dx + (r.z - bz) * dz) / L2));
      const px = bx + dx * t, pz = bz + dz * t; if (Math.hypot(r.x - px, r.z - pz) < r.r + 0.9) return null;
    }
    return { ex, ez, lx, lz, bx, bz, ox, oz, thE, ux, uz };
  };
  let best = null, bd = 1e9;
  if (harborIsland) {
    // Berth in the recessed basin, with a grid-aligned approach through the breakwater entrance.
    for (const c of cells) {
      const x = cx(c.i), z = cz(c.j);
      if (!c.coast || c.bridge || c.type !== 'road' || Math.abs(x) > 3.6 || z < 5) continue;
      const lay = layout(c, 0, 1, true); if (!lay) continue;
      const score = Math.abs(x - 1.5) + Math.abs(lay.ez - z - 2) * 0.2;
      if (score < bd) { bd = score; best = { c, th: lay.thE, lay }; }
    }
  }
  const harborBest = best;
  for (const dth of [0.34, -0.34, 0.5, -0.5, 0.7, -0.7, 0.9, -0.9, 1.2, -1.2, 1.6, -1.6, 2.0, -2.0, 2.4, -2.4, 2.8, -2.8]) {   // round the shore from the pier, nearest first
    if (harborBest) break;
    const th = base + dth, [lx, lz] = coastPoint(th, -0.6);
    for (const c of cells) {
      if (!c.coast || c.bridge || c.type !== 'road') continue;
      const dir = seaward(c); if (!dir) continue;
      const lay = layout(c, dir[0], dir[1], true); if (!lay) continue;
      const d = Math.hypot(cx(c.i) - lx, cz(c.j) - lz); if (d < bd) { bd = d; best = { c, th, lay }; }
    }
    if (best && bd < 2.2) break;
  }
  if (!best) {   // no clean straight stretch: any coast road cell, any of the four grid directions whose lane reaches clear water; strict first
    for (const strict of [true, false]) {
      for (const c of cells) {
        if (!c.coast || c.bridge || c.type !== 'road') continue; const x0 = cx(c.i), z0 = cz(c.j), th = Math.atan2(z0 / SZ, x0 / SX);
        for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n1 = cell(c.i + ux, c.j + uz); if (n1 && (n1.type === 'road' || n1.canal || n1.block || (n1.h || 0) > 0)) continue;
          const lay = layout(c, ux, uz, strict); if (!lay) continue;
          const d = Math.hypot(x0 - coastPoint(base + 0.34, -0.6)[0], z0 - coastPoint(base + 0.34, -0.6)[1]); if (d < bd) { bd = d; best = { c, th, lay }; }
        }
      }
      if (best) break;
    }
    if (!best) return false;
  }
  ferry.slip = best.c; best.c.slip = true;   // the streets pass: no stop sign or car park on the slipway cell
  const { ex, ez, lx, lz, bx, bz, ox, oz, ux, uz } = best.lay;
  // the lane: grid cells from the slip road toward the sea become real road cells (kept, not zonable), so cars drive a street
  let last = best.c;
  for (let k = 1; k <= 6; k++) { const c = cell(best.c.i + ux * k, best.c.j + uz * k); if (!c || c.type !== 'empty' || (c.h || 0) > 0 || c.canal || c.block || coastDist(cx(c.i), cz(c.j)) < 0.05) break; c.type = 'road'; c.slip = true; c.keep = true; c.tree = null; last = c; }   // every cell whose centre is on land
  ferry.lane = last;
  ferry.laneEnd = new THREE.Vector3(cx(last.i) + ux * 0.5, 0.08, cz(last.j) + uz * 0.5);   // the far kerb of the last lane cell; a short flat strip may run on from here to the land edge
  ferry.theta = Math.atan2(ez / SZ, ex / SX);
  ferry.edge = new THREE.Vector3(ex, 0.08, ez);          // the last of the grass: the flat lane ends here
  ferry.land = new THREE.Vector3(lx, -0.5, lz);          // the landing on the beach, where the ship's ramp comes down
  ferry.berth = new THREE.Vector3(bx, WATER_Y, bz); ferry.offshore = new THREE.Vector3(ox, WATER_Y, oz);
  // the yard: the inland neighbour of the slip cell that is free ground
  const c0 = best.c, l1 = cell(c0.i + ux, c0.j + uz);   // the inland neighbour opposite the lane first, then the cells beside the lane's first cell, then beside the slip
  const cand = [cell(c0.i - ux, c0.j - uz), l1 && cell(l1.i - uz, l1.j + ux), l1 && cell(l1.i + uz, l1.j - ux), cell(c0.i - uz, c0.j + ux), cell(c0.i + uz, c0.j - ux)].filter(n => n && n.type === 'empty' && !(n.h > 0) && !n.canal && !n.slip);
  if (cand.length) { ferry.yard = cand[0]; ferry.yard.yard = true; ferry.yard.tree = null; }
  return true;
}
/** slipway (concrete ramp from the road down to the beach), yard fence, sign; the stacked materials are rebuilt as sites change */
let slipMesh = null, yardMesh = null, yardCount = -1;
function buildSlip() {
  const g = [], s = ferry.slip, x0 = cx(s.i), z0 = cz(s.j), E = ferry.edge, L = ferry.land;
  const ang = Math.atan2(E.x - x0, E.z - z0), ux = Math.sin(ang), uz = Math.cos(ang), drop = Math.max(0.3, Math.hypot(L.x - E.x, L.z - E.z));
  const LE = ferry.laneEnd || E, gap = Math.hypot(E.x - LE.x, E.z - LE.z);
  if (gap > 0.05) { g.push(box(0.8, 0.08, gap + 0.06, PAL.asphalt, (LE.x + E.x) / 2, 0.04, (LE.z + E.z) / 2, ang)); for (const sd of [-1, 1]) g.push(box(0.1, 0.1, gap + 0.06, PAL.sidewalk, (LE.x + E.x) / 2 + Math.cos(ang) * sd * 0.44, 0.05, (LE.z + E.z) / 2 - Math.sin(ang) * sd * 0.44, ang)); }   // the last strip of land before the edge
  // the street itself is real road cells (drawn by rebuildRoads); from its end a concrete slope runs down the beach to the landing
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
  const grp = new THREE.Group();
  // the Komachi Maru: bow +Z in the model, so an inner group turns it to the sim's +X hull frame (heading maths unchanged)
  const model = createIslandFerry(); const inner = new THREE.Group(); inner.rotation.y = Math.PI / 2; inner.add(model); grp.add(inner);
  model.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const ramp = model.getObjectByName('Ramp'); ramp.rotation.x = RAMP_UP; grp.userData.ramp = ramp;
  const mats = new Set(); model.traverse(o => { if (o.isMesh) mats.add(o.material); }); grp.userData.mats = [...mats];
  const d = model.userData.deck || [0, 0.24, 0.72];
  grp.userData.deck = new THREE.Vector3(d[2], d[1], -d[0]);   // model (x, y, z) → hull frame (z, y, -x)
  grp.scale.setScalar(FERRY_SCALE); ferry.deck = grp.userData.deck.clone().multiplyScalar(FERRY_SCALE);
  grp.position.copy(ferry.offshore); grp.visible = false; scene.add(grp); ferry.mesh = grp;
}
const RAMP_UP = -Math.PI / 2, RAMP_DOWN = 0.18;   // the bow ramp: raised against the bow, and lowered a little past level onto the beach

/** the world-space point for a spot on the deck, given the ferry's heading */
function deckPoint(k = 0) { const p = ferry.deck.clone(); p.x -= k * 0.42; p.applyAxisAngle(new THREE.Vector3(0, 1, 0), ferry.mesh.rotation.y); return p.add(ferry.mesh.position).setY(WATER_Y + 0.02 + 0.245 * FERRY_SCALE); }   // the deck plane, 0.24 above the waterline in the model
/** the drive from the deck down the ramp onto the slipway and then along the streets; returns trip points */
function offPath(dest, endPos) {
  const road = routeCells([ferry.lane || ferry.slip], dest); if (!road) return null;   // from the top of the slope, along the lane street
  const s = ferry.lane || ferry.slip, top = new THREE.Vector3(cx(s.i), 0.08, cz(s.j));
  const onRoad = buildPoints(road, top, endPos, 0.17, 0.08, -1);
  return { pts: [deckPoint(), ferry.land.clone(), ferry.edge.clone(), ...onRoad], cells: road };   // deck → landing → top of the slope → along the lane
}
function requestWanderer(color, vkind) { ferry.queue.push({ kind: 'wanderer', color, vkind }); }
/** q: { make() -> mesh (+z forward, in carMeshes), dest() -> road cell or null, onArrive(mesh) } */
function shipVehicle(q) { ferry.queue.push({ kind: 'deliver', ...q }); }
function orderCar(r) { if (!ferry.queue.some(q => q.kind === 'carFor' && q.r === r)) ferry.queue.push({ kind: 'carFor', r }); }
/** a visiting car heading home: it drives to the slip, waits at the landing if the ferry is out, and boards when it is in */
function boardCar(mesh) {   // wait in a line down the slipway lane until the ferry is in
  mesh.userData.parked = true; const k = ferry.boarding.length; const s = ferry.lane || ferry.slip, top = new THREE.Vector3(cx(s.i), 0.08, cz(s.j));
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
  } else if (q.kind === 'deliver') {
    const dest = q.dest(); if (!dest) return false;
    const p = offPath([dest], new THREE.Vector3(cx(dest.i), 0.08, cz(dest.j))); if (!p) return false;
    const mesh = q.make(); mesh.visible = true; mesh.position.copy(p.pts[0]);
    ferry.runs.push({ mesh, trip: { pts: p.pts, i: 0, t: 0, speed: 2.0, cells: p.cells }, onArrive: () => q.onArrive(mesh) });
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
  buildHarbor(ferry);
  buildSlip(); buildFerry(); buildYardStock(); ferry.ready = true;
  setVehicleSource({ requestWanderer, orderCar, boardCar, slip: () => ferry.lane || ferry.slip });
  setYardStart(() => ferry.slip);
  ferry.state = 'away';
  refreshWorld();
}
// ── wake: a pool of soft foam sprites; one is dropped astern every so often while the ship moves, then spreads and fades ──
const foamTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const grd = g.createRadialGradient(64, 64, 6, 64, 64, 64); grd.addColorStop(0, 'rgba(255,255,255,0.9)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();   // white foam, unlike the amber lamp glow
const WAKE_N = 28, wakeMat = new THREE.MeshBasicMaterial({ map: foamTex, color: PAL.foam, transparent: true, depthWrite: false, opacity: 0.55 });
const wakeGeo = new THREE.PlaneGeometry(1, 1), wake = [], bowWash = []; let wakeNext = 0; const lastPos = new THREE.Vector3(); let wakeInit = false;
function ensureWake() {
  if (wake.length) return;
  for (let k = 0; k < WAKE_N; k++) { const s = new THREE.Mesh(wakeGeo, wakeMat.clone()); s.rotation.x = -Math.PI / 2; s.visible = false; s.renderOrder = 4; scene.add(s); wake.push({ m: s, age: 1 }); }
  for (const side of [-1, 1]) { const s = new THREE.Mesh(wakeGeo, wakeMat.clone()); s.rotation.x = -Math.PI / 2; s.visible = false; s.renderOrder = 4; s.userData.side = side; scene.add(s); bowWash.push(s); }
}
function updateWake(simDt, moving) {
  ensureWake(); const m = ferry.mesh;
  if (!wakeInit) { lastPos.copy(m.position); wakeInit = true; }
  const speed = moving ? lastPos.distanceTo(m.position) / Math.max(1e-4, simDt) : 0; lastPos.copy(m.position);
  const fx = Math.cos(m.rotation.y), fz = -Math.sin(m.rotation.y);   // the hull runs along local x, bow at +x: forward in the world
  const L = 1.05 * FERRY_SCALE;   // half the hull length
  if (speed > 0.05) { wakeNext -= simDt; if (wakeNext <= 0) { wakeNext = 0.09; const w = wake.reduce((a, b) => a.age > b.age ? a : b); w.age = 0; w.m.position.set(m.position.x - fx * L, WATER_Y + 0.012, m.position.z - fz * L); w.m.visible = true; } }
  for (const w of wake) { if (!w.m.visible) continue; w.age += simDt / 2.6; if (w.age >= 1) { w.m.visible = false; continue; } const s = 0.5 + w.age * 1.6; w.m.scale.set(s, s * 0.8, 1); w.m.material.opacity = 0.5 * (1 - w.age) * (1 - w.age); }
  const wash = Math.min(1, speed / 1.2);
  for (const s of bowWash) { s.visible = wash > 0.02; if (!s.visible) continue; const side = s.userData.side; s.position.set(m.position.x + fx * L * 0.75 - fz * side * 0.32 * FERRY_SCALE, WATER_Y + 0.012, m.position.z + fz * L * 0.75 + fx * side * 0.32 * FERRY_SCALE); const k = 0.45 + wash * 0.5; s.scale.set(k, k * 0.7, 1); s.material.opacity = 0.35 * wash; }
}
function setFade(m, a) { for (const mt of m.userData.mats || []) { mt.opacity = a; mt.transparent = a < 1; mt.needsUpdate = mt.transparent !== mt.userData.wasT; mt.userData.wasT = mt.transparent; } }   // opaque unless mid-fade, so the hull sorts like any solid
export function updateFerry(dh, simDt) {
  if (!ferry.ready) return;
  buildYardStock();
  const m = ferry.mesh, ramp = m.userData.ramp;
  updateWake(simDt, m.visible && (ferry.state === 'arriving' || ferry.state === 'leaving'));
  if (ferry.state === 'away') {   // a sailing starts its run in whenever the clock enters a call's window, once per call per day (robust to time jumps)
    const h = hourOf(), day = Math.floor(S.T / 24);
    if (ferry.lastCallT !== undefined && S.T < ferry.lastCallT) ferry.lastCall = null;   // the clock went backwards (a test): that call can come again
    for (const c of CALLS) if (h >= c - SAIL && h < c && ferry.lastCall !== day * 100 + c) { ferry.lastCall = day * 100 + c; ferry.lastCallT = S.T; ferry.state = 'arriving'; ferry.t = 0; m.visible = true; break; }
  }
  else if (ferry.state === 'arriving') {
    ferry.t += dh / SAIL; const k = Math.min(1, ferry.t), e = 1 - Math.pow(1 - k, 2);
    m.position.lerpVectors(ferry.offshore, ferry.berth, e); m.rotation.y = Math.atan2(ferry.land.x - m.position.x, ferry.land.z - m.position.z) - Math.PI / 2;
    setFade(m, Math.min(1, k / 0.2));   // out of the haze
    if (k >= 1) { ferry.state = 'berthed'; ferry.t = 0; ferry.calls++; if (ferry.calls === 1) record('The Komachi Maru made her first call at the slipway'); toast('The ferry is in'); ferry.rolled = false; }
  } else if (ferry.state === 'berthed') {
    ferry.t += dh; ramp.rotation.x += (RAMP_DOWN - ramp.rotation.x) * Math.min(1, simDt * 4);
    const next = ferry.queue.find(q => !q.tried);
    if (next && ferry.t > 0.04 * (1 + (ferry.launched || 0))) {
      ferry.launched = (ferry.launched || 0) + 1;
      if (launch(next)) { ferry.queue.splice(ferry.queue.indexOf(next), 1); ferry.ashore = (ferry.ashore || 0) + 1; if (!ferry.rolled) { ferry.rolled = true; if (next.kind === 'wanderer') toast('Cars are rolling off the ferry'); } }
      else { next.tried = true; ferry.failed = (ferry.failed || 0) + 1; if (!ferry.warned) { ferry.warned = true; toast('The ferry is in, but no street joins the slipway to town yet; the cars wait aboard'); } }
    }
    for (let k = ferry.boarding.length - 1; k >= 0; k--) { const b = ferry.boarding[k]; b.mesh.visible = false; const ci = carMeshes.indexOf(b.mesh); if (ci >= 0) carMeshes.splice(ci, 1); peopleGroup.remove(b.mesh); ferry.boarding.splice(k, 1); }   // aboard and gone
    if (ferry.t >= WAIT + 0.04 * Math.min(6, ferry.queue.length)) { ferry.state = 'leaving'; ferry.t = 0; ferry.launched = 0; for (const q of ferry.queue) q.tried = false; }   // sails on time; anything not yet ashore comes back next call
  } else if (ferry.state === 'leaving') {   // astern off the berth, a turn about, then away bow first into the haze
    ferry.t += dh / (SAIL * 1.4); const k = Math.min(1, ferry.t); ramp.rotation.x += (RAMP_UP - ramp.rotation.x) * Math.min(1, simDt * 4);
    const B = ferry.berth, O = ferry.offshore, away = Math.atan2(O.x - B.x, O.z - B.z), toLand = away + Math.PI;
    const px = -(O.z - B.z), pz = O.x - B.x, pl = Math.hypot(px, pz) || 1;   // sideways, for the turning arc
    const T1 = B.clone().lerp(O, 0.16), T2 = B.clone().lerp(O, 0.24).add(new THREE.Vector3(px / pl * 0.9, 0, pz / pl * 0.9));
    if (k < 0.3) { const q = k / 0.3; m.position.lerpVectors(B, T1, q * q); m.rotation.y = toLand - Math.PI / 2; }
    else if (k < 0.6) { const q = (k - 0.3) / 0.3, s = q * q * (3 - 2 * q); m.position.lerpVectors(T1, T2, s); m.rotation.y = toLand - Math.PI / 2 + Math.PI * s; }
    else { const q = (k - 0.6) / 0.4; m.position.lerpVectors(T2, O, q * q); m.rotation.y = away - Math.PI / 2; setFade(m, 1 - Math.max(0, (q - 0.55) / 0.45)); }
    if (k >= 1) { ferry.state = 'away'; m.visible = false; setFade(m, 1); }
  }
  m.position.y = WATER_Y + 0.02 + Math.sin(S.T * 40) * 0.01;
  // cars on their way from the ferry to a driveway
  for (let k = ferry.runs.length - 1; k >= 0; k--) { const run = ferry.runs[k]; if (moveAlong(run.mesh, run.trip, run.trip.speed * simDt)) { run.onArrive(); ferry.runs.splice(k, 1); } }
}
export const slipCell = () => ferry.slip;
void HALF; void roadNeighbors;

export { shipVehicle, boardCar };
