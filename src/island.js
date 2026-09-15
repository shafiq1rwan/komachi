// Komachi — the island: an organic coastline from a seeded radial noise curve, with beach terrace,
// rocky stretches, grassy cliff edges, a small pier and a boat. Also answers "is this cell land?".
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
}

// ── shoreline props: rocks, reeds, cliff grass, a pier and a boat ──
{
  const solid = [], veg = [];
  let pierTheta = null;
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

export { isLand, coastDist, shoreKind, radius, coastPoint, rng as islandRng };
