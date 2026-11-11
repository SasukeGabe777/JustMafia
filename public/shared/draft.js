// Role Draft ("Default" role selection): which role cards are offered before a game,
// and how the players' votes become a valid, balanced setup.
// Pure functions (an rng is passed in), shared by the server (require) and the browser
// (window.MT_DRAFT_RULES). Everything here uses the real role bank in roles.js;
// the draft never invents roles or abilities.
(function (root) {
  const R = typeof module !== 'undefined' && module.exports ? require('./roles') : root.MT_ROLES;
  const { ROLES, autoMafiaCount, buildRoleList } = R;

  // ---- Tunable scaling (configurable, not hard-coded to 4 and 8 players) ----
  const SCALE = {
    // Cards shown: 4 players → 3 cards, 8 → 5, 12 → 7, 16+ → 9 (cap).
    cards: (n) => Math.max(3, Math.min(9, Math.round(n / 2) + 1)),
    // How many of the shown cards make it into the game: 3 → 2, 5 → 3, 7 → 5, 9 → 6.
    winners: (cards) => Math.max(1, Math.ceil(cards * 0.6)),
    // Neutral cards offered (and allowed in the final game).
    neutrals: (n) => (n >= 14 ? 2 : n >= 7 ? 1 : 0),
  };

  // Per-role draft info. min = smallest game it's offered in; weight = how often it is
  // offered (complex roles a bit rarer); power = rough strength used for balancing;
  // kind = what the town needs (info / protect).
  const META = {
    mafia:        { min: 3,  weight: 0,   power: 2, tutorialOnly: true }, // only shown as a card in the tutorial round
    godfather:    { min: 4,  weight: 1.0, power: 3 },
    roleblocker:  { min: 7,  weight: 1.0, power: 2 },
    silencer:     { min: 7,  weight: 0.9, power: 2 },
    hunter:       { min: 7,  weight: 0.9, power: 2 },
    puppetMaster: { min: 9,  weight: 0.6, power: 2, publicVotes: true },
    hustler:      { min: 9,  weight: 0.6, power: 1 },
    alchemist:    { min: 11, weight: 0.5, power: 2 },
    detective:    { min: 4,  weight: 1.2, power: 2, kind: 'info' },
    sheriff:      { min: 4,  weight: 1.0, power: 2, kind: 'info' },
    sorcerer:     { min: 8,  weight: 0.8, power: 3, kind: 'info' },
    investigator: { min: 8,  weight: 0.7, power: 1, kind: 'info' },
    doctor:       { min: 4,  weight: 1.2, power: 2, kind: 'protect' },
    bodyguard:    { min: 5,  weight: 1.0, power: 2, kind: 'protect' },
    executioner:  { min: 6,  weight: 0.9, power: 1 },
    vigilante:    { min: 6,  weight: 1.0, power: 2 },
    mayor:        { min: 6,  weight: 0.9, power: 1 },
    detonator:    { min: 9,  weight: 0.6, power: 2 },
    storymaker:   { min: 9,  weight: 0.6, power: 1 },
    telepath:     { min: 8,  weight: 0.7, power: 1, slots: 2 },
    ghostwriter:  { min: 8,  weight: 0.6, power: 1 },
    conductor:    { min: 10, weight: 0.5, power: 1 },
    glitch:       { min: 8,  weight: 0.5, power: 0 },
    jester:       { min: 6,  weight: 1.0, power: 0 },
    serialKiller: { min: 9,  weight: 0.8, power: 3 },
    paparazzi:    { min: 10, weight: 0.6, power: 0 },
    headhunter:   { min: 8,  weight: 0.8, power: 3 },
    // DLC 1
    framer:       { min: 7,  weight: 0.8, power: 2 },
    janitor:      { min: 8,  weight: 0.7, power: 1 },
    impostor:     { min: 7,  weight: 0.8, power: 2 },
    medium:       { min: 6,  weight: 0.8, power: 1, kind: 'info' },
    lookout:      { min: 6,  weight: 0.9, power: 2, kind: 'info' },
    veteran:      { min: 6,  weight: 0.8, power: 2, kind: 'protect' },
    trapper:      { min: 6,  weight: 0.8, power: 2, kind: 'protect' },
    cupid:        { min: 7,  weight: 0.7, power: 0 },
    eavesdropper: { min: 7,  weight: 0.7, power: 1, kind: 'info' },
    crier:        { min: 6,  weight: 0.8, power: 1 },
  };
  // Ten unlock tiers for "learn as you play": a room starts with the 9 simplest roles and
  // unlocks the next tier (3 roles) after every game it finishes, from simple to complex.
  // Every role in META is in exactly one tier.
  // Tier 0 is the tutorial round (a room's very first game): just Mafia, Detective and Doctor.
  const TUTORIAL = ['mafia', 'detective', 'doctor'];
  const TIER = {
    0: ['detective', 'doctor'],
    1: ['godfather', 'sheriff', 'bodyguard', 'vigilante', 'mayor', 'jester', 'executioner'],
    2: ['medium', 'lookout', 'crier'],
    3: ['roleblocker', 'trapper', 'veteran'],
    4: ['framer', 'serialKiller', 'cupid'],
    5: ['sorcerer', 'investigator', 'eavesdropper'],
    6: ['silencer', 'impostor', 'telepath'],
    7: ['hunter', 'janitor', 'ghostwriter'],
    8: ['hustler', 'detonator', 'storymaker'],
    9: ['puppetMaster', 'alchemist', 'paparazzi'],
    10: ['headhunter', 'conductor', 'glitch'],
  };
  const MAX_TIER = 10;
  for (const [t, keys] of Object.entries(TIER)) for (const k of keys) if (META[k]) META[k].tier = Number(t);
  // Game 1: tier 0 (tutorial) · each finished game unlocks one more tier · game 11+: every role.
  const tierForGame = (gamesPlayed) => Math.min(MAX_TIER, gamesPlayed || 0);
  const slotsOf = (k) => (META[k] && META[k].slots) || 1;
  const teamOf = (k) => (ROLES[k] || {}).team;
  const killerMafia = (k) => teamOf(k) === 'mafia' && ROLES[k].night && ROLES[k].night.kind === 'kill';

  function eligible(k, n, settings) {
    const m = META[k];
    if (!m || !ROLES[k] || n < m.min || m.tutorialOnly) return false;
    if (m.publicVotes && settings.anonymousVotes) return false;
    // In games with a single Mafia member, only a Mafia role that can kill may replace it.
    if (teamOf(k) === 'mafia' && autoMafiaCount(n) < 2 && !killerMafia(k)) return false;
    return true;
  }

  // Weighted pick without replacement; roles shown less often in this room get a boost.
  function weightedPick(keys, count, rng, seen) {
    const pool = keys.slice(), out = [];
    while (out.length < count && pool.length) {
      const w = pool.map((k) => META[k].weight / (1 + 1.5 * ((seen && seen[k]) || 0)));
      let x = rng() * w.reduce((a, b) => a + b, 0), i = 0;
      while (i < pool.length - 1 && (x -= w[i]) > 0) i++;
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }

  // The candidate cards for a game of n players: a mix of Mafia, Town and (bigger games)
  // Neutral roles, always with an information role and a protector for the town when possible.
  // opts.maxTier: only roles up to this complexity (learn as you play; tops up from harder
  // tiers if a tier is too small). opts.everyRole: every role, fully random (no tiers,
  // no minimum sizes, no team structure); the final setup is still repaired to be valid.
  function candidates(n, settings = {}, rng = Math.random, seen = {}, opts = {}) {
    const total = SCALE.cards(n);
    if (opts.everyRole) {
      const all = Object.keys(META).filter((k) => ROLES[k] && !META[k].tutorialOnly && !(META[k].publicVotes && settings.anonymousVotes));
      const out = [];
      while (out.length < total && out.length < all.length) { const k = all[Math.floor(rng() * all.length)]; if (!out.includes(k)) out.push(k); }
      return out;
    }
    if (opts.maxTier === 0) return TUTORIAL.slice(); // the tutorial round: always the same three cards
    const maxTier = opts.maxTier == null ? MAX_TIER : opts.maxTier;
    const ok = Object.keys(META).filter((k) => eligible(k, n, settings) && (META[k].tier ?? 1) <= maxTier);
    const harder = Object.keys(META).filter((k) => eligible(k, n, settings) && (META[k].tier ?? 1) > maxTier);
    const by = (team) => ok.filter((k) => teamOf(k) === team);
    const mafiaCards = Math.min(by('mafia').length, Math.max(1, Math.round(total * 0.25)), autoMafiaCount(n));
    const neutralCards = Math.min(by('neutral').length, SCALE.neutrals(n));
    const picked = [];
    picked.push(...weightedPick(by('mafia'), mafiaCards, rng, seen));
    picked.push(...weightedPick(by('neutral'), neutralCards, rng, seen));
    const town = by('town');
    for (const kind of ['info', 'protect']) {
      if (picked.length >= total) break;
      const k = weightedPick(town.filter((t) => META[t].kind === kind && !picked.includes(t)), 1, rng, seen)[0];
      if (k) picked.push(k);
    }
    picked.push(...weightedPick(town.filter((t) => !picked.includes(t)), total - picked.length, rng, seen));
    // If the bank is short, top up from anything still eligible (never duplicates).
    if (picked.length < total) picked.push(...weightedPick(ok.filter((k) => !picked.includes(k)), total - picked.length, rng, seen));
    // Fewer than 3 unlocked roles fit this group (very rare): borrow the simplest locked ones.
    if (picked.length < Math.min(total, 3)) picked.push(...weightedPick(harder.filter((k) => !picked.includes(k)).sort((a, b) => META[a].tier - META[b].tier).slice(0, total * 2), Math.min(total, 3) - picked.length, rng, seen));
    return picked;
  }

  // Votes → final roleCounts. ballots: { playerId: [roleKey, ...] }.
  // Ranking: most votes first; ties broken by a fair random shuffle (rng).
  // Then fixes anything invalid while keeping as many of the players' choices as possible.
  function finalize({ cards, ballots, n, settings = {}, rng = Math.random, want: wantAll }) {
    const tally = Object.fromEntries(cards.map((k) => [k, 0]));
    for (const picks of Object.values(ballots || {})) for (const k of new Set(picks || [])) if (k in tally) tally[k]++;
    const order = cards.slice();
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    order.sort((a, b) => tally[b] - tally[a]); // stable: equal votes keep the random order
    const want = wantAll || SCALE.winners(cards.length);
    const cutoff = order[want - 1] != null ? tally[order[want - 1]] : -1;
    const tie = order.filter((k) => tally[k] === cutoff).length > order.slice(0, want).filter((k) => tally[k] === cutoff).length;

    const setupOf = (keys) => {
      const counts = {};
      for (const k of keys) counts[k] = k === 'telepath' ? 2 : 1;
      return buildRoleList({ ...settings, roleCounts: counts, autoMafia: true, forcedRoles: {} }, n);
    };
    const valid = (keys) => {
      const s = setupOf(keys);
      if (s.errors.length) return false;
      const mafia = s.roles.filter((r) => teamOf(r) === 'mafia').length;
      if (mafia < 1 || mafia > autoMafiaCount(n)) return false; // always ≥1 Mafia; never a bigger family than normal
      return s.roles.filter((r) => teamOf(r) === 'neutral').length <= Math.max(1, SCALE.neutrals(n));
    };
    const power = (keys, team) => keys.filter((k) => teamOf(k) === team).reduce((t, k) => t + META[k].power, 0);
    const balanced = (keys) => power(keys, 'mafia') <= power(keys, 'town') + 2; // don't hand the Mafia a stacked deck
    // Greedy: walk the ranking, keep each card if the setup stays valid, until we have enough.
    let chosen = [];
    const dropped = [];
    const fill = (skip) => { for (const k of order) { if (chosen.length >= want) break; if (chosen.includes(k) || dropped.includes(k) || skip(k)) continue; if (valid([...chosen, k])) chosen.push(k); else dropped.push(k); } };
    fill(() => false);
    // Balance pass: swap the least-voted Mafia cards for the next best non-Mafia cards.
    while (!balanced(chosen) && chosen.some((k) => teamOf(k) === 'mafia')) {
      const weakest = chosen.filter((k) => teamOf(k) === 'mafia').pop();
      chosen = chosen.filter((k) => k !== weakest); dropped.push(weakest);
      fill((k) => teamOf(k) === 'mafia');
    }
    chosen.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const setup = valid(chosen) ? setupOf(chosen) : setupOf([]);
    const final = valid(chosen) ? chosen : [];
    return {
      roles: final, // the drafted special roles (Mafia members and Villagers are filled automatically)
      roleCounts: Object.fromEntries(final.map((k) => [k, k === 'telepath' ? 2 : 1])),
      list: setup.roles, errors: setup.errors, tally, order, tie, dropped,
      fallback: final.length < Math.min(want, order.length),
    };
  }

  const API = { SCALE, META, TIER, TUTORIAL, MAX_TIER, tierForGame, eligible, candidates, finalize, slotsOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.MT_DRAFT_RULES = API;
})(typeof window !== 'undefined' ? window : globalThis);
