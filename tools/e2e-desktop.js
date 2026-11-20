'use strict';
// End-to-end check of the BUILT desktop app (npm run desktop:build first):
//   node tools/e2e-desktop.js [path\to\JustGameBox.exe]
// Starts the exe with a throwaway profile (JGB_USER_DATA), muted and with every window hidden
// (JGB_TEST_HIDDEN=1: nothing appears on screen), and checks:
//   local mode: the server answers on the LAN address, the title screen loads in the window with
//   self-hosted fonts, audio may start without a click, the App settings button/window work, a phone
//   (headless Chrome, muted) joins a room through the LAN join link, saves go to <userData>/saves,
//   a second launch exits (single instance), and closing the app stops the server.
//   online mode: the window opens a separately running server; an unreachable one falls back to local.
// Ports: 3422 (app), 3423 (the "online" server), 9341/9344 (debugging), 9343 (the phone browser).
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');
const { Browser, startServer, cleanup, wait } = require('./cdp');
const lan = require('../lan');

const EXE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'desktop', 'dist', 'win-unpacked', 'JustGameBox.exe'));
const PORT = 3422, ONLINE_PORT = 3423;
const ok = (m) => console.log('  ✓ ' + m);
const kids = [];

async function until(fn, what, ms = 20000) {
  const end = Date.now() + ms;
  for (;;) { try { const v = await fn(); if (v) return v; } catch { /* not yet */ } if (Date.now() > end) throw new Error('Timed out: ' + what); await wait(150); }
}
const get = async (url) => { const r = await fetch(url); return { status: r.status, text: await r.text() }; };
const listening = async (port) => { try { await fetch(`http://127.0.0.1:${port}/healthz`); return true; } catch { return false; } };

// A tiny CDP client for one target of the app (the app is Electron, not our headless Chrome).
async function attach(debugPort, match) {
  const t = await until(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find((x) => x.type === 'page' && match(x.url)), 'app target ' + match);
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.once('open', r));
  let id = 0; const pending = new Map();
  ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
  const send = (method, params = {}) => new Promise((r, j) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); setTimeout(() => { if (pending.delete(i)) j(new Error('no answer to ' + method + ' ' + (params.expression || '').slice(0, 80))); }, 15000); });
  const evaluate = async (expression) => { const m = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (m.result && m.result.exceptionDetails) throw new Error(m.result.exceptionDetails.text + ' ' + JSON.stringify(m.result.exceptionDetails.exception && m.result.exceptionDetails.exception.description)); return m.result.result.value; };
  return { url: t.url, send, eval: evaluate, close: () => ws.close() };
}

function launch(userData, debugPort, extraEnv = {}) {
  // JGB_TEST_HIDDEN: the app never shows a window or dialog (tests run without touching the screen).
  const env = { ...process.env, JGB_USER_DATA: userData, JGB_TEST_HIDDEN: '1', ...extraEnv };
  delete env.STEAM_APP_ID; delete env.SteamAppId;
  const p = spawn(EXE, [`--remote-debugging-port=${debugPort}`, '--mute-audio'], { env, stdio: 'ignore' });
  kids.push(p);
  return p;
}
const exited = (p, ms) => new Promise((r) => { if (p.exitCode != null) return r(true); const t = setTimeout(() => r(false), ms); p.once('exit', () => { clearTimeout(t); r(true); }); });
function profile(settings) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jgb-desktop-e2e-'));
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify({ port: PORT, fullscreen: false, firstRunDone: true, ...settings }));
  return dir;
}

(async () => {
  assert(fs.existsSync(EXE), 'build the app first: npm run desktop:build (' + EXE + ')');
  for (const p of [PORT, ONLINE_PORT]) assert(!(await listening(p)), `port ${p} is already in use`);
  const LAN = await lan.bestLanAddressAsync();
  console.log(`Desktop app: ${EXE}\nLAN address: ${LAN}`);

  // ---------- local mode ----------
  const userData = profile({ mode: 'local' });
  const app = launch(userData, 9341);
  await until(() => listening(PORT), 'the app\'s server on ' + PORT, 40000);
  const info = JSON.parse((await get(`http://${LAN}:${PORT}/api/info`)).text);
  assert.equal(info.baseUrl, `http://${LAN}:${PORT}`);
  ok(`server listens on 0.0.0.0:${PORT}; reachable at the LAN address, join base ${info.baseUrl}`);

  const tv = await attach(9341, (u) => u === `http://127.0.0.1:${PORT}/`);
  await until(() => tv.eval(`document.readyState === 'complete' && !!document.querySelector('.tile')`), 'title screen');
  ok('the app window (kept hidden in tests) loads the title screen (' + (await tv.eval('document.title')) + ')');
  await until(() => tv.eval(`!!document.getElementById('jgb-desktop')`), 'App settings button');
  ok('the ⚙ menu has the App settings button');
  assert(await tv.eval(`document.fonts.ready.then(() => document.fonts.check('700 40px Fredoka'))`), 'Fredoka loaded');
  assert(await tv.eval(`!performance.getEntriesByType('resource').some((e) => /googleapis|gstatic|jsdelivr/.test(e.name))`), 'no CDN requests');
  ok('fonts are self-hosted (Fredoka loaded, no Google Fonts / CDN requests)');
  assert.equal(await tv.eval(`(() => { const c = new AudioContext(); const s = c.state; c.close(); return s; })()`), 'running');
  ok('audio may start without a click (AudioContext starts "running")');

  // The App settings window, opened the way a player does (the injected button).
  tv.eval(`setTimeout(() => document.getElementById('jgb-desktop').click(), 50), true`).catch(() => {});
  const st = await attach(9341, (u) => u.startsWith('file:') && u.includes('settings.html'));
  await until(() => st.eval(`document.querySelector('#join-url').textContent.startsWith('http://')`), 'settings join URL');
  assert.equal(await st.eval(`document.querySelector('#join-url').textContent`), `http://${LAN}:${PORT}/join`);
  assert(await st.eval(`document.querySelectorAll('#adapter option').length >= 2`), 'adapter list');
  assert.equal(await st.eval(`typeof require`), 'undefined');
  ok('App settings opens from the title screen: join address, adapter list, firewall help (no Node in the page)');
  st.eval(`window.jgb.close()`).catch(() => {}); // the window closes: no answer comes back
  await wait(500); st.close();

  // A phone joins through the LAN link shown on the TV.
  await tv.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/box/tv?game=likely&new=1&practice=0` });
  await until(() => tv.eval(`/^[A-Z]{4}$/.test((document.querySelector('#code') || {}).textContent || '')`), 'box lobby');
  const code = await tv.eval(`document.querySelector('#code').textContent`);
  const qr = await tv.eval(`decodeURIComponent(document.querySelector('#qr').src)`);
  assert(qr.endsWith(`text=http://${LAN}:${PORT}/j/${code}`), 'QR is the LAN join link: ' + qr);
  ok(`the QR code says http://${LAN}:${PORT}/j/${code}`);
  const browser = new Browser({ debugPort: 9343 }); await browser.launch();
  const ph = await browser.page();
  await ph.go(`http://${LAN}:${PORT}/j/${code}`);
  await ph.until(`!document.querySelector('#join').hidden && document.querySelector('#j-code').value === '${code}'`, 'join screen prefilled', 15000);
  await ph.eval(`document.querySelector('#j-name').value = 'Pat'`); await ph.click('#j-go');
  await ph.until(`!document.querySelector('#game').hidden && /You’re in/.test(document.body.textContent)`, 'phone in lobby', 15000);
  await until(() => tv.eval(`/Pat/.test(document.querySelector('#roster').textContent)`), 'TV shows the phone');
  ok('a phone (headless Chrome, muted) joined through the LAN address and shows on the TV');

  await until(() => fs.existsSync(path.join(userData, 'saves')), 'saves folder');
  ok('saves folder: ' + path.join(userData, 'saves') + ' [' + fs.readdirSync(path.join(userData, 'saves')).join(', ') + ']');
  const log = fs.readFileSync(path.join(userData, 'logs', 'app.log'), 'utf8');
  ok('Steam: ' + ((log.match(/steam: ([^|]+)\|/) || [])[1] || '?').trim());

  const second = launch(userData, 9344);
  assert(await exited(second, 15000), 'a second copy exits');
  assert(app.exitCode == null, 'the first copy keeps running');
  ok('single instance: a second launch exits, the first keeps running');

  // Closing the window quits the app and stops its server.
  tv.close();
  const b = await (await fetch('http://127.0.0.1:9341/json/version')).json();
  const bws = new WebSocket(b.webSocketDebuggerUrl); await new Promise((r) => bws.once('open', r));
  const main = await attach(9341, (u) => u.startsWith(`http://127.0.0.1:${PORT}/`));
  main.eval('window.close(), true').catch(() => {});
  assert(await exited(app, 15000), 'the app quits when its window closes');
  await until(async () => !(await listening(PORT)), 'server stopped', 10000);
  bws.close();
  ok('closing the window quits the app and stops the server');

  // ---------- online mode ----------
  await startServer(ONLINE_PORT);
  const onlineData = profile({ mode: 'online', onlineUrl: `http://127.0.0.1:${ONLINE_PORT}` });
  const app2 = launch(onlineData, 9341);
  const tv2 = await attach(9341, (u) => u === `http://127.0.0.1:${ONLINE_PORT}/`);
  await until(() => tv2.eval(`!!document.querySelector('.tile')`), 'online title screen');
  assert(!(await listening(PORT)), 'no local server in online mode');
  ok('online mode: the window opens the online server; no local server runs');
  tv2.close();
  app2.kill(); await exited(app2, 10000);

  const badData = profile({ mode: 'online', onlineUrl: 'http://127.0.0.1:3429' });
  const app3 = launch(badData, 9341);
  await until(() => listening(PORT), 'fallback local server', 40000);
  const tv3 = await attach(9341, (u) => u === `http://127.0.0.1:${PORT}/`);
  tv3.close();
  ok('online server unreachable: falls back to local mode (with a message)');
  app3.kill(); await exited(app3, 10000);

  console.log('\nDesktop e2e passed.');
})().catch((e) => { console.error('\n✗ ' + (e.stack || e.message)); process.exitCode = 1; }).finally(() => { for (const k of kids) try { k.kill(); } catch { /* gone */ } cleanup(); setTimeout(() => process.exit(), 500); });
