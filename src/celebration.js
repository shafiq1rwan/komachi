// A brief rooftop party popper when construction reaches its final stage.
import * as THREE from 'three';
import { scene } from './scene.js';
import { playCompletionSound } from './audio.js';

const bursts = [], bounds = new THREE.Box3();
const colors = ['#f3bc50', '#ef7891', '#67c8bd', '#a995df', '#fff0bc'];
const paper = new THREE.PlaneGeometry(0.065, 0.035);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function removeBurst(b) {
  scene.remove(b.group);
  b.materials.forEach(m => m.dispose());
  bursts.splice(bursts.indexOf(b), 1);
}

function celebrateBuilding(block) {
  for (const unit of block.units) {
    if (!unit.mesh) continue;
    unit.mesh.updateWorldMatrix(true, true);
    bounds.setFromObject(unit.mesh);
    if (bounds.isEmpty()) continue;
    // Keep the effect above the actual roof, including tall buildings and hill plots.
    const group = new THREE.Group(); group.name = 'Building completion confetti';
    group.position.set((bounds.min.x + bounds.max.x) / 2, bounds.max.y + 0.12, (bounds.min.z + bounds.max.z) / 2);
    const materials = colors.map(color => new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, depthWrite: false }));
    const pieces = [], quiet = reducedMotion.matches;
    for (let i = 0; i < (quiet ? 10 : 44); i++) {
      const mesh = new THREE.Mesh(paper, materials[i % colors.length]);
      const angle = Math.random() * Math.PI * 2, speed = quiet ? 0.15 : 0.35 + Math.random() * 0.8;
      mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      group.add(mesh);
      pieces.push({ mesh, vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed, vy: quiet ? 0.35 : 1.4 + Math.random() * 1.2, spin: quiet ? 0 : 3 + Math.random() * 6 });
    }
    if (bursts.length >= 24) removeBurst(bursts[0]);
    scene.add(group); bursts.push({ group, materials, pieces, age: 0, duration: quiet ? 0.8 : 2.2 });
  }
  playCompletionSound();
}

function updateCelebrations(dt) {
  for (const b of [...bursts]) {
    b.age += dt;
    if (b.age >= b.duration) { removeBurst(b); continue; }
    for (const m of b.materials) m.opacity = Math.min(1, (b.duration - b.age) / 0.7);
    for (const p of b.pieces) {
      p.vy -= dt * 1.9;
      p.mesh.position.x += p.vx * dt; p.mesh.position.z += p.vz * dt; p.mesh.position.y += p.vy * dt;
      p.mesh.rotation.x += p.spin * dt; p.mesh.rotation.z += p.spin * dt * 0.6;
    }
  }
}

export { celebrateBuilding, updateCelebrations };
