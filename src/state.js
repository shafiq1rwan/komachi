// Komachi — shared mutable game state (things several modules read and write)
export const S = {
  T: 7.0,            // game hours since start (day 1 begins at 0:00)
  speed: 1,          // 0 = paused, 1, 2, 4
  nextId: 1,         // id counter for blocks, units, residents
  pixelLook: true,   // half-resolution chunky render
};
