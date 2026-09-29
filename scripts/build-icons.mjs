// Builds the favicon set from assets/brand/komachi-icon.png with a headless browser (no image library needed):
// public/icons/favicon-16.png, favicon-32.png, favicon-48.png, icon-256.png and public/favicon.ico (PNG entries at 16, 32,
// 48 and 256, the set Windows and Electron's BrowserWindow icon expect). Run: node scripts/build-icons.mjs
// macOS wants an .icns for the app bundle: electron-builder makes one from icon-512.png when that phase comes.
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const pw = process.env.LOCALAPPDATA ? (() => { try { return readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter(d => d.startsWith('chromium-')).sort().reverse().map(d => process.env.LOCALAPPDATA + '/ms-playwright/' + d + '/chrome-win64/chrome.exe'); } catch { return []; } })() : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
if (!executablePath) throw Error('No Chromium browser found');
const SIZES = [16, 32, 48, 256];
const src = 'data:image/png;base64,' + readFileSync('assets/brand/komachi-icon.png').toString('base64');
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  const pngs = await page.evaluate(async (src, sizes) => {
    const img = new Image(); img.src = src; await img.decode();
    return sizes.map(n => {   // step down in halves for the small ones, so the edges stay smooth
      let c = document.createElement('canvas'), w = img.width; c.width = c.height = w; c.getContext('2d').drawImage(img, 0, 0, w, w);
      while (w / 2 >= n) { w /= 2; const d = document.createElement('canvas'); d.width = d.height = w; d.getContext('2d').drawImage(c, 0, 0, w, w); c = d; }
      const o = document.createElement('canvas'); o.width = o.height = n; const g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, n, n);
      return o.toDataURL('image/png').split(',')[1];
    });
  }, src, SIZES);
  mkdirSync('public/icons', { recursive: true });
  const bufs = pngs.map(b => Buffer.from(b, 'base64'));
  SIZES.forEach((n, k) => writeFileSync(n === 256 ? 'public/icons/icon-256.png' : `public/icons/favicon-${n}.png`, bufs[k]));
  // .ico: a 6-byte header, one 16-byte entry per image, then the PNGs themselves
  const head = Buffer.alloc(6); head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(SIZES.length, 4);
  const entries = [], parts = []; let off = 6 + 16 * SIZES.length;
  SIZES.forEach((n, k) => { const e = Buffer.alloc(16); e.writeUInt8(n === 256 ? 0 : n, 0); e.writeUInt8(n === 256 ? 0 : n, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(bufs[k].length, 8); e.writeUInt32LE(off, 12); entries.push(e); parts.push(bufs[k]); off += bufs[k].length; });
  writeFileSync('public/favicon.ico', Buffer.concat([head, ...entries, ...parts]));
  console.log('icons written:', SIZES.map((n, k) => `${n}px ${bufs[k].length} B`).join(', '), '+ favicon.ico');
} finally { await browser.close(); }
