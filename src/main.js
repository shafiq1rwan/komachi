// Komachi — entry point: wires modules together, runs the frame loop, exposes dev hooks and the ?demo town
import * as THREE from 'three';
import { lerp } from './utils.js';
import { S } from './state.js';
import { renderer, scene, camera, cam, cx, cz, resize, updateCamera } from './scene.js';
import { cell, blocks, placeBlock, placeStation, STATION, rebuildDecor, rebuildRoads } from './world.js';
import { rebuildUnitMesh } from './buildings.js';
import { HPS, residents, updateResidents, updateWanderers, updateBlocks, removeBlock } from './sim.js';
import { envUpdate } from './daynight.js';
import { renderInspect, updateStats } from './ui.js';
import { keys, setTool, updatePreview, updateHover, updateTags, inspectTarget, clampTarget } from './input.js';

let last = performance.now(), realT = 0, uiAcc = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; realT += dt;
  const simDt = dt * S.speed;
  if (S.speed > 0) { S.T += simDt * HPS; updateBlocks(simDt * HPS); updateResidents(simDt, realT); updateWanderers(simDt); }
  // camera easing + keyboard panning
  const k = 1 - Math.exp(-dt * 9); cam.view = lerp(cam.view, cam.tView, k); cam.yaw = lerp(cam.yaw, cam.tYaw, k);
  const mv = dt * cam.view * 0.9;
  const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)), up = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
  if (keys.has('KeyW') || keys.has('ArrowUp')) cam.target.addScaledVector(up, mv);
  if (keys.has('KeyS') || keys.has('ArrowDown')) cam.target.addScaledVector(up, -mv);
  if (keys.has('KeyA') || keys.has('ArrowLeft')) cam.target.addScaledVector(right, -mv);
  if (keys.has('KeyD') || keys.has('ArrowRight')) cam.target.addScaledVector(right, mv);
  clampTarget(); updateCamera();
  envUpdate(realT); updatePreview(); updateHover(); updateTags();
  uiAcc += dt; if (uiAcc > 0.25) { uiAcc = 0; renderInspect(inspectTarget()); updateStats(); }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ───────────────────────────── dev hooks & demo town (?demo) ─────────────────────────────
/** Step the simulation forward by a number of game hours without rendering. */
function fastForward(hours) {
  const stepH = 0.04, stepS = stepH / HPS;
  for (let h = 0; h < hours; h += stepH) { S.T += stepH; updateBlocks(stepH); updateResidents(stepS, realT += stepS); updateWanderers(stepS); }
}
function demoTown() {
  const put = (type, list) => placeBlock(type, list.map(([i, j]) => cell(i, j)));
  // the station sits on cells 16–18; every block below shares a road with its ring
  put('res', [[14, 16], [14, 17]]); put('res', [[20, 16], [20, 17], [20, 18]]); put('res', [[16, 14], [17, 14]]);
  put('shop', [[14, 20]]); put('shop', [[19, 20]]);
  put('work', [[20, 13], [20, 14]]); put('work', [[16, 20], [17, 20]]);
  for (const b of blocks) { if (b.type !== 'station') { b.stage = 3; for (const u of b.units) rebuildUnitMesh(u); } }
  cam.target.set(cx(17), 0, cz(17)); cam.tView = cam.view = 14;
  fastForward(30); S.T = Math.floor(S.T / 24) * 24 + 13;
  document.getElementById('intro')?.remove(); setTool('explore');
}
window.MT = {
  placeBlock, removeBlock, blocks, residents, cell, cam, fastForward, demoTown, setTool, STATION,
  setHour: h => { S.T = Math.floor(S.T / 24) * 24 + h; }, setSpeed: s => { S.speed = s; }, get T() { return S.T; },
  roadCount: () => { let n = 0; for (let i = 0; i < 34; i++) for (let j = 0; j < 34; j++) if (cell(i, j).type === 'road') n++; return n; },
  project: (i, j, y = 0) => { const v = new THREE.Vector3(cx(i), y, cz(j)).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
};

resize(); rebuildDecor(); rebuildRoads();
placeStation();
if (new URLSearchParams(location.search).has('demo')) demoTown();
document.getElementById('loading').classList.add('gone');
requestAnimationFrame(frame);
