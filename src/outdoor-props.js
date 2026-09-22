// Outdoor accessories in game units, Y-up, with the palm grip at the origin.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export const OUTDOOR_PROP_KINDS = ['broom', 'fishing-rod', 'watering-can'];
export function createOutdoorProp(kind, color) {
  if (!OUTDOOR_PROP_KINDS.includes(kind)) throw new Error(`Unknown outdoor prop: ${kind}`);
  const root = new THREE.Group(); root.name = `Komachi_${kind.replaceAll('-', '_')}`;
  root.userData.propKind = kind; root.userData.grip = [0, 0, 0];
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88 });
  const parts = [];
  function add(g, tint, list = parts) {
    const geo = g.index ? g.toNonIndexed() : g; if (geo !== g) g.dispose(); geo.deleteAttribute('uv');
    const c = new THREE.Color(tint), colors = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); list.push(geo);
  }
  function box(size, p, tint) { const g = new THREE.BoxGeometry(...size); g.translate(...p); add(g, tint); }
  function rod(a, b, radius, tint, list = parts, endRadius = radius) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), d = end.clone().sub(start);
    const g = new THREE.CylinderGeometry(endRadius, radius, d.length(), 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    g.translate(...start.add(end).multiplyScalar(.5).toArray()); add(g, tint, list);
  }
  function ring(radius, tube, p, rotation, tint, list = parts) {
    const g = new THREE.TorusGeometry(radius, tube, 5, 12); g.rotateX(rotation[0]); g.rotateY(rotation[1]); g.translate(...p); add(g, tint, list);
  }
  function mesh(name, list) {
    const geo = mergeGeometries(list); list.forEach(g => g.dispose());
    const m = new THREE.Mesh(geo, material); m.name = name; m.castShadow = true; m.receiveShadow = true; root.add(m); return m;
  }
  if (kind === 'broom') {
    rod([0, -.108, 0], [0, .13, 0], .0038, PAL.wood);
    rod([0, -.016, 0], [0, .021, 0], .0045, color || PAL.roofSage);
    ring(.005, .0014, [0, .135, 0], [0, 0], PAL.wood2);
    box([.061, .013, .025], [0, -.109, 0], PAL.wood2);
    box([.065, .008, .027], [0, -.119, 0], color || PAL.roofSage);
    // Distinct straw bundles form a broad, slightly flared sweeping edge.
    for (let i = 0; i < 9; i++) {
      const g = new THREE.BoxGeometry(.0065, .038, .023);
      const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) if (p.getY(k) < 0) p.setX(k, p.getX(k) * 1.35);
      g.rotateZ(-(i - 4) * .025); g.translate((i - 4) * .0073, -.139, 0);
      add(g, i % 2 ? PAL.dirt : PAL.raw);
    }
  } else if (kind === 'fishing-rod') {
    rod([0, -.048, 0], [0, .039, 0], .005, PAL.wood);
    rod([0, -.049, 0], [0, -.044, 0], .0056, PAL.kawara2);
    const pts = [[0, .03, 0], [0, .145, .006], [0, .25, .022], [0, .345, .05], [0, .415, .085]];
    for (let i = 0; i < pts.length - 1; i++) rod(pts[i], pts[i + 1], .0032 - i * .00065, color || PAL.indigo, parts, .00255 - i * .00065);
    for (const p of pts.slice(1)) { rod(p, [p[0], p[1], p[2] + .007], .001, PAL.concrete2); ring(.004, .0008, [0, p[1], p[2] + .009], [Math.PI / 2, 0], PAL.concrete2); }
    rod([0, -.013, 0], [0, -.013, .017], .0025, PAL.kawara2);
    rod([-.012, -.013, .017], [.012, -.013, .017], .011, PAL.concrete2);
    rod([-.014, -.013, .017], [-.014, -.026, .017], .0018, PAL.kawara2);
    rod([-.014, -.026, .017], [-.022, -.026, .017], .0025, PAL.wood2);
    const line = [];
    const route = [[0, -.013, .029], ...pts.slice(1).map(p => [0, p[1], p[2] + .009]), [0, .15, .117]];
    for (let i = 0; i < route.length - 1; i++) rod(route[i], route[i + 1], .00045, PAL.cream2, line);
    const float = new THREE.SphereGeometry(.005, 8, 6); float.scale(1, 2, 1); float.translate(0, .164, .117); add(float, PAL.roofRose, line);
    rod([0, .153, .117], [0, .144, .117], .001, PAL.cream2, line);
    mesh('Fishing_Line', line); // Hide or replace this separately when implementing casting.
  } else {
    const tint = color || PAL.roofTeal;
    // Open container with a real inner wall, solid bottom and rolled lip.
    const shell = new THREE.CylinderGeometry(.029, .034, .057, 16, 1, true); shell.translate(0, -.044, 0); add(shell, tint);
    const inner = new THREE.CylinderGeometry(.0265, .0315, .054, 16, 1, true); inner.scale(-1, 1, 1); inner.translate(0, -.043, 0); add(inner, PAL.kawara2);
    const bottom = new THREE.CylinderGeometry(.033, .033, .003, 16); bottom.translate(0, -.072, 0); add(bottom, tint);
    ring(.028, .002, [0, -.0155, 0], [Math.PI / 2, 0], PAL.concrete2);
    // Carry arch crosses above the fill opening.
    for (const x of [-.027, .027]) rod([x, -.031, 0], [x, -.002, 0], .003, tint);
    rod([-.027, -.002, 0], [-.015, .008, 0], .003, tint);
    rod([-.015, .008, 0], [.015, .008, 0], .004, PAL.wood);
    rod([.015, .008, 0], [.027, -.002, 0], .003, tint);
    // Back loop gives the other hand a place to tip the can.
    const loop = new THREE.TorusGeometry(.019, .0027, 6, 12); loop.rotateY(Math.PI / 2); loop.translate(0, -.043, -.038); add(loop, tint);
    rod([0, -.054, .025], [0, -.016, .083], .008, tint, parts, .005);
    const direction = new THREE.Vector3(0, .55, .83).normalize();
    const rose = new THREE.CylinderGeometry(.014, .006, .012, 12);
    rose.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)); rose.translate(0, -.0127, .088); add(rose, PAL.concrete2);
    const face = new THREE.Vector3(0, -.0127, .088).addScaledVector(direction, .0061);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    for (let i = 0; i < 7; i++) {
      const angle = i * Math.PI / 3, r = i === 6 ? 0 : .008;
      const p = new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0).applyQuaternion(q).add(face);
      const hole = new THREE.CircleGeometry(.0015, 6); hole.applyQuaternion(q); hole.translate(...p.toArray()); add(hole, PAL.kawara2);
    }
    root.userData.pourPoint = face.toArray();
  }
  mesh('Prop_Body', parts); return root;
}
