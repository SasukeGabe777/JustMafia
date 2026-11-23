'use strict';
// JustGold (JG) for JustGameBox games: what a finished game pays (docs/justgold.md, "Earning").
//
// A finished game pays everyone with an account who played it, from several sources, and every
// source is its own line in the chest scene (public/box/chest.js):
//   participation  RATES.play × game length (a 10-minute game is ×1; ×0.5 to ×1.6)
//   placement      1st / 2nd / 3rd / top half (× game length); co-op games: "team cleared it" for all
//   achievements   the game's own awards for you, a comeback or landslide win, a new game, …
//                  (RATES.ach each, at most RATES.achMax a game)
//   tonight        on a roll (3rd / 5th game in a row tonight), back-to-back wins
//   daily          the first paid game of the (UTC) day, any game, JustMafia too
//   day streak     playing on consecutive days (paid with the first game of the day)
//   theme set      wearing a whole theme set in its own game (public/shared/shop-season.js)
// Challenges, level ups and season-pass tiers pay on top (box/progress.js) and show on the chest too.
// Rules against farming: the room needs 2+ people who played (bots don't count), the game must run
// 90 s, games under 4 minutes pay half and no extras, a practice round pays nothing (box/room.js),
// and each result pays once (ProfileStore.awardBox payId).
// Party Mode: every game pays as usual, and finishing the whole party opens the legendary chest
// (partyLines): staying the whole night, every game played and the final standings.
// JustMafia keeps its own per-game rules (public/shared/cosmetics.js REWARDS) plus the same daily /
// day-streak bonus (dayLines).
const RATES = {
  play: 15, place: [18, 12, 8], top: 5, coop: 12,
  ach: 6, achMax: 3,
  roll3: 5, roll5: 10, winStreak: 10,
  daily: 25, dayStreak: 5, dayStreakMax: 30,
  shortMs: 4 * 60 * 1000, shortScale: 0.5, shortCap: 20, gameCap: 150,
};
// Party Mode finale: everyone who stayed + each game they played + the final standings.
const PARTY = { stayed: 40, perGame: 8, perGameMax: 80, places: [75, 50, 30], top: 15 };
const BASE = { play: RATES.play, top: RATES.top, win: RATES.place[0] }; // (old name, kept for the shop page)
// Games that are naturally co-op pay everyone alike (no "winner" over your teammates).
const COOP = new Set(['escape', 'bomb', 'marble']);
const MIN_HUMANS = 2, MIN_MS = 90 * 1000;
const scaleOf = (ms) => (ms < RATES.shortMs ? RATES.shortScale : Math.max(0.5, Math.min(1.6, ms / (10 * 60 * 1000))));
const ord = (n) => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
// 1st always (2+ players); 2nd with 3+; 3rd with 4+ (last place never gets a podium line).
const podium = (place, of) => place === 1 || (place === 2 && of >= 3) || (place === 3 && of >= 4);
const r1 = (n) => Math.max(1, Math.round(n));

// Participation + placement only (what the old single number was): place 1-based, of = how many finished.
function placeLine(game, place, of, ms, coopCleared = true) {
  const s = scaleOf(ms);
  if (COOP.has(game)) return coopCleared ? { key: 'place', icon: '🤝', label: 'Team cleared it', n: r1(RATES.coop * s) } : null;
  if (of < 2) return null;
  if (podium(place, of)) return { key: 'place', icon: ['🥇', '🥈', '🥉'][place - 1], label: place === 1 ? 'Winner!' : ord(place) + ' place', n: r1(RATES.place[place - 1] * s) };
  if (of >= 4 && place <= Math.ceil(of / 2)) return { key: 'place', icon: '🎖️', label: 'Top half', n: r1(RATES.top * s) };
  return null;
}
function goldFor(game, place, of, ms, coopCleared = true) {
  const pl = placeLine(game, place, of, ms, coopCleared);
  return r1(RATES.play * scaleOf(ms)) + (pl ? pl.n : 0);
}

// Day state on the wallet (`p.jgDay = { day, streak }`): the first paid game of a UTC day and the
// run of days in a row. dayInfo reads it (nothing changes until the game is paid: markDay).
const dayKey = (now) => new Date(now).toISOString().slice(0, 10);
const prevDay = (key) => dayKey(Date.parse(key + 'T12:00:00Z') - 86400000);
function dayInfo(w, now) {
  const d = (w && w.jgDay) || null, today = dayKey(now);
  if (d && d.day === today) return { first: false, streak: d.streak || 1, today };
  return { first: true, streak: d && d.day === prevDay(today) ? (d.streak || 1) + 1 : 1, today };
}
function markDay(w, info) { if (w && info && info.first) w.jgDay = { day: info.today, streak: info.streak }; }
function dayLines(info) {
  const out = [];
  if (!info || !info.first) return out;
  out.push({ key: 'daily', icon: '☀️', label: 'First game today', n: RATES.daily });
  if (info.streak >= 2) out.push({ key: 'streak', icon: '🔥', label: `${info.streak}-day streak`, n: Math.min(RATES.dayStreakMax, RATES.dayStreak * (info.streak - 1)) });
  return out;
}

// Everything one finished game pays one player, as lines for the chest.
//   o = { game, place, of, ms, coopCleared, achievements: [{ icon, label }], night: { games, wins }, day: dayInfo(), look, now }
//   night.games: games this player finished in a row tonight (this one included); night.wins: wins in a row.
function gameLines(o) {
  const short = o.ms < RATES.shortMs, s = scaleOf(o.ms), lines = [];
  lines.push({ key: 'play', icon: '🎮', label: short ? 'Played (a short game: half gold)' : 'Played the game', n: r1(RATES.play * s) });
  const pl = placeLine(o.game, o.place, o.of, o.ms, o.coopCleared !== false); if (pl) lines.push(pl);
  if (!short) {
    for (const a of (o.achievements || []).slice(0, RATES.achMax)) lines.push({ key: 'ach', icon: String(a.icon || '🏅').slice(0, 8), label: String(a.label || 'Achievement').slice(0, 48), n: RATES.ach });
    const nt = o.night || {};
    if (nt.games >= 5) lines.push({ key: 'roll', icon: '🎢', label: `On a roll: game ${nt.games} tonight`, n: RATES.roll5 });
    else if (nt.games >= 3) lines.push({ key: 'roll', icon: '🎢', label: `On a roll: game ${nt.games} tonight`, n: RATES.roll3 });
    if (nt.wins >= 2) lines.push({ key: 'wins', icon: '⚡', label: `${nt.wins} wins in a row`, n: RATES.winStreak });
  }
  // A short game pays at most shortCap; any game at most gameCap (before the daily bonus).
  let sum = lines.reduce((t, l) => t + l.n, 0);
  const cap = short ? RATES.shortCap : RATES.gameCap;
  for (let i = lines.length - 1; sum > cap && i >= 0; i--) { const cut = Math.min(lines[i].n - 1, sum - cap); lines[i].n -= cut; sum -= cut; }
  lines.push(...dayLines(o.day));
  sum = lines.reduce((t, l) => t + l.n, 0);
  const b = SS.setBonus(o.game, o.look, sum, o.now);
  if (b) lines.push({ key: 'set', icon: b.icon, label: `${b.name} set bonus`, n: b.extra });
  return { lines, total: lines.reduce((t, l) => t + l.n, 0), short, set: b ? { icon: b.icon, name: b.name, extra: b.extra } : null };
}

// Theme sets (public/shared/shop-season.js): wearing a whole set adds +5% (at least 1, at most 3 JG)
// to what one game pays, in that set's own game only. Applied once per payout.
const SS = require('../public/shared/shop-season');
function withSetBonus(game, n, look) { const b = n > 0 ? SS.setBonus(game, look, n) : null; return { n: n + (b ? b.extra : 0), bonus: b }; }

// Party Mode finale (the legendary chest). place: final party standing; games: real (paid) games
// this player finished; total: real games in the party; stayed: played the whole night.
function partyLines({ place, of, games, total, stayed }) {
  const lines = [];
  if (!games) return { lines, total: 0 };
  if (stayed) lines.push({ key: 'stayed', icon: '🌙', label: 'Stayed the whole night', n: PARTY.stayed });
  lines.push({ key: 'games', icon: '🎮', label: `${games} game${games === 1 ? '' : 's'} played`, n: Math.min(PARTY.perGameMax, PARTY.perGame * games) });
  if (of >= 2 && podium(place, of)) lines.push({ key: 'place', icon: ['👑', '🥈', '🥉'][place - 1], label: place === 1 ? 'Party champion!' : `${ord(place)} in the party`, n: PARTY.places[place - 1] });
  else if (of >= 4 && place <= Math.ceil(of / 2)) lines.push({ key: 'place', icon: '🎖️', label: 'Top half of the party', n: PARTY.top });
  return { lines, total: lines.reduce((t, l) => t + l.n, 0), of: total };
}
// The old single number (the whole night, every game played, by place).
function partyGold(place, games = 5) { return partyLines({ place, of: 6, games, total: games, stayed: true }).total; }

// Chest tier by the amount in it (public/box/chest.js draws them).
function tierOf(n, party = false) { return party ? 'legendary' : n >= 80 ? 'epic' : n >= 45 ? 'gold' : n >= 20 ? 'silver' : 'wood'; }

// The "Earn JG" table the shop shows.
function earnTable() {
  const ten = 10 * 60000;
  return {
    note: 'Every finished game opens a chest of JustGold for everyone who played it (2+ people, 90 s+). Longer games pay more, and every game has bonuses.',
    base: { ...BASE }, minHumans: MIN_HUMANS, minSeconds: MIN_MS / 1000, rates: { ...RATES, place: RATES.place.slice() },
    examples: [
      { label: 'A 10-minute game, you played', jg: goldFor('x', 6, 6, ten) },
      { label: 'A 10-minute game, top half', jg: goldFor('x', 3, 6, ten) },
      { label: 'A 10-minute game, you won', jg: goldFor('x', 1, 6, ten) },
      { label: 'A 16-minute game, you won', jg: goldFor('x', 1, 6, 16 * 60000) },
      { label: 'A co-op game cleared (JustEscape, Bomb Squad, JustMarble), 15 minutes', jg: goldFor('escape', 1, 4, 15 * 60000) },
      { label: 'Your first game of the day', jg: String(RATES.daily) },
      { label: 'Days in a row', jg: `${RATES.dayStreak} a day (up to ${RATES.dayStreakMax})` },
      { label: 'Achievements in a game (awards, comebacks, a new game…)', jg: `${RATES.ach} each (up to ${RATES.achMax})` },
      { label: 'On a roll: your 3rd / 5th game tonight', jg: `${RATES.roll3} / ${RATES.roll5}` },
    ],
    party: { all: PARTY.stayed, places: PARTY.places.slice(), label: `Finish a whole Party Mode: the legendary chest. +${PARTY.stayed} for staying the whole night, +${PARTY.perGame} for every game you played (up to ${PARTY.perGameMax}), and +${PARTY.places.join(' / +')} for the top 3 (plus every game’s own chest). The fastest way to earn.` },
    sets: 'Wear a whole theme set (Shop → Sets) in its own game: +' + SS.SETS_RULES.bonusPct + '% JustGold there (at least 1, at most ' + SS.SETS_RULES.bonusCap + ' a game).',
    mafia: 'JustMafia: up to 38 JG a game (finishing, winning, your role’s good plays), plus the first-game-of-the-day bonus. Every game (any kind) also earns XP for your level, daily / weekly challenges and the season pass, which pay JG too.',
  };
}

module.exports = { goldFor, placeLine, gameLines, partyLines, dayInfo, markDay, dayLines, dayKey, tierOf, withSetBonus, partyGold, earnTable, scaleOf, COOP, MIN_HUMANS, MIN_MS, PARTY, BASE, RATES };
