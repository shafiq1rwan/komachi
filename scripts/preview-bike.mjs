import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
const executablePath = [process.env.BROWSER_PATH, `${process.env.LOCALAPPDATA}/ms-playwright/chromium-1243/chrome-win64/chrome.exe`, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(existsSync);
const server = await createServer({ server: { open: false, port: 4189, strictPort: true } }); await server.listen(); let browser;
try {
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1400, height: 950, deviceScaleFactor: 1 });
  await page.goto('http://localhost:4189/docs/bike-preview.html', { waitUntil: 'networkidle0' }); await page.waitForFunction(() => window.bikePreview);
  mkdirSync('docs/vehicles', { recursive: true });
  await page.screenshot({ path: 'docs/vehicles/komachi-city-bicycle-preview.png' });
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { createBike, rollBike, BIKE_RADIUS } = await import('/src/bikes.js');
    const gltf = await new GLTFLoader().loadAsync('/assets/vehicles/bicycle/komachi-city-bicycle.glb');
    const bounds = new THREE.Box3().setFromObject(gltf.scene), game = createBike(), mixer = new THREE.AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations[0]).play();
    for (let i = 0; i < 120; i++) {
      mixer.update(1 / 60); rollBike(game, BIKE_RADIUS * Math.PI * 2 / 60);
      for (const name of ['Front_Wheel', 'Rear_Wheel', 'Crank', 'Left_Pedal', 'Right_Pedal']) {
        if (game.getObjectByName(name).quaternion.angleTo(gltf.scene.getObjectByName(name).quaternion) > .001) throw new Error(`Animation mismatch: ${name}`);
      }
    }
    const steady = createBike(); for (let i = 0; i < 60; i++) rollBike(steady, .22 / 60);
    const fast = createBike(); rollBike(fast, .22);
    if (steady.bikeParts.wheels[0].quaternion.angleTo(fast.bikeParts.wheels[0].quaternion) > .001) throw new Error('Frame rate dependence');
    if (Math.abs(bounds.min.y) > .0001) throw new Error('Tyres not on ground');
    const pedal = steady.bikeParts.pedals[0]; steady.updateMatrixWorld(true);
    if (pedal.getWorldQuaternion(new THREE.Quaternion()).angleTo(new THREE.Quaternion()) > .001) throw new Error('Pedals not level');
    return { clips: gltf.animations.map(c => c.name), size: bounds.getSize(new THREE.Vector3()).toArray(), meshes: (() => { let n=0; gltf.scene.traverse(o=>{if(o.isMesh)n++;});return n; })() };
  });
  await page.evaluate(() => { const p = window.bikePreview; p.camera.position.set(.8, .28, .015); p.controls.update(); p.renderer.render(p.scene, p.camera); });
  await page.screenshot({ path: 'docs/vehicles/komachi-city-bicycle-side.png' });
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync('/assets/characters/builder/komachi-builder.glb');
    const { poseBikeRider, BIKE_SEAT } = await import('/src/bikes.js');
    const p = window.bikePreview, rider = gltf.scene; rider.scale.setScalar(.46); rider.position.set(0, BIKE_SEAT.y - .026 * .46, BIKE_SEAT.z); p.scene.add(rider);
    const mixer = new THREE.AnimationMixer(rider); mixer.clipAction(gltf.animations.find(c=>c.name==='sit')).play(); mixer.update(1);
    poseBikeRider(rider,p.bike);
    p.camera.position.set(.9, .48, .67); p.controls.target.set(0,.21,0); p.controls.update(); p.renderer.render(p.scene,p.camera);
  });
  await page.screenshot({ path: 'docs/vehicles/komachi-city-bicycle-rider.png' });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('Bike geometry, GLB animation parity, wheel travel and level pedals passed:', result);
} finally { await browser?.close(); await server.close(); }
