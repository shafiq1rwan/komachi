// Komachi — renderer, orthographic 3/4 camera, lights and the island the town sits on
import * as THREE from 'three';
import { PAL } from './palette.js';
import { rand } from './utils.js';
import { S } from './state.js';
import { mat, blob, mergeMesh, glowGeo } from './geometry.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PAL.skyDay, 118, 200);   // camera sits ~120 units out, so this is a gentle depth tint

const N = 34;                       // grid size (cells)
const HALF = N / 2;
const cx = i => i - HALF + 0.5, cz = j => j - HALF + 0.5;   // cell index -> world center

const cam = { target: new THREE.Vector3(0, 0, 0), yaw: Math.PI / 4, pitch: THREE.MathUtils.degToRad(38), view: 18, tView: 18, tYaw: Math.PI / 4 };
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
function updateCamera() {
  const aspect = innerWidth / innerHeight; const v = cam.view;
  camera.left = -v * aspect / 2; camera.right = v * aspect / 2; camera.top = v / 2; camera.bottom = -v / 2; camera.updateProjectionMatrix();
  const dist = 120;
  const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
  camera.position.copy(cam.target).addScaledVector(dir, dist); camera.lookAt(cam.target);
}

function resize() {
  const scale = S.pixelLook ? 0.5 : Math.min(devicePixelRatio, 2);
  renderer.setPixelRatio(1); renderer.setSize(Math.max(320, Math.floor(innerWidth * scale)), Math.max(200, Math.floor(innerHeight * scale)), false);
  updateCamera();
}
addEventListener('resize', resize);

// lights
const hemi = new THREE.HemisphereLight('#dff1ea', '#e9d5b8', 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1dc', 1.6); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.near = 20; sun.shadow.camera.far = 220;
sun.shadow.camera.left = -HALF - 4; sun.shadow.camera.right = HALF + 4; sun.shadow.camera.top = HALF + 4; sun.shadow.camera.bottom = -HALF - 4;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; sun.shadow.radius = 4; sun.shadow.camera.updateProjectionMatrix();
scene.add(sun); scene.add(sun.target);
const fill = new THREE.DirectionalLight('#cfe3f5', 0.35); fill.position.set(-30, 20, -40); scene.add(fill);

// ───────────────────────────── environment: island & water ─────────────────────────────
function roundedRect(w, h, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
{
  const land = new THREE.Mesh(
    new THREE.ExtrudeGeometry(roundedRect(N + 3.2, N + 3.2, 5), { depth: 1.4, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 2, curveSegments: 10 }),
    [mat(PAL.grass), mat(PAL.landSide)]);
  land.rotation.x = Math.PI / 2; land.position.y = 0.0; land.receiveShadow = true; land.castShadow = false; scene.add(land);
  // shift so top face sits at y=0 (extrude goes +z which after rotation is -y)
  land.position.y = 0.0; land.geometry.translate(0, 0, 0); land.updateMatrixWorld();
  // bevel pushes top up by bevelThickness; compensate
  land.position.y = -0.25;
  const foam = new THREE.Mesh(new THREE.ExtrudeGeometry(roundedRect(N + 5.6, N + 5.6, 6.2), { depth: 0.12, bevelEnabled: false, curveSegments: 10 }), mat(PAL.foam));
  foam.rotation.x = Math.PI / 2; foam.position.y = -1.42; scene.add(foam);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: PAL.water, roughness: 1 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -1.6; water.receiveShadow = true; scene.add(water);
  // a few pebbles in the water
  const peb = []; for (let k = 0; k < 9; k++) { const a = rand(0, 6.28), rr = HALF + rand(3.5, 6.5); peb.push(blob(rand(0.35, 0.7), PAL.concrete, Math.cos(a) * rr, -1.55, Math.sin(a) * rr, 0, 0.6)); }
  scene.add(mergeMesh(peb, true));
}

// scene graph roots for things that change at runtime
const townGroup = new THREE.Group(); scene.add(townGroup);       // building unit groups + vegetation
const peopleGroup = new THREE.Group(); scene.add(peopleGroup);   // walkers, cars, cats
function disposeGroup(g) { g.traverse(o => { if (o.geometry && o.geometry !== glowGeo) o.geometry.dispose(); }); }

export { canvas, renderer, scene, N, HALF, cx, cz, cam, camera, updateCamera, resize, hemi, sun, fill, townGroup, peopleGroup, disposeGroup };
