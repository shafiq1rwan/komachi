// Komachi — background music (2026-09-25). Three loops from assets/audio/bgm, crossfaded by what the moment calls for:
// `menu` while the title or pause menu is open (and through the opening's train ride), `rain` while it rains, `night` after dusk.
// A clear day is silent for now: a day.mp3 would take that slot. Browsers only play sound after a gesture, so the first pointer
// or key press unlocks playback; until then nothing is loaded either (the tracks are large). Settings card: a Music switch and
// a volume slider, kept in localStorage `komachi.audio`.
import menuUrl from '../assets/audio/bgm/menu.mp3?url';
import nightUrl from '../assets/audio/bgm/night.mp3?url';
import rainUrl from '../assets/audio/bgm/raining.mp3?url';

const TRACKS = { menu: menuUrl, night: nightUrl, rain: rainUrl };
const A = (() => { let s = null; try { s = JSON.parse(localStorage.getItem('komachi.audio') || 'null'); } catch { /* storage unavailable */ } return { on: true, volume: 0.6, ...(s || {}) }; })();
const store = () => { try { localStorage.setItem('komachi.audio', JSON.stringify(A)); } catch { /* storage unavailable */ } };
const players = {};
let unlocked = false, want = null;
function player(name) {
  if (!players[name]) { const a = new Audio(TRACKS[name]); a.loop = true; a.preload = 'none'; a.volume = 0; players[name] = { a, gain: 0 }; }
  return players[name];
}
const unlock = () => { unlocked = true; };
addEventListener('pointerdown', unlock, { once: true }); addEventListener('keydown', unlock, { once: true });

/** which loop the moment calls for: the menu first, then rain, then night; null keeps quiet */
const pickTrack = ({ menu, rain, night }) => menu ? 'menu' : rain ? 'rain' : night ? 'night' : null;

/** every frame from main.js: fade the wanted loop in (about two seconds) and the others out (about one), pause what is silent */
function updateAudio(dt, state) {
  want = A.on ? pickTrack(state) : null;
  if (!unlocked) return;
  for (const name of Object.keys(TRACKS)) {
    const target = name === want ? 1 : 0;
    if (!players[name] && !target) continue;
    const p = player(name);
    p.gain = Math.max(0, Math.min(1, p.gain + (target ? dt / 2.5 : -dt / 1.5)));   // in over 2.5 s, out over 1.5 s, whatever the frame rate
    if (target && p.a.paused) p.a.play().catch(() => { /* not allowed yet: the next gesture will */ });
    p.a.volume = Math.max(0, Math.min(1, p.gain * A.volume));
    if (!target && p.gain < 0.01 && !p.a.paused) { p.a.pause(); p.gain = 0; }
  }
}
/** dev hook: what is playing */
const audioState = () => ({ on: A.on, volume: A.volume, want, unlocked, playing: Object.entries(players).filter(([, p]) => !p.a.paused).map(([n, p]) => [n, +p.a.volume.toFixed(2)]) });

// the Settings card's Sound rows
{
  const sw = document.getElementById('opt-music'), vol = document.getElementById('opt-volume'), volV = document.getElementById('opt-volume-v');
  const sync = () => {
    if (sw) { sw.classList.toggle('on', A.on); sw.setAttribute('aria-checked', A.on ? 'true' : 'false'); }
    if (vol) { vol.value = A.volume; if (volV) volV.textContent = Math.round(A.volume * 100) + '%'; }
  };
  if (sw) sw.addEventListener('click', () => { A.on = !A.on; store(); sync(); unlocked = true; });
  if (vol) vol.addEventListener('input', e => { A.volume = +e.target.value; store(); sync(); });
  sync();
}

export { updateAudio, audioState };
