'use strict';
// Hot Take Trivia rules: played to the end by bots on a virtual clock.  node tools/test-box-trivia.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/trivia');
const T = def._test;
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const run = (room, clock, until) => { let i = 0; while (!until() && clock.step()) if (++i > 200000) throw new Error('never got there'); };
function setup(settings = {}, bots = 2) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 7 });
  const a = room.join('Ana').player, b = room.join('Ben').player;
  if (bots) room.addBots(bots);
  Object.assign(room.settings, { showIntro: false, ...settings });
  assert(room.start().ok);
  return { clock, room, g: room.game, a, b };
}
const toPhase = (s, ph) => run(s.room, s.clock, () => s.g.phase === ph);

test('at least 400 original questions, every one well-formed, across the nine core categories and four packs', () => {
  let n = 0; const seen = new Set();
  for (const c of T.CATEGORIES) {
    const list = T.Q[c.key]; assert(list.length >= 25, c.key + ' has enough questions');
    for (const q of list) {
      n++; assert.equal(q.length, 6); assert([1, 2, 3].includes(q[0]));
      assert.equal(new Set(q.slice(2)).size, 4, 'four different answers: ' + q[1]);
      assert(!seen.has(q[1]), 'no duplicate: ' + q[1]); seen.add(q[1]);
    }
  }
  assert(n >= 400, `${n} questions`);
  assert.equal(T.CATEGORIES.length, 13);
  for (const k of ['holiday', 'office', 'classics', 'travel']) { assert(T.Q[k].length >= 40, k + ' pack size'); assert(T.Q[k].filter((q) => q[0] < 3).length >= 30, k + ' has plenty of Family-level questions'); }
  for (const f of def.fields) assert(f.options.some((o) => o.value === def.defaults[f.key]), 'default for ' + f.key);
  for (const k of ['holiday', 'office', 'classics', 'travel']) assert(def.fields.find((f) => f.key === 'cats').options.some((o) => o.value === k), k + ' is a Categories option');
});

test('bots play a whole game (all lengths); results() lists everyone best-first', () => {
  for (const questions of [8, 12, 16]) {
    const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: questions });
    room.addBots(6); room.settings.showIntro = false; room.settings.questions = questions; assert(room.start().ok);
    const kinds = [];
    run(room, clock, () => { if (room.game.r && kinds[room.game.n - 1] == null) kinds[room.game.n - 1] = room.game.r.kind; return room.game.phase === 'over'; });
    assert.equal(room.game.n, questions);
    assert.equal(kinds[questions - 1], 'allin', 'the last question is All In');
    assert.equal(kinds.filter((k) => k === 'hot').length, T.hotSeats(questions).length, 'Hot Seat rounds');
    const res = room.game.results(); assert.equal(res.length, 6);
    const pts = res.map((id) => room.game.scores.get(id)); assert.deepEqual(pts, pts.slice().sort((x, y) => y - x));
    const tv = room.game.tv(); assert(tv.final && tv.final.awards.length >= 1, 'awards at the end');
    assert(room.game.view(room.list()[0]).final);
  }
});

test('categories rotate and stick to the setting; Family mode skips the hardest questions', () => {
  const s = setup({ questions: 16, cats: 'all' }, 4); const cats = [];
  run(s.room, s.clock, () => { if (s.g.r && cats[s.g.n - 1] == null) cats[s.g.n - 1] = s.g.r.cat; return s.g.phase === 'over'; });
  assert(new Set(cats.slice(0, 9)).size === 9, 'the first nine questions are nine different categories');
  for (let i = 1; i < cats.length; i++) assert.notEqual(cats[i], cats[i - 1], 'no category twice in a row');
  const f = setup({ questions: 16, cats: 'science', family: true }, 4);
  run(f.room, f.clock, () => { if (f.g.r) { assert.equal(f.g.r.cat, 'science'); assert(f.g.r.q.diff < 3); } return f.g.phase === 'over'; });
});

test('scoring: right answers win 100 × bet plus speed; wrong answers lose 50 × bet (never below zero)', () => {
  const s = setup({ questions: 8, seconds: 20 }, 0);
  toPhase(s, 'ask'); const g = s.g, c = g.r.q.correct;
  assert.equal(g.room.act(s.a, { op: 'answer', a: c, bet: 3 }).ok, true);
  assert.equal(g.room.act(s.b, { op: 'answer', a: (c + 1) % 4, bet: 2 }).ok, true);
  toPhase(s, 'reveal');
  const ra = g.r.result.rows.find((x) => x.id === s.a.id), rb = g.r.result.rows.find((x) => x.id === s.b.id);
  assert.equal(ra.gained, 300 + T.SPEED_MAX, 'instant right answer: 3 × 100 + full speed bonus');
  assert.equal(rb.gained, 0, 'wrong with 0 points: cannot go below zero');
  // Next question: B now has points to lose.
  toPhase(s, 'ask'); const c2 = g.r.q.correct;
  g.room.act(s.a, { op: 'answer', a: (c2 + 1) % 4, bet: 2 });
  s.room.after(10000, () => {});
  run(s.room, s.clock, () => g.room.now() - g.r.openedAt >= 10000 || g.phase !== 'ask');
  g.room.act(s.b, { op: 'answer', a: c2, bet: 1 });
  toPhase(s, 'reveal');
  assert.equal(g.r.result.rows.find((x) => x.id === s.a.id).gained, -100, 'wrong at 2×: −100');
  const sp = g.r.result.rows.find((x) => x.id === s.b.id);
  assert(sp.gained >= 100 + 20 && sp.gained <= 100 + 26, 'half the time left: about half the speed bonus (' + sp.gained + ')');
  view: { const v = g.view(s.a); assert.equal(v.mine.right, false); assert.equal(v.mine.gained, -100); }
});

test('streaks: from three right in a row, +50 each', () => {
  const s = setup({ questions: 16 }, 0); const g = s.g; const gains = [];
  for (let k = 0; k < 4; k++) {
    toPhase(s, 'ask');
    if (g.r.kind !== 'normal') { k--; toPhase(s, 'reveal'); continue; }
    g.room.act(s.a, { op: 'answer', a: g.r.q.correct, bet: 1 }); g.room.act(s.b, { op: 'answer', a: (g.r.q.correct + 1) % 4, bet: 1 });
    toPhase(s, 'reveal'); gains.push(g.r.result.rows.find((x) => x.id === s.a.id));
  }
  assert.deepEqual(gains.map((x) => x.streakBonus), [0, 0, T.STREAK_BONUS, T.STREAK_BONUS]);
  assert.equal(g.stats.get(s.a.id).best, 4);
});

test('Family mode: wrong answers cost nothing', () => {
  const s = setup({ questions: 8, family: true }, 0); const g = s.g;
  g.scores.set(s.a.id, 500); toPhase(s, 'ask');
  g.room.act(s.a, { op: 'answer', a: (g.r.q.correct + 1) % 4, bet: 3 }); g.room.act(s.b, { op: 'answer', a: g.r.q.correct, bet: 1 });
  toPhase(s, 'reveal'); assert.equal(g.scores.get(s.a.id), 500);
});

test('Hot Seat: the seat answers for double stakes, everyone else bets on them', () => {
  const s = setup({ questions: 8 }, 1); const g = s.g;
  run(s.room, s.clock, () => g.r && g.r.kind === 'hot' && g.phase === 'ask');
  const seat = g.r.seat; assert(seat, 'someone is in the seat');
  assert(!g.room.get(seat).bot, 'a real person gets the Hot Seat');
  const seatP = g.room.get(seat), other = seat === s.a.id ? s.b : s.a, bot = g.room.list().find((p) => p.bot);
  assert.equal(g.room.act(other, { op: 'answer', a: 0, bet: 1 }).ok, false, 'only the seat answers');
  assert.equal(g.room.act(seatP, { op: 'predict', right: true, bet: 1 }).ok, false, 'the seat cannot predict');
  assert.equal(g.room.act(other, { op: 'predict', right: 'yes', bet: 1 }).ok, false);
  assert.equal(g.room.act(other, { op: 'predict', right: true, bet: 3 }).ok, true);
  assert.equal(g.room.act(other, { op: 'predict', right: false, bet: 3 }).ok, false, 'predictions lock');
  const before = g.scores.get(seat);
  assert.equal(g.room.act(seatP, { op: 'answer', a: g.r.q.correct, bet: 2 }).ok, true);
  void bot; toPhase(s, 'reveal');
  const row = g.r.result.rows.find((x) => x.id === seat);
  assert(row.gained >= 2 * 200, 'double stakes for the seat');
  assert.equal(g.scores.get(seat), before + row.gained);
  const pr = g.r.result.hot.preds.find((x) => x.id === other.id);
  assert.equal(pr.ok, true); assert.equal(pr.gained, T.PRED_WIN * 3);
  assert.equal(g.view(other).mine.kind, 'pred');
});

test('All In: wager a share of your points (at least 100 to play with), then answer', () => {
  const s = setup({ questions: 8 }, 0); const g = s.g;
  run(s.room, s.clock, () => g.r && g.r.kind === 'allin' && g.phase === 'wager');
  g.scores.set(s.a.id, 400); g.scores.set(s.b.id, 30);
  assert.equal(g.view(s.a).text, '', 'the question stays hidden while wagering');
  for (const bad of [{ op: 'wager', pct: 101 }, { op: 'wager', pct: -1 }, { op: 'wager', pct: 12.5 }, { op: 'wager', pct: '50' }, { op: 'answer', a: 0, bet: 1 }]) assert.equal(g.room.act(s.a, bad).ok, false, JSON.stringify(bad));
  assert.equal(g.room.act(s.a, { op: 'wager', pct: 50 }).ok, true);
  assert.equal(g.room.act(s.b, { op: 'wager', pct: 100 }).ok, true);
  toPhase(s, 'ask');
  assert.equal(g.r.stakes.get(s.a.id), 200); assert.equal(g.r.stakes.get(s.b.id), 100, 'under 100 points: wager up to 100');
  g.room.act(s.a, { op: 'answer', a: (g.r.q.correct + 1) % 4 }); g.room.act(s.b, { op: 'answer', a: g.r.q.correct });
  toPhase(s, 'over');
  assert.equal(g.scores.get(s.a.id), 200); assert.equal(g.scores.get(s.b.id), 130);
  assert.deepEqual(g.results(), [s.a.id, s.b.id]);
});

test('phone input is validated', () => {
  const s = setup({}, 2); const g = s.g;
  toPhase(s, 'intro');
  assert.equal(g.room.act(s.a, { op: 'answer', a: 0, bet: 1 }).ok, false, 'not before the question opens');
  run(s.room, s.clock, () => g.phase === 'ask' && g.r.kind === 'normal');
  for (const bad of [{ op: 'answer', a: 4, bet: 1 }, { op: 'answer', a: -1, bet: 1 }, { op: 'answer', a: 1.5, bet: 1 }, { op: 'answer', a: '1', bet: 1 }, { op: 'answer', a: 1, bet: 4 }, { op: 'answer', a: 1, bet: 0 }, { op: 'answer', a: 1, bet: '3' }, { op: 'answer', a: 1 }, { op: 'predict', right: true, bet: 1 }, { op: 'wager', pct: 50 }, { op: 'nope' }, {}, null]) assert.equal(g.room.act(s.a, bad).ok, false, JSON.stringify(bad));
  assert.equal(g.room.act(s.a, { op: 'answer', a: 2, bet: 2 }).ok, true);
  assert.equal(g.room.act(s.a, { op: 'answer', a: 1, bet: 3 }).ok, false, 'answers lock');
  const tv = g.tv(); assert.equal(tv.correct, null, 'the TV does not know the answer before the reveal');
  assert.equal(JSON.stringify(g.view(s.b)).includes('"correct":' + g.r.q.correct + ','), g.r.q.correct === null, 'phones do not get the answer early');
  // A late joiner waits for the next question.
  const late = s.room.join('Cleo').player; assert.equal(g.room.act(late, { op: 'answer', a: 0, bet: 1 }).ok, false);
});

test('awards: Coward for always 1×, Big Better for big bets, and a full game with a player leaving', () => {
  const s = setup({ questions: 8 }, 0); const g = s.g;
  run(s.room, s.clock, () => {
    if (g.phase === 'ask' && g.r.kind !== 'hot') { if (!g.r.answers.has(s.a.id)) g.room.act(s.a, { op: 'answer', a: g.r.q.correct, bet: 1 }); if (!g.r.answers.has(s.b.id)) g.room.act(s.b, { op: 'answer', a: g.r.q.correct, bet: 3 }); }
    return g.phase === 'over';
  });
  const aw = Object.fromEntries(g.tv().final.awards.map((x) => [x.k, x]));
  assert.deepEqual(aw.coward.names, ['Ana']); assert.deepEqual(aw.better.names, ['Ben']);
  const s2 = setup({ questions: 8 }, 4);
  run(s2.room, s2.clock, () => s2.g.n === 3);
  s2.room.remove(s2.room.list().find((p) => p.bot).id);
  run(s2.room, s2.clock, () => s2.g.phase === 'over');
  assert(s2.g.results().length >= 5);
});

test('content packs: each new category plays a whole game on its own', () => {
  for (const cats of ['holiday', 'office', 'classics', 'travel']) {
    const s = setup({ questions: 16, cats }, 4); const seen = new Set();
    run(s.room, s.clock, () => { if (s.g.r) { assert.equal(s.g.r.cat, cats); seen.add(s.g.r.q.text); } return s.g.phase === 'over'; });
    assert.equal(s.g.n, 16); assert.equal(seen.size, 16, cats + ': no repeats'); assert(s.g.tv().final);
  }
});

test('room-wide Family mode (room.family): forces the Family setting and never asks a question outside the family pool', () => {
  const famPool = new Set(); for (const c of T.CATEGORIES) for (const q of T.Q[c.key]) if (q[0] < 3 && !T.GROWN_UP.has(q[1])) famPool.add(q[1]);
  for (const cats of ['all', 'holiday', 'classics']) for (const seed of [1, 2]) {
    const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
    room.join('Ana'); room.addBots(5); room.family = true;
    Object.assign(room.settings, { showIntro: false, questions: 16, cats, family: false }); // the host left the game's own setting off
    assert(room.start().ok); const g = room.game;
    assert.equal(g.family, true); let asked = 0;
    run(room, clock, () => { if (g.r && g.r.n > asked) { asked = g.r.n; assert(famPool.has(g.r.q.text), 'family question: ' + g.r.q.text); assert(g.r.q.diff < 3); assert.equal(g.tv().family, true); } return g.phase === 'over'; });
    assert.equal(asked, 16);
    for (const id of g.results()) assert(g.scores.get(id) >= 0);
  }
  const s = setup({ questions: 8 }, 2); assert.equal(s.g.family, false, 'room.family undefined: normal game');
});

test('difficulty: Easy asks rating-1 questions, Hard 2–3, Medium 1–2; Mixed (the default) any; whole games finish on each', () => {
  assert.equal(def.defaults.difficulty, 'mixed');
  for (const [d, ok] of [['easy', (x) => x === 1], ['medium', (x) => x <= 2], ['hard', (x) => x >= 2]]) {
    const s = setup({ difficulty: d, questions: 16 }, 3);
    const seen = [];
    run(s.room, s.clock, () => { if (s.g.r && seen[s.g.n - 1] == null) seen[s.g.n - 1] = s.g.r.q.diff; return s.g.phase === 'over'; });
    assert.equal(s.g.phase, 'over', d + ' finishes');
    assert(seen.filter(ok).length >= seen.length - 1, d + ': ' + seen.join(','));
  }
});

console.log(`\n${passed} Hot Take Trivia tests passed.`);
