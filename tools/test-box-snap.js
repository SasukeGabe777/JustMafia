'use strict';
// JustSnap rules: played to the end by bots on a virtual clock.  node tools/test-box-snap.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/snap');
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
test('bots play a whole game; results() lists everyone best-first', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 1 });
  room.addBots(6); assert(room.start().ok);
  let i = 0; while (room.game.phase !== 'over' && clock.step()) if (++i > 100000) throw new Error('never ended');
  assert.equal(room.game.results().length, 6);
});
test('phone input is validated', () => {
  const room = new BoxRoom('TEST', def, { clock: new VirtualClock() }); const p = room.join('Ana').player; room.addBots(2); room.start();
  for (const bad of [{ op: 'pick', v: 9 }, { op: 'pick', v: 'x' }, { op: 'nope' }, {}]) assert.equal(room.act(p, bad).ok, false);
});
console.log(`\n${passed} JustSnap tests passed.`);
