// Komachi — rigged people from Kenney's "Mini Characters" pack (CC0, assets/characters/kenney/).
// Opt-in with ?rigged; the box people stay the default. Every character GLB in the folder is loaded once;
// each person gets a clone of one variant, recoloured from their look (skin, shirt, trousers, hair) by
// baking the shared colour atlas into vertex colours and repainting by body part. Animations: idle, walk,
// sit. Falls back to the box people if nothing loads, so the game never depends on the files being there.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { box, cyl, colorize, mergeMesh } from './geometry.js';
import { S } from './state.js';

const SCALE = 0.46;                 // the models are ~0.67 tall; a person here is about 0.31, a little under a door
const SIT_LIFT = 0.09 - 0.026 * SCALE;   // the sit clip drops the root 0.15 and the hips rest at 0.176 (model units); seats sit 0.09 above the group
const ROLE = { none: 0, skin: 1, shirt: 2, pants: 3, hair: 4 };
const chars = [];                   // every live character, for the per-frame mixer update
const pendingSwap = [];             // groups that got a box person before the models arrived
const variants = [];                // { scene, clips, geoms: Map<name, { base, role, medL }> }

const urls = import.meta.glob('../assets/characters/kenney/character-*.glb', { eager: true, query: '?url', import: 'default' });
import colormapUrl from '../assets/characters/kenney/Textures/colormap.png?url';
// the GLBs reference the atlas by a relative path that hashed asset URLs break; point the loader at our copy
const manager = new THREE.LoadingManager(); manager.setURLModifier(url => /colormap.png$/i.test(url) ? colormapUrl : url);

/** the atlas as pixels, so vertex colours can be baked from UVs */
function atlasPixels(texture) {
  const img = texture.image; const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); return { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data };
}
const hsl = { h: 0, s: 0, l: 0 };
const isSkin = c => { c.getHSL(hsl); return hsl.h > 0.03 && hsl.h < 0.09 && hsl.s > 0.35 && hsl.l > 0.5; };   // the peach ramp of faces and hands
/**
 * Bake the atlas into COLOR, and decide what each vertex is: skin (peach ramp anywhere), hair (any other colour
 * on the head that covers a real area; small patches are eyes and mouths), shirt (torso and sleeves), trousers
 * (legs above the shoes). Shoes and small details keep their own colours.
 */
function bakeGeometry(mesh, px, jointNames) {
  const g = mesh.geometry, pos = g.attributes.position, uv = g.attributes.uv, jt = g.attributes.skinIndex, wt = g.attributes.skinWeight, n = pos.count;
  const col = new Float32Array(n * 3), role = new Uint8Array(n), c = new THREE.Color(), isHead = mesh.name === 'head-mesh';
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const x = Math.min(px.w - 1, Math.floor(uv.getX(i) * px.w)), y = Math.min(px.h - 1, Math.floor(uv.getY(i) * px.h)), o = (y * px.w + x) * 4;
    c.setRGB(px.data[o] / 255, px.data[o + 1] / 255, px.data[o + 2] / 255).convertSRGBToLinear();   // canvas pixels are sRGB
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    const key = (px.data[o] << 16) | (px.data[o + 1] << 8) | px.data[o + 2]; groups.set(key, (groups.get(key) || 0) + 1);
  }
  for (let i = 0; i < n; i++) {
    c.setRGB(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
    let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = wt.getComponent(i, k); if (w > bw) { bw = w; best = jt.getComponent(i, k); } }
    const bone = jointNames[best] || '', yv = pos.getY(i);
    if (isSkin(c)) { role[i] = ROLE.skin; continue; }
    if (isHead) { const x = Math.min(px.w - 1, Math.floor(uv.getX(i) * px.w)), y = Math.min(px.h - 1, Math.floor(uv.getY(i) * px.h)), oo = (y * px.w + x) * 4; const cnt = groups.get((px.data[oo] << 16) | (px.data[oo + 1] << 8) | px.data[oo + 2]) || 0; role[i] = cnt >= 12 ? ROLE.hair : ROLE.none; continue; }
    if (bone.startsWith('leg')) { role[i] = yv > 0.045 ? ROLE.pants : ROLE.none; continue; }
    role[i] = ROLE.shirt;   // torso and sleeves
  }
  // median lightness per role, so repainting keeps the shading ramp
  const medL = {}; for (const r of [ROLE.skin, ROLE.shirt, ROLE.pants, ROLE.hair]) { const ls = []; for (let i = 0; i < n; i++) if (role[i] === r) { c.setRGB(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]); c.getHSL(hsl); ls.push(hsl.l); } ls.sort((a, b) => a - b); medL[r] = ls.length ? ls[Math.floor(ls.length / 2)] : 0.5; }
  const base = g.clone(); base.setAttribute('color', new THREE.BufferAttribute(col, 3)); base.deleteAttribute('uv'); base.deleteAttribute('uv1'); base.deleteAttribute('tangent');
  return { base, role, medL };
}
const target = new THREE.Color(), tmp = new THREE.Color(), tHsl = { h: 0, s: 0, l: 0 };
/** a copy of a baked geometry with skin / shirt / trousers / hair repainted from the look, shading kept */
function recolor(entry, look) {
  const g = entry.base.clone(); const col = g.getAttribute('color'); const arr = col.array, n = col.count;
  const paint = { [ROLE.skin]: look.skin, [ROLE.shirt]: look.shirt, [ROLE.pants]: look.pants, [ROLE.hair]: look.hat ? look.hatColor : look.hair };
  for (let i = 0; i < n; i++) {
    const r = entry.role[i]; if (!r) continue;
    target.set(paint[r]); target.getHSL(tHsl);
    tmp.setRGB(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]); tmp.getHSL(hsl);
    const l = Math.min(0.95, Math.max(0.05, tHsl.l * (hsl.l / (entry.medL[r] || 0.5))));
    tmp.setHSL(tHsl.h, tHsl.s, l); arr[i * 3] = tmp.r; arr[i * 3 + 1] = tmp.g; arr[i * 3 + 2] = tmp.b;
  }
  col.needsUpdate = true; return g;
}

const charMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
async function loadVariant(url) {
  const gltf = await new GLTFLoader(manager).loadAsync(url);
  const walk = gltf.animations.find(a => a.name === 'walk'); let skinned = null;
  gltf.scene.traverse(o => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  if (!walk || !skinned) return null;   // an accessory file, not a character
  const tex = skinned.material.map; if (!tex || !tex.image) return null;
  const px = atlasPixels(tex), jointNames = skinned.skeleton.bones.map(b => b.name);
  const geoms = new Map();
  gltf.scene.traverse(o => { if (o.isSkinnedMesh) { geoms.set(o.name, bakeGeometry(o, px, jointNames)); o.material = charMat; o.castShadow = true; o.frustumCulled = false; } });
  return { scene: gltf.scene, clips: gltf.animations, geoms };
}
// The box people are the default look; the rigged models are opt-in with ?rigged (kept for comparison).
export const characterReady = !S.rigged ? Promise.resolve() : Promise.all(Object.values(urls).map(u => loadVariant(u).catch(err => { console.warn('Komachi: character file skipped', u, err); return null; }))).then(list => {
  for (const v of list) if (v) variants.push(v);
  if (!variants.length) { console.warn('Komachi: no rigged characters loaded, using box people'); return; }
  for (const { grp, look } of pendingSwap) { for (const c of grp.children.slice()) grp.remove(c); attachCharacter(grp, look); }
  pendingSwap.length = 0;
});

export const characterAvailable = () => variants.length > 0;

/** the original box person, kept as the fallback and the default */
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

const hashStr = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
/**
 * Put a person's body into `grp` (a Group positioned at the feet). Uses a rigged variant when loaded,
 * otherwise a box person that is swapped later. `look` = { skin, shirt, pants, hair, hat, hatColor, bagColor, name? }.
 */
export function attachCharacter(grp, look) {
  if (!variants.length) { const b = boxPerson(look); grp.add(b.rig); grp.userData.legs = b.legs; grp.userData.upper = b.upper; if (S.rigged) pendingSwap.push({ grp, look }); return null; }
  const v = variants[hashStr(look.name || look.shirt + look.hair) % variants.length];
  const inst = SkeletonUtils.clone(v.scene); inst.scale.setScalar(SCALE);
  inst.traverse(o => { if (o.isSkinnedMesh) { const e = v.geoms.get(o.name); if (e) o.geometry = recolor(e, look); o.material = charMat; o.castShadow = true; o.frustumCulled = false; } });
  const mixer = new THREE.AnimationMixer(inst);
  const act = name => { const c = v.clips.find(x => x.name === name); return c ? mixer.clipAction(c) : null; };
  const idle = act('idle'), walk = act('walk'), sit = act('sit');
  for (const a of [idle, walk, sit]) if (a) { a.play(); a.setEffectiveWeight(0); }
  if (idle) idle.setEffectiveWeight(1); mixer.setTime(Math.random() * 2);
  const head = inst.getObjectByName('head');
  if (look.hat && head) {   // a hard hat for builders, riding on the head bone (model units: the head is ~0.3 wide)
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.11, 12), new THREE.MeshStandardMaterial({ color: look.hatColor, roughness: 0.9 }));
    hat.position.set(0, 0.35, 0); head.add(hat);   // the head is ~0.3 wide and its top ~0.33 above the bone
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.025, 14), hat.material); brim.position.set(0, 0.295, 0.025); head.add(brim);
  }
  const seated = !!(grp.userData.res && grp.userData.res.spot && grp.userData.res.spot.kind === 'seat');   // swapped in while already on a bench
  const char = { root: inst, mixer, idle, walk, sit, head, blend: 0, sitBlend: seated ? 1 : 0, sitting: seated, hammer: 0, grp };
  grp.add(inst); grp.userData.char = char; grp.userData.legs = null; grp.userData.upper = null; chars.push(char); return char;
}
export function detachCharacter(grp) {
  const c = grp.userData.char; if (c) { c.mixer.stopAllAction(); const i = chars.indexOf(c); if (i >= 0) chars.splice(i, 1); }
  const p = pendingSwap.findIndex(x => x.grp === grp); if (p >= 0) pendingSwap.splice(p, 1);
}

const X = new THREE.Vector3(1, 0, 0), qNod = new THREE.Quaternion();
/** advance every visible character's animation; blend idle ↔ walk ↔ sit from its owner's state */
export function updateCharacters(simDt) {
  for (const c of chars) {
    const g = c.grp; if (!g.visible) continue;
    const owner = g.userData.res || g.userData.worker;
    const moving = owner ? (owner.state === 'walking' || owner.state === 'toSite' || owner.state === 'toStation') : false;
    c.blend += ((moving ? 1 : 0) - c.blend) * Math.min(1, simDt * 8);
    c.sitBlend += ((c.sitting ? 1 : 0) - c.sitBlend) * Math.min(1, simDt * 8);
    const s = c.sit ? c.sitBlend : 0;
    if (c.walk) { c.walk.setEffectiveWeight(c.blend * (1 - s)); c.walk.setEffectiveTimeScale(1.6 * (owner && owner.trip && owner.trip.speed ? owner.trip.speed / 0.9 : 1)); }
    if (c.idle) c.idle.setEffectiveWeight((1 - c.blend) * (1 - s));
    if (c.sit) c.sit.setEffectiveWeight(s);
    c.root.position.y = SIT_LIFT * s;
    c.mixer.update(simDt);
    if (c.hammer && c.head) c.head.quaternion.multiply(qNod.setFromAxisAngle(X, c.hammer * 0.25));
  }
}
