'use strict';
// Bots play their roles and think out loud (TV bubbles + the phones' Town talk feed).
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function botGame(seed) {
  const clock = new VirtualClock();
  clock.advance = (ms) => { const end = clock.t + ms; while ([...clock.queue.values()].some((e) => e.at <= end)) clock.step(); clock.t = Math.max(clock.t, end); };
  const room = new Room('BOTS', null, { clock, seed });
  room.gamesPlayed = 4;
  room.updateSettings({ minPlayers: 3, roleSelection: 'manual', autoMafia: true, roleCounts: { detective: 1, doctor: 1, sheriff: 1, sorcerer: 1, jester: 1, trapper: 1 }, botsAuto: true, skipCinematics: true });
  room.addBots(11); room.hostAction({ type: 'start' });
  const said = new Map();
  for (let i = 0; i < 6000 && room.phase !== 'gameover'; i++) { clock.advance(500); for (const a of room.accusations) said.set(a.id, a); }
  return { room, said: [...said.values()] };
}

test('Bots finish games and talk all day: reactions, claims, accusations, vote reasons', () => {
  const all = [], kinds = new Set(), phases = new Set();
  for (const seed of [3, 7, 11]) {
    const { room, said } = botGame(seed);
    assert.equal(room.phase, 'gameover', `seed ${seed} finished`);
    for (const a of said) {
      assert(a.text && !/undefined|null|NaN|\$\{/.test(a.text), `clean line: ${a.text}`);
      assert(a.kind === 'say' || room.players.get(a.targetId), 'targets a real player');
      kinds.add(a.kind); phases.add(a.phase); all.push(a);
      const from = room.players.get(a.fromId), to = a.targetId && room.players.get(a.targetId);
      if (from && to && room.team(from) === 'mafia' && a.kind !== 'say') assert(!(room.team(to) === 'mafia' && a.verdict === 'evil'), 'the Mafia never out a teammate');
    }
  }
  assert(all.length >= 30, `bots spoke ${all.length} times`);
  for (const k of ['say', 'accuse', 'claim']) assert(kinds.has(k), `has ${k}`);
  assert(phases.has('voting'), 'they explain their votes');
  assert(new Set(all.map((a) => a.text)).size > all.length * 0.5, 'varied lines');
});

test('Information roles share findings; bots never speak for the dead', () => {
  let finds = 0;
  for (const seed of [5, 3, 7]) {
    const { room, said } = botGame(seed);
    finds += said.filter((a) => a.kind === 'claim' && /checked|Checked|guilty|clean|Investigated/.test(a.text)).length;
    for (const a of said) { const p = room.players.get(a.fromId); assert(p && !(p.diedDay != null && p.diedDay < a.day), 'the dead stay quiet'); }
  }
  assert(finds >= 1, 'someone shared a finding');
});

console.log(`All ${passed} bot tests passed.`);
