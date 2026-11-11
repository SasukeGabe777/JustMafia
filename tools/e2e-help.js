'use strict';
// New player help in headless Chrome: Quick join (no creator, no house step), the
// "what to do now" bar, the How to Play guide, role explanations, one-time tips,
// the TV explainers, and turning it all off from the Judge setting.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = 3986, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
if (!CHROME) { console.log('SKIP e2e-help: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const emit = (s, ev, d = {}) => new Promise((r) => s.emit(ev, d, r));

(async () => {
  await startServer(PORT);
  const host = io(URL, { transports: ['websocket'] }); let tv = null; host.on('host:state', (s) => { tv = s; });
  const room = await emit(host, 'host:create');
  await emit(host, 'host:action', { type: 'settings', settings: { minPlayers: 3, nightSeconds: 120, discussionSeconds: 120 } });
  await emit(host, 'host:action', { type: 'addBots', count: 4 });
  const browser = new Browser({ shots: SHOTS, debugPort: 9339 }); await browser.launch();

  // TV: lobby how-to.
  const t = await browser.page();
  await t.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await t.go(`${URL}/`); await t.eval(`localStorage.setItem('mt.host', JSON.stringify(${JSON.stringify({ code: room.code, hostKey: room.hostKey })}))`);
  await t.send('Page.reload'); await wait(500);
  await t.until(`!document.querySelector('#lobby-how').hidden && document.querySelectorAll('#lobby-how li').length === 4`, 'TV lobby how-to');
  ok('TV lobby shows a 4-step how-to');

  // Phone: the QR link opens the creator with a Quick join card on top.
  const a = await browser.page();
  await a.go(`${URL}/play?room=${room.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#quick-join').hidden && !document.querySelector('#j-go').disabled`, 'quick join card');
  await a.shot('help-1-quickjoin');
  await a.eval(`document.querySelector('#q-name').value = 'Ana'`); await a.click('#q-go');
  await a.until(`!document.querySelector('#screen-game').hidden`, 'joined');
  await wait(400);
  assert(await a.eval(`document.querySelector('#screen-home').hidden`), 'no house step after Quick join');
  assert(tv.players.find((p) => p.name === 'Ana' && p.house != null), 'a house was assigned');
  ok('Quick join: name, one tap, in the lobby with a look and a house (no creator, no house step)');

  // The hint bar and the How to Play guide.
  await a.until(`!document.querySelector('#g-hint').hidden && /host to start/.test(document.querySelector('#g-hint').textContent)`, 'lobby hint');
  await a.click('#g-help'); await a.until(`!document.querySelector('#howto').hidden && /How to play/.test(document.querySelector('#howto').textContent)`, 'how to play');
  await a.shot('help-2-howto');
  await a.click('[data-howto-close]'); assert(await a.eval(`document.querySelector('#howto').hidden`));
  ok('“What to do now” bar and the How to Play guide');

  // A game: role reveal hint, role explainer, night hint + one-time tip, TV explainer.
  const ana = tv.players.find((p) => p.name === 'Ana').id;
  await emit(host, 'host:action', { type: 'settings', settings: { roleSelection: 'manual', roleCounts: { detective: 1 }, forcedRoles: { [ana]: 'detective' } } });
  await emit(host, 'host:action', { type: 'start' });
  await a.until(`/secret role/.test(document.querySelector('#g-hint').textContent)`, 'reveal hint');
  await a.click('#g-body [data-role]');
  await a.until(`document.querySelector('.role-help')`, 'role explainer');
  await a.click('.role-help summary'); await wait(200);
  assert(await a.eval(`document.querySelector('.role-help').open && document.querySelector('[data-role]').classList.contains('show')`), 'opening the explainer keeps the card open');
  ok('Role card explains what my role does (and opening it doesn’t hide the card)');
  await emit(host, 'host:action', { type: 'skip' });
  await a.until(`/investigate/.test(document.querySelector('#g-hint').textContent)`, 'night hint for the Detective');
  await a.until(`!document.querySelector('#g-tip').hidden && /EVERYONE taps/.test(document.querySelector('#g-tip').textContent)`, 'first-night tip');
  await t.until(`!document.querySelector('#hud-help').hidden && /Night/.test(document.querySelector('#hud-help').textContent)`, 'TV night explainer');
  await a.shot('help-3-night'); await t.shot('help-4-tv-night');
  await a.click('[data-tip-ok]'); assert(await a.eval(`document.querySelector('#g-tip').hidden`));
  await a.send('Page.reload'); await wait(800);
  await a.until(`!document.querySelector('#screen-game').hidden`, 'back after refresh'); await wait(400);
  assert(await a.eval(`document.querySelector('#g-tip').hidden`), 'a tip shows only once per device');
  ok('Night: role-aware hint, a one-time tip, and the TV explainer');

  // Turning it off from the Judge setting hides it everywhere.
  await emit(host, 'host:action', { type: 'settings', settings: { newPlayerHelp: false } });
  await a.until(`document.querySelector('#g-hint').hidden && document.querySelector('#g-help').hidden`, 'phone help off');
  await t.until(`document.querySelector('#hud-help').hidden`, 'TV help off');
  ok('“New player help” off: no hints, no guide, no TV explainer');

  for (const [n, p] of [['TV', t], ['phone', a]]) assert.deepEqual(p.errors, [], `${n} page errors: ${p.errors.join('\n')}`);
  ok('No page errors');
  console.log(`All ${passed} new-player help end-to-end checks passed. Screenshots: ${SHOTS}`);
  host.close();
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { cleanup(); setTimeout(() => process.exit(), 300).unref(); });
