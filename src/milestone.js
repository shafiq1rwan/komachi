// Komachi — milestone announcements: a larger cream card at the top centre (a pictogram, a title, one line) for the moments
// that change the town. It stays about ten seconds or until dismissed. "Go and look" glides the camera to the place for a
// few seconds while the change plays out there, then back to where the player was; any drag, wheel or move key ends the
// glide where it is. The slim notice (toast.js) stays for everything else.
import * as THREE from 'three';
import { cam, renderer } from './scene.js';

const el = document.getElementById('milestone');
const ICONS = {   // inline pictograms in the notice palette; never text
  hill: '<svg viewBox="0 0 32 32"><path d="M3 26 L13 12 L18 18 L22 14 L29 26 Z" fill="#8fae8b"/><path d="M8 11h16M10 14h12M12 11v9M20 11v9" stroke="#c96a55" stroke-width="2.2" stroke-linecap="round"/><circle cx="25" cy="7" r="2.6" fill="#f0c27a"/></svg>',
  train: '<svg viewBox="0 0 32 32"><rect x="7" y="5" width="18" height="18" rx="5" fill="#6f9fa0"/><rect x="10" y="9" width="12" height="6" rx="1.5" fill="#fbf6ec"/><circle cx="12" cy="19" r="1.6" fill="#fbf6ec"/><circle cx="20" cy="19" r="1.6" fill="#fbf6ec"/><path d="M10 27l3-4M22 27l-3-4" stroke="#6f9fa0" stroke-width="2.2" stroke-linecap="round"/></svg>',
  festival: '<svg viewBox="0 0 32 32"><path d="M4 9 Q16 15 28 9" stroke="#6b6f7a" stroke-width="1.4" fill="none"/><ellipse cx="9" cy="16" rx="3.4" ry="4.4" fill="#d98b7a"/><ellipse cx="16" cy="18" rx="3.4" ry="4.4" fill="#f0c27a"/><ellipse cx="23" cy="16" rx="3.4" ry="4.4" fill="#d98b7a"/><path d="M9 11v1M16 13v1M23 11v1" stroke="#6b6f7a" stroke-width="1.4"/><circle cx="25" cy="26" r="1.3" fill="#9ad0e8"/><circle cx="7" cy="27" r="1" fill="#c8f0b0"/></svg>',
  people: '<svg viewBox="0 0 32 32"><circle cx="11" cy="11" r="4" fill="#d98b7a"/><circle cx="21" cy="11" r="4" fill="#8fae8b"/><path d="M4 26c0-5 3-8 7-8s7 3 7 8zM14 26c0-5 3-8 7-8s7 3 7 8z" fill="#6f9fa0"/></svg>',
};
let hideAt = 0, onLook = null, look = null, glide = null;
const now = () => performance.now() / 1000;

el.innerHTML = '<span class="ms-icon"></span><div class="ms-text"><b></b><span></span></div><button class="ms-look" type="button">Go and look</button><button class="ms-close" type="button" aria-label="Dismiss">&times;</button>';
const [iconEl, titleEl, lineEl, lookBtn, closeBtn] = [el.querySelector('.ms-icon'), el.querySelector('b'), el.querySelector('.ms-text span'), el.querySelector('.ms-look'), el.querySelector('.ms-close')];
function hide() { el.classList.remove('show'); hideAt = 0; }
closeBtn.addEventListener('click', hide);
lookBtn.addEventListener('click', () => { if (look) startGlide(look.at, look.view); if (onLook) onLook(); hide(); });

/** Show the milestone card. `at` (Vector3) and `view` are where "Go and look" takes the camera; `lookFn` runs as it sets off. */
export function announce({ title, line, icon = 'hill', at = null, view = 6, onLook: lookFn = null }) {
  iconEl.innerHTML = ICONS[icon] || ICONS.hill; titleEl.textContent = title; lineEl.textContent = line;
  look = at ? { at: at.clone(), view } : null; onLook = lookFn; lookBtn.hidden = !look;
  el.classList.add('show'); hideAt = now() + 10;
}
export const milestoneShown = () => el.classList.contains('show');

// the glide: ease in to the place (1.4 s), hold while the change plays out, ease back to the saved view (1.4 s)
const IN = 1.4, HOLD = 5, OUT = 1.4, ease = t => t * t * (3 - 2 * t);
function startGlide(at, view) {
  glide = { t0: now(), from: cam.target.clone(), fromView: cam.tView, to: at, toView: Math.min(view, cam.tView) };
}
export function cancelGlide() { glide = null; }
export const gliding = () => !!glide;
const stop = () => { if (glide) glide = null; };
renderer.domElement.addEventListener('pointerdown', stop);
renderer.domElement.addEventListener('wheel', stop, { passive: true });
addEventListener('keydown', e => { if (/^(Key[WASD]|Arrow)/.test(e.code)) stop(); });

const tmp = new THREE.Vector3();
/** once a frame from the main loop */
export function updateMilestone() {
  const t = now();
  if (hideAt && t >= hideAt) hide();
  if (!glide) return;
  const g = glide, e = t - g.t0;
  if (e < IN) { const k = ease(e / IN); cam.target.copy(tmp.copy(g.from).lerp(g.to, k)); cam.tView = g.fromView + (g.toView - g.fromView) * k; }
  else if (e < IN + HOLD) { cam.target.copy(g.to); cam.tView = g.toView; }
  else if (e < IN + HOLD + OUT) { const k = ease((e - IN - HOLD) / OUT); cam.target.copy(tmp.copy(g.to).lerp(g.from, k)); cam.tView = g.toView + (g.fromView - g.toView) * k; }
  else { cam.target.copy(g.from); cam.tView = g.fromView; glide = null; }
}
