// Standalone work vehicles. Game units, +Z forward, Y=0 at tyre contact.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL as P } from './palette.js';

export const TRUCK_KINDS = ['kei-farm', 'builder', 'fish-van'];
export function createTruck(kind) {
  if (!TRUCK_KINDS.includes(kind)) throw new Error(`Unknown truck: ${kind}`);
  const root = new THREE.Group(); root.name = `Komachi_${kind.replaceAll('-', '_')}`;
  const paint = kind === 'builder' ? P.roofPeach : kind === 'kei-farm' ? P.mint : P.cream2;
  root.userData = { kind, front: '+Z', units: 'game', wheelRadius: .052, wheelAxis: 'X',
    cargoMeshes: kind === 'kei-farm' ? ['Cargo_Crates'] : kind === 'builder' ? ['Cargo_Timber'] : [],
    doorPoint: [-.16, 0, .18], paintMesh: 'Body_Paint' };
  const matte = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true });
  let parts = [];
  function add(input, tint) {
    const g = input.index ? input.toNonIndexed() : input;
    if (input !== g) input.dispose(); g.deleteAttribute('uv');
    const c = new THREE.Color(tint), a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) c.toArray(a, i);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(g);
  }
  function box(w, h, d, x, y, z, c = P.kawara2, rx = 0) {
    const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.translate(x, y, z); add(g, c);
  }
  function rod(a, b, r, c = P.kawara2, n = 8) {
    const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b), delta = q.clone().sub(p);
    const g = new THREE.CylinderGeometry(r, r, delta.length(), n);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    g.translate(...p.add(q).multiplyScalar(.5).toArray()); add(g, c);
  }
  function finish(name, pivot = [0, 0, 0], material = matte) {
    const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); parts = [];
    g.translate(-pivot[0], -pivot[1], -pivot[2]);
    const m = new THREE.Mesh(g, material); m.name = name; m.position.fromArray(pivot);
    m.castShadow = m.receiveShadow = true; root.add(m); return m;
  }
  // Cab-over silhouette, short nose and large upright glass.
  box(.262, .11, .229, 0, .16, .1725, paint);
  box(.255, .109, .187, 0, .2695, .158, paint);
  box(.270, .018, .210, 0, .329, .16, paint);
  for (const x of [-.123, .123]) box(.016, .12, .019, x, .27, .254, paint);
  if (kind !== 'fish-van') {
    box(.27, .026, .341, 0, .128, -.1205, paint);
    for (const x of [-.128, .128]) box(.014, .080, .345, x, .176, -.1225, paint);
    box(.27, .080, .014, 0, .176, -.295, paint);
    box(.27, .095, .014, 0, .1835, .043, paint);
  }
  const paintMaterial = new THREE.MeshStandardMaterial({ color: paint, roughness: .95, flatShading: true });
  finish('Body_Paint', [0, 0, 0], paintMaterial).geometry.deleteAttribute('color');
  // Omit COLOR_0 on paint so GLB loaders preserve direct material recolouring.
  box(.235, .099, .008, 0, .271, .257, P.sky2);
  box(.009, .1, .011, 0, .271, .263, P.cream2);
  for (const x of [-.130, .130]) {
    box(.006, .082, .146, x, .275, .155, P.sky2);
    box(.007, .092, .010, x, .273, .18, P.cream2);
    box(.009, .009, .026, x, .204, .095, P.kawara2);
    box(.006, .052, .002, x, .184, .071, P.concrete2);
    rod([x, .267, .231], [Math.sign(x) * .15, .273, .251], .0035);
    box(.012, .030, .021, Math.sign(x) * .150, .274, .255, P.kawara2);
  }
  box(.17, .069, .007, 0, .276, .060, P.sky2);
  for (const x of [-.063, .063]) rod([x - .018, .230, .266], [x + .035, .242, .266], .0025);
  box(.258, .023, .54, 0, .09, -.006, P.kawara2);
  box(.279, .025, .020, 0, .103, .295, P.concrete2);
  box(.279, .026, .020, 0, .094, -.305, P.concrete2);
  box(.13, .029, .009, 0, .151, .290, P.kawara2);
  for (const y of [.143, .152, .161]) box(.118, .003, .004, 0, y, .296, P.lamp);
  box(.060, .022, .008, 0, .105, .309, P.cream2);
  box(.059, .022, .006, 0, .102, -.318, P.cream2);
  for (const x of [-.093, .093]) {
    box(.064, .043, .011, x, .171, .291, P.kawara2);
    box(.050, .039, .011, x, .124, -.303, P.kawara2);
  }
  for (const x of [-.125, .125]) for (const z of [-.20, .178]) box(.015, .035, .088, x, .118, z, P.kawara2);
  if (kind !== 'fish-van') {
    box(.235, .006, .31, 0, .145, -.122, P.concrete2);
    for (let x = -.09; x <= .091; x += .03) box(.008, .003, .30, x, .149, -.123, P.lamp);
    for (const x of [-.12, .12]) {
      box(.013, .008, .35, x, .219, -.123, P.concrete2);
      for (const z of [-.235, -.05]) box(.005, .023, .018, Math.sign(x) * .138, .17, z, P.lamp);
    }
    for (const x of [-.075, .075]) box(.032, .013, .006, x, .145, -.305, P.lamp);
  }
  finish('Trim_Glass_And_Chassis');
  // Separate materials ensure lights can be changed independently after loading.
  for (const x of [-.093, .093]) box(.052, .029, .009, x, .174, .300, P.lampGlow);
  finish('Headlights', [0, 0, 0], matte.clone());
  for (const x of [-.093, .093]) box(.038, .026, .009, x, .127, -.313, P.roofRose);
  finish('Taillights', [0, 0, 0], matte.clone());
  for (const side of [-1, 1]) for (const [axle, z] of [['Front', .178], ['Rear', -.20]]) {
    const x = side * .132;
    rod([x - .015, .052, z], [x + .015, .052, z], .052, P.kawara2, 12);
    rod([x + side * .015, .052, z], [x + side * .017, .052, z], .030, P.lamp, 12);
    rod([x + side * .017, .052, z], [x + side * .019, .052, z], .013, P.kawara, 8);
    finish(`Wheel_${side < 0 ? 'Left' : 'Right'}_${axle}`, [x, .052, z]);
  }
  if (kind === 'kei-farm') {
    for (const x of [-.060, .060]) for (const z of [-.219, -.088]) {
      box(.103, .009, .106, x, .157, z, P.wood2);
      for (const dx of [-.050, .050]) for (const dz of [-.051, .051]) box(.01, .072, .010, x + dx, .193, z + dz, P.wood2);
      for (const y of [.172, .194, .218]) {
        for (const dx of [-.049, .049]) box(.008, .014, .109, x + dx, y, z, P.wood);
        for (const dz of [-.05, .05]) box(.103, .014, .008, x, y, z + dz, P.wood);
      }
      for (let i = 0; i < 4; i++) {
        const g = new THREE.DodecahedronGeometry(.022); g.scale(1, .8, 1);
        g.translate(x + (i % 2 ? .024 : -.024), .208, z + (i > 1 ? .023 : -.023)); add(g, z < -.15 ? P.bush : P.treeOrange);
      }
    }
    finish('Cargo_Crates'); root.userData.cargoPoint = [0, .15, -.15];
  } else if (kind === 'builder') {
    // Folded hydraulic knuckle boom just behind the cab; a single swivel-ready mesh.
    box(.22, .026, .067, 0, .162, .018, P.kawara2);
    for (const x of [-.11, .11]) box(.022, .077, .040, x, .147, .018, P.lamp);
    finish('Crane_Base_And_Stowed_Outriggers');
    const pivot = [.068, .177, .018];
    rod([.068, .177, .018], [.068, .272, .018], .025, P.roofPeach, 10);
    rod([.068, .255, .018], [-.080, .365, .018], .018, P.roofPeach, 6);
    rod([-.080, .365, .018], [-.055, .24, -.19], .014, P.roofPeach, 6);
    rod([.062, .234, .040], [-.064, .322, .040], .008, P.kawara2);
    rod([-.064, .322, .040], [-.077, .348, .040], .005, P.lamp);
    for (const [x, y, z] of [[.068, .255, .018], [-.080, .365, .018]]) rod([x, y, z - .025], [x, y, z + .025], .014, P.kawara2);
    rod([-.055, .24, -.19], [-.055, .209, -.19], .003, P.kawara2);
    const hook = new THREE.TorusGeometry(.011, .003, 5, 10, Math.PI * 1.5); hook.translate(-.05, .204, -.19); add(hook, P.kawara2);
    finish('Crane_Arm', pivot).userData = { swivelAxis: 'Y', pose: 'folded', articulated: false };
    for (let row = 0; row < 2; row++) for (const x of [-.060, -.018, .024, .066]) box(.035, .023, .245, x, .165 + row * .024, -.168, row ? P.raw : P.wood);
    for (const z of [-.244, -.097]) {
      box(.17, .005, .009, .004, .204, z, P.indigo);
      for (const x of [-.081, .089]) box(.006, .055, .009, x, .178, z, P.indigo);
    }
    finish('Cargo_Timber'); root.userData.cranePivot = pivot; root.userData.cargoPoint = [0, .15, -.17];
  } else {
    // Insulated box and cooling pack remain white when the cab is recoloured.
    box(.272, .247, .358, 0, .2645, -.117, P.cream2);
    box(.280, .016, .365, 0, .396, -.117, P.cream2);
    for (const x of [-.139, .139]) {
      box(.007, .037, .342, x, .251, -.118, P.roofBlue);
      for (const z of [-.294, .06]) box(.009, .247, .009, x, .265, z, P.concrete2);
      box(.009, .014, .356, x, .145, -.117, P.concrete2);
    }
    box(.25, .221, .011, 0, .265, -.302, P.cream2);
    box(.253, .033, .007, 0, .251, -.311, P.roofBlue);
    box(.006, .222, .007, 0, .265, -.313, P.concrete2);
    for (const x of [-.065, .065]) {
      rod([x, .17, -.32], [x, .36, -.32], .0035, P.lamp);
      box(.020, .006, .009, x, .224, -.323, P.kawara2);
      for (const y of [.19, .34]) box(.019, .009, .009, Math.sign(x) * .12, y, -.313, P.lamp);
    }
    finish('Refrigerated_Box');
    box(.166, .074, .094, 0, .376, .096, P.cream2);
    box(.128, .047, .008, 0, .378, .147, P.kawara2);
    for (let y = .361; y <= .397; y += .009) box(.12, .003, .006, 0, y, .153, P.lamp);
    for (const x of [-.063, .063]) box(.009, .012, .064, x, .414, .096, P.concrete2);
    finish('Refrigeration_Unit');
  }
  return root;
}
