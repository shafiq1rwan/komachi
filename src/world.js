// Komachi — the grid: cells, automatic roads, vegetation, lamp posts, and block/unit records
import * as THREE from 'three';
import { PAL, ROOFS, WALLS, SHOP_WALLS, WORK_WALLS, AWNINGS, FAMILY, HOME_SUFFIX, PLACE, SHOP_NAMES, WORK_NAMES, CIVIC_NAMES, FARM_NAMES, uniqueName } from './palette.js';
import { pick, hash } from './utils.js';
import { S } from './state.js';
import { scene, N, HALF, cx, cz, townGroup } from './scene.js';
import { box, blob, cyl, prism, colorize, mergeMesh, makeGlow, glowMat, lampHeadMat, swayMat, coneMat, lightCone } from './geometry.js';
import { TERRACE, hillCentre, cellHash, isCanal, isCoastRoad } from './island.js';
import { toast } from './toast.js';
import { isLand, coastDist, terraceInfo } from './island.js';
import { biome } from './biome.js';
import { rebuildUnitMesh } from './buildings.js';
import { addNature } from './nature-kit.js';
import { furnitureGeometry, addFurniture } from './street-furniture.js';
import { addNeighbourhood } from './neighbourhood-kits.js';
import { richStreetDetails } from './rich-streets.js';
import { record } from './chronicle.js';
import { leafColor, setTreeSpots } from './seasons.js';

addEventListener('komachi-look', () => { rebuildRoads(); rebuildDecor(); });

const cells = [];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) cells.push({ i, j, type: 'empty', block: null, unit: null, tree: null, h: 0, ramp: null, keep: false, dyn: false, link: false, canal: false, bridge: false, coast: false });
const cell = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? null : cells[j * N + i];
/** ground height under a world point: terrace height, or a slope across a ramp cell */
function terrainY(x, z) {
  const c = cell(Math.floor(x + HALF), Math.floor(z + HALF)); if (!c) return 0;
  if (c.ramp) { const { di, dj, h0, h1 } = c.ramp; const s = Math.max(0, Math.min(1, (x - cx(c.i)) * di + (z - cz(c.j)) * dj + 0.5)); return h0 + (h1 - h0) * s; }
  return c.h || 0;
}
const DIR4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const K_DARK = '#4a4340';
function treeSpec(i, j) {
  const r = hash(j * 3 + 1, i * 5 + 2), r2 = hash(i + 11, j + 7), near = coastDist(cx(i), cz(j)) < 2.6;
  let kind;
  if (near) kind = r < 0.4 ? 'reed' : r < 0.75 ? 'tuft' : 'rock';                       // coastal vegetation
  else { const r3 = hash(i + 5, j + 13); kind = r < 0.42 ? (hash(i * 7, j * 3) < biome.pineRatio ? 'pine' : r3 < 0.2 ? 'matsu' : r3 < 0.3 ? 'bamboo' : 'tree') : r < 0.78 ? 'bush' : 'flowers'; }   // a fifth of the trees are pruned pines, a tenth bamboo
  return { kind, ox: (r2 - 0.5) * 0.4, oz: (hash(i + 3, j + 9) - 0.5) * 0.4, s: 0.8 + r2 * 0.5, c: r2 };
}
for (const c of cells) {   // water outside the coast; sparse, gently clustered vegetation on land
  if (!isLand(cx(c.i), cz(c.j))) { c.type = 'water'; continue; }
  const ti = terraceInfo(c.i, c.j);
  if (ti) {   // the hill: flat terrace cells are plots at their terrace height; the island's slope roads open with the hill; the rest is wild
    c.h = ti.level * TERRACE;
    if (ti.ramp) { c.type = 'hill'; c.pendingRamp = ti.ramp; c.keep = true; continue; }
    if (ti.keep) { c.type = 'hill'; c.keep = true; continue; }
    if (ti.wild) { c.type = 'hill'; continue; }
  }
  if (isCanal(c.i, c.j)) { c.canal = true; c.type = 'canal'; if (isCoastRoad(c.i, c.j)) { c.type = 'road'; c.bridge = true; c.keep = true; c.coast = true; } continue; }
  if (isCoastRoad(c.i, c.j)) { c.type = 'road'; c.keep = true; c.coast = true; continue; }
  const h = hash(c.i, c.j), cl = hash(Math.floor(c.i / 4) + 100, Math.floor(c.j / 4) + 100);
  if (h < (S.look === 'rich' ? 0.22 + cl * 0.45 : 0.06 + cl * 0.3) * biome.treeDensity) c.tree = treeSpec(c.i, c.j);
}
// the shrine approach (sandō): the cells on the line from the summit shrine down the hill, below the summit itself and other than the
// island's slope road, stay open as a flagstone path. Nothing is zoned or drawn there, and the plot market and its lanes leave it alone
for (let k = 1; k <= 9; k++) {
  const { x, z, fx, fz, top } = hillCentre, c = cell(Math.floor(x + fx * k + HALF), Math.floor(z + fz * k + HALF));
  if (!c || !((c.h || 0) > 0)) break;
  if ((c.h || 0) >= top - 1e-6 || c.keep || c.pendingRamp) continue;
  c.landmark = 'shrine-path'; c.type = 'empty'; c.tree = null;
}
/** A bridge spans the canal wherever roads face each other across it; a bridge nobody needs goes back to water. */
function connectCanal() {
  const road = c => c && c.type === 'road' && !c.canal;
  for (const c of cells) {
    if (!c.canal || c.keep) continue;
    const span = [[1, 0], [0, 1]].some(([di, dj]) => road(cell(c.i + di, c.j + dj)) && road(cell(c.i - di, c.j - dj)));
    if (span && c.type === 'canal') { c.type = 'road'; c.bridge = true; }
    else if (!span && c.bridge) { c.type = 'canal'; c.bridge = false; }
  }
}

const puddleSpots = []; let puddleVersion = 0;   // flat street cells that hold a puddle after rain: {x, z, s, ry}
let roadMesh = null, decorMesh = null, lampMesh = null, wireMesh = null, coneMesh = null; const lampHeads = [], lampGlows = [];
// traffic lights: every crossroads gets a signal with its own cycle, offset by its position so neighbouring crossings do not
// switch together. Each axis runs green, amber, then a moment of all-red before the other axis goes green.
const SIGNAL_PERIOD = 1.2;   // game hours: 12 real seconds at 1× (about 5 s of green each way), and the lights keep cycling while time is fast-forwarded
const signalCells = new Set();
const PW = 0.16, PO = 0.5 - PW / 2;   // pavement width and its centre's offset from the road cell's centre: the kerb is 0.34 out, so each lane is 0.34 wide (decided 2026-09-24)
const LAMP_TINT = { Red: ['#e0665a', '#ff5a4a'], Amber: ['#e8c26a', '#ffb43a'], Green: ['#6fcf9a', '#4fe08a'] };
const signalLamps = new Map();   // crossing cell → its six lamp materials { nsRed, nsAmber, nsGreen, ewRed, ewAmber, ewGreen }
const signalMeshes = [];
let signalT = -1;
/** 'green' | 'amber' | 'red' for traffic travelling along the axis ('ns' or 'ew') through this crossing */
function signalState(c, axis) {
  const t = ((S.T / SIGNAL_PERIOD + hash(c.i * 7 + 3, c.j * 11 + 5)) % 1 + 1) % 1, own = axis === 'ns' ? t : (t + 0.5) % 1;
  return own < 0.4 ? 'green' : own < 0.47 ? 'amber' : 'red';
}
function updateSignals() {
  if (S.T === signalT) return; signalT = S.T;
  for (const [c, m] of signalLamps) for (const axis of ['ns', 'ew']) {
    const st = signalState(c, axis);
    m[axis + 'Red'].emissiveIntensity = st === 'red' ? 1.6 : 0; m[axis + 'Amber'].emissiveIntensity = st === 'amber' ? 1.8 : 0; m[axis + 'Green'].emissiveIntensity = st === 'green' ? 1.6 : 0;
  }
}
/** is the light against traffic travelling along the given axis at this cell (red or amber)? */
const signalRed = (c, axis) => signalCells.has(c) && signalState(c, axis) !== 'green';
const wireMat = new THREE.LineBasicMaterial({ color: '#4a4340', transparent: true, opacity: 0.8 });
const lampGlowMat = glowMat.clone();

let hillDecorMesh = null;
const landmarkTrees = [];   // cherries landmarks.js plants round the park pavilion: { x, z, s, color, seed }, drawn with the decor
const parkCells = new Set();   // empty cells carrying a pocket park (rebuilt with the decor)
function rebuildDecor() {
  if (decorMesh) { townGroup.remove(decorMesh); decorMesh.geometry.dispose(); }
  if (hillDecorMesh) { townGroup.remove(hillDecorMesh); hillDecorMesh.geometry.dispose(); hillDecorMesh = null; }
  const g = [], gh = [];
  // woods on the wild hill cells: denser than the flat land, heavier on pines, kept off the summit clearing
  for (const c of cells) {
    if (c.type !== 'hill' || c.keep) continue;   // the island's future roads and slopes stay clear
    if (!(c.h > 0)) continue;
    const { i, j } = c, y = c.h, x0 = cx(i), z0 = cz(j), n = 2 + (cellHash(i + 7, j + 3) < 0.5 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const x = x0 + (cellHash(i + k * 5, j + 11) - 0.5) * 0.7, z = z0 + (cellHash(i + 17, j + k * 3) - 0.5) * 0.7;
      if (Math.hypot(x - hillCentre.x, z - hillCentre.z) < 1.5) continue;
      const s = 0.7 + cellHash(i * 3 + k, j) * 0.5, r = cellHash(i, j * 7 + k);
      if (r < 0.45) { gh.push(cyl(0.05 * s, 0.07 * s, 0.45 * s, PAL.wood2, x, y + 0.22 * s, z, 5)); gh.push(cyl(0.001, 0.34 * s, 0.7 * s, '#7f9b7a', x, y + 0.72 * s, z, 6)); gh.push(cyl(0.001, 0.24 * s, 0.5 * s, '#8fae78', x, y + 1.05 * s, z, 6)); }
      else if (r < 0.85) { const tc = biome.treeColors, col = tc[Math.floor(cellHash(i + 1, j + 1 + k) * tc.length)]; gh.push(cyl(0.05 * s, 0.07 * s, 0.5 * s, PAL.wood2, x, y + 0.25 * s, z, 5)); gh.push(blob(0.34 * s, col, x, y + 0.6 * s, z, 0, 0.95)); }
      else gh.push(blob(0.2 * s, r < 0.92 ? PAL.bush : PAL.bush2, x, y + 0.12 * s, z, 0, 0.7));
    }
  }
  // a closed hill: a striped barrier and a no-entry sign at the foot of every slope road, so the wooded hill reads as shut, not unfinished
  if (!hill.open) for (const c of cells) {
    if (!c.pendingRamp || c.type !== 'hill') continue;
    const { di, dj, h0, h1 } = c.pendingRamp, low = h0 <= h1 ? -1 : 1, x = cx(c.i) + low * di * 0.36, z = cz(c.j) + low * dj * 0.36, y = Math.min(h0, h1), px = -dj, pz = di;
    for (const s of [-1, 1]) for (const t of [-0.05, 0.05]) { const leg = new THREE.BoxGeometry(0.025, 0.3, 0.025); leg.rotateX(dj ? 0 : t * 5); leg.rotateZ(di ? 0 : t * 5); leg.translate(x + px * s * 0.28 + di * t * 1.4, y + 0.15, z + pz * s * 0.28 + dj * t * 1.4); gh.push(colorize(leg, '#4a4340')); }
    for (let k = 0; k < 6; k++) { const o = -0.3 + 0.05 + k * 0.1; gh.push(box(di ? 0.03 : 0.1, 0.06, di ? 0.1 : 0.03, k % 2 ? '#4a4340' : '#e6c25c', x + px * o, y + 0.24, z + pz * o)); }
    gh.push(box(di ? 0.02 : 0.16, 0.16, di ? 0.16 : 0.02, PAL.cream2, x, y + 0.42, z)); gh.push(box(di ? 0.025 : 0.13, 0.13, di ? 0.13 : 0.025, '#c9564b', x, y + 0.42, z)); gh.push(box(di ? 0.03 : 0.1, 0.03, di ? 0.1 : 0.03, PAL.cream2, x, y + 0.42, z));   // no-entry disc
    gh.push(box(0.02, 0.32, 0.02, '#4a4340', x, y + 0.5 - 0.16 + 0.0, z));
  }
  // pocket parks: a gravel pad with a swing, a slide, a bench and a hedge on some empty cells beside a street near homes
  parkCells.clear();
  const resNear = c => { for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const n = cell(c.i + di, c.j + dj); if (n && n.type === 'lot' && n.block && n.block.type === 'res') return true; } return false; };
  for (const c of cells) {
    if (c.type !== 'empty' || c.h || c.landmark || cellHash(c.i * 3 + 11, c.j * 7 + 5) > 0.2 || !DIR4.some(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'road'; }) || !resNear(c)) continue;
    if ([...parkCells].some(p => Math.abs(p.i - c.i) + Math.abs(p.j - c.j) < 5)) continue;
    parkCells.add(c); const x = cx(c.i), z = cz(c.j), m = '#7d8a94';
    gh.push(box(0.88, 0.02, 0.88, PAL.dirt, x, 0.01, z));
    for (const s of [-1, 1]) { for (const t of [-0.05, 0.05]) { const leg = new THREE.BoxGeometry(0.02, 0.36, 0.02); leg.rotateX(t * 6); leg.translate(x - 0.22 + s * 0.2, 0.18, z - 0.2 + t * 1.6); gh.push(colorize(leg, m)); } }   // swing frame
    gh.push(box(0.44, 0.02, 0.02, m, x - 0.22, 0.36, z - 0.2));
    for (const s of [-1, 1]) { gh.push(box(0.07, 0.015, 0.04, PAL.wood, x - 0.22 + s * 0.09, 0.12, z - 0.2)); for (const q of [-1, 1]) gh.push(box(0.006, 0.23, 0.006, m, x - 0.22 + s * 0.09 + q * 0.03, 0.245, z - 0.2)); }
    gh.push(box(0.03, 0.26, 0.03, m, x + 0.3, 0.13, z - 0.3)); gh.push(box(0.03, 0.26, 0.03, m, x + 0.3, 0.13, z - 0.14)); gh.push(box(0.12, 0.02, 0.2, PAL.roofBlue, x + 0.3, 0.27, z - 0.22));   // slide: ladder tower and a sloped chute
    for (let k = 0; k < 4; k++) gh.push(box(0.1, 0.012, 0.012, m, x + 0.3, 0.06 + k * 0.06, z - 0.22));
    const chute = new THREE.BoxGeometry(0.12, 0.02, 0.4); chute.rotateX(-0.6); chute.translate(x + 0.3, 0.16, z + 0.02); gh.push(colorize(chute, PAL.roofBlue));
    gh.push(box(0.3, 0.025, 0.1, PAL.wood, x - 0.2, 0.19, z + 0.3)); for (const s of [-1, 1]) gh.push(box(0.03, 0.07, 0.08, PAL.lamp, x - 0.2 + s * 0.12, 0.035, z + 0.3));   // bench
    for (let k = 0; k < 4; k++) gh.push(blob(0.1, k % 2 ? PAL.bush : PAL.bush2, x - 0.36 + k * 0.24, 0.08, z - 0.42, 0, 0.7));   // hedge along the back
    gh.push(cyl(0.03, 0.04, 0.3, PAL.wood2, x + 0.34, 0.15, z + 0.32, 5)); gh.push(blob(0.2, biome.treeColors[0], x + 0.34, 0.4, z + 0.32, 0, 0.9));
  }
  // the sandō: pale flagstones up the middle of each reserved approach cell, gravel either side, a low stone lantern pair at its top
  for (const c of cells) {
    if (c.landmark !== 'shrine-path') continue;
    const x = cx(c.i), z = cz(c.j), y = (c.h || 0), { fx, fz } = hillCentre, sx = -fz, sz = fx;
    gh.push(box(fx ? 0.96 : 0.46, 0.012, fz ? 0.96 : 0.46, '#d8d2c2', x, y + 0.006, z));
    for (let k = -2; k <= 2; k++) gh.push(box(fx ? 0.16 : 0.3, 0.016, fz ? 0.16 : 0.3, k % 2 ? '#bdb6a6' : '#c9c2b2', x + fx * k * 0.19, y + 0.014, z + fz * k * 0.19));
    for (const s of [-1, 1]) { const lx = x + sx * s * 0.34, lz = z + sz * s * 0.34; gh.push(cyl(0.025, 0.035, 0.14, PAL.concrete, lx, y + 0.07, lz, 6)); gh.push(box(0.08, 0.06, 0.08, PAL.concrete, lx, y + 0.17, lz)); gh.push(box(0.11, 0.02, 0.11, PAL.concrete, lx, y + 0.21, lz)); }
    for (const s of [-1, 1]) gh.push(blob(0.09, PAL.bush, x + sx * s * 0.42 + fx * 0.3, y + 0.06, z + sz * s * 0.42 + fz * 0.3, 0, 0.7));
  }
  const treeSpots = [];   // crowns the season's leaves fall from: broadleaf and cherry only
  for (const c of cells) {
    if (c.type !== 'empty' || !c.tree || parkCells.has(c) || c.landmark) continue;
    const g0 = g.length;
    const t = c.tree;
    let kind = t.kind; if (kind === 'bamboo') { for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const n = cell(c.i + di, c.j + dj); if (n && n.type === 'road') kind = 'tree'; } }   // tall culms beside a street looked as if they stood on it
    let x = cx(c.i) + t.ox, z = cz(c.j) + t.oz;
    for (const [di, dj] of DIR4) { const n = cell(c.i + di, c.j + dj); if (n && n.canal) { if (kind === 'tree' || kind === 'matsu' || kind === 'bamboo') kind = 'bush'; x = cx(c.i) - di * 0.28 + (di ? 0 : t.ox); z = cz(c.j) - dj * 0.28 + (dj ? 0 : t.oz); } }   // beside the canal: a bush set back from the bank, never a canopy over the water
    // trees come from the nature kit (src/nature-kit.js): one deterministic model per cell, scaled 0.85–1.25 and tinted from the biome
    const seed = hash(c.i * 7 + 3, c.j * 11 + 5), ks = t.s * (0.85 + t.c * 0.4);
    if (kind === 'matsu') {
      addNature(g, 'matsu', x, 0, z, ks, seed, t.c < 0.5 ? '#6f8f6a' : '#7f9b7a');
    } else if (kind === 'bamboo') {
      addNature(g, 'bamboo', x, 0, z, ks, seed, t.c < 0.5 ? '#9db87f' : '#a9c08a');
    } else if (kind === 'tree') {
      const tc = biome.treeColors, col = tc[Math.min(tc.length - 1, Math.floor(t.c * tc.length))];
      addNature(g, biome.blossom && t.c < 0.85 ? 'cherry' : 'broadleaf', x, 0, z, ks, seed, leafColor(col));
      treeSpots.push({ x, z, y: (c.h || 0) + 0.72 * ks, s: ks, color: col });
    } else if (t.kind === 'pine') {
      addNature(g, 'pine', x, 0, z, ks, seed, t.c < 0.5 ? '#7f9b7a' : '#8fae78');
    } else if (t.kind === 'reed') {
      for (let k = 0; k < 5; k++) g.push(cyl(0.012, 0.02, (0.4 + hash(c.i + k, c.j) * 0.3) * t.s, '#b9c084', x + (hash(k, c.i) - 0.5) * 0.3, 0.2 * t.s, z + (hash(c.j, k) - 0.5) * 0.3, 4));
    } else if (t.kind === 'tuft') {
      g.push(blob(0.16 * t.s, t.c < 0.5 ? '#b9c084' : PAL.bush2, x, 0.08 * t.s, z, 0, 0.5));
    } else if (t.kind === 'rock') {
      addNature(g, 'rock', x, 0, z, 0.7 * t.s, hash(c.i, c.j + 9), biome.rock[t.c < 0.5 ? 0 : 1]);
    } else if (t.kind === 'bush') {
      g.push(blob(0.22 * t.s, t.c < 0.5 ? PAL.bush : PAL.bush2, x, 0.14 * t.s, z, 0, 0.7));
      if (t.c > 0.4) g.push(blob(0.15 * t.s, PAL.bush2, x + 0.2 * t.s, 0.1 * t.s, z - 0.1 * t.s, 0, 0.7));
    } else {
      g.push(blob(0.16 * t.s, PAL.bush2, x, 0.09 * t.s, z, 0, 0.55));
      for (let k = 0; k < 3; k++) g.push(blob(0.045, k % 2 ? PAL.flower : PAL.cream2, x + Math.cos(k * 2.1) * 0.1, 0.17 * t.s, z + Math.sin(k * 2.1) * 0.1, 0, 1));
    }
    if (c.h) { for (let k = g0; k < g.length; k++) { g[k].translate(0, c.h, 0); gh.push(g[k]); } g.length = g0; }   // raised plots do not sway
  }
  for (const t of landmarkTrees) { addNature(g, 'cherry', t.x, 0, t.z, t.s, t.seed, leafColor(t.color)); treeSpots.push({ x: t.x, z: t.z, y: 0.72 * t.s, s: t.s, color: t.color }); }
  setTreeSpots(treeSpots);
  decorMesh = mergeMesh(g, true); if (decorMesh) { decorMesh.material = swayMat; townGroup.add(decorMesh); }
  hillDecorMesh = mergeMesh(gh, true); if (hillDecorMesh) townGroup.add(hillDecorMesh);
}

function lotAdjacent4(c) { return DIR4.some(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'lot'; }); }
function lotAdjacent8(c) { for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const n = cell(c.i + di, c.j + dj); if (n && n.type === 'lot') return true; } return false; }

function rebuildRoads() {
  if (roadMesh) { scene.remove(roadMesh); roadMesh.geometry.dispose(); }
  if (lampMesh) { scene.remove(lampMesh); lampMesh.geometry.dispose(); }
  const keepHeads = lampHeads.filter(h => h.userData.lantern), keepGlows = lampGlows.filter(g => g.userData.lantern);
  if (coneMesh) { scene.remove(coneMesh); coneMesh.geometry.dispose(); coneMesh = null; }
  const cones = [];
  if (wireMesh) { scene.remove(wireMesh); wireMesh.geometry.dispose(); wireMesh = null; }
  const poles = [];
  for (const m of signalMeshes) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } signalMeshes.length = 0; signalCells.clear(); signalLamps.clear();
  const lampGeo = new Map();   // crossing cell → lens geometry per axis and colour
  for (const h of lampHeads) if (!h.userData.lantern) scene.remove(h); for (const g of lampGlows) if (!g.userData.lantern) scene.remove(g); lampHeads.length = 0; lampGlows.length = 0; lampHeads.push(...keepHeads); lampGlows.push(...keepGlows);
  const g = [], lg = [];
  // a light only where two through-streets cross (every arm runs straight for two cells); other crossroads get stop lines
  const rdAt = (i, j) => { const n = cell(i, j); return !!n && n.type === 'road'; };
  for (const c of cells) if (c.type === 'road' && !c.ramp && !c.bridge && DIR4.every(([di, dj]) => rdAt(c.i + di, c.j + dj) && rdAt(c.i + 2 * di, c.j + 2 * dj))) signalCells.add(c);
  for (const c of cells) {
    if (c.type !== 'road') continue;
    const x = cx(c.i), z = cz(c.j), h = hash(c.i, c.j);
    const asp = PAL.asphalt;   // one shade everywhere (the two-tone patchwork read as different roads)
    if (c.ramp) {   // a slope road up to the next terrace: tilted asphalt with a pavement band each side
      const { di, dj, h0, h1 } = c.ramp, dh = h1 - h0, L = Math.hypot(1, dh), ang = Math.atan2(dh, 1), ry = Math.atan2(di, dj);
      const tilt = geo => { geo.rotateX(-ang); geo.rotateY(ry); return geo; };
      const a = tilt(new THREE.BoxGeometry(1, 0.08, L)); a.translate(x, h0 + dh / 2 + 0.04, z); g.push(colorize(a, PAL.asphalt));
      for (const sgn of [-1, 1]) { const b = tilt(new THREE.BoxGeometry(PW, 0.1, L)); b.translate(x + dj * PO * sgn, h0 + dh / 2 + 0.05, z - di * PO * sgn); g.push(colorize(b, PAL.sidewalk)); }
      for (const o of [-0.25, 0.25]) { const d = tilt(new THREE.BoxGeometry(0.03, 0.004, 0.22)); d.translate(x + di * o, h0 + dh / 2 + dh * o + 0.082, z + dj * o); g.push(colorize(d, PAL.cream2)); }
      if (c.dyn) {   // a slope the town built: it needs the earth wedge the island gives its own slopes
        const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0.5, dh); sh.closePath();
        const wedge = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); wedge.translate(0, 0, -0.5); wedge.rotateY(Math.atan2(-dj, di)); wedge.translate(x, h0, z); g.push(colorize(wedge, PAL.landSide));
      }
      continue;
    }
    const gy = c.h || 0, g0 = g.length, lg0 = lg.length, hd0 = lampHeads.length, gl0 = lampGlows.length, cn0 = cones.length, po0 = poles.length;
    if (c.bridge) {   // a deck over the canal: asphalt, a pavement each side, railings, and stone piers down to the water
      // the deck runs across the water: if the canal continues east/west of this cell the bridge runs north–south, and
      // vice versa; at a bend (canal on both axes) or a dead end, fall back to the side that has a street
      const cn = (i, j) => { const n = cell(i, j); return !!n && n.canal; }, rd = (i, j) => { const n = cell(i, j); return !!n && n.type === 'road' && !n.canal; };
      const canalX = cn(c.i + 1, c.j) || cn(c.i - 1, c.j), canalZ = cn(c.i, c.j + 1) || cn(c.i, c.j - 1);
      const along = canalX !== canalZ ? (canalX ? 1 : 0) : (rd(c.i, c.j + 1) || rd(c.i, c.j - 1) ? 1 : 0);   // 0: bridge runs east–west, 1: north–south
      g.push(box(1, 0.035, 1, PAL.asphalt, x, 0.0625, z));   // a thin deck held clear of the water, so the canal runs on beneath; no centre line on a bridge
      // pavements along the deck; a railing on every side that has no street, so a bridge on a bend stays open where the road turns
      for (const s of [-1, 1]) { const sx = along ? s * PO : 0, sz = along ? 0 : s * PO; g.push(box(along ? PW : 1, 0.055, along ? 1 : PW, PAL.sidewalk, x + sx, 0.0725, z + sz)); }
      for (const [di, dj] of DIR4) {
        if (rd(c.i + di, c.j + dj)) continue;
        const rx = x + di * 0.445, rz = z + dj * 0.445;
        for (const t of [-0.4, -0.2, 0, 0.2, 0.4]) g.push(box(0.025, 0.14, 0.025, PAL.lamp, rx + (di ? 0 : t), 0.17, rz + (dj ? 0 : t)));
        g.push(box(di ? 0.03 : 1, 0.025, dj ? 0.03 : 1, PAL.roofRose, rx, 0.245, rz));
        if (cn(c.i + di, c.j + dj)) for (const t of [-0.3, 0.3]) g.push(box(0.09, 0.14, 0.09, PAL.concrete2, x + di * 0.36 + (di ? 0 : t), -0.02, z + dj * 0.36 + (dj ? 0 : t)));   // piers on the water sides
      }
      continue;
    }
    // a street opens toward a neighbouring road only at the same height, or along a slope road's axis (as routing does)
    const axisOK = (r, di, dj) => !!r && Math.abs(r.di) === Math.abs(di) && Math.abs(r.dj) === Math.abs(dj);
    const nb = DIR4.map(([di, dj]) => { const n = cell(c.i + di, c.j + dj); if (!n || n.type !== 'road') return false; return (c.h || 0) === (n.h || 0) || axisOK(c.ramp, di, dj) || axisOK(n.ramp, di, dj); });
    // a road cell whose neighbour is a parallel road (two blocks placed two cells apart) is one half of a
    // two-lane avenue: asphalt runs straight across the shared edge with a dashed centre line on it
    const road = q => q && q.type === 'road';
    const dbl = DIR4.map(([di, dj], k) => {
      if (!nb[k]) return false; const n = cell(c.i + di, c.j + dj), pi = di ? 0 : 1, pj = di ? 1 : 0;
      const fixed = q => (q.keep && !(q.coast && !q.slip)) || q.dyn || q.link;   // the coast road may pair with a street drawn beside it; the ring and slip may not
      if (fixed(c) || fixed(n) || (c.h || 0) !== (n.h || 0)) return false;   // slope roads and links beside a ring road are not an avenue
      // the pair must end at c and n: across two side-by-side streets it does, along either street it does not (the next cell of a
      // street has its partner beside it too, which alone once made every cell edge along an avenue read as a shared one)
      if (road(cell(c.i - di, c.j - dj)) || road(cell(n.i + di, n.j + dj))) return false;
      return (road(cell(c.i + pi, c.j + pj)) && road(cell(n.i + pi, n.j + pj))) || (road(cell(c.i - pi, c.j - pj)) && road(cell(n.i - pi, n.j - pj)));
    });
    const open = nb.map((v, k) => v && !dbl[k]);
    // asphalt fills the cell (top 0.08); raised sidewalk bands (top 0.10) sit on the closed edges, with
    // corner squares so the pavement wraps around junction corners; an avenue edge has no pavement at all
    g.push(box(1, 0.08, 1, dbl.some(Boolean) ? PAL.asphalt : asp, x, 0.04, z));   // one shade across an avenue, no seam
    for (let k = 0; k < 4; k++) { const [di, dj] = DIR4[k]; if (!open[k] && !dbl[k]) g.push(box(di ? PW : 1, 0.1, di ? 1 : PW, PAL.sidewalk, x + di * PO, 0.05, z + dj * PO)); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const kx = sx > 0 ? 1 : 3, kz = sz > 0 ? 2 : 0; if (!dbl[kx] && !dbl[kz]) g.push(box(PW, 0.1, PW, PAL.sidewalk, x + sx * PO, 0.05, z + sz * PO)); }
    for (let k = 0; k < 4; k++) if (dbl[k]) {   // dashed centre line on the shared edge of an avenue, drawn once
      const [di, dj] = DIR4[k];
      if (di + dj > 0) for (const o of [-0.25, 0.25]) g.push(box(di ? 0.03 : 0.22, 0.004, di ? 0.22 : 0.03, PAL.cream2, x + di * 0.5 + dj * o, 0.082, z + dj * 0.5 + di * o));
    }
    const deg = open.filter(Boolean).length, isDbl = dbl.some(Boolean);
    const centreWidth = S.look === 'rich' ? 0.018 : 0.025;
    // a centre dash along every open arm, so straights, corners and junctions all carry the line; the zebra arm is left clear
    const zebraArm = deg >= 3 && !isDbl && h > 0.45 ? (open[0] ? 0 : 2) : -1;
    if (!isDbl && deg >= 2 && !(S.look === 'rich' && deg >= 3)) for (let k = 0; k < 4; k++) if (open[k] && k !== zebraArm) { const [di, dj] = DIR4[k]; g.push(box(di ? 0.18 : centreWidth, 0.004, di ? centreWidth : 0.18, S.look === 'rich' ? '#d7c38f' : PAL.cream2, x + di * 0.3, 0.082, z + dj * 0.3)); }
    if (deg === 2 && h > 0.7) g.push(cyl(0.09, 0.09, 0.012, '#858a8e', x + (h - 0.85) * 0.4, 0.083, z + (h - 0.8) * 0.4, 8));
    const straight = deg === 2 && !isDbl && ((open[0] && open[2]) || (open[1] && open[3]));
    if (straight) {
      const ns = open[0] && open[2];
      for (const s of [-1, 1]) g.push(box(ns ? 0.015 : 1, 0.004, ns ? 1 : 0.015, PAL.cream2, x + (ns ? s * 0.29 : 0), 0.082, z + (ns ? 0 : s * 0.29)));   // white edge lines along the kerb
      // 止まれ: on the approach to a T-junction, a stop line across the near lane with the painted mark behind it (Japan keeps left)
      const degOf = q => DIR4.reduce((s, [a, b]) => s + (road(cell(q.i + a, q.j + b)) ? 1 : 0), 0);
      for (let k = 0; k < 4; k++) if (open[k]) {
        const [di, dj] = DIR4[k], n = cell(c.i + di, c.j + dj); if (!n || !(degOf(n) === 3 || (degOf(n) === 4 && !signalCells.has(n))) || n.bridge || (n.h || 0) !== gy) continue;   // T-junctions and unsignalled crossroads
        const ox = -dj * 0.16, oz = di * 0.16;   // the left-hand lane when driving toward the junction
        const kerbCell = cell(c.i - dj, c.j + di);   // the cell beyond the left kerb: no sign where it is a road, the slipway or the yard
        if (degOf(n) === 3 && !c.slip && kerbCell && kerbCell.type !== 'road' && !kerbCell.yard) addFurniture(lg, 'street-signs', x + di * 0.3 - dj * 0.47, 0.1, z + dj * 0.3 + di * 0.47, Math.atan2(-di, -dj));   // the kit stop sign on the left kerb strip, facing the driver
        g.push(box(di ? 0.03 : 0.27, 0.005, di ? 0.27 : 0.03, PAL.cream2, x + di * 0.42 + ox, 0.083, z + dj * 0.42 + oz));
        for (let m = 0; m < 3; m++) g.push(box(di ? 0.06 : 0.05, 0.005, di ? 0.05 : 0.06, PAL.cream2, x + di * (0.3 - m * 0.09) + ox, 0.083, z + dj * (0.3 - m * 0.09) + oz));
      }
    }
    for (let k = 0; k < 4; k++) if (dbl[k]) {   // guard rail along the avenue's outer kerb
      const kk = (k + 2) % 4, [di, dj] = DIR4[kk]; if (open[kk]) continue;
      const rx = x + di * 0.3, rz = z + dj * 0.3;
      for (const t of [-0.33, 0, 0.33]) g.push(box(0.025, 0.13, 0.025, PAL.cream2, rx + (di ? 0 : t), 0.165, rz + (dj ? 0 : t)));
      g.push(box(di ? 0.03 : 1, 0.035, dj ? 0.03 : 1, PAL.cream2, rx, 0.215, rz));
    }
    // zebra crossing across one arm of a real junction
    if (S.look === 'rich') richStreetDetails(g, x, z, open, dbl, DIR4);
    else if (deg >= 3 && !isDbl && h > 0.45) { const zs = open[0] ? -1 : 1; for (let k = -1; k <= 1; k++) g.push(box(0.08, 0.005, 0.3, PAL.cream2, x + k * 0.16, 0.083, z + zs * 0.62 * 0.6)); }
    for (let k = 0; k < 4; k++) if (open[k] && !isDbl) { const [di, dj] = DIR4[k]; g.push(box(di ? 0.19 : 0.02, 0.012, di ? 0.02 : 0.19, '#d9cdb3', x + di * 0.41 + dj * 0.32, 0.105, z + dj * 0.41 - di * 0.32)); g.push(box(di ? 0.19 : 0.02, 0.012, di ? 0.02 : 0.19, '#d9cdb3', x + di * 0.41 - dj * 0.32, 0.105, z + dj * 0.41 + di * 0.32)); }
    // a traffic light at every crossroads: a pole on one corner, a horizontal three-lamp head for each axis
    if (signalCells.has(c) && isDbl) signalCells.delete(c);
    if (signalCells.has(c)) {
      // the kit's horizontal signal on two corners: one head faces the north–south street, the other the east–west one;
      // its named lenses go to the per-axis lamp meshes whose emissive the town phase toggles
      const heads = [['ns', 0, x - 0.42, z + 0.42], ['ew', Math.PI / 2, x + 0.42, z - 0.42]];
      for (const [axis, ry, px, pz] of heads) {
        const parts = furnitureGeometry('traffic-light', null, { x: px, y: 0.1, z: pz, rot: ry });
        let lens = lampGeo.get(c); if (!lens) lampGeo.set(c, lens = { nsRed: [], nsAmber: [], nsGreen: [], ewRed: [], ewAmber: [], ewGreen: [] });
        for (const name in parts) { const col = name === 'Red_Lens' ? 'Red' : name === 'Amber_Lens' ? 'Amber' : name === 'Green_Lens' ? 'Green' : null; if (col) lens[axis + col].push(parts[name]); else lg.push(parts[name]); }
      }
    }
    // utility poles on the corner opposite the lamp; cables are strung between neighbours below
    if (h > 0.2 && h < 0.5 && lotAdjacent4(c)) {
      const d = DIR4.find(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'lot'; });
      const px = x + d[0] * 0.42 - d[1] * 0.38, pz = z + d[1] * 0.42 + d[0] * 0.38;
      // the kit's concrete pole with crossarm, insulators, transformer drum and its own lamp; the crossarm runs across the street
      addNeighbourhood(lg, 'utility-pole', px, 0.1, pz, d[0] ? 0 : Math.PI / 2, { scale: 1.05 });
      lg.push(box(0.075, 0.22, 0.075, '#e6c25c', px, 0.45, pz)); for (const yy of [0.39, 0.51]) lg.push(box(0.077, 0.035, 0.077, '#4a4340', px, yy, pz));   // striped guard wrap at the base
      poles.push({ p: new THREE.Vector3(px, 0.1 + 1.163 * 1.05, pz), i: c.i, j: c.j });   // cables hang from the crossarm's middle anchor
    }
    // convex traffic mirror at busier corners
    if (deg >= 3 && h > 0.54 && h <= 0.62 && lotAdjacent4(c)) {
      const d = DIR4.find(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'lot'; });
      const px = x + d[0] * 0.38 + d[1] * 0.3, pz = z + d[1] * 0.38 - d[0] * 0.3;
      lg.push(cyl(0.018, 0.022, 0.85, PAL.lamp, px, 0.5, pz, 5));
      const ring = new THREE.TorusGeometry(0.075, 0.012, 6, 12); ring.rotateX(0.35); ring.rotateY(Math.atan2(-d[0], -d[1])); ring.translate(px, 0.98, pz); lg.push(colorize(ring, '#e9a25a'));
      const disc = new THREE.CylinderGeometry(0.066, 0.066, 0.012, 12); disc.rotateX(Math.PI / 2 + 0.35); disc.rotateY(Math.atan2(-d[0], -d[1])); disc.translate(px, 0.98, pz); lg.push(colorize(disc, '#cfdbe0'));
    }
    // a red post box on the pavement outside a shop
    if (h > 0.54 && h <= 0.6) {
      const d = DIR4.find(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'lot' && n.block && n.block.type === 'shop'; });
      if (d) {
        const px = x + d[0] * 0.38 - d[1] * 0.24, pz = z + d[1] * 0.38 + d[0] * 0.24, red = '#c9564b';
        lg.push(box(0.12, 0.02, 0.12, PAL.concrete2, px, 0.11, pz)); lg.push(box(0.1, 0.22, 0.1, red, px, 0.23, pz)); lg.push(box(0.12, 0.03, 0.12, red, px, 0.355, pz)); lg.push(box(0.06, 0.02, 0.06, red, px, 0.38, pz));
        lg.push(box(d[0] ? 0.008 : 0.07, 0.012, d[0] ? 0.07 : 0.008, '#4a4340', px - d[0] * 0.052, 0.3, pz - d[1] * 0.052)); lg.push(box(d[0] ? 0.006 : 0.06, 0.05, d[0] ? 0.06 : 0.006, PAL.cream2, px - d[0] * 0.052, 0.2, pz - d[1] * 0.052));
      }
    }
    // a hokora (wayside shrine) on the outer pavement corner of a quiet bend
    if (deg === 2 && !straight && !isDbl && h > 0.62 && h <= 0.72 && lotAdjacent8(c)) {   // ring-road bends touch their lot only diagonally
      const arms = DIR4.filter((_, k) => open[k]), sx = -(arms[0][0] + arms[1][0]), sz = -(arms[0][1] + arms[1][1]), px = x + sx * 0.4, pz = z + sz * 0.4, ry = Math.atan2(-sx, -sz);
      lg.push(box(0.18, 0.06, 0.18, PAL.concrete2, px, 0.13, pz, ry)); lg.push(box(0.12, 0.16, 0.1, PAL.cream, px, 0.24, pz, ry)); lg.push(box(0.1, 0.11, 0.012, K_DARK, px + Math.sin(ry) * 0.05, 0.25, pz + Math.cos(ry) * 0.05, ry));   // stone base, body, the dark opening at the front
      lg.push(prism(0.24, 0.09, 0.2, PAL.kawara, px, 0.315, pz, ry + Math.PI / 2)); lg.push(box(0.25, 0.02, 0.21, PAL.kawara2, px, 0.318, pz, ry)); lg.push(box(0.03, 0.03, 0.22, PAL.kawara2, px, 0.405, pz, ry + Math.PI / 2));
      lg.push(box(0.05, 0.045, 0.008, '#c9564b', px + Math.sin(ry) * 0.058, 0.225, pz + Math.cos(ry) * 0.058, ry));   // the little red bib
      for (const o of [-0.06, 0.06]) lg.push(cyl(0.014, 0.014, 0.04, PAL.cream2, px + Math.cos(ry) * o + Math.sin(ry) * 0.075, 0.18, pz - Math.sin(ry) * o + Math.cos(ry) * 0.075, 5));   // offerings
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
    // a lamp wherever a street passes a building (most cells), and every third cell along any other street, so ring
    // roads, avenues, the coast road and hill streets are lit too; bridges and slopes have none
    let byStation = false; for (let dj = -1; dj <= 1 && !byStation; dj++) for (let di = -1; di <= 1 && !byStation; di++) { const n = cell(c.i + di, c.j + dj); if (n && n.type === 'lot' && n.block && n.block.type === 'station') byStation = true; }
    // around the station only the middle cell of each ring-road side carries a lamp, so the plaza is not hemmed in by poles
    const sc = STATION.anchor ? STATION.anchor.cell : null, sdi = sc ? Math.abs(c.i - sc.i) : 9, sdj = sc ? Math.abs(c.j - sc.j) : 9;
    const ringMid = byStation && ((sdi === 2 && sdj === 0) || (sdj === 2 && sdi === 0));
    const lampHere = !c.bridge && !c.ramp && (byStation ? ringMid : ((h > 0.5 && lotAdjacent4(c)) || ((c.i * 2 + c.j) % 3 === 0 && deg <= 2 && !isDbl)));
    if (lampHere) {
      const d = DIR4.find(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'lot'; }) || DIR4.find(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type !== 'road' && n.type !== 'water' && n.type !== 'canal'; }) || DIR4.find(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type !== 'road'; });
      if (!d) { /* a street with roads on all four sides: no kerb to stand on */ } else {
      // street lamp: a pole on the sidewalk corner, an arm reaching over the road, a housing lit from
      // underneath, a soft beam fading to the ground, and a pool of light on the asphalt
      const px = x + d[0] * 0.4 + d[1] * 0.35, pz = z + d[1] * 0.4 - d[0] * 0.35;
      const ax = -d[0], az = -d[1], ry = Math.atan2(ax, az), top = 1.42;   // arm points away from the lot, over the road
      // the kit's street lamp (pole, angled arm, bevelled housing) at 1.5× so its head clears the two-storey eaves; the town's
      // emissive lens sits under the housing at the kit's light point, with the beam and the pool of light as before
      const LS = 1.5; addNeighbourhood(lg, 'street-lamp', px, 0.1, pz, ry, { scale: LS }); void top;
      const hx = px + ax * 0.23 * LS, hz = pz + az * 0.23 * LS, hy = 0.1 + 0.828 * LS + 0.02;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.19), lampHeadMat); head.rotation.y = ry; head.position.set(hx, hy - 0.03, hz); head.castShadow = false; scene.add(head); lampHeads.push(head);
      cones.push(lightCone(hx, hy - 0.03, hz, 0.06, 0.4, PAL.lampGlow));
      const gl = makeGlow(hx, 0.125, hz, 1.5); gl.material = lampGlowMat; scene.add(gl); lampGlows.push(gl);
      }
    }
    if (gy) {   // lift everything this cell added to its terrace
      for (let k = g0; k < g.length; k++) g[k].translate(0, gy, 0);
      for (let k = lg0; k < lg.length; k++) lg[k].translate(0, gy, 0);
      for (let k = hd0; k < lampHeads.length; k++) lampHeads[k].position.y += gy;
      for (let k = gl0; k < lampGlows.length; k++) lampGlows[k].position.y += gy;
      for (let k = cn0; k < cones.length; k++) cones[k].translate(0, gy, 0);
      for (let k = po0; k < poles.length; k++) poles[k].p.y += gy;
    }
  }
  // cables: each pole links to its two nearest neighbours within reach; a few birds perch mid-span
  // cables only run along a street: two poles link if they share a row or column and every cell
  // between them is road, and each pole takes at most one neighbour in each direction
  const pos = [];
  const roadBetween = (a, b) => { const di = Math.sign(b.i - a.i), dj = Math.sign(b.j - a.j); const h = (cell(a.i, a.j).h || 0); for (let i = a.i + di, j = a.j + dj; i !== b.i || j !== b.j; i += di, j += dj) { const c = cell(i, j); if (!c || c.type !== 'road' || c.ramp || Math.abs((c.h || 0) - h) > 1e-6) return false; } return true; };
  for (const b of blocks) {   // a finished substation strings cables from its crossarm to the two nearest poles within reach
    if (b.type !== 'civic' || b.kind !== 'substation' || b.stage < DONE || !b.units[0]) continue;
    const u = b.units[0], f = u.facing || 0, ax = -0.02, az = -0.04 - 0.19;   // the frame's crossarm (model z -0.19 in unit space)
    const sx = cx(u.cell.i) + ax * Math.cos(f) + az * Math.sin(f), sz = cz(u.cell.j) - ax * Math.sin(f) + az * Math.cos(f), S0 = new THREE.Vector3(sx, (u.cell.h || 0) + 0.12 + 0.778, sz);
    const near = poles.map(P => ({ P, d: P.p.distanceTo(S0) })).filter(o => o.d < 4.5).sort((a, b) => a.d - b.d).slice(0, 2);
    for (const { P } of near) { const segs = 8; for (let s = 0; s < segs; s++) for (const t of [s / segs, (s + 1) / segs]) { const sag = Math.sin(t * Math.PI) * 0.12; pos.push(S0.x + (P.p.x - S0.x) * t, S0.y + (P.p.y - S0.y) * t - sag, S0.z + (P.p.z - S0.z) * t); } }
  }
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
  for (const c of cells) if (c.park) {   // car parks: an asphalt slab with a dropped kerb toward the entry road, four bays, a sign and hedges
    const x = cx(c.i), z = cz(c.j), gy = c.h || 0, r = c.parkRoad, ex = r ? Math.sign(r.i - c.i) : 0, ez = r ? Math.sign(r.j - c.j) : 1;
    g.push(box(0.94, 0.08, 0.94, PAL.asphalt, x, gy + 0.04, z));
    for (const [di, dj] of DIR4) { if (di === ex && dj === ez) continue; g.push(box(di ? 0.06 : 1, 0.1, di ? 1 : 0.06, PAL.sidewalk, x + di * 0.47, gy + 0.05, z + dj * 0.47)); }
    g.push(box(ex ? 0.02 : 0.8, 0.004, ex ? 0.8 : 0.02, PAL.cream2, x, gy + 0.082, z));   // the line between the rows
    for (const s of [-1, 0, 1]) g.push(box(ex ? 0.44 : 0.02, 0.004, ex ? 0.02 : 0.44, PAL.cream2, x + (ex ? 0 : s * 0.45) - ex * 0.22, gy + 0.082, z + (ez ? 0 : s * 0.45) - ez * 0.22));
    for (const s of [-1, 0, 1]) g.push(box(ex ? 0.44 : 0.02, 0.004, ex ? 0.02 : 0.44, PAL.cream2, x + (ex ? 0 : s * 0.45) + ex * 0.22, gy + 0.082, z + (ez ? 0 : s * 0.45) + ez * 0.22));
    const sx = x + ex * 0.4 + (-ez) * 0.4, sz = z + ez * 0.4 + ex * 0.4;   // the sign by the entry
    lg.push(cyl(0.012, 0.014, 0.4, PAL.lamp, sx, gy + 0.3, sz, 6)); lg.push(box(0.12, 0.14, 0.015, c.park === 'taxi' ? '#e8cf7a' : PAL.roofBlue, sx, gy + 0.55, sz, Math.atan2(ex, ez))); lg.push(box(0.05, 0.08, 0.005, PAL.cream2, sx + ex * 0.01, gy + 0.55, sz + ez * 0.01, Math.atan2(ex, ez)));
    for (const s of [-1, 1]) g.push(blob(0.1, s < 0 ? PAL.bush : PAL.bush2, x - ex * 0.4 + (-ez) * s * 0.36, gy + 0.16, z - ez * 0.4 + ex * s * 0.36, 0, 0.8));   // hedges at the back corners
  }
  puddleSpots.length = 0; puddleVersion++;
  for (const c of cells) if (c.type === 'road' && !(c.h || 0) && !c.bridge && !c.ramp && !c.slip && hash(c.i * 3 + 1, c.j * 5 + 2) < 0.28) { const h2 = hash(c.j, c.i + 7); puddleSpots.push({ x: cx(c.i) + (h2 - 0.5) * 0.4, z: cz(c.j) + (hash(c.i + 3, c.j) - 0.5) * 0.4, s: 0.16 + h2 * 0.14, ry: h2 * 3.14 }); }
  roadMesh = mergeMesh(g, false, false); if (roadMesh) { roadMesh.castShadow = false; roadMesh.material = roadMesh.material.clone(); roadMesh.material.color.setScalar(1 - 0.28 * wetK); scene.add(roadMesh); }
  lampMesh = mergeMesh(lg, false, true); if (lampMesh) scene.add(lampMesh);
  for (const [c, lens] of lampGeo) {   // each crossing's lenses get their own materials, so each keeps its own cycle
    const mats = {};
    for (const k in lens) {
      const [col, glow] = LAMP_TINT[k.slice(2)]; mats[k] = new THREE.MeshStandardMaterial({ color: col, emissive: glow, emissiveIntensity: 0, roughness: 0.5 });
      if (lens[k].length) { const m = mergeMesh(lens[k], false, false); m.material = mats[k]; m.castShadow = false; scene.add(m); signalMeshes.push(m); }
    }
    signalLamps.set(c, mats);
  }
  signalT = -1; updateSignals();
  if (cones.length) { coneMesh = mergeMesh(cones, false, false); coneMesh.material = coneMat; coneMesh.receiveShadow = false; coneMesh.renderOrder = 6; scene.add(coneMesh); }
}

// ───────────────────────────── blocks & units ─────────────────────────────
const blocks = []; const units = new Map();
const CAP = { res: [0, 2, 4, 6], work: [0, 4, 7, 10], shop: [0, 1, 2, 3], civic: [0, 2, 2, 2], farm: [0, 2, 2, 2] };   // farm: two farmers a cell   // civic: two workers, no levels
// Size tiers (Phase 5): the number of cells dragged decides what a block becomes. Index = cells.
const TIERS = {
  res: [null, ['detached', 'narrow'], ['terrace', 'apartment'], ['manshon']],
  shop: [null, ['konbini', 'bakery', 'florist', 'books', 'ramen'], ['cafe', 'restaurant', 'grocery'], ['supermarket', 'arcade']],
  work: [null, ['studio', 'office'], ['workshop', 'office'], ['factory', 'office']],
  farm: [null, ['field', 'greenhouse'], ['field'], ['paddy']],   // Phase 7: a vegetable field or a greenhouse on one cell, a bigger field on two, rice paddies on three
  civic: [null, ['substation', 'waterworks', 'recycling', 'clinic', 'firestation', 'community'], ['townhall', 'bathhouse'], ['square', 'bathhouse']],   // Phase 5.5: services on one cell, the town hall or bath on two, the bath on three
};
const CAP_BONUS = { square: -2, apartment: 2, manshon: 4, villa: 2, restaurant: 1, supermarket: 2, arcade: 1, factory: 3 };   // a villa holds a whole family
/** what a drag of n cells would make, for the placement label */
function tierLabel(type, n) {
  if (type === 'park') return `${n} cell${n > 1 ? 's' : ''} · car park, ${4 * n} bays`;
  const pool = TIERS[type] && TIERS[type][n]; if (!pool) return '';
  const names = pool.map(k => (k === 'office' && n === 3 ? 'office block' : KIND_LABEL[k] || k).toLowerCase());
  return `${n} cell${n > 1 ? 's' : ''} · ${names.length > 1 ? names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1] : names[0]}`;
}
// construction: plot → foundation → frame → scaffolding → finishing → DONE. Hours are crew-hours at rate 1.
const DONE = 5;
const STAGE_HOURS = [2, 2.5, 2.5, 2, 2];        // shops, workspaces (~11 crew-hours)
const RES_STAGE_HOURS = [1.5, 2, 2, 1.5, 1.5];  // homes (~8.5 crew-hours, about one working day)
const STAGE_NAMES = ['Surveying the plot', 'Laying foundations', 'Raising the frame', 'Up on the scaffolding', 'Finishing touches'];
const stageHours = b => b.type === 'res' ? RES_STAGE_HOURS : STAGE_HOURS;
const TYPE_LABEL = { res: 'Residential', shop: 'Shop', work: 'Workspace', civic: 'Civic', farm: 'Farm', station: 'Station' };
const TYPE_COLOR = { res: PAL.roofRose, shop: PAL.roofTeal, work: PAL.roofBlue, civic: '#7d6fa3', farm: '#7f9b5a', station: PAL.roofSage };
/** how many storeys a block can grow to: houses and terraces two, apartments and the manshon three, everything else three */
const HOUSE_VARIANTS = new Set(['detached', 'narrow', 'terrace']);
function maxLevel(b) { return b.type === 'res' && HOUSE_VARIANTS.has(b.variant) ? 2 : b.type === 'civic' || b.type === 'farm' ? 1 : 3; }
function unitCap(u) {
  const b = u.block, house = b.type === 'res' && HOUSE_VARIANTS.has(u.variant) && b.level >= 2;   // a two-storey house holds a family of three, not two households
  return CAP[b.type][b.level] + (CAP_BONUS[u.variant] || 0) + (CAP_BONUS[b.kind] || 0) - (house ? 1 : 0);
}
const SHOP_KINDS = ['cafe', 'bakery', 'ramen', 'grocery', 'konbini', 'florist', 'books'];
const WORK_KINDS = ['office', 'workshop', 'studio'];
const KIND_LABEL = { substation: 'Substation', waterworks: 'Water works', recycling: 'Recycling centre', bathhouse: 'Public bath', square: 'Town square', ryokan: 'Ryokan', field: 'Vegetable field', greenhouse: 'Greenhouse', paddy: 'Rice paddies', townhall: 'Town hall', clinic: 'Clinic', firestation: 'Fire station', community: 'Community centre', cafe: 'Café', bakery: 'Bakery', ramen: 'Ramen shop', grocery: 'Grocery', konbini: 'Convenience store', florist: 'Florist', books: 'Bookshop', restaurant: 'Restaurant', supermarket: 'Supermarket', arcade: 'Shopping arcade', office: 'Office', workshop: 'Workshop', studio: 'Studio', factory: 'Factory', detached: 'Detached house', narrow: 'Narrow house', apartment: 'Apartments', terrace: 'Terrace houses', manshon: 'Apartment building', villa: 'Villa', teahouse: 'Tea house' };
function makeUnit(block, c) {
  const u = { id: S.nextId++, block, cell: c, mesh: null, residents: [], staff: [], inside: new Set(), lastMoveIn: S.T, pop: 0, incoming: 0, removed: false,
    winMat: new THREE.MeshStandardMaterial({ color: PAL.window, emissive: PAL.glow, emissiveIntensity: 0, roughness: 0.4 }),
    glowMat: glowMat.clone(), seed: hash(c.i, c.j) };
  c.type = 'lot'; c.block = block; c.tree = null; c.unit = u; block.units.push(u); units.set(u.id, u); return u;
}
// A cell can take a building if it is empty, or a street that is not the station's ring and would still have
// a street (road or empty cell) on one side once the whole selection is built, so the door has somewhere to face.
// ── the hill opens once the town has grown: the island's slope roads appear and lanterns light the shrine path ──
const HILL_UNLOCK = 60;
const hill = { open: false };
let lanternMesh = null;
// the shrine path lanterns have their own materials so the opening can light them one by one, day or night; otherwise
// they follow the street lamps (daynight.js drives lampHeadMat / lampGlowMat, updateLanterns copies them each frame)
const lanterns = [], hillListeners = [];
let lanternShow = 0;   // real seconds when the one-by-one lighting began (0: none)
const onHillOpened = fn => hillListeners.push(fn);
function lightLanterns() { lanternShow = performance.now() / 1000; }
function updateLanterns() {
  const t = performance.now() / 1000, base = lampHeadMat.emissiveIntensity, baseGlow = lampGlowMat.opacity;
  const e = lanternShow ? Math.min(1, Math.max(0, (t - lanternShow - 11) / 2.5)) : 1;   // after the show, back to the lamps' own level
  if (lanternShow && e >= 1) lanternShow = 0;
  for (const L of lanterns) {
    const lit = lanternShow ? Math.min(1, Math.max(0, (t - lanternShow - 0.8 - L.order * 0.6) / 0.35)) : 0;
    L.head.material.emissiveIntensity = lit * 2.2 * (1 - e) + base * e;
    L.glow.material.opacity = lit * 0.5 * (1 - e) + baseGlow * e;
  }
}
function openHill(quiet = false) {
  if (hill.open) return; hill.open = true;
  for (const c of cells) if (c.keep) { c.type = 'road'; c.tree = null; if (c.pendingRamp) { c.ramp = c.pendingRamp; } }
  const g = [], { x, z, fx, fz } = hillCentre, rx = -fz, rz = fx;
  const edge = hillCentre.edge;   // how far the summit runs in front of the shrine (island.js)
  const d0 = Math.min(0.55, edge - 0.45), d1 = Math.max(d0 + 0.3, edge - 0.14);
  for (let k = 0; k < 3; k++) for (const side of [-0.42, 0.42]) {   // stone lanterns down the flagged path, lit at night like the street lamps
    const d = d0 + (d1 - d0) * k / 2, px = x + fx * d + rx * side, pz = z + fz * d + rz * side;
    const gy = terrainY(px, pz);   // each lantern stands on its own ground
    g.push(cyl(0.03, 0.04, 0.22, PAL.concrete, px, gy + 0.11, pz, 6)); g.push(box(0.11, 0.09, 0.11, PAL.concrete, px, gy + 0.27, pz)); g.push(box(0.15, 0.025, 0.15, PAL.concrete, px, gy + 0.33, pz));
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), lampHeadMat.clone()); head.position.set(px, gy + 0.27, pz); head.userData.lantern = true; scene.add(head); lampHeads.push(head);
    const gl = makeGlow(px, gy + 0.005, pz, 0.9); gl.material = lampGlowMat.clone(); gl.userData.lantern = true; scene.add(gl); lampGlows.push(gl);
    lanterns.push({ head, glow: gl, order: (2 - k) * 2 + (side > 0 ? 1 : 0), pos: new THREE.Vector3(px, gy, pz) });   // lit from the foot of the path up to the shrine
  }
  lanternMesh = mergeMesh(g, false); if (lanternMesh) scene.add(lanternMesh);
  refreshWorld();
  if (!quiet) {
    record('The hill opened and the shrine path was lit');
    if (hillListeners.length) for (const fn of hillListeners) fn(); else toast('The town has grown. A road crew has opened the hill, and the shrine path is lit.');
  }
}
function placeable(c, sel = []) {
  if (!c || c.type !== 'empty' || c.ramp || c.yard || c.park || c.slip || c.landmark) return false;   // buildings stand on empty ground, beside a street
  if ((c.h || 0) > 0 && !hill.open) return false;   // the hill opens later
  if (sel.length && (sel[0].h || 0) !== (c.h || 0)) return false;   // one block, one terrace
  if (c.type === 'road') for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const n = cell(c.i + di, c.j + dj); if (n && n.block && n.block.type === 'station') return false; }
  const net = townNetCached();   // a street to face, and one that reaches the station, so nobody is ever cut off
  return DIR4.some(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'road' && !n.ramp && (n.h || 0) === (c.h || 0) && net.has(n); });
}
function ringRoads(sel) {
  const h = sel[0].h || 0;
  if (h > 0) {   // on the hill a block gets one street in front, on the free side that faces the town
    const mx = sel.reduce((s, c) => s + cx(c.i), 0) / sel.length, mz = sel.reduce((s, c) => s + cz(c.j), 0) / sel.length;
    const dirs = DIR4.slice().sort((a, b) => (b[0] * -mx + b[1] * -mz) - (a[0] * -mx + a[1] * -mz));   // most townward first
    for (const [di, dj] of dirs) {
      const front = sel.map(c => cell(c.i + di, c.j + dj));
      if (front.every(n => n && !sel.includes(n) && (n.type === 'empty' || n.type === 'road') && (n.h || 0) === h && !n.ramp)) { for (const n of front) if (n.type === 'empty') { n.type = 'road'; n.tree = null; } return; }
    }
  }
  for (const c of sel) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const n = cell(c.i + di, c.j + dj); if (n && n.type === 'empty' && (n.h || 0) === (c.h || 0)) { n.type = 'road'; n.tree = null; }   // a street only on the block's own terrace
  }
}

// ───────────────────────────── streets (Phase 4.9) ─────────────────────────────
// Streets first. The player draws them with the Road tool (`drawn`, permanent) and zones buildings beside them; a
// building's door faces the street it was placed against. The station's ring is the first street. The town lays
// nothing on the flat by itself; on the hill it still builds a slope for a terrace street that has no way down.
const FACE = { '0,1': 0, '1,0': Math.PI / 2, '0,-1': Math.PI, '-1,0': -Math.PI / 2 };
/** the street cells a block placed on `sel` would face: every road 4-neighbour on its own level */
function frontRoads(sel) {
  const h = sel[0].h || 0, out = [];
  for (const c of sel) for (const [di, dj] of DIR4) { const n = cell(c.i + di, c.j + dj); if (n && n.type === 'road' && !n.ramp && (n.h || 0) === h && !out.includes(n)) out.push(n); }
  return out;
}
/** free terrace plots beside a hill street that reaches the town: where the town's own villas and tea house may go */
function hillPlots() { return cells.filter(c => c.type === 'empty' && (c.h || 0) > 0 && !c.ramp && !c.landmark && frontRoads([c]).some(r => townNetCached().has(r))); }
/** streets a block relies on: its road neighbours */
const isStreet = c => blocks.some(b => b.street && b.street.includes(c));
const joined = (a, b, di, dj) => { const ax = r => !!r && Math.abs(r.di) === Math.abs(di) && Math.abs(r.dj) === Math.abs(dj); return (a.h || 0) === (b.h || 0) || ax(a.ramp) || ax(b.ramp); };
/** every road cell reachable from the station's ring */
function townNet() {
  const seen = new Set(), q = [];
  if (STATION.block) for (const s of STATION.block.cells) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const n = cell(s.i + di, s.j + dj); if (n && n.type === 'road' && !seen.has(n)) { seen.add(n); q.push(n); } }
  while (q.length) { const c = q.shift(); for (const [di, dj] of DIR4) { const n = cell(c.i + di, c.j + dj); if (n && n.type === 'road' && !seen.has(n) && joined(c, n, di, dj)) { seen.add(n); q.push(n); } } }
  return seen;
}
/** the street network settles: hill slopes and links for terrace streets, then bridges */
function rebuildNetwork() { connectHillRoads(); connectCanal(); netCache = null; }
let netCache = null;   // townNet, recomputed after any change to the roads
function townNetCached() { return netCache || (netCache = townNet()); }
/** the L-shaped run of cells between two cells, as the Road tool draws it */
function roadRun(a, b) { const run = []; let i = a.i, j = a.j; run.push(cell(i, j)); while (i !== b.i) { i += Math.sign(b.i - i); run.push(cell(i, j)); } while (j !== b.j) { j += Math.sign(b.j - j); run.push(cell(i, j)); } return run; }
const drawable = (c, h) => !!c && !c.ramp && !c.yard && !c.park && !c.slip && (!c.landmark || c.landmark === 'bridge-end') && (c.h || 0) === h && ((c.h || 0) === 0 || hill.open) && (c.type === 'empty' || c.type === 'road' || (c.type === 'canal' && !c.keep));
/** does a street cell reach the station? (for the tools' messages) */
const joinedToTown = c => townNetCached().has(c);
/** the player draws a street: an L-shaped run on one level over land or straight across the canal; null if it cannot go there */
function drawRoad(a, b) {
  const run = roadRun(a, b), h = a.h || 0; if (!run.every(c => drawable(c, h))) return null;
  for (const c of run) { if (c.type === 'canal') c.bridge = true; c.type = 'road'; c.tree = null; c.drawn = true; }
  rebuildNetwork(); refreshWorld(); return run;
}
/** why a street cell cannot be removed, or null if it can */
function roadKeepReason(c) {
  if (!c || c.type !== 'road') return 'nothing';
  if (c.keep || c.coast) return 'island';
  if (!c.drawn) return 'ring';
  for (const [di, dj] of DIR4) { const n = cell(c.i + di, c.j + dj); if (n && n.type === 'lot' && n.block && n.block.type !== 'station' && frontRoads(n.block.cells).length <= 1) return 'needed'; }
  return null;
}
/** the Remove tool on a drawn street cell that no building relies on */
function eraseRoad(c) {
  if (roadKeepReason(c)) return false;
  c.drawn = false; c.type = c.canal ? 'canal' : 'empty'; c.bridge = false;
  for (const b of blocks) if (b.street) b.street = b.street.filter(x => x !== c);
  rebuildNetwork(); refreshWorld(); return true;
}

// ───────────────────────────── the station ─────────────────────────────
// A 3×3 plaza in the middle of the island. Newcomers arrive by underground train and wait here
// until a home has room. Positions below are world coordinates (cell (17,17) is centred on (0.5, 0.5)).
const SC = { i: HALF, j: HALF };                 // centre cell index
const SX = cx(SC.i), SZ = cz(SC.j);
const BENCH_Y = 0.12 + 0.114;                    // seat top of the kit bench (street-furniture.js)
const SIT_DROP = 0.025;                          // a seated Kenney person's underside (legs out straight) is this far above the group
const STATION = {
  block: null, anchor: null,                     // anchor = the south-edge unit; its cell touches the ring road
  entrance: new THREE.Vector3(SX, 0.12, SZ + 0.9),
  // the pavilion's stairs (subway-station.js, at plinth height 0.12): the top tread at local z 0.30, the bottom one at z -0.265, 0.30 down
  stairTop: new THREE.Vector3(SX, 0.12, SZ + 0.36), stairFoot: new THREE.Vector3(SX, 0.12 - 0.30, SZ - 0.265),
  seats: [], stands: [], vending: [],
};
/** the walk through the pavilion: up the stairs from the platform onto the plaza (`up`), or from the plaza down to the platform */
function stationStairs(up) { const p = [STATION.stairFoot, STATION.stairTop, STATION.entrance].map(v => v.clone()); return up ? p : p.reverse(); }
for (const bx of [-0.25, 0.25]) for (const sx of [-0.115, 0.115])   // two benches on the north edge only; the entrance side is kept clear
  // the kit's two seat places; 0.04 forward of the bench centre so the back clears the backrest and the legs rest on the slats
  STATION.seats.push({ kind: 'seat', pos: new THREE.Vector3(SX + bx + sx, BENCH_Y - SIT_DROP, SZ - 1.3 + 0.04), rot: 0, taken: null });
// the bench lamps are real lights (the street lamps only paint a pool on the ground): two warm point lights under their heads,
// so the benches and whoever waits on them are lit after dark. daynight.js fades them in with the lamps
const benchLights = [];
for (const bx of [-0.42, 0.42]) {
  const L = new THREE.PointLight('#ffc27d', 0, 1.9, 1.4); L.position.set(SX + bx, 0.95, SZ - 1.3 - 0.2); L.castShadow = false; scene.add(L); benchLights.push(L);
}
for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]])
  STATION.stands.push({ kind: 'stand', pos: new THREE.Vector3(SX + dx * 0.6, 0.12, SZ + dz * 0.6), rot: Math.atan2(-dx, -dz), taken: null });
for (const dz of [-0.22, 0.22]) STATION.vending.push({ pos: new THREE.Vector3(SX + 1.08, 0.12, SZ + dz), rot: Math.PI / 2, taken: null });
STATION.vending.push({ pos: new THREE.Vector3(SX - 1.08, 0.12, SZ - 0.2), rot: -Math.PI / 2, taken: null });

function placeStation() {
  const block = { id: S.nextId++, type: 'station', cells: [], units: [], stage: DONE, stageT: 0, crew: [], renoT: 0, level: 1, occT: 0, visitScore: 0, created: S.T,
    roof: PAL.roofSage, wall: PAL.cream2, awning: [PAL.roofSage, PAL.cream2], family: 'Station', name: 'Komachi Station', trains: 0 };
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const c = cell(SC.i + di, SC.j + dj); block.cells.push(c);
    const u = makeUnit(block, c); u.di = di; u.dj = dj; u.facing = 0;
    if (di === 0 && dj === 1) STATION.anchor = u;
  }
  ringRoads(block.cells);
  blocks.push(block); STATION.block = block;
  { const a = STATION.anchor.cell; for (const di of [0, 1, -1]) { const c = cell(a.i + di, a.j + 2), road = cell(a.i + di, a.j + 1); if (c && c.type === 'empty' && !c.block && !c.h && !c.yard && !c.ramp && road && road.type === 'road') { c.park = 'taxi'; c.parkRoad = road; c.tree = null; STATION.taxiPark = c; break; } } }
  refreshWorld(); for (const u of block.units) rebuildUnitMesh(u);
  return block;
}

/**
 * Roads on the hill find their own way. A terrace street with no way down gets a slope road built at its
 * edge (the lower cell becomes the slope, the next one its foot), placed on the side nearest the town.
 * Then every slope road's ends are linked to the nearest street, or another slope road's end, on their
 * own level. Slope roads and links made here are ordinary roads: they are cleared with the orphans when a
 * block goes, and removeBlock calls this again to rebuild what is still needed.
 */
function connectHillRoads() {
  const passable = (n, h) => n && (n.type === 'empty' || n.type === 'road' || n.type === 'hill') && (n.h || 0) === h && !n.ramp;   // links may cut through the woods
  const free = n => n.type === 'empty' || n.type === 'hill';
  const sameLevelPath = (start, h, isGoal) => {
    const prev = new Map([[start, null]]); const q = [start];
    while (q.length) {
      const c = q.shift(); if (c !== start && isGoal(c)) { const path = []; for (let p = c; p; p = prev.get(p)) path.push(p); return path; }
      for (const [di, dj] of DIR4) { const n = cell(c.i + di, c.j + dj); if (!n || prev.has(n) || !passable(n, h)) continue; prev.set(n, c); q.push(n); }
    }
    return null;
  };
  // start over: town-built slopes and links from the last pass go, unless a block's ring now needs the cell as plain road
  for (const c of cells) {
    if (!c.dyn && !c.link) continue;
    if (c.type === 'road' && !lotAdjacent8(c)) c.type = 'empty';
    c.ramp = null; c.dyn = false; c.link = false;
  }
  if (!cells.some(c => c.type === 'lot' && (c.h || 0) > 0)) return;   // nothing to link until someone builds up there
  // a link may end at a block's street (the town, at ground level) or, above ground, at another slope road's end
  const goal = c => c.type === 'road' && !c.ramp && (lotAdjacent8(c) || ((c.h || 0) > 0 && (c.keep || c.dyn)));
  // 1. slope roads for terrace streets that cannot get down
  const flood = start => { const h = start.h || 0, seen = new Set([start]), q = [start]; while (q.length) { const c = q.shift(); for (const [di, dj] of DIR4) { const n = cell(c.i + di, c.j + dj); if (n && !seen.has(n) && n.type === 'road' && !n.ramp && (n.h || 0) === h) { seen.add(n); q.push(n); } } } return seen; };
  for (let pass = 0; pass < 3; pass++) {
    let added = false; const seen = new Set();
    for (const c of cells) {
      if (c.type !== 'road' || !(c.h > 0) || c.ramp || seen.has(c)) continue;
      const net = flood(c); for (const n of net) seen.add(n);
      const wayDown = [...net].some(n => n.keep || DIR4.some(([di, dj]) => { const m = cell(n.i + di, n.j + dj); return m && m.ramp && Math.abs(m.ramp.h1 - (n.h || 0)) < 1e-6; }));
      if (wayDown) continue;
      // where could a slope go? from a cell n on this terrace, straight over an empty lower cell R to a free cell L
      const slopeAt = n => { let best = null, bd = 1e9; for (const [di, dj] of DIR4) {
        const R = cell(n.i + di, n.j + dj), L = cell(n.i + 2 * di, n.j + 2 * dj), hl = (n.h || 0) - TERRACE;
        if (!R || !L || Math.abs((R.h || 0) - hl) > 1e-6 || Math.abs((L.h || 0) - hl) > 1e-6) continue;
        if (!free(R) || !(free(L) || (L.type === 'road' && !L.ramp))) continue;
        if (lotAdjacent8(R) || lotAdjacent8(L)) continue;                                              // never inside a block's ring
        if (DIR4.some(([qi, qj]) => (qi !== di && qi !== -di || qj !== dj && qj !== -dj) && (m => m && m.type === 'road' && !m.dyn && Math.abs((m.h || 0) - hl) < 1e-6)(cell(R.i + qi, R.j + qj)))) continue;   // never alongside a street
        if (hl < 1e-6 && !sameLevelPath(L, 0, goal)) continue;                                        // a slope to the flat must be able to reach the town
        const d = Math.hypot(cx(L.i), cz(L.j)); if (d < bd) { bd = d; best = { R, L, di, dj }; } } return best; };
      let best = null, bd = 1e9;
      for (const n of net) { const s = slopeAt(n); if (s && Math.hypot(cx(s.L.i), cz(s.L.j)) < bd) { bd = Math.hypot(cx(s.L.i), cz(s.L.j)); best = s; } }
      if (!best) {   // no edge on the street itself: walk over free cells of this terrace to the nearest place a slope fits
        const h = c.h || 0, prev = new Map(); const q = [];
        for (const n of net) { prev.set(n, null); q.push(n); }
        let found = null;
        while (q.length && !found) { const n = q.shift(); if (!net.has(n) && slopeAt(n)) { found = n; break; } for (const [di, dj] of DIR4) { const m = cell(n.i + di, n.j + dj); if (!m || prev.has(m) || !passable(m, h)) continue; prev.set(m, n); q.push(m); } }
        if (!found) continue;
        for (let p = found; p; p = prev.get(p)) if (free(p)) { p.type = 'road'; p.tree = null; p.link = true; }
        best = slopeAt(found);
      }
      const { R, L, di, dj } = best;
      R.type = 'road'; R.tree = null; R.dyn = true; R.ramp = { di: -di, dj: -dj, h0: R.h || 0, h1: (R.h || 0) + TERRACE };
      if (free(L)) { L.type = 'road'; L.tree = null; } L.dyn = true; added = true;
    }
    if (!added) break;
  }
  // 2. link every slope road's ends to a street on its level
  for (const R of cells) {
    if (!R.ramp) continue;
    const { di, dj, h0, h1 } = R.ramp, H = cell(R.i + di, R.j + dj), L = cell(R.i - di, R.j - dj);
    for (const [end, h] of [[H, h1], [L, h0]]) {
      if (!end) continue;
      const path = sameLevelPath(end, h, goal); if (!path) continue;
      for (const c of path) if (free(c)) { c.type = 'road'; c.tree = null; c.link = true; }
    }
  }
}
/** the kind for a new block: from its tier's pool, the kind whose nearest example is furthest away (ties at random),
 *  so a street gets a bakery where there is none rather than a third konbini; `skip` leaves out the current kind */
function chooseKind(type, sel, skip = null) {
  const pool = (TIERS[type] && TIERS[type][Math.min(3, sel.length)] || (type === 'shop' ? SHOP_KINDS : WORK_KINDS)).filter(k => k !== skip);
  if (!pool.length) return null;
  if (type === 'civic') {   // a service the town lacks first; the town hall before a second bath; one town hall and one fire station only
    const have = new Set(blocks.filter(b => b.type === 'civic').map(b => b.kind)), single = ['townhall', 'firestation', 'community'];
    const fresh = pool.filter(k => !have.has(k)), open = pool.filter(k => !(single.includes(k) && have.has(k)));
    if (fresh.includes('townhall')) return 'townhall';
    if (fresh.includes('square')) return 'square';   // three cells: the town square first, where the market and the festival happen
    return pick(fresh.length ? fresh : (open.length ? open : pool));
  }
  if (type !== 'shop') return pick(pool);
  const c0 = sel[0], others = blocks.filter(b => b.type === 'shop' && !sel.includes(b.cells[0]));
  const far = pool.map(k => { let d = Infinity; for (const b of others) if (b.kind === k) d = Math.min(d, Math.abs(b.cells[0].i - c0.i) + Math.abs(b.cells[0].j - c0.j)); return [k, d]; });
  const best = Math.max(...far.map(f => f[1]));
  return pick(far.filter(f => f[1] === best).map(f => f[0]));
}
const carParks = [];   // the player's car parks: cells with c.park === 'public' and four bays each
/** the Car park tool: one or two touching cells beside a street become a small car park; homes and workplaces within
 *  reach park their cars there before falling back to the kerb. Nothing is gated on it */
function placeCarPark(sel) {
  if (!sel.length || !sel.every(c => placeable(c, sel))) return null;
  const streets = frontRoads(sel);
  for (const c of sel) {
    const road = DIR4.map(([a, b]) => cell(c.i + a, c.j + b)).find(n => n && streets.includes(n)) || DIR4.map(([a, b]) => cell(c.i + a, c.j + b)).find(n => n && n.type === 'road' && (n.h || 0) === (c.h || 0)) || streets[0];
    c.park = 'public'; c.parkRoad = road; c.tree = null; carParks.push(c);
  }
  refreshWorld(); return sel;
}
/** take a car park cell back to plain ground (sim.js re-parks the cars first) */
function clearCarPark(c) { if (c.park !== 'public') return false; c.park = null; c.parkRoad = null; const k = carParks.indexOf(c); if (k >= 0) carParks.splice(k, 1); refreshWorld(); return true; }
/** where car k (0–3) stands in a car park cell: two rows of two, nose-in from the entry side; returns { x, z, rot } */
function parkBay(c, k) {
  const r = c.parkRoad, ex = r ? Math.sign(r.i - c.i) : 0, ez = r ? Math.sign(r.j - c.j) : 1;   // toward the entry
  const ax = -ez, az = ex;   // across the entry
  const across = (k % 2 ? 1 : -1) * 0.24, along = (k < 2 ? 1 : -1) * 0.22;
  return { x: cx(c.i) + ax * across + ex * along, z: cz(c.j) + az * across + ez * along, rot: Math.atan2(-ex, -ez), h: c.h || 0 };
}
function placeBlock(type, sel, preset = null) {
  const seed = Math.random();
  const family = pick(FAMILY);
  const block = {
    id: S.nextId++, type, cells: sel.slice(), units: [], stage: 0, stageT: 0, level: 1, occT: 0, visitScore: 0, created: S.T,
    crew: [], crewBooked: false, renoT: 0, deliveredStage: -1,
    roof: ROOFS[Math.floor(seed * ROOFS.length)],
    wall: type === 'res' ? pick(WALLS) : type === 'shop' ? pick(SHOP_WALLS) : pick(WORK_WALLS),
    awning: pick(AWNINGS), family,
    kind: type === 'res' ? null : (preset && preset.kind) || chooseKind(type, sel),   // the tier decides the pool; the neighbourhood decides the kind (unless the player picked one)
    variant: type === 'res' ? (preset && preset.variant) || pick(TIERS.res[Math.min(3, sel.length)]) : null,
    roofStyle: seed < 0.38 ? 'kawara' : seed < 0.68 ? 'tile' : 'metal',   // grey kawara tiles, pastel tiles, or a corrugated metal roof
  };
  block.name = type === 'res' ? `${pick(PLACE)} ${block.variant === 'manshon' ? pick(['Heights', 'Mansion', 'Court']) : block.variant === 'apartment' ? pick(['Heights', 'Court', 'Residence']) : block.variant === 'terrace' ? 'Terrace' : pick(HOME_SUFFIX)}` : type === 'shop' ? uniqueName(SHOP_NAMES[block.kind]) : type === 'civic' ? uniqueName(CIVIC_NAMES[block.kind]) : type === 'farm' ? uniqueName(FARM_NAMES[block.kind]) : uniqueName(WORK_NAMES[block.kind]);
  if (preset) Object.assign(block, preset);   // a restored block keeps its saved name, palette, stage and level
  for (const c of sel) { const u = makeUnit(block, c); if (type === 'res') u.variant = preset && preset.unitVariants ? preset.unitVariants[block.units.length - 1] || block.variant : block.variant; }   // one look per block, so a terrace or a manshon reads as one building
  block.street = frontRoads(sel);
  for (const c of sel) if (c.park === 'taxi') { c.park = null; c.parkRoad = null; STATION.taxiPark = null; }   // a block standing on the taxis' car park: they go back to the plaza edge
  blocks.push(block);
  rebuildNetwork();
  for (const u of block.units) { const f = FACE[DIR4.map(([di, dj]) => [di, dj, cell(u.cell.i + di, u.cell.j + dj)]).filter(([, , n]) => n && block.street.includes(n)).map(([di, dj]) => di + ',' + dj)[0]]; u.facing = f !== undefined ? f : pickFacing(u); }
  refreshWorld(); for (const u of block.units) rebuildUnitMesh(u);
  return block;
}
const FACINGS = [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]];
/** the sides of a unit that face a street (a door must open onto one) */
function facingOptions(u) { return FACINGS.filter(([di, dj]) => { const n = cell(u.cell.i + di, u.cell.j + dj); return n && n.type === 'road'; }).map(f => f[2]); }
function pickFacing(u) { const o = facingOptions(u); return o.length ? o[0] : 0; }
/** turn a building to face the next street around it; returns false if only one side has a street */
function rotateUnit(u) {
  const o = facingOptions(u); if (o.length < 2) return false;
  const k = o.indexOf(u.facing || 0); u.facing = o[(k + 1) % o.length];
  rebuildUnitMesh(u); for (const fn of worldListeners) fn();   // routes start at the door, so cached paths are stale
  return true;
}
const worldListeners = [];
function onWorldChange(fn) { worldListeners.push(fn); }
const CIVIC_REACH = 6;   // cells (Manhattan): how far a utility's visible effect spreads
/** homes near a finished water works keep greener gardens (`b.watered`); recomputed when the world or a civic block changes */
function refreshCivicFlags() {
  const works = blocks.filter(b => b.type === 'civic' && b.kind === 'waterworks' && b.stage === DONE);
  for (const b of blocks) {
    if (b.type !== 'res') continue;
    const now = works.some(w => w.cells.some(c => b.cells.some(bc => Math.abs(c.i - bc.i) + Math.abs(c.j - bc.j) <= CIVIC_REACH)));
    if (now !== !!b.watered) { b.watered = now; if (b.stage >= DONE) for (const u of b.units) if (u.mesh) rebuildUnitMesh(u); }
  }
}
let wetK = 0;
/** rain darkens the streets: 0 dry, 1 soaked */
const puddleVersionOf = () => puddleVersion;
function setWet(k) { if (Math.abs(k - wetK) < 0.01) return; wetK = k; if (roadMesh) roadMesh.material.color.setScalar(1 - 0.28 * k); }
function refreshWorld() { netCache = null; rebuildRoads(); rebuildDecor(); refreshCivicFlags(); for (const fn of worldListeners) fn(); }
const isDecor = obj => obj === decorMesh;

// ── working hours: every kind of workplace keeps its own day, so the town wakes in stages (the bakery lit before dawn, the
// factory's shift change after lunch, the ramen shop busy late) instead of everyone leaving home at once. open/close are the
// hours customers find it open; shifts are the staff's, taken in turn as people are hired (one shift, or an early and a late one).
const HOURS = {
  bakery: { open: 6, close: 15, shifts: [[5.6, 15]] },
  konbini: { open: 6, close: 22, shifts: [[5.7, 14], [14, 22]] },
  cafe: { open: 7, close: 18, shifts: [[6.6, 14.5], [11, 18.2]] },
  florist: { open: 9, close: 19, shifts: [[8.6, 19.1]] },
  books: { open: 10, close: 20, shifts: [[9.6, 20.1]] },
  ramen: { open: 11, close: 22, shifts: [[10.4, 16.5], [16, 22]] },
  restaurant: { open: 11, close: 21.5, shifts: [[10.4, 16], [15.5, 21.7]] },
  grocery: { open: 9, close: 20, shifts: [[8.5, 15], [14, 20.2]] },
  supermarket: { open: 9, close: 21, shifts: [[8.5, 15], [14.5, 21.2]] },
  arcade: { open: 10, close: 22, shifts: [[9.6, 16], [15.5, 22]] },
  teahouse: { open: 10, close: 17, shifts: [[9.5, 17.2]] },
  ryokan: { open: 6, close: 23.5, shifts: [[6, 14.5], [14, 22]] },
  studio: { shifts: [[9.5, 18.5]] }, office: { shifts: [[8.8, 17.8]] }, workshop: { shifts: [[7.8, 16.8]] }, factory: { shifts: [[5.8, 14], [13.8, 22]] },
  townhall: { shifts: [[8.3, 17.3]] }, clinic: { shifts: [[8.3, 17.5]] }, community: { shifts: [[9, 18]] }, firestation: { shifts: [[7.5, 17.5]] },
  substation: { shifts: [[7.8, 16.3]] }, waterworks: { shifts: [[7.8, 16.3]] }, recycling: { shifts: [[7, 15.5]] }, bathhouse: { open: 15, close: 22, shifts: [[14.4, 22.1]] },
  field: { shifts: [[5.8, 15.5]] }, greenhouse: { shifts: [[6.5, 15.5]] }, paddy: { shifts: [[5.8, 15.5]] },
};
const DEFAULT_HOURS = { shop: { open: 9, close: 20, shifts: [[8.6, 20.1]] }, work: { shifts: [[8.8, 17.8]] }, civic: { shifts: [[8.3, 17.3]] }, farm: { shifts: [[5.8, 15.5]] } };
/** a block's hours: { open, close, shifts } (open/close only for places customers visit) */
const hoursOf = b => HOURS[b.kind || b.variant] || DEFAULT_HOURS[b.type] || DEFAULT_HOURS.work;
/** is this shop open to customers at hour h (0–24)? */
function isOpen(b, h) { const o = hoursOf(b); return o.open === undefined || (h >= o.open && h < o.close); }
/** "6:00–15:00" */
const clock = h => `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
const hoursLabel = b => { const o = hoursOf(b); return o.open !== undefined ? `${clock(o.open)}–${clock(o.close)}` : o.shifts.map(([a, z]) => `${clock(Math.round(a * 2) / 2)}–${clock(Math.round(z * 2) / 2)}`).join(' · '); };
export { HOURS, hoursOf, isOpen, hoursLabel, stationStairs };
export { benchLights, landmarkTrees, lanterns, lightLanterns, updateLanterns, onHillOpened, puddleSpots, puddleVersionOf, setWet, maxLevel, refreshCivicFlags, CIVIC_REACH, placeCarPark, clearCarPark, carParks, parkBay, chooseKind, cells, cell, DIR4, treeSpec, parkCells, rebuildDecor, rebuildRoads, lotAdjacent4, lotAdjacent8, lampGlowMat, placeable, terrainY, connectHillRoads, connectCanal, hill, openHill, HILL_UNLOCK, updateSignals, signalRed, signalState, signalCells,
  blocks, units, CAP, DONE, STAGE_HOURS, STAGE_NAMES, stageHours, TYPE_LABEL, TYPE_COLOR, unitCap, placeBlock, pickFacing, refreshWorld, onWorldChange, isDecor,
  STATION, placeStation, KIND_LABEL, TIERS, tierLabel, wireMat, facingOptions, rotateUnit, frontRoads, hillPlots, isStreet, townNet, joinedToTown, rebuildNetwork, roadRun, drawable, drawRoad, eraseRoad, roadKeepReason };
