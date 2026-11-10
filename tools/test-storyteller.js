'use strict';
const { test } = require('node:test');
const { assert, game, morning, discussion } = require('./story-fixture');
const C = require('../public/shared/config');
test('General statuses overlap, hide from players, expire by authoritative phase', () => {
  const { room, p } = game(['mafia', 'detective', 'villager', 'villager']);
  room.addStatus(p[1], 'poisoned', { turns: 2 }); room.addStatus(p[1], 'drunk', { turns: 4 });
  assert(room.hasStatus(p[1], 'poisoned')); assert.equal(room.statuses(p[1]).length, 2);
  assert.deepEqual(room.playerView(p[1]).statuses, []); assert(room.judgeView().allPlayers[1].statuses.length === 2);
  room.nightAction(p[1], p[0].id); room.resolveNight();
  assert.equal(p[1].investigations[0].result, false);
  const log = room.eventLog.find((e) => e.kind === 'information'); assert.equal(log.trueResult, true); assert.equal(log.deliveredResult, false);
  assert(!JSON.stringify(room.hostView()).includes('trueResult')); assert(!JSON.stringify(room.playerView(p[1])).includes('trueResult'));
  room.startMorning(); assert(!room.hasStatus(p[1], 'poisoned')); assert(room.hasStatus(p[1], 'drunk'));
});
test('Structured role configuration clamps invalid options and supports reset to standard', () => {
  assert.equal(C.normalize('detonator', { mode: 'custom', minDelay: 0, uses: 500 }).minDelay, 3);
  assert.equal(C.normalize('detonator', { mode: 'custom', uses: 500 }).uses, 10);
  assert.deepEqual(C.normalize('detonator', { mode: 'standard', uses: 100 }), C.standard('detonator'));
});
test('Mafia collectively kill one player; every living Mafia can coordinate', () => {
  const { room, p } = game(['mafia', 'roleblocker', 'villager', 'villager', 'villager', 'villager']);
  assert(room.voteMafia(p[0], p[2].id).ok); assert(room.voteMafia(p[1], p[2].id).ok);
  assert.equal(room.playerView(p[1]).mafia.totals[p[2].id], 2);
  assert(room.sendMafia(p[1], { tactic: 'suggest', targetId: p[2].id }).ok);
  assert.equal(room.playerView(p[2]).mafia, null); assert(!JSON.stringify(room.hostView()).includes('Consider'));
  room.resolveNight(); assert.equal(room.pending.deaths.length, 1);
});
test('Mafia plurality ties default to no kill, Godfather only breaks tied leaders', () => {
  const { room, p } = game(['mafia', 'mafia', 'villager', 'villager', 'villager', 'villager']);
  room.voteMafia(p[0], p[2].id); room.voteMafia(p[1], p[3].id); room.resolveNight(); assert.equal(room.pending.deaths.length, 0);
  const other = game(['godfather', 'mafia', 'mafia', 'villager', 'villager', 'villager', 'villager', 'villager']);
  other.room.voteMafia(other.p[0], other.p[3].id); other.room.voteMafia(other.p[1], other.p[4].id); other.room.voteMafia(other.p[2], other.p[4].id);
  other.room.resolveNight(); assert.equal(other.room.pending.deaths[0].id, other.p[4].id);
});
test('Changed votes, explicit random ties, blocked Mafia and extra-kill opt in', () => {
  const { room, p } = game(['mafia', 'mafia', 'villager', 'villager', 'villager', 'villager'], { mafiaExtraKills: 1 });
  room.voteMafia(p[0], p[2].id); room.voteMafia(p[0], p[3].id); room.voteMafia(p[1], p[3].id);
  assert.equal(room.teamPicks('mafia').length, 2); room.resolveNight(); assert.equal(room.pending.deaths.length, 1);
  const extra = game(['mafia', 'mafia', 'mafia', 'villager', 'villager', 'villager', 'villager', 'villager'], { mafiaExtraKills: 1 });
  extra.room.voteMafia(extra.p[0], extra.p[3].id); extra.room.voteMafia(extra.p[1], extra.p[3].id); extra.room.voteMafia(extra.p[2], extra.p[4].id);
  extra.room.resolveNight(); assert.equal(extra.room.pending.deaths.length, 2);
});
test('Detonator destroys living and already-dead homes after the configured delay', () => {
  for (const dead of [false, true]) {
    const { room, p } = game(['mafia', 'detonator', 'villager', 'villager', 'villager']);
    assert(room.nightAction(p[1], p[2].id, { delay: 3 })); room.resolveNight(); assert.equal(room.scheduledEvents.length, 1);
    if (dead) room.kill(p[2], 'test'); room.startMorning(); assert.equal(p[2].houseState, 'normal'); room.startDiscussion();
    assert.equal(p[2].houseState, 'destroyed'); assert(!p[2].alive); assert.equal(room.cinematic.stories.at(-1).scene, 'explosion');
  }
});
test('Sorcerer learns exact Godfather role; poison changes only delivered information', () => {
  for (const poison of [false, true]) {
    const { room, p } = game(['godfather', 'sorcerer', 'villager', 'villager']);
    if (poison) room.addStatus(p[1], 'poisoned'); room.nightAction(p[1], p[0].id); room.resolveNight();
    assert.equal(p[1].investigations[0].result === 'godfather', !poison); assert.equal(room.eventLog.find((e) => e.kind === 'information').trueResult, 'godfather');
  }
});
test('Hustler shortens exactly one discussion and preserves defaults', () => {
  const { room, p, clock } = game(['mafia', 'hustler', 'villager', 'villager', 'villager', 'villager'], { discussionSeconds: 100 });
  room.nightAction(p[1], p[1].id); discussion(room); assert.equal(room.endsAt - clock.now(), 40000); assert.equal(room.settings.discussionSeconds, 100);
  room.startNight(); discussion(room); assert.equal(room.endsAt - clock.now(), 100000);
});
test('Midas steals supported active abilities only for daytime eliminations', () => {
  for (const cause of ['vote', 'mafia']) {
    const { room, p } = game(['mafia', 'alchemist', 'doctor', 'villager', 'villager', 'villager']);
    room.nightAction(p[1], p[2].id); morning(room); room.kill(p[2], cause);
    assert.equal(p[0].stolenAbilities.length, cause === 'vote' ? 1 : 0);
    if (cause === 'vote') { assert.equal(p[0].stolenAbilities[0].originalOwner, p[2].id); assert.equal(p[0].stolenAbilities[0].role, 'doctor'); }
  }
});
test('Volatile returns a dead Mafia for one day and cannot revive ash again', () => {
  const { room, p } = game(['mafia', 'alchemist', 'mafia', 'villager', 'villager', 'villager', 'villager']);
  room.kill(p[2], 'test'); assert(room.nightAction(p[1], p[2].id, { variant: 'volatile' })); morning(room);
  assert(p[2].alive); assert(room.hasStatus(p[2], 'temporaryRevival')); room.startNight(); assert(!p[2].alive && p[2].ashes);
});
test('Jester mimic is opt in, bounded and retains original alignment', () => {
  const { room, p } = game(['mafia', 'jester', 'villager', 'villager'], { roleConfig: { jester: { mode: 'custom', behavior: 'mimic' } } });
  assert(!room.specialAction(p[1], { op: 'mimic', role: 'jester' }).ok); assert(room.specialAction(p[1], { op: 'mimic', role: 'detective' }).ok);
  assert(!room.specialAction(p[1], { op: 'mimic', role: 'doctor' }).ok); room.nightAction(p[1], p[0].id); room.resolveNight();
  assert(p[1].investigations[0].result); assert.equal(p[1].role, 'jester');
});
test('Storymaker restores the same interrupted night and valid actions', () => {
  const { room, p } = game(['mafia', 'storymaker', 'doctor', 'villager', 'villager']);
  room.nightAction(p[2], p[3].id); const night = room.night;
  assert(room.specialAction(p[1], { op: 'interrupt' }).ok); assert.equal(room.phase, 'emergencyIntro');
  room.advance(); room.resolveVotes(); room.startExecution(); room.advance();
  assert.equal(room.phase, 'night'); assert.equal(room.night, night); assert.equal(room.night.actions[p[2].id], p[3].id);
  assert(!room.specialAction(p[1], { op: 'interrupt' }).ok);
});
test('Mafia bluffs are unassigned Town roles; starting facts are private', () => {
  const { room, p } = game(['mafia', 'detective', 'villager', 'villager'], { roleConfig: { villager: { mode: 'custom', startingInfo: 'townTrio' } } });
  for (const role of room.mafiaBluffs) { assert.equal(require('../public/shared/roles').ROLES[role].team, 'town'); assert(!room.inGame().some((p) => p.role === role)); }
  assert(room.playerView(p[2]).startingInfo); assert(!JSON.stringify(room.hostView()).includes('trueStatement')); assert.equal(room.playerView(p[2]).mafia, null);
});
test('Silencer blocks voting, nominations and whispers for the following day only', () => {
  const { room, p } = game(['mafia', 'silencer', 'villager', 'villager', 'villager', 'villager'], { whispers: true, votingMode: 'nomination' });
  room.nightAction(p[1], p[2].id); discussion(room);
  assert(!room.requestWhisper(p[2], p[3].id).ok); assert(!room.nominate(p[2], p[3].id).ok);
  room.startVoting(); assert(!room.vote(p[2], p[0].id)); assert(room.playerView(p[2]).statuses.some((s) => s.type === 'silenced'));
  room.startNight(); assert(!room.hasStatus(p[2], 'silenced'));
});
test('Ghost has exactly one vote across days and revival preserves the spent budget', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager', 'villager'], { ghostVotes: true }); discussion(room);
  room.kill(p[2], 'test'); room.startVoting(); assert(room.vote(p[2], p[0].id)); assert(room.vote(p[2], p[1].id));
  assert(p[2].ghostVoteUsed); room.startVoting(); assert(!room.vote(p[2], p[0].id));
  room.revive(p[2]); assert(p[2].ghostVoteUsed); room.kill(p[2], 'test'); assert(!room.vote(p[2], p[0].id));
});
test('Ghost chat never reaches living phones or the public display', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager', 'villager'], { ghostChat: true }); discussion(room); room.kill(p[2], 'test');
  assert(room.sendGhost(p[2], 'Private ghost knowledge').ok); assert(!room.sendGhost(p[1], 'I am alive').ok);
  assert(room.playerView(p[2]).ghost.messages.length); assert(!JSON.stringify(room.playerView(p[1])).includes('Private ghost knowledge')); assert(!JSON.stringify(room.hostView()).includes('Private ghost knowledge'));
});
test('Whispers require consent, enforce phases and keep content out of Judge metadata', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager'], { whispers: true }); discussion(room);
  assert(room.requestWhisper(p[1], p[2].id).ok); const h = room.huddles[0];
  assert(!room.sendWhisper(p[1], h.id, 'Not accepted').ok); assert(!room.replyWhisper(p[3], h.id, true).ok);
  assert(room.replyWhisper(p[2], h.id, true).ok); assert(room.sendWhisper(p[1], h.id, 'Our private words').ok);
  assert(!JSON.stringify(room.playerView(p[3])).includes('Our private words')); assert(!JSON.stringify(room.judgeView()).includes('Our private words'));
  room.startVoting(); assert(!room.sendWhisper(p[2], h.id, 'Too late').ok);
});
test('Nomination provides separate accusation and defense timers and a single candidate ballot', () => {
  const { room, p, clock } = game(['mafia', 'villager', 'villager', 'villager'], { votingMode: 'nomination', accusationSeconds: 30, defenseSeconds: 30 }); discussion(room);
  assert(room.nominate(p[1], p[0].id).ok); assert.equal(room.phase, 'accusation'); assert.equal(room.endsAt - clock.now(), 30000);
  room.advance(); assert.equal(room.phase, 'defense'); assert.equal(room.endsAt - clock.now(), 30000); room.advance();
  assert.equal(room.phase, 'voting'); assert.deepEqual(room.voteTargets(p[0]), [p[0].id]); assert(room.vote(p[0], 'skip'));
});

for (const role of ['detonator','silencer','sorcerer','hustler','alchemist']) test(`Roleblock stops ${role} without spending the ability`, () => {
  const { room,p } = game(['mafia','jester',role,'villager','villager','villager','villager','villager'],{ roleConfig:{ jester:{ mode:'custom',behavior:'mimic' } } });
  assert(room.specialAction(p[1],{ op:'mimic',role:'roleblocker' }).ok);
  assert(room.nightAction(p[1],p[2].id)); assert(room.nightAction(p[2],p[3].id)); room.resolveNight();
  assert.deepEqual(p[2].actionUses,{}); assert.equal(room.scheduledEvents.length,0);
  assert(!p[3].statuses.length); assert(!room.hustledDay);
  if (role==='sorcerer') assert(p[2].investigations[0].blocked);
});
test('Silence prevents a Telepath link and expires even when its source dies', () => {
  const { room,p } = game(['mafia','silencer','telepath','telepath','villager','villager']);
  room.nightAction(p[1],p[2].id); discussion(room); room.kill(p[1],'judge');
  assert(!room.sendTelepath(p[2],{ msgId:'suspect',targetId:p[0].id }).ok);
  room.startNight(); assert(!room.hasStatus(p[2],'silenced'));
});
test('Volatile voting restrictions survive revival; a spent ghost ballot remains spent', () => {
  const { room,p } = game(['mafia','alchemist','villager','villager','villager','villager'],{ ghostVotes:true,roleConfig:{ alchemist:{ mode:'custom',temporaryVoting:false } } });
  room.kill(p[0],'test'); p[0].ghostVoteUsed=true;
  room.nightAction(p[1],p[0].id,{ variant:'volatile' }); morning(room); room.startVoting();
  assert(p[0].alive); assert(p[0].ghostVoteUsed); assert(!room.vote(p[0],p[2].id));
  room.startNight(); assert(!p[0].alive); assert(!room.chooseVariant(p[1],'jester-recursion').ok);
});
test('Stolen abilities retain restrictions and their own remaining-use budget', () => {
  const { room,p } = game(['mafia','alchemist','doctor','villager','villager','villager'],{ roleConfig:{ doctor:{ mode:'custom',uses:2,selfTarget:false,noRepeat:true } } });
  room.nightAction(p[1],p[2].id); discussion(room); room.kill(p[2],'vote');
  const stolen = p[0].stolenAbilities[0]; assert(stolen); assert.equal(stolen.remaining,2);
  room.startNight(); assert(room.chooseVariant(p[0],stolen.id).ok); assert(!room.nightTargets(p[0]).includes(p[0].id));
  room.nightAction(p[0],p[3].id); room.resolveNight(); assert.equal(stolen.remaining,1); assert.equal(p[2].actionUses.heal,undefined);
  room.startMorning(); room.startNight(); room.chooseVariant(p[0],stolen.id); room.nightAction(p[0],p[4].id);
  assert(room.voteMafia(p[0],p[5].id).ok); assert.equal(room.night.actions[p[0].id],p[4].id,'team coordination must not overwrite a stolen ability target');
});
test('Judge role changes cancel stale actions while preserving independently timed statuses', () => {
  const { room,p } = game(['mafia','doctor','villager','villager']);
  room.addStatus(p[1],'poisoned',{ turns:10 }); room.nightAction(p[1],p[2].id);
  assert(room.override({ op:'setRole',id:p[1].id,role:'sorcerer' }).ok);
  assert(!room.night.actions[p[1].id]); assert(room.hasStatus(p[1],'poisoned')); assert(room.nightAction(p[1],p[0].id));
  room.resolveNight(); assert.notEqual(p[1].investigations[0].result,'mafia');
});
test('Human narration remains manually paced across new nights, accusations and reveals', () => {
  const { room,p,clock } = game(['mafia','storymaker','villager','villager'],{ narratorMode:'human',votingMode:'nomination' });
  assert.equal(room.endsAt,null); room.specialAction(p[1],{ op:'interrupt' }); assert.equal(room.endsAt,null);
  room.advance(); assert.equal(room.endsAt,null); room.resolveVotes(); room.startExecution(); room.advance();
  assert.equal(room.phase,'night'); assert.equal(room.endsAt,null);
  room.resolveNight(); room.startMorning(); room.startDiscussion(); room.nominate(p[2],p[0].id); assert.equal(room.phase,'accusation'); assert.equal(room.endsAt,null);
});
test('Beginner presets reset advanced optional mechanics', () => {
  const { room } = game(['mafia','villager','villager','villager']); room.resetToLobby();
  room.applyPreset('storytellerV2'); assert(room.settings.ghostVotes); assert.equal(room.settings.votingMode,'nomination');
  room.applyPreset('classic'); assert(!room.settings.ghostVotes); assert(!room.settings.whispers); assert.equal(room.settings.votingMode,'classic');
});
test('New presets complete deterministic 25, 50 and 100 player simulations', () => {
  const { simulateGame } = require('../sim'), { PRESETS } = require('../public/shared/roles');
  for (const id of ['cinematicChaos','storytellerV2']) for (const n of [25,50,100]) {
    const result = simulateGame({ players:n,seed:6000+n,settings:PRESETS[id].settings }); assert(!result.error,result.error); assert(result.winner);
  }
});
