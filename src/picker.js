// Komachi — the building picker: choosing Homes, Shops, Work, Civic or Farms opens a strip of chips above the tool dock, one per
// kind with a small picture of its real model (rendered once, the first time the strip opens), scrolling sideways on phones.
// "Auto" (the first chip) keeps the old way: the drag length sets the size and the town picks what the neighbourhood lacks. A picked
// kind fixes the sizes it comes in (a substation one cell, the town hall two, the square three); one-of-a-kind buildings that are
// already standing are greyed out. Picked shops keep their trade (`b.picked`, saved).
import * as THREE from 'three';
import { TIERS, KIND_LABEL, blocks, DONE } from './world.js';
import { glowMat } from './geometry.js';
import { rebuildUnitMesh } from './buildings.js';
import { townGroup, disposeGroup } from './scene.js';
import { PAL, ROOFS, WALLS, SHOP_WALLS, WORK_WALLS, AWNINGS } from './palette.js';

const KINDS = {
  res: ['detached', 'narrow', 'terrace', 'apartment', 'manshon'],
  shop: ['konbini', 'bakery', 'florist', 'books', 'ramen', 'cafe', 'restaurant', 'grocery', 'supermarket', 'arcade'],
  work: ['studio', 'office', 'workshop', 'factory'],
  civic: ['substation', 'waterworks', 'recycling', 'clinic', 'firestation', 'community', 'townhall', 'bathhouse', 'square'],
  farm: ['field', 'greenhouse', 'paddy'],
};
const SINGLE = new Set(['townhall', 'firestation', 'community']);
const SHORT = { detached: 'House', narrow: 'Narrow house', terrace: 'Terrace', apartment: 'Apartments', manshon: 'Manshon', konbini: 'Konbini', arcade: 'Arcade', recycling: 'Recycling', community: 'Community', waterworks: 'Water works', field: 'Field', paddy: 'Paddies', bathhouse: 'Bath house', square: 'Square' };
/** the block sizes a kind comes in, from the tiers (a konbini 1, a restaurant 2, a factory 3, a public bath 2 or 3) */
const sizesOf = (type, kind) => [1, 2, 3].filter(n => (TIERS[type][n] || []).includes(kind));
const taken = kind => SINGLE.has(kind) && blocks.some(b => b.type === 'civic' && b.kind === kind);

let pick = null, openType = null;   // pick: { type, kind, sizes } or null for Auto
const strip = document.getElementById('picker');
const label = (type, kind) => SHORT[kind] || KIND_LABEL[kind] || kind;
function render(type) {
  if (pick && taken(pick.kind)) pick = null;   // a one-of-a-kind building that now stands: back to Auto
  const chips = [`<button class="chip auto${!pick ? ' on' : ''}" data-kind=""><span class="thumb auto-thumb"><i class="fa-solid fa-wand-magic-sparkles"></i></span><b>Auto</b><small>any size</small></button>`];
  for (const k of KINDS[type]) {
    const sz = sizesOf(type, k), off = taken(k), on = pick && pick.kind === k;
    chips.push(`<button class="chip${on ? ' on' : ''}${off ? ' off' : ''}" data-kind="${k}"${off ? ' disabled' : ''}><span class="thumb"><img data-thumb="${type}:${k}" alt="" src="${thumbs.get(type + ':' + k) || ''}"></span><b>${label(type, k)}</b><small>${off ? 'built' : sz.length > 1 ? `${sz[0]}–${sz[sz.length - 1]} cells` : `${sz[0]} cell${sz[0] > 1 ? 's' : ''}`}</small></button>`);
  }
  strip.innerHTML = `<div class="chips">${chips.join('')}</div>`;
  queueThumbs(type);
}
strip.addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b || b.disabled) return;
  const k = b.dataset.kind; pick = k ? { type: openType, kind: k, sizes: sizesOf(openType, k) } : null;
  for (const c of strip.querySelectorAll('.chip')) c.classList.toggle('on', c === b);
});
/** input.js: the tool changed; the strip opens for the zone tools and closes for the rest (the pick resets with the tool) */
function pickerForTool(t) {
  if (KINDS[t]) { if (openType !== t) { pick = null; openType = t; render(t); } else render(t); strip.classList.add('show'); document.body.classList.add('picking'); }
  else { openType = null; pick = null; strip.classList.remove('show'); document.body.classList.remove('picking'); }
}
const currentPick = () => pick;
const pickLabel = () => pick ? label(pick.type, pick.kind) : null;

// ── thumbnails: each kind built once off-grid, rendered by a small renderer of its own, kept as an image ──
const thumbs = new Map(), queue = [];
let tr = null, tscene = null, tcam = null, busy = false;
function queueThumbs(type) { for (const k of KINDS[type]) if (!thumbs.has(type + ':' + k) && !queue.includes(type + ':' + k)) queue.push(type + ':' + k); if (!busy) pump(); }
function pump() {
  if (!queue.length) { busy = false; if (tr) { tr.dispose(); tr = null; } return; }
  busy = true; const key = queue.shift();
  try { thumbs.set(key, drawThumb(...key.split(':'))); } catch (err) { console.warn('Komachi: thumbnail skipped', key, err); thumbs.set(key, ''); }
  const img = strip.querySelector(`img[data-thumb="${key}"]`); if (img) img.src = thumbs.get(key);
  requestAnimationFrame(pump);   // one a frame, so opening the strip never stalls
}
function drawThumb(type, kind) {
  if (!tr) {
    tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); tr.setSize(144, 112, false); tr.setPixelRatio(1);
    tr.outputColorSpace = THREE.SRGBColorSpace; tr.toneMapping = THREE.ACESFilmicToneMapping; tr.toneMappingExposure = 1.05;
    tscene = new THREE.Scene(); tscene.add(new THREE.HemisphereLight('#eef4f0', '#d9c8ad', 1.1)); const sun = new THREE.DirectionalLight('#fff2dc', 1.9); sun.position.set(-3, 6, 4); tscene.add(sun);
    tcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  }
  const n = sizesOf(type, kind)[0], seed = 0.37;
  const cells = [...Array(n)].map((_, k) => ({ i: 1 + k, j: 1, h: 0, type: 'lot' }));
  const b = { id: -1, type, kind: type === 'res' ? null : kind, variant: type === 'res' ? kind : null, level: type === 'res' && kind === 'detached' ? 2 : 1, stage: DONE, renoT: 0, units: [], cells,
    roof: ROOFS[1], wall: type === 'res' ? WALLS[1] : type === 'shop' ? SHOP_WALLS[2] : WORK_WALLS[1], awning: AWNINGS[1], roofStyle: 'kawara', street: [], crew: [], name: '' };
  for (const c of cells) b.units.push({ id: -1, block: b, cell: c, residents: [], staff: [], inside: new Set(), seed, facing: 0, variant: b.variant,
    winMat: new THREE.MeshStandardMaterial({ color: PAL.window, emissive: PAL.glow, emissiveIntensity: 0, roughness: 0.4 }), glowMat: glowMat.clone() });
  const g = new THREE.Group();
  for (const u of b.units) { rebuildUnitMesh(u); townGroup.remove(u.mesh); if (u.glow) u.glow.visible = false; g.add(u.mesh); }
  tscene.add(g);
  const box = new THREE.Box3(); g.updateMatrixWorld(true); g.traverse(o => { if (o.isMesh && o.visible && !(o.material && o.material.transparent)) box.expandByObject(o); });   // the building, not its glow decal
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  const r = Math.max(size.x, size.z) * 0.5 + size.y * 0.3 + 0.02;
  tcam.left = -r * 1.29; tcam.right = r * 1.29; tcam.top = r; tcam.bottom = -r; tcam.updateProjectionMatrix();
  tcam.position.set(c.x + 6, c.y + 5.2, c.z + 6); tcam.lookAt(c);
  tr.render(tscene, tcam);
  const url = tr.domElement.toDataURL('image/png');
  tscene.remove(g); for (const u of b.units) { disposeGroup(u.mesh); u.winMat.dispose(); u.glowMat.dispose(); }
  return url;
}
export { pickerForTool, currentPick, pickLabel, sizesOf, KINDS };
