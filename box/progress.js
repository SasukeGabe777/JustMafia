'use strict';
// Profile progression for every game in the box: player level, daily / weekly / event
// challenges and the box-wide season pass (docs/progress.md). Definitions and numbers are in
// public/shared/challenges.js (the phones show the same ones); the seasonal events are in
// public/shared/seasons.js.
//
// Everything lives on the wallet (the JustMafia ProfileStore entry, profiles.js) as
// `p.progress`, so a box account, a JustMafia phone and the shop all see one level. The store
// calls these functions; `store.record(p, delta, reason)` pays JustGold into the ledger and
// `store.now()` is the clock (tests inject one: the day / week / season roll over with it).
//
//   recordGame(store, p, ev)  ev = { id (dedupe), game, kind: 'box'|'mafia'|'party', xp, place, of,
//                                    won, alive, team, metrics, gold, tags: { cover, mole, hands, zsurvive } }
//     -> news { xp, levelUps: [{ level, gold, item, title }], completed: [...], tiers: [...], fate }
//   reroll(store, p, period, id)   one free reroll a day (daily or weekly challenge)
//   buyPremium(store, p)           the season pass premium track, bought with JustGold
//   view(store, p)                 what the phones show
//
// Old JustMafia data (season 's1' pass + weekly challenges, before the box-wide system):
// its season XP becomes profile XP once, and an owned 's1' pass becomes a premium credit that
// unlocks the premium track of the running (or next) box season for free. Items already
// granted by the old pass stay owned. Old weekly progress is dropped (it was paid as it went).
const X = require('../public/shared/challenges');
const SZ = require('../public/shared/seasons');
const { CATALOG, FATE } = require('../public/shared/cosmetics');
let GEAR = []; try { ({ GEAR } = require('../public/shared/gear')); if (!Array.isArray(GEAR)) GEAR = []; } catch (e) { GEAR = []; }

const SEEN_MAX = 300, CONSOLATION = 25;
const itemOf = (id) => CATALOG.find((i) => i.id === id) || GEAR.find((g) => g.id === id) || null;
const catalogHas = (id) => !!itemOf(id);
const nowOf = (store) => (store && typeof store.now === 'function' ? store.now() : Date.now());
const bucket = (key, ids) => ({ key, ids, prog: {}, done: [], seen: [], gone: [] });

// The progress record, created / migrated / rolled to the current day, week and season.
function ensure(store, p) {
  const now = nowOf(store);
  let pr = p.progress;
  if (!pr || typeof pr !== 'object') pr = p.progress = { v: 1, xp: 0, level: 1, titles: [], seen: [], daily: null, weekly: null, event: null, pass: null, rerolls: { day: null, used: 0 }, premiumCredit: 0 };
  if (!Array.isArray(pr.titles)) pr.titles = [];
  if (!Array.isArray(pr.seen)) pr.seen = [];
  if (!pr.rerolls) pr.rerolls = { day: null, used: 0 };
  // Migration of the old JustMafia season pass (see the header).
  if (!pr.migrated) {
    pr.migrated = true;
    const old = p.pass;
    if (old && typeof old === 'object' && !SZ.SEASONS.some((s) => s.id === old.season)) {
      pr.legacy = { season: old.season, owned: !!old.owned, xp: old.xp || 0, granted: (old.granted || []).length };
      pr.xp += Math.max(0, Math.floor(old.xp || 0));
      if (old.owned) pr.premiumCredit = (pr.premiumCredit || 0) + 1;
      const lvl = X.levelOf(pr.xp).level; // migrated XP: the levels (and their titles), no back pay
      for (let L = 2; L <= lvl; L++) { const t = X.levelReward(L).title; if (t) addTitle(pr, 'lvl' + L, t); }
      pr.level = lvl;
      delete p.pass;
    }
    delete p.challenges;
  }
  const day = X.dayKey(now), week = X.weekKey(now);
  if (!pr.daily || pr.daily.key !== day) pr.daily = bucket(day, X.dailyIds(day));
  if (!pr.weekly || pr.weekly.key !== week) pr.weekly = bucket(week, X.weeklyIds(week));
  if (pr.rerolls.day !== day) pr.rerolls = { day, used: 0 };
  const s = SZ.currentSeason(now);
  if (s && (!pr.pass || pr.pass.season !== s.id)) {
    const credit = (pr.premiumCredit || 0) > 0;
    if (credit) pr.premiumCredit--;
    pr.pass = { season: s.id, xp: 0, premium: credit, fromCredit: credit, free: [], prem: [] };
  }
  if (s && (!pr.event || pr.event.key !== s.id)) pr.event = bucket(s.id, X.eventChallenges(s.id).map((c) => c.id));
  return pr;
}
const addTitle = (pr, id, text) => { if (!pr.titles.some((t) => t.id === id)) pr.titles.push({ id, text }); };
const defOf = (period, id, seasonId) => (period === 'event' ? X.eventChallenges(seasonId).find((c) => c.id === id) || null : X.challenge(id, period));

// How much one finished game moves a challenge.
function amount(c, ev, b) {
  const game = ev.kind !== 'party', m = ev.metrics || {};
  switch (c.stat) {
    case 'games': return game ? 1 : 0;
    case 'distinct': return game && !b.seen.includes(ev.game) ? 1 : 0;
    case 'top3': return game && (ev.won || (ev.place && ev.place <= 3 && (ev.of || 0) >= 3)) ? 1 : 0;
    case 'gold': return Math.max(0, Math.floor(ev.gold || 0));
    case 'group': return game && (X.GROUPS[c.arg] || []).includes(ev.game) ? 1 : 0;
    case 'wins': return game && ev.won ? 1 : 0;
    case 'party': return ev.kind === 'party' ? 1 : 0;
    case 'partyTop3': return ev.kind === 'party' && ev.place && ev.place <= 3 && (ev.of || 0) >= 2 ? 1 : 0;
    case 'tag': return Math.max(0, Math.floor(((ev.tags || {})[c.arg]) || 0));
    case 'play': return game && ev.game === c.arg ? 1 : 0;
    case 'win': return game && ev.game === c.arg && ev.won ? 1 : 0;
    case 'mafiaSurvive': return ev.game === 'mafia' && ev.alive ? 1 : 0;
    case 'asMafia': return ev.game === 'mafia' && ev.won && ev.team === 'mafia' ? 1 : 0;
    case 'mafiaMetric': return ev.game === 'mafia' ? Math.max(0, Math.floor(m[c.arg] || 0)) : 0;
    default: return 0;
  }
}

function giveItem(store, p, id, reason, news) {
  if (!catalogHas(id)) { store.record(p, CONSOLATION, reason + ' (bonus JustGold)'); news.gold += CONSOLATION; return null; } // unknown id: skipped safely
  if (!Array.isArray(p.owned)) p.owned = [];
  if (p.owned.includes(id)) { store.record(p, CONSOLATION, reason + ' (already owned: JustGold instead)'); news.gold += CONSOLATION; return null; }
  p.owned.push(id); news.items.push(id); return id;
}
// XP in: levels and the season pass follow.
function addXp(store, p, n, news) {
  const pr = p.progress; n = Math.max(0, Math.floor(n || 0)); if (!n) return;
  pr.xp += n; news.xp += n;
  const s = SZ.currentSeason(nowOf(store));
  if (s && pr.pass && pr.pass.season === s.id) pr.pass.xp += n;
  const target = X.levelOf(pr.xp).level;
  while (pr.level < target) {
    pr.level++;
    const r = X.levelReward(pr.level), up = { level: pr.level, gold: r.gold, item: null, title: r.title || null };
    store.record(p, r.gold, `Reached level ${pr.level}`); news.gold += r.gold;
    if (r.item) {
      const id = X.LEVEL_ITEMS.find((x) => catalogHas(x) && !(p.owned || []).includes(x));
      if (id) up.item = giveItem(store, p, id, `Level ${pr.level} reward`, news);
      else { store.record(p, 50, `Level ${pr.level} reward`); news.gold += 50; up.gold += 50; }
    }
    if (r.title) addTitle(pr, 'lvl' + pr.level, r.title);
    news.levelUps.push(up);
  }
  grantTiers(store, p, news);
}
function tierOf(pr) { return pr.pass ? Math.min(X.PASS.tiers, Math.floor((pr.pass.xp || 0) / X.PASS.xpPerTier)) : 0; }
// Pay every reached tier not paid yet (free track always; premium with the premium pass).
function grantTiers(store, p, news) {
  const pr = p.progress, s = SZ.currentSeason(nowOf(store));
  if (!s || !pr.pass || pr.pass.season !== s.id) return;
  const track = X.passTrack(s, catalogHas), tier = tierOf(pr);
  for (const row of track) {
    if (row.tier > tier) break;
    for (const [side, list] of [['free', pr.pass.free], ['premium', pr.pass.prem]]) {
      if (list.includes(row.tier) || (side === 'premium' && !pr.pass.premium)) continue;
      list.push(row.tier);
      const r = row[side]; if (!r) continue;
      const why = `${s.name} pass tier ${row.tier}${side === 'premium' ? ' (premium)' : ''}`;
      const got = { tier: row.tier, side };
      if (r.gold) { store.record(p, r.gold, why); news.gold += r.gold; got.gold = r.gold; }
      if (r.item) got.item = giveItem(store, p, r.item, why, news);
      if (r.title) { addTitle(pr, 'season:' + s.id, r.title); got.title = r.title; }
      news.tiers.push(got);
    }
  }
}
const freshNews = () => ({ xp: 0, gold: 0, levelUps: [], completed: [], tiers: [], items: [], fate: 0 });

// One finished game (or a whole Party Mode) for this wallet. Paid once per ev.id.
function recordGame(store, p, ev) {
  if (!p || !ev || typeof ev.id !== 'string' || typeof ev.game !== 'string') return null;
  const pr = ensure(store, p);
  if (pr.seen.includes(ev.id)) return null;
  pr.seen.push(ev.id); if (pr.seen.length > SEEN_MAX) pr.seen.splice(0, pr.seen.length - SEEN_MAX);
  const news = freshNews();
  news.levelBefore = pr.level;
  addXp(store, p, ev.xp, news);
  const s = SZ.currentSeason(nowOf(store));
  for (const [period, b] of [['daily', pr.daily], ['weekly', pr.weekly], ['event', s ? pr.event : null]]) {
    if (!b) continue;
    for (const id of b.ids) {
      if (b.done.includes(id)) continue;
      const c = defOf(period, id, b.key); if (!c) continue;
      const add = amount(c, ev, b); if (!add) continue;
      b.prog[id] = Math.min(c.count, (b.prog[id] || 0) + add);
      if (b.prog[id] >= c.count) {
        b.done.push(id);
        store.record(p, c.gold, `${period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Event'} challenge: ${c.label}`); news.gold += c.gold;
        if (period !== 'daily' && FATE) { p.fate = (p.fate || 0) + (FATE.perChallenge || 0); news.fate += FATE.perChallenge || 0; }
        news.completed.push({ id, period, icon: c.icon, label: c.label, xp: c.xp, gold: c.gold });
        addXp(store, p, c.xp, news);
      }
    }
    if (ev.kind !== 'party' && !b.seen.includes(ev.game)) b.seen.push(ev.game);
  }
  news.level = pr.level;
  return news;
}

function reroll(store, p, period, id) {
  const pr = ensure(store, p);
  if (period !== 'daily' && period !== 'weekly') return { ok: false, error: 'Only daily and weekly challenges can be rerolled.' };
  if (pr.rerolls.used >= X.REROLLS_PER_DAY) return { ok: false, error: 'You used today’s free reroll. A new one comes tomorrow.' };
  const b = pr[period];
  if (!b.ids.includes(id)) return { ok: false, error: 'That challenge isn’t on your list.' };
  if (b.done.includes(id)) return { ok: false, error: 'That one is already done!' };
  const next = X.rerollId(b.key, period, id, [...b.ids, ...b.gone]);
  if (!next) return { ok: false, error: 'No other challenge to swap in.' };
  b.ids = b.ids.map((x) => (x === id ? next : x)); b.gone.push(id); delete b.prog[id];
  pr.rerolls.used++;
  return { ok: true, replaced: id, id: next };
}

function buyPremium(store, p) {
  const pr = ensure(store, p), s = SZ.currentSeason(nowOf(store));
  if (!s || !pr.pass) return { ok: false, error: 'No seasonal event is running right now.' };
  if (pr.pass.premium) return { ok: false, error: 'You already have the premium pass.' };
  if ((p.coins || 0) < X.PASS.cost) return { ok: false, error: `Not enough JustGold: the premium pass costs ${X.PASS.cost} JG, you have ${p.coins || 0} JG.` };
  store.record(p, -X.PASS.cost, `${s.name} premium pass`);
  pr.pass.premium = true;
  const news = freshNews(); grantTiers(store, p, news); // every tier already reached pays out now
  return { ok: true, rewards: news.tiers, news };
}

const nameOf = (id) => { const it = itemOf(id); return it ? it.name : null; };
function view(store, p) {
  const pr = ensure(store, p), now = nowOf(store), L = X.levelOf(pr.xp), s = SZ.currentSeason(now), nx = SZ.nextSeason(now);
  const list = (period, b) => b.ids.map((id) => { const c = defOf(period, id, b.key); return c && { id, period, icon: c.icon, label: c.label, count: c.count, progress: Math.min(c.count, b.prog[id] || 0), done: b.done.includes(id), xp: c.xp, gold: c.gold }; }).filter(Boolean);
  const dayEnd = Date.parse(pr.daily.key + 'T00:00:00Z') + 86400000;
  const wkEnd = (() => { const d = new Date(now); const dow = d.getUTCDay() || 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + (8 - dow) * 86400000; })();
  let season = null;
  if (s) {
    const tier = tierOf(pr), pass = pr.pass;
    season = { id: s.id, name: s.name, icon: s.icon, blurb: s.blurb, theme: s.theme, start: s.start, end: s.end, daysLeft: SZ.daysLeft(s, now),
      tier, tiers: X.PASS.tiers, xpPerTier: X.PASS.xpPerTier, xp: pass.xp, premium: !!pass.premium, fromCredit: !!pass.fromCredit, cost: X.PASS.cost,
      track: X.passTrack(s, catalogHas).map((r) => ({ tier: r.tier, free: r.free && { ...r.free, name: r.free.item ? nameOf(r.free.item) : null }, premium: r.premium && { ...r.premium, name: r.premium.item ? nameOf(r.premium.item) : null }, freeGot: pass.free.includes(r.tier), premGot: pass.prem.includes(r.tier) })),
      challenges: list('event', pr.event) };
  }
  return {
    level: L.level, xp: pr.xp, into: L.into, need: L.need, badge: X.badgeOf(L.level), titles: pr.titles.slice(),
    nextReward: X.levelReward(L.level + 1),
    daily: { key: pr.daily.key, endsAt: dayEnd, list: list('daily', pr.daily) },
    weekly: { key: pr.weekly.key, endsAt: wkEnd, list: list('weekly', pr.weekly) },
    rerolls: { left: Math.max(0, X.REROLLS_PER_DAY - pr.rerolls.used), max: X.REROLLS_PER_DAY },
    season, next: nx ? { id: nx.id, name: nx.name, icon: nx.icon, start: nx.start, theme: nx.theme, inDays: Math.max(0, Math.ceil((Date.parse(nx.start + 'T00:00:00Z') - now) / 86400000)) } : null,
    credit: pr.premiumCredit || 0, legacy: pr.legacy || null,
  };
}
const levelOf = (store, p) => (p ? ensure(store, p).level : 1);
const titles = (store, p) => (p ? ensure(store, p).titles.slice() : []);

module.exports = { ensure, recordGame, reroll, buyPremium, view, levelOf, titles, amount, catalogHas, CONSOLATION };
