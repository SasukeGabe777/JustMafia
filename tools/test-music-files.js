'use strict';
// The shipped soundtrack (public/audio/music/manifest.json, docs/music.md) on real pages in a
// muted headless Chrome: every listed file exists and decodes, the hub plays the menu track, a
// box TV lobby plays its set's track, a cue with no track falls back to the synth score, a
// track that fails to load falls back to the synth too, and JustMafia's TV plays a world track.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CHROME, Browser, startServer, cleanup, wait } = require('./cdp');

const PORT = Number(process.env.PORT) || 3443, URL = `http://localhost:${PORT}`;
const DIR = path.join(__dirname, '..', 'public', 'audio', 'music');
const M = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
let passed = 0; const ok = (n) => { passed++; console.log('  ✓ ' + n); };

// 1. Every manifest entry points at a real file with sane loop points.
const entries = [];
const walk = (o, where) => { for (const [k, v] of Object.entries(o || {})) { if (v && typeof v === 'object' && v.file) entries.push([where + '.' + k, v]); else if (v && typeof v === 'object') walk(v, where + '.' + k); else if (typeof v === 'string' && /\.(ogg|webm|mp3|m4a)$/.test(v)) entries.push([where + '.' + k, { file: v }]); } };
walk(M.sets, 'sets'); walk(M.games, 'games'); walk(M.mafia, 'mafia');
assert(entries.length > 0, 'the manifest lists tracks');
for (const [where, e] of entries) {
  assert(fs.existsSync(path.join(DIR, e.file)), where + ': missing ' + e.file);
  if (e.loopEnd) assert(e.loopEnd > (e.loopStart || 0) + 10, where + ': loop too short');
}
ok(entries.length + ' manifest entries point at real files with sane loops');

if (!CHROME) { console.log('SKIP browser part: Chrome not found (set CHROME=path).'); process.exit(0); }
(async () => {
  await startServer(PORT);
  const browser = new Browser({ debugPort: 9343 }); await browser.launch(); // --mute-audio
  const gesture = async (p) => { for (const type of ['mousePressed', 'mouseReleased']) await p.send('Input.dispatchMouseEvent', { type, x: 5, y: 5, button: 'left', clickCount: 1 }); };

  // 2. Every file decodes in Chrome (Opus in Ogg), and its loop end is inside the file.
  const dec = await browser.page();
  await dec.go(`${URL}/box/scores/README.md`);
  const bad = await dec.eval(`(async () => { const c = new OfflineAudioContext(2, 48000, 48000), out = [];
    for (const [w, e] of ${JSON.stringify(entries)}) { try { const b = await c.decodeAudioData(await (await fetch('/audio/music/' + e.file)).arrayBuffer()); if (e.loopEnd && e.loopEnd > b.duration + 0.01) out.push(w + ' loopEnd past the end'); if (b.numberOfChannels < 1 || b.duration < 10) out.push(w + ' too short'); } catch (x) { out.push(w + ' ' + x.message); } }
    return out; })()`);
  assert.deepEqual(bad, [], 'all tracks decode');
  ok('every track decodes in Chrome');

  // 3. The hub plays the menu theme file.
  const hub = await browser.page();
  await hub.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await hub.go(`${URL}/`); await gesture(hub);
  if (M.games.menu && M.games.menu.title) { await hub.until(`(BOX.audio.source || '').startsWith('file:/audio/music/menu/title')`, 'hub menu track', 10000); ok('hub plays the recorded menu theme'); }
  assert.deepEqual(hub.errors, [], 'hub page errors');

  // 4. A box TV lobby plays its set's lobby; a cue without a track plays the synth score.
  const tv = await browser.page();
  await tv.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await tv.go(`${URL}/box/tv?game=price&new=1&practice=0`); await gesture(tv);
  await tv.until(`/^[A-Z]{4}$/.test((document.querySelector('#code') || {}).textContent || '')`, 'price lobby');
  const lob = (M.games.price && M.games.price.lobby) || (M.sets[(M.games.price || {}).set || M.games._default.set] || {}).lobby;
  if (lob) { await tv.until(`(BOX.audio.source || '').startsWith('file:/audio/music/${lob.file || lob}')`, 'lobby track', 10000); ok('box TV lobby plays ' + (lob.file || lob)); }
  await tv.eval(`BOX.audio.music('taco', 'pizza'); true`);
  await tv.until(`(BOX.audio.source || '').startsWith('synth:')`, 'synth fallback for a cue with no track', 10000);
  ok('a cue with no track falls back to the synth score');
  // A track that cannot load: the synth plays instead.
  await tv.send('Fetch.enable', { patterns: [{ urlPattern: '*/audio/music/sets/*/finale.ogg' }] });
  const fail = (m) => { if (m.method === 'Fetch.requestPaused' && m.sessionId === tv.s) tv.send('Fetch.failRequest', { requestId: m.params.requestId, errorReason: 'Failed' }).catch(() => {}); };
  browser.listeners.push(fail);
  await tv.eval(`BOX.audio.music('finale', 'price'); true`);
  await tv.until(`(BOX.audio.source || '').startsWith('synth:')`, 'synth fallback for a failed track', 10000);
  ok('a track that fails to load falls back to the synth score');
  browser.listeners.splice(browser.listeners.indexOf(fail), 1);
  await tv.send('Fetch.disable');
  // Ducking keeps working (music bus) with a file playing.
  await tv.eval(`BOX.audio.music('lobby', 'price'); true`); await wait(300);
  await tv.eval(`BOX.audio.duck(true); BOX.audio.duck(false); true`);
  assert.deepEqual(tv.errors, [], 'TV page errors');

  // 5. JustMafia's TV: a world's lobby track (or the shared mood track) plays.
  const mt = await browser.page();
  await mt.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  await mt.go(`${URL}/index.html`); await gesture(mt);
  await mt.eval(`(() => { const c = SFX.unlock(); MT_MUSIC.play('lobby', 'medieval', { ctx: c, master: c.destination }); return true; })()`);
  const want = M.mafia && ((M.mafia.worlds.medieval || {}).lobby || (M.mafia.moods || {}).lobby);
  if (want) { await mt.until(`/^Soundtrack:/.test((MT_MUSIC.nowPlaying() || {}).name || '')`, 'mafia world track', 10000); ok('JustMafia plays the recorded ' + (want.file || want)); }
  await mt.eval(`(() => { const c = SFX.unlock(); MT_MUSIC.play('day', 'noir', { ctx: c, master: c.destination }); return true; })()`); await wait(1500);
  await mt.eval(`MT_MUSIC.duck(true); MT_MUSIC.duck(false); MT_MUSIC.stop(0.2); true`);
  assert.deepEqual(mt.errors, [], 'JustMafia page errors');
  ok('no page errors on the hub, a box TV and the JustMafia TV');
  console.log(`\n${passed} checks passed`);
  cleanup(); process.exit(0);
})().catch((e) => { console.error(e); cleanup(); process.exit(1); });
