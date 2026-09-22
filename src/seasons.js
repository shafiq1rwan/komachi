// Komachi — seasons (Phase 6). Four seasons of SEASON_DAYS game days each, read off the calendar. Canopies take the
// season's colour when the decor is rebuilt at the turn; leaves and petals drift down from the trees at a rate that
// follows the season and the weather's wind. Nothing is saved: the season follows the day.
import * as THREE from 'three';
import { S } from './state.js';
import { rand } from './utils.js';
import { scene } from './scene.js';
import { biome } from './biome.js';
import { toast } from './toast.js';
import { record } from './chronicle.js';
import { W } from './weather.js';

export const SEASON_DAYS = 6, SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const seasonOf = (day = Math.floor(S.T / 24) + 1) => SEASONS[Math.floor((day - 1) / SEASON_DAYS) % 4];
const TURN = { spring: 'Spring: the trees are in leaf and the cherries are out', summer: 'Summer: the trees are in full green', autumn: 'Autumn: the leaves are turning', winter: 'Winter: the trees are bare' };

/** a canopy colour for the season, from the biome's base colour */
const tmp = new THREE.Color(), hsl = { h: 0, s: 0, l: 0 };
export function leafColor(hex, season = seasonOf()) {
  tmp.set(hex); tmp.getHSL(hsl);
  if (season === 'summer') return hex;
  if (season === 'spring') { tmp.setHSL(hsl.h, Math.min(1, hsl.s * 0.95), Math.min(0.9, hsl.l + 0.06)); }   // fresher, a shade lighter
  else if (season === 'autumn') { const warm = hsl.h > 0.15 && hsl.h < 0.5;   // greens turn; peach and pink deepen
    tmp.setHSL(warm ? 0.07 + (hsl.h - 0.15) * 0.15 : Math.max(0.02, hsl.h - 0.03), Math.min(1, hsl.s * 1.15 + 0.1), hsl.l * 0.92); }
  else { tmp.setHSL(0.09, hsl.s * 0.25, hsl.l * 0.72); }   // winter: bare brown-grey twiggy crowns
  return '#' + tmp.getHexString();
}
/** what falls, and how much: [colour picker, leaves per second per tree] */
function fallRate(season) { return season === 'autumn' ? 0.35 : season === 'spring' ? (biome.blossom ? 0.4 : 0.05) : season === 'summer' ? 0.03 : 0; }

// ── falling leaves: a pool of small quads spawned from the tree crowns (world.js keeps `treeSpots`) ──
const LEAF_N = 260, leaves = [], leafGeo = new THREE.PlaneGeometry(0.05, 0.035);
const leafMat = new THREE.MeshBasicMaterial({ vertexColors: false, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false });
for (let k = 0; k < LEAF_N; k++) { const m = new THREE.Mesh(leafGeo, leafMat.clone()); m.visible = false; m.renderOrder = 6; scene.add(m); leaves.push({ m, t: -1, life: 1, x: 0, y: 0, z: 0, vx: 0, vz: 0, spin: 0, phase: 0 }); }
let spawnAcc = 0, lastSeason = null, spots = [];
export function setTreeSpots(list) { spots = list; }
export function updateSeasons(dt, onTurn) {
  const season = seasonOf();
  if (lastSeason === null) lastSeason = season;
  else if (season !== lastSeason) { lastSeason = season; onTurn(); toast(TURN[season]); record(TURN[season].split(':')[0] + ' came to Komachi'); }
  // leaves
  const rate = fallRate(season) * Math.min(1, spots.length / 12) * (0.6 + 0.4 * Math.min(1, W.wind.length() * 12));
  spawnAcc += dt * rate * Math.min(spots.length, 40);
  while (spawnAcc >= 1 && spots.length) {
    spawnAcc -= 1; const l = leaves.find(l => l.t < 0); if (!l) break; const sp = spots[Math.floor(Math.random() * spots.length)];
    l.t = 0; l.life = rand(2.2, 3.6); l.x = sp.x + rand(-0.3, 0.3) * sp.s; l.z = sp.z + rand(-0.3, 0.3) * sp.s; l.y = sp.y + rand(-0.1, 0.15) * sp.s;
    l.vx = W.wind.x * 3 + rand(-0.04, 0.04); l.vz = W.wind.y * 3 + rand(-0.04, 0.04); l.spin = rand(-3, 3); l.phase = rand(0, 6.28);
    l.m.material.color.set(season === 'spring' && biome.blossom ? (Math.random() < 0.5 ? '#f8d7de' : '#f4c4cf') : leafColor(sp.color, season)); l.m.visible = true; l.m.scale.setScalar(rand(0.8, 1.3));
  }
  for (const l of leaves) {
    if (l.t < 0) continue; l.t += dt; const p = l.t / l.life;
    if (p >= 1) { l.t = -1; l.m.visible = false; continue; }
    const fall = Math.min(l.y, l.t * 0.22), sway = Math.sin(l.t * 3 + l.phase) * 0.04;
    l.m.position.set(l.x + l.vx * l.t + sway, Math.max(0.02, l.y - fall), l.z + l.vz * l.t);
    l.m.rotation.set(l.t * l.spin * 0.6 + l.phase, l.t * l.spin, Math.sin(l.t * 2 + l.phase) * 0.8);
    l.m.material.opacity = p > 0.8 ? (1 - p) / 0.2 : 0.95;   // settles and fades on the ground
  }
}
