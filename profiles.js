'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const O = require('./public/shared/options');
const { CATALOG, ACHIEVEMENTS, REWARDS: R, slotOf, EVENTS, WORLD_REWARDS, WORLD_NAMES, STOCK, STOCKABLE, STARTER_STOCK, nextStock, FATE } = require('./public/shared/cosmetics');
const STOCKABLE_IDS = new Set(STOCKABLE.map((i) => i.id));
// Per-game gear for the JustGold shop (public/shared/gear.js); empty until that file exists.
let GEAR = []; try { ({ GEAR } = require('./public/shared/gear')); if (!Array.isArray(GEAR)) GEAR = []; } catch (e) { GEAR = []; }
const gearItem = (id) => GEAR.find((g) => g.id === id) || null;
const MAX_DEVICES = 8, BOX_PAID_MAX = 300;
// Level, daily / weekly / event challenges and the box-wide season pass (box/progress.js): they
// live on this wallet as `progress`. The old JustMafia season pass ('s1') and weekly challenges
// moved there (migrated on first use: see box/progress.js).
const PROGRESS = require('./box/progress');
const { mafiaXp } = require('./public/shared/challenges');
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
      if (typeof p.fate !== 'number') { p.fate = FATE.starter; p.fateCards = { wish: 0, team: 0, reroll: 0 }; } // Fate Tokens arrive with a starter gift
      // Shop stock (older profiles): the starter shelf plus what their games so far would have revealed.
      if (!Array.isArray(p.stock)) { p.stock = STARTER_STOCK.slice(); const s = p.stats || {}; p.stock.push(...nextStock(p.stock, (s.games || 0) * STOCK.finished + (s.wins || 0) * STOCK.won)); }
      for (const id of STARTER_STOCK) if (!p.stock.includes(id)) p.stock.push(id); // new kinds of items (ghost looks) start on everyone's shelf
    }
  }
  // The clock for days / weeks / seasons (tests replace it).
  now() { return Date.now(); }
  // ----- Progression (box/progress.js): level, challenges, the box-wide season pass -----
  // The premium track of the running season's pass, bought with JustGold (any phone).
  buyPass(id) {
    const p = this.data.profiles[id]; if (!p) return { ok: false, error: 'No profile.' };
    const r = PROGRESS.buyPremium(this, p);
    if (!r.ok) return r;
    this.save(); return { ok: true, rewards: r.rewards, profile: this.view(id) };
  }
  // A finished game from anywhere in the box (ev: see box/progress.js). Returns the news or null.
  progressGame(id, ev) {
    const p = this.data.profiles[id]; if (!p) return null;
    const news = PROGRESS.recordGame(this, p, ev);
    if (news) this.save();
    return news;
  }
  rerollChallenge(id, period, cid) {
    const p = this.data.profiles[id]; if (!p) return { ok: false, error: 'No profile.' };
    const r = PROGRESS.reroll(this, p, String(period || ''), String(cid || ''));
    if (r.ok) this.save();
    return r;
  }
  progressView(id) { const p = this.data.profiles[id]; return p ? PROGRESS.view(this, p) : null; }
  levelOf(id) { const p = this.data.profiles[id]; return p ? PROGRESS.levelOf(this, p) : null; }
  titlesOf(id) { const p = this.data.profiles[id]; return p ? PROGRESS.titles(this, p) : []; }
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
  // ----- JustGold accounts (docs/justgold.md) -----
  // Another phone for the same wallet (the account signs in there): a fresh device token.
  addDevice(id) {
    const p = this.data.profiles[id]; if (!p) return null;
    const token = crypto.randomBytes(32).toString('hex');
    p.verifiers = [...(p.verifiers || []), digest(token)].slice(-MAX_DEVICES);
    this.save(); return { id, token };
  }
  // A finished JustGameBox game pays JustGold once (payId = room + game number), and every game
  // puts something new on the shop shelves, like a JustMafia game does.
  awardBox(id, payId, amount, reason) {
    const p = this.data.profiles[id], n = Math.max(0, Math.min(500, Math.floor(Number(amount) || 0)));
    if (!p || !n || typeof payId !== 'string') return 0;
    p.boxPaid = p.boxPaid || [];
    if (p.boxPaid.includes(payId)) return 0;
    p.boxPaid.push(payId); if (p.boxPaid.length > BOX_PAID_MAX) p.boxPaid.splice(0, p.boxPaid.length - BOX_PAID_MAX);
    this.record(p, n, reason, { box: true });
    if (Array.isArray(p.stock)) p.stock.push(...nextStock(p.stock, STOCK.finished));
    this.save(); return n;
  }
  // Per-game gear: buy, equip (one per game slot), and the values games read.
  buyGear(id, gearId) {
    const p = this.data.profiles[id], g = gearItem(gearId);
    if (!p || !g) return { ok: false, error: 'Unknown item.' };
    if (p.owned.includes(g.id)) return { ok: false, error: 'You already have it.' };
    if (p.coins < g.cost) return { ok: false, error: `Not enough JustGold: ${g.name} costs ${g.cost} JG, you have ${p.coins} JG.` };
    this.record(p, -g.cost, 'Bought ' + g.name, { item: g.id });
    p.owned.push(g.id); this.save(); return { ok: true, profile: this.view(id) };
  }
  equipGear(id, gearId, on = true) {
    const p = this.data.profiles[id], g = gearItem(gearId);
    if (!p || !g) return { ok: false, error: 'Unknown item.' };
    if (!p.owned.includes(g.id)) return { ok: false, error: 'Buy this item first.' };
    p.gear = p.gear || {}; const slots = p.gear[g.game] || (p.gear[g.game] = {});
    if (on) slots[g.slot] = g.id; else if (slots[g.slot] === g.id) delete slots[g.slot];
    this.save(); return { ok: true, profile: this.view(id) };
  }
  // { gameKey: { slot: value } } for the gear this wallet has equipped (what rooms hand to games).
  gearValues(id) {
    const p = this.data.profiles[id], out = {}; if (!p || !p.gear) return out;
    for (const [game, slots] of Object.entries(p.gear)) for (const [slot, gid] of Object.entries(slots || {})) {
      const g = gearItem(gid); if (g && p.owned.includes(gid)) (out[game] || (out[game] = {}))[slot] = g.value;
    }
    return out;
  }
  // The look shown in every game (only once the player has made their character).
  lookOf(id) { const p = this.data.profiles[id]; return p && p.lookSaved ? this.validateAvatar(id, p.avatar || {}) : null; }
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
    this.data.profiles[id] = { id, verifier: digest(token), coins: 0, goldEarned: 0, goldSpent: 0, ledger: [], owned: CATALOG.filter((i) => i.free).map((i) => i.id), achievements: [], stats: { games: 0, wins: 0, mafiaWins: 0, jesterWins: 0, survived: 0, saves: 0, correctInvestigations: 0, objectives: 0 }, avatar: {}, rewardedGames: [], lastReward: null, stock: STARTER_STOCK.slice(), fate: FATE.starter, fateCards: { wish: 0, team: 0, reroll: 0 } };
    this.data.profiles[id].avatar = this.validateAvatar(id, { outfit: 'traveler', hair: 'short' });
    this.save(); return { id, token, profile: this.view(id) };
  }
  authenticate(auth) {
    const p = auth && typeof auth.id === 'string' && Object.hasOwn(this.data.profiles, auth.id) && this.data.profiles[auth.id];
    if (!p || typeof auth.token !== 'string' || !/^[a-f0-9]{64}$/.test(auth.token)) return null;
    // One wallet, several phones: the first device's verifier plus any added ones (JustGold accounts).
    const d = Buffer.from(digest(auth.token), 'hex');
    return [p.verifier, ...(p.verifiers || [])].some((v) => typeof v === 'string' && v.length === 64 && crypto.timingSafeEqual(Buffer.from(v, 'hex'), d)) ? p : null;
  }
  // Worlds explored: games finished in each world and its rewards (owned or how far to go).
  worldsView(p) { return Object.entries(WORLD_REWARDS).map(([id, list]) => ({ id, name: WORLD_NAMES[id], games: (p.worlds || {})[id] || 0, rewards: list.map((r) => ({ ...r, owned: p.owned.includes(r.item) })) })); }
  view(id) { const p = this.data.profiles[id]; if (!p) return null; const progress = PROGRESS.view(this, p); const { verifier, verifiers, rewardedGames, boxPaid, progress: _raw, ...view } = p; return { ...view, career: this.careerView(p), progress, worlds: this.worldsView(p), inventory: this.inventory(id), storage: this.filename ? 'Saved on this game server’s disk' : 'Session-only development storage' }; }
  validateAvatar(id, input = {}) {
    const p = this.data.profiles[id], result = {};
    // Expression has its own migration rule below.
    for (const [key, list] of Object.entries(O.AVATAR_FIELDS)) {
      if (key === 'expression') continue;
      if (key === 'body') { const saved = p && p.avatar && p.avatar.body; result.body = O.body.includes(input.body) ? input.body : O.body.includes(saved) ? saved : O.inferBody({ ...(p && p.avatar), ...input, body: null }); continue; } // body type: free; old looks are inferred
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
  // ----- Career: every finished game (practice included), mastery, rivalries, awards -----
  recordGame(id, gameId, g) {
    const p = this.data.profiles[id]; if (!p) return false;
    const c = p.career = p.career || { games: 0, wins: 0, survived: 0, teams: {}, roles: {}, rivals: {}, awards: {}, history: [], seen: [] };
    if (c.seen.includes(gameId)) return false;
    c.seen.push(gameId); if (c.seen.length > 200) c.seen.shift();
    c.games++; if (g.won) c.wins++; if (g.alive) c.survived++;
    const t = c.teams[g.team] = c.teams[g.team] || { games: 0, wins: 0 }; t.games++; if (g.won) t.wins++;
    const r = c.roles[g.role] = c.roles[g.role] || { games: 0, wins: 0 }; r.games++; if (g.won) r.wins++;
    if ([5, 15, 30].includes(r.games)) { p.fate = (p.fate || 0) + 1; c.masteryGifts = (c.masteryGifts || 0) + 1; } // a new mastery title earns a Fate Token
    const rival = (who, field) => { const x = c.rivals[who.key] = c.rivals[who.key] || { name: who.name, killedMe: 0, iKilled: 0, votedMe: 0 }; x.name = who.name; x[field]++; };
    for (const k of g.killedBy || []) rival(k, 'killedMe');
    for (const k of g.kills || []) rival(k, 'iKilled');
    for (const v of g.votedBy || []) rival(v, 'votedMe');
    for (const a of g.awards || []) c.awards[a] = (c.awards[a] || 0) + 1;
    c.history.unshift({ at: g.at, theme: g.theme, town: g.town, role: g.role, team: g.team, won: g.won, alive: g.alive, players: g.players, awards: g.awards || [] });
    c.history = c.history.slice(0, 20);
    this.save(); return true;
  }
  // Role mastery: games played as a role earn a title for it.
  static masteryTitle(games) { return games >= 30 ? 'Master' : games >= 15 ? 'Expert' : games >= 5 ? 'Apprentice' : null; }
  careerView(p) {
    const c = p.career; if (!c) return { games: 0, wins: 0, survived: 0, teams: {}, roles: [], rivals: {}, awards: {}, history: [], titles: [] };
    const roles = Object.entries(c.roles).map(([role, s]) => ({ role, ...s, title: ProfileStore.masteryTitle(s.games) })).sort((a, b) => b.games - a.games);
    const rivalList = Object.values(c.rivals);
    const topBy = (f) => rivalList.filter((x) => x[f] > 0).sort((a, b) => b[f] - a[f])[0] || null;
    const titles = roles.filter((r) => r.title).map((r) => `${r.title} ${(require('./public/shared/roles').ROLES[r.role] || {}).name || r.role}`);
    return { games: c.games, wins: c.wins, survived: c.survived, teams: c.teams, roles, awards: c.awards, history: c.history, titles, title: titles[0] || null,
      rivals: { nemesis: topBy('killedMe'), prey: topBy('iKilled'), critic: topBy('votedMe') } };
  }
  // ----- Fate Tokens and Fate Cards -----
  buyFate(id, card) {
    const p = this.data.profiles[id], c = FATE.cards[card];
    if (!p || !c) return { ok: false, error: 'Unknown Fate Card.' };
    if (p.fate < c.cost) return { ok: false, error: `The ${c.name} costs ${c.cost} Fate Token${c.cost > 1 ? 's' : ''}; you have ${p.fate}.` };
    p.fate -= c.cost; p.fateCards[card] = (p.fateCards[card] || 0) + 1; this.save();
    return { ok: true, profile: this.view(id) };
  }
  exchangeFate(id) {
    const p = this.data.profiles[id]; if (!p) return { ok: false, error: 'No profile.' };
    if (p.coins < FATE.exchangeGold) return { ok: false, error: `A Fate Token costs ${FATE.exchangeGold} JG; you have ${p.coins} JG.` };
    this.record(p, -FATE.exchangeGold, 'Traded for a Fate Token'); p.fate++; this.save();
    return { ok: true, profile: this.view(id) };
  }
  hasFate(id, card) { const p = this.data.profiles[id]; return !!p && (p.fateCards[card] || 0) > 0; }
  useFate(id, card) { const p = this.data.profiles[id]; if (!p || !(p.fateCards[card] > 0)) return false; p.fateCards[card]--; this.save(); return true; }
  // Counts something that happened in a game right away (ghost and betting stats) and unlocks
  // any achievement it completes (the achievement's cosmetic, no gold). Returns the new ones.
  bumpStat(id, stat, n = 1) {
    const p = this.data.profiles[id]; if (!p || !n) return [];
    p.stats[stat] = (p.stats[stat] || 0) + n;
    const unlocked = Object.entries(ACHIEVEMENTS).filter(([key, a]) => a.stat === stat && p.stats[stat] >= a.count && !p.achievements.includes(key)).map(([key]) => key);
    p.achievements.push(...unlocked);
    for (const i of CATALOG) if (unlocked.includes(i.achievement) && !p.owned.includes(i.id)) p.owned.push(i.id); // its cosmetic goes straight to the inventory
    this.save(); return unlocked;
  }
  // Moves gold in or out for a bet (negative = put on the table). False if they can't cover it.
  escrow(id, delta, reason) {
    const p = this.data.profiles[id]; if (!p || !delta) return false;
    if (delta < 0 && p.coins < -delta) return false;
    this.record(p, delta, reason); this.save(); return true;
  }
  coins(id) { const p = this.data.profiles[id]; return p ? p.coins : 0; }
  // Puts items on a player's shelves directly (tests and developer tools).
  stockItems(id, itemIds) { const p = this.data.profiles[id]; if (!p) return false; for (const i of itemIds) if (!p.stock.includes(i)) p.stock.push(i); this.save(); return true; }
  buy(id, itemId) {
    const p = this.data.profiles[id], item = CATALOG.find((i) => i.id === itemId);
    if (!p || !item || p.owned.includes(item.id)) return { ok: false, error: 'Choose a locked catalog item.' };
    if (item.pass) return { ok: false, error: 'Season pass reward: it comes with a season pass track, not the shop.' };
    if (item.world) return { ok: false, error: `World reward: finish ${item.worldGames === 1 ? 'a game' : item.worldGames + ' games'} in the ${WORLD_NAMES[item.world]} world.` };
    if (item.achievement && !p.achievements.includes(item.achievement)) return { ok: false, error: ACHIEVEMENTS[item.achievement].label };
    if (item.requires && !p.owned.includes(item.requires)) { const need = CATALOG.find((i) => i.id === item.requires); return { ok: false, error: `High Roller tier ${item.ladderTier}: own the ${need ? need.name : 'tier below'} first.` }; }
    if (STOCKABLE_IDS.has(item.id) && !(p.stock || []).includes(item.id)) return { ok: false, error: `The ${item.name} isn't in the shop yet. Keep playing: every game puts something new on the shelves.` };
    if (p.coins < item.cost) return { ok: false, error: `Not enough JustGold: ${item.name} costs ${item.cost} JG, you have ${p.coins} JG.` };
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
    const orc = capped(m.oracle, R.oracleCap); add('oracle', `Right ghost predictions (${orc})`, orc * R.oracle);
    if (result.won && !result.alive) add('spirit', 'Your side won after you died', R.spiritBonus);
    const unlocked = Object.entries(ACHIEVEMENTS).filter(([key, a]) => s[a.stat] >= a.count && !p.achievements.includes(key));
    for (const [key, a] of unlocked) { p.achievements.push(key); add('achievement', `Achievement: ${a.label}`, R.achievement); }
    const raw = lines.reduce((t, l) => t + l.amount, 0), capped0 = Math.min(R.maxPerGame, raw);
    const before = p.coins;
    if (capped0) this.record(p, capped0, 'Game reward', { gameId });
    // Profile XP, daily / weekly / event challenges and the box-wide season pass (box/progress.js;
    // paid on top of the per-game cap, once each). The Judge's events multiply the game's XP.
    const mult = (EVENTS[result.event] || {}).xpMultiplier || 1;
    const news = PROGRESS.recordGame(this, p, { id: 'mafia:' + gameId, game: 'mafia', kind: 'mafia', xp: mafiaXp(result.won, result.alive, mult), won: !!result.won, alive: !!result.alive, team: result.team, role: result.role, metrics: m, gold: capped0 })
      || { xp: 0, levelUps: [], completed: [], tiers: [], items: [], fate: 0, level: PROGRESS.levelOf(this, p) };
    for (const c of news.completed) lines.push({ key: 'challenge', label: `${c.period === 'daily' ? 'Daily' : c.period === 'weekly' ? 'Weekly' : 'Event'} challenge: ${c.label}`, amount: c.gold });
    for (const u of news.levelUps) lines.push({ key: 'level', label: `Reached level ${u.level}`, amount: u.gold });
    for (const t of news.tiers) if (t.gold) lines.push({ key: 'pass', label: `Season pass tier ${t.tier}${t.side === 'premium' ? ' (premium)' : ''}`, amount: t.gold });
    const listed = news.completed.reduce((n, c) => n + c.gold, 0) + news.levelUps.reduce((n, u) => n + u.gold, 0) + news.tiers.reduce((n, t) => n + (t.gold || 0), 0);
    if ((news.gold || 0) > listed) lines.push({ key: 'pass', label: 'Bonus JustGold (a reward you already owned)', amount: news.gold - listed });
    // Worlds: each finished game in a world counts toward that world's cosmetics.
    const worldItems = [], firstVisit = !!(result.theme && WORLD_REWARDS[result.theme] && !(p.worlds || {})[result.theme]);
    if (result.theme && WORLD_REWARDS[result.theme]) {
      p.worlds = p.worlds || {}; p.worlds[result.theme] = (p.worlds[result.theme] || 0) + 1;
      for (const r of WORLD_REWARDS[result.theme]) if (p.worlds[result.theme] >= r.games && !p.owned.includes(r.item)) { p.owned.push(r.item); worldItems.push(r.item); }
    }
    // New in the shop: every finished game, every win and every new world restock the shelves.
    const newStock = nextStock(p.stock, STOCK.finished + (result.won ? STOCK.won : 0) + (firstVisit ? STOCK.newWorld : 0));
    const fateGained = (result.won ? FATE.perWin : 0) + (firstVisit ? FATE.perNewWorld : 0);
    p.fate += fateGained;
    p.stock.push(...newStock);
    const coins = p.coins - before;
    p.lastReward = { gameId, coins, before, after: p.coins, lines, capped: raw > capped0 ? R.maxPerGame : null, at: Date.now(),
      progress: { xp: news.xp, multiplier: mult, level: news.level, levelBefore: news.levelBefore, levelUps: news.levelUps, completed: news.completed, tiers: news.tiers, items: news.items },
      season: { xp: news.xp, multiplier: mult, items: news.items },
      stock: newStock, fate: fateGained + (news.fate || 0),
      world: result.theme && WORLD_REWARDS[result.theme] ? { id: result.theme, name: WORLD_NAMES[result.theme], games: p.worlds[result.theme], items: worldItems } : null };
    p.rewardedGames.push(gameId); this.save();
    return p.lastReward;
  }
}
module.exports = { ProfileStore };
