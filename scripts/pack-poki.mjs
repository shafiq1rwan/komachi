// Zips the Poki build (npm run build:poki first) into output/poki/komachi-poki.zip with index.html at the archive's root, as
// Poki's upload form expects, and prints what went in. Run: npm run pack:poki
// The zip is written here, not by PowerShell's Compress-Archive: that tool stores folder paths with backslashes, which Poki's
// Linux servers read as part of the file name, so everything under assets/ came back 404 (2026-10-01). Entries use forward
// slashes and deflate, and the script re-reads the archive's directory afterwards to prove it.
// Also packs the web demo: node scripts/pack-poki.mjs dist-demo output/demo/komachi-demo.zip (npm run pack:demo).
import { existsSync, mkdirSync, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { join } from 'node:path';
const dist = process.argv[2] || 'dist-poki', out = process.argv[3] || 'output/poki/komachi-poki.zip';
if (!existsSync(dist + '/index.html')) { console.error(dist + '/ missing: run the matching build first'); process.exit(1); }
if (existsSync(dist + '/sw.js')) { console.error(dist + '/sw.js must not exist: this build has no service worker'); process.exit(1); }
mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(dist).sort();

// a plain zip writer: local header + deflated data per file, then the central directory
const CRC = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; }
const crc32 = buf => { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const d = new Date(), dosTime = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, dosDate = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
const parts = [], central = []; let offset = 0, total = 0;
for (const f of files) {
  const name = Buffer.from(f.replace(/\\/g, '/').replace(new RegExp('^' + dist + '/'), ''), 'utf8');   // forward slashes, relative to the root
  const data = readFileSync(f), packed = deflateRawSync(data, { level: 9 }), crc = crc32(data); total += data.length;
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(8, 8);
  local.writeUInt16LE(dosTime, 10); local.writeUInt16LE(dosDate, 12); local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
  const cd = Buffer.alloc(46); cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6); cd.writeUInt16LE(0x0800, 8); cd.writeUInt16LE(8, 10);
  cd.writeUInt16LE(dosTime, 12); cd.writeUInt16LE(dosDate, 14); cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(packed.length, 20); cd.writeUInt32LE(data.length, 24); cd.writeUInt16LE(name.length, 28);
  cd.writeUInt16LE(0, 30); cd.writeUInt16LE(0, 32); cd.writeUInt16LE(0, 34); cd.writeUInt16LE(0, 36); cd.writeUInt32LE(0, 38); cd.writeUInt32LE(offset, 42);
  parts.push(local, name, packed); central.push(cd, name); offset += local.length + name.length + packed.length;
}
const cdBuf = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(0, 4); end.writeUInt16LE(0, 6); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16); end.writeUInt16LE(0, 20);
writeFileSync(out, Buffer.concat([...parts, cdBuf, end]));

// prove the directory: every name uses forward slashes and index.html sits at the root
const zip = readFileSync(out); const names = []; let p = zip.readUInt32LE(zip.length - 6);
for (let k = 0; k < files.length; k++) { const n = zip.readUInt16LE(p + 28), x = zip.readUInt16LE(p + 30), c = zip.readUInt16LE(p + 32); names.push(zip.toString('utf8', p + 46, p + 46 + n)); p += 46 + n + x + c; }
const bad = names.filter(n => n.includes('\\') || n.startsWith('/'));
if (bad.length || !names.includes('index.html') || !names.some(n => n.startsWith('assets/'))) { console.error('zip entries look wrong:', bad.length ? bad.slice(0, 3) : names.slice(0, 5)); process.exit(1); }
console.log(`${out}: ${(zip.length / 1048576).toFixed(1)} MB zipped from ${files.length} files, ${(total / 1048576).toFixed(1)} MB unpacked; entries ok (index.html at the root, ${names.filter(n => n.startsWith('assets/')).length} under assets/)`);
const big = files.map(f => [f, statSync(f).size]).sort((a, b) => b[1] - a[1]).slice(0, 4);
console.log('largest:', big.map(([f, s]) => `${f.replace(/\\/g, '/').replace(dist + '/', '')} ${(s / 1048576).toFixed(1)} MB`).join(', '));
