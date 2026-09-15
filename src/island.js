// Komachi — the island: an organic coastline from a seeded radial noise curve, with beach terrace,
// rocky stretches, grassy cliff edges, a small pier and a boat, a terraced hill with a shrine opposite
// the pier. Also answers "is this cell land?" and "is it hill?".
import * as THREE from 'three';
import { PAL } from './palette.js';
import { S } from './state.js';
import { mat, blob, cyl, box, mergeMesh, swayMat, colorize } from './geometry.js';
import { scene, HALF } from './scene.js';
import { biome } from './biome.js';

function mulberry(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rng = mulberry(S.seed);

const R0 = HALF - 4.6;                       // base radius; the grid must contain the whole coast
const SX = 1.08, SZ = 0.94;                  // gentle ellipse so the island is not a circle
const harm = [[2, rng() * 6.28, 2.2], [3, rng() * 6.28, 1.5], [5, rng() * 6.28, 0.75], [8, rng() * 6.28, 0.3]];
const shorePhase = [rng() * 6.28, rng() * 6.28];
const TAU = Math.PI * 2;

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

const rippleLayers = [];
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
  for (let k = 0; k < 34; k++) { const rx = rng() * 256, rz = rng() * 256, rr = 10 + rng() * 26; const grd = ctx.createRadialGradient(rx, rz, 0, rx, rz, rr); grd.addColorStop(0, 'rgba(232,246,240,0.55)'); grd.addColorStop(1, 'rgba(232,246,240,0)'); ctx.fillStyle = grd; ctx.beginPath(); ctx.ellipse(rx, rz, rr * 1.6, rr * 0.7, rng() * 3, 0, 6.29); ctx.fill(); }
  const rt = new THREE.CanvasTexture(rc); rt.wrapS = rt.wrapT = THREE.RepeatWrapping; rt.colorSpace = THREE.SRGBColorSpace;
  for (const [rep, y, op] of [[18, -0.776, 0.38], [11, -0.774, 0.22]]) {
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

// ── the hill: three grassy terraces opposite the pier, wooded, with a small shrine on top ──
// hillFrac() is the normalised distance from the hill centre (1 = foot of the lowest terrace);
// hillLevel() gives the terrace (0 = flat ground). Cells on or just around the hill are type 'hill'.
const TERRACE = 0.55, HILL_STEPS = [1, 0.72, 0.42];
const hillTheta = pierTheta !== null ? pierTheta + Math.PI : rng() * TAU;
const [HX, HZ] = coastPoint(hillTheta, -0.4 * radius(hillTheta));
const HR = 3.6, hillPhase = [rng() * TAU, rng() * TAU];
const hct = Math.cos(hillTheta), hst = Math.sin(hillTheta);
function hillOutline(a) { return HR * (1 + 0.16 * Math.sin(2 * a + hillPhase[0]) + 0.09 * Math.sin(3 * a + hillPhase[1])); }
function hillFrac(x, z) {
  const dx = x - HX, dz = z - HZ, u = (dx * hct + dz * hst) / 0.85, v = (-dx * hst + dz * hct) / 1.25;   // squashed radially, stretched along the shore
  return Math.hypot(u, v) / hillOutline(Math.atan2(v, u));
}
function hillLevel(x, z) { const f = hillFrac(x, z); return f < HILL_STEPS[2] ? 3 : f < HILL_STEPS[1] ? 2 : f < HILL_STEPS[0] ? 1 : 0; }
const onHill = (x, z) => hillFrac(x, z) < 1.12;
function hillPoint(a, f) { const r = f * hillOutline(a), u = Math.cos(a) * r * 0.85, v = Math.sin(a) * r * 1.25; return [HX + u * hct - v * hst, HZ + u * hst + v * hct]; }
const hillTop = TERRACE * 3;
{
  for (let k = 0; k < 3; k++) {
    const s = new THREE.Shape();
    for (let n = 0; n < 72; n++) { const [x, z] = hillPoint(n / 72 * TAU, HILL_STEPS[k]); if (n === 0) s.moveTo(x, z); else s.lineTo(x, z); }
    s.closePath();
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: TERRACE + 0.3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.14, bevelSegments: 2 }), [mat(biome.grass), mat(PAL.landSide)]);
    m.rotation.x = Math.PI / 2; m.position.y = TERRACE * (k + 1) - 0.12; m.castShadow = true; m.receiveShadow = true; scene.add(m);
  }
  const g = [];
  // woods: denser than the flat land, more pines, no trees on the terrace lips or the summit clearing
  for (let n = 0; n < 160; n++) {
    const a = rng() * TAU, f = Math.sqrt(rng()) * 0.96; const [x, z] = hillPoint(a, f);
    if (HILL_STEPS.some(s => Math.abs(f - s) < 0.08) || f < 0.3) continue;
    const y = TERRACE * hillLevel(x, z), s = 0.75 + rng() * 0.45, r = rng();
    if (r < 0.45) { g.push(cyl(0.05 * s, 0.07 * s, 0.45 * s, PAL.wood2, x, y + 0.22 * s, z, 5)); g.push(cyl(0.001, 0.34 * s, 0.7 * s, '#7f9b7a', x, y + 0.72 * s, z, 6)); g.push(cyl(0.001, 0.24 * s, 0.5 * s, '#8fae78', x, y + 1.05 * s, z, 6)); }
    else if (r < 0.85) { const tc = biome.treeColors, col = tc[Math.floor(rng() * tc.length)]; g.push(cyl(0.05 * s, 0.07 * s, 0.5 * s, PAL.wood2, x, y + 0.25 * s, z, 5)); g.push(blob(0.34 * s, col, x, y + 0.6 * s, z, 0, 0.95)); }
    else g.push(blob(0.2 * s, rng() < 0.5 ? PAL.bush : PAL.bush2, x, y + 0.12 * s, z, 0, 0.7));
  }
  // a small shrine on the summit, its torii facing the town, stone lanterns, and steps down the town side
  const fx = -hct, fz = -hst;                      // toward the station
  const rx = -fz, rz = fx;                         // right-hand side
  const ang = Math.atan2(fx, fz), y0 = hillTop;
  const put = (geo, fwd, side, y) => { geo.translate(HX + fx * fwd + rx * side, y, HZ + fz * fwd + rz * side); g.push(geo); };
  const rot = geo => { geo.rotateY(ang); return geo; };
  put(rot(box(0.56, 0.36, 0.44, PAL.cream2)), -0.55, 0, y0 + 0.18); put(rot(box(0.72, 0.1, 0.58, PAL.roofSage)), -0.55, 0, y0 + 0.4); put(rot(box(0.46, 0.1, 0.36, PAL.roofSage)), -0.55, 0, y0 + 0.5);
  put(rot(box(0.6, 0.03, 0.6, PAL.concrete)), -0.55, 0, y0 + 0.015);
  for (const side of [-0.24, 0.24]) put(cyl(0.035, 0.04, 0.56, PAL.roofRose, 0, 0, 0, 6), 0.35, side, y0 + 0.28);
  put(rot(box(0.76, 0.06, 0.07, PAL.roofRose)), 0.35, 0, y0 + 0.58); put(rot(box(0.6, 0.045, 0.06, PAL.roofRose)), 0.35, 0, y0 + 0.46);
  for (const side of [-0.5, 0.5]) { put(cyl(0.035, 0.045, 0.28, PAL.concrete, 0, 0, 0, 6), 0.1, side, y0 + 0.14); put(rot(box(0.14, 0.1, 0.14, PAL.concrete)), 0.1, side, y0 + 0.32); put(rot(box(0.18, 0.03, 0.18, PAL.concrete)), 0.1, side, y0 + 0.38); }
  put(rot(box(0.5, 0.02, 1.0, PAL.concrete)), 0.05, 0, y0 + 0.01);
  for (const [lvl, f] of [[3, HILL_STEPS[2]], [2, HILL_STEPS[1]]]) {   // a = π is the town side in hill-local coordinates
    const [ex, ez] = hillPoint(Math.PI, f);
    for (let k = 0; k < 6; k++) { const t = k / 6, y = TERRACE * (lvl - 1) + TERRACE * (1 - t); g.push(box(0.5, 0.06, 0.16, PAL.concrete, ex + fx * (0.5 - t * 0.9), y - 0.03, ez + fz * (0.5 - t * 0.9), ang)); }
  }
  const hm = mergeMesh(g, true); if (hm) scene.add(hm);
}

export { isLand, coastDist, shoreKind, radius, coastPoint, rng as islandRng, updateWater, onHill, hillLevel };
