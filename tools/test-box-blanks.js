'use strict';
// JustBlanks rules test (virtual clock, no server): the decks, input validation, hurry-up,
// Judge rounds with ❤️ hearts, votes and ties, leavers, the round limit, awards and results,
// skip-ahead, and full games with 4 and 100 players.
const assert = require('assert');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/blanks');
const C = require('../box/games/blanks-cards');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
function room(bots, settings = {}, seed = 7) {
  const clock = new VirtualClock(), r = new BoxRoom('TEST', def, { clock, seed });
  Object.assign(r.settings, settings); r.addBots(bots);
  return { r, clock };
}
function humans(names, settings = {}, seed = 7) {
  const clock = new VirtualClock(), r = new BoxRoom('TEST', def, { clock, seed });
  Object.assign(r.settings, settings);
  const ps = names.map((n) => r.join(n).player);
  assert.ok(r.start().ok);
  return { r, clock, ps, g: r.game };
}
const stepUntil = (r, clock, cond, limit = 400000) => { let i = 0; while (!cond() && clock.step()) if (++i > limit) throw new Error('stuck in ' + r.game.phase); assert.ok(cond(), 'condition never met (phase ' + r.game.phase + ')'); };
const play = (g, p) => g.act(p, { op: 'play', cards: g.hands.get(p.id).slice(0, g.prompt.pick).map((c) => c.id) });
const playAll = (g, ps) => { for (const p of ps) if (p.id !== g.judge) assert.ok(play(g, p).ok, 'play for ' + p.name); };

console.log('JustBlanks');

test('module shape and decks: valid defaults, lots of original cards, no duplicates', () => {
  for (const f of def.fields) { assert.ok(f.options.length, f.key); assert.ok(f.options.some((o) => o.value === def.defaults[f.key]), 'default for ' + f.key); }
  assert.ok(C.FAMILY_PROMPTS.length >= 90 && C.PARTY_PROMPTS.length >= 35, 'prompts: ' + C.FAMILY_PROMPTS.length + '/' + C.PARTY_PROMPTS.length);
  assert.ok(C.FAMILY_ANSWERS.length >= 250 && C.PARTY_ANSWERS.length >= 80, 'answers: ' + C.FAMILY_ANSWERS.length + '/' + C.PARTY_ANSWERS.length);
  for (const list of [C.PROMPTS, C.ANSWERS]) { const low = list.map((x) => x.toLowerCase()); assert.strictEqual(new Set(low).size, low.length, 'duplicates: ' + low.filter((x, i) => low.indexOf(x) !== i)); }
  for (const p of C.PROMPTS) { const n = (p.match(/___/g) || []).length; assert.ok(n >= 1 && n <= 2, p); }
  for (const a of C.ANSWERS) assert.ok(a.length <= 70 && !/[<>]/.test(a), a);
});

test('the family deck only deals family cards and prompts', () => {
  const { g, ps, clock, r } = humans(['Ann', 'Bob', 'Cat', 'Dan'], { deck: 'family', rounds: 8 });
  const famP = new Set(C.FAMILY_PROMPTS), famA = new Set(C.FAMILY_ANSWERS);
  for (let k = 0; k < 6; k++) {
    assert.ok(famP.has(g.prompt.text), 'family prompt: ' + g.prompt.text);
    for (const p of ps) for (const c of g.hands.get(p.id)) assert.ok(famA.has(c.text), 'family card: ' + c.text);
    playAll(g, ps); stepUntil(r, clock, () => g.phase === 'choose');
    r.hostAction({ type: 'next' }); r.hostAction({ type: 'next' });
  }
});

test('family mode on the TV (room.family) overrides the party deck: only family prompts and cards', () => {
  const clock = new VirtualClock(), r = new BoxRoom('TEST', def, { clock, seed: 3 });
  Object.assign(r.settings, { deck: 'party', rounds: 20 }); r.family = true;
  const ps = ['Ann', 'Bob', 'Cat', 'Dan'].map((n) => r.join(n).player);
  assert.ok(r.start().ok); const g = r.game;
  const famP = new Set(C.FAMILY_PROMPTS), famA = new Set(C.FAMILY_ANSWERS);
  assert.ok(g.answerPool().every((t) => famA.has(t)) && g.promptPool().every((t) => famP.has(t)), 'family pools');
  for (let k = 0; k < 10; k++) {
    assert.ok(famP.has(g.prompt.text), 'family prompt: ' + g.prompt.text);
    for (const p of ps) for (const c of g.hands.get(p.id)) assert.ok(famA.has(c.text), 'family card: ' + c.text);
    playAll(g, ps); stepUntil(r, clock, () => g.phase === 'choose' || g.phase === 'over');
    if (g.phase === 'over') break;
    r.hostAction({ type: 'next' }); r.hostAction({ type: 'next' });
  }
});

test('theme packs: 40+ original prompts and cards each, family-safe, and each deals only its pool (plus the family base)', () => {
  assert.ok(def.fields.find((f) => f.key === 'pack').options.length === 1 + Object.keys(C.PACKS).length);
  const all = C.PROMPTS.concat(...Object.values(C.PACKS).map((p) => p.prompts)), allA = C.ANSWERS.concat(...Object.values(C.PACKS).map((p) => p.answers));
  for (const list of [all, allA]) { const low = list.map((x) => x.toLowerCase()); assert.strictEqual(new Set(low).size, low.length, 'duplicates: ' + low.filter((x, i) => low.indexOf(x) !== i)); }
  const party = new Set(C.PARTY_PROMPTS.concat(C.PARTY_ANSWERS));
  for (const [key, pk] of Object.entries(C.PACKS)) {
    assert.ok(pk.prompts.length >= 40 && pk.answers.length >= 50, key + ' size');
    for (const p of pk.prompts) { const n = (p.match(/___/g) || []).length; assert.ok(n >= 1 && n <= 2, p); }
    for (const a of pk.answers) assert.ok(a.length <= 70 && !/[<>]/.test(a) && !party.has(a), a);
    for (const fam of [false, true]) {
      const clock = new VirtualClock(), r = new BoxRoom('TEST', def, { clock, seed: 5 });
      Object.assign(r.settings, { deck: 'party', pack: key, rounds: 8, toWin: 10 }); r.family = fam; r.addBots(5);
      assert.ok(r.start().ok); const g = r.game;
      const okP = new Set(pk.prompts), okA = new Set(pk.answers.concat(C.FAMILY_ANSWERS));
      let rounds = 0;
      while (g.phase !== 'over' && rounds < 200) {
        if (g.phase === 'pick') { assert.ok(okP.has(g.prompt.text), key + ' prompt: ' + g.prompt.text); for (const h of g.hands.values()) for (const c of h) assert.ok(okA.has(c.text), key + ' card: ' + c.text); rounds++; }
        if (!clock.step()) break;
      }
      assert.strictEqual(g.phase, 'over', key + ' game finishes');
    }
  }
});

test('weird input never crashes; written cards are cleaned; cards must be yours', () => {
  const { g, ps } = humans(['Ann', 'Bob', 'Cat'], { mode: 'vote', blanks: 2 });
  const p = ps[0]; g.prompt = { text: 'My secret talent is ___.', pick: 1 };
  for (const m of [null, 5, 'x', {}, { op: 'play' }, { op: 'play', cards: 'abc' }, { op: 'play', cards: [{}] }, { op: 'play', cards: [null, null] }, { op: 'play', written: [{ a: 1 }] },
    { op: 'play', cards: ['zzz'] }, { op: 'vote', sid: { x: 1 } }, { op: 'pick' }, { op: 'heart', sid: 5 }, { op: '__proto__' }]) {
    const res = g.act(p, m); assert.strictEqual(res.ok, false, JSON.stringify(m));
  }
  const h = g.hands.get(p.id);
  assert.ok(!g.act(p, { op: 'play', cards: [h[0].id, h[0].id] }).ok, 'no duplicate cards');
  assert.ok(g.act(p, { op: 'play', cards: [], written: ['  <b>a\u0007 goose​</b>  ' + 'x'.repeat(200)], order: ['nonsense'] }).ok);
  const sub = g.subs.find((s) => s.by === p.id);
  assert.ok(!/[<>\u0007]/.test(sub.cards[0]) && sub.cards[0].length <= 70, 'clean: ' + sub.cards[0]);
  assert.strictEqual(g.blanksLeft.get(p.id), 1);
  assert.ok(!g.act(p, { op: 'play', cards: [h[1].id] }).ok, 'only one play a round');
  assert.ok(!g.act(p, { op: 'swap' }).ok, 'no swap after playing');
  assert.ok(g.act(ps[1], { op: 'swap' }).ok); assert.ok(!g.act(ps[1], { op: 'swap' }).ok, 'swap once per game');
  assert.strictEqual(g.hands.get(ps[1].id).length, 7);
});

test('hurry up: once most of the room has played, stragglers get 20 seconds', () => {
  const { g, ps, r } = humans(['Ann', 'Bob', 'Cat', 'Dan', 'Eve', 'Fay', 'Gus'], { mode: 'vote', pickSeconds: 90 });
  const before = g.endsIn(); assert.ok(before > 80000);
  for (const p of ps.slice(0, 4)) play(g, p);
  assert.ok(!g.hurried, 'not yet (4 of 7)');
  play(g, ps[4]);
  assert.ok(g.hurried && g.endsIn() <= 20000, 'hurried at 5 of 7');
  assert.ok(r.fxLog.some((f) => f.kind === 'hurry'));
  assert.ok(r.tvState().state.hurry);
});

test('Judge rounds: only the Judge picks; everyone else sends ❤️; the crowd favourite gets a shout-out', () => {
  const { g, ps, r, clock } = humans(['Ann', 'Bob', 'Cat', 'Dan', 'Eve'], { mode: 'judge' });
  const judge = r.get(g.judge), others = ps.filter((p) => p.id !== judge.id);
  playAll(g, others);
  stepUntil(r, clock, () => g.phase === 'reveal');
  assert.ok(!r.tvState().state.answers.some((a) => 'by' in a || 'name' in a), 'answers carry no names');
  stepUntil(r, clock, () => g.phase === 'choose');
  const sub = (p) => g.subs.find((s) => s.by === p.id);
  const [a, b, c, d] = others;
  assert.ok(!g.act(a, { op: 'vote', sid: sub(b).sid }).ok, 'no votes in Judge rounds');
  assert.ok(!g.act(a, { op: 'heart', sid: sub(a).sid }).ok, 'no heart for your own');
  assert.ok(!g.act(judge, { op: 'heart', sid: sub(a).sid }).ok, 'the Judge picks instead');
  assert.ok(g.act(a, { op: 'heart', sid: sub(b).sid }).ok); assert.ok(g.act(c, { op: 'heart', sid: sub(b).sid }).ok); assert.ok(g.act(d, { op: 'heart', sid: sub(b).sid }).ok);
  assert.ok(!g.act(a, { op: 'pick', sid: sub(b).sid }).ok, 'only the Judge picks');
  assert.ok(g.act(judge, { op: 'pick', sid: sub(c).sid }).ok);
  assert.strictEqual(g.phase, 'win'); assert.strictEqual(g.scores.get(c.id), 1); assert.strictEqual(g.scores.get(b.id), 0);
  const L = r.tvState().state.last;
  assert.strictEqual(L.how, 'judge'); assert.strictEqual(L.crowd.name, b.name); assert.strictEqual(L.crowd.hearts, 3);
  assert.strictEqual(L.all.find((x) => x.name === b.name).hearts, 3, 'who played what, with hearts');
  assert.deepStrictEqual(r.playerState(b).state.myResult, { win: false, votes: 0, hearts: 3 });
  assert.strictEqual(g.stats.get(b.id).love, 3);
});

test('vote mode: a tie gives both a point; no votes picks at random; can’t vote for yourself', () => {
  const { g, ps, r, clock } = humans(['Ann', 'Bob', 'Cat', 'Dan'], { mode: 'vote' });
  playAll(g, ps);
  stepUntil(r, clock, () => g.phase === 'choose');
  const sid = (p) => g.subs.find((s) => s.by === p.id).sid;
  const [a, b, c, d] = ps;
  assert.ok(!g.act(a, { op: 'vote', sid: sid(a) }).ok);
  assert.ok(!g.act(a, { op: 'heart', sid: sid(b) }).ok, 'hearts are for Judge rounds');
  g.act(a, { op: 'vote', sid: sid(b) }); g.act(b, { op: 'vote', sid: sid(a) }); g.act(c, { op: 'vote', sid: sid(a) });
  g.act(d, { op: 'vote', sid: sid(b) });
  stepUntil(r, clock, () => g.phase === 'win');
  assert.strictEqual(g.last.how, 'tie'); assert.strictEqual(g.scores.get(a.id), 1); assert.strictEqual(g.scores.get(b.id), 1);
  stepUntil(r, clock, () => g.phase === 'pick');
  playAll(g, ps); stepUntil(r, clock, () => g.phase === 'win');
  assert.strictEqual(g.last.how, 'random', 'nobody voted');
});

test('the Judge leaving mid-round turns it into a vote; leavers never stall the game', () => {
  const { r, clock } = room(5, { mode: 'judge', rounds: 8 }, 3);
  const ann = r.join('Ann').player; r.start(); const g = r.game;
  stepUntil(r, clock, () => g.phase === 'choose' && g.judge && g.judge !== ann.id);
  r.remove(g.judge);
  assert.strictEqual(g.judge, null); assert.strictEqual(g.rmode, 'vote');
  stepUntil(r, clock, () => g.phase === 'win');
  assert.ok(g.last.winners.length >= 1);
  stepUntil(r, clock, () => g.phase === 'pick');
  r.remove(r.list().find((p) => p.bot && p.id !== g.judge).id);
  stepUntil(r, clock, () => g.phase === 'over');
});

test('round limit ends the game; awards, best line and results() best-first', () => {
  const { r, clock } = room(4, { rounds: 8, toWin: 10 }, 9);
  const ann = r.join('Ann').player; r.start(); const g = r.game;
  while (g.phase !== 'over') {
    if (g.phase === 'pick' && ann.id !== g.judge && !g.hasPlayed(ann.id)) play(g, ann);
    if (!clock.step()) break;
  }
  assert.strictEqual(g.phase, 'over'); assert.ok(g.round <= 8);
  const res = g.results(), st = g.standings();
  assert.strictEqual(res.length, 5); assert.deepStrictEqual(res, st.map((x) => x.id));
  for (let i = 1; i < st.length; i++) assert.ok(st[i - 1].points >= st[i].points);
  const tv = r.tvState().state;
  assert.ok(tv.awards.length >= 1 && tv.best && tv.best.cards.length, 'awards and the line of the night');
  assert.ok(tv.reel.length >= 1);
  const v = r.playerState(ann).state; assert.ok(v.final && v.rank >= 1);
});

test('first to the target wins (toWin 1)', () => {
  const { g, ps, r, clock } = humans(['Ann', 'Bob', 'Cat'], { mode: 'judge', toWin: 1 });
  playAll(g, ps); stepUntil(r, clock, () => g.phase === 'choose');
  g.act(r.get(g.judge), { op: 'pick', sid: g.subs[0].sid });
  stepUntil(r, clock, () => g.phase === 'over');
  assert.strictEqual(g.round, 1); assert.strictEqual(g.scores.get(g.results()[0]), 1);
});

test('skip ahead walks every phase', () => {
  const { g, ps, r } = humans(['Ann', 'Bob', 'Cat', 'Dan'], { mode: 'vote', rounds: 8 });
  const seen = new Set(); let i = 0;
  while (g.phase !== 'over' && i++ < 200) { seen.add(g.phase); if (g.phase === 'pick') playAll(g, ps); r.hostAction({ type: 'next' }); }
  assert.strictEqual(g.phase, 'over');
  for (const ph of ['pick', 'reveal', 'choose', 'win']) assert.ok(seen.has(ph), 'saw ' + ph);
});

test('nobody acting still ends the game (every phase has a timer)', () => {
  const { r, clock } = humans(['Ann', 'Bob', 'Cat'], { rounds: 8 });
  stepUntil(r, clock, () => r.game.phase === 'over');
  assert.strictEqual(r.game.round, 8);
});

test('full games: 4 players and 100 players (vote mode) finish, TV state stays small', () => {
  const small = room(4, {}, 4); small.r.start(); stepUntil(small.r, small.clock, () => small.r.game.phase === 'over');
  const { r, clock } = room(99, { rounds: 8 }, 5);
  const ann = r.join('Ann').player; r.start(); const g = r.game;
  assert.strictEqual(g.mode(), 'vote');
  const t0 = Date.now(); let maxTv = 0;
  while (g.phase !== 'over') {
    if (g.phase === 'pick' && !g.hasPlayed(ann.id)) play(g, ann);
    maxTv = Math.max(maxTv, JSON.stringify(r.tvState()).length);
    if (!clock.step()) break;
  }
  assert.strictEqual(g.phase, 'over'); assert.ok(maxTv < 120000, 'TV state ' + maxTv);
  assert.ok(Date.now() - t0 < 15000, 'fast');
  assert.ok(JSON.stringify(r.playerState(ann)).length < 40000);
});

console.log(`\n${passed} tests passed`);
