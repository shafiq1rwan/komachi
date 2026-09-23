// Komachi — landmarks on the island, placed once the town is loaded (fresh or restored), from the island alone, so every
// session puts them in the same place:
//  - a lighthouse on the rocky headland furthest out to sea; its lens glows from dusk and a pair of beams sweeps the water
//  - a red arched footbridge over a straight stretch of the canal, clear of the streets
//  - a park pavilion with benches beside the bridge, under cherry trees
// Each reserves its cells (`c.landmark`): nothing is zoned there and no street is drawn over them, except that the bridge's
// bank cells may carry a street to its feet. sim.js reads `landmarks` so residents out for a stroll can walk out to one.
// Models come from src/festival-landmark-kit.js (front +Z, ground Y 0).
import * as THREE from 'three';
import { scene, cx, cz, HALF } from './scene.js';
import { cells, cell, rebuildDecor, landmarkTrees, terrainY, placeCarPark, DIR4, joinedToTown } from './world.js';
import { coastDist, shoreKind, pierAngle, canalMouths, islandEllipse, radius, pierFrame } from './island.js';
import { createStreetFurniture } from './street-furniture.js';
import { createBike } from './bikes.js';
import { createFestivalLandmark } from './festival-landmark-kit.js';
import { snowKit } from './geometry.js';
import { PAL } from './palette.js';
import { biome } from './biome.js';

const landmarks = [];   // { kind, name, label, activity, hold: [h0, h1], anchor (Vector3), walk(road) -> points, seats? }
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const thetaOf = (x, z) => Math.atan2(z / islandEllipse[1], x / islandEllipse[0]);
let beam = null, lens = null;

/** the road cell a visitor turns off at: the nearest street within reach of `p`, or null if none has been drawn yet */
function roadNear(p, reach = 4.5) {
  let best = null, bd = reach;
  for (const c of cells) {
    if (c.type !== 'road' || c.ramp || (c.h || 0) > 0 || !joinedToTown(c)) continue;   // only streets that reach the town
    const d = Math.hypot(cx(c.i) - p.x, cz(c.j) - p.z); if (d < bd) { bd = d; best = c; }
  }
  return best;
}
/** from the road cell's pavement toward `p`: the kerb point a visitor steps off the street at */
function kerbToward(road, p) {
  const x = cx(road.i), z = cz(road.j), d = new THREE.Vector3(p.x - x, 0, p.z - z);
  if (Math.abs(d.x) > Math.abs(d.z)) d.set(Math.sign(d.x), 0, 0); else d.set(0, 0, Math.sign(d.z) || 1);   // leave along the grid
  return new THREE.Vector3(x + d.x * 0.42, 0.1, z + d.z * 0.42);
}
const local = (g, v) => new THREE.Vector3(...v).applyMatrix4(g.matrixWorld);

function placeLighthouse() {
  const pier = pierAngle(); let best = null, score = -Infinity;
  // a stretch of rocks first; failing that a single rocky point, then any shore that is not sand (some islands have few rocks)
  const tiers = [th => [-0.12, 0, 0.12].every(o => shoreKind(th + o) === 'rock'), th => shoreKind(th) === 'rock', th => shoreKind(th) !== 'beach'];
  for (const ok of tiers) {
    for (const c of cells) {
      if (c.type !== 'empty' || (c.h || 0) || c.keep || c.coast || c.yard || c.slip || c.landmark) continue;
      const x = cx(c.i), z = cz(c.j), d = coastDist(x, z); if (d > 1.9) continue;
      const th = thetaOf(x, z);
      if (!ok(th)) continue;
      let nearHill = false;   // two cells clear of the hill's woods and terraces, three of the ferry's slipway and yard
      for (let dj = -3; dj <= 3 && !nearHill; dj++) for (let di = -3; di <= 3; di++) { const n = cell(c.i + di, c.j + dj), near = Math.max(Math.abs(di), Math.abs(dj)) <= 2; if (n && ((near && (n.type === 'hill' || (n.h || 0) > 0)) || n.slip || n.yard)) { nearHill = true; break; } }
      if (nearHill) continue;
      if ((pier !== null && angDiff(th, pier) < 0.6) || canalMouths.some(m => angDiff(th, m) < 0.5)) continue;
      const s = radius(th) - 0.3 * d;   // the headland: furthest out, nearest the water
      if (s > score) { score = s; best = c; }
    }
    if (best) break;
  }
  if (!best) return;
  const p = new THREE.Vector3(cx(best.i), 0, cz(best.j)), out = p.clone().setY(0).normalize();
  for (let k = 0; k < 20 && coastDist(p.x, p.z) > 0.6; k++) p.addScaledVector(out, 0.05);   // out onto the rocks, short of the edge
  best.landmark = 'lighthouse'; best.tree = null;
  const g = createFestivalLandmark('lighthouse'); g.scale.setScalar(1.1);
  g.position.copy(p); g.rotation.y = Math.atan2(-out.x, -out.z);   // the door faces inland
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  lens = g.getObjectByName('Lighthouse_Lens');
  if (lens) { lens.material = lens.material.clone(); lens.material.emissive = new THREE.Color(PAL.lampGlow); lens.material.emissiveIntensity = 0; }
  snowKit(g, lens ? [lens] : null); scene.add(g); g.updateMatrixWorld(true);
  // the sweeping beams: two long flat wedges from the lens, additive, fading toward their tips
  const geo = new THREE.BufferGeometry(), L = 4.2, W0 = 0.05, W1 = 0.42, pos = [], col = [];
  for (const s of [1]) {   // one beam; it dims as it swings over the land (a lamp shield on the town side)
    const v = [[0, W0, 0], [0, -W0, 0], [s * L, W1, 0], [0, -W0, 0], [s * L, -W1, 0], [s * L, W1, 0]];
    for (const q of v) { pos.push(q[0], q[1] * 0.35 - Math.abs(q[0]) * 0.05, q[1]); const f = q[0] ? 0.05 : 1; col.push(1 * f, 0.93 * f, 0.78 * f); }
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide, fog: false }));
  beam.position.copy(local(g, g.userData.lightPoint)); beam.renderOrder = 6; beam.visible = false; beam.userData.out = out.clone(); scene.add(beam);
  // visitors come up to the door, then round to the tower's flank to look out to sea
  const view = local(g, g.userData.viewPoint).setY(0.1), side = new THREE.Vector3(-out.z, 0, out.x);
  const flank = p.clone().addScaledVector(side, 0.62).addScaledVector(out, 0.08).setY(0.1);
  if (coastDist(flank.x, flank.z) < 0.35) flank.copy(p).addScaledVector(side, -0.62).addScaledVector(out, 0.08).setY(0.1);
  landmarks.push({ kind: 'lighthouse', name: 'the lighthouse', label: 'walking out to the lighthouse', activity: 'looking out to sea by the lighthouse', hold: [0.25, 0.5], anchor: view,
    face: Math.atan2(out.x, out.z), target: p.clone().setY(0.6), walk: road => [kerbToward(road, view), view.clone(), flank.clone()] });
}

function placeBridgeAndPavilion() {
  // a straight canal cell (canal both ways along the flow) with plain land either side, well away from the mouths and other crossings
  const cand = [];
  for (const c of cells) {
    if (c.type !== 'canal' || c.keep || c.landmark) continue;
    for (const [fi, fj] of [[1, 0], [0, 1]]) {
      const f1 = cell(c.i + fi, c.j + fj), f2 = cell(c.i - fi, c.j - fj); if (!f1 || !f2 || f1.type !== 'canal' || f2.type !== 'canal') continue;
      const A = cell(c.i + fj, c.j + fi), B = cell(c.i - fj, c.j - fi);
      const plain = n => n && n.type === 'empty' && !(n.h || 0) && !n.keep && !n.coast && !n.yard && !n.slip && !n.landmark;
      if (!plain(A) || !plain(B)) continue;
      let clear = true;   // no bridge or street within three cells along the canal
      for (let k = -3; k <= 3 && clear; k++) { const n = cell(c.i + fi * k, c.j + fj * k); if (n && (n.type === 'road' || n.bridge)) clear = false; }
      if (!clear || coastDist(cx(c.i), cz(c.j)) < 3) continue;
      const d = Math.hypot(c.i - HALF, c.j - HALF);
      cand.push({ c, A, B, fi, fj, s: -Math.abs(d - 7) });
    }
  }
  if (!cand.length) return;
  cand.sort((a, b) => b.s - a.s);
  const { c, A, B, fi, fj } = cand[0];
  c.landmark = 'bridge'; A.landmark = 'bridge-end'; B.landmark = 'bridge-end'; A.tree = null; B.tree = null;
  const g = createFestivalLandmark('arched-bridge');
  g.position.set(cx(c.i), 0, cz(c.j)); g.rotation.y = Math.atan2(A.i - c.i, A.j - c.j);   // the span (local z) runs bank to bank
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  snowKit(g); scene.add(g); g.updateMatrixWorld(true);
  const path = g.userData.path.map(v => local(g, v));
  const endA = path[path.length - 1].distanceTo(new THREE.Vector3(cx(A.i), 0, cz(A.j))) < path[0].distanceTo(new THREE.Vector3(cx(A.i), 0, cz(A.j))) ? path.slice().reverse() : path;   // from bank A up to the crown
  const up = endA.slice(0, Math.floor(endA.length / 2) + 1), bankA = endA[0];
  const steps = p => p.clone().setY(Math.max(0.1, p.y));   // trip points hold height above the ground; the deck rises over the water
  landmarks.push({ kind: 'bridge', name: 'the arched bridge', label: 'strolling over the arched bridge', activity: 'watching the carp from the bridge', hold: [0.12, 0.3], anchor: bankA,
    face: Math.atan2(fi, fj) + (Math.random() < 0.5 ? 0 : Math.PI),   // at the crown, looking along the water
    target: path[Math.floor(path.length / 2)].clone(),
    walk: road => [kerbToward(road, bankA), ...up.map(steps)] });

  // the pavilion: on a plain cell next to bank A or B along the canal, its steps toward the bridge foot; a cell with no street
  // beside it first, so no lamp or pole stands against the roof; a cherry at its back corner and one on the bank by the bridge
  const spots = [];
  for (const bank of [A, B]) for (const s of [1, -1]) {
    const P = cell(bank.i + fi * s, bank.j + fj * s);
    if (!P || P.type !== 'empty' || (P.h || 0) || P.keep || P.coast || P.yard || P.slip || P.landmark) continue;
    const street = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => { const n = cell(P.i + di, P.j + dj); return n && n.type === 'road'; });
    spots.push({ P, bank, street });
  }
  spots.sort((a, b) => a.street - b.street);
  if (spots.length) {
    const { P, bank } = spots[0];
    P.landmark = 'pavilion'; P.tree = null;
    const toWater = new THREE.Vector3(c.i - bank.i, 0, c.j - bank.j), toBank = new THREE.Vector3(bank.i - P.i, 0, bank.j - P.j);
    const pv = createFestivalLandmark('park-pavilion'), sc = 0.66;
    pv.scale.setScalar(sc); pv.position.set(cx(P.i), 0, cz(P.j)); pv.rotation.y = Math.atan2(toBank.x, toBank.z);
    pv.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    snowKit(pv); scene.add(pv); pv.updateMatrixWorld(true);
    const blossom = biome.blossom ? biome.treeColors[0] : PAL.pink, seed = P.i * 31 + P.j * 7;
    const back = new THREE.Vector3(cx(P.i), 0, cz(P.j)).addScaledVector(toBank, -0.4).addScaledVector(toWater, -0.36);
    const onBank = new THREE.Vector3(cx(bank.i), 0, cz(bank.j)).addScaledVector(toWater, -0.3).addScaledVector(toBank, 0.12);
    landmarkTrees.push({ x: back.x, z: back.z, s: 0.8, color: blossom, seed }, { x: onBank.x, z: onBank.z, s: 0.72, color: blossom, seed: seed + 5 });
    const seats = pv.userData.seats.map(v => { const p = local(pv, v); p.y = v[1] * sc - 0.025 + terrainY(p.x, p.z); return { pos: p, rot: pv.rotation.y + (v[0] < 0 ? Math.PI / 2 : -Math.PI / 2), taken: null }; });
    const door = local(pv, pv.userData.entrance).setY(0.1), steps = door.clone().addScaledVector(toBank, 0.22);
    landmarks.push({ kind: 'pavilion', name: 'the park pavilion', label: 'walking to the pavilion in the park', activity: 'resting in the pavilion under the cherries', hold: [0.3, 0.6], anchor: steps, seats, target: pv.position.clone().setY(0.4),
      walk: road => [kerbToward(road, steps), steps.clone(), door.clone()] });
  }
  rebuildDecor();
}

// ── the stone quay (built in island.js): people fish from its edges; a reserved car park by its land end opens once a street
//    reaches it, and a bike rack on the quay fills with the anglers' bicycles ──
let pierLot = null, rackBikes = [], pierSpots = null, lotCheck = 0;
function placePier() {
  const P = pierFrame(); if (!P) return;
  pierSpots = P.spots;
  const land = P.at(-0.4, 0).setY(0.1);   // on the grass just behind the quay's root
  // the car park: the nearest plain cell to the quay's land end, kept for it
  let best = null, bd = 3.4;   // nearest first, and a cell already beside a town street before one that must wait for a street
  for (const c of cells) {
    if (c.type !== 'empty' || (c.h || 0) || c.keep || c.coast || c.yard || c.slip || c.landmark || c.park) continue;
    const street = DIR4.some(([a, b]) => { const n = cell(c.i + a, c.j + b); return n && n.type === 'road' && joinedToTown(n); });
    const d = Math.hypot(cx(c.i) - land.x, cz(c.j) - land.z) + (street ? 0 : 1.2); if (d < bd) { bd = d; best = c; }
  }
  if (best) { best.landmark = 'pier-park'; best.tree = null; pierLot = best; }
  // the bike rack on the quay, near its root, and a bicycle for each angler (three at most)
  const rack = createStreetFurniture('bike-rack'), rp = P.at(0.42, -(P.width / 2 - 0.14)); rp.y = P.deckY + 0.035;
  rack.position.copy(rp); rack.rotation.y = P.ang + Math.PI / 2; scene.add(rack); rack.updateMatrixWorld(true);
  const cols = ['#6f9a96', '#d98b7a', '#e6d7a8'];
  rackBikes = rack.userData.bays.map((b, k) => { const bike = createBike(cols[k]); bike.position.copy(local(rack, b)); bike.rotation.y = rack.rotation.y; bike.visible = false; scene.add(bike); return bike; });
  const entry = { kind: 'pier', name: 'the quay', label: 'going fishing off the quay', activity: 'fishing off the quay', hold: [0.7, 1.6], anchor: land, fish: true, target: P.at(P.len * 0.6, 0),
    visit() {   // a free place along the edge, and the way out to it: off the kerb, over the grass, onto the quay and along its middle
      const free = pierSpots.filter(s => s.taken < 1); if (!free.length) return null;
      const s = free[Math.floor(Math.random() * free.length)];
      return { ...entry, spot: s, face: s.face, walk: road => [kerbToward(road, land), land.clone(), P.at(0.12, 0), P.at(Math.min(s.a, P.len - 0.35), 0), s.pos.clone()] };
    } };
  landmarks.push(entry);
  rebuildDecor();
}

/** once, after the town is loaded: the island's landmarks and the cells they keep */
function placeLandmarks() {
  if (landmarks.length) return;
  placeLighthouse(); placeBridgeAndPavilion(); placePier();
}
/** a landmark worth walking out to from a street, with the street it is reached from (the quay hands out a free fishing place) */
function landmarkRoads() {
  const out = [];
  for (const l of landmarks) { const road = roadNear(l.anchor); if (!road) continue; const v = l.visit ? l.visit() : l; if (v) out.push({ l: v, road }); }
  return out;
}

let sweep = 0;
/** each frame: the lens glows as the light goes, the beams sweep round (night: 0 by day, 1 at night) */
function updateLandmarks(dt, night) {
  if (pierSpots) { const n = pierSpots.reduce((a, s) => a + s.taken, 0); rackBikes.forEach((b, k) => { b.visible = k < Math.min(3, Math.ceil(n * 0.7)); }); }
  if (pierLot && pierLot.park !== 'public' && (lotCheck += dt) > 2) {   // the reserved lot opens as a car park once a street reaches it
    lotCheck = 0;
    if (DIR4.some(([a, b]) => { const n = cell(pierLot.i + a, pierLot.j + b); return n && n.type === 'road'; })) { pierLot.landmark = null; placeCarPark([pierLot]); pierLot.landmark = 'pier-park'; }
  }
  if (lens) lens.material.emissiveIntensity = 0.2 + night * 2.6;
  if (beam) {
    sweep += dt * 0.7; beam.rotation.y = sweep;
    const o = beam.userData.out, seaward = Math.cos(sweep) * o.x - Math.sin(sweep) * o.z, f = Math.min(1, Math.max(0, (seaward + 0.3) / 0.8));
    beam.material.opacity = Math.max(0, night - 0.15) * 0.5 * (0.1 + 0.9 * f * f * (3 - 2 * f)); beam.visible = beam.material.opacity > 0.01;
  }
}
export { landmarks, placeLandmarks, updateLandmarks, landmarkRoads };
