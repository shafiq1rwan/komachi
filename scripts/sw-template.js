// Komachi's service worker, written into dist/ by the build (the `offline` plugin in vite.config.js fills in the version
// and the file list). It keeps the whole game in the cache so the installed app plays offline:
// - the page itself is fetched fresh when there is a network (so an update shows on the next launch), the cached copy otherwise;
// - every other file of the build has a content hash in its name, so the cached copy is always right;
// - the Nunito font from Google Fonts is kept in its own cache after its first load.
const VERSION = '__VERSION__', CACHE = 'komachi-' + VERSION, FONTS = 'komachi-fonts';
const FILES = __FILES__;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('komachi-') && k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {   // the page, with any ?demo / ?seed= query: network first, the cached page offline
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); } return res; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  if (url.origin === location.origin) {   // the build's files: cache first
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })));
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {   // the font: the cached copy at once, refreshed behind it
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
  }
});
