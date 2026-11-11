'use strict';
// Career stats: every finished game is recorded once (practice included), with role mastery,
// rivalries and recent games; the TV lobby ranks the room's players in a Hall of Fame.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
const { ProfileStore } = require('../profiles');
const { BotBrain } = require('../bots');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

test('Three games: careers, rivalries, mastery, Hall of Fame', () => {
  const profiles = new ProfileStore(), ids = [];
  for (let g = 0; g < 3; g++) {
    const clock = new VirtualClock(); clock.advance = (ms) => { const end = clock.t + ms; while ([...clock.queue.values()].some((e) => e.at <= end)) clock.step(); clock.t = Math.max(clock.t, end); };
    const room = new Room('CAR', null, { clock, seed: 10 + g, profiles }); room.gamesPlayed = 4;
    room.updateSettings({ minPlayers: 3, roleSelection: 'manual', autoMafia: true, roleCounts: { detective: 1, doctor: 1 }, botsAuto: true, skipCinematics: true });
    for (let i = 0; i < 3; i++) { if (!ids[i]) ids[i] = profiles.create().id; const p = room.join({ name: ['Ana', 'Ben', 'Cy'][i] }).player; p.profileId = ids[i]; p.sockets = 1; }
    room.addBots(6); room.hostAction({ type: 'start' });
    for (const p of room.inGame()) if (!p.isBot) { p.isBot = true; room.brains.set(p.id, new BotBrain(room.rng)); } // play the humans' turns too
    for (let i = 0; i < 6000 && room.phase !== 'gameover'; i++) clock.advance(500);
    assert.equal(room.phase, 'gameover');
    for (const p of room.inGame()) if (p.profileId) p.isBot = false;
    room.careersRecorded = null; room.recordCareers(); room.recordCareers(); // twice: still counted once
    room.resetToLobby();
    assert(room.hostView().hallOfFame.length === 3, 'Hall of Fame in the lobby');
  }
  for (const id of ids) {
    const c = profiles.view(id).career;
    assert.equal(c.games, 3, 'each game counted once'); assert.equal(c.history.length, 3);
    assert.equal(c.roles.reduce((n, r) => n + r.games, 0), 3);
    assert(c.wins <= 3 && c.survived <= 3);
  }
  const rivals = ids.map((id) => profiles.view(id).career.rivals);
  assert(rivals.some((r) => r.nemesis || r.critic), 'someone has a rival');
  assert.equal(ProfileStore.masteryTitle(4), null); assert.equal(ProfileStore.masteryTitle(5), 'Apprentice'); assert.equal(ProfileStore.masteryTitle(15), 'Expert'); assert.equal(ProfileStore.masteryTitle(30), 'Master');
});

console.log(`All ${passed} career tests passed.`);
