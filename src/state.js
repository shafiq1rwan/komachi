// Komachi — shared mutable game state (things several modules read and write)
import { activeIsland } from './slots.js';
const params = new URLSearchParams(location.search);
const island = activeIsland(), saved = island ? { seed: island.seed, biome: island.biome } : null;   // the town being played (src/slots.js)
const fresh = params.has('new') || params.has('demo');   // ?new ignores the save (and overwrites it); ?demo is always a fresh sample town
export const S = {
  fresh,
  // Saves without a terrain version retain their original land and plot coordinates.
  terrainVersion: !fresh && island?.save ? (island.save.terrainVersion || 1) : params.get('terrain') === '1' ? 1 : 2,
  look: (() => { try { return params.get('look') || localStorage.getItem('komachi.lookStyle') || 'rich'; } catch { return 'rich'; } })() === 'classic' ? 'classic' : 'rich',   // rich is the standard since 2026-09-23
  T: 7.0,            // game hours since start (day 1 begins at 0:00)
  speed: 1,          // 0 = paused, 1, 2, 4
  nextId: 1,         // id counter for blocks, units, residents
  pixelLook: (() => { try { return localStorage.getItem('komachi.pixelLook') === '1'; } catch { return false; } })(),   // half-resolution chunky render; off by default, remembered once toggled
  seed: params.has('seed') ? (parseInt(params.get('seed'), 10) || 1) : (!fresh && saved && saved.seed) || (Math.floor(Math.random() * 1e9) + 1),
  biome: params.get('biome') || (!fresh && saved && saved.biome) || 'suburban',
  rigged: !params.has('boxes'),   // Kenney Mini Characters by default; ?boxes brings back the original box people
};
