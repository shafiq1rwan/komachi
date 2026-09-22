// Standalone models only. No registration, simulation or game imports.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export const TOWN_SERVICE_KINDS = ['town-hall', 'clinic', 'fire-station', 'kei-fire-truck', 'community-centre'];

function modeller(root) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94, flatShading: true });
  let parts = [];
  function add(input, tint) {
    const g = input.index ? input.toNonIndexed() : input;
    if (g !== input) input.dispose();
    g.deleteAttribute('uv');
    const c = new THREE.Color(tint), colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parts.push(g);
  }
  function box(w, h, d, x, y, z, tint = PAL.cream2, rx = 0) {
    const g = new THREE.BoxGeometry(w, h, d); g.rotateX(rx); g.translate(x, y, z); add(g, tint);
  }
  function rod(a, b, r, tint = PAL.kawara2, segments = 8) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const g = new THREE.CylinderGeometry(r, r, delta.length(), segments);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    g.translate(...start.add(end).multiplyScalar(.5).toArray()); add(g, tint);
  }
  function disc(r, depth, x, y, z, tint) { rod([x, y, z - depth / 2], [x, y, z + depth / 2], r, tint, 24); }
  function finish(name, pivot = [0, 0, 0]) {
    if (!parts.length) return;
    const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); parts = [];
    g.translate(-pivot[0], -pivot[1], -pivot[2]);
    const mesh = new THREE.Mesh(g, material); mesh.name = name; mesh.position.fromArray(pivot);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  }
  function window(x, y, z, w, h, rotation = 0) {
    const start = parts.length;
    box(w + .026, h + .026, .022, 0, 0, 0, PAL.kawara2);
    box(w, h, .015, 0, 0, .014, PAL.sky2);
    box(.012, h, .015, 0, 0, .025, PAL.cream2);
    box(w, .012, .015, 0, 0, .025, PAL.cream2);
    box(w + .05, .022, .053, 0, -h / 2 - .015, .012, PAL.concrete);
    for (let i = start; i < parts.length; i++) { parts[i].rotateY(rotation); parts[i].translate(x, y, z); }
  }
  function roof(w, d, y, h, z, tint = PAL.kawara) {
    // Two thick slopes, ridge along X, open triangle ends filled below.
    const angle = Math.atan2(h, d / 2), slope = Math.hypot(h, d / 2);
    for (const s of [-1, 1]) {
      box(w, .035, slope, 0, y + h / 2, z + s * d / 4, tint, s * angle);
      box(w + .01, .025, .028, 0, y - .01, z + s * d / 2, PAL.kawara2);
      for (let x = -w / 2 + .04; x < w / 2; x += .095)
        rod([x, y + .02, z + s * d / 2], [x, y + h + .02, z], .004, PAL.kawara2, 5);
    }
    box(w + .015, .035, .047, 0, y + h + .014, z, PAL.kawara2);
    const shape = new THREE.Shape(); shape.moveTo(-d / 2, 0); shape.lineTo(d / 2, 0); shape.lineTo(0, h); shape.closePath();
    for (const x of [-w / 2 + .06, w / 2 - .075]) {
      const g = new THREE.ExtrudeGeometry(shape, { depth: .015, bevelEnabled: false });
      g.rotateY(Math.PI / 2); g.translate(x, y, z); add(g, PAL.cream);
    }
  }
  const letters = {
    A:['010','101','111','101','101'], C:['111','100','100','100','111'], E:['111','100','110','100','111'],
    F:['111','100','110','100','100'], H:['101','101','111','101','101'], I:['111','010','010','010','111'],
    L:['100','100','100','100','111'], M:['10001','11011','10101','10101','10001'], N:['1001','1101','1011','1001','1001'],
    O:['111','101','101','101','111'], R:['110','101','110','101','101'], T:['111','010','010','010','010'],
    U:['101','101','101','101','111'], W:['10001','10001','10101','10101','01010'], Y:['101','101','010','010','010'],
  };
  function text(str, x, y, z, width, tint = PAL.cream2) {
    const units = [...str].reduce((n, ch) => n + (letters[ch]?.[0].length ?? 2) + 1, -1), p = width / units;
    let cursor = x - width / 2;
    for (const ch of str) {
      const rows = letters[ch];
      if (rows) rows.forEach((row, iy) => [...row].forEach((v, ix) => { if (v === '1') box(p * .84, p * .84, .004, cursor + (ix + .5) * p, y + (2 - iy) * p, z, tint); }));
      cursor += ((rows?.[0].length ?? 2) + 1) * p;
    }
  }
  function planter(x, z, w = .18) {
    box(w, .075, .12, x, .0875, z, PAL.wood); box(w - .014, .008, .10, x, .128, z, PAL.dirt);
    for (const dx of [-.25, .25]) { const g = new THREE.DodecahedronGeometry(w * .30); g.scale(1, .8, .8); g.translate(x + dx * w, .16, z); add(g, PAL.bush); }
  }
  function bench(x, z, w) {
    for (const dx of [-w * .37, w * .37]) box(.024, .085, .105, x + dx, .095, z, PAL.kawara2);
    box(w, .025, .12, x, .148, z, PAL.wood); box(w, .085, .022, x, .202, z - .046, PAL.wood);
  }
  function door(x, z, w = .28, y = .05) {
    box(w + .03, .39, .03, x, y + .195, z, PAL.kawara2);
    for (const s of [-1, 1]) {
      box(w / 2 - .012, .35, .018, x + s * w / 4, y + .195, z + .024, PAL.sky2);
      box(.008, .07, .012, x + s * .018, y + .18, z + .04, PAL.wood2);
    }
    box(w + .035, .017, .055, x, y + .008, z + .018, PAL.concrete2);
  }
  return { add, box, rod, disc, finish, window, roof, text, planter, bench, door };
}

function createTruck() {
  const root = new THREE.Group(); root.name = 'Kei_Fire_Truck';
  root.userData = { front: '+Z', units: 'game', standalone: true, wheelAxis: 'X', wheelRadius: .047 };
  const { box, rod, disc, finish } = modeller(root);
  const red = PAL.roofRose;
  box(.244, .035, .47, 0, .076, 0, PAL.kawara2);
  box(.25, .082, .25, 0, .13, -.108, red);
  box(.25, .155, .194, 0, .175, .118, red);
  box(.26, .019, .203, 0, .261, .118, red);
  box(.217, .085, .008, 0, .206, .219, PAL.sky2);
  box(.008, .083, .012, 0, .206, .226, PAL.cream2);
  for (const x of [-.13, .13]) {
    box(.006, .083, .139, x, .208, .128, PAL.sky2);
    box(.009, .11, .012, x, .20, .142, red);
    box(.009, .009, .025, x, .148, .071, PAL.cream2);
    box(.011, .027, .035, x * 1.15, .207, .205, PAL.kawara2);
    rod([x, .197, .188], [x * 1.15, .207, .205], .004);
    box(.011, .024, .385, x, .122, -.003, PAL.cream2);
  }
  box(.268, .024, .018, 0, .084, .24, PAL.concrete2);
  box(.14, .025, .01, 0, .12, .222, PAL.kawara2);
  for (const x of [-.094, .094]) box(.041, .026, .011, x, .136, .227, PAL.lampGlow);
  box(.067, .022, .009, 0, .088, .254, PAL.cream2);
  box(.25, .022, .018, 0, .081, -.25, PAL.concrete2);
  for (const x of [-.1, .1]) box(.028, .023, .009, x, .105, -.246, red);
  box(.145, .012, .04, 0, .279, .116, PAL.kawara2);
  for (const x of [-.052, .052]) box(.045, .025, .038, x, .297, .116, red);
  // Pump locker, hose reel, rolled hose and ladder over the equipment bed.
  box(.205, .077, .12, 0, .205, -.045, PAL.concrete2);
  box(.209, .064, .09, 0, .204, -.057, PAL.cream2);
  for (const x of [-.109, .109]) for (const z of [-.084, -.039])
    rod([x - .005, .21, z], [x + .005, .21, z], .013, PAL.kawara2);
  disc(.063, .014, 0, .193, -.185, red); disc(.048, .020, 0, .193, -.195, PAL.raw);
  for (const r of [.02, .034, .047]) {
    // Polygonal concentric hose detail.
    for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, b = (i + 1) * Math.PI / 8;
      rod([Math.cos(a) * r, .193 + Math.sin(a) * r, -.208], [Math.cos(b) * r, .193 + Math.sin(b) * r, -.208], .003, PAL.wood2, 5); }
  }
  for (const x of [-.09, .09]) { rod([x, .175, -.215], [x, .286, -.215], .006); rod([x, .175, -.012], [x, .286, -.012], .006); }
  for (const x of [-.068, .068]) rod([x, .288, -.23], [x, .288, .012], .005, PAL.lamp);
  for (let z = -.22; z <= .01; z += .039) rod([-.07, .288, z], [.07, .288, z], .004, PAL.lamp);
  finish('Truck_Body_And_Equipment');
  for (const [side, x] of [['Left', -.125], ['Right', .125]]) for (const [axle, z] of [['Front', .145], ['Rear', -.156]]) {
    rod([x - .019, .047, z], [x + .019, .047, z], .047, PAL.kawara2, 12);
    rod([x - .021, .047, z], [x + .021, .047, z], .025, PAL.lamp, 12);
    finish(`Wheel_${side}_${axle}`, [x, .047, z]);
  }
  return root;
}

export function createTownService(kind) {
  if (!TOWN_SERVICE_KINDS.includes(kind)) throw new Error(`Unknown town service: ${kind}`);
  if (kind === 'kei-fire-truck') return createTruck();
  const root = new THREE.Group(); root.name = `Komachi_${kind.replaceAll('-', '_')}`;
  root.userData = { front: '+Z', units: 'game', standalone: true, footprintCells: kind === 'town-hall' ? [2, 1] : [1, 1] };
  const { box, rod, disc, finish, window, roof, text, planter, bench, door } = modeller(root);
  if (kind === 'town-hall') {
    box(1.9, .05, .9, 0, .025, 0, PAL.concrete);
    box(1.69, .09, .62, 0, .095, -.095, PAL.concrete2);
    box(1.65, .64, .6, 0, .445, -.095, PAL.cream);
    box(1.7, .045, .64, 0, .76, -.095, PAL.cream2);
    for (const x of [-.78, -.31, .31, .78]) box(.036, .62, .035, x, .45, .222, PAL.cream2);
    for (const x of [-.56, .56]) window(x, .46, .209, .29, .32);
    for (const x of [-.828, .828]) window(x, .46, -.12, .25, .3, x < 0 ? -Math.PI / 2 : Math.PI / 2);
    for (const x of [-.56, 0, .56]) window(x, .46, -.399, .27, .28, Math.PI);
    roof(1.81, .75, .79, .20, -.06);
    // Central clock pavilion makes the public building legible from the street.
    box(.39, .27, .21, 0, .87, .165, PAL.cream2);
    box(.43, .035, .25, 0, 1.015, .165, PAL.kawara2);
    disc(.101, .026, 0, .889, .283, PAL.wood);
    disc(.084, .013, 0, .889, .303, PAL.cream2);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6;
      rod([Math.sin(a) * .066, .889 + Math.cos(a) * .066, .312], [Math.sin(a) * .075, .889 + Math.cos(a) * .075, .312], .0026, PAL.kawara2, 5); }
    rod([0, .889, .316], [-.032, .913, .316], .004); rod([0, .889, .316], [.033, .932, .316], .003);
    box(.48, .055, .04, 0, .713, .251, PAL.indigo); text('TOWN HALL', 0, .713, .275, .405);
    door(0, .212, .31, .1);
    box(.60, .04, .235, 0, .08, .3225, PAL.concrete2);
    box(.46, .02, .065, 0, .06, .4175, PAL.concrete);
    for (const x of [-.257, .257]) { box(.026, .47, .026, x, .335, .392, PAL.wood2); box(.05, .034, .05, x, .112, .392, PAL.concrete); }
    box(.64, .038, .255, 0, .584, .308, PAL.kawara);
    box(.61, .032, .022, 0, .554, .433, PAL.wood2);
    planter(.74, .335, .24); bench(-.58, .32, .29); finish('Town_Hall_Building_And_Porch');
    box(.075, .03, .075, -.872, .065, .29, PAL.concrete2);
    rod([-.872, .08, .29], [-.872, 1.184, .29], .006, PAL.lamp);
    rod([-.872, 1.182, .29], [-.872, 1.2, .29], .010, PAL.wood);
    // A small municipal flag with a simple circle emblem, fully modelled.
    box(.196, .122, .005, -.766, 1.096, .29, PAL.cream2);
    disc(.029, .008, -.766, 1.096, .295, PAL.roofTeal);
    disc(.029, .008, -.766, 1.096, .285, PAL.roofTeal);
    finish('Town_Hall_Flagpole');
    root.userData.entrance = [0, .1, .25]; root.userData.newcomerStop = [0, .1, .35];
  } else if (kind === 'clinic') {
    box(.94, .045, .94, 0, .0225, 0, PAL.concrete);
    box(.79, .58, .65, 0, .335, -.07, PAL.cream2);
    box(.80, .10, .66, 0, .095, -.07, PAL.tealWall);
    box(.88, .045, .75, 0, .65, -.07, PAL.roofTeal);
    box(.85, .07, .025, 0, .695, .295, PAL.tealWall);
    box(.025, .07, .72, -.413, .695, -.07, PAL.tealWall);
    box(.025, .07, .72, .413, .695, -.07, PAL.tealWall);
    box(.85, .07, .025, 0, .695, -.428, PAL.tealWall);
    window(.205, .33, .261, .23, .24);
    for (const x of [-.398, .398]) window(x, .37, -.12, .25, .22, x < 0 ? -Math.PI / 2 : Math.PI / 2);
    window(0, .37, -.399, .38, .22, Math.PI);
    box(.43, .09, .025, -.14, .583, .279, PAL.roofTeal); text('CLINIC', -.14, .583, .295, .32);
    box(.42, .023, .23, -.14, .501, .343, PAL.roofTeal, .1);
    box(.42, .043, .016, -.14, .472, .455, PAL.mint);
    // A real opening with a recessed back surface and two separate sliding leaves.
    // The body behind the leaves is a dark recess; this exterior has no room interior.
    box(.315, .355, .018, -.14, .223, .266, PAL.kawara2);
    box(.32, .014, .075, -.14, .053, .29, PAL.concrete2);
    box(.342, .027, .038, -.14, .416, .285, PAL.cream2);
    bench(.23, .365, .25);
    box(.17, .1, .13, .2, .729, -.21, PAL.concrete2);
    for (let i = 0; i < 4; i++) box(.12, .005, .007, .2, .7 + i * .018, -.14, PAL.kawara);
    finish('Clinic_Building_And_Awning');
    for (const [name, x, direction] of [['Left', -.214, -1], ['Right', -.066, 1]]) {
      box(.143, .332, .015, x, .224, .283, PAL.cream2);
      box(.12, .247, .01, x, .25, .297, PAL.sky2);
      box(.007, .065, .012, x - direction * .047, .222, .308, PAL.kawara2);
      const leaf = finish(`Clinic_Sliding_Door_${name}`, [x, .224, .283]); leaf.userData.openOffset = [direction * .14, 0, 0];
    }
    box(.16, .18, .044, .29, .767, .21, PAL.cream2);
    box(.10, .029, .009, .29, .768, .237, PAL.roofSage); box(.029, .10, .009, .29, .768, .237, PAL.roofSage);
    finish('Clinic_Green_Plus'); root.userData.entrance = [-.14, .06, .36];
  } else if (kind === 'fire-station') {
    box(.96, .045, .96, 0, .0225, 0, PAL.concrete);
    // Hollow garage: back, sides, service-room partition, and header only.
    box(.86, .66, .044, 0, .375, -.391, PAL.cream);
    for (const x of [-.409, .409]) box(.044, .66, .76, x, .375, -.03, PAL.cream);
    box(.045, .60, .72, .168, .345, -.028, PAL.cream);
    box(.21, .60, .045, .295, .345, .329, PAL.cream);
    box(.91, .12, .82, 0, .708, -.03, PAL.roofRose);
    box(.96, .039, .9, 0, .784, -.03, PAL.kawara);
    box(.51, .022, .072, -.122, .632, .337, PAL.kawara2);
    for (let y = .59; y <= .63; y += .012) box(.50, .006, .022, -.122, y, .351, PAL.concrete2);
    for (const x of [-.376, .135]) box(.02, .536, .025, x, .315, .349, PAL.kawara2);
    box(.53, .012, .67, -.122, .051, -.025, PAL.concrete2);
    for (const x of [-.343, .102]) box(.012, .006, .28, x, .052, .318, PAL.cream2);
    door(.292, .357, .135);
    window(.432, .4, -.05, .27, .23, Math.PI / 2);
    window(-.432, .4, -.10, .29, .22, -Math.PI / 2);
    window(0, .40, -.417, .34, .22, Math.PI);
    text('FIRE', -.12, .714, .385, .22);
    box(.115, .17, .04, .405, .145, .425, PAL.roofRose);
    box(.015, .038, .008, .434, .145, .45, PAL.cream2);
    rod([.315, .808, -.28], [.315, .917, -.28], .012, PAL.kawara2);
    disc(.027, .051, .315, .914, -.256, PAL.cream2);
    finish('Fire_Station_Open_Bay');
    const truck = createTruck(); truck.name = 'Parked_Kei_Fire_Truck'; truck.position.set(-.122, .058, -.03); root.add(truck);
    root.userData.entrance = [.292, .045, .421]; root.userData.vehicleExit = [-.122, .051, .48];
    root.userData.parkedTruckNode = truck.name;
  } else {
    box(.96, .045, .94, 0, .0225, 0, PAL.concrete);
    box(.8, .56, .62, 0, .325, -.08, PAL.cream);
    box(.815, .07, .63, 0, .08, -.08, PAL.wood);
    roof(.93, .79, .625, .18, -.055, PAL.roofSage);
    for (const x of [-.365, .365]) box(.032, .57, .03, x, .335, .242, PAL.wood2);
    door(-.135, .237, .28);
    for (const x of [-.403, .403]) window(x, .37, -.1, .31, .24, x < 0 ? -Math.PI / 2 : Math.PI / 2);
    window(0, .37, -.395, .40, .24, Math.PI);
    box(.66, .078, .03, 0, .559, .258, PAL.wood2); text('COMMUNITY', 0, .56, .277, .56);
    box(.44, .025, .19, -.135, .467, .32, PAL.roofSage, .09);
    bench(.19, .364, .30); planter(-.372, .34, .13); finish('Community_Centre_Building');
    // Wall-mounted chronicle case above the bench; emblem and pages are geometry.
    box(.22, .255, .038, .319, .316, .427, PAL.wood2);
    box(.196, .227, .010, .319, .316, .452, PAL.raw);
    for (const x of [.271, .36]) {
      box(.073, .115, .004, x, .291, .460, PAL.cream2);
      for (let i = 0; i < 4; i++) box(.052, .003, .003, x, .321 - i * .020, .464, PAL.kawara);
    }
    box(.086, .052, .008, .319, .394, .463, PAL.roofTeal);
    box(.036, .039, .005, .297, .394, .469, PAL.cream2); box(.036, .039, .005, .341, .394, .469, PAL.cream2);
    finish('Town_Chronicle_Case').position.set(-.094, .07, -.16);
    root.userData.entrance = [-.135, .05, .37]; root.userData.chroniclePoint = [.225, .05, .425];
  }
  return root;
}
