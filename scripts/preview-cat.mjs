// Render the review image and check the exported asset with the application's GLTFLoader.
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';
const executablePath = [process.env.BROWSER_PATH, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean).find(existsSync);
const server = await createServer({ server: { open: false, port: 4183, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1400, height: 950, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://localhost:4183/docs/cat-preview.html', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.catPreview?.cats.length === 3);
  mkdirSync('docs/characters', { recursive: true });
  await page.screenshot({ path: 'docs/characters/komachi-cat-preview.png' });
  const asset = await page.evaluate(async () => {
    const { GLTFLoader } = await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
    const { Box3, AnimationMixer } = await import('/node_modules/three/build/three.module.js');
    const gltf = await new GLTFLoader().loadAsync('/assets/characters/cat/komachi-cat.glb');
    const b = new Box3().setFromObject(gltf.scene), clips = gltf.animations.map(c => c.name);
    const mixer = new AnimationMixer(gltf.scene); mixer.clipAction(gltf.animations.find(c => c.name === 'walk')).play(); mixer.update(.12);
    const leg = gltf.scene.getObjectByName('Leg_0');
    return { clips, minY: b.min.y, height: b.max.y - b.min.y, animatedLeg: leg.rotation.x };
  });
  if (errors.length || asset.minY < -0.001 || asset.height < .2 || !asset.clips.includes('idle') || Math.abs(asset.animatedLeg) < .1) throw new Error(JSON.stringify({ errors, asset }));
  await page.click('#motion');
  await page.waitForFunction(() => Math.abs(window.catPreview.cats[0].catParts.legs[0].rotation.x) > .2);
  console.log('Cat preview and GLB round-trip passed:', JSON.stringify(asset));
} finally { await browser?.close(); await server.close(); }
