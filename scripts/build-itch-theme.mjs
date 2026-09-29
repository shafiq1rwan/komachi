// Makes the itch.io page artwork at itch's own sizes from the existing pictures (a headless browser does the cropping, no
// image library needed): output/itch/theme/cover-630x500.png (the cover, centre crop), banner-960x300.png (the game background
// with the wordmark), background-1920x1080.jpg (the game background, softened so text over it stays readable).
// Run after the pictures exist: node scripts/build-itch-theme.mjs
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const pw = process.env.LOCALAPPDATA ? (() => { try { return readdirSync(process.env.LOCALAPPDATA + '/ms-playwright').filter(d => d.startsWith('chromium-')).sort().reverse().map(d => process.env.LOCALAPPDATA + '/ms-playwright/' + d + '/chrome-win64/chrome.exe'); } catch { return []; } })() : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
if (!executablePath) throw Error('No Chromium browser found');
const data = (f, mime) => `data:${mime};base64,` + readFileSync(f).toString('base64');
const SRC = { cover: data('output/itch/komachi-cover.png', 'image/png'), menu: data('docs/backgrounds/menu-desktop.png', 'image/png'), bg: data('docs/backgrounds/komachi-game-background.png', 'image/png'), mark: data('assets/brand/komachi-wordmark.png', 'image/png') };
const browser = await puppeteer.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  const out = await page.evaluate(async src => {
    const load = s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s; });
    const [cover, menu, bg, mark] = await Promise.all([load(src.cover), load(src.menu), load(src.bg), load(src.mark)]);
    // draw an image to fill a box (centre crop), like CSS background-size: cover
    const fill = (g, img, w, h, fx = 0.5, fy = 0.5) => { const k = Math.max(w / img.width, h / img.height), sw = w / k, sh = h / k; g.drawImage(img, (img.width - sw) * fx, (img.height - sh) * fy, sw, sh, 0, 0, w, h); };
    const make = (w, h, draw, type = 'image/png', q) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; draw(g, w, h); return c.toDataURL(type, q).split(',')[1]; };
    return {
      cover: make(630, 500, (g, w, h) => fill(g, cover, w, h, 0.5, 0.45)),
      banner: make(960, 300, (g, w, h) => {
        fill(g, bg, w, h, 0.7, 0.45);   // the island on the right, room on the left (the clean picture, no menu)
        const grad = g.createLinearGradient(0, 0, w * 0.55, 0); grad.addColorStop(0, 'rgba(251,246,238,.96)'); grad.addColorStop(0.6, 'rgba(251,246,238,.75)'); grad.addColorStop(1, 'rgba(251,246,238,0)'); g.fillStyle = grad; g.fillRect(0, 0, w, h);
        const mw = 300, mh = mw * mark.height / mark.width; g.drawImage(mark, 48, (h - mh) / 2 - 8, mw, mh);
      }),
      background: make(1920, 1080, (g, w, h) => { fill(g, bg, w, h); g.fillStyle = 'rgba(251,246,238,.55)'; g.fillRect(0, 0, w, h); }, 'image/jpeg', 0.82),
    };
  }, SRC);
  mkdirSync('output/itch/theme', { recursive: true });
  writeFileSync('output/itch/theme/cover-630x500.png', Buffer.from(out.cover, 'base64'));
  writeFileSync('output/itch/theme/banner-960x300.png', Buffer.from(out.banner, 'base64'));
  writeFileSync('output/itch/theme/background-1920x1080.jpg', Buffer.from(out.background, 'base64'));
  console.log('written output/itch/theme: cover-630x500.png, banner-960x300.png, background-1920x1080.jpg');
} finally { await browser.close(); }
