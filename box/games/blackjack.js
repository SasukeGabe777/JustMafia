'use strict';
// Blackjack Night: the whole room plays against one dealer on the big screen, all at the
// same time (no waiting for 99 other turns). Chips decide the winner after the last hand.
// Side game, "Bust Bets": put chips on another player going bust this hand.
const C = require('../cards');

const MIN_BET = 10, BUST_STAKE = 25, BUST_PAYS = 75, COMEBACK = 100;
const value = (card) => { const r = C.rankOf(card); return r === 'A' ? 11 : ['J', 'Q', 'K'].includes(r) ? 10 : Number(r); };
function total(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += value(c); if (C.rankOf(c) === 'A') aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { t, soft: aces > 0 };
}
const isBJ = (cards, split) => !split && cards.length === 2 && total(cards).t === 21;

const fields = [
  { key: 'hands', label: 'Hands', options: [5, 8, 12, 20].map((v) => ({ value: v, label: `${v} hands` })) },
  { key: 'startChips', label: 'Starting chips', options: [500, 1000, 2500].map((v) => ({ value: v, label: `${v} chips` })) },
  { key: 'actSeconds', label: 'Time to play a hand', options: [15, 25, 40].map((v) => ({ value: v, label: `${v} seconds` })) },
  { key: 'bustBets', label: 'Bust Bets (bet on a friend busting)', type: 'bool', options: [{ value: true, label: 'On' }, { value: false, label: 'Off' }] },
];
const defaults = { hands: 8, startChips: 1000, actSeconds: 25, bustBets: true };
const BET_SECONDS = 20, RESULT_SECONDS = 7, DEALER_STEP = 900;

class Blackjack {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.round = 0; this.phase = 'betting';
    this.seats = new Map(); // id → { chips, bet, hands, bust, rebuys, best }
    this.dealer = { cards: [], hidden: true };
    this.shoe = []; this.endsAt = 0; this.timer = null; this.last = null;
  }
  seat(p) {
    if (!this.seats.has(p.id)) this.seats.set(p.id, { chips: this.s.startChips, bet: 0, hands: [], bust: null, rebuys: 0, wins: 0, bjs: 0 });
    return this.seats.get(p.id);
  }
  start() { for (const p of this.room.list()) this.seat(p); this.betting(); }
  joined(p) { this.seat(p); }
  left(p) { const s = this.seats.get(p.id); if (s && this.phase === 'playing') for (const h of s.hands) h.done = true; this.checkAllDone(); }

  // ---- phases ----
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  betting() {
    this.round++; this.phase = 'betting'; this.dealer = { cards: [], hidden: true }; this.last = null;
    for (const [id, s] of this.seats) {
      s.bet = 0; s.hands = []; s.bust = null; s.result = null;
      if (s.chips < MIN_BET && this.room.get(id)) { s.chips += COMEBACK; s.rebuys++; } // nobody sits out the party for long
    }
    this.room.fx('shuffle');
    this.setTimer(BET_SECONDS * 1000, () => this.deal());
    for (const p of this.room.list()) if (p.bot) this.room.after(400 + this.room.rng() * 2500, () => this.botBet(p));
  }
  draw() {
    if (!this.shoe.length) this.shoe = C.shuffle(C.deck(Math.max(6, Math.ceil(this.seats.size * 7 / 52) + 1)), this.room.rng);
    return this.shoe.pop();
  }
  deal() {
    const playing = [...this.seats].filter(([id, s]) => s.bet > 0 && this.room.get(id));
    if (!playing.length) { this.phase = 'results'; this.last = { note: 'Nobody bet this hand.' }; return this.setTimer(3000, () => this.afterResults()); }
    // A fresh shoe when it runs low (sized for the room: 100 players need a big shoe).
    if (this.shoe.length < playing.length * 6 + 20) this.shoe = C.shuffle(C.deck(Math.max(6, Math.ceil((playing.length * 6 + 20) / 52) + 1)), this.room.rng);
    this.phase = 'playing';
    for (const [, s] of playing) { s.chips -= s.bet; s.hands = [{ cards: [this.draw(), this.draw()], bet: s.bet, done: false, split: false }]; }
    // Bust Bets are paid up front and only stand if the target is actually playing.
    for (const [, s] of playing) if (s.bust) {
      const t = this.seats.get(s.bust);
      if (!t || !t.hands.length || s.chips < BUST_STAKE) s.bust = null; else s.chips -= BUST_STAKE;
    }
    for (const [id, s] of this.seats) if (s.bust && !playing.some(([pid]) => pid === id)) s.bust = null;
    this.dealer = { cards: [this.draw(), this.draw()], hidden: true };
    for (const [, s] of playing) { const h = s.hands[0]; if (isBJ(h.cards)) h.done = true; }
    this.room.fx('deal', { n: playing.length });
    // The dealer peeks: a dealer blackjack ends the hand at once.
    if (isBJ(this.dealer.cards)) { this.room.fx('dealerBJ'); return this.dealerTurn(); }
    this.setTimer(this.s.actSeconds * 1000, () => { for (const [, s] of this.seats) for (const h of s.hands) h.done = true; this.dealerTurn(); });
    for (const p of this.room.list()) if (p.bot && this.seats.get(p.id).hands.length) this.botPlay(p);
    this.checkAllDone();
  }
  checkAllDone() {
    if (this.phase !== 'playing') return;
    for (const [, s] of this.seats) if (s.hands.some((h) => !h.done)) return;
    this.dealerTurn();
  }
  dealerTurn() {
    if (this.phase === 'dealer' || this.phase === 'results') return;
    this.phase = 'dealer'; this.room.cancel(this.timer); this.endsAt = 0;
    const step = () => {
      if (this.dealer.hidden) { this.dealer.hidden = false; this.room.fx('flip'); return this.room.after(DEALER_STEP, step); }
      const live = [...this.seats.values()].some((s) => s.hands.some((h) => total(h.cards).t <= 21 && !isBJ(h.cards, h.split)));
      if (live && total(this.dealer.cards).t < 17) { this.dealer.cards.push(this.draw()); this.room.fx('deal', { n: 1 }); return this.room.after(DEALER_STEP, step); }
      this.settle();
    };
    this.room.after(DEALER_STEP, step);
  }
  settle() {
    const d = total(this.dealer.cards).t, dealerBJ = isBJ(this.dealer.cards);
    const busted = new Set();
    let winners = 0, losers = 0;
    for (const [id, s] of this.seats) {
      if (!s.hands.length) continue;
      let back = 0, staked = 0;
      for (const h of s.hands) {
        const t = total(h.cards).t; staked += h.bet;
        const bj = isBJ(h.cards, h.split);
        if (t > 21) { h.result = 'bust'; busted.add(id); }
        else if (bj && !dealerBJ) { h.result = 'blackjack'; back += Math.floor(h.bet * 2.5); s.bjs++; }
        else if (dealerBJ && !bj) h.result = 'lose';
        else if (bj && dealerBJ) { h.result = 'push'; back += h.bet; }
        else if (d > 21 || t > d) { h.result = 'win'; back += h.bet * 2; }
        else if (t === d) { h.result = 'push'; back += h.bet; }
        else h.result = 'lose';
      }
      s.chips += back; s.net = back - staked;
      if (s.net > 0) { winners++; s.wins++; } else if (s.net < 0) losers++;
    }
    const bustWins = [];
    for (const [id, s] of this.seats) if (s.bust) {
      if (busted.has(s.bust)) { s.chips += BUST_PAYS; s.bustWon = true; bustWins.push(id); } else s.bustWon = false;
    }
    this.phase = 'results';
    this.last = { dealer: d > 21 ? 'bust' : d, dealerBJ, winners, losers, bustWins: bustWins.map((id) => this.room.name(id)) };
    this.room.fx(d > 21 ? 'dealerBust' : 'settle');
    this.setTimer(RESULT_SECONDS * 1000, () => this.afterResults());
  }
  afterResults() {
    if (this.round >= this.s.hands) { this.phase = 'over'; this.endsAt = 0; this.room.fx('win'); return; }
    this.betting();
  }
  next() { if (this.phase === 'results') { this.room.cancel(this.timer); this.afterResults(); } else if (this.phase === 'betting') { this.room.cancel(this.timer); this.deal(); } }

  // ---- player actions ----
  act(p, m) {
    const s = this.seats.get(p.id); if (!s) return { ok: false, error: 'You are not at the table.' };
    if (m.op === 'bet') {
      if (this.phase !== 'betting') return { ok: false, error: 'Bets are closed.' };
      const amt = Math.floor(Number(m.amount) || 0);
      if (amt === 0) { s.bet = 0; return { ok: true }; }
      if (amt < MIN_BET) return { ok: false, error: `The minimum bet is ${MIN_BET}.` };
      if (amt > s.chips) return { ok: false, error: 'You don’t have that many chips.' };
      s.bet = amt;
      if (s.bust && s.chips < amt + BUST_STAKE) s.bust = null;
      this.room.fx('chip');
      this.maybeDealEarly();
      return { ok: true };
    }
    if (m.op === 'bust') {
      if (!this.s.bustBets) return { ok: false, error: 'Bust Bets are off.' };
      if (this.phase !== 'betting') return { ok: false, error: 'Bets are closed.' };
      if (!m.on) { s.bust = null; return { ok: true }; }
      if (m.on === p.id || !this.seats.has(m.on)) return { ok: false, error: 'Pick another player.' };
      if (s.chips < s.bet + BUST_STAKE) return { ok: false, error: `A Bust Bet costs ${BUST_STAKE} chips on top of your bet.` };
      s.bust = m.on; return { ok: true };
    }
    if (this.phase !== 'playing') return { ok: false, error: 'Not now.' };
    const h = s.hands.find((x) => !x.done); if (!h) return { ok: false, error: 'Your hand is finished.' };
    const r = this.play(s, h, m.op);
    if (r.ok) this.checkAllDone();
    return r;
  }
  play(s, h, op) {
    if (op === 'hit') {
      h.cards.push(this.draw()); const t = total(h.cards).t;
      if (t >= 21) h.done = true;
      this.room.fx(t > 21 ? 'bust' : 'deal', { n: 1 });
      return { ok: true };
    }
    if (op === 'stand') { h.done = true; return { ok: true }; }
    if (op === 'double') {
      if (h.cards.length !== 2) return { ok: false, error: 'You can only double on your first two cards.' };
      if (s.chips < h.bet) return { ok: false, error: 'Not enough chips to double.' };
      s.chips -= h.bet; h.bet *= 2; h.doubled = true; h.cards.push(this.draw()); h.done = true;
      this.room.fx(total(h.cards).t > 21 ? 'bust' : 'chip');
      return { ok: true };
    }
    if (op === 'split') {
      if (s.hands.length !== 1 || h.cards.length !== 2 || C.rankOf(h.cards[0]) !== C.rankOf(h.cards[1])) return { ok: false, error: 'Split needs a pair (once per hand).' };
      if (s.chips < h.bet) return { ok: false, error: 'Not enough chips to split.' };
      s.chips -= h.bet;
      const aces = C.rankOf(h.cards[0]) === 'A';
      const a = { cards: [h.cards[0], this.draw()], bet: h.bet, done: aces, split: true };
      const b = { cards: [h.cards[1], this.draw()], bet: h.bet, done: aces, split: true };
      for (const x of [a, b]) if (total(x.cards).t === 21) x.done = true;
      s.hands = [a, b];
      this.room.fx('deal', { n: 2 });
      return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }
  maybeDealEarly() {
    // Everyone (with a phone) has bet: no need to wait out the clock.
    const humans = this.room.list().filter((p) => !p.bot);
    if (humans.length && humans.every((p) => (this.seats.get(p.id) || {}).bet > 0)) {
      this.room.cancel(this.timer); this.endsAt = this.room.now() + 1500;
      this.timer = this.room.after(1500, () => { if (this.phase === 'betting') this.deal(); });
    }
  }

  // ---- bots: sensible, simple players ----
  botBet(p) {
    const s = this.seats.get(p.id); if (!s || this.phase !== 'betting') return;
    const r = this.room.rng();
    s.bet = Math.min(s.chips, Math.max(MIN_BET, Math.round((s.chips * (0.05 + r * 0.15)) / 5) * 5));
    if (this.s.bustBets && r < 0.25) { const others = [...this.seats.keys()].filter((id) => id !== p.id); const t = others[Math.floor(this.room.rng() * others.length)]; if (t && s.chips >= s.bet + BUST_STAKE) s.bust = t; }
  }
  botPlay(p) {
    this.room.after(700 + this.room.rng() * 1800, () => {
      const s = this.seats.get(p.id); if (!s || this.phase !== 'playing') return;
      const h = s.hands.find((x) => !x.done); if (!h) return;
      this.play(s, h, this.botMove(s, h));
      this.checkAllDone();
      if (s.hands.some((x) => !x.done)) this.botPlay(p);
    });
  }
  botMove(s, h) {
    const up = value(this.dealer.cards[0]), { t, soft } = total(h.cards);
    if (s.hands.length === 1 && h.cards.length === 2 && C.rankOf(h.cards[0]) === C.rankOf(h.cards[1]) && ['A', '8'].includes(C.rankOf(h.cards[0])) && s.chips >= h.bet) return 'split';
    if (h.cards.length === 2 && (t === 11 || (t === 10 && up < 10)) && s.chips >= h.bet) return 'double';
    if (soft) return t >= 18 ? 'stand' : 'hit';
    if (t >= 17) return 'stand';
    if (t >= 13 && up <= 6) return 'stand';
    if (t === 12 && up >= 4 && up <= 6) return 'stand';
    return 'hit';
  }

  // ---- views ----
  standings() {
    return [...this.seats].filter(([id]) => this.room.get(id)).map(([id, s]) => ({ id, name: this.room.name(id), chips: s.chips, rebuys: s.rebuys, wins: s.wins, bjs: s.bjs }))
      .sort((a, b) => b.chips - a.chips || a.rebuys - b.rebuys || b.wins - a.wins);
  }
  handView(h) { const { t, soft } = total(h.cards); return { cards: h.cards.map(C.base), total: t, soft: soft && t <= 21, bet: h.bet, done: h.done, doubled: !!h.doubled, result: h.result || null, bj: isBJ(h.cards, h.split) }; }
  dealerView() {
    const cards = this.dealer.hidden ? this.dealer.cards.slice(0, 1).map(C.base).concat(this.dealer.cards.length > 1 ? ['??'] : []) : this.dealer.cards.map(C.base);
    return { cards, total: this.dealer.hidden ? (this.dealer.cards[0] ? value(this.dealer.cards[0]) : 0) : total(this.dealer.cards).t, hidden: this.dealer.hidden };
  }
  tv() {
    const st = this.standings(), rank = new Map(st.map((x, i) => [x.id, i + 1]));
    const bustCount = {};
    for (const [, s] of this.seats) if (s.bust) bustCount[s.bust] = (bustCount[s.bust] || 0) + 1;
    return {
      phase: this.phase, round: this.round, totalHands: this.s.hands, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      dealer: this.dealerView(), last: this.last, bustBets: this.s.bustBets,
      seats: [...this.seats].filter(([id]) => this.room.get(id)).map(([id, s]) => ({
        id, name: this.room.name(id), color: this.room.get(id).color, chips: s.chips, bet: s.bet, rank: rank.get(id),
        hands: s.hands.map((h) => this.handView(h)), net: this.phase === 'results' ? s.net || 0 : null, targeted: bustCount[id] || 0,
      })),
      top: st.slice(0, 10),
    };
  }
  view(p) {
    const s = this.seat(p), st = this.standings();
    return {
      phase: this.phase, round: this.round, totalHands: this.s.hands, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      chips: s.chips, bet: s.bet, minBet: MIN_BET, bust: s.bust, bustName: s.bust ? this.room.name(s.bust) : null, bustStake: BUST_STAKE, bustPays: BUST_PAYS, bustBets: this.s.bustBets,
      bustWon: this.phase === 'results' ? s.bustWon : null,
      hands: s.hands.map((h) => this.handView(h)), active: s.hands.findIndex((h) => !h.done),
      canDouble: (() => { const h = s.hands.find((x) => !x.done); return !!h && h.cards.length === 2 && s.chips >= h.bet; })(),
      canSplit: s.hands.length === 1 && !s.hands[0].done && s.hands[0].cards.length === 2 && C.rankOf(s.hands[0].cards[0]) === C.rankOf(s.hands[0].cards[1]) && s.chips >= s.hands[0].bet,
      dealer: this.dealerView(), net: this.phase === 'results' ? s.net || 0 : null, rebuys: s.rebuys,
      rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length, leader: st[0] ? { name: st[0].name, chips: st[0].chips } : null,
      others: this.phase === 'betting' && this.s.bustBets ? st.filter((x) => x.id !== p.id).map((x) => ({ id: x.id, name: x.name })) : [],
      final: this.phase === 'over' ? st.slice(0, 10) : null,
    };
  }
}

module.exports = {
  key: 'blackjack', name: 'Blackjack Night', min: 1, fields, defaults,
  create: (room, settings) => new Blackjack(room, settings),
  _test: { total, isBJ, MIN_BET, BUST_STAKE, BUST_PAYS },
};
