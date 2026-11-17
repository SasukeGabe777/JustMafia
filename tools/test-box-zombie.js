'use strict';
// Zombie Survival: the story plan, input validation, items changing outcomes, bites and medkits,
// group dynamics (hold the door / cover), ghosts, AI survivors for small groups, results(),
// and full games with bots at 3, 20 and 100 players.
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/zombie');
const { ITEMS, CHAPTERS, SCENARIOS } = def._test;

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
// Force the current scene to a given scenario (tests need known options).
function force(room, id) { const sc = SCENARIOS.find((s) => s.id === id); g(room).r.sc = sc; return sc; }

test('Content: 40+ original scenarios with 3–5 options, every chapter well stocked, valid items, finals', () => {
  assert(SCENARIOS.length >= 40, 'scenarios: ' + SCENARIOS.length);
  const ids = new Set();
  for (const s of SCENARIOS) {
    assert(!ids.has(s.id), 'duplicate ' + s.id); ids.add(s.id);
    assert(s.options.length >= 3 && s.options.length <= 5, s.id);
    assert(s.title && s.text && s.text.length < 260, s.id);
    assert(s.options.some((o) => !o.need), s.id + ' needs a choice anyone can take');
    for (const o of s.options) {
      assert(o.k && o.icon && o.label && o.ok && o.bad && typeof o.risk === 'number' && o.risk >= 0 && o.risk < 1, s.id + '/' + o.k);
      for (const k of [].concat(o.gain || [], o.need || [], Object.keys(o.help || {}))) assert(ITEMS[k], s.id + ' unknown item ' + k);
    }
    if (s.group && (s.group.type === 'hold')) assert(s.options.some((o) => o.role === 'hold') && s.options.some((o) => o.role === 'run'), s.id);
    if (s.group && s.group.type === 'cover') assert(s.options.some((o) => o.role === 'cover'), s.id);
  }
  for (const c of CHAPTERS) if (c.key !== 'rescue') assert(SCENARIOS.filter((s) => s.ch === c.key).length >= 5, c.key);
  assert(SCENARIOS.filter((s) => s.final).length >= 2);
  assert(SCENARIOS.some((s) => s.first));
  for (const f of def.fields) assert(f.options.some((o) => o.value === def.defaults[f.key]), f.key);
  assert.equal(def.locked.how, 'Finish a Party Mode to unlock it.');
});

test('Story plan: six days in order, the first scene is a pickup, the rescue is last; lengths differ', () => {
  const lens = {};
  for (const length of ['short', 'normal', 'long']) {
    const { room } = setup({ bots: 4, settings: { length } }); room.start();
    const plan = g(room).plan;
    lens[length] = plan.length;
    assert.equal(plan[0].id, 'hardware');
    assert(SCENARIOS.find((s) => s.id === plan[plan.length - 1].id).final);
    const chs = [...new Set(plan.map((p) => p.ch))];
    assert.deepEqual(chs, CHAPTERS.map((c) => c.key));
    assert.equal(new Set(plan.map((p) => p.id)).size, plan.length, 'no repeats');
    assert.equal(g(room).phase, 'chapter');
  }
  assert(lens.short < lens.normal && lens.normal < lens.long, json(lens));
});

test('Small groups get AI survivors; they are not in results(); late joiners come in next scene', () => {
  const { room, clock, H: [a] } = setup({ humans: ['Ana'] });
  ok(room.start());
  const npcs = [...g(room).ppl.values()].filter((x) => x.npc);
  assert.equal(npcs.length, 3);
  until(room, clock, 'choose');
  assert.equal(room.tvState().state.people.length, 4);
  const late = room.join('Zed').player;
  bad(room.act(late, { op: 'choose', k: 'medkit' }), /next scene/);
  runOut(room, clock); room.scoreParty();
  const res = g(room).results();
  assert(res.includes(a.id) && res.includes(late.id));
  assert(!res.some((id) => id.startsWith('npc')));
});

test('Input validation: unknown ops, bad options, locked options, junk payloads, wrong phase', () => {
  const { room, clock, H: [a, b] } = setup({ humans: ['Ana', 'Ben'], bots: 2 });
  room.start();
  bad(room.act(a, { op: 'choose', k: 'medkit' }), /Not now/);
  until(room, clock, 'choose');
  force(room, 'bus');
  for (const m of [{}, { op: 'dance' }, { op: 'choose' }, { op: 'choose', k: 'nope' }, { op: 'choose', k: { x: 1 } }, { op: 'choose', k: ['bus'] }, { op: '__proto__' }, { op: 'give', item: 'toString', to: b.id }, { op: 'give', item: 'gun', to: b.id }, { op: 'give', item: 'medkit', to: 42 }, { op: 'haunt', to: b.id, mode: 'curse' }]) {
    assert.equal(room.act(a, m).ok, false, json(m));
  }
  assert.equal(room.act(a, null).ok, false);
  bad(room.act(a, { op: 'choose', k: 'drive' }), /need/); // needs car keys
  g(room).ppl.get(a.id).items.push({ k: 'keys', n: null });
  ok(room.act(a, { op: 'choose', k: 'drive' }));
  ok(room.act(a, { op: 'choose', k: 'bus' })); // can change your mind
  assert.equal(g(room).r.picks.get(a.id), 'bus');
  // gifts: one per scene, not to yourself, only things you have
  bad(room.act(a, { op: 'give', item: 'keys', to: a.id }), /give it to/);
  ok(room.act(a, { op: 'give', item: 'keys', to: b.id }));
  assert(g(room).ppl.get(b.id).items.some((i) => i.k === 'keys'));
  assert(!g(room).ppl.get(a.id).items.some((i) => i.k === 'keys'));
  g(room).ppl.get(a.id).items.push({ k: 'rope', n: null });
  bad(room.act(a, { op: 'give', item: 'rope', to: b.id }), /already gave/);
  assert.equal(g(room).ppl.get(a.id).pts, 20);
});

test('Items change outcomes: a pistol makes the fight much safer and spends a bullet', () => {
  let armed = 0, bare = 0;
  for (let seed = 1; seed <= 150; seed++) {
    for (const withGun of [true, false]) {
      const { room, clock, H: [a, b, c, d] } = setup({ humans: ['Ana', 'Ben', 'Cy', 'Dee'], seed });
      room.start(); until(room, clock, 'choose'); force(room, 'escalator');
      const x = g(room).ppl.get(a.id);
      if (withGun) x.items.push({ k: 'gun', n: 3 });
      for (const p of [a, b, c, d]) ok(room.act(p, { op: 'choose', k: p === a ? 'shoot' : 'elevator' }));
      g(room).next();
      const f = g(room).r.fates.get(a.id);
      if (f.fate === 'safe') { if (withGun) armed++; else bare++; }
      if (withGun) { assert.equal(f.used, 'gun'); const gun = x.items.find((i) => i.k === 'gun'); assert.equal(gun.n, 2); }
    }
  }
  assert(armed > bare * 1.15, `armed ${armed} vs bare ${bare}`);
});

test('Pickups: surviving the hardware store puts the item in your backpack (max 4, oldest dropped)', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ana', 'Ben', 'Cy'], settings: { difficulty: 'forgiving' } });
  room.start(); until(room, clock, 'choose');
  assert.equal(g(room).r.sc.id, 'hardware');
  const x = g(room).ppl.get(a.id);
  x.items = [{ k: 'rope', n: null }, { k: 'bat', n: 3 }, { k: 'radio', n: null }, { k: 'keys', n: null }];
  ok(room.act(a, { op: 'choose', k: 'flashlight' })); ok(room.act(b, { op: 'choose', k: 'medkit' })); ok(room.act(c, { op: 'choose', k: 'gun' }));
  g(room).next();
  const f = g(room).r.fates.get(a.id);
  if (f.fate !== 'dead') { assert.equal(f.got, 'flashlight'); assert.equal(f.dropped, 'rope'); assert.equal(x.items.length, 4); }
  const v = room.playerState(a).state;
  assert(v.mine && typeof v.mine.at === 'number');
});

test('Bites: you turn at the end of the next scene without a medkit; a medkit (even a gift) cures you', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ana', 'Ben', 'Cy'] });
  room.start(); until(room, clock, 'choose');
  const A = g(room).ppl.get(a.id), B = g(room).ppl.get(b.id), C = g(room).ppl.get(c.id);
  A.status = 'bitten'; A.bittenAt = 0; // bitten before this scene
  B.status = 'bitten'; B.bittenAt = 0; C.items.push({ k: 'medkit', n: 1 });
  force(room, 'hardware');
  for (const p of [a, b, c]) ok(room.act(p, { op: 'choose', k: 'flashlight' }));
  assert(room.playerState(a).state.me.bittenNow);
  ok(room.act(c, { op: 'give', item: 'medkit', to: b.id })); // Cy saves Ben
  assert.equal(C.pts, 50); assert.equal(C.st.saves, 1);
  g(room).next();
  const out = g(room).r.outcome;
  assert(out.fever, 'the fever segment plays');
  if (A.status !== 'ok') { assert.equal(A.alive, false); assert.equal(A.status, 'turned'); assert.match(A.diedHow, /turned/); }
  else assert(g(room).r.fates.get(a.id).lucky, 'only a lucky break saves Ana');
  assert.equal(B.alive, g(room).r.fates.get(b.id).fate !== 'dead'); // the medkit cured the bite
  if (B.alive) assert.equal(B.status === 'bitten', g(room).r.fates.get(b.id).fate === 'bitten');
  assert(!B.items.some((i) => i.k === 'medkit'));
});

test('Hold the door: enough holders protect the runners; nobody holding is bad for the runners', () => {
  let heldSafe = 0, openSafe = 0;
  for (let seed = 1; seed <= 40; seed++) {
    for (const hold of [true, false]) {
      const { room, clock, H } = setup({ humans: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'], seed });
      room.start(); until(room, clock, 'choose'); force(room, 'pemberton');
      H.forEach((p, i) => ok(room.act(p, { op: 'choose', k: hold && i < 3 ? 'hold' : 'back' })));
      g(room).next();
      const out = g(room).r.outcome;
      assert.equal(out.groupOk, hold); assert.match(out.groupLine, hold ? /held/ : /gave way/);
      for (const [id, f] of g(room).r.fates) if (f.o.k === 'back' && f.fate === 'safe') { if (hold) heldSafe++; else openSafe++; }
    }
  }
  // per-runner rates: 3 runners when held, 6 when not
  assert(heldSafe / 120 > openSafe / 240 + 0.1, `held ${heldSafe}/120 vs open ${openSafe}/240`);
});

test('Cover: one decoy makes everyone else safer; vote scenes pick the majority', () => {
  const { room, clock, H } = setup({ humans: ['A1', 'A2', 'A3', 'A4'] });
  room.start(); until(room, clock, 'choose'); force(room, 'icecream');
  H.forEach((p, i) => ok(room.act(p, { op: 'choose', k: i === 0 ? 'push' : 'yards' })));
  g(room).next();
  assert.equal(g(room).r.outcome.groupOk, true);
  assert.match(g(room).r.outcome.groupLine, /downhill/);
  until(room, clock, 'choose'); force(room, 'hitchhiker');
  H.forEach((p, i) => { if (g(room).ppl.get(p.id).alive) room.act(p, { op: 'choose', k: i < 3 ? 'ride' : 'leave' }); });
  g(room).next();
  assert.match(g(room).r.outcome.groupLine, /ketchup|left|paper/);
});

test('Ghosts: the dead bless or curse a survivor and score when they call it; off = no haunting', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ana', 'Ben', 'Cy'] });
  room.start(); until(room, clock, 'choose');
  const A = g(room).ppl.get(a.id);
  g(room).kill(A, 'tripped', 1);
  bad(room.act(a, { op: 'choose', k: 'medkit' }), /ghost/);
  bad(room.act(b, { op: 'haunt', to: c.id, mode: 'curse' }), /alive/);
  // a ghost can't haunt this scene's line-up if the target isn't in it
  bad(room.act(a, { op: 'haunt', to: a.id, mode: 'curse' }), /survivor/);
  bad(room.act(a, { op: 'haunt', to: b.id, mode: 'hex' }), /Bless or curse/);
  ok(room.act(a, { op: 'haunt', to: b.id, mode: 'bless' }));
  ok(room.act(b, { op: 'choose', k: 'rope' })); ok(room.act(c, { op: 'choose', k: 'rope' }));
  g(room).next();
  const fb = g(room).r.fates.get(b.id), h = g(room).r.haunts.get(a.id);
  assert.equal(!!h.hit, fb.fate === 'safe' && g(room).ppl.get(b.id).alive);
  assert.equal(A.pts, h.hit ? 30 : 0);
  const tv = room.tvState().state;
  assert(tv.ghostList.some((x) => x.id === a.id) && tv.haunts.length === 1);
  const v = room.playerState(a).state;
  assert(v.myHaunt && v.myHaunt.to === 'Ben');
  // ghosts off
  const s2 = setup({ humans: ['Ana', 'Ben', 'Cy'], settings: { ghosts: false } });
  s2.room.start(); until(s2.room, s2.clock, 'choose');
  g(s2.room).kill(g(s2.room).ppl.get(s2.H[0].id), 'tripped', 1);
  bad(s2.room.act(s2.H[0], { op: 'haunt', to: s2.H[1].id, mode: 'curse' }), /off/);
});

test('Mercy: the story never wipes out every player before the rescue', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const { room, clock } = setup({ bots: 3, seed, settings: { difficulty: 'brutal', length: 'short' } });
    room.start();
    while (g(room).phase !== 'over' && clock.step()) {
      if (g(room).phase === 'outcome' && g(room).r && !g(room).r.sc.final) assert(g(room).livingPlayers().length > 0, 'wiped before the end');
    }
    assert(g(room).epilogue.reachedEnd);
  }
});

test('Everyone in time: the scene closes early; frozen people get a random option', () => {
  const { room, clock, H: [a, b, c] } = setup({ humans: ['Ana', 'Ben', 'Cy'] });
  room.start(); until(room, clock, 'choose');
  for (const p of [a, b]) ok(room.act(p, { op: 'choose', k: 'rope' }));
  ok(room.act(c, { op: 'choose', k: 'bat' }));
  assert(g(room).endsAt - clock.now() <= 1200);
  until(room, clock, 'outcome');
  const s2 = setup({ humans: ['Ana', 'Ben', 'Cy'] });
  s2.room.start(); until(s2.room, s2.clock, 'outcome');
  assert.equal(g(s2.room).r.froze.size, 3);
  assert(g(s2.room).r.outcome.groups.some((x) => x.people.some((p) => p.froze)));
});

test('Screens: TV state is public (no picks during the choice), the phone knows its own fate and timing', () => {
  const { room, clock, H: [a, b] } = setup({ humans: ['Ana', 'Ben'], bots: 2 });
  room.start();
  assert.equal(room.tvState().state.phase, 'chapter');
  assert.equal(room.tvState().state.chapter.day, 1);
  until(room, clock, 'choose');
  ok(room.act(a, { op: 'choose', k: 'gun' }));
  const tv = room.tvState().state;
  assert(!json(tv).includes('"gun"') || !tv.outcome, 'no outcome during choosing');
  assert.equal(tv.outcome, null); assert.equal(tv.scene.options.length, 5);
  const v = room.playerState(a).state;
  assert.equal(v.pick, 'gun'); assert(Array.isArray(v.others));
  until(room, clock, 'outcome');
  const v2 = room.playerState(a).state, out = room.tvState().state.outcome;
  assert(v2.mine && v2.mine.label && v2.mine.at >= 0 && v2.mine.at < out.ms);
  assert(out.groups.length >= 1 && out.groups.every((x) => x.at >= 0 && x.line));
  until(room, clock, 'board');
  assert(room.tvState().state.people.length + room.tvState().state.ghostList.length >= 4);
});

test('Pacing: recap, each group in turn, one verdict per person, bites, then a tally; the next scene waits for all of it', () => {
  for (const n of [4, 12, 100]) {
    const { room, clock } = setup({ bots: n, seed: n + 1 });
    room.start(); until(room, clock, 'outcome');
    const O = g(room).r.outcome, t0 = clock.now();
    assert(O.ms >= 14000, 'min length ' + O.ms);
    assert(O.ms <= 80000, 'capped ' + O.ms);
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
    assert(O.tally.lists && Array.isArray(O.tally.lists.ok));
    // every phone's reveal matches its stamp on the TV
    for (const p of room.list().slice(0, 3)) { const m = room.playerState(p).state.mine; if (m) assert(O.groups.some((G) => G.people.some((q) => q.id === p.id && q.at === m.at)) || m.at > 0); }
    until(room, clock, 'board');
    assert.equal(clock.now() - t0, O.ms, 'the board only comes after the whole outcome');
  }
});

for (const n of [3, 20, 100]) {
  test(`Full game with ${n} bots: finishes, results() best-first, epilogue with fates and awards`, () => {
    const { room, clock } = setup({ bots: n, seed: n, settings: { length: n === 100 ? 'normal' : 'short' } });
    ok(room.start());
    assert.deepEqual(g(room).results(), []);
    runOut(room, clock);
    room.scoreParty();
    const res = g(room).results();
    assert.equal(res.length, n);
    const pts = res.map((id) => g(room).ppl.get(id).pts);
    for (let i = 1; i < pts.length; i++) assert(pts[i - 1] >= pts[i]);
    const e = room.tvState().state.epilogue;
    assert(e && e.fates.length >= Math.min(n, 60) && e.fates.every((f) => f.line.length > 8));
    assert(e.reachedEnd);
    assert(json(room.tvState()).length < 400000, 'TV payload stays small');
    for (const p of room.list().slice(0, 5)) assert(room.playerState(p).state.end);
    const minutes = clock.now() / 60000;
    assert(minutes > 4 && minutes < 30, 'minutes: ' + minutes);
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
  const { TOLD } = def._test, [plain, fam] = TOLD;
  assert.equal(fam.SCENARIOS.length, plain.SCENARIOS.length);
  fam.SCENARIOS.forEach((s, i) => { const p = plain.SCENARIOS[i]; assert.equal(s.id, p.id); assert.deepEqual(s.options.map((o) => [o.k, o.risk, o.need, o.gain, o.role]), p.options.map((o) => [o.k, o.risk, o.need, o.gain, o.role])); });
  assert.equal(fam.ITEMS.gun.name, 'Foam blaster'); assert.equal(ITEMS.gun.name, 'Pistol', 'the normal telling is unchanged');
  const banned = /pistol|bullet|not friendly|bit back|didn’t make it|the real kind|not ketchup\b(?! after)|pill bottles|drank something|so the others could|very end/i;
  for (const s of fam.SCENARIOS) assert(!banned.test(JSON.stringify(s)), 'family scene ' + s.id);
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
