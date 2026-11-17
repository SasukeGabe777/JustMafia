'use strict';
// Color Match rules: colour maths, validation, a full bot game on a virtual clock, results().
//   node tools/test-box-colormatch.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/colormatch');
const C = def._color;
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const near = (a, b, eps, msg) => assert(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const run = (room, clock, until) => { let i = 0; while (!until() && clock.step()) if (++i > 200000) throw new Error('never ended'); };

test('CIEDE2000 matches the published reference pairs (Sharma et al.)', () => {
  near(C.deltaE00([50, 2.6772, -79.7751], [50, 0, -82.7485]), 2.0425, 1e-4, 'pair 1');
  near(C.deltaE00([50, 3.1571, -77.2803], [50, 0, -82.7485]), 2.8615, 1e-4, 'pair 2');
  near(C.deltaE00([50, 2.5, 0], [73, 25, -18]), 27.1492, 1e-4, 'pair 25');
  near(C.deltaE00([50, 2.5, 0], [50, 3.2972, 0]), 1.0, 1e-4, 'pair 12');
  near(C.deltaE00([50, 2.5, 0], [50, 0, -2.5]), 4.3065, 1e-4, 'pair 7');
  near(C.deltaE00([2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514]), 0.9082, 1e-4, 'pair 34');
  assert.equal(C.deltaE00([60, 10, 10], [60, 10, 10]), 0);
});
test('colour conversions: HSV → RGB, sRGB ↔ Lab round-trips', () => {
  assert.deepEqual(C.hsvToRgb(0, 100, 100), [255, 0, 0]);
  assert.deepEqual(C.hsvToRgb(120, 100, 100), [0, 255, 0]);
  assert.deepEqual(C.hsvToRgb(240, 50, 100), [128, 128, 255]);
  assert.deepEqual(C.hsvToRgb(77, 0, 0), [0, 0, 0]);
  const white = C.rgbToLab([255, 255, 255]); near(white[0], 100, 0.01, 'white L'); near(white[1], 0, 0.01, 'white a');
  for (const h of ['#ffa94d', '#1f3f73', '#c6ff2e', '#5e2a55', '#808080', '#000000']) assert.equal(C.hex(C.labToRgb(C.rgbToLab(C.fromHex(h)))), h, 'round trip ' + h);
});
test('% match: identical = 100, close is high, opposite is low', () => {
  assert.equal(C.matchPct(C.distHex('#3d7fc1', '#3d7fc1')), 100);
  assert(C.matchPct(C.distHex('#3d7fc1', '#4083c4')) > 95, 'a tiny nudge is perfect');
  const mid = C.matchPct(C.distHex('#3d7fc1', '#5a9ad8')); assert(mid > 70 && mid < 96, 'a near miss: ' + mid);
  assert(C.matchPct(C.distHex('#ffff00', '#0000ff')) < 20, 'yellow vs blue');
  assert.equal(C.matchPct(500), 0);
});
test('phone colours are validated and clamped', () => {
  assert.equal(C.cleanColor({ h: 0, s: 100, v: 100 }), '#ff0000');
  assert.equal(C.cleanColor({ h: 9999, s: 500, v: 500 }), '#ff0000'); // clamped to 360 -> 0
  assert.equal(C.cleanColor({ h: -50, s: -5, v: -5 }), '#000000');
  for (const bad of [null, 5, 'red', {}, { h: 'x', s: 1, v: 1 }, { h: NaN, s: 1, v: 1 }, { h: 1, s: Infinity, v: 1 }]) assert.equal(C.cleanColor(bad), null);
});
test('bots play a whole game; results() lists everyone best-first', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 1 });
  room.addBots(6); assert(room.start().ok);
  const seen = new Set();
  let i = 0; while (room.game.phase !== 'over' && clock.step()) { seen.add(room.game.phase + ':' + (room.game.cur && room.game.cur.kind)); if (++i > 200000) throw new Error('never ended'); }
  assert.equal(room.game.round, 7);
  const r = room.game.results(); assert.equal(r.length, 6);
  const st = room.game.standings(); for (let k = 1; k < st.length; k++) assert(st[k - 1].points >= st[k].points);
  assert.deepEqual(r, st.map((x) => x.id));
  assert(st[0].points > 0, 'someone scored');
  const fin = room.game.tv().final; assert(fin && fin.awards.length >= 2 && fin.palette.length === 7, 'awards + palette');
  assert(seen.has('look:memory') && seen.has('reveal:memory'));
});
test('every round style is planned in a mixed game; memory-only stays memory', () => {
  const room = new BoxRoom('TEST', def, { clock: new VirtualClock(), seed: 5 }); room.addBots(3);
  room.settings.rounds = 10; room.start();
  const k = room.game.kinds; assert.equal(k.length, 10); assert.equal(k[0], 'memory');
  for (const s of ['memory', 'blink', 'two', 'name', 'gradient', 'odd']) assert(k.includes(s), 'has ' + s);
  for (let i = 1; i < k.length; i++) assert.notEqual(k[i], k[i - 1], 'no repeats in a row');
  const r2 = new BoxRoom('TEST', def, { clock: new VirtualClock(), seed: 6 }); r2.addBots(3); r2.settings.styles = 'memory'; r2.settings.rounds = 5; r2.start();
  assert(r2.game.kinds.every((x) => ['memory', 'blink', 'two'].includes(x)));
});
test('the target is never sent while players are mixing (TV or phone)', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 2 });
  const p = room.join('Ana').player; p.sockets = 1; room.addBots(2); room.start();
  run(room, clock, () => room.game.phase === 'look');
  assert(room.game.tv().cur.target, 'shown on the TV while looking');
  assert(!room.game.view(p).cur.target, 'phones look at the TV');
  run(room, clock, () => room.game.phase === 'pick');
  assert(!room.game.tv().cur.target && !JSON.stringify(room.game.view(p)).includes(room.game.cur.target), 'hidden while mixing');
});
test('phone input is validated; a perfect lock-in scores and combos', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 3 });
  const p = room.join('Ana').player; p.sockets = 1; room.addBots(2); room.start();
  assert.equal(room.act(p, { op: 'lock', colors: [{ h: 1, s: 1, v: 1 }] }).ok, false, 'not during the intro');
  run(room, clock, () => room.game.phase === 'pick');
  for (const bad of [{ op: 'lock', colors: [{ h: 'x', s: 1, v: 1 }] }, { op: 'lock', colors: [] }, { op: 'lock', colors: 'red' }, { op: 'lock' }, { op: 'lock', colors: [{ h: 1, s: 1, v: 1 }, { h: 1, s: 1, v: 1 }] }, { op: 'odd', i: 3 }, { op: 'nope' }, {}])
    assert.equal(room.act(p, bad).ok, false, JSON.stringify(bad));
  assert.equal(room.act(p, { op: 'mix', colors: [{ h: 10, s: 10, v: 10 }] }).ok, true, 'a draft');
  // Lock in the exact target (as HSV) -> 100%.
  const [r, g, b] = C.fromHex(room.game.cur.target).map((x) => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  const h = d === 0 ? 0 : mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  assert(room.act(p, { op: 'lock', colors: [{ h: (h + 360) % 360, s: mx ? (d / mx) * 100 : 0, v: mx * 100 }] }).ok);
  assert.equal(room.act(p, { op: 'lock', colors: [{ h: 1, s: 1, v: 1 }] }).ok, false, 'only once');
  run(room, clock, () => room.game.phase === 'reveal');
  const me = room.game.view(p).me;
  assert(me && me.pct === 100 && me.perfect && me.combo === 1 && me.pts >= 1000, JSON.stringify(me));
});
test('Odd One Out: only a tile index 0–15; the right tile scores, faster is better', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 4 });
  const a = room.join('Ana').player, b = room.join('Bo').player; a.sockets = b.sockets = 1; room.start();
  room.game.kinds[0] = 'odd'; room.game.round = 0; room.game.nextRound();
  run(room, clock, () => room.game.phase === 'pick');
  const tiles = room.game.tv().cur.tiles; assert.equal(tiles.length, 16);
  const odd = room.game.cur.odd; assert.equal(tiles.filter((t) => t === tiles[odd]).length, 1);
  const dE = C.distHex(room.game.cur.base, room.game.cur.oddColor); assert(dE >= 4 && dE < 12, 'subtle: ' + dE);
  for (const bad of [{ op: 'odd', i: 16 }, { op: 'odd', i: -1 }, { op: 'odd', i: 1.5 }, { op: 'odd', i: 'a' }, { op: 'lock', colors: [{ h: 1, s: 1, v: 1 }] }]) assert.equal(room.act(a, bad).ok, false, JSON.stringify(bad));
  assert(room.act(a, { op: 'odd', i: odd }).ok);
  clock.t += 3000;
  assert(room.act(b, { op: 'odd', i: (odd + 1) % 16 }).ok);
  assert.equal(room.game.phase, 'reveal', 'everyone in -> reveal');
  const res = room.game.result; assert.equal(res.entries[0].id, a.id); assert(res.entries[0].correct && res.entries[0].pts > 500);
  assert.equal(res.entries[1].pts, 0);
});
test('Name It: with 3+ mixers the room average is the target', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 8 });
  const ps = ['Ana', 'Bo', 'Cy'].map((n) => { const p = room.join(n).player; p.sockets = 1; return p; }); room.start();
  room.game.kinds[0] = 'name'; room.game.round = 0; room.game.nextRound();
  run(room, clock, () => room.game.phase === 'pick');
  assert(room.game.tv().cur.name);
  room.act(ps[0], { op: 'lock', colors: [{ h: 30, s: 70, v: 100 }] }); room.act(ps[1], { op: 'lock', colors: [{ h: 40, s: 70, v: 100 }] }); room.act(ps[2], { op: 'lock', colors: [{ h: 35, s: 70, v: 100 }] });
  const res = room.game.result; assert(res.crowd && res.avg && res.target === res.avg);
  assert.equal(res.entries[0].name, 'Cy', 'the middle one is closest to the average');
});
test('a draft counts when time runs out; a two-tone needs two colours', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 9 });
  const p = room.join('Ana').player; p.sockets = 1; room.addBots(1); room.start();
  room.game.kinds[0] = 'two'; room.game.round = 0; room.game.nextRound();
  run(room, clock, () => room.game.phase === 'pick');
  assert.equal(room.act(p, { op: 'mix', colors: [{ h: 1, s: 1, v: 1 }] }).ok, false, 'two-tone needs two');
  assert(room.act(p, { op: 'mix', colors: [{ h: 100, s: 50, v: 50 }, { h: 200, s: 50, v: 50 }] }).ok);
  run(room, clock, () => room.game.phase === 'reveal');
  const me = room.game.result.entries.find((e) => e.id === p.id); assert(me && me.late && me.picks.length === 2 && me.parts.length === 2);
});
test('the last round is worth double; the game ends and survives a player leaving', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 11 });
  room.addBots(4); room.settings.rounds = 5; room.start();
  run(room, clock, () => room.game.round === 5 && room.game.phase === 'reveal');
  assert(room.game.result.final);
  const e = room.game.result.entries[0]; assert.equal(e.pts, (e.base + e.bonus) * 2);
  room.remove(room.list()[0].id);
  run(room, clock, () => room.game.phase === 'over');
  assert.equal(room.game.results().length, 3);
});
test('next() skips through every phase', () => {
  const room = new BoxRoom('TEST', def, { clock: new VirtualClock(), seed: 12 }); room.addBots(2); room.settings.rounds = 5; room.start();
  for (let i = 0; i < 60 && room.game.phase !== 'over'; i++) room.game.next();
  assert.equal(room.game.phase, 'over');
});
console.log(`\n${passed} Color Match tests passed.`);
