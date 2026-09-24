// Komachi — the kitsune: once the hill opens, a red fox (assets/characters/fox, the user's model) now and then slips out of the
// woods beside the summit shrine at dawn or dusk, trots down the stone stairs to the torii, sits a while looking about, and
// goes back up into the trees. Its first appearance is a small ceremony (a milestone card and a chronicle line); from then on a
// pair of stone foxes guards the shrine. Nothing depends on it and it never troubles anyone: it is there to be noticed.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, HALF } from './scene.js';
import { S } from './state.js';
import { hillCentre } from './island.js';
import { hill, terrainY, cell } from './world.js';
import { record, chronicle } from './chronicle.js';
import { announce } from './milestone.js';
import foxUrl from '../assets/characters/fox/komachi-fox.glb?url';

const SCALE = 0.4;   // the model is 0.31 tall: about 0.12 here, under half a resident (people are 0.26)
const SEEN = 'A fox was seen at the shrine on the hill';
let template = null;
export const foxLoaded = new GLTFLoader().loadAsync(foxUrl).then(g => { template = g.scene; }).catch(err => console.warn('Komachi: fox not loaded', err));

const base = n => n.replace(/\.\d+$/, '');
/** the height of what is underfoot: the ground, plus the asphalt (0.08) on a road cell or the flagstones on the approach */
const ground = (x, z) => { const c = cell(Math.floor(x + HALF), Math.floor(z + HALF)); return terrainY(x, z) + (c && c.type === 'road' ? 0.082 : 0.014); };
/** the fox, its flat list of parts gathered into pivots so it can walk, sit, look about and swish its tail */
function buildFox(stone = null) {
  const root = new THREE.Group(), m = template.clone(true); root.add(m); root.updateMatrixWorld(true);
  const pivot = (name, at) => { const g = new THREE.Group(); g.name = name; g.position.set(...at); m.add(g); g.updateMatrixWorld(true); return g; };
  const head = pivot('Fox_Head', [0, 0.85, 0.33]), tail = pivot('Fox_Tail', [0, 0.78, -0.55]), legs = {};
  for (const side of ['Left', 'Right']) for (const end of ['Front', 'Rear']) legs[side + end] = pivot(`Fox_${side}_${end}_Leg`, [side === 'Left' ? -0.157 : 0.157, 0.55, end === 'Front' ? 0.24 : -0.48]);
  const HEAD = /^(Head|Left_Ear|Right_Ear|Ear_|Left_Eye|Right_Eye|Eye_Highlight|Nose|Red_Snout_Bridge|White_Muzzle|Cheek_Tuft)/;
  for (const o of m.children.slice()) {
    if (!o.isMesh) continue; const n = base(o.name);
    if (HEAD.test(n)) head.attach(o);
    else if (/^Tail_/.test(n)) tail.attach(o);
    else { const k = /^(Left|Right)_(Front|Rear)_/.exec(n); if (k) legs[k[1] + k[2]].attach(o); }
  }
  m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (stone) o.material = stone; } });
  root.scale.setScalar(SCALE); root.userData.fox = { m, head, tail, legs, t: Math.random() * 10 };
  return root;
}
/** pose for this moment: 'walk' (a trot), 'sit' (haunches down, head up) or 'stand' */
function poseFox(root, mode, dt) {
  const f = root.userData.fox; f.t += dt;
  const swing = mode === 'walk' ? Math.sin(f.t * 11) * 0.55 : 0;
  f.legs.LeftFront.rotation.x = swing; f.legs.RightRear.rotation.x = swing; f.legs.RightFront.rotation.x = -swing; f.legs.LeftRear.rotation.x = -swing;
  const sit = mode === 'sit' ? 1 : 0, k = Math.min(1, dt * 5);
  f.m.rotation.x += (-0.42 * sit - f.m.rotation.x) * k;   // the body tips back onto its haunches
  f.m.position.y += (-0.13 * sit - f.m.position.y) * k; f.m.position.z += (-0.1 * sit - f.m.position.z) * k;
  if (sit) { f.legs.LeftRear.rotation.x = f.legs.RightRear.rotation.x = -1.15; f.legs.LeftFront.rotation.x = f.legs.RightFront.rotation.x = 0.42; }
  f.tail.rotation.y = Math.sin(f.t * (mode === 'walk' ? 6 : 1.4)) * (mode === 'walk' ? 0.18 : 0.3);
  f.tail.rotation.x = sit ? 0.5 : 0.08;   // resting on the ground beside it when it sits
  f.head.rotation.y = mode === 'walk' ? 0 : Math.sin(f.t * 0.6) * 0.55 + Math.sin(f.t * 1.7) * 0.12;   // looking about
  f.head.rotation.x = sit ? 0.35 : 0;
}

// ── the route: from the woods beside the shrine, along the summit, down the stone stairs to the torii, and back ──
function route() {
  const { x, z, fx, fz, top, edge } = hillCentre, sx = -fz, sz = fx, side = Math.random() < 0.5 ? 1 : -1;
  const at = (d, s) => new THREE.Vector3(x + fx * d + sx * s, 0, z + fz * d + sz * s);
  const onStairs = d => d > edge && d < edge + 0.44;
  const foot = at(edge + 0.62, 0), low = ground(foot.x, foot.z);
  const y = p => { const d = (p.x - x) * fx + (p.z - z) * fz; return onStairs(d) ? top + (low - top) * (d - edge) / 0.44 : ground(p.x, p.z); };   // the ground, and the stone stairs from the summit down to the gate
  const out = [at(-0.15, side * 0.85), at(-0.05, side * 0.35), at(0.2, 0.05 * side), at(edge - 0.02, 0.02 * side), at(edge + 0.44, 0.02 * side), at(edge + 0.62, 0.2 * side)];
  for (const p of out) p.y = y(p);
  return { out, back: out.slice().reverse(), seat: out[out.length - 1] };
}

let fox = null, visit = null, statues = null, lastTry = -1, forced = false;
/** main.js each frame: a visit at dawn or dusk on most days once the hill is open */
export function updateKitsune(dt, simDt) {
  if (!template || !hill.open) return;
  if (!statues && chronicle.some(e => e.text === SEEN)) placeStatues();
  const h = S.T % 24, day = Math.floor(S.T / 24), slot = day * 2 + (h < 12 ? 0 : 1);
  if (!visit && ((h >= 5.2 && h < 6.3) || (h >= 17.4 && h < 18.5)) && lastTry !== slot) {
    lastTry = slot;
    if (forced || Math.random() < 0.7) {
      forced = false;
      if (!fox) { fox = buildFox(); scene.add(fox); }
      const r = route(); visit = { ...r, leg: 'out', i: 0, t: 0, sitUntil: 0 }; fox.position.copy(r.out[0]); fox.visible = true;
      if (!chronicle.some(e => e.text === SEEN)) { record(SEEN); announce({ title: 'A fox at the shrine', line: 'A red fox has come down from the woods on the hill. It may not stay long.', icon: 'hill', at: r.seat, view: 4 }); }
    }
  }
  if (!visit || !fox) return;
  const speed = 0.42 * simDt, pts = visit.leg === 'out' ? visit.out : visit.back;
  if (visit.leg === 'sit') {
    poseFox(fox, 'sit', simDt);
    if (S.T >= visit.sitUntil) { visit.leg = 'back'; visit.i = 0; }
    return;
  }
  let move = speed;
  while (move > 0 && visit.i < pts.length - 1) {
    const a = pts[visit.i], b = pts[visit.i + 1], L = a.distanceTo(b), left = L * (1 - visit.t);
    if (move < left) { visit.t += move / L; move = 0; } else { move -= left; visit.i++; visit.t = 0; }
  }
  if (visit.i >= pts.length - 1) {
    if (visit.leg === 'out') { visit.leg = 'sit'; visit.sitUntil = S.T + 0.6 + Math.random() * 0.5; fox.rotation.y += Math.PI * 0.6; return; }
    fox.visible = false; visit = null; return;   // back into the woods
  }
  const a = pts[visit.i], b = pts[visit.i + 1];
  fox.position.lerpVectors(a, b, visit.t);
  { const d = (fox.position.x - hillCentre.x) * hillCentre.fx + (fox.position.z - hillCentre.z) * hillCentre.fz; if (!(d > hillCentre.edge && d < hillCentre.edge + 0.44)) fox.position.y = ground(fox.position.x, fox.position.z); }
  fox.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
  poseFox(fox, simDt > 0 ? 'walk' : 'stand', simDt);
}

/** the stone foxes either side of the shrine, once one has been seen */
function placeStatues() {
  const stone = new THREE.MeshStandardMaterial({ color: '#b3ada1', roughness: 0.95, flatShading: true }), plinth = new THREE.MeshStandardMaterial({ color: '#9c968a', roughness: 1 });
  const { x, z, fx, fz, top } = hillCentre, sx = -fz, sz = fx, ang = Math.atan2(fx, fz);
  statues = new THREE.Group();
  for (const s of [-1, 1]) {
    const f = buildFox(stone); poseFox(f, 'sit', 10); f.userData.fox.head.rotation.y = -s * 0.25;
    const px = x + fx * 0.12 + sx * s * 0.34, pz = z + fz * 0.12 + sz * s * 0.34, base = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.13), plinth);
    base.position.set(px, top + 0.035, pz); base.rotation.y = ang; base.castShadow = base.receiveShadow = true;
    f.position.set(px, top + 0.07, pz); f.rotation.y = ang; statues.add(base, f);
  }
  scene.add(statues);
}
/** dev hook: send the fox out now */
export function callKitsune() { lastTry = -1; forced = true; const h = S.T % 24; if (!((h >= 5.2 && h < 6.3) || (h >= 17.4 && h < 18.5))) S.T = Math.floor(S.T / 24) * 24 + 17.45; }
export const kitsune = () => ({ fox, visit, statues });
