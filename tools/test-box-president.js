'use strict';
// President house rules and pacing: auto-pass when nothing beats the pile, a 2 clears the pile,
// Revolution flips the ranks, the last round scores double, idle players get a short clock,
// the round recap, awards, results() and junk input. Run: node tools/test-box-president.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/president');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function setup(bots = 0, settings = {}, seed = 7) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  room.addBots(bots); Object.assign(room.settings, settings);
  return { room, clock };
}
const human = (room, name) => { const p = room.join(name).player; p.sockets = 1; return p; };
const runOut = (room, clock) => { let i = 0; while (room.game.phase !== 'over' && clock.step()) if (++i > 500000) throw new Error('never ended in ' + room.game.phase); };
// Run timers due in the next ms (the virtual clock jumps straight to each one).
const stepFor = (clock, ms) => { const end = clock.now() + ms; for (;;) { let at = Infinity; for (const e of clock.queue.values()) at = Math.min(at, e.at); if (at > end || !clock.step()) break; } };
// Three humans at one table with chosen hands; `a` to lead.
function table3(hands, settings = {}) {
  const { room, clock } = setup(0, settings, 3);
  const ps = ['Ann', 'Bo', 'Cy'].map((n) => human(room, n));
  room.start();
  const g = room.game, t = g.tables[0];
  t.seats = ps.map((p) => p.id);
  t.hands = Object.fromEntries(ps.map((p, i) => [p.id, hands[i].slice()]));
  g.setTurn(t, ps[0].id);
  return { room, clock, g, t, ps };
}

test('Auto-pass: a player who can’t beat the pile passes by themselves (and their phone says so)', () => {
  const { room, clock, t, ps: [a, b, c] } = table3([['9C', '9D', '4H'], ['5C', '6D', '7H'], ['8S', 'JD', 'QH']]);
  assert(room.act(a, { op: 'play', cards: ['9C', '9D'] }).ok);
  assert.equal(t.turn, b.id);
  assert(t.stuck, 'Bo has no pair at all');
  assert(room.playerState(b).state.stuck);
  stepFor(clock, 4000);
  assert.equal(t.turn, a.id, 'Bo and Cy both auto-passed: Ann leads again');
  assert.equal(t.top, null);
  assert(t.log.some((l) => l.pass && l.auto));
  void c;
});
test('A 2 clears the pile at once and the same player leads; turned off, it doesn’t', () => {
  let { room, t, ps: [a, b] } = table3([['2C', '4H', '5H'], ['6C', '7D', '8H'], ['9S', 'JD', 'QH']]);
  assert(room.act(a, { op: 'play', cards: ['2C'] }).ok);
  assert.equal(t.top, null, 'pile cleared');
  assert.equal(t.turn, a.id, 'Ann leads again');
  assert(room.tvState().state.tables[0].burn, 'the TV calls out the burn');
  ({ room, t, ps: [a, b] } = table3([['2C', '4H', '5H'], ['6C', '7D', '8H'], ['9S', 'JD', 'QH']], { twos: false }));
  assert(room.act(a, { op: 'play', cards: ['2C'] }).ok);
  assert(t.top, 'house rule off: the 2 just sits there');
  assert.notEqual(t.turn, a.id);
  void b;
});
test('Revolution: four of a kind flips the ranks; lower cards win until the next deal', () => {
  const { room, clock, g, t, ps: [a, b, c] } = table3([['7C', '7D', '7H', '7S', 'KD'], ['3C', '4D', '8H', 'AH', 'KS'], ['5S', 'JD', 'QH', '9D', '10C']]);
  assert(room.act(a, { op: 'play', cards: ['7C', '7D', '7H', '7S'] }).ok);
  assert(t.rev, 'revolution started');
  assert(g.room.fxLog.some((f) => f.kind === 'revolution'));
  stepFor(clock, 5000); // nobody else has four of a kind: both auto-pass
  assert.equal(t.turn, a.id);
  assert(room.act(a, { op: 'play', cards: ['KD'] }).ok);
  assert.equal(t.turn, b.id);
  const e = room.act(b, { op: 'play', cards: ['AH'] });
  assert.equal(e.ok, false, 'an Ace no longer beats a King');
  assert(/LOWER/.test(e.error));
  assert(room.act(b, { op: 'play', cards: ['8H'] }).ok, 'an 8 beats a King now');
  assert(room.act(c, { op: 'play', cards: ['5S'] }).ok);
  assert.equal(def._test.power('3C') < def._test.power('2H'), true);
});
test('Last round scores double; the TV and phones announce it', () => {
  const { room, clock } = setup(4, { rounds: 2, finalDouble: true }, 11);
  room.start();
  const g = room.game;
  assert.equal(room.tvState().state.final, false);
  while (g.round === 1 && clock.step());
  assert(room.tvState().state.final, 'final round flagged');
  assert(g.room.fxLog.some((f) => f.kind === 'final'));
  const before = new Map(g.points);
  runOut(room, clock);
  const gained = [...g.points].map(([id, v]) => v - before.get(id)).sort((x, y) => y - x);
  assert.deepEqual(gained, [8, 6, 2, 0], '4 seats: President 4, VP 3, Vice Scum 1, Scum 0, all doubled');
});
test('A player whose phone went quiet (two timeouts) gets a short clock until they play', () => {
  const { room, clock, g, t, ps: [a] } = table3([['3C', '4D', '5H', '6S'], ['7C', '8D', '9H'], ['10S', 'JD', 'QH']], { turnSeconds: 25 });
  g.idle.set(a.id, 2);
  g.setTurn(t, a.id);
  assert(t.deadline - clock.now() <= 6000, 'short clock');
  assert(room.tvState().state.tables[0].seats.find((x) => x.id === a.id).idle);
  assert(room.act(a, { op: 'play', cards: ['3C'] }).ok);
  assert.equal(g.idle.has(a.id), false, 'back: normal clock again');
});
test('Round recap, awards and results() best-first at the end', () => {
  const { room, clock } = setup(5, { rounds: 3 }, 21);
  room.start();
  const g = room.game;
  while (g.phase !== 'break' && clock.step());
  const rc = room.tvState().state.recap;
  assert(rc && rc[0].finish.length === 5 && rc[0].finish[0].title === 'president');
  runOut(room, clock);
  const res = g.results();
  assert.equal(res.length, 5);
  const pts = res.map((id) => g.points.get(id));
  assert.deepEqual(pts, pts.slice().sort((x, y) => y - x));
  const tv = room.tvState().state;
  assert(Array.isArray(tv.awards) && tv.awards.length >= 1, 'at least Head of State');
  assert(tv.awards.every((a) => a.icon && a.title && a.name && a.why));
});
test('Several tables with recap moves (up / down) and no hand ever reaches the TV', () => {
  const { room, clock } = setup(14, { rounds: 2, tableSize: 5 }, 5);
  room.start();
  const g = room.game;
  assert.equal(g.tables.length, 3);
  while (g.phase !== 'break' && clock.step());
  const rc = room.tvState().state.recap;
  assert(rc[1].up && rc[0].down, 'the President of table 2 moves up; the Scum of the Palace moves down');
  runOut(room, clock);
  assert(!/"hand"/.test(JSON.stringify(room.tvState())));
});
test('Junk input never crashes: odd card lists, objects, wrong ops, after the end', () => {
  const { room, clock, ps: [a, b] } = table3([['3C', '4D', '5H'], ['7C', '8D', '9H'], ['10S', 'JD', 'QH']]);
  for (const m of [{ op: 'play' }, { op: 'play', cards: 'QH' }, { op: 'play', cards: [null, 5, {}] }, { op: 'play', cards: Array(500).fill('3C') }, { op: 'play', cards: ['3C', '3C'] }, { op: 'give', cards: [{}] }, { op: 'give' }, { op: 'pass' }, { op: 'zap' }, {}]) {
    const r = room.act(a, m); assert.equal(r.ok, false, JSON.stringify(m).slice(0, 40));
  }
  assert.equal(room.act(b, { op: 'play', cards: ['7C'] }).ok, false, 'not Bo’s turn');
  room.game.next();
  runOut(room, clock);
  assert.equal(room.act(a, { op: 'play', cards: ['3C'] }).ok, false);
});
test('100 players with every house rule on finish; Play again starts fresh', () => {
  const { room, clock } = setup(100, { rounds: 3, tableSize: 6 }, 8);
  room.start();
  runOut(room, clock);
  assert.equal(room.game.results().length, 100);
  room.hostAction({ type: 'again' });
  assert.equal(room.game.round, 1);
  assert.equal(room.game.phase === 'trade' || room.game.phase === 'play', true);
});

console.log(`\nAll ${passed} President tests passed.`);
