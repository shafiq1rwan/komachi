/* global MT */
// Fishing integration and responsive screenshots against a running Vite development server.
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';

const local = process.env.LOCALAPPDATA;
const pw = local && existsSync(local + '/ms-playwright') ? readdirSync(local + '/ms-playwright').filter(n => n.startsWith('chromium-')).sort().reverse().map(n => local + '/ms-playwright/' + n + '/chrome-win64/chrome.exe') : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(p => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const base = process.argv[2] || 'http://127.0.0.1:4413';
mkdirSync('scripts/out/fishing', { recursive: true });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1500, height: 950 });
  await page.evaluateOnNewDocument(() => localStorage.setItem('komachi.quality', JSON.stringify({ preset: 'custom', res: 0.8, fps: 30, ao: false, blur: false, msaa: false, shadows: 'off', lights: false, busy: true })));
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}/?demo&seed=7`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.MT && MT.residents.some(r => r.mesh.userData.char), { timeout: 60000 });
  await page.evaluate(async () => {
    const loaded = path => import(performance.getEntriesByType('resource').find(e => new URL(e.name).pathname === path)?.name || path);
    const { claimPierSpot } = await loaded('/src/landmarks.js');
    const { updateFishingGame } = await loaded('/src/minigame-fishing.js');
    const { S } = await loaded('/src/state.js'); const { resize, camera } = await loaded('/src/scene.js');
    window.fishingCamera = camera;
    S.quality.res = 0.8; resize();
    window.tickFishing = updateFishingGame;
    MT.setSpeed(0); MT.setHour(16); MT.setFollow(null);
    const intro = document.getElementById('intro'); if (intro) intro.hidden = true;
    const r = MT.residents.find(r => r.mesh.userData.char), l = claimPierSpot(r);
    r.trip = { landmark: l, held: true, holdUntil: MT.T + 1 };
    r.mesh.position.copy(l.spot.pos); r.mesh.rotation.y = l.face; r.mesh.visible = true;
    MT.equipCharacterProp(r.mesh.userData.char, 'fishing-rod');
    MT.cam.view = MT.cam.tView = 8;
    MT.startFishing();
  });
  assert.equal(await page.$eval('#fish-session', e => e.hidden), false);
  assert.equal(await page.$eval('#hud', e => getComputedStyle(e).display), 'none');
  await page.screenshot({ path: 'scripts/out/fishing/ready.png' });
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => MT.fishingGame.phase), 'cast');
  assert.equal(await page.evaluate(() => import('/src/state.js').then(({ S }) => S.speed)), 0, 'Space must not toggle the town speed');
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.tickFishing(0.05); });
  assert.equal(await page.evaluate(() => MT.fishingGame.phase), 'wait');
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => MT.fishingGame.phase), 'wait', 'Early input leaves the float alone');
  await page.screenshot({ path: 'scripts/out/fishing/wait.png' });
  await page.evaluate(() => { MT.fishingGame.biteAt = 0; window.tickFishing(0.05); });
  assert.equal(await page.$eval('#fish-cue', e => e.hidden), false);
  await page.screenshot({ path: 'scripts/out/fishing/bite.png' });
  await page.keyboard.down('Space');
  assert.equal(await page.evaluate(() => MT.fishingGame.phase === 'fight' && MT.fishingGame.holding), true);
  await page.keyboard.up('Space');
  await page.evaluate(() => {
    Object.assign(MT.fishingGame.fish, { boot: false, name: 'a sea bream', len: 0.14, color: '#d9a0a6', belly: '#f2e3e1', pull: 0.65, work: 5 });
    let down = false;
    for (let i = 0; i < 500 && MT.fishingGame.progress < 0.4; i++) {
      const g = MT.fishingGame;
      if (!down && g.tension < 0.44) { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true })); down = true; }
      if (down && g.tension > 0.64) { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true })); down = false; }
      window.tickFishing(0.05);
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', bubbles: true }));
  });
  await page.screenshot({ path: 'scripts/out/fishing/fight.png' });
  for (const [width, height, name] of [[390, 844, 'mobile'], [667, 375, 'landscape'], [320, 568, 'small']]) {
    await page.setViewport({ width, height });
    await page.waitForFunction(() => {
      const panel = document.getElementById('fishing').getBoundingClientRect(), p = MT.fishingGame.angler.mesh.position.clone().project(window.fishingCamera);
      const x = (p.x + 1) / 2 * innerWidth, y = (1 - p.y) / 2 * innerHeight;
      return innerHeight <= 520 ? x > 15 && x < panel.left - 25 : y > 85 && y < panel.top - 50;
    });
    const layout = await page.evaluate(() => {
      const panel = document.getElementById('fishing').getBoundingClientRect(), header = document.getElementById('fish-session').getBoundingClientRect();
      return { inBounds: panel.left >= 0 && panel.right <= innerWidth && panel.top >= header.bottom && panel.bottom <= innerHeight, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(layout.inBounds, true, `${name}: controls fit below the session header`); assert.equal(layout.overflow, false);
    await page.screenshot({ path: `scripts/out/fishing/${name}.png` });
  }
  await page.setViewport({ width: 1500, height: 950 });
  await page.click('#fish-tap');
  assert.equal(await page.evaluate(() => MT.fishingGame.holding), false);
  await page.keyboard.down('Space');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.equal(await page.evaluate(() => MT.fishingGame.holding), false, 'Focus loss releases the reel');
  await page.keyboard.up('Space');
  const button = await page.$('#fish-tap'), rect = await button.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await page.keyboard.down('Space');
  await page.$eval('#fish-tap', e => e.dispatchEvent(new PointerEvent('pointercancel')));
  assert.equal(await page.evaluate(() => MT.fishingGame.holding), true, 'Cancelling touch must preserve a separate keyboard hold');
  await page.keyboard.up('Space'); await page.mouse.up();
  assert.equal(await page.evaluate(() => MT.fishingGame.holding), false);
  await page.evaluate(() => {
    const before = MT.fishingGame.t; document.body.classList.add('menu-pause'); window.tickFishing(0.5);
    window.pausedFishingCorrectly = MT.fishingGame.t === before && !MT.fishingGame.holding; document.body.classList.remove('menu-pause');
  });
  assert.equal(await page.evaluate(() => window.pausedFishingCorrectly), true);
  await page.evaluate(() => {
    const key = type => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', bubbles: true }));
    let down = false;
    for (let i = 0; i < 2000 && MT.fishingGame.phase === 'fight'; i++) {
      const g = MT.fishingGame;
      if (!down && g.tension < 0.44) { key('keydown'); down = true; }
      if (down && g.tension > 0.64) { key('keyup'); down = false; }
      window.tickFishing(0.05);
    }
    key('keyup');
    for (let i = 0; i < 20; i++) window.tickFishing(0.05);
  });
  assert.equal(await page.evaluate(() => MT.fishingGame.phase), 'show');
  assert.equal(await page.evaluate(() => MT.fishingGame.caught), 1);
  assert.match(await page.$eval('#fish-destination', e => e.textContent), /fish market/);
  await page.evaluate(() => { for (let i = 0; i < 160; i++) window.tickFishing(0.05); });
  assert.equal(await page.evaluate(() => MT.fishingGame.phase), 'show', 'Catch card remains until the next cast');
  assert.equal(await page.evaluate(() => MT.fishingGame.caught), 1, 'Showing the catch cannot count it twice');
  await page.screenshot({ path: 'scripts/out/fishing/catch.png' });
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => MT.fishingGame.phase), 'cast');
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.tickFishing(0.05); MT.fishingGame.biteAt = 0; window.tickFishing(0.05); for (let i = 0; i < 35; i++) window.tickFishing(0.05); });
  assert.equal(await page.evaluate(() => MT.fishingGame.phase), 'settle', 'A missed bite recovers gently');
  await page.evaluate(() => { for (let i = 0; i < 36; i++) window.tickFishing(0.05); MT.fishingGame.biteAt = 0; window.tickFishing(0.05); });
  await page.keyboard.down('Space');
  await page.evaluate(() => { MT.fishingGame.tension = 0.99; window.tickFishing(0.05); });
  await page.keyboard.up('Space');
  assert.equal(await page.evaluate(() => MT.fishingGame.phase), 'settle', 'Over-reeling loses the fish');
  assert.equal(await page.evaluate(() => MT.fishingGame.caught), 1);
  await page.evaluate(() => { for (let i = 0; i < 36; i++) window.tickFishing(0.05); MT.fishingGame.biteAt = 0; window.tickFishing(0.05); });
  await page.keyboard.down('Space');
  await page.evaluate(() => { Object.assign(MT.fishingGame.fish, { boot: true, name: 'an old boot', color: '#5a4634', len: 0.1 }); MT.fishingGame.progress = 0.999; MT.fishingGame.tension = 0.45; window.tickFishing(0.05); });
  await page.keyboard.up('Space');
  assert.equal(await page.evaluate(() => MT.fishingGame.caught), 1, 'A boot must not count as fish');
  assert.match(await page.$eval('#fish-destination', e => e.textContent), /Back it goes/);
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => MT.fishingGame.active), false);
  assert.equal(await page.evaluate(() => document.body.classList.contains('menu-pause')), false, 'Escape leaves fishing without opening the pause menu');
  assert.equal(await page.evaluate(() => MT.cam.tView), 8, 'Leaving restores the previous camera');
  assert.equal(await page.$eval('#fish-session', e => e.hidden), true);
  assert.equal(await page.evaluate(() => MT.residents.find(r => r.trip?.landmark?.kind === 'pier').mesh.userData.char.accessory.getObjectByName('Fishing_Line').visible), true, 'Leaving restores the resident rod');
  assert.deepEqual(errors, []);
  console.log('PASS fishing: cast, bite, hold/release, focus loss, catch, retry, escape, and three small-screen layouts');
} finally { await browser.close(); }
