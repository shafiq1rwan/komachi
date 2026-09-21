// Original town bicycle. Metres in game space, +Z forward, tyres on Y=0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export const BIKE_RADIUS = 0.07;
export const BIKE_SEAT = Object.freeze({ y: 0.17, z: -0.045 });
const TAU = Math.PI * 2;
export function createBike(color = PAL.roofTeal) {
  const root = new THREE.Group(); root.name = 'Komachi_City_Bicycle';
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const paint = (g, c) => {
    const geo = g.index ? g.toNonIndexed() : g;
    if (geo !== g) g.dispose();
    const rgb = new THREE.Color(c), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) rgb.toArray(a, i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); return geo;
  };
  const box = (out, size, p, c) => { const g = new THREE.BoxGeometry(...size); g.translate(...p); out.push(paint(g, c)); };
  const tube = (out, a, b, r, c) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const g = new THREE.CylinderGeometry(r, r, delta.length(), 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    g.translate(...start.add(end).multiplyScalar(0.5).toArray()); out.push(paint(g, c));
  };
  const ring = (out, radius, thickness, p, c, arc = TAU, width = 1) => {
    const g = new THREE.TorusGeometry(radius, thickness, 6, arc === TAU ? 24 : 12, arc);
    g.rotateY(Math.PI / 2); g.scale(width, 1, 1); g.translate(...p); out.push(paint(g, c));
  };
  const mesh = (name, parts, parent = root) => {
    const g = mergeGeometries(parts); parts.forEach(p => p.dispose());
    const m = new THREE.Mesh(g, material); m.name = name; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const f = [], metal = PAL.concrete2, rubber = PAL.kawara2;
  const crank = [0, .083, -.015], seat = [0, .155, -.045], neck = [0, .19, .088];
  // Low step-through frame, rear triangle, twin fork legs.
  tube(f, crank, seat, .006, color);
  tube(f, crank, [0, .093, .038], .0065, color); tube(f, [0, .093, .038], neck, .0065, color);
  for (const side of [-1, 1]) {
    const axle = [side * .012, .07, -.12];
    tube(f, axle, [side * .012, ...crank.slice(1)], .0035, color); tube(f, axle, seat, .0035, color);
    tube(f, [side * .012, .07, .12], [side * .012, .185, .088], .0045, color);
    tube(f, axle, [side * .024, .158, -.12], .002, metal);
  }
  tube(f, seat, [0, .17, -.045], .0035, metal);
  box(f, [.052, .013, .04], [0, .17, -.049], PAL.wood2);
  tube(f, neck, [0, .232, .08], .004, metal);
  tube(f, [-.063, .221, .015], [-.05, .24, .084], .0035, metal);
  tube(f, [-.05, .24, .084], [.05, .24, .084], .0035, metal);
  tube(f, [.05, .24, .084], [.063, .221, .015], .0035, metal);
  for (const s of [-1, 1]) tube(f, [s * .06, .224, .027], [s * .064, .22, .012], .005, PAL.wood2);
  // Bell, front lamp, rear reflector, rear luggage rack and full upper mudguards.
  box(f, [.012, .009, .012], [.034, .248, .082], PAL.cream);
  tube(f, [0, .17, .094], [0, .17, .156], .0025, metal);
  box(f, [.021, .016, .016], [0, .17, .162], metal); box(f, [.016, .011, .002], [0, .17, .171], PAL.cream2);
  box(f, [.017, .011, .004], [0, .108, -.199], PAL.roofRose);
  for (const z of [-.12, .12]) ring(f, .079, .0035, [0, .07, z], color, Math.PI, 2.5);
  for (const x of [-.024, 0, .024]) tube(f, [x, .158, -.17], [x, .158, -.073], .0025, metal);
  for (const z of [-.17, -.12, -.073]) tube(f, [-.024, .158, z], [.024, .158, z], .0025, metal);
  // Open cream basket, with a solid floor and a sparse readable wire lattice.
  box(f, [.083, .004, .064], [0, .19, .133], PAL.cream);
  for (const y of [.193, .216, .242]) {
    for (const x of [-.044, .044]) tube(f, [x, y, .098], [x, y, .168], .0018, PAL.cream);
    for (const z of [.098, .168]) tube(f, [-.044, y, z], [.044, y, z], .0018, PAL.cream);
  }
  for (const x of [-.044, -.022, 0, .022, .044]) for (const z of [.098, .168]) tube(f, [x, .19, z], [x, .242, z], .0015, PAL.cream);
  for (const x of [-.044, .044]) tube(f, [x, .19, .133], [x, .242, .133], .0015, PAL.cream);
  tube(f, [-.032, .192, .1], [-.018, .16, .095], .002, metal); tube(f, [.032, .192, .1], [.018, .16, .095], .002, metal);
  // Chain guard stays stationary while the crank turns beside it.
  box(f, [.008, .021, .108], [.019, .083, -.066], color);
  mesh('Frame', f);
  const wheels = [];
  for (const [name, z] of [['Rear_Wheel', -.12], ['Front_Wheel', .12]]) {
    const w = []; ring(w, .064, .006, [0, 0, 0], rubber); ring(w, .057, .002, [0, 0, 0], metal);
    tube(w, [-.014, 0, 0], [.014, 0, 0], .005, metal);
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8; tube(w, [0, 0, 0], [0, Math.cos(a) * .055, Math.sin(a) * .055], .0012, metal); }
    // Small spoke reflector makes rotation legible at town scale.
    box(w, [.003, .011, .006], [0, .039, 0], PAL.roofPeach);
    const wheel = mesh(name, w); wheel.position.set(0, .07, z); wheels.push(wheel);
  }
  const c = [];
  tube(c, [-.026, 0, 0], [.026, 0, 0], .0035, metal);
  for (const s of [-1, 1]) tube(c, [s * .026, 0, 0], [s * .026, 0, s * .026], .003, metal);
  const crankMesh = mesh('Crank', c); crankMesh.position.fromArray(crank);
  const pedals = [];
  for (const s of [-1, 1]) { const p = []; box(p, [.024, .006, .015], [0, 0, 0], rubber); const pedal = mesh(s < 0 ? 'Left_Pedal' : 'Right_Pedal', p, crankMesh); pedal.position.set(s * .035, 0, s * .026); pedals.push(pedal); }
  root.bikeParts = { wheels, crank: crankMesh, pedals, phase: 0 };
  root.userData.seat = { ...BIKE_SEAT }; root.userData.wheelRadius = BIKE_RADIUS;
  return root;
}

/** Wheel travel follows real distance, independent of frame rate and simulation speed. */
export function rollBike(root, distance) {
  const p = root.bikeParts; if (!p || !Number.isFinite(distance)) return;
  p.phase = (p.phase + distance / BIKE_RADIUS) % (TAU * 2);
  for (const w of p.wheels) w.rotation.x = p.phase;
  p.crank.rotation.x = p.phase / 2;
  for (const pedal of p.pedals) pedal.rotation.x = -p.crank.rotation.x;
}

const aim = new THREE.Vector3(), hand = new THREE.Vector3();
/** The Kenney rig has rigid limbs: aim hands at grips and swing legs with the crank. */
export function poseBikeRider(rider, bike) {
  const phase = bike.bikeParts?.crank.rotation.x || 0;
  rider.updateWorldMatrix(true, true); bike.updateWorldMatrix(true, true);
  for (const [side, s] of [['left', 1], ['right', -1]]) {
    const arm = rider.getObjectByName(`arm-${side}`), leg = rider.getObjectByName(`leg-${side}`);
    if (arm) {
      aim.set(s * .064, .22, .018); bike.localToWorld(aim); arm.parent.worldToLocal(aim); aim.sub(arm.position).normalize();
      hand.set(s * .145, -.01, .03).normalize(); arm.quaternion.setFromUnitVectors(hand, aim);
    }
    if (leg) leg.rotation.set(-.28 + s * .24 * Math.sin(phase), 0, s * -.05);
  }
}

/** Two wheel revolutions and one crank revolution; pedals stay level. */
export function bikeClips() {
  const times = Array.from({ length: 49 }, (_, i) => i / 24), tracks = [];
  for (const [name, turns] of [['Rear_Wheel', 2], ['Front_Wheel', 2], ['Crank', 1], ['Left_Pedal', -1], ['Right_Pedal', -1]]) {
    const values = times.flatMap(t => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), t / 2 * TAU * turns).toArray());
    tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values));
  }
  return [new THREE.AnimationClip('cycle', 2, tracks)];
}
