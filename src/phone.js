// Original texture-free handheld smartphone. Centre origin, +Y top, +Z screen.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export function createPhone(color = PAL.roofTeal) {
  const root = new THREE.Group(); root.name = 'Komachi_Phone';
  root.userData = { front: '+Z', top: '+Y', gripPoint: [0, -.016, 0], screenMesh: 'Phone_Screen', units: 'game' };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7 });
  mat.name = 'Phone_Case_Material'; let parts = [];
  function add(g, tint) {
    const geo = g.index ? g.toNonIndexed() : g; if (geo !== g) g.dispose(); geo.deleteAttribute('uv');
    const c = new THREE.Color(tint), a = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) c.toArray(a, i);
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(geo);
  }
  function box(w,h,d,x,y,z,tint) { const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,tint); }
  function rounded(w,h,d,r,x,y,z,tint) {
    const s=new THREE.Shape(),a=-w/2,b=-h/2;
    s.moveTo(a+r,b);s.lineTo(a+w-r,b);s.quadraticCurveTo(a+w,b,a+w,b+r);s.lineTo(a+w,b+h-r);s.quadraticCurveTo(a+w,b+h,a+w-r,b+h);s.lineTo(a+r,b+h);s.quadraticCurveTo(a,b+h,a,b+h-r);s.lineTo(a,b+r);s.quadraticCurveTo(a,b,a+r,b);
    const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:3});g.translate(x,y,z-d/2);add(g,tint);
  }
  function lens(r,x,y,z,tint) { const g=new THREE.CylinderGeometry(r,r,.0008,12);g.rotateX(Math.PI/2);g.translate(x,y,z);add(g,tint); }
  function finish(name,screen=false) {
    const geo=mergeGeometries(parts);parts.forEach(g=>g.dispose());parts=[];
    let material=mat;
    if(screen){geo.deleteAttribute('color');material=new THREE.MeshStandardMaterial({color:PAL.indigo,roughness:.35});material.name='Phone_Screen_Material';}
    const mesh=new THREE.Mesh(geo,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);
  }
  rounded(.047,.087,.008,.006,0,0,0,color);
  rounded(.043,.083,.001,.005,0,0,.0044,PAL.kawara2);
  // Rear camera island, two lenses, flash and a small geometric badge.
  rounded(.020,.030,.0018,.003,-.010,.024,-.0048,PAL.kawara);
  for(const y of [.031,.018]){lens(.005,-.010,y,-.006,PAL.kawara2);lens(.0036,-.010,y,-.0066,PAL.indigo);lens(.0011,-.011,y+.001,-.0071,PAL.sky2);}
  lens(.0025,.008,.030,-.0046,PAL.cream2);
  rounded(.011,.005,.0006,.002,0,-.022,-.0043,PAL.cream);
  box(.0018,.012,.004,.024,.014,0,PAL.kawara);
  for(const y of [.019,.007])box(.0015,.008,.003,-.024,y,0,PAL.kawara);
  // Charging port and speaker dots on the bottom edge.
  box(.009,.0007,.0025,0,-.04365,0,PAL.kawara2);
  for(const x of [-.015,-.012,.012,.015])box(.0013,.0007,.0015,x,-.04365,0,PAL.kawara2);
  finish('Phone_Case_And_Cameras');
  rounded(.0375,.071,.0005,.0036,0,-.0005,.0052,PAL.indigo);finish('Phone_Screen',true);
  // Small geometry-only home screen: status strip, clock-like bars, six coloured tiles and dock.
  rounded(.012,.0015,.0004,.0006,-.003,.033,.0057,PAL.kawara2);lens(.0012,.006,.033,.0058,PAL.kawara2);
  box(.003,.0013,.0004,.014,.028,.0057,PAL.cream2);
  for(let i=0;i<3;i++)box(.001,.001+i*.0007,.0004,-.015+i*.0017,.028,.0057,PAL.cream2);
  for(const x of [-.007,.001,.007])box(.004,.006,.0004,x,.015,.0057,PAL.cream2);
  box(.001,.001,.0004,-.002,.016,.0058,PAL.cream2);box(.001,.001,.0004,-.002,.013,.0058,PAL.cream2);
  for(let i=0;i<6;i++)rounded(.007,.007,.0005,.0014,(i%3-1)*.010,-.002-Math.floor(i/3)*.011,.0058,[PAL.roofTeal,PAL.roofPeach,PAL.sky2,PAL.roofRose,PAL.cream2,PAL.roofSage][i]);
  rounded(.025,.007,.0004,.002,0,-.026,.0058,PAL.kawara);
  for(const x of [-.008,0,.008])box(.003,.003,.0004,x,-.026,.0061,PAL.cream2);
  rounded(.012,.0012,.0004,.0005,0,-.033,.0058,PAL.cream2);
  finish('Phone_Screen_Icons');
  return root;
}
