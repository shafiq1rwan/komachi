// Komachi — the rigged resident character (assets/characters/komachi-resident.glb).
// Loaded once, cloned per person with a recoloured palette so everyone looks a little different,
// animated with Idle/Walk, posed for sitting on benches. Falls back to the original box people if
// the file is missing, so the game never depends on the asset being there.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import residentUrl from '../assets/characters/komachi-resident.glb?url';
import { box, cyl, colorize, mergeMesh } from './geometry.js';
import { S } from './state.js';

const SCALE = 0.82;                 // model is 0.35 tall; a person should be a bit under a door (0.3)
const chars = [];                   // every live character, for the per-frame mixer update
const pendingSwap = [];             // groups that got a box person before the model arrived
let base = null, clips = null, sitSign = -1;

// the model's palette in linear RGB (as stored in COLOR_0), classified by what it paints
const lin = hex => new THREE.Color(hex);   // Color() already converts an sRGB hex to the linear working space
const PALETTE = [
  { key: 'skin', c: lin('#dba67c') }, { key: 'jacket', c: lin('#808c7b') }, { key: 'pants', c: lin('#626777') },
  { key: 'shoes', c: lin('#51453d') }, { key: 'bag', c: lin('#b58a52') }, { key: 'bag', c: lin('#b08552') },
  { key: 'shirt', c: lin('#efdfc8') }, { key: 'eyes', c: lin('#4a3e33') }, { key: 'hair', c: lin('#5f4941') },
];
const HAIR_BASE = lin('#5f4941');
function classify(r, g, b) {
  let best = null, bd = 1e9;
  for (const p of PALETTE) { const d = (p.c.r - r) ** 2 + (p.c.g - g) ** 2 + (p.c.b - b) ** 2; if (d < bd) { bd = d; best = p.key; } }
  return best;
}
/** clone the geometry and repaint jacket / pants / hair / skin / bag from the person's look */
function recolor(geom, look) {
  const g = geom.clone(); const col = g.getAttribute('color'); const arr = col.array.slice(); const n = col.count, stride = col.itemSize;
  const L = { jacket: lin(look.shirt), pants: lin(look.pants), skin: lin(look.skin), hair: lin(look.hair), bag: lin(look.bagColor || '#b58a52'), shirt: lin(look.under || '#efdfc8') };
  for (let i = 0; i < n; i++) {
    const r = arr[i * stride], gg = arr[i * stride + 1], b = arr[i * stride + 2];
    const k = classify(r, gg, b); const t = L[k]; if (!t) continue;
    if (k === 'hair') { arr[i * stride] = t.r * (r / HAIR_BASE.r); arr[i * stride + 1] = t.g * (gg / HAIR_BASE.g); arr[i * stride + 2] = t.b * (b / HAIR_BASE.b); }   // keep the facet shading
    else { arr[i * stride] = t.r; arr[i * stride + 1] = t.g; arr[i * stride + 2] = t.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, stride)); return g;
}

const charMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
// The box people are the default look; the rigged model is opt-in with ?rigged (kept for comparison).
export const characterReady = !S.rigged ? Promise.resolve() : new GLTFLoader().loadAsync(residentUrl).then(gltf => {
  base = gltf.scene; clips = gltf.animations;
  base.traverse(o => { if (o.isMesh) { o.material = charMat; o.castShadow = true; o.frustumCulled = false; } });
  // which way does a 90° turn about the thigh's local X swing the knee? pick the sign that moves it forward (+z)
  const probe = SkeletonUtils.clone(base); probe.updateMatrixWorld(true);
  const th = probe.getObjectByName('thighL'), sh = probe.getObjectByName('shinL');   // GLTFLoader strips the dots from node names
  if (th && sh) {
    const before = sh.getWorldPosition(new THREE.Vector3());
    th.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)); probe.updateMatrixWorld(true);
    const after = sh.getWorldPosition(new THREE.Vector3()); sitSign = after.z > before.z ? -1 : 1;
  }
  for (const { grp, look } of pendingSwap) { for (const c of grp.children.slice()) grp.remove(c); attachCharacter(grp, look); }
  pendingSwap.length = 0;
}).catch(err => { console.warn('Komachi: resident model not available, using box people', err); });

export const characterAvailable = () => !!base;

/** the original box person, kept as the fallback */
function boxPerson(look) {
  const rig = new THREE.Group(); rig.scale.setScalar(0.7);
  const legs = mergeMesh([box(0.15, 0.13, 0.11, look.pants, 0, -0.065, 0)], false); legs.position.y = 0.13; legs.castShadow = true; rig.add(legs);
  const g = [box(0.17, 0.2, 0.12, look.shirt, 0, 0.23, 0), box(0.05, 0.16, 0.05, look.shirt, -0.11, 0.24, 0), box(0.05, 0.16, 0.05, look.shirt, 0.11, 0.24, 0)];
  const head = new THREE.SphereGeometry(0.085, 8, 6); head.translate(0, 0.42, 0); g.push(colorize(head, look.skin));
  if (look.hat) { g.push(cyl(0.11, 0.11, 0.03, look.hatColor, 0, 0.47, 0, 10)); g.push(cyl(0.07, 0.075, 0.07, look.hatColor, 0, 0.51, 0, 10)); }
  else { const hair = new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2); hair.translate(0, 0.43, 0); g.push(colorize(hair, look.hair)); }
  const upper = mergeMesh(g, false); upper.castShadow = true; rig.add(upper);
  return { rig, legs, upper };
}

/**
 * Put a person's body into `grp` (a Group positioned at the feet). Uses the rigged model when it has
 * loaded, otherwise a box person that is swapped for the model later. `look` = { skin, shirt, pants,
 * hair, hat, hatColor, bagColor }.
 */
export function attachCharacter(grp, look) {
  if (!base) { const b = boxPerson(look); grp.add(b.rig); grp.userData.legs = b.legs; grp.userData.upper = b.upper; if (S.rigged) pendingSwap.push({ grp, look }); return null; }
  const inst = SkeletonUtils.clone(base); inst.scale.setScalar(SCALE);
  inst.traverse(o => { if (o.isSkinnedMesh) { o.geometry = recolor(o.geometry, look); o.material = charMat; o.castShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(inst);
  const idle = mixer.clipAction(clips.find(c => c.name === 'Idle')), walk = mixer.clipAction(clips.find(c => c.name === 'Walk'));
  idle.play(); walk.play(); walk.setEffectiveWeight(0); mixer.setTime(Math.random() * 2);
  const bones = { head: inst.getObjectByName('head'), chest: inst.getObjectByName('chest'), hips: inst.getObjectByName('hips'),
    thighL: inst.getObjectByName('thighL'), thighR: inst.getObjectByName('thighR'), shinL: inst.getObjectByName('shinL'), shinR: inst.getObjectByName('shinR') };
  if (look.hat && bones.head) {   // a hard hat for builders, riding on the head bone
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.082, 0.05, 10), new THREE.MeshStandardMaterial({ color: look.hatColor, roughness: 0.9 }));
    hat.position.set(0, 0.08, 0.004); bones.head.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.01, 12), hat.material); brim.position.set(0, 0.058, 0.012); bones.head.add(brim);
  }
  const char = { root: inst, mixer, idle, walk, bones, blend: 0, sitting: false, hammer: 0, grp };
  grp.add(inst); grp.userData.char = char; grp.userData.legs = null; grp.userData.upper = null; chars.push(char); return char;
}
export function detachCharacter(grp) {
  const c = grp.userData.char; if (c) { c.mixer.stopAllAction(); const i = chars.indexOf(c); if (i >= 0) chars.splice(i, 1); }
  const p = pendingSwap.findIndex(x => x.grp === grp); if (p >= 0) pendingSwap.splice(p, 1);
}

const qSit = new THREE.Quaternion(), qKnee = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
/** advance every visible character's animation; blend Idle↔Walk from its owner's state; apply sit / hammer poses */
export function updateCharacters(simDt) {
  for (const c of chars) {
    const g = c.grp; if (!g.visible) continue;
    const owner = g.userData.res || g.userData.worker;
    const moving = owner ? (owner.state === 'walking' || owner.state === 'toSite' || owner.state === 'toStation') : false;
    c.blend += ((moving ? 1 : 0) - c.blend) * Math.min(1, simDt * 8);
    c.walk.setEffectiveWeight(c.blend); c.idle.setEffectiveWeight(1 - c.blend);
    c.walk.setEffectiveTimeScale(owner && owner.trip && owner.trip.speed ? owner.trip.speed / 0.9 * 1.15 : 1.15);
    c.mixer.update(simDt);
    if (c.sitting && c.bones.thighL) {
      qSit.setFromAxisAngle(X, sitSign * Math.PI / 2); qKnee.setFromAxisAngle(X, -sitSign * Math.PI / 2);
      for (const t of [c.bones.thighL, c.bones.thighR]) t.quaternion.multiply(qSit);
      for (const s of [c.bones.shinL, c.bones.shinR]) if (s) s.quaternion.multiply(qKnee);
    }
    if (c.hammer && c.bones.chest) c.bones.chest.quaternion.multiply(qKnee.setFromAxisAngle(X, c.hammer * 0.35));
  }
}
