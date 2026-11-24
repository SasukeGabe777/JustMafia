'use strict';
// TrashZombies: the shared world rules, the server (runs, sanity checks, co-op areas and the live
// relay, host hand-off, results) and the phone simulation itself (run in a sandbox: exits, waves,
// level-up cards, pickups, co-op snapshots).   node tools/test-box-trash.js
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/trash');
const W = require('../public/box/games/trash-world');

let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const mk = (settings = {}, n = 0) => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 7 });
  const ps = []; for (let i = 0; i < n; i++) { const p = room.join(['Ana', 'Ben', 'Cy', 'Dee'][i]).player; p.sockets = 1; ps.push(p); }
  Object.assign(room.settings, settings);
  return { clock, room, ps };
};
const run = (room, clock, ms) => { const end = clock.now() + ms; let i = 0; while (clock.now() < end && room.game.phase !== 'over' && clock.step()) if (++i > 200000) throw new Error('stuck'); };

// ---------------- the world ----------------
test('areas: the same seed builds the same area; neighbours never share a look', () => {
  for (const seed of [1, 99, 123456]) for (let x = 0; x < W.GRID; x++) for (let y = 0; y < W.GRID; y++) {
    assert.deepEqual(W.genArea(seed, x, y), W.genArea(seed, x, y));
    const b = W.biomeOf(seed, x, y).key;
    if (x + 1 < W.GRID) assert.notEqual(b, W.biomeOf(seed, x + 1, y).key, `${seed} ${x},${y} east`);
    if (y + 1 < W.GRID) assert.notEqual(b, W.biomeOf(seed, x, y + 1).key, `${seed} ${x},${y} south`);
  }
  assert.notDeepEqual(W.genArea(1, 2, 2).obstacles, W.genArea(2, 2, 2).obstacles, 'another seed, another layout');
  const looks = new Set(); for (let x = 0; x < W.GRID; x++) looks.add(W.biomeOf(5, x, 0).key); assert(looks.size >= 8, 'plenty of different looks along a row');
});
test('areas: exit lanes, the middle and the border stay clear; home areas have the garage', () => {
  for (let k = 0; k < 60; k++) {
    const a = W.genArea(k * 31, k % 9, (k * 7) % 9, k % 5 === 0);
    for (const o of a.obstacles) {
      if (o.kind === 'wall') continue;
      const hit = (x0, y0, x1, y1) => o.x < x1 && o.x + o.w > x0 && o.y < y1 && o.y + o.h > y0;
      assert(!hit(W.AW / 2 - 80, 0, W.AW / 2 + 80, W.AH), 'vertical lane clear'); assert(!hit(0, W.AH / 2 - 80, W.AW, W.AH / 2 + 80), 'horizontal lane clear');
      assert(o.x >= W.TILE && o.y >= W.TILE && o.x + o.w <= W.AW - W.TILE && o.y + o.h <= W.AH - W.TILE, 'border ring clear');
    }
    assert.equal(!!a.garage, k % 5 === 0);
    assert(a.obstacles.filter((o) => o.kind !== 'wall').length >= 6, 'something to hide behind');
  }
  assert.deepEqual(W.exitsOf(0, 0), { n: false, s: true, w: false, e: true });
  assert.deepEqual(W.exitsOf(8, 8), { n: true, s: false, w: true, e: false });
});
test('level-up offers: 3 cards, one Attack + one Defense + one Special, never a maxed one, they stack', () => {
  const r = W.rng(3);
  for (let i = 0; i < 300; i++) {
    const o = W.offer(r, {}); assert.equal(o.length, 3); assert.equal(new Set(o).size, 3);
    assert.deepEqual(o.map((id) => W.AB[id].cat).sort(), ['atk', 'def', 'spc']);
  }
  // Attack all maxed: still 3 cards, none of them Attack
  const owned = Object.fromEntries(W.ABILITIES.filter((a) => a.cat === 'atk').map((a) => [a.id, a.max]));
  for (let i = 0; i < 100; i++) { const o = W.offer(r, owned); assert.equal(o.length, 3); assert(o.every((id) => W.AB[id].cat !== 'atk')); }
  const all = Object.fromEntries(W.ABILITIES.map((a) => [a.id, a.max])); assert.deepEqual(W.offer(r, all), []);
  assert(W.ABILITIES.length >= 20 && ['atk', 'def', 'spc'].every((c) => W.ABILITIES.filter((a) => a.cat === c).length >= 7), 'plenty of each');
  assert.equal(new Set(W.ABILITIES.map((a) => a.name)).size, W.ABILITIES.length);
});
test('waves ramp up: more zombies, tougher, a boss every 5th; more players = bigger waves', () => {
  const a = W.waveSpec(1, 1, 'normal'), b = W.waveSpec(8, 1, 'normal'), c = W.waveSpec(8, 3, 'normal'), h = W.waveSpec(8, 1, 'hard');
  assert(b.target > a.target && b.hpMul > a.hpMul && b.every < a.every && b.cap > a.cap);
  assert(c.target > b.target && c.every < b.every); assert(h.hpMul > b.hpMul);
  assert.equal(W.waveSpec(5, 1).boss, true); assert.equal(W.waveSpec(6, 1).boss, false);
  assert.deepEqual(a.weights.map((w) => w[0]), ['walker']); assert(b.weights.length >= 5, 'every kind by wave 8');
  assert(W.xpNeed(10) > W.xpNeed(2));
});

// ---------------- the server ----------------
test('start: everyone gets their own garage, far apart, on the map', () => {
  const { room, ps } = mk({}, 4); assert(room.start().ok); const g = room.game;
  const cells = ps.map((p) => g.runs.get(p.id).cell);
  for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) assert(Math.abs(cells[i][0] - cells[j][0]) + Math.abs(cells[i][1] - cells[j][1]) >= 3, 'far apart');
  assert.equal(g.homes.length, 4); assert.equal(g.explored.size, 4);
  assert.equal(room.fxLog.filter((f) => f.kind === 'tzgarage').length, 4, 'a garage door per player (TV sound + map)');
  const v = g.view(ps[0]); assert.equal(v.me.state, 'play'); assert.equal(v.players.length, 3); assert(v.seed > 0);
  const t = g.tv(); assert.equal(t.players.length, 4); assert(t.feed.some((f) => /garage/.test(f.text)));
  assert(!JSON.stringify(t).includes('"ab":{'), 'the TV gets ability ids, not the phone run objects');
});
test('drop-in: a late phone joins the running night and rolls up its own garage', () => {
  const { room, ps: [a] } = mk({}, 1); room.start(); const g = room.game;
  assert.equal(room.busy(), null, 'the room stays open while the night runs');
  const late = room.join('Late').player; const R = g.runs.get(late.id);
  assert(R && R.state === 'play', 'a run of their own'); assert(Math.abs(R.cell[0] - g.runs.get(a.id).cell[0]) + Math.abs(R.cell[1] - g.runs.get(a.id).cell[1]) >= 3, 'away from the others');
  assert.equal(room.fxLog.filter((f) => f.kind === 'tzgarage').length, 2);
  room.act(a, { op: 'end' }); assert.equal(room.busy(), null, 'over: the lobby is next');
});
test('status pings are sanity-checked (kills, levels, abilities, health)', () => {
  const { room, clock, ps: [a] } = mk({}, 1); room.start(); const g = room.game, R = g.runs.get(a.id);
  run(room, clock, 1000);
  assert.equal(room.act(a, { op: 'st', kills: 999999, lvl: 80, hp: 5000, mhp: 99999, wave: 30, ab: { rapid: 99, nope: 3 } }).ok, true);
  assert(R.kills <= 200, 'kills capped by time: ' + R.kills); assert(R.lvl <= 7, 'level capped: ' + R.lvl); assert(R.mhp <= W.limits.hp && R.hp <= R.mhp); assert(R.wave <= 2, 'wave needs areas: ' + R.wave);
  assert(!('nope' in R.ab)); assert(W.levelsFromAbilities(R.ab) <= R.lvl - 1, 'no more ability tiers than level-ups');
  run(room, clock, 1000); room.act(a, { op: 'st', kills: 30, lvl: 4, hp: 80, mhp: 125, wave: 1, ab: { hp: 1, rapid: 2 } });
  assert.equal(R.lvl, 4); assert.deepEqual(R.ab, { hp: 1, rapid: 2 }); assert.equal(R.hp, 80);
  for (const bad of [{ op: 'enter', x: 'a', y: 1 }, { op: 'enter', x: 99, y: 0 }, { op: 'ev', k: 'pick', id: 'nope' }, { op: 'ev', k: 'zzz' }, { op: 'nope' }, {}, { op: 'end' }]) {
    if (bad.op === 'end') { const b = room.join('Bob').player; assert.equal(room.act(b, bad).ok, false, 'only the host ends it'); continue; }
    assert.equal(room.act(a, bad).ok, false, JSON.stringify(bad));
  }
  const far = [R.cell[0] + 2, R.cell[1]]; assert.equal(room.act(a, { op: 'enter', x: far[0], y: far[1] }).ok, false, 'no teleporting');
});
function walkTo(room, p, target) { // step cell by cell to a target cell
  const g = room.game; let R = g.runs.get(p.id), n = 0;
  while ((R.cell[0] !== target[0] || R.cell[1] !== target[1]) && n++ < 30) {
    const dx = Math.sign(target[0] - R.cell[0]), dy = dx ? 0 : Math.sign(target[1] - R.cell[1]);
    const r = room.act(p, { op: 'enter', x: R.cell[0] + dx, y: R.cell[1] + dy }); assert(r.ok, r.error);
  }
  return g.runs.get(p.id);
}
test('co-op: walking into a friend’s area joins it; the one already there is the host', () => {
  const { room, ps: [a, b] } = mk({}, 2); room.start(); const g = room.game;
  const ca = g.runs.get(a.id).cell; g.outbox.length = 0;
  walkTo(room, b, ca);
  const A = g.areaOf(b.id); assert.equal(A.host, a.id); assert.deepEqual(A.members.sort(), [a.id, b.id].sort());
  assert(g.outbox.some((m) => m.to === a.id && m.data.t === 'area') && g.outbox.some((m) => m.to === b.id && m.data.t === 'area'), 'both phones told');
  assert(g.tv().coop.length === 1, 'the TV shows the co-op area'); assert(g.feed.some((f) => /joined Ana/.test(f.text)));
  assert(room.fxLog.some((f) => f.kind === 'tzcoop'));
  assert.equal(g.view(b).area.host, a.id);
});
test('co-op relay: host snapshots go to guests, guest input/hits go to the host, nothing else gets through', () => {
  const { room, clock, ps: [a, b, c] } = mk({}, 3); room.start(); const g = room.game;
  walkTo(room, b, g.runs.get(a.id).cell); g.outbox.length = 0;
  assert.equal(g.live(a, { t: 'snap', z: [1, 0, 10, 10, 20], w: [1, 0, 15, 0, 0] }), true);
  assert.deepEqual(g.outbox.map((m) => [m.to, m.data.t, m.data.from]), [[b.id, 'snap', a.id]]);
  g.outbox.length = 0; assert.equal(g.live(b, { t: 'in', you: [1, 2, 0, 100, 100], h: [[1, 10, 0, 0, 0]] }), true);
  assert.deepEqual(g.outbox.map((m) => [m.to, m.data.t]), [[a.id, 'in']]);
  g.outbox.length = 0; g.live(a, { t: 'give', to: b.id, k: 'shield', id: 3 }); assert.deepEqual(g.outbox.map((m) => m.to), [b.id], 'a give goes to that guest only');
  g.outbox.length = 0;
  assert.equal(g.live(c, { t: 'snap', z: [] }), false, 'not in a shared area');
  assert.equal(g.live(a, { t: 'evil' }), false); assert.equal(g.live(a, null), false); assert.equal(g.live(a, { t: 'snap', z: new Array(5000).fill(12345) }), false, 'too big');
  assert.equal(g.outbox.length, 0);
  let sent = 0; for (let i = 0; i < 100; i++) if (g.live(a, { t: 'snap', z: [] })) sent++; assert(sent <= 60, 'rate limited: ' + sent);
  run(room, clock, 1100); assert.equal(g.live(a, { t: 'snap', z: [] }), true, 'the limit resets');
});
test('host hand-off: the host walks out, or their phone drops: the guest takes over', () => {
  const { room, clock, ps: [a, b] } = mk({}, 2); room.start(); const g = room.game;
  const cell = g.runs.get(a.id).cell; walkTo(room, b, cell); g.outbox.length = 0;
  const out = [cell[0] + (cell[0] < 8 ? 1 : -1), cell[1]];
  room.act(a, { op: 'enter', x: out[0], y: out[1] });
  assert.equal(g.areas.get(cell.join(',')).host, b.id); assert(g.outbox.some((m) => m.to === b.id && m.data.t === 'host' && m.data.host === b.id));
  assert.equal(g.areaOf(a.id).members.length, 1, 'the host is solo in the new area');
  // back in: b hosts now; then b's phone drops
  room.act(a, { op: 'enter', x: cell[0], y: cell[1] }); assert.equal(g.areaOf(a.id).host, b.id);
  b.sockets = 0; g.outbox.length = 0; run(room, clock, 5000);
  assert.equal(g.areaOf(a.id).host, a.id, 'the phone that is still here hosts'); assert(g.outbox.some((m) => m.to === a.id && m.data.t === 'host'));
  // b dies (leaves the area); a is alone again
  b.sockets = 1; room.act(b, { op: 'ev', k: 'dead' }); assert.equal(g.areaOf(a.id).members.length, 1);
});
test('dying, playing again, and the night ending when everyone is down', () => {
  const { room, clock, ps: [a, b] } = mk({}, 2); room.start(); const g = room.game;
  room.act(a, { op: 'ev', k: 'dead' }); assert.equal(g.runs.get(a.id).state, 'dead'); assert(room.fxLog.some((f) => f.kind === 'tzdead'));
  assert.equal(room.act(b, { op: 'respawn' }).ok, false, 'still standing');
  assert(room.act(a, { op: 'respawn' }).ok); assert.equal(g.runs.get(a.id).run, 2); assert.equal(g.runs.get(a.id).state, 'play'); assert.equal(g.runs.get(a.id).wave, 1);
  room.act(a, { op: 'ev', k: 'dead' }); room.act(b, { op: 'ev', k: 'dead' });
  run(room, clock, 30000); assert.equal(g.phase, 'play', 'a moment to press Play again');
  run(room, clock, 30000); assert.equal(g.phase, 'over'); assert.equal(g.overWhy, 'down');
  assert.equal(g.results().length, 2); assert.equal(room.act(a, { op: 'respawn' }).ok, false);
});
test('results: best run first (wave, then kills); the build comes along', () => {
  const { room, clock, ps: [a, b] } = mk({}, 2); room.start(); const g = room.game;
  run(room, clock, 5000);
  room.act(a, { op: 'st', kills: 40, lvl: 4, hp: 50, mhp: 100, wave: 1, ab: { rapid: 2, orbit: 1 } });
  walkTo(room, a, [g.runs.get(a.id).cell[0] + (g.runs.get(a.id).cell[0] < 8 ? 1 : -1), g.runs.get(a.id).cell[1]]);
  run(room, clock, 1000); room.act(a, { op: 'st', kills: 45, lvl: 4, hp: 50, mhp: 100, wave: 2, ab: { rapid: 2, orbit: 1 } });
  room.act(b, { op: 'st', kills: 60, lvl: 3, hp: 50, mhp: 100, wave: 1, ab: { hp: 2 } });
  room.act(a, { op: 'ev', k: 'dead' }); room.act(a, { op: 'respawn' }); // the best run is kept
  const vip = room.vip(); assert(room.act(vip, { op: 'end' }).ok);
  const st = g.standings(); assert.deepEqual(st.map((r) => r.id), [a.id, b.id]); assert.equal(st[0].wave, 2); assert.deepEqual(st[0].build.map((x) => x[0]).sort(), ['orbit', 'rapid']);
  assert.deepEqual(g.results(), [a.id, b.id]); assert(g.view(a).standings.length === 2);
});
test('timed nights end on the clock; "wave 20" ends when someone clears it; Party Mode gets a fixed time', () => {
  const { room, clock } = mk({ length: 'm5' }, 1); room.start(); run(room, clock, 4.9 * 60000); assert.equal(room.game.phase, 'play'); run(room, clock, 20000); assert.equal(room.game.phase, 'over'); assert.equal(room.game.overWhy, 'time');
  const w = mk({ length: 'w20' }, 1); w.room.start(); const R = w.room.game.runs.get(w.ps[0].id); R.wave = 20; w.room.act(w.ps[0], { op: 'ev', k: 'clear', wave: 20 }); assert.equal(w.room.game.phase, 'over');
  assert.deepEqual(def.partyFit({ players: 4, minutes: 10 }), { length: 'm10' }); assert.deepEqual(def.partyFit({ players: 4, minutes: 4 }), { length: 'm5' }); assert.deepEqual(def.partyFit({ players: 2, minutes: 21 }), { length: 'm20' });
});
test('bots play a whole (timed) night on the server; results() lists everyone best-first', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 1 });
  room.addBots(6); room.settings.length = 'm10'; assert(room.start().ok);
  let i = 0; while (room.game.phase !== 'over' && clock.step()) if (++i > 100000) throw new Error('never ended');
  const g = room.game; assert.equal(g.results().length, 6);
  assert(g.explored.size > 10, 'bots explore the map: ' + g.explored.size); assert(Math.max(...g.standings().map((r) => r.wave)) >= 5);
  const json = JSON.stringify(g.tv()); assert(json.length < 20000, 'TV state stays small: ' + json.length);
});
test('endless with bots only ends when they are all down for a while', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 2 }); room.addBots(2); room.start();
  for (const R of room.game.runs.values()) { R.state = 'dead'; R.deadAt = clock.now() + 1e9; }
  run(room, clock, 20000); assert.equal(room.game.phase, 'over');
});

// ---------------- the phone simulation (sandboxed) ----------------
function sandbox() {
  let now = 0; const reports = [], lives = [], events = [];
  const ctx = { console, Math, Date, JSON, Object, Array, Map, Set, Number, String, Promise, Infinity, isFinite, performance: { now: () => now } };
  ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
  for (const f of ['trash-world.js', 'trash-sim.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'games', f), 'utf8'), ctx, { filename: f });
  const make = (o = {}) => new ctx.TZSim.Sim({ seed: 42, homes: [[4, 4]], me: { id: o.id || 'me', name: 'Me', color: '#fff' }, settings: { diff: 'normal', aim: 'on', xp: 'shared', ...(o.settings || {}) }, restore: o.restore || { cell: [4, 4], home: [4, 4], wave: 1, run: 1 },
    report: (m) => { reports.push(m); return Promise.resolve({ ok: true }); }, live: (m) => lives.push(m), on: (k, d) => events.push([k, d]), people: () => null });
  const step = (s, sec, I = {}, pick = true) => { for (let t = 0; t < sec; t += 1 / 60) { now += 1000 / 60; if (pick && s.cards) s.pick(0); s.update(1 / 60, I); } };
  return { ctx, make, step, reports, lives, events };
}
test('phone: the garage intro, then wave 1; exits stay shut until the area is clear', () => {
  const S = sandbox(), s = S.make();
  assert.equal(s.phase, 'intro'); assert(s.area.garage, 'the first area has your garage'); assert(s.p.y < 200, 'you start inside');
  S.step(s, 5); assert.equal(s.phase, 'play'); assert.equal(s.wave, 1); assert(s.p.y > 300, 'walked out of the garage');
  s.p.inv = 1e9; // (no dying in this test)
  s.p.x = W.AW / 2; s.p.y = 60; S.step(s, 2, { my: -1 }); assert.equal(s.cell.join(), '4,4', 'the north exit is shut'); assert(s.p.y >= s.p.r);
  assert(!s.cleared);
  s.z.length = 0; s.waveKills = s.spec.target; S.step(s, 0.1); assert(s.cleared, 'cleared'); assert(S.reports.some((r) => r.op === 'ev' && r.k === 'clear'));
  s.p.x = W.AW / 2; s.p.y = 60; for (let i = 0; i < 120 && s.cell.join() === '4,4'; i++) S.step(s, 1 / 60, { my: -1 });
  assert.equal(s.cell.join(), '4,3', 'walked north into the next cell'); assert.equal(s.wave, 2); assert(!s.cleared); assert(s.p.y > W.AH - 100, 'arrive at the south edge');
  assert(S.reports.some((r) => r.op === 'enter' && r.x === 4 && r.y === 3)); assert.notEqual(s.area.biome.key, 'home');
});
test('phone: zombies spawn, chase and get shot (auto-aim); the cap holds; kills give XP gems', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, lvl: 1, run: 1 } });
  assert.equal(s.phase, 'play'); s.p.inv = 1e9;
  S.step(s, 20); assert(s.z.length > 0 || s.waveKills > 0); assert(s.waveKills > 0, 'auto-aim kills zombies: ' + s.waveKills);
  for (let i = 0; i < 300; i++) s.spawnOne(); S.step(s, 0.5); assert(s.z.length <= 300 + 30);
  const s2 = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 9, run: 1 } }); s2.p.inv = 1e9; S.step(s2, 30); assert(s2.z.length <= 90, 'live cap: ' + s2.z.length);
  assert(s.lvl > 1 || s.gems.length || s.xp > 0, 'XP from kills');
});
test('phone: level-up shows 3 mixed cards and pauses solo play; picks stack tiers', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 1, run: 1 } });
  s.gainXp(W.xpNeed(1)); assert.equal(s.lvl, 2); assert.equal(s.cards.length, 3); assert.equal([...s.cards].map((id) => W.AB[id].cat).sort().join(), 'atk,def,spc');
  assert(s.paused, 'solo pauses'); const t0 = s.t, x0 = s.p.x; S.step(s, 1, { mx: 1 }, false); assert.equal(s.p.x, x0, 'nothing moves while choosing');
  const id = s.cards[0]; s.pick(0); assert.equal(s.ab[id], 1); assert(!s.paused); assert(S.reports.some((r) => r.op === 'ev' && r.k === 'pick' && r.id === id));
  s.ab.rapid = 4; s.stats(); const r1 = s.S.rate; s.ab.rapid = 5; s.stats(); assert(s.S.rate > r1, 'tiers stack');
  s.gainXp(W.xpNeed(2) + W.xpNeed(3)); assert.equal(s.pendingLevels, 2); s.pick(1); assert(s.cards, 'the next card set comes right after'); s.pick(2); assert(!s.cards);
  void t0;
});
test('phone: pickups and their timers (shield, armour, minigun, sneakers, freeze, snack, double XP, Garbage Day)', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 2, run: 1 } });
  s.applyPickup('shield'); assert.equal(s.buffs.shield, 8); const hp = s.p.hp; s.hurt(50); assert.equal(s.p.hp, hp, 'shield blocks');
  S.step(s, 8.2); assert.equal(s.buffs.shield, 0);
  s.applyPickup('armor'); s.p.inv = 0; s.hurt(50); assert.equal(s.p.hp, hp, 'armour soaks one hit'); assert.equal(s.p.armor, 0); s.p.inv = 0; s.hurt(10); assert(s.p.hp < hp, 'then you get hurt');
  s.applyPickup('minigun'); assert.equal(s.buffs.minigun, 15); S.step(s, 5); assert(Math.abs(s.buffs.minigun - 10) < 0.2);
  s.applyPickup('kicks'); assert.equal(s.buffs.kicks, 10); s.applyPickup('xp2'); assert.equal(s.buffs.xp2, 20); const x0 = s.xp; s.gainXp(1); assert.equal(s.xp - x0, 2, 'double XP');
  s.p.hp = 10; s.applyPickup('snack'); assert.equal(s.p.hp, 45);
  for (let i = 0; i < 20; i++) s.spawnOne('walker'); s.applyPickup('nuke'); S.step(s, 0.05); assert.equal(s.z.filter((z) => z.hp > 0).length, 0, 'Garbage Day clears the area');
  s.applyPickup('freeze'); s.spawnOne('runner'); const z = s.z[s.z.length - 1], zx = z.x, zy = z.y; S.step(s, 1); assert(Math.hypot(z.x - zx, z.y - zy) < 5, 'frozen solid');
  assert.equal(S.reports.filter((r) => r.k === 'pickup').length, 8);
  while (s.cards) s.pick(0); s.pk.length = 0; s.dropPickup(s.p.x, s.p.y - 20); S.step(s, 0.1); assert.equal(s.pk.length, 0, 'walking over a pickup grabs it (' + s.dead + ' ' + s.phase + ' ' + s.paused + ')');
  s.dropPickup(200, 200); const p = s.pk[0]; S.step(s, 23); assert(!s.pk.includes(p), 'pickups vanish after a while');
});
test('phone: death, and the spare lunchbox gets you back up once', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 2, run: 1, lvl: 3, ab: { life: 1 } } });
  assert.equal(s.p.lives, 1); s.p.inv = 0; s.hurt(999); assert(!s.dead); assert.equal(s.p.lives, 0); assert(S.reports.some((r) => r.k === 'down'));
  s.p.inv = 0; s.hurt(999); assert(s.dead); assert.equal(s.phase, 'dead'); assert(S.reports.some((r) => r.k === 'dead')); assert(S.events.some(([k]) => k === 'dead'));
});
test('phone co-op: the host sends snapshots, the guest mirrors them, hits come back, XP is shared, the guest takes over', () => {
  const H = sandbox(), G = sandbox();
  const host = H.make({ id: 'h', restore: { cell: [2, 2], home: [4, 4], wave: 2, run: 1 } }), guest = G.make({ id: 'g', restore: { cell: [2, 2], home: [4, 4], wave: 1, run: 1 } });
  const area = { k: '2,2', host: 'h', members: ['h', 'g'] }; host.setArea(area); guest.setArea(area);
  assert.equal(host.mode, 'host'); assert.equal(guest.mode, 'guest');
  host.p.inv = guest.p.inv = 1e9;
  for (let i = 0; i < 5; i++) host.spawnOne('walker');
  H.step(host, 0.2); const snap = H.lives.filter((m) => m.t === 'snap').pop(); assert(snap, 'host sends snapshots'); assert(snap.z.length >= 25);
  guest.onLive({ ...snap, from: 'h', area: '2,2' }); assert.equal(guest.z.length, snap.z.length / 5, 'guest sees the host’s zombies'); assert.equal(guest.wave, 2);
  // the guest shoots: hits go to the host
  const z = guest.z[0]; guest.p.x = z.x - 120; guest.p.y = z.y + 20; G.step(guest, 1.2); const ins = G.lives.filter((m) => m.t === 'in'); assert(ins.length > 5, 'guest sends its input');
  const hits = ins.flatMap((m) => m.h); assert(hits.length > 0, 'guest bullets land hits');
  const before = host.z.reduce((s, q) => s + q.hp, 0); for (const m of ins) host.onLive({ ...m, from: 'g', area: '2,2' }); H.step(host, 0.1);
  assert(host.z.reduce((s, q) => s + Math.max(0, q.hp), 0) < before, 'the host applies the guest’s hits'); assert(host.others.has('g'), 'the host sees the guest');
  const killSnap = H.lives.filter((m) => m.t === 'snap').pop();
  const xp0 = guest.xp + guest.lvl * 1000; guest.onLive({ ...killSnap, k: [['h', 3]], from: 'h', area: '2,2' }); assert(guest.xp + guest.lvl * 1000 > xp0, 'shared XP from the host’s kill');
  // a pickup grab: guest asks, host gives
  host.pk.push({ id: 77, k: 'shield', x: 100, y: 100, life: 10 }); H.step(host, 0.1); guest.onLive({ ...H.lives.filter((m) => m.t === 'snap').pop(), from: 'h', area: '2,2' });
  guest.p.x = 100; guest.p.y = 120; G.step(guest, 0.2); const grab = G.lives.find((m) => m.t === 'grab'); assert(grab && grab.id === 77);
  host.onLive({ ...grab, from: 'g', area: '2,2' }); const give = H.lives.find((m) => m.t === 'give'); assert(give && give.to === 'g' && give.k === 'shield');
  guest.onLive({ ...give, from: 'h', area: '2,2' }); assert(guest.buffs.shield > 0);
  // the host leaves: the guest takes over from the last snapshot
  const last = H.lives.filter((m) => m.t === 'snap').pop(); guest.onLive({ ...last, from: 'h', area: '2,2' });
  guest.onLive({ t: 'host', area: '2,2', host: 'g', members: ['g'] }); assert.equal(guest.mode, 'solo');
  assert.equal(guest.z.length, last.z.length / 5, 'zombies carried over'); assert(guest.z.every((q) => q.speed > 0), 'and they move again');
  const n = guest.zid; guest.spawnOne(); assert(guest.z[guest.z.length - 1].id >= n, 'fresh ids');
});

console.log(`\n${passed} TrashZombies tests passed.`);
