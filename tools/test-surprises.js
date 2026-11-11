'use strict';
// Daily Surprises (Judge event): random night twists. Festival = no Mafia kill; Fog = no
// visit information; Blood Moon = two kills; never the same twist twice in a row.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function game(seed) {
  const clock = new VirtualClock(), room = new Room('SUR', null, { clock, seed });
  const names = ['Ma', 'Lo', 'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10'], P = {};
  for (const name of names) { const p = room.join({ name }).player; p.sockets = 1; P[name] = p; }
  room.updateSettings({ roleSelection: 'manual', autoMafia: false, roleCounts: { mafia: 1, lookout: 1 }, minPlayers: 3, botsAuto: false, skipCinematics: true, event: 'surprises' });
  room.updateSettings({ forcedRoles: { [P.Ma.id]: 'mafia', [P.Lo.id]: 'lookout' } });
  assert(room.hostAction({ type: 'start' }).ok);
  return { room, P };
}

test('Festival, Fog and Blood Moon nights each do what they say', () => {
  const seen = new Set();
  for (let seed = 1; seed < 40 && seen.size < 3; seed++) {
    const { room, P } = game(seed);
    let last = null;
    for (let n = 0; n < 5 && room.phase !== 'gameover'; n++) {
      while (room.phase !== 'night' && room.phase !== 'gameover') room.advance();
      if (room.phase === 'gameover') break;
      const kind = room.night.surprise || null;
      if (kind) { assert.notEqual(kind, last, 'never twice in a row'); assert.match(room.narration.text, /fog|festival|blood red/i); }
      last = kind;
      const target = room.alive().find((p) => !['Ma', 'Lo'].includes(p.name));
      room.voteMafia(P.Ma, target.id); room.nightAction(P.Lo, target.id);
      const before = room.alive().length, notesBefore = P.Lo.notes.length, watching = P.Lo.alive; room.advance(); room.advance();
      const died = before - room.alive().length;
      if (kind === 'festival') { seen.add(kind); assert.equal(died, 0, 'festival: no Mafia kill'); }
      if (kind === 'bloodMoon') { seen.add(kind); assert.equal(died, 2, 'blood moon: two kills'); }
      if (kind === 'fog' && watching) { seen.add(kind); const note = P.Lo.notes.slice(notesBefore).find((x) => /visitors last night/.test(x.text)); assert(note && /nobody/.test(note.text), 'fog: the Lookout saw nothing'); }
      if (!kind && died) assert.equal(died, 1);
    }
  }
  assert.deepEqual([...seen].sort(), ['bloodMoon', 'festival', 'fog'], 'all three twists happen');
});

console.log(`All ${passed} surprise tests passed.`);
