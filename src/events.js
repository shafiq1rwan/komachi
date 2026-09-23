// Komachi — gentle events on the town square (a civic kind the player places: three cells with the Civic tool).
//  - market morning: every Sunday 7:00–11:30, two stalls and a produce table go up; residents drop by and come home with a bag
//  - summer festival: once a summer, on its first Saturday (the third summer day if it has none), 16:00–21:30: three yatai, lantern
//    strings that glow after dark, the mikoshi on display, a taiko and nobori; residents and extra visitors crowd in, and from
//    20:00 fireworks burst over the sea beyond the square
// The schedule comes from the calendar alone, so nothing needs saving. sim.js and tourists.js ask `eventVisit()` for a place to
// stand; main.js listens with `onEventStart` for the first festival's milestone card. Models: src/festival-landmark-kit.js.
import * as THREE from 'three';
import { S } from './state.js';
import { scene } from './scene.js';
import { blocks, cell, DONE } from './world.js';
import { unitDoorPoints } from './buildings.js';
import { seasonOf } from './seasons.js';
import { coastDist } from './island.js';
import { W } from './weather.js';
import { createFestivalLandmark } from './festival-landmark-kit.js';
import { snowKit } from './geometry.js';
import { chronicle, record } from './chronicle.js';

const dayNow = () => Math.floor(S.T / 24) + 1, hourNow = () => S.T % 24;
const listeners = []; const onEventStart = fn => listeners.push(fn);
const squares = () => blocks.filter(b => b.type === 'civic' && b.kind === 'square' && b.stage === DONE && b.units.every(u => u.mesh));
/** the summer's festival day: its first Saturday, or its third day if the season has no Saturday */
function festivalDay(day) {
  if (seasonOf(day) !== 'summer') return false;
  let start = day; while (seasonOf(start - 1) === 'summer' && day - start < 8) start--;
  const days = []; for (let d = start; seasonOf(d) === 'summer' && d < start + 8; d++) days.push(d);
  const sat = days.find(d => d % 7 === 6);
  return day === (sat !== undefined ? sat : days[Math.min(2, days.length - 1)]);
}
function scheduled() {
  const d = dayNow(), h = hourNow();
  if (festivalDay(d) && h >= 16 && h < 21.5) return 'festival';
  if (d % 7 === 0 && h >= 7 && h < 11.5 && W.rain < 0.5) return 'market';
  return null;
}
const NAMES = { market: 'the market morning', festival: 'the summer festival' };

// ── what stands on the square during each event, in each cell's own frame (front +z toward the street, plinth at 0.12) ──
let current = null;   // { kind, block, group, spots: [{ pos, face, taken }], lanterns: [], light }
const Y0 = 0.12;
function put(group, u, kind, x, z, rot = 0, s = 0.6) {
  const m = createFestivalLandmark(kind); m.scale.setScalar(s);
  m.position.copy(u.mesh.localToWorld(new THREE.Vector3(x, Y0, z))); m.rotation.y = (u.facing || 0) + rot;
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  snowKit(m); group.add(m); return m;
}
function produceTable(group, u, x, z) {   // trestle table with crates of vegetables and fruit
  const g = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: '#b08a62', roughness: 0.9 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.025, 0.22), wood); top.position.y = 0.2; g.add(top);
  for (const sx of [-0.2, 0.2]) for (const sz of [-0.09, 0.09]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.02), wood); leg.position.set(sx, 0.1, sz); g.add(leg); }
  const colors = ['#d9744f', '#8fb35a', '#e6b84a', '#b25a78', '#e38b5a', '#9cc06a'];
  for (let k = 0; k < 6; k++) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.05, 0.09), wood); crate.position.set(-0.15 + (k % 3) * 0.15, 0.24, k < 3 ? -0.05 : 0.055); g.add(crate);
    for (let q = 0; q < 3; q++) { const f = new THREE.Mesh(new THREE.DodecahedronGeometry(0.022), new THREE.MeshStandardMaterial({ color: colors[k], roughness: 0.8 })); f.position.set(crate.position.x - 0.035 + q * 0.035, 0.28, crate.position.z); g.add(f); }
  }
  g.position.copy(u.mesh.localToWorld(new THREE.Vector3(x, Y0, z))); g.rotation.y = u.facing || 0;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); group.add(g);
}
function setUp(kind, b) {
  const group = new THREE.Group(); group.name = 'event ' + kind; scene.add(group);
  const us = b.units, lanterns = [], spots = [];
  for (const u of us) u.mesh.updateMatrixWorld(true);
  if (kind === 'market') {
    put(group, us[0], 'yatai-food', 0, -0.16); produceTable(group, us[1], 0, -0.12); put(group, us[us.length - 1], 'yatai-sweets', 0, -0.16);
    put(group, us[0], 'festival-banner', -0.4, 0.3, 0, 0.45);
  } else {
    const stalls = ['yatai-food', 'yatai-games', 'yatai-sweets'];
    us.forEach((u, k) => {
      if (k === 1 && us.length >= 3) { put(group, u, 'mikoshi', 0, -0.2, Math.PI / 2, 0.5); put(group, u, 'taiko', 0.3, 0.02, -0.5, 0.55); }
      else put(group, u, stalls[k % 3], 0, -0.16);
      const ls = put(group, u, 'lantern-string', 0, 0.36, 0, 0.5);
      const lm = ls.getObjectByName('Lanterns'); if (lm) { lm.material = lm.material.clone(); lm.material.emissive = new THREE.Color('#ffb86b'); lm.material.emissiveIntensity = 0; lanterns.push(lm); }
    });
    put(group, us[0], 'festival-banner', -0.44, 0.2, 0, 0.45); put(group, us[us.length - 1], 'festival-banner', 0.44, 0.2, 0, 0.45);
    put(group, us[us.length > 1 ? 1 : 0], 'bunting', 0, -0.47, 0, 0.5);
  }
  // places to stand: the front half of each cell, facing the stalls
  for (const u of us) for (const x of [-0.3, -0.1, 0.1, 0.3]) for (const z of [0.1, 0.27]) {
    const pos = u.mesh.localToWorld(new THREE.Vector3(x + (Math.random() - 0.5) * 0.06, 0.12, z + (Math.random() - 0.5) * 0.05)); pos.y = 0.12;
    const at = u.mesh.localToWorld(new THREE.Vector3(x * 0.5, 0, -0.2));
    spots.push({ pos, face: Math.atan2(at.x - pos.x, at.z - pos.z), unit: u, taken: 0 });
  }
  const mid = us[Math.floor(us.length / 2)].mesh.localToWorld(new THREE.Vector3(0, 1.0, 0.1));
  const light = new THREE.PointLight('#ffc27d', 0, 2.8, 1.3); light.position.copy(mid); group.add(light);
  current = { kind, block: b, group, spots, lanterns, light, name: NAMES[kind] };
  for (const fn of listeners) fn(kind, b);
  const first = kind === 'festival' ? `The first summer festival was held on ${b.name}` : `The first market morning was held on ${b.name}`;
  if (!chronicle.some(e => e.text === first)) record(first);
}
function tearDown() {
  if (!current) return;
  scene.remove(current.group); current.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  current = null; bursts.forEach(bu => scene.remove(bu.pts)); bursts.length = 0;
}

/** somewhere to stand at the current event, and the way in from the square's street; null if nothing is on (or it is full) */
function eventVisit() {
  if (!current) return null;
  const free = current.spots.filter(s => s.taken < 1); if (!free.length) return null;
  const s = free[Math.floor(Math.random() * free.length)], u = s.unit, f = u.facing || 0;
  const road = cell(u.cell.i + Math.round(Math.sin(f)), u.cell.j + Math.round(Math.cos(f))); if (!road || road.type !== 'road') return null;
  const [, kerb] = unitDoorPoints(u), festival = current.kind === 'festival';
  return { kind: current.kind, road, spot: s, block: current.block,
    l: { kind: 'event', name: current.block.name, label: festival ? 'off to the summer festival' : 'going to the market', hold: festival ? (hourNow() >= 18.5 ? [21.25 - hourNow(), 21.4 - hourNow()] : [1.0, 2.0]) : [0.25, 0.45],   // evening arrivals stay for the fireworks
      activity: festival ? 'at the summer festival' : 'browsing the market stalls', face: s.face, bag: !festival, spot: s, target: s.pos,
      walk: () => [kerb.clone(), s.pos.clone().setY(0.12)] } };
}
const eventOn = () => current;

// ── fireworks: bursts of sparks over the sea beyond the square, from 20:00 ──
const bursts = [], SPARK_COLS = ['#ffcf8a', '#f29a9a', '#9ad0e8', '#c8f0b0', '#f7e6a1', '#f4b6d8'].map(c => new THREE.Color(c));
let nextBurst = 0, flash = null;
const sparkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.8)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();   // soft round sparks
function burstAt(pos) {
  const n = 70, geo = new THREE.BufferGeometry(), p = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = [];
  const c = SPARK_COLS[Math.floor(Math.random() * SPARK_COLS.length)], c2 = SPARK_COLS[Math.floor(Math.random() * SPARK_COLS.length)];
  for (let k = 0; k < n; k++) {
    const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u), sp = 1.3 + Math.random() * 0.4;
    vel.push(new THREE.Vector3(r * Math.cos(a) * sp, u * sp, r * Math.sin(a) * sp)); p.set([pos.x, pos.y, pos.z], k * 3);
    const cc = k % 3 ? c : c2; col.set([cc.r, cc.g, cc.b], k * 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ map: sparkTex, size: 9, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const pts = new THREE.Points(geo, mat); pts.renderOrder = 7; scene.add(pts);
  bursts.push({ pts, vel, t: 0, origin: pos.clone() });
  if (flash) { flash.position.copy(pos); flash.intensity = 6; flash.color.copy(c); }
}
function skyPoint() {   // out over the water in the direction of the square, well above the horizon
  const b = current.block, u = b.units[Math.floor(b.units.length / 2)], p = u.mesh.position.clone().setY(0);
  const out = p.lengthSq() > 0.01 ? p.clone().normalize() : new THREE.Vector3(0, 0, 1);
  const q = p.clone(); for (let k = 0; k < 80 && coastDist(q.x, q.z) > -1; k++) q.addScaledVector(out, 0.25);
  q.addScaledVector(out, 3 + Math.random() * 2).add(new THREE.Vector3((Math.random() - 0.5) * 3, 0, (Math.random() - 0.5) * 3));
  q.y = 2.2 + Math.random() * 1.4; return q;   // low over the water, so they stay on screen from the town view
}
function updateFireworks(dt, realT) {
  const h = hourNow(), on = current && current.kind === 'festival' && h >= 20 && h < 21.3 && S.speed > 0;
  if (!flash) { flash = new THREE.PointLight('#ffcf8a', 0, 26, 1.2); scene.add(flash); }
  if (on && realT >= nextBurst) { burstAt(skyPoint()); nextBurst = realT + 0.45 + Math.random() * 0.7; }
  flash.intensity *= Math.exp(-dt * 7);
  for (let k = bursts.length - 1; k >= 0; k--) {
    const bu = bursts[k]; bu.t += dt; const pos = bu.pts.geometry.attributes.position;
    for (let i = 0; i < bu.vel.length; i++) { const v = bu.vel[i]; v.y -= 0.9 * dt; v.multiplyScalar(Math.exp(-dt * 1.4)); pos.setXYZ(i, pos.getX(i) + v.x * dt, pos.getY(i) + v.y * dt, pos.getZ(i) + v.z * dt); }
    pos.needsUpdate = true; bu.pts.material.opacity = Math.max(0, 1 - bu.t / 1.7);
    if (bu.t > 1.7) { scene.remove(bu.pts); bu.pts.geometry.dispose(); bu.pts.material.dispose(); bursts.splice(k, 1); }
  }
}

/** each frame and in fastForward: set up and clear events on schedule; light the lanterns after dark; fireworks */
function updateEvents(dt, realT, night) {
  const want = scheduled(), sq = squares()[0] || null;
  if (current && (want !== current.kind || !blocks.includes(current.block) || current.block !== sq)) tearDown();
  if (!current && want && sq) setUp(want, sq);
  if (current) {
    const glow = current.kind === 'festival' ? Math.min(1, Math.max(0, night - 0.05) * 1.6) : 0;
    for (const m of current.lanterns) m.emissiveIntensity = 0.25 + glow * 2.2;
    current.light.intensity = glow * 2.2;
  }
  updateFireworks(dt, realT);
}
/** for the square's inspect card */
function eventInfo(b) {
  if (current && current.block === b) return `${current.kind === 'festival' ? 'The summer festival' : 'Market morning'} is on now`;
  return 'Market mornings on Sundays · the summer festival on the first Saturday of summer';
}
export { updateEvents, eventVisit, eventOn, onEventStart, eventInfo, festivalDay, NAMES as EVENT_NAMES };
