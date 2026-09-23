// A fixed seed sweep, each column showing the same home at levels 1/2 and as a villa.
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';

const pwRoot = `${process.env.LOCALAPPDATA}/ms-playwright`;
const pw = existsSync(pwRoot) ? readdirSync(pwRoot).filter(n => n.startsWith('chromium-')).sort().reverse().map(n => `${pwRoot}/${n}/chrome-win64/chrome.exe`) : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
const server = await createServer({ server: { open: false, port: 4193, strictPort: true }, plugins: [{
  name: 'architecture-preview',
  configureServer(server) { server.middlewares.use((req, res, next) => {
  if (!req.url.startsWith('/__architecture')) return next();
  res.setHeader('Content-Type', 'text/html');
  res.end('<html><body style="margin:0"><div style="position:absolute;top:20px;left:24px;font:18px sans-serif;color:#333">Seed sweep: level 1 / level 2 / villa (front to back)</div></body></html>');
  }); },
}] });
await server.listen();
let browser;
try {
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1500, height: 1000 });
  await page.goto('http://localhost:4193/__architecture?seed=1&look=rich');
  await page.evaluate(async () => {
    const THREE = await import('/node_modules/three/build/three.module.js');
    const { genRichBuilding } = await import('/src/rich-buildings.js');
    const { mergeMesh } = await import('/src/geometry.js');
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#e2e6de');
    scene.add(new THREE.HemisphereLight('#ffffff', '#a1a797', 2));
    const sun = new THREE.DirectionalLight('#fff1d9', 2.6); sun.position.set(-4, 8, 5); scene.add(sun);
    const camera = new THREE.OrthographicCamera(-5.1, 5.1, 3.4, -3.4, 0.1, 50);
    camera.position.set(3, 6, 9); camera.lookAt(0, 0.3, 0);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
      const g = [], wg = [], u = { seed: col / 5, variant: row === 2 ? 'villa' : 'detached' };
      genRichBuilding({ type: 'res', level: row === 1 ? 2 : 1 }, u, g, wg);
      const group = new THREE.Group(); group.add(mergeMesh(g), mergeMesh(wg));
      group.position.set((col - 2) * 1.6, 0, (1 - row) * 1.8); scene.add(group);
    }
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setSize(1500, 1000);
    renderer.setPixelRatio(1); document.body.append(renderer.domElement); renderer.render(scene, camera);
  });
  mkdirSync('scripts/out', { recursive: true });
  await page.screenshot({ path: 'scripts/out/architecture-seeds.png' });
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Saved scripts/out/architecture-seeds.png');
} finally { await browser?.close(); await server.close(); }
