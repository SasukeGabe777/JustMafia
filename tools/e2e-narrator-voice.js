'use strict';
// The JustMafia TV plays the recorded narrator (headless Chrome, muted):
//  - a narrator line with spoken clips (`say`) plays those clips, in the world's narrator voice;
//  - a cutscene caption plays its name-free clip;
//  - the voice setting off = silence; a hand-picked browser voice = no clips (browser speech instead).
// Needs rendered JustMafia clips (npm run voices -- mafia); skips otherwise.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { io } = require('socket.io-client');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');
const SAY = require('../public/shared/narration-say');

const PORT = 3435, URL = `http://localhost:${PORT}`;
if (!CHROME) { console.log('SKIP e2e-narrator-voice: Chrome not found.'); process.exit(0); }
const mf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'audio', 'voice', 'manifest.json'), 'utf8'));
// A world whose narrator has the test lines rendered.
const LINE = 'They ran.', THEMES = Object.keys(SAY.NARRATOR_VOICE);
const theme = THEMES.find((t) => mf.clips[SAY.keyOf(LINE, SAY.voiceFor(t))] && mf.clips[SAY.keyOf('The votes are in...', SAY.voiceFor(t))]);
if (!theme) { console.log('SKIP e2e-narrator-voice: no JustMafia narrator clips rendered yet.'); process.exit(0); }
let passed = 0;
const ok = (n) => { passed++; console.log('  ✓ ' + n); };
const emit = (s, ev, d = {}) => new Promise((r) => s.emit(ev, d, r));

(async () => {
  await startServer(PORT);
  const host = io(URL, { transports: ['websocket'] });
  const room = await emit(host, 'host:create');
  await emit(host, 'host:action', { type: 'settings', settings: { theme } });
  const browser = new Browser({ debugPort: 9435 }); await browser.launch();
  const t = await browser.page();
  await t.go(`${URL}/mafia`);
  await t.eval(`localStorage.setItem('mt.host', JSON.stringify(${JSON.stringify({ code: room.code, hostKey: room.hostKey })})); localStorage.removeItem('mt.hostPrefs')`);
  await t.send('Page.reload'); await wait(800);
  await t.until('!!window.MT_SAY', 'narration-say loaded');
  // Record every clip the page tries to play.
  await t.eval(`(() => { const A = window.Audio; window.__clips = []; window.Audio = function (u) { window.__clips.push(String(u || '')); return new A(u); }; return true; })()`);
  const V = SAY.voiceFor(theme), want = (s) => '/audio/voice/mafia-' + V.kokoro + '/' + SAY.keyOf(s, V) + '.webm';

  await t.eval(`window.dispatchEvent(new CustomEvent('mt-caption', { detail: { text: 'Gabe ran.', say: ${JSON.stringify([LINE])} } }))`);
  await t.until(`window.__clips.length >= 1`, 'caption clip played', 8000);
  assert.equal(await t.eval('window.__clips[0]'), want(LINE));
  ok(`a cutscene caption plays its name-free clip in the ${theme} narrator's voice (${V.orpheus})`);

  await wait(2500);
  await t.eval(`window.__clips.length = 0; window.dispatchEvent(new CustomEvent('mt-caption', { detail: { text: 'The votes are in...', say: ['The votes are in...'] } }))`);
  await t.until(`window.__clips.length >= 1`, 'second line', 8000);
  assert.equal(await t.eval('window.__clips[0]'), want('The votes are in...'));
  ok('lines queue and each plays its clip');

  // Voice off: nothing plays.
  await wait(3000);
  await t.eval(`(() => { const el = document.querySelector('#pref-voice'); el.checked = false; el.dispatchEvent(new Event('change')); window.__clips.length = 0; window.dispatchEvent(new CustomEvent('mt-caption', { detail: { text: 'x', say: ${JSON.stringify([LINE])} } })); return true; })()`);
  await wait(1500);
  assert.equal(await t.eval('window.__clips.length'), 0);
  ok('the voice setting off keeps the narrator silent');

  // A hand-picked browser voice: no clips (the browser reads the full line instead).
  await t.eval(`(() => { const el = document.querySelector('#pref-voice'); el.checked = true; el.dispatchEvent(new Event('change'));
    const s = document.querySelector('#pref-voice-name'); const o = document.createElement('option'); o.value = 'Some Browser Voice'; o.textContent = 'x'; s.appendChild(o); s.value = 'Some Browser Voice'; s.dispatchEvent(new Event('change'));
    window.__clips.length = 0; window.dispatchEvent(new CustomEvent('mt-caption', { detail: { text: 'Gabe ran.', say: ${JSON.stringify([LINE])} } })); return true; })()`);
  await wait(1500);
  assert.equal(await t.eval('window.__clips.length'), 0);
  ok('a hand-picked browser voice reads the line itself (no clips)');

  console.log(`narrator voice e2e: ${passed} passed`);
  host.close(); cleanup(); process.exit(0);
})().catch((e) => { console.error(e); cleanup(); process.exit(1); });
