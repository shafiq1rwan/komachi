// Komachi — procedural geometry helpers: vertex-coloured primitives merged into few draw calls
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

const matCache = new Map();
function mat(hex, flat = false) {
  const key = hex + (flat ? 'f' : '');
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color: hex, roughness: 0.95, metalness: 0, flatShading: flat }));
  return matCache.get(key);
}
const vcMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
const vcMatFlat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true });
function colorize(geom, hex) {
  const c = new THREE.Color(hex); const n = geom.attributes.position.count; const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geom.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return geom;
}
function box(w, h, d, hex, x = 0, y = 0, z = 0, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d); if (ry) g.rotateY(ry); g.translate(x, y, z); return colorize(g, hex);
}
function prism(w, h, d, hex, x = 0, y = 0, z = 0, ry = 0) {
  // triangular prism: ridge along x, base width d (z), height h
  const hw = w / 2, hd = d / 2;
  const v = [
    // front tri (z+)
    -hw, 0, hd,  hw, 0, hd,  hw, h, 0,   -hw, 0, hd,  hw, h, 0,  -hw, h, 0,
    // back tri (z-)
    hw, 0, -hd,  -hw, 0, -hd,  -hw, h, 0,   hw, 0, -hd,  -hw, h, 0,  hw, h, 0,
    // left end
    -hw, 0, -hd,  -hw, 0, hd,  -hw, h, 0,
    // right end
    hw, 0, hd,  hw, 0, -hd,  hw, h, 0,
    // bottom
    -hw, 0, -hd,  hw, 0, -hd,  hw, 0, hd,   -hw, 0, -hd,  hw, 0, hd,  -hw, 0, hd,
  ];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((v.length / 3) * 2), 2));
  g.computeVertexNormals(); if (ry) g.rotateY(ry); g.translate(x, y, z); return colorize(g, hex);
}
function blob(r, hex, x = 0, y = 0, z = 0, detail = 0, squash = 1) {
  const g = new THREE.DodecahedronGeometry(r, detail); g.scale(1, squash, 1); g.rotateY((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 6.28); g.translate(x, y, z); return colorize(g, hex);
}
function cyl(rt, rb, h, hex, x = 0, y = 0, z = 0, seg = 6) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(x, y, z); return colorize(g, hex);
}
function mergeMesh(geoms, flat = false, shadows = true) {
  if (!geoms.length) return null;
  const plain = geoms.map(x => { if (!x.index) return x; const n = x.toNonIndexed(); x.dispose(); return n; });
  const g = mergeGeometries(plain, false); plain.forEach(x => x.dispose());
  if (!g) return null;
  const m = new THREE.Mesh(g, flat ? vcMatFlat : vcMat); m.castShadow = shadows; m.receiveShadow = true; return m;
}

// soft radial glow texture (for lamps / windows at night)
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64); grd.addColorStop(0, 'rgba(255,200,130,0.85)'); grd.addColorStop(0.4, 'rgba(255,190,120,0.35)'); grd.addColorStop(1, 'rgba(255,180,110,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
const glowGeo = new THREE.PlaneGeometry(1, 1);
function makeGlow(x, y, z, size) { const m = new THREE.Mesh(glowGeo, glowMat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.scale.setScalar(size); m.renderOrder = 5; return m; }
const lampHeadMat = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: PAL.lampGlow, emissiveIntensity: 0, roughness: 0.6 });

export { mat, vcMat, vcMatFlat, colorize, box, prism, blob, cyl, mergeMesh, glowTex, glowMat, glowGeo, makeGlow, lampHeadMat };
