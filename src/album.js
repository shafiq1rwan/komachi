// Komachi — the album: the photographs taken in photo mode (src/photo.js), one record per picture, kept in IndexedDB
// (`komachi-album`, store `photos`, indexed by town) because a JPEG is far too big to sit in localStorage beside the saves.
// Each record: { id, town (the slot id, 'scratch' in test tabs), takenAt, day, hour, season, weather, caption, w, h, data }
// where `data` is the JPEG as a data URL. Imports nothing. When IndexedDB is unavailable (a private window, a blocked origin)
// the album lives in memory for the session, so nothing here ever throws at the caller.
const DB = 'komachi-album', STORE = 'photos';
let dbP = null;
const mem = [];   // the fallback album

function openDb() {
  if (dbP) return dbP;
  dbP = new Promise(res => {
    if (import.meta.env.MODE === 'demo') { res(null); return; }   // the web demo keeps its photos in memory for the session
    let req; try { req = indexedDB.open(DB, 1); } catch { res(null); return; }
    req.onupgradeneeded = () => { const s = req.result.createObjectStore(STORE, { keyPath: 'id' }); s.createIndex('town', 'town'); };
    req.onsuccess = () => { const db = req.result; db.onversionchange = () => db.close(); res(db); };
    req.onerror = () => res(null); req.onblocked = () => res(null);
  });
  return dbP;
}
/** one transaction: `fn(store)` returns a request (or nothing); resolves with its result once the transaction completes */
function run(mode, fn) {
  return openDb().then(db => new Promise((res, rej) => {
    if (!db) { res(undefined); return; }
    const t = db.transaction(STORE, mode), req = fn(t.objectStore(STORE));
    t.oncomplete = () => res(req ? req.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  }));
}
const byNewest = list => list.sort((a, b) => b.takenAt - a.takenAt);

/** keep a photo; resolves with the record, or rejects when the browser refused (quota) */
export async function addPhoto(p) {
  const db = await openDb();
  if (!db) { mem.unshift(p); return p; }
  await run('readwrite', s => s.put(p)); return p;
}
/** every photo of a town, newest first (an empty list when the store cannot be read) */
export async function listPhotos(town) {
  try { const db = await openDb(); if (!db) return byNewest(mem.filter(p => p.town === town)); return byNewest((await run('readonly', s => s.index('town').getAll(town))) || []); }
  catch { return []; }
}
export async function countPhotos(town) {
  try { const db = await openDb(); if (!db) return mem.filter(p => p.town === town).length; return (await run('readonly', s => s.index('town').count(town))) || 0; }
  catch { return 0; }
}
export async function updatePhoto(id, patch) {
  try {
    const db = await openDb();
    if (!db) { const p = mem.find(x => x.id === id); if (p) Object.assign(p, patch); return !!p; }
    const p = await run('readonly', s => s.get(id)); if (!p) return false;
    await run('readwrite', s => s.put({ ...p, ...patch })); return true;
  } catch { return false; }
}
export async function deletePhoto(id) {
  try { const db = await openDb(); if (!db) { const i = mem.findIndex(x => x.id === id); if (i >= 0) mem.splice(i, 1); return; } await run('readwrite', s => s.delete(id)); }
  catch { /* nothing to do */ }
}
/** a town was deleted: its photos go with it */
export async function deleteTownPhotos(town) {
  try {
    const db = await openDb();
    if (!db) { for (let i = mem.length - 1; i >= 0; i--) if (mem[i].town === town) mem.splice(i, 1); return; }
    const keys = (await run('readonly', s => s.index('town').getAllKeys(town))) || [];
    if (keys.length) await run('readwrite', s => { for (const k of keys) s.delete(k); });
  } catch { /* nothing to do */ }
}
