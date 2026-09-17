// Komachi — modular building parts shared by every generator: balconies, exterior stairs, AC units,
// pipes, fences, planters, bicycles, signs. All in the unit's local space (front is +z); all push
// vertex-coloured geometry into `g` (body) or `wg` (things that glow at night).
import * as THREE from 'three';
import { PAL, SHIRTS } from './palette.js';
import { box, blob, cyl, prism, colorize } from './geometry.js';

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

// ── Japanese identity pass (Phase 4.8) ──
const shade = (hex, l) => '#' + new THREE.Color(hex).offsetHSL(0, 0, l).getHexString();
/** four-sided frustum: bottom w0×d0 at y=0, top w1×d1 at y=h (the hipped skirt of an irimoya roof) */
function frustum(w0, d0, w1, d1, h, hex) {
  const b = [[-w0 / 2, 0, -d0 / 2], [w0 / 2, 0, -d0 / 2], [w0 / 2, 0, d0 / 2], [-w0 / 2, 0, d0 / 2]], t = [[-w1 / 2, h, -d1 / 2], [w1 / 2, h, -d1 / 2], [w1 / 2, h, d1 / 2], [-w1 / 2, h, d1 / 2]];
  const v = []; const quad = (a, b2, c, d) => v.push(...a, ...b2, ...c, ...a, ...c, ...d);
  for (let k = 0; k < 4; k++) { const n = (k + 1) % 4; quad(b[n], b[k], t[k], t[n]); }
  quad(t[0], t[3], t[2], t[1]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((v.length / 3) * 2), 2)); g.computeVertexNormals(); return colorize(g, hex);
}
/** kawara tile roof on a w×d body of height H: deep eaves, tile courses stepping down each slope, a ridge cap with end tiles.
 *  The ridge runs along x (gable ends face ±x, like the prism roofs). `hip` makes an irimoya: a hipped skirt with a short gable on top. */
export function kawaraRoof(g, w, d, H, y0, color, hip = false) {
  const ew = w + 0.3, ed = d + 0.3, yb = y0 + H - 0.02, dark = shade(color, -0.1), light = shade(color, 0.08);
  g.push(box(ew, 0.035, ed, light, 0, yb, 0));                                    // eaves board
  const course = (z0, y, rise, run, n, len) => {   // tile courses on a slope from (z0, y) rising toward the ridge
    const ang = Math.atan2(rise, run);
    for (let k = 1; k <= n; k++) { const t = k / (n + 1); const c = new THREE.BoxGeometry(len, 0.014, 0.024); c.rotateX(z0 > 0 ? ang : -ang); c.translate(0, y + rise * t + 0.01, z0 * (1 - t)); g.push(colorize(c, dark)); }
  };
  let ridgeY, ridgeLen = ew * 0.96;
  if (hip) {
    const sh = 0.15, tw = w * 0.92, td = d * 0.42; const f = frustum(ew, ed, tw, td, sh, color); f.translate(0, yb + 0.02, 0); g.push(f);
    for (const s of [-1, 1]) course(s * ed / 2, yb + 0.02, sh, (ed - td) / 2, 3, ew * 0.98);
    for (const s of [-1, 1]) { const hc = new THREE.BoxGeometry(0.03, 0.03, ed * 0.5); hc.translate(0, sh / 2 + 0.01, s * (ed + td) / 4); hc.rotateY(s * Math.atan2((ew - tw) / 2, sh) * 0); g.push(colorize(hc, dark)); }   // hip lines (eave to ridge end)
    const gh = 0.17; g.push(prism(tw + 0.04, gh, td + 0.04, color, 0, yb + 0.02 + sh - 0.005, 0));
    for (const s of [-1, 1]) course(s * (td + 0.04) / 2, yb + 0.02 + sh, gh, (td + 0.04) / 2, 2, tw);
    ridgeY = yb + 0.02 + sh + gh; ridgeLen = tw * 0.98;
  } else {
    const rise = 0.36; g.push(prism(ew, rise, ed, color, 0, yb + 0.02, 0));
    for (const s of [-1, 1]) course(s * ed / 2, yb + 0.02, rise, ed / 2, 4, ew * 0.98);
    ridgeY = yb + 0.02 + rise;
  }
  g.push(box(ridgeLen, 0.045, 0.08, dark, 0, ridgeY, 0));                                // ridge cap
  for (const s of [-1, 1]) g.push(box(0.06, 0.08, 0.1, dark, s * ridgeLen / 2, ridgeY + 0.015, 0));   // onigawara end tiles
}
/** low concrete-block wall with a coping and mortar lines; `gap` = [x0, x1] leaves an opening with gate posts and the
 *  sliding gate stood open beside it. Along x at z (a front wall) or along z at x. */
export function blockWall(g, x, z, len, alongX, gap = null, color = K.concrete2, h = 0.16) {
  const at = (o, w, hh, dd, col, y) => g.push(box(alongX ? w : dd, hh, alongX ? dd : w, col, alongX ? x + o : x, y, alongX ? z : z + o));
  const segs = gap ? [[-len / 2, gap[0]], [gap[1], len / 2]] : [[-len / 2, len / 2]];
  for (const [a, b] of segs) {
    const L = b - a, m = (a + b) / 2; if (L < 0.04) continue;
    at(m, L, h, 0.05, color, 0.12 + h / 2); at(m, L + 0.01, 0.015, 0.07, PAL.cream2, 0.12 + h + 0.007);
    for (const yy of [0.055, 0.11]) at(m, L, 0.004, 0.054, '#b5aea2', 0.12 + yy);
  }
  if (gap) {
    for (const gx of gap) at(gx, 0.06, h + 0.08, 0.06, color, 0.12 + (h + 0.08) / 2);
    const gw = gap[1] - gap[0] - 0.06, gm = gap[1] + 0.03 + gw / 2;   // the gate slid open along the wall
    for (let k = 0; k < 6; k++) at(gm - gw / 2 + gw * (k + 0.5) / 6, 0.012, h - 0.03, 0.012, K.rail, 0.12 + h / 2);
    at(gm, gw, 0.012, 0.012, K.rail, 0.12 + h - 0.035); at(gm, gw, 0.012, 0.012, K.rail, 0.12 + 0.03);
  }
}
/** genkan: a stone step in front of the door and a nameplate beside it */
export function genkan(g, x, y0, z, w = 0.22) {
  g.push(box(w, 0.03, 0.1, PAL.concrete, x, y0 + 0.015, z + 0.06));
  g.push(box(0.055, 0.03, 0.008, PAL.cream2, x + w / 2 + 0.03, y0 + 0.22, z)); g.push(box(0.03, 0.006, 0.01, K.chalk, x + w / 2 + 0.03, y0 + 0.22, z + 0.001));
}
/** vertical signboard hung off a front corner: a tall narrow board with stacked glyph blocks; lit behind them at night when `glow` */
export function tateKanban(g, wg, x, y, z, color, accent, glow = false, h = 0.42) {
  g.push(box(0.11, h, 0.035, color, x, y, z)); g.push(box(0.03, 0.03, 0.08, K.metal, x, y + h / 2 - 0.03, z - 0.04));
  if (glow) wg.push(box(0.085, h - 0.05, 0.006, PAL.window, x, y, z + 0.019));
  for (let k = 0; k < 3; k++) g.push(box(0.05, 0.05, 0.008, accent, x, y + h / 2 - 0.09 - k * 0.11, z + 0.024));
}
/** noren: a split cloth hung across the doorway, with a small crest */
export function noren(g, x, y, z, w, color = PAL.indigo, accent = PAL.cream2) {
  g.push(box(w + 0.03, 0.012, 0.012, PAL.wood2, x, y + 0.08, z));
  for (let k = 0; k < 3; k++) g.push(box(w / 3 - 0.008, 0.16, 0.008, color, x - w / 2 + w * (k + 0.5) / 3, y, z + 0.004));
  g.push(box(0.03, 0.03, 0.004, accent, x, y + 0.03, z + 0.009));
}
/** a row of chōchin lanterns: red paper with cream bands that glow at night */
export function chochin(g, wg, x, y, z, n, color = K.lantern) {
  for (let k = 0; k < n; k++) {
    const lx = x + (k - (n - 1) / 2) * 0.13;
    const lan = new THREE.SphereGeometry(0.05, 8, 6); lan.scale(1, 1.3, 1); lan.translate(lx, y, z); g.push(colorize(lan, color));
    for (const dy of [-0.022, 0.022]) wg.push(cyl(0.051, 0.051, 0.014, PAL.window, lx, y + dy, z, 8));
    g.push(box(0.03, 0.02, 0.03, K.chalk, lx, y + 0.072, z)); g.push(box(0.03, 0.02, 0.03, K.chalk, lx, y - 0.072, z)); g.push(box(0.006, 0.06, 0.006, K.chalk, lx, y + 0.11, z));
  }
}
/** washing on a balcony: a pole with shirts and towels, and a futon airing over the rail. Pushed to `lg` so it can be shown by the hour. */
export function laundry(lg, x, y, z, w, seed) {
  const pole = new THREE.CylinderGeometry(0.008, 0.008, w, 5); pole.rotateZ(Math.PI / 2); pole.translate(x, y + 0.33, z); lg.push(colorize(pole, K.metal2));
  const n = Math.max(2, Math.floor(w / 0.09));
  for (let k = 0; k < n; k++) { if ((seed * 13 + k * 2.3) % 1 < 0.3) continue; const col = SHIRTS[(k + Math.floor(seed * 9)) % SHIRTS.length]; lg.push(box(0.055, 0.085 + (k % 2) * 0.02, 0.012, col, x - w / 2 + 0.05 + k * ((w - 0.1) / Math.max(1, n - 1)), y + 0.28, z)); }
  if (seed > 0.35) lg.push(box(0.17, 0.05, 0.05, seed > 0.7 ? PAL.pink : PAL.sky2, x + w / 2 - 0.13, y + 0.135, z));   // futon over the rail
}
