// Komachi — modular building parts shared by every generator: balconies, exterior stairs, AC units,
// pipes, fences, planters, bicycles, signs. All in the unit's local space (front is +z); all push
// vertex-coloured geometry into `g` (body) or `wg` (things that glow at night).
import * as THREE from 'three';
import { PAL } from './palette.js';
import { box, blob, cyl, colorize } from './geometry.js';

export const K = {
  metal: '#7d8a94', metal2: '#8fa3ad', rail: '#4f6b66', railDark: '#3f4f4c', grille: '#8a9096', concrete2: '#c9c3b6',
  siding: '#d8c9ad', red: '#c9564b', lantern: '#e0704f', shutter: '#aab2b8', shutterLine: '#8e979d', frame: '#8d8378', mullion: '#9aa4aa', chalk: '#5a504a',
  bike: ['#4a4340', '#8fb0c9', '#d98b7a', '#7f9b7a', '#f3e6cf'],
};

/** wall-mounted air-conditioning unit; ry rotates it onto a side wall */
export function acUnit(g, x, y, z, ry = 0) {
  g.push(box(0.14, 0.11, 0.08, PAL.concrete, x, y, z, ry));
  g.push(box(0.1, 0.07, 0.01, K.grille, x + Math.cos(ry) * 0 + Math.sin(ry) * 0.045, y, z + Math.cos(ry) * 0.045 - Math.sin(ry) * 0, ry));
  g.push(box(0.16, 0.02, 0.1, K.metal, x, y - 0.065, z, ry));
}
/** a vertical drain pipe hugging a wall */
export function pipe(g, x, y0, y1, z) { g.push(cyl(0.014, 0.014, y1 - y0, K.metal2, x, (y0 + y1) / 2, z, 5)); g.push(box(0.04, 0.03, 0.04, K.metal2, x, y0 + 0.05, z)); }
/** balcony slab with railing along its outer (+z) edge, centred on x */
export function balcony(g, x, y, z, w, depth = 0.16, railColor = K.rail) {
  g.push(box(w, 0.035, depth, PAL.concrete, x, y, z));
  g.push(box(w, 0.015, 0.015, railColor, x, y + 0.14, z + depth / 2));
  const n = Math.max(2, Math.round(w / 0.07));
  for (let k = 0; k <= n; k++) g.push(box(0.012, 0.14, 0.012, railColor, x - w / 2 + (w * k) / n, y + 0.07, z + depth / 2));
}
/** exterior staircase climbing along the +x wall from ground to `floors` upper landings */
export function extStairs(g, wx, d, floors, floorH = 0.5, y0 = 0.12) {
  const x = wx + 0.09;
  for (let f = 0; f < floors; f++) {
    const dir = f % 2 === 0 ? 1 : -1, zStart = -dir * (d / 2 - 0.05);
    for (let k = 0; k < 7; k++) { const t = k / 7; g.push(box(0.16, 0.03, 0.09, PAL.concrete, x, y0 + f * floorH + 0.04 + t * floorH, zStart + dir * t * (d - 0.15))); }
    g.push(box(0.16, 0.035, 0.16, PAL.concrete, x, y0 + (f + 1) * floorH + 0.02, -zStart));
    g.push(box(0.012, 0.16, 0.012, K.rail, x + 0.08, y0 + (f + 1) * floorH + 0.1, -zStart));
    g.push(box(0.012, 0.16, 0.012, K.rail, x + 0.08, y0 + f * floorH + 0.12, zStart));
    const rail = new THREE.BoxGeometry(0.012, 0.012, d - 0.15); rail.rotateX(-dir * Math.atan2(floorH, d - 0.15)); rail.translate(x + 0.08, y0 + f * floorH + 0.2 + floorH / 2, 0); g.push(colorize(rail, K.rail));
  }
  for (let f = 1; f <= floors; f++) g.push(box(0.03, 0.03, 0.03, PAL.concrete, x, y0 + f * floorH - 0.02, 0));
  g.push(box(0.03, floors * floorH, 0.03, PAL.concrete, x + 0.06, y0 + floors * floorH / 2, 0));
}
/** low garden fence along a segment (dx or dz extent), wooden or block style */
export function fence(g, x, z, len, alongX, color = PAL.wood, h = 0.12) {
  const n = Math.max(2, Math.round(len / 0.12));
  for (let k = 0; k <= n; k++) { const t = -len / 2 + (len * k) / n; g.push(box(0.02, h, 0.02, color, alongX ? x + t : x, 0.12 + h / 2, alongX ? z : z + t)); }
  g.push(box(alongX ? len : 0.015, 0.015, alongX ? 0.015 : len, color, x, 0.12 + h * 0.8, z));
}
/** a row of potted plants */
export function pots(g, x, z, n, alongX = true, spacing = 0.11) {
  for (let k = 0; k < n; k++) {
    const px = alongX ? x + (k - (n - 1) / 2) * spacing : x, pz = alongX ? z : z + (k - (n - 1) / 2) * spacing;
    g.push(cyl(0.035, 0.028, 0.06, k % 2 ? '#c88b6d' : PAL.cream2, px, 0.15, pz, 6));
    g.push(blob(0.045, k % 3 === 0 ? PAL.flower : PAL.bush2, px, 0.21, pz, 0, 0.9));
  }
}
/** a parked bicycle, standing along its local z axis before rotation */
export function bicycle(g, x, z, rot, color = K.bike[0]) {
  const parts = [];
  for (const wz of [-0.11, 0.11]) { const wheel = new THREE.CylinderGeometry(0.07, 0.07, 0.012, 10); wheel.rotateZ(Math.PI / 2); wheel.translate(0, 0.07, wz); parts.push(colorize(wheel, '#4a4340')); }
  parts.push(box(0.014, 0.014, 0.2, color, 0, 0.11, 0));
  const tube = new THREE.BoxGeometry(0.014, 0.16, 0.014); tube.rotateX(0.5); tube.translate(0, 0.15, 0.04); parts.push(colorize(tube, color));
  parts.push(box(0.014, 0.1, 0.014, color, 0, 0.16, -0.06)); parts.push(box(0.05, 0.015, 0.03, '#4a4340', 0, 0.21, -0.07));
  parts.push(box(0.09, 0.012, 0.012, K.metal2, 0, 0.2, 0.1)); parts.push(box(0.06, 0.04, 0.05, PAL.wood2, 0, 0.19, -0.13));
  for (const p of parts) { p.rotateY(rot); p.translate(x, 0.12, z); g.push(p); }
}
/** a small bike rack with `n` parked bicycles, arranged along local x */
export function bikeRack(g, x, z, n, rot = 0, seed = 0.5) {
  const parts = [];
  parts.push(box(0.12 * n + 0.04, 0.012, 0.012, K.metal, 0, 0.12 + 0.12, 0));
  for (let k = 0; k < n; k++) parts.push(box(0.012, 0.12, 0.012, K.metal, (k - (n - 1) / 2) * 0.12, 0.18, 0));
  for (const p of parts) { p.rotateY(rot); p.translate(x, 0, z); g.push(p); }
  for (let k = 0; k < n; k++) { if ((seed * 7 + k * 1.7) % 1 < 0.75) { const lx = (k - (n - 1) / 2) * 0.12; bicycle(g, x + Math.cos(rot) * lx, z - Math.sin(rot) * lx, rot, K.bike[(k + Math.floor(seed * 5)) % K.bike.length]); } }
}
/** a shop sign board on the front wall: board colour, accent stripe, optional glow strip at night */
export function signBoard(g, wg, x, y, z, w, color, accent, glow = false) {
  g.push(box(w, 0.14, 0.03, color, x, y, z)); g.push(box(w * 0.55, 0.045, 0.035, accent, x, y, z + 0.005));
  if (glow) wg.push(box(w * 0.5, 0.03, 0.02, PAL.window, x, y - 0.045, z + 0.012));
}
/** hanging cloth awning (plain) */
export function plainAwning(g, x, y, z, w, color) { const a = new THREE.BoxGeometry(w, 0.025, 0.24); a.rotateX(0.5); a.translate(x, y, z + 0.1); g.push(colorize(a, color)); g.push(box(w, 0.03, 0.04, color, x, y + 0.05, z)); }
/** striped awning */
export function stripedAwning(g, x, y, z, w, c1, c2) {
  for (let k = 0; k < 6; k++) { const a = new THREE.BoxGeometry(w / 6 + 0.005, 0.03, 0.24); a.rotateX(0.5); a.translate(x - w / 2 + w / 12 + k * (w / 6), y, z + 0.1); g.push(colorize(a, k % 2 ? c2 : c1)); }
  g.push(box(w, 0.03, 0.04, c1, x, y + 0.05, z));
}
/** window with frame; returns nothing, pushes into g and wg */
export function windowPane(g, wg, x, y, z, w, h, ry = 0) {
  g.push(box(w + 0.04, h + 0.04, 0.02, K.frame, x, y, z, ry)); wg.push(box(w, h, 0.03, PAL.window, x, y, z + 0.005, ry));
}
/** a door with frame, small canopy optional */
export function door(g, x, y0, z, w = 0.16, h = 0.27, color = PAL.wood, canopy = null) {
  g.push(box(w + 0.04, h + 0.03, 0.02, K.frame, x, y0 + h / 2 + 0.01, z)); g.push(box(w, h, 0.03, color, x, y0 + h / 2, z + 0.01));
  if (canopy) g.push(box(w + 0.1, 0.03, 0.1, canopy, x, y0 + h + 0.05, z + 0.04));
}
/** corrugated ridges laid across a sloped or flat roof surface (visual only) */
export function ridges(g, x, y, z, w, d, n, color, ry = 0) { for (let k = 0; k < n; k++) g.push(box(0.012, 0.012, d, color, x - w / 2 + (w * (k + 0.5)) / n, y, z, ry)); }
