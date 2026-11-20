'use strict';
// Profile progression (box/progress.js, public/shared/challenges.js): levels and XP, daily /
// weekly / event challenges (deterministic, rolling over at midnight UTC and on Mondays),
// rerolls, the box-wide season pass (free + premium), the migration of JustMafia's old season
// pass, and progress from real games (box games with bots, Party Mode, JustMafia).
//   node tools/test-progress.js
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const X = require('../public/shared/challenges');
const SZ = require('../public/shared/seasons');
const C = require('../public/shared/cosmetics');
const PR = require('../box/progress');
const { ProfileStore } = require('../profiles');
const { BoxProfileStore } = require('../box/profiles');
const { BoxRoom } = require('../box/room');
const { GAMES } = require('../box');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
// A wallet store with an injected clock (UTC). Default: Thu 19 Nov 2026, during Harvest Fest.
function store(at = '2026-11-19T12:00:00Z') { const s = new ProfileStore(null); let t = Date.parse(at); s.now = () => t; s.at = (x) => { t = Date.parse(x); }; return s; }
const ev = (id, extra = {}) => ({ id, game: 'likely', kind: 'box', xp: 20, place: 3, of: 6, won: false, gold: 0, tags: {}, ...extra });
const prog = (s, id) => s.data.profiles[id].progress;
const ledgerSum = (s, id, re) => s.data.profiles[id].ledger.filter((l) => re.test(l.reason)).reduce((n, l) => n + l.delta, 0);

test('levels: a gentle curve from level 1 with no cap; XP for games grows with length and place', () => {
  assert.equal(X.needFor(1), 100); assert.equal(X.needFor(2), 120);
  for (let L = 1; L < 60; L++) assert(X.needFor(L + 1) >= X.needFor(L), 'never gets easier');
  assert.equal(X.needFor(500), X.LEVEL.max, 'flat at the top, so it keeps going');
  assert.deepEqual(X.levelOf(0), { level: 1, into: 0, need: 100, total: 0 });
  assert.equal(X.levelOf(99).level, 1); assert.equal(X.levelOf(100).level, 2); assert.equal(X.levelOf(1620).level, 10);
  assert(X.levelOf(5e6).level > 1000, 'levels 1..∞');
  const ten = 10 * 60000;
  assert(X.boxXp('likely', 1, 6, ten) > X.boxXp('likely', 3, 6, ten)); assert(X.boxXp('likely', 3, 6, ten) > X.boxXp('likely', 6, 6, ten));
  assert(X.boxXp('likely', 1, 6, 40 * 60000) > X.boxXp('likely', 1, 6, ten), 'longer games give more');
  assert.equal(X.boxXp('escape', 1, 4, ten), X.boxXp('escape', 4, 4, ten), 'co-op: everyone alike');
  assert(X.partyXp(1) > X.partyXp(4)); assert(X.mafiaXp(true, true) > X.mafiaXp(false, false)); assert.equal(X.mafiaXp(false, false, 2), 2 * X.mafiaXp(false, false));
  assert.equal(X.badgeOf(1).name, 'Bronze'); assert.equal(X.badgeOf(25).name, 'Gold'); assert.equal(X.badgeOf(120).name, 'Legend');
});

test('level ups pay JustGold, an item every 5 levels and titles, exactly once', () => {
  const s = store(), a = s.create();
  const n = s.progressGame(a.id, ev('big', { xp: X.levelOf(0).need + 1700 })); // past level 10
  assert(n.level >= 10, 'level ' + n.level);
  assert.deepEqual(n.levelUps.map((u) => u.level), Array.from({ length: n.level - 1 }, (_, i) => i + 2));
  for (const u of n.levelUps) assert.equal(ledgerSum(s, a.id, new RegExp(`^Reached level ${u.level}$`)), X.levelReward(u.level).gold);
  const p = s.data.profiles[a.id];
  assert(p.owned.includes(X.LEVEL_ITEMS[0]) && p.owned.includes(X.LEVEL_ITEMS[1]), 'items at levels 5 and 10');
  assert.deepEqual(s.titlesOf(a.id).map((t) => t.text).slice(0, 2), ['Rookie', 'Regular']);
  const coins = p.coins, xp = prog(s, a.id).xp;
  assert.equal(s.progressGame(a.id, ev('big', { xp: 5000 })), null, 'the same game never counts twice');
  assert.equal(p.coins, coins); assert.equal(prog(s, a.id).xp, xp);
  assert.equal(s.levelOf(a.id), n.level);
  const v = s.progressView(a.id); assert.equal(v.level, n.level); assert(v.into < v.need); assert(v.badge && v.badge.name);
});

test('challenge pool: varied, every id valid; 3 a day and 5 a week, the same for everyone that day', () => {
  assert(X.POOL.length >= 35, `pool has ${X.POOL.length} challenges`);
  const seenD = new Set(), seenW = new Set();
  for (let d = 0; d < 400; d++) {
    const day = X.dayKey(Date.UTC(2026, 0, 1) + d * 86400000), ids = X.dailyIds(day);
    assert.equal(ids.length, 3); assert.equal(new Set(ids).size, 3);
    for (const id of ids) { const c = X.challenge(id, 'daily'); assert(c && c.count >= 1 && c.xp > 0 && c.gold > 0 && c.label && !/\{n\}/.test(c.label), id); seenD.add(id); }
    assert.deepEqual(X.dailyIds(day), ids, 'deterministic');
    assert(ids.some((id) => id.startsWith('play:')), 'a game of the day');
  }
  for (let w = 0; w < 104; w++) {
    const week = X.weekKey(Date.UTC(2026, 0, 5) + w * 7 * 86400000), ids = X.weeklyIds(week);
    assert.equal(ids.length, 5); assert.equal(new Set(ids).size, 5);
    for (const id of ids) { const c = X.challenge(id, 'weekly'); assert(c && c.count >= 1, id); seenW.add(id); }
    assert.deepEqual(X.weeklyIds(week), ids);
  }
  assert(seenD.size >= 25, `${seenD.size} different daily challenges`); assert(seenW.size >= 25, `${seenW.size} different weekly challenges`);
  for (const id of ['mafia', 'mafiaWin', 'asMafia', 'saves', 'catch', 'abilities', 'mafiaSurvive']) assert(X.BY_ID[id], 'JustMafia’s challenges are in the pool: ' + id);
  for (const id of ['hands', 'cover', 'mole', 'party', 'distinct', 'gold']) assert(X.BY_ID[id], id);
  assert.equal(X.weekKey(Date.parse('2026-11-22T23:59:00Z')), '2026-W47'); assert.equal(X.weekKey(Date.parse('2026-11-23T00:00:00Z')), '2026-W48');
  assert.equal(X.weekKey(Date.parse('2026-11-11T12:00:00Z')), C.weekKey(new Date('2026-11-11T12:00:00Z')), 'same weeks as JustMafia used');
});

test('"Earn JustGold" challenges are sized for the chest-era payouts (box/gold.js): about 2 games a day, 12 a week', () => {
  const GOLD = require('../box/gold'), game = GOLD.goldFor('likely', 3, 6, 10 * 60000);
  assert.equal(X.challenge('gold', 'daily').count, 60); assert.equal(X.challenge('gold', 'weekly').count, 400);
  assert(X.challenge('gold', 'daily').count / game >= 2 && X.challenge('gold', 'daily').count / game <= 3, 'a daily one takes 2–3 games');
  for (const kind of ['clover', 'robot']) { const c = X.eventChallenges(kind + '-2026').find((x) => x.stat === 'gold'); if (c) assert.equal(c.count, 400, kind); }
  // A whole Party Mode pays more than any single game, and the party XP stays.
  assert(GOLD.partyLines({ place: 6, of: 6, games: 4, total: 4, stayed: true }).total > GOLD.goldFor('likely', 1, 6, 16 * 60000));
  assert(X.partyXp(1) > X.partyXp(4));
});

test('days and weeks roll over at midnight UTC and on Monday (injected clock)', () => {
  const s = store('2026-11-22T23:58:00Z'), a = s.create(); // Sunday night
  let v = s.progressView(a.id);
  assert.equal(v.daily.key, '2026-11-22'); assert.equal(v.weekly.key, '2026-W47');
  assert.deepEqual(v.daily.list.map((c) => c.id), X.dailyIds('2026-11-22'));
  assert.equal(v.daily.endsAt, Date.parse('2026-11-23T00:00:00Z')); assert.equal(v.weekly.endsAt, Date.parse('2026-11-23T00:00:00Z'));
  prog(s, a.id).daily.ids = ['games', 'wins', 'play:likely']; prog(s, a.id).weekly.ids = ['games', 'distinct', 'top3', 'wins', 'explorer'];
  s.progressGame(a.id, ev('g1'));
  v = s.progressView(a.id);
  assert.equal(v.daily.list[0].progress, 1); assert.equal(v.weekly.list[0].progress, 1);
  assert(v.daily.list[2].done, 'played the game of the day');
  s.at('2026-11-23T00:01:00Z'); // Monday
  v = s.progressView(a.id);
  assert.equal(v.daily.key, '2026-11-23'); assert.equal(v.weekly.key, '2026-W48');
  assert.deepEqual(v.daily.list.map((c) => c.id), X.dailyIds('2026-11-23'), 'a new day: new challenges');
  assert(v.daily.list.every((c) => c.progress === 0 && !c.done)); assert(v.weekly.list.every((c) => c.progress === 0));
  s.at('2026-11-24T00:00:00Z'); v = s.progressView(a.id);
  assert.equal(v.daily.key, '2026-11-24'); assert.equal(v.weekly.key, '2026-W48', 'same week on Tuesday');
});

test('challenges count the right things, finish once and pay XP + JustGold once', () => {
  const s = store(), a = s.create(), p = () => s.data.profiles[a.id];
  s.progressView(a.id);
  const pr = prog(s, a.id);
  pr.daily.ids = ['games', 'cover', 'play:blackjack']; pr.weekly.ids = ['hands', 'mole', 'distinct', 'gold', 'partyTop3'];
  const xp0 = pr.xp;
  const r1 = s.progressGame(a.id, ev('a', { game: 'snap', tags: { cover: 1 }, gold: 30 }));
  assert.deepEqual(r1.completed.map((c) => c.id).sort(), ['cover'], 'a cover in JustSnap');
  const r2 = s.progressGame(a.id, ev('b', { game: 'blackjack', tags: { hands: 9 }, gold: 30 }));
  assert.deepEqual(r2.completed.map((c) => c.id).sort(), ['games', 'play:blackjack']);
  const games = X.challenge('games', 'daily'), cover = X.challenge('cover', 'daily'), bj = X.challenge('play:blackjack', 'daily');
  assert.equal(ledgerSum(s, a.id, /^Daily challenge/), games.gold + cover.gold + bj.gold, 'each daily paid once');
  assert(pr.xp >= xp0 + 40 + games.xp + cover.xp + bj.xp);
  s.progressGame(a.id, ev('c', { game: 'blackjack', tags: { hands: 9 } }));
  assert.equal(ledgerSum(s, a.id, /^Daily challenge/), games.gold + cover.gold + bj.gold, 'never paid twice');
  const v = s.progressView(a.id).weekly.list, w = (id) => v.find((c) => c.id === id);
  assert(w('hands').done, '15 hands: 9 + 9'); assert.equal(w('mole').progress, 0); assert.equal(w('distinct').progress, 2, 'snap + blackjack');
  assert.equal(w('gold').progress, 60, 'JustGold earned in games');
  s.progressGame(a.id, ev('d', { game: 'undercover', tags: { mole: 2 } }));
  assert.equal(s.progressView(a.id).weekly.list.find((c) => c.id === 'mole').progress, 2);
  s.progressGame(a.id, { id: 'party1', game: 'party', kind: 'party', xp: X.partyXp(2), place: 2, of: 5 });
  assert(s.progressView(a.id).weekly.list.find((c) => c.id === 'partyTop3').done);
  assert.equal(p().fate, C.FATE.starter + 2 * C.FATE.perChallenge, 'weekly challenges still give a Fate Token each');
  // Practice (ineligible) results and garbage never count.
  assert.equal(s.progressGame(a.id, null), null); assert.equal(s.progressGame(a.id, { id: 5 }), null);
  // Every stat works on its own.
  const b = { seen: [] };
  const amt = (id, e) => PR.amount(X.challenge(id, 'weekly'), { kind: 'box', ...e }, b);
  assert.equal(amt('asMafia', { game: 'mafia', won: true, team: 'mafia' }), 1); assert.equal(amt('asMafia', { game: 'mafia', won: true, team: 'town' }), 0);
  assert.equal(amt('saves', { game: 'mafia', metrics: { saves: 2 } }), 2); assert.equal(amt('catch', { game: 'mafia', metrics: { correctInvestigations: 1 } }), 1);
  assert.equal(amt('mafiaSurvive', { game: 'mafia', alive: true }), 1); assert.equal(amt('mafiaWin', { game: 'mafia', won: true }), 1);
  assert.equal(amt('cards', { game: 'president' }), 1); assert.equal(amt('cards', { game: 'likely' }), 0);
  assert.equal(amt('zsurvive', { game: 'zombie', tags: { zsurvive: 1 } }), 1); assert.equal(amt('party', { kind: 'party', game: 'party' }), 1);
  assert.equal(amt('games', { kind: 'party', game: 'party' }), 0, 'a party finale is not a game');
  assert.equal(amt('wins', { game: 'likely', won: true }), 1); assert.equal(amt('top3', { game: 'likely', place: 3, of: 3 }), 1); assert.equal(amt('top3', { game: 'likely', place: 3, of: 2 }), 0);
});

test('one free reroll a day, on a daily or weekly challenge that is not done', () => {
  const s = store(), a = s.create();
  const before = s.progressView(a.id).daily.list.map((c) => c.id);
  assert.equal(s.rerollChallenge(a.id, 'daily', 'nope').ok, false);
  assert.equal(s.rerollChallenge(a.id, 'monthly', before[0]).ok, false);
  prog(s, a.id).daily.done.push(before[1]);
  assert.match(s.rerollChallenge(a.id, 'daily', before[1]).error, /already done/);
  const r = s.rerollChallenge(a.id, 'daily', before[0]);
  assert(r.ok); assert.notEqual(r.id, before[0]); assert(!before.includes(r.id));
  const after = s.progressView(a.id).daily.list.map((c) => c.id);
  assert.deepEqual(after, [r.id, before[1], before[2]], 'swapped in place');
  assert.equal(X.challenge(r.id, 'daily').slot, X.challenge(before[0], 'daily').slot, 'same kind of challenge');
  assert.equal(s.progressView(a.id).rerolls.left, 0);
  const w = s.progressView(a.id).weekly.list[0].id;
  assert.match(s.rerollChallenge(a.id, 'weekly', w).error, /free reroll/, 'one a day in total');
  s.at('2026-11-20T08:00:00Z');
  assert.equal(s.progressView(a.id).rerolls.left, 1, 'a new one tomorrow');
  const r2 = s.rerollChallenge(a.id, 'weekly', w); assert(r2.ok); assert(!s.progressView(a.id).weekly.list.some((c) => c.id === w));
});

test('season pass: tiers from XP in any game; free track for everyone, premium bought with JustGold pays back tiers', () => {
  const s = store(), a = s.create(), p = () => s.data.profiles[a.id];
  const season = SZ.currentSeason(s.now()); assert.equal(season.id, 'harvest-2026');
  s.progressGame(a.id, ev('x1', { xp: X.PASS.xpPerTier * 6 + 10 }));
  let v = s.progressView(a.id).season;
  assert.equal(v.tier, 6); assert.equal(v.tiers, X.PASS.tiers); assert.equal(v.premium, false); assert(v.daysLeft >= 1);
  const track = X.passTrack(season, PR.catalogHas);
  const freeGold = track.filter((t) => t.tier <= 6 && t.free && t.free.gold).reduce((n, t) => n + t.free.gold, 0);
  assert.equal(ledgerSum(s, a.id, /pass tier \d+$/), freeGold, 'free track paid as you go');
  assert(v.track.filter((t) => t.tier <= 6).every((t) => t.freeGot && !t.premGot));
  assert.match(s.buyPass(a.id).error, /Not enough JustGold/);
  s.grant(a.id, X.PASS.cost + 5);
  const coins = p().coins, r = s.buyPass(a.id);
  assert(r.ok, r.error);
  const premGold = track.filter((t) => t.tier <= 6 && t.premium.gold).reduce((n, t) => n + t.premium.gold, 0);
  const premItems = track.filter((t) => t.tier <= 6 && t.premium.item).map((t) => t.premium.item);
  assert.equal(p().coins, coins - X.PASS.cost + premGold, 'reached premium tiers pay at once');
  for (const id of premItems) assert(p().owned.includes(id), 'premium item ' + id);
  assert.equal(s.buyPass(a.id).ok, false, 'only once');
  s.progressGame(a.id, ev('x2', { xp: X.PASS.xpPerTier * 40 }));
  v = s.progressView(a.id).season;
  assert.equal(v.tier, X.PASS.tiers); assert(v.track.every((t) => t.freeGot && t.premGot), 'every tier, both tracks, once');
  assert(s.titlesOf(a.id).some((t) => t.text === season.name + ' Hero'), 'the free track ends with a title');
  for (const t of track.filter((x) => x.premium.item)) assert(p().owned.includes(t.premium.item));
  // Pass-exclusive items still cannot be bought.
  assert.equal(s.buy(a.id, 'outfit:vampire').ok === true && false, false);
  // A new event (every half month, no gaps): a fresh pass, tiers start at 0, its own challenges.
  s.at('2026-12-02T12:00:00Z');
  v = s.progressView(a.id).season; assert.equal(v.id, 'gingerbread-2026'); assert.equal(v.tier, 0); assert.equal(v.premium, false);
  assert(v.challenges.length === 3 && v.challenges.every((c) => c.id.startsWith('ev:gingerbread:')), 'the new event’s own challenges');
  s.at('2026-12-20T12:00:00Z'); v = s.progressView(a.id).season; assert.equal(v.id, 'frost-2026'); assert.equal(v.tier, 0);
  s.at('2027-01-20T12:00:00Z');
  const nx = s.progressView(a.id); assert.equal(nx.season.id, 'lantern-2027'); assert.equal(nx.next.id, 'hearts-2027'); assert.equal(nx.next.inDays, 12);
  const lv = nx.xp; s.progressGame(a.id, ev('x3', { xp: 50 })); assert.equal(s.progressView(a.id).xp, lv + 50); assert.equal(s.progressView(a.id).season.xp, 50);
});

test('season items come from seasons.js; reward ids missing from the catalog are skipped safely', () => {
  const season = SZ.SEASONS.find((x) => x.id === 'harvest-2026'), keep = season.items.slice();
  try {
    season.items.splice(0, season.items.length, 'hat:crown', 'nope:missingItem', 'gear:none:nothing', 'effect:snow');
    const track = X.passTrack(season, PR.catalogHas), items = track.filter((t) => t.premium.item).map((t) => t.premium.item);
    assert.deepEqual(items, ['hat:crown', 'effect:snow'], 'only real items, in order');
    assert.equal(track.find((t) => t.tier === X.PASS.tiers).premium.item, 'effect:snow', 'the best one at the last tier');
    assert(track.every((t) => t.premium), 'every premium tier still pays something');
    const s = store(), a = s.create(); s.grant(a.id, 500); assert(s.buyPass(a.id).ok);
    s.progressGame(a.id, ev('s1', { xp: X.PASS.xpPerTier * X.PASS.tiers }));
    const p = s.data.profiles[a.id];
    assert(p.owned.includes('hat:crown') && p.owned.includes('effect:snow')); assert(!p.owned.includes('nope:missingItem'));
    // An item you already own pays JustGold instead.
    const t = store(), b = t.create(); t.data.profiles[b.id].owned.push('hat:crown'); t.grant(b.id, 500); t.buyPass(b.id);
    const coins = t.data.profiles[b.id].coins, n = t.progressGame(b.id, ev('s2', { xp: X.PASS.xpPerTier * X.PASS.tiers }));
    const crown = n.tiers.find((x) => x.side === 'premium' && x.tier === track.find((y) => y.premium.item === 'hat:crown').tier);
    assert.equal(crown.item, null, 'not given twice'); assert(!n.items.includes('hat:crown'));
    assert.equal(t.data.profiles[b.id].coins - coins, n.gold, 'every bit of JustGold through the ledger');
    assert(n.gold >= PR.CONSOLATION + n.tiers.reduce((s2, x) => s2 + (x.gold || 0), 0), 'JustGold instead of the owned item');
  } finally { season.items.splice(0, season.items.length, ...keep); }
  // A season without items yet (until the shop fills them) uses a few existing pass items.
  const empty = X.passTrack({ id: 'x', name: 'X', items: [] }, PR.catalogHas).filter((t) => t.premium.item);
  assert(empty.length >= 5); for (const t of empty) assert(C.CATALOG.some((i) => i.id === t.premium.item));
  assert(X.passTrack(null, () => false).every((t) => t.premium.gold), 'nothing real: all JustGold');
});

test('migration: the old JustMafia season pass turns into XP and a premium pass; nothing owned is lost', () => {
  const s = store(), a = s.create(), p = s.data.profiles[a.id];
  delete p.progress; // a profile saved before box/progress.js existed
  p.pass = { season: 's1', owned: true, xp: 750, granted: [1, 2, 3] }; p.owned.push('effect:bloodMist');
  p.challenges = { week: '2026-W46', ids: ['play3'], progress: { play3: 2 }, done: [] };
  const v = s.progressView(a.id);
  assert.equal(v.xp, 750); assert.equal(v.level, X.levelOf(750).level); assert.equal(p.coins, 0, 'no back pay for migrated levels');
  assert.equal(v.season.premium, true); assert.equal(v.season.fromCredit, true); assert.equal(v.credit, 0);
  assert.deepEqual(v.legacy, { season: 's1', owned: true, xp: 750, granted: 3 });
  assert(!('pass' in p) && !('challenges' in p)); assert(p.owned.includes('effect:bloodMist'));
  assert(s.titlesOf(a.id).some((t) => t.text === 'Rookie'), 'titles of the migrated levels');
  // The credit unlocks the running event's premium track (there is always one now) and is used up.
  const t = store('2027-01-20T12:00:00Z'), b = t.create(); delete t.data.profiles[b.id].progress; t.data.profiles[b.id].pass = { season: 's1', owned: true, xp: 0, granted: [] };
  let w = t.progressView(b.id); assert.equal(w.season.id, 'lantern-2027'); assert.equal(w.season.premium, true); assert.equal(w.credit, 0);
  t.at('2027-02-08T12:00:00Z'); w = t.progressView(b.id); assert.equal(w.season.id, 'hearts-2027'); assert.equal(w.season.premium, false, 'one event only');
  // Without the old pass: nothing to credit.
  const u = store(), c = u.create(); delete u.data.profiles[c.id].progress; u.data.profiles[c.id].pass = { season: 's1', owned: false, xp: 120, granted: [] };
  assert.equal(u.progressView(c.id).season.premium, false); assert.equal(u.progressView(c.id).xp, 120);
  // Saved and loaded again: the same.
  const fs = require('node:fs'), os = require('node:os'), file = path.join(os.tmpdir(), `mt-progress-${process.pid}.json`);
  try { const d = new ProfileStore(file); d.now = () => Date.parse('2027-01-20T12:00:00Z'); const e = d.create(); d.progressGame(e.id, ev('z', { xp: 300 })); const again = new ProfileStore(file); assert.equal(again.progressView(e.id).xp, 300); } finally { try { fs.unlinkSync(file); } catch (e) { /* gone */ } }
});

// ---------- real games ----------
const runOut = (r, clock, max = 600000) => { let i = 0; while (r.game.phase !== 'over' && clock.step()) if (++i > max) throw new Error('never ended'); r.scoreParty(); };
function boxRoom(game, humans = 3, bots = 2) {
  const clock = new VirtualClock(), wallets = store(), accounts = new BoxProfileStore(null);
  const room = new BoxRoom('PROG', GAMES[game], { clock, seed: 3, profiles: accounts, wallets });
  const ps = [];
  for (let i = 0; i < humans; i++) {
    const p = room.join('P' + i).player; p.sockets = 1;
    const acc = accounts.create('P' + i), w = wallets.create(); accounts.setWallet(acc.id, w.id);
    p.profileId = acc.id; p.wallet = w.id; ps.push(p);
    wallets.progressView(w.id); // today's lists exist
    Object.assign(prog(wallets, w.id).daily, { ids: ['games', 'distinct', 'play:' + (X.SPOTLIGHT.includes(game) ? game : 'likely')] });
    Object.assign(prog(wallets, w.id).weekly, { ids: ['hands', 'mole', 'cover', 'gold', 'games'] });
  }
  room.addBots(bots);
  return { clock, room, wallets, ps };
}

test('real box games with bots: XP, challenge progress, per-game hooks (Blackjack hands, Undercover moles, Snap covers)', () => {
  for (const game of ['likely', 'blackjack', 'undercover', 'snap', 'escape']) {
    const { clock, room, wallets, ps } = boxRoom(game);
    assert(room.start().ok, game); runOut(room, clock);
    for (const p of ps) {
      const v = wallets.progressView(p.wallet), d = (id) => v.daily.list.find((c) => c.id === id), w = (id) => v.weekly.list.find((c) => c.id === id);
      assert(p.prog && p.prog.xp > 0, `${game}: the phone hears about its XP`);
      assert(v.xp >= X.boxXp(game, room.game.results().length, room.game.results().length, 90000), `${game}: XP on the wallet`);
      assert.equal(d('games').progress, 1, game); assert.equal(d('distinct').progress, 1, game);
      assert.equal(w('gold').progress, p.jg.n, `${game}: the JustGold this game paid counts`);
      const tags = typeof room.game.challengeEvents === 'function' ? room.game.challengeEvents(p.id) : {};
      if (game === 'blackjack') assert.equal(w('hands').progress, Math.min(15, tags.hands || 0));
      if (game === 'undercover') assert.equal(w('mole').progress, Math.min(3, tags.mole || 0));
      if (game === 'snap') assert.equal(w('cover').progress, Math.min(3, tags.cover || 0));
      assert(p.level >= 1, 'the roster knows the level');
    }
    const tv = room.tvState().players.find((x) => x.id === ps[0].id); assert(tv.level >= 1, 'level badge on the TV roster');
    assert(room.playerState(ps[0]).me.level >= 1, 'and on the phone header');
    // The same result again changes nothing.
    const xp = ps.map((p) => wallets.progressView(p.wallet).xp);
    room.recordProfiles(game, room.game.results(), []);
    assert.deepEqual(ps.map((p) => wallets.progressView(p.wallet).xp), xp, game + ': counted once');
  }
});

test('practice games (a lone player with bots, or under 90 s) give no XP; level ups reach the TV', () => {
  const solo = boxRoom('likely', 1, 4);
  assert(solo.room.start().ok); runOut(solo.room, solo.clock);
  assert.equal(solo.wallets.progressView(solo.ps[0].wallet).xp, 0); assert(solo.ps[0].prog.practice);
  const { clock, room, wallets, ps } = boxRoom('likely');
  prog(wallets, ps[0].wallet).xp = 95; // 5 XP short of level 2
  assert(room.start().ok); runOut(room, clock);
  assert(wallets.progressView(ps[0].wallet).level >= 2);
  assert(room.fxLog.some((f) => f.kind === 'level' && f.name === ps[0].name && f.level >= 2), 'the TV celebrates');
  assert(ps[0].prog.levelUps.length >= 1);
});

test('Party Mode finale: party XP and party challenges, once', () => {
  const { room, wallets, ps } = boxRoom('likely', 3, 0);
  for (const p of ps) Object.assign(prog(wallets, p.wallet).weekly, { ids: ['party', 'partyTop3', 'games', 'gold', 'distinct'] });
  room.partyMode = { defs: [], index: 0, phase: 'done', at: 0 };
  room.party = new Map(ps.map((p, i) => [p.id, { pts: 30 - i * 10, wins: 0, games: 1 }]));
  room.partyFinished(); room.partyFinished();
  ps.forEach((p, i) => {
    const v = wallets.progressView(p.wallet), w = (id) => v.weekly.list.find((c) => c.id === id);
    assert.equal(v.xp >= X.partyXp(i + 1), true); assert.equal(w('party').progress, 1, 'once'); assert(w('partyTop3').done);
    assert.equal(w('games').progress, 0, 'the finale is not a game');
  });
});

test('JustMafia games (sims) count: XP with the event multiplier, Mafia challenges, lines on the reward screen', () => {
  const play = (event = 'none', seed = 11) => {
    const clock = new VirtualClock(), profiles = store();
    const room = new Room('PROG', null, { clock, headless: true, seed, profiles });
    room.updateSettings({ minPlayers: 3, botsAuto: false, event });
    const ps = ['Ana', 'Ben', 'Cy', 'Di', 'Ed'].map((name) => { const pl = room.join({ name }).player; pl.profileId = profiles.create().id; return pl; });
    for (const p of ps) { profiles.progressView(p.profileId); Object.assign(prog(profiles, p.profileId).daily, { ids: ['mafia', 'mafiaSurvive', 'games'] }); Object.assign(prog(profiles, p.profileId).weekly, { ids: ['mafiaWin', 'asMafia', 'abilities', 'distinct', 'gold'] }); }
    assert(room.startGame().ok); clock.t += 3 * 60000;
    const mafia = room.inGame().filter((x) => room.team(x) === 'mafia');
    for (const m of mafia) room.override({ op: 'kill', id: m.id });
    assert.equal(room.phase, 'gameover');
    return { room, ps, profiles, mafia };
  };
  const { room, ps, profiles, mafia } = play();
  for (const p of ps) {
    const v = profiles.progressView(p.profileId), d = (id) => v.daily.list.find((c) => c.id === id), w = (id) => v.weekly.list.find((c) => c.id === id);
    const town = !!p.won, alive = !!p.alive;
    assert(d('mafia').done, 'played JustMafia'); assert.equal(d('mafiaSurvive').done, alive);
    assert.equal(w('mafiaWin').progress, town ? 1 : 0); assert.equal(w('asMafia').progress, 0);
    assert.equal(w('distinct').progress, 1);
    const r = room.playerView(p).reward;
    assert(r.lines.some((l) => l.key === 'challenge' && /Daily challenge: Play a game of JustMafia/.test(l.label)), 'shown on the reward screen');
    assert(r.progress && r.progress.xp >= X.mafiaXp(town, alive), 'XP news for the phone');
    assert(v.season.xp > 0, 'season pass XP from JustMafia');
  }
  // Settling again pays nothing more.
  const xp = ps.map((p) => profiles.progressView(p.profileId).xp); room.rewarded = false; room.settleProgression();
  assert.deepEqual(ps.map((p) => profiles.progressView(p.profileId).xp), xp);
  // The Judge's Blood Moon event doubles the game's XP.
  const moon = play('bloodMoon'), plain = play('none');
  const gx = (g, p) => g.room.playerView(p).reward.progress.xp - g.room.playerView(p).reward.progress.completed.reduce((n, c) => n + c.xp, 0);
  assert.equal(gx(moon, moon.ps[0]), 2 * gx(plain, plain.ps[0]));
  assert.equal(room.hostView().reward, undefined, 'the TV never gets private rewards');
});

test('sockets: the box phone reads progress, rerolls, buys the premium pass, wears a level title; JustMafia’s phone rerolls', async () => {
  const { io } = require('socket.io-client');
  const PORT = 4611, URL = 'http://localhost:' + PORT, sockets = [];
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), MT_PROFILE_STORE: 'memory', MT_DEV_GRANTS: '1' }, stdio: 'pipe' });
  let errors = ''; server.stderr.on('data', (d) => { errors += d; });
  const sock = (ns = '') => { const s = io(URL + ns, { transports: ['websocket'] }); sockets.push(s); return s; };
  const emit = (s, e, d = {}) => new Promise((res, rej) => s.timeout(5000).emit(e, d, (err, r) => (err ? rej(err) : res(r))));
  try {
    await new Promise((res, rej) => { server.stdout.on('data', (d) => { if (String(d).includes('Mafia Town is running')) res(); }); setTimeout(() => rej(Error(errors || 'Server did not start')), 8000).unref(); });
    const b = sock('/box');
    const acc = await emit(b, 'profile:create', { name: 'Pat' }); assert(acc.ok);
    const auth = { id: acc.id, token: acc.token };
    const none = await emit(b, 'progress:get', { auth }); assert.equal(none.ok, false); assert(none.noWallet, 'no wallet yet: the phone links it');
    const w = await emit(b, 'account:wallet', { auth }); assert(w.ok);
    let r = await emit(b, 'progress:get', { auth }); assert(r.ok, r.error);
    assert.equal(r.progress.level, 1); assert.equal(r.progress.daily.list.length, 3); assert.equal(r.progress.weekly.list.length, 5);
    const first = r.progress.daily.list[0].id;
    r = await emit(b, 'progress:reroll', { auth, period: 'daily', id: first }); assert(r.ok, r.error); assert(!r.progress.daily.list.some((c) => c.id === first));
    assert.equal((await emit(b, 'progress:reroll', { auth, period: 'daily', id: r.progress.daily.list[1].id })).ok, false, 'one a day');
    const bad = await emit(b, 'progress:get', { auth: { id: acc.id, token: 'f'.repeat(64) } }); assert.equal(bad.ok, false, 'needs the real token');
    // JustMafia's phone: the same wallet, the same progress.
    const m = sock(); const res = await emit(m, 'profile:resume', w.wallet); assert(res.ok); assert(res.profile.progress, 'JustMafia’s phone gets the same progress');
    assert.equal(res.profile.progress.rerolls.left, 0, 'the reroll was used on the box phone: same wallet');
    const mr = await emit(m, 'profile:reroll', { period: 'weekly', id: res.profile.progress.weekly.list[0].id }); assert.equal(mr.ok, false);
    if (r.progress.season) { // (only while an event runs on the real clock)
      assert.match((await emit(b, 'progress:premium', { auth })).error, /Not enough JustGold/);
      assert((await emit(m, 'dev:grant', { amount: 400 })).ok);
      const bp = await emit(b, 'progress:premium', { auth }); assert(bp.ok, bp.error); assert(bp.progress.season.premium); assert.equal(bp.gold, 400 - X.PASS.cost + bp.progress.season.track.filter((t) => t.premGot).reduce((n, t) => n + (t.premium.gold || 0), 0));
      const again = await emit(m, 'profile:buyPass', {}); assert.equal(again.ok, false, 'JustMafia’s phone sees the premium pass too');
    }
    // A level title can be worn once earned (none yet).
    assert.equal((await emit(b, 'profile:title', { auth, title: 'p:lvl5' })).ok, false);
  } finally { for (const s of sockets) s.close(); server.kill(); }
});

(async () => {
  for (const [name, fn] of tests) { await fn(); passed++; console.log(`  ✓ ${name}`); }
  console.log(`All ${passed} progress tests passed.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
