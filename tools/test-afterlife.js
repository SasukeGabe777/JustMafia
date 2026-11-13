'use strict';
// The afterlife: ghost predictions, the Chill, the Medium's spirit line, a Mafia ghost's
// shroud, gold bets between ghosts, and the ghost/High Roller cosmetics and achievements.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
const { ProfileStore } = require('../profiles');
const C = require('../public/shared/cosmetics');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };

function game() {
  const clock = new VirtualClock(); clock.advance = (ms) => { const end = clock.t + ms; while ([...clock.queue.values()].some((e) => e.at <= end)) clock.step(); clock.t = Math.max(clock.t, end); };
  const profiles = new ProfileStore(), room = new Room('GHO', null, { clock, seed: 7, profiles });
  room.updateSettings({ minPlayers: 3, roleSelection: 'manual', autoMafia: false, roleCounts: { mafia: 2, medium: 1, doctor: 1 }, botsAuto: false, skipCinematics: true, discussionSeconds: 60, votingSeconds: 60 });
  const P = {};
  for (const name of ['Ana', 'Ben', 'Cy', 'Di', 'Eve', 'Fay', 'Gus', 'Hal']) { const auth = profiles.create(); const p = room.join({ name }).player; p.profileId = auth.id; p.sockets = 1; P[name] = p; profiles.grant(auth.id, 200); }
  assert(room.hostAction({ type: 'start' }).ok);
  const until = (ph) => { for (let i = 0; i < 400 && room.phase !== ph; i++) clock.advance(500); assert.equal(room.phase, ph); };
  return { room, profiles, P, clock, until, gold: (p) => profiles.coins(p.profileId) };
}

test('Ghosts predict the vote and the night; right guesses score and count toward gold', () => {
  const { room, P, until } = game();
  until('discussion');
  const town = room.inGame().filter((p) => room.team(p) === 'town' && p.role !== 'medium');
  const [g1, g2] = town; room.override({ id: g1.id, op: 'kill' }); room.override({ id: g2.id, op: 'kill' });
  const living = room.alive(), target = living.find((p) => room.team(p) === 'town');
  assert.equal(room.ghostPredict(living[0], 'vote', target.id).ok, false, 'the living cannot predict');
  assert(room.ghostPredict(g1, 'vote', target.id).ok);
  assert(room.ghostPredict(g2, 'vote', 'none').ok);
  until('voting');
  for (const p of room.alive()) room.vote(p, p.id === target.id ? living.find((x) => x.id !== target.id).id : target.id);
  for (let i = 0; i < 40 && room.phase === 'voting'; i++) room.clock.advance(500);
  assert.equal(g1.oracle.correct, 1, 'g1 called the vote'); assert.equal(g2.oracle.correct, 0);
  assert.equal(g1.metrics.oracle, 1);
  assert.equal(room.playerView(g1).afterlife.oracle.total, 1);
});

test('A Chill: once per game, reaches the living player, and counts toward Restless Spirit', () => {
  const { room, P, profiles, until } = game();
  until('discussion');
  const g = room.inGame().find((p) => room.team(p) === 'town' && p.role !== 'medium'); room.override({ id: g.id, op: 'kill' });
  const t = room.alive()[0];
  assert(room.ghostChill(g, t.id).ok);
  assert.match(room.ghostChill(g, t.id).error, /already/);
  assert(room.playerView(t).chill && room.playerView(t).chill.id, 'their phone gets the chill');
  assert.equal(profiles.data.profiles[g.profileId].stats.chills, 1);
  assert(profiles.data.profiles[g.profileId].owned.includes('ghostSkin:wisp'), 'first time as a ghost unlocks the Will-o’-Wisp');
});

test('The Medium chooses which ghosts can whisper; one word per day and per night', () => {
  const { room, until } = game();
  until('discussion');
  const medium = room.inGame().find((p) => p.role === 'medium');
  const [a, b] = room.inGame().filter((p) => room.team(p) === 'town' && p.role !== 'medium');
  room.override({ id: a.id, op: 'kill' }); room.override({ id: b.id, op: 'kill' });
  assert.match(room.ghostWhisper(a, 'Trust').error, /No Medium/);
  assert(room.spiritLine(medium, a.id, true).ok);
  assert.equal(room.spiritLine(medium, room.alive().find((x) => x.id !== medium.id).id, true).ok, false, 'only the dead');
  assert(room.ghostWhisper(a, 'Liar').ok);
  assert.match(room.ghostWhisper(a, 'Trust').error, /One word per day/);
  assert.match(room.ghostWhisper(b, 'Trust').error, /No Medium/, 'not invited');
  assert.equal(room.ghostWhisper(a, 'Bob is Mafia').ok, false);
  const view = room.playerView(medium).spiritCircle;
  assert.equal(view.log[0].word, 'Liar'); assert.deepEqual(view.invited, [a.id]);
  assert(room.playerView(a).afterlife.spirit.mediumName === medium.name);
  assert(!room.playerView(room.alive().find((x) => x.id !== medium.id)).spiritCircle, 'nobody else sees the line');
});

test('A Mafia ghost shrouds the ballot once: the reveal hides who voted for whom', () => {
  const { room, until } = game();
  until('discussion');
  const town = room.inGame().find((p) => room.team(p) === 'town' && p.role !== 'medium');
  room.override({ id: town.id, op: 'kill' });
  assert.match(room.ghostShroud(town).error, /Mafia ghost/);
  town.role = 'mafia'; // stand in for a dead Mafia member without ending the game
  assert(room.ghostShroud(town).ok);
  assert(room.votesAnonymous());
  assert.match(room.ghostShroud(town).error, /already/);
  until('voting');
  for (const p of room.alive()) room.vote(p, 'skip');
  for (let i = 0; i < 40 && room.phase === 'voting'; i++) room.clock.advance(500);
  assert(room.voteHistory[room.voteHistory.length - 1].secret);
  assert(room.cinematic && (room.cinematic.anonymous || room.cinematic.type !== 'votes'));
});

test('Bets: gold is held, the winner takes the pot, unsettled bets are refunded; first bet unlocks High Roller tier 1', () => {
  const { room, profiles, until, gold } = game();
  until('discussion');
  const [a, b, c] = room.inGame().filter((p) => room.team(p) === 'town' && p.role !== 'medium');
  for (const x of [a, b, c]) room.override({ id: x.id, op: 'kill' });
  const target = room.alive().find((p) => room.team(p) === 'town');
  assert.match(room.offerWager(room.alive()[0], { kind: 'vote', pick: target.id, stake: 25 }).error, /Ghosts/);
  const before = gold(a) + gold(b) + gold(c);
  const bet = room.offerWager(a, { kind: 'vote', pick: target.id, stake: 25 }); assert(bet.ok, bet.error);
  assert.equal(gold(a), 175);
  assert.match(room.takeWager(a, bet.id).error, /own bet/);
  assert(room.takeWager(b, bet.id).ok); assert.equal(gold(b), 175);
  const open = room.offerWager(c, { kind: 'winner', pick: 'town', stake: 10 }); assert(open.ok);
  const won = room.offerWager(a, { kind: 'winner', pick: 'mafia', stake: 10 }); assert(won.ok);
  assert(room.takeWager(c, won.id).ok);
  assert(profiles.data.profiles[a.profileId].owned.includes('reactions:rxCasino'), 'High Roller tier 1');
  until('voting');
  for (const p of room.alive()) room.vote(p, p.id === target.id ? room.alive().find((x) => x.id !== target.id).id : target.id);
  for (let i = 0; i < 40 && room.phase === 'voting'; i++) room.clock.advance(500);
  assert.equal(room.wagers[0].status, 'settled'); assert.equal(room.wagers[0].winnerName, a.name);
  for (let i = 0; i < 4000 && room.phase !== 'gameover'; i++) room.clock.advance(500);
  assert.equal(room.phase, 'gameover');
  assert(room.wagers.every((w) => ['settled', 'refunded'].includes(w.status)));
  assert.equal(gold(a) + gold(b) + gold(c), before, 'bets only move gold between players');
});

test('High Roller tiers must be bought in order; ghost looks are on the shelves', () => {
  const s = new ProfileStore(), a = s.create(); s.grant(a.id, 2000);
  assert.match(s.buy(a.id, 'hat:dealerVisor').error, /own the Casino Reactions first/);
  s.bumpStat(a.id, 'bets');
  assert(s.buy(a.id, 'hat:dealerVisor').ok);
  assert.match(s.buy(a.id, 'effect:goldRain').error, /High Roller Top Hat first/);
  assert(s.buy(a.id, 'hat:highRoller').ok); assert(s.buy(a.id, 'effect:goldRain').ok);
  assert(s.view(a.id).stock.includes('ghostSkin:sheet'));
  assert(s.buy(a.id, 'ghostSkin:sheet').ok);
  assert(s.equip(a.id, 'ghostSkin:sheet', true).ok); assert.equal(s.view(a.id).avatar.ghostSkin, 'sheet');
  assert(C.CATALOG.find((i) => i.id === 'deathAnim:ectoplasm').cost > 0);
});

test('Gold: right predictions and a win from beyond the grave pay a little', () => {
  const s = new ProfileStore(), a = s.create();
  const r = s.award(a.id, 'g1', { won: true, alive: false, role: 'doctor', team: 'town', metrics: { oracle: 9 } });
  assert(r.lines.some((l) => l.key === 'oracle' && l.amount === C.REWARDS.oracle * C.REWARDS.oracleCap), 'capped');
  assert(r.lines.some((l) => l.key === 'spirit'));
});

console.log(`All ${passed} afterlife tests passed.`);
