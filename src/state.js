// Komachi — shared mutable game state (things several modules read and write)
const params = new URLSearchParams(location.search);
export const S = {
  T: 7.0,            // game hours since start (day 1 begins at 0:00)
  speed: 1,          // 0 = paused, 1, 2, 4
  nextId: 1,         // id counter for blocks, units, residents
  pixelLook: true,   // half-resolution chunky render
  seed: params.has('seed') ? (parseInt(params.get('seed'), 10) || 1) : (Math.floor(Math.random() * 1e9) + 1),
  biome: params.get('biome') || 'suburban',
};
