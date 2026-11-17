'use strict';
// JustBid: storage locker auctions. Each round a locker rolls onto the TV with its door only
// partly up: three peek clues (which can mislead). Everyone bids live from their phone; every
// new bid restarts the "Going once… going twice… SOLD!" countdown. Pay a fee to shine a
// flashlight (a private hint), take a bank loan if you're broke, then watch the winner's
// locker get unpacked item by item: PROFIT or LOSS. Three items from the same collection set
// earn a set bonus. Highest net worth (cash + items + bonuses − loans with interest) wins.
// Special lockers: Sealed Bid (second-price), Mystery (no clues), Premium (better pool,
// higher opening) and the final Grand Locker (double size). All content is in bid-items.js.
const { ITEMS, THEMES, SETS, RARITIES, W_DEFAULT, PACKS } = require('./bid-items');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rounds', label: 'Lockers', options: opt([[6, '6 lockers'], [8, '8 lockers'], [12, '12 lockers']]) },
  { key: 'cash', label: 'Starting cash', options: opt([[1000, '$1,000'], [2000, '$2,000'], [5000, '$5,000']]) },
  { key: 'countdown', label: 'Going once… countdown', options: opt([[5, '5 seconds'], [7, '7 seconds'], [10, '10 seconds']]) },
  { key: 'specials', label: 'Special lockers', options: opt([[true, 'On (sealed, mystery, premium)'], [false, 'Off']]) },
  { key: 'loans', label: 'Bank loans', options: opt([[true, 'On'], [false, 'Off']]) },
  { key: 'pack', label: 'Locker mix', options: opt([['all', '🎲 Everything'], ...PACKS.map((p) => [p.key, p.label + ' pack'])]) },
];
const defaults = { rounds: 8, cash: 2000, countdown: 7, specials: true, loans: true, pack: 'all' };

const PREVIEW_MS = 6000, SOLD_MS = 3000, SEALED_MS = 20000, END_EARLY_MS = 900, TOTAL_MS = 5500, BONUS_MS = 2500;
const ADDS = [10, 25, 100, 500];
const MIN_INC = 10, RATE_N = 3, RATE_MS = 1000, MAX_LOANS = 2, LOAN_RATE = 1.2;
const KIND = {
  normal: { label: 'Storage Locker', icon: '🚪' },
  sealed: { label: 'Sealed Bid', icon: '🔒' },
  mystery: { label: 'Mystery Locker', icon: '🎲' },
  premium: { label: 'Premium Locker', icon: '💎' },
  grand: { label: 'The Grand Locker', icon: '👑' },
};
const RANK = Object.fromEntries(RARITIES.map((r, i) => [r.key, i]));
const RLABEL = Object.fromEntries(RARITIES.map((r) => [r.key, r.label]));
const THEME = Object.fromEntries(THEMES.map((t) => [t.key, t]));
const BANDS = [0, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000];

const fmt = (v) => (v < 0 ? '−$' : '$') + Math.abs(Math.round(v)).toLocaleString('en-US');
const round10 = (v) => Math.max(10, Math.round(v / 10) * 10);
const niceVal = (v) => (v < 100 ? Math.max(1, Math.round(v)) : v < 1000 ? Math.round(v / 5) * 5 : Math.round(v / 10) * 10);
// Parse a whole-dollar amount from a phone (number or numeric string). NaN if it isn't one.
function dollars(x) {
  const n = typeof x === 'number' ? x : typeof x === 'string' && /^\s*\d+(\.0+)?\s*$/.test(x) ? Number(x) : NaN;
  return Number.isFinite(n) && Number.isInteger(n) && n >= 0 ? n : NaN;
}
// Sealed bid: the highest bid wins (earliest on a tie) and pays the second-highest + $10,
// never more than they offered and never less than the opening bid.
function sealedPrice(sorted, opening) {
  if (!sorted.length) return null;
  const w = sorted[0];
  const price = sorted.length > 1 ? Math.min(w.amount, Math.max(opening, sorted[1].amount + MIN_INC)) : Math.min(w.amount, opening);
  return { id: w.id, price };
}

// Weighted rarity pools per theme: themed items count 4×, "any" filler 1×.
// ctx: { fam } keeps only family-safe items (room-wide Family mode); { pack } keeps a Mystery
// locker (which draws from everything) inside the chosen content pack's lockers.
const PACK_THEMES = Object.fromEntries(PACKS.map((p) => [p.key, THEMES.filter((t) => t.pack === p.key).map((t) => t.key)]));
const inPack = (it, pack) => !pack || it.themes.includes('any') || it.themes.some((t) => PACK_THEMES[pack].includes(t));
const okItem = (it, ctx) => !(ctx && ctx.fam && !it.family);
const pools = new Map();
function poolFor(theme, r, ctx = {}) {
  const pack = ctx.pack || null, k = theme.key + ':' + r + ':' + (ctx.fam ? 'f' : '') + ':' + (pack || '');
  if (!pools.has(k)) {
    const list = [];
    for (const it of ITEMS) {
      if (it.r !== r || !okItem(it, ctx)) continue;
      const w = theme.key === 'mystery' ? (inPack(it, pack) ? 1 : 0) : it.themes.includes(theme.key) ? 4 : it.themes.includes('any') ? 1 : 0;
      if (w) list.push({ it, w });
    }
    if (!list.length) for (const it of ITEMS) if (it.r === r && okItem(it, ctx) && inPack(it, pack)) list.push({ it, w: 1 });
    if (!list.length) for (const it of ITEMS) if (it.r === r && okItem(it, ctx)) list.push({ it, w: 1 });
    pools.set(k, list);
  }
  return pools.get(k);
}
const mid = (it) => (it.lo + it.hi) / 2;
// The expected value of one random item from a theme with given rarity weights (base dollars).
const evCache = new Map();
function itemEV(theme, w, ctx = {}) {
  const k = theme.key + JSON.stringify(w) + (ctx.fam ? 'f' : '') + (ctx.pack || '');
  if (!evCache.has(k)) {
    const tot = Object.values(w).reduce((a, b) => a + b, 0);
    let ev = 0;
    for (const r of Object.keys(w)) {
      const pool = poolFor(theme, r, ctx), pw = pool.reduce((a, x) => a + x.w, 0);
      ev += (w[r] / tot) * pool.reduce((a, x) => a + x.w * mid(x.it), 0) / pw;
    }
    evCache.set(k, ev);
  }
  return evCache.get(k);
}

class Bid {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'preview'; this.round = 0; this.plan = []; this.locker = null;
    this.st = new Map(); // player id → bankroll, items, loans, stats
    this.timer = null; this.t1 = null; this.t2 = null; this.botTimer = null;
    this.endsAt = 0; this.dur = 0; this.stage = 0;
    this.resetLocker();
  }
  resetLocker() {
    this.bids = []; this.high = null; this.inspected = new Map(); this.inspectors = []; this.sealed = new Map(); this.sealSeq = 0;
    this.sale = null; this.revealed = 0; this.revealDone = false; this.news = []; this.result = null; this.lastBidFx = -1e9; this.closing = false;
    this.botMax = new Map();
  }
  rng() { return this.room.rng(); }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  rounds() { return Number(this.s.rounds) || 8; }
  startCash() { return Number(this.s.cash) || 2000; }
  scale() { return this.startCash() / 2000; }
  cdMs() { return (Number(this.s.countdown) || 7) * 1000; }
  loansOn() { return this.s.loans !== false && this.s.loans !== 'false'; }
  specialsOn() { return this.s.specials !== false && this.s.specials !== 'false'; }
  loanAmt() { return Math.max(50, Math.round((500 * this.scale()) / 50) * 50); }
  loanLine() { return Math.round(this.startCash() * 0.6); } // "low cash": under 60% of the starting bankroll
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.dur = ms; this.timer = this.room.after(ms, fn); }
  // Locker mix: one content pack's lockers only (null = everything). Family mode is room-wide (TV).
  pack() { return PACK_THEMES[this.s.pack] && PACK_THEMES[this.s.pack].length ? this.s.pack : null; }
  famRoom() { return !!(this.room && this.room.family); }
  ctx() { return { fam: this.famRoom(), pack: this.pack() }; }
  stopAll() { for (const k of ['timer', 't1', 't2', 'botTimer']) { this.room.cancel(this[k]); this[k] = null; } }

  seat(p, waiting = false) {
    if (this.st.has(p.id)) return this.st.get(p.id);
    const st = {
      cash: this.startCash(), loans: 0, items: [], bonus: 0, setsDone: [], waiting, times: [],
      persona: ['cautious', 'greedy', 'random'][Math.floor(this.rng() * 3)],
      stats: { lockers: 0, spent: 0, profits: [], sets: 0, inspects: 0, bids: 0 },
    };
    this.st.set(p.id, st); return st;
  }
  joined(p) { if (this.phase !== 'over') this.seat(p, this.phase !== 'preview'); }
  left(p) {
    if (this.phase === 'auction' && this.high && this.high.id === p.id) {
      // Their bids are withdrawn; the best remaining bid (from someone still here) stands.
      this.bids = this.bids.filter((b) => b.id !== p.id);
      const back = this.bids.filter((b) => this.room.get(b.id));
      this.high = back.length ? back[back.length - 1] : null;
      this.room.fx('withdrawn', { name: p.name });
      this.armCountdown(this.high ? this.cdMs() : this.cdMs() * 2);
      this.kickBots();
    } else if (this.phase === 'sealed') { this.sealed.delete(p.id); this.maybeAllSealed(); }
  }

  // ---- The schedule and the lockers ----
  makePlan() {
    const n = this.rounds(), kinds = Array(n).fill('normal');
    kinds[n - 1] = 'grand';
    if (this.specialsOn()) {
      const m = n <= 6 ? 2 : n <= 8 ? 3 : 4, sp = this.shuffle(['sealed', 'mystery', 'premium']);
      for (let k = 0; k < m; k++) kinds[Math.max(1, Math.min(n - 2, Math.round(((k + 1) * (n - 1)) / (m + 1))))] = sp[k % sp.length];
    }
    const pack = this.pack(), normal = THEMES.filter((t) => !t.special && (!pack || t.pack === pack));
    let deck = [];
    this.plan = kinds.map((kind) => {
      if (kind === 'mystery') return { kind, theme: 'mystery' };
      if (kind === 'premium' && !pack && this.rng() < 0.5) return { kind, theme: 'vault' };
      if (!deck.length) deck = this.shuffle(normal.slice());
      return { kind, theme: deck.pop().key };
    });
  }
  weightsFor(theme, kind) {
    const w = { ...(theme.w || W_DEFAULT) };
    if (kind === 'premium') { w.J *= 0.4; w.C *= 0.7; w.R *= 1.8; w.E *= 2.2; w.L *= 2.5; }
    if (kind === 'grand') { w.R *= 1.3; w.E *= 1.4; w.L *= 1.5; }
    return w;
  }
  pickWeighted(list, wOf) {
    const tot = list.reduce((a, x) => a + wOf(x), 0); let r = this.rng() * tot;
    for (const x of list) { r -= wOf(x); if (r <= 0) return x; }
    return list[list.length - 1];
  }
  makeLocker(spec) {
    const theme = THEME[spec.theme], kind = spec.kind, w = this.weightsFor(theme, kind), sc = this.scale();
    const base = 5 + Math.floor(this.rng() * 3), size = kind === 'grand' ? base * 2 : base;
    const items = [], used = new Set(), ctx = this.ctx();
    for (let i = 0; i < size; i++) {
      const r = this.pickWeighted(Object.keys(w), (k) => w[k]);
      let pool = poolFor(theme, r, ctx).filter((x) => !used.has(x.it.id));
      if (!pool.length) pool = ITEMS.filter((it) => it.r === r && !used.has(it.id) && okItem(it, ctx) && inPack(it, ctx.pack)).map((it) => ({ it, w: 1 }));
      if (!pool.length) pool = ITEMS.filter((it) => it.r === r && !used.has(it.id) && okItem(it, ctx)).map((it) => ({ it, w: 1 }));
      const it = this.pickWeighted(pool, (x) => x.w).it; used.add(it.id);
      items.push({ ...it, value: niceVal((it.lo + this.rng() * (it.hi - it.lo)) * sc) });
    }
    // Reveal order: shuffled, but the most valuable thing comes out last.
    this.shuffle(items);
    let top = 0; items.forEach((it, i) => { if (it.value > items[top].value) top = i; });
    items.push(items.splice(top, 1)[0]);
    // Three peeks: mostly real items (seen as a vague silhouette), sometimes a theme decoy.
    const clues = [];
    if (!theme.noClues) {
      const order = this.shuffle(items.map((_, i) => i)), decoys = this.shuffle(theme.decoys.slice());
      for (let j = 0; j < 3; j++) {
        if (decoys.length && this.rng() < 0.22) { const d = decoys.pop(); clues.push({ icon: d.icon, text: d.text, idx: null }); }
        else { const i = order.pop(); clues.push({ icon: items[i].clue.icon, text: items[i].clue.text, idx: i }); }
      }
    }
    const evItem = itemEV(theme, w, ctx) * sc;
    const ev = evItem * size;
    const opening = round10(ev * (kind === 'premium' ? 0.35 : kind === 'grand' ? 0.22 : kind === 'sealed' ? 0.15 : 0.12));
    return { kind, theme, items, clues, size, opening, evItem, ev };
  }

  start() {
    for (const p of this.room.list()) this.seat(p);
    this.makePlan();
    this.newLocker();
  }
  newLocker() {
    this.stopAll();
    if (this.round >= this.rounds()) return this.finish();
    this.round++;
    this.resetLocker();
    this.locker = this.makeLocker(this.plan[this.round - 1]);
    for (const st of this.st.values()) { st.waiting = false; st.times = []; }
    this.phase = 'preview'; this.stage = 0;
    this.room.fx('door', { kind: this.locker.kind });
    if (this.locker.kind !== 'normal') this.room.fx(this.locker.kind);
    this.setTimer(PREVIEW_MS, () => this.openBidding());
    this.botsPrepare();
  }
  openBidding() {
    if (this.phase !== 'preview') return;
    if (this.locker.kind === 'sealed') {
      this.phase = 'sealed';
      this.setTimer(SEALED_MS, () => this.closeSealed());
      for (const p of this.room.list()) if (p.bot) this.room.after(1500 + this.rng() * SEALED_MS * 0.6, () => this.botSealed(p));
      return;
    }
    this.phase = 'auction';
    this.room.fx('open');
    this.armCountdown(this.cdMs() * 2); // a longer wait for the opening bid
    this.kickBots();
  }
  // Every new bid restarts the countdown: open → going once (⅓) → going twice (⅔) → SOLD.
  armCountdown(ms) {
    for (const k of ['t1', 't2']) this.room.cancel(this[k]);
    this.stage = 0;
    this.t1 = this.room.after(Math.round(ms / 3), () => { this.stage = 1; this.room.fx('once'); });
    this.t2 = this.room.after(Math.round((2 * ms) / 3), () => { this.stage = 2; this.room.fx('twice'); });
    this.setTimer(ms, () => this.hammer());
  }
  hammer() {
    if (this.phase !== 'auction') return;
    this.stopAll();
    const h = this.high && this.room.get(this.high.id) ? this.high : null;
    this.sell(h ? { id: h.id, price: h.amount } : null);
  }
  sell(win) {
    this.phase = 'sold'; this.stage = 0;
    if (win) {
      const st = this.st.get(win.id);
      const price = Math.min(win.price, st.cash);
      st.cash -= price; st.stats.lockers++; st.stats.spent += price;
      this.sale = { id: win.id, name: this.room.name(win.id), color: (this.room.get(win.id) || {}).color, price, sealed: this.locker.kind === 'sealed' };
      this.room.fx('sold', { name: this.sale.name, price });
    } else { this.sale = null; this.room.fx('nosale'); }
    this.setTimer(SOLD_MS, () => this.startReveal());
  }
  closeSealed() {
    if (this.phase !== 'sealed') return;
    this.stopAll();
    const sorted = [...this.sealed].filter(([id]) => this.room.get(id)).map(([id, b]) => ({ id, ...b })).sort((a, b) => b.amount - a.amount || a.seq - b.seq);
    this.sell(sealedPrice(sorted, this.locker.opening));
  }
  maybeAllSealed() {
    if (this.phase !== 'sealed' || this.closing) return;
    const on = this.room.list().filter((p) => (p.bot || p.sockets > 0) && !this.st.get(p.id).waiting);
    if (!on.length || !on.every((p) => this.sealed.has(p.id))) return;
    this.closing = true; this.setTimer(END_EARLY_MS, () => this.closeSealed());
  }

  // ---- The reveal: one item at a time, the best for last ----
  startReveal() {
    if (this.phase !== 'sold') return;
    this.phase = 'reveal'; this.revealed = 0; this.revealDone = false;
    this.room.fx('rollup');
    this.queueReveal(1200);
  }
  stepMs() { return this.locker.size > 8 ? 950 : 1350; }
  queueReveal(ms) {
    const next = this.locker.items[this.revealed];
    if (next && RANK[next.r] >= RANK.E) { this.setTimer(ms, () => { this.room.fx('tension'); this.setTimer(1700, () => this.revealOne()); }); return; }
    this.setTimer(ms, () => this.revealOne());
  }
  revealOne() {
    if (this.phase !== 'reveal' || this.revealDone) return;
    const it = this.locker.items[this.revealed++];
    this.room.fx(it.jackpot ? 'jackpot' : 'item' + it.r);
    if (this.revealed < this.locker.size) this.queueReveal(RANK[it.r] >= RANK.E ? this.stepMs() + 1000 : this.stepMs());
    else this.setTimer(1300, () => this.showTotal());
  }
  showTotal() {
    if (this.phase !== 'reveal' || this.revealDone) return;
    this.revealed = this.locker.size; this.revealDone = true;
    const total = this.locker.items.reduce((a, it) => a + it.value, 0);
    this.result = { total, price: this.sale ? this.sale.price : null, profit: this.sale ? total - this.sale.price : null };
    if (this.sale) this.applyLocker(total);
    this.room.fx(!this.sale ? 'missed' : this.result.profit >= 0 ? 'profit' : 'loss');
    for (const n of this.news) this.room.fx('set', { name: n.name, set: n.label });
    this.setTimer(TOTAL_MS + (this.news.length ? BONUS_MS : 0), () => this.newLocker());
  }
  applyLocker(total) {
    const st = this.st.get(this.sale.id);
    if (!st || !this.room.get(this.sale.id)) return;
    for (const it of this.locker.items) st.items.push({ emoji: it.emoji, name: it.name, r: it.r, value: it.value, set: it.set, jackpot: it.jackpot, round: this.round });
    st.stats.profits.push(total - this.sale.price);
    const count = {};
    for (const it of st.items) if (it.set) count[it.set] = (count[it.set] || 0) + 1;
    for (const [set, n] of Object.entries(count)) {
      if (n < 3 || st.setsDone.includes(set)) continue;
      const amt = round10(SETS[set].bonus * this.scale());
      st.setsDone.push(set); st.bonus += amt; st.stats.sets++;
      this.news.push({ name: this.sale.name, set, label: SETS[set].label, icon: SETS[set].icon, amount: amt });
    }
  }
  finish() {
    this.stopAll();
    this.phase = 'over'; this.endsAt = 0; this.dur = 0;
    this.awards = this.makeAwards();
    this.room.fx('over');
  }
  next() {
    if (this.phase === 'preview') this.openBidding();
    else if (this.phase === 'auction') this.hammer();
    else if (this.phase === 'sealed') this.closeSealed();
    else if (this.phase === 'sold') this.startReveal();
    else if (this.phase === 'reveal') { if (!this.revealDone) { this.stopAll(); this.showTotal(); } else this.newLocker(); }
  }

  // ---- Moves from phones ----
  reserved(id) { // cash already promised: your standing high bid or your sealed bid
    if (this.phase === 'auction' && this.high && this.high.id === id) return this.high.amount;
    if (this.phase === 'sealed' && this.sealed.has(id)) return this.sealed.get(id).amount;
    return 0;
  }
  minBid() { return this.high ? this.high.amount + MIN_INC : this.locker.opening; }
  addAmount(add) { return Math.max(this.locker.opening, (this.high ? this.high.amount : this.locker.opening - MIN_INC) + add); }
  inspectFee(st) { return Math.max(25, Math.round(st.cash * 0.05)); }

  act(p, m) {
    if (this.phase === 'over') return { ok: false, error: 'The auction house is closed.' };
    const st = this.seat(p, this.phase !== 'preview');
    const op = m && m.op;
    if (op === 'loan') {
      if (!this.loansOn()) return { ok: false, error: 'The bank is closed this game.' };
      if (st.loans >= MAX_LOANS) return { ok: false, error: `The bank says no: max ${MAX_LOANS} loans.` };
      if (st.cash >= this.loanLine()) return { ok: false, error: `Loans are for when you're under ${fmt(this.loanLine())} cash.` };
      st.loans++; st.cash += this.loanAmt();
      this.room.fx('loan', { name: p.name });
      return { ok: true };
    }
    if (st.waiting) return { ok: false, error: 'You jump in from the next locker!' };
    if (op === 'bid') {
      if (this.phase !== 'auction') return { ok: false, error: 'Bidding is closed.' };
      const now = this.room.now();
      st.times = st.times.filter((t) => now - t < RATE_MS);
      if (st.times.length >= RATE_N) return { ok: false, error: 'Easy, tiger! Max 3 bids a second.' };
      st.times.push(now);
      let amount;
      if (m.add != null) {
        if (!ADDS.includes(m.add)) return { ok: false, error: 'Pick a bid button.' };
        amount = this.addAmount(m.add);
      } else {
        amount = dollars(m.amount);
        if (Number.isNaN(amount)) return { ok: false, error: 'Bid a whole number of dollars.' };
      }
      if (this.high && this.high.id === p.id) return { ok: false, error: 'You’re already the high bidder!' };
      if (amount < this.minBid()) return { ok: false, error: `Bid at least ${fmt(this.minBid())}.` };
      if (amount > st.cash) return { ok: false, error: `You only have ${fmt(st.cash)}.${this.loansOn() && st.loans < MAX_LOANS ? ' Need a loan? 🏦' : ''}` };
      this.high = { id: p.id, amount, at: now };
      this.bids.push(this.high); if (this.bids.length > 400) this.bids.splice(0, this.bids.length - 300);
      st.stats.bids++;
      if (!p.bot || now - this.lastBidFx > 300) { this.room.fx('bid', { name: p.name, amount }); this.lastBidFx = now; }
      this.armCountdown(this.cdMs());
      if (!p.bot) this.kickBots(); // the bots may want to answer a human's bid
      return { ok: true, amount };
    }
    if (op === 'sealed') {
      if (this.phase !== 'sealed') return { ok: false, error: 'This isn’t a sealed-bid locker.' };
      if (this.sealed.has(p.id)) return { ok: false, error: 'Your secret bid is already in the envelope.' };
      const amount = dollars(m.amount);
      if (Number.isNaN(amount)) return { ok: false, error: 'Bid a whole number of dollars.' };
      if (amount < this.locker.opening) return { ok: false, error: `The minimum is ${fmt(this.locker.opening)}.` };
      if (amount > st.cash) return { ok: false, error: `You only have ${fmt(st.cash)}.` };
      this.sealed.set(p.id, { amount, seq: ++this.sealSeq });
      if (!p.bot || this.room.now() - this.lastBidFx > 400) { this.room.fx('envelope'); this.lastBidFx = this.room.now(); }
      this.maybeAllSealed();
      return { ok: true };
    }
    if (op === 'inspect') {
      if (!['preview', 'auction', 'sealed'].includes(this.phase)) return { ok: false, error: 'Too late to inspect.' };
      if (this.inspected.has(p.id)) return { ok: false, error: 'You already peeked at this locker.' };
      const fee = this.inspectFee(st);
      if (st.cash - fee < this.reserved(p.id)) return { ok: false, error: 'You can’t afford the flashlight and your bid.' };
      if (st.cash < fee) return { ok: false, error: `The flashlight costs ${fmt(fee)}.` };
      st.cash -= fee; st.stats.inspects++;
      const items = this.locker.items;
      let res;
      if (this.rng() < 0.5) {
        const it = items[Math.floor(this.rng() * items.length)];
        res = { type: 'rarity', r: it.r, label: RLABEL[it.r], fee };
      } else {
        const top = Math.max(...items.map((it) => it.value));
        const b = BANDS.map((x) => x * this.scale());
        let i = 0; while (i < b.length - 1 && top >= b[i + 1]) i++;
        res = { type: 'band', lo: Math.round(b[i]), hi: i + 1 < b.length ? Math.round(b[i + 1]) : null, fee };
      }
      this.inspected.set(p.id, res);
      this.inspectors.push(p.name); if (this.inspectors.length > 30) this.inspectors.shift();
      if (!p.bot || this.inspectors.length < 6) this.room.fx('flash', { name: p.name });
      return { ok: true, result: res };
    }
    return { ok: false, error: 'Unknown move.' };
  }

  // ---- Bots: read the clues, add noise and a personality, bid up to their estimate ----
  botEstimate(p) {
    const L = this.locker, st = this.st.get(p.id), r = () => this.rng();
    let est = 0, known = 0;
    for (const c of L.clues) {
      if (c.idx == null) { est += L.evItem * (0.8 + r() * 0.8); continue; }
      known++;
      const it = L.items[c.idx];
      est += mid(it) * this.scale() * (0.6 + r() * 0.8);
    }
    est += (L.size - known) * L.evItem * (0.8 + r() * 0.4);
    const f = st.persona === 'cautious' ? 0.55 + r() * 0.2 : st.persona === 'greedy' ? 0.85 + r() * 0.25 : 0.5 + r() * 0.6;
    // Winner's curse: in a crowd the keenest of many noisy guesses wins, so bots shade down.
    const crowd = 1 - Math.min(0.3, 0.03 * Math.sqrt(this.room.list().filter((x) => x.bot).length));
    return Math.round(est * f * crowd);
  }
  botsPrepare() {
    for (const p of this.room.list()) {
      if (!p.bot) continue;
      const st = this.st.get(p.id); if (!st) continue;
      if (this.loansOn() && st.loans < MAX_LOANS && st.cash < this.loanLine() && this.rng() < 0.5) this.act(p, { op: 'loan' });
      this.botMax.set(p.id, this.botEstimate(p));
      if (this.rng() < 0.2 && st.cash > 300 * this.scale()) this.room.after(800 + this.rng() * (PREVIEW_MS - 1600), () => this.botInspect(p));
    }
  }
  botInspect(p) {
    if (this.phase !== 'preview' || !this.room.get(p.id)) return;
    const r = this.act(p, { op: 'inspect' }); if (!r.ok) return;
    const res = r.result, max = this.botMax.get(p.id) || 0;
    if (res.type === 'rarity') this.botMax.set(p.id, Math.round(max * (RANK[res.r] >= RANK.R ? 1.2 : RANK[res.r] === 0 ? 0.85 : 1)));
    else this.botMax.set(p.id, Math.round(max * 0.5 + ((res.lo + (res.hi || res.lo * 2)) / 2 + (this.locker.size - 1) * this.locker.evItem) * 0.45));
  }
  botSealed(p) {
    if (this.phase !== 'sealed' || this.sealed.has(p.id) || !this.room.get(p.id)) return;
    const st = this.st.get(p.id), bid = Math.min(st.cash, round10((this.botMax.get(p.id) || 0) * (0.7 + this.rng() * 0.25)));
    if (bid >= this.locker.opening) this.act(p, { op: 'sealed', amount: bid });
  }
  // One shared ticker for all bots (cheap with 100 players): now and then one of the bots who
  // still value the locker above the current price bids, more eagerly as the hammer nears.
  kickBots() { if (!this.botTimer && this.phase === 'auction') this.botTimer = this.room.after(350 + this.rng() * 500, () => this.botTick()); }
  botTick() {
    this.botTimer = null;
    if (this.phase !== 'auction') return;
    const min = this.minBid();
    const keen = this.room.list().filter((p) => p.bot && !(this.high && this.high.id === p.id) && (this.botMax.get(p.id) || 0) >= min && this.st.get(p.id).cash >= min && !this.st.get(p.id).waiting);
    if (!keen.length) return; // nobody wants it at this price; a human bid or a withdrawal re-kicks us
    const chance = [0.3, 0.5, 0.85][this.stage] || 0.3;
    if (this.rng() < chance) {
      const p = keen[Math.floor(this.rng() * keen.length)], max = Math.min(this.botMax.get(p.id), this.st.get(p.id).cash);
      const gap = max - min;
      let add = gap > 1500 * this.scale() && this.rng() < 0.3 ? 500 : gap > 400 * this.scale() && this.rng() < 0.5 ? 100 : gap > 60 && this.rng() < 0.5 ? 25 : 10;
      while (add > 10 && this.addAmount(add) > max) add = ADDS[ADDS.indexOf(add) - 1];
      this.act(p, { op: 'bid', add });
    }
    this.kickBots();
  }

  // ---- Scores ----
  itemValue(st) { return st.items.reduce((a, it) => a + it.value, 0); }
  net(st) { return st.cash + this.itemValue(st) + st.bonus - Math.round(st.loans * this.loanAmt() * LOAN_RATE); }
  standings() {
    const rows = [];
    for (const [id, st] of this.st) {
      const p = this.room.get(id); if (!p) continue;
      rows.push({ id, name: p.name, av: p.avatar || null, color: p.color, net: this.net(st), cash: st.cash, items: st.items.length, itemValue: this.itemValue(st), bonus: st.bonus, loans: st.loans, debt: Math.round(st.loans * this.loanAmt() * LOAN_RATE) });
    }
    return rows.sort((a, b) => b.net - a.net);
  }
  makeAwards() {
    const rows = [...this.st].filter(([id]) => this.room.get(id)).map(([id, st]) => {
      const pr = st.stats.profits;
      return { id, name: this.room.name(id), ...st.stats, best: pr.length ? Math.max(...pr) : null, worst: pr.length ? Math.min(...pr) : null, avg: pr.length ? pr.reduce((a, b) => a + b, 0) / pr.length : null };
    });
    const out = [], won = rows.filter((r) => r.lockers > 0 && r.profits.length);
    const pick = (list, cmp) => list.slice().sort(cmp)[0];
    if (won.length) {
      const bf = pick(won, (a, b) => b.best - a.best);
      if (bf.best > 0) out.push({ icon: '💰', title: 'Best Flip', name: bf.name, id: bf.id, why: `${fmt(bf.best)} profit on one locker` });
      const wb = pick(won, (a, b) => a.worst - b.worst);
      if (wb.worst < 0) out.push({ icon: '🗑️', title: 'Worst Buy', name: wb.name, id: wb.id, why: `lost ${fmt(-wb.worst)} (it was the thought that counts)` });
      const se = pick(won, (a, b) => b.avg - a.avg);
      out.push({ icon: '🦉', title: 'Sharp Eye', name: se.name, id: se.id, why: `${se.avg >= 0 ? '+' : ''}${fmt(se.avg)} per locker on average` });
      const ho = pick(won, (a, b) => b.lockers - a.lockers);
      out.push({ icon: '🏚️', title: 'Hoarder', name: ho.name, id: ho.id, why: `won ${ho.lockers} locker${ho.lockers === 1 ? '' : 's'}` });
    }
    const co = pick(rows, (a, b) => b.sets - a.sets);
    if (co && co.sets > 0) out.push({ icon: '🧩', title: 'Collector', name: co.name, id: co.id, why: `${co.sets} set bonus${co.sets === 1 ? '' : 'es'}` });
    const bs = pick(rows, (a, b) => b.spent - a.spent);
    if (bs && bs.spent > 0) out.push({ icon: '🤑', title: 'Big Spender', name: bs.name, id: bs.id, why: `spent ${fmt(bs.spent)}` });
    const ws = pick(rows.filter((r) => !r.lockers), (a, b) => b.inspects - a.inspects);
    if (ws && ws.inspects >= 2) out.push({ icon: '🔦', title: 'Window Shopper', name: ws.name, id: ws.id, why: `peeked ${ws.inspects} times, never bought` });
    const bw = pick(rows, (a, b) => b.bids - a.bids);
    if (bw && bw.bids >= 5) out.push({ icon: '🙋', title: 'Paddle Waver', name: bw.name, id: bw.id, why: `${bw.bids} bids placed` });
    return out;
  }

  results() { return this.standings().map((r) => r.id); }

  // ---- What the screens may see ----
  endsIn() { return this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0; }
  publicLocker() {
    const L = this.locker; if (!L) return null;
    const k = KIND[L.kind];
    return {
      kind: L.kind, kindLabel: k.label, kindIcon: k.icon, theme: L.theme.name, themeIcon: L.theme.icon, door: L.theme.door,
      clues: L.clues.map((c) => ({ icon: c.icon, text: c.text })), size: L.size, opening: L.opening, minInc: MIN_INC,
    };
  }
  revealState() {
    if (this.phase !== 'reveal') return null;
    const shown = this.locker.items.slice(0, this.revealed).map((it) => ({ emoji: it.emoji, name: it.name, r: it.r, rarity: RLABEL[it.r], value: it.value, set: it.set, setLabel: it.set ? SETS[it.set].label : null, setIcon: it.set ? SETS[it.set].icon : null, jackpot: it.jackpot }));
    return { items: shown, size: this.locker.size, done: this.revealDone, sofar: shown.reduce((a, it) => a + it.value, 0), result: this.revealDone ? this.result : null, news: this.revealDone ? this.news : [] };
  }
  bidders() { // the best bid of each player still here, highest first
    const best = new Map();
    for (const b of this.bids) if (this.room.get(b.id) && (!best.has(b.id) || b.amount > best.get(b.id))) best.set(b.id, b.amount);
    return [...best].map(([id, amount]) => ({ id, amount })).sort((a, b) => b.amount - a.amount);
  }
  common() {
    const h = this.high && this.room.get(this.high.id) ? this.high : null;
    return {
      phase: this.phase, round: this.round, rounds: this.rounds(), endsIn: this.endsIn(), dur: this.dur, stage: this.stage,
      locker: this.publicLocker(), kind: this.locker ? this.locker.kind : null,
      high: h ? { name: this.room.name(h.id), color: this.room.get(h.id).color, amount: h.amount } : null,
      bidCount: this.bids.length, sale: this.sale, reveal: this.revealState(),
      loanAmt: this.loanAmt(), loansOn: this.loansOn(),
    };
  }
  tv() {
    const s = this.common(), stand = this.standings();
    s.standings = stand.slice(0, 12);
    s.players = stand.length;
    if (this.phase === 'auction') {
      const bs = this.bidders();
      s.top = bs.slice(0, 3).map((b) => ({ name: this.room.name(b.id), color: this.room.get(b.id).color, amount: b.amount }));
      s.bidders = bs.length;
      s.ticker = this.bids.slice(-8).reverse().filter((b) => this.room.get(b.id)).map((b) => ({ name: this.room.name(b.id), color: this.room.get(b.id).color, amount: b.amount }));
    }
    if (this.phase === 'sealed') {
      const elig = this.room.list().filter((p) => !this.st.get(p.id)?.waiting);
      s.sealedIn = this.sealed.size; s.eligible = elig.length;
      s.sealWaiting = elig.filter((p) => !p.bot && !this.sealed.has(p.id)).slice(0, 8).map((p) => p.name); // who the envelopes wait on
    }
    s.inspectors = this.inspectors.slice(-5); s.inspectCount = this.inspected.size;
    if (this.phase === 'over') { s.final = stand.slice(0, 20); s.awards = this.awards; }
    return s;
  }
  view(p) {
    const st = this.seat(p, this.phase !== 'preview' && this.phase !== 'over'), s = this.common();
    const stand = this.standings(), rank = stand.findIndex((r) => r.id === p.id) + 1;
    Object.assign(s, {
      cash: st.cash, loans: st.loans, net: this.net(st), rank, of: stand.length, waiting: st.waiting, debt: Math.round(st.loans * this.loanAmt() * LOAN_RATE),
      canLoan: this.loansOn() && st.loans < MAX_LOANS && st.cash < this.loanLine() && this.phase !== 'over', loanLine: this.loanLine(), maxLoans: MAX_LOANS,
      inspect: this.locker && ['preview', 'auction', 'sealed'].includes(this.phase) ? { fee: this.inspectFee(st), result: this.inspected.get(p.id) || null } : null,
    });
    if (this.phase === 'auction') {
      const bs = this.bidders(), mine = bs.findIndex((b) => b.id === p.id);
      s.me = { high: !!(this.high && this.high.id === p.id), best: mine >= 0 ? bs[mine].amount : null, pos: mine + 1, of: bs.length };
      s.minBid = this.minBid();
      s.adds = ADDS.map((add) => ({ add, amount: this.addAmount(add) }));
    }
    if (this.phase === 'sealed') { const b = this.sealed.get(p.id); s.mySealed = b ? b.amount : null; s.minBid = this.locker.opening; }
    s.mine = this.sale && this.sale.id === p.id;
    // The collection: items you own, and how close each set is to its bonus.
    const count = {};
    for (const it of st.items) if (it.set) count[it.set] = (count[it.set] || 0) + 1;
    s.collection = {
      items: st.items.slice(-40).reverse().map((it) => ({ emoji: it.emoji, name: it.name, r: it.r, value: it.value, set: it.set })),
      value: this.itemValue(st), bonus: st.bonus,
      sets: Object.entries(count).map(([k, n]) => ({ key: k, label: SETS[k].label, icon: SETS[k].icon, n: Math.min(n, 3), done: st.setsDone.includes(k), bonus: round10(SETS[k].bonus * this.scale()) })).sort((a, b) => b.n - a.n),
    };
    if (this.phase === 'over') { s.final = stand.slice(0, 10); s.awards = (this.awards || []).filter((a) => a.id === p.id); s.my = stand.find((r) => r.id === p.id) || null; }
    return s;
  }
}

module.exports = {
  key: 'bid', name: 'JustBid', min: 1, best: [3, 10], howSteps: 6, fields, defaults, show: true, // game-show opening (box/show.js)
  create: (room, settings) => new Bid(room, settings),
  sealedPrice, fmt, ADDS, MIN_INC,
};
