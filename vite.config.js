import { defineConfig } from 'vite';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

/** every file under a folder, as paths relative to it with forward slashes */
const walk = (dir, root = dir) => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p, root) : [relative(root, p).split('\\').join('/')]; });

// Offline play for the installed app: after the bundle is written, a service worker listing every file of the build (plus the
// manifest and icons from public/) is added as dist/sw.js, versioned by a hash of those names (they carry content hashes).
function offline() {
  return {
    name: 'komachi-offline',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = [...Object.keys(bundle), ...walk('public')].filter(f => !f.endsWith('.map') && f !== 'sw.js' && !/\.(mp3|ogg)$/i.test(f)).sort();   // music is cached as it plays, not up front
      const version = createHash('sha1').update(files.join('\n')).digest('hex').slice(0, 10);
      const list = ['./', ...files.map(f => './' + f)];
      const source = readFileSync('scripts/sw-template.js', 'utf8').replace('__VERSION__', version).replace('__FILES__', JSON.stringify(list, null, 1));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// The Poki build puts Poki's SDK in the page head and calls init() at once, before the game bundle, which is how Poki's QA tool
// detects it (src/poki.js then waits on window.__pokiInit). The other builds get no SDK.
function pokiHtml() {
  return {
    name: 'komachi-poki-html',
    transformIndexHtml: () => [
      { tag: 'script', attrs: { src: 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js' }, injectTo: 'head-prepend' },
      { tag: 'script', children: 'window.__pokiInit = (window.PokiSDK ? PokiSDK.init() : Promise.reject(new Error("no SDK"))).then(function () { return true; }, function () { return false; });', injectTo: 'head' },
    ],
  };
}

// `base: './'` makes the build work from any sub-path (GitHub Pages project sites, file hosting).
export default defineConfig(({ mode }) => ({
  base: './',
  assetsInclude: ['**/*.glb'],
  plugins: mode === 'poki' ? [pokiHtml()] : mode === 'demo' ? [] : [offline()],   // Poki forbids a service worker; the poki and demo builds have none
  build: {
    outDir: mode === 'poki' ? 'dist-poki' : mode === 'demo' ? 'dist-demo' : 'dist',
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        // keep the (large, rarely changing) Three.js library in its own cacheable chunk
        manualChunks: { three: ['three'] },
      },
    },
  },
  // no `server.open` here: every script that starts Vite programmatically (previews, checks, scratch renders) inherited it and popped
  // a browser window; `npm run dev` passes --open itself (2026-10-06)
}));
