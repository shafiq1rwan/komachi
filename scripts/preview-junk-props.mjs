// Render both sides of the live procedural fishing props for visual review.
import { createServer } from 'vite';
import puppeteer from 'puppeteer-core';
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
const local = process.env.LOCALAPPDATA;
const pw = local && existsSync(local + '/ms-playwright') ? readdirSync(local + '/ms-playwright').filter(n => n.startsWith('chromium-')).sort().reverse().map(n => local + '/ms-playwright/' + n + '/chrome-win64/chrome.exe') : [];
const executablePath = [process.env.BROWSER_PATH, ...pw, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
const server = await createServer({ server: { open: false, port: 4195, strictPort: true } }); await server.listen();
let browser;
try {
  browser = await puppeteer.launch({ executablePath, headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setViewport({ width: 1200, height: 760 });
  await page.goto('http://localhost:4195/docs/junk-props-preview.html', { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.junkPropsPreview);
  mkdirSync('docs/props/junk', { recursive: true });
  await page.screenshot({ path: 'docs/props/junk/collection.png' });
  await page.evaluate(() => { const p = window.junkPropsPreview; p.props.forEach(root => { root.rotation.y += Math.PI; }); p.render(); });
  await page.screenshot({ path: 'docs/props/junk/reverse.png' });
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Rendered old boot and rusty tin can from both sides.');
} finally { await browser?.close(); await server.close(); }
