'use strict';
// Act It Out rules: bots play whole games on a virtual clock; scoring, twists, guess matching,
// validation and results().  node tools/test-box-actout.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/actout');
const PR = require('../box/games/actout-prompts');
const { judge, GUESS, ACT, SPEED, TWIST_BONUS, CLAP, FINAL_MULT, CAST_MS, CUE_MS } = def._test;
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const mk = (s) => ({ answers: s.split('|') });
function room(opts = {}) {
  const clock = new VirtualClock(), r = new BoxRoom('TEST', def, { clock, seed: opts.seed || 7 });
  Object.assign(r.settings, opts.settings || {});
  if (opts.family != null) r.family = opts.family;
  return { r, clock };
}
// Move the virtual clock forward by ms, firing every timer due on the way.
function advance(clock, ms) { const end = clock.t + ms; for (;;) { let next = null; for (const e of clock.queue.values()) if (e.at <= end && (!next || e.at < next.at || (e.at === next.at && e.id < next.id))) next = e; if (!next) break; clock.step(); } clock.t = end; }
const run = (r, clock, until, cap = 200000) => { let i = 0; while (!until() && clock.step()) if (++i > cap) throw new Error('stuck'); };
const toPhase = (r, clock, ph) => run(r, clock, () => r.game.phase === ph || r.game.phase === 'over');
// Humans need a socket to count as voters.
const human = (r, name) => { const p = r.join(name).player; p.sockets = 1; return p; };

test('300+ original prompts, family and party packs, every category has prompts', () => {
  assert(PR.ALL.length >= 300, 'prompt count ' + PR.ALL.length);
  assert(PR.FAMILY.length >= 220 && PR.PARTY.length >= 60);
  for (const c of Object.keys(PR.CATS)) assert(PR.ALL.some((x) => x.cat === c), 'category ' + c);
  assert.equal(new Set(PR.ALL.map((x) => x.text.toLowerCase())).size, PR.ALL.length, 'no duplicate prompts');
  for (const x of PR.ALL) assert(x.text.length <= 60 && x.answers.length >= 1);
});

test('fuzzy matching: typos, plurals, verb forms, synonyms, filler words; wrong stays wrong', () => {
  const right = [['penguen', 'Penguin'], ['brush lions teeth', 'Brushing a lion’s teeth'], ['afraid', 'Terrified'], ['fireman', 'Firefighter'], ['is it a dentist?', 'Dentist'],
    ['giant hamster', 'Attack of the Giant Hamster'], ['haunted toaster', 'The Haunted Toaster'], ['juggle', 'Juggling'], ['ping pong', 'Table tennis|ping pong'], ['Ice-Skating!!', 'Ice skating'], ['puppy', 'Dog'], ['bunny', 'Rabbit|bunny']];
  for (const [g, a] of right) assert.equal(judge(g, mk(a)), 'right', `${g} -> ${a}`);
  for (const [g, a] of [['toaster', 'The Haunted Toaster'], ['pengu', 'Penguin'], ['skating', 'Ice skating']]) assert.equal(judge(g, mk(a)), 'close', `${g} ~ ${a}`);
  for (const [g, a] of [['dog', 'Cat'], ['monkey', 'Gorilla'], ['', 'Cat'], ['the', 'Juggling'], ['penguin elephant shark lion tiger bear cat dog', 'Cat']]) assert.notEqual(judge(g, mk(a)), 'right', `${g} !-> ${a}`);
});

test('bots play a whole game with every twist; results() lists everyone best-first', () => {
  const { r, clock } = room({ settings: { turns: 12, twists: 'lots' } });
  r.addBots(6); assert(r.start().ok);
  const kinds = new Set();
  run(r, clock, () => { if (r.game.t) kinds.add(r.game.t.kind); return r.game.phase === 'over'; });
  assert.equal(r.game.phase, 'over');
  for (const k of ['classic', 'silent', 'sound', 'style', 'freeze', 'relay', 'scene']) assert(kinds.has(k), 'twist ' + k);
  const res = r.game.results(); assert.equal(res.length, 6);
  const pts = res.map((id) => r.game.scores.get(id)); for (let i = 1; i < pts.length; i++) assert(pts[i - 1] >= pts[i]);
  assert(pts[0] > 0, 'somebody scored');
  const tv = r.game.tv(); assert(tv.final && tv.final.awards.length >= 2, 'awards at the end');
  assert(tv.final.awards.some((a) => a.title === 'Oscar-worthy'));
});

test('every actor gets a turn; big rooms cast pairs or trios', () => {
  const { r, clock } = room({ settings: { turns: 6, twists: 'off' } });
  r.addBots(12); r.start();
  assert.equal(r.game.t.cast.length, 3, '12+ players: trio');
  run(r, clock, () => r.game.phase === 'over');
  const { r: r2, clock: c2 } = room({ settings: { turns: 4, twists: 'off' } }); r2.addBots(5); r2.start();
  const seen = new Set(); run(r2, c2, () => { for (const id of r2.game.t.cast) seen.add(id); return r2.game.phase === 'over'; });
  assert.equal(seen.size, 4, 'four turns, four different actors');
  assert.equal(r2.game.t.cast.length, 1);
});

test('scoring: first right guess + actor with speed bonus; twist bonus; applause; final turn doubles', () => {
  const { r, clock } = room({ settings: { turns: 3, twists: 'off', seconds: 60 } });
  const ana = human(r, 'Ana'), ben = human(r, 'Ben'), cat = human(r, 'Cat'); r.start();
  const g = r.game, actor = r.get(g.t.cast[0]), [g1, g2] = [ana, ben, cat].filter((p) => p !== actor);
  assert.equal(r.act(g1, { op: 'guess', text: 'x' }).ok, false, 'no guessing before ACTION');
  assert(r.act(actor, { op: 'ready' }).ok); assert.equal(g.phase, 'cue');
  advance(clock, CUE_MS); assert.equal(g.phase, 'act');
  advance(clock, 30000); // half the time gone
  const text = g.t.prompts[0].answers[0];
  assert.equal(r.act(g1, { op: 'guess', text: 'zzzz qqq' }).res, 'no');
  advance(clock, 700);
  const res = r.act(g2, { op: 'guess', text }); assert.equal(res.res, 'right');
  const speed = Math.round((SPEED * (29300 / 60000)) / 10) * 10;
  assert.equal(g.scores.get(g2.id), GUESS + speed);
  assert.equal(g.scores.get(actor.id), ACT + speed);
  assert.equal(g.scores.get(g1.id), 0);
  toPhase(r, clock, 'bravo');
  assert.equal(r.act(actor, { op: 'clap', id: actor.id }).ok, false, 'no self-applause');
  assert(r.act(g1, { op: 'clap', id: actor.id }).ok);
  assert.equal(r.act(g1, { op: 'clap', id: actor.id }).ok, false, 'one clap each');
  assert.equal(g.scores.get(actor.id), ACT + speed + CLAP);
  // twist bonus: turn 2 with twists forced on
  g.s.twists = 'lots'; r.act(g2, { op: 'clap', id: actor.id });
  toPhase(r, clock, 'cast'); assert.notEqual(g.t.kind, 'classic');
  const a2 = r.get(g.t.cast[0]), before = g.scores.get(a2.id), guesser = [ana, ben, cat].find((p) => !g.t.cast.includes(p.id));
  r.act(a2, { op: 'ready' }); advance(clock, CUE_MS);
  r.act(a2, { op: 'got', id: guesser.id });
  assert.equal(g.scores.get(a2.id) - before, ACT + SPEED + TWIST_BONUS, 'instant solve, full speed + twist bonus');
  // final turn doubles
  toPhase(r, clock, 'cast'); assert.equal(g.n, 3); assert(g.isFinal());
  const a3 = r.get(g.t.cast[0]), b3 = g.scores.get(a3.id), q3 = [ana, ben, cat].find((p) => !g.t.cast.includes(p.id)), qb = g.scores.get(q3.id);
  r.act(a3, { op: 'ready' }); advance(clock, CUE_MS);
  if (g.t.prompts.length > 1) for (let k = 1; k < g.t.prompts.length; k++) g.t.prompts[k].gone = true;
  r.act(q3, { op: 'guess', text: g.t.prompts[g.t.role.get(a3.id)].answers[0] });
  assert.equal(g.scores.get(q3.id) - qb, (GUESS + SPEED) * FINAL_MULT);
  assert(g.scores.get(a3.id) - b3 >= (ACT + SPEED) * FINAL_MULT);
  run(r, clock, () => g.phase === 'over');
  assert.equal(g.results().length, 3);
});

test('nobody gets it: the turn times out, the prompt is revealed, no points', () => {
  const { r, clock } = room({ settings: { turns: 1, twists: 'off', seconds: 45 } });
  const a = human(r, 'Ana'); human(r, 'Ben'); human(r, 'Cat'); r.start();
  toPhase(r, clock, 'bravo');
  const tv = r.game.tv();
  assert(tv.prompts[0].text, 'revealed'); assert.equal(tv.prompts[0].solved, null);
  for (const p of r.list()) assert.equal(r.game.scores.get(p.id), 0);
  assert(r.game.view(a).prompts[0].text);
});

test('secrets: guessers never see an unsolved prompt; scene actors only see their own', () => {
  const { r, clock } = room({ settings: { turns: 4, twists: 'lots' } });
  const ps = ['Ana', 'Ben', 'Cat', 'Dan', 'Eve'].map((n) => human(r, n)); r.start();
  let checkedScene = false;
  run(r, clock, () => {
    const g = r.game, t = g.t;
    if (g.phase === 'act' || g.phase === 'cast') {
      for (const p of ps) {
        const v = JSON.stringify(r.playerState(p)), mine = t.cast.includes(p.id) ? t.role.get(p.id) : -1;
        t.prompts.forEach((pr, k) => { if (!pr.solved && k !== mine) assert(!v.includes(JSON.stringify(pr.text)), `${p.name} sees prompt ${k}`); });
      }
      const tvs = JSON.stringify(r.tvState()); for (const pr of t.prompts) if (!pr.solved) assert(!tvs.includes(JSON.stringify(pr.text)), 'TV leaks the prompt');
      if (t.kind === 'scene') checkedScene = true;
      if (g.phase === 'cast') r.act(r.get(t.cast[0]), { op: 'ready' });
    }
    return g.phase === 'over';
  });
  assert(checkedScene, 'a two-person scene was checked');
});

test('two-person scene: two prompts in different categories, each solved separately', () => {
  const { r, clock } = room({ settings: { turns: 2, twists: 'lots' } });
  const ps = ['Ana', 'Ben', 'Cat', 'Dan'].map((n) => human(r, n)); r.start();
  const g = r.game;
  toPhase(r, clock, 'bravo'); g.twistDeck = ['scene']; g.next();
  assert.equal(g.t.kind, 'scene'); assert.equal(g.t.prompts.length, 2); assert.notEqual(g.t.prompts[0].cat, g.t.prompts[1].cat);
  const [a, b] = g.t.cast.map((id) => r.get(id)), q = ps.find((p) => !g.t.cast.includes(p.id));
  r.act(a, { op: 'ready' }); advance(clock, CUE_MS);
  const before = g.scores.get(b.id);
  r.act(q, { op: 'guess', text: g.t.prompts[g.t.role.get(a.id)].answers[0] });
  assert(g.t.prompts[g.t.role.get(a.id)].solved); assert.equal(g.phase, 'act', 'still acting the other prompt');
  assert.equal(g.scores.get(b.id), before, 'the other actor scores only for their own prompt');
  advance(clock, 700);
  r.act(q, { op: 'guess', text: g.t.prompts[g.t.role.get(b.id)].answers[0] });
  assert(g.scores.get(b.id) > before);
  advance(clock, 2000); assert.equal(g.phase, 'bravo');
});

test('relay passes the spotlight; freeze frame counts poses', () => {
  const { r, clock } = room({ settings: { turns: 3, twists: 'lots', seconds: 60 } });
  ['Ana', 'Ben', 'Cat', 'Dan', 'Eve'].forEach((n) => human(r, n)); r.start();
  const g = r.game;
  toPhase(r, clock, 'bravo'); g.twistDeck = ['relay']; g.next();
  assert.equal(g.t.kind, 'relay'); assert(g.t.cast.length >= 2);
  const [first, second] = g.t.cast.map((id) => r.get(id));
  r.act(first, { op: 'ready' }); advance(clock, CUE_MS);
  assert.equal(g.tv().relay.id, first.id);
  assert.equal(r.act(second, { op: 'pass' }).ok, false, 'only the runner on stage passes');
  assert(r.act(first, { op: 'pass' }).ok); assert.equal(g.tv().relay.id, second.id);
  g.next(); toPhase(r, clock, 'bravo'); g.twistDeck = ['freeze']; g.next();
  assert.equal(g.t.kind, 'freeze'); r.act(r.get(g.t.cast[0]), { op: 'ready' }); advance(clock, CUE_MS);
  assert.equal(g.tv().pose.n, 1); advance(clock, 15001); assert.equal(g.tv().pose.n, 2); advance(clock, 30000); assert.equal(g.tv().pose.n, 4);
});

test('skip: once per prompt, gives a fresh prompt and is shown at the reveal', () => {
  const { r, clock } = room({ settings: { turns: 1, twists: 'off' } });
  const ps = ['Ana', 'Ben', 'Cat'].map((n) => human(r, n)); r.start();
  const g = r.game, actor = r.get(g.t.cast[0]), other = ps.find((p) => p !== actor), old = g.t.prompts[0].text;
  assert.equal(r.act(other, { op: 'skip' }).ok, false);
  assert(r.act(actor, { op: 'skip' }).ok); assert.notEqual(g.t.prompts[0].text, old);
  assert.equal(r.act(actor, { op: 'skip' }).ok, false, 'only one skip');
  toPhase(r, clock, 'bravo'); assert.deepEqual(g.tv().prompts[0].skipped, [old]);
});

test('family flag and family pack keep to the family prompts', () => {
  for (const opts of [{ family: true, settings: { pack: 'mix' } }, { settings: { pack: 'family' } }]) {
    const { r, clock } = room({ ...opts, settings: { ...opts.settings, turns: 12 } }); r.addBots(4); r.start();
    const fam = new Set(PR.FAMILY.map((x) => x.text));
    run(r, clock, () => { for (const pr of r.game.t.prompts) assert(fam.has(pr.text), 'party prompt in family mode: ' + pr.text); return r.game.phase === 'over'; });
  }
  const { r } = room({ settings: { pack: 'party' } }); r.addBots(4); r.start();
  assert(PR.PARTY.some((x) => x.text === r.game.t.prompts[0].text));
});

test('phone input is validated', () => {
  const { r, clock } = room({ settings: { turns: 2, twists: 'off' } });
  const ps = ['Ana', 'Ben', 'Cat'].map((n) => human(r, n)); r.start();
  const g = r.game, actor = r.get(g.t.cast[0]), q = ps.find((p) => p !== actor);
  for (const bad of [{ op: 'nope' }, {}, { op: 5 }, { op: 'ready' }, { op: 'got', id: q.id }, { op: 'clap', id: actor.id }, { op: 'guess', text: 'cat' }, { op: 'pass' }]) assert.equal(r.act(q, bad).ok, false, JSON.stringify(bad));
  r.act(actor, { op: 'ready' }); advance(clock, CUE_MS);
  for (const bad of [{ op: 'guess' }, { op: 'guess', text: '' }, { op: 'guess', text: '   ' }, { op: 'guess', text: 42 }, { op: 'guess', text: '<<>>' }]) assert.equal(r.act(q, bad).ok, false, JSON.stringify(bad));
  assert.equal(r.act(actor, { op: 'guess', text: 'hi' }).ok, false, 'actors cannot guess');
  for (const bad of [{ op: 'got' }, { op: 'got', id: actor.id }, { op: 'got', id: 'p999' }, { op: 'got', id: { x: 1 } }]) assert.equal(r.act(actor, bad).ok, false, JSON.stringify(bad));
  assert(r.act(q, { op: 'guess', text: 'a'.repeat(500) }).ok, 'long guesses are trimmed');
  assert.equal(g.t.feed[g.t.feed.length - 1].text.length, 60);
  assert.equal(r.act(q, { op: 'guess', text: 'again' }).ok, false, 'rate limited');
  advance(clock, 700); assert(r.act(q, { op: 'guess', text: '<b>hi</b>' }).ok); assert(!g.t.feed[g.t.feed.length - 1].text.includes('<'));
  const late = r.join('Zed').player; assert.equal(g.view(late).role, 'guesser', 'late joiners can guess');
});

test('the actor leaving ends the scene; the game goes on', () => {
  const { r, clock } = room({ settings: { turns: 3, twists: 'off' } });
  ['Ana', 'Ben', 'Cat', 'Dan'].forEach((n) => human(r, n)); r.start();
  const g = r.game; r.act(r.get(g.t.cast[0]), { op: 'ready' }); advance(clock, CUE_MS);
  r.remove(g.t.cast[0]); assert.equal(g.phase, 'bravo');
  run(r, clock, () => g.phase === 'over'); assert.equal(g.results().length, 3);
});

test('applause ends early once everyone has clapped; the host can skip every phase', () => {
  const { r, clock } = room({ settings: { turns: 2, twists: 'off' } });
  const ps = ['Ana', 'Ben', 'Cat'].map((n) => human(r, n)); r.start();
  const g = r.game; g.next(); assert.equal(g.phase, 'cue'); g.next(); assert.equal(g.phase, 'act'); g.next(); assert.equal(g.phase, 'bravo');
  for (const p of ps) if (!g.t.cast.includes(p.id)) r.act(p, { op: 'clap', id: g.t.cast[0] });
  assert(g.endsAt - r.now() <= 4000, 'applause wraps up quickly');
  advance(clock, 4100); assert.equal(g.phase, 'cast'); assert.equal(g.n, 2);
  advance(clock, CAST_MS); assert.equal(g.phase, 'cue', 'auto-start if the actor never taps ready');
});

console.log(`\n${passed} Act It Out tests passed.`);
