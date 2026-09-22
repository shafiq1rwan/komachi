// Small things a seated person takes out: a phone and a folded newspaper. Vertex colours, no textures, built at the
// box-people tool scale so holdTool() sizes them for a chibi hand (handle axis +y, which the hand turns to point forward).
import * as THREE from 'three';
import { PAL } from './palette.js';

function build(parts) {
  const geos = [];
  for (const [g, color] of parts) {
    const geo = g.index ? g.toNonIndexed() : g; if (geo !== g) g.dispose(); geo.deleteAttribute('uv');
    const c = new THREE.Color(color), a = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) c.toArray(a, i);
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); geos.push(geo);
  }
  const all = new THREE.BufferGeometry(); const pos = [], col = [], nor = [];
  for (const g of geos) { pos.push(...g.attributes.position.array); col.push(...g.attributes.color.array); nor.push(...g.attributes.normal.array); g.dispose(); }
  all.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); all.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); all.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(all, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, flatShading: true }));
  mesh.castShadow = false; mesh.userData.handItem = true; return mesh;
}
const slab = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
/** a phone: dark body, pale lit screen on the +z face */
export function createPhone() {
  return build([[slab(0.026, 0.05, 0.004, 0, 0.025, 0), '#4a4340'], [slab(0.021, 0.042, 0.002, 0, 0.026, 0.0025), PAL.window], [slab(0.006, 0.002, 0.002, 0, 0.0475, 0.0025), '#4a4340']]);
}
/** a folded newspaper: cream pages with a grey headline band */
export function createNewspaper() {
  return build([[slab(0.05, 0.07, 0.005, 0, 0.035, 0), PAL.cream], [slab(0.052, 0.072, 0.002, 0, 0.035, -0.0035), PAL.cream2], [slab(0.036, 0.012, 0.0015, 0, 0.058, 0.0032), PAL.concrete2], [slab(0.036, 0.003, 0.0015, 0, 0.04, 0.0032), PAL.concrete2], [slab(0.036, 0.003, 0.0015, 0, 0.03, 0.0032), PAL.concrete2], [slab(0.02, 0.014, 0.0015, -0.008, 0.017, 0.0032), PAL.sky2]]);
}
