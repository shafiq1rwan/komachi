// Komachi — pointer/keyboard input, tools, drag-to-zone selection, placement preview, hover picking, name tags
import * as THREE from 'three';
import { PAL } from './palette.js';
import { clamp } from './utils.js';
import { S } from './state.js';
import { canvas, scene, camera, cam, HALF, cx, cz, townGroup, peopleGroup } from './scene.js';
import { cell, blocks, placeBlock, isDecor, DONE, stageHours, placeable, STATION, rotateUnit, hill, HILL_UNLOCK, roadRun, drawable, drawRoad, eraseRoad, roadKeepReason, joinedToTown, tierLabel, placeCarPark } from './world.js';
import { removeBlock, removeCarPark, residents, daylight } from './sim.js';
import { workers } from './construction.js';
import { tourists } from './tourists.js';
import { pickerForTool, currentPick, pickLabel, onPickerMode } from './picker.js';
import { ui, esc } from './ui.js';
import { toast } from './toast.js';

let tool = 'explore', pinned = null, hovered = null, follow = null;
const ptr = { x: 0, y: 0, ndc: new THREE.Vector2(), down: false, button: 0, panning: false, moved: 0, sel: null, last: { x: 0, y: 0 } };
const raycaster = new THREE.Raycaster(); const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const hitP = new THREE.Vector3();
const keys = new Set();
const touches = new Map();   // pointerId -> {x, y}
let gesture = null;          // {dist, ang, view, yaw} while two fingers are down
function setTool(t) { tool = t; pickerForTool(t); ptr.sel = null; ptr.road = null; ptr.erase = null; if (t !== 'explore') follow = null; document.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === (t === 'park' ? 'road' : t))); document.body.classList.toggle('placing', t !== 'explore'); if (t !== 'explore') pinned = null; }
document.querySelectorAll('.tool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
onPickerMode(setTool);   // the Streets strip's Street | Car park chips switch between the two tools
document.querySelectorAll('#speed button').forEach(b => b.addEventListener('click', () => { S.speed = +b.dataset.s; document.querySelectorAll('#speed button').forEach(x => x.classList.toggle('on', x === b)); }));
// the inspect card's follow button
/** turn the hovered or pinned building to face its next street */
function rotateTarget() {
  const t = pinned || hovered; const u = t && t.unit; if (!u || u.block.type === 'station') return;
  if (!rotateUnit(u)) toast('Only one side of this building faces a street');
}
ui.inspect.addEventListener('click', e => {
  if (e.target.closest('[data-rotate]')) { rotateTarget(); return; }
  // a name on any card pins and follows that resident
  const li = e.target.closest('li[data-res]');
  if (li) { const r = residents.find(x => x.id === +li.dataset.res); if (r && r.state !== 'away') setFollow(r); return; }
  const b = e.target.closest('[data-follow]'); if (!b) return;
  if (b.dataset.follow === 'stop') { setFollow(null); return; }
  const t = pinned || hovered || (follow ? { res: follow } : null); if (t && t.res) { follow = t.res; pinned = t; }
});
for (const [btn, panel] of [['btn-settings', 'settings'], ['btn-stats', 'stats']]) document.getElementById(btn).addEventListener('click', e => { const s = document.getElementById(panel); const open = s.classList.toggle('collapsed') === false; e.currentTarget.classList.toggle('on', open); e.currentTarget.setAttribute('aria-expanded', String(open)); });
if (innerWidth < 720) { document.getElementById('stats').classList.add('collapsed'); const b = document.getElementById('btn-stats'); b.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); }   // phones: figures start folded so both cards fit side by side
// the controls card folds into a round icon button after a few seconds; click to unfold (it folds again on its own)
{
  const hint = document.getElementById('hint'); let hintTimer = 0;
  const fold = () => hint.classList.add('collapsed');
  const unfold = (ms) => { hint.classList.remove('collapsed'); clearTimeout(hintTimer); hintTimer = setTimeout(fold, ms); };
  hintTimer = setTimeout(fold, 5000);
  document.getElementById('hint-toggle').addEventListener('click', () => { if (hint.classList.contains('collapsed')) unfold(8000); else { clearTimeout(hintTimer); fold(); } });
}
document.getElementById('intro-go').addEventListener('click', () => { document.getElementById('intro').remove(); setTool('explore'); toast('Pick Homes (2) and drag beside the station ring; draw more streets with the Streets tool (5)'); });

function groundCell() {
  raycaster.setFromCamera(ptr.ndc, camera);
  if (!raycaster.ray.intersectPlane(groundPlane, hitP)) return null;
  return cell(Math.floor(hitP.x + HALF), Math.floor(hitP.z + HALF));
}
function setNdc(e) { ptr.x = e.clientX; ptr.y = e.clientY; ptr.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); }
function selectable(c, sel) {
  const pk = currentPick(), max = tool === 'park' ? 2 : pk ? Math.max(...pk.sizes) : 3;   // a picked kind caps the drag at its largest size
  if (!placeable(c, sel) || sel.includes(c) || sel.length >= max) return false;
  return sel.length === 0 || sel.some(s => Math.abs(s.i - c.i) + Math.abs(s.j - c.j) === 1);
}
canvas.addEventListener('pointerdown', e => {
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) {   // second finger: cancel pan/selection, start a pinch gesture
    const [a, b] = [...touches.values()]; gesture = { dist: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x), view: cam.tView, yaw: cam.tYaw }; follow = null;
    ptr.sel = null; ptr.panning = false; ptr.down = false; document.body.classList.remove('dragging'); canvas.setPointerCapture(e.pointerId); return;
  }
  if (touches.size > 2) return;
  setNdc(e); ptr.down = true; ptr.button = e.button; ptr.moved = 0; ptr.last = { x: e.clientX, y: e.clientY };
  const zone = tool === 'res' || tool === 'shop' || tool === 'work' || tool === 'park' || tool === 'civic' || tool === 'farm';
  if (e.button === 0 && tool === 'road') { const c = groundCell(); if (c && drawable(c, c.h || 0)) ptr.road = { a: c, b: c }; else if (c) toast(c.type === 'water' ? 'Streets stay on land' : (c.h || 0) > 0 && !hill.open ? `The hill opens once ${HILL_UNLOCK} people live in town` : c.type === 'lot' ? 'There is a building here' : c.type === 'hill' ? 'Too steep for a street' : 'A street cannot start here'); }
  else if (e.button === 0 && tool === 'remove' && (c => c && c.type === 'road' && !c.block)(groundCell())) { const c = groundCell(); ptr.erase = { a: c, b: c }; }   // drag along a street to clear a run
  else if (e.button === 0 && zone) { const c = groundCell(); ptr.sel = []; if (selectable(c, ptr.sel)) ptr.sel.push(c); else if (c && (c.type !== 'empty' || ((c.h || 0) > 0 && !hill.open))) toast(c.type === 'canal' ? 'Nothing is built in the canal; draw a street across it and a bridge will span it' : c.coast ? 'The coast road stays open' : (c.h || 0) > 0 && !hill.open ? `The hill opens once ${HILL_UNLOCK} people live in town` : c.keep || c.ramp ? 'The hill road stays open' : c.type === 'road' ? 'Buildings go beside a street, not on it' : c.type === 'hill' ? 'This part of the hill is too steep to build on' : c.type === 'water' ? 'Nothing is built on the water' : 'That spot is already taken'); else if (c && c.type === 'empty' && !placeable(c, [])) toast([[0, -1], [1, 0], [0, 1], [-1, 0]].some(([di, dj]) => { const n = cell(c.i + di, c.j + dj); return n && n.type === 'road' && !joinedToTown(n); }) ? 'That street does not reach the station yet; join it up first' : 'Draw a street here first (Road tool, 5), then zone beside it'); }
  else { ptr.panning = true; document.body.classList.add('dragging'); }
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture && touches.size >= 2) {
    const [a, b] = [...touches.values()]; const dist = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    cam.tView = clamp(gesture.view * (gesture.dist / Math.max(20, dist)), 3, 42);
    let da = ang - gesture.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); cam.tYaw = gesture.yaw - da;
    return;
  }
  const dx = e.clientX - ptr.last.x, dy = e.clientY - ptr.last.y; ptr.last = { x: e.clientX, y: e.clientY }; setNdc(e);
  if (ptr.down) ptr.moved += Math.abs(dx) + Math.abs(dy);
  if (ptr.panning) {
    if (ptr.moved > 6) follow = null;
    const aspect = innerWidth / innerHeight, wx = dx / innerWidth * cam.view * aspect, wy = dy / innerHeight * cam.view / Math.sin(cam.pitch);
    const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)), up = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
    cam.target.addScaledVector(right, -wx).addScaledVector(up, wy); clampTarget();
  } else if (ptr.road) {
    const c = groundCell(); if (c) ptr.road.b = c;
  } else if (ptr.erase) {
    const c = groundCell(); if (c) ptr.erase.b = c;
  } else if (ptr.sel) {
    const c = groundCell(); if (selectable(c, ptr.sel)) ptr.sel.push(c); else if (c && ptr.sel.length >= 3 && !ptr.sel.includes(c) && placeable(c, ptr.sel)) { if (!ptr.warned) { toast('A block holds at most 3 buildings'); ptr.warned = true; } }
  }
});
function endPointer(e) {
  touches.delete(e.pointerId);
  if (gesture) { if (touches.size < 2) gesture = null; return; }
  if (!ptr.down) return; ptr.down = false; ptr.warned = false; document.body.classList.remove('dragging');
  if (ptr.panning) {
    ptr.panning = false;
    if (ptr.moved < 6 && ptr.button === 0) {
      if (tool === 'remove') { const c = groundCell(); if (c && c.park === 'public') { removeCarPark(c); toast('Parking removed'); } else if (c && c.block) { if (c.block.type === 'station') toast('The station is here to stay'); else { const n = c.block.name; removeBlock(c.block); toast(`${n} was removed`); } } else if (c && c.type === 'road') { const why = roadKeepReason(c); if (!why) { eraseRoad(c); toast('Street removed'); } else toast(why === 'needed' ? 'A building still opens onto this street' : why === 'island' ? "The island's road stays" : "The station's ring stays"); } }
      else if (tool === 'explore') { updateHover(); pinned = hovered; }
    }
    return;
  }
  if (ptr.erase) {
    const { a, b } = ptr.erase; ptr.erase = null; const run = roadRun(a, b).filter(c => c.type === 'road');
    if (run.length <= 1) { const c = run[0] || a; const why = roadKeepReason(c); if (!why) { eraseRoad(c); toast('Street removed'); } else toast(why === 'needed' ? 'A building still opens onto this street' : why === 'island' ? "The island's road stays" : "The station's ring stays"); return; }
    let n = 0, kept = 0; for (const c of run) { if (roadKeepReason(c)) kept++; else if (eraseRoad(c)) n++; }
    toast(n ? (kept ? `${n} street cells removed; ${kept} stay because buildings open onto them` : `${n} street cells removed`) : 'Those streets stay: buildings open onto them, or they are the island\'s'); return;
  }
  if (ptr.road) { const { a, b } = ptr.road; ptr.road = null; const laid = drawRoad(a, b); if (!laid) toast('Streets run over land on one level, or straight across the canal'); else if (laid.length === 1) toast('Drag to draw a longer street'); else if (!joinedToTown(laid[0])) toast('Join this street to the station ring so people can reach it'); return; }
  if (ptr.sel && tool === 'park') { const sel = ptr.sel; ptr.sel = null; if (sel.length && !sel.every(c => placeable(c, sel))) toast('A car park needs a street on one side'); else if (sel.length) { placeCarPark(sel); toast(sel.length > 1 ? 'A car park with eight bays. Cars from homes and workplaces nearby will use it' : 'A small car park with four bays. Cars from homes and workplaces nearby will use it'); } return; }
  const pk = currentPick();
  if (ptr.sel && pk && ptr.sel.length && !pk.sizes.includes(ptr.sel.length)) { const n = pk.sizes; toast(`${pickLabel()} needs ${n.length > 1 ? n[0] + ' or ' + n[n.length - 1] : n[0]} cell${n[n.length - 1] > 1 ? 's' : ''}: drag along the street`); ptr.sel = null; return; }
  if (ptr.sel) { if (ptr.sel.length && !ptr.sel.every(c => placeable(c, ptr.sel))) toast('Every building needs a street on one side'); else if (ptr.sel.length) { const b = placeBlock(tool, ptr.sel, pk ? (tool === 'res' ? { variant: pk.kind, picked: true } : { kind: pk.kind, picked: true }) : null); pickerForTool(tool); if (blocks.length === 1) toast('Your first block. Draw more streets with the Streets tool (5) and zone beside them'); else if (blocks.length === 2 && b.type === 'res') toast('Try a Shop or Workspace so people have somewhere to go'); } ptr.sel = null; }
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); cam.tView = clamp(cam.tView * (e.deltaY > 0 ? 1.12 : 1 / 1.12), 3, 42); }, { passive: false });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return; keys.add(e.code);
  if (e.code === 'Digit1') setTool('explore'); if (e.code === 'Digit2') setTool('res'); if (e.code === 'Digit3') setTool('shop'); if (e.code === 'Digit4') setTool('work'); if (e.code === 'Digit5') setTool('road'); if (e.code === 'Digit6') setTool('remove'); if (e.code === 'Digit7') setTool('park'); if (e.code === 'Digit8') setTool('civic'); if (e.code === 'Digit9') setTool('farm');
  if (e.code === 'KeyQ') cam.tYaw += Math.PI / 4; if (e.code === 'KeyE') cam.tYaw -= Math.PI / 4;
  if (e.code === 'KeyR') rotateTarget();
  if (e.code === 'Space') { e.preventDefault(); S.speed = S.speed ? 0 : 1; document.querySelectorAll('#speed button').forEach(x => x.classList.toggle('on', +x.dataset.s === S.speed)); }
  if (e.code === 'Escape') { setTool('explore'); pinned = null; follow = null; }
});
addEventListener('keyup', e => keys.delete(e.code));
function clampTarget() { cam.target.x = clamp(cam.target.x, -HALF - 2, HALF + 2); cam.target.z = clamp(cam.target.z, -HALF - 2, HALF + 2); }

// placement preview meshes
const prevMat = { keep: new THREE.MeshBasicMaterial({ color: PAL.concrete2, transparent: true, opacity: 0.5, depthWrite: false }), ok: new THREE.MeshBasicMaterial({ color: PAL.mint, transparent: true, opacity: 0.55, depthWrite: false }), bad: new THREE.MeshBasicMaterial({ color: PAL.roofRose, transparent: true, opacity: 0.5, depthWrite: false }), road: new THREE.MeshBasicMaterial({ color: PAL.cream2, transparent: true, opacity: 0.45, depthWrite: false }) };
const prevPool = []; for (let k = 0; k < 20; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.04, 0.92), prevMat.ok); m.visible = false; m.position.y = 0.16; scene.add(m); prevPool.push(m); }
const ringMat = new THREE.MeshBasicMaterial({ color: PAL.mint, transparent: true, opacity: 0.7, depthWrite: false });
// one ring per cell: blocks hold up to 3, the station 9
const hoverRings = []; for (let k = 0; k < 9; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.03, 1.06), ringMat); m.visible = false; m.position.y = 0.135; scene.add(m); hoverRings.push(m); }
const tierEl = document.getElementById('tier');
function updatePreview() {
  let n = 0;
  const zoneDrag = ptr.sel && ptr.sel.length && (tool === 'res' || tool === 'shop' || tool === 'work' || tool === 'park' || tool === 'civic' || tool === 'farm');
  if (zoneDrag) { const pk = currentPick(), t = pk && tool !== 'park' ? `${pickLabel()} · ${ptr.sel.length} of ${pk.sizes.length > 1 ? pk.sizes[0] + '–' + pk.sizes[pk.sizes.length - 1] : pk.sizes[0]} cell${Math.max(...pk.sizes) > 1 ? 's' : ''}` : tierLabel(tool, Math.min(3, ptr.sel.length)); if (tierEl.textContent !== t) tierEl.textContent = t; tierEl.classList.add('show'); } else tierEl.classList.remove('show');
  const show = (c, m) => { if (n >= prevPool.length) return; const p = prevPool[n++]; p.visible = true; p.material = m; p.position.set(cx(c.i), 0.16 + (c.h || 0), cz(c.j)); };
  const zone = tool === 'res' || tool === 'shop' || tool === 'work' || tool === 'park' || tool === 'civic' || tool === 'farm';
  if (zone && !ptr.panning) {
    const sel = ptr.sel && ptr.sel.length ? ptr.sel : null;
    if (sel) {
      for (const c of sel) show(c, prevMat.ok);

    } else if (!ptr.sel) {
      const c = groundCell();
      if (c) show(c, placeable(c) ? prevMat.ok : prevMat.bad);
    }
  }
  if (tool === 'remove' && !ptr.panning) {   // street cells: rose if they can go, grey if something still needs them
    if (ptr.erase) { for (const c of roadRun(ptr.erase.a, ptr.erase.b)) if (c.type === 'road') show(c, roadKeepReason(c) ? prevMat.keep : prevMat.bad); }
    else if (!hovered) { const c = groundCell(); if (c && c.type === 'road') show(c, roadKeepReason(c) ? prevMat.keep : prevMat.bad); }
  }
  if (tool === 'road' && !ptr.panning) {
    if (ptr.road) { const h = ptr.road.a.h || 0; for (const c of roadRun(ptr.road.a, ptr.road.b)) show(c, drawable(c, h) ? prevMat.road : prevMat.bad); }
    else { const c = groundCell(); if (c) show(c, drawable(c, c.h || 0) ? prevMat.road : prevMat.bad); }
  }
  for (let k = n; k < prevPool.length; k++) prevPool[k].visible = false;
}
const pickV = new THREE.Vector3();
/** people are small and keep moving, so the hover snaps to the nearest walker within a few screen pixels */
function nearestPerson() {
  const R = 18; let best = null, bd = R * R;
  const test = (p, data) => {
    pickV.copy(p); pickV.y += 0.2; pickV.project(camera); if (pickV.z > 1) return;
    const dx = (pickV.x + 1) / 2 * innerWidth - ptr.x, dy = (1 - pickV.y) / 2 * innerHeight - ptr.y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = data; }
  };
  for (const r of residents) { if (r.state === 'away' || (r.state === 'inside' && !r.mesh.visible)) continue; test(r.state === 'driving' && r.car ? r.car.position : r.mesh.position, { res: r }); }
  for (const k of workers) if (k.mesh && k.mesh.visible) test(k.mesh.position, { worker: k });
  for (const t of tourists) if (t.mesh.visible) test(t.mesh.position, { tourist: t });
  return best;
}
function updateHover() {
  hovered = null;
  if (!ptr.panning && !ptr.sel) {
    hovered = nearestPerson(); if (hovered) return finishHover();
    raycaster.setFromCamera(ptr.ndc, camera);
    const hits = raycaster.intersectObjects([townGroup, peopleGroup], true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.unit && !o.userData.res && !o.userData.worker && !o.userData.tourist) o = o.parent; if (o && (o.userData.unit || o.userData.res || o.userData.worker || o.userData.tourist)) { hovered = o.userData.tourist ? { tourist: o.userData.tourist } : o.userData; break; } if (isDecor(h.object)) break; }
  }
  finishHover();
}
function finishHover() {
  const target = pinned || hovered;
  const hu = target && target.unit ? target.unit : null;
  hoverRings.forEach((m, k) => { const u = hu ? hu.block.units[k] : null; m.visible = !!u && hu.block.stage >= 0; if (u) m.position.set(cx(u.cell.i), 0.135 + (u.cell.h || 0), cz(u.cell.j)); });
  if (tool === 'remove' && hovered && hovered.unit && hovered.unit.block.type !== 'station') ringMat.color.set(PAL.roofRose); else ringMat.color.set(PAL.mint);
  ringMat.opacity = 0.25 + 0.45 * daylight();   // the highlight is unlit, so it would glow at night; fade it with the light
  canvas.style.cursor = tool !== 'explore' ? 'crosshair' : (hovered ? 'pointer' : (ptr.panning ? 'grabbing' : 'grab'));
}
const tagV = new THREE.Vector3();
/** a name tag floats over the followed resident and the pinned one, so they are easy to find in a crowd */
function updateTags() {
  let html = '';
  const tagged = new Set(); if (follow) tagged.add(follow); if (pinned && pinned.res) tagged.add(pinned.res);
  for (const r of tagged) {
    if (r.state === 'away' || (r.state === 'inside' && r.at && r.at !== STATION.anchor)) continue;
    const p = r.state === 'driving' && r.car ? r.car.position : r.mesh.position;
    tagV.copy(p); tagV.y += 0.45; tagV.project(camera); if (tagV.z > 1) continue;
    html += `<div class="tag${r === follow ? ' follow' : ''}" style="left:${(tagV.x + 1) / 2 * innerWidth}px;top:${(1 - tagV.y) / 2 * innerHeight}px">${esc(r.name.split(' ')[0])}</div>`;
  }
  if (html || ui.tags.innerHTML) ui.tags.innerHTML = html;
}

const barV = new THREE.Vector3();
/** small progress pills above blocks that are being built or extended */
function updateBars() {
  if (cam.view > 30) { ui.bars.innerHTML = ''; return; }
  let html = '';
  for (const b of blocks) {
    if (b.type === 'station') continue;
    const building = b.stage < DONE, reno = !building && b.renoT > 0; if (!building && !reno) continue;
    const SH = stageHours(b), total = SH.reduce((a, c) => a + c, 0);
    const p = building ? (SH.slice(0, b.stage).reduce((a, c) => a + c, 0) + b.stageT) / total : 1 - b.renoT / 2.5;
    const cxm = b.cells.reduce((s, c) => s + cx(c.i), 0) / b.cells.length, czm = b.cells.reduce((s, c) => s + cz(c.j), 0) / b.cells.length;
    barV.set(cxm, 1.35 + (b.cells[0].h || 0), czm).project(camera); if (barV.z > 1) continue;
    html += `<div class="pbar${reno ? ' reno' : ''}" style="left:${(barV.x + 1) / 2 * innerWidth}px;top:${(1 - barV.y) / 2 * innerHeight}px"><i><b style="width:${Math.round(p * 100)}%"></b></i><span>${reno ? 'extending' : Math.round(p * 100) + '%'}</span></div>`;
  }
  ui.bars.innerHTML = html;
}
const inspectTarget = () => pinned || hovered || (follow ? { res: follow } : null);
const followTarget = () => follow;
function setFollow(r) { if (!r && follow && pinned && pinned.res === follow) pinned = null; follow = r; if (r) pinned = { res: r }; }
export { keys, setTool, updatePreview, updateHover, updateTags, updateBars, inspectTarget, clampTarget, followTarget, setFollow };
