/* global MT */
// Fresh portrait gameplay capture, staged only in a disposable browser session.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';

const ffmpeg = process.argv[2];
if (!ffmpeg || !existsSync(ffmpeg)) throw Error('Pass the FFmpeg executable.');
const out = 'output/trailer/fresh-short/_source'; mkdirSync(out, { recursive: true });
const local = process.env.LOCALAPPDATA;
const pw = local && existsSync(local + '/ms-playwright') ? readdirSync(local + '/ms-playwright').filter(n => n.startsWith('chromium-')).sort().reverse().map(n => local + '/ms-playwright/' + n + '/chrome-win64/chrome.exe') : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--enable-gpu', '--hide-scrollbars'] });
let encoder;
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });
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
  await page.goto('http://127.0.0.1:4414/?demo=dense&seed=19', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.MT && MT.residents.some(r => r.mesh.userData.char), { polling: 100, timeout: 60000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const { claimPierSpot } = await import('/src/landmarks.js');
    const { updateCharacters } = await import('/src/characters.js'); window.animateAnglers = updateCharacters;
    MT.setSpeed(0); MT.setFollow(null); MT.setWeather('clear', 100); MT.setDay(3, 16.5);
    for (const id of ['intro', 'loading', 'milestone', 'toast']) document.getElementById(id)?.remove();
    for (const b of MT.blocks) { if (b.type === 'station') continue; b.stage = MT.DONE; b.renoT = 0; for (const u of b.units) MT.rebuildUnitMesh(u); }
    for (let k = 0; k < 30; k++) MT.fastForward(.01);
    const r = MT.residents.find(r => r.mesh.userData.char), l = claimPierSpot(r), P = MT.pierFrame();
    const head = P.spots.find(s => Math.abs(s.a - (P.len - .1)) < .01 && Math.abs(s.s) < .01);
    if (head) { l.spot.by = null; l.spot = head; l.face = head.face; head.by = r; }
    r.trip = { landmark: l, held: true, holdUntil: MT.T + 10 };
    r.mesh.position.copy(l.spot.pos); r.mesh.rotation.y = l.face; r.mesh.visible = true;
    MT.equipCharacterProp(r.mesh.userData.char, 'fishing-rod');
    MT.cam.yaw = MT.cam.tYaw = P.ang - .5; MT.cam.pitch = .62; MT.cam.view = MT.cam.tView = 4.5;
    MT.startFishing(); document.getElementById('fish-tap').blur();
    const style = document.createElement('style'); style.textContent = `
      #fish-session{top:360px!important;left:70px!important;right:150px!important}
      #fishing{bottom:290px!important;width:620px!important;padding:22px 28px!important;gap:14px!important;border-radius:26px!important}
      #fish-message{font-size:26px!important}#fish-sub{font-size:18px!important}#fish-tap{font-size:23px!important;min-height:62px!important}
      #fishing .fish-heading,#fishing .fm-zones,#fishing small{font-size:16px!important}#fish-result strong{font-size:26px!important}
      #promo-copy{position:fixed;z-index:35;top:150px;left:70px;right:160px;color:#fff8e8;pointer-events:none;text-shadow:0 3px 8px #12312e,0 0 35px #12312e}
      #promo-copy small{display:block;font-size:25px;letter-spacing:4px;font-weight:900;color:#d5e9b3;margin-bottom:20px}
      #promo-copy b{font-size:72px;line-height:1.06;letter-spacing:-2px;font-weight:900;display:block}
      #promo-vignette{position:fixed;z-index:28;inset:0;pointer-events:none;background:linear-gradient(180deg,rgba(8,29,30,.8),transparent 35%,transparent 72%,rgba(8,29,30,.5))}
      #promo-brand{position:fixed;z-index:35;left:70px;bottom:220px;color:#fff8e8;font-size:23px;font-weight:800;letter-spacing:3px;text-shadow:0 2px 8px #12312e}
      #promo-end{position:fixed;inset:0;z-index:40;background:rgba(13,38,38,.83);display:none;flex-direction:column;justify-content:center;align-items:center;color:#fff8e8;text-align:center;padding:80px 140px 240px 70px;gap:45px}
      #promo-end .logo{background:#fff6e6;padding:32px;border-radius:26px;width:100%}#promo-end img{width:100%}#promo-end small{font-size:26px;letter-spacing:5px;font-weight:900;color:#d5e9b3}#promo-end b{font-size:60px;line-height:1.15}#promo-end span{font-size:35px;line-height:1.5}#promo-end em{font-style:normal;background:#c6dea6;color:#153c32;border-radius:22px;padding:25px 30px;font-size:34px;font-weight:900}
    `; document.head.append(style);
    const vignette = document.createElement('div'); vignette.id = 'promo-vignette'; document.body.append(vignette);
    const copy = document.createElement('div'); copy.id = 'promo-copy'; copy.innerHTML = '<small>KOMACHI · COSY TOWN BUILDER</small><b>Build a town.<br>Take a fishing break.</b>'; document.body.append(copy);
    const brand = document.createElement('div'); brand.id = 'promo-brand'; brand.textContent = 'ACTUAL GAMEPLAY · SAISS'; document.body.append(brand);
    const end = document.createElement('div'); end.id = 'promo-end'; end.innerHTML = '<small>YOUR NEXT LITTLE ESCAPE</small><div class="logo"><img src="/assets/brand/komachi-wordmark.png" alt="Komachi"></div><b>Build. Fish.<br>Stay awhile.</b><span>A cosy Japanese town<br>to call your own.</span><em>PLAY · CHANNEL PROFILE LINK</em>'; document.body.append(end); await end.querySelector('img').decode();
    window.videoEvents = []; window.reelDown = false; window.waitScheduled = false; window.fishChosen = false;
    for (let i = 0; i < 90; i++) { window.animateAnglers(1 / 30); window.advanceVideo(1000 / 30); }
  });
  await page.screenshot({ path: `${out}/preflight.jpg`, type: 'jpeg', quality: 92 });
  encoder = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', '30', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', `${out}/fresh-gameplay-raw.mp4`], { stdio: ['pipe', 'ignore', 'pipe'] });
  let encodingError = ''; encoder.stderr.on('data', b => { encodingError += b.toString(); });
  const completed = once(encoder, 'close');
  for (let frame = 0; frame < 900; frame++) {
    const state = await page.evaluate(frame => {
      const sec = frame / 30, g = MT.fishingGame;
      const key = type => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', bubbles: true }));
      const event = kind => window.videoEvents.push({ kind, time: sec });
      const copy = document.querySelector('#promo-copy b');
      if (frame === 45) { key('keydown'); key('keyup'); event('cast'); }
      if (sec < 14) {
        if (g.phase === 'wait' && !window.waitScheduled) { g.biteAt = 1.1; window.waitScheduled = true; }
        if (g.phase === 'bite' && !window.videoEvents.some(e => e.kind === 'bite')) event('bite');
        if (g.phase === 'bite' && g.t >= .35) { key('keydown'); window.reelDown = true; event('hook'); }
        if (g.phase === 'fight') {
          if (!window.fishChosen) { Object.assign(g.fish, { name: 'a horse mackerel', boot: false, flat: false, pull: .36, work: 3.4, len: .105, color: '#5f8fa3', belly: '#d9e4e6' }); window.fishChosen = true; }
          if (!window.reelDown && g.tension < .43) { key('keydown'); window.reelDown = true; }
          if (window.reelDown && g.tension > .68) { key('keyup'); window.reelDown = false; }
        }
        if (g.phase === 'catch' && !window.videoEvents.some(e => e.kind === 'catch')) { key('keyup'); window.reelDown = false; event('catch'); }
        if (sec >= 2) copy.innerHTML = g.caught > 0 ? 'Your little<br>victory.' : ['cast', 'wait'].includes(g.phase) ? 'Cast a line.<br>Take your time.' : g.phase === 'bite' ? 'Something<br>just bit!' : 'Hold. Release.<br>Reel it in.';
        window.animateAnglers(1 / 30);
      }
      if (frame === 420) {
        if (!window.videoEvents.some(e => e.kind === 'catch')) throw Error('No fish landed before scene change');
        MT.stopFishing(); MT.setDay(3, 10); MT.setWeather('clear', 100);
        const roads = MT.cells.filter(c => c.type === 'road' && c.drawn); let b = null;
        for (const r of roads) { for (const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const c = MT.cell(r.i + di,r.j + dj); if (!c || c.type !== 'empty' || !MT.placeable(c,[c])) continue; b = MT.placeBlock('home',[c]); if (b) break; } if (b) break; }
        if (!b) throw Error('No free construction plot');
        for (let k = 0; k < 900 && !(b.stage >= 2 && b.crew.length); k++) MT.fastForward(.01);
        const u = b.units[0]; MT.cam.yaw = MT.cam.tYaw = -.4;
        MT.trailer({ view: 5, rate: -.05, speed: 2, at: { x: u.mesh.position.x, z: u.mesh.position.z }, pitch: .64 });
        copy.innerHTML = 'Build your<br>quiet corner.'; event('construction');
      }
      if (frame === 540) {
        MT.setHour(8.4); const E = MT.STATION.entrance; MT.cam.yaw = MT.cam.tYaw = -.3;
        MT.trailer({ view: 6, rate: .045, speed: 2, at: { x: E.x, z: E.z - .6 }, pitch: .62 });
        copy.innerHTML = 'Watch everyday<br>life unfold.'; event('station');
      }
      if (frame === 660) {
        MT.setHour(20.3); MT.cam.yaw = MT.cam.tYaw = .9;
        MT.trailer({ view: 9, rate: -.035, speed: 1, at: { x: .5, z: .5 }, pitch: .68 });
        copy.innerHTML = 'Let the world<br>slow down.'; event('night');
      }
      if (frame === 780) {
        MT.trailer({ view: 24, rate: .035, speed: 1, at: { x: .5, z: .5 }, pitch: .7 });
        document.getElementById('promo-end').style.display = 'flex'; event('endcard');
      }
      window.advanceVideo(1000 / 30);
      return { phase: g.phase, caught: g.caught };
    }, frame);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 92, captureBeyondViewport: false });
    if (!encoder.stdin.write(jpg)) await once(encoder.stdin, 'drain');
    if (frame % 60 === 0) console.log(`${frame / 30}s: ${state.phase}, caught=${state.caught}`);
  }
  encoder.stdin.end(); const [code] = await completed;
  if (code !== 0) throw Error(encodingError);
  if (errors.length) throw Error(errors.join('\n'));
  const events = await page.evaluate(() => window.videoEvents);
  writeFileSync(`${out}/recording.json`, JSON.stringify({ width: 1080, height: 1920, fps: 30, frames: 900, duration: 30, seed: 19, events, source: 'Fresh native portrait gameplay captured from current source, with temporary staging and promotional overlays.' }, null, 2));
  console.log('Finished fresh portrait capture:', JSON.stringify(events));
} finally { if (encoder && encoder.exitCode === null) encoder.kill(); await browser.close(); }
