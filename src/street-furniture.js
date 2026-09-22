// Original standalone street furniture. Game units, Y-up, front +Z, ground Y=0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export const STREET_KINDS=['vending-machine','bench','bus-stop','traffic-light','street-signs','planter','bike-rack'];
function buildPieces(kind, color) {
  if(!STREET_KINDS.includes(kind))throw new Error(`Unknown street furniture: ${kind}`);
  const root=new THREE.Group();root.name=`Komachi_${kind.replaceAll('-','_')}`;root.userData.front='+Z';
  let parts=[];const pieces=[];
  function add(g,tint){const geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();geo.deleteAttribute('uv');const c=new THREE.Color(tint),a=new Float32Array(geo.attributes.position.count*3);for(let i=0;i<a.length;i+=3)c.toArray(a,i);geo.setAttribute('color',new THREE.BufferAttribute(a,3));parts.push(geo);}
  function box(w,h,d,x,y,z,tint=PAL.concrete2,rx=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateX(rx);g.translate(x,y,z);add(g,tint);}
  function rod(a,b,r,tint=PAL.kawara2,end=r){const start=new THREE.Vector3(...a),finish=new THREE.Vector3(...b),d=finish.clone().sub(start),g=new THREE.CylinderGeometry(end,r,d.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(...start.add(finish).multiplyScalar(.5).toArray());add(g,tint);}
  function disk(r,x,y,z,tint,segments=12){const g=new THREE.CircleGeometry(r,segments);g.translate(x,y,z);add(g,tint);}
  function finish(name){if(!parts.length)return;const geo=mergeGeometries(parts);parts.forEach(g=>g.dispose());parts=[];pieces.push({name,geo});}
  function bench(x=0,y=0,z=0,width=.46){
    for(const xx of [-width*.34,width*.34]){
      for(const zz of [-.057,.057])box(.025,.085,.026,x+xx,y+.0425,z+zz,PAL.kawara2);
      box(.027,.035,.17,x+xx,y+.09,z,PAL.kawara2);box(.023,.14,.024,x+xx,y+.155,z-.069,PAL.kawara2);
    }
    for(let i=0;i<4;i++)box(width,.022,.033,x,y+.103,z-.059+i*.039,PAL.wood);
    for(let i=0;i<3;i++)box(width,.029,.022,x,y+.15+i*.034,z-.075,PAL.wood);
    for(const xx of [-width/2+.012,width/2-.012]){rod([x+xx,y+.11,z+.052],[x+xx,y+.172,z+.052],.007);rod([x+xx,y+.172,z+.052],[x+xx,y+.172,z-.06],.007);}
  }
  function arch(x,z,width,height){
    rod([x-width/2,0,z],[x-width/2,height-.035,z],.009);
    rod([x+width/2,0,z],[x+width/2,height-.035,z],.009);
    const g=new THREE.TorusGeometry(width/2,.009,6,12,Math.PI);g.translate(x,height-.035,z);add(g,PAL.kawara2);
  }
  if(kind==='vending-machine'){
    box(.235,.025,.16,0,.0125,0,PAL.kawara2);box(.26,.385,.18,0,.22,0,color||PAL.roofRose);
    box(.226,.26,.012,0,.263,.096,PAL.cream2);box(.18,.18,.008,-.015,.282,.105,PAL.kawara2);
    // Visible stock, selection buttons, payment slot and lower pickup recess.
    for(let row=0;row<3;row++)for(let col=0;col<4;col++){
      const x=-.079+col*.043,y=.225+row*.056;
      rod([x,y-.012,.118],[x,y+.012,.118],.009,[PAL.roofTeal,PAL.roofPeach,PAL.cream,PAL.roofBlue][col]);
      rod([x,y+.012,.118],[x,y+.014,.118],.0095,PAL.concrete2);
      box(.027,.004,.018,x,y-.017,.117,PAL.concrete);
      box(.014,.006,.006,x,y-.025,.114,PAL.lampGlow);
    }
    box(.035,.065,.012,.091,.195,.114,PAL.kawara);box(.022,.004,.007,.091,.209,.124,PAL.kawara2);box(.013,.013,.006,.091,.182,.124,PAL.cream);
    box(.18,.049,.014,-.011,.078,.101,PAL.kawara2);box(.16,.008,.035,-.011,.057,.112,PAL.concrete2);
    box(.15,.021,.008,-.022,.386,.103,PAL.cream);box(.07,.005,.01,-.022,.386,.109,PAL.roofTeal);
    for(let i=0;i<5;i++)box(.055,.005,.006,.075,.046+i*.009,-.092,PAL.kawara2);
    finish('Vending_Machine');root.userData.interactionPoint=[.09,.20,.14];root.userData.pickupPoint=[-.01,.075,.13];
  }else if(kind==='bench'){
    bench();finish('Bench');root.userData.seats=[[-.115,.114,0],[.115,.114,0]];
  }else if(kind==='bus-stop'){
    box(.92,.025,.46,0,.0125,0,PAL.concrete);
    for(const x of [-.40,.40])for(const z of [-.16,.15])rod([x,.025,z],[x,.55,z],.012,PAL.kawara2);
    box(.98,.043,.53,0,.573,-.005,color||PAL.roofTeal);
    // Opaque frosted panel strips avoid transparent sorting and remain portable.
    box(.77,.22,.012,0,.26,-.163,PAL.blueWall);box(.78,.018,.017,0,.385,-.164,PAL.kawara2);
    bench(-.12,.025,-.045,.46);
    box(.145,.19,.019,.283,.38,-.14,PAL.cream2);
    box(.112,.03,.005,.283,.445,-.126,PAL.roofTeal);
    for(let i=0;i<5;i++){box(.095,.006,.005,.283,.408-i*.022,-.126,PAL.kawara);disk(.004,.239,.408-i*.022,-.122,PAL.roofRose,6);}
    rod([-.50,0,.16],[-.50,.56,.16],.009,PAL.kawara2);disk(.061,-.50,.568,.167,PAL.cream2);
    box(.064,.036,.006,-.50,.57,.173,PAL.indigo);box(.049,.018,.006,-.50,.577,.18,PAL.sky2);disk(.005,-.52,.546,.182,PAL.kawara2);disk(.005,-.48,.546,.182,PAL.kawara2);
    finish('Bus_Shelter');root.userData.seats=[[-.23,.139,-.045],[0,.139,-.045]];root.userData.waitPoint=[.27,.025,.18];
  }else if(kind==='traffic-light'){
    box(.09,.025,.09,0,.0125,0,PAL.concrete2);rod([0,.025,0],[0,.74,0],.013);
    rod([0,.72,0],[.29,.72,0],.012);box(.262,.086,.068,.265,.718,0,PAL.kawara2);
    for(const [i,name]of ['Green_Lens','Amber_Lens','Red_Lens'].entries()){
      const x=.178+i*.086;box(.071,.008,.068,x,.765,.045,PAL.kawara2);finish(i===0?'Signal_Post':'Signal_Visor_'+i);
      disk(.025,x,.718,.035,[PAL.roofTeal,PAL.lampGlow,PAL.roofRose][i]);finish(name);
    }
    box(.068,.104,.055,0,.47,.008,PAL.kawara2);
    // Simple standing/crossing pedestrian indicators on the secondary box.
    for(const [y,tint]of [[.495,PAL.roofRose],[.446,PAL.treeGreen]]){disk(.005,0,y+.014,.038,tint,8);box(.008,.019,.004,0,y,.039,tint);box(.024,.005,.004,0,y+.003,.039,tint);for(const x of [-.005,.005])box(.004,.011,.004,x,y-.013,.039,tint);}
    finish('Pedestrian_Signal');root.userData.lenses=['Green_Lens','Amber_Lens','Red_Lens'];
  }else if(kind==='street-signs'){
    box(.105,.019,.105,0,.0095,0,PAL.concrete2);rod([0,.019,0],[0,.57,0],.009);
    // Direction boards and an inverted triangular stop-style sign, modelled both front and back.
    box(.23,.062,.023,.045,.52,0,color||PAL.indigo);box(.19,.054,.023,-.025,.438,0,PAL.roofTeal);
    for(const [y,s]of [[.52,1],[.438,-1]]){
      const centre=s===1?.045:-.025;box(.075,.008,.004,centre,y,.014,PAL.cream2);
      const vertices=[centre+s*.062,y,.015,centre+s*.027,y+.016,.015,centre+s*.027,y-.016,.015];
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...vertices,...vertices.slice(6),...vertices.slice(3,6),...vertices.slice(0,3)],3));g.computeVertexNormals();add(g,PAL.cream2);
    }
    const triangle=new THREE.CylinderGeometry(.070,.070,.018,3);triangle.rotateX(Math.PI/2);triangle.translate(0,.31,0);add(triangle,PAL.cream2);
    const face=new THREE.CircleGeometry(.058,3);face.rotateZ(-Math.PI/2);face.translate(0,.31,.010);add(face,PAL.roofRose);
    box(.04,.006,.004,0,.319,.013,PAL.cream2);finish('Street_Signs');
  }else if(kind==='planter'){
    box(.36,.02,.21,0,.01,0,PAL.concrete2);
    box(.32,.015,.17,0,.047,0,PAL.wood2);
    for(const x of [-.17,.17])box(.02,.10,.21,x,.068,0,color||PAL.cream);
    for(const z of [-.095,.095])box(.34,.10,.02,0,.068,z,color||PAL.cream);
    for(const x of [-.174,.174])box(.03,.016,.23,x,.119,0,PAL.concrete2);for(const z of [-.103,.103])box(.32,.016,.03,0,.119,z,PAL.concrete2);
    for(let i=0;i<5;i++){
      const x=(i-2)*.059;rod([x,.055,0],[x,.18+(i%2)*.025,0],.003,PAL.roofSage);
      for(const s of [-1,1]){const leaf=new THREE.SphereGeometry(1,6,3);leaf.scale(.030,.008,.015);leaf.rotateZ(s*.55);leaf.translate(x+s*.019,.143,s*.025);add(leaf,PAL.treeGreen);}
      for(let p=0;p<5;p++){const a=p*Math.PI*2/5,g=new THREE.SphereGeometry(.012,5,3);g.scale(1,.6,1);g.translate(x+Math.cos(a)*.016,.186+(i%2)*.025,Math.sin(a)*.016);add(g,i%2?PAL.flower:PAL.cream2);}
      const heart=new THREE.SphereGeometry(.008,6,3);heart.translate(x,.19+(i%2)*.025,0);add(heart,PAL.lampGlow);
    }
    finish('Flower_Planter');
  }else{
    // Three inverted-U hoops. A bike can lean against either side of each hoop.
    for(let i=0;i<3;i++){const start=parts.length;arch(0,0,.15,.19);for(let j=start;j<parts.length;j++){parts[j].rotateY(Math.PI/2);parts[j].translate((i-1)*.19,0,0);}for(const z of [-.075,.075])box(.049,.013,.046,(i-1)*.19,.0065,z,PAL.concrete2);}
    box(.44,.012,.018,0,.015,-.075,PAL.kawara2);finish('Bike_Rack');root.userData.bays=[[-.19,0,0],[0,0,0],[.19,0,0]];
  }
  return {root,pieces};
}
export function createStreetFurniture(kind, color) {
  const {root,pieces}=buildPieces(kind,color),mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88});
  for(const p of pieces){const mesh=new THREE.Mesh(p.geo,mat);mesh.name=p.name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
  return root;
}
/** The town's merger needs position/normal/uv/color on every part: named pieces, placed, with an empty uv. */
export function furnitureGeometry(kind, color, {x=0,y=0,z=0,rot=0,scale=1}={}) {
  const {pieces}=buildPieces(kind,color),out={};
  for(const p of pieces){const g=p.geo;g.scale(scale,scale,scale);g.rotateY(rot);g.translate(x,y,z);if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));out[p.name]=g;}
  return out;
}
export function addFurniture(out, kind, x, y, z, rot=0, color) { const parts=furnitureGeometry(kind,color,{x,y,z,rot}); for(const k in parts) out.push(parts[k]); }
