'use strict';
// JustGold (JG) for JustGameBox games: what a finished game pays (docs/justgold.md).
//
// A game pays everyone with an account who played it: `play`, plus `top` for the top half and
// `win` for first place, scaled by how long the game ran (a 12-minute game is ×1; short games pay
// a little less, long ones more, ×0.6 to ×2.5), so time spent is what's rewarded, game to game.
// Rules against farming: the room needs 2+ people (bots don't count) and the game must run 90 s.
// Party Mode: every game pays as usual, and finishing the whole party pays a big bonus: the
// easiest way to earn JG. JustMafia keeps its own rules (public/shared/cosmetics.js REWARDS).
const BASE = { play: 4, top: 3, win: 5 };
// Games that are naturally co-op pay everyone alike (no "winner" over your teammates).
const COOP = new Set(['escape', 'bomb', 'marble']);
const MIN_HUMANS = 2, MIN_MS = 90 * 1000;
const PARTY = { all: 25, places: [40, 25, 15] }; // finishing a Party Mode: everyone + top 3 bonus
const scaleOf = (ms) => Math.max(0.6, Math.min(2.5, ms / (12 * 60 * 1000)));

// place: 1-based finishing place; of: how many finished; ms: how long the game ran.
function goldFor(game, place, of, ms, coopCleared = true) {
  let n = BASE.play;
  if (COOP.has(game)) n += coopCleared ? BASE.top + 2 : 0;
  else { if (place <= Math.ceil(of / 2)) n += BASE.top; if (place === 1 && of > 1) n += BASE.win; }
  return Math.max(1, Math.round(n * scaleOf(ms)));
}
function partyGold(place) { return PARTY.all + (PARTY.places[place - 1] || 0); }

// The "Earn JG" table the shop shows.
function earnTable() {
  return {
    note: 'Every finished game pays JustGold to everyone with an account who played it (2+ people, 90 s+). Longer games pay more.',
    base: { ...BASE }, minHumans: MIN_HUMANS, minSeconds: MIN_MS / 1000,
    examples: [
      { label: 'A 10-minute game, you played', jg: goldFor('x', 5, 6, 10 * 60000) },
      { label: 'A 10-minute game, top half', jg: goldFor('x', 3, 6, 10 * 60000) },
      { label: 'A 10-minute game, you won', jg: goldFor('x', 1, 6, 10 * 60000) },
      { label: 'A 30-minute game, you won', jg: goldFor('x', 1, 6, 30 * 60000) },
      { label: 'A co-op game cleared (JustEscape, Bomb Squad, JustMarble), 20 minutes', jg: goldFor('escape', 1, 4, 20 * 60000) },
    ],
    party: { all: PARTY.all, places: PARTY.places.slice(), label: 'Finish a whole Party Mode: everyone +' + PARTY.all + ', and +' + PARTY.places.join(' / +') + ' for the top 3 (plus every game along the way). The fastest way to earn.' },
    mafia: 'JustMafia: 4–30 JG a game (finishing, winning, your role’s good plays), weekly challenges and the season pass.',
  };
}

module.exports = { goldFor, partyGold, earnTable, COOP, MIN_HUMANS, MIN_MS, PARTY, BASE };
