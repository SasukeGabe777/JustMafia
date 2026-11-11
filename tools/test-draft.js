'use strict';
// Role Draft rules: Default vs Manual, card scaling and balance, voting validation,
// ties, invalid votes, privacy, disconnect/leave/join during the draft, dealing and flips.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
const R = require('../public/shared/roles');
const D = require('../public/shared/draft');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function makeRoom({ humans = 0, bots = 0, seed = 1, settings = {} } = {}) {
  const clock = new VirtualClock();
  clock.advance = (ms) => { const end = clock.t + ms; while ([...clock.queue.values()].some((e) => e.at <= end)) clock.step(); clock.t = Math.max(clock.t, end); };
  const room = new Room('TEST', null, { clock, seed });
  room.updateSettings({ minPlayers: 3, ...settings });
  const people = [];
  for (let i = 0; i < humans; i++) { const p = room.join({ name: `H${i}` }).player; p.sockets = 1; people.push(p); }
  if (bots) room.addBots(bots);
  return { room, clock, people };
}
const toVote = (room, clock) => { clock.advance(7100); assert.equal(room.draft.stage, 'vote'); };
const mafiaCount = (list) => list.filter((r) => R.ROLES[r].team === 'mafia').length;

test('Default is the card draft; Manual and forced roles keep the old instant start', () => {
  const a = makeRoom({ bots: 6 });
  assert.equal(a.room.settings.roleSelection, 'draft');
  assert(a.room.hostAction({ type: 'start' }).ok);
  assert.equal(a.room.phase, 'draft'); assert.equal(a.room.draft.stage, 'deck');
  assert(a.room.inGame().every((p) => !p.role), 'no roles are dealt during the draft');

  const m = makeRoom({ bots: 6, settings: { roleSelection: 'manual', roleCounts: { detective: 1, doctor: 1 } } });
  const expected = R.buildRoleList(m.room.settings, 6).roles.slice().sort();
  assert(m.room.hostAction({ type: 'start' }).ok);
  assert.equal(m.room.phase, 'roleReveal');
  assert.deepEqual(m.room.inGame().map((p) => p.role).sort(), expected, 'manual uses the configured role list');
  assert(!m.room.draft, 'manual mode never builds a draft');

  const f = makeRoom({ bots: 6 });
  f.room.updateSettings({ forcedRoles: { [f.room.inGame()[0].id]: 'detective' } });
  assert(f.room.hostAction({ type: 'start' }).ok);
  assert.equal(f.room.phase, 'roleReveal', 'test-mode forced roles skip the draft');
  assert.equal(f.room.inGame()[0].role, 'detective');
});

test('Card count scales with players (4 → 3, 8 → 5) and the bank gives a balanced mix', () => {
  assert.equal(D.SCALE.cards(4), 3); assert.equal(D.SCALE.cards(8), 5);
  for (let n = 4; n <= 40; n++) {
    const cards = D.candidates(n, {}, Math.random, {});
    assert.equal(new Set(cards).size, cards.length, 'no duplicate cards');
    assert(cards.length >= 3 && cards.length <= D.SCALE.cards(n));
    assert(cards.every((k) => R.ROLES[k] && k !== 'villager' && k !== 'mafia'), 'only real special roles');
    assert(cards.some((k) => R.ROLES[k].team === 'town'), 'town cards offered');
    if (n >= 7) assert(cards.some((k) => R.ROLES[k].team === 'mafia'), `mafia card offered at ${n}`);
    if (n >= 14) assert(cards.some((k) => R.ROLES[k].team === 'neutral'), 'neutral cards in big games');
    if (R.autoMafiaCount(n) < 2) assert(cards.filter((k) => R.ROLES[k].team === 'mafia').every((k) => k === 'godfather'), 'small games: only a Mafia card that can kill');
  }
  assert(!D.candidates(20, { anonymousVotes: true }, () => 0.01, {}).includes('puppetMaster'), 'Puppet Master needs public votes');
});

test('Roles rotate: a room keeps offering cards it has not shown much yet', () => {
  const { room } = makeRoom({ bots: 8, seed: 3 });
  const seen = new Set();
  for (let i = 0; i < 12; i++) { assert(room.hostAction({ type: 'start' }).ok); room.draft.cards.forEach((k) => seen.add(k)); room.hostAction({ type: 'lobby' }); }
  assert(seen.size >= 12, `only ${seen.size} different roles offered over 12 games`);
});

test('Voting is validated: real cards only, up to the pick limit, toggle to change, lock-in is final', () => {
  const { room, clock, people } = makeRoom({ humans: 5, bots: 3 });
  room.hostAction({ type: 'start' });
  const [a, b] = people;
  assert.equal(room.draftVote(a, { role: room.draft.cards[0], on: true }).ok, false, 'no voting during the deck shuffle');
  assert.equal(room.hostAction({ type: 'start' }).ok, false, 'a second Start does not create another draft');
  toVote(room, clock);
  const d = room.draft, [c0, c1, c2] = d.cards;
  assert.equal(room.draftVote(a, { role: 'villager', on: true }).ok, false);
  assert.equal(room.draftVote(a, { role: 'nope', on: true }).ok, false);
  assert(room.draftVote(a, { role: c0, on: true }).ok);
  assert(room.draftVote(a, { role: c0, on: true }).ok); // same vote twice counts once
  assert.equal(room.draftView().tally[c0], 1);
  for (const k of d.cards) room.draftVote(b, { role: k, on: true });
  assert.equal(room.draft.ballots[b.id].length, d.picks, 'never more than the pick limit');
  assert(room.draftVote(a, { role: c0, on: false }).ok && room.draftVote(a, { role: c1, on: true }).ok, 'changing a vote');
  assert.deepEqual(room.draftView(a).mine, [c1]);
  assert(room.draftVote(a, { ready: true }).ok);
  assert.equal(room.draftVote(a, { role: c2, on: true }).ok, false, 'locked ballots cannot change');
  const judgeLike = room.join({ name: 'Late' }).player; judgeLike.spectator = true;
  assert.equal(room.draftVote(judgeLike, { role: c0, on: true }).ok, false, 'spectators cannot vote');
});

test('Everyone locking in closes the vote early; the result is server-decided', () => {
  const { room, clock, people } = makeRoom({ humans: 4, bots: 4 });
  room.hostAction({ type: 'start' }); toVote(room, clock);
  const target = room.draft.cards[0];
  for (const p of people) { room.draftVote(p, { role: target, on: true }); room.draftVote(p, { ready: true }); }
  clock.advance(6500); // bots lock in within ~4.3 s; then the vote closes 1.5 s later
  assert.equal(room.draft.stage, 'result', 'closed well before the 45 s timer');
  assert(room.draft.result.roles.includes(target) || room.draft.result.dropped.includes(target));
});

test('Ties are settled by a fair random draw (different seeds, different winners)', () => {
  const winners = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const cards = ['detective', 'doctor', 'sheriff', 'bodyguard', 'mayor'];
    let s = seed; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const f = D.finalize({ cards, ballots: { a: ['detective', 'doctor', 'sheriff', 'bodyguard', 'mayor'] }, n: 8, rng });
    assert(f.tie); assert.equal(f.roles.length, 3);
    winners.add(f.roles.slice().sort().join());
  }
  assert(winners.size > 3, 'ties do not always go the same way');
});

test('Invalid votes are repaired: always ≥ 1 Mafia, never a stacked Mafia, never more roles than players', () => {
  for (let n = 4; n <= 30; n++) {
    for (let t = 0; t < 40; t++) {
      const cards = D.candidates(n, {}, Math.random, {});
      const allMafia = Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, cards.filter((k) => R.ROLES[k].team === 'mafia')]));
      const none = {};
      for (const ballots of [allMafia, none]) {
        const f = D.finalize({ cards, ballots, n });
        assert.deepEqual(f.errors, []); assert.equal(f.list.length, n);
        assert(mafiaCount(f.list) >= 1 && mafiaCount(f.list) <= R.autoMafiaCount(n), `mafia count at ${n}`);
        assert(f.list.some((r) => r === 'mafia' || r === 'godfather'), 'someone can kill');
      }
    }
  }
  // Cards that can never fit (two non-killing Mafia roles in a 4-player game) fall back to the classic setup.
  const f = D.finalize({ cards: ['silencer', 'roleblocker'], ballots: { a: ['silencer', 'roleblocker'] }, n: 4 });
  assert(f.fallback); assert.deepEqual(f.roles, []); assert.equal(mafiaCount(f.list), 1); assert.equal(f.list.length, 4);
});

test('The full draft deals exactly one role per player, using the drafted cards, and keeps roles secret', () => {
  for (const n of [4, 5, 8, 12, 20]) {
    const { room, clock, people } = makeRoom({ humans: 2, bots: n - 2, seed: n });
    room.hostAction({ type: 'start' }); toVote(room, clock);
    for (const p of people) { room.draftVote(p, { role: room.draft.cards[1], on: true }); room.draftVote(p, { ready: true }); }
    // During the draft nobody's role exists anywhere.
    for (const v of [room.hostView(), room.playerView(people[0])]) assert(!JSON.stringify(v.draft).match(/"role"/), 'draft view has no player roles');
    clock.advance(6000); assert.equal(room.draft.stage, 'result');
    const drafted = room.draft.result.roles;
    clock.advance(5600); assert.equal(room.draft.stage, 'collect');
    clock.advance(5100); assert.equal(room.phase, 'roleReveal');
    const roles = room.inGame().map((p) => p.role);
    assert.equal(roles.length, n); assert(roles.every(Boolean));
    for (const k of drafted) assert(roles.includes(k), `${k} was drafted but not dealt (n=${n})`);
    assert(mafiaCount(roles) >= 1);
    // Secret: the TV and other phones never see a living player's role.
    assert(room.hostView().players.every((p) => !p.role));
    const v = room.playerView(people[0]);
    assert.equal(v.role, people[0].role);
    assert(v.players.filter((x) => x.id !== people[0].id).every((x) => !x.role));
    assert(!JSON.stringify(room.hostView().draft).includes(people[1].role) || R.ROLES[people[1].role].team === 'town' || drafted.includes(people[1].role), 'public draft data only lists the drafted cards');
  }
});

test('Flipping: only your own card, only while dealing; everyone flipped ends the reveal early', () => {
  const { room, clock, people } = makeRoom({ humans: 3, bots: 3 });
  room.hostAction({ type: 'start' });
  assert.equal(room.flipCard(people[0]).ok, false, 'nothing to flip before the deal');
  room.hostAction({ type: 'skip' }); room.hostAction({ type: 'skip' }); room.hostAction({ type: 'skip' }); room.hostAction({ type: 'skip' });
  assert.equal(room.phase, 'roleReveal');
  const endsAt = room.endsAt;
  assert(endsAt - room.now() > 20000, 'a drafted reveal waits for flips');
  room.flipCard(people[0]); room.flipCard(people[0]);
  assert.deepEqual(room.draftView().flippedIds, [people[0].id], 'the TV only learns WHO looked');
  room.flipCard(people[1]); room.flipCard(people[2]);
  assert(room.endsAt - room.now() <= 3500, 'everyone looked: the game begins shortly');
  clock.advance(3600); assert.equal(room.phase, 'night');
});

test('Disconnects, leaving and joining mid-draft never restart the draft or duplicate roles', () => {
  const { room, clock, people } = makeRoom({ humans: 5, bots: 3 });
  room.hostAction({ type: 'start' }); toVote(room, clock);
  const id = room.draft.id, cards = room.draft.cards.slice();
  room.draftVote(people[0], { role: cards[0], on: true });
  people[0].sockets = 0; // phone dropped
  assert.deepEqual(room.draftView(people[0]).mine, [cards[0]], 'their ballot is kept for when they reconnect');
  people[0].sockets = 1;
  room.draftVote(people[4], { role: cards[2], on: true });
  room.kick(people[4].id); // leaves mid-draft: their ballot no longer counts
  assert.equal(room.draftView().tally[cards[2]] || 0, 0);
  const late = room.join({ name: 'Late' }).player; late.sockets = 1;
  assert(!late.spectator, 'joining during the draft still gets you dealt in');
  room.hostAction({ type: 'skip' }); room.hostAction({ type: 'skip' }); room.hostAction({ type: 'skip' });
  assert.equal(room.draft.id, id, 'same draft throughout');
  assert.deepEqual(room.draft.cards, cards);
  assert.equal(room.phase, 'roleReveal');
  const dealt = room.inGame();
  assert.equal(dealt.length, 8); assert(dealt.every((p) => p.role)); assert(dealt.includes(late));
  assert(!room.players.has(people[4].id) || room.players.get(people[4].id).left);
});

test('Back to lobby cancels a draft cleanly; pause and +30s work during the vote', () => {
  const { room, clock } = makeRoom({ bots: 6 });
  room.hostAction({ type: 'start' }); toVote(room, clock);
  room.hostAction({ type: 'pause' }); const left = room.remainingMs;
  clock.advance(60000); assert.equal(room.draft.stage, 'vote', 'paused vote does not close');
  room.hostAction({ type: 'resume' }); assert(Math.abs(room.endsAt - room.now() - left) < 5);
  room.hostAction({ type: 'lobby' });
  assert.equal(room.phase, 'lobby'); assert.equal(room.draft, null); assert.equal(room.draftCounts, null);
  clock.advance(60000); assert.equal(room.phase, 'lobby', 'no leftover draft timer');
  assert(room.hostAction({ type: 'start' }).ok); assert.equal(room.phase, 'draft');
});

test('Old saved settings without roleSelection still load (and Manual can be chosen and saved)', () => {
  const { room } = makeRoom({ bots: 5 });
  room.updateSettings({ roleSelection: undefined, draftSeconds: undefined, nightSeconds: 30 });
  assert.equal(room.settings.roleSelection, 'draft');
  room.updateSettings({ roleSelection: 'manual', draftSeconds: 9999 });
  assert.equal(room.settings.roleSelection, 'manual'); assert.equal(room.settings.draftSeconds, 300);
  room.updateSettings({ roleSelection: 'bogus' }); assert.equal(room.settings.roleSelection, 'manual');
});

test('Default stays the draft unless custom roles are chosen (role list or preset); Default can be picked again', () => {
  const { room } = makeRoom({ bots: 6 });
  room.updateSettings({ nightSeconds: 40, theme: 'rsp' });
  assert.equal(room.settings.roleSelection, 'draft', 'other settings never change the mode');
  room.updateSettings({ roleCounts: { detective: 1, doctor: 1, sheriff: 1 } });
  assert.equal(room.settings.roleSelection, 'manual', 'editing the role list = custom roles');
  room.updateSettings({ roleSelection: 'draft' });
  assert.equal(room.settings.roleSelection, 'draft');
  assert(room.applyPreset('chaos').ok);
  assert.equal(room.settings.roleSelection, 'manual', 'a preset is a custom role setup');
  room.updateSettings({ roleSelection: 'draft', roleCounts: { detective: 1 } });
  assert.equal(room.settings.roleSelection, 'draft', 'an explicit choice in the same update wins (saved setups)');
});

test('Mafia coordination lists the roles in this game after the vote (never who holds them); others get nothing', () => {
  const { room, clock, people } = makeRoom({ humans: 3, bots: 5, seed: 11 });
  room.hostAction({ type: 'start' }); toVote(room, clock);
  for (let i = 0; i < 3; i++) room.hostAction({ type: 'skip' }); // vote → result → collect → deal
  assert.equal(room.phase, 'roleReveal');
  const mafia = room.inGame().find((p) => room.team(p) === 'mafia');
  const town = room.inGame().find((p) => room.team(p) === 'town');
  const mv = room.mafiaView(mafia);
  const listed = Object.fromEntries(mv.rolesInGame.map((r) => [r.role, r.count]));
  assert.deepEqual(listed, room.composition);
  for (const k of room.draft.result.roles) assert(listed[k], `${k} listed for the Mafia`);
  assert(!JSON.stringify(mv.rolesInGame).match(/"id"|holder|player/i), 'roles only, no holders');
  assert.equal(room.mafiaView(town), null);
  assert.equal(room.playerView(people.find((p) => room.team(p) !== 'mafia') || town).mafia, null);
});

console.log(`All ${passed} role draft tests passed.`);
