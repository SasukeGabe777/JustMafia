'use strict';
// Pre-render every narrator / host line as a voice clip (`npm run voices`).
//
//   node tools/voice-gen.js                 render every new or changed line, prune unused clips
//   node tools/voice-gen.js price likely    only render these games ('mafia' = the JustMafia narrator)
//   node tools/voice-gen.js --list          print the lines, render nothing
//   node tools/voice-gen.js --force         re-render everything (or only the games named)
//   node tools/voice-gen.js --engine kokoro use the old Kokoro-only path (no Python needed)
//   node tools/voice-gen.js --encode-only   encode what an interrupted Chatterbox run already made
//   node tools/voice-gen.js --sheet lines.csv          write a recording sheet (line id, character, text)
//   node tools/voice-gen.js --recordings <dir> [games] voice lines from your own recordings: <dir>/<line id>.wav
//        (or .webm .mp3 .m4a .ogg .flac), one take per line, any voice; Chatterbox voice conversion
//        turns each take into that character's voice (the delivery stays yours). Recorded clips are
//        kept (e=rec) by later TTS runs; --force re-converts them.
//
// What it renders:
//  * JustGameBox: every STATIC line a game's intro speaks (public/box/intros/<key>.js: the opening
//    shots' `say` lines, joke/banter/meet/others/play in 'facts' mode, roll/play in 'cast' mode,
//    with {title} filled in; lines with {name} or {n} are spoken as their name-free lead, see
//    public/box/show.js nameless()) and every how-to step exactly as public/box/howto.js speaks it.
//    The voice is the intro's host.voice (kokoro identity + cb delivery preset).
//  * JustMafia: every line the narrator can say (tools/voice-lines-mafia.js: narrator.js and theme
//    narration, cutscene captions, role reveals) in each world's narrator voice
//    (public/shared/narration-say.js). Clips go to public/audio/voice/mafia-<voice>/.
// Text cleaning, the speakable form and the clip key come from public/box/voice.js (run in the
// page) and public/shared/narration-say.js, so the TVs look clips up the same way.
//
// Engines
//  chatterbox (default) Chatterbox TTS (Resemble AI, MIT; weights ResembleAI/chatterbox) on CUDA,
//    run by tools/voice-chatterbox.py in a Python venv (VOICE_PY, default
//    %LOCALAPPDATA%/jgb-voice/venv; set up: see the PLAN.md "Voices" notes). Each host's voice is
//    cloned from a ~10 s reference stitched from that Kokoro voice's own clips (kept in
//    tools/voice-refs/<voice>.webm so a fresh checkout clones the same voices), with a delivery
//    preset per host (PRESETS). Every clip is transcribed back with faster-whisper and re-rendered
//    when the words do not match, it has a long silence or it clips; the manifest keeps its `wer`.
//    The model's output carries Resemble's inaudible Perth watermark.
//  kokoro  kokoro-js 1.2.1 (MIT) + Kokoro-82M (Apache-2.0) in headless Chrome (WebGPU or WASM).
// Either way each clip is trimmed, loudness-normalized (speech RMS -19 dBFS, `db` in the manifest),
// encoded to mono Opus with WebCodecs in headless Chrome (muted), muxed into WebM here, written to
// public/audio/voice/<game>/<hash>.webm and listed in public/audio/voice/manifest.json.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const WebSocket = require('ws');
const { CHROME, Page, startServer, cleanup, wait } = require('./cdp');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'audio', 'voice');
const INTROS = path.join(ROOT, 'public', 'box', 'intros');
const REFS = path.join(__dirname, 'voice-refs');
const PORT = Number(process.env.VOICE_PORT) || 3431;
const DEBUG = Number(process.env.VOICE_DEBUG_PORT) || 9431;
const PROFILE = process.env.VOICE_PROFILE || path.join(os.tmpdir(), 'jgb-kokoro-profile');
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share');
const PY = process.env.VOICE_PY || path.join(LOCAL, 'jgb-voice', 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const CACHE = process.env.VOICE_CACHE || path.join(LOCAL, 'jgb-voice', 'render');
const KOKORO_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
const BITRATE = 24000;
const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const only = args.filter((a, i) => !a.startsWith('--') && !['--engine', '--sheet', '--recordings'].includes(args[i - 1]));
const FORCE = args.includes('--force'), LIST = args.includes('--list'), ENCODE_ONLY = args.includes('--encode-only');
// Render order (Chatterbox): what players hear most first, the short role reveals last.
const PRI = { caption: 1, game: 1, lead: 1, surprise: 1, extra: 1, role: 2 };
const ENGINE = opt('--engine') || (fs.existsSync(PY) ? 'orpheus' : 'kokoro');
const E_TAG = { orpheus: 'or', chatterbox: 'cb', kokoro: 'kokoro' }[ENGINE];
if (!E_TAG) throw new Error('--engine orpheus | chatterbox | kokoro');
const SHEET = opt('--sheet'), RECS = opt('--recordings');
// <line id>.<ext> files in the recordings folder -> { id: path }
const recordings = () => { const r = {}; if (RECS) for (const f of fs.readdirSync(RECS)) { const m = /^([0-9a-f]{16})\.(wav|webm|mp3|m4a|ogg|flac)$/i.exec(f); if (m) r[m[1]] = path.join(RECS, f); } return r; };

// Chatterbox delivery presets (spec.cb). exaggeration: emotion intensity (0.25-2, 0.5 neutral);
// cfg: how closely it follows the reference's pacing (lower = freer, slower, more dramatic);
// temperature: variety. Energetic hosts use 'hype', narrators 'narrator'.
const PRESETS = {
  narrator: { exaggeration: 0.45, cfg: 0.5, temperature: 0.7 }, // JustMafia: calm, measured storyteller
  calm: { exaggeration: 0.4, cfg: 0.5, temperature: 0.7 },
  dry: { exaggeration: 0.35, cfg: 0.55, temperature: 0.7 }, // deadpan, clipped
  warm: { exaggeration: 0.55, cfg: 0.45, temperature: 0.75 }, // friendly default
  spooky: { exaggeration: 0.6, cfg: 0.35, temperature: 0.75 }, // slow and dramatic
  hype: { exaggeration: 0.75, cfg: 0.35, temperature: 0.8 }, // game-show energy
};

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
// A float WAV (as written by soundfile) -> { sr, data: Float32Array }
function readWav(file) {
  const b = fs.readFileSync(file);
  let p = 12, fmt = null, sr = 0, bits = 0, ch = 1;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), n = b.readUInt32LE(p + 4), s = p + 8;
    if (id === 'fmt ') { fmt = b.readUInt16LE(s); ch = b.readUInt16LE(s + 2); sr = b.readUInt32LE(s + 4); bits = b.readUInt16LE(s + 14); if (fmt === 0xfffe) fmt = b.readUInt16LE(s + 24); }
    if (id === 'data') {
      const len = Math.floor(Math.min(n, b.length - s) / (bits / 8) / ch), out = new Float32Array(len);
      for (let i = 0; i < len; i++) { const o = s + i * ch * (bits / 8); out[i] = fmt === 3 ? b.readFloatLE(o) : b.readInt16LE(o) / 32768; }
      return { sr, data: out };
    }
    p = s + n + (n & 1);
  }
  throw new Error('no data in ' + file);
}

// ---------------------------------------------------------------- headless Chrome (persistent profile, muted)
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
const COLLECT = `async (key, gi, extra) => {
  const B = window.BOX, V = B.voice, G = B.intros.generic;
  const load = (src) => new Promise((r) => { const s = document.createElement('script'); s.src = src; s.onload = () => r(true); s.onerror = () => r(false); document.head.appendChild(s); });
  let I = key === 'generic' ? G : null;
  if (!I) { await new Promise((r) => { B.studio.need(key, r); setTimeout(r, 6000); }); I = B.intros[key]; }
  if (!I) return { lines: [], note: 'intro file did not load' };
  if (key !== 'generic' && !(I.tutorial && I.tutorial.length) && !I.opening && !I.castOpening && !I.host) return { lines: [], note: 'unfinished (template intro), skipped' };
  const fill = (s, v) => String(s || '').replace(/\\{(\\w+)\\}/g, (m, k) => (v[k] != null ? v[k] : ''));
  const title = key === 'generic' ? '' : (I.title || gi.title || '');
  const out = [];
  // An intro with variants (YesChef's kitchens, each with its own host and voice) is collected once per variant.
  const variants = I.onShow && Array.isArray(I.variants) && I.variants.length ? I.variants : [null];
  for (const vx of variants) {
  if (vx) I.onShow({ extra: vx, mode: gi.mode || 'cast' });
  const L = { ...G.lines, ...(I.lines || {}) }, spec = (I.host && I.host.voice) || null;
  const add =(from, text, sp) => { const t = V.clean(text); if (t) out.push({ from, t, say: V.spoken(t), voice: V.voiceOf(sp), h: V.keyOf(t, sp) }); };
  const modes = key === 'generic' ? ['facts', 'cast'] : [gi.mode || 'cast'];
  const want = new Set();
  for (const mode of modes) {
    const shots = mode === 'facts' ? (I.opening || G.opening) : (I.castOpening || I.opening || G.castOpening);
    for (const s of shots || []) if (s && s.say) want.add(s.say);
    for (const k of mode === 'facts' ? ['joke', 'banter', 'meet', 'others', 'play'] : ['roll', 'play', 'more']) want.add(k);
    // Contestant reveals are spoken as the name-free lead ("Give it up for…", show.js factSpoken()).
    if (mode === 'facts') for (const raw of [].concat(L.first || [], L.intros || [], L.last || [])) {
      const nl = fill(B.studio.nameless(raw), { title }); if (!nl) continue;
      add('lead', nl, spec); if (L.noFact) add('lead', nl + ' ' + fill(L.noFact, {}), spec);
    }
  }
  for (const k of want) for (const raw of [].concat(L[k] || [])) {
    if (!title && /\\{title\\}/.test(raw)) continue;
    // A line with a name or a count is spoken as its name-free form (show.js nameless()).
    if (/\\{(name|n)\\}/.test(raw)) { const nl = B.studio.nameless(raw); if (nl) add(k, fill(nl, { title }), spec); continue; }
    add(k, fill(raw, { title }), spec);
  }
  // The game's own static host lines (react({ line: '…' }) in public/box/games/<key>.js).
  if (!vx) for (const t of extra || []) add('game', t, spec);
  if (key !== 'generic') {
    if (!(I.tutorial && I.tutorial.length) && !B.games[key]) await load('/box/games/' + key + '.js');
    const steps = B.howtoSteps(key) || [];
    if (steps.some((s) => /^step (one|two|three)\\.?$/i.test(String(s.text || '').trim()))) return { lines: [], note: 'unfinished (placeholder how-to steps), skipped' };
    steps.forEach((s, i) => add('step' + (i + 1), s.say || [s.title, s.text].filter(Boolean).join('. '), spec));
    if (steps.length) add('done', 'That’s it. Let’s play!', spec);
    for (const t of [].concat(I.story || [])) add('story', t, spec);
  }
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
// Trim, level and encode one clip (in the page). norm=false keeps the level (reference clips).
const PROCESS = `window.__process = async (x, sr, bitrate, norm = true) => {
  let s = 0, e = x.length - 1; const th = 0.008;
  while (s < e && Math.abs(x[s]) < th) s++; while (e > s && Math.abs(x[e]) < th) e--;
  x = x.slice(Math.max(0, s - Math.round(sr * 0.03)), Math.min(x.length, e + Math.round(sr * 0.12)));
  // Loudness: every clip to the same speech level (RMS of the 20 ms windows that have speech in
  // them, -19 dBFS), so no voice is louder than another; a soft knee above 0.75 rounds off the
  // rare peaks instead of turning the whole clip down (the peak stays under 0.99).
  const win = Math.max(1, Math.round(sr * 0.02));
  const level = () => { let pw = 0, nw = 0; for (let i = 0; i + win <= x.length; i += win) { let e2 = 0; for (let j = i; j < i + win; j++) e2 += x[j] * x[j]; e2 /= win; if (e2 > 1e-5) { pw += e2; nw++; } } return nw ? Math.sqrt(pw / nw) : 0; };
  if (norm) {
    const rms = level(), TARGET = 0.112, KNEE = 0.75;
    const g = rms > 0 ? Math.min(8, TARGET / rms) : 1;
    for (let i = 0; i < x.length; i++) { let v = x[i] * g; const a = Math.abs(v); if (a > KNEE) v = Math.sign(v) * (KNEE + (0.99 - KNEE) * Math.tanh((a - KNEE) / (0.99 - KNEE))); x[i] = v; }
  }
  const out = level(), db = out > 0 ? Math.round(20 * Math.log10(out) * 10) / 10 : -99;
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
  return { ms: Math.round((x.length / sr) * 1000), sr, chunks, desc, db };
}`;
const RENDER = `async (say, voice, speed, bitrate) => { const { tts } = await window.__tts; const a = await tts.generate(say, { voice, speed }); return window.__process(a.audio, a.sampling_rate, bitrate); }`;
const RENDER_PCM = `async (b64, sr, bitrate, norm) => { const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return window.__process(new Float32Array(u8.buffer), sr, bitrate, norm); }`;
const CHECK = `async (url) => { const b = await (await fetch(url, { cache: 'no-store' })).arrayBuffer(); const c = new OfflineAudioContext(1, 48000, 48000); const d = await c.decodeAudioData(b); return Math.round(d.duration * 1000); }`;

// ---------------------------------------------------------------- Chatterbox (Python)
function runPython(jobsFile, script) {
  return new Promise((resolve, reject) => {
    const p = spawn(PY, ['-I', path.join(__dirname, script), jobsFile, CACHE], { env: { ...process.env, PYTHONIOENCODING: 'utf-8', HF_HUB_DISABLE_SYMLINKS_WARNING: '1', TRANSFORMERS_VERBOSITY: 'error' }, stdio: ['ignore', 'pipe', 'pipe'] });
    const show = (b) => { for (const ln of String(b).split(/\r?\n|\r/)) if (ln.trim() && !/it\/s\]|s\/it\]|Sampling|FutureWarning|deprecate\(|unauthenticated|LoRACompatible|^\s*\d+%\|/.test(ln)) console.log('  ' + ln.trim()); };
    p.stdout.on('data', show); p.stderr.on('data', show);
    p.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(script + ' exited with ' + c))));
  });
}
function readResults() {
  const r = {}, f = path.join(CACHE, 'results.jsonl');
  if (fs.existsSync(f)) for (const ln of fs.readFileSync(f, 'utf8').split('\n')) { try { const x = JSON.parse(ln); r[x.id] = x; } catch { /* partial line */ } }
  return r;
}
// Forget cached renders (--force), so Python makes them again.
function forget(ids) {
  const f = path.join(CACHE, 'results.jsonl'); if (!fs.existsSync(f) || !ids.size) return;
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8').split('\n').filter((ln) => { try { return !ids.has(JSON.parse(ln).id); } catch { return false; } }).join('\n'));
  for (const id of ids) try { fs.unlinkSync(path.join(CACHE, id + '.wav')); } catch { /* none */ }
}
const encodeTo = async (page, file, pcm, norm, bitrate = BITRATE) => {
  const r = await page.eval(`(${RENDER_PCM})(${JSON.stringify(Buffer.from(pcm.data.buffer, pcm.data.byteOffset, pcm.data.byteLength).toString('base64'))}, ${pcm.sr}, ${bitrate}, ${norm})`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, webm({ chunks: r.chunks, sr: r.sr, desc: r.desc ? Buffer.from(r.desc, 'base64') : null, ms: r.ms }));
  return r;
};

// A game's static in-play host lines: `line: '…'` and `line: pick(['…', '…'])` in its TV code.
// (Lines built at run time, with names or numbers, stay with the browser voice.)
function gameLines(key) {
  const f = path.join(ROOT, 'public', 'box', 'games', key + '.js');
  if (!fs.existsSync(f)) return [];
  const src = fs.readFileSync(f, 'utf8'), out = [], lit = /'((?:[^'\\\n]|\\.)*)'/g;
  for (const m of src.matchAll(/\bline:\s*(?:pick\(\s*\[([^\]]*)\]\s*\)|'((?:[^'\\\n]|\\.)*)'\s*[,}])/g)) {
    if (m[2] != null) out.push(m[2]); else for (const s of m[1].matchAll(lit)) out.push(s[1]);
  }
  return [...new Set(out.map((s) => s.replace(/\\(.)/g, '$1')).filter((s) => /[A-Za-z]{2}/.test(s)))];
}

// ---------------------------------------------------------------- main
function sizeOf(dir) { let n = 0; if (!fs.existsSync(dir)) return 0; for (const f of fs.readdirSync(dir, { withFileTypes: true })) n += f.isDirectory() ? sizeOf(path.join(dir, f.name)) : fs.statSync(path.join(dir, f.name)).size; return n; }
const wanted = (g) => !only.length || only.includes(g) || (only.includes('mafia') && g.startsWith('mafia-'));
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
  if (ENGINE !== 'kokoro' && !fs.existsSync(PY)) throw new Error('No Python venv at ' + PY + ' (set VOICE_PY, or use --engine kokoro). See PLAN.md "Voices".');

  await startServer(PORT);
  const { page, close } = await launch();
  try {
    await page.go(`http://localhost:${PORT}/box/voice.js`); // any CSP-free page on the origin
    await page.eval(`document.documentElement.innerHTML = "<head></head><body></body>"`);
    await page.eval(`(async () => { document.title = 'voice-gen'; const load = (src) => new Promise((r, j) => { const s = document.createElement('script'); s.src = src; s.onload = r; s.onerror = () => j(new Error(src)); document.head.appendChild(s); });
      for (const s of ['/box/box.js', '/box/show.js', '/box/howto.js', '/box/voice.js']) await load(s); return !!(BOX.voice && BOX.voice.keyOf); })()`);
    await page.eval(PROCESS);

    // 1. collect
    const jobs = new Map(), games = {}, notes = [];
    const addJob = (key, L) => {
      if (!games[key].includes(L.h)) games[key].push(L.h);
      if (!jobs.has(L.h)) jobs.set(L.h, { h: L.h, g: key, t: L.t, say: L.say, v: L.voice.kokoro, s: L.voice.speed, cb: L.voice.cb || null, o: L.voice.orpheus || null, from: L.from });
    };
    for (const key of keys) {
      let r;
      try { r = await page.eval(`(${COLLECT})(${JSON.stringify(key)}, ${JSON.stringify(info[key] || {})}, ${JSON.stringify(gameLines(key))})`); } catch (e) { r = { lines: [], note: 'failed: ' + e.message.split('\n')[0] }; }
      if (r.note) notes.push(`${key}: ${r.note}`);
      if (!r.lines.length) {
        // Keep what this game had, so a half-edited intro doesn't lose its clips.
        if (old.games && old.games[key] && /did not load|failed/.test(r.note)) { games[key] = old.games[key].filter((h) => old.clips[h]); for (const h of games[key]) if (!jobs.has(h)) jobs.set(h, { ...old.clips[h], h, keep: true }); }
        continue;
      }
      games[key] = [];
      for (const L of r.lines) addJob(key, L);
    }
    // JustMafia narrator lines (spoken form made in the page, like the box lines).
    const mafia = require('./voice-lines-mafia').collect();
    const said = await page.eval(`(${JSON.stringify(mafia.map((l) => l.t))}).map((t) => BOX.voice.spoken(t))`);
    mafia.forEach((l, i) => { games[l.g] = games[l.g] || []; addJob(l.g, { h: l.h, t: l.t, say: said[i], voice: l.V, from: l.from }); });
    if (SHEET) {
      // A recording sheet: read each line in the character's spirit; save it as <id>.wav in one folder.
      const q = (x) => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"';
      const rows = [['id', 'game', 'character voice', 'delivery', 'kind', 'read this', 'screen text'].map(q).join(',')];
      for (const j of jobs.values()) if (wanted(j.g)) rows.push([j.h, j.g, j.v, j.cb || 'warm', j.from || '', j.say || j.t, j.t].map(q).join(','));
      fs.writeFileSync(SHEET, '\ufeff' + rows.join('\r\n') + '\r\n');
      console.log(`Recording sheet: ${rows.length - 1} lines -> ${SHEET}. Save each take as <id>.wav in one folder, then: npm run voices -- --recordings <folder>`);
      return;
    }
    if (LIST) { for (const j of jobs.values()) console.log(`${j.g.padEnd(16)} ${String(j.v).padEnd(11)} ${String(j.cb || '').padEnd(8)} ${String(j.from || '').padEnd(10)} ${j.say || j.t}`); console.log(jobs.size + ' lines'); notes.forEach((n) => console.log('note: ' + n)); return; }

    // 2. what needs rendering (a clip made by another engine is re-rendered)
    const todo = [], clips = {}, REC = recordings();
    for (const j of jobs.values()) {
      const o = old.clips && old.clips[j.h], g = o ? o.g : j.g, file = path.join(OUT, g, j.h + '.webm');
      const forced = FORCE && wanted(j.g);
      const recorded = RECS && REC[j.h] && (!o || o.e !== 'rec' || FORCE);
      if (RECS && !recorded) { if (o && fs.existsSync(file)) clips[j.h] = { ...o, g, t: o.t || j.t }; continue; } // a recordings run only converts takes
      const current = !recorded && o && o.ms && fs.existsSync(file) && ((o.e || 'kokoro') === E_TAG || o.e === 'rec' || !wanted(j.g));
      if (!forced && current) { clips[j.h] = { ...o, g, t: o.t || j.t }; continue; }
      if (j.keep) { if (o && fs.existsSync(file)) clips[j.h] = { ...o, g }; continue; }
      if (!wanted(j.g)) { if (o && fs.existsSync(file)) clips[j.h] = { ...o, g }; continue; }
      todo.push(j);
    }
    console.log(`${jobs.size} lines in ${Object.keys(games).length} games; ${jobs.size - todo.length} up to date, ${todo.length} to render with ${ENGINE}.`);

    // 3. render
    const write = (j, r, extra) => { clips[j.h] = { g: j.g, ms: r.ms, v: j.v, s: j.s, ...(j.cb ? { cb: j.cb } : {}), ...(j.o ? { o: j.o } : {}), t: j.t, db: r.db, e: REC[j.h] && RECS ? 'rec' : E_TAG, ...extra }; };
    if (RECS && ENGINE === 'kokoro') throw new Error('--recordings needs the Python venv');
    if (todo.length && ENGINE === 'kokoro') {
      const dev = await page.eval(INIT);
      console.log('Kokoro on ' + dev + ` (model load ${((Date.now() - t0) / 1000).toFixed(1)} s in)`);
      const tr = Date.now(); let audioMs = 0;
      for (let i = 0; i < todo.length; i++) {
        const j = todo[i];
        try {
          const r = await page.eval(`(${RENDER})(${JSON.stringify(j.say)}, ${JSON.stringify(j.v)}, ${j.s}, ${BITRATE})`);
          fs.mkdirSync(path.join(OUT, j.g), { recursive: true });
          fs.writeFileSync(path.join(OUT, j.g, j.h + '.webm'), webm({ chunks: r.chunks, sr: r.sr, desc: r.desc ? Buffer.from(r.desc, 'base64') : null, ms: r.ms }));
          write(j, r); audioMs += r.ms;
          if ((i + 1) % 25 === 0 || i === todo.length - 1) console.log(`  ${i + 1}/${todo.length}  ${((Date.now() - tr) / 1000).toFixed(0)} s`);
        } catch (e) { console.warn(`  FAILED ${j.g} "${j.t.slice(0, 50)}": ${e.message.split('\n')[0]}`); }
      }
      console.log(`Rendered ${(audioMs / 1000).toFixed(0)} s of speech in ${((Date.now() - tr) / 1000).toFixed(0)} s.`);
    }
    if (todo.length && ENGINE !== 'kokoro') {
      fs.mkdirSync(CACHE, { recursive: true });
      if (FORCE && !ENCODE_ONLY) forget(new Set(todo.map((j) => j.h)));
      // Chatterbox (TTS, or voice conversion of your recordings) needs a reference clip per voice: the
      // repo copy (tools/voice-refs/<voice>.webm) or, the first time, the voice's own existing clips.
      // With Orpheus the character's voice is the Orpheus voice (j.o), so its references are Orpheus clips.
      const useCB = ENGINE === 'chatterbox' || RECS, vkey = (j) => (ENGINE === 'orpheus' && j.o ? 'orpheus-' + j.o : j.v);
      const ref_files = {}, ref_sources = {};
      if (useCB) for (const v of new Set(todo.map(vkey))) {
        const repo = path.join(REFS, v + '.webm');
        if (fs.existsSync(repo)) { ref_files[v] = repo; continue; }
        const mine = v.startsWith('orpheus-') ? (c) => c.o === v.slice(8) && c.e === 'or' : (c) => c.v === v && (c.e || 'kokoro') === 'kokoro';
        ref_sources[v] = Object.entries(old.clips).filter(([h, c]) => mine(c)).map(([h, c]) => path.join(OUT, c.g, h + '.webm')).filter((x) => fs.existsSync(x));
        if (!ref_sources[v].length) throw new Error('No reference for voice ' + v + ': render its lines first (npm run voices), or add tools/voice-refs/' + v + '.webm.');
      }
      const spec = useCB
        ? { ref_files, ref_sources, jobs: todo.map((j) => ({ id: j.h, text: j.say || j.t, voice: vkey(j), pri: PRI[j.from] || 0, ...(RECS && REC[j.h] ? { source: REC[j.h] } : {}), ...(PRESETS[j.cb] || PRESETS.warm) })) }
        : { jobs: todo.map((j) => ({ id: j.h, text: j.say || j.t, voice: j.o || 'leah', energetic: ['hype', 'warm'].includes(j.cb) && !/^(step|done|story|role)/.test(j.from || ''), pause: ['hype', 'warm'].includes(j.cb) ? 260 : 450, pri: PRI[j.from] || 0 })) };
      if (RECS) forget(new Set(todo.map((j) => j.h))); // a new take replaces any cached render
      const jf = path.join(CACHE, 'jobs.json');
      fs.writeFileSync(jf, JSON.stringify(spec));
      console.log(`${RECS ? 'Voice conversion of your recordings' : ENGINE}: ${todo.length} clips (${PY})`);
      if (ENCODE_ONLY) console.log('  --encode-only: using what is already rendered in ' + CACHE); else await runPython(jf, useCB ? 'voice-chatterbox.py' : 'voice-orpheus.py');
      // Keep the references in the repo (Opus 48 kbps), so every checkout clones the same voices.
      for (const v of Object.keys(ref_sources)) { const w = path.join(CACHE, 'refs', v + '.wav'); if (fs.existsSync(w)) { await encodeTo(page, path.join(REFS, v + '.webm'), readWav(w), false, 48000); console.log('  saved reference tools/voice-refs/' + v + '.webm'); } }
      const res = readResults(); let audioMs = 0, bad = 0, checked = false;
      for (const j of todo) {
        const w = path.join(CACHE, j.h + '.wav'), q = res[j.h];
        if (!q || !fs.existsSync(w)) { console.warn(`  MISSING ${j.g} "${j.t.slice(0, 50)}"`); const o = old.clips[j.h]; if (o && fs.existsSync(path.join(OUT, o.g, j.h + '.webm'))) clips[j.h] = o; continue; }
        const r = await encodeTo(page, path.join(OUT, j.g, j.h + '.webm'), readWav(w), true);
        write(j, r, { wer: q.wer }); audioMs += r.ms; if (!q.ok) bad++;
        if (!checked) { checked = true; const d = await page.eval(`(${CHECK})('/audio/voice/${j.g}/${j.h}.webm')`); console.log(Math.abs(d - r.ms) > 150 ? `  decode check: ${d} ms vs ${r.ms} ms rendered` : `  decode check ok (${d} ms)`); }
      }
      console.log(`Encoded ${(audioMs / 60000).toFixed(1)} min of speech; ${bad} clips still above the error threshold after retries (see wer in the manifest).`);
    }

    // 4. manifest + prune
    for (const k of Object.keys(games)) { games[k] = games[k].filter((h) => clips[h]); if (!games[k].length) delete games[k]; }
    const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
    const voices = {};
    for (const k of Object.keys(games)) { const c = clips[games[k][0]]; if (c) voices[k] = `${c.v}@${c.s}${c.cb ? '/' + c.cb : ''}`; }
    const mf = { v: 2, about: 'Pre-rendered voice clips: e=cb Chatterbox TTS (Resemble AI, MIT) cloned from Kokoro-82M voices (Apache-2.0); e=kokoro Kokoro-82M via kokoro-js. wer = word error rate of the transcribe-back check. Made by tools/voice-gen.js (npm run voices); do not edit.', voices: sorted(voices), games: sorted(games), clips: sorted(clips) };
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(mfPath, JSON.stringify(mf, null, 0).replace(/\],"/g, '],\n"').replace(/\},"/g, '},\n"') + '\n');
    let removed = 0;
    for (const d of fs.readdirSync(OUT, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const dir = path.join(OUT, d.name);
      for (const f of fs.readdirSync(dir)) { const h = f.replace(/\.webm$/, ''); if (!clips[h] || clips[h].g !== d.name) { fs.unlinkSync(path.join(dir, f)); removed++; } }
      if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
    }
    const all = Object.values(clips), n = all.length, bytes = sizeOf(OUT), mins = all.reduce((a, c) => a + c.ms, 0) / 60000;
    for (const k of Object.keys(games)) console.log(`  ${k.padEnd(16)} ${String(games[k].length).padStart(4)} clips  ${voices[k]}`);
    notes.forEach((x) => console.log('note: ' + x));
    const w = all.filter((c) => c.wer != null);
    if (w.length) console.log(`Transcribe-back check: mean WER ${(w.reduce((a, c) => a + c.wer, 0) / w.length * 100).toFixed(1)}%, ${w.filter((c) => c.wer > 0.12).length} clips above 12%.`);
    console.log(`${n} clips (${mins.toFixed(1)} min), ${(bytes / 1048576).toFixed(2)} MB in public/audio/voice (${removed} unused removed). ${((Date.now() - t0) / 1000).toFixed(0)} s total.`);
  } finally { close(); cleanup(); }
}
main().then(() => process.exit(0), (e) => { console.error(e); cleanup(); process.exit(1); });
