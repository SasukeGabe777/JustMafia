'use strict';
// Live reactions: only your pack (or the free classic one), only during the game, rate-limited,
// and they go to the TV only.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
const O = require('../public/shared/options');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

test('Reactions: pack rules, phases, cooldown, TV-only', () => {
  const sent = [];
  const io = { to: (ch) => ({ emit: (ev, data) => sent.push({ ch, ev, data }) }) };
  const clock = new VirtualClock(), room = new Room('RX', io, { clock, seed: 2 });
  room.sync = () => {}; // this test only watches reactions
  room.updateSettings({ minPlayers: 3, roleSelection: 'manual', botsAuto: false, skipCinematics: true });
  const ps = ['Ana', 'Ben', 'Cy', 'Di'].map((name) => room.join({ name }).player);
  assert.equal(room.react(ps[0], '😂').ok, false, 'not in the lobby');
  room.hostAction({ type: 'start' }); room.advance();
  assert(room.react(ps[0], '😂').ok, 'classic reaction');
  assert.equal(sent.at(-1).ev, 'host:react'); assert.equal(sent.at(-1).ch, room.hostChannel()); assert.deepEqual(sent.at(-1).data, { playerId: ps[0].id, emoji: '😂' });
  assert.match(room.react(ps[0], '😱').error, /Easy/, 'cooldown');
  clock.t += 2000;
  assert.equal(room.react(ps[0], '👻').ok, false, 'not in your pack');
  ps[0].avatar.reactions = 'rxSpooky';
  assert(room.react(ps[0], '👻').ok, 'equipped pack');
  clock.t += 2000; assert(room.react(ps[0], '👍').ok, 'classic always works');
  assert.equal(room.react(ps[1], '<script>').ok, false);
  assert.equal(O.REACTION_PACKS.rxClassic.length, 6);
});

console.log(`All ${passed} reaction tests passed.`);
