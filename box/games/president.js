'use strict';
// President: be first to empty your hand. Play singles, pairs, triples or four of a kind;
// each play must beat the last with the same number of cards. 3 is lowest, then … K, A, 2.
// Finishing order gives titles (President, Vice President, Citizens, Vice Scum, Scum), and
// at the next deal the Scum must hand their best cards to the President.
// Big groups play at several tables; Presidents move up a table, Scums move down.
// House rules (each can be turned off): a 2 clears the pile at once, four of a kind starts a
// Revolution (ranks flip until the next deal), and the last round scores double.
// Nobody waits on a player who can't beat the pile: they pass automatically.
const C = require('../cards');
const GEARS = require('../../public/shared/gear'); // JustGold per-game gear (card backs)

const power = (card) => (C.rankIndex(card) + 11) % 13; // 3 → 0 … K → 10, A → 11, 2 → 12
const sortHand = (h) => h.sort((a, b) => power(a) - power(b) || C.SUITS.indexOf(C.suitOf(a)) - C.SUITS.indexOf(C.suitOf(b)));
const TITLE = { president: 'President', vp: 'Vice President', citizen: 'Citizen', vscum: 'Vice Scum', scum: 'Scum' };
const POINTS = { president: 4, vp: 3, citizen: 2, vscum: 1, scum: 0 };
const onOff = [{ value: true, label: 'On' }, { value: false, label: 'Off' }];

const fields = [
  { key: 'rounds', label: 'Rounds', options: [3, 4, 6, 8].map((v) => ({ value: v, label: `${v} rounds` })) },
  { key: 'tableSize', label: 'Players per table', options: [4, 5, 6, 7, 8].map((v) => ({ value: v, label: `Up to ${v}` })) },
  { key: 'turnSeconds', label: 'Turn timer', options: [15, 25, 40].map((v) => ({ value: v, label: `${v} seconds` })) },
  { key: 'trading', label: 'Card trading (Scum gives best cards)', type: 'bool', options: onOff },
  { key: 'promotion', label: 'Move up / down tables', type: 'bool', options: onOff },
  { key: 'twos', label: 'A 2 clears the pile', type: 'bool', options: onOff },
  { key: 'revolution', label: 'Revolution (four of a kind flips the ranks)', type: 'bool', options: onOff },
  { key: 'finalDouble', label: 'Last round scores double', type: 'bool', options: onOff },
];
const defaults = { rounds: 4, tableSize: 6, turnSeconds: 25, trading: true, promotion: true, twos: true, revolution: true, finalDouble: true };
const TRADE_SECONDS = 20, BREAK_SECONDS = 12, STUCK_MS = 1600, IDLE_SECONDS = 6;
const on = (v) => v !== false && v !== 'false';

function titlesFor(n) { // by finishing place
  const t = Array(n).fill('citizen');
  t[0] = 'president'; t[n - 1] = 'scum';
  if (n >= 4) { t[1] = 'vp'; t[n - 2] = 'vscum'; }
  return t;
}

class President {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.round = 0; this.phase = 'deal';
    this.tables = []; this.points = new Map(); this.titles = new Map(); this.waiting = [];
    this.endsAt = 0; this.timer = null; this.order = null;
    this.stats = new Map(); this.idle = new Map(); this.recap = null; this.awards = [];
  }
  stat(id) {
    if (!this.stats.has(id)) this.stats.set(id, { titles: [], revs: 0, burns: 0, plays: 0, cards: 0, firstOut: 0 });
    return this.stats.get(id);
  }
  start() { for (const p of this.room.list()) { this.points.set(p.id, 0); this.stat(p.id); } this.newRound(); }
  joined(p) { if (!this.points.has(p.id)) this.points.set(p.id, 0); this.stat(p.id); if (this.phase !== 'over') this.waiting.push(p.id); }
  left(p) {
    this.waiting = this.waiting.filter((id) => id !== p.id);
    for (const t of this.tables) {
      if (!t.seats.includes(p.id) || t.done) continue;
      // Their cards leave with them; they count as last at that table.
      delete t.hands[p.id];
      t.gone.push(p.id);
      if (t.turn === p.id) this.advance(t);
      this.checkTableDone(t);
    }
  }
  finalRound() { return on(this.s.finalDouble) && this.s.rounds > 1 && this.round >= this.s.rounds; }

  // ---- seating ----
  seatAll() {
    const ids = this.room.list().map((p) => p.id);
    let ordered;
    if (!this.tables.length) ordered = C.shuffle(ids.slice(), this.room.rng);
    else {
      // Keep each table together; Presidents move up a table and Scums move down.
      const groups = this.tables.map((t) => t.finish.slice());
      if (on(this.s.promotion)) for (let k = 1; k < groups.length; k++) {
        const up = groups[k][0], down = groups[k - 1][groups[k - 1].length - 1];
        if (up && down) { groups[k][0] = down; groups[k - 1][groups[k - 1].length - 1] = up; }
      }
      ordered = groups.flat().filter((id) => ids.includes(id));
      for (const id of ids) if (!ordered.includes(id)) ordered.push(id); // newcomers start at the bottom table
    }
    this.waiting = [];
    const n = ordered.length, size = this.s.tableSize;
    const count = Math.max(1, Math.min(Math.ceil(n / size), Math.floor(n / 3) || 1));
    const tables = [];
    let at = 0;
    for (let k = 0; k < count; k++) { const len = Math.floor(n / count) + (k < n % count ? 1 : 0); tables.push(ordered.slice(at, at + len)); at += len; }
    return tables;
  }

  newRound() {
    this.round++; this.phase = 'trade'; this.recap = null;
    const seating = this.seatAll();
    this.tables = seating.map((seats, i) => this.deal(i, seats));
    const anyTrade = this.tables.some((t) => t.trades.length);
    this.room.fx('shuffle');
    if (this.finalRound()) this.room.fx('final');
    if (anyTrade) { this.endsAt = this.room.now() + TRADE_SECONDS * 1000; this.room.cancel(this.timer); this.timer = this.room.after(TRADE_SECONDS * 1000, () => this.finishTrades()); for (const t of this.tables) for (const tr of t.trades) if (this.room.get(tr.from) && this.room.get(tr.from).bot) this.room.after(800 + this.room.rng() * 2000, () => this.autoGive(t, tr)); }
    else this.beginPlay();
  }
  deal(i, seats) {
    const deck = C.shuffle(C.deck(), this.room.rng), hands = {};
    for (const id of seats) hands[id] = [];
    deck.forEach((c, k) => hands[seats[k % seats.length]].push(c));
    for (const id of seats) sortHand(hands[id]);
    const t = { id: i, seats, hands, pile: [], top: null, passed: [], turn: null, lastBy: null, finish: [], gone: [], done: false, trades: [], deadline: 0, timer: null, log: [], rev: false, seq: 0, plays: 0, stuck: false, burn: null };
    // Trading: rank this table's players by last round (titles), best to worst.
    if (this.round > 1 && on(this.s.trading) && seats.length >= 3) {
      const prev = (id) => (this.titles.has(id) ? POINTS[this.titles.get(id)] : 2);
      const ranked = seats.slice().sort((a, b) => prev(b) - prev(a) || (this.points.get(b) || 0) - (this.points.get(a) || 0));
      const pairs = [[ranked[0], ranked[ranked.length - 1], 2]];
      if (seats.length >= 4) pairs.push([ranked[1], ranked[ranked.length - 2], 1]);
      for (const [top, bottom, n] of pairs) {
        // The bottom player's best cards go up automatically …
        const best = hands[bottom].slice(-n);
        hands[bottom] = hands[bottom].slice(0, -n); hands[top].push(...best); sortHand(hands[top]);
        // … and the top player chooses which cards to give back.
        t.trades.push({ from: top, to: bottom, n, got: best.map(C.base), given: null });
      }
      t.leader = ranked[ranked.length - 1]; // the Scum leads
    }
    return t;
  }
  give(t, tr, cards) {
    const hand = t.hands[tr.from];
    for (const c of cards) hand.splice(hand.indexOf(c), 1);
    t.hands[tr.to].push(...cards); sortHand(t.hands[tr.to]);
    tr.given = cards.map(C.base);
    this.room.fx('give', { table: t.id });
  }
  autoGive(t, tr) { if (this.phase === 'trade' && !tr.given && t.hands[tr.from]) { this.give(t, tr, t.hands[tr.from].slice(0, tr.n)); this.maybeTradesDone(); } }
  maybeTradesDone() { if (this.tables.every((t) => t.trades.every((tr) => tr.given))) this.finishTrades(); }
  finishTrades() {
    if (this.phase !== 'trade') return;
    for (const t of this.tables) for (const tr of t.trades) if (!tr.given && t.hands[tr.from]) this.give(t, tr, t.hands[tr.from].slice(0, tr.n));
    this.beginPlay();
  }
  beginPlay() {
    this.phase = 'play'; this.endsAt = 0; this.room.cancel(this.timer);
    for (const t of this.tables) {
      let lead = t.leader;
      if (!lead || !t.hands[lead]) lead = t.seats.find((id) => t.hands[id].some((c) => C.base(c) === '3C')) || t.seats[0];
      this.setTurn(t, lead);
    }
    this.room.fx('deal', { n: 5 });
  }

  // ---- rules ----
  // Effective strength at this table: a Revolution flips the order (3 becomes the best card).
  eff(t, card) { return t.rev ? 12 - power(card) : power(card); }
  groups(t, hand) {
    const g = {};
    for (const c of hand) (g[C.rankOf(c)] = g[C.rankOf(c)] || []).push(c);
    return Object.values(g).sort((a, b) => this.eff(t, a[0]) - this.eff(t, b[0]));
  }
  canBeat(t, id) {
    const hand = t.hands[id]; if (!hand || !hand.length) return false;
    if (!t.top) return true;
    const need = t.top.cards.length, beat = this.eff(t, t.top.cards[0]);
    return this.groups(t, hand).some((g) => g.length >= need && this.eff(t, g[0]) > beat);
  }

  // ---- play ----
  active(t, id) { return !!t.hands[id] && t.hands[id].length > 0 && !t.finish.includes(id); }
  setTurn(t, id) {
    this.room.cancel(t.timer);
    const seq = ++t.seq;
    // Someone whose phone went quiet (two timeouts in a row) gets a short clock until they're back.
    const secs = (this.idle.get(id) || 0) >= 2 ? Math.min(IDLE_SECONDS, this.s.turnSeconds) : this.s.turnSeconds;
    t.turn = id; t.deadline = this.room.now() + secs * 1000;
    t.timer = this.room.after(secs * 1000, () => this.timeout(t));
    // Can't beat the pile? Pass for them after a moment, so nobody waits on a forced pass.
    t.stuck = !!t.top && !this.canBeat(t, id);
    if (t.stuck) { this.room.after(STUCK_MS, () => { if (t.seq === seq && t.turn === id && !t.done && this.phase === 'play') this.doPass(t, id, true); }); return; }
    const p = this.room.get(id);
    if (p && p.bot) this.room.after(700 + this.room.rng() * 1500, () => { if (t.seq === seq && t.turn === id && !t.done && this.phase === 'play') this.botTurn(t, id); });
  }
  timeout(t) {
    if (t.done || this.phase !== 'play') return;
    const id = t.turn, hand = t.hands[id];
    if (!this.room.get(id) || !this.room.get(id).bot) this.idle.set(id, (this.idle.get(id) || 0) + 1);
    if (!t.top && hand && hand.length) this.doPlay(t, id, [this.groups(t, hand)[0][0]]); // the leader must play: the weakest card
    else this.doPass(t, id);
  }
  validate(t, id, cards) {
    if (this.phase !== 'play' || t.done) return 'Not now.';
    if (t.turn !== id) return 'It’s not your turn.';
    const hand = t.hands[id];
    if (!cards.length || cards.length > 4) return 'Play 1 to 4 cards.';
    if (new Set(cards).size !== cards.length || !cards.every((c) => hand.includes(c))) return 'Those aren’t your cards.';
    const r = C.rankOf(cards[0]);
    if (!cards.every((c) => C.rankOf(c) === r)) return 'All cards must be the same rank.';
    if (t.top) {
      if (cards.length !== t.top.cards.length) return `Play exactly ${t.top.cards.length} card${t.top.cards.length > 1 ? 's' : ''}.`;
      if (this.eff(t, cards[0]) <= this.eff(t, t.top.cards[0])) return t.rev ? 'Revolution! You must play LOWER than the cards on the table.' : 'You must play higher than the cards on the table.';
    }
    return null;
  }
  doPlay(t, id, cards) {
    const hand = t.hands[id], st = this.stat(id);
    for (const c of cards) hand.splice(hand.indexOf(c), 1);
    t.top = { by: id, cards: cards.slice() }; t.lastBy = id; t.pile.push(...cards); t.plays++;
    st.plays++; st.cards += cards.length;
    t.log.unshift({ by: id, cards: cards.map(C.base) }); t.log.length = Math.min(t.log.length, 6);
    const revolt = on(this.s.revolution) && cards.length === 4;
    if (revolt) { t.rev = !t.rev; st.revs++; this.room.fx('revolution', { table: t.id, name: this.room.name(id), rev: t.rev }); }
    const burns = !revolt && on(this.s.twos) && this.eff(t, cards[0]) === 12;
    if (!revolt) this.room.fx(burns ? 'burn' : this.eff(t, cards[0]) >= 11 ? 'big' : 'card', { table: t.id });
    if (!hand.length) { t.finish.push(id); if (t.finish.length === 1) st.firstOut++; this.room.fx('out', { table: t.id, name: this.room.name(id), place: t.finish.length }); }
    if (this.checkTableDone(t)) return;
    if (burns) { st.burns++; t.burn = { name: this.room.name(id), at: t.plays }; t.log.unshift({ by: id, burn: true }); t.log.length = Math.min(t.log.length, 6); return this.clearTrick(t); }
    this.advance(t);
  }
  doPass(t, id, auto = false) {
    if (!t.top) return; // the leader can't pass
    t.passed.push(id);
    t.log.unshift({ by: id, pass: true, auto }); t.log.length = Math.min(t.log.length, 6);
    this.advance(t);
  }
  // Next player who can still answer; if nobody can, the trick clears and the last player to play leads.
  advance(t) {
    if (t.done) return;
    const n = t.seats.length, from = t.seats.indexOf(t.turn);
    for (let k = 1; k <= n; k++) {
      const id = t.seats[(from + k) % n];
      if (id === t.lastBy) break;
      if (this.active(t, id) && !t.passed.includes(id)) return this.setTurn(t, id);
    }
    this.clearTrick(t);
  }
  clearTrick(t) {
    const n = t.seats.length;
    t.top = null; t.passed = []; t.pile = [];
    this.room.fx('clear', { table: t.id });
    let lead = t.lastBy;
    if (!this.active(t, lead)) { const i = t.seats.indexOf(lead); for (let k = 1; k <= n; k++) { const id = t.seats[(i + k) % n]; if (this.active(t, id)) { lead = id; break; } } }
    t.lastBy = null;
    this.setTurn(t, lead);
  }
  checkTableDone(t) {
    const left = t.seats.filter((id) => this.active(t, id));
    if (left.length > 1) return false;
    t.finish.push(...left); t.finish.push(...t.gone.filter((id) => !t.finish.includes(id)));
    t.done = true; t.turn = null; t.stuck = false; this.room.cancel(t.timer);
    const titles = titlesFor(t.finish.length), bonus = this.tables.length > 1 && t.id === 0 ? 1 : 0, mult = this.finalRound() ? 2 : 1;
    t.earned = {};
    t.finish.forEach((id, i) => {
      const pts = (POINTS[titles[i]] + bonus) * mult;
      this.titles.set(id, titles[i]); this.points.set(id, (this.points.get(id) || 0) + pts); t.earned[id] = pts;
      this.stat(id).titles.push(titles[i]);
    });
    this.room.fx('tableDone', { table: t.id });
    if (this.tables.every((x) => x.done)) this.roundOver();
    return true;
  }
  roundOver() {
    // What happened this round, for the TV's recap between rounds.
    const multi = this.tables.length > 1 && on(this.s.promotion);
    this.recap = this.tables.map((t) => ({
      table: t.id,
      finish: t.finish.map((id) => ({ id, name: this.room.name(id), title: this.titles.get(id), pts: t.earned[id] || 0 })),
      up: multi && t.id > 0 ? this.room.name(t.finish[0]) : null,
      down: multi && t.id < this.tables.length - 1 ? this.room.name(t.finish[t.finish.length - 1]) : null,
    }));
    if (this.round >= this.s.rounds) { this.phase = 'over'; this.endsAt = 0; this.awards = this.makeAwards(); this.room.fx('win'); return; }
    this.phase = 'break'; this.endsAt = this.room.now() + BREAK_SECONDS * 1000;
    this.room.fx('roundOver');
    this.room.cancel(this.timer); this.timer = this.room.after(BREAK_SECONDS * 1000, () => this.newRound());
  }
  next() { if (this.phase === 'break') { this.room.cancel(this.timer); this.newRound(); } else if (this.phase === 'trade') this.finishTrades(); }

  act(p, m) {
    const t = this.tables.find((x) => x.seats.includes(p.id));
    if (!t) return { ok: false, error: this.phase === 'over' ? 'The game is over.' : 'You’ll be dealt in next round.' };
    if (m.op === 'give') {
      const tr = t.trades.find((x) => x.from === p.id && !x.given);
      if (this.phase !== 'trade' || !tr) return { ok: false, error: 'Nothing to give.' };
      const hand = t.hands[p.id] || [];
      const cards = Array.isArray(m.cards) ? m.cards.map((b) => (typeof b === 'string' ? hand.find((c) => C.base(c) === b) : null)) : [];
      if (cards.length !== tr.n || cards.some((c) => !c) || new Set(cards).size !== cards.length) return { ok: false, error: `Pick ${tr.n} card${tr.n > 1 ? 's' : ''} to give.` };
      this.give(t, tr, cards); this.maybeTradesDone();
      return { ok: true };
    }
    if (m.op === 'pass') {
      if (this.phase !== 'play' || t.turn !== p.id) return { ok: false, error: 'It’s not your turn.' };
      if (!t.top) return { ok: false, error: 'You’re leading: play any card or set.' };
      this.idle.delete(p.id);
      this.doPass(t, p.id); return { ok: true };
    }
    if (m.op === 'play') {
      const hand = t.hands[p.id] || [];
      if (!Array.isArray(m.cards) || m.cards.length > 4) return { ok: false, error: 'Play 1 to 4 cards.' };
      const cards = m.cards.map((b) => (typeof b === 'string' ? hand.find((c) => C.base(c) === b) : null)).filter(Boolean);
      if (cards.length !== m.cards.length) return { ok: false, error: 'Those aren’t your cards.' };
      const err = this.validate(t, p.id, cards); if (err) return { ok: false, error: err };
      this.idle.delete(p.id);
      this.doPlay(t, p.id, cards); return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }

  // ---- bots ----
  botTurn(t, id) {
    const hand = t.hands[id];
    const sets = this.groups(t, hand);
    if (!t.top) return this.doPlay(t, id, sets[0]); // lead the weakest set
    const need = t.top.cards.length, beat = this.eff(t, t.top.cards[0]);
    const exact = sets.find((g) => g.length === need && this.eff(t, g[0]) > beat);
    const any = sets.find((g) => g.length >= need && this.eff(t, g[0]) > beat);
    const pick = exact || any;
    if (!pick) return this.doPass(t, id);
    // Save the strongest cards while the hand is still big.
    if (this.eff(t, pick[0]) >= 11 && hand.length > 6 && this.room.rng() < 0.6) return this.doPass(t, id);
    this.doPlay(t, id, pick.slice(0, need));
  }

  // ---- the end ----
  makeAwards() {
    const rows = [...this.stats].filter(([id]) => this.room.get(id)).map(([id, s]) => {
      const T = s.titles, pres = T.filter((x) => x === 'president').length, scum = T.filter((x) => x === 'scum').length;
      let climb = 0; // biggest jump from one round to the next (Scum → President = 4)
      for (let i = 1; i < T.length; i++) climb = Math.max(climb, POINTS[T[i]] - POINTS[T[i - 1]]);
      return { id, name: this.room.name(id), pres, scum, climb, revs: s.revs, burns: s.burns, firstOut: s.firstOut };
    });
    const best = (key, min = 1) => { const r = rows.slice().sort((a, b) => b[key] - a[key])[0]; return r && r[key] >= min ? r : null; };
    const out = [];
    let r;
    if ((r = best('pres'))) out.push({ icon: '👑', title: 'Head of State', id: r.id, name: r.name, why: `President ${r.pres} time${r.pres === 1 ? '' : 's'}` });
    if ((r = best('climb', 3))) out.push({ icon: '🚀', title: 'Rags to Riches', id: r.id, name: r.name, why: 'went from the bottom to the top in one round' });
    if ((r = best('revs'))) out.push({ icon: '✊', title: 'Revolutionary', id: r.id, name: r.name, why: `started ${r.revs} revolution${r.revs === 1 ? '' : 's'}` });
    if ((r = best('burns', 2))) out.push({ icon: '🔥', title: 'Pile Burner', id: r.id, name: r.name, why: `cleared the pile with a 2 ${r.burns} times` });
    if ((r = best('scum', 2))) out.push({ icon: '🧹', title: 'Salt of the Earth', id: r.id, name: r.name, why: `Scum ${r.scum} times and still smiling` });
    return out;
  }
  results() { return this.standings().map((r) => r.id); }

  // ---- views ----
  avatar(id) { const p = this.room.get(id); return (p && p.avatar) || null; }
  standings() { return this.room.list().map((p) => ({ id: p.id, name: p.name, av: p.avatar || null, points: this.points.get(p.id) || 0, title: this.titles.get(p.id) || null })).sort((a, b) => b.points - a.points || POINTS[b.title || 'citizen'] - POINTS[a.title || 'citizen']); }
  tableView(t) {
    return {
      id: t.id, done: t.done, turn: t.turn, turnName: t.turn ? this.room.name(t.turn) : null, endsIn: t.turn ? Math.max(0, t.deadline - this.room.now()) : 0,
      rev: t.rev, stuck: t.stuck, plays: t.plays, burn: t.burn && t.burn.at === t.plays ? t.burn.name : null,
      top: t.top ? { by: t.top.by, name: this.room.name(t.top.by), cards: t.top.cards.map(C.base) } : null,
      // The cards already beaten this trick (just under the top set), so the TV can draw a pile.
      under: t.top ? t.pile.slice(Math.max(0, t.pile.length - t.top.cards.length - 6), t.pile.length - t.top.cards.length).map(C.base) : [],
      seats: t.seats.map((id) => ({ id, name: this.room.name(id), av: this.avatar(id), color: (this.room.get(id) || {}).color, cards: (t.hands[id] || []).length, passed: t.passed.includes(id), place: t.finish.indexOf(id) + 1 || null, title: this.titles.get(id) || null, gone: !this.room.get(id), idle: (this.idle.get(id) || 0) >= 2,
        gear: GEARS.gearSet(this.room.get(id), 'president') })), // { cardBack } (shop gear; 'classic' = the red velvet back)
      log: t.log.map((l) => ({ name: this.room.name(l.by), cards: l.cards || null, pass: !!l.pass, auto: !!l.auto, burn: !!l.burn })),
      trades: t.trades.map((tr) => ({ from: this.room.name(tr.from), to: this.room.name(tr.to), n: tr.n, done: !!tr.given })),
    };
  }
  rules() { return { twos: on(this.s.twos), revolution: on(this.s.revolution), trading: on(this.s.trading) }; }
  tv() {
    return {
      phase: this.phase, round: this.round, rounds: this.s.rounds, final: this.finalRound(), endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      tables: this.tables.map((t) => this.tableView(t)), standings: this.standings().slice(0, 12), players: this.room.list().length, titleNames: TITLE,
      waiting: this.waiting.map((id) => this.room.name(id)), recap: this.recap, rules: this.rules(),
      awards: this.phase === 'over' ? this.awards : null,
    };
  }
  view(p) {
    const t = this.tables.find((x) => x.seats.includes(p.id));
    const st = this.standings();
    const base = { phase: this.phase, round: this.round, rounds: this.s.rounds, final: this.finalRound(), endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, points: this.points.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length, title: this.titles.get(p.id) || null, titleNames: TITLE, rules: this.rules(), final10: this.phase === 'over' ? st.slice(0, 10) : null, awards: this.phase === 'over' ? this.awards.filter((a) => a.id === p.id) : null };
    base.final = base.final && this.phase !== 'over';
    if (!t) return { ...base, waiting: true };
    const tr = t.trades.find((x) => x.from === p.id), got = t.trades.find((x) => x.to === p.id);
    const myTurn = t.turn === p.id && this.phase === 'play';
    return {
      ...base, table: this.tableView(t), tableNo: t.id + 1, tables: this.tables.length,
      hand: (t.hands[p.id] || []).map(C.base), myTurn, leading: !t.top, stuck: myTurn && t.stuck, place: t.finish.indexOf(p.id) + 1 || null,
      earned: t.done && t.earned ? t.earned[p.id] || 0 : null,
      give: tr && !tr.given && this.phase === 'trade' ? { n: tr.n, to: this.room.name(tr.to), got: tr.got } : null,
      gave: got ? { from: this.room.name(got.from), n: got.n, cards: got.got, back: got.given } : null,
      gaveDone: tr && tr.given ? { to: this.room.name(tr.to), cards: tr.given } : null,
    };
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ players: P, minutes: M }) => {
  // Short slots: quicker turns. Tables: one table for a small group, else the size that leaves the fewest empty seats.
  const turnSeconds = M <= 7 ? 15 : 25;
  const tableSize = P <= 8 ? Math.max(4, P) : [6, 7, 5, 8].reduce((b, t) => (Math.ceil(P / t) * t - P < Math.ceil(P / b) * b - P ? t : b));
  const { rounds } = PF.best({ rounds: [4, 3, 6, 8] }, (s) => 1 + s.rounds * (turnSeconds === 15 ? 4 : 5.2), M);
  return { rounds, turnSeconds, tableSize };
};

module.exports = {
  partyFit,
  key: 'president', name: 'President', min: 3, best: [4, 10], howSteps: 6, fields, defaults,
  create: (room, settings) => new President(room, settings),
  _test: { power, titlesFor, POINTS },
};
