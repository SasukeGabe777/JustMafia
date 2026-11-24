'use strict';
// JustPitch rules: roles and the swap, round-robin, brackets with byes, the quick bracket, votes
// and stars, all five modes, cue cards, text filtering, validation, leavers, the unlock, Party Mode.
//   node tools/test-box-pitch.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom, UNLOCK_RULES } = require('../box/room');
const def = require('../box/games/pitch');
const C = def._test.C;
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const make = (settings = {}, seed = 1) => { const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed }); room.unlocks.add('pitch'); Object.assign(room.settings, settings); return { clock, room }; };
const run = (room, clock, until = () => room.game.phase === 'over') => { let i = 0; while (!until() && clock.step()) if (++i > 400000) throw new Error('never ended'); };
const humans = (room, names) => names.map((n) => { const p = room.join(n).player; p.sockets = 1; return p; });
// Step the clock until the game reaches a phase.
const to = (room, clock, ph) => run(room, clock, () => room.game.phase === ph || room.game.phase === 'over');

test('content: 5 modes, every mode has topics and its own saboteur cards; nothing borrowed from a TV show', () => {
  assert.deepEqual(C.MODE_KEYS, ['focus', 'deck', 'book', 'press', 'tv']);
  for (const k of C.MODE_KEYS) { assert(C.TOPICS[k].length >= 20, k); assert(C.MODE_CARDS[k].length >= 10, k); assert(C.TOPICS[k].some((t) => !t.p)); }
  const all = JSON.stringify(C).toLowerCase();
  for (const bad of ['joker', 'impractical', 'netflix', 'uber', 'linkedin']) assert(!new RegExp('\\b' + bad).test(all), 'no ' + bad);
});

test('bots play whole games at every size; results() lists everyone, the champion first', () => {
  for (const [n, fmt, matches] of [[3, 'robin', 3], [4, 'robin', 6], [5, 'bracket', 4], [7, 'bracket', 6], [8, 'bracket', 7], [9, 'quick', 5], [12, 'quick', 7]]) {
    const { room, clock } = make({}, n); room.addBots(n); assert(room.start().ok);
    run(room, clock);
    const g = room.game, r = g.results();
    assert.equal(g.format, fmt, `${n} players → ${fmt}`);
    assert.equal(g.history.length, matches, `${n} players: ${matches} matches`);
    assert.equal(r.length, n); assert.equal(r[0], g.champion);
    assert.equal(g.totalMatches(), matches);
  }
});

test('round-robin: everyone meets everyone exactly once', () => {
  const { room, clock } = make({ format: 'robin' }); room.addBots(5); room.start(); run(room, clock);
  const pairs = room.game.history.map((h) => [h.a, h.b].sort().join('|'));
  assert.equal(pairs.length, 10); assert.equal(new Set(pairs).size, 10);
  // more than 5 players asked for round-robin: a bracket instead (it would run too long)
  const b = make({ format: 'robin' }); b.room.addBots(6); b.room.start(); assert.equal(b.room.game.format, 'bracket');
});

test('bracket: byes for odd counts, nobody gets two byes, winners advance, one champion', () => {
  const { room, clock } = make({ format: 'bracket' }, 7); room.addBots(7); room.start(); run(room, clock);
  const g = room.game, R = g.rounds;
  assert.deepEqual(R.map((x) => [x.pairs.length, !!x.bye]), [[3, true], [2, false], [1, false]]);
  const byes = R.map((x) => x.bye).filter(Boolean); assert.equal(new Set(byes).size, byes.length);
  for (let i = 1; i < R.length; i++) {
    const came = new Set([...R[i - 1].pairs.map((p) => p.w), R[i - 1].bye].filter(Boolean)), now = R[i].pairs.flatMap((p) => [p.a, p.b]).concat(R[i].bye || []);
    for (const id of now) assert(came.has(id), 'only winners (and the bye) go on');
  }
  assert.equal(g.champion, R[R.length - 1].pairs[0].w);
  // 5 players: a bye in the first round and again in the semis
  const f = make({ format: 'bracket' }, 3); f.room.addBots(5); f.room.start(); run(f.room, f.clock);
  assert.deepEqual(f.room.game.rounds.map((x) => [x.pairs.length, !!x.bye]), [[2, true], [1, true], [1, false]]);
});

test('quick bracket: one round, then the two best winners in the final', () => {
  const { room, clock } = make({ format: 'quick' }, 9); room.addBots(11); room.start(); run(room, clock);
  const R = room.game.rounds; assert.equal(R.length, 2); assert.equal(R[0].pairs.length, 5); assert(R[0].bye); assert.equal(R[1].pairs.length, 1); assert(!R[1].bye);
});

test('roles: A presents while B sabotages, then they swap with a new topic; each phone sees only its job', () => {
  const { room, clock } = make({ format: 'robin', mode: 'deck' }); const [a, b, c] = humans(room, ['Ana', 'Ben', 'Cy']); room.start();
  to(room, clock, 'prep'); const g = room.game, m = g.m;
  const P = (id) => [a, b, c].find((p) => p.id === id), A = P(m.a), B = P(m.b), Aud = [a, b, c].find((p) => !g.inMatch(p.id));
  assert.equal(m.halves[0].pres, m.a); assert.equal(m.halves[0].sab, m.b); assert.equal(m.halves[1].pres, m.b); assert.equal(m.halves[1].sab, m.a);
  assert.notEqual(m.halves[0].topic.n, m.halves[1].topic.n);
  // prep: each draws the OTHER one's slides; the TV doesn't show the topics yet
  assert.equal(room.game.view(A).task.opp.id, m.b); assert.equal(room.game.view(A).task.heads.length, 3);
  assert.equal(room.game.tv().h, undefined);
  assert(!room.act(Aud, { op: 'slides', strokes: [[]] }).ok, 'the audience draws nothing');
  const doodle = [{ c: 1, s: 2, p: [100, 100, 500, 500, 900, 120] }];
  assert(room.act(A, { op: 'slides', strokes: [doodle, [], doodle] }).ok); assert(room.act(B, { op: 'slides', strokes: [doodle] }).ok);
  to(room, clock, 'pitch');
  assert.equal(room.game.view(A).role, 'pres'); assert.equal(room.game.view(B).role, 'sab'); assert.equal(room.game.view(Aud).role, 'aud');
  assert(!room.game.view(A).hand && room.game.view(B).hand.length === 4, 'only the saboteur holds cards');
  assert.equal(g.tv().h.slide, null, 'the title slide first');
  assert(room.act(B, { op: 'next' }).ok); assert.deepEqual(g.tv().h.slide.strokes, [{ c: 1, s: 2, p: [100, 100, 500, 500, 900, 120] }]);
  assert(!room.act(A, { op: 'next' }).ok, 'the presenter can’t flip slides');
  const card = room.game.view(B).hand[0];
  assert(room.act(B, { op: 'cue', i: 0 }).ok);
  assert.equal(room.game.view(A).cue.text, card.text, 'the presenter gets the card'); assert.equal(g.tv().h.cue.text, card.text, 'and the TV feed shows it');
  assert(!room.act(B, { op: 'cue', i: 1 }).ok, 'cooldown between cards');
  assert(room.act(A, { op: 'ack', id: room.game.view(A).cue.id }).ok); assert(g.tv().h.cue.acked);
  assert(!room.act(A, { op: 'end' }).ok, 'too early to end');
  run(room, clock, () => room.game.half === 1 && room.game.phase === 'pitch');
  assert.equal(room.game.view(B).role, 'pres'); assert.equal(room.game.view(A).role, 'sab');
});

test('votes: 100 a vote, 300 the win, nasty-saboteur votes, +50 for backing the winner; no voting in your own match', () => {
  const { room, clock } = make({ format: 'robin', mode: 'deck' }); const ps = humans(room, ['Ana', 'Ben', 'Cy', 'Di']); room.start();
  to(room, clock, 'vote'); const g = room.game, m = g.m;
  const aud = ps.filter((p) => !g.inMatch(p.id)), mine = ps.find((p) => p.id === m.a);
  assert(!room.act(mine, { op: 'vote', side: 0 }).ok);
  assert(!room.act(aud[0], { op: 'vote', side: 2 }).ok); assert(!room.act(aud[0], { op: 'stars', side: 0, n: 4 }).ok, 'stars are for Buy My Book');
  const before = new Map(ps.map((p) => [p.id, g.scores.get(p.id)]));
  room.act(aud[0], { op: 'vote', side: 1 }); room.act(aud[1], { op: 'vote', side: 1 }); room.act(aud[0], { op: 'nasty', side: 1 });
  to(room, clock, 'result');
  assert.equal(m.result.winner, 1); assert.deepEqual(m.result.tally, [0, 2]);
  const gain = (id) => g.scores.get(id) - before.get(id);
  assert.equal(gain(m.b), 200 + 300); // B presented half 1: 2 votes + the win
  assert.equal(gain(m.a), 50, 'A sabotaged half 1: one nasty vote');
  assert.equal(gain(aud[0].id), 50); assert.equal(gain(aud[1].id), 50);
});

test('Buy My Book: the audience rates both books 1–5 stars; stars count as votes', () => {
  const { room, clock } = make({ format: 'robin', mode: 'book' }); const ps = humans(room, ['Ana', 'Ben', 'Cy', 'Di']); room.start();
  to(room, clock, 'vote'); const g = room.game, m = g.m, aud = ps.filter((p) => !g.inMatch(p.id));
  assert(!room.act(aud[0], { op: 'vote', side: 0 }).ok); assert(!room.act(aud[0], { op: 'stars', side: 0, n: 6 }).ok); assert(!room.act(aud[0], { op: 'stars', side: 0, n: 0 }).ok);
  room.act(aud[0], { op: 'stars', side: 0, n: 5 }); room.act(aud[0], { op: 'stars', side: 1, n: 2 });
  room.act(aud[1], { op: 'stars', side: 0, n: 1 }); room.act(aud[1], { op: 'stars', side: 1, n: 3 });
  to(room, clock, 'result');
  assert.deepEqual(m.result.tally, [6, 5]); assert.equal(m.result.winner, 0); assert.deepEqual(m.result.avg, [3, 2.5]);
  assert.equal(m.halves[0].heads.length, 1); assert.equal(m.halves[0].heads[0], 'The cover');
});

test('Press Conference: audience questions reach the saboteur, who can ask them (the asker scores)', () => {
  const { room, clock } = make({ format: 'robin', mode: 'press' }); const ps = humans(room, ['Ana', 'Ben', 'Cy']); room.start();
  to(room, clock, 'prep'); const g = room.game, aud = ps.find((p) => !g.inMatch(p.id)), sab = ps.find((p) => p.id === g.m.halves[0].sab);
  assert(!room.act(sab, { op: 'ask', text: 'Who did it?' }).ok, 'players in the match don’t ask');
  assert(room.act(aud, { op: 'ask', text: 'Where is the potato now' }).ok);
  assert(!room.act(aud, { op: 'ask', text: 'And another one?' }).ok, 'one question per conference');
  to(room, clock, 'pitch');
  assert.deepEqual(room.game.view(sab).asks.map((q) => q.text), ['Where is the potato now?']);
  const s0 = g.scores.get(aud.id);
  assert(room.act(sab, { op: 'cue', ask: 0 }).ok);
  assert.equal(g.tv().h.cue.kind, 'question'); assert.equal(g.tv().h.cue.by, aud.name); assert.equal(g.scores.get(aud.id) - s0, 50);
  assert.equal(g.m.halves[1].asks.length, 1, 'a question from the prep carries over to the second conference');
});

test('Focus Group: panelist lines go to an audience phone; Late-Night Infomercial price tags stay on screen', () => {
  const { room, clock } = make({ format: 'robin', mode: 'focus' }); const ps = humans(room, ['Ana', 'Ben', 'Cy']); room.start();
  to(room, clock, 'pitch'); const g = room.game, h = g.H(), aud = ps.find((p) => !g.inMatch(p.id)), sab = ps.find((p) => p.id === h.sab);
  h.hand[0] = { id: 999, kind: 'panel', text: 'Does it come in beige?' };
  assert(room.act(sab, { op: 'cue', i: 0 }).ok);
  assert.equal(room.game.view(aud).panel.text, 'Does it come in beige?');
  assert(room.act(aud, { op: 'said', id: room.game.view(aud).panel.id }).ok); assert(g.tv().h.panel.said);
  assert(!room.act(sab, { op: 'said' }).ok);
  const t = make({ format: 'robin', mode: 'tv' }); const qs = humans(t.room, ['Ana', 'Ben', 'Cy']); t.room.start(); to(t.room, t.clock, 'pitch');
  const tg = t.room.game, th = tg.H(), tsab = qs.find((p) => p.id === th.sab);
  th.hand[0] = { id: 998, kind: 'price', text: 'NOW ONLY $1!' };
  assert(t.room.act(tsab, { op: 'cue', i: 0 }).ok); assert.equal(tg.tv().h.price, 'NOW ONLY $1!');
});

test('every mode plays to the end with bots (Mixed rotates through all five)', () => {
  for (const mode of ['mix', ...C.MODE_KEYS]) { const { room, clock } = make({ mode, format: 'robin' }, 5); room.addBots(4); room.start(); run(room, clock); assert.equal(room.game.phase, 'over', mode); }
  const { room, clock } = make({ mode: 'mix', format: 'robin' }, 2); room.addBots(5); room.start(); run(room, clock);
  assert.deepEqual([...new Set(room.game.history.map((h) => h.mode))].sort(), [...C.MODE_KEYS].sort());
});

test('typed text is cleaned and filtered (the room’s word filter), and bounded', () => {
  const { room, clock } = make({ format: 'robin', mode: 'deck' }); const ps = humans(room, ['Ana', 'Ben', 'Cy']); room.filterOn = true; room.start();
  to(room, clock, 'pitch'); const g = room.game, sab = ps.find((p) => p.id === g.H().sab);
  assert(!room.act(sab, { op: 'custom', text: '  ' }).ok);
  assert(room.act(sab, { op: 'custom', text: '<b>Say shit</b> twice ' + 'x'.repeat(200) }).ok);
  const t = g.tv().h.cue.text;
  assert(!/[<>]/.test(t)); assert(!/shit/i.test(t), 'swear word covered: ' + t); assert(t.length <= 80);
});

test('phone input is validated', () => {
  const { room, clock } = make({ format: 'robin', mode: 'deck' }); const ps = humans(room, ['Ana', 'Ben', 'Cy']); room.start();
  to(room, clock, 'prep'); const g = room.game, sab = ps.find((p) => p.id === g.m.halves[0].sab);
  for (const bad of [{}, { op: 'nope' }, { op: 'slides' }, { op: 'slides', strokes: 'x' }, { op: 'slides', strokes: [[], [], [], []] }, { op: 'slides', strokes: [[{ c: 99, s: 0, p: [1, 1] }]] }, { op: 'slides', strokes: [[{ c: 1, s: 1, p: [1, 2000] }]] }, { op: 'cue', i: 0 }, { op: 'vote', side: 0 }])
    assert.equal(room.act(sab, bad).ok, false, JSON.stringify(bad));
  const huge = [{ c: 1, s: 1, p: Array.from({ length: 9000 }, (_, i) => i % 1000) }];
  assert(!room.act(sab, { op: 'slides', strokes: [huge] }).ok, 'too detailed');
  to(room, clock, 'pitch');
  for (const bad of [{ op: 'cue', i: 9 }, { op: 'cue', i: -1 }, { op: 'cue', ask: 0 }, { op: 'react', e: '💩' }]) assert.equal(room.act(sab, bad).ok, false, JSON.stringify(bad));
});

test('a player who leaves mid-match loses by walkover; the game goes on', () => {
  const { room, clock } = make({ format: 'robin', mode: 'deck' }); const ps = humans(room, ['Ana', 'Ben', 'Cy', 'Di']); room.start();
  to(room, clock, 'pitch'); const g = room.game, m = g.m, gone = m.halves[0].pres;
  room.remove(gone);
  assert.equal(g.phase, 'result'); assert(m.result.walkover); assert.equal(m.result.winner, m.a === gone ? 1 : 0);
  run(room, clock); assert.equal(g.phase, 'over'); assert(!g.results().includes(gone));
  assert(ps.length);
});

test('locked until a game of JustSketch Relay is finished; the unlock rule and hint exist', () => {
  assert(def.locked && /JustSketch Relay/.test(def.locked.how));
  assert(UNLOCK_RULES.pitch);
  const room = new BoxRoom('T', def, { clock: new VirtualClock() });
  assert(room.isLocked(def)); assert(!UNLOCK_RULES.pitch.test(room));
  room.played.push({ game: 'sketch' }); assert(UNLOCK_RULES.pitch.test(room));
});

test('partyFit: valid settings for 3–12 players, longer games for more minutes', () => {
  for (let P = 3; P <= 12; P++) for (const M of [8, 15, 25]) {
    const s = def.partyFit({ players: P, minutes: M });
    for (const k of ['pitchSeconds', 'prepSeconds', 'format']) assert(def.fields.find((f) => f.key === k).options.some((o) => o.value === s[k]), `${P}/${M} ${k}=${s[k]}`);
  }
  assert.equal(def.partyFit({ players: 12, minutes: 20 }).format, 'quick');
  // practice: one quick match
  const ps = def.practiceSettings(); assert.equal(ps.maxMatches, 1);
  const { room, clock } = make({ ...ps, format: 'bracket' }); room.addBots(6); room.start(); run(room, clock); assert.equal(room.game.history.length, 1);
});

console.log(`\n${passed} JustPitch tests passed.`);
