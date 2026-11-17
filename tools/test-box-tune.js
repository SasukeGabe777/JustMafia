'use strict';
// Tune Buzz rules (key `tune`): played to the end by bots on a virtual clock.  node tools/test-box-tune.js
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/tune');
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const run = (clock, room, until, max = 200000) => { let i = 0; while (!until() && clock.step()) if (++i > max) throw new Error('never got there'); };
// A room with one real phone (Ana) and bots; Ana counts as online.
function setup(opts = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: opts.seed || 7 });
  const ana = room.join('Ana').player; ana.sockets = 1;
  room.addBots(opts.bots == null ? 3 : opts.bots);
  for (const [k, v] of Object.entries(opts.settings || {})) room.settings[k] = v;
  assert(room.start().ok);
  return { clock, room, ana, g: room.game };
}
const toPhase = (s, ph) => run(s.clock, s.room, () => s.g.phase === ph);
// Jump the virtual clock to an exact moment (a no-op timer marks it).
const at = (s, t) => { if (s.room.now() >= t) return; s.room.after(t - s.room.now(), () => {}); run(s.clock, s.room, () => s.room.now() >= t); };

test('bots play a whole game; results() lists everyone best-first', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 1 });
  room.addBots(6); assert(room.start().ok);
  assert.deepEqual(room.game.results(), [], 'no results before the end');
  run(clock, room, () => room.game.phase === 'over');
  const res = room.game.results(), st = room.game.standings();
  assert.equal(res.length, 6);
  assert.deepEqual(res, st.map((r) => r.id));
  for (let i = 1; i < st.length; i++) assert(st[i - 1].points >= st[i].points);
  assert(st[0].points > 0, 'somebody scored');
  assert(room.game.final && room.game.final.awards.ear, 'awards are given');
});

test('the playlist mixes every round type and ends on a double-points finale', () => {
  for (const rounds of [12, 16, 20]) {
    const s = setup({ settings: { rounds } });
    assert.equal(s.g.playlist.length, rounds);
    assert.equal(s.g.playlist[rounds - 1], 'game');
    for (const t of ['game', 'vibe', 'inst', 'hl', 'finish', 'rhythm']) assert(s.g.playlist.includes(t), `${rounds} rounds include ${t}`);
  }
  const q = setup({ settings: { mix: 'quiz' } });
  assert(!q.g.playlist.includes('rhythm'), 'no rhythm rounds in the quiz-only mix');
  const s = setup({ settings: { rounds: 12 } });
  run(s.clock, s.room, () => s.g.round === 12);
  assert.equal(s.g.mult(), 2);
});

test('a whole game takes roughly 6 to 13 minutes', () => {
  for (const rounds of [12, 20]) {
    const s = setup({ bots: 5, settings: { rounds } }), t0 = s.clock.now();
    s.ana.sockets = 0; // only bots: every timer runs to its end
    run(s.clock, s.room, () => s.g.phase === 'over');
    const min = (s.clock.now() - t0) / 60000;
    assert(min > 4.5 && min < 13, `${rounds} rounds took ${min.toFixed(1)} min`);
  }
});

test('choices: four options, the answer among them, no repeats, no sound-alikes together', () => {
  const s = setup({ seed: 3 });
  const seen = new Set();
  for (let i = 0; i < 15; i++) {
    const c = s.g.cur;
    if (c.type !== 'rhythm') {
      assert(c.choices.some((x) => x.id === c.ans));
      assert.equal(new Set(c.choices.map((x) => x.id)).size, c.choices.length);
      if (['game', 'vibe', 'inst'].includes(c.type)) {
        assert.equal(c.choices.length, 4);
        const ids = c.choices.map((x) => x.id);
        assert(!(ids.includes('flute') && ids.includes('whistle')) && !(ids.includes('beach') && ids.includes('underwater')));
        if (c.type === 'game') { assert(!seen.has(c.key), 'a soundtrack never comes up twice'); seen.add(c.key); }
      }
    }
    const r = s.g.round; run(s.clock, s.room, () => s.g.round > r || s.g.phase === 'over');
    if (s.g.phase === 'over') break;
  }
  // Every soundtrack in the Which game? pool exists.
  for (const g of def.GAMES) assert(fs.existsSync(path.join(__dirname, '..', 'public/box/scores', g.id + '.js')), g.id);
  // Every vibe and instrument has a generator in the client file.
  const client = fs.readFileSync(path.join(__dirname, '..', 'public/box/games/tune.js'), 'utf8');
  for (const v of def.VIBES) assert(new RegExp(`\\b${v.id}\\s*:`).test(client), 'client vibe ' + v.id);
  for (const v of def.INSTRUMENTS) assert(new RegExp(`\\b${v.id}\\s*:`).test(client), 'client instrument ' + v.id);
});

// Skip to the first round of a type (bots off so nothing interferes).
function roundOf(type, seed = 11) {
  for (let k = 0; k < 40; k++) {
    const s = setup({ bots: 1, seed: seed + k });
    s.room.remove(s.room.list().find((p) => p.bot).id); // Ana alone: nothing else acts
    const idx = s.g.playlist.indexOf(type);
    run(s.clock, s.room, () => s.g.round === idx + 1);
    if (s.g.cur.type === type) return s;
  }
  throw new Error('no ' + type + ' round');
}

test('buzzing: only during the clip, after it opens; right answers earn speed + first-buzz bonuses', () => {
  const s = roundOf('game'), { g, room, ana } = s;
  assert.equal(room.act(ana, { op: 'buzz' }).ok, false, 'no buzzing on the title card');
  toPhase(s, 'clip');
  const bot = room.list().find((p) => p.bot);
  at(s, g.cur.buzzAt + 500);
  assert.equal(room.act(ana, { op: 'pick', id: g.cur.ans }).ok, false, 'must buzz before answering early');
  assert(room.act(ana, { op: 'buzz' }).ok);
  assert.equal(g.tv().buzzed.length, 1);
  const r = room.act(ana, { op: 'pick', id: g.cur.ans });
  assert(r.ok && r.right);
  const a = g.answers.get(ana.id);
  assert(a.first && a.gain > 300 && a.gain <= 400, 'base + speed + first: ' + a.gain);
  assert.equal(room.act(ana, { op: 'pick', id: g.cur.ans }).ok, false, 'one answer per clip');
  assert.equal(g.points.get(ana.id), a.gain);
  void bot;
});

test('a wrong buzz costs points and locks you out for that clip', () => {
  const s = roundOf('vibe'), { g, room, ana } = s;
  g.points.set(ana.id, 500);
  toPhase(s, 'clip'); at(s, g.cur.buzzAt + 100);
  const wrong = g.cur.choices.find((x) => x.id !== g.cur.ans).id;
  assert(room.act(ana, { op: 'buzz' }).ok);
  const r = room.act(ana, { op: 'pick', id: wrong });
  assert(r.ok && r.right === false);
  assert.equal(g.points.get(ana.id), 450);
  assert.equal(room.act(ana, { op: 'buzz' }).ok, false, 'locked out');
  assert.equal(room.act(ana, { op: 'pick', id: g.cur.ans }).ok, false, 'locked out');
  run(s.clock, room, () => g.phase === 'reveal');
  assert(g.last.lockouts.some((x) => x.id === ana.id));
  assert.equal(g.view(ana).mine.right, false);
});

test('buzzing and not answering within 5 seconds locks you out', () => {
  const s = roundOf('finish'), { g, room, ana } = s;
  toPhase(s, 'clip');
  assert.equal(room.act(ana, { op: 'buzz' }).ok, false, 'Finish the melody: buzzing waits until an ending has played');
  at(s, g.cur.buzzAt);
  assert(room.act(ana, { op: 'buzz' }).ok);
  const t = room.now(); run(s.clock, room, () => room.now() > t + 5200);
  assert(g.isLocked(ana.id));
  assert.equal(room.act(ana, { op: 'pick', id: g.cur.ans }).ok, false);
});

test('last call: answers count without a bonus; everyone in ends it early', () => {
  const s = roundOf('inst'), { g, room, ana } = s;
  toPhase(s, 'last');
  assert.equal(room.act(ana, { op: 'buzz' }).ok, false, 'no buzzing after the clip');
  assert(room.act(ana, { op: 'pick', id: g.cur.ans }).ok);
  assert.equal(g.phase, 'reveal', 'the only online player answered: straight to the reveal');
  assert.equal(g.answers.get(ana.id).gain, 100);
  assert.equal(g.last.answer.id, g.cur.ans);
});

test('higher or lower: two choices that match the notes or beats', () => {
  for (let k = 0; k < 6; k++) {
    const s = roundOf('hl', 30 + k * 50), c = s.g.cur;
    assert.equal(c.choices.length, 2);
    assert.equal(c.ans, c.b > c.a ? 'up' : 'down');
    assert.notEqual(c.a, c.b);
    assert(c.buzzFrom > 0, 'buzzing opens once the second sound starts');
  }
});

test('rhythm: clock-synced taps are scored on timing; drumrolls and silence score low', () => {
  const s = roundOf('rhythm'), { g, room, ana } = s;
  toPhase(s, 'tap');
  const c = g.cur;
  assert(c.beatAt > room.now() && c.beatMs > 300);
  const sync = room.act(ana, { op: 'sync' });
  assert(sync.ok && typeof sync.now === 'number');
  // Ana taps 60 ms late on every beat (a steady lag is forgiven).
  for (let i = 0; i < c.beats; i++) {
    const t = c.beatAt + i * c.beatMs + 60;
    at(s, t);
    assert(room.act(ana, { op: 'tap', t }).ok);
  }
  toPhase(s, 'reveal');
  const mine = g.view(ana).mine;
  assert(mine.acc >= 95, 'steady taps score high: ' + mine.acc);
  assert(mine.gain >= 380);
  // The scorer itself: a drumroll (every 40 ms) loses to steady taps; silence scores 0.
  const roll = []; for (let t = c.beatAt - 200; t < c.beatAt + c.beats * c.beatMs; t += 40) roll.push(t);
  assert(g.rhythmScore(roll).acc < 0.2, 'drumrolls are punished');
  assert.equal(g.rhythmScore([]).acc, 0);
  const sloppy = []; for (let i = 0; i < c.beats; i++) sloppy.push(c.beatAt + i * c.beatMs + (i % 2 ? 140 : -140));
  assert(g.rhythmScore(sloppy).acc < 0.5);
});

test('phone input is validated', () => {
  const s = roundOf('game'), { g, room, ana } = s;
  toPhase(s, 'last');
  for (const bad of [{ op: 'pick', id: 'nope' }, { op: 'pick', id: 3 }, { op: 'pick' }, { op: 'nope' }, {}, { op: 'tap', t: 'x' }, { op: 'buzz' }]) assert.equal(room.act(ana, bad).ok, false, JSON.stringify(bad));
  assert.equal(room.act(ana, null).ok, false);
  assert.equal(g.answers.size, 0);
  // A tap claiming a time far from now is clamped to now; a tap outside a rhythm round is refused.
  assert.equal(g.tap(ana, Date.now()).ok, false);
});

test('the phone never sees the answer before the reveal; the TV gets what to play', () => {
  const s = roundOf('inst'), { g, room, ana } = s;
  toPhase(s, 'clip');
  const v = JSON.stringify(g.view(ana));
  assert(!v.includes('"ans"') && !v.includes('"play"') && !v.includes('"inst":') && !v.includes('"seed"'));
  const tv = g.tv();
  assert.equal(tv.clip.play.inst, g.cur.ans);
  assert(typeof tv.clip.atIn === 'number' && tv.clip.endIn > tv.clip.atIn);
  void room;
});

test('late joiners and leavers do not break a round', () => {
  const s = roundOf('vibe'), { g, room } = s;
  toPhase(s, 'clip');
  const bo = room.join('Bo').player; bo.sockets = 1;
  at(s, g.cur.buzzAt + 50);
  assert(room.act(bo, { op: 'buzz' }).ok);
  assert(room.act(bo, { op: 'pick', id: g.cur.ans }).ok);
  room.remove(bo.id);
  run(s.clock, room, () => g.phase === 'over');
  assert.deepEqual(g.results(), [s.ana.id], 'the leaver drops off the results');
});

console.log(`\n${passed} Tune Buzz tests passed.`);
