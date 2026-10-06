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

/** The junk the line brings up now and then, in the same toy style: a soggy boot or a dented tin can. Up is +y, the
 *  "nose" (toe, or the can's open end) along +z, grip at the centre like the fish, so the hold-up code treats them alike. */
export const JUNK_KINDS = ['boot', 'can'];
export function createJunkProp(kind = 'boot', length = 0.1) {
  const L = length, parts = [], root = new THREE.Group(); root.name = `Junk_${kind}`;
  root.userData = { propKind: 'junk', species: kind, grip: [0, 0, 0] };
  const add = (g, color) => { parts.push(tinted(g, color)); };
  const box = (sx, sy, sz, color, x, y, z, rz = 0) => {
    const g = new THREE.BoxGeometry(sx * L, sy * L, sz * L);
    g.rotateZ(rz); g.translate(x * L, y * L, z * L); add(g, color);
  };
  const lathe = (profile, color, z = 0, alongZ = false, segments = 8) => {
    const g = new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r * L, y * L)), segments);
    if (alongZ) g.rotateX(Math.PI / 2);
    g.translate(0, 0, z * L); add(g, color); return g;
  };
  if (kind === 'boot') {
    // Short, broad ankle and bevelled toe echo the Mini Characters' oversized shoes.
    const leather = PAL.junk.boot, dark = PAL.junk.bootDark;
    lathe([[.18,-.15],[.18,.06],[.22,.34],[.22,.39],[.17,.39],[.15,.12]], leather, -.19);
    lathe([[.225,.335],[.225,.405],[.17,.405],[.17,.335]], dark, -.19);
    const opening = new THREE.CircleGeometry(L * .153, 8);
    opening.rotateX(-Math.PI / 2); opening.translate(0, L * .12, -L * .19); add(opening, dark);
    // An eight-corner footprint, extruded with one broad bevel instead of sphere lobes.
    const footprint = new THREE.Shape();
    const outline = [[-.17,-.34],[-.235,-.19],[-.235,.34],[-.15,.49],[.15,.49],[.235,.34],[.235,-.19],[.17,-.34]];
    footprint.moveTo(...outline[0]); outline.slice(1).forEach(p => footprint.lineTo(...p)); footprint.closePath();
    const foot = new THREE.ExtrudeGeometry(footprint, { depth: .16, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .055, bevelThickness: .065, curveSegments: 1 });
    foot.rotateX(Math.PI / 2); foot.scale(L, L, L); foot.translate(0, -L * .06, 0); add(foot, leather);
    const sole = new THREE.ExtrudeGeometry(footprint, { depth: .075, bevelEnabled: false, steps: 1, curveSegments: 1 });
    sole.rotateX(Math.PI / 2); sole.scale(L * 1.13, L, L * 1.09); sole.translate(0, -L * .245, 0); add(sole, dark);
    box(.16,.27,.035,dark,0,.17,.028);   // one broad tongue panel
    for (const y of [.1,.24]) {
      // Oversized flat lace bars remain legible beside Kenney hands.
      for (const side of [-1,1]) box(.23,.032,.035,PAL.junk.lace,0,y,.058,side * .36);
    }
  } else {
    // Ten broad facets, two rolled rims, and a single pushed-in side.
    const tin = PAL.junk.tin, rust = PAL.junk.rust;
    const dent = g => {
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) / L, y = p.getY(i) / L, z = p.getZ(i) / L;
        const amount = Math.max(0, 1 - Math.abs(z - .02) / .29) * Math.max(0, x / .24) * .3;
        p.setXYZ(i, (x - amount * .14) * L, y * L, z * L);
      }
      return g;
    };
    const body = lathe([[.235,-.36],[.235,-.31],[.22,-.29],[.22,0],[.22,.29],[.235,.31],[.235,.36],[.195,.36],[.19,.29],[.19,0],[.19,-.3]], tin, 0, true, 10);
    dent(body);
    // Crisp rust islands on whole facets, with no mottled shading or surface bumps.
    parts.pop(); const facets = body.toNonIndexed(); body.dispose(); tinted(facets, tin);
    const p = facets.attributes.position, colors = facets.attributes.color, oxide = new THREE.Color(rust);
    for (let i = 0; i < p.count; i += 3) {
      const x = (p.getX(i) + p.getX(i+1) + p.getX(i+2)) / (3 * L);
      const y = (p.getY(i) + p.getY(i+1) + p.getY(i+2)) / (3 * L);
      const z = (p.getZ(i) + p.getZ(i+1) + p.getZ(i+2)) / (3 * L);
      if ((z < -.28 && y > .04) || (z > .17 && x > .1) || (z > -.27 && z < -.1 && x < -.15)) {
        for (let k = 0; k < 3; k++) colors.setXYZ(i+k,oxide.r,oxide.g,oxide.b);
      }
    }
    parts.push(facets);
    const label = new THREE.CylinderGeometry(L * .222, L * .222, L * .23, 10, 1, true, .3, Math.PI * 1.4);
    label.rotateX(Math.PI / 2); label.translate(0,0,-L * .015); add(dent(label), PAL.junk.label);
    const base = new THREE.CircleGeometry(L * .194, 10); base.translate(0,0,-L * .32); add(base, tin);
    const inside = new THREE.CircleGeometry(L * .19, 10); inside.translate(0,0,-L * .318); add(inside, PAL.junk.bootDark);
    const lid = new THREE.CircleGeometry(L * .205, 10);
    lid.translate(0,-L * .205,0); lid.rotateX(-2.05); lid.translate(0,L * .215,L * .35); add(lid, tin);
  }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .85, metalness: 0, flatShading: true, side: THREE.DoubleSide });
  const geometries = parts.map(g => g.index ? g.toNonIndexed() : g);
  const merged = mergeGeometries(geometries, false); merged.computeVertexNormals();
  const mesh = new THREE.Mesh(merged, material); mesh.name = 'Junk_Body'; mesh.castShadow = true; mesh.frustumCulled = false; root.add(mesh);
  new Set([...parts, ...geometries]).forEach(g => g.dispose());
  return root;
}

export function animateFishProp(root, time, strength = 1) {
  const tail = root?.getObjectByName('Fish_Tail'); if (!tail) return;
  const flat = root.userData.species === 'flounder';
  tail.rotation[flat ? 'x' : 'y'] = Math.sin(time * 12) * 0.28 * strength;
}
