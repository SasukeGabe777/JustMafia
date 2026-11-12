'use strict';
// The role reveal moves on when every player on a phone has looked at their card, and never
// waits more than 60 seconds for anyone who hasn't (also when the Judge narrates in person).
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

function setup(settings = {}) {
  const clock = new VirtualClock(); clock.advance = (ms) => { const end = clock.t + ms; while ([...clock.queue.values()].some((e) => e.at <= end)) clock.step(); clock.t = Math.max(clock.t, end); };
  const room = new Room('REV', null, { clock, seed: 3 });
  room.updateSettings({ minPlayers: 3, roleSelection: 'manual', autoMafia: true, roleCounts: { doctor: 1 }, botsAuto: false, ...settings });
  const humans = ['Ana', 'Ben', 'Cy', 'Di'].map((name) => { const p = room.join({ name }).player; p.sockets = 1; return p; });
  room.addBots(2);
  assert(room.hostAction({ type: 'start' }).ok); assert.equal(room.phase, 'roleReveal');
  return { room, clock, humans };
}

test('Nobody looks: the reveal moves on after 60 seconds', () => {
  const { room, clock } = setup();
  assert.equal(room.endsAt - room.now(), 60000);
  clock.advance(59000); assert.equal(room.phase, 'roleReveal');
  clock.advance(1500); assert.equal(room.phase, 'night');
});

test('Everyone looks: it carries on right after the reveal scene (bots and disconnected players don’t hold it up)', () => {
  const { room, clock, humans } = setup();
  humans[3].sockets = 0; // left their phone
  for (const p of humans.slice(0, 3)) { clock.advance(1000); room.flipCard(p); }
  assert(room.endsAt - room.now() <= 14000, 'no longer waits the full minute');
  clock.advance(14000); assert.equal(room.phase, 'night');
});

test('Some look: still waits for the rest, up to the minute', () => {
  const { room, clock, humans } = setup();
  room.flipCard(humans[0]); room.flipCard(humans[1]);
  clock.advance(30000); assert.equal(room.phase, 'roleReveal');
  clock.advance(31000); assert.equal(room.phase, 'night');
});

test('A Judge narrating in person: the reveal is still capped at 60 seconds', () => {
  const { room, clock } = setup({ narratorMode: 'human' });
  assert(room.endsAt, 'the reveal has a timer');
  clock.advance(61000); assert.equal(room.phase, 'night');
  assert.equal(room.endsAt, null, 'the rest of the game is still paced by the Judge');
});

console.log(`All ${passed} role reveal tests passed.`);
