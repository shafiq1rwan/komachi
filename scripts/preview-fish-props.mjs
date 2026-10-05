import assert from 'node:assert/strict';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
const local = process.env.LOCALAPPDATA;
const pw = local && existsSync(local + '/ms-playwright') ? readdirSync(local + '/ms-playwright').filter(n => n.startsWith('chromium-')).sort().reverse().map(n => local + '/ms-playwright/' + n + '/chrome-win64/chrome.exe') : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
const server = await createServer({ server: { open: false, port: 4194, strictPort: true } }); await server.listen();
let browser;
try {
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--enable-gpu'] });
  const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1500, height: 620 });
  await page.goto('http://localhost:4194/docs/fish-props-preview.html', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.fishPropsPreview);
  mkdirSync('docs/props/fish', { recursive: true });
  await page.screenshot({ path: 'docs/props/fish/collection.png' });
  const result = await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js'), p = window.fishPropsPreview;
    return p.props.map(({ root, gltf }) => {
      const clip = gltf.animations.find(a => a.name === 'wriggle'); if (!clip) throw Error('Wriggle clip missing');
      const mixer = new THREE.AnimationMixer(root), tail = root.getObjectByName('Fish_Tail'); mixer.clipAction(clip).play(); mixer.update(clip.duration / 4);
      if (tail.quaternion.angleTo(new THREE.Quaternion()) < 0.1) throw Error('Exported tail does not move');
      mixer.stopAllAction();
      const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
      if (!size.toArray().every(Number.isFinite)) throw Error('Invalid exported bounds');
      return { species: root.children[0].userData.species, animations: gltf.animations.map(c => c.name), size: size.toArray() };
    });
  });
  const kinds = ['sardine', 'horse-mackerel', 'flounder', 'rockfish', 'sea-bream'];
  await page.setViewport({ width: 900, height: 650 });
  await page.addStyleTag({ content: 'header,#labels{display:none}' });
  for (let index = 0; index < kinds.length; index++) {
    await page.evaluate(index => {
      const p = window.fishPropsPreview, root = p.props[index].root;
      p.props.forEach(({ root }, i) => { root.visible = i === index; });
      p.scene.children.filter(o => o.isMesh).forEach(o => { o.visible = false; });
      const x = root.position.x;
      p.camera.left = -.15; p.camera.right = .15; p.camera.top = .15 * 650 / 900; p.camera.bottom = -.15 * 650 / 900;
      p.camera.position.set(x + .025, .16, .48); p.camera.lookAt(x, .045, 0); p.camera.updateProjectionMatrix();
      p.renderer.setSize(900, 650); p.render();
    }, index);
    await page.screenshot({ path: `docs/props/fish/komachi-${kinds[index]}.png` });
  }
  // Inspect the actual market placement as well as the exported standalone assets.
  const game = await browser.newPage(); await game.setViewport({ width: 1200, height: 800 });
  await game.goto('http://localhost:4194/?demo&seed=7', { waitUntil: 'domcontentloaded' });
  await game.waitForFunction(() => window.MT && window.MT.scene.getObjectByName('Market_Fish'));
  await game.evaluate(async () => {
    const moduleUrl = performance.getEntriesByType('resource').find(e => new URL(e.name).pathname === '/src/landmarks.js')?.name || '/src/landmarks.js';
    const { setFishStall } = await import(moduleUrl); setFishStall(true);
    const MT = window.MT, market = MT.scene.getObjectByName('Market_Fish');
    MT.setSpeed(0); MT.setWeather('clear', 50); MT.setHour(14); MT.setFollow(null);
    const THREE = await import('/node_modules/three/build/three.module.js'), target = new THREE.Vector3(); market.getWorldPosition(target);
    MT.cam.target.copy(target); MT.cam.view = MT.cam.tView = 1.6; MT.cam.yaw = MT.cam.tYaw = market.parent.rotation.y + 0.5;
    document.body.classList.add('trailer');
  });
  await game.waitForFunction(() => window.MT.cam.view === 1.6 && !document.getElementById('loading')?.offsetParent);
  await game.screenshot({ path: 'docs/props/fish/market.png' });
  assert.deepEqual(errors, []);
  console.log('PASS five GLB round trips and animated tails:', JSON.stringify(result));
} finally { await browser?.close(); await server.close(); }
