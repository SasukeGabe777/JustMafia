'use strict';
// Rules tests: drives the real engine headlessly with forced roles and
// scripted actions, and checks every mechanic resolves as documented.
//   node tools/test-rules.js
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
const R = require('../public/shared/roles');
const { simulateGame } = require('../sim');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.error(`  ✗ ${name}\n      ${e.message}`); }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg || 'expected'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected true'); }

// Builds a game with exact roles (in order) and no automatic bot behaviour.
function game(roles, settings = {}) {
  const clock = new VirtualClock();
  const room = new Room('TEST', null, { clock, headless: true, seed: 42 });
  const counts = {};
  for (const r of roles) if (r !== 'villager') counts[r] = (counts[r] || 0) + 1;
  room.updateSettings({ mafiaDecision: 'legacy', minPlayers: 3, maxPlayers: 100, autoMafia: false, roleCounts: counts, botsAuto: false, botChatter: false, ...settings });
  room.addBots(roles.length);
  const ps = room.list();
  const forced = {};
  ps.forEach((p, i) => { forced[p.id] = roles[i]; });
  room.updateSettings({ forcedRoles: forced });
  const res = room.startGame();
  if (!res.ok) throw new Error('start failed: ' + res.error);
  ps.forEach((p, i) => { if (p.role !== roles[i]) throw new Error(`forced role mismatch ${p.role} vs ${roles[i]}`); });
  room.advance(); // roleReveal -> night
  return { room, clock, p: ps };
}
const toDawn = (room) => { eq(room.phase, 'night'); room.advance(); eq(room.phase, 'dawn'); };
const toMorning = (room) => { toDawn(room); room.advance(); eq(room.phase, 'morning'); };
const toVoting = (room) => { room.advance(); eq(room.phase, 'discussion'); room.advance(); eq(room.phase, 'voting'); };

console.log('Night actions');
test('Mafia kill lands', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager', 'villager']);
  ok(room.nightAction(p[0], p[1].id));
  toMorning(room);
  ok(!p[1].alive, 'victim should be dead');
  eq(p[1].deathCause, 'mafia');
});
test('Doctor save', () => {
  const { room, p } = game(['mafia', 'doctor', 'villager', 'villager', 'villager']);
  room.nightAction(p[0], p[2].id);
  room.nightAction(p[1], p[2].id);
  toMorning(room);
  ok(p[2].alive, 'protected player survives');
  eq(room.narration.key, 'saved');
});
test('Doctor cannot repeat a target', () => {
  const { room, p } = game(['mafia', 'doctor', 'villager', 'villager', 'villager', 'villager']);
  room.nightAction(p[1], p[3].id);
  toMorning(room);
  room.advance(); room.advance(); room.advance(); room.advance(); // discussion, voting, verdict, execution
  room.advance(); // -> night
  eq(room.phase, 'night');
  ok(!room.nightTargets(p[1]).includes(p[3].id), 'last target excluded');
  ok(!room.nightAction(p[1], p[3].id), 'repeat rejected');
});
test('Doctor self-protect can be disabled', () => {
  const { room, p } = game(['mafia', 'doctor', 'villager', 'villager', 'villager'], { doctorSelfProtect: false });
  ok(!room.nightTargets(p[1]).includes(p[1].id));
});
test('Bodyguard dies in place of the target', () => {
  const { room, p } = game(['mafia', 'bodyguard', 'villager', 'villager', 'villager', 'villager']);
  room.nightAction(p[0], p[2].id);
  room.nightAction(p[1], p[2].id);
  toMorning(room);
  ok(p[2].alive, 'guarded target lives');
  ok(!p[1].alive, 'bodyguard dies');
  eq(p[1].deathCause, 'guarding');
});
test('Roleblocker stops the Doctor', () => {
  const { room, p } = game(['mafia', 'roleblocker', 'doctor', 'villager', 'villager', 'villager', 'villager', 'villager']);
  room.nightAction(p[0], p[3].id);
  room.nightAction(p[1], p[2].id);
  room.nightAction(p[2], p[3].id);
  toMorning(room);
  ok(!p[3].alive, 'block made the heal fail');
  ok(p[2].notes.some((n) => /distracted/.test(n.text)), 'blocked player is told');
});
test('Godfather has the final say', () => {
  const { room, p } = game(['godfather', 'mafia', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager']);
  room.nightAction(p[1], p[3].id);
  room.nightAction(p[0], p[4].id);
  toMorning(room);
  ok(!p[4].alive && p[3].alive);
});
test('Mafia majority wins when they disagree, tie broken deterministically', () => {
  const run = () => {
    const { room, p } = game(['mafia', 'mafia', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager']);
    room.nightAction(p[0], p[3].id);
    room.nightAction(p[1], p[4].id);
    toMorning(room);
    return p.filter((x) => !x.alive).map((x) => x.name);
  };
  const a = run();
  eq(a.length, 1);
  eq(run(), a, 'same seed, same victim');
});
test('Detective, Sheriff and the Godfather', () => {
  const { room, p } = game(['godfather', 'mafia', 'detective', 'sheriff', 'serialKiller', 'villager', 'villager', 'villager', 'villager', 'villager']);
  room.nightAction(p[2], p[0].id); // detective -> godfather
  room.nightAction(p[3], p[4].id); // sheriff -> serial killer
  toDawn(room);
  eq(p[2].investigations[0].result, false, 'Godfather looks innocent');
  eq(p[3].investigations[0].result, true, 'Sheriff sees the Serial Killer');
  ok(R.investigate('mafia', 'mafia') && !R.investigate('serialKiller', 'mafia'), 'Detective only finds Mafia');
});
test('Serial Killer is immune at night and kills', () => {
  const { room, p } = game(['mafia', 'serialKiller', 'villager', 'villager', 'villager', 'villager', 'villager']);
  room.nightAction(p[0], p[1].id);
  room.nightAction(p[1], p[2].id);
  toMorning(room);
  ok(p[1].alive, 'SK survives the Mafia');
  ok(!p[2].alive, 'SK kill lands');
});
test('Vigilante: limited bullets and "hold fire"', () => {
  const { room, p } = game(['mafia', 'vigilante', 'villager', 'villager', 'villager', 'villager'], { vigilanteShots: 1 });
  ok(room.nightAction(p[1], 'pass'), 'can pass');
  ok(!room.nightAction(p[0], 'pass'), 'Mafia cannot pass');
  room.nightAction(p[1], p[0].id);
  room.nightAction(p[0], p[2].id);
  toMorning(room);
  ok(!p[0].alive, 'shot Mafia dies');
  eq(p[1].shotsLeft, 0);
  eq(room.winner, 'town');
});
test('Promotion when the killers are gone', () => {
  const { room, p } = game(['mafia', 'roleblocker', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager']);
  room.override({ op: 'kill', id: p[0].id });
  toMorning(room); room.advance(); room.advance(); room.advance(); room.advance(); room.advance();
  eq(room.phase, 'night');
  eq(p[1].role, 'mafia', 'roleblocker promoted');
  eq(p[1].originalRole, 'roleblocker');
});

console.log('Voting');
function voteAll(room, p, map) { for (const [i, t] of Object.entries(map)) ok(room.vote(p[i], t === 'skip' ? 'skip' : p[t].id), `vote ${i}`); }
test('Plurality eliminates; Mayor counts twice', () => {
  const { room, p } = game(['mafia', 'mayor', 'villager', 'villager', 'villager', 'villager']);
  toMorning(room); toVoting(room);
  voteAll(room, p, { 1: 0, 2: 3, 3: 2, 4: 3 }); // p0: 2 (mayor), p3: 2 ... tie?  mayor=2 vs 2
  room.vote(p[5], p[0].id);
  room.advance(); room.advance();
  ok(!p[0].alive, 'Mayor + 1 beats 2');
});
test('Ties: nobody vs random', () => {
  for (const [rule, expectDead] of [['none', 0], ['random', 1]]) {
    const { room, p } = game(['mafia', 'villager', 'villager', 'villager', 'villager', 'villager'], { tieRule: rule });
    toMorning(room); toVoting(room);
    voteAll(room, p, { 1: 0, 2: 0, 3: 4, 4: 3, 5: 3 });
    room.vote(p[0], p[4].id);
    room.advance(); room.advance();
    eq(p.filter((x) => !x.alive && x.deathCause === 'vote').length, expectDead, rule);
  }
});
test('Majority rule needs more than half', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager', 'villager', 'villager', 'villager'], { majority: 'majority' });
  toMorning(room); toVoting(room);
  voteAll(room, p, { 1: 0, 2: 0, 3: 'skip' });
  room.advance(); room.advance();
  ok(p[0].alive, '2 of 7 is not a majority');
});
test('Skip can be disabled', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager', 'villager'], { allowSkip: false });
  toMorning(room); toVoting(room);
  ok(!room.vote(p[1], 'skip'));
  ok(!room.vote(p[1], p[1].id), 'no self vote');
  ok(!room.vote(p[1], 'nobody'), 'no bogus target');
});
test('Dead players and non-players cannot vote', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager', 'villager']);
  room.nightAction(p[0], p[1].id);
  toMorning(room); toVoting(room);
  ok(!room.vote(p[1], p[2].id), 'ghost vote rejected');
});
test('Jester wins when voted out', () => {
  const { room, p } = game(['mafia', 'jester', 'villager', 'villager', 'villager', 'villager']);
  toMorning(room); toVoting(room);
  voteAll(room, p, { 0: 1, 2: 1, 3: 1 });
  room.advance(); room.advance(); room.advance();
  eq(room.phase, 'gameover');
  eq(room.winner, 'jester');
  ok(p[1].won && !p[0].won && !p[2].won);
});
test('Manual voting waits for the Judge', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager'], { autoAdvance: false });
  toMorning(room);
  room.advance(); eq(room.phase, 'discussion'); eq(room.endsAt, null);
  eq(room.hostAction({ type: 'closeVoting' }).ok, false);
  room.hostAction({ type: 'openVoting' }); eq(room.phase, 'voting');
  for (const x of room.alive()) room.vote(x, room.alive().find((y) => y.id !== x.id).id);
  eq(room.endsAt, null, 'stays open after everyone voted');
  room.hostAction({ type: 'closeVoting' }); eq(room.phase, 'verdict');
  void p;
});

console.log('Win conditions');
test('Mafia win at parity, or only when everyone is gone', () => {
  const a = game(['mafia', 'villager', 'villager']);
  a.room.nightAction(a.p[0], a.p[1].id); toMorning(a.room);
  eq(a.room.winner, 'mafia');
  const b = game(['mafia', 'villager', 'villager'], { mafiaWinAt: 'all' });
  b.room.nightAction(b.p[0], b.p[1].id); toMorning(b.room);
  eq(b.room.winner, null);
});
test('Serial Killer wins last one standing', () => {
  const { room, p } = game(['serialKiller', 'villager', 'villager']);
  room.nightAction(p[0], p[1].id); toMorning(room);
  eq(room.winner, 'serialKiller');
});

console.log('Judge overrides');
test('Set night action, revive, change role', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager', 'villager']);
  eq(room.override({ op: 'setAction', id: p[0].id, targetId: p[2].id }).ok, true);
  toMorning(room);
  ok(!p[2].alive);
  eq(room.override({ op: 'revive', id: p[2].id }).ok, true);
  ok(p[2].alive);
  eq(room.override({ op: 'setRole', id: p[3].id, role: 'detective' }).ok, true);
  eq(p[3].role, 'detective');
  ok(room.log.some((l) => /Judge/.test(l.text)), 'overrides are logged');
});

console.log('Telepaths & secrecy');
test('Telepaths talk privately', () => {
  const { room, p } = game(['mafia', 'telepath', 'telepath', 'villager', 'villager', 'villager', 'villager']);
  eq(room.sendTelepath(p[1], { msgId: 'suspect', targetId: p[0].id }).ok, true);
  eq(room.playerView(p[2]).telepath.log.length, 1, 'partner sees it');
  ok(!room.playerView(p[3]).telepath, 'villager sees nothing');
  ok(!room.playerView(p[0]).telepath, 'mafia sees nothing');
  eq(room.sendTelepath(p[3], { msgId: 'danger' }).ok, false, 'non-telepath cannot send');
  eq(room.sendTelepath(p[1], { msgId: 'nope' }).ok, false, 'unknown message rejected');
  const q = game(['mafia', 'telepath', 'telepath', 'villager', 'villager'], { telepathWhen: 'day' });
  eq(q.room.sendTelepath(q.p[1], { msgId: 'danger' }).ok, false, 'closed at night when set to day-only');
});
test('Views never leak hidden roles', () => {
  const { room, p } = game(['godfather', 'roleblocker', 'detective', 'telepath', 'telepath', 'villager', 'villager', 'villager']);
  for (const x of p) {
    const v = room.playerView(x);
    for (const o of v.players) if (o.alive && o.id !== x.id && o.role) throw new Error(`${x.role} sees ${o.role}`);
    if (R.ROLES[x.role].team !== 'mafia' && v.teammates) throw new Error(`${x.role} got teammates`);
    if (x.role !== 'detective' && v.investigations) throw new Error(`${x.role} got investigations`);
  }
  for (const o of room.hostView().players) ok(!o.role, 'big screen sees no roles');
  eq(room.playerView(p[0]).teammates.map((t) => t.id), [p[1].id]);
});

console.log('Setup validation');
test('Impossible setups are rejected', () => {
  eq(R.buildRoleList({ roleCounts: { mafia: 0, detective: 1, doctor: 1, sheriff: 1, bodyguard: 1 } }, 4).errors.length > 0, true, 'too many roles');
  eq(R.buildRoleList({ autoMafia: false, roleCounts: { mafia: 3 } }, 5).errors.length > 0, true, 'mafia majority');
  eq(R.buildRoleList({ roleCounts: { roleblocker: 1 } }, 8).errors.length, 0, 'auto adds a killer');
  eq(R.buildRoleList({ autoMafia: false, roleCounts: { roleblocker: 1 } }, 8).errors.length > 0, true, 'blocker alone cannot kill');
  eq(R.buildRoleList({ autoMafia: false, roleCounts: { serialKiller: 1 } }, 6).errors.length, 0, 'SK-only game is allowed');
  eq(R.buildRoleList({ roleCounts: { telepath: 1 } }, 8).roles.filter((r) => r === 'telepath').length, 2, 'telepaths pair up');
  eq(R.buildRoleList({ roleCounts: {} }, 10).errors.length, 0, 'plain game is fine');
});
test('Start refuses a broken setup', () => {
  const room = new Room('T', null, { clock: new VirtualClock(), headless: true, seed: 1 });
  room.updateSettings({ roleCounts: { mafia: 0, detective: 1, doctor: 1, sheriff: 1, vigilante: 1 } });
  room.addBots(4);
  eq(room.startGame().ok, false);
});

console.log('Cinematics, narrator & Judge presentation');
test('Night cinematic never says who saved, guarded or was immune', () => {
  const { room, p } = game(['mafia', 'bodyguard', 'serialKiller', 'doctor', 'villager', 'villager', 'villager', 'villager']);
  room.nightAction(p[0], p[4].id);      // Mafia attack a villager...
  room.nightAction(p[1], p[4].id);      // ...who is guarded
  room.nightAction(p[2], p[5].id);      // SK attacks a villager...
  room.nightAction(p[3], p[5].id);      // ...who is healed
  toDawn(room);
  const cine = room.hostView().cinematic;
  eq(cine.type, 'night');
  ok(cine.events.length === 2, 'two public events');
  for (const e of cine.events) {
    eq(Object.keys(e).filter((k) => !['type', 'targetId', 'guardDied'].includes(k)), [], 'only public fields');
    ok(!JSON.stringify(e).includes(p[1].id) && !JSON.stringify(e).includes(p[3].id), 'protector ids never sent');
  }
  ok(!JSON.stringify(room.hostView()).includes('"immune"'), 'immunity is not revealed');
});
test('Forced roles are hidden from the big screen and phones', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager']);
  eq(room.hostView().settings.forcedRoles, {});
  ok(Object.keys(room.judgeView().settings.forcedRoles).length === 4, 'the Judge still sees them');
  ok(!JSON.stringify(room.playerView(p[1])).includes('forcedRoles":{"'), 'phones never get them');
});
test('Execution sends a public cue for the condemned only', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager', 'villager']);
  toMorning(room);
  toVoting(room);
  for (const v of p) if (v.alive && v !== p[1]) room.vote(v, p[1].id);
  room.advance(); eq(room.phase, 'verdict');
  room.advance(); eq(room.phase, 'execution');
  const c = room.hostView().cinematic;
  eq([c.type, c.outcome, c.targetId, c.condemnedId], ['execution', 'executed', p[1].id, p[1].id]);
  // Public votes: the mob is the real voters. Nothing in the public cue carries roles or teams.
  eq(c.mob.slice().sort(), p.filter((v) => v !== p[1]).map((v) => v.id).sort());
  if (/"role"|"team"|mafia|villager/.test(JSON.stringify(c))) throw new Error('execution cue leaks role/team: ' + JSON.stringify(c));
});
test('Human Judge mode: narration is a private suggestion', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager'], { narratorMode: 'human' });
  eq(room.settings.autoAdvance, false, 'human mode defaults to manual phases');
  eq(room.settings.revealMode, 'judge', 'and Judge-controlled reveals');
  room.narrate('night');
  eq(room.hostView().narration, null, 'TV gets nothing');
  eq(room.playerView(p[1]).narration, null, 'phones get nothing');
  ok(room.judgeView().narration.suggestion, 'the Judge sees the suggestion');
  ok(room.hostAction({ type: 'say', text: 'Darkness falls.' }).ok !== false);
  eq(room.hostView().narration.text, 'Darkness falls.', 'custom lines do reach the TV');
});
test('Theme locks once the game starts', () => {
  const { room } = game(['mafia', 'villager', 'villager', 'villager'], { theme: 'space' });
  room.updateSettings({ theme: 'medieval' });
  eq(room.settings.theme, 'space');
  room.resetToLobby();
  room.updateSettings({ theme: 'medieval' });
  eq(room.settings.theme, 'medieval');
});
test('Judge reveal mode: dawn waits, reveals play one event at a time', () => {
  const { room, p } = game(['mafia', 'roleblocker', 'vigilante', 'villager', 'villager', 'villager', 'villager', 'villager'], { revealMode: 'judge', vigilanteShots: 2 });
  room.nightAction(p[0], p[3].id);
  room.nightAction(p[1], p[2].id);      // Vigilante is blocked...
  room.nightAction(p[2], p[4].id);      // ...so this shot never happens
  toDawn(room);
  eq(room.endsAt, null, 'no timer at dawn');
  const before = room.cinematic && room.cinematic.id;
  const jv = room.judgeView().reveal;
  eq(jv.events.length, 1);
  eq(jv.blocked.length, 1, 'the blocked shot is listed for the Judge');
  eq(room.hostView().reveal, undefined, 'the TV never sees the queue');
  ok(room.hostAction({ type: 'reveal', index: 0 }).ok);
  ok(room.cinematic.id !== before, 'a cinematic was cued');
  eq(room.cinematic.events, [{ type: 'kill', targetId: p[3].id }]);
  ok(room.judgeView().reveal.events[0].played);
  ok(room.hostAction({ type: 'reveal', which: 'blocked', index: 0 }).ok);
  eq(room.cinematic.outcome, 'blocked');
  ok(p[3].alive, 'nobody dies before the morning');
  room.advance();
  eq(room.phase, 'morning');
  ok(!p[3].alive && p[4].alive);
  eq(room.hostAction({ type: 'reveal', index: 0 }).ok, false, 'nothing to reveal outside dawn');
});

console.log('Simulation');
test('Same seed replays the same game', () => {
  const a = simulateGame({ players: 12, seed: 777, settings: R.PRESETS.chaos.settings });
  const b = simulateGame({ players: 12, seed: 777, settings: R.PRESETS.chaos.settings });
  eq(a.winner, b.winner); eq(a.days, b.days); eq(a.players, b.players);
});
test('100-player game finishes', () => {
  const g = simulateGame({ players: 100, seed: 5, settings: R.PRESETS.bigParty.settings });
  ok(!g.error, g.error);
  eq(g.n, 100);
});

console.log(failed ? `\n${failed} failed, ${passed} passed.` : `\nAll ${passed} rules tests passed.`);
process.exit(failed ? 1 : 0);
