// Original low-poly dolphin. Y up, +Z forward; editable, texture-free geometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL, HAIR } from './palette.js';

function paint(geometry, color) {
  geometry.deleteAttribute('uv');
  const c = new THREE.Color(color), colors = [];
  for (let i = 0; i < geometry.attributes.position.count; i++) colors.push(c.r, c.g, c.b);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

// Elliptical rings make one continuous silhouette and an integrated pale underside.
function hull(rings, coat) {
  const positions = [], colors = [], blue = new THREE.Color(coat), belly = new THREE.Color(PAL.blueWall);
  const point = (ring, j) => {
    const [z, y, width, height] = ring, angle = j * Math.PI / 6;
    return [Math.cos(angle) * width, y + Math.sin(angle) * height, z];
  };
  const tri = (a, b, c, color) => { positions.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) colors.push(color.r, color.g, color.b); };
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < 12; j++) {
    const a = point(rings[i], j), b = point(rings[i], j + 1), c = point(rings[i + 1], j + 1), d = point(rings[i + 1], j);
    const color = j >= 7 && j <= 10 ? belly : blue;
    tri(a, b, c, color); tri(a, c, d, color);
  }
  for (let j = 0; j < 12; j++) {
    const first = rings[0], last = rings.at(-1);
    tri([0, first[1], first[0]], point(first, j + 1), point(first, j), blue);
    tri([0, last[1], last[0]], point(last, j), point(last, j + 1), blue);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); return g;
}

// A closed, tapered fin, thick along the centre and thin along its outline.
function fin(outline, axis, thickness, coat) {
  const center = new THREE.Vector3(); outline.forEach(p => center.add(new THREE.Vector3(...p))); center.divideScalar(outline.length);
  const top = center.clone(), bottom = center.clone(); top[axis] += thickness; bottom[axis] -= thickness;
  const positions = [];
  for (let i = 0; i < outline.length; i++) {
    const a = new THREE.Vector3(...outline[i]), b = new THREE.Vector3(...outline[(i + 1) % outline.length]);
    // Choose winding from the supplied thickness axis, including mirrored fins.
    const normal = b.clone().sub(a).cross(top.clone().sub(a));
    const pair = normal[axis] > 0 ? [a, b] : [b, a];
    positions.push(...pair[0].toArray(), ...pair[1].toArray(), ...top.toArray());
    positions.push(...pair[1].toArray(), ...pair[0].toArray(), ...bottom.toArray());
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.computeVertexNormals(); return paint(g, coat);
}

function mesh(parent, name, geoms, material) {
  const flat = geoms.map(g => g.index ? g.toNonIndexed() : g);
  const g = mergeGeometries(flat, false); new Set([...flat, ...geoms]).forEach(x => x.dispose());
  const m = new THREE.Mesh(g, material); m.name = name; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}

export function createDolphin(coat = PAL.roofBlue, scale = 1) {
  const root = new THREE.Group(); root.name = 'Komachi_Dolphin'; root.scale.setScalar(scale);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.88, metalness: 0 });
  const body = [hull([
    [-0.94, -0.025, 0.115, 0.115], [-0.65, 0, 0.23, 0.22], [-0.3, 0.035, 0.34, 0.31],
    [0.1, 0.065, 0.385, 0.35], [0.43, 0.085, 0.355, 0.33], [0.66, 0.065, 0.285, 0.265],
    [0.82, 0.015, 0.2, 0.175], [0.88, -0.06, 0.125, 0.078],
    [1.18, -0.075, 0.10, 0.063], [1.34, -0.08, 0.067, 0.045], [1.385, -0.08, 0.02, 0.025],
  ], coat), fin([[0, 0.27, 0.02], [0, 0.64, -0.20], [0, 0.79, -0.40], [0, 0.42, -0.39], [0, 0.22, -0.59]], 'x', 0.06, coat)];
  for (const side of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.035, 8, 5); eye.scale(0.6, 1, 1); eye.translate(side * 0.293, 0.13, 0.63); body.push(paint(eye, HAIR[0]));
    const glint = new THREE.SphereGeometry(0.009, 6, 4); glint.translate(side * 0.312, 0.142, 0.64); body.push(paint(glint, PAL.cream2));
    const mouth = new THREE.CatmullRomCurve3([[side * 0.075, -0.091, 1.29], [side * 0.103, -0.097, 1.14], [side * 0.126, -0.082, 0.91]].map(p => new THREE.Vector3(...p)));
    body.push(paint(new THREE.TubeGeometry(mouth, 4, 0.006, 4, false), PAL.roofTeal));
  }
  mesh(root, 'Body', body, material);
  for (const side of [-1, 1]) {
    const flipper = mesh(root, side < 0 ? 'Flipper_L' : 'Flipper_R', [fin([[0, 0, 0.10], [side * 0.28, -0.12, -0.08], [side * 0.51, -0.23, -0.39], [side * 0.25, -0.19, -0.34], [0, -0.025, -0.12]], 'y', 0.032, coat)], material);
    flipper.position.set(side * 0.28, -0.115, 0.17);
  }
  const tail = new THREE.Group(); tail.name = 'Tail'; tail.position.set(0, -0.025, -0.85); root.add(tail);
  const tailParts = [hull([[0.05, 0, 0.125, 0.12], [-0.2, -0.015, 0.085, 0.085], [-0.46, -0.025, 0.06, 0.055], [-0.63, -0.025, 0.095, 0.025]], coat)];
  for (const side of [-1, 1]) tailParts.push(fin([[0, -0.025, -0.54], [side * 0.26, -0.015, -0.43], [side * 0.67, 0.02, -0.43], [side * 0.48, -0.005, -0.65], [side * 0.15, -0.025, -0.76], [0, -0.025, -0.65]], 'y', 0.033, coat));
  mesh(tail, 'Tail_Mesh', tailParts, material);
  return root;
}

export function dolphinClips() {
  const times = Array.from({ length: 33 }, (_, i) => i * 1.6 / 32);
  const rotation = (name, axis, amplitude, offset = 0) => new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, times.flatMap(t => new THREE.Quaternion().setFromAxisAngle(axis, Math.sin(t / 1.6 * Math.PI * 2 + offset) * amplitude).toArray()));
  return [new THREE.AnimationClip('swim', 1.6, [rotation('Tail', new THREE.Vector3(1, 0, 0), 0.22), rotation('Flipper_L', new THREE.Vector3(0, 0, 1), 0.075, 0.5), rotation('Flipper_R', new THREE.Vector3(0, 0, 1), -0.075, 0.5)])];
}
