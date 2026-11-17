'use strict';
// Probe: does a JustFunny video start on its own on a TV page nobody has clicked?
// Usage: node tools/probe-funny-autoplay.js [youtube-or-short-link]
const os = require('node:os');
const path = require('node:path');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = 3983, URL = `http://localhost:${PORT}`;
const LINK = process.argv[2] || 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
(async () => {
  if (!CHROME) { console.log('no Chrome'); return; }
  await startServer(PORT);
  const browser = new Browser({ shots: path.join(os.tmpdir(), 'mt-e2e'), debugPort: 9343 }); await browser.launch();
  try {
    const tv = await browser.page();
    await tv.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
    if (process.env.FROM_HUB) { await tv.go(`${URL}/`); await tv.until(`!!document.querySelector('.tile.live')`, 'hub'); const sel = await tv.eval(`(() => { const t = [...document.querySelectorAll('.tile.live')].find((x) => /JustFunny/.test(x.textContent)); t.id = 'probe-tile'; t.scrollIntoView({ block: 'center' }); return '#probe-tile'; })()`); const r = JSON.parse(await tv.eval(`JSON.stringify(document.querySelector("#probe-tile").getBoundingClientRect())`)); const x = r.x + r.width / 2, y = r.y + r.height / 2; for (const type of ["mousePressed", "mouseReleased"]) await tv.send("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 }); await tv.until(`location.pathname.indexOf("/box/tv") === 0`, 'tv page'); }
    else await tv.go(`${URL}/box/tv?game=funny&new=1`);
    await tv.until(`/^[A-Z]{4}$/.test((document.querySelector('#code') || {}).textContent || '')`, 'lobby');
    const code = await tv.eval(`document.querySelector('#code').textContent`);
    const phones = [];
    for (const name of ['Tess', 'Max']) {
      const ph = await browser.page();
      await ph.go(`${URL}/box/play?room=${code}`);
      await ph.until(`!document.querySelector('#join').hidden`, 'join');
      await ph.eval(`document.querySelector('#j-name').value = '${name}'`); await ph.click('#j-go');
      await ph.until(`!document.querySelector('#game').hidden`, 'joined');
      phones.push(ph);
    }
    await phones[0].until(`!!document.querySelector('[data-vip="start"]') && !document.querySelector('[data-vip="start"]').disabled`, 'start');
    await phones[0].click('[data-vip="start"]');
    // Whoever's turn it is pastes the link.
    let picker = null;
    for (let i = 0; i < 40 && !picker; i++) { for (const ph of phones) if (await ph.eval(`/Your turn/.test(document.body.textContent)`)) picker = ph; if (!picker) await wait(250); }
    await picker.eval(`(() => { const i = document.querySelector('#fn-paste'); i.value = ${JSON.stringify(LINK)}; i.oninput(); return true; })()`);
    await picker.click('#fn-use');
    for (let t = 0; t < 24; t++) {
      await wait(500);
      const st = await tv.eval(`(() => { const p = document.querySelector('#fn-player'); const y = window.YT && window.YT.get && p ? null : null; try { const f = document.querySelector('#fn-video iframe'); return JSON.stringify({ frame: !!f, hint: !(document.getElementById('fn-sound') || {}).hidden, top: (document.querySelector('#fn-top') || {}).textContent }); } catch (e) { return String(e); } })()`);
      const ps = await tv.eval(`(() => { try { return window.__fnState ? window.__fnState() : 'n/a'; } catch (e) { return 'err ' + e.message; } })()`);
      console.log(((t + 1) / 2).toFixed(1) + 's', st, 'player', ps);
    }
    await tv.shot('probe-funny');
  } finally { await browser.close?.(); cleanup(); }
})().catch((e) => { console.error(e); cleanup(); process.exit(1); });
