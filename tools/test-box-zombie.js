'use strict';
// Zombie Survival: choice-driven fates (no per-person dice), items and story flags paying off
// later (the flashlight in the dark, day one on the last night), the story content, the plan,
// input validation, bites and medkits, group dynamics, ghosts, difficulty, results() by how
// far everyone got, and whole games at 1, 4 and 12 players (and 100 for the payload).
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/zombie');
const { ITEMS, FLAGS, CHAPTERS, SCENARIOS, TOLD } = def._test;

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function setup({ bots = 0, humans = [], settings = {}, seed = 7 } = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  room.addBots(bots); Object.assign(room.settings, settings);
  const H = humans.map((n) => room.join(n).player);
  return { clock, room, H };
}
const g = (room) => room.game;
function runOut(room, clock, limit = 3000000) { let i = 0; while (g(room).phase !== 'over' && clock.step()) if (++i > limit) throw new Error('never ended: ' + g(room).phase); return i; }
function until(room, clock, phase) { let i = 0; while (g(room).phase !== phase) { if (!clock.step() || ++i > 300000) throw new Error(`never reached ${phase} (at ${g(room).phase})`); } }
const ok = (r) => assert.equal(r.ok, true, r.error);
const bad = (r, re) => { assert.equal(r.ok, false); if (re) assert.match(r.error, re); };
const json = (x) => JSON.stringify(x);
const SC = new Map(SCENARIOS.map((s) => [s.id, s]));
// Force the current scene to a given scenario, with no twists (tests need known outcomes).
function force(room, id, { twist = false } = {}) { const sc = TOLD[0].SC.get(id); const r = g(room).r; r.sc = sc; if (!twist) r.twist = new Map(); r.panic = 0; return sc; }
const me = (room, p) => g(room).ppl.get(p.id);
const give = (room, p, k, n) => me(room, p).items.push({ k, n: n == null ? (ITEMS[k].uses || null) : n });
const fate = (room, p) => g(room).r.fates.get(p.id).fate;
function condAtoms(c, out = []) { if (!c || typeof c !== 'object') return out; if (c.has) out.push(['has', c.has]); if (c.flag) out.push(['flag', c.flag]); if (c.not) condAtoms(c.not, out); for (const x of [].concat(c.all || [], c.any || [])) condAtoms(x, out); return out; }

test('Content: 50+ original scenarios, valid danger/items/flags/rules, every chapter stocked, finals', () => {
  assert(SCENARIOS.length >= 50, 'scenarios: ' + SCENARIOS.length);
  const ids = new Set();
  for (const s of SCENARIOS) {
    assert(!ids.has(s.id), 'duplicate ' + s.id); ids.add(s.id);
    assert(s.options.length >= 3 && s.options.length <= 5, s.id);
    assert(s.title && s.text && s.text.length < 260, s.id);
    assert(s.options.some((o) => !o.need), s.id + ' needs a choice anyone can take');
    for (const o of s.options) {
      const at = s.id + '/' + o.k;
      assert(o.k && o.icon && o.label && o.ok && o.bad && Number.isInteger(o.danger) && o.danger >= 0 && o.danger <= 3, at);
      assert(!('risk' in o), at + ' still has a dice risk');
      for (const k of [].concat(o.gain || [], o.need || [], Object.keys(o.help || {}))) assert(ITEMS[k], at + ' unknown item ' + k);
      for (const v of Object.values(o.help || {})) assert(['safe', 'hurt', 'bitten'].includes(v), at);
      for (const f of [o.setFlag, o.badFlag]) if (f) assert(FLAGS[f], at + ' unknown flag ' + f);
      for (const r of o.outcomes || []) {
        assert(r.if && r.line, at + ' rule needs if + line');
        assert(!r.result || ['safe', 'hurt', 'bitten', 'dead'].includes(r.result), at);
        assert(!r.shift || r.shift === 1 || r.shift === -1, at);
        for (const [t, k] of condAtoms(r.if)) assert(t === 'has' ? ITEMS[k] : FLAGS[k], at + ' unknown ' + t + ' ' + k);
        for (const k of [r.use, r.gain]) if (k) assert(ITEMS[k], at);
        if (r.setFlag) assert(FLAGS[r.setFlag], at);
      }
    }
    if (s.group && s.group.type === 'hold') assert(s.options.some((o) => o.role === 'hold') && s.options.some((o) => o.role === 'run'), s.id);
    if (s.group && s.group.type === 'cover') assert(s.options.some((o) => o.role === 'cover'), s.id);
  }
  for (const c of CHAPTERS) if (c.key !== 'rescue') assert(SCENARIOS.filter((s) => s.ch === c.key).length >= 5, c.key);
  assert(SCENARIOS.filter((s) => s.final).length >= 2);
  assert.deepEqual(SCENARIOS.filter((s) => s.first).map((s) => s.id), ['hardware', 'neighbor']);
  // every flag is both earned somewhere and checked somewhere
  const set = new Set(), checked = new Set();
  for (const s of SCENARIOS) for (const o of s.options) { for (const f of [o.setFlag, o.badFlag, ...(o.outcomes || []).map((r) => r.setFlag)]) if (f) set.add(f); for (const r of o.outcomes || []) for (const [t, k] of condAtoms(r.if)) if (t === 'flag') checked.add(k); }
  for (const f of Object.keys(FLAGS)) { assert(set.has(f), 'never earned: ' + f); assert(checked.has(f), 'never checked: ' + f); }
  for (const k of Object.keys(ITEMS)) assert(ITEMS[k].hint, 'item hint: ' + k);
  // the dark scenes: a flashlight decides it
  for (const id of ['morgue', 'tunnel', 'cellar']) assert(SC.get(id).options.some((o) => (o.outcomes || []).some((r) => r.if.has === 'flashlight' && r.result === 'safe')), id);
  // the last night remembers several things, day one among them
  for (const s of SCENARIOS.filter((x) => x.final)) {
    const flags = new Set(s.options.flatMap((o) => (o.outcomes || []).flatMap((r) => condAtoms(r.if).filter(([t]) => t === 'flag').map(([, k]) => k))));
    assert(flags.has('helped_neighbor') && flags.has('left_door_open') && flags.size >= 3, s.id + ' checks ' + [...flags]);
  }
  for (const f of def.fields) assert(f.options.some((o) => o.value === def.defaults[f.key]), f.key);
  assert.equal(def.locked.how, 'Finish a Party Mode to unlock it.');
});

test('Story plan: six days in order, hardware then Mrs. Delgado first, the rescue last, every later day remembers an earlier one', () => {
  const lens = {};
  for (const length of ['short', 'normal', 'long']) {
    for (let seed = 1; seed <= 25; seed++) {
      const { room } = setup({ bots: 4, settings: { length }, seed }); room.start();
      const plan = g(room).plan;
      lens[length] = plan.length;
      assert.deepEqual(plan.slice(0, 2).map((p) => p.id), ['hardware', 'neighbor']);
      assert(SC.get(plan[plan.length - 1].id).final);
      assert.deepEqual([...new Set(plan.map((p) => p.ch))], CHAPTERS.map((c) => c.key));
      assert.equal(new Set(plan.map((p) => p.id)).size, plan.length, 'no repeats');
      for (const c of CHAPTERS.slice(1)) assert(plan.some((p) => p.ch === c.key && TOLD[0].SC.get(p.id).callback), `${length}/${seed}: day ${c.day} has a callback scene`);
      assert.equal(g(room).phase, 'chapter');
    }
  }
  assert(lens.short < lens.normal && lens.normal < lens.long, json(lens));
});

test('Determinism: people with the same history who make the same choices share every fate, all game long', () => {
  for (const difficulty of ['forgiving', 'normal', 'brutal']) {
    for (let seed = 1; seed <= 6; seed++) {
      // three pairs of twins; each pair always picks the same thing, different from the other pairs
      const { room, clock, H } = setup({ humans: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'], settings: { difficulty, ghosts: false }, seed });
      room.start();
      let scenes = 0, last = null;
      while (g(room).phase !== 'over' && clock.step()) {
        const G = g(room);
        if (G.phase === 'choose' && G.r !== last) {
          last = G.r;
          H.forEach((p, i) => {
            const x = me(room, p); if (!x.alive) return;
            const opts = G.r.sc.options.filter((o) => !G.locked(x, o));
            ok(room.act(p, { op: 'choose', k: opts[Math.floor(i / 2) % opts.length].k }));
          });
        }
        if (G.phase === 'outcome' && G.r.fates.size && G.r.counted !== true) {
          G.r.counted = true; scenes++;
          for (let i = 0; i < 6; i += 2) {
            const a = G.r.fates.get(H[i].id), b = G.r.fates.get(H[i + 1].id);
            assert.equal(!!a, !!b, 'both in the scene'); if (!a) continue;
            assert.equal(a.fate, b.fate, `${difficulty}/${seed} scene ${G.r.n}: twins split`);
            const x = me(room, H[i]), y = me(room, H[i + 1]);
            assert.equal(x.alive, y.alive); assert.equal(x.status, y.status);
            assert.deepEqual([...x.flags].sort(), [...y.flags].sort());
            assert.deepEqual(x.items, y.items);
          }
        }
      }
      assert(scenes >= 2);
    }
  }
});

test('Determinism: the same option has the same twist for everybody, and replaying a room gives the same story', () => {
  const play = () => {
    const { room, clock } = setup({ bots: 8, seed: 42, settings: { ghosts: false } });
    room.start(); runOut(room, clock);
    return g(room).epilogue.fates.map((f) => f.id + ':' + f.reach);
  };
  assert.deepEqual(play(), play());
});

test('The flashlight: in the dark basement, the one with a light slips past and the one without gets bitten', () => {
  const { room, clock, H: [ana, ben, cy] } = setup({ humans: ['Ana', 'Ben', 'Cy'] });
  room.start(); until(room, clock, 'choose'); force(room, 'morgue');
  give(room, ana, 'flashlight');
  me(room, cy).flags.add('has_dog');
  for (const p of [ana, ben, cy]) ok(room.act(p, { op: 'choose', k: 'light' }));
  // the phone hints that Ana's gear could help, without saying how much
  assert(room.playerState(ana).state.boost.includes('light'));
  assert(!room.playerState(ben).state.boost.includes('light'));
  g(room).next();
  assert.equal(fate(room, ana), 'safe');
  assert.equal(fate(room, ben), 'bitten');
  assert.equal(fate(room, cy), 'hurt', 'Biscuit growls a warning');
  const G = g(room).r.outcome.groups.find((x) => x.k === 'light');
  assert.match(G.line, /Ana clicked on a flashlight/); assert.match(G.line, /Ben had no light/); assert.match(G.line, /Biscuit/);
  const pa = G.people.find((p) => p.id === ana.id), pb = G.people.find((p) => p.id === ben.id);
  assert.equal(pa.why.icon, '🔦'); assert(pa.saved); assert(pb.doomed && pb.why.bad);
  assert(me(room, ana).items.some((i) => i.k === 'flashlight'), 'a flashlight doesn’t run out');
  const v = room.playerState(ana).state;
  assert(v.mine.saved && /flashlight/.test(v.mine.why.text));
  // The same light, the same verdict on every difficulty.
  for (const difficulty of ['forgiving', 'brutal']) {
    const s = setup({ humans: ['Ana', 'Ben'], settings: { difficulty } });
    s.room.start(); until(s.room, s.clock, 'choose'); force(s.room, 'cellar');
    give(s.room, s.H[0], 'flashlight');
    for (const p of s.H) ok(s.room.act(p, { op: 'choose', k: 'face' }));
    g(s.room).next();
    assert.equal(fate(s.room, s.H[0]), 'safe'); assert.equal(fate(s.room, s.H[1]), 'bitten');
  }
});

test('Day one decides the last night: Mrs. Delgado’s son saves a seat; the open shutter brings the horde', () => {
  // Day one: the choice that sets the flags.
  const { room, clock, H: [ana, ben, cy] } = setup({ humans: ['Ana', 'Ben', 'Cy'] });
  room.start(); until(room, clock, 'choose'); force(room, 'neighbor');
  give(room, ana, 'bat');
  ok(room.act(ana, { op: 'choose', k: 'delgado' })); ok(room.act(ben, { op: 'choose', k: 'shutter' })); ok(room.act(cy, { op: 'choose', k: 'run' }));
  g(room).next();
  assert(me(room, ana).flags.has('helped_neighbor')); assert(me(room, cy).flags.has('left_door_open'));
  assert(!me(room, ben).flags.has('helped_neighbor') && !me(room, ben).flags.has('left_door_open'));
  assert(room.playerState(cy).state.me.flags.some((f) => f.k === 'left_door_open' && f.bad), 'the phone shows the badge');
  // The last night: everyone climbs the ladder with no rope, and nobody holds the roof (a step worse).
  until(room, clock, 'choose');
  g(room).idx = g(room).plan.length - 1; g(room).r.n = g(room).plan.length;
  for (const x of [ana, ben, cy].map((p) => me(room, p))) { x.items = []; x.status = 'ok'; x.alive = true; }
  force(room, 'chopper');
  give(room, ben, 'medkit');
  for (const p of [ana, ben, cy]) ok(room.act(p, { op: 'choose', k: 'ladder' }));
  g(room).next();
  assert.equal(fate(room, ana), 'safe'); assert.equal(fate(room, ben), 'bitten'); assert.equal(fate(room, cy), 'dead');
  assert(me(room, ben).alive, 'a fresh bite on the last night needs a medkit right away: Ben had one');
  const line = g(room).r.outcome.groups[0].line;
  assert.match(line, /Ana saved Mrs\. Delgado on day one/);
  assert.match(line, /Because Cy\b[^.]*left Hank’s shutter open on day one, the horde followed/);
  room.hostAction({ type: 'next' }); assert.equal(g(room).phase, 'over');
  const E = g(room).epilogue;
  assert(E.rescued.some((p) => p.id === ana.id) && E.rescued.some((p) => p.id === ben.id) && !E.rescued.some((p) => p.id === cy.id));
  assert.deepEqual(g(room).results().slice(0, 2).sort(), [ana.id, ben.id].sort());
  assert.equal(g(room).results()[2], cy.id);
  assert.match(E.fates.find((f) => f.id === cy.id).line, /made it to Day/);
});

test('Items with uses get used up; a medkit patches a second injury; a gift that saves a friend scores for the giver', () => {
  const { room, clock, H: [ana, ben, cy] } = setup({ humans: ['Ana', 'Ben', 'Cy'] });
  room.start(); until(room, clock, 'choose'); force(room, 'escalator');
  give(room, ana, 'gun', 3);
  ok(room.act(ana, { op: 'choose', k: 'shoot' })); ok(room.act(ben, { op: 'choose', k: 'shoot' })); ok(room.act(cy, { op: 'choose', k: 'fountain' }));
  g(room).next();
  assert.equal(fate(room, ana), 'safe'); assert.equal(fate(room, ben), 'bitten'); // deadly without the gun (Normal)
  assert.equal(me(room, ana).items.find((i) => i.k === 'gun').n, 2, 'one bullet spent');
  assert.equal(me(room, ana).st.savedBy, 1);
  // second injury + medkit = patched, not dead
  until(room, clock, 'choose'); force(room, 'skylight');
  const C = me(room, cy); C.status = 'hurt'; C.hurtAt = g(room).r.n; C.items = [{ k: 'medkit', n: 1 }];
  for (const p of [ana, ben, cy]) if (me(room, p).alive) ok(room.act(p, { op: 'choose', k: p === cy ? 'boost' : 'stay' }));
  g(room).next();
  assert.equal(fate(room, cy), 'hurt'); assert(C.alive); assert(!C.items.some((i) => i.k === 'medkit'));
  assert.match(g(room).r.outcome.groups.find((x) => x.k === 'boost').line, /medkit patched/);
  // Ana hands Cy her rope; it saves Cy on the drainpipe; Ana scores for it
  until(room, clock, 'choose'); force(room, 'skylight');
  give(room, ana, 'rope'); C.status = 'ok';
  const before = me(room, ana).pts;
  ok(room.act(ana, { op: 'give', item: 'rope', to: cy.id }));
  ok(room.act(cy, { op: 'choose', k: 'pipe' })); ok(room.act(ana, { op: 'choose', k: 'stay' })); if (me(room, ben).alive) ok(room.act(ben, { op: 'choose', k: 'stay' }));
  g(room).next();
  assert.equal(fate(room, cy), 'safe');
  assert.equal(me(room, ana).pts - before, 20 + 40 + 100, 'gift + the save + surviving');
  assert.match(g(room).r.outcome.groups.find((x) => x.k === 'pipe').line, /a gift from Ana/);
});

test('Shift rules stack: a bad ankle and the horde’s scent make things worse; items cap first', () => {
  const { room, clock, H: [ana, ben, cy] } = setup({ humans: ['Ana', 'Ben', 'Cy'] });
  room.start(); until(room, clock, 'choose'); force(room, 'chopper');
  g(room).idx = g(room).plan.length - 1;
  give(room, ana, 'rope'); me(room, ana).flags.add('injured_leg');
  give(room, ben, 'rope');
  me(room, cy).flags.add('injured_leg'); me(room, cy).flags.add('marked_by_horde');
  ok(room.act(ana, { op: 'choose', k: 'ladder' })); ok(room.act(ben, { op: 'choose', k: 'ladder' })); ok(room.act(cy, { op: 'choose', k: 'guard' }));
  const G = g(room), o = G.r.sc.options.find((x) => x.k === 'ladder');
  assert.equal(G.judge(me(room, ana), o).tier, 1, 'rope caps to safe, the ankle adds a step');
  assert.equal(G.judge(me(room, ben), o).tier, 0);
  const guard = G.r.sc.options.find((x) => x.k === 'guard');
  assert.equal(G.judge(me(room, cy), guard).tier, 3, 'deadly, and the scent only makes it worse');
});

test('Hold the door: enough holders make the runners a step safer; nobody holding makes them a step worse', () => {
  for (const hold of [true, false]) {
    const { room, clock, H } = setup({ humans: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'] });
    room.start(); until(room, clock, 'choose'); force(room, 'pemberton');
    H.forEach((p, i) => ok(room.act(p, { op: 'choose', k: hold && i < 3 ? 'hold' : 'back' })));
    g(room).next();
    const out = g(room).r.outcome;
    assert.equal(out.groupOk, hold); assert.match(out.groupLine, hold ? /held/ : /gave way/);
    for (const [, f] of g(room).r.fates) if (f.o.k === 'back') assert.equal(f.fate, hold ? 'safe' : 'hurt');
  }
});

test('Cover: one decoy makes everyone else a step safer; vote scenes pick the majority and reward the backers', () => {
  const { room, clock, H } = setup({ humans: ['A1', 'A2', 'A3', 'A4'] });
  room.start(); until(room, clock, 'choose'); force(room, 'watch');
  H.forEach((p, i) => ok(room.act(p, { op: 'choose', k: i === 0 ? 'watch' : 'scavenge' })));
  g(room).next();
  assert.equal(g(room).r.outcome.groupOk, true);
  for (const [, f] of g(room).r.fates) if (f.o.k === 'scavenge') assert.equal(f.fate, 'safe', 'dangerous, but covered');
  until(room, clock, 'choose'); force(room, 'hitchhiker');
  H.forEach((p, i) => { if (me(room, p).alive) ok(room.act(p, { op: 'choose', k: i < 3 ? 'ride' : 'leave' })); });
  g(room).next();
  assert.match(g(room).r.outcome.groupLine, /ketchup/);
  for (const p of H.slice(0, 3)) { assert(me(room, p).items.some((i) => i.k === 'medkit')); assert(me(room, p).flags.has('befriended_ranger')); }
});

test('Bites: you turn at the end of the next scene without a medkit; a medkit (even a gift) or the vaccine cures you', () => {
  const { room, clock, H: [a, b, c, d] } = setup({ humans: ['Ana', 'Ben', 'Cy', 'Dee'] });
  room.start(); until(room, clock, 'choose');
  const A = me(room, a), B = me(room, b), C = me(room, c), D = me(room, d);
  for (const x of [A, B, D]) { x.status = 'bitten'; x.bittenAt = 0; }
  C.items.push({ k: 'medkit', n: 1 }); D.flags.add('vaccinated');
  force(room, 'hardware');
  for (const p of [a, b, c, d]) ok(room.act(p, { op: 'choose', k: 'rope' }));
  assert(room.playerState(a).state.me.bittenNow);
  ok(room.act(c, { op: 'give', item: 'medkit', to: b.id })); // Cy saves Ben
  assert.equal(C.pts, 50); assert.equal(C.st.saves, 1);
  g(room).next();
  const out = g(room).r.outcome;
  assert(out.fever, 'the fever segment plays');
  assert.equal(A.alive, false); assert.equal(A.status, 'turned'); assert.match(A.diedHow, /turned/);
  assert(B.alive && B.status === 'ok' && !B.items.some((i) => i.k === 'medkit'));
  assert(D.alive && D.status === 'ok' && !D.flags.has('vaccinated'), 'the vaccine works once');
  assert.match(out.fever.line, /Okafor’s shot/);
  assert.equal(out.fever.people.find((p) => p.id === d.id).how, '💉');
});

test('Ghosts: the dead bless or curse a survivor and score when they call it; a blessing turns a scrape into an escape', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ana', 'Ben', 'Cy'] });
  room.start(); until(room, clock, 'choose');
  const A = me(room, a);
  g(room).kill(A, 'tripped', 1);
  bad(room.act(a, { op: 'choose', k: 'medkit' }), /ghost/);
  bad(room.act(b, { op: 'haunt', to: c.id, mode: 'curse' }), /alive/);
  bad(room.act(a, { op: 'haunt', to: a.id, mode: 'curse' }), /survivor/);
  bad(room.act(a, { op: 'haunt', to: b.id, mode: 'hex' }), /Bless or curse/);
  force(room, 'pemberton');
  ok(room.act(a, { op: 'haunt', to: b.id, mode: 'bless' }));
  ok(room.act(b, { op: 'choose', k: 'back' })); ok(room.act(c, { op: 'choose', k: 'back' })); // nobody holds: both hurt…
  g(room).next();
  assert.equal(fate(room, b), 'safe', '…but the blessing pulls Ben clear'); assert.equal(fate(room, c), 'hurt');
  const h = g(room).r.haunts.get(a.id);
  assert(h.hit); assert.equal(A.pts, 30);
  const tv = room.tvState().state;
  assert(tv.ghostList.some((x) => x.id === a.id) && tv.haunts.length === 1);
  assert(room.playerState(a).state.myHaunt.to === 'Ben');
  const s2 = setup({ humans: ['Ana', 'Ben', 'Cy'], settings: { ghosts: false } });
  s2.room.start(); until(s2.room, s2.clock, 'choose');
  g(s2.room).kill(me(s2.room, s2.H[0]), 'tripped', 1);
  bad(s2.room.act(s2.H[0], { op: 'haunt', to: s2.H[1].id, mode: 'curse' }), /off/);
});

test('Mercy on Forgiving and Normal (the story reaches the last night); none on Brutal', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { room, clock } = setup({ bots: 3, seed, settings: { difficulty: 'normal', length: 'short' } });
    room.start();
    while (g(room).phase !== 'over' && clock.step()) if (g(room).phase === 'outcome' && !g(room).r.sc.final) assert(g(room).livingPlayers().length > 0, 'wiped before the end');
    assert(g(room).epilogue.reachedEnd);
  }
  const { room, clock, H } = setup({ humans: ['Ana', 'Ben'], settings: { difficulty: 'brutal' } });
  room.start(); until(room, clock, 'choose'); force(room, 'escalator');
  for (const p of H) ok(room.act(p, { op: 'choose', k: 'shoot' }));
  g(room).next(); assert.equal(g(room).livingPlayers().length, 0, 'deadly without a gun');
  room.hostAction({ type: 'next' }); assert.equal(g(room).phase, 'over'); assert(g(room).epilogue.wipe);
});

test('Difficulty: Brutal kills far more than Forgiving over many seeded bot games', () => {
  const deaths = {};
  for (const difficulty of ['forgiving', 'normal', 'brutal']) {
    let dead = 0, tot = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const { room, clock } = setup({ bots: 6, seed, settings: { difficulty, length: 'short' } });
      room.start(); runOut(room, clock);
      const ps = [...g(room).ppl.values()].filter((x) => !x.npc);
      tot += ps.length; dead += ps.filter((x) => !x.alive).length;
    }
    deaths[difficulty] = dead / tot;
  }
  assert(deaths.forgiving < deaths.normal && deaths.normal < deaths.brutal, json(deaths));
  assert(deaths.brutal > 0.5 && deaths.forgiving < 0.25, json(deaths));
});

test('results(): survivors first, then whoever got furthest, then points', () => {
  const { room, clock, H: [a, b, c, d] } = setup({ humans: ['Ana', 'Ben', 'Cy', 'Dee'] });
  room.start(); until(room, clock, 'choose');
  const [A, B, C, D] = [a, b, c, d].map((p) => me(room, p));
  g(room).kill(A, 'tripped', 1); A.pts = 9999;
  g(room).kill(B, 'tripped', 3); B.pts = 10;
  C.pts = 0; D.pts = 50;
  g(room).finish();
  assert.deepEqual(g(room).results(), [d.id, c.id, b.id, a.id]);
  const E = g(room).epilogue;
  assert.match(E.fates.find((f) => f.id === a.id).reach, /Day 1/);
});

test('Input validation: unknown ops, bad options, locked options, junk payloads, wrong phase', () => {
  const { room, clock, H: [a, b] } = setup({ humans: ['Ana', 'Ben'], bots: 2 });
  room.start();
  bad(room.act(a, { op: 'choose', k: 'medkit' }), /Not now/);
  until(room, clock, 'choose');
  force(room, 'bus');
  for (const m of [{}, { op: 'dance' }, { op: 'choose' }, { op: 'choose', k: 'nope' }, { op: 'choose', k: { x: 1 } }, { op: 'choose', k: ['bus'] }, { op: '__proto__' }, { op: 'give', item: 'toString', to: b.id }, { op: 'give', item: '__proto__', to: b.id }, { op: 'give', item: 'gun', to: b.id }, { op: 'give', item: 'medkit', to: 42 }, { op: 'haunt', to: b.id, mode: 'curse' }]) {
    assert.equal(room.act(a, m).ok, false, json(m));
  }
  assert.equal(room.act(a, null).ok, false);
  bad(room.act(a, { op: 'choose', k: 'drive' }), /need/); // needs car keys
  give(room, a, 'keys');
  ok(room.act(a, { op: 'choose', k: 'drive' }));
  ok(room.act(a, { op: 'choose', k: 'bus' })); // can change your mind
  assert.equal(g(room).r.picks.get(a.id), 'bus');
  bad(room.act(a, { op: 'give', item: 'keys', to: a.id }), /give it to/);
  ok(room.act(a, { op: 'give', item: 'keys', to: b.id }));
  assert(me(room, b).items.some((i) => i.k === 'keys'));
  assert(!me(room, a).items.some((i) => i.k === 'keys'));
  give(room, a, 'rope');
  bad(room.act(a, { op: 'give', item: 'rope', to: b.id }), /already gave/);
  assert.equal(me(room, a).pts, 20);
});

test('Everyone in time: the scene closes early; people who froze all do the same panicked thing', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ana', 'Ben', 'Cy'] });
  room.start(); until(room, clock, 'choose');
  for (const p of [a, b]) ok(room.act(p, { op: 'choose', k: 'rope' }));
  ok(room.act(c, { op: 'choose', k: 'bat' }));
  assert(g(room).endsAt - clock.now() <= 1200);
  until(room, clock, 'outcome');
  const s2 = setup({ humans: ['Ana', 'Ben', 'Cy'] });
  s2.room.start(); until(s2.room, s2.clock, 'outcome');
  assert.equal(g(s2.room).r.froze.size, 3);
  const R2 = g(s2.room).r, frozen = [...R2.froze];
  assert.equal(new Set(frozen.map((id) => R2.picks.get(id))).size, 1, 'one panicked choice for all');
  assert.equal(new Set(frozen.map((id) => R2.fates.get(id).fate)).size, 1);
  assert(g(s2.room).r.outcome.groups.some((x) => x.people.some((p) => p.froze)));
});

test('Small groups get AI survivors; they are not in results(); late joiners come in next scene', () => {
  const { room, clock, H: [a] } = setup({ humans: ['Ana'] });
  ok(room.start());
  assert.equal([...g(room).ppl.values()].filter((x) => x.npc).length, 3);
  until(room, clock, 'choose');
  assert.equal(room.tvState().state.people.length, 4);
  const late = room.join('Zed').player;
  bad(room.act(late, { op: 'choose', k: 'medkit' }), /next scene/);
  runOut(room, clock); room.scoreParty();
  const res = g(room).results();
  assert(res.includes(a.id) && res.includes(late.id));
  assert(!res.some((id) => id.startsWith('npc')));
});

test('Screens: TV state is public (no picks or twists during the choice); the phone shows its gear, hints, story and fate', () => {
  const { room, clock, H: [a, b] } = setup({ humans: ['Ana', 'Ben'], bots: 2 });
  room.start();
  assert.equal(room.tvState().state.phase, 'chapter');
  until(room, clock, 'choose');
  ok(room.act(a, { op: 'choose', k: 'gun' }));
  const tv = room.tvState().state;
  assert.equal(tv.outcome, null); assert.equal(tv.scene.options.length, 5);
  assert(!/twist/.test(json(tv)) && !/twist/.test(json(room.playerState(a).state)), 'twists stay secret');
  assert.equal(tv.scene.options.find((o) => o.k === 'gun').danger, 1);
  give(room, a, 'flashlight'); me(room, a).flags.add('knows_back_route');
  const v = room.playerState(a).state;
  assert.equal(v.pick, 'gun'); assert(Array.isArray(v.others));
  assert(v.me.items.find((i) => i.k === 'flashlight').hint.length > 10);
  assert.deepEqual(v.me.flags.map((f) => f.icon), ['🗺️']);
  until(room, clock, 'outcome');
  const v2 = room.playerState(a).state, out = room.tvState().state.outcome;
  assert(v2.mine && v2.mine.label && v2.mine.line && v2.mine.at >= 0 && v2.mine.at < out.ms);
  assert(out.groups.length >= 1 && out.groups.every((x) => x.at >= 0 && x.line));
  until(room, clock, 'board');
  assert(room.tvState().state.standings.every((r) => r.reach));
});

test('Pacing: recap, each group in turn, one verdict per person, bites, then a tally; the next scene waits for all of it', () => {
  for (const n of [4, 12, 100]) {
    const { room, clock } = setup({ bots: n, seed: n + 1 });
    room.start(); until(room, clock, 'outcome');
    const O = g(room).r.outcome, t0 = clock.now();
    assert(O.ms >= 14000 && O.ms <= 80000, 'length ' + O.ms);
    assert(O.recapMs >= 3600 && O.recap.length > 5);
    let last = O.recapMs - 1;
    for (const G of O.groups) {
      assert(G.at > last, 'groups in turn'); assert(G.verdictAt >= G.at + 3000, 'act + consequence before the verdicts');
      G.people.forEach((p, i) => { assert.equal(p.at, G.verdictAt + i * G.per); assert(p.at < G.at + G.ms); });
      if (G.people.length <= 4) assert.equal(G.per, 1000, 'a second per person in small groups');
      last = G.at + G.ms - 1;
    }
    if (O.fever) assert(O.fever.at >= last);
    assert(O.endAt + 6000 <= O.ms, 'the tally stays up');
    until(room, clock, 'board');
    assert.equal(clock.now() - t0, O.ms, 'the board only comes after the whole outcome');
  }
});

for (const [n, length] of [[1, 'short'], [4, 'normal'], [12, 'short'], [100, 'normal']]) {
  test(`Full game with ${n} bot${n === 1 ? '' : 's'}: finishes, results() best-first, epilogue says how far everyone got`, () => {
    const { room, clock } = setup({ bots: n, seed: n, settings: { length } });
    ok(room.start());
    assert.deepEqual(g(room).results(), []);
    runOut(room, clock);
    room.scoreParty();
    const res = g(room).results();
    assert.equal(res.length, n);
    const P = res.map((id) => g(room).ppl.get(id));
    for (let i = 1; i < P.length; i++) {
      assert(P[i - 1].alive >= P[i].alive, 'survivors first');
      if (P[i - 1].alive === P[i].alive && !P[i].alive) assert(P[i - 1].diedAt >= P[i].diedAt, 'then the furthest');
    }
    const e = room.tvState().state.epilogue;
    assert(e && e.fates.length >= Math.min(n, 60) && e.fates.every((f) => f.line.length > 8 && f.reach));
    for (const f of e.fates) if (!f.alive) assert.match(f.line, /made it to Day \d/);
    assert(json(room.tvState()).length < 400000, 'TV payload stays small');
    for (const p of room.list().slice(0, 5)) assert(room.playerState(p).state.end);
    const minutes = clock.now() / 60000;
    assert(minutes > 2 && minutes < 30, 'minutes: ' + minutes);
  });
}

test('Weird input never crashes: random junk from every player through a whole game', () => {
  const { room, clock, H } = setup({ humans: ['Ana', 'Ben'], bots: 3, seed: 11 });
  room.start();
  const junk = [undefined, null, 1, 'x', [], {}, { op: 'choose', k: 'constructor' }, { op: 'give', item: '__proto__', to: '__proto__' }, { op: 'haunt', to: 'npc1', mode: 'bless' }, { op: 'give', item: 'medkit', to: 'npc1' }, { op: 'choose', k: 'hold' }];
  let i = 0;
  while (g(room).phase !== 'over' && clock.step()) {
    if (++i % 3 === 0) for (const p of H) { const r = room.act(p, junk[i % junk.length]); assert(r && typeof r.ok === 'boolean'); }
    room.tvState(); for (const p of H) room.playerState(p);
  }
  room.hostAction({ type: 'next' });
  assert.equal(g(room).phase, 'over');
});

test('Host skip walks through every phase; leaving mid-scene does not stall it', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ana', 'Ben', 'Cy'] });
  room.start();
  for (const ph of ['chapter', 'choose', 'outcome', 'board']) { assert.equal(g(room).phase, ph); room.hostAction({ type: 'next' }); }
  until(room, clock, 'choose');
  ok(room.act(a, { op: 'choose', k: g(room).r.sc.options[0].k })); ok(room.act(b, { op: 'choose', k: g(room).r.sc.options[0].k }));
  room.remove(c.id);
  assert(g(room).endsAt - clock.now() <= 1200, 'closes once the rest are in');
});

test('Family mode (room.family): the gentler telling, same rules, and no grisly line ever shows', () => {
  const [plain, fam] = TOLD;
  assert.equal(fam.SCENARIOS.length, plain.SCENARIOS.length);
  fam.SCENARIOS.forEach((s, i) => { const p = plain.SCENARIOS[i]; assert.equal(s.id, p.id); assert.deepEqual(s.options.map((o) => [o.k, o.danger, o.need, o.gain, o.role, o.setFlag, json(o.outcomes)]), p.options.map((o) => [o.k, o.danger, o.need, o.gain, o.role, o.setFlag, json(o.outcomes)])); });
  assert.equal(fam.ITEMS.gun.name, 'Foam blaster'); assert.equal(ITEMS.gun.name, 'Pistol', 'the normal telling is unchanged');
  const banned = /pistol|bullet|not friendly|bit back|didn’t make it|the real kind|not ketchup\b(?! after)|pill bottles|drank something|so the others could|very end/i;
  for (const s of fam.SCENARIOS) assert(!banned.test(JSON.stringify(s)), 'family scene ' + s.id + ': ' + JSON.stringify(s).match(banned));
  for (const seed of [3, 8]) {
    const { room, clock } = setup({ bots: 6, seed }); room.family = true; room.start();
    assert.equal(g(room).family, true); assert.equal(g(room).T, fam);
    let i = 0;
    while (g(room).phase !== 'over' && clock.step()) {
      if (++i > 3000000) throw new Error('never ended');
      if (i % 5 === 0) { const out = json(g(room).tv()) + json(g(room).view(room.list()[0])); assert(!banned.test(out), 'family screen: ' + out.match(banned)); }
    }
  }
  const { room } = setup({ bots: 3 }); room.start(); assert.equal(g(room).family, false, 'undefined room.family = normal telling');
});

console.log(`\n${passed} zombie tests passed`);
