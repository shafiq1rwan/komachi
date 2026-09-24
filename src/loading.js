// Komachi — the loading screen: the island picture and the wordmark with a progress bar that follows what is really loading
// (the island, the fonts, the cars, the people, the service vehicles, the fox), so the menu only appears once the town can be
// shown as it is meant to look (no box people turning into characters). A model that fails or takes too long never holds the
// game: after TIMEOUT seconds the screen goes anyway and the box fallbacks stand in, as before. Test and sample tabs
// (?demo, ?new, ?seed) only wait for the island, so the tests keep their pace.
import { characterReady, characterProgress } from './characters.js';
import { vehiclesReady } from './vehicles.js';
import { serviceLoaded } from './service-vehicles.js';
import { foxLoaded } from './kitsune.js';
import { scratch } from './slots.js';

const TIMEOUT = 25;
const el = document.getElementById('loading'), bar = el.querySelector('.ld-bar i'), line = el.querySelector('.ld-line');
// each step's share of the bar, and the line shown while it is the one being waited for
const steps = [
  { key: 'island', w: 15, text: 'Raising the island…', done: false },
  { key: 'fonts', w: 5, text: 'Painting the signs…', done: false, p: document.fonts ? document.fonts.ready : Promise.resolve() },
  { key: 'cars', w: 15, text: 'Cars are coming over on the ferry…', done: false, p: vehiclesReady },
  { key: 'people', w: 50, text: 'Residents are packing their bags…', done: false, p: characterReady, part: () => characterProgress() },
  { key: 'service', w: 10, text: 'The postman is sorting the letters…', done: false, p: serviceLoaded },
  { key: 'fox', w: 5, text: 'Something is stirring on the hill…', done: false, p: foxLoaded },
];
let shown = 0, finished = false, onDone = null;
const t0 = performance.now();
for (const s of steps) if (s.p) s.p.then(() => { s.done = true; }, () => { s.done = true; });
function frame() {
  if (finished) return;
  let target = 0;
  for (const s of steps) target += s.w * (s.done ? 1 : s.part ? Math.min(0.95, s.part()) : 0);
  shown += (target - shown) * 0.12; bar.style.width = shown.toFixed(1) + '%';
  const waiting = steps.find(s => !s.done); line.textContent = waiting ? waiting.text : 'Opening the station gates…';
  const allDone = !waiting, late = (performance.now() - t0) / 1000 > TIMEOUT;
  if ((allDone && shown > 97) || late || (scratch && steps[0].done)) { finish(); return; }
  requestAnimationFrame(frame);
}
function finish() {
  finished = true; bar.style.width = '100%';
  setTimeout(() => { el.classList.add('gone'); if (onDone) onDone(); }, scratch ? 0 : 250);
}
/** main.js: the island is built and the first frame is on its way */
export function islandReady(then) { steps[0].done = true; onDone = then || null; }
requestAnimationFrame(frame);
export const loadingDone = () => finished;
