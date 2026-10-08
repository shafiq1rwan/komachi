// Komachi — Guided Town goals beneath the statistics, a compact floating level indicator, and earned unlock reveals featuring
// the real building models. The chapter book, level overview, tool pulse and soft cell cues give direction without covering
// the town. Ordinary world milestones remain separate from the central level reward reveal.
// Reads progress.js; never scans the world itself. Rebuilds its DOM only when the cue changes, never every frame.
import * as THREE from 'three';
import { scene, cam, cx, cz } from './scene.js';
import { toast } from './toast.js';
import { playCompletionSound, playLevelUpSound } from './audio.js';
import { CHAPTERS, GOALS, LEVELS, MAX_LEVEL, levelRewards, levelOf, nextGoal, nextLevelProgress } from './progression.js';
import { buildingThumbnail, selectBuilding } from './picker.js';
import { onProgress, progressState, activeCue, isGuided, setCollapsed, chooseActiveGoal, levelsOverview, currentFacts, switchToFreeBuild, canBuild } from './progress.js';
import { KIND_LABEL } from './world.js';

let root = null, pill = null, cueKey = '', hooks = { setTool: () => {}, jetty: () => null }, pulseTool = null;
const KIND_WORD = k => KIND_LABEL[k] || { detached: 'House', narrow: 'Narrow house', terrace: 'Terrace homes', office: 'Office', studio: 'Studio', workshop: 'Workshop', konbini: 'Konbini', bakery: 'Bakery', ramen: 'Ramen shop', cafe: 'Café', grocery: 'Grocery', community: 'Community centre', fishing: 'Fishing at the quay' }[k] || k;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const blocked = () => document.hidden || ['opening', 'menu-full', 'menu-pause', 'photo', 'fishing', 'trailer', 'demo-wall'].some(c => document.body.classList.contains(c));
let hudCelebrating = false;

/** main.js: build the card; hooks.setTool picks a tool, hooks.jetty() gives the jetty head { x, z } or null */
export function initGoalUi(h = {}) {
  Object.assign(hooks, h);
  if (!isGuided()) return;
  root = document.createElement('section'); root.id = 'goals'; root.setAttribute('aria-live', 'polite'); document.body.appendChild(root);
  pill = document.createElement('button'); pill.id = 'goals-pill'; pill.type = 'button'; pill.innerHTML = '<i class="fa-solid fa-flag"></i><span>Current goal</span>'; document.body.appendChild(pill);
  pill.addEventListener('click', () => { setCollapsed(false); render(true); });
  document.getElementById('level-hud')?.addEventListener('click', () => { setCollapsed(false); root.classList.toggle('levels'); render(true); });
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-g]'); if (!b) return; const act = b.dataset.g;
    if (act === 'collapse') { setCollapsed(true); render(true); }
    else if (act === 'where') lookAt();
    else if (act === 'book') { root.classList.toggle('book'); }
    else if (act === 'levels') { root.classList.toggle('levels'); renderLevels(); }
    else if (act === 'pick') { chooseActiveGoal(b.dataset.id); render(true); }
    else if (act === 'tool') { hooks.setTool(b.dataset.tool); dismissCelebration(); }
    else if (act === 'jetty') { const j = hooks.jetty(); if (j) { cam.target.set(j.x, 0, j.z); cam.tView = 6; } dismissCelebration(); }
    else if (act === 'ok') dismissCelebration();
    else if (act === 'free') { if (switchToFreeBuild()) toast('Free Build: every building is open now'); }
  });
  onProgress(onEvents);
  const optFree = document.getElementById('opt-free'); if (optFree) optFree.addEventListener('click', () => { if (switchToFreeBuild()) toast('Free Build: every building is open now'); });
  buildCues();
  render(true);
  addEventListener('resize', place);
}
if (document.body.classList.contains('demo')) { /* the demo uses the same card; nothing else to do */ }

// ── the card ──
function renderLevelHud(P) {
  const el = document.getElementById('level-hud'); if (!el) return;
  if (!isGuided()) { el.hidden = true; return; }
  el.hidden = false; if (hudCelebrating) return;
  const p = nextLevelProgress(P, currentFacts());
  el.querySelector('#lh-level').textContent = `Level ${p.level}`;
  el.querySelector('#lh-chapter').textContent = p.next ? `${p.done}/${p.total}` : 'Complete';
  el.querySelector('#lh-fill').style.width = `${Math.round(p.fraction * 100)}%`;
  const label = p.next ? `Level ${p.level}: ${LEVELS[p.level].title}. ${p.done} of ${p.total} goals complete toward Level ${p.next}. View goals and unlocks.` : `Level ${p.level}: all current town goals completed. View achievements.`;
  el.setAttribute('aria-label', label); el.title = label;
}
function render(force = false) {
  const row = document.getElementById('opt-mode'); if (row) row.hidden = !isGuided();
  renderLevelHud(progressState(), isGuided() ? activeCue() : null);
  if (!root) return;
  if (!isGuided()) { root.hidden = true; pill.hidden = true; setPulse(null); setCueCells([]); return; }
  const P = progressState(), cue = activeCue();
  const key = cue ? [cue.id, cue.done, cue.of, cue.status, cue.construction, cue.how, cue.cells.length, cue.cells[0] ? cue.cells[0].i + ',' + cue.cells[0].j : '', P.collapsed, root.classList.contains('book')].join('|') : 'done|' + P.collapsed;
  if (!force && key === cueKey) return; cueKey = key;
  setPulse(cue && !P.collapsed ? cue.tool : null); setCueCells(cue && !P.collapsed ? cue.cells : []);
  if (P.collapsed) { root.hidden = true; pill.hidden = false; return; }
  pill.hidden = true; root.hidden = false;
  const lv = levelOf(P);
  if (!cue) {
    root.innerHTML = `<div class="g-head"><span class="g-ch">TOWN LEVEL ${lv} · ${esc(LEVELS[lv].title.toUpperCase())}</span><button class="g-x" data-g="collapse" aria-label="Collapse"><i class="fa-solid fa-chevron-down"></i></button></div>
      <b class="g-title">Your town is yours to grow</b><span class="g-how">Every building is open. The hill opens at 60 residents.</span>
      <div class="g-actions"><button class="g-btn" data-g="levels"><i class="fa-solid fa-layer-group"></i> Levels</button></div><div class="g-levels"></div>`;
    place(); return;
  }
  const ch = cue.chapter, idx = ch.goals.indexOf(cue.id) + 1, open = ch.goals.filter(g => !P.completedGoalIds.includes(g));
  const bookRows = CHAPTERS.map(c => `<div class="g-bk${c === ch ? ' now' : ''}"><small>${esc(c.title)} · Level ${c.level}</small>${c.goals.map(g => { const done = P.completedGoalIds.includes(g), pickable = c === ch && !ch.sequential && !done && g !== cue.id; return `<button class="g-row${done ? ' done' : g === cue.id ? ' now' : ''}" data-g="${pickable ? 'pick' : 'none'}" data-id="${g}" ${pickable ? '' : 'disabled'}><i class="fa-solid ${done ? 'fa-circle-check' : g === cue.id ? 'fa-circle-dot' : 'fa-circle'}"></i>${esc(GOALS[g].title)}</button>`; }).join('')}</div>`).join('');
  root.innerHTML = `<div class="g-head"><span class="g-ch">${esc(ch.title.toUpperCase())} · ${ch.sequential ? `${idx} OF ${ch.goals.length}` : `${ch.goals.length - open.length} OF ${ch.goals.length} DONE`}</span><span class="g-lv">Lv ${lv}</span><button class="g-x" data-g="collapse" aria-label="Collapse"><i class="fa-solid fa-chevron-down"></i></button></div>
    <b class="g-title">${esc(cue.goal.title)}${cue.of > 1 ? ` <em>${cue.done}/${cue.of}</em>` : ''}</b>
    <span class="g-how">${esc(cue.how)}</span>
    ${cue.status ? `<span class="g-status"><i class="fa-solid fa-person-digging"></i> ${esc(cue.status)}</span>` : `<span class="g-why">${esc(cue.goal.why)}</span>`}
    ${cue.construction !== undefined ? `<div class="g-construction"><span>Construction <b>${cue.construction}%</b></span><div role="progressbar" aria-label="Construction" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cue.construction}"><i style="width:${cue.construction}%"></i></div></div>` : ''}
    <div class="g-actions">${cue.at ? '<button class="g-btn" data-g="where"><i class="fa-solid fa-location-crosshairs"></i> Show me where</button>' : ''}<button class="g-btn ghost" data-g="book"><i class="fa-solid fa-book"></i> Goals</button><button class="g-btn ghost" data-g="levels"><i class="fa-solid fa-layer-group"></i> Levels</button></div>
    <div class="g-next"><small>NEXT LEVEL UNLOCKS</small><span>${esc(LEVELS[Math.min(lv + 1, MAX_LEVEL)].note)}</span></div>
    <div class="g-book">${bookRows}</div><div class="g-levels"></div>`;
  if (root.classList.contains('levels')) renderLevels();
  place();
}
function renderLevels() {
  const el = root.querySelector('.g-levels'); if (!el) return;
  const o = levelsOverview();
  el.innerHTML = o.titles.map((t, lv) => lv ? `<div class="g-lvrow${lv <= o.level ? ' got' : lv === o.level + 1 ? ' next' : ''}"><i class="fa-solid ${lv <= o.level ? 'fa-circle-check' : 'fa-lock'}"></i><b>Level ${lv} · ${esc(t)}</b><small>${esc(o.notes[lv])}${lv === MAX_LEVEL ? ', then every building' : ''}</small></div>` : '').join('') + (o.done ? '' : `<button class="g-btn ghost small" data-g="free"><i class="fa-solid fa-unlock"></i> Switch to Free Build</button>`);
}
/** Anchor goals below the statistics and reserve measured dock/picker space for notifications and mobile inspection. */
function place() {
  if (!root) return;
  const dock = document.getElementById('tools'), r = dock ? dock.getBoundingClientRect() : null;
  const brand = document.getElementById('brand'), details = document.getElementById('stats-details');
  const levelHud = document.getElementById('level-hud');
  const top = Math.round(Math.max(brand?.getBoundingClientRect().bottom || 70, details && !details.classList.contains('collapsed') ? details.getBoundingClientRect().bottom : 0, innerWidth <= 1100 && levelHud && !levelHud.hidden ? levelHud.getBoundingClientRect().bottom : 0) + 12);
  root.style.top = pill.style.top = top + 'px'; root.style.bottom = pill.style.bottom = 'auto';
  const dockTop = r ? r.top : innerHeight - 80, picker = document.getElementById('picker');
  const floor = document.body.classList.contains('picking') && picker ? Math.min(dockTop, picker.getBoundingClientRect().top) : dockTop;
  document.body.style.setProperty('--notice-bottom', Math.round(innerHeight - floor + 12) + 'px');
  root.style.maxHeight = Math.max(80, floor - top - 14) + 'px';
  const inspect = document.getElementById('inspect');
  if (inspect && innerWidth <= 720) {
    const goalBottom = (root.hidden ? pill : root).getBoundingClientRect().bottom;
    inspect.style.top = Math.min(floor - 90, goalBottom + 12) + 'px';
    inspect.style.maxHeight = Math.max(70, floor - parseFloat(inspect.style.top) - 12) + 'px';
  } else if (inspect) { inspect.style.top = ''; inspect.style.maxHeight = ''; }
}
function lookAt() {
  const cue = activeCue(); if (!cue || !cue.at) return;
  cam.target.set(cx(cue.at.i), 0, cz(cue.at.j)); cam.tView = Math.min(cam.tView, 7);
}
/** every frame from main.js: cheap; the DOM only changes when the cue changes */
let acc = 0;
export function updateGoalUi(dt) {
  if (!root) return;
  pulseCues(dt);
  if (!blocked()) pump();
  acc += dt; if (acc < 0.4) return; acc = 0;
  render(); place();
}

// ── events: ticks, chapters, levels ──
const queue = []; let showing = null;
function onEvents(events) {
  const quiet = events.some(e => e.quiet);
  const levels = events.filter(e => e.type === 'level').map(e => e.level);
  for (const e of events) if (e.type === 'goal' && !quiet && !levels.length) tick(e.id);
  if (levels.length && !quiet) queue.push({ levels });
  if (events.some(e => e.type === 'mode')) { queue.length = 0; dismissCelebration(); render(true); if (root) { root.hidden = true; pill.hidden = true; } setPulse(null); setCueCells([]); }
  cueKey = ''; pump(); render(true);
}
function tick(id) {
  const g = GOALS[id]; if (!g) return;
  playCompletionSound();
  toast(`✓ ${g.title}`);
  if (root && !reducedMotion()) { root.classList.remove('goal-earned'); requestAnimationFrame(() => root.classList.add('goal-earned')); }
}
function pump() {
  if (showing || hudCelebrating || !queue.length || blocked() || !isGuided()) return;
  const { levels } = queue.shift();
  const lv = levels[levels.length - 1], rewards = levels.flatMap(levelRewards);
  const el = document.getElementById('level-hud'); hudCelebrating = true;
  if (el) { el.classList.add('level-earned'); el.querySelector('#lh-fill').style.width = '100%'; }
  setTimeout(() => {
    hudCelebrating = false; el?.classList.remove('level-earned');
    renderLevelHud(progressState(), activeCue());
    if (!isGuided()) return;
    if (blocked()) { queue.unshift({ levels }); return; }
    revealLevel(lv, rewards);
  }, reducedMotion() ? 0 : 550);
}
const REWARD_COPY = { bakery: 'A warm corner of town. Give your neighbours somewhere to buy their morning bread.', community: 'Make room for shared stories, activities, and a place for neighbours to gather.', fishing: 'Take a break at the quay. Join an angler, cast a line, and discover your first catch.', terrace: 'Give your growing neighbourhood a new kind of home.' };
const ACHIEVEMENT = { 2: 'You connected a street and made room for your first neighbours.', 3: 'Your first neighbours have arrived. Your town has a life of its own.', 4: 'Ten neighbours, a shop, and a workplace. You made a living street.' };
function revealLevel(lv, rewards) {
  const featured = rewards.find(r => r.kind === 'community') || rewards.find(r => r.type === 'fishing') || rewards.find(r => r.kind === 'bakery') || rewards[0];
  if (!featured) return;
  const card = document.createElement('section'); card.id = 'level-up'; card.setAttribute('aria-label', `Town Level ${lv} rewards`); card.setAttribute('aria-live', 'polite');
  card.innerHTML = `<div class="lu-header"><span class="lu-level">LEVEL <b>${lv}</b></span><div><small>LOOK WHAT YOU CREATED</small><h2>${esc(LEVELS[lv].title)}</h2></div><button class="lu-close" data-g="ok" aria-label="Keep building">×</button></div>
    <p class="lu-earned">${esc(ACHIEVEMENT[lv] || 'Your town has reached a new milestone.')}</p>
    <div class="lu-stage"><div class="lu-rays"></div><span class="lu-unlocked">NEWLY UNLOCKED</span><div class="lu-hero"></div></div>
    <div class="lu-caption"><h3></h3><p></p></div><div class="lu-list"></div>
    ${lv === MAX_LEVEL ? '<p class="lu-bridge">Plus, the rest of the building collection is now yours to explore.</p>' : ''}
    <div class="lu-actions"><button class="g-btn lu-build" data-g="build">Build one</button><button class="g-btn ghost" data-g="ok">Keep building</button></div>`;
  document.body.appendChild(card); showing = card;
  let selected = featured;
  const showReward = r => {
    selected = r;
    const hero = card.querySelector('.lu-hero'); hero.innerHTML = r.type === 'fishing' ? '<svg viewBox="0 0 260 170" aria-label="Fishing rod and float" role="img"><path d="M36 147Q120 20 223 28" fill="none" stroke="#997252" stroke-width="7" stroke-linecap="round"/><path d="M223 28Q250 62 206 108" fill="none" stroke="#fbf6ee" stroke-width="2"/><ellipse cx="191" cy="139" rx="48" ry="12" fill="#87c4be"/><path d="M206 108v27" stroke="#436e72" stroke-width="2"/><ellipse cx="206" cy="121" rx="7" ry="12" fill="#e99373"/><path d="M199 121h14v5h-14" fill="#fff6e6"/><circle cx="62" cy="122" r="13" fill="#487e79"/></svg>' : '<img alt="" />';
    if (r.type !== 'fishing') buildingThumbnail(r.type, r.kind).then(url => { if (showing !== card || selected !== r) return; const img = hero.querySelector('img'); if (url) { img.src = url; img.alt = KIND_WORD(r.kind); } else hero.innerHTML = '<span class="lu-fallback">Preview unavailable</span>'; });
    card.querySelector('.lu-caption h3').textContent = KIND_WORD(r.kind);
    card.querySelector('.lu-caption p').textContent = REWARD_COPY[r.kind] || 'A new possibility for your neighbourhood. Choose where it belongs and watch your town grow.';
    card.querySelector('.lu-build').textContent = r.type === 'fishing' ? 'Explore the quay' : 'Build this';
    for (const button of card.querySelectorAll('[data-reward]')) button.classList.toggle('selected', button.dataset.reward === r.type + ':' + r.kind);
  };
  const list = card.querySelector('.lu-list');
  rewards.forEach(r => {
    const button = document.createElement('button'); button.type = 'button'; button.dataset.reward = r.type + ':' + r.kind;
    button.innerHTML = `${r.type === 'fishing' ? '<i class="fa-solid fa-fish"></i>' : '<img alt="" />'}<span>${esc(KIND_WORD(r.kind))}</span>`;
    list.appendChild(button); button.addEventListener('click', () => showReward(r));
    if (r.type !== 'fishing') buildingThumbnail(r.type, r.kind).then(url => { if (card.isConnected && url) button.querySelector('img').src = url; });
  });
  showReward(featured);
  card.addEventListener('click', e => {
    const button = e.target.closest('[data-g]'); if (!button) return;
    if (button.dataset.g === 'build') {
      if (selected.type === 'fishing') { const j = hooks.jetty(); if (j) { cam.target.set(j.x, 0, j.z); cam.tView = 6; } toast('Find an angler at the quay to join them'); }
      else { hooks.setTool(selected.type); if (!selectBuilding(selected.type, selected.kind)) toast('This building is already in your town. Choose another unlocked building.'); }
    }
    dismissCelebration();
  });
  requestAnimationFrame(() => card.classList.add('show'));
  playLevelUpSound(); burstConfetti();
}
function burstConfetti() {
  if (reducedMotion()) return;
  const layer = document.createElement('div'); layer.id = 'level-confetti'; layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 32; i++) {
    const bit = document.createElement('i'); bit.style.setProperty('--x', `${(Math.random() - 0.5) * Math.min(innerWidth * 0.8, 700)}px`);
    bit.style.setProperty('--y', `${80 + Math.random() * 240}px`); bit.style.setProperty('--r', `${Math.random() * 600 - 300}deg`);
    bit.style.setProperty('--delay', `${Math.random() * 0.16}s`); bit.style.background = ['#e7b96d', '#78b9ac', '#e69c87', '#fff4d8'][i % 4]; layer.appendChild(bit);
  }
  document.body.appendChild(layer); setTimeout(() => layer.remove(), 2400);
}
function dismissCelebration() {
  if (!showing) return;
  const c = showing; showing = null;
  if (c.contains(document.activeElement)) document.getElementById('level-hud')?.focus({ preventScroll: true });
  c.classList.remove('show'); c.style.pointerEvents = 'none'; setTimeout(() => c.remove(), reducedMotion() ? 0 : 300); pump();
}
export const celebrationShown = () => !!showing;

// ── world cues: the pulsing tool and soft cells ──
function setPulse(tool) { if (tool === pulseTool) return; pulseTool = tool; document.querySelectorAll('.tool').forEach(b => b.classList.toggle('guide', !!tool && b.dataset.tool === tool)); }
const cueMat = new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.3, depthWrite: false });
const cuePool = []; let cueOn = 0, cueT = 0;
function buildCues() { const g = new THREE.PlaneGeometry(0.86, 0.86); g.rotateX(-Math.PI / 2); for (let k = 0; k < 40; k++) { const m = new THREE.Mesh(g, cueMat); m.visible = false; m.position.y = 0.17; m.renderOrder = 2; scene.add(m); cuePool.push(m); } }
function setCueCells(list) { cueOn = Math.min(list.length, cuePool.length); cuePool.forEach((m, k) => { const c = list[k]; m.visible = k < cueOn; if (c) m.position.set(cx(c.i), 0.17 + (c.h || 0), cz(c.j)); }); }
function pulseCues(dt) { if (!cueOn) return; cueT += dt; cueMat.opacity = 0.22 + 0.14 * Math.sin(cueT * 2.2); }
export const goalUiState = () => ({ shown: !!root && !root.hidden, collapsed: !!(pill && !pill.hidden), celebration: !!showing, cueCells: cueOn, pulse: pulseTool, next: nextGoal(progressState()), facts: currentFacts(), canBuild });
