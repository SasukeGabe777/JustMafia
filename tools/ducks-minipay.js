'use strict';
// JustRaiseDucks: how much each training mini-game pays for the same effort. A model of each game
// (public/box/games/ducks-mini.js: its spawn rates, speeds, scoring and combo rules) played by three
// kinds of player (how often they get an action right, how often it is PERFECT, how quick they are),
// many times; prints the average score and the XP that turns into on the server (the per-game pay
// factor PAY in box/games/ducks.js and the XP floor). Run: node tools/ducks-minipay.js
// It is a model, not the real canvas games: it is for comparing the six games with each other.
const def = require('../box/games/ducks');
const D = def._test;
const SM = [1, 1.15, 1.32];
const PLAYERS = {
  struggling: { p: 0.55, q: 0.05, beat: 0.12, extra: 0.25, react: 0.8, mem: 0.86, tap: 0.85, bugQ: 0.25, bee: 0.25 },
  casual: { p: 0.75, q: 0.2, beat: 0.35, extra: 0.45, react: 0.45, mem: 0.94, tap: 0.55, bugQ: 0.5, bee: 0.1 },
  good: { p: 0.92, q: 0.5, beat: 0.7, extra: 0.7, react: 0.25, mem: 0.985, tap: 0.35, bugQ: 0.85, bee: 0.02 },
};
// assist (0-3): the quiet help for players who struggle (slower pace, wider windows) as the client
// applies it (DUCK_MINI.assistRules); it raises the odds of getting an action right.
function scorer(noMult) {
  const S = { score: 0, combo: 0 };
  S.good = (base = 1, perfect = false) => { S.combo++; const m = noMult ? 1 : S.combo >= 16 ? 3 : S.combo >= 8 ? 2 : 1; S.score += (base + (perfect ? 1 : 0)) * m; };
  S.bad = () => { S.combo = 0; };
  return S;
}
function run(game, P, rnd, seconds = 20, assist = 0) {
  const A = 1 - 0.1 * assist, p = Math.min(0.97, P.p + 0.07 * Math.max(0, assist)), stage = (t) => (t < seconds / 3 ? 0 : t < (2 * seconds) / 3 ? 1 : 2);
  const S = scorer(game === 'paddle' || game === 'maze');
  if (game === 'hurdles' || game === 'rings') {
    let t = 0.6;
    const travel = game === 'hurdles' ? 1.78 : 1.95;
    let lastRing = false;
    while (t < seconds) {
      const st = stage(t), arrive = t + travel / (SM[st] * A);
      if (arrive < seconds) {
        const r = rnd();
        if (game === 'hurdles') {
          if (st >= 1 && r < 0.22) { if (rnd() < p) S.good(1); else S.bad(); }
          else if (r < 0.42) { if (rnd() < p * 0.8) S.good(1); }
          else { const tall = st === 2 && rnd() < 0.35; if (rnd() < p) S.good(tall ? 2 : 1, rnd() < P.q); else S.bad(); }
        } else if (lastRing && r < 0.22) { lastRing = false; if (rnd() > p + (1 - p) * 0.5) S.bad(); }
        else { lastRing = true; const gold = rnd() < 0.15; if (rnd() < p) S.good(gold ? 2 : 1, rnd() < P.q * 0.7); else S.bad(); }
      }
      t += (game === 'hurdles' ? 0.8 + rnd() * 0.55 : 0.95 + rnd() * 0.35) / (SM[st] * A);
    }
  } else if (game === 'paddle') {
    let t = 0, strokes = 0;
    while (t < seconds) {
      const B = 0.42 / (SM[stage(t)] * A);
      if (rnd() < p) { strokes += rnd() < Math.min(0.95, P.beat + 0.08 * assist) ? 2 : 1; if (rnd() < P.extra) strokes += 1; }
      while (strokes >= 5) { strokes -= 5; S.good(1); }
      t += B;
    }
  } else if (game === 'climb') {
    let t = 0;
    while (t < seconds) {
      const sp = (2.3 + 0.06 * t) * SM[stage(t)] * A, period = (2 * Math.PI) / sp;
      t += P.react + rnd() * period * 0.5;
      if (t >= seconds) break;
      if (rnd() < p) S.good(rnd() < 0.18 ? 2 : 1, rnd() < P.q * 0.6); else { S.bad(); t += 0.5; }
    }
  } else if (game === 'bugs') {
    let t = 0.6;
    while (t < seconds - 0.4) {
      const st = stage(t), n = st === 2 && rnd() < 0.3 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const r = rnd(), gold = r < 0.08, bee = !gold && r < 0.2;
        if (bee) { if (rnd() < P.bee) S.bad(); continue; }
        if (rnd() < p) S.good(gold ? 3 : 1, rnd() < P.bugQ); else S.bad();
      }
      t += Math.max(0.36, 0.72 - t * 0.012) / (SM[st] * A);
    }
  } else if (game === 'maze') {
    let t = 0, len = 3;
    for (;;) {
      t += 0.6 + (len + 0.35) * (0.5 / (SM[stage(t)] * A)); // the frog shows the path
      let ok = true;
      for (let i = 0; i < len; i++) {
        const dt = P.tap * (0.8 + rnd() * 0.4); t += dt; if (t >= seconds) return S.score;
        if (rnd() < Math.pow(Math.min(0.995, P.mem + 0.02 * assist), 1 + (len - 3) * 0.25)) S.good(1, dt <= 0.5); else { S.bad(); ok = false; t += 0.95 + 0.25; break; }
      }
      if (ok) { S.good(len - 1); len = Math.min(9, len + 1); t += 0.75 + 0.25; }
      if (t >= seconds) break;
    }
  }
  return S.score;
}
function average(game, P, N = 3000, assist = 0) {
  let s = 1; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  let tot = 0, xp = 0;
  const cap = Math.min(D.SCORE_MAX, Math.floor(D.RUN_SECONDS * D.SCORE_RATE) + 1);
  for (let i = 0; i < N; i++) { const sc = Math.min(cap, run(game, P, rnd, D.RUN_SECONDS, assist)); tot += sc; xp += D.baseXp(D.GAME_FOR_SKILL[game], sc, true); }
  return { score: tot / N, xp: xp / N };
}
// Risk it!: after a normal run (score s) the goal is a share of s; the round is 15 s at the very hard
// pace (faster, and the player gets fewer actions right). The chance a player meets the goal.
function riskOdds(game, P, N = 3000) {
  let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const hard = { ...P, p: P.p - 0.1, q: P.q * 0.6, beat: P.beat * 0.7, mem: P.mem - 0.03, bugQ: P.bugQ * 0.7 };
  let won = 0;
  for (let i = 0; i < N; i++) {
    const normal = run(game, P, rnd), goal = D.riskGoal(game, normal);
    if (run(game, hard, rnd, D.RISK.seconds, -10 * (1 - 1 / D.RISK.speed)) >= goal) won++;
  }
  return won / N;
}
module.exports = { run, average, riskOdds, PLAYERS };

if (require.main === module) {
  const games = ['hurdles', 'paddle', 'rings', 'climb', 'bugs', 'maze'];
  console.log('Average score / base XP per 20-second run (before streak, building, mood, egg, catch-up):\n');
  console.log('player      ' + games.map((g) => g.padStart(14)).join('') + '   max/min XP');
  for (const [name, P] of Object.entries(PLAYERS)) {
    const r = games.map((g) => average(g, P));
    const xs = r.map((x) => x.xp);
    console.log(name.padEnd(12) + r.map((x) => `${x.score.toFixed(1)} / ${Math.round(x.xp)}`.padStart(14)).join('') + '   ' + (Math.max(...xs) / Math.min(...xs)).toFixed(2) + 'x');
  }
  console.log('\nRisk it!: the chance to meet the goal (double XP) after a normal run:');
  for (const [name, P] of Object.entries(PLAYERS)) console.log(name.padEnd(12) + games.map((g) => (Math.round(riskOdds(g, P) * 100) + '%').padStart(14)).join(''));
  console.log('\nA struggling player with the quiet help at its strongest (assist 3):');
  const r = games.map((g) => average(g, PLAYERS.struggling, 3000, 3));
  console.log('struggling+3' + r.map((x) => `${x.score.toFixed(1)} / ${Math.round(x.xp)}`.padStart(14)).join(''));
}
