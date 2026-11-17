'use strict';
// Emoji Charades: answer matching, secrecy of the answer, emoji validation, scoring,
// a giver leaving mid-round, the TV's skip button, and full bot games (3 and 100 players).
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/emoji');
const C = require('../box/games/emoji-content');
const { judge, pattern } = def._test;

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function mk({ bots = 0, humans = [], settings = {}, seed = 7, humansFirst = true } = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  Object.assign(room.settings, settings);
  const ps = {};
  if (!humansFirst) room.addBots(bots);
  for (const n of humans) ps[n] = room.join(n).player;
  if (humansFirst) room.addBots(bots);
  return { room, clock, ps };
}
const until = (room, clock, fn, limit = 200000) => { let i = 0; while (!fn() && clock.step()) if (++i > limit) throw new Error('stuck in ' + room.game.phase); return fn(); };
const runOut = (room, clock) => until(room, clock, () => room.game.phase === 'over', 2000000);
const wait = (clock, ms) => { clock.t += ms; };
const secretsOf = (g) => g.stages.flatMap((s) => [s.answer, ...s.options]).filter(Boolean).map((a) => a.text);

test('Matching: case, punctuation, articles, plurals and small typos are forgiven', () => {
  const ok = (g, a, alts) => assert.equal(judge(g, a, alts), 'correct', `${g} → ${a}`);
  ok('the lion king', 'The Lion King'); ok('LION KING!!!', 'The Lion King'); ok('lion kng', 'The Lion King');
  ok('monsters inc', 'Monsters, Inc.'); ok('Monsters Inc', 'Monsters, Inc.'); ok('beauty & the beast', 'Beauty and the Beast');
  ok('spiderman', 'Spider-Man'); ok('spider man', 'Spider-Man'); ok('ratatouile', 'Ratatouille'); ok('kung fu pnda', 'Kung Fu Panda');
  ok('hot dogs', 'Hot Dog'); ok('a hot dog', 'Hot Dog'); ok('up', 'Up'); ok('Pinata', 'Piñata'); ok('ill be back', "I'll Be Back");
  ok('orca', 'Killer Whale', ['orca']); ok('mailman', 'Mail Carrier', ['mailman', 'postman']);
});
test('Matching: clearly wrong guesses are rejected; near misses are "close"', () => {
  assert.equal(judge('banana', 'The Lion King'), 'wrong');
  assert.equal(judge('cat', 'Catfish'), 'wrong');
  assert.equal(judge('dog', 'Up'), 'wrong');
  assert.equal(judge('', 'Up'), 'wrong');
  assert.equal(judge('the', 'The Moon'), 'wrong', 'articles alone are nothing');
  assert.equal(judge('lion', 'The Lion King'), 'close');
  assert.equal(judge('ratatoulle', 'Ratatouille'), 'correct');
  assert.equal(judge('ratatoui', 'Ratatouille'), 'close');
  assert.equal(judge('spider', 'Spider-Man'), 'close');
});
test('Hints: word shapes first, then first letters (never the whole answer)', () => {
  assert.equal(pattern('The Lion King', 0), null);
  assert.deepEqual(pattern('The Lion King', 1), ['___', '____', '____']);
  assert.deepEqual(pattern('Spider-Man', 2), ['S_____-M__']);
  assert.deepEqual(pattern('Monsters, Inc.', 2), ['M_______,', 'I__.']);
});
test('Content: 250+ answers in 13 categories, every bot clue uses keyboard emojis, ~400+ emojis', () => {
  assert(C.ANSWERS.length >= 250, 'answers: ' + C.ANSWERS.length);
  assert.equal(new Set(C.ANSWERS.map((a) => a.cat)).size, 13);
  for (const k of ['holidays', 'office', 'classics', 'travel']) { const n = C.ANSWERS.filter((a) => a.cat === k).length; assert(n >= 40, k + ' pack: ' + n); }
  assert(C.ALLOWED.size >= 400, 'emojis: ' + C.ALLOWED.size);
  for (const a of C.ANSWERS) { assert(a.clue.length, a.text + ' has a clue'); for (const e of a.clue) assert(C.ALLOWED.has(e), `${a.text}: ${e} is on the keyboard`); }
  assert.equal(new Set(C.ANSWERS.map((a) => a.text.toLowerCase())).size, C.ANSWERS.length, 'no duplicate answers');
});
test('Client: the phone keyboard is an exact copy of the server’s emoji list', () => {
  const src = fs.readFileSync(path.join(__dirname, '../public/box/games/emoji.js'), 'utf8');
  const sandbox = { BOX: { games: {}, esc: (s) => String(s), timer: () => '' }, localStorage: { getItem: () => null, setItem() {} }, document: {}, setTimeout, console };
  vm.runInNewContext(src, sandbox);
  const g = sandbox.BOX.games.emoji;
  assert(g && g.tv && g.phone && g.fx, 'client registered');
  assert.deepEqual(JSON.parse(JSON.stringify(g._kb)), C.KEYBOARD_TEXT);
});

test('Secrets: the answer never reaches the TV or the guessers before the reveal', () => {
  const { room, clock, ps } = mk({ bots: 4, humans: ['Ann', 'Bo'] }); // Ann gives first, Bo guesses
  room.start();
  const g = room.game;
  assert.equal(g.phase, 'pick'); assert.equal(g.stages[0].giver, ps.Ann.id);
  const check = () => {
    const tv = JSON.stringify(room.tvState()), bo = JSON.stringify(room.playerState(ps.Bo));
    for (const t of secretsOf(g)) { assert(!tv.includes(`"${t}"`), 'TV leaks ' + t); if (!g.stages.some((s) => s.solvers.some((x) => x.id === ps.Bo.id))) assert(!bo.includes(`"${t}"`), 'guesser leaks ' + t); }
    for (const s of room.tvState().state.stages) assert.equal(s.answer, null);
  };
  check();
  const annView = room.playerState(ps.Ann).state;
  assert.equal(annView.role, 'giver'); assert.equal(annView.giver.options.length, 3, 'the giver sees three choices');
  assert(room.act(ps.Ann, { op: 'pick', i: 1 }).ok);
  assert.equal(g.phase, 'clue');
  assert.equal(room.playerState(ps.Ann).state.giver.answer, g.stages[0].answer.text, 'the giver sees their secret');
  assert(room.act(ps.Ann, { op: 'emoji', e: '🦁' }).ok);
  check();
  until(room, clock, () => g.stages[0].hint >= 2 || g.phase !== 'clue'); // hints out, still secret
  if (g.phase === 'clue') check();
  until(room, clock, () => g.phase === 'reveal');
  assert.equal(room.tvState().state.stages[0].answer, g.stages[0].answer.text, 'revealed at the end');
});

test('Validation: only keyboard emojis, sensible word breaks, a clue limit; only the giver builds the clue', () => {
  const { room, ps } = mk({ humans: ['Ann', 'Bo', 'Cy'] });
  room.start(); room.act(ps.Ann, { op: 'pick', i: 0 });
  const g = room.game, st = g.stages[0];
  for (const e of ['abc', '<b>', '', '🫠', '🦁🦁', 'lion', '││']) assert.equal(room.act(ps.Ann, { op: 'emoji', e }).ok, false, 'rejects ' + e);
  assert.equal(room.act(ps.Ann, { op: 'sep' }).ok, false, 'no word break first');
  assert(room.act(ps.Ann, { op: 'emoji', e: '❄️' }).ok);
  assert(room.act(ps.Ann, { op: 'sep' }).ok);
  assert.equal(room.act(ps.Ann, { op: 'sep' }).ok, false, 'no double word break');
  assert.equal(room.act(ps.Bo, { op: 'emoji', e: '🦁' }).ok, false, 'guessers can’t add emojis');
  assert.equal(room.act(ps.Ann, { op: 'guess', text: st.answer.text }).ok, false, 'the giver can’t guess');
  assert(room.act(ps.Ann, { op: 'undo' }).ok); assert.equal(st.clue.length, 1);
  while (st.clue.length < 20) assert(room.act(ps.Ann, { op: 'emoji', e: '🐶' }).ok);
  assert.equal(room.act(ps.Ann, { op: 'emoji', e: '🐶' }).ok, false, 'clue limit');
  assert.equal(room.act(ps.Bo, { op: 'guess', text: 'x'.repeat(500) }).result, 'wrong');
  assert(g.myGuesses.get(ps.Bo.id).every((q) => q.text.length <= 40), 'guess length capped');
  assert.equal(room.act(ps.Bo, { op: 'guess', text: 'again' }).ok, false, 'one guess a second');
  assert.equal(room.act(ps.Cy, { op: 'nonsense' }).ok, false);
});

test('Scoring: first right answer earns most, fewer emojis earn more, and the giver scores', () => {
  const { room, clock, ps } = mk({ humans: ['Ann', 'Bo', 'Cy', 'Di'] });
  room.start(); room.act(ps.Ann, { op: 'pick', i: 0 });
  const g = room.game, st = g.stages[0], ans = st.answer.text;
  room.act(ps.Ann, { op: 'emoji', e: '🦁' });
  const wrong = room.act(ps.Di, { op: 'guess', text: 'zzzz qqqq' });
  assert.equal(wrong.result, 'wrong'); assert.equal(g.ticker.length, 1, 'wrong guess on the ticker');
  const b = room.act(ps.Bo, { op: 'guess', text: ans.toUpperCase() });
  assert.equal(b.result, 'correct'); assert.equal(b.pts, 750, '500 × 1.5 for a one-emoji clue');
  assert.equal(room.act(ps.Bo, { op: 'guess', text: ans }).ok, false, 'can’t score twice');
  const c = room.act(ps.Cy, { op: 'guess', text: ans + '!' });
  assert.equal(c.pts, 600, 'second place earns less');
  wait(clock, 1000);
  const d = room.act(ps.Di, { op: 'guess', text: ans });
  assert.equal(d.pts, 510, 'third place');
  assert(g.ticker.every((t) => judge(t.text, ans, st.answer.alts) === 'wrong'), 'the ticker never shows right answers');
  until(room, clock, () => g.phase === 'reveal');
  assert.equal(st.giverPts, 670, 'giver: 3 solvers ×1.5, fast bonus and everyone-got-it bonus');
  assert.equal(g.scores.get(ps.Ann.id), 670);
  // Next round Bo gives with a long clue: the same first guess earns less.
  until(room, clock, () => g.phase === 'pick' && g.round === 2);
  assert.equal(g.stages[0].giver, ps.Bo.id, 'the Clue Giver rotates');
  room.act(ps.Bo, { op: 'pick', i: 0 });
  for (const e of ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻']) room.act(ps.Bo, { op: 'emoji', e });
  assert(room.act(ps.Bo, { op: 'hint' }).ok, 'the giver can buy a hint');
  assert.equal(g.scores.get(ps.Bo.id), 750 - 75, 'hint costs the giver');
  const a = room.act(ps.Ann, { op: 'guess', text: g.stages[0].answer.text });
  assert.equal(a.pts, 430, '500 × 1.0 (7 emojis) × 0.85 (one hint), rounded');
});

test('A Clue Giver leaving mid-round doesn’t stall the game', () => {
  const { room, clock, ps } = mk({ bots: 3, humans: ['Ann', 'Bo'] });
  room.start(); room.act(ps.Ann, { op: 'pick', i: 0 }); room.act(ps.Ann, { op: 'emoji', e: '🦁' });
  const g = room.game;
  room.remove(ps.Ann.id);
  assert.equal(g.phase, 'reveal', 'the only stage lost its giver: straight to the reveal');
  until(room, clock, () => g.round === 2 && g.phase === 'pick');
  assert(g.stages.every((s) => s.giver !== ps.Ann.id));
  // Leaving during the pick phase too.
  const giver = room.get(g.stages[0].giver); room.remove(giver.id);
  assert.notEqual(g.phase, 'pick');
  runOut(room, clock);
  assert.equal(g.phase, 'over');
});

test('Skip ahead (TV): pick → clue → reveal → next round → … → over', () => {
  const { room } = mk({ bots: 4, humans: ['Ann'], settings: { maxRounds: 5 } });
  room.start();
  const g = room.game, seen = [];
  for (let i = 0; i < 40 && g.phase !== 'over'; i++) { seen.push(g.phase); assert(room.hostAction({ type: 'next' }).ok); }
  assert.equal(g.phase, 'over');
  assert.deepEqual(seen.slice(0, 4), ['pick', 'clue', 'reveal', 'pick']);
  assert.equal(g.round, 5);
});

test('Two stages run in parallel; one guess box solves whichever it matches', () => {
  const { room, ps } = mk({ humans: ['Ann', 'Bo', 'Cy', 'Di', 'Ed', 'Flo'], settings: { stages: 2 } });
  room.start();
  const g = room.game;
  assert.equal(g.stages.length, 2);
  const [s1, s2] = g.stages, g1 = room.get(s1.giver), g2 = room.get(s2.giver);
  room.act(g1, { op: 'pick', i: 0 }); assert.equal(g.phase, 'pick', 'waits for both givers');
  room.act(g2, { op: 'pick', i: 0 }); assert.equal(g.phase, 'clue');
  assert.equal(room.act(g1, { op: 'guess', text: s2.answer.text }).ok, false, 'givers don’t guess this round');
  const guesser = room.list().find((p) => p.id !== g1.id && p.id !== g2.id);
  const r = room.act(guesser, { op: 'guess', text: s2.answer.text });
  assert.equal(r.result, 'correct'); assert.equal(s2.solvers[0].id, guesser.id); assert.equal(s1.solvers.length, 0);
  assert.equal(room.tvState().state.stages.length, 2);
});

for (const n of [3, 20, 100]) {
  test(`Full bot game with ${n} players reaches the end with awards`, () => {
    const { room, clock, ps } = mk({ bots: n - 1, humans: ['Ann'], humansFirst: false, seed: n });
    assert.equal(room.players.size, n);
    room.start();
    const g = room.game; let maxStages = 0, solved = 0;
    while (g.phase !== 'over') {
      if (!clock.step()) throw new Error('no timer left in ' + g.phase);
      maxStages = Math.max(maxStages, g.stages.length);
      if (g.phase === 'clue' || g.phase === 'pick') { const tv = JSON.stringify(room.tvState()); for (const t of secretsOf(g)) assert(!tv.includes(`"${t}"`)); }
      if (g.phase === 'reveal') solved = Math.max(solved, ...g.stages.map((s) => s.solvers.length));
    }
    assert(solved > 0, 'bots solved some clues');
    assert(g.round >= 1 && g.round <= g.totalRounds);
    if (n === 100) assert.equal(maxStages, 3, '3 stages for 100 players');
    if (n === 3) assert.equal(maxStages, 1);
    const tv = room.tvState().state;
    assert.equal(tv.phase, 'over'); assert(tv.awards.length >= 2, 'awards: ' + tv.awards.map((a) => a.title));
    assert(room.playerState(ps.Ann).state.final.length > 0);
  });
}


test('Family-friendly answers: grown-up titles are never offered when the host turns it on', () => {
  assert(C.ANSWERS.filter((a) => !a.family).length >= 8, 'some answers are flagged');
  for (const cat of ['all', 'movies', 'party']) {
    const { room, clock } = mk({ bots: 6, settings: { family: true, category: cat, maxRounds: 20, turns: 3 }, seed: 11 });
    room.start();
    const seen = new Set();
    while (room.game.phase !== 'over') { for (const st of room.game.stages) for (const o of st.options) seen.add(o.text); if (!clock.step()) break; }
    assert(seen.size > 0);
    for (const t of seen) assert(!C.GROWN_UP.has(t), cat + ': offered ' + t);
  }
});

test('Room Family Mode (TV) forces family answers even when the host picked "Everything"', () => {
  for (const cat of ['all', 'movies', 'party']) {
    const { room, clock } = mk({ bots: 6, settings: { family: false, category: cat, maxRounds: 20, turns: 3 }, seed: 11 });
    room.family = true; room.start();
    const seen = new Set();
    while (room.game.phase !== 'over') { for (const st of room.game.stages) for (const o of st.options) seen.add(o.text); if (!clock.step()) break; }
    assert(seen.size > 0);
    for (const t of seen) assert(C.ANSWERS.find((a) => a.text === t).family, cat + ': offered ' + t);
  }
});
test('New packs (Holidays, Office-safe, Classics, Travel) are family-safe and play end to end', () => {
  for (const cat of ['holidays', 'office', 'classics', 'travel']) {
    assert(def.fields.find((f) => f.key === 'category').options.some((o) => o.value === cat), cat + ' in settings');
    if (cat !== 'holidays') assert(C.ANSWERS.filter((a) => a.cat === cat).every((a) => a.family), cat + ' all family');
    const { room, clock } = mk({ bots: 5, settings: { category: cat, maxRounds: 5 }, seed: 3 });
    room.start();
    const seen = new Set();
    while (room.game.phase !== 'over') { for (const st of room.game.stages) for (const o of st.options) seen.add(o.cat); if (!clock.step()) break; }
    assert.equal(room.game.phase, 'over', cat + ' finished');
    assert.deepEqual([...seen], [cat], cat + ' only offers its own answers');
  }
});

test('The final round counts double; results() lists players best-first at the end', () => {
  const { room, clock, ps } = mk({ humans: ['Ann', 'Bo', 'Cy'], settings: { maxRounds: 3 } });
  room.start();
  const g = room.game;
  assert.deepEqual(g.results(), []);
  until(room, clock, () => g.round === 3 && g.phase === 'pick');
  assert.equal(room.tvState().state.lastRound, true);
  const giver = room.get(g.stages[0].giver), guesser = [ps.Ann, ps.Bo, ps.Cy].find((p) => p.id !== giver.id);
  room.act(giver, { op: 'pick', i: 0 });
  room.act(giver, { op: 'emoji', e: '🦁' });
  const before = g.scores.get(guesser.id);
  const r = room.act(guesser, { op: 'guess', text: g.stages[0].answer.text });
  assert.equal(r.result, 'correct');
  assert.equal(r.pts, 750 * 2, 'first solver with one emoji: 500 × 1.5, doubled');
  assert.equal(g.scores.get(guesser.id) - before, 1500);
  runOut(room, clock);
  const order = g.results();
  assert.equal(order.length, 3);
  assert.deepEqual(order, g.standings().map((x) => x.id));
});

console.log(`\nEmoji Charades: ${passed} tests passed`);
