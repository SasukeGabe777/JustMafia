'use strict';
// Render build/icon.svg to build/icon.png (512x512, transparent corners) with Electron itself.
//   npx electron scripts/make-icon.js        (from desktop/; npm run icon)
// electron-builder turns icon.png into the .exe's Windows icon.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const SVG = path.join(__dirname, '..', 'build', 'icon.svg');
const PNG = path.join(__dirname, '..', 'build', 'icon.png');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const w = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } });
  const svg = fs.readFileSync(SVG, 'utf8');
  await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`));
  await new Promise((r) => setTimeout(r, 300));
  const img = await w.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  fs.writeFileSync(PNG, img.resize({ width: 512, height: 512 }).toPNG());
  console.log('  wrote', path.relative(process.cwd(), PNG), img.getSize());
  app.quit();
});
