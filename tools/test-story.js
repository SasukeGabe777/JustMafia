'use strict';
// Story-aware deaths (public facts only) and Update 8 farewell animations.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
const O = require('../public/shared/options');
const C = require('../public/shared/cosmetics');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function game(roles, extra = {}) {
  const clock = new VirtualClock(), room = new Room('STORY', null, { clock, seed: 9 });
  const P = {};
  for (const name of Object.keys(roles)) { const p = room.join({ name }).player; p.sockets = 1; P[name] = p; }
  const counts = {}; for (const r of Object.values(roles)) if (r !== 'villager') counts[r] = (counts[r] || 0) + 1;
  room.updateSettings({ roleSelection: 'manual', autoMafia: false, roleCounts: counts, minPlayers: 3, botsAuto: false, skipCinematics: true, ...extra });
  room.updateSettings({ forcedRoles: Object.fromEntries(Object.entries(roles).map(([n, r]) => [P[n].id, r])) });
  room.hostAction({ type: 'start' }); room.advance();
  return { room, P };
}
const killAtNight = (room, killer, victim) => { room.voteMafia(killer, victim.id); room.advance(); return room.cinematic.events.find((e) => e.targetId === victim.id); };

test('First death, a roommate who will find them, and the narrator says so at dawn', () => {
  const { room, P } = game({ Ma: 'mafia', Ana: 'villager', Ben: 'villager', Cy: 'villager', Di: 'villager', Ed: 'villager' });
  P.Ben.livesWith = P.Ana.id; // they share Ana's house (public: the house sign shows both)
  const e = killAtNight(room, P.Ma, P.Ana);
  assert(e.story.first, 'nobody had died before');
  assert.equal(e.story.roommate, 'Ben');
  assert.equal(e.story.alive, 5);
  room.advance(); // dawn → morning
  assert.match(room.narration.text, /Ben found them at dawn/);
});

test('Yesterday’s public vote and a near-hanging become story facts', () => {
  const { room, P } = game({ Ma: 'mafia', Ana: 'villager', Ben: 'villager', Cy: 'villager', Di: 'villager', Ed: 'villager', Fi: 'villager' });
  room.voteMafia(P.Ma, P.Fi.id); room.advance(); room.advance(); // night 1: Fi dies
  while (room.phase !== 'voting') room.advance();
  room.vote(P.Ana, P.Ben.id); room.vote(P.Cy, P.Ana.id); room.vote(P.Di, P.Ana.id); room.vote(P.Ma, P.Ed.id); room.vote(P.Ben, P.Ed.id); room.vote(P.Ed, P.Ed.id === P.Ed.id ? P.Cy.id : P.Cy.id);
  room.advance(); // tally: Ana 2, Ed 2 → tie: no execution with tieRule none
  while (room.phase !== 'night') room.advance();
  const e = killAtNight(room, P.Ma, P.Ana);
  assert.equal(e.story.accused, 'Ben', 'Ana voted for Ben yesterday (public)');
  assert(e.story.nearly, 'two votes against Ana, but she was not hanged');
  assert(!e.story.first);
});

test('Anonymous votes: no vote-based facts at all', () => {
  const { room, P } = game({ Ma: 'mafia', Ana: 'villager', Ben: 'villager', Cy: 'villager', Di: 'villager' }, { anonymousVotes: true });
  room.voteMafia(P.Ma, P.Di.id); room.advance(); room.advance();
  while (room.phase !== 'voting') room.advance();
  room.vote(P.Ana, P.Ben.id); room.vote(P.Cy, P.Ben.id); room.vote(P.Ben, P.Ana.id); // Ben is hanged; Ana voted for him
  while (room.phase !== 'night') room.advance();
  const e = killAtNight(room, P.Ma, P.Ana);
  assert(e && e.story, 'Ana dies tonight');
  assert(!e.story.accused && !e.story.nearly, 'with anonymous votes, nobody’s vote shows up in the story');
});

test('A survivor of an earlier attack, and story payloads never carry roles or night actions', () => {
  const { room, P } = game({ Ma: 'mafia', Doc: 'doctor', Ana: 'villager', Ben: 'villager', Cy: 'villager', Di: 'villager' });
  room.nightAction(P.Doc, P.Ana.id); room.voteMafia(P.Ma, P.Ana.id); room.advance(); room.advance(); // saved
  while (room.phase !== 'night') room.advance();
  const e = killAtNight(room, P.Ma, P.Ana);
  assert(e.story.survived);
  const json = JSON.stringify(room.hostView().cinematic);
  assert(!/mafia|doctor|role|team|actorId/i.test(JSON.stringify(e.story)), 'story: names and public flags only');
  assert(!json.includes('"role"'), 'the TV cinematic has no role fields');
});

test('Executions carry a story too (roommate in the crowd, first verdict)', () => {
  const { room, P } = game({ Ma: 'mafia', Ana: 'villager', Ben: 'villager', Cy: 'villager', Di: 'villager', Ed: 'villager' });
  P.Ben.livesWith = P.Ana.id;
  room.advance(); room.advance(); // quiet night
  while (room.phase !== 'voting') room.advance();
  for (const p of room.alive().filter((x) => x.id !== P.Ana.id)) room.vote(p, P.Ana.id);
  while (room.phase !== 'execution') room.advance();
  const c = room.cinematic; assert.equal(c.type, 'execution');
  assert(c.story.first); assert.equal(c.story.roommate, 'Ben');
});

test('Update 8: farewell animations are shop items and an avatar field everyone can see', () => {
  assert.deepEqual(O.deathAnim.slice(0, 1), ['none']);
  assert.equal(O.AVATAR_FIELDS.deathAnim, 'deathAnim');
  const items = C.CATALOG.filter((i) => i.field === 'deathAnim');
  assert.equal(items.length, O.deathAnim.length);
  assert(items.find((i) => i.value === 'none').free);
  for (const i of items.filter((x) => x.value !== 'none')) { assert(i.cost >= 80, i.id); assert.equal(i.category, 'animations'); assert(!/a .* farewell animation for/.test(i.description), 'has a real description'); }
  const { room } = game({ Ma: 'mafia', Ana: 'villager', Ben: 'villager' });
  assert.equal(room.sanitizeAvatar({ deathAnim: 'petals' }).deathAnim, 'petals');
  assert.equal(room.sanitizeAvatar({ deathAnim: 'nonsense' }).deathAnim, 'none');
});

console.log(`All ${passed} story / farewell tests passed.`);
