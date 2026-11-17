'use strict';
// Who Said It? rules test (virtual clock, no server): scoring, hidden authors, double down,
// streaks, the custom question, skip-ahead, leavers, and full games with 4 and 100 players.
const assert = require('assert');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/whosaid');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };
function room(bots, settings = {}, seed = 7) {
  const clock = new VirtualClock(), r = new BoxRoom('TEST', def, { clock, seed });
  Object.assign(r.settings, settings);
  r.addBots(bots);
  return { r, clock };
}
const stepUntil = (r, clock, cond, limit = 200000) => { let i = 0; while (!cond() && clock.step()) if (++i > limit) throw new Error('stuck in ' + r.game.phase); assert.ok(cond(), 'condition never met (phase ' + r.game.phase + ')'); };
const runOut = (r, clock) => stepUntil(r, clock, () => r.game.phase === 'over', 400000);
// Humans-only setup: no bots so every move is ours.
function humans(names, settings = {}) {
  const clock = new VirtualClock(), r = new BoxRoom('TEST', def, { clock, seed: 7 });
  Object.assign(r.settings, settings);
  const ps = names.map((n) => r.join(n).player);
  r.start();
  return { r, clock, ps, g: r.game };
}
const pts = (g, p) => g.scores.get(p.id);

console.log('Who Said It?');

test('module shape: every field has options and the defaults are valid', () => {
  assert.strictEqual(def.key, 'whosaid');
  for (const f of def.fields) { assert.ok(Array.isArray(f.options) && f.options.length, f.key); assert.ok(f.options.some((o) => o.value === def.defaults[f.key]), 'default for ' + f.key); }
  for (const [k, list] of Object.entries(def.PACKS)) { assert.ok(list.length >= 40, k + ' has 40+ questions'); assert.strictEqual(new Set(list).size, list.length, k + ' has no duplicates'); }
});

test('answers are sanitized and validated', () => {
  const { g, ps } = humans(['Ann', 'Bob', 'Cat', 'Dan']);
  assert.strictEqual(g.phase, 'answer');
  assert.ok(!g.act(ps[0], { op: 'answer', text: '   ' }).ok);
  assert.ok(g.act(ps[0], { op: 'answer', text: '<b>hi</b>\u0007 there ' + 'x'.repeat(200) }).ok);
  const t = g.answers.get(ps[0].id).text;
  assert.ok(!/[<>\u0007]/.test(t) && t.length <= 80, 'clean: ' + t);
  assert.ok(!g.act(ps[0], { op: 'guess', pick: 0 }).ok, 'no guessing during answers');
  assert.ok(!g.act(ps[0], { op: 'nope' }).ok);
});

test('scoring: correct (+speed), fooled author, can’t guess your own, author hidden from the TV', () => {
  const { r, g, ps, clock } = humans(['Ann', 'Bob', 'Cat', 'Dan', 'Eve'], { spots: 10 });
  ps.forEach((p, i) => g.act(p, { op: 'answer', text: 'answer number ' + i }));
  stepUntil(r, clock, () => g.phase === 'spot');
  const c = g.cur, author = r.get(c.id), voters = ps.filter((p) => p.id !== c.id);
  // The TV and every non-author phone must not reveal the author before the reveal.
  const tv = r.tvState().state;
  assert.strictEqual(tv.spot.result, null);
  assert.ok(!('id' in tv.spot) && !('author' in tv.spot), 'no author field on the TV');
  assert.ok(!JSON.stringify(tv.spot).includes(c.id), 'no author id in the spotlight');
  for (const p of voters) { const v = r.playerState(p).state; assert.strictEqual(v.spot.mine, false); assert.strictEqual(v.spot.result, null); }
  assert.strictEqual(r.playerState(author).state.spot.mine, true);
  assert.ok(!g.act(author, { op: 'guess', pick: 0 }).ok, 'author can’t guess their own');
  assert.ok(!g.act(voters[0], { op: 'guess', pick: 9 }).ok, 'pick must be a listed name');
  assert.ok(!g.act(voters[0], { op: 'guess', pick: 'x' }).ok);
  const right = c.opts.indexOf(c.id), wrong = (right + 1) % c.opts.length;
  const before = Object.fromEntries(ps.map((p) => [p.id, pts(g, p)]));
  // voters[0..2] right (in order), voters[3] wrong.
  clock.t += 100; assert.ok(g.act(voters[0], { op: 'guess', pick: right }).ok);
  assert.ok(!g.act(voters[0], { op: 'guess', pick: wrong }).ok, 'guesses lock in');
  clock.t += 100; g.act(voters[1], { op: 'guess', pick: right });
  clock.t += 100; g.act(voters[2], { op: 'guess', pick: right });
  clock.t += 100; g.act(voters[3], { op: 'guess', pick: wrong });
  stepUntil(r, clock, () => g.phase === 'reveal');
  assert.strictEqual(pts(g, voters[0]) - before[voters[0].id], 150, 'first correct gets the speed bonus');
  assert.strictEqual(pts(g, voters[1]) - before[voters[1].id], 100);
  assert.strictEqual(pts(g, voters[2]) - before[voters[2].id], 100);
  assert.strictEqual(pts(g, voters[3]) - before[voters[3].id], 0);
  assert.strictEqual(pts(g, author) - before[author.id], 50, 'author +50 for the one they fooled');
  const res = r.tvState().state.spot.result;
  assert.strictEqual(res.author, right); assert.strictEqual(res.name, author.name); assert.strictEqual(res.fooled, 1); assert.strictEqual(res.right, 3); assert.strictEqual(res.bluff, false);
  assert.strictEqual(res.tally.reduce((a, b) => a + b, 0), 4);
});

test('bluff badge, double down (win and lose), once per game', () => {
  const { r, g, ps, clock } = humans(['Ann', 'Bob', 'Cat', 'Dan'], { spots: 10 });
  ps.forEach((p, i) => g.act(p, { op: 'answer', text: 'a' + i }));
  stepUntil(r, clock, () => g.phase === 'spot');
  let c = g.cur, voters = ps.filter((p) => p.id !== c.id), right = c.opts.indexOf(c.id), wrong = (right + 1) % c.opts.length;
  const b0 = Object.fromEntries(ps.map((p) => [p.id, pts(g, p)]));
  g.act(voters[0], { op: 'guess', pick: wrong, dd: true });
  g.act(voters[1], { op: 'guess', pick: wrong });
  g.act(voters[2], { op: 'guess', pick: wrong });
  stepUntil(r, clock, () => g.phase === 'reveal');
  assert.strictEqual(pts(g, voters[0]) - b0[voters[0].id], -50, 'wrong double down: -50');
  assert.strictEqual(pts(g, r.get(c.id)) - b0[c.id], 150, 'fooled all three');
  assert.strictEqual(g.cur.result.bluff, true); assert.strictEqual(g.stats.get(c.id).bluffs, 1);
  const loser = voters[0];
  stepUntil(r, clock, () => g.phase === 'spot');
  c = g.cur; right = c.opts.indexOf(c.id);
  const dder = ps.find((p) => p.id !== c.id && p.id !== loser.id);
  if (c.id !== loser.id) assert.ok(!g.act(loser, { op: 'guess', pick: right, dd: true }).ok, 'double down only once');
  const b1 = pts(g, dder);
  assert.ok(g.act(dder, { op: 'guess', pick: right, dd: true }).ok);
  g.next(); // skip ahead → reveal
  assert.strictEqual(g.phase, 'reveal');
  assert.strictEqual(pts(g, dder) - b1, 300, 'double down doubles 100 + 50 speed');
  assert.ok(g.cur.gains[dder.id].dd);
});

test('streak: three right in a row earns the fire bonus', () => {
  const { r, g, ps, clock } = humans(['Ann', 'Bob', 'Cat', 'Dan'], { spots: 10 });
  ps.forEach((p, i) => g.act(p, { op: 'answer', text: 'a' + i }));
  const ann = ps[0]; let fired = false, n = 0;
  while (g.phase !== 'wall' && n < 10) {
    stepUntil(r, clock, () => g.phase === 'spot' || g.phase === 'wall');
    if (g.phase === 'wall') break;
    const c = g.cur, right = c.opts.indexOf(c.id);
    for (const p of ps) if (p.id !== c.id) g.act(p, { op: 'guess', pick: right });
    stepUntil(r, clock, () => g.phase === 'reveal');
    if (c.id !== ann.id) { n++; if (n === 3) { assert.ok(g.cur.gains[ann.id].fire, 'fire on the 3rd'); fired = true; } }
  }
  assert.ok(fired, 'Ann guessed 3 in a row');
  assert.ok(g.stats.get(ann.id).best >= 3);
});

test('skip ahead walks every phase; the wall shows unspotlighted answers', () => {
  const { r, g, ps } = humans(['Ann', 'Bob', 'Cat', 'Dan', 'Eve', 'Fay'], { spots: 4, rounds: 3 });
  ps.forEach((p, i) => g.act(p, { op: 'answer', text: 'a' + i }));
  const seen = new Set(); let i = 0;
  while (g.phase !== 'over' && i++ < 100) { seen.add(g.phase); r.hostAction({ type: 'next' }); }
  assert.strictEqual(g.phase, 'over');
  for (const ph of ['answer', 'spot', 'reveal', 'wall']) assert.ok(seen.has(ph), 'saw ' + ph);
  assert.strictEqual(g.round, 3);
  assert.ok(Array.isArray(r.tvState().state.awards), 'awards computed (empty when nobody guessed)');
});

test('wall lists the answers that were not spotlighted, with names', () => {
  const { r, g, ps, clock } = humans(['Ann', 'Bob', 'Cat', 'Dan', 'Eve', 'Fay'], { spots: 4 });
  ps.forEach((p, i) => g.act(p, { op: 'answer', text: 'a' + i }));
  stepUntil(r, clock, () => g.phase === 'wall');
  const tv = r.tvState().state;
  assert.strictEqual(tv.wall.length, 2);
  assert.ok(tv.wall.every((w) => w.name && w.text));
});

test('custom question round: only the host writes it; bots-only falls back', () => {
  const { r, g, ps, clock } = humans(['Ann', 'Bob', 'Cat'], { rounds: 3, custom: 'on' });
  let i = 0; while (g.round < 3 && i++ < 100) r.hostAction({ type: 'next' });
  assert.strictEqual(g.phase, 'custom');
  assert.ok(!g.act(ps[1], { op: 'question', text: 'Not the host?' }).ok);
  assert.ok(!g.act(ps[0], { op: 'question', text: 'hi' }).ok, 'too short');
  assert.ok(g.act(ps[0], { op: 'question', text: 'What is <your> favourite cheese?' }).ok);
  assert.strictEqual(g.phase, 'answer'); assert.strictEqual(g.question, 'What is your favourite cheese?'); assert.ok(r.tvState().state.custom);
  runOut(r, clock);
  // All bots: no host phone, so the final round is a normal question.
  const b = room(4, { rounds: 3, custom: 'on' }); b.r.start(); runOut(b.r, b.clock);
  // Host doesn't write in time: a pack question is used.
  const t = humans(['Ann', 'Bob', 'Cat'], { rounds: 3, custom: 'on' });
  i = 0; while (t.g.round < 3 && i++ < 100) t.r.hostAction({ type: 'next' });
  stepUntil(t.r, t.clock, () => t.g.phase === 'answer');
  assert.ok(t.g.question && !t.g.custom);
});

test('a player leaving mid-spotlight does not stall; late joiners can play', () => {
  const { r, clock } = room(5, { rounds: 3 }, 11);
  const ann = r.join('Ann').player; r.start(); const g = r.game;
  g.act(ann, { op: 'answer', text: 'I am Ann' });
  stepUntil(r, clock, () => g.phase === 'spot');
  const bot = r.list().find((p) => p.bot && p.id !== g.cur.id);
  r.remove(bot.id); r.remove(g.cur.id); // a voter and the author both leave
  const zed = r.join('Zed').player;
  assert.ok(g.scores.has(zed.id));
  if (g.phase === 'spot' && g.cur.id !== zed.id) assert.ok(g.act(zed, { op: 'guess', pick: 0 }).ok, 'late joiner can guess');
  runOut(r, clock);
  assert.strictEqual(g.phase, 'over');
});

test('full game with 4 players (3 bots + Ann) reaches the end with awards', () => {
  const { r, clock } = room(3, {}, 3);
  const ann = r.join('Ann').player; r.start(); const g = r.game;
  let rounds = 0;
  while (g.phase !== 'over') {
    if (g.phase === 'answer' && !g.answers.has(ann.id)) { g.act(ann, { op: 'answer', text: 'Round ' + g.round + ' from Ann' }); rounds++; }
    if (g.phase === 'spot' && g.cur.id !== ann.id && !g.cur.votes.has(ann.id)) g.act(ann, { op: 'guess', pick: 0 });
    if (!clock.step()) break;
  }
  assert.strictEqual(g.phase, 'over'); assert.strictEqual(g.round, def.defaults.rounds); assert.strictEqual(rounds, def.defaults.rounds);
  const tv = r.tvState().state, v = r.playerState(ann).state;
  assert.strictEqual(tv.standings.length, 4); assert.ok(tv.awards.length >= 2, 'awards given');
  assert.ok(v.final && v.stats && v.rank >= 1);
  const total = tv.standings.reduce((a, s) => a + s.points, 0); assert.ok(total > 0, 'points were scored');
});

test('100 players (bots) finish quickly with spotlights capped per round', () => {
  const { r, clock } = room(99, { rounds: 6, spots: 10, pack: 'mix' }, 5);
  const ann = r.join('Ann').player; r.start(); const g = r.game;
  assert.strictEqual(r.players.size, 100);
  const t0 = Date.now(); let maxSpots = 0;
  while (g.phase !== 'over') {
    if (g.phase === 'answer' && !g.answers.has(ann.id)) g.act(ann, { op: 'answer', text: 'Ann!' });
    if (g.phase === 'spot') maxSpots = Math.max(maxSpots, g.spotTotal);
    if (g.phase === 'wall') assert.ok(r.tvState().state.wall.length <= 48);
    if (!clock.step()) break;
  }
  assert.strictEqual(g.phase, 'over'); assert.strictEqual(maxSpots, 10);
  assert.ok(JSON.stringify(r.tvState()).length < 200000, 'TV state stays small');
  assert.ok(Date.now() - t0 < 10000, 'fast');
  assert.strictEqual(r.tvState().state.standings.length, 10);
});

test('every phase has a timer (nobody acting still ends the game)', () => {
  const { r, clock } = room(0, { rounds: 3 });
  r.join('Ann'); r.join('Bob'); r.join('Cat'); r.start();
  runOut(r, clock);
  assert.strictEqual(r.game.phase, 'over');
});

test('new packs: family and coworker questions; a pack refills from itself', () => {
  for (const k of ['family', 'work']) assert.ok(def.PACKS[k].length >= 40, k);
  const all = Object.values(def.PACKS).flat(); assert.strictEqual(new Set(all).size, all.length, 'no question in two packs');
  const { g } = humans(['Ann', 'Bob', 'Cat'], { pack: 'family' });
  const fam = new Set(def.PACKS.family);
  assert.ok(fam.has(g.question));
  g.deck = []; assert.ok(fam.has(g.drawQuestion()), 'refill stays in the pack');
});

test('odd input (objects, non-strings) is refused without crashing', () => {
  const { g, ps } = humans(['Ann', 'Bob', 'Cat']);
  for (const m of [null, 3, 'answer', { op: 'answer', text: { a: 1 } }, { op: 'answer', text: ['x'] }, { op: 'guess', pick: {} }, { op: 'question', text: 5 }]) assert.strictEqual(g.act(ps[0], m).ok, false, JSON.stringify(m));
});

test('results() best-first, highlights and the TV “still deciding” list', () => {
  const { r, g, ps, clock } = humans(['Ann', 'Bob', 'Cat', 'Dan', 'Eve'], { rounds: 3, spots: 4 });
  let checked = false;
  while (g.phase !== 'over') {
    if (g.phase === 'answer') ps.forEach((p, i) => { if (!g.answers.has(p.id)) g.act(p, { op: 'answer', text: p.name + ' says ' + g.round + i }); });
    if (g.phase === 'spot') {
      const c = g.cur, right = c.opts.indexOf(c.id), voters = ps.filter((p) => p.id !== c.id && !c.votes.has(p.id));
      if (!checked && voters.length === 4) { g.act(voters[0], { op: 'guess', pick: right }); const tv = r.tvState().state; assert.strictEqual(tv.notGuessed.length, 3); assert.ok(!tv.notGuessed.includes(voters[0].name)); checked = true; }
      // Ann always fools everyone; everyone always spots Bob.
      for (const p of ps) if (p.id !== c.id && !c.votes.has(p.id)) g.act(p, { op: 'guess', pick: c.id === ps[0].id ? (right + 1) % c.opts.length : right });
    }
    if (!clock.step()) break;
  }
  assert.ok(checked);
  const res = g.results(), st = g.standings();
  assert.deepStrictEqual(res, st.map((x) => x.id)); assert.strictEqual(res.length, 5);
  const h = r.tvState().state.highlights;
  if (g.spotted.get(ps[0].id)) { assert.ok(h.bluff, 'a best bluff'); assert.strictEqual(h.bluff.name, 'Ann'); }
});

console.log(`\n${passed} tests passed`);
