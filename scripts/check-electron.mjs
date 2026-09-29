// Runs the desktop app once over dist/ (npm run build first), lets it take a picture of its own window after the game has
// loaded (KOMACHI_SHOT in electron/main.cjs) and checks the picture is there and not blank: node scripts/check-electron.mjs
// Output: scripts/out/electron.png. Exit code 1 when the app did not start, did not write the picture or drew only one colour.
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const electron = require('electron');   // in Node this resolves to the binary's path
const OUT = 'scripts/out/electron.png';
mkdirSync('scripts/out', { recursive: true }); if (existsSync(OUT)) unlinkSync(OUT);
if (!existsSync('dist/index.html')) { console.error('FAIL  dist/ missing: run npm run build first'); process.exit(1); }
const t0 = Date.now();
const env = { ...process.env, KOMACHI_SHOT: OUT, KOMACHI_SHOT_WAIT: process.env.KOMACHI_SHOT_WAIT || '14000', ELECTRON_ENABLE_LOGGING: '1' };
delete env.ELECTRON_RUN_AS_NODE;   // set by editors that run on Electron themselves (VS Code): it would make the app run as plain Node
const child = spawn(electron, ['.'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; child.stdout.on('data', d => { log += d; }); child.stderr.on('data', d => { log += d; });
const timer = setTimeout(() => { console.error('FAIL  the app did not quit within 60 s'); child.kill(); process.exit(1); }, 60000);
child.on('exit', code => {
  clearTimeout(timer);
  const lines = log.split(/\r?\n/).filter(l => /shot|bridge|error|Error|FAIL/i.test(l) && !/DevTools|Autofill/.test(l));
  if (!existsSync(OUT)) { console.error('FAIL  no picture written (exit ' + code + ')\n' + lines.join('\n')); process.exit(1); }
  const png = readFileSync(OUT);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  // a blank window compresses to almost nothing; a drawn island runs to hundreds of kilobytes
  const ok = w >= 800 && h >= 500 && png.length > 60000;
  console.log(`${ok ? 'PASS' : 'FAIL'}  desktop app drew the game: ${w}x${h}, ${Math.round(png.length / 1024)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} s, exit ${code}`);
  if (lines.length) console.log(lines.join('\n'));
  process.exit(ok ? 0 : 1);
});
