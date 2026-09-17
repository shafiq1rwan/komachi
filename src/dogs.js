// Original Komachi Shiba Inu: compact low-poly forms, palette colours and rigid-node animation.
// Authoring units: Y up, +Z forward, paws on Y=0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL, HAIR } from './palette.js';

export const DOG_COATS = [PAL.treeOrange, '#b98a5b', PAL.cream, '#7a706a'];

function colorize(geometry, hex) {
  geometry.deleteAttribute('uv');
  const c = new THREE.Color(hex), colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < geometry.attributes.position.count; i++) colors.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); return geometry;
}
function rounded(size, at, color, bevel = .035) {
  const geometry = new RoundedBoxGeometry(...size, 1, bevel); geometry.translate(...at); return colorize(geometry, color);
}
function ear(x, coat, inner = false) {
  const s = Math.sign(x);
  const frontZ = y => .13 - (y - .105) * (.055 / .195) + .001;
  const vertices = inner
    ? [x - .039, .205, frontZ(.205), x + .039, .205, frontZ(.205), x + s * .018, .272, frontZ(.272)]
    : [x - .075, .105, .13, x + .075, .105, .13, x + s * .025, .30, .075,
      x - .075, .105, -.06, x + .075, .105, -.06, x + s * .025, .30, .01];
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(inner ? [0, 1, 2] : [0, 1, 2, 5, 4, 3, 0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 3, 2, 3, 0]);
  geometry.computeVertexNormals(); return colorize(geometry, inner ? PAL.pink : coat);
}
function part(parent, name, geoms, position = [0, 0, 0]) {
  const plain = geoms.map(g => g.index ? g.toNonIndexed() : g), geometry = mergeGeometries(plain, false);
  new Set([...geoms, ...plain]).forEach(g => g.dispose());
  const mesh = new THREE.Mesh(geometry, parent.dogMaterial); mesh.name = name; mesh.position.set(...position);
  mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}

export function createDog(coat = DOG_COATS[0], scale = .25) {
  const root = new THREE.Group(); root.name = 'Komachi_Shiba'; root.scale.setScalar(scale);
  root.dogMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95, metalness: 0 });
  const body = part(root, 'Body', [
    rounded([.48, .43, .78], [0, .48, -.07], coat, .085),
    rounded([.34, .28, .095], [0, .48, .34], PAL.cream2, .04),
    rounded([.30, .19, .07], [0, .35, .355], PAL.cream2, .03),
  ]);
  const head = part(root, 'Head', [
    rounded([.52, .43, .43], [0, 0, 0], coat, .075),
    ear(-.155, coat), ear(.155, coat), ear(-.155, coat, true), ear(.155, coat, true),
    rounded([.31, .17, .16], [0, -.105, .225], PAL.cream2, .045),
    rounded([.06, .075, .028], [-.135, .015, .218], HAIR[0], .011),
    rounded([.06, .075, .028], [.135, .015, .218], HAIR[0], .011),
    rounded([.075, .052, .035], [0, -.08, .315], HAIR[0], .014),
    rounded([.012, .048, .012], [0, -.125, .31], HAIR[0], .003),
  ], [0, .82, .31]);
  // Rotate the torso around its centre when the dog lowers its haunches.
  body.geometry.translate(0, -.48, .07); body.position.set(0, .48, -.07);
  const legs = [];
  for (const [i, [x, z]] of [[-.16, .23], [.16, .23], [-.16, -.31], [.16, -.31]].entries()) {
    legs.push(part(root, `Leg_${i}`, [rounded([.15, .30, .17], [0, -.13, 0], coat, .026), rounded([.17, .105, .21], [0, -.31, .025], PAL.cream2, .023)], [x, .3625, z]));
  }
  const curl = new THREE.CatmullRomCurve3([[0, 0, 0], [.08, .14, -.04], [.18, .30, .015], [.21, .40, .16], [.15, .42, .30], [.035, .35, .34], [-.035, .27, .25]].map(p => new THREE.Vector3(...p)));
  const tailGeo = new THREE.TubeGeometry(curl, 14, .065, 6, false), tailTip = new THREE.SphereGeometry(.065, 6, 4); tailTip.translate(-.035, .27, .25);
  const tail = part(root, 'Tail', [colorize(tailGeo, coat), colorize(tailTip, PAL.cream2)], [0, .48, -.44]);
  root.dogParts = { body, head, legs, tail, time: 0 };
  return root;
}

export function updateDog(root, dt, walking, sitting = false, sniffing = false) {
  const p = root.dogParts; if (!p) return;
  if (!p.mixer) { p.mixer = new THREE.AnimationMixer(root); p.actions = Object.fromEntries(dogClips().map(clip => [clip.name, p.mixer.clipAction(clip)])); }
  const mode = walking ? 'walk' : sitting ? 'sit' : sniffing ? 'sniff' : 'idle';
  if (p.mode !== mode) {
    const previous = p.actions[p.mode], next = p.actions[mode];
    next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1);
    next.setLoop(mode === 'sit' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity); next.clampWhenFinished = mode === 'sit'; next.play();
    if (previous) next.crossFadeFrom(previous, .2, false);
    p.mode = mode;
  }
  p.mixer.update(dt);
}

export function dogClips() {
  // Every clip owns every transform so crossfades and GLB playback use identical poses.
  const rest = { Body: [0, .48, -.07], Head: [0, .82, .31], Tail: [0, .48, -.44], Leg_0: [-.16, .3625, .23], Leg_1: [.16, .3625, .23], Leg_2: [-.16, .3625, -.31], Leg_3: [.16, .3625, -.31] };
  return ['walk', 'idle', 'sit', 'sniff'].map(mode => {
    const duration = mode === 'walk' ? .7 : 2, times = Array.from({ length: 61 }, (_, i) => duration * i / 60), tracks = [];
    for (const [name, origin] of Object.entries(rest)) {
      const positions = [], rotations = [], scales = [];
      for (const t of times) {
        const phase = t / duration * Math.PI * 2, p = [...origin], r = [0, 0, 0], scale = [1, 1, 1];
        const f = Math.min(1, t / .4), sit = mode === 'sit' ? f * f * (3 - 2 * f) : 0;
        if (name === 'Body') { p[1] -= sit * .06; r[0] = -sit * .65; }
        if (name === 'Head') { p[2] -= sit * .04; r[1] = mode === 'idle' ? Math.sin(phase) * .10 : 0; r[0] = mode === 'sniff' ? (1 - Math.cos(phase)) * .20 : sit * -.06; }
        if (name === 'Tail') { p[1] -= sit * .26; p[2] += sit * .02; r[1] = Math.sin(phase * 2) * .18; }
        if (name.startsWith('Leg_')) {
          const i = Number(name.at(-1));
          if (mode === 'walk') {
            r[0] = Math.sin(phase) * .46 * [1, -1, -1, 1][i];
            // Compensate the rigid paw's rotation so the support plane stays level.
            p[1] = .3625 * Math.cos(r[0]) + .105 * Math.abs(Math.sin(r[0]));
          }
          if (i < 2) { scale[1] += sit * .4; p[1] = mode === 'sit' ? .3625 * scale[1] : p[1]; p[2] -= sit * .01; }
          else if (mode === 'sit') {
            r[0] = -sit * Math.PI / 2;
            p[1] = .3625 * Math.cos(r[0]) + .085 * Math.abs(Math.sin(r[0]));
            p[0] *= 1 + sit * .18; p[2] -= sit * .08;
          }
        }
        positions.push(...p); rotations.push(...new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)).toArray()); scales.push(...scale);
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${name}.position`, times, positions), new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, rotations), new THREE.VectorKeyframeTrack(`${name}.scale`, times, scales));
    }
    return new THREE.AnimationClip(mode, duration, tracks);
  });
}
