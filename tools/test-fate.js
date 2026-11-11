'use strict';
// Fate Tokens and Fate Cards: earn/buy/trade, Role Wish, Team Wish, Reroll.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
const { ProfileStore } = require('../profiles');
const { FATE } = require('../public/shared/cosmetics');
const { ROLES } = require('../public/shared/roles');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

test('Tokens: a starter gift, earned by wins/challenges/new worlds, traded for gold; cards cost tokens', () => {
  const s = new ProfileStore(), a = s.create(), P = () => s.view(a.id);
  assert.equal(P().fate, FATE.starter);
  assert(s.buyFate(a.id, 'wish').ok); assert.equal(P().fate, FATE.starter - FATE.cards.wish.cost); assert.equal(P().fateCards.wish, 1);
  assert.match(s.buyFate(a.id, 'reroll').error, /costs 1 Fate Token; you have 0/);
  const r = s.award(a.id, 'g1', { won: true, alive: true, team: 'town', metrics: {}, theme: 'noir' });
  assert.equal(r.fate, FATE.perWin + FATE.perNewWorld); assert.equal(P().fate, 2);
  assert.match(s.exchangeFate(a.id).error, /costs 120 gold/);
  s.grant(a.id, 200); assert(s.exchangeFate(a.id).ok); assert.equal(P().fate, 3);
  assert.equal(s.buyFate(a.id, 'bogus').ok, false);
});

function lobby(names) {
  const clock = new VirtualClock(), profiles = new ProfileStore(), room = new Room('FATE', null, { clock, seed: 4, profiles });
  room.updateSettings({ minPlayers: 3, roleSelection: 'manual', autoMafia: true, roleCounts: { detective: 1, doctor: 1 }, botsAuto: false, skipCinematics: true });
  const P = {};
  for (const name of names) { const auth = profiles.create(); const p = room.join({ name }).player; p.profileId = auth.id; p.sockets = 1; P[name] = p; }
  return { room, profiles, P };
}

test('Role Wish: granted if the role is in the game (card spent); otherwise kept', () => {
  for (let k = 0; k < 4; k++) {
    const { room, profiles, P } = lobby(['Ana', 'Ben', 'Cy', 'Di', 'Eve', 'Fay']);
    assert.match(room.setWish(P.Ana, { type: 'role', value: 'doctor' }).error, /need a Role Wish/);
    profiles.data.profiles[P.Ana.profileId].fateCards.wish = 1;
    profiles.data.profiles[P.Ben.profileId].fateCards.wish = 1;
    assert(room.setWish(P.Ana, { type: 'role', value: 'doctor' }).ok);
    assert(room.setWish(P.Ben, { type: 'role', value: 'sorcerer' }).ok, 'a role not in this game');
    assert(room.hostAction({ type: 'start' }).ok);
    assert.equal(P.Ana.role, 'doctor', 'the wish came true');
    assert.equal(profiles.view(P.Ana.profileId).fateCards.wish, 0, 'spent');
    assert.equal(profiles.view(P.Ben.profileId).fateCards.wish, 1, 'kept: the Sorcerer was not in the game');
  }
});

test('Team Wish leans you to a side; Reroll swaps within your team (once, during the reveal)', () => {
  const { room, profiles, P } = lobby(['Ana', 'Ben', 'Cy', 'Di', 'Eve', 'Fay', 'Gus']);
  profiles.data.profiles[P.Ana.profileId].fateCards.team = 1;
  profiles.data.profiles[P.Ben.profileId].fateCards.reroll = 1;
  assert(room.setWish(P.Ana, { type: 'team', value: 'mafia' }).ok);
  assert.match(room.rerollRole(P.Ben).error, /Reroll while you look/);
  assert(room.hostAction({ type: 'start' }).ok);
  assert.equal(ROLES[P.Ana.role].team, 'mafia');
  assert.equal(room.phase, 'roleReveal');
  const team = ROLES[P.Ben.role].team, before = { ...room.composition };
  assert(room.playerView(P.Ben).fate.canReroll);
  const r = room.rerollRole(P.Ben);
  assert(r.ok, r.error);
  {
    assert.equal(ROLES[P.Ben.role].team, team, 'same team'); assert.equal(room.composition[r.role] >= 1, true, 'the new role is in the game');
    assert.equal(Object.values(room.composition).reduce((a, b) => a + b, 0), Object.values(before).reduce((a, b) => a + b, 0), 'same number of roles');
    assert.equal(profiles.view(P.Ben.profileId).fateCards.reroll, 0);
    assert.match(room.rerollRole(P.Ben).error, /already rerolled/);
  }
});

console.log(`All ${passed} Fate tests passed.`);
