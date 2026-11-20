'use strict';
// Narration timing for the intro cutscenes and the how-to (used by box/show.js).
//
// The TV speaks the intro's lines with pre-rendered voice clips (public/audio/voice, made by
// tools/voice-gen.js). The server owns the clock, so it has to know how long each line takes:
// otherwise a shot, a step or the whole intro ends while the narrator is still talking and the
// next line (or the game) cuts it off. This file reads, on the server:
//   - the intro files themselves (public/box/intros/<key>.js, run in a sandbox: only their data
//     is used: castOpening/opening shots with `say`, `lines`, `tutorial`, `story`, host.voice),
//   - the generic intro in public/box/show.js (its lines and shots fill in what an intro lacks),
//   - public/box/voice.js for the exact text cleaning + clip key the TV uses,
//   - public/audio/voice/manifest.json for each clip's length (ms).
// and lays every narrated stretch out so it lasts at least the clip + MARGIN. A line with no clip
// (names, fun facts, a missing render) gets an estimate for the browser voice instead.
// Everything is cached and reloaded when a file changes.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', 'public');
const INTROS = path.join(PUB, 'box', 'intros');
const MANIFEST = path.join(PUB, 'audio', 'voice', 'manifest.json');
const MARGIN = 800; // ms of air after every narrated line before the next thing happens
const STEP_MIN_MS = 5500; // a how-to step stays up at least this long (time to read the card)
const DONE_LINE = 'That’s it. Let’s play!'; // public/box/howto.js says it when the steps are done

// A do-nothing stand-in for the browser objects the files touch while loading.
function stub() {
  const f = function () {};
  const p = new Proxy(f, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === 'then') return undefined;
      if (k === Symbol.iterator) return function* () {};
      if (k === 'length') return 0;
      return p;
    },
    apply: () => p, construct: () => p, set: () => true,
  });
  return p;
}
function sandbox() {
  const S = stub();
  const quiet = { log() {}, warn() {}, error() {}, info() {} };
  const ctx = { BOX: { intros: {}, games: {}, esc: (s) => String(s), sfx() {} }, document: S, navigator: undefined, console: quiet, Math, Date, performance: { now: () => 0 }, setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 0, cancelAnimationFrame() {}, Image: function () { return S; }, CustomEvent: function () {} };
  ctx.window = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  return ctx;
}
const mtime = (f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };
function run(ctx, file) { vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file, timeout: 3000 }); }

// ---- the engine: generic intro + the voice text functions (loaded once, reloaded on change) ----
let core = null;
function engine() {
  const files = [path.join(PUB, 'box', 'show.js'), path.join(PUB, 'box', 'voice.js')];
  const sig = files.map(mtime).join('|');
  if (core && core.sig === sig) return core;
  const ctx = sandbox();
  ctx.BOX.studio = stub(); // show.js replaces it; intros loaded later get the stub
  try { run(ctx, files[0]); } catch (e) { /* the generic intro is optional */ }
  run(ctx, files[1]);
  const V = ctx.BOX.voice;
  core = { sig, G: ctx.BOX.intros.generic || { lines: {}, opening: [], castOpening: [] }, clean: V.clean, keyOf: V.keyOf, spoken: V.spoken, voiceOf: V.voiceOf, nameless: (ctx.BOX.studio && ctx.BOX.studio.nameless) || null };
  return core;
}

// ---- the clip manifest ----
let mf = null, mfAt = -1;
function manifest() {
  const t = mtime(MANIFEST);
  if (mf && t === mfAt) return mf;
  try { mf = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { mf = null; }
  if (!mf || !mf.clips) mf = { clips: {}, games: {}, voices: {} };
  mfAt = t;
  return mf;
}

// ---- one game's intro (data only) ----
const intros = new Map(); // key -> { at, I }
function intro(key) {
  const file = path.join(INTROS, String(key).replace(/[^a-z0-9_-]/gi, '') + '.js');
  const t = mtime(file);
  if (!t) return null;
  const c = intros.get(key);
  if (c && c.at === t) return c.I;
  let I = null;
  try { const ctx = sandbox(); ctx.BOX.studio = stub(); run(ctx, file); I = ctx.BOX.intros[key] || null; } catch { I = null; }
  intros.set(key, { at: t, I });
  return I;
}

// How long a line takes on the TV: its clip, else an estimate for the browser voice.
// -> { ms, clip: true|false, text }
const estimate = (text) => Math.round(String(text).length * 70 + 500);
function line(text, spec) {
  const E = engine(), t = E.clean(text);
  if (!t) return { ms: 0, clip: false, text: '' };
  const c = manifest().clips[E.keyOf(t, spec)];
  return c && c.ms ? { ms: c.ms, clip: true, text: t } : { ms: estimate(t), clip: false, text: t };
}
const fill = (s, v) => String(s || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : ''));

// Everything the timing needs about a game, from its intro (or the generic one).
function info(def) {
  const E = engine(), I = intro(def.key), G = E.G;
  const base = I || G;
  const spec = (I ? I.host && I.host.voice : G.host && G.host.voice) || null;
  const title = (I && I.title) || def.name || '';
  const L = { ...(G.lines || {}), ...((I && I.lines) || {}) };
  const say = (k, v = {}) => { const x = L[k]; const s = Array.isArray(x) ? x[(v.i || 0) % x.length] : x; return s ? fill(s, { title, ...v }) : ''; };
  return { I, G, base, spec, title, L, say };
}

// The opening shots, each stretched so a line said in it ends (+ MARGIN) before the next shot.
// -> [{ ms, base, sayAt, say, need }]
function shots(def, mode) {
  const N = info(def), I = N.I, G = N.G;
  const list = mode === 'facts' ? (I && I.opening) || G.opening || [] : (I && (I.castOpening || I.opening)) || G.castOpening || [];
  return list.map((s) => {
    const base = Math.max(0, Number(s.ms) || 0);
    if (!s.say) return { ms: base, base, sayAt: 0, say: null, need: 0 };
    const at = Math.max(0, Number(s.sayAt) || 0), L = line(N.say(s.say), N.spec);
    const need = L.ms ? at + L.ms + MARGIN : 0;
    return { ms: Math.max(base, need), base, sayAt: at, say: s.say, need, clip: L.clip };
  });
}

// Cast mode: opening shots, the roll call (n cards perMs apart + its lines), the outro.
function cast(def, n, more, o = {}) {
  const per = o.perMs || 900, outroMin = o.outroMs || 3000;
  const N = info(def), sh = shots(def, 'cast');
  const openMs = sh.reduce((a, s) => a + s.ms, 0) || o.openMs || 7000;
  const roll = line(N.say('roll'), N.spec);
  let rollMs = Math.max(n * per, roll.ms ? roll.ms + MARGIN : 0), moreAt = null;
  if (more > 0) {
    // The voice says the name-free lead (show.js nameless(): '…and more!'), the screen shows the count.
    const E = engine(), raw = [].concat(N.L.more || [])[0] || '';
    const m = line(E.nameless ? fill(E.nameless(raw), { title: N.title }) : N.say('more', { n: more }), N.spec);
    moreAt = Math.max(n * per - 1400, roll.ms ? roll.ms + MARGIN : 0);
    rollMs = Math.max(rollMs, moreAt + m.ms + MARGIN);
  }
  const play = line(N.say('play'), N.spec);
  const outroMs = Math.max(outroMin, play.ms ? play.ms + MARGIN + 300 : 0);
  return { openShots: sh.map((s) => s.ms), openMs, perMs: per, rollMs, moreAt, outroMs, total: openMs + rollMs + outroMs };
}

// Game-show mode ('facts'): the opening (its shots + the joke) and the outro; the contestant
// reveals are timed per line in reveals().
function facts(def, o = {}) {
  const N = info(def), sh = shots(def, 'facts');
  const openMs = sh.reduce((a, s) => a + s.ms, 0);
  const joke = line(N.say('joke'), N.spec);
  const minMs = Math.max(o.minMs || 20000, openMs + (joke.ms ? 600 + joke.ms + MARGIN : 0));
  const others = line(N.say('others'), N.spec), play = line(N.say('play'), N.spec);
  return { openShots: sh.map((s) => s.ms), openMs, minMs, othersMs: others.ms ? Math.max(2600, others.ms + MARGIN) : 2600, playMs: Math.max((o.outroMs || 6000) - 2600, play.ms + MARGIN + 600) };
}
// One contestant reveal: the line starts 250 ms in (show.js reveals()) and must end before the next.
function reveal(text, perMin) { return Math.max(perMin || 5200, 250 + estimate(text) + MARGIN); }

// How to play: one entry per tutorial step (ms), then the "That's it" card.
function howto(def) {
  const N = info(def), I = N.I;
  const steps = I && Array.isArray(I.tutorial) && I.tutorial.length ? I.tutorial.slice(0, 8) : null;
  if (!steps) return null;
  const ms = steps.map((s) => { const L = line(s.say || [s.title, s.text].filter(Boolean).join('. '), N.spec); return Math.max(STEP_MIN_MS, L.ms + MARGIN); });
  const lines = steps.map((s) => line(s.say || [s.title, s.text].filter(Boolean).join('. '), N.spec).ms);
  const done = line(DONE_LINE, N.spec);
  return { steps: ms, lines, endMs: Math.max(2500, done.ms + MARGIN), total: ms.reduce((a, x) => a + x, 0) + Math.max(2500, done.ms + MARGIN) };
}

module.exports = { MARGIN, STEP_MIN_MS, DONE_LINE, engine, manifest, intro, info, line, estimate, shots, cast, facts, reveal, howto };
