// Komachi — entry point: wires modules together, runs the frame loop, exposes dev hooks and the ?demo town
import * as THREE from 'three';
import { lerp } from './utils.js';
import { S } from './state.js';
import { renderer, scene, camera, cam, cx, cz, N, HALF, resize, updateCamera } from './scene.js';
import { cell, blocks, placeBlock, placeStation, STATION, unitCap, wireMat, DONE, rebuildDecor, rebuildRoads, cells, terrainY } from './world.js';
import { updateConstruction, workers } from './construction.js';
import { updateCharacters, characterAvailable } from './characters.js';
import { rebuildUnitMesh } from './buildings.js';
import { updateWater } from './island.js';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { setSwayTime } from './geometry.js';
import { HPS, residents, updateResidents, updateWanderers, updateBlocks, removeBlock, makeCar, moveAlong } from './sim.js';
import { envUpdate } from './daynight.js';
import { updateAmbient, flocks } from './ambient.js';
import { daylight } from './sim.js';
import { renderInspect, updateStats } from './ui.js';
import { keys, setTool, updatePreview, updateHover, updateTags, updateBars, inspectTarget, clampTarget, followTarget, setFollow } from './input.js';
import { households } from './sim.js';
import { save, loadData, restore, clearSave } from './save.js';
import { toast } from './toast.js';

let last = performance.now(), realT = 0, uiAcc = 0, lastSave = 0;
const followV = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; realT += dt;
  const simDt = dt * S.speed;
  if (S.speed > 0) { S.T += simDt * HPS; updateBlocks(simDt * HPS); updateResidents(simDt, realT); updateWanderers(simDt); updateConstruction(simDt * HPS, simDt, realT); }
  // camera easing + keyboard panning
  const k = 1 - Math.exp(-dt * 9); cam.view = lerp(cam.view, cam.tView, k); cam.yaw = lerp(cam.yaw, cam.tYaw, k);
  const mv = dt * cam.view * 0.9;
  const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)), up = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some(c => keys.has(c))) setFollow(null);
  const f = followTarget();
  if (f) { if (f.state === 'away') setFollow(null); else { const p = f.state === 'driving' && f.car ? f.car.position : f.mesh.position; followV.set(p.x, 0, p.z); cam.target.lerp(followV, 1 - Math.exp(-dt * 5)); } }
  if (keys.has('KeyW') || keys.has('ArrowUp')) cam.target.addScaledVector(up, mv);
  if (keys.has('KeyS') || keys.has('ArrowDown')) cam.target.addScaledVector(up, -mv);
  if (keys.has('KeyA') || keys.has('ArrowLeft')) cam.target.addScaledVector(right, -mv);
  if (keys.has('KeyD') || keys.has('ArrowRight')) cam.target.addScaledVector(right, mv);
  updateCharacters(simDt);
  clampTarget(); updateCamera();
  wireMat.opacity = Math.max(0, Math.min(0.8, (20 - cam.view) / 10));   // cables fade out when zoomed far away
  setSwayTime(realT); updateWater(dt); envUpdate(realT); updateAmbient(dt, realT, 1 - daylight()); updatePreview(); updateHover(); updateTags(); updateBars();
  uiAcc += dt; if (uiAcc > 0.25) { uiAcc = 0; renderInspect(inspectTarget(), followTarget()); updateStats(); }
  if (S.speed > 0 && S.T - lastSave >= 0.5) { lastSave = S.T; save(); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ───────────────────────────── dev hooks & demo town (?demo) ─────────────────────────────
/** Step the simulation forward by a number of game hours without rendering. */
function fastForward(hours) {
  const stepH = 0.04, stepS = stepH / HPS;
  for (let h = 0; h < hours; h += stepH) { S.T += stepH; updateBlocks(stepH); updateResidents(stepS, realT += stepS); updateWanderers(stepS); updateConstruction(stepH, stepS, realT); }
}
function demoTown() {
  const o = HALF - 17;   // layout was authored around a station at cell 17; every block shares a road with the station ring
  const put = (type, list) => placeBlock(type, list.map(([i, j]) => cell(i + o, j + o)));
  put('res', [[14, 16], [14, 17]]); put('res', [[20, 16], [20, 17], [20, 18]]); put('res', [[16, 14], [17, 14]]);
  put('shop', [[14, 20]]); put('shop', [[19, 20]]);
  put('work', [[20, 13], [20, 14]]); put('work', [[16, 20], [17, 20]]);
  for (const b of blocks) { if (b.type !== 'station') { b.stage = DONE; for (const u of b.units) rebuildUnitMesh(u); } }
  cam.target.set(cx(HALF), 0, cz(HALF)); cam.tView = cam.view = 14;
  fastForward(30); S.T = Math.floor(S.T / 24) * 24 + 13;
  document.getElementById('intro')?.remove(); setTool('explore');
}
window.MT = {
  placeBlock, removeBlock, rebuildUnitMesh, unitCap, blocks, residents, flocks, workers, DONE, characterAvailable, cell, cells, cam, fastForward, demoTown, setTool, STATION,
  setHour: h => { S.T = Math.floor(S.T / 24) * 24 + h; }, setSpeed: s => { S.speed = s; }, get T() { return S.T; }, households, save, clearSave, setFollow, terrainY, makeCar, moveAlong,
  roadCount: () => { let n = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (cell(i, j).type === 'road') n++; return n; },
  project: (i, j, y = 0) => { const v = new THREE.Vector3(cx(i), y, cz(j)).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
};

resize(); rebuildDecor(); rebuildRoads();
placeStation();
{
  const saved = !S.fresh && loadData();
  if (saved && saved.seed === S.seed && saved.biome === S.biome) { const n = restore(saved); lastSave = S.T; if (n) toast('Welcome back to Komachi'); document.getElementById('intro')?.remove(); setTool('explore'); }
  else if (new URLSearchParams(location.search).has('demo')) demoTown();
}
addEventListener('pagehide', () => { if (blocks.length > 1) save(); });
document.getElementById('loading').classList.add('gone');
requestAnimationFrame(frame);
