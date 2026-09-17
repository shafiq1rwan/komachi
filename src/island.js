// Komachi — the island: an organic coastline from a seeded radial noise curve, with beach terrace,
// rocky stretches, grassy cliff edges, a small pier and a boat, a terraced hill with a shrine opposite
// the pier. Also answers "is this cell land?" and "is it hill?".
import * as THREE from 'three';
import { PAL } from './palette.js';
import { S } from './state.js';
import { mat, blob, cyl, box, mergeMesh, swayMat, colorize } from './geometry.js';
import { scene, HALF, N, cx, cz } from './scene.js';
import { biome } from './biome.js';

function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry(S.seed);

const R0 = HALF - 4.6;                       // base radius; the grid must contain the whole coast
const SX = 1.08, SZ = 0.94;                  // gentle ellipse so the island is not a circle
const harm = [[2, rng() * 6.28, 2.2], [3, rng() * 6.28, 1.5], [5, rng() * 6.28, 0.75], [8, rng() * 6.28, 0.3]];
const shorePhase = [rng() * 6.28, rng() * 6.28];
const TAU = Math.PI * 2;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function radius(theta) { let r = R0; for (const [k, p, a] of harm) r += a * Math.sin(k * theta + p); return r; }
function coastPoint(theta, extra = 0) { const r = radius(theta) + extra; return [Math.cos(theta) * r * SX, Math.sin(theta) * r * SZ]; }
/** Signed distance-ish to the coast: positive inland, negative out to sea (in radial units). */
function coastDist(x, z) { const theta = Math.atan2(z / SZ, x / SX); return radius(theta) - Math.hypot(x / SX, z / SZ); }
const isLand = (x, z) => coastDist(x, z) > 0.8;
function shoreValue(theta) { return Math.sin(3 * theta + shorePhase[0]) + 0.7 * Math.sin(4 * theta + shorePhase[1]) + biome.shoreBias; }
function shoreKind(theta) { const v = shoreValue(theta); return v > 0.35 ? 'beach' : v < -0.55 ? 'rock' : 'grass'; }
/** beach terrace width: wide sandy beaches where the shore value is high, a narrow lip along rocky and grassy stretches */
function beachExtra(theta) { const v = Math.max(0, Math.min(1, (shoreValue(theta) + 0.2) / 1.2)); return 0.3 + v * v * 1.2; }
function polygon(extra, n = 180) {
  const s = new THREE.Shape();
  for (let k = 0; k < n; k++) { const t = k / n * TAU; const [x, z] = coastPoint(t, typeof extra === 'function' ? extra(t) : extra); if (k === 0) s.moveTo(x, z); else s.lineTo(x, z); }
  s.closePath(); return s;
}

const rippleLayers = []; let rippleTex = null;   // the ripple tile, shared with the canal
/** drift the ripple textures a little each frame */
function updateWater(dt) { for (const l of rippleLayers) { l.t.offset.x += l.speed[0] * dt; l.t.offset.y += l.speed[1] * dt; } }

// ── land, beach terrace, foam, water ──
{
  const land = new THREE.Mesh(new THREE.ExtrudeGeometry(polygon(0), { depth: 1.5, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 }), [mat(biome.grass), mat(PAL.landSide)]);
  land.rotation.x = Math.PI / 2; land.position.y = -0.2; land.receiveShadow = true; scene.add(land);
  const beach = new THREE.Mesh(new THREE.ExtrudeGeometry(polygon(beachExtra), { depth: 0.4, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 }), mat(biome.sand));
  beach.rotation.x = Math.PI / 2; beach.position.y = -0.58; beach.receiveShadow = true; scene.add(beach);
  const foam = new THREE.Mesh(new THREE.ExtrudeGeometry(polygon(t => beachExtra(t) + 0.6), { depth: 0.1, bevelEnabled: false }), mat(PAL.foam));
  foam.rotation.x = Math.PI / 2; foam.position.y = -0.7; scene.add(foam);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: PAL.water, roughness: 1 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.78; water.receiveShadow = true; scene.add(water);
  // soft ripple layers: a canvas of blurry lighter blobs, tiled and slowly drifted in two directions
  const rc = document.createElement('canvas'); rc.width = rc.height = 256; const ctx = rc.getContext('2d');
  // every streak is drawn at the eight wrapped offsets too, so the tile repeats without visible edges
  for (let k = 0; k < 40; k++) {
    const rx = rng() * 256, rz = rng() * 256, rr = 8 + rng() * 18, rot = rng() * 3, a = 0.3 + rng() * 0.25;
    for (const ox of [-256, 0, 256]) for (const oz of [-256, 0, 256]) {
      const grd = ctx.createRadialGradient(rx + ox, rz + oz, 0, rx + ox, rz + oz, rr * 2.2); grd.addColorStop(0, `rgba(232,246,240,${a})`); grd.addColorStop(0.5, `rgba(232,246,240,${a * 0.35})`); grd.addColorStop(1, 'rgba(232,246,240,0)');
      ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(rx + ox, rz + oz, rr * 2.2, rr * 0.8, rot, 0, 6.29); ctx.fill();
    }
  }
  const rt = new THREE.CanvasTexture(rc); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.colorSpace = THREE.SRGBColorSpace; rippleTex = rt;
  for (const [rep, y, op] of [[16, -0.776, 0.3], [9, -0.774, 0.18]]) {
    const t = rt.clone(); t.needsUpdate = true; t.repeat.set(rep, rep);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: op, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; scene.add(m); rippleLayers.push({ t, speed: rep === 14 ? [0.004, 0.0025] : [-0.002, 0.0035] });
  }
}

// ── shoreline props: rocks, reeds, cliff grass, a pier and a boat ──
let pierTheta = null;
{
  const solid = [], veg = [];
  pierTheta = null;
  for (let t = 0; t < TAU; t += 0.045) {
    const kind = shoreKind(t), r = rng();
    if (kind === 'rock') {
      if (r < 0.7) { const [x, z] = coastPoint(t, 0.1 + rng() * 0.9); solid.push(blob(0.22 + rng() * 0.38, biome.rock[rng() < 0.5 ? 0 : 1], x, -0.55 + rng() * 0.3, z, 0, 0.55 + rng() * 0.3)); }
      if (r < 0.25) { const [x, z] = coastPoint(t, -0.3); solid.push(blob(0.18 + rng() * 0.2, biome.rock[0], x, 0.05, z, 0, 0.6)); }
    } else if (kind === 'beach') {
      if (pierTheta === null && r < 0.3) pierTheta = t;
      if (r < 0.35) { const [x, z] = coastPoint(t, 0.4 + rng() * 0.6); for (let k = 0; k < 4; k++) veg.push(cyl(0.012, 0.02, 0.45 + rng() * 0.25, '#b9c084', x + (rng() - 0.5) * 0.2, -0.28, z + (rng() - 0.5) * 0.2, 4)); }
      if (r > 0.8) { const [x, z] = coastPoint(t, 0.5 + rng() * 0.5); solid.push(blob(0.07, PAL.cream2, x, -0.48, z, 0, 0.5)); }
    } else {
      if (r < 0.45) { const [x, z] = coastPoint(t, -0.25 - rng() * 0.4); veg.push(blob(0.14 + rng() * 0.1, rng() < 0.5 ? PAL.bush : PAL.bush2, x, 0.06, z, 0, 0.6)); }
    }
  }
  // pier on the first beach stretch, pointing out to sea, with a little boat beside it
  if (pierTheta !== null) {
    const [ax, az] = coastPoint(pierTheta, -0.2), [bx, bz] = coastPoint(pierTheta, 2.6);
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    solid.push(box(0.55, 0.06, len, PAL.wood, mx, -0.3, mz, ang));
    for (let k = 0; k < 5; k++) { const f = k / 4; for (const side of [-0.22, 0.22]) { const px = ax + dx * f + Math.cos(ang) * side, pz = az + dz * f - Math.sin(ang) * side; solid.push(cyl(0.035, 0.035, 0.7, PAL.wood2, px, -0.55, pz, 5)); } }
    solid.push(box(0.55, 0.05, 0.05, PAL.wood2, bx, -0.22, bz, ang));
    for (const side of [-0.28, 0.28]) { const f = 0.85; solid.push(cyl(0.02, 0.02, 0.28, PAL.wood2, ax + dx * f + Math.cos(ang) * side, -0.15, az + dz * f - Math.sin(ang) * side, 4)); }
    const boatX = mx + Math.cos(ang) * 0.75, boatZ = mz - Math.sin(ang) * 0.75;
    const fx = Math.sin(ang), fz = Math.cos(ang);   // boat forward = along the pier direction
    solid.push(box(0.3, 0.16, 0.5, PAL.cream2, boatX, -0.72, boatZ, ang));
    const bow = new THREE.BoxGeometry(0.22, 0.16, 0.22); bow.rotateY(Math.PI / 4); bow.rotateY(ang); bow.translate(boatX + fx * 0.3, -0.72, boatZ + fz * 0.3); solid.push(colorize(bow, PAL.cream2));
    solid.push(box(0.24, 0.04, 0.42, '#8fb0c9', boatX, -0.62, boatZ, ang)); solid.push(box(0.16, 0.14, 0.16, '#8fb0c9', boatX - fx * 0.1, -0.54, boatZ - fz * 0.1, ang)); solid.push(box(0.12, 0.06, 0.1, PAL.window, boatX - fx * 0.1 + fx * 0.05, -0.52, boatZ - fz * 0.1 + fz * 0.05, ang));
  }
  // pebbles further out in the water
  for (let k = 0; k < 14; k++) { const t = rng() * TAU; const [x, z] = coastPoint(t, 2.4 + rng() * 3); solid.push(blob(0.25 + rng() * 0.45, biome.rock[1], x, -0.76, z, 0, 0.5)); }
  const sm = mergeMesh(solid, true); if (sm) scene.add(sm);
  const vm = mergeMesh(veg, true); if (vm) { vm.material = swayMat; vm.castShadow = false; scene.add(vm); }
}

// ── the hill: cell-aligned terraces opposite the pier. Each hill cell sits wholly on one terrace, so every
//    terrace cell is a flat plot at its own height; retaining walls run along cell edges. Some cells stay wild
//    and wooded, the summit keeps its shrine, and one slope road per lip on the town side joins the terraces. ──
const TERRACE = 0.55, HILL_STEPS = [1, 0.64, 0.3];
const hillTheta = pierTheta !== null ? pierTheta + Math.PI : rng() * TAU;
const [HX, HZ] = coastPoint(hillTheta, -0.34 * radius(hillTheta));   // far enough out that the town around the station stays flat
const HR = 4.7, hillPhase = [rng() * TAU, rng() * TAU];
const hct = Math.cos(hillTheta), hst = Math.sin(hillTheta);
function hillOutline(a) { return HR * (1 + 0.12 * Math.sin(2 * a + hillPhase[0]) + 0.07 * Math.sin(3 * a + hillPhase[1])); }
function hillFrac(x, z) {
  const dx = x - HX, dz = z - HZ, u = (dx * hct + dz * hst) / 0.9, v = (-dx * hst + dz * hct) / 1.3;   // squashed radially, stretched along the shore
  return Math.hypot(u, v) / hillOutline(Math.atan2(v, u));
}
function hillLevel(x, z) { const f = hillFrac(x, z); return f < HILL_STEPS[2] ? 3 : f < HILL_STEPS[1] ? 2 : f < HILL_STEPS[0] ? 1 : 0; }
const onHill = (x, z) => hillLevel(x, z) > 0;
const hillTop = TERRACE * 3;
const cellHash = (i, j) => { const v = Math.sin(i * 12.9898 + j * 78.233 + S.seed) * 43758.5453; return v - Math.floor(v); };

// ramps: along the grid axis that points from the hill centre toward the town, find each lip and make the
// three cells L (low, flat) → R (slope) → H (high, flat) permanent roads
const ramps = [];
{
  const dir = Math.abs(hct) >= Math.abs(hst) ? [-Math.sign(hct) || -1, 0] : [0, -Math.sign(hst) || -1];
  const ci0 = Math.round(HX + HALF - 0.5), cj0 = Math.round(HZ + HALF - 0.5);
  const at = t => ({ i: ci0 + dir[0] * t, j: cj0 + dir[1] * t });
  const lvl = t => { const c = at(t); return c.i < 0 || c.j < 0 || c.i >= N || c.j >= N ? 0 : hillLevel(cx(c.i), cz(c.j)); };
  for (const k of [1, 0]) {
    let pick = -1;
    for (let t = 1; t < 16 && pick < 0; t++) if (lvl(t - 1) === k + 1 && lvl(t) === k && lvl(t + 1) === k) pick = t;
    if (pick < 0) for (let t = 1; t < 16 && pick < 0; t++) if (lvl(t - 1) === k + 1 && lvl(t) === k) pick = t;
    if (pick < 0) continue;
    ramps.push({ R: at(pick), H: at(pick - 1), L: at(pick + 1), di: -dir[0], dj: -dir[1], h0: k * TERRACE, h1: (k + 1) * TERRACE, level: k });
  }
}
/** what the grid should make of cell (i, j): null off the hill, else { level, ramp, keep, wild } */
function terraceInfo(i, j) {
  for (const r of ramps) {
    if (r.R.i === i && r.R.j === j) return { level: r.level, ramp: r, keep: true, wild: false };
    if (r.H.i === i && r.H.j === j) return { level: r.level + 1, ramp: null, keep: true, wild: false };
    if (r.L.i === i && r.L.j === j) return { level: r.level, ramp: null, keep: true, wild: false };
  }
  const level = hillLevel(cx(i), cz(j)); if (!level) return null;
  return { level, ramp: null, keep: false, wild: level === 3 || cellHash(i, j) < 0.38 };
}
const buildableTerrace = info => !!info && !info.keep && !info.wild;
{
  // terraces: a box per cell (earth sides, grass cap) so tops are flush and walls fall on cell edges; a wedge under each ramp
  const g = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const info = terraceInfo(i, j); if (!info || !info.level) continue;
    const h = info.level * TERRACE, x = cx(i), z = cz(j);
    g.push(box(1, h + 0.05, 1, PAL.landSide, x, (h - 0.15) / 2, z)); g.push(box(1, 0.05, 1, biome.grass, x, h - 0.025, z));
    // where the terrace drops to a lower level: a sloped earth skirt and the odd bush or rock at the foot
    for (const [di, dj] of DIRS) {
      const ni = i + di, nj = j + dj, nInfo = terraceInfo(ni, nj), nl = nInfo ? nInfo.level : 0;
      if (nl >= info.level || (nInfo && nInfo.ramp)) continue;
      const drop = (info.level - nl) * TERRACE, base = nl * TERRACE;
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.18, 0); sh.lineTo(0, drop); sh.closePath();   // wedge: flush with the wall at the top, 0.18 out at the foot
      const w = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); w.translate(0, 0, -0.5); w.rotateY(Math.atan2(-dj, di)); w.translate(x + di * 0.5, base, z + dj * 0.5);   // local +x → outward (di, dj) g.push(colorize(w, PAL.landSide));
      const r = cellHash(i * 11 + di, j * 13 + dj);
      if (r < 0.3) g.push(blob(0.12 + r * 0.2, r < 0.15 ? PAL.bush : PAL.bush2, x + di * 0.6 + (dj ? (r - 0.15) * 2 : 0), base + 0.08, z + dj * 0.6 + (di ? (r - 0.15) * 2 : 0), 0, 0.7));
      else if (r > 0.82) g.push(blob(0.09, biome.rock[0], x + di * 0.62 + (dj ? (r - 0.9) * 3 : 0), base + 0.04, z + dj * 0.62 + (di ? (r - 0.9) * 3 : 0), 0, 0.6));
    }
    if (info.ramp) {
      const r = info.ramp, dh = r.h1 - r.h0; const sh = new THREE.Shape(); sh.moveTo(-0.5, 0); sh.lineTo(0.5, 0); sh.lineTo(0.5, dh); sh.closePath();
      const w = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false }); w.translate(0, 0, -0.5); w.rotateY(Math.atan2(-r.dj, r.di)); w.translate(x, h, z); g.push(colorize(w, PAL.landSide));
    }
  }
  const tm = mergeMesh(g, true); if (tm) { tm.receiveShadow = true; scene.add(tm); }
  const wg = [];
  // the summit shrine: stone platform, a hall with red pillars under a stepped roof, a torii with upturned
  // beam ends facing the town, stone lanterns and an offering box on a flagged path
  const fx = -hct, fz = -hst, rx = -fz, rz = fx, ang = Math.atan2(fx, fz), y0 = hillTop;
  const put = (geo, fwd, side, y) => { geo.translate(HX + fx * fwd + rx * side, y, HZ + fz * fwd + rz * side); wg.push(geo); };
  const rot = geo => { geo.rotateY(ang); return geo; };
  put(rot(box(1.4, 0.08, 1.1, PAL.concrete)), -0.7, 0, y0 + 0.04);                       // platform
  put(rot(box(0.72, 0.42, 0.56, PAL.cream2)), -0.75, 0, y0 + 0.08 + 0.21);               // hall
  for (const sx of [-0.36, 0.36]) for (const fz2 of [-0.28, 0.28]) put(cyl(0.03, 0.03, 0.44, PAL.roofRose, 0, 0, 0, 6), -0.75 + fz2, sx, y0 + 0.08 + 0.22);
  put(rot(box(0.24, 0.3, 0.04, PAL.wood2)), -0.46, 0, y0 + 0.08 + 0.15);                 // doors
  put(rot(box(1.02, 0.06, 0.86, PAL.roofSage)), -0.75, 0, y0 + 0.53);                    // stepped roof
  put(rot(box(0.84, 0.1, 0.7, PAL.roofSage)), -0.75, 0, y0 + 0.6);
  put(rot(box(0.6, 0.1, 0.5, PAL.roofSage)), -0.75, 0, y0 + 0.69);
  put(rot(box(0.7, 0.05, 0.07, PAL.wood2)), -0.75, 0, y0 + 0.77);                        // ridge beam
  for (const side of [-0.4, 0.4]) put(cyl(0.045, 0.05, 0.78, PAL.roofRose, 0, 0, 0, 8), 0.55, side, y0 + 0.39);   // torii pillars
  put(rot(box(1.12, 0.08, 0.1, PAL.roofRose)), 0.55, 0, y0 + 0.81);                       // kasagi
  for (const side of [-0.56, 0.56]) { const cap = new THREE.BoxGeometry(0.14, 0.08, 0.1); cap.rotateZ(side > 0 ? 0.35 : -0.35); put(rot(colorize(cap, PAL.roofRose)), 0.55, side, y0 + 0.84); }
  put(rot(box(0.95, 0.05, 0.08, PAL.roofRose)), 0.55, 0, y0 + 0.64);                      // nuki
  put(rot(box(0.1, 0.14, 0.04, PAL.cream2)), 0.55, 0, y0 + 0.72);                         // plaque
  put(rot(box(0.46, 0.02, 1.5, PAL.concrete)), 0.0, 0, y0 + 0.01);                        // flagged path
  for (const side of [-0.55, 0.55]) { put(cyl(0.04, 0.05, 0.3, PAL.concrete, 0, 0, 0, 6), 0.15, side, y0 + 0.15); put(rot(box(0.16, 0.12, 0.16, PAL.concrete)), 0.15, side, y0 + 0.36); put(rot(box(0.22, 0.03, 0.22, PAL.concrete)), 0.15, side, y0 + 0.43); }
  put(rot(box(0.22, 0.12, 0.16, PAL.wood)), -0.28, 0, y0 + 0.14);                         // offering box
  const hm = mergeMesh(wg, true); if (hm) scene.add(hm);
}

const hillCentre = { x: HX, z: HZ, fx: -hct, fz: -hst, top: hillTop };

// ── the canal: a gently meandering channel from shore to shore on the pier's side of the island, clear of the
//    town centre and the hill. Cells are keyed "i,j". The coast road follows the beach just inland, one cell
//    wide, breaking only at the hill; where it meets the canal it crosses on a bridge. ──
const key = (i, j) => i + ',' + j;
const canalCells = new Set(), canalOrder = [], coastCells = new Set();
{
  // the coast road: sixteen points just inside the beach joined by L-shaped runs (grid roads cannot go diagonal, and
  // long straight runs with a few corners read far better than a one-cell sawtooth). Hill cells break the road.
  const stops = []; for (let k = 0; k < 8; k++) { const [x, z] = coastPoint((k + 0.5) / 8 * TAU, -3.0); stops.push([Math.floor(x + HALF), Math.floor(z + HALF)]); }   // eight stops: a rounded rectangle, corners on the diagonals
  const skipRoad = (i, j) => !!terraceInfo(i, j) || coastDist(cx(i), cz(j)) <= 0.8;
  const run = (a, b) => { const out = []; let [i, j] = a; while (i !== b[0]) { i += Math.sign(b[0] - i); out.push([i, j]); } while (j !== b[1]) { j += Math.sign(b[1] - j); out.push([i, j]); } return out; };
  for (let k = 0; k < 8; k++) {
    const a = stops[k], b = stops[(k + 1) % 8];
    const viaX = run(a, b), viaZ = run(a, [a[0], b[1]]).concat(run([a[0], b[1]], b));   // corner at (b.x, a.z) or (a.x, b.z)
    const inland = path => path.reduce((m, [i, j]) => Math.min(m, coastDist(cx(i), cz(j))), 99);
    const path = inland(viaZ) > inland(viaX) ? viaZ : viaX;
    for (const [i, j] of [a, ...path]) if (!skipRoad(i, j)) coastCells.add(key(i, j));
  }

  const base = pierTheta !== null ? pierTheta : rng() * TAU;
  for (let attempt = 0; attempt < 12 && !canalCells.size; attempt++) {
    const th = base + (attempt % 2 ? -1 : 1) * Math.ceil(attempt / 2) * 0.35, phi = rng() * TAU;
    const nx = Math.cos(th), nz = Math.sin(th), vx = -nz, vz = nx, off = 8.8;
    // a few points along a bowed curve, joined by straight runs with right-angle corners (a diagonal canal would be a staircase)
    const stops = []; for (let t = -16; t <= 16; t += 4) { const m = 1.1 * Math.sin(t * 0.33 + phi) + 0.028 * t * t; const x = nx * (off + m) + vx * t, z = nz * (off + m) + vz * t; stops.push([Math.floor(x + HALF), Math.floor(z + HALF)]); }
    const cellsHere = []; let bad = false; const seen = new Set();
    const lrun = (a, b) => { const out = []; let [i, j] = a; while (i !== b[0]) { i += Math.sign(b[0] - i); out.push([i, j]); } while (j !== b[1]) { j += Math.sign(b[1] - j); out.push([i, j]); } return out; };
    for (let k = 0; k < stops.length - 1; k++) {
      const a = stops[k], b = stops[k + 1], viaX = lrun(a, b), viaZ = lrun(a, [a[0], b[1]]).concat(lrun([a[0], b[1]], b));
      const path = (k % 2 ? viaZ : viaX);
      for (const c of [a, ...path]) { const x = cx(c[0]), z = cz(c[1]); if (c[0] < 0 || c[1] < 0 || c[0] >= N || c[1] >= N || coastDist(x, z) <= 0.8) continue; if (terraceInfo(c[0], c[1]) || Math.hypot(x, z) < 7.2) bad = true; const kk = key(...c); if (!seen.has(kk)) { seen.add(kk); cellsHere.push(c); } }
    }
    // never run along the coast road: two consecutive canal cells on it would make a bridge with water both sides
    for (let k = 0; k + 1 < cellsHere.length && !bad; k++) if (coastCells.has(key(...cellsHere[k])) && coastCells.has(key(...cellsHere[k + 1]))) bad = true;
    if (bad || cellsHere.length < 8) continue;
    for (const c of cellsHere) { canalCells.add(key(...c)); canalOrder.push(c); }
  }
}
const isCanal = (i, j) => canalCells.has(key(i, j)), isCoastRoad = (i, j) => coastCells.has(key(i, j));
// the channel: sunken water with stone banks on every side that has no canal neighbour, reeds and a heron
{
  const g = [], veg = [], wat = [];   // wat: the water tops again, for the drifting ripple overlay
  // the land mesh is solid down from y 0, so the channel sits on it: dark bed, water just above ground, low stone walls
  const WATER = 0.02, TOP = 0.1, wall = biome.rock[0], coping = PAL.concrete;
  for (const [i, j] of canalOrder) {
    const x = cx(i), z = cz(j), nb = DIRS.map(([di, dj]) => isCanal(i + di, j + dj) || coastDist(cx(i + di), cz(j + dj)) <= 0.8);
    g.push(box(0.78, 0.02, 0.78, PAL.canal, x, WATER, z)); wat.push(box(0.78, 0.01, 0.78, PAL.canal, x, WATER + 0.008, z));
    g.push(box(0.9, 0.02, 0.9, PAL.canalBed, x, WATER - 0.012, z));   // a dark bed below the water
    let mouthK = -1, mouthL = 99;
    nb.forEach((open, k) => { if (!open || isCanal(i + DIRS[k][0], j + DIRS[k][1])) return; const [di, dj] = DIRS[k]; let L = 0.5; while (L < 6 && coastDist(x + di * L, z + dj * L) > 0) L += 0.1; if (L < mouthL) { mouthL = L; mouthK = k; } });
    nb.forEach((open, k) => { const [di, dj] = DIRS[k]; if (open) { g.push(box(di ? 0.12 : 0.78, 0.02, di ? 0.78 : 0.12, PAL.canal, x + di * 0.44, WATER, z + dj * 0.44));
        if (!isCanal(i + di, j + dj) && k !== mouthK) { g.push(box(di ? 0.11 : 1, TOP, di ? 1 : 0.11, wall, x + di * 0.445, TOP / 2, z + dj * 0.445)); g.push(box(di ? 0.13 : 1, 0.025, di ? 1 : 0.13, coping, x + di * 0.445, TOP + 0.012, z + dj * 0.445)); }   // a second sea-facing side is walled
        if (!isCanal(i + di, j + dj) && k === mouthK) {   // the mouth: the channel runs on to the coastline, then the water steps down the beach into the sea
          const L = mouthL;
          const cl = L - 0.5, cpx = x + di * (0.5 + cl / 2), cpz = z + dj * (0.5 + cl / 2);
          g.push(box(di ? cl : 0.78, 0.02, di ? 0.78 : cl, PAL.canal, cpx, WATER, cpz)); wat.push(box(di ? cl : 0.78, 0.01, di ? 0.78 : cl, PAL.canal, cpx, WATER + 0.008, cpz));
          g.push(box(di ? cl : 0.9, 0.02, di ? 0.9 : cl, PAL.canalBed, cpx, WATER - 0.012, cpz));
          for (const s of [-1, 1]) { g.push(box(di ? cl : 0.11, TOP, di ? 0.11 : cl, wall, cpx + (di ? 0 : s * 0.445), TOP / 2, cpz + (di ? s * 0.445 : 0))); g.push(box(di ? cl : 0.13, 0.025, di ? 0.13 : cl, coping, cpx + (di ? 0 : s * 0.445), TOP + 0.012, cpz + (di ? s * 0.445 : 0))); }
          let B = 0.2; while (B < 3 && coastDist(x + di * (L + B), z + dj * (L + B)) > -beachExtra(Math.atan2((z + dj * (L + B)) / SZ, (x + di * (L + B)) / SX))) B += 0.1;   // the beach's width here
          const steps = [[B / 2, B, -0.48]];   // one step down onto the beach; the sea takes it from there   // [distance past the shore to the step's centre, its length, its water height]
          for (const [d, len, wy] of steps) {
            const px = x + di * (L + d), pz = z + dj * (L + d);
            g.push(box(di ? len : 0.78, 0.02, di ? 0.78 : len, PAL.canal, px, wy, pz)); g.push(box(di ? len : 0.86, 0.02, di ? 0.86 : len, PAL.canalBed, px, wy - 0.012, pz));
            g.push(box(0.78, 0.03, 0.78, PAL.foam, x + di * (L + d - len / 2 + 0.12), wy + 0.01, z + dj * (L + d - len / 2 + 0.12)));   // a lip of foam where the water lands
          }
          for (const s of [-1, 1]) g.push(blob(0.12, wall, x + di * (L + 0.1) + (di ? 0 : s * 0.42), -0.42, z + dj * (L + 0.1) + (dj ? 0 : s * 0.42), 0, 0.6));   // rocks at the drop
        }      }
      else { g.push(box(di ? 0.11 : 1, TOP, di ? 1 : 0.11, wall, x + di * 0.445, TOP / 2, z + dj * 0.445)); g.push(box(di ? 0.13 : 1, 0.025, di ? 1 : 0.13, coping, x + di * 0.445, TOP + 0.012, z + dj * 0.445)); } });
    if (cellHash(i * 3, j * 7) < 0.45) { const side = DIRS.findIndex((_, k) => !nb[k]); if (side >= 0) { const [di, dj] = DIRS[side]; for (let k = 0; k < 4; k++) veg.push(cyl(0.012, 0.02, 0.4 + cellHash(i + k, j) * 0.25, '#b9c084', x + di * 0.56 + (cellHash(k, i) - 0.5) * 0.25 * (dj ? 1 : 0.3), 0.2, z + dj * 0.56 + (cellHash(j, k) - 0.5) * 0.25 * (di ? 1 : 0.3), 4)); } }
  }
  if (canalOrder.length) {   // a grey heron standing on the coping, looking along the water
    const [i, j] = canalOrder[Math.floor(canalOrder.length * 0.6)], x = cx(i), z = cz(j);
    const side = DIRS.findIndex(([di, dj]) => !isCanal(i + di, j + dj)); const [di, dj] = DIRS[side >= 0 ? side : 0];
    const hx = x + di * 0.415, hz = z + dj * 0.415, y0 = TOP + 0.03;
    for (const o of [-0.02, 0.02]) g.push(box(0.008, 0.16, 0.008, '#e0b070', hx + o, y0 + 0.08, hz));
    g.push(box(0.09, 0.07, 0.15, '#9fb3bf', hx, y0 + 0.2, hz)); g.push(box(0.025, 0.14, 0.025, '#c7d3d8', hx, y0 + 0.3, hz + 0.05)); g.push(box(0.045, 0.04, 0.05, '#c7d3d8', hx, y0 + 0.38, hz + 0.06)); g.push(box(0.012, 0.012, 0.07, '#e0b070', hx, y0 + 0.38, hz + 0.11));
  }
  const cm = mergeMesh(g, true); if (cm) { cm.receiveShadow = true; scene.add(cm); }
  if (wat.length) {   // ripples drift along the canal so the water reads as moving
    const t = rippleTex.clone(); t.needsUpdate = true; t.repeat.set(0.7, 0.7);
    const wm = mergeMesh(wat, false, false); wm.material = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.5, depthWrite: false }); wm.renderOrder = 3; scene.add(wm);
    rippleLayers.push({ t, speed: [0.05, 0.02] });
  }
  const vm = mergeMesh(veg, true); if (vm) { vm.material = swayMat; vm.castShadow = false; scene.add(vm); }
}
const islandEllipse = [SX, SZ];
export { isLand, coastDist, shoreKind, radius, coastPoint, rng as islandRng, updateWater, onHill, hillLevel, terraceInfo, buildableTerrace, TERRACE, hillCentre, cellHash, polygon, beachExtra, islandEllipse, isCanal, isCoastRoad, canalCells };
