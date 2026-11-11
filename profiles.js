'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const O = require('./public/shared/options');
const { CATALOG, ACHIEVEMENTS, REWARDS: R, slotOf, SEASON, CHALLENGES, weekKey, weeklyChallenges, EVENTS } = require('./public/shared/cosmetics');
const freshPass = () => ({ season: SEASON.id, owned: false, xp: 0, granted: [] });
const LEDGER_MAX = 20;
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');
class ProfileStore {
  constructor(filename = null) {
    this.filename = filename;
    this.data = filename && fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : { version: 1, profiles: {} };
    if (this.data.version !== 1 || !this.data.profiles) throw new Error('Unsupported profile store; preserve the file and migrate it before starting.');
    // Gold pouch fields (older profiles only had a balance: count it all as earned).
    for (const p of Object.values(this.data.profiles)) {
      if (p.goldEarned == null) p.goldEarned = p.coins || 0;
      if (p.goldSpent == null) p.goldSpent = 0;
      if (!Array.isArray(p.ledger)) p.ledger = [];
      if (!p.pass || p.pass.season !== SEASON.id) p.pass = freshPass(); // a new season starts everyone at tier 0
    }
  }
  // ----- Season pass -----
  seasonTier(p) { return Math.min(SEASON.tiers, Math.floor((p.pass.xp || 0) / SEASON.xpPerTier)); }
  // Grant every reached tier's reward that hasn't been granted yet (only with the pass).
  grantPass(p) {
    const out = [];
    if (!p.pass.owned) return out;
    for (let tier = 1; tier <= this.seasonTier(p); tier++) {
      if (p.pass.granted.includes(tier)) continue;
      const r = SEASON.rewards[tier] || {};
      if (r.gold) { this.record(p, r.gold, `Season pass tier ${tier}`); out.push({ tier, gold: r.gold }); }
      if (r.item && !p.owned.includes(r.item)) { p.owned.push(r.item); out.push({ tier, item: r.item }); }
      p.pass.granted.push(tier);
    }
    return out;
  }
  buyPass(id) {
    const p = this.data.profiles[id]; if (!p) return { ok: false, error: 'No profile.' };
    if (p.pass.owned) return { ok: false, error: 'You already have the season pass.' };
    if (p.coins < SEASON.cost) return { ok: false, error: `Not enough gold: the pass costs ${SEASON.cost}, you have ${p.coins}.` };
    this.record(p, -SEASON.cost, `${SEASON.name} pass`);
    p.pass.owned = true;
    const rewards = this.grantPass(p); // every tier already reached pays out now
    this.save(); return { ok: true, rewards, profile: this.view(id) };
  }
  // This week's challenges for a profile (a new week starts fresh).
  weekOf(p) {
    const week = weekKey();
    if (!p.challenges || p.challenges.week !== week) p.challenges = { week, ids: weeklyChallenges(week), progress: {}, done: [] };
    return p.challenges;
  }
  seasonView(p) {
    const tier = this.seasonTier(p), w = this.weekOf(p);
    return {
      id: SEASON.id, name: SEASON.name, cost: SEASON.cost, tiers: SEASON.tiers, xpPerTier: SEASON.xpPerTier, rewards: SEASON.rewards,
      owned: p.pass.owned, xp: p.pass.xp, tier, granted: p.pass.granted,
      challenges: w.ids.map((k) => ({ id: k, label: CHALLENGES[k].label, count: CHALLENGES[k].count, gold: CHALLENGES[k].gold, progress: Math.min(CHALLENGES[k].count, w.progress[k] || 0), done: w.done.includes(k) })),
      week: w.week,
    };
  }
  // Gold pouch: balance (coins), lifetime earned and spent, and recent entries.
  record(p, delta, reason, extra = {}) {
    if (delta > 0) p.goldEarned += delta; else p.goldSpent += -delta;
    p.coins += delta;
    p.ledger.unshift({ at: Date.now(), delta, reason, balance: p.coins, ...extra });
    p.ledger.length = Math.min(p.ledger.length, LEDGER_MAX);
  }
  // Inventory: owned shop items (free starter items are left out), with equipped state.
  inventory(id) {
    const p = this.data.profiles[id]; if (!p) return [];
    return CATALOG.filter((i) => !i.free && p.owned.includes(i.id)).map((i) => {
      const slot = slotOf(i.field), source = slot.target === 'home' ? p.home || {} : p.avatar || {};
      return { id: i.id, field: i.field, value: i.value, name: i.name, category: i.category, target: slot.target, equipped: source[slot.key] === i.value };
    });
  }
  // Equip or unequip an owned item on the saved character / house design.
  equip(id, itemId, on = true) {
    const p = this.data.profiles[id], item = CATALOG.find((i) => i.id === itemId);
    if (!p || !item) return { ok: false, error: 'Unknown item.' };
    if (!item.free && !p.owned.includes(item.id)) return { ok: false, error: 'Buy this item first.' };
    const slot = slotOf(item.field), list = O[O.HOME_FIELDS[slot.key] || O.AVATAR_FIELDS[slot.key]] || [];
    const value = on ? item.value : list[0];
    if (slot.target === 'home') p.home = this.validateHome(id, { ...(p.home || {}), [slot.key]: value });
    else { p.avatar = this.validateAvatar(id, { ...p.avatar, [slot.key]: value }); p.lookSaved = true; }
    this.save(); return { ok: true, target: slot.target, key: slot.key, value, profile: this.view(id) };
  }
  // Test/dev only (server enables it with MT_DEV_GRANTS=1): add gold.
  grant(id, amount, reason = 'Test grant') {
    const p = this.data.profiles[id], n = Math.max(0, Math.min(100000, Math.floor(Number(amount) || 0)));
    if (!p || !n) return false; this.record(p, n, reason); this.save(); return true;
  }
  save() {
    if (!this.filename) return;
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    fs.writeFileSync(this.filename + '.tmp', JSON.stringify(this.data)); fs.renameSync(this.filename + '.tmp', this.filename);
  }
  create() {
    const id = crypto.randomUUID(), token = crypto.randomBytes(32).toString('hex');
    this.data.profiles[id] = { id, verifier: digest(token), coins: 0, goldEarned: 0, goldSpent: 0, ledger: [], owned: CATALOG.filter((i) => i.free).map((i) => i.id), achievements: [], stats: { games: 0, wins: 0, mafiaWins: 0, jesterWins: 0, survived: 0, saves: 0, correctInvestigations: 0, objectives: 0 }, avatar: {}, rewardedGames: [], lastReward: null, pass: freshPass() };
    this.data.profiles[id].avatar = this.validateAvatar(id, { outfit: 'traveler', hair: 'short' });
    this.save(); return { id, token, profile: this.view(id) };
  }
  authenticate(auth) {
    const p = auth && typeof auth.id === 'string' && Object.hasOwn(this.data.profiles, auth.id) && this.data.profiles[auth.id];
    return p && typeof auth.token === 'string' && /^[a-f0-9]{64}$/.test(auth.token) && crypto.timingSafeEqual(Buffer.from(p.verifier, 'hex'), Buffer.from(digest(auth.token), 'hex')) ? p : null;
  }
  view(id) { const p = this.data.profiles[id]; if (!p) return null; const { verifier, rewardedGames, ...view } = p; return { ...view, season: this.seasonView(p), inventory: this.inventory(id), storage: this.filename ? 'Saved on this game server’s disk' : 'Session-only development storage' }; }
  validateAvatar(id, input = {}) {
    const p = this.data.profiles[id], result = {};
    // Expression has its own migration rule below.
    for (const [key, list] of Object.entries(O.AVATAR_FIELDS)) {
      if (key === 'expression') continue;
      const value = input[key] == null ? p && p.avatar[key] : input[key];
      result[key] = O[list].includes(value) ? value : O[list][0];
      const item = CATALOG.find((i) => i.field === key && i.value === result[key]);
      if (item && !item.free && !(p && p.owned.includes(item.id))) result[key] = O[list][0];
    }
    // Expressions are free; legacy features:'serious' becomes the Serious expression.
    const mood = input.expression == null ? p && p.avatar.expression : input.expression;
    result.expression = O.expression.includes(mood) ? mood : (input.features || p && p.avatar.features) === 'serious' ? 'serious' : O.expression[0];
    return result;
  }
  // House design. Unset/invalid fields are omitted so the room fills them (random
  // style/wall). Shop decor needs ownership. Older profiles kept the home on the avatar.
  validateHome(id, input = {}) {
    const p = this.data.profiles[id], saved = p && p.home || {}, legacy = p && p.avatar || {}, result = {};
    input = input && typeof input === 'object' ? input : {};
    for (const [key, list] of Object.entries(O.HOME_FIELDS)) {
      // First valid (and owned) of: this input, the saved design, a legacy avatar field.
      const usable = (v) => O[list].includes(v) && (() => { const item = CATALOG.find((i) => i.field === list && i.value === v); return !item || item.free || (p && p.owned.includes(item.id)); })();
      const value = [input[key], saved[key], O.LEGACY_HOME[key] && legacy[O.LEGACY_HOME[key]]].find(usable);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  selectHome(id, home) { const p = this.data.profiles[id]; if (!p) return; p.home = this.validateHome(id, home); this.save(); }
  select(id, avatar) { const p = this.data.profiles[id]; if (!p) return; p.avatar = this.validateAvatar(id, avatar); p.lookSaved = true; this.save(); }
  buy(id, itemId) {
    const p = this.data.profiles[id], item = CATALOG.find((i) => i.id === itemId);
    if (!p || !item || p.owned.includes(item.id)) return { ok: false, error: 'Choose a locked catalog item.' };
    if (item.pass) return { ok: false, error: `Season pass reward: reach tier ${item.passTier} of the ${SEASON.name} pass.` };
    if (item.achievement && !p.achievements.includes(item.achievement)) return { ok: false, error: ACHIEVEMENTS[item.achievement].label };
    if (p.coins < item.cost) return { ok: false, error: `Not enough gold: ${item.name} costs ${item.cost}, you have ${p.coins}.` };
    if (item.cost > 0) this.record(p, -item.cost, 'Bought ' + item.name, { item: item.id });
    p.owned.push(item.id); this.save(); return { ok: true, profile: this.view(id) };
  }
  // Pays one completed game's gold, once per game id, and returns the breakdown
  // (each line: what it was for and how much). Values and caps live in REWARDS.
  award(id, gameId, result) {
    const p = this.data.profiles[id]; if (!p || p.rewardedGames.includes(gameId)) return false;
    const m = result.metrics || {}, s = p.stats, lines = [];
    s.games++; if (result.won) { s.wins++; if (result.team === 'mafia') s.mafiaWins++; if (result.role === 'jester') s.jesterWins++; }
    if (result.alive) s.survived++;
    for (const key of ['saves', 'correctInvestigations', 'objectives', 'executionerSaves']) s[key] = (s[key] || 0) + Math.max(0, m[key] || 0);
    const add = (key, label, amount) => { if (amount > 0) lines.push({ key, label, amount }); };
    const capped = (n, cap) => Math.min(cap, Math.max(0, n || 0));
    add('completed', 'Finished the game', R.completed);
    if (result.won) add('victory', 'Your side won', R.victory);
    if (result.won && result.team === 'neutral') add('neutral', 'Neutral victory bonus', R.neutralVictory);
    if (result.alive) add('survived', 'Survived to the end', R.survived);
    const ab = capped(m.abilities, R.abilityCap); add('abilities', `Role actions (${ab}${(m.abilities || 0) > ab ? ', capped' : ''})`, ab * R.ability);
    const ob = capped(m.objectives, R.objectiveCap); add('objectives', `Objectives completed (${ob})`, ob * R.objective);
    const inv = capped(m.correctInvestigations, R.investigationCap); add('investigations', `Correct investigations (${inv})`, inv * R.investigation);
    const sv = capped(m.saves, R.saveCap); add('saves', `Helped teammates: saves (${sv})`, sv * R.save);
    const unlocked = Object.entries(ACHIEVEMENTS).filter(([key, a]) => s[a.stat] >= a.count && !p.achievements.includes(key));
    for (const [key, a] of unlocked) { p.achievements.push(key); add('achievement', `Achievement: ${a.label}`, R.achievement); }
    const raw = lines.reduce((t, l) => t + l.amount, 0), capped0 = Math.min(R.maxPerGame, raw);
    const before = p.coins;
    if (capped0) this.record(p, capped0, 'Game reward', { gameId });
    // Weekly challenges (paid on top of the per-game cap, once each).
    const w = this.weekOf(p), delta = { games: 1, wins: result.won ? 1 : 0, survived: result.alive ? 1 : 0, saves: m.saves || 0, correctInvestigations: m.correctInvestigations || 0, mafiaWins: result.won && result.team === 'mafia' ? 1 : 0, abilities: m.abilities || 0 };
    let challengesDone = 0;
    for (const k of w.ids) {
      if (w.done.includes(k)) continue;
      const c = CHALLENGES[k]; w.progress[k] = (w.progress[k] || 0) + (delta[c.stat] || 0);
      if (w.progress[k] >= c.count) { w.done.push(k); challengesDone++; this.record(p, c.gold, `Weekly challenge: ${c.label}`); lines.push({ key: 'challenge', label: `Weekly challenge: ${c.label}`, amount: c.gold }); }
    }
    // Season pass XP (everyone earns it; rewards need the pass). Events can multiply it.
    const X = SEASON.xp, mult = (EVENTS[result.event] || {}).xpMultiplier || 1;
    const xp = (X.completed + (result.won ? X.won : 0) + (result.alive ? X.survived : 0) + challengesDone * X.challenge) * mult;
    const tierBefore = this.seasonTier(p); p.pass.xp += xp;
    const passRewards = this.grantPass(p);
    for (const r of passRewards) if (r.gold) lines.push({ key: 'pass', label: `Season pass tier ${r.tier}`, amount: r.gold });
    const coins = p.coins - before;
    p.lastReward = { gameId, coins, before, after: p.coins, lines, capped: raw > capped0 ? R.maxPerGame : null, at: Date.now(),
      season: { xp, multiplier: mult, tierBefore, tierAfter: this.seasonTier(p), owned: p.pass.owned, items: passRewards.filter((r) => r.item).map((r) => r.item) } };
    p.rewardedGames.push(gameId); this.save();
    return p.lastReward;
  }
}
module.exports = { ProfileStore };
