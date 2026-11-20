'use strict';
// Before `npm run desktop` / `npm run desktop:build` (repo root): check Node and install the
// desktop app's own dependencies (Electron, electron-builder, steamworks.js) on first use.
// They live in desktop/node_modules, so the web server's install (Render: npm ci --omit=dev)
// never downloads Electron.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DESKTOP = path.resolve(__dirname, '..');
const ROOT = path.resolve(DESKTOP, '..');
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 12)) {
  console.error(`\n  The desktop app needs Node.js 22.12 or newer to install and build Electron (this is ${process.version}).`);
  console.error('  Install the current Node.js LTS from https://nodejs.org (the game server itself still runs on Node 20).\n');
  process.exit(1);
}
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (cwd, args) => { const r = spawnSync(npm, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' }); if (r.status !== 0) process.exit(r.status || 1); };
if (!fs.existsSync(path.join(ROOT, 'node_modules', 'express'))) { console.log('  Installing the game server dependencies (npm ci)…'); run(ROOT, ['ci']); }
if (!fs.existsSync(path.join(DESKTOP, 'node_modules', 'electron')) || !fs.existsSync(path.join(DESKTOP, 'node_modules', 'electron-builder'))) {
  console.log('  Installing the desktop app dependencies (Electron, electron-builder, steamworks.js)…');
  run(DESKTOP, ['ci']);
}
