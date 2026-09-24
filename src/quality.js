// Komachi — quality settings and the Settings card. Presets (low for phones, medium, high for desktops) set the render
// resolution, a frame-rate cap, the rich look's effects (ambient occlusion, miniature blur, smoothed edges), shadows and the
// few real lights; every control can also be changed on its own, live, and the choice is remembered. "Auto" picks a preset
// from the device and steps the resolution down if the frame rate cannot keep up. The card also holds the look toggles and
// the camera and new-island buttons that used to sit in the top bar. "Busy details" off (low) thins the small moving things: people
// off screen or far away animate at a quarter of the rate, half the rain and leaves, fewer birds and butterflies.
import { S } from './state.js';
import { scene, sun, resize, cam } from './scene.js';
import { setLook, setPasses, sizeLook } from './look.js';
import { openNew } from './title.js';

const PRESETS = {
  low: { res: 1, fps: 30, ao: false, aoHalf: true, blur: false, msaa: false, shadows: 'low', lights: false, busy: false },
  medium: { res: 1.5, fps: 45, ao: true, aoHalf: true, blur: false, msaa: true, shadows: 'low', lights: true, busy: true },
  high: { res: 2, fps: 60, ao: true, aoHalf: false, blur: true, msaa: true, shadows: 'high', lights: true, busy: true },
};
const phone = (() => { try { return matchMedia('(pointer: coarse)').matches && Math.max(screen.width, screen.height) < 1400; } catch { return false; } })();
const autoPreset = () => (phone ? 'low' : (navigator.hardwareConcurrency || 8) <= 4 ? 'medium' : 'high');

const Q = (() => {
  let saved = null; try { saved = JSON.parse(localStorage.getItem('komachi.quality') || 'null'); } catch { /* storage unavailable */ }
  const preset = saved && saved.preset || 'auto';
  return { preset, ...PRESETS[preset === 'auto' || preset === 'custom' ? autoPreset() : preset], ...(preset === 'custom' ? saved : {}), showFps: !!(saved && saved.showFps), preset };
})();
if (Q.busy === undefined) Q.busy = PRESETS[Q.preset === 'auto' || Q.preset === 'custom' ? autoPreset() : Q.preset].busy;
S.quality = Q;
const store = () => { try { localStorage.setItem('komachi.quality', JSON.stringify(Q)); } catch { /* storage unavailable */ } };

// ── applying: resolution, the effect chain, shadows, real lights ──
let shadowT = 0;
function applyShadows() {
  const size = Q.shadows === 'high' ? 2048 : 1024;
  sun.castShadow = Q.shadows !== 'off';
  if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  sun.shadow.autoUpdate = Q.shadows !== 'low';   // low: redrawn a few times a second instead of every frame
  sun.shadow.needsUpdate = true;
}
function applyLights() { scene.traverse(o => { if (o.isPointLight) o.visible = Q.lights; }); }
function apply() {
  resize(); setPasses(Q); sizeLook(); applyShadows(); applyLights();
  document.body.classList.toggle('pixel', S.pixelLook);
  fpsEl.hidden = !Q.showFps;
  store(); sync();
}
function choose(preset) {
  Q.preset = preset; Object.assign(Q, PRESETS[preset === 'auto' ? autoPreset() : preset]); apply();
}
function set(key, value) { Q[key] = value; if (key !== 'showFps') Q.preset = 'custom'; apply(); }

// ── each frame: the frame-rate cap, the meter, auto's resolution steps, the slow shadow redraw ──
let lastDraw = 0, frames = 0, meterT = 0, fps = 0, slowFor = 0;
/** true if this animation frame should run (the cap); call once per requestAnimationFrame */
function frameDue(now) {
  const cap = S.speed === 0 ? Math.min(Q.fps, 30) : Q.fps;   // paused: no need for more than 30
  if (lastDraw && now - lastDraw < 1000 / cap - 2) return false;
  lastDraw = now; frames++;
  if (now - meterT >= 1000) {
    fps = frames * 1000 / (now - meterT); frames = 0; meterT = now;
    if (Q.showFps) fpsEl.textContent = `${Math.round(fps)} fps · ${Q.preset === 'auto' ? 'auto ' + autoPreset() : Q.preset} · ×${Q.res}`;
    if (Q.preset === 'auto' && document.visibilityState === 'visible') {   // auto: step the resolution down while frames are dropping
      slowFor = fps < cap * 0.8 ? slowFor + 1 : 0;
      if (slowFor >= 4 && Q.res > 0.75) { Q.res = Math.max(0.75, Q.res - 0.25); slowFor = 0; apply(); }
    }
  }
  if (Q.shadows === 'low' && (shadowT += 1) >= Math.max(2, Math.round(cap / 4))) { shadowT = 0; sun.shadow.needsUpdate = true; }
  if (frames === 1) applyLights();   // lights added since (the festival, fireworks) follow the setting
  return true;
}

// ── the card ──
const card = document.getElementById('options'), fpsEl = document.getElementById('fps');
const seg = (name, value) => card.querySelectorAll(`[data-set="${name}"] button`).forEach(b => b.classList.toggle('on', b.dataset.v === String(value)));
function sync() {
  seg('preset', Q.preset); seg('fps', Q.fps); seg('shadows', Q.shadows);
  const res = card.querySelector('#opt-res'); res.value = Q.res; card.querySelector('#opt-res-v').textContent = `×${Q.res}`;
  for (const [id, on] of [['look', S.look === 'rich'], ['ao', Q.ao], ['blur', Q.blur], ['msaa', Q.msaa], ['lights', Q.lights], ['busy', Q.busy], ['pixel', S.pixelLook], ['showFps', Q.showFps]]) {
    const t = card.querySelector(`[data-toggle="${id}"]`); if (t) { t.classList.toggle('on', on); t.setAttribute('aria-checked', on ? 'true' : 'false'); }
  }
  for (const id of ['ao', 'blur', 'msaa']) card.querySelector(`[data-toggle="${id}"]`).closest('.opt-row').classList.toggle('dim', S.look !== 'rich');
  card.querySelector('#opt-auto-note').textContent = Q.preset === 'auto' ? `Auto chose ${autoPreset()} for this device${Q.res < PRESETS[autoPreset()].res ? ' and lowered the resolution to keep it smooth' : ''}.` : Q.preset === 'custom' ? 'Custom: your own mix of settings.' : '';
}
card.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const group = b.closest('[data-set]');
  if (group) { const k = group.dataset.set, v = b.dataset.v; if (k === 'preset') choose(v); else set(k, k === 'fps' ? +v : v); return; }
  const t = b.dataset.toggle;
  if (t === 'look') { setLook(S.look === 'rich' ? 'classic' : 'rich'); apply(); return; }
  if (t === 'pixel') { S.pixelLook = !S.pixelLook; try { localStorage.setItem('komachi.pixelLook', S.pixelLook ? '1' : '0'); } catch { /* storage unavailable */ } apply(); return; }
  if (t) { set(t, !Q[t]); return; }
  if (b.id === 'opt-close') { card.classList.remove('show'); document.getElementById('btn-options').classList.remove('on'); return; }
  if (b.id === 'opt-centre') { cam.target.set(0, 0, 0); cam.tView = 18; return; }
  if (b.id === 'opt-install' && installPrompt) { installPrompt.prompt(); installPrompt.userChoice.finally(() => { installPrompt = null; b.hidden = true; }); return; }
  if (b.id === 'opt-new') { card.classList.remove('show'); document.getElementById('btn-options').classList.remove('on'); openNew(); }   // the new-island form: the current town is kept in Towns
});
// the browser offers installing the app (Chrome, Edge, Android): the Settings card shows an Install button while it may
let installPrompt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; card.querySelector('#opt-install').hidden = false; });
addEventListener('appinstalled', () => { installPrompt = null; card.querySelector('#opt-install').hidden = true; });
card.addEventListener('menu-show', sync);   // shown as the main menu's Settings page (src/title.js)
card.querySelector('#opt-res').addEventListener('input', e => set('res', +e.target.value));
document.getElementById('btn-options').addEventListener('click', e => { const open = card.classList.toggle('show'); e.currentTarget.classList.toggle('on', open); sync(); });

apply();
export { Q, frameDue, PRESETS };
