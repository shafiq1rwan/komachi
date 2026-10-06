// Komachi — the service vehicles (assets/service-vehicles, modelled for the town at its street scale): the postal kei van, the
// ambulance, the commuter and delivery scooters, the postal motorbike and the kōban's bicycle. Loaded once at start;
// createService(kind) returns a +Z-forward group standing on y 0 with the userData the town uses: wheels (+ wheelRadius, rolled
// in sim.js moveAlong), seat { y, z } and grip [x, y, z] for a rider, lights / tail for the night, beacons (the ambulance).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const urls = import.meta.glob('../assets/service-vehicles/*.glb', { eager: true, query: '?url', import: 'default' });
const FILE = { 'postal-van': 'komachi-postal-van', ambulance: 'komachi-ambulance', scooter: 'komachi-commuter-scooter', 'delivery-scooter': 'komachi-delivery-scooter', 'postal-bike': 'komachi-postal-motorbike', 'police-bike': 'komachi-police-bicycle' };
export const SERVICE_KINDS = Object.keys(FILE);
export const TWO_WHEELERS = new Set(['scooter', 'delivery-scooter', 'postal-bike', 'police-bike']);
/** the two-wheelers out in the town: not in sim.js carMeshes, so daynight.js lights their lamps from this list (a group taken out of the scene drops off it) */
export const lampLit = new Set();
const templates = {};
let ready = false;
const loader = new GLTFLoader();
export const serviceLoaded = Promise.all(Object.entries(FILE).map(([kind, file]) => {
  const url = Object.entries(urls).find(([p]) => p.endsWith('/' + file + '.glb'))?.[1];
  return url ? loader.loadAsync(url).then(g => { templates[kind] = g.scene; }).catch(err => console.warn('Komachi: service vehicle not loaded', kind, err)) : null;
})).then(() => { ready = true; });
/** true once the models have loaded; the rounds and the residents' scooters wait for it */
export const serviceReady = () => ready;

const base = n => n.replace(/(?:\.\d+|\d{3})$/, '');   // GLTFLoader removes dots from Blender duplicate names (Grip.001 → Grip001).
const dummyLamp = () => ({ material: new THREE.MeshStandardMaterial({ emissive: '#000000' }) });
export function createService(kind) {
  const grp = new THREE.Group(), t = templates[kind];
  if (!t) return null;
  const m = t.clone(true); grp.add(m); grp.updateMatrixWorld(true);
  const wheels = [], heads = [], tails = [], beacons = [], bb = new THREE.Box3(), v = new THREE.Vector3();
  let radius = 0.05, seat = null, grip = null;
  m.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    const n = base(o.name);
    if (/^Wheel_/.test(n) && !o.isMesh && o.children.length) { wheels.push(o); bb.setFromObject(o); radius = (bb.max.y - bb.min.y) / 2; o.userData.wheelRadius = radius; }
    else if ((n === 'Seat' || n === 'Saddle') && !seat) { bb.setFromObject(o); seat = { y: bb.max.y, z: (bb.min.z + bb.max.z) / 2 }; }
    else if (n === 'Grip') { o.getWorldPosition(v); if (v.x > 0) grip = [v.x, v.y, v.z]; }
    else if (n === 'Headlamp' && o.isMesh) heads.push(o);
    else if ((n === 'Rear_Lamp' || /^Tail/.test(n)) && o.isMesh) tails.push(o);
    else if (n === 'Red_Beacon' && o.isMesh) beacons.push(o);
  });
  if (wheels.length) radius = Math.max(...wheels.map(w => w.userData.wheelRadius));
  // the lamps share one material per vehicle, so daynight.js can light them at dusk; the beacons pulse on a call
  const share = (list, emissive) => { if (!list.length) return dummyLamp(); const mat = list[0].material.clone(); mat.emissive = new THREE.Color(emissive); mat.emissiveIntensity = 0; for (const o of list) o.material = mat; return list[0]; };
  const lights = share(heads, '#ffe2a8'), tail = share(tails, '#e07060');
  if (beacons.length) share(beacons, '#ff3a2a');
  Object.assign(grp.userData, { service: kind, wheels, wheelRadius: radius, seat, grip, lights, tail, beacons });
  if (kind === 'police-bike') Object.assign(grp.userData, { pedals: true, directDrive: true });
  if (TWO_WHEELERS.has(kind)) lampLit.add(grp);
  return grp;
}

/** The resident version of the small tricycle, with owner paint and two cargo boxes. */
export function createResidentTricycle(color) {
  const grp = new THREE.Group(); grp.name = 'Komachi_Resident_Cargo_Tricycle';
  grp.userData.seat = { y: .102, z: -.02312 };
  const fill = () => {
    const trike = createService('police-bike'); if (!trike) return;
    const remove = new Set(['Police_Shield', 'Police_Shield_Stripe', 'Police_Star', 'Toy_Blue_Beacon', 'Police_Document_Case', 'Case_Lid']);
    const paint = new Set(['Low_Trike_Frame', 'Rear_Step', 'Seat_Back']);
    const discarded = [];
    trike.traverse(o => {
      const n = base(o.name);
      if (remove.has(n)) discarded.push(o);
      if (paint.has(n) && o.isMesh) { o.material = o.material.clone(); o.material.color.set(color || '#91b8ac'); }
    });
    for (const o of discarded) o.removeFromParent();
    const wood = new THREE.MeshStandardMaterial({ color: '#bc956b', roughness: .95 });
    const rim = new THREE.MeshStandardMaterial({ color: '#87684c', roughness: .95 });
    const crate = (name, x, y, z, w, h, d) => {
      const cargo = new THREE.Group(); cargo.name = name; cargo.position.set(x, y, z);
      const panel = (size, position, material = wood) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
        mesh.position.set(...position); mesh.castShadow = mesh.receiveShadow = true; cargo.add(mesh);
      };
      panel([w, .003, d], [0, -h / 2, 0]);
      for (const s of [-1, 1]) {
        panel([.003, h, d], [s * (w / 2 - .0015), 0, 0]);
        panel([w, h, .003], [0, 0, s * (d / 2 - .0015)]);
        panel([.004, .004, d], [s * (w / 2 - .0015), h / 2, 0], rim);
        panel([w, .004, .004], [0, h / 2, s * (d / 2 - .0015)], rim);
      }
      trike.add(cargo);
    };
    crate('Front_Cargo_Box', 0, .102, .060, .058, .025, .038);
    crate('Rear_Cargo_Box', 0, .064, -.057, .058, .030, .040);
    grp.add(...trike.children.slice());
    Object.assign(grp.userData, trike.userData, { service: 'resident-tricycle', residentTricycle: true });
    lampLit.delete(trike); lampLit.add(grp);
  };
  // Saved residents can arrive before the GLB: keep their parked group and fill it when ready.
  if (templates['police-bike']) fill(); else serviceLoaded.then(fill);
  return grp;
}
