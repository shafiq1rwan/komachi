// Komachi — procedural geometry helpers: vertex-coloured primitives merged into few draw calls
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';
import { S } from './state.js';

// snow: one shared amount (0 bare, 1 deep winter) whitens upward faces in every town material; darker surfaces (asphalt) take less
const snowUniform = { value: 0 };
const lookUniform = { value: 0 };   // 1 in the rich look (look.js): a gentle patchy tone on upward faces, like mown grass and weathered roofs
const shaderColor = hex => { const c = new THREE.Color(hex); return `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`; };
const richRoadColor = shaderColor(PAL.asphalt), richRoadColor2 = shaderColor(PAL.asphalt2), richWalkColor = shaderColor(PAL.sidewalk);
function setSnow(v) { snowUniform.value = v; }
function withSnow(material, floor = 0.35) {   // floor: the share of snow even the darkest surface takes (asphalt stays dark at 0.35)
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = sh => {
    if (prev) prev(sh);
    sh.uniforms.uSnow = snowUniform; sh.uniforms.uLook = lookUniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
varying vec3 vLookPos;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
 vLookPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uSnow; uniform float uLook; varying vec3 vLookPos;
float lookN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.55), b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.55);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.55), d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.55);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }`)
      .replace('#include <normal_fragment_begin>', `#include <normal_fragment_begin>
 float snowUp = smoothstep(0.45, 0.85, dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)));
 float richRoad = max(1.0 - smoothstep(0.006, 0.035, distance(diffuseColor.rgb, ${richRoadColor})), 1.0 - smoothstep(0.006, 0.035, distance(diffuseColor.rgb, ${richRoadColor2})));
 float richWalk = 1.0 - smoothstep(0.006, 0.035, distance(diffuseColor.rgb, ${richWalkColor}));
 diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.105, 0.126, 0.145), richRoad * uLook);
 diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.57, 0.57, 0.53), richWalk * uLook);
 float foliage = smoothstep(0.015, 0.075, diffuseColor.g - max(diffuseColor.r, diffuseColor.b)) * (1.0 - richRoad);
 diffuseColor.rgb *= mix(vec3(1.0), vec3(0.82, 0.86, 0.80), foliage * uLook * 0.65);
 if (uLook > 0.0) { float n = lookN(vLookPos.xz * 0.45) * 0.65 + lookN(vLookPos.xz * 1.7) * 0.35; diffuseColor.rgb *= 1.0 + (n - 0.5) * 0.22 * uLook * snowUp; }
 float snowLum = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
 diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.975), uSnow * snowUp * (${floor.toFixed(2)} + ${(1 - floor).toFixed(2)} * smoothstep(0.15, 0.5, snowLum)));`);
  };
  material.customProgramCacheKey = () => 'snow2' + (floor === 0.35 ? '' : floor) + (prev ? '+' : '');
  return material;
}
// kit Groups (civic, town services, landmarks, the station pavilion) bring their own materials: snow them in place, once each
// (kits share materials between instances); `skip` keeps lit panels clear
const SNOWABLE = new Set(['MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial']);
function snowKit(root, skip = null) {
  root.traverse(o => {
    if (!o.isMesh || (skip && skip.includes(o))) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m && !m.userData.snow && SNOWABLE.has(m.type)) { m.userData.snow = true; withSnow(m, 0.85); m.needsUpdate = true; }   // kit roofs are dark greys; they still whiten
  });
  return root;
}
const matCache = new Map();
function mat(hex, flat = false) {
  const key = hex + (flat ? 'f' : '');
  if (!matCache.has(key)) matCache.set(key, withSnow(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.95, metalness: 0, flatShading: flat })));
  return matCache.get(key);
}
const vcMat = withSnow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
const vcMatFlat = withSnow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: true }));
// vegetation material: vertices above knee height sway gently in the wind (merged geometry is in world space)
const swayUniform = { value: 0 };
const swayMat = vcMatFlat.clone();
swayMat.onBeforeCompile = sh => {
  vcMatFlat.onBeforeCompile(sh);   // snow on the crowns too
  sh.uniforms.uTime = swayUniform;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>
uniform float uTime;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
 float swayH = max(0.0, transformed.y - 0.28);
 float gust = 0.55 + 0.45 * sin(uTime * 0.37 + transformed.x * 0.06 + transformed.z * 0.04);
 transformed.x += (sin(uTime * 1.5 + transformed.z * 0.6 + transformed.x * 0.4) * 0.07 + 0.03) * swayH * gust;
 transformed.z += cos(uTime * 1.15 + transformed.x * 0.5) * 0.045 * swayH * gust;`);
};
swayMat.customProgramCacheKey = () => 'snow2+sway';
function setSwayTime(t) { swayUniform.value = t; }
function colorize(geom, hex) {
  if (S.look === 'rich') {
    if (hex === PAL.asphalt || hex === PAL.asphalt2) hex = '#6d7376';
    else if (hex === PAL.sidewalk) hex = '#c8c7be';
    else if (['#c8d7ad', '#cddbb3', '#c2d4a9'].includes(hex)) hex = '#9db68a';
  }
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
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64); grd.addColorStop(0, 'rgba(255,196,120,0.6)'); grd.addColorStop(0.35, 'rgba(255,184,105,0.26)'); grd.addColorStop(0.7, 'rgba(255,176,100,0.07)'); grd.addColorStop(1, 'rgba(255,170,95,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
const glowGeo = new THREE.PlaneGeometry(1, 1);
function makeGlow(x, y, z, size) { const m = new THREE.Mesh(glowGeo, glowMat); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.scale.setScalar(size); m.renderOrder = 5; return m; }
const lampHeadMat = new THREE.MeshStandardMaterial({ color: '#fff3d6', emissive: PAL.lampGlow, emissiveIntensity: 0, roughness: 0.6 });
// light cones under street lamps: additive, vertex-coloured so the beam fades toward the ground
const coneMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, side: THREE.DoubleSide, fog: false });
function lightCone(x, yTop, z, rTop, rBottom, hex) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, yTop - 0.1, 14, 1, true).toNonIndexed();
  const c = new THREE.Color(hex), pos = g.attributes.position, col = new Float32Array(pos.count * 3), h = yTop - 0.1;
  for (let k = 0; k < pos.count; k++) { const t = Math.max(0, Math.min(1, (pos.getY(k) + h / 2) / h)); const f = 0.01 + 0.5 * t * t * t * t; col[k * 3] = c.r * f; col[k * 3 + 1] = c.g * f; col[k * 3 + 2] = c.b * f; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.translate(x, 0.1 + h / 2, z); return g;
}

export { mat, vcMat, vcMatFlat, swayMat, setSwayTime, setSnow, snowUniform, lookUniform, withSnow, snowKit, colorize, box, prism, blob, cyl, mergeMesh, glowTex, glowMat, glowGeo, makeGlow, lampHeadMat, coneMat, lightCone };
