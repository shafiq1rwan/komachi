// Two Kenney newcomers talk on the underground platform and board a procedural train.
import * as THREE from 'three';
import { S } from './state.js';
import { scene, camera, cam } from './scene.js';
import { box, mergeMesh } from './geometry.js';
import { makePerson } from './sim.js';
import { characterAvailable } from './characters.js';
import { STATION } from './world.js';
import { buildOpeningTrain } from './opening-train.js';
import { startTalk, endTalk } from './bubbles.js';
const opening = { active:false, root:null, train:null, doors:[], people:[], passers:[], t:0 };
const target = new THREE.Vector3(420,0.4,0.5), FLOOR=0.18;
let skyWas, fogWas;
const smooth=(t,a,b)=>{const k=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return k*k*(3-2*k);};
function parts(parent,g){const mesh=mergeMesh(g,true);if(mesh)parent.add(mesh);}
function buildStation(){
  const root=new THREE.Group();root.position.x=420;
  const g=[box(18,0.08,8,'#242d35',0,-0.12,0),box(18,3,0.1,'#37434a',0,1.3,-0.9),box(8,FLOOR,1.5,'#bbb8a9',0,FLOOR/2,1.43),box(8,0.015,0.1,'#e7c768',0,FLOOR+0.008,0.79),box(8,0.018,0.04,'#f2ebd9',0,FLOOR+0.008,0.7)];
  g.push(box(18,0.035,1.48,'#c5ae84',0,-0.052,-0.08));
  for(const z of [-0.27,0.27])g.push(box(18,0.025,0.025,'#909b9e',0,0,z));
  for(let x=-8;x<=8;x+=0.3)g.push(box(0.08,0.02,0.75,'#454746',x,-0.023,0));
  for(let x=-3.5;x<=3.5;x+=0.16)g.push(box(0.065,0.006,0.06,'#c4a850',x,FLOOR+0.018,0.79));
  for(const x of [-1.9,1.9]){g.push(box(0.12,1.4,0.12,'#d6d4c7',x,0.88,1.94));g.push(box(0.125,0.18,0.125,'#55988f',x,0.9,1.94));}
  g.push(box(1.5,0.20,0.05,'#f0ecdd',0,1.24,-0.81),box(1.5,0.025,0.055,'#529489',0,1.16,-0.81),box(0.84,0.045,0.25,'#7e9b88',-0.85,FLOOR+0.12,1.65),box(0.84,0.12,0.035,'#7e9b88',-0.85,FLOOR+0.20,1.79));
  for(const x of [-1.17,-0.53])g.push(box(0.035,0.12,0.16,'#606c6a',x,FLOOR+0.06,1.64));parts(root,g);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=64;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#f0ecdd';ctx.fillRect(0,0,512,64);ctx.fillStyle='#344c48';ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.fillText('Your Town \u2192 Komachi',256,44);
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.35,0.15),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas)}));sign.position.set(0,1.25,-0.778);root.add(sign);
  opening.train=buildOpeningTrain(FLOOR,opening.doors);root.add(opening.train);
  const light=new THREE.PointLight('#ffedcd',4,8,1.5);light.position.set(0,2,1.5);root.add(light);scene.add(root);return root;
}
function createPassengers(){
  ['Aoi Tanaka','Haru Sato'].forEach((name,i)=>{
    const who={id:`opening-${i}`,name,skin:'#e5b99a',shirt:i?'#bd795d':'#5f918c',pants:'#535c6b',hair:i?'#665044':'#343b40',hat:false,bag:false,state:'inside',paused:true,passenger:true};
    const mesh=makePerson(who);mesh.userData.res=null;mesh.userData.rider=who;who.mesh=mesh;opening.root.add(mesh);opening.people.push(who);
  });
}
function createPassers(){
  ['Ren Mori','Yui Ito','Sora Abe'].forEach((name,i)=>{
    const who={id:`opening-passer-${i}`,name,skin:'#e5b99a',shirt:['#8798b5','#caac65','#8b9e73'][i],pants:'#535c6b',hair:'#53453e',hat:false,bag:false,state:'walking',paused:false,passenger:true};
    const mesh=makePerson(who);mesh.userData.res=null;mesh.userData.rider=who;who.mesh=mesh;opening.root.add(mesh);opening.passers.push(who);
  });
}
function startOpening(){
  if(opening.active)return;
  if(!opening.root){opening.root=buildStation();createPassengers();createPassers();}
  skyWas=scene.background;fogWas=scene.fog;scene.fog=null;scene.background=new THREE.Color('#242d35');opening.root.visible=true;opening.active=true;opening.t=0;
  for(const who of opening.people){who.mesh.visible=true;who.paused=true;who.state='inside';const c=who.mesh.userData.char;if(c){c.sitting=true;c.sitBlend=1;}}
  updateOpening(0);startTalk(...opening.people,'home',S.T+1e6);cam.view=cam.tView=1.85;
}
function stopOpening(){
  if(!opening.active)return;
  opening.active=false;opening.root.visible=false;for(const who of [...opening.people,...opening.passers])who.mesh.visible=false;
  endTalk(opening.people[0]);scene.background=skyWas;scene.fog=fogWas;
}
function updateOpening(dt){
  if(!opening.active)return;
  opening.t+=dt;const t=opening.t;
  opening.train.position.x=-5.8*(1-smooth(t,3,5.7))+6*smooth(t,11.9,13.8);
  const doorOpen=smooth(t,5.8,6.5)*(1-smooth(t,10.9,11.7));opening.doors.forEach((door,i)=>{door.position.x=(i?1:-1)*(0.165+0.34*doorOpen);});
  if(t>=5.7 && opening.people[0].talk)endTalk(opening.people[0]);
  opening.people.forEach((who,i)=>{
    const mesh=who.mesh,c=mesh.userData.char,start=7.3+i*0.7;
    const stand=smooth(t,6.5,7.2),approach=smooth(t,start,start+1.6),hop=smooth(t,start+1.6,start+2.1),inside=smooth(t,start+2.1,start+2.45);
    const x0=i?-0.66:-1.04,x1=i?0.12:-0.12;
    const x=THREE.MathUtils.lerp(x0,x1,approach);
    const z=1.61-0.29*stand-0.49*approach-0.54*hop-0.2*inside;
    mesh.position.set(x+opening.train.position.x*(t>=start+2.45?1:0),FLOOR+0.12*(1-stand)+Math.sin(hop*Math.PI)*0.075,z);
    const heading=Math.atan2(x1-x0,-0.49);
    mesh.rotation.y=Math.PI+(heading-Math.PI)*smooth(t,start,start+0.3)*(1-smooth(t,start+1.3,start+1.6));
    who.paused=!(t>=start && t<start+2.45);who.state=who.paused?'inside':'walking';
    if(c){c.sitting=t<6.5;c.fidget=t<5.7?'nod':null;c.gaze=t<5.7?(i?0.6:-0.6):0;}
  });
  opening.passers.forEach((who,i)=>{
    const direction=i===1?-1:1,delay=i===2?0.8:0;
    const x=(i===2?-4:-2.6)+Math.max(0,t-delay)*1.05;
    who.mesh.position.set(direction*x,FLOOR,i===1?1.23:1.02);
    who.mesh.rotation.y=direction*Math.PI/2;who.mesh.visible=t>=delay&&x<4.2;
  });
  const aspect=innerWidth/innerHeight,v=Math.max(1.85,4.4/aspect);camera.left=-v*aspect/2;camera.right=v*aspect/2;camera.top=v/2;camera.bottom=-v/2;camera.updateProjectionMatrix();
  const dir=new THREE.Vector3(Math.sin(0.16)*Math.cos(0.42),Math.sin(0.42),Math.cos(0.16)*Math.cos(0.42));camera.position.copy(target).addScaledVector(dir,120);camera.lookAt(target);
}

const RIDE = 13.6, CLOSE = 1.1, OPEN = 2.6;   // seconds
let playing = false;
function playOpening(onDone) {
  if (playing) return;
  if (!characterAvailable()) { if (onDone) onDone(); return; }   // no rigged people (box look or a failed load): straight in
  const iris = document.getElementById('iris'), skip = document.getElementById('skip-opening'); if (!iris || !skip) { if (onDone) onDone(); return; }
  playing = true; startOpening(); document.body.classList.add('opening'); iris.hidden = false; skip.hidden = false;
  const wasSpeed = S.speed; S.speed = 0;
  let landedAt = 0; let phase = 'ride', done = false;
  const full = () => Math.hypot(innerWidth, innerHeight) / 2 + 8;
  const setHole = r => { iris.style.background = r >= full() ? 'transparent' : `radial-gradient(circle at 50% 50%, transparent ${Math.max(0, r).toFixed(1)}px, #12171f ${(Math.max(0, r) + 2).toFixed(1)}px)`; };
  const land = () => {   // out of the tunnel: the camera high over the station, ready to glide in
    stopOpening(); document.body.classList.remove('opening'); skip.hidden = true; S.speed = wasSpeed; landedAt = performance.now();
    const E = STATION.entrance; cam.target.set(E.x, 0, E.z - 0.9); cam.tYaw = cam.yaw; cam.view = cam.tView = 46;
  };
  const finish = () => { if (done) return; done = true; if (phase === 'ride' || phase === 'close') land(); cam.view = cam.tView = 12; setHole(full()); iris.hidden = true; iris.style.background = ''; skip.onclick = null; removeEventListener('keydown', onKey); playing = false; if (onDone) onDone(); };
  const onKey = e => { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); finish(); } };
  const tick = () => {
    if (done) return;
    const t = opening.t;
    if (phase === 'ride') { setHole(full()); if (t >= RIDE) phase = 'close'; }
    if (phase === 'close') { const k = Math.min(1, (t - RIDE) / CLOSE); setHole(full() * (1 - k) ** 1.6); if (k >= 1) { phase = 'open'; land(); } }
    else if (phase === 'open') { const k = Math.min(1, (performance.now() - landedAt) / 1000 / OPEN); setHole(full() * k ** 1.3); cam.view = cam.tView = 12 + 34 * (1 - k) ** 2; if (k >= 1) { finish(); return; } }
    requestAnimationFrame(tick);
  };
  skip.onclick = finish; addEventListener('keydown', onKey); requestAnimationFrame(tick);
}

export { opening, startOpening, stopOpening, updateOpening, playOpening };
