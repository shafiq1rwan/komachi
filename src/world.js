// Komachi — the grid: cells, automatic roads, vegetation, lamp posts, and block/unit records
import * as THREE from 'three';
import { PAL, ROOFS, WALLS, SHOP_WALLS, WORK_WALLS, AWNINGS, FAMILY, HOME_SUFFIX, PLACE, SHOP_NAMES, WORK_NAMES, uniqueName } from './palette.js';
import { pick, hash } from './utils.js';
import { S } from './state.js';
import { scene, N, HALF, cx, cz, townGroup } from './scene.js';
import { box, blob, cyl, colorize, mergeMesh, makeGlow, glowMat, lampHeadMat, swayMat } from './geometry.js';
import { isLand, coastDist } from './island.js';
import { biome } from './biome.js';
import { rebuildUnitMesh } from './buildings.js';

const cells = [];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) cells.push({ i, j, type: 'empty', block: null, unit: null, tree: null });
const cell = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? null : cells[j * N + i];
const DIR4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function treeSpec(i, j) {
  const r = hash(j * 3 + 1, i * 5 + 2), r2 = hash(i + 11, j + 7), near = coastDist(cx(i), cz(j)) < 2.6;
  let kind;
  if (near) kind = r < 0.4 ? 'reed' : r < 0.75 ? 'tuft' : 'rock';                       // coastal vegetation
  else kind = r < 0.42 ? (hash(i * 7, j * 3) < biome.pineRatio ? 'pine' : 'tree') : r < 0.78 ? 'bush' : 'flowers';
  return { kind, ox: (r2 - 0.5) * 0.4, oz: (hash(i + 3, j + 9) - 0.5) * 0.4, s: 0.8 + r2 * 0.5, c: r2 };
}
for (const c of cells) {   // water outside the coast; sparse, gently clustered vegetation on land
  if (!isLand(cx(c.i), cz(c.j))) { c.type = 'water'; continue; }
  const h = hash(c.i, c.j), cl = hash(Math.floor(c.i / 4) + 100, Math.floor(c.j / 4) + 100);
  if (h < (0.06 + cl * 0.3) * biome.treeDensity) c.tree = treeSpec(c.i, c.j);
}

let roadMesh = null, decorMesh = null, lampMesh = null, wireMesh = null; const lampHeads = [], lampGlows = [];
const wireMat = new THREE.LineBasicMaterial({ color: '#4a4340', transparent: true, opacity: 0.8 });
const lampGlowMat = glowMat.clone();

function rebuildDecor() {
  if (decorMesh) { townGroup.remove(decorMesh); decorMesh.geometry.dispose(); }
  const g = [];
  for (const c of cells) {
    if (c.type !== 'empty' || !c.tree) continue;
    const t = c.tree, x = cx(c.i) + t.ox, z = cz(c.j) + t.oz;
    if (t.kind === 'tree') {
      const tc = biome.treeColors, col = tc[Math.min(tc.length - 1, Math.floor(t.c * tc.length))];
      g.push(cyl(0.05 * t.s, 0.07 * t.s, 0.5 * t.s, PAL.wood2, x, 0.25 * t.s, z, 5));
      g.push(blob(0.36 * t.s, col, x, 0.62 * t.s, z, 0, 0.95));
      if (t.c > 0.55) g.push(blob(0.2 * t.s, col, x + 0.18 * t.s, 0.45 * t.s, z + 0.12 * t.s, 0, 0.9));
      if (biome.blossom && t.c < 0.85) for (let k = 0; k < 3; k++) g.push(blob(0.035, '#f8dfe6', x + Math.cos(k * 2.3 + t.c * 9) * 0.3, 0.03, z + Math.sin(k * 2.3 + t.c * 9) * 0.3, 0, 0.4));
    } else if (t.kind === 'pine') {
      g.push(cyl(0.05 * t.s, 0.07 * t.s, 0.45 * t.s, PAL.wood2, x, 0.22 * t.s, z, 5));
      g.push(cyl(0.001, 0.36 * t.s, 0.7 * t.s, '#7f9b7a', x, 0.72 * t.s, z, 6)); g.push(cyl(0.001, 0.26 * t.s, 0.5 * t.s, '#8fae78', x, 1.05 * t.s, z, 6));
    } else if (t.kind === 'reed') {
      for (let k = 0; k < 5; k++) g.push(cyl(0.012, 0.02, (0.4 + hash(c.i + k, c.j) * 0.3) * t.s, '#b9c084', x + (hash(k, c.i) - 0.5) * 0.3, 0.2 * t.s, z + (hash(c.j, k) - 0.5) * 0.3, 4));
    } else if (t.kind === 'tuft') {
      g.push(blob(0.16 * t.s, t.c < 0.5 ? '#b9c084' : PAL.bush2, x, 0.08 * t.s, z, 0, 0.5));
    } else if (t.kind === 'rock') {
      g.push(blob(0.16 * t.s, biome.rock[t.c < 0.5 ? 0 : 1], x, 0.06, z, 0, 0.55));
    } else if (t.kind === 'bush') {
      g.push(blob(0.22 * t.s, t.c < 0.5 ? PAL.bush : PAL.bush2, x, 0.14 * t.s, z, 0, 0.7));
      if (t.c > 0.4) g.push(blob(0.15 * t.s, PAL.bush2, x + 0.2 * t.s, 0.1 * t.s, z - 0.1 * t.s, 0, 0.7));
    } else {
      g.push(blob(0.16 * t.s, PAL.bush2, x, 0.09 * t.s, z, 0, 0.55));
      for (let k = 0; k < 3; k++) g.push(blob(0.045, k % 2 ? PAL.flower : PAL.cream2, x + Math.cos(k * 2.1) * 0.1, 0.17 * t.s, z + Math.sin(k * 2.1) * 0.1, 0, 1));
    }
  }
  decorMesh = mergeMesh(g, true); if (decorMesh) { decorMesh.material = swayMat; townGroup.add(decorMesh); }
}

function lotAdjacent4(c) { return DIR4.some(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'lot'; }); }
function lotAdjacent8(c) { for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const n = cell(c.i + di, c.j + dj); if (n && n.type === 'lot') return true; } return false; }

function rebuildRoads() {
  if (roadMesh) { scene.remove(roadMesh); roadMesh.geometry.dispose(); }
  if (lampMesh) { scene.remove(lampMesh); lampMesh.geometry.dispose(); }
  if (wireMesh) { scene.remove(wireMesh); wireMesh.geometry.dispose(); wireMesh = null; }
  const poles = [];
  for (const h of lampHeads) scene.remove(h); for (const g of lampGlows) scene.remove(g); lampHeads.length = 0; lampGlows.length = 0;
  const g = [], lg = [];
  for (const c of cells) {
    if (c.type !== 'road') continue;
    const x = cx(c.i), z = cz(c.j), h = hash(c.i, c.j);
    g.push(box(1, 0.08, 1, PAL.sidewalk, x, 0.04, z));
    const asp = h < 0.5 ? PAL.asphalt : PAL.asphalt2;
    g.push(box(0.62, 0.1, 0.62, asp, x, 0.05, z));
    const nb = DIR4.map(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'road'; });
    if (nb[0]) g.push(box(0.62, 0.1, 0.2, asp, x, 0.05, z - 0.41));
    if (nb[2]) g.push(box(0.62, 0.1, 0.2, asp, x, 0.05, z + 0.41));
    if (nb[1]) g.push(box(0.2, 0.1, 0.62, asp, x + 0.41, 0.05, z));
    if (nb[3]) g.push(box(0.2, 0.1, 0.62, asp, x - 0.41, 0.05, z));
    const deg = nb.filter(Boolean).length;
    if (deg === 2 && h > 0.7) g.push(cyl(0.09, 0.09, 0.02, '#858a8e', x + (h - 0.85) * 0.5, 0.105, z + (h - 0.8) * 0.5, 8));
    // lamp posts near lots, a few crosswalk stripes at junctions
    if (deg >= 3 && h > 0.4) { for (let k = -1; k <= 1; k++) g.push(box(0.08, 0.012, 0.3, PAL.cream2, x + k * 0.16, 0.105, z + (nb[0] ? -0.6 : 0.6) * 0.62)); }
    // utility poles on the corner opposite the lamp; cables are strung between neighbours below
    if (h > 0.2 && h < 0.5 && lotAdjacent4(c)) {
      const d = DIR4.find(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'lot'; });
      const px = x + d[0] * 0.42 - d[1] * 0.38, pz = z + d[1] * 0.42 + d[0] * 0.38;
      lg.push(cyl(0.03, 0.04, 1.75, PAL.concrete, px, 0.95, pz, 6));
      lg.push(box(0.36, 0.03, 0.03, PAL.concrete, px, 1.7, pz, d[0] ? Math.PI / 2 : 0)); lg.push(box(0.3, 0.025, 0.025, PAL.concrete, px, 1.55, pz, d[0] ? Math.PI / 2 : 0));
      for (const o of [-0.14, 0.14]) lg.push(cyl(0.018, 0.018, 0.05, PAL.cream2, px + (d[0] ? 0 : o), 1.74, pz + (d[0] ? o : 0), 5));
      lg.push(box(0.1, 0.16, 0.1, PAL.concrete2, px + (d[0] ? 0 : 0.05), 1.3, pz + (d[0] ? 0.05 : 0)));
      poles.push({ p: new THREE.Vector3(px, 1.72, pz), i: c.i, j: c.j });
    }
    // convex traffic mirror at busier corners
    if (deg >= 3 && h > 0.54 && h <= 0.62 && lotAdjacent4(c)) {
      const d = DIR4.find(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'lot'; });
      const px = x + d[0] * 0.38 + d[1] * 0.3, pz = z + d[1] * 0.38 - d[0] * 0.3;
      lg.push(cyl(0.018, 0.022, 0.85, PAL.lamp, px, 0.5, pz, 5));
      const ring = new THREE.TorusGeometry(0.075, 0.012, 6, 12); ring.rotateX(0.35); ring.rotateY(Math.atan2(-d[0], -d[1])); ring.translate(px, 0.98, pz); lg.push(colorize(ring, '#e9a25a'));
      const disc = new THREE.CylinderGeometry(0.066, 0.066, 0.012, 12); disc.rotateX(Math.PI / 2 + 0.35); disc.rotateY(Math.atan2(-d[0], -d[1])); disc.translate(px, 0.98, pz); lg.push(colorize(disc, '#cfdbe0'));
    }
    // neighbourhood notice board beside residential lots
    if (h > 0.5 && h <= 0.54) {
      const d = DIR4.find(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'lot' && n.block && n.block.type === 'res'; });
      if (d) {
        const px = x + d[0] * 0.36 - d[1] * 0.1, pz = z + d[1] * 0.36 + d[0] * 0.1, ry = Math.atan2(-d[0], -d[1]);
        for (const o of [-0.16, 0.16]) lg.push(cyl(0.015, 0.015, 0.5, PAL.wood2, px + Math.cos(ry) * o, 0.37, pz - Math.sin(ry) * o, 4));
        lg.push(box(0.38, 0.26, 0.025, PAL.cream2, px, 0.5, pz, ry)); lg.push(box(0.42, 0.03, 0.08, PAL.roofSage, px, 0.65, pz, ry));
        lg.push(box(0.1, 0.12, 0.01, PAL.pink, px + Math.cos(ry) * -0.1, 0.5, pz - Math.sin(ry) * -0.1 + Math.sin(ry) * 0 , ry)); lg.push(box(0.12, 0.08, 0.01, PAL.roofBlue, px + Math.cos(ry) * 0.09, 0.52, pz - Math.sin(ry) * 0.09, ry));
      }
    }
    if (h > 0.62 && lotAdjacent4(c)) {
      const d = DIR4.find(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'lot'; });
      const px = x + d[0] * 0.4 + d[1] * 0.35, pz = z + d[1] * 0.4 - d[0] * 0.35;
      lg.push(cyl(0.025, 0.035, 0.95, PAL.lamp, px, 0.55, pz, 6));
      lg.push(box(0.12, 0.05, 0.12, PAL.lamp, px, 0.09, pz));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.13), lampHeadMat); head.position.set(px, 1.08, pz); head.castShadow = false; scene.add(head); lampHeads.push(head);
      lg.push(box(0.17, 0.03, 0.17, PAL.lamp, px, 1.15, pz));
      const gl = makeGlow(px, 0.115, pz, 2.6); gl.material = lampGlowMat; scene.add(gl); lampGlows.push(gl);
    }
  }
  // cables: each pole links to its two nearest neighbours within reach; a few birds perch mid-span
  // cables only run along a street: two poles link if they share a row or column and every cell
  // between them is road, and each pole takes at most one neighbour in each direction
  const pos = [];
  const roadBetween = (a, b) => { const di = Math.sign(b.i - a.i), dj = Math.sign(b.j - a.j); for (let i = a.i + di, j = a.j + dj; i !== b.i || j !== b.j; i += di, j += dj) { const c = cell(i, j); if (!c || c.type !== 'road') return false; } return true; };
  for (let a = 0; a < poles.length; a++) {
    const A0 = poles[a];
    const cands = poles.map((P, k) => ({ k, di: P.i - A0.i, dj: P.j - A0.j })).filter(o => o.k !== a && ((o.di === 0) !== (o.dj === 0)) && Math.abs(o.di + o.dj) <= 5 && (o.di + o.dj) > 0 && roadBetween(A0, poles[o.k]));
    const byDir = { i: null, j: null };
    for (const o of cands) { const key = o.di ? 'i' : 'j'; if (!byDir[key] || Math.abs(o.di + o.dj) < Math.abs(byDir[key].di + byDir[key].dj)) byDir[key] = o; }
    for (const o of [byDir.i, byDir.j]) {
      if (!o) continue; const k = o.k;
      const A = A0.p, B = poles[k].p, segs = 8;
      for (let s = 0; s < segs; s++) for (const t of [s / segs, (s + 1) / segs]) { const sag = Math.sin(t * Math.PI) * 0.16; pos.push(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t - sag, A.z + (B.z - A.z) * t); }
      if (hash(a * 13 + k, k * 7) > 0.55) { const t = 0.35 + hash(k, a) * 0.3, sag = Math.sin(t * Math.PI) * 0.16; lg.push(blob(0.028, '#4a4340', A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t - sag + 0.03, A.z + (B.z - A.z) * t, 0, 0.9)); }
    }
  }
  if (pos.length) { const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); wireMesh = new THREE.LineSegments(wg, wireMat); scene.add(wireMesh); }
  roadMesh = mergeMesh(g, false, false); if (roadMesh) { roadMesh.castShadow = false; scene.add(roadMesh); }
  lampMesh = mergeMesh(lg, false, true); if (lampMesh) scene.add(lampMesh);
}

// ───────────────────────────── blocks & units ─────────────────────────────
const blocks = []; const units = new Map();
const CAP = { res: [0, 2, 4, 6], work: [0, 4, 7, 10], shop: [0, 1, 2, 3] };
const STAGE_HOURS = [3, 5, 6];
const TYPE_LABEL = { res: 'Residential', shop: 'Shop', work: 'Workspace', station: 'Station' };
const TYPE_COLOR = { res: PAL.roofRose, shop: PAL.roofTeal, work: PAL.roofBlue, station: PAL.roofSage };
function unitCap(u) { return CAP[u.block.type][u.block.level] + (u.variant === 'apartment' ? 2 : 0); }
const SHOP_KINDS = ['cafe', 'bakery', 'ramen', 'grocery', 'konbini', 'florist', 'books'];
const WORK_KINDS = ['office', 'workshop', 'studio'];
const KIND_LABEL = { cafe: 'Café', bakery: 'Bakery', ramen: 'Ramen shop', grocery: 'Grocery', konbini: 'Convenience store', florist: 'Florist', books: 'Bookshop', office: 'Office', workshop: 'Workshop', studio: 'Studio', detached: 'Detached house', narrow: 'Narrow house', apartment: 'Apartments' };
function makeUnit(block, c) {
  const u = { id: S.nextId++, block, cell: c, mesh: null, residents: [], staff: [], inside: new Set(), lastMoveIn: S.T, pop: 0, incoming: 0, removed: false,
    winMat: new THREE.MeshStandardMaterial({ color: PAL.window, emissive: PAL.glow, emissiveIntensity: 0, roughness: 0.4 }),
    glowMat: glowMat.clone(), seed: hash(c.i, c.j) };
  c.type = 'lot'; c.block = block; c.tree = null; c.unit = u; block.units.push(u); units.set(u.id, u); return u;
}
function ringRoads(sel) {
  for (const c of sel) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const n = cell(c.i + di, c.j + dj); if (n && n.type === 'empty') { n.type = 'road'; n.tree = null; }
  }
}

// ───────────────────────────── the station ─────────────────────────────
// A 3×3 plaza in the middle of the island. Newcomers arrive by underground train and wait here
// until a home has room. Positions below are world coordinates (cell (17,17) is centred on (0.5, 0.5)).
const SC = { i: HALF, j: HALF };                 // centre cell index
const SX = cx(SC.i), SZ = cz(SC.j);
const BENCH_Y = 0.12 + 0.28;                     // seat top
const STATION = {
  block: null, anchor: null,                     // anchor = the south-edge unit; its cell touches the ring road
  entrance: new THREE.Vector3(SX, 0.12, SZ + 0.9),
  seats: [], stands: [], vending: [],
};
for (const side of [-1, 1]) for (const bx of [-0.25, 0.25]) for (const sx of [-0.11, 0.11])
  STATION.seats.push({ kind: 'seat', pos: new THREE.Vector3(SX + bx + sx, BENCH_Y - 0.09, SZ + side * 1.3), rot: side < 0 ? 0 : Math.PI, taken: null });
for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]])
  STATION.stands.push({ kind: 'stand', pos: new THREE.Vector3(SX + dx * 0.6, 0.12, SZ + dz * 0.6), rot: Math.atan2(-dx, -dz), taken: null });
for (const dz of [-0.22, 0.22]) STATION.vending.push({ pos: new THREE.Vector3(SX + 1.08, 0.12, SZ + dz), rot: Math.PI / 2, taken: null });
STATION.vending.push({ pos: new THREE.Vector3(SX - 1.08, 0.12, SZ - 0.2), rot: -Math.PI / 2, taken: null });

function placeStation() {
  const block = { id: S.nextId++, type: 'station', cells: [], units: [], stage: 3, stageT: 0, level: 1, occT: 0, visitScore: 0, created: S.T,
    roof: PAL.roofSage, wall: PAL.cream2, awning: [PAL.roofSage, PAL.cream2], family: 'Station', name: 'Komachi Station', trains: 0 };
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const c = cell(SC.i + di, SC.j + dj); block.cells.push(c);
    const u = makeUnit(block, c); u.di = di; u.dj = dj; u.facing = 0;
    if (di === 0 && dj === 1) STATION.anchor = u;
  }
  ringRoads(block.cells);
  blocks.push(block); STATION.block = block;
  refreshWorld(); for (const u of block.units) rebuildUnitMesh(u);
  return block;
}

function placeBlock(type, sel) {
  const seed = Math.random();
  const family = pick(FAMILY);
  const block = {
    id: S.nextId++, type, cells: sel.slice(), units: [], stage: 0, stageT: 0, level: 1, occT: 0, visitScore: 0, created: S.T,
    roof: ROOFS[Math.floor(seed * ROOFS.length)],
    wall: type === 'res' ? pick(WALLS) : type === 'shop' ? pick(SHOP_WALLS) : pick(WORK_WALLS),
    awning: pick(AWNINGS), family,
    kind: type === 'shop' ? pick(SHOP_KINDS) : type === 'work' ? pick(WORK_KINDS) : null,
    variant: type === 'res' ? (seed < 0.45 ? 'detached' : seed < 0.75 ? 'narrow' : 'apartment') : null,
    roofStyle: seed < 0.6 ? 'tile' : 'metal',
  };
  block.name = type === 'res' ? `${pick(PLACE)} ${block.variant === 'apartment' ? pick(['Heights', 'Court', 'Residence']) : sel.length > 1 ? 'Terrace' : pick(HOME_SUFFIX)}` : type === 'shop' ? uniqueName(SHOP_NAMES[block.kind]) : uniqueName(WORK_NAMES[block.kind]);
  for (const c of sel) { const u = makeUnit(block, c); if (type === 'res') u.variant = hash(c.i * 3, c.j * 5) < 0.7 ? block.variant : pick(['detached', 'narrow', 'apartment']); }
  ringRoads(sel);
  blocks.push(block);
  for (const u of block.units) u.facing = pickFacing(u);
  refreshWorld(); for (const u of block.units) rebuildUnitMesh(u);
  return block;
}
function pickFacing(u) {
  const order = [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]];
  for (const [di, dj, ry] of order) { const n = cell(u.cell.i + di, u.cell.j + dj); if (n && n.type === 'road') return ry; }
  return 0;
}
const worldListeners = [];
function onWorldChange(fn) { worldListeners.push(fn); }
function refreshWorld() { rebuildRoads(); rebuildDecor(); for (const fn of worldListeners) fn(); }
const isDecor = obj => obj === decorMesh;

export { cells, cell, DIR4, treeSpec, rebuildDecor, rebuildRoads, lotAdjacent4, lotAdjacent8, lampGlowMat,
  blocks, units, CAP, STAGE_HOURS, TYPE_LABEL, TYPE_COLOR, unitCap, placeBlock, pickFacing, refreshWorld, onWorldChange, isDecor,
  STATION, placeStation, KIND_LABEL, wireMat };
