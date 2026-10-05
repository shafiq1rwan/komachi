// Texture-free fish props in game units, nose along +Z, with a separate tail pivot for the catch wriggle.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export const FISH_PROP_KINDS = ['sardine', 'horse-mackerel', 'flounder', 'rockfish', 'sea-bream'];
const PROFILES = {
  sardine: { palette: 'sardine', length: 0.12, width: 0.105, height: 0.14 },
  'horse-mackerel': { palette: 'mackerel', length: 0.15, width: 0.125, height: 0.17 },
  flounder: { palette: 'flounder', length: 0.17, width: 0.3, height: 0.055, flat: true },
  rockfish: { palette: 'rockfish', length: 0.18, width: 0.19, height: 0.23, spiny: true },
  'sea-bream': { palette: 'bream', length: 0.2, width: 0.17, height: 0.24 },
};
const kindOf = options => {
  if (typeof options === 'string') return PROFILES[options] ? options : 'sea-bream';
  const name = (options.name || '').replace(/^(a|an) /, '').replace(/^small /, '').replaceAll(' ', '-');
  return PROFILES[name] ? name : PROFILES[options.species] ? options.species : options.flat ? 'flounder' : 'sea-bream';
};

/** A sculpted, faceted body and fins use one material and two draw calls, including the animated tail. */
export function createFishProp(options = 'sea-bream') {
  const kind = kindOf(options), profile = PROFILES[kind], palette = PAL.fish[profile.palette];
  const root = new THREE.Group(); root.name = `Fish_${kind.replaceAll('-', '_')}`;
  root.userData.propKind = 'fish'; root.userData.species = kind; root.userData.grip = [0, 0, 0];
  const L = profile.length, parts = [], tailParts = [];
  const add = (geometry, color, target = parts) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry; if (g !== geometry) geometry.dispose();
    g.deleteAttribute('uv');
    if (!g.attributes.color) {
      const colors = new Float32Array(g.attributes.position.count * 3), c = new THREE.Color(color);
      for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    target.push(g);
  };
  // Cross sections taper to a blunt snout and a narrow tail wrist; the cream belly follows the surface.
  const rings = [[-0.43, 0.18], [-0.31, 0.55], [-0.13, 0.92], [0.07, 1], [0.25, 0.88], [0.39, 0.59], [0.48, 0.25], [0.5, 0.03]];
  const vertices = [], colors = [], indices = [], sides = 10;
  const back = new THREE.Color(palette.back), skin = new THREE.Color(palette.color), belly = new THREE.Color(palette.belly), tint = new THREE.Color();
  for (const [z, radius] of rings) for (let i = 0; i < sides; i++) {
    const angle = i / sides * Math.PI * 2, y = Math.sin(angle);
    vertices.push(Math.cos(angle) * profile.width * radius * L, y * profile.height * radius * L, z * L);
    tint.copy(skin).lerp(y > 0 ? back : belly, Math.abs(y) * (y > 0 ? 0.8 : 0.95)); tint.toArray(colors, colors.length);
  }
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < sides; i++) {
    const a = r * sides + i, b = r * sides + (i + 1) % sides, c = a + sides, d = b + sides;
    indices.push(a, b, c, b, d, c);
  }
  for (let i = 1; i < sides - 1; i++) { indices.push(0, i + 1, i); const n = (rings.length - 1) * sides; indices.push(n, n + i, n + i + 1); }
  const body = new THREE.BufferGeometry(); body.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); body.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); body.setIndex(indices); body.computeVertexNormals(); add(body, palette.color);

  // Fins are thin solid prisms rather than flat cards, so their silhouettes survive either camera side.
  const fin = (outline, thickness = 0.015) => {
    const points = outline.map(([y, z]) => new THREE.Vector2(y, z)), triangles = THREE.ShapeUtils.triangulateShape(points, []), positions = [];
    const vertex = (i, side) => positions.push(side * thickness * L / 2, points[i].x * L, points[i].y * L);
    for (const triangle of triangles) for (const side of [-1, 1]) for (const i of side === 1 ? triangle : [...triangle].reverse()) vertex(i, side);
    for (let i = 0; i < points.length; i++) { const j = (i + 1) % points.length; for (const [index, side] of [[i, -1], [j, -1], [i, 1], [j, -1], [j, 1], [i, 1]]) vertex(index, side); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.computeVertexNormals(); return g;
  };
  const dorsal = profile.spiny ? [[0.13, -0.27], [0.31, -0.24], [0.2, -0.16], [0.36, -0.1], [0.23, -0.02], [0.38, 0.05], [0.24, 0.12], [0.33, 0.18], [0.13, 0.26]] : [[0.08, -0.3], [profile.height + 0.075, -0.12], [profile.height + 0.055, 0.1], [0.08, 0.23]];
  if (profile.flat) {
    for (const side of [-1, 1]) { const g = fin([[0.15, -0.32], [0.32, -0.16], [0.36, 0.09], [0.24, 0.34], [0.15, 0.28]]); g.rotateZ(side * Math.PI / 2); add(g, palette.fin); }
  } else { add(fin(dorsal), palette.fin); const lower = fin([[0.05, -0.3], [profile.height + 0.025, -0.17], [0.08, 0.07]]); lower.rotateZ(Math.PI); add(lower, palette.fin); }
  for (const side of [-1, 1]) {
    const pectoral = fin([[0, -0.14], [0.12, -0.27], [0.1, -0.07], [0, 0.06]]); pectoral.rotateZ(side * 1.15); pectoral.translate(side * profile.width * 0.75 * L, 0, 0.15 * L); add(pectoral, palette.fin);
  }
  const bead = (radius, xyz, color) => { const g = new THREE.SphereGeometry(radius * L, 8, 6); g.translate(...xyz.map(v => v * L)); add(g, color); };
  if (profile.flat) {
    for (const x of [-0.07, 0.07]) { bead(0.036, [x, 0.054, 0.29], PAL.fish.eyeRim); bead(0.024, [x, 0.077, 0.3], PAL.fish.eye); }
    for (const [x, z] of [[-0.13, -0.12], [0.15, -0.05], [-0.15, 0.16], [0.08, 0.08]]) { const spot = new THREE.SphereGeometry(L * 0.024, 6, 4); spot.scale(1, 0.18, 1); spot.translate(x * L, 0.052 * L, z * L); add(spot, palette.back); }
  } else {
    for (const side of [-1, 1]) {
      bead(0.037, [side * profile.width * 0.53, 0.067, 0.385], PAL.fish.eyeRim);
      bead(0.025, [side * (profile.width * 0.53 + 0.026), 0.071, 0.392], PAL.fish.eye);
      bead(0.009, [side * (profile.width * 0.53 + 0.045), 0.081, 0.401], PAL.fish.eyeRim);
      const gill = new THREE.TorusGeometry(L * profile.height * 0.58, L * 0.008, 3, 9, Math.PI * 0.8); gill.rotateY(side * Math.PI / 2); gill.translate(side * profile.width * 0.82 * L, 0, 0.23 * L); add(gill, palette.back);
    }
  }
  const mouth = new THREE.BoxGeometry(L * 0.05, L * 0.012, L * 0.008); mouth.translate(0, -0.014 * L, 0.495 * L); add(mouth, PAL.fish.mouth);
  const tail = new THREE.Group(); tail.name = 'Fish_Tail'; tail.position.z = -0.4 * L; root.add(tail);
  const fork = fin([[0.055, 0], [0.21, -0.28], [0, -0.2], [-0.21, -0.28], [-0.055, 0]], 0.026);
  if (profile.flat) fork.rotateZ(Math.PI / 2); add(fork, palette.fin, tailParts);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.08, flatShading: true, side: THREE.DoubleSide });
  for (const [target, parent, name] of [[parts, root, 'Fish_Body'], [tailParts, tail, 'Fish_Tail_Fin']]) {
    const mesh = new THREE.Mesh(mergeGeometries(target, false), material); mesh.name = name; mesh.castShadow = true; mesh.frustumCulled = false; parent.add(mesh); target.forEach(g => g.dispose());
  }
  return root;
}

export function animateFishProp(root, time, strength = 1) {
  const tail = root?.getObjectByName('Fish_Tail'); if (!tail) return;
  const flat = root.userData.species === 'flounder';
  tail.rotation[flat ? 'x' : 'y'] = Math.sin(time * 12) * 0.28 * strength;
}
