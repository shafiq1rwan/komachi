// Komachi — weather (Phase 6). A clock in game hours runs spells of clear, cloudy and rain; `W.cover` and `W.rain` ease
// toward the spell's targets so light, clouds and rain change gently. Clouds are merged dodecahedron clusters that drift
// with the wind and cast moving shade; rain is a field of falling streaks that follows the camera. Purely visual, saved.
import * as THREE from 'three';
import { rand, pick } from './utils.js';
import { S } from './state.js';
import { scene, cam } from './scene.js';
import { setSnow } from './geometry.js';
let puddleSpots = [], puddleVersionOf = () => 0;
/** main.js hands over where puddles may lie (world.js keeps the list), so weather.js never imports world.js */
export function setPuddleSource(spots, versionOf) { puddleSpots = spots; puddleVersionOf = versionOf; }

export const W = { kind: 'clear', until: 0, cover: 0.15, rain: 0, tCover: 0.15, tRain: 0, wind: new THREE.Vector2(0.06, 0.03), winter: false, snow: 0, wet: 0 };   // wet: puddles on the streets, filling in rain and drying after   // winter is set by main.js from the season; snow is the cover on the ground
const SPELLS = { clear: { cover: 0.12, rain: 0, hours: [5, 12] }, cloudy: { cover: 0.7, rain: 0, hours: [3, 8] }, rain: { cover: 0.9, rain: 0.8, hours: [1.5, 4] }, drizzle: { cover: 0.75, rain: 0.35, hours: [1.5, 3] } };
const NEXT = { clear: ['clear', 'clear', 'cloudy', 'cloudy', 'drizzle'], cloudy: ['clear', 'clear', 'rain', 'drizzle', 'cloudy'], rain: ['cloudy', 'cloudy', 'clear', 'drizzle'], drizzle: ['cloudy', 'clear', 'rain'] };
/** force a spell (dev hook and tests) */
export function setWeather(kind, hours) { const sp = SPELLS[kind]; if (!sp) return false; W.kind = kind; W.tCover = sp.cover; W.tRain = sp.rain; W.until = S.T + (hours ?? rand(sp.hours[0], sp.hours[1])); W.wind.set(rand(-0.08, 0.08), rand(-0.08, 0.08)); if (W.wind.length() < 0.03) W.wind.set(0.06, 0.03); return true; }
export function restoreWeather(d) { if (!d) return; setWeather(d.kind || 'clear', 0); W.until = d.until || S.T; W.cover = W.tCover; W.rain = W.tRain; }
export function weatherSnapshot() { return { kind: W.kind, until: W.until }; }
export function weatherWord() { return W.kind === 'rain' ? (W.winter ? 'snow' : 'rain') : W.kind === 'drizzle' ? (W.winter ? 'light snow' : 'light rain') : W.kind === 'cloudy' ? 'overcast' : ''; }

// ── clouds: a fixed pool, each a cluster of soft lobes; how many show follows the cover ──
const CLOUDS = [], CLOUD_N = 12, CLOUD_Y = 6.5;
// a cloud-shaped alpha mask: a few soft overlapping discs on a canvas; the plane is invisible (no colour written) and only casts a shadow
const cloudMasks = [0, 1, 2].map(k => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.clearRect(0, 0, 128, 128);
  const lobes = [[64, 66, 30], [40, 70, 22], [90, 70, 24], [55, 52, 20], [78, 54, 18], [30 + k * 6, 76, 14], [100 - k * 5, 78, 15]];
  for (const [x, y, r] of lobes) { const grd = g.createRadialGradient(x, y, r * 0.3, x, y, r); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.75, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c); return t;
});
const cloudGeo = new THREE.PlaneGeometry(3.2, 2.2);
function makeCloud(k) {
  const mat = new THREE.MeshBasicMaterial({ alphaMap: cloudMasks[k % 3], transparent: true, alphaTest: 0.45, colorWrite: false, depthWrite: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(cloudGeo, mat); m.rotation.x = -Math.PI / 2; m.castShadow = true; m.receiveShadow = false; m.scale.setScalar(0.001); m.visible = false; scene.add(m);
  return { m, x: rand(-24, 24), z: rand(-24, 24), y: CLOUD_Y + rand(-0.6, 0.6), speed: rand(0.8, 1.2), s: 0, want: 0, size: 1 + (k % 3) * 0.25, spin: rand(0, Math.PI * 2) };
}
for (let k = 0; k < CLOUD_N; k++) CLOUDS.push(makeCloud(k));

// ── rain: streaks in a box that follows the camera target, wrapping as they fall ──
const RAIN_N = 1600, RAIN_BOX = 22, RAIN_H = 9, rainPos = new Float32Array(RAIN_N * 2 * 3), rainSeed = [];
for (let i = 0; i < RAIN_N; i++) rainSeed.push({ x: rand(-RAIN_BOX, RAIN_BOX), z: rand(-RAIN_BOX, RAIN_BOX), y: rand(0, RAIN_H), len: rand(0.18, 0.3) });
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color: '#c9d9e6', transparent: true, opacity: 0, depthWrite: false });
const rainMesh = new THREE.LineSegments(rainGeo, rainMat); rainMesh.frustumCulled = false; rainMesh.visible = false; rainMesh.renderOrder = 7; scene.add(rainMesh);
let rainT = 0;

// ── puddles: soft pale pools on flat street cells; their spots come from world.js and follow the streets ──
const PUDDLE_N = 80, puddles = [], puddleGeo = new THREE.CircleGeometry(1, 14); puddleGeo.scale(1, 0.62, 1);
// a wet patch, not paint: a soft-edged texture (a faint sky sheen in the middle, darker wet asphalt toward the rim, fading out),
// lit like the road so it darkens at night and can catch a small glint of sun
const puddleTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grd.addColorStop(0, 'rgba(206,222,232,0.62)'); grd.addColorStop(0.45, 'rgba(160,180,194,0.5)'); grd.addColorStop(0.78, 'rgba(92,106,118,0.38)'); grd.addColorStop(1, 'rgba(92,106,118,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const puddleMat = new THREE.MeshStandardMaterial({ map: puddleTex, transparent: true, opacity: 0, depthWrite: false, roughness: 0.35, metalness: 0 });
for (let k = 0; k < PUDDLE_N; k++) { const m = new THREE.Mesh(puddleGeo, puddleMat); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2; scene.add(m); puddles.push(m); }
let puddleSeen = -1;
function updatePuddles() {
  if (puddleSeen !== puddleVersionOf()) { puddleSeen = puddleVersionOf(); puddles.forEach((m, k) => { const sp = puddleSpots[k]; m.visible = !!sp; if (sp) { m.position.set(sp.x, 0.088, sp.z); m.rotation.z = sp.ry; m.userData.s = sp.s; } }); }
  const wet = W.wet; puddleMat.opacity = 0.8 * Math.min(1, wet * 1.4);   // the texture carries the transparency: never more than about half see-through
  for (const m of puddles) { if (!m.userData.s) continue; const s = m.userData.s * (0.5 + 0.5 * wet); m.scale.set(s, s, 1); m.visible = wet > 0.02 && puddleSpots.length > 0 && !!m.userData.s; }
}
/** dt real seconds, dh game hours */
export function updateWeather(dt, dh) {
  if (S.T >= W.until) setWeather(pick(NEXT[W.kind] || ['clear']));
  const k = Math.min(1, dh * 1.6);   // targets are reached over about half a game hour
  W.cover += (W.tCover - W.cover) * k; W.rain += (W.tRain - W.rain) * k;
  // snow cover: builds through winter (faster while it snows), melts away in spring
  W.wet = W.winter ? 0 : Math.max(0, Math.min(1, W.wet + (W.rain > 0.15 ? dh * 1.6 * W.rain : -dh * 0.9)));   // fills while it rains, dries over about an hour
  updatePuddles();
  const snowT = W.winter ? 0.9 : 0, ks = Math.min(1, dh * (W.winter ? 0.45 + W.rain * 0.8 : 0.35)); W.snow += (snowT - W.snow) * ks; setSnow(W.snow);
  // clouds: the first `want` of the pool are out; each grows in or shrinks away, drifts with the wind and wraps
  const want = Math.round(W.cover * CLOUD_N), grey = 1 - 0.32 * Math.max(0, W.cover - 0.4) / 0.6 - 0.15 * W.rain;
  CLOUDS.forEach((c, i) => {
    c.want = i < want ? 1 : 0; c.s += (c.want - c.s) * Math.min(1, dt * 0.6);
    c.x += W.wind.x * c.speed * dt * 3; c.z += W.wind.y * c.speed * dt * 3;
    if (c.x > 26) c.x = -26; if (c.x < -26) c.x = 26; if (c.z > 26) c.z = -26; if (c.z < -26) c.z = 26;
    const sc = Math.max(0.001, c.s) * c.size; c.m.visible = c.s > 0.01; c.m.scale.setScalar(sc); c.m.position.set(c.x, c.y, c.z); c.m.rotation.z = c.spin;
  });
  void grey;
  // rain
  const rain = W.rain, flakes = W.winter; rainMesh.visible = rain > 0.02; rainMat.opacity = flakes ? 0.8 * rain : 0.35 * rain; rainMat.color.set(flakes ? '#f4f7fa' : '#c9d9e6');
  if (rainMesh.visible) {
    rainT += dt * (flakes ? 1.6 : 7);   // snow drifts down slowly
    const cx0 = cam.target.x, cz0 = cam.target.z, wx = W.wind.x * 4, wz = W.wind.y * 4;
    for (let i = 0; i < RAIN_N; i++) {
      const s = rainSeed[i]; if (i / RAIN_N > rain) { rainPos.set([0, -9, 0, 0, -9, 0], i * 6); continue; }   // lighter rain shows fewer streaks
      const y = RAIN_H - ((s.y + rainT) % RAIN_H); const x = cx0 + s.x + wx * y * 0.08, z = cz0 + s.z + wz * y * 0.08;
      const len = flakes ? 0.045 : s.len, fx = flakes ? Math.sin(rainT * 0.7 + i) * 0.08 : 0;   // flakes: short, wandering
      rainPos.set([x + fx, y, z, x + fx - wx * 0.02, y + len, z - wz * 0.02], i * 6);
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
}
