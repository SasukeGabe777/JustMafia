'use strict';
// Pre-render the JustGameBox narrator lines with the Kokoro TTS model (`npm run voices`).
//
//   node tools/voice-gen.js                 render every new or changed line, prune unused clips
//   node tools/voice-gen.js price likely    only render these games (other games keep their clips)
//   node tools/voice-gen.js --list          print the lines, render nothing
//   node tools/voice-gen.js --force         re-render everything
//
// What it renders: every STATIC line a game's intro speaks (public/box/intros/<key>.js:
// the opening shots' `say` lines, joke/banter/meet/others/play in 'facts' mode, roll/play in
// 'cast' mode, with {title} filled in; lines with {name} or {n} are live lines) and every
// how-to-play step exactly as public/box/howto.js speaks it, plus the generic intro.
// The voice is the intro's host.voice.kokoro (+ .speed); hosts without one use the narrator
// voice in public/box/voice.js. Text cleaning, the speakable form and the file hash all come
// from public/box/voice.js itself (run in the page), so the TV looks clips up the same way.
//
// How: a private server (PORT 3948) + headless Chrome (debug port 9348, muted, WebGPU on,
// a persistent profile so the ~300 MB model downloads once) runs kokoro-js 1.2.1 (MIT) with
// onnx-community/Kokoro-82M-v1.0-ONNX (Apache-2.0): WebGPU fp32 if there is a GPU, else
// WASM q8 (about 3x slower than real time). Each clip is trimmed, peak-normalized, encoded
// to 24 kbps mono Opus with WebCodecs and muxed into WebM here, written to
// public/audio/voice/<game>/<hash>.webm, and listed in public/audio/voice/manifest.json.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');
const { CHROME, Page, startServer, cleanup, wait } = require('./cdp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'audio', 'voice');
const INTROS = path.join(ROOT, 'public', 'box', 'intros');
const PORT = Number(process.env.VOICE_PORT) || 3948;
const DEBUG = Number(process.env.VOICE_DEBUG_PORT) || 9348;
const PROFILE = process.env.VOICE_PROFILE || path.join(os.tmpdir(), 'jgb-kokoro-profile');
const KOKORO_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const BITRATE = 24000;
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const FORCE = args.includes('--force'), LIST = args.includes('--list');

// ---------------------------------------------------------------- WebM (Matroska) muxer
function vint(n) {
  for (let len = 1; len <= 8; len++) {
    if (n < 2 ** (7 * len) - 1) { const b = Buffer.alloc(len); let v = n; for (let i = len - 1; i >= 0; i--) { b[i] = v % 256; v = Math.floor(v / 256); } b[0] |= 1 << (8 - len); return b; }
  }
  throw new Error('too big');
}
const el = (id, ...parts) => { const data = Buffer.concat(parts); return Buffer.concat([Buffer.from(id), vint(data.length), data]); };
const uint = (n) => { const b = []; do { b.unshift(n % 256); n = Math.floor(n / 256); } while (n > 0); return Buffer.from(b); };
const f64 = (x) => { const b = Buffer.alloc(8); b.writeDoubleBE(x); return b; };
function opusHead(desc, sr) {
  if (desc && desc.length >= 19 && desc.toString('ascii', 0, 8) === 'OpusHead') return desc;
  const b = Buffer.alloc(19); b.write('OpusHead', 0, 'ascii'); b[8] = 1; b[9] = 1; b.writeUInt16LE(312, 10); b.writeUInt32LE(sr, 12); b.writeInt16LE(0, 16); b[18] = 0;
  return b;
}
function webm({ chunks, sr, desc, ms }) {
  const head = opusHead(desc, sr), preskip = head.readUInt16LE(10);
  const ebml = el([0x1a, 0x45, 0xdf, 0xa3], el([0x42, 0x86], uint(1)), el([0x42, 0xf7], uint(1)), el([0x42, 0xf2], uint(4)), el([0x42, 0xf3], uint(8)),
    el([0x42, 0x82], Buffer.from('webm')), el([0x42, 0x87], uint(4)), el([0x42, 0x85], uint(2)));
  const info = el([0x15, 0x49, 0xa9, 0x66], el([0x2a, 0xd7, 0xb1], uint(1000000)), el([0x4d, 0x80], Buffer.from('JustGameBox voice-gen')), el([0x57, 0x41], Buffer.from('JustGameBox voice-gen')), el([0x44, 0x89], f64(ms)));
  const tracks = el([0x16, 0x54, 0xae, 0x6b], el([0xae], el([0xd7], uint(1)), el([0x73, 0xc5], uint(1)), el([0x83], uint(2)), el([0x86], Buffer.from('A_OPUS')),
    el([0x63, 0xa2], head), el([0x56, 0xaa], uint(Math.round((preskip / 48000) * 1e9))), el([0x56, 0xbb], uint(80000000)),
    el([0xe1], el([0xb5], f64(48000)), el([0x9f], uint(1)))));
  const clusters = []; let start = null, blocks = [];
  const flush = () => { if (blocks.length) clusters.push(el([0x1f, 0x43, 0xb6, 0x75], el([0xe7], uint(start)), ...blocks)); blocks = []; };
  for (const [tsUs, , b64] of chunks) {
    const t = Math.round(tsUs / 1000);
    if (start === null || t - start > 30000) { flush(); start = t; }
    const hdr = Buffer.alloc(4); hdr[0] = 0x81; hdr.writeInt16BE(t - start, 1); hdr[3] = 0x80;
    blocks.push(el([0xa3], hdr, Buffer.from(b64, 'base64')));
  }
  flush();
  return Buffer.concat([ebml, el([0x18, 0x53, 0x80, 0x67], info, tracks, ...clusters)]);
}

// ---------------------------------------------------------------- headless Chrome (persistent profile)
async function launch() {
  fs.mkdirSync(PROFILE, { recursive: true });
  const proc = spawn(CHROME, ['--headless=new', '--mute-audio', '--enable-unsafe-webgpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${DEBUG}`, `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
  let info; for (let i = 0; i < 150 && !info; i++) { try { info = await (await fetch(`http://127.0.0.1:${DEBUG}/json/version`)).json(); } catch { await wait(100); } }
  if (!info) { proc.kill(); throw new Error('Chrome DevTools did not start (is another Chrome using ' + PROFILE + '?)'); }
  const b = { ws: new WebSocket(info.webSocketDebuggerUrl), id: 0, pending: new Map(), listeners: [], proc };
  b.ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && b.pending.has(m.id)) { const { resolve, reject } = b.pending.get(m.id); b.pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } else b.listeners.forEach((l) => l(m)); });
  b.send = (method, params = {}, sessionId) => { const id = ++b.id; b.ws.send(JSON.stringify({ id, method, params, sessionId })); return new Promise((resolve, reject) => b.pending.set(id, { resolve, reject })); };
  await new Promise((r) => b.ws.once('open', r));
  const { targetId } = await b.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await b.send('Target.attachToTarget', { targetId, flatten: true });
  const page = new Page(b, sessionId); await page.init();
  return { b, page, close: () => { try { b.ws.close(); } catch { /* gone */ } try { proc.kill(); } catch { /* gone */ } } };
}

// ---------------------------------------------------------------- in the page
// Collect the lines of one game (runs in the page; returns { lines, note }).
const COLLECT = `async (key, gi) => {
  const B = window.BOX, V = B.voice, G = B.intros.generic;
  const load = (src) => new Promise((r) => { const s = document.createElement('script'); s.src = src; s.onload = () => r(true); s.onerror = () => r(false); document.head.appendChild(s); });
  let I = key === 'generic' ? G : null;
  if (!I) { await new Promise((r) => { B.studio.need(key, r); setTimeout(r, 6000); }); I = B.intros[key]; }
  if (!I) return { lines: [], note: 'intro file did not load' };
  if (key !== 'generic' && !(I.tutorial && I.tutorial.length) && !I.opening && !I.castOpening && !I.host) return { lines: [], note: 'unfinished (template intro), skipped' };
  const fill = (s, v) => String(s || '').replace(/\\{(\\w+)\\}/g, (m, k) => (v[k] != null ? v[k] : ''));
  const title = key === 'generic' ? '' : (I.title || gi.title || '');
  const L = { ...G.lines, ...(I.lines || {}) }, spec = (I.host && I.host.voice) || null, out = [];
  const add = (from, text, sp) => { const t = V.clean(text); if (t) out.push({ from, t, say: V.spoken(t), voice: V.voiceOf(sp), h: V.keyOf(t, sp) }); };
  const modes = key === 'generic' ? ['facts', 'cast'] : [gi.mode || 'cast'];
  const want = new Set();
  for (const mode of modes) {
    const shots = mode === 'facts' ? (I.opening || G.opening) : (I.castOpening || I.opening || G.castOpening);
    for (const s of shots || []) if (s && s.say) want.add(s.say);
    for (const k of mode === 'facts' ? ['joke', 'banter', 'meet', 'others', 'play'] : ['roll', 'play']) want.add(k);
  }
  for (const k of want) for (const raw of [].concat(L[k] || [])) {
    if (/\\{(name|n)\\}/.test(raw) || (!title && /\\{title\\}/.test(raw))) continue;
    add(k, fill(raw, { title }), spec);
  }
  if (key !== 'generic') {
    if (!(I.tutorial && I.tutorial.length) && !B.games[key]) await load('/box/games/' + key + '.js');
    const steps = B.howtoSteps(key) || [];
    if (steps.some((s) => /^step (one|two|three)\\.?$/i.test(String(s.text || '').trim()))) return { lines: [], note: 'unfinished (placeholder how-to steps), skipped' };
    steps.forEach((s, i) => add('step' + (i + 1), s.say || [s.title, s.text, s.phone].filter(Boolean).join('. '), spec));
    if (steps.length) add('done', 'That’s it. Let’s play!', spec);
    for (const t of [].concat(I.story || [])) add('story', t, spec);
  }
  return { lines: out, note: '' };
}`;
const INIT = `(async () => {
  window.__tts = (async () => {
    const { KokoroTTS } = await import(${JSON.stringify(KOKORO_URL)});
    const M = 'onnx-community/Kokoro-82M-v1.0-ONNX';
    try {
      if (!navigator.gpu || !(await navigator.gpu.requestAdapter())) throw new Error('no WebGPU');
      const tts = await KokoroTTS.from_pretrained(M, { dtype: 'fp32', device: 'webgpu' });
      await tts.generate('Warm up.', { voice: 'af_heart' });
      return { tts, dev: 'webgpu fp32' };
    } catch (e) { return { tts: await KokoroTTS.from_pretrained(M, { dtype: 'q8', device: 'wasm' }), dev: 'wasm q8 (' + e.message + ')' }; }
  })();
  return (await window.__tts).dev;
})()`;
const RENDER = `async (say, voice, speed, bitrate) => {
  const { tts } = await window.__tts;
  const a = await tts.generate(say, { voice, speed });
  const sr = a.sampling_rate; let x = a.audio;
  let s = 0, e = x.length - 1; const th = 0.008;
  while (s < e && Math.abs(x[s]) < th) s++; while (e > s && Math.abs(x[e]) < th) e--;
  x = x.slice(Math.max(0, s - Math.round(sr * 0.03)), Math.min(x.length, e + Math.round(sr * 0.12)));
  let pk = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > pk) pk = v; }
  const g = pk > 0 ? Math.min(4, 0.89 / pk) : 1; for (let i = 0; i < x.length; i++) x[i] *= g;
  const b64 = (u8) => { let s2 = ''; for (let i = 0; i < u8.length; i += 0x8000) s2 += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s2); };
  const chunks = []; let desc = null, err = null;
  const enc = new AudioEncoder({
    output: (c, meta) => { const u = new Uint8Array(c.byteLength); c.copyTo(u); chunks.push([c.timestamp, c.duration || 0, b64(u)]); const d = meta && meta.decoderConfig && meta.decoderConfig.description; if (d && !desc) desc = b64(new Uint8Array(d.buffer ? d.buffer.slice(d.byteOffset || 0, (d.byteOffset || 0) + d.byteLength) : d)); },
    error: (e2) => { err = e2; },
  });
  enc.configure({ codec: 'opus', sampleRate: sr, numberOfChannels: 1, bitrate });
  enc.encode(new AudioData({ format: 'f32', sampleRate: sr, numberOfFrames: x.length, numberOfChannels: 1, timestamp: 0, data: x }));
  await enc.flush(); enc.close();
  if (err) throw err;
  return { ms: Math.round((x.length / sr) * 1000), sr, chunks, desc };
}`;
const CHECK = `async (url) => { const b = await (await fetch(url, { cache: 'no-store' })).arrayBuffer(); const c = new OfflineAudioContext(1, 48000, 48000); const d = await c.decodeAudioData(b); return Math.round(d.duration * 1000); }`;

// ---------------------------------------------------------------- main
function sizeOf(dir) { let n = 0; if (!fs.existsSync(dir)) return 0; for (const f of fs.readdirSync(dir, { withFileTypes: true })) n += f.isDirectory() ? sizeOf(path.join(dir, f.name)) : fs.statSync(path.join(dir, f.name)).size; return n; }
async function main() {
  const t0 = Date.now();
  let GAMES = {};
  try { GAMES = require('../box').GAMES; } catch (e) { console.warn('Could not read box/index.js (' + e.message + '); assuming cast mode.'); }
  const info = {};
  for (const [k, d] of Object.entries(GAMES)) info[k] = { title: d.name, mode: d.show === true || (d.show && d.show.facts !== false) ? 'facts' : 'cast' };
  const keys = ['generic', ...fs.readdirSync(INTROS).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3)).sort()];
  const mfPath = path.join(OUT, 'manifest.json');
  let old = { clips: {}, games: {} };
  try { old = JSON.parse(fs.readFileSync(mfPath, 'utf8')); } catch { /* first run */ }

  await startServer(PORT);
  const { page, close } = await launch();
  try {
    await page.go(`http://localhost:${PORT}/box/voice.js`); // any CSP-free page on the origin
    await page.eval(`document.documentElement.innerHTML = "<head></head><body></body>"`);
    await page.eval(`(async () => { document.title = 'voice-gen'; const load = (src) => new Promise((r, j) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = () => j(new Error(src)); document.head.appendChild(s); });
      for (const s of ['/box/box.js', '/box/show.js', '/box/howto.js', '/box/voice.js']) await load(s); return !!(BOX.voice && BOX.voice.keyOf); })()`);

    // 1. collect
    const jobs = new Map(), games = {}, notes = [];
    for (const key of keys) {
      let r;
      try { r = await page.eval(`(${COLLECT})(${JSON.stringify(key)}, ${JSON.stringify(info[key] || {})})`); } catch (e) { r = { lines: [], note: 'failed: ' + e.message.split('\n')[0] }; }
      if (r.note) notes.push(`${key}: ${r.note}`);
      if (!r.lines.length) {
        // Keep what this game had, so a half-edited intro doesn't lose its clips.
        if (old.games && old.games[key] && /did not load|failed/.test(r.note)) { games[key] = old.games[key].filter((h) => old.clips[h]); for (const h of games[key]) if (!jobs.has(h)) jobs.set(h, { ...old.clips[h], h, keep: true }); }
        continue;
      }
      games[key] = [];
      for (const L of r.lines) {
        if (!games[key].includes(L.h)) games[key].push(L.h);
        if (!jobs.has(L.h)) jobs.set(L.h, { h: L.h, g: key, t: L.t, say: L.say, v: L.voice.kokoro, s: L.voice.speed, from: L.from });
      }
    }
    if (LIST) { for (const j of jobs.values()) console.log(`${j.g.padEnd(11)} ${String(j.v).padEnd(10)} ${String(j.from || '').padEnd(7)} ${j.say || j.t}`); console.log(jobs.size + ' lines'); notes.forEach((n) => console.log('note: ' + n)); return; }

    // 2. what needs rendering
    const todo = [], clips = {};
    for (const j of jobs.values()) {
      const o = old.clips && old.clips[j.h], g = o ? o.g : j.g, file = path.join(OUT, g, j.h + '.webm');
      if (!FORCE && o && o.ms && fs.existsSync(file)) { clips[j.h] = { g, ms: o.ms, v: o.v, s: o.s, t: o.t || j.t }; continue; }
      if (j.keep) continue;
      if (only.length && !only.includes(j.g)) continue;
      todo.push(j);
    }
    console.log(`${jobs.size} lines in ${Object.keys(games).length} games; ${jobs.size - todo.length} up to date, ${todo.length} to render.`);

    // 3. render
    if (todo.length) {
      const dev = await page.eval(INIT);
      console.log('Kokoro on ' + dev + ` (model load ${((Date.now() - t0) / 1000).toFixed(1)} s in)`);
      const tr = Date.now(); let audioMs = 0, checked = false;
      for (let i = 0; i < todo.length; i++) {
        const j = todo[i];
        try {
          const r = await page.eval(`(${RENDER})(${JSON.stringify(j.say)}, ${JSON.stringify(j.v)}, ${j.s}, ${BITRATE})`);
          const buf = webm({ chunks: r.chunks, sr: r.sr, desc: r.desc ? Buffer.from(r.desc, 'base64') : null, ms: r.ms });
          fs.mkdirSync(path.join(OUT, j.g), { recursive: true });
          fs.writeFileSync(path.join(OUT, j.g, j.h + '.webm'), buf);
          clips[j.h] = { g: j.g, ms: r.ms, v: j.v, s: j.s, t: j.t };
          audioMs += r.ms;
          if (!checked) { checked = true; const d = await page.eval(`(${CHECK})('/audio/voice/${j.g}/${j.h}.webm')`); if (Math.abs(d - r.ms) > 150) console.warn(`  decode check: ${d} ms vs ${r.ms} ms rendered`); else console.log(`  decode check ok (${d} ms)`); }
          if ((i + 1) % 25 === 0 || i === todo.length - 1) console.log(`  ${i + 1}/${todo.length}  ${((Date.now() - tr) / 1000).toFixed(0)} s`);
        } catch (e) { console.warn(`  FAILED ${j.g} "${j.t.slice(0, 50)}": ${e.message.split('\n')[0]}`); }
      }
      console.log(`Rendered ${(audioMs / 1000).toFixed(0)} s of speech in ${((Date.now() - tr) / 1000).toFixed(0)} s.`);
    }

    // 4. manifest + prune
    for (const k of Object.keys(games)) { games[k] = games[k].filter((h) => clips[h]); if (!games[k].length) delete games[k]; }
    const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
    const voices = {};
    for (const k of Object.keys(games)) { const c = clips[games[k][0]]; if (c) voices[k] = `${c.v}@${c.s}`; }
    const mf = { v: 1, about: 'Pre-rendered narrator clips (Kokoro-82M, Apache-2.0, via kokoro-js). Made by tools/voice-gen.js (npm run voices); do not edit.', voices: sorted(voices), games: sorted(games), clips: sorted(clips) };
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(mfPath, JSON.stringify(mf, null, 0).replace(/\],"/g, '],\n"').replace(/\},"/g, '},\n"') + '\n');
    let removed = 0;
    for (const d of fs.readdirSync(OUT, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const dir = path.join(OUT, d.name);
      for (const f of fs.readdirSync(dir)) { const h = f.replace(/\.webm$/, ''); if (!clips[h] || clips[h].g !== d.name) { fs.unlinkSync(path.join(dir, f)); removed++; } }
      if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
    }
    const n = Object.keys(clips).length, bytes = sizeOf(OUT);
    for (const k of Object.keys(games)) console.log(`  ${k.padEnd(11)} ${String(games[k].length).padStart(3)} clips  ${voices[k]}`);
    notes.forEach((x) => console.log('note: ' + x));
    console.log(`${n} clips, ${(bytes / 1048576).toFixed(2)} MB in public/audio/voice (${removed} unused removed). ${((Date.now() - t0) / 1000).toFixed(0)} s total.`);
  } finally { close(); cleanup(); }
}
main().then(() => process.exit(0), (e) => { console.error(e); cleanup(); process.exit(1); });
