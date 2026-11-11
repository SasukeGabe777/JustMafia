'use strict';
// The Judge console (v2 layout) in headless Chrome: five tabs, a live headline, role packs,
// and a whole game driven from its own buttons (Start, Next), with the log under More.
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { io } = require('socket.io-client');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = 3985, URL = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
if (!CHROME) { console.log('SKIP e2e-judge: Chrome not found (set CHROME=path).'); process.exit(0); }
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };
const emit = (s, ev, d = {}) => new Promise((r) => s.emit(ev, d, r));

(async () => {
  await startServer(PORT);
  const host = io(URL, { transports: ['websocket'] }); let tv = null; host.on('host:state', (s) => { tv = s; });
  const room = await emit(host, 'host:create');
  await emit(host, 'host:action', { type: 'addBots', count: 6 });
  const browser = new Browser({ shots: SHOTS, debugPort: 9346 }); await browser.launch();
  const j = await browser.page();
  await j.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await j.go(`${URL}/judge#${room.code}.${room.hostKey}`);
  await j.until(`!document.querySelector('#app').hidden && /6 in the lobby/.test(document.querySelector('#g-status').textContent)`, 'judge connected');
  assert.deepEqual(await j.eval(`[...document.querySelectorAll('.tabs button')].map((b) => b.dataset.tab)`), ['game', 'setup', 'players', 'scenes', 'more']);
  assert(await j.eval(`document.querySelector('#rundown-card').hidden && document.querySelector('#g-progress-card').hidden`), 'only relevant cards in the lobby');
  ok('Five tabs, a plain-language headline, and only the cards that matter now');

  await j.click('[data-tab="setup"]');
  const packs = await j.eval(`[...document.querySelectorAll('#s-packs button')].map((b) => b.dataset.pack)`);
  assert(packs.includes('core') && packs.includes('expansion') && packs.includes('dlc1') && packs.includes('all'));
  await j.click('#s-packs [data-pack="expansion"]');
  assert(await j.eval(`!document.querySelector('[data-role="headhunter"]').closest('.role').hidden && document.querySelector('[data-role="doctor"]').closest('.role').hidden`), 'packs filter the role list');
  await j.click('#s-packs [data-pack="all"]');
  await j.eval(`(() => { const s = document.querySelector('[data-set="roleSelection"]'); s.value = 'manual'; s.dispatchEvent(new Event('change')); })()`);
  await wait(300); assert.equal(tv.settings.roleSelection, 'manual');
  ok('Setup: role packs (Core / Expansion / DLC 1 / All) and settings still save');

  await j.click('[data-tab="game"]');
  await j.click('.controls [data-act="start"]');
  await j.until(`/Role reveal/.test(document.querySelector('#h-phase').textContent)`, 'started from the control bar');
  await j.click('.controls [data-act="skip"]');
  await j.until(`/Night 1/.test(document.querySelector('#h-phase').textContent) && /night actions in/.test(document.querySelector('#g-status').textContent)`, 'Next advances, headline follows');
  assert(!(await j.eval(`document.querySelector('#g-progress-card').hidden`)), 'progress shows at night');
  await j.shot('judge-v2-night');
  ok('Start and Next from the always-visible control bar; Progress appears at night');

  await j.click('[data-tab="more"]');
  await j.eval(`document.querySelectorAll('main[data-panel="more"] details').forEach((d) => { d.open = true; })`);
  await j.until(`document.querySelectorAll('#l-list li').length > 2`, 'log under More');
  await j.eval(`localStorage.setItem('mt.judgeTab', JSON.stringify('log'))`); await j.send('Page.reload'); await wait(800);
  await j.until(`document.querySelector('.tabs [data-tab="more"]').classList.contains('on')`, 'old saved tab maps to More');
  ok('More holds the log, grimoire and test mode (old saved tabs land there)');

  assert.deepEqual(j.errors, [], 'page errors: ' + j.errors.join('\n'));
  ok('No page errors');
  console.log(`All ${passed} Judge console end-to-end checks passed. Screenshots: ${SHOTS}`);
  host.close();
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { cleanup(); setTimeout(() => process.exit(), 300).unref(); });
