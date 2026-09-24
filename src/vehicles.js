// Komachi — vehicles from Kenney's Car Kit (CC0, assets/vehicle/). Each model is loaded once, its colour atlas
// baked into vertex colours, and the bodywork's paint colour found; every car built gets a copy with the paint
// repainted to its owner's colour (shading kept). The original box cars remain the fallback while the models
// load and for any kind without a model.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PAL } from './palette.js';
import { box, colorize, mergeMesh } from './geometry.js';
import { createTruck, TRUCK_KINDS } from './work-trucks-kit.js';
import { createService, SERVICE_KINDS, TWO_WHEELERS } from './service-vehicles.js';

const SCALE = 0.2;                 // a sedan is 2.55 long in the kit; 0.51 here, about 0.26 wide in a 0.34 lane (people are 0.26 tall)
const TRUCK_K = 0.85;               // the work-truck kit is built at the old street scale
const MODEL = { kei: 'sedan', hatch: 'hatchback-sports', suv: 'suv', van: 'van', truck: 'truck-flat', taxi: 'taxi', garbage: 'garbage-truck', delivery: 'delivery' };
const NO_REPAINT = new Set(['taxi']);   // keeps its own livery
const urls = import.meta.glob('../assets/vehicle/{sedan,hatchback-sports,suv,van,truck-flat,taxi,garbage-truck,delivery}.glb', { eager: true, query: '?url', import: 'default' });
import colormapUrl from '../assets/vehicle/Textures/colormap.png?url';
const manager = new THREE.LoadingManager(); manager.setURLModifier(url => /colormap\.png$/i.test(url) ? colormapUrl : url);

const models = new Map();           // name → { root, paint: Set<mesh name>, medL, lightsZ: [front, back] }
const pending = [];                 // box cars waiting for their model
const carMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 });
const hsl = { h: 0, s: 0, l: 0 }, tmp = new THREE.Color(), target = new THREE.Color(), tHsl = { h: 0, s: 0, l: 0 };

function atlasPixels(texture) {
  const img = texture.image; const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); return { w: c.width, h: c.height, data: g.getImageData(0, 0, c.width, c.height).data };
}
/** bake the atlas into COLOR (non-indexed so every face keeps its flat colour) and drop the UVs */
function bake(mesh, px) {
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const uv = g.attributes.uv, n = g.attributes.position.count, col = new Float32Array(n * 3), keys = new Uint32Array(n), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = Math.min(px.w - 1, Math.floor(uv.getX(i) * px.w)), y = Math.min(px.h - 1, Math.floor(uv.getY(i) * px.h)), o = (y * px.w + x) * 4;
    keys[i] = (px.data[o] << 16) | (px.data[o + 1] << 8) | px.data[o + 2];
    c.setRGB(px.data[o] / 255, px.data[o + 1] / 255, px.data[o + 2] / 255).convertSRGBToLinear();
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv'); g.deleteAttribute('uv1'); g.deleteAttribute('tangent');
  return { geometry: g, keys };
}
/** the paint is the most common colour on the body that is neither glass (very light) nor trim (very dark) */
function findPaint(keys, geometry) {
  const count = new Map(); const col = geometry.attributes.color, c = new THREE.Color();
  for (let i = 0; i < keys.length; i++) {
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i)); c.getHSL(hsl); if (hsl.l > 0.78 || hsl.l < 0.22) continue;
    count.set(keys[i], (count.get(keys[i]) || 0) + 1);
  }
  let best = null, bn = 0; for (const [k, n] of count) if (n > bn) { bn = n; best = k; }
  return best;
}
async function loadModel(name, url) {
  const gltf = await new GLTFLoader(manager).loadAsync(url);
  let px = null; const root = new THREE.Group(); const paint = new Set(); let medL = 0.5;
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    if (!px) px = atlasPixels(o.material.map);
    const { geometry, keys } = bake(o, px); geometry.applyMatrix4(o.matrixWorld);   // flatten the node transforms
    const m = new THREE.Mesh(geometry, carMat); m.name = o.name; m.castShadow = true; m.userData.keys = keys; root.add(m);
    if (o.name === 'body') {
      const key = findPaint(keys, geometry); if (key !== null) { const ls = []; const col = geometry.attributes.color; for (let i = 0; i < keys.length; i++) if (keys[i] === key) { tmp.setRGB(col.getX(i), col.getY(i), col.getZ(i)); tmp.getHSL(hsl); ls.push(hsl.l); } ls.sort((a, b) => a - b); medL = ls[Math.floor(ls.length / 2)] || 0.5; paint.add(key); }
    }
  });
  const bb = new THREE.Box3().setFromObject(root);
  models.set(name, { root, paint, medL, lightsZ: [bb.max.z, bb.min.z], height: bb.max.y });
}
export const vehiclesReady = Promise.all(Object.entries(urls).map(([path, url]) => { const name = path.match(/\/([^/]+)\.glb$/)[1]; return loadModel(name, url).catch(err => console.warn('Komachi: vehicle skipped', name, err)); }))
  .then(() => { for (const p of pending) { for (const c of p.grp.children.slice()) p.grp.remove(c); attachVehicle(p.grp, p.color, p.kind); } pending.length = 0; });

/** a copy of a model with the bodywork repainted */
function instance(model, color, repaint) {
  const root = new THREE.Group(); root.scale.setScalar(SCALE);
  target.set(color); target.getHSL(tHsl);
  for (const m of model.root.children) {
    let geo = m.geometry;
    if (repaint && m.name === 'body' && model.paint.size) {
      geo = geo.clone(); const col = geo.getAttribute('color'), arr = col.array, keys = m.userData.keys;
      for (let i = 0; i < keys.length; i++) { if (!model.paint.has(keys[i])) continue; tmp.setRGB(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]); tmp.getHSL(hsl); const l = Math.min(0.92, Math.max(0.08, tHsl.l * (hsl.l / model.medL))); tmp.setHSL(tHsl.h, tHsl.s, l); arr[i * 3] = tmp.r; arr[i * 3 + 1] = tmp.g; arr[i * 3 + 2] = tmp.b; }
      col.needsUpdate = true;
    }
    const mesh = new THREE.Mesh(geo, carMat); mesh.castShadow = true; root.add(mesh);
  }
  return root;
}
const lightMat = () => new THREE.MeshStandardMaterial({ color: '#fff6dd', emissive: '#ffe2a8', emissiveIntensity: 0 });
const tailMat = () => new THREE.MeshStandardMaterial({ color: '#d98b7a', emissive: '#e07060', emissiveIntensity: 0 });

/** the original box cars: model faces +x inside an inner group turned to face +z */
function boxCar(grp, color, kind) {
  const g = []; const dark = '#4a4340', glass = '#d8e3e8';
  if (kind === 'van') { g.push(box(0.52, 0.3, 0.28, color, 0, 0.21, 0)); g.push(box(0.12, 0.12, 0.24, glass, 0.2, 0.28, 0)); g.push(box(0.26, 0.1, 0.29, glass, -0.08, 0.28, 0)); g.push(box(0.3, 0.04, 0.3, PAL.cream2, -0.06, 0.37, 0)); }
  else if (kind === 'truck' || kind === 'garbage' || kind === 'delivery') { g.push(box(0.16, 0.26, 0.26, color, 0.16, 0.2, 0)); g.push(box(0.1, 0.12, 0.22, glass, 0.21, 0.27, 0)); g.push(box(0.3, 0.06, 0.28, color, -0.09, 0.14, 0)); for (const zz of [-0.13, 0.13]) g.push(box(0.3, 0.08, 0.02, color, -0.09, 0.2, zz)); g.push(box(0.02, 0.08, 0.28, color, -0.23, 0.2, 0)); }
  else if (kind === 'taxi') { g.push(box(0.5, 0.15, 0.28, '#e8cf7a', 0, 0.135, 0)); g.push(box(0.28, 0.13, 0.24, '#e8cf7a', -0.02, 0.27, 0)); g.push(box(0.29, 0.09, 0.22, glass, -0.02, 0.27, 0)); g.push(box(0.08, 0.04, 0.12, PAL.roofRose, -0.02, 0.355, 0)); }
  else if (kind === 'hatch' || kind === 'suv') { g.push(box(0.5, 0.16, 0.28, color, 0, 0.14, 0)); g.push(box(0.28, 0.14, 0.24, color, -0.02, 0.29, 0)); g.push(box(0.29, 0.1, 0.22, glass, -0.02, 0.29, 0)); }
  else { g.push(box(0.42, 0.16, 0.27, color, 0, 0.14, 0)); g.push(box(0.32, 0.16, 0.25, color, -0.03, 0.3, 0)); g.push(box(0.33, 0.1, 0.23, glass, -0.03, 0.31, 0)); g.push(box(0.04, 0.03, 0.2, dark, -0.2, 0.2, 0)); }
  const wheelX = kind === 'kei' ? 0.13 : 0.16;
  for (const [x, z] of [[-wheelX, -0.13], [wheelX, -0.13], [-wheelX, 0.13], [wheelX, 0.13]]) { const wgm = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8); wgm.rotateX(Math.PI / 2); wgm.translate(x, 0.07, z); g.push(colorize(wgm, dark)); }
  const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2; inner.scale.setScalar(1.05); grp.add(inner);
  inner.add(mergeMesh(g, false));
  const front = kind === 'kei' ? 0.21 : 0.25;
  const lights = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.24), lightMat()); lights.position.set(front, 0.13, 0); inner.add(lights); grp.userData.lights = lights;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.22), tailMat()); tail.position.set(-front, 0.13, 0); inner.add(tail); grp.userData.tail = tail;
}

/** fill a car group (forward = +z) with the kit model for `kind`, or a box car until the model has loaded */
export function attachVehicle(grp, color, kind = 'kei') {
  if (SERVICE_KINDS.includes(kind) && !TWO_WHEELERS.has(kind)) {   // the postal kei van and the ambulance (src/service-vehicles.js), at street scale already
    const s = createService(kind);
    if (s) { for (const c of s.children.slice()) grp.add(c); Object.assign(grp.userData, s.userData); return; }
    kind = 'van';   // not loaded yet: a plain van stands in
  }
  if (TRUCK_KINDS.includes(kind)) {   // the Komachi work trucks (src/work-trucks-kit.js): keitora, crane flatbed, fish van
    const t = createTruck(kind); t.scale.setScalar(TRUCK_K); t.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); grp.add(t);
    const lights = t.getObjectByName('Headlights'), tail = t.getObjectByName('Taillights');
    lights.material.emissive = new THREE.Color('#ffe2a8'); lights.material.emissiveIntensity = 0; tail.material.emissive = new THREE.Color('#e07060'); tail.material.emissiveIntensity = 0;
    grp.userData.lights = lights; grp.userData.tail = tail; grp.userData.truck = t;
    grp.userData.wheels = ['Wheel_Left_Front', 'Wheel_Right_Front', 'Wheel_Left_Rear', 'Wheel_Right_Rear'].map(n => t.getObjectByName(n)).filter(Boolean);
    grp.userData.wheelRadius = t.userData.wheelRadius * TRUCK_K;
    grp.userData.cargo = t.userData.cargoMeshes.map(n => t.getObjectByName(n)).filter(Boolean);
    grp.userData.crane = t.getObjectByName('Crane_Arm') || null;
    return;
  }
  const model = models.get(MODEL[kind] || 'sedan');
  if (!model) { boxCar(grp, color, kind); if (!models.size) pending.push({ grp, color, kind }); return; }
  const root = instance(model, color, !NO_REPAINT.has(kind)); grp.add(root);
  const [fz, bz] = model.lightsZ;
  const lights = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.04, 0.025), lightMat()); lights.position.set(0, 0.12, fz * SCALE + 0.004); grp.add(lights); grp.userData.lights = lights;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.034, 0.02), tailMat()); tail.position.set(0, 0.12, bz * SCALE - 0.004); grp.add(tail); grp.userData.tail = tail;
}
export const vehiclesAvailable = () => models.size > 0;
