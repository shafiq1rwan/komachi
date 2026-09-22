// Original standalone island ro-ro. Bow +Z, waterline Y=0, no game integration.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export function createIslandFerry() {
  const root = new THREE.Group(); root.name = 'Komachi_Island_Ferry';
  root.userData = {
    front: '+Z', units: 'game', waterline: 0,
    deck: [0, .24, .72], carSpacing: .42, carSlotDirection: [0, 0, -1],
    rampPivot: [0, .24, 1.05], wakePoint: [0, 0, -1.05],
    rampClosedAngle: -Math.PI / 2, rampLevelAngle: 0, rampAxis: 'X',
  };
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true });
  let parts = [];
  function add(input, tint) {
    const g = input.index ? input.toNonIndexed() : input;
    if (g !== input) input.dispose(); g.deleteAttribute('uv');
    const c = new THREE.Color(tint), colors = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parts.push(g);
  }
  function box(w, h, d, x, y, z, c = PAL.cream2) {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); add(g, c);
  }
  function rod(a, b, r, c = PAL.cream2, segments = 6) {
    const p = new THREE.Vector3(...a), q = new THREE.Vector3(...b), v = q.clone().sub(p);
    const g = new THREE.CylinderGeometry(r, r, v.length(), segments);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()));
    g.translate(...p.add(q).multiplyScalar(.5).toArray()); add(g, c);
  }
  function finish(name) {
    const geometry = mergeGeometries(parts); parts.forEach(g => g.dispose()); parts = [];
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); return mesh;
  }
  // Chamfered barge bow retains a full-width landing for the central ramp.
  const outline = [[-.35,-1.05],[.35,-1.05],[.475,-.90],[.475,.79],[.29,1.05],[-.29,1.05],[-.475,.79],[-.475,-.90]];
  function band(y0, y1, scale0, scale1, tint, cap = false) {
    const positions = [];
    const point = (i, y, scale) => [outline[i][0] * scale, y, outline[i][1] * scale];
    for (let i = 0; i < outline.length; i++) {
      const j = (i + 1) % outline.length, a = point(i,y0,scale0), b = point(j,y0,scale0), c = point(j,y1,scale1), d = point(i,y1,scale1);
      positions.push(...a,...d,...b,...b,...d,...c);
      if (cap) positions.push(0,y1,0,...c,...d,0,y0,0,...a,...b);
    }
    const g = new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();add(g,tint);
  }
  band(-.12,-.018,.82,1,PAL.kawara2,true);
  band(-.018,.024,1,1,PAL.roofTeal);
  band(.024,.22,1,1,PAL.roofBlue);
  band(.22,.24,1,1,PAL.concrete,true);
  // Low, solid side bulwarks leave the middle lane entirely uncovered.
  for (const side of [-1,1]) {
    box(.024,.105,1.68,side*.452,.2925,-.065,PAL.blueWall);
    box(.034,.015,1.69,side*.452,.3525,-.065,PAL.cream2);
    rod([side*.452,.345,.78],[side*.29,.345,1.026],.009);
    rod([side*.29,.24,1.026],[side*.29,.345,1.026],.009);
    for (const z of [-.88,-.33,.24,.78]) rod([side*.452,.24,z],[side*.452,.346,z],.009,PAL.cream2);
    for (const z of [-.8,.63]) {
      box(.047,.033,.095,side*.394,.2565,z,PAL.kawara2);
      for (const dz of [-.027,.027]) rod([side*.394,.27,z+dz],[side*.394,.305,z+dz],.010,PAL.kawara2);
    }
    // Painted lane borders, with each 0.42 pitch visible on deck.
    box(.014,.002,1.48,side*.205,.241,.285,PAL.cream2);
    for (const z of [-.33,.09,.51,.93]) box(.049,.002,.013,side*.185,.241,z,PAL.cream2);
    // Three dark rubber fender strips on each side, no rust or worn textures.
    for (const z of [-.63,0,.61]) box(.014,.106,.055,side*.478,.128,z,PAL.kawara2);
  }
  box(.55,.10,.022,0,.29,-1.025,PAL.blueWall);
  finish('Hull_Deck_And_Bulwarks');

  // Compact two-level accommodation block aft, behind all three car slots.
  box(.64,.225,.43,0,.3525,-.775,PAL.cream);
  box(.69,.027,.48,0,.4785,-.775,PAL.roofTeal);
  box(.50,.212,.335,0,.598,-.785,PAL.cream2);
  box(.57,.032,.40,0,.72,-.785,PAL.roofSage);
  // Forward bridge glazing and small side windows.
  for (const x of [-.165,0,.165]) box(.145,.10,.008,x,.624,-.613,PAL.sky2);
  for (const side of [-1,1]) {
    for (const z of [-.88,-.72]) box(.008,.10,.126,side*.254,.624,z,PAL.sky2);
    box(.008,.077,.12,side*.324,.377,-.84,PAL.sky2);
    box(.008,.16,.097,side*.327,.333,-.635,PAL.tealWall);
    box(.011,.015,.01,side*.334,.34,-.602,PAL.wood2);
    // Upper landing rail along the roof of the lower storey.
    for (const z of [-.97,-.56]) rod([side*.327,.492,z],[side*.327,.565,z],.005);
    rod([side*.327,.565,-.97],[side*.327,.565,-.56],.005);
  }
  for (const x of [-.15,.15]) box(.19,.092,.008,x,.626,-.956,PAL.sky2);
  box(.12,.17,.008,-.17,.335,-.555,PAL.tealWall);
  box(.015,.02,.011,-.135,.337,-.547,PAL.wood2);
  // Ladder to the upper level, at the outer aft wall.
  for (const x of [.255,.313]) rod([x,.25,-.996],[x,.49,-.996],.005,PAL.lamp);
  for (let y=.275;y<.50;y+=.039) rod([.255,y,-.996],[.313,y,-.996],.004,PAL.lamp);
  // Short funnel with teal band and dark cap.
  box(.09,.132,.088,-.17,.797,-.877,PAL.cream2);
  box(.094,.034,.092,-.17,.822,-.877,PAL.roofTeal);
  box(.104,.016,.102,-.17,.87,-.877,PAL.kawara2);
  rod([.10,.736,-.77],[.10,.978,-.77],.007,PAL.lamp);
  rod([.014,.89,-.77],[.186,.89,-.77],.005,PAL.lamp);
  box(.09,.018,.025,.1,.954,-.77,PAL.cream2);
  box(.023,.025,.023,.1,.988,-.77,PAL.lampGlow);
  // Life ring fixed to starboard rail, cream quadrants alternating with rose.
  for (let i=0;i<12;i++) {
    const a=i*Math.PI/6,b=(i+1)*Math.PI/6;
    rod([.348,.535+Math.cos(a)*.046,-.777+Math.sin(a)*.046],[.348,.535+Math.cos(b)*.046,-.777+Math.sin(b)*.046],.011,Math.floor(i/3)%2?PAL.cream2:PAL.roofRose,5);
  }
  finish('Stern_Wheelhouse_And_Fittings');

  // Original name 小町丸 (Komachi Maru), drawn as geometric strokes on side boards.
  const glyphs = [
    [[[.5,.92],[.5,.12],[.36,.05]],[[.26,.67],[.08,.26]],[[.72,.67],[.93,.27]]],
    [[[.02,.84],[.48,.84],[.48,.12],[.02,.12],[.02,.84]],[[.25,.84],[.25,.12]],[[.02,.48],[.48,.48]],[[.58,.84],[.98,.84]],[[.81,.84],[.81,.07],[.68,.07]]],
    [[[.08,.71],[.70,.71],[.70,.08],[.87,.08],[.96,.2]],[[.43,.94],[.40,.51],[.28,.21],[.08,.05]],[[.24,.54],[.57,.24]]],
  ];
  for (const side of [-1,1]) {
    box(.016,.105,.305,side*.333,.414,-.79,PAL.roofTeal);
    for (const [i,strokes] of glyphs.entries()) for (const stroke of strokes) for(let j=1;j<stroke.length;j++) {
      const p=stroke[j-1],q=stroke[j];
      const map=([u,v])=>[side*.344,.377+v*.071,-.79+side*(.132-(i+u)*.088)];
      rod(map(p),map(q),.0028,PAL.cream2,4);
    }
  }
  finish('Komachi_Maru_Name_Boards');

  // Model the ramp level in local +Z, origin exactly on hinge. Export it raised.
  box(.5,.02,.8,0,-.01,.4,PAL.concrete2);
  for (const x of [-.238,.238]) box(.024,.038,.8,x,.009,.4,PAL.roofTeal);
  for (let z=.065;z<.78;z+=.085) box(.448,.006,.012,0,.003,z,PAL.lamp);
  for (const x of [-.17,.17]) box(.028,.027,.76,x,-.0335,.4,PAL.kawara);
  rod([-.26,0,0],[.26,0,0],.015,PAL.kawara2,8);
  const ramp=finish('Ramp');ramp.position.fromArray(root.userData.rampPivot);ramp.rotation.x=-Math.PI/2;
  ramp.userData={hingeAxis:'X',closedAngle:-Math.PI/2,levelAngle:0,width:.5,length:.8};
  return root;
}
