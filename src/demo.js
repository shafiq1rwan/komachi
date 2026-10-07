// Komachi — the free web demo (vite build --mode demo → dist-demo/, zipped by scripts/pack-poki.mjs dist-demo): the whole game on
// the itch page, played before paying. One town, kept for the browser session only (slots.js stores in sessionStorage in this
// build), the album in memory, no export or import; and when the town reaches day DEMO_DAYS + 1 the demo ends: the clock stops,
// a wall covers the screen with the town paused behind it, and the only way on is the store link (decided by the user 2026-10-07:
// a hard stop, nothing else to do but buy). A small "Demo" link sits in the brand card the whole time. Everything here is a
// no-op outside this build.
import { S } from './state.js';
import { dayOf } from './sim.js';

export const DEMO = import.meta.env.MODE === 'demo';
export const DEMO_DAYS = 3;   // about twelve minutes of play: long enough for the first family to move in
export const STORE_URL = 'https://saiss.itch.io/komachi';   // the itch page; the full game's price is on the page, not here
let walled = false, wall = null;
/** the page (or the iframe itch puts it in) to full screen and back; a no-op where the browser refuses */
export function toggleFullscreen() {
  try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch { /* not allowed here */ }
}
export const fullscreenAllowed = () => !!document.fullscreenEnabled;

/** main.js, once: the Full screen button, the "Demo" link in the brand card and the wall's markup */
export function initDemo() {
  if (!DEMO) return;
  document.body.classList.add('demo');
  const brand = document.getElementById('brand');
  const photo = document.getElementById('btn-photo');
  if (photo && fullscreenAllowed()) { const b = document.createElement('button'); b.className = 'icon-btn'; b.id = 'btn-full'; b.dataset.tip = 'Full screen'; b.innerHTML = '<i class="fa-solid fa-expand"></i>'; b.addEventListener('click', toggleFullscreen); photo.before(b); }
  if (brand) { const a = document.createElement('a'); a.id = 'demo-tag'; a.href = STORE_URL; a.target = '_blank'; a.rel = 'noopener'; a.innerHTML = 'Demo<span class="long"> · get the full game</span>'; brand.appendChild(a); }
  wall = document.createElement('div'); wall.id = 'demo-wall'; wall.setAttribute('role', 'dialog'); wall.setAttribute('aria-modal', 'true');
  wall.innerHTML = `<div id="demo-card"><div class="dc-text"><b>This island is yours to keep</b><span>That is ${DEMO_DAYS} days of the demo. The full game carries on from here and keeps every town between visits, holds as many towns as you like, saves your photos and runs offline on the desktop.</span></div>
    <div class="dc-actions"><a class="dc-get" href="${STORE_URL}" target="_blank" rel="noopener">Get Komachi · the full game</a></div></div>`;
  document.body.appendChild(wall);
}
/** every frame from main.js: the wall once the town has lived its demo days (it waits while a menu or the opening covers the town),
 *  and the clock held at zero behind it from then on */
export function updateDemo() {
  if (!DEMO || !wall) return;
  if (walled) { S.speed = 0; return; }
  if (dayOf() > DEMO_DAYS && !document.body.classList.contains('menu-full') && !document.body.classList.contains('menu-pause') && !document.body.classList.contains('opening')) {
    walled = true; S.speed = 0; document.body.classList.add('demo-wall'); wall.classList.add('show');
  }
}
export const demoWalled = () => walled;
export const demoState = () => ({ demo: DEMO, days: DEMO_DAYS, day: dayOf(), walled, open: !!(wall && wall.classList.contains('show')), speed: S.speed });
