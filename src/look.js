// Komachi — the "rich" look (a prototype beside the classic one, toggled from the sliders menu and remembered): the town is
// rendered through a small post chain that gives it a miniature-diorama feel without touching any geometry:
//   ambient occlusion (GTAO) so things sit in the ground and eaves darken, a tilt-shift blur toward the top and bottom of the
//   screen, and a grade in display space (cool shadows, warm highlights, a little more saturation and contrast, a soft vignette).
// Lighting (daynight.js), the sea colour, the haze and a gentle tone variation on upward faces (geometry.js, `lookUniform`)
// read `lookK()` so the two looks share one code path. The classic look renders straight to the canvas as before.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';
import { renderer, scene, camera } from './scene.js';
import { S } from './state.js';
import { lookUniform } from './geometry.js';

const GRADE = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.32 }, contrast: { value: 1.06 }, gamma: { value: 1.14 }, split: { value: 0.5 }, vignette: { value: 0.22 } },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float sat, contrast, gamma, split, vignette; varying vec2 vUv;
    void main() {
      vec3 c = pow(texture2D(tDiffuse, vUv).rgb, vec3(gamma));   // deeper midtones: the pastels gain body
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(c, c * vec3(0.9, 0.97, 1.1), (1.0 - smoothstep(0.05, 0.55, l)) * split);   // shadows lean cool blue
      c = mix(c, c * vec3(1.04, 1.0, 0.95), smoothstep(0.55, 1.0, l) * split);          // sunlit faces lean warm
      float gr = max(0.0, c.g - max(c.r, c.b)); c.r -= gr * 0.55; c.b += gr * 0.12;       // greens leave olive for a fresher leaf green
      l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, sat);
      c = (c - 0.5) * contrast + 0.5;
      float d = length((vUv - 0.5) * vec2(1.15, 1.0));
      c *= 1.0 - vignette * smoothstep(0.42, 0.9, d);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

let composer = null, gtao = null, tiltH = null, tiltV = null, passes = { ao: true, aoHalf: false, blur: true, msaa: true };
const lookK = () => (S.look === 'rich' ? 1 : 0);
lookUniform.value = lookK();
document.body.classList.toggle('rich', S.look === 'rich');

function build() {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });   // MSAA keeps edges clean through the chain
  composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  gtao = new GTAOPass(scene, camera, size.x, size.y);
  gtao.blendIntensity = 0.62;
  gtao.updateGtaoMaterial({ radius: 0.72, distanceExponent: 1.4, thickness: 1.6, scale: 1.6, samples: 12 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
  // clouds (shade only), glows, beams and the like must not write into the AO depth: hide every see-through mesh too
  gtao.overrideVisibility = function () {
    const cache = this._visibilityCache;
    this.scene.traverse(o => {
      cache.set(o, o.visible);
      const m = o.material;
      if (o.isPoints || o.isLine || (o.isMesh && m && !Array.isArray(m) && (m.transparent || m.colorWrite === false || m.blending === THREE.AdditiveBlending))) o.visible = false;
    });
  };
  composer.addPass(gtao);
  tiltH = new ShaderPass(HorizontalTiltShiftShader); tiltV = new ShaderPass(VerticalTiltShiftShader);
  composer.addPass(tiltH); composer.addPass(tiltV);
  composer.addPass(new OutputPass());   // tone mapping and sRGB, then the grade in display space
  composer.addPass(new ShaderPass(GRADE));
  applyPasses(); sizeLook();
}
/** quality.js: which of the rich look's effects run (ambient occlusion, at full or half resolution; the miniature blur; MSAA) */
function setPasses(q) { passes = { ao: q.ao, aoHalf: q.aoHalf, blur: q.blur, msaa: q.msaa }; applyPasses(); }
function applyPasses() {
  if (!composer) return;
  gtao.enabled = passes.ao; tiltH.enabled = tiltV.enabled = passes.blur;
  const n = passes.msaa ? 4 : 0;
  for (const t of [composer.renderTarget1, composer.renderTarget2]) if (t.samples !== n) { t.samples = n; t.dispose(); }
}
/** keep the chain at the canvas's drawing size (resize in scene.js sets that, including the half-size pixel look) */
function sizeLook() {
  if (!composer) return;
  const size = renderer.getSize(new THREE.Vector2());
  const ao = passes.aoHalf ? 0.5 : 1;
  composer.setPixelRatio(1); composer.setSize(size.x, size.y); gtao.setSize(Math.max(1, Math.floor(size.x * ao)), Math.max(1, Math.floor(size.y * ao)));
  const k = 0.6;   // lighter edge blur keeps the distant town legible while retaining a little miniature focus
  tiltH.uniforms.h.value = k / size.x; tiltV.uniforms.v.value = k / size.y;
  tiltH.uniforms.r.value = tiltV.uniforms.r.value = 0.5;
}
addEventListener('resize', () => setTimeout(sizeLook, 0));
/** each frame, in place of renderer.render */
function renderFrame() {
  if (S.look !== 'rich') { renderer.render(scene, camera); return; }
  if (!composer) build();
  composer.render();
}
function setLook(look) {
  S.look = look; lookUniform.value = lookK();
  document.body.classList.toggle('rich', look === 'rich');
  scene.traverse(o => {
    if (o.userData.lookOnly) o.visible = o.userData.lookOnly === look;
    if (o.userData.lookColors) o.material[0].color.set(o.userData.lookColors[look]);
  });
  try { localStorage.setItem('komachi.lookStyle', look); } catch { /* storage unavailable */ }
  if (look === 'rich' && !composer) build(); else sizeLook();
  dispatchEvent(new Event('komachi-look'));
}
export { renderFrame, setLook, lookK, sizeLook, setPasses };
