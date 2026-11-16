'use strict';
// JustKingdoms bots. Four personalities (§12): Builder (economy, ages fast), Warlord (army, attacks
// the weakest neighbour), Diplomat (alliances, gifts, the monument), Scholar (science, the rocket).
// Every ~4 s a bot: answers offers, rebalances workers toward its next goal, queues the next
// building from its plan, trains peasants/soldiers/settlers, claims land, researches, and (Warlord,
// or anyone recently attacked) attacks a reachable weaker tile. Bots act through game.actK, so they
// obey exactly the same validation as people.
const D = require('./kingdoms-data');
const { UNITS, BUILDINGS, JOBS, JOB_KEYS, TRACKS } = D;

const PLANS = {
  builder: ['houses', 'lumber', 'castle', 'quarry', 'houses', 'farm', 'barracks', 'castle', 'mine', 'library', 'market', 'houses', 'lumber', 'quarry', 'castle', 'university', 'mine', 'farm', 'stable', 'castle', 'observatory', 'walls', 'tower', 'launchpad'],
  warlord: ['houses', 'lumber', 'castle', 'barracks', 'quarry', 'houses', 'walls', 'castle', 'archery', 'mine', 'barracks', 'houses', 'castle', 'stable', 'workshop', 'library', 'walls', 'castle', 'tower'],
  diplomat: ['houses', 'lumber', 'castle', 'quarry', 'houses', 'barracks', 'castle', 'market', 'mine', 'library', 'houses', 'walls', 'castle', 'university', 'market', 'castle', 'observatory'],
  scholar: ['houses', 'lumber', 'castle', 'quarry', 'houses', 'barracks', 'castle', 'library', 'mine', 'market', 'library', 'houses', 'castle', 'university', 'university', 'castle', 'observatory', 'launchpad'],
};
const RESEARCH = {
  builder: ['economy', 'science', 'war'], warlord: ['war', 'economy', 'science'],
  diplomat: ['economy', 'war', 'science'], scholar: ['science', 'economy', 'war'],
};
const ARMY = { builder: [2, 3], warlord: [4, 5], diplomat: [2, 2], scholar: [2, 2] };
const VALUE = { food: 1, wood: 1, stone: 1.3, gold: 1.6, sci: 2 };

const fresh = (personality) => ({ p: personality, nextAttack: 0, nextAlly: 0, nextGift: 0, nextMsg: 0, decided: new Set() });

// The personality mix for the bots of a game (setting `bots`).
function personalities(n, mix, rng) {
  const all = ['builder', 'warlord', 'diplomat', 'scholar'];
  const pool = mix === 'peaceful' ? ['builder', 'diplomat', 'scholar'] : mix === 'aggressive' ? ['warlord', 'warlord', 'builder', 'scholar'] : all.includes(mix) ? [mix] : all;
  const out = []; for (let i = 0; i < n; i++) out.push(pool[Math.floor(rng() * pool.length)]);
  if ((mix === 'auto' || mix === 'aggressive' || mix == null) && n >= 2 && !out.includes('warlord')) out[Math.floor(rng() * n)] = 'warlord';
  return out;
}

const sumU = (u) => { let n = 0; for (const k in u) n += u[k]; return n; };

// The next building (or castle) from the bot's plan that isn't done yet.
function goal(g, k) {
  const plan = PLANS[k.ai.p] || PLANS.builder, want = {};
  const queued = (b) => k.queue.filter((q) => q.b === b).length;
  if (g.pop(k) >= g.cap(k) - 1 && k.b.houses + queued('houses') < 3) return 'houses';
  for (const b of plan) {
    want[b] = (want[b] || (b === 'castle' ? 1 : 0)) + 1;
    const have = (b === 'castle' ? k.age : k.b[b]) + queued(b);
    if (have >= want[b]) continue;
    const c = g.canBuild(k, b);
    if (c.ok || c.why === 'cost' || c.why === 'queue') return b;
  }
  return k.age < 5 ? 'castle' : null;
}

function assignJobs(g, k, need) {
  const P = k.peasants, open = g.jobsOpen(k), per = {};
  for (const j of JOB_KEYS) if (open[j]) per[j] = Math.max(0.05, g.perWorker(k, j));
  // keep food income just above upkeep; eat into a big stockpile instead of hoarding it
  const net = k.res.food > 400 ? -Math.min(g.upkeep(k), (k.res.food - 400) / 150) : k.res.food < 80 ? 0.6 : 0.25;
  let farmers = Math.ceil(Math.max(0, g.upkeep(k) + net) / per.farm);
  farmers = Math.min(P, Math.max(P > 0 ? 1 : 0, farmers));
  const rest = P - farmers;
  const base = { farm: 10, chop: 30, quarry: 22, mine: 20, study: k.ai.p === 'scholar' ? 45 : 15 };
  const w = {}; let tot = 0;
  for (const j of Object.keys(per)) { const r = JOBS[j].res; w[j] = (need[r] || 0) / per[j] + base[j] * (k.age >= 3 ? 2 : 1); tot += w[j]; }
  const jobs = { farm: farmers, chop: 0, quarry: 0, mine: 0, study: 0 };
  if (rest > 0 && tot > 0) {
    const share = Object.keys(w).map((j) => [j, (rest * w[j]) / tot]);
    let used = 0; for (const [j, x] of share) { const n = Math.floor(x); jobs[j] += n; used += n; }
    share.sort((a, b) => (b[1] % 1) - (a[1] % 1));
    for (let i = 0; used < rest; i = (i + 1) % share.length) { jobs[share[i][0]]++; used++; }
  }
  g.actK(k, { op: 'jobs', ...jobs });
}

function unitPick(g, k) {
  if (k.ai.p === 'warlord' && k.b.workshop && g.room.rng() < 0.25 && g.canTrain(k, 'catapult', 1).ok) return 'catapult';
  const opts = ['guard', 'knight', 'archer', 'spear', 'militia'].filter((u) => { const c = g.canTrain(k, u, 1); return c.ok || c.why === 'cost'; });
  if (!opts.length) return null;
  // a mix: mostly the best, sometimes the second best (counters)
  return opts[Math.min(opts.length - 1, Math.floor(g.room.rng() * 2.2))];
}

function claimTarget(g, k) {
  const W = g.world, inflight = new Set([...g.armies.values()].filter((a) => a.o === k.id && a.order === 'claim').map((a) => a.to));
  let best = null, bestS = -Infinity;
  const low = ['p', 'f', 'h', 'g'].sort((a, b) => k.match[a] - k.match[b])[0];
  for (const i of k.tiles) for (const n of W.tiles[i].nb) {
    const T = W.tiles[n]; if (T.o || inflight.has(n) || !D.TERRAIN[T.t].pass) continue;
    const s = -W.dist(k.home, n) + (T.t === low ? 1.5 : 0) + (T.rich ? 2 : 0) + (T.t === 'r' ? 3 : 0) + (T.t === 'g' && k.age >= 3 ? 1 : 0) + g.room.rng() * 0.5;
    if (s > bestS) { bestS = s; best = n; }
  }
  return best;
}

function attack(g, k, now) {
  const H = g.tile(k.home), mine = {};
  for (const u in H.units) if (!UNITS[u].noFight) mine[u] = H.units[u];
  const total = sumU(mine); if (total < 3) return false;
  const keep = k.ai.p === 'warlord' ? 0.25 : 0.4, send = {};
  for (const u in mine) { const n = Math.floor(mine[u] * (1 - keep)); if (n > 0) send[u] = n; }
  if (!sumU(send)) return false;
  const reach = g.world.reach(k.home, 9);
  let best = null, bestS = -Infinity;
  for (const [i, steps] of reach) {
    const T = g.tile(i); if (!T.o || T.o === k.id || (T.cap && now < g.peaceUntil) || !g.canAttack(k, T.o).ok) continue;
    const def = g.defencePower(T, send), my = g.attackPower(send, k, T);
    if (my < def * 1.3 + 1) continue;
    const s = (T.cap ? 40 : T.v ? 22 : 8) - steps * 2 - def / 10 + g.room.rng() * 3;
    if (s > bestS) { bestS = s; best = i; }
  }
  if (best == null) return false;
  return g.actK(k, { op: 'march', from: k.home, to: best, units: send, order: 'attack' }).ok;
}

function diplomacy(g, k, now) {
  const ai = k.ai, rng = g.room.rng;
  for (const o of g.offers.slice()) {
    if (o.to !== k.id || ai.decided.has(o.id)) continue;
    ai.decided.add(o.id);
    if (o.kind === 'ally') {
      const nb = k.neighbours.includes(o.from);
      const p = { diplomat: nb ? 0.9 : 0.45, builder: nb ? 0.6 : 0.15, scholar: nb ? 0.6 : 0.15, warlord: nb ? 0.3 : 0.05 }[ai.p];
      g.actK(k, { op: 'allyAnswer', from: o.from, yes: rng() < p });
    } else if (o.kind === 'trade') {
      const val = (r) => Object.entries(r).reduce((a, [x, n]) => a + n * VALUE[x], 0);
      const fair = val(o.give) >= 0.9 * val(o.get) && !g.missing(k, o.get);
      g.actK(k, { op: 'tradeAnswer', id: o.id, yes: fair });
    }
  }
  if (ai.decided.size > 60) ai.decided = new Set([...ai.decided].slice(-30));
  if (k.vassalOf) return;
  // propose alliances
  if (now >= ai.nextAlly && k.age >= 2) {
    ai.nextAlly = now + (ai.p === 'diplomat' ? 45000 : 150000) + rng() * 30000;
    const pool = (ai.p === 'diplomat' && rng() < 0.3 ? [...g.k.keys()] : k.neighbours).filter((id) => id !== k.id && !g.allied(id, k.id) && !g.k.get(id).vassalOf);
    if (pool.length && (ai.p === 'diplomat' || rng() < 0.35)) g.actK(k, { op: 'ally', to: pool[Math.floor(rng() * pool.length)] });
  }
  // gifts to allies (Diplomats)
  if (ai.p === 'diplomat' && k.b.market && k.ally && now >= ai.nextGift) {
    ai.nextGift = now + 90000;
    const A = g.alliances.get(k.ally), mates = A ? A.members.filter((x) => x !== k.id) : [];
    const r = ['food', 'wood', 'stone', 'gold'].sort((a, b) => k.res[b] - k.res[a])[0];
    if (mates.length && k.res[r] > 200) g.actK(k, { op: 'gift', to: mates[Math.floor(rng() * mates.length)], res: { [r]: 40 } });
  }
  // the Peace Monument
  if (k.ally && g.modeHas('diplomacy') && k.age >= 3) {
    const n = ai.p === 'diplomat' ? 80 : 40;
    if (k.res.gold >= 150 + n && k.res.stone >= 150 + n) g.actK(k, { op: 'monument', res: { gold: n, stone: n } });
  }
  // the odd betrayal: a Warlord leaves an alliance with a much weaker friend
  if (ai.p === 'warlord' && k.ally && rng() < 0.01) g.actK(k, { op: 'leaveAlly' });
  if (now >= ai.nextMsg && rng() < 0.05) {
    ai.nextMsg = now + 60000;
    const to = k.lastAttacker && g.k.get(k.lastAttacker) && now - k.attackedAt < 60000 ? k.lastAttacker : null;
    g.actK(k, { op: 'message', preset: to ? 'next' : ai.p === 'diplomat' ? 'peace' : ai.p === 'warlord' ? 'watch' : 'deal', to: to || undefined });
  }
}

function turn(g, k, now) {
  const ai = k.ai, rng = g.room.rng;
  diplomacy(g, k, now);
  if (k.vassalOf) { const r = g.rebelInfo(k); if (r && r.can) g.actK(k, { op: 'rebel' }); }
  // building goal & workers
  const gl = goal(g, k), gc = gl ? g.canBuild(k, gl) : null;
  const need = {};
  if (gc && gc.cost) for (const r in gc.cost) need[r] = Math.max(0, gc.cost[r] - k.res[r]);
  if (k.b.launchpad && k.stage < 3) for (const [r, v] of Object.entries(g.rocketCost(k))) need[r] = (need[r] || 0) + Math.max(0, v - k.res[r]) * 0.5;
  need.food = (need.food || 0) + 40;
  assignJobs(g, k, need);
  if (gc && gc.ok && k.queue.length < 2) g.actK(k, { op: 'build', b: gl });
  // research
  if (k.b.library && !k.researching) {
    for (const tr of RESEARCH[ai.p]) { const t = TRACKS[tr].find((x) => !k.techs.has(x)); if (t && g.canResearch(k, t).ok) { g.actK(k, { op: 'research', tech: t }); break; } }
  }
  // rocket
  if (k.b.launchpad && !k.rocket && k.stage < 3) g.actK(k, { op: 'rocket' });
  // training
  const pop = g.pop(k), cap = g.cap(k);
  if (k.training.length < 2 && pop < cap) {
    const qp = k.training.filter((t) => t.u === 'peasant').reduce((a, t) => a + t.n, 0);
    const settlersOut = countKind(g, k, 'settlers');
    const fighters = k.soldiers - settlersOut - countKind(g, k, 'scout');
    const [a0, a1] = ARMY[ai.p] || ARMY.builder;
    const wantA = gl ? Math.min(a0 + a1 * k.age, Math.floor(cap * (ai.p === 'warlord' ? 0.45 : 0.3))) : Math.floor(cap * (ai.p === 'warlord' ? 0.65 : 0.45));
    const wantP = Math.min(4 + 4 * k.age + (ai.p === 'builder' || ai.p === 'scholar' ? 4 : 0), cap - Math.min(fighters, wantA) - 1);
    const wantV = (ai.p === 'warlord' ? 2 : 3) + k.age;
    if (k.age >= 2 && k.villages + settlersOut < wantV && !settlersOut && k.res.food >= 100 && claimTarget(g, k) != null) g.actK(k, { op: 'train', u: 'settlers', n: 1 });
    else if (k.peasants + qp < wantP && k.res.food >= 40) g.actK(k, { op: 'train', u: 'peasant', n: Math.min(2, wantP - k.peasants - qp) });
    else if (fighters < wantA && (ai.p === 'warlord' || rng() < 0.6)) { const u = unitPick(g, k); if (u) g.actK(k, { op: 'train', u, n: Math.min(3, Math.max(1, cap - pop)) }); }
  }
  // grow villages when the people run out of room (or late in the game)
  if ((pop >= cap - 2 || !gl) && k.villages) {
    const v = k.tiles.map((i) => g.tile(i)).filter((T) => T.v > 0 && T.v < 3).sort((a, b) => a.v - b.v)[0];
    if (v) { const c = D.VILLAGE_UP[v.v]; if (k.res.wood >= c.wood + 60 && k.res.stone >= c.stone + 60) g.actK(k, { op: 'upgrade', at: { q: v.q, r: v.r }, what: 'village' }); }
  }
  // settle
  for (const i of k.tiles) if ((g.tile(i).units.settlers || 0) > 0) { const t = claimTarget(g, k); if (t != null) g.actK(k, { op: 'claim', to: t }); break; }
  // gather: soldiers left on captured land walk back to the capital (1 stays on a village)
  if ((g.tickNo >> 2) % 2 === k.seat % 2) for (const i of k.tiles) {
    const T = g.tile(i); if (i === k.home) continue;
    const send = {}; let left = T.v ? 1 : 0;
    for (const u of Object.keys(T.units).filter((x) => !UNITS[x].noFight).sort((a, b) => UNITS[a].def - UNITS[b].def)) { const stay = Math.min(left, T.units[u]); left -= stay; if (T.units[u] - stay > 0) send[u] = T.units[u] - stay; }
    if (sumU(send) >= 1) g.actK(k, { op: 'march', from: i, to: k.home, units: send, order: 'move' });
  }
  // war
  if (k.age >= 2 && now >= ai.nextAttack) {
    const angry = now - k.attackedAt < 90000;
    if (ai.p === 'warlord' || angry || (k.age >= 3 && rng() < 0.12)) {
      ai.nextAttack = now + (ai.p === 'warlord' ? 20000 : 45000) + rng() * 20000;
      attack(g, k, now);
    }
  }
  // market: turn a big surplus into what the goal needs
  if (k.b.market) {
    const short = Object.keys(need).filter((r) => r !== 'sci' && r !== 'food' && need[r] > 0).sort((a, b) => need[b] - need[a])[0];
    const spare = (r) => k.res[r] - ((gc && gc.cost && gc.cost[r]) || 0) - 300;
    const rich = ['food', 'wood', 'stone', 'gold'].filter((r) => r !== short && spare(r) > 300).sort((a, b) => spare(b) - spare(a))[0];
    if (short && rich) g.actK(k, { op: 'market', give: rich, get: short, n: 150 });
  }
}
function countKind(g, k, u) {
  let n = 0; for (const i of k.tiles) n += g.tile(i).units[u] || 0;
  for (const a of g.armies.values()) if (a.o === k.id) n += a.units[u] || 0;
  return n;
}

module.exports = { fresh, personalities, turn, PLANS, goal };
