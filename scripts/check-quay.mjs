/* global MT */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';

const pwRoot = `${process.env.LOCALAPPDATA}/ms-playwright`;
const pw = existsSync(pwRoot) ? readdirSync(pwRoot).filter(n => n.startsWith('chromium-')).sort().reverse().map(n => `${pwRoot}/${n}/chrome-win64/chrome.exe`) : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
const server = await createServer({ server: { open: false, port: 4194, strictPort: true } });
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1100, height: 800 });
  mkdirSync('scripts/out', { recursive: true });
  for (const seed of [7, 19, 12345]) {
    const requests = [];
    const track = req => { if (req.url().includes('boat-fishing-small.glb') && req.resourceType() !== 'script') requests.push(req.url()); };
    page.on('request', track);
    await page.goto(`http://localhost:4194/?new&seed=${seed}&look=classic`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.MT?.scene.getObjectByName('quay-boat')?.children[0]?.userData.asset === 'kenney/boat-fishing-small');
    const result = await page.evaluate(async () => {
      const THREE = await import('/node_modules/three/build/three.module.js');
      const P = MT.pierFrame(), berth = MT.scene.getObjectByName('quay-boat'), model = berth.children[0];
      MT.setSpeed(0); MT.setHour(12); MT.setWeather('clear');
      const bounds = new THREE.Box3().setFromObject(model), local = new THREE.Box3();
      // Bounds in the berth's own axes, independent of seeded coastline angle.
      model.updateMatrix();
      model.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); local.union(o.geometry.boundingBox.clone().applyMatrix4(model.matrix)); } });
      const boatCentre = berth.position.clone().sub(P.root), along = boatCentre.x * Math.sin(P.ang) + boatCentre.z * Math.cos(P.ang);
      const across = boatCentre.x * Math.cos(P.ang) - boatCentre.z * Math.sin(P.ang);
      let shoreClearance = Infinity;
      for (const x of [local.min.x, local.max.x]) for (const z of [local.min.z, local.max.z]) {
        const point = berth.localToWorld(new THREE.Vector3(x, 0, z));
        const theta = Math.atan2(point.z / MT.islandEllipse[1], point.x / MT.islandEllipse[0]);
        shoreClearance = Math.min(shoreClearance, -MT.coastDist(point.x, point.z) - MT.beachExtra(theta));
      }
      const meshes = []; model.traverse(o => { if (o.isMesh) meshes.push(o); });
      let obstructingPlants = 0;
      const plants = MT.scene.getObjectByName('shore-vegetation')?.geometry.attributes.position;
      for (let i = 0; plants && i < plants.count; i++) {
        const dx = plants.getX(i) - P.root.x, dz = plants.getZ(i) - P.root.z;
        const a = dx * Math.sin(P.ang) + dz * Math.cos(P.ang), s = dx * Math.cos(P.ang) - dz * Math.sin(P.ang);
        if (a >= 0 && a <= P.len && Math.abs(s) < (a >= P.len - P.headDepth ? P.headWidth : P.width) / 2) obstructingPlants++;
      }
      const centre = P.at(P.len * 0.55, 0);
      MT.cam.target.copy(centre); MT.cam.view = MT.cam.tView = 5.2;
      MT.cam.yaw = MT.cam.tYaw = P.ang + 0.8;
      document.querySelector('#intro')?.remove();
      return { seed: new URLSearchParams(location.search).get('seed'), along, headClearance: across + local.min.x - 0.75,
        shoreClearance, bottom: bounds.min.y, deck: P.at(0, 0).y, spots: P.spots.length, obstructingPlants,
        textured: meshes.length > 0 && meshes.every(o => o.material.map?.image?.width > 0), asset: model.userData.asset };
    });
    assert.equal(result.asset, 'kenney/boat-fishing-small'); assert.ok(result.textured);
    assert.ok(result.headClearance > 0.08, JSON.stringify(result));
    assert.ok(result.shoreClearance > 0, JSON.stringify(result));
    assert.ok(Math.abs(result.bottom + 0.76) < 0.001);
    assert.ok(Math.abs(result.deck + 0.112) < 0.001); assert.equal(result.spots, 9);
    assert.equal(result.obstructingPlants, 0, 'shore vegetation must clear the quay');
    assert.equal(requests.length, 1, 'moored/offshore boats must share a model request');
    for (const look of ['rich', 'classic']) {
      await page.evaluate(look => MT.setLook(look), look);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      if (look === 'rich' || seed === 7) await page.screenshot({ path: `scripts/out/quay-${seed}-${look}.png` });
      assert.equal(await page.evaluate(() => MT.scene.getObjectByName('quay-boat').children[0].userData.asset), 'kenney/boat-fishing-small');
    }
    page.off('request', track); console.log(result);
  }
  assert.deepEqual(errors, []);
} finally { await browser?.close(); await server.close(); }
