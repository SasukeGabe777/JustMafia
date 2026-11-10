'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const O = require('./public/shared/options');
const { CATALOG, ACHIEVEMENTS, REWARDS: R, slotOf } = require('./public/shared/cosmetics');
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
    }
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
    this.data.profiles[id] = { id, verifier: digest(token), coins: 0, goldEarned: 0, goldSpent: 0, ledger: [], owned: CATALOG.filter((i) => i.free).map((i) => i.id), achievements: [], stats: { games: 0, wins: 0, mafiaWins: 0, jesterWins: 0, survived: 0, saves: 0, correctInvestigations: 0, objectives: 0 }, avatar: {}, rewardedGames: [], lastReward: null };
    this.data.profiles[id].avatar = this.validateAvatar(id, { outfit: 'traveler', hair: 'short' });
    this.save(); return { id, token, profile: this.view(id) };
  }
  authenticate(auth) {
    const p = auth && typeof auth.id === 'string' && Object.hasOwn(this.data.profiles, auth.id) && this.data.profiles[auth.id];
    return p && typeof auth.token === 'string' && /^[a-f0-9]{64}$/.test(auth.token) && crypto.timingSafeEqual(Buffer.from(p.verifier, 'hex'), Buffer.from(digest(auth.token), 'hex')) ? p : null;
  }
  view(id) { const p = this.data.profiles[id]; if (!p) return null; const { verifier, rewardedGames, ...view } = p; return { ...view, inventory: this.inventory(id), storage: this.filename ? 'Saved on this game server’s disk' : 'Session-only development storage' }; }
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
    if (item.achievement && !p.achievements.includes(item.achievement)) return { ok: false, error: ACHIEVEMENTS[item.achievement].label };
    if (p.coins < item.cost) return { ok: false, error: `Not enough gold: ${item.name} costs ${item.cost}, you have ${p.coins}.` };
    if (item.cost > 0) this.record(p, -item.cost, 'Bought ' + item.name, { item: item.id });
    p.owned.push(item.id); this.save(); return { ok: true, profile: this.view(id) };
  }
  award(id, gameId, result) {
    const p = this.data.profiles[id]; if (!p || p.rewardedGames.includes(gameId)) return false;
    const m = result.metrics || {}, s = p.stats;
    s.games++; if (result.won) { s.wins++; if (result.team === 'mafia') s.mafiaWins++; if (result.role === 'jester') s.jesterWins++; }
    if (result.alive) s.survived++;
    for (const key of ['saves', 'correctInvestigations', 'objectives']) s[key] += Math.max(0, m[key] || 0);
    let coins = R.completed + (result.won ? R.victory : 0) + (result.alive ? R.survived : 0) + (result.won && result.team === 'neutral' ? R.neutralVictory : 0);
    coins += Math.min(R.abilityCap, m.abilities || 0) * R.ability + Math.min(R.objectiveCap, m.objectives || 0) * R.objective + Math.min(R.investigationCap, m.correctInvestigations || 0) * R.investigation;
    coins = Math.min(R.maxPerGame, coins); if (coins) this.record(p, coins, 'Game reward', { gameId });
    for (const [key, a] of Object.entries(ACHIEVEMENTS)) if (s[a.stat] >= a.count && !p.achievements.includes(key)) p.achievements.push(key);
    p.lastReward = { gameId, coins, reason: 'Completed game, participation and verified outcomes' }; p.rewardedGames.push(gameId); this.save(); return true;
  }
}
module.exports = { ProfileStore };
