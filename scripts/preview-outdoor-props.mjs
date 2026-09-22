import {createServer} from 'vite';import puppeteer from 'puppeteer-core';import {existsSync,mkdirSync} from 'node:fs';
const executablePath=[process.env.BROWSER_PATH,`${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
const server=await createServer({server:{open:false,port:4193,strictPort:true}});await server.listen();let browser;
try{
 browser=await puppeteer.launch({executablePath,headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1500,height:950,deviceScaleFactor:1});
 await page.goto('http://localhost:4193/docs/outdoor-props-preview.html',{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.propsPreview);mkdirSync('docs/props',{recursive:true});
 await page.screenshot({path:'docs/props/komachi-outdoor-props-characters.png'});
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js');const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const {PROP_KINDS,createCharacterProp,setUmbrellaOpen,clearCharacterProp,equipCharacterProp}=await import('/src/character-props.js');
  const {updateCharacters}=await import('/src/characters.js');const p=window.propsPreview,results=[];
  for(const kind of PROP_KINDS){const gltf=await new GLTFLoader().loadAsync(`/assets/props/komachi-${kind}.glb`),box=new THREE.Box3().setFromObject(gltf.scene);let tris=0;gltf.scene.traverse(o=>{if(o.isMesh){tris+=o.geometry.attributes.position.count/3;for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))throw new Error('Invalid vertex');}});
   if(kind==='umbrella'){const mixer=new THREE.AnimationMixer(gltf.scene),close=mixer.clipAction(gltf.animations.find(c=>c.name==='close'));close.setLoop(THREE.LoopOnce,1);close.clampWhenFinished=true;close.play();mixer.update(.6);const ref=createCharacterProp(kind);setUmbrellaOpen(ref,false);if(gltf.scene.getObjectByName('Canopy').scale.distanceTo(ref.getObjectByName('Canopy').scale)>1e-6)throw new Error('Folded GLB mismatch');}
   results.push({kind,triangles:tris,size:box.getSize(new THREE.Vector3()).toArray(),clips:gltf.animations.map(c=>c.name)});
  }
  // Character attachment must remain finite and clear of the floor across a full walking cycle.
  p.chars.forEach(c=>c.grp.userData.res.state='walking');let lowest=Infinity;
  for(let i=0;i<90;i++){updateCharacters(1/60);for(const c of p.chars){const bounds=new THREE.Box3().setFromObject(c.accessory);lowest=Math.min(lowest,bounds.min.y);if(!Number.isFinite(bounds.min.y))throw new Error('Invalid attachment');}}
  if(lowest<-.001)throw new Error(`Prop intersects ground: ${lowest}`);
  p.chars.forEach(c=>c.grp.userData.res.state='inside');updateCharacters(1);
  const c=p.chars[0],old=c.accessory;clearCharacterProp(c);if(old.parent||c.accessory)throw new Error('Detach failed');equipCharacterProp(c,'broom');
  return{assets:results,lowestWalkingPoint:lowest};
 });
 await page.select('#view','props');await page.screenshot({path:'docs/props/komachi-outdoor-props-preview.png'});
 for(let i=0;i<3;i++){
  await page.evaluate(index=>{const p=window.propsPreview;p.props.forEach((o,k)=>o.visible=k===index);const x=p.props[index].position.x;const long=index===1;p.controls.target.set(x,long?.35:.17,0);p.camera.position.set(x+(long?.28:.20),long?.58:.32,long?.85:.48);p.controls.update();p.renderer.render(p.scene,p.camera);},i);
  await page.screenshot({path:`docs/props/komachi-${['broom','fishing-rod','watering-can'][i]}.png`});
 }
 if(errors.length)throw new Error(errors.join('\n'));console.log(JSON.stringify(result,null,2));
}finally{await browser?.close();await server.close();}

