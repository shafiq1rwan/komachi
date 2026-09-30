/* global MT */
// Records the thirty-second trailer from the built game (npm run build first): node scripts/make-trailer.mjs
// A real Chrome window opens (recording needs the GPU and real time, so not headless), the dense demo town is grown and
// driven through the storyboard in docs/STORE.md with the trailer camera, and the browser's own MediaRecorder writes
// output/trailer/komachi-trailer.mp4 (H.264 + AAC when the browser can record it, else .webm VP9; KOMACHI_TRAILER=webm forces WebM), 1280x720, 30 fps, with the menu loop mixed in and faded at the end. The tab is
// captured whole (Chrome's auto-select flag answers the share prompt), so the title card at the end is the real menu; if tab
// capture is refused the canvas stream is recorded instead and the title card is skipped. No ffmpeg anywhere.
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
const PORT = 4441, ROOT = process.cwd(), W = 1280, H = 720;
const WANT_WEBM = process.env.KOMACHI_TRAILER === 'webm';   // MP4 (H.264 + AAC) when the browser can record it, else WebM
const pw = process.env.LOCALAPPDATA ? (() => { try { return readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter(d => d.startsWith('chromium-')).sort().reverse().map(d => process.env.LOCALAPPDATA + '/ms-playwright/' + d + '/chrome-win64/chrome.exe'); } catch { return []; } })() : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
if (!executablePath) throw Error('No Chromium browser found');
if (!existsSync('dist/index.html')) throw Error('dist/ missing: run npm run build first');
const music = readdirSync('dist/assets').find(f => /^menu.*\.mp3$/.test(f));
const server = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', shell: process.platform === 'win32' });
const stop = () => { if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); else server.kill(); };
process.on('exit', stop);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const up = () => new Promise(res => { const s = net.connect(PORT, '127.0.0.1'); s.on('connect', () => { s.end(); res(true); }); s.on('error', () => res(false)); });
for (let k = 0; k < 60 && !(await up()); k++) await sleep(250);
const browser = await puppeteer.launch({ executablePath, headless: false, defaultViewport: null,
  args: [`--window-size=${W + 16},${H + 88}`, '--autoplay-policy=no-user-gesture-required', '--auto-select-tab-capture-source-by-title=Komachi', '--hide-scrollbars', '--disable-infobars'] });
try {
  const page = (await browser.pages())[0] || await browser.newPage(); await page.setViewport({ width: W, height: H });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto(`http://localhost:${PORT}/?seed=7&demo=dense`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(async () => { for (let k = 0; k < 120 && !(MT.characterAvailable() && MT.serviceReady()); k++) await new Promise(r => setTimeout(r, 250)); });
  await sleep(1500);
  // a grown town on a clear morning; one plot kept empty for the construction shot
  await page.evaluate(() => {
    document.getElementById('intro')?.remove(); MT.setSpeed(0); MT.setWeather('clear', 80); MT.setDay(3, 9.2);
    for (const b of MT.blocks) { if (b.type === 'station') continue; b.stage = MT.DONE; b.renoT = 0; for (const u of b.units) MT.rebuildUnitMesh(u); }
    for (let k = 0; k < 30; k++) MT.fastForward(0.01);
  });
  // start the recording: the whole tab if Chrome lets us, else the canvas; the menu loop on the audio track
  const mode = await page.evaluate(async (music, webm) => {
    let stream, mode = 'tab';
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, width: 1280, height: 720 }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' }); }
    catch { stream = document.getElementById('c').captureStream(30); mode = 'canvas'; }
    try {
      const ac = new AudioContext(), a = new Audio('./assets/' + music); a.loop = true; const src = ac.createMediaElementSource(a), dest = ac.createMediaStreamDestination(), g = ac.createGain();
      g.gain.value = 0.85; src.connect(g).connect(dest); await a.play(); stream.addTrack(dest.stream.getAudioTracks()[0]); window.__music = { a, g, ac };
    } catch (e) { mode += ' no-audio'; }
    const mp4 = !webm && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.640028,mp4a.40.2') ? 'video/mp4;codecs=avc1.640028,mp4a.40.2' : !webm && MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : null;
    const rec = new MediaRecorder(stream, { mimeType: mp4 || 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 8e6 }); const chunks = []; mode += mp4 ? ' mp4' : ' webm';
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; rec.start(500); window.__rec = { rec, chunks, stream, type: rec.mimeType }; return mode;
  }, music, WANT_WEBM);
  console.log('recording:', mode);
  const shot = async (label, ms, fn) => { const info = await page.evaluate(fn); console.log(`${label}${info ? ' ' + JSON.stringify(info) : ''}`); await sleep(ms); };
  // 1. the whole island, morning, a slow turn
  await shot('island', 4000, () => { MT.setSpeed(2); MT.cam.target.set(0.5, 0, 0.5); MT.cam.yaw = MT.cam.tYaw = 0.6; MT.cam.pitch = 0.7; MT.trailer({ view: 34, rate: 0.06, speed: 2 }); });
  // 2. the station plaza at the morning rush
  await shot('station', 4000, () => { MT.setHour(8.3); for (let k = 0; k < 20; k++) MT.fastForward(0.01); const E = MT.STATION.entrance; MT.cam.yaw = MT.cam.tYaw = 0.35; MT.trailer({ view: 6, rate: 0.05, speed: 2, at: { x: E.x, z: E.z - 0.9 }, pitch: 0.62 }); });
  // 3. a shop going up: crew at work on the frame
  await shot('site', 4000, () => {
    MT.setHour(10);
    const roads = MT.cells.filter(c => c.type === 'road' && c.drawn); let b = null;
    for (const r of roads) { for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = MT.cell(r.i + di, r.j + dj), c2 = MT.cell(r.i + di * 2, r.j + dj * 2); if (!c || c.type !== 'empty') continue; const sel = c2 && c2.type === 'empty' && MT.placeable(c2, [c, c2]) ? [c, c2] : [c]; if (!MT.placeable(c, sel)) continue; b = MT.placeBlock('shop', sel); if (b) break; } if (b) break; }
    if (!b) return 'no site';
    for (let k = 0; k < 900 && !(b.stage >= 2 && b.crew.length && b.crew.some(w => w.state === 'working')); k++) MT.fastForward(0.01);
    const u = b.units[0]; MT.cam.yaw = MT.cam.tYaw = 0.5; MT.trailer({ view: 5.5, rate: 0.05, speed: 2, at: { x: u.mesh.position.x, z: u.mesh.position.z }, pitch: 0.6 });
    return { stage: b.stage, crew: b.crew.length };
  });
  // 4. the ferry coming in
  await shot('ferry', 4500, () => { MT.setHour(16.62); for (let k = 0; k < 400 && !(MT.ferry.state === 'arriving' && MT.ferry.t > 0.15); k++) MT.fastForward(0.01); const b = MT.ferry.mesh.position; MT.cam.yaw = MT.cam.tYaw = 0.6; MT.trailer({ view: 10, rate: 0.03, speed: 3, at: { x: b.x, z: b.z - 1.5 }, pitch: 0.62 }); return { state: MT.ferry.state }; });
  // 5. rain: umbrellas and puddles
  await shot('rain', 4000, () => { MT.setHour(14.2); MT.setWeather('rain', 4); for (let k = 0; k < 60; k++) MT.fastForward(0.01); const E = MT.STATION.entrance; MT.cam.yaw = MT.cam.tYaw = 0.9; MT.trailer({ view: 8, rate: 0.05, speed: 2, at: { x: E.x + 1.5, z: E.z + 1.5 }, pitch: 0.62 }); });
  // 6. dusk into night: lamps and windows
  await shot('night', 4000, () => { MT.setWeather('clear', 80); MT.setHour(19.9); for (let k = 0; k < 20; k++) MT.fastForward(0.01); MT.cam.yaw = MT.cam.tYaw = 0.6; MT.trailer({ view: 9, rate: 0.05, speed: 2, at: { x: 0.5, z: 0.5 }, pitch: 0.62 }); });
  // 7. winter: snow on the roofs, the whole island
  await shot('snow', 4500, () => { MT.setDay(20, 11); for (let k = 0; k < 120; k++) MT.fastForward(0.01); MT.cam.yaw = MT.cam.tYaw = 0.6; MT.trailer({ view: 12, rate: 0.04, speed: 2, at: { x: 0.5, z: 0.5 }, pitch: 0.7 }); return { snow: +MT.weather.snow.toFixed(2) }; });
  // 8. pull back to spring, the island whole, music fading
  await shot('pullback', 3500, () => { MT.setDay(2, 15.5); for (let k = 0; k < 120; k++) MT.fastForward(0.01); MT.cam.yaw = MT.cam.tYaw = 0.6; MT.trailer({ view: 30, rate: 0.04, speed: 1, at: { x: 0.5, z: 0.5 }, pitch: 0.7 }); if (window.__music) window.__music.g.gain.linearRampToValueAtTime(0.35, window.__music.ac.currentTime + 3); });
  // 9. the title card: the real menu over the island picture (tab capture only)
  if (mode.startsWith('tab')) await shot('title', 3500, () => { MT.trailer.stop(); document.getElementById('btn-menu').click(); const t = document.querySelector('#menu [data-act="title"]'); if (t) t.click(); if (window.__music) window.__music.g.gain.linearRampToValueAtTime(0, window.__music.ac.currentTime + 3.2); });
  else await shot('fade', 2000, () => { if (window.__music) window.__music.g.gain.linearRampToValueAtTime(0, window.__music.ac.currentTime + 1.8); });
  // stop and save
  const b64 = await page.evaluate(() => new Promise(res => { const { rec, chunks, stream } = window.__rec; rec.onstop = async () => { stream.getTracks().forEach(t => t.stop()); const buf = await new Blob(chunks, { type: rec.mimeType }).arrayBuffer(); const u8 = new Uint8Array(buf); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); res(btoa(s)); }; rec.stop(); }));
  const OUT = 'output/trailer/komachi-trailer.' + (mode.includes('mp4') ? 'mp4' : 'webm');
  mkdirSync('output/trailer', { recursive: true }); const bytes = Buffer.from(b64, 'base64'); writeFileSync(OUT, bytes);
  console.log(`written ${OUT}: ${(bytes.length / 1048576).toFixed(1)} MB`);
} finally { await browser.close(); stop(); }
