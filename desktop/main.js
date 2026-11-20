'use strict';
// JustGameBox desktop app (Electron) — the Steam build.
//
// Local mode (default): the game server (../server.js, the same one the website runs) starts as
// a child process (Electron utilityProcess) on this PC, listening on 0.0.0.0, and the window shows
// its title screen at http://127.0.0.1:<port>/. Phones on the same Wi-Fi join through the PC's
// LAN address (the QR codes show http://<lan-ip>:<port>/j/CODE).
// Online mode: the window opens a hosted JustGameBox server instead (its URL is a setting), so
// friends anywhere join over the internet. If it can't be reached, the app falls back to local.
//
// Saves (profiles, JustGold) go to <userData>/saves via DATA_DIR, so they survive updates;
// Steam Cloud can sync that folder. App settings: <userData>/settings.json (settings-store.js).
// Keys: F11 or Alt+Enter fullscreen · F10 or Ctrl+, app settings · (dev only) F12 dev tools.
const { app, BrowserWindow, Menu, ipcMain, shell, dialog, utilityProcess, net: enet } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

const DEV = !app.isPackaged;
// Automated tests only (tools/e2e-desktop.js): never show any window or dialog on screen.
const HIDDEN = process.env.JGB_TEST_HIDDEN === '1';
// Tests and portable setups can move the whole profile (saves + settings + browser storage).
if (process.env.JGB_USER_DATA) app.setPath('userData', path.resolve(process.env.JGB_USER_DATA));
const SERVER_DIR = DEV ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'server');
const USER = app.getPath('userData');
const DATA_DIR = path.join(USER, 'saves');
const LOG_DIR = path.join(USER, 'logs');
// The repo's my-music/ tracks are not shipped in release builds unless the build bundled them
// (scripts/stage-server.js, JGB_BUNDLE_MUSIC=1): players put their own songs in <userData>/my-music.
const MUSIC_BUNDLED = DEV || fs.existsSync(path.join(SERVER_DIR, '.music-bundled'));
const MUSIC_DIR = MUSIC_BUNDLED ? path.join(SERVER_DIR, 'my-music') : path.join(USER, 'my-music');
const BG = '#170f38';

const lan = require(path.join(SERVER_DIR, 'lan.js'));
const steam = require('./steam');
const store = require('./settings-store').createStore(USER);

let win = null, settingsWin = null, server = null, quitting = false;
const stopped = new WeakSet(); // servers we stopped on purpose (no crash restart)
const run = { mode: null, origin: null, port: null, address: null, joinBase: null, notice: null, lastError: null, restarts: 0 };

// ---------- logging ----------
fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, 'app.log');
try { if (fs.statSync(LOG_FILE).size > 2e6) fs.renameSync(LOG_FILE, LOG_FILE + '.old'); } catch { /* first run */ }
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
function log(...a) {
  const line = `[${new Date().toISOString()}] ${a.join(' ')}`;
  try { logStream.write(line.replace(/\s+$/, '') + '\n'); } catch { /* closed */ }
  if (DEV) console.log(line);
}

// ---------- single instance ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); if (!HIDDEN) { win.show(); win.focus(); } } });
  boot();
}

function boot() {
  // Music and the narrator start without a click (a TV app has nobody to click first).
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
  const settings = store.get();
  steam.init({ dev: DEV, overlay: settings.steamOverlay });
  log('JustGameBox', app.getVersion(), DEV ? '(dev)' : '', 'electron', process.versions.electron, '| steam:', steam.info().status, '| userData:', USER);
  Menu.setApplicationMenu(null); // no menu bar (and no menu shortcuts like reload / dev tools)

  app.whenReady().then(async () => {
    createWindow(settings);
    await start({ startup: true });
    if (!store.get().firstRunDone && run.mode === 'local') { store.set({ firstRunDone: true }); setTimeout(() => openSettings('phones'), 1500); }
  });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { quitting = true; stopServer(); });
  app.on('will-quit', () => { try { logStream.end(); } catch { /* closed */ } });
}

// ---------- the window ----------
function createWindow(settings) {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 960, minHeight: 540, show: false, backgroundColor: BG,
    title: 'JustGameBox', fullscreen: settings.fullscreen && !HIDDEN, autoHideMenuBar: true,
    icon: fs.existsSync(path.join(__dirname, 'build', 'icon.png')) ? path.join(__dirname, 'build', 'icon.png') : undefined,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: DEV, spellcheck: false, backgroundThrottling: !HIDDEN },
  });
  win.loadFile(path.join(__dirname, 'ui', 'loading.html'));
  win.once('ready-to-show', () => { if (!HIDDEN) win.show(); });
  win.on('enter-full-screen', () => store.set({ fullscreen: true }));
  win.on('leave-full-screen', () => store.set({ fullscreen: false }));
  win.on('closed', () => { win = null; });
  guardContents(win.webContents);
  win.webContents.on('did-finish-load', () => injectDesktopButton(win.webContents));
  win.webContents.on('render-process-gone', (_e, d) => { log('renderer gone:', d.reason); if (!quitting && d.reason !== 'clean-exit') setTimeout(() => reloadGame(), 500); });
}

function keys(wc) {
  wc.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const k = input.key;
    if (k === 'F11' || (input.alt && k === 'Enter')) { e.preventDefault(); if (win) win.setFullScreen(!win.isFullScreen()); }
    else if (k === 'F10' || (input.control && k === ',')) { e.preventDefault(); openSettings(); }
    else if (DEV && (k === 'F12' || (input.control && input.shift && k.toLowerCase() === 'i'))) { e.preventDefault(); wc.toggleDevTools(); }
    else if (DEV && input.control && k.toLowerCase() === 'r') { e.preventDefault(); wc.reload(); }
  });
}

// Game pages may only navigate inside the game server's own site. Links elsewhere open in the
// player's browser; same-site pop-ups (the Judge console) open as app windows.
function guardContents(wc) {
  keys(wc);
  wc.on('will-navigate', (e, url) => {
    let u; try { u = new URL(url); } catch { e.preventDefault(); return; }
    if (run.origin && u.origin === run.origin && u.pathname.startsWith('/__desktop/')) {
      e.preventDefault();
      openSettings(u.searchParams.get('tab') || '');
      return;
    }
    if (run.origin && u.origin === run.origin) return;
    e.preventDefault();
    if (/^https?:$/.test(u.protocol)) shell.openExternal(url);
  });
  wc.setWindowOpenHandler(({ url }) => {
    let u; try { u = new URL(url); } catch { return { action: 'deny' }; }
    if (run.origin && u.origin === run.origin && !u.pathname.startsWith('/__desktop/')) {
      return { action: 'allow', overrideBrowserWindowOptions: { show: !HIDDEN, autoHideMenuBar: true, backgroundColor: BG, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: DEV } } };
    }
    if (/^https?:$/.test(u.protocol)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('did-create-window', (child) => guardContents(child.webContents));
}

// The title screen's ⚙ menu gets an "App settings" button (only inside the app).
function injectDesktopButton(wc) {
  let u; try { u = new URL(wc.getURL()); } catch { return; }
  if (!run.origin || u.origin !== run.origin || (u.pathname !== '/' && u.pathname !== '/index.html')) return;
  const label = run.mode === 'online' ? '🖥️ App settings (online server)' : '🖥️ App settings · phones can’t join?';
  wc.executeJavaScript(`(() => {
    const m = document.getElementById('gear-menu');
    if (!m || document.getElementById('jgb-desktop')) return;
    const b = document.createElement('button'); b.id = 'jgb-desktop'; b.textContent = ${JSON.stringify(label)};
    b.addEventListener('click', () => { location.href = '/__desktop/settings'; });
    const s = document.createElement('small'); s.textContent = 'Network, online mode, fullscreen (F11). Shortcut: F10.';
    m.append(document.createElement('hr'), b, s);
  })();`).catch(() => {});
}

function showLoading(message) {
  if (!win) return;
  const q = { msg: message || '' };
  win.loadFile(path.join(__dirname, 'ui', 'loading.html'), { query: q }).catch(() => {});
}
function loadGame(origin) {
  run.origin = origin;
  if (win) win.loadURL(origin + '/').catch((e) => log('load failed:', e.message));
}
function reloadGame() { if (win && run.origin) loadGame(run.origin); }

// ---------- local server ----------
function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, '0.0.0.0', () => s.close(() => resolve(true)));
  });
}
function randomFreePort() {
  return new Promise((resolve) => { const s = net.createServer(); s.listen(0, '0.0.0.0', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
}
async function pickPort(preferred) {
  for (let p = preferred; p < preferred + 10 && p <= 65535; p++) if (await portFree(p)) return p;
  return randomFreePort();
}

async function chooseAddress(settings) {
  const list = lan.lanAddresses();
  if (settings.adapter && list.some((a) => a.address === settings.adapter)) return settings.adapter;
  return lan.bestLanAddressAsync();
}

function seedMusicFolder() {
  if (MUSIC_BUNDLED) return;
  try {
    if (fs.existsSync(MUSIC_DIR)) return;
    const src = path.join(SERVER_DIR, 'my-music');
    const copyDirs = (from, to) => {
      fs.mkdirSync(to, { recursive: true });
      for (const e of fs.readdirSync(from, { withFileTypes: true })) {
        if (e.isDirectory()) copyDirs(path.join(from, e.name), path.join(to, e.name));
        else if (e.name === 'README.md') fs.copyFileSync(path.join(from, e.name), path.join(to, e.name));
      }
    };
    if (fs.existsSync(src)) copyDirs(src, MUSIC_DIR); else fs.mkdirSync(MUSIC_DIR, { recursive: true });
  } catch (e) { log('music folder:', e.message); }
}

function startServer(port, joinBase) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    seedMusicFolder();
    const env = { ...process.env, PORT: String(port), HOST: '0.0.0.0', PUBLIC_URL: joinBase, DATA_DIR, MUSIC_DIR, NODE_ENV: 'production', JGB_DESKTOP: '1' };
    for (const k of ['ELECTRON_RUN_AS_NODE', 'RENDER_EXTERNAL_URL', 'MT_PROFILE_STORE', 'MT_DEV_GRANTS']) delete env[k];
    const child = utilityProcess.fork(path.join(SERVER_DIR, 'server.js'), [], { cwd: SERVER_DIR, env, stdio: 'pipe', serviceName: 'JustGameBox server' });
    let ready = false;
    const out = (b) => log('[server]', String(b));
    child.stdout && child.stdout.on('data', out);
    child.stderr && child.stderr.on('data', out);
    const timer = setTimeout(() => { if (!ready) { child.kill(); reject(new Error('The game server did not start in time.')); } }, 30000);
    child.on('message', (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.type === 'listening' && !ready) { ready = true; clearTimeout(timer); resolve(child); }
      else if (m.type === 'achievement') steam.unlock(m.id);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      log('[server] exited with code', code);
      if (!ready) return reject(new Error('The game server stopped while starting (code ' + code + '). See the log: ' + LOG_FILE));
      if (server === child) server = null;
      if (stopped.has(child)) return;
      // A crash mid-party: start it again on the same port and reload the title screen.
      if (!quitting && run.mode === 'local' && run.restarts < 3) { run.restarts++; startLocal().catch((e) => fail(e)); }
    });
  });
}

function stopServer() {
  if (!server) return;
  const s = server; server = null; stopped.add(s);
  try { s.kill(); } catch { /* already gone */ }
}

async function startLocal() {
  const settings = store.get();
  stopServer();
  const port = await pickPort(settings.port);
  if (port !== settings.port) log(`port ${settings.port} is busy; using ${port} this time`);
  const address = await chooseAddress(settings);
  const joinBase = `http://${address}:${port}`;
  server = await startServer(port, joinBase);
  Object.assign(run, { mode: 'local', port, address, joinBase });
  log('local server on', joinBase);
  loadGame(`http://127.0.0.1:${port}`);
}

// ---------- online server ----------
function normalizeUrl(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;
  let u; try { u = new URL(s); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || !u.hostname || u.username || u.password) return null;
  return u.origin;
}
// Free hosts (Render's free plan) sleep and take up to a minute to wake: wait that long.
async function checkOnline(raw, timeoutMs = 75000) {
  const origin = normalizeUrl(raw);
  if (!origin) return { ok: false, error: 'That is not a web address. Example: https://my-party-server.example.com' };
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await enet.fetch(origin + '/healthz', { signal: ctl.signal, cache: 'no-store' });
    const txt = (await r.text()).trim();
    if (!r.ok || txt !== 'ok') return { ok: false, url: origin, error: `${origin} answered, but it doesn't look like a JustGameBox server.` };
    return { ok: true, url: origin };
  } catch (e) {
    return { ok: false, url: origin, error: `Couldn't reach ${origin} (${e.name === 'AbortError' ? 'no answer in time' : e.message}).` };
  } finally { clearTimeout(t); }
}

// ---------- start / switch modes ----------
async function start({ startup = false } = {}) {
  const settings = store.get();
  run.notice = null; run.lastError = null; run.restarts = 0;
  if (settings.mode === 'online') {
    showLoading('Connecting to the online server… (a sleeping free server can take a minute to wake up)');
    const r = await checkOnline(settings.onlineUrl);
    if (r.ok) {
      stopServer();
      Object.assign(run, { mode: 'online', port: null, address: null, joinBase: r.url });
      log('online mode:', r.url);
      loadGame(r.url);
      return { ok: true };
    }
    run.notice = r.error + ' Playing on this PC (local mode) instead.';
    log('online mode failed:', r.error);
    if (startup && win && !HIDDEN) dialog.showMessageBox(win, { type: 'warning', title: 'Online server unreachable', message: 'Couldn’t reach the online server', detail: run.notice + '\n\nChange it in App settings (F10).' }).catch(() => {});
  }
  showLoading('Starting the game server…');
  try { await startLocal(); return { ok: true, notice: run.notice }; } catch (e) { fail(e); return { ok: false, error: e.message }; }
}

function fail(e) {
  run.lastError = e.message;
  log('error:', e.stack || e.message);
  showLoading('Something went wrong: ' + e.message + '  —  press F10 for settings, or restart the app.');
}

// ---------- settings window ----------
function openSettings(tab) {
  if (settingsWin) { if (!HIDDEN) settingsWin.focus(); return; }
  settingsWin = new BrowserWindow({
    parent: win || undefined, modal: !!win && !HIDDEN, width: 820, height: 760, minWidth: 560, minHeight: 480, show: false,
    backgroundColor: BG, title: 'JustGameBox — App settings', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload-settings.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, devTools: DEV, backgroundThrottling: !HIDDEN },
  });
  settingsWin.loadFile(path.join(__dirname, 'ui', 'settings.html'), { query: { tab: tab || '' } });
  settingsWin.once('ready-to-show', () => settingsWin && !HIDDEN && settingsWin.show());
  settingsWin.on('closed', () => { settingsWin = null; if (win && !HIDDEN) win.focus(); });
  const wc = settingsWin.webContents;
  keys(wc);
  wc.on('will-navigate', (e) => e.preventDefault());
  wc.setWindowOpenHandler(({ url }) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

function state() {
  const settings = store.get();
  return {
    settings, version: app.getVersion(), dev: DEV, platform: process.platform,
    mode: run.mode, origin: run.origin, port: run.port, address: run.address, joinBase: run.joinBase,
    joinUrl: run.joinBase ? run.joinBase + '/join' : null,
    adapters: lan.lanAddresses().map(({ name, address, virtual }) => ({ name, address, virtual })),
    notice: run.notice, lastError: run.lastError, steam: steam.info(),
    dataDir: DATA_DIR, musicDir: MUSIC_DIR, logFile: LOG_FILE,
  };
}

const fromSettings = (e) => !!settingsWin && e.sender === settingsWin.webContents;
ipcMain.handle('jgb:state', (e) => (fromSettings(e) ? state() : null));
ipcMain.handle('jgb:test-url', async (e, url) => (fromSettings(e) ? checkOnline(url, 75000) : null));
ipcMain.handle('jgb:save', async (e, patch) => {
  if (!fromSettings(e) || !patch || typeof patch !== 'object') return null;
  const prev = store.get();
  const next = require('./settings-store').sanitize({ ...prev, ...patch });
  if (next.mode === 'online') {
    const r = await checkOnline(next.onlineUrl);
    if (!r.ok) return { ok: false, error: r.error, state: state() };
    next.onlineUrl = r.url;
  }
  store.set(next);
  if (win && !HIDDEN && next.fullscreen !== win.isFullScreen()) win.setFullScreen(next.fullscreen);
  const modeChanged = next.mode !== run.mode || (next.mode === 'online' && next.onlineUrl !== run.origin);
  if (modeChanged || (next.mode === 'local' && next.port !== prev.port)) {
    const r = await start();
    return { ...r, state: state() };
  }
  if (next.mode === 'local' && next.adapter !== prev.adapter && server) {
    // Only the join link changes: tell the running server, then redraw the title screen.
    const address = await chooseAddress(next);
    run.address = address; run.joinBase = `http://${address}:${run.port}`;
    server.postMessage({ type: 'setBaseUrl', url: run.joinBase });
    reloadGame();
  }
  const steamNote = next.steamOverlay !== prev.steamOverlay ? 'The Steam overlay setting applies after a restart.' : null;
  return { ok: true, notice: steamNote, state: state() };
});
ipcMain.handle('jgb:open', async (e, what) => {
  if (!fromSettings(e)) return false;
  if (what === 'saves') { fs.mkdirSync(DATA_DIR, { recursive: true }); return !(await shell.openPath(DATA_DIR)); }
  if (what === 'music') { seedMusicFolder(); fs.mkdirSync(MUSIC_DIR, { recursive: true }); return !(await shell.openPath(MUSIC_DIR)); }
  if (what === 'logs') return !(await shell.openPath(LOG_DIR));
  if (what === 'firewall' && process.platform === 'win32') {
    // Opens Windows' "Allow an app through Windows Firewall" page. Nothing is changed by the app.
    try { spawn('control.exe', ['/name', 'Microsoft.WindowsFirewall', '/page', 'pageConfigureApps'], { detached: true, stdio: 'ignore' }).unref(); return true; } catch { return false; }
  }
  if (what === 'network' && process.platform === 'win32') { shell.openExternal('ms-settings:network-status'); return true; }
  return false;
});
ipcMain.handle('jgb:close', (e) => { if (fromSettings(e)) settingsWin.close(); });
ipcMain.handle('jgb:quit', (e) => { if (fromSettings(e)) app.quit(); });
