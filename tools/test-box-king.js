'use strict';
// Kill the King (TRIAL) rules: the ladder and its pay tiers, missions and the kingdom's target,
// ghosts at half strength, judgement outcomes, binding contracts, the coup's 60% and the seat
// shift, every secret role, the kingdom-falls rule, message privacy (the TV never gets message
// text; the Spy only the target's SENT messages), the text filter, the trial feedback, Party Mode
// leaving it out, kicks, and bots playing whole games.   node tools/test-box-king.js
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/king');
const FEEDBACK = require('../box/trial-feedback');
const T = def._test;
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const run = (room, clock, until = () => room.game.phase === 'over', max = 400000) => { let i = 0; while (!until() && clock.step()) if (++i > max) throw new Error('never got there: ' + room.game.phase); };
// Humans only (no bot moves to get in the way); everyone "connected".
function make(n = 5, settings = {}, { bots = 0, seed = 5 } = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('KK', def, { clock, seed });
  const hs = []; for (let i = 0; i < n; i++) { const p = room.join('P' + i).player; p.sockets = 1; hs.push(p); }
  if (bots) room.addBots(bots);
  Object.assign(room.settings, settings);
  assert(room.start().ok);
  return { clock, room, g: room.game, hs };
}
const to = (g, phase, max = 40) => { for (let i = 0; i < max && g.phase !== phase; i++) g.next(); assert.equal(g.phase, phase, 'reached ' + phase); };
const P = (room, id) => room.get(id);
const king = (g) => g.ladder[0];

test('the ladder: tiers and titles for 4, 6 and 10 players; pay Crown 100 / Nobles 60 / Guild 35 / Commons 15', () => {
  const tiers = (n) => Array.from({ length: n }, (_, i) => T.TIERS[T.tierOf(i, n)].k);
  assert.deepEqual(tiers(4), ['crown', 'noble', 'noble', 'commons']);
  assert.deepEqual(tiers(6), ['crown', 'noble', 'noble', 'guild', 'guild', 'commons']);
  assert.deepEqual(tiers(10), ['crown', 'noble', 'noble', 'guild', 'guild', 'guild', 'commons', 'commons', 'commons', 'commons']);
  assert.deepEqual(T.TIERS.map((t) => t.pay), [100, 60, 35, 15]);
  assert.equal(T.titleOf(0, 6).name, 'King'); assert.equal(T.titleOf(1, 6).name, 'Knight'); assert.equal(T.titleOf(5, 6).name, 'Peasant'); assert.equal(T.titleOf(12, 14).name, 'Peasant');
});

test('setup: everyone on the ladder, secret roles scale with the crowd (2/3/4/5), none with secrets off', () => {
  for (const [n, k] of [[4, 2], [5, 3], [6, 3], [7, 4], [8, 4], [9, 5], [10, 5]]) {
    const { g } = make(n);
    assert.equal(g.ladder.length, n);
    const secrets = [...g.P.values()].map((x) => x.secret).filter(Boolean);
    assert.equal(secrets.length, k, n + ' players'); assert.equal(new Set(secrets).size, k, 'all different');
    assert.deepEqual(secrets.sort(), T.SECRET_ORDER.slice(0, k).sort());
  }
  const { g } = make(6, { secrets: 'off' }); assert.equal([...g.P.values()].filter((x) => x.secret).length, 0);
});

test('missions: the target is the sum of the waves; each mission’s moves add defence; ghosts and the haunted count half', () => {
  const { g, hs } = make(4, { rounds: 5, mission: 60 });
  assert.equal(g.target, g.waves.reduce((a, b) => a + b, 0)); assert.equal(g.waves.length, 5);
  assert(g.waves.every((w, i) => i === 0 || w >= g.waves[i - 1]), 'the waves grow');
  to(g, 'mission'); assert.equal(g.mis.key, 'wall');
  const [a, b] = hs, ma = g.pl(a.id).m;
  assert.equal(g.act(a, { op: 'mend', cell: ma.cracks[0] }).ok, true); assert.equal(g.pl(a.id).units, 1);
  g.pl(b.id).ghost = true; g.room.clock.t += 300;
  const mb = g.pl(b.id).m; assert.equal(g.act(b, { op: 'mend', cell: mb.cracks[0] }).ok, true); assert.equal(g.pl(b.id).units, 0.5, 'a ghost mends at half strength');
  g.room.clock.t += 300; const wrong = [0, 1, 2, 3, 4, 5, 6, 7, 8].find((c) => !g.pl(a.id).m.cracks.includes(c));
  assert.equal(g.act(a, { op: 'mend', cell: wrong }).ok, false); g.room.clock.t += 300;
  assert.equal(g.act(a, { op: 'mend', cell: g.pl(a.id).m.cracks[0] }).ok, false, 'a wrong stone locks you briefly');
  g.pl(b.id).ghost = false; g.pl(hs[2].id).haunted = true; g.room.clock.t += 2000;
  g.act(hs[2], { op: 'mend', cell: g.pl(hs[2].id).m.cracks[0] }); assert.equal(g.pl(hs[2].id).units, 0.5, 'haunted: half strength');
  // beacons: the right rune lights it (asker 4, shouter 2) and re-rolls the shouter’s rune; a wrong one smokes
  g.next(); to(g, 'mission'); assert.equal(g.mis.key, 'beacons');
  for (const p of hs) g.pl(p.id).haunted = false;
  const asker = hs[0], m0 = g.pl(asker.id).m, shouter = m0.ask, rune = g.pl(shouter).m.rune;
  const u0 = g.pl(asker.id).units, s0 = g.pl(shouter).units;
  assert.equal(g.act(asker, { op: 'rune', rune }).ok, true);
  assert.equal(g.pl(asker.id).units - u0, 4); assert.equal(g.pl(shouter).units - s0, 2); assert.notEqual(g.pl(shouter).m.rune, rune);
  const m1 = g.pl(hs[1].id).m, r1 = g.pl(m1.ask).m.rune;
  assert.equal(g.act(hs[1], { op: 'rune', rune: (r1 + 1) % 6 }).ok, false); assert.equal(g.act(hs[1], { op: 'rune', rune: r1 }).ok, false, 'smoke: locked out');
  // bells: rung together they count for more
  g.next(); to(g, 'mission'); assert.equal(g.mis.key, 'bells');
  g.act(hs[0], { op: 'ring' }); g.act(hs[1], { op: 'ring' }); g.act(hs[2], { op: 'ring' });
  run(g.room, g.room.clock, () => g.mis.peals.length >= 1);
  assert.equal(g.mis.peals[0].k, 3); assert.equal(g.pl(hs[0].id).units, 0.6 * 3);
  g.room.clock.t += 5000; g.act(hs[3], { op: 'ring' }); run(g.room, g.room.clock, () => g.mis.peals.length >= 2);
  assert.equal(g.pl(hs[3].id).units, 0.6, 'a lone bell counts little');
  // gate: it only turns while the whole group holds
  g.next(); to(g, 'mission'); assert.equal(g.mis.key, 'gate');
  const grp = g.mis.groups[0], [x, y] = grp.map((id) => P(g.room, id));
  g.act(x, { op: 'grip', on: true }); const before = g.pl(x.id).units;
  for (let i = 0; i < 2; i++) g.room.clock.step();
  assert.equal(g.pl(x.id).units, before, 'one hand on the winch turns nothing');
  g.act(y, { op: 'grip', on: true }); for (let i = 0; i < 3; i++) g.room.clock.step();
  assert(g.pl(x.id).units > before, 'both hands: it turns');
});

test('repel and the kingdom: defence adds up; falling short only dents; the total decides at the end', () => {
  const { g, hs } = make(4, { rounds: 3, mission: 45 });
  to(g, 'mission'); g.next(); assert.equal(g.phase, 'repel');
  assert.equal(g.lastRepel.ok, false, 'nobody worked: the wave breaks through'); assert.equal(g.history.length, 1);
  assert(!['siege', 'over'].includes(g.phase), 'a dent never ends the game');
  // the kingdom falls: everyone keeps a quarter, a Turncloak keeps everything plus 150
  for (const p of hs) g.pl(p.id).points = 400;
  g.pl(hs[1].id).secret = 'turncloak';
  g.finale(); assert.equal(g.phase, 'siege'); assert.equal(g.siege.survived, false);
  assert.equal(g.pl(hs[0].id).points, 100); assert.equal(g.pl(hs[1].id).points, 550);
  const b = make(4, { rounds: 3 }); b.g.defTotal = b.g.target; for (const p of b.hs) b.g.pl(p.id).points = 400;
  b.g.finale(); assert.equal(b.g.siege.survived, true); assert.equal(b.g.pl(b.hs[0].id).points, 400);
  run(b.room, b.clock); assert.equal(b.g.phase, 'over'); assert.equal(b.g.results().length, 4);
});

test('role pay by tier plus the mission bonus; ghosts get no rank pay', () => {
  const { g } = make(6);
  to(g, 'mission'); const L = g.ladder.slice();
  g.pl(L[3]).units = 30; // bonus 10
  g.kill(L[5], [], 'test');
  to(g, 'pay');
  const row = (id) => g.payRows.find((r) => r.id === id);
  assert.equal(row(L[0]).pay, 100); assert.equal(row(L[1]).pay, 60); assert.equal(row(L[3]).pay, 35); assert.equal(row(L[3]).bonus, 10);
  assert.equal(row(L[4]).pay, 15, 'the new bottom seat is Commons'); assert.equal(row(L[5]).pay, 0, 'a ghost has no rank');
  assert.equal(g.pl(L[0]).points, 100);
});

test('judgement: kill (a ghost, off the ladder), demote (to the bottom), reveal (messages on the TV only then), acquittal, ties go to the King', () => {
  const sentence = (s, votes) => {
    const r = make(5); const { g, room } = r; to(g, 'summon');
    const K = P(room, king(g)), tgt = g.ladder[1];
    if (s === 'reveal') { to(g, 'summon'); }
    assert.equal(g.act(K, { op: 'summon', target: tgt, sentence: s }).ok, true); assert.equal(g.phase, 'hearing');
    for (const [i, side] of votes) assert.equal(g.act(P(room, g.ladder[i]), { op: 'vote', side }).ok, true);
    if (g.phase === 'hearing') g.next();
    assert.equal(g.phase, 'verdict');
    return { ...r, tgt };
  };
  // 5 players: King aye, accused nay; seats 2..4 vote
  let r = sentence('kill', [[2, 'aye'], [3, 'aye'], [4, 'nay']]);
  assert.equal(r.g.J.result.passed, true); assert.equal(r.g.pl(r.tgt).ghost, true); assert(!r.g.ladder.includes(r.tgt));
  assert.deepEqual([...r.g.pl(r.tgt).killers].sort(), r.g.J.result.aye.slice().sort(), 'the aye voters are the killers');
  r = sentence('demote', [[2, 'aye'], [3, 'aye'], [4, 'aye']]); assert.equal(r.g.ladder[r.g.ladder.length - 1], r.tgt);
  r = sentence('kill', [[2, 'nay'], [3, 'nay'], [4, 'aye']]);
  assert.equal(r.g.J.result.passed, false); assert.equal(r.g.pl(r.tgt).ghost, false); assert.equal(r.g.pl(r.tgt).points, T.PTS.acquit);
  r = sentence('demote', [[2, 'nay'], [3, 'aye'], [4, 'nay']]); // 2 aye (King + 1) vs 3 nay
  assert.equal(r.g.J.result.passed, false);
  r = sentence('demote', [[2, 'nay'], [3, 'aye']]); // 2 v 2: the King wins ties
  assert.equal(r.g.J.result.passed, true); assert.equal(r.g.J.result.tie, true);
  // mercy
  const m = make(4); to(m.g, 'summon'); assert.equal(m.g.act(P(m.room, king(m.g)), { op: 'summon', mercy: true }).ok, true); assert.equal(m.g.phase, 'verdict'); m.g.next(); assert.equal(m.g.phase, 'pay');
  // only the King summons; no demoting the bottom seat; the accused can’t vote again
  const v = make(4); to(v.g, 'summon');
  assert.equal(v.g.act(P(v.room, v.g.ladder[1]), { op: 'summon', target: v.g.ladder[2], sentence: 'kill' }).ok, false);
  assert.equal(v.g.act(P(v.room, king(v.g)), { op: 'summon', target: v.g.ladder[3], sentence: 'demote' }).ok, false);
  assert.equal(v.g.act(P(v.room, king(v.g)), { op: 'summon', target: v.g.ladder[1], sentence: 'exile' }).ok, false);
  v.g.act(P(v.room, king(v.g)), { op: 'summon', target: v.g.ladder[1], sentence: 'kill' });
  assert.equal(v.g.act(P(v.room, v.g.ladder[1]), { op: 'vote', side: 'aye' }).ok, false);
});

test('contracts: the King’s promotion and the accused’s payment are enforced; a broken oath is fined; offers are validated', () => {
  const { g, room } = make(6); to(g, 'summon');
  const K = P(room, king(g)), acc = g.ladder[1];
  g.act(K, { op: 'summon', target: acc, sentence: 'demote' });
  const [v2, v3, v4, v5] = g.ladder.slice(2).map((id) => P(room, id));
  g.pl(acc).points = 100; g.pl(v4.id).points = 50;
  // the King offers v4 a seat for an AYE; the accused pays v3 and v5 for a NAY
  assert.equal(g.act(K, { op: 'offer', target: v4.id }).ok, true);
  assert.equal(g.act(K, { op: 'offer', target: v4.id }).ok, false, 'one offer per voter');
  assert.equal(g.act(K, { op: 'offer', target: acc }).ok, false, 'not to the accused');
  assert.equal(g.act(P(room, acc), { op: 'offer', target: v3.id, amount: 25 }).ok, true);
  assert.equal(g.act(P(room, acc), { op: 'offer', target: v5.id, amount: 13 }).ok, false, 'only 10, 25 or 50');
  assert.equal(g.act(P(room, acc), { op: 'offer', target: v5.id, amount: 50 }).ok, true);
  assert.equal(g.act(v2, { op: 'offer', target: v3.id }).ok, false, 'voters can’t offer');
  const oK = g.J.offers.find((o) => o.to === v4.id), o3 = g.J.offers.find((o) => o.to === v3.id), o5 = g.J.offers.find((o) => o.to === v5.id);
  assert.equal(g.act(v2, { op: 'accept', offer: oK.id }).ok, false, 'not your deal');
  assert.equal(g.act(v4, { op: 'accept', offer: oK.id }).ok, true); assert.equal(g.J.votes.get(v4.id), 'aye', 'accepting pledges your vote');
  assert.equal(g.act(v3, { op: 'accept', offer: o3.id }).ok, true);
  g.act(v3, { op: 'vote', side: 'aye' }); // betrayal!
  g.act(v5, { op: 'vote', side: 'nay' }); // never accepted, but voted the offer’s way: still paid
  g.act(v2, { op: 'vote', side: 'aye' });
  const seat4 = g.seat(v4.id), p3 = g.pl(v3.id).points;
  if (g.phase === 'hearing') g.next();
  assert.equal(g.phase, 'verdict');
  assert.equal(oK.status, 'kept'); assert.equal(o3.status, 'broken'); assert.equal(o5.status, 'kept');
  assert.equal(g.J.result.passed, true); assert.equal(g.seat(v4.id), seat4 - 2, 'v4 moved up when the accused dropped, then rose a seat');
  assert.equal(g.pl(v5.id).points, 50, 'paid 50 by the accused'); assert.equal(g.pl(v3.id).points, Math.max(0, p3 - T.PTS.oath), 'the oath breaker is fined');
  assert(g.contracts.some((c) => c.status === 'broken' && c.to === v3.id));
  assert(g.rivalries().some((r) => /broke an oath/.test(r.text)));
});

test('a promotion contract moves the voter up exactly one seat (never onto the throne)', () => {
  const { g, room } = make(6); to(g, 'summon');
  const K = P(room, king(g)), acc = g.ladder[5], voter = P(room, g.ladder[3]);
  g.act(K, { op: 'summon', target: acc, sentence: 'reveal' });
  assert.equal(g.act(K, { op: 'offer', target: g.ladder[1] }).ok, false, 'the Knight can’t rise any higher');
  g.act(K, { op: 'offer', target: voter.id }); g.act(voter, { op: 'vote', side: 'aye' });
  const above = g.ladder[2];
  g.next(); assert.equal(g.phase, 'verdict');
  assert.equal(g.seat(voter.id), 2); assert.equal(g.seat(above), 3);
});

test('the coup: 60% of the living (ceil), caller crowned, everyone below the caller moves up one, a failed coup drops the caller', () => {
  const { g, room } = make(5); to(g, 'court');
  const L0 = g.ladder.slice(), caller = P(room, L0[3]);
  assert.equal(g.act(P(room, L0[0]), { op: 'coup' }).ok, false, 'the King can’t');
  assert.equal(g.act(caller, { op: 'coup' }).ok, true); assert.equal(g.phase, 'coup');
  assert.equal(g.coup.need, 3, '60% of 5 is 3');
  assert.equal(g.act(caller, { op: 'vote', yes: false }).ok, false, 'the caller’s vote is cast');
  g.act(P(room, L0[1]), { op: 'vote', yes: true }); g.act(P(room, L0[2]), { op: 'vote', yes: false });
  g.act(P(room, L0[4]), { op: 'vote', yes: true });
  if (g.phase === 'coup') g.next();
  assert.equal(g.phase, 'coupResult'); assert.equal(g.coup.result.passed, true);
  assert.deepEqual(g.ladder, [L0[3], L0[1], L0[2], L0[4]], 'new King; the Knight and Steward keep their seats; the one below moved up');
  g.next(); assert.equal(g.phase, 'trial');
  for (const id of g.trialS.voters) g.act(P(room, id), { op: 'vote', kill: false });
  if (g.phase === 'trial') g.next();
  assert.equal(g.phase, 'trialResult'); assert.equal(g.ladder[g.ladder.length - 1], L0[0], 'spared: the old King goes to the bottom');
  g.next(); assert.equal(g.phase, 'summon'); assert.equal(king(g), L0[3], 'the new King judges');
  // a failed coup, and a killed old King
  const f = make(5); to(f.g, 'court'); const F0 = f.g.ladder.slice();
  f.g.act(P(f.room, F0[2]), { op: 'coup' }); f.g.act(P(f.room, F0[1]), { op: 'vote', yes: true });
  f.g.act(P(f.room, F0[3]), { op: 'vote', yes: false }); f.g.act(P(f.room, F0[4]), { op: 'vote', yes: false });
  if (f.g.phase === 'coup') f.g.next();
  assert.equal(f.g.coup.result.passed, false); assert.equal(f.g.ladder[4], F0[2], 'the failed caller drops to the bottom'); assert.equal(king(f.g), F0[0]);
  const k = make(4); to(k.g, 'court'); const K0 = k.g.ladder.slice();
  k.g.act(P(k.room, K0[1]), { op: 'coup' }); assert.equal(k.g.coup.need, 3, '60% of 4 rounds up to 3');
  k.g.act(P(k.room, K0[2]), { op: 'vote', yes: true }); k.g.act(P(k.room, K0[3]), { op: 'vote', yes: true });
  if (k.g.phase === 'coup') k.g.next(); k.g.next();
  for (const id of k.g.trialS.voters) k.g.act(P(k.room, id), { op: 'vote', kill: true });
  if (k.g.phase === 'trial') k.g.next();
  assert.equal(k.g.pl(K0[0]).ghost, true, 'killed: the old King is a ghost'); assert.equal(k.g.ladder.length, 3);
  assert.equal(k.g.act(P(k.room, K0[0]), { op: 'coup' }).ok, false);
});

test('ghosts: no votes, half missions, and Haunt one of their killers once a round (steal 15, halve their next mission)', () => {
  const { g, room } = make(5); to(g, 'summon');
  const K = P(room, king(g)), tgt = P(room, g.ladder[4]), v = P(room, g.ladder[2]);
  g.act(K, { op: 'summon', target: tgt.id, sentence: 'kill' }); g.act(v, { op: 'vote', side: 'aye' }); g.next();
  assert.equal(g.pl(tgt.id).ghost, true);
  to(g, 'court');
  assert.equal(g.act(tgt, { op: 'haunt', target: g.ladder[3] }).ok, false, 'only a killer');
  g.pl(v.id).points = 40;
  assert.equal(g.act(tgt, { op: 'haunt', target: v.id }).ok, true);
  assert.equal(g.pl(v.id).points, 25); assert.equal(g.pl(tgt.id).haunted, false); assert.equal(g.pl(v.id).haunted, true);
  assert.equal(g.act(tgt, { op: 'haunt', target: K.id }).ok, false, 'once a round');
  assert.equal(g.act(v, { op: 'haunt', target: K.id }).ok, false, 'the living can’t haunt');
  to(g, 'summon'); g.act(P(room, king(g)), { op: 'summon', target: g.ladder[1], sentence: 'demote' });
  assert.equal(g.act(tgt, { op: 'vote', side: 'nay' }).ok, false, 'ghosts don’t vote');
  const view = g.view(tgt); assert.equal(view.mine.ghost, true); assert.deepEqual(view.killers.map((x) => x.id).sort(), [...g.pl(tgt.id).killers].sort());
});

test('Assassin: every other round, a hit makes a ghost; a miss leaves a clue on the TV', () => {
  const { g, room } = make(5); to(g, 'court');
  const A = P(room, g.ladder[2]); g.pl(A.id).secret = 'assassin'; for (const x of g.P.values()) if (x.id !== A.id && x.secret === 'assassin') x.secret = null;
  const victim = g.ladder[0];
  assert.equal(g.act(A, { op: 'mark', target: A.id }).ok, false);
  assert.equal(g.act(P(room, g.ladder[1]), { op: 'mark', target: victim }).ok, false, 'not your job');
  assert.equal(g.act(A, { op: 'mark', target: victim }).ok, true);
  room.rng = () => 0.1; // a hit
  g.next(); assert.equal(g.phase, 'dusk'); assert.equal(g.dusk.hit, true);
  assert.equal(g.pl(victim).ghost, true); assert.notEqual(king(g), victim, 'the next in line takes the throne');
  assert.deepEqual([...g.pl(victim).killers], [A.id]);
  assert.equal(JSON.stringify(g.tv()).includes('"assassin"'), false, 'the TV never names the Assassin');
  to(g, 'court'); assert.equal(g.act(A, { op: 'mark', target: g.ladder[0] }).ok, false, 'the dagger rests a round');
  g.next(); to(g, 'court'); assert.equal(g.round, 3);
  assert.equal(g.act(A, { op: 'mark', target: g.ladder[0] }).ok, true);
  room.rng = () => 0.9; // a miss
  g.next(); assert.equal(g.phase, 'dusk'); assert.equal(g.dusk.hit, false); assert(g.dusk.clue && /Assassin/.test(g.dusk.clue));
  assert.equal(g.tv().dusk.clue, g.dusk.clue); assert(g.tv().clues.includes(g.dusk.clue));
});

test('Ghoul: killed, it picks one of its killers and drains half their pay every round', () => {
  const { g, room } = make(5); to(g, 'summon');
  const K = P(room, king(g)), ghoul = P(room, g.ladder[3]); g.pl(ghoul.id).secret = 'ghoul';
  g.act(K, { op: 'summon', target: ghoul.id, sentence: 'kill' }); g.next();
  assert.equal(g.pl(ghoul.id).ghost, true); assert.deepEqual(g.pl(ghoul.id).ghoulCands, [K.id], 'only the King voted aye');
  assert.equal(g.act(ghoul, { op: 'ghoul', target: g.ladder[1] }).ok, false);
  assert.equal(g.act(ghoul, { op: 'ghoul', target: K.id }).ok, true);
  const k0 = g.pl(K.id).points, gh0 = g.pl(ghoul.id).points;
  g.next(); assert.equal(g.phase, 'pay');
  const r = g.payRows.find((x) => x.id === K.id);
  assert.equal(r.drained, 50); assert.equal(g.pl(K.id).points - k0, 50); assert.equal(g.pl(ghoul.id).points - gh0, 50);
});

test('Spy sees only the target’s SENT messages this round (no recipients); the Fortune Teller peeks once', () => {
  const { g, room, hs } = make(5); to(g, 'court');
  const [spy, tgt, c, d] = hs; g.pl(spy.id).secret = 'spy'; g.pl(c.id).secret = 'seer';
  assert.equal(g.act(spy, { op: 'spy', target: tgt.id }).ok, true);
  assert.equal(g.act(spy, { op: 'spy', target: c.id }).ok, false, 'one target a round');
  room.clock.t += 1000; g.act(tgt, { op: 'msg', to: [d.id], text: 'Sent by the target' });
  room.clock.t += 1000; g.act(d, { op: 'msg', to: [tgt.id], text: 'A reply to the target' });
  const v = g.view(spy);
  assert.deepEqual(v.spy.msgs.map((m) => m.text), ['Sent by the target']);
  assert.equal(JSON.stringify(v.spy).includes(d.id), false, 'no recipients');
  assert.equal(JSON.stringify(v).includes('A reply to the target'), false, 'never the replies');
  assert.equal(g.act(c, { op: 'peek', target: tgt.id }).ok, true);
  assert.equal(g.view(c).seer.peek.secret, g.pl(tgt.id).secret || 'loyal');
  assert.equal(g.act(c, { op: 'peek', target: d.id }).ok, false, 'once a game');
});

test('message privacy and filtering: the TV gets who-talks-to-whom only; phones only their own messages', () => {
  const { g, room, hs } = make(5); to(g, 'court');
  const [a, b, c] = hs;
  assert.equal(g.act(a, { op: 'msg', to: [b.id], text: 'Meet me by the well at midnight' }).ok, true);
  room.clock.t += 1000; assert.equal(g.act(a, { op: 'msg', to: [b.id, c.id], text: 'You are a shit king' }).ok, true);
  const tv = JSON.stringify(g.tv());
  assert.equal(tv.includes('well at midnight'), false); assert.equal(tv.includes('You are a'), false);
  assert(g.tv().court.pairs.some((p) => [p.a, p.b].sort().join() === [a.id, b.id].sort().join() && p.n === 2));
  assert(JSON.stringify(g.view(b)).includes('well at midnight'));
  assert.equal(JSON.stringify(g.view(c)).includes('well at midnight'), false, 'not to c');
  const filtered = g.msgs[1].text; assert.equal(/shit/i.test(filtered), false, 'filtered: ' + filtered);
  // validation
  for (const bad of [{ to: [], text: 'x' }, { to: [a.id], text: 'x' }, { to: ['nobody'], text: 'x' }, { to: [b.id, c.id, hs[3].id, hs[4].id], text: 'x' }, { to: [b.id], text: '   ' }, { to: [b.id], text: 'y'.repeat(101) }, { to: [b.id], text: 5 }, { to: 'b', text: 'x' }]) {
    room.clock.t += 1000; assert.equal(g.act(a, { op: 'msg', ...bad }).ok, false, JSON.stringify(bad));
  }
  assert.equal(g.act(a, { op: 'msg', to: [b.id], text: 'x' }).ok, true); assert.equal(g.act(a, { op: 'msg', to: [b.id], text: 'y' }).ok, false, 'rate limited');
  to(g, 'mission'); room.clock.t += 1000; assert.equal(g.act(a, { op: 'msg', to: [b.id], text: 'busy?' }).ok, false, 'no gossip during missions');
  // a passed Reveal shows the accused’s sent messages on the TV (and only then)
  const r = make(5); to(r.g, 'court');
  const acc = P(r.room, r.g.ladder[2]); r.g.act(acc, { op: 'msg', to: [r.g.ladder[3]], text: 'The King is a fool' });
  to(r.g, 'summon'); r.g.act(P(r.room, king(r.g)), { op: 'summon', target: acc.id, sentence: 'reveal' });
  assert.equal(JSON.stringify(r.g.tv()).includes('The King is a fool'), false);
  for (const id of r.g.voters()) r.g.act(P(r.room, id), { op: 'vote', side: 'aye' });
  if (r.g.phase === 'hearing') r.g.next();
  assert(JSON.stringify(r.g.tv()).includes('The King is a fool'), 'revealed at the verdict');
  r.g.next(); assert.equal(JSON.stringify(r.g.tv()).includes('The King is a fool'), false, 'and gone again');
});

test('the TV never carries a secret role until the unmask', () => {
  const { room, clock, g } = make(4, { rounds: 3 }, { bots: 4 });
  const words = ['"spy"', '"ghoul"', '"seer"', '"turncloak"', '"assassin"', 'Fortune Teller', 'Turncloak'];
  let i = 0;
  while (g.phase !== 'unmask' && clock.step()) { if (++i % 25 === 0) { const s = JSON.stringify(g.tv()); for (const w of words) assert.equal(s.includes(w), false, w + ' in ' + g.phase); } if (i > 400000) throw new Error('stuck'); }
  assert(g.tv().secrets.length === 8);
});

test('trial feedback: only at the end, thumbs up/down plus a short note, saved to the feedback file', () => {
  const file = path.join(os.tmpdir(), 'kk-feedback-' + process.pid + '.jsonl'); try { fs.unlinkSync(file); } catch { /* none */ }
  process.env.TRIAL_FEEDBACK_FILE = file;
  try {
    const { g, room, clock, hs } = make(4, { rounds: 3 });
    assert.equal(g.act(hs[0], { op: 'feedback', rating: 'up' }).ok, false, 'not before the end');
    run(room, clock, () => g.phase === 'unmask');
    assert.equal(g.act(hs[0], { op: 'feedback', rating: 'meh' }).ok, false);
    assert.equal(g.act(hs[0], { op: 'feedback', rating: 'up', note: 'Loved   the <b>coup</b>\n!' }).ok, true);
    assert.equal(g.act(hs[1], { op: 'feedback', rating: 'down', note: 'x'.repeat(400) }).ok, true);
    run(room, clock); assert.equal(g.phase, 'over');
    assert.equal(g.act(hs[1], { op: 'feedback', rating: 'up' }).ok, true, 'you can change your mind');
    assert.deepEqual(g.tv().feedback, { up: 2, down: 0 });
    const lines = FEEDBACK.readAll(file);
    assert.equal(lines.length, 3); assert.equal(lines[0].game, 'king'); assert.equal(lines[0].note, 'Loved the b coup /b !');
    assert(!/[<>]/.test(lines[0].note)); assert.equal(lines[1].note.length, FEEDBACK.MAX_NOTE);
    assert.equal(JSON.stringify(lines).includes('P0'), false, 'no names saved');
    assert.equal(g.view(hs[0]).myFeedback.rating, 'up');
  } finally { delete process.env.TRIAL_FEEDBACK_FILE; try { fs.unlinkSync(file); } catch { /* none */ } }
});

test('bots play whole games (4, 6, 10 players; 3 and 5 rounds); results() best-first; every phase reachable', () => {
  const phases = new Set();
  for (const [n, rounds, seed] of [[4, 3, 1], [6, 5, 2], [10, 5, 3], [7, 3, 4], [5, 5, 9]]) {
    const clock = new VirtualClock(), room = new BoxRoom('KB', def, { clock, seed });
    room.addBots(n); room.settings.rounds = rounds; assert(room.start().ok);
    const g = room.game; let i = 0;
    while (g.phase !== 'over' && clock.step()) { phases.add(g.phase); if (++i > 600000) throw new Error('stuck in ' + g.phase); }
    const res = g.results(); assert.equal(res.length, n);
    const st = g.standings(); for (let k = 1; k < st.length; k++) assert(st[k - 1].points >= st[k].points);
    assert.equal(g.history.length, rounds); assert(g.final && Array.isArray(g.final.rivalries) && Array.isArray(g.final.awards));
    const mins = clock.now() / 60000; assert(mins > (rounds === 5 ? 12 : 7) && mins < (rounds === 5 ? 32 : 20), 'length ' + mins.toFixed(1));
    room.scoreParty(); assert.equal(room.played.length, 1, 'party points awarded');
  }
  for (const p of ['brief', 'mission', 'repel', 'court', 'dusk', 'coup', 'coupResult', 'trial', 'trialResult', 'summon', 'hearing', 'verdict', 'pay', 'siege', 'unmask']) assert(phases.has(p), 'bots reached ' + p);
});

test('input is validated; latecomers start at the bottom; a King who leaves hands the crown on; the host can skip any phase', () => {
  const { g, room, hs } = make(5); to(g, 'mission');
  for (const bad of [{ op: 'mend', cell: 9 }, { op: 'mend', cell: 'x' }, { op: 'rune', rune: 1 }, { op: 'ring' }, { op: 'grip', on: 'yes' }, { op: 'coup' }, { op: 'summon' }, { op: 'vote', side: 'aye' }, { op: 'nope' }, {}, { op: 'mark' }, { op: 'spy' }, { op: 'peek' }, { op: 'ghoul' }, { op: 'haunt' }, { op: 'offer' }, { op: 'accept', offer: 1 }])
    assert.equal(g.act(hs[0], bad).ok, false, JSON.stringify(bad));
  const late = room.join('Late').player; late.sockets = 1;
  assert.equal(g.ladder.includes(late.id), true, 'a latecomer starts at the bottom'); assert.equal(g.ladder[g.ladder.length - 1], late.id);
  const K = king(g); room.kick(K);
  assert.notEqual(king(g), K); assert.equal(g.ladder.includes(K), false);
  for (const ph of ['repel', 'court', 'summon', 'verdict', 'pay', 'brief']) { g.next(); assert.equal(g.phase, ph); }
  // everyone but one leaves: the game ends cleanly
  for (const p of room.list().slice(1)) room.kick(p.id);
  assert(['siege', 'unmask', 'over'].includes(g.phase));
});

test('Party Mode: a TRIAL game, left out of automatic lineups; partyFit and the practice round give real options', () => {
  assert.equal(def.trial, true);
  const hub = fs.readFileSync(path.join(__dirname, '..', 'public', 'hub.html'), 'utf8'), party = fs.readFileSync(path.join(__dirname, '..', 'public', 'party', 'party.js'), 'utf8');
  assert(/data-game="king"[^>]*data-trial="1"/.test(hub), 'the tile is marked as a trial'); assert(/class="trial-badge">TRIAL</.test(hub), 'with its badge');
  assert(/\.tile\[data-trial\]/.test(party) && /TRIAL\.has\(k\)/.test(party), 'party.js drops trial games from the deal');
  const PF = require('../box/party-fit');
  for (const minutes of [10, 20, 30, 45]) { const f = PF.fitSettings(def, { players: 6, minutes }); assert(f.settings.rounds && f.settings.mission && f.settings.court, JSON.stringify(f)); }
  assert.equal(PF.fitSettings(def, { players: 6, minutes: 30 }).settings.rounds, 5);
  const ps = def.practiceSettings(); for (const [k, v] of Object.entries(ps)) assert(def.fields.find((f) => f.key === k).options.some((o) => o.value === v), k);
  assert(T.estimate({ rounds: 5, mission: 75, court: 90 }) >= 24 && T.estimate({ rounds: 5, mission: 75, court: 90 }) <= 35);
  assert(T.estimate({ rounds: 3, mission: 75, court: 90 }) >= 14 && T.estimate({ rounds: 3, mission: 75, court: 90 }) <= 21);
});

test('every line Sir Bellow says in the game is in the intro’s story (pre-voiced)', () => {
  const intro = fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'intros', 'king.js'), 'utf8');
  const lines = Object.values(T.HERALD).flat();
  for (const l of lines) assert(intro.includes(`'${l.replace(/'/g, "\\'")}'`) || intro.includes(`"${l}"`), 'missing from story: ' + l);
  const tut = (intro.match(/\{ icon: /g) || []).length; assert.equal(tut, def.howSteps, 'howSteps matches the tutorial');
});

console.log(`\n${passed} Kill the King tests passed.`);
