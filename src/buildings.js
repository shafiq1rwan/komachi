// Komachi — procedural buildings: three zone types × three levels, plus construction stages
import * as THREE from 'three';
import { PAL } from './palette.js';
import { cx, cz, townGroup, disposeGroup } from './scene.js';
import { box, prism, blob, cyl, colorize, mergeMesh, makeGlow } from './geometry.js';
import { K, acUnit, pipe, balcony, extStairs, fence, pots, bicycle, bikeRack, signBoard, plainAwning, stripedAwning, windowPane, door, kawaraRoof, blockWall, genkan, tateKanban, noren, chochin, laundry } from './kit.js';
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
  const L = b.level, { w, d, H } = dims('res', L), y0 = 0.12, metal = b.roofStyle === 'metal', kawara = b.roofStyle === 'kawara';
  u.door = { x: -0.16, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  if (u.seed > 0.5) for (let k = 0; k < 4; k++) g.push(box(w + 0.01, 0.012, d + 0.01, K.siding, 0, y0 + 0.1 + k * 0.12, 0));
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
  pots(g, 0.3, 0.36, 2);
  if (u.seed > 0.55) bicycle(g, -0.4, 0.3, 0.1, K.bike[Math.floor(u.seed * 5) % 5]);
  if (u.seed > 0.75) g.push(box(0.05, 0.3, 0.05, PAL.lamp, 0.42, 0.27, 0.42));
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
  for (let f = 0; f < floors; f++) { const y = y0 + f * fh + 0.3; for (const x of [-0.24, 0.24]) windowPane(g, wg, x, y, -d / 2 - 0.005, 0.16, 0.16, Math.PI); windowPane(g, wg, -w / 2 - 0.005, y, 0.1, 0.14, 0.16, -Math.PI / 2); }
  pipe(g, -w / 2 - 0.02, y0, y0 + H, -0.1);
  bikeRack(g, -0.3, 0.42, 3, 0, u.seed);
  g.push(box(0.9, 0.1, 0.06, PAL.bush, 0, 0.17, -0.44)); pots(g, 0.34, 0.42, 2);
}

// ── shops ──
function genShop(b, u, g, wg) {
  const L = b.level, { w, d, H } = dims('shop', L), y0 = 0.12, [a1, a2] = b.awning, kind = b.kind || 'cafe';
  const doorX = kind === 'konbini' ? 0.22 : kind === 'grocery' ? -0.2 : -0.24;
  u.door = { x: doorX, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  g.push(box(w + 0.1, 0.09, d + 0.1, b.roof, 0, y0 + H + 0.04, 0)); g.push(box(w + 0.14, 0.04, d + 0.14, b.roof, 0, y0 + H + 0.1, 0));
  acUnit(g, -0.2, y0 + H + 0.14, -0.15, 0); pipe(g, -w / 2 - 0.02, y0, y0 + H, -d / 2 + 0.06);
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
      stripedAwning(g, 0, y0 + 0.55, d / 2 + 0.02, w, PAL.roofSage, PAL.cream2);
      for (let k = 0; k < 3; k++) { const x = 0.06 + k * 0.15; g.push(box(0.13, 0.08, 0.12, PAL.wood, x, y0 + 0.04, 0.42)); for (let m = 0; m < 3; m++) g.push(blob(0.03, [PAL.roofPeach, '#8fae78', K.red][(k + m) % 3], x - 0.04 + m * 0.04, y0 + 0.1, 0.42 + (m % 2) * 0.03, 0, 1)); }
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.44, PAL.cream2, PAL.roofSage); tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.55, d / 2 + 0.06, PAL.roofSage, PAL.cream2, false, 0.36);
    } else if (kind === 'florist') {
      stripedAwning(g, 0, y0 + 0.55, d / 2 + 0.02, w, PAL.pink, PAL.cream2);
      for (let k = 0; k < 3; k++) { const x = 0.08 + k * 0.14; g.push(cyl(0.05, 0.04, 0.12, K.metal2, x, y0 + 0.06, 0.42, 7)); g.push(blob(0.06, [PAL.flower, PAL.roofPeach, PAL.lilac][k], x, y0 + 0.16, 0.42, 0, 0.9)); }
      g.push(box(0.03, 0.03, 0.03, K.rail, -0.3, y0 + 0.75, d / 2 + 0.08)); g.push(blob(0.07, PAL.bush2, -0.3, y0 + 0.68, d / 2 + 0.08, 0, 0.9));
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.4, PAL.cream2, PAL.pink);
    } else if (kind === 'bakery') {
      stripedAwning(g, 0, y0 + 0.55, d / 2 + 0.02, w, PAL.roofRose, PAL.cream2);
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.4, PAL.roofPeach, PAL.cream2); g.push(blob(0.045, '#d9a066', 0.13, y0 + H - 0.14, d / 2 + 0.05, 0, 0.7));
      g.push(box(0.14, 0.1, 0.12, PAL.wood, 0.36, y0 + 0.05, 0.42)); g.push(blob(0.04, '#d9a066', 0.36, y0 + 0.12, 0.42, 0, 0.7));
    } else if (kind === 'books') {
      stripedAwning(g, 0, y0 + 0.55, d / 2 + 0.02, w, PAL.roofBlue, PAL.cream2);
      for (let k = 0; k < 5; k++) g.push(box(0.05, 0.12 + (k % 2) * 0.03, 0.03, [PAL.roofRose, PAL.roofBlue, PAL.roofSage, PAL.roofPeach, PAL.lilac][k], -0.02 + k * 0.06, y0 + 0.22, d / 2 + 0.0));
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.4, PAL.cream2, PAL.roofBlue); tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.55, d / 2 + 0.06, PAL.roofBlue, PAL.cream2, false, 0.36);
      g.push(box(0.16, 0.12, 0.14, PAL.wood, 0.38, y0 + 0.06, 0.42)); for (let k = 0; k < 3; k++) g.push(box(0.14, 0.02, 0.1, [PAL.roofRose, PAL.cream2, PAL.roofBlue][k], 0.38, y0 + 0.13 + k * 0.02, 0.42));
    } else {   // café
      stripedAwning(g, 0, y0 + 0.55, d / 2 + 0.02, w, a1, a2);
      if (u.seed > 0.5) noren(g, doorX, y0 + 0.36, d / 2 + 0.03, 0.2, a1, PAL.cream2);        // a kissaten hangs a noren
      tateKanban(g, wg, -w / 2 - 0.07, y0 + 0.55, d / 2 + 0.06, PAL.cream2, a1, false, 0.36);
      g.push(cyl(0.1, 0.1, 0.02, PAL.cream2, 0.32, y0 + 0.2, 0.4, 10)); g.push(cyl(0.015, 0.015, 0.2, K.metal, 0.32, y0 + 0.1, 0.4, 5)); g.push(cyl(0.06, 0.06, 0.015, K.metal, 0.32, y0 + 0.01, 0.4, 8));
      for (const [sx, sz] of [[0.2, 0.44], [0.44, 0.36]]) { g.push(cyl(0.04, 0.04, 0.02, PAL.wood, sx, y0 + 0.12, sz, 8)); g.push(cyl(0.012, 0.012, 0.11, K.metal, sx, y0 + 0.055, sz, 5)); }
      signBoard(g, wg, 0, y0 + H - 0.14, d / 2 + 0.02, 0.36, PAL.cream2, a1);
      g.push(box(0.13, 0.17, 0.02, K.chalk, -0.42, y0 + 0.09, 0.4, 0.3)); g.push(box(0.15, 0.02, 0.02, PAL.wood, -0.42, y0 + 0.18, 0.4, 0.3));
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
  windowPane(g, wg, 0.1, y0 + 0.36, -d / 2 - 0.005, 0.2, 0.16, Math.PI); if (L >= 2) windowPane(g, wg, -0.15, y0 + 0.9, -d / 2 - 0.005, 0.16, 0.16, Math.PI);
  g.push(box(0.08, 0.12, 0.72, PAL.bush, -0.43, 0.18, -0.04));
}

// ── workspaces ──
function genWork(b, u, g, wg) {
  const kind = b.kind || 'office';
  if (kind === 'workshop') return genWorkshop(b, u, g, wg);
  if (kind === 'studio') return genStudio(b, u, g, wg);
  const L = b.level, { w, d, H } = dims('work', L), y0 = 0.12, floors = L + 1;
  u.door = { x: 0, z: d / 2 + 0.02 };
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  g.push(box(w + 0.04, 0.12, d + 0.04, PAL.concrete, 0, y0 + 0.06, 0));
  g.push(box(w + 0.06, 0.07, d + 0.06, b.roof, 0, y0 + H + 0.03, 0));
  for (let f = 0; f < floors; f++) {
    const y = y0 + 0.42 + f * ((H - 0.5) / Math.max(1, floors - 1)) * (floors > 1 ? 1 : 0) + (floors === 1 ? 0.1 : 0);
    if (f === 0) { wg.push(box(0.2, 0.3, 0.03, PAL.window, 0, y0 + 0.27, d / 2 + 0.015)); g.push(box(0.34, 0.04, 0.18, b.roof, 0, y0 + 0.46, d / 2 + 0.09)); for (const x of [-0.16, 0.16]) g.push(box(0.03, 0.34, 0.03, K.mullion, x, y0 + 0.29, d / 2 + 0.06)); wg.push(box(0.03, 0.22, 0.5, PAL.window, w / 2 + 0.015, y0 + 0.3, 0)); continue; }
    wg.push(box(0.6, 0.22, 0.03, PAL.window, 0, y, d / 2 + 0.015)); for (const x of [-0.2, 0, 0.2]) g.push(box(0.025, 0.22, 0.04, K.mullion, x, y, d / 2 + 0.02));
    wg.push(box(0.03, 0.22, 0.5, PAL.window, w / 2 + 0.015, y, 0)); for (const z of [-0.17, 0, 0.17]) g.push(box(0.04, 0.22, 0.025, K.mullion, w / 2 + 0.02, y, z));
    g.push(box(w + 0.03, 0.04, d + 0.03, PAL.concrete, 0, y - 0.15, 0));
  }
  g.push(box(0.16, 0.12, 0.16, PAL.concrete, -0.22, y0 + H + 0.12, -0.15)); g.push(box(0.12, 0.1, 0.16, PAL.concrete, 0.2, y0 + H + 0.11, -0.18));
  acUnit(g, -w / 2 - 0.05, y0 + 0.3, 0.1, -Math.PI / 2); pipe(g, -w / 2 - 0.02, y0, y0 + H, -0.25);
  if (L >= 2) g.push(box(0.3, 0.16, 0.05, PAL.cream2, 0.1, y0 + H + 0.14, 0.2));
  if (L >= 3) { g.push(cyl(0.012, 0.012, 0.5, PAL.lamp, 0.3, y0 + H + 0.3, 0.1, 4)); g.push(blob(0.035, PAL.roofRose, 0.3, y0 + H + 0.56, 0.1, 0, 1)); }
  for (const x of [-0.42, 0.42]) { g.push(box(0.12, 0.12, 0.12, PAL.concrete, x, y0 + 0.06, 0.4)); g.push(blob(0.08, PAL.bush2, x, y0 + 0.16, 0.4, 0, 0.8)); }
  for (let f = 1; f < floors; f++) { const y = y0 + 0.42 + f * ((H - 0.5) / Math.max(1, floors - 1)); wg.push(box(0.5, 0.2, 0.03, PAL.window, 0, y, -d / 2 - 0.015)); wg.push(box(0.03, 0.2, 0.4, PAL.window, -w / 2 - 0.015, y, 0)); }
  bikeRack(g, -0.25, 0.44, 2, 0, u.seed);
  g.push(box(0.9, 0.1, 0.06, PAL.bush, 0, 0.17, -0.44));
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
function renovationOverlay(b, u, g) { const { w, d, H } = dims(b.type, b.level); scaffold(g, w, d, H, 'x'); pallet(g, -0.4, 0.44, 'paint'); cones(g, [[0.44, 0.46]]); }
/** a local (front = +z) point on a unit's cell, in world space, with the unit's facing applied */
function unitLocal(u, lx, lz, y = 0) { const ry = u.facing || 0, s = Math.sin(ry), c = Math.cos(ry); return new THREE.Vector3(cx(u.cell.i) + lx * c + lz * s, y, cz(u.cell.j) - lx * s + lz * c); }

// ───────────────────────────── the station plaza ─────────────────────────────
const RAIL = '#4f6b66', PIT = '#3f3a38';
function bench(g, x, z, rot) {   // faces local +z before rotation
  const parts = [];
  // people are ~0.36 tall with hips at 0.09, so the seat sits at hip height (top 0.10 above the plinth)
  parts.push(box(0.34, 0.03, 0.12, PAL.wood, 0, 0.12 + 0.085, 0));
  parts.push(box(0.34, 0.09, 0.02, PAL.wood, 0, 0.12 + 0.16, -0.055));
  for (const lx of [-0.14, 0.14]) parts.push(box(0.03, 0.07, 0.1, PAL.lamp, lx, 0.12 + 0.035, 0));
  for (const p of parts) { p.rotateY(rot); p.translate(x, 0, z); g.push(p); }
}
function vendingMachine(g, wg, x, z, rot, color) {   // front faces local +z before rotation
  // a real machine stands a head taller than a person: ~0.42 against a 0.36 walker
  const parts = [box(0.23, 0.42, 0.18, color, 0, 0.12 + 0.21, 0), box(0.25, 0.03, 0.2, PAL.concrete, 0, 0.12 + 0.015, 0), box(0.18, 0.07, 0.02, PAL.cream2, 0, 0.12 + 0.09, 0.095)];
  const win = box(0.16, 0.2, 0.02, PAL.window, -0.01, 0.12 + 0.28, 0.095);
  for (const p of parts) { p.rotateY(rot); p.translate(x, 0, z); g.push(p); }
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
function stationLamp(g, wg, x, z) {
  g.push(cyl(0.025, 0.035, 0.95, PAL.lamp, x, 0.12 + 0.475, z, 6)); g.push(box(0.12, 0.05, 0.12, PAL.lamp, x, 0.12 + 0.03, z));
  wg.push(box(0.13, 0.11, 0.13, PAL.window, x, 0.12 + 1.0, z)); g.push(box(0.17, 0.03, 0.17, PAL.lamp, x, 0.12 + 1.07, z));
}
function genStation(b, u, g, wg) {
  const { di, dj } = u, y0 = 0.12;
  if (di === 0 && dj === 0) {
    // stairwell down to the platform, open toward +z (south)
    g.push(box(0.24, 0.12, 0.98, PAL.sidewalk, -0.37, 0.06, 0)); g.push(box(0.24, 0.12, 0.98, PAL.sidewalk, 0.37, 0.06, 0));
    g.push(box(0.5, 0.12, 0.19, PAL.sidewalk, 0, 0.06, -0.395)); g.push(box(0.5, 0.12, 0.04, PAL.sidewalk, 0, 0.06, 0.47));
    g.push(box(0.5, 0.02, 0.76, PIT, 0, -0.3, 0.075));
    for (const sx of [-0.25, 0.25]) g.push(box(0.02, 0.44, 0.76, PAL.cream2, sx, -0.1, 0.075));
    g.push(box(0.5, 0.44, 0.02, PAL.cream2, 0, -0.1, -0.3));
    for (let k = 0; k < 7; k++) g.push(box(0.5, 0.06, 0.11, PAL.concrete, 0, y0 - 0.03 - k * 0.06, 0.4 - k * 0.11));
    g.push(box(0.5, 0.02, 0.12, '#e6c25c', 0, y0 + 0.005, 0.455));   // tactile strip
    for (const sx of [-0.29, 0.29]) {
      g.push(box(0.06, 0.28, 0.8, PAL.cream2, sx, y0 + 0.14, 0.05)); g.push(box(0.03, 0.03, 0.8, RAIL, sx, y0 + 0.34, 0.05));
      for (const rz of [-0.3, 0.05, 0.4]) g.push(box(0.025, 0.1, 0.025, RAIL, sx, y0 + 0.29, rz));
    }
    // an open pavilion over the stairwell: four square pillars, a cream back wall with a window band, and a hipped
    // kawara roof with deep eaves; the station name board hangs on the front eave, with a clock and two paper lamps
    const H = 0.6, dark = '#4a4340';
    for (const px of [-0.42, 0.42]) for (const pz of [-0.4, 0.42]) { g.push(box(0.08, H, 0.08, PAL.cream2, px, y0 + H / 2, pz)); g.push(box(0.1, 0.04, 0.1, PAL.concrete, px, y0 + 0.02, pz)); }
    g.push(box(0.86, H - 0.04, 0.05, PAL.cream2, 0, y0 + (H - 0.04) / 2, -0.42));                                   // back wall
    g.push(box(0.7, 0.16, 0.02, K.frame, 0, y0 + 0.42, -0.4)); wg.push(box(0.66, 0.12, 0.03, PAL.window, 0, y0 + 0.42, -0.395));   // window band, lit at night
    for (const px of [-0.42, 0.42]) g.push(box(0.05, H - 0.04, 0.82, PAL.cream2, px, y0 + (H - 0.04) / 2, 0));       // low side screens along the stairwell
    kawaraRoof(g, 0.86, 0.86, H + 0.06, y0, PAL.kawara, true);                                                       // hip-and-gable tiled roof
    g.push(box(0.9, 0.05, 0.9, PAL.cream2, 0, y0 + H + 0.02, 0));                                                    // ceiling board under the eaves
    // station name board on the front eave: white with a dark frame, a sage band and glyph blocks; lit from inside after dark
    g.push(box(0.64, 0.19, 0.02, dark, 0, y0 + H - 0.1, 0.5)); wg.push(box(0.6, 0.15, 0.03, PAL.window, 0, y0 + H - 0.1, 0.505));
    g.push(box(0.6, 0.035, 0.035, PAL.roofSage, 0, y0 + H - 0.17, 0.51)); for (let k = 0; k < 3; k++) g.push(box(0.07, 0.07, 0.01, dark, -0.16 + k * 0.16, y0 + H - 0.08, 0.525));
    const clock = new THREE.CylinderGeometry(0.07, 0.07, 0.02, 14); clock.rotateX(Math.PI / 2); clock.translate(0.3, y0 + 0.36, 0.44); g.push(colorize(clock, PAL.cream2));
    const rim = new THREE.TorusGeometry(0.07, 0.008, 6, 14); rim.translate(0.3, y0 + 0.36, 0.45); g.push(colorize(rim, dark));
    g.push(box(0.008, 0.05, 0.006, dark, 0.3, y0 + 0.385, 0.455)); g.push(box(0.035, 0.008, 0.006, dark, 0.315, y0 + 0.36, 0.455));   // hands
    for (const lx of [-0.3, 0.3]) { g.push(box(0.01, 0.06, 0.01, dark, lx, y0 + H - 0.03, 0.3)); wg.push(box(0.09, 0.1, 0.09, PAL.window, lx, y0 + H - 0.11, 0.3)); g.push(box(0.1, 0.012, 0.1, dark, lx, y0 + H - 0.055, 0.3)); }   // square paper lamps
    g.push(box(0.3, 0.06, 0.015, PAL.cream2, 0, y0 + 0.5, -0.395)); g.push(box(0.2, 0.02, 0.01, PAL.roofRose, 0, y0 + 0.5, -0.387));   // a small sign inside over the stairs
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
    g.push(box(0.2, 0.1, 0.2, PAL.wood, -0.42, y0 + 0.05, -dj * 0.38)); g.push(blob(0.1, PAL.bush2, -0.42, y0 + 0.16, -dj * 0.38, 0, 0.8)); g.push(blob(0.04, PAL.flower, -0.38, y0 + 0.22, -dj * 0.34, 0, 1));
    for (const tx of [-0.3, 0.1]) g.push(box(0.3, 0.005, 0.3, PAL.cream2, tx, y0 + 0.003, -dj * 0.1));
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
    g.push(box(0.3, 0.005, 0.3, PAL.cream2, -di * 0.1, y0 + 0.003, 0.35));
    return;
  }
  // corners: planter with a little tree, and a lamp
  g.push(box(0.36, 0.14, 0.36, PAL.wood, di * 0.25, y0 + 0.07, dj * 0.25));
  g.push(cyl(0.035, 0.045, 0.3, PAL.wood2, di * 0.25, y0 + 0.28, dj * 0.25, 5)); g.push(blob(0.24, u.seed < 0.5 ? PAL.treePeach : PAL.treeSage, di * 0.25, y0 + 0.5, dj * 0.25, 0, 0.9));
  g.push(blob(0.09, PAL.bush, di * 0.08, y0 + 0.18, dj * 0.3, 0, 0.8));
  stationLamp(g, wg, -di * 0.32, -dj * 0.32);
  if (di === dj) g.push(cyl(0.07, 0.06, 0.2, RAIL, -di * 0.32, y0 + 0.1, dj * 0.3, 8));   // a bin tucked by the lamp in two corners
  g.push(box(0.3, 0.005, 0.3, PAL.cream2, -di * 0.15, y0 + 0.003, dj * 0.15));
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
    const spots = u.di && u.dj ? [[-u.di * 0.32, -u.dj * 0.32, 1.5]] : (!u.di && !u.dj) ? [[-0.2, 0.47, 0.9], [0.2, 0.47, 0.9]] : [];
    for (const [gx, gz, gs] of spots) { const gl = makeGlow(gx, 0.135, gz, gs); gl.material = u.glowMat; grp.add(gl); if (!u.glow) u.glow = gl; }
  }
  grp.position.set(cx(u.cell.i), u.cell.h || 0, cz(u.cell.j)); grp.rotation.y = u.facing || 0;
  grp.userData.unit = u; u.mesh = grp; townGroup.add(grp);
  if (pop) u.pop = 1;
}

export { dims, doorLocal, unitDoorPoints, unitLocal, rebuildUnitMesh };
