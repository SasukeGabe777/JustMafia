'use strict';
// Headless simulations for testing and balancing. Uses the real engine and
// real bot logic with a virtual clock, so no rendering and no waiting.
//
//   const { runBatch } = require('./sim');
//   runBatch({ games: 500, players: [8, 12, 20], settings: { roleCounts: {...} } })

const { Room } = require('./game');
const { VirtualClock } = require('./clock');
const { ROLES } = require('./public/shared/roles');

function simulateGame({ players = 10, settings = {}, seed = Math.floor(Math.random() * 2 ** 31), personality, reads = 0 } = {}) {
  const clock = new VirtualClock();
  const room = new Room('SIM', null, { clock, headless: true, seed });
  // Simulations never wait for a human: automatic phases and reveals.
  room.updateSettings({ ...settings, maxPlayers: 100, minPlayers: 3, skipCinematics: false, speed: 1, botsAuto: true, botChatter: settings.botChatter !== false, narratorMode: 'ai', revealMode: 'auto', autoAdvance: true });
  room.addBots(players, personality);
  room.simReads = reads; // model real players' gut reads (see Room.humanReads)
  const started = room.startGame();
  if (!started.ok) return { error: started.error, seed };
  let steps = 0;
  while (room.phase !== 'gameover' && steps < 200000) {
    if (!clock.step()) room.advance(); // manual phases (autoAdvance off) need a push
    steps++;
  }
  if (room.phase !== 'gameover') return { error: 'stuck in ' + room.phase, seed };
  return { ...room.report(), seed };
}

const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);

function aggregate(results) {
  const ok = results.filter((r) => !r.error);
  const out = {
    games: results.length,
    errors: results.filter((r) => r.error).map((r) => `${r.error} (seed ${r.seed})`).slice(0, 10),
    winRates: {},
    avgDays: 0,
    avgMinutes: 0,
    byPlayerCount: {},
    roles: {},
    eliminations: { lynchedTeams: {}, nightVictimTeams: {}, noLynchDayRate: 0, tieRate: 0, skipVoteRate: 0, lynchAccuracy: 0 },
    effectiveness: {},
  };
  if (!ok.length) return out;
  const winners = {};
  let days = 0, ms = 0, lynches = 0, lynchHits = 0, dayCount = 0, noLynch = 0, ties = 0, skip = 0, votes = 0;
  const eff = { saves: 0, guards: 0, immune: 0, blocks: 0, invChecks: {}, invHits: {}, shots: 0, shotsOnTown: 0, promotions: 0 };
  const expansion = {};
  for (const g of ok) {
    winners[g.winner] = (winners[g.winner] || 0) + 1;
    days += g.days; ms += g.durationMs;
    const pc = (out.byPlayerCount[g.n] = out.byPlayerCount[g.n] || { games: 0, wins: {}, avgDays: 0 });
    pc.games++; pc.wins[g.winner] = (pc.wins[g.winner] || 0) + 1; pc.avgDays += g.days;
    for (const p of g.players) {
      const r = (out.roles[p.role] = out.roles[p.role] || { count: 0, survived: 0, won: 0, deaths: {} });
      r.count++;
      if (p.alive) r.survived++;
      if (p.won) r.won++;
      if (!p.alive && p.cause) r.deaths[p.cause] = (r.deaths[p.cause] || 0) + 1;
    }
    const s = g.stats;
    for (const [key, n] of Object.entries(s.expansion || {})) expansion[key] = (expansion[key] || 0) + n;
    for (const l of s.lynches) { lynches++; if (l.team !== 'town') lynchHits++; out.eliminations.lynchedTeams[l.team] = (out.eliminations.lynchedTeams[l.team] || 0) + 1; }
    for (const k of s.nightKills) out.eliminations.nightVictimTeams[k.team] = (out.eliminations.nightVictimTeams[k.team] || 0) + 1;
    dayCount += s.lynches.length + s.noLynchDays;
    noLynch += s.noLynchDays; ties += s.ties; skip += s.skipVotes; votes += s.totalVotes;
    eff.saves += s.saves; eff.guards += s.guards; eff.immune += s.immune; eff.blocks += s.blocks; eff.promotions += s.promotions;
    for (const i of s.investigations) {
      eff.invChecks[i.role] = (eff.invChecks[i.role] || 0) + 1;
      if (i.found) eff.invHits[i.role] = (eff.invHits[i.role] || 0) + 1;
    }
    for (const sh of s.shots) { eff.shots++; if (sh.targetTeam === 'town') eff.shotsOnTown++; }
  }
  for (const [w, c] of Object.entries(winners)) out.winRates[w] = pct(c, ok.length);
  out.avgDays = Math.round((10 * days) / ok.length) / 10;
  out.avgMinutes = Math.round(ms / ok.length / 6000) / 10;
  for (const pc of Object.values(out.byPlayerCount)) {
    pc.avgDays = Math.round((10 * pc.avgDays) / pc.games) / 10;
    for (const k of Object.keys(pc.wins)) pc.wins[k] = pct(pc.wins[k], pc.games);
  }
  for (const r of Object.values(out.roles)) { r.survivalRate = pct(r.survived, r.count); r.winRate = pct(r.won, r.count); }
  out.eliminations.noLynchDayRate = pct(noLynch, dayCount);
  out.eliminations.tieRate = pct(ties, dayCount);
  out.eliminations.skipVoteRate = pct(skip, votes);
  out.eliminations.lynchAccuracy = pct(lynchHits, lynches);
  const per = (x) => Math.round((100 * x) / ok.length) / 100;
  out.effectiveness = {
    expansionPerGame: Object.fromEntries(Object.entries(expansion).map(([k, n]) => [k, per(n)])),
    doctorSavesPerGame: per(eff.saves),
    bodyguardSavesPerGame: per(eff.guards),
    nightImmuneSavesPerGame: per(eff.immune),
    blocksPerGame: per(eff.blocks),
    promotionsPerGame: per(eff.promotions),
    investigatorHitRate: Object.fromEntries(Object.keys(eff.invChecks).map((k) => [k, pct(eff.invHits[k] || 0, eff.invChecks[k])])),
    vigilanteShotsPerGame: per(eff.shots),
    vigilanteFriendlyFire: pct(eff.shotsOnTown, eff.shots),
  };
  return out;
}

function runBatch({ games = 100, players = [10], settings = {}, seed, personality, reads = 0 } = {}) {
  const sizes = Array.isArray(players) ? players : [players];
  const results = [];
  const t0 = Date.now();
  for (let i = 0; i < games; i++) {
    const n = sizes[i % sizes.length];
    results.push(simulateGame({ players: n, settings: typeof settings === 'function' ? settings(n, i) : settings, personality, reads, seed: seed != null ? seed + i : undefined }));
  }
  return { ...aggregate(results), elapsedMs: Date.now() - t0, roleNames: Object.fromEntries(Object.entries(ROLES).map(([k, v]) => [k, v.name])) };
}

module.exports = { simulateGame, runBatch, aggregate };
