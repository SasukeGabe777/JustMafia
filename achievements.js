'use strict';
// Steam achievements hook for the desktop app. Game code may call
//   require('./achievements').unlock('ACH_FIRST_PARTY')
// when the HOST (the PC's Steam account, not a phone player) earns something. In the desktop
// app the server runs as a child of desktop/main.js, which passes it to Steam (desktop/steam.js);
// on the web host (Render) and in tests there is no parent and this does nothing.
// The IDs must first be created in the Steamworks partner site (docs/steam-release.md).
function unlock(id) {
  if (process.parentPort && id) process.parentPort.postMessage({ type: 'achievement', id: String(id).slice(0, 100) });
}

module.exports = { unlock };
