// Komachi — shared mutable game state (things several modules read and write)
const params = new URLSearchParams(location.search);
const saved = (() => { try { return JSON.parse(localStorage.getItem('komachi.save') || 'null'); } catch { return null; } })();
const fresh = params.has('new') || params.has('demo');   // ?new ignores the save (and overwrites it); ?demo is always a fresh sample town
export const S = {
  fresh,
  T: 7.0,            // game hours since start (day 1 begins at 0:00)
  speed: 1,          // 0 = paused, 1, 2, 4
  nextId: 1,         // id counter for blocks, units, residents
  pixelLook: (() => { try { return localStorage.getItem('komachi.pixelLook') === '1'; } catch { return false; } })(),   // half-resolution chunky render; off by default, remembered once toggled
  seed: params.has('seed') ? (parseInt(params.get('seed'), 10) || 1) : (!fresh && saved && saved.seed) || (Math.floor(Math.random() * 1e9) + 1),
  biome: params.get('biome') || (!fresh && saved && saved.biome) || 'suburban',
  rigged: !params.has('boxes'),   // Kenney Mini Characters by default; ?boxes brings back the original box people
};
