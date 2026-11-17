'use strict';
// Blackjack Night twists and pacing: table events (Happy Hour, Five-Card Charlie, Ties Win,
// Lucky 21) and the double-pay finale, "same bet", who-we're-waiting-on, streaks, awards,
// results() and junk input. Run: node tools/test-box-blackjack.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/blackjack');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function setup(bots = 0, settings = {}, seed = 7) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  room.addBots(bots); Object.assign(room.settings, settings);
  return { room, clock };
}
const human = (room, name) => { const p = room.join(name).player; p.sockets = 1; return p; };
const runOut = (room, clock) => { let i = 0; while (room.game.phase !== 'over' && clock.step()) if (++i > 500000) throw new Error('never ended in ' + room.game.phase); };
const hand = (cards, bet = 100, extra = {}) => ({ cards, bet, done: true, split: false, ...extra });

test('Payouts: normal rules, then each table event changes exactly its own case', () => {
  const { room } = setup(0, {}, 1); human(room, 'Ann'); room.start();
  const g = room.game, pay = (h, d, dbj = false) => g.payout(h, d, dbj);
  g.event = null;
  assert.deepEqual(pay(hand(['AS', 'KD']), 20), { result: 'blackjack', back: 250 });
  assert.deepEqual(pay(hand(['9S', '9D']), 18), { result: 'push', back: 100 });
  assert.deepEqual(pay(hand(['7S', '7D', '7C']), 20), { result: 'win', back: 200 });
  assert.deepEqual(pay(hand(['KS', 'QD', '5C']), 17), { result: 'bust', back: 0 });
  g.event = 'happy'; assert.equal(pay(hand(['AS', 'KD']), 20).back, 300, 'Happy Hour: blackjack pays 2 to 1');
  g.event = 'ties'; assert.deepEqual(pay(hand(['9S', '9D']), 18), { result: 'win', back: 200 }, 'Ties Win');
  g.event = 'lucky21'; assert.deepEqual(pay(hand(['7S', '7D', '7C']), 21), { result: 'lucky', back: 300 }, 'Lucky 21 beats even a dealer 21');
  g.event = 'charlie'; assert.deepEqual(pay(hand(['2S', '3D', '2C', '4H', '5S'], 100, { charlie: true }), 20), { result: 'charlie', back: 200 });
  g.event = 'finale';
  assert.equal(pay(hand(['10S', '9D']), 18).back, 300, 'finale: a win pays double');
  assert.equal(pay(hand(['AS', 'KD']), 18).back, 400, 'finale: blackjack pays 3 to 1');
  assert.equal(pay(hand(['10S', '7D']), 18).back, 0, 'a loss is still a loss');
});
test('Five-Card Charlie: the 5th card without busting ends the hand as a win', () => {
  const { room, clock } = setup(0, { hands: 1 }, 2); const a = human(room, 'Ann'); room.start();
  const g = room.game;
  assert(room.act(a, { op: 'bet', amount: 100 }).ok);
  while (g.phase === 'betting') clock.step();
  if (g.phase !== 'playing') return; // a dealer blackjack ended it early
  g.event = 'charlie';
  const h = g.seats.get(a.id).hands[0];
  h.cards = ['2S', '2D', '3C', '2H']; g.shoe.push('3S');
  assert(room.act(a, { op: 'hit' }).ok);
  assert(h.charlie && h.done, 'charlie!');
  runOut(room, clock);
  assert.equal(h.result, 'charlie');
  assert.equal(g.seats.get(a.id).chips, 1100);
});
test('Events: never on hand 1, the finale on the last hand, none when turned off', () => {
  const { room, clock } = setup(3, { hands: 6 }, 5); room.start();
  const g = room.game, seen = [];
  let r = 0;
  while (g.phase !== 'over' && clock.step()) if (g.round !== r) { r = g.round; seen.push(g.event); }
  assert.equal(seen[0], null);
  assert.equal(seen[5], 'finale');
  assert(seen.every((e, i) => i === 0 || e !== seen[i - 1] || e === null), 'never the same twist twice in a row');
  const off = setup(3, { hands: 6, events: false }, 5); off.room.start();
  const og = off.room.game; let any = false;
  while (og.phase !== 'over' && off.clock.step()) if (og.event) any = true;
  assert.equal(any, false);
});
test('Same bet: last hand’s bet is offered; the TV names who we’re waiting on', () => {
  const { room, clock } = setup(2, { hands: 3 }, 4); const a = human(room, 'Ann'), b = human(room, 'Bo'); room.start();
  const g = room.game;
  assert.deepEqual(room.tvState().state.waitingOn.sort(), ['Ann', 'Bo']);
  room.act(a, { op: 'bet', amount: 40 });
  assert.deepEqual(room.tvState().state.waitingOn, ['Bo']);
  room.act(b, { op: 'bet', amount: 10 });
  while (g.phase === 'betting') clock.step();
  if (g.phase === 'playing') assert(room.tvState().state.waitingOn.length >= 1);
  while (g.round === 1) clock.step();
  assert.equal(room.playerState(a).state.lastBet, 40);
  assert.equal(room.playerState(a).state.bet, 0, 'a fresh hand starts with no bet');
});
test('Streaks, awards and results() best-first; comeback chips scale with the start', () => {
  const { room, clock } = setup(12, { hands: 12, startChips: 2500 }, 9); room.start();
  const g = room.game;
  assert.equal(g.comeback(), 250);
  runOut(room, clock);
  const res = g.results(), chips = res.map((id) => g.seats.get(id).chips);
  assert.deepEqual(chips, chips.slice().sort((x, y) => y - x));
  const tv = room.tvState().state;
  assert(tv.awards.length >= 2 && tv.awards.every((a) => a.icon && a.title && a.name && a.why));
  assert(tv.top[0].chips === chips[0]);
});
test('Chips are conserved apart from payouts: totals match bets and results', () => {
  const { room, clock } = setup(20, { hands: 8, bustBets: false, events: false }, 13); room.start();
  const g = room.game;
  let r = 0, before = 0;
  while (g.phase !== 'over' && clock.step()) {
    if (g.phase === 'results' && g.round !== r) {
      r = g.round;
      let after = 0, expect = before;
      for (const [, s] of g.seats) { after += s.chips; for (const h of s.hands) expect += { win: h.bet, blackjack: Math.floor(h.bet * 1.5), push: 0, lose: -h.bet, bust: -h.bet }[h.result]; }
      if (before) assert.equal(after, expect, 'hand ' + r);
    }
    if (g.phase === 'betting') before = [...g.seats.values()].reduce((a, s) => a + s.chips, 0);
  }
});
test('Junk input never crashes and never creates chips', () => {
  const { room, clock } = setup(1, { hands: 1 }, 3); const a = human(room, 'Ann'); room.start();
  for (const m of [{ op: 'bet', amount: 'lots' }, { op: 'bet', amount: -50 }, { op: 'bet', amount: Infinity }, { op: 'bet', amount: 1e12 }, { op: 'bet', amount: { x: 1 } }, { op: 'bust', on: { id: 1 } }, { op: 'bust', on: a.id }, { op: 'bust', on: 'p999' }, { op: 'hit' }, { op: 'nope' }]) {
    const r = room.act(a, m); assert.equal(r.ok, false, JSON.stringify(m));
  }
  assert.equal(room.game.seats.get(a.id).chips, 1000);
  runOut(room, clock);
  assert.equal(room.act(a, { op: 'bet', amount: 10 }).ok, false, 'closed after the end');
});
test('100 players: the TV caps the waiting list and the game ends', () => {
  const { room, clock } = setup(100, { hands: 5 }, 8); room.start();
  const g = room.game;
  while (g.phase !== 'playing' && g.phase !== 'over') clock.step();
  const tv = room.tvState().state;
  if (g.phase === 'playing') assert(tv.waitingOn.length <= 8 && tv.waitingCount >= tv.waitingOn.length);
  runOut(room, clock);
  assert.equal(g.results().length, 100);
});

console.log(`\nAll ${passed} Blackjack tests passed.`);
