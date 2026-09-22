// Original nature kit: deterministic, vertex-coloured geometry, shared by exports and the town.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL } from './palette.js';
import { hash } from './utils.js';

export const NATURE_KINDS = ['pine', 'matsu', 'bamboo', 'cherry', 'broadleaf', 'rock', 'paddy'];
export function natureGeometry(kind, seed = .5, color) {
  if (!NATURE_KINDS.includes(kind)) throw new Error(`Unknown nature asset: ${kind}`);
  const parts = [], r = n => hash(Math.floor(seed * 10000) + n, n * 13 + 8);
  function add(g, tint) {
    const geo = g.index ? g.toNonIndexed() : g; if (geo !== g) g.dispose();
    // Match the building merger's standard position/normal/uv/colour attributes.
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    const c = new THREE.Color(tint), colors = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); parts.push(geo);
  }
  function box(size, p, tint) { const g = new THREE.BoxGeometry(...size); g.translate(...p); add(g, tint); }
  function branch(a, b, radius, tint = PAL.wood2, end = radius * .6) {
    const start = new THREE.Vector3(...a), finish = new THREE.Vector3(...b), d = finish.clone().sub(start);
    const g = new THREE.CylinderGeometry(end, radius, d.length(), 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
    g.translate(...start.add(finish).multiplyScalar(.5).toArray()); add(g, tint);
  }
  function crown(p, size, tint, phase = 0) {
    // Squashed, irregular eight-sided crown lobes; never a dodecahedron.
    const g = new THREE.SphereGeometry(1, 8, 4), pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),j=1+.09*Math.sin(x*7+z*5+phase);pos.setXYZ(i,x*j,y*(1+.07*Math.cos(z*8+phase)),z*j); }
    g.scale(...size);g.rotateY(phase);g.translate(...p);g.computeVertexNormals();add(g,tint);
  }
  function leaf(a, b, width, tint) {
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),mid=start.clone().lerp(end,.45),side=new THREE.Vector3(width,0,width*.2);
    const v=[start,mid.clone().add(side),end,mid.clone().sub(side)],data=[];
    for(const t of [[0,1,2],[0,2,3],[2,1,0],[3,2,0]])for(const i of t)data.push(...v[i].toArray());
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();add(g,tint);
  }
  if (kind === 'pine') {
    branch([0,0,0],[.015,1.12,0],.055);
    for(let tier=0;tier<4;tier++){
      const radius=.34-tier*.066,base=.30+tier*.225,height=.43-tier*.045;
      const g=new THREE.CylinderGeometry(.012,radius,height,9,1,false),p=g.attributes.position;
      for(let i=0;i<p.count;i++)if(p.getY(i)<0)p.setY(i,p.getY(i)+.025*Math.sin(Math.atan2(p.getZ(i),p.getX(i))*3+seed*6));
      g.rotateY(tier*.48+seed);g.translate(0,base+height/2,0);g.computeVertexNormals();add(g,tier%2?PAL.treeGreen:color||PAL.roofSage);
      for(let k=0;k<3;k++){const a=k*2.094+tier;branch([0,base,0],[Math.cos(a)*radius*.75,base+.06,Math.sin(a)*radius*.75],.012);}
    }
  } else if(kind==='matsu') {
    branch([0,0,0],[-.075,.38,.025],.047);branch([-.075,.38,.025],[.03,.75,0],.03);
    for(let i=0;i<5;i++){const a=i*2.4+seed*4,y=.38+i*.085,p=[Math.cos(a)*(.22-i*.018),y,Math.sin(a)*(.19-i*.012)];branch([-.02,y-.1,0],p,.017);crown([p[0],y+.055,p[2]],[.23-i*.014,.075,.17],i%2?PAL.treeGreen:color||PAL.roofSage,a);}
  } else if(kind==='bamboo') {
    for(let i=0;i<5;i++){
      const x=(r(i)-.5)*.28,z=(r(i+9)-.5)*.28,h=.85+r(i+18)*.42;
      branch([x,0,z],[x+.028,h,z],.012,color||PAL.treeGreen,.009);
      for(let y=.17;y<h;y+=.17)branch([x+.028*y/h,y,z],[x+.028*y/h,y+.012,z],.015,PAL.treeSage,.015);
      for(let j=0;j<3;j++){
        const y=h-.1-j*.16,s=(j+i)%2?1:-1,end=[x+s*.16,y+.05,z+.04];branch([x+.02,y,z],end,.003,PAL.roofSage);
        for(let k=0;k<4;k++){const p=[x+s*(.035+k*.035),y+.012*k,z+.01*k];leaf(p,[p[0]+s*.075,p[1]+(k%2?.07:-.06),p[2]+(k%2?.045:-.055)],.018,k%2?PAL.treeSage:PAL.treeGreen);}
      }
    }
  } else if(kind==='cherry'||kind==='broadleaf') {
    const cherry=kind==='cherry',main=color||(cherry?PAL.pink:PAL.treeGreen);
    branch([0,0,0],[.025,.37,-.01],.053);branch([.025,.37,-.01],[-.03,.7,.02],.032);
    for(let i=0;i<6;i++){
      const a=i*2.4+seed*5,d=.19+r(i)*.075,y=.52+r(i+6)*.19,p=[Math.cos(a)*d,y,Math.sin(a)*d];
      branch([.012,.29+i*.035,0],p,.021);
      crown([p[0],p[1]+.065,p[2]],[.21+r(i+20)*.03,.15,.20],i%3===0?(cherry?PAL.pink:PAL.treeSage):main,a);
      if(cherry){
        for(let j=0;j<4;j++){
          const b=a+j*1.57,normal=new THREE.Vector3(Math.cos(b),.65,Math.sin(b)).normalize();
          const centre=new THREE.Vector3(p[0]+Math.cos(b)*.198,p[1]+.14,p[2]+Math.sin(b)*.19);
          const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
          for(let petal=0;petal<5;petal++){
            const angle=petal*Math.PI*2/5,off=new THREE.Vector3(Math.cos(angle)*.018,Math.sin(angle)*.018,0);
            const flower=new THREE.CircleGeometry(.016,5);flower.translate(...off.toArray());flower.applyQuaternion(rotation);flower.translate(...centre.toArray());add(flower,PAL.flower);
          }
          const heart=new THREE.CircleGeometry(.006,6);heart.translate(0,0,.001);heart.applyQuaternion(rotation);heart.translate(...centre.toArray());add(heart,PAL.cream);
        }
      }
    }
    crown([-.02,.79,.015],[.24,.16,.23],main,seed*4);
    if(cherry)for(let i=0;i<14;i++){const a=r(i+55)*Math.PI*2,d=.18+r(i+80)*.24;const g=new THREE.CircleGeometry(.018,5);g.rotateX(-Math.PI/2);g.rotateY(a);g.translate(Math.cos(a)*d,.004,Math.sin(a)*d);add(g,i%2?PAL.flower:PAL.pink);}
  } else if(kind==='rock') {
    for(let i=0;i<3;i++){
      const g=new THREE.IcosahedronGeometry(1,0),p=g.attributes.position,size=i===0?.21:.105;
      for(let k=0;k<p.count;k++){const x=p.getX(k),y=p.getY(k),z=p.getZ(k);p.setXYZ(k,x*size*(1+.17*Math.sin(z*9+seed)),Math.max(0,(y+.48)*size*.7),z*size*.8);}
      g.rotateY(i*2+seed*5);g.translate(i===0?0:i===1?.20:-.16,0,i===2?.12:0);g.computeVertexNormals();add(g,i%2?PAL.concrete2:color||PAL.kawara);
    }
  } else {
    // One cell: low earth bunds, opaque shallow water and regularly planted rice clumps.
    box([.938,.024,.938],[0,.012,0],PAL.dirt);box([.82,.006,.82],[0,.028,0],PAL.canal);
    for(const s of [-1,1]){box([.06,.045,.94],[s*.44,.026,0],PAL.roofSage);box([.82,.045,.06],[0,.026,s*.44],PAL.roofSage);}
    for(let row=0;row<5;row++)for(let col=0;col<5;col++){
      const x=(col-2)*.145,z=(row-2)*.145,h=.13+r(row*5+col)*.045;
      for(let k=0;k<3;k++){const a=k*2.094;leaf([x,.03,z],[x+Math.cos(a)*.035,h,z+Math.sin(a)*.035],.009,k===0?PAL.treeSage:color||PAL.treeGreen);}
    }
    box([.075,.013,.04],[.425,.056,.13],PAL.wood2);
  }
  const geometry=mergeGeometries(parts);parts.forEach(g=>g.dispose());
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++)if(positions.getY(i)<0)positions.setY(i,0);
  geometry.computeVertexNormals();return geometry;
}

export function addNature(out, kind, x=0, y=0, z=0, scale=1, seed=.5, color) {
  const g=natureGeometry(kind,seed,color);g.scale(scale,scale,scale);g.rotateY(seed*Math.PI*2);g.translate(x,y,z);out.push(g);
}
export function createNature(kind, seed=.5, color) {
  const mesh=new THREE.Mesh(natureGeometry(kind,seed,color),new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,flatShading:true}));
  mesh.name=`Komachi_${kind}`;mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}
