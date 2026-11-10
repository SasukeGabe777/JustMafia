'use strict';
// Minimal headless-Chrome driver over the DevTools protocol (no extra
// dependencies beyond `ws`), shared by the e2e tests. Each `page()` is a separate
// browser context, i.e. a separate phone with its own localStorage/profile.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const WebSocket = require('ws');

const CHROME = process.env.CHROME || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const procs = [];

// Start a private game server (memory profiles) and resolve once it is listening.
async function startServer(port, env = {}) {
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(port), MT_PROFILE_STORE: 'memory', ...env }, stdio: 'pipe' });
  procs.push(server);
  await new Promise((resolve, reject) => { server.stdout.on('data', (b) => { if (String(b).includes('Mafia Town is running')) resolve(); }); setTimeout(() => reject(new Error('server did not start')), 6000).unref(); });
  return server;
}
function cleanup() { for (const p of procs) try { p.kill(); } catch { /* gone */ } }

class Browser {
  constructor({ debugPort = 9333, shots = path.join(os.tmpdir(), 'mt-e2e') } = {}) { this.debugPort = debugPort; this.shots = shots; fs.mkdirSync(shots, { recursive: true }); }
  async launch() {
    const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-chrome-'));
    procs.push(spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${this.debugPort}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' }));
    let info; for (let i = 0; i < 100 && !info; i++) { try { info = await (await fetch(`http://127.0.0.1:${this.debugPort}/json/version`)).json(); } catch { await wait(100); } }
    if (!info) throw new Error('Chrome DevTools did not start');
    this.ws = new WebSocket(info.webSocketDebuggerUrl); this.id = 0; this.pending = new Map(); this.listeners = [];
    this.ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && this.pending.has(m.id)) { const { resolve, reject } = this.pending.get(m.id); this.pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } else this.listeners.forEach((l) => l(m)); });
    await new Promise((r) => this.ws.once('open', r));
  }
  send(method, params = {}, sessionId) { const id = ++this.id; this.ws.send(JSON.stringify({ id, method, params, sessionId })); return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject })); }
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
  async shot(name) { const { data } = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(path.join(this.b.shots, name + '.png'), Buffer.from(data, 'base64')); }
  frames() { return this.eval('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); }
  // The creator stage publishes what it draws on its next animation frame; wait two frames first.
  async look() { await this.frames(); return this.lookNow(); }
  lookNow() { return this.eval(`(() => { const keys = Object.keys(MT_OPTIONS.AVATAR_FIELDS), v = JSON.parse(document.querySelector('#preview').dataset.look || '[]'); return Object.fromEntries(keys.map((k, i) => [k, v[i]])); })()`); }
  noOverflow() { return this.eval('document.documentElement.scrollWidth <= window.innerWidth'); }
}
module.exports = { CHROME, Browser, Page, startServer, cleanup, wait };
