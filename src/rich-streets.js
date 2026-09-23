import { box } from './geometry.js';

// Surface details sit above the existing road/sidewalk elevations. Routes and
// pedestrian kerbs keep their existing positions, including on hill roads.
export function richStreetDetails(g, x, z, open, dbl, dirs) {
  const junction = open.filter(Boolean).length >= 3 && !dbl.some(Boolean);
  for (let k = 0; k < 4; k++) {
    const [di, dj] = dirs[k];
    if (!open[k] && !dbl[k]) {
      // Individual pale kerbstones and quiet paving joints, following the road edge.
      for (let p = 0; p < 5; p++) {
        const t = -0.4 + p * 0.2;
        g.push(box(di ? 0.026 : 0.19, 0.012, di ? 0.19 : 0.026, p % 2 ? '#d4d2c7' : '#c4c3b9', x + di * 0.322 + dj * t, 0.105, z + dj * 0.322 + di * t));
        g.push(box(di ? 0.16 : 0.004, 0.002, di ? 0.004 : 0.16, '#b5b6ae', x + di * 0.417 + dj * t, 0.1015, z + dj * 0.417 + di * t));
      }
      // A slim drain along the kerb, away from the walking line.
      g.push(box(di ? 0.025 : 0.095, 0.003, di ? 0.095 : 0.025, '#515b60', x + di * 0.299 + dj * 0.2, 0.083, z + dj * 0.299 + di * 0.2));
    }
    if (junction && open[k]) {
      for (let stripe = -2; stripe <= 2; stripe++) {
        const t = stripe * 0.111;
        g.push(box(di ? 0.18 : 0.061, 0.004, di ? 0.061 : 0.18, '#eeeade', x + di * 0.39 + dj * t, 0.083, z + dj * 0.39 + di * t));
      }
      for (const side of [-1, 1]) {
        g.push(box(di ? 0.13 : 0.07, 0.006, di ? 0.07 : 0.13, '#ccb985', x + di * 0.39 + dj * side * 0.35, 0.105, z + dj * 0.39 + di * side * 0.35));
      }
    }
  }
}
