'use strict';
// JustKingdoms engine: world generation and fair starts (2/9/100), seating → neighbours, economy
// math, build/age/train gating, marches and pathfinding around lakes, battles (counters, walls,
// catapults), village capture, capital → vassal, rebellion, alliances and betrayal, every win mode,
// the time-limit fallback, privacy of tv()/view(), events, diplomacy ops, validation, skip ahead,
// and whole bot games (2, 10 and 100 players).
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/kingdoms');
const { D, M } = def._test;

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function setup({ bots = 0, humans = [], settings = {}, seed = 7, start = true, seats = {}, keepPeace = false, decrees = false } = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  room.addBots(bots); Object.assign(room.settings, settings);
  const H = humans.map((n) => room.join(n).player);
  for (const [i, s] of Object.entries(seats)) ok(room.act(H[i], { op: 'seat', seat: s }));
  if (start) ok(room.start());
  const g = room.game;
  if (start && !keepPeace) g.peaceUntil = 0; // most tests attack capitals right away
  if (start && !decrees) for (const p of H) g.k.get(p.id).decree = 999; // decree rewards would skew exact numbers
  const K = (p) => g.k.get(p.id);
  const secs = (n) => { const t = clock.t + n * 1000; while (clock.t < t && g.phase === 'play' && clock.step()); };
  return { clock, room, g, H, K, secs };
}
const ok = (r) => { assert.equal(r.ok, true, r.error); return r; };
const bad = (r, re) => { assert.equal(r.ok, false, 'expected an error'); if (re) assert.match(r.error, re); };
const act = (room, p, m) => room.act(p, m);
const qr = (g, i) => ({ q: g.tile(i).q, r: g.tile(i).r });
const rich = (k, n = 5000) => { for (const r of D.RES) k.res[r] = n; };
const near = (a, b, eps = 1e-6) => assert(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

console.log('JustKingdoms');

test('Settings: every field has options and the defaults are valid options', () => {
  for (const f of def.fields) { assert(Array.isArray(f.options) && f.options.length, f.key); assert(f.options.some((o) => o.value === def.defaults[f.key]), f.key); }
  for (const k of ['mode', 'timeLimit', 'mapSize', 'speed', 'events', 'bots']) assert(def.fields.some((f) => f.key === k), k);
  assert.equal(def.key, 'kingdoms'); assert.equal(def.liveLobby, true); assert.equal(def.min, 1);
});

test('World: radius formula, fair starts and spacing for 2, 9 and 100 players', () => {
  for (const n of [2, 9, 100]) {
    const { g } = setup({ bots: n, seed: n });
    assert.equal(g.k.size, n);
    const R = Math.max(3, Math.min(12, Math.round(2.2 + Math.sqrt(n) * 1.6)));
    assert.equal(g.world.R, R, `R for ${n}`);
    assert.equal(g.world.tiles.length, 3 * R * (R + 1) + 1);
    const homes = [...g.k.values()].map((k) => k.home);
    assert.equal(new Set(homes).size, n);
    for (const h of homes) {
      const nb = g.tile(h).nb.map((i) => g.tile(i).t);
      assert.equal(nb.length, 6, 'capital not on the edge');
      for (const t of ['p', 'f', 'h']) assert(nb.includes(t), `capital ${h} lacks ${t}`);
      assert(nb.every((t) => M.passable(t)), 'no impassable neighbour');
      assert(M.dist(g.tile(h).q, g.tile(h).r, 0, 0) >= 2, 'not in the heartland');
    }
    for (let i = 0; i < homes.length; i++) for (let j = i + 1; j < homes.length; j++) assert(g.world.dist(homes[i], homes[j]) >= 2);
    // everyone can reach everyone
    for (const h of homes.slice(1)) assert(g.world.path(homes[0], h), 'capitals connected');
    assert.equal(g.tile(g.world.index.get('0,0')).t, 'r', 'Ancient Ruins in the centre');
    for (const k of g.k.values()) assert(k.land >= 2, 'every capital starts with land');
    if (n <= 9) for (const k of g.k.values()) assert.equal(k.land, 7, 'small games: capital + 6 neighbours');
  }
});

test('Seating: picks are unique and validated; unpicked players fill the gaps; seats → neighbours', () => {
  const { room, g, H } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Di', 'Ed', 'Flo', 'Gus', 'Hal', 'Ivy'], start: false });
  assert.equal(g.phase, 'lobby');
  ok(act(room, H[0], { op: 'seat', seat: 4 }));
  bad(act(room, H[1], { op: 'seat', seat: 4 }), /taken/);
  bad(act(room, H[1], { op: 'seat', seat: 9 }), /seat/);
  bad(act(room, H[1], { op: 'seat', seat: -3 }), /seat/);
  bad(act(room, H[1], { op: 'seat', seat: 'x' }), /seat/);
  bad(act(room, H[1], { op: 'build', b: 'houses' }), /Waiting/);
  ok(act(room, H[1], { op: 'seat', seat: 0 }));
  ok(act(room, H[2], { op: 'seat', seat: 3 }));
  ok(act(room, H[2], { op: 'seat', seat: 5 })); // change your mind
  ok(act(room, H[3], { op: 'rename', name: 'Dragonia' }));
  const tv = room.tvState().state;
  assert.equal(tv.phase, 'lobby'); assert.equal(tv.tableSize, 9);
  assert.equal(tv.seats.find((s) => s.id === H[0].id).seat, 4);
  assert.equal(tv.seats.find((s) => s.id === H[4].id).seat, null);
  ok(room.start());
  const seat = (p) => g.k.get(p.id).seat;
  assert.equal(seat(H[0]), 4); assert.equal(seat(H[1]), 0); assert.equal(seat(H[2]), 5);
  // the rest fill 1,2,3,6,7,8 in join order
  assert.deepEqual([3, 4, 5, 6, 7, 8].map((i) => seat(H[i])), [1, 2, 3, 6, 7, 8]);
  assert.equal(g.k.get(H[3].id).name, 'Dragonia'); assert.equal(g.k.get(H[4].id).name, "Ed's Kingdom");
  // people beside you at the table are your nearest kingdoms on the map
  const ks = [...g.k.values()].sort((a, b) => a.seat - b.seat);
  for (const k of ks) {
    const others = ks.filter((x) => x !== k).sort((a, b) => g.world.dist(k.home, a.home) - g.world.dist(k.home, b.home));
    const nb = [ks[(k.seat + 1) % 9], ks[(k.seat + 8) % 9]];
    assert(nb.includes(others[0]), `seat ${k.seat}: nearest is a table neighbour`);
    assert.deepEqual(k.neighbours.slice().sort(), nb.map((x) => x.id).sort());
  }
  bad(act(room, H[0], { op: 'seat', seat: 1 }), /fixed/);
});

test('Economy: worker yields, tile bonus, upkeep, starvation, pop cap', () => {
  const { room, g, H: [a], K, secs } = setup({ humans: ['Ann'], settings: { events: false } });
  const k = K(a);
  assert.deepEqual(k.res, { food: 50, wood: 50, stone: 0, gold: 0, sci: 0 });
  assert.equal(k.peasants, 3); assert.equal(k.jobs.farm, 1); assert.equal(k.b.farm, 1); assert.equal(k.age, 1);
  assert.equal(g.cap(k), 5); assert.equal(g.pop(k), 3);
  ok(act(room, a, { op: 'jobs', farm: 1, chop: 2 }));
  const f0 = k.res.food, w0 = k.res.wood;
  secs(1);
  const Y = D.BASE_YIELD, farm = Y * (1 + 0.25 * k.match.p) * 1.2, chop = 2 * Y * (1 + 0.25 * k.match.f);
  near(k.res.food - f0, farm - 0.3, 1e-9); near(k.res.wood - w0, chop, 1e-9);
  assert(k.match.p >= 1 && k.match.f >= 1);
  // fast speed multiplies production and upkeep
  g.s.speed = 'fast'; const f1 = k.res.food; secs(1); near(k.res.food - f1, (farm - 0.3) * 1.6, 1e-9); g.s.speed = 'normal';
  // starving halves production
  ok(act(room, a, { op: 'jobs', farm: 0, chop: 3 })); k.res.food = 0.1; secs(1); assert.equal(k.starving, true);
  const w1 = k.res.wood; secs(1); near(k.res.wood - w1, 3 * Y * (1 + 0.25 * k.match.f) * 0.5, 1e-9);
  // locked jobs
  bad(act(room, a, { op: 'jobs', quarry: 1 }), /Age 2/); bad(act(room, a, { op: 'jobs', study: 1 }), /Library/);
  bad(act(room, a, { op: 'jobs', farm: 4 }), /3 peasants/); bad(act(room, a, { op: 'jobs', farm: -1 }), /whole/);
  bad(act(room, a, { op: 'jobs', farm: 1.5 }), /whole/); bad(act(room, a, { op: 'jobs', farm: 'NaN' }), /whole/); bad(act(room, a, { op: 'jobs', dance: 1 }), /Unknown job/);
  // pop cap: 5 + 4×houses + 3×village levels
  k.b.houses = 2; const T = g.tile(k.tiles.find((i) => i !== k.home)); T.v = 2; g.census();
  assert.equal(g.cap(k), 5 + 8 + 6);
});

test('Gating: build queue (3, one at a time), ages, training, pop cap, research', () => {
  const { room, g, H: [a], K, secs } = setup({ humans: ['Ann'], settings: { events: false } });
  const k = K(a);
  bad(act(room, a, { op: 'build', b: 'quarry' }), /Age 2/);
  bad(act(room, a, { op: 'build', b: 'nope' }), /Unknown building/);
  bad(act(room, a, { op: 'age' }), /need/);
  bad(act(room, a, { op: 'train', u: 'spear', n: 1 }), /Age 2/);
  bad(act(room, a, { op: 'train', u: 'settlers' }), /Age 2/);
  bad(act(room, a, { op: 'research', tech: 'plows' }), /Library/);
  rich(k);
  const w = k.res.wood;
  ok(act(room, a, { op: 'build', b: 'houses' })); assert.equal(k.res.wood, w - 50);
  ok(act(room, a, { op: 'build', b: 'houses' })); assert.equal(Math.round(w - k.res.wood), 50 + 90); // ×1.8 per level
  ok(act(room, a, { op: 'build', b: 'lumber' }));
  bad(act(room, a, { op: 'build', b: 'farm' }), /queue is full/);
  assert.equal(k.queue[0].dur, 20000); assert.equal(k.queue[1].end, 0, 'one at a time');
  secs(20); assert.equal(k.b.houses, 1); assert(k.queue[0].end > 0);
  ok(act(room, a, { op: 'cancel', queue: 'build', i: 1 })); // refund the queued lumber camp in full
  secs(28); assert.equal(k.b.houses, 2); assert.equal(k.queue.length, 0);
  ok(act(room, a, { op: 'build', b: 'houses' })); secs(40); assert.equal(k.b.houses, 3);
  bad(act(room, a, { op: 'build', b: 'houses' }), /top level/);
  ok(act(room, a, { op: 'age' })); bad(act(room, a, { op: 'age' }), /already being built/);
  secs(45); assert.equal(k.age, 2);
  ok(act(room, a, { op: 'build', b: 'quarry' }));
  bad(act(room, a, { op: 'train', u: 'spear', n: 1 }), /Barracks/);
  bad(act(room, a, { op: 'train', u: 'militia', n: 0 }), /between 1 and 50/);
  bad(act(room, a, { op: 'train', u: 'militia', n: 2.5 }), /between 1 and 50/);
  bad(act(room, a, { op: 'train', u: 'dragon', n: 1 }), /Unknown unit/);
  bad(act(room, a, { op: 'train', u: 'militia', n: 30 }), /population/);
  ok(act(room, a, { op: 'train', u: 'militia', n: 2 }));
  ok(act(room, a, { op: 'train', u: 'peasant', n: 1 }));
  assert.equal(g.pop(k), 6);
  secs(10); assert.equal(g.tile(k.home).units.militia, 1);
  secs(10); assert.equal(g.tile(k.home).units.militia, 2);
  secs(8); assert.equal(k.peasants, 4);
  // the view lists what can be built with costs and what's missing
  k.res.wood = 0;
  const v = g.view(a);
  const lib = v.available.buildings.find((b) => b.b === 'library');
  assert.equal(lib.can, false); assert.match(lib.why, /Age 3/);
  const fm = v.available.buildings.find((b) => b.b === 'farm');
  assert.equal(fm.can, false); assert.equal(fm.missing.wood, 72);
  assert.equal(v.available.age.next, 3);
  // research needs a Library; tiers 3+ a University; order within a track
  k.age = 3; k.b.library = 1; rich(k);
  bad(act(room, a, { op: 'research', tech: 'saws' }), /Better Plows first/);
  bad(act(room, a, { op: 'research', tech: 'masonry' }), /University/);
  ok(act(room, a, { op: 'research', tech: 'plows' })); bad(act(room, a, { op: 'research', tech: 'tactics' }), /Already researching/);
  secs(31); assert(k.techs.has('plows'));
  bad(act(room, a, { op: 'research', tech: 'plows' }), /Already/);
});

// Two humans; Ann's kingdom gets some land and soldiers placed by hand.
function duel(settings = {}, names = ['Ann', 'Bo']) {
  const s = setup({ humans: names, settings: { events: false, ...settings } });
  return s;
}

test('Marches: BFS path around lakes, march time = path × slowest speed (own land 25% faster)', () => {
  const { room, g, H: [a], K, secs } = duel();
  const k = K(a), W = g.world, H0 = g.tile(k.home);
  // pick a direction where 4 steps stay on the map, block the straight line with a lake wall
  let d = M.DIRS.find(([dq, dr]) => W.at(H0.q + 4 * dq, H0.r + 4 * dr));
  const at = (n) => W.at(H0.q + n * d[0], H0.r + n * d[1]);
  for (const T of W.tiles) if (T.i !== k.home && !T.cap) { T.o = null; T.units = {}; if (!M.passable(T.t)) T.t = 'p'; }
  const target = at(4); target.o = k.id; target.t = 'p';
  at(2).t = 'l'; at(3).t = 'm';
  g.census();
  const path = W.path(k.home, target.i);
  assert(path && path.length > 4, 'detour around the lake');
  assert(path.every((i) => M.passable(g.tile(i).t)));
  assert.equal(path[path.length - 1], target.i);
  // a straight line would have been 4: BFS gives the shortest detour
  assert.equal(path.length, 5);
  H0.units = { militia: 3, knight: 2 };
  const r = ok(act(room, a, { op: 'march', from: qr(g, k.home), to: { q: target.q, r: target.r }, units: { militia: 3, knight: 2 }, order: 'move' }));
  const own = path.filter((i) => g.tile(i).o === k.id).length;
  assert.equal(r.eta, ((path.length - own) * 5 + own * 5 * 0.75) * 1000, 'slowest unit (militia 5 s/hex), own land 25% faster');
  assert.deepEqual(H0.units, {});
  const v = g.view(a); assert.equal(v.myArmies.length, 1); assert.equal(v.myArmies[0].units.militia, 3);
  const tv = room.tvState().state; assert.equal(tv.armies.length, 1); assert.equal(tv.armies[0].n, 5); assert.equal(tv.armies[0].path.length, 2 * (path.length + 1));
  secs(Math.ceil(r.eta / 1000) + 1);
  assert.deepEqual(target.units, { militia: 3, knight: 2 }); assert.equal(g.armies.size, 0);
  // knights alone are faster
  const r2 = ok(act(room, a, { op: 'march', from: [target.q, target.r], to: qr(g, k.home), units: { knight: 2 } }));
  assert(r2.eta < r.eta);
  // fully walled in: no way through
  const lone = at(4); for (const n of lone.nb) { const N = g.tile(n); if (N.i !== k.home) N.t = 'l'; }
  bad(act(room, a, { op: 'march', from: [lone.q, lone.r], to: qr(g, k.home), units: { militia: 1 } }), /no way/);
  H0.units = { militia: 1 };
  bad(act(room, a, { op: 'march', to: qr(g, at(2).i), units: { militia: 1 } }), /lakes/);
});

test('Battles: counters, walls, catapults, hills, losses, defender wins', () => {
  const { room, g, H: [a, b], K, secs } = duel();
  const A = K(a), B = K(b);
  const T = g.tile(B.tiles.find((i) => i !== B.home && g.tile(i).t !== 'h'));
  T.v = 1; T.w = 1; T.units = { spear: 4 };
  // knights into spearmen: spearmen ×2 on defence
  near(g.attackPower({ knight: 4 }, A, T), 36);
  near(g.defencePower(T, { knight: 4 }), (3 + 4 * 6 * 2) * 1.25);
  // archers beat spearmen ×2 (half the defenders are spearmen → +50%)
  T.units = { spear: 2, militia: 2 };
  near(g.attackPower({ archer: 2 }, A, T), 2 * 6 * 1.5);
  // catapults: ×3 against walls and cancel half the wall bonus (by their share)
  near(g.attackPower({ catapult: 2 }, A, T), 72);
  near(g.defMult(T, { catapult: 2 }), 1 + 0.25 * 0.5);
  near(g.defMult(T, { catapult: 1, militia: 1 }), 1 + 0.25 * 0.75);
  // capital: +20%, walls building, watchtower, hills
  B.b.walls = 2; B.b.tower = 1; const C = g.tile(B.home);
  near(g.defMult(C, {}), 1 + 0.5 + 0.1 + 0.2);
  const hill = g.tile(B.tiles.find((i) => g.tile(i).t === 'h')); near(g.defMult(hill, {}), 1.15);
  B.techs.add('shields'); near(g.defMult(hill, {}), 1.25); B.techs.delete('shields');
  A.techs.add('tactics'); near(g.attackPower({ militia: 10 }, A, hill), 33); A.techs.delete('tactics');
  // a real fight: a weak attack loses and the survivors (if any) go home
  T.units = { spear: 10 }; T.w = 0;
  const path = g.world.path(A.home, T.i); assert(path);
  g.tile(A.home).units = { militia: 2 };
  ok(act(room, a, { op: 'march', to: qr(g, T.i), units: { militia: 2 } }));
  bad(act(room, a, { op: 'march', to: qr(g, T.i), units: { militia: 1 } }), /only have 0/);
  secs(60);
  assert.equal(T.o, B.id, 'defender held'); assert(T.units.spear >= 9, 'defender lost little');
  assert.equal(A.stats.battles, 1); assert.equal(B.stats.won, 1);
  const tv = room.tvState().state; assert(tv.battles.length === 0 || tv.battles[0].win === B.id);
  assert(room.fxLog.some((f) => f.kind === 'battle'));
});

test('Beginner’s peace: capitals are safe for the first 5 minutes, villages are not', () => {
  const { room, g, H: [a, b], K, secs } = setup({ humans: ['Ann', 'Bo'], settings: { events: false }, keepPeace: true });
  const A = K(a), B = K(b); g.tile(A.home).units = { militia: 4 }; A.res.food = 9999;
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: 2 } }), /protected/);
  ok(act(room, a, { op: 'march', to: qr(g, B.tiles.find((i) => i !== B.home)), units: { militia: 1 } }));
  assert(room.tvState().state.peaceIn > 0);
  secs(300); ok(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: 2 } }));
});

test('Village capture: owner changes, level −1, surrounding land follows, catapults break walls', () => {
  const { room, g, H: [a, b], K, secs } = duel();
  const A = K(a), B = K(b);
  const T = g.tile(B.tiles.find((i) => i !== B.home));
  T.v = 2; T.w = 2; T.units = { militia: 2, settlers: 1 };
  const around = T.nb.filter((n) => g.tile(n).o === B.id && !g.tile(n).cap);
  g.tile(A.home).units = { knight: 10, catapult: 2 };
  A.age = 4;
  ok(act(room, a, { op: 'march', to: qr(g, T.i), units: { knight: 10, catapult: 2 }, order: 'attack' }));
  assert(B.alerts.some((x) => /marching/.test(x.text)));
  secs(120);
  assert.equal(T.o, A.id); assert.equal(T.v, 1); assert.equal(T.w, 1, 'catapults knocked a wall level down');
  assert(T.units.knight > 0, 'the attackers garrison the village');
  for (const n of around) if (!g.tile(n).v && !g.tile(n).cap && !Object.keys(g.tile(n).units).length) assert.equal(g.tile(n).o, A.id);
  assert.equal(A.stats.captures, 1);
  assert(room.fxLog.some((f) => f.kind === 'capture'));
  // an empty plain tile is simply walked into
  const L = g.tile(B.tiles.find((i) => i !== B.home && !g.tile(i).v && g.tile(i).o === B.id) ?? B.tiles[0]);
  if (L.i !== B.home) { T.units.knight = 5; ok(act(room, a, { op: 'march', from: qr(g, T.i), to: qr(g, L.i), units: { knight: 1 } })); secs(30); assert.equal(L.o, A.id); }
});

test('Capital → vassal (tribute, can’t attack liege), rebellion succeeds or fails', () => {
  const { room, g, H: [a, b], K, secs } = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { events: false } }); // 3 kingdoms: one vassal doesn't end the game
  const A = K(a), B = K(b);
  g.tile(A.home).units = { knight: 30 }; A.age = 4; A.res.food = 5000;
  B.peasants = 10; B.jobs = { farm: 4, chop: 6, quarry: 0, mine: 0, study: 0 };
  ok(act(room, a, { op: 'march', to: qr(g, B.home), units: { knight: 25 } }));
  secs(90);
  assert.equal(B.vassalOf, A.id, 'B is a vassal');
  assert.equal(g.tile(B.home).o, B.id, 'B keeps its capital');
  assert(g.tile(A.home).units.knight > 20, 'the army came home');
  // tribute: 25% of B's wood goes to A
  A.jobs = { farm: 0, chop: 0, quarry: 0, mine: 0, study: 0 }; A.peasants = 0;
  const aw = A.res.wood, bw = B.res.wood; secs(1);
  near(A.res.wood - aw, (B.res.wood - bw) / 3, 1e-6);
  // a vassal can't attack its liege
  g.tile(B.home).units = { militia: 5 };
  bad(act(room, b, { op: 'march', to: qr(g, A.home), units: { militia: 2 } }), /liege/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { knight: 1 } }), /vassal/);
  bad(act(room, b, { op: 'ally', to: a.id }), /Vassals/);
  // rebellion: too weak → refused; strong → roll
  bad(act(room, b, { op: 'rebel' }), /Not strong enough/);
  assert.equal(g.view(b).rebel.can, false);
  g.tile(B.home).units = { guard: 40 }; B.age = 5; g.census();
  assert.equal(g.view(b).rebel.can, true);
  room.rng = () => 0.999; // the roll fails
  const r = ok(act(room, b, { op: 'rebel' })); assert.equal(r.free, false); assert.equal(B.vassalOf, A.id);
  assert(g.tile(B.home).units.guard < 40, 'a failed rising costs soldiers');
  bad(act(room, b, { op: 'rebel' }), /before rising again/);
  secs(61); room.rng = () => 0;
  const r2 = ok(act(room, b, { op: 'rebel' })); assert.equal(r2.free, true); assert.equal(B.vassalOf, null);
  assert(room.fxLog.some((f) => f.kind === 'rebel' && f.ok));
  bad(act(room, b, { op: 'rebel' }), /free/);
});

test('Alliances: propose/answer, can’t attack allies, reinforce, leave → traitor for 3 minutes', () => {
  const { room, g, H: [a, b, c], K, secs } = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { events: false } });
  const A = K(a), B = K(b), C = K(c);
  bad(act(room, a, { op: 'ally', to: a.id }), /another/); bad(act(room, a, { op: 'ally', to: 'p999' }), /another/);
  ok(act(room, a, { op: 'ally', to: b.id })); bad(act(room, a, { op: 'ally', to: b.id }), /already a proposal/);
  assert.equal(g.view(b).diplomacy.in.length, 1);
  bad(act(room, c, { op: 'allyAnswer', from: a.id, yes: true }), /gone/);
  ok(act(room, b, { op: 'allyAnswer', from: a.id, yes: true }));
  assert(A.ally && A.ally === B.ally);
  g.tile(A.home).units = { militia: 4 };
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: 1 }, order: 'attack' }), /ally/);
  // reinforcing hands soldiers to the ally
  const r = ok(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: 2 } }));
  assert.equal(g.armies.get(r.army).order, 'reinforce');
  secs(80); assert.equal(g.tile(B.home).units.militia, 2);
  // allies see each other's garrisons; strangers don't
  const tB = g.view(a).world.tiles.find((t) => t.q === g.tile(B.home).q && t.r === g.tile(B.home).r);
  assert.deepEqual(tB.u, { militia: 2 });
  const tB2 = g.view(c).world.tiles.find((t) => t.q === g.tile(B.home).q && t.r === g.tile(B.home).r);
  assert.equal(tB2.u, undefined); assert.equal(tB2.g, 2);
  // C joins: groups merge; then A betrays
  ok(act(room, c, { op: 'ally', to: b.id })); ok(act(room, b, { op: 'allyAnswer', from: c.id, yes: true }));
  assert.equal(g.alliances.get(A.ally).members.length, 3);
  g.alliances.get(A.ally).monument = 100;
  const al = A.ally;
  ok(act(room, a, { op: 'leaveAlly' }));
  assert.equal(A.ally, null); assert.equal(g.alliances.get(al).monument, 70, 'monument loses 30%');
  let tv = room.tvState().state;
  assert.equal(tv.kingdoms.find((x) => x.id === a.id).traitor, true);
  assert.equal(A.stats.betrayals, 1);
  bad(act(room, a, { op: 'leaveAlly' }), /not in an alliance/);
  ok(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: 1 }, order: 'attack' })); // not allies any more
  secs(181);
  tv = room.tvState().state; assert.equal(tv.kingdoms.find((x) => x.id === a.id).traitor, false);
  // declines and expiry
  ok(act(room, a, { op: 'ally', to: c.id })); ok(act(room, c, { op: 'allyAnswer', from: a.id, yes: false }));
  assert(!g.allied(a.id, c.id));
  ok(act(room, a, { op: 'ally', to: c.id })); secs(61); assert.equal(g.offers.length, 0);
});

test('Gifts, trades (escrow, expiry, neighbour fee), market, messages', () => {
  const { room, g, H: [a, b, c], K, secs } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Di', 'Ed'], settings: { events: false } });
  const A = K(a), B = K(b);
  bad(act(room, a, { op: 'gift', to: b.id, res: { food: 10 } }), /Market/);
  A.b.market = 1; A.res.food = 100;
  bad(act(room, a, { op: 'gift', to: b.id, res: { food: -5 } }), /positive/);
  bad(act(room, a, { op: 'gift', to: b.id, res: { food: 'abc' } }), /positive/);
  bad(act(room, a, { op: 'gift', to: b.id, res: { mana: 5 } }), /Unknown resource/);
  bad(act(room, a, { op: 'gift', to: b.id, res: { food: 500 } }), /Not enough/);
  bad(act(room, a, { op: 'gift', to: b.id, res: {} }), /Pick/);
  const bf = B.res.food; ok(act(room, a, { op: 'gift', to: b.id, res: { food: 40 } })); assert.equal(B.res.food, bf + 40); assert.equal(A.stats.gifts, 1);
  // trade: give is held in escrow, the answer completes it (neighbours pay no fee)
  assert(A.neighbours.includes(b.id));
  A.res.wood = 100; B.res.stone = 50;
  const t = ok(act(room, a, { op: 'trade', to: b.id, give: { wood: 60 }, get: { stone: 30 } }));
  assert.equal(A.res.wood, 40);
  bad(act(room, b, { op: 'tradeAnswer', id: 'o999', yes: true }), /gone/);
  ok(act(room, b, { op: 'tradeAnswer', id: t.id, yes: true }));
  assert.equal(A.res.stone, 30); assert.equal(B.res.stone, 20); assert.equal(Math.round(B.res.wood), 50 + 60);
  // declined → refund; expired → refund; non-neighbours lose 10%
  const t2 = ok(act(room, a, { op: 'trade', to: b.id, give: { wood: 20 }, get: { gold: 5 } })); ok(act(room, b, { op: 'tradeAnswer', id: t2.id, yes: false })); assert.equal(A.res.wood, 40);
  ok(act(room, a, { op: 'trade', to: b.id, give: { wood: 20 }, get: { gold: 5 } })); assert.equal(A.res.wood, 20); secs(61); assert.equal(Math.round(A.res.wood), 40, 'expired offer refunded');
  const far = K(room.list().find((p) => !A.neighbours.includes(p.id) && p.id !== a.id));
  assert(far);
  A.res.wood = 100; far.res.food = 100;
  const t3 = ok(act(room, a, { op: 'trade', to: far.id, give: { wood: 100 }, get: { food: 50 } }));
  const fw = far.res.wood, af = A.res.food;
  ok(act(room, room.get(far.id), { op: 'tradeAnswer', id: t3.id, yes: true }));
  assert.equal(Math.round(far.res.wood - fw), 90); assert.equal(Math.round(A.res.food - af), 45);
  // market 3:1 at level 1
  A.res.wood = 90; bad(act(room, a, { op: 'market', give: 'wood', get: 'wood', n: 30 }), /different/);
  bad(act(room, a, { op: 'market', give: 'wood', get: 'gold', n: 300 }), /only have/);
  const g0 = A.res.gold; ok(act(room, a, { op: 'market', give: 'wood', get: 'gold', n: 90 })); assert.equal(A.res.gold - g0, 30);
  // messages show on the TV ~8 s
  bad(act(room, a, { op: 'message', preset: 'rude' }), /Pick a message/);
  ok(act(room, a, { op: 'message', preset: 'peace', to: b.id }));
  bad(act(room, a, { op: 'message', preset: 'help' }), /Wait/);
  let tv = room.tvState().state; const m = tv.kingdoms.find((x) => x.id === a.id).msg;
  assert.equal(m.text, D.PRESETS.peace); assert.equal(m.to, b.id);
  assert(B.alerts.some((x) => x.text.includes(D.PRESETS.peace)));
  secs(9); tv = room.tvState().state; assert.equal(tv.kingdoms.find((x) => x.id === a.id).msg, null);
});

test('Settlers: claim a free tile next to your land → village Lv1 with land around it', () => {
  const { room, g, H: [a], K, secs } = duel();
  const A = K(a);
  bad(act(room, a, { op: 'claim', to: qr(g, A.home) }), /Age 2/);
  A.age = 2; rich(A);
  ok(act(room, a, { op: 'train', u: 'settlers', n: 1 })); secs(16);
  assert.equal(g.tile(A.home).units.settlers, 1);
  const target = A.tiles.flatMap((i) => g.tile(i).nb).map((i) => g.tile(i)).find((T) => !T.o && M.passable(T.t));
  const farAway = g.world.tiles.find((T) => !T.o && M.passable(T.t) && !g.adjacentToLand(A, T.i));
  bad(act(room, a, { op: 'claim', to: qr(g, farAway.i) }), /next to your land/);
  bad(act(room, a, { op: 'claim', to: qr(g, g.tile(K(room.list()[1]).home).i) }), /belongs/);
  bad(act(room, a, { op: 'claim', to: { q: 99, r: 99 } }), /Pick a tile/);
  const land = A.land, cap = g.cap(A);
  ok(act(room, a, { op: 'claim', to: qr(g, target.i) }));
  secs(40);
  assert.equal(target.o, A.id); assert.equal(target.v, 1);
  assert(A.land > land + 0); assert.equal(g.cap(A), cap + 3);
  assert(room.fxLog.some((f) => f.kind === 'village'));
  // village upgrades
  ok(act(room, a, { op: 'upgrade', at: qr(g, target.i), what: 'village' })); assert.equal(target.v, 2);
  ok(act(room, a, { op: 'upgrade', at: qr(g, target.i), what: 'walls' })); assert.equal(target.w, 1);
  bad(act(room, a, { op: 'upgrade', at: qr(g, A.home), what: 'village' }), /villages/);
});

test('Win: World Domination (every capital directly or through vassals)', () => {
  const { room, g, H: [a, b, c], K, secs } = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { events: false, mode: 'conquest' } });
  const A = K(a), B = K(b), C = K(c);
  B.vassalOf = a.id; secs(1); assert.equal(g.phase, 'play');
  assert.equal(room.tvState().state.progress.domination, 2 / 3);
  C.vassalOf = b.id; secs(1); // a vassal's vassal counts for the top liege
  assert.equal(g.phase, 'over');
  assert.deepEqual(g.winner.ids, [a.id]); assert.equal(g.winner.mode, 'conquest');
  const tv = room.tvState().state; assert.equal(tv.phase, 'over'); assert.equal(tv.standings[0].id, a.id); assert(tv.awards.length >= 3);
  bad(act(room, a, { op: 'build', b: 'farm' }), /over/);
  assert(room.fxLog.some((f) => f.kind === 'win'));
});

test('Win: World Diplomacy (one alliance + the Peace Monument + 60 s of peace; leaving breaks it)', () => {
  const { room, g, H: [a, b, c], K, secs } = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { events: false, mode: 'diplomacy' } });
  const A = K(a), B = K(b), C = K(c);
  bad(act(room, a, { op: 'monument', res: { gold: 10 } }), /alliance/);
  ok(act(room, a, { op: 'ally', to: b.id })); ok(act(room, b, { op: 'allyAnswer', from: a.id, yes: true }));
  for (const k of [A, B, C]) k.res.gold = k.res.stone = 1000;
  bad(act(room, a, { op: 'monument', res: { gold: 400 } }), /Age 4/);
  A.age = 4; assert.equal(g.monumentNeed(), 1600, "400 × max(4, kingdoms)");
  ok(act(room, a, { op: "monument", res: { gold: 1000, stone: 600 } }));
  bad(act(room, a, { op: 'monument', res: { food: 10 } }), /Unknown resource/);
  secs(1); assert.equal(g.phase, 'play', 'C is still outside the alliance');
  assert.equal(room.tvState().state.progress.monument, 1);
  ok(act(room, c, { op: 'ally', to: a.id })); ok(act(room, a, { op: 'allyAnswer', from: c.id, yes: true }));
  secs(1); assert.equal(g.phase, 'play', 'the peace must hold first');
  assert(room.tvState().state.progress.peaceIn > 50000); assert(room.fxLog.some((f) => f.kind === 'peacehold'));
  secs(20); ok(act(room, c, { op: 'leaveAlly' })); secs(1);
  assert.equal(room.tvState().state.progress.peaceIn, null, 'a betrayal breaks the peace'); assert(room.fxLog.some((f) => f.kind === 'peacebroken'));
  C.traitorUntil = 0; A.res.gold = A.res.stone = 1000; ok(act(room, a, { op: 'monument', res: { gold: 400, stone: 200 } })); // the betrayal cost 30%
  ok(act(room, c, { op: 'ally', to: b.id })); ok(act(room, b, { op: 'allyAnswer', from: c.id, yes: true }));
  secs(30); assert.equal(g.phase, 'play'); secs(31);
  assert.equal(g.phase, 'over'); assert.equal(g.winner.mode, 'diplomacy');
  assert.deepEqual(g.winner.ids.slice().sort(), [a.id, b.id, c.id].sort());
  bad(act(room, a, { op: 'rocket' }), /over/);
});

test('Win: Science (Rocketry → Launch Pad → 3 rocket stages); attacks destroy a stage', () => {
  const { room, g, H: [a, b], K, secs } = duel({ mode: 'science' });
  const A = K(a), B = K(b);
  A.age = 5; rich(A, 20000); A.b.library = 1; A.b.university = 1;
  bad(act(room, a, { op: 'build', b: 'launchpad' }), /Rocketry/);
  bad(act(room, a, { op: 'research', tech: 'rocketry' }), /first|Observatory/);
  for (const t of ['writing', 'astronomy', 'physics']) A.techs.add(t);
  bad(act(room, a, { op: 'research', tech: 'rocketry' }), /Observatory/);
  A.b.observatory = 1; ok(act(room, a, { op: 'research', tech: 'rocketry' })); secs(52);
  assert(A.techs.has('rocketry'));
  bad(act(room, a, { op: 'rocket' }), /Launch Pad/);
  ok(act(room, a, { op: 'build', b: 'launchpad' })); secs(61); assert.equal(A.b.launchpad, 1);
  ok(act(room, a, { op: 'rocket' })); bad(act(room, a, { op: 'rocket' }), /already/);
  const cost1 = D.ROCKET[1]; assert(A.res.stone <= 20000 - cost1.stone * 0.8 + 1000);
  let tv = room.tvState().state; assert.equal(tv.progress.rockets[0].building, 1); assert(tv.progress.rockets[0].endsIn > 0);
  secs(61); assert.equal(A.stage, 1);
  // B smashes A's capital during stage 2: the stage under construction is lost
  ok(act(room, a, { op: 'rocket' }));
  g.tile(B.home).units = { guard: 60 }; B.age = 5;
  ok(act(room, b, { op: 'march', to: qr(g, A.home), units: { guard: 60 } }));
  secs(59);
  assert.equal(A.rocket, null); assert.equal(A.stage, 1); assert.equal(A.vassalOf, b.id);
  ok(act(room, a, { op: 'rocket' })); secs(61); assert.equal(A.stage, 2);
  ok(act(room, a, { op: 'rocket' })); secs(61);
  assert.equal(g.phase, 'over'); assert.equal(g.winner.mode, 'science'); assert.deepEqual(g.winner.ids, [a.id]);
  assert(room.fxLog.some((f) => f.kind === 'launch'));
});

test('Win modes gate each other: no rocket in conquest, no monument in science', () => {
  const s1 = duel({ mode: 'conquest' }); const A = s1.K(s1.H[0]); A.age = 5; A.techs.add('rocketry');
  bad(act(s1.room, s1.H[0], { op: 'build', b: 'launchpad' }), /science/);
  bad(act(s1.room, s1.H[0], { op: 'rocket' }), /off/);
  assert(!s1.g.view(s1.H[0]).available.buildings.some((b) => b.b === 'launchpad'));
  const s2 = duel({ mode: 'science' });
  bad(act(s2.room, s2.H[0], { op: 'monument', res: { gold: 1 } }), /off/);
});

test('Time limit: the best Kingdom Score wins (conquest mode: the most capitals)', () => {
  const { room, g, H: [a, b], K } = duel({ timeLimit: 20 });
  K(b).b.houses = 3; K(b).age = 3;
  let i = 0; while (g.phase === 'play' && room.clock.step()) if (++i > 5000) throw new Error('never ended');
  assert.equal(g.phase, 'over'); assert.equal(g.winner.mode, 'score'); assert.equal(g.winner.reason, 'time');
  assert.deepEqual(g.winner.ids, [b.id]);
  assert(room.clock.t >= 20 * 60000 && room.clock.t <= 20 * 60000 + 2000);
  const s = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { events: false, timeLimit: 20, mode: 'conquest' } });
  s.K(s.H[2]).vassalOf = s.H[0].id; s.K(s.H[1]).age = 5; s.K(s.H[1]).b.houses = 3;
  while (s.g.phase === 'play' && s.clock.step());
  assert.equal(s.g.winner.mode, 'conquest'); assert.deepEqual(s.g.winner.ids, [s.H[0].id], 'most capitals beats a higher score');
});

test('Privacy: tv() has no resources/research; view(p) has no other player’s private data', () => {
  const { room, g, H: [a, b], K, secs } = setup({ humans: ['Ann', 'Bo'], bots: 3, settings: { events: false } });
  const B = K(b); B.res.gold = 777777; B.techs.add('plows'); g.tile(B.home).units = { knight: 13 };
  secs(3);
  const tv = room.tvState().state, js = JSON.stringify(tv);
  for (const word of ['"res"', '"research"', '"workers"', '"techs"', '"jobs"', '"queue"', '"units"', '777777', 'knight']) assert(!js.includes(word), `tv leaks ${word}`);
  assert(tv.world.tiles.every((t) => ['q', 'r', 't', 'o', 'v', 'w', 'g'].every((x) => x in t)));
  const capB = tv.world.tiles.find((t) => t.c === b.id); assert.equal(capB.g, 13, 'only the count is public');
  const v = g.view(a), vs = JSON.stringify(v);
  assert(!vs.includes('777777')); assert(!vs.includes('plows') || !vs.includes('"done":["plows"]'));
  assert(v.kingdoms.every((k) => !('res' in k) && !('research' in k)));
  const tB = v.world.tiles.find((t) => t.c === b.id); assert.equal(tB.u, undefined);
  assert.equal(v.res.gold, Math.floor(K(a).res.gold)); assert.deepEqual(v.research.done, []);
  // a scout reveals the garrison for a while
  const A = K(a); A.age = 1; g.tile(A.home).units = { scout: 1 };
  ok(act(room, a, { op: 'march', to: qr(g, B.home), units: { scout: 1 } }));
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { scout: 1 }, order: 'scout' }), /only have 0/);
  secs(60);
  const tB2 = g.view(a).world.tiles.find((t) => t.c === b.id); assert.deepEqual(tB2.u, { knight: 13 });
  assert(A.alerts.some((x) => /Scouts report/.test(x.text)));
  // other players' armies only appear when they concern you
  g.tile(B.home).units = { knight: 13 };
  const other = room.list().find((p) => p.bot); const O = K(other);
  const target = g.tile(O.tiles.find((i) => i !== O.home));
  ok(act(room, b, { op: 'march', to: qr(g, target.i), units: { knight: 2 }, order: 'attack' }));
  assert.equal(g.view(a).armies.filter((x) => x.o === b.id).length, 0);
  assert.equal(room.tvState().state.armies.filter((x) => x.o === b.id).length, 1);
  assert.equal(g.view(a).myArmies.length + g.view(b).myArmies.length >= 1, true);
});

test('Validation: unknown ops/ids, NaN, negatives, units beyond what is there, wrong tiles', () => {
  const { room, g, H: [a, b], K } = duel();
  const A = K(a), B = K(b); g.tile(A.home).units = { militia: 3 };
  bad(act(room, a, { op: 'fly' }), /Unknown action/);
  bad(act(room, a, null), /Unknown action/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: 4 } }), /only have 3/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: -1 } }), /whole/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: NaN } }), /whole/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: '1e9' } }), /only have/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { dragon: 1 } }), /Unknown unit/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { peasant: 1 } }), /Peasants/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: {} }), /Pick some units/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: 'all' }), /Pick some units/);
  bad(act(room, a, { op: 'march', to: { q: 50, r: 50 }, units: { militia: 1 } }), /target/);
  bad(act(room, a, { op: 'march', from: qr(g, B.home), to: qr(g, A.home), units: { militia: 1 } }), /your own land/);
  bad(act(room, a, { op: 'march', to: qr(g, A.home), units: { militia: 1 } }), /already there/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: 1 }, order: 'dance' }), /Unknown order/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: 1 }, order: 'move' }), /own land/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: 1 }, order: 'reinforce' }), /ally/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: 1 }, order: 'scout' }), /Scouts/);
  bad(act(room, a, { op: 'march', to: qr(g, B.home), units: { militia: 1 }, order: 'claim' }), /Settlers/);
  bad(act(room, a, { op: 'march', to: qr(g, A.tiles.find((i) => i !== A.home)), units: { militia: 1 }, order: 'attack' }), /own land/);
  bad(act(room, a, { op: 'train', u: 'militia', n: -2 }), /between/);
  bad(act(room, a, { op: 'train', u: 'militia', n: 'lots' }), /between/);
  bad(act(room, a, { op: 'cancel', queue: 'build', i: 0 }), /Nothing/);
  bad(act(room, a, { op: 'cancel', queue: 'x', i: 0 }), /Unknown queue/);
  bad(act(room, a, { op: 'trade', to: b.id, give: { wood: 10 }, get: {} }), /Get/);
  bad(act(room, a, { op: 'trade', to: b.id, give: { wood: 1e9 }, get: { food: 1 } }), /Not enough/);
  bad(act(room, a, { op: 'tradeAnswer', id: 'nope', yes: true }), /gone/);
  bad(act(room, a, { op: 'market', give: 'wood', get: 'gold', n: 5 }), /Market/);
  bad(act(room, a, { op: 'rename', name: '<<>>' }), /name/);
  ok(act(room, a, { op: 'rename', name: 'Avalon' })); assert.equal(A.name, 'Avalon');
  // nothing above changed any resources or units
  assert.deepEqual(g.tile(A.home).units, { militia: 3 });
  assert.deepEqual(A.res, { food: 50, wood: 50, stone: 0, gold: 0, sci: 0 });
  // spectators (joined after the world was full) can't act
  const late = room.join('Zed').player;
  if (!g.k.has(late.id)) { bad(act(room, late, { op: 'build', b: 'farm' }), /watching/); assert.equal(g.view(late).spectator, true); }
});

test('World events: harvest, plague, bandits, gold rush, comet', () => {
  const { room, g, H: [a, b], K, secs } = duel({ events: true });
  const A = K(a), B = K(b);
  const f = A.res.food; g.fireEvent('harvest'); assert.equal(A.res.food, f + 100);
  A.peasants = 10; A.jobs.farm = 10; B.peasants = 10; B.b.library = 1;
  g.fireEvent('plague'); assert.equal(A.peasants, 8); assert.equal(B.peasants, 10); assert(A.jobs.farm <= 8);
  const s = A.res.sci; g.fireEvent('comet'); assert.equal(A.res.sci, s + 30);
  const gr = g.perWorker(A, 'mine'); g.fireEvent('goldrush'); assert(g.perWorker(A, 'mine') >= gr);
  assert.equal(room.tvState().state.events.current.kind, 'goldrush');
  // bandits raid the weakest village
  const T = g.tile(B.tiles.find((i) => i !== B.home)); T.v = 1; T.units = {};
  const army = g.bandits(g.now()); assert(army); assert.equal(army.to, T.i); assert.equal(army.o, null);
  assert.equal(room.tvState().state.armies.find((x) => x.id === army.id).kind, 'bandits');
  secs(31);
  assert.equal(T.v, 0, 'the village was raided'); assert.equal(T.o, B.id);
  // automatic events every ~3 minutes
  const fx0 = room.fxLog.filter((x) => x.kind === 'event').length;
  secs(330); assert(room.fxLog.filter((x) => x.kind === 'event').length > fx0);
  const off = duel({ events: false }); off.secs(400); assert(!off.room.fxLog.some((x) => x.kind === 'event'));
});

test('Skip ahead: next() fast-forwards 60 s of game time without breaking anything', () => {
  const { room, g, H: [a], K } = duel();
  const A = K(a); rich(A); ok(act(room, a, { op: 'build', b: 'houses' }));
  const left = room.tvState().state.timeLeft;
  ok(room.hostAction({ type: 'next' }));
  assert.equal(A.b.houses, 1, 'the 20 s build finished');
  const left2 = room.tvState().state.timeLeft; assert.equal(left - left2, 60000);
  for (let i = 0; i < 40; i++) g.next();
  assert.equal(g.phase, 'over', 'the 30-minute limit passed'); assert.equal(g.winner.reason, 'time');
  g.next(); assert.equal(g.phase, 'over');
  const lobby = setup({ humans: ['Ann'], start: false }); lobby.g.next(); assert.equal(lobby.g.phase, 'lobby');
});

test('Joining and leaving mid-game: a newcomer gets a free spot or watches; leavers get a steward bot', () => {
  const { room, g, H: [a, b], K, secs } = duel({ mapSize: 'large' });
  const late = room.join('Cy').player;
  assert(g.k.has(late.id), 'large map has room for a newcomer');
  const C = g.k.get(late.id); assert(g.tile(C.home).cap === late.id && C.land === 7);
  room.remove(b.id); assert.equal(K(b).ai.p, 'builder'); assert.equal(K(b).gone, true);
  secs(30); assert.equal(g.errors, 0);
  // play again goes back to a fresh lobby world
  for (const p of room.list()) if (!p.bot && p.id !== a.id) room.remove(p.id);
  K(a).vassalOf = null; g.end('score', [a.id]);
  ok(room.hostAction({ type: 'again' })); assert.equal(room.game.phase, 'play');
});

test('results(): player ids best-first once the game is over (winners first), empty before', () => {
  const { room, g, H: [a, b, c], K } = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { events: false } });
  assert.deepEqual(g.results(), []);
  K(c).age = 4; K(c).b.houses = 3; g.census();
  g.end('score', [b.id]);
  const r = g.results(); assert.equal(r.length, 3); assert.equal(r[0], b.id, 'the winner first'); assert.equal(r[1], c.id, 'then by score');
  assert.deepEqual(room.tvState().state.standings.map((s) => s.id), r);
});

test('Royal Decrees: a guided path; each one pays its reward once and the next one shows', () => {
  const { room, g, H: [a], K, secs } = setup({ humans: ['Ann'], settings: { events: false }, decrees: true });
  const k = K(a);
  let v = g.view(a); assert.equal(v.decree.key, 'work'); assert.equal(v.decree.n, 1); assert.equal(v.decree.of, D.DECREES.length);
  const f0 = k.res.food;
  ok(act(room, a, { op: 'jobs', farm: 2, chop: 1 })); secs(1);
  assert.equal(k.decree, 1); assert(k.res.food > f0 + 39, 'got the food reward');
  assert(k.alerts.some((x) => /Decree fulfilled/.test(x.text)));
  v = g.view(a); assert.equal(v.decree.key, 'houses');
  k.b.houses = 1; k.peasants = 6; k.jobs.farm = 6; secs(1); secs(1);
  assert.equal(g.view(a).decree.key, 'age2', 'one decree per tick, in order');
  k.decree = D.DECREES.length; secs(1); assert.equal(g.view(a).decree, null);
});

test('Auto workers: one tap spreads every peasant over the open jobs with food covered', () => {
  const { room, g, H: [a], K, secs } = setup({ humans: ['Ann'], settings: { events: false } });
  const k = K(a); k.peasants = 9; k.age = 2;
  const r = ok(act(room, a, { op: 'jobs', auto: true }));
  const tot = Object.values(k.jobs).reduce((x, y) => x + y, 0);
  assert.equal(tot, 9, 'nobody idle'); assert(k.jobs.farm >= 1); assert.equal(k.jobs.mine, 0, 'mine is locked in Age 2'); assert.equal(k.jobs.study, 0);
  assert.deepEqual(r.jobs, k.jobs);
  secs(1); assert(k.rates.food >= 0, 'food is covered');
  bad(act(room, a, { op: 'jobs', auto: 'yes', dance: 1 }), /Unknown job/);
});

test('Recall: every soldier out on villages and land marches back to the capital', () => {
  const { room, g, H: [a], K, secs } = duel();
  const k = K(a), out = k.tiles.filter((i) => i !== k.home).slice(0, 2);
  bad(act(room, a, { op: 'recall' }), /already/);
  g.tile(out[0]).units = { spear: 3 }; g.tile(out[1]).units = { militia: 2, scout: 1 };
  const r = ok(act(room, a, { op: 'recall' })); assert.equal(r.n, 5);
  assert.equal(g.tile(out[1]).units.scout, 1, 'scouts stay');
  secs(30); assert.equal(g.tile(k.home).units.spear, 3); assert.equal(g.tile(k.home).units.militia, 2);
});

test('Royal Council: a vote opens on schedule; sanctions cut production, grants pay; validation', () => {
  const { room, g, H: [a, b, c, d], K, secs } = setup({ humans: ['Ann', 'Bo', 'Cy', 'Di'], settings: { events: false } });
  bad(act(room, a, { op: 'vote', to: b.id }), /not in session/);
  g.nextCouncilAt = g.now() + 1000; g.lastMotion = 'grant'; secs(2);
  const C = room.tvState().state.council; assert(C && C.kind === 'sanction' && C.endsIn > 30000); assert.equal(C.of, 4);
  assert(room.fxLog.some((f) => f.kind === 'council'));
  bad(act(room, a, { op: 'vote', to: a.id }), /yourself/); bad(act(room, a, { op: 'vote', to: 'nope' }), /Pick/);
  ok(act(room, a, { op: 'vote', to: c.id })); ok(act(room, b, { op: 'vote', to: d.id })); ok(act(room, b, { op: 'vote', to: c.id })); // change of mind
  ok(act(room, d, { op: 'vote', to: a.id }));
  assert.equal(g.view(a).council.mine, c.id); assert.deepEqual(room.tvState().state.council.tally[0], { id: c.id, n: 2 });
  secs(41); assert.equal(g.council, null);
  const Cy = K(c); assert(Cy.sanctionUntil > g.now()); assert(room.fxLog.some((f) => f.kind === 'councilResult' && f.who === c.id));
  near(g.prodMult(Cy), 0.7); assert(g.view(c).me.sanction > 0);
  // the next motion is a grant: the chosen kingdom gets gold and stone; ties go to the weakest
  g.nextCouncilAt = g.now(); secs(1); assert.equal(g.council.kind, 'grant');
  K(b).b.houses = 3; g.census();
  ok(act(room, a, { op: 'vote', to: b.id })); ok(act(room, c, { op: 'vote', to: d.id }));
  const g0 = K(d).res.gold; secs(41); assert(K(d).res.gold >= g0 + 140, 'the tie went to the lower score');
});

test('Bounties: escrowed gold goes to whoever takes a village or the capital; expiry refunds', () => {
  const { room, g, H: [a, b, c], K, secs } = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { events: false } });
  const A = K(a), B = K(b), C = K(c);
  A.res.gold = 500;
  bad(act(room, a, { op: 'bounty', to: a.id, gold: 100 }), /another/); bad(act(room, a, { op: 'bounty', to: b.id, gold: 10 }), /at least/);
  bad(act(room, a, { op: 'bounty', to: b.id, gold: 9000 }), /only have/); bad(act(room, a, { op: 'bounty', to: b.id, gold: 'x' }), /at least/);
  ok(act(room, a, { op: 'bounty', to: b.id, gold: 100 })); ok(act(room, a, { op: 'bounty', to: b.id, gold: 50 }));
  assert.equal(A.res.gold, 350); assert.equal(room.tvState().state.kingdoms.find((k) => k.id === b.id).bounty, 150);
  assert.equal(g.view(a).bounties[0].gold, 150);
  // Cy takes one of Bo's villages
  const vi = B.tiles.find((i) => i !== B.home); g.tile(vi).v = 1; g.tile(vi).units = {};
  g.tile(C.home).units = { spear: 20 }; const cg = C.res.gold;
  ok(act(room, c, { op: 'march', to: qr(g, vi), units: { spear: 20 } })); secs(60);
  assert.equal(g.tile(vi).o, c.id); assert.equal(C.res.gold, cg + 150); assert.equal(g.bounties.length, 0);
  assert(room.fxLog.some((f) => f.kind === 'bountyClaim'));
  // the people of Bo rise after losing a village
  assert(g.tile(B.home).units.militia >= 2);
  // an unclaimed bounty comes back after 5 minutes
  ok(act(room, a, { op: 'bounty', to: c.id, gold: 100 })); const ag = A.res.gold;
  secs(301); assert.equal(A.res.gold, ag + 100);
  ok(act(room, a, { op: 'ally', to: c.id })); ok(act(room, c, { op: 'allyAnswer', from: a.id, yes: true }));
  bad(act(room, a, { op: 'bounty', to: c.id, gold: 100 }), /ally/);
});

test('Comebacks: underdog bonus, a coalition against a runaway leader, a rally after losing the capital', () => {
  const { room, g, H: [a, b, c], K, secs } = setup({ humans: ['Ann', 'Bo', 'Cy'], settings: { events: false } });
  const A = K(a), B = K(b), C = K(c);
  secs(1); assert.equal(B.underdog, 0, 'no bonus in the first 3 minutes');
  g.skew += 200000; A.b.houses = 3; A.age = 4; A.b.farm = 3; A.b.lumber = 3; secs(1);
  assert(B.underdog > 0.1 && B.underdog <= 0.4, `underdog ${B.underdog}`); assert.equal(A.underdog, 0);
  near(g.prodMult(B), 1 + B.underdog);
  assert.equal(g.view(b).me.underdog, B.underdog);
  // two vassals → Ann is marked: others hit her land 20% harder
  B.vassalOf = a.id; C.vassalOf = null; const D4 = room.join('Di').player; const Dk = g.k.get(D4.id); if (Dk) Dk.vassalOf = a.id;
  secs(1);
  assert(Dk, 'Di got a kingdom'); {
    assert.equal(g.marked, a.id); assert(room.fxLog.some((f) => f.kind === 'coalition'));
    const T = g.tile(A.home), units = { spear: 10 };
    const pc = g.attackPower(units, C, T), pa = g.attackPower(units, A, g.tile(C.home));
    near(pc / (10 * 4 * g.counter('spear', T.units)), 1.2, 1e-6); assert(pa > 0);
    assert.equal(room.tvState().state.kingdoms.find((k) => k.id === a.id).marked, true);
  }
  // losing your capital: free militia at home
  C.vassalOf = null; g.tile(C.home).units = {}; g.vassalize(C, A);
  assert.equal(g.tile(C.home).units.militia, 3 + C.age);
  assert(C.alerts.some((x) => /people rise/.test(x.text)));
});

test('Pacing: ages, monument and rocket follow the time limit; avatars reach the screens', () => {
  const s20 = setup({ humans: ['Ann', 'Bo'], settings: { timeLimit: 20 } }), s60 = setup({ humans: ['Ann', 'Bo'], settings: { timeLimit: 60 } });
  const k20 = s20.K(s20.H[0]), k60 = s60.K(s60.H[0]); k20.age = k60.age = 2;
  const c20 = s20.g.canBuild(k20, 'castle').cost, c60 = s60.g.canBuild(k60, 'castle').cost;
  assert(c60.food > 3 * c20.food, `${c60.food} vs ${c20.food}`);
  assert(s60.g.monumentNeed() > s20.g.monumentNeed());
  const r = setup({ humans: ['Ann'], start: false }); r.room.get(r.H[0].id).avatar = '🦊';
  assert.equal(r.room.tvState().state.seats[0].avatar, '🦊');
  r.room.get(r.H[0].id).avatar = '<b>x</b>'; assert.equal(r.room.tvState().state.seats[0].avatar, null, 'unsafe avatars are dropped');
});

test('Bots: a 2-bot game left alone fights and ends', () => {
  const { g, clock } = setup({ bots: 2, settings: { timeLimit: 20 }, seed: 3 });
  while (g.phase === 'play' && clock.step());
  assert.equal(g.phase, 'over'); assert.equal(g.errors, 0);
  const ks = [...g.k.values()];
  assert(ks.some((k) => k.age >= 2)); assert(ks.reduce((a, k) => a + k.stats.battles + k.stats.captures, 0) > 0);
  console.log(`      2 bots: ${g.winner.mode} (${g.winner.reason}) after ${Math.round(clock.t / 60000)} min`);
});

test('Bots: a 10-bot game founds villages, climbs ages, fights battles and ends', () => {
  for (const seed of [7, 11]) {
    const { g, clock } = setup({ bots: 10, settings: { timeLimit: 30 }, seed });
    let at10 = null;
    while (g.phase === 'play' && clock.step()) if (!at10 && clock.t >= 10 * 60000) at10 = [...g.k.values()].map((k) => ({ ...k.stats, age: k.age }));
    assert.equal(g.phase, 'over'); assert.equal(g.errors, 0);
    const ks = [...g.k.values()];
    assert(ks.reduce((a, k) => a + k.stats.villages, 0) >= 5, 'villages founded');
    assert(ks.filter((k) => k.age >= 3).length >= 5, 'ages reached');
    assert(ks.reduce((a, k) => a + k.stats.battles, 0) >= 10, 'battles fought');
    assert(at10 && at10.some((s) => s.age >= 3), 'Town age within 10 minutes');
    assert(clock.t <= 30 * 60000 + 2000);
    assert(g.awards.length >= 3 && g.standings.length === 10);
    console.log(`      10 bots (seed ${seed}): ${g.winner.mode} (${g.winner.reason}) after ${Math.round(clock.t / 60000)} min; villages ${ks.reduce((a, k) => a + k.stats.villages, 0)}, battles ${ks.reduce((a, k) => a + k.stats.battles, 0) / 1}, vassals ${ks.filter((k) => k.vassalOf).length}, alliances ${g.alliances.size}`);
  }
});

test('Bots: 100 bots run 10 game-minutes quickly with compact TV state', () => {
  const t0 = Date.now();
  const { g, clock, room, H } = setup({ bots: 99, humans: ['Ann'], settings: { timeLimit: 60 }, seed: 5 });
  while (g.phase === 'play' && clock.t < 10 * 60000 && clock.step());
  const ms = Date.now() - t0;
  assert.equal(g.errors, 0); assert.equal(g.k.size, 100);
  assert(ms < 20000, `took ${ms} ms`);
  const tvKB = JSON.stringify(room.tvState()).length / 1024, vKB = JSON.stringify(room.playerState(H[0])).length / 1024;
  assert(tvKB < 150, `tv ${tvKB} KB`); assert(vKB < 150, `view ${vKB} KB`);
  const ks = [...g.k.values()]; assert(ks.some((k) => k.age >= 2));
  console.log(`      100 bots: 10 game-min in ${ms} ms; tv ${tvKB.toFixed(0)} KB, phone ${vKB.toFixed(0)} KB`);
});

console.log(`\n${passed} JustKingdoms tests passed.`);
