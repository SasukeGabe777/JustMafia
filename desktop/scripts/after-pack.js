'use strict';
// electron-builder afterPack hook: copy the staged game server (scripts/stage-server.js) into
// <app>/resources/server exactly as staged. (electron-builder's extraResources drops node_modules
// and dot-files such as my-music's .gitkeep folders, so the copy is done here instead.)
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  const src = path.resolve(__dirname, '..', '.stage', 'server');
  if (!fs.existsSync(path.join(src, 'server.js'))) throw new Error('Run scripts/stage-server.js first (npm run build does).');
  if (!fs.existsSync(path.join(src, 'node_modules', 'express'))) throw new Error('The staged server has no node_modules (npm ci failed?).');
  const resources = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const dest = path.join(resources, 'server');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log('  • copied the game server  to=' + path.relative(process.cwd(), dest));
};
