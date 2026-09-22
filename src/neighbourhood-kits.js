// Original standalone facade, yard and utility models. Game units, Y-up, front +Z.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';
import { createBike } from './bikes.js';

export const NEIGHBOURHOOD_KITS = {
  utility: ['utility-pole', 'street-lamp', 'street-lamp-head'],
  'shop-facade': ['noren', 'chochin', 'tate-kanban', 'awning', 'a-board', 'hanging-sign', 'drink-crates', 'menu-stand'],
  'home-yard': ['wall-gate', 'mailbox', 'potted-plants', 'laundry-pole', 'air-con', 'bicycle', 'kerosene-tank', 'garden-tap'],
};

/** The town's merger wants position/normal/uv/color on every part: each named mesh, baked to world space (pivots and
 *  the bottom alignment applied), then scaled (uniform or per axis), turned and placed. Not for 'bicycle' (the town draws its own). */
export function neighbourhoodGeometry(kind, { x = 0, y = 0, z = 0, rot = 0, scale = 1, sx, sy, sz } = {}) {
  const root = createNeighbourhoodProp(kind), out = {}; root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld); o.geometry.dispose();
    g.scale(sx ?? scale, sy ?? scale, sz ?? scale); g.rotateY(rot); g.translate(x, y, z);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    out[o.name] = g;
  });
  return out;
}
export function addNeighbourhood(out, kind, x, y, z, rot = 0, opts = {}) { const parts = neighbourhoodGeometry(kind, { x, y, z, rot, ...opts }); for (const k in parts) out.push(parts[k]); return parts; }
export function createNeighbourhoodProp(kind) {
  if (!Object.values(NEIGHBOURHOOD_KITS).flat().includes(kind)) throw new Error(`Unknown neighbourhood prop: ${kind}`);
  if (kind === 'bicycle') return createBike();
  const root = new THREE.Group(); root.name = `Komachi_${kind.replaceAll('-', '_')}`;
  root.userData = { front: '+Z', units: 'game', standalone: true };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .88 });
  let parts = [];
  function add(g, tint) {
    const geo = g.index ? g.toNonIndexed() : g;
    if (geo !== g) g.dispose();
    geo.deleteAttribute('uv');
    const c = new THREE.Color(tint), a = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) c.toArray(a, i);
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(geo);
  }
  function box(w, h, d, x, y, z, tint = PAL.concrete2, rx = 0) {
    const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.translate(x, y, z); add(g, tint);
  }
  function rod(a, b, r, tint = PAL.kawara2, end = r, segments = 8) {
    const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b), delta = q.clone().sub(p);
    const g = new THREE.CylinderGeometry(end, r, delta.length(), segments);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    g.translate(...p.add(q).multiplyScalar(.5).toArray()); add(g, tint);
  }
  function ring(r, tube, x, y, z, tint, horizontal = false) {
    const g = new THREE.TorusGeometry(r, tube, 4, 16); if (horizontal) g.rotateX(Math.PI / 2);
    g.translate(x, y, z); add(g, tint);
  }
  function ellipsoid(x, y, z, sx, sy, sz, tint) {
    const g = new THREE.SphereGeometry(1, 8, 5); g.scale(sx, sy, sz); g.translate(x, y, z); add(g, tint);
  }
  function finish(name, pivot) {
    if (!parts.length) return;
    const geo = mergeGeometries(parts); parts.forEach(g => g.dispose()); parts = [];
    if (pivot) geo.translate(-pivot[0], -pivot[1], -pivot[2]);
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = m.receiveShadow = true;
    if (pivot) m.position.fromArray(pivot); root.add(m); return m;
  }
  function menu(x, y, z, w, h) {
    box(w, h, .008, x, y, z, PAL.indigo);
    box(w * .58, .008, .003, x, y + h * .33, z + .006, PAL.cream2);
    for (let i = 0; i < 4; i++) {
      box(w * (.45 + i % 2 * .12), .004, .003, x - w * .08, y + h * .12 - i * h * .16, z + .006, PAL.cream);
      box(.012, .004, .003, x + w * .34, y + h * .12 - i * h * .16, z + .006, PAL.lampGlow);
    }
  }
  function lampHead(x, y, z) {
    rod([x, y, z - .075], [x, y, z], .01, PAL.kawara);
    const outline = new THREE.Shape();
    outline.moveTo(-.024, -.031); outline.lineTo(.024, -.031); outline.lineTo(.035, .002);
    outline.lineTo(.030, .101); outline.lineTo(.017, .117); outline.lineTo(-.017, .117);
    outline.lineTo(-.030, .101); outline.lineTo(-.035, .002); outline.closePath();
    const housing = new THREE.ExtrudeGeometry(outline, { depth: .016, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .003, bevelThickness: .003 });
    housing.rotateX(Math.PI / 2); housing.translate(x, y + .01, z); add(housing, PAL.kawara);
    box(.057, .009, .125, x, y - .016, z + .047, PAL.cream2);
    box(.045, .004, .104, x, y - .022, z + .05, PAL.lampGlow);
  }
  function insulator(x, y, z) {
    rod([x, y, z], [x, y + .083, z], .006, PAL.kawara2);
    for (let i = 0; i < 3; i++) rod([x, y + .018 + i * .019, z], [x, y + .027 + i * .019, z], .021 - i * .002, PAL.cream2, .014 - i * .002);
  }
  if (kind === 'utility-pole') {
    rod([0, 0, 0], [0, 1.15, 0], .033, PAL.concrete2, .022, 12);
    for (const y of [.38, .71, 1.0]) ring(.031 - y * .007, .003, 0, y, 0, PAL.kawara, true);
    box(.49, .027, .032, 0, 1.065, 0, PAL.kawara);
    for (const x of [-.19, 0, .19]) insulator(x, 1.08, 0);
    for (const x of [-.18, .18]) rod([0, .91, -.015], [x, 1.053, -.015], .004, PAL.kawara2);
    // The drum hangs from brackets; ribbed bushings and two short leads connect it to the arm.
    for (const y of [.73, .89]) box(.17, .018, .045, .07, y, .005, PAL.kawara2);
    rod([.10, .70, .035], [.10, .92, .035], .055, PAL.greyWall, .055, 12);
    for (const y of [.703, .917]) rod([.10, y - .005, .035], [.10, y + .005, .035], .060, PAL.kawara);
    for (const x of [.075, .125]) {
      insulator(x, .926, .035);
      rod([x, 1.006, .035], [x, 1.034, .035], .0025, PAL.kawara2);
      rod([x, 1.034, .035], [x < .1 ? 0 : .19, 1.15, 0], .0025, PAL.kawara2);
    }
    box(.047, .085, .004, 0, .49, .031, PAL.cream2);
    for (let i = 0; i < 3; i++) box(.029, .005, .004, 0, .515 - i * .018, .035, PAL.kawara);
    for (let i = 0; i < 4; i++) rod([-.04, .19 + i * .07, 0], [.04, .19 + i * .07, 0], .0035);
    rod([0, .64, .015], [0, .68, .16], .009, PAL.kawara); lampHead(0, .68, .21);
    finish('Concrete_Pole_Transformer');
    root.userData.wireAnchors = [[-.19, 1.163, 0], [0, 1.163, 0], [.19, 1.163, 0]];
  } else if (kind === 'street-lamp' || kind === 'street-lamp-head') {
    if (kind === 'street-lamp') {
      box(.075, .015, .075, 0, .0075, 0, PAL.concrete2);
      rod([0, .015, 0], [0, .83, 0], .013, PAL.kawara, .009);
      rod([0, .79, 0], [0, .855, .12], .009, PAL.kawara);
      lampHead(0, .855, .18); root.userData.lightPoint = [0, .828, .23];
    } else { lampHead(0, .028, 0); root.userData.mountPoint = [0, .028, -.075]; }
    finish('Street_Lamp');
  } else if (kind === 'noren') {
    rod([-.26, .19, 0], [.26, .19, 0], .006, PAL.wood2);
    // Five solid, lightly folded cloth panels with visible gaps and an abstract shop crest.
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * .095;
      for (let j = 0; j < 4; j++) box(.023, .164, .006, x + (j - 1.5) * .023, .095, Math.sin(j * Math.PI / 2) * .006 + .012, PAL.indigo);
      box(.091, .012, .011, x, .177, .009, PAL.indigo);
      if (i === 2) { ring(.027, .003, x, .09, .024, PAL.cream2); box(.025, .003, .003, x, .09, .029, PAL.cream2); }
    }
    finish('Noren'); root.userData.mountPoint = [0, .19, 0]; root.userData.mount = 'above-door';
  } else if (kind === 'chochin') {
    const profile = [[.027, .018], [.039, .032], [.054, .060], [.059, .10], [.054, .14], [.039, .168], [.027, .18]].map(p => new THREE.Vector2(...p));
    add(new THREE.LatheGeometry(profile, 12), PAL.roofRose);
    for (let i = 0; i < 9; i++) {
      const y = .031 + i * .017, upper = profile.findIndex(p => p.y >= y), a = profile[upper - 1], b = profile[upper];
      const r = a.x + (b.x - a.x) * (y - a.y) / (b.y - a.y);
      ring(r + .001, .0018, 0, y, 0, PAL.roofPeach, true);
    }
    for (const y of [.015, .184]) rod([0, y - .008, 0], [0, y + .008, 0], .029, PAL.kawara2);
    ring(.018, .0025, 0, .205, 0, PAL.kawara2);
    // Cream vertical panel and simple crest, no pseudo-Japanese lettering.
    box(.027, .080, .004, 0, .10, .060, PAL.cream2); ring(.008, .002, 0, .113, .064, PAL.indigo);
    box(.016, .004, .003, 0, .084, .064, PAL.indigo); finish('Paper_Lantern'); root.userData.mountPoint = [0, .225, 0];
  } else if (kind === 'tate-kanban') {
    for (const x of [-.066, .066]) box(.026, .018, .14, x, .009, 0, PAL.wood2);
    box(.144, .35, .035, 0, .195, 0, PAL.wood2); box(.117, .314, .006, 0, .197, .022, PAL.cream2);
    ring(.025, .003, 0, .292, .028, PAL.roofRose);
    const bowl = new THREE.TorusGeometry(.032, .004, 4, 12, Math.PI); bowl.rotateZ(Math.PI); bowl.translate(0, .205, .028); add(bowl, PAL.indigo);
    box(.066, .005, .004, 0, .205, .028, PAL.indigo);
    for (const x of [-.017, 0, .017]) rod([x, .216, .028], [x + .004, .233, .028], .002, PAL.indigo);
    for (const y of [.125, .095]) box(.052, .006, .004, 0, y, .028, PAL.indigo);
    box(.161, .018, .06, 0, .38, 0, PAL.wood); finish('Standing_Sign');
  } else if (kind === 'awning') {
    for (let i = 0; i < 8; i++) {
      const x = (i - 3.5) * .072, tint = i % 2 ? PAL.cream2 : PAL.roofTeal;
      box(.072, .014, .24, x, .105, .098, tint, .32);
      box(.072, .046, .012, x, .051, .214, tint);
    }
    box(.60, .027, .024, 0, .148, -.012, PAL.wood2);
    for (const x of [-.255, .255]) { rod([x, .024, 0], [x, .061, .208], .005, PAL.kawara); rod([x, .024, 0], [x, .144, 0], .005, PAL.kawara); }
    finish('Striped_Awning'); root.userData.mountPoint = [0, .148, -.024]; root.userData.mount = 'wall';
  } else if (kind === 'a-board') {
    for (const side of [-1, 1]) {
      for (const x of [-.077, .077]) rod([x, .009, side * .076], [x, .258, 0], .008, PAL.wood);
      box(.157, .015, .016, 0, .037, side * .065, PAL.wood2);
    }
    const start = parts.length;
    box(.17, .199, .016, 0, .145, 0, PAL.wood); menu(0, .145, .012, .141, .167);
    for (let i = start; i < parts.length; i++) { parts[i].translate(0, -.25, 0); parts[i].rotateX(.27); parts[i].translate(0, .25, .007); }
    rod([-.09, .257, 0], [.09, .257, 0], .006, PAL.kawara);
    for (const x of [-.076, .076]) rod([x, .10, -.048], [x, .10, .048], .0025, PAL.kawara);
    finish('A_Board_Menu');
  } else if (kind === 'hanging-sign') {
    box(.035, .14, .021, -.145, .19, 0, PAL.kawara2);
    rod([-.145, .252, .016], [.135, .252, .016], .006);
    rod([-.14, .16, .016], [-.012, .25, .016], .004);
    for (const x of [-.062, .092]) ring(.016, .003, x, .218, .016, PAL.kawara2);
    box(.232, .123, .019, .015, .139, .016, PAL.wood2);
    for (const z of [.028, .004]) box(.211, .101, .004, .015, .139, z, PAL.roofTeal);
    ring(.027, .003, .015, .146, .033, PAL.cream2); box(.075, .005, .003, .015, .105, .033, PAL.cream2);
    finish('Hanging_Sign'); root.userData.mountPoint = [-.145, .19, -.012]; root.userData.mount = 'bracket';
  } else if (kind === 'drink-crates') {
    for (const [x, y, tint] of [[-.076, 0, PAL.roofTeal], [.078, 0, PAL.roofRose], [-.076, .098, PAL.roofTeal]]) {
      box(.142, .01, .10, x, y + .005, 0, tint);
      for (const xx of [-.067, .067]) box(.009, .082, .10, x + xx, y + .046, 0, tint);
      for (const z of [-.048, .048]) {
        for (const yy of [.026, .076]) box(.14, .012, .008, x, y + yy, z, tint);
        for (let i = 0; i < 5; i++) box(.008, .070, .008, x + (i - 2) * .032, y + .044, z, tint);
      }
      for (const xx of [-.043, 0, .043]) for (const z of [-.021, .021]) {
        rod([x + xx, y + .012, z], [x + xx, y + .068, z], .014, PAL.roofSage);
        rod([x + xx, y + .068, z], [x + xx, y + .092, z], .006, PAL.roofSage);
        rod([x + xx, y + .090, z], [x + xx, y + .095, z], .007, PAL.cream2);
        rod([x + xx, y + .032, z], [x + xx, y + .049, z], .0145, PAL.cream);
      }
    }
    finish('Drink_Crates');
  } else if (kind === 'menu-stand') {
    box(.145, .014, .125, 0, .007, 0, PAL.kawara2); rod([0, .014, 0], [0, .243, 0], .009);
    const start = parts.length; box(.19, .137, .012, 0, 0, 0, PAL.wood); menu(0, 0, .009, .168, .115);
    for (let i = start; i < parts.length; i++) { parts[i].rotateX(-.63); parts[i].translate(0, .261, .015); }
    finish('Menu_Stand');
  } else if (kind === 'wall-gate') {
    for (const side of [-1, 1]) {
      for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
        const x = side * (.182 + col * .081); box(.078, .058, .055, x, .032 + row * .061, 0, (row + col) % 2 ? PAL.concrete : PAL.concrete2);
        if (row === 2) { box(.041, .018, .003, x, .158, .029, PAL.kawara); box(.009, .022, .004, x, .158, .032, PAL.concrete2); }
      }
      box(.263, .019, .071, side * .263, .199, 0, PAL.concrete2);
      box(.035, .219, .074, side * .132, .1095, 0, PAL.concrete); box(.049, .018, .085, side * .132, .227, 0, PAL.concrete2);
    }
    finish('Block_Wall');
    for (const y of [.035, .176]) box(.232, .013, .022, 0, y, .008, PAL.kawara2);
    for (let i = 0; i < 9; i++) box(.012, .166, .019, (i - 4) * .027, .105, .008, PAL.kawara2);
    box(.029, .009, .018, .082, .118, .026, PAL.wood2);
    finish('Gate', [-.118, .025, .008]); root.userData.gatePivot = [-.118, .025, .008]; root.userData.clearOpening = .229;
  } else if (kind === 'mailbox') {
    box(.075, .014, .072, 0, .007, 0, PAL.concrete); box(.024, .176, .024, 0, .10, 0, PAL.wood2);
    box(.108, .101, .069, 0, .216, 0, PAL.roofRose); box(.119, .014, .082, 0, .274, 0, PAL.roofRose);
    box(.072, .009, .004, 0, .245, .037, PAL.kawara2); box(.045, .024, .004, -.01, .207, .038, PAL.cream2);
    box(.025, .004, .003, -.01, .207, .042, PAL.kawara); ellipsoid(.037, .189, .039, .004, .004, .003, PAL.kawara2);
    finish('Mailbox');
  } else if (kind === 'potted-plants') {
    for (const [x, z, r, h, tint] of [[-.08, .025, .039, .064, PAL.roofPeach], [.035, -.023, .05, .089, PAL.cream2], [.09, .045, .027, .042, PAL.roofTeal]]) {
      rod([x, 0, z], [x, h, z], r * .7, tint, r, 10); ring(r, .004, x, h, z, tint, true);
      rod([x, h - .003, z], [x, h + .002, z], r * .87, PAL.wood2);
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5, xx = x + Math.cos(a) * r * .68, zz = z + Math.sin(a) * r * .68;
        rod([x, h, z], [xx, h + r * 1.7, zz], .002, PAL.roofSage);
        for (const level of [.75, 1.35]) {
          const leaf = new THREE.SphereGeometry(1, 6, 3); leaf.scale(r * .83, r * .15, r * .38);
          leaf.rotateZ(.50); leaf.rotateY(-a); leaf.translate(xx, h + r * level, zz); add(leaf, i % 2 ? PAL.treeGreen : PAL.treeSage);
        }
        if (x < 0) ellipsoid(xx, h + r * 2, zz, .011, .007, .011, PAL.flower);
      }
    }
    finish('Potted_Plants');
  } else if (kind === 'laundry-pole') {
    for (const x of [-.25, .25]) {
      box(.077, .021, .09, x, .0105, 0, PAL.concrete2); rod([x, .021, 0], [x, .37, 0], .007, PAL.kawara);
      rod([x, .365, -.052], [x, .365, .052], .006, PAL.kawara);
    }
    for (const z of [-.045, .045]) rod([-.28, .373, z], [.28, .373, z], .004, PAL.kawara);
    finish('Laundry_Frame');
    for (const [x, w, h, tint] of [[-.16, .115, .166, PAL.cream2], [0, .105, .135, PAL.roofBlue], [.15, .105, .181, PAL.flower]]) {
      for (let i = 0; i < 5; i++) box(w / 5, h, .005, x + (i - 2) * w / 5, .364 - h / 2, .045 + Math.sin(i * 1.7) * .003, tint);
      for (const s of [-1, 1]) box(.009, .027, .012, x + s * w * .34, .374, .046, PAL.wood);
      box(w, .006, .007, x, .37 - h, .046, tint);
    }
    finish('Laundry_Cloth_And_Pegs');
  } else if (kind === 'air-con') {
    for (const x of [-.07, .07]) box(.025, .017, .103, x, .0085, 0, PAL.concrete2);
    box(.216, .131, .091, 0, .0825, 0, PAL.cream2);
    rod([-.038, .083, .047], [-.038, .083, .050], .049, PAL.kawara2, .049, 16);
    for (const r of [.015, .031, .047]) ring(r, .0018, -.038, .083, .053, PAL.concrete2);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; rod([-.038, .083, .055], [-.038 + .047 * Math.cos(a), .083 + .047 * Math.sin(a), .055], .0015, PAL.concrete2); }
    for (let i = 0; i < 7; i++) box(.045, .004, .003, .064, .047 + i * .012, .048, PAL.kawara);
    box(.027, .011, .003, .067, .129, .049, PAL.roofTeal);
    for (const y of [.044, .07]) { rod([.107, y, -.02], [.126, y, -.02], .004, PAL.cream); rod([.126, y, -.02], [.126, y, -.067], .004, PAL.cream); }
    finish('Air_Con_Outdoor_Unit');
  } else if (kind === 'kerosene-tank') {
    for (const x of [-.064, .064]) for (const z of [-.038, .038]) box(.014, .076, .014, x, .038, z, PAL.kawara);
    box(.178, .118, .098, 0, .124, 0, PAL.cream2);
    ellipsoid(0, .178, 0, .089, .018, .049, PAL.cream2);
    rod([-.039, .192, 0], [-.039, .208, 0], .012, PAL.kawara);
    rod([.042, .19, 0], [.042, .226, 0], .005, PAL.kawara); box(.019, .006, .019, .042, .229, 0, PAL.kawara);
    box(.048, .033, .003, -.025, .13, .052, PAL.roofRose); box(.026, .004, .003, -.025, .13, .055, PAL.cream2);
    box(.009, .067, .004, .059, .13, .052, PAL.concrete2); box(.004, .042, .004, .059, .118, .055, PAL.roofPeach);
    rod([.062, .065, 0], [.062, .043, 0], .004, PAL.kawara); rod([.062, .043, 0], [.091, .043, .025], .004, PAL.kawara);
    box(.025, .005, .009, .062, .055, .009, PAL.roofRose); finish('Kerosene_Tank');
  } else if (kind === 'garden-tap') {
    box(.151, .013, .151, 0, .0065, .044, PAL.concrete2);
    for (const x of [-.069, .069]) box(.013, .021, .151, x, .021, .044, PAL.concrete);
    for (const z of [-.025, .114]) box(.125, .021, .013, 0, .021, z, PAL.concrete);
    box(.025, .005, .029, 0, .016, .066, PAL.kawara2);
    box(.039, .20, .039, 0, .106, -.01, PAL.cream);
    rod([0, .169, .009], [0, .169, .051], .008, PAL.concrete2);
    rod([0, .169, .051], [0, .152, .051], .008, PAL.concrete2);
    rod([0, .175, .025], [0, .193, .025], .004, PAL.kawara);
    rod([-.019, .195, .025], [.019, .195, .025], .004, PAL.kawara);
    finish('Garden_Tap'); root.userData.waterPoint = [0, .144, .051];
  }
  // Bottom-aligned exports make both floor props and wall attachments easy to place.
  const bottom = new THREE.Box3().setFromObject(root).min.y;
  for (const child of root.children) child.position.y -= bottom;
  for (const [key, value] of Object.entries(root.userData)) {
    if (!Array.isArray(value)) continue;
    if (typeof value[0] === 'number' && value.length === 3) root.userData[key] = [value[0], value[1] - bottom, value[2]];
    else if (Array.isArray(value[0])) root.userData[key] = value.map(p => [p[0], p[1] - bottom, p[2]]);
  }
  return root;
}
