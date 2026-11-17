'use strict';
// Quick Draw rules: whole bot games on a virtual clock, every challenge's scoring, fair timing
// (claimed tap times are clamped, false starts, impossible reactions), phone input validation,
// the host skip, awards and results().   node tools/test-box-quickdraw.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/quickdraw');
const { rhythmAcc, RANK_PTS, FALSE_PEN, MAX_RATE } = def._test;
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const playOut = (room, clock, max = 300000) => { let i = 0; while (room.game.phase !== 'over' && clock.step()) if (++i > max) throw new Error('never ended (' + room.game.phase + ')'); };
// Step the clock until cond() holds.
const until = (clock, cond, what) => { let i = 0; while (!cond()) { if (!clock.step() || ++i > 100000) throw new Error('never reached ' + what); } };
// A room with real (human) players only, so we control every tap; a forced lineup.
function humans(n, lineup, settings = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('QD', def, { clock, seed: 7 });
  const ps = []; for (let i = 0; i < n; i++) { const p = room.join('P' + i).player; p.sockets = 1; ps.push(p); }
  Object.assign(room.settings, settings);
  assert(room.start().ok);
  const g = room.game; g.lineup = lineup; g.c.kind = lineup[0]; return { clock, room, g, ps };
}
const toPlay = (clock, g, kind) => until(clock, () => g.phase === 'play' && g.c && g.c.kind === kind, 'play ' + kind);

test('module: locked behind President, best crowd 2–20, six how-to steps, settings', () => {
  assert.equal(def.locked.how, 'Finish a game of President to unlock it.');
  assert.deepEqual(def.best, [2, 20]); assert.equal(def.min, 2); assert.equal(def.howSteps, 6);
  assert.deepEqual(def.fields.map((f) => f.key), ['rounds', 'mix', 'pace']);
  assert.deepEqual(def.show, { facts: false });
});

test('bots play whole games of every size, mix and pace; results() lists everyone best-first', () => {
  for (const [n, mix, pace, rounds] of [[2, 'all', 'normal', 7], [5, 'all', 'easy', 5], [8, 'duel', 'sharp', 5], [13, 'still', 'normal', 10], [24, 'all', 'sharp', 7]]) {
    const clock = new VirtualClock(), room = new BoxRoom('QD', def, { clock, seed: n });
    room.addBots(n); Object.assign(room.settings, { mix, pace, rounds }); assert(room.start().ok);
    assert.deepEqual(room.game.results(), [], 'no results mid-game');
    playOut(room, clock);
    const g = room.game, res = g.results();
    assert.equal(res.length, n); assert.equal(new Set(res).size, n);
    const pts = res.map((id) => g.points.get(id)); for (let i = 1; i < pts.length; i++) assert(pts[i - 1] >= pts[i], 'best first');
    assert.equal(g.lineup.length, rounds); assert.equal(g.lineup[0], 'draw'); assert.equal(g.lineup[rounds - 1], 'draw', 'final showdown');
    if (mix === 'duel') assert(g.lineup.every((k) => k === 'draw'));
    if (mix === 'still') assert(!g.lineup.includes('shake'));
    for (let i = 1; i < g.lineup.length - 1; i++) assert(g.lineup[i] !== g.lineup[i - 1] || mix === 'duel', 'no repeats in a row');
    assert(g.final && g.final.standings.length === n && g.final.awards.some((a) => a.key === 'fast'));
    const mins = clock.t / 60000; assert(mins > 1.5 && mins < 9, `length ${mins.toFixed(1)} min`);
  }
});

test('DRAW! duels (4–8 players): a bracket, false starts lose, the champion ranks first', () => {
  const { clock, g, ps } = humans(4, ['draw', 'draw']);
  toPlay(clock, g, 'draw');
  const c = g.c; assert.equal(c.mode, 'duel'); assert.equal(c.pairs.length, 2); assert.equal(c.heats, 2);
  const [pr1, pr2] = c.pairs, P = (id) => ps.find((p) => p.id === id);
  // Before armAt: taps are ignored (still walking out).
  assert.equal(g.act(P(pr1.a), { op: 'tap', c: c.id, t: clock.now() }).early, true);
  clock.t = c.armAt + 100; // (no timer fires at armAt: set the clock)
  // pr1.a jumps the gun; pr1.b never taps → pr1.b wins.
  const fs = g.act(P(pr1.a), { op: 'tap', c: c.id, t: clock.now() }); assert.equal(fs.false, true);
  assert.equal(g.act(P(pr1.a), { op: 'tap', c: c.id, t: clock.now() }).again, true, 'one tap per duel');
  until(clock, () => clock.now() >= c.goAt, 'go');
  clock.t = c.goAt + 300;
  // pr2.a claims an impossible 5 ms reaction → clamped to 100 ms; pr2.b is slower at 300.
  assert.equal(g.act(P(pr2.a), { op: 'tap', c: c.id, t: c.goAt + 5 }).ms, 100);
  assert.equal(g.act(P(pr2.b), { op: 'tap', c: c.id, t: c.goAt + 300 }).ms, 300);
  until(clock, () => c.step === 'shot', 'shot');
  assert.equal(pr1.win, pr1.b); assert.equal(pr2.win, pr2.a);
  assert.equal(c.alive.length, 2);
  until(clock, () => c.step === 'standoff' && c.heat === 2, 'final');
  until(clock, () => clock.now() >= c.goAt, 'go 2'); clock.t = c.goAt + 250;
  g.act(P(pr2.a), { op: 'tap', c: c.id, t: c.goAt + 250 });
  until(clock, () => g.phase === 'result', 'result');
  const rows = c.res.rows; assert.equal(rows[0].id, pr2.a); assert.equal(rows[1].id, pr1.b);
  const jumper = rows.find((r) => r.id === pr1.a); assert.equal(jumper.fs, 1); assert.equal(jumper.pen, FALSE_PEN);
  assert.equal(rows[0].gain, RANK_PTS[0]);
  assert.equal(g.stat(pr1.a).falses, 1); assert.equal(g.stat(pr2.a).best, 100);
});

test('DRAW! free-for-all (2–3 or 9+): three shots, a claimed time is clamped to the arrival window', () => {
  const { clock, g, ps } = humans(2, ['draw', 'draw']);
  toPlay(clock, g, 'draw');
  const c = g.c; assert.equal(c.mode, 'ffa');
  for (let shot = 1; shot <= 3; shot++) {
    until(clock, () => c.step === 'standoff' && c.shot === shot && clock.now() >= c.goAt, 'shot ' + shot);
    clock.t = c.goAt + 2000 - 1; // a very late arrival…
    const r = g.act(ps[0], { op: 'tap', c: c.id, t: c.goAt - 5000 }); // …claiming a time long before the signal
    assert.equal(r.false, undefined, 'a claim older than 800 ms before arrival is clamped, not a false start');
    assert(r.ms >= 1999 - 800 - 1, 'clamped to arrival − 800 ms');
    const r2 = g.act(ps[1], { op: 'tap', c: c.id, t: clock.now() + 99999 }); // a claim from the future
    assert(r2.ms <= 1999, 'clamped to the arrival time');
  }
  until(clock, () => g.phase === 'result', 'result');
  assert.equal(c.res.rows.length, 2);
});

test('the Lantern: GREEN taps score reaction times, decoys and gaps are false starts (once per flash)', () => {
  const { clock, g, ps } = humans(2, ['flash', 'draw']);
  toPlay(clock, g, 'flash');
  const c = g.c, greens = c.flashes.filter((f) => f.green), decoys = c.flashes.filter((f) => !f.green);
  assert.equal(greens.length, 3); assert(decoys.length >= 3);
  const d = decoys[0]; clock.t = d.at + 50;
  assert.equal(g.act(ps[1], { op: 'tap', c: c.id, t: d.at + 50 }).false, true);
  assert.equal(g.act(ps[1], { op: 'tap', c: c.id, t: d.at + 60 }).false, true); // mashing the same decoy…
  assert.equal(g.stat(ps[1].id).falses, 1, '…counts once');
  for (const f of greens) { clock.t = f.at + 280; assert.equal(g.act(ps[0], { op: 'tap', c: c.id, t: f.at + 280 }).ms, 280); assert.equal(g.act(ps[0], { op: 'tap', c: c.id, t: f.at + 290 }).again, true); }
  until(clock, () => g.phase === 'result', 'result');
  const [a, b] = c.res.rows; assert.equal(a.id, ps[0].id); assert.match(a.label, /3\/3 greens/); assert.equal(b.fs, 1);
});

test('Chicken Run: count, lock in after the run, exact counts win, ties go to the quicker lock', () => {
  const { clock, g, ps } = humans(3, ['count', 'draw']);
  toPlay(clock, g, 'count');
  const c = g.c, N = c.answer; assert.equal(c.crit.filter((x) => x.e === '🐔').length, N);
  assert(c.crit.every((x) => x.at >= 0 && x.at + x.dur <= 10500));
  assert.equal(g.act(ps[0], { op: 'count', c: c.id, n: 3 }).ok, true);
  assert.equal(g.act(ps[0], { op: 'lock', c: c.id, n: N }).ok, false, 'no locking during the run');
  until(clock, () => c.step === 'lock', 'lock');
  clock.t += 500; assert(g.act(ps[1], { op: 'lock', c: c.id, n: N }).ok);
  clock.t += 500; assert(g.act(ps[0], { op: 'lock', c: c.id, n: N }).ok);
  assert.equal(g.act(ps[0], { op: 'lock', c: c.id, n: 1 }).ok, false, 'locked is locked');
  g.act(ps[2], { op: 'count', c: c.id, n: N + 2 });
  until(clock, () => g.phase === 'result', 'result');
  const rows = c.res.rows; assert.deepEqual(rows.map((r) => r.id), [ps[1].id, ps[0].id, ps[2].id]);
  assert.equal(c.res.answer, N); assert.match(rows[2].label, /off by 2/);
});

test('Stampede: shakes are capped at the human maximum rate; finish times rank the race', () => {
  const { clock, g, ps } = humans(2, ['shake', 'draw']);
  toPlay(clock, g, 'shake');
  const c = g.c;
  until(clock, () => clock.now() >= c.goAt + 1000, 'race');
  g.act(ps[0], { op: 'shake', c: c.id, n: 999 }); // a cheat
  assert(c.prog.get(ps[0].id).n <= MAX_RATE + 4 + 1, 'capped by elapsed time');
  until(clock, () => clock.now() >= c.goAt + 6000, 'later');
  const r = g.act(ps[0], { op: 'shake', c: c.id, n: c.target, t: clock.now() - 100 }); assert.equal(r.fin, 5900);
  g.act(ps[1], { op: 'shake', c: c.id, n: 10 });
  assert.equal(g.act(ps[1], { op: 'shake', c: c.id, n: -1 }).ok, false);
  assert.equal(g.act(ps[1], { op: 'shake', c: c.id, n: 1.5 }).ok, false);
  until(clock, () => g.phase === 'result', 'result');
  assert.equal(c.res.rows[0].id, ps[0].id); assert.match(c.res.rows[1].label, /%/);
});

test('Copycat: rhythm accuracy, two rhythms, validation', () => {
  assert.equal(rhythmAcc([500, 250, 250], [0, 500, 750, 1000]), 1);
  assert(rhythmAcc([500, 250, 250], [0, 450, 760, 1010]) > 0.85);
  assert(rhythmAcc([500, 250, 250], [0, 500]) < 0.4, 'missing beats cost');
  assert(rhythmAcc([500, 250], [0, 500, 750, 900, 1000]) < 1, 'extra taps cost');
  assert.equal(rhythmAcc([500], []), 0);
  const { clock, g, ps } = humans(2, ['copy', 'draw']);
  toPlay(clock, g, 'copy');
  const c = g.c;
  for (const k of [0, 1]) {
    until(clock, () => c.step === 'repeat' && c.k === k, 'repeat ' + k);
    const perfect = [0]; for (const gp of c.gaps) perfect.push(perfect[perfect.length - 1] + gp);
    for (const bad of [{ taps: 'x' }, { taps: [] }, { taps: [0, -5] }, { taps: [0, 300, 200] }, { taps: Array(20).fill(0) }, { taps: [0, NaN] }]) assert.equal(g.act(ps[1], { op: 'rhythm', c: c.id, k, ...bad }).ok, false);
    assert.equal(g.act(ps[0], { op: 'rhythm', c: c.id, k, taps: perfect }).acc, 100);
    assert.equal(g.act(ps[0], { op: 'rhythm', c: c.id, k, taps: perfect }).ok, false, 'once per rhythm');
    assert.equal(g.act(ps[1], { op: 'rhythm', c: c.id, k: 1 - k, taps: perfect }).ok, false, 'the right rhythm only');
    assert(g.act(ps[1], { op: 'rhythm', c: c.id, k, taps: perfect.map((x, i) => x + i * 60) }).ok);
  }
  until(clock, () => g.phase === 'result', 'result');
  assert.equal(c.res.rows[0].id, ps[0].id); assert.match(c.res.rows[0].label, /100% in rhythm/);
});

test('scoring: rank points, podium streak bonus, final showdown double, never below 0', () => {
  const { clock, g, ps } = humans(2, ['flash', 'flash', 'draw']);
  g.lineup = ['flash', 'copy', 'draw']; g.c.kind = 'flash';
  // flash: P0 wins
  toPlay(clock, g, 'flash');
  for (const f of g.c.flashes.filter((x) => x.green)) { clock.t = f.at + 250; g.act(ps[0], { op: 'tap', c: g.c.id, t: f.at + 250 }); }
  until(clock, () => g.phase === 'result', 'r1');
  assert.equal(g.points.get(ps[0].id), RANK_PTS[0]); assert.equal(g.points.get(ps[1].id), 0, 'did nothing, no points');
  // copy: P0 wins again → streak 2 → +50
  toPlay(clock, g, 'copy');
  for (const k of [0, 1]) { until(clock, () => g.c.step === 'repeat' && g.c.k === k, 'rep'); const t = [0]; for (const gp of g.c.gaps) t.push(t[t.length - 1] + gp); g.act(ps[0], { op: 'rhythm', c: g.c.id, k, taps: t }); }
  until(clock, () => g.phase === 'result', 'r2');
  const row = g.c.res.rows[0]; assert.equal(row.streak, 2); assert.equal(row.bonus, 50);
  // final draw: ×2 and P1 false starts (points floor at 0)
  toPlay(clock, g, 'draw'); assert.equal(g.c.mult, 2);
  clock.t = g.c.armAt + 100; g.act(ps[1], { op: 'tap', c: g.c.id, t: clock.now() });
  playOut(g.room, clock);
  assert(g.points.get(ps[1].id) >= 0);
  assert.deepEqual(g.results()[0], ps[0].id);
  const jumpy = g.final.awards.find((a) => a.key === 'jumpy'); assert.equal(jumpy.id, ps[1].id);
});

test('phone input is validated; late or stray taps are quiet; pings answer the server clock', () => {
  const { clock, g, ps } = humans(3, ['count', 'draw']);
  const p = ps[0];
  for (const bad of [{ op: 'tap', c: 'x' }, { op: 'nope' }, {}, { op: 'count', n: 5 }]) assert.equal(g.room.act(p, bad).ok, false);
  const ping = g.room.act(p, { op: 'ping' }); assert.equal(ping.ok, true); assert.equal(ping.now, clock.now());
  assert.equal(g.hostAct({ type: 'qdPing' }).now, clock.now()); assert.equal(g.hostAct({ type: 'x' }).ok, false);
  toPlay(clock, g, 'count');
  const c = g.c;
  for (const n of [-1, 100, 2.5, 'ten', null]) assert.equal(g.act(p, { op: 'count', c: c.id, n }).ok, false);
  assert.equal(g.act(p, { op: 'count', c: c.id + 99, n: 3 }).ok, false, 'wrong challenge');
  assert.equal(g.act(p, { op: 'tap', c: c.id, t: 5 }).ok, false, 'no taps in a count');
  assert.equal(g.act(p, { op: 'rhythm', c: c.id, k: 0, taps: [0, 1] }).ok, false);
  assert.equal(g.act(p, { op: 'shake', c: c.id, n: 3 }).ok, false);
});

test('host Skip ahead moves through every phase; a player who joins mid-game is scored from the next challenge', () => {
  const clock = new VirtualClock(), room = new BoxRoom('QD', def, { clock, seed: 3 });
  room.addBots(4); room.settings.rounds = 5; room.start();
  const g = room.game; let i = 0;
  while (g.phase !== 'over' && ++i < 200) { g.next(); if (i === 3) { const late = room.join('Late').player; late.sockets = 1; } }
  assert.equal(g.phase, 'over'); assert.equal(g.results().length, 5);
  assert(room.tvState().state.final && room.playerState(room.list()[0]).state.final);
});

test('TV and phone states: public schedules on the TV only, each phone sees its own duel', () => {
  const { clock, g, ps } = humans(4, ['draw', 'flash', 'count', 'shake', 'copy', 'draw']);
  for (const kind of ['draw', 'flash', 'count', 'shake', 'copy']) {
    toPlay(clock, g, kind);
    const tv = g.tv(), v = g.view(ps[0]);
    assert.equal(tv.c.kind, kind); assert.equal(v.c.kind, kind); assert.equal(typeof v.now, 'number');
    if (kind === 'flash') { assert(tv.c.flashes.length > 3); assert.equal(v.c.flashes, undefined, 'phones never see the lantern schedule'); }
    if (kind === 'count') { assert(tv.c.crit.length); assert.equal(v.c.crit, undefined); assert.equal(JSON.stringify(v).includes('answer":' + g.c.answer), false); }
    if (kind === 'draw') { assert(v.c.opp && v.c.opp.name); assert.equal(typeof v.c.goAt, 'number'); }
    if (kind === 'copy') assert.equal(v.c.beats.length, g.c.beats.length);
    JSON.stringify(tv); JSON.stringify(v);
    until(clock, () => g.phase === 'result', 'result ' + kind);
    assert(g.tv().c.res.rows.length === 4); assert('mine' in g.view(ps[0]).c);
  }
});

console.log(`\n${passed} Quick Draw tests passed.`);
