'use strict';
// End-of-game movie credits: only at game over; full cast with fates; awards and highlights are real.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

test('Credits appear only at game over, with the whole cast, awards, numbers and highlights', () => {
  for (const seed of [3, 7]) {
    const clock = new VirtualClock();
    clock.advance = (ms) => { const end = clock.t + ms; while ([...clock.queue.values()].some((e) => e.at <= end)) clock.step(); clock.t = Math.max(clock.t, end); };
    const room = new Room('CRED', null, { clock, seed }); room.gamesPlayed = 4;
    room.updateSettings({ minPlayers: 3, roleSelection: 'manual', autoMafia: true, roleCounts: { detective: 1, doctor: 1, sheriff: 1 }, botsAuto: true, skipCinematics: true });
    room.addBots(10); room.hostAction({ type: 'start' });
    clock.advance(30000);
    assert.equal(room.hostView().credits, undefined, 'no spoilers during the game');
    for (let i = 0; i < 6000 && room.phase !== 'gameover'; i++) clock.advance(500);
    const cr = room.hostView().credits, player = room.playerView(room.inGame()[0]).credits;
    assert(cr && player, 'TV and phones get the credits');
    assert.equal(cr.cast.length, room.inGame().length);
    for (const c of cr.cast) { assert(c.roleName && c.fate && c.team, JSON.stringify(c)); assert.equal(c.alive, room.players.get(c.id).alive); }
    assert(cr.awards.length >= 2 && cr.awards.every((a) => room.players.get(a.id) && a.label && a.emoji));
    assert(cr.awards.some((a) => a.label === 'Most Valuable Player'));
    assert(cr.stats.length >= 3);
    for (const h of cr.highlights) assert(room.players.get(h.targetId) && /Night \d/.test(h.title));
    assert.strictEqual(room.credits(), room.credits(), 'built once per game');
  }
});

console.log(`All ${passed} credits tests passed.`);
