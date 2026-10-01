// Komachi — the Poki build (vite build --mode poki → dist-poki/, zipped by scripts/pack-poki.mjs). Poki hosts HTML5 games in
// an iframe and asks for its SDK to be told when loading has finished, when play starts and stops (the menus), and for a
// commercial break at natural pauses; it also forbids links out of the game, third-party requests and a service worker,
// which the other modules check with `POKI`. Everything here is a no-op outside that build, so the web, PWA and desktop
// builds carry no SDK. The SDK script is loaded here rather than from index.html so one page serves every build; if it fails
// to load (offline, blocked) the game simply plays without it. The SDK script and PokiSDK.init() sit in the page head of the
// Poki build (vite.config.js pokiHtml: Poki's QA tool looks for exactly that); this module waits on that promise and only falls
// back to loading the script itself when the head has none. Nothing is sent before init() has resolved: what the game
// reports earlier (loading done, play begun) is remembered and sent then, in Poki's required order.
import { setMuted } from './audio.js';

export const POKI = import.meta.env.MODE === 'poki';
const SDK_URL = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js';
const state = { ready: false, loaded: false, playing: false, calls: [] };   // calls: what was sent, for the check script
let wantLoaded = false, wantPlaying = false;
const sdk = () => (POKI && state.ready && window.PokiSDK) || null;
const note = c => { state.calls.push(c); if (state.calls.length > 40) state.calls.shift(); };
const send = (name, ...args) => { const P = sdk(); if (!P) return false; note(name); try { P[name](...args); } catch { /* the SDK's problem, not the game's */ } return true; };
/** what the game reported before the SDK was ready goes out now, loading first */
function flush() {
  if (!state.ready) return;
  if (wantLoaded && !state.loaded) { state.loaded = true; send('gameLoadingFinished'); }
  if (wantPlaying && !state.playing) { state.playing = true; send('gameplayStart'); }
}

/** main.js, at start: fetch the SDK and initialise it; resolves either way */
export function pokiInit() {
  if (!POKI) return Promise.resolve(false);
  const install = document.getElementById('opt-install'); if (install) install.style.display = 'none';   // no "install as an app" on Poki (kept in the DOM: main.js toggles its hidden flag)
  if (window.__pokiInit) return window.__pokiInit.then(ok => { if (ok && window.PokiSDK) { state.ready = true; note('init'); flush(); } return !!ok; });   // the head did it
  return new Promise(res => {
    const s = document.createElement('script'); s.src = SDK_URL; s.async = true;
    s.onload = () => { const P = window.PokiSDK; if (!P) return res(false); P.init().then(() => { state.ready = true; note('init'); flush(); res(true); }, () => res(false)); };
    s.onerror = () => res(false);
    document.head.appendChild(s);
  });
}
/** loading.js: the loading screen is gone and the menu is up */
export function pokiLoaded() { if (!POKI) return; wantLoaded = true; flush(); }
/** title.js: the player is in the town (menu closed) */
export function pokiPlay() { if (!POKI) return; wantPlaying = true; flush(); }
/** main.js when the page opened straight into a town (after Play on another town or Raise the island, which reload): play
 *  starts with no menu to close, so the start is reported on the player's first click or key, as Poki requires */
export function pokiPlayOnInteraction() {
  if (!POKI) return;
  const once = () => { removeEventListener('pointerdown', once, true); removeEventListener('keydown', once, true); pokiPlay(); };
  addEventListener('pointerdown', once, true); addEventListener('keydown', once, true);
}
/** title.js: a menu covers the town */
export function pokiPause() { if (!POKI) return; wantPlaying = false; if (state.playing) { state.playing = false; send('gameplayStop'); } }
/** before play resumes from a menu: a commercial break with the music muted; resolves when it is over (at once without the SDK) */
export function pokiBreak() {
  const P = sdk(); if (!P || state.playing) return Promise.resolve();   // breaks only while play is stopped, as Poki asks
  note('commercialBreak'); setMuted(true);
  return Promise.resolve(P.commercialBreak(() => setMuted(true))).catch(() => {}).then(() => setMuted(false));
}
export const pokiState = () => ({ ...state, poki: POKI });
