// Original standalone Japanese town landmarks. Y-up, +Z entrance, ground at Y=0.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';

export const LANDMARK_KINDS = ['torii', 'shrine', 'temple', 'koban', 'bathhouse'];
export function createLandmark(kind) {
  if (!LANDMARK_KINDS.includes(kind)) throw new Error(`Unknown landmark: ${kind}`);
  const root=new THREE.Group();root.name=`Komachi_${kind}`;root.userData.front='+Z';
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,flatShading:true});
  let parts=[];
  function add(g,tint){const geo=g.index?g.toNonIndexed():g;if(geo!==g)g.dispose();geo.deleteAttribute('uv');const c=new THREE.Color(tint),a=new Float32Array(geo.attributes.position.count*3);for(let i=0;i<a.length;i+=3)c.toArray(a,i);geo.setAttribute('color',new THREE.BufferAttribute(a,3));parts.push(geo);}
  function box(w,h,d,x,y,z,c=PAL.wood2,rz=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateZ(rz);g.translate(x,y,z);add(g,c);}
  function rod(a,b,r,c=PAL.wood2,end=r,segments=8){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),delta=q.clone().sub(p),g=new THREE.CylinderGeometry(end,r,delta.length(),segments);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());add(g,c);}
  function finish(name){if(!parts.length)return;const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());parts=[];const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);}
  function extrude(points,depth,z,tint){const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});g.translate(0,0,z-depth/2);add(g,tint);}
  function roof(w,d,y,h,z=0,tint=PAL.kawara){
    const top=[[-w/2,y+.085],[-w*.36,y+.10],[0,y+h],[w*.36,y+.10],[w/2,y+.085]];
    extrude([...top,...top.toReversed().map(([x,yy])=>[x,yy-.045])],d,z,tint);
    // Front and rear triangular timber gables beneath the roof.
    for(const s of [-1,1])extrude([[-w*.36,y+.055],[0,y+h-.047],[w*.36,y+.055]],.026,z+s*(d/2-.07),PAL.cream);
    for(let zz=z-d/2;zz<=z+d/2+.001;zz+=.105)for(let i=0;i<4;i++)rod([top[i][0],top[i][1]+.003,zz],[top[i+1][0],top[i+1][1]+.003,zz],.007,PAL.kawara2);
    box(.065,.055,d+.07,0,y+h+.018,z,PAL.kawara2);
    for(const s of [-1,1])box(w+.025,.032,.035,0,y+.057,z+s*d/2,PAL.wood2);
  }
  function steps(width,z,top=.16){for(let i=0;i<3;i++){const h=top*(i+1)/3;box(width,h,.115,0,h/2,z-i*.105,PAL.concrete2);}}
  function window(x,y,z,w=.24,h=.28){box(w+.025,h+.025,.027,x,y,z,PAL.wood2);box(w,h,.012,x,y,z+.019,PAL.sky2);for(let i=-1;i<=1;i++)box(.012,h,.018,x+i*w/3,y,z+.029,PAL.cream2);box(w,.012,.018,x,y,z+.03,PAL.cream2);}
  function sideWindow(x,y,z,w=.24,h=.28){const start=parts.length;window(0,y,0,w,h);for(let i=start;i<parts.length;i++){parts[i].rotateY(x<0?-Math.PI/2:Math.PI/2);parts[i].translate(x,0,z);}}
  function doors(w,y,z){box(w,.43,.035,0,y,z,PAL.wood2);for(const s of [-1,1]){box(w/2-.023,.38,.013,s*w/4,y,z+.024,PAL.cream);for(let j=0;j<4;j++)box(.009,.38,.015,s*w/4+(j-1.5)*w/10,y,z+.035,PAL.wood2);for(const yy of [-.09,.06])box(w/2-.02,.01,.016,s*w/4,y+yy,z+.037,PAL.wood2);}}
  function torii(x,y,z,scale=1){
    for(const s of [-1,1]){box(.16*scale,.07*scale,.16*scale,x+s*.43*scale,y+.035*scale,z,PAL.concrete2);rod([x+s*.43*scale,y+.06*scale,z],[x+s*.395*scale,y+.98*scale,z],.038*scale,PAL.roofRose,.032*scale);rod([x+s*.43*scale,y+.065*scale,z],[x+s*.425*scale,y+.17*scale,z],.044*scale,PAL.kawara2);}
    box(1.05*scale,.06*scale,.06*scale,x,y+.77*scale,z,PAL.roofRose);box(.04*scale,.20*scale,.065*scale,x,y+.85*scale,z,PAL.roofRose);
    for(const s of [-1,1]){rod([x,y+.98*scale,z],[x+s*.55*scale,y+1.005*scale,z],.047*scale,PAL.roofRose,.04*scale,6);rod([x,y+1.025*scale,z],[x+s*.60*scale,y+1.07*scale,z],.027*scale,PAL.kawara2,.025*scale,6);}
    box(.105*scale,.15*scale,.025*scale,x,y+.90*scale,z+.052*scale,PAL.wood2);box(.075*scale,.11*scale,.012*scale,x,y+.90*scale,z+.072*scale,PAL.cream);
  }
  function lantern(x,z){box(.17,.04,.17,x,.02,z,PAL.concrete2);box(.075,.22,.075,x,.15,z,PAL.concrete);box(.14,.025,.14,x,.27,z,PAL.concrete2);box(.11,.12,.11,x,.34,z,PAL.concrete);box(.06,.075,.005,x,.34,z+.057,PAL.lampGlow);const g=new THREE.ConeGeometry(.115,.085,4);g.rotateY(Math.PI/4);g.translate(x,.442,z);add(g,PAL.kawara);}
  if(kind==='torii'){torii(0,0,0);finish('Torii_Gate');root.userData.entrance=[0,0,.12];return root;}
  if(kind==='shrine'){
    box(1.5,.04,1.75,0,.02,.17,PAL.dirt);box(.48,.009,1.38,0,.045,.42,PAL.concrete);
    box(.95,.12,.78,0,.10,-.21,PAL.concrete2);box(1.02,.06,.86,0,.19,-.21,PAL.wood);
    box(.75,.55,.58,0,.48,-.29,PAL.cream);for(const x of [-.36,.36])for(const z of [-.55,-.025])box(.055,.59,.055,x,.49,z,PAL.roofRose);
    doors(.42,.45,.011);box(.78,.045,.64,0,.72,-.29,PAL.roofRose);steps(.45,.42,.16);
    for(const x of [-.378,.378]){box(.025,.035,.55,x,.37,-.29,PAL.roofRose);box(.025,.035,.55,x,.64,-.29,PAL.roofRose);for(let j=0;j<5;j++)box(.028,.24,.017,x,.51,-.49+j*.10,PAL.wood2);}
    roof(1.18,.99,.75,.28,-.26);finish('Shrine_Hall');
    // Offering box, bell and sacred rope under the front eave.
    box(.28,.15,.14,0,.30,.16,PAL.wood2);for(let i=0;i<6;i++)box(.021,.012,.145,(i-2.5)*.044,.38,.16,PAL.wood);
    rod([-.31,.72,.22],[0,.69,.22],.01,PAL.raw);rod([0,.69,.22],[.31,.72,.22],.01,PAL.raw);
    for(const x of [-.22,-.1,.1,.22]){box(.028,.047,.009,x,.655,.23,PAL.cream2,.3);box(.028,.04,.009,x+.01,.62,.231,PAL.cream2,-.3);}
    const bell=new THREE.SphereGeometry(.035,8,6);bell.translate(0,.645,.24);add(bell,PAL.lamp);rod([0,.62,.24],[0,.405,.24],.009,PAL.raw);
    lantern(-.59,.49);lantern(.59,.49);finish('Shrine_Offerings_And_Lanterns');torii(0,.045,.89,.83);finish('Shrine_Torii');root.userData.entrance=[0,.05,1.02];
  }else if(kind==='temple'){
    box(1.65,.06,1.39,0,.03,0,PAL.concrete2);box(1.39,.15,1.05,0,.125,-.08,PAL.wood2);box(1.46,.04,1.12,0,.22,-.08,PAL.wood);
    box(1.12,.60,.82,0,.54,-.16,PAL.cream);for(const x of [-.55,-.28,.28,.55])box(.055,.67,.055,x,.555,.285,PAL.wood2);
    doors(.53,.51,.28);for(const x of [-.41,.41])window(x,.52,.29,.19,.32);
    for(const x of [-.563,.563]){sideWindow(x,.54,-.17,.43,.28);box(.045,.60,.047,x,.54,-.54);}
    for(const x of [-.66,.66]){box(.035,.22,.84,x,.35,-.055);box(.04,.026,.92,x,.46,-.055);for(let j=0;j<6;j++)box(.022,.17,.022,x,.34,-.42+j*.15);}
    steps(.65,.71,.20);roof(1.76,1.38,.83,.36,-.08);finish('Temple_Hall');
    // Broad entrance canopy on two posts, paired hanging lanterns and gold crest.
    for(const x of [-.32,.32])box(.042,.69,.042,x,.56,.50);
    roof(.83,.53,.72,.19,.49);for(const x of [-.53,.53]){rod([x,.89,.48],[x,.70,.48],.007);const g=new THREE.CylinderGeometry(.046,.046,.105,8);g.translate(x,.64,.48);add(g,PAL.cream2);box(.07,.009,.07,x,.698,.48,PAL.kawara2);}
    const crest=new THREE.CylinderGeometry(.047,.047,.015,8);crest.rotateX(Math.PI/2);crest.translate(0,1.04,.622);add(crest,PAL.wood);
    finish('Temple_Entrance');root.userData.entrance=[0,0,.79];
  }else if(kind==='koban'){
    box(1.11,.065,.98,0,.0325,0,PAL.concrete2);box(.93,.67,.75,0,.40,-.055,PAL.cream2);box(.96,.17,.78,0,.15,-.055,PAL.blueWall);
    box(1.08,.07,.94,0,.77,-.06,PAL.indigo);box(.35,.41,.026,-.24,.345,.334,PAL.indigo);box(.29,.32,.013,-.24,.38,.355,PAL.sky2);box(.026,.027,.025,-.125,.30,.37,PAL.lamp);
    window(.225,.41,.34,.32,.34);box(.83,.11,.04,0,.668,.351,PAL.indigo);
    sideWindow(.468,.43,-.09,.27,.24);
    // Pixel lettering is geometry and survives GLB export.
    const chars={K:['101','110','100','110','101'],O:['111','101','101','101','111'],B:['110','101','110','101','110'],A:['010','101','111','101','101'],N:['101','111','111','111','101']};
    for(const [i,ch]of[...'KOBAN'].entries())for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(chars[ch][row][col]==='1')box(.015,.012,.005,-.15+(i*4+col)*.016,.694-row*.014,.375,PAL.cream2);
    box(.10,.015,.10,0,.812,-.055,PAL.concrete2);const beacon=new THREE.SphereGeometry(.04,10,6,0,Math.PI*2,0,Math.PI/2);beacon.translate(0,.82,-.055);add(beacon,PAL.roofRose);
    rod([.32,.80,-.31],[.32,1.02,-.31],.007,PAL.kawara2);
    // Street map board and a pair of bollards.
    box(.19,.27,.035,.64,.29,.11,PAL.indigo);box(.16,.22,.006,.64,.29,.131,PAL.cream);for(let i=0;i<3;i++)box(.12,.008,.005,.64,.23+i*.05,.136,PAL.roofBlue);rod([.64,0,.11],[.64,.17,.11],.014,PAL.kawara2);
    for(const x of [-.46,.46])rod([x,.065,.43],[x,.21,.43],.018,PAL.concrete);
    finish('Koban');root.userData.entrance=[-.24,.065,.44];
  }else{
    box(1.7,.065,1.4,0,.0325,0,PAL.concrete2);box(1.48,.68,1.15,0,.40,-.02,PAL.cream);box(1.51,.17,1.18,0,.15,-.02,PAL.tealWall);
    roof(1.81,1.42,.76,.26,-.04);doors(.58,.35,.568);for(const x of [-.51,.51])window(x,.43,.574,.24,.27);
    sideWindow(-.743,.49,-.07,.48,.19);sideWindow(.743,.49,.20,.28,.19);
    for(const x of [-.37,.37])box(.042,.60,.042,x,.35,.79);roof(.92,.48,.59,.19,.71);finish('Bathhouse_Building');
    // Noren with a simple three-column hot-spring steam emblem, no tiny lettering.
    rod([-.32,.60,.83],[.32,.60,.83],.013);for(let i=0;i<3;i++)box(.202,.21,.012,(i-1)*.21,.49,.846,i===0?PAL.roofRose:PAL.indigo);
    const arc=new THREE.TorusGeometry(.057,.006,4,12,Math.PI);arc.rotateZ(Math.PI);arc.scale(1,.45,1);arc.translate(.105,.445,.855);add(arc,PAL.cream2);
    for(let i=0;i<3;i++){const x=.065+i*.04;rod([x,.465,.858],[x-.009,.49,.858],.004,PAL.cream2);rod([x-.009,.49,.858],[x,.515,.858],.004,PAL.cream2);}
    // Boiler annex and tall masonry chimney with a dark open flue.
    box(.38,.46,.51,.68,.29,-.40,PAL.concrete);box(.43,.045,.56,.68,.54,-.40,PAL.kawara);
    rod([.68,.54,-.40],[.68,1.70,-.40],.083,PAL.peachWall,.068,12);
    for(let i=0;i<9;i++){const y=.64+i*.12;const g=new THREE.TorusGeometry(.083-(y-.54)/1.16*.015,.0035,4,12);g.rotateX(Math.PI/2);g.translate(.68,y,-.40);add(g,PAL.concrete2);}
    const rim=new THREE.TorusGeometry(.072,.011,6,12);rim.rotateX(Math.PI/2);rim.translate(.68,1.705,-.40);add(rim,PAL.kawara2);
    const opening=new THREE.CircleGeometry(.061,12);opening.rotateX(-Math.PI/2);opening.translate(.68,1.692,-.40);add(opening,PAL.kawara2);
    box(.26,.038,.10,-.56,.16,.78,PAL.wood);for(const x of [-.65,-.47])box(.025,.1,.07,x,.095,.78,PAL.wood2);
    finish('Bathhouse_Curtain_And_Chimney');root.userData.entrance=[0,.065,.9];
  }
  return root;
}
