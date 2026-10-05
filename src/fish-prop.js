// Komachi fish props, in the toy-like style of the Kenney people: a chubby, smoothly shaded lathe body in two tones, fat
// squashed-sphere fins, a big dark eye with a highlight. Nose along +Z, belly -Y, grip at the body centre, game units.
// `Fish_Tail` is a pivot at the tail wrist so the catch can wriggle (`animateFishProp`). Five kinds; the market lays them on
// their sides (the flounder flat). Everything is primitives merged into two meshes: the body and the tail.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export const FISH_PROP_KINDS = ['sardine', 'horse-mackerel', 'flounder', 'rockfish', 'sea-bream'];
/** palette = PAL.fish entry; length nose to tail; sx/sy squash the round body (flat fish use width/height instead) */
export const FISH_PROFILES = {
  sardine: { palette: 'sardine', length: 0.12, sx: 0.5, sy: 0.8, fork: 0.9 },
  'horse-mackerel': { palette: 'mackerel', length: 0.15, sx: 0.55, sy: 0.92, fork: 1.15 },
  flounder: { palette: 'flounder', length: 0.17, width: 0.068, height: 0.028, flat: true },
  rockfish: { palette: 'rockfish', length: 0.18, sx: 0.78, sy: 1.12, spiny: true, fork: 0.8 },
  'sea-bream': { palette: 'bream', length: 0.2, sx: 0.66, sy: 1.18, fork: 1 },
};
const kindOf = options => {
  if (typeof options === 'string') return FISH_PROFILES[options] ? options : 'sea-bream';
  const name = (options.name || '').replace(/^(a|an) /, '').replace(/^small /, '').replaceAll(' ', '-');
  return FISH_PROFILES[name] ? name : FISH_PROFILES[options.species] ? options.species : options.flat ? 'flounder' : 'sea-bream';
};
const smooth = t => { const k = Math.max(0, Math.min(1, t)); return k * k * (3 - 2 * k); };

/** one colour on a whole geometry */
function tinted(geometry, color) {
  const g = geometry; const n = g.attributes.position.count, colors = new Float32Array(n * 3), c = new THREE.Color(color);
  for (let i = 0; i < n; i++) c.toArray(colors, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.deleteAttribute('uv'); return g;
}
/** a squashed sphere: the fat, rounded fin or lobe of a toy fish */
function blob(sx, sy, sz, color, x, y, z, rx = 0, ry = 0, rz = 0) {
  const g = new THREE.SphereGeometry(1, 10, 7); g.scale(sx, sy, sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return tinted(g, color);
}
/** the round body: a lathe along z with a blunt rounded snout, a fat middle and a narrow tail wrist, two-tone by height */
function roundBody(profile, palette) {
  const L = profile.length;
  const pts = [[0, -0.42], [0.07, -0.41], [0.13, -0.33], [0.2, -0.2], [0.245, -0.05], [0.25, 0.1], [0.225, 0.26], [0.17, 0.38], [0.09, 0.46], [0, 0.5]].map(([r, y]) => new THREE.Vector2(r * L, y * L));
  const g = new THREE.LatheGeometry(pts, 14); g.rotateX(Math.PI / 2); g.scale(profile.sx, profile.sy, 1);
  g.computeBoundingBox(); const b = g.boundingBox, H = b.max.y - b.min.y, p = g.attributes.position, colors = new Float32Array(p.count * 3);
  const back = new THREE.Color(palette.back), skin = new THREE.Color(palette.color), belly = new THREE.Color(palette.belly), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const h = (p.getY(i) - b.min.y) / H;
    c.copy(skin); if (h > 0.6) c.lerp(back, smooth((h - 0.6) / 0.25)); else if (h < 0.42) c.lerp(belly, smooth((0.42 - h) / 0.22));
    c.toArray(colors, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.deleteAttribute('uv'); return g;
}
/** the flat fish: a wide oval disc with a frill of fin round it, eyes on top */
function flatBody(profile, palette) {
  const L = profile.length, W = profile.width, H = profile.height;
  const g = new THREE.SphereGeometry(1, 16, 10); g.scale(W, H, L * 0.47); g.translate(0, 0, 0.02 * L);
  g.computeBoundingBox(); const b = g.boundingBox, p = g.attributes.position, colors = new Float32Array(p.count * 3);
  const back = new THREE.Color(palette.back), skin = new THREE.Color(palette.color), belly = new THREE.Color(palette.belly), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const h = (p.getY(i) - b.min.y) / (b.max.y - b.min.y); c.copy(h > 0.5 ? skin : belly); if (h > 0.5) c.lerp(back, smooth((h - 0.5) / 0.5) * 0.55); c.toArray(colors, i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); g.deleteAttribute('uv'); return g;
}

/** A chubby toy fish of merged primitives: body mesh (with eyes and fins) and the tail mesh on the `Fish_Tail` pivot. */
export function createFishProp(options = 'sea-bream') {
  const kind = kindOf(options), profile = FISH_PROFILES[kind], palette = PAL.fish[profile.palette];
  const root = new THREE.Group(); root.name = `Fish_${kind.replaceAll('-', '_')}`;
  root.userData.propKind = 'fish'; root.userData.species = kind; root.userData.grip = [0, 0, 0];
  const L = profile.length, parts = [], tailParts = [];
  const eye = (x, y, z, r, up = false) => {
    parts.push(blob(r, r * 1.15, r, PAL.fish.eye, x, y, z));
    parts.push(blob(r * 0.34, r * 0.34, r * 0.34, PAL.fish.eyeRim, x + (up ? r * 0.3 : Math.sign(x) * r * 0.55), y + (up ? r * 0.75 : r * 0.45), z + r * 0.4));
  };
  if (profile.flat) {
    const W = profile.width, H = profile.height;
    parts.push(flatBody(profile, palette));
    parts.push(blob(W * 1.12, H * 0.45, L * 0.46, palette.fin, 0, -H * 0.1, 0.02 * L));   // the frill of fin round the disc
    eye(W * 0.22, H * 0.9, L * 0.26, L * 0.045, true); eye(-W * 0.22, H * 0.9, L * 0.26, L * 0.045, true);
    parts.push(blob(L * 0.035, H * 0.5, L * 0.012, PAL.fish.mouth, 0, H * 0.3, L * 0.47));
    const tail = new THREE.Group(); tail.name = 'Fish_Tail'; tail.position.z = -0.42 * L; root.add(tail);
    tailParts.push(blob(W * 0.42, H * 0.5, L * 0.13, palette.fin, 0, 0, -L * 0.1));
  } else {
    parts.push(roundBody(profile, palette));
    const hx = 0.25 * L * profile.sx;   // the body's half width at the head
    eye(hx * 0.78, 0.07 * L * profile.sy, 0.27 * L, L * 0.055); eye(-hx * 0.78, 0.07 * L * profile.sy, 0.27 * L, L * 0.055);
    parts.push(blob(L * 0.05, L * 0.012, L * 0.02, PAL.fish.mouth, 0, -0.05 * L * profile.sy, 0.47 * L));   // a small mouth
    if (profile.spiny) for (let k = 0; k < 4; k++) { const cone = new THREE.ConeGeometry(L * 0.028, L * 0.11, 7); cone.rotateX(-0.35); cone.translate(0, 0.25 * L * profile.sy + L * 0.03, 0.1 * L - k * 0.085 * L); parts.push(tinted(cone, palette.fin)); }
    else parts.push(blob(L * 0.03, L * 0.11, L * 0.2, palette.fin, 0, 0.24 * L * profile.sy, -0.02 * L, 0.3));   // dorsal fin
    for (const s of [1, -1]) parts.push(blob(L * 0.1, L * 0.03, L * 0.065, palette.fin, s * hx * 0.9, -0.06 * L * profile.sy, 0.1 * L, 0, s * 0.7, s * 0.25));   // pectoral fins
    parts.push(blob(L * 0.035, L * 0.07, L * 0.05, palette.fin, 0, -0.22 * L * profile.sy, -0.15 * L, -0.4));   // anal fin
    const tail = new THREE.Group(); tail.name = 'Fish_Tail'; tail.position.z = -0.42 * L; root.add(tail);
    for (const s of [1, -1]) tailParts.push(blob(L * 0.03, L * 0.075 * profile.fork, L * 0.15, palette.fin, 0, s * 0.07 * L * profile.fork, -0.1 * L, s * 0.55));   // the fork's two lobes
  }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.04 });
  for (const [target, parent, name] of [[parts, root, 'Fish_Body'], [tailParts, root.getObjectByName('Fish_Tail'), 'Fish_Tail_Fin']]) {
    const merged = mergeGeometries(target.map(g => g.index ? g.toNonIndexed() : g), false); merged.computeVertexNormals();
    const mesh = new THREE.Mesh(merged, material); mesh.name = name; mesh.castShadow = true; mesh.frustumCulled = false; parent.add(mesh); target.forEach(g => g.dispose());
  }
  return root;
}

export function animateFishProp(root, time, strength = 1) {
  const tail = root?.getObjectByName('Fish_Tail'); if (!tail) return;
  const flat = root.userData.species === 'flounder';
  tail.rotation[flat ? 'x' : 'y'] = Math.sin(time * 12) * 0.28 * strength;
}
