// Komachi — pointer/keyboard input, tools, drag-to-zone selection, placement preview, hover picking, name tags
import * as THREE from 'three';
import { PAL } from './palette.js';
import { clamp } from './utils.js';
import { S } from './state.js';
import { canvas, scene, camera, cam, HALF, cx, cz, resize, townGroup, peopleGroup } from './scene.js';
import { cell, blocks, placeBlock, isDecor } from './world.js';
import { residents, removeBlock } from './sim.js';
import { ui, esc } from './ui.js';
import { toast } from './toast.js';

let tool = 'explore', pinned = null, hovered = null, showTags = false;
const ptr = { x: 0, y: 0, ndc: new THREE.Vector2(), down: false, button: 0, panning: false, moved: 0, sel: null, last: { x: 0, y: 0 } };
const raycaster = new THREE.Raycaster(); const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const hitP = new THREE.Vector3();
const keys = new Set();
function setTool(t) { tool = t; ptr.sel = null; document.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); document.body.classList.toggle('placing', t !== 'explore'); if (t !== 'explore') pinned = null; }
document.querySelectorAll('.tool').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
document.querySelectorAll('#speed button').forEach(b => b.addEventListener('click', () => { S.speed = +b.dataset.s; document.querySelectorAll('#speed button').forEach(x => x.classList.toggle('on', x === b)); }));
document.getElementById('btn-pixel').addEventListener('click', e => { S.pixelLook = !S.pixelLook; e.currentTarget.classList.toggle('on', S.pixelLook); document.body.classList.toggle('pixel', S.pixelLook); resize(); });
document.getElementById('btn-labels').addEventListener('click', e => { showTags = !showTags; e.currentTarget.classList.toggle('on', showTags); if (!showTags) ui.tags.innerHTML = ''; });
document.getElementById('btn-center').addEventListener('click', () => { cam.target.set(0, 0, 0); cam.tView = 18; });
document.getElementById('intro-go').addEventListener('click', () => { document.getElementById('intro').remove(); setTool('res'); toast('Drag across up to 3 cells to zone a block of homes'); });

function groundCell() {
  raycaster.setFromCamera(ptr.ndc, camera);
  if (!raycaster.ray.intersectPlane(groundPlane, hitP)) return null;
  return cell(Math.floor(hitP.x + HALF), Math.floor(hitP.z + HALF));
}
function setNdc(e) { ptr.x = e.clientX; ptr.y = e.clientY; ptr.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); }
function selectable(c, sel) {
  if (!c || c.type !== 'empty' || sel.includes(c) || sel.length >= 3) return false;
  return sel.length === 0 || sel.some(s => Math.abs(s.i - c.i) + Math.abs(s.j - c.j) === 1);
}
canvas.addEventListener('pointerdown', e => {
  setNdc(e); ptr.down = true; ptr.button = e.button; ptr.moved = 0; ptr.last = { x: e.clientX, y: e.clientY };
  const zone = tool === 'res' || tool === 'shop' || tool === 'work';
  if (e.button === 0 && zone) { const c = groundCell(); ptr.sel = []; if (selectable(c, ptr.sel)) ptr.sel.push(c); else if (c && c.type !== 'empty') toast(c.type === 'road' ? 'Roads grow on their own around blocks' : 'That spot is already taken'); }
  else { ptr.panning = true; document.body.classList.add('dragging'); }
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  const dx = e.clientX - ptr.last.x, dy = e.clientY - ptr.last.y; ptr.last = { x: e.clientX, y: e.clientY }; setNdc(e);
  if (ptr.down) ptr.moved += Math.abs(dx) + Math.abs(dy);
  if (ptr.panning) {
    const aspect = innerWidth / innerHeight, wx = dx / innerWidth * cam.view * aspect, wy = dy / innerHeight * cam.view / Math.sin(cam.pitch);
    const right = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)), up = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw));
    cam.target.addScaledVector(right, -wx).addScaledVector(up, wy); clampTarget();
  } else if (ptr.sel) {
    const c = groundCell(); if (selectable(c, ptr.sel)) ptr.sel.push(c); else if (c && ptr.sel.length >= 3 && !ptr.sel.includes(c) && c.type === 'empty') { if (!ptr.warned) { toast('A block holds at most 3 buildings'); ptr.warned = true; } }
  }
});
function endPointer(e) {
  if (!ptr.down) return; ptr.down = false; ptr.warned = false; document.body.classList.remove('dragging');
  if (ptr.panning) {
    ptr.panning = false;
    if (ptr.moved < 6 && ptr.button === 0) {
      if (tool === 'remove') { const c = groundCell(); if (c && c.block) { if (c.block.type === 'station') toast('The station is here to stay'); else { const n = c.block.name; removeBlock(c.block); toast(`${n} was removed`); } } }
      else if (tool === 'explore') { pinned = hovered; }
    }
    return;
  }
  if (ptr.sel) { if (ptr.sel.length) { const b = placeBlock(tool, ptr.sel); if (blocks.length === 1) toast('Roads appeared around your first block'); else if (blocks.length === 2 && b.type === 'res') toast('Try a Shop or Workspace so people have somewhere to go'); } ptr.sel = null; }
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('wheel', e => { e.preventDefault(); cam.tView = clamp(cam.tView * (e.deltaY > 0 ? 1.12 : 1 / 1.12), 7, 42); }, { passive: false });
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return; keys.add(e.code);
  if (e.code === 'Digit1') setTool('explore'); if (e.code === 'Digit2') setTool('res'); if (e.code === 'Digit3') setTool('shop'); if (e.code === 'Digit4') setTool('work'); if (e.code === 'Digit5') setTool('remove');
  if (e.code === 'KeyQ') cam.tYaw += Math.PI / 4; if (e.code === 'KeyE') cam.tYaw -= Math.PI / 4;
  if (e.code === 'Space') { e.preventDefault(); S.speed = S.speed ? 0 : 1; document.querySelectorAll('#speed button').forEach(x => x.classList.toggle('on', +x.dataset.s === S.speed)); }
  if (e.code === 'Escape') { setTool('explore'); pinned = null; }
});
addEventListener('keyup', e => keys.delete(e.code));
function clampTarget() { cam.target.x = clamp(cam.target.x, -HALF - 2, HALF + 2); cam.target.z = clamp(cam.target.z, -HALF - 2, HALF + 2); }

// placement preview meshes
const prevMat = { ok: new THREE.MeshBasicMaterial({ color: PAL.mint, transparent: true, opacity: 0.55, depthWrite: false }), bad: new THREE.MeshBasicMaterial({ color: PAL.roofRose, transparent: true, opacity: 0.5, depthWrite: false }), road: new THREE.MeshBasicMaterial({ color: PAL.cream2, transparent: true, opacity: 0.45, depthWrite: false }) };
const prevPool = []; for (let k = 0; k < 20; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.04, 0.92), prevMat.ok); m.visible = false; m.position.y = 0.16; scene.add(m); prevPool.push(m); }
const ringMat = new THREE.MeshBasicMaterial({ color: PAL.mint, transparent: true, opacity: 0.7, depthWrite: false });
const hoverRings = []; for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.03, 1.06), ringMat); m.visible = false; m.position.y = 0.135; scene.add(m); hoverRings.push(m); }
function updatePreview() {
  let n = 0;
  const show = (c, m) => { if (n >= prevPool.length) return; const p = prevPool[n++]; p.visible = true; p.material = m; p.position.x = cx(c.i); p.position.z = cz(c.j); };
  const zone = tool === 'res' || tool === 'shop' || tool === 'work';
  if (zone && !ptr.panning) {
    const sel = ptr.sel && ptr.sel.length ? ptr.sel : null;
    if (sel) {
      for (const c of sel) show(c, prevMat.ok);
      const ring = new Set(); for (const c of sel) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = cell(c.i + di, c.j + dj); if (q && q.type === 'empty' && !sel.includes(q)) ring.add(q); }
      for (const q of ring) show(q, prevMat.road);
    } else if (!ptr.sel) {
      const c = groundCell();
      if (c) { show(c, c.type === 'empty' ? prevMat.ok : prevMat.bad); if (c.type === 'empty') for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const q = cell(c.i + di, c.j + dj); if (q && q.type === 'empty' && q !== c) show(q, prevMat.road); } }
    }
  }
  for (let k = n; k < prevPool.length; k++) prevPool[k].visible = false;
}
function updateHover() {
  hovered = null;
  if (!ptr.panning && !ptr.sel) {
    raycaster.setFromCamera(ptr.ndc, camera);
    const hits = raycaster.intersectObjects([townGroup, peopleGroup], true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.unit && !o.userData.res) o = o.parent; if (o && (o.userData.unit || o.userData.res)) { hovered = o.userData; break; } if (isDecor(h.object)) break; }
  }
  const target = pinned || hovered;
  const hu = target && target.unit ? target.unit : null;
  hoverRings.forEach((m, k) => { const u = hu ? hu.block.units[k] : null; m.visible = !!u && hu.block.stage >= 0; if (u) { m.position.x = cx(u.cell.i); m.position.z = cz(u.cell.j); } });
  if (tool === 'remove' && hovered && hovered.unit && hovered.unit.block.type !== 'station') ringMat.color.set(PAL.roofRose); else ringMat.color.set(PAL.mint);
  canvas.style.cursor = tool !== 'explore' ? 'crosshair' : (hovered ? 'pointer' : (ptr.panning ? 'grabbing' : 'grab'));
}
const tagV = new THREE.Vector3();
function updateTags() {
  if (!showTags) return;
  let html = '', n = 0;
  for (const r of residents) { if (r.state !== 'walking' || n > 40) continue; tagV.copy(r.mesh.position); tagV.y += 0.6; tagV.project(camera); if (tagV.z > 1) continue;
    html += `<div class="tag" style="left:${(tagV.x + 1) / 2 * innerWidth}px;top:${(1 - tagV.y) / 2 * innerHeight}px">${esc(r.name.split(' ')[0])}</div>`; n++; }
  ui.tags.innerHTML = html;
}

const inspectTarget = () => pinned || hovered;
export { keys, setTool, updatePreview, updateHover, updateTags, inspectTarget, clampTarget };
