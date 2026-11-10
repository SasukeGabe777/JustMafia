'use strict';
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
function game(roles, settings = {}) {
  const clock = new VirtualClock(), room = new Room('STORY', null, { clock, headless: true, seed: 45 });
  const counts = {}; roles.forEach((r) => { if (r !== 'villager') counts[r] = (counts[r] || 0) + 1; });
  room.updateSettings({ minPlayers: 3, maxPlayers: 100, autoMafia: false, roleCounts: counts, botsAuto: false, ...settings });
  room.addBots(roles.length); const p = room.list();
  room.updateSettings({ forcedRoles: Object.fromEntries(p.map((p, i) => [p.id, roles[i]])) });
  const result = room.startGame(); assert(result.ok, result.error); room.advance();
  return { room, p, clock };
}
const morning = (room) => { room.resolveNight(); room.startMorning(); };
const discussion = (room) => { morning(room); room.startDiscussion(); };
module.exports = { assert, game, morning, discussion };
