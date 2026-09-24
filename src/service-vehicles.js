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
Promise.all(Object.entries(FILE).map(([kind, file]) => {
  const url = Object.entries(urls).find(([p]) => p.endsWith('/' + file + '.glb'))?.[1];
  return url ? loader.loadAsync(url).then(g => { templates[kind] = g.scene; }).catch(err => console.warn('Komachi: service vehicle not loaded', kind, err)) : null;
})).then(() => { ready = true; });
/** true once the models have loaded; the rounds and the residents' scooters wait for it */
export const serviceReady = () => ready;

const base = n => n.replace(/\.\d+$/, '');   // Blender's duplicate names: Wheel_Front.003 → Wheel_Front
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
    if (/^Wheel_/.test(n) && !o.isMesh && o.children.length) { wheels.push(o); bb.setFromObject(o); radius = (bb.max.y - bb.min.y) / 2; }
    else if ((n === 'Seat' || n === 'Saddle') && !seat) { bb.setFromObject(o); seat = { y: bb.max.y, z: (bb.min.z + bb.max.z) / 2 }; }
    else if (n === 'Grip') { o.getWorldPosition(v); if (v.x > 0) grip = [v.x, v.y, v.z]; }
    else if (n === 'Headlamp' && o.isMesh) heads.push(o);
    else if ((n === 'Rear_Lamp' || /^Tail/.test(n)) && o.isMesh) tails.push(o);
    else if (n === 'Red_Beacon' && o.isMesh) beacons.push(o);
  });
  // the lamps share one material per vehicle, so daynight.js can light them at dusk; the beacons pulse on a call
  const share = (list, emissive) => { if (!list.length) return dummyLamp(); const mat = list[0].material.clone(); mat.emissive = new THREE.Color(emissive); mat.emissiveIntensity = 0; for (const o of list) o.material = mat; return list[0]; };
  const lights = share(heads, '#ffe2a8'), tail = share(tails, '#e07060');
  if (beacons.length) share(beacons, '#ff3a2a');
  Object.assign(grp.userData, { service: kind, wheels, wheelRadius: radius, seat, grip, lights, tail, beacons });
  if (TWO_WHEELERS.has(kind)) lampLit.add(grp);
  return grp;
}
