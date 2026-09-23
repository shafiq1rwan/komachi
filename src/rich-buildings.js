// Reference-inspired coastal neighbourhood. Geometry uses the same one-cell plots,
// door coordinates and separate night-lit window mesh as the simulation's buildings.
import * as THREE from 'three';
import { box, prism, cyl, blob, colorize } from './geometry.js';
import { stripedAwning, acUnit, pots, balcony, genkan, door } from './kit.js';
import { addNeighbourhood } from './neighbourhood-kits.js';

const C = { slate: '#424c58', ridge: '#59636d', trim: '#e6dfcf', frame: '#68675f', glass: '#aabbb7', timber: '#88745e', stone: '#aaa99c', leaf: '#687f4e' };
const pick = (s, a) => a[Math.floor(s * a.length) % a.length];

// Four roof planes meet at a short ridge. Tile courses follow each slope and
// taper with its hip, so the silhouette remains clean at the town camera distance.
function hipRoof(g, w, d, y, rise = 0.25) {
  const a = [-w / 2, y, -d / 2], b = [w / 2, y, -d / 2], c = [w / 2, y, d / 2], e = [-w / 2, y, d / 2];
  const l = [-w * 0.25, y + rise, 0], r = [w * 0.25, y + rise, 0];
  const v = [...a, ...l, ...r, ...a, ...r, ...b, ...e, ...c, ...r, ...e, ...r, ...l, ...a, ...e, ...l, ...b, ...r, ...c];
  const roof = new THREE.BufferGeometry();
  roof.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  roof.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(v.length / 3 * 2), 2));
  roof.computeVertexNormals(); g.push(colorize(roof, C.slate));
  g.push(box(w + 0.015, 0.028, d + 0.015, C.ridge, 0, y - 0.014, 0));
  for (let k = 1; k < 7; k++) {
    const t = k / 7, yy = y + rise * t + 0.004;
    for (const side of [-1, 1]) {
      g.push(box(w * (1 - t * 0.5), 0.008, 0.012, C.ridge, 0, yy, side * d / 2 * (1 - t)));
      g.push(box(0.009, 0.008, d * (1 - t), C.ridge, side * w / 2 * (1 - t * 0.5), yy, 0));
    }
  }
  g.push(box(w * 0.53, 0.033, 0.046, C.ridge, 0, y + rise + 0.009, 0));
}

function window(g, wg, x, y, z, w = 0.14, h = 0.17, rot = 0) {
  const parts = [], glass = [];
  parts.push(box(w + 0.028, h + 0.026, 0.02, C.frame));
  glass.push(box(w, h, 0.012, C.glass, 0, 0, 0.016));
  parts.push(box(0.009, h, 0.014, C.trim, 0, 0, 0.025));
  parts.push(box(w + 0.048, 0.016, 0.045, C.trim, 0, -h / 2 - 0.012, 0.013));
  for (const [list, out] of [[parts, g], [glass, wg]]) for (const p of list) { p.rotateY(rot); p.translate(x, y, z); out.push(p); }
}

function facadeWindows(g, wg, w, d, floors, step, y0, shop = false) {
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * step + step * 0.57;
    if (f > 0 || !shop) for (const x of (f === 0 ? [0.18] : [-0.19, 0.19])) window(g, wg, x, y, d / 2 + 0.003);
    for (const x of [-0.19, 0.19]) window(g, wg, x, y, -d / 2 - 0.003, 0.13, 0.17, Math.PI);
    for (const s of [-1, 1]) for (const z of [-0.16, 0.16]) window(g, wg, s * (w / 2 + 0.003), y, z, 0.13, 0.17, s * Math.PI / 2);
  }
}

function garden(g, u) {
  g.push(box(0.96, 0.012, 0.92, '#a0ae82', 0, 0.127, 0));
  // A clear path from the door to the street, with planted corners and a low boundary.
  g.push(box(0.21, 0.018, 0.21, '#d7d1c2', -0.18, 0.139, 0.38));
  for (const x of [-0.42, 0.42]) {
    g.push(box(0.045, 0.14, 0.79, C.stone, x, 0.19, -0.03));
    for (const z of [-0.37, 0.36]) {
      g.push(cyl(0.075, 0.065, 0.075, C.stone, x, 0.165, z, 8));
      g.push(blob(0.095, C.leaf, x, 0.25, z, 1, 0.85));
    }
  }
  for (const x of [0.06, 0.2, 0.34]) g.push(blob(0.07, '#81955f', x, 0.2, 0.425, 1, 0.8));
  if (u.seed > 0.5) addNeighbourhood(g, 'mailbox', -0.34, 0.13, 0.42, 0, { scale: 0.65 });
}

function house(b, u, g, wg) {
  const floors = u.variant === 'villa' ? 1 : b.level === 3 && u.seed > 0.7 ? 3 : 2;
  const w = 0.7, d = 0.61, step = 0.35, y0 = 0.145, H = floors * step;
  const wall = pick(u.seed, ['#e4ddca', '#d7cdb8', '#eee6d4', '#b7b5a7', '#c7b294']);
  garden(g, u); u.door = { x: -0.18, z: d / 2 + 0.025 };
  g.push(box(w, H, d, wall, 0, y0 + H / 2, 0));
  g.push(box(w + 0.018, 0.085, d + 0.018, C.stone, 0, y0 + 0.042, 0));
  if (u.seed > 0.4) {
    g.push(box(w + 0.008, step - 0.07, d + 0.008, C.timber, 0, y0 + step / 2 + 0.015, 0));
    for (let i = 1; i < 5; i++) g.push(box(w + 0.011, 0.006, d + 0.011, '#9d8970', 0, y0 + 0.055 + i * 0.052, 0));
  }
  for (let f = 1; f < floors; f++) g.push(box(w + 0.023, 0.023, d + 0.023, C.trim, 0, y0 + f * step, 0));
  for (const x of [-w / 2 + 0.018, w / 2 - 0.018]) g.push(box(0.025, H, 0.016, C.timber, x, y0 + H / 2, d / 2 + 0.008));
  facadeWindows(g, wg, w, d, floors, step, y0);
  door(g, -0.18, y0, d / 2 + 0.012, 0.14, 0.265, '#665b4b');
  genkan(g, -0.18, y0, d / 2 + 0.025, 0.19);
  hipRoof(g, w + 0.19, d + 0.2, y0 + H);
  // Small dormer with a plaster front, framed pane and its own gable.
  if (b.level >= 2) {
    const dx = u.seed > 0.5 ? 0.16 : -0.13, yy = y0 + H + 0.12;
    g.push(box(0.16, 0.15, 0.18, wall, dx, yy, 0.2));
    window(g, wg, dx, yy, 0.297, 0.09, 0.1);
    g.push(prism(0.21, 0.075, 0.21, C.slate, dx, yy + 0.073, 0.2, Math.PI / 2));
  }
  const porch = [];
  hipRoof(porch, 0.29, 0.19, y0 + 0.32, 0.065);
  for (const p of porch) { p.translate(-0.18, 0, 0.37); g.push(p); }
  g.push(box(0.065, 0.21, 0.07, '#ad9e87', -0.23, y0 + H + 0.17, -0.17));
  g.push(box(0.09, 0.025, 0.095, C.stone, -0.23, y0 + H + 0.28, -0.17));
  acUnit(g, w / 2 + 0.035, y0 + 0.11, -0.19, Math.PI / 2);
  pots(g, 0.27, 0.35, 2);
}

function shop(b, u, g, wg) {
  const w = 0.76, d = 0.63, y0 = 0.12, floors = b.level > 1 ? 2 : 1, step = 0.39, H = floors * step;
  const wall = pick(u.seed, ['#ded5be', '#d7c2a6', '#e8e2d3', '#c4bbac']);
  const accent = ['ramen', 'restaurant', 'bakery'].includes(b.kind) ? '#bd715a' : pick(u.seed, ['#b47b5f', '#708879', '#bd8f59']);
  u.door = { x: -0.24, z: d / 2 + 0.022 };
  g.push(box(w, H, d, wall, 0, y0 + H / 2, 0));
  facadeWindows(g, wg, w, d, floors, step, y0, true);
  window(g, wg, 0.095, y0 + 0.17, d / 2 + 0.005, 0.39, 0.23);
  window(g, wg, -0.24, y0 + 0.145, d / 2 + 0.008, 0.13, 0.27);
  g.push(box(w + 0.025, 0.065, 0.035, C.timber, 0, y0 + 0.035, d / 2 + 0.015));
  stripedAwning(g, 0, y0 + 0.36, d / 2 + 0.018, w + 0.03, accent, '#eee5d1');
  g.push(box(0.45, 0.072, 0.025, C.timber, 0, y0 + 0.46, d / 2 + 0.02));
  // A simple inset crest and small fascia divisions read as shop signage at this scale.
  for (let i = -2; i <= 2; i++) g.push(box(0.032, 0.023, 0.005, C.trim, i * 0.064, y0 + 0.46, d / 2 + 0.036));
  hipRoof(g, w + 0.13, d + 0.13, y0 + H + (floors === 1 ? 0.11 : 0), 0.22);
  if (floors === 1) g.push(box(w, 0.11, d, wall, 0, y0 + H + 0.055, 0));
  addNeighbourhood(g, 'a-board', 0.34, y0, 0.43, -0.15, { scale: 0.55 });
  pots(g, -0.4, 0.39, b.kind === 'florist' ? 4 : 2);
  if (b.kind === 'grocery' || b.kind === 'supermarket') addNeighbourhood(g, 'drink-crates', 0.2, y0, 0.42, 0, { scale: 0.55 });
  acUnit(g, 0.18, y0 + H + 0.13, -0.12);
}

function midrise(b, u, g, wg) {
  const residential = b.type === 'res', floors = Math.min(5, b.level + (residential ? 1 : 2));
  const w = 0.74, d = 0.65, step = 0.34, y0 = 0.12, H = floors * step;
  const wall = pick(u.seed, ['#c4c2b9', '#d9d6cb', '#aaa99f', '#e1dfd4']);
  u.door = { x: 0, z: d / 2 + 0.025 };
  g.push(box(w, H, d, wall, 0, y0 + H / 2, 0));
  for (let f = 0; f < floors; f++) {
    const yy = y0 + f * step;
    g.push(box(w + 0.032, 0.026, d + 0.032, '#e6e3d8', 0, yy + step - 0.016, 0));
    for (const x of [-0.23, 0, 0.23]) if (f || x) window(g, wg, x, yy + 0.19, d / 2 + 0.005, 0.125, 0.18);
    for (const s of [-1, 1]) for (const z of [-0.19, 0.08]) window(g, wg, s * (w / 2 + 0.005), yy + 0.19, z, 0.14, 0.18, s * Math.PI / 2);
    for (const x of [-0.22, 0.1]) window(g, wg, x, yy + 0.19, -d / 2 - 0.005, 0.14, 0.18, Math.PI);
    if (residential && f > 0) balcony(g, 0, yy + 0.035, d / 2 + 0.075, 0.58, 0.11, '#8c928e');
  }
  window(g, wg, 0, y0 + 0.15, d / 2 + 0.008, 0.16, 0.28);
  g.push(box(0.32, 0.028, 0.16, C.ridge, 0, y0 + 0.32, d / 2 + 0.06));
  g.push(box(w + 0.025, 0.025, d + 0.025, '#b7b9b3', 0, y0 + H, 0));
  for (const s of [-1, 1]) {
    g.push(box(w + 0.025, 0.095, 0.026, C.trim, 0, y0 + H + 0.047, s * d / 2));
    g.push(box(0.026, 0.095, d, C.trim, s * w / 2, y0 + H + 0.047, 0));
  }
  g.push(box(0.23, 0.16, 0.2, wall, -0.17, y0 + H + 0.08, -0.13));
  g.push(box(0.26, 0.025, 0.23, C.trim, -0.17, y0 + H + 0.172, -0.13));
  acUnit(g, 0.17, y0 + H + 0.02, 0.04);
  pots(g, -0.34, 0.4, 2); pots(g, 0.34, 0.4, 2);
}

export function genRichBuilding(b, u, g, wg) {
  if (b.type === 'shop') shop(b, u, g, wg);
  else if (b.type === 'work' || ['apartment', 'manshon'].includes(u.variant)) midrise(b, u, g, wg);
  else house(b, u, g, wg);
}
