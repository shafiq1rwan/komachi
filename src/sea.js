// Komachi — the living sea: waves lapping the shore, fish jumping with a splash, a school drifting near the
// beach, and a small fishing boat (Kenney Watercraft kit, CC0) on a slow circuit offshore. Pure scenery, no
// simulation state; everything here is driven by real time in updateSea().
import * as THREE from 'three';
import { PAL } from './palette.js';
import { S } from './state.js';
import { scene } from './scene.js';
import { box, mergeMesh } from './geometry.js';
import { polygon, beachExtra, coastPoint, radius, islandEllipse, fallFeet } from './island.js';
import { createDolphin, dolphinClips } from './dolphins.js';
import { createFishingBoat } from './watercraft.js';

const WATER_Y = -0.78, rand = (a, b) => a + Math.random() * (b - a);

// ── waves: three foam bands beyond the beach that brighten in turn, so the water seems to run up the sand ──
const waves = [];
for (let k = 0; k < 3; k++) {
  const geo = new THREE.ExtrudeGeometry(polygon(t => beachExtra(t) + 0.55 + k * 0.45), { depth: 0.05, bevelEnabled: false });
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: PAL.foam, transparent: true, opacity: 0.3, depthWrite: false }));
  m.rotation.x = Math.PI / 2; m.position.y = WATER_Y + 0.008 + k * 0.001; m.renderOrder = 2; m.userData.lookOnly = 'classic'; m.visible = S.look !== 'rich'; scene.add(m); waves.push(m);
}

// ── fish: a small pool of jumpers, each a body with a tail, plus expanding splash rings ──
const fish = [], splashes = [];
const splashGeo = new THREE.RingGeometry(0.06, 0.1, 16); splashGeo.rotateX(-Math.PI / 2);
for (let k = 0; k < 4; k++) {
  const g = mergeMesh([box(0.05, 0.035, 0.13, '#b7c7cf', 0, 0, 0), box(0.012, 0.05, 0.05, '#9fb3bf', 0, 0, -0.085), box(0.03, 0.012, 0.04, '#9fb3bf', 0, 0.02, 0.01)], false);
  g.castShadow = false; g.visible = false; scene.add(g); fish.push({ mesh: g, t: -1, x: 0, z: 0, dx: 0, dz: 0, dur: 1.1 });
}
for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(splashGeo, new THREE.MeshBasicMaterial({ color: PAL.foam, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; scene.add(m); splashes.push({ mesh: m, t: -1 }); }
let nextJump = 2;
function splash(x, z) { const s = splashes.find(s => s.t < 0); if (!s) return; s.t = 0; s.mesh.visible = true; s.mesh.position.set(x, WATER_Y + 0.012, z); }
function jump(realT) {
  const f = fish.find(f => f.t < 0); if (!f) return;
  const theta = Math.random() * Math.PI * 2, [x, z] = coastPoint(theta, 1.8 + Math.random() * 2.2), a = Math.random() * Math.PI * 2;
  f.t = 0; f.x = x; f.z = z; f.dx = Math.sin(a) * 0.45; f.dz = Math.cos(a) * 0.45; f.dur = rand(0.9, 1.3); f.mesh.visible = true; f.mesh.rotation.y = a; splash(x, z);
  void realT;
}

// ── a school near the beach: dark shapes just under the surface, wandering slowly as one ──
const school = { centre: new THREE.Vector3(), theta: Math.random() * Math.PI * 2, drift: rand(0.02, 0.035), members: [] };
{
  const geo = new THREE.CircleGeometry(0.05, 8); geo.scale(0.6, 1, 1); geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: '#4f6b66', transparent: true, opacity: 0.35, depthWrite: false });
  for (let k = 0; k < 8; k++) { const m = new THREE.Mesh(geo, mat); m.position.y = WATER_Y + 0.006; scene.add(m); school.members.push({ mesh: m, ox: rand(-0.35, 0.35), oz: rand(-0.35, 0.35), phase: rand(0, 6.28) }); }
}

// ── the fishing boat: loaded from the kit (its own texture), circling far out; a box hull until it arrives ──
const boat = new THREE.Group(); scene.add(boat);
let boatModel = false; let boatTheta = Math.random() * Math.PI * 2;
{
  const hull = mergeMesh([box(0.36, 0.14, 0.9, PAL.cream2, 0, 0.07, 0), box(0.2, 0.16, 0.24, '#8fb0c9', 0, 0.22, -0.1)], false); boat.add(hull);
  createFishingBoat().then(model => {
    boat.remove(hull); hull.geometry.dispose();
    boat.add(model); boatModel = true;
  }).catch(err => console.warn('Komachi: boat model skipped', err));
}
// the wake: two foam lines fanning out from the stern, and rings that spread and fade in the boat's trail
const wakeMat = new THREE.MeshBasicMaterial({ color: PAL.foam, transparent: true, opacity: 0.3, depthWrite: false });
const wakeLines = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 1.6), wakeMat); m.rotation.x = -Math.PI / 2; m.position.y = WATER_Y + 0.005; m.userData.side = s; scene.add(m); return m; });
const trail = []; const trailGeo = new THREE.RingGeometry(0.1, 0.16, 18); trailGeo.rotateX(-Math.PI / 2);
for (let k = 0; k < 12; k++) { const m = new THREE.Mesh(trailGeo, new THREE.MeshBasicMaterial({ color: PAL.foam, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.position.y = WATER_Y + 0.004; scene.add(m); trail.push({ mesh: m, t: -1 }); }
let nextRing = 0;

/** advance the sea by real seconds */
// ── waterfall splash: a ring of foam puffs at the foot of each fall, each pulsing on its own beat, and a mist that drifts up ──
const foamTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const grd = g.createRadialGradient(32, 32, 3, 32, 32, 32); grd.addColorStop(0, 'rgba(255,255,255,0.95)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.4)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const puffGeo = new THREE.PlaneGeometry(1, 1), splashBits = [];
for (const f of fallFeet) {
  const ax = -f.dz, az = f.dx;   // across the fall
  for (let k = 0; k < 7; k++) {   // foam puffs on the water at the foot
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ map: foamTex, color: PAL.foam, transparent: true, depthWrite: false, opacity: 0.6 }));
    m.rotation.x = -Math.PI / 2; m.renderOrder = 4; const o = (k / 6 - 0.5) * f.w * 1.1, fwd = 0.04 + (k % 3) * 0.06;
    m.position.set(f.x + ax * o + f.dx * fwd, f.y, f.z + az * o + f.dz * fwd); scene.add(m); splashBits.push({ m, phase: k * 1.7, base: 0.16 + (k % 2) * 0.05, kind: 'puff' });
  }
  for (let k = 0; k < 4; k++) {   // mist: upright sprites that rise and thin out, then start again at the foot
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ map: foamTex, color: PAL.foam, transparent: true, depthWrite: false, opacity: 0.3 }));
    m.rotation.y = Math.atan2(f.dx, f.dz); m.renderOrder = 4; const o = (k / 3 - 0.5) * f.w * 0.7;
    m.position.set(f.x + ax * o + f.dx * 0.1, f.y, f.z + az * o + f.dz * 0.1); scene.add(m); splashBits.push({ m, phase: k * 0.9, y0: f.y, kind: 'mist' });
  }
}
function updateSplash(realT) {
  for (const b of splashBits) {
    if (b.kind === 'puff') { const p = 0.5 + 0.5 * Math.sin(realT * 5 + b.phase); const s = b.base * (0.8 + p * 0.7); b.m.scale.set(s, s * 0.7, 1); b.m.material.opacity = 0.35 + 0.4 * p; }
    else { const p = ((realT * 0.55 + b.phase) % 1); b.m.position.y = b.y0 + p * 0.28; const s = 0.1 + p * 0.22; b.m.scale.set(s, s, 1); b.m.material.opacity = 0.32 * (1 - p) * Math.min(1, p * 6); }
  }
}
// ── a pod of dolphins: two or three swim round the island offshore, surfacing in arcs and diving with a splash ──
const pod = [];
{ const clips = dolphinClips(), n = 2 + Math.floor(Math.random() * 2), theta0 = Math.random() * Math.PI * 2;
  for (let k = 0; k < n; k++) { const d = createDolphin(k === 1 ? '#8fb0c9' : PAL.roofBlue, 0.19); d.visible = false; scene.add(d); const mixer = new THREE.AnimationMixer(d); mixer.clipAction(clips[0]).play(); mixer.setTime(k * 0.5);
    pod.push({ mesh: d, mixer, theta: theta0 + k * 0.09, r: 3.2 + k * 0.35, t: k * 1.1, period: 3.6 + k * 0.3, splashed: false }); } }
function updatePod(dt, realT) {
  for (const d of pod) {
    d.theta += 0.05 * dt; d.t += dt; const p = (d.t % d.period) / d.period;   // one surfacing arc per period: up out of the water and back in
    const [x, z] = coastPoint(d.theta, d.r + 0.3 * Math.sin(realT * 0.3 + d.theta)), [nx, nz] = coastPoint(d.theta + 0.02, d.r + 0.3 * Math.sin(realT * 0.3 + d.theta + 0.02));
    const up = p < 0.45 ? Math.sin(p / 0.45 * Math.PI) : 0;   // the arc lasts 45 % of the period; the rest is under water
    d.mesh.visible = up > 0.02; if (!d.mesh.visible) { if (!d.splashed && p >= 0.45) { d.splashed = true; splash(x, z); } if (p < 0.02) d.splashed = false; continue; }
    d.mesh.position.set(x, WATER_Y - 0.28 + up * 0.62, z);
    d.mesh.rotation.set(0, Math.atan2(nx - x, nz - z), 0); d.mesh.rotateX(-Math.cos(p / 0.45 * Math.PI) * 0.7);   // nose up rising, down diving
    d.mixer.update(dt);
  }
}
function updateSea(dt, realT) {
  updateSplash(realT); updatePod(dt, realT);
  waves.forEach((w, k) => { const p = 0.5 + 0.5 * Math.sin(realT * 0.8 - k * 1.5); w.material.opacity = 0.1 + 0.45 * p; const s = 1 + 0.004 * Math.sin(realT * 0.8 - k * 1.5 + 1); w.scale.set(s, s, 1); });
  nextJump -= dt; if (nextJump <= 0) { jump(realT); nextJump = rand(1.5, 4.5); }
  for (const f of fish) {
    if (f.t < 0) continue; f.t += dt; const p = f.t / f.dur;
    if (p >= 1) { f.t = -1; f.mesh.visible = false; splash(f.x + f.dx, f.z + f.dz); continue; }
    f.mesh.position.set(f.x + f.dx * p, WATER_Y + Math.sin(Math.PI * p) * 0.42, f.z + f.dz * p);
    f.mesh.rotation.x = -(Math.cos(Math.PI * p) * 0.9);   // nose up on the way out, down on the way in
  }
  for (const s of splashes) { if (s.t < 0) continue; s.t += dt; const p = s.t / 0.7; if (p >= 1) { s.t = -1; s.mesh.visible = false; continue; } s.mesh.scale.setScalar(1 + p * 2.5); s.mesh.material.opacity = 0.55 * (1 - p); }
  school.theta += school.drift * dt;
  { const [x, z] = coastPoint(school.theta, 1.6 + 0.5 * Math.sin(realT * 0.17)); school.centre.set(x, 0, z); }
  for (const m of school.members) { const wob = Math.sin(realT * 1.7 + m.phase) * 0.06; m.mesh.position.x = school.centre.x + m.ox + wob; m.mesh.position.z = school.centre.z + m.oz + Math.cos(realT * 1.3 + m.phase) * 0.05; m.mesh.rotation.y = school.theta + Math.PI / 2 + Math.sin(realT * 2 + m.phase) * 0.2; }
  boatTheta += 0.028 * dt;
  const r = radius(boatTheta) + 4.5, [ex, ez] = islandEllipse; const bx = Math.cos(boatTheta) * r * ex, bz = Math.sin(boatTheta) * r * ez;
  const r2 = radius(boatTheta + 0.01) + 4.5, nx = Math.cos(boatTheta + 0.01) * r2 * ex, nz = Math.sin(boatTheta + 0.01) * r2 * ez;
  boat.position.set(bx, WATER_Y + (boatModel ? 0.02 : 0) + Math.sin(realT * 1.3) * 0.015, bz);
  boat.rotation.set(Math.sin(realT * 0.9) * 0.03, Math.atan2(nx - bx, nz - bz), Math.sin(realT * 1.1) * 0.05, 'YXZ');
  const hy = boat.rotation.y, sx = Math.sin(hy), sz = Math.cos(hy);                  // heading; the stern is behind
  for (const m of wakeLines) { const s = m.userData.side, ang = hy + Math.PI + s * 0.32; m.position.x = bx - sx * 0.45 + Math.sin(ang) * 0.8; m.position.z = bz - sz * 0.45 + Math.cos(ang) * 0.8; m.rotation.z = ang; }   // a flat plane's long axis follows +rotation.z
  wakeMat.opacity = 0.22 + 0.06 * Math.sin(realT * 2.3);
  nextRing -= dt; if (nextRing <= 0) { nextRing = 0.35; const r = trail.find(r => r.t < 0); if (r) { r.t = 0; r.mesh.visible = true; r.mesh.position.x = bx - sx * 0.5; r.mesh.position.z = bz - sz * 0.5; } }
  for (const r of trail) { if (r.t < 0) continue; r.t += dt; const p = r.t / 3; if (p >= 1) { r.t = -1; r.mesh.visible = false; continue; } r.mesh.scale.setScalar(1 + p * 4); r.mesh.material.opacity = 0.32 * (1 - p) * (1 - p); }
}

export { updateSea };
