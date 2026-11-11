'use strict';
// Role uniqueness pass: each role reads the night its own way.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function game(roles, extra = {}) {
  const clock = new VirtualClock(), room = new Room('BAL', null, { clock, seed: 11 });
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
const note = (p, re) => p.notes.find((n) => re.test(n.text));
const last = (p) => p.investigations[p.investigations.length - 1];

test('Sheriff: catches whoever was out killing tonight (not a team check)', () => {
  const { room, P } = game({ M1: 'mafia', M2: 'mafia', Sh: 'sheriff', S2: 'sheriff', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager' });
  room.voteMafia(P.M1, P.V1.id); room.voteMafia(P.M2, P.V1.id);
  room.nightAction(P.Sh, P.M2.id); room.nightAction(P.S2, P.V2.id);
  toMorning(room);
  assert.equal(last(P.Sh).result, true, 'a Mafia who voted for the kill was out killing');
  assert.equal(last(P.S2).result, false, 'an innocent stayed clean');
  toNight(room); room.nightAction(P.Sh, P.M1.id); toMorning(room); // no kill vote from M1 tonight
  assert.equal(last(P.Sh).result, false, 'a Mafia member who sat out the kill looks clean: different from the Detective');
});

test('Detective sees through the Impostor; the Sorcerer reads two fates (one true) and is fooled by the cover', () => {
  const { room, P } = game({ Ma: 'mafia', Imp: 'impostor', De: 'detective', So: 'sorcerer', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager' });
  room.nightAction(P.De, P.Imp.id); room.nightAction(P.So, P.Ma.id); room.voteMafia(P.Ma, P.V1.id); room.voteMafia(P.Imp, P.V1.id);
  toMorning(room);
  assert.equal(last(P.De).result, true, 'the Detective sees the Impostor as Mafia');
  const r = last(P.So); assert.equal(r.options.length, 2); assert(r.options.includes('mafia')); assert.notEqual(r.options[0], r.options[1]);
  toNight(room); room.nightAction(P.So, P.Imp.id); room.voteMafia(P.Ma, P.V2.id); toMorning(room);
  assert(last(P.So).options.includes(P.Imp.impostorCover), 'role readings see the cover story');
});

test('Hunter: the Mafia learn the role, and the prey wakes knowing it was hunted', () => {
  const { room, P } = game({ Ma: 'mafia', Hu: 'hunter', Doc: 'doctor', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager' });
  room.nightAction(P.Hu, P.Doc.id); room.voteMafia(P.Ma, P.V1.id); room.voteMafia(P.Hu, P.V1.id);
  toMorning(room);
  assert.equal(last(P.Hu).result, 'doctor'); assert(note(P.Doc, /hunted you/));
});

test('Vigilante: two bullets; killing a Town member puts the gun away', () => {
  const { room, P } = game({ Ma: 'mafia', Vi: 'vigilante', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager' });
  assert.equal(P.Vi.shotsLeft, 2);
  room.nightAction(P.Vi, P.V1.id); room.voteMafia(P.Ma, P.V2.id);
  toMorning(room);
  assert(!P.V1.alive); assert.equal(P.Vi.shotsLeft, 0, 'guilt'); assert(note(P.Vi, /put your gun away/));
});

test('Medium learns how a fallen player died, and their role', () => {
  const { room, P } = game({ Ma: 'mafia', Med: 'medium', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager' });
  room.voteMafia(P.Ma, P.V1.id); toMorning(room); toNight(room);
  room.nightAction(P.Med, P.V1.id); room.voteMafia(P.Ma, P.V2.id); toMorning(room);
  assert(note(P.Med, /V1's spirit answered: they were the Villager, taken by the Mafia/));
});

test('Lookout: one shared visit list (one Mafia per kill, staying home is not a visit); Paparazzi shows where they went', () => {
  const { room, P } = game({ M1: 'mafia', M2: 'mafia', Lo: 'lookout', Doc: 'doctor', Pa: 'paparazzi', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager' });
  room.voteMafia(P.M1, P.V1.id); room.voteMafia(P.M2, P.V1.id); room.nightAction(P.Lo, P.V1.id);
  room.nightAction(P.Doc, P.Doc.id); room.nightAction(P.Pa, P.Doc.id);
  toMorning(room);
  const seen = note(P.Lo, /V1's visitors last night: (.*)\./); assert(seen);
  assert.equal(seen.text.match(/M1|M2/g).length, 1, 'the team kill counts as the one member who carried it out');
  assert.equal(P.Pa.photoPending || null, null, 'a Doctor protecting themselves never left home: no photo');
  toNight(room); room.nightAction(P.Doc, P.V2.id); room.nightAction(P.Pa, P.Doc.id); room.voteMafia(P.M1, P.V3.id); room.voteMafia(P.M2, P.V3.id); toMorning(room);
  const text = (P.Pa.photoPending && P.Pa.photoPending.text) || JSON.stringify(room.publicStories || []);
  assert.match(text, /Doc was photographed at V2's house/);
});

test('The Bodyguard no longer swaps places at the gallows (the Executioner does)', () => {
  const R = require('../public/shared/roles');
  assert.match(R.ROLES.bodyguard.blurb, /same person every night/);
  assert.match(R.ROLES.roleblocker.blurb, /gallows/);
});

console.log(`All ${passed} role balance tests passed.`);
