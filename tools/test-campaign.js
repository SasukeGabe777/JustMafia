'use strict';
// Campaign mode: five chapters, recaps, scarred houses, a running score, a finale.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

test('Five chapters: recap, scars, score, finale; off by default', () => {
  const clock = new VirtualClock(); clock.advance = (ms) => { const end = clock.t + ms; while ([...clock.queue.values()].some((e) => e.at <= end)) clock.step(); clock.t = Math.max(clock.t, end); };
  const room = new Room('CMP', null, { clock, seed: 21 }); room.gamesPlayed = 4;
  assert.equal(room.settings.campaign, false);
  room.updateSettings({ minPlayers: 3, roleSelection: 'manual', autoMafia: true, roleCounts: { doctor: 1, detective: 1 }, botsAuto: true, skipCinematics: true, campaign: true });
  room.addBots(8);
  let lastFallen = [];
  for (let g = 1; g <= 5; g++) {
    assert(room.hostAction({ type: 'start' }).ok);
    assert.equal(room.campaign.chapter, g);
    assert.match(room.campaignIntro, new RegExp(`Chapter ${g} of 5`));
    if (g > 1) { assert.match(room.campaignIntro, /Last time/); for (const p of room.inGame()) if (lastFallen.includes(p.name)) assert.equal(p.houseState, 'damaged', 'scars remain'); }
    for (let i = 0; i < 6000 && room.phase !== 'gameover'; i++) clock.advance(500);
    assert.equal(room.phase, 'gameover');
    const c = room.hostView().campaign; assert.equal(c.chapter, g); assert.equal(c.town + c.mafia <= g, true);
    lastFallen = room.campaign.results[g - 1].fallen;
    if (g === 5) { assert(c.done); assert.match(room.narration.text, /campaign is over/); }
    room.hostAction({ type: 'lobby' });
  }
  room.hostAction({ type: 'start' }); assert.equal(room.campaign.chapter, 1, 'a new campaign starts after the finale');
});

console.log(`All ${passed} campaign tests passed.`);
