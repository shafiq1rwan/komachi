// Folded handheld newspaper. Centre origin, +Y masthead, +Z front page.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export function createNewspaper() {
  const root=new THREE.Group();root.name='Komachi_Folded_Newspaper';
  root.userData={front:'+Z',top:'+Y',units:'game',gripPoint:[0,-.024,0],fold:'bottom edge',static:true};
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});mat.name='Newspaper_Matte';let parts=[];
  function add(g,tint){const geo=g.index?g.toNonIndexed():g;if(g!==geo)g.dispose();geo.deleteAttribute('uv');const c=new THREE.Color(tint),a=new Float32Array(geo.attributes.position.count*3);for(let i=0;i<a.length;i+=3)c.toArray(a,i);geo.setAttribute('color',new THREE.BufferAttribute(a,3));parts.push(geo);}
  function box(w,h,d,x,y,z,tint){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,tint);}
  function finish(name){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());parts=[];const m=new THREE.Mesh(g,mat);m.name=name;m.castShadow=m.receiveShadow=true;root.add(m);}
  // Closed outer paper wraps around the bottom fold, with a softly bulging front.
  const profile=new THREE.Shape();profile.moveTo(.044,.0028);profile.lineTo(.013,.0043);profile.lineTo(-.040,.0040);
  profile.quadraticCurveTo(-.048,.004,-.048,0);profile.quadraticCurveTo(-.048,-.0038,-.040,-.0038);
  profile.lineTo(.042,-.0025);profile.lineTo(.042,-.0016);profile.lineTo(-.040,-.0028);
  profile.quadraticCurveTo(-.046,-.0028,-.046,0);profile.quadraticCurveTo(-.046,.0028,-.040,.0028);
  profile.lineTo(.013,.0032);profile.lineTo(.044,.0017);profile.closePath();
  const shell=new THREE.ExtrudeGeometry(profile,{depth:.118,bevelEnabled:false,curveSegments:5});
  // Profile XY -> world YZ; extrusion Z -> world X (a proper cyclic rotation).
  shell.applyMatrix4(new THREE.Matrix4().set(0,0,1,-.059,1,0,0,0,0,1,0,0,0,0,0,1));add(shell,PAL.cream2);
  for(let i=0;i<4;i++)box(.115-i*.001,.079+i*.0015,.00065,(i%2)*.0006,-.001+i*.00045,-.0018+i*.00105,i%2?PAL.cream:PAL.concrete);
  finish('Folded_Paper_And_Edges');
  function frontZ(y){return y>.013?.0043-(y-.013)*(.0015/.031):.0040+(y+.040)*(.0003/.053);}
  function printRect(w,h,x,y,tint=PAL.kawara2,rear=false,layer=0){
    const g=new THREE.PlaneGeometry(w,h);if(rear)g.rotateY(Math.PI);
    const p=g.attributes.position;for(let i=0;i<p.count;i++){const yy=p.getY(i)+y;p.setXYZ(i,p.getX(i)+x,yy,rear?-.0038+(yy+.040)*(.0013/.082)-.00012-layer*.0001:frontZ(yy)+.00012+layer*.0001);}g.computeVertexNormals();add(g,tint);
  }
  const font={K:['101','110','100','110','101'],O:['111','101','101','101','111'],M:['101','111','111','101','101'],A:['010','101','111','101','101'],C:['111','100','100','100','111'],H:['101','101','111','101','101'],I:['111','010','010','010','111']};
  for(const [i,ch]of[...'KOMACHI'].entries())for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(font[ch][row][col]==='1')printRect(.0025,.0025,-.042+(i*4+col)*.0032,.034-row*.0028);
  printRect(.102,.001,0,.019);printRect(.038,.0015,-.032,.015,PAL.kawara);printRect(.019,.0015,.042,.015,PAL.kawara);
  // Front-page headline and a simple town photograph, all original geometric marks.
  printRect(.092,.0035,-.005,.009);printRect(.061,.002,-.020,.003);
  printRect(.047,.026,-.027,-.015,PAL.concrete2);
  for(const [x,h]of[[-.043,.013],[-.027,.018],[-.013,.010]]){printRect(.011,h,x,-.026+h/2,PAL.kawara,false,1);for(const dy of [0,.005])printRect(.003,.002,x,-.022+dy,PAL.cream2,false,2);}
  printRect(.047,.0012,-.027,-.031,PAL.kawara);
  for(let col=0;col<2;col++)for(let row=0;row<9;row++)printRect(.020-(row%3)*.002,.0009,.012+col*.025,-.005-row*.0034,PAL.kawara);
  printRect(.099,.001,0,-.038,PAL.kawara);
  finish('Front_Page_Print');
  printRect(.100,.003,0,.031,PAL.kawara2,true);printRect(.100,.001,0,.026,PAL.kawara,true);
  for(let col=0;col<3;col++)for(let row=0;row<17;row++)printRect(.027-(row%4)*.002,.0009,(col-1)*.035,.020-row*.0032,PAL.kawara,true);
  finish('Back_Page_Print');return root;
}
