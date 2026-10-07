// Komachi — the free web demo (vite build --mode demo → dist-demo/, zipped by scripts/pack-poki.mjs dist-demo): the whole game on
// the itch page, played before paying, with limits that feel natural rather than punitive. One town, kept for the browser session
// only (slots.js stores in sessionStorage in this build), the album in memory, no export or import; and after DEMO_DAYS game days a
// cream card offers the full game while the town carries on behind it. The card shows once a session, and a small "Demo" link sits
// in the brand card the whole time. Nothing is locked mid-play and nothing is taken away. Everything here is a no-op outside this build.
import { S } from './state.js';
import { dayOf } from './sim.js';

export const DEMO = import.meta.env.MODE === 'demo';
export const DEMO_DAYS = 3;   // about twelve minutes of play: long enough for the first family to move in
export const STORE_URL = 'https://saiss.itch.io/komachi';   // the itch page; the full game's price is on the page, not here
let shown = false, card = null;
/** the page (or the iframe itch puts it in) to full screen and back; a no-op where the browser refuses */
export function toggleFullscreen() {
  try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch { /* not allowed here */ }
}
export const fullscreenAllowed = () => !!document.fullscreenEnabled;

/** main.js, once: the "Demo" link in the brand card and the offer card's markup */
export function initDemo() {
  if (!DEMO) return;
  document.body.classList.add('demo');
  const brand = document.getElementById('brand');
  const photo = document.getElementById('btn-photo');
  if (photo && fullscreenAllowed()) { const b = document.createElement('button'); b.className = 'icon-btn'; b.id = 'btn-full'; b.dataset.tip = 'Full screen'; b.innerHTML = '<i class="fa-solid fa-expand"></i>'; b.addEventListener('click', toggleFullscreen); photo.before(b); }
  if (brand) { const a = document.createElement('a'); a.id = 'demo-tag'; a.href = STORE_URL; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Demo · get the full game'; brand.appendChild(a); }
  card = document.createElement('div'); card.id = 'demo-card'; card.setAttribute('role', 'status');
  card.innerHTML = `<div class="dc-text"><b>This island is yours to keep</b><span>You have played ${DEMO_DAYS} days of the demo. The full game keeps every town between visits, holds as many towns as you like, saves your photos and runs offline on the desktop. This town carries on meanwhile.</span></div>
    <div class="dc-actions"><a class="dc-get" href="${STORE_URL}" target="_blank" rel="noopener">Get Komachi</a><button class="dc-keep" type="button">Keep playing</button></div>`;
  card.querySelector('.dc-keep').addEventListener('click', hideCard);
  document.body.appendChild(card);
}
function showCard() { if (!card) return; shown = true; card.classList.add('show'); }
function hideCard() { if (card) card.classList.remove('show'); }
/** every frame from main.js: the offer once the town has lived its demo days (never while a menu covers the town) */
export function updateDemo() {
  if (!DEMO || shown || !card) return;
  if (dayOf() > DEMO_DAYS && !document.body.classList.contains('menu-full') && !document.body.classList.contains('menu-pause') && !document.body.classList.contains('opening')) showCard();
}
export const demoState = () => ({ demo: DEMO, days: DEMO_DAYS, day: dayOf(), shown, open: !!(card && card.classList.contains('show')), speed: S.speed });
