// Komachi — the desktop app (Phase 10). One BrowserWindow over the built game in dist/ (run `npm run build` first, or
// `npm run app:build` for an installer). The renderer is the same page as the web build: this file only opens the window,
// remembers its size and place, keeps links inside the game, hands downloads (exported towns, saved photos) to the system's
// save dialog and offers F11 for full screen. KOMACHI_SHOT=<png path> takes a picture of the window once the game has loaded
// and quits, which is how scripts/check-electron.mjs verifies a build without anyone watching.
const { app, BrowserWindow, shell, screen, session } = require('electron');
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { join, dirname } = require('node:path');

const STATE = () => join(app.getPath('userData'), 'window.json');
const readState = () => { try { return JSON.parse(readFileSync(STATE(), 'utf8')); } catch { return null; } };
const writeState = win => { try { if (!win.isMinimized() && !win.isFullScreen()) writeFileSync(STATE(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() })); } catch { /* not important */ } };

function createWindow() {
  const saved = readState(), area = screen.getPrimaryDisplay().workAreaSize;
  const win = new BrowserWindow({
    width: Math.min(saved?.width || 1400, area.width), height: Math.min(saved?.height || 880, area.height), x: saved?.x, y: saved?.y,
    minWidth: 900, minHeight: 600, show: false, autoHideMenuBar: true, backgroundColor: '#dfe9e4', title: 'Komachi',
    icon: join(__dirname, '..', 'public', 'icons', 'icon-256.png'),
    webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false, additionalArguments: ['--komachi-version=' + app.getVersion()] },
  });
  win.removeMenu();
  if (saved?.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('resize', () => writeState(win)); win.on('move', () => writeState(win)); win.on('close', () => writeState(win));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); } });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F12' && !app.isPackaged) win.webContents.toggleDevTools();
  });
  win.loadFile(join(__dirname, '..', 'dist', 'index.html'));
  const shot = process.env.KOMACHI_SHOT;
  if (shot) win.webContents.once('did-finish-load', () => setTimeout(async () => {
    try { const exit = await win.webContents.executeJavaScript('!!document.querySelector("#menu [data-act=exit]") + " v" + (window.komachiApp && window.komachiApp.version)'); console.log('bridge', exit); const img = await win.webContents.capturePage(); mkdirSync(dirname(shot), { recursive: true }); writeFileSync(shot, img.toPNG()); console.log('shot', shot, img.getSize().width + 'x' + img.getSize().height); }
    catch (err) { console.error('shot failed', err); }
    app.quit();
  }, Number(process.env.KOMACHI_SHOT_WAIT || 12000)));
  return win;
}

app.setAppUserModelId('town.komachi.app');
app.whenReady().then(() => {
  // downloads (an exported town, a photo) go to the system's save dialog with the file's own name
  session.defaultSession.on('will-download', (_, item) => { item.setSaveDialogOptions({ title: 'Save', defaultPath: join(app.getPath('downloads'), item.getFilename()) }); });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin' || process.env.KOMACHI_SHOT) app.quit(); });
