'use strict';
// Bomb Squad rules: bots defuse whole games on a virtual clock; every rule, strike, the needy
// radio, squads, the manual split, input validation and results().  node tools/test-box-bomb.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/bomb');
const R = def._rules;
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const run = (room, clock, until) => { let i = 0; while (!until() && clock.step()) if (++i > 200000) throw new Error('never ended'); };
const toTick = (room, clock) => run(room, clock, () => room.game.phase === 'tick');
function setup(n, opts = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: opts.seed || 7 });
  const humans = [];
  for (let i = 0; i < (opts.humans || 0); i++) humans.push(room.join('Hum' + i).player);
  room.addBots(n - humans.length);
  Object.assign(room.settings, opts.settings || {});
  assert(room.start().ok);
  return { clock, room, g: room.game, humans };
}

test('bots play a whole game; results() lists everyone best-first by contribution', () => {
  const { clock, room, g } = setup(6);
  assert.deepEqual(g.results(), [], 'no results before the end');
  run(room, clock, () => g.phase === 'over');
  const res = g.results();
  assert.equal(res.length, 6);
  const pts = res.map((id) => g.stats.get(id).points);
  for (let i = 1; i < pts.length; i++) assert(pts[i - 1] >= pts[i], 'sorted by points');
  assert.equal(g.history.length, 4, 'four bombs by default');
  assert(g.final && g.final.played === 4 && g.final.team === g.team);
  assert(g.team > 0, 'the team scored');
});

test('every module rule: the right moves solve it, a wrong move is a strike', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { clock, room, g } = setup(3, { seed, humans: 1, settings: { bombs: 5 } });
    // skip ahead to a 6-module bomb so every type shows up
    for (let r = 1; r < 4; r++) { toTick(room, clock); g.next(); run(room, clock, () => g.phase === 'reveal'); g.next(); }
    toTick(room, clock);
    const sq = g.squads[0], b = sq.bomb;
    assert.equal(b.mods.length, 6);
    for (const m of b.mods) {
      const p = room.get(m.owner);
      for (const mv of g.rightMoves(b, m)) assert(room.act(p, mv).ok);
      assert(m.solved || b.status !== 'live', `${m.type} solved by its answer (seed ${seed})`);
    }
    assert.equal(b.status, 'defused');
  }
  const { clock, room, g } = setup(3, { seed: 3, humans: 1 });
  toTick(room, clock);
  const b = g.squads[0].bomb, m = b.mods[0], p = room.get(m.owner);
  const before = b.endsAt;
  const mv = g.wrongMoves(b, m)[0];
  assert.equal(room.act(p, mv).result, 'strike');
  assert.equal(b.strikes, 1);
  assert.equal(before - b.endsAt, 15000, 'a strike burns 15 seconds');
});

test('three strikes is BOOM, and so is the clock running out', () => {
  const { clock, room, g } = setup(2, { humans: 2 });
  toTick(room, clock);
  const sq = g.squads[0], b = sq.bomb, p = room.get(sq.defusers[0]);
  const w = b.mods.find((m) => m.type === 'glyphs');
  for (let i = 0; i < 3; i++) room.act(p, g.wrongMoves(b, w)[0]);
  assert.equal(b.status, 'boom'); assert.equal(g.phase, 'reveal');
  run(room, clock, () => g.phase === 'tick');
  const b2 = g.squads[0].bomb;
  run(room, clock, () => b2.status !== 'live');
  assert.equal(b2.status, 'boom'); assert.equal(b2.why, 'time');
});

test('the manual is split: each module’s two halves go to different experts', () => {
  const { clock, room, g } = setup(5, { humans: 5 });
  toTick(room, clock);
  const sq = g.squads[0];
  assert.equal(sq.defusers.length, 1);
  for (const t of sq.bomb.mods.map((m) => m.type)) {
    const a = sq.holders.get(t + ':A'), bb = sq.holders.get(t + ':B');
    assert(a.length && bb.length, 'both halves dealt');
    assert(a.every((id) => !bb.includes(id)), 'different experts');
  }
  for (const id of sq.members) if (!sq.defusers.includes(id)) assert(sq.pages.get(id).length >= 1, 'every expert has a page');
  const ex = room.get(sq.members.find((id) => !sq.defusers.includes(id)));
  const v = g.view(ex);
  assert.equal(v.role, 'expert'); assert(v.pages.length && v.pages[0].title);
  assert(!v.plate, 'experts never see the bomb plate');
  assert(v.bomb.mods.every((m) => !m.wires && !m.keys && !m.word), 'experts never see module details');
  const dv = g.view(room.get(sq.defusers[0]));
  assert.equal(dv.role, 'defuser'); assert(dv.plate.serial); assert(!dv.manual, 'human experts: no manual for the defuser');
  assert(dv.help.wires.length >= 2, 'the defuser knows who to ask');
});

test('a human defuser with only bot experts gets the manual', () => {
  const { clock, room, g, humans } = setup(4, { humans: 1 });
  for (let r = 0; r < 4 && g.phase !== 'over'; r++) {
    toTick(room, clock);
    const sq = g.squads[0];
    if (sq.defusers.includes(humans[0].id)) { const v = g.view(humans[0]); assert(v.manual && v.manual.length >= 6); return; }
    g.next(); run(room, clock, () => g.phase === 'reveal'); g.next();
  }
  assert.fail('the human never defused');
});

test('defusers rotate every bomb', () => {
  const { clock, room, g } = setup(4, { humans: 4 });
  const seen = new Set();
  for (let r = 0; r < 4; r++) { toTick(room, clock); seen.add(g.squads[0].defusers[0]); g.next(); run(room, clock, () => g.phase !== 'tick'); if (g.phase === 'reveal') g.next(); }
  assert.equal(seen.size, 4);
});

test('the bombs ramp up: more modules, the needy radio, a tighter clock per module', () => {
  const { clock, room, g } = setup(3, { settings: { bombs: 5 } });
  const seen = [];
  for (let r = 0; r < 5; r++) { toTick(room, clock); seen.push([g.nMods, !!g.squads[0].bomb.radio, g.secs]); g.next(); run(room, clock, () => g.phase !== 'tick'); if (g.phase === 'reveal') g.next(); }
  assert.deepEqual(seen.map((x) => x[0]), [3, 4, 5, 6, 6]);
  assert.deepEqual(seen.map((x) => x[1]), [false, false, true, true, true]);
  assert(seen[4][2] / 6 < seen[0][2] / 3, 'less time per module later');
});

test('the radio: answer the callsign’s channel in time, or strike', () => {
  const { clock, room, g, humans } = setup(2, { humans: 2, settings: { bombs: 3 } });
  for (let r = 0; r < 2; r++) { toTick(room, clock); g.next(); run(room, clock, () => g.phase === 'reveal'); g.next(); }
  toTick(room, clock);
  const sq = g.squads[0], b = sq.bomb, p = room.get(sq.defusers[0]);
  assert(b.radio);
  assert.equal(room.act(p, { op: 'radio', ch: 1 }).ok, false, 'radio quiet at first');
  run(room, clock, () => b.radio.active);
  const v = g.view(p); assert(v.radio && v.radio.call);
  const other = humans.find((h) => h.id !== p.id);
  assert.equal(room.act(other, { op: 'radio', ch: 1 }).ok, false, 'only the defuser');
  for (const bad of [0, 7, '3', 2.5, null]) assert.equal(room.act(p, { op: 'radio', ch: bad }).ok, false);
  const right = R.CALLSIGNS[b.radio.call][1];
  assert.equal(room.act(p, { op: 'radio', ch: right }).result, 'solved');
  assert.equal(b.strikes, 0);
  run(room, clock, () => b.radio.active || b.status !== 'live');
  if (b.status === 'live') { const s0 = b.strikes; run(room, clock, () => !b.radio.active); assert.equal(b.strikes, s0 + 1, 'ignored radio = strike'); }
});

test('big groups split into parallel squads, each with its own bomb', () => {
  const { clock, room, g } = setup(20);
  assert.equal(g.squads.length, 4);
  for (const q of g.squads) assert.equal(q.members.length, 5);
  toTick(room, clock);
  const serials = new Set(g.squads.map((q) => q.bomb.serial));
  assert.equal(serials.size, 4);
  const s = g.tv(); assert.equal(s.squads.length, 4);
  run(room, clock, () => g.phase === 'over');
  assert.equal(g.results().length, 20);
  const one = setup(12, { settings: { squads: 'one' } });
  assert.equal(one.g.squads.length, 1);
  toTick(one.room, one.clock);
  assert.equal(one.g.squads[0].defusers.length, 3, 'a big squad gets three defusers');
  const owners = new Set(one.g.squads[0].bomb.mods.map((m) => m.owner)); assert(owners.size >= 2, 'modules split between defusers');
});

test('phone input is validated', () => {
  const { clock, room, g, humans } = setup(3, { humans: 3 });
  const [a] = humans;
  assert.equal(room.act(a, { op: 'cut', mod: 0, wire: 0 }).ok, false, 'not armed yet');
  toTick(room, clock);
  const sq = g.squads[0], b = sq.bomb, d = room.get(sq.defusers[0]), ex = room.get(sq.members.find((id) => !sq.defusers.includes(id)));
  const idx = (t) => b.mods.findIndex((m) => m.type === t);
  for (const bad of [{}, { op: 'nope' }, { op: 'cut' }, { op: 'cut', mod: 9, wire: 0 }, { op: 'cut', mod: -1, wire: 0 }, { op: 'cut', mod: '0', wire: 0 },
    { op: 'cut', mod: idx('wires'), wire: 99 }, { op: 'cut', mod: idx('wires'), wire: 'x' }, { op: 'glyph', mod: idx('wires'), key: 0 },
    { op: 'plunger', mod: idx('plunger'), how: 'smash' }, { op: 'plunger', mod: idx('plunger'), how: 'hold', at: 9 }, { op: 'glyph', mod: idx('glyphs'), key: 4 },
    { op: 'glyph', mod: idx('glyphs'), key: 1.5 }, { op: 'radio', ch: 2 }]) assert.equal(room.act(d, bad).ok, false, JSON.stringify(bad));
  assert.equal(room.act(ex, { op: 'cut', mod: idx('wires'), wire: 0 }).ok, false, 'experts can’t touch the bomb');
  assert.equal(room.act(d, null).ok, false);
  assert.equal(b.strikes, 0, 'invalid input never strikes');
});

test('scoring: defuser and the right page-holders get credit', () => {
  const { clock, room, g } = setup(4, { humans: 4 });
  toTick(room, clock);
  const sq = g.squads[0], b = sq.bomb, d = room.get(sq.defusers[0]), m = b.mods[0];
  const helpers = new Set([...sq.holders.get(m.type + ':A'), ...sq.holders.get(m.type + ':B')]);
  const others = sq.members.filter((id) => id !== d.id && !helpers.has(id));
  for (const mv of g.rightMoves(b, m)) room.act(d, mv);
  assert.equal(g.stats.get(d.id).points, 150);
  for (const id of helpers) assert.equal(g.stats.get(id).points, 100);
  for (const id of others) assert.equal(g.stats.get(id).points, 0);
  for (const mm of b.mods) for (const mv of g.rightMoves(b, mm)) room.act(room.get(mm.owner), mv);
  assert.equal(b.status, 'defused');
  for (const id of sq.members) assert(g.stats.get(id).points >= 200, 'defused bonus for the whole squad');
});

test('players joining and leaving mid-bomb', () => {
  const { clock, room, g, humans } = setup(3, { humans: 3 });
  toTick(room, clock);
  const late = room.join('Late').player;
  const v = g.view(late); assert.equal(v.role, 'expert'); assert(v.pages.length >= 1, 'a late joiner gets a page');
  const sq = g.squads[0], d = sq.defusers[0];
  room.remove(d);
  assert.equal(sq.defusers.length, 1); assert.notEqual(sq.defusers[0], d);
  assert(sq.bomb.mods.every((m) => m.owner === sq.defusers[0]), 'modules move to the new defuser');
  for (const h of humans) if (room.get(h.id)) room.remove(h.id);
  room.remove(late.id);
  run(room, clock, () => g.phase === 'over');
  assert.deepEqual(g.results(), []);
});

test('the rule book is consistent (maps solvable, manual complete)', () => {
  for (const m of R.MAPS) for (let a = 0; a < 25; a++) assert(R.mazePath(R.MAPS.indexOf(m), a, 24).length || a === 24, 'every square reaches every other');
  for (const t of ['wires', 'plunger', 'glyphs', 'maze', 'dial', 'lamps', 'radio']) for (const part of ['A', 'B']) assert(R.MANUAL[t][part].title && R.MANUAL[t][part].lines.length);
  assert.equal(new Set(R.GLYPHS).size, 24);
});

console.log(`\n${passed} Bomb Squad tests passed.`);
