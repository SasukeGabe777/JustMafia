'use strict';
// DLC 1 roles: each mechanic, plus secrecy and the Judge pack.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
const R = require('../public/shared/roles');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function game(roles, extra = {}) {
  const clock = new VirtualClock(), room = new Room('DLC1', null, { clock, seed: 3 });
  const P = {};
  for (const name of Object.keys(roles)) { const p = room.join({ name }).player; p.sockets = 1; P[name] = p; }
  const counts = {}; for (const r of Object.values(roles)) if (r !== 'villager') counts[r] = (counts[r] || 0) + 1;
  room.updateSettings({ roleSelection: 'manual', autoMafia: false, roleCounts: counts, minPlayers: 3, botsAuto: false, skipCinematics: true, revealRoleOnDeath: true, ...extra });
  room.updateSettings({ forcedRoles: Object.fromEntries(Object.entries(roles).map(([n, r]) => [P[n].id, r])) });
  assert(room.hostAction({ type: 'start' }).ok); room.advance();
  assert.equal(room.phase, 'night');
  return { room, P };
}
const toMorning = (room) => { room.advance(); room.advance(); };
const toNight = (room) => { while (room.phase !== 'night' && room.phase !== 'gameover') room.advance(); };
const noteOf = (p, re) => p.notes.find((n) => re.test(n.text));

test('Ten DLC 1 roles exist with real descriptions and their own Judge pack', () => {
  assert.equal(R.ROLE_PACKS.dlc1.roles.length, 14);
  for (const k of R.ROLE_PACKS.dlc1.roles) { assert(R.ROLES[k], k); assert(R.ROLE_ORDER.includes(k), k); assert(R.reference(k).ability.length > 30, k); }
  assert.deepEqual(R.ROLE_PACKS.dlc1.roles.filter((k) => R.ROLES[k].team === 'mafia').sort(), ['framer', 'impostor', 'janitor']);
});

test('Framer makes the target look like Mafia tonight; Impostor always looks like a Town role', () => {
  const { room, P } = game({ Ma: 'mafia', Fr: 'framer', Im: 'impostor', Det: 'detective', Sor: 'sorcerer', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager', V6: 'villager', V7: 'villager' });
  room.nightAction(P.Fr, P.V1.id); room.nightAction(P.Det, P.V1.id); room.nightAction(P.Sor, P.Im.id);
  toMorning(room);
  assert.equal(P.Det.investigations[0].result, true, 'framed Villager looks Mafia');
  assert(R.ROLES[P.Sor.investigations[0].result].team === 'town', 'the Impostor fools even the Sorcerer');
  assert.equal(P.Sor.investigations[0].result, P.Im.impostorCover);
  toNight(room); room.nightAction(P.Det, P.V1.id); toMorning(room);
  assert.equal(P.Det.investigations[1].result, false, 'the frame lasts one night');
});

test('Medium learns a dead player’s role; Lookout learns who visited', () => {
  const { room, P } = game({ Ma: 'mafia', Med: 'medium', Look: 'lookout', Doc: 'doctor', V1: 'villager', V2: 'villager', V3: 'villager' });
  room.voteMafia(P.Ma, P.Doc.id); room.nightAction(P.Look, P.Doc.id);
  toMorning(room);
  assert(!P.Doc.alive);
  assert(noteOf(P.Look, /Doc's visitors last night: Ma/), 'Lookout names the visitor');
  toNight(room);
  assert.deepEqual(room.nightTargets(P.Med), [P.Doc.id], 'the Medium can only reach the dead');
  room.nightAction(P.Med, P.Doc.id); toMorning(room);
  assert.equal(P.Med.investigations[0].result, 'doctor');
});

test('Veteran on alert: the attack fails and every visitor dies (twice per game)', () => {
  const { room, P } = game({ M1: 'mafia', M2: 'mafia', Vet: 'veteran', Det: 'detective', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager' });
  assert.deepEqual(room.nightTargets(P.Vet), [P.Vet.id]);
  room.nightAction(P.Vet, P.Vet.id); room.voteMafia(P.M1, P.Vet.id); room.voteMafia(P.M2, P.Vet.id); room.nightAction(P.Det, P.Vet.id);
  toMorning(room);
  assert(P.Vet.alive, 'attacks on the Veteran fail');
  assert(!P.M1.alive && !P.M2.alive && !P.Det.alive, 'every visitor died, friend or foe');
});

test('Trapper: the trap takes a night to set, then stays until it catches the attacker', () => {
  const { room, P } = game({ Ma: 'mafia', Tr: 'trapper', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager' });
  room.nightAction(P.Tr, P.V1.id); room.voteMafia(P.Ma, P.V2.id);
  toMorning(room);
  assert(noteOf(P.Tr, /started setting a trap at V1/)); assert(!P.V2.alive);
  toNight(room); room.nightAction(P.Tr, 'pass'); room.voteMafia(P.Ma, P.V3.id); toMorning(room); // armed, waiting (elsewhere)
  assert(!P.V3.alive); assert.equal(P.Tr.trap.targetId, P.V1.id, 'still set');
  toNight(room); room.voteMafia(P.Ma, P.V1.id); toMorning(room);
  assert(P.V1.alive, 'the trap saved them');
  assert(noteOf(P.Tr, /SNAP! .*caught Ma/), 'the Trapper learns the attacker');
  assert.equal(P.Tr.trap, null, 'sprung: set a new one');
});

test('Cupid binds two players; when one dies the other dies of a broken heart (announced)', () => {
  const { room, P } = game({ Ma: 'mafia', Cu: 'cupid', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager' });
  room.nightAction(P.Cu, P.V1.id); toMorning(room);
  assert.equal(P.Cu.lover, P.V1.id); assert.equal(P.V1.lover, P.Cu.id);
  assert(noteOf(P.V1, /Cupid has bound you to Cu/));
  toNight(room);
  assert.equal(room.nightDef(P.Cu), null, 'once per game');
  room.voteMafia(P.Ma, P.V1.id); toMorning(room);
  assert(!P.V1.alive && !P.Cu.alive); assert.equal(P.Cu.deathCause, 'heartbreak');
  assert.match(room.narration.text, /Cu died of a broken heart/);
});

test('Janitor: the cleaned victim’s role stays hidden (even with role reveals on) until the game ends', () => {
  const { room, P } = game({ Ma: 'mafia', Jan: 'janitor', Doc: 'doctor', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager' });
  room.voteMafia(P.Ma, P.Doc.id); room.voteMafia(P.Jan, P.Doc.id); room.nightAction(P.Jan, P.Doc.id);
  toMorning(room);
  assert(!P.Doc.alive && P.Doc.cleaned);
  assert.equal(room.hostView().players.find((x) => x.id === P.Doc.id).role, null, 'TV: role hidden');
  assert(!/Doctor/.test(room.narration.text), 'the narrator does not say it');
  assert(noteOf(P.Jan, /they were the Doctor/), 'only the Janitor learns it');
  room.phase = 'gameover'; assert.equal(room.revealedRole(P.Doc), 'doctor', 'revealed at game over');
});

test('Eavesdropper hears Mafia messages without names; Town Crier proclaims once a day on the TV', () => {
  const { room, P } = game({ Ma: 'mafia', Ea: 'eavesdropper', Quill: 'crier', V1: 'villager', V2: 'villager', V3: 'villager' });
  P.Cr = P.Quill;
  assert(room.sendMafia(P.Ma, { tactic: 'wait' }).ok);
  const v = room.playerView(P.Ea);
  assert.equal(v.eavesdrop.length, 1); assert(!JSON.stringify(v.eavesdrop).includes(P.Ma.id) && !JSON.stringify(v.eavesdrop).includes('Ma:'));
  assert.equal(room.playerView(P.V1).eavesdrop, undefined);
  while (room.phase !== 'discussion') room.advance();
  assert.equal(room.dayAbility(P.Cr, { op: 'crier', targetId: P.V1.id, word: 'free text' }).ok, false, 'fixed proclamations only');
  assert(room.dayAbility(P.Cr, { op: 'crier', targetId: P.V1.id, word: 'IS SAFE' }).ok);
  assert.match(room.hostView().narration.text, /Town Crier proclaims: V1 IS SAFE/);
  assert(!room.hostView().narration.text.includes('Quill'), 'anonymous');
  assert.equal(room.dayAbility(P.Cr, { op: 'crier', targetId: P.V2.id, word: 'IS LYING' }).ok, false, 'once a day');
});

test('DLC 1 roles work in bot games end to end and can be drafted', () => {
  const D = require('../public/shared/draft');
  const seen = new Set(); for (let i = 0; i < 300; i++) D.candidates(12, {}, Math.random, {}).forEach((k) => seen.add(k));
  for (const k of R.ROLE_PACKS.dlc1.roles.filter((r) => !require('../public/shared/draft').META[r].companion)) assert(seen.has(k), 'draftable: ' + k); // the Priest rides with the Zombie
  const { simulateGame } = require('../sim');
  for (let s = 1; s <= 12; s++) {
    const r = simulateGame({ seed: s, players: 12, settings: { autoMafia: true, roleSelection: 'manual', roleCounts: { framer: 1, janitor: 1, medium: 1, lookout: 1, veteran: 1, trapper: 1, cupid: 1, eavesdropper: 1, crier: 1 } } });
    assert(r.winner, 'game finished: seed ' + s);
  }
});

console.log(`All ${passed} DLC 1 tests passed.`);
