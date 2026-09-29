// Komachi — the main menu: a full-screen page over a still picture of the island (assets/backgrounds), never the live town, which
// stops drawing while the menu is up. A column on the left holds the logo and one page at a time: the menu itself (Continue or
// Resume, New town, Load town, Settings, How to play, Exit in the installed app), the new-town form, the towns you keep, the
// settings (the Settings card's own controls, moved in while the page is open) and how to play. The card at the foot shows the
// town being played. Opening another town or raising another island reloads the page, because the island is built from its
// seed when the page loads.
import { S } from './state.js';
import { save, holdSaves, requestThumb, saveStatus } from './save.js';
import { listSlots, activeId, setActive, newSlot, renameSlot, deleteSlot, scratch, readSlot, writeSlot } from './slots.js';
import { BIOMES } from './biome.js';
import { toast } from './toast.js';
import wordmarkUrl from '../assets/brand/komachi-wordmark.png';   // the user's wordmark with its tagline (trimmed from komachi-wordmark-reference.png)
import bgUrl from '../assets/backgrounds/komachi-menu-game.jpg';
import pkg from '../package.json';
import { listPhotos, countPhotos, updatePhoto, deletePhoto, deleteTownPhotos } from './album.js';

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
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'town';
/** the pause card's line: when the town was last saved, or that it could not be */
function savedLine() {
  const st = saveStatus(); if (st.ok === null) return '';
  return st.ok ? `<span class="mm-saved"><i class="fa-solid fa-check"></i> Saved ${ago(st.at)}</span>` : '<span class="mm-saved warn"><i class="fa-solid fa-triangle-exclamation"></i> Not saved: storage full</span>';
}

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
let mode = null, wasSpeed = 1, hooks = { townIsFresh: () => false, onStart: () => {} }, optionsHome = null, photos = [];
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
  park(); root.dataset.screen = screen; page.scrollTop = 0; const focusFirst = () => { const b = page.querySelector('.mm-btn, .mm-cta, .mm-shot, .mm-link, button:not([data-act="back"])') || page.querySelector('button'); if (b && !matchMedia('(pointer: coarse)').matches) b.focus({ preventScroll: true }); };
  const here = listSlots().find(s => s.id === activeId()), playing = mode === 'pause';
  cardEl.hidden = screen !== 'main'; if (screen === 'main') saveCard();
  if (screen === 'main') {
    const season = s => s && s.season ? ' · ' + s.season[0].toUpperCase() + s.season.slice(1) : '';
    const first = playing ? row('resume', 'fa-play', 'Resume', here ? `${esc(here.name)} · day ${Math.floor(S.T / 24) + 1}` : '', 'main')
      : here && !here.fresh ? row('continue', 'fa-play', 'Continue', `${esc(here.name)} · day ${here.day}${season(here)}`, 'main')
      : row('start', 'fa-seedling', 'Start on this island', `${esc(biomeName(S.biome))} · seed ${S.seed}`, 'main');
    const help = `<button class="mm-link" data-act="help"><i class="fa-solid fa-book-open"></i> How to play</button>`;
    page.innerHTML = playing
      ? `<div class="mm-pause-head"><i class="fa-solid fa-pause"></i><b>Paused</b>${savedLine()}</div><div class="mm-list">${row('resume', 'fa-play', 'Resume', '', 'main')}${row('album', 'fa-images', 'Album')}${row('settings', 'fa-gear', 'Settings')}${row('credits', 'fa-heart', 'Credits')}${row('title', 'fa-house-chimney', 'Save and quit to title')}</div>`
      : `<div class="mm-list">${first}${row('new', 'fa-city', 'New town', 'a fresh town on another island')}${row('towns', 'fa-folder-open', 'Load town', listSlots().length ? `${listSlots().length} kept` : '')}
        ${here && !here.fresh ? row('album', 'fa-images', 'Album', 'photos of this town') : ''}${row('settings', 'fa-gear', 'Settings')}${row('credits', 'fa-heart', 'Credits')}${row('help', 'fa-book-open', 'How to play', '', 'desk-only')}${standalone ? row('exit', 'fa-arrow-right-from-bracket', 'Exit') : ''}</div>${help.replace('mm-link', 'mm-link phone-only')}`;
    countPhotos(activeId()).then(n => { const s = page.querySelector('[data-act="album"] small'); if (s && root.dataset.screen === 'main') s.textContent = n ? `${n} photo${n === 1 ? '' : 's'}` : 'photos of this town'; });
  } else if (screen === 'towns') {
    const list = listSlots().sort((a, b) => b.savedAt - a.savedAt);
    page.innerHTML = `<div class="mm-head">${back()}<b>Load town</b></div><div class="mm-towns">${list.map(s => `<div class="mm-town${s.id === activeId() ? ' on' : ''}" data-id="${esc(s.id)}">
        <div class="mm-thumb sm"${s.thumb ? ` style="background-image:url('${s.thumb}')"` : ''}>${s.thumb ? '' : `<span class="sw">${swatch(s.biome)}</span>`}</div>
        <span class="mm-town-t"><b>${esc(s.name)}</b><small>${esc(biomeName(s.biome))} · day ${s.day} · ${s.pop} living here · ${ago(s.savedAt)}</small></span>
        <span class="mm-town-b">${s.id === activeId() ? '<em>playing</em>' : `<button class="mm-cta" data-act="play">Play</button>`}<button class="icon-btn" data-act="rename" aria-label="Rename" data-tip="Rename"><i class="fa-solid fa-pen"></i></button><button class="icon-btn" data-act="export" aria-label="Export as a file" data-tip="Export as a file"><i class="fa-solid fa-file-export"></i></button><button class="icon-btn warn" data-act="delete" aria-label="Delete" data-tip="Delete"><i class="fa-solid fa-trash-can"></i></button></span></div>`).join('') || '<p class="mm-empty">No towns yet: start one from New town.</p>'}</div>
      <div class="mm-import"><button class="mm-link" data-act="import"><i class="fa-solid fa-file-import"></i> Import a town from a file</button><small>Exports keep the town, not its photos</small><input type="file" id="m-import" accept=".json,application/json" hidden></div>`;
  } else if (screen === 'new') {
    page.innerHTML = `<div class="mm-head">${back()}<b>New town</b></div>
      <label class="mm-field"><span>Town name</span><input id="m-name" maxlength="40" value="${esc(PLACE[Math.floor(Math.random() * PLACE.length)] + ' Town')}"></label>
      <label class="mm-field"><span>Island seed<small>the same seed always raises the same island</small></span><span class="mm-seed"><input id="m-seed" inputmode="numeric" value="${Math.floor(Math.random() * 1e9) + 1}"><button class="icon-btn" data-act="dice" aria-label="Another seed" data-tip="Another seed"><i class="fa-solid fa-dice"></i></button></span></label>
      <div class="mm-field"><span>Island theme</span><div class="mm-biomes">${Object.values(BIOMES).map((b, k) => `<button class="mm-biome${k === 0 ? ' on' : ''}" data-biome="${b.id}"><span class="sw">${swatch(b.id)}</span><b>${esc(b.name)}</b></button>`).join('')}</div></div>
      <button class="mm-cta big" data-act="create"><i class="fa-solid fa-seedling"></i> Raise the island</button>`;
  } else if (screen === 'album') {   // the photos of the town being played (src/album.js), newest first; a tap opens the viewer
    const head = `<div class="mm-head">${back()}<b>Album</b></div>`;
    page.innerHTML = `${head}<p class="mm-empty">Looking through the album…</p>`;
    listPhotos(activeId()).then(list => {
      if (root.dataset.screen !== 'album') return; photos = list;
      page.innerHTML = head + (list.length ? `<div class="mm-album">${list.map(p => `<button class="mm-shot" data-act="shot" data-id="${esc(p.id)}" style="background-image:url('${p.data}')" aria-label="${esc(p.caption)}"><span>Day ${p.day} · ${clock(p.hour)}</span></button>`).join('')}</div>`
        : `<p class="mm-empty">No photos yet. Press <kbd>P</kbd> or the camera button in the top bar, frame the town and take one.</p>`);
      focusFirst();
    });
  } else if (screen === 'settings') {   // the Settings card's own controls, shown as a page of the menu
    if (!optionsHome) optionsHome = { parent: options.parentNode, next: options.nextSibling };
    page.innerHTML = `<div class="mm-head">${back()}<b>Settings</b></div>`; page.appendChild(options); options.classList.add('in-menu');
    options.dispatchEvent(new Event('menu-show'));
  } else if (screen === 'credits') {
    page.innerHTML = `<div class="mm-head">${back()}<b>Credits</b></div><div class="mm-help mm-credits">
      <p><b>Komachi</b><br>A little town made with care. Thank you for spending time here.</p>
      <p><b>Character, vehicle &amp; watercraft models</b><br><a href="https://kenney.nl" target="_blank" rel="noopener noreferrer">Kenney</a> — Mini Characters, Car Kit and Watercraft Kit (CC0). Some models are adapted for Komachi.</p>
      <p><b>Custom models &amp; development assistance</b><br>OpenAI Codex</p>
      <p><b>Procedural buildings &amp; development assistance</b><br>Claude by Anthropic</p>
      <p><b>Music &amp; recorded sound</b><br>From the creators at <a href="https://freesound.org/" target="_blank" rel="noopener noreferrer">Freesound</a>.</p>
      <p><b>Completion sound</b><br>Original synthesised party pop and chime, made for Komachi.</p>
      <p>Thank you to the asset creators and everyone who visits this little island.</p></div>`;
  } else if (screen === 'help') {
    page.innerHTML = `<div class="mm-head">${back()}<b>How to play</b></div><div class="mm-help">
      <p><b>Streets first.</b> Choose <kbd>Streets</kbd> (5) and drag to draw a street from the station ring. Everything is built beside a street.</p>
      <p><b>Zone blocks.</b> Pick Homes (2), Shops (3), Work (4), Civic (8) or Farms (9) and drag across one to three cells beside a street. The strip above the tools lets you choose exactly which building; Auto lets the town decide.</p>
      <p><b>Watch it grow.</b> Builders arrive by train and work in daylight, three crews at a time. Newcomers come by train and move in; residents find work, shop, stroll, fish, and go to the bath house in the evening.</p>
      <p><b>Look closer.</b> Hover or tap anything to see who lives, works or waits there. Click a name to follow someone. Nothing can go wrong: an empty home simply waits for its family.</p>
      <p><b>Around the island.</b> Drag to pan, scroll or pinch to zoom, <kbd>Q</kbd> / <kbd>E</kbd> to turn the camera, <kbd>R</kbd> turns a building, <kbd>Esc</kbd> opens this menu.</p></div>
      ${mode === 'pause' ? `<button class="mm-link" data-act="replay"><i class="fa-solid fa-train-subway"></i> Watch the opening again</button>` : ''}`;
  }
  focusFirst();
}
function open(kind) {
  if (!mode) { wasSpeed = S.speed || 1; S.speed = 0; if (kind === 'pause') { requestThumb(); if (activeId()) save(); } }   // pausing saves, so the card's "Saved" line is true
  options.classList.remove('show'); document.getElementById('btn-options').classList.remove('on');   // the in-game Settings card gives way to the menu
  mode = kind; root.classList.add('show'); setLayout(); show('main');
}
function close() { park(); mode = null; root.classList.remove('show', 'pause'); document.body.classList.remove('menu-full', 'menu-pause'); S.speed = wasSpeed; }
/** the menu's own dialog in place of prompt/confirm: a title, an optional line and text field, Cancel and the action; resolves
 *  with the text (or true) on OK and null on Cancel, Esc or a click outside */
let dlg = null;
function ask({ title, text = '', input = null, ok = 'OK', danger = false }) {
  return new Promise(resolve => {
    if (!dlg) { dlg = document.createElement('div'); dlg.id = 'mm-dialog'; root.appendChild(dlg); }
    dlg.innerHTML = `<div class="mm-dlg"><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}${input !== null ? `<input id="mm-dlg-in" type="text" maxlength="40" value="${esc(input)}">` : ''}<div class="mm-dlg-b"><button data-dlg="no">Cancel</button><button data-dlg="ok"${danger ? ' class="warn"' : ''}>${esc(ok)}</button></div></div>`;
    dlg.classList.add('show'); const inp = dlg.querySelector('#mm-dlg-in'); if (inp) { inp.focus(); inp.select(); } else dlg.querySelector('[data-dlg="ok"]').focus();
    const end = v => { dlg.classList.remove('show'); dlg.onclick = null; dlg.onkeydown = null; resolve(v); };
    dlg.onclick = e => { e.stopPropagation(); const b = e.target.closest('[data-dlg]'); if (b) end(b.dataset.dlg === 'ok' ? (inp ? inp.value : true) : null); else if (e.target === dlg) end(null); };
    dlg.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); end(inp ? inp.value : true); } else if (e.key === 'Escape') end(null); };
  });
}
/** the album's viewer: the photo large over the menu with its caption, Save to device, Caption, Delete and Close */
let viewer = null;
const fileName = p => `komachi-${p.caption.split(' · ')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'town'}-day${p.day}-${clock(p.hour).replace(':', '')}.jpg`;
function viewPhoto(p) {
  if (!viewer) { viewer = document.createElement('div'); viewer.id = 'mm-photo'; root.appendChild(viewer); }
  viewer.innerHTML = `<div class="mm-ph"><img src="${p.data}" alt="${esc(p.caption)}"><div class="mm-ph-t"><b>${esc(p.caption)}</b><span class="mm-ph-b">
    <button data-ph="save"><i class="fa-solid fa-download"></i> Save to device</button><button data-ph="caption"><i class="fa-solid fa-pen"></i> Caption</button><button data-ph="delete" class="warn"><i class="fa-solid fa-trash-can"></i> Delete</button><button data-ph="close"><i class="fa-solid fa-xmark"></i> Close</button></span></div></div>`;
  viewer.classList.add('show');
  const end = () => { viewer.classList.remove('show'); viewer.onclick = null; removeEventListener('keydown', onKey, true); };
  const onKey = e => { if (e.code === 'Escape' && !(dlg && dlg.classList.contains('show'))) { e.stopPropagation(); e.preventDefault(); end(); } };
  viewer.onclick = e => {
    e.stopPropagation(); const b = e.target.closest('[data-ph]'); const act = b ? b.dataset.ph : e.target === viewer ? 'close' : null;
    if (act === 'close') end();
    else if (act === 'save') { const a = document.createElement('a'); a.href = p.data; a.download = fileName(p); a.click(); }
    else if (act === 'caption') ask({ title: 'Caption', input: p.caption, ok: 'Keep' }).then(c => { if (c && c.trim()) { p.caption = c.trim().slice(0, 80); updatePhoto(p.id, { caption: p.caption }); viewer.querySelector('.mm-ph-t b').textContent = p.caption; } });
    else if (act === 'delete') ask({ title: 'Delete this photo?', text: 'It cannot be brought back.', ok: 'Delete', danger: true }).then(yes => { if (!yes) return; deletePhoto(p.id).then(() => { end(); if (root.dataset.screen === 'album') show('album'); }); });
  };
  addEventListener('keydown', onKey, true);
}
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
  else if (act === 'new' || act === 'towns' || act === 'settings' || act === 'help' || act === 'album' || act === 'credits') show(act);
  else if (act === 'shot') { const p = photos.find(x => x.id === b.dataset.id); if (p) viewPhoto(p); }
  else if (act === 'back') show('main');
  else if (act === 'replay') { close(); if (hooks.onReplay) hooks.onReplay(); }
  else if (act === 'title' || act === 'exit') {   // both save first; only a failed save asks before going on
    const go = () => { if (act === 'exit') window.close(); else { mode = 'title'; setLayout(); show('main'); } };
    if (save()) { if (act === 'title') toast('Saved'); go(); }
    else ask({ title: 'Could not save', text: 'The browser storage is full or blocked, so the changes since the last save would be lost. Go on anyway?', ok: act === 'exit' ? 'Exit anyway' : 'Quit anyway', danger: true }).then(y => { if (y) go(); });
  }
  else if (act === 'export' && id) {   // the town's snapshot as a JSON file (the playing town is saved first)
    if (id === activeId()) save();
    const d = readSlot(id), s = listSlots().find(x => x.id === id); if (!d) { toast('Nothing saved for this town yet'); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ komachi: 1, name: s ? s.name : 'Komachi', town: d })], { type: 'application/json' }));
    a.download = `komachi-${slug(s ? s.name : 'town')}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  else if (act === 'import') root.querySelector('#m-import').click();
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
  else if (act === 'rename' && id) { const s = listSlots().find(x => x.id === id); ask({ title: 'Rename the town', input: s ? s.name : '', ok: 'Rename' }).then(n => { if (n && n.trim()) { renameSlot(id, n.trim()); show('towns'); } }); }
  else if (act === 'delete' && id) { const s = listSlots().find(x => x.id === id); ask({ title: `Delete ${s ? s.name : 'this town'}?`, text: 'It cannot be brought back.', ok: 'Delete', danger: true }).then(yes => { if (!yes) return; const playing = id === activeId(); deleteSlot(id); deleteTownPhotos(id); if (playing) reloadInto('title'); else show('towns'); }); }
});

/** an exported file chosen: it becomes a new kept town (the one being played stays the active one) */
root.addEventListener('change', e => {
  if (e.target.id !== 'm-import') return; const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  f.text().then(t => {
    const j = JSON.parse(t), d = j && j.town ? j.town : j;
    if (!d || !(d.v >= 1 && d.v <= 3) || !Array.isArray(d.blocks) || d.seed === undefined) throw new Error('shape');
    const was = activeId(), id = newSlot(String(j.name || f.name.replace(/\.json$/i, '') || 'Imported town').slice(0, 40), d.seed, d.biome || 'suburban');
    writeSlot(id, d); if (was && !scratch) setActive(was);
    toast('Town imported'); show('towns');
  }).catch(() => toast('That file is not a Komachi town'));
});
/** keyboard: arrows move between the page's buttons (Esc comes through menuEscape from input.js) */
root.addEventListener('keydown', e => {
  if ((dlg && dlg.classList.contains('show')) || (viewer && viewer.classList.contains('show'))) return;
  if (e.target.tagName === 'INPUT' && e.key !== 'Escape') return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const f = [...page.querySelectorAll('button, input')].filter(x => x.offsetParent !== null && !x.disabled); if (!f.length) return;
    e.preventDefault(); e.stopPropagation(); const i = f.indexOf(document.activeElement); f[(i + (e.key === 'ArrowDown' ? 1 : -1) + f.length) % f.length].focus();
  }
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
const menuMode = () => mode;
/** Esc from input.js: a subpage goes back to the main page; the main page closes the pause card (the title page stays) */
function menuEscape() { if ((dlg && dlg.classList.contains('show')) || (viewer && viewer.classList.contains('show'))) return; if (root.dataset.screen !== 'main') show('main'); else if (mode === 'pause') close(); }
export { initMenus, open as openMenu, close as closeMenu, isOpen as menuOpen, menuMode, menuEscape, openNew, viewPhoto };
