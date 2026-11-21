'use strict';
// Narrator timing + voice checks (npm test):
//  - every intro's narrated stretches (opening shots with a line, roll call, outro, every how-to
//    step, the closing card) last at least the voice clip + 700 ms;
//  - every static narrator line (intro lines, how-to steps, NPC `story` lines) has a clip;
//  - no voice is sped up past 1.1 (ALLOW_FAST lists the exceptions, with reasons);
//  - a real room (virtual clock) never starts the game before the narration has finished, and
//    no two scheduled lines overlap;
//  - the TV's line queue (public/box/voice.js, run in a sandbox with a fake clock + fake audio)
//    never plays two lines at once, drops stale lines instead of cutting, and never blocks on a
//    clip that fails or never ends;
//  - clip pacing (words per second) and loudness are in a natural range.
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const { GAMES } = require('../box');
const N = require('../box/narration');

const MIN_GAP = 700; // ms of air every line must get before the next thing
const MAX_SPEED = 1.1;
const ALLOW_FAST = {}; // gameKey: 'why this character talks fast' (none today)
let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const modeOf = (d) => (d.show === true || (d.show && d.show.facts !== false) ? 'facts' : 'cast');
const shows = Object.values(GAMES).filter((d) => d.show && !d.external);

test('every intro has its file, a tutorial, and voices for its lines', () => {
  const missing = [];
  for (const d of shows) {
    const I = N.intro(d.key);
    assert(I, d.key + ': intro file loads on the server');
    assert(Array.isArray(I.tutorial) && I.tutorial.length, d.key + ': has a tutorial');
    const { spec, say } = N.info(d);
    const lines = [];
    for (const s of N.shots(d, modeOf(d))) if (s.say) lines.push(['open:' + s.say, say(s.say)]);
    for (const k of modeOf(d) === 'facts' ? ['joke', 'others', 'play'] : ['roll', 'play']) if (say(k)) lines.push([k, say(k)]);
    I.tutorial.slice(0, 8).forEach((s, i) => lines.push(['step' + (i + 1), s.say || [s.title, s.text].filter(Boolean).join('. ')]));
    lines.push(['done', N.DONE_LINE]);
    for (const t of [].concat(I.story || [])) lines.push(['story', t]);
    for (const [from, t] of lines) if (!N.line(t, spec).clip) missing.push(`${d.key} ${from}: "${String(t).slice(0, 60)}"`);
  }
  assert.deepEqual(missing, [], 'lines without a voice clip (run npm run voices):\n' + missing.join('\n'));
});

test('intro schedule: every narrated shot, roll call, outro and how-to step outlasts its clip', () => {
  for (const d of shows) {
    const mode = modeOf(d), { spec, say } = N.info(d);
    for (const s of N.shots(d, mode)) if (s.say) {
      const L = N.line(say(s.say), spec);
      assert(s.ms >= s.sayAt + L.ms + MIN_GAP, `${d.key} opening "${s.say}": shot ${s.ms} ms < ${s.sayAt} + clip ${L.ms} + ${MIN_GAP}`);
    }
    if (mode === 'cast') {
      for (const [n, more] of [[1, 0], [4, 0], [12, 7]]) {
        const c = N.cast(d, n, more, { perMs: 900, outroMs: 3000 });
        assert.equal(c.openMs, c.openShots.reduce((a, x) => a + x, 0), d.key + ': opening = its shots');
        const roll = N.line(say('roll'), spec).ms, play = N.line(say('play'), spec).ms;
        assert(c.rollMs >= roll + MIN_GAP, `${d.key}: roll call ${c.rollMs} < clip ${roll}`);
        // The voice says the name-free form ('…and more!', show.js nameless()); the count is on screen.
        if (more) { const m = N.line(N.engine().nameless([].concat(N.info(d).L.more || [])[0] || ''), spec).ms; assert(c.moreAt >= roll + MIN_GAP && c.rollMs >= c.moreAt + m + MIN_GAP, d.key + ': "…and N more" fits'); }
        assert(c.outroMs >= play + MIN_GAP, `${d.key}: outro ${c.outroMs} < clip ${play}`);
      }
    } else {
      const f = N.facts(d, { minMs: 20000, outroMs: 6000 });
      const joke = N.line(say('joke'), spec).ms;
      assert(f.minMs >= f.openMs + 600 + joke + MIN_GAP, d.key + ': the phones step outlasts the opening + joke');
      assert(f.playMs >= N.line(say('play'), spec).ms + MIN_GAP && f.othersMs >= N.line(say('others'), spec).ms + MIN_GAP, d.key + ': outro lines fit');
    }
    const h = N.howto(d);
    h.steps.forEach((ms, i) => assert(ms >= h.lines[i] + MIN_GAP, `${d.key} how-to step ${i + 1}: ${ms} ms < clip ${h.lines[i]} + ${MIN_GAP}`));
    assert(h.endMs >= N.line(N.DONE_LINE, spec).ms + MIN_GAP, d.key + ': closing card fits');
  }
});

test(`no voice faster than ${MAX_SPEED} (natural pacing)`, () => {
  const fast = [];
  const E = N.engine();
  for (const d of shows) {
    const I = N.intro(d.key), v = E.voiceOf(I && I.host && I.host.voice);
    if (v.speed > MAX_SPEED && !ALLOW_FAST[d.key]) fast.push(`${d.key}: ${v.kokoro}@${v.speed}`);
    const V = I && I.host && I.host.voice; if (V && V.rate > MAX_SPEED && !ALLOW_FAST[d.key]) fast.push(`${d.key}: browser rate ${V.rate}`);
  }
  const G = E.G.host && E.G.host.voice; if (G && G.speed > MAX_SPEED) fast.push('generic: ' + G.speed);
  if (E.voiceOf(null).speed > MAX_SPEED) fast.push('narrator: ' + E.voiceOf(null).speed);
  for (const [k, v] of Object.entries(N.manifest().voices || {})) { const s = Number(String(v).split('@')[1]); if (s > MAX_SPEED && !ALLOW_FAST[k]) fast.push(`manifest ${k}: ${v}`); }
  assert.deepEqual(fast, []);
});

// The lines a TV speaks during a room's show, from the state the server sends (what show.js does).
function schedule(d, tv, how, n) {
  const { spec, say } = N.info(d), out = [];
  const add = (at, text, what) => { const L = N.line(text, spec); out.push({ at, end: at + L.ms, what }); };
  let at = 0;
  const shotList = N.shots(d, tv.mode);
  shotList.forEach((s, i) => { if (s.say) add(at + s.sayAt, say(s.say), 'open:' + s.say); at += tv.openShots[i]; });
  if (tv.mode === 'cast') {
    add(tv.openMs, say('roll'), 'roll');
    if (tv.moreAt != null) add(tv.openMs + tv.moreAt, say('more', { n: tv.others.length }), 'more');
    add(tv.openMs + tv.rollMs, say('play', {}), 'play');
  }
  let t = (tv.mode === 'cast' ? tv.openMs + tv.rollMs + tv.outroMs : 0);
  return { lines: out, introEnd: t, how };
}

test('a real room never starts the game before the narration ends; scheduled lines never overlap', () => {
  for (const d of shows) {
    for (const players of [3, 9]) {
      const clock = new VirtualClock(), r = new BoxRoom('VT' + players, d, { clock, seed: 5, shows: true });
      r.join('Ana'); r.addBots(Math.max(d.min || 1, players) - 1);
      const st = r.start(); assert(st.ok, d.key + ': starts (' + (st.error || '') + ')');
      if (r.phase !== 'show') continue; // a game that skips its intro
      const t0 = r.now();
      // facts mode: the phones' step (bots write facts), then the reveals.
      while (r.phase === 'show' && r.show.step === 'facts' && clock.step());
      const tIntros = r.now(), tv = r.tvState().show;
      assert.equal(tv.step, 'intros', d.key);
      const S = schedule(d, tv);
      if (tv.mode === 'cast') {
        assert.equal(tv.endsIn, tv.openMs + tv.rollMs + tv.outroMs, d.key + ': the intro is opening + roll call + outro');
        const ls = S.lines.sort((a, b) => a.at - b.at);
        for (let i = 1; i < ls.length; i++) assert(ls[i].at >= ls[i - 1].end + MIN_GAP, `${d.key}: "${ls[i].what}" at ${ls[i].at} starts before "${ls[i - 1].what}" ends (${ls[i - 1].end})`);
        assert(ls[ls.length - 1].end + MIN_GAP <= tv.endsIn, d.key + ': the outro line ends before the how-to');
      } else {
        // the reveals: one slot per contestant, each long enough for its (live) line
        assert.equal(tv.slots.length, tv.featured.length, d.key);
        tv.slots.forEach((ms, i) => assert(ms >= 250 + N.estimate(`Give it up for ${tv.featured[i].name}! ${tv.featured[i].name} says: ${tv.featured[i].fact || 'a person of mystery'}!`) + MIN_GAP, d.key + ' reveal ' + i));
        assert.equal(tv.endsIn, tv.slots.reduce((a, x) => a + x, 0) + tv.outroMs, d.key);
      }
      while (r.phase === 'show' && r.show.step === 'intros' && clock.step());
      assert.equal(r.show && r.show.step, 'howto', d.key + ': the how-to follows');
      assert(r.now() - tIntros >= S.introEnd, d.key + ': the how-to waits for the intro');
      const h = r.tvState().show, tHow = r.now(), plan = N.howto(d);
      assert.deepEqual(h.howStepsMs, plan.steps, d.key + ': the TV gets the step lengths');
      while (r.phase === 'show' && clock.step());
      assert.equal(r.phase, 'game', d.key);
      const howEnd = plan.steps.reduce((a, x) => a + x, 0) + N.line(N.DONE_LINE, N.info(d).spec).ms + MIN_GAP;
      assert(r.now() - tHow >= howEnd, `${d.key}: the game started ${r.now() - tHow} ms into the how-to, before its narration ended (${howEnd})`);
      assert(r.now() - t0 >= S.introEnd + howEnd, d.key + ': whole show');
    }
  }
});

test('"Got it" from everyone waits for the narrator to finish the step on screen', () => {
  const d = GAMES.likely, clock = new VirtualClock(), r = new BoxRoom('GOT', d, { clock, seed: 3, shows: true });
  const a = r.join('Ana').player, b = r.join('Ben').player; a.sockets = 1; b.sockets = 1; r.addBots(2);
  assert(r.start().ok);
  while (r.phase === 'show' && r.show.step === 'intros' && clock.step());
  const plan = N.howto(d);
  let there = false; clock.set(() => { there = true; }, plan.steps[0] + 200); while (!there && clock.step()); // into step 2
  const at = r.now() - r.show.stepAt, lineEnd = plan.steps[0] + plan.lines[1] + 300;
  assert(r.act(a, { op: 'gotit' }).ok); assert(r.act(b, { op: 'gotit' }).ok);
  const t0 = r.now(); while (r.phase === 'show' && clock.step());
  assert.equal(r.phase, 'game');
  assert(r.now() - t0 >= Math.max(1500, lineEnd - at) - 5, 'not before step 2\'s line has been said');
});

test('Skip cuts the narrator (fx voiceCut) and moves on', () => {
  const clock = new VirtualClock(), r = new BoxRoom('SKP', GAMES.escape, { clock, seed: 3, shows: true });
  r.join('Ana'); r.addBots(2); assert(r.start().ok);
  const before = r.fxLog.length ? r.fxLog[r.fxLog.length - 1].id : 0;
  r.show.skip();
  assert(r.fxLog.some((f) => f.kind === 'voiceCut' && f.id > before));
  assert.equal(r.show.step, 'howto');
});

test('Party Mode break preview lasts as long as its narrated cutscene', () => {
  const clock = new VirtualClock(), r = new BoxRoom('PRV', GAMES.likely, { clock, seed: 3 });
  r.join('Ana'); r.addBots(3);
  assert.equal(r.previewMs(GAMES.escape), N.cast(GAMES.escape, 4, 0, { perMs: 900, outroMs: 3000 }).total);
});

// ------------------------------------------------------------------ the TV's line queue (voice.js)
function queueSandbox(clips) {
  let now = 0, seq = 0; const timers = [];
  const events = []; let playing = 0, maxPlaying = 0;
  const setTimeout = (fn, ms) => { const id = ++seq; timers.push({ id, at: now + Math.max(0, ms || 0), fn }); return id; };
  const clearTimeout = (id) => { const i = timers.findIndex((t) => t.id === id); if (i >= 0) timers.splice(i, 1); };
  const manifest = { clips: {}, games: {} };
  class Audio {
    constructor() { this.src = ''; this.volume = 1; this.playbackRate = 1; this.on = false; }
    play() {
      const c = clipsByUrl[this.src];
      if (!c || c.fail) return Promise.reject(new Error('cannot play'));
      this.on = true; playing++; maxPlaying = Math.max(maxPlaying, playing); events.push(['start', c.text, now]);
      if (!c.stuck) this.t = setTimeout(() => { if (!this.on) return; this.on = false; playing--; events.push(['end', c.text, now]); if (this.onended) this.onended(); }, c.ms);
      return Promise.resolve();
    }
    pause() { if (this.on) { this.on = false; playing--; events.push(['cut', (clipsByUrl[this.src] || {}).text, now]); } clearTimeout(this.t); }
    removeAttribute() {}
  }
  const clipsByUrl = {};
  const ctx = {
    console, Math, Date, Promise, Map, Set, URLSearchParams, setTimeout, clearTimeout,
    performance: { now: () => now }, location: { search: '' },
    URL: { createObjectURL: (b) => 'blob:' + b.h, revokeObjectURL() {} }, Audio, CustomEvent: function () {}, dispatchEvent() {},
    fetch: (u) => {
      if (/manifest\.json$/.test(u)) return Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) });
      const h = u.split('/').pop().replace('.webm', ''); const c = Object.values(clipsByUrl).find((x) => x.h === h);
      if (c && c.noFetch) return Promise.reject(new Error('offline'));
      return Promise.resolve({ ok: true, blob: () => Promise.resolve({ h }) });
    },
  };
  // the browser voice (show.js's fallback) for lines with no clip: speaks for its text length, or hangs
  const fallback = { speak: (t) => new Promise((res) => { if (/HANG/.test(t)) { events.push(['start', t, now]); playing++; maxPlaying = Math.max(maxPlaying, playing); return; } events.push(['start', t, now]); playing++; maxPlaying = Math.max(maxPlaying, playing); setTimeout(() => { playing--; events.push(['end', t, now]); res(); }, 1000); }), stop() {} };
  ctx.window = ctx; ctx.BOX = { voice: { speak: fallback.speak, stop: fallback.stop } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'voice.js'), 'utf8'), ctx);
  const V = ctx.BOX.voice, spec = { kokoro: 'af_test', speed: 1 };
  for (const c of clips) { const h = V.keyOf(c.text, spec); c.h = h; manifest.clips[h] = { g: 'test', ms: c.ms }; clipsByUrl['blob:' + h] = c; }
  // When the fallback ("hang") line is let go, count it as ended for the overlap check.
  const flush = () => new Promise((r) => setImmediate(r));
  async function run(ms) {
    const end = now + ms;
    for (;;) {
      for (let i = 0; i < 6; i++) await flush();
      timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const t = timers[0]; if (!t || t.at > end) break;
      timers.shift(); now = t.at; t.fn();
    }
    now = end; for (let i = 0; i < 6; i++) await flush();
  }
  return { V, spec, run, events, max: () => maxPlaying, setPlaying: (n) => { playing = n; }, now: () => now };
}

async function queueTests() {
  { // two lines: the second waits for the first, nothing overlaps or gets cut
    const Q = queueSandbox([{ text: 'First line.', ms: 3000 }, { text: 'Second line.', ms: 2000 }]);
    await Q.run(10); Q.V.speak('First line.', Q.spec); await Q.run(500); Q.V.speak('Second line.', Q.spec);
    await Q.run(8000);
    const ev = Q.events.map((e) => e[0] + ':' + e[1]);
    assert.deepEqual(ev, ['start:First line.', 'end:First line.', 'start:Second line.', 'end:Second line.'], 'queued, in order, none cut');
    assert.equal(Q.max(), 1, 'never two at once');
    const s2 = Q.events.find((e) => e[0] === 'start' && e[1] === 'Second line.')[2], e1 = Q.events.find((e) => e[0] === 'end' && e[1] === 'First line.')[2];
    assert(s2 >= e1, 'the second starts after the first ends');
    passed++; console.log('  ✓ queue: a new line waits for the current one (no overlap, no cut)');
  }
  { // stale lines are dropped, the newest survive; too many waiting: the oldest goes
    const Q = queueSandbox([{ text: 'Long briefing.', ms: 9000 }, { text: 'Old news.', ms: 1000 }, { text: 'Fresh news.', ms: 1000 }, { text: 'A.', ms: 500 }, { text: 'B.', ms: 500 }, { text: 'C.', ms: 500 }, { text: 'D.', ms: 500 }]);
    await Q.run(10); Q.V.speak('Long briefing.', Q.spec); await Q.run(100);
    Q.V.speak('Old news.', Q.spec); await Q.run(5000); Q.V.speak('Fresh news.', Q.spec, { maxWait: 8000 });
    await Q.run(12000);
    const said = Q.events.filter((e) => e[0] === 'start').map((e) => e[1]);
    assert.deepEqual(said, ['Long briefing.', 'Fresh news.'], 'the stale line was dropped, the briefing never cut');
    assert(!Q.events.some((e) => e[0] === 'cut'));
    Q.V.speak('A.', Q.spec); Q.V.speak('B.', Q.spec); Q.V.speak('C.', Q.spec); Q.V.speak('D.', Q.spec); Q.V.speak('B.', Q.spec, { key: 'x' });
    await Q.run(6000);
    assert.equal(Q.max(), 1);
    passed++; console.log('  ✓ queue: stale lines are dropped instead of cutting the current one');
  }
  { // stop() (the host's Skip) cuts the line and clears the queue
    const Q = queueSandbox([{ text: 'Intro line.', ms: 5000 }, { text: 'Next line.', ms: 2000 }]);
    await Q.run(10); Q.V.speak('Intro line.', Q.spec); Q.V.speak('Next line.', Q.spec); await Q.run(1000);
    Q.V.stop(); await Q.run(8000);
    assert.deepEqual(Q.events.map((e) => e[0] + ':' + e[1]), ['start:Intro line.', 'cut:Intro line.']);
    assert.deepEqual({ ...Q.V.pending() }, { busy: false, waiting: 0 });
    passed++; console.log('  ✓ queue: Skip (stop) cuts and clears');
  }
  { // a clip that never ends, a clip that fails, a voice that hangs: narration still moves on
    const Q = queueSandbox([{ text: 'Stuck clip.', ms: 2000, stuck: true }, { text: 'Broken clip.', ms: 2000, fail: true }, { text: 'Offline clip.', ms: 2000, noFetch: true }, { text: 'After.', ms: 1000 }]);
    await Q.run(10);
    const done = [];
    (async () => { for (const t of ['Stuck clip.', 'Broken clip.', 'Offline clip.', 'HANG forever', 'After.']) { await Q.V.speak(t, Q.spec, { maxWait: 60000 }); done.push(t); } })();
    await Q.run(40000);
    assert.deepEqual(done, ['Stuck clip.', 'Broken clip.', 'Offline clip.', 'HANG forever', 'After.'], 'every line resolves, in order');
    assert(Q.events.some((e) => e[0] === 'start' && e[1] === 'After.'), 'the line after them still plays');
    passed++; console.log('  ✓ queue: a stuck, failing or missing clip never blocks the narration');
  }
}

// ------------------------------------------------------------------ pacing + loudness of the clips
// Words per second: conversational English is about 2.2–3.2. Short exclamations run faster and
// whispers slower, so single lines get a wide band and each game's average a tight one.
test('clip pacing (words per second) and loudness are natural', () => {
  const m = N.manifest(), bad = [], loud = [], warn = [], per = {};
  const words = (t) => String(t || '').split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
  for (const c of Object.values(m.clips)) {
    const w = words(c.t), wps = w / (c.ms / 1000);
    (per[c.g] = per[c.g] || [0, 0]); per[c.g][0] += w; per[c.g][1] += c.ms;
    // Single lines: letters per second (short words and numbers skew words/s); 13–16 is typical.
    const L = String(c.t || '').replace(/[^a-z]/gi, '').length + 3 * (String(c.t || '').match(/\d/g) || []).length, lps = L / (c.ms / 1000);
    if (L >= 30 && (lps > 19 || lps < 5.5)) bad.push(`${c.g} ${lps.toFixed(1)} letters/s "${c.t.slice(0, 50)}"`);
    else if (w >= 10 && (wps > 3.6 || wps < 2.0)) warn.push(`${c.g} ${wps.toFixed(2)} w/s "${c.t.slice(0, 40)}"`);
    if (c.db != null && Math.abs(c.db + 19) > 2.5) loud.push(`${c.g} ${c.db} dB "${c.t.slice(0, 40)}"`);
  }
  for (const [g, [w, ms]] of Object.entries(per)) { const a = w / (ms / 1000); if (a > 3.5 || a < 2.0) bad.push(`${g}: ${a.toFixed(2)} words/s on average`); }
  assert.deepEqual(bad, [], 'clips read too fast or too slowly (mangled text, or the voice speed)');
  assert.deepEqual(loud, [], 'clips off the -19 dBFS speech level');
  if (warn.length && process.env.VOICE_VERBOSE) console.log(`    note: ${warn.length} long line(s) outside 2.0–3.6 words/s:\n      ` + warn.join('\n      '));
});

(async () => {
  console.log('Voice timing');
  for (const [name, fn] of tests) { fn(); passed++; console.log(`  ✓ ${name}`); }
  await queueTests();
  console.log(`${passed} passed`);
})().catch((e) => { console.error(e); process.exit(1); });
