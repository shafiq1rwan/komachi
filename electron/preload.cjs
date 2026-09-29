// Komachi — the desktop app's bridge: the page only learns that it runs in the app (the menu then shows Exit) and which
// version and platform. Nothing from Node reaches the page.
const { contextBridge } = require('electron');
const version = (process.argv.find(a => a.startsWith('--komachi-version=')) || '').split('=')[1] || '';   // from main.cjs: a sandboxed preload has no env
contextBridge.exposeInMainWorld('komachiApp', { version, platform: process.platform });
