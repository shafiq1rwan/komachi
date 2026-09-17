// Komachi — the grid: cells, automatic roads, vegetation, lamp posts, and block/unit records
import * as THREE from 'three';
import { PAL, ROOFS, WALLS, SHOP_WALLS, WORK_WALLS, AWNINGS, FAMILY, HOME_SUFFIX, PLACE, SHOP_NAMES, WORK_NAMES, uniqueName } from './palette.js';
import { pick, hash } from './utils.js';
import { S } from './state.js';
import { scene, N, HALF, cx, cz, townGroup } from './scene.js';
import { box, blob, cyl, colorize, mergeMesh, makeGlow, glowMat, lampHeadMat, swayMat, coneMat, lightCone } from './geometry.js';
import { TERRACE, hillCentre, cellHash } from './island.js';
import { isLand, coastDist, terraceInfo } from './island.js';
import { biome } from './biome.js';
import { rebuildUnitMesh } from './buildings.js';

const cells = [];
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) cells.push({ i, j, type: 'empty', block: null, unit: null, tree: null, h: 0, ramp: null, keep: false, dyn: false, link: false });
const cell = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? null : cells[j * N + i];
/** ground height under a world point: terrace height, or a slope across a ramp cell */
function terrainY(x, z) {
  const c = cell(Math.floor(x + HALF), Math.floor(z + HALF)); if (!c) return 0;
  if (c.ramp) { const { di, dj, h0, h1 } = c.ramp; const s = Math.max(0, Math.min(1, (x - cx(c.i)) * di + (z - cz(c.j)) * dj + 0.5)); return h0 + (h1 - h0) * s; }
  return c.h || 0;
}
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
  const ti = terraceInfo(c.i, c.j);
  if (ti) {   // the hill: flat terrace cells are plots at their terrace height; ramps and their ends are permanent roads; the rest is wild
    c.h = ti.level * TERRACE;
    if (ti.ramp) { c.type = 'road'; c.ramp = ti.ramp; c.keep = true; continue; }
    if (ti.keep) { c.type = 'road'; c.keep = true; continue; }
    if (ti.wild) { c.type = 'hill'; continue; }
  }
  const h = hash(c.i, c.j), cl = hash(Math.floor(c.i / 4) + 100, Math.floor(c.j / 4) + 100);
  if (h < (0.06 + cl * 0.3) * biome.treeDensity) c.tree = treeSpec(c.i, c.j);
}

let roadMesh = null, decorMesh = null, lampMesh = null, wireMesh = null, coneMesh = null; const lampHeads = [], lampGlows = [];
const wireMat = new THREE.LineBasicMaterial({ color: '#4a4340', transparent: true, opacity: 0.8 });
const lampGlowMat = glowMat.clone();

let hillDecorMesh = null;
function rebuildDecor() {
  if (decorMesh) { townGroup.remove(decorMesh); decorMesh.geometry.dispose(); }
  if (hillDecorMesh) { townGroup.remove(hillDecorMesh); hillDecorMesh.geometry.dispose(); hillDecorMesh = null; }
  const g = [], gh = [];
  // woods on the wild hill cells: denser than the flat land, heavier on pines, kept off the summit clearing
  for (const c of cells) {
    if (c.type !== 'hill' || !(c.h > 0)) continue;
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
  for (const c of cells) {
    if (c.type !== 'empty' || !c.tree) continue;
    const g0 = g.length;
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
    if (c.h) { for (let k = g0; k < g.length; k++) { g[k].translate(0, c.h, 0); gh.push(g[k]); } g.length = g0; }   // raised plots do not sway
  }
  decorMesh = mergeMesh(g, true); if (decorMesh) { decorMesh.material = swayMat; townGroup.add(decorMesh); }
  hillDecorMesh = mergeMesh(gh, true); if (hillDecorMesh) townGroup.add(hillDecorMesh);
}

function lotAdjacent4(c) { return DIR4.some(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'lot'; }); }
function lotAdjacent8(c) { for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const n = cell(c.i + di, c.j + dj); if (n && n.type === 'lot') return true; } return false; }

function rebuildRoads() {
  if (roadMesh) { scene.remove(roadMesh); roadMesh.geometry.dispose(); }
  if (lampMesh) { scene.remove(lampMesh); lampMesh.geometry.dispose(); }
  if (coneMesh) { scene.remove(coneMesh); coneMesh.geometry.dispose(); coneMesh = null; }
  const cones = [];
  if (wireMesh) { scene.remove(wireMesh); wireMesh.geometry.dispose(); wireMesh = null; }
  const poles = [];
  for (const h of lampHeads) scene.remove(h); for (const g of lampGlows) scene.remove(g); lampHeads.length = 0; lampGlows.length = 0;
  const g = [], lg = [];
  for (const c of cells) {
    if (c.type !== 'road') continue;
    const x = cx(c.i), z = cz(c.j), h = hash(c.i, c.j);
    const asp = h < 0.5 ? PAL.asphalt : PAL.asphalt2;
    if (c.ramp) {   // a slope road up to the next terrace: tilted asphalt with a pavement band each side
      const { di, dj, h0, h1 } = c.ramp, dh = h1 - h0, L = Math.hypot(1, dh), ang = Math.atan2(dh, 1), ry = Math.atan2(di, dj);
      const tilt = geo => { geo.rotateX(-ang); geo.rotateY(ry); return geo; };
      const a = tilt(new THREE.BoxGeometry(1, 0.08, L)); a.translate(x, h0 + dh / 2 + 0.04, z); g.push(colorize(a, PAL.asphalt));
      for (const sgn of [-1, 1]) { const b = tilt(new THREE.BoxGeometry(0.19, 0.1, L)); b.translate(x + dj * 0.405 * sgn, h0 + dh / 2 + 0.05, z - di * 0.405 * sgn); g.push(colorize(b, PAL.sidewalk)); }
      for (const o of [-0.25, 0.25]) { const d = tilt(new THREE.BoxGeometry(0.03, 0.004, 0.22)); d.translate(x + di * o, h0 + dh / 2 + dh * o + 0.082, z + dj * o); g.push(colorize(d, PAL.cream2)); }
      if (c.dyn) {   // a slope the town built: it needs the earth wedge the island gives its own slopes
        const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0.5, dh); sh.closePath();
        const wedge = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); wedge.translate(0, 0, -0.5); wedge.rotateY(Math.atan2(-dj, di)); wedge.translate(x, h0, z); g.push(colorize(wedge, PAL.landSide));
      }
      continue;
    }
    const gy = c.h || 0, g0 = g.length, lg0 = lg.length, hd0 = lampHeads.length, gl0 = lampGlows.length, cn0 = cones.length, po0 = poles.length;
    const nb = DIR4.map(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'road'; });
    // a road cell whose neighbour is a parallel road (two blocks placed two cells apart) is one half of a
    // two-lane avenue: asphalt runs straight across the shared edge with a dashed centre line on it
    const road = q => q && q.type === 'road';
    const dbl = DIR4.map(([di, dj], k) => {
      if (!nb[k]) return false; const n = cell(c.i + di, c.j + dj), pi = di ? 0 : 1, pj = di ? 1 : 0;
      return (road(cell(c.i + pi, c.j + pj)) && road(cell(n.i + pi, n.j + pj))) || (road(cell(c.i - pi, c.j - pj)) && road(cell(n.i - pi, n.j - pj)));
    });
    const open = nb.map((v, k) => v && !dbl[k]);
    // asphalt fills the cell (top 0.08); raised sidewalk bands (top 0.10) sit on the closed edges, with
    // corner squares so the pavement wraps around junction corners; an avenue edge has no pavement at all
    g.push(box(1, 0.08, 1, dbl.some(Boolean) ? PAL.asphalt : asp, x, 0.04, z));   // one shade across an avenue, no seam
    for (let k = 0; k < 4; k++) { const [di, dj] = DIR4[k]; if (!open[k] && !dbl[k]) g.push(box(di ? 0.19 : 1, 0.1, di ? 1 : 0.19, PAL.sidewalk, x + di * 0.405, 0.05, z + dj * 0.405)); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const kx = sx > 0 ? 1 : 3, kz = sz > 0 ? 2 : 0; if (!dbl[kx] && !dbl[kz]) g.push(box(0.19, 0.1, 0.19, PAL.sidewalk, x + sx * 0.405, 0.05, z + sz * 0.405)); }
    for (let k = 0; k < 4; k++) if (dbl[k]) {   // dashed centre line on the shared edge of an avenue, drawn once
      const [di, dj] = DIR4[k];
      if (di + dj > 0) for (const o of [-0.25, 0.25]) g.push(box(di ? 0.03 : 0.22, 0.004, di ? 0.22 : 0.03, PAL.cream2, x + di * 0.5 + dj * o, 0.082, z + dj * 0.5 + di * o));
    }
    const deg = open.filter(Boolean).length, isDbl = dbl.some(Boolean);
    // centre line on straight two-way stretches
    if (!isDbl && deg === 2 && open[0] && open[2]) for (const dz of [-0.24, 0.24]) g.push(box(0.025, 0.004, 0.18, PAL.cream2, x, 0.082, z + dz));
    if (!isDbl && deg === 2 && open[1] && open[3]) for (const dx of [-0.24, 0.24]) g.push(box(0.18, 0.004, 0.025, PAL.cream2, x + dx, 0.082, z));
    if (deg === 2 && h > 0.7) g.push(cyl(0.09, 0.09, 0.012, '#858a8e', x + (h - 0.85) * 0.4, 0.083, z + (h - 0.8) * 0.4, 8));
    // zebra crossing across one arm of a real junction
    if (deg >= 3 && !isDbl && h > 0.45) { const zs = open[0] ? -1 : 1; for (let k = -1; k <= 1; k++) g.push(box(0.08, 0.005, 0.3, PAL.cream2, x + k * 0.16, 0.083, z + zs * 0.62 * 0.6)); }
    for (let k = 0; k < 4; k++) if (open[k] && !isDbl) { const [di, dj] = DIR4[k]; g.push(box(di ? 0.19 : 0.02, 0.012, di ? 0.02 : 0.19, '#d9cdb3', x + di * 0.41 + dj * 0.32, 0.105, z + dj * 0.41 - di * 0.32)); g.push(box(di ? 0.19 : 0.02, 0.012, di ? 0.02 : 0.19, '#d9cdb3', x + di * 0.41 - dj * 0.32, 0.105, z + dj * 0.41 + di * 0.32)); }
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
      // street lamp: a pole on the sidewalk corner, an arm reaching over the road, a housing lit from
      // underneath, a soft beam fading to the ground, and a pool of light on the asphalt
      const px = x + d[0] * 0.4 + d[1] * 0.35, pz = z + d[1] * 0.4 - d[0] * 0.35;
      const ax = -d[0], az = -d[1], ry = Math.atan2(ax, az), top = 1.42;   // arm points away from the lot, over the road
      lg.push(cyl(0.02, 0.032, top - 0.1, PAL.lamp, px, 0.1 + (top - 0.1) / 2, pz, 6));
      lg.push(box(0.12, 0.05, 0.12, PAL.lamp, px, 0.125, pz));
      lg.push(cyl(0.034, 0.034, 0.05, PAL.lamp, px, 0.9, pz, 6));
      const arm = new THREE.BoxGeometry(0.03, 0.03, 0.4); arm.rotateX(-0.3); arm.rotateY(ry); arm.translate(px + ax * 0.19, top + 0.06, pz + az * 0.19); lg.push(colorize(arm, PAL.lamp));
      const hx = px + ax * 0.4, hz = pz + az * 0.4, hy = top + 0.12;
      const housing = new THREE.BoxGeometry(0.13, 0.05, 0.24); housing.rotateY(ry); housing.translate(hx, hy, hz); lg.push(colorize(housing, PAL.lamp));
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.015, 0.2), lampHeadMat); head.rotation.y = ry; head.position.set(hx, hy - 0.03, hz); head.castShadow = false; scene.add(head); lampHeads.push(head);
      cones.push(lightCone(hx, hy - 0.03, hz, 0.07, 0.62, PAL.lampGlow));
      const gl = makeGlow(hx, 0.125, hz, 2.0); gl.material = lampGlowMat; scene.add(gl); lampGlows.push(gl);
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
  if (cones.length) { coneMesh = mergeMesh(cones, false, false); coneMesh.material = coneMat; coneMesh.receiveShadow = false; coneMesh.renderOrder = 6; scene.add(coneMesh); }
}

// ───────────────────────────── blocks & units ─────────────────────────────
const blocks = []; const units = new Map();
const CAP = { res: [0, 2, 4, 6], work: [0, 4, 7, 10], shop: [0, 1, 2, 3] };
// construction: plot → foundation → frame → scaffolding → finishing → DONE. Hours are crew-hours at rate 1.
const DONE = 5;
const STAGE_HOURS = [2, 2.5, 2.5, 2, 2];        // shops, workspaces (~11 crew-hours)
const RES_STAGE_HOURS = [1.5, 2, 2, 1.5, 1.5];  // homes (~8.5 crew-hours, about one working day)
const STAGE_NAMES = ['Surveying the plot', 'Laying foundations', 'Raising the frame', 'Up on the scaffolding', 'Finishing touches'];
const stageHours = b => b.type === 'res' ? RES_STAGE_HOURS : STAGE_HOURS;
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
// A cell can take a building if it is empty, or a street that is not the station's ring and would still have
// a street (road or empty cell) on one side once the whole selection is built, so the door has somewhere to face.
function placeable(c, sel = []) {
  if (!c || (c.type !== 'empty' && c.type !== 'road') || c.keep || c.ramp) return false;
  if (sel.length && (sel[0].h || 0) !== (c.h || 0)) return false;   // one block, one terrace
  if (c.type === 'road') for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const n = cell(c.i + di, c.j + dj); if (n && n.block && n.block.type === 'station') return false; }
  return DIR4.some(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && (n.type === 'road' || n.type === 'empty') && !sel.includes(n); });
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

// ───────────────────────────── the station ─────────────────────────────
// A 3×3 plaza in the middle of the island. Newcomers arrive by underground train and wait here
// until a home has room. Positions below are world coordinates (cell (17,17) is centred on (0.5, 0.5)).
const SC = { i: HALF, j: HALF };                 // centre cell index
const SX = cx(SC.i), SZ = cz(SC.j);
const BENCH_Y = 0.12 + 0.10;                     // seat top, hip height for a box person
const STATION = {
  block: null, anchor: null,                     // anchor = the south-edge unit; its cell touches the ring road
  entrance: new THREE.Vector3(SX, 0.12, SZ + 0.9),
  seats: [], stands: [], vending: [],
};
for (const bx of [-0.25, 0.25]) for (const sx of [-0.09, 0.09])   // two benches on the north edge only; the entrance side is kept clear
  STATION.seats.push({ kind: 'seat', pos: new THREE.Vector3(SX + bx + sx, BENCH_Y - 0.09, SZ - 1.3), rot: 0, taken: null });
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
function placeBlock(type, sel, preset = null) {
  const seed = Math.random();
  const family = pick(FAMILY);
  const block = {
    id: S.nextId++, type, cells: sel.slice(), units: [], stage: 0, stageT: 0, level: 1, occT: 0, visitScore: 0, created: S.T,
    crew: [], crewBooked: false, renoT: 0, deliveredStage: -1,
    roof: ROOFS[Math.floor(seed * ROOFS.length)],
    wall: type === 'res' ? pick(WALLS) : type === 'shop' ? pick(SHOP_WALLS) : pick(WORK_WALLS),
    awning: pick(AWNINGS), family,
    kind: type === 'shop' ? pick(SHOP_KINDS) : type === 'work' ? pick(WORK_KINDS) : null,
    variant: type === 'res' ? (seed < 0.45 ? 'detached' : seed < 0.75 ? 'narrow' : 'apartment') : null,
    roofStyle: seed < 0.6 ? 'tile' : 'metal',
  };
  block.name = type === 'res' ? `${pick(PLACE)} ${block.variant === 'apartment' ? pick(['Heights', 'Court', 'Residence']) : sel.length > 1 ? 'Terrace' : pick(HOME_SUFFIX)}` : type === 'shop' ? uniqueName(SHOP_NAMES[block.kind]) : uniqueName(WORK_NAMES[block.kind]);
  if (preset) Object.assign(block, preset);   // a restored block keeps its saved name, palette, stage and level
  for (const c of sel) { const u = makeUnit(block, c); if (type === 'res') u.variant = preset && preset.unitVariants ? preset.unitVariants[block.units.length - 1] || block.variant : hash(c.i * 3, c.j * 5) < 0.7 ? block.variant : pick(['detached', 'narrow', 'apartment']); }
  ringRoads(sel); connectHillRoads();
  blocks.push(block);
  for (const u of block.units) u.facing = pickFacing(u);
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
function refreshWorld() { rebuildRoads(); rebuildDecor(); for (const fn of worldListeners) fn(); }
const isDecor = obj => obj === decorMesh;

export { cells, cell, DIR4, treeSpec, rebuildDecor, rebuildRoads, lotAdjacent4, lotAdjacent8, lampGlowMat, placeable, terrainY, connectHillRoads,
  blocks, units, CAP, DONE, STAGE_HOURS, STAGE_NAMES, stageHours, TYPE_LABEL, TYPE_COLOR, unitCap, placeBlock, pickFacing, refreshWorld, onWorldChange, isDecor,
  STATION, placeStation, KIND_LABEL, wireMat, facingOptions, rotateUnit };
