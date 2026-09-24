// Komachi — the main menu: a full-screen page over a still picture of the island (assets/backgrounds), never the live town, which
// stops drawing while the menu is up. A column on the left holds the logo and one page at a time: the menu itself (Continue or
// Resume, New town, Load town, Settings, How to play, Exit in the installed app), the new-town form, the towns you keep, the
// settings (the Settings card's own controls, moved in while the page is open) and how to play. The card at the foot shows the
// town being played. Opening another town or raising another island reloads the page, because the island is built from its
// seed when the page loads.
import { S } from './state.js';
import { save, holdSaves, requestThumb } from './save.js';
import { listSlots, activeId, setActive, newSlot, renameSlot, deleteSlot, scratch } from './slots.js';
import { BIOMES } from './biome.js';
import { toast } from './toast.js';
import wordmarkUrl from '../assets/brand/komachi-wordmark.png';   // the user's wordmark with its tagline (trimmed from komachi-wordmark-reference.png)
import bgUrl from '../assets/backgrounds/komachi-menu.jpg';
import pkg from '../package.json';

const root = document.getElementById('menu');
const PLACE = ['Hinata', 'Minato', 'Kogane', 'Sakurazaka', 'Umibe', 'Aozora', 'Tsukimi', 'Hoshino', 'Kawabe', 'Midori', 'Nagisa', 'Asahi'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 2 ? 'just now' : m < 60 ? `${m} min ago` : m < 60 * 24 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`; };
const clock = h => `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
const biomeName = id => (BIOMES[id] || BIOMES.suburban).name;
const swatch = id => (BIOMES[id] || BIOMES.suburban).treeColors.map(c => `<i style="background:${c}"></i>`).join('');
const standalone = (() => { try { return matchMedia('(display-mode: standalone)').matches; } catch { return false; } })();
const row = (act, icon, label, sub = '', cls = '') => `<button class="mm-btn ${cls}" data-act="${act}"><i class="fa-solid ${icon}"></i><span class="mm-l"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><i class="fa-solid fa-chevron-right mm-go"></i></button>`;
const back = () => '<button class="icon-btn" data-act="back" aria-label="Back"><i class="fa-solid fa-arrow-left"></i></button>';

root.innerHTML = `<div class="mm-bg" style="background-image:url('${bgUrl}')"></div>
  <div class="mm-side">
    <h1 class="mm-logo"><img src="${wordmarkUrl}" alt="Komachi: small cities, brighter tomorrows" width="820" height="318"></h1>
    <p class="mm-blurb">Draw a few streets, zone homes and shops, and watch a little town find its rhythm.</p>
    <div class="mm-page"></div>
    <div class="mm-card"></div>
    <div class="mm-foot"><span>v${esc(pkg.version)} · a cosy town on an island</span><span class="mm-foot-motto">People. Places. Small moments.</span></div>
  </div>
  <div class="mm-slogan">A kinder town<br>grows here.</div>
  <div class="mm-motto">People. Places. Small moments.</div>`;
const page = root.querySelector('.mm-page'), cardEl = root.querySelector('.mm-card'), options = document.getElementById('options');
let mode = null, wasSpeed = 1, hooks = { townIsFresh: () => false, onStart: () => {} }, optionsHome = null;
const isOpen = () => !!mode;

function saveCard() {
  const s = listSlots().find(x => x.id === activeId());
  if (!s || s.fresh) { cardEl.hidden = true; return; }
  cardEl.hidden = false;
  cardEl.innerHTML = `<div class="mm-thumb"${s.thumb ? ` style="background-image:url('${s.thumb}')"` : ''}>${s.thumb ? '' : `<span class="sw">${swatch(s.biome)}</span>`}</div>
    <div class="mm-card-t"><b>${esc(s.name)}</b><small>Day ${s.day}${s.season ? ` · ${s.season[0].toUpperCase() + s.season.slice(1)}` : ''}${s.time !== undefined ? ` · ${clock(s.time)}` : ''}</small>
    <span class="mm-stats"><span data-tip="People living here"><i class="fa-solid fa-user"></i>${s.pop}</span><span data-tip="Finished homes"><i class="fa-solid fa-house"></i>${s.homes ?? 0}</span><span data-tip="People in work"><i class="fa-solid fa-briefcase"></i>${s.jobs ?? 0}</span><span data-tip="Trains so far"><i class="fa-solid fa-train-subway"></i>${s.trains ?? 0}</span></span></div>`;
}
function park() { if (optionsHome && options.parentNode !== optionsHome.parent) { optionsHome.parent.insertBefore(options, optionsHome.next); options.classList.remove('in-menu'); } }
function show(screen) {
  park(); root.dataset.screen = screen; page.scrollTop = 0;
  const here = listSlots().find(s => s.id === activeId()), playing = mode === 'pause';
  cardEl.hidden = screen !== 'main'; if (screen === 'main') saveCard();
  if (screen === 'main') {
    const season = s => s && s.season ? ' · ' + s.season[0].toUpperCase() + s.season.slice(1) : '';
    const first = playing ? row('resume', 'fa-play', 'Resume', here ? `${esc(here.name)} · day ${Math.floor(S.T / 24) + 1}` : '', 'main')
      : here && !here.fresh ? row('continue', 'fa-play', 'Continue', `${esc(here.name)} · day ${here.day}${season(here)}`, 'main')
      : row('start', 'fa-seedling', 'Start on this island', `${esc(biomeName(S.biome))} · seed ${S.seed}`, 'main');
    const help = `<button class="mm-link" data-act="help"><i class="fa-solid fa-book-open"></i> How to play</button>`;
    page.innerHTML = playing
      ? `<div class="mm-pause-head"><i class="fa-solid fa-pause"></i><b>Paused</b></div><div class="mm-list">${row('resume', 'fa-play', 'Resume', '', 'main')}${row('settings', 'fa-gear', 'Settings')}${row('title', 'fa-house-chimney', 'Save and quit to title')}</div>`
      : `<div class="mm-list">${first}${row('new', 'fa-city', 'New town', 'a fresh town on another island')}${row('towns', 'fa-folder-open', 'Load town', listSlots().length ? `${listSlots().length} kept` : '')}
        ${row('settings', 'fa-gear', 'Settings')}${row('help', 'fa-book-open', 'How to play', '', 'desk-only')}${standalone ? row('exit', 'fa-arrow-right-from-bracket', 'Exit') : ''}</div>${help.replace('mm-link', 'mm-link phone-only')}`;
  } else if (screen === 'towns') {
    const list = listSlots().sort((a, b) => b.savedAt - a.savedAt);
    page.innerHTML = `<div class="mm-head">${back()}<b>Load town</b></div><div class="mm-towns">${list.map(s => `<div class="mm-town${s.id === activeId() ? ' on' : ''}" data-id="${esc(s.id)}">
        <div class="mm-thumb sm"${s.thumb ? ` style="background-image:url('${s.thumb}')"` : ''}>${s.thumb ? '' : `<span class="sw">${swatch(s.biome)}</span>`}</div>
        <span class="mm-town-t"><b>${esc(s.name)}</b><small>${esc(biomeName(s.biome))} · day ${s.day} · ${s.pop} living here · ${ago(s.savedAt)}</small></span>
        <span class="mm-town-b">${s.id === activeId() ? '<em>playing</em>' : `<button class="mm-cta" data-act="play">Play</button>`}<button class="icon-btn" data-act="rename" aria-label="Rename" data-tip="Rename"><i class="fa-solid fa-pen"></i></button><button class="icon-btn warn" data-act="delete" aria-label="Delete" data-tip="Delete"><i class="fa-solid fa-trash-can"></i></button></span></div>`).join('') || '<p class="mm-empty">No towns yet: start one from New town.</p>'}</div>`;
  } else if (screen === 'new') {
    page.innerHTML = `<div class="mm-head">${back()}<b>New town</b></div>
      <label class="mm-field"><span>Town name</span><input id="m-name" maxlength="40" value="${esc(PLACE[Math.floor(Math.random() * PLACE.length)] + ' Town')}"></label>
      <label class="mm-field"><span>Island seed<small>the same seed always raises the same island</small></span><span class="mm-seed"><input id="m-seed" inputmode="numeric" value="${Math.floor(Math.random() * 1e9) + 1}"><button class="icon-btn" data-act="dice" aria-label="Another seed" data-tip="Another seed"><i class="fa-solid fa-dice"></i></button></span></label>
      <div class="mm-field"><span>Island theme</span><div class="mm-biomes">${Object.values(BIOMES).map((b, k) => `<button class="mm-biome${k === 0 ? ' on' : ''}" data-biome="${b.id}"><span class="sw">${swatch(b.id)}</span><b>${esc(b.name)}</b></button>`).join('')}</div></div>
      <button class="mm-cta big" data-act="create"><i class="fa-solid fa-seedling"></i> Raise the island</button>`;
  } else if (screen === 'settings') {   // the Settings card's own controls, shown as a page of the menu
    if (!optionsHome) optionsHome = { parent: options.parentNode, next: options.nextSibling };
    page.innerHTML = `<div class="mm-head">${back()}<b>Settings</b></div>`; page.appendChild(options); options.classList.add('in-menu');
    options.dispatchEvent(new Event('menu-show'));
  } else if (screen === 'help') {
    page.innerHTML = `<div class="mm-head">${back()}<b>How to play</b></div><div class="mm-help">
      <p><b>Streets first.</b> Choose <kbd>Streets</kbd> (5) and drag to draw a street from the station ring. Everything is built beside a street.</p>
      <p><b>Zone blocks.</b> Pick Homes (2), Shops (3), Work (4), Civic (8) or Farms (9) and drag across one to three cells beside a street. The strip above the tools lets you choose exactly which building; Auto lets the town decide.</p>
      <p><b>Watch it grow.</b> Builders arrive by train and work in daylight, three crews at a time. Newcomers come by train and move in; residents find work, shop, stroll, fish, and go to the bath house in the evening.</p>
      <p><b>Look closer.</b> Hover or tap anything to see who lives, works or waits there. Click a name to follow someone. Nothing can go wrong: an empty home simply waits for its family.</p>
      <p><b>Around the island.</b> Drag to pan, scroll or pinch to zoom, <kbd>Q</kbd> / <kbd>E</kbd> to turn the camera, <kbd>R</kbd> turns a building, <kbd>Esc</kbd> opens this menu.</p></div>`;
  }
}
function open(kind) {
  if (!mode) { wasSpeed = S.speed || 1; S.speed = 0; if (kind === 'pause') requestThumb(); }
  options.classList.remove('show'); document.getElementById('btn-options').classList.remove('on');   // the in-game Settings card gives way to the menu
  mode = kind; root.classList.add('show'); setLayout(); show('main');
}
function close() { park(); mode = null; root.classList.remove('show', 'pause'); document.body.classList.remove('menu-full', 'menu-pause'); S.speed = wasSpeed; }
/** the title is the full page over the island picture; the pause menu a small card over the paused town */
function setLayout() { const p = mode === 'pause'; root.classList.toggle('pause', p); document.body.classList.toggle('menu-full', !p); document.body.classList.toggle('menu-pause', p); }
function reloadInto(enter) { holdSaves(); try { sessionStorage.setItem('komachi.enter', enter); } catch { /* no session storage */ } location.href = location.pathname; }

root.addEventListener('click', e => {
  const b = e.target.closest('[data-act], [data-biome]'); if (!b || options.contains(b)) return;
  if (b.dataset.biome) { root.querySelectorAll('.mm-biome').forEach(x => x.classList.toggle('on', x === b)); return; }
  const act = b.dataset.act, rowEl = b.closest('.mm-town'), id = rowEl && rowEl.dataset.id;
  if (act === 'continue' || act === 'resume') close();
  else if (act === 'start') { newSlot(PLACE[S.seed % PLACE.length] + ' Town', S.seed, S.biome); close(); hooks.onStart(); save(); }
  else if (act === 'save') { toast(save() ? 'Saved' : 'Could not save: the browser storage is full'); saveCard(); }
  else if (act === 'new' || act === 'towns' || act === 'settings' || act === 'help') show(act);
  else if (act === 'back') show('main');
  else if (act === 'title') { toast(save() ? 'Saved' : 'Could not save'); mode = 'title'; setLayout(); show('main'); }
  else if (act === 'exit') { save(); window.close(); }
  else if (act === 'dice') root.querySelector('#m-seed').value = Math.floor(Math.random() * 1e9) + 1;
  else if (act === 'create') {
    const name = root.querySelector('#m-name').value.trim() || 'New town', seed = parseInt(root.querySelector('#m-seed').value, 10) || (Math.floor(Math.random() * 1e9) + 1);
    const biome = root.querySelector('.mm-biome.on')?.dataset.biome || 'suburban';
    if (!scratch && activeId() && !hooks.townIsFresh()) save();   // keep the town you are leaving
    newSlot(name, seed, biome);
    if (seed === S.seed && biome === S.biome && hooks.townIsFresh()) { close(); hooks.onStart(); save(); }   // this very island, still empty
    else reloadInto('new');
  }
  else if (act === 'play' && id) { save(); setActive(id); reloadInto('continue'); }
  else if (act === 'rename' && id) { const s = listSlots().find(x => x.id === id), n = prompt('Rename the town', s ? s.name : ''); if (n && n.trim()) { renameSlot(id, n.trim()); show('towns'); } }
  else if (act === 'delete' && id) { const s = listSlots().find(x => x.id === id); if (confirm(`Delete ${s ? s.name : 'this town'}? It cannot be brought back.`)) { const playing = id === activeId(); deleteSlot(id); if (playing) reloadInto('title'); else show('towns'); } }
});

/** main.js, once the town is up: the menu on a plain visit, straight in after choosing a town or an island (and in test tabs) */
function initMenus(h) {
  hooks = { ...hooks, ...h };
  let enter = null; try { enter = sessionStorage.getItem('komachi.enter'); sessionStorage.removeItem('komachi.enter'); } catch { /* no session storage */ }
  document.getElementById('btn-menu').addEventListener('click', () => (isOpen() ? close() : open('pause')));
  if (scratch || (enter && enter !== 'title')) return enter;
  open('title'); return 'title';
}
/** the new-town page, from anywhere (the Settings card's button) */
const openNew = () => { if (!mode) open('pause'); show('new'); };
export { initMenus, open as openMenu, close as closeMenu, isOpen as menuOpen, openNew };
