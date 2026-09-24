// Komachi — procedural buildings: three zone types × three levels, plus construction stages
import * as THREE from 'three';
import { S } from './state.js';
import { genRichBuilding } from './rich-buildings.js';
import { PAL } from './palette.js';
import { cx, cz, townGroup, disposeGroup } from './scene.js';
import { box, prism, blob, cyl, colorize, mergeMesh, makeGlow, snowKit, lampHeadMat, coneMat, lightCone } from './geometry.js';
import { addFurniture } from './street-furniture.js';
import { addNeighbourhood } from './neighbourhood-kits.js';
import { createSubwayStation, STATION_LIGHT_MESHES } from './subway-station.js';
import { createCivicProp } from './civic-kit.js';
import { createLandmark } from './landmark-kit.js';
import { createTownService } from './town-services-kit.js';
import { addNature } from './nature-kit.js';
import { leafColor, seasonOf } from './seasons.js';
import { K, acUnit, pipe, balcony, extStairs, fence, pots, bicycle, bikeRack, signBoard, plainAwning, stripedAwning, windowPane, door, kawaraRoof, blockWall, genkan, tateKanban, noren, chochin, laundry, slatWall, tileBand, corrugated, boxCanopy, hangingSign, dish, latticeWindow, engawa, hisashi, yardProps } from './kit.js';
/** a second, third… independent value derived from a unit's seed, so details vary without correlating */
const sub = (s, k) => { const v = Math.sin(s * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
import { DONE, lampGlowMat, cell as cellAtIJ } from './world.js';

let LG = [];   // laundry geometry for the unit being built (its own mesh, shown in the daytime; see rebuildUnitMesh)
const UPPER = 0.4;   // a detached home's upper storey height; the ground floor is 0.5
const floorY = f => f === 0 ? 0 : 0.5 + (f - 1) * UPPER;   // the floor line of storey f in a detached home
function dims(type, level) {
  if (type === 'res') return { w: 0.72, d: 0.6, H: 0.5 + (level - 1) * UPPER + 0.06 };   // a 0.5 ground floor and a lower upper storey, as a house has
  if (type === 'shop') return { w: 0.78, d: 0.66, H: 0.62 + (level >= 2 ? 0.5 : 0) };
  return { w: 0.8, d: 0.7, H: 0.95 + (level - 1) * 0.55 };
}
/** Where the front door is, in the unit's local space (front face is +z before the unit is rotated). */
function doorLocal(type, level) {
  const { d } = dims(type, level);
  const x = type === 'res' ? -0.16 : type === 'shop' ? -0.24 : 0;
  return { x, z: d / 2 + 0.02 };
}
/** World-space points for entering/leaving a unit: [doorstep, kerb]. The kerb sits just past the plinth on the sidewalk. */
function unitDoorPoints(u) {
  const ry = u.facing || 0, s = Math.sin(ry), c = Math.cos(ry);
  const { x, z } = u.door || (u.block.type === 'station' ? { x: 0, z: 0.5 } : doorLocal(u.block.type, u.block.level));
  const px = cx(u.cell.i), pz = cz(u.cell.j);
  const local = (lx, lz, y) => new THREE.Vector3(px + lx * c + lz * s, y, pz - lx * s + lz * c);
  return [local(x, z, 0.12), local(x, 0.64, 0.1)];    // doorstep on the plinth, kerb on the sidewalk
}

// ── residential ──
function genResidential(b, u, g, wg) {
  const v = u.variant || 'detached';
  if (v === 'narrow') return genNarrowHouse(b, u, g, wg);
  if (v === 'apartment') return genApartment(b, u, g, wg);
  if (v === 'terrace') return genTerrace(b, u, g, wg);
  if (v === 'manshon') return genManshon(b, u, g, wg);
  if (v === 'villa') return genVilla(b, u, g, wg);
  const style = u.style = sub(u.seed, 1) < 0.5 ? 'cottage' : sub(u.seed, 1) < 0.75 ? 'machiya' : 'modern';   // three detached looks; the cottage stays the common one
  if (style === 'machiya') return genMachiya(b, u, g, wg);
  if (style === 'modern') return genModern(b, u, g, wg);
  const L = b.level, { w, d, H } = dims('res', L), y0 = 0.12, metal = b.roofStyle === 'metal', kawara = b.roofStyle === 'kawara';
  u.door = { x: -0.16, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  if (u.seed > 0.5) for (let k = 0; k < 4; k++) g.push(box(w + 0.01, 0.012, d + 0.01, K.siding, 0, y0 + 0.1 + k * 0.12, 0));
  if (sub(u.seed, 5) > 0.6) dish(g, -w / 2 - 0.03, y0 + H - 0.12, 0.12, -Math.PI / 2);
  if (metal) {
    g.push(prism(w + 0.2, 0.22, d + 0.22, K.metal, 0, y0 + H - 0.01, 0)); g.push(box(w + 0.24, 0.04, d + 0.26, K.metal2, 0, y0 + H, 0));
    for (let k = 0; k < 5; k++) { const rz = -d / 2 + 0.05 + k * ((d - 0.1) / 4); g.push(box(w + 0.2, 0.012, 0.012, K.metal2, 0, y0 + H + 0.11 - Math.abs(rz) / (d / 2) * 0.1 + 0.005, rz)); }
  } else kawaraRoof(g, w, d, H, y0, kawara ? (u.seed > 0.5 ? PAL.kawara : PAL.kawara2) : b.roof, L >= 2);   // tile courses and a ridge cap; hip-and-gable from level 2
  door(g, -0.16, y0, d / 2 + 0.005, 0.16, 0.27, PAL.wood, kawara ? PAL.kawara2 : b.roof); genkan(g, -0.16, y0, d / 2 + 0.02);
  for (let f = 0; f < L; f++) {
    const y = y0 + floorY(f) + (f === 0 ? 0.3 : 0.2);
    for (const x of (f === 0 ? [0.18] : [-0.16, 0.18])) windowPane(g, wg, x, y, d / 2 + 0.005, 0.16, 0.16);
    windowPane(g, wg, w / 2 + 0.005, y, 0.1, 0.16, 0.16, Math.PI / 2);
    if (f === 0) { g.push(box(0.24, 0.05, 0.08, PAL.wood, 0.18, y - 0.12, d / 2 + 0.04)); g.push(blob(0.06, PAL.bush, 0.14, y - 0.06, d / 2 + 0.04, 0, 0.8)); g.push(blob(0.05, PAL.flower, 0.23, y - 0.06, d / 2 + 0.04, 0, 0.8)); }
  }
  if (L >= 2) { g.push(box(0.1, 0.28, 0.1, PAL.concrete, -0.2, y0 + H + 0.12, -0.12)); balcony(g, 0.04, y0 + 0.52, d / 2 + 0.08, 0.42, 0.16, PAL.wood2); if (u.seed > 0.3) laundry(LG, 0.04, y0 + 0.52, d / 2 + 0.16, 0.42, u.seed); }
  for (let f = 0; f < L; f++) { const y = y0 + floorY(f) + (f === 0 ? 0.3 : 0.2); windowPane(g, wg, 0.14, y, -d / 2 - 0.005, 0.16, 0.14, Math.PI); windowPane(g, wg, -w / 2 - 0.005, y, -0.1, 0.14, 0.14, -Math.PI / 2); }
  acUnit(g, w / 2 + 0.05, y0 + 0.2, -0.18, Math.PI / 2); pipe(g, -w / 2 - 0.02, y0, y0 + H - 0.05, -d / 2 + 0.05);
  if (u.seed > 0.5) { blockWall(g, 0.02, 0.45, 0.9, true, [-0.3, -0.02]); blockWall(g, -0.45, -0.02, 0.86, false); }   // block wall with the gate slid open in front of the door
  else { fence(g, 0.1, 0.45, 0.6, true, PAL.wood); fence(g, -0.45, 0, 0.8, false, PAL.wood); }
  g.push(box(0.9, 0.12, 0.08, PAL.bush, 0, 0.18, -0.43));
  pots(g, 0.3, 0.36, 2); yardProps(g, LG, u.seed, w, d);
  if (u.seed > 0.55) bicycle(g, -0.4, 0.3, 0.1, K.bike[Math.floor(u.seed * 5) % 5]);
  if (u.seed > 0.75) g.push(box(0.05, 0.3, 0.05, PAL.lamp, 0.42, 0.27, 0.42));
}
/** machiya: a timber townhouse right on the street, slatted upper wall, lattice window, engawa step and a pent roof over the ground floor */
function genMachiya(b, u, g, wg) {
  const L = b.level, { w, d, H } = dims('res', L), y0 = 0.12, tile = b.roofStyle === 'kawara' ? (sub(u.seed, 2) > 0.5 ? PAL.kawara : PAL.kawara2) : b.roof;
  u.door = { x: -0.18, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  slatWall(g, w, d, y0 + H - 0.2, y0 + H - 0.05, 'z', PAL.wood, 0.05);   // a slatted band under the eaves only; plaster below
  for (const s of [-1, 1]) g.push(box(0.03, H - 0.02, 0.03, PAL.wood2, s * (w / 2 - 0.005), y0 + H / 2, d / 2 - 0.005));   // timber corner posts
  kawaraRoof(g, w, d, H, y0, tile, false);
  hisashi(g, w, d, y0 + 0.46, tile);
  door(g, -0.18, y0, d / 2 + 0.005, 0.16, 0.3, PAL.wood2); genkan(g, -0.18, y0, d / 2 + 0.02, 0.2);
  latticeWindow(g, wg, 0.16, y0 + 0.26, d / 2 + 0.005, 0.3, 0.2, 0, PAL.wood);
  for (let f = 1; f < L; f++) { const y = y0 + floorY(f) + 0.18; for (const x of [-0.18, 0.16]) { windowPane(g, wg, x, y, d / 2 + 0.005, 0.18, 0.16); g.push(box(0.22, 0.012, 0.03, PAL.wood2, x, y - 0.1, d / 2 + 0.02)); } }   // plain upper windows with a timber sill
  if (L === 1) for (const x of [-0.2, 0.0, 0.2]) g.push(box(0.05, 0.1, 0.02, PAL.cream2, x, y0 + H - 0.14, d / 2 + 0.03));   // mushiko-mado slits under the eaves
  for (let f = 0; f < L; f++) { const y = y0 + floorY(f) + (f === 0 ? 0.3 : 0.18); windowPane(g, wg, 0.12, y, -d / 2 - 0.005, 0.16, 0.14, Math.PI); windowPane(g, wg, -w / 2 - 0.005, y, -0.1, 0.14, 0.14, -Math.PI / 2); }
  engawa(g, w, d, y0);
  acUnit(g, -w / 2 - 0.05, y0 + 0.2, -0.2, -Math.PI / 2); pipe(g, w / 2 + 0.02, y0, y0 + H - 0.05, -d / 2 + 0.05);
  pots(g, 0.3, 0.44, 2); g.push(box(0.9, 0.12, 0.08, PAL.bush, 0, 0.18, -0.43)); yardProps(g, LG, sub(u.seed, 7), w, d);
  if (sub(u.seed, 4) > 0.5) bicycle(g, -0.42, 0.28, 0.15, K.bike[Math.floor(u.seed * 5) % 5]);
}
/** a modern box: render with a darker volume, flat parapet roof, big corner window, balcony on the side the seed picks */
function genModern(b, u, g, wg) {
  const L = b.level, { w, d, H } = dims('res', L), y0 = 0.12, side = sub(u.seed, 2) > 0.5 ? 1 : -1, dark = sub(u.seed, 3) > 0.5 ? PAL.cream2 : PAL.concrete2, trim = b.roof;   // a second light volume; the block's roof colour as the accent
  u.door = { x: -side * 0.2, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  g.push(box(w * 0.42, H + 0.04, d + 0.04, dark, side * w * 0.29, y0 + (H + 0.04) / 2, 0));   // the darker volume
  g.push(box(w + 0.06, 0.05, d + 0.06, trim, 0, y0 + H + 0.025, 0)); g.push(box(w + 0.08, 0.06, 0.03, trim, 0, y0 + H + 0.06, d / 2 + 0.03));   // flat roof and parapet lip in the block's roof colour
  door(g, -side * 0.2, y0, d / 2 + 0.005, 0.16, 0.3, PAL.wood, null); boxCanopy(g, -side * 0.2, y0 + 0.36, d / 2 + 0.01, 0.3, trim, 0.16); genkan(g, -side * 0.2, y0, d / 2 + 0.02, 0.2);
  windowPane(g, wg, side * 0.17, y0 + 0.3, d / 2 + 0.005, 0.24, 0.3);                                     // tall ground-floor window
  wg.push(box(0.03, 0.3, 0.2, PAL.window, side * (w / 2 + 0.005), y0 + 0.3, 0.2)); g.push(box(0.02, 0.34, 0.24, K.frame, side * (w / 2 + 0.005), y0 + 0.3, 0.2));   // wraps the corner
  for (let f = 1; f < L; f++) {
    const y = y0 + floorY(f) + 0.2;
    windowPane(g, wg, -side * 0.12, y, d / 2 + 0.005, 0.44, 0.2);
    balcony(g, side * 0.2, y0 + floorY(f) + 0.02, d / 2 + 0.08, 0.34, 0.16, K.rail); if (sub(u.seed, 6) > 0.4) laundry(LG, side * 0.2, y0 + floorY(f) + 0.02, d / 2 + 0.16, 0.34, sub(u.seed, f));
  }
  for (let f = 0; f < L; f++) { const y = y0 + floorY(f) + (f === 0 ? 0.3 : 0.2); windowPane(g, wg, 0.1, y, -d / 2 - 0.005, 0.3, 0.16, Math.PI); windowPane(g, wg, -side * (w / 2 + 0.005), y, -0.1, 0.16, 0.16, side > 0 ? -Math.PI / 2 : Math.PI / 2); }
  acUnit(g, -side * (w / 2 + 0.05), y0 + 0.2, -0.2, -side * Math.PI / 2); pipe(g, side * (w / 2 + 0.02), y0, y0 + H, -d / 2 + 0.06);
  if (sub(u.seed, 5) > 0.5) dish(g, -side * 0.2, y0 + H + 0.08, -0.2, 0.4);
  fence(g, 0, 0.45, 0.9, true, K.metal2, 0.09); fence(g, side * 0.45, 0, 0.8, false, K.metal2, 0.09);
  g.push(box(0.9, 0.1, 0.08, PAL.bush2, 0, 0.17, -0.43)); pots(g, side * 0.28, 0.4, 2); yardProps(g, LG, sub(u.seed, 8), w, d);
  if (sub(u.seed, 4) > 0.5) bicycle(g, -side * 0.4, 0.3, 0.1, K.bike[Math.floor(u.seed * 5) % 5]);
}
/** a hillside villa: a wide single storey under a hip-and-gable kawara roof, a deep engawa facing the view, a walled garden with a stone lantern and a pruned pine */
function genVilla(b, u, g, wg) {
  const w = 0.8, d = 0.56, H = 0.5, y0 = 0.12, tile = sub(u.seed, 2) > 0.5 ? PAL.kawara : PAL.kawara2;
  u.door = { x: 0.1, z: d / 2 + 0.02 };
  g.push(box(w, H, d, PAL.cream2, 0, y0 + H / 2, -0.06));
  slatWall(g, w, d, y0 + H - 0.16, y0 + H - 0.04, 'z', PAL.wood, 0.05);
  for (const s of [-1, 1]) g.push(box(0.03, H, 0.03, PAL.wood2, s * (w / 2 - 0.01), y0 + H / 2, d / 2 - 0.07));
  kawaraRoof(g, w, d + 0.1, H, y0, tile, true);
  engawa(g, w + 0.1, d - 0.12, y0, PAL.wood); for (const s of [-1, 1]) g.push(box(0.03, 0.42, 0.03, PAL.wood2, s * 0.36, y0 + 0.21, d / 2 + 0.08));   // veranda posts
  door(g, 0.1, y0, d / 2 - 0.055, 0.2, 0.32, PAL.wood2); latticeWindow(g, wg, -0.2, y0 + 0.27, d / 2 - 0.055, 0.34, 0.22, 0, PAL.wood);
  latticeWindow(g, wg, w / 2 + 0.005, y0 + 0.27, -0.1, 0.24, 0.2, Math.PI / 2, PAL.wood); windowPane(g, wg, 0, y0 + 0.28, -d / 2 - 0.065, 0.3, 0.18, Math.PI);
  // garden: block wall with a gate, stone lantern, pruned pine, raked gravel, a stepping-stone path
  blockWall(g, 0, 0.46, 0.96, true, [0.0, 0.24], PAL.concrete2, 0.13); blockWall(g, -0.47, 0, 0.9, false, null, PAL.concrete2, 0.13); blockWall(g, 0.47, -0.1, 0.7, false, null, PAL.concrete2, 0.13);
  g.push(box(0.4, 0.008, 0.16, PAL.cream, 0.24, y0 + 0.004, 0.38)); for (let q = 0; q < 3; q++) g.push(box(0.09, 0.012, 0.07, PAL.concrete2, 0.12 + q * 0.0, y0 + 0.006, 0.4 - q * 0.05));
  g.push(cyl(0.03, 0.035, 0.12, PAL.concrete, -0.36, y0 + 0.06, 0.34, 6)); g.push(box(0.1, 0.07, 0.1, PAL.concrete, -0.36, y0 + 0.16, 0.34)); g.push(box(0.13, 0.025, 0.13, PAL.concrete, -0.36, y0 + 0.21, 0.34));   // stone lantern
  const trunk = new THREE.CylinderGeometry(0.025, 0.035, 0.3, 5); trunk.rotateZ(0.3); trunk.translate(0.38, y0 + 0.16, 0.3); g.push(colorize(trunk, PAL.wood2));
  g.push(blob(0.14, '#7f9b7a', 0.32, y0 + 0.34, 0.3, 0, 0.35)); g.push(blob(0.1, '#6f8f6a', 0.42, y0 + 0.44, 0.26, 0, 0.35));   // pruned pine
  pots(g, -0.1, 0.42, 2); acUnit(g, -w / 2 - 0.05, y0 + 0.2, -0.2, -Math.PI / 2); pipe(g, w / 2 + 0.02, y0, y0 + H - 0.05, -d / 2 - 0.02);
}
/** a pair (or row) of terrace houses sharing walls: each unit is one house, the bodies fill the cell so they touch; doors alternate */
function genTerrace(b, u, g, wg) {
  const L = b.level, k = Math.max(0, b.units.indexOf(u)), fh = 0.5, floors = L === 3 ? 3 : 2, w = 0.98, d = 0.6, H = fh * floors + 0.06, y0 = 0.12, dx = k % 2 ? 0.22 : -0.22;
  const roofC = b.roofStyle === 'kawara' ? (sub(u.seed, 2) > 0.5 ? PAL.kawara : PAL.kawara2) : b.roof;
  u.door = { x: dx, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  g.push(box(0.02, H + 0.02, d + 0.02, K.frame, 0, y0 + H / 2, 0));                                        // the party-wall line
  if (b.roofStyle === 'metal') { g.push(prism(w + 0.02, 0.26, d + 0.2, K.metal, 0, y0 + H - 0.01, 0)); g.push(box(w + 0.02, 0.04, d + 0.24, K.metal2, 0, y0 + H, 0)); }
  else { g.push(prism(w + 0.02, 0.3, d + 0.2, roofC, 0, y0 + H - 0.01, 0)); g.push(box(w + 0.02, 0.05, d + 0.24, roofC, 0, y0 + H, 0)); g.push(box(w + 0.02, 0.04, 0.07, roofC === b.roof ? PAL.cream2 : PAL.kawara2, 0, y0 + H + 0.29, 0)); }
  door(g, dx, y0, d / 2 + 0.005, 0.15, 0.28, k % 2 ? PAL.wood2 : PAL.wood, roofC); genkan(g, dx, y0, d / 2 + 0.02, 0.18);
  windowPane(g, wg, -dx, y0 + 0.3, d / 2 + 0.005, 0.24, 0.18);
  for (let f = 1; f < floors; f++) { const y = y0 + f * fh + 0.28; windowPane(g, wg, -dx, y, d / 2 + 0.005, 0.22, 0.18); windowPane(g, wg, dx, y, d / 2 + 0.005, 0.16, 0.16); }
  balcony(g, -dx, y0 + fh + 0.04, d / 2 + 0.07, 0.36, 0.14, PAL.wood2); if (sub(u.seed, 3) > 0.35) laundry(LG, -dx, y0 + fh + 0.04, d / 2 + 0.14, 0.36, u.seed);
  for (let f = 0; f < floors; f++) { const y = y0 + f * fh + 0.3; windowPane(g, wg, dx, y, -d / 2 - 0.005, 0.18, 0.14, Math.PI); }
  acUnit(g, dx * 0.9, y0 + H - 0.2, -d / 2 - 0.05, Math.PI); pipe(g, dx > 0 ? w / 2 - 0.03 : -w / 2 + 0.03, y0, y0 + H, -d / 2 - 0.02);
  blockWall(g, 0, 0.46, 0.96, true, [dx - 0.13, dx + 0.13], K.concrete2, 0.11);
  pots(g, -dx, 0.4, 2); g.push(box(0.98, 0.1, 0.06, PAL.bush, 0, 0.17, -0.44));
  if (sub(u.seed, 4) > 0.5) bicycle(g, -dx * 1.6, 0.34, 0.15, K.bike[Math.floor(u.seed * 5) % 5]);
}
/** manshon: a three-storey apartment building across the whole block; the middle unit carries the lobby, the end units the stair core and bike shelter */
function genManshon(b, u, g, wg) {
  const L = b.level, k = Math.max(0, b.units.indexOf(u)), n = b.units.length, fh = 0.5, floors = 3 + (L >= 2 ? 1 : 0), w = 0.98, d = 0.7, H = fh * floors + 0.08, y0 = 0.12;
  const mid = n >= 3 ? k === 1 : k === 0, endL = k === 0, endR = k === n - 1;
  u.door = { x: 0, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  g.push(box(w, 0.14, d + 0.06, PAL.concrete, 0, y0 + 0.07, 0));                                             // plinth band
  g.push(box(w, 0.06, d + 0.06, PAL.concrete, 0, y0 + H + 0.03, 0)); g.push(box(w, 0.08, 0.04, b.roof, 0, y0 + H + 0.08, d / 2 + 0.02)); g.push(box(w, 0.08, 0.04, b.roof, 0, y0 + H + 0.08, -d / 2 - 0.02));   // parapet in the block's roof colour
  if (mid) {   // lobby: double glass doors under a canopy, house number, post boxes
    wg.push(box(0.3, 0.34, 0.03, PAL.window, 0, y0 + 0.19, d / 2 + 0.015)); g.push(box(0.34, 0.38, 0.02, K.frame, 0, y0 + 0.19, d / 2 + 0.005)); g.push(box(0.012, 0.34, 0.035, K.frame, 0, y0 + 0.19, d / 2 + 0.02));
    boxCanopy(g, 0, y0 + 0.44, d / 2 + 0.01, 0.5, b.roof, 0.24);
    g.push(box(0.2, 0.14, 0.05, K.metal2, -0.32, y0 + 0.24, d / 2 + 0.03)); for (let q = 0; q < 6; q++) g.push(box(0.05, 0.03, 0.005, PAL.cream2, -0.37 + (q % 3) * 0.05, y0 + 0.27 - Math.floor(q / 3) * 0.05, d / 2 + 0.058));
    g.push(box(0.1, 0.06, 0.01, PAL.cream2, 0.3, y0 + 0.36, d / 2 + 0.01));
  } else {
    windowPane(g, wg, -0.2, y0 + 0.3, d / 2 + 0.005, 0.22, 0.2); windowPane(g, wg, 0.22, y0 + 0.3, d / 2 + 0.005, 0.22, 0.2);
    if (endL) bikeRack(g, -0.1, 0.44, 4, 0, u.seed);
  }
  for (let f = 1; f < floors; f++) {
    const y = y0 + f * fh + 0.26;
    for (const x of [-0.24, 0.24]) windowPane(g, wg, x, y, d / 2 + 0.005, 0.22, 0.22);
    g.push(box(0.14, 0.26, 0.02, PAL.window, 0, y - 0.02, d / 2 + 0.01));
    balcony(g, 0, y0 + f * fh + 0.04, d / 2 + 0.08, w - 0.04, 0.16);
    if (sub(u.seed, f) < 0.55) laundry(LG, -0.12, y0 + f * fh + 0.04, d / 2 + 0.16, 0.5, sub(u.seed, f + 3));
    acUnit(g, 0.36, y0 + f * fh + 0.12, d / 2 + 0.11, 0);
    for (const x of [-0.24, 0.24]) windowPane(g, wg, x, y, -d / 2 - 0.005, 0.18, 0.18, Math.PI);
  }
  if (endR) { extStairs(g, w / 2 - 0.1, d, Math.min(2, floors - 1), fh, y0); for (let f = 0; f < floors; f++) windowPane(g, wg, w / 2 + 0.005, y0 + f * fh + 0.3, -0.15, 0.12, 0.16, Math.PI / 2); }
  if (endL) { for (let f = 0; f < floors; f++) windowPane(g, wg, -w / 2 - 0.005, y0 + f * fh + 0.3, 0.1, 0.14, 0.16, -Math.PI / 2); g.push(cyl(0.08, 0.08, 0.16, K.metal2, -0.28, y0 + H + 0.14, -0.2, 8)); g.push(box(0.2, 0.04, 0.2, K.metal, -0.28, y0 + H + 0.05, -0.2)); }   // rooftop tank
  if (mid) g.push(box(0.16, 0.14, 0.16, PAL.concrete, 0.25, y0 + H + 0.13, -0.15));
  if (sub(u.seed, 5) > 0.5) dish(g, 0.3, y0 + H + 0.06, -0.05, 0.5);
  pipe(g, k % 2 ? w / 2 - 0.04 : -w / 2 + 0.04, y0, y0 + H, -d / 2 - 0.02);
  g.push(box(0.98, 0.1, 0.06, PAL.bush, 0, 0.17, -0.44)); if (!mid) pots(g, 0.3, 0.42, 2);
}
function genNarrowHouse(b, u, g, wg) {
  const L = b.level, floors = L === 3 ? 3 : 2, fh = 0.5, w = 0.46, d = 0.64, H = fh * floors + 0.06, y0 = 0.12;
  u.door = { x: -0.1, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  for (let k = 0; k < floors * 4; k++) g.push(box(0.012, 0.012, d + 0.01, K.siding, -w / 2 - 0.005, y0 + 0.08 + k * 0.12, 0));
  g.push(box(w + 0.06, 0.05, d + 0.06, K.metal, 0, y0 + H + 0.02, 0)); g.push(box(w + 0.08, 0.06, 0.04, K.metal2, 0, y0 + H + 0.06, d / 2 + 0.02)); g.push(box(0.04, 0.06, d + 0.08, K.metal2, w / 2 + 0.02, y0 + H + 0.06, 0)); g.push(box(0.04, 0.06, d + 0.08, K.metal2, -w / 2 - 0.02, y0 + H + 0.06, 0));
  g.push(cyl(0.05, 0.05, 0.12, PAL.concrete, -0.1, y0 + H + 0.1, -0.15, 8));
  door(g, -0.1, y0, d / 2 + 0.005, 0.14, 0.27, u.seed > 0.5 ? PAL.wood2 : K.rail, K.metal);
  windowPane(g, wg, 0.12, y0 + 0.3, d / 2 + 0.005, 0.12, 0.16);
  for (let f = 1; f < floors; f++) {
    const y = y0 + f * fh + 0.28;
    windowPane(g, wg, -0.08, y, d / 2 + 0.005, 0.22, 0.2); windowPane(g, wg, w / 2 + 0.005, y, -0.1, 0.14, 0.16, Math.PI / 2);
    if (f === 1) { balcony(g, 0, y0 + fh + 0.04, d / 2 + 0.07, 0.4, 0.14); if (u.seed > 0.4) laundry(LG, 0, y0 + fh + 0.04, d / 2 + 0.14, 0.4, u.seed); }
    acUnit(g, w / 2 + 0.05, y - 0.02, 0.15, Math.PI / 2);
  }
  if (L >= 2) extStairs(g, w / 2, d, 1, fh, y0);
  if (sub(u.seed, 5) > 0.5) dish(g, -w / 2 - 0.03, y0 + H - 0.14, -0.1, -Math.PI / 2);
  if (sub(u.seed, 6) > 0.5) corrugated(g, w, d, y0 + 0.08, y0 + H - 0.1, K.metal2);   // some narrow houses are clad in corrugated metal
  for (let f = 0; f < floors; f++) { const y = y0 + f * fh + 0.3; windowPane(g, wg, 0.05, y, -d / 2 - 0.005, 0.16, 0.14, Math.PI); if (f > 0) windowPane(g, wg, -w / 2 - 0.005, y, 0.05, 0.12, 0.14, -Math.PI / 2); }
  pipe(g, -w / 2 - 0.02, y0, y0 + H, 0.2);
  pots(g, 0.16, 0.42, 3); g.push(box(0.08, 0.12, 0.7, PAL.bush, -0.43, 0.18, -0.05));
  blockWall(g, 0.14, 0.46, 0.56, true, [-0.2, -0.02], K.concrete2, 0.12); genkan(g, -0.1, y0, d / 2 + 0.02, 0.18);
  bicycle(g, -0.36, 0.34, 0.2, K.bike[Math.floor(u.seed * 5) % 5]);
}
function genApartment(b, u, g, wg) {
  const L = b.level, floors = L + 1, fh = 0.5, w = 0.84, d = 0.6, H = fh * floors + 0.06, y0 = 0.12;
  u.door = { x: 0, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  g.push(box(w + 0.04, 0.12, d + 0.04, PAL.concrete, 0, y0 + 0.06, 0));
  g.push(box(w + 0.05, 0.05, d + 0.05, PAL.concrete, 0, y0 + H + 0.02, 0)); g.push(box(w + 0.07, 0.07, 0.03, PAL.concrete, 0, y0 + H + 0.06, d / 2 + 0.02));
  g.push(box(0.16, 0.14, 0.16, PAL.concrete, -0.25, y0 + H + 0.12, -0.12)); g.push(cyl(0.06, 0.06, 0.16, K.metal2, 0.28, y0 + H + 0.12, -0.15, 8));
  door(g, 0, y0, d / 2 + 0.005, 0.18, 0.3, K.rail, PAL.concrete);
  g.push(box(0.14, 0.12, 0.06, K.metal2, -0.3, y0 + 0.22, d / 2 + 0.03)); for (let k = 0; k < 4; k++) g.push(box(0.05, 0.03, 0.005, PAL.cream2, -0.33 + (k % 2) * 0.06, y0 + 0.25 - Math.floor(k / 2) * 0.05, d / 2 + 0.062));
  windowPane(g, wg, 0.25, y0 + 0.3, d / 2 + 0.005, 0.16, 0.16);
  for (let f = 1; f < floors; f++) {
    const y = y0 + f * fh + 0.28;
    for (const x of [-0.22, 0.22]) { windowPane(g, wg, x, y, d / 2 + 0.005, 0.2, 0.22); }
    g.push(box(0.14, 0.24, 0.02, PAL.window, 0, y - 0.02, d / 2 + 0.01));
    balcony(g, 0, y0 + f * fh + 0.05, d / 2 + 0.08, w - 0.06, 0.16);
    if ((u.seed * 7 + f * 1.3) % 1 < 0.6) laundry(LG, -0.1, y0 + f * fh + 0.05, d / 2 + 0.16, 0.5, (u.seed + f * 0.37) % 1);
    acUnit(g, 0.3, y0 + f * fh + 0.12, d / 2 + 0.11, 0);
    windowPane(g, wg, w / 2 + 0.005, y, -0.12, 0.16, 0.18, Math.PI / 2);
  }
  extStairs(g, w / 2, d, Math.min(2, floors - 1), fh, y0);
  if (sub(u.seed, 5) > 0.4) for (let k = 0; k < 2; k++) dish(g, -w / 2 - 0.03, y0 + fh * (k + 1) + 0.2, -0.16 + k * 0.1, -Math.PI / 2);   // dishes on the stair side
  for (let f = 0; f < floors; f++) { const y = y0 + f * fh + 0.3; for (const x of [-0.24, 0.24]) windowPane(g, wg, x, y, -d / 2 - 0.005, 0.16, 0.16, Math.PI); windowPane(g, wg, -w / 2 - 0.005, y, 0.1, 0.14, 0.16, -Math.PI / 2); }
  pipe(g, -w / 2 - 0.02, y0, y0 + H, -0.1);
  bikeRack(g, -0.3, 0.42, 3, 0, u.seed);
  g.push(box(0.9, 0.1, 0.06, PAL.bush, 0, 0.17, -0.44)); pots(g, 0.34, 0.42, 2);
}

// ── shops ──
const OWN_FRONTS = new Set(['bakery', 'florist', 'books', 'ramen']);   // kinds that draw their whole storefront, so each reads from across the street
function genShop(b, u, g, wg) {
  if (b.kind === 'supermarket') return genSupermarket(b, u, g, wg);
  if (b.kind === 'arcade') return genArcade(b, u, g, wg);
  if (b.kind === 'teahouse') return genTeahouse(b, u, g, wg);
  if (b.kind === 'ryokan') return genRyokan(b, u, g, wg);
  const L = b.level, { w, d, H } = dims('shop', L), y0 = 0.12, [a1, a2] = b.awning, kind = b.kind || 'cafe';
  const doorX = kind === 'konbini' ? 0.22 : kind === 'grocery' ? -0.2 : kind === 'books' ? 0 : -0.24, own = OWN_FRONTS.has(kind);   // own: a kind with a storefront of its own
  const wall = kind === 'bakery' ? (sub(u.seed, 9) > 0.5 ? '#f2e1c2' : PAL.cream2) : kind === 'florist' ? (sub(u.seed, 9) > 0.5 ? '#eef0e2' : PAL.mint) : b.wall;
  u.door = { x: doorX, z: d / 2 + 0.02 };
  if (kind === 'florist') {   // the ground floor set back 0.12 under the storey above, the side walls carried forward
    g.push(box(w, 0.5, d - 0.12, wall, 0, y0 + 0.25, -0.06)); g.push(box(w, H - 0.5, d, wall, 0, y0 + 0.5 + (H - 0.5) / 2, 0));
    for (const s of [-1, 1]) g.push(box(0.05, 0.5, 0.12, wall, s * (w / 2 - 0.025), y0 + 0.25, d / 2 - 0.06));
  } else g.push(box(w, H, d, wall, 0, y0 + H / 2, 0));
  const finish = u.finish = sub(u.seed, 2) < 0.34 ? 'timber' : sub(u.seed, 2) < 0.67 ? 'tile' : 'render', awnShape = b.popular ? 0.5 : sub(u.seed, 3);   // a busy shop has put up a new striped awning
  if (b.popular) { const sx = doorX > 0 ? -0.3 : 0.3; for (let q = 0; q < 3; q++) g.push(box(0.14, 0.09, 0.12, q === 2 ? PAL.wood : K.frame, sx + (q === 2 ? 0 : (q - 0.5) * 0.15), y0 + 0.045 + (q === 2 ? 0.09 : 0), d / 2 + 0.14)); for (let q = 0; q < 4; q++) g.push(blob(0.03, [PAL.roofPeach, K.red, PAL.treeGreen, PAL.cream2][q], sx - 0.05 + q * 0.035, y0 + 0.16, d / 2 + 0.14, 0, 0.9)); }   // and stock in crates by the door
  if (b.popular) for (const x of [-0.44, 0.44]) { g.push(cyl(0.012, 0.012, 0.6, K.metal2, x, y0 + 0.3, 0.46, 5)); g.push(box(0.09, 0.42, 0.012, x < 0 ? a1 : K.red, x + (x < 0 ? 0.05 : -0.05), y0 + 0.4, 0.46)); g.push(box(0.11, 0.012, 0.012, K.metal2, x + (x < 0 ? 0.05 : -0.05), y0 + 0.6, 0.46)); for (let q = 0; q < 3; q++) g.push(box(0.045, 0.045, 0.006, PAL.cream2, x + (x < 0 ? 0.05 : -0.05), y0 + 0.52 - q * 0.1, 0.467)); }   // nobori banners: a busy shop
  if (own) { /* the four storefronts below bring their own */ } else if (finish === 'timber') slatWall(g, w, d, y0 + 0.08, y0 + H - 0.06, sub(u.seed, 4) > 0.5 ? 'x' : '-x', PAL.wood, 0.085);
  else if (finish === 'tile') tileBand(g, w, d, y0, 0.22, b.roof);
  const awn = (x, y, z, ww, c1, c2) => awnShape < 0.35 ? plainAwning(g, x, y, z, ww, c1) : awnShape < 0.7 ? stripedAwning(g, x, y, z, ww, c1, c2) : boxCanopy(g, x, y, z, ww, c1);   // cloth, striped cloth or a box canopy
  // three silhouettes by the block's roof style, so a shop street is not a row of identical boxes
  if (b.roofStyle === 'kawara') {   // a tiled gable, machiya-style, with a lattice band under the eaves
    kawaraRoof(g, w, d, H, y0, u.seed > 0.5 ? PAL.kawara : PAL.kawara2, false);
    for (let k = 0; k < 7; k++) g.push(box(0.02, 0.1, 0.02, PAL.wood2, -0.3 + k * 0.1, y0 + H - 0.08, d / 2 + 0.01));
  } else if (b.roofStyle === 'metal') {   // a mono-pitch metal roof rising to the back, with a tall fascia over the front
    const slope = new THREE.BoxGeometry(w + 0.12, 0.04, d + 0.16); slope.rotateX(-0.22); slope.translate(0, y0 + H + 0.1, -0.02); g.push(colorize(slope, K.metal));
    g.push(box(w + 0.14, 0.22, 0.05, b.roof, 0, y0 + H + 0.06, d / 2 + 0.03)); g.push(box(w + 0.14, 0.03, 0.06, PAL.cream2, 0, y0 + H + 0.18, d / 2 + 0.035));
    for (let k = 0; k < 6; k++) g.push(box(0.012, 0.012, d + 0.14, K.metal2, -w / 2 + 0.05 + k * ((w - 0.1) / 5), y0 + H + 0.13, -0.02));
  } else {   // the flat roof with a parapet
    g.push(box(w + 0.1, 0.09, d + 0.1, b.roof, 0, y0 + H + 0.04, 0)); g.push(box(w + 0.14, 0.04, d + 0.14, b.roof, 0, y0 + H + 0.1, 0));
  }
  if (b.roofStyle !== 'kawara') acUnit(g, -0.2, y0 + H + 0.14, -0.15, 0); pipe(g, -w / 2 - 0.02, y0, y0 + H, -d / 2 + 0.06);
  if (kind === 'konbini') {
    wg.push(box(0.62, 0.36, 0.03, PAL.window, -0.1, y0 + 0.31, d / 2 + 0.015)); g.push(box(0.66, 0.4, 0.02, K.frame, -0.1, y0 + 0.31, d / 2 + 0.005));
    for (const x of [-0.3, -0.1, 0.1]) g.push(box(0.02, 0.36, 0.035, K.mullion, x, y0 + 0.31, d / 2 + 0.02));
    wg.push(box(0.18, 0.32, 0.03, PAL.window, doorX, y0 + 0.28, d / 2 + 0.015)); g.push(box(0.22, 0.36, 0.02, K.frame, doorX, y0 + 0.28, d / 2 + 0.005));
    g.push(box(w + 0.02, 0.14, 0.04, PAL.cream2, 0, y0 + 0.62, d / 2 + 0.03)); g.push(box(w + 0.02, 0.04, 0.045, PAL.roofTeal, 0, y0 + 0.66, d / 2 + 0.032)); g.push(box(w + 0.02, 0.04, 0.045, PAL.roofPeach, 0, y0 + 0.58, d / 2 + 0.032));
    wg.push(box(w * 0.86, 0.1, 0.02, PAL.window, 0, y0 + 0.62, d / 2 + 0.052));   // the whole fascia lights up after dark
    tateKanban(g, wg, w / 2 + 0.07, y0 + 0.5, d / 2 + 0.06, PAL.cream2, PAL.roofTeal, true, 0.4);
    g.push(box(0.16, 0.22, 0.14, PAL.cream2, w / 2 + 0.1, y0 + 0.11, 0.1)); g.push(box(0.16, 0.02, 0.14, PAL.roofBlue, w / 2 + 0.1, y0 + 0.23, 0.1));
    bikeRack(g, -0.28, 0.44, 3, 0, u.seed);
  } else {
    if (!own) { windowPane(g, wg, 0.1, y0 + 0.31, d / 2 + 0.005, 0.4, 0.3); door(g, doorX, y0, d / 2 + 0.005, 0.16, 0.34, PAL.wood); }
    if (kind === 'ramen') {   // a ramen-ya: dark timber front under a tiled hisashi, a red noren over the sliding door, big red lanterns, a ticket machine, an exhaust stack
      const dark = '#6b4a38';
      for (let t = -w / 2 + 0.03; t < w / 2 - 0.02; t += 0.05) g.push(box(0.024, 0.5, 0.014, dark, t, y0 + 0.25, d / 2 + 0.008));
      latticeWindow(g, wg, 0.1, y0 + 0.3, d / 2 + 0.016, 0.3, 0.18, 0, '#4a3a30');
      g.push(box(0.36, 0.025, 0.08, PAL.wood2, 0.1, y0 + 0.2, d / 2 + 0.05));   // the counter's sill under the window
      door(g, doorX, y0, d / 2 + 0.016, 0.18, 0.36, '#4a3a30'); wg.push(box(0.12, 0.2, 0.012, PAL.window, doorX, y0 + 0.2, d / 2 + 0.04));
      hisashi(g, w, d, y0 + 0.5, PAL.kawara2);
      noren(g, doorX, y0 + 0.4, d / 2 + 0.05, 0.22, K.red, PAL.cream2);
      for (const x of [-0.03, 0.31]) {   // two big red lanterns hung from the eave
        g.push(box(0.006, 0.06, 0.006, '#3a302a', x, y0 + 0.44, d / 2 + 0.13)); g.push(cyl(0.035, 0.035, 0.015, '#3a302a', x, y0 + 0.41, d / 2 + 0.13, 8));
        g.push(cyl(0.055, 0.055, 0.11, K.red, x, y0 + 0.345, d / 2 + 0.13, 10)); wg.push(cyl(0.057, 0.057, 0.035, PAL.window, x, y0 + 0.345, d / 2 + 0.13, 10)); g.push(cyl(0.035, 0.035, 0.015, '#3a302a', x, y0 + 0.285, d / 2 + 0.13, 8));
      }
      g.push(box(0.1, 0.22, 0.08, '#e9e4d8', 0.34, y0 + 0.11, d / 2 + 0.07)); wg.push(box(0.07, 0.07, 0.01, PAL.window, 0.34, y0 + 0.17, d / 2 + 0.112));   // the ticket machine
      for (let k = 0; k < 3; k++) g.push(box(0.018, 0.018, 0.01, [K.red, PAL.roofBlue, PAL.roofSage][k], 0.315 + k * 0.025, y0 + 0.11, d / 2 + 0.112));
      g.push(box(0.2, 0.02, 0.07, PAL.wood2, 0.05, y0 + 0.11, d / 2 + 0.12)); for (const x of [-0.03, 0.13]) g.push(box(0.02, 0.1, 0.05, PAL.wood2, x, y0 + 0.05, d / 2 + 0.12));   // a bench for the queue
      g.push(box(w * 0.74, 0.1, 0.03, K.red, 0, y0 + 0.58, d / 2 + 0.02)); for (let k = 0; k < 3; k++) g.push(box(0.07, 0.06, 0.01, PAL.cream2, -0.1 + k * 0.1, y0 + 0.58, d / 2 + 0.037));
      wg.push(box(w * 0.6, 0.02, 0.012, PAL.window, 0, y0 + 0.52, d / 2 + 0.036));
      g.push(box(0.07, H + 0.2, 0.07, K.metal2, w / 2 + 0.035, y0 + 0.2 + (H + 0.2) / 2, -0.24)); g.push(box(0.13, 0.03, 0.13, K.metal, w / 2 + 0.035, y0 + H + 0.42, -0.24));   // the kitchen's exhaust stack
      for (let k = 0; k < 3; k++) g.push(blob(0.045 + k * 0.012, '#f4f1ea', w / 2 + 0.035 - k * 0.03, y0 + H + 0.5 + k * 0.08, -0.24 + k * 0.02, 0, 0.7));   // and its steam
      tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.55, d / 2 + 0.06, K.red, PAL.cream2, true);
    } else if (kind === 'grocery') {
      awn(0, y0 + 0.55, d / 2 + 0.02, w, PAL.roofSage, PAL.cream2);
      for (let k = 0; k < 3; k++) { const x = 0.06 + k * 0.15; g.push(box(0.13, 0.08, 0.12, PAL.wood, x, y0 + 0.04, 0.42)); for (let m = 0; m < 3; m++) g.push(blob(0.03, [PAL.roofPeach, '#8fae78', K.red][(k + m) % 3], x - 0.04 + m * 0.04, y0 + 0.1, 0.42 + (m % 2) * 0.03, 0, 1)); }
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.44, PAL.cream2, PAL.roofSage); tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.55, d / 2 + 0.06, PAL.roofSage, PAL.cream2, false, 0.36);
    } else if (kind === 'florist') {   // a hanaya: the ground floor set back under a deep green awning, tiers of buckets spilling out, hanging baskets, a vine up the corner
      const green = '#6f8f5e', blooms = [PAL.flower, PAL.roofPeach, PAL.lilac, '#f2d27a', PAL.pink, '#e98f86', PAL.cream2], z0 = d / 2 - 0.12, f = Math.floor(u.seed * 7);
      windowPane(g, wg, 0.1, y0 + 0.3, z0 + 0.005, 0.4, 0.28); door(g, doorX, y0, z0 + 0.005, 0.16, 0.34, green);
      for (let t = 0; t < 3; t++) {   // a stepped stand of buckets, tallest at the back
        const z = z0 + 0.05 + t * 0.065, h = 0.17 - t * 0.055; g.push(box(0.46, h, 0.06, PAL.wood, 0.1, y0 + h / 2, z));
        for (let k = 0; k < 5; k++) { const x = -0.08 + k * 0.09; g.push(cyl(0.025, 0.02, 0.05, K.metal2, x, y0 + h + 0.025, z, 6)); g.push(blob(0.036, blooms[(k + t * 2 + f) % blooms.length], x, y0 + h + 0.07, z, 0, 0.85)); }
      }
      for (let k = 0; k < 3; k++) { const x = 0.3 + (k % 2) * 0.1, z = 0.43 + (k === 2 ? 0.04 : 0); g.push(cyl(0.035, 0.03, 0.08, K.metal2, x - (k === 2 ? 0.05 : 0), y0 + 0.04, z, 7)); g.push(blob(0.05, blooms[(k * 3 + f + 1) % blooms.length], x - (k === 2 ? 0.05 : 0), y0 + 0.12, z, 0, 0.9)); }
      const aw = new THREE.BoxGeometry(w + 0.06, 0.025, 0.26); aw.rotateX(0.26); aw.translate(0, y0 + 0.5, d / 2 + 0.09); g.push(colorize(aw, green));
      g.push(box(w + 0.06, 0.05, 0.012, PAL.cream2, 0, y0 + 0.44, d / 2 + 0.22));   // the awning's valance
      for (const x of [-0.05, 0.25]) { g.push(box(0.004, 0.07, 0.004, K.rail, x, y0 + 0.41, d / 2 + 0.12)); g.push(blob(0.045, PAL.bush2, x, y0 + 0.36, d / 2 + 0.12, 0, 0.8)); g.push(blob(0.022, blooms[(f + (x > 0 ? 2 : 4)) % blooms.length], x + 0.025, y0 + 0.345, d / 2 + 0.15, 0, 1)); }
      for (let k = 0; k < Math.floor((H - 0.1) / 0.1); k++) g.push(blob(0.05, k % 2 ? PAL.bush : PAL.bush2, -w / 2 - 0.005, y0 + 0.08 + k * 0.1, d / 2 - 0.03 - (k % 3) * 0.04, 0, 0.9));   // a vine up the corner
      g.push(box(0.38, 0.08, 0.03, PAL.cream2, 0.06, y0 + 0.575, d / 2 + 0.02)); g.push(blob(0.035, PAL.pink, -0.08, y0 + 0.575, d / 2 + 0.04, 0, 0.8)); g.push(box(0.2, 0.03, 0.01, green, 0.08, y0 + 0.575, d / 2 + 0.037));
      if (L >= 2) for (const x of [-0.18, 0.18]) { g.push(box(0.2, 0.04, 0.05, PAL.wood, x, y0 + 0.8, d / 2 + 0.03)); for (let k = 0; k < 3; k++) g.push(blob(0.03, blooms[(k + f) % blooms.length], x - 0.06 + k * 0.06, y0 + 0.84, d / 2 + 0.03, 0, 0.9)); }
    } else if (kind === 'bakery') {   // a pan-ya: brick skirting, a bow window of loaves under a scalloped canopy, a glazed door, the oven's chimney
      const brick = '#b9765a', crust = ['#d9a066', '#c98a4e', '#e6b778'], bx = 0.1, bw = 0.42, stripe = sub(u.seed, 8) > 0.5 ? '#8a5a3c' : PAL.roofRose;
      g.push(box(w + 0.01, 0.13, 0.03, brick, 0, y0 + 0.065, d / 2 + 0.01));
      for (let k = 0; k < 2; k++) g.push(box(w + 0.012, 0.006, 0.032, '#a5654b', 0, y0 + 0.045 + k * 0.045, d / 2 + 0.011));
      g.push(box(bw + 0.08, 0.05, 0.15, PAL.wood2, bx, y0 + 0.155, d / 2 + 0.07));   // the bay's sill
      wg.push(box(bw, 0.24, 0.1, PAL.window, bx, y0 + 0.3, d / 2 + 0.05));
      g.push(box(bw + 0.05, 0.03, 0.13, PAL.wood2, bx, y0 + 0.435, d / 2 + 0.065)); for (const x of [-bw / 2, -bw / 6, bw / 6, bw / 2]) g.push(box(0.02, 0.24, 0.02, PAL.wood2, bx + x, y0 + 0.3, d / 2 + 0.1));
      for (let k = 0; k < 5; k++) g.push(blob(0.03, crust[k % 3], bx - 0.17 + k * 0.085, y0 + 0.2, d / 2 + 0.125, 0, 0.6));   // loaves on the sill
      for (let k = 0; k < 6; k++) { const s = new THREE.BoxGeometry((bw + 0.12) / 6, 0.02, 0.17); s.rotateX(0.35); s.translate(bx - (bw + 0.12) / 2 + (k + 0.5) * (bw + 0.12) / 6, y0 + 0.49, d / 2 + 0.1); g.push(colorize(s, k % 2 ? PAL.cream2 : stripe)); }
      for (let k = 0; k < 6; k++) { const c = new THREE.CylinderGeometry(0.035, 0.035, 0.01, 10, 1, false, 0, Math.PI); c.rotateX(Math.PI / 2); c.rotateZ(Math.PI); c.translate(bx - (bw + 0.12) / 2 + (k + 0.5) * (bw + 0.12) / 6, y0 + 0.455, d / 2 + 0.18); g.push(colorize(c, k % 2 ? PAL.cream2 : stripe)); }   // the scalloped edge
      door(g, doorX, y0, d / 2 + 0.005, 0.16, 0.34, PAL.wood2, stripe); wg.push(box(0.1, 0.16, 0.012, PAL.window, doorX, y0 + 0.24, d / 2 + 0.03));
      g.push(box(0.46, 0.1, 0.03, PAL.cream2, 0.02, y0 + 0.565, d / 2 + 0.02)); g.push(box(0.26, 0.035, 0.01, '#8a5a3c', 0.06, y0 + 0.565, d / 2 + 0.037));
      for (let k = 0; k < 3; k++) g.push(blob(0.022, crust[k], -0.16 + k * 0.022, y0 + 0.565 + (k === 1 ? 0.012 : 0), d / 2 + 0.04, 0, 0.7));   // a croissant on the sign
      g.push(box(0.11, 0.44, 0.11, brick, 0.28, y0 + H + 0.1, -0.2)); g.push(box(0.14, 0.03, 0.14, '#8a5a44', 0.28, y0 + H + 0.33, -0.2));   // the oven's chimney
      g.push(blob(0.04, '#f4f1ea', 0.28, y0 + H + 0.4, -0.2, 0, 0.7));
      addNeighbourhood(g, 'a-board', -0.42, y0, 0.43, 0.3, { scale: 0.8 });
    } else if (kind === 'books') {   // a honya: a painted shopfront with pilasters and a deep fascia, windows of spines either side of a centre door, book carts outside
      const paint = sub(u.seed, 8) > 0.5 ? '#4f6a64' : '#4e5d78', gold = '#e8c877', spines = [PAL.roofRose, PAL.roofBlue, PAL.roofSage, PAL.roofPeach, PAL.lilac, PAL.cream2, '#8a5a3c', PAL.indigo];
      for (const s of [-1, 1]) g.push(box(0.05, 0.5, 0.04, paint, s * (w / 2 - 0.025), y0 + 0.25, d / 2 + 0.02));
      g.push(box(w + 0.02, 0.1, 0.05, paint, 0, y0 + 0.54, d / 2 + 0.025)); g.push(box(0.4, 0.035, 0.01, gold, 0, y0 + 0.54, d / 2 + 0.052));
      g.push(box(w + 0.02, 0.05, 0.04, paint, 0, y0 + 0.025, d / 2 + 0.02));
      for (const s of [-1, 1]) {
        const x = s * 0.22; wg.push(box(0.24, 0.36, 0.02, PAL.window, x, y0 + 0.29, d / 2 + 0.01));
        for (let row = 0; row < 3; row++) {   // shelves of spines behind the glass
          const yy = y0 + 0.13 + row * 0.11; g.push(box(0.24, 0.012, 0.04, PAL.wood2, x, yy, d / 2 + 0.03));
          for (let t = -0.115, k = 0; t < 0.1; k++) { const bw = 0.016 + ((k * 7 + row * 3 + (s > 0 ? 5 : 0)) % 3) * 0.006, bh = 0.05 + ((k * 5 + row) % 3) * 0.012; g.push(box(bw, bh, 0.03, spines[(k + row * 3 + (s > 0 ? 4 : 0)) % spines.length], x + t + bw / 2, yy + 0.006 + bh / 2, d / 2 + 0.03)); t += bw + 0.004; }
        }
        g.push(box(0.015, 0.36, 0.03, paint, x, y0 + 0.29, d / 2 + 0.035));
      }
      door(g, 0, y0, d / 2 + 0.005, 0.16, 0.4, paint); wg.push(box(0.1, 0.2, 0.012, PAL.window, 0, y0 + 0.26, d / 2 + 0.03));
      for (const x of [-0.29, 0.29]) {   // bargain carts
        g.push(box(0.19, 0.06, 0.1, PAL.wood, x, y0 + 0.13, 0.44)); for (const sx of [-0.08, 0.08]) g.push(box(0.015, 0.1, 0.015, PAL.wood2, x + sx, y0 + 0.05, 0.44));
        for (let k = 0; k < 5; k++) g.push(box(0.032, 0.022, 0.075, spines[(k + (x > 0 ? 3 : 0)) % spines.length], x - 0.07 + k * 0.035, y0 + 0.171, 0.44));
      }
      tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.55, d / 2 + 0.06, paint, gold, false, 0.36);
    } else if (kind === 'restaurant') {   // a shokudō: plain awning, noren, a row of lanterns, a menu stand and a lit sign
      plainAwning(g, 0, y0 + 0.55, d / 2 + 0.02, w, a1);
      noren(g, doorX, y0 + 0.36, d / 2 + 0.03, 0.22, sub(u.seed, 4) > 0.5 ? PAL.indigo : K.red, PAL.cream2);
      chochin(g, wg, 0.14, y0 + 0.41, d / 2 + 0.27, 3, sub(u.seed, 5) > 0.5 ? K.lantern : PAL.cream2);
      addNeighbourhood(g, 'menu-stand', 0.36, y0, 0.41, 0.2, { scale: 0.85 });   // the kit's tilted menu stand
      for (const x of [0.06, 0.2]) g.push(cyl(0.04, 0.035, 0.12, PAL.wood2, x, y0 + 0.06, 0.4, 6));
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.5, a1, PAL.cream2, true); tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.55, d / 2 + 0.06, PAL.cream2, a1, true);
    } else {   // café
      awn(0, y0 + 0.55, d / 2 + 0.02, w, a1, a2);
      if (u.seed > 0.5) noren(g, doorX, y0 + 0.36, d / 2 + 0.03, 0.2, a1, PAL.cream2);        // a kissaten hangs a noren
      tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.55, d / 2 + 0.06, PAL.cream2, a1, false, 0.36);
      // a small pavement table with two stools, kept within the strip between the front wall (z 0.33) and the plinth edge (z 0.49)
      g.push(cyl(0.065, 0.065, 0.015, PAL.cream2, 0.3, y0 + 0.19, 0.41, 10)); g.push(cyl(0.012, 0.012, 0.19, K.metal, 0.3, y0 + 0.095, 0.41, 5)); g.push(cyl(0.045, 0.045, 0.012, K.metal, 0.3, y0 + 0.006, 0.41, 8));
      for (const sx of [0.17, 0.43]) { g.push(cyl(0.03, 0.03, 0.018, PAL.wood, sx, y0 + 0.12, 0.41, 8)); g.push(cyl(0.01, 0.01, 0.11, K.metal, sx, y0 + 0.055, 0.41, 5)); }
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.36, PAL.cream2, a1);
      addNeighbourhood(g, 'a-board', -0.4, y0, 0.41, 0.3, { scale: 0.85 });   // the kit's chalk A-board by the door
      pots(g, -0.42, 0.2, 2, false);
    }
  }
  if (L >= 2) {
    for (const x of [-0.18, 0.18]) windowPane(g, wg, x, y0 + 0.9, d / 2 + 0.005, 0.16, 0.16);
    const disc = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 12); disc.rotateZ(Math.PI / 2); disc.translate(w / 2 + 0.03, y0 + H - 0.25, 0.1); g.push(colorize(disc, kind === 'ramen' ? K.red : a1));
    const disc2 = new THREE.CylinderGeometry(0.1, 0.1, 0.035, 12); disc2.rotateZ(Math.PI / 2); disc2.translate(w / 2 + 0.035, y0 + H - 0.25, 0.1); g.push(colorize(disc2, PAL.cream2));
    g.push(box(0.03, 0.03, 0.2, PAL.lamp, w / 2 + 0.02, y0 + H - 0.1, 0.1));
    acUnit(g, w / 2 + 0.05, y0 + 0.85, -0.2, Math.PI / 2);
  }
  if (L >= 2) { g.push(cyl(0.07, 0.07, 0.14, K.metal2, -0.25, y0 + H + 0.2, -0.18, 8)); for (const [lx, lz] of [[-0.3, -0.23], [-0.2, -0.13]]) g.push(box(0.02, 0.1, 0.02, K.metal, lx, y0 + H + 0.08, lz)); }   // rooftop water tank
  if (L >= 3) { g.push(cyl(0.02, 0.02, 0.36, PAL.lamp, 0.18, y0 + H + 0.28, -0.1, 5)); g.push(cyl(0.001, 0.2, 0.09, a1, 0.18, y0 + H + 0.45, -0.1, 8)); g.push(box(0.16, 0.03, 0.16, PAL.wood, 0.18, y0 + H + 0.2, -0.1)); }
  if (u.seed > 0.55 && kind !== 'konbini' && kind !== 'ramen') { g.push(box(0.14, 0.32, 0.12, u.seed > 0.75 ? PAL.pink : PAL.mint, w / 2 + 0.09, y0 + 0.16, -0.12)); wg.push(box(0.09, 0.14, 0.02, PAL.window, w / 2 + 0.09, y0 + 0.22, -0.055)); }
  if (kind !== 'konbini' && kind !== 'ramen' && kind !== 'florist' && kind !== 'books' && sub(u.seed, 5) > 0.5) hangingSign(g, wg, w / 2 - 0.02, y0 + 0.5, d / 2 + 0.02, a1, PAL.cream2, sub(u.seed, 6) > 0.5);   // a round sign off the front corner
  if (L >= 2 && sub(u.seed, 7) > 0.5) for (const x of [-0.18, 0.18]) for (const s of [-1, 1]) g.push(box(0.05, 0.2, 0.015, K.shutter, x + s * 0.12, y0 + 0.9, d / 2 + 0.012));   // shutters beside the upstairs windows
  windowPane(g, wg, 0.1, y0 + 0.36, -d / 2 - 0.005, 0.2, 0.16, Math.PI); if (L >= 2) windowPane(g, wg, -0.15, y0 + 0.9, -d / 2 - 0.005, 0.16, 0.16, Math.PI);
  g.push(box(0.08, 0.12, 0.72, PAL.bush, -0.43, 0.18, -0.04));
}

/** a hillside tea house: kawara roof, a wide open front onto an engawa with cushions, a noren, a lantern and a kettle's steam of a sign */
function genTeahouse(b, u, g, wg) {
  const L = b.level, w = 0.78, d = 0.6, H = 0.56 + (L >= 2 ? 0.44 : 0), y0 = 0.12, [a1] = b.awning;
  u.door = { x: -0.14, z: d / 2 + 0.02 };
  g.push(box(w, H, d, PAL.cream, 0, y0 + H / 2, -0.04));
  for (const s of [-1, 1]) g.push(box(0.03, H, 0.03, PAL.wood2, s * (w / 2 - 0.01), y0 + H / 2, d / 2 - 0.05));
  kawaraRoof(g, w, d + 0.12, H, y0, sub(u.seed, 2) > 0.5 ? PAL.kawara : PAL.kawara2, L >= 2);
  hisashi(g, w, d - 0.08, y0 + 0.44, PAL.kawara2);
  engawa(g, w + 0.08, d - 0.1, y0, PAL.wood);
  for (let q = 0; q < 3; q++) g.push(box(0.1, 0.03, 0.1, [K.red, PAL.indigo, PAL.roofSage][q], -0.28 + q * 0.2, y0 + 0.055, d / 2 + 0.1));   // cushions on the veranda
  wg.push(box(0.5, 0.3, 0.02, PAL.window, 0.06, y0 + 0.24, d / 2 - 0.045)); for (let q = 0; q < 6; q++) g.push(box(0.012, 0.3, 0.012, PAL.wood, -0.19 + q * 0.1, y0 + 0.24, d / 2 - 0.035));   // shōji front
  noren(g, -0.14, y0 + 0.36, d / 2 - 0.02, 0.2, PAL.indigo, PAL.cream2);
  chochin(g, wg, 0.3, y0 + 0.36, d / 2 + 0.12, 1, PAL.cream2);
  tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.5, d / 2 + 0.02, PAL.cream2, a1, true, 0.36);
  if (L >= 2) { for (const x of [-0.2, 0.2]) latticeWindow(g, wg, x, y0 + 0.82, d / 2 - 0.045, 0.2, 0.16, 0, PAL.wood); }
  windowPane(g, wg, 0, y0 + 0.28, -d / 2 - 0.045, 0.3, 0.16, Math.PI);
  g.push(cyl(0.03, 0.035, 0.12, PAL.concrete, 0.4, y0 + 0.06, 0.4, 6)); g.push(box(0.1, 0.07, 0.1, PAL.concrete, 0.4, y0 + 0.16, 0.4)); g.push(box(0.13, 0.025, 0.13, PAL.concrete, 0.4, y0 + 0.21, 0.4));   // stone lantern by the path
  g.push(blob(0.12, PAL.bush2, -0.4, y0 + 0.08, 0.34, 0, 0.6)); pipe(g, w / 2 + 0.02, y0, y0 + H - 0.05, -d / 2 - 0.02);
}
/** the ryokan on the hill: plaster ground floor between dark posts, timber-clad upper floor with lattice windows behind a
 *  balcony rail, an eave between the floors, a hip-and-gable kawara roof; a deep noren and two lanterns at the door, a
 *  vertical sign, stepping stones, a stone lantern and a pruned pine in the front garden. Lit from dusk until late for its guests */
function genRyokan(b, u, g, wg) {
  const w = 0.86, d = 0.64, y0 = 0.12, F = 0.4, H = 2 * F + 0.05, [a1] = b.awning, post = '#5a4636';
  u.door = { x: 0, z: d / 2 + 0.02 };
  g.push(box(w, F, d, PAL.cream, 0, y0 + F / 2, -0.02));
  g.push(box(w - 0.04, F + 0.05, d - 0.04, PAL.wood2, 0, y0 + F + (F + 0.05) / 2, -0.02));
  for (const x of [-w / 2 + 0.015, -0.15, 0.15, w / 2 - 0.015]) g.push(box(0.03, F, 0.03, post, x, y0 + F / 2, d / 2 - 0.03));
  for (const x of [-w / 2 + 0.035, w / 2 - 0.035]) g.push(box(0.03, F + 0.05, 0.03, post, x, y0 + F + (F + 0.05) / 2, d / 2 - 0.05));
  hisashi(g, w, d - 0.04, y0 + F + 0.02, PAL.kawara2);
  kawaraRoof(g, w, d + 0.12, H, y0, PAL.kawara, true);
  for (const x of [-0.3, 0.3]) { wg.push(box(0.2, 0.2, 0.02, PAL.window, x, y0 + 0.2, d / 2 - 0.02)); for (let q = 0; q < 4; q++) g.push(box(0.01, 0.2, 0.012, PAL.wood, x - 0.075 + q * 0.05, y0 + 0.2, d / 2 - 0.008)); }   // shōji either side of the door
  noren(g, 0, y0 + 0.3, d / 2 - 0.005, 0.24, PAL.indigo, PAL.cream2);
  for (const x of [-0.19, 0.19]) chochin(g, wg, x, y0 + 0.33, d / 2 + 0.06, 1, PAL.cream2);
  for (const x of [-0.26, 0, 0.26]) latticeWindow(g, wg, x, y0 + F + 0.27, d / 2 - 0.045, 0.2, 0.18, 0, PAL.wood);
  g.push(box(w - 0.06, 0.02, 0.08, PAL.wood, 0, y0 + F + 0.1, d / 2 + 0.005)); g.push(box(w - 0.06, 0.015, 0.015, PAL.wood, 0, y0 + F + 0.2, d / 2 + 0.04));   // the balcony and its rail
  for (let q = 0; q < 8; q++) g.push(box(0.01, 0.1, 0.01, PAL.wood, -w / 2 + 0.07 + q * ((w - 0.14) / 7), y0 + F + 0.15, d / 2 + 0.04));
  for (const s of [-1, 1]) windowPane(g, wg, s * (w / 2 + 0.005), y0 + F + 0.27, -0.05, 0.16, 0.16, s * Math.PI / 2);
  windowPane(g, wg, 0, y0 + 0.22, -d / 2 - 0.025, 0.3, 0.16, Math.PI);
  tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.5, d / 2 + 0.02, PAL.cream2, a1, true, 0.42);
  for (let q = 0; q < 3; q++) g.push(box(0.1, 0.012, 0.08, PAL.concrete2, (q % 2 ? 0.03 : -0.03), y0 + 0.006, d / 2 + 0.08 + q * 0.09));   // stepping stones to the door
  g.push(cyl(0.03, 0.035, 0.12, PAL.concrete, 0.38, y0 + 0.06, 0.42, 6)); g.push(box(0.1, 0.07, 0.1, PAL.concrete, 0.38, y0 + 0.16, 0.42)); g.push(box(0.13, 0.025, 0.13, PAL.concrete, 0.38, y0 + 0.21, 0.42));
  wg.push(box(0.05, 0.04, 0.05, PAL.window, 0.38, y0 + 0.16, 0.42));
  addNature(g, 'matsu', -0.38, y0, 0.4, 0.34, u.seed, '#6f8f6a');
}
/** a small supermarket across the whole block: glazed front, one long fascia in the awning colour, trolleys by the door */
function genSupermarket(b, u, g, wg) {
  const L = b.level, k = Math.max(0, b.units.indexOf(u)), n = b.units.length, w = 0.98, d = 0.72, H = 0.72 + (L >= 2 ? 0.44 : 0), y0 = 0.12, [a1] = b.awning, mid = n >= 3 ? k === 1 : k === 0;
  u.door = { x: 0, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  g.push(box(w, 0.08, d + 0.08, a1, 0, y0 + H + 0.04, 0)); g.push(box(w, 0.04, d + 0.12, PAL.cream2, 0, y0 + H + 0.1, 0));   // flat roof with a coloured edge
  g.push(box(w, 0.2, 0.05, a1, 0, y0 + 0.62, d / 2 + 0.03)); wg.push(box(w * 0.9, 0.12, 0.02, PAL.window, 0, y0 + 0.62, d / 2 + 0.058));   // the long fascia, lit at night
  if (mid) { wg.push(box(0.4, 0.4, 0.03, PAL.window, 0, y0 + 0.22, d / 2 + 0.015)); g.push(box(0.44, 0.44, 0.02, K.frame, 0, y0 + 0.22, d / 2 + 0.005)); g.push(box(0.012, 0.4, 0.035, K.frame, 0, y0 + 0.22, d / 2 + 0.02)); boxCanopy(g, 0, y0 + 0.48, d / 2 + 0.01, 0.6, PAL.cream2, 0.3); }
  else { wg.push(box(0.8, 0.34, 0.03, PAL.window, 0, y0 + 0.3, d / 2 + 0.015)); g.push(box(0.84, 0.38, 0.02, K.frame, 0, y0 + 0.3, d / 2 + 0.005)); for (const x of [-0.27, 0, 0.27]) g.push(box(0.02, 0.34, 0.035, K.mullion, x, y0 + 0.3, d / 2 + 0.02)); g.push(box(0.8, 0.12, 0.04, a1, 0, y0 + 0.08, d / 2 + 0.02)); }
  if (k === 0) { for (let q = 0; q < 3; q++) { g.push(box(0.1, 0.1, 0.12, K.metal2, -0.3 + q * 0.08, y0 + 0.13, 0.42)); g.push(box(0.012, 0.16, 0.012, K.metal, -0.3 + q * 0.08, y0 + 0.08, 0.36)); } }   // a rank of trolleys
  if (b.popular) for (let q = 0; q < 4; q++) g.push(box(0.05, 0.16, 0.008, q % 2 ? a1 : K.red, -0.36 + q * 0.24, y0 + H + 0.18, d / 2 + 0.04));   // sale flags along the roof edge
  if (k === n - 1) bikeRack(g, 0.2, 0.44, 4, 0, u.seed);
  for (const x of [-0.3, 0.1]) acUnit(g, x, y0 + H + 0.14, -0.2, 0); if (mid) g.push(box(0.3, 0.16, 0.3, PAL.concrete, 0.25, y0 + H + 0.14, -0.1));
  if (L >= 2) for (const x of [-0.28, 0.28]) windowPane(g, wg, x, y0 + 0.98, d / 2 + 0.005, 0.24, 0.16);
  windowPane(g, wg, 0, y0 + 0.4, -d / 2 - 0.005, 0.4, 0.14, Math.PI); pipe(g, -w / 2 + 0.03, y0, y0 + H, -d / 2 - 0.02);
  g.push(box(0.98, 0.1, 0.06, PAL.bush, 0, 0.17, -0.44));
}
/** shotengai: small shopfronts under one continuous canopy over the pavement, each unit a different stall */
function genArcade(b, u, g, wg) {
  const L = b.level, k = Math.max(0, b.units.indexOf(u)), w = 0.98, d = 0.62, H = 0.64 + (L >= 2 ? 0.46 : 0), y0 = 0.12, [a1] = b.awning;
  const stall = ['fruit', 'fish', 'sweets', 'tea'][(k + Math.floor(u.seed * 4)) % 4], col = [PAL.roofPeach, PAL.roofBlue, PAL.pink, PAL.roofSage][(k + Math.floor(u.seed * 4)) % 4];
  u.door = { x: -0.26, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  if (b.roofStyle === 'kawara') kawaraRoof(g, w - 0.24, d, H, y0, PAL.kawara2, false); else { g.push(box(w, 0.08, d + 0.08, b.roof, 0, y0 + H + 0.04, 0)); g.push(box(w, 0.04, d + 0.12, b.roof, 0, y0 + H + 0.1, 0)); }
  // the arcade canopy: a translucent-looking vault over the pavement on slim posts, continuous across the block
  wg.push(box(w, 0.015, 0.62, PAL.window, 0, y0 + 0.72, d / 2 + 0.36));   // a thin glazed canopy over the pavement, lit softly at night
  for (let q = 0; q < 4; q++) g.push(box(0.02, 0.03, 0.62, K.metal2, -0.36 + q * 0.24, y0 + 0.735, d / 2 + 0.36));   // its ribs
  g.push(box(w, 0.05, 0.05, a1, 0, y0 + 0.72, d / 2 + 0.67)); for (const x of [-0.42, 0.42]) g.push(cyl(0.02, 0.025, 0.7, K.metal2, x, y0 + 0.35, d / 2 + 0.66, 6));   // front beam and posts
  g.push(box(w, 0.05, 0.05, a1, 0, y0 + 0.62, d / 2 + 0.02));
  door(g, -0.26, y0, d / 2 + 0.005, 0.16, 0.32, PAL.wood2); noren(g, -0.26, y0 + 0.36, d / 2 + 0.03, 0.2, col, PAL.cream2);
  windowPane(g, wg, 0.14, y0 + 0.3, d / 2 + 0.005, 0.44, 0.24);
  // the stall counter in front, with produce, fish on ice, sweets boxes or tea tins
  g.push(box(0.5, 0.16, 0.22, PAL.wood, 0.14, y0 + 0.08, 0.36)); g.push(box(0.54, 0.02, 0.26, PAL.wood2, 0.14, y0 + 0.17, 0.36));
  if (stall === 'fruit') for (let q = 0; q < 6; q++) g.push(blob(0.035, [PAL.roofPeach, K.red, '#8fae78'][q % 3], -0.06 + (q % 3) * 0.16, y0 + 0.21, 0.3 + Math.floor(q / 3) * 0.1, 0, 0.9));
  else if (stall === 'fish') { g.push(box(0.46, 0.02, 0.2, PAL.foam, 0.14, y0 + 0.19, 0.36)); for (let q = 0; q < 4; q++) g.push(box(0.1, 0.02, 0.04, PAL.sky2, -0.04 + q * 0.12, y0 + 0.21, 0.34 + (q % 2) * 0.05)); }
  else if (stall === 'sweets') for (let q = 0; q < 6; q++) g.push(box(0.08, 0.05, 0.08, [PAL.pink, PAL.cream2, PAL.mint][q % 3], -0.06 + (q % 3) * 0.16, y0 + 0.205, 0.31 + Math.floor(q / 3) * 0.1));
  else for (let q = 0; q < 5; q++) g.push(cyl(0.03, 0.03, 0.07, [PAL.roofSage, PAL.roofTeal, K.red][q % 3], -0.04 + q * 0.09, y0 + 0.215, 0.34, 8));
  signBoard(g, wg, 0.1, y0 + 0.5, d / 2 + 0.02, 0.4, col, PAL.cream2, sub(u.seed, 3) > 0.5); chochin(g, wg, 0.14, y0 + 0.46, d / 2 + 0.5, 2, col === PAL.pink ? PAL.cream2 : K.lantern);
  if (L >= 2) { for (const x of [-0.22, 0.2]) windowPane(g, wg, x, y0 + 0.92, d / 2 + 0.005, 0.18, 0.18); acUnit(g, 0.36, y0 + 0.86, d / 2 + 0.05, 0); }
  windowPane(g, wg, 0.1, y0 + 0.36, -d / 2 - 0.005, 0.24, 0.16, Math.PI); pipe(g, w / 2 - 0.03, y0, y0 + H, -d / 2 - 0.02);
  g.push(box(0.98, 0.1, 0.06, PAL.bush, 0, 0.17, -0.44));
}

// ── workspaces ──
function genWork(b, u, g, wg) {
  const kind = b.kind || 'office';
  if (kind === 'workshop') return genWorkshop(b, u, g, wg);
  if (kind === 'studio') return genStudio(b, u, g, wg);
  if (kind === 'factory') return genFactory(b, u, g, wg);
  const L = b.level, { w, d, H } = dims('work', L), y0 = 0.12, floors = L + 1;
  const facade = u.facade = sub(u.seed, 2) < 0.34 ? 'glass' : sub(u.seed, 2) < 0.67 ? 'punched' : 'louvre';   // three office faces
  u.door = { x: 0, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  g.push(box(w + 0.04, 0.12, d + 0.04, PAL.concrete, 0, y0 + 0.06, 0));
  g.push(box(w + 0.06, 0.07, d + 0.06, b.roof, 0, y0 + H + 0.03, 0));
  if (facade === 'punched') { for (let f = 0; f < floors; f++) { const y = y0 + 0.42 + f * ((H - 0.5) / Math.max(1, floors - 1)) * (floors > 1 ? 1 : 0) + (floors === 1 ? 0.1 : 0); if (f === 0) { wg.push(box(0.2, 0.3, 0.03, PAL.window, 0, y0 + 0.27, d / 2 + 0.015)); g.push(box(0.34, 0.04, 0.18, b.roof, 0, y0 + 0.46, d / 2 + 0.09)); } for (const x of (f === 0 ? [-0.28, 0.28] : [-0.26, 0, 0.26])) windowPane(g, wg, x, y, d / 2 + 0.005, 0.14, 0.2); for (const z of [-0.2, 0.05]) windowPane(g, wg, w / 2 + 0.005, y, z, 0.14, 0.2, Math.PI / 2); g.push(box(w + 0.03, 0.03, d + 0.03, PAL.cream2, 0, y - 0.15, 0)); } }   // punched windows in a solid wall, a string course per floor
  else for (let f = 0; f < floors; f++) {
    const y = y0 + 0.42 + f * ((H - 0.5) / Math.max(1, floors - 1)) * (floors > 1 ? 1 : 0) + (floors === 1 ? 0.1 : 0);
    if (facade === 'louvre') for (const fy of [-0.07, 0, 0.07]) { g.push(box(0.64, 0.012, 0.06, K.metal2, 0, y + fy, d / 2 + 0.05)); g.push(box(0.06, 0.012, 0.54, K.metal2, w / 2 + 0.05, y + fy, 0)); }   // sun fins over the glass bands
    if (f === 0) { wg.push(box(0.2, 0.3, 0.03, PAL.window, 0, y0 + 0.27, d / 2 + 0.015)); g.push(box(0.34, 0.04, 0.18, b.roof, 0, y0 + 0.46, d / 2 + 0.09)); for (const x of [-0.16, 0.16]) g.push(box(0.03, 0.34, 0.03, K.mullion, x, y0 + 0.29, d / 2 + 0.06)); wg.push(box(0.03, 0.22, 0.5, PAL.window, w / 2 + 0.015, y0 + 0.3, 0)); continue; }
    wg.push(box(0.6, 0.22, 0.03, PAL.window, 0, y, d / 2 + 0.015)); for (const x of [-0.2, 0, 0.2]) g.push(box(0.025, 0.22, 0.04, K.mullion, x, y, d / 2 + 0.02));
    wg.push(box(0.03, 0.22, 0.5, PAL.window, w / 2 + 0.015, y, 0)); for (const z of [-0.17, 0, 0.17]) g.push(box(0.04, 0.22, 0.025, K.mullion, w / 2 + 0.02, y, z));
    g.push(box(w + 0.03, 0.04, d + 0.03, PAL.concrete, 0, y - 0.15, 0));
  }
  g.push(box(0.16, 0.12, 0.16, PAL.concrete, -0.22, y0 + H + 0.12, -0.15)); g.push(box(0.12, 0.1, 0.16, PAL.concrete, 0.2, y0 + H + 0.11, -0.18));
  if (sub(u.seed, 4) > 0.5) dish(g, 0.3, y0 + H + 0.1, -0.05, 0.6);
  acUnit(g, -w / 2 - 0.05, y0 + 0.3, 0.1, -Math.PI / 2); pipe(g, -w / 2 - 0.02, y0, y0 + H, -0.25);
  if (L >= 2) g.push(box(0.3, 0.16, 0.05, PAL.cream2, 0.1, y0 + H + 0.14, 0.2));
  if (L >= 3) { g.push(cyl(0.012, 0.012, 0.5, PAL.lamp, 0.3, y0 + H + 0.3, 0.1, 4)); g.push(blob(0.035, PAL.roofRose, 0.3, y0 + H + 0.56, 0.1, 0, 1)); }
  for (const x of [-0.42, 0.42]) { g.push(box(0.12, 0.12, 0.12, PAL.concrete, x, y0 + 0.06, 0.4)); g.push(blob(0.08, PAL.bush2, x, y0 + 0.16, 0.4, 0, 0.8)); }
  for (let f = 1; f < floors; f++) { const y = y0 + 0.42 + f * ((H - 0.5) / Math.max(1, floors - 1)); wg.push(box(0.5, 0.2, 0.03, PAL.window, 0, y, -d / 2 - 0.015)); wg.push(box(0.03, 0.2, 0.4, PAL.window, -w / 2 - 0.015, y, 0)); }
  bikeRack(g, -0.25, 0.44, 2, 0, u.seed);
  g.push(box(0.9, 0.1, 0.06, PAL.bush, 0, 0.17, -0.44));
}
/** a small factory across the block: saw-tooth roof with north lights, a chimney on one end, shutter doors and a gate on the other */
function genFactory(b, u, g, wg) {
  const L = b.level, k = Math.max(0, b.units.indexOf(u)), n = b.units.length, w = 0.98, d = 0.76, H = 0.78 + (L - 1) * 0.12, y0 = 0.12;
  u.door = { x: -0.3, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  for (let q = 0; q < 6; q++) g.push(box(w, 0.012, 0.012, K.siding, 0, y0 + 0.14 + q * 0.11, d / 2 + 0.005));
  for (const zc of [-d / 4, d / 4]) {   // two saw-tooth bays: a steep glazed north face and a long metal slope
    const slope = new THREE.BoxGeometry(w, 0.04, d / 2 + 0.02); slope.rotateX(-0.42); slope.translate(0, y0 + H + 0.1, zc + 0.03); g.push(colorize(slope, K.metal));
    const glass = new THREE.BoxGeometry(w - 0.06, 0.2, 0.03); glass.rotateX(0.5); glass.translate(0, y0 + H + 0.12, zc - d / 4 + 0.02); wg.push(colorize(glass, PAL.window));
    g.push(box(w, 0.02, 0.02, K.metal2, 0, y0 + H + 0.21, zc - d / 4 + 0.09));
  }
  g.push(box(0.46, 0.5, 0.03, K.shutter, 0.14, y0 + 0.25, d / 2 + 0.015)); for (let q = 0; q < 6; q++) g.push(box(0.46, 0.012, 0.035, K.shutterLine, 0.14, y0 + 0.06 + q * 0.08, d / 2 + 0.016)); g.push(box(0.5, 0.05, 0.06, K.metal, 0.14, y0 + 0.52, d / 2 + 0.02));
  door(g, -0.3, y0, d / 2 + 0.005, 0.14, 0.28, K.rail); windowPane(g, wg, -0.3, y0 + 0.52, d / 2 + 0.005, 0.16, 0.12);
  if (k === 0) { g.push(cyl(0.06, 0.07, 0.7, PAL.concrete2, -0.32, y0 + H + 0.3, -0.22, 8)); g.push(cyl(0.065, 0.065, 0.06, K.red, -0.32, y0 + H + 0.62, -0.22, 8)); }   // chimney with a red band
  if (k === n - 1) { g.push(box(0.03, 0.34, 0.03, K.metal, 0.44, y0 + 0.17, 0.46)); for (let q = 0; q < 5; q++) g.push(box(0.012, 0.3, 0.012, K.metal2, 0.24 + q * 0.05, y0 + 0.16, 0.46)); g.push(box(0.26, 0.012, 0.012, K.metal2, 0.34, y0 + 0.3, 0.46)); }   // a sliding gate on the yard side
  acUnit(g, -w / 2 - 0.05, y0 + 0.3, -0.1, -Math.PI / 2); pipe(g, w / 2 - 0.03, y0, y0 + H, -d / 2 - 0.02);
  g.push(box(0.2, 0.03, 0.16, PAL.wood, -0.2 + k * 0.1, y0 + 0.015, 0.42)); g.push(box(0.14, 0.14, 0.14, PAL.wood2, -0.2 + k * 0.1, y0 + 0.1, 0.42));   // a pallet and crate by the door
  if (sub(u.seed, 3) > 0.5) g.push(cyl(0.05, 0.05, 0.14, PAL.roofBlue, 0.4, y0 + 0.07, 0.3, 8));
  g.push(box(0.98, 0.1, 0.06, PAL.bush, 0, 0.17, -0.44));
}
function genWorkshop(b, u, g, wg) {
  const L = b.level, w = 0.86, d = 0.72, H = 0.72 + (L - 1) * 0.16, y0 = 0.12;
  u.door = { x: -0.28, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  for (let k = 0; k < 6; k++) g.push(box(w + 0.01, 0.012, 0.012, K.siding, 0, y0 + 0.1 + k * 0.11, d / 2 + 0.005));
  g.push(prism(w + 0.14, 0.2, d + 0.16, K.metal, 0, y0 + H - 0.01, 0)); g.push(box(w + 0.18, 0.04, d + 0.2, K.metal2, 0, y0 + H, 0));
  for (let k = 0; k < 7; k++) { const rx = -w / 2 + 0.06 + k * ((w - 0.12) / 6); g.push(box(0.012, 0.012, d + 0.14, K.metal2, rx, y0 + H + 0.11 + 0.005, 0)); }
  g.push(cyl(0.035, 0.035, 0.3, K.metal2, 0.3, y0 + H + 0.2, -0.15, 6)); g.push(cyl(0.05, 0.035, 0.05, K.metal, 0.3, y0 + H + 0.36, -0.15, 6));
  // big roller shutter and a small side door
  g.push(box(0.42, 0.48, 0.03, K.shutter, 0.12, y0 + 0.24, d / 2 + 0.015)); for (let k = 0; k < 6; k++) g.push(box(0.42, 0.012, 0.035, K.shutterLine, 0.12, y0 + 0.06 + k * 0.08, d / 2 + 0.016)); g.push(box(0.46, 0.05, 0.06, K.metal, 0.12, y0 + 0.5, d / 2 + 0.02));
  door(g, -0.28, y0, d / 2 + 0.005, 0.14, 0.27, K.rail);
  windowPane(g, wg, -0.28, y0 + 0.5, d / 2 + 0.005, 0.14, 0.1); windowPane(g, wg, w / 2 + 0.005, y0 + 0.5, 0, 0.5, 0.12, Math.PI / 2);
  acUnit(g, -w / 2 - 0.05, y0 + 0.25, -0.1, -Math.PI / 2); pipe(g, w / 2 + 0.02, y0, y0 + H - 0.02, -d / 2 + 0.06);
  // yard: pallet, crates, a barrel
  g.push(box(0.2, 0.03, 0.16, PAL.wood, 0.38, y0 + 0.015, 0.42)); g.push(box(0.12, 0.12, 0.12, PAL.wood2, 0.36, y0 + 0.09, 0.42)); g.push(box(0.08, 0.08, 0.08, PAL.wood2, 0.44, y0 + 0.07, 0.38));
  g.push(cyl(0.05, 0.05, 0.14, PAL.roofBlue, -0.42, y0 + 0.07, 0.36, 8)); g.push(cyl(0.05, 0.05, 0.14, PAL.roofBlue, -0.42, y0 + 0.07, 0.24, 8));
  if (L >= 2) { g.push(box(0.3, 0.14, 0.03, PAL.cream2, 0.12, y0 + H - 0.12, d / 2 + 0.02)); g.push(box(0.16, 0.04, 0.035, K.red, 0.12, y0 + H - 0.12, d / 2 + 0.03)); }
  if (L >= 3) g.push(box(0.3, 0.1, 0.24, K.metal, -0.2, y0 + H + 0.1, -0.15));
  g.push(box(0.08, 0.12, 0.72, PAL.bush, -0.43, 0.18, -0.04));
}
function genStudio(b, u, g, wg) {
  const L = b.level, w = 0.7, d = 0.7, H = 0.85 + (L - 1) * 0.5, y0 = 0.12;
  u.door = { x: -0.2, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  g.push(box(0.03, H, d + 0.01, PAL.wood2, w / 2 + 0.005, y0 + H / 2, 0)); for (let k = 0; k < 8; k++) g.push(box(0.04, 0.012, d + 0.02, PAL.wood, w / 2 + 0.005, y0 + 0.08 + k * (H - 0.16) / 7, 0));
  g.push(box(w + 0.06, 0.06, d + 0.06, b.roof, 0, y0 + H + 0.03, 0));
  const sky = new THREE.BoxGeometry(0.3, 0.02, 0.24); sky.rotateX(-0.35); sky.translate(0.1, y0 + H + 0.12, -0.1); wg.push(colorize(sky, PAL.window)); g.push(box(0.34, 0.04, 0.05, K.metal, 0.1, y0 + H + 0.06, 0.02));
  windowPane(g, wg, 0.12, y0 + 0.4, d / 2 + 0.005, 0.38, 0.5); g.push(box(0.02, 0.5, 0.035, K.mullion, 0.12, y0 + 0.4, d / 2 + 0.02));
  door(g, -0.2, y0, d / 2 + 0.005, 0.16, 0.3, PAL.wood, b.roof);
  for (let f = 1; f < L; f++) { const y = y0 + 0.85 + (f - 1) * 0.5 + 0.2; windowPane(g, wg, 0, y, d / 2 + 0.005, 0.5, 0.22); windowPane(g, wg, -w / 2 - 0.005, y, 0, 0.3, 0.2, Math.PI / 2); }
  acUnit(g, -w / 2 - 0.05, y0 + 0.28, -0.15, -Math.PI / 2); pipe(g, -w / 2 - 0.02, y0, y0 + H, 0.25);
  g.push(box(0.5, 0.03, 0.08, PAL.wood, 0.1, y0 + 0.35, d / 2 + 0.04)); pots(g, 0.1, d / 2 + 0.04, 3, true, 0.14);
  g.push(box(0.3, 0.12, 0.03, PAL.cream2, -0.2, y0 + H - 0.14, d / 2 + 0.02)); g.push(box(0.12, 0.04, 0.035, b.roof, -0.2, y0 + H - 0.14, d / 2 + 0.03));
  bicycle(g, 0.4, 0.3, 0.05, K.bike[Math.floor(u.seed * 5) % 5]);
  g.push(box(0.9, 0.1, 0.06, PAL.bush, 0, 0.17, -0.44)); fence(g, -0.45, 0, 0.8, false, PAL.wood2, 0.1);
}

// ── construction site parts ──
const SCAF = K.metal2, TARP = '#cfdde6', CONE = '#e9a25a', MACHINE = '#e8cf7a';
/** scaffolding along the +x face and/or the +z face: poles, ledgers, planks and a top rail */
function scaffold(g, w, d, H, sides) {
  const h = H + 0.3;
  const run = alongZFace => {          // alongZFace: runs along the +z face (in x); else along the +x face (in z)
    const len = alongZFace ? w + 0.16 : d + 0.16;
    for (let k = 0; k < 3; k++) {
      const t = (k - 1) * 0.5 * len;
      for (const off of [0.14, 0.3]) { const px = alongZFace ? t : w / 2 + off, pz = alongZFace ? d / 2 + off : t; g.push(cyl(0.016, 0.016, h, SCAF, px, 0.12 + h / 2, pz, 5)); }
    }
    for (let lv = 1; lv * 0.42 < h; lv++) {
      const y = 0.12 + lv * 0.42;
      g.push(box(alongZFace ? len : 0.18, 0.03, alongZFace ? 0.18 : len, PAL.wood, alongZFace ? 0 : w / 2 + 0.22, y, alongZFace ? d / 2 + 0.22 : 0));
      g.push(box(alongZFace ? len : 0.012, 0.012, alongZFace ? 0.012 : len, SCAF, alongZFace ? 0 : w / 2 + 0.3, y + 0.14, alongZFace ? d / 2 + 0.3 : 0));
    }
  };
  if (sides.includes('z')) run(true); if (sides.includes('x')) run(false);
}
function excavator(g, x, z, rot) {
  const p = [];
  p.push(box(0.3, 0.08, 0.26, '#4a4340', 0, 0.16, 0)); p.push(box(0.2, 0.12, 0.2, MACHINE, -0.02, 0.26, 0)); p.push(box(0.1, 0.12, 0.14, PAL.window, 0.03, 0.27, 0.0));
  const arm = new THREE.BoxGeometry(0.04, 0.04, 0.3); arm.rotateX(-0.9); arm.translate(0.06, 0.4, 0.14); p.push(colorize(arm, MACHINE));
  const fore = new THREE.BoxGeometry(0.035, 0.035, 0.26); fore.rotateX(0.7); fore.translate(0.06, 0.36, 0.34); p.push(colorize(fore, MACHINE));
  p.push(box(0.12, 0.08, 0.08, '#4a4340', 0.06, 0.2, 0.44));
  for (const q of p) { q.rotateY(rot); q.translate(x, 0, z); g.push(q); }
}
function pallet(g, x, z, kind) {
  g.push(box(0.22, 0.03, 0.18, PAL.wood, x, 0.135, z));
  if (kind === 'blocks') for (let k = 0; k < 6; k++) g.push(box(0.06, 0.06, 0.07, PAL.concrete, x - 0.07 + (k % 3) * 0.07, 0.18 + Math.floor(k / 3) * 0.06, z + (k % 2 ? 0.04 : -0.04)));
  else if (kind === 'timber') for (let k = 0; k < 5; k++) g.push(box(0.05, 0.05, 0.4, PAL.wood2, x - 0.08 + (k % 3) * 0.06 + (k > 2 ? 0.03 : 0), 0.175 + Math.floor(k / 3) * 0.05, z));
  else for (let k = 0; k < 3; k++) g.push(cyl(0.035, 0.035, 0.07, [PAL.roofRose, PAL.cream2, PAL.roofBlue][k], x - 0.06 + k * 0.06, 0.185, z, 8));
}
function sawhorse(g, x, z) { for (const dx of [-0.12, 0.12]) for (const dz of [-0.03, 0.03]) { const leg = new THREE.BoxGeometry(0.015, 0.16, 0.015); leg.rotateX(dz > 0 ? 0.35 : -0.35); leg.translate(x + dx, 0.2, z + dz); g.push(colorize(leg, PAL.wood2)); } g.push(box(0.34, 0.025, 0.03, PAL.wood, x, 0.28, z)); g.push(box(0.2, 0.02, 0.06, PAL.wood2, x - 0.02, 0.3, z)); }
function cones(g, pts) { for (const [x, z] of pts) { g.push(cyl(0.012, 0.04, 0.1, CONE, x, 0.17, z, 6)); g.push(box(0.09, 0.012, 0.09, CONE, x, 0.126, z)); } }
function siteSign(g, x, z) { g.push(cyl(0.015, 0.015, 0.36, PAL.wood2, x, 0.3, z, 4)); g.push(box(0.26, 0.16, 0.02, PAL.cream2, x, 0.5, z)); g.push(box(0.2, 0.03, 0.025, CONE, x, 0.53, z + 0.005)); g.push(box(0.16, 0.02, 0.025, K.chalk, x, 0.47, z + 0.005)); }
function finalGen(b, u, g, wg) {
  // the rich look's slate-roofed house stands in for detached homes (and hill villas) only; shops, workspaces and the other homes
  // keep their own generators, so size tiers (1, 2, 3 cells), kinds, finishes and facades all still read (decided 2026-09-23)
  if (S.look === 'rich' && b.type === 'res' && (u.variant === 'detached' || u.variant === 'villa' || !u.variant) && b.cells.length === 1) genRichBuilding(b, u, g, wg);
  else (b.type === 'res' ? genResidential : b.type === 'shop' ? genShop : b.type === 'civic' ? genCivic : b.type === 'farm' ? genFarm : genWork)(b, u, g, wg);
}

/** Phase 7 farms. The first cell of every farm has a small farmhouse at the back corner; the rest is planted. What grows follows
 *  the season (rebuilt at each turn): bare ridges with seedlings in spring, full green in summer, pumpkins and gold in autumn, bare
 *  earth in winter (snow settles on it). Paddies are flooded in spring, green in summer, gold with drying racks in autumn and
 *  stubble in winter; a paddy cell beside the canal turns a water wheel. The greenhouse glows faintly after dark. */
function farmhouse(g, wg, u) {
  const hg = [], hw = [], y0 = 0.12, w = 0.36, d = 0.3, H = 0.3;
  hg.push(box(w, H, d, PAL.cream2, 0, y0 + H / 2, 0)); for (const x of [-w / 2 + 0.01, w / 2 - 0.01]) hg.push(box(0.022, H, 0.022, '#5a4636', x, y0 + H / 2, d / 2));
  kawaraRoof(hg, w, d, H, y0, PAL.kawara2, false);
  hw.push(box(0.12, 0.1, 0.02, PAL.window, 0.08, y0 + 0.17, d / 2 + 0.005)); hg.push(box(0.08, 0.17, 0.02, PAL.wood2, -0.09, y0 + 0.085, d / 2 + 0.006));
  hg.push(box(0.14, 0.1, 0.1, '#b08a62', w / 2 + 0.09, y0 + 0.05, 0.05)); hg.push(box(0.1, 0.05, 0.08, PAL.roofBlue, w / 2 + 0.09, y0 + 0.125, 0.05));   // a stack of crates by the door
  for (const p of hg) { p.translate(-0.26, 0, -0.26); g.push(p); } for (const p of hw) { p.translate(-0.26, 0, -0.26); wg.push(p); }
  u.door = { x: -0.26 - 0.09, z: -0.26 + d / 2 + 0.02 };
}
function scarecrow(g, x, z, seed) {   // kakashi: a pole, a crossbar with sleeves, a straw hat
  const y0 = 0.12; g.push(box(0.018, 0.34, 0.018, '#7a5f45', x, y0 + 0.17, z)); g.push(box(0.2, 0.016, 0.016, '#7a5f45', x, y0 + 0.26, z));
  g.push(box(0.12, 0.1, 0.04, seed < 0.5 ? PAL.indigo : '#b24a3c', x, y0 + 0.25, z)); g.push(blob(0.035, PAL.cream2, x, y0 + 0.34, z, 0, 1));
  g.push(cyl(0.07, 0.07, 0.012, '#d6b56a', x, y0 + 0.37, z, 10)); g.push(cyl(0.025, 0.035, 0.03, '#d6b56a', x, y0 + 0.39, z, 8));
}
function genFarm(b, u, g, wg) {
  const k = Math.max(0, b.units.indexOf(u)), y0 = 0.12, season = seasonOf(), kind = b.kind, first = k === 0;
  const house = first && kind !== 'greenhouse';
  if (!house) u.door = { x: 0, z: 0.46 };
  if (kind === 'greenhouse') {   // a long glasshouse: pale frosted panels on a white frame, benches of plants inside the door
    g.push(box(0.9, 0.02, 0.9, PAL.concrete2, 0, y0 + 0.01, 0));
    const W = 0.7, D = 0.76, H = 0.34;
    g.push(box(W, H, D, '#dfeae4', 0, y0 + H / 2, -0.02)); const r1 = prism(W, 0.16, D, '#e9f1ec', 0, y0 + H, -0.02, Math.PI / 2); g.push(r1);
    for (let q = 0; q <= 4; q++) { g.push(box(0.014, H, 0.014, '#f7f7f2', -W / 2 + q * (W / 4), y0 + H / 2, D / 2 - 0.02)); g.push(box(0.014, H, 0.014, '#f7f7f2', -W / 2 + q * (W / 4), y0 + H / 2, -D / 2 - 0.02)); }
    for (let q = 0; q <= 5; q++) g.push(box(W + 0.01, 0.012, 0.012, '#f7f7f2', 0, y0 + H, -D / 2 - 0.02 + q * (D / 5)));
    wg.push(box(W - 0.06, H - 0.08, 0.01, '#cfe3d4', 0, y0 + H / 2, D / 2 - 0.012));   // the glazed end: a soft glow at night
    g.push(box(0.14, 0.24, 0.012, '#f7f7f2', 0, y0 + 0.12, D / 2 - 0.01));
    for (let q = 0; q < 5; q++) g.push(blob(0.035, [PAL.flower, '#7fa35a', PAL.roofRose, '#e6b84a', '#7fa35a'][q], -0.28 + q * 0.14, y0 + 0.05, 0.43, 0, 0.8));   // pots outside the door
    u.door = { x: 0, z: 0.44 };
    return;
  }
  if (kind === 'paddy') {
    const soil = '#8d7457'; g.push(box(0.96, 0.03, 0.96, soil, 0, y0 - 0.005, 0));
    for (const [x, z, w, d] of [[0, -0.47, 0.96, 0.05], [0, 0.47, 0.96, 0.05], [-0.47, 0, 0.05, 0.96], [0.47, 0, 0.05, 0.96]]) g.push(box(w, 0.05, d, '#9a8062', x, y0 + 0.02, z));   // low earth bunds
    const water = season === 'winter' ? '#a58d68' : season === 'autumn' ? '#9fb0a0' : '#8fb5b8';
    g.push(box(0.88, 0.012, 0.88, water, 0, y0 + 0.012, 0));
    const col = { spring: '#a9c77f', summer: '#7fa35a', autumn: '#d4b155', winter: '#b59b72' }[season], h = { spring: 0.035, summer: 0.09, autumn: 0.1, winter: 0.015 }[season];
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { if (house && i < 4 && j < 4) continue; g.push(box(0.05, h, 0.05, col, -0.36 + i * 0.103, y0 + 0.018 + h / 2, -0.36 + j * 0.103)); }
    if (season === 'autumn' && k === 1) for (const z of [-0.2, 0.2]) { g.push(box(0.5, 0.02, 0.02, '#7a5f45', 0.1, y0 + 0.22, z)); for (const x of [-0.14, 0.34]) g.push(box(0.02, 0.22, 0.02, '#7a5f45', x, y0 + 0.11, z)); g.push(box(0.46, 0.1, 0.05, '#d9bd6a', 0.1, y0 + 0.17, z)); }   // hasa-kake: rice drying on racks
  } else {   // the vegetable field: ridges running to the street, what grows on them by the season
    g.push(box(0.96, 0.03, 0.96, '#8a6a4e', 0, y0 - 0.005, 0));
    const n = 6;
    for (let i = 0; i < n; i++) {
      const x = -0.4 + i * 0.16; if (house && x < -0.05) continue;
      g.push(box(0.09, 0.04, house ? 0.9 : 0.9, '#7a5c43', x, y0 + 0.03, 0));
      for (let j = 0; j < 7; j++) {
        const z = -0.39 + j * 0.13, s = sub(u.seed, i * 7 + j);
        if (season === 'spring') g.push(blob(0.018, '#a9c77f', x, y0 + 0.06, z, 0, 0.8));
        else if (season === 'summer') { g.push(blob(0.045, s < 0.3 ? '#6f9a4f' : '#7fa35a', x, y0 + 0.08, z, 0, 0.8)); if (s > 0.75) g.push(blob(0.016, '#c9564b', x + 0.02, y0 + 0.11, z, 0, 1)); }
        else if (season === 'autumn') { if (s < 0.45) g.push(blob(0.035, '#d98c3f', x, y0 + 0.07, z, 0, 0.75)); else g.push(blob(0.035, '#b9a253', x, y0 + 0.07, z, 0, 0.7)); }
      }
    }
  }
  if (house) farmhouse(g, wg, u);
  if (!house && kind !== 'paddy' && season !== 'winter') scarecrow(g, 0.34, -0.3, u.seed);
  if (kind === 'paddy' && k === b.units.length - 1 && season !== 'winter') scarecrow(g, -0.34, 0.3, u.seed);
}
/** a water wheel on a paddy cell's canal edge, turning (u.wheel spins in main.js) */
function waterWheel(grp, u) {
  const f = u.facing || 0, dir = [[0, -1], [1, 0], [0, 1], [-1, 0]].find(([a, b]) => { const n = cellAtIJ(u.cell.i + a, u.cell.j + b); return n && n.type === 'canal'; }); if (!dir) return;
  const lx = dir[0] * Math.cos(f) - dir[1] * Math.sin(f), lz = dir[0] * Math.sin(f) + dir[1] * Math.cos(f);
  const holder = new THREE.Group(); holder.position.set(lx * 0.5, 0.02, lz * 0.5); holder.rotation.y = Math.atan2(lx, lz);
  const wood = new THREE.MeshStandardMaterial({ color: '#7a5f45', roughness: 0.9 }), wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 20), wood); rim.rotation.y = Math.PI / 2; wheel.add(rim);
  const rim2 = rim.clone(); rim2.position.x = 0.07; wheel.add(rim2);
  for (let q = 0; q < 8; q++) { const a = q / 8 * Math.PI * 2; const sp = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.4, 0.012), wood); sp.rotation.x = a; sp.position.x = 0.035; wheel.add(sp); const pd = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.012), wood); pd.position.set(0.035, Math.cos(a) * 0.2, Math.sin(a) * 0.2); pd.rotation.x = a; wheel.add(pd); }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 6), wood); axle.rotation.z = Math.PI / 2; axle.position.x = 0.035; wheel.add(axle);
  for (const x of [-0.04, 0.11]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.24, 0.02), wood); st.position.set(x, 0.06, 0); holder.add(st); }
  wheel.position.y = 0.12; holder.add(wheel); holder.traverse(o => { if (o.isMesh) o.castShadow = true; }); snowKit(holder);
  grp.add(holder); u.wheel = wheel;
}
/** civic ground: a gravel pad and what the kit model does not bring (fence, pump house, shed); the kit models themselves are
 *  attached in rebuildUnitMesh. The door is on the front edge so trips end on the pavement */
function genCivic(b, u, g) {
  const k = Math.max(0, b.units.indexOf(u)), y0 = 0.12, kind = b.kind;
  u.door = { x: kind === 'bathhouse' || kind === 'townhall' || kind === 'square' ? 0 : kind === 'clinic' ? -0.14 : kind === 'firestation' ? 0.29 : kind === 'community' ? -0.13 : 0.3, z: 0.49 };
  if (kind === 'square') { genSquare(b, u, g, k); return; }
  g.push(box(0.9, 0.02, 0.9, PAL.concrete2, 0, y0 + 0.01, 0));   // gravel pad
  if (kind === 'substation') {   // a low mesh fence with an opening at the front right
    for (const [x, z] of [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44], [0, -0.44], [-0.44, 0], [0.44, 0]]) g.push(box(0.025, 0.3, 0.025, K.metal, x, y0 + 0.15, z));
    g.push(box(0.9, 0.012, 0.012, K.metal, 0, y0 + 0.29, -0.44)); g.push(box(0.012, 0.012, 0.9, K.metal, -0.44, y0 + 0.29, 0)); g.push(box(0.012, 0.012, 0.9, K.metal, 0.44, y0 + 0.29, 0)); g.push(box(0.5, 0.012, 0.012, K.metal, -0.19, y0 + 0.29, 0.44));
    for (const z of [-0.44, 0.44]) g.push(box(z < 0 ? 0.9 : 0.5, 0.2, 0.004, '#9aa3a8', z < 0 ? 0 : -0.19, y0 + 0.16, z)); for (const x of [-0.44, 0.44]) g.push(box(0.004, 0.2, 0.9, '#9aa3a8', x, y0 + 0.16, 0));   // mesh panels
  } else if (kind === 'waterworks') {   // a small pump house beside the tower
    g.push(box(0.36, 0.3, 0.3, PAL.cream2, 0.26, y0 + 0.15, -0.22)); g.push(box(0.42, 0.04, 0.36, K.metal2, 0.26, y0 + 0.32, -0.22)); g.push(box(0.12, 0.2, 0.02, PAL.wood2, 0.26, y0 + 0.1, -0.06));
    g.push(cyl(0.02, 0.02, 0.5, PAL.sky2, 0.04, y0 + 0.02, -0.1, 6, Math.PI / 2));   // a pipe from the tower to the house
    for (const [x, z] of [[-0.42, 0.4], [-0.3, 0.42]]) g.push(blob(0.09, PAL.bush, x, y0 + 0.08, z, 0, 0.7));
  } else if (kind === 'recycling') {   // a shed behind the bins and a couple of stacked crates
    g.push(box(0.56, 0.42, 0.4, PAL.cream2, -0.18, y0 + 0.21, -0.26)); g.push(box(0.62, 0.04, 0.46, K.metal2, -0.18, y0 + 0.44, -0.26)); g.push(box(0.2, 0.28, 0.02, K.metal, -0.18, y0 + 0.14, -0.05));
    g.push(box(0.14, 0.1, 0.14, PAL.roofBlue, 0.36, y0 + 0.05, -0.32)); g.push(box(0.14, 0.1, 0.14, PAL.treeGreen, 0.36, y0 + 0.15, -0.32));
  } else if ((kind === 'bathhouse' || kind === 'townhall') && k > 0) {   // the second cell: a bike rack and pots, and the town hall's flag lawn
    bikeRack(g, -0.1, 0.42, 3, 0, u.seed); pots(g, 0.3, -0.3, 2);
    if (kind === 'townhall') g.push(box(0.7, 0.03, 0.5, PAL.bush, 0, y0 + 0.035, -0.1));
  } else if (kind === 'firestation') {   // a hose cabinet by the bay and cones at the exit
    g.push(box(0.12, 0.16, 0.06, K.red, 0.42, y0 + 0.08, 0.2));
  }
}

/** the town square: open stone paving from edge to edge so the cells read as one place, a darker border course, and along the
 *  back edge planters with small trees, benches facing the street and a lamp at each end; the front stays open for stalls */
function genSquare(b, u, g, k) {
  const y0 = 0.12, n = b.units.length, stone = ['#d9d3c4', '#cfc8b8', '#e2dccd'];
  g.push(box(1.0, 0.02, 1.0, '#cbc4b3', 0, y0 + 0.01, 0));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) g.push(box(0.235, 0.006, 0.235, stone[(i * 3 + j + k) % 3], -0.375 + i * 0.25, y0 + 0.022, -0.375 + j * 0.25));
  g.push(box(1.0, 0.012, 0.05, '#a9a292', 0, y0 + 0.025, -0.475));
  if (k === 0 || k === n - 1) { const side = k === 0 ? -1 : 1; g.push(box(0.05, 0.012, 1.0, '#a9a292', side * 0.475, y0 + 0.025, 0)); }
  g.push(box(0.26, 0.12, 0.2, PAL.wood, -0.34, y0 + 0.06, -0.38)); addNature(g, 'broadleaf', -0.34, y0 + 0.12, -0.38, 0.5, u.seed, leafColor(u.seed < 0.5 ? PAL.treePeach : PAL.treeSage));
  addFurniture(g, 'bench', 0.2, y0, -0.36, 0);
  if (k === 0 || k === n - 1) addNeighbourhood(g, 'street-lamp', (k === 0 ? -1 : 1) * 0.44, y0, -0.44, Math.PI, { scale: 1.0 });
}

function genConstruction(b, u, g, wg) {
  const st = b.stage, { w, d, H } = dims(b.type, b.level), y0 = 0.12;
  if (st === 0 && b.waiting) {   // waiting for a crew: the grass left as it is, staked and roped off, a small planned-site board
    for (const [x, z] of [[-0.4, -0.36], [0.4, -0.36], [-0.4, 0.36], [0.4, 0.36]]) g.push(cyl(0.016, 0.016, 0.2, PAL.wood, x, y0 + 0.1, z, 4));
    for (const z of [-0.36, 0.36]) g.push(box(0.8, 0.008, 0.008, PAL.roofRose, 0, y0 + 0.17, z));
    for (const x of [-0.4, 0.4]) g.push(box(0.008, 0.008, 0.72, PAL.roofRose, x, y0 + 0.17, 0));
    g.push(box(0.8, 0.012, 0.72, PAL.grass2, 0, y0 + 0.006, 0)); for (let k = 0; k < 5; k++) g.push(blob(0.035 + (k % 2) * 0.015, k % 2 ? PAL.bush : PAL.bush2, -0.25 + k * 0.12, y0 + 0.02, -0.12 + ((k * 7) % 3) * 0.1, 0, 0.5));
    g.push(cyl(0.012, 0.012, 0.3, PAL.wood2, 0.3, y0 + 0.15, 0.42, 4)); g.push(box(0.16, 0.11, 0.015, PAL.cream2, 0.3, y0 + 0.3, 0.43)); g.push(box(0.12, 0.022, 0.017, PAL.roofSage, 0.3, y0 + 0.32, 0.43)); g.push(box(0.09, 0.012, 0.017, PAL.kawara2, 0.3, y0 + 0.28, 0.43));
  } else if (st === 0) {          // surveying: stakes and string, a sign, a heap of earth
    g.push(box(0.82, 0.03, 0.72, PAL.dirt, 0, y0 + 0.015, 0));
    for (const [x, z] of [[-0.38, -0.33], [0.38, -0.33], [-0.38, 0.33], [0.38, 0.33]]) g.push(cyl(0.02, 0.02, 0.22, PAL.wood, x, y0 + 0.11, z, 4));
    g.push(box(0.8, 0.012, 0.012, PAL.cream2, 0, y0 + 0.2, 0.33)); g.push(box(0.012, 0.012, 0.7, PAL.cream2, 0.38, y0 + 0.2, 0));
    siteSign(g, 0.3, 0.44); g.push(blob(0.1, PAL.dirt, -0.28, y0 + 0.05, 0.3, 0, 0.5)); cones(g, [[-0.42, 0.44], [0.0, 0.46]]);
  } else if (st === 1) {   // foundations: slab, corner posts, the little digger, a pallet of blocks
    g.push(box(w + 0.04, 0.1, d + 0.04, PAL.concrete, 0, y0 + 0.05, 0));
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.push(box(0.06, 0.5, 0.06, PAL.wood, x, y0 + 0.35, z));
    g.push(box(w + 0.06, 0.05, 0.06, PAL.wood, 0, y0 + 0.6, d / 2)); g.push(box(w + 0.06, 0.05, 0.06, PAL.wood, 0, y0 + 0.6, -d / 2));
    excavator(g, -0.36, 0.34, 0.5); pallet(g, 0.36, 0.42, 'blocks'); g.push(blob(0.14, PAL.dirt, 0.1, y0 + 0.05, 0.44, 0, 0.5)); siteSign(g, 0.44, -0.1); cones(g, [[-0.44, 0.46]]);
  } else if (st === 2) {   // frame: raw walls to shoulder height, beams, timber stack
    const h = H * 0.6;
    g.push(box(w, h, d, PAL.raw, 0, y0 + h / 2, 0));
    for (const [x, z] of [[-w / 2, d / 2], [w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2]]) g.push(box(0.05, H + 0.15, 0.05, PAL.wood, x, y0 + (H + 0.15) / 2, z));
    g.push(box(w + 0.05, 0.05, 0.05, PAL.wood, 0, y0 + H + 0.12, d / 2)); g.push(box(w + 0.05, 0.05, 0.05, PAL.wood, 0, y0 + H + 0.12, -d / 2)); g.push(box(0.05, 0.05, d + 0.05, PAL.wood, w / 2, y0 + H + 0.12, 0)); g.push(box(0.05, 0.05, d + 0.05, PAL.wood, -w / 2, y0 + H + 0.12, 0));
    for (let k = 0; k < 3; k++) g.push(box(0.03, H, 0.03, PAL.wood2, -w / 2 + 0.15 + k * 0.2, y0 + H / 2, -d / 2 - 0.02));
    pallet(g, 0.36, 0.42, 'timber'); sawhorse(g, -0.1, 0.46); g.push(box(0.14, 0.14, 0.14, PAL.wood2, -0.38, y0 + 0.07, 0.4)); siteSign(g, 0.44, -0.1);
  } else if (st === 3) {   // scaffolding: full-height raw walls, roof frame, scaffold on two faces, a tarp
    g.push(box(w, H, d, PAL.raw, 0, y0 + H / 2, 0));
    g.push(box(w + 0.1, 0.03, 0.03, PAL.wood, 0, y0 + H + 0.3, 0));
    for (const sz of [-1, 1]) { const r = new THREE.BoxGeometry(w + 0.1, 0.025, Math.hypot(d / 2 + 0.05, 0.3)); r.rotateX(-sz * Math.atan2(0.3, d / 2 + 0.05)); r.translate(0, y0 + H + 0.15, sz * (d / 4 + 0.03)); g.push(colorize(r, PAL.wood)); }
    scaffold(g, w, d, H, 'xz');
    g.push(box(0.02, H * 0.75, d * 0.8, TARP, w / 2 + 0.24, y0 + H * 0.45, 0));
    pallet(g, -0.38, 0.44, 'timber'); sawhorse(g, 0.02, 0.48); g.push(cyl(0.08, 0.06, 0.16, '#8fb0c9', 0.4, y0 + 0.1, 0.42, 8)); siteSign(g, -0.44, -0.2);
  } else {                 // finishing: the real building, still with scaffold on one side, wet-paint sign, cones
    finalGen(b, u, g, wg);
    scaffold(g, w, d, H, 'x'); pallet(g, -0.4, 0.44, 'paint'); cones(g, [[0.44, 0.46]]);
    g.push(box(0.16, 0.1, 0.012, PAL.cream2, 0.1, y0 + 0.12, 0.47)); g.push(box(0.1, 0.02, 0.015, K.red, 0.1, y0 + 0.12, 0.475));
  }
  if (st < 4) g.push(box(0.06, 0.12, 0.72, PAL.bush, -0.43, 0.18, -0.04));
}
/** scaffold and paint pots on a finished building that is being extended to the next level */
function renovationOverlay(b, u, g) {
  const { w, d, H } = dims(b.type, b.level); scaffold(g, w, d, H, 'x'); pallet(g, -0.4, 0.44, 'paint'); cones(g, [[0.44, 0.46]]);
  if (b.changing) { g.push(box(w - 0.04, 0.5, 0.03, K.shutter, 0, 0.12 + 0.25, d / 2 + 0.03)); for (let k = 0; k < 6; k++) g.push(box(w - 0.04, 0.012, 0.035, K.shutterLine, 0, 0.12 + 0.06 + k * 0.08, d / 2 + 0.032)); g.push(box(0.3, 0.14, 0.012, PAL.cream2, 0.1, 0.12 + 0.6, d / 2 + 0.045)); g.push(box(0.2, 0.03, 0.014, K.red, 0.1, 0.12 + 0.6, d / 2 + 0.05)); }   // shutters down and a "coming soon" board while the trade changes
}
/** a local (front = +z) point on a unit's cell, in world space, with the unit's facing applied */
function unitLocal(u, lx, lz, y = 0) { const ry = u.facing || 0, s = Math.sin(ry), c = Math.cos(ry); return new THREE.Vector3(cx(u.cell.i) + lx * c + lz * s, y, cz(u.cell.j) - lx * s + lz * c); }

// ───────────────────────────── the station plaza ─────────────────────────────
const RAIL = '#4f6b66', PIT = '#3f3a38';
function bench(g, x, z, rot) {   // faces local +z before rotation
  addFurniture(g, 'bench', x, 0.12, z, rot);   // the kit bench: seat 0.114 above the plinth, hip height for a 0.31 walker
}
function vendingMachine(g, wg, x, z, rot, color) {   // front faces local +z before rotation
  addFurniture(g, 'vending-machine', x, 0.12, z, rot, color);   // the kit machine, 0.41 tall: a head over a walker
  const win = box(0.14, 0.018, 0.01, PAL.window, -0.022, 0.12 + 0.386, 0.108);   // its header strip glows after dark
  win.rotateY(rot); win.translate(x, 0, z); wg.push(win);
}
/** kōban: a tiny police box facing the plaza, cream with a teal roof, a red lamp and a lit window after dark */
function koban(g, wg, x, z, rot) {
  const parts = [], glow = [];
  parts.push(box(0.34, 0.46, 0.28, PAL.cream2, 0, 0.12 + 0.23, 0)); parts.push(box(0.4, 0.05, 0.34, PAL.roofTeal, 0, 0.12 + 0.485, 0)); parts.push(box(0.34, 0.03, 0.28, PAL.roofTeal, 0, 0.12 + 0.52, 0));
  parts.push(box(0.12, 0.28, 0.02, PAL.wood2, -0.08, 0.12 + 0.14, 0.145)); parts.push(box(0.12, 0.15, 0.02, K.frame, 0.09, 0.12 + 0.27, 0.145));
  glow.push(box(0.1, 0.13, 0.025, PAL.window, 0.09, 0.12 + 0.27, 0.147));
  parts.push(box(0.05, 0.05, 0.05, K.red, 0, 0.12 + 0.56, 0.08)); glow.push(cyl(0.014, 0.014, 0.035, PAL.window, 0, 0.12 + 0.56, 0.105, 6));
  parts.push(box(0.26, 0.07, 0.015, PAL.cream2, 0, 0.12 + 0.41, 0.15)); parts.push(box(0.16, 0.025, 0.01, K.red, 0, 0.12 + 0.41, 0.16));   // sign with a red stripe
  parts.push(box(0.03, 0.03, 0.28, K.frame, -0.18, 0.12 + 0.05, 0)); parts.push(box(0.34, 0.03, 0.06, PAL.concrete, 0, 0.12 + 0.015, 0.17));
  for (const p of parts) { p.rotateY(rot); p.translate(x, 0, z); g.push(p); } for (const p of glow) { p.rotateY(rot); p.translate(x, 0, z); wg.push(p); }
}
function genStation(b, u, g, wg) {
  const { di, dj } = u, y0 = 0.12;
  if (di === 0 && dj === 0) {
    // stairwell down to the platform, open toward +z (south)
    // the pavement round the stairwell, the pit walls and floor; the kit pavilion (src/subway-station.js) with its open
    // stairs is attached in rebuildUnitMesh. Clearance the kit needs: x ±0.235, z -0.34..0.36, nothing under the treads
    g.push(box(0.24, 0.12, 0.98, PAL.sidewalk, -0.37, 0.06, 0)); g.push(box(0.24, 0.12, 0.98, PAL.sidewalk, 0.37, 0.06, 0));
    g.push(box(0.5, 0.12, 0.13, PAL.sidewalk, 0, 0.06, -0.425)); g.push(box(0.5, 0.12, 0.04, PAL.sidewalk, 0, 0.06, 0.47));
    g.push(box(0.5, 0.02, 0.8, PIT, 0, -0.37, 0.05));
    for (const sx of [-0.25, 0.25]) g.push(box(0.02, 0.5, 0.8, PAL.cream2, sx, -0.13, 0.05));
    g.push(box(0.5, 0.5, 0.02, PAL.cream2, 0, -0.13, -0.35));
    g.push(box(0.5, 0.02, 0.06, '#e6c25c', 0, y0 + 0.005, 0.44));   // tactile strip at the top of the stairs
    return;
  }
  if (di === 0) {   // north edge: benches facing the entrance; south edge (in front of the stairs) stays open; a bin and planter on both
    const rot = dj < 0 ? 0 : Math.PI;
    if (dj < 0) {
      bench(g, -0.25, dj * 0.3, rot); bench(g, 0.25, dj * 0.3, rot);
      for (const px of [-0.2, 0.2]) g.push(box(0.03, 0.5, 0.03, PAL.lamp, px, y0 + 0.25, -0.45));   // the station name board (駅名標) behind the benches
      g.push(box(0.56, 0.22, 0.02, PAL.cream2, 0, y0 + 0.46, -0.45)); g.push(box(0.58, 0.24, 0.012, '#4a4340', 0, y0 + 0.46, -0.455));
      g.push(box(0.56, 0.035, 0.022, PAL.roofSage, 0, y0 + 0.54, -0.449)); for (let k = 0; k < 4; k++) g.push(box(0.06, 0.06, 0.01, '#4a4340', -0.18 + k * 0.12, y0 + 0.45, -0.438)); g.push(box(0.4, 0.012, 0.01, '#4a4340', 0, y0 + 0.385, -0.438));
    }
    if (dj > 0) for (const px of [-0.3, 0.3]) addFurniture(g, 'planter', px, y0, 0.38, 0, PAL.cream2);   // two kit flower planters at the kerb in front of the station, either side of the way in
    return;
  }
  if (dj === 0) {   // east / west edges: vending machines facing the plaza
    const rot = di > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (di > 0) {
      vendingMachine(g, wg, 0.3, -0.22, rot, PAL.pink); vendingMachine(g, wg, 0.3, 0.22, rot, PAL.mint);
      g.push(cyl(0.025, 0.03, 1.0, PAL.lamp, 0.4, y0 + 0.5, 0.44, 6)); g.push(box(0.1, 0.03, 0.1, PAL.lamp, 0.4, y0 + 0.015, 0.44));   // the line-mark pillar
      g.push(box(0.24, 0.3, 0.05, PAL.cream2, 0.4, y0 + 1.1, 0.44)); wg.push(box(0.2, 0.26, 0.06, PAL.window, 0.4, y0 + 1.1, 0.44));
      const ring = new THREE.TorusGeometry(0.075, 0.018, 6, 16); ring.translate(0.4, y0 + 1.14, 0.475); g.push(colorize(ring, PAL.roofTeal));
      const ring2 = ring.clone(); ring2.translate(0, 0, -0.07); g.push(ring2);
      g.push(box(0.14, 0.03, 0.005, '#4a4340', 0.4, y0 + 0.99, 0.476)); g.push(box(0.14, 0.03, 0.005, '#4a4340', 0.4, y0 + 0.99, 0.404));
    }
    else { vendingMachine(g, wg, -0.3, -0.2, rot, PAL.sky2); koban(g, wg, -0.28, 0.26, rot); }
    return;
  }
  // corners: planter with a little tree, and a lamp
  g.push(box(0.36, 0.14, 0.36, PAL.wood, di * 0.25, y0 + 0.07, dj * 0.25));
  addNature(g, 'broadleaf', di * 0.25, y0 + 0.13, dj * 0.25, 0.6, u.seed, leafColor(u.seed < 0.5 ? PAL.treePeach : PAL.treeSage));   // a small kit tree in the planter
  g.push(blob(0.09, PAL.bush, di * 0.08, y0 + 0.18, dj * 0.3, 0, 0.8));
  // (the plaza is lit by the street lamps on its ring road and the pavilion's paper lamps; the old tall corner lamps are gone)
  if (di === dj) g.push(cyl(0.07, 0.06, 0.2, RAIL, -di * 0.32, y0 + 0.1, dj * 0.3, 8));   // a bin tucked by the lamp in two corners
}

/** near a water works the garden fills out: fuller green at the front corners and a spill of flowers by the door */
function wateredGarden(g, u) {
  const s = u.seed;
  for (const x of [-0.42, 0.42]) { g.push(blob(0.1, '#7fb069', x, 0.2, 0.38, 0, 0.75)); g.push(blob(0.07, '#8fc078', x - Math.sign(x) * 0.1, 0.18, 0.44, 0, 0.7)); }
  for (let k = 0; k < 5; k++) g.push(blob(0.028, k % 2 ? PAL.flower : (s > 0.5 ? PAL.pink : PAL.cream2), -0.3 + k * 0.15 + (s - 0.5) * 0.06, 0.16, 0.46 - (k % 2) * 0.03, 0, 1));
}
function rebuildUnitMesh(u, pop = false) {
  if (u.mesh) { townGroup.remove(u.mesh); disposeGroup(u.mesh); }
  const b = u.block, g = [], wg = [];
  const isEntrance = b.type === 'station' && u.di === 0 && u.dj === 0;
  u.door = null; LG = []; u.laundry = null;
  if (!isEntrance) g.push(box(0.98, 0.12, 0.98, PAL.sidewalk, 0, 0.06, 0));
  if (b.type === 'station') genStation(b, u, g, wg);
  else if (b.stage < DONE) genConstruction(b, u, g, wg);
  else { finalGen(b, u, g, wg); if (b.renoT > 0) renovationOverlay(b, u, g); if (b.type === 'res' && b.watered) wateredGarden(g, u); }
  const grp = new THREE.Group();
  const body = mergeMesh(g, false); grp.add(body);
  if (wg.length) { const wm = mergeMesh(wg, false, false); wm.material = u.winMat; wm.castShadow = false; grp.add(wm); }
  if (LG.length && b.stage >= DONE) { const lm = mergeMesh(LG, false); grp.add(lm); u.laundry = lm; }   // hung out in the morning, taken in before dusk (daynight.js)
  u.wheel = null; if (b.type === 'farm' && b.kind === 'paddy' && b.stage >= DONE) waterWheel(grp, u);
  if (b.type === 'civic' && b.stage >= DONE && Math.max(0, b.units.indexOf(u)) === 0) {   // the kit model for the zone, on the block's first unit
    let prop = null, s = 1, pos = [0, 0.12, 0];
    if (b.kind === 'substation') { prop = createCivicProp('substation'); pos = [-0.02, 0.12, -0.04]; }
    else if (b.kind === 'waterworks') { prop = createCivicProp('water-tower'); pos = [-0.16, 0.12, 0.02]; }
    else if (b.kind === 'recycling') { prop = createCivicProp('recycling-row'); pos = [0.08, 0.12, 0.22]; }
    else if (b.kind === 'clinic') { prop = createTownService('clinic'); s = 0.95; }
    else if (b.kind === 'firestation') { prop = createTownService('fire-station'); s = 0.95; const pk = prop.getObjectByName('Parked_Kei_Fire_Truck'); if (pk) { pk.visible = !b.truckOut; u.parkedTruck = pk; } }
    else if (b.kind === 'community') { prop = createTownService('community-centre'); s = 0.95; }
    else if (b.kind === 'townhall') {   // the two-cell town hall, centred on the block, its porch to the street
      prop = createTownService('town-hall'); s = 0.95;
      const mx = b.cells.reduce((t, c) => t + cx(c.i), 0) / b.cells.length, mz = b.cells.reduce((t, c) => t + cz(c.j), 0) / b.cells.length, f = u.facing || 0, dx = mx - cx(u.cell.i), dz = mz - cz(u.cell.j);
      pos = [dx * Math.cos(f) - dz * Math.sin(f), 0.12, dx * Math.sin(f) + dz * Math.cos(f)];
    }
    else if (b.kind === 'bathhouse') {   // the landmark bath house, centred on the whole block and scaled to its depth
      prop = createLandmark('bathhouse'); s = b.units.length >= 3 ? 0.6 : 0.55;
      const mx = b.cells.reduce((t, c) => t + cx(c.i), 0) / b.cells.length, mz = b.cells.reduce((t, c) => t + cz(c.j), 0) / b.cells.length, f = u.facing || 0, dx = mx - cx(u.cell.i), dz = mz - cz(u.cell.j);
      pos = [dx * Math.cos(f) - dz * Math.sin(f), 0.12, dx * Math.sin(f) + dz * Math.cos(f)];
    }
    if (prop) { prop.scale.setScalar(s); prop.position.set(...pos); prop.traverse(o => { if (o.isMesh) o.castShadow = true; }); snowKit(prop); grp.add(prop); }
    const nb = createCivicProp('notice-board'); nb.scale.setScalar(0.65); nb.position.set(-0.36, 0.12, 0.36); snowKit(nb); grp.add(nb);   // the community notice board on the pavement corner
  }
  if (b.type === 'shop' && b.fishDay && b.fishDay === Math.floor(S.T / 24) + 1 && Math.max(0, b.units.indexOf(u)) === 0) {   // today's catch from the quay
    const fg = [], dx = (u.door && u.door.x > 0) ? -0.3 : 0.3;
    fg.push(box(0.16, 0.07, 0.12, PAL.roofBlue, dx, 0.155, 0.43)); fg.push(box(0.14, 0.01, 0.1, '#eef3f5', dx, 0.195, 0.43));
    for (let q = 0; q < 4; q++) { const fsh = new THREE.DodecahedronGeometry(0.018); fsh.scale(1.9, 0.45, 0.8); fsh.translate(dx - 0.045 + (q % 2) * 0.05, 0.205, 0.41 + Math.floor(q / 2) * 0.04); fg.push(colorize(fsh, q % 3 ? '#b9c6cc' : '#d9a08a')); }
    const fm = mergeMesh(fg, true); if (fm) grp.add(fm);
  }
  if (b.type === 'shop' && b.produceDay && b.produceDay === Math.floor(S.T / 24) + 1 && Math.max(0, b.units.indexOf(u)) === 0) {   // today's produce from the farm
    const pg = [], dx = (u.door && u.door.x > 0) ? -0.3 : 0.3, flowers = b.kind === 'florist';
    pg.push(box(0.16, 0.07, 0.12, '#b08a62', dx, 0.155, 0.3));
    const cols = flowers ? [PAL.flower, PAL.roofRose, '#e6b84a', PAL.cream2] : ['#d9744f', '#8fb35a', '#e6b84a', '#d98c3f'];
    for (let q = 0; q < 6; q++) pg.push(blob(0.026, cols[q % 4], dx - 0.05 + (q % 3) * 0.05, 0.2, 0.28 + Math.floor(q / 3) * 0.045, 0, 0.9));
    const pm = mergeMesh(pg, true); if (pm) grp.add(pm);
  }
  if (b.type !== 'station') { const gl = makeGlow(0, 0.13, 0.15, 2.4); gl.material = u.glowMat; grp.add(gl); u.glow = gl; }
  else {   // the plaza is lit by its lamps, not by a glow per cell: corner lamps and the two lamps on the entrance arch
    const spots = (!u.di && !u.dj) ? [[-0.285, 0.353, 0.9], [0.285, 0.353, 0.9]] : [];   // the pavilion's two paper lamps
    if (isEntrance) {   // the kit pavilion over the stairwell; its four light meshes take the unit's window glow at night
      const st = createSubwayStation(); st.position.y = 0.12; grp.add(st);
      u.stationLit = STATION_LIGHT_MESHES.map(n => st.getObjectByName(n)).filter(Boolean);
      for (const m of u.stationLit) { m.material.color.copy(u.winMat.color); m.material.emissive.copy(u.winMat.emissive); m.material.emissiveIntensity = u.winMat.emissiveIntensity; m.castShadow = false; }
      snowKit(st, u.stationLit);   // snow on the roof and ledges in winter; the lit panels stay clear
    }
    for (const [gx, gz, gs] of spots) { const gl = makeGlow(gx, 0.135, gz, gs); gl.material = u.glowMat; grp.add(gl); if (!u.glow) u.glow = gl; }
    if (u.di === 0 && u.dj === -1) {   // two lamps behind the benches, either side of the name board, arms reaching over the seats: nobody waits in the dark
      const lg = [], LS = 1.1;
      for (const lx of [-0.42, 0.42]) {
        addNeighbourhood(lg, 'street-lamp', lx, 0.12, -0.44, 0, { scale: LS });
        const hy = 0.12 + 0.828 * LS + 0.02 - 0.03, hz = -0.44 + 0.23 * LS;   // the kit's light point, as the street lamps use it
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.15), lampHeadMat); head.position.set(lx, hy, hz); head.castShadow = false; grp.add(head);
        const cone = new THREE.Mesh(lightCone(lx, hy, hz, 0.05, 0.3, PAL.lampGlow), coneMat); cone.renderOrder = 4; grp.add(cone);
        const gl = makeGlow(lx, 0.135, hz, 1.1); gl.material = lampGlowMat; grp.add(gl);
      }
      const lm = mergeMesh(lg, false); if (lm) grp.add(lm);
    }
  }
  // a notice board at the front corner: "for rent" on a home nobody lives in yet, "help wanted" on a shop or workplace with no
  // staff; daynight.js shows it only while that is so (built once here, just shown and hidden)
  u.notice = null;
  if (b.stage >= DONE && (b.type === 'res' || ((b.type === 'shop' || b.type === 'work') && Math.max(0, b.units.indexOf(u)) === 0)) && b.kind !== 'ryokan') {
    const band = b.type === 'res' ? PAL.roofRose : PAL.roofTeal, ng = [];
    ng.push(cyl(0.011, 0.011, 0.26, PAL.kawara2, 0, 0.13, 0, 5)); ng.push(box(0.15, 0.1, 0.014, PAL.cream2, 0, 0.27, 0.008)); ng.push(box(0.11, 0.026, 0.016, band, 0, 0.29, 0.009)); ng.push(box(0.08, 0.01, 0.016, PAL.kawara2, 0, 0.255, 0.009)); ng.push(box(0.05, 0.01, 0.016, PAL.kawara2, -0.015, 0.24, 0.009));
    const nm = mergeMesh(ng, false); nm.position.set(0.4, 0.12, 0.42); nm.rotation.y = -0.25; nm.visible = false; grp.add(nm); u.notice = nm;
  }
  grp.position.set(cx(u.cell.i), u.cell.h || 0, cz(u.cell.j)); grp.rotation.y = u.facing || 0;
  grp.userData.unit = u; u.mesh = grp; townGroup.add(grp);
  if (pop) u.pop = 1;
}

addEventListener('komachi-look', () => {
  const live = townGroup.children.map(o => o.userData.unit).filter(Boolean);
  for (const u of live) rebuildUnitMesh(u);
});

export { dims, doorLocal, unitDoorPoints, unitLocal, rebuildUnitMesh };
