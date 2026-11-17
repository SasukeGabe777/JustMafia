'use strict';
// JustDrop rules: physics determinism, scoring, the ink budget, phone input validation, round
// progression, sudden death and results(). Bots play whole games on a virtual clock.
//   node tools/test-box-plinko.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/plinko');
const PH = require('../box/games/plinko-physics');
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const seeded = (s) => () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
const playOut = (room, clock, max = 200000) => { let i = 0; while (room.game.phase !== 'over' && clock.step()) if (++i > max) throw new Error('never ended'); };
const until = (room, clock, phase) => { let i = 0; while (room.game.phase !== phase && clock.step()) if (++i > 100000) throw new Error('never reached ' + phase); };

test('module: locked behind Blackjack Night, best crowd 2–10, casino settings', () => {
  assert.equal(def.locked.how, 'Finish a game of Blackjack Night to unlock it.');
  assert.deepEqual(def.best, [2, 10]);
  for (const k of ['rounds', 'ink', 'style', 'powerups', 'timer']) assert(def.fields.some((f) => f.key === k), k);
  assert.deepEqual(def.fields.find((f) => f.key === 'rounds').options.map((o) => o.value), [3, 4, 5]);
});

test('physics is deterministic: same board + lines + balls → identical paths and slots', () => {
  for (const L of [1, 3, 5]) {
    const b1 = PH.makeBoard(L, seeded(7), { style: 'chaos' }), b2 = PH.makeBoard(L, seeded(7), { style: 'chaos' });
    assert.deepEqual(b1, b2);
    const lines = [{ pts: [[200, 400], [380, 470], [420, 520]], owner: 'a' }, { pts: [[700, 800], [600, 860]], owner: 'b', ghost: true }];
    const balls = Array.from({ length: 10 }, (_, i) => ({ owner: 'p' + i, x: 80 + i * 90, big: i === 3, sticky: i === 5 }));
    const r1 = PH.simulate(b1, lines, balls), r2 = PH.simulate(b2, JSON.parse(JSON.stringify(lines)), JSON.parse(JSON.stringify(balls)));
    assert.deepEqual(r1, r2);
    for (const b of r1.balls) { assert(b.slot >= 0 && b.slot < b1.slots.length); assert.equal(b.path.length % 2, 0); assert(b.path.length / 2 >= b.landF - 1); }
    // the recorded path ends inside the slot it scored
    for (const b of r1.balls) { const x = b.path[b.path.length - 2]; assert.equal(PH.slotAt(b1, x), b.slot); }
  }
});

test('boards get harder each level: more pegs, busts, bumpers, spinners, wind, narrower jackpot', () => {
  const B = [1, 2, 3, 4, 5].map((L) => PH.makeBoard(L, seeded(3)));
  const jackW = (b) => { const s = b.slots.find((x) => x.k === 'jack'); return s.x1 - s.x0; };
  assert.equal(B[0].slots.filter((s) => s.k === 'bust').length, 0);
  assert(B[4].slots.filter((s) => s.k === 'bust').length >= 3);
  assert(jackW(B[4]) < jackW(B[0]) && jackW(B[4]) >= 46);
  assert.equal(B[0].bumpers.length, 0); assert(B[4].bumpers.length >= 2 && B[4].spinners.length >= 2);
  assert.equal(B[0].wind.amp, 0); assert(B[4].wind.amp > B[2].wind.amp);
  assert(B[4].slots.some((s) => s.k === 'steal') && B[4].slots.some((s) => s.k === 'x2'));
});

test('lines: clamped, simplified, trimmed to the ink budget; garbage rejected', () => {
  const long = [Array.from({ length: 300 }, (_, i) => [i * 3, 300 + Math.sin(i / 9) * 40])];
  const c = PH.cleanStrokes(long, 400);
  assert(c.ok); assert(c.strokes[0].length <= 24);
  assert(PH.polyLen(c.strokes[0]) <= 401, 'ink budget');
  const two = PH.cleanStrokes([[[100, 400], [400, 400]], [[100, 600], [400, 600]]], 450);
  assert.equal(two.strokes.length, 2); assert(PH.polyLen(two.strokes[0]) + PH.polyLen(two.strokes[1]) <= 451);
  const clamp = PH.cleanStrokes([[[-500, -500], [5000, 99999]]], 9999);
  for (const [x, y] of clamp.strokes[0]) { assert(x >= 0 && x <= PH.W); assert(y >= PH.LINE_TOP && y <= PH.LINE_BOT); }
  for (const bad of ['x', 5, [[[1, 'a'], [2, 3]]], [[[NaN, 1], [2, 3]]], [[[Infinity, 1], [2, 3]]], [[null]], [{}], [[[1, 2]], [[1, 2]], [[1, 2]]], [Array(500).fill([1, 2])]]) assert.equal(PH.cleanStrokes(bad, 500).ok, false, JSON.stringify(bad).slice(0, 40));
  assert.deepEqual(PH.cleanStrokes([[[100, 400], [102, 401]]], 500).strokes, []); // too short: dropped
  assert.deepEqual(PH.cleanStrokes(null, 500).strokes, []);
});

test('bots play whole games (3, 4 and 5 rounds, every style); results() lists everyone best-first', () => {
  for (const [rounds, style] of [[3, 'classic'], [4, 'neon'], [5, 'chaos']]) {
    const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: rounds });
    room.addBots(6); room.settings.rounds = rounds; room.settings.style = style; assert(room.start().ok);
    const levels = [];
    let i = 0; while (room.game.phase !== 'over' && clock.step()) { if (room.game.phase === 'aim' && levels[levels.length - 1] !== room.game.round) levels.push(room.game.round); if (++i > 200000) throw new Error('never ended'); }
    const g = room.game, res = g.results();
    assert.equal(res.length, 6); assert.equal(new Set(res).size, 6);
    const tot = res.map((id) => g.ppl.get(id).total);
    for (let k = 1; k < tot.length; k++) assert(tot[k - 1] >= tot[k]);
    assert.equal(g.levelFor(1), 1); assert.equal(g.levelFor(rounds), 5);
    assert(g.round >= rounds);
    assert(g.tables[0].ghosts.length > 0, 'lines stay as ghosts');
    const tv = g.tv(); assert(Array.isArray(tv.awards) && tv.standings.length === 6);
    JSON.stringify(tv); for (const p of room.list()) JSON.stringify(g.view(p));
  }
});

test('results() is empty until the game is over', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 2 });
  room.addBots(3); room.start(); assert.deepEqual(room.game.results(), []);
});

test('phone input: drop spots clamped, bad moves rejected, wrong phase rejected', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 5 });
  const p = room.join('Ana').player; p.sockets = 1; room.addBots(2); room.start();
  assert.equal(room.act(p, { op: 'aim', x: 300 }).ok, false); // still the round intro
  until(room, clock, 'aim');
  for (const bad of [{ op: 'aim', x: 'x' }, { op: 'aim', x: NaN }, { op: 'aim' }, { op: 'aim', x: Infinity }, { op: 'aim', x: 500, power: 'nuke' }, { op: 'line', strokes: [] }, { op: 'nope' }, {}, null]) assert.equal(room.act(p, bad).ok, false, JSON.stringify(bad));
  const r = room.act(p, { op: 'aim', x: -9999, lock: false }); assert(r.ok); assert(r.x > 0);
  assert.equal(room.act(p, { op: 'aim', x: 99999, lock: false }).x < PH.W, true);
  const pw = room.game.ppl.get(p.id).powers[0];
  assert(room.act(p, { op: 'aim', x: 500, power: pw }).ok);
  until(room, clock, 'draw');
  assert.equal(room.game.ppl.get(p.id).powers.includes(pw) && room.game.ppl.get(p.id).powers.filter((k) => k === pw).length > 1, false);
  assert.equal(room.act(p, { op: 'aim', x: 500 }).ok, false);
  for (const bad of [{ op: 'line', strokes: 'zz' }, { op: 'line', strokes: [[[1, 2], [3, 'x']]] }, { op: 'line', strokes: [[], [], []] }]) assert.equal(room.act(p, bad).ok, false);
  const ink = room.game.inkFor(p.id);
  const ok = room.act(p, { op: 'line', strokes: [[[100, 300], [900, 300], [900, 1000]]], done: false });
  assert(ok.ok); assert(PH.polyLen(ok.strokes[0]) <= ink + 1);
  if (pw === 'ink') assert(ink > room.settings.ink);
  assert.equal(room.act(p, { op: 'line', strokes: [], target: p.id }).ok, false); // can't erase yourself (or without an eraser)
  assert(room.act(p, { op: 'line', strokes: ok.strokes, done: true }).ok);
});

test('scoring: slot values, ×2, bust, assists and sabotage from lines', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 11 });
  const a = room.join('Ana').player, b = room.join('Bo').player; a.sockets = b.sockets = 1;
  room.settings.powerups = false; room.start();
  const g = room.game; until(room, clock, 'aim');
  // put a hand-built board in: left half 100 pts, right half bust; a ramp from Ana sends Bo's ball left
  g.board = { ...g.board, pegs: [], bumpers: [], spinners: [], wind: { amp: 0, w: 1, ph: 0 }, slots: [{ x0: 0, x1: 500, k: 'pts', v: 100, label: '100' }, { x0: 500, x1: 1000, k: 'bust', v: -100, label: 'BUST' }] };
  assert(room.act(a, { op: 'aim', x: 200 }).ok); assert(room.act(b, { op: 'aim', x: 800 }).ok);
  assert.equal(g.phase, 'draw');
  assert(room.act(a, { op: 'line', strokes: [[[900, 300], [400, 520]]], done: true }).ok);
  assert(room.act(b, { op: 'line', strokes: [], done: true }).ok);
  assert.equal(g.phase, 'drop');
  until(room, clock, 'score');
  const A = g.ppl.get(a.id), B = g.ppl.get(b.id);
  assert.equal(A.items.find((x) => /Slot 100/.test(x.t)).v, 100);
  assert(A.items.some((x) => /Assist: Bo/.test(x.t) && x.v === 20), JSON.stringify(A.items));
  assert(B.items.some((x) => x.t === '🤝 Shared slot combo'), JSON.stringify(B.items));
  assert.equal(A.total, A.items.reduce((s, x) => s + x.v, 0));
  // sabotage: a ball pushed into the bust slot by someone else's line
  until(room, clock, 'aim');
  g.board = { ...g.board, pegs: [], bumpers: [], spinners: [], wind: { amp: 0, w: 1, ph: 0 }, slots: [{ x0: 0, x1: 500, k: 'x2', v: 0, label: '×2' }, { x0: 500, x1: 1000, k: 'bust', v: -100, label: 'BUST' }] };
  g.tables[0].ghosts = [];
  room.act(a, { op: 'aim', x: 200 }); room.act(b, { op: 'aim', x: 200 });
  room.act(a, { op: 'line', strokes: [[[100, 400], [700, 640]]], done: true }); room.act(b, { op: 'line', strokes: [], done: true });
  until(room, clock, 'score');
  assert(A.items.some((x) => /Sabotage/.test(x.t)) || B.items.some((x) => x.t === '✖️2 Round doubled'), JSON.stringify([A.items, B.items]));
  for (const P of [A, B]) assert(P.total >= 0);
});

test('a tie at the top goes to a sudden-death drop', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 9 });
  room.addBots(3); room.settings.rounds = 3; room.start();
  const g = room.game;
  let i = 0; while (!(g.round === 3 && g.phase === 'score') && clock.step()) if (++i > 100000) throw new Error('no last round');
  const ids = room.list().map((p) => p.id); g.ppl.get(ids[0]).total = 500; g.ppl.get(ids[1]).total = 500; g.ppl.get(ids[2]).total = 100;
  clock.step(); while (g.phase === 'score' && clock.step());
  assert(g.sudden, 'sudden death started'); assert.deepEqual(g.sudden.ids.sort(), [ids[0], ids[1]].sort());
  assert(g.board.sudden);
  playOut(room, clock);
  const res = g.results(); assert.equal(res.length, 3); assert.equal(res[0], g.sdOrder[0]); assert(res.slice(0, 2).includes(ids[0]) && res.slice(0, 2).includes(ids[1]));
  assert(g.tv().sdWinner);
});

test('big rooms split into tables of 10 that share one board; late joiners get seated', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 4 });
  room.addBots(32); room.start();
  const g = room.game; assert.equal(g.tables.length, 4); for (const t of g.tables) assert(t.ids.length <= 10);
  room.addBots(1); assert(g.tables.some((t) => t.ids.includes(room.list()[32].id)));
  until(room, clock, 'drop');
  const tv = g.tv(); assert.equal(tv.tables.length, 4);
  for (const t of tv.tables) assert(t.balls.length >= t.ids.length);
  playOut(room, clock); assert.equal(g.results().length, 33);
});

test('power-ups: twin drops two balls, eraser wipes a rival line, everyone gets one at the start', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 21 });
  const a = room.join('Ana').player, b = room.join('Bo').player; a.sockets = b.sockets = 1; room.start();
  const g = room.game; for (const id of [a.id, b.id]) assert.equal(g.ppl.get(id).powers.length, 1);
  until(room, clock, 'aim');
  g.ppl.get(a.id).powers = ['twin', 'eraser']; g.ppl.get(b.id).powers = ['eraser'];
  room.act(a, { op: 'aim', x: 300, power: 'twin' }); room.act(b, { op: 'aim', x: 600, power: 'eraser' });
  assert.deepEqual(g.ppl.get(a.id).powers, ['eraser']);
  assert(room.act(b, { op: 'line', strokes: [], target: a.id, done: false }).ok);
  room.act(a, { op: 'line', strokes: [[[200, 500], [400, 600]]], done: true }); room.act(b, { op: 'line', strokes: [], target: a.id, done: true });
  assert.equal(g.phase, 'drop');
  const T = g.run[0]; assert.equal(T.sim.balls.filter((x) => x.owner === a.id).length, 2); assert.deepEqual(T.erased, [a.id]);
  until(room, clock, 'score'); assert.equal(g.tables[0].ghosts.filter((x) => x.round === 1).length, 0, 'an erased line leaves no ghost');
});

console.log(`\n${passed} JustDrop tests passed.`);
