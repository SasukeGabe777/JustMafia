'use strict';
// JustGameBox: President, Blackjack Night and JustRaiseDucks rules, played to the end by
// bots on a virtual clock (3, 20 and 100 players), plus the rules that matter most.
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const { GAMES } = require('../box');
const C = require('../box/cards');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function room(key, bots, settings = {}, seed = 7) {
  const clock = new VirtualClock(), r = new BoxRoom('TEST', GAMES[key], { clock, seed });
  r.addBots(bots); Object.assign(r.settings, settings);
  return { r, clock };
}
function runOut(r, clock, limit = 400000) { let i = 0; while (r.game.phase !== 'over' && clock.step()) if (++i > limit) throw new Error('game never ended (' + r.game.phase + ')'); return i; }
const human = (r, name) => r.join(name).player;
// Start a game; in JustRaiseDucks every duck hatches from a Sturdy egg (stamina) so tests of other skills stay exact.
const go = (r) => { const res = r.start(); assert(res.ok, res.error); if (r.game.ducks) for (const [id, d] of r.game.ducks) if (!d.gene) { d.eggs = ['stamina', 'stamina', 'stamina']; r.game.hatch(id, d, 0, true); } return true; };

test('Cards: a 52-card deck, unique ids across several decks', () => {
  assert.equal(C.deck().length, 52); const d = C.deck(3); assert.equal(new Set(d).size, 156);
  assert.equal(C.rankOf('10H~2'), '10'); assert.equal(C.suitOf('10H~2'), 'H'); assert.equal(C.base('QS~1'), 'QS');
});

// ---------- President ----------
const P = GAMES.president._test;
test('President: 3 is lowest and 2 is highest; titles by finishing order', () => {
  assert(P.power('3C') < P.power('KD') && P.power('KD') < P.power('AS') && P.power('AS') < P.power('2H'));
  assert.deepEqual(P.titlesFor(3), ['president', 'citizen', 'scum']);
  assert.deepEqual(P.titlesFor(5), ['president', 'vp', 'citizen', 'vscum', 'scum']);
});
test('President: plays must match the count and beat the rank; the leader can’t pass', () => {
  const { r } = room('president', 0, {}, 3);
  const a = human(r, 'Ann'), b = human(r, 'Bo'), c = human(r, 'Cy');
  go(r);
  const t = r.game.tables[0];
  t.hands = { [a.id]: ['5H', '5S', '9C', 'KD'], [b.id]: ['4C', '6D', '6H', '2S'], [c.id]: ['7C', '7D', 'QS', 'AH'] };
  r.game.setTurn(t, a.id);
  assert.equal(r.act(a, { op: 'pass' }).ok, false, 'leader must play');
  assert.equal(r.act(a, { op: 'play', cards: ['5H', '9C'] }).ok, false, 'same rank only');
  assert(r.act(a, { op: 'play', cards: ['5H', '5S'] }).ok);
  assert.equal(r.act(b, { op: 'play', cards: ['4C'] }).ok, false, 'must be a pair');
  assert.equal(r.act(c, { op: 'play', cards: ['7C', '7D'] }).ok, false, 'not your turn');
  assert(r.act(b, { op: 'play', cards: ['6D', '6H'] }).ok);
  assert(r.act(c, { op: 'pass' }).ok);
  assert(r.act(a, { op: 'pass' }).ok);
  assert.equal(t.turn, b.id, 'everyone passed: the last player to play leads a fresh trick');
  assert.equal(t.top, null);
});
test('President: going out gives titles and points; trading moves the Scum’s best cards to the President', () => {
  const { r, clock } = room('president', 4, { rounds: 2, trading: true }, 11);
  go(r);
  while (r.game.round === 1 && clock.step());
  const g = r.game;
  assert.equal(g.round, 2);
  const t = g.tables[0];
  assert.equal(t.trades.length, 2, '4 players: President↔Scum (2) and VP↔Vice Scum (1)');
  assert.equal(t.trades[0].n, 2);
  const counts = t.seats.map((id) => t.hands[id].length).reduce((a, b) => a + b, 0);
  assert.equal(counts, 52, 'trading keeps every card');
  runOut(r, clock);
  assert.equal(g.phase, 'over');
  const st = g.standings(); assert(st[0].points >= st[st.length - 1].points);
});
test('President: 100 players play at 17 tables with Presidents moving up; every game ends', () => {
  const { r, clock } = room('president', 100, { tableSize: 6, rounds: 3 }, 5);
  go(r);
  assert.equal(r.game.tables.length, 17);
  assert(r.game.tables.every((t) => t.seats.length >= 5 && t.seats.length <= 6));
  for (const t of r.game.tables) assert.equal(t.seats.reduce((a, id) => a + t.hands[id].length, 0), 52);
  while (r.game.round === 1 && clock.step());
  const prev = r.game.titles;
  runOut(r, clock);
  assert.equal(r.game.phase, 'over');
  assert(prev.size === 100);
  const tv = JSON.stringify(r.tvState());
  assert(!/"hand"/.test(tv), 'the TV never sees a hand');
});
test('President: a player who leaves mid-trick doesn’t stall the table', () => {
  const { r, clock } = room('president', 4, { rounds: 1 }, 9);
  go(r);
  clock.step();
  const t = r.game.tables[0];
  r.remove(t.turn || t.seats[0]);
  runOut(r, clock);
  assert.equal(r.game.phase, 'over');
});

// ---------- Blackjack ----------
const B = GAMES.blackjack._test;
test('Blackjack: totals count Aces as 1 or 11; naturals are 2-card 21s', () => {
  assert.equal(B.total(['AS', 'KD']).t, 21); assert(B.isBJ(['AS', 'KD']));
  assert.equal(B.total(['AS', 'AD', '9C']).t, 21); assert(!B.isBJ(['AS', 'AD', '9C']));
  assert.equal(B.total(['KS', 'QD', '5C']).t, 25);
  assert(!B.isBJ(['AS', 'KD'], true), 'a split 21 is not a blackjack');
});
test('Blackjack: bets, hits, doubles and payouts; chips are never created from nothing', () => {
  const { r, clock } = room('blackjack', 0, { hands: 1, startChips: 1000, bustBets: false }, 21);
  const a = human(r, 'Ann'); go(r);
  assert.equal(r.act(a, { op: 'bet', amount: 5 }).ok, false, 'minimum 10');
  assert.equal(r.act(a, { op: 'bet', amount: 5000 }).ok, false, 'not more than you have');
  assert(r.act(a, { op: 'bet', amount: 100 }).ok);
  while (r.game.phase === 'betting') clock.step();
  const s = r.game.seats.get(a.id);
  if (r.game.phase === 'playing') { assert.equal(s.chips, 900, 'the bet is on the table'); r.act(a, { op: 'stand' }); }
  runOut(r, clock);
  const h = s.hands[0], want = { win: 1100, blackjack: 1150, push: 1000, lose: 900, bust: 900 }[h.result];
  assert.equal(s.chips, want, `${h.result}: ${s.chips}`);
});
test('Blackjack: Bust Bets pay when the target busts', () => {
  const { r, clock } = room('blackjack', 0, { hands: 1, bustBets: true }, 4);
  const a = human(r, 'Ann'), b = human(r, 'Bo'); go(r);
  r.act(a, { op: 'bet', amount: 10 }); r.act(b, { op: 'bet', amount: 10 });
  assert.equal(r.act(a, { op: 'bust', on: a.id }).ok, false, 'not on yourself');
  assert(r.act(a, { op: 'bust', on: b.id }).ok);
  while (r.game.phase === 'betting') clock.step();
  if (r.game.phase === 'playing') {
    const bh = r.game.seats.get(b.id).hands[0];
    bh.cards = ['KS', 'QS']; // force Bo to bust on a hit
    r.act(b, { op: 'hit' });
    r.act(a, { op: 'stand' });
    runOut(r, clock);
    assert.equal(r.game.seats.get(a.id).bustWon, true);
  }
});
test('Blackjack: 100 players play every hand at once and the game ends; the TV hides the hole card', () => {
  const { r, clock } = room('blackjack', 100, { hands: 5 }, 8);
  go(r);
  let sawHidden = false;
  for (let i = 0; i < 20000 && r.game.phase !== 'over'; i++) {
    clock.step();
    if (r.game.phase === 'playing') { const d = r.tvState().state.dealer; assert.equal(d.cards[1], '??'); assert(d.hidden && d.cards.length === 2 && d.total === B.total([r.game.dealer.cards[0]]).t, 'only the up-card is shown'); sawHidden = true; }
  }
  assert.equal(r.game.phase, 'over'); assert(sawHidden);
  assert.equal(r.game.standings().length, 100);
});

// ---------- JustRaiseDucks ----------
const D = GAMES.ducks._test;
test('Ducks: levels grow with XP; scores are capped by how long you actually played', () => {
  assert.equal(D.level(0), 0); assert.equal(D.level(20), 1); assert.equal(D.level(300), 5); assert.equal(D.level(10 ** 9), 25);
  const { r, clock } = room('ducks', 0, { energy: 'normal' }, 2);
  const a = human(r, 'Ann'); go(r);
  const t = r.act(a, { op: 'train', stat: 'swim' }); assert(t.ok && t.game === 'paddle');
  assert.equal(r.act(a, { op: 'train', stat: 'run' }).ok, false, 'one at a time');
  clock.t += 5000;
  const sc = r.act(a, { op: 'score', score: 999 });
  assert.equal(sc.score, Math.floor(5 * D.SCORE_RATE) + 1, 'a 5-second run can’t score 999');
  assert.equal(r.game.ducks.get(a.id).energy, 100 - D.TRAIN_COST);
});
test('Ducks: food, naps and hats cost coins; you can’t train during a race', () => {
  const { r, clock } = room('ducks', 0, { startCoins: 60, raceEvery: 60 }, 2);
  const a = human(r, 'Ann'); go(r);
  const d = r.game.ducks.get(a.id); d.energy = 10; d.coins = 50;
  assert(r.act(a, { op: 'feed', item: 'corn' }).ok); assert.equal(d.coins, 38); assert.equal(d.energy, 55);
  assert(r.act(a, { op: 'hat', hat: 'crown' }).ok); assert.equal(d.hat, 'crown'); assert.equal(d.coins, 23);
  assert(r.act(a, { op: 'style', name: 'Sir Quacks', color: 'mallard' }).ok); assert.equal(d.name, 'Sir Quacks');
  assert(r.act(a, { op: 'nap' }).ok); assert.equal(r.act(a, { op: 'train', stat: 'run' }).ok, false, 'napping');
  while (r.game.phase === 'training') clock.step();
  assert.equal(r.game.phase, 'race');
  assert.equal(r.act(a, { op: 'train', stat: 'run' }).ok, false);
});
test('Ducks: a trained duck beats an untrained one on its terrain; races give points and coins', () => {
  const { r, clock } = room('ducks', 0, { terrain: 'pond', races: 1, raceEvery: 60, weather: false }, 6);
  const a = human(r, 'Ann'), b = human(r, 'Bo'); go(r);
  r.game.ducks.get(a.id).xp.swim = D.xpFor(10);
  runOut(r, clock);
  const res = r.game.lastRace.results;
  assert.equal(res[0].id, a.id); assert.equal(res[0].pts, 20, "a one-race season is the Grand Duckstakes: double points"); assert(r.game.ducks.get(a.id).coins > 50);
  const tr = r.game.lastRace.tracks.find((x) => x.id === a.id);
  assert.equal(tr.s[tr.s.length - 1], r.game.lastRace.length * 10, 'the TV gets each duck’s path to the finish line');
});
test('Ducks: 100 ducks (bots train between races) finish a 3-race season', () => {
  const { r, clock } = room('ducks', 100, { races: 3, raceEvery: 120 }, 12);
  go(r); runOut(r, clock);
  assert.equal(r.game.phase, 'over'); assert.equal(r.game.lastRace.results.length, 100);
  const trained = [...r.game.ducks.values()].filter((d) => Object.values(d.xp).some((x) => x > 0)).length;
  assert(trained > 90, 'bots trained: ' + trained);
});

test('Ducks: buildings speed up training; a happy duck learns faster than a grumpy one', () => {
  const { r, clock } = room('ducks', 0, { startCoins: 120 }, 4);
  const a = human(r, 'Ann'), b = human(r, 'Bo'); go(r);
  const da = r.game.ducks.get(a.id), db = r.game.ducks.get(b.id);
  da.quests = []; db.quests = []; // no quest bonuses in this count
  assert(r.act(a, { op: 'build', item: 'track' }).ok); assert.equal(da.buildings.track, 1); assert.equal(da.coins, 80);
  da.mood = 50; db.mood = 50;
  const run = (p) => { r.act(p, { op: 'train', stat: 'run' }); clock.t += 20000; return r.act(p, { op: 'score', score: 20 }).xp; };
  assert.equal(run(b), 80); assert.equal(run(a), 96, 'Running Track level 1: +20%');
  db.mood = 90; assert.equal(run(b), 92, 'happy: +15%'); db.mood = 10; assert.equal(run(b), 64, 'grumpy: −20%');
  assert(r.act(a, { op: 'pet' }).ok); assert.equal(r.act(a, { op: 'pet' }).ok, false, 'petting has a short cooldown');
});
test('Ducks: Track Sneakers prevent trips; gear is used up by the race; predictions pay', () => {
  const { r, clock } = room('ducks', 0, { terrain: 'track', races: 2, raceEvery: 60, startCoins: 120, weather: false }, 9);
  const a = human(r, 'Ann'), b = human(r, 'Bo'); go(r);
  assert(r.act(a, { op: 'gear', item: 'sneakers' }).ok);
  assert(r.act(b, { op: 'predict', id: a.id }).ok);
  r.game.ducks.get(a.id).xp.run = 1e5; // a sure winner
  while (r.game.phase === 'training') clock.step();
  const tr = r.game.lastRace.tracks.find((x) => x.id === a.id);
  assert(!tr.ev.some(([, k]) => k === 'trip'), 'no trips in sneakers');
  assert.deepEqual(r.game.ducks.get(a.id).gear, [], 'gear is used up');
  assert.equal(r.game.ducks.get(b.id).predictWon, 30, 'called the winner');
  assert(r.game.ducks.get(b.id).badges.includes('oracle'));
  assert(r.game.ducks.get(a.id).badges.includes('firstWin'));
});
test('Ducks: farm events (a fox!) resolve by choice or by timeout; badges pay coins', () => {
  const { r, clock } = room('ducks', 0, { events: true }, 5);
  const a = human(r, 'Ann'); go(r);
  const d = r.game.ducks.get(a.id);
  d.event = { kind: 'fox', text: '', choices: [['scare', '']], until: clock.t + 10000 };
  const m = d.mood; assert(r.act(a, { op: 'event', choice: 'scare' }).ok); assert.equal(d.mood, m + 10);
  d.event = { kind: 'fox', text: '', choices: [['scare', '']], until: clock.t + 100 }; const c = d.coins;
  clock.t += 3000; clock.step(); while (d.event && clock.step());
  assert(d.coins < c, 'ignored fox steals coins');
  d.xp.swim = 300; r.game.checkBadges(a.id, d); assert(d.badges.includes('level5'));
});
test('Ducks: quests pay coins when done; rivals are the duck just ahead; boost pads show in races', () => {
  const { r, clock } = room('ducks', 0, { races: 2, raceEvery: 60 }, 8);
  const a = human(r, 'Ann'), b = human(r, 'Bo'); go(r);
  const da = r.game.ducks.get(a.id);
  assert.equal(da.quests.length, 3);
  da.quests = [{ kind: 'pet', n: 1, have: 0, done: false, reward: 8, text: 'Pet' }];
  const c = da.coins; assert(r.act(a, { op: 'pet' }).ok); assert(da.quests[0].done); assert.equal(da.coins, c + 8);
  while (r.game.phase === 'training') clock.step();
  const res = r.game.lastRace.results.filter((x) => !x.wild), first = res[0].id, second = res[1].id;
  assert.equal(r.game.ducks.get(second).rival, first, 'the duck just ahead is your rival');
  assert(Array.isArray(r.game.lastRace.boosts) && r.game.lastRace.boosts.length > 0);
});
test('Ducks: eggs hatch with a talent; ducks grow up; wild ducks fill small races; themed courses; trophies', () => {
  const { r, clock } = room('ducks', 0, { races: 3, raceEvery: 60 }, 3);
  const a = human(r, 'Ann'); const res = r.start(); assert(res.ok);
  const d = r.game.ducks.get(a.id);
  assert.equal(r.act(a, { op: 'train', stat: 'run' }).ok, false, 'hatch first');
  const pick = d.eggs[1]; assert(r.act(a, { op: 'hatch', pick: 1 }).ok); assert.equal(d.gene, pick); assert(d.xp[pick] >= 40);
  r.act(a, { op: 'train', stat: pick }); clock.t += 20000; const g = r.act(a, { op: 'score', score: 20 }).xp;
  r.act(a, { op: 'train', stat: pick === 'run' ? 'swim' : 'run' }); clock.t += 20000; const o = r.act(a, { op: 'score', score: 20 }).xp;
  assert(g > o, 'the egg talent trains 25% faster');
  for (const k of D.SKILLS) d.xp[k] = D.xpFor(6); r.game.checkGrowth(a.id, d); assert.equal(d.stage, 2, 'total level 30: grown duck');
  assert(r.game.course.theme in D.THEMES && r.game.course.sections.every((x) => x.v));
  while (r.game.phase === 'training') clock.step();
  assert.equal(r.game.lastRace.results.length, 6, 'wild ducks fill the field to 6');
  assert(r.game.lastRace.results.some((x) => x.wild));
  const mine = r.game.lastRace.results.find((x) => x.id === a.id);
  if (mine.place <= 3) assert.equal(d.trophies.length, 1);
});
test('Room: names are unique, tokens reconnect, 100-player cap, settings only take listed values', () => {
  const { r } = room('ducks', 0);
  const a = r.join('Ann'); assert(a.ok); assert.equal(r.join('ann').ok, false);
  assert.equal(r.join('', null).ok, false);
  assert.equal(r.join('x', a.player.token).player.id, a.player.id);
  r.addBots(150); assert.equal(r.players.size, 100);
  r.hostAction({ type: 'settings', settings: { raceEvery: 7, races: 5 } }); assert.equal(r.settings.raceEvery, 120); assert.equal(r.settings.races, 5);
  r.hostAction({ type: 'settings', settings: { raceEvery: '60' } }); assert.equal(r.settings.raceEvery, 60);
});

console.log(`\nAll ${passed} JustGameBox tests passed.`);
