// Komachi — the island: an organic coastline from a seeded radial noise curve, with beach terrace,
// rocky stretches, grassy cliff edges, a small pier and a boat, a terraced hill with a shrine opposite
// the pier. Also answers "is this cell land?" and "is it hill?".
import * as THREE from 'three';
import { makeSeaMaterial, tickWater } from './water.js';
import { PAL } from './palette.js';
import { S } from './state.js';
import { mat, blob, cyl, box, mergeMesh, swayMat, colorize, snowKit } from './geometry.js';
import { scene, HALF, N, cx, cz } from './scene.js';
import { biome } from './biome.js';
import { createLandmark } from './landmark-kit.js';
import { createFishingBoat } from './watercraft.js';

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

// The rich view has a built waterfront: a narrow public walk above a coursed stone wall.
// It follows the exact seeded coast, so the water and buildable cells keep their shape.
function waterfrontBand(inner, outer, y, n = 240) {
  const positions = [], colors = [];
  const shades = PAL.waterfront.paving.map(c => new THREE.Color(c));
  const quad = (a, b, c, d, color) => {
    for (const p of [a, b, c, a, c, d]) { positions.push(...p); colors.push(color.r, color.g, color.b); }
  };
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, b = (k + 1) / n * TAU;
    const p = coastPoint(a, inner), q = coastPoint(b, inner), r = coastPoint(b, outer), s = coastPoint(a, outer);
    quad([p[0], y, p[1]], [q[0], y, q[1]], [r[0], y, r[1]], [s[0], y, s[1]], shades[k % shades.length]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  m.receiveShadow = true; m.userData.lookOnly = 'rich'; m.visible = S.look === 'rich'; return m;
}
function addRichWaterfront() {
  const wall = [], colors = [], n = 200, courses = 4;
  const stones = PAL.waterfront.stone.map(c => new THREE.Color(c));
  for (let row = 0; row < courses; row++) {
    const top = -0.16 - row * 0.165, bottom = top - 0.163;
    for (let k = 0; k < n; k++) {
      const a = (k + (row % 2) * 0.5) / n * TAU, b = (k + 1 + (row % 2) * 0.5) / n * TAU;
      const p = coastPoint(a, 0.28), q = coastPoint(b, 0.28), c = stones[(k * 7 + row * 3) % stones.length];
      for (const v of [[p[0], top, p[1]], [q[0], top, q[1]], [q[0], bottom, q[1]], [p[0], top, p[1]], [q[0], bottom, q[1]], [p[0], bottom, p[1]]]) {
        wall.push(...v); colors.push(c.r, c.g, c.b);
      }
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wall, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  m.castShadow = true; m.receiveShadow = true; m.userData.lookOnly = 'rich'; m.visible = S.look === 'rich'; scene.add(m);
  scene.add(waterfrontBand(-0.5, 0.29, -0.151));
  scene.add(waterfrontBand(0.14, 0.34, -0.112));
}
const rippleLayers = []; let rippleTex = null;   // the ripple tile, shared with the canal
/** drift the ripple textures a little each frame */
function updateWater(dt) { tickWater(dt); for (const l of rippleLayers) { l.t.offset.x += l.speed[0] * dt; l.t.offset.y += l.speed[1] * dt; } }

// ── land, beach terrace, foam, water ──
{
  const landTop = mat(biome.grass).clone(); landTop.color.set(S.look === 'rich' ? '#9db68a' : biome.grass);
  const land = new THREE.Mesh(new THREE.ExtrudeGeometry(polygon(0), { depth: 1.5, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 }), [landTop, mat(PAL.landSide)]);
  land.rotation.x = Math.PI / 2; land.position.y = -0.2; land.receiveShadow = true; land.userData.lookColors = { classic: biome.grass, rich: '#9db68a' }; scene.add(land);
  const beach = new THREE.Mesh(new THREE.ExtrudeGeometry(polygon(beachExtra), { depth: 0.4, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 1 }), mat(biome.sand));
  beach.rotation.x = Math.PI / 2; beach.position.y = -0.58; beach.receiveShadow = true; beach.userData.lookOnly = 'classic'; beach.visible = S.look !== 'rich'; scene.add(beach);
  const foam = new THREE.Mesh(new THREE.ExtrudeGeometry(polygon(t => beachExtra(t) + 0.6), { depth: 0.1, bevelEnabled: false }), mat(PAL.foam));
  foam.rotation.x = Math.PI / 2; foam.position.y = -0.7; foam.userData.lookOnly = 'classic'; foam.visible = S.look !== 'rich'; scene.add(foam);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), makeSeaMaterial(harm, R0, SX, SZ));   // calm bay water, shaded in water.js
  water.rotation.x = -Math.PI / 2; water.position.y = -0.78; water.receiveShadow = true; water.name = 'sea'; scene.add(water);
  addRichWaterfront();
  // the ripple tile (blurry lighter blobs): the canal's drifting overlay uses it; the sea draws its own waves in water.js
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
}

// ── shoreline props: rocks, reeds, cliff grass, a pier and a boat ──
let pierTheta = null, shoreVeg = []; const seaRocks = []; let pierInfo = null;   // pierInfo: the stone quay's frame, deck height and fishing spots (landmarks.js)   // seaRocks: boulders out in the water {x, z, r}, for the ferry to steer clear of
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
      if (r > 0.8) { coastPoint(t, 0.5 + rng() * 0.5); }   // (pale pebbles here floated on the water once the beach went; the draws keep the island's seed stable)
    } else {
      if (r < 0.45) { const [x, z] = coastPoint(t, -0.25 - rng() * 0.4); veg.push(blob(0.14 + rng() * 0.1, rng() < 0.5 ? PAL.bush : PAL.bush2, x, 0.06, z, 0, 0.6)); }
    }
  }
  // the stone quay on the first beach stretch, pointing out to sea: a pale concrete deck just below the town's ground on coursed
  // stone walls, a T-head at the end with steps down to the water on one side, bollards along the edges and a lamp on the head;
  // the little boat is moored alongside. People fish from its edges (landmarks.js reads pierInfo)
  if (pierTheta !== null) {
    const [ax, az] = coastPoint(pierTheta, -0.45), [bx, bz] = coastPoint(pierTheta, 2.3);
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
    const fx = Math.sin(ang), fz = Math.cos(ang), sx = Math.cos(ang), sz = -Math.sin(ang);   // along the quay, and across it
    const W = 0.72, D = -0.147, BOT = -0.9, HW = 1.5, HD = 0.62;   // slab surface meets the waterfront coping at -0.112
    const at = (a, s, y = 0) => [ax + fx * a + sx * s, y, az + fz * a + sz * s];
    const { stone: stones, paving, iron, lamp, light } = PAL.waterfront;
    const stone = index => stones[((index % stones.length) + stones.length) % stones.length];
    const slab = (w, h, d, c, a, s, y) => { const [x, , z] = at(a, s); solid.push(box(w, h, d, c, x, y, z, ang)); };
    slab(W, D - BOT, len, stones[1], len / 2, 0, (D + BOT) / 2);                                   // the arm's core
    slab(HW, D - BOT, HD, stones[1], len - HD / 2, 0, (D + BOT) / 2);                              // the head's core
    for (let a = 0; a < len - HD; a += 0.34) {
      const end = Math.min(a + 0.33, len - HD);
      slab(W + 0.03, 0.035, end - a, paving[Math.round(a / 0.34) % paving.length], (a + end) / 2, 0, D + 0.0175);
    }
    for (let s = -HW / 2; s < HW / 2; s += 0.36) {
      const end = Math.min(s + 0.35, HW / 2);
      slab(end - s, 0.035, HD, paving[Math.round((s + HW / 2) / 0.36) % paving.length], len - HD / 2, (s + end) / 2, D + 0.0175);
    }
    // coursed stone on the arm's two sides and round the head: blocks in rows, staggered, a shade apart
    const course = (a0, a1, s) => { for (let row = 0; row < 4; row++) { const y1 = -0.16 - row * 0.165, off = (row % 2) * 0.13; for (let a = a0 - off; a < a1; a += 0.26) { const aa = Math.max(a0, a), bb = Math.min(a1, a + 0.25); if (bb - aa < 0.04) continue; slab(0.03, 0.163, bb - aa, stone(row * 3 + Math.round(a * 7)), (aa + bb) / 2, s, y1 - 0.0815); } } };
    for (const side of [-1, 1]) course(0, len - HD, side * (W / 2 + 0.012));
    for (const side of [-1, 1]) course(len - HD, len, side * (HW / 2 + 0.012));
    for (let row = 0; row < 4; row++) { const y1 = -0.16 - row * 0.165, off = (row % 2) * 0.13; for (let s = -HW / 2 - off; s < HW / 2; s += 0.26) { const s0 = Math.max(-HW / 2, s), s1 = Math.min(HW / 2, s + 0.25); if (s1 - s0 < 0.04) continue; const [x, , z] = at(len + 0.012, (s0 + s1) / 2); solid.push(box(s1 - s0, 0.163, 0.03, stone(row + Math.round(s * 5)), x, y1 - 0.0815, z, ang)); } }
    // steps down to the water on the head's left side
    for (let k = 0; k < 5; k++) {
      const top = D - 0.07 - k * 0.12;
      slab(0.14, top - BOT, HD * 0.7, stone(k), len - HD / 2, -(HW / 2 + 0.07 + k * 0.14), (top + BOT) / 2);
    }
    // bollards along the edges and on the head, and a lamp at the head's far corner
    for (let a = 0.5; a < len - HD; a += 0.8) for (const side of [-1, 1]) { const [x, , z] = at(a, side * (W / 2 - 0.06)); solid.push(cyl(0.028, 0.034, 0.08, iron, x, D + 0.075, z, 8)); solid.push(cyl(0.036, 0.036, 0.015, iron, x, D + 0.12, z, 8)); }
    for (const s of [-HW / 2 + 0.07, HW / 2 - 0.07]) { const [x, , z] = at(len - 0.07, s); solid.push(cyl(0.028, 0.034, 0.08, iron, x, D + 0.075, z, 8)); }
    { const [x, , z] = at(len - HD + 0.08, HW / 2 - 0.1); solid.push(cyl(0.018, 0.024, 0.62, lamp, x, D + 0.33, z, 6)); solid.push(box(0.1, 0.05, 0.1, light, x, D + 0.66, z, ang)); solid.push(box(0.13, 0.025, 0.13, lamp, x, D + 0.7, z, ang)); }
    // where people fish: along both edges of the outer half of the arm and round the head, facing the water
    const spots = [];
    for (const a of [len * 0.45, len * 0.62]) for (const side of [-1, 1]) spots.push({ a, s: side * (W / 2 - 0.1), face: Math.atan2(sx * side, sz * side) });
    for (const s of [-0.45, 0, 0.45]) spots.push({ a: len - 0.1, s, face: ang });
    for (const side of [-1, 1]) spots.push({ a: len - HD / 2, s: side * (HW / 2 - 0.1), face: Math.atan2(sx * side, sz * side) });
    pierInfo = { theta: pierTheta, ang, len, deckY: D, width: W, headWidth: HW, headDepth: HD, root: new THREE.Vector3(ax, 0, az), at: (a, s) => { const [x, , z] = at(a, s); return new THREE.Vector3(x, D + 0.035, z); },   // standing on the deck slabs
      spots: spots.map(p => ({ ...p, pos: new THREE.Vector3(...at(p.a, p.s, D + 0.035)), taken: 0 })) };
    const berth = new THREE.Group(); berth.name = 'quay-boat';
    const [boatX, , boatZ] = at(len - 0.15, HW / 2 + 0.33); // beyond the beach, clear of the head and steps
    berth.position.set(boatX, -0.76, boatZ); berth.rotation.y = ang; scene.add(berth);
    createFishingBoat().then(model => berth.add(model)).catch(err => console.warn('Komachi: quay boat model skipped', err));
  }
  // pebbles further out in the water
  seaRocks.length = 0;
  for (let k = 0; k < 14; k++) { const t = rng() * TAU; const [x, z] = coastPoint(t, 2.4 + rng() * 3), r = 0.25 + rng() * 0.45; solid.push(blob(r, biome.rock[1], x, -0.76, z, 0, 0.5)); seaRocks.push({ x, z, r }); }
  const sm = mergeMesh(solid, true); if (sm) scene.add(sm);
  shoreVeg = veg;   // merged once the canal is known, so nothing grows in its mouth
}

// ── the hill: cell-aligned terraces opposite the pier. Each hill cell sits wholly on one terrace, so every
//    terrace cell is a flat plot at its own height; retaining walls run along cell edges. Some cells stay wild
//    and wooded, the summit keeps its shrine, and one slope road per lip on the town side joins the terraces. ──
const TERRACE = 0.55, HILL_STEPS = [1, 0.64, 0.3];
const hillTheta = pierTheta !== null ? pierTheta + Math.PI : rng() * TAU;
const [HX, HZ] = coastPoint(hillTheta, -0.34 * radius(hillTheta));   // far enough out that the town around the station stays flat
const HR = 4.7, hillPhase = [rng() * TAU, rng() * TAU];
const hct = Math.cos(hillTheta), hst = Math.sin(hillTheta);
const shrineDir = Math.abs(hct) >= Math.abs(hst) ? [-Math.sign(hct) || -1, 0] : [0, -Math.sign(hst) || -1];   // the slope roads' axis, toward the town: the shrine faces along it
function hillOutline(a) { return HR * (1 + 0.12 * Math.sin(2 * a + hillPhase[0]) + 0.07 * Math.sin(3 * a + hillPhase[1])); }
function hillFrac(x, z) {
  const dx = x - HX, dz = z - HZ, u = (dx * hct + dz * hst) / 0.9, v = (-dx * hst + dz * hct) / 1.3;   // squashed radially, stretched along the shore
  return Math.hypot(u, v) / hillOutline(Math.atan2(v, u));
}
function hillLevel(x, z) { const f = hillFrac(x, z); return f < HILL_STEPS[2] ? 3 : f < HILL_STEPS[1] ? 2 : f < HILL_STEPS[0] ? 1 : 0; }
const onHill = (x, z) => hillLevel(x, z) > 0;
const hillTop = TERRACE * 3;
const cellHash = (i, j) => { const v = Math.sin(i * 12.9898 + j * 78.233 + S.seed) * 43758.5453; return v - Math.floor(v); };

const cellLevel = (x, z) => hillLevel(cx(Math.floor(x + HALF)), cz(Math.floor(z + HALF)));   // the terrace level of the cell under a point
const shrineAxis = (() => {
  const fx = shrineDir[0], fz = shrineDir[1], x = fx ? HX : cx(Math.round(HX + HALF - 0.5)), z = fz ? HZ : cz(Math.round(HZ + HALF - 0.5));
  let edge = 0.3; while (edge < 3 && cellLevel(x + fx * (edge + 0.02), z + fz * (edge + 0.02)) >= 3) edge += 0.02;   // by cell: the terraces are drawn cell by cell
  return { x, z, edge };
})();
// ramps: along the grid axis that points from the hill centre toward the town, find each lip and make the
// three cells L (low, flat) → R (slope) → H (high, flat) permanent roads
const ramps = [];
{
  const dir = Math.abs(hct) >= Math.abs(hst) ? [-Math.sign(hct) || -1, 0] : [0, -Math.sign(hst) || -1];
  const ci0 = Math.round(HX + HALF - 0.5), cj0 = Math.round(HZ + HALF - 0.5);
  const at = t => ({ i: ci0 + dir[0] * t, j: cj0 + dir[1] * t });
  const lvl = t => { const c = at(t); return c.i < 0 || c.j < 0 || c.i >= N || c.j >= N ? 0 : hillLevel(cx(c.i), cz(c.j)); };
  let prev = -9;   // the previous ramp's slope cell: the next ramp starts past its foot, and that foot counts as the higher level
  for (const k of [1, 0]) {
    let pick = -1; const hi = t => lvl(t) === k + 1 || t === prev + 1;
    for (let t = Math.max(1, prev + 2); t < 16 && pick < 0; t++) if (hi(t - 1) && lvl(t) === k && lvl(t + 1) === k) pick = t;
    if (pick < 0) for (let t = Math.max(1, prev + 2); t < 16 && pick < 0; t++) if (hi(t - 1) && lvl(t) === k) pick = t;
    if (pick < 0) continue; prev = pick;
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
    const info = terraceInfo(i, j); if (!info || (!info.level && !info.ramp)) continue;   // a ground-level ramp cell still needs its wedge
    const h = info.level * TERRACE, x = cx(i), z = cz(j);
    if (info.level) { g.push(box(1, h + 0.05, 1, PAL.landSide, x, (h - 0.15) / 2, z)); g.push(box(1, 0.05, 1, biome.grass, x, h - 0.025, z)); }
    // where the terrace drops to a lower level: a sloped earth skirt and the odd bush or rock at the foot
    for (const [di, dj] of DIRS) {
      const ni = i + di, nj = j + dj, nInfo = terraceInfo(ni, nj), nl = nInfo ? nInfo.level : 0;
      if (nl >= info.level || (nInfo && nInfo.ramp)) continue;
      const drop = (info.level - nl) * TERRACE, base = nl * TERRACE;
      const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.3, 0); sh.lineTo(0, drop); sh.closePath();   // a shallow bank from the flat plot down to the next level
      const w = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false });
      w.translate(0, 0, -0.5); w.rotateY(Math.atan2(-dj, di)); w.translate(x + di * 0.5, base, z + dj * 0.5);   // local +x points outward
      g.push(colorize(w, S.look === 'rich' ? '#a4b692' : PAL.landSide));
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
  // the summit shrine set from the landmark kit (hall, offering box, bell rope, stone lanterns, its own torii), facing
  // the town along the slope roads' axis, and a second, larger torii at the foot of the lantern path on the terrace below
  // everything on the approach shares one centre line: the column of cells the slope road climbs (shrine, lanterns, stairs, gate, sandō)
  const fx = shrineDir[0], fz = shrineDir[1], ang = Math.atan2(fx, fz), y0 = hillTop, AX = shrineAxis.x, AZ = shrineAxis.z;
  const shrine = createLandmark('shrine'); shrine.position.set(AX - fx * 0.25, y0, AZ - fz * 0.25); shrine.rotation.y = ang; snowKit(shrine); scene.add(shrine);
  // stone stairs (ishidan) down the summit's cliff to the approach below, with cheek walls; the torii stands at their foot
  const edge = shrineAxis.edge, low = cellLevel(AX + fx * (edge + 0.3), AZ + fz * (edge + 0.3)) * TERRACE, drop = y0 - low, run = 0.44, n = 6, sx = -fz, sz = fx;
  const st = [], at = (d, s) => [AX + fx * d + sx * s, AZ + fz * d + sz * s];
  for (let k = 0; k < n; k++) {
    const d = edge + (k + 0.5) * run / n, top = y0 - (k + 1) * drop / (n + 1), [x, z] = at(d, 0);
    st.push(box(fx ? run / n + 0.005 : 0.42, top - low, fz ? run / n + 0.005 : 0.42, k % 2 ? '#bdb6a6' : '#c9c2b2', x, low + (top - low) / 2, z));
  }
  for (const s of [-0.24, 0.24]) for (let k = 0; k < n; k++) {
    const d = edge + (k + 0.5) * run / n, top = y0 - k * drop / (n + 1) + 0.04, [x, z] = at(d, s);
    st.push(box(fx ? run / n + 0.005 : 0.06, top - low, fz ? run / n + 0.005 : 0.06, '#a9a292', x, low + (top - low) / 2, z));
  }
  const sm = mergeMesh(st, true); if (sm) { sm.castShadow = true; sm.receiveShadow = true; scene.add(sm); }
  const [gx, gz] = at(edge + run + 0.14, 0), gate = createLandmark('torii'); gate.scale.setScalar(0.9); gate.position.set(gx, low, gz); gate.rotation.y = ang; snowKit(gate); scene.add(gate);
}

const hillCentre = { x: shrineAxis.x, z: shrineAxis.z, fx: shrineDir[0], fz: shrineDir[1], top: hillTop, edge: shrineAxis.edge };

// ── the canal: a gently meandering channel from shore to shore on the pier's side of the island, clear of the
//    town centre and the hill. Cells are keyed "i,j". The coast road follows the beach just inland, one cell
//    wide, breaking only at the hill; where it meets the canal it crosses on a bridge. ──
const key = (i, j) => i + ',' + j;
const canalCells = new Set(), canalOrder = [], coastCells = new Set(), canalMouths = [], fallFeet = [];   // canalMouths: shore angles of the waterfalls; fallFeet: where each fall lands {x, y, z, dx, dz, w}
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
    // the canal may only touch the coast at its two ends: a run alongside the beach would spill over at every cell
    for (let k = 3; k + 3 < cellsHere.length && !bad; k++) if (coastDist(cx(cellsHere[k][0]), cz(cellsHere[k][1])) < 1.8) bad = true;
    if (bad || cellsHere.length < 8) continue;
    for (const c of cellsHere) { canalCells.add(key(...c)); canalOrder.push(c); }
  }
}
const isCanal = (i, j) => canalCells.has(key(i, j)), isCoastRoad = (i, j) => coastCells.has(key(i, j));
// the channel: sunken water with stone banks on every side that has no canal neighbour, reeds and a heron
{
  const g = [], veg = [], wat = [];   // wat: the water tops again, for the drifting ripple overlay
  // the land mesh is solid down from y 0, so the channel sits on it: dark bed, water just above ground, low stone walls
  const WATER = 0.02, TOP = 0.08, wall = '#cdc5b8', coping = PAL.concrete, fall = [];   // pale stone: the shaded inner face of the old rock colour read as a green outline
  const flowAt = k => { const a = canalOrder[Math.max(0, k - 1)], b = canalOrder[Math.min(canalOrder.length - 1, k + 1)]; return Math.atan2(b[0] - a[0], b[1] - a[1]); };
  const TILE = 180 / 44;   // the sea's fine ripple layer repeats every ~4.1 units; the canal uses the same scale
  const flowPlane = (w, l, ang, px, py, pz, u0 = 0) => {   // u runs along the flow, measured in world units from the canal's start so cells join up
    const p = new THREE.PlaneGeometry(l, w); const uv = p.getAttribute('uv');
    for (let q = 0; q < uv.count; q++) uv.setXY(q, (u0 + uv.getX(q) * l) / TILE, uv.getY(q) * w / TILE);
    p.rotateX(-Math.PI / 2); p.rotateY(ang - Math.PI / 2); p.translate(px, py, pz); return colorize(p, PAL.canal);
  };
  for (const [i, j] of canalOrder) {
    const ko = canalOrder.findIndex(c => c[0] === i && c[1] === j), flow = flowAt(ko);
    const x = cx(i), z = cz(j), isEnd = DIRS.filter(([di, dj]) => isCanal(i + di, j + dj)).length <= 1;   // only an end cell opens to the sea; a cell running near the shore is walled
    const nb = DIRS.map(([di, dj]) => isCanal(i + di, j + dj) || (isEnd && coastDist(cx(i + di), cz(j + dj)) <= 0.8));
    g.push(box(0.78, 0.02, 0.78, PAL.canal, x, WATER, z)); wat.push(flowPlane(0.78, 0.78, flow, x, WATER + 0.014, z, ko));
    g.push(box(0.9, 0.02, 0.9, PAL.canalBed, x, WATER - 0.012, z));   // a dark bed below the water
    let mouthK = -1, mouthL = 99;
    nb.forEach((open, k) => { if (!open || isCanal(i + DIRS[k][0], j + DIRS[k][1])) return; const [di, dj] = DIRS[k]; let L = 0.5; while (L < 6 && coastDist(x + di * L, z + dj * L) > 0) L += 0.1; if (L < mouthL) { mouthL = L; mouthK = k; } });
    nb.forEach((open, k) => { const [di, dj] = DIRS[k]; if (open) { g.push(box(di ? 0.11 : 0.78, 0.02, di ? 0.78 : 0.11, PAL.canal, x + di * 0.445, WATER, z + dj * 0.445));   // butts against the cell's water without overlapping it
        if (!isCanal(i + di, j + dj) && k !== mouthK) { g.push(box(di ? 0.11 : 1, TOP, di ? 1 : 0.11, wall, x + di * 0.445, TOP / 2, z + dj * 0.445)); g.push(box(di ? 0.13 : 1, 0.025, di ? 1 : 0.13, coping, x + di * 0.445, TOP + 0.012, z + dj * 0.445)); }   // a second sea-facing side is walled
        if (!isCanal(i + di, j + dj) && k === mouthK) {   // the mouth: a waterfall off the land edge
          const L = mouthL, theta = Math.atan2((z + dj * L) / SZ, (x + di * L) / SX); canalMouths.push(theta);
          const across = (w, len, h, col, px, py, pz) => g.push(box(di ? len : w, h, di ? w : len, col, px, py, pz));   // a box aligned with the flow
          // does the spillway have to cross a street (the coast road) to reach the edge? then it runs in a culvert instead
          let culvert = false; for (let d = 1; d < L + 0.5; d++) if (isCoastRoad(i + di * d, j + dj * d) && !isCanal(i + di * d, j + dj * d)) culvert = true;   // only the coast road exists when the island is built
          const cl = L - 0.5, cpx = x + di * (0.5 + cl / 2), cpz = z + dj * (0.5 + cl / 2);
          if (!culvert && cl > 0.05) {   // an open spillway between two walls out to the edge
            across(0.78, cl, 0.02, PAL.canal, cpx, WATER, cpz); wat.push(flowPlane(0.78, cl, Math.atan2(di, dj), cpx, WATER + 0.014, cpz, ko + 0.5));
            across(0.9, cl, 0.02, PAL.canalBed, cpx, WATER - 0.012, cpz);
            for (const sd of [-1, 1]) { across(0.11, cl, TOP, wall, cpx + (di ? 0 : sd * 0.445), TOP / 2, cpz + (di ? sd * 0.445 : 0)); across(0.13, cl, 0.025, coping, cpx + (di ? 0 : sd * 0.445), TOP + 0.012, cpz + (di ? sd * 0.445 : 0)); }
          } else if (culvert) {   // the end is walled, with a dark culvert arch the water disappears into
            across(0.78, 0.11, TOP, wall, x + di * 0.445, TOP / 2, z + dj * 0.445); across(1, 0.13, 0.025, coping, x + di * 0.445, TOP + 0.012, z + dj * 0.445);
            across(0.4, 0.03, 0.07, '#3f3a38', x + di * 0.41, WATER + 0.03, z + dj * 0.41);
          }
          // the fall: from the lip at the edge (or an outlet in the cliff below the road) down to the beach, foam at the top and the bottom
          const ex = x + di * (L + 0.26), ez = z + dj * (L + 0.26), top = culvert ? -0.18 : WATER, beachY = -0.5, drop = top - beachY;   // the land mass runs 0.2 past the coastline (its bevel), so the fall hangs just beyond it
          if (culvert) { across(0.6, 0.08, 0.3, PAL.concrete, ex - di * 0.08, top + 0.02, ez - dj * 0.08); across(0.44, 0.09, 0.2, '#3f3a38', ex - di * 0.07, top - 0.02, ez - dj * 0.07); }   // outlet frame in the cliff
          across(0.66, 0.03, drop, PAL.canal, ex, top - drop / 2, ez);
          const sheet = new THREE.PlaneGeometry(0.66, drop); sheet.rotateY(Math.atan2(di, dj)); sheet.translate(ex + di * 0.03, top - drop / 2, ez + dj * 0.03); fall.push(colorize(sheet, PAL.canal));
          if (!culvert) { across(0.78, 0.34, 0.34, PAL.canal, x + di * (L + 0.12), WATER - 0.16, z + dj * (L + 0.12)); for (const sd of [-1, 1]) { across(0.11, 0.34, 0.44, wall, x + di * (L + 0.12) + (di ? 0 : sd * 0.445), TOP - 0.22, z + dj * (L + 0.12) + (di ? sd * 0.445 : 0)); across(0.13, 0.34, 0.025, coping, x + di * (L + 0.12) + (di ? 0 : sd * 0.445), TOP + 0.012, z + dj * (L + 0.12) + (di ? sd * 0.445 : 0)); } wat.push(flowPlane(0.78, 0.34, Math.atan2(di, dj), x + di * (L + 0.12), WATER + 0.014, z + dj * (L + 0.12), ko + L - 0.4)); }   // a solid block of water between walls over the land's bevelled edge, so no ground shows beneath the lip
          across(0.74, 0.14, 0.04, PAL.foam, ex - di * 0.02, top + 0.01, ez - dj * 0.02);   // the lip
          fallFeet.push({ x: ex + di * 0.06, y: beachY + 0.02, z: ez + dj * 0.06, dx: di, dz: dj, w: 0.66 });   // the splash pool at the foot (sea.js animates it)
          let B = 0.2; while (B < 3 && coastDist(x + di * (L + B), z + dj * (L + B)) > -beachExtra(theta)) B += 0.1;   // the beach's width here
          // a walled channel carries the water straight across the sand and out into the sea; its walls run down into the sand
          const c0 = L + 0.22, c1 = L + B + 0.4, cm = (c0 + c1) / 2, clen = c1 - c0, chx = x + di * cm, chz = z + dj * cm, chY = beachY + 0.008;
          across(0.78, clen, 0.02, PAL.canal, chx, chY, chz); wat.push(flowPlane(0.78, clen, Math.atan2(di, dj), chx, chY + 0.012, chz, ko + c0));
          across(0.86, clen, 0.02, PAL.canalBed, chx, chY - 0.012, chz);
          for (const sd of [-1, 1]) { across(0.11, clen, 0.5, wall, chx + (di ? 0 : sd * 0.445), chY - 0.15, chz + (di ? sd * 0.445 : 0)); across(0.13, clen, 0.025, coping, chx + (di ? 0 : sd * 0.445), chY + 0.11, chz + (di ? sd * 0.445 : 0)); }
          for (let f = 0; f < 9; f++) { const fd = 0.1 + (f % 3) * 0.09, fo = -0.26 + (f * 0.29) % 0.52, fr = 0.05 + ((f * 7) % 4) * 0.012; g.push(blob(fr, PAL.foam, ex + di * fd + (dj ? fo : 0), chY + 0.016, ez + dj * fd + (di ? fo : 0), 1, 0.35)); }   // churn where the fall lands
          // the open end: the channel water steps down into the sea with a lip of foam
          const seaX = x + di * (c1 + 0.02), seaZ = z + dj * (c1 + 0.02), sdrop = chY + 0.78;
          across(0.76, 0.03, sdrop, PAL.canal, seaX, chY - sdrop / 2, seaZ);
          const sheet2 = new THREE.PlaneGeometry(0.74, sdrop); sheet2.rotateY(Math.atan2(di, dj)); sheet2.translate(seaX + di * 0.02, chY - sdrop / 2, seaZ + dj * 0.02); fall.push(colorize(sheet2, PAL.canal));
          for (const fo of [-0.22, 0, 0.22]) g.push(blob(0.12, PAL.foam, seaX + di * 0.16 + (dj ? fo : 0), -0.766, seaZ + dj * 0.16 + (di ? fo : 0), 1, 0.12));
        }      }
      else {   // a stone wall with a coping, the same on every closed side (the grass bank read as a green stripe from above)
        g.push(box(di ? 0.11 : 1, TOP, di ? 1 : 0.11, wall, x + di * 0.445, TOP / 2, z + dj * 0.445)); g.push(box(di ? 0.13 : 1, 0.025, di ? 1 : 0.13, coping, x + di * 0.445, TOP + 0.012, z + dj * 0.445));
      } });
    for (let k = 0; k < 4; k++) { const k2 = (k + 1) % 4; if (nb[k] && nb[k2]) { const [a, b] = DIRS[k], [c2, d] = DIRS[k2]; g.push(box(0.11, 0.02, 0.11, PAL.canal, x + (a + c2) * 0.445, WATER, z + (b + d) * 0.445)); } }   // the corner square where two edge strips meet at a bend
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
    const t = rippleTex.clone(); t.needsUpdate = true;   // uvs are already in tile units (see flowPlane)
    const wm = mergeMesh(wat, false, false); wm.material = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.2, depthWrite: false }); wm.renderOrder = 3; scene.add(wm);
    rippleLayers.push({ t, speed: [-0.014, 0] });   // a growing u offset moves the pattern toward -u, so negative here runs the ripples with the flow
  }
  if (fall.length) {   // the waterfall sheets: the same ripple tile stretched tall and scrolled downward, drawn from both sides
    const t = rippleTex.clone(); t.needsUpdate = true; t.repeat.set(1.2, 3);
    const fm = mergeMesh(fall, false, false); fm.material = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }); fm.renderOrder = 3; scene.add(fm);
    rippleLayers.push({ t, speed: [0, 0.9] });
  }
  const vm = mergeMesh(veg, true); if (vm) { vm.material = swayMat; vm.castShadow = false; scene.add(vm); }
}
{   // shoreline greenery, minus the canal mouth and the quay's walking surface
  const ends = canalOrder.filter(([i, j]) => DIRS.filter(([di, dj]) => isCanal(i + di, j + dj)).length <= 1).map(([i, j]) => { const nbr = DIRS.find(([di, dj]) => isCanal(i + di, j + dj)) || [0, 1]; return { x: cx(i), z: cz(j), dx: -nbr[0], dz: -nbr[1] }; });
  const clear = (x, z) => canalOrder.some(([i, j]) => Math.hypot(x - cx(i), z - cz(j)) < 0.95) || ends.some(e => { const t = (x - e.x) * e.dx + (z - e.z) * e.dz; if (t < 0 || t > 6) return false; return Math.abs((x - e.x) * e.dz - (z - e.z) * e.dx) < 0.9; });
  const onQuay = (x, z, margin) => {
    if (!pierInfo) return false;
    const P = pierInfo, dx = x - P.root.x, dz = z - P.root.z;
    const a = dx * Math.sin(P.ang) + dz * Math.cos(P.ang), s = dx * Math.cos(P.ang) - dz * Math.sin(P.ang);
    if (a < -margin || a > P.len + margin) return false;
    const halfWidth = a >= P.len - P.headDepth - margin ? P.headWidth / 2 : P.width / 2;
    return Math.abs(s) < halfWidth + margin;
  };
  const keep = shoreVeg.filter(g => {
    g.computeBoundingBox(); const b = g.boundingBox;
    const x = (b.min.x + b.max.x) / 2, z = (b.min.z + b.max.z) / 2;
    const margin = Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z) / 2 + 0.12; // sway clearance
    if (clear(x, z) || onQuay(x, z, margin)) { g.dispose(); return false; }
    return true;
  });
  const vm = mergeMesh(keep, true); if (vm) { vm.name = 'shore-vegetation'; vm.material = swayMat; vm.castShadow = false; scene.add(vm); }
}
const islandEllipse = [SX, SZ];
const pierAngle = () => pierTheta;
const pierFrame = () => pierInfo;
export { pierFrame, pierAngle, isLand, coastDist, shoreKind, radius, coastPoint, rng as islandRng, updateWater, onHill, hillLevel, terraceInfo, buildableTerrace, TERRACE, hillCentre, cellHash, polygon, beachExtra, islandEllipse, isCanal, isCoastRoad, canalCells, canalMouths, fallFeet, seaRocks };
