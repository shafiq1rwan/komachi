// Browser checks for the compact HUD, real unlock previews, direct building selection, and reduced motion.
// Run after npm run build. Uses an isolated browser profile and never touches the player's saved towns.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';

const pwDir = process.env.LOCALAPPDATA + '/ms-playwright';
const pw = existsSync(pwDir) ? readdirSync(pwDir).filter(d => d.startsWith('chromium-')).sort().reverse().map(d => pwDir + '/' + d + '/chrome-win64/chrome.exe') : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(p => p && existsSync(p));
assert.ok(executablePath, 'A Chromium browser is required');
const port = 4186;
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(port), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
let browser;
const stop = () => { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill(); };
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch { /* server starting */ } await new Promise(r => setTimeout(r, 250)); }
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://localhost:${port}/?seed=7&terrain=1&guided&boxes&look=classic`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.MT && document.querySelector('#loading.gone'), { timeout: 60000 });
  await page.evaluate(() => { document.getElementById('intro-go')?.click(); MT.setSpeed(0); });
  await page.waitForFunction(() => document.querySelector('#lh-level')?.textContent === 'Level 1');
  mkdirSync('scripts/out', { recursive: true });
  const layout = async () => page.evaluate(() => {
    const rect = id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right }; };
    return { brand: rect('brand'), level: rect('level-hud'), clock: rect('clock'), goal: rect('goals'), dock: rect('tools'), text: document.getElementById('lh-chapter').textContent, scroll: document.documentElement.scrollWidth, viewport: innerWidth };
  });
  let r = await layout(); assert.equal(r.text, '0/2'); assert.ok(r.level.width <= 260 && r.goal.y > r.brand.bottom);
  assert.ok(await page.evaluate(() => {
    const level = getComputedStyle(document.getElementById('level-hud')), stats = getComputedStyle(document.getElementById('brand'));
    return level.backgroundColor === stats.backgroundColor && level.borderRadius === stats.borderRadius && level.boxShadow === stats.boxShadow;
  }), 'Level indicator shares the statistics HUD surface, corners, and shadow');
  await page.screenshot({ path: 'scripts/out/progress-hud-desktop.png' });
  await page.evaluate(() => MT.setHour(21));
  await page.waitForFunction(() => document.getElementById('sun').classList.contains('night'), { timeout: 30000 });
  await page.screenshot({ path: 'scripts/out/progress-hud-night.png' });
  await page.evaluate(() => MT.setHour(7));
  await page.waitForFunction(() => !document.getElementById('sun').classList.contains('night'), { timeout: 30000 });
  await page.click('#level-hud'); assert.ok(await page.$('#goals.levels'));
  await page.click('#level-hud');
  await page.evaluate(() => {
    const a = MT.progressCue().cells[0];
    for (const [di, dj] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) { const b = MT.cell(a.i + di * 3, a.j + dj * 3); if (b && b.type === 'empty' && !b.h && MT.drawRoad(a, b)) break; }
  });
  await page.waitForFunction(() => MT.progress().completedGoalIds.includes('first-street'), { timeout: 60000 });
  await page.evaluate(() => { const plot = MT.progressCue().cells[0]; MT.tryPlace('res', [plot]); });
  await page.waitForFunction(() => document.querySelector('#level-up.show'), { timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#level-up .lu-hero img')?.naturalWidth > 0, { timeout: 60000 });
  assert.equal(await page.$eval('#lh-level', e => e.textContent), 'Level 2');
  assert.equal(await page.$eval('#lh-chapter', e => e.textContent), '0/1');
  assert.equal(await page.$eval('#level-up h3', e => e.textContent), 'Bakery');
  await page.screenshot({ path: 'scripts/out/progress-unlock-desktop.png' });
  for (const [width, height] of [[390, 844], [320, 700], [844, 390]]) {
    await page.setViewport({ width, height });
    await page.waitForFunction(() => { const r = document.querySelector('#level-up').getBoundingClientRect(); return r.right <= innerWidth && r.x >= 0 && r.y >= 0 && r.bottom <= innerHeight; });
    r = await layout(); assert.ok(r.brand.right <= r.clock.x + 1, `HUD overlap at ${width}`); assert.ok(r.scroll <= r.viewport, `Horizontal overflow at ${width}`);
    if (height < 540) assert.ok(await page.evaluate(() => document.querySelector('#level-up .lu-build').getBoundingClientRect().bottom <= document.querySelector('#level-up').getBoundingClientRect().bottom - 3), 'Landscape reward action stays visible');
    await page.screenshot({ path: `scripts/out/progress-unlock-${width}.png` });
  }
  await page.setViewport({ width: 1440, height: 900 });
  await page.click('#level-up .lu-build');
  assert.equal(await page.evaluate(() => MT.currentPick()?.kind), 'bakery');
  assert.ok(await page.$('#picker .chip.fresh-unlock'), 'Other earned buildings retain NEW markers');
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluate(() => { MT.progress().completedGoalIds.push('first-household'); });
  // Real evaluation derives the chapter and produces the Level 3 reward, without requiring a long simulated wait.
  await page.waitForFunction(() => document.querySelector('#level-up.show h3')?.textContent === 'Fishing at the quay', { timeout: 60000 });
  assert.equal(await page.$('#level-confetti'), null);
  assert.equal(await page.$eval('#level-up .lu-rays', e => getComputedStyle(e).animationName), 'none');
  await page.screenshot({ path: 'scripts/out/progress-fishing-unlock.png' });
  await page.click('#level-up [data-g=ok]');
  await page.evaluate(() => MT.save());
  await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.MT && document.querySelector('#loading.gone'), { timeout: 60000 });
  assert.equal(await page.$('#level-up'), null, 'Reload does not replay earned celebrations');
  assert.ok(await page.evaluate(() => MT.progress().completedGoalIds.includes('first-household')));
  assert.deepEqual(errors, []);
  console.log('PASS compact HUD, next-level progress, model previews, direct selection, NEW markers, responsive reveal, reduced motion, no page errors');
} finally { await browser?.close(); stop(); }
