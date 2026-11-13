'use strict';
// DLC 1, part 2: the Mathematician, the Gamer, the Zombie horde and the Priest.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
const R = require('../public/shared/roles');
const D = require('../public/shared/draft');
const { problem } = require('../rules/dlc2');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function game(roles, extra = {}) {
  const clock = new VirtualClock(), room = new Room('DLC2', null, { clock, seed: 5 });
  const P = {};
  for (const name of Object.keys(roles)) { const p = room.join({ name }).player; p.sockets = 1; P[name] = p; }
  const counts = {}; for (const r of Object.values(roles)) if (r !== 'villager') counts[r] = (counts[r] || 0) + 1;
  room.updateSettings({ roleSelection: 'manual', autoMafia: false, roleCounts: counts, minPlayers: 3, botsAuto: false, skipCinematics: true, revealRoleOnDeath: true, ...extra });
  room.updateSettings({ forcedRoles: Object.fromEntries(Object.entries(roles).map(([n, r]) => [P[n].id, r])) });
  const s = room.hostAction({ type: 'start' }); assert(s.ok, s.error); room.advance();
  assert.equal(room.phase, 'night');
  return { room, P, clock };
}
const toMorning = (room) => { room.advance(); room.advance(); };
const toNight = (room) => { while (room.phase !== 'night' && room.phase !== 'gameover') room.advance(); };
const noteOf = (p, re) => p.notes.find((n) => re.test(n.text));

test('Four new DLC 1 roles; the Priest always comes with the Zombie (and never alone)', () => {
  for (const k of ['mathematician', 'gamer', 'zombie', 'priest']) { assert(R.ROLES[k] && R.ROLE_PACKS.dlc1.roles.includes(k), k); assert(R.reference(k).ability.length > 30, k); }
  assert(R.buildRoleList({ autoMafia: true, roleCounts: { zombie: 1 } }, 10).roles.includes('priest'));
  assert(!R.buildRoleList({ autoMafia: true, roleCounts: { priest: 1 } }, 10).roles.includes('priest'));
  assert.equal(D.META.priest.companion, true, 'the Priest is never a draft card of its own');
});

test('Math problems have the right answers and get harder', () => {
  let s = 1; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let level = 1; level <= 5; level++) for (let i = 0; i < 40; i++) {
    const p = problem(rng, level);
    assert(Number.isInteger(p.a), p.q);
    if (/^\d+ [+−×] \d+$/.test(p.q)) { const [a, op, b] = p.q.split(' '); assert.equal(p.a, op === '+' ? +a + +b : op === '−' ? a - b : a * b, p.q); }
  }
});

test('Mathematician: a right answer counts the threats among two players; wrong twice gives nothing', () => {
  const { room, P } = game({ Ma: 'mafia', GF: 'godfather', Math: 'mathematician', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager' });
  const v = room.playerView(P.Math);
  assert(v.math && v.math.problem && v.math.tries === 2);
  const answer = P.Math.math.problem.a;
  assert.equal(room.dlc2Action(P.Math, { op: 'solve', a: P.Ma.id, b: P.GF.id, answer: String(answer) }).correct, true);
  room.voteMafia(P.Ma, P.V4.id); room.voteMafia(P.GF, P.V4.id);
  toMorning(room);
  assert(noteOf(P.Math, /of Ma and GF, exactly ONE is a threat/), 'the Godfather counts as harmless');
  toNight(room);
  const a1 = P.Math.math.problem.a;
  assert.equal(room.dlc2Action(P.Math, { op: 'solve', a: P.V1.id, b: P.V2.id, answer: String(a1 + 1) }).triesLeft, 1);
  const a2 = P.Math.math.problem.a;
  assert.equal(room.dlc2Action(P.Math, { op: 'solve', a: P.V1.id, b: P.V2.id, answer: String(a2 + 1) }).triesLeft, 0);
  assert.equal(room.dlc2Action(P.Math, { op: 'solve', a: P.V1.id, b: P.V2.id, answer: String(a2) }).ok, false, 'no third try');
});

test('Gamer: the score unlocks powers (capped by time), Shield protects, High Score reads the role', () => {
  const { room, P, clock } = game({ Ma: 'mafia', Gam: 'gamer', Doc: 'doctor', V1: 'villager', V2: 'villager', V3: 'villager' });
  assert.equal(room.dlc2Action(P.Gam, { op: 'power', power: 'shield', targetId: P.V1.id }).ok, false, 'play first');
  assert(room.dlc2Action(P.Gam, { op: 'start' }).ok);
  assert.equal(room.dlc2Action(P.Gam, { op: 'start' }).ok, false, 'one run per night');
  clock.t += 8000; // an 8-second run can't score 40
  assert.equal(room.dlc2Action(P.Gam, { op: 'score', score: 40 }).score, 8);
  assert.equal(room.dlc2Action(P.Gam, { op: 'power', power: 'scan', targetId: P.V1.id }).ok, false, 'Scan needs 12');
  assert(room.dlc2Action(P.Gam, { op: 'power', power: 'shield', targetId: P.V1.id }).ok);
  room.voteMafia(P.Ma, P.V1.id);
  toMorning(room);
  assert(P.V1.alive, 'the Shield stopped the attack');
  toNight(room);
  room.dlc2Action(P.Gam, { op: 'start' }); clock.t += 60000;
  assert.equal(room.dlc2Action(P.Gam, { op: 'score', score: 30 }).score, 30);
  assert(room.dlc2Action(P.Gam, { op: 'power', power: 'high', targetId: P.Ma.id }).ok);
  toMorning(room);
  assert.equal(P.Gam.investigations.slice(-1)[0].result, 'mafia');
});

test('Zombie: bites from night 1 (a secret break-in on the TV); the bitten turn after the next night; night attacks fail on Zombies', () => {
  const { room, P } = game({ Ma: 'mafia', Zed: 'zombie', Pri: 'priest', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager', V6: 'villager' });
  room.nightAction(P.Zed, P.V1.id); room.voteMafia(P.Ma, P.Zed.id);
  room.advance();
  const ev = (room.cinematic && room.cinematic.events) || [];
  assert(ev.some((e) => e.type === 'bite'), 'the TV gets a break-in');
  assert(!JSON.stringify(ev).includes('infected'), 'nothing names the bitten');
  room.advance();
  assert(P.Zed.alive, 'the Mafia can’t kill a Zombie at night');
  toMorning(room);
  assert(P.V1.infected && noteOf(P.V1, /bit you/), 'bitten and told');
  assert.equal(P.V1.role, 'villager', 'not turned yet');
  toNight(room); toMorning(room);
  assert.equal(P.V1.role, 'zombie', 'turned when the next night ended');
  assert.equal(P.V1.zombieFrom, 'villager');
  assert(room.playerView(P.V1).teammates.some((t) => t.id === P.Zed.id), 'the horde knows each other');
  assert(!room.nightTargets(P.Zed).includes(P.V1.id) || room.phase !== 'night');
});

test('Priest: a blessing stops any attack or bite, cures the bitten, and once per game cures a Zombie', () => {
  const { room, P } = game({ Ma: 'mafia', Zed: 'zombie', Pri: 'priest', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager', V5: 'villager', V6: 'villager' });
  room.nightAction(P.Zed, P.V1.id); room.nightAction(P.Pri, P.V1.id); room.voteMafia(P.Ma, P.V1.id);
  toMorning(room);
  assert(!P.V1.infected && P.V1.alive, 'the blessing stopped the bite and the Mafia attack');
  assert(!P.Pri.notes.some((n) => /bitten, and now|No bite/.test(n.text)), 'the Priest can’t tell a real bite from a fake one');
  toNight(room);
  room.nightAction(P.Zed, P.V2.id); room.nightAction(P.Pri, P.V3.id);
  toMorning(room);
  assert(P.V2.infected);
  toNight(room);
  room.nightAction(P.Pri, P.V2.id); room.nightAction(P.Zed, P.V4.id);
  toMorning(room);
  assert(!P.V2.infected && P.V2.role === 'villager', 'cured before turning');
  toNight(room);
  room.nightAction(P.Pri, P.Zed.id);
  toMorning(room);
  assert.equal(P.Zed.role, 'villager', 'the one great cure makes Patient Zero human');
  assert(P.Pri.exorcismUsed);
});

test('Wins: the horde wins at half the living (more Zombies than Mafia); Town can’t win while a Zombie walks; bites grow with the horde', () => {
  assert.deepEqual([1, 2, 3, 4, 6].map((z) => new Room('X', null, {}).biteCount(z)), [1, 2, 3, 4, 4]);
  const { room, P } = game({ Ma: 'mafia', Zed: 'zombie', Pri: 'priest', V1: 'villager', V2: 'villager' });
  room.kill(P.Ma, 'vote');
  assert.equal(room.checkWinner(), null, 'a Zombie is still out there');
  P.V1.role = 'zombie'; room.kill(P.V2, 'vote');
  assert.equal(room.checkWinner(), 'zombie');
  room.winner = 'zombie';
  assert(room.didWin(P.Zed) && room.didWin(P.V1) && !room.didWin(P.Pri));
});

test('Tiers: 3–4 unlocks each, base game first (tiers 1–8), then DLC 1 (9–12)', () => {
  const base = new Set([...R.ROLE_PACKS.core.roles, ...R.ROLE_PACKS.expansion.roles]);
  for (let t = 1; t <= D.MAX_TIER; t++) {
    assert(D.TIER[t].length >= 3 && D.TIER[t].length <= 4, `tier ${t}`);
    assert(D.TIER[t].every((k) => (t <= 8 ? base.has(k) : R.ROLE_PACKS.dlc1.roles.includes(k))), `tier ${t} pack`);
  }
});

console.log(`\nAll ${passed} DLC 1 (part 2) tests passed.`);
