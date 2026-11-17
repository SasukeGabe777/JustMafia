'use strict';
// Two Truths & a Lie rules test (virtual clock, no server): input validation, editing your
// three, leaning early during the grilling, the plot-twist reveal, a hot-seat leaver, the
// auto hot-seat count, end-of-game awards / highlights / unrevealed lies, results(), and
// full games with 4 and 100 players.
const assert = require('assert');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/truths');

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
const write = (g, p, lie = 0) => g.act(p, { op: 'write', items: [p.name + ' one', p.name + ' two', p.name + ' three'], lie });

console.log('Two Truths & a Lie');

test('module shape: every field has options and the defaults are valid', () => {
  assert.strictEqual(def.key, 'truths');
  for (const f of def.fields) assert.ok(f.options.some((o) => o.value === def.defaults[f.key]), 'default for ' + f.key);
});

test('weird input never crashes; statements are cleaned and must differ', () => {
  const { g, ps } = humans(['Ann', 'Bob', 'Cat']);
  const p = ps[0];
  for (const m of [null, 7, 'x', {}, { op: 'write' }, { op: 'write', items: 'abc', lie: 0 }, { op: 'write', items: [{}, {}, {}], lie: 0 },
    { op: 'write', items: ['aaa', 'bbb', 'ccc'], lie: 5 }, { op: 'write', items: ['aaa', 'bbb', 'ccc'], lie: '0x' }, { op: 'write', items: ['same', 'Same', 'other'], lie: 0 },
    { op: 'vote', pick: 0 }, { op: 'nope' }]) assert.strictEqual(g.act(p, m).ok, false, JSON.stringify(m));
  assert.ok(g.act(p, { op: 'write', items: ['<i>I \u0007 can‮ juggle</i>' + 'y'.repeat(200), 'I have a twin', 'I met a llama'], lie: 2 }).ok);
  const t = g.sets.get(p.id).items[0];
  assert.ok(!/[<>\u0007‮]/.test(t) && t.length <= 90, 'clean: ' + t);
});

test('you can change your three until writing ends; all written moves on', () => {
  const { g, ps, r, clock } = humans(['Ann', 'Bob', 'Cat']);
  write(g, ps[0], 0); write(g, ps[0], 2);
  assert.strictEqual(g.sets.get(ps[0].id).lie, 2, 'rewritten');
  assert.strictEqual(r.tvState().state.table.filter((x) => x.done).length, 1, 'TV shows who is ready');
  write(g, ps[1]); write(g, ps[2]);
  stepUntil(r, clock, () => g.phase !== 'write');
  assert.ok(['talk', 'vote'].includes(g.phase));
});

test('lean early while they’re grilled; everyone leaned means the reveal comes right after voting opens', () => {
  const { g, ps, r, clock } = humans(['Ann', 'Bob', 'Cat', 'Dan'], { talk: 30 });
  ps.forEach((p) => write(g, p));
  stepUntil(r, clock, () => g.phase === 'talk');
  const seat = g.cur.id, voters = ps.filter((p) => p.id !== seat);
  assert.ok(!g.act(r.get(seat), { op: 'vote', pick: 0 }).ok, 'no voting on your own');
  for (const p of voters) assert.ok(g.act(p, { op: 'vote', pick: g.cur.lie }).ok);
  assert.strictEqual(g.phase, 'talk', 'the grilling still runs its course');
  assert.strictEqual(r.tvState().state.seat.lie, null, 'no lie on the TV before the reveal');
  stepUntil(r, clock, () => g.phase === 'reveal');
  assert.strictEqual(g.cur.result.right, 3); assert.strictEqual(g.scores.get(seat), 0);
  for (const p of voters) assert.strictEqual(r.playerState(p).state.seat.gain, 1);
});

test('plot twist: a TRUE statement got more votes than the lie', () => {
  const { g, ps, r, clock } = humans(['Ann', 'Bob', 'Cat', 'Dan'], { talk: 0 });
  ps.forEach((p) => write(g, p));
  stepUntil(r, clock, () => g.phase === 'vote');
  const truth = (g.cur.lie + 1) % 3, voters = ps.filter((p) => p.id !== g.cur.id);
  voters.forEach((p, i) => g.act(p, { op: 'vote', pick: i < 2 ? truth : g.cur.lie }));
  assert.strictEqual(g.phase, 'reveal');
  assert.strictEqual(g.cur.result.twist, truth); assert.strictEqual(g.scores.get(g.cur.id), 2, 'fooled two');
  assert.ok(r.fxLog.some((f) => f.kind === 'drum' && f.twist));
});

test('the player in the hot seat leaving skips to the next one', () => {
  const { r, clock } = room(4, { talk: 15 }, 5);
  const ann = r.join('Ann').player; r.start(); const g = r.game;
  write(g, ann);
  stepUntil(r, clock, () => g.phase === 'talk');
  const n = g.cur.n; r.remove(g.cur.id);
  assert.ok(g.cur.n === n + 1 || g.phase === 'over', 'moved on');
  stepUntil(r, clock, () => g.phase === 'over');
});

test('auto hot seat: 12 of 20 take a turn; the rest of the lies are revealed at the end with awards and highlights', () => {
  const { r, clock } = room(18, {}, 8);
  const ann = r.join('Ann').player, bob = r.join('Bob').player; r.start(); const g = r.game;
  write(g, ann, 1); write(g, bob, 2);
  stepUntil(r, clock, () => g.phase !== 'write');
  assert.strictEqual(g.total, 12);
  assert.ok(g.featuredIds.has(ann.id) && g.featuredIds.has(bob.id), 'humans first');
  while (g.phase !== 'over') {
    if ((g.phase === 'vote' || g.phase === 'talk') && g.cur.id !== ann.id && !g.cur.votes.has(ann.id)) g.act(ann, { op: 'vote', pick: g.cur.lie });
    if (!clock.step()) break;
  }
  const tv = r.tvState().state;
  assert.strictEqual(tv.gallery.length, 8, 'eight lies never got the hot seat');
  assert.ok(tv.gallery.every((x) => x.name && x.lie));
  assert.ok(tv.awards.some((a) => a.key === 'detect' && a.name === 'Ann'), 'Ann spotted every lie');
  assert.ok(tv.highlights && 'lie' in tv.highlights && 'truth' in tv.highlights);
  const res = g.results(); assert.strictEqual(res.length, 20);
  const st = g.standings(); for (let i = 1; i < st.length; i++) assert.ok(st[i - 1].points >= st[i].points);
  const v = r.playerState(ann).state; assert.ok(v.final && v.stats.right >= 11);
});

test('skip ahead walks every phase; nobody acting still ends the game', () => {
  const { g, ps, r } = humans(['Ann', 'Bob', 'Cat'], { talk: 15 });
  ps.forEach((p) => write(g, p));
  const seen = new Set(); let i = 0;
  while (g.phase !== 'over' && i++ < 100) { seen.add(g.phase); r.hostAction({ type: 'next' }); }
  for (const ph of ['write', 'talk', 'vote', 'reveal']) assert.ok(seen.has(ph), 'saw ' + ph);
  const idle = humans(['Ann', 'Bob', 'Cat']);
  stepUntil(idle.r, idle.clock, () => idle.g.phase === 'over');
});

test('full games: 4 players and 100 players finish; TV state stays small', () => {
  const small = room(4, {}, 4); small.r.start(); stepUntil(small.r, small.clock, () => small.r.game.phase === 'over');
  const { r, clock } = room(99, { featured: 100 }, 5);
  const ann = r.join('Ann').player; r.start(); const g = r.game; write(g, ann);
  let maxTv = 0; const t0 = Date.now();
  while (g.phase !== 'over') { maxTv = Math.max(maxTv, JSON.stringify(r.tvState()).length); if (!clock.step()) break; }
  assert.strictEqual(g.phase, 'over'); assert.strictEqual(g.total, 100);
  assert.ok(maxTv < 60000, 'TV state ' + maxTv); assert.ok(Date.now() - t0 < 15000);
});

console.log(`\n${passed} tests passed`);
