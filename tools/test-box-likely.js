'use strict';
// Most Likely To…: vote validation, scoring (match + prediction), ties, Hot Seat and Double
// Trouble rounds, anonymity on the TV, full games with 3 and 100 players, and the skip path.
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/likely');

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
// Advance timers until the game reaches the wanted phase (and round, if given).
function until(room, clock, phase, n) { let i = 0; while (!(g(room).phase === phase && (n == null || g(room).n === n))) { if (!clock.step() || ++i > 200000) throw new Error(`never reached ${phase} ${n || ''} (at ${g(room).phase} ${g(room).n})`); } }
const act = (room, p, m) => room.act(p, m);
const ok = (r) => assert.equal(r.ok, true, r.error);
const bad = (r, re) => { assert.equal(r.ok, false); if (re) assert.match(r.error, re); };
const json = (x) => JSON.stringify(x);

test('Settings: every field has options and the defaults are valid options', () => {
  for (const f of def.fields) { assert(Array.isArray(f.options) && f.options.length); assert(f.options.some((o) => o.value === def.defaults[f.key]), f.key); }
  for (const [k, p] of Object.entries(def._test.PACKS)) { assert(p.classic.length + p.pair.length + p.hot.length >= 60, k); assert(p.classic.length >= 60, k); }
  assert.equal(def._test.kindOf(5), 'hot'); assert.equal(def._test.kindOf(3), 'pair'); assert.equal(def._test.kindOf(1), 'classic');
});

test('Votes: no self-vote when off, only real players in this round, valid ops only, nothing before voting opens', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ann', 'Bo', 'Cy'] });
  ok(room.start());
  assert.equal(g(room).phase, 'intro');
  bad(act(room, a, { op: 'vote', id: b.id }), /isn’t open/);
  until(room, clock, 'vote', 1);
  bad(act(room, a, { op: 'vote', id: a.id }), /yourself/);
  bad(act(room, a, { op: 'vote', id: 'p999' }), /playing/);
  bad(act(room, a, { op: 'vote', id: { x: 1 } }), /playing/);
  bad(act(room, a, { op: 'dance' }), /Unknown/);
  // a late joiner can't vote and can't be voted for until the next prompt
  const late = room.join('Dee').player;
  bad(act(room, late, { op: 'vote', id: b.id }), /next prompt/);
  bad(act(room, a, { op: 'vote', id: late.id }), /playing/);
  ok(act(room, a, { op: 'vote', id: b.id }));
  ok(act(room, a, { op: 'vote', id: c.id })); // can change your mind
  assert.equal(g(room).r.votes.get(a.id), c.id);
  ok(act(room, a, { op: 'predict', id: a.id })); // predicting yourself is fine
  // the late joiner is in from round 2
  g(room).next(); g(room).next(); g(room).next(); until(room, clock, 'vote', 2);
  ok(act(room, late, { op: 'vote', id: a.id })); ok(act(room, a, { op: 'vote', id: late.id }));
});

test('Votes: self-votes allowed when the setting is on', () => {
  const { room, clock, H: [a] } = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { selfVote: true } });
  room.start(); until(room, clock, 'vote', 1);
  ok(act(room, a, { op: 'vote', id: a.id }));
});

test('Scoring: +100 for matching the room, +150 for a correct prediction; the winner gets the title (not points)', () => {
  const { room, clock, H: [a, b, c, d] } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee'] });
  room.start(); until(room, clock, 'vote', 1);
  ok(act(room, a, { op: 'vote', id: b.id })); ok(act(room, a, { op: 'predict', id: b.id }));
  ok(act(room, c, { op: 'vote', id: b.id })); ok(act(room, c, { op: 'predict', id: d.id }));
  ok(act(room, d, { op: 'vote', id: b.id })); ok(act(room, d, { op: 'skip' }));
  ok(act(room, b, { op: 'vote', id: a.id })); ok(act(room, b, { op: 'predict', id: b.id }));
  until(room, clock, 'reveal', 1); // everyone was in: it closed early
  const sc = g(room).scores;
  assert.equal(sc.get(a.id), 250); assert.equal(sc.get(c.id), 100); assert.equal(sc.get(d.id), 100); assert.equal(sc.get(b.id), 150);
  assert.equal(g(room).titles.get(b.id).length, 1); assert.match(g(room).titles.get(b.id)[0], /^Most likely to /);
  const tv = room.tvState().state;
  assert.deepEqual(tv.result.winners.map((w) => w.name), ['Bo']);
  assert.equal(tv.result.top[0].votes, 3);
  const va = room.playerState(a).state;
  assert.equal(va.mine.gained, 250); assert.equal(va.mine.matched, true); assert.equal(va.mine.foresaw, true);
  assert.equal(room.playerState(b).state.mine.won, true);
});

test('Ties: everyone tied for first shares the title, and votes for any of them match', () => {
  const { room, clock, H: [a, b, c, d] } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee'] });
  room.start(); until(room, clock, 'vote', 1);
  ok(act(room, a, { op: 'vote', id: b.id })); ok(act(room, b, { op: 'vote', id: a.id }));
  ok(act(room, c, { op: 'vote', id: d.id })); ok(act(room, d, { op: 'vote', id: c.id }));
  ok(act(room, a, { op: 'predict', id: c.id }));
  g(room).next(); until(room, clock, 'reveal', 1);
  const res = room.tvState().state.result;
  assert.equal(res.winners.length, 4);
  for (const p of [a, b, c, d]) assert.equal(g(room).titles.get(p.id).length, 1);
  assert.equal(g(room).scores.get(a.id), 250);
});

test('Nobody votes: no winner, no crash, the game moves on', () => {
  const { room, clock } = setup({ humans: ['Ann', 'Bo', 'Cy'] });
  room.start(); until(room, clock, 'reveal', 1);
  assert.equal(room.tvState().state.result.winners.length, 0);
  until(room, clock, 'intro', 2);
});

test('Double Trouble (round 3): pick two different people; the top two share the title', () => {
  const { room, clock, H: [a, b, c, d] } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee'] });
  room.start(); until(room, clock, 'vote', 3);
  assert.equal(g(room).r.kind, 'pair');
  bad(act(room, a, { op: 'vote', id: b.id }), /two different/);
  bad(act(room, a, { op: 'vote', ids: [b.id, b.id] }), /two different/);
  bad(act(room, a, { op: 'vote', ids: [a.id, b.id] }), /yourself/);
  bad(act(room, a, { op: 'vote', ids: [b.id, 'nope'] }), /playing/);
  ok(act(room, a, { op: 'vote', ids: [b.id, c.id] }));
  ok(act(room, b, { op: 'vote', ids: [c.id, d.id] }));
  ok(act(room, c, { op: 'vote', ids: [b.id, d.id] }));
  ok(act(room, d, { op: 'vote', ids: [b.id, c.id] }));
  ok(act(room, a, { op: 'predict', id: b.id }));
  const before = g(room).scores.get(a.id), beforeB = g(room).scores.get(b.id), beforeD = g(room).scores.get(d.id);
  g(room).next(); until(room, clock, 'reveal', 3);
  const res = room.tvState().state.result;
  assert.equal(res.kind, 'pair');
  assert.deepEqual(res.winners.map((w) => w.name).sort(), ['Bo', 'Cy']); // b:3, c:3, d:2
  assert.equal(g(room).scores.get(a.id) - before, 100 + 150); // both picks matched + prediction
  assert.equal(g(room).scores.get(b.id) - beforeB, 50); // one of two
  assert.equal(g(room).scores.get(d.id) - beforeD, 100);
  assert.match(g(room).titles.get(b.id).slice(-1)[0], /with Cy/);
});

test('Hot Seat (round 5): yes/no; majority scores; others predict the seat’s answer; the seat predicts the room', () => {
  const { room, clock, H } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee', 'Eve'] });
  room.start(); until(room, clock, 'vote', 5);
  const r = g(room).r; assert.equal(r.kind, 'hot'); assert(r.seat);
  const seat = room.get(r.seat), others = H.filter((p) => p.id !== seat.id);
  bad(act(room, others[0], { op: 'vote', id: seat.id }), /YES or NO/);
  bad(act(room, others[0], { op: 'vote', yes: 'yes' }), /YES or NO/);
  ok(act(room, seat, { op: 'vote', yes: true })); ok(act(room, seat, { op: 'predict', yes: true }));
  ok(act(room, others[0], { op: 'vote', yes: true })); ok(act(room, others[0], { op: 'predict', yes: true }));
  ok(act(room, others[1], { op: 'vote', yes: true })); ok(act(room, others[1], { op: 'predict', yes: false }));
  ok(act(room, others[2], { op: 'vote', yes: true }));
  ok(act(room, others[3], { op: 'vote', yes: false }));
  const before = new Map(H.map((p) => [p.id, g(room).scores.get(p.id)]));
  const titles = g(room).titles.get(seat.id).length;
  g(room).next(); until(room, clock, 'reveal', 5);
  const d = (p) => g(room).scores.get(p.id) - before.get(p.id);
  assert.equal(d(seat), 100 + 150); // self-aware + read the room
  assert.equal(d(others[0]), 100 + 150); assert.equal(d(others[1]), 100); assert.equal(d(others[2]), 100); assert.equal(d(others[3]), 0);
  assert.equal(g(room).titles.get(seat.id).length, titles + 1);
  const res = room.tvState().state.result;
  assert.equal(res.yes, 3); assert.equal(res.no, 1); assert.equal(res.verdict, true); assert.equal(res.seatSaid, true);
  assert.equal(res.yesBy, undefined, 'anonymous: no names');
});

test('Hot Seat: a split room scores no majority points and gives no title', () => {
  const { room, clock, H } = setup({ humans: ['Ann', 'Bo', 'Cy'] });
  room.start(); until(room, clock, 'vote', 5);
  const seat = room.get(g(room).r.seat), [x, y] = H.filter((p) => p.id !== seat.id);
  const t = g(room).titles.get(seat.id).length, sx = g(room).scores.get(x.id);
  ok(act(room, x, { op: 'vote', yes: true })); ok(act(room, y, { op: 'vote', yes: false }));
  g(room).next(); until(room, clock, 'reveal', 5);
  assert.equal(room.tvState().state.result.verdict, null);
  assert.equal(g(room).scores.get(x.id), sx); assert.equal(g(room).titles.get(seat.id).length, t);
});

test('Anonymity: the TV never shows who voted for whom (and never tallies before the reveal)', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ann', 'Bo', 'Cy'], bots: 5 });
  room.start(); until(room, clock, 'vote', 1);
  ok(act(room, a, { op: 'vote', id: b.id })); ok(act(room, c, { op: 'vote', id: b.id }));
  const during = room.tvState().state;
  assert.equal(during.result, null); assert.equal(during.voted >= 2, true);
  assert(!json(during).includes('"votes"') && !json(during).includes('voters'));
  // phones never see other people’s picks either
  const vb = room.playerState(b).state;
  assert.equal(vb.myVote, null); assert.equal(vb.result, null); assert(!json(vb).includes('voters') && !json(vb).includes('"votes"'), 'b can’t see a’s vote');
  until(room, clock, 'reveal', 1);
  const after = room.tvState().state;
  assert(after.result.top.length);
  for (const t of after.result.top) assert.equal(t.voters, undefined);
  assert(!json(after).includes('voters'));
  until(room, clock, 'reveal', 5);
  const hot = room.tvState().state.result; assert.equal(hot.yesBy, undefined); assert.equal(hot.noBy, undefined);
});

test('Public reveal: the TV shows who voted for whom', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { reveal: 'public' } });
  room.start(); until(room, clock, 'vote', 1);
  ok(act(room, a, { op: 'vote', id: b.id })); ok(act(room, c, { op: 'vote', id: b.id }));
  assert.equal(room.tvState().state.result, null);
  g(room).next(); until(room, clock, 'reveal', 1);
  assert.deepEqual(room.tvState().state.result.top[0].voters.sort(), ['Ann', 'Cy']);
});

test('Skip ahead: next() walks intro → vote → drum → reveal → next prompt, and to the end', () => {
  const { room, H: [a] } = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { rounds: 10 } });
  room.start();
  const seen = [];
  for (let i = 0; i < 80 && g(room).phase !== 'over'; i++) { seen.push(g(room).phase); room.hostAction({ type: 'next' }); }
  assert.equal(g(room).phase, 'over'); assert.equal(g(room).n, 10);
  assert.deepEqual(seen.slice(0, 5), ['intro', 'vote', 'drum', 'reveal', 'intro']);
  bad(act(room, a, { op: 'vote', id: a.id }));
  room.hostAction({ type: 'next' }); assert.equal(g(room).phase, 'over'); // harmless after the end
});

test('A player leaving mid-vote: their vote is dropped and votes for them don’t count', () => {
  const { room, clock, H: [a, b, c, d] } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Dee'] });
  room.start(); until(room, clock, 'vote', 1);
  ok(act(room, a, { op: 'vote', id: d.id })); ok(act(room, d, { op: 'vote', id: b.id })); ok(act(room, c, { op: 'vote', id: b.id }));
  room.remove(d.id);
  bad(act(room, b, { op: 'vote', id: d.id }), /playing/);
  g(room).next(); until(room, clock, 'reveal', 1);
  const res = room.tvState().state.result;
  assert.deepEqual(res.winners.map((w) => w.name), ['Bo']); assert.equal(res.top[0].votes, 1);
});

for (const [n, rounds] of [[3, 10], [8, 15], [100, 30]]) {
  test(`Full game with ${n} players (bots), ${rounds} prompts, reaches ‘over’ with titles and awards`, () => {
    const { room, clock } = setup({ bots: n, settings: { rounds, pack: n === 100 ? 'mix' : 'classic' }, seed: 11 + n });
    assert.equal(room.players.size, n);
    room.start();
    const t0 = Date.now(); runOut(room, clock);
    const s = room.tvState().state;
    assert.equal(s.phase, 'over'); assert.equal(g(room).n, rounds);
    const totalTitles = [...g(room).titles.values()].reduce((x, t) => x + t.length, 0);
    assert(totalTitles >= rounds * 0.5, 'titles were handed out: ' + totalTitles);
    assert(s.final.hall.length && s.final.awards.main && s.final.awards.reader);
    assert(s.final.standings[0].points > 0);
    if (n === 100) { assert(s.final.hall.length <= 24); assert(json(room.tvState()).length < 200000); console.log(`    (100 players: ${Date.now() - t0} ms, tv state ${json(room.tvState()).length} bytes)`); }
    // phone view at the end
    const v = room.playerState(room.list()[0]).state; assert(v.final && v.final.awards);
  });
}

test('Bots lean somewhere: most classic rounds have a single winner, not a giant tie', () => {
  const { room, clock } = setup({ bots: 12, settings: { rounds: 20 }, seed: 3 });
  room.start();
  let single = 0, classic = 0;
  for (let n = 1; n <= 20; n++) { until(room, clock, 'reveal', n); const r = g(room).r; if (r.kind === 'classic') { classic++; if (r.result.winners.length === 1) single++; } }
  assert(single >= classic * 0.5, `${single}/${classic} single winners`);
});

test('100 players: phones get a candidate list during the vote; the TV shows only the top vote-getters', () => {
  const { room, clock, H: [a] } = setup({ bots: 99, humans: ['Ann'], seed: 5 });
  room.start(); until(room, clock, 'vote', 1);
  const v = room.playerState(a).state;
  assert.equal(v.choices.length, 100);
  assert.equal(room.tvState().state.waiting, null); // too many names; counter only
  until(room, clock, 'reveal', 1);
  const res = room.tvState().state.result;
  assert(res.top.length <= 6 || res.top.every((t) => t.win));
});




test('Final prompt counts double; phones learn how many votes they got; results() best-first at the end', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { rounds: 10 } });
  ok(room.start());
  assert.deepEqual(g(room).results(), []);
  until(room, clock, 'intro', 10);
  assert.equal(g(room).r.kind, 'hot'); // 10 is a Hot Seat round
  assert.equal(room.tvState().state.last, true);
  until(room, clock, 'vote', 10);
  const seat = g(room).r.seat, others = [a, b, c].filter((p) => p.id !== seat);
  for (const p of [a, b, c]) ok(act(room, p, { op: 'vote', yes: true }));
  for (const p of others) ok(act(room, p, { op: 'predict', yes: true }));
  ok(act(room, room.get(seat), { op: 'skip' }));
  until(room, clock, 'reveal', 10);
  for (const p of others) assert.equal(g(room).r.gained.get(p.id), (100 + 150) * 2, 'match + prediction, doubled');
  assert.equal(g(room).r.gained.get(seat), 100 * 2);
  runOut(room, clock);
  const order = g(room).results();
  assert.deepEqual(order, g(room).standings().map((x) => x.id));
  assert.equal(order.length, 3);
});

test('Votes received: each phone sees its own count after a classic reveal', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ann', 'Bo', 'Cy'] });
  ok(room.start());
  until(room, clock, 'vote', 1);
  ok(act(room, a, { op: 'vote', id: b.id })); ok(act(room, c, { op: 'vote', id: b.id })); ok(act(room, b, { op: 'vote', id: a.id }));
  until(room, clock, 'reveal', 1);
  assert.equal(room.playerState(b).state.mine.got, 2);
  assert.equal(room.playerState(a).state.mine.got, 1);
  assert.equal(room.playerState(c).state.mine.got, 0);
});

console.log(`\n${passed} Most Likely To… tests passed.`);
