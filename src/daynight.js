// Komachi — day/night cycle: sky, lights, emissive windows and lamps, clock readout
import * as THREE from 'three';
import { PAL } from './palette.js';
import { lerp, clamp } from './utils.js';
import { renderer, scene, hemi, sun, fill } from './scene.js';
import { lampHeadMat, coneMat } from './geometry.js';
import { units, lampGlowMat, DONE, blocks, CIVIC_REACH } from './world.js';
// windows within reach of a finished substation glow steady and a shade warmer; recomputed every couple of seconds
const powered = new Set(); let poweredT = -9; const WARM = '#f6c78e';
function refreshPowered() {
  powered.clear(); const subs = blocks.filter(b => b.type === 'civic' && b.kind === 'substation' && b.stage === DONE); if (!subs.length) return;
  for (const u of units.values()) if (subs.some(s => s.cells.some(c => Math.abs(c.i - u.cell.i) + Math.abs(c.j - u.cell.j) <= CIVIC_REACH))) powered.add(u);
}
import { hourOf, dayOf, daylight, carMeshes } from './sim.js';
import { ui } from './ui.js';

const C = { skyDay: new THREE.Color(PAL.skyDay), skyDusk: new THREE.Color(PAL.skyDusk), skyNight: new THREE.Color(PAL.skyNight),
  hemiDay: new THREE.Color('#dff1ea'), hemiNight: new THREE.Color('#7b88a8'), gDay: new THREE.Color('#e9d5b8'), gNight: new THREE.Color('#545a70'),
  sunDay: new THREE.Color('#fff1dc'), sunDusk: new THREE.Color('#ffb98a'), moon: new THREE.Color('#b6c1d9'), tmp: new THREE.Color(), tmp2: new THREE.Color(),
  arc: new THREE.Vector3(), moonPos: new THREE.Vector3(30, 55, -22) };
function envUpdate(realT) {
  const h = hourOf(), d = daylight(), dusk = 4 * d * (1 - d), night = 1 - d;
  C.tmp.copy(C.skyNight).lerp(C.skyDay, d).lerp(C.skyDusk, dusk * 0.55);
  renderer.setClearColor(C.tmp); scene.fog.color.copy(C.tmp);
  hemi.color.copy(C.hemiNight).lerp(C.hemiDay, d); hemi.groundColor.copy(C.gNight).lerp(C.gDay, d); hemi.intensity = lerp(0.72, 0.9, d);
  // the sun's arc, held at the horizon outside daylight, slides over to the moon's place as the light fades: shadows never snap
  const a = ((clamp(h, 5.5, 19.5) - 6) / 12) * Math.PI;
  C.arc.set(-Math.cos(a) * 60, Math.max(14, Math.sin(a) * 70 + 8), 36);
  sun.position.copy(C.arc).lerp(C.moonPos, night);
  sun.intensity = lerp(0.55, 1.6, d); C.tmp2.copy(C.sunDay).lerp(C.sunDusk, dusk * 0.7); sun.color.copy(C.moon).lerp(C.tmp2, d);
  fill.intensity = lerp(0.3, 0.35, d);
  renderer.toneMappingExposure = lerp(1.0, 1.05, d);
  lampHeadMat.emissiveIntensity = night * 2.2; lampGlowMat.opacity = night * 0.5; coneMat.opacity = night * 0.07;   // a faint beam and a modest pool: the lamp head carries the brightness
  const shopOpen = h >= 7 && h < 22;
  if (realT - poweredT > 2) { poweredT = realT; refreshPowered(); }
  for (const u of units.values()) {
    const occ = u.inside.size > 0, b = u.block;
    let base = b.stage < DONE ? 0 : b.type === 'station' ? 1.4 : b.type === 'shop' ? ((b.quietDays ? h >= 8 && h < 19 : shopOpen) ? 1.3 : 0.15) : (occ ? 1.3 : 0.12);   // a quiet shop shutters early
    const steady = powered.has(u), flick = steady ? 1.08 : 1 + 0.06 * Math.sin(realT * 2.3 + u.seed * 40);   // the substation's neighbours: no flicker, a touch brighter
    if (steady !== !!u.steady) { u.steady = steady; u.winMat.emissive.set(steady ? WARM : PAL.glow); }
    u.winMat.emissiveIntensity = night * base * flick;
    if (u.stationLit) for (const m of u.stationLit) m.material.emissiveIntensity = u.winMat.emissiveIntensity;   // the kit pavilion's window band, name board and lamps
    u.glowMat.opacity = night * (b.type === 'station' ? 0.7 : base > 0.5 ? 0.5 : 0.08) * (b.stage < DONE ? 0 : 1);
    if (u.laundry) u.laundry.visible = h >= 8 && h < 17;   // washing goes out after breakfast and comes in before dusk
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
