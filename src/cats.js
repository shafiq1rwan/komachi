// Original Komachi cat: chunky, bevelled forms, a small palette and no textures.
// Authoring units: Y up, +Z forward, paws on Y=0. Seven rigid parts animate independently.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL, HAIR } from './palette.js';

export const CAT_COATS = [PAL.treeOrange, PAL.cream, PAL.asphalt2, HAIR[0], PAL.cream2];

function colorize(g, hex) {
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex), colors = [];
  for (let i = 0; i < g.attributes.position.count; i++) colors.push(c.r, c.g, c.b);
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); return g;
}

function rounded(size, at, color, bevel = 0.035) {
  const g = new RoundedBoxGeometry(...size, 1, bevel);
  g.translate(...at); return colorize(g, color);
}
function ear(x, color, inset = false) {
  const s = Math.sign(x);
  // Keep the pink inset on the sloping front face, with a tiny offset to avoid z-fighting.
  const frontZ = y => 0.105 - (y - 0.155) * 0.25 + 0.0015;
  const vertices = inset
    ? [x - 0.042, 0.193, frontZ(0.193), x + 0.042, 0.193, frontZ(0.193), x + s * 0.019, 0.282, frontZ(0.282)]
    : [x - 0.08, 0.155, 0.105, x + 0.08, 0.155, 0.105, x + s * 0.025, 0.315, 0.065,
      x - 0.08, 0.155, -0.035, x + 0.08, 0.155, -0.035, x + s * 0.025, 0.315, 0.005];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setIndex(inset ? [0, 1, 2] : [0, 1, 2, 5, 4, 3, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0]);
  g.computeVertexNormals(); return colorize(g, color);
}
function part(parent, name, geoms, position = [0, 0, 0]) {
  const plain = geoms.map(g => g.index ? g.toNonIndexed() : g);
  const geometry = mergeGeometries(plain, false);
  new Set([...geoms, ...plain]).forEach(g => g.dispose());
  const mesh = new THREE.Mesh(geometry, parent.catMaterial); mesh.name = name;
  mesh.position.set(...position); mesh.castShadow = true; mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}

/** Self-contained geometry, usable in the town, a preview or a GLB export. */
export function createCat(coat = CAT_COATS[0], scale = 0.21) {
  const root = new THREE.Group(); root.name = 'Komachi_Cat'; root.scale.setScalar(scale);
  root.catMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const body = part(root, 'Body', [rounded([0.43, 0.4, 0.72], [0, 0.43, -0.055], coat, 0.07),
    rounded([0.31, 0.31, 0.1], [0, 0.45, 0.3], PAL.cream2, 0.04)]);
  const head = part(root, 'Head', [rounded([0.51, 0.4, 0.4], [0, 0, 0], coat, 0.065),
    ear(-0.155, coat), ear(0.155, coat), ear(-0.155, PAL.pink, true), ear(0.155, PAL.pink, true),
    rounded([0.255, 0.13, 0.07], [0, -0.096, 0.205], PAL.cream2, 0.03),
    rounded([0.052, 0.074, 0.025], [-0.133, 0.023, 0.204], HAIR[0], 0.009),
    rounded([0.052, 0.074, 0.025], [0.133, 0.023, 0.204], HAIR[0], 0.009),
    rounded([0.057, 0.034, 0.026], [0, -0.068, 0.25], PAL.roofRose, 0.009),
    rounded([0.012, 0.033, 0.009], [0, -0.096, 0.25], HAIR[0], 0.002),
  ], [0, 0.68, 0.29]);
  const legs = [];
  for (const [i, [x, z]] of [[-0.145, 0.21], [0.145, 0.21], [-0.145, -0.29], [0.145, -0.29]].entries()) {
    legs.push(part(root, `Leg_${i}`, [rounded([0.135, 0.235, 0.15], [0, -0.105, 0], coat, 0.02),
      rounded([0.15, 0.095, 0.19], [0, -0.2525, 0.018], PAL.cream2, 0.018)], [x, 0.3, z]));
  }
  const curve = new THREE.CatmullRomCurve3([[0, 0, 0], [0, 0.15, -0.12], [0, 0.39, -0.16], [0, 0.54, -0.12], [0, 0.56, -0.025]].map(p => new THREE.Vector3(...p)));
  const tailGeo = new THREE.TubeGeometry(curve, 10, 0.053, 5, false);
  const tip = new THREE.SphereGeometry(0.054, 5, 3); tip.translate(0, 0.56, -0.025);
  const tail = part(root, 'Tail', [colorize(tailGeo, coat), colorize(tip, PAL.cream2)], [0, 0.42, -0.38]);
  // References stay off userData, so GLTFExporter can serialize the asset without cycles.
  root.catParts = { body, head, legs, tail, time: 0 };
  return root;
}

export function updateCat(root, dt, walking) {
  const p = root.catParts; if (!p) return;
  p.time += dt;
  const gait = Math.sin(p.time * 10) * (walking ? 0.48 : 0);
  p.legs.forEach((leg, i) => { leg.rotation.x = gait * ([1, -1, -1, 1][i]); });
  p.tail.rotation.z = Math.sin(p.time * 2) * 0.12;
  p.head.rotation.y = walking ? 0 : Math.sin(p.time * 0.9) * 0.12;
  p.body.position.y = walking ? Math.abs(Math.sin(p.time * 10)) * 0.012 : 0;
}

/** Portable rigid-node clips; the town uses the equivalent lightweight procedural gait. */
export function catClips() {
  const duration = Math.PI / 5, times = Array.from({ length: 25 }, (_, i) => i * duration / 24);
  const tracks = [];
  for (let i = 0; i < 4; i++) {
    const values = times.flatMap(t => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.sin(t * 10) * 0.48 * [1, -1, -1, 1][i]).toArray());
    tracks.push(new THREE.QuaternionKeyframeTrack(`Leg_${i}.quaternion`, times, values));
  }
  const idleTimes = Array.from({ length: 49 }, (_, i) => i * Math.PI / 24);
  const idleValues = idleTimes.flatMap(t => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(t * 2) * 0.12).toArray());
  return [new THREE.AnimationClip('walk', duration, tracks), new THREE.AnimationClip('idle', Math.PI * 2, [new THREE.QuaternionKeyframeTrack('Tail.quaternion', idleTimes, idleValues)])];
}
