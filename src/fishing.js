// Komachi — the fishing boat's day (Phase 7). The boat moored at the stone quay sails at 5:30, runs out past the quay to its
// grounds offshore, works slow circles there with its nets out, and comes home at about 10:30 with crates on deck. Its catch
// opens the fish stall on the quay head until 18:30 (after work is when most come) (landmarks.js) and sends a van round the town's fish shops (sim.js).
// It stays in on stormy days. Nothing is counted: the effect is the boat, the stall, the van and a crate at each shop's door.
import * as THREE from 'three';
import { S } from './state.js';
import { scene } from './scene.js';
import { coastPoint, pierFrame } from './island.js';
import { setFishStall } from './landmarks.js';
import { W } from './weather.js';
import { chronicle, record } from './chronicle.js';
import { box, blob, mergeMesh } from './geometry.js';
import { PAL } from './palette.js';

const OUT = 5.5, AT = 6.4, BACK = 9.7, HOME = 10.5;   // game hours: sail, reach the grounds, turn for home, alongside again
let berth = null, dock = null, crates = null, route = null, dayRun = -1, landed = -1;
const listeners = []; const onCatch = fn => listeners.push(fn);
function setup() {
  berth = scene.getObjectByName('quay-boat'); const P = pierFrame(); if (!berth || !P) return false;
  dock = { pos: berth.position.clone(), rot: berth.rotation.y };
  const out = new THREE.Vector3(Math.sin(P.ang), 0, Math.cos(P.ang)), side = new THREE.Vector3(Math.cos(P.ang), 0, -Math.sin(P.ang));
  const clear = dock.pos.clone().addScaledVector(out, 1.6).addScaledVector(side, 0.4);
  const [gx, gz] = coastPoint(P.theta + 0.35, 5.8), ground = new THREE.Vector3(gx, dock.pos.y, gz);
  route = { clear, ground };
  // the catch: a few blue crates of silver fish on the aft deck, shown on the way home
  const g = []; for (let k = 0; k < 3; k++) { g.push(box(0.1, 0.05, 0.08, PAL.roofBlue, -0.07 + k * 0.07, 0.2, -0.12)); for (let q = 0; q < 3; q++) g.push(blob(0.018, '#b9c6cc', -0.09 + k * 0.07 + q * 0.02, 0.235, -0.12, 0, 0.5)); }
  crates = mergeMesh(g, true); if (crates) { crates.visible = false; berth.add(crates); }
  return true;
}
const lerpV = (a, b, t) => a.clone().lerp(b, t), ease = t => t * t * (3 - 2 * t);
/** where the boat is at hour h of a working morning, and which way it faces */
function place(h) {
  const { clear, ground } = route; let p, dir;
  if (h < OUT || h >= HOME) return { p: dock.pos.clone(), rot: dock.rot };
  if (h < AT) { const t = (h - OUT) / (AT - OUT); p = t < 0.3 ? lerpV(dock.pos, clear, ease(t / 0.3)) : lerpV(clear, ground, ease((t - 0.3) / 0.7)); }
  else if (h < BACK) { const a = (h - AT) * 2.1; p = ground.clone().add(new THREE.Vector3(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.6)); }
  else { const t = (h - BACK) / (HOME - BACK); p = t < 0.7 ? lerpV(ground, clear, ease(t / 0.7)) : lerpV(clear, dock.pos, ease((t - 0.7) / 0.3)); }
  const q = place.last || p; dir = p.clone().sub(q); place.last = p.clone();
  return { p, rot: dir.lengthSq() > 1e-6 ? Math.atan2(dir.x, dir.z) : null };
}
/** each frame and in fastForward */
function updateFishing() {
  if (!berth && !setup()) return;
  const day = Math.floor(S.T / 24) + 1, h = S.T % 24;
  if (h >= OUT - 0.2 && h < OUT && dayRun !== day) dayRun = W.rain > 0.6 ? -day : day;   // a stormy morning keeps the boat in
  const working = dayRun === day && h >= OUT && h < HOME + 0.05;
  if (working) {
    const { p, rot } = place(h); berth.position.set(p.x, dock.pos.y + Math.sin(S.T * 40) * 0.006, p.z);
    if (rot !== null) { let d = rot - berth.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); berth.rotation.y += d * 0.2; }
    if (crates) crates.visible = h >= BACK;
  } else { berth.position.copy(dock.pos); berth.rotation.y = dock.rot; if (crates) crates.visible = landed === day && h < 11.5; }
  if (dayRun === day && h >= HOME && landed !== day) {   // alongside with the catch
    landed = day; setFishStall(true);
    if (!chronicle.some(e => /first catch/.test(e.text))) record('The fishing boat brought in its first catch');
    for (const fn of listeners) fn(day);
  }
  if (landed === day && h >= 18.5) setFishStall(false);
  if (landed !== day && h < HOME) setFishStall(false);
}
const catchToday = () => landed === Math.floor(S.T / 24) + 1 && S.T % 24 < 18.5;
export { updateFishing, onCatch, catchToday };
