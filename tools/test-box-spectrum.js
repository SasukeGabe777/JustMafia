'use strict';
// Where Do You Stand?: validation, secrecy before the reveal, average / nearest-neighbour scoring,
// Read-a-Friend bonus rounds (scoring + spotlight rotation), twins and opposites, shy mode,
// the skip path, players leaving, and full games with 3 and 100 players.
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/spectrum');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function setup({ bots = 0, humans = [], settings = {}, seed = 7 } = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  room.addBots(bots); Object.assign(room.settings, settings);
  const H = humans.map((n) => room.join(n).player);
  return { clock, room, H };
}
const g = (room) => room.game;
function runOut(room, clock, limit = 2000000) { let i = 0; while (g(room).phase !== 'over' && clock.step()) if (++i > limit) throw new Error('never ended: ' + g(room).phase); return i; }
function until(room, clock, phase, n) { let i = 0; while (!(g(room).phase === phase && (n == null || g(room).n === n))) { if (!clock.step() || ++i > 200000) throw new Error(`never reached ${phase} ${n || ''} (at ${g(room).phase} ${g(room).n})`); } }
const act = (room, p, m) => room.act(p, m);
const ok = (r) => assert.equal(r.ok, true, r.error);
const bad = (r, re) => { assert.equal(r.ok, false); if (re) assert.match(r.error, re); };
const json = (x) => JSON.stringify(x);
const pts = (room, p) => g(room).scores.get(p.id);

test('Settings and content: every field has options, defaults are valid, 40+ original spectrums per pack', () => {
  for (const f of def.fields) { assert(Array.isArray(f.options) && f.options.length, f.key); assert(f.options.some((o) => o.value === def.defaults[f.key]), f.key); }
  const all = new Set();
  for (const [k, p] of Object.entries(def._test.PACKS)) {
    assert(p.list.length >= 40, k + ' has ' + p.list.length);
    for (const s of p.list) { assert(s.length >= 4 && s[1] && s[2] && s[0] && s[3], json(s)); const key = s[1] + '|' + s[2]; assert(!all.has(key), 'duplicate ' + key); all.add(key); }
  }
  assert.equal(def._test.isRead(3), true); assert.equal(def._test.isRead(4), false);
});

test('Validation: positions must be finite numbers 0–100; unknown ops, wrong phase and late joiners are refused', () => {
  const { room, clock, H: [a, b] } = setup({ humans: ['Ann', 'Bo', 'Cy'] });
  ok(room.start());
  assert.equal(g(room).phase, 'intro');
  bad(act(room, a, { op: 'place', pos: 50 }), /isn’t open/);
  until(room, clock, 'place', 1);
  for (const pos of [-1, 101, NaN, Infinity, '50', null, undefined, { x: 1 }, [50]]) bad(act(room, a, { op: 'place', pos }), /marker/);
  bad(act(room, a, { op: 'dance', pos: 5 }), /Unknown/);
  bad(act(room, a, { op: 'guess', pos: 5 }), /Guessing/);
  const late = room.join('Dee').player;
  bad(act(room, late, { op: 'place', pos: 10 }), /next round/);
  ok(act(room, a, { op: 'place', pos: 33.7 }));
  assert.equal(g(room).r.pos.get(a.id), 34); // rounded
  ok(act(room, a, { op: 'place', pos: 0 })); // can change your mind
  ok(act(room, b, { op: 'place', pos: 100 }));
  assert.equal(g(room).r.pos.get(a.id), 0);
  g(room).next(); until(room, clock, 'place', 2);
  ok(act(room, late, { op: 'place', pos: 10 })); // in from round 2
});

test('Secrecy: no positions reach the TV or other phones before the reveal', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ann', 'Bo', 'Cy'], bots: 4 });
  room.start(); until(room, clock, 'place', 1);
  ok(act(room, a, { op: 'place', pos: 87 })); ok(act(room, b, { op: 'place', pos: 13 }));
  const tv = room.tvState().state;
  assert.equal(tv.result, null); assert.equal(tv.locked >= 2, true);
  assert(!json(tv).includes('87') && !json(tv).includes('"pos"'), 'TV leaks a position');
  const vc = room.playerState(c).state;
  assert.equal(vc.myPos, null); assert(!json(vc).includes('87'), 'phone leaks a position');
  assert.equal(room.playerState(a).state.myPos, 87);
  // bonus round: the spotlight's spot stays secret during guessing
  until(room, clock, 'spot', 3);
  const spot = room.get(g(room).r.spot);
  assert(!spot.bot, 'humans get the spotlight first');
  ok(act(room, spot, { op: 'place', pos: 71 }));
  until(room, clock, 'guess', 3);
  const tv3 = room.tvState().state, other = [a, b, c].find((p) => p.id !== spot.id);
  assert.equal(tv3.result, null); assert(!json(tv3).includes('71'));
  assert.equal(room.playerState(other).state.myPos, null); assert(!json(room.playerState(other).state).includes('71'));
  assert.equal(room.playerState(spot).state.myPos, 71);
});

test('Scoring: +50 within 10 of the room average, +25 each for the nearest-neighbour pair', () => {
  const { room, clock, H: [a, b, c, d] } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee'] });
  room.start(); until(room, clock, 'place', 1);
  // avg = (10 + 40 + 44 + 90) / 4 = 46
  ok(act(room, a, { op: 'place', pos: 10 })); ok(act(room, b, { op: 'place', pos: 40 }));
  ok(act(room, c, { op: 'place', pos: 44 })); ok(act(room, d, { op: 'place', pos: 90 }));
  until(room, clock, 'reveal', 1); // everyone locked in: it closed early
  assert(clock.now() < 3500 + 20000, 'closed early');
  assert.equal(pts(room, a), 0); assert.equal(pts(room, b), 75); assert.equal(pts(room, c), 75); assert.equal(pts(room, d), 0);
  const res = room.tvState().state.result;
  assert.equal(res.avg, 46); assert.equal(res.nearAvg, 2); assert.equal(res.dots.length, 4);
  assert.deepEqual([res.pair.a, res.pair.b], ['Bo', 'Cy']); assert.equal(res.pair.gap, 4);
  assert.equal(res.lo.name, 'Ann'); assert.equal(res.hi.name, 'Dee');
  const vb = room.playerState(b).state.result;
  assert.equal(vb.gained, 75); assert.equal(vb.nearAvg, true); assert.equal(vb.neighbour.name, 'Cy'); assert.equal(vb.closest.name, 'Cy');
  assert.equal(room.playerState(a).state.result.gained, 0);
});

test('Clusters: a crowd at one end is called out with that end’s label', () => {
  const { room, clock, H } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee', 'Eve', 'Fay'] });
  room.start(); until(room, clock, 'place', 1);
  [90, 92, 95, 97, 10, 40].forEach((x, i) => ok(act(room, H[i], { op: 'place', pos: x })));
  until(room, clock, 'reveal', 1);
  const res = room.tvState().state.result;
  assert.equal(res.cluster.count, 4); assert.equal(res.cluster.side, g(room).r.spec.r);
});

test('Nobody places: no crash, no points, the game moves on', () => {
  const { room, clock, H } = setup({ humans: ['Ann', 'Bo', 'Cy'] });
  room.start(); until(room, clock, 'reveal', 1);
  const res = room.tvState().state.result;
  assert.equal(res.count, 0); assert.equal(res.avg, null);
  for (const p of H) assert.equal(pts(room, p), 0);
  until(room, clock, 'intro', 2);
});

test('Read a Friend (every 3rd round): spotlight places first, closest guesses score 300/200/100, +150 bullseye, +50 per reader', () => {
  const { room, clock, H } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee', 'Eve'] });
  room.start(); until(room, clock, 'intro', 3);
  assert.equal(g(room).r.kind, 'read');
  assert.equal(room.tvState().state.spot.name, room.name(g(room).r.spot));
  until(room, clock, 'spot', 3);
  const spot = room.get(g(room).r.spot), [w, x, y, z] = H.filter((p) => p.id !== spot.id);
  bad(act(room, w, { op: 'place', pos: 10 }), /spotlight/);
  bad(act(room, w, { op: 'guess', pos: 10 }), /Guessing/);
  ok(act(room, spot, { op: 'place', pos: 60 }));
  until(room, clock, 'guess', 3);
  bad(act(room, spot, { op: 'guess', pos: 60 }), /spotlight/);
  bad(act(room, w, { op: 'place', pos: 60 }), /isn’t open/);
  const before = new Map(H.map((p) => [p.id, pts(room, p)]));
  ok(act(room, w, { op: 'guess', pos: 62 })); // err 2: 1st + bullseye
  ok(act(room, x, { op: 'guess', pos: 50 })); // err 10: 2nd
  ok(act(room, y, { op: 'guess', pos: 74 })); // err 14: 3rd
  ok(act(room, z, { op: 'guess', pos: 0 })); // err 60
  until(room, clock, 'reveal', 3);
  const d = (p) => pts(room, p) - before.get(p.id);
  assert.equal(d(w), 300 + 150); assert.equal(d(x), 200); assert.equal(d(y), 100); assert.equal(d(z), 0);
  assert.equal(d(spot), 3 * 50); // three people read them within 15
  const res = room.tvState().state.result;
  assert.equal(res.kind, 'read'); assert.equal(res.target, 60); assert.equal(res.readers, 3); assert.equal(res.guesses.length, 4);
  assert.equal(res.top[0].name, room.name(w.id)); assert.equal(res.top[0].bull, true);
  const vw = room.playerState(w).state.result; assert.equal(vw.rank, 1); assert.equal(vw.bull, true); assert.equal(vw.gained, 450);
  assert.equal(room.playerState(spot).state.result.isSpot, true);
  // only the spotlight's answer counts as a "stand" this round
  assert.equal(g(room).answers.get(spot.id).get(3), 60); assert.equal(g(room).answers.get(w.id).has(3), false);
});

test('Read a Friend: tied guesses share the higher prize', () => {
  const { room, clock, H } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee'] });
  room.start(); until(room, clock, 'spot', 3);
  const spot = room.get(g(room).r.spot), [x, y, z] = H.filter((p) => p.id !== spot.id);
  ok(act(room, spot, { op: 'place', pos: 50 })); until(room, clock, 'guess', 3);
  const b = new Map(H.map((p) => [p.id, pts(room, p)]));
  ok(act(room, x, { op: 'guess', pos: 40 })); ok(act(room, y, { op: 'guess', pos: 60 })); ok(act(room, z, { op: 'guess', pos: 80 }));
  until(room, clock, 'reveal', 3);
  assert.equal(pts(room, x) - b.get(x.id), 300); assert.equal(pts(room, y) - b.get(y.id), 300); assert.equal(pts(room, z) - b.get(z.id), 100);
});

test('Read a Friend: a spotlight who never locks in turns it into a normal round for everyone', () => {
  const { room, clock, H } = setup({ humans: ['Ann', 'Bo', 'Cy'] });
  room.start(); until(room, clock, 'spot', 3);
  until(room, clock, 'place', 3);
  assert.equal(g(room).r.kind, 'normal'); assert.equal(g(room).r.dozed, true);
  for (const p of H) ok(act(room, p, { op: 'place', pos: 50 }));
  until(room, clock, 'reveal', 3);
  assert.equal(room.tvState().state.result.dozed, true);
});

test('Spotlight rotation: humans first, nobody twice until everyone has had a turn', () => {
  const { room, clock } = setup({ humans: ['Ann', 'Bo'], bots: 3, settings: { rounds: 16 }, seed: 9 });
  room.start();
  const order = [];
  for (const n of [3, 6, 9, 12, 15]) { until(room, clock, 'spot', n); order.push(g(room).r.spot); }
  const humans = room.list().filter((p) => !p.bot).map((p) => p.id);
  assert.deepEqual(order.slice(0, 2).sort(), humans.slice().sort(), 'the two humans go first');
  assert.equal(new Set(order).size, 5, 'all five players had a turn before anyone repeated: ' + order);
});

test('Twins and opposites: computed from every round both answered; mutual pairs, the most alike pair, most unique', () => {
  const { room, clock, H: [a, b, c, d] } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee'], settings: { rounds: 8 } });
  room.start();
  const plan = { [a.id]: (n) => 10 + n, [b.id]: (n) => 12 + n, [c.id]: (n) => 60, [d.id]: (n) => 95 };
  for (let n = 1; n <= 8; n++) {
    if (n % 3 === 0) { until(room, clock, 'spot', n); const s = room.get(g(room).r.spot); ok(act(room, s, { op: 'place', pos: plan[s.id](n) })); until(room, clock, 'guess', n); g(room).next(); continue; }
    until(room, clock, 'place', n);
    for (const p of [a, b, c, d]) ok(act(room, p, { op: 'place', pos: plan[p.id](n) }));
  }
  runOut(room, clock);
  const tv = room.tvState().state;
  assert.equal(tv.phase, 'over');
  const f = tv.final;
  assert.deepEqual([f.pairs[0].a.name, f.pairs[0].b.name].sort(), ['Ann', 'Bo']);
  assert.equal(f.pairs[0].pct, 98); assert.equal(f.pairs[0].mutual, true);
  assert.equal(f.unique.name, 'Dee');
  const va = room.playerState(a).state.final;
  assert.equal(va.twin.name, 'Bo'); assert.equal(va.twin.pct, 98); assert.equal(va.opp.name, 'Dee');
  assert(va.opp.about && va.opp.about.l && typeof va.opp.about.me === 'number', 'a conversation starter spectrum');
  assert(va.awards.some((x) => x.title === 'Most Alike Pair'));
  assert.equal(room.playerState(d).state.final.twin.name, 'Cy');
  assert.equal(room.playerState(c).state.final.opp.name, 'Ann'); // Cy: 60 vs Ann ~15 (45) or Dee 95 (35)
  assert(room.playerState(d).state.final.awards.some((x) => x.title === 'Most Unique'));
});

test('Shy mode (names off): dots carry no names on the TV, the spotlight is still named', () => {
  const { room, clock, H } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee'], settings: { names: 'off' } });
  room.start(); until(room, clock, 'place', 1);
  H.forEach((p, i) => ok(act(room, p, { op: 'place', pos: 10 + i * 30 })));
  until(room, clock, 'reveal', 1);
  const res = room.tvState().state.result;
  assert.equal(room.tvState().state.names, false);
  for (const d of res.dots) assert.equal(d.name, null);
  assert.equal(res.lo.name, null); assert.equal(res.pair.a, null);
  assert(!H.some((p) => json(res).includes(p.name)), 'no names in the shy-mode reveal');
  until(room, clock, 'spot', 3);
  ok(act(room, room.get(g(room).r.spot), { op: 'place', pos: 30 }));
  until(room, clock, 'guess', 3);
  assert.equal(room.tvState().state.spot.name, room.name(g(room).r.spot));
  for (const p of H) if (p.id !== g(room).r.spot) act(room, p, { op: 'guess', pos: 50 });
  until(room, clock, 'reveal', 3);
  for (const d of room.tvState().state.result.guesses) assert.equal(d.name, null);
  for (const d of room.tvState().state.result.top) assert.equal(d.name, null);
});

test('Skip ahead: next() walks every phase to the end; harmless afterwards', () => {
  const { room, H: [a] } = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { rounds: 8 } });
  room.start();
  const seen = [];
  for (let i = 0; i < 80 && g(room).phase !== 'over'; i++) { seen.push(g(room).phase + g(room).n); room.hostAction({ type: 'next' }); }
  assert.equal(g(room).phase, 'over'); assert.equal(g(room).n, 8);
  assert.deepEqual(seen.slice(0, 4), ['intro1', 'place1', 'reveal1', 'intro2']);
  assert(seen.includes('spot3'), 'the bonus round was walked through');
  bad(act(room, a, { op: 'place', pos: 5 }), /over/);
  room.hostAction({ type: 'next' }); assert.equal(g(room).phase, 'over');
  assert(room.tvState().state.final);
});

test('A player leaving: placing finishes without them; a spotlight leaving mid-placement keeps the round going', () => {
  const { room, clock, H: [a, b, c, d] } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee'] });
  room.start(); until(room, clock, 'place', 1);
  ok(act(room, a, { op: 'place', pos: 20 })); ok(act(room, b, { op: 'place', pos: 30 })); ok(act(room, c, { op: 'place', pos: 40 }));
  const t = clock.now();
  room.remove(d.id); // the only one we were waiting for
  until(room, clock, 'reveal', 1);
  assert(clock.now() - t < 2000, 'closed right after the leaver');
  assert.equal(room.tvState().state.result.count, 3);
  until(room, clock, 'spot', 3);
  const spot = room.get(g(room).r.spot);
  room.remove(spot.id);
  assert.equal(g(room).phase, 'place'); assert.equal(g(room).r.kind, 'normal');
  for (const p of [a, b, c]) if (room.get(p.id)) ok(act(room, p, { op: 'place', pos: 50 }));
  until(room, clock, 'reveal', 3);
  runOut(room, clock);
  assert.equal(g(room).phase, 'over');
});

test('A spotlight leaving during guessing: the reveal still works', () => {
  const { room, clock, H } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee'] });
  room.start(); until(room, clock, 'spot', 3);
  const spot = room.get(g(room).r.spot); ok(act(room, spot, { op: 'place', pos: 40 }));
  until(room, clock, 'guess', 3);
  const others = H.filter((p) => p.id !== spot.id);
  ok(act(room, others[0], { op: 'guess', pos: 42 }));
  room.remove(spot.id);
  g(room).next();
  assert.equal(g(room).phase, 'reveal');
  const res = room.tvState().state.result;
  assert.equal(res.target, 40); assert.equal(room.tvState().state.spot.name, spot.name);
});

for (const [n, rounds, names] of [[3, 8, 'on'], [12, 12, 'off'], [100, 16, 'on']]) {
  test(`Full game with ${n} bots, ${rounds} rounds (names ${names}) reaches ‘over’ with twins and awards`, () => {
    const { room, clock } = setup({ bots: n, settings: { rounds, names, pack: n === 100 ? 'mix' : 'icebreaker' }, seed: 11 + n });
    room.start();
    const t0 = Date.now(); runOut(room, clock);
    const s = room.tvState().state;
    assert.equal(s.phase, 'over'); assert.equal(g(room).n, rounds);
    const f = s.final;
    assert(f.pairs.length >= 1 && f.pairs[0].pct > 0 && f.pairs[0].pct <= 100);
    assert(f.pairs.length <= 24); assert(f.unique && f.mind && f.book, 'awards: ' + json({ u: !!f.unique, m: !!f.mind, b: !!f.book }));
    assert(s.standings[0].points > 0);
    for (const p of room.list()) { const v = room.playerState(p).state.final; assert(v && v.twin && v.opp, p.name + ' has a twin and an opposite'); assert.notEqual(v.twin.name, p.name); }
    if (n === 100) {
      const size = json(room.tvState()).length;
      assert(size < 60000, 'tv state ' + size);
      console.log(`    (100 players: ${Date.now() - t0} ms, final tv state ${size} bytes, top twins ${f.pairs[0].pct}%)`);
    }
  });
}

test('Bot personalities make twins meaningful: the best pairs are far more alike than random', () => {
  const { room, clock } = setup({ bots: 20, settings: { rounds: 16 }, seed: 4 });
  room.start(); runOut(room, clock);
  const f = room.tvState().state.final;
  assert(f.pairs[0].pct >= 80, 'top twins ' + f.pairs[0].pct);
  const opp = room.list().map((p) => room.playerState(p).state.final.opp.pct);
  assert(Math.min(...opp) < 60, 'some real opposites: ' + Math.min(...opp));
});

test('100 players mid-game: reveal sends every dot; waiting list is hidden on the TV', () => {
  const { room, clock, H: [a] } = setup({ bots: 99, humans: ['Ann'], seed: 5 });
  room.start(); until(room, clock, 'place', 1);
  assert.equal(room.tvState().state.waiting, null);
  ok(act(room, a, { op: 'place', pos: 50 }));
  until(room, clock, 'reveal', 1);
  const res = room.tvState().state.result;
  assert.equal(res.dots.length, 100);
  assert(json(room.tvState()).length < 30000);
});

console.log(`\n${passed} Where Do You Stand? tests passed.`);
