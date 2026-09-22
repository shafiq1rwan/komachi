// Komachi — procedural buildings: three zone types × three levels, plus construction stages
import * as THREE from 'three';
import { PAL } from './palette.js';
import { cx, cz, townGroup, disposeGroup } from './scene.js';
import { box, prism, blob, cyl, colorize, mergeMesh, makeGlow } from './geometry.js';
import { addFurniture } from './street-furniture.js';
import { addNeighbourhood } from './neighbourhood-kits.js';
import { createSubwayStation, STATION_LIGHT_MESHES } from './subway-station.js';
import { addNature } from './nature-kit.js';
import { K, acUnit, pipe, balcony, extStairs, fence, pots, bicycle, bikeRack, signBoard, plainAwning, stripedAwning, windowPane, door, kawaraRoof, blockWall, genkan, tateKanban, noren, chochin, laundry, slatWall, tileBand, corrugated, boxCanopy, hangingSign, dish, latticeWindow, engawa, hisashi, yardProps } from './kit.js';
/** a second, third… independent value derived from a unit's seed, so details vary without correlating */
const sub = (s, k) => { const v = Math.sin(s * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
import { DONE } from './world.js';

let LG = [];   // laundry geometry for the unit being built (its own mesh, shown in the daytime; see rebuildUnitMesh)
function dims(type, level) {
  if (type === 'res') return { w: 0.72, d: 0.6, H: 0.52 * level + 0.06 };
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
    const y = y0 + f * 0.52 + (f === 0 ? 0.3 : 0.28);
    for (const x of (f === 0 ? [0.18] : [-0.16, 0.18])) windowPane(g, wg, x, y, d / 2 + 0.005, 0.16, 0.16);
    windowPane(g, wg, w / 2 + 0.005, y, 0.1, 0.16, 0.16, Math.PI / 2);
    if (f === 0) { g.push(box(0.24, 0.05, 0.08, PAL.wood, 0.18, y - 0.12, d / 2 + 0.04)); g.push(blob(0.06, PAL.bush, 0.14, y - 0.06, d / 2 + 0.04, 0, 0.8)); g.push(blob(0.05, PAL.flower, 0.23, y - 0.06, d / 2 + 0.04, 0, 0.8)); }
  }
  if (L >= 2) { g.push(box(0.1, 0.28, 0.1, PAL.concrete, -0.2, y0 + H + 0.12, -0.12)); balcony(g, 0.04, y0 + 0.54, d / 2 + 0.08, 0.42, 0.16, PAL.wood2); if (u.seed > 0.3) laundry(LG, 0.04, y0 + 0.54, d / 2 + 0.16, 0.42, u.seed); }
  for (let f = 0; f < L; f++) { const y = y0 + f * 0.52 + 0.3; windowPane(g, wg, 0.14, y, -d / 2 - 0.005, 0.16, 0.14, Math.PI); windowPane(g, wg, -w / 2 - 0.005, y, -0.1, 0.14, 0.14, -Math.PI / 2); }
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
  for (let f = 1; f < L; f++) { const y = y0 + f * 0.52 + 0.2; for (const x of [-0.18, 0.16]) { windowPane(g, wg, x, y, d / 2 + 0.005, 0.18, 0.16); g.push(box(0.22, 0.012, 0.03, PAL.wood2, x, y - 0.1, d / 2 + 0.02)); } }   // plain upper windows with a timber sill
  if (L === 1) for (const x of [-0.2, 0.0, 0.2]) g.push(box(0.05, 0.1, 0.02, PAL.cream2, x, y0 + H - 0.14, d / 2 + 0.03));   // mushiko-mado slits under the eaves
  for (let f = 0; f < L; f++) { const y = y0 + f * 0.52 + 0.3; windowPane(g, wg, 0.12, y, -d / 2 - 0.005, 0.16, 0.14, Math.PI); windowPane(g, wg, -w / 2 - 0.005, y, -0.1, 0.14, 0.14, -Math.PI / 2); }
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
    const y = y0 + f * 0.52 + 0.28;
    windowPane(g, wg, -side * 0.12, y, d / 2 + 0.005, 0.44, 0.2);
    balcony(g, side * 0.2, y0 + f * 0.52 + 0.06, d / 2 + 0.08, 0.34, 0.16, K.rail); if (sub(u.seed, 6) > 0.4) laundry(LG, side * 0.2, y0 + f * 0.52 + 0.06, d / 2 + 0.16, 0.34, sub(u.seed, f));
  }
  for (let f = 0; f < L; f++) { const y = y0 + f * 0.52 + 0.3; windowPane(g, wg, 0.1, y, -d / 2 - 0.005, 0.3, 0.16, Math.PI); windowPane(g, wg, -side * (w / 2 + 0.005), y, -0.1, 0.16, 0.16, side > 0 ? -Math.PI / 2 : Math.PI / 2); }
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
function genShop(b, u, g, wg) {
  if (b.kind === 'supermarket') return genSupermarket(b, u, g, wg);
  if (b.kind === 'arcade') return genArcade(b, u, g, wg);
  if (b.kind === 'teahouse') return genTeahouse(b, u, g, wg);
  const L = b.level, { w, d, H } = dims('shop', L), y0 = 0.12, [a1, a2] = b.awning, kind = b.kind || 'cafe';
  const doorX = kind === 'konbini' ? 0.22 : kind === 'grocery' ? -0.2 : -0.24;
  u.door = { x: doorX, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  const finish = u.finish = sub(u.seed, 2) < 0.34 ? 'timber' : sub(u.seed, 2) < 0.67 ? 'tile' : 'render', awnShape = b.popular ? 0.5 : sub(u.seed, 3);   // a busy shop has put up a new striped awning
  if (b.popular) { const sx = doorX > 0 ? -0.3 : 0.3; for (let q = 0; q < 3; q++) g.push(box(0.14, 0.09, 0.12, q === 2 ? PAL.wood : K.frame, sx + (q === 2 ? 0 : (q - 0.5) * 0.15), y0 + 0.045 + (q === 2 ? 0.09 : 0), d / 2 + 0.14)); for (let q = 0; q < 4; q++) g.push(blob(0.03, [PAL.roofPeach, K.red, PAL.treeGreen, PAL.cream2][q], sx - 0.05 + q * 0.035, y0 + 0.16, d / 2 + 0.14, 0, 0.9)); }   // and stock in crates by the door
  if (b.popular) for (const x of [-0.44, 0.44]) { g.push(cyl(0.012, 0.012, 0.6, K.metal2, x, y0 + 0.3, 0.46, 5)); g.push(box(0.09, 0.42, 0.012, x < 0 ? a1 : K.red, x + (x < 0 ? 0.05 : -0.05), y0 + 0.4, 0.46)); g.push(box(0.11, 0.012, 0.012, K.metal2, x + (x < 0 ? 0.05 : -0.05), y0 + 0.6, 0.46)); for (let q = 0; q < 3; q++) g.push(box(0.045, 0.045, 0.006, PAL.cream2, x + (x < 0 ? 0.05 : -0.05), y0 + 0.52 - q * 0.1, 0.467)); }   // nobori banners: a busy shop
  if (finish === 'timber') slatWall(g, w, d, y0 + 0.08, y0 + H - 0.06, sub(u.seed, 4) > 0.5 ? 'x' : '-x', PAL.wood, 0.085);
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
    windowPane(g, wg, 0.1, y0 + 0.31, d / 2 + 0.005, 0.4, 0.3);
    door(g, doorX, y0, d / 2 + 0.005, 0.16, 0.34, kind === 'ramen' ? K.red : PAL.wood);
    if (kind === 'ramen') {
      plainAwning(g, 0, y0 + 0.55, d / 2 + 0.02, w, K.chalk);
      noren(g, doorX, y0 + 0.36, d / 2 + 0.03, 0.2, PAL.indigo, PAL.cream2);                  // split cloth over the door
      chochin(g, wg, 0.08, y0 + 0.41, d / 2 + 0.27, 3);                                         // a row of red lanterns under the awning
      tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.55, d / 2 + 0.06, K.red, PAL.cream2, true);
      for (const x of [0.28, 0.4]) g.push(cyl(0.04, 0.035, 0.12, PAL.wood2, x, y0 + 0.06, 0.42, 6));
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.4, K.red, PAL.cream2, true);
    } else if (kind === 'grocery') {
      awn(0, y0 + 0.55, d / 2 + 0.02, w, PAL.roofSage, PAL.cream2);
      for (let k = 0; k < 3; k++) { const x = 0.06 + k * 0.15; g.push(box(0.13, 0.08, 0.12, PAL.wood, x, y0 + 0.04, 0.42)); for (let m = 0; m < 3; m++) g.push(blob(0.03, [PAL.roofPeach, '#8fae78', K.red][(k + m) % 3], x - 0.04 + m * 0.04, y0 + 0.1, 0.42 + (m % 2) * 0.03, 0, 1)); }
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.44, PAL.cream2, PAL.roofSage); tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.55, d / 2 + 0.06, PAL.roofSage, PAL.cream2, false, 0.36);
    } else if (kind === 'florist') {
      awn(0, y0 + 0.55, d / 2 + 0.02, w, PAL.pink, PAL.cream2);
      for (let k = 0; k < 3; k++) { const x = 0.08 + k * 0.14; g.push(cyl(0.05, 0.04, 0.12, K.metal2, x, y0 + 0.06, 0.42, 7)); g.push(blob(0.06, [PAL.flower, PAL.roofPeach, PAL.lilac][k], x, y0 + 0.16, 0.42, 0, 0.9)); }
      g.push(box(0.03, 0.03, 0.03, K.rail, -0.3, y0 + 0.75, d / 2 + 0.08)); g.push(blob(0.07, PAL.bush2, -0.3, y0 + 0.68, d / 2 + 0.08, 0, 0.9));
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.4, PAL.cream2, PAL.pink);
    } else if (kind === 'bakery') {
      awn(0, y0 + 0.55, d / 2 + 0.02, w, PAL.roofRose, PAL.cream2);
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.4, PAL.roofPeach, PAL.cream2); g.push(blob(0.045, '#d9a066', 0.13, y0 + H - 0.14, d / 2 + 0.05, 0, 0.7));
      g.push(box(0.14, 0.1, 0.12, PAL.wood, 0.36, y0 + 0.05, 0.42)); g.push(blob(0.04, '#d9a066', 0.36, y0 + 0.12, 0.42, 0, 0.7));
    } else if (kind === 'books') {
      awn(0, y0 + 0.55, d / 2 + 0.02, w, PAL.roofBlue, PAL.cream2);
      for (let k = 0; k < 5; k++) g.push(box(0.05, 0.12 + (k % 2) * 0.03, 0.03, [PAL.roofRose, PAL.roofBlue, PAL.roofSage, PAL.roofPeach, PAL.lilac][k], -0.02 + k * 0.06, y0 + 0.22, d / 2 + 0.0));
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.4, PAL.cream2, PAL.roofBlue); tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.55, d / 2 + 0.06, PAL.roofBlue, PAL.cream2, false, 0.36);
      g.push(box(0.16, 0.12, 0.14, PAL.wood, 0.38, y0 + 0.06, 0.42)); for (let k = 0; k < 3; k++) g.push(box(0.14, 0.02, 0.1, [PAL.roofRose, PAL.cream2, PAL.roofBlue][k], 0.38, y0 + 0.13 + k * 0.02, 0.42));
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
  if (u.seed > 0.55 && kind !== 'konbini') { g.push(box(0.14, 0.32, 0.12, u.seed > 0.75 ? PAL.pink : PAL.mint, w / 2 + 0.09, y0 + 0.16, -0.12)); wg.push(box(0.09, 0.14, 0.02, PAL.window, w / 2 + 0.09, y0 + 0.22, -0.055)); }
  if (kind !== 'konbini' && kind !== 'ramen' && sub(u.seed, 5) > 0.5) hangingSign(g, wg, w / 2 - 0.02, y0 + 0.5, d / 2 + 0.02, a1, PAL.cream2, sub(u.seed, 6) > 0.5);   // a round sign off the front corner
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
function finalGen(b, u, g, wg) { (b.type === 'res' ? genResidential : b.type === 'shop' ? genShop : genWork)(b, u, g, wg); }

function genConstruction(b, u, g, wg) {
  const st = b.stage, { w, d, H } = dims(b.type, b.level), y0 = 0.12;
  if (st === 0) {          // surveying: stakes and string, a sign, a heap of earth
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
  addNature(g, 'broadleaf', di * 0.25, y0 + 0.13, dj * 0.25, 0.6, u.seed, u.seed < 0.5 ? PAL.treePeach : PAL.treeSage);   // a small kit tree in the planter
  g.push(blob(0.09, PAL.bush, di * 0.08, y0 + 0.18, dj * 0.3, 0, 0.8));
  // (the plaza is lit by the street lamps on its ring road and the pavilion's paper lamps; the old tall corner lamps are gone)
  if (di === dj) g.push(cyl(0.07, 0.06, 0.2, RAIL, -di * 0.32, y0 + 0.1, dj * 0.3, 8));   // a bin tucked by the lamp in two corners
}

function rebuildUnitMesh(u, pop = false) {
  if (u.mesh) { townGroup.remove(u.mesh); disposeGroup(u.mesh); }
  const b = u.block, g = [], wg = [];
  const isEntrance = b.type === 'station' && u.di === 0 && u.dj === 0;
  u.door = null; LG = []; u.laundry = null;
  if (!isEntrance) g.push(box(0.98, 0.12, 0.98, PAL.sidewalk, 0, 0.06, 0));
  if (b.type === 'station') genStation(b, u, g, wg);
  else if (b.stage < DONE) genConstruction(b, u, g, wg);
  else { finalGen(b, u, g, wg); if (b.renoT > 0) renovationOverlay(b, u, g); }
  const grp = new THREE.Group();
  const body = mergeMesh(g, false); grp.add(body);
  if (wg.length) { const wm = mergeMesh(wg, false, false); wm.material = u.winMat; wm.castShadow = false; grp.add(wm); }
  if (LG.length && b.stage >= DONE) { const lm = mergeMesh(LG, false); grp.add(lm); u.laundry = lm; }   // hung out in the morning, taken in before dusk (daynight.js)
  if (b.type !== 'station') { const gl = makeGlow(0, 0.13, 0.15, 2.4); gl.material = u.glowMat; grp.add(gl); u.glow = gl; }
  else {   // the plaza is lit by its lamps, not by a glow per cell: corner lamps and the two lamps on the entrance arch
    const spots = (!u.di && !u.dj) ? [[-0.285, 0.353, 0.9], [0.285, 0.353, 0.9]] : [];   // the pavilion's two paper lamps
    if (isEntrance) {   // the kit pavilion over the stairwell; its four light meshes take the unit's window glow at night
      const st = createSubwayStation(); st.position.y = 0.12; grp.add(st);
      u.stationLit = STATION_LIGHT_MESHES.map(n => st.getObjectByName(n)).filter(Boolean);
      for (const m of u.stationLit) { m.material.color.copy(u.winMat.color); m.material.emissive.copy(u.winMat.emissive); m.material.emissiveIntensity = u.winMat.emissiveIntensity; m.castShadow = false; }
    }
    for (const [gx, gz, gs] of spots) { const gl = makeGlow(gx, 0.135, gz, gs); gl.material = u.glowMat; grp.add(gl); if (!u.glow) u.glow = gl; }
  }
  grp.position.set(cx(u.cell.i), u.cell.h || 0, cz(u.cell.j)); grp.rotation.y = u.facing || 0;
  grp.userData.unit = u; u.mesh = grp; townGroup.add(grp);
  if (pop) u.pop = 1;
}

export { dims, doorLocal, unitDoorPoints, unitLocal, rebuildUnitMesh };
