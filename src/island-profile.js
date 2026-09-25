// Shared coastline math. No scene/state imports: terrain and the sea shader use the same profile.
// The harbour town's south shore is a straight quay (a chord across the natural coast at z = QUAY_Z) from the west corner to
// QUAY_EAST, where the shore eases back out to the natural coast over QUAY_EASE; the breakwaters and the ferry berth sit on it.
export const HARBOR_ANGLE = Math.PI / 2;
export const QUAY_Z = 10.3;
export const QUAY_EAST = 4.5;
export const QUAY_EASE = 3.5;
export const BAY_DEPTH = 4.6;   // about how far the quay sits inside the natural coast at the centre (ambient craft keep this far out)
export const angleDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function coastRadius(theta, base, harmonics, harbor, sx = 1.08, sz = 0.94) {
  let r = base;
  for (const [k, phase, amplitude] of harmonics) r += amplitude * Math.sin(k * theta + phase);
  if (harbor) {
    const s = Math.sin(theta);
    if (s > 0.2) {
      const rc = QUAY_Z / (s * sz);   // the radius that puts the shore on the quay line
      if (rc < r) { const x = Math.cos(theta) * rc * sx, w = x <= QUAY_EAST ? 1 : Math.max(0, 1 - (x - QUAY_EAST) / QUAY_EASE); r += (rc - r) * w; }
    }
  }
  return r;
}

// Built shore is confined to the harbour: the quay zone runs the length of the straight front (further to the west, where the
// long breakwater roots). Two small coves break up the rocky outer coast.
export function coastZone(theta) {
  const d = wrap(theta - HARBOR_ANGLE);
  if (d > -0.55 && d < 0.8) return 'quay';
  if (angleDistance(theta, -0.18) < 0.18 || angleDistance(theta, 2.78) < 0.16) return 'beach';
  return 'rock';
}
