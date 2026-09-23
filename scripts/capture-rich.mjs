import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const pw = process.env.LOCALAPPDATA ? (() => { try { return readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter(d => d.startsWith('chromium-')).sort().reverse().map(d => process.env.LOCALAPPDATA + '/ms-playwright/' + d + '/chrome-win64/chrome.exe'); } catch { return []; } })() : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
if (!executablePath) throw Error('No Chromium browser found');
const port = 4187;
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
await new Promise(r => setTimeout(r, 2500));
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 940, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const rendered = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.goto(`http://localhost:${port}/?seed=7&look=rich&demo=dense`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(r => setTimeout(r, 7000));
  // Show the completed architecture without active renovation scaffolds covering it.
  await page.evaluate(() => { MT.setSpeed(0); for (const b of MT.blocks) { if (b.type === 'station') continue; b.stage = MT.DONE; b.renoT = 0; for (const u of b.units) MT.rebuildUnitMesh(u); } });
  await rendered();
  await page.screenshot({ path: 'scripts/out/rich-current.png' });
  await page.evaluate(() => { MT.cam.target.set(-3, 0, 3); MT.cam.view = MT.cam.tView = 10; });
  await rendered();
  await page.screenshot({ path: 'scripts/out/rich-neighbourhood.png' });
  await page.evaluate(() => { MT.cam.target.set(0.5, 0, 0.5); MT.cam.view = MT.cam.tView = 20.5; });
  const rich = await page.evaluate(() => {
    const unit = MT.blocks.find(b => b.type === 'res').units[0];
    const invalid = MT.blocks.filter(b => ['res', 'shop', 'work'].includes(b.type)).flatMap(b => b.units).some(u => !Number.isFinite(u.door?.x) || !Number.isFinite(u.door?.z));
    return { active: document.body.classList.contains('rich'), buildings: MT.blocks.length, vertices: unit.mesh.children[0].geometry.attributes.position.count, invalid };
  });
  if (!rich.active || rich.buildings < 30) throw Error(`Rich view failed: ${JSON.stringify(rich)}`);
  if (rich.invalid) throw Error('A building has invalid entrance coordinates');
  await page.evaluate(() => MT.setLook('classic'));
  const classic = await page.evaluate(() => ({ active: document.body.classList.contains('rich'), vertices: MT.blocks.find(b => b.type === 'res').units[0].mesh.children[0].geometry.attributes.position.count }));
  if (classic.active) throw Error(`Look toggle failed: ${JSON.stringify(classic)}`);
  if (classic.vertices === rich.vertices) throw Error('Look toggle did not rebuild the house geometry');
  await page.evaluate(() => { MT.setLook('rich'); MT.setHour(21); });
  await rendered();
  await page.screenshot({ path: 'scripts/out/rich-night.png' });
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Saved rich-current.png, rich-neighbourhood.png and rich-night.png; rich town and look toggles verified');
} finally {
  await browser.close(); server.kill();
}
