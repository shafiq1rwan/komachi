// Komachi — the towns you keep: each is a save slot in localStorage (`komachi.slot.<id>`), listed in `komachi.slots` with a little
// summary for the Towns list, and `komachi.active` names the one being played. A tab opened with ?demo, ?new or ?seed= plays in a
// scratch slot of its own (remembered for that tab), so trying things out never touches your towns. Imports nothing: state.js
// reads the active town's seed and biome from here before the island is built.
const INDEX = 'komachi.slots', ACTIVE = 'komachi.active', OLD = 'komachi.save', SCRATCH = 'scratch';
const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const del = k => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } };
const params = new URLSearchParams(location.search);
const SEASONS = ['spring', 'summer', 'autumn', 'winter'], SEASON_DAYS = 6;   // as in seasons.js (a 24-day year)

/** this tab plays in the scratch slot: opened with a test/sample URL, or reloaded from one */
export const scratch = (() => {
  let on = params.has('demo') || params.has('new') || params.has('seed');
  try { if (on) sessionStorage.setItem('komachi.scratch', '1'); else on = sessionStorage.getItem('komachi.scratch') === '1'; } catch { /* no session storage */ }
  return on;
})();

export function listSlots() { try { return JSON.parse(get(INDEX) || '[]'); } catch { return []; } }
const writeIndex = list => set(INDEX, JSON.stringify(list));
export const slotKey = id => 'komachi.slot.' + id;
export const activeId = () => scratch ? SCRATCH : get(ACTIVE);
export function setActive(id) { set(ACTIVE, id); }
export function readSlot(id) { if (!id) return null; try { return JSON.parse(get(slotKey(id)) || 'null'); } catch { return null; } }

/** the one save written before towns had slots becomes the first town */
(function migrate() {
  const old = get(OLD); if (!old || listSlots().length) return;
  try { const d = JSON.parse(old); const id = 'town-' + Date.now().toString(36); set(slotKey(id), old); writeIndex([summary(id, 'Komachi', d)]); set(ACTIVE, id); del(OLD); } catch { /* unreadable: leave it */ }
})();

function summary(id, name, d, thumb) {
  const R = d && d.residents ? d.residents : [], day = d ? Math.floor((d.T || 0) / 24) + 1 : 1;
  return { id, name, seed: d ? d.seed : null, biome: d ? d.biome : 'suburban', savedAt: d ? d.savedAt || Date.now() : Date.now(), day, pop: R.filter(r => r.home).length,
    time: d ? (d.T || 0) % 24 : 7, season: SEASONS[Math.floor((day - 1) / SEASON_DAYS) % 4], homes: d && d.blocks ? d.blocks.filter(b => b.type === 'res' && b.stage >= 5).length : 0,
    jobs: R.filter(r => r.job).length, trains: d ? d.trains || 0 : 0, thumb: thumb || null };
}
/** write the playing town's snapshot to its slot and refresh its line in the list (the scratch slot stays off the list) */
export function writeSlot(id, d, thumb = null) {
  if (!id) return false;
  if (!set(slotKey(id), JSON.stringify(d))) return false;
  if (id !== SCRATCH) { const list = listSlots(), i = list.findIndex(s => s.id === id), s = summary(id, i >= 0 ? list[i].name : 'Komachi', d, thumb || (i >= 0 ? list[i].thumb : null)); if (i >= 0) list[i] = s; else list.push(s); writeIndex(list); }
  return true;
}
/** a new town: its slot is made now (empty until the first save) and it becomes the one to play */
export function newSlot(name, seed, biome) {
  const id = 'town-' + Date.now().toString(36), list = listSlots();
  list.push({ id, name: name || 'New town', seed, biome, savedAt: Date.now(), day: 1, pop: 0, fresh: true }); writeIndex(list); set(ACTIVE, id);
  return id;
}
export function renameSlot(id, name) { const list = listSlots(), s = list.find(x => x.id === id); if (s && name) { s.name = name.slice(0, 40); writeIndex(list); } }
export function deleteSlot(id) { writeIndex(listSlots().filter(s => s.id !== id)); del(slotKey(id)); if (get(ACTIVE) === id) del(ACTIVE); }
/** the seed and biome to build the island from: the playing town's save, or the planned new town's summary */
export function activeIsland() {
  const id = activeId(), d = readSlot(id);
  if (d) return { seed: d.seed, biome: d.biome, save: d };
  const s = listSlots().find(x => x.id === id);
  return s ? { seed: s.seed, biome: s.biome, save: null } : null;
}
