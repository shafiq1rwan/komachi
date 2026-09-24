// Komachi — entry point: wires modules together, runs the frame loop, exposes dev hooks and the ?demo town
import * as THREE from 'three';
import { lerp, hash } from './utils.js';
import { S } from './state.js';
import { scene, camera, cam, cx, cz, N, HALF, resize, updateCamera } from './scene.js';
import { puddleSpots, puddleVersionOf, refreshCivicFlags, placeCarPark, carParks, placeable, cell, blocks, placeBlock, placeStation, STATION, unitCap, wireMat, DONE, rebuildDecor, rebuildRoads, cells, terrainY, openHill, hill, onHillOpened, lanterns, lightLanterns, updateLanterns, updateSignals, signalCells, parkCells, townNet, drawRoad, eraseRoad, frontRoads, roadKeepReason, TIERS, tierLabel, chooseKind, hillPlots, hoursOf, isOpen, signalState } from './world.js';
import { updateConstruction, workers, trucks, sendHillCrew, holdHillCrew, hillCrew } from './construction.js';
import { placeLandmarks, updateLandmarks, landmarks, landmarkRoads } from './landmarks.js';
import { updateEvents, onEventStart, eventOn, festivalDay } from './events.js';
import { updateFishing, catchToday } from './fishing.js';
import { updateTourists, tourists, tourism, bus, spawnTourist, isWeekend } from './tourists.js';
import { renderFrame, setLook } from './look.js';
import { announce, updateMilestone, milestoneShown, cancelGlide, gliding } from './milestone.js';
import { updateCharacters, characterAvailable } from './characters.js';
import { rebuildUnitMesh } from './buildings.js';
import { updateWater } from './island.js';
import { updateSea } from './sea.js';
import { initFerry, updateFerry, ferry } from './ferry.js';
import { hillCentre, pierFrame, canalCells, coastDist, beachExtra, canalMouths, pierAngle, islandEllipse, seaRocks, shoreKind } from './island.js';
import '@fortawesome/fontawesome-free/css/all.min.css';
// the installed app plays offline: the service worker the build writes (vite.config.js) caches the whole game; not in dev
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => { /* offline play unavailable */ }));
import { setSwayTime } from './geometry.js';
import { chronicle } from './chronicle.js';
import { W, setWeather, updateWeather, setPuddleSource } from './weather.js';
import './minimap.js';
import { updateSeasons, seasonOf } from './seasons.js';
import { updateBubbles, talks } from './bubbles.js';
/** at the season's turn the canopies take their new colour: decor and the station's planter trees are rebuilt */
setPuddleSource(puddleSpots, puddleVersionOf);   // weather.js draws puddles where world.js says streets lie
// the first milestone: the hill opens. The lanterns light one by one from the foot of the shrine path, the road crew stands at the
// top of the slope road nearest the station, and the card offers to go and look (the lanterns light again as the camera arrives)
onEventStart((kind, b) => {
  const first = kind === 'festival' ? /first summer festival/ : /first market morning/;
  if (chronicle.some(e => first.test(e.text))) return;
  const u = b.units[Math.floor(b.units.length / 2)], at = u.mesh.position.clone();
  if (kind === 'festival') announce({ title: 'The summer festival', line: `Stalls and lanterns fill ${b.name} tonight, and there will be fireworks over the sea.`, icon: 'festival', at, view: 6, onLook: () => setFollow(null) });
  else toast(`Market morning on ${b.name}: stalls are up until half past eleven`);
});
onHillOpened(() => {
  let best = null, bd = Infinity;
  for (const r of cells) {
    if (!r.ramp || r.type !== 'road') continue;
    const { di, dj } = r.ramp, a = cell(r.i + di, r.j + dj), b = cell(r.i - di, r.j - dj); if (!a || !b) continue;
    const top = (a.h || 0) > (b.h || 0) ? a : b, lo = top === a ? b : a, d = Math.hypot(r.i - STATION.anchor.cell.i, r.j - STATION.anchor.cell.j);
    if (top.type === 'road' && d < bd) { bd = d; best = { top, down: new THREE.Vector3(lo.i - top.i, 0, lo.j - top.j).normalize() }; }
  }
  for (let up = true; best && up;) {   // climb the chain of ramps to the top of the whole slope road
    up = false;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r = cell(best.top.i + di, best.top.j + dj); if (!r || !r.ramp || r.type !== 'road') continue;
      const a = cell(r.i + r.ramp.di, r.j + r.ramp.dj), b = cell(r.i - r.ramp.di, r.j - r.ramp.dj); if (!a || !b) continue;
      const top = (a.h || 0) > (b.h || 0) ? a : b;
      if (top.type === 'road' && (top.h || 0) > (best.top.h || 0)) { best = { top, down: new THREE.Vector3(r.i - top.i, 0, r.j - top.j).normalize() }; up = true; break; }
    }
  }
  if (best) sendHillCrew(best.top, best.down);
  lightLanterns();
  const pts = lanterns.map(L => L.pos); if (best) pts.push(new THREE.Vector3(cx(best.top.i), best.top.h || 0, cz(best.top.j)));
  const at = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, pts.length));
  const span = Math.max(...pts.map(p => Math.hypot(p.x - at.x, p.z - at.z)), 1);
  announce({ title: 'The hill is open', line: 'The town has grown. A road crew has opened the hill road, and the shrine path is lit.', icon: 'hill',
    at, view: Math.min(12, Math.max(5, span * 2.6 + 2)), onLook: () => { setFollow(null); lightLanterns(); holdHillCrew(0.8); } });
});
function onSeasonTurn() { rebuildDecor(); for (const b of blocks) if (b.type === 'station' || b.type === 'farm') for (const u of b.units) rebuildUnitMesh(u); }   // canopies, the station's planters and the fields turn
import { serviceReady } from './service-vehicles.js';
import { stageService, routeVaried, routeCells, HPS, dayOf, residents, updateResidents, updateWanderers, updateBlocks, removeBlock, makeCar, parkVehicle, moveAlong, carMeshes, wanderers, hillMarket } from './sim.js';
import { envUpdate } from './daynight.js';
import { updateAmbient, flocks } from './ambient.js';
import { daylight } from './sim.js';
import { renderInspect, updateStats } from './ui.js';
import { keys, setTool, updatePreview, updateHover, updateTags, updateBars, inspectTarget, clampTarget, followTarget, setFollow } from './input.js';
import { households } from './sim.js';
import { save, loadData, restore, clearSave, thumbDue, captureThumb } from './save.js';
import { initMenus } from './title.js';
import { toast } from './toast.js';
import { frameDue } from './quality.js';
import { pickerForTool, currentPick } from './picker.js';

let last = performance.now(), realT = 0, uiAcc = 0, lastSave = 0;
const followV = new THREE.Vector3();
function frame(now) {
  if (!frameDue(now)) { requestAnimationFrame(frame); return; }   // the frame-rate cap: skipped frames cost nothing
  if (document.body.classList.contains('menu-full') && !thumbDue()) { last = now; requestAnimationFrame(frame); return; }   // the main menu covers the town: nothing to draw
  const dt = Math.min(0.05, (now - last) / 1000); last = now; realT += dt;
  const simDt = dt * S.speed;
  if (S.speed > 0) { S.T += simDt * HPS; updateBlocks(simDt * HPS); updateResidents(simDt, realT); updateWanderers(simDt); updateConstruction(simDt * HPS, simDt, realT); updateFerry(simDt * HPS, simDt); updateTourists(simDt, realT); }
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
  setSwayTime(realT); updateWater(dt); updateSea(dt, realT); updateSignals(); W.winter = seasonOf() === 'winter'; updateWeather(dt, simDt * HPS); updateSeasons(dt, onSeasonTurn); envUpdate(realT); updateEvents(dt, realT, 1 - daylight()); updateFishing(); for (const b of blocks) if (b.type === 'farm') for (const u of b.units) if (u.wheel) u.wheel.rotation.x += dt * 0.7 * Math.min(1, S.speed); updateLanterns(); updateLandmarks(dt, 1 - daylight()); updateMilestone(); updateAmbient(dt, realT, 1 - daylight()); updatePreview(); updateHover(); updateTags(); updateBubbles(realT); updateBars();
  uiAcc += dt; if (uiAcc > 0.25) { uiAcc = 0; renderInspect(inspectTarget(), followTarget()); updateStats(); }
  if (S.speed > 0 && S.T - lastSave >= 0.5) { lastSave = S.T; save(); }
  renderFrame(); if (thumbDue() && blocks.length > 1) { captureThumb(); if (document.body.classList.contains('menu-full')) save(); }
  requestAnimationFrame(frame);
}

// ───────────────────────────── dev hooks & demo town (?demo) ─────────────────────────────
/** Step the simulation forward by a number of game hours without rendering. */
function fastForward(hours, stepH = 0.04) {   // stepH: game hours per step (tests of motion use 1/60 s, i.e. 0.00167)
  const stepS = stepH / HPS;
  for (let h = 0; h < hours; h += stepH) { S.T += stepH; W.winter = seasonOf() === 'winter'; updateWeather(stepS, stepH); updateSeasons(0, onSeasonTurn); updateBlocks(stepH); updateResidents(stepS, realT += stepS); updateWanderers(stepS); updateConstruction(stepH, stepS, realT); updateFerry(stepH, stepS); updateTourists(stepS, realT); updateEvents(stepS, realT, 1 - daylight()); updateFishing(); }
}
function demoTown() {
  const o = HALF - 17;   // layout was authored around a station at cell 17; every block shares a road with the station ring
  const put = (type, list) => placeBlock(type, list.map(([i, j]) => cell(i + o, j + o)));
  const road = (a, b) => drawRoad(cell(a[0] + o, a[1] + o), cell(b[0] + o, b[1] + o));
  road([14, 19], [14, 23]); road([19, 13], [19, 14]);   // two side streets off the ring for the shop row and the workshop
  road([14, 24], [14, 26]);                             // and on down to the coast road, so the ferry's cars can reach town
  put('res', [[14, 16], [14, 17]]); put('res', [[20, 16], [20, 17], [20, 18]]); put('res', [[16, 14], [17, 14]]);
  put('shop', [[13, 20]]); put('shop', [[19, 20]]);   // the first shop stands beside the side street, not on it
  put('work', [[20, 13], [20, 14]]); put('work', [[15, 20], [16, 20]]);   // one cell west of the taxis' car park across from the entrance
  const dense = new URLSearchParams(location.search).get('demo') === 'dense';
  if (dense) {
    // ?demo=dense: the reference view is a lived-in neighborhood. A connected street grid gives a
    // fresh rich session that density while every lot stays editable in the game.
    for (let j = 8; j <= 32; j++) for (let i = 8; i <= 32; i++) {
      if (i % 4 !== 2 && j % 4 !== 2) continue;
      const c = cell(i, j);
      if (c.type !== 'empty' || c.h || c.keep || c.landmark || coastDist(cx(i), cz(j)) < 2.4) continue;
      c.type = 'road'; c.tree = null; c.drawn = true;
    }
    rebuildRoads(); rebuildDecor();
    const plots = cells.filter(c => c.i >= 9 && c.i <= 31 && c.j >= 9 && c.j <= 31 && c.type === 'empty' && !c.h && !c.keep && !c.landmark && coastDist(cx(c.i), cz(c.j)) > 2.6 && frontRoads([c]).length && Math.hypot(c.i - HALF, c.j - HALF) > 4);
    plots.sort((a, b) => hash(a.i * 7 + 5, a.j * 11 + 3) - hash(b.i * 7 + 5, b.j * 11 + 3));
    const counts = { res: 0, shop: 0, work: 0 };
    for (const c of plots) {
      if (counts.res + counts.shop + counts.work >= 48) break;
      const h = hash(c.i * 13 + 2, c.j * 17 + 4);
      const type = h < 0.58 ? 'res' : h < 0.78 ? 'shop' : 'work';
      if (counts[type] >= { res: 30, shop: 9, work: 9 }[type]) continue;
      const b = placeBlock(type, [c]); counts[type]++;
      const height = hash(c.i * 5 + 23, c.j * 9 + 19);
      b.level = height > 0.91 ? 3 : height > 0.57 ? 2 : 1;
    }
  }
  for (const b of blocks) { if (b.type !== 'station') { b.stage = DONE; for (const u of b.units) rebuildUnitMesh(u); } }
  cam.target.set(cx(HALF), 0, cz(HALF)); cam.tView = cam.view = dense ? 20.5 : 14;
  fastForward(30); S.T = Math.floor(S.T / 24) * 24 + (dense ? 10.4 : 13);
  if (dense) { setWeather('clear', 48); W.cover = W.tCover; W.rain = 0; W.wet = 0; }
  document.getElementById('intro')?.remove(); setTool('explore');
}
window.MT = {
  serviceReady, stageService, hoursOf, isOpen, signalState, routeVaried, placeBlock, removeBlock, rebuildUnitMesh, unitCap, blocks, residents, flocks, workers, trucks, DONE, characterAvailable, cell, cells, cam, fastForward, demoTown, setTool, STATION,
  setHour: h => { S.T = Math.floor(S.T / 24) * 24 + h; }, setDay: (d, h = 12) => { S.T = (d - 1) * 24 + h; }, festivalDay, routeCells, setSpeed: s => { S.speed = s; }, get T() { return S.T; }, households, save, clearSave, setFollow, terrainY, makeCar, moveAlong, carMeshes, scene, openHill, hill, signalCells, canalCells,
  parkCells, hash, townNet, drawRoad, eraseRoad, frontRoads, roadKeepReason, wanderers, TIERS, tierLabel, chooseKind, parkVehicle, renderInspect, refreshCivicFlags, dayOf, chronicle, weather: W, setWeather, seasonOf, talks, puddleSpots, coastDist, beachExtra, canalMouths, pierAngle, islandEllipse, seaRocks, shoreKind, placeCarPark, carParks, placeable, hillMarket, hillPlots, ferry, quality: S.quality, pickerForTool, currentPick, hillCentre, hillCrew, lanterns, landmarks, landmarkRoads, catchToday, eventOn, pierFrame, tourists, tourism, bus, spawnTourist, isWeekend, setLook, milestoneShown, cancelGlide, gliding,
  roadCount: () => { let n = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (cell(i, j).type === 'road') n++; return n; },
  project: (i, j, y = 0) => { const v = new THREE.Vector3(cx(i), y, cz(j)).project(camera); return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }; },
};

resize(); rebuildDecor(); rebuildRoads();
placeStation(); initFerry();   // the slipway and yard beside the pier; cars and materials arrive by sea from here on
{
  const saved = !S.fresh && loadData();
  let restored = 0;
  if (saved && saved.seed === S.seed && saved.biome === S.biome) { restored = restore(saved); lastSave = S.T; document.getElementById('intro')?.remove(); setTool('explore'); }
  else if (new URLSearchParams(location.search).has('demo')) demoTown();
  placeLandmarks();   // after the town is back, so the lighthouse, bridge and pavilion keep clear of anything already built
  // the title screen on a plain visit (src/title.js); straight in after choosing a town or an island, and in test tabs
  const entered = initMenus({ townIsFresh: () => blocks.filter(b => b.type !== 'station').length === 0, onStart: () => { const i = document.getElementById('intro'); if (i) i.hidden = false; } });
  if (entered === 'title') { const i = document.getElementById('intro'); if (i) i.hidden = true; }
  else if (restored) toast('Welcome back to Komachi');
}
addEventListener('pagehide', () => { if (blocks.length > 1) save(); });
document.getElementById('loading').classList.add('gone');
requestAnimationFrame(frame);
