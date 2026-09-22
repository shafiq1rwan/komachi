// Original standalone civic scenery. Y-up, front +Z; game units, bottom at zero.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export const CIVIC_KINDS = ['substation', 'water-tower', 'recycling-row', 'shrine-path-gate', 'notice-board', 'fire-hydrant', 'hose-box'];
export function createCivicProp(kind) {
  if (!CIVIC_KINDS.includes(kind)) throw new Error(`Unknown civic prop: ${kind}`);
  const root = new THREE.Group(); root.name = `Komachi_${kind.replaceAll('-', '_')}`;
  root.userData = { front: '+Z', units: 'game', standalone: true };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .87 });
  let parts = [];
  function add(g, tint) {
    const geo = g.index ? g.toNonIndexed() : g; if (geo !== g) g.dispose(); geo.deleteAttribute('uv');
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
  function sphere(r, x, y, z, tint, sy = 1) {
    const g = new THREE.SphereGeometry(r, 12, 6); g.scale(1, sy, 1); g.translate(x, y, z); add(g, tint);
  }
  function finish(name, pivot) {
    if (!parts.length) return;
    const geo = mergeGeometries(parts); parts.forEach(g => g.dispose()); parts = [];
    if (pivot) geo.translate(-pivot[0], -pivot[1], -pivot[2]);
    const m = new THREE.Mesh(geo, mat); m.name = name; m.castShadow = m.receiveShadow = true;
    if (pivot) m.position.fromArray(pivot); root.add(m); return m;
  }
  function insulator(x, y, z, height = .115) {
    rod([x, y, z], [x, y + height, z], .007, PAL.kawara2);
    for (let i = 0; i < 5; i++) rod([x, y + .013 + i * .017, z], [x, y + .023 + i * .017, z], .026 - i * .002, PAL.cream2, .018 - i * .002);
  }
  if (kind === 'substation') {
    box(.79, .025, .55, 0, .0125, 0, PAL.concrete);
    for (const x of [-.32, .32]) for (const z of [-.19, .19]) {
      box(.074, .020, .074, x, .035, z, PAL.concrete2);
      box(.025, .60, .030, x, .34, z, PAL.kawara);
      for (const xx of [-.023, .023]) rod([x + xx, .045, z], [x + xx, .052, z], .003, PAL.kawara2);
    }
    for (const z of [-.19, .19]) {
      box(.72, .035, .035, 0, .645, z, PAL.kawara);
      for (const x of [-.21, 0, .21]) insulator(x, .665, z);
      for (const side of [-1, 1]) rod([side * .32, .49, z], [side * .19, .63, z], .005, PAL.kawara2);
    }
    for (const x of [-.32, .32]) {
      box(.023, .026, .41, x, .625, 0, PAL.kawara);
      rod([x, .09, -.19], [x, .57, .19], .004, PAL.kawara2);
      rod([x, .09, .19], [x, .57, -.19], .004, PAL.kawara2);
    }
    for (const x of [-.21, 0, .21]) rod([x, .778, -.19], [x, .778, .19], .0045, PAL.kawara2);
    // Compact transformer bank with cooling fins, top bushings and a service cabinet.
    box(.36, .032, .24, -.07, .055, 0, PAL.kawara2);
    box(.31, .24, .18, -.07, .185, 0, PAL.roofTeal);
    box(.35, .02, .215, -.07, .312, 0, PAL.kawara);
    for (let i = 0; i < 9; i++) for (const z of [-.108, .108]) box(.012, .17, .045, -.20 + i * .0325, .186, z, PAL.kawara);
    for (const x of [-.18, -.07, .04]) {
      insulator(x, .323, 0);
      rod([x, .438, 0], [x, .53, -.04], .003, PAL.kawara2);
      rod([x, .53, -.04], [x < -.1 ? -.21 : x < 0 ? 0 : .21, .778, -.19], .003, PAL.kawara2);
    }
    box(.10, .23, .12, .217, .153, .055, PAL.cream2);
    box(.075, .185, .006, .217, .155, .119, PAL.concrete2);
    box(.008, .027, .007, .240, .156, .126, PAL.kawara2);
    box(.038, .04, .003, .209, .211, .125, PAL.lampGlow);
    // Angular lightning symbol rather than text.
    rod([.214, .226, .129], [.202, .211, .129], .002, PAL.kawara2);
    rod([.202, .211, .129], [.216, .211, .129], .002, PAL.kawara2);
    rod([.216, .211, .129], [.207, .197, .129], .002, PAL.kawara2);
    finish('Substation_Frame_And_Equipment');
    root.userData.wireAnchors = [[-.21, .778, -.19], [0, .778, -.19], [.21, .778, -.19]];
  } else if (kind === 'water-tower') {
    for (const x of [-.155, .155]) for (const z of [-.155, .155]) {
      box(.077, .028, .077, x, .014, z, PAL.concrete);
      rod([x, .028, z], [x * .85, .62, z * .85], .011, PAL.kawara);
    }
    for (const z of [-.145, .145]) {
      rod([-.15, .08, z], [.13, .55, z], .004, PAL.kawara);
      rod([.15, .08, z], [-.13, .55, z], .004, PAL.kawara);
    }
    for (const x of [-.145, .145]) {
      rod([x, .08, -.15], [x, .55, .13], .004, PAL.kawara);
      rod([x, .08, .15], [x, .55, -.13], .004, PAL.kawara);
    }
    rod([0, .585, 0], [0, .88, 0], .205, PAL.sky2, .205, 16);
    rod([0, .565, 0], [0, .592, 0], .17, PAL.kawara, .211, 16);
    for (const y of [.605, .85]) ring(.207, .006, 0, y, 0, PAL.cream2, true);
    rod([0, .88, 0], [0, .953, 0], .219, PAL.kawara, .025, 16);
    rod([0, .946, 0], [0, .98, 0], .026, PAL.kawara);
    rod([.084, .92, 0], [.084, .959, 0], .01, PAL.cream2);
    sphere(.014, .084, .958, 0, PAL.kawara, .35);
    // Fill pipe, valve and ladder rise beside the tank rather than through its wall.
    rod([.09, .04, -.07], [.09, .57, -.07], .009, PAL.cream2);
    rod([.09, .12, -.07], [.09, .12, -.11], .004, PAL.kawara);
    ring(.024, .003, .09, .12, -.112, PAL.roofRose);
    for (const x of [-.035, .035]) rod([x, .045, .228], [x, .924, .228], .004, PAL.kawara2);
    for (let i = 0; i < 15; i++) rod([-.035, .068 + i * .056, .228], [.035, .068 + i * .056, .228], .003, PAL.kawara2);
    for (const y of [.62, .84]) for (const x of [-.035, .035]) rod([x, y, .197], [x, y, .228], .003, PAL.kawara2);
    box(.073, .052, .004, .087, .752, .190, PAL.cream2);
    // Geometric water-drop emblem.
    sphere(.016, .087, .744, .197, PAL.roofBlue, .85);
    const drop = new THREE.ConeGeometry(.014, .025, 8); drop.translate(.087, .764, .197); add(drop, PAL.roofBlue);
    finish('Water_Tower');
  } else if (kind === 'recycling-row') {
    box(.68, .016, .20, 0, .008, 0, PAL.concrete);
    finish('Recycling_Pad');
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * .164, tint = [PAL.roofTeal, PAL.roofBlue, PAL.roofPeach, PAL.roofSage][i];
      box(.142, .23, .147, x, .14, 0, PAL.cream2);
      box(.154, .030, .156, x, .267, 0, tint);
      box(.11, .045, .007, x, .213, .077, tint);
      if (i === 2) box(.077, .009, .004, x, .213, .082, PAL.kawara2);
      else rod([x, .213, .081], [x, .213, .084], .015, PAL.kawara2, .015, 12);
      box(.063, .069, .004, x, .126, .077, tint);
      if (i === 0) {
        box(.017, .027, .003, x, .120, .081, PAL.cream2); box(.008, .011, .003, x, .139, .081, PAL.cream2);
      } else if (i === 1) {
        box(.021, .032, .003, x, .126, .081, PAL.cream2); box(.025, .004, .004, x, .141, .083, PAL.cream);
      } else if (i === 2) {
        for (let j = 0; j < 3; j++) box(.034, .025, .002, x + j * .003, .132 - j * .005, .081 + j * .002, PAL.cream2);
        for (const y of [.128, .12]) box(.022, .002, .002, x + .006, y, .089, tint);
      } else {
        for (const s of [-1, 1]) { rod([x + s * .013, .108, .083], [x + s * .013, .142, .083], .002, PAL.cream2); }
        box(.031, .021, .003, x, .119, .083, PAL.cream2);
      }
      for (const z of [-.073, .073]) box(.082, .007, .008, x, .048, z, PAL.concrete2);
      finish(['Bottle_Bin', 'Can_Bin', 'Paper_Bin', 'Other_Bin'][i]);
    }
    root.userData.categories = ['bottles', 'cans', 'paper', 'other'];
  } else if (kind === 'shrine-path-gate') {
    for (const s of [-1, 1]) {
      box(.093, .035, .105, s * .235, .0175, 0, PAL.concrete2);
      rod([s * .235, .035, 0], [s * .215, .61, 0], .023, PAL.roofRose, .018, 10);
      rod([s * .235, .035, 0], [s * .232, .11, 0], .025, PAL.kawara2, .024, 10);
    }
    box(.54, .032, .04, 0, .492, 0, PAL.roofRose);
    box(.63, .037, .055, 0, .614, 0, PAL.roofRose);
    // Shallow swept top lintel, built as a closed extruded outline.
    const outline = new THREE.Shape(); outline.moveTo(-.35, .646); outline.lineTo(-.24, .622); outline.lineTo(.24, .622); outline.lineTo(.35, .646);
    outline.lineTo(.35, .673); outline.lineTo(.24, .650); outline.lineTo(-.24, .650); outline.lineTo(-.35, .673); outline.closePath();
    const top = new THREE.ExtrudeGeometry(outline, {depth:.066, bevelEnabled:false}); top.translate(0, 0, -.033); add(top, PAL.kawara2);
    box(.035, .091, .034, 0, .552, 0, PAL.roofRose);
    box(.062, .078, .011, 0, .556, .025, PAL.wood); box(.043, .059, .004, 0, .556, .033, PAL.cream);
    // Sagging rope and folded paper streamers leave the path opening clear.
    for (let i = 0; i < 12; i++) {
      const x = -.215 + i * .43 / 12, next = x + .43 / 12;
      const y = .475 - .028 * (1 - (x / .215) ** 2), yy = .475 - .028 * (1 - (next / .215) ** 2);
      rod([x, y, .031], [next, yy, .031], .004, PAL.wood);
    }
    for (const x of [-.14, -.047, .047, .14]) {
      const y = .475 - .028 * (1 - (x / .215) ** 2);
      box(.014, .022, .003, x, y - .014, .032, PAL.cream2);
      box(.024, .010, .003, x + .005, y - .030, .034, PAL.cream2);
      box(.012, .023, .003, x + .011, y - .045, .036, PAL.cream2);
    }
    finish('Shrine_Path_Torii'); root.userData.clearOpening = [.424, .386];
  } else if (kind === 'notice-board') {
    for (const x of [-.22, .22]) {
      box(.075, .023, .087, x, .0115, 0, PAL.concrete2); box(.026, .48, .033, x, .256, 0, PAL.wood2);
    }
    box(.49, .273, .025, 0, .355, 0, PAL.wood2);
    box(.448, .230, .005, 0, .355, .017, PAL.cream);
    for (const x of [-.236, .236]) box(.017, .272, .032, x, .355, .009, PAL.wood);
    for (const y of [.226, .484]) box(.49, .018, .032, 0, y, .009, PAL.wood);
    // Roof pitched front-to-back; papers are raised geometry with clear borders and pins.
    for (const s of [-1, 1]) box(.55, .016, .12, 0, .523, s * .053, PAL.roofTeal, s * .28);
    box(.553, .014, .021, 0, .542, 0, PAL.kawara);
    box(.145, .027, .006, 0, .459, .024, PAL.roofTeal);
    for (const [x, y, w, h, tint] of [[-.15,.358,.10,.132,PAL.cream2],[-.025,.368,.10,.115,PAL.blueWall],[.112,.348,.115,.147,PAL.cream2],[.174,.427,.07,.040,PAL.flower]]) {
      box(w, h, .003, x, y, .024, tint);
      rod([x, y + h / 2 - .008, .026], [x, y + h / 2 - .008, .030], .003, PAL.roofRose);
      box(w * .64, .007, .003, x, y + h * .24, .027, PAL.roofTeal);
      for (let i = 0; i < 3; i++) box(w * (.69 - i * .12), .003, .003, x - w * .05, y - i * h * .14, .027, PAL.kawara);
    }
    finish('Community_Notice_Board');
  } else if (kind === 'fire-hydrant') {
    rod([0, 0, 0], [0, .012, 0], .068, PAL.concrete2, .068, 12);
    rod([0, .012, 0], [0, .029, 0], .046, PAL.kawara2);
    rod([0, .029, 0], [0, .182, 0], .030, PAL.roofRose, .030, 12);
    rod([0, .174, 0], [0, .188, 0], .041, PAL.roofRose, .041, 12);
    sphere(.034, 0, .190, 0, PAL.roofRose, .55);
    rod([0, .205, 0], [0, .224, 0], .011, PAL.kawara2, .011, 6);
    for (const s of [-1, 1]) {
      rod([s * .018, .126, 0], [s * .058, .126, 0], .018, PAL.roofRose);
      rod([s * .055, .126, 0], [s * .067, .126, 0], .024, PAL.cream2, .024, 8);
      rod([s * .067, .126, 0], [s * .074, .126, 0], .008, PAL.kawara2, .008, 6);
    }
    rod([0, .091, .025], [0, .091, .048], .022, PAL.roofRose);
    rod([0, .091, .047], [0, .091, .059], .028, PAL.cream2, .028, 8);
    rod([0, .091, .059], [0, .091, .066], .009, PAL.kawara2, .009, 6);
    for (let i = 0; i < 7; i++) ring(.004, .0012, -.012 - i * .006, .069 - Math.sin(i / 6 * Math.PI) * .018, .037, PAL.kawara2);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; rod([Math.cos(a) * .035,.029,Math.sin(a) * .035],[Math.cos(a) * .035,.034,Math.sin(a) * .035],.003,PAL.concrete2); }
    finish('Fire_Hydrant'); root.userData.hosePoint = [0, .091, .067];
  } else if (kind === 'hose-box') {
    for (const x of [-.071, .071]) box(.025, .063, .064, x, .0315, 0, PAL.kawara2);
    box(.21, .014, .106, 0, .066, 0, PAL.roofRose); box(.225, .019, .119, 0, .341, 0, PAL.roofRose);
    box(.21, .268, .012, 0, .203, -.047, PAL.roofRose);
    for (const x of [-.098, .098]) box(.014, .268, .106, x, .203, 0, PAL.roofRose);
    box(.175, .23, .005, 0, .20, -.037, PAL.cream);
    for (const r of [.017, .029, .041, .053, .065]) ring(r, .005, -.009, .21, -.020, PAL.cream2);
    rod([-.009, .21, -.026], [-.009, .21, -.005], .010, PAL.kawara);
    rod([.05, .17, -.018], [.062, .105, -.018], .005, PAL.cream2);
    rod([.062, .105, -.018], [.042, .090, -.018], .007, PAL.kawara, .005);
    finish('Hose_Cabinet_And_Reel');
    box(.190, .248, .012, 0, .205, .055, PAL.roofRose);
    box(.117, .056, .004, 0, .261, .063, PAL.cream2);
    // Hose pictogram: coiled line and nozzle, visible without a text texture.
    ring(.016, .002, -.018, .261, .067, PAL.roofRose);
    rod([-.002, .261, .067], [.029, .248, .067], .002, PAL.roofRose);
    box(.019, .007, .004, .034, .248, .067, PAL.roofRose);
    box(.011, .043, .012, .069, .187, .068, PAL.cream2);
    for (const y of [.103, .119, .135]) box(.093, .004, .003, -.016, y, .063, PAL.kawara2);
    for (const y of [.111, .295]) rod([-.094, y - .013, .059], [-.094, y + .013, .059], .005, PAL.kawara2);
    finish('Hose_Box_Door', [-.096, .081, .055]); root.userData.doorPivot = [-.096, .081, .055];
  }
  const bottom = new THREE.Box3().setFromObject(root).min.y;
  for (const child of root.children) child.position.y -= bottom;
  for (const [key, value] of Object.entries(root.userData)) {
    if (!Array.isArray(value)) continue;
    if (typeof value[0] === 'number' && value.length === 3) root.userData[key] = [value[0], value[1] - bottom, value[2]];
    else if (Array.isArray(value[0])) root.userData[key] = value.map(p => [p[0], p[1] - bottom, p[2]]);
  }
  return root;
}
