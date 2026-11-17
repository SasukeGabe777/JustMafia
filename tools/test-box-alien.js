'use strict';
// Alien Abduction rules: played to the end by bots on a virtual clock.  node tools/test-box-alien.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/alien');
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const run = (room, clock, until = () => room.game.phase === 'over') => { let i = 0; while (!until() && clock.step()) if (++i > 200000) throw new Error('never ended'); };
// A room of bots plus one connected human (Ana) we control.
function setup({ bots = 5, seed = 1, settings = {} } = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  const p = room.join('Ana').player; p.sockets = 1;
  room.addBots(bots);
  for (const [k, v] of Object.entries(settings)) room.hostAction({ type: 'settings', settings: { [k]: v } });
  assert(room.start().ok);
  return { clock, room, p, g: room.game };
}
const isAlien = (r) => r === 'alien' || r === 'mimic';

test('bots play whole games at every crew size; both sides can win; results() puts the winners first', () => {
  const wins = { crew: 0, aliens: 0 }, reasons = {};
  for (let n = 4; n <= 12; n++) for (let seed = 1; seed <= 12; seed++) {
    const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: seed * 31 + n });
    room.addBots(n); assert(room.start().ok);
    run(room, clock);
    const g = room.game;
    assert.equal(g.phase, 'over');
    assert(g.round >= 1 && g.round <= g.maxRounds, 'rounds within the trip');
    wins[g.winner]++; reasons[g.reason] = (reasons[g.reason] || 0) + 1;
    const res = g.results();
    assert.equal(res.length, n);
    const side = (id) => (isAlien(g.crew.get(id).role) ? 'aliens' : 'crew');
    const firstLoser = res.findIndex((id) => side(id) !== g.winner);
    if (firstLoser >= 0) assert(res.slice(firstLoser).every((id) => side(id) !== g.winner), 'every winner ranks above every loser');
    const st = g.standings(); for (let i = 1; i < st.length; i++) if (st[i].won === st[i - 1].won) assert(st[i].pts <= st[i - 1].pts, 'contribution order inside a side');
  }
  console.log('    wins', JSON.stringify(wins), 'endings', JSON.stringify(reasons));
  assert(wins.crew > 10 && wins.aliens > 10, 'both sides win sometimes');
});

test('roles: alien count by crew size, specials, aliens know each other', () => {
  for (const [n, aliens] of [[4, 1], [5, 1], [6, 2], [8, 2], [9, 3], [12, 3]]) {
    const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: n });
    room.addBots(n); room.start();
    const roles = [...room.game.crew.values()].map((c) => c.role);
    assert.equal(roles.filter(isAlien).length, aliens, `${n} players → ${aliens} aliens`);
    assert.equal(roles.filter((r) => r === 'engineer').length, n >= 5 ? 1 : 0);
    assert.equal(roles.filter((r) => r === 'scanner').length, n >= 6 ? 1 : 0);
    assert.equal(roles.filter((r) => r === 'mimic').length, aliens >= 2 ? 1 : 0);
  }
  const { g, room } = setup({ bots: 7, settings: { specials: false, aliens: 3 } });
  assert.equal([...g.crew.values()].filter((c) => isAlien(c.role)).length, 3);
  assert(![...g.crew.values()].some((c) => ['engineer', 'scanner', 'mimic'].includes(c.role)), 'specials off');
  const alien = [...g.crew.values()].find((c) => isAlien(c.role)), v = g.view(room.get(alien.id));
  assert.equal(v.allies.length, 2); assert(!g.tv().crew.some((c) => c.role || c.alien !== null), 'the TV never shows secret roles');
  const crew = [...g.crew.values()].find((c) => !isAlien(c.role)); assert.equal(g.view(room.get(crew.id)).allies, undefined);
});

test('a clean shift jumps the ship and heals; sabotage damages (max 2) and is counted, not named', () => {
  const { g, room, clock } = setup({ bots: 5, seed: 3 });
  g.next(); assert.equal(g.phase, 'emergency'); g.next(); assert.equal(g.phase, 'shift');
  const sys = g.emergency.sys; g.hp[sys] = 2;
  for (const c of g.living()) g.picks.set(c.id, { station: 0, sab: false });
  for (const c of g.living()) if (c.role === 'scanner') g.scans.set(c.id, 'skip');
  g.resolve();
  assert.equal(g.phase, 'report'); assert.equal(g.progress, 1); assert.equal(g.hp[sys], 3); assert.equal(g.report.S, 0); assert(g.report.jumped);
  const fixer = g.living().find((c) => !isAlien(c.role)); assert.equal(fixer.stats.fix, 1); assert.equal(fixer.stats.clean, 1);
  // next round: every alien sabotages
  g.next(); g.next(); assert.equal(g.phase, 'vote'); for (const c of g.living()) g.votes.set(c.id, 'skip'); g.tally(); g.next();
  assert.equal(g.phase, 'emergency'); g.next();
  const s2 = g.emergency.sys, hp0 = g.hp[s2];
  for (const c of g.living()) g.picks.set(c.id, { station: 1, sab: isAlien(c.role) });
  g.resolve();
  const n = g.aliensAlive().length;
  assert.equal(g.report.S, n); assert.equal(g.hp[s2], Math.max(0, hp0 - Math.min(2, n))); assert.equal(g.progress, 1);
  const tv = g.tv(); assert.equal(tv.report.S, n); assert(!JSON.stringify(tv.report).includes('"sab"'), 'per-station counts stay off the TV');
  assert(!JSON.stringify(tv).includes('"ids"') && !JSON.stringify(tv).includes('"mates"'), 'who worked where stays off the TV');
  const someone = g.living().find((c) => c.role !== 'engineer'); assert.equal(g.view(room.get(someone.id)).breakdown, undefined, 'only the Engineer gets the breakdown');
  assert(Array.isArray(g.view(room.get(someone.id)).mates), 'each player learns who shared their station');
  const eng = [...g.crew.values()].find((c) => c.role === 'engineer');
  if (eng) assert.deepEqual(g.view(room.get(eng.id)).breakdown, g.emergency.stations.map((_, i) => (i === 1 ? n : 0)), 'the Engineer sees each station’s count');
  void clock;
});

test('the Scanner reads aliens, but the Mimic reads as crew', () => {
  const { g, room } = setup({ bots: 7, seed: 5 });
  const sc = [...g.crew.values()].find((c) => c.role === 'scanner'), mimic = [...g.crew.values()].find((c) => c.role === 'mimic'), alien = [...g.crew.values()].find((c) => c.role === 'alien');
  assert(sc && mimic && alien);
  g.next(); g.next();
  for (const c of g.living()) g.picks.set(c.id, { station: 0, sab: false });
  g.scans.set(sc.id, alien.id); g.resolve();
  assert.equal(g.view(room.get(sc.id)).scan.alien, true);
  assert.equal(g.view(room.get(alien.id)).scan, undefined, 'only the Scanner sees the result');
  g.next(); g.next(); for (const c of g.living()) g.votes.set(c.id, 'skip'); g.tally(); g.next(); g.next();
  for (const c of g.living()) g.picks.set(c.id, { station: 0, sab: false });
  g.scans.set(sc.id, mimic.id); g.resolve();
  assert.equal(g.view(room.get(sc.id)).scan.alien, false, 'the Mimic fools the scanner');
  assert.equal(g.view(room.get(sc.id)).scanLog.length, 2);
});

test('a lone alien gets one abduction beam; the victim becomes a ghost and the beam is spent', () => {
  const { g, room } = setup({ bots: 4, seed: 51 });
  assert.equal(g.aliensTotal, 1); assert.equal(g.charges, 1); assert.equal(g.tv().beam, 1);
  const alien = g.aliensAlive()[0], crew = g.crewAlive(), ap = room.get(alien.id);
  g.next(); g.next();
  assert.equal(room.act(room.get(crew[0].id), { op: 'abduct', id: crew[1].id }).ok, false, 'crew have no beam');
  assert.equal(room.act(ap, { op: 'abduct', id: alien.id }).ok, false);
  assert.equal(room.act(ap, { op: 'abduct', id: 'p999' }).ok, false);
  assert(room.act(ap, { op: 'abduct', id: crew[0].id }).ok);
  for (const c of g.living()) g.picks.set(c.id, { station: 0, sab: false });
  g.resolve();
  assert.equal(g.report.abducted.id, crew[0].id); assert(!crew[0].alive); assert.equal(g.charges, 0);
  assert.equal(g.tv().crew.find((c) => c.id === crew[0].id).abducted, true);
  assert.equal(g.tv().report.abducted.name, room.get(crew[0].id).name);
  assert(alien.stats.abduct === 1);
  const big = setup({ bots: 7, seed: 52 }); assert.equal(big.g.charges, 0, 'packs of aliens have no beam');
});

test('voting: plurality ejects (role revealed), ties and skips eject nobody; ghosts patch and whisper', () => {
  const { g, room } = setup({ bots: 6, seed: 7 });
  g.next(); g.next(); for (const c of g.living()) g.picks.set(c.id, { station: 0, sab: false }); g.resolve(); g.next(); g.next();
  assert.equal(g.phase, 'vote');
  const live = g.living(), a = live[0], b = live[1];
  live.forEach((c, i) => g.votes.set(c.id, i === 0 ? b.id : i === 1 ? a.id : i === live.length - 1 && live.length % 2 ? 'skip' : i % 2 ? b.id : a.id));
  g.tally(); assert.equal(g.ejected.out, null, 'a tie ejects nobody'); assert.equal(g.ejected.why, 'tie');
  g.next(); g.next(); g.next(); for (const c of g.living()) g.picks.set(c.id, { station: 0, sab: false }); g.resolve(); g.next(); g.next();
  const target = g.crewAlive().find((c) => c.id !== room.list()[0].id) || g.crewAlive()[0];
  for (const c of g.living()) g.votes.set(c.id, c.id === target.id ? 'skip' : target.id);
  g.tally();
  assert.equal(g.ejected.out.id, target.id); assert.equal(g.ejected.out.alien, false); assert(!target.alive);
  assert.equal(g.tv().crew.find((c) => c.id === target.id).alien, false, 'the pod scanner announces the role');
  if (g.phase === 'over') return;
  g.next(); g.next(); assert.equal(g.phase, 'shift');
  const gp = room.get(target.id);
  assert.equal(room.act(gp, { op: 'shift', station: 0 }).ok, false, 'ghosts can’t hold a wrench');
  assert.equal(room.act(gp, { op: 'patch', sys: 'nope' }).ok, false);
  assert(room.act(gp, { op: 'patch', sys: 'shields' }).ok);
  assert(room.act(gp, { op: 'whisper', id: g.living()[0].id }).ok);
  assert.equal(room.act(gp, { op: 'whisper', id: target.id }).ok, false, 'whisper about the living');
  assert.equal(room.act(gp, { op: 'vote', id: 'skip' }).ok, false);
});

test('win conditions: home, every alien caught, aliens match the crew, a broken system, the fuel runs out', () => {
  let { g } = setup({ seed: 11 }); g.progress = g.home - 1; g.next(); g.next(); for (const c of g.living()) g.picks.set(c.id, { station: 0, sab: false }); g.resolve(); g.next();
  assert.equal(g.phase, 'over'); assert.equal(g.winner, 'crew'); assert.equal(g.reason, 'home');
  ({ g } = setup({ seed: 12 })); g.next(); g.next(); g.hp[g.emergency.sys] = 1;
  for (const c of g.living()) g.picks.set(c.id, { station: 0, sab: isAlien(c.role) }); g.resolve(); g.next();
  assert.equal(g.winner, 'aliens'); assert.equal(g.reason, 'broken');
  ({ g } = setup({ seed: 13 })); for (const c of g.aliensAlive()) c.alive = false; g.next(); g.next(); for (const c of g.living()) g.picks.set(c.id, { station: 0, sab: false }); g.resolve(); g.next();
  assert.equal(g.winner, 'crew');
  ({ g } = setup({ seed: 14 })); const crew = g.crewAlive(); for (const c of crew.slice(0, crew.length - g.aliensAlive().length)) c.alive = false;
  g.next(); g.next(); for (const c of g.living()) g.picks.set(c.id, { station: 0, sab: false }); g.resolve(); g.next();
  assert.equal(g.winner, 'aliens'); assert.equal(g.reason, 'outnumber');
  ({ g } = setup({ seed: 15 })); g.round = g.maxRounds; g.next();
  assert.equal(g.winner, 'aliens'); assert.equal(g.reason, 'fuel');
  const st = g.standings(); assert(st[0].won && st[0].pts >= 300, 'winners get the win bonus');
});

test('phone input is validated', () => {
  const { g, room, p } = setup({ bots: 5, seed: 21 });
  const bad = [{}, { op: 'nope' }, { op: 'shift', station: 0 }, { op: 'vote', id: 'skip' }, { op: 'say', kind: 'sus' }];
  for (const m of bad) assert.equal(room.act(p, m).ok, false, 'not now: ' + JSON.stringify(m));
  g.next(); g.next(); assert.equal(g.phase, 'shift');
  const me = g.crew.get(p.id);
  for (const m of [{ op: 'shift', station: 9 }, { op: 'shift', station: -1 }, { op: 'shift', station: 'x' }, { op: 'shift', station: 1.5 }, { op: 'patch', sys: 'oxygen' }, { op: 'whisper', id: 'skip' }]) assert.equal(room.act(p, m).ok, false, JSON.stringify(m));
  if (!isAlien(me.role)) assert.equal(room.act(p, { op: 'shift', station: 0, sab: true }).ok, false, 'crew can’t sabotage');
  if (me.role !== 'scanner') assert.equal(room.act(p, { op: 'scan', id: g.living()[1].id }).ok, false, 'only the scanner scans');
  assert(room.act(p, { op: 'shift', station: 1 }).ok);
  if (g.phase === 'shift') g.resolve();
  g.next(); assert.equal(g.phase, 'discuss');
  const other = g.living().find((c) => c.id !== p.id);
  for (const m of [{ op: 'say', kind: 'wat', id: other.id }, { op: 'say', kind: 'sus', id: p.id }, { op: 'say', kind: 'sus', id: 'p999' }, { op: 'say', kind: 'scan', id: other.id }, { op: 'say', kind: 'station', station: 7 }]) assert.equal(room.act(p, m).ok, false, JSON.stringify(m));
  assert(room.act(p, { op: 'say', kind: 'sus', id: other.id }).ok);
  assert.equal(room.act(p, { op: 'say', kind: 'clear', id: other.id }).ok, false, 'rate limited');
  assert.equal(g.tv().claims[0].target.id, other.id);
  g.next(); assert.equal(g.phase, 'vote');
  assert.equal(room.act(p, { op: 'vote', id: p.id }).ok, false, 'no self votes');
  assert.equal(room.act(p, { op: 'vote', id: 'p999' }).ok, false);
  assert(room.act(p, { op: 'vote', id: 'skip' }).ok);
  const late = room.join('Late').player; late.sockets = 1;
  assert.equal(room.act(late, { op: 'vote', id: 'skip' }).ok, false, 'stowaways watch');
  assert.equal(g.view(late).me, null);
});

test('a player leaving mid-game is handled and the game still ends', () => {
  const { g, room, clock } = setup({ bots: 5, seed: 31 });
  g.next(); g.next();
  room.remove(g.living()[2].id);
  run(room, clock);
  assert.equal(g.phase, 'over'); assert(g.results().length >= 5);
});

test('a full game with a silent human ends on the timers, in about ten minutes', () => {
  const { room, clock, g } = setup({ bots: 6, seed: 41 });
  const t0 = clock.now(); run(room, clock);
  const mins = (clock.now() - t0) / 60000;
  assert(mins < 16, `took ${mins.toFixed(1)} min`); assert.equal(g.phase, 'over');
});

console.log(`\n${passed} Alien Abduction tests passed.`);
