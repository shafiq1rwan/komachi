// Komachi — save and load: one slot in localStorage, written every half game hour and when the page is left.
// Nobody is saved mid-trip; on load residents start at home, on the station plaza, or away in the city.
import { S } from './state.js';
import { blocks, cells, cell, placeBlock, placeCarPark, STATION, unitCap, hill, openHill, rebuildNetwork } from './world.js';
import { rebuildUnitMesh } from './buildings.js';
import { residents, households, restoreResident, restoreHousehold } from './sim.js';
import { chronicle, restoreChronicle } from './chronicle.js';
import { weatherSnapshot, restoreWeather } from './weather.js';

export const SAVE_KEY = 'komachi.save';
const BLOCK_KEYS = ['type', 'stage', 'stageT', 'level', 'occT', 'renoT', 'roof', 'wall', 'awning', 'family', 'kind', 'variant', 'roofStyle', 'name', 'summoned', 'visitScore', 'deliveredStage', 'visitsToday', 'lastVisits', 'popular', 'quietDays', 'changing', 'created', 'villaFor', 'picked'];
const RES_KEYS = ['id', 'name', 'wake', 'workStart', 'workEnd', 'commuteH', 'hasCar', 'hasBike', 'bikeKind', 'commuter', 'homemaker', 'lastWorkDay', 'lunched', 'skin', 'shirt', 'pants', 'hair', 'hat', 'hatColor', 'bag', 'bagColor', 'carColor', 'carKind', 'arrivedDay', 'needs', 'carOrdered'];
const pickKeys = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));

/** everything needed to rebuild the town, as plain data */
export function snapshot() {
  const town = blocks.filter(b => b.type !== 'station');
  const ref = u => { if (!u) return null; const bi = town.indexOf(u.block); return bi < 0 ? null : [bi, u.block.units.indexOf(u)]; };
  return {
    v: 3, savedAt: Date.now(), seed: S.seed, biome: S.biome, T: S.T, nextId: S.nextId, trains: STATION.block ? STATION.block.trains : 0, hillOpen: hill.open, chronicle: chronicle.slice(), weather: weatherSnapshot(),
    roads: cells.filter(c => c.drawn).map(c => [c.i, c.j]),
    parks: cells.filter(c => c.park === 'public').map(c => [c.i, c.j]),
    blocks: town.map(b => ({ ...pickKeys(b, BLOCK_KEYS), cells: b.cells.map(c => [c.i, c.j]), units: b.units.map(u => ({ variant: u.variant, facing: u.facing })) })),
    households: households.filter(hh => hh.members.length).map(hh => ({ id: hh.id, kind: hh.kind, size: hh.size, surname: hh.surname, home: ref(hh.home), registered: !!hh.registered })),
    residents: residents.map(r => ({ ...pickKeys(r, RES_KEYS), hh: r.hh.id, home: ref(r.home), job: ref(r.job), state: r.state === 'away' ? 'away' : 'here' })),
  };
}
export function save() { if (resetting) return false; try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); return true; } catch { return false; } }
export function loadData() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return d && (d.v === 1 || d.v === 2 || d.v === 3) ? d : null; } catch { return null; } }
let resetting = false;   // set by clearSave so the leave-page autosave does not write the town straight back
export function clearSave() { resetting = true; try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ } }
export const isResetting = () => resetting;

/** Rebuild the town from a snapshot. Call after placeStation() and before the first frame. Returns the block count. */
export function restore(d) {
  S.T = d.T; S.nextId = Math.max(S.nextId, d.nextId || 0); if (STATION.block) STATION.block.trains = d.trains || 0;
  if (d.hillOpen) openHill(true);
  restoreChronicle(d.chronicle); restoreWeather(d.weather);
  for (const [i, j] of d.roads || []) { const c = cell(i, j); if (c && (c.type === 'empty' || c.type === 'road' || (c.type === 'canal' && !c.keep)) && !c.ramp) { if (c.type === 'canal') c.bridge = true; c.type = 'road'; c.tree = null; c.drawn = true; } }
  if ((d.roads || []).length) rebuildNetwork();
  const town = [];
  for (const bd of d.blocks) {
    const sel = bd.cells.map(([i, j]) => cell(i, j)).filter(c => c && (c.type === 'empty' || c.type === 'road') && !c.keep && !c.canal);
    if (sel.length !== bd.cells.length) { town.push(null); continue; }   // the island differs from the save; skip the block
    const preset = { ...bd }; delete preset.cells; delete preset.units; const ud = bd.units;
    const b = placeBlock(bd.type, sel, { ...preset, crew: [], crewBooked: false, unitVariants: ud.map(u => u.variant) });
    b.units.forEach((u, i) => { if (ud[i] && ud[i].facing !== undefined && ud[i].facing !== u.facing) { u.facing = ud[i].facing; rebuildUnitMesh(u); } });
    town.push(b);
  }
  for (const [i, j] of d.parks || []) { const c = cell(i, j); if (c && c.type === 'empty' && !c.block && !c.park) placeCarPark([c]); }
  const unit = ref => ref && town[ref[0]] ? town[ref[0]].units[ref[1]] || null : null;
  const hhs = new Map();
  for (const hd of d.households || []) hhs.set(hd.id, restoreHousehold(hd, unit(hd.home)));
  for (const rd of d.residents || []) {
    const hh = hhs.get(rd.hh) || restoreHousehold({ id: S.nextId++, kind: 'solo', size: 1, surname: rd.name.split(' ')[1] || 'Sato' }, null);
    const home = unit(rd.home); if (home && home.residents.length >= unitCap(home)) continue;
    restoreResident(rd, hh, home, unit(rd.job));
  }
  return town.filter(Boolean).length;
}
