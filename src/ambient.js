// Komachi — ambient life that costs nothing to the simulation: bird flocks circling the town,
// gulls over the shore, butterflies around flower patches. Purely visual; updated every frame.
import * as THREE from 'three';
import { PAL } from './palette.js';
import { rand, pick } from './utils.js';
import { S } from './state.js';
import { scene, cx, cz } from './scene.js';
import { cells, onWorldChange } from './world.js';
import { coastPoint } from './island.js';

const flocks = [], butterflies = [];
const wingL = new THREE.BoxGeometry(0.1, 0.006, 0.035); wingL.translate(-0.06, 0, -0.005);   // pivot at the shoulder
const wingR = new THREE.BoxGeometry(0.1, 0.006, 0.035); wingR.translate(0.06, 0, -0.005);
const bodyGeo = new THREE.BoxGeometry(0.03, 0.02, 0.09); const headGeo = new THREE.BoxGeometry(0.022, 0.02, 0.025); headGeo.translate(0, 0.008, 0.055);
const birdMats = { dark: new THREE.MeshStandardMaterial({ color: '#4a4340', roughness: 1 }), gull: new THREE.MeshStandardMaterial({ color: '#f7efe2', roughness: 1 }) };

function makeBird(matKey) {
  const g = new THREE.Group(); const m = birdMats[matKey];
  const L = new THREE.Mesh(wingL, m), R = new THREE.Mesh(wingR, m), B = new THREE.Mesh(bodyGeo, m), H = new THREE.Mesh(headGeo, m);
  g.add(L, R, B, H); g.userData = { L, R, phase: rand(0, 6.28) }; g.scale.setScalar(matKey === 'gull' ? 1.15 : 0.85);
  scene.add(g); return g;
}
function makeFlock(cxw, czw, radius, height, n, matKey, speed) {
  const f = { cx: cxw, cz: czw, radius, height, speed, t: rand(0, 6.28), birds: [] };
  for (let k = 0; k < n; k++) f.birds.push({ mesh: makeBird(matKey), off: k * 0.35, dr: rand(-0.5, 0.5), dh: rand(-0.3, 0.3) });
  flocks.push(f); return f;
}
// two flocks over the island and one of gulls over the shore
makeFlock(rand(-4, 4), rand(-4, 4), rand(4, 6), 3.6, 4, 'dark', 0.35);
makeFlock(rand(-8, 8), rand(-8, 8), rand(5, 8), 4.2, 3, 'dark', 0.28);
{ const [gx, gz] = coastPoint(rand(0, 6.28), 1.2); makeFlock(gx, gz, 2.8, 2.6, 3, 'gull', 0.42); }

const wingA = new THREE.BoxGeometry(0.05, 0.004, 0.045);
const wingMats = [PAL.flower, PAL.roofPeach, '#f7efe2', PAL.lilac, '#e8cf7a'].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 1, side: THREE.DoubleSide }));
function makeButterfly(x, z, gy = 0) {
  const g = new THREE.Group(); const m = pick(wingMats);
  const L = new THREE.Mesh(wingA, m), R = new THREE.Mesh(wingA, m); L.position.x = -0.026; R.position.x = 0.026; g.add(L, R);
  g.position.set(x, 0.45 + gy, z); g.userData = { L, R, home: new THREE.Vector3(x, 0.45 + gy, z), target: new THREE.Vector3(x, 0.45 + gy, z), phase: rand(0, 6.28), speed: rand(0.6, 1.1) };
  scene.add(g); butterflies.push(g); return g;
}
function flowerCells() { return cells.filter(c => c.type === 'empty' && c.tree && (c.tree.kind === 'flowers' || c.tree.kind === 'bush')); }
function placeButterflies() {
  const fc = flowerCells(); if (!fc.length) return;
  while (butterflies.length < 7) { const c = pick(fc); makeButterfly(cx(c.i) + rand(-0.3, 0.3), cz(c.j) + rand(-0.3, 0.3), c.h || 0); }
  for (const b of butterflies) { const c = pick(fc); b.userData.home.set(cx(c.i), 0.45 + (c.h || 0), cz(c.j)); }
}
placeButterflies(); onWorldChange(placeButterflies);

function updateAmbient(dt, realT, night) {
  const light = S.quality && S.quality.busy === false;
  for (const [fi, f] of flocks.entries()) {
    if (light && fi === 1) { for (const b of f.birds) b.mesh.visible = false; continue; }   // busy details off: the second flock stays away
    f.t += dt * f.speed * (night > 0.6 ? 0.3 : 1);
    for (const b of f.birds) {
      const a = f.t - b.off, r = f.radius + b.dr;
      const x = f.cx + Math.cos(a) * r, z = f.cz + Math.sin(a) * r, y = f.height + b.dh + Math.sin(realT * 0.7 + b.off) * 0.15;
      b.mesh.position.set(x, y, z); b.mesh.rotation.y = -a;   // nose along the circle's tangent
      b.mesh.rotation.z = 0.25;                                // bank into the turn
      const flap = Math.sin(realT * 7 + b.mesh.userData.phase) * 0.55; b.mesh.userData.L.rotation.z = flap; b.mesh.userData.R.rotation.z = -flap;
      b.mesh.visible = night < 0.85;
    }
  }
  for (const [bi, b] of butterflies.entries()) {
    if (light && bi >= 3) { b.visible = false; continue; }
    const u = b.userData;
    if (b.position.distanceTo(u.target) < 0.05 || Math.random() < dt * 0.6) u.target.set(u.home.x + rand(-0.55, 0.55), u.home.y - 0.15 + rand(0, 0.35), u.home.z + rand(-0.55, 0.55));
    const step = Math.min(1, dt * u.speed); b.position.lerp(u.target, step); b.position.y += Math.sin(realT * 6 + u.phase) * 0.002;
    const flap = Math.sin(realT * 14 + u.phase) * 0.9; u.L.rotation.z = flap; u.R.rotation.z = -flap;
    b.rotation.y = Math.atan2(u.target.x - b.position.x, u.target.z - b.position.z);
    b.visible = night < 0.5;
  }
}
export { updateAmbient, flocks };
