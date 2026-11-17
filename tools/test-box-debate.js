'use strict';
// Debate Club rules: played to the end by bots on a virtual clock.  node tools/test-box-debate.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/debate');
const { T, FULL, CALLED, BEST_PICK, ASKED, clean } = def._test;
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const run = (room, clock, until = () => room.game.phase === 'over') => { let i = 0; while (!until() && clock.step()) if (++i > 200000) throw new Error('never ended'); };
// Move the virtual clock forward by ms, running any timers that fall due on the way.
const advance = (clock, ms) => { const to = clock.t + ms; for (;;) { let next = null; for (const e of clock.queue.values()) if (!next || e.at < next.at) next = e; if (!next || next.at > to) break; clock.step(); } clock.t = to; };
const make = (bots, settings = {}, seed = 1) => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  Object.assign(room.settings, settings);
  room.addBots(bots); assert(room.start().ok);
  return { clock, room, g: room.game };
};

test('content: 250+ original topics in two packs, cases, cards, no duplicates', () => {
  const all = [...T.FAMILY, ...T.PARTY];
  assert(all.length >= 250, `only ${all.length} topics`);
  assert(T.FAMILY.length >= 150 && T.PARTY.length >= 80);
  assert.equal(new Set(all).size, all.length, 'duplicate topics');
  for (const t of all) { const p = t.split(' | '); assert(p.length === 1 || p.length === 3, 'bad topic ' + t); assert(p[0].endsWith('?') || p[0].endsWith('.'), 'topic should be a question: ' + t); }
  assert(T.CASES_FAMILY.length >= 25 && T.CASES_PARTY.length >= 10);
  assert(T.CARDS.length >= 50 && T.LEGAL.length >= 8 && T.QUESTIONS.length >= 20);
});

test('bots play a whole game; results() lists everyone best-first', () => {
  const { room, clock, g } = make(6);
  assert.deepEqual(g.results(), []);
  run(room, clock);
  const res = g.results();
  assert.equal(res.length, 6);
  const pts = res.map((id) => g.scores.get(id));
  for (let i = 1; i < pts.length; i++) assert(pts[i - 1] >= pts[i]);
  assert(pts[0] > 0);
  const tv = g.tv(); assert.equal(tv.phase, 'over'); assert(tv.awards.length >= 2, 'awards at the end');
  for (const a of tv.awards) assert(a.title && a.names.length && a.text);
});

test('a full debate walks every phase in order (classic)', () => {
  const { room, clock, g } = make(5, { twists: 'off', debates: 2 });
  const seen = [];
  run(room, clock, () => { if (seen[seen.length - 1] !== g.phase) seen.push(g.phase); return g.phase === 'over'; });
  const first = seen.slice(0, seen.indexOf('result') + 1).filter((x, i, a) => a.indexOf(x) === i);
  assert.deepEqual(first, ['intro', 'prep', 'speech', 'ask', 'write', 'closer', 'vote', 'result']);
});

test('twists: lineup has swap/lawyer/hot; big rooms get a team debate; hot takes run 3 minis', () => {
  const { g } = make(10, { debates: 4, twists: 'mix' }, 7);
  const kinds = g.lineup.map((x) => x.kind);
  assert.equal(kinds[0], 'classic');
  assert(kinds.includes('team'), 'team debate in a big room');
  assert.equal(new Set(g.lineup.map((x) => x.num)).size, 4);
  if (kinds.includes('hot')) assert.equal(kinds.filter((k) => k === 'hot').length, 3);
  const small = make(4, { debates: 4, twists: 'mix' }, 3).g.lineup.map((x) => x.kind);
  assert(!small.includes('team'));
  assert(small.includes('swap') && small.includes('lawyer') && small.includes('hot'));
  assert.equal(small[small.length - 1], 'hot', 'hot takes close the night');
});

test('team debate: two teams, speakers rotate, team members share the points', () => {
  const { room, clock, g } = make(10, { debates: 2, twists: 'mix' }, 7);
  run(room, clock, () => g.d && g.d.kind === 'team' || g.phase === 'over');
  const d = g.d; assert(d && d.kind === 'team');
  assert.equal(d.teams[0].length, 3); assert.equal(d.teams[1].length, 3);
  const speakers = new Set();
  run(room, clock, () => { if (g.phase === 'speech') speakers.add(g.speakerOf(d, d.steps[d.step])); return g.phase === 'result'; });
  assert(speakers.size >= 4, 'several team members speak');
  const r = d.result; assert(r.breakdown.length === 6);
  const t0 = r.breakdown.filter((x) => x.side === 0);
  assert(t0.every((x) => x.share === t0[0].share));
});

test('swap sides flips the labels after the openings, hidden until then', () => {
  let found = null;
  for (let seed = 1; seed < 40 && !found; seed++) { const m = make(5, { debates: 4, twists: 'mix' }, seed); if (m.g.lineup.some((x) => x.kind === 'swap')) found = m; }
  const { room, clock, g } = found;
  run(room, clock, () => g.d && g.d.kind === 'swap' && g.phase === 'speech');
  const before = g.tv(); assert.equal(before.kind, 'classic', 'the swap is a surprise');
  const label = before.podiums[0].label;
  run(room, clock, () => g.phase === 'swap');
  const after = g.tv(); assert.equal(after.kind, 'swap'); assert(after.swapped);
  assert.notEqual(after.podiums[0].label, label);
});

test('lawyer mode: an object is accused, defence vs prosecution', () => {
  let found = null;
  for (let seed = 1; seed < 40 && !found; seed++) { const m = make(5, { debates: 4, twists: 'mix' }, seed); if (m.g.lineup.some((x) => x.kind === 'lawyer')) found = m; }
  const { room, clock, g } = found;
  run(room, clock, () => g.d && g.d.kind === 'lawyer');
  const tv = g.tv();
  assert(tv.topic.case && tv.topic.case.who);
  assert.deepEqual(tv.topic.sides, ['NOT GUILTY', 'GUILTY']);
  assert.deepEqual(tv.podiums.map((p) => p.role), ['Defence', 'Prosecution']);
});

test('family flag: family rooms never get party topics; party pack can', () => {
  const party = new Set([...T.PARTY, ...T.CASES_PARTY.map((c) => c.who)]);
  const { g, room } = make(4, { pack: 'party' });
  room.family = true;
  for (let i = 0; i < 80; i++) { const t = g.topic(i % 3 ? 'classic' : 'lawyer'); assert(!party.has(t.case ? t.case.who : t.sides[0] === 'YES' ? t.q : null)); }
  const m2 = make(4, { pack: 'auto' }); m2.room.family = undefined; // no clear flag: family-safe
  for (let i = 0; i < 80; i++) { const t = m2.g.topic('classic'); if (t.yn) assert(!T.PARTY.includes(t.q)); }
  const m3 = make(4, { pack: 'party' }); let sawParty = false;
  for (let i = 0; i < 80; i++) { const t = m3.g.topic('classic'); if (t.yn && T.PARTY.includes(t.q)) sawParty = true; }
  assert(sawParty);
  const m4 = make(4, { pack: 'auto' }); m4.room.family = false; let saw4 = false;
  for (let i = 0; i < 80; i++) { const t = m4.g.topic('classic'); if (t.yn && T.PARTY.includes(t.q)) saw4 = true; }
  assert(saw4, 'a room without Family mode gets some party topics in the mixed pack');
  const m5 = make(4, { pack: 'family' }); m5.room.family = false;
  for (let i = 0; i < 80; i++) { const t = m5.g.topic('classic'); if (t.yn) assert(!T.PARTY.includes(t.q)); }
});

test('scoring: vote share + win + crowd meter + best line; audience earns for backing the winner', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 2 });
  Object.assign(room.settings, { twists: 'off', debates: 2 });
  const ps = ['Ana', 'Ben', 'Cy', 'Di', 'Ed'].map((n) => room.join(n).player);
  for (const p of ps) p.sockets = 1;
  room.start(); const g = room.game, d = g.d;
  const [a, b] = d.ids.map((id) => room.get(id)), aud = ps.filter((p) => !d.ids.includes(p.id));
  assert.equal(aud.length, 3);
  const until = (ph) => run(room, clock, () => g.phase === ph);
  until('prep');
  assert(room.act(aud[0], { op: 'ask', text: 'Why though' }).ok);
  assert(room.act(aud[1], { op: 'ask', text: 'What about ducks?' }).ok);
  until('speech');
  // reactions for side 0 (the first speaker)
  assert.equal(g.speakerOf(d, d.steps[d.step]), a.id);
  for (const p of aud) { assert(room.act(p, { op: 'react', e: 'clap' }).ok); advance(clock, 300); }
  assert.equal(d.meter[0], 3);
  assert(room.act(a, { op: 'done' }).ok);
  run(room, clock, () => g.phase === 'speech' && g.speakerOf(d, d.steps[d.step]) === b.id);
  room.act(aud[0], { op: 'react', e: 'tomato' });
  assert.equal(d.meter[1], -1);
  until('ask');
  assert.equal(g.tv().choices.length, 2);
  for (const p of aud) assert(room.act(p, { op: 'qvote', i: 0 }).ok);
  run(room, clock, () => g.phase === 'speech');
  assert(d.question && d.question.text);
  const asker = aud.find((p) => d.asks.get(p.id) === d.question.text);
  assert.equal(g.scores.get(asker.id), ASKED);
  until('write');
  assert(room.act(a, { op: 'closer', text: 'Soup is a state of mind.' }).ok);
  assert(room.act(b, { op: 'closer', text: 'Cereal is breakfast, end of story.' }).ok);
  until('vote');
  const segs = g.view(aud[0]).segs; assert(segs.length >= 6);
  const closeA = segs.find((s) => s.stage === 'close' && s.side === 0);
  assert.equal(closeA.text, 'Soup is a state of mind.');
  room.act(aud[0], { op: 'vote', side: 0 }); room.act(aud[1], { op: 'vote', side: 0 }); room.act(aud[2], { op: 'vote', side: 1 });
  for (const p of aud) room.act(p, { op: 'best', i: closeA.i });
  const before = new Map(ps.map((p) => [p.id, g.scores.get(p.id)]));
  until('result');
  const r = d.result;
  assert.deepEqual(r.votes, [2, 1]); assert.equal(r.winner, 0);
  const rowA = r.breakdown.find((x) => x.id === a.id), rowB = r.breakdown.find((x) => x.id === b.id);
  assert.equal(rowA.share, Math.round(FULL.share * 2 / 3)); assert.equal(rowA.win, FULL.win);
  assert.equal(rowA.crowd, FULL.meter); assert.equal(rowB.crowd, 0); // a tomato never gives a bonus
  assert.equal(rowA.best, FULL.best);
  assert.equal(g.scores.get(a.id) - before.get(a.id), rowA.total);
  assert.equal(g.scores.get(b.id) - before.get(b.id), Math.round(FULL.share / 3));
  assert.equal(g.scores.get(aud[0].id) - before.get(aud[0].id), CALLED + BEST_PICK);
  assert.equal(g.scores.get(aud[2].id) - before.get(aud[2].id), BEST_PICK);
  assert.equal(g.stats.get(a.id).bestLines, 1);
});

test('phone input is validated', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 4 });
  const ps = ['Ana', 'Ben', 'Cy', 'Di'].map((n) => room.join(n).player); for (const p of ps) p.sockets = 1;
  room.start(); const g = room.game, d = g.d;
  const deb = room.get(d.ids[0]), other = room.get(d.ids[1]), aud = ps.find((p) => !d.ids.includes(p.id));
  for (const bad of [{}, { op: 'nope' }, { op: 'react', e: 'poop' }, { op: 'vote', side: 0 }, { op: 'best', i: 0 }, { op: 'qvote', i: 0 }, { op: 'closer', text: 'hi there' }, { op: 'card', i: 0 }])
    assert.equal(room.act(aud, bad).ok, false, JSON.stringify(bad));
  assert.equal(room.act(aud, { op: 'ask', text: 'hm' }).ok, false);
  assert.equal(room.act(aud, { op: 'ask', text: 12 }).ok, false);
  assert.equal(room.act(deb, { op: 'ask', text: 'Can I ask myself?' }).ok, false);
  assert.equal(room.act(deb, { op: 'react', e: 'clap' }).ok, false);
  assert.equal(room.act(aud, { op: 'done' }).ok, false);
  run(room, clock, () => g.phase === 'speech');
  const speaker = room.get(g.speakerOf(d, d.steps[d.step]));
  const silent = speaker === deb ? other : deb;
  assert.equal(room.act(silent, { op: 'done' }).ok, false, 'only the speaker can pass the mic');
  assert.equal(room.act(silent, { op: 'card', i: 0 }).ok, false);
  for (const i of [-1, 3, 1.5, 'x', null]) assert.equal(room.act(speaker, { op: 'card', i }).ok, false);
  assert(room.act(speaker, { op: 'card', i: 0 }).ok);
  assert.equal(room.act(speaker, { op: 'card', i: 0 }).ok, false, 'a card plays once');
  assert(g.tv().card && g.tv().card.title);
  // reaction rate limit: taps closer than 250 ms are not counted
  const m0 = d.meter[speaker === room.get(d.teams[0][0]) ? 0 : 1];
  room.act(aud, { op: 'react', e: 'clap' }); room.act(aud, { op: 'react', e: 'clap' }); room.act(aud, { op: 'react', e: 'clap' });
  const side = g.sideOf(d, speaker.id);
  assert.equal(d.meter[side] - m0, 1);
  for (let i = 0; i < 60; i++) { advance(clock, 300); room.act(aud, { op: 'react', e: 'laugh' }); if (g.phase !== 'speech') break; }
  assert(d.segs[d.segs.length - 1].counted.get(aud.id) <= 30, 'capped per speech');
  // long / hostile text is cleaned
  assert.equal(clean('<b>hi</b>\n\tthere', 90), 'bhi/b there');
  assert.equal(clean('x'.repeat(200), 90).length, 90);
  run(room, clock, () => g.phase === 'vote');
  for (const s of [2, -1, 'a', null]) assert.equal(room.act(aud, { op: 'vote', side: s }).ok, false);
  for (const i of [99, -1, 'x']) assert.equal(room.act(aud, { op: 'best', i }).ok, false);
  assert.equal(room.act(deb, { op: 'vote', side: 0 }).ok, false, 'debaters do not vote');
  assert(room.act(aud, { op: 'vote', side: 1 }).ok);
});

test('views: debaters get cards and a side, the audience never sees them; TV holds no secrets', () => {
  const { room, clock, g } = make(5, { twists: 'off' });
  run(room, clock, () => g.phase === 'prep');
  const d = g.d, deb = room.get(d.ids[0]), aud = room.list().find((p) => !d.ids.includes(p.id));
  const vd = g.view(deb), va = g.view(aud);
  assert.equal(vd.role, 'debater'); assert.equal(vd.cards.length, 3); assert(vd.myLabel);
  assert.equal(va.role, 'audience'); assert.equal(va.cards, null); assert(va.canAsk);
  const tv = JSON.stringify(g.tv());
  assert(!tv.includes(vd.cards[0].hint), 'TV does not show unplayed cards');
});

test('a debater leaving mid-speech moves the debate on; late joiners join the audience', () => {
  const { room, clock, g } = make(5, { twists: 'off' });
  run(room, clock, () => g.phase === 'speech');
  const d = g.d, step = d.step, sp = g.speakerOf(d, d.steps[step]);
  room.remove(sp);
  assert(d.step > step || g.d !== d);
  const late = room.join('Zed').player;
  assert.equal(g.view(late).role, 'audience');
  run(room, clock);
  assert.equal(g.phase, 'over');
  assert(g.results().includes(late.id));
});

test('host skip (next) runs through to the end', () => {
  const { room, g } = make(4);
  let i = 0; while (g.phase !== 'over' && i++ < 500) room.hostAction({ type: 'next' });
  assert.equal(g.phase, 'over');
  assert.equal(g.results().length, 4);
});

test('many seeds and sizes finish cleanly', () => {
  for (const [n, seed] of [[3, 1], [4, 5], [8, 9], [14, 3], [20, 11]]) {
    const { room, clock, g } = make(n, { debates: 4, speech: 'short' }, seed);
    run(room, clock);
    assert.equal(g.results().length, n);
  }
});

console.log(`\n${passed} Debate Club tests passed.`);
