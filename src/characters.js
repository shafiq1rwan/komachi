// Komachi — rigged people from Kenney's "Mini Characters" pack (CC0, assets/characters/kenney/).
// The default look since 2026-09-17 (?boxes brings back the box people). Every character GLB in the folder is loaded once;
// each person gets a clone of one variant, recoloured from their look (skin, shirt, trousers, hair) by
// baking the shared colour atlas into vertex colours and repainting by body part. Animations: idle, walk,
// sit. Falls back to the box people if nothing loads, so the game never depends on the files being there.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { box, cyl, colorize, mergeMesh } from './geometry.js';
import { S } from './state.js';
import { poseBikeRider } from './bikes.js';
import { updateCharacterProp, clearCharacterProp } from './character-props.js';
import { updateTeaDrink, aimArm } from './tea-can.js';

const SCALE = 0.46;                 // the models are ~0.67 tall; a person here is about 0.31, a little under a door
const SIT_LIFT = 0.09 - 0.026 * SCALE;   // the sit clip drops the root 0.15 and the hips rest at 0.176 (model units); the seated underside (legs out) is then ~0.025 above the group (world.js SIT_DROP for benches; the bike saddle has its own offset)
const ROLE = { none: 0, skin: 1, shirt: 2, pants: 3, hair: 4 };
// work poses for builders: which clip plays while they stand and do something
const POSE_CLIPS = { swing: 'attack-melee-right', hold: 'holding-right', holdBoth: 'holding-both', pickup: 'pick-up', crouch: 'crouch', press: 'interact-right', drink: 'holding-right' };
// where a tool sits in the right hand (bone units): the arm hangs from the shoulder, the hand is ~0.17 down
const HAND = { pos: [0, -0.17, 0.03], rot: [-Math.PI / 2, 0, 0] };
const chars = [];                   // every live character, for the per-frame mixer update
const pendingSwap = [];             // groups that got a box person before the models arrived
const variants = [];                // { scene, clips, geoms: Map<name, { base, role, medL }> }
let builderVariant = null;

const urls = import.meta.glob('../assets/characters/kenney/character-*.glb', { eager: true, query: '?url', import: 'default' });
import colormapUrl from '../assets/characters/kenney/Textures/colormap.png?url';
import builderUrl from '../assets/characters/builder/komachi-builder.glb?url';
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
  const paint = { [ROLE.skin]: look.skin, [ROLE.shirt]: look.shirt, [ROLE.pants]: look.pants, [ROLE.hair]: look.hair };
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
async function loadVariant(url, builder = false) {
  const gltf = await new GLTFLoader(manager).loadAsync(url);
  const walk = gltf.animations.find(a => a.name === 'walk'); let skinned = null;
  gltf.scene.traverse(o => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  if (!walk || !skinned) return null;   // an accessory file, not a character
  if (builder) {
    if (!gltf.scene.getObjectByName('Builder_HardHat')) throw new Error('Builder asset has no hard hat');
    gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    return { scene: gltf.scene, clips: gltf.animations, geoms: new Map(), builder: true };
  }
  const tex = skinned.material.map; if (!tex || !tex.image) return null;
  const px = atlasPixels(tex), jointNames = skinned.skeleton.bones.map(b => b.name);
  const geoms = new Map();
  gltf.scene.traverse(o => { if (o.isSkinnedMesh) { geoms.set(o.name, bakeGeometry(o, px, jointNames)); o.material = charMat; o.castShadow = true; o.frustumCulled = false; } });
  let headTop = 0.67; gltf.scene.traverse(o => { if (o.isSkinnedMesh && o.name === 'head-mesh') { o.geometry.computeBoundingBox(); headTop = o.geometry.boundingBox.max.y; } });
  return { scene: gltf.scene, clips: gltf.animations, geoms, headTop };
}
// The rigged people are the default; ?boxes keeps the original box people (and any load failure falls back to them).
export const characterReady = !S.rigged ? Promise.resolve() : Promise.all([
  ...Object.values(urls).map(u => loadVariant(u).catch(err => { console.warn('Komachi: character file skipped', u, err); return null; })),
  loadVariant(builderUrl, true).catch(err => { console.warn('Komachi: builder file skipped', err); return null; }),
]).then(list => {
  for (const v of list) if (v) { if (v.builder) builderVariant = v; else variants.push(v); }
  if (!variants.length) { console.warn('Komachi: no rigged characters loaded, using box people'); return; }
  for (const { grp, look } of pendingSwap) { for (const c of grp.children.slice()) grp.remove(c); attachCharacter(grp, look); }
  pendingSwap.length = 0;
});

export const characterAvailable = () => variants.length > 0;

/** the original box person, kept as the fallback and the ?boxes look */
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
  // only construction crews use the builder model; a resident's cap (a box-people detail) does not change their character
  const pool = look.builder ? (variants.filter(v => v.headTop <= 0.7).length ? variants.filter(v => v.headTop <= 0.7) : variants) : variants;   // the fallback helmet needs short hair
  const v = look.builder && builderVariant ? builderVariant : pool[hashStr(look.name || look.shirt + look.hair) % pool.length];
  const inst = SkeletonUtils.clone(v.scene); inst.scale.setScalar(SCALE);
  inst.traverse(o => {
    if (v.builder && o.isMesh) { o.geometry = o.geometry.clone(); o.material = o.material.clone(); }
    else if (o.isSkinnedMesh) { const e = v.geoms.get(o.name); if (e) o.geometry = recolor(e, look); o.material = charMat; }
    if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; }
  });
  const mixer = new THREE.AnimationMixer(inst);
  const act = name => { const c = v.clips.find(x => x.name === name); return c ? mixer.clipAction(c) : null; };
  const idle = act('idle'), walk = act('walk'), sit = act('sit');
  for (const a of [idle, walk, sit]) if (a) { a.play(); a.setEffectiveWeight(0); }
  if (idle) idle.setEffectiveWeight(1); mixer.setTime(Math.random() * 2);
  const head = inst.getObjectByName('head'), armR = inst.getObjectByName('arm-right'), armL = inst.getObjectByName('arm-left');
  if (look.builder && head && !v.builder) {   // fallback only, if the dedicated builder asset failed to load
    const top = v.headTop - 0.343;   // the head bone sits ~0.343 up the model; the head is ~0.3 wide
    // a chibi head is the whole figure seen from above, so the helmet perches small on top rather than covering it
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.16, 0.1, 12), new THREE.MeshStandardMaterial({ color: look.hatColor, roughness: 0.9 }));
    hat.position.set(0, top + 0.04, 0.02); hat.rotation.x = -0.12; head.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.02, 14), hat.material); brim.position.set(0, top - 0.005, 0.04); brim.rotation.x = -0.12; head.add(brim);
  }
  const seated = !!(grp.userData.res && grp.userData.res.spot && grp.userData.res.spot.kind === 'seat');   // swapped in while already on a bench
  const char = { root: inst, mixer, idle, walk, sit, head, armR, armL, headTop: v.headTop, helmet: null, helmetColor: look.hatColor, headRest: head ? head.quaternion.clone() : null, armRRest: armR ? armR.quaternion.clone() : null, armLRest: armL ? armL.quaternion.clone() : null, fidget: null, gaze: 0, gazeBlend: 0, fidgetT: Math.random() * 20, nodT: 0, blend: 0, sitBlend: seated ? 1 : 0, sitting: seated, hammer: 0, grp, pose: null, poseBlend: 0, poseAct: null, poseName: null, act };
  grp.add(inst); grp.userData.char = char; grp.userData.legs = null; grp.userData.upper = null; chars.push(char); return char;
}
/** put a tool mesh (built for the box people, world scale) into the character's right hand */
export function holdTool(char, mesh) {
  if (!char.armR) { char.root.add(mesh); return; }
  const s = 1.5 / SCALE;   // tools read better a little oversized in chibi hands
  mesh.scale.setScalar(s); mesh.position.set(...HAND.pos); mesh.rotation.set(...HAND.rot); char.armR.add(mesh);
}
/** a small thing carried in the right hand (a can, a bag); replaces whatever was held */
export function holdItem(char, mesh) { dropItem(char); char.item = mesh; if(mesh.userData.teaCan){clearCharacterProp(char);char.grp.add(mesh);updateTeaDrink(char,0);}else if(mesh.userData.handItem){clearCharacterProp(char);mesh.scale.setScalar(0.85);mesh.position.set(-0.04,0.16,0.085);char.grp.add(mesh);}else holdTool(char, mesh); }
export function dropItem(char) { if (char.item) { if (char.item.parent) char.item.parent.remove(char.item); if(char.item.userData.teaCan){char.item.geometry.dispose();char.item.material.dispose();} else if(char.item.userData.handItem){char.item.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(o.material&&o.material.dispose)o.material.dispose();}});} char.item = null; } }
export function detachCharacter(grp) {
  clearCharacterProp(grp.userData.char);
  if(grp.userData.char)dropItem(grp.userData.char);
  const c = grp.userData.char; if (c) { c.mixer.stopAllAction(); const i = chars.indexOf(c); if (i >= 0) chars.splice(i, 1); }
  const p = pendingSwap.findIndex(x => x.grp === grp); if (p >= 0) pendingSwap.splice(p, 1);
}

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), qNod = new THREE.Quaternion(), qTurn = new THREE.Quaternion();
/** a cycling helmet in head-bone space: a shallow shell with a vent stripe, a short peak and a chin strap (model units) */
const helmetMat = new Map();
function makeHelmet(top, color) {
  if (!helmetMat.has(color)) helmetMat.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
  const g = new THREE.Group(), m = helmetMat.get(color), dark = new THREE.MeshStandardMaterial({ color: '#4a4340', roughness: 0.9 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), m); shell.scale.set(1, 0.72, 1.08); shell.position.set(0, top - 0.06, -0.01); g.add(shell);
  const vent = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.3), dark); vent.position.set(0, top + 0.06, -0.02); g.add(vent);
  const peak = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.09), dark); peak.position.set(0, top - 0.02, 0.2); peak.rotation.x = 0.25; g.add(peak);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.02), dark); for (const s of [-1, 1]) { const st = strap.clone(); st.position.set(s * 0.19, top - 0.2, 0.02); g.add(st); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
}
/** advance every visible character's animation; blend idle ↔ walk ↔ sit from its owner's state */
export function updateCharacters(simDt) {
  for (const c of chars) {
    const g = c.grp; if (!g.visible) continue;
    const owner = g.userData.res || g.userData.worker;
    const moving = owner ? !owner.paused && (owner.state === 'walking' || owner.state === 'toSite' || owner.state === 'toStation') : false;
    c.blend += ((moving ? 1 : 0) - c.blend) * Math.min(1, simDt * 8);
    const riding = !!(owner?.trip?.ride && owner.bike);
    c.sitBlend += (((c.sitting || riding) ? 1 : 0) - c.sitBlend) * Math.min(1, simDt * 8);   // a rider sits on the saddle
    const s = c.sit ? c.sitBlend : 0;
    if (c.walk) { c.walk.setEffectiveWeight(c.blend * (1 - s)); c.walk.setEffectiveTimeScale(1.6 * (owner && owner.trip && owner.trip.speed ? owner.trip.speed / 0.9 : 1)); }
    if (c.idle) c.idle.setEffectiveWeight((1 - c.blend) * (1 - s));
    if (c.sit) c.sit.setEffectiveWeight(s);
    // builders: a work pose replaces idle while standing with a job in hand
    const want = moving ? null : c.pose;
    if (want !== c.poseName) { if (c.poseAct) c.poseAct.fadeOut(0.2); c.poseName = want; c.poseAct = want && POSE_CLIPS[want] ? c.act(POSE_CLIPS[want]) : null; if (c.poseAct) { c.poseAct.reset().setEffectiveWeight(1).play(); c.poseAct.setEffectiveTimeScale(want === 'swing' ? 1.3 : 1); } }
    c.poseBlend += ((c.poseAct ? 1 : 0) - c.poseBlend) * Math.min(1, simDt * 8);
    if (c.poseAct) c.poseAct.setEffectiveWeight(c.poseBlend);
    if (c.idle) c.idle.setEffectiveWeight((1 - c.blend) * (1 - s) * (1 - c.poseBlend));
    c.root.position.y = SIT_LIFT * s;
    // bones the clips may not drive (head, arms) go back to rest before the mixer runs, so the per-frame turns below never accumulate
    if (c.head) c.head.quaternion.copy(c.headRest); if (c.armR) c.armR.quaternion.copy(c.armRRest); if (c.armL) c.armL.quaternion.copy(c.armLRest);
    c.mixer.update(simDt);
    c.root.rotation.x = riding ? 0.22 : 0;   // a lean over the bars
    if (riding) { poseBikeRider(c.root, owner.bike); if (!c.helmet && c.head && c.headTop) { c.helmet = makeHelmet(c.headTop - 0.343, c.helmetColor); c.head.add(c.helmet); } }
    if (c.helmet) c.helmet.visible = riding;
    if (c.hammer && c.head) c.head.quaternion.multiply(qNod.setFromAxisAngle(X, c.hammer * 0.25));
    if (c.poseName === 'drink' && c.head) { c.sipT = (c.sipT || 0) + simDt; const sip = Math.max(0, Math.sin(c.sipT * 1.6) - 0.35) / 0.65; c.head.quaternion.multiply(qNod.setFromAxisAngle(X, -0.5 * sip)); if (c.armR) c.armR.rotation.x -= 0.9 * sip; }   // a sip: head tips back, the can comes up
    else c.sipT = 0;
    if(c.item?.userData.teaCan)updateTeaDrink(c,c.poseName==='drink'?Math.max(0,Math.sin(c.sipT*1.6)-.35)/.65:0);
    // bench life: nobody sits like a statue. Slow weight shifts, a glance (c.gaze, radians to the side), and a small
    // business set by sim.js: phone (head down, arm up), paper (both arms), nod (chatting)
    if (c.sitting && c.sitBlend > 0.5) {
      c.fidgetT += simDt; const w = c.fidgetT;
      c.root.rotation.y = Math.sin(w * 0.45) * 0.06 + Math.sin(w * 0.13) * 0.05; c.root.position.x = Math.sin(w * 0.3) * 0.008;
      c.gazeBlend += ((c.gaze ? 1 : 0) - c.gazeBlend) * Math.min(1, simDt * 4); if (c.gaze) c.gazeHeld = c.gaze;
      if (c.head && c.gazeBlend > 0.01) c.head.quaternion.multiply(qTurn.setFromAxisAngle(Y, (c.gazeHeld || 0) * c.gazeBlend));
      const it = c.item && c.item.userData.handItem ? c.item : null;
      if (c.fidget === 'phone' && it) {   // the phone held in front of the chest, screen tilted up to the face; the right arm reaches to it
        it.position.set(-0.04, 0.16, 0.085); it.rotation.set(0.65, Math.PI, 0);   // chest height, turned round: the screen faces the reader, tilted up to the face c.grp.updateWorldMatrix(true, true); if (c.armR) aimArm(c, c.armR, it.position);
        if (c.head) c.head.quaternion.multiply(qNod.setFromAxisAngle(X, 0.42));
      } else if (c.fidget === 'paper' && it) {   // the paper open in both hands
        it.position.set(0, 0.155, 0.1); it.rotation.set(0.5, Math.PI, 0);   // front page toward the reader c.grp.updateWorldMatrix(true, true);
        if (c.armR) aimArm(c, c.armR, it.position.clone().add(new THREE.Vector3(-0.045, -0.02, 0))); if (c.armL) aimArm(c, c.armL, it.position.clone().add(new THREE.Vector3(0.045, -0.02, 0)), true);
        if (c.head) c.head.quaternion.multiply(qNod.setFromAxisAngle(X, 0.3));
      }
      else if (c.fidget === 'nod' && c.head) { c.nodT += simDt; c.head.quaternion.multiply(qNod.setFromAxisAngle(X, Math.sin(c.nodT * 7) * 0.18)); }
    } else { c.root.rotation.y = 0; c.root.position.x = 0; c.gazeBlend = 0; c.nodT = 0; }
    updateCharacterProp(c);
  }
}
