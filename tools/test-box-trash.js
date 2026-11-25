'use strict';
// JustZombies: the shared world rules, the server (runs, sanity checks, co-op areas and the live
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
  Object.assign(room.settings, { mode: 'endless' }, settings); // (these tests are Endless; Regular has its own below)
  return { clock, room, ps };
};
const run = (room, clock, ms) => { const end = clock.now() + ms; let i = 0; while (clock.now() < end && room.game.phase !== 'over' && clock.step()) if (++i > 200000) throw new Error('stuck'); };

// ---------------- the world ----------------
test('town: one road network per seed (same seed, same town); every block is reachable by road', () => {
  for (const seed of [1, 99, 123456, 7]) {
    assert.deepEqual(JSON.stringify(W.town(seed).cells), JSON.stringify(W.town(seed).cells));
    const d = W.roadDist(seed, [[0, 0]]); assert(d.every((v) => Number.isFinite(v)), seed + ': connected');
    for (let x = 0; x < W.GRID; x++) for (let y = 0; y < W.GRID; y++) { const c = W.cellOf(seed, x, y); assert(Object.values(c.side).some(Boolean), 'every block has a road'); }
  }
  assert.notEqual(JSON.stringify(W.town(1).cells.map((c) => c.side)), JSON.stringify(W.town(2).cells.map((c) => c.side)), 'another seed, another town');
  const looks = new Set(); for (let x = 0; x < W.GRID; x++) for (let y = 0; y < W.GRID; y++) looks.add(W.biomeOf(5, x, y).key); assert(looks.size >= 8, 'plenty of districts: ' + looks.size);
});
test('town: a road leaving a block enters the neighbour at the same place and width; exits only where roads cross', () => {
  for (const seed of [3, 42, 9001]) for (let x = 0; x < W.GRID; x++) for (let y = 0; y < W.GRID; y++) {
    const a = W.genArea(seed, x, y);
    if (x + 1 < W.GRID) { const b = W.genArea(seed, x + 1, y); assert.deepEqual(a.exits.e, b.exits.w, seed + ' ' + x + ',' + y + ' east'); assert.equal(!!a.exits.e, W.roadBetween(seed, [x, y], [x + 1, y])); }
    if (y + 1 < W.GRID) { const b = W.genArea(seed, x, y + 1); assert.deepEqual(a.exits.s, b.exits.n, seed + ' ' + x + ',' + y + ' south'); }
    for (const d of ['n', 's', 'w', 'e']) { const e = a.exits[d]; if (!e) continue; assert(e.p - e.w / 2 > 100 && e.p + e.w / 2 < (d === 'n' || d === 's' ? W.AW : W.AH) - 100, 'roads cross away from the corners'); }
  }
  assert.equal(W.exitsOf(1, 0, 0).n, null); assert.equal(W.exitsOf(1, 0, 0).w, null); assert.equal(W.exitsOf(1, 8, 8).s, null);
  assert.equal(W.roadBetween(1, [0, 0], [2, 0]), false, 'only neighbours');
});
test('areas: roads, sidewalks and the landmark spot stay clear; home blocks have the garage by the street', () => {
  for (let k = 0; k < 80; k++) {
    const a = W.genArea(k * 31, k % 9, (k * 7) % 9, k % 5 === 0);
    assert.deepEqual(a, W.genArea(k * 31, k % 9, (k * 7) % 9, k % 5 === 0), 'deterministic');
    const hit = (o, q) => o.x < q.x + q.w && o.x + o.w > q.x && o.y < q.y + q.h && o.y + o.h > q.y;
    for (const o of a.obstacles) {
      if (o.kind === 'wall') continue;
      for (const q of a.roads) assert(!hit(o, q), 'nothing on the road: ' + o.kind);
      if (a.spot) assert(!hit(o, a.spot), 'landmark spot clear');
      assert(o.x >= W.TILE - 30 && o.y >= W.TILE - 30 && o.x + o.w <= W.AW - W.TILE + 30 && o.y + o.h <= W.AH - W.TILE + 30, 'border ring clear');
    }
    assert.equal(!!a.garage, k % 5 === 0); if (a.garage) { assert(!a.spot); for (const q of a.roads) assert(!hit(a.garage, q), 'garage off the road'); } else assert(a.spot);
    assert(a.obstacles.filter((o) => o.kind !== 'wall').length >= 6, 'something to hide behind');
    assert(a.obstacles.some((o) => o.kind === 'bld') || ['lot', 'landfill', 'park', 'carnival', 'junkyard'].includes(a.biome.key), 'buildings in the built-up districts: ' + a.biome.key);
  }
});
test('level-up offers: 3 cards, one Attack + one Defense + one Special; nothing ever maxes out', () => {
  const r = W.rng(3);
  for (let i = 0; i < 300; i++) {
    const o = W.offer(r, {}); assert.equal(o.length, 3); assert.equal(new Set(o).size, 3);
    assert.deepEqual(o.map((id) => W.AB[id].cat).sort(), ['atk', 'def', 'spc']);
  }
  // stacked 50 deep: still a full mixed offer, forever
  const all = Object.fromEntries(W.ABILITIES.map((a) => [a.id, 50]));
  for (let i = 0; i < 100; i++) assert.deepEqual(W.offer(r, all).map((id) => W.AB[id].cat).sort(), ['atk', 'def', 'spc']);
  assert(W.ABILITIES.every((a) => a.max == null), 'no tier caps');
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
  assert(R.kills <= 200, 'kills capped by time: ' + R.kills); assert(R.lvl <= 7, 'level capped: ' + R.lvl); assert(R.mhp <= W.limits.hp(R.lvl) && R.hp <= R.mhp); assert(R.wave <= 2, 'wave needs areas: ' + R.wave);
  assert(!('nope' in R.ab)); assert(W.levelsFromAbilities(R.ab) <= R.lvl - 1, 'no more ability tiers than level-ups');
  run(room, clock, 1000); room.act(a, { op: 'st', kills: 30, lvl: 4, hp: 80, mhp: 125, wave: 1, ab: { hp: 1, rapid: 2 } });
  assert.equal(R.lvl, 4); assert.deepEqual(R.ab, { hp: 1, rapid: 2 }); assert.equal(R.hp, 80);
  for (const bad of [{ op: 'enter', x: 'a', y: 1 }, { op: 'enter', x: 99, y: 0 }, { op: 'ev', k: 'pick', id: 'nope' }, { op: 'ev', k: 'zzz' }, { op: 'nope' }, {}, { op: 'end' }]) {
    if (bad.op === 'end') { const b = room.join('Bob').player; assert.equal(room.act(b, bad).ok, false, 'only the host ends it'); continue; }
    assert.equal(room.act(a, bad).ok, false, JSON.stringify(bad));
  }
  const far = [R.cell[0] + 2, R.cell[1]]; assert.equal(room.act(a, { op: 'enter', x: far[0], y: far[1] }).ok, false, 'no teleporting');
});
// a neighbouring cell you can drive to (there is a road)
const roadNb = (g, c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [c[0] + dx, c[1] + dy]).find((n) => W.roadBetween(g.seed, c, n));
function walkTo(room, p, target) { // follow the streets, cell by cell, to a target cell (the kill locks have their own tests)
  const g = room.game; let R = g.runs.get(p.id), n = 0; const d = W.roadDist(g.seed, [target]); g.noLocks = true;
  while ((R.cell[0] !== target[0] || R.cell[1] !== target[1]) && n++ < 90) {
    const nx = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [R.cell[0] + dx, R.cell[1] + dy]).filter((c) => W.roadBetween(g.seed, R.cell, c)).sort((a, b) => d[a[1] * W.GRID + a[0]] - d[b[1] * W.GRID + b[0]])[0];
    const r = room.act(p, { op: 'enter', x: nx[0], y: nx[1] }); assert(r.ok, r.error);
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
  const out = roadNb(g, cell);
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
  walkTo(room, a, roadNb(g, g.runs.get(a.id).cell));
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
  assert.deepEqual(def.partyFit({ players: 4, minutes: 10 }), { mode: 'score', length: 'm10' }); assert.deepEqual(def.partyFit({ players: 4, minutes: 4 }), { mode: 'score', length: 'm5' }); assert.deepEqual(def.partyFit({ players: 2, minutes: 21 }), { mode: 'score', length: 'm20' });
});
test('bots play a whole (timed) night on the server; results() lists everyone best-first', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 1 });
  room.addBots(6); room.settings.length = 'm10'; room.settings.mode = 'endless'; assert(room.start().ok);
  let i = 0; while (room.game.phase !== 'over' && clock.step()) if (++i > 100000) throw new Error('never ended');
  const g = room.game; assert.equal(g.results().length, 6);
  assert(g.explored.size > 10, 'bots explore the map: ' + g.explored.size); assert(Math.max(...g.standings().map((r) => r.wave)) >= 5);
  const json = JSON.stringify(g.tv()); assert(json.length < 20000, 'TV state stays small: ' + json.length);
});
test('endless with bots only ends when they are all down for a while', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 2 }); room.addBots(2); room.settings.mode = 'endless'; room.start();
  for (const R of room.game.runs.values()) { R.state = 'dead'; R.deadAt = clock.now() + 1e9; }
  run(room, clock, 20000); assert.equal(room.game.phase, 'over');
});

// ---------------- Regular mode (the story) ----------------
const ST = require('../public/box/games/trash-story');
const story = (n = 1, settings = {}) => mk({ mode: 'story', ...settings }, n);
const cellOf = (g, p) => g.runs.get(p.id).cell;
test('Regular: gates need more team kills further out, and more with more players', () => {
  for (let t = 1; t <= 4; t++) { assert(ST.need(t, 1) > ST.need(t - 1, 1)); assert(ST.need(t, 4) > ST.need(t, 2) && ST.need(t, 2) > ST.need(t, 1)); }
  assert.equal(ST.need(2, 1), ST.BASE[2]); assert.equal(ST.need(2, 3), Math.round(ST.BASE[2] * 1.8));
  const P = ST.plan(9, [[4, 4]]), d = W.roadDist(9, [[4, 4]]); assert.equal(ST.tierAt(P, 4, 4), 0);
  for (let i = 0; i < 81; i++) assert.equal(P.tiers[i], d[i] <= 1 ? 0 : Math.min(4, Math.ceil((d[i] - 1) / 2)), 'tiers grow with road steps from the garage');
  assert(Math.max(...P.tiers) >= 3);
});
test('Regular: the plan is the same for a seed and different across seeds (finds, door place + look, boss)', () => {
  assert.deepEqual(ST.plan(42, [[4, 4]]), ST.plan(42, [[4, 4]]));
  const doors = new Set(), looks = new Set(), bosses = new Set(), finds = new Set();
  for (let seed = 1; seed <= 60; seed++) {
    const P = ST.plan(seed, [[4, 4]]), ids = Object.values(P.finds);
    doors.add(P.door.join()); looks.add(P.doorLook); bosses.add(P.boss); finds.add(JSON.stringify(P.finds));
    for (const k of ST.KEYS) assert(ids.includes(k), seed + ' has ' + k); assert(ids.includes('map1') && ids.includes('map2'));
    assert(!P.finds[P.door.join()], 'no loot on the door'); assert.equal(ST.tierAt(P, P.door[0], P.door[1]), P.top, 'the door is far away');
    assert(!(P.door[0] === 4 && P.door[1] === 4)); assert(ids.filter((i) => ST.FINDS[i].kind === 'equip' || ST.FINDS[i].kind === 'ability').length >= 5);
  }
  assert(doors.size >= 4 && looks.size >= 4 && bosses.size === Object.keys(ST.BOSSES).length && bosses.size >= 9 && finds.size >= 55, `${doors.size} doors, ${looks.size} looks, ${bosses.size} bosses`);
});
test('Regular: a locked gate blocks the way until the team has the kills (it shows kills / need); then it opens', () => {
  const { room, ps: [a, b] } = story(2); room.start(); const g = room.game;
  assert(g.plan && g.lockPlan && g.story.tier === 0); assert(g.story.beats.length === 1, 'the radio says hello');
  const R = g.runs.get(a.id), nbs = (c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [c[0] + dx, c[1] + dy]).filter((n) => W.roadBetween(g.seed, c, n));
  const target = (() => { for (const n1 of nbs(R.cell)) if (!g.locked(n1[0], n1[1])) for (const n2 of nbs(n1)) if (g.locked(n2[0], n2[1]) && !g.lockPlan.kind[n2[1] * W.GRID + n2[0]]) return [n2[0], n2[1], n1]; return null; })();
  assert(target, 'a locked block two road steps away');
  assert(room.act(a, { op: 'enter', x: target[2][0], y: target[2][1] }).ok, 'the blocks by the garage are open');
  const need = g.reqAt(target[0], target[1]); assert.equal(need, ST.lockNeed(g.lockPlan.req[target[1] * W.GRID + target[0]], 2), 'more players, more kills');
  const locked = room.act(a, { op: 'enter', x: target[0], y: target[1] }); assert.equal(locked.ok, false); assert.match(locked.error, new RegExp(`locked: 0 / ${need} team kills`));
  R.kills = need - 5; g.lockCheck(); assert(g.locked(target[0], target[1]));
  g.runs.get(b.id).kills = 5; g.lockCheck(); assert(!g.locked(target[0], target[1]), 'team kills count');
  assert(room.fxLog.some((f) => f.kind === 'tzunlock')); assert(g.feed.some((f) => /opened up/.test(f.text)));
  assert(room.act(a, { op: 'enter', x: target[0], y: target[1] }).ok, 'open now');
  const c = room.join('Cy').player; c.sockets = 1; assert(!g.locked(target[0], target[1]), 'a new player never closes an open gate');
  const tv = g.tv(); assert.equal(tv.locks.req[target[1] * W.GRID + target[0]], 0); assert.equal(tv.story.door, null, 'the TV hides the door'); assert(!('finds' in (tv.story.plan || {})), 'and the loot');
  assert.equal(tv.locks.kind[g.plan.door[1] * W.GRID + g.plan.door[0]], '?', 'the lair is a mystery on the map');
});
test('Regular: finds go to the finder (keys to the team); the map halves reveal the door', () => {
  const { room, ps: [a] } = story(1); room.start(); const g = room.game, R = g.runs.get(a.id);
  g.story.tier = 4; // all gates open for this test
  const where = (id) => Object.entries(g.plan.finds).find(([, v]) => v === id)[0].split(',').map(Number);
  const go = (c) => { R.cell = c.slice(); };
  assert.equal(room.act(a, { op: 'find', x: where('shard1')[0], y: where('shard1')[1] }).ok, false, 'not there');
  go(where('shard1')); assert.equal(room.act(a, { op: 'find', x: R.cell[0], y: R.cell[1] }).find, 'shard1'); assert.equal(g.story.keys.length, 1);
  assert.equal(room.act(a, { op: 'find', x: R.cell[0], y: R.cell[1] }).ok, false, 'looted already');
  const eq = Object.entries(g.plan.finds).find(([, v]) => ST.FINDS[v].kind === 'equip'); go(eq[0].split(',').map(Number)); room.act(a, { op: 'find', x: R.cell[0], y: R.cell[1] });
  assert.equal(g.view(a).me.eq[eq[1]], 1, 'equipment is yours');
  go(where('map1')); room.act(a, { op: 'find', x: R.cell[0], y: R.cell[1] }); assert(g.tv().story.hint && !g.tv().story.door, 'half a map: a rough area');
  go(where('map2')); room.act(a, { op: 'find', x: R.cell[0], y: R.cell[1] }); assert.deepEqual(g.tv().story.door, g.plan.door, 'both halves: the door');
  assert(room.fxLog.some((f) => f.kind === 'tzfind')); assert(g.story.beats.some((b) => b.k === 'map2'));
});
test('Regular: the boss door needs the 3 key pieces; beating the boss wins the round', () => {
  const { room, ps: [a] } = story(1); room.start(); const g = room.game, R = g.runs.get(a.id);
  assert.equal(room.act(a, { op: 'ev', k: 'victory' }).ok, false, 'no cheap wins');
  R.cell = g.plan.door.slice();
  assert.match(room.act(a, { op: 'door' }).error, /0\/3/);
  g.story.keys = ['shard1', 'shard2'];
  assert.equal(room.act(a, { op: 'door' }).ok, false);
  g.story.keys.push('shard3'); const r = room.act(a, { op: 'door' }); assert(r.ok && r.boss === g.plan.boss); assert(g.story.doorOpen);
  assert(room.fxLog.some((f) => f.kind === 'tzdoor'));
  assert(room.act(a, { op: 'ev', k: 'victory' }).ok); assert.equal(g.phase, 'over'); assert.equal(g.overWhy, 'win');
  const tv = g.tv(); assert(tv.story.won && tv.story.time >= 0); assert.equal(g.results()[0], a.id);
});
test('Regular: a fallen player gets back in after 15 s with their build; everyone down loses the round', () => {
  const { room, clock, ps: [a, b] } = story(2); room.start(); const g = room.game, R = g.runs.get(a.id);
  run(room, clock, 2000); room.act(a, { op: 'st', kills: 40, lvl: 4, hp: 80, mhp: 125, wave: 1, ab: { hp: 1, rapid: 2 } });
  R.cell = roadNb(g, R.home);
  room.act(a, { op: 'ev', k: 'dead' }); assert.equal(R.state, 'dead'); assert.equal(g.phase, 'play', 'Ben is still up');
  assert.equal(room.act(a, { op: 'respawn' }).ok, false, 'not straight away'); assert(g.view(a).story.reviveIn > 10000);
  run(room, clock, 16000); assert(room.act(a, { op: 'respawn' }).ok);
  assert.equal(R.state, 'play'); assert.equal(R.lvl, 4); assert.deepEqual(R.ab, { hp: 1, rapid: 2 }); assert.deepEqual(R.cell, R.home, 'back at the garage');
  room.act(a, { op: 'ev', k: 'dead' }); room.act(b, { op: 'ev', k: 'dead' }); assert.equal(g.phase, 'over'); assert.equal(g.overWhy, 'lost');
});
test('Endless: no story (no key, no door), but the kill gates are there too', () => {
  const { room, ps: [a] } = mk({ mode: 'endless' }, 1); room.start(); const g = room.game;
  assert.equal(g.plan, null); assert.equal(g.tv().story, null); assert(g.lockPlan && g.tv().locks.req.some((v) => v > 0), 'locked blocks in Endless');
  walkTo(room, a, [0, 0]); walkTo(room, a, [8, 8]);
  assert.equal(room.act(a, { op: 'find', x: 8, y: 8 }).ok, false); assert.equal(room.act(a, { op: 'door' }).ok, false);
});
test('no level or ability cap on the server either', () => {
  const { room, clock, ps: [a] } = mk({}, 1); room.start(); const R = room.game.runs.get(a.id);
  R.kills = 5000; R.lvl = 60; run(room, clock, 2000);
  room.act(a, { op: 'st', kills: 5000, lvl: 60, hp: 900, mhp: 900, wave: 1, ab: { rapid: 30, spread: 20 } });
  assert.deepEqual(R.ab, { rapid: 30, spread: 20 }); assert.equal(R.mhp, 900);
});
test('bots play a Regular night: they respect the gates and the night ends when everyone leaves', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 3 }); room.addBots(4); room.settings.mode = 'story'; room.start();
  const g = room.game; let i = 0;
  while (g.phase !== 'over' && clock.step()) { if (++i > 100000) throw new Error('never ended'); for (const R of g.runs.values()) assert(!g.locked(R.cell[0], R.cell[1]), 'never behind a chained gate'); }
  assert.equal(g.results().length, 4);
});

// ---------------- the phone simulation (sandboxed) ----------------
function sandbox() {
  let now = 0; const reports = [], lives = [], events = [];
  const ctx = { console, Math, Date, JSON, Object, Array, Map, Set, Number, String, Promise, Infinity, isFinite, performance: { now: () => now } };
  ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
  for (const f of ['trash-world.js', 'trash-sim.js', 'trash-story.js', 'trash-boss.js', 'trash-shop.js', 'trash-play.js', 'trash-arms.js', 'trash-fight.js', 'trash-extra.js', 'trash-more.js', 'trash-gates.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'games', f), 'utf8'), ctx, { filename: f });
  const make = (o = {}) => new ctx.TZSim.Sim({ seed: 42, homes: [[4, 4]], me: { id: o.id || 'me', name: 'Me', color: '#fff' }, settings: { diff: 'normal', aim: 'on', xp: 'shared', ...(o.settings || {}) }, restore: o.restore || { cell: [4, 4], home: [4, 4], wave: 1, run: 1 },
    report: (m) => { reports.push(m); return Promise.resolve({ ok: true }); }, live: (m) => lives.push(m), on: (k, d) => events.push([k, d]), people: () => null });
  const step = (s, sec, I = {}, pick = true) => { for (let t = 0; t < sec; t += 1 / 60) { now += 1000 / 60; if (pick && s.cards) s.pick(0); s.update(1 / 60, I); } };
  return { ctx, make, step, reports, lives, events };
}
test('phone: the garage intro, then wave 1; exits stay shut until the area is clear; you leave along the road', () => {
  const S = sandbox(), s = S.make(), G = s.area.garage;
  assert.equal(s.phase, 'intro'); assert(G, 'the first area has your garage'); assert(s.p.y < G.y + G.h, 'you start inside');
  S.step(s, 5); assert.equal(s.phase, 'play'); assert.equal(s.wave, 1); assert(s.p.y > G.y + G.h, 'walked out of the garage');
  s.p.inv = 1e9; // (no dying in this test)
  const dir = ['n', 's', 'w', 'e'].find((d) => s.area.exits[d]), road = s.area.exits[dir], [dx, dy] = W.DIRS[dir];
  const toEdge = () => { if (dir === 'n') { s.p.x = road.p; s.p.y = 60; } else if (dir === 's') { s.p.x = road.p; s.p.y = W.AH - 60; } else if (dir === 'w') { s.p.x = 60; s.p.y = road.p; } else { s.p.x = W.AW - 60; s.p.y = road.p; } };
  toEdge(); S.step(s, 2, { mx: dx, my: dy }); assert.equal(s.cell.join(), '4,4', 'the exit is shut');
  assert(!s.cleared);
  s.z.length = 0; s.waveKills = s.spec.target; S.step(s, 0.1); assert(s.cleared, 'cleared'); assert(S.reports.some((r) => r.op === 'ev' && r.k === 'clear'));
  // a closed edge (no road there) stays a fence even when the area is clear
  const shut = ['n', 's', 'w', 'e'].find((d) => !s.area.exits[d]);
  if (shut) { const [sx, sy] = W.DIRS[shut]; s.p.x = W.AW / 2 + sx * (W.AW / 2 - 40); s.p.y = W.AH / 2 + sy * (W.AH / 2 - 40); S.step(s, 1, { mx: sx, my: sy }); assert.equal(s.cell.join(), '4,4', 'no road, no way out'); }
  toEdge(); for (let i = 0; i < 120 && s.cell.join() === '4,4'; i++) S.step(s, 1 / 60, { mx: dx, my: dy });
  assert.equal(s.cell.join(), [4 + dx, 4 + dy].join(), 'walked into the next cell'); assert.equal(s.wave, 2); assert(!s.cleared);
  const back = s.area.exits[W.OPP[dir]]; assert.deepEqual(back, road, 'the same road on the other side');
  assert(Math.abs((dir === 'n' || dir === 's' ? s.p.x : s.p.y) - road.p) < 2, 'you arrive on that road');
  assert(S.reports.some((r) => r.op === 'enter' && r.x === 4 + dx && r.y === 4 + dy)); assert.notEqual(s.area.biome.key, 'home');
});
test('phone camera: it leads where you run (eased over ~0.4 s) and where you aim by hand, and stays inside the area', () => {
  const S = sandbox(), L = S.ctx.TZSim.lead, st = { lx: 0, ly: 0 }, P = { vx: 300, vy: 0, aim: Math.PI / 2 };
  L(st, P, 600, 330, 0.016, false); assert(st.lx > 0 && st.lx < 20, 'eases in, not a jump');
  for (let i = 0; i < 25; i++) L(st, P, 600, 330, 0.016, false); // 0.4 s
  assert(st.lx > 600 * 0.12 * 0.9 && Math.abs(st.ly) < 1, 'settled ahead of you: ' + st.lx);
  L(st, { vx: 0, vy: 0, aim: Math.PI / 2 }, 600, 330, 1, true); assert(Math.abs(st.lx) < 2 && st.ly > 330 * 0.06, 'aiming down leads down');
  L(st, { vx: 0, vy: 0, aim: 0 }, 600, 330, 2, false); assert(Math.abs(st.lx) < 1 && Math.abs(st.ly) < 1, 'standing still: back on you');
  const C = S.ctx.TZSim.camCenter; const c = C(-500, 99999, 600, 330, 140); assert.equal(c.x, 300 - 140); assert.equal(c.y, W.AH + 140 - 165, 'clamped to the area');
  const wx = new Set(); for (let i = 1; i < 60; i++) wx.add(S.ctx.TZSim.weather(i).tod); assert.deepEqual([...wx].sort(), ['dusk', 'night', 'overcast'], 'every kind of evening shows up');
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
  s.ab.rapid = 4; s.stats(); const r1 = s.S.rate; s.ab.rapid = 5; s.stats(); assert(s.S.rate > r1, 'stacks stack');
  // no cap, soft limits: 200 stacks of everything still gives sane numbers and more damage
  for (const A of W.ABILITIES) s.ab[A.id] = 200; s.lvl = 4000; s.stats();
  assert(s.S.rate < 5.5 * 3.41 && s.S.dodge < 0.6 && s.S.armor >= 0.3 && s.S.speed < 255 * 1.81 && s.S.slow < 0.6 && s.S.crit <= 0.8, JSON.stringify(s.S));
  assert(s.S.spread <= 9 && s.S.orbit <= 10 && s.S.bounce <= 6 && s.S.pierce <= 8, 'bullet and orbiter counts stay bounded');
  assert(s.S.mhp === 100 + 25 * 200 && s.S.dmg > 1000, 'health and damage keep growing'); for (const A of W.ABILITIES) delete s.ab[A.id]; s.lvl = 2; s.stats();
  s.gainXp(W.xpNeed(2) + W.xpNeed(3)); assert.equal(s.pendingLevels, 2); s.pick(1); assert(s.cards, 'the next card set comes right after'); s.pick(2); assert(!s.cards);
  void t0;
});
test('phone: pickups and their timers (shield, armour, minigun, sneakers, freeze, snack, double XP, Garbage Day)', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 2, run: 1 } });
  s.applyPickup('shield'); assert.equal(s.buffs.shield, 8); const hp = s.p.hp; s.hurt(50); assert.equal(s.p.hp, hp, 'shield blocks');
  S.step(s, 8.2); assert.equal(s.buffs.shield, 0);
  s.applyPickup('armor'); s.p.inv = 0; s.hurt(50); assert.equal(s.p.hp, hp, 'armour soaks one hit'); assert.equal(s.p.armor, 0); s.p.inv = 0; s.hurt(10); assert(s.p.hp < hp, 'then you get hurt');
  s.applyPickup('minigun'); assert.equal(s.buffs.minigun, 12); S.step(s, 5); assert(Math.abs(s.buffs.minigun - 7) < 0.2);
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


// ---------------- B: modes, places, call-outs, maps, going down ----------------
const PL = require('../public/box/games/trash-shop');
test('Score attack: timed, ranked by score; falling costs 15% (min 200) and you are back at your garage after 5 s', () => {
  const { room, clock, ps: [a, b] } = mk({ mode: 'score', length: 'm5' }, 2); room.start(); const g = room.game;
  assert.equal(g.endsAt - g.startedAt, 5 * 60000);
  run(room, clock, 2000);
  room.act(a, { op: 'st', kills: 30, lvl: 3, hp: 90, mhp: 100, wave: 1, score: 2000, mult: 3 });
  room.act(b, { op: 'st', kills: 40, lvl: 3, hp: 90, mhp: 100, wave: 1, score: 900, mult: 1 });
  assert.equal(g.runs.get(a.id).score, 2000); assert.deepEqual(g.standings().map((r) => r.id), [a.id, b.id], 'score beats kills');
  room.act(b, { op: 'st', kills: 41, lvl: 3, hp: 90, mhp: 100, wave: 1, score: 999999999, mult: 1 }); assert(g.runs.get(b.id).score < 30000, 'no impossible jumps');
  room.act(a, { op: 'ev', k: 'dead' }); assert.equal(room.act(a, { op: 'respawn' }).ok, false, 'a short wait');
  run(room, clock, 5200); assert(room.act(a, { op: 'respawn' }).ok); const R = g.runs.get(a.id);
  assert.equal(R.state, 'play'); assert.equal(R.score, 1700); assert.deepEqual(R.cell, R.home); assert(g.feed.some((f) => /lost 300 points/.test(f.text)));
  run(room, clock, 5 * 60000); assert.equal(g.phase, 'over'); assert.equal(g.overWhy, 'time');
});
test('Party Mode: JustZombies is a score attack lasting exactly the planned minutes; party points go by score', () => {
  assert.equal(def.partyFit({ players: 4, minutes: 10 }).mode, 'score');
  const { room, ps: [a, b] } = mk({ mode: 'score', length: 'm10' }, 2);
  room.partyMode = { defs: [room.def], index: 0, plan: { trash: 7 }, phase: 'playing' }; room.start(); const g = room.game;
  assert.equal(g.endsAt - g.startedAt, 7 * 60000, 'the plan’s 7 minutes, not the nearest option');
  g.runs.get(a.id).score = 100; g.runs.get(b.id).score = 5000; g.end('time'); assert.deepEqual(g.results(), [b.id, a.id]);
});
test('places: about one block in five, where they fit; the master armorer and the crucible far out; same per seed', () => {
  for (const seed of [1, 5, 77, 2024]) {
    const P = PL.places(seed), n = {}; for (const t of Object.values(P)) n[t] = (n[t] || 0) + 1;
    assert.deepEqual(P, PL.places(seed)); assert(Object.keys(P).length >= 14 && Object.keys(P).length <= 20, Object.keys(P).length);
    assert.equal(n.forge, 1); assert.equal(n.master, 1); assert(n.tinker >= 2 && n.gunsmith >= 1 && n.market >= 3 && n.clinic >= 2 && n.armor >= 2);
    const d = W.roadDist(seed, [[4, 4]]); for (const [k, t] of Object.entries(P)) if (t === 'forge' || t === 'master') { const [x, y] = k.split(',').map(Number); assert(d[y * 9 + x] >= 3, t + ' is far out'); }
    assert(!P['4,4']);
  }
  assert.deepEqual([PL.PLACES.tinker.up, PL.PLACES.gunsmith.up, PL.PLACES.master.up], [[1, 5], [5, 8], [8, 10]], 'three ranks of gun merchants');
  assert(PL.price('medkit', 10) > PL.price('medkit', 1) && PL.price('medkit', 1, 2) > PL.price('medkit', 1), 'prices climb with the wave and with repeat buys');
  assert.deepEqual([0, 7, 8, 20, 36].map(PL.mult), [1, 1, 2, 3, 4]);
});
test('discovery is shared: walking into a place reveals it for the whole team (TV + every phone); call-outs reach everyone', () => {
  const { room, clock, ps: [a, b] } = mk({}, 2); room.start(); const g = room.game;
  const target = Object.entries(PL.places(g.seed)).find(([k]) => !g.homes.some((h) => h.join() === k));
  walkTo(room, a, target[0].split(',').map(Number));
  assert(g.found.has(target[0])); assert.deepEqual(g.view(b).found.find(([k]) => k === target[0]), target, 'Ben sees it too'); assert(g.tv().found.length >= 1);
  assert(g.feed.some((f) => f.text.includes(PL.PLACES[target[1]].name)));
  assert(room.act(a, { op: 'ping', k: 'place', cell: target[0] }).ok); assert.equal(room.act(a, { op: 'ping', k: 'here' }).ok, false, 'not every half second');
  run(room, clock, 1600); assert(room.act(b, { op: 'ping', k: 'go', cell: target[0] }).ok);
  assert.equal(room.act(b, { op: 'ping', k: 'go', cell: '0,0' }).ok || g.found.has('0,0') || g.explored.has('0,0'), false, 'only places someone found');
  const pv = g.view(a).pings; assert.equal(pv.length, 2); assert.equal(pv[1].name, 'Ben'); assert.equal(pv[1].x + ',' + pv[1].y, target[0]); assert(g.tv().pings.length === 2);
  assert.equal(room.act(a, { op: 'ping', k: 'lol' }).ok, false);
  run(room, clock, 31000); assert.equal(g.tv().pings.length, 0, 'call-outs fade after a while');
});
test('boss maps: only from a boss wave, once; the finder picks where it leads and the team gets the place + a route', () => {
  const { room, ps: [a, b] } = mk({}, 2); room.start(); const g = room.game, R = g.runs.get(a.id);
  assert.equal(room.act(a, { op: 'ev', k: 'mapgot', wave: 3 }).ok, false, 'no boss on wave 3');
  assert.equal(room.act(a, { op: 'reveal', what: 'forge' }).ok, false, 'no map yet');
  R.wave = 5; const got = room.act(a, { op: 'ev', k: 'mapgot', wave: 5 }); assert(got.ok); assert(got.options.length >= 3 && got.options.some((o) => o.what === 'forge') && got.options.some((o) => o.what === 'stash'));
  assert.equal(room.act(a, { op: 'ev', k: 'mapgot', wave: 5 }).ok, false, 'one map per boss');
  const r = room.act(a, { op: 'reveal', what: 'forge' }); assert(r.ok); assert.equal(g.found.get(r.k).type, 'forge'); assert(g.view(b).found.some(([k]) => k === r.k));
  assert(g.pings.some((q) => q.place === 'forge' && q.x + ',' + q.y === r.k), 'a route call-out for everyone');
  assert.equal(room.act(a, { op: 'reveal', what: 'stash' }).ok, false, 'that map is used up');
  R.wave = 10; room.act(a, { op: 'ev', k: 'mapgot', wave: 10 }); const s = room.act(a, { op: 'reveal', what: 'stash' }); assert(s.ok);
  R.cell = s.k.split(',').map(Number); const c = room.act(a, { op: 'stash' }); assert(c.ok && c.cash > 0); assert.equal(room.act(a, { op: 'stash' }).ok, false, 'once each');
  assert(g.view(b).stashes.includes(s.k), 'Ben can still dig it up'); assert(!g.view(a).stashes.includes(s.k));
});
test('Regular co-op: you go down instead of out; a teammate standing by you picks you up; everyone down loses', () => {
  const { room, ps: [a, b] } = story(2); room.start(); const g = room.game, A = g.runs.get(a.id), B = g.runs.get(b.id);
  assert(room.act(a, { op: 'ev', k: 'downed' }).ok); assert.equal(A.state, 'down'); assert(g.feed.some((f) => /is down/.test(f.text)));
  assert.equal(room.act(b, { op: 'revive', id: a.id }).ok, false, 'you have to be there');
  B.cell = A.cell.slice(); g.outbox.length = 0; assert(room.act(b, { op: 'revive', id: a.id }).ok); assert.equal(A.state, 'play');
  assert(g.outbox.some((m) => m.to === a.id && m.data.t === 'revived'), 'Ana’s phone is told');
  const solo = story(1); solo.room.start(); assert.equal(solo.room.act(solo.ps[0], { op: 'ev', k: 'downed' }).ok, false, 'solo: nobody to pick you up');
  room.act(a, { op: 'ev', k: 'downed' }); assert.equal(room.act(b, { op: 'ev', k: 'downed' }).ok, false, 'nobody left to help'); room.act(b, { op: 'ev', k: 'dead' }); assert.equal(g.phase, 'over'); assert.equal(g.overWhy, 'lost');
});
test('phone: score per kill x the streak; the streak drops when you get hit; wave clear and no-damage bonuses; cash', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); s.p.inv = 1e9;
  for (let i = 0; i < 9; i++) { const z = s.spawnOne('walker'); s.damageZ(z, 1e6, 'me'); S.step(s, 0.5); }
  assert.equal(s.mult, 2); assert(s.score >= 8 * 10 + 20, 'x2 kicks in: ' + s.score);
  s.p.inv = 0; s.buffs.shield = 0; s.hurt(5); assert.equal(s.mult, 1, 'hit: streak gone'); s.p.inv = 1e9;
  const sc = s.score; s.z.length = 0; s.waveKills = s.spec.target; S.step(s, 0.1); assert(s.cleared); assert.equal(s.score - sc, 300, 'clear bonus only (you were hit)');
  assert(s.coins.length > 0 || s.cash > 0, 'zombies drop cash'); S.step(s, 2); assert(s.cash > 0 && s.coins.length === 0, 'coins fly to you after the clear');
  const s2 = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 2, run: 1 } }); s2.p.inv = 1e9; s2.z.length = 0; s2.waveKills = s2.spec.target; S.step(s2, 0.1); assert.equal(s2.score, 200 + 500, 'clear + no damage');
  for (let i = 0; i < 4; i++) { const z = s2.spawnOne('walker'); s2.damageZ(z, 1e6, 'me'); } assert(s2.score >= 700 + 40 + 150, 'multi-kill bonus');
});
test('phone shops: only by a place once the wave is clear; stock fits the place; buying costs cash, prices rise, one of each per visit', () => {
  const S = sandbox(), seed = 42, P = PL.places(seed), [k, type] = Object.entries(P).find(([, t]) => t === 'clinic');
  const s = S.make({ restore: { cell: k.split(',').map(Number), home: [4, 4], wave: 6, run: 1 } }); s.p.inv = 1e9;
  assert.equal(s.placeType(), 'clinic'); const D = s.shopDoor(); s.p.x = D.x; s.p.y = D.y; S.step(s, 0.1); assert(!s.nearShop, 'closed during the wave');
  s.z.length = 0; s.waveKills = s.spec.target; S.step(s, 0.1); s.p.x = D.x; s.p.y = D.y; S.step(s, 0.1); assert(s.nearShop, 'open after the clear');
  const St = s.stockOf(); assert(St.list.length >= 3 && St.list.every((id) => PL.GOODS[id].shop === 'clinic'));
  const id = St.list[0]; s.cash = 0; assert.equal(s.buy(id).ok, false, 'no cash'); s.cash = 1000; const c = s.priceOf(id); assert(c > PL.GOODS[id].base, 'wave 6 prices');
  s.p.hp = 10; assert(s.buy(id).ok); assert.equal(s.cash, 1000 - c); assert.equal(s.buy(id).ok, false, 'sold out this visit'); assert(S.reports.some((r) => r.k === 'buy' && r.id === id));
  // the market: a book teaches the ability you choose; armour gear fills the buttons
  const mk2 = Object.entries(P).find(([, t]) => t === 'market')[0], m = S.make({ restore: { cell: mk2.split(',').map(Number), home: [4, 4], wave: 2, run: 1 } }); m.cash = 999;
  m.stocks[m.cellKey() + ':market'] = { wave: m.wave, type: 'market', list: ['book', 'bag', 'ticket', 'chips'], sold: {} };
  assert(m.buy('book', 'orbit').ok); assert.equal(m.ab.orbit, 1); assert(m.buy('bag').ok); assert(m.pocket && W.PK[m.pocket]); assert(m.usePocket()); assert(!m.pocket);
  assert(m.buy('ticket').ok); m.gainXp(W.xpNeed(m.lvl)); const c1 = [...m.cards].join(); assert(m.reroll()); assert.equal(m.rerolls, 0); void c1;
  const ar = Object.entries(P).find(([, t]) => t === 'armor')[0], A = S.make({ restore: { cell: ar.split(',').map(Number), home: [4, 4], wave: 2, run: 1 } }); A.cash = 999; A.p.inv = 0;
  A.stocks[A.cellKey() + ':armor'] = { wave: A.wave, type: 'armor', list: ['plate', 'grenade', 'turret', 'vest'], sold: {} };
  assert(A.buy('plate').ok); const hp = A.p.hp; A.buffs.shield = 0; A.hurt(30); assert.equal(A.p.hp, hp, 'a plate soaks a hit'); assert.equal(A.plates, 2);
  const arm = A.S.armor; assert(A.buy('vest').ok); assert(A.S.armor < arm);
  assert(A.buy('grenade').ok); for (let i = 0; i < 10; i++) A.spawnOne('walker'); for (const z of A.z) { z.x = A.p.x + 100; z.y = A.p.y; } assert(A.useBomb()); assert.equal(A.z.filter((z) => z.hp > 0).length, 0, 'bomb clears the screen'); assert.equal(A.useBomb(), false);
  assert(A.buy('turret').ok); assert(A.useTurret()); A.spawnOne('walker'); const z = A.z[A.z.length - 1]; z.x = A.turrets[0].x + 200; z.y = A.turrets[0].y; A.p.inv = 1e9; S.step(A, 2); assert(z.hp < z.mhp || z.hp <= 0, 'the turret shoots');
});
test('phone: a boss wave drops a map; walking over it asks the server and offers the choice', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 5, run: 1 } }); s.p.inv = 1e9;
  const z = s.spawnOne('boss'); s.damageZ(z, 1e9, 'me'); assert(s.mapItem, 'a map on the ground');
  s.p.x = s.mapItem.x; s.p.y = s.mapItem.y + 20; S.step(s, 0.1); assert(S.reports.some((r) => r.k === 'mapgot' && r.wave === 5)); assert(!s.mapItem);
  const s2 = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 4, run: 1 } }); const z2 = s2.spawnOne('boss'); s2.damageZ(z2, 1e9, 'me'); assert(!s2.mapItem, 'only on the boss waves');
});
test('phone co-op: going down, a friend standing by you for 2 s sends the revive; getting back up', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 2, run: 1 } });
  s.story = { tiers: new Array(81).fill(0), tier: 0, needs: [1, 2, 3, 4], kills: 0, keys: 0, plan: { finds: {}, door: [8, 8] } }; s.o.mates = () => 1;
  s.p.inv = 0; s.buffs.shield = 0; s.hurt(9999); assert(s.down && !s.dead, 'down, not out'); assert(S.reports.some((r) => r.k === 'downed'));
  S.step(s, 3); assert(s.down.t < 23); s.onLive({ t: 'revived', area: '2,2' }); assert(!s.down); assert(s.p.hp > 0);
  s.p.inv = 0; s.hurt(9999); S.step(s, 26); assert(s.dead, 'bled out');
  const h = S.make({ id: 'h', restore: { cell: [2, 2], home: [4, 4], wave: 2, run: 1 } }); h.p.inv = 1e9; h.mode = 'host'; h.areaMembers = ['h', 'g'];
  h.other('g', [h.p.x + 40, h.p.y, 0, 0, 100, 0, 0, 0, 0, 1, 1, 0]); const n = S.reports.length; S.step(h, 2.3); assert(S.reports.slice(n).some((r) => r.op === 'revive' && r.id === 'g'));
});


// ---------------- C: weapons, merchants, the crucible, combos, classes, items, debuffs, new zombies ----------------
const AR = require('../public/box/games/trash-arms');
const at = (S, type, wave = 6, extra = {}) => { const [k] = Object.entries(PL.places(42)).find(([, t]) => t === type); return S.make({ restore: { cell: k.split(',').map(Number), home: [4, 4], wave, run: 1, ...extra } }); };
test('weapons: up to 4 extra slots that fire by themselves; a duplicate adds a level instead; no level past 10', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); s.p.inv = 1e9;
  assert.equal(s.addWeapon('shotgun'), true); assert.equal(s.weapons.length, 1); assert(S.reports.some((r) => r.k === 'weapon' && r.id === 'shotgun'));
  assert.equal(s.addWeapon('shotgun'), 'level'); assert.equal(s.weapons[0].lv, 2, 'duplicate: +1 level');
  for (const id of ['smg', 'nailgun', 'crossbow']) s.addWeapon(id); assert.equal(s.weapons.length, AR.SLOTS); const c0 = s.cash; assert.equal(s.addWeapon('rail'), 'cash'); assert.equal(s.cash, c0 + 25, 'slots full: cash instead');
  for (const id of ['flamer', 'blower', 'hubcap', 'launcher', 'coil', 'saw', 'rail', 'bat']) { const t = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); t.p.inv = 1e9; t.addWeapon(id); t.spawnOne('walker'); const z = t.z[0]; z.x = t.p.x + 60; z.y = t.p.y; z.hp = z.mhp = 1e6; S.step(t, 1.6); assert(z.hp < 1e6, id + ' hurts zombies'); }
  assert(Object.keys(AR.WEAPONS).length >= 12 && new Set(Object.values(AR.WEAPONS).flatMap((w) => w.names)).size === Object.keys(AR.WEAPONS).length * 3, 'every weapon has 3 tier names');
});
test('gun merchants: the Tinkerer does Lv 1-5, the Gunsmith 5-8, the Master Armorer 8-10; prices rise with level and tier', () => {
  assert(AR.canUpgrade('tinker', 1) && AR.canUpgrade('tinker', 4) && !AR.canUpgrade('tinker', 5));
  assert(!AR.canUpgrade('gunsmith', 4) && AR.canUpgrade('gunsmith', 5) && AR.canUpgrade('gunsmith', 7) && !AR.canUpgrade('gunsmith', 8));
  assert(!AR.canUpgrade('master', 7) && AR.canUpgrade('master', 8) && AR.canUpgrade('master', 9) && !AR.canUpgrade('master', 10));
  assert(AR.upgradeCost('shotgun', 5, 1, 1) > AR.upgradeCost('shotgun', 1, 1, 1) && AR.upgradeCost('shotgun', 1, 2, 1) > AR.upgradeCost('shotgun', 1, 1, 1) && AR.upgradeCost('rail', 1, 1, 1) > AR.upgradeCost('smg', 1, 1, 1));
  const S = sandbox(), s = at(S, 'tinker'); s.cash = 1e5; s.addWeapon('smg');
  for (let i = 0; i < 4; i++) assert(s.upgrade('smg', 'tinker').ok); assert.equal(s.weapons[0].lv, 5); assert.equal(s.upgrade('smg', 'tinker').ok, false, 'the tinker stops at 5');
  assert(s.upgrade('pistol', 'tinker').ok, 'the pistol levels up too'); const d0 = s.S.dmg; s.gun.lv = 2; s.stats(); s.gun.lv = 6; s.stats(); assert(s.S.dmg > d0);
  assert.equal(s.upgrade('smg', 'gunsmith').ok, true); assert.equal(s.upgrade('smg', 'master').ok, false, 'master needs level 8');
  s.weapons[0].lv = 8; assert(s.upgrade('smg', 'master').ok); assert(s.upgrade('smg', 'master').ok); assert.equal(s.weapons[0].lv, 10); assert.match(s.upgrade('smg', 'master').error, /crucible/);
  s.cash = 0; s.weapons[0].lv = 2; assert.match(s.upgrade('smg', 'tinker').error, /cash/);
  assert(S.reports.some((r) => r.k === 'upgrade' && r.id === 'smg'));
});
test('the crucible (a separate place) evolves a level-10 weapon: Tier 1 -> 2 -> 3, back to level 1 each time, needs a core; the golden cutscene plays', () => {
  const S = sandbox(), f = at(S, 'forge'); f.p.inv = 1e9; f.addWeapon('shotgun'); const w = f.weapons[0];
  assert.equal(f.placeType(), 'forge'); assert.match(f.evolve('shotgun').error, /level 10/); w.lv = 10; assert.match(f.evolve('shotgun').error, /core/);
  f.cores = 2; assert(f.evolve('shotgun').ok); assert(f.evo, 'the cutscene starts'); assert(S.events.some(([k]) => k === 'evolve'));
  const x0 = f.p.x; S.step(f, 1, { mx: 1 }); assert.equal(f.p.x, x0, 'solo: the game waits during the cutscene'); assert.equal(w.tier, 1, 'not yet');
  S.step(f, 2.6); assert(!f.evo); assert.equal(w.tier, 2); assert.equal(w.lv, 1); assert.equal(f.cores, 1); assert(S.reports.some((r) => r.k === 'evolve' && r.tier === 2)); assert.equal(AR.wname('shotgun', 2), 'Double-Barrel Dumpster');
  assert.match(f.evolve('shotgun').error, /level 10/, 'level 1 again: back to the merchants'); w.lv = 10; assert(f.evolve('shotgun').ok); S.step(f, 3.6); assert.equal(w.tier, 3);
  w.lv = 10; f.cores = 5; assert.match(f.evolve('shotgun').error, /fully evolved/i); assert.equal(AR.wname('pistol', 3), 'Golden Hand-Cannon');
  const m = at(S, 'market'); m.addWeapon('smg'); m.weapons[0].lv = 10; m.cores = 1; assert.match(m.evolve('smg').error, /crucible/, 'only at the crucible');
  assert(!at(S, 'gunsmith').placeType().includes('forge'));
});
test('combos: owning both halves unlocks one (banner + feed), listed in the combo book; timed super weapons fuse', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); s.p.inv = 1e9;
  s.addWeapon('flamer'); assert.equal(s.combos.size, 0); s.addWeapon('blower'); assert(s.combos.has('firetornado')); assert(/COMBO/.test(s.banner.text)); assert(S.reports.some((r) => r.k === 'combo' && r.id === 'firetornado'));
  s.addWeapon('shotgun'); s.ab.bounce = 1; S.step(s, 0.6); assert(s.combos.has('pinball'), 'a weapon + an ability');
  s.ab.drone = 1; s.kits = 1; s.useTurret(); S.step(s, 0.6); assert(s.combos.has('flyturret'), 'used gear + an ability');
  assert(AR.COMBOS.length >= 8 && AR.COMBOS.every((c) => c.need.length === 2));
  s.applyPickup('minigun'); assert(!s.tcombo); s.applyPickup('rockets'); assert.equal(s.tcombo.name, 'Rocket Minigun'); S.step(s, 10.5); assert(!s.tcombo, 'it ends with the rockets');
});
test('weapon carriers: some zombies hold a timed super weapon (same on every phone); kill one and it drops for you', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 8, run: 1 } }); s.p.inv = 1e9;
  let carriers = 0, elites = 0; for (let i = 0; i < 400; i++) { const z = s.makeZ('walker', 100, 100); if (z.carry) carriers++; if (z.elite) elites++; } s.z.length = 0;
  assert(carriers > 4 && carriers < 30, 'a few carriers: ' + carriers); assert(elites > 2 && elites < 25, 'a few elites: ' + elites);
  const z = s.makeZ('walker', s.p.x + 200, s.p.y); z.carry = 'raygun'; s.pk.length = 0; s.damageZ(z, 1e9, 'me'); assert(s.pk.some((p) => p.k === 'raygun'), 'it drops the ray gun');
  s.area.obstacles.length = 0; // (a clear line of fire, whatever this block's props are)
  s.applyPickup('raygun'); s.spawnOne('walker'); const q = s.z[s.z.length - 1]; q.x = s.p.x + 300; q.y = s.p.y; q.hp = q.mhp = 1e6; S.step(s, 1); assert(q.hp < 1e6, 'the ray gun fires');
  const w1 = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 1, run: 1 } }); for (let i = 0; i < 200; i++) assert(!w1.makeZ('walker', 1, 1).carry, 'not on the first waves');
});
test('classes: six base survivors (plus four unlockable ones) with a passive and starting kit; their cards lean their way', () => {
  const S = sandbox(), mk1 = (c) => { const s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 2, run: 1 } }); s.setClass(c); return s; };
  assert.equal(Object.values(AR.CLASSES).filter((c) => !c.locked).length, 6); assert.equal(Object.values(AR.CLASSES).filter((c) => c.locked).length, 4);
  const base = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 2, run: 1 } }).S;
  assert.equal(mk1('demo').bombs, 2); assert.equal(mk1('tinker').kits, 2); const b = mk1('brawler'); assert(b.weapons.some((w) => w.id === 'bat') && b.S.mhp > base.mhp);
  assert(mk1('sharp').S.crit > base.crit); assert(mk1('medic').S.regen > base.regen); assert(mk1('scav').cashMul > 1.5);
  const s = mk1('medic'); assert.equal(s.setClass('demo'), false, 'one class per run'); assert(S.reports.some((r) => r.k === 'class' && r.id === 'medic'));
  let hits = 0; for (let i = 0; i < 200; i++) { s.cards = null; s.offerCards(); if (s.cards.some((c) => AR.CLASSES.medic.bias.includes(c))) hits++; } s.cards = null; s.choosing = false; s.paused = false;
  assert(hits > 90, 'medic cards lean to healing: ' + hits);
});
test('items: trade-offs that stack; lock one for the next visit; rerolling costs more each time', () => {
  const S = sandbox(), s = at(S, 'market', 3); s.cash = 5000;
  const St = s.stockOf(); assert(St.items.length >= 2); const id = St.items[0], d0 = s.S.dmg, sp0 = s.S.speed;
  s.items.boots = 1; s.stats(); assert(s.S.dmg > d0 && s.S.speed < sp0, 'Lead Boots: harder hits, slower feet'); delete s.items.boots; s.stats();
  assert(s.buyItem(id).ok); assert.equal(s.items[id], 1); assert.equal(s.buyItem(id).ok, false, 'sold');
  const other = St.items[1]; assert(s.lockItem(other)); const c1 = s.cash; assert(s.rerollShop().ok); assert.equal(c1 - s.cash, 10); assert(St.items.includes(other), 'the locked one stays');
  const c2 = s.cash; s.rerollShop(); assert.equal(c2 - s.cash, 20, 'reroll price doubles');
  s.wave++; s.stocks = {}; const St2 = s.stockOf(); assert(St2.items.includes(other), 'locked for the next visit');
  assert(Object.keys(AR.ITEMS).length >= 10 && Object.values(AR.ITEMS).some((i) => i.rar === 'legendary'));
  const t = at(S, 'gunsmith'); const G = t.stockOf(); assert(G.weapons.length >= 1 && G.weapons.every((w) => ['rare', 'epic'].includes(AR.WEAPONS[w].rar)), 'the gunsmith sells better guns');
});
test('debuffs: short, at most two at once, a little immunity after; blind / zoom / web / jam / dizzy / leech / sludge / rattle; cleansed at the clinic', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 12, run: 1 } }); s.p.inv = 0; s.buffs.shield = 0; s.cleared = true; s.events.length = 0;
  assert(s.applyDebuff('confuse')); assert(s.applyDebuff('jam')); assert.equal(s.applyDebuff('web'), false, 'cap of 2');
  const x0 = s.p.x; S.step(s, 0.5, { mx: 1 }); assert(s.p.x < x0, 'dizzy: controls reversed');
  const r0 = s.p.fireCd; void r0; S.step(s, 0.02); assert.equal(s.rateMul, 0.4, 'jammed: slow fire');
  S.step(s, 5.2); assert(!s.debuffs.confuse && !s.debuffs.jam, 'short'); assert.equal(s.applyDebuff('confuse'), false, 'immune for a moment'); S.step(s, 4.2); assert(s.applyDebuff('confuse'));
  assert(s.cleanse()); assert.equal(Object.keys(s.debuffs).length, 0);
  s.immune = {}; assert(s.applyDebuff('web')); const x1 = s.p.x; S.step(s, 0.3, { mx: 1 }); assert(Math.abs(s.p.x - x1) < 12, 'webbed: stuck');
  for (let i = 0; i < 20 && s.debuffs.web; i++) S.step(s, 0.05, { mx: i % 2 ? 1 : -1 }); assert(!s.debuffs.web, 'wiggle free');
  s.immune = {}; assert(s.applyDebuff('zoom')); const z1 = s.zoomStep(1); assert(z1 < 1, 'squinting: the camera closes in');
  s.immune = {}; s.cleanse(); s.z.length = 0; s.cleared = true; s.cash = 50; s.xp = 10; s.coins.length = 0; s.gems.length = 0; assert(s.applyDebuff('leech')); S.step(s, 2); assert(s.cash < 50 && s.xp < 10, 'leeched');
  s.cleanse(); s.immune = {}; s.buffs.shield = 5; assert.equal(s.applyDebuff('blind'), false, 'not through a bubble shield'); s.buffs.shield = 0;
  // the zombies do it: a Spinner's pulse, a Gunk Jammer's touch, an Inkspitter's shot, Sludge puddles, the clinic cleanses
  const t = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 12, run: 1 } }); t.p.inv = 0; t.buffs.shield = 0; t.p.hp = t.S.mhp = 1e6;
  const sp = t.makeZ('confuser', t.p.x + 100, t.p.y); sp.pt = 0; sp.speed = 0; S.step(t, 0.05); assert(t.debuffs.confuse > 0, 'spinner pulse');
  t.cleanse(); t.immune = {}; t.z.length = 0; const j = t.makeZ('jammer', t.p.x + 10, t.p.y); j.speed = 0; t.p.inv = 0; S.step(t, 0.05); assert(t.debuffs.jam > 0, 'jammer touch'); t.z.length = 0;
  t.cleanse(); t.immune = {}; t.p.inv = 0; t.spit.push({ x: t.p.x, y: t.p.y - 20, vx: 0, vy: 0, life: 1, dmg: 1, debuff: 'blind' }); S.step(t, 0.05); assert(t.debuffs.blind > 0, 'ink hits');
  t.cleanse(); t.immune = {}; t.p.inv = 0; t.puddles.push({ x: t.p.x, y: t.p.y, r: 60, t: 0, life: 5 }); S.step(t, 0.05); assert(t.debuffs.sludge > 0, 'sludge puddle');
  const c = at(S, 'clinic'); c.cash = 99; c.applyDebuff('jam'); c.stocks[c.cellKey() + ':clinic'] = { wave: c.wave, type: 'clinic', list: ['antidote'], sold: {}, extra: true, weapons: [], items: [] }; assert(c.buy('antidote').ok); assert(!c.debuffs.jam, 'antidote');
  const ds = new Set(Object.values(W.ZOMBIES).map((z) => z.debuff).filter(Boolean)); assert.equal(ds.size, 8, 'a zombie for every debuff');
  assert(W.waveSpec(5, 1).weights.every(([k]) => !W.ZOMBIES[k].debuff), 'none early'); assert(W.waveSpec(14, 1).weights.filter(([k]) => W.ZOMBIES[k].debuff).length >= 6, 'later waves bring them');
});
test('new zombies: gas-bags blow up next to you, riot shields block from the front, brutes rage, nests spawn crawlers; mini-bosses on later boss waves', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 12, run: 1 } }); s.p.inv = 0; s.buffs.shield = 0; s.p.hp = 1e5; s.S.mhp = 1e5;
  const e = s.makeZ('exploder', s.p.x + 30, s.p.y); const hp = s.p.hp; S.step(s, 0.1); assert(e.hp <= 0 && s.p.hp < hp, 'boom'); s.p.inv = 1e9;
  const r = s.makeZ('riot', s.p.x + 200, s.p.y); r.face = -1; r.hp = r.mhp = 1000; s.damageZ(r, 100, 'me', 140, 0); assert.equal(r.hp, 980, 'shot from the front: 20%'); s.damageZ(r, 100, 'me', -140, 0); assert.equal(r.hp, 880, 'from behind: full');
  const b = s.makeZ('brute', s.p.x + 300, s.p.y); const sp = b.speed; s.damageZ(b, 1, 'me', 10, 0); assert(b.speed > sp * 1.5, 'enraged');
  s.z = s.z.filter((z) => z.type === 'nest'); const n = s.makeZ('nest', s.p.x + 400, s.p.y); n.hp = n.mhp = 1e6; const before = s.z.length; S.step(s, 3.2); assert(s.z.filter((z) => z.type === 'crawler').length >= 2 || s.z.length > before, 'a nest makes crawlers');
  const b10 = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 10, run: 1 } }); b10.p.inv = 1e9; assert(b10.spec.mini && b10.bossDue); b10.waveKills = b10.spec.target; const z = b10.spawnOne('boss'); assert(z.mb && W.ZOMBIES[z.mb].mini, 'a mini-boss: ' + z.mb);
  assert(['spider', 'foghorn', 'toxic'].every((k) => ST.BOSSES[k]), 'and they can be the final boss too');
});
test('slow motion (solo only), area events (gas leak, supply drop, cash grab, car alarm), weapon drops and crucible cores', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 6, run: 1 } }); s.p.inv = 1e9; s.area.obstacles.length = 0; // (no props in the way, whatever this block looks like)
  s.slowMo(0.5); assert(s.slowmo > 0); const t0 = s.t; S.step(s, 0.2); assert(s.t - t0 < 0.15, 'time slows'); s.mode = 'host'; s.slowmo = 0; s.slowMo(0.5); assert.equal(s.slowmo, 0, 'never in co-op'); s.mode = 'solo';
  s.startEvent('gas'); const g = s.events[s.events.length - 1]; for (let i = 0; i < 5; i++) { const z = s.makeZ('walker', g.x + i * 10, g.y + 60); z.hp = z.mhp = 50; } s.b.push({ x: g.x, y: g.y - 70, vx: 0, vy: 0, r: 4, dmg: 1, pierce: 0, bounce: 0, life: 0.3, hit: null, burn: 0 }); S.step(s, 0.1); assert(g.lit, 'shooting the gas lights it'); assert(s.z.filter((z) => z.hp > 0).length < 5);
  s.startEvent('drop'); const d = s.events[s.events.length - 1]; S.step(s, 7.2); s.p.x = d.x; s.p.y = d.y; const c0 = s.cash; S.step(s, 0.1); assert(s.cash > c0, 'supplies');
  s.coins.length = 0; s.startEvent('cash'); assert(s.coins.length >= 30); const grab = s.coins.slice(), cev = s.events[s.events.length - 1]; S.step(s, 15.5); for (let i = 0; i < 30 && s.events.includes(cev); i++) S.step(s, 1); // (slow motion stretches it a little) assert(!s.coins.some((c) => grab.includes(c)), 'cash grab ends (another one may have started since)');
  const a = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 6, run: 1 } }); a.p.inv = 1e9; a.startEvent('alarm'); const n0 = a.spec.target; S.step(a, 4.5); assert(a.spec.target > n0, 'the alarm brings more');
  const k = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 5, run: 1 } }); k.p.inv = 1e9; const bz = k.spawnOne('boss'); k.damageZ(bz, 1e9, 'me'); assert(k.drops.some((q) => q.k === 'core'), 'bosses drop crucible cores'); const q = k.drops.find((x) => x.k === 'core'); k.p.x = q.x; k.p.y = q.y + 20; S.step(k, 0.1); assert.equal(k.cores, 1);
});
test('server: classes, combos, upgrades and evolutions reach the feed and the TV; weapon summaries are checked', () => {
  const { room, clock, ps: [a] } = mk({}, 1); room.start(); const g = room.game; run(room, clock, 1500);
  assert(room.act(a, { op: 'ev', k: 'class', id: 'medic' }).ok); assert.equal(g.runs.get(a.id).cls, 'medic'); assert.equal(room.act(a, { op: 'ev', k: 'class', id: 'nope' }).ok, false);
  assert(room.act(a, { op: 'ev', k: 'combo', id: 'arcnails' }).ok); assert(g.feed.some((f) => /Arc Nails/.test(f.text))); assert(room.fxLog.some((f) => f.kind === 'tzcombo'));
  assert(room.act(a, { op: 'ev', k: 'evolve', id: 'pistol', tier: 3 }).ok); assert(g.feed.some((f) => /Golden Hand-Cannon/.test(f.text))); assert(room.fxLog.some((f) => f.kind === 'tzevolve'));
  room.act(a, { op: 'st', kills: 5, lvl: 2, hp: 90, mhp: 100, wave: 1, wp: [['pistol', 3, 1], ['smg', 99, 7], ['bogus', 1, 1]] });
  assert.deepEqual(g.runs.get(a.id).wp, [['pistol', 3, 1], ['smg', 10, 3]]); const t = g.tv().players[0]; assert.equal(t.cls, 'medic'); assert.equal(t.wp.length, 2);
});

// ---------------- C: phase 3 (unlocks, Garage Defense, helpers, the TV, vehicles, survivors, weather, new bosses, run save) ----------------
const X = require('../public/box/games/trash-extra');
const os = require('os');
const { BoxProfileStore } = require('../box/profiles');
const mkProf = (settings = {}, n = 2, file = null) => {
  const clock = new VirtualClock(), profiles = new BoxProfileStore(file), room = new BoxRoom('TEST', def, { clock, seed: 7, profiles });
  const ps = []; for (let i = 0; i < n; i++) { const p = room.join(['Ana', 'Ben', 'Cy', 'Dee'][i]).player; p.sockets = 1; p.profileId = profiles.create(p.name).id; ps.push(p); }
  Object.assign(room.settings, { mode: 'endless' }, settings);
  return { clock, room, ps, profiles };
};
test('unlocks: scrap is paid at the end of the night and kept on the profile file; buying + picking a loadout survives a restart', () => {
  const file = path.join(os.tmpdir(), 'tz-prof-' + process.pid + '-' + Date.now() + '.json');
  try {
    const { room, clock, ps: [a], profiles } = mkProf({}, 1, file); room.start(); const g = room.game; run(room, clock, 2000);
    room.act(a, { op: 'st', kills: 40, lvl: 4, hp: 90, mhp: 100, wave: 1 });
    assert.equal(def.metaView(room, a).scrap, 0); g.end('host');
    const R = g.runs.get(a.id); assert(R.scrap > 0, 'scrap paid: ' + R.scrap); assert.equal(def.metaView(room, a).scrap, R.scrap); assert(g.view(a).me.scrap === R.scrap); assert(g.feed.some((f) => /scrap/.test(f.text)));
    g.end('host'); assert.equal(def.metaView(room, a).scrap, R.scrap, 'paid once');
    profiles.data.profiles[a.profileId].trash.scrap = 1000;
    assert.equal(room.act(a, { op: 'meta', k: 'buy', id: 'tier:apocalypse' }).ok, false, 'apocalypse needs nightmare first');
    for (const id of ['cls:sparky', 'wp:crossbow', 'fit:crown', 'tier:nightmare']) assert(room.act(a, { op: 'meta', k: 'buy', id }).ok, id);
    assert.equal(room.act(a, { op: 'meta', k: 'buy', id: 'wp:crossbow' }).ok, false, 'only once');
    assert.equal(room.act(a, { op: 'meta', k: 'pick', slot: 'wp', id: 'smg' }).ok, false, 'not owned');
    assert(room.act(a, { op: 'meta', k: 'pick', slot: 'fit', id: 'crown' }).ok);
    const M = def.metaView(room, a); assert.equal(M.scrap, 1000 - 120 - 150 - 120 - 200); assert.deepEqual(M.pick, { cls: null, wp: 'crossbow', fit: 'crown', tier: 'nightmare' });
    assert(room.playerState(a).meta && room.playerState(a).meta.own.includes('cls:sparky'), 'the phone sees it (lobby too)');
    profiles.save(); const again = new BoxProfileStore(file), M2 = again.get(a.profileId).trash; assert.deepEqual(M2.own.sort(), ['cls:sparky', 'fit:crown', 'tier:nightmare', 'wp:crossbow']); assert.equal(M2.scrap, M.scrap, 'kept in the .data file');
    // the next night: the loadout reaches the phone; the unlocked class is allowed
    const room2 = new BoxRoom('TES2', def, { clock: new VirtualClock(), seed: 9, profiles: again }), b = room2.join('Ana').player; b.sockets = 1; b.profileId = a.profileId; room2.settings.mode = 'endless'; room2.start();
    const L = room2.game.view(b).me.load; assert.equal(L.wp, 'crossbow'); assert.equal(L.fit, 'crown'); assert.equal(L.tier, 'nightmare'); assert.deepEqual(L.classes, ['sparky']);
    assert(room2.act(b, { op: 'ev', k: 'class', id: 'sparky' }).ok);
    const c = room2.join('Cy').player; c.sockets = 1; assert.equal(room2.act(c, { op: 'ev', k: 'class', id: 'chef' }).ok, false, 'a locked class needs the unlock');
    assert.equal(room2.act(c, { op: 'meta', k: 'buy', id: 'fit:cone' }).ok, false, 'no profile, no scrap');
  } finally { try { fs.unlinkSync(file); } catch { /* gone */ } }
  // the phone: the loadout starts the run with the weapon, the outfit and a harder tier
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1, load: { wp: 'crossbow', fit: 'crown', tier: 'nightmare', classes: ['sparky'] } } });
  assert(s.weapons.some((w) => w.id === 'crossbow')); assert.equal(s.fit, 'crown'); const z = s.makeZ('walker', 100, 100), n = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }).makeZ('walker', 100, 100); assert(z.mhp > n.mhp * 1.3, 'nightmare zombies are tougher');
  assert(s.setClass('sparky') && s.weapons.some((w) => w.id === 'coil'), 'the Electrician starts with the coil'); assert.equal(n.mhp > 0, true);
  const t = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); assert.equal(t.setClass('janitor'), false, 'locked without the unlock');
});
test('Party Mode: no unlocks and no scrap (everyone starts equal)', () => {
  const { room, ps: [a, b], profiles } = mkProf({ mode: 'score', length: 'm10' }, 2);
  for (const p of [a, b]) { const M = profiles.get(p.profileId); M.trash = { ...X.blankMeta(), scrap: 0, own: ['cls:chef', 'wp:shotgun', 'fit:cone', 'tier:nightmare'], pick: { cls: null, wp: 'shotgun', fit: 'cone', tier: 'nightmare' } }; }
  room.partyMode = { defs: [room.def], index: 0, plan: { trash: 5 }, phase: 'playing' }; room.start(); const g = room.game;
  assert.equal(g.party, true); assert.equal(g.view(a).me.load, null, 'no loadout'); assert.equal(g.view(a).party, true);
  assert.equal(room.act(a, { op: 'ev', k: 'class', id: 'chef' }).ok, false, 'no unlocked classes either');
  g.runs.get(a.id).kills = 300; g.end('time'); assert.equal(g.runs.get(a.id).scrap, undefined); assert.equal(profiles.get(a.profileId).trash.scrap, 0, 'no scrap in Party Mode');
  assert(!g.feed.some((f) => /scrap/.test(f.text)));
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1, load: null } }); assert.equal(s.weapons.length, 0); assert.equal(s.fit, null); assert.equal(s.tier, 'normal');
});
test('Garage Defense: wave 5 pulls everyone home to build; the horde comes; held doors score, broken ones cost hope; no hope = over', () => {
  assert(def.fields.find((f) => f.key === 'mode').options.some((o) => o.value === 'garage'), 'in the lobby with the other modes');
  const { room, clock, ps: [a, b] } = mk({ mode: 'garage' }, 2); room.start(); const g = room.game; run(room, clock, 1500);
  assert.equal(g.gd.phase, 'explore'); assert.equal(g.tv().garage.next, 5);
  const Ra = g.runs.get(a.id); walkTo(room, a, roadNb(g, Ra.home)); assert.notDeepEqual(Ra.cell, Ra.home);
  for (let w = 2; w <= 5; w++) { run(room, clock, 1100); room.act(a, { op: 'st', kills: 10 * w, lvl: 2, hp: 90, mhp: 100, wave: w }); Ra.areas = 9; }
  assert.equal(g.gd.phase, 'build'); assert.equal(g.gd.night, 1); assert.deepEqual(Ra.cell, Ra.home, 'pulled back home'); assert(g.feed.some((f) => /HORDE NIGHT 1/.test(f.text)));
  assert.equal(room.act(a, { op: 'enter', x: Ra.cell[0] + 1, y: Ra.cell[1] }).ok, false, 'no wandering off on a horde night');
  assert(room.act(a, { op: 'ready' }).ok); assert.equal(g.gd.phase, 'build', 'waiting for Ben'); assert(room.act(b, { op: 'ready' }).ok); assert.equal(g.gd.phase, 'horde'); assert(g.tv().card, 'the TV shows the horde card');
  const r1 = room.act(a, { op: 'hordeend', ok: true, door: 0.8 }); assert(r1.ok && r1.bonus === X.hordeBonus(1, 0.8)); assert.equal(Ra.nights, 1);
  assert(room.act(b, { op: 'hordeend', ok: false }).ok); assert.equal(g.gd.hope, 2); assert(g.feed.some((f) => /door broke/.test(f.text)));
  assert.equal(g.gd.phase, 'explore', 'everyone done: dawn'); assert.equal(g.gd.next, 10); assert(g.recap && /Night 1/.test(g.recap.title), 'the TV recap between nights');
  // the build timer runs out by itself
  Ra.wave = 10; run(room, clock, 1100); room.act(a, { op: 'st', kills: 120, lvl: 3, hp: 90, mhp: 100, wave: 10 }); assert.equal(g.gd.phase, 'build'); run(room, clock, X.GARAGE.buildMs + 1500); assert.equal(g.gd.phase, 'horde');
  room.act(a, { op: 'hordeend', ok: false }); room.act(b, { op: 'hordeend', ok: false }); assert.equal(g.phase, 'over'); assert.equal(g.overWhy, 'overrun');
  // score decides the standings
  const h = mk({ mode: 'garage' }, 2); h.room.start(); h.room.game.runs.get(h.ps[0].id).score = 10; h.room.game.runs.get(h.ps[1].id).score = 900; h.room.game.runs.get(h.ps[0].id).wave = 9; assert.equal(h.room.game.standings()[0].id, h.ps[1].id);
});
test('Garage Defense on the phone: barricades, turrets, spikes, flamers and decoys; the door takes hits; a held door scores; a broken door reports', () => {
  const S = sandbox(), s = S.make({ settings: { mode: 'garage' }, restore: { cell: [2, 2], home: [4, 4], wave: 5, run: 1 } }); s.p.inv = 1e9; s.cash = 2000;
  s.setGarage({ phase: 'build', night: 1, endsIn: 40000, hope: 3, max: 3, next: 5, ready: [] });
  assert.equal(s.cell.join(), '4,4'); assert(s.area.garage && s.build && s.cleared); assert.equal(s.z.length, 0); assert.equal(s.exitOpen('s') || s.exitOpen('n') || s.exitOpen('e') || s.exitOpen('w'), false, 'exits shut');
  const c0 = s.cash; for (const k of ['barricade', 'turret', 'spikes', 'flamer', 'decoy']) { s.p.x += 60; assert(s.buildBuy(k).ok, k); }
  assert.equal(c0 - s.cash, ['barricade', 'turret', 'spikes', 'flamer', 'decoy'].reduce((t, k) => t + X.buildCost(k, 1), 0)); assert.equal(s.buildBuy('repair').ok, false, 'the door is fine');
  const bar = s.area.obstacles.find((o) => o.bar); assert(bar && bar.low, 'a low wall'); assert(s.turrets.some((T) => T.night)); assert(S.reports.filter((r) => r.k === 'build').length === 5);
  s.cash = 0; assert.equal(s.buildBuy('barricade').ok, false);
  // bullets fly over barricades
  s.b.length = 0; s.b.push({ x: bar.x - 5, y: bar.y + bar.h / 2, vx: 900, vy: 0, r: 5, dmg: 1, crit: false, pierce: 0, bounce: 0, life: 0.8, hit: null, burn: 0 }); s.bulletStep(0.02); assert.equal(s.b.length, 1, 'not stopped by the barricade');
  s.setGarage({ phase: 'horde', night: 1, endsIn: 200000, hope: 3, max: 3 }); assert(s.hordeS && !s.cleared && s.spec.target === X.hordeSize(1, 1));
  const D = s.build.door, z = s.makeZ('walker', D.x, D.y + 20); z.speed = 0; const hp0 = D.hp; S.step(s, 1); assert(D.hp < hp0, 'zombies at the door hurt it');
  const sp = s.build.items.find((it) => it.k === 'spikes'), z2 = s.makeZ('walker', sp.x, sp.y); z2.speed = 0; const zh = z2.hp; S.step(s, 0.3); assert(z2.hp < zh || z2.hp <= 0, 'spikes shred');
  const dc = s.build.items.find((it) => it.k === 'decoy'), z3 = s.makeZ('walker', dc.x + 300, dc.y); assert.equal(s.pickTarget(z3, s.p, 1), dc, 'the car alarm pulls zombies in');
  // held: kill the rest
  s.z.length = 0; s.waveKills = s.spec.target; s.bossDue = false; const sc = s.score; S.step(s, 0.2);
  assert(s.hordeS.done && s.score > sc); const he = S.reports.find((r) => r.op === 'hordeend'); assert(he && he.ok === true && he.door > 0);
  s.setGarage({ phase: 'explore', night: 1, next: 10, hope: 3 }); assert(!s.build && !s.area.obstacles.some((o) => o.bar) && !s.turrets.some((T) => T.night) && s.cleared, 'dawn clears the yard');
  // broken
  const S2 = sandbox(), t = S2.make({ settings: { mode: 'garage' }, restore: { cell: [4, 4], home: [4, 4], wave: 5, run: 1 } }); t.p.inv = 1e9; t.phase = 'play'; t.cash = 100;
  t.setGarage({ phase: 'horde', night: 2, endsIn: 200000, hope: 3, max: 3 }); assert(t.build && t.hordeS); t.build.door.hp = 1; const zz = t.makeZ('brute', t.build.door.x, t.build.door.y + 10); zz.speed = 0; S2.step(t, 0.5);
  assert(t.hordeS.failed && t.cash === 70, 'raided'); assert(S2.reports.some((r) => r.op === 'hordeend' && r.ok === false));
});
test('helpers: down or out players (and watchers) drop crates, vote on the next event and send hordes at the leader, with energy + cooldowns', () => {
  const { room, clock, ps: [a, b, c] } = mk({ mode: 'score', length: 'm10' }, 3); room.start(); const g = room.game; run(room, clock, 1500);
  assert.equal(room.act(a, { op: 'help', k: 'crate', to: b.id }).ok, false, 'only while down or out');
  room.act(a, { op: 'ev', k: 'dead' }); assert(g.view(a).me.helper, 'a dead player gets the helper panel'); assert.equal(g.view(b).me.helper, null);
  const e0 = g.view(a).me.helper.e; assert(e0 >= X.HELP.crate.cost);
  const r = room.act(a, { op: 'help', k: 'crate', to: b.id }); assert(r.ok, r.error); assert.equal(g.view(a).me.helper.e, Math.floor(e0 - X.HELP.crate.cost));
  assert.equal(g.view(b).me.gifts.slice(-1)[0].kind, 'crate'); assert(g.feed.some((f) => /supply crate/.test(f.text)));
  assert(/Next crate in/.test(room.act(a, { op: 'help', k: 'crate', to: c.id }).error), 'cooldown');
  run(room, clock, X.HELP.crate.cd + 500); assert(room.act(a, { op: 'help', k: 'crate', to: c.id }).ok); const H = g.helpers.get('p:' + a.id); H.e = 5; run(room, clock, X.HELP.crate.cd + 100); H.e = 5; H.at = room.now();
  assert(/needs/.test(room.act(a, { op: 'help', k: 'crate', to: b.id }).error), 'energy runs out'); H.e = 100;
  assert.equal(room.act(a, { op: 'help', k: 'crate', to: a.id }).ok, false, 'not yourself');
  // the leader gets a horde (score attack only), with a cooldown on the leader too
  g.runs.get(b.id).score = 5000; g.runs.get(c.id).score = 100;
  assert(room.act(a, { op: 'help', k: 'horde' }).ok); assert.equal(g.view(b).me.gifts.slice(-1)[0].kind, 'horde'); assert(g.view(b).me.gifts.slice(-1)[0].cnt >= 6);
  H.e = 100; H.hordeAt = -1e9; assert(/just got one/.test(room.act(a, { op: 'help', k: 'horde' }).error), 'the leader gets a breather');
  // the vote
  g.lastPollAt = -1e12; run(room, clock, 1100); assert(g.poll, 'a vote opens while there are helpers'); const opt = g.poll.opts[0]; H.e = 100;
  assert(room.act(a, { op: 'help', k: 'vote', ev: opt }).ok); assert.equal(room.act(a, { op: 'help', k: 'vote', ev: opt }).ok, false, 'one vote');
  assert.equal(g.view(a).poll.mine, opt); run(room, clock, X.HELP.pollMs + 1200); assert(!g.poll && g.nextEv && g.nextEv.k === opt, 'the vote decides the next event'); assert.equal(g.view(b).nextEv.k, opt);
  // a watcher on a phone helps too
  const au = room.joinAudience('Watcher').member; au.sockets = 1; assert(room.audienceState().gv && room.audienceState().gv.players.length === 3, 'the audience sees the helper panel');
  const ar = room.audienceAct(au, { k: 'state' }); assert(ar.ok && ar.me.e === X.HELP.start); assert(room.audienceAct(au, { k: 'crate', to: c.id }).ok); assert.equal(g.view(c).me.gifts.slice(-1)[0].from, 'Watcher');
  // not in other modes
  const e = mk({ mode: 'endless' }, 2); e.room.start(); e.room.act(e.ps[0], { op: 'ev', k: 'dead' }); assert(/Score attack/.test(e.room.act(e.ps[0], { op: 'help', k: 'horde' }).error));
  // the phone: gifts arrive, the crate lands, the horde spawns, the voted event starts the next wave
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); s.p.inv = 1e9;
  s.setWorld({ me: { gifts: [{ n: 1, kind: 'crate' }] }, nextEv: null }); assert.equal(s.crates.length, 0, 'old gifts are not replayed');
  s.setWorld({ me: { gifts: [{ n: 1, kind: 'crate' }, { n: 2, kind: 'crate', from: 'Dee' }, { n: 3, kind: 'horde', cnt: 7, from: 'Dee' }] }, nextEv: { n: 4, k: 'drop' } });
  assert.equal(s.crates.length, 1); assert(s.z.filter((q) => q.sent).length >= 6, 'the horde shows up');
  const cr = s.crates[0]; cr.t = cr.land; s.p.x = cr.x; s.p.y = cr.y + 20; const cash = s.cash; S.step(s, 0.1); assert(s.cash > cash && !s.crates.length, 'crate: cash + health + a power-up');
  s.events.length = 0; s.startWave(); assert(s.events.some((q) => q.k === 'drop'), 'the voted event'); assert.equal(s.pendingEv, null);
});
test('the TV: a live kill feed, a ranked leaderboard, boss intro cards, highlight moments and the recap; the spotlight follows whoever is in trouble', () => {
  const { room, clock, ps: [a, b] } = mk({ mode: 'score', length: 'm10' }, 2); room.start(); const g = room.game; run(room, clock, 1500);
  const ZT = Object.keys(W.ZOMBIES);
  room.act(a, { op: 'st', kills: 9, lvl: 2, hp: 90, mhp: 100, wave: 1, score: 400, kf: [[ZT.indexOf('runner'), 6, 0, 0], [0, 3, 0, 0]] });
  const t = g.tv(); assert(t.kfeed.length === 1 && /9 zombies/.test(t.kfeed[0].text) && /Sprinters/.test(t.kfeed[0].text), JSON.stringify(t.kfeed));
  room.act(a, { op: 'st', kills: 10, lvl: 2, hp: 90, mhp: 100, wave: 1, kf: [['x', 'y'], [999, 5]] }); assert.equal(g.tv().kfeed.length, 1, 'junk is ignored');
  assert(room.act(a, { op: 'ev', k: 'boss', id: 'icecream' }).ok); const card = g.tv().card; assert.equal(card.key, 'icecream'); assert.equal(card.name, ST.BOSSES.icecream.name); assert(room.fxLog.some((f) => f.kind === 'tzcard' && f.key === 'icecream'));
  run(room, clock, 6500); assert.equal(g.tv().card, null, 'the card goes away');
  room.act(a, { op: 'ev', k: 'multi', n: 4 }); room.act(a, { op: 'ev', k: 'multi', n: 7 }); room.act(b, { op: 'ev', k: 'bossdown', id: 'compactor' });
  assert.equal(g.moments.filter((m) => m.kind === 'multi').length, 1, 'one chain, one moment'); assert.equal(g.moments.find((m) => m.kind === 'multi').value, 7);
  assert(g.tv().kfeed.some((k) => /The Big Crunch/.test(k.text)));
  run(room, clock, 4 * 60000); assert(g.recapSeq >= 1 && g.lastRecap.m.kind === 'boss', 'the recap shows the best moment (a boss kill beats a x7)'); assert(room.fxLog.some((f) => f.kind === 'tzrecap'));
  // the spotlight
  assert.equal(g.tv().spot, null); room.act(b, { op: 'st', kills: 12, lvl: 2, hp: 20, mhp: 100, wave: 1 }); run(room, clock, 1100);
  assert.equal(g.tv().spot.id, b.id); assert.equal(g.view(b).me.spot, true); assert(g.outbox.some((m) => m.to === b.id && m.data.t === 'spot' && m.data.on));
  g.outbox.length = 0; assert.equal(g.live(b, { t: 'tv', c: [1, 1], you: [1, 2], z: [] }), true); assert(g.outbox.some((m) => m.to === 'tv' && m.data.from === b.id), 'its phone streams to the TV');
  assert.equal(g.live(a, { t: 'tv', c: [1, 1], you: [1, 2], z: [] }), false, 'nobody else can');
  room.act(a, { op: 'st', kills: 14, lvl: 2, hp: 5, mhp: 100, wave: 1 }); run(room, clock, 1100); assert.equal(g.tv().spot.id, b.id, 'no flicker');
  room.act(b, { op: 'st', kills: 14, lvl: 2, hp: 95, mhp: 100, wave: 1 }); run(room, clock, 5000); assert.equal(g.tv().spot.id, a.id, 'then the next one in trouble');
  const st = g.standings(); assert(st[0].score >= st[1].score);
});
test('vehicles: get in and out cleanly, carts are fast, mowers chew, zombies hit the ride (and a crowd stops it); the garbage truck is a rare timed power-up', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); s.phase = 'play'; s.z.length = 0; s.cleared = true;
  let found = 0; for (let x = 0; x < 9; x++) for (let y = 0; y < 9; y++) if (X.vehicleAt(42, x, y, [[4, 4]])) found++; assert(found >= 6 && found <= 50, 'parked rides around town: ' + found); assert.equal(X.vehicleAt(42, 4, 4, [[4, 4]]), null, 'not in a garage');
  s.parked = { kind: 'cart', x: s.p.x + 300, y: s.p.y, hp: 140, mhp: 140, face: 1 }; assert.equal(s.nearVehicle(), null, 'too far'); assert.equal(s.toggleRide(), false);
  s.p.x = s.parked.x - 40; assert(s.nearVehicle()); assert.equal(s.toggleRide(), 'in'); assert(s.ride && !s.parked); assert(S.reports.some((r) => r.k === 'ride' && r.id === 'cart'));
  S.step(s, 0.1, { mx: 1 }); assert(s.speedMul > 1.5, 'the cart is fast: x' + s.speedMul); s.toggleRide(); S.step(s, 0.1, { mx: -1 }); assert.equal(s.speedMul, 1, 'on foot again');
  assert(!s.ride && s.parked && s.parked.kind === 'cart', 'out: it stays parked');
  s.p.x = s.parked.x; s.p.y = s.parked.y; s.toggleRide(); s.p.inv = 0; s.buffs.shield = 0; const hp = s.p.hp, vhp = s.ride.hp; s.hurt(30); assert.equal(s.p.hp, hp, 'the ride takes the hit'); assert(s.ride.hp < vhp);
  for (let i = 0; i < 4; i++) s.makeZ('walker', s.p.x + 10 * i, s.p.y); s.speedMul = 1; s.rideStep(0.016); assert.equal(s.ride.stuck, 4); assert(s.speedMul < 0.4, 'a crowd stops it');
  s.z.length = 0; s.p.inv = 0; s.ride.hp = 5; s.hurt(30); assert(!s.ride && s.wrecked[s.cellKey()], 'wrecked'); assert(S.events.some((e) => e[0] === 'wreck'));
  // the mower
  s.set.aim = 'off'; s.parked = { kind: 'mower', x: s.p.x, y: s.p.y, hp: 220, mhp: 220, face: 1 }; s.p.inv = 1e9; s.toggleRide(); const z = s.makeZ('canhead', s.p.x + 30, s.p.y); z.speed = 0; const zh = z.hp; S.step(s, 0.5); assert(z.hp < zh, 'the blades chew'); s.toggleRide();
  // the garbage truck
  s.applyPickup('truck'); assert.equal(s.ride.kind, 'gtruck'); assert(s.buffs.truck > 10); S.step(s, 3); assert(s.ride.time < 13); assert.equal(s.toggleRide(), 'out'); assert.equal(s.buffs.truck, 0, 'out of the truck: no ramming'); assert.equal(s.parked.kind, 'gtruck');
  s.p.x = s.parked.x; s.p.y = s.parked.y; s.toggleRide(); s.ride.time = 0.1; S.step(s, 0.3); assert(!s.ride && !s.buffs.truck, 'time’s up: it drives off');
  let trucks = 0; for (let i = 0; i < 400; i++) { s.pk.length = 0; s.dropPickup(400, 400); if (s.pk[0].k === 'truck') trucks++; } assert(trucks < 400 / W.PICKUPS.length, 'rare: ' + trucks);
  assert.equal(s.youExtra().slice(0, 2).join(), '0,0'); s.parked = { kind: 'cart', x: s.p.x, y: s.p.y, hp: 9, mhp: 140 }; s.toggleRide(); assert.equal(s.youExtra()[0], 1, 'friends see your ride');
  const o = { id: 'x', x: 0, y: 0 }; s.otherExtra(o, [0, 0, 0, 100, 100, 0, 0, 0, 0, 1, 0, 0, 2, 6, 10, 20, 50]); assert.equal(o.veh, 'mower'); assert.equal(o.fit, 'crown'); assert(o.npc && o.npc.hp === 50);
});
test('survivors: found hiding in town, escorted (zombies go for them), brought to a shop or the clinic for a reward; once per survivor', () => {
  const { room, ps: [a, b] } = mk({}, 2); room.start(); const g = room.game;
  let cell = null; for (let y = 0; y < 9 && !cell; y++) for (let x = 0; x < 9 && !cell; x++) if (X.survivorAt(g.seed, x, y, g.homes, PL.placeAt)) cell = [x, y];
  assert(cell, 'some blocks hide a survivor'); let n = 0; for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (X.survivorAt(g.seed, x, y, g.homes, PL.placeAt)) { n++; assert(!PL.placeAt(g.seed, x, y, g.homes), 'never in a shop block'); } assert(n >= 4 && n <= 20, 'about one in seven: ' + n);
  const Ra = g.runs.get(a.id); Ra.cell = cell.slice(); assert.equal(room.act(a, { op: 'escort', cell: '0,0' === cell.join() ? '1,1' : '0,0' }).ok, false, 'you have to be there');
  const r = room.act(a, { op: 'escort', cell: cell.join() }); assert(r.ok && r.name); assert(g.feed.some((f) => /hiding/.test(f.text)));
  const Rb = g.runs.get(b.id); Rb.cell = cell.slice(); assert(/already/.test(room.act(b, { op: 'escort', cell: cell.join() }).error), 'one escort');
  assert.equal(room.act(a, { op: 'rescue' }).ok, false, 'not a shop here');
  const [clinic] = Object.entries(PL.places(g.seed)).find(([k, t]) => t === 'clinic' && !g.homes.some((h) => h.join() === k)); Ra.cell = clinic.split(',').map(Number);
  const rr = room.act(a, { op: 'rescue' }); assert(rr.ok && rr.clinic && rr.cash > 0 && rr.score > X.SURV_REWARD.score); assert.equal(Ra.rescues, 1); assert(g.view(a).surv.some(([k, st2]) => k === cell.join() && st2 === 'safe'));
  assert.equal(room.act(a, { op: 'rescue' }).ok, false, 'once'); Ra.cell = cell.slice(); assert.equal(room.act(a, { op: 'escort', cell: cell.join() }).ok, false, 'already safe');
  assert(g.moments.some((m) => m.kind === 'rescue')); assert.equal(g.tv().rescued, 1);
  // the phone
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); s.phase = 'play'; s.p.inv = 1e9; s.z.length = 0; s.cleared = true;
  s.area.obstacles = []; s.set.aim = 'off';
  s.hiding = { id: '2,2', name: 'Old Gus', color: '#fff', x: s.p.x + 50, y: s.p.y, hp: 120, mhp: 120 }; s.o.report = (m) => { S.reports.push(m); const v = m.op === 'escort' ? { ok: true, name: 'Old Gus' } : m.op === 'rescue' ? { ok: true, cash: 90, score: 900, clinic: true } : { ok: true }; return { then: (f) => f(v) }; };
  S.step(s, 0.1); assert(s.npc && !s.hiding, 'escorting'); assert(S.reports.some((m) => m.op === 'escort' && m.cell === '2,2'));
  s.p.x = Math.min(W.AW - 100, s.p.x + 300); const d0 = Math.abs(s.npc.x - s.p.x); S.step(s, 2); assert(Math.abs(s.npc.x - s.p.x) < Math.min(d0, 120), 'they follow');
  assert(s.targets().includes(s.npc), 'zombies go for them'); const z = s.makeZ('walker', s.npc.x, s.npc.y); z.speed = 0; const hp = s.npc.hp; S.step(s, 0.5); assert(s.npc.hp < hp); s.z.length = 0;
  s.leave(Object.keys(s.area.exits).find((d) => s.area.exits[d] && W.inGrid(s.cell[0] + { n: 0, s: 0, w: -1, e: 1 }[d], s.cell[1] + { n: -1, s: 1, w: 0, e: 0 }[d]))); assert(s.npc && Math.hypot(s.npc.x - s.p.x, s.npc.y - s.p.y) < 120, 'they come along to the next block');
  s.area.obstacles = []; s.z.length = 0; s.npc.hp = 1; s.makeZ('brute', s.npc.x, s.npc.y).speed = 0; S.step(s, 0.5); assert(!s.npc && S.reports.some((m) => m.k === 'survlost'), 'lost');
});
test('weather: rain puts fires out and powers shock weapons, fog hides you from far zombies, a heat wave speeds them up; the server turns it every few minutes', () => {
  const { room, clock, ps: [a] } = mk({}, 1); room.start(); const g = room.game;
  assert.equal(g.weather.k, 'clear'); run(room, clock, X.WX.firstMs + 1500); assert.notEqual(g.weather.k, 'clear'); assert(g.feed.some((f) => /Rain|Fog|Heat/.test(f.text))); assert(room.fxLog.some((f) => f.kind === 'tzweather'));
  assert.equal(g.view(a).weather.k, g.weather.k); assert(g.tv().weather.tip);
  const S = sandbox(), mkS = () => { const s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); s.phase = 'play'; s.p.inv = 1e9; s.z.length = 0; return s; };
  const dry = mkS(), wet = mkS(); wet.setWeather('rain'); assert(S.events.some((e) => e[0] === 'weather') && /RAIN/.test(wet.banner.text), 'a banner says so');
  for (const s of [dry, wet]) { const z = s.makeZ('brute', 900, 300); z.hp = z.mhp = 1e5; s.damageZ(z, 100, 'me', 0, 0, { shock: 1 }); s._shock = 1e5 - z.hp; s.damageZ(z, 100, 'me', 0, 0, { burn: 2 }); s._fire = 1e5 - s._shock - z.hp; s._burn = z.burn; }
  assert.equal(wet._shock, dry._shock * X.WX.shockRain); assert(wet._fire < dry._fire && wet._burn < dry._burn, 'fires go out');
  const fog = mkS(); fog.setWeather('fog'); const far = fog.makeZ('walker', fog.p.x + 900, fog.p.y), near = fog.makeZ('walker', fog.p.x + 200, fog.p.y);
  const tgF = fog.pickTarget(far, fog.p, 900 * 900), tgN = fog.pickTarget(near, fog.p, 200 * 200); assert(tgF !== fog.p && tgF.slowK, 'far: it shuffles about'); assert.equal(tgN, fog.p, 'near: it notices you');
  const hot = mkS(), cool = mkS(); hot.setWeather('heat'); hot.area.obstacles = []; cool.area.obstacles = []; for (const s of [hot, cool]) { const z = s.makeZ('walker', s.p.x + 600, s.p.y); z.speed = 100; s._z = z; s._x = z.x; s.zombieStep(0.5); } assert(Math.abs(hot._z.x - hot._x) > Math.abs(cool._z.x - cool._x) * 1.2, 'heat: faster zombies');
});
test('new bosses with their own arenas: the ice-cream truck laps and leaves slowing slush (with its jingle); the compactor slams crush zones; in the rotation', () => {
  assert(ST.BOSSES.icecream && ST.BOSSES.compactor && W.ZOMBIES.icecream.mini && W.ZOMBIES.compactor.mini);
  const minis = new Set(); for (let w = 10; w <= 40; w += 5) minis.add(W.waveSpec(w, 1).mini); assert(minis.has('icecream') && minis.has('compactor'), 'mini-boss rotation');
  const finals = new Set(); for (let seed = 1; seed <= 200; seed++) finals.add(ST.plan(seed, [[4, 4]]).boss); assert(finals.has('icecream') && finals.has('compactor'), 'final-boss rotation');
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 15, run: 1 } }); s.p.inv = 1e9; s.phase = 'play'; s.z.length = 0; assert.equal(s.spec.mini, 'icecream');
  s.banner = null; s.waveKills = Math.ceil(s.spec.target * 0.3); S.step(s, 0.05); const ice = s.z.find((z) => z.mb); assert.equal(ice.mb, 'icecream'); assert(S.reports.some((r) => r.k === 'boss' && r.id === 'icecream'), 'the TV gets its card'); ice.hp = ice.mhp = 1e6;
  const p0 = [ice.x, ice.y]; S.step(s, 2); assert(Math.hypot(ice.x - p0[0], ice.y - p0[1]) > 50, 'it drives'); assert(S.events.some((e) => e[0] === 'jingle'), 'the jingle plays'); assert(s.slush.length > 0, 'slush');
  const q = s.slush[0]; s.p.x = q.x; s.p.y = q.y; s.fightStep(0.016); s.arenaStep(0.016); assert(s.speedMul <= 0.5, 'slush slows you');
  const S2 = sandbox(), c = S2.make({ restore: { cell: [2, 2], home: [4, 4], wave: 20, run: 1 } }); c.phase = 'play'; c.z.length = 0; assert.equal(c.spec.mini, 'compactor'); c.waveKills = c.spec.target; const cb = c.spawnOne('boss'); cb.hp = cb.mhp = 1e6; cb.speed = 0;
  c.p.inv = 0; c.buffs.shield = 0; c.p.hp = c.S.mhp = 1000; c.S.dodge = 0; S2.step(c, 2.8); assert(c.crush.length > 0 || c.crushHit.size > 0, 'crush zones'); const zone = c.crush[0] || { v: true, c: c.p.x, w: 230 };
  c.crush = [{ id: 999, v: true, c: c.p.x, w: 230, t: 0, warn: 0.5, life: 1 }]; c.p.inv = 0; const hp = c.p.hp; c.arenaStep(0.6); assert(c.p.hp < hp, 'CRUNCH'); void zone;
  const snap = c.snapExtra(); assert(snap.ar && snap.ar.c.length === 1); const S3 = sandbox(), gst = S3.make({ restore: { cell: [2, 2], home: [4, 4], wave: 20, run: 1 } }); gst.snapIn({ ar: snap.ar }); assert.equal(gst.crush.length, 1, 'guests see the hazards');
  const fz = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 }, settings: {} }); fz.story = { plan: { boss: 'icecream' } }; fz.spawnFinal(); const fb = fz.z.find((z) => z.fb); assert.equal(fb.fb, 'icecream'); assert(fb.noCollide, 'it drives over the curbs');
});
test('run save: reloading the phone brings back cash, weapons, items, class, combos, the ride and the survivor (same run only)', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 6, run: 1, lvl: 4 } }); s.p.inv = 1e9; s.phase = 'play';
  s.cash = 321; s.score = 4567; s.setClass('demo'); s.addWeapon('shotgun'); s.addWeapon('smg'); s.weapons[0].lv = 7; s.weapons[1].tier = 2; s.cores = 2; s.items.boots = 2; s.combos.add('pinball'); s.bombs = 3; s.plates = 2; s.pocket = 'shield'; s.gear.mhp = 20;
  s.ride = { kind: 'mower', hp: 100, mhp: 220 }; s.npc = { id: '3,3', name: 'Mabel', color: '#fff', hp: 80, mhp: 120, x: 0, y: 0 }; s.giftN = 7; s.evN = 3;
  const d = JSON.parse(JSON.stringify(s.saveData()));
  const t = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 6, run: 1, lvl: 4 } }); assert(t.loadSave(d));
  assert.equal(t.cash, 321); assert.equal(t.score, 4567); assert.equal(t.cls, 'demo'); assert.equal(JSON.stringify(t.weapons.map((w) => [w.id, w.lv, w.tier])), JSON.stringify([['shotgun', 7, 1], ['smg', 1, 2]])); assert.equal(t.cores, 2); assert.equal(t.items.boots, 2);
  assert(t.combos.has('pinball')); assert.equal(t.bombs, 3); assert.equal(t.plates, 2); assert.equal(t.pocket, 'shield'); assert.equal(t.gear.mhp, 20); assert.equal(t.ride.kind, 'mower'); assert.equal(t.npc.name, 'Mabel'); assert.equal(t.giftN, 7); assert.equal(t.evN, 3);
  assert(t.S.mhp > 100, 'stats rebuilt');
  const u = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 6, run: 1 } }); assert.equal(u.loadSave({ ...d, seed: 999 }), false, 'another night: ignored'); assert.equal(u.loadSave({ ...d, v: 0 }), false);
  const bad = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 6, run: 1 } }); bad.loadSave({ ...d, cash: -5, weapons: [{ id: 'nope', lv: 99 }, { id: 'smg', lv: 99, tier: 9 }], items: { nope: 3 } }); assert.equal(bad.cash, 0); assert.equal(JSON.stringify(bad.weapons.map((w) => [w.id, w.lv, w.tier])), JSON.stringify([['smg', 10, 3]])); assert.equal(JSON.stringify(bad.items), '{}');
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'games', 'trash.js'), 'utf8'); assert(/'tz\.run\.' \+ code \+ '\.' \+ id/.test(src) && /try \{ localStorage\.setItem\(k/.test(src) && /loadRun\(v\)/.test(src), 'the phone keeps it in localStorage per room + player');
});
test('hard rules: the camera stays centred on the hero and the view keeps its zoom', () => {
  const sim = fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'games', 'trash-sim.js'), 'utf8'), cl = fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'games', 'trash.js'), 'utf8');
  assert(sim.includes('let cx = P.x, cy = P.y - 30; void L;')); assert(cl.includes('k: Math.min(w, h) / 500'));
});

// ---------------- phase 3b: kill-locked areas, no dead ends, chests ----------------
const nbsOf = (seed, i) => { const c = W.town(seed).cells[i]; return Object.keys(c.side).filter((d) => c.side[d]).map((d) => (c.y + W.DIRS[d][1]) * W.GRID + c.x + W.DIRS[d][0]); };
test('no dead ends: every block has at least two roads (most have three), with loops and cross streets', () => {
  const deg = {}; for (let seed = 1; seed <= 200; seed++) for (const c of W.town(seed).cells) { const n = Object.values(c.side).filter(Boolean).length; deg[n] = (deg[n] || 0) + 1; assert(n >= 2, `seed ${seed} block ${c.x},${c.y} has ${n} road`); assert(!c.end, 'no cul-de-sacs'); }
  assert(deg[3] + deg[4] > deg[2] * 4, 'mostly three or four roads: ' + JSON.stringify(deg));
  // loops: more roads than a tree needs (a tree of 81 blocks has 80)
  for (const seed of [1, 7, 42]) { const roads = W.town(seed).cells.reduce((s, c) => s + (c.side.e ? 1 : 0) + (c.side.s ? 1 : 0), 0); assert(roads >= 110, seed + ': ' + roads + ' roads'); }
});
test('no dead ends with the locks: once a block’s own count is met it has 2+ open roads, and the open town is always joined to the garages', () => {
  for (const mode of ['story', 'endless', 'score', 'garage', 'party']) for (let seed = 1; seed <= 120; seed++) {
    const homes = mode === 'story' ? [[4, 4]] : [W.spawnCell(seed, [], 0)]; if (seed % 4 === 0) homes.push(W.spawnCell(seed, homes, 1));
    const LK = ST.locks(seed, homes, { mode: mode === 'party' ? 'score' : mode, party: mode === 'party' });
    for (const h of homes) assert.equal(LK.req[h[1] * W.GRID + h[0]], 0, 'garages are open');
    for (let i = 0; i < 81; i++) { // the block's own requirement met: at least 2 open roads out of it
      const open = nbsOf(seed, i).filter((j) => LK.req[j] <= LK.req[i]).length; assert(open >= 2, `${mode} ${seed} block ${i}: ${open} open road at ${LK.req[i]} kills`);
    }
    for (const k of new Set(LK.req)) { // ...and at that count nothing open is cut off behind a locked gate
      const U = new Set(LK.req.map((v, i) => (v <= k ? i : -1)).filter((i) => i >= 0)), seen = new Set(homes.map((h) => h[1] * W.GRID + h[0])), q = [...seen];
      while (q.length) { const j = q.pop(); for (const n of nbsOf(seed, j)) if (U.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } }
      assert.equal(seen.size, U.size, `${mode} ${seed}: at ${k} kills the open town is one piece`);
    }
  }
});
test('kill locks: ordinary blocks open at low counts, special ones (lair, key vaults, best shops, dens, loot stashes) need far more; scaled by players; no cap in Endless; Party Mode is simple', () => {
  const kinds = new Set(); let shops = 0, tot = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const S0 = ST.locks(seed, [[4, 4]], { mode: 'story' }), E = ST.locks(seed, [W.spawnCell(seed, [], 0)], { mode: 'endless' }), Pm = ST.locks(seed, [W.spawnCell(seed, [], 0)], { mode: 'score', party: true });
    for (const L of [S0, E, Pm]) L.kind.forEach((k, i) => { if (!k) return; kinds.add(k); const around = Math.max(...nbsOf(seed, i).map((j) => L.req[j])); assert(L.req[i] > around, `special ${k} needs more than every block around it`); assert(nbsOf(seed, i).every((j) => !L.kind[j]), 'specials never touch'); });
    assert(S0.door && S0.keys.length === 3 && S0.kind[S0.door[1] * 9 + S0.door[0]] === 'lair'); assert(S0.keys.every(([x, y]) => S0.kind[y * 9 + x] === 'key' && S0.req[y * 9 + x] >= 110), 'the key vaults are locked');
    const near = S0.req.filter((v, i) => !S0.kind[i] && v > 0); assert(Math.min(...near) <= 30, 'the first ordinary gates are cheap'); assert(S0.req.filter((v) => v === 0).length >= 5, 'a few blocks open from the start');
    assert(Math.max(...E.req) >= 880, 'Endless: the far loot stash keeps climbing'); assert(Math.max(...Pm.req) <= 200, 'Party Mode: everything is reachable in a short game');
    assert(Pm.kind.every((k) => !k || k === 'shop' || k === 'vault'), 'Party Mode: only the best shops and a stash are special');
    for (const [k2, t] of Object.entries(PL.places(seed))) if (t === 'master' || t === 'forge') { tot++; if (S0.kind[k2.split(',')[1] * 9 + +k2.split(',')[0]] === 'shop') shops++; }
    const P = ST.plan(seed, [[4, 4]]); for (const [n, id] of ST.KEYS.entries()) assert.equal(P.finds[S0.keys[n].join()], id, 'the key pieces sit in the key vaults');
  }
  assert.deepEqual([...kinds].sort(), ['den', 'key', 'lair', 'shop', 'vault']); assert(shops / tot > 0.8, 'the best shops are behind big gates: ' + shops + '/' + tot);
  assert(ST.lockNeed(100, 4) > ST.lockNeed(100, 2) && ST.lockNeed(100, 2) > ST.lockNeed(100, 1)); assert.equal(ST.lockNeed(100, 1), 100);
});
test('kill locks on the server (every mode): gates show kills / need, the TV and phones get the counts, specials stay a mystery until found, the open news names them', () => {
  for (const mode of ['endless', 'score', 'garage']) {
    const { room, ps: [a] } = mk({ mode }, 1); room.start(); const g = room.game, R = g.runs.get(a.id), L = g.lockPlan;
    assert(L, mode + ' has locks'); const i = L.kind.findIndex((k) => k), x = i % 9, y = Math.floor(i / 9);
    assert(g.locked(x, y)); assert.equal(g.tv().locks.kind[i], '?', 'unexplored specials are a mystery'); assert.equal(g.view(a).locks.kind[i], '?');
    R.kills = g.reqAt(x, y); g.lockCheck(); assert(!g.locked(x, y)); assert(g.feed.some((f) => /big gate is open/.test(f.text)), 'the news calls out a special gate');
    g.explore([x, y], a.id); assert.equal(g.tv().locks.kind[i], L.kind[i], 'explored: everyone knows what it is'); assert.equal(g.tv().locks.kills, g.teamKills());
  }
  // bots respect the gates in every mode
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 5 }); room.addBots(3); room.settings.mode = 'endless'; room.settings.length = 'm5'; room.start();
  let n = 0; while (room.game.phase !== 'over' && clock.step()) { if (++n > 100000) throw new Error('stuck'); for (const R of room.game.runs.values()) assert(!room.game.locked(R.cell[0], R.cell[1]), 'never behind a locked gate'); }
});
test('phone: a locked gate stays shut even when the area is clear (it shows kills / need); it opens when the team has the kills', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [4, 4], home: [4, 4], wave: 2, run: 1 } }); s.p.inv = 1e9; S.step(s, 5);
  const dir = ['n', 's', 'w', 'e'].find((d) => s.area.exits[d]), [dx, dy] = W.DIRS[dir], i = (4 + dy) * 9 + 4 + dx, req = new Array(81).fill(0); req[i] = 200;
  s.setLocks({ req, kind: new Array(81).fill(null), kills: 120 });
  s.z.length = 0; s.waveKills = s.spec.target; S.step(s, 0.2); assert(s.cleared);
  assert.deepEqual(JSON.parse(JSON.stringify(s.gateInfo(dir))), { have: 120, need: 200, kind: null }); assert.equal(s.gateLeft(dir), 80); assert.equal(!!s.exitOpen(dir), false, 'locked');
  const road = s.area.exits[dir]; if (dir === 'n') { s.p.x = road.p; s.p.y = 60; } else if (dir === 's') { s.p.x = road.p; s.p.y = W.AH - 60; } else if (dir === 'w') { s.p.x = 60; s.p.y = road.p; } else { s.p.x = W.AW - 60; s.p.y = road.p; }
  S.step(s, 1, { mx: dx, my: dy }); assert.equal(s.cell.join(), '4,4', 'the gate holds');
  assert.equal(s.nextGate().need, 200); assert(s.nextGate().here);
  s.setLocks({ req, kind: new Array(81).fill(null), kills: 200 }); assert.match(s.banner.text, /GATE OPEN/); assert(s.exitOpen(dir));
  for (let k = 0; k < 120 && s.cell.join() === '4,4'; k++) S.step(s, 1 / 60, { mx: dx, my: dy }); assert.equal(s.cell.join(), [4 + dx, 4 + dy].join(), 'through it');
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'games', 'trash-gates.js'), 'utf8'); assert(src.includes('`🔒 ${G.have} / ${G.need} kills`'), 'the gate sign');
});
test('phone: special blocks are harder (bigger, tougher wave, more elites); a zombie den brings a boss', () => {
  const S = sandbox(), plain = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 6, run: 1 } }), kind = new Array(81).fill(null); kind[2 * 9 + 2] = 'vault';
  const hard = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 6, run: 1 } }); hard.setLocks({ req: new Array(81).fill(0), kind, kills: 0 }); hard.startWave();
  assert.equal(hard.hard, 'vault'); assert(hard.spec.target >= Math.round(plain.spec.target * 1.4) && hard.spec.hpMul > plain.spec.hpMul && hard.spec.dmgMul > plain.spec.dmgMul, 'a bigger, tougher wave'); assert.match(hard.banner.text, /LOOT STASH/);
  let e1 = 0, e2 = 0; for (let k = 0; k < 300; k++) { if (plain.makeZ('walker', 100, 100).elite) e1++; if (hard.makeZ('walker', 100, 100).elite) e2++; } assert(e2 > e1 * 3 && e2 > 25, `more elites: ${e1} -> ${e2}`);
  kind[2 * 9 + 2] = 'den'; const den = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); den.setLocks({ req: new Array(81).fill(0), kind, kills: 0 }); den.startWave(); assert(den.bossDue, 'a boss lives in the den');
  const q = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 6, run: 1 } }); kind[2 * 9 + 2] = '?'; q.setLocks({ req: new Array(81).fill(0), kind, kills: 0 }); q.startWave(); const t0 = q.spec.target; kind[2 * 9 + 2] = 'den'; q.setLocks({ req: new Array(81).fill(0), kind, kills: 0 }); assert.equal(q.spec.target, t0, 'found out it is a den: not harder twice'); assert(q.bossDue);
});
const syncReply = (S, s, answer) => { s.o.report = (m) => { S.reports.push(m); const r = answer(m); return { then(f) { f(r); return this; } }; }; };
test('chests: story finds (the key pieces) sit in a chest you open by hand once the area is clear; it opens, the find rises out, plus a little cash', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); s.p.inv = 1e9;
  s.story = { plan: { finds: { '2,2': 'shard1' }, door: [8, 8], boss: 'truck' }, taken: [], keys: 0, maps: 0, tier: 0 };
  syncReply(S, s, (m) => (m.op === 'find' ? { ok: true, find: 'shard1', cash: 40 } : { ok: true }));
  const C = s.chestHere(); assert(C && C.kind === 'find' && C.id === 'shard1', 'a chest in this block');
  s.p.x = C.x; s.p.y = C.y + 40; S.step(s, 0.5); assert.equal(s.chestNear(), null, 'not before the area is clear'); assert(!S.reports.some((r) => r.op === 'find'));
  s.z.length = 0; s.waveKills = s.spec.target; s.bossDue = false; S.step(s, 0.2); assert(s.cleared);
  s.p.x = C.x + 400; s.p.y = C.y; assert.equal(s.chestNear(), null, 'you have to be next to it'); s.p.x = C.x; s.p.y = C.y + 40;
  S.step(s, 2); assert(!S.reports.some((r) => r.op === 'find'), 'standing next to it does not open it: you tap / click');
  assert(s.chestNear()); const cash = s.cash; assert(s.openChest()); assert(S.reports.some((r) => r.op === 'find' && r.x === 2 && r.y === 2)); assert(s.chestAnim && !s.chestAnim.shown, 'the lid is opening');
  S.step(s, 0.3); assert(!s.chestAnim.shown); S.step(s, 0.6); assert(s.chestAnim.shown, 'the key piece rises out'); assert(S.events.some(([k, d]) => k === 'find' && d.id === 'shard1')); assert.equal(s.cash, cash + 40, 'a little loot too');
  S.step(s, 3); assert.equal(s.chestAnim, null); assert.equal(s.chestHere(), null, 'opened for good'); assert.equal(s.openChest(), false);
  // a refusal (someone else got there first) shuts the lid again
  const t = S.make({ restore: { cell: [3, 3], home: [4, 4], wave: 3, run: 1 } }); t.story = { plan: { finds: { '3,3': 'lid' }, door: [8, 8] }, taken: [], keys: 0 }; syncReply(S, t, () => ({ ok: false, error: 'Someone already looted this.' }));
  t.z.length = 0; t.waveKills = t.spec.target; t.bossDue = false; S.step(t, 0.2); const C2 = t.chestHere(); t.p.x = C2.x; t.p.y = C2.y + 40; assert(t.openChest()); assert.equal(t.chestAnim, null); assert.match(t.banner.sub, /already/);
  const cl = fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'games', 'trash.js'), 'utf8'); assert(cl.includes("label: 'OPEN'") && cl.includes('clickChest(p.x, p.y)') && /f: PH\.sim\.chestNear/.test(cl), 'the OPEN button (phone), click / F (PC)'); assert(/Chests: clear the area/.test(cl), 'how to play explains the chests');
});
test('chests: loot stashes and dens have a loot chest (cash + goodies, a weapon in a stash), once per player; the server checks it', () => {
  const S = sandbox(), kind = new Array(81).fill(null); kind[2 * 9 + 2] = 'vault';
  const s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 4, run: 1 } }); s.p.inv = 1e9; s.setLocks({ req: new Array(81).fill(0), kind, kills: 0 }); s.startEvent = () => null; // (no random area event, e.g. a cash grab, muddling the count)
  syncReply(S, s, (m) => (m.op === 'chest' ? { ok: true, cash: 150, loot: ['shield', 'snack', 'xp2'], weapon: true } : { ok: true }));
  s.z.length = 0; s.waveKills = s.spec.target; s.bossDue = false; S.step(s, 0.2); const C = s.chestHere(); assert(C && C.kind === 'loot' && C.id === 'vault');
  s.p.x = C.x; s.p.y = C.y + 40; const pk = s.pk.length, cash = s.cash, drops = s.drops.length; assert(s.openChest()); assert(S.reports.some((r) => r.op === 'chest' && r.cell === '2,2')); s.p.x = C.x > W.AW / 2 ? 100 : W.AW - 100; // (step back so nothing gets picked up yet)
  S.step(s, 2); assert.equal(s.pk.length, pk + 3, 'goodies around the chest'); assert.equal(s.cash, cash + 150); assert(s.drops.length > drops, 'a weapon'); S.step(s, 3); assert.equal(s.chestHere(), null);
  // the server
  const { room, ps: [a, b] } = mk({ mode: 'endless' }, 2); room.start(); const g = room.game, i = g.lockPlan.kind.findIndex((k) => k === 'vault' || k === 'den'), cell = [i % 9, Math.floor(i / 9)];
  const Ra = g.runs.get(a.id), Rb = g.runs.get(b.id); assert.equal(room.act(a, { op: 'chest', cell: cell.join() }).ok, false, 'not there');
  Ra.cell = cell.slice(); Rb.cell = cell.slice(); const r = room.act(a, { op: 'chest', cell: cell.join() }); assert(r.ok && r.cash > 0 && r.loot.length >= 2);
  assert.equal(room.act(a, { op: 'chest', cell: cell.join() }).ok, false, 'once'); assert(room.act(b, { op: 'chest', cell: cell.join() }).ok, 'each player gets their own');
  assert.deepEqual(g.view(a).chests, [cell.join()]); assert(room.fxLog.some((f) => f.kind === 'tzchest'));
  const j = g.lockPlan.kind.findIndex((k, n) => !k && !g.homes.some((h) => h[1] * 9 + h[0] === n)); Ra.cell = [j % 9, Math.floor(j / 9)]; assert.equal(room.act(a, { op: 'chest', cell: Ra.cell.join() }).ok, false, 'no chest in an ordinary block');
  // a key chest pays a little too
  const st = story(1); st.room.start(); const sg = st.room.game, SR = sg.runs.get(st.ps[0].id); SR.cell = sg.lockPlan.keys[0].slice();
  const kr = st.room.act(st.ps[0], { op: 'find', x: SR.cell[0], y: SR.cell[1] }); assert.equal(kr.find, 'shard1'); assert(kr.cash > 0); assert(sg.moments.some((m) => m.kind === 'key'));
});

// ---------------- the final pass: iso view, JustZombies, breaks between waves, timed rides, first person, the tank ----------------
test('iso view: screen directions turn into the world directions that look the same (drag up moves you up the screen); the camera rule', () => {
  const ctx = { console, Math, JSON, Object, Array, Map, Set, Number, String, Promise, Infinity, isFinite, setTimeout, performance: { now: () => 0 } }; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
  for (const f of ['trash-world.js', 'trash-iso.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'games', f), 'utf8'), ctx, { filename: f });
  const I = ctx.TZI, d2w = I.dirToWorld, near = (a, b, e = 1e-6) => Math.abs(a - b) < e;
  // projection: art x = (x - y) * 0.8, art y = (x + y) * 0.4 (the art set's 128 x 64 tile = 80 world units)
  const C = I.cam; Object.assign(C, { s: 1, w: 800, h: 400, cx: 0, cy: 0, sx: 0, sy: 0, dpr: 1 });
  let [sx, sy] = C.toScreen(80, 0); assert(near(sx - 400, 64) && near(sy - 200, 32), 'one tile east = 64 px right, 32 down');
  [sx, sy] = C.toScreen(0, 80); assert(near(sx - 400, -64) && near(sy - 200, 32), 'one tile south = 64 px left, 32 down');
  const [wx, wy] = C.toWorld(...C.toScreen(123, -45)); assert(near(wx, 123, 1e-6) && near(wy, -45, 1e-6), 'screen <-> world round trip');
  const [hx, hy] = C.toWorld(...C.toScreen(300, 200, 30), 30); assert(near(hx, 300, 1e-6) && near(hy, 200, 1e-6), 'and at chest height');
  // directions: each comes back the same length, and points where it looks like it points
  const up = d2w(0, -1), right = d2w(1, 0), left = d2w(-1, 0), down = d2w(0, 1);
  assert(near(up[0], -Math.SQRT1_2) && near(up[1], -Math.SQRT1_2), 'up on screen = north-west in the world');
  assert(near(right[0], Math.SQRT1_2) && near(right[1], -Math.SQRT1_2), 'right on screen = north-east');
  assert(near(left[0], -Math.SQRT1_2) && near(left[1], Math.SQRT1_2) && near(down[0], Math.SQRT1_2) && near(down[1], Math.SQRT1_2), 'left and down');
  for (let a = 0; a < 6.28; a += 0.3) { const d = d2w(Math.cos(a) * 0.7, Math.sin(a) * 0.7), sa = I.screenAngle(Math.atan2(d[1], d[0])); assert(near(Math.hypot(d[0], d[1]), 0.7, 1e-9), 'same length'); assert(near(Math.cos(sa), Math.cos(a), 1e-6) && near(Math.sin(sa), Math.sin(a), 1e-6), 'and it shows where you pushed'); }
  assert.equal(I.dirOf(1, 1), 'S'); assert.equal(I.dirOf(1, -1), 'E'); assert.equal(I.dirOf(-1, -1), 'N'); assert.equal(I.dirOf(-1, 1), 'W'); assert.equal(I.dirOf(1, 0), 'SE');
  // the camera: centred on you, no look-ahead, and the same amount of ground as the old top-down view (k = min(w, h) / 500)
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'games', 'trash-iso.js'), 'utf8');
  assert(src.includes('const s = V.k / 0.8;') && /cx: isoX\(fx0, fy0\)/.test(src) && !/lead\(/.test(src), 'iso camera: centred, no lead, area-matched scale');
  const k = 390 / 500, s = k / 0.8, oldArea = (844 / k) * (390 / k), isoArea = (844 * 390) / (s * s * 0.64); assert(Math.abs(isoArea / oldArea - 1) < 1e-9, 'the visible ground area matches');
});
test('JustZombies: the new name everywhere players see it; its own address (/zombies), a big game with JustMafia and JustRaiseDucks; JustKingdoms on the More games shelf', () => {
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
  assert.equal(def.name, 'JustZombies'); assert.equal(def.key, 'trash');
  const hub = read('public/hub.html'), big = hub.slice(hub.indexOf('<section class="tiles big" id'), hub.indexOf('</section>', hub.indexOf('<section class="tiles big" id')));
  assert.deepEqual([...big.matchAll(/data-game="([a-z]+)"/g)].map((m) => m[1]), ['mafia', 'ducks', 'trash'], 'the big three');
  assert(/<a class="tile live trash" href="\/zombies"[^>]*>[\s\S]*?<h2>JustZombies<\/h2>/.test(big), 'the JustZombies big tile');
  const small = hub.slice(hub.indexOf('<section class="tiles small" aria')); assert(/data-game="kingdoms"[^>]*data-type="action"/.test(small) && /href="\/kingdoms"/.test(small), 'JustKingdoms is a regular tile (still at /kingdoms)');
  assert(read('box/index.js').includes("app.get('/zombies'") && read('box/index.js').includes("app.get('/zombies/play'") && read('box/index.js').includes("app.get('/kingdoms'"), 'routes');
  assert(/STANDALONE = \{ ducks: 'ducks', trash: 'zombies', kingdoms: 'kingdoms' \}/.test(read('one-code.js')), 'one code sends phones to /zombies/play');
  assert(read('public/party/party.js').includes("games: ['ducks', 'trash', 'mafia']"), 'Party Mode big games');
  for (const f of ['public/box/games/trash.js', 'public/box/intros/trash.js', 'public/box/titles/trash.js', 'public/box/play.webmanifest', 'public/hub.html', 'public/party/party.js']) assert(!/TrashZombies|Trash<b>Zombies/.test(read(f)), f + ' says JustZombies');
  assert(read('public/box/tv.js').includes("const PATHS = { zombies: 'trash' }"), 'the TV page knows /zombies');
  const cl = read('public/box/games/trash.js'); assert(/standalone: true, smallToo: true, path: 'zombies', title: titleScreen/.test(cl) && /creditsHtml\(\)/.test(cl), 'own title screen + credits');
  assert(read('public/box/games/trash-assets/CREDITS.md').includes('CC0'));
});
test('the break between waves: 30 s after a clear the next wave starts by itself where you stand (every mode); the server checks it; only the solo pause menu holds it', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); s.p.inv = 1e9;
  assert.equal(s.ctor ? 1 : S.ctx.TZSim.BREAK_S, 30);
  s.z.length = 0; s.waveKills = s.spec.target; s.bossDue = false; S.step(s, 0.1); assert(s.cleared && s.breakT > 29, 'clear: the clock starts');
  s.shopping = true; s.paused = true; S.step(s, 10); assert(s.breakT < 20.5, 'shopping does not stop it: ' + s.breakT);
  s.menuPause = true; const b0 = s.breakT; S.step(s, 5); assert.equal(s.breakT, b0, 'the solo pause menu holds it'); s.menuPause = false; s.paused = false; s.shopping = false;
  const w0 = s.wave; S.step(s, 21); assert.equal(s.wave, w0 + 1, 'the next wave came'); assert(!s.cleared && s.breakT == null); assert.equal(s.cell.join(), '2,2', 'right here'); assert(S.reports.some((r) => r.op === 'ev' && r.k === 'wave'));
  assert(S.events.some(([k]) => k === 'tick'), 'the last seconds tick');
  // the status ping carries the clock (for the TV)
  s.z.length = 0; s.waveKills = s.spec.target; s.bossDue = false; S.step(s, 0.2); s.reportStatus(true); const st = S.reports.filter((r) => r.op === 'st').pop(); assert(st.brk >= 29 && st.brk <= 30);
  // co-op: the host's clock is in the snapshot; a guest can't hold it
  const h = S.make({ id: 'h', restore: { cell: [3, 3], home: [4, 4], wave: 2, run: 1 } }); h.setArea({ k: '3,3', host: 'h', members: ['h', 'g'] }); h.z.length = 0; h.waveKills = h.spec.target; h.bossDue = false; S.step(h, 0.2); assert(h.cleared);
  S.lives.length = 0; S.step(h, 0.3); const snap = S.lives.filter((m) => m.t === 'snap').pop(); assert(snap && snap.w[5] > 25, 'the break rides along in the snapshot');
  // the server: a 'wave' report needs the break to have run
  const { room, clock, ps: [a] } = mk({}, 1); room.start(); const g = room.game, R = g.runs.get(a.id);
  assert.equal(room.act(a, { op: 'ev', k: 'wave', wave: 2 }).ok, false, 'not without a clear');
  room.act(a, { op: 'ev', k: 'clear', wave: 1 }); assert.equal(room.act(a, { op: 'ev', k: 'wave', wave: 2 }).ok, false, 'not straight away');
  run(room, clock, 30000); const areas = R.areas; assert.equal(room.act(a, { op: 'ev', k: 'wave', wave: 2 }).ok, true); assert.equal(R.areas, areas + 1, 'the new wave counts like a new area');
  room.act(a, { op: 'st', kills: 10, lvl: 2, hp: 90, mhp: 100, wave: 2, brk: 12 }); assert.equal(g.people().find((p) => p.id === a.id).brk, 12, 'the TV sees the clock');
  assert(fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'games', 'trash.js'), 'utf8').includes('NEXT WAVE IN'), 'big countdown on the phone + TV');
});
test('rides are all timed: each has a clock; when it runs out you pop out and it breaks down (the truck drives off); new: the push mower and the rare tank', () => {
  for (const [k, V] of Object.entries(X.VEHICLES)) assert(V.time > 0 && V.hp > 0, k + ' is timed');
  assert(X.VEHICLES.push && X.VEHICLES.tank && X.VEHICLES.tank.cannon, 'push mower + tank');
  let tanks = 0, push = 0; for (let seed = 1; seed < 30; seed++) for (let x = 0; x < 9; x++) for (let y = 0; y < 9; y++) { const v = X.vehicleAt(seed, x, y, [[4, 4]]); if (v === 'tank') tanks++; if (v === 'push') push++; }
  assert(tanks > 10 && tanks < 150, 'tanks are rare: ' + tanks); assert(push > 0);
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); s.phase = 'play'; s.z.length = 0; s.cleared = true; s.p.inv = 1e9; s.breakT = 9999;
  s.parked = { kind: 'cart', x: s.p.x + 40, y: s.p.y, hp: 140, mhp: 140, face: 1 }; assert.equal(s.toggleRide(), 'in'); assert(s.ride.life === 25 && s.ride.life0 === 25);
  S.step(s, 10); assert(s.ride && s.ride.life < 15.5, 'the clock runs');
  S.step(s, 16); assert(!s.ride, 'time’s up: out you pop'); assert(S.events.some(([k]) => k === 'rideend')); assert(!s.parked, 'it broke down');
  assert(s.wrecked[s.cellKey()], 'and won’t come back here');
});
test('getting in: a 1 s walk-up (tap skips it); first person: steer + gas move you along the heading, rams send zombies flying (score + XP as usual), damage wrecks it with a crash', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); s.phase = 'play'; s.z.length = 0; s.cleared = true; s.p.inv = 1e9; s.breakT = 9999; s.spawnCd = 999;
  s.boardAnim = true; s.fpRide = true;
  s.parked = { kind: 'gtruck', x: s.p.x + 80, y: s.p.y, hp: 700, mhp: 700, face: 1 }; assert.equal(s.toggleRide(), 'in'); assert(s.boarding && !s.ride, 'walking up');
  S.step(s, 0.5); assert(!s.ride && Math.abs(s.p.x - s.boarding.v.x) < 60, 'halfway there'); S.step(s, 0.6); assert(s.ride && s.ride.fp, 'in, in first person'); assert(Math.abs(s.ride.life - 15) < 0.2, 'the truck’s clock');
  s.ride.head = 0; const x0 = s.p.x, y0 = s.p.y; S.step(s, 1, { drive: { steer: 0, gas: 1 } }); assert(s.p.x > x0 + 80 && Math.abs(s.p.y - y0) < 20, 'gas: forward along the heading');
  const h0 = s.ride.head; S.step(s, 0.5, { drive: { steer: 1, gas: 1 } }); assert(s.ride.head > h0 + 0.3, 'steering turns it'); assert(s.shotN == null || s.shotN === 0, 'your gun rests while you drive');
  // ram a zombie at speed
  s.ride.head = 0; s.ride.spd = 1; const k0 = s.killCount, sc0 = s.score || 0; const z = s.makeZ('walker', s.p.x + 50, s.p.y); z.hp = 5;
  S.step(s, 0.2, { drive: { steer: 0, gas: 1 } }); assert(z.hp <= 0, 'rammed'); assert(s.killCount > k0 && (s.score || 0) > sc0, 'kills and score count'); assert(s.splatN > 0, 'blood on the glass');
  // wrecked: a crash, back on foot
  s.ride.hp = 1; s.p.inv = 0; s.buffs.shield = 0; s.hurt(50); assert(!s.ride, 'wrecked'); assert(s.fpOut && s.fpOut.crash, 'the crash effect');
  // a tap skips the walk-up
  s.fpOut = null; s.parked = { kind: 'cart', x: s.p.x + 80, y: s.p.y, hp: 140, mhp: 140, face: 1 }; s.p.inv = 1e9; s.toggleRide(); s.skipBoard = true; S.step(s, 0.05); assert(s.ride && s.ride.kind === 'cart', 'skipped');
  s.toggleRide(); assert(!s.ride && s.fpOut && !s.fpOut.crash, 'hopping out: a quick fade');
});
test('the tank: first person from the hatch; the cannon locks on to a zombie near the crosshair, fires a shell with splash damage, then reloads', () => {
  const S = sandbox(), s = S.make({ restore: { cell: [2, 2], home: [4, 4], wave: 3, run: 1 } }); s.phase = 'play'; s.z.length = 0; s.cleared = true; s.p.inv = 1e9; s.breakT = 9999; s.spawnCd = 999; s.fpRide = true;
  s.parked = { kind: 'tank', x: s.p.x, y: s.p.y, hp: 1100, mhp: 1100, face: 1 }; s.toggleRide(); assert(s.ride && s.ride.kind === 'tank' && s.ride.fp && s.ride.life === 22);
  s.ride.tur = 0; const a = s.makeZ('walker', s.p.x + 400, s.p.y + 30), b = s.makeZ('walker', s.p.x + 430, s.p.y + 60), far = s.makeZ('walker', s.p.x - 400, s.p.y); a.hp = b.hp = far.hp = 60;
  S.step(s, 0.05, { drive: { steer: 0, gas: 0 } }); assert.equal(s.ride.lock, a.id, 'locked on to the one in the crosshair');
  S.step(s, 0.05, { drive: { steer: 0, gas: 0, fire: true } }); assert(s.ride.reload > 1.3, 'fired: reloading'); assert.equal(s.shells.length, 1);
  S.step(s, 0.5, { drive: { steer: 0, gas: 0 } }); assert(a.hp <= 0 && b.hp <= 0, 'boom: splash damage takes the group'); assert(far.hp > 0, 'not the one behind you');
  S.step(s, 0.05, { drive: { steer: 0, gas: 0, fire: true } }); assert.equal(s.shells.length, 0, 'still reloading');
  S.step(s, 0.1, { drive: { steer: 0, gas: 0, tur: Math.PI } }); assert(Math.abs(s.ride.tur - Math.PI) < 1e-9, 'the turret turns (mouse / drag)');
  // co-op: friends see the ride (iso art from the snapshot), the driver stays hidden
  assert(fs.readFileSync(path.join(__dirname, '..', 'public', 'box', 'games', 'trash-iso.js'), 'utf8').includes('if (o.veh && !o.dead && !o.down) {'), 'others in a ride draw as the ride');
  s.reportStatus(true); assert.equal(S.reports.filter((r) => r.op === 'st').pop().veh, 'tank');
});

console.log(`\n${passed} JustZombies tests passed.`);
