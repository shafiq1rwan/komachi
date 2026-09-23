// Komachi — the sea: calm, cosy bay water rather than an ocean. One flat plane whose material is the scene's standard
// material (so the sun, the cloud shade, the fog and tone mapping all apply) patched in the shader:
//  - colour: a muted deep blue-teal out at sea, lighter over the shallows near the coast (the coastline is the island's own
//    radial curve, evaluated in the shader from the same harmonics), with a slow, broad colour drift so no two patches match
//  - shape: three broad, slow sine waves in different directions, their coordinates warped by noise so the pattern never
//    lines up, plus a whisper of fine noise; they only bend the normal (soft diffuse light, no displacement)
//  - sparse soft highlights on the crests, as short irregular streaks aligned with the main swell, fading at night
//  - a faint, view-independent hint of the sky colour, a little more where the surface tilts; no Fresnel, no mirror
// Matte (roughness 0.9, no metal), fully opaque. `waterUniforms` are driven by updateWater (time) and daynight.js (sky, day).
import * as THREE from 'three';

const waterUniforms = {
  uTime: { value: 0 }, uDay: { value: 1 },
  uSky: { value: new THREE.Color('#cfe0e4') },
  uDeep: { value: new THREE.Color('#487c8b') }, uShallow: { value: new THREE.Color('#7aa7ad') },
  uRich: { value: 0 },
  uHarm: { value: [new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4(), new THREE.Vector4()] },
  uIsle: { value: new THREE.Vector3(1, 1, 1) },   // base radius, ellipse x, ellipse z
};

const COMMON = /* glsl */`
uniform float uTime, uDay, uRich; uniform vec3 uSky, uDeep, uShallow; uniform vec4 uHarm[4]; uniform vec3 uIsle;
varying vec3 vSeaPos;
float seaHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float seaNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(seaHash(i), seaHash(i + vec2(1.0, 0.0)), f.x), mix(seaHash(i + vec2(0.0, 1.0)), seaHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
// signed distance-ish to the coast (positive inland), the same curve island.js draws the land with
float seaCoast(vec2 p) {
  vec2 q = vec2(p.x / uIsle.y, p.y / uIsle.z); float th = atan(q.y, q.x), r = uIsle.x;
  for (int i = 0; i < 4; i++) r += uHarm[i].z * sin(uHarm[i].x * th + uHarm[i].y);
  return r - length(q);
}
// three broad swells: x = height, yz = slope (d height / d x, d height / d z)
vec3 seaWave(vec2 p, vec2 dir, float len, float amp, float speed) {
  float k = 6.2831853 / len, ph = dot(dir, p) * k - uTime * speed * k;
  return vec3(amp * sin(ph), amp * k * cos(ph) * dir);
}
vec3 seaWaves(vec2 p) {
  vec2 w = p + (vec2(seaNoise(p * 0.06), seaNoise(p * 0.06 + 17.3)) - 0.5) * 7.0;   // warp: no straight wave fronts, no repeat
  return seaWave(w, vec2(0.8, 0.6), 7.5, 0.055, 0.22) + seaWave(w, vec2(-0.47, 0.88), 4.6, 0.032, 0.3) + seaWave(w, vec2(0.12, -0.99), 2.9, 0.016, 0.38);
}
`;

/** the sea's material; `harm` is island.js's coastline [[k, phase, amp] × 4] */
function makeSeaMaterial(harm, R0, SX, SZ) {
  harm.forEach(([k, p, a], i) => waterUniforms.uHarm.value[i].set(k, p, a, 0));
  waterUniforms.uIsle.value.set(R0, SX, SZ);
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, waterUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSeaPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vSeaPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + COMMON)
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
 vec2 sp = vSeaPos.xz;
 float seaShore = 1.0 - smoothstep(0.2, 4.5, -seaCoast(sp));   // 1 at the water's edge, 0 a few units out
 float seaVar = seaNoise(sp * 0.04 + uTime * 0.004) * 0.6 + seaNoise(sp * 0.11 - uTime * 0.006) * 0.4;
 diffuseColor.rgb = mix(uDeep, uShallow, clamp(seaShore * 0.8 + (seaVar - 0.5) * 0.3, 0.0, 1.0));`)
      .replace('#include <normal_fragment_maps>', /* glsl */`#include <normal_fragment_maps>
 vec3 seaW = seaWaves(sp);
 vec2 seaG = seaW.yz * (1.0 - seaShore * 0.5) + (vec2(seaNoise(sp * 0.8 + uTime * 0.05), seaNoise(sp * 0.8 + 31.0 - uTime * 0.04)) - 0.5) * 0.04
   + (vec2(seaNoise(sp * 2.6 + vec2(uTime * 0.12, 0.0)), seaNoise(sp * 2.6 + vec2(53.0, -uTime * 0.1))) - 0.5) * 0.07;   // a faint fine ripple, never tiled
 normal = normalize((viewMatrix * vec4(normalize(vec3(-seaG.x, 1.0, -seaG.y)), 0.0)).xyz);`)
      .replace('#include <opaque_fragment>', /* glsl */`
 float seaCrest = smoothstep(0.03, 0.08, seaW.x);   // near the top of the combined swell
 vec2 seaA = vec2(0.8, 0.6), seaQ = vec2(dot(sp, seaA), dot(sp, vec2(-seaA.y, seaA.x)));
 float seaStreak = smoothstep(0.7, 0.88, seaNoise(vec2(seaQ.x * 3.4, seaQ.y * 1.4) + vec2(uTime * 0.2, uTime * 0.03)))   // short, broken, along the swell
   * smoothstep(0.5, 0.75, seaNoise(sp * 0.16 + vec2(5.0, uTime * 0.01)));   // and only here and there
 outgoingLight += vec3(0.93, 0.96, 0.95) * seaCrest * seaStreak * (1.0 - seaShore * 0.7) * mix(0.16, 0.32, uRich) * uDay;
 outgoingLight = mix(outgoingLight, uSky * (0.45 + 0.55 * uDay), 0.05 + clamp(length(seaG) * 0.8, 0.0, 0.07));
#include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => 'komachi-sea';
  return m;
}
function tickWater(dt) { waterUniforms.uTime.value += dt; }
export { waterUniforms, makeSeaMaterial, tickWater };
