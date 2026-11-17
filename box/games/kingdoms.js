'use strict';
// JustKingdoms: everyone rules a kingdom on one shared hex world (on the TV) and plays from the
// phone: peasants gather, the castle climbs five ages, armies march, villages spread, and the
// table talks (alliances, gifts, trades, betrayals). Win by conquest, by a peace monument, or by
// launching a rocket; otherwise the best Kingdom Score when time runs out. Design: docs/justkingdoms.md.
//
// Rules decisions where the design doc is vague (keep in sync with the doc when it changes):
// - Land: a capital starts owning its free neighbour tiles (shared ones go to the capital with the
//   fewest). Founding a village claims its tile plus the free passable tiles around it.
//   "matchingTilesOwned" counts owned tiles of the job's terrain; rich (heartland) tiles count 2 and a
//   village on a tile adds its level (the "+1 production slot"). Owning the Ancient Ruins gives
//   +0.6 science/s and +25% science.
// - Jobs: farm and chop always; quarry from Age 2; mine from Age 3; study needs a Library. The
//   buildings (Farm/Lumber Camp/Quarry/Mine) give +20% per level on top.
// - Pop cap = 5 + 4×Houses + 3×(sum of village levels). Units being trained count against it.
//   Upkeep and production both scale with the speed setting. Starving (food 0 and upkeep above
//   income) halves production and, after 30 s, one soldier deserts every 10 s.
// - Building time = [20,20,30,40,50,60][age of the building] s × 1.4^(level−1); age-ups use the
//   doc's times. Costs are paid when queued; cancelling refunds 100% (50% for the one in progress).
// - Units without a building: Peasant, Scout, Militia, Settlers (Age 2). Spearman/Royal Guard need
//   Barracks, Archer Archery Range, Knight Stable, Catapult Workshop. −10% train time per level of
//   the unit's building. Research tiers 1–2 need a Library, tiers 3–4 a University.
// - Beginner's peace: capitals can't be attacked during the first 5 minutes (land and villages can).
// - Watchtower (one level): +10% capital defence, and incoming attacks show on your phone as soon
//   as they march (without one: 15 s before they arrive).
// - Battles: power as in §7. Counter bonus = 1 + (bonus−1) × (share of the enemy's fighting units of
//   the countered kind). Defenders always have a guard: capital 6+2×age, village 3×level.
//   Defence multiplier is additive: 1 + walls×25% (catapults cancel up to half) + watchtower 10%
//   (capital) + capital 20% + hills 15% + Shields 10%. Loser loses everything if its power was under
//   50% of the winner's, otherwise it retreats losing 70%. Winner loses (loser/winner)×70%.
// - Capture: a beaten village/land tile changes owner (village level −1) with the plain land around a
//   village; the attackers stay as its garrison. A beaten capital makes its owner a vassal; the
//   attackers march home. Liege chains count (a vassal's vassals belong to the top liege).
//   You can't attack allies, anyone above you in your liege chain, or your own vassals.
// - Reinforce: the units are handed over to the ally (they become theirs).
// - Rebellion: allowed when your total attack power exceeds your liege's capital defence; success
//   chance 40–90%; failure costs 25% of your capital's fighters; 60 s cooldown either way.
// - Alliances are groups: accepting merges both sides' alliances (monuments add up). Leaving marks
//   you Traitor for 3 minutes and costs the alliance's monument 30%. Becoming a vassal quietly
//   removes you from your alliance. Trades between non-neighbours lose 10% in transit each way.
// - Peace Monument needs 250 gold+stone per kingdom in the world. Rocket stages: 60 s each.
// - Time limit: conquest mode → most capitals held (score breaks ties); other modes → Kingdom Score.
// - Kingdom Score = 2×land + 10×village levels + 5×building levels + 25×(age−1) + army power/10 +
//   15×techs + 60×rocket stages + monument gold+stone/25 + gold/50 + 40×capitals held as vassals.
// - A player who leaves mid-game is replaced by a Builder bot; a player who joins mid-game gets a
//   kingdom on a free spot if the map has one (otherwise watches).
// - "Skip ahead" (next) runs 60 one-second game steps instantly (game time is room time + skew).
// - v2 (docs/justkingdoms.md §13b): pace by time limit, Royal Decrees, auto workers, recall, underdog bonus,
//   rallies, coalition, the Royal Council vote, bounties, a 60 s peace hold, final-minutes call, results().
const D = require('./kingdoms-data');
const M = require('./kingdoms-map');
const AI = require('./kingdoms-ai');

const { RES, UNITS, BUILDINGS, TECHS, JOBS, JOB_KEYS, FIGHTERS, SOLDIERS } = D;
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'mode', label: 'Win by', options: opt([['any', '🌍 Anything goes'], ['conquest', '⚔️ World Domination'], ['diplomacy', '🕊️ World Diplomacy'], ['science', '🚀 Science']]) },
  { key: 'timeLimit', label: 'Time limit', options: opt([[20, '20 minutes'], [30, '30 minutes'], [45, '45 minutes'], [60, '60 minutes']]) },
  { key: 'mapSize', label: 'Map size', options: opt([['auto', 'Auto (fits the players)'], ['small', 'Small (crowded)'], ['large', 'Large (room to grow)']]) },
  { key: 'speed', label: 'Game speed', options: opt([['relaxed', 'Relaxed'], ['normal', 'Normal'], ['fast', 'Fast']]) },
  { key: 'events', label: 'World events', options: opt([[true, 'On'], [false, 'Off']]) },
  { key: 'bots', label: 'Computer players', options: opt([['auto', 'Auto (a mix)'], ['peaceful', 'Peaceful'], ['aggressive', 'Aggressive'], ['builder', 'All Builders'], ['warlord', 'All Warlords'], ['diplomat', 'All Diplomats'], ['scholar', 'All Scholars']]) },
];
const defaults = { mode: 'any', timeLimit: 30, mapSize: 'auto', speed: 'normal', events: true, bots: 'auto' };
const SPEED = { relaxed: 0.7, normal: 1, fast: 1.6 };
const OFFER_TTL = 60000, TRAITOR_MS = 180000, MSG_MS = 8000, BATTLE_SHOW = 8000, REBEL_CD = 60000, SCOUT_TTL = 120000;
const PEACE_MS = 300000;
const EVENT_FIRST = 150000, EVENT_EVERY = 150000, EVENT_JITTER = 60000;
const MARKET_RATE = [0, 3, 2.5, 2];

const sumU = (u) => { let n = 0; for (const k in u) n += u[k]; return n; };
const fightersOf = (u) => { let n = 0; for (const k in u) if (UNITS[k] && !UNITS[k].noFight) n += u[k]; return n; };
const addU = (a, b) => { for (const k in b) if (b[k] > 0) a[k] = (a[k] || 0) + b[k]; return a; };
const clean0 = (u) => { for (const k in u) if (!(u[k] > 0)) delete u[k]; return u; };
const cleanName = (s, n = 24) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const r1 = (x) => Math.round(x * 10) / 10;
const fmtMissing = (miss) => Object.entries(miss).map(([k, v]) => `${Math.ceil(v)} ${D.RES_ICON[k]}`).join(' ');

class Kingdoms {
  constructor(room, settings) {
    this.room = room; this.s = settings; this.phase = 'lobby';
    this.seatOf = new Map(); this.kname = new Map();
    this.k = new Map(); this.world = null; this.armies = new Map(); this.armySeq = 0;
    this.ticker = []; this.tickSeq = 0; this.battles = []; this.offers = []; this.offerSeq = 0;
    this.alliances = new Map(); this.allySeq = 0; this.skew = 0; this.tickNo = 0; this.alertSeq = 0;
    this.event = null; this.nextEventAt = 0; this.winner = null; this.awards = null; this.standings = null;
    this.timer = null; this.errors = 0; this.peaceUntil = 0; this.startAt = 0; this.endAt = 0;
    this.council = null; this.nextCouncilAt = 0; this.councilSeq = 0; this.lastMotion = 'sanction';
    this.bounties = []; this.bountySeq = 0; this.wars = new Map(); this.peaceHoldUntil = 0; this.finalWarned = false;
    this.firstAge = {}; this.marked = null; this.leaderScore = 0;
  }
  // Age, monument and rocket costs follow the time limit (D.PACE).
  pace() { return D.PACE[this.s.timeLimit] || Math.max(0.6, Math.min(1.8, Number(this.s.timeLimit) / 30 || 1)); }
  avatarOf(id) { const p = this.room.get(id), a = p && p.avatar; return typeof a === 'string' && a.length <= 16 && !/[<>&"]/.test(a) ? a : null; }
  // Production multiplier: the underdog bonus (comeback) and council sanctions.
  prodMult(k, now = this.now()) { return (1 + (k.underdog || 0)) * (k.sanctionUntil > now ? 0.7 : 1); }
  now() { return this.room.now() + this.skew; }
  speed() { return SPEED[this.s.speed] || 1; }
  log(text, kind = 'info') { this.ticker.push({ id: ++this.tickSeq, text, kind }); if (this.ticker.length > 14) this.ticker.shift(); }
  alert(k, text, kind = 'info') { if (!k) return; k.alerts.push({ id: ++this.alertSeq, text, kind, at: this.now() }); if (k.alerts.length > 15) k.alerts.shift(); }
  tile(i) { return this.world.tiles[i]; }
  kn(id) { const k = this.k.get(id); return k ? k.name : '—'; }
  modeHas(m) { return this.s.mode === 'any' || this.s.mode === m; }

  // ---------- lobby ----------
  joined(p) { if (this.phase === 'play' && !this.k.has(p.id)) this.spawn(p); }
  left(p) {
    if (this.phase === 'lobby') { this.seatOf.delete(p.id); return; }
    const k = this.k.get(p.id); if (!k) return;
    k.gone = true; if (!k.ai) { k.ai = AI.fresh('builder'); this.log(`🤖 ${k.name} is now run by a steward.`); }
  }
  seatList() {
    if (this.phase !== 'lobby') return [...this.k.values()].map((k) => ({ id: k.id, name: this.room.name(k.id), color: k.color, seat: k.seat, avatar: this.avatarOf(k.id) }));
    return this.room.list().map((p) => ({ id: p.id, name: p.name, color: p.color, seat: this.seatOf.has(p.id) ? this.seatOf.get(p.id) : null, avatar: this.avatarOf(p.id) }));
  }
  defaultName(p) { return cleanName(p.name.replace(/ 🤖$/, ''), 16) + "'s Kingdom"; }

  start() {
    const players = this.room.list(), N = players.length;
    const bySeat = new Array(N).fill(null);
    for (const p of players) { const s = this.seatOf.get(p.id); if (Number.isInteger(s) && s >= 0 && s < N && !bySeat[s]) bySeat[s] = p; }
    const free = []; bySeat.forEach((x, i) => { if (!x) free.push(i); });
    for (const p of players) if (!bySeat.includes(p)) bySeat[free.shift()] = p;
    const { world, homes } = M.generate(N, this.room.rng, this.s.mapSize);
    this.world = world;
    const mix = AI.personalities(bySeat.filter((p) => p.bot).length, this.s.bots, this.room.rng);
    let bi = 0;
    bySeat.forEach((p, seat) => this.makeKingdom(p, seat, homes[seat], p.bot ? mix[bi++] : null));
    // starting land: free neighbours of each capital; shared ones go to the capital with the fewest.
    const owners = new Map();
    for (const h of homes) for (const nb of this.tile(h).nb) { const T = this.tile(nb); if (T.cap || !M.passable(T.t)) continue; if (!owners.has(nb)) owners.set(nb, []); owners.get(nb).push(this.tile(h).cap); }
    const count = new Map();
    for (const [i, ids] of [...owners].sort((a, b) => a[1].length - b[1].length)) {
      const id = ids.slice().sort((a, b) => (count.get(a) || 0) - (count.get(b) || 0))[0];
      this.tile(i).o = id; count.set(id, (count.get(id) || 0) + 1);
    }
    const ks = bySeat.map((p) => this.k.get(p.id));
    if (N >= 2) ks.forEach((k, i) => { k.neighbours = [...new Set([ks[(i + 1) % N].id, ks[(i - 1 + N) % N].id])].filter((x) => x !== k.id); });
    this.phase = 'play'; this.startAt = this.now(); this.endAt = this.startAt + this.s.timeLimit * 60000;
    this.nextEventAt = this.startAt + EVENT_FIRST; this.peaceUntil = this.startAt + PEACE_MS; this.nextCouncilAt = this.startAt + D.COUNCIL_FIRST;
    this.census();
    this.log('🏰 The kingdoms awaken. Gather, build, and grow!');
    this.tick();
  }
  makeKingdom(p, seat, home, personality) {
    const T = this.tile(home);
    const k = {
      id: p.id, name: this.kname.get(p.id) || this.defaultName(p), color: p.color, seat, home, age: 1,
      res: { food: 50, wood: 50, stone: 0, gold: 0, sci: 0 }, peasants: 3, jobs: { farm: 1, chop: 0, quarry: 0, mine: 0, study: 0 },
      b: Object.fromEntries(Object.keys(BUILDINGS).map((x) => [x, 0])), queue: [], training: [], techs: new Set(), researching: null,
      vassalOf: null, ally: null, traitorUntil: 0, msg: null, msgAt: -1e12, stage: 0, rocket: null, alerts: [], scouted: new Map(),
      neighbours: [], ai: personality ? AI.fresh(personality) : null, gone: false, rebelAt: -1e12, attackedAt: -1e12, starveSince: 0,
      stats: { built: 0, kills: 0, lost: 0, gifts: 0, alliances: 0, betrayals: 0, battles: 0, won: 0, sci: 0, monument: 0, villages: 0, captures: 0, peakPower: 0, tribute: 0, trades: 0, bounties: 0, comebacks: 0 },
      rates: {}, match: { p: 0, f: 0, h: 0, g: 0 }, land: 0, vlevels: 0, villages: 0, soldiers: 0, fighters: 0, power: 0, score: 0, ruins: false, tiles: [],
      decree: 0, sanctionUntil: 0, underdog: 0, rallies: 0,
    };
    k.b.farm = 1;
    T.o = p.id; T.cap = p.id; T.v = 0; T.units = {};
    this.k.set(p.id, k);
    return k;
  }
  // Someone joins mid-game: a new capital on a free spot (all neighbours free, ≥3 from other capitals).
  spawn(p) {
    const caps = [...this.k.values()].map((k) => k.home);
    const spot = this.world.tiles.find((T) => !T.o && M.passable(T.t) && T.t !== 'r' && T.nb.length === 6 && T.nb.every((n) => !this.tile(n).o && M.passable(this.tile(n).t)) && caps.every((c) => this.world.dist(c, T.i) >= 3));
    if (!spot) { this.log(`👀 ${p.name} is watching (the world is full).`); return null; }
    const k = this.makeKingdom(p, this.k.size, spot.i, p.bot ? 'builder' : null);
    spot.t = 'p'; for (const n of spot.nb) this.tile(n).o = p.id;
    this.log(`🏰 A new kingdom rises: ${k.name}!`, 'build'); this.room.fx('kingdom', { id: p.id });
    this.census();
    return k;
  }

  // ---------- the clock ----------
  tick() {
    this.timer = this.room.after(1000, () => {
      if (this.phase !== 'play') return;
      this.step();
      if (this.phase === 'play') this.tick();
    });
  }
  next() {
    if (this.phase !== 'play') return;
    for (let i = 0; i < 60 && this.phase === 'play'; i++) { this.skew += 1000; this.step(); }
    this.log('⏩ The world skipped ahead a minute.');
  }
  step() {
    const now = this.now(); this.tickNo++;
    try {
      this.census();
      for (const k of this.k.values()) this.produce(k, now);
      for (const k of this.k.values()) this.runQueues(k, now);
      this.moveArmies(now);
      this.housekeeping(now);
      this.runEvents(now);
      this.runCouncil(now);
      for (const k of this.k.values()) this.checkDecree(k);
      if (!this.finalWarned && this.endAt - now <= 180000 && this.s.timeLimit >= 20) {
        this.finalWarned = true; this.log('⏳ Final 3 minutes! The best Kingdom Score wins if nobody gets there first.', 'win'); this.room.fx('final', {});
        for (const k of this.k.values()) this.alert(k, '⏳ Final 3 minutes! Grab land, finish your wonder, or strike now.', 'info');
      }
      for (const k of this.k.values()) if (k.ai && (this.tickNo + k.seat) % 4 === 0 && this.phase === 'play') AI.turn(this, k, now);
      this.checkWin(now);
    } catch (e) { this.errors++; this.lastError = e; if (this.errors < 5) console.error('[kingdoms] step failed:', e); }
  }

  // Recount land, terrain matches, soldiers, power and score (O(tiles + armies)).
  census() {
    for (const k of this.k.values()) { k.match = { p: 0, f: 0, h: 0, g: 0 }; k.land = 0; k.vlevels = 0; k.villages = 0; k.soldiers = 0; k.fighters = 0; k.power = 0; k.ruins = false; k.tiles = []; }
    for (const T of this.world.tiles) {
      if (!T.o) continue; const k = this.k.get(T.o); if (!k) continue;
      k.land++; k.tiles.push(T.i);
      if (k.match[T.t] != null) k.match[T.t] += (T.rich ? 2 : 1) + T.v;
      if (T.v) { k.villages++; k.vlevels += T.v; }
      if (T.t === 'r') k.ruins = true;
      for (const u in T.units) { k.soldiers += T.units[u]; if (!UNITS[u].noFight) k.fighters += T.units[u]; k.power += T.units[u] * (UNITS[u].atk + UNITS[u].def); }
    }
    for (const a of this.armies.values()) { const k = a.o && this.k.get(a.o); if (!k) continue; for (const u in a.units) { k.soldiers += a.units[u]; if (!UNITS[u].noFight) k.fighters += a.units[u]; k.power += a.units[u] * (UNITS[u].atk + UNITS[u].def); } }
    const vassals = this.vassalCounts();
    for (const k of this.k.values()) {
      k.stats.peakPower = Math.max(k.stats.peakPower, k.power);
      const blv = Object.values(k.b).reduce((a, b) => a + b, 0);
      const mon = k.stats.monument;
      k.capitals = 1 + (vassals.get(k.id) || 0);
      k.score = Math.round(2 * k.land + 10 * k.vlevels + 5 * blv + 25 * (k.age - 1) + k.power / 10 + 15 * k.techs.size + 60 * k.stage + mon / 25 + k.res.gold / 50 + 40 * (vassals.get(k.id) || 0));
    }
    this.comeback();
  }
  // Comebacks: kingdoms far behind the leader produce more (up to +40%), and a runaway leader is
  // marked: everyone else gets +20% attack against their land (the coalition).
  comeback() {
    const ks = [...this.k.values()]; if (ks.length < 2 || this.phase !== 'play') { for (const k of ks) k.underdog = 0; return; }
    const sorted = ks.slice().sort((a, b) => b.score - a.score), lead = sorted[0], second = sorted[1];
    this.leaderScore = lead.score;
    const early = this.now() - this.startAt < 180000;
    for (const k of ks) { const ratio = k.score / Math.max(1, lead.score); k.underdog = early ? 0 : Math.round(Math.max(0, Math.min(0.4, (0.75 - ratio) * 0.8)) * 100) / 100; }
    let mark = null;
    if (ks.length >= 3 && !early) {
      const byCap = ks.slice().sort((a, b) => b.capitals - a.capitals || b.score - a.score)[0];
      if (byCap.capitals >= 3 && byCap.capitals >= Math.ceil(ks.length * 0.3)) mark = byCap.id;
      else if (this.now() - this.startAt > 600000 && lead.score >= 1.6 * Math.max(1, second.score) && lead.score >= 150) mark = lead.id;
    }
    if (mark && this.marked !== mark && this.lastMarkLog !== mark) {
      const m = this.k.get(mark); this.lastMarkLog = mark;
      this.log(`🎯 The world unites against ${m.name}! Everyone gets +20% attack against them.`, 'war'); this.room.fx('coalition', { id: mark });
      for (const k of ks) this.alert(k, k.id === mark ? '🎯 You lead by far, so the world has united against you: they get +20% attack on your land!' : `🎯 Coalition! You get +20% attack against ${m.name}.`, k.id === mark ? 'bad' : 'info');
    }
    this.marked = mark;
  }
  pop(k) { let q = 0; for (const t of k.training) q += t.n; return k.peasants + k.soldiers + q; }
  cap(k) { return 5 + 4 * k.b.houses + 3 * k.vlevels; }
  top(k) { let x = k, n = 0; while (x.vassalOf && n++ < 200) { const l = this.k.get(x.vassalOf); if (!l) break; x = l; } return x; }
  chain(k) { const out = []; let x = k, n = 0; while (x.vassalOf && n++ < 200) { out.push(x.vassalOf); x = this.k.get(x.vassalOf); if (!x) break; } return out; }
  vassalCounts() { const m = new Map(); for (const k of this.k.values()) for (const id of this.chain(k)) m.set(id, (m.get(id) || 0) + 1); return m; }
  allied(a, b) { if (!a || !b || a === b) return false; const A = this.k.get(a), B = this.k.get(b); return !!(A && B && A.ally && A.ally === B.ally); }

  // ---------- economy ----------
  jobsOpen(k) { return { farm: true, chop: true, quarry: k.age >= 2, mine: k.age >= 3, study: k.b.library > 0 }; }
  perWorker(k, job) {
    const J = JOBS[job], sp = this.speed();
    if (job === 'study') {
      let m = D.STUDY_YIELD * (1 + 0.2 * k.b.library) * (1 + 0.4 * k.b.university) * (k.b.observatory ? 1.25 : 1) * (k.ruins ? 1.25 : 1);
      if (k.techs.has('writing')) m *= 1.2; if (k.techs.has('astronomy')) m *= 1.2;
      return m * sp;
    }
    let tiles = k.match[J.terrain] || 0;
    if (J.terrain === 'g' && this.event && this.event.kind === 'goldrush') tiles *= 2;
    let m = D.BASE_YIELD * (1 + D.TILE_BONUS * tiles) * (1 + 0.2 * (k.b[J.bld] || 0));
    if (job === 'farm' && k.techs.has('plows')) m *= 1.15;
    if (job === 'chop' && k.techs.has('saws')) m *= 1.15;
    if (job === 'mine' && k.techs.has('banking')) m *= 1.2;
    return m * sp;
  }
  upkeep(k) { return (D.FOOD_PEASANT * k.peasants + D.FOOD_SOLDIER * k.soldiers) * this.speed(); }
  produce(k, now) {
    const starving = k.res.food <= 0.001 && k.starving;
    const gain = { food: 0, wood: 0, stone: 0, gold: 0, sci: 0 };
    for (const j of JOB_KEYS) if (k.jobs[j] > 0) gain[JOBS[j].res] += k.jobs[j] * this.perWorker(k, j);
    if (k.ruins) gain.sci += 0.6 * this.speed();
    const pm = this.prodMult(k, now); if (pm !== 1) for (const r in gain) gain[r] *= pm;
    if (starving) for (const r in gain) gain[r] *= 0.5;
    const liege = k.vassalOf && this.k.get(k.vassalOf);
    if (liege) for (const r of ['food', 'wood', 'stone', 'gold']) { const t = gain[r] * 0.25; gain[r] -= t; liege.res[r] += t; liege.stats.tribute += t; }
    const up = this.upkeep(k);
    for (const r of RES) k.res[r] += gain[r];
    k.res.food -= up;
    k.starving = k.res.food <= 0 && up > gain.food;
    if (k.res.food < 0) k.res.food = 0;
    k.rates = { food: r1(gain.food - up), wood: r1(gain.wood), stone: r1(gain.stone), gold: r1(gain.gold), sci: r1(gain.sci) };
    k.stats.sci += gain.sci;
    if (k.starving) {
      if (!k.starveSince) { k.starveSince = now; this.alert(k, '🍞 Your people are starving! Production is halved. Put more peasants on farms.', 'bad'); }
      else if (now - k.starveSince >= 30000 && (now - k.starveSince) % 10000 < 1000) this.desert(k);
    } else k.starveSince = 0;
  }
  desert(k) {
    const T = this.tile(k.home); const u = Object.keys(T.units).find((x) => !UNITS[x].noFight) || Object.keys(T.units)[0];
    if (u) { T.units[u]--; clean0(T.units); this.alert(k, `🏃 A hungry ${UNITS[u].name} deserted.`, 'bad'); }
  }
  costOf(k, base, mult = 1) {
    const out = {};
    for (const r in base) { let v = base[r] * mult; if (r === 'stone' && k.techs.has('masonry')) v *= 0.85; out[r] = Math.round(v); }
    return out;
  }
  missing(k, cost) { const m = {}; for (const r in cost) if (k.res[r] + 1e-9 < cost[r]) m[r] = cost[r] - k.res[r]; return Object.keys(m).length ? m : null; }
  pay(k, cost, f = 1) { for (const r in cost) k.res[r] -= cost[r] * f; }
  refund(k, cost, f = 1) { for (const r in cost) k.res[r] += cost[r] * f; }
  needRes(k, cost) { const m = this.missing(k, cost); return m ? { ok: false, error: `Not enough resources: need ${fmtMissing(m)} more.`, missing: m } : null; }

  // What the next level of a building (or the castle) costs and whether it can be queued now.
  canBuild(k, b) {
    if (b === 'castle') {
      const next = k.age + 1 + k.queue.filter((q) => q.b === 'castle').length;
      if (next > 5) return { ok: false, error: 'Your castle is already at the last age.', why: 'max' };
      const A = D.AGES[next], cost = this.costOf(k, A.cost, next >= 3 ? this.pace() : 1), time = A.time / this.speed();
      if (next > k.age + 1) return { ok: false, error: 'The next age is already being built.', why: 'queued', cost, time, next };
      if (k.queue.length >= D.BUILD_QUEUE) return { ok: false, error: 'Your build queue is full (3).', why: 'queue', cost, time, next };
      return this.needRes(k, cost) ? { ...this.needRes(k, cost), cost, time, next, why: 'cost' } : { ok: true, cost, time, next };
    }
    const B = BUILDINGS[b]; if (!B) return { ok: false, error: 'Unknown building.', why: 'unknown' };
    const lvl = k.b[b] + k.queue.filter((q) => q.b === b).length, next = lvl + 1;
    const cost = this.costOf(k, B.cost, Math.pow(D.COST_GROWTH, lvl) * (B.science ? this.pace() : 1)), time = D.BUILD_TIME[B.age] * Math.pow(D.TIME_GROWTH, lvl) / this.speed();
    const max = b === 'walls' ? B.max + (k.techs.has('engineering') ? 1 : 0) : B.max;
    if (B.science && !this.modeHas('science')) return { ok: false, error: 'The Launch Pad is only for the science win.', why: 'mode', cost, time, next };
    if (k.age < B.age) return { ok: false, error: `${B.name} needs Age ${B.age} (${D.AGES[B.age].name}).`, why: 'age', cost, time, next };
    if (lvl >= max) return { ok: false, error: `${B.name} is already at its top level.`, why: 'max', cost, time, next };
    if (B.needTech && !k.techs.has(B.needTech)) return { ok: false, error: `${B.name} needs the ${TECHS[B.needTech].name} research.`, why: 'tech', cost, time, next };
    if (k.queue.length >= D.BUILD_QUEUE) return { ok: false, error: 'Your build queue is full (3).', why: 'queue', cost, time, next };
    const nr = this.needRes(k, cost); if (nr) return { ...nr, why: 'cost', cost, time, next };
    return { ok: true, cost, time, next };
  }
  build(k, b) {
    const c = this.canBuild(k, b); if (!c.ok) return c;
    this.pay(k, c.cost);
    k.queue.push({ b, lvl: c.next, cost: c.cost, dur: Math.round(c.time * 1000), end: 0 });
    if (k.queue.length === 1) k.queue[0].end = this.now() + k.queue[0].dur;
    return { ok: true };
  }
  canTrain(k, u, n = 1) {
    const U = UNITS[u]; if (!U) return { ok: false, error: 'Unknown unit.', why: 'unknown' };
    if (!Number.isInteger(n) || n < 1 || n > 50) return { ok: false, error: 'Train between 1 and 50 at a time.', why: 'count' };
    const cost = this.costOf(k, U.cost, n), lvl = U.bld ? k.b[U.bld] : 0;
    const time = U.time * (1 - 0.1 * lvl) / this.speed();
    if (k.age < U.age) return { ok: false, error: `${U.name} needs Age ${U.age} (${D.AGES[U.age].name}).`, why: 'age', cost, time };
    if (U.bld && !k.b[U.bld]) return { ok: false, error: `${U.name} needs a ${BUILDINGS[U.bld].name}.`, why: 'building', cost, time };
    if (k.training.length >= D.TRAIN_QUEUE) return { ok: false, error: 'Your training queue is full (5).', why: 'queue', cost, time };
    if (this.pop(k) + n > this.cap(k)) return { ok: false, error: `Not enough room: population ${this.pop(k)}/${this.cap(k)}. Build Houses or villages.`, why: 'pop', cost, time };
    const nr = this.needRes(k, cost); if (nr) return { ...nr, why: 'cost', cost, time };
    return { ok: true, cost, time };
  }
  train(k, u, n) {
    const c = this.canTrain(k, u, n); if (!c.ok) return c;
    this.pay(k, c.cost);
    k.training.push({ u, n, cost: this.costOf(k, UNITS[u].cost), dur: Math.round(c.time * 1000), end: 0 });
    if (k.training.length === 1) k.training[0].end = this.now() + k.training[0].dur;
    return { ok: true };
  }
  canResearch(k, t) {
    const T = TECHS[t]; if (!T) return { ok: false, error: 'Unknown research.', why: 'unknown' };
    const cost = { sci: D.TECH_COST[T.tier] }, time = D.TECH_TIME[T.tier] * (1 - 0.15 * k.b.university) / this.speed();
    if (k.techs.has(t)) return { ok: false, error: 'Already researched.', why: 'done', cost, time };
    if (!k.b.library) return { ok: false, error: 'Research needs a Library (Age 3).', why: 'building', cost, time };
    if (T.tier >= 2 && !k.b.university) return { ok: false, error: 'This research needs a University (Age 4).', why: 'building', cost, time };
    if (T.needBld && !k.b[T.needBld]) return { ok: false, error: `${T.name} needs an ${BUILDINGS[T.needBld].name}.`, why: 'building', cost, time };
    const prev = D.TRACKS[T.track][T.tier - 1];
    if (prev && !k.techs.has(prev)) return { ok: false, error: `Research ${TECHS[prev].name} first.`, why: 'order', cost, time };
    if (k.researching) return { ok: false, error: 'Already researching something.', why: 'busy', cost, time };
    const nr = this.needRes(k, cost); if (nr) return { ...nr, why: 'cost', cost, time };
    return { ok: true, cost, time };
  }
  runQueues(k, now) {
    for (let guard = 0; k.queue.length && k.queue[0].end && now >= k.queue[0].end && guard < 5; guard++) {
      const q = k.queue.shift();
      if (q.b === 'castle') {
        k.age = q.lvl; const A = D.AGES[k.age];
        const first = !this.firstAge[k.age]; if (first) this.firstAge[k.age] = k.id;
        this.log(first && k.age >= 3 ? `🥇 ${k.name} is the first to reach Age ${k.age}: ${A.name}!` : `${A.icon} ${k.name} reached Age ${k.age}: ${A.name}!`, 'build'); this.room.fx('age', { id: k.id, age: k.age, first });
        this.alert(k, `${A.icon} Welcome to the ${A.name} age! New buildings and units unlocked.`, 'good');
      } else {
        k.b[q.b] = q.lvl; k.stats.built++;
        if (q.b === 'launchpad') { this.log(`🚀 ${k.name} built a Launch Pad!`, 'build'); this.room.fx('launchpad', { id: k.id }); }
        this.alert(k, `${BUILDINGS[q.b].icon} ${BUILDINGS[q.b].name}${q.lvl > 1 ? ' level ' + q.lvl : ''} is ready.`, 'good');
      }
      if (k.queue.length) k.queue[0].end = now + k.queue[0].dur;
    }
    for (let guard = 0; k.training.length && k.training[0].end && now >= k.training[0].end && guard < 20; guard++) {
      const t = k.training[0];
      if (t.u === 'peasant') k.peasants++; else { const H = this.tile(k.home); H.units[t.u] = (H.units[t.u] || 0) + 1; }
      t.n--;
      if (t.n <= 0) { k.training.shift(); if (k.training.length) k.training[0].end = now + k.training[0].dur; } else t.end = t.end + t.dur;
    }
    if (k.researching && now >= k.researching.end) {
      const t = k.researching.tech; k.techs.add(t); k.researching = null;
      this.alert(k, `${TECHS[t].icon} Research done: ${TECHS[t].name}.`, 'good');
      if (t === 'rocketry') this.log(`🚀 ${k.name} mastered Rocketry!`, 'build');
    }
    if (k.rocket && now >= k.rocket.end) {
      k.stage = k.rocket.stage; k.rocket = null;
      this.room.fx('rocket', { id: k.id, stage: k.stage });
      if (k.stage >= 3) { this.log(`🚀🚀🚀 ${k.name} LAUNCHED THE ROCKET!`, 'win'); this.room.fx('launch', { id: k.id }); this.end('science', [k.id]); }
      else this.log(`🚀 ${k.name} finished rocket stage ${k.stage} of 3!`, 'build');
    }
  }

  // ---------- armies ----------
  stepTime(k, units, path) {
    let slow = 0; for (const u in units) if (units[u] > 0) slow = Math.max(slow, UNITS[u].speed);
    let t = 0;
    for (const i of path) { const o = this.tile(i).o; t += slow * (k && o && (o === k.id || this.allied(o, k.id)) ? 0.75 : 1); }
    if (k && k.techs.has('logistics')) t *= 0.8;
    return t * 1000;
  }
  dispatch(k, from, to, units, order, path) {
    path = path || this.world.path(from, to); if (!path) return null;
    const now = this.now(), id = 'a' + (++this.armySeq);
    const a = { id, o: k ? k.id : null, from, to, path, units: clean0({ ...units }), order, t0: now, t1: now + Math.max(1000, this.stepTime(k, units, path)) };
    this.armies.set(id, a);
    return a;
  }
  canAttack(k, targetId) {
    if (!targetId || targetId === k.id) return { ok: false, error: 'That is your own land.' };
    const t = this.k.get(targetId); if (!t) return { ok: false, error: 'Unknown kingdom.' };
    if (this.allied(k.id, targetId)) return { ok: false, error: `${t.name} is your ally. Leave the alliance first.` };
    if (this.chain(k).includes(targetId)) return { ok: false, error: 'You can’t attack your liege. Rebel first!' };
    if (this.chain(t).includes(k.id)) return { ok: false, error: `${t.name} is already your vassal.` };
    return { ok: true };
  }
  parseTile(x) {
    if (!this.world || x == null) return null;
    let q, r;
    if (Array.isArray(x)) [q, r] = x; else if (typeof x === 'object') ({ q, r } = x); else if (typeof x === 'string' && x.includes(',')) [q, r] = x.split(',').map(Number); else if (typeof x === 'number') return this.world.tiles[x] ? x : null;
    q = Number(q); r = Number(r); if (!Number.isInteger(q) || !Number.isInteger(r)) return null;
    const i = this.world.index.get(M.key(q, r)); return i == null ? null : i;
  }
  cleanUnits(m) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return { error: 'Pick some units to send.' };
    const out = {};
    for (const [u, v] of Object.entries(m)) {
      const n = Number(v);
      if (!UNITS[u]) return { error: 'Unknown unit.' };
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return { error: 'Unit counts must be whole numbers.' };
      if (n === 0) continue;
      if (u === 'peasant') return { error: 'Peasants work the fields; they can’t march.' };
      out[u] = n;
    }
    if (!sumU(out)) return { error: 'Pick some units to send.' };
    return { units: out };
  }
  adjacentToLand(k, i) { return this.tile(i).nb.some((n) => this.tile(n).o === k.id); }
  march(k, m) {
    const from = m.from == null ? k.home : this.parseTile(m.from), to = this.parseTile(m.to);
    if (from == null) return { ok: false, error: 'Pick a tile to march from.' };
    if (to == null) return { ok: false, error: 'Pick a target tile.' };
    if (from === to) return { ok: false, error: 'The army is already there.' };
    const F = this.tile(from), T = this.tile(to);
    if (F.o !== k.id) return { ok: false, error: 'You can only march from your own land.' };
    const cu = this.cleanUnits(m.units); if (cu.error) return { ok: false, error: cu.error };
    for (const [u, n] of Object.entries(cu.units)) if ((F.units[u] || 0) < n) return { ok: false, error: `You only have ${F.units[u] || 0} ${UNITS[u].name} there.` };
    if (!M.passable(T.t)) return { ok: false, error: 'Armies can’t cross lakes or mountains.' };
    const units = cu.units, onlyScouts = Object.keys(units).every((u) => u === 'scout');
    let order = m.order;
    if (order == null) order = onlyScouts && T.o !== k.id ? 'scout' : T.o === k.id ? 'move' : T.o && this.allied(T.o, k.id) ? 'reinforce' : !T.o && units.settlers ? 'claim' : 'attack';
    switch (order) {
      case 'move': if (T.o !== k.id) return { ok: false, error: 'You can only move to your own land.' }; break;
      case 'claim':
        if (!units.settlers) return { ok: false, error: 'Claiming land needs Settlers.' };
        if (T.o) return { ok: false, error: 'That tile already belongs to someone.' };
        if (!this.adjacentToLand(k, to)) return { ok: false, error: 'Settlers can only claim a free tile next to your land.' };
        break;
      case 'attack': {
        if (T.o === k.id) return { ok: false, error: 'That is your own land.' };
        if (T.o) { const c = this.canAttack(k, T.o); if (!c.ok) return c; }
        if (T.cap && this.now() < this.peaceUntil) return { ok: false, error: `Capitals are protected for the first 5 minutes (${Math.ceil((this.peaceUntil - this.now()) / 1000)} s left).` };
        if (!fightersOf(units)) return { ok: false, error: 'Send some soldiers to attack.' };
        break;
      }
      case 'reinforce': if (!T.o || !this.allied(T.o, k.id)) return { ok: false, error: 'You can only reinforce an ally.' }; break;
      case 'scout': if (!onlyScouts) return { ok: false, error: 'Only Scouts can scout.' }; if (T.o === k.id) return { ok: false, error: 'That is your own land.' }; break;
      default: return { ok: false, error: 'Unknown order.' };
    }
    const path = this.world.path(from, to); if (!path) return { ok: false, error: 'There’s no way through to that tile.' };
    for (const [u, n] of Object.entries(units)) F.units[u] -= n; clean0(F.units);
    const a = this.dispatch(k, from, to, units, order, path);
    if (order === 'attack' && T.o) { const t = this.k.get(T.o); this.alert(t, `⚔️ ${k.name} is marching on your ${T.cap ? 'capital' : T.v ? 'village' : 'land'}!`, 'bad'); }
    return { ok: true, army: a.id, eta: a.t1 - a.t0 };
  }
  goHome(a, units) {
    clean0(units); if (!sumU(units)) return;
    const k = this.k.get(a.o); if (!k) return;
    if (a.to === k.home) { addU(this.tile(k.home).units, units); return; }
    const b = this.dispatch(k, a.to, k.home, units, 'return');
    if (!b) addU(this.tile(k.home).units, units);
  }
  moveArmies(now) {
    const due = []; for (const a of this.armies.values()) if (now >= a.t1) due.push(a);
    due.sort((x, y) => x.t1 - y.t1);
    for (const a of due) { this.armies.delete(a.id); this.arrive(a, now); }
  }
  arrive(a, now) {
    const T = this.tile(a.to), k = a.o ? this.k.get(a.o) : null;
    if (!a.o) return this.battle(a, T, now);
    if (!k) return;
    switch (a.order) {
      case 'return': addU(this.tile(k.home).units, a.units); return;
      case 'move': if (T.o === k.id) addU(T.units, a.units); else this.goHome(a, a.units); return;
      case 'claim':
        if (!T.o && this.adjacentToLand(k, T.i)) {
          T.o = k.id; T.v = 1; T.w = 0; a.units.settlers--; clean0(a.units); T.units = addU({}, a.units);
          for (const n of T.nb) { const N = this.tile(n); if (!N.o && M.passable(N.t) && !sumU(N.units)) N.o = k.id; }
          k.stats.villages++;
          this.log(`🏡 ${k.name} founded a new village.`, 'build'); this.room.fx('village', { id: k.id, q: T.q, r: T.r });
          this.alert(k, '🏡 Your settlers founded a new village!', 'good');
        } else if (T.o === k.id) addU(T.units, a.units);
        else { this.alert(k, '🛻 Your settlers found that land taken and turned back.'); this.goHome(a, a.units); }
        return;
      case 'reinforce':
        if (T.o && this.allied(T.o, k.id)) {
          addU(T.units, a.units); const t = this.k.get(T.o); k.stats.gifts++;
          this.alert(t, `🛡️ ${k.name} sent you ${sumU(a.units)} soldiers.`, 'good'); this.log(`🛡️ ${k.name} reinforced ${t.name}.`, 'diplo');
        } else this.goHome(a, a.units);
        return;
      case 'scout':
        if (T.o && T.o !== k.id) { k.scouted.set(T.i, { units: { ...T.units }, at: now }); this.alert(k, `🔭 Scouts report from ${this.kn(T.o)}: ${sumU(T.units) ? Object.entries(T.units).map(([u, n]) => `${n} ${UNITS[u].name}`).join(', ') : 'no soldiers'}.`); }
        this.goHome(a, a.units); return;
      case 'attack':
        if (T.o === k.id) { addU(T.units, a.units); return; }
        if (T.o && !this.canAttack(k, T.o).ok) { this.goHome(a, a.units); return; }
        return this.battle(a, T, now);
      default: this.goHome(a, a.units);
    }
  }

  // ---------- battles ----------
  wallsOf(T) { if (T.cap) { const c = this.k.get(T.cap); return c ? c.b.walls : 0; } return T.w; }
  guard(T) { if (T.cap) { const c = this.k.get(T.cap); return 6 + 2 * (c ? c.age : 1); } return T.v ? 3 * T.v : 0; }
  counter(u, enemy) {
    const U = UNITS[u]; if (!U.vs) return 1;
    const tot = fightersOf(enemy); if (!tot) return 1;
    let m = 1; for (const v in U.vs) m += (U.vs[v] - 1) * ((enemy[v] || 0) / tot);
    return m;
  }
  attackPower(units, k, T) {
    const walls = this.wallsOf(T); let p = 0;
    for (const u in units) { const U = UNITS[u]; if (U.noFight || !U.atk) continue; p += units[u] * U.atk * this.counter(u, T.units) * (U.walls && walls > 0 ? U.walls : 1); }
    return p * (k && k.techs.has('tactics') ? 1.1 : 1) * (k && this.marked && T.o === this.marked && k.id !== this.marked ? 1.2 : 1);
  }
  defMult(T, attUnits) {
    const owner = T.o && this.k.get(T.o), fa = fightersOf(attUnits || {});
    const catShare = fa ? (attUnits.catapult || 0) / fa : 0;
    let m = 1 + 0.25 * this.wallsOf(T) * (1 - 0.5 * catShare);
    if (T.cap && owner) m += (owner.b.tower ? 0.1 : 0) + 0.2;
    if (T.t === 'h') m += 0.15;
    if (owner && owner.techs.has('shields')) m += 0.1;
    return m;
  }
  defencePower(T, attUnits = {}) {
    let p = this.guard(T);
    for (const u in T.units) { const U = UNITS[u]; if (U.noFight) continue; p += T.units[u] * U.def * this.counter(u, attUnits); }
    return p * this.defMult(T, attUnits);
  }
  lose(units, frac) { let n = 0; for (const u in units) { const l = frac >= 1 ? units[u] : Math.round(units[u] * frac); units[u] -= l; n += l; } clean0(units); return n; }
  battle(a, T, now) {
    const att = a.o ? this.k.get(a.o) : null, defK = T.o ? this.k.get(T.o) : null;
    const rng = this.room.rng;
    const hasDef = fightersOf(T.units) > 0 || this.guard(T) > 0;
    if (!hasDef && a.o) return this.capture(a, T, att, defK, now); // nobody home: just walk in
    const aP = this.attackPower(a.units, att, T) * (0.9 + 0.2 * rng());
    const dP = hasDef ? this.defencePower(T, a.units) * (0.9 + 0.2 * rng()) : 0;
    const win = aP > dP;
    const wP = Math.max(aP, dP), lP = Math.min(aP, dP), ratio = wP > 0 ? lP / wP : 0;
    const loserFrac = ratio < 0.5 ? 1 : 0.7, winnerFrac = ratio * 0.7;
    const walls = this.wallsOf(T);
    let aLost, dLost;
    if (win) { aLost = this.lose(a.units, winnerFrac); dLost = this.lose(T.units, loserFrac); } else { aLost = this.lose(a.units, loserFrac); dLost = this.lose(T.units, winnerFrac); }
    if (att) { att.stats.kills += dLost; att.stats.lost += aLost; att.stats.battles++; if (win) att.stats.won++; }
    if (defK) { defK.stats.kills += aLost; defK.stats.lost += dLost; defK.stats.battles++; if (!win) defK.stats.won++; defK.attackedAt = now; defK.lastAttacker = a.o; }
    if (att && defK) { const wk = [att.id, defK.id].sort().join('|'), w = this.wars.get(wk); this.wars.set(wk, { a: att.id, b: defK.id, at: now, n: (w ? w.n : 0) + 1 }); }
    const winner = win ? (a.o || 'bandits') : (T.o || null);
    this.battles.push({ q: T.q, r: T.r, at: now, win: winner, a: a.o || 'bandits', d: T.o || null, aLost, dLost });
    if (this.battles.length > 30) this.battles.shift();
    this.room.fx('battle', { q: T.q, r: T.r, win: winner });
    const aName = att ? att.name : a.bandits || 'Bandits', dName = defK ? defK.name : 'the wilds';
    if (win && (a.units.catapult || 0) > 0 && walls > 0) { if (T.cap && defK) defK.b.walls = Math.max(0, defK.b.walls - 1); else T.w = Math.max(0, T.w - 1); }
    if (!a.o) { // bandits
      if (win && defK) {
        T.v = Math.max(0, T.v - 1); T.units = {};
        const stolen = Math.floor(defK.res.food * 0.2); defK.res.food -= stolen;
        this.alert(defK, `🏴‍☠️ Bandits raided your village and stole ${stolen} food!`, 'bad'); this.log(`🏴‍☠️ ${aName} raided a village of ${dName}!`, 'war');
      } else if (defK) { this.alert(defK, '🛡️ Your village beat off the bandits!', 'good'); this.log(`🛡️ ${dName} beat off ${aName}.`, 'war'); }
      return;
    }
    if (!win) {
      this.alert(att, `💥 Your attack on ${dName} failed.`, 'bad'); if (defK) this.alert(defK, `🛡️ You held off ${aName}!`, 'good');
      if (defK) this.log(`🛡️ ${dName} held off ${aName}.`, 'war');
      this.goHome(a, a.units); return;
    }
    if (T.cap && defK) {
      if (defK.rocket) { this.log(`💥 ${aName} destroyed ${dName}’s rocket stage under construction!`, 'war'); defK.rocket = null; }
      this.vassalize(defK, att);
      this.goHome(a, a.units); return;
    }
    return this.capture(a, T, att, defK, now);
  }
  // A village / land / free tile changes hands.
  capture(a, T, att, defK, now) {
    const aName = att.name, dName = defK ? defK.name : 'the wilds';
    const survivors = T.units; T.units = {};
    if (defK && fightersOf(survivors)) this.goHome({ o: defK.id, to: T.i }, survivors);
    const wasVillage = T.v > 0;
    T.o = att.id; T.v = Math.max(0, T.v - 1); T.units = addU({}, a.units);
    if (defK && wasVillage) for (const n of T.nb) { const N = this.tile(n); if (N.o === defK.id && !N.cap && !N.v && !sumU(N.units)) N.o = att.id; }
    att.stats.captures++;
    this.room.fx('capture', { q: T.q, r: T.r, id: att.id, village: wasVillage });
    if (defK && wasVillage) { this.rally(defK, 2 + Math.floor(defK.age / 2)); this.collectBounty(att, defK); }
    if (defK) { this.log(`⚔️ ${aName} captured ${wasVillage ? 'a village' : 'land'} from ${dName}!`, 'war'); this.alert(defK, `🔥 ${aName} took your ${wasVillage ? 'village' : 'land'}!`, 'bad'); }
    this.alert(att, `🚩 You took ${defK ? dName + '’s ' + (wasVillage ? 'village' : 'land') : 'new land'}!`, 'good');
  }
  vassalize(v, liege) {
    if (v.ally) this.removeFromAlliance(v, false);
    this.offers = this.offers.filter((o) => !(o.kind === 'ally' && (o.from === v.id || o.to === v.id)));
    v.vassalOf = liege.id;
    this.log(`👑 ${liege.name} conquered ${v.name}’s capital! ${v.name} is now a vassal.`, 'war');
    this.room.fx('vassal', { id: v.id, by: liege.id });
    this.alert(v, `⛓️ ${liege.name} took your capital. You are their vassal: 25% of your production goes to them. Grow strong and rebel!`, 'bad');
    this.alert(liege, `👑 ${v.name} is now your vassal!`, 'good');
    this.collectBounty(liege, v);
    this.rally(v, 3 + v.age);
  }
  // Comeback: losing a village or your capital makes the people rise (free Militia at the capital).
  rally(k, n) {
    if (!k || k.rallies >= 6 || n < 1) return;
    k.rallies++; k.stats.comebacks++;
    const H = this.tile(k.home); H.units.militia = (H.units.militia || 0) + n;
    this.alert(k, `✊ Your people rise! ${n} Militia joined your capital's defence.`, 'good');
  }
  // Bounties: gold put on a kingdom's head goes to whoever takes a village or capital from them.
  collectBounty(att, defK) {
    if (!att || !defK) return;
    const mine = this.bounties.filter((b) => b.on === defK.id); if (!mine.length) return;
    this.bounties = this.bounties.filter((b) => b.on !== defK.id);
    const gold = mine.reduce((a, b) => a + b.gold, 0);
    att.res.gold += gold; att.stats.bounties += gold;
    this.log(`💰 ${att.name} claimed the ${gold}-gold bounty on ${defK.name}!`, 'war'); this.room.fx('bountyClaim', { id: att.id, on: defK.id, gold });
    this.alert(att, `💰 You claimed a ${gold}-gold bounty!`, 'good');
    for (const b of mine) if (b.from !== att.id) this.alert(this.k.get(b.from), `💰 ${att.name} claimed your bounty on ${defK.name}.`, 'info');
  }
  rebelInfo(k) {
    if (!k.vassalOf) return null;
    const L = this.k.get(k.vassalOf); if (!L) return null;
    let my = 0; for (const i of k.tiles) my += this.attackPower(this.tile(i).units, k, this.tile(L.home));
    for (const a of this.armies.values()) if (a.o === k.id) my += this.attackPower(a.units, k, this.tile(L.home));
    const need = this.defencePower(this.tile(L.home), {}) * 0.75; // the liege's grip is stretched thin
    const chance = Math.max(0.4, Math.min(0.9, 0.4 + 0.3 * (my / Math.max(1, need) - 1)));
    const cooldown = Math.max(0, k.rebelAt + REBEL_CD - this.now());
    return { liege: L.id, liegeName: L.name, my: Math.round(my), need: Math.round(need), can: my > need && !cooldown, chance: Math.round(chance * 100) / 100, cooldown };
  }
  rebel(k) {
    const info = this.rebelInfo(k); if (!info) return { ok: false, error: 'You are free already.' };
    if (info.cooldown) return { ok: false, error: `Your people need ${Math.ceil(info.cooldown / 1000)} s before rising again.` };
    if (!info.can) return { ok: false, error: `Not strong enough yet: your power ${info.my} vs their capital ${info.need}.` };
    k.rebelAt = this.now();
    const L = this.k.get(info.liege);
    if (this.room.rng() < info.chance) {
      k.vassalOf = null;
      this.log(`✊ ${k.name} rebelled and threw off ${L.name}!`, 'war'); this.room.fx('rebel', { id: k.id, ok: true });
      this.alert(L, `✊ ${k.name} rebelled and is free again!`, 'bad');
      return { ok: true, free: true };
    }
    const H = this.tile(k.home); for (const u in H.units) if (!UNITS[u].noFight) H.units[u] -= Math.round(H.units[u] * 0.25); clean0(H.units);
    this.log(`✊ ${k.name} tried to rebel against ${L.name}, and failed.`, 'war'); this.room.fx('rebel', { id: k.id, ok: false });
    return { ok: true, free: false };
  }

  // ---------- diplomacy ----------
  removeFromAlliance(k, betray) {
    const A = this.alliances.get(k.ally); k.ally = null; if (!A) return;
    A.members = A.members.filter((x) => x !== k.id);
    if (betray) {
      A.monument = Math.floor(A.monument * 0.7);
      k.traitorUntil = this.now() + TRAITOR_MS; k.stats.betrayals++;
      this.log(`🗡️ ${k.name} betrayed their alliance!`, 'diplo'); this.room.fx('betray', { id: k.id });
      for (const id of A.members) this.alert(this.k.get(id), `🗡️ ${k.name} left your alliance. Traitor!`, 'bad');
    }
    if (A.members.length < 2) { for (const id of A.members) { const m = this.k.get(id); if (m) m.ally = null; } this.alliances.delete(A.id); }
  }
  joinAlliance(a, b) {
    const A = a.ally && this.alliances.get(a.ally), B = b.ally && this.alliances.get(b.ally);
    let G;
    if (A && B) { G = A; for (const id of B.members) { G.members.push(id); this.k.get(id).ally = G.id; } G.monument += B.monument; this.alliances.delete(B.id); }
    else if (A || B) { G = A || B; const x = A ? b : a; G.members.push(x.id); x.ally = G.id; }
    else { G = { id: 'A' + (++this.allySeq), members: [a.id, b.id], monument: 0 }; this.alliances.set(G.id, G); a.ally = G.id; b.ally = G.id; }
    a.stats.alliances++; b.stats.alliances++;
    this.log(`🤝 ${a.name} and ${b.name} are now allies.`, 'diplo'); this.room.fx('alliance', { a: a.id, b: b.id, ally: G.id });
  }
  offerFor(id) { return this.offers.find((o) => o.id === id); }
  closeOffer(o, refund) {
    this.offers = this.offers.filter((x) => x !== o);
    if (refund && o.kind === 'trade') { const f = this.k.get(o.from); if (f) this.refund(f, o.give); }
  }
  cleanRes(obj, allowed = ['food', 'wood', 'stone', 'gold']) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { error: 'Pick some resources.' };
    const out = {};
    for (const [r, v] of Object.entries(obj)) {
      if (!allowed.includes(r)) return { error: 'Unknown resource.' };
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) return { error: 'Amounts must be positive numbers.' };
      const f = Math.floor(n); if (f > 0) out[r] = f;
    }
    if (!Object.keys(out).length) return { error: 'Pick some resources.' };
    return { res: out };
  }
  housekeeping(now) {
    for (const o of this.offers.slice()) if (now >= o.exp) {
      this.closeOffer(o, true);
      const f = this.k.get(o.from); if (f) this.alert(f, `⌛ Your ${o.kind === 'ally' ? 'alliance proposal' : 'trade offer'} to ${this.kn(o.to)} expired.`);
    }
    for (const k of this.k.values()) {
      if (k.msg && now >= k.msg.until) k.msg = null;
      for (const [i, s] of k.scouted) if (now - s.at > SCOUT_TTL) k.scouted.delete(i);
    }
    while (this.battles.length && now - this.battles[0].at > BATTLE_SHOW) this.battles.shift();
    for (const [wk, w] of this.wars) if (now - w.at > 90000) this.wars.delete(wk);
    for (const b of this.bounties.slice()) if (now >= b.exp || !this.k.has(b.on)) {
      this.bounties = this.bounties.filter((x) => x !== b);
      const f = this.k.get(b.from); if (f) { f.res.gold += b.gold; this.alert(f, `⌛ Nobody claimed your bounty on ${this.kn(b.on)}. ${b.gold} gold came back.`); }
    }
  }

  // ---------- the Royal Council ----------
  runCouncil(now) {
    const C = this.council;
    if (C && now >= C.end) return this.resolveCouncil(now);
    if (C || this.k.size < 3 || now < this.nextCouncilAt || this.endAt - now < 90000) return;
    const kind = this.lastMotion === 'sanction' ? 'grant' : 'sanction'; this.lastMotion = kind;
    const M0 = D.COUNCIL[kind];
    this.council = { id: ++this.councilSeq, kind, start: now, end: now + D.COUNCIL_VOTE, votes: new Map() };
    this.log(`${M0.icon} The Royal Council meets: ${M0.ask} Vote on your phone!`, 'diplo'); this.room.fx('council', { kind });
    for (const k of this.k.values()) this.alert(k, `🗳️ Royal Council: ${M0.ask} Vote now (🤝 Allies tab)!`, 'diplo');
  }
  vote(k, to) {
    const C = this.council; if (!C) return { ok: false, error: 'The council is not in session.' };
    const t = this.k.get(to); if (!t) return { ok: false, error: 'Pick a kingdom.' };
    if (t.id === k.id) return { ok: false, error: 'You can’t vote for yourself.' };
    C.votes.set(k.id, t.id); return { ok: true };
  }
  tally() { const m = new Map(); if (this.council) for (const t of this.council.votes.values()) m.set(t, (m.get(t) || 0) + 1); return m; }
  resolveCouncil(now) {
    const C = this.council, t = this.tally(); this.council = null; this.nextCouncilAt = now + D.COUNCIL_EVERY;
    const M0 = D.COUNCIL[C.kind];
    if (!t.size) { this.log(`${M0.icon} The council could not agree on anything.`, 'diplo'); return; }
    const top = Math.max(...t.values()), tied = [...t].filter(([, n]) => n === top).map(([id]) => this.k.get(id)).filter(Boolean);
    tied.sort((a, b) => (C.kind === 'sanction' ? b.score - a.score : a.score - b.score));
    const w = tied[0]; if (!w) return;
    if (C.kind === 'sanction') {
      w.sanctionUntil = now + M0.secs * 1000;
      this.log(`⚖️ The council sanctions ${w.name} (${top} vote${top > 1 ? 's' : ''}): −30% production for 2 minutes!`, 'diplo');
      this.alert(w, '⚖️ The council sanctioned you: −30% production for 2 minutes.', 'bad');
    } else {
      const n = 80 + 60 * w.age; w.res.gold += n; w.res.stone += n;
      this.log(`🏅 The council grants the royal treasury to ${w.name} (${top} vote${top > 1 ? 's' : ''}): +${n} 🪙 and +${n} 🪨!`, 'diplo');
      this.alert(w, `🏅 The council chose you! +${n} gold and +${n} stone.`, 'good');
    }
    this.room.fx('councilResult', { kind: C.kind, id: w.id, votes: top });
  }

  // ---------- Royal Decrees (the guided path) ----------
  decreeDone(k, key) {
    switch (key) {
      case 'work': return JOB_KEYS.reduce((a, j) => a + k.jobs[j], 0) >= k.peasants;
      case 'houses': return k.b.houses > 0;
      case 'peasants': return k.peasants >= 6;
      case 'age2': return k.age >= 2;
      case 'village': return k.villages > 0 || k.stats.villages > 0;
      case 'army': return k.fighters >= 6;
      case 'age3': return k.age >= 3;
      case 'library': return k.b.library > 0;
      case 'friend': return !!k.ally || k.stats.gifts > 0 || k.stats.trades > 0;
      case 'age4': return k.age >= 4;
      case 'path': return k.capitals > 1 || k.stats.monument >= 200 || k.b.launchpad > 0;
      default: return true;
    }
  }
  checkDecree(k) {
    const Dc = D.DECREES[k.decree]; if (!Dc || !this.decreeDone(k, Dc.key)) return;
    k.decree++; this.refund(k, Dc.reward);
    this.alert(k, `📜 Decree fulfilled: ${Dc.title}! Reward: ${fmtMissing(Dc.reward)}.`, 'good');
  }

  // ---------- world events ----------
  runEvents(now) {
    if (this.event && now >= this.event.until) this.event = null;
    if (!this.s.events || now < this.nextEventAt) return;
    this.nextEventAt = now + EVENT_EVERY + this.room.rng() * EVENT_JITTER;
    const kinds = Object.keys(D.EVENTS); const kind = kinds[Math.floor(this.room.rng() * kinds.length)];
    this.fireEvent(kind, now);
  }
  fireEvent(kind, now = this.now()) {
    const E = D.EVENTS[kind];
    this.event = { kind, name: E.name, icon: E.icon, text: E.text, at: now, until: now + (E.secs || 12) * 1000 };
    const ks = [...this.k.values()];
    if (kind === 'harvest') for (const k of ks) { k.res.food += 60 + 40 * k.age; this.alert(k, `🌽 Bountiful Harvest: +${60 + 40 * k.age} food!`, 'good'); }
    if (kind === 'plague') for (const k of ks) {
      if (k.b.library || k.peasants <= 2) continue;
      const lost = Math.min(k.peasants - 2, Math.max(1, Math.floor(k.peasants * 0.2))); k.peasants -= lost; this.fitJobs(k);
      this.alert(k, `🤢 Plague! You lost ${lost} peasants. (A Library protects you.)`, 'bad');
    }
    if (kind === 'comet') for (const k of ks) { const n = 30 + 30 * k.b.library; k.res.sci += n; }
    if (kind === 'bandits') this.bandits(now);
    this.log(`${E.icon} ${E.text}`, 'event'); this.room.fx('event', { event: kind });
  }
  bandits(now) {
    let best = null, bestP = Infinity;
    for (const T of this.world.tiles) if (T.v > 0 && T.o && !T.cap) { const p = this.defencePower(T, {}); if (p < bestP) { bestP = p; best = T; } }
    if (!best) return null;
    const edge = this.world.tiles.filter((T) => M.dist(T.q, T.r, 0, 0) === this.world.R && M.passable(T.t) && !T.o);
    edge.sort((x, y) => this.world.dist(x.i, best.i) - this.world.dist(y.i, best.i));
    for (const E of edge.slice(0, 6)) {
      const path = this.world.path(E.i, best.i); if (!path) continue;
      const owner = this.k.get(best.o), n = 2 + 2 * (owner ? owner.age : 1);
      const a = this.dispatch(null, E.i, best.i, { militia: n }, 'attack', path);
      a.t1 = now + Math.min(30000, Math.max(12000, path.length * 4000));
      a.bandits = D.BANDIT_NAMES[Math.floor(this.room.rng() * D.BANDIT_NAMES.length)];
      this.alert(owner, `🏴‍☠️ Bandits are coming for your village!`, 'bad');
      return a;
    }
    return null;
  }
  fitJobs(k) {
    let over = JOB_KEYS.reduce((a, j) => a + k.jobs[j], 0) - k.peasants;
    for (const j of ['study', 'mine', 'quarry', 'chop', 'farm']) { if (over <= 0) break; const d = Math.min(over, k.jobs[j]); k.jobs[j] -= d; over -= d; }
  }

  // ---------- winning ----------
  monumentNeed() { return Math.round(D.MONUMENT_PER_KINGDOM * Math.max(4, this.k.size) * this.pace() / 10) * 10; }
  // Peace is possible when every free kingdom is in one alliance whose monument is complete.
  peaceAlliance() {
    const free = [...this.k.values()].filter((k) => !k.vassalOf);
    const A = free.length >= 2 && free[0].ally && this.alliances.get(free[0].ally);
    return A && free.every((k) => k.ally === A.id) && A.monument >= this.monumentNeed() ? A : null;
  }
  progress() {
    const all = [...this.k.values()], tops = new Map();
    for (const k of all) { const t = this.top(k); tops.set(t.id, (tops.get(t.id) || 0) + 1); }
    let lead = null, n = 0; for (const [id, c] of tops) if (c > n) { n = c; lead = id; }
    let mon = 0, monBy = null; for (const A of this.alliances.values()) if (A.monument > mon) { mon = A.monument; monBy = A.id; }
    const now = this.now();
    return {
      domination: all.length ? n / all.length : 0, leader: all.length >= 2 ? lead : null, capitals: n, of: all.length,
      monument: Math.min(1, mon / Math.max(1, this.monumentNeed())), monumentBy: monBy, monumentNeed: this.monumentNeed(),
      peaceIn: this.peaceHoldUntil ? Math.max(0, this.peaceHoldUntil - now) : null, marked: this.marked,
      rockets: all.filter((k) => k.b.launchpad || k.stage).map((k) => ({ id: k.id, stage: k.stage, building: k.rocket ? k.rocket.stage : null, endsIn: k.rocket ? Math.max(0, k.rocket.end - now) : null, dur: k.rocket ? k.rocket.dur || 60000 : null })),
    };
  }
  checkWin(now) {
    if (this.phase !== 'play') return;
    const all = [...this.k.values()];
    if (all.length >= 2 && this.modeHas('conquest')) {
      const t0 = this.top(all[0]);
      if (all.every((k) => this.top(k) === t0)) { this.log(`👑 ${t0.name} rules the whole world!`, 'win'); return this.end('conquest', [t0.id]); }
    }
    if (this.modeHas('diplomacy')) {
      const A = this.peaceAlliance();
      if (A && !this.peaceHoldUntil) {
        this.peaceHoldUntil = now + D.PEACE_HOLD * 1000;
        this.log(`🕊️ The whole world is one alliance and the Peace Monument stands! If the peace holds for ${D.PEACE_HOLD} s, they all win.`, 'diplo'); this.room.fx('peacehold', {});
        for (const k of all) this.alert(k, `🕊️ Peace in ${D.PEACE_HOLD} s! Anyone who leaves the alliance breaks it.`, 'diplo');
      } else if (!A && this.peaceHoldUntil) {
        this.peaceHoldUntil = 0; this.log('💔 The peace is broken!', 'war'); this.room.fx('peacebroken', {});
      } else if (A && now >= this.peaceHoldUntil) { this.log('🕊️ The peace held! The world is at peace.', 'win'); this.room.fx('monument', { done: true }); return this.end('diplomacy', A.members.slice()); }
    }
    if (now >= this.endAt) {
      this.census();
      let best;
      if (this.s.mode === 'conquest') best = all.slice().sort((a, b) => b.capitals - a.capitals || b.score - a.score)[0];
      else best = all.slice().sort((a, b) => b.score - a.score)[0];
      this.log(`⌛ Time is up! ${best ? best.name : 'Nobody'} wins.`, 'win');
      return this.end(this.s.mode === 'conquest' ? 'conquest' : 'score', best ? [best.id] : [], 'time');
    }
  }
  end(mode, ids, reason = 'win') {
    if (this.phase === 'over') return;
    this.census();
    this.phase = 'over'; this.room.cancel(this.timer); this.endedAt = this.now();
    this.winner = { mode, ids, names: ids.map((id) => this.kn(id)), reason };
    const all = [...this.k.values()];
    this.standings = all.slice().sort((a, b) => (ids.includes(b.id) ? 1 : 0) - (ids.includes(a.id) ? 1 : 0) || b.score - a.score).map((k, i) => ({
      rank: i + 1, id: k.id, name: k.name, owner: this.room.name(k.id), color: k.color, score: k.score, age: k.age, land: k.land, villages: k.villages, capitals: k.capitals, vassalOf: k.vassalOf, stage: k.stage,
    }));
    const pick = (f, min = 0) => { let best = null, v = min; for (const k of all) { const x = f(k); if (x > v) { v = x; best = k; } } return best ? { id: best.id, name: best.name, value: Math.round(v) } : null; };
    this.awards = [
      ['💪 Mightiest Army', pick((k) => k.stats.peakPower + k.stats.kills * 5, -1)],
      ['🏗️ Biggest Builder', pick((k) => k.stats.built + k.stats.villages * 2, -1)],
      ['🧠 Smartest', pick((k) => k.stats.sci, -1)],
      ['💐 Best Friend', pick((k) => k.stats.alliances * 3 + k.stats.gifts)],
      ['🗡️ Traitor of the Year', pick((k) => k.stats.betrayals)],
      ['💰 Bounty Hunter', pick((k) => k.stats.bounties)],
      ['🔥 Comeback Kid', pick((k) => (k.stats.comebacks ? k.stats.comebacks * 10 + k.score / 20 : 0))],
    ].filter(([, w]) => w).map(([title, w]) => ({ title, ...w }));
    this.room.fx('win', { mode, ids });
  }

  // ---------- actions ----------
  act(p, m) {
    m = m && typeof m === 'object' ? m : {};
    if (this.phase === 'lobby') {
      if (m.op === 'seat') {
        if (m.seat == null || m.seat === -1) { this.seatOf.delete(p.id); return { ok: true }; }
        const s = Number(m.seat), N = this.room.list().length;
        if (!Number.isInteger(s) || s < 0 || s >= N) return { ok: false, error: 'Pick a seat at the table.' };
        for (const [id, x] of this.seatOf) if (x === s && id !== p.id && this.room.get(id)) return { ok: false, error: 'That seat is taken.' };
        this.seatOf.set(p.id, s); this.room.fx('seat', { id: p.id, seat: s });
        return { ok: true };
      }
      if (m.op === 'rename') return this.rename(p.id, m.name);
      return { ok: false, error: 'Waiting for the host to start the game…' };
    }
    if (this.phase === 'over') return { ok: false, error: 'The game is over.' };
    const k = this.k.get(p.id); if (!k) return { ok: false, error: 'You are watching this game.' };
    return this.actK(k, m);
  }
  rename(id, name) {
    const n = cleanName(name); if (!n) return { ok: false, error: 'Type a name.' };
    this.kname.set(id, n); const k = this.k.get(id); if (k) k.name = n; return { ok: true };
  }
  actK(k, m) {
    const now = this.now();
    switch (m.op) {
      case 'seat': return { ok: false, error: 'Seats are fixed once the game starts.' };
      case 'rename': return this.rename(k.id, m.name);
      case 'jobs': {
        if (m.auto === true) { k.jobs = AI.autoJobs(this, k); return { ok: true, jobs: { ...k.jobs } }; }
        const want = { ...k.jobs }, open = this.jobsOpen(k);
        for (const j of JOB_KEYS) {
          if (m[j] == null) continue;
          const n = Number(m[j]);
          if (!Number.isInteger(n) || n < 0) return { ok: false, error: 'Worker counts must be whole numbers.' };
          if (n > 0 && !open[j]) return { ok: false, error: j === 'study' ? 'Studying needs a Library.' : `${JOBS[j].name} opens in Age ${JOBS[j].age}.` };
          want[j] = n;
        }
        for (const x of Object.keys(m)) if (x !== 'op' && x !== 'auto' && !JOBS[x]) return { ok: false, error: 'Unknown job.' };
        const tot = JOB_KEYS.reduce((a, j) => a + want[j], 0);
        if (tot > k.peasants) return { ok: false, error: `You only have ${k.peasants} peasants.` };
        k.jobs = want; return { ok: true };
      }
      case 'build': return this.build(k, String(m.b));
      case 'age': return this.build(k, 'castle');
      case 'train': return this.train(k, String(m.u), m.n == null ? 1 : Number(m.n));
      case 'cancel': {
        const list = m.queue === 'train' ? k.training : m.queue === 'build' ? k.queue : null;
        if (m.queue === 'research') { if (!k.researching) return { ok: false, error: 'Nothing to cancel.' }; this.refund(k, k.researching.cost, 0.5); k.researching = null; return { ok: true }; }
        if (!list) return { ok: false, error: 'Unknown queue.' };
        const i = Number(m.i); if (!Number.isInteger(i) || i < 0 || i >= list.length) return { ok: false, error: 'Nothing to cancel there.' };
        if (m.queue === 'build' && list[i].b === 'castle' && list.slice(i + 1).some((x) => x.b === 'castle')) return { ok: false, error: 'Cancel the later age first.' };
        const it = list[i], f = i === 0 ? 0.5 : 1;
        if (m.queue === 'train') this.refund(k, it.cost, f * it.n); else this.refund(k, it.cost, f);
        list.splice(i, 1);
        if (i === 0 && list.length) list[0].end = now + list[0].dur;
        return { ok: true };
      }
      case 'research': {
        const t = String(m.tech), c = this.canResearch(k, t); if (!c.ok) return c;
        this.pay(k, c.cost); k.researching = { tech: t, cost: c.cost, dur: Math.round(c.time * 1000), end: now + Math.round(c.time * 1000) };
        return { ok: true };
      }
      case 'march': return this.march(k, m);
      case 'claim': {
        const to = this.parseTile(m.to); if (to == null) return { ok: false, error: 'Pick a tile to claim.' };
        let from = null, best = Infinity;
        for (const i of k.tiles) if ((this.tile(i).units.settlers || 0) > 0) { const d = this.world.dist(i, to); if (d < best) { best = d; from = i; } }
        if (from == null) return { ok: false, error: k.age < 2 ? 'Settlers arrive in Age 2 (Village).' : 'Train Settlers first.' };
        return this.march(k, { from, to, units: { settlers: 1 }, order: 'claim' });
      }
      case 'upgrade': {
        const i = this.parseTile(m.at); if (i == null) return { ok: false, error: 'Pick one of your villages.' };
        const T = this.tile(i); if (T.o !== k.id || !T.v) return { ok: false, error: 'Pick one of your villages.' };
        if (m.what === 'walls') {
          const max = 3 + (k.techs.has('engineering') ? 1 : 0); if (T.w >= max) return { ok: false, error: 'Those walls are as high as they go.' };
          if (k.age < 2) return { ok: false, error: 'Walls need Age 2.' };
          const cost = this.costOf(k, D.VILLAGE_WALL[Math.min(T.w, 2)]), nr = this.needRes(k, cost); if (nr) return nr;
          this.pay(k, cost); T.w++; return { ok: true };
        }
        if (T.v >= 3) return { ok: false, error: 'That village is already level 3.' };
        const cost = this.costOf(k, D.VILLAGE_UP[T.v]), nr = this.needRes(k, cost); if (nr) return nr;
        this.pay(k, cost); T.v++; this.room.fx('village', { id: k.id, q: T.q, r: T.r }); return { ok: true };
      }
      case 'ally': {
        const t = this.k.get(m.to); if (!t || t.id === k.id) return { ok: false, error: 'Pick another kingdom.' };
        if (this.allied(k.id, t.id)) return { ok: false, error: 'You are already allies.' };
        if (k.vassalOf || t.vassalOf) return { ok: false, error: 'Vassals can’t make alliances.' };
        if (this.offers.some((o) => o.kind === 'ally' && ((o.from === k.id && o.to === t.id) || (o.from === t.id && o.to === k.id)))) return { ok: false, error: 'There is already a proposal between you.' };
        if (this.offers.filter((o) => o.from === k.id).length >= 6) return { ok: false, error: 'Too many open offers. Wait for answers.' };
        this.offers.push({ id: 'o' + (++this.offerSeq), kind: 'ally', from: k.id, to: t.id, exp: now + OFFER_TTL });
        this.alert(t, `🤝 ${k.name} proposes an alliance.`, 'diplo');
        return { ok: true };
      }
      case 'allyAnswer': {
        const o = this.offers.find((x) => x.kind === 'ally' && x.to === k.id && (x.from === m.from || x.id === m.id));
        if (!o) return { ok: false, error: 'That proposal is gone.' };
        this.closeOffer(o, false);
        const f = this.k.get(o.from); if (!f) return { ok: false, error: 'That kingdom is gone.' };
        if (!m.yes) { this.alert(f, `🙅 ${k.name} declined your alliance.`); return { ok: true }; }
        if (k.vassalOf || f.vassalOf) return { ok: false, error: 'Vassals can’t make alliances.' };
        if (!this.allied(k.id, f.id)) this.joinAlliance(f, k);
        this.alert(f, `🤝 ${k.name} accepted your alliance!`, 'good');
        return { ok: true };
      }
      case 'leaveAlly': if (!k.ally) return { ok: false, error: 'You are not in an alliance.' }; this.removeFromAlliance(k, true); return { ok: true };
      case 'gift': {
        const t = this.k.get(m.to); if (!t || t.id === k.id) return { ok: false, error: 'Pick another kingdom.' };
        if (!k.b.market) return { ok: false, error: 'Gifts travel through a Market (Age 3).' };
        const cr = this.cleanRes(m.res); if (cr.error) return { ok: false, error: cr.error };
        const nr = this.needRes(k, cr.res); if (nr) return nr;
        this.pay(k, cr.res); this.refund(t, cr.res); k.stats.gifts++;
        this.alert(t, `🎁 ${k.name} sent you a gift: ${fmtMissing(cr.res)}.`, 'good'); this.log(`🎁 ${k.name} sent a gift to ${t.name}.`, 'diplo');
        this.room.fx('gift', { from: k.id, to: t.id });
        return { ok: true };
      }
      case 'trade': {
        const t = this.k.get(m.to); if (!t || t.id === k.id) return { ok: false, error: 'Pick another kingdom.' };
        const g = this.cleanRes(m.give); if (g.error) return { ok: false, error: 'Give: ' + g.error };
        const w = this.cleanRes(m.get); if (w.error) return { ok: false, error: 'Get: ' + w.error };
        const nr = this.needRes(k, g.res); if (nr) return nr;
        if (this.offers.filter((o) => o.from === k.id).length >= 6) return { ok: false, error: 'Too many open offers. Wait for answers.' };
        this.pay(k, g.res);
        const o = { id: 'o' + (++this.offerSeq), kind: 'trade', from: k.id, to: t.id, give: g.res, get: w.res, exp: now + OFFER_TTL };
        this.offers.push(o);
        this.alert(t, `⚖️ ${k.name} offers ${fmtMissing(g.res)} for ${fmtMissing(w.res)}.`, 'diplo');
        return { ok: true, id: o.id };
      }
      case 'tradeAnswer': {
        const o = this.offers.find((x) => x.kind === 'trade' && x.id === m.id && (x.to === k.id || x.from === k.id));
        if (!o) return { ok: false, error: 'That offer is gone.' };
        if (o.from === k.id) { this.closeOffer(o, true); return { ok: true, cancelled: true }; }
        const f = this.k.get(o.from);
        if (!m.yes || !f) { this.closeOffer(o, true); if (f) this.alert(f, `🙅 ${k.name} declined your trade.`); return { ok: true }; }
        const nr = this.needRes(k, o.get); if (nr) return nr;
        this.closeOffer(o, false);
        const fee = k.neighbours.includes(f.id) ? 1 : 0.9;
        this.pay(k, o.get);
        for (const r in o.give) k.res[r] += Math.floor(o.give[r] * fee);
        for (const r in o.get) f.res[r] += Math.floor(o.get[r] * fee);
        k.stats.trades++; f.stats.trades++;
        this.alert(f, `⚖️ ${k.name} accepted your trade.`, 'good'); this.log(`⚖️ ${f.name} and ${k.name} made a trade.`, 'diplo');
        return { ok: true };
      }
      case 'message': {
        const text = D.PRESETS[m.preset]; if (!text) return { ok: false, error: 'Pick a message.' };
        if (now - k.msgAt < 3000) return { ok: false, error: 'Wait a moment before the next message.' };
        const to = m.to != null ? this.k.get(m.to) : null;
        if (m.to != null && (!to || to.id === k.id)) return { ok: false, error: 'Pick another kingdom.' };
        k.msgAt = now; k.msg = { key: m.preset, text, to: to ? to.id : null, until: now + MSG_MS };
        if (to) this.alert(to, `💬 ${k.name}: ${text}`, 'diplo');
        this.room.fx('message', { id: k.id, to: to ? to.id : null });
        return { ok: true };
      }
      case 'rebel': return this.rebel(k);
      case 'recall': return this.recall(k);
      case 'vote': return this.vote(k, m.to);
      case 'bounty': {
        const t = this.k.get(m.to); if (!t || t.id === k.id) return { ok: false, error: 'Pick another kingdom.' };
        if (this.allied(k.id, t.id)) return { ok: false, error: `${t.name} is your ally.` };
        const n = Number(m.gold); if (!Number.isInteger(n) || n < D.BOUNTY_MIN) return { ok: false, error: `A bounty is at least ${D.BOUNTY_MIN} gold.` };
        if (k.res.gold < n) return { ok: false, error: `You only have ${Math.floor(k.res.gold)} 🪙.` };
        k.res.gold -= n;
        const b = this.bounties.find((x) => x.from === k.id && x.on === t.id);
        if (b) { b.gold += n; b.exp = now + D.BOUNTY_TTL; } else this.bounties.push({ id: 'b' + (++this.bountySeq), from: k.id, on: t.id, gold: n, exp: now + D.BOUNTY_TTL });
        const tot = this.bounties.filter((x) => x.on === t.id).reduce((a, x) => a + x.gold, 0);
        this.log(`💰 ${k.name} put a bounty on ${t.name}! ${tot} gold to whoever takes a village or their capital.`, 'war');
        this.room.fx('bounty', { id: k.id, on: t.id, gold: tot });
        this.alert(t, `💰 ${k.name} put ${n} gold on your head! Guard your villages.`, 'bad');
        return { ok: true, total: tot };
      }
      case 'rocket': {
        if (!this.modeHas('science')) return { ok: false, error: 'The science win is off in this game.' };
        if (!k.b.launchpad) return { ok: false, error: 'Build a Launch Pad first.' };
        if (k.rocket) return { ok: false, error: 'A rocket stage is already being built.' };
        if (k.stage >= 3) return { ok: false, error: 'The rocket is complete.' };
        const cost = this.rocketCost(k), nr = this.needRes(k, cost); if (nr) return nr;
        this.pay(k, cost); const dur = Math.round(D.ROCKET_TIME * 1000 * Math.max(1, this.pace())); k.rocket = { stage: k.stage + 1, end: now + dur, dur, cost };
        this.log(`🚀 ${k.name} started building rocket stage ${k.stage + 1}! (${Math.round(dur / 1000)} s)`, 'war'); this.room.fx('rocket', { id: k.id, stage: k.stage, building: k.stage + 1 });
        return { ok: true };
      }
      case 'monument': {
        if (!this.modeHas('diplomacy')) return { ok: false, error: 'The peace win is off in this game.' };
        const A = k.ally && this.alliances.get(k.ally); if (!A) return { ok: false, error: 'Join an alliance first.' };
        if (k.age < D.MONUMENT_AGE) return { ok: false, error: `Building the monument needs Age ${D.MONUMENT_AGE} (${D.AGES[D.MONUMENT_AGE].name}).` };
        const cr = this.cleanRes(m.res, ['gold', 'stone']); if (cr.error) return { ok: false, error: cr.error };
        const nr = this.needRes(k, cr.res); if (nr) return nr;
        this.pay(k, cr.res); const n = (cr.res.gold || 0) + (cr.res.stone || 0);
        const was = A.monument; A.monument += n; k.stats.monument += n;
        this.room.fx('monument', { id: k.id, ally: A.id });
        // Announce it once, with a short name list.
        if (was < this.monumentNeed() && A.monument >= this.monumentNeed()) {
          const names = A.members.map((x) => this.kn(x)), who = names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ');
          this.log(`🕊️ The Peace Monument of ${who} is built. Peace needs everyone in one alliance!`, 'diplo');
        }
        this.checkWin(now);
        return { ok: true };
      }
      case 'market': {
        if (!k.b.market) return { ok: false, error: 'Build a Market first (Age 3).' };
        const ok = ['food', 'wood', 'stone', 'gold'];
        if (!ok.includes(m.give) || !ok.includes(m.get) || m.give === m.get) return { ok: false, error: 'Pick two different resources.' };
        const n = Number(m.n); if (!Number.isInteger(n) || n < 1) return { ok: false, error: 'Pick an amount.' };
        if (k.res[m.give] < n) return { ok: false, error: `You only have ${Math.floor(k.res[m.give])} ${D.RES_ICON[m.give]}.` };
        const out = Math.floor(n / MARKET_RATE[k.b.market]); if (out < 1) return { ok: false, error: 'That is too little to trade.' };
        k.res[m.give] -= n; k.res[m.get] += out; return { ok: true, got: out };
      }
      default: return { ok: false, error: 'Unknown action.' };
    }
  }
  rocketCost(k) { return this.costOf(k, D.ROCKET[Math.min(3, k.stage + 1)], (k.techs.has('physics') ? 0.8 : 1) * this.pace()); }
  // Player ids best-first once the game is over (for the party scoreboard).
  results() { return this.phase === 'over' && this.standings ? this.standings.map((s) => s.id) : []; }
  // Every soldier out on villages and land walks back to the capital.
  recall(k) {
    let n = 0;
    for (const i of k.tiles) {
      if (i === k.home) continue;
      const T = this.tile(i), send = {}; for (const u in T.units) if (!UNITS[u].noFight && T.units[u] > 0) send[u] = T.units[u];
      if (sumU(send) && this.march(k, { from: i, to: k.home, units: send, order: 'move' }).ok) n += sumU(send);
    }
    return n ? { ok: true, n } : { ok: false, error: 'All your soldiers are already at the capital.' };
  }

  // ---------- views ----------
  tileOut(T) {
    const o = { q: T.q, r: T.r, t: T.t, o: T.o, v: T.v, w: T.cap ? this.wallsOf(T) : T.w, g: sumU(T.units) };
    if (T.cap) o.c = T.cap; if (T.rich) o.x = 1;
    return o;
  }
  armyOut(a) {
    const F = this.tile(a.from), T = this.tile(a.to);
    let kind = null, best = -1; for (const u in a.units) if (a.units[u] > best) { best = a.units[u]; kind = u; }
    const path = [F.q, F.r]; for (const i of a.path) { const P = this.tile(i); path.push(P.q, P.r); }
    return { id: a.id, o: a.o, from: { q: F.q, r: F.r }, to: { q: T.q, r: T.r }, n: sumU(a.units), kind: a.o ? kind : 'bandits', order: a.order, t0: a.t0, t1: a.t1, path };
  }
  kingdomOut(k, now) {
    return {
      id: k.id, name: k.name, owner: this.room.name(k.id), color: k.color, seat: k.seat, home: { q: this.tile(k.home).q, r: this.tile(k.home).r },
      age: k.age, castle: k.age, score: k.score, ally: k.ally, vassalOf: k.vassalOf, traitor: k.traitorUntil > now, traitorIn: Math.max(0, k.traitorUntil - now),
      msg: k.msg ? { key: k.msg.key, text: k.msg.text, to: k.msg.to, endsIn: Math.max(0, k.msg.until - now) } : null,
      alive: true, gone: k.gone, bot: !!k.ai, stage: k.stage, building: k.rocket ? k.rocket.stage : null,
      land: k.land, villages: k.villages, army: k.soldiers, capitals: k.capitals,
      avatar: this.avatarOf(k.id), bounty: this.bountyOn(k.id), sanction: Math.max(0, k.sanctionUntil - now), underdog: k.underdog || 0, marked: this.marked === k.id,
    };
  }
  bountyOn(id) { let n = 0; for (const b of this.bounties) if (b.on === id) n += b.gold; return n; }
  councilOut(now, k) {
    const C = this.council; if (!C) return null;
    const M0 = D.COUNCIL[C.kind], t = this.tally();
    const o = { id: C.id, kind: C.kind, name: M0.name, icon: M0.icon, ask: M0.ask, text: M0.text, endsIn: Math.max(0, C.end - now), votes: C.votes.size, of: this.k.size,
      tally: [...t].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ id, n })) };
    if (k) o.mine = C.votes.get(k.id) || null;
    return o;
  }
  eventsOut(now) {
    return { current: this.event ? { kind: this.event.kind, name: this.event.name, icon: this.event.icon, text: this.event.text, endsIn: Math.max(0, this.event.until - now) } : null, nextIn: this.s.events && this.phase === 'play' ? Math.max(0, Math.round(this.nextEventAt - now)) : null, on: !!this.s.events };
  }
  tv() {
    const now = this.now();
    const lobby = this.phase === 'lobby';
    return {
      phase: this.phase, now, seats: this.seatList(), tableSize: lobby ? this.room.list().length : this.k.size,
      world: this.world ? { R: this.world.R, tiles: this.world.tiles.map((T) => this.tileOut(T)) } : { R: 0, tiles: [] },
      kingdoms: [...this.k.values()].map((k) => this.kingdomOut(k, now)),
      armies: [...this.armies.values()].map((a) => this.armyOut(a)),
      battles: this.battles.map((b) => ({ q: b.q, r: b.r, at: b.at, win: b.win, a: b.a, d: b.d })),
      alliances: [...this.alliances.values()].map((A) => ({ id: A.id, members: A.members.slice(), monument: Math.floor(A.monument) })),
      wars: [...this.wars.values()].map((w) => ({ a: w.a, b: w.b, n: w.n, ago: now - w.at })),
      council: this.councilOut(now, null),
      events: this.eventsOut(now), mode: this.s.mode, speed: this.s.speed, timeLimit: this.s.timeLimit,
      progress: this.world ? this.progress() : { domination: 0, leader: null, monument: 0, rockets: [] },
      timeLeft: this.phase === 'play' ? Math.max(0, this.endAt - now) : this.phase === 'over' ? 0 : this.s.timeLimit * 60000,
      peaceIn: this.phase === 'play' ? Math.max(0, (this.peaceUntil || 0) - now) : 0,
      ticker: this.ticker, winner: this.winner,
      standings: this.phase === 'over' ? this.standings : null, awards: this.phase === 'over' ? this.awards : null,
    };
  }
  // The tiles a phone shows: whole map when small, else everything within 4 hexes of your land.
  viewTiles(k) {
    const W = this.world;
    if (W.R <= 8 || !k) return W.tiles;
    const seen = new Map(); let front = k.tiles.slice(); for (const i of front) seen.set(i, 0);
    for (let d = 1; d <= 4; d++) { const nx = []; for (const i of front) for (const n of W.tiles[i].nb) if (!seen.has(n)) { seen.set(n, d); nx.push(n); } front = nx; }
    return [...seen.keys()].sort((a, b) => a - b).map((i) => W.tiles[i]);
  }
  view(p) {
    const now = this.now(), k = this.k.get(p.id);
    const base = {
      phase: this.phase, now, seats: this.seatList(), tableSize: this.phase === 'lobby' ? this.room.list().length : this.k.size,
      seat: this.phase === 'lobby' ? (this.seatOf.has(p.id) ? this.seatOf.get(p.id) : null) : k ? k.seat : null,
      kingdomName: k ? k.name : this.kname.get(p.id) || this.defaultName(p),
      mode: this.s.mode, speed: this.s.speed, timeLimit: this.s.timeLimit, timeLeft: this.phase === 'play' ? Math.max(0, this.endAt - now) : 0, peaceIn: this.phase === 'play' ? Math.max(0, (this.peaceUntil || 0) - now) : 0,
      winner: this.winner, standings: this.phase === 'over' ? this.standings : null, awards: this.phase === 'over' ? this.awards : null,
      presets: D.PRESETS, defs: this.defs(),
    };
    if (this.phase === 'lobby') return base;
    const kingdoms = [...this.k.values()].map((x) => {
      const o = this.kingdomOut(x, now);
      if (k) { o.rel = x.id === k.id ? 'self' : this.allied(x.id, k.id) ? 'ally' : this.chain(k).includes(x.id) ? 'liege' : this.chain(x).includes(k.id) ? 'vassal' : k.neighbours.includes(x.id) ? 'neighbour' : 'other'; o.dist = this.world.dist(k.home, x.home); }
      return o;
    });
    const tiles = this.viewTiles(k).map((T) => {
      const o = this.tileOut(T);
      if (k && (T.o === k.id || this.allied(T.o, k.id))) o.u = { ...T.units };
      else if (k && k.scouted.has(T.i)) { const s = k.scouted.get(T.i); o.u = { ...s.units }; o.seen = now - s.at; }
      return o;
    });
    const out = { ...base, world: { R: this.world.R, tiles }, kingdoms, events: this.eventsOut(now), progress: this.progress(), ticker: this.ticker.slice(-6), spectator: !k, council: this.councilOut(now, k) };
    out.armies = [...this.armies.values()].filter((a) => !k || a.o === k.id || this.tile(a.to).o === k.id || this.allied(a.o, k.id)).map((a) => this.armyOut(a));
    if (!k) return out;
    const tower = k.b.tower > 0;
    const incoming = [];
    for (const a of this.armies.values()) {
      if (a.o === k.id || a.order !== 'attack' || this.tile(a.to).o !== k.id) continue;
      const left = a.t1 - now; if (!tower && left > 15000) continue;
      const T = this.tile(a.to); incoming.push({ id: a.id, o: a.o, name: a.o ? this.kn(a.o) : a.bandits || 'Bandits', to: { q: T.q, r: T.r }, n: sumU(a.units), endsIn: Math.max(0, left), capital: !!T.cap });
    }
    const A = k.ally && this.alliances.get(k.ally);
    Object.assign(out, {
      me: this.kingdomOut(k, now),
      res: Object.fromEntries(RES.map((r) => [r, Math.floor(k.res[r])])), rates: k.rates, starving: !!k.starving,
      workers: { ...k.jobs, idle: k.peasants - JOB_KEYS.reduce((a, j) => a + k.jobs[j], 0) }, peasants: k.peasants,
      jobsOpen: this.jobsOpen(k), perWorker: Object.fromEntries(JOB_KEYS.map((j) => [j, Math.round(this.perWorker(k, j) * 100) / 100])),
      pop: this.pop(k), cap: this.cap(k), upkeep: r1(this.upkeep(k)),
      buildings: { ...k.b, castle: k.age },
      queue: k.queue.map((q, i) => ({ b: q.b, lvl: q.lvl, dur: q.dur, endsIn: i === 0 ? Math.max(0, q.end - now) : null, name: q.b === 'castle' ? `Age ${q.lvl}: ${D.AGES[q.lvl].name}` : BUILDINGS[q.b].name })),
      training: k.training.map((t, i) => ({ u: t.u, n: t.n, dur: t.dur, endsIn: i === 0 ? Math.max(0, t.end - now) : null, name: UNITS[t.u].name })),
      units: k.tiles.filter((i) => sumU(this.tile(i).units)).map((i) => { const T = this.tile(i); return { q: T.q, r: T.r, capital: !!T.cap, v: T.v, units: { ...T.units } }; }),
      myArmies: [...this.armies.values()].filter((a) => a.o === k.id).map((a) => ({ ...this.armyOut(a), units: { ...a.units }, endsIn: Math.max(0, a.t1 - now) })),
      incoming,
      research: {
        done: [...k.techs], current: k.researching ? { tech: k.researching.tech, name: TECHS[k.researching.tech].name, dur: k.researching.dur, endsIn: Math.max(0, k.researching.end - now) } : null,
        techs: Object.entries(TECHS).map(([t, T]) => { const c = this.canResearch(k, t); return { key: t, name: T.name, icon: T.icon, about: T.about, track: T.track, tier: T.tier, cost: c.cost, time: Math.round(c.time), done: k.techs.has(t), can: !!c.ok, why: c.ok ? null : c.error, missing: c.missing || null }; }),
      },
      available: this.available(k),
      alerts: k.alerts.map((x) => ({ id: x.id, text: x.text, kind: x.kind, ago: now - x.at })),
      diplomacy: {
        in: this.offers.filter((o) => o.to === k.id).map((o) => ({ id: o.id, kind: o.kind, from: o.from, name: this.kn(o.from), give: o.give || null, get: o.get || null, expiresIn: Math.max(0, o.exp - now) })),
        out: this.offers.filter((o) => o.from === k.id).map((o) => ({ id: o.id, kind: o.kind, to: o.to, name: this.kn(o.to), give: o.give || null, get: o.get || null, expiresIn: Math.max(0, o.exp - now) })),
        neighbours: k.neighbours.slice(), alliance: A ? { id: A.id, members: A.members.map((id) => ({ id, name: this.kn(id) })), monument: Math.floor(A.monument), need: this.monumentNeed() } : null,
        market: k.b.market ? { rate: MARKET_RATE[k.b.market] } : null, canGift: !!k.b.market,
      },
      rebel: this.rebelInfo(k),
      decree: (() => { const Dc = D.DECREES[k.decree]; return Dc ? { n: k.decree + 1, of: D.DECREES.length, key: Dc.key, icon: Dc.icon, title: Dc.title, hint: Dc.hint, reward: Dc.reward } : null; })(),
      bounties: this.bounties.filter((b) => b.from === k.id).map((b) => ({ on: b.on, name: this.kn(b.on), gold: b.gold, expiresIn: Math.max(0, b.exp - now) })),
      monumentAge: D.MONUMENT_AGE,
      rocket: k.b.launchpad && this.modeHas('science') ? { stage: k.stage, building: k.rocket ? k.rocket.stage : null, endsIn: k.rocket ? Math.max(0, k.rocket.end - now) : null, dur: k.rocket ? k.rocket.dur : null, cost: k.stage < 3 ? this.rocketCost(k) : null, missing: k.stage < 3 ? this.missing(k, this.rocketCost(k)) : null } : null,
    });
    return out;
  }
  available(k) {
    const pack = (c) => ({ cost: c.cost || null, time: c.time != null ? Math.round(c.time) : null, can: !!c.ok, why: c.ok ? null : c.error, missing: c.missing || null });
    const ageC = this.canBuild(k, 'castle');
    return {
      age: k.age < 5 ? { next: k.age + 1, name: D.AGES[k.age + 1].name, icon: D.AGES[k.age + 1].icon, ...pack(ageC) } : null,
      buildings: Object.entries(BUILDINGS).filter(([b, B]) => !B.science || this.modeHas('science')).map(([b, B]) => ({ b, name: B.name, icon: B.icon, about: B.about, age: B.age, lvl: k.b[b], max: B.max, ...pack(this.canBuild(k, b)) })),
      units: Object.entries(UNITS).map(([u, U]) => ({ u, name: U.name, icon: U.icon, age: U.age, atk: U.atk, def: U.def, speed: U.speed, ...pack(this.canTrain(k, u, 1)) })),
    };
  }
  defs() {
    if (!this._defs) this._defs = {
      res: D.RES_ICON, terrain: Object.fromEntries(Object.entries(D.TERRAIN).map(([t, T]) => [t, { name: T.name, icon: T.icon, pass: T.pass }])),
      units: Object.fromEntries(Object.entries(UNITS).map(([u, U]) => [u, { name: U.name, icon: U.icon, atk: U.atk, def: U.def, speed: U.speed, vs: U.vs || null }])),
      buildings: Object.fromEntries(Object.entries(BUILDINGS).map(([b, B]) => [b, { name: B.name, icon: B.icon, about: B.about }])),
      ages: D.AGES.slice(1).map((A) => ({ n: A.n, name: A.name, icon: A.icon })), jobs: Object.fromEntries(Object.entries(JOBS).map(([j, J]) => [j, { name: J.name, icon: J.icon, res: J.res }])),
      events: D.EVENTS,
    };
    return this._defs;
  }
}

module.exports = {
  key: 'kingdoms', name: 'JustKingdoms', min: 1, liveLobby: true, fields, defaults,
  create: (room, settings) => new Kingdoms(room, settings),
  _test: { Kingdoms, D, M, AI, SPEED, sumU, fightersOf },
};
