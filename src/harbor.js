// Runtime geometry only: two protective arms, coping, bollards and navigation beacons.
// The entrance follows the ferry's actual sailing line, including its departure turn clearance.
import { box, cyl, blob, mergeMesh } from './geometry.js';
import { scene } from './scene.js';
import { PAL } from './palette.js';
import { coastPoint, harborIsland, seaRocks } from './island.js';
import { HARBOR_ANGLE, QUAY_Z } from './island-profile.js';

export const harbor = { arms: [], entrance: null };

export function buildHarbor(ferry) {
  if (!harborIsland || harbor.arms.length) return;
  const left = coastPoint(HARBOR_ANGLE + 0.67, -0.12), right = coastPoint(HARBOR_ANGLE - 0.67, -0.12);
  const outerZ = Math.max(left[1], right[1], QUAY_Z + 2) + 3.6;   // the roots may move along the coast below; the quay is straight there
  // New islands berth along +Z. Leave a generous fallback opening if a seed needs a different slip.
  // the entrance sits in front of the berth whenever the ferry sails out on +Z (every harbour berth does)
  const axisZ = !!ferry.berth && ferry.offshore.z > ferry.berth.z + 1;
  const entryX = axisZ ? ferry.berth.x : 0;
  const halfGap = 2.75;
  harbor.entrance = { x: entryX, z: outerZ, width: halfGap * 2 };
  const g = [], paving = PAL.waterfront.paving, stones = PAL.waterfront.stone;
  const segment = (a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
    const count = Math.ceil(len / 0.72), step = len / count;
    harbor.arms.push({ a, b, halfWidth: 0.42 });
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count, x = a[0] + dx * t, z = a[1] + dz * t;
      g.push(box(0.80, 0.88, step + 0.012, stones[k % stones.length], x, -0.43, z, ang));
      g.push(box(0.85, 0.065, step - 0.012, paving[k % paving.length], x, 0.04, z, ang));
      // A low parapet on the seaward face; the harbor-side walking deck stays visible.
      const sx = Math.cos(ang), sz = -Math.sin(ang);
      g.push(box(0.12, 0.19, step - 0.014, paving[1], x + sx * 0.34, 0.15, z + sz * 0.34, ang));
      if (k % 2 === 0) {
        g.push(cyl(0.035, 0.045, 0.12, PAL.waterfront.iron, x - sx * 0.23, 0.12, z - sz * 0.23, 8));
        g.push(blob(0.29, stones[1], x + sx * 0.60, -0.62, z + sz * 0.60, 0, 0.85));
      }
      seaRocks.push({ x, z, r: 0.55 });
    }
  };
  // Both arms start on solid coast. Their roots are walked along the coast until they stand outside the entrance span (seed 7's
  // west root sat at the berth's x, so the leg and the outer breakwater were built through the ferry's sailing line).
  const rootAt = (th0, dir, limitX) => { let th = th0, p = coastPoint(th, -0.12); for (let k = 0; k < 40 && (dir > 0 ? p[0] > limitX : p[0] < limitX); k++) { th += dir * 0.03; p = coastPoint(th, -0.12); } return p; };
  const westFirst = left[0] <= right[0];
  const W = rootAt(HARBOR_ANGLE + (westFirst ? 0.67 : -0.67), westFirst ? 1 : -1, entryX - halfGap - 0.4), E = rootAt(HARBOR_ANGLE + (westFirst ? -0.67 : 0.67), westFirst ? -1 : 1, entryX + halfGap + 0.4);
  const wTip = [entryX - halfGap, outerZ], eTip = [entryX + halfGap, outerZ], leftTip = wTip, rightTip = eTip;
  segment(W, [W[0], outerZ]); if (W[0] < wTip[0] - 0.05) segment([W[0], outerZ], wTip);
  segment(E, [E[0], outerZ]); if (E[0] > eTip[0] + 0.05) segment([E[0], outerZ], eTip);
  for (const [tip, color] of [[leftTip, '#b85148'], [rightTip, '#698e79']]) {
    g.push(cyl(0.15, 0.19, 0.18, paving[0], tip[0], 0.14, tip[1], 8));
    g.push(cyl(0.07, 0.10, 0.52, color, tip[0], 0.49, tip[1], 8));
    g.push(cyl(0.12, 0.09, 0.09, PAL.cream2, tip[0], 0.78, tip[1], 8));
    g.push(cyl(0, 0.14, 0.10, color, tip[0], 0.875, tip[1], 8));
  }
  const mesh = mergeMesh(g, true); mesh.name = 'procedural-harbor'; mesh.receiveShadow = true; scene.add(mesh);
  if (axisZ) ferry.offshore.z = Math.max(ferry.offshore.z, outerZ + 5);
}
