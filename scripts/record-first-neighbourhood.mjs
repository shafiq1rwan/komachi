/* global MT */
// Fresh portrait build walkthrough. Temporary browser state only; no game changes.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';

const ffmpeg = process.argv[2], out = 'output/trailer/first-neighbourhood/_source';
if (!ffmpeg || !existsSync(ffmpeg)) throw Error('Pass the FFmpeg executable.');
mkdirSync(out, { recursive: true });
const local = process.env.LOCALAPPDATA;
const pw = local && existsSync(local + '/ms-playwright') ? readdirSync(local + '/ms-playwright').filter(n => n.startsWith('chromium-')).sort().reverse().map(n => local + '/ms-playwright/' + n + '/chrome-win64/chrome.exe') : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--enable-gpu', '--hide-scrollbars'] });
let encoder;
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1080, height: 1920 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem('komachi.quality', JSON.stringify({ preset: 'custom', res: 1, fps: 60, ao: true, aoHalf: true, blur: false, msaa: true, shadows: 'low', lights: true, busy: true }));
    localStorage.setItem('komachi.audio', JSON.stringify({ effects: false, on: false, volume: 0 }));
    let now = 0, serial = 0; const callbacks = new Map();
    Object.defineProperty(performance, 'now', { value: () => now });
    window.requestAnimationFrame = fn => { callbacks.set(++serial, fn); return serial; };
    window.cancelAnimationFrame = id => callbacks.delete(id);
    window.advanceVideo = ms => { now += ms; const pending = [...callbacks.values()]; callbacks.clear(); for (const fn of pending) fn(now); };
  });
  await page.goto('http://127.0.0.1:4414/?new&seed=7', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.MT && MT.characterAvailable() && MT.serviceReady(), { polling: 100, timeout: 60000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Close only this isolated session's opening overlays.
    MT.stopOpening(); MT.setFollow(null); MT.setSpeed(0); MT.setWeather('clear', 200); MT.setDay(1, 7);
    MT.weather.cover = MT.weather.tCover; MT.weather.rain = 0;
    for (const id of ['menu', 'intro', 'loading', 'milestone', 'toast', 'guide']) document.getElementById(id)?.remove();
    document.body.classList.remove('menu-full', 'menu-pause');
    MT.cam.target.set(-2.5, 0, 4.2); MT.cam.yaw = MT.cam.tYaw = .7;
    MT.trailer({ view: 12, rate: 0, speed: 0, pitch: .7 });
    const style = document.createElement('style'); style.textContent = `
      #build-copy{position:fixed;z-index:35;top:150px;left:70px;right:150px;color:#fff8e8;pointer-events:none;text-shadow:0 3px 8px #173a31,0 0 30px #173a31}
      #build-copy small{display:block;font-size:25px;letter-spacing:4px;font-weight:900;color:#d5e9b3;margin-bottom:20px}
      #build-copy b{font-size:70px;line-height:1.08;letter-spacing:-1.8px;font-weight:900;display:block}
      #build-note{position:fixed;z-index:35;left:70px;right:150px;bottom:280px;color:#fff8e8;font-size:35px;font-weight:800;text-shadow:0 3px 12px #12312e}
      #build-vignette{position:fixed;z-index:28;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(8,29,30,.7),transparent 35%,transparent 72%,rgba(8,29,30,.6))}
      #build-brand{position:fixed;z-index:35;left:70px;bottom:220px;color:#d8e8d1;font-size:22px;font-weight:800;letter-spacing:3px;text-shadow:0 2px 8px #12312e}
      #build-marker{position:fixed;z-index:32;width:70px;height:70px;border-radius:50%;border:5px solid #fff7e5;background:rgba(191,226,151,.3);box-shadow:0 0 0 8px rgba(29,65,50,.3);transform:translate(-50%,-50%);pointer-events:none;display:none}
      #build-end{position:fixed;inset:0;z-index:40;background:rgba(13,38,38,.85);display:none;flex-direction:column;justify-content:center;align-items:center;color:#fff8e8;text-align:center;padding:80px 145px 240px 70px;gap:45px}
      #build-end .logo{background:#fff6e6;padding:32px;border-radius:26px;width:100%}#build-end img{width:100%}#build-end small{font-size:26px;letter-spacing:5px;font-weight:900;color:#d5e9b3}#build-end b{font-size:62px;line-height:1.15}#build-end span{font-size:35px;line-height:1.5}#build-end em{font-style:normal;background:#c6dea6;color:#153c32;border-radius:22px;padding:25px 30px;font-size:34px;font-weight:900}
    `; document.head.append(style);
    for (const [id, html] of [
      ['build-vignette', ''],
      ['build-copy', '<small>KOMACHI · COSY TOWN BUILDER</small><b>Build your first<br>little neighbourhood.</b>'],
      ['build-note', 'It starts with one street.'],
      ['build-brand', 'ACTUAL GAMEPLAY · SAISS'],
      ['build-marker', ''],
      ['build-end', '<small>A LITTLE TOWN, MADE BY YOU</small><div class="logo"><img src="/assets/brand/komachi-wordmark.png" alt="Komachi"></div><b>What would you<br>build next?</b><span>Start your own neighbourhood.</span><em>PLAY · CHANNEL PROFILE LINK</em>'],
    ]) { const d = document.createElement('div'); d.id = id; d.innerHTML = html; document.body.append(d); }
    await document.querySelector('#build-end img').decode();
    window.buildEvents = []; window.firstBlocks = [];
    window.markCell = (i, j) => { const p = MT.project(i, j, .1), e = document.getElementById('build-marker'); e.style.left = p.x + 'px'; e.style.top = p.y + 'px'; e.style.display = 'block'; };
    window.placeFirst = (type, i, j, options) => {
      const c = MT.cell(i, j);
      if (!MT.placeable(c, [c])) throw Error(`Invalid ${type} plot ${i},${j}`);
      const b = MT.placeBlock(type, [c], options); if (!b) throw Error('Placement failed');
      window.firstBlocks.push(b); window.markCell(i, j);
      return b;
    };
    for (let i = 0; i < 60; i++) window.advanceVideo(1000 / 30);
  });
  await page.screenshot({ path: `${out}/preflight.jpg`, type: 'jpeg', quality: 92 });
  encoder = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', '30', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', `${out}/neighbourhood-raw.mp4`], { stdio: ['pipe', 'ignore', 'pipe'] });
  let encodingError = ''; encoder.stderr.on('data', b => { encodingError += b.toString(); });
  const completed = once(encoder, 'close');
  for (let frame = 0; frame < 900; frame++) {
    const state = await page.evaluate(frame => {
      const copy = document.querySelector('#build-copy b'), note = document.getElementById('build-note');
      const event = kind => window.buildEvents.push({ kind, time: frame / 30 });
      if (frame === 60) { copy.innerHTML = '1. Draw a street.'; note.textContent = 'Connect it to the station.'; event('street'); }
      if (frame >= 60 && frame <= 120 && frame % 12 === 0) {
        const j = 23 + (frame - 60) / 12;
        if (!MT.drawRoad(MT.cell(17, 22), MT.cell(17, j))) throw Error('Street drawing failed');
        window.markCell(17, j);
      }
      if (frame === 150) { copy.innerHTML = '2. Add a few homes.'; note.textContent = 'Place them beside the street.'; window.placeFirst('res', 18, 23); event('home-1'); }
      if (frame === 180) { window.placeFirst('res', 18, 24); event('home-2'); }
      if (frame === 210) { window.placeFirst('res', 16, 24); event('home-3'); }
      if (frame === 240) { copy.innerHTML = '3. Make room<br>for everyday life.'; note.textContent = 'A shop. A place to work.'; window.placeFirst('shop', 18, 26, { kind: 'grocery', picked: true }); event('shop'); }
      if (frame === 270) { window.placeFirst('work', 16, 26); event('work'); }
      if (frame === 300) {
        document.getElementById('build-marker').style.display = 'none';
        copy.innerHTML = 'The builders<br>take it from here.'; note.textContent = 'CONSTRUCTION TIME-LAPSE'; event('construction');
        MT.trailer({ view: 10, rate: .025, speed: 0, at: { x: -2.5, z: 4.5 }, pitch: .66 });
      }
      if (frame >= 300 && frame < 540) MT.fastForward(.18);
      if (frame === 540) {
        for (let k = 0; k < 600 && window.firstBlocks.some(b => b.stage < MT.DONE); k++) MT.fastForward(.1);
        if (window.firstBlocks.some(b => b.stage < MT.DONE)) throw Error('Neighbourhood did not finish building');
        MT.setHour(10); MT.setWeather('clear', 100); MT.weather.cover = MT.weather.tCover;
        MT.trailer({ view: 9, rate: -.025, speed: 2, at: { x: -2.5, z: 4.5 }, pitch: .65 });
        copy.innerHTML = 'Your neighbourhood<br>comes alive.'; note.textContent = 'Residents arrive. Daily life begins.'; event('residents');
      }
      if (frame === 690) {
        MT.setHour(20.3); MT.cam.yaw = MT.cam.tYaw = .8;
        MT.trailer({ view: 10, rate: .025, speed: 1, at: { x: -2.5, z: 4.5 }, pitch: .68 });
        copy.innerHTML = 'A little place<br>to call your own.'; note.textContent = 'From an empty street to a home.'; event('night');
      }
      if (frame === 810) {
        for (const id of ['build-copy', 'build-note', 'build-brand']) document.getElementById(id).style.display = 'none';
        document.getElementById('build-end').style.display = 'flex'; event('endcard');
      }
      window.advanceVideo(1000 / 30);
      return { stages: window.firstBlocks.map(b => b.stage), residents: MT.residents.length };
    }, frame);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 92, captureBeyondViewport: false });
    if (!encoder.stdin.write(jpg)) await once(encoder.stdin, 'drain');
    if (frame % 60 === 0) console.log(`${frame / 30}s: stages=${state.stages.join(',')}, residents=${state.residents}`);
  }
  encoder.stdin.end(); const [code] = await completed; if (code !== 0) throw Error(encodingError);
  if (errors.length) throw Error(errors.join('\n'));
  const result = await page.evaluate(() => ({ events: window.buildEvents, buildings: window.firstBlocks.map(b => ({ type: b.type, stage: b.stage, name: b.name })), residents: MT.residents.length }));
  if (result.residents < 1) throw Error('No residents moved in');
  writeFileSync(`${out}/recording.json`, JSON.stringify({ width: 1080, height: 1920, duration: 30, fps: 30, frames: 900, seed: 7, source: 'Fresh portrait gameplay on a new island. Real placement and simulation; construction compressed with fastForward.', ...result }, null, 2));
  console.log('Completed fresh neighbourhood:', JSON.stringify(result));
} finally { if (encoder && encoder.exitCode === null) encoder.kill(); await browser.close(); }
