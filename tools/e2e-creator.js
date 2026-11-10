'use strict';
// End-to-end check of the phone character creator in real headless Chrome
// (DevTools protocol, no extra dependencies). Not part of `npm test` because it
// needs Chrome; run with `npm run test:e2e`. Set CHROME=path if Chrome is elsewhere.
//
// Covers: joining as a new player, every option in every tab updating the live
// preview, randomize, revert (preview before saving), Save & join, refresh,
// a second player, rejoining another room, "Save look" without joining, the
// server-profile restore, and no horizontal overflow at phone width.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');
const { io } = require('socket.io-client');

const PORT = 3994, URL = `http://localhost:${PORT}`, DEBUG_PORT = 9333;
const SHOTS = process.env.SHOTS || path.join(os.tmpdir(), 'mt-e2e');
const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.log('SKIP e2e-creator: Chrome not found (set CHROME=path).'); process.exit(0); }
fs.mkdirSync(SHOTS, { recursive: true });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };

class Browser {
  async launch() {
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-chrome-'));
    procs.push(spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' }));
    let info; for (let i = 0; i < 100 && !info; i++) { try { info = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json(); } catch { await wait(100); } }
    if (!info) throw new Error('Chrome DevTools did not start');
    this.ws = new WebSocket(info.webSocketDebuggerUrl); this.id = 0; this.pending = new Map(); this.listeners = [];
    this.ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } else this.listeners.forEach((l) => l(m)); });
    await new Promise((r) => this.ws.once('open', r));
  }
  send(method, params = {}, sessionId) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params, sessionId })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })); }
  // A separate browser context = a separate phone (own localStorage / profile).
  async page() {
    const { browserContextId } = await this.send('Target.createBrowserContext');
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const p = new Page(this, sessionId); await p.init(); return p;
  }
}
class Page {
  constructor(b, sessionId) { this.b = b; this.s = sessionId; this.errors = []; }
  send(m, p) { return this.b.send(m, p, this.s); }
  async init() {
    this.b.listeners.push((m) => { if (m.sessionId === this.s && m.method === 'Runtime.exceptionThrown') this.errors.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text); });
    await this.send('Runtime.enable'); await this.send('Page.enable');
    await this.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('Page error: ' + (r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text));
    return r.result.value;
  }
  async until(expression, what, ms = 6000) { const end = Date.now() + ms; while (!(await this.eval(expression))) { if (Date.now() > end) throw new Error('Timed out: ' + what); await wait(40); } }
  async go(url) { await this.send('Page.navigate', { url }); await wait(300); await this.until('document.readyState === "complete"', 'load ' + url); }
  click(sel) { return this.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('missing ' + ${JSON.stringify(sel)}); el.click(); return true; })()`); }
  async shot(name) { const { data } = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(data, 'base64')); }
  // The stage publishes what it draws on its next animation frame; wait two frames first.
  async look() { await this.eval('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); return this.lookNow(); }
  lookNow() { return this.eval(`(() => { const keys = Object.keys(MT_OPTIONS.AVATAR_FIELDS), v = JSON.parse(document.querySelector('#preview').dataset.look || '[]'); return Object.fromEntries(keys.map((k, i) => [k, v[i]])); })()`); }
  noOverflow() { return this.eval('document.documentElement.scrollWidth <= window.innerWidth'); }
}

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), MT_PROFILE_STORE: 'memory' }, stdio: 'pipe' });
  procs.push(server);
  await new Promise((resolve, reject) => { server.stdout.on('data', (b) => { if (String(b).includes('Mafia Town is running')) resolve(); }); setTimeout(() => reject(new Error('server did not start')), 6000).unref(); });
  const host = io(URL, { transports: ['websocket'] }); let tv = null; host.on('host:state', (s) => { tv = s; });
  const hostEmit = (ev, d = {}) => new Promise((r) => host.emit(ev, d, r));
  const room = await hostEmit('host:create');

  const browser = new Browser(); await browser.launch();
  const a = await browser.page();

  // --- Join as a new player: the room link opens the creator directly.
  await a.go(`${URL}/play?room=${room.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled && document.querySelector('#preview').dataset.look`, 'creator opens for a new player');
  assert(await a.noOverflow(), 'creator overflows phone width');
  const first = await a.look();
  ok('New player lands on the creator with a live preview and no horizontal overflow');

  // --- Every option in every tab updates the live preview immediately.
  const tabs = await a.eval(`[...document.querySelectorAll('[data-tab]')].map((b) => b.dataset.tab)`);
  assert.deepEqual(tabs, ['body', 'face', 'hair', 'clothes', 'accessories', 'home']);
  let tested = 0;
  for (const tab of tabs) {
    await a.click(`[data-tab="${tab}"]`);
    await a.until(`document.querySelector('[data-tab="${tab}"]').classList.contains('sel')`, 'tab ' + tab);
    await a.until(`[...document.querySelectorAll('.cas-tile canvas')].every((c) => c.width > 0)`, 'tiles painted in ' + tab);
    assert(await a.noOverflow(), 'overflow on tab ' + tab);
    await a.shot('creator-' + tab);
    const options = await a.eval(`[...document.querySelectorAll('#c-panel [data-field]')].map((b) => [b.dataset.field, b.dataset.value])`);
    assert(options.length > 0, 'no options in ' + tab);
    for (const [field, value] of options) {
      const sel = `#c-panel [data-field="${field}"][data-value="${value}"]`;
      await a.click(sel);
      await a.until(`(() => { const keys = Object.keys(MT_OPTIONS.AVATAR_FIELDS), v = JSON.parse(document.querySelector('#preview').dataset.look); return v[keys.indexOf(${JSON.stringify(field)})] === ${JSON.stringify(value)}; })()`, `preview shows ${field}=${value}`);
      assert(await a.eval(`document.querySelector(${JSON.stringify(sel)}).classList.contains('sel')`), `${field}=${value} not marked selected`);
      tested++;
    }
  }
  ok(`All ${tested} visible options across ${tabs.length} tabs update the live preview and selection`);

  // --- Preview before saving: draft is marked unsaved and Revert restores the saved look.
  assert(await a.eval(`!document.querySelector('#c-dirty').hidden && !document.querySelector('#c-revert').disabled`));
  await a.click('#c-revert');
  await a.until(`document.querySelector('#c-dirty').hidden`, 'revert clears unsaved badge');
  assert.deepEqual(await a.look(), first);
  ok('Changes stay a preview (Unsaved badge) and Revert restores the saved look');

  // --- Randomize keeps working and only touches character fields.
  await a.click('#random-character'); await a.until(`!document.querySelector('#c-dirty').hidden`, 'randomize changes the draft');
  const rnd = await a.look(); assert.notDeepEqual(rnd, first); assert.equal(rnd.houseStyle, first.houseStyle); assert.equal(rnd.houseColor, first.houseColor);
  ok('Randomize changes the character (not the home) as a draft');

  // --- Build a specific look, name it, Save & join.
  const want = { expression: 'wink', hair: 'afro', outfit: 'jacket', color: '#9b59b6', hat: 'cowboy', houseStyle: 'bakery' };
  for (const [tab, field] of [['face', 'expression'], ['hair', 'hair'], ['clothes', 'outfit'], ['clothes', 'color'], ['accessories', 'hat'], ['home', 'houseStyle']]) {
    await a.click(`[data-tab="${tab}"]`); await a.click(`#c-panel [data-field="${field}"][data-value="${want[field]}"]`);
  }
  await a.eval(`(() => { const n = document.querySelector('#j-name'); n.value = 'Ana'; n.dispatchEvent(new Event('input')); })()`);
  await a.click('#j-go');
  await a.until(`!document.querySelector('#screen-game').hidden`, 'joined the game');
  const ana = () => tv && tv.players.find((p) => p.name === 'Ana');
  for (let i = 0; i < 100 && !ana(); i++) await wait(30);
  for (const [k, v] of Object.entries(want)) assert.equal(ana().avatar[k], v, 'TV shows ' + k);
  ok('Save & join: the TV receives exactly the customized look');

  // --- Refresh: same seat, and editing opens the saved look (not a stale draft).
  await a.send('Page.reload'); await wait(300);
  await a.until(`!document.querySelector('#screen-game').hidden && document.querySelector('[data-edit]')`, 'resumed after refresh');
  await a.click('[data-edit]');
  await a.until(`!document.querySelector('#screen-creator').hidden && document.querySelector('#preview').dataset.look`, 'edit opens creator');
  const reloaded = await a.look(); for (const [k, v] of Object.entries(want)) assert.equal(reloaded[k], v, 'after refresh ' + k);
  assert(await a.eval(`document.querySelector('#c-dirty').hidden && document.querySelector('#j-go').textContent === 'Save'`));
  // Edit in the lobby: change expression and save; the TV updates.
  await a.click('[data-tab="face"]'); await a.click('#c-panel [data-field="expression"][data-value="grin"]'); await a.click('#j-go');
  for (let i = 0; i < 100 && ana().avatar.expression !== 'grin'; i++) await wait(30);
  assert.equal(ana().avatar.expression, 'grin'); want.expression = 'grin';
  ok('Refresh keeps the saved look; lobby edits save and reach the TV');

  // --- A second player sees/gets their own look; both are correct on the TV.
  const b = await browser.page();
  await b.go(`${URL}/play?room=${room.code}`);
  await b.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled`, 'second player creator');
  await b.click('[data-tab="face"]'); await b.click('#c-panel [data-field="expression"][data-value="sad"]');
  await b.eval(`document.querySelector('#j-name').value = 'Ben'`); await b.click('#j-go');
  const ben = () => tv && tv.players.find((p) => p.name === 'Ben');
  for (let i = 0; i < 100 && !ben(); i++) await wait(30);
  assert.equal(ben().avatar.expression, 'sad'); assert.equal(ana().avatar.expression, 'grin');
  await b.until(`!document.querySelector('#screen-game').hidden`, 'second player joined');
  ok('A second player joins with their own look; both appear correctly to others');

  // --- Leave and rejoin a different room with the same phone: saved look is the starting point.
  const room2 = await hostEmit('host:create');
  await a.go(`${URL}/play?room=${room2.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && document.querySelector('#preview').dataset.look`, 'rejoin creator');
  const rejoin = await a.look(); for (const [k, v] of Object.entries(want)) assert.equal(rejoin[k], v, 'rejoin ' + k);
  // "Save look" persists without joining.
  await a.click('[data-tab="face"]'); await a.click('#c-panel [data-field="expression"][data-value="smirk"]'); await a.click('#c-save');
  await a.until(`document.querySelector('#c-dirty').hidden`, 'save look clears badge');
  // The server profile also restores the look when this device's saved copy is gone.
  await a.eval(`localStorage.removeItem('mt.avatar')`);
  await a.go(`${URL}/play?room=${room2.code}`);
  await a.until(`!document.querySelector('#screen-creator').hidden && !document.querySelector('#j-go').disabled && JSON.parse(document.querySelector('#preview').dataset.look || '[]').includes('smirk')`, 'profile restores look');
  const restored = await a.look(); assert.equal(restored.expression, 'smirk'); assert.equal(restored.hair, 'afro'); assert.equal(restored.houseStyle, 'bakery');
  await a.shot('creator-rejoin');
  ok('Rejoining starts from the saved look; Save look persists; the server profile restores it');

  // --- The /test bench's auto-join phones skip the creator and join with their saved look.
  const t = await browser.page();
  await t.go(`${URL}/play?room=${room2.code}&slot=t1&autojoin=1&name=${encodeURIComponent('Tester 1')}`);
  await t.until(`!document.querySelector('#screen-game').hidden`, 'autojoin phone joins');
  for (let i = 0; i < 100 && !(tv && tv.players.some((p) => p.name === 'Tester 1')); i++) await wait(30);
  assert(tv.players.some((p) => p.name === 'Tester 1'), 'autojoin player on TV');
  ok('/test auto-join phones still join directly');

  const errors = [...a.errors, ...b.errors, ...t.errors];
  assert.deepEqual(errors, [], 'page errors: ' + errors.join('\n'));
  ok('No page errors');
  console.log(`All ${passed} creator end-to-end checks passed. Screenshots: ${SHOTS}`);
  host.close();
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { for (const p of procs) try { p.kill(); } catch { /* gone */ } setTimeout(() => process.exit(), 300).unref(); });
