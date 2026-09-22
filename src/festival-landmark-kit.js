// Standalone Komachi models. Game units, Y-up, +Z front. No game registration.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL as P } from './palette.js';
export const FESTIVAL_KINDS=['yatai-food','yatai-games','yatai-sweets','lantern-string','taiko','bunting','festival-banner','mikoshi'];
export const DESTINATION_KINDS=['lighthouse','arched-bridge','park-pavilion','tourist-bus'];

export function createFestivalLandmark(kind){
  if(![...FESTIVAL_KINDS,...DESTINATION_KINDS].includes(kind))throw Error(`Unknown model ${kind}`);
  const root=new THREE.Group();root.name=`Komachi_${kind.replaceAll('-','_')}`;root.userData={front:'+Z',units:'game',standalone:true};
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.95,flatShading:true});let parts=[];
  function add(input,c){const g=input.index?input.toNonIndexed():input;if(g!==input)input.dispose();g.deleteAttribute('uv');const color=new THREE.Color(c),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3)color.toArray(a,i);g.setAttribute('color',new THREE.BufferAttribute(a,3));parts.push(g);}
  function box(w,h,d,x,y,z,c=P.wood2,rx=0,ry=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateX(rx);g.rotateY(ry);g.translate(x,y,z);add(g,c);}
  function rod(a,b,r,c=P.wood2,r2=r,n=8){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p),g=new THREE.CylinderGeometry(r2,r,v.length(),n);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());add(g,c);}
  function sphere(r,x,y,z,c,scale=[1,1,1]){const g=new THREE.SphereGeometry(r,10,6);g.scale(...scale);g.translate(x,y,z);add(g,c);}
  function finish(name,pivot=[0,0,0],material=mat){if(!parts.length)return;const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());parts=[];g.translate(-pivot[0],-pivot[1],-pivot[2]);const mesh=new THREE.Mesh(g,material);mesh.name=name;mesh.position.fromArray(pivot);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;}
  function panel(points,depth,c){const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false});add(g,c);}
  function ring(r,t,x,y,z,c,ry=0){const g=new THREE.TorusGeometry(r,t,5,16);g.rotateY(ry);g.translate(x,y,z);add(g,c);}
  function roof(w,d,y,h,c=P.kawara){const angle=Math.atan2(h,d/2);for(const s of [-1,1]){box(w,.035,Math.hypot(h,d/2),0,y+h/2,s*d/4,c,s*angle);box(w,.026,.026,0,y-.008,s*d/2,P.kawara2);}box(w+.025,.034,.052,0,y+h+.009,0,P.kawara2);}
  function lantern(x,y,z,c=P.roofRose){sphere(.047,x,y,z,c,[1,1.3,1]);for(const dy of [-.058,.058])rod([x,y+dy-.005,z],[x,y+dy+.005,z],.023,P.kawara2);for(const yy of [-.034,0,.034]){const g=new THREE.TorusGeometry(yy===0?.046:.037,.002,4,10);g.rotateX(Math.PI/2);g.translate(x,y+yy,z);add(g,P.raw);}}
  function basePole(x,z,h){box(.09,.025,.09,x,.0125,z,P.concrete2);rod([x,.025,z],[x,h,z],.011);}
  function pennant(x,y,z,c){const start=parts.length;panel([[x-.053,y],[x+.053,y],[x,y-.13]],.004,c);for(let i=start;i<parts.length;i++)parts[i].translate(0,0,z);}
  function festivalMark(x,y,z,size,c=P.cream2){ // Bold geometric matsuri crest, not text.
    ring(size*.30,size*.035,x,y,z,c);rod([x-size*.20,y,z],[x+size*.20,y,z],size*.025,c);rod([x,y-size*.20,z],[x,y+size*.20,z],size*.025,c);
  }
  if(kind.startsWith('yatai')){
    const color=kind==='yatai-food'?P.roofRose:kind==='yatai-games'?P.indigo:P.roofTeal;
    box(.67,.045,.48,0,.0225,0,P.wood2);
    for(const x of [-.29,.29])for(const z of [-.19,.19])box(.028,.64,.028,x,.365,z);
    box(.64,.24,.055,0,.19,.19,P.wood);for(let x=-.28;x<.3;x+=.07)box(.006,.21,.005,x,.19,.22,P.wood2);
    box(.71,.027,.24,0,.325,.145,P.raw);
    box(.61,.023,.18,0,.30,-.12,P.wood);
    for(const x of [-.30,.30])box(.02,.20,.39,x,.17,0,P.wood);
    roof(.83,.67,.70,.16,color);
    for(let i=0;i<5;i++)box(.139,.112,.012,(i-2)*.149,.637,.322,color);
    festivalMark(0,.637,.332,.11);
    lantern(-.335,.61,.26,P.cream2);lantern(.335,.61,.26,color);
    if(kind==='yatai-food'){
      box(.34,.024,.16,-.08,.355,.13,P.kawara2);
      for(let i=0;i<5;i++){const x=-.215+i*.06;rod([x,.373,.047],[x,.373,.225],.003,P.raw, .003,5);for(const z of [.085,.12,.155])sphere(.014,x,.383,z,P.wood);}
      rod([.24,.34,.12],[.24,.40,.12],.042,P.concrete2);rod([.24,.40,.12],[.24,.405,.12],.044,P.kawara2);
      for(const x of [-.21,-.06,.09]){box(.07,.09,.07,x,.356,-.12,P.cream2);box(.06,.018,.06,x,.41,-.12,color);}
    }else if(kind==='yatai-games'){
      box(.37,.02,.17,-.10,.35,.14,P.roofBlue);box(.34,.006,.14,-.1,.363,.14,P.sky2);
      for(let i=0;i<6;i++)sphere(.015,-.23+(i%3)*.09,.38,.095+Math.floor(i/3)*.073,[P.roofRose,P.lampGlow,P.mint][i%3]);
      ring(.035,.003,.22,.385,.19,P.raw);rod([.22,.35,.19],[.22,.385,.19],.003,P.wood);
      for(const x of [-.2,0,.2]){sphere(.039,x,.39,-.12,P.pink);sphere(.015,x-.025,.425,-.12,P.pink);sphere(.015,x+.025,.425,-.12,P.pink);}
    }else{
      for(let i=0;i<4;i++){const x=-.24+i*.12;rod([x,.34,.13],[x,.455,.13],.003,P.raw);sphere(.037,x,.467,.13,[P.pink,P.mint,P.lilac,P.cream2][i],[1,1.2,1]);}
      box(.43,.024,.19,0,.322,-.11,P.raw);for(let i=0;i<5;i++)rod([-.18+i*.085,.34,-.11],[-.18+i*.085,.42,-.11],.024,[P.roofRose,P.roofTeal,P.roofPlum][i%3]);
    }
    finish('Yatai_Frame_Canopy_And_Stock');root.userData={...root.userData,vendorPoint:[0,0,-.12],customerPoint:[0,0,.43]};
  }else if(kind==='lantern-string'||kind==='bunting'){
    const h=kind==='lantern-string'?1.0:.84;for(const x of [-.9,.9])basePole(x,0,h);
    function sag(x){return h-.12*(1-(x/.9)**2);}
    for(let i=0;i<16;i++){const x=-.9+i*1.8/16,xx=x+1.8/16;rod([x,sag(x),0],[xx,sag(xx),0],.003,P.kawara2,.003,5);}
    finish('Poles_And_Cable');
    for(let i=0;i<9;i++){const x=-.8+i*.2;if(kind==='lantern-string'){rod([x,sag(x),0],[x,sag(x)-.027,0],.002,P.kawara2);lantern(x,sag(x)-.089,0,i%2?P.cream2:P.roofRose);}else pennant(x,sag(x)-.005,0,[P.roofRose,P.cream2,P.roofTeal,P.lampGlow][i%4]);}
    finish(kind==='lantern-string'?'Lanterns':'Pennants');root.userData.cableEnds=[[-.9,h,0],[.9,h,0]];
  }else if(kind==='festival-banner'){
    basePole(-.11,0,.94);rod([-.13,.89,0],[.18,.89,0],.006);
    box(.235,.62,.007,.015,.565,0,P.indigo);box(.235,.036,.011,.015,.274,0,P.roofRose);
    festivalMark(.015,.68,.008,.20);festivalMark(.015,.68,-.008,.20);
    for(const y of [.47,.41,.35]){box(.11,.009,.008,.015,y,.008,P.cream2);box(.11,.009,.008,.015,y,-.008,P.cream2);}
    finish('Festival_Nobori');
  }else if(kind==='taiko'){
    for(const z of [-.13,.13]){for(const x of [-.17,.17])box(.055,.025,.055,x,.0125,z);rod([-.17,.027,z],[.12,.30,z],.023);rod([.17,.027,z],[-.12,.30,z],.023);}
    for(const x of [-.13,.13])rod([x,.15,-.13],[x,.15,.13],.015);
    const g=new THREE.LatheGeometry([new THREE.Vector2(.125,-.14),new THREE.Vector2(.155,-.085),new THREE.Vector2(.165,0),new THREE.Vector2(.155,.085),new THREE.Vector2(.125,.14)],16);g.rotateX(Math.PI/2);g.translate(0,.34,0);add(g,P.wood);
    for(const s of [-1,1]){rod([0,.34,s*.142],[0,.34,s*.153],.128,P.cream2,.128,16);ring(.132,.008,0,.34,s*.154,P.wood2);for(let i=0;i<16;i++){const a=i*Math.PI/8;sphere(.004,Math.cos(a)*.116,.34+Math.sin(a)*.116,s*.161,P.kawara2);}}
    rod([-.12,.50,.035],[.10,.50,.10],.006,P.raw);rod([.12,.51,.035],[-.10,.51,.10],.006,P.raw);
    finish('Taiko_Drum_And_Stand');root.userData.playerPoint=[0,0,.34];
  }else if(kind==='mikoshi'){
    for(const x of [-.2,.2])box(.038,.036,1.03,x,.14,0,P.wood2);
    for(const x of [-.22,.22])for(const z of [-.22,.22])box(.026,.10,.026,x,.05,z,P.wood2);
    box(.53,.055,.53,0,.128,0,P.roofRose);box(.43,.035,.43,0,.173,0,P.wood);
    box(.29,.27,.29,0,.32,0,P.roofRose);
    for(const x of [-.155,.155])for(const z of [-.155,.155])box(.027,.30,.027,x,.325,z,P.lampGlow);
    for(const s of [-1,1]){box(.16,.17,.01,0,.32,s*.15,P.indigo);for(const x of [-.055,0,.055])box(.01,.17,.012,x,.32,s*.16,P.lampGlow);}
    // Four-sided golden hip roof with raised ridge ornament.
    const g=new THREE.ConeGeometry(.40,.19,4);g.rotateY(Math.PI/4);g.translate(0,.542,0);add(g,P.wood);
    box(.60,.025,.60,0,.455,0,P.lampGlow);rod([0,.625,0],[0,.72,0],.018,P.lampGlow);
    sphere(.037,0,.73,0,P.lampGlow);rod([0,.735,0],[-.105,.77,0],.013,P.lampGlow,.005);rod([0,.735,0],[.105,.77,0],.013,P.lampGlow,.005);
    for(const x of [-.255,.255])for(const z of [-.255,.255]){rod([x,.46,z],[x,.36,z],.004,P.raw);sphere(.016,x,.345,z,P.lampGlow);}
    finish('Mikoshi_Shrine_And_Carry_Poles');root.userData.carryPoints=[[-.2,.14,-.4],[.2,.14,-.4],[-.2,.14,.4],[.2,.14,.4]];
  }else if(kind==='lighthouse'){
    rod([0,0,0],[0,.065,0],.35,P.concrete2,.35,12);
    rod([0,.065,0],[0,1.12,0],.245,P.cream2,.175,12);
    rod([0,.34,0],[0,.43,0],.228,P.roofTeal,.222,12);
    box(.12,.25,.024,0,.19,.248,P.indigo);box(.074,.11,.01,0,.24,.265,P.sky2);box(.015,.02,.016,.04,.15,.268,P.wood);
    for(const y of [.58,.87])box(.067,.105,.012,0,y,.222-(y-.34)*.067,P.sky2);
    rod([0,1.12,0],[0,1.165,0],.285,P.concrete2,.285,16);
    for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6;rod([Math.sin(a)*.263,1.17,Math.cos(a)*.263],[Math.sin(a)*.263,1.32,Math.cos(a)*.263],.005,P.cream2);rod([Math.sin(a)*.263,1.32,Math.cos(a)*.263],[Math.sin(b)*.263,1.32,Math.cos(b)*.263],.005,P.cream2);}
    rod([0,1.165,0],[0,1.40,0],.165,P.sky2,.165,8);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;rod([Math.sin(a)*.167,1.165,Math.cos(a)*.167],[Math.sin(a)*.167,1.405,Math.cos(a)*.167],.009,P.kawara2);}
    rod([0,1.40,0],[0,1.43,0],.195,P.kawara2,.195,8);rod([0,1.43,0],[0,1.58,0],.215,P.roofTeal,.02,8);
    rod([0,1.57,0],[0,1.70,0],.008,P.lamp);box(.22,.035,.13,0,.065,.305,P.concrete);
    finish('Lighthouse_Tower_And_Gallery');
    sphere(.043,0,1.28,.165,P.lampGlow);finish('Lighthouse_Lens');root.userData={...root.userData,entrance:[0,.065,.34],lightPoint:[0,1.28,0],viewPoint:[0,0,.55]};
  }else if(kind==='arched-bridge'){
    // Clear span along Z, no middle support or ground slab across the canal.
    const h=z=>.075+.23*(1-(z/.9)**2);
    for(let i=0;i<24;i++){const z=-.9+i*.075+.0375,angle=-Math.atan(-.46*z/.81);box(.68,.052,.078,0,h(z)-.026,z,P.wood,angle);}
    for(const s of [-1,1]){
      for(let i=0;i<12;i++){const z=-.9+i*.15,zz=z+.15;for(const dy of [-.015,.17,.28])rod([s*.36,h(z)+dy,z],[s*.36,h(zz)+dy,zz],dy<0?.024:.014,P.roofRose,.014,6);}
      for(let i=0;i<=6;i++){const z=-.9+i*.3;box(.035,.31,.035,s*.36,h(z)+.135,z,P.roofRose);sphere(.029,s*.36,h(z)+.305,z,P.wood);}
      for(const z of [-.90,.90])box(.14,.045,.18,s*.29,.0225,z,P.concrete2);
    }
    finish('Red_Arched_Bridge');root.userData={...root.userData,span:1.8,clearWidth:.68,path:Array.from({length:13},(_,i)=>{const z=-.9+i*.15;return [0,h(z),z];}),entrances:[[0,h(-.9),-.9],[0,h(.9),.9]]};
  }else if(kind==='park-pavilion'){
    box(1.12,.065,1.02,0,.0325,0,P.concrete);box(1.02,.035,.92,0,.0825,0,P.wood);
    for(const x of [-.42,.42])for(const z of [-.37,.37]){box(.049,.69,.049,x,.445,z,P.wood2);for(const dx of [-.12,.12])rod([x,.64,z],[x+dx,.79,z],.012);}
    for(const z of [-.38,.38])box(.95,.042,.05,0,.78,z,P.wood2);
    roof(1.27,1.13,.82,.25,P.roofSage);
    for(const x of [-.33,.33]){box(.15,.025,.63,x,.235,0,P.wood);for(const z of [-.23,.23])box(.028,.125,.035,x,.165,z,P.wood2);box(.022,.12,.64,x+Math.sign(x)*.065,.305,0,P.wood);}
    box(.47,.04,.13,0,.02,.57,P.concrete2);finish('Park_Pavilion');root.userData={...root.userData,entrance:[0,.10,.46],seats:[[-.33,.25,-.18],[-.33,.25,.18],[.33,.25,-.18],[.33,.25,.18]]};
  }else{
    // Japanese compact tourist coach: +Z nose, passenger entry on local -X.
    box(.37,.065,.95,0,.126,0,P.kawara2);box(.41,.185,1.03,0,.225,0,P.cream2);
    box(.39,.21,.91,0,.405,-.014,P.cream);box(.425,.027,.98,0,.518,-.014,P.roofTeal);
    box(.36,.147,.012,0,.410,.449,P.sky2);box(.012,.147,.015,0,.41,.46,P.cream2);
    box(.31,.12,.009,0,.421,-.477,P.sky2);
    for(const s of [-1,1]){
      box(.012,.038,.98,s*.209,.275,0,P.roofTeal);
      for(let i=0;i<5;i++)box(.009,.147,.133,s*.201,.412,-.36+i*.17,P.sky2);
      for(const z of [-.34,-.10,.13]){box(.009,.085,.20,s*.212,.196,z,P.concrete);box(.011,.008,.029,s*.220,.224,z,P.kawara2);}
      rod([s*.20,.425,.39],[s*.26,.425,.46],.007,P.kawara2);box(.026,.056,.029,s*.26,.416,.46,P.kawara2);
    }
    for(const x of [-.143,.143]){box(.075,.043,.013,x,.243,.525,P.lampGlow);box(.043,.064,.013,x,.238,-.522,P.roofRose);}
    box(.23,.042,.012,0,.204,.524,P.kawara2);for(let i=0;i<3;i++)box(.215,.004,.004,0,.19+i*.014,.532,P.concrete2);
    box(.435,.033,.025,0,.155,.521,P.concrete2);box(.435,.033,.025,0,.155,-.521,P.concrete2);
    box(.09,.028,.01,0,.167,.539,P.cream2);
    box(.24,.053,.22,0,.555,-.09,P.cream2);for(let i=0;i<5;i++)box(.19,.003,.015,0,.584,-.17+i*.036,P.concrete2);
    box(.22,.042,.009,0,.486,.462,P.indigo);box(.13,.008,.005,0,.486,.469,P.cream2);
    finish('Bus_Body_And_Glazing');
    // Separate entry door and four axle-centred wheel meshes.
    box(.013,.275,.139,-.219,.332,.298,P.roofTeal);box(.008,.168,.116,-.229,.369,.298,P.sky2);box(.01,.005,.12,-.230,.275,.298,P.cream2);
    finish('Passenger_Door',[-.219,.332,.368]).userData={hingeAxis:'Y',openAngle:Math.PI*.45};
    for(const side of [-1,1])for(const [name,z]of [['Front',.325],['Rear',-.315]]){
      rod([side*.195,.079,z],[side*.232,.079,z],.079,P.kawara2,.079,12);rod([side*.232,.079,z],[side*.237,.079,z],.043,P.lamp,.043,12);
      finish(`Wheel_${side<0?'Left':'Right'}_${name}`,[side*.215,.079,z]);
    }
    root.userData={...root.userData,doorPoint:[-.27,0,.30],driverPoint:[.10,.30,.30],wheelRadius:.079,wheelAxis:'X',front:'+Z'};
  }
  return root;
}
