/* global MT */
// Capture real gameplay and the HTML HUD at a controlled 30 fps, without changing game source.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:4413';
const ffmpeg = process.argv[3];
if (!ffmpeg || !existsSync(ffmpeg)) throw Error('Pass the FFmpeg executable as the second argument.');
const out = 'output/trailer/fishing-update'; mkdirSync(out, { recursive: true });
const local = process.env.LOCALAPPDATA;
const pw = local && existsSync(local + '/ms-playwright') ? readdirSync(local + '/ms-playwright').filter(n => n.startsWith('chromium-')).sort().reverse().map(n => local + '/ms-playwright/' + n + '/chrome-win64/chrome.exe') : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p => p && existsSync(p));
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--enable-gpu', '--hide-scrollbars'] });
let encoder;
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 720 });
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
  await page.goto(`${base}/?demo&seed=7`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.MT && MT.residents.some(r => r.mesh.userData.char), { polling: 100, timeout: 60000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    const loaded = path => import(performance.getEntriesByType('resource').find(e => new URL(e.name).pathname === path)?.name || path);
    const { claimPierSpot } = await loaded('/src/landmarks.js');
    const { updateCharacters } = await loaded('/src/characters.js'); window.animateAnglers = updateCharacters;
    MT.setSpeed(0); MT.setFollow(null); MT.setWeather('clear', 100); MT.setDay(3, 15.8);
    for (const id of ['intro', 'loading', 'milestone', 'toast']) document.getElementById(id)?.remove();
    const r = MT.residents.find(r => r.mesh.userData.char), l = claimPierSpot(r), P = MT.pierFrame();
    const head = P.spots.find(s => Math.abs(s.a - (P.len - 0.1)) < 0.01 && Math.abs(s.s) < 0.01);
    if (head) { l.spot.by = null; l.spot = head; l.face = head.face; head.by = r; }
    r.trip = { landmark: l, held: true, holdUntil: MT.T + 10 };
    r.mesh.position.copy(l.spot.pos); r.mesh.rotation.y = l.face; r.mesh.visible = true;
    MT.equipCharacterProp(r.mesh.userData.char, 'fishing-rod');
    MT.cam.yaw = MT.cam.tYaw = P.ang - 0.65; MT.cam.pitch = 0.62; MT.cam.view = MT.cam.tView = 4.5;
    MT.startFishing(); document.getElementById('fish-tap').blur();
    for (let i = 0; i < 90; i++) { window.animateAnglers(1 / 30); window.advanceVideo(1000 / 30); }
    const style = document.createElement('style'); style.textContent = `
      #promo-copy{position:fixed;z-index:30;top:92px;left:50%;transform:translateX(-50%);text-align:center;pointer-events:none;color:#fff9ee;text-shadow:0 2px 14px #173638,0 1px 3px #173638}
      #promo-copy small{display:block;font-size:11px;font-weight:900;letter-spacing:3px;margin-bottom:8px}
      #promo-copy b{font-size:32px;font-weight:900;letter-spacing:-.5px;line-height:1.2}
      #promo-end{position:fixed;inset:0;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:rgba(17,43,44,.79);color:#fff7e8;text-align:center;opacity:0;pointer-events:none}
      #promo-end img{width:350px;max-height:180px;object-fit:contain}#promo-end small{font-size:12px;letter-spacing:4px;font-weight:800}#promo-end b{font-size:34px;letter-spacing:-.5px}#promo-end span{font-size:15px;color:#d9e4d7}
      #promo-end i{width:44px;height:3px;background:#a9c790;border-radius:3px}
    `; document.head.append(style);
    const copy = document.createElement('div'); copy.id = 'promo-copy'; copy.innerHTML = '<small>KOMACHI · FISHING UPDATE</small><b>Fishing, refined.</b>'; document.body.append(copy);
    const end = document.createElement('div'); end.id = 'promo-end'; end.innerHTML = '<small>THE FISHING UPDATE</small><img src="/assets/brand/komachi-wordmark.png" alt="Komachi"><i></i><b>Cast. Reel. Take your time.</b><span>A little more life at the quay.</span>'; document.body.append(end);
    await end.querySelector('img').decode();
    window.videoEvents = []; window.reelDown = false; window.waitScheduled = false; window.fishChosen = false;
  });
  await page.screenshot({ path: `${out}/preflight.png` });
  encoder = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'png', '-framerate', '30', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-y', `${out}/fishing-gameplay-raw.mp4`], { stdio: ['pipe', 'ignore', 'pipe'] });
  let encodingError = ''; encoder.stderr.on('data', b => { encodingError += b.toString(); });
  const completed = once(encoder, 'close');
  for (let frame = 0; frame < 600; frame++) {
    const state = await page.evaluate(frame => {
      const sec = frame / 30, g = MT.fishingGame;
      const key = type => window.dispatchEvent(new KeyboardEvent(type, { code: 'Space', bubbles: true }));
      const event = kind => window.videoEvents.push({ kind, time: sec });
      if (frame === 36) { key('keydown'); key('keyup'); event('cast'); }
      if (g.phase === 'wait' && !window.waitScheduled) { g.biteAt = 2; window.waitScheduled = true; }
      if (g.phase === 'bite' && !window.videoEvents.some(e => e.kind === 'bite')) event('bite');
      if (g.phase === 'bite' && g.t >= 0.5) { key('keydown'); window.reelDown = true; event('hook'); }
      if (g.phase === 'fight') {
        if (!window.fishChosen) { Object.assign(g.fish, { name: 'a sea bream', boot: false, flat: false, pull: 0.65, work: 5, len: 0.14, color: '#d9a0a6', belly: '#f2e3e1' }); window.fishChosen = true; }
        if (!window.reelDown && g.tension < 0.43) { key('keydown'); window.reelDown = true; }
        if (window.reelDown && g.tension > 0.68) { key('keyup'); window.reelDown = false; }
      }
      if (g.phase === 'catch' && !window.videoEvents.some(e => e.kind === 'catch')) { key('keyup'); window.reelDown = false; event('catch'); }
      const copy = document.getElementById('promo-copy');
      copy.querySelector('b').textContent = sec < 2.3 ? 'Fishing, refined.' : ['cast', 'wait'].includes(g.phase) ? 'Wait for the dip.' : g.phase === 'bite' ? 'Something’s on the line.' : g.phase === 'fight' ? 'Hold. Release. Find your rhythm.' : 'A little victory at the quay.';
      copy.style.opacity = sec < 18.1 ? '1' : '0';
      document.getElementById('promo-end').style.opacity = Math.max(0, Math.min(1, (sec - 18.1) / 0.5)).toFixed(3);
      window.animateAnglers(1 / 30); window.advanceVideo(1000 / 30);
      return { phase: g.phase, progress: Math.round(g.progress * 100), caught: g.caught };
    }, frame);
    const png = await page.screenshot({ type: 'png', captureBeyondViewport: false });
    if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
    if (frame % 60 === 0) console.log(`${frame / 30}s: ${state.phase}, ${state.progress}% reeled in`);
  }
  encoder.stdin.end(); const [code] = await completed;
  if (code !== 0) throw Error(encodingError);
  const events = await page.evaluate(() => window.videoEvents);
  if (!events.some(e => e.kind === 'catch')) throw Error('Recording did not include a landed fish.');
  if (errors.length) throw Error(errors.join('\n'));
  writeFileSync(`${out}/recording.json`, JSON.stringify({ width: 1280, height: 720, fps: 30, frames: 600, duration: 20, events, source: 'Actual Komachi gameplay and HUD, staged in a temporary browser session.' }, null, 2));
  console.log('Captured 600 frames. Events:', JSON.stringify(events));
} finally { if (encoder && encoder.exitCode === null) encoder.kill(); await browser.close(); }
