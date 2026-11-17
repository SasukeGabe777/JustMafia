'use strict';
// JustSketch Relay: rules, validation, secrets, and full bot games (4 and 100 players) on a virtual clock.
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/sketch');
const T = def._test;

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function make(bots, settings = {}, seed = 7) {
  const clock = new VirtualClock(), r = new BoxRoom('TEST', def, { clock, seed });
  if (bots) r.addBots(bots); Object.assign(r.settings, settings);
  return { r, clock };
}
function runOut(r, clock, limit = 500000) { let i = 0; while (r.game.phase !== 'over' && clock.step()) if (++i > limit) throw new Error('game never ended (' + r.game.phase + ')'); assert.equal(r.game.phase, 'over'); return i; }
const until = (r, clock, cond, limit = 100000) => { let i = 0; while (!cond() && clock.step()) if (++i > limit) throw new Error('condition never met in ' + r.game.phase); assert(cond(), 'condition never met (' + r.game.phase + ')'); };
const dot = (c = 0) => [{ c, s: 1, p: [500, 500] }];

test('Fuzzy matching: same idea matches, different idea does not', () => {
  assert(T.matches('a penguin at a job interview', 'Penguin job interview!'));
  assert(T.matches('a cat on a skateboard', 'cats on skateboards'));
  assert(T.matches('a dragon doing the dishes', 'dragon doing dishs'), 'one typo is fine');
  assert(!T.matches('a cat on a skateboard', 'my uncle at a wedding'));
  assert(!T.matches('a cat', '???'));
  assert.equal(T.similarity('', 'anything'), 0);
  assert(T.PROMPTS.length >= 110 && new Set(T.PROMPTS).size === T.PROMPTS.length, 'about 120 unique prompts');
});

test('Stroke validation: palette colours, sizes, coordinates and caps', () => {
  assert(T.cleanStrokes([]).strokes, 'a blank page is allowed');
  assert(T.cleanStrokes([{ c: 8, s: 2, p: [0, 0, 1000, 1000] }]).strokes, 'eraser + corners ok');
  for (const bad of [null, 'x', {}, [{ c: 13, s: 0, p: [1, 1] }], [{ c: -1, s: 0, p: [1, 1] }], [{ c: '#ff0000', s: 0, p: [1, 1] }],
    [{ c: 0, s: 5, p: [1, 1] }], [{ c: 1, s: 0, f: 1, p: [1, 1, 2, 2] }], [{ c: 1, s: 0, f: true, p: [1, 1] }], [{ c: 0, s: 0, p: [1] }], [{ c: 0, s: 0, p: [] }], [{ c: 0, s: 0, p: [1, 1001] }], [{ c: 0, s: 0, p: [1.5, 2] }],
    [{ c: 0, s: 0, p: [-1, 2] }], [{ c: 0, s: 0, p: 'nope' }], [null]]) assert(T.cleanStrokes(bad).error, 'rejected: ' + JSON.stringify(bad));
  const many = Array.from({ length: T.MAX_STROKES + 1 }, () => ({ c: 0, s: 0, p: [1, 1] }));
  assert(T.cleanStrokes(many).error, 'too many strokes');
  const heavy = [{ c: 0, s: 0, p: new Array((T.MAX_POINTS + 1) * 2).fill(5) }];
  assert(T.cleanStrokes(heavy).error, 'too many points');
  const split = Array.from({ length: 5 }, () => ({ c: 0, s: 0, p: new Array(1700 * 2).fill(5) }));
  assert(T.cleanStrokes(split).error, 'total points capped across strokes');
});

test('4 humans: one ring, draw → guess → draw → guess; each player sees only the previous entry', () => {
  const { r, clock } = make(0, { ringSize: 4 });
  const ps = ['Ann', 'Bo', 'Cy', 'Di'].map((n) => r.join(n).player);
  assert(r.start().ok);
  const g = r.game;
  assert.equal(g.rings.length, 1); assert.equal(g.steps, 4); assert.equal(g.phase, 'step'); assert.equal(g.kind, 'draw');
  // Step 1: everyone draws their own secret prompt.
  for (const p of ps) {
    const v = r.playerState(p).state;
    assert.equal(v.task.kind, 'draw'); assert(v.task.first); assert.equal(g.books[g.tasks.get(p.id).book].owner, p.id);
    assert.equal(v.task.text, g.books[g.tasks.get(p.id).book].entries[0].text);
  }
  // Wrong move / bad data rejected.
  assert.equal(r.act(ps[0], { op: 'guess', text: 'hi' }).ok, false, 'this step is for drawing');
  assert.equal(r.act(ps[0], { op: 'draw', strokes: [{ c: 14, s: 0, p: [1, 1] }] }).ok, false, 'bad colour');
  assert.equal(r.act(ps[0], { op: 'draw', strokes: [{ c: 0, s: 0, p: [5000, 1] }] }).ok, false, 'off the page');
  assert.equal(r.act(ps[0], { op: 'draw' }).ok, false, 'no strokes array');
  assert.equal(r.act(ps[0], { op: 'nonsense' }).ok, false);
  // Reroll once.
  const before = r.playerState(ps[0]).state.task.text;
  assert(r.act(ps[0], { op: 'reroll' }).ok); assert.notEqual(r.playerState(ps[0]).state.task.text, before);
  assert.equal(r.act(ps[0], { op: 'reroll' }).ok, false, 'only once');
  ps.forEach((p, i) => assert(r.act(p, { op: 'draw', strokes: dot(i) }).ok));
  assert.equal(r.act(ps[0], { op: 'draw', strokes: dot() }).ok, false, 'already sent');
  assert.equal(r.act(ps[0], { op: 'reroll' }).ok, false, 'too late to reroll');
  // Everyone done → moves on early (pass interlude, then the guess step).
  until(r, clock, () => g.phase === 'step' && g.kind === 'guess');
  for (const p of ps) {
    const v = r.playerState(p).state, t = g.tasks.get(p.id), b = g.books[t.book];
    assert.notEqual(b.owner, p.id, 'never your own book');
    assert.deepEqual(v.task.strokes, b.entries[1].strokes, 'guesser sees the drawing');
    assert.equal(v.task.text, undefined, 'and not the prompt');
    assert(!JSON.stringify(v).includes(b.entries[0].text), 'prompt is secret from the guesser');
  }
  assert.equal(r.act(ps[0], { op: 'guess', text: '   ' }).ok, false, 'empty guess');
  assert.equal(r.act(ps[0], { op: 'draw', strokes: dot() }).ok, false, 'this step is for guessing');
  // The guesser of Ann's book guesses it right; one player misses the step (auto "???").
  const annBook = g.books.find((b) => b.owner === ps[0].id);
  const guesser = ps.find((p) => g.tasks.get(p.id).book === annBook.id);
  for (const p of ps) if (p !== ps[3] || guesser === ps[3]) r.act(p, { op: 'guess', text: p === guesser ? annBook.entries[0].text : 'a potato' });
  if (guesser !== ps[3]) { until(r, clock, () => g.phase === 'pass'); const missed = [...g.books].find((b) => b.entries[2] && b.entries[2].by === ps[3].id); assert(missed.entries[2].auto); assert.equal(missed.entries[2].text, '???'); }
  // Step 3: the drawer sees only the guess.
  until(r, clock, () => g.phase === 'step' && g.step === 2);
  for (const p of ps) { const t = g.tasks.get(p.id); assert.equal(r.playerState(p).state.task.text, g.books[t.book].entries[2].text); }
  for (const p of ps) r.act(p, { op: 'draw', strokes: dot(2) });
  until(r, clock, () => g.phase === 'step' && g.step === 3);
  // Final guesses: Ann's book survives the whole chain.
  for (const p of ps) { const t = g.tasks.get(p.id); r.act(p, { op: 'guess', text: t.book === annBook.id ? 'penguin?? no: ' + annBook.entries[0].text : 'my uncle at a wedding' }); }
  until(r, clock, () => g.phase === 'show');
  assert(annBook.survived, 'final guess matched the prompt');
  assert.equal(annBook.entries.length, 5);
  assert.deepEqual(annBook.entries.map((e) => e.kind), ['prompt', 'draw', 'guess', 'draw', 'guess']);
});

test('Secrets: the TV never sees prompts, guesses or drawings before the reveal', () => {
  const { r, clock } = make(0, { ringSize: 6, prompts: 'deck' });
  const ps = ['Ann', 'Bo', 'Cy', 'Di', 'Ed', 'Flo'].map((n) => r.join(n).player);
  r.start(); const g = r.game;
  const secrets = () => g.books.flatMap((b) => b.entries.filter((e) => e && e.text).map((e) => e.text));
  for (let s = 0; s < g.steps; s++) {
    until(r, clock, () => g.phase === 'step' && g.step === s);
    const tv = JSON.stringify(r.tvState());
    for (const t of secrets()) assert(!tv.includes(t), `TV leaked “${t}” at step ${s + 1}`);
    assert(!tv.includes('"strokes"'), 'no drawings on the TV during the relay');
    for (const p of ps) { const t = g.tasks.get(p.id); if (t.kind === 'draw') r.act(p, { op: 'draw', strokes: dot() }); else r.act(p, { op: 'guess', text: 'secret guess ' + p.name + s }); }
    until(r, clock, () => g.phase !== 'step' || g.step !== s);
    if (g.phase === 'pass') { const tv2 = JSON.stringify(r.tvState()); for (const t of secrets()) assert(!tv2.includes(t)); }
  }
  assert.equal(g.phase, 'show');
  const tv = r.tvState().state;
  assert.equal(tv.book.entries.length, 1, 'reveal goes one entry at a time');
});

test('Write-your-own prompts: written prompts become the books; missing ones come from the deck', () => {
  const { r, clock } = make(2, { prompts: 'write' });
  const a = r.join('Ann').player, b = r.join('Bo').player;
  r.start(); const g = r.game;
  assert.equal(g.phase, 'write');
  assert.equal(r.act(a, { op: 'prompt', text: 'x' }).ok, false, 'too short');
  assert(r.act(a, { op: 'prompt', text: 'a <b>walrus</b> in a hot tub' }).ok);
  assert(!JSON.stringify(r.tvState()).includes('walrus'), 'TV doesn’t see written prompts');
  until(r, clock, () => g.phase === 'step');
  const ab = g.books.find((x) => x.owner === a.id);
  assert.equal(ab.entries[0].text, 'a bwalrus/b in a hot tub', 'tags stripped');
  assert(ab.entries[0].own);
  assert.equal(r.act(a, { op: 'reroll' }).ok, false, 'can’t reroll your own');
  assert(g.books.find((x) => x.owner === b.id).entries[0].text.length > 3, 'Bo got a deck prompt');
});

test('Votes: no voting for yourself; votes ×100; late joiners vote too', () => {
  const { r, clock } = make(3, { ringSize: 4, showBooks: 3 });
  const a = r.join('Ann').player;
  r.start(); const g = r.game;
  until(r, clock, () => g.phase === 'step' && g.tasks.has(a.id) && !g.tasks.get(a.id).done || g.phase === 'show');
  // Ann plays along until the reveal.
  while (g.phase !== 'show') { const t = g.tasks.get(a.id); if (g.phase === 'step' && t && !t.done) r.act(a, t.kind === 'draw' ? { op: 'draw', strokes: dot() } : { op: 'guess', text: 'a potato' }); clock.step(); }
  const late = r.join('Zed').player;
  assert.equal(r.playerState(late).state.inGame, false);
  until(r, clock, () => g.phase === 'vote');
  const b = g.cur, mine = b.entries.findIndex((e, i) => i > 0 && e.by === a.id), other = b.entries.findIndex((e, i) => i > 0 && e.by !== a.id && !e.auto);
  if (mine > 0) assert.equal(r.act(a, { op: 'vote', entry: mine }).ok, false, 'no self votes');
  assert.equal(r.act(a, { op: 'vote', entry: 0 }).ok, false, 'the prompt isn’t votable');
  assert.equal(r.act(a, { op: 'vote', entry: 99 }).ok, false);
  const before = g.scores.get(b.entries[other].by);
  assert(r.act(a, { op: 'vote', entry: other }).ok);
  assert(r.act(late, { op: 'vote', entry: other }).ok, 'late joiner votes');
  g.votes.forEach((v, k) => { if (k !== a.id && k !== late.id) g.votes.delete(k); }); // only our two votes count
  r.hostAction({ type: 'next' });
  assert.equal(g.phase, 'results');
  assert.equal(g.scores.get(b.entries[other].by) - before, 200);
  assert.equal(r.playerState(late).state.phase, 'results');
});

test('Full game with 4 bots reaches the end with awards and a gallery', () => {
  const { r, clock } = make(4, { ringSize: 4 });
  assert(r.start().ok);
  runOut(r, clock);
  const s = r.tvState().state;
  assert.equal(s.gallery.length, 4);
  assert(s.standings.length === 4);
  assert(s.awards.length >= 1, 'some awards were given');
  for (const a of s.awards) assert(['artist', 'guesser', 'chaos', 'mind', 'speedy', 'detail'].includes(a.key) && a.name);
  const gb = r.hostAction({ type: 'sketchBook', book: 0 });
  assert(gb.ok && gb.book.entries.length === 5 && gb.book.entries[1].strokes.length > 0);
  assert.equal(r.hostAction({ type: 'sketchBook', book: 99 }).ok, false);
  const total = [...r.game.scores.values()].reduce((x, y) => x + y, 0);
  assert(total > 0, 'points were scored');
});

test('Full game with 100 bots (rings of 8, every book revealed) reaches the end', () => {
  const { r, clock } = make(100, { ringSize: 8, showBooks: 0, drawSeconds: 45, guessSeconds: 20 });
  r.start(); const g = r.game;
  assert(g.rings.every((x) => x.n >= 4 && x.n <= 12), 'rings of about 8');
  assert.equal(g.rings.reduce((s, x) => s + x.n, 0), 100);
  runOut(r, clock, 2000000);
  assert.equal(g.show.length, 100);
  assert(g.books.every((b) => b.entries.every(Boolean) && b.entries[b.entries.length - 1].kind === 'guess'));
  assert(JSON.stringify(r.tvState()).length < 200000, 'TV state stays small at the end');
});

test('3 players and odd rings: every book still ends on a guess', () => {
  for (const n of [3, 5, 7, 9, 13]) {
    const { r, clock } = make(n, { ringSize: 4 });
    r.start(); runOut(r, clock);
    assert(r.game.books.every((b) => b.final && b.entries.length >= 3), `${n} players`);
  }
});

test('Skip ahead walks through every phase to the end', () => {
  const { r } = make(4, { prompts: 'write', showBooks: 3 });
  r.start(); const g = r.game; const seen = new Set();
  let i = 0;
  while (g.phase !== 'over') { seen.add(g.phase); assert(r.hostAction({ type: 'next' }).ok); if (++i > 200) throw new Error('stuck in ' + g.phase); }
  for (const ph of ['write', 'step', 'pass', 'show', 'final', 'vote', 'results']) assert(seen.has(ph), 'saw ' + ph);
  assert(g.books.every((b) => b.entries[1].auto), 'skipped steps got auto entries');
});

test('A player leaving mid-step doesn’t stall it; nobody leaving mid-vote stalls it either', () => {
  const { r, clock } = make(3, { ringSize: 4 });
  const a = r.join('Ann').player;
  r.start(); const g = r.game;
  const t0 = clock.now();
  until(r, clock, () => g.tasks.size && [...g.tasks].every(([id, t]) => t.done || id === a.id));
  r.remove(a.id);
  until(r, clock, () => g.phase !== 'step' || g.step > 0);
  assert(clock.now() - t0 < g.s.drawSeconds * 1000, 'moved on without waiting for the timer');
  runOut(r, clock);
});

test('Prompt packs: every pack is big and unique, and the deck only deals from the chosen pack', () => {
  const all = Object.entries(T.PACKS).filter(([k]) => k !== 'mix').flatMap(([, v]) => v);
  assert.equal(new Set(all).size, all.length, 'no prompt appears twice across the packs');
  for (const [k, v] of Object.entries(T.PACKS)) assert(v.length >= 36, k + ' has enough prompts');
  for (const pack of ['easy', 'food', 'fantasy', 'everyday']) {
    const { r } = make(6, { pack, ringSize: 6 });
    r.start();
    for (const b of r.game.books) assert(T.PACKS[pack].includes(b.entries[0].text), `${pack}: ${b.entries[0].text}`);
  }
});

test('Paint bucket fills: one point each, capped; mixed with strokes they pass', () => {
  const ok = T.cleanStrokes([{ c: 9, s: 4, p: [0, 0, 1000, 1000] }, { c: 12, s: 0, f: 1, p: [500, 500] }]);
  assert(ok.strokes && ok.strokes[1].f === 1 && ok.strokes[1].s === 0);
  assert(T.cleanStrokes(Array.from({ length: T.MAX_FILLS + 1 }, () => ({ c: 1, s: 0, f: 1, p: [5, 5] }))).error, 'too many fills');
  assert(!('f' in T.cleanStrokes([{ c: 1, s: 1, p: [5, 5] }]).strokes[0]), 'plain strokes stay plain');
});

test('Last call: when only a few players are left, the timer drops to 20 seconds', () => {
  const { r, clock } = make(0, { ringSize: 8, drawSeconds: 90 });
  const ps = Array.from({ length: 8 }, (_, i) => r.join('P' + i).player);
  r.start(); const g = r.game;
  for (const p of ps.slice(0, 5)) r.act(p, { op: 'draw', strokes: dot() });
  assert(!g.hurried, '3 of 8 left: not yet');
  r.act(ps[5], { op: 'draw', strokes: dot() });
  assert(g.hurried, '2 of 8 left: last call');
  assert(g.endsAt - clock.now() <= 20000);
  assert(r.tvState().state.hurried && r.playerState(ps[7]).state.hurried);
  r.act(ps[6], { op: 'draw', strokes: dot() });
  until(r, clock, () => g.phase !== 'step');
  assert(g.books.some((b) => b.entries[1] && b.entries[1].auto), 'the straggler got an auto entry');
});

test('Reactions during the reveal: valid emoji only, rate-limited, never during the relay', () => {
  const { r, clock } = make(3, { ringSize: 4, showBooks: 3 });
  const a = r.join('Ann').player;
  r.start(); const g = r.game;
  assert.equal(r.act(a, { op: 'react', e: 0 }).ok, false, 'not during the relay');
  until(r, clock, () => g.phase === 'show');
  const before = g.room.fxLog.filter((f) => f.kind === 'react').length;
  assert(r.act(a, { op: 'react', e: 2 }).ok);
  r.act(a, { op: 'react', e: 2 }); // same instant: ignored
  assert.equal(r.act(a, { op: 'react', e: 9 }).ok, false);
  assert.equal(r.act(a, { op: 'react', e: 'x' }).ok, false);
  const fx = g.room.fxLog.filter((f) => f.kind === 'react');
  assert.equal(fx.length - before, 1); assert.equal(fx[fx.length - 1].e, T.REACTS[2]);
  assert.deepEqual(r.playerState(a).state.reacts, T.REACTS);
});

test('The end: results() best-first, a book of the night, speed and detail awards', () => {
  const { r, clock } = make(0, { ringSize: 4, showBooks: 0 });
  const ps = ['Ann', 'Bo', 'Cy', 'Di'].map((n) => r.join(n).player);
  r.start(); const g = r.game;
  const big = { c: 1, s: 2, p: Array.from({ length: 120 }, (_, i) => 100 + i * 5) };
  while (g.phase !== 'over') {
    if (g.phase === 'step') for (const p of ps) { const t = g.tasks.get(p.id); if (t && !t.done) { r.act(p, t.kind === 'draw' ? { op: 'draw', strokes: p === ps[1] ? [big] : dot() } : { op: 'guess', text: 'a potato ' + p.name }); } }
    if (g.phase === 'vote') for (const p of ps) { const ok = g.votable(g.cur, p.id); if (ok.length) r.act(p, { op: 'vote', entry: ok[0] }); }
    clock.step();
  }
  const res = g.results();
  assert.equal(res.length, 4);
  const pts = res.map((id) => g.scores.get(id));
  assert.deepEqual(pts, pts.slice().sort((x, y) => y - x));
  const s = r.tvState().state;
  assert(s.best && s.best.votes > 0 && s.best.entries.length === 5, 'book of the night');
  const keys = s.awards.map((x) => x.key);
  assert(keys.includes('speedy'), 'speed award: ' + keys);
  assert(s.awards.find((x) => x.key === 'detail' && x.id === ps[1].id) || s.awards.find((x) => x.key === 'speedy' && x.id === ps[1].id), 'Bo drew the most');
});

console.log(`JustSketch Relay: ${passed} tests passed.`);
