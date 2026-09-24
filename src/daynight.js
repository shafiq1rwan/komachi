// Komachi — day/night cycle: sky, lights, emissive windows and lamps, clock readout
import * as THREE from 'three';
import { PAL } from './palette.js';
import { lerp, clamp } from './utils.js';
import { renderer, scene, hemi, sun, fill } from './scene.js';
import { lampHeadMat, coneMat } from './geometry.js';
import { units, lampGlowMat, DONE, blocks, CIVIC_REACH, setWet, benchLights, isOpen } from './world.js';
// windows within reach of a finished substation glow steady and a shade warmer; recomputed every couple of seconds
const powered = new Set(); let poweredT = -9; const WARM = '#f6c78e';
function refreshPowered() {
  powered.clear(); const subs = blocks.filter(b => b.type === 'civic' && b.kind === 'substation' && b.stage === DONE); if (!subs.length) return;
  for (const u of units.values()) if (subs.some(s => s.cells.some(c => Math.abs(c.i - u.cell.i) + Math.abs(c.j - u.cell.j) <= CIVIC_REACH))) powered.add(u);
}
import { hourOf, dayOf, daylight, carMeshes } from './sim.js';
import { lampLit } from './service-vehicles.js';
import { ui } from './ui.js';
import { W, weatherWord } from './weather.js';
import { lookK } from './look.js';
import { waterUniforms } from './water.js';
const RICH = { sunDay: new THREE.Color('#fff0d8'), hemiDay: new THREE.Color('#cadcee'), gDay: new THREE.Color('#d9c4a2'), fill: new THREE.Color('#9fb9dc'), fillBase: new THREE.Color('#cfe3f5'),
 };
const GREY = new THREE.Color('#b8c3c8'), COLD = new THREE.Color('#dfe8ee');

const C = { skyDay: new THREE.Color(PAL.skyDay), skyDusk: new THREE.Color(PAL.skyDusk), skyNight: new THREE.Color(PAL.skyNight),
  hemiDay: new THREE.Color('#dff1ea'), hemiNight: new THREE.Color('#7b88a8'), gDay: new THREE.Color('#e9d5b8'), gNight: new THREE.Color('#545a70'),
  sunDay: new THREE.Color('#fff1dc'), sunDusk: new THREE.Color('#ffb98a'), moon: new THREE.Color('#b6c1d9'), tmp: new THREE.Color(), tmp2: new THREE.Color(),
  arc: new THREE.Vector3(), moonPos: new THREE.Vector3(30, 55, -22) };
function envUpdate(realT) {
  const h = hourOf(), d = daylight(), dusk = 4 * d * (1 - d), night = 1 - d;
  C.tmp.copy(C.skyNight).lerp(C.skyDay, d).lerp(C.skyDusk, dusk * 0.55);
  const over = Math.max(0, W.cover - 0.3) / 0.7 * d;   // overcast: the sky greys and the sun softens, by day
  C.tmp.lerp(GREY, over * 0.7); C.tmp.lerp(COLD, W.snow * 0.25 * d);   // under snow the sky pales and cools
  renderer.setClearColor(C.tmp); scene.fog.color.copy(C.tmp);
  const lk = lookK();
  C.tmp2.copy(C.hemiDay).lerp(RICH.hemiDay, lk); hemi.color.copy(C.hemiNight).lerp(C.tmp2, d);
  C.tmp2.copy(C.gDay).lerp(RICH.gDay, lk); hemi.groundColor.copy(C.gNight).lerp(C.tmp2, d); hemi.intensity = lerp(0.72, lerp(0.9, 0.78, lk), d);
  // the sun's arc, held at the horizon outside daylight, slides over to the moon's place as the light fades: shadows never snap
  const a = ((clamp(h, 5.5, 19.5) - 6) / 12) * Math.PI;
  C.arc.set(-Math.cos(a) * 60, Math.max(14, Math.sin(a) * 70 + 8), 36);
  sun.position.copy(C.arc).lerp(C.moonPos, night);
  sun.intensity = lerp(0.55, lerp(1.6, 1.8, lk), d) * (1 - 0.55 * over - 0.15 * W.rain * d); C.tmp2.copy(C.sunDay).lerp(RICH.sunDay, lk).lerp(C.sunDusk, dusk * 0.7); sun.color.copy(C.moon).lerp(C.tmp2, d);
  fill.intensity = lerp(0.3, lerp(0.35, 0.42, lk), d); fill.color.copy(RICH.fillBase).lerp(RICH.fill, lk);
  waterUniforms.uSky.value.copy(C.tmp); waterUniforms.uDay.value = d;   // the sea takes a hint of the sky; crest glints fade at night
  waterUniforms.uDeep.value.set(lk ? '#365b6c' : '#487c8b');
  waterUniforms.uShallow.value.set(lk ? '#527b85' : '#7aa7ad');
  waterUniforms.uRich.value = lk;
  scene.fog.near = lerp(118, 108, lk); scene.fog.far = lerp(200, 168, lk);   // a little haze toward the top of the screen
  renderer.toneMappingExposure = lerp(1.0, 1.05, d) - 0.06 * over;
  setWet(W.winter ? 0 : W.rain);   // snow does not darken the streets like rain
  for (const L of benchLights) L.intensity = Math.max(0, night - 0.1) * 2.4;   // real light on the station benches after dusk
  lampHeadMat.emissiveIntensity = night * 2.2; lampGlowMat.opacity = night * 0.5; coneMat.opacity = night * 0.07;   // a faint beam and a modest pool: the lamp head carries the brightness
  if (realT - poweredT > 2) { poweredT = realT; refreshPowered(); }
  for (const u of units.values()) {
    const occ = u.inside.size > 0, b = u.block, staffed = b.type !== 'shop' || b.kind === 'ryokan' || b.units.some(x => x.staff.length);
    if (u.notice) u.notice.visible = b.type === 'res' ? u.residents.length === 0 : !b.units.some(x => x.staff.length);   // for rent / help wanted
    let base = b.stage < DONE ? 0 : b.type === 'station' ? 1.4 : b.type === 'shop' ? (b.kind === 'ryokan' ? (h >= 6 && h < 23.5 ? 1.3 : 0.35) : staffed && (b.quietDays ? h >= 8 && h < 19 && isOpen(b, h) : isOpen(b, h)) ? 1.3 : 0.15) : (occ ? 1.3 : 0.12);   // a quiet shop shutters early
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
  for (const g of lampLit) { if (!g.parent) { lampLit.delete(g); continue; } g.userData.lights.material.emissiveIntensity = night * 2.4; g.userData.tail.material.emissiveIntensity = night * 1.6; }   // scooters, the postman's motorbike, the kōban bicycle
  // UI clock
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  ui.time.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const part = h < 5 ? 'Night' : h < 11 ? 'Morning' : h < 14 ? 'Midday' : h < 18 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
  ui.day.textContent = `Day ${dayOf()} · ${part}${weatherWord() ? ' · ' + weatherWord() : ''}`; ui.sun.classList.toggle('night', d < 0.5);
}

export { envUpdate };
