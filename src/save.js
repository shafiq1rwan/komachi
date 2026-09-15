// Komachi — save and load: one slot in localStorage, written every half game hour and when the page is left.
// Nobody is saved mid-trip; on load residents start at home, on the station plaza, or away in the city.
import { S } from './state.js';
import { blocks, cell, placeBlock, STATION, unitCap } from './world.js';
import { rebuildUnitMesh } from './buildings.js';
import { residents, households, restoreResident, restoreHousehold } from './sim.js';

export const SAVE_KEY = 'komachi.save';
const BLOCK_KEYS = ['type', 'stage', 'stageT', 'level', 'occT', 'renoT', 'roof', 'wall', 'awning', 'family', 'kind', 'variant', 'roofStyle', 'name', 'summoned', 'visitScore', 'deliveredStage'];
const RES_KEYS = ['id', 'name', 'wake', 'workStart', 'workEnd', 'hasCar', 'lastWorkDay', 'lunched', 'skin', 'shirt', 'pants', 'hair', 'hat', 'hatColor', 'bag', 'bagColor', 'carColor', 'carKind', 'arrivedDay', 'needs'];
const pickKeys = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]));

/** everything needed to rebuild the town, as plain data */
export function snapshot() {
  const town = blocks.filter(b => b.type !== 'station');
  const ref = u => { if (!u) return null; const bi = town.indexOf(u.block); return bi < 0 ? null : [bi, u.block.units.indexOf(u)]; };
  return {
    v: 1, savedAt: Date.now(), seed: S.seed, biome: S.biome, T: S.T, nextId: S.nextId, trains: STATION.block ? STATION.block.trains : 0,
    blocks: town.map(b => ({ ...pickKeys(b, BLOCK_KEYS), cells: b.cells.map(c => [c.i, c.j]), units: b.units.map(u => ({ variant: u.variant, facing: u.facing })) })),
    households: households.filter(hh => hh.members.length).map(hh => ({ id: hh.id, kind: hh.kind, size: hh.size, surname: hh.surname, home: ref(hh.home) })),
    residents: residents.map(r => ({ ...pickKeys(r, RES_KEYS), hh: r.hh.id, home: ref(r.home), job: ref(r.job), state: r.state === 'away' ? 'away' : 'here' })),
  };
}
export function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot())); return true; } catch { return false; } }
export function loadData() { try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return d && d.v === 1 ? d : null; } catch { return null; } }
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* storage unavailable */ } }

/** Rebuild the town from a snapshot. Call after placeStation() and before the first frame. Returns the block count. */
export function restore(d) {
  S.T = d.T; S.nextId = Math.max(S.nextId, d.nextId || 0); if (STATION.block) STATION.block.trains = d.trains || 0;
  const town = [];
  for (const bd of d.blocks) {
    const sel = bd.cells.map(([i, j]) => cell(i, j)).filter(c => c && (c.type === 'empty' || c.type === 'road'));
    if (sel.length !== bd.cells.length) { town.push(null); continue; }   // the island differs from the save; skip the block
    const preset = { ...bd }; delete preset.cells; delete preset.units; const ud = bd.units;
    const b = placeBlock(bd.type, sel, { ...preset, crew: [], crewBooked: false, unitVariants: ud.map(u => u.variant) });
    b.units.forEach((u, i) => { if (ud[i] && ud[i].facing !== undefined && ud[i].facing !== u.facing) { u.facing = ud[i].facing; rebuildUnitMesh(u); } });
    town.push(b);
  }
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
