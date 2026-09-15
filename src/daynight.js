// Komachi — day/night cycle: sky, lights, emissive windows and lamps, clock readout
import * as THREE from 'three';
import { PAL } from './palette.js';
import { lerp } from './utils.js';
import { renderer, scene, hemi, sun, fill } from './scene.js';
import { lampHeadMat } from './geometry.js';
import { units, lampGlowMat, DONE } from './world.js';
import { hourOf, dayOf, daylight, carMeshes } from './sim.js';
import { ui } from './ui.js';

const C = { skyDay: new THREE.Color(PAL.skyDay), skyDusk: new THREE.Color(PAL.skyDusk), skyNight: new THREE.Color(PAL.skyNight),
  hemiDay: new THREE.Color('#dff1ea'), hemiNight: new THREE.Color('#6d80ab'), gDay: new THREE.Color('#e9d5b8'), gNight: new THREE.Color('#485477'),
  sunDay: new THREE.Color('#fff1dc'), sunDusk: new THREE.Color('#ffb98a'), moon: new THREE.Color('#a7b8dd'), tmp: new THREE.Color(), tmp2: new THREE.Color() };
function envUpdate(realT) {
  const h = hourOf(), d = daylight(), dusk = 4 * d * (1 - d), night = 1 - d;
  C.tmp.copy(C.skyNight).lerp(C.skyDay, d).lerp(C.skyDusk, dusk * 0.55);
  renderer.setClearColor(C.tmp); scene.fog.color.copy(C.tmp);
  hemi.color.copy(C.hemiNight).lerp(C.hemiDay, d); hemi.groundColor.copy(C.gNight).lerp(C.gDay, d); hemi.intensity = lerp(0.95, 0.9, d);
  if (h > 5.5 && h < 19.5) { const a = ((h - 6) / 12) * Math.PI; sun.position.set(-Math.cos(a) * 60, Math.max(14, Math.sin(a) * 70 + 8), 36); }
  else sun.position.set(30, 55, -22);
  sun.intensity = lerp(0.55, 1.6, d); C.tmp2.copy(C.sunDay).lerp(C.sunDusk, dusk * 0.7); sun.color.copy(C.moon).lerp(C.tmp2, d);
  fill.intensity = lerp(0.3, 0.35, d);
  renderer.toneMappingExposure = lerp(1.0, 1.05, d);
  lampHeadMat.emissiveIntensity = night * 2.4; lampGlowMat.opacity = night * 0.85;
  const shopOpen = h >= 7 && h < 22;
  for (const u of units.values()) {
    const occ = u.inside.size > 0, b = u.block;
    let base = b.stage < DONE ? 0 : b.type === 'station' ? 1.4 : b.type === 'shop' ? (shopOpen ? 1.3 : 0.15) : (occ ? 1.3 : 0.12);
    const flick = 1 + 0.06 * Math.sin(realT * 2.3 + u.seed * 40);
    u.winMat.emissiveIntensity = night * base * flick;
    u.glowMat.opacity = night * (base > 0.5 ? 0.55 : 0.08) * (b.stage < DONE ? 0 : 1);
    if (u.pop > 0) { u.pop = Math.max(0, u.pop - 0.016 * 1.6); const p = 1 - u.pop; const sy = 0.5 + 0.5 * (1 - Math.pow(1 - p, 3)) + 0.12 * Math.sin(p * Math.PI) * (1 - p); u.mesh.scale.set(1 + (1 - sy) * 0.3, sy, 1 + (1 - sy) * 0.3); }
    else if (u.mesh.scale.y !== 1) u.mesh.scale.set(1, 1, 1);
  }
  for (const c of carMeshes) { c.userData.lights.material.emissiveIntensity = night * 2.2; c.userData.tail.material.emissiveIntensity = night * 1.5; }
  // UI clock
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  ui.time.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const part = h < 5 ? 'Night' : h < 11 ? 'Morning' : h < 14 ? 'Midday' : h < 18 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  ui.day.textContent = `Day ${dayOf()} · ${part}`; ui.sun.classList.toggle('night', d < 0.5);
}

export { envUpdate };
