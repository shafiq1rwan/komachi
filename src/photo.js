// Komachi — photo mode (Phase 9): the HUD steps aside, the town keeps living, and one button takes the picture the canvas is
// showing. The player frames the shot with the ordinary camera (drag, scroll, Q/E; Space still pauses the clock for the moment
// they want), the caption line under the button says what the picture will be called (town, day, time, season, weather), and
// "Take photo" asks main.js for the next rendered frame: `photoDue()` after renderFrame, then `capturePhoto()` reads the canvas
// while the frame is still there (the renderer keeps no drawing buffer). The JPEG goes into the album (src/album.js) with a
// flash and a small preview of the last shot. Enter with the camera button in the top bar or P; Esc or Done leaves.
import { S } from './state.js';
import { renderer } from './scene.js';
import { activeId, listSlots } from './slots.js';
import { seasonOf } from './seasons.js';
import { weatherWord } from './weather.js';
import { chronicle, record } from './chronicle.js';
import { toast } from './toast.js';
import { addPhoto } from './album.js';

const MAX_W = 1280, QUALITY = 0.86;
const photo = { active: false, taken: 0, last: null };
let want = false, hooks = { onEnter: () => {} };
const bar = document.getElementById('photo'), take = document.getElementById('photo-take'), done = document.getElementById('photo-done');
const capEl = bar && bar.querySelector('.ph-cap b'), lastEl = document.getElementById('photo-last'), flash = document.getElementById('photo-flash');

const clock = h => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
function townName() { const s = listSlots().find(x => x.id === activeId()); return s ? s.name : 'Komachi'; }
/** "Hinata Town · Day 12 · 15:20 · Autumn · light rain" */
function caption() {
  const h = S.T % 24, w = weatherWord();
  return `${townName()} · Day ${Math.floor(S.T / 24) + 1} · ${clock(h)} · ${cap(seasonOf())}${w ? ` · ${w}` : ''}`;
}
function enter() {
  if (photo.active || !bar) return;
  photo.active = true; document.body.classList.add('photo'); bar.hidden = false; hooks.onEnter(); updatePhotoMode();
}
function exit() { if (!photo.active) return; photo.active = false; document.body.classList.remove('photo'); bar.hidden = true; }
/** the button: the picture is taken after the next frame is drawn (see main.js) */
function shoot() { if (photo.active && !want) want = true; }
export function photoDue() { return want; }
/** right after renderFrame: read the canvas, keep the JPEG, flash */
export function capturePhoto() {
  want = false;
  let rec = null;
  try {
    const src = renderer.domElement, w = Math.min(MAX_W, src.width), h = Math.round(src.height * w / src.width);
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(src, 0, 0, w, h);
    rec = { id: 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), town: activeId() || 'scratch', takenAt: Date.now(), day: Math.floor(S.T / 24) + 1, hour: S.T % 24,
      season: seasonOf(), weather: weatherWord(), caption: caption(), w, h, data: c.toDataURL('image/jpeg', QUALITY) };
  } catch { toast('The picture could not be taken'); return; }
  if (flash) { flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go'); }
  if (lastEl) { lastEl.style.backgroundImage = `url('${rec.data}')`; lastEl.classList.add('show'); }
  photo.last = rec;
  addPhoto(rec).then(() => {
    photo.taken++; toast(photo.taken === 1 ? 'Saved to the album' : `Saved to the album (${photo.taken} this session)`);
    if (!chronicle.some(e => /photograph/.test(e.text))) record('The first photograph of the town was taken');
  }, () => toast('The album is full: the browser refused the photo'));
}
/** every frame while active: the caption follows the clock */
export function updatePhotoMode() { if (!photo.active || !capEl) return; const c = caption(); if (capEl.textContent !== c) capEl.textContent = c; }
/** main.js: what to do on entering (clear the tool, pinned cards, the follow) */
export function initPhoto(h) { hooks = { ...hooks, ...h }; }
export const photoActive = () => photo.active;

if (bar) {
  take.addEventListener('click', shoot); done.addEventListener('click', exit);
  const btn = document.getElementById('btn-photo'); if (btn) btn.addEventListener('click', enter);
}
export { enter as enterPhoto, exit as exitPhoto, shoot as takePhoto, photo };
