// A texture-free tea can; the curved sticker, lettering and leaf export inside the GLB.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export function createTeaCan() {
  const parts = [];
  const add = (geo, color) => {
    const g = geo.index ? geo.toNonIndexed() : geo; if (g !== geo) geo.dispose(); g.deleteAttribute('uv');
    const c = new THREE.Color(color), a = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) c.toArray(a, i);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); parts.push(g);
  };
  const cylinder = (rt, rb, height, y, color) => { const g = new THREE.CylinderGeometry(rt, rb, height, 24); g.translate(0, y, 0); add(g, color); };
  cylinder(.023, .023, .059, 0, PAL.roofTeal);
  cylinder(.022, .023, .004, .0315, PAL.roofTeal); cylinder(.023, .022, .004, -.0315, PAL.roofTeal);
  cylinder(.024, .024, .002, .034, PAL.concrete2); cylinder(.024, .024, .002, -.034, PAL.concrete2);
  cylinder(.0218, .0218, .001, .0352, PAL.lamp);
  const rim = new THREE.TorusGeometry(.0228, .001, 6, 24); rim.rotateX(Math.PI / 2); rim.translate(0, .0355, 0); add(rim, PAL.cream2);
  const opening = new THREE.CircleGeometry(.005, 12); opening.rotateX(-Math.PI / 2); opening.scale(1,1,1.35); opening.translate(0,.0358,.009); add(opening,PAL.kawara2);
  const tab = new THREE.TorusGeometry(.0043,.0012,4,12); tab.rotateX(Math.PI/2); tab.scale(1,1,1.5); tab.translate(0,.037,-.003); add(tab,PAL.concrete2);
  const label = new THREE.CylinderGeometry(.0233,.0233,.044,24,1,true,-1.05,2.1); add(label,PAL.cream);
  // Small vector label elements are wrapped onto the front of the cylindrical sticker.
  function sticker(geo, color, radius=.0235, subdivisions=0) {
    if(subdivisions){
      const raw=geo.index?geo.toNonIndexed():geo,points=raw.attributes.position;let tris=[];
      for(let i=0;i<points.count;i+=3)tris.push([0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(points,i+k)));
      for(let i=0;i<subdivisions;i++)tris=tris.flatMap(([a,b,c])=>{const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);return[[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];});
      if(raw!==geo)raw.dispose();geo.dispose();geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(tris.flatMap(t=>t.flatMap(p=>p.toArray())),3));
    }
    const p=geo.attributes.position;
    for(let i=0;i<p.count;i++){const angle=p.getX(i)/radius;p.setXYZ(i,Math.sin(angle)*radius,p.getY(i),Math.cos(angle)*radius);}
    const normals=new Float32Array(p.count*3);
    for(let i=0;i<p.count;i++){normals[i*3]=p.getX(i)/radius;normals[i*3+2]=p.getZ(i)/radius;}
    geo.setAttribute('normal',new THREE.BufferAttribute(normals,3));add(geo,color);
  }
  const glyphs={T:['111','010','010','010','010'],E:['111','100','110','100','111'],A:['010','101','111','101','101']};
  for(const [n,letter] of [...'TEA'].entries())for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(glyphs[letter][row][col]==='1'){
    const g=new THREE.PlaneGeometry(.0018,.0018);g.translate((n*4+col-5)*.002,.013-row*.002,0);sticker(g,PAL.roofTeal);
  }
  const leaf=new THREE.Shape();leaf.moveTo(-.008,-.012);leaf.quadraticCurveTo(-.01,.002,.009,-.003);leaf.quadraticCurveTo(.008,-.016,-.008,-.012);
  sticker(new THREE.ShapeGeometry(leaf,5),PAL.roofSage,.0236,2);
  const vein=new THREE.PlaneGeometry(.014,.0008,8);vein.rotateZ(.45);vein.translate(0,-.007,0);sticker(vein,PAL.cream2,.0238);
  const band=new THREE.PlaneGeometry(.025,.001,16);band.translate(0,-.0175,0);sticker(band,PAL.roofTeal,.0236);
  const geometry=mergeGeometries(parts);parts.forEach(p=>p.dispose());
  const can=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65}));
  can.name='Komachi_Tea_Can';can.castShadow=true;can.userData.teaCan=true;return can;
}

const mouth=new THREE.Vector3(),aim=new THREE.Vector3(),palm=new THREE.Vector3(-.155,-.01,.035),top=new THREE.Vector3();
/** aim a rigid Kenney arm at a point given in the character group's space (left arm: mirrored palm) */
export function aimArm(char, arm, target, left = false) {
  aim.copy(target); char.grp.localToWorld(aim); arm.parent.worldToLocal(aim); aim.sub(arm.position).normalize();
  const p = palm.clone(); if (left) p.x *= -1; arm.quaternion.setFromUnitVectors(p.normalize(), aim);
}
/** Keep the rim at the mouth during a sip and aim the rigid Kenney arm at the can. */
export function updateTeaDrink(char,sip) {
  const can=char.item;if(!can?.userData.teaCan||!char.armR||!char.head)return;
  char.grp.updateWorldMatrix(true,true);
  mouth.set(0,.012,.17);char.head.localToWorld(mouth);char.grp.worldToLocal(mouth);
  can.rotation.set(-1.05*sip,0,-.12*(1-sip));
  top.set(0,.036,0).applyEuler(can.rotation);
  can.position.set(-.085,.115,.075).lerp(mouth.sub(top).add(new THREE.Vector3(0,0,.004)),sip);
  aim.copy(can.position);aim.x-=.022;char.grp.localToWorld(aim);char.armR.parent.worldToLocal(aim);aim.sub(char.armR.position).normalize();
  char.armR.quaternion.setFromUnitVectors(palm.clone().normalize(),aim);
}
