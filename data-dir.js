'use strict';
// Where saves live: profiles, JustGold, box-game lifetime stats (profiles.js, box/profiles.js).
// DATA_DIR overrides it; the desktop app (desktop/main.js) points it at Electron's userData
// folder so saves survive app updates (and Steam Cloud can sync it). Default: ./.data next to
// server.js, git-ignored, as on the web host.
const path = require('path');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '.data');

module.exports = { DATA_DIR };
