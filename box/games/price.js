'use strict';
// Price Panic: a product goes up on the TV and everyone guesses its price on their phone.
// The closer you are, the more points (up to 1000); going OVER the real price halves them.
// Within 5% (without going over) is a Bullseye (+500); the exact price is a Jackpot (+1000).
// Three rounds in a row within 15% is a Hot Streak (+300). Each player has three one-time
// power-ups: Double Down (×2), Bust Shield (no halving) and Peek (see the room's average).
// Every 4th round is "Higher or Lower?" (fast taps, speed bonus); in longer games some rounds
// are "Which Costs More?" (two items, tap the pricier one, speed bonus). The last round is a
// Shopping Spree: three items, guess the TOTAL, and its points count DOUBLE (comeback time).
// All items are original (price-items.js).
const { ITEMS, CATEGORIES } = require('./price-items');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rounds', label: 'Rounds', options: opt([[6, '6 rounds'], [10, '10 rounds'], [15, '15 rounds']]) },
  { key: 'seconds', label: 'Time to guess', options: opt([[20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds']]) },
  { key: 'category', label: 'Aisles', options: opt([['all', 'Everything'], ['everyday', 'Everything but Big Ticket'], ...CATEGORIES.filter((c) => !c.pack).map((c) => [c.key, `${c.icon} ${c.label} only`]),
    ...CATEGORIES.filter((c) => c.pack).map((c) => [c.key, `${c.icon} ${c.pack} pack`])]) },
  { key: 'difficulty', label: 'Difficulty', options: opt([['easy', '🟢 Easy (Bullseye within 10%, going over costs less)'], ['medium', '🟡 Medium (Bullseye within 5%)'], ['hard', '🔴 Hard (Bullseye within 3%, strict)']]) },
];
const defaults = { rounds: 10, seconds: 30, category: 'all', difficulty: 'medium' };
// Difficulty: Easy is a Bullseye within 10% and going over only costs a quarter; Hard a Bullseye
// within 3% and points fall off twice as fast. Medium is the classic rule (5%, over = half).
const LEVEL = { easy: { bull: 0.10, bust: 0.75, slope: 1 }, medium: { bull: 0.05, bust: 0.5, slope: 1 }, hard: { bull: 0.03, bust: 0.5, slope: 2 } };
const INTRO_MS = 3500, DRUM_MS = 2400, REVEAL_MS = 8000, HILO_REVEAL_MS = 6000, HILO_SECONDS = 12, END_EARLY_MS = 900;
const MAX_GUESS = 1e8, STREAK_PCT = 0.15, STREAK_BONUS = 300, BULL_BONUS = 500, JACKPOT_BONUS = 1000;
const POWERS = ['double', 'shield', 'peek'];
const FINAL_MULT = 2; // the last round (Shopping Spree) counts double
const TAP_KINDS = new Set(['hilo', 'versus']); // quick-tap rounds (no typed price)
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));

const fmt = (v) => '$' + (v < 100 && Math.round(v * 100) % 100 !== 0
  ? v.toFixed(2) : Math.round(v).toLocaleString('en-US'));
// A friendly round number at or above x (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10^k).
function niceUp(x) {
  if (!(x > 0)) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(x)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * e >= x - 1e-9) return m * e;
  return 10 * e;
}
// A believable shelf price near x (x.99 for small things, round numbers for big ones).
function shelfPrice(x) {
  if (x < 10) return Math.max(0.49, Math.floor(x) + 0.49 + (x % 1 >= 0.5 ? 0.5 : 0));
  if (x < 100) return Math.floor(x) + 0.99;
  if (x < 1000) return Math.round(x / 5) * 5 - 1;
  if (x < 10000) return Math.round(x / 50) * 50;
  return Math.round(x / 500) * 500;
}
const cents = (v) => Math.round(v * 100) / 100;

// The scoring rule for one price guess (exported for the tests and shown as math on reveal).
function scoreGuess(guess, price, o = {}) {
  const L = LEVEL[o.level] || LEVEL.medium;
  const off = Math.abs(guess - price) / price;
  const pct = Math.round(off * 1000) / 10;
  const exact = Math.round(guess * 100) === Math.round(price * 100);
  const over = guess > price && !exact;
  const math = [];
  let pts = Math.round(1000 * Math.max(0, 1 - off * L.slope));
  math.push({ label: exact ? 'Spot on!' : `${pct}% ${over ? 'over' : 'under'}`, val: String(pts) });
  const bust = over && !o.shield;
  if (bust) { pts = Math.round(pts * L.bust); math.push({ label: '💥 Bust! Went over', val: (L.bust === 0.5 ? '½' : '¾') + ' → ' + pts }); }
  else if (over) math.push({ label: '🛡️ Bust Shield saved you', val: 'no halving' });
  const bull = off <= L.bull + 1e-9 && (!over || !!o.shield);
  if (bull) { pts += BULL_BONUS; math.push({ label: `🎯 Bullseye! (within ${Math.round(L.bull * 100)}%)`, val: '+' + BULL_BONUS }); }
  if (exact) { pts += JACKPOT_BONUS; math.push({ label: '💰 JACKPOT! Exact price', val: '+' + JACKPOT_BONUS }); }
  return { off, pct, over, bust, bull, exact, pts, math };
}

class Price {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'intro'; this.round = 0; this.kind = 'guess'; this.items = []; this.endsAt = 0; this.timer = null;
    this.scores = new Map(); this.stats = new Map(); this.used = new Map();
    this.guesses = new Map(); this.peeks = new Set(); this.scored = new Map(); this.dropped = false; this.lastLockFx = 0;
  }
  shuffle(a) { const r = this.room.rng; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  rounds() { return Number(this.s.rounds) || 10; }
  seat(p) {
    if (this.scores.has(p.id)) return;
    this.scores.set(p.id, 0); this.used.set(p.id, new Set());
    this.stats.set(p.id, { n: 0, bulls: 0, busts: 0, offSum: 0, ratioSum: 0, streak: 0, best: 0, hiloRight: 0 });
  }
  joined(p) { this.seat(p); }
  left() { if (this.phase === 'guess') this.maybeAllIn(); }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }

  // Family mode (room-wide, set on the TV) keeps every shelf item family-safe, whatever the aisle.
  famRoom() { return !!(this.room && this.room.family); }
  stock() { return this.famRoom() ? ITEMS.filter((i) => i.family) : ITEMS; }
  start() {
    const cat = this.s.category, base = this.base = this.stock();
    const pool = this.pool = base.filter((i) => cat === 'all' || (cat === 'everyday' ? i.cat !== 'big' : i.cat === cat));
    this.packOnly = !!(CAT[cat] && CAT[cat].pack && pool.length >= 20);
    const need = this.rounds() + 2;
    // A small aisle tops up from the rest of the store so a long game never runs out.
    this.deck = this.shuffle(pool.slice());
    if (this.deck.length < need) this.deck = this.deck.concat(this.shuffle(base.filter((i) => !pool.includes(i) && i.cat !== 'big')));
    for (const p of this.room.list()) this.seat(p);
    this.nextRound();
  }
  // A content pack reshuffles its own shelf; otherwise the whole (family-filtered) store.
  draw() { if (!this.deck.length) this.deck = this.shuffle((this.packOnly ? this.pool : this.base || this.stock()).slice()); return this.deck.pop(); }
  kindOf(n) { if (n === this.rounds()) return 'spree'; if (n % 4 === 0) return 'hilo'; return n % 4 === 2 && n > 2 ? 'versus' : 'guess'; }
  tap() { return TAP_KINDS.has(this.kind); }
  // Two items for "Which Costs More?": clearly different prices (15% to 4x apart), ideally the same aisle.
  drawPair() {
    const a = this.draw();
    const ok = (b) => { if (!b || b === a || b.name === a.name) return false; const k = Math.max(a.price, b.price) / Math.min(a.price, b.price); return k >= 1.15 && k <= 4; };
    let i = this.deck.findIndex((b) => ok(b) && b.cat === a.cat);
    if (i < 0) i = this.deck.findIndex(ok);
    let b;
    if (i >= 0) b = this.deck.splice(i, 1)[0];
    else { const base = this.base || this.stock(), pool = base.filter((x) => ok(x) && x.cat !== 'big'); b = pool.length ? pool[Math.floor(this.room.rng() * pool.length)] : base.find((x) => x !== a && x.price !== a.price); }
    return this.room.rng() < 0.5 ? [a, b] : [b, a];
  }

  nextRound() {
    this.room.cancel(this.timer); this.room.cancel(this.halfTimer);
    if (this.round >= this.rounds()) return this.finish();
    this.round++; this.kind = this.kindOf(this.round);
    this.guesses = new Map(); this.peeks = new Set(); this.scored = new Map(); this.dropped = false; this.closing = false; this.summary = null;
    this.items = this.kind === 'spree' ? [this.draw(), this.draw(), this.draw()] : this.kind === 'versus' ? this.drawPair() : [this.draw()];
    this.price = this.kind === 'versus' ? Math.max(this.items[0].price, this.items[1].price) : cents(this.items.reduce((a, i) => a + i.price, 0));
    this.pricier = this.kind === 'versus' ? (this.items[0].price > this.items[1].price ? 0 : 1) : null;
    this.sliderMax = niceUp(this.price * (2.5 + this.room.rng() * 2.5)); // fuzzed so the range doesn't give the price away
    if (this.kind === 'hilo') {
      const r = this.room.rng(), f = r < 0.5 ? 0.45 + this.room.rng() * 0.4 : 1.2 + this.room.rng() * 0.9;
      let shown = shelfPrice(this.price * f); if (Math.abs(shown - this.price) < 0.01) shown = cents(this.price * 1.5);
      this.hiloPrice = cents(shown);
    } else this.hiloPrice = null;
    if (this.kind === 'guess') { this.room.fx('item'); return this.openGuess(); }
    this.phase = 'intro'; this.room.fx(this.kind);
    this.setTimer(INTRO_MS, () => this.openGuess());
  }
  duration() { return (this.tap() ? HILO_SECONDS : this.kind === 'spree' ? this.s.seconds * 1.5 : this.s.seconds) * 1000; }
  openGuess() {
    if (this.phase === 'guess') return;
    this.phase = 'guess'; this.startedAt = this.room.now(); this.dur = this.duration();
    this.setTimer(this.dur, () => this.close());
    if (!this.tap()) this.halfTimer = this.room.after(this.dur / 2, () => {}); // re-sync phones so Peek unlocks
    for (const p of this.room.list()) if (p.bot) this.room.after(this.tap() ? 900 + this.room.rng() * 7000 : 1500 + this.room.rng() * this.dur * 0.7, () => this.botPlay(p));
  }
  online() { return this.room.list().filter((p) => p.bot || p.sockets > 0); }
  maybeAllIn() {
    if (this.phase !== 'guess' || this.closing) return;
    const on = this.online();
    if (!on.length || !on.every((p) => this.guesses.has(p.id))) return;
    this.closing = true; this.setTimer(END_EARLY_MS, () => this.close());
  }

  close() {
    if (this.phase !== 'guess') return;
    this.room.cancel(this.halfTimer);
    this.phase = 'reveal'; this.dropped = false;
    for (const [id, g] of this.guesses) this.scored.set(id, this.tap() ? this.scoreHilo(g) : this.scorePrice(id, g));
    // Where everyone finished this round (best points first) so each phone can say "#3 of 12".
    const order = [...this.scored.values()].sort((a, b) => b.pts - a.pts);
    order.forEach((r, i) => { r.place = i > 0 && order[i - 1].pts === r.pts ? order[i - 1].place : i + 1; });
    this.room.fx('drum');
    this.setTimer(DRUM_MS, () => this.drop());
  }
  scoreHilo(g) {
    const right = this.kind === 'versus' ? g.pick === this.pricier : (this.price > this.hiloPrice) === (g.pick === 'higher');
    const elapsed = Math.max(0, g.at - this.startedAt);
    const speed = right ? Math.round(500 * Math.max(0, 1 - elapsed / this.dur)) : 0;
    const pts = right ? 500 + speed : 0;
    const secs = Math.round(elapsed / 100) / 10;
    return { pick: g.pick, right, speed, secs, pts, math: right ? [{ label: '✅ Right!', val: '500' }, { label: `⚡ Speed bonus (${secs}s)`, val: '+' + speed }] : [{ label: '❌ Wrong way!', val: '0' }] };
  }
  scorePrice(id, g) {
    const r = scoreGuess(g.guess, this.price, { shield: g.shield, level: this.s.difficulty });
    const st = this.stats.get(id);
    const streak = st && r.off <= STREAK_PCT ? st.streak + 1 : 0;
    let pts = r.pts;
    if (streak >= 3) { pts += STREAK_BONUS; r.math.push({ label: `🔥 Hot streak (${streak} in a row)`, val: '+' + STREAK_BONUS }); }
    if (g.double) { pts *= 2; r.math.push({ label: '🎯 Double Down', val: '×2' }); }
    if (this.kind === 'spree' && pts > 0) { pts *= FINAL_MULT; r.math.push({ label: '🏁 Final round', val: '×' + FINAL_MULT }); }
    return { ...r, guess: g.guess, streak, double: !!g.double, shield: !!g.shield, pts };
  }
  drop() {
    if (this.phase !== 'reveal' || this.dropped) return;
    this.dropped = true;
    const priceRound = !this.tap();
    // Streaks: a price round you sat out breaks your streak.
    if (priceRound) for (const [id, st] of this.stats) if (!this.scored.has(id)) st.streak = 0;
    for (const [id, r] of this.scored) {
      this.scores.set(id, (this.scores.get(id) || 0) + r.pts);
      const st = this.stats.get(id); if (!st) continue;
      if (!priceRound) { if (r.right) { st.hiloRight++; st.speedSum = (st.speedSum || 0) + r.speed; } continue; }
      st.n++; st.offSum += r.off; st.ratioSum += r.guess / this.price; st.streak = r.streak;
      if (r.bull) st.bulls++; if (r.bust) st.busts++; st.best = Math.max(st.best, r.pts);
    }
    const all = [...this.scored.values()];
    const gs = all.filter((r) => r.guess != null).map((r) => r.guess);
    const avg = gs.length ? cents(gs.reduce((a, b) => a + b, 0) / gs.length) : null;
    this.summary = {
      avg, avgPct: avg != null ? Math.round((Math.abs(avg - this.price) / this.price) * 1000) / 10 : null, avgOver: avg != null && avg > this.price,
      n: all.length, bulls: all.filter((r) => r.bull).length, exact: all.filter((r) => r.exact).length, busts: all.filter((r) => r.bust).length,
      right: all.filter((r) => r.right).length, higher: all.filter((r) => r.pick === 'higher').length, lower: all.filter((r) => r.pick === 'lower').length,
      left: all.filter((r) => r.pick === 0).length, rightSide: all.filter((r) => r.pick === 1).length,
    };
    this.room.fx('drop');
    if (this.summary.exact) this.room.fx('jackpot');
    else if (this.summary.bulls || (this.tap() && this.summary.right)) this.room.fx('bull');
    else if (this.summary.busts) this.room.fx('bust');
    this.setTimer(this.tap() ? HILO_REVEAL_MS : REVEAL_MS, () => this.nextRound());
  }
  finish() {
    this.room.cancel(this.timer); this.room.cancel(this.halfTimer);
    this.phase = 'over'; this.endsAt = 0; this.awards = this.makeAwards(); this.room.fx('over');
  }
  next() {
    if (this.phase === 'intro') this.openGuess();
    else if (this.phase === 'guess') { this.room.cancel(this.timer); this.close(); }
    else if (this.phase === 'reveal') { if (!this.dropped) this.drop(); else this.nextRound(); }
  }

  act(p, m) {
    this.seat(p);
    if (m.op === 'lock') {
      if (this.phase !== 'guess' || this.tap()) return { ok: false, error: this.tap() && this.phase === 'guess' ? 'Just tap your answer this round!' : 'Guessing is closed.' };
      if (this.guesses.has(p.id)) return { ok: false, error: 'You already locked in.' };
      const g = typeof m.guess === 'number' ? m.guess : typeof m.guess === 'string' && m.guess.trim() !== '' ? Number(m.guess) : NaN;
      if (!Number.isFinite(g) || g < 0) return { ok: false, error: 'Type a price first.' };
      if (g > Math.min(MAX_GUESS, this.sliderMax * 20)) return { ok: false, error: 'Whoa, way too high! Try a smaller number.' };
      const used = this.used.get(p.id), double = m.double === true, shield = m.shield === true;
      if ((double && used.has('double')) || (shield && used.has('shield'))) return { ok: false, error: 'You already used that power-up.' };
      if (double) used.add('double'); if (shield) used.add('shield');
      this.guesses.set(p.id, { guess: cents(g), double, shield, at: this.room.now() });
      if (!p.bot || this.room.now() - this.lastLockFx > 400) { this.room.fx('lock'); this.lastLockFx = this.room.now(); }
      this.maybeAllIn();
      return { ok: true };
    }
    if (m.op === 'peek') {
      if (this.phase !== 'guess' || this.tap()) return { ok: false, error: 'No peeking now.' };
      if (this.guesses.has(p.id)) return { ok: false, error: 'Peek before you lock in.' };
      if (this.used.get(p.id).has('peek')) return { ok: false, error: 'You already used your Peek.' };
      if (this.room.now() - this.startedAt < this.dur / 2) return { ok: false, error: 'Peek unlocks halfway through the timer.' };
      this.used.get(p.id).add('peek'); this.peeks.add(p.id);
      return { ok: true };
    }
    if (m.op === 'hilo') {
      if (this.phase !== 'guess' || this.kind !== 'hilo') return { ok: false, error: 'Not a Higher or Lower round.' };
      if (this.guesses.has(p.id)) return { ok: false, error: 'You already answered.' };
      if (m.pick !== 'higher' && m.pick !== 'lower') return { ok: false, error: 'Higher or lower?' };
      this.guesses.set(p.id, { pick: m.pick, at: this.room.now() });
      if (!p.bot || this.room.now() - this.lastLockFx > 400) { this.room.fx('lock'); this.lastLockFx = this.room.now(); }
      this.maybeAllIn();
      return { ok: true };
    }
    if (m.op === 'versus') {
      if (this.phase !== 'guess' || this.kind !== 'versus') return { ok: false, error: 'Not a Which Costs More round.' };
      if (this.guesses.has(p.id)) return { ok: false, error: 'You already answered.' };
      if (m.pick !== 0 && m.pick !== 1) return { ok: false, error: 'Tap one of the two items.' };
      this.guesses.set(p.id, { pick: m.pick, at: this.room.now() });
      if (!p.bot || this.room.now() - this.lastLockFx > 400) { this.room.fx('lock'); this.lastLockFx = this.room.now(); }
      this.maybeAllIn();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }
  botPlay(p) {
    if (this.phase !== 'guess' || this.guesses.has(p.id) || !this.room.get(p.id)) return;
    const r = this.room.rng;
    if (this.kind === 'versus') { this.act(p, { op: 'versus', pick: r() < 0.65 ? this.pricier : 1 - this.pricier }); return; }
    if (this.kind === 'hilo') { const right = r() < 0.65, up = this.price > this.hiloPrice; this.act(p, { op: 'hilo', pick: up === right ? 'higher' : 'lower' }); return; }
    let g = this.price * (0.5 + r() * 1.1);
    g = g < 100 ? cents(g) : Math.round(g);
    const used = this.used.get(p.id) || new Set();
    this.act(p, { op: 'lock', guess: g, double: !used.has('double') && r() < 0.15, shield: !used.has('shield') && r() < 0.15 });
  }

  makeAwards() {
    const rows = [...this.stats].filter(([id, st]) => this.room.get(id) && st.n > 0).map(([id, st]) => ({ id, name: this.room.name(id), ...st, avgOff: st.offSum / st.n, avgRatio: st.ratioSum / st.n }));
    if (!rows.length) return [];
    const pick = (cmp) => rows.slice().sort(cmp)[0];
    const out = [];
    const bh = pick((a, b) => b.bulls - a.bulls || a.avgOff - b.avgOff);
    if (bh.bulls > 0) out.push({ icon: '🏷️', title: 'Bargain Hunter', name: bh.name, id: bh.id, why: `${bh.bulls} bullseye${bh.bulls === 1 ? '' : 's'}` });
    const big = pick((a, b) => b.avgRatio - a.avgRatio);
    out.push({ icon: '💸', title: 'Big Spender', name: big.name, id: big.id, why: `guessed ${Math.round(big.avgRatio * 100)}% of the price on average` });
    const pp = pick((a, b) => a.busts - b.busts || a.avgRatio - b.avgRatio);
    out.push({ icon: '🪙', title: 'Penny Pincher', name: pp.name, id: pp.id, why: pp.busts ? `only ${pp.busts} bust${pp.busts === 1 ? '' : 's'}, lowball king` : 'never went over!' });
    const hb = pick((a, b) => a.avgOff - b.avgOff);
    out.push({ icon: '📟', title: 'Human Barcode', name: hb.name, id: hb.id, why: `only ${Math.round(hb.avgOff * 1000) / 10}% off on average` });
    const qd = [...this.stats].filter(([id, st]) => this.room.get(id) && st.hiloRight > 0).sort((a, b) => b[1].hiloRight - a[1].hiloRight || (b[1].speedSum || 0) - (a[1].speedSum || 0))[0];
    if (qd) out.push({ icon: '⚡', title: 'Quick Draw', name: this.room.name(qd[0]), id: qd[0], why: `${qd[1].hiloRight} quick-tap round${qd[1].hiloRight === 1 ? '' : 's'} right` });
    return out;
  }

  standings() { return [...this.scores].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), avatar: this.room.get(id).avatar || null, points: pts })).sort((a, b) => b.points - a.points); }
  // Player ids best-first once the game is over (for the party scoreboard across games).
  results() { return this.phase === 'over' ? this.standings().map((x) => x.id) : []; }
  publicItems() { return this.items.map((i) => ({ emoji: i.emoji, name: i.name, desc: i.desc, cat: CAT[i.cat].label, catIcon: CAT[i.cat].icon, price: this.dropped ? i.price : null })); }
  shown() { return this.phase === 'reveal' && this.dropped; } // the real price is public from here on
  axis() { // the TV's price line: sized from the guesses (never from the hidden price)
    let top = this.sliderMax * 0.5;
    for (const g of this.guesses.values()) if (g.guess != null) top = Math.max(top, Math.min(g.guess, this.sliderMax));
    return niceUp(top * 1.1);
  }
  waitingNames() { const w = this.online().filter((p) => !this.guesses.has(p.id)); return w.length && w.length <= Math.min(3, this.online().length - 1) ? w.map((p) => p.name) : null; }
  endsIn() { return this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0; }
  peekInfo(excludeId) {
    const gs = [...this.guesses].filter(([id, g]) => id !== excludeId && g.guess != null).map(([, g]) => g.guess);
    return { avg: gs.length ? cents(gs.reduce((a, b) => a + b, 0) / gs.length) : null, n: gs.length };
  }

  tv() {
    const players = this.room.list(), shown = this.shown();
    const s = {
      phase: this.phase, kind: this.kind, round: this.round, rounds: this.rounds(), endsIn: this.endsIn(),
      items: this.publicItems(), hiloPrice: this.hiloPrice, sliderMax: this.sliderMax, price: shown ? this.price : null, dropped: shown,
      locked: this.guesses.size, total: players.length, standings: this.standings().slice(0, 12), final: this.round === this.rounds(), mult: FINAL_MULT,
      lockers: players.slice(0, 40).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar || null, color: p.color, in: this.guesses.has(p.id) })),
      // the last few we are waiting on, by name (any room size)
      waiting: this.phase === 'guess' ? this.waitingNames() : null,
      note: 'Prices are rough US averages, 2026',
    };
    if (this.phase === 'reveal') {
      s.axis = this.axis();
      s.marks = players.filter((p) => this.guesses.has(p.id)).map((p) => {
        const g = this.guesses.get(p.id), r = this.scored.get(p.id);
        const m = { id: p.id, name: p.name, avatar: p.avatar || null, color: p.color, guess: g.guess != null ? g.guess : null, pick: g.pick != null ? g.pick : null };
        if (shown && r) Object.assign(m, { pts: r.pts, bust: !!r.bust, bull: !!r.bull, exact: !!r.exact, right: !!r.right, double: !!r.double, shield: !!r.shield, pct: r.pct, math: r.math });
        return m;
      });
      if (shown) {
        const ranked = s.marks.slice().sort((a, b) => b.pts - a.pts);
        s.top = ranked.slice(0, 3).map((m) => m.id);
        s.summary = this.summary;
      }
    }
    if (this.phase === 'over') s.awards = this.awards;
    return s;
  }
  view(p) {
    const st = this.standings(), mine = this.guesses.get(p.id), used = this.used.get(p.id) || new Set(), shown = this.shown();
    const v = {
      phase: this.phase, kind: this.kind, round: this.round, rounds: this.rounds(), endsIn: this.endsIn(),
      items: this.publicItems(), hiloPrice: this.hiloPrice, sliderMax: this.sliderMax, price: shown ? this.price : null, dropped: shown,
      mine: mine || null, used: POWERS.filter((k) => used.has(k)),
      final: this.round === this.rounds(), mult: FINAL_MULT,
      peekReady: this.phase === 'guess' && !this.tap() && this.room.now() - this.startedAt >= this.dur / 2,
      peek: this.peeks.has(p.id) && this.phase === 'guess' ? this.peekInfo(p.id) : null,
      placed: shown ? this.scored.size : 0, summary: shown ? { avg: this.summary.avg, avgPct: this.summary.avgPct } : null,
      streak: (this.stats.get(p.id) || {}).streak || 0,
      result: shown ? this.scored.get(p.id) || null : null,
      points: this.scores.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length,
    };
    if (this.phase === 'over') { v.final = st.slice(0, 10); v.awards = (this.awards || []).filter((a) => a.id === p.id); }
    return v;
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ minutes: M }) => {
  const seconds = M <= 7 ? 20 : 30;
  const { rounds } = PF.best({ rounds: [10, 6, 15] }, (s) => 1 + s.rounds * (seconds + 54) / 60, M);
  return { rounds, seconds };
};

module.exports = {
  partyFit,
  key: 'price', name: 'Price Panic', min: 1, best: [2, 20], howSteps: 6, fields, defaults, show: true, // game-show opening (box/show.js)
  create: (room, settings) => new Price(room, settings),
  scoreGuess, niceUp, fmt,
};
