'use strict';
// Headhunter (neutral, levels up when their mark dies) and Hunter (Mafia's detective).
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
const R = require('../public/shared/roles');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

// A game with fixed roles (by name), no bots acting on their own.
function game(roles, extra = {}) {
  const clock = new VirtualClock();
  const room = new Room('HUNT', null, { clock, seed: 5 });
  const P = {};
  for (const name of Object.keys(roles)) { const p = room.join({ name }).player; p.sockets = 1; P[name] = p; }
  const counts = {};
  for (const r of Object.values(roles)) if (r !== 'villager') counts[r] = (counts[r] || 0) + 1;
  room.updateSettings({ roleSelection: 'manual', autoMafia: false, roleCounts: counts, minPlayers: 3, botsAuto: false, skipCinematics: true, revealRoleOnDeath: true, ...extra });
  room.updateSettings({ forcedRoles: Object.fromEntries(Object.entries(roles).map(([n, r]) => [P[n].id, r])) });
  assert(room.hostAction({ type: 'start' }).ok);
  room.advance(); // role reveal → night 1
  assert.equal(room.phase, 'night');
  return { room, P };
}
const toMorning = (room) => { room.advance(); room.advance(); }; // night → dawn → morning (deaths applied)
const toNight = (room) => { while (room.phase !== 'night' && room.phase !== 'gameover') room.advance(); };
const level = (p) => (p.hh ? Math.min(6, p.hh.kills) : 0);

test('Both roles exist in the bank with real descriptions; Headhunter is unique and neutral, Hunter is Mafia', () => {
  assert.equal(R.ROLES.hunter.team, 'mafia'); assert.equal(R.ROLES.hunter.night.reveal, 'role');
  assert.equal(R.ROLES.headhunter.team, 'neutral'); assert.equal(R.ROLES.headhunter.max, 1);
  assert(R.ROLE_ORDER.includes('hunter') && R.ROLE_ORDER.includes('headhunter'));
  assert.equal(R.HEADHUNTER_LEVELS.length, 7);
  assert.match(R.reference('headhunter').win, /last one standing/);
});

test('Hunter learns an exact role and the whole Mafia sees it; the Hunter also votes on the kill', () => {
  const { room, P } = game({ Hu: 'hunter', Ma: 'mafia', Doc: 'doctor', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager' });
  assert(room.nightTargets(P.Hu).every((id) => room.team(room.players.get(id)) !== 'mafia'), 'Hunter only targets outside the family');
  assert(room.nightAction(P.Hu, P.Doc.id));
  assert(room.voteMafia(P.Hu, P.V1.id).ok, 'Hunter votes on the kill');
  assert(room.voteMafia(P.Ma, P.V1.id).ok);
  toMorning(room);
  assert.equal(P.Hu.investigations[0].result, 'doctor');
  const intel = room.mafiaView(P.Ma).intel;
  assert.equal(intel.length, 1); assert.equal(intel[0].role, 'doctor'); assert.equal(intel[0].name, 'Doc');
  assert(!P.V1.alive, 'the kill went through');
  assert.equal(room.mafiaView(P.Doc), null, 'Town never sees the intel');
});

test('Headhunter passes as a Villager; from level 1 they can wear a disguise of their choice', () => {
  const { room, P } = game({ HH: 'headhunter', Ma: 'mafia', Det: 'detective', Sor: 'sorcerer', Sh: 'sheriff', V1: 'villager', V2: 'villager', V3: 'villager' });
  room.nightAction(P.Det, P.HH.id); room.nightAction(P.Sor, P.HH.id); room.nightAction(P.Sh, P.HH.id);
  toMorning(room);
  assert.equal(P.Det.investigations[0].result, false); assert.equal(P.Sor.investigations[0].result, 'villager'); assert.equal(P.Sh.investigations[0].result, false);
  assert.equal(room.headhunterAction(P.HH, { op: 'disguise', role: 'doctor' }).ok, false, 'disguise needs level 1');
  P.HH.hh.kills = 1;
  assert(room.headhunterAction(P.HH, { op: 'disguise', role: 'mafia' }).ok);
  toNight(room); room.nightAction(P.Sor, P.HH.id); room.nightAction(P.Det, P.HH.id); toMorning(room);
  assert.equal(P.Sor.investigations[1].result, 'mafia'); assert.equal(P.Det.investigations[1].result, true, 'the disguise fools a Detective too');
  assert.equal(room.headhunterAction(P.HH, { op: 'disguise', role: 'headhunter' }).ok, false);
});

test('The mark shows as a fake vote from one of the Mafia (never counted, never shown to the borrowed face)', () => {
  const { room, P } = game({ HH: 'headhunter', M1: 'mafia', M2: 'mafia', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager' });
  room.voteMafia(P.M1, P.V1.id); room.voteMafia(P.M2, P.V1.id);
  assert(room.nightAction(P.HH, P.V2.id));
  assert.equal(P.HH.hh.mark, P.V2.id);
  const face = room.night.hhFace[P.HH.id], other = face === P.M1.id ? P.M2 : P.M1;
  const seen = room.mafiaView(other);
  assert(seen.picks.some((p) => p.id === face && p.targetId === P.V2.id), 'the other Mafia member sees the fake vote');
  assert.equal(seen.totals[P.V2.id], 1);
  assert(!room.mafiaView(room.players.get(face)).picks.some((p) => p.targetId === P.V2.id), 'the borrowed face never sees a vote they did not cast');
  assert(!room.teamPicks('mafia').some((p) => p.targetId === P.V2.id), 'the fake vote never counts');
  toMorning(room);
  assert(!P.V1.alive && P.V2.alive, 'only the real Mafia vote killed');
});

test('Levels: a mark that dies at night or at the gallows levels the Headhunter up (leaving the game does not)', () => {
  const { room, P } = game({ HH: 'headhunter', M1: 'mafia', M2: 'mafia', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager', V6: 'villager' });
  room.nightAction(P.HH, P.V1.id); room.voteMafia(P.M1, P.V1.id); room.voteMafia(P.M2, P.V1.id);
  toMorning(room);
  assert.equal(level(P.HH), 1, 'night kill of the mark → level 1');
  assert(P.HH.notes.some((n) => /LEVEL 1/.test(n.text)));
  // Gallows: mark V2 during the day, then everyone votes V2 out.
  while (room.phase !== 'voting') room.advance();
  assert(room.headhunterAction(P.HH, { op: 'mark', targetId: P.V2.id }).ok);
  for (const p of room.alive().filter((x) => x.id !== P.V2.id)) room.vote(p, P.V2.id);
  while (P.V2.alive && room.phase !== 'night') room.advance();
  assert(!P.V2.alive); assert.equal(level(P.HH), 2, 'executed mark → level 2');
  // A mark who leaves does not count.
  toNight(room); room.nightAction(P.HH, P.V3.id); room.kick(P.V3.id);
  assert.equal(level(P.HH), 2);
});

test('Puppet (level 2): forces one Mafia member’s kill vote and locks it for the night', () => {
  const { room, P } = game({ HH: 'headhunter', M1: 'mafia', M2: 'mafia', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager' });
  assert.equal(room.headhunterAction(P.HH, { op: 'puppet', targetId: P.V3.id }).ok, false, 'needs level 2');
  P.HH.hh.kills = 2;
  assert.equal(room.headhunterAction(P.HH, { op: 'puppet', targetId: P.M1.id }).ok, false, 'cannot aim the Mafia at themselves');
  assert(room.headhunterAction(P.HH, { op: 'puppet', targetId: P.V3.id }).ok);
  const puppet = [P.M1, P.M2].find((m) => room.night.hhLocked[m.id]);
  assert(puppet); assert.equal(room.night.mafiaVotes[puppet.id], P.V3.id);
  assert.equal(room.voteMafia(puppet, P.V1.id).ok, false, 'locked');
  assert(room.mafiaView(puppet).compelled);
  assert.equal(room.headhunterAction(P.HH, { op: 'puppet', targetId: P.V2.id }).ok, false, 'once a night');
});

test('Strike (level 3): once per game, any time (night or day), kills on the spot and counts as a level', () => {
  const { room, P } = game({ HH: 'headhunter', Ma: 'mafia', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager' });
  assert.equal(room.headhunterAction(P.HH, { op: 'strike', targetId: P.V1.id }).ok, false, 'needs level 3');
  P.HH.hh.kills = 3;
  while (room.phase !== 'voting') room.advance();
  room.vote(P.V2, P.V1.id); room.vote(P.V1, P.V3.id);
  assert(room.headhunterAction(P.HH, { op: 'strike', targetId: P.V1.id }).ok);
  assert(!P.V1.alive); assert.equal(P.V1.deathCause, 'headhunter'); assert.equal(level(P.HH), 4);
  assert(!room.votes[P.V1.id] && !Object.values(room.votes).includes(P.V1.id), 'votes for/by the struck player are removed');
  assert(room.cinematic.stories.some((s) => s.scene === 'headhunt' && s.targetId === P.V1.id), 'its own scene on the TV');
  assert.equal(room.headhunterAction(P.HH, { op: 'strike', targetId: P.V2.id }).ok, false, 'once per game');
});

test('Insight (4) once a night, All-seeing (5), Execution (6) once a day, only during discussion or voting', () => {
  const { room, P } = game({ HH: 'headhunter', Ma: 'mafia', Doc: 'doctor', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager' });
  P.HH.hh.kills = 4;
  assert(room.headhunterAction(P.HH, { op: 'reveal', targetId: P.Doc.id }).ok);
  assert.equal(P.HH.investigations.at(-1).result, 'doctor');
  assert.equal(room.headhunterAction(P.HH, { op: 'reveal', targetId: P.Ma.id }).ok, false, 'once a night');
  assert.equal(room.headhunterView(P.HH).roles, null, 'level 4 does not see all roles');
  P.HH.hh.kills = 5; assert.equal(room.headhunterView(P.HH).roles.find((r) => r.id === P.Ma.id).role, 'mafia');
  P.HH.hh.kills = 6;
  assert.equal(room.headhunterAction(P.HH, { op: 'execute', targetId: P.V1.id }).ok, false, 'not at night');
  while (room.phase !== 'discussion') room.advance();
  assert(room.headhunterAction(P.HH, { op: 'execute', targetId: P.V1.id }).ok);
  assert(!P.V1.alive); assert(room.cinematic.stories.some((s) => s.scene === 'headhuntExecution'));
  assert.equal(room.headhunterAction(P.HH, { op: 'execute', targetId: P.V2.id }).ok, false, 'once a day');
});

test('Only a living Headhunter can use these powers, and only while a game is running', () => {
  const { room, P } = game({ HH: 'headhunter', Ma: 'mafia', V1: 'villager', V2: 'villager', V3: 'villager' });
  assert.equal(room.headhunterAction(P.V1, { op: 'mark', targetId: P.V2.id }).ok, false);
  assert.equal(room.headhunterAction(P.HH, { op: 'mark', targetId: P.HH.id }).ok, false, 'not yourself');
  assert.equal(room.headhunterAction(P.HH, { op: 'nonsense' }).ok, false);
  assert.equal(room.playerView(P.V1).headhunter, undefined, 'nobody else gets a Headhunter panel');
  assert(room.playerView(P.HH).headhunter, 'the Headhunter gets their panel');
});

test('The Headhunter wins as the last one standing (and only they win)', () => {
  const { room, P } = game({ HH: 'headhunter', Ma: 'mafia', V1: 'villager', V2: 'villager', V3: 'villager' });
  room.kill(P.Ma, 'judge'); room.kill(P.V1, 'judge'); room.kill(P.V2, 'judge');
  assert.equal(room.checkWinner(), 'headhunter');
  room.winner = 'headhunter'; room.endGame();
  assert(P.HH.won); assert(!P.V3.won && !P.Ma.won);
  // While the Mafia or two other players remain, nobody has won yet.
  const g = game({ HH: 'headhunter', Ma: 'mafia', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager' });
  g.room.kill(g.P.Ma, 'judge'); assert.equal(g.room.checkWinner(), null, 'town must still deal with the Headhunter');
});

test('Draft can offer both new roles in big enough games', () => {
  const D = require('../public/shared/draft');
  const seen = new Set(); for (let i = 0; i < 400; i++) D.candidates(12, {}, Math.random, {}).forEach((k) => seen.add(k));
  assert(seen.has('hunter') && seen.has('headhunter'));
  assert(!D.candidates(5, {}, Math.random, {}).includes('headhunter'), 'not in tiny games');
});

console.log(`All ${passed} Headhunter / Hunter tests passed.`);
