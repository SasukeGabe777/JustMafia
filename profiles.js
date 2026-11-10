'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const O = require('./public/shared/options');
const { CATALOG, ACHIEVEMENTS, REWARDS: R } = require('./public/shared/cosmetics');
const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');
class ProfileStore {
  constructor(filename = null) {
    this.filename = filename;
    this.data = filename && fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : { version: 1, profiles: {} };
    if (this.data.version !== 1 || !this.data.profiles) throw new Error('Unsupported profile store; preserve the file and migrate it before starting.');
  }
  save() {
    if (!this.filename) return;
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    fs.writeFileSync(this.filename + '.tmp', JSON.stringify(this.data)); fs.renameSync(this.filename + '.tmp', this.filename);
  }
  create() {
    const id = crypto.randomUUID(), token = crypto.randomBytes(32).toString('hex');
    this.data.profiles[id] = { id, verifier: digest(token), coins: 0, owned: CATALOG.filter((i) => i.free).map((i) => i.id), achievements: [], stats: { games: 0, wins: 0, mafiaWins: 0, jesterWins: 0, survived: 0, saves: 0, correctInvestigations: 0, objectives: 0 }, avatar: {}, rewardedGames: [], lastReward: null };
    this.data.profiles[id].avatar = this.validateAvatar(id, { outfit: 'traveler', hair: 'short' });
    this.save(); return { id, token, profile: this.view(id) };
  }
  authenticate(auth) {
    const p = auth && typeof auth.id === 'string' && Object.hasOwn(this.data.profiles, auth.id) && this.data.profiles[auth.id];
    return p && typeof auth.token === 'string' && /^[a-f0-9]{64}$/.test(auth.token) && crypto.timingSafeEqual(Buffer.from(p.verifier, 'hex'), Buffer.from(digest(auth.token), 'hex')) ? p : null;
  }
  view(id) { const p = this.data.profiles[id]; if (!p) return null; const { verifier, rewardedGames, ...view } = p; return { ...view, storage: this.filename ? 'Saved on this game server’s disk' : 'Session-only development storage' }; }
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
    if (p.coins < item.cost) return { ok: false, error: 'Not enough coins.' };
    p.coins -= item.cost; p.owned.push(item.id); this.save(); return { ok: true, profile: this.view(id) };
  }
  award(id, gameId, result) {
    const p = this.data.profiles[id]; if (!p || p.rewardedGames.includes(gameId)) return false;
    const m = result.metrics || {}, s = p.stats;
    s.games++; if (result.won) { s.wins++; if (result.team === 'mafia') s.mafiaWins++; if (result.role === 'jester') s.jesterWins++; }
    if (result.alive) s.survived++;
    for (const key of ['saves', 'correctInvestigations', 'objectives']) s[key] += Math.max(0, m[key] || 0);
    let coins = R.completed + (result.won ? R.victory : 0) + (result.alive ? R.survived : 0) + (result.won && result.team === 'neutral' ? R.neutralVictory : 0);
    coins += Math.min(R.abilityCap, m.abilities || 0) * R.ability + Math.min(R.objectiveCap, m.objectives || 0) * R.objective + Math.min(R.investigationCap, m.correctInvestigations || 0) * R.investigation;
    coins = Math.min(R.maxPerGame, coins); p.coins += coins;
    for (const [key, a] of Object.entries(ACHIEVEMENTS)) if (s[a.stat] >= a.count && !p.achievements.includes(key)) p.achievements.push(key);
    p.lastReward = { gameId, coins, reason: 'Completed game, participation and verified outcomes' }; p.rewardedGames.push(gameId); this.save(); return true;
  }
}
module.exports = { ProfileStore };
