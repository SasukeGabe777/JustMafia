'use strict';
// The desktop app's own settings (not game saves): <userData>/settings.json.
//   mode        'local'  this PC runs the game server; phones on the same Wi-Fi join it (default)
//               'online' the window opens a hosted JustGameBox server; phones join over the internet
//   onlineUrl   that server's address (https://...), entered by the player; no default
//   adapter     the LAN IPv4 the join link / QR uses ('' = pick automatically)
//   port        the local server's port. Kept stable on purpose: the title screen's own settings
//               (volume, unlocks, the live room's host key) live in the page's localStorage, which
//               belongs to the address http://127.0.0.1:<port>, so a new port starts them fresh.
//   fullscreen  open fullscreen (F11 / Alt+Enter toggles and is remembered)
//   steamOverlay  allow the Steam overlay (Shift+Tab) when Steam is running
const fs = require('fs');
const path = require('path');

const DEFAULTS = Object.freeze({ mode: 'local', onlineUrl: '', adapter: '', port: 47800, fullscreen: true, steamOverlay: true, firstRunDone: false });

function sanitize(raw) {
  const s = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') return s;
  if (raw.mode === 'online' || raw.mode === 'local') s.mode = raw.mode;
  if (typeof raw.onlineUrl === 'string') s.onlineUrl = raw.onlineUrl.trim().slice(0, 300);
  if (typeof raw.adapter === 'string' && (raw.adapter === '' || /^\d{1,3}(\.\d{1,3}){3}$/.test(raw.adapter))) s.adapter = raw.adapter;
  const port = Number(raw.port);
  if (Number.isInteger(port) && port >= 1024 && port <= 65535) s.port = port;
  if (typeof raw.fullscreen === 'boolean') s.fullscreen = raw.fullscreen;
  if (typeof raw.steamOverlay === 'boolean') s.steamOverlay = raw.steamOverlay;
  if (typeof raw.firstRunDone === 'boolean') s.firstRunDone = raw.firstRunDone;
  return s;
}

function createStore(dir) {
  const file = path.join(dir, 'settings.json');
  let data;
  try { data = sanitize(JSON.parse(fs.readFileSync(file, 'utf8'))); } catch { data = sanitize(null); }
  return {
    file,
    get: () => ({ ...data }),
    set(patch) {
      data = sanitize({ ...data, ...patch });
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2)); fs.renameSync(file + '.tmp', file);
      } catch (e) { console.error('[settings] could not save:', e.message); }
      return { ...data };
    },
  };
}

module.exports = { createStore, sanitize, DEFAULTS };
