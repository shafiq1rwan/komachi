// Original carry props: game units, Y-up, origin at the hand grip.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';
import { createOutdoorProp, OUTDOOR_PROP_KINDS } from './outdoor-props.js';

export const PROP_KINDS = ['shopping-bag', 'briefcase', 'umbrella', 'folder', ...OUTDOOR_PROP_KINDS];
export function createCharacterProp(kind, color) {
  if (OUTDOOR_PROP_KINDS.includes(kind)) return createOutdoorProp(kind, color);
  if (!PROP_KINDS.includes(kind)) throw new Error(`Unknown character prop: ${kind}`);
  const root = new THREE.Group(); root.name = `Komachi_${kind.replaceAll('-', '_')}`;
  root.userData.propKind = kind; root.userData.grip = [0, 0, 0];
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92 });
  const parts = [];
  function add(geometry, tint, target = parts) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    const c = new THREE.Color(tint), a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) c.toArray(a, i);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); target.push(g);
  }
  function box(size, position, tint, target) { const g = new THREE.BoxGeometry(...size); g.translate(...position); add(g, tint, target); }
  function rod(a, b, radius, tint, target) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), d = end.clone().sub(start);
    const g = new THREE.CylinderGeometry(radius, radius, d.length(), 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    g.translate(...start.add(end).multiplyScalar(.5).toArray()); add(g, tint, target);
  }
  function merge(name, list, parent = root) {
    const g = mergeGeometries(list); list.forEach(p => p.dispose());
    const m = new THREE.Mesh(g, mat); m.name = name; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  if (kind === 'shopping-bag') {
    const tint = color || PAL.wood;
    // Open paper bag: four walls, bottom, folded rim and two loop handles.
    box([.075, .003, .039], [0, -.0815, 0], tint);
    for (const z of [-.0195, .0195]) box([.075, .059, .0025], [0, -.051, z], tint);
    for (const x of [-.036, .036]) box([.003, .059, .037], [x, -.051, 0], PAL.wood2);
    for (const z of [-.021, .021]) box([.078, .004, .004], [0, -.021, z], PAL.dirt);
    for (const z of [-.016, .016]) {
      rod([-.017, -.022, z], [-.014, 0, z], .002, PAL.cream);
      rod([-.014, 0, z], [.014, 0, z], .002, PAL.cream);
      rod([.014, 0, z], [.017, -.022, z], .002, PAL.cream);
    }
    // A simple printed emblem; deliberately no tiny text.
    box([.021, .019, .001], [0, -.05, .0212], PAL.cream);
    box([.009, .01, .0015], [0, -.05, .022], PAL.roofSage);
  } else if (kind === 'briefcase') {
    const tint = color || PAL.wood2;
    box([.099, .052, .025], [0, -.049, 0], tint);
    box([.101, .007, .027], [0, -.026, 0], PAL.wood);
    for (const x of [-.022, .022]) {
      box([.011, .009, .002], [x, -.028, .0145], PAL.concrete2);
      rod([x * .7, -.024, 0], [x * .7, -.002, 0], .003, PAL.kawara2);
    }
    rod([-.0154, -.002, 0], [.0154, -.002, 0], .0035, PAL.kawara2);
    for (const x of [-.046, .046]) box([.007, .008, .027], [x, -.07, 0], PAL.wood);
  } else if (kind === 'folder') {
    const tint = color || PAL.roofBlue;
    box([.082, .062, .003], [0, -.025, -.003], tint);
    box([.071, .058, .004], [.001, -.02, 0], PAL.cream2);
    // Exposed paper edge and two broad document marks.
    box([.035, .0015, .001], [-.01, .006, .0026], PAL.concrete2);
    box([.023, .0015, .001], [-.016, .002, .0026], PAL.concrete2);
    box([.083, .053, .003], [0, -.0295, .005], tint);
    box([.026, .01, .003], [-.027, .007, -.003], tint);
    box([.032, .012, .001], [.011, -.038, .007], PAL.cream);
    box([.015, .002, .0015], [.011, -.038, .0077], PAL.roofTeal);
  } else {
    rod([-.02, -.012, 0], [-.02, .318, 0], .0023, PAL.concrete2);
    // J handle below the palm.
    const hook = new THREE.TorusGeometry(.01, .003, 6, 10, Math.PI);
    hook.rotateZ(Math.PI); hook.translate(-.01, -.012, 0); add(hook, PAL.wood2);
    rod([0, -.012, 0], [0, .004, 0], .003, PAL.wood2);
    const canopy = new THREE.Group(); canopy.name = 'Canopy'; canopy.position.set(-.02, .31, 0); root.add(canopy);
    const panels = [], ribs = [], radius = .23, count = 10;
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2, b = (i + 1) / count * Math.PI * 2;
      const point = (angle, r, y) => [Math.cos(angle) * r, y, Math.sin(angle) * r];
      const v = [[0, 0, 0], point(a, radius * .58, -.014), point(b, radius * .58, -.014), point(a, radius, -.056), point(b, radius, -.056)];
      // Both sides have real faces, so the umbrella reads correctly from below in any viewer.
      const vertices = []; for (const tri of [[0, 2, 1], [1, 2, 4], [1, 4, 3]]) {
        vertices.push(...v[tri[0]], ...v[tri[1]], ...v[tri[2]], ...v[tri[2]], ...v[tri[1]], ...v[tri[0]]);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); g.computeVertexNormals();
      add(g, i % 2 ? PAL.cream : color || PAL.roofTeal, panels);
      rod([0, -.003, 0], point(a, radius * .58, -.017), .001, PAL.kawara2, ribs);
      rod(point(a, radius * .58, -.017), point(a, radius, -.058), .001, PAL.kawara2, ribs);
      rod(point(a, radius, -.056), point(b, radius, -.056), .0013, PAL.cream, panels);
    }
    merge('Canopy_Panels', panels, canopy); merge('Canopy_Ribs', ribs, canopy);
  }
  merge('Prop_Body', parts);
  if (kind === 'shopping-bag') root.children.forEach(o => o.scale.setScalar(.9));
  return root;
}

export function setUmbrellaOpen(prop, open = true) {
  const canopy = prop.getObjectByName('Canopy');
  if (canopy) canopy.scale.set(open ? 1 : .09, open ? 1 : 2.3, open ? 1 : .09);
}
export function umbrellaClips() {
  return [new THREE.AnimationClip('open', .6, [new THREE.VectorKeyframeTrack('Canopy.scale', [0, .6], [.09, 2.3, .09, 1, 1, 1])]),
    new THREE.AnimationClip('close', .6, [new THREE.VectorKeyframeTrack('Canopy.scale', [0, .6], [1, 1, 1, .09, 2.3, .09])])];
}

const grip = new THREE.Vector3(), direction = new THREE.Vector3(), palm = new THREE.Vector3(-.155, -.01, .035);
/** Equip after attachCharacter resolves. Props stay upright while following the animated palm. */
export function equipCharacterProp(char, kind, color) {
  clearCharacterProp(char);
  const prop = createCharacterProp(kind, color); char.grp.add(prop); char.accessory = prop;
  updateCharacterProp(char); return prop;
}
export function clearCharacterProp(char) {
  if (!char?.accessory) return;
  const materials = new Set(); char.accessory.traverse(o => { if (o.isMesh) { o.geometry.dispose(); materials.add(o.material); } });
  materials.forEach(m => m.dispose()); char.accessory.removeFromParent(); char.accessory = null;
}
export function updateCharacterProp(char) {
  const prop = char.accessory, arm = char.armR; if (!prop || !arm) return;
  char.grp.updateWorldMatrix(true, true);
  const kind = prop.userData.propKind;
  if (kind === 'umbrella' || kind === 'folder' || OUTDOOR_PROP_KINDS.includes(kind)) {
    if (kind === 'umbrella') direction.set(-.17, .145, .035);
    else if (kind === 'broom') direction.set(-.16, .19, .045);
    else if (kind === 'fishing-rod') direction.set(-.15, .16, .08);
    else if (kind === 'watering-can') direction.set(-.17, .13, .04);
    else direction.set(-.07, .17, .085);
    char.grp.localToWorld(direction); arm.parent.worldToLocal(direction); direction.sub(arm.position).normalize();
    arm.quaternion.setFromUnitVectors(grip.copy(palm).normalize(), direction); arm.updateWorldMatrix(true, false);
  }
  grip.copy(palm); arm.localToWorld(grip); char.grp.worldToLocal(grip); prop.position.copy(grip);
  // Thin case and folder lie alongside the leg, clear of the torso.
  prop.rotation.y = kind === 'umbrella' ? 0 : kind === 'folder' ? -.18 : Math.PI / 2;
  if (OUTDOOR_PROP_KINDS.includes(kind)) prop.rotation.set(kind === 'fishing-rod' ? .45 : 0, kind === 'broom' ? 0 : -.35, 0);
}
