'use strict';
// Price Panic: scoring math, hidden prices, input validation, special rounds, power-ups,
// and full games with 1 and 100 players on a virtual clock. Run: node tools/test-box-price.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/price');
const { ITEMS, CATEGORIES } = require('../box/games/price-items');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function setup(bots = 0, settings = {}, seed = 7) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  room.addBots(bots); Object.assign(room.settings, settings);
  return { room, clock };
}
const human = (room, name) => { const p = room.join(name).player; p.sockets = 1; return p; };
const stepUntil = (room, clock, pred, limit = 100000) => { let i = 0; while (!pred()) { if (!clock.step()) throw new Error('clock ran dry in ' + room.game.phase); if (++i > limit) throw new Error('stuck in ' + room.game.phase); } };
const runOut = (room, clock) => stepUntil(room, clock, () => room.game.phase === 'over', 2000000);
const leaks = (obj) => /"price":\s*\d/.test(JSON.stringify(obj));

test('Items: ~150 original items, every category stocked, sane prices', () => {
  assert(ITEMS.length >= 150, 'only ' + ITEMS.length + ' items');
  for (const c of CATEGORIES) assert(ITEMS.filter((i) => i.cat === c.key).length >= 20, c.key);
  for (const i of ITEMS) assert(i.price > 0.5 && i.price < 1e6 && i.emoji && i.name && i.desc, i.name);
  assert.equal(new Set(ITEMS.map((i) => i.name)).size, ITEMS.length, 'duplicate names');
});

test('Scoring: closeness, bust halving, bullseye, jackpot, shield', () => {
  const S = def.scoreGuess;
  let r = S(9, 10); assert.equal(r.pts, 900); assert(!r.bust && !r.bull);
  r = S(9.6, 10); assert.equal(r.pts, 960 + 500); assert(r.bull && !r.bust);
  r = S(11, 10); assert.equal(r.pts, 450); assert(r.bust && !r.bull);
  r = S(10.4, 10); assert.equal(r.pts, 480); assert(r.bust && !r.bull, 'over by 4% is a bust, not a bullseye');
  r = S(10.4, 10, { shield: true }); assert.equal(r.pts, 960 + 500); assert(!r.bust && r.bull);
  r = S(10, 10); assert.equal(r.pts, 1000 + 500 + 1000); assert(r.exact && r.bull);
  r = S(4.29, 4.29); assert(r.exact);
  r = S(0, 10); assert.equal(r.pts, 0);
  r = S(35, 10); assert.equal(r.pts, 0); assert(r.bust);
  assert(S(9, 10).math.length >= 1 && S(11, 10).math.some((m) => /Bust/.test(m.label)));
});

test('Price is hidden from the TV and phones until it drops', () => {
  const { room, clock } = setup(3, { rounds: 6 });
  const a = human(room, 'Ann'); room.start();
  const g = room.game;
  assert.equal(g.phase, 'guess'); assert.equal(g.kind, 'guess');
  assert(!leaks(room.tvState()), 'TV leaked the price'); assert(!leaks(room.playerState(a)), 'phone leaked the price');
  assert(g.sliderMax >= g.price * 2.5 && g.sliderMax <= g.price * 6);
  room.act(a, { op: 'lock', guess: g.price });
  stepUntil(room, clock, () => g.phase === 'reveal');
  assert.equal(g.dropped, false);
  assert(!leaks(room.tvState()) && !leaks(room.playerState(a)), 'leaked during the drumroll');
  assert(room.tvState().state.axis >= g.price, 'the price line must fit the price');
  stepUntil(room, clock, () => g.dropped);
  assert.equal(room.tvState().state.price, g.price); assert.equal(room.playerState(a).state.price, g.price);
});

test('Bad guesses and moves are rejected', () => {
  const { room } = setup(0, { rounds: 6 });
  const a = human(room, 'Ann'), b = human(room, 'Bo'); room.start();
  const g = room.game;
  for (const bad of [NaN, Infinity, -Infinity, -5, 'abc', '', null, undefined, {}, [], true, 1e12, g.sliderMax * 50])
    assert.equal(room.act(a, { op: 'lock', guess: bad }).ok, false, 'accepted ' + String(bad));
  assert.equal(room.act(a, { op: 'hilo', pick: 'higher' }).ok, false, 'hilo in a price round');
  assert.equal(room.act(a, { op: 'peek' }).ok, false, 'peek before half time');
  assert.equal(room.act(a, { op: 'nope' }).ok, false);
  assert.equal(room.act(a, { op: 'lock', guess: '12.345' }).ok, true, 'numeric strings are fine');
  assert.equal(g.guesses.get(a.id).guess, 12.35, 'rounded to cents');
  assert.equal(room.act(a, { op: 'lock', guess: 5 }).ok, false, 'locked twice');
  assert.equal(room.act(b, { op: 'lock', guess: 5, double: 'yes' }).ok, true);
  assert.equal(g.guesses.get(b.id).double, false, 'only a real true turns a power-up on');
});

test('Power-ups: Double Down ×2, Bust Shield, once per game; Peek after half time', () => {
  const { room, clock } = setup(0, { rounds: 10, seconds: 20 });
  const a = human(room, 'Ann'), b = human(room, 'Bo'); room.start();
  const g = room.game, price = g.price;
  // Ann doubles a 10% under guess; Bo shields a 4% over guess.
  assert(room.act(a, { op: 'lock', guess: price * 0.9, double: true }).ok);
  stepUntil(room, clock, () => room.game.room.now() - g.startedAt >= g.dur / 2);
  assert(room.act(b, { op: 'peek' }).ok);
  const pv = room.playerState(b).state.peek; assert.equal(pv.n, 1); assert(Math.abs(pv.avg - Math.round(price * 0.9 * 100) / 100) < 0.01);
  assert.equal(room.act(b, { op: 'peek' }).ok, false, 'peek twice');
  assert(room.act(b, { op: 'lock', guess: price * 1.04, shield: true }).ok);
  stepUntil(room, clock, () => g.dropped);
  const ra = g.scored.get(a.id), rb = g.scored.get(b.id);
  assert.equal(ra.pts, def.scoreGuess(g.guesses.get(a.id).guess, price).pts * 2);
  assert(!rb.bust && rb.bull, 'shield: no bust, still a bullseye');
  assert.equal(room.playerState(a).state.result.pts, ra.pts);
  stepUntil(room, clock, () => g.round === 2 && g.phase === 'guess');
  assert.equal(room.act(a, { op: 'lock', guess: 1, double: true }).ok, false, 'Double Down only once');
  assert.equal(room.act(b, { op: 'lock', guess: 1, shield: true }).ok, false, 'Bust Shield only once');
  stepUntil(room, clock, () => g.room.now() - g.startedAt >= g.dur / 2);
  assert.equal(room.act(b, { op: 'peek' }).ok, false, 'Peek only once');
});

test('Hot streak: three rounds within 15% in a row gives +300', () => {
  const { room, clock } = setup(0, { rounds: 10 });
  const a = human(room, 'Ann'); room.start();
  const g = room.game;
  for (let n = 1; n <= 3; n++) {
    stepUntil(room, clock, () => g.round === n && g.phase === 'guess');
    room.act(a, { op: 'lock', guess: g.price * 0.9 });
    stepUntil(room, clock, () => g.dropped);
    const r = g.scored.get(a.id);
    assert.equal(r.streak, n);
    assert.equal(r.pts, def.scoreGuess(g.guesses.get(a.id).guess, g.price).pts + (n >= 3 ? 300 : 0));
  }
});

test('Special rounds: every 4th is Higher or Lower (speed bonus), the last is a Shopping Spree total', () => {
  const { room, clock } = setup(2, { rounds: 6 });
  const a = human(room, 'Ann'); room.start();
  const g = room.game;
  stepUntil(room, clock, () => g.round === 4);
  assert.equal(g.kind, 'hilo'); assert.equal(g.phase, 'intro');
  assert(!leaks(room.tvState()) && g.hiloPrice !== g.price);
  assert.equal(room.act(a, { op: 'hilo', pick: 'up' }).ok, false, 'not open yet / bad pick');
  stepUntil(room, clock, () => g.phase === 'guess');
  assert.equal(room.act(a, { op: 'lock', guess: 5 }).ok, false, 'no price guesses in hilo');
  assert.equal(room.act(a, { op: 'hilo', pick: 'sideways' }).ok, false);
  assert(room.act(a, { op: 'hilo', pick: g.price > g.hiloPrice ? 'higher' : 'lower' }).ok);
  assert.equal(room.act(a, { op: 'hilo', pick: 'higher' }).ok, false, 'one answer only');
  stepUntil(room, clock, () => g.dropped);
  const r = g.scored.get(a.id); assert(r.right && r.pts === 1000, 'instant right answer = 500 + full 500 speed bonus');
  stepUntil(room, clock, () => g.round === 6);
  assert.equal(g.kind, 'spree'); assert.equal(g.items.length, 3);
  assert(Math.abs(g.price - g.items.reduce((s, i) => s + i.price, 0)) < 0.01);
  stepUntil(room, clock, () => g.phase === 'guess');
  assert(room.act(a, { op: 'lock', guess: g.price }).ok);
  stepUntil(room, clock, () => g.dropped);
  assert(g.scored.get(a.id).exact);
  runOut(room, clock);
  assert.equal(g.round, 6);
});

test('A full game with 1 player reaches the end with awards', () => {
  const { room, clock } = setup(0, { rounds: 10, category: 'groceries' });
  const a = human(room, 'Ann'); room.start();
  const g = room.game;
  while (g.phase !== 'over') {
    if (g.phase === 'guess' && !g.guesses.has(a.id)) room.act(a, g.kind === 'hilo' ? { op: 'hilo', pick: 'higher' } : { op: 'lock', guess: g.price * 0.97 });
    clock.step();
  }
  const tv = room.tvState().state, me = room.playerState(a).state;
  assert.equal(tv.phase, 'over'); assert.equal(tv.standings[0].name, 'Ann');
  assert(tv.awards.some((x) => x.title === 'Human Barcode') && tv.awards.some((x) => x.title === 'Bargain Hunter'));
  assert(me.final.length === 1 && me.awards.length >= 1);
});

test('100 players (bots use power-ups) play a 15-round game to the end', () => {
  const { room, clock } = setup(99, { rounds: 15, seconds: 20 });
  human(room, 'Ann'); room.start(); // Ann never answers: the timer still moves on
  const t0 = Date.now(); runOut(room, clock);
  const g = room.game, tv = room.tvState().state;
  assert.equal(g.round, 15); assert.equal(tv.standings.length, 12);
  assert([...g.used.values()].some((u) => u.has('double')) && [...g.used.values()].some((u) => u.has('shield')));
  assert.equal(tv.awards.length >= 3, true);
  assert(JSON.stringify(tv).length < 200000);
  assert(Date.now() - t0 < 5000, 'too slow');
});

test('Skip ahead (TV) steps through every phase to the end', () => {
  const { room } = setup(4, { rounds: 6 });
  human(room, 'Ann'); room.start();
  const seen = new Set();
  for (let i = 0; i < 100 && room.game.phase !== 'over'; i++) { seen.add(room.game.phase); assert(room.hostAction({ type: 'next' }).ok); }
  assert.equal(room.game.phase, 'over');
  for (const ph of ['guess', 'reveal', 'intro']) assert(seen.has(ph), 'never saw ' + ph);
});

test('Everyone locked in ends the round early; a player leaving never stalls it', () => {
  const { room, clock } = setup(0, { rounds: 6, seconds: 45 });
  const a = human(room, 'Ann'), b = human(room, 'Bo'); room.start();
  const g = room.game;
  room.act(a, { op: 'lock', guess: 3 });
  room.remove(b.id); // Bo leaves without guessing: Ann is the only one left and she's in
  const t = clock.now(); stepUntil(room, clock, () => g.phase === 'reveal');
  assert(clock.now() - t < 2000, 'should end early');
  // A late joiner can play the next round.
  const c = human(room, 'Cy'); stepUntil(room, clock, () => g.round === 2 && g.phase === 'guess');
  assert(room.act(c, { op: 'lock', guess: 7 }).ok);
});

test('Back to the lobby and start again: a fresh game', () => {
  const { room, clock } = setup(3, { rounds: 6 });
  const a = human(room, 'Ann'); room.start(); runOut(room, clock);
  assert(room.vipAction(a, 'lobby').ok); assert(room.start().ok); // (room 'again' needs the lobby reset: see report)
  assert.equal(room.game.round, 1); assert.equal(room.game.phase, 'guess');
  assert.equal(room.game.scores.get(a.id), 0);
});


test('Which Costs More: two different-priced items, tap the pricier one, hidden until the drop', () => {
  const { room, clock } = setup(3, { rounds: 10 });
  const a = human(room, 'Ann'), b = human(room, 'Bo'); room.start();
  const g = room.game;
  stepUntil(room, clock, () => g.round === 6);
  assert.equal(g.kind, 'versus'); assert.equal(g.items.length, 2);
  assert.notEqual(g.items[0].price, g.items[1].price);
  assert(!leaks(room.tvState()) && !leaks(room.playerState(a)), 'versus leaked a price');
  stepUntil(room, clock, () => g.phase === 'guess');
  assert.equal(room.act(a, { op: 'lock', guess: 5 }).ok, false, 'no typed guesses in versus');
  assert.equal(room.act(a, { op: 'versus', pick: '0' }).ok, false, 'pick must be 0 or 1');
  assert.equal(room.act(a, { op: 'versus', pick: 7 }).ok, false);
  assert(room.act(a, { op: 'versus', pick: g.pricier }).ok);
  assert(room.act(b, { op: 'versus', pick: 1 - g.pricier }).ok);
  assert.equal(room.act(a, { op: 'versus', pick: 0 }).ok, false, 'one answer only');
  stepUntil(room, clock, () => g.dropped);
  assert(g.scored.get(a.id).right && g.scored.get(a.id).pts > 500);
  assert.equal(g.scored.get(b.id).pts, 0);
  assert.equal(room.playerState(a).state.result.place, 1);
  assert(room.tvState().state.items.every((i) => i.price > 0), 'prices shown after the drop');
});

test('Final round counts double; results() lists players best-first at the end', () => {
  const { room, clock } = setup(0, { rounds: 6 });
  const a = human(room, 'Ann'), b = human(room, 'Bo'); room.start();
  const g = room.game;
  assert.deepEqual(g.results(), [], 'no results before the end');
  stepUntil(room, clock, () => g.round === 6 && g.phase === 'guess');
  assert.equal(room.playerState(a).state.final, true);
  room.act(a, { op: 'lock', guess: g.price * 0.9 });
  stepUntil(room, clock, () => g.dropped);
  const r = g.scored.get(a.id);
  assert.equal(r.pts, def.scoreGuess(g.guesses.get(a.id).guess, g.price).pts * 2);
  assert(r.math.some((m) => /Final/.test(m.label)));
  runOut(room, clock);
  const order = g.results();
  assert.deepEqual(order.slice().sort(), [a.id, b.id].sort());
  assert.equal(order[0], a.id, 'Ann scored, Bo did not');
});

console.log(`\nPrice Panic: ${passed} tests passed.`);
