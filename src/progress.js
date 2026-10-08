// Komachi — the progression adapter (2026-10-08): the town's goal state for this town, the facts the pure core (progression.js)
// needs read off the world, the one availability API the picker, Auto, previews, placement and fishing all ask, the cues
// the goal card draws (which tool, which cells, what is happening on the site), and an opt-in local session log.
// Guided Town is the default for new towns in every build (the user's call, 2026-10-08); scratch/test tabs are Free Build unless
// ?guided asks, and saves without progression load as Free Build so nothing is ever relocked.
import { S } from './state.js';
import { cells, cell, DIR4, blocks, DONE, STATION, townNet, placeable, drawable, frontRoads, TIERS, STAGE_NAMES, stageHours, chooseKind, KIND_LABEL } from './world.js';
import { residents, hourOf } from './sim.js';
import { record } from './chronicle.js';
import * as core from './progression.js';

let P = core.fresh('free'), restoring = true, hooks = { save: () => {} };
const listeners = [];
/** goal-ui.js and others: called with every event batch ({ type: 'goal' | 'chapter' | 'level' | 'entitlement' | 'mode', ... }) */
export function onProgress(fn) { listeners.push(fn); }
const emit = events => { for (const fn of listeners) fn(events, P); };

/** main.js once the world is back: the saved state (or a fresh one in `mode`), then evaluation may begin */
export function initProgress({ saved = null, mode = 'guided', save = () => {} } = {}) {
  hooks.save = save;
  P = saved !== null && saved !== undefined ? core.normalise(saved) : core.fresh(mode);
  restoring = false;
  reconcile();   // credit anything the town already has, in any order, quietly (one batch, no celebration burst)
}
/** save.js: what goes into the snapshot */
export const progressSnapshot = () => ({ ...P, completedGoalIds: P.completedGoalIds.slice(), completedChapterIds: P.completedChapterIds.slice(), entitlements: P.entitlements.slice() });
export const progressState = () => P;
export const isGuided = () => P.mode === 'guided';
export const townLevel = () => core.levelOf(P);

// ── facts off the world ──
const resUnits = b => b.type === 'res' ? b.units.length : 0;
const connected = (b, net) => (b.street && b.street.some(r => net.has(r))) || frontRoads(b.cells).some(r => net.has(r));
export function facts() {
  const net = townNet(), town = blocks.filter(b => b.type !== 'station');
  let drawnConnected = 0; for (const c of cells) if (c.type === 'road' && c.drawn && net.has(c)) drawnConnected++;
  let homesConnected = 0, shopsDone = 0, worksDone = 0;
  for (const b of town) { if (!connected(b, net)) continue; homesConnected += resUnits(b); if (b.stage >= DONE) { if (b.type === 'shop') shopsDone++; else if (b.type === 'work') worksDone++; } }
  const housed = residents.filter(r => r.home && !r.movingIn && r.home.block && r.home.block.type === 'res' && !r.home.removed).length;
  return { drawnConnected, homesConnected, housed, shopsDone, worksDone };
}
let lastFacts = facts();
export const currentFacts = () => lastFacts;

// ── evaluation: on a light cadence and right after a player action ──
let acc = 0, poked = true;
export function pokeProgress() { poked = true; }
export function updateProgress(dt) {
  tickLog(dt);
  if (restoring || P.mode !== 'guided') return;
  acc += dt; if (!poked && acc < 0.5) return; acc = 0; poked = false;
  const f = lastFacts = facts();
  const { events } = core.evaluate(P, f);
  if (events.length) { noteEvents(events); hooks.save(); emit(events); }
}
function reconcile() {
  if (P.mode !== 'guided') return;
  const f = lastFacts = facts();
  const { events } = core.evaluate(P, f);
  if (events.length) { noteEvents(events, true); hooks.save(); emit(events.map(e => ({ ...e, quiet: true }))); }
}
function noteEvents(events, quiet = false) {
  for (const e of events) {
    if (e.type === 'chapter') { const c = core.CHAPTERS.find(x => x.id === e.id); record(`${c.title}: the town reached Level ${c.level}, ${c.levelTitle}`); logEvent('chapter', e.id); }
    if (e.type === 'goal') logEvent('goal', e.id);
    if (e.type === 'level' && e.level === core.MAX_LEVEL && !quiet) record('Your town is yours to grow: every building is open to you');
  }
}

// ── availability: the one API ──
export const canBuild = (type, kind) => core.available(P, type, kind);
export const lockText = (type, kind) => core.lockReason(P, type, kind);
/** the kinds a drag of n cells may make now (Auto's pool); [] when nothing at this size is open */
export function allowedKinds(type, n) { const pool = TIERS[type] && TIERS[type][Math.min(3, n)]; return pool ? core.allowedOf(P, type, pool) : []; }
/** the longest drag Auto can make for this tool now (1–3) */
export function autoMax(type) { if (!TIERS[type]) return 3; let m = 0; for (let n = 1; n <= 3; n++) if (allowedKinds(type, n).length) m = n; return m || 1; }
/** Auto's choice among unlocked kinds (the town's own preference within them); null when nothing is open at this size */
export function pickAuto(type, sel) {
  const allowed = allowedKinds(type, sel.length); if (!allowed.length) return null;
  return type === 'res' ? allowed[Math.floor(Math.random() * allowed.length)] : chooseKind(type, sel, null, allowed);
}
const TYPE_WORD = { res: 'homes', shop: 'shops', work: 'workplaces', civic: 'civic buildings', farm: 'farms' };
/** why a player placement cannot go ahead, or null; `pick` is the picker's { type, kind } or null for Auto */
export function placementProblem(type, sel, pick) {
  if (!isGuided() || !TIERS[type]) return null;
  const n = Math.min(3, sel.length);
  if (pick) return canBuild(type, pick.kind) ? null : `${KIND_LABEL[pick.kind] || pick.kind}: ${lockText(type, pick.kind).toLowerCase()}`;
  if (allowedKinds(type, n).length) return null;
  if (type === 'res') return `Larger homes unlock after ${core.LEVELS[core.MAX_LEVEL].title}. Place a one-cell home for now.`;
  const lv = Math.min(...(TIERS[type][n] || []).map(k => core.unlockLevel(type, k) ?? core.MAX_LEVEL));
  const open = autoMax(type) >= 1 && allowedKinds(type, 1).length;
  return open ? `${n}-cell ${TYPE_WORD[type]} unlock later: try one cell for now` : `${TYPE_WORD[type][0].toUpperCase()}${TYPE_WORD[type].slice(1)} unlock at Town Level ${lv}: ${core.LEVELS[lv].title}`;
}
/** the preview's tier line for an Auto drag: only what is open */
export function tierText(type, n) {
  const allowed = allowedKinds(type, n); if (!allowed.length) return placementProblem(type, Array(n).fill(null), null) || '';
  const names = allowed.map(k => (k === 'office' && n === 3 ? 'office block' : KIND_LABEL[k] || k).toLowerCase());
  return `${n} cell${n > 1 ? 's' : ''} · ${names.length > 1 ? names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1] : names[0]}`;
}
export const fishingAllowed = () => core.fishingAllowed(P);
export const FISHING_LOCK = { label: 'Fishing · Unlocks at Town Level 3', why: 'Welcome your first neighbours to unlock fishing at the quay' };

// ── the player's choices ──
export function switchToFreeBuild() {
  if (P.mode !== 'guided') return false;
  core.switchToFree(P); record('The town switched to Free Build: every building open from here on'); logEvent('mode', 'free');
  hooks.save(); emit([{ type: 'mode', mode: 'free' }]); return true;
}
export function chooseActiveGoal(id) { core.chooseGoal(P, id); hooks.save(); emit([{ type: 'focus', id }]); }
export function setCollapsed(on) { P.collapsed = !!on; hooks.save(); }

// ── cues for the goal card: the tool to pulse, cells to soften, a place to look at, and what is happening ──
const ringCells = () => { const out = new Set(); if (!STATION.block) return out; for (const s of STATION.block.cells) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const n = cell(s.i + di, s.j + dj); if (n && n.type === 'road' && !n.drawn) out.add(n); } return out; };
/** empty cells just outside the station ring where a street can start */
function exitCells() {
  const out = []; for (const r of ringCells()) for (const [di, dj] of DIR4) { const n = cell(r.i + di, r.j + dj); if (n && n.type === 'empty' && !(n.h || 0) && drawable(n, 0) && !out.includes(n) && !DIR4.some(([a, b]) => { const m = cell(n.i + a, n.j + b); return m && m.block && m.block.type === 'station'; })) out.push(n); }
  return out;
}
/** once a street has begun: the empty cells it could continue into, so the cue moves with it */
function nextStreetCells(limit = 40) {
  const net = townNet(), out = [];
  for (const c of cells) { if (c.type !== 'road' || !c.drawn || !net.has(c)) continue; for (const [di, dj] of DIR4) { const n = cell(c.i + di, c.j + dj); if (n && n.type === 'empty' && !(n.h || 0) && drawable(n, 0) && !out.includes(n)) { out.push(n); if (out.length >= limit) return out; } } }
  return out;
}
/** empty cells beside a drawn street that reaches the station, where a one-cell building can go */
function plotCells(limit = 40) {
  const net = townNet(), out = [];
  for (const c of cells) { if (c.type !== 'empty' || (c.h || 0)) continue; if (!DIR4.some(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'road' && n.drawn && net.has(n); })) continue; if (placeable(c, [c])) { out.push(c); if (out.length >= limit) break; } }
  return out;
}
const siteOf = type => blocks.filter(b => b.type === type && b.stage < DONE).sort((a, b) => a.created - b.created)[0] || blocks.filter(b => b.type === type).sort((a, b) => a.created - b.created)[0] || null;
/** what is happening on a site right now, in words a player can act on */
export function siteStatus(b) {
  if (!b) return null;
  const h = hourOf();
  if (b.stage >= DONE) return b.type === 'res' && !b.units.some(u => u.residents.length && u.residents.some(r => !r.movingIn)) ? 'Finished. The household is on its way' : 'Finished';
  if (b.crew.some(k => k.state === 'working')) return `${STAGE_NAMES[b.stage]}${b.summoned ? ' · a household has boarded the next train' : ''}`;
  if (b.crew.some(k => k.state === 'toSite')) return 'The crew is walking to the site';
  if (h >= 18 || h < 6) return 'Night: work resumes at 6:00';
  if (b.crewBooked) return 'A crew is on the next train';
  if (b.crew.some(k => k.state === 'away')) return 'The crew comes back on the morning train';
  return b.queuePos > 1 ? `Waiting for a crew · ${b.queuePos}th in line` : 'Waiting for a crew: one boards the next train';
}
const centre = b => { const x = b.cells.reduce((s, c) => s + c.i, 0) / b.cells.length, z = b.cells.reduce((s, c) => s + c.j, 0) / b.cells.length; return { i: x, j: z }; };
/** everything the card and the world cues need for the active goal (null when the guide is over) */
export function activeCue() {
  if (P.mode !== 'guided') return null;
  const id = core.nextGoal(P); if (!id) return null;
  const g = core.GOALS[id], f = lastFacts, [done, of] = core.goalProgress(id, f);
  const cue = { id, goal: g, chapter: core.chapterOf(id), done, of, tool: g.tool, cells: [], at: null, status: null, how: g.how };
  if (id === 'first-street') { cue.cells = f.drawnConnected >= 1 ? nextStreetCells() : exitCells(); cue.at = cue.cells[0] || null; if (f.drawnConnected === 1) cue.how = 'One more cell: drag the street on from where it ends.'; }
  else if (id === 'first-home' || id === 'ten-neighbours') { cue.cells = plotCells(); cue.at = cue.cells[0] || null; if (!cue.cells.length && id === 'first-home') cue.how = 'Draw a street from the station ring first, then place a home beside it.'; }
  else if (id === 'first-household') { const b = siteOf('res'); cue.at = b ? centre(b) : null; cue.status = siteStatus(b); cue.tool = null; }
  else if (id === 'first-shop' || id === 'first-workplace') { const b = siteOf(id === 'first-shop' ? 'shop' : 'work'); if (b) { cue.at = centre(b); cue.status = siteStatus(b); cue.tool = null; } else { cue.cells = plotCells(); cue.at = cue.cells[0] || null; } }
  if (id === 'ten-neighbours') cue.status = `${f.housed} of ${core.TUNING.neighbours} neighbours live here`;
  const targetType = id === 'first-household' ? 'res' : id === 'first-shop' ? 'shop' : id === 'first-workplace' ? 'work' : null;
  const site = targetType ? siteOf(targetType) : null;
  if (site && site.stage < DONE) cue.construction = Math.round(Math.min(1, (site.stage + Math.min(1, site.stageT / stageHours(site)[site.stage])) / DONE) * 100);
  return cue;
}
export const levelsOverview = () => ({ level: core.levelOf(P), max: core.MAX_LEVEL, titles: core.LEVELS.map(l => l && l.title), notes: core.LEVELS.map(l => l && l.note), bridge: P.entitlements.includes(core.RELEASE_BRIDGE), done: core.allDone(P) });

// ── the opt-in local session log (?log or localStorage komachi.devlog = '1'): events on a monotonic clock, active time only ──
const logOn = (() => { try { return new URLSearchParams(location.search).has('log') || localStorage.getItem('komachi.devlog') === '1'; } catch { return false; } })();
const log = { events: [], active: 0, start: performance.now() };
let logFlag = { street: false, home: false, crew: false, movein: false };
export function logEvent(name, detail = null) {
  if (!logOn) return;
  log.events.push({ t: Math.round(performance.now() - log.start), active: Math.round(log.active), name, detail }); if (log.events.length > 200) log.events.shift();
  try { localStorage.setItem('komachi.sessionlog', JSON.stringify(log)); } catch { /* storage unavailable */ }
}
function tickLog(dt) {
  if (!logOn || restoring) return;
  if (!document.hidden && !document.body.classList.contains('menu-full') && !document.body.classList.contains('menu-pause') && S.speed > 0) log.active += dt * 1000;
  const f = lastFacts;
  if (!logFlag.street && f.drawnConnected >= 1) { logFlag.street = true; logEvent('first-valid-street'); }
  if (!logFlag.home && f.homesConnected >= 1) { logFlag.home = true; logEvent('home-placed'); }
  if (!logFlag.crew && blocks.some(b => b.crew.some(k => k.state === 'working'))) { logFlag.crew = true; logEvent('first-crew-work'); }
  if (!logFlag.movein && f.housed >= 1) { logFlag.movein = true; logEvent('first-move-in'); }
}
export const sessionLog = () => ({ on: logOn, ...log, mode: P.mode, level: core.levelOf(P) });
