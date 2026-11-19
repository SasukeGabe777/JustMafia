'use strict';
// JustSummon: a tug-of-war battle for two teams, ☀️ Sunrise vs 🌙 Nightfall.
//
// One long side-view lane. Each player has a keep in their team's fortress at one end. On the
// phone you spend gold to summon troops; they march on their own, stop to fight whatever they
// meet, and push the FRONT LINE towards the enemy fortress. Troops that reach the far wall
// damage its keeps. A fallen keep turns its owner into a ghost (still summoning, on less gold).
//
// Economy: everyone earns gold every second. Every summon also adds a little to YOUR income
// for the rest of the match (an investment), and Gold Mines are pure investment. Cheap defence
// now, or a bigger income later? Teams earn XP from what they spend: Tier 2 and Tier 3 unlock
// stronger troops with their own counters, so the counter web grows as the battle goes on.
//
// Counters: damage × STRONG (1.75) when the attacker beats the defender, × WEAK (0.6) when
// it's poor against it. Flyers (Dragons) can only be hit by troops that shoot (air: true).
// Comeback: +25% damage near your own fortress (defender's bonus), up to +30% income when the
// front is pushed towards you. The last 90 seconds are the FINAL CHARGE: income ×1.5, faster
// cooldowns. The match ends when a whole fortress falls, or on time: the front line decides.
//
// The sim runs at a fixed 10 Hz (two steps per 200 ms room timer, so the screens update five
// times a second and the TV interpolates). Same-type troops summoned together merge into
// squads (one entity, several members) and every player has a troop cap, so 30 players stay
// cheap: one sort per team per step, binary-searched targets, no per-pair loops.
const GEARS = require('../../public/shared/gear'); // JustGold gear: each player's castle banner
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'length', label: 'Battle length', options: opt([[10, '10 minutes'], [15, '15 minutes'], [20, '20 minutes']]) },
  { key: 'gold', label: 'Starting gold', options: opt([[100, 'Lean (100)'], [200, 'Normal (200)'], [400, 'Rich (400)']]) },
  { key: 'pool', label: 'Troops', options: opt([['full', 'Full: Tiers 1–3'], ['basic', 'Basic: Tiers 1–2']]) },
  { key: 'balance', label: 'Uneven teams', options: opt([['ai', 'An AI ally joins the smaller side'], ['gold', 'Smaller side earns more gold'], ['off', 'Off']]) },
  { key: 'mode', label: 'Mode', options: opt([['battle', 'Battle'], ['income', 'Income race (big economies)']]) },
];
const defaults = { length: 15, gold: 200, pool: 'full', balance: 'ai', mode: 'battle' };

const DT = 0.1, TICK_MS = 200, STEPS = TICK_MS / 100; // 10 Hz sim, 5 Hz screens
const LANE = 1000, WALL = [40, 960], DIR = [1, -1];
const STRONG = 1.75, WEAK = 0.6, SPLASH_SIDE = 0.5, SPLASH_MAX = 3;
const READY_MS = 6000, SURGE_S = 90;
const KEEP_HP = 2500, TOWER_DMG = 25, TOWER_RANGE = 240, TOWER_TARGETS = 3, DEF_ZONE = 250, DEF_BONUS = 1.5, DEF_ARMOR = 0.75;
const BASE_INCOME = 10, INVEST = 0.005; // + cost × INVEST gold/s for every summon
const MINE_COST = [150, 240, 380, 600, 900, 1300], MINE_INC = 3;
const XP_T2 = 1500, XP_T3 = 5000; // team XP per commander for each tier
const TEAM_NAMES = ['Sunrise', 'Nightfall'], TEAM_ICONS = ['☀️', '🌙'];
const AI_NAMES = ['Sir Clank', 'Dame Ember', 'Old Gearbeard', 'Lady Quill', 'Captain Bolt', 'Warden Moss'];

// The troops. dmg is per member per hit; rate = seconds between hits; range/speed in lane units.
// beats: × STRONG against those; weak: × WEAK against those. air: can hit flyers. fly: only air
// attackers can hit it. siege: × against keeps. heal: heals allies instead of attacking.
const UNITS = {
  spear: { name: 'Spearmen', tier: 1, cost: 50, cd: 2.5, hp: 110, dmg: 13, rate: 1.0, range: 22, speed: 42, beats: ['rider', 'knight'], weak: ['shield', 'giant'] },
  archer: { name: 'Archers', tier: 1, cost: 60, cd: 3, hp: 70, dmg: 11, rate: 1.1, range: 150, speed: 40, air: true, beats: ['spear', 'healer', 'dragon'], weak: ['shield', 'knight'] },
  rider: { name: 'Riders', tier: 1, cost: 80, cd: 4, hp: 140, dmg: 17, rate: 1.0, range: 24, speed: 78, beats: ['archer', 'mage', 'catapult', 'healer', 'ballista'], weak: ['spear', 'giant'] },
  shield: { name: 'Shieldwall', tier: 1, cost: 70, cd: 4, hp: 250, dmg: 8, rate: 1.2, range: 22, speed: 34, beats: ['archer'], weak: [] },
  mage: { name: 'Mages', tier: 2, cost: 110, cd: 5, hp: 60, dmg: 24, rate: 1.6, range: 120, speed: 38, splash: 24, splashN: 4, air: true, beats: ['shield', 'knight', 'giant'], weak: [] },
  knight: { name: 'Knights', tier: 2, cost: 140, cd: 6, hp: 320, dmg: 26, rate: 1.1, range: 24, speed: 60, beats: ['archer', 'shield', 'catapult', 'healer'], weak: ['giant'] },
  catapult: { name: 'Catapults', tier: 2, cost: 170, cd: 8, hp: 120, dmg: 32, rate: 3.2, range: 260, min: 80, speed: 26, splash: 45, splashN: 6, siege: 3, beats: ['spear', 'shield', 'archer'], weak: ['knight', 'giant'] },
  healer: { name: 'Healers', tier: 2, cost: 100, cd: 7, hp: 90, dmg: 0, heal: 12, rate: 1.0, range: 120, speed: 38, beats: [], weak: [] },
  giant: { name: 'Giants', tier: 3, cost: 300, cd: 14, hp: 950, dmg: 48, rate: 1.8, range: 30, speed: 24, splash: 30, splashN: 2, siege: 2, beats: ['spear', 'shield', 'knight', 'rider'], weak: ['mage'] },
  dragon: { name: 'Dragons', tier: 3, cost: 340, cd: 16, hp: 440, dmg: 24, rate: 1.2, range: 110, speed: 48, splash: 40, fly: true, air: true, beats: ['spear', 'shield', 'knight', 'giant', 'healer'], weak: [] },
  ballista: { name: 'Ballistas', tier: 3, cost: 220, cd: 10, hp: 180, dmg: 75, rate: 2.2, range: 300, speed: 26, air: true, beats: ['dragon', 'giant', 'knight'], weak: ['spear', 'archer'] },
};
const KEYS = Object.keys(UNITS);
KEYS.forEach((k, i) => { UNITS[k].key = k; UNITS[k].idx = i; UNITS[k].squad = UNITS[k].tier === 3 ? 3 : 5; });
// The counter matrix: M[attacker][defender].
const M = {};
for (const a of KEYS) { M[a] = {}; for (const d of KEYS) M[a][d] = UNITS[a].beats.includes(d) ? STRONG : UNITS[a].weak.includes(d) ? WEAK : 1; }
const canHit = (a, d) => !UNITS[d].fly || !!UNITS[a].air;
const ABILITIES = {
  rally: { name: 'Rally Horn', icon: '📯', tier: 1, cost: 120, cd: 60, secs: 8, about: 'Your whole army: +35% damage and +40% speed for 8 seconds.' },
  meteor: { name: 'Meteor', icon: '☄️', tier: 2, cost: 250, cd: 90, dmg: 220, radius: 90, about: 'Smash the biggest enemy crowd near the front.' },
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r1 = (v) => Math.round(v * 10) / 10;

class Summon {
  constructor(room, s) {
    this.room = room; this.s = { ...defaults, ...s };
    this.phase = 'ready'; this.tick = 0; this.timer = null; this.readyAt = 0;
    this.cmds = new Map(); // commander id (player id or 'ai1'…) → commander
    this.teams = [0, 1].map((t) => ({ t, xp: 0, tier: 1, rallyUntil: 0, cd: { rally: 0, meteor: 0 }, tierAt: 0, spent: 0 }));
    this.units = []; this.nextId = 1; this.front = LANE / 2;
    this.ev = []; this.evSeq = 0; this.ticker = []; this.tickSeq = 0;
    this.endTick = Math.round(this.s.length * 60 / DT); this.surge = false;
    this.result = null; this.lastSup = [-99, -99]; this.lastRes = -99; this.errors = 0;
    this.income = this.s.mode === 'income';
    this.maxTier = this.s.pool === 'basic' ? 2 : 3;
  }
  now() { return this.room.now(); }
  rng() { return this.room.rng(); }

  // ---------- the cast ----------
  // Teams alternate down the list, humans first (the intro's roll call uses the same order).
  start() {
    const people = this.room.list(), order = [...people.filter((p) => !p.bot), ...people.filter((p) => p.bot)];
    order.forEach((p, i) => this.addCmd(p, i % 2));
    const n = [0, 1].map((t) => this.teamCmds(t).length);
    if (n[0] !== n[1] && this.s.balance === 'ai') {
      const small = n[0] < n[1] ? 0 : 1;
      for (let i = 0; i < Math.abs(n[0] - n[1]); i++) this.addAi(small);
    }
    this.phase = 'ready'; this.readyAt = this.now() + READY_MS;
    this.room.fx('ready');
    this.log(`⚔️ ${TEAM_ICONS[0]} Sunrise vs ${TEAM_ICONS[1]} Nightfall: summon your troops!`, 'big');
    this.timer = this.room.after(READY_MS, () => this.charge());
  }
  addCmd(p, team, ai = false) {
    const c = {
      id: p.id, name: p.name, avatar: p.avatar || '🙂', color: p.color || '#fff', team, ai: ai || !!p.bot, npc: ai,
      gold: Number(this.s.gold) || 200, inv: 0, mines: 0, cds: {}, alive: 0, keep: { hp: KEEP_HP, max: KEEP_HP }, ghost: false,
      lastAct: -1e9, acts: [], think: Math.floor(this.rng() * 15), style: this.rng(),
      st: { dmg: 0, base: 0, spent: 0, summons: 0, kills: 0, sup: 0, lost: 0, best: {} },
    };
    this.cmds.set(c.id, c); return c;
  }
  addAi(team) {
    const used = new Set([...this.cmds.values()].map((c) => c.name));
    const name = AI_NAMES.find((n) => !used.has(n + ' (AI)')) || 'Ally';
    const id = 'ai' + (this.cmds.size + 1);
    return this.addCmd({ id, name: name + ' (AI)', avatar: team ? '🦉' : '🦁', color: team ? '#8f7dff' : '#ffb347' }, team, true);
  }
  teamCmds(t) { const out = []; for (const c of this.cmds.values()) if (c.team === t) out.push(c); return out; }
  // Late joiners join the smaller team with a fresh keep.
  joined(p) {
    if (this.cmds.has(p.id) || this.phase === 'over') return;
    const n = [0, 1].map((t) => this.teamCmds(t).filter((c) => !c.npc).length);
    const t = n[0] <= n[1] ? 0 : 1, mates = this.teamCmds(t), living = mates.filter((c) => !c.ghost);
    const c = this.addCmd(p, t);
    if (living.length) c.keep.hp = Math.round(living.reduce((a, m) => a + m.keep.hp, 0) / living.length);
    if (mates.length) c.inv = mates.reduce((a, m) => a + m.inv, 0) / mates.length * 0.5;
    this.log(`🏰 ${p.name} joins ${TEAM_ICONS[t]} ${TEAM_NAMES[t]}!`, 'info');
  }
  // Someone left the room: an AI runs their keep so the team keeps its strength.
  left(p) { const c = this.cmds.get(p.id); if (c && !c.ai) { c.ai = true; this.log(`🤖 An AI captain takes over ${c.name}'s keep.`, 'info'); } }

  // ---------- the clock ----------
  charge() {
    if (this.phase !== 'ready') return;
    this.phase = 'battle'; this.room.fx('charge');
    this.log('📯 CHARGE! The battle has begun.', 'big');
    this.loop();
  }
  loop() {
    this.timer = this.room.after(TICK_MS, () => {
      if (this.phase !== 'battle') return;
      for (let i = 0; i < STEPS && this.phase === 'battle'; i++) this.safeStep();
      if (this.phase === 'battle') this.loop();
    });
  }
  safeStep() { try { this.step(); } catch (e) { this.errors++; if (this.errors < 5) console.error('[summon] step failed:', e); } }
  next() {
    if (this.phase === 'ready') { this.room.cancel(this.timer); this.charge(); return; }
    if (this.phase !== 'battle') return;
    // Skip ahead a minute (or straight to the end in the final charge).
    if (this.surge) { this.finish(null, 'time'); return; }
    for (let i = 0; i < 600 && this.phase === 'battle'; i++) this.safeStep();
    this.log('⏩ The battle skipped ahead a minute.', 'info');
  }

  // ---------- economy ----------
  incomeOf(c) {
    const T = this.teams[c.team];
    let inc = BASE_INCOME + c.inv + c.mines * MINE_INC * (this.income ? 1.5 : 1);
    if (c.ghost) inc *= 0.7;
    const behind = c.team === 0 ? (LANE / 2 - this.front) / 400 : (this.front - LANE / 2) / 400;
    inc *= 1 + 0.5 * clamp(behind, 0, 1); // comeback
    if (this.s.balance === 'gold') { const a = this.teamCmds(c.team).length, b = this.teamCmds(1 - c.team).length; if (a < b && a > 0) inc *= b / a; }
    if (this.surge) inc *= 1.5;
    void T; return inc;
  }
  mineCost(c) { const base = MINE_COST[c.mines]; return base == null ? null : Math.round(base * (this.income ? 0.7 : 1)); }
  cap() { return clamp(Math.round(160 / Math.max(1, this.cmds.size)), 8, 30); }
  xpNeed(t, tier) { const n = Math.max(1, this.teamCmds(t).length); return (tier === 2 ? XP_T2 : XP_T3) * n; }
  // Time floors: Tier 2 by 30% of the match and Tier 3 by 60% at the latest.
  checkTier(T) {
    const frac = this.tick / this.endTick;
    while (T.tier < this.maxTier) {
      const want = T.tier + 1;
      if (T.xp < this.xpNeed(T.t, want) && frac < (want === 2 ? 0.3 : 0.6)) break;
      T.tier = want; T.tierAt = this.tick;
      this.event({ k: 'tier', t: T.t, tier: want });
      this.room.fx('tier', { team: T.t, tier: want });
      const names = KEYS.filter((k) => UNITS[k].tier === want).map((k) => UNITS[k].name).join(', ');
      this.log(`${TEAM_ICONS[T.t]} ${TEAM_NAMES[T.t]} reached TIER ${want}! New troops: ${names}.`, 'tier');
    }
  }

  // ---------- phone input ----------
  limit(c) {
    const now = this.now();
    if (now - c.lastAct < 90) return 'Easy there!';
    c.acts = c.acts.filter((t) => now - t < 2000);
    if (c.acts.length >= 16) return 'Too many taps!';
    c.lastAct = now; c.acts.push(now); return null;
  }
  act(p, m) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'Unknown move.' };
    const c = this.cmds.get(p.id);
    if (!c) return { ok: false, error: 'You are watching this battle.' };
    if (m.op !== 'summon' && m.op !== 'mine' && m.op !== 'ability') return { ok: false, error: 'Unknown move.' };
    if (this.phase !== 'battle') return { ok: false, error: this.phase === 'ready' ? 'Wait for the charge!' : 'The battle is over.' };
    const lim = this.limit(c); if (lim) return { ok: false, error: lim, quiet: true };
    let r;
    if (m.op === 'summon') r = this.summon(c, m.u);
    else if (m.op === 'mine') r = this.buyMine(c);
    else r = this.ability(c, m.a);
    // The next tick (≤ 200 ms) sends the new state anyway: skip the extra broadcast.
    return { ...r, gold: Math.floor(c.gold), quiet: true };
  }
  summon(c, key) {
    if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(UNITS, key)) return { ok: false, error: 'Unknown troop.' };
    const U = UNITS[key], T = this.teams[c.team];
    if (U.tier > this.maxTier) return { ok: false, error: `${U.name} are not in this battle.` };
    if (U.tier > T.tier) return { ok: false, error: `${U.name} unlock at Tier ${U.tier}.` };
    const ready = c.cds[key] || 0; if (ready > this.tick) return { ok: false, error: `${U.name} are on cooldown.`, cd: (ready - this.tick) * 100 };
    if (c.gold < U.cost) return { ok: false, error: `Need ${Math.ceil(U.cost - c.gold)} more gold.` };
    if (c.alive >= this.cap()) return { ok: false, error: `Troop limit (${this.cap()}) reached: wait for some to fall.` };
    c.gold -= U.cost; c.inv += U.cost * INVEST * (this.income ? 2 : 1);
    c.cds[key] = this.tick + Math.round(U.cd * (this.surge ? 0.6 : 1) / DT);
    c.st.spent += U.cost; c.st.summons++; c.st.best[key] = (c.st.best[key] || 0) + 1;
    T.xp += U.cost; T.spent += U.cost; this.checkTier(T);
    this.spawn(c, key);
    this.summonLog(c, key);
    return { ok: true, cd: (c.cds[key] - this.tick) * 100 };
  }
  spawn(c, key) {
    const U = UNITS[key], t = c.team, x0 = WALL[t] + DIR[t] * 12;
    // Merge into a fresh squad of the same troop still near the gate.
    const near = this.cmds.size >= 10 ? 140 : 60;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.o === c.id && u.k === key && u.n < U.squad && !u.busy && Math.abs(u.x - x0) < near) {
        u.n++; u.hp += U.hp; u.max += U.hp; c.alive++; u.fresh = this.tick;
        this.event({ k: 'sum', t, u: key, id: u.id, o: c.id }); return u;
      }
    }
    const u = { id: this.nextId++, k: key, t, o: c.id, x: x0 + (this.rng() - 0.5) * 6, hp: U.hp, max: U.hp, n: 1, cd: 0.3 + this.rng() * 0.4, atk: 0, tx: -1, busy: false, fresh: this.tick, lane: Math.floor(this.rng() * 4) };
    this.units.push(u); c.alive++;
    this.event({ k: 'sum', t, u: key, id: u.id, o: c.id });
    return u;
  }
  summonLog(c, key) {
    const last = this.ticker[this.ticker.length - 1];
    if (last && last.o === c.id && last.u === key && this.tick - last.tk < 60) { last.n++; last.tk = this.tick; last.text = `${c.name} summoned ${last.n} ${UNITS[key].name}!`; return; }
    this.log(`${c.name} summoned ${UNITS[key].name}.`, 'sum', { o: c.id, u: key, n: 1, t: c.team });
  }
  buyMine(c) {
    const cost = this.mineCost(c);
    if (cost == null) return { ok: false, error: 'Your mines are maxed out!' };
    if (c.gold < cost) return { ok: false, error: `Need ${Math.ceil(cost - c.gold)} more gold.` };
    c.gold -= cost; c.mines++; c.st.spent += cost;
    this.teams[c.team].xp += cost * 0.5; this.checkTier(this.teams[c.team]);
    this.event({ k: 'mine', t: c.team, o: c.id });
    if (c.mines >= 3) this.log(`⛏️ ${c.name} dug Gold Mine #${c.mines}!`, 'eco', { t: c.team });
    return { ok: true, mines: c.mines };
  }
  ability(c, a) {
    if (typeof a !== 'string' || !Object.prototype.hasOwnProperty.call(ABILITIES, a)) return { ok: false, error: 'Unknown ability.' };
    const A = ABILITIES[a], T = this.teams[c.team];
    if (A.tier > T.tier) return { ok: false, error: `${A.name} unlocks at Tier ${A.tier}.` };
    if (T.cd[a] > this.tick) return { ok: false, error: `${A.name} is recharging.` };
    if (c.gold < A.cost) return { ok: false, error: `Need ${Math.ceil(A.cost - c.gold)} more gold.` };
    if (a === 'meteor') {
      const spot = this.meteorSpot(c.team); if (spot == null) return { ok: false, error: 'No enemies to hit!' };
      c.gold -= A.cost; c.st.spent += A.cost;
      let hit = 0;
      for (const u of this.units) if (u.t !== c.team && Math.abs(u.x - spot) <= A.radius) { this.hurt(u, A.dmg, c, null); hit++; }
      this.sweep();
      this.event({ k: 'meteor', t: c.team, x: Math.round(spot), o: c.id });
      this.room.fx('meteor', { team: c.team });
      this.log(`☄️ ${c.name} called down a METEOR${hit ? ` on ${hit} squad${hit === 1 ? '' : 's'}` : ''}!`, 'big', { t: c.team });
    } else {
      c.gold -= A.cost; c.st.spent += A.cost;
      T.rallyUntil = this.tick + Math.round(A.secs / DT);
      this.event({ k: 'rally', t: c.team, o: c.id });
      this.room.fx('rally', { team: c.team });
      this.log(`📯 ${c.name} sounded the RALLY HORN!`, 'big', { t: c.team });
    }
    T.cd[a] = this.tick + Math.round(A.cd / DT);
    return { ok: true };
  }
  // The enemy crowd with the most members within the meteor's radius (on the enemy front side).
  meteorSpot(team) {
    const foes = this.units.filter((u) => u.t !== team); if (!foes.length) return null;
    foes.sort((a, b) => a.x - b.x);
    let best = null, bestN = 0, j = 0, sum = 0;
    for (let i = 0; i < foes.length; i++) {
      sum += foes[i].n;
      while (foes[i].x - foes[j].x > ABILITIES.meteor.radius * 2) { sum -= foes[j].n; j++; }
      // prefer crowds closer to our own fortress
      const mid = (foes[i].x + foes[j].x) / 2, danger = 1 + (team === 0 ? (LANE - mid) : mid) / LANE;
      if (sum * danger > bestN) { bestN = sum * danger; best = mid; }
    }
    return best;
  }

  // ---------- the battle ----------
  event(e) { e.s = ++this.evSeq; e.tk = this.tick; this.ev.push(e); if (this.ev.length > 60) this.ev.shift(); }
  log(text, kind = 'info', extra = {}) { this.ticker.push({ id: ++this.tickSeq, text, kind, tk: this.tick, ...extra }); if (this.ticker.length > 8) this.ticker.shift(); }

  step() {
    this.tick++;
    const tick = this.tick;
    // income
    for (const c of this.cmds.values()) c.gold = Math.min(99999, c.gold + this.incomeOf(c) * DT);
    // final charge
    if (!this.surge && this.endTick - tick <= SURGE_S / DT) {
      this.surge = true; this.room.fx('surge');
      this.event({ k: 'surge' });
      this.log('⚡ FINAL CHARGE! Gold ×1.5 and faster summons for the last 90 seconds!', 'big');
    }
    for (const T of this.teams) this.checkTier(T);
    // sort each team by x; ground-only lists for targets that can't reach the sky
    const byTeam = [[], []];
    for (const u of this.units) byTeam[u.t].push(u);
    for (const L of byTeam) L.sort((a, b) => a.x - b.x);
    const xs = byTeam.map((L) => L.map((u) => u.x));
    const rally = this.teams.map((T) => T.rallyUntil > tick);
    // each unit: find the nearest enemy it can hit; fight it, or march
    for (const u of this.units) {
      const U = UNITS[u.k], e = 1 - u.t, dir = DIR[u.t];
      u.cd -= DT; u.busy = false; u.tx = -1;
      const spd = U.speed * (rally[u.t] ? 1.4 : 1) * DT;
      if (U.heal) { this.healStep(u, U, byTeam[u.t], xs[u.t], byTeam[e], xs[e], spd); continue; }
      const tgt = this.nearest(u, byTeam[e], xs[e], U.range + 2, U.min || 0);
      if (tgt) {
        u.busy = true; u.tx = tgt.x;
        if (u.cd <= 0) { u.cd = U.rate; u.atk = (u.atk + 1) & 255; this.strike(u, tgt, byTeam[e], xs[e], rally[u.t]); }
        continue;
      }
      // can't walk through enemy ground troops (a catapult with a foe at its feet is stuck)
      if (!U.fly && U.min && this.nearest(u, byTeam[e], xs[e], 18)) { u.busy = true; continue; }
      // the enemy wall
      const wall = WALL[e], gap = (wall - u.x) * dir;
      if (gap <= U.range + 4) {
        u.busy = true; u.tx = wall;
        if (u.cd <= 0) { u.cd = U.rate; u.atk = (u.atk + 1) & 255; this.hitKeep(u, U, e, rally[u.t]); }
        continue;
      }
      u.x += dir * Math.min(spd, gap - U.range);
    }
    this.towers(byTeam, xs);
    this.sweep();
    this.updateFront(byTeam);
    // AI captains
    for (const c of this.cmds.values()) if (c.ai && (tick + c.think) % 15 === 0 && this.phase === 'battle') this.botThink(c);
    if (this.phase === 'battle' && tick >= this.endTick) this.finish(null, 'time');
  }
  // Nearest enemy within `reach` that this unit can hit (binary search, then walk outwards).
  nearest(u, L, X, reach, min = 0) {
    if (!L.length) return null;
    let lo = 0, hi = X.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (X[m] < u.x) lo = m + 1; else hi = m; }
    let i = lo - 1, j = lo, best = null, bd = reach;
    for (let s = 0; s < 40 && (i >= 0 || j < L.length); s++) {
      const di = i >= 0 ? u.x - X[i] : Infinity, dj = j < L.length ? X[j] - u.x : Infinity;
      if (Math.min(di, dj) > bd) break;
      if (di <= dj) { const v = L[i--]; if (v.hp > 0 && di >= min && canHit(u.k, v.k) && di <= bd) { best = v; bd = di; break; } }
      else { const v = L[j++]; if (v.hp > 0 && dj >= min && canHit(u.k, v.k) && dj <= bd) { best = v; bd = dj; break; } }
    }
    return best;
  }
  bonus(u, rally) { const home = Math.abs(u.x - WALL[u.t]) <= DEF_ZONE; return (rally ? 1.35 : 1) * (home ? DEF_BONUS : 1); }
  strike(u, tgt, L, X, rally) {
    const U = UNITS[u.k], c = this.cmds.get(u.o), base = U.dmg * u.n * this.bonus(u, rally);
    const mult = M[u.k][tgt.k];
    this.hurt(tgt, base * mult, c, u);
    if (mult > 1 && this.tick - this.lastSup[u.t] >= 5) { this.lastSup[u.t] = this.tick; this.event({ k: 'sup', t: u.t, x: Math.round(tgt.x), a: u.k, d: tgt.k }); }
    else if (mult < 1 && this.tick - this.lastRes >= 25) { this.lastRes = this.tick; this.event({ k: 'res', t: u.t, x: Math.round(tgt.x), a: u.k, d: tgt.k }); }
    if (c && mult > 1) c.st.sup++;
    if (U.splash) {
      let lo = 0, hi = X.length; const a = tgt.x - U.splash;
      while (lo < hi) { const m = (lo + hi) >> 1; if (X[m] < a) lo = m + 1; else hi = m; }
      let side = 0; // at most SPLASH_MAX others, so a swarm still beats one big splasher
      for (let i = lo; i < L.length && X[i] <= tgt.x + U.splash && side < (U.splashN || SPLASH_MAX); i++) { const v = L[i]; if (v !== tgt && v.hp > 0 && canHit(u.k, v.k)) { this.hurt(v, base * M[u.k][v.k] * SPLASH_SIDE, c, u); side++; } }
    }
  }
  hurt(v, dmg, c, by) {
    if (v.hp <= 0) return;
    if (Math.abs(v.x - WALL[v.t]) <= DEF_ZONE) dmg *= DEF_ARMOR; // dug in at home
    const done = Math.min(v.hp, dmg);
    v.hp -= dmg;
    if (c) c.st.dmg += done;
    if (v.hp <= 0) { v.hp = 0; if (c) c.st.kills += v.n; }
    void by;
  }
  hitKeep(u, U, team, rally) {
    const keeps = this.teamCmds(team).filter((c) => !c.ghost);
    if (!keeps.length) return;
    const k = keeps.reduce((a, b) => (b.keep.hp < a.keep.hp ? b : a)); // focus the weakest keep
    const c = this.cmds.get(u.o), dmg = U.dmg * u.n * (U.siege || 1) * (rally ? 1.35 : 1) * 0.6;
    const done = Math.min(k.keep.hp, dmg);
    k.keep.hp -= dmg; if (c) { c.st.base += done; c.st.dmg += done * 0.25; }
    const prev = this.ev[this.ev.length - 1];
    if (!(prev && prev.k === 'keep' && prev.id === k.id && this.tick - prev.tk < 4)) this.event({ k: 'keep', t: team, id: k.id, x: WALL[team] });
    if (k.keep.hp <= 0) this.keepDown(k, c);
  }
  keepDown(k, by) {
    k.keep.hp = 0; k.ghost = true;
    this.event({ k: 'down', t: k.team, id: k.id });
    this.room.fx('keepdown', { team: k.team });
    this.log(`💥 ${k.name}'s keep has FALLEN${by ? ` to ${by.name}` : ''}! ${k.name} fights on as a 👻 ghost.`, 'down', { t: k.team });
    if (this.teamCmds(k.team).every((c) => c.ghost)) this.finish(1 - k.team, 'fortress');
  }
  healStep(u, U, mine, mx, foes, fx, spd) {
    // hold back once enemies are close; heal the most hurt ally in range
    const threat = this.nearest(u, foes, fx, 170);
    let lo = 0, hi = mx.length; const a = u.x - U.range;
    while (lo < hi) { const m = (lo + hi) >> 1; if (mx[m] < a) lo = m + 1; else hi = m; }
    let best = null, worst = 0.999;
    for (let i = lo; i < mine.length && mx[i] <= u.x + U.range; i++) { const v = mine[i]; if (v !== u && v.hp > 0 && v.hp / v.max < worst) { worst = v.hp / v.max; best = v; } }
    if (best) {
      u.busy = true; u.tx = best.x;
      if (u.cd <= 0) { u.cd = U.rate; u.atk = (u.atk + 1) & 255; const amt = Math.min(best.max - best.hp, U.heal * u.n); best.hp += amt; const c = this.cmds.get(u.o); if (c) c.st.dmg += amt * 0.8; }
    }
    if (threat || best) return;
    const wall = WALL[1 - u.t], gap = (wall - u.x) * DIR[u.t];
    if (gap > 140) u.x += DIR[u.t] * Math.min(spd, gap - 140);
  }
  // Every standing keep shoots one arrow a second at the nearest enemy near its wall.
  towers(byTeam, xs) {
    for (const t of [0, 1]) {
      if ((this.tick + t * 5) % 10) continue;
      const shots = this.teamCmds(t).filter((c) => !c.ghost).length; if (!shots) continue;
      const foes = byTeam[1 - t]; if (!foes.length) continue;
      // the foes nearest the wall (sorted by x: the low end for Sunrise, the high end for Nightfall)
      const hit = [];
      for (let i = 0; i < foes.length && hit.length < TOWER_TARGETS; i++) { const v = t === 0 ? foes[i] : foes[foes.length - 1 - i]; if (Math.abs(v.x - WALL[t]) > TOWER_RANGE) break; if (v.hp > 0) hit.push(v); }
      if (!hit.length) continue;
      for (const v of hit) { v.hp -= (TOWER_DMG * shots) / hit.length; if (v.hp < 0) v.hp = 0; }
      this.event({ k: 'tw', t, x: Math.round(hit[0].x), n: Math.min(6, shots) });
    }
  }
  // Remove the fallen, recount squads and every player's troops.
  sweep() {
    for (const c of this.cmds.values()) c.alive = 0;
    const keep = [];
    for (const u of this.units) {
      const U = UNITS[u.k];
      if (u.hp <= 0) { const c = this.cmds.get(u.o); if (c) c.st.lost += u.n; if (U.tier === 3) this.event({ k: 'die', t: u.t, u: u.k, x: Math.round(u.x) }); continue; }
      u.n = Math.max(1, Math.ceil(u.hp / U.hp - 1e-6)); u.max = Math.max(u.n * U.hp, u.hp);
      const c = this.cmds.get(u.o); if (c) c.alive += u.n;
      keep.push(u);
    }
    this.units = keep;
  }
  updateFront(byTeam) {
    let f0 = -1, f1 = LANE + 1;
    for (const u of byTeam[0]) if (!UNITS[u.k].fly && u.x > f0) f0 = u.x;
    for (const u of byTeam[1]) if (!UNITS[u.k].fly && u.x < f1) f1 = u.x;
    let raw;
    if (f0 >= 0 && f1 <= LANE) raw = (f0 + f1) / 2;
    else if (f0 >= 0) raw = Math.max(f0, this.front);
    else if (f1 <= LANE) raw = Math.min(f1, this.front);
    else raw = this.front + (LANE / 2 - this.front) * 0.01;
    this.front += (clamp(raw, WALL[0], WALL[1]) - this.front) * 0.08;
  }

  // ---------- the end ----------
  finish(winner, reason) {
    if (this.phase === 'over') return;
    if (winner == null) {
      // On time: the front line decides; a near-draw goes to the healthier fortress.
      const hp = [0, 1].map((t) => { const cs = this.teamCmds(t); return cs.reduce((a, c) => a + c.keep.hp, 0) / Math.max(1, cs.length * KEEP_HP); });
      if (this.front > LANE / 2 + 15) winner = 0; else if (this.front < LANE / 2 - 15) winner = 1;
      else winner = hp[0] > hp[1] + 0.01 ? 0 : hp[1] > hp[0] + 0.01 ? 1 : this.front > LANE / 2 ? 0 : this.front < LANE / 2 ? 1 : -1;
      reason = winner < 0 ? 'draw' : Math.abs(this.front - LANE / 2) > 15 ? 'front' : 'keeps';
    }
    this.phase = 'over'; this.room.cancel(this.timer);
    const rows = this.standings();
    this.result = { winner, reason, front: Math.round(this.front), mvp: rows[0] ? rows[0].id : null, awards: this.awards() };
    this.event({ k: 'win', t: winner });
    this.room.fx('win', { team: winner });
    this.log(winner < 0 ? '🤝 A DRAW! Neither army would give an inch.' : `🏆 ${TEAM_ICONS[winner]} ${TEAM_NAMES[winner].toUpperCase()} WINS THE BATTLE!`, 'big');
  }
  score(c) { return Math.round(c.st.dmg + 2 * c.st.base + 0.25 * c.st.spent); }
  standings() {
    const w = this.result ? this.result.winner : null;
    return [...this.cmds.values()].map((c) => ({ id: c.id, name: c.name, avatar: c.avatar, color: c.color, team: c.team, npc: c.npc, score: this.score(c), dmg: Math.round(c.st.dmg), base: Math.round(c.st.base), spent: c.st.spent, kills: c.st.kills, ghost: c.ghost }))
      .sort((a, b) => ((b.team === w) - (a.team === w)) || b.score - a.score);
  }
  awards() {
    const cs = [...this.cmds.values()]; if (!cs.length) return [];
    const top = (f) => cs.reduce((a, b) => (f(b) > f(a) ? b : a));
    const out = [], add = (c, icon, title, why) => { if (c) out.push({ id: c.id, name: c.name, avatar: c.avatar, team: c.team, icon, title, why }); };
    const d = top((c) => c.st.dmg); add(d, '⚔️', 'Warlord', `${Math.round(d.st.dmg)} damage dealt`);
    const b = top((c) => c.st.base); if (b.st.base > 0) add(b, '🏚️', 'Wall Breaker', `${Math.round(b.st.base)} damage to keeps`);
    const s = top((c) => c.st.sup); if (s.st.sup > 0) add(s, '🎯', 'Counter King', `${s.st.sup} super-effective hits`);
    const i = top((c) => c.inv + c.mines * MINE_INC); add(i, '💰', 'Tycoon', `${r1(this.incomeBase(i))} gold a second`);
    return out;
  }
  incomeBase(c) { return BASE_INCOME + c.inv + c.mines * MINE_INC * (this.income ? 1.5 : 1); }
  // Party points: the winning team first, each team by contribution (damage, keeps, gold spent).
  results() { return this.phase === 'over' ? this.standings().filter((r) => this.room.get(r.id)).map((r) => r.id) : []; }

  // ---------- AI captains (bots and AI allies) ----------
  botThink(c) {
    const T = this.teams[c.team], frac = this.tick / this.endTick, e = 1 - c.team;
    // invest early
    const mc = this.mineCost(c);
    if (mc != null && c.gold >= mc && ((frac < 0.25 && c.mines < (this.income ? 3 : 2)) || (frac < 0.5 && c.gold > mc * 2.5 && c.mines < 4)) && this.rng() < 0.6) { this.buyMine(c); return; }
    // what's coming at us: enemies weighted by how close they are to our wall
    const threat = {}; let foes = 0, near = 0;
    for (const u of this.units) {
      if (u.t !== e) continue;
      const prox = 1 - Math.abs(u.x - WALL[c.team]) / LANE;
      threat[u.k] = (threat[u.k] || 0) + u.n * UNITS[u.k].cost * (0.4 + prox * prox * 1.6); foes += u.n;
      if (Math.abs(u.x - WALL[c.team]) < 300) near += u.n;
    }
    // abilities
    if (T.tier >= 2 && T.cd.meteor <= this.tick && c.gold >= ABILITIES.meteor.cost + 40 && near >= 6 && this.rng() < 0.5) { this.ability(c, 'meteor'); return; }
    const have = {}; let mine = 0;
    for (const u of this.units) if (u.t === c.team) { have[u.k] = (have[u.k] || 0) + u.n; mine += u.n; }
    if (T.cd.rally <= this.tick && c.gold >= ABILITIES.rally.cost + 60 && mine >= 10 && this.rng() < 0.25) { this.ability(c, 'rally'); return; }
    if (c.alive >= this.cap()) return;
    // score every troop we could summon: counters against the threat, plus a bit of taste
    let best = null, bestScore = -1e9, save = null, saveScore = -1e9;
    for (const k of KEYS) {
      const U = UNITS[k]; if (U.tier > T.tier || U.tier > this.maxTier) continue;
      let sc = 0;
      for (const d in threat) {
        const out = canHit(k, d) ? M[k][d] : 0, inn = canHit(d, k) ? M[d][k] : 0;
        sc += threat[d] * (out - inn * 0.8);
      }
      if (U.heal) sc = mine >= 6 ? 120 : -50;
      if (!foes) sc = (U.tier === 1 ? 40 : 60) + (k === ['spear', 'archer', 'rider', 'shield'][Math.floor(c.style * 4)] ? 40 : 0);
      sc = sc / Math.sqrt(U.cost) + U.tier * 2 + (this.rng() - 0.5) * 6 - 14 * ((have[k] || 0) / Math.max(4, mine)); // keep a mixed army
      if (U.tier === 3) sc += 4 * frac;
      const ready = (c.cds[k] || 0) <= this.tick;
      if (ready && c.gold >= U.cost && sc > bestScore) { bestScore = sc; best = k; }
      if (sc > saveScore) { saveScore = sc; save = k; }
    }
    // save up for a much better pick if it's only a few seconds away
    if (save && save !== best && saveScore > bestScore + 3 && (UNITS[save].cost - c.gold) / this.incomeOf(c) < 6 && near < 4) return;
    if (best && (near > 0 || c.gold >= UNITS[best].cost * (1.2 + c.style) || frac > 0.85)) this.summon(c, best);
  }

  // ---------- what the screens see ----------
  endsIn() { return this.phase === 'battle' ? Math.max(0, (this.endTick - this.tick) * 100) : this.phase === 'ready' ? Math.max(0, this.readyAt - this.now()) : 0; }
  teamTv(t) {
    const T = this.teams[t], cs = this.teamCmds(t);
    const need = T.tier < this.maxTier ? this.xpNeed(t, T.tier + 1) : 0, prev = T.tier === 1 ? 0 : T.tier === 2 ? this.xpNeed(t, 2) : this.xpNeed(t, 3);
    return {
      tier: T.tier, xp: Math.round(T.xp), need, prev, rally: Math.max(0, (T.rallyUntil - this.tick) * 100),
      cd: { rally: Math.max(0, (T.cd.rally - this.tick) * 100), meteor: Math.max(0, (T.cd.meteor - this.tick) * 100) },
      income: r1(cs.reduce((a, c) => a + this.incomeOf(c), 0)), gold: Math.floor(cs.reduce((a, c) => a + c.gold, 0)),
      troops: this.units.reduce((a, u) => a + (u.t === t ? u.n : 0), 0),
      // gear: the keep owner's castle banner (JustGold shop), flown over their tower on the TV
      keeps: cs.map((c) => ({ id: c.id, name: c.name, avatar: c.avatar, color: c.color, hp: Math.round(c.keep.hp), max: c.keep.max, ghost: c.ghost, ai: c.npc, gear: GEARS.gearSet(c.npc ? null : this.room.get(c.id), 'summon') })),
    };
  }
  tv() {
    const u = [];
    for (const x of this.units) u.push(x.id, UNITS[x.k].idx, x.t, Math.round(x.x * 10) / 10, Math.round((x.hp / x.max) * 100), x.n, x.atk, x.tx < 0 ? -1 : Math.round(x.tx), x.lane);
    return {
      phase: this.phase, tk: this.tick, endsIn: this.endsIn(), length: this.s.length, surge: this.surge, front: r1(this.front),
      maxTier: this.maxTier, defs: KEYS.map((k) => [UNITS[k].cost, UNITS[k].cd]),
      teams: [this.teamTv(0), this.teamTv(1)], u, ev: this.ev.slice(-40), ticker: this.ticker.slice(-6),
      result: this.result, standings: this.phase === 'over' ? this.standings() : null,
    };
  }
  view(p) {
    const c = this.cmds.get(p.id);
    const base = { phase: this.phase, endsIn: this.endsIn(), surge: this.surge, front: r1(this.front), maxTier: this.maxTier, defs: KEYS.map((k) => [UNITS[k].cost, UNITS[k].cd]) };
    if (!c) return { ...base, watching: true };
    const T = this.teams[c.team], need = T.tier < this.maxTier ? this.xpNeed(c.team, T.tier + 1) : 0;
    const prev = T.tier === 1 ? 0 : this.xpNeed(c.team, T.tier);
    const out = {
      ...base, team: c.team, gear: GEARS.gearSet(p, 'summon'), gold: r1(c.gold), income: r1(this.incomeOf(c)), invest: r1(c.inv), mines: c.mines, mineCost: this.mineCost(c), mineInc: MINE_INC * (this.income ? 1.5 : 1),
      tier: T.tier, xp: Math.round(T.xp), need, prev, alive: c.alive, cap: this.cap(), ghost: c.ghost, keep: { hp: Math.round(c.keep.hp), max: c.keep.max },
      cds: KEYS.map((k) => Math.max(0, ((c.cds[k] || 0) - this.tick) * 100)),
      ab: Object.keys(ABILITIES).map((a) => Math.max(0, (T.cd[a] - this.tick) * 100)), rally: T.rallyUntil > this.tick,
      fort: [0, 1].map((t) => { const cs = this.teamCmds(t); return Math.round(100 * cs.reduce((a, m) => a + m.keep.hp, 0) / Math.max(1, cs.length * KEEP_HP)); }),
      st: { dmg: Math.round(c.st.dmg), base: Math.round(c.st.base), summons: c.st.summons, kills: c.st.kills },
    };
    if (this.phase === 'over' && this.result) {
      const rows = this.standings(), i = rows.findIndex((r) => r.id === c.id), mates = rows.filter((r) => r.team === c.team);
      out.over = { winner: this.result.winner, reason: this.result.reason, won: this.result.winner === c.team, rank: i + 1, of: rows.length, teamRank: mates.findIndex((r) => r.id === c.id) + 1, score: this.score(c), awards: this.result.awards.filter((a) => a.id === c.id), mvp: rows[0] && rows[0].id === c.id };
    }
    return out;
  }
}

module.exports = {
  key: 'summon', name: 'JustSummon', min: 2, best: [2, 8], fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/summon.js)
  howSteps: 6, // the how-to-play step after the intro has six cards (tutorial in the intro file)
  create: (room, settings) => new Summon(room, settings),
  UNITS, KEYS, M, ABILITIES, STRONG, WEAK, WALL, KEEP_HP, canHit,
};
