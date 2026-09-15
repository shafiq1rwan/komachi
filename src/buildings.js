// Komachi — procedural buildings: three zone types × three levels, plus construction stages
import * as THREE from 'three';
import { PAL } from './palette.js';
import { cx, cz, townGroup, disposeGroup } from './scene.js';
import { box, prism, blob, cyl, colorize, mergeMesh, makeGlow } from './geometry.js';
import { TYPE_COLOR } from './world.js';

function dims(type, level) {
  if (type === 'res') return { w: 0.72, d: 0.6, H: 0.52 * level + 0.06 };
  if (type === 'shop') return { w: 0.78, d: 0.66, H: 0.62 + (level >= 2 ? 0.5 : 0) };
  return { w: 0.8, d: 0.7, H: 0.95 + (level - 1) * 0.55 };
}
function tiltBox(w, h, d, hex, x, y, z, rx) { const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.translate(x, y, z); return colorize(g, hex); }
const WIN_FRAME = '#8d8378', MULLION = '#9aa4aa', CHALK = '#5a504a';

function genResidential(b, u, g, wg) {
  const L = b.level, { w, d, H } = dims('res', L), y0 = 0.12;
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  g.push(prism(w + 0.2, 0.34, d + 0.22, b.roof, 0, y0 + H - 0.01, 0));
  g.push(box(w + 0.24, 0.05, d + 0.26, b.roof, 0, y0 + H, 0));
  g.push(box(0.2, 0.3, 0.02, WIN_FRAME, -0.16, y0 + 0.15, d / 2 + 0.005)); g.push(box(0.16, 0.27, 0.03, PAL.wood, -0.16, y0 + 0.135, d / 2 + 0.015));
  g.push(box(0.26, 0.03, 0.1, b.roof, -0.16, y0 + 0.31, d / 2 + 0.05));
  for (let f = 0; f < L; f++) {
    const y = y0 + f * 0.52 + (f === 0 ? 0.3 : 0.28);
    const xs = f === 0 ? [0.18] : [-0.16, 0.18];
    for (const x of xs) { g.push(box(0.2, 0.2, 0.02, WIN_FRAME, x, y, d / 2 + 0.005)); wg.push(box(0.16, 0.16, 0.03, PAL.window, x, y, d / 2 + 0.015)); }
    g.push(box(0.02, 0.2, 0.2, WIN_FRAME, w / 2 + 0.005, y, 0.1)); wg.push(box(0.03, 0.16, 0.16, PAL.window, w / 2 + 0.015, y, 0.1));
    if (f === 0) { g.push(box(0.24, 0.05, 0.08, PAL.wood, 0.18, y - 0.12, d / 2 + 0.04)); g.push(blob(0.06, PAL.bush, 0.14, y - 0.06, d / 2 + 0.04, 0, 0.8)); g.push(blob(0.05, PAL.flower, 0.23, y - 0.06, d / 2 + 0.04, 0, 0.8)); }
  }
  if (L >= 2) g.push(box(0.1, 0.28, 0.1, PAL.concrete, -0.2, y0 + H + 0.12, -0.12));
  if (L >= 3) { g.push(box(0.42, 0.04, 0.16, PAL.wood, 0.04, y0 + 0.54, d / 2 + 0.08)); g.push(box(0.42, 0.12, 0.02, PAL.wood2, 0.04, y0 + 0.62, d / 2 + 0.15)); }
  g.push(box(0.9, 0.12, 0.08, PAL.bush, 0, 0.18, -0.43)); g.push(box(0.08, 0.12, 0.7, PAL.bush, -0.43, 0.18, -0.05));
  if (u.seed > 0.5) g.push(blob(0.09, PAL.bush2, 0.38, 0.19, 0.36, 0, 0.8));
  if (u.seed > 0.75) g.push(box(0.05, 0.3, 0.05, PAL.lamp, -0.4, 0.27, 0.4));
}
function genShop(b, u, g, wg) {
  const L = b.level, { w, d, H } = dims('shop', L), y0 = 0.12, [a1, a2] = b.awning;
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  g.push(box(w + 0.1, 0.09, d + 0.1, b.roof, 0, y0 + H + 0.04, 0));
  g.push(box(w + 0.14, 0.04, d + 0.14, b.roof, 0, y0 + H + 0.1, 0));
  g.push(box(0.44, 0.34, 0.02, WIN_FRAME, 0.1, y0 + 0.31, d / 2 + 0.005)); wg.push(box(0.4, 0.3, 0.03, PAL.window, 0.1, y0 + 0.31, d / 2 + 0.015));
  g.push(box(0.2, 0.38, 0.02, WIN_FRAME, -0.24, y0 + 0.19, d / 2 + 0.005)); g.push(box(0.16, 0.34, 0.03, PAL.wood, -0.24, y0 + 0.17, d / 2 + 0.015));
  for (let k = 0; k < 6; k++) g.push(tiltBox(w / 6 + 0.005, 0.03, 0.24, k % 2 ? a2 : a1, -w / 2 + w / 12 + k * (w / 6), y0 + 0.55, d / 2 + 0.1, 0.5));
  g.push(box(w, 0.03, 0.04, a1, 0, y0 + 0.6, d / 2 + 0.02));
  g.push(box(0.36, 0.14, 0.03, PAL.cream2, 0, y0 + H - 0.14, d / 2 + 0.02)); g.push(box(0.2, 0.05, 0.035, a1, 0, y0 + H - 0.14, d / 2 + 0.03));
  if (L >= 2) {
    for (const x of [-0.18, 0.18]) { g.push(box(0.2, 0.2, 0.02, WIN_FRAME, x, y0 + 0.9, d / 2 + 0.005)); wg.push(box(0.16, 0.16, 0.03, PAL.window, x, y0 + 0.9, d / 2 + 0.015)); }
    const disc = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 12); disc.rotateZ(Math.PI / 2); disc.translate(w / 2 + 0.03, y0 + H - 0.25, 0.1); g.push(colorize(disc, a1));
    const disc2 = new THREE.CylinderGeometry(0.1, 0.1, 0.035, 12); disc2.rotateZ(Math.PI / 2); disc2.translate(w / 2 + 0.035, y0 + H - 0.25, 0.1); g.push(colorize(disc2, PAL.cream2));
    g.push(box(0.03, 0.03, 0.2, PAL.lamp, w / 2 + 0.02, y0 + H - 0.1, 0.1));
  }
  if (L >= 3) { g.push(cyl(0.02, 0.02, 0.36, PAL.lamp, 0.18, y0 + H + 0.28, -0.1, 5)); g.push(cyl(0.001, 0.2, 0.09, a1, 0.18, y0 + H + 0.45, -0.1, 8)); g.push(box(0.16, 0.03, 0.16, PAL.wood, 0.18, y0 + H + 0.2, -0.1)); }
  g.push(box(0.13, 0.17, 0.02, CHALK, 0.4, y0 + 0.09, 0.4, 0.3)); g.push(box(0.15, 0.02, 0.02, PAL.wood, 0.4, y0 + 0.18, 0.4, 0.3));
  if (u.seed > 0.45) { g.push(box(0.14, 0.32, 0.12, u.seed > 0.7 ? PAL.pink : PAL.mint, w / 2 + 0.09, y0 + 0.16, -0.12)); wg.push(box(0.09, 0.14, 0.02, PAL.window, w / 2 + 0.09, y0 + 0.22, -0.055)); }
  g.push(box(0.18, 0.1, 0.12, PAL.wood, -0.36, y0 + 0.05, 0.4)); g.push(blob(0.08, PAL.bush, -0.36, y0 + 0.13, 0.4, 0, 0.8));
  g.push(box(0.08, 0.12, 0.72, PAL.bush, -0.43, 0.18, -0.04));
}
function genWork(b, u, g, wg) {
  const L = b.level, { w, d, H } = dims('work', L), y0 = 0.12, floors = L + 1;
  g.push(box(w, H, d, b.wall, 0, y0 + H / 2, 0));
  g.push(box(w + 0.04, 0.12, d + 0.04, PAL.concrete, 0, y0 + 0.06, 0));
  const roofC = b.roof;
  g.push(box(w + 0.06, 0.07, d + 0.06, roofC, 0, y0 + H + 0.03, 0));
  for (let f = 0; f < floors; f++) {
    const y = y0 + 0.42 + f * ((H - 0.5) / Math.max(1, floors - 1)) * (floors > 1 ? 1 : 0) + (floors === 1 ? 0.1 : 0);
    if (f === 0) { wg.push(box(0.2, 0.3, 0.03, PAL.window, 0, y0 + 0.27, d / 2 + 0.015)); g.push(box(0.34, 0.04, 0.18, roofC, 0, y0 + 0.46, d / 2 + 0.09)); for (const x of [-0.16, 0.16]) g.push(box(0.03, 0.34, 0.03, MULLION, x, y0 + 0.29, d / 2 + 0.06)); wg.push(box(0.03, 0.22, 0.5, PAL.window, w / 2 + 0.015, y0 + 0.3, 0)); continue; }
    wg.push(box(0.6, 0.22, 0.03, PAL.window, 0, y, d / 2 + 0.015)); for (const x of [-0.2, 0, 0.2]) g.push(box(0.025, 0.22, 0.04, MULLION, x, y, d / 2 + 0.02));
    wg.push(box(0.03, 0.22, 0.5, PAL.window, w / 2 + 0.015, y, 0)); for (const z of [-0.17, 0, 0.17]) g.push(box(0.04, 0.22, 0.025, MULLION, w / 2 + 0.02, y, z));
    g.push(box(w + 0.03, 0.04, d + 0.03, PAL.concrete, 0, y - 0.15, 0));
  }
  g.push(box(0.16, 0.12, 0.16, PAL.concrete, -0.22, y0 + H + 0.12, -0.15)); g.push(box(0.12, 0.1, 0.16, PAL.concrete, 0.2, y0 + H + 0.11, -0.18));
  if (L >= 2) g.push(box(0.3, 0.16, 0.05, PAL.cream2, 0.1, y0 + H + 0.14, 0.2));
  if (L >= 3) { g.push(cyl(0.012, 0.012, 0.5, PAL.lamp, 0.3, y0 + H + 0.3, 0.1, 4)); g.push(blob(0.035, PAL.roofRose, 0.3, y0 + H + 0.56, 0.1, 0, 1)); }
  for (const x of [-0.42, 0.42]) { g.push(box(0.12, 0.12, 0.12, PAL.concrete, x, y0 + 0.06, 0.4)); g.push(blob(0.08, PAL.bush2, x, y0 + 0.16, 0.4, 0, 0.8)); }
  g.push(box(0.9, 0.1, 0.06, PAL.bush, 0, 0.17, -0.44));
}
function genConstruction(b, u, g) {
  const st = b.stage, { w, d, H } = dims(b.type, b.level), y0 = 0.12;
  if (st === 0) {
    g.push(box(0.82, 0.03, 0.72, PAL.dirt, 0, y0 + 0.015, 0));
    for (const [x, z] of [[-0.38, -0.33], [0.38, -0.33], [-0.38, 0.33], [0.38, 0.33]]) g.push(cyl(0.02, 0.02, 0.22, PAL.wood, x, y0 + 0.11, z, 4));
    g.push(box(0.8, 0.012, 0.012, PAL.cream2, 0, y0 + 0.2, 0.33)); g.push(box(0.012, 0.012, 0.7, PAL.cream2, 0.38, y0 + 0.2, 0));
    g.push(cyl(0.02, 0.02, 0.36, PAL.wood2, 0.3, y0 + 0.18, 0.44, 4)); g.push(box(0.26, 0.16, 0.02, PAL.cream2, 0.3, y0 + 0.36, 0.44)); g.push(box(0.16, 0.03, 0.025, TYPE_COLOR[b.type], 0.3, y0 + 0.38, 0.445));
    g.push(blob(0.1, PAL.dirt, -0.28, y0 + 0.05, 0.3, 0, 0.5));
  } else if (st === 1) {
    g.push(box(w + 0.04, 0.1, d + 0.04, PAL.concrete, 0, y0 + 0.05, 0));
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) g.push(box(0.06, 0.5, 0.06, PAL.wood, x, y0 + 0.35, z));
    g.push(box(w + 0.06, 0.05, 0.06, PAL.wood, 0, y0 + 0.6, d / 2)); g.push(box(w + 0.06, 0.05, 0.06, PAL.wood, 0, y0 + 0.6, -d / 2));
    g.push(blob(0.18, PAL.dirt, 0.34, y0 + 0.06, 0.4, 0, 0.5)); g.push(box(0.14, 0.14, 0.14, PAL.wood2, -0.36, y0 + 0.07, 0.4)); g.push(box(0.12, 0.12, 0.12, PAL.wood2, -0.36, y0 + 0.2, 0.4, 0.4));
  } else {
    const h = H * 0.62;
    g.push(box(w, h, d, PAL.raw, 0, y0 + h / 2, 0));
    for (const [x, z] of [[-w / 2, d / 2], [w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2]]) g.push(box(0.05, h + 0.2, 0.05, PAL.wood, x, y0 + h / 2 + 0.1, z));
    g.push(box(w + 0.05, 0.05, 0.05, PAL.wood, 0, y0 + h + 0.2, d / 2)); g.push(box(0.05, 0.05, d + 0.05, PAL.wood, w / 2, y0 + h + 0.2, 0));
    for (let k = 0; k < 3; k++) g.push(box(0.03, h + 0.15, 0.03, PAL.wood2, -w / 2 + 0.15 + k * 0.2, y0 + h / 2 + 0.07, -d / 2 - 0.02));
    for (const z of [-0.3, 0.3]) g.push(cyl(0.02, 0.02, h + 0.35, PAL.lamp, w / 2 + 0.16, y0 + (h + 0.35) / 2, z, 4));
    g.push(box(0.1, 0.03, 0.72, PAL.wood, w / 2 + 0.16, y0 + h * 0.55, 0));
    g.push(box(0.14, 0.14, 0.14, PAL.wood2, -0.36, y0 + 0.07, 0.4)); g.push(blob(0.12, PAL.dirt, 0.34, y0 + 0.05, 0.42, 0, 0.5));
  }
  g.push(box(0.06, 0.12, 0.72, PAL.bush, -0.43, 0.18, -0.04));
}

// ───────────────────────────── the station plaza ─────────────────────────────
const RAIL = '#4f6b66', PIT = '#3f3a38';
function bench(g, x, z, rot) {   // faces local +z before rotation
  const parts = [];
  parts.push(box(0.44, 0.05, 0.16, PAL.wood, 0, 0.12 + 0.28, 0));
  parts.push(box(0.44, 0.15, 0.03, PAL.wood, 0, 0.12 + 0.4, -0.08));
  for (const lx of [-0.18, 0.18]) parts.push(box(0.04, 0.28, 0.14, PAL.lamp, lx, 0.12 + 0.14, 0));
  for (const p of parts) { p.rotateY(rot); p.translate(x, 0, z); g.push(p); }
}
function vendingMachine(g, wg, x, z, rot, color) {   // front faces local +z before rotation
  const parts = [box(0.2, 0.36, 0.16, color, 0, 0.12 + 0.18, 0), box(0.22, 0.03, 0.18, PAL.concrete, 0, 0.12 + 0.015, 0), box(0.16, 0.06, 0.02, PAL.cream2, 0, 0.12 + 0.08, 0.085)];
  const win = box(0.14, 0.18, 0.02, PAL.window, -0.01, 0.12 + 0.24, 0.085);
  for (const p of parts) { p.rotateY(rot); p.translate(x, 0, z); g.push(p); }
  win.rotateY(rot); win.translate(x, 0, z); wg.push(win);
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
    // arched roof with a cream back wall and two round lamps at the front
    const arch = new THREE.CylinderGeometry(0.43, 0.43, 0.9, 14, 1, true, -Math.PI / 2, Math.PI); arch.rotateX(-Math.PI / 2); arch.translate(0, y0 + 0.3, 0.05); g.push(colorize(arch, b.roof));
    const rim = new THREE.CylinderGeometry(0.46, 0.46, 0.06, 14, 1, true, -Math.PI / 2, Math.PI); rim.rotateX(-Math.PI / 2); rim.translate(0, y0 + 0.3, 0.47); g.push(colorize(rim, b.roof));
    const cap = new THREE.CircleGeometry(0.43, 14, -Math.PI / 2, Math.PI); cap.rotateX(-Math.PI / 2); cap.rotateY(Math.PI); cap.translate(0, y0 + 0.3, -0.4); g.push(colorize(cap, PAL.cream2));
    for (const px of [-0.28, 0.28]) g.push(box(0.06, 0.32, 0.06, PAL.cream2, px, y0 + 0.16, -0.38));
    for (const lx of [-0.2, 0.2]) { const l = new THREE.SphereGeometry(0.06, 8, 6); l.translate(lx, y0 + 0.5, 0.47); wg.push(colorize(l, PAL.window)); }
    g.push(box(0.46, 0.12, 0.03, PAL.cream2, 0, y0 + 0.82, 0.3)); g.push(box(0.3, 0.04, 0.035, b.roof, 0, y0 + 0.82, 0.31));
    return;
  }
  if (di === 0) {   // north / south edges: benches facing the entrance, a bin, a planter
    const rot = dj < 0 ? 0 : Math.PI;
    bench(g, -0.25, dj * 0.3, rot); bench(g, 0.25, dj * 0.3, rot);
    g.push(cyl(0.07, 0.06, 0.2, RAIL, 0.46, y0 + 0.1, -dj * 0.35, 8));
    g.push(box(0.2, 0.1, 0.2, PAL.wood, -0.42, y0 + 0.05, -dj * 0.38)); g.push(blob(0.1, PAL.bush2, -0.42, y0 + 0.16, -dj * 0.38, 0, 0.8)); g.push(blob(0.04, PAL.flower, -0.38, y0 + 0.22, -dj * 0.34, 0, 1));
    for (const tx of [-0.3, 0.1]) g.push(box(0.3, 0.005, 0.3, PAL.cream2, tx, y0 + 0.003, -dj * 0.1));
    return;
  }
  if (dj === 0) {   // east / west edges: vending machines facing the plaza
    const rot = di > 0 ? -Math.PI / 2 : Math.PI / 2;
    if (di > 0) { vendingMachine(g, wg, 0.3, -0.22, rot, PAL.pink); vendingMachine(g, wg, 0.3, 0.22, rot, PAL.mint); }
    else { vendingMachine(g, wg, -0.3, -0.2, rot, PAL.sky2); g.push(cyl(0.07, 0.06, 0.2, RAIL, -0.3, y0 + 0.1, 0.15, 8)); g.push(box(0.03, 0.5, 0.03, PAL.lamp, -0.3, y0 + 0.25, 0.38)); g.push(box(0.26, 0.2, 0.02, PAL.cream2, -0.3, y0 + 0.42, 0.38)); g.push(box(0.2, 0.04, 0.025, PAL.roofRose, -0.3, y0 + 0.46, 0.385)); }
    g.push(box(0.3, 0.005, 0.3, PAL.cream2, -di * 0.1, y0 + 0.003, 0.35));
    return;
  }
  // corners: planter with a little tree, and a lamp
  g.push(box(0.36, 0.14, 0.36, PAL.wood, di * 0.25, y0 + 0.07, dj * 0.25));
  g.push(cyl(0.035, 0.045, 0.3, PAL.wood2, di * 0.25, y0 + 0.28, dj * 0.25, 5)); g.push(blob(0.24, u.seed < 0.5 ? PAL.treePeach : PAL.treeSage, di * 0.25, y0 + 0.5, dj * 0.25, 0, 0.9));
  g.push(blob(0.09, PAL.bush, di * 0.08, y0 + 0.18, dj * 0.3, 0, 0.8));
  stationLamp(g, wg, -di * 0.32, -dj * 0.32);
  g.push(box(0.3, 0.005, 0.3, PAL.cream2, -di * 0.15, y0 + 0.003, dj * 0.15));
}

function rebuildUnitMesh(u, pop = false) {
  if (u.mesh) { townGroup.remove(u.mesh); disposeGroup(u.mesh); }
  const b = u.block, g = [], wg = [];
  const isEntrance = b.type === 'station' && u.di === 0 && u.dj === 0;
  if (!isEntrance) g.push(box(0.98, 0.12, 0.98, PAL.sidewalk, 0, 0.06, 0));
  if (b.type === 'station') genStation(b, u, g, wg);
  else if (b.stage < 3) genConstruction(b, u, g); else (b.type === 'res' ? genResidential : b.type === 'shop' ? genShop : genWork)(b, u, g, wg);
  const grp = new THREE.Group();
  const body = mergeMesh(g, false); grp.add(body);
  if (wg.length) { const wm = mergeMesh(wg, false, false); wm.material = u.winMat; wm.castShadow = false; grp.add(wm); }
  const gl = makeGlow(0, 0.13, 0.15, 2.6); gl.material = u.glowMat; grp.add(gl); u.glow = gl;
  grp.position.set(cx(u.cell.i), 0, cz(u.cell.j)); grp.rotation.y = u.facing || 0;
  grp.userData.unit = u; u.mesh = grp; townGroup.add(grp);
  if (pop) u.pop = 1;
}

export { dims, rebuildUnitMesh };
