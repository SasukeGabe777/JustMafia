'use strict';
// Meme Maker rules: played to the end by bots on a virtual clock.  node tools/test-box-memes.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/memes');
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const run = (room, clock, until, max = 200000) => { let i = 0; while (!until() && clock.step()) if (++i > max) throw new Error('never got there'); };
const make = (bots, settings = {}, seed = 1) => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  Object.assign(room.settings, settings);
  return { clock, room, bots: room.addBots(bots) };
};

test('there are 30+ original templates, each drawn by the client with the same slot count', () => {
  assert(def.TEMPLATES.length >= 30, 'only ' + def.TEMPLATES.length);
  const client = fs.readFileSync(path.join(__dirname, '../public/box/games/memes.js'), 'utf8');
  for (const t of def.TEMPLATES) {
    const m = client.match(new RegExp(`\\n\\s*${t.id}: \\{ n: (\\d+),`));
    assert(m, `client draws template ${t.id}`);
    assert.equal(Number(m[1]), t.slots.length, `slot count for ${t.id}`);
  }
  assert.equal(new Set(def.TEMPLATES.map((t) => t.id)).size, def.TEMPLATES.length);
});

test('bots play a whole game with every round type; results() lists everyone best-first', () => {
  const { clock, room } = make(6, { rounds: 4 });
  assert(room.start().ok);
  const g = room.game, kinds = new Set();
  let i = 0; while (g.phase !== 'over' && clock.step()) { if (g.kind) kinds.add(g.kind); if (++i > 200000) throw new Error('never ended'); }
  assert.deepEqual([...kinds].sort(), ['final', 'free', 'prompt', 'remix', 'same']);
  const r = g.results(); assert.equal(r.length, 6);
  const pts = r.map((id) => g.scores.get(id)); assert.deepEqual(pts, pts.slice().sort((a, b) => b - a));
  assert(g.all.length >= 6 * 4 - 6, 'memes were made');
  assert(g.motn, 'a Meme of the Night was crowned');
  const tv = g.tv(); assert(tv.gallery.length > 0 && tv.awards.length > 0);
  assert(g.all.some((m) => m.kind === 'remix' && m.co), 'remix memes credit the starter');
});

test('results() is empty until the game is over', () => {
  const { room } = make(4); room.start();
  assert.deepEqual(room.game.results(), []);
});

test('you cannot vote for your own meme (or a remix you started); votes score 100 each', () => {
  const { clock, room } = make(3);
  const ana = room.join('Ana').player; ana.sockets = 1;
  room.start(); const g = room.game;
  run(room, clock, () => g.phase === 'write');
  assert.equal(room.act(ana, { op: 'post', caps: ['MY TOP', 'MY BOTTOM', 'x', 'y'] }).ok, true);
  run(room, clock, () => g.phase === 'vote');
  const mine = g.entries.find((m) => m.by === ana.id), other = g.entries.find((m) => m.by !== ana.id);
  assert(mine, 'Ana’s meme is in');
  assert.equal(mine.caps[0], 'MY TOP');
  const bad = room.act(ana, { op: 'vote', id: mine.id }); assert.equal(bad.ok, false); assert.match(bad.error, /own/);
  assert.equal(room.act(ana, { op: 'vote', id: 'nope' }).ok, false);
  const before = g.scores.get(other.by);
  assert.equal(room.act(ana, { op: 'vote', id: other.id }).ok, true);
  run(room, clock, () => g.phase === 'result');
  assert(g.scores.get(other.by) >= before + 100);
  // the phone view marks your own meme
  g.phase = 'vote'; assert(g.view(ana).ballot.find((b) => b.id === mine.id).mine); g.phase = 'result';
});

test('a unanimous win earns the bonus', () => {
  const { clock, room } = make(0);
  const ps = ['Ana', 'Bo', 'Cy', 'Di'].map((n) => { const p = room.join(n).player; p.sockets = 1; return p; });
  room.start(); const g = room.game;
  run(room, clock, () => g.phase === 'write');
  ps.forEach((p, i) => assert(room.act(p, { op: 'post', caps: ['TOP ' + i, 'BOTTOM ' + i, 'C', 'D'] }).ok));
  run(room, clock, () => g.phase === 'vote');
  const star = g.entries.find((m) => m.by === ps[0].id);
  for (const p of ps.slice(1)) assert(room.act(p, { op: 'vote', id: star.id }).ok);
  room.act(ps[0], { op: 'vote', id: g.entries.find((m) => m.by === ps[1].id).id });
  run(room, clock, () => g.phase === 'result');
  // 3 votes but Ana's own vote went elsewhere: not unanimous.
  assert.equal(g.last.unan, false);
  assert.equal(g.scores.get(ps[0].id), 300 + 250);
  // Next round: everyone (who votes) votes for one meme.
  run(room, clock, () => g.phase === 'write');
  ps.forEach((p, i) => room.act(p, { op: 'post', caps: ['T' + i, 'B' + i, 'C', 'D'] }));
  run(room, clock, () => g.phase === 'vote');
  const s2 = g.entries.find((m) => m.by === ps[1].id), before = g.scores.get(ps[1].id);
  for (const p of [ps[0], ps[2], ps[3]]) room.act(p, { op: 'vote', id: s2.id });
  room.act(ps[1], { op: 'vote', id: g.entries.find((m) => m.by === ps[0].id).id });
  run(room, clock, () => g.phase === 'result');
  assert.equal(g.last.unan, false, 'one vote went elsewhere');
  assert.equal(g.scores.get(ps[1].id) - before, 300 + 250);
});

test('unanimous: all votes for one meme', () => {
  const { clock, room } = make(0);
  const ps = ['Ana', 'Bo', 'Cy'].map((n) => { const p = room.join(n).player; p.sockets = 1; return p; });
  room.start(); const g = room.game;
  run(room, clock, () => g.phase === 'write');
  ps.forEach((p, i) => room.act(p, { op: 'post', caps: ['TOP ' + i, 'BOT ' + i, 'C', 'D'] }));
  run(room, clock, () => g.phase === 'vote');
  const star = g.entries.find((m) => m.by === ps[0].id);
  room.act(ps[1], { op: 'vote', id: star.id }); room.act(ps[2], { op: 'vote', id: star.id });
  room.act(ps[0], { op: 'vote', id: g.entries.find((m) => m.by === ps[1].id).id });
  run(room, clock, () => g.phase === 'result');
  assert.equal(g.last.unan, false);
  // A room where only the two others vote and both pick the star: unanimous.
  const { clock: c2, room: r2 } = make(0);
  const qs = ['Ana', 'Bo', 'Cy'].map((n) => { const p = r2.join(n).player; p.sockets = 1; return p; });
  r2.start(); const h = r2.game;
  run(r2, c2, () => h.phase === 'write');
  qs.forEach((p, i) => r2.act(p, { op: 'post', caps: ['TOP ' + i, 'BOT ' + i, 'C', 'D'] }));
  run(r2, c2, () => h.phase === 'vote');
  const st = h.entries.find((m) => m.by === qs[0].id);
  r2.act(qs[1], { op: 'vote', id: st.id }); r2.act(qs[2], { op: 'vote', id: st.id });
  qs[0].sockets = 0; h.maybeAllVoted(); // Ana's phone dropped, so the vote closes
  run(r2, c2, () => h.phase === 'result');
  assert.equal(h.last.unan, true);
  assert.equal(h.scores.get(qs[0].id), 200 + 250 + 500);
});

test('phone input is validated and cleaned', () => {
  const { clock, room } = make(2);
  const p = room.join('Ana').player; p.sockets = 1;
  room.start(); const g = room.game;
  for (const bad of [{ op: 'post', caps: ['x'] }, { op: 'vote', id: 'm1' }, { op: 'nope' }, {}, null]) assert.equal(room.act(p, bad).ok, false);
  run(room, clock, () => g.phase === 'write');
  for (const bad of [{ op: 'post' }, { op: 'post', caps: 'hello' }, { op: 'post', caps: [] }, { op: 'post', caps: ['   ', '\u0000​'] }, { op: 'post', caps: [{}, 5] }, { op: 'vote', id: 'm1' }, { op: 'post', caps: ['a', 'b'], tpl: 'not-mine' }]) assert.equal(room.act(p, bad).ok, false, JSON.stringify(bad));
  const long = 'A'.repeat(500) + '\u0007‮<b>';
  assert(room.act(p, { op: 'draft', caps: [long, 'x'] }).ok);
  const c = g.cards.get(p.id);
  assert(c.caps[0].length <= 60 && !/[\u0007‮<>]/.test(c.caps[0]));
  // one shuffle per round
  const kind = g.kind; assert.equal(kind, 'free');
  const t0 = c.tpl; assert(room.act(p, { op: 'shuffle' }).ok); assert.notEqual(g.cards.get(p.id).tpl, t0);
  assert.equal(room.act(p, { op: 'shuffle' }).ok, false);
  assert(room.act(p, { op: 'post', caps: ['hello   world', ''] }).ok);
  assert.equal(room.act(p, { op: 'post', caps: ['again', ''] }).ok, false);
  assert.equal(g.cards.get(p.id).caps[0], 'hello world');
});

test('a draft counts when time runs out', () => {
  const { clock, room } = make(2);
  const p = room.join('Ana').player; p.sockets = 1;
  room.start(); const g = room.game;
  run(room, clock, () => g.phase === 'write');
  room.act(p, { op: 'draft', caps: ['HALF A JOKE', ''] });
  run(room, clock, () => g.phase === 'parade');
  assert(g.entries.some((m) => m.by === p.id && m.caps[0] === 'HALF A JOKE'));
});

test('the profanity filter: family blocks mild words, party blocks swears, slurs always', () => {
  const f = def.filterText;
  assert.equal(f('what the hell', 'family'), 'what the #@$%');
  assert.equal(f('what the hell', 'party'), 'what the hell');
  assert.notEqual(f('f*ck this sh1t', 'party'), 'f*ck this sh1t');
  assert.notEqual(f('FUUUCK', 'party'), 'FUUUCK');
  assert.equal(f('hello class, Dickens wrote of a peacock in Sussex', 'family'), 'hello class, Dickens wrote of a peacock in Sussex');
  assert.equal(f('spicy shiitake', 'family'), 'spicy shiitake');
  assert.notEqual(f('you retard', 'uncut'), 'you retard');
  assert.equal(f('damn', 'uncut'), 'damn');
  // the game filters captions as memes are made
  const { clock, room } = make(2, { content: 'family' });
  const p = room.join('Ana').player; p.sockets = 1; room.start(); const g = room.game;
  run(room, clock, () => g.phase === 'write');
  room.act(p, { op: 'post', caps: ['oh crap', 'shit happens'] });
  run(room, clock, () => g.phase === 'parade');
  const m = g.entries.find((x) => x.by === p.id); assert(!/crap|shit/i.test(m.caps.join(' ')));
});

test('remix: the second writer keeps the first half and writes the rest', () => {
  const { clock, room } = make(0, { rounds: 3 });
  const ps = ['Ana', 'Bo', 'Cy'].map((n) => { const p = room.join(n).player; p.sockets = 1; return p; });
  room.start(); const g = room.game;
  run(room, clock, () => g.kind === 'remix' && g.phase === 'write');
  for (const p of ps) { const c = g.cards.get(p.id); const caps = c.caps.map((_, i) => (i < c.upto ? 'START ' + p.name : 'nope')); assert(room.act(p, { op: 'post', caps }).ok); }
  run(room, clock, () => g.phase === 'write' && g.step === 2);
  for (const p of ps) {
    const c = g.cards.get(p.id);
    assert(c.start && c.start.by && c.start.by !== p.id, 'finishes someone else’s');
    assert(c.caps[0].startsWith('START '));
    const caps = c.caps.map(() => 'END ' + p.name); caps[0] = 'HACKED';
    assert(room.act(p, { op: 'post', caps }).ok);
    assert(g.cards.get(p.id).caps[0].startsWith('START '), 'cannot overwrite the starter’s half');
  }
  run(room, clock, () => g.phase === 'vote');
  for (const p of ps) {
    const started = g.entries.find((m) => m.co === p.id);
    if (started) assert.equal(room.act(p, { op: 'vote', id: started.id }).ok, false, 'no votes for a remix you started');
  }
});

test('20+ players: a semi-final on phones, then only the finalists parade on the TV', () => {
  const { clock, room } = make(24);
  room.start(); const g = room.game;
  run(room, clock, () => g.phase === 'semi');
  assert(g.entries.length > 12);
  for (const [id, b] of g.ballots) { assert(b.length <= 6 && b.length > 0); for (const mid of b) { const m = g.entries.find((x) => x.id === mid); assert(m.by !== id); } }
  const tv = g.tv(); assert(tv.wall.length > 0);
  run(room, clock, () => g.phase === 'parade');
  assert(g.entries.length <= 8);
  run(room, clock, () => g.phase === 'vote');
  assert(g.tv().memes.length <= 8);
  run(room, clock, () => g.phase === 'over', 400000);
  assert.equal(g.results().length, 24);
});

test('a player who leaves mid-round does not stall the game', () => {
  const { clock, room } = make(3);
  const p = room.join('Ana').player; p.sockets = 1;
  room.start(); const g = room.game;
  run(room, clock, () => g.phase === 'write');
  const t = clock.now(); room.remove(p.id);
  run(room, clock, () => g.phase === 'parade');
  assert(clock.now() - t < 30000, 'moved on without waiting for the full timer');
  run(room, clock, () => g.phase === 'over');
});

test('host Next skips through every phase', () => {
  const { room } = make(3); room.start(); const g = room.game;
  let i = 0; while (g.phase !== 'over' && i++ < 200) g.next();
  assert.equal(g.phase, 'over');
});

test('Family Mode (room.family): Uncut/Party lock to family: strict filter, no party situations, in any theme', () => {
  const party = new Set(def.PARTY_SITUATIONS);
  for (const theme of ['everyday', 'mix', 'holiday']) {
    const { clock, room } = make(4, { content: 'uncut', rounds: 5, theme }, 3);
    room.family = true;
    const p = room.join('Ana').player; p.sockets = 1; room.start(); const g = room.game;
    assert.equal(g.level(), 'family');
    assert(g.sitPool().every((x) => !party.has(x)), theme + ' pool');
    run(room, clock, () => g.phase === 'write');
    room.act(p, { op: 'post', caps: ['oh crap', 'damn it'] });
    const seen = [];
    run(room, clock, () => { if (g.prompt) seen.push(g.prompt); for (const c of g.cards.values()) seen.push(...c.ideas); return g.phase === 'over'; }, 400000);
    assert(seen.length && seen.every((x) => !party.has(x)), theme + ': ' + seen.find((x) => party.has(x)));
    const m = g.all.concat(g.entries).find((x) => x.by === p.id);
    assert(m, "my meme"); assert(!/crap|damn/i.test(m.caps.join(" ")), "strict filter");
  }
  const { room } = make(3, { content: 'party' }); room.start(); // Family Mode off: Party still adds its situations
  assert.equal(room.game.level(), 'party'); assert(room.game.sitPool().some((x) => party.has(x)));
});

test('Situation themes: Holiday, Office-safe, Classics and Travel are offered and play end to end', () => {
  const opts = def.fields.find((f) => f.key === 'theme').options.map((o) => o.value);
  assert(opts.includes(def.defaults.theme));
  const all = Object.values(def.THEMES).flat(); assert.equal(new Set(all).size, all.length, 'no duplicate situations');
  for (const theme of ['holiday', 'office', 'classics', 'travel']) {
    assert(opts.includes(theme) && def.THEMES[theme].length >= 40, theme);
    const { clock, room } = make(5, { rounds: 3, theme, content: 'party' }, 2);
    room.start(); const g = room.game; const prompts = [];
    run(room, clock, () => { if (g.prompt) prompts.push(g.prompt); for (const c of g.cards.values()) prompts.push(...c.ideas); return g.phase === 'over'; }, 400000);
    assert.equal(g.phase, 'over');
    assert(prompts.length && prompts.every((x) => def.THEMES[theme].includes(x)), theme + ': ' + prompts.find((x) => !def.THEMES[theme].includes(x)));
  }
});

console.log(`\n${passed} Meme Maker tests passed.`);
