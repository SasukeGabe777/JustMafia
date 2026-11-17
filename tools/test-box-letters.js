'use strict';
// Letter Rush rules: matching, scoring, challenges, validation and whole bot games on a
// virtual clock.  node tools/test-box-letters.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/letters');
const { norm, same, startsRight, alliterates, CATS, THEMES } = def;
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const run = (room, clock, until) => { let i = 0; while (!until() && clock.step()) if (++i > 200000) throw new Error('never got there'); };
const eq = (a, b) => same(norm(a), norm(b));

// A room with humans (Ana, Ben, Cy) and no timers firing until we say so.
function setup(n = 3, settings = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 7 });
  Object.assign(room.settings, settings);
  const ps = ['Ana', 'Ben', 'Cy', 'Dee', 'Eve'].slice(0, n).map((nm) => { const p = room.join(nm).player; p.sockets = 1; return p; });
  assert(room.start().ok);
  run(room, clock, () => room.game.phase === 'write');
  return { clock, room, g: room.game, ps };
}
// Force the round's letters and categories, then fill sheets.
function fill(g, letters, cats, sheets) {
  g.letters = letters; g.cats = cats;
  for (const [p, answers] of sheets) { g.sheet(p.id).a = cats.map(() => ''); answers.forEach((t, i) => assert.equal(g.act(p, { op: 'ans', i, text: t }).ok, true)); }
}

test('categories: 300+, original list, no duplicates, every theme can fill a 10-category theme round', () => {
  assert(CATS.length >= 300, `only ${CATS.length}`);
  assert.equal(new Set(CATS.map((c) => c.t.toLowerCase())).size, CATS.length);
  assert(CATS.filter((c) => c.p).length >= 80 && CATS.filter((c) => !c.p).length >= 200);
  for (const [k, T] of Object.entries(THEMES)) assert(T.family.length >= 10, k);
});

test('normalising: case, accents, "the", plurals, punctuation, spaces', () => {
  assert(eq('Banana', 'banana')); assert(eq('BANANAS', 'banana')); assert(eq('The Beatles', 'beatles'));
  assert(eq('Crème brûlée', 'creme brulee')); assert(eq('berries', 'berry')); assert(eq('Ice-cream', 'ice cream'));
  assert(eq('icecream', 'Ice Cream')); assert(eq('boxes', 'box')); assert(eq("Hershey's", 'hersheys'));
  assert(eq('Pineapple!', 'pineapple')); assert(eq('A Penguin', 'penguin'));
});
test('simple typos match on longer words, short different words never do', () => {
  assert(eq('Pinapple', 'Pineapple')); assert(eq('Elephnat', 'Elephant')); assert(eq('Strawbery', 'Strawberries'));
  assert(eq('Watermellon', 'Water melon'));
  assert(!eq('Bear', 'Beer')); assert(!eq('Cat', 'Car')); assert(!eq('Bike', 'Bake')); assert(!eq('Mango', 'Melon')); assert(!eq('', ''));
});
test('letter check and alliteration', () => {
  assert(startsRight('Banana', ['B'])); assert(startsRight('the Beatles', ['B'])); assert(startsRight('The Beatles', ['T']));
  assert(startsRight('An Owl', ['A'])); assert(startsRight('An Owl', ['O'])); assert(!startsRight('Apple', ['B'])); assert(!startsRight('  ', ['B']));
  assert(startsRight('Toast', ['B', 'T'])); assert(startsRight('Bagel', ['B', 'T']));
  assert(alliterates('Big Blue Banana', ['B'])); assert(alliterates('Peanut Butter', ['P', 'B'])); assert(alliterates('Box of Bolts', ['B']));
  assert(!alliterates('Banana', ['B'])); assert(!alliterates('Banana split', ['B'])); assert(!alliterates('Bag of the bits', ['X']));
});

test('scoring: shared 0, unique 1, alliteration 2, wrong letter 0, a repeat on your own list 0', () => {
  const { g, ps: [a, b, c] } = setup();
  fill(g, ['B'], ['A fruit', 'An animal', 'Something in a kitchen', 'A drink'], [
    [a, ['Banana', 'Bear', 'Big Blue Bowl', 'Banana']],
    [b, ['bananas', 'Beaver', 'Blender', 'Milk']],
    [c, ['Blueberry', 'The Bear', '', 'Brew']],
  ]);
  g.next(); // -> review
  assert.equal(g.phase, 'review');
  const J = g.judged;
  const st = (ci, p) => J[ci].items.find((x) => x.id === p.id);
  assert.equal(st(0, a).status, 'shared'); assert.equal(st(0, b).status, 'shared'); assert.equal(st(0, c).pts, 1);
  assert.equal(st(1, a).status, 'shared'); assert.equal(st(1, c).status, 'shared'); assert.equal(st(1, b).pts, 1);
  assert.equal(st(2, a).pts, 2); assert(st(2, a).bonus); assert.equal(st(2, b).pts, 1); assert.equal(st(2, c), undefined);
  assert.equal(st(3, a).status, 'repeat'); assert.equal(st(3, b).status, 'wrong'); assert.equal(st(3, c).pts, 1);
  while (g.phase !== 'scores') g.next();
  assert.equal(g.scores.get(a.id), 2); assert.equal(g.scores.get(b.id), 2); assert.equal(g.scores.get(c.id), 2);
});

test('challenges: a room vote strikes an answer; ties keep it; you cannot challenge or vote on your own', () => {
  const { g, ps: [a, b, c] } = setup();
  fill(g, ['B'], ['A fruit', 'An animal'], [[a, ['Broccoli', 'Bear']], [b, ['Banana', 'Bison']], [c, ['Blueberry', 'Badger']]]);
  g.next();
  assert.equal(g.act(a, { op: 'challenge', id: a.id }).ok, false);
  assert.equal(g.act(b, { op: 'challenge', id: a.id, on: true }).ok, true);
  assert.equal(g.act(c, { op: 'challenge', id: a.id, on: true }).ok, true);
  assert.equal(g.act(c, { op: 'challenge', id: 'nobody' }).ok, false);
  for (const p of [a, b, c]) g.act(p, { op: 'ready' });
  g.next(); // the ready timer: end the look now
  assert.equal(g.phase, 'vote');
  assert.equal(g.act(a, { op: 'vote', id: a.id, keep: true }).ok, false);
  assert.equal(g.act(b, { op: 'vote', id: a.id, keep: 'yes' }).ok, false);
  assert.equal(g.act(b, { op: 'vote', id: a.id, keep: false }).ok, true);
  assert.equal(g.act(c, { op: 'vote', id: a.id, keep: false }).ok, true);
  assert.equal(g.phase, 'vote'); g.next();
  assert.equal(g.phase, 'verdict');
  assert.equal(g.rev.trial[0].status, 'struck'); assert.deepEqual(g.rev.verdict, { struck: 1, kept: 0 });
  g.next(); // next category: Ben challenges Cy, the vote is a tie (Ana keeps, Ben strikes)
  assert.equal(g.phase, 'review');
  g.act(b, { op: 'challenge', id: c.id }); g.next();
  g.act(a, { op: 'vote', id: c.id, keep: true }); g.act(b, { op: 'vote', id: c.id, keep: false });
  g.next(); assert.equal(g.rev.trial[0].status, 'ok'); g.next();
  assert.equal(g.phase, 'scores');
  assert.equal(g.scores.get(a.id), 1); assert.equal(g.scores.get(c.id), 2);
  assert.equal(g.stats.get(a.id).struck, 1); assert.equal(g.stats.get(b.id).sharp, 1); assert.equal(g.stats.get(c.id).challenged, 1);
});

test('everyone done ends writing early; everyone ready skips ahead', () => {
  const { clock, room, g, ps } = setup();
  for (const p of ps) { g.act(p, { op: 'ans', i: 0, text: g.letters[0] + 'oo' + p.name }); g.act(p, { op: 'done' }); }
  run(room, clock, () => g.phase === 'review');
  assert(room.now() < 6000 + 90000, 'should have ended early');
  const t = room.now(); for (const p of ps) g.act(p, { op: 'ready' });
  run(room, clock, () => g.ci === 1 || g.phase !== 'review');
  assert(room.now() - t < 2000);
});

test('round plan: speed has fewer categories and less time, theme draws from one theme, the final round has two letters and doubles points', () => {
  const { g } = setup(3, { rounds: 5, cats: 10, seconds: 90 });
  assert.deepEqual(g.plan, ['normal', 'speed', 'theme', 'normal', 'double']);
  assert.equal(g.cats.length, 10);
  g.type = 'speed'; assert.equal(g.catCount(), 5); assert.equal(g.writeMs(), 40000);
  g.round = 2; g.next(); while (g.phase !== 'scores') g.next(); g.round = 2; g.plan[2] = 'theme'; g.next();
  assert.equal(g.type, 'theme'); const th = g.theme; assert(th);
  for (const c of g.cats) assert(THEMES[th].family.includes(c) || THEMES[th].party.includes(c), c);
  while (g.phase !== 'scores') g.next(); g.round = 4; g.next();
  assert.equal(g.type, 'double'); assert.equal(g.letters.length, 2); assert.notEqual(g.letters[0], g.letters[1]); assert.equal(g.mult(), 2);
});

test('fair letters: no Q, X or Z unless hard letters are on; no letter twice in a game', () => {
  for (let seed = 1; seed < 40; seed++) {
    const room = new BoxRoom('T', def, { clock: new VirtualClock(), seed }); room.addBots(3); room.start();
    const g = room.game, seen = [];
    for (let i = 0; i < 12; i++) seen.push(g.rollLetter());
    assert(!seen.some((L) => 'QXZ'.includes(L)), seen.join(''));
    assert.equal(new Set(seen).size, seen.length);
  }
  let hard = 0;
  for (let seed = 1; seed < 40; seed++) {
    const room = new BoxRoom('T', def, { clock: new VirtualClock(), seed }); room.settings.hard = 'on'; room.addBots(3); room.start();
    for (let i = 0; i < 20; i++) if ('QXZ'.includes(room.game.rollLetter())) hard++;
  }
  assert(hard > 0);
});

test('family set never shows party categories', () => {
  const room = new BoxRoom('T', def, { clock: new VirtualClock(), seed: 3 }); room.settings.set = 'family'; room.addBots(3); room.start();
  const party = new Set(CATS.filter((c) => c.p).map((c) => c.t));
  for (let i = 0; i < 20; i++) for (const c of room.game.drawCats(10)) assert(!party.has(c), c);
});

test('phone input is validated and stripped', () => {
  const { g, ps: [a, b] } = setup();
  for (const bad of [{ op: 'ans', i: 99, text: 'x' }, { op: 'ans', i: -1, text: 'x' }, { op: 'ans', i: 1.5, text: 'x' }, { op: 'ans', i: 0, text: 42 }, { op: 'ans', i: '0x', text: 'x' },
    { op: 'sheet', answers: 'nope' }, { op: 'sheet', answers: new Array(50).fill('x') }, { op: 'challenge', id: a.id }, { op: 'vote', id: a.id, keep: true }, { op: 'ready' }, { op: 'nope' }, {}, null])
    assert.equal(g.act(a, bad).ok, false, JSON.stringify(bad));
  g.act(a, { op: 'ans', i: 0, text: '  <b>Bo\u0000ld</b>‮   and   ' + 'x'.repeat(80) });
  const t = g.sheets.get(a.id).a[0];
  assert(!/[<>\u0000‮]/.test(t)); assert(t.length <= 40); assert(t.startsWith('bBold/b and'));
  assert.equal(g.act(b, { op: 'sheet', answers: ['One', 7, 'Three'] }).ok, true);
  assert.deepEqual(g.sheets.get(b.id).a.slice(0, 3), ['One', '', 'Three']);
  g.next(); // review
  assert.equal(g.act(a, { op: 'ans', i: 0, text: 'late' }).ok, false);
  assert.equal(g.act(a, { op: 'done' }).ok, false);
});

test('views keep sheets private while writing', () => {
  const { g, ps: [a, b] } = setup();
  g.act(a, { op: 'ans', i: 0, text: 'Secret' });
  assert.equal(JSON.stringify(g.tv()).includes('Secret'), false);
  assert.equal(JSON.stringify(g.view(b)).includes('Secret'), false);
  assert.equal(g.view(a).mine[0], 'Secret');
});

for (const [n, rounds] of [[6, 3], [12, 5], [2, 3]]) {
  test(`bots play a whole ${rounds}-round game with ${n}; results() lists everyone best-first; awards`, () => {
    const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: n });
    room.settings.rounds = rounds; room.addBots(n); assert(room.start().ok);
    let challenged = 0, maxMs = 0;
    run(room, clock, () => { if (room.game.phase === 'vote') challenged++; return room.game.phase === 'over'; });
    maxMs = room.now();
    const res = room.game.results();
    assert.equal(res.length, n); assert.equal(new Set(res).size, n);
    const pts = res.map((id) => room.game.scores.get(id)); assert.deepEqual(pts, pts.slice().sort((x, y) => y - x));
    assert(room.game.awards.length >= 2);
    if (n >= 6) assert(challenged > 0, 'bots should have challenged something');
    assert(maxMs < 20 * 60000, `too long: ${Math.round(maxMs / 60000)} min`);
    console.log(`      (${Math.round(maxMs / 6000) / 10} min, top ${pts[0]} pts, ${room.game.awards.map((x) => x.title).join(', ')})`);
    assert(JSON.stringify(room.game.tv()).length < 60000);
  });
}

test('results() is empty until the game is over; leaving players do not hold up the round', () => {
  const { clock, room, g, ps } = setup();
  assert.deepEqual(g.results(), []);
  g.act(ps[0], { op: 'done' }); g.act(ps[1], { op: 'done' });
  ps[2].sockets = 0; g.left(ps[2]);
  run(room, clock, () => g.phase === 'review');
  assert(room.now() < 20000);
});

console.log(`\n${passed} Letter Rush tests passed.`);
