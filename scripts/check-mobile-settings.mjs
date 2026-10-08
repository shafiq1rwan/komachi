// Verify the in-game pause/settings route with touch input, not the title-screen settings page.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const pwDir = process.env.LOCALAPPDATA + '/ms-playwright';
const pw = existsSync(pwDir) ? readdirSync(pwDir).filter(d => d.startsWith('chromium-')).sort().reverse().map(d => `${pwDir}/${d}/chrome-win64/chrome.exe`) : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium'].find(p => p && existsSync(p));
assert.ok(executablePath, 'A Chromium browser is required');
const baseline = process.argv.includes('--baseline'), poki = process.argv.includes('--poki'), port = 4190;
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', ...(poki ? ['--outDir', 'dist-poki'] : []), '--port', String(port), '--strictPort'], { stdio: 'ignore', shell: process.platform === 'win32' });
let browser;
try {
  for (let k = 0; k < 60; k++) { try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch { /* starting */ } await new Promise(r => setTimeout(r, 250)); }
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  // This checks settings layout and touch navigation; a live commercial break must not hold Resume open in the test.
  if (poki) {
    await page.setRequestInterception(true);
    page.on('request', r => r.url() === 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js'
      ? r.respond({ status: 200, contentType: 'application/javascript', body: 'window.PokiSDK={init:()=>Promise.resolve(),gameLoadingFinished(){},gameplayStart(){},gameplayStop(){},commercialBreak:()=>Promise.resolve()};' })
      : r.continue());
  }
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`http://localhost:${port}/?seed=7&guided&boxes&look=classic`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForFunction(() => window.MT && document.querySelector('#loading.gone'), { timeout: 60000 });
  await page.evaluate(() => { document.getElementById('intro-go')?.click(); MT.setSpeed(1); });
  mkdirSync('scripts/out', { recursive: true });
  for (const [width, height] of [[390, 844], [320, 568], [844, 390], [568, 320]]) {
    await page.setViewport({ width, height, isMobile: true, hasTouch: true });
    await page.tap('#btn-menu'); await page.tap('#menu [data-act=settings]');
    await page.waitForSelector('#menu.pause[data-screen=settings] #options.in-menu');
    const bounds = () => page.evaluate(() => {
      const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; };
      const back = document.querySelector('#menu [data-act=back]'), r = back.getBoundingClientRect();
      return { card: rect(document.querySelector('#menu .mm-side')), back: rect(back), tapWorks: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('[data-act=back]') === back, width: innerWidth, height: innerHeight };
    });
    const r = await bounds(); console.log(`${poki ? 'Poki' : 'Standard'} ${width}×${height}`, JSON.stringify(r));
    await page.screenshot({ path: `scripts/out/settings-${baseline ? 'before-' : ''}${poki ? 'poki-' : ''}${width}.png` });
    if (!baseline) {
      assert.equal(r.width, width, 'Settings do not widen the mobile viewport');
      assert.ok(r.card.x >= 0 && r.card.right <= r.width && r.card.y >= 0 && r.card.bottom <= r.height, 'Pause settings card fits inside the viewport');
      assert.ok(r.tapWorks && r.back.y >= 0 && r.back.bottom <= r.height, 'Back is visible and can receive touch input');
      await page.$eval('#opt-effects', e => e.scrollIntoView({ block: 'nearest' }));
      const effects = await page.evaluate(() => MT.audioState().effects);
      await page.tap('#opt-effects'); assert.notEqual(await page.evaluate(() => MT.audioState().effects), effects, 'Settings can be changed by touch');
      await page.tap('#opt-effects');
      await page.$eval('#options', e => { e.scrollTop = e.scrollHeight; });
      assert.ok((await bounds()).tapWorks, 'Back remains reachable after scrolling to the last settings');
      const last = await page.$eval('#opt-mode', e => { const r = e.getBoundingClientRect(), p = e.closest('#options').getBoundingClientRect(); return r.top >= p.top && r.bottom <= p.bottom + 1; });
      assert.ok(last, 'The last settings row is reachable');
      await page.screenshot({ path: `scripts/out/settings-${poki ? 'poki-' : ''}${width}-scrolled.png` });
      await page.tap('#menu [data-act=back]');
      await page.waitForSelector('#menu.pause[data-screen=main]');
      const pausedAt = await page.evaluate(() => MT.T);
      await page.tap('#menu [data-act=resume]');
      await page.waitForFunction(at => !document.querySelector('#menu.show') && MT.T > at, { timeout: 15000 }, pausedAt);
    } else {
      await page.$eval('#menu .mm-side', e => { e.scrollTop = e.scrollHeight; });
      console.log('After outer scroll', JSON.stringify(await bounds()));
      await page.screenshot({ path: `scripts/out/settings-before-${width}-scrolled.png` });
      await page.evaluate(() => { document.querySelector('#menu [data-act=back]').click(); document.querySelector('#menu [data-act=resume]').click(); });
    }
  }
  assert.deepEqual(errors, []); console.log(baseline ? 'Baseline captured.' : 'PASS mobile in-game settings fit, scroll, touch Back, and resume.');
} finally {
  await browser?.close();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill();
}
