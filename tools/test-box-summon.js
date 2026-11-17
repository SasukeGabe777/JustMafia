'use strict';
// JustSummon rules: whole bot battles on a virtual clock, counters, income, tiers, input
// validation, results() and sim speed.   node tools/test-box-summon.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/summon');
const { UNITS, KEYS, M, STRONG, WEAK, KEEP_HP } = def;
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };

// A room of bots (plus optional humans), started and charged into battle.
function battle(bots, { humans = 0, seed = 1, settings = {} } = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  const people = []; for (let i = 0; i < humans; i++) people.push(room.join('Hum' + i).player);
  room.addBots(bots);
  for (const [k, v] of Object.entries(settings)) room.hostAction({ type: 'settings', settings: { [k]: v } });
  assert(room.start().ok);
  return { clock, room, g: room.game, people };
}
function runToEnd({ clock, room }, cap = 400000) { let i = 0; while (room.game.phase !== 'over' && clock.step()) if (++i > cap) throw new Error('never ended'); return i; }
const charge = (b) => { while (b.g.phase === 'ready') b.clock.step(); };
// A sandbox battle: no AI, no income, fortresses that can't fall.
function sandbox() {
  const b = battle(2, { seed: 7 }); charge(b);
  for (const c of b.g.cmds.values()) { c.ai = false; c.keep.hp = 1e9; c.keep.max = 1e9; }
  b.g.botThink = () => {};
  return b;
}

for (const n of [2, 8, 30]) {
  test(`bots fight a whole ${n}-player battle to the end; results() puts the winners first`, () => {
    const b = battle(n, { seed: n, settings: { length: 10 } });
    runToEnd(b);
    const g = b.g;
    assert.equal(g.phase, 'over');
    assert(g.result && (g.result.winner === 0 || g.result.winner === 1 || g.result.winner === -1));
    const res = g.results();
    assert.equal(res.length, n, 'every player is ranked');
    assert.equal(new Set(res).size, n);
    if (g.result.winner >= 0) {
      const team = (id) => g.cmds.get(id).team, winners = res.filter((id) => team(id) === g.result.winner).length;
      assert(res.slice(0, winners).every((id) => team(id) === g.result.winner), 'winning team first');
      const sc = res.map((id) => g.score(g.cmds.get(id)));
      for (let i = 1; i < winners; i++) assert(sc[i - 1] >= sc[i], 'winners ordered by contribution');
    }
    const spent = [...g.cmds.values()].reduce((a, c) => a + c.st.summons, 0);
    assert(spent > n * 10, `bots summoned troops (${spent})`);
    assert(g.teams.some((T) => T.tier >= 2), 'the tech tree opened');
    assert.equal(g.errors, 0, 'no sim errors');
    console.log(`      ${n} players: ${g.result.reason}, winner ${g.result.winner}, front ${g.result.front}, ${spent} summons, ${(g.tick / 600).toFixed(1)} min, tiers ${g.teams.map((T) => T.tier).join('/')}`);
  });
}

test('teams are split evenly (humans first), an AI ally fills an uneven side', () => {
  const b = battle(4, { humans: 1 });
  const t = [0, 1].map((x) => b.g.teamCmds(x).length);
  assert.equal(t[0], t[1], 'even after the AI ally');
  assert.equal(b.g.cmds.get(b.people[0].id).team, 0);
  assert.equal([...b.g.cmds.values()].filter((c) => c.npc).length, 1);
  const off = battle(3, { settings: { balance: 'off' } });
  assert.equal([...off.g.cmds.values()].filter((c) => c.npc).length, 0);
  const gold = battle(3, { settings: { balance: 'gold' } }); charge(gold);
  const [a] = gold.g.teamCmds(0), [z] = gold.g.teamCmds(1);
  assert(gold.g.incomeOf(z) > gold.g.incomeOf(a) * 1.9, 'the lone player earns double');
});

test('counters: ×1.75 when strong, ×0.6 when weak, flyers only hit by shooters', () => {
  assert.equal(M.spear.rider, STRONG); assert.equal(M.rider.archer, STRONG); assert.equal(M.archer.spear, STRONG);
  assert.equal(M.mage.shield, STRONG); assert.equal(M.rider.mage, STRONG); assert.equal(M.archer.shield, WEAK);
  assert.equal(M.spear.archer, 1);
  assert.equal(def.canHit('spear', 'dragon'), false); assert.equal(def.canHit('archer', 'dragon'), true); assert.equal(def.canHit('dragon', 'spear'), true);
  // in the sim: a spear hits a rider for 1.75×, a shield for 0.6×, an archer for 1×
  const { g } = sandbox(), [c0, c1] = [...g.cmds.values()];
  for (const [d, mult] of [['rider', STRONG], ['shield', WEAK], ['archer', 1]]) {
    g.units = [];
    const a = g.spawn(c0, 'spear'), v = g.spawn(c1, d); a.x = 500; v.x = 510; a.cd = 0; v.cd = 99;
    const hp = v.hp; g.step();
    assert.equal(Math.round((hp - v.hp) * 100), Math.round(UNITS.spear.dmg * mult * 100), `spear vs ${d}`);
  }
  // equal gold: the counter wins every time
  for (const [win, lose] of [['spear', 'rider'], ['rider', 'archer'], ['archer', 'spear'], ['mage', 'shield'], ['shield', 'archer'], ['spear', 'knight'], ['ballista', 'dragon'], ['knight', 'archer']]) {
    const s = sandbox(), [a0, a1] = [...s.g.cmds.values()];
    for (let i = 0; i < Math.round(600 / UNITS[win].cost); i++) s.g.spawn(a0, win).x = 420 - i * 2;
    for (let i = 0; i < Math.round(600 / UNITS[lose].cost); i++) s.g.spawn(a1, lose).x = 580 + i * 2;
    for (let i = 0; i < 2000 && s.g.units.some((u) => u.t === 0) && s.g.units.some((u) => u.t === 1); i++) s.g.step();
    assert(s.g.units.some((u) => u.t === 0) && !s.g.units.some((u) => u.t === 1), `${win} beat ${lose}`);
  }
});

test('income grows with every summon and mine; the side being pushed back earns more', () => {
  const b = battle(2, { humans: 1, seed: 3 }); charge(b);
  const g = b.g, me = b.people[0], c = g.cmds.get(me.id);
  for (const x of g.cmds.values()) if (x.id !== c.id) x.ai = false;
  const base = g.incomeOf(c);
  c.gold = 1000;
  assert(g.act(me, { op: 'summon', u: 'spear' }).ok);
  assert(g.incomeOf(c) > base, 'summoning invests');
  assert.equal(Math.round((g.incomeOf(c) - base) * 1000), Math.round(UNITS.spear.cost * 0.005 * 1000));
  b.clock.t += 500;
  const before = g.incomeOf(c); assert(g.act(me, { op: 'mine' }).ok); assert.equal(c.mines, 1);
  assert(g.incomeOf(c) >= before + 3 - 1e-9, 'a gold mine adds 3/s');
  // gold actually flows over time
  const gold = c.gold; for (let i = 0; i < 10; i++) g.step();
  assert(Math.abs(c.gold - (gold + g.incomeOf(c))) < 0.5, 'one second of income');
  g.front = 200; const pushed = g.incomeOf(c); g.front = 500;
  assert(pushed > g.incomeOf(c) * 1.2, 'comeback income');
  const inc = battle(2, { humans: 1, settings: { mode: 'income' } }); charge(inc);
  const ic = inc.g.cmds.get(inc.people[0].id); ic.gold = 500; const ib = inc.g.incomeOf(ic);
  inc.g.act(inc.people[0], { op: 'summon', u: 'spear' });
  assert(inc.g.incomeOf(ic) - ib > UNITS.spear.cost * 0.005 * 1.9, 'income race doubles investment');
});

test('tier unlocks: XP from spending opens Tier 2 and 3; locked troops are refused', () => {
  const b = battle(2, { humans: 1, seed: 4 }); charge(b);
  const g = b.g, me = b.people[0], c = g.cmds.get(me.id), T = g.teams[c.team];
  for (const x of g.cmds.values()) if (x.id !== c.id) x.ai = false;
  c.gold = 5000;
  b.clock.t += 1000; assert.equal(g.act(me, { op: 'summon', u: 'knight' }).ok, false, 'Tier 2 locked at first');
  b.clock.t += 1000; assert.equal(g.act(me, { op: 'ability', a: 'meteor' }).ok, false);
  T.xp = g.xpNeed(c.team, 2) - 1; b.clock.t += 1000; assert(g.act(me, { op: 'summon', u: 'spear' }).ok);
  assert.equal(T.tier, 2, 'Tier 2 after enough XP');
  b.clock.t += 1000; assert(g.act(me, { op: 'summon', u: 'knight' }).ok);
  b.clock.t += 1000; assert.equal(g.act(me, { op: 'summon', u: 'dragon' }).ok, false);
  T.xp = g.xpNeed(c.team, 3); g.step(); assert.equal(T.tier, 3);
  b.clock.t += 1000; assert(g.act(me, { op: 'summon', u: 'dragon' }).ok);
  assert(g.ev.some((e) => e.k === 'tier' && e.tier === 3));
  // time floors: Tier 2 by 30% of the match even without spending
  const q = battle(2, { seed: 5 }); charge(q); for (const x of q.g.cmds.values()) x.ai = false;
  while (q.g.tick < q.g.endTick * 0.31) q.g.step();
  assert(q.g.teams.every((t) => t.tier >= 2));
  // the basic pool stops at Tier 2
  const bs = battle(2, { humans: 1, settings: { pool: 'basic' } }); charge(bs);
  bs.g.teams[0].xp = 1e9; bs.g.step(); assert.equal(bs.g.teams[0].tier, 2);
  bs.g.cmds.get(bs.people[0].id).gold = 9999; assert.equal(bs.g.act(bs.people[0], { op: 'summon', u: 'giant' }).ok, false);
});

test('phone input is validated and rate-limited; nothing crashes', () => {
  const b = battle(2, { humans: 1 }), me = b.people[0], g = b.g;
  assert.equal(g.act(me, { op: 'summon', u: 'spear' }).ok, false, 'not before the charge');
  charge(b);
  const c = g.cmds.get(me.id); c.gold = 100000;
  const bad = [{ op: 'summon', u: 'nope' }, { op: 'summon', u: '__proto__' }, { op: 'summon', u: 'constructor' }, { op: 'summon' }, { op: 'summon', u: 7 }, { op: 'summon', u: { x: 1 } },
    { op: 'ability', a: 'nuke' }, { op: 'ability', a: 'toString' }, { op: 'nope' }, {}, null, 'x', { op: 'summon', u: ['spear'] }];
  for (const m of bad) { b.clock.t += 500; assert.equal(g.act(me, m).ok, false, JSON.stringify(m)); }
  assert.equal(b.room.act(me, null).ok, false);
  b.clock.t += 500; assert(g.act(me, { op: 'summon', u: 'spear' }).ok);
  assert.equal(g.act(me, { op: 'summon', u: 'archer' }).error, 'Easy there!', 'taps too close together');
  b.clock.t += 500; assert.match(g.act(me, { op: 'summon', u: 'spear' }).error, /cooldown/);
  // flood: at most 16 actions in 2 seconds
  let ok = 0; b.clock.t += 3000; for (let i = 0; i < 21; i++) { b.clock.t += 95; if (!/Too many|Easy/.test(g.act(me, { op: 'mine' }).error || '')) ok++; }
  assert(ok <= 16, `flood limited (${ok})`);
  // can't afford
  c.gold = 10; b.clock.t += 3000; assert.match(g.act(me, { op: 'summon', u: 'archer' }).error, /more gold/);
  // troop cap
  c.gold = 1e6; c.cds = {}; for (let i = 0; i < 60; i++) { g.spawn(c, 'shield'); } g.sweep();
  b.clock.t += 3000; assert.match(g.act(me, { op: 'summon', u: 'spear' }).error, /limit/);
  // a spectator who joined after the end can't act
  const watcher = b.room.join('Late').player; g.phase = 'over';
  assert.equal(g.act(watcher, { op: 'summon', u: 'spear' }).ok, false);
});

test('keeps fall, owners become ghosts, a whole fortress down ends it', () => {
  const b = sandbox(), g = b.g, [c0, c1] = [...g.cmds.values()];
  c1.keep.hp = 30; c1.keep.max = KEEP_HP;
  const u = g.spawn(c0, 'spear'); u.x = 940; u.cd = 0;
  for (let i = 0; i < 40 && g.phase === 'battle'; i++) g.step();
  assert.equal(c1.ghost, true);
  assert.equal(g.phase, 'over'); assert.equal(g.result.winner, c0.team); assert.equal(g.result.reason, 'fortress');
  assert.deepEqual(g.results()[0], c0.id);
});

test('time out: the front line decides; late joiners and leavers are handled', () => {
  const b = battle(4, { seed: 9, settings: { length: 10 } }); charge(b);
  const late = b.room.join('Late').player; assert(b.g.cmds.has(late.id));
  const bot = b.room.list().find((p) => p.bot); b.room.remove(bot.id); assert(b.g.cmds.get(bot.id).ai);
  for (const c of b.g.cmds.values()) c.ai = false;
  b.g.front = 700; b.g.tick = b.g.endTick - 1; b.g.updateFront = () => {}; b.g.step();
  assert.equal(b.g.phase, 'over'); assert.equal(b.g.result.winner, 0); assert.equal(b.g.result.reason, 'front');
  const res = b.g.results(); assert(!res.includes(bot.id) && res.includes(late.id));
  // TV and phone views stay well-formed after the end
  const v = b.g.view(late); assert(v.over && typeof v.over.rank === 'number');
  assert(b.g.tv().standings.length >= 4);
});

test('host skip: the ready phase charges, battle skips a minute, final charge ends it', () => {
  const b = battle(2); b.g.next(); assert.equal(b.g.phase, 'battle');
  const t = b.g.tick; b.g.next(); assert(b.g.tick >= t + 590 || b.g.phase === 'over');
  b.g.tick = b.g.endTick - 100; b.g.step(); assert(b.g.surge); b.g.next(); assert.equal(b.g.phase, 'over');
});

test('screens: compact TV state and phone views', () => {
  const b = battle(30, { seed: 11 }); charge(b);
  for (let i = 0; i < 1500; i++) b.g.step();
  const tv = JSON.stringify(b.g.tv()); assert(tv.length < 30000, `TV state ${tv.length} bytes`);
  const p = b.room.join('Phone').player; const v = JSON.stringify(b.g.view(p)); assert(v.length < 1500, `phone view ${v.length} bytes`);
  assert.equal(b.g.tv().u.length % 9, 0);
  console.log(`      30 players: ${b.g.units.length} squads (${b.g.units.reduce((a, u) => a + u.n, 0)} troops), TV ${tv.length} B, phone ${v.length} B`);
});

test('performance: the sim runs far faster than real time at 30 players', () => {
  const b = battle(30, { seed: 12 }); charge(b);
  for (let i = 0; i < 2400; i++) b.g.step(); // 4 minutes in: big armies, Tier 2+
  const t0 = process.hrtime.bigint(); let n = 0;
  while (n < 2000 && b.g.phase === 'battle') { b.g.step(); n++; }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6, rate = Math.round(n / (ms / 1000));
  console.log(`      ${rate} sim ticks/s at 30 players (needs 10), ${b.g.units.length} squads`);
  assert(rate > 400, `sim too slow: ${rate}/s`);
  const t1 = process.hrtime.bigint(); for (let i = 0; i < 200; i++) JSON.stringify(b.g.tv());
  const tvMs = Number(process.hrtime.bigint() - t1) / 1e6 / 200;
  assert(tvMs < 5, `tv() ${tvMs.toFixed(2)} ms`);
});

console.log(`\n${passed} JustSummon tests passed.`);
