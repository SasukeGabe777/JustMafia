'use strict';
// Steamworks (steamworks.js), always optional: the app runs the same without Steam, without an
// App ID, or when the native module can't load.
//
// App ID, first found wins:
//   1. STEAM_APP_ID (or SteamAppId, which the Steam client sets when it launches the game)
//   2. steam_appid.txt next to the .exe, in the working folder, or in desktop/ (dev)
//   3. development only (not packaged): 480, Valve's public "Spacewar" test app
// A packaged build with no App ID simply runs without Steam. No real App ID is in the repo:
// the owner gets one from Steamworks (docs/steam-release.md).
//
// Achievements: unlock('ACH_ID') (the IDs are created in the Steamworks partner site first).
// The game server asks for one through achievements.js (a message to this process).
const fs = require('fs');
const path = require('path');

let sw = null, client = null;
const state = { status: 'off', appId: null, source: null, error: null };

function readAppId(dev) {
  const env = process.env.STEAM_APP_ID || process.env.SteamAppId;
  if (env && /^\d+$/.test(env.trim()) && Number(env) > 0) return { id: Number(env), source: 'environment' };
  const dirs = [path.dirname(process.execPath), process.cwd(), __dirname];
  for (const d of dirs) {
    try {
      const t = fs.readFileSync(path.join(d, 'steam_appid.txt'), 'utf8').trim();
      if (/^\d+$/.test(t) && Number(t) > 0) return { id: Number(t), source: path.join(d, 'steam_appid.txt') };
    } catch { /* not there */ }
  }
  if (dev && process.env.JGB_STEAM !== '0') return { id: 480, source: 'development default (Spacewar)' };
  return null;
}

// Call before app 'ready' (the overlay needs command-line switches set early).
function init({ dev = false, overlay = true } = {}) {
  if (process.env.JGB_STEAM === '0') { state.status = 'disabled'; return false; }
  const found = readAppId(dev);
  if (!found) { state.status = 'no App ID (running without Steam)'; return false; }
  state.appId = found.id; state.source = found.source;
  try {
    sw = require('steamworks.js');
    client = sw.init(found.id);
    state.status = 'active';
  } catch (e) {
    client = null;
    state.status = 'Steam not available';
    state.error = String((e && e.message) || e).slice(0, 200);
    return false;
  }
  if (overlay) {
    try { sw.electronEnableSteamOverlay(); state.overlay = true; } catch (e) { state.overlay = false; state.error = 'overlay: ' + e.message; }
  }
  return true;
}

function info() {
  const out = { ...state };
  if (client) {
    try { out.user = client.localplayer.getName(); } catch { /* not available */ }
    try { out.steamDeck = client.utils.isSteamRunningOnSteamDeck(); } catch { /* old client */ }
  }
  return out;
}

// Achievement stubs: harmless without Steam. Returns true when Steam accepted it.
function unlock(id) {
  id = String(id || '').slice(0, 100);
  if (!id) return false;
  if (!client) { console.log(`[steam] achievement ${id} (no Steam, ignored)`); return false; }
  try { return client.achievement.activate(id); } catch (e) { console.error('[steam] achievement failed:', e.message); return false; }
}
function isUnlocked(id) { try { return !!client && client.achievement.isActivated(String(id)); } catch { return false; } }

module.exports = { init, info, unlock, isUnlocked, active: () => !!client };
