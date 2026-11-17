'use strict';
// Screenshot small-game title screens and check Start opens the lobby:
//   node tools/shot-titles.js price emoji   (PORT, DEBUG_PORT, SHOTS env vars override)
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { Browser, startServer, cleanup, wait } = require(path.join(ROOT, 'tools/cdp'));
const PORT = Number(process.env.PORT) || 3978, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(require('os').tmpdir(), 'mt-titles');
require('fs').mkdirSync(SHOTS, { recursive: true });
(async () => {
  process.chdir(ROOT);
  await startServer(PORT);
  const browser = new Browser({ shots: SHOTS, debugPort: Number(process.env.DEBUG_PORT) || 9358 }); await browser.launch();
  try {
    const tv = await browser.page();
    await tv.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
    await tv.send('Runtime.enable');
    for (const key of process.argv.slice(2)) {
      await tv.go(`${URL}/box/tv?game=${key}`);
      await tv.until(`!!document.querySelector('.bt-cv')`, key + ' title');
      await wait(1800); await tv.shot('title-' + key);
      const bar = await tv.eval(`document.querySelector('.tv-bar').hidden`);
      await tv.click('#bt-go');
      await tv.until(`/^[A-Z]{4}$/.test((document.querySelector('#code') || {}).textContent || '')`, key + ' lobby after Start');
      console.log(key, 'title ok; bar hidden on title:', bar, '; bar shown in lobby:', await tv.eval(`!document.querySelector('.tv-bar').hidden`));
    }
  } finally { cleanup(); }
})().catch((e) => { console.error(e); cleanup(); process.exit(1); });
