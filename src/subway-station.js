// Standalone one-cell subway pavilion. Ground/threshold Y=0; stairs extend below ground.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export const STATION_LIGHT_MESHES = ['Window_Band', 'Name_Board', 'Lamp_L', 'Lamp_R'];
export function createSubwayStation() {
  const root = new THREE.Group(); root.name = 'Komachi_Subway_Station';
  root.userData = {
    front: '+Z', groundY: 0, placementY: .12, units: 'game',
    entrance: [0, 0, .38], stairBottom: [0, -.30, -.265],
    stairOpening: { minX: -.235, maxX: .235, minZ: -.34, maxZ: .36 },
    stairTreads: Array.from({ length: 7 }, (_, i) => ({ z: .30 - i * .09, y: -i * .05, depth: .09, width: .44 })),
    lightMeshes: [...STATION_LIGHT_MESHES],
  };
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .91 });
  material.name = 'Pavilion_Matte';
  let parts = [];
  function add(g, tint) {
    const geo = g.index ? g.toNonIndexed() : g; if (geo !== g) g.dispose(); geo.deleteAttribute('uv');
    const c = new THREE.Color(tint), a = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) c.toArray(a, i);
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(geo);
  }
  function box(w, h, d, x, y, z, tint = PAL.wood2) {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); add(g, tint);
  }
  function rod(a, b, radius, tint = PAL.kawara2, segments = 6) {
    const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b), d = q.clone().sub(p);
    const g = new THREE.CylinderGeometry(radius, radius, d.length(), segments);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    g.translate(...p.add(q).multiplyScalar(.5).toArray()); add(g, tint);
  }
  function surface(a, b, c, d, tint, double = false) {
    const triangle = c.every((v,i) => v === d[i]);
    const v = [...a, ...b, ...c];
    if (!triangle) v.push(...a, ...c, ...d);
    if (double) { v.push(...c, ...b, ...a); if (!triangle) v.push(...d, ...c, ...a); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); add(g, tint);
  }
  function finish(name, lit = false, pivot) {
    if (!parts.length) return;
    const g = mergeGeometries(parts); parts.forEach(p => p.dispose()); parts = [];
    if (pivot) g.translate(-pivot[0], -pivot[1], -pivot[2]);
    let mat = material;
    if (lit) {
      g.deleteAttribute('color'); mat = new THREE.MeshStandardMaterial({ color: PAL.window, roughness: .75 });
      mat.name = `${name}_Material`;
    }
    const mesh = new THREE.Mesh(g, mat); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true;
    if (pivot) mesh.position.fromArray(pivot); root.add(mesh); return mesh;
  }
  // No slab, plinth or ground cap. Retaining walls flank an open stair surface.
  for (const x of [-.246, .246]) {
    box(.026, .35, .70, x, -.155, .005, PAL.concrete2);
    box(.038, .15, .69, x, .075, .005, PAL.cream);
    box(.047, .015, .70, x, .155, .005, PAL.wood);
    const railX = Math.sign(x) * .210;
    rod([railX, .22, .32], [railX, -.08, -.22], .006);
    for (let i = 0; i < 3; i++) { const z = .30 - i * .25, y = .21 - i * .139; rod([railX, y, z], [x, y - .065, z], .004); }
  }
  finish('Stairwell_Sides_And_Rails');
  for (let i = 0; i < 7; i++) {
    const front = .345 - i * .09, back = front - .09, y = -i * .05;
    // Treads and risers only, deliberately no box bottoms, landing, or pit floor.
    surface([-.22, y, front], [.22, y, front], [.22, y, back], [-.22, y, back], PAL.concrete, true);
    if (i > 0) surface([-.22, y, front], [.22, y, front], [.22, y + .05, front], [-.22, y + .05, front], PAL.concrete2, true);
    box(.43, .003, .009, 0, y + .0015, front - .009, PAL.cream2);
  }
  finish('Open_Descending_Stairs');
  // A tactile entry strip sits in front of the opening, not across its centre.
  box(.44, .004, .035, 0, .002, .373, PAL.lampGlow);
  for (let i = 0; i < 14; i++) for (const z of [.365, .380]) box(.007, .003, .007, (i - 6.5) * .03, .005, z, PAL.wood);
  for (const x of [-.317, .317]) for (const z of [-.302, .302]) {
    box(.066, .023, .068, x, .0115, z, PAL.concrete2);
    box(.040, .472, .040, x, .247, z, PAL.wood2);
    box(.060, .032, .060, x, .46, z, PAL.wood);
  }
  // Back wall leaves the underground exit unsealed. Low screens preserve sightlines into the stairwell.
  box(.65, .314, .028, 0, .157, -.327, PAL.cream);
  box(.65, .063, .028, 0, .444, -.327, PAL.cream);
  for (const x of [-.298, .298]) box(.054, .164, .028, x, .36, -.327, PAL.cream);
  for (const x of [-.317, .317]) {
    box(.025, .192, .58, x, .096, -.002, PAL.cream);
    box(.036, .016, .61, x, .20, -.002, PAL.wood);
    for (const z of [-.20, -.09, .02, .13, .24]) box(.032, .05, .012, x, .228, z, PAL.wood2);
    box(.035, .014, .61, x, .26, -.002, PAL.wood);
  }
  finish('Pavilion_Frame');
  // Deep eaves begin at 0.48; the roof is entirely above the walking corridor.
  box(.84, .018, .84, 0, .48, 0, PAL.wood);
  for (const x of [-.33, .33]) box(.025, .043, .70, x, .449, 0, PAL.wood2);
  for (const z of [-.33, .33]) box(.70, .043, .025, 0, .449, z, PAL.wood2);
  for (const x of [-.27, -.18, -.09, 0, .09, .18, .27]) for (const s of [-1, 1]) box(.012, .027, .13, x, .47, s * .346, PAL.wood2);
  finish('Eaves_And_Ceiling');
  // Lower hipped skirt, upper front/rear gables and continuous grey kawara tile rolls.
  const lower = [[-.435,.493,-.435],[.435,.493,-.435],[.435,.493,.435],[-.435,.493,.435]];
  const upper = [[-.22,.576,-.278],[.22,.576,-.278],[.22,.576,.278],[-.22,.576,.278]];
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4; surface(lower[i], upper[i], upper[next], lower[next], PAL.kawara, true);
    rod(lower[i], upper[i], .008, PAL.kawara2);
    // Rows of tile ends follow the trapezoid instead of crossing outside the hip.
    for (let k = 1; k <= 3; k++) {
      const t = k / 4, a = lower[i].map((v,j) => v + (upper[i][j] - v) * t), b = lower[next].map((v,j) => v + (upper[next][j] - v) * t);
      a[1] += .004; b[1] += .004; rod(a,b,.0035,PAL.kawara2);
    }
    for (let k = 0; k <= 10; k++) {
      const t = k / 10, a = lower[i].map((v,j) => v + (lower[next][j] - v) * t), b = upper[i].map((v,j) => v + (upper[next][j] - v) * t);
      a[1] += .004; b[1] += .004; rod(a,b,.004,PAL.kawara2);
    }
  }
  for (const s of [-1, 1]) {
    surface([s*.22,.576,-.278],[0,.674,-.278],[0,.674,.278],[s*.22,.576,.278],PAL.kawara,true);
    for (let i = 0; i <= 12; i++) rod([s*.22,.581,-.278+i*.556/12],[0,.679,-.278+i*.556/12],.004,PAL.kawara2);
    for (const t of [.33,.66]) rod([s*.22*(1-t),.581+.098*t,-.278],[s*.22*(1-t),.581+.098*t,.278],.003,PAL.kawara2);
    // Cream gable triangles and timber edging, set just inside the tiled roof.
    surface([-.208,.575,s*.273],[.208,.575,s*.273],[0,.668,s*.273],[0,.668,s*.273],PAL.cream,true);
    rod([-.215,.574,s*.280],[0,.670,s*.280],.005,PAL.wood2); rod([0,.670,s*.280],[.215,.574,s*.280],.005,PAL.wood2);
    box(.43,.012,.013,0,.576,s*.280,PAL.wood2);
  }
  box(.036,.023,.593,0,.683,0,PAL.kawara2);
  for (const z of [-.297,.297]) box(.046,.031,.018,0,.684,z,PAL.kawara2);
  finish('Kawara_Hip_And_Gable_Roof');
  for (const y of [.318,.408]) box(.534,.012,.039,0,y,-.327,PAL.wood2);
  for (const x of [-.261,.261]) box(.012,.101,.039,x,.363,-.327,PAL.wood2); finish('Window_Frame');
  box(.504,.076,.033,0,.363,-.327,PAL.window); finish('Window_Band',true);
  for (const x of [-.166,0,.166]) box(.010,.080,.040,x,.363,-.327,PAL.wood2);
  finish('Window_Mullions');
  box(.373,.084,.020,0,.437,.410,PAL.wood2); finish('Name_Board_Frame');
  box(.350,.063,.008,0,.437,.423,PAL.window); finish('Name_Board',true);
  box(.349,.009,.004,0,.415,.430,PAL.roofTeal);
  const letters={K:['101','110','100','110','101'],O:['111','101','101','101','111'],M:['101','111','111','101','101'],A:['010','101','111','101','101'],C:['111','100','100','100','111'],H:['101','101','111','101','101'],I:['111','010','010','010','111']};
  for (const [i,ch] of [...'KOMACHI'].entries()) for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(letters[ch][row][col]==='1')box(.0065,.005,.003,-.113+(i*4+col)*.0087,.453-row*.006,.430,PAL.indigo);
  finish('Station_Name_Lettering');
  for (const [x,name] of [[-.285,'Lamp_L'],[.285,'Lamp_R']]) {
    rod([x,.477,.353],[x,.448,.353],.003,PAL.wood2);
    for (const y of [.369,.447]) box(.081,.009,.081,x,y,.353,PAL.wood2);
    for (const dx of [-.034,.034]) for(const dz of [-.034,.034])box(.005,.077,.005,x+dx,.408,.353+dz,PAL.wood2);
    finish(`${name}_Frame`);
    box(.067,.069,.067,x,.408,.353,PAL.window);finish(name,true);
  }
  // Clock in the front gable. Hands have independent pivots for an optional running clock.
  rod([0,.619,.281],[0,.619,.291],.040,PAL.wood2,24);
  rod([0,.619,.291],[0,.619,.295],.035,PAL.cream2,24);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;rod([Math.sin(a)*.028,.619+Math.cos(a)*.028,.298],[Math.sin(a)*.032,.619+Math.cos(a)*.032,.298],.0014,PAL.kawara2,4);}
  finish('Clock_Face');
  const pivot=[0,.619,.301];
  rod(pivot,[-.016,.628,.301],.002,PAL.kawara2);finish('Clock_Hour_Hand',false,pivot);
  rod([0,.619,.303],[.021,.631,.303],.0015,PAL.kawara2);finish('Clock_Minute_Hand',false,[0,.619,.303]);
  return root;
}
