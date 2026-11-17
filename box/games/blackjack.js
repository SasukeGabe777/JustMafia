'use strict';
// Blackjack Night: the whole room plays against one dealer on the big screen, all at the
// same time (no waiting for 99 other turns). Chips decide the winner after the last hand.
// Side game, "Bust Bets": put chips on another player going bust this hand.
// Table events keep the night lively: some hands get a twist (Happy Hour, Five-Card Charlie,
// Ties Win, Lucky 21) and the last hand is the High Roller Finale, where every win pays double.
const C = require('../cards');

const MIN_BET = 10, BUST_STAKE = 25, BUST_PAYS = 75;
const value = (card) => { const r = C.rankOf(card); return r === 'A' ? 11 : ['J', 'Q', 'K'].includes(r) ? 10 : Number(r); };
function total(cards) {
  let t = 0, aces = 0;
  for (const c of cards) { t += value(c); if (C.rankOf(c) === 'A') aces++; }
  while (t > 21 && aces) { t -= 10; aces--; }
  return { t, soft: aces > 0 };
}
const isBJ = (cards, split) => !split && cards.length === 2 && total(cards).t === 21;

const EVENTS = {
  happy: { icon: '🍹', name: 'Happy Hour', text: 'Blackjack pays 2 to 1!' },
  charlie: { icon: '🖐️', name: 'Five-Card Charlie', text: 'Five cards without busting wins, whatever the dealer has!' },
  ties: { icon: '🤝', name: 'Ties Win', text: 'Tie the dealer and you get paid like a win!' },
  lucky21: { icon: '🍀', name: 'Lucky 21', text: 'Any 21 made with 3 or more cards pays 2 to 1!' },
  finale: { icon: '🏁', name: 'High Roller Finale', text: 'Last hand: every win pays DOUBLE!' },
};
const onOff = [{ value: true, label: 'On' }, { value: false, label: 'Off' }];
const fields = [
  { key: 'hands', label: 'Hands', options: [5, 8, 12, 20].map((v) => ({ value: v, label: `${v} hands` })) },
  { key: 'startChips', label: 'Starting chips', options: [500, 1000, 2500].map((v) => ({ value: v, label: `${v} chips` })) },
  { key: 'actSeconds', label: 'Time to play a hand', options: [15, 25, 40].map((v) => ({ value: v, label: `${v} seconds` })) },
  { key: 'bustBets', label: 'Bust Bets (bet on a friend busting)', type: 'bool', options: onOff },
  { key: 'events', label: 'Table events + double-pay finale', type: 'bool', options: onOff },
];
const defaults = { hands: 8, startChips: 1000, actSeconds: 25, bustBets: true, events: true };
const BET_SECONDS = 20, RESULT_SECONDS = 7, DEALER_STEP = 900;
const on = (v) => v !== false && v !== 'false';

class Blackjack {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.round = 0; this.phase = 'betting';
    this.seats = new Map(); // id → { chips, bet, hands, bust, rebuys, … }
    this.dealer = { cards: [], hidden: true };
    this.shoe = []; this.endsAt = 0; this.timer = null; this.last = null; this.event = null; this.awards = [];
  }
  comeback() { return Math.max(100, Math.round(this.s.startChips / 10)); }
  seat(p) {
    if (!this.seats.has(p.id)) this.seats.set(p.id, { chips: this.s.startChips, bet: 0, lastBet: 0, hands: [], bust: null, rebuys: 0, wins: 0, bjs: 0, streak: 0, bestStreak: 0, busts: 0, bustHits: 0, bigWin: 0, low: this.s.startChips, charlies: 0 });
    return this.seats.get(p.id);
  }
  start() { for (const p of this.room.list()) this.seat(p); this.betting(); }
  joined(p) { this.seat(p); }
  left(p) { const s = this.seats.get(p.id); if (s && this.phase === 'playing') for (const h of s.hands) h.done = true; this.checkAllDone(); }

  // ---- phases ----
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  pickEvent() {
    if (!on(this.s.events)) return null;
    if (this.round === this.s.hands && this.s.hands >= 5) return 'finale';
    if (this.round < 2 || this.round >= this.s.hands) return null;
    if (this.room.rng() > 0.45) return null;
    const keys = ['happy', 'charlie', 'ties', 'lucky21'].filter((k) => k !== this.prevEvent);
    return keys[Math.floor(this.room.rng() * keys.length)];
  }
  betting() {
    this.round++; this.phase = 'betting'; this.dealer = { cards: [], hidden: true }; this.last = null;
    for (const [id, s] of this.seats) {
      s.bet = 0; s.hands = []; s.bust = null; s.result = null; s.net = 0; s.bustWon = null;
      if (s.chips < MIN_BET && this.room.get(id)) { s.chips += this.comeback(); s.rebuys++; } // nobody sits out the party for long
    }
    this.event = this.pickEvent(); if (this.event) this.prevEvent = this.event;
    this.room.fx('shuffle');
    if (this.event) this.room.fx('event', { ev: this.event });
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
    for (const [, s] of playing) { s.chips -= s.bet; s.lastBet = s.bet; s.hands = [{ cards: [this.draw(), this.draw()], bet: s.bet, done: false, split: false }]; }
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
      const live = [...this.seats.values()].some((s) => s.hands.some((h) => total(h.cards).t <= 21 && !isBJ(h.cards, h.split) && !h.charlie));
      if (live && total(this.dealer.cards).t < 17) { this.dealer.cards.push(this.draw()); this.room.fx('deal', { n: 1 }); return this.room.after(DEALER_STEP, step); }
      this.settle();
    };
    this.room.after(DEALER_STEP, step);
  }
  // Chips back for one hand (stake included) and its result.
  payout(h, d, dealerBJ) {
    const ev = this.event, mult = ev === 'finale' ? 2 : 1, t = total(h.cards).t, bj = isBJ(h.cards, h.split);
    const win = (rate, result) => ({ result, back: h.bet + Math.floor(h.bet * rate * mult) });
    if (t > 21) return { result: 'bust', back: 0 };
    if (h.charlie) return win(1, 'charlie');
    if (bj && !dealerBJ) return win(ev === 'happy' ? 2 : 1.5, 'blackjack');
    if (dealerBJ && !bj) return { result: 'lose', back: 0 };
    if (bj && dealerBJ) return ev === 'ties' ? win(1, 'win') : { result: 'push', back: h.bet };
    if (ev === 'lucky21' && t === 21) return win(2, 'lucky');
    if (d > 21 || t > d) return win(1, 'win');
    if (t === d) return ev === 'ties' ? win(1, 'win') : { result: 'push', back: h.bet };
    return { result: 'lose', back: 0 };
  }
  settle() {
    const d = total(this.dealer.cards).t, dealerBJ = isBJ(this.dealer.cards);
    const busted = new Set(), bjNames = [], charlieNames = [];
    let winners = 0, losers = 0, best = null;
    for (const [id, s] of this.seats) {
      if (!s.hands.length) continue;
      let back = 0, staked = 0;
      for (const h of s.hands) {
        staked += h.bet;
        const r = this.payout(h, d, dealerBJ);
        h.result = r.result; back += r.back;
        if (r.result === 'bust') { busted.add(id); s.busts++; }
        if (r.result === 'blackjack') { s.bjs++; if (!bjNames.includes(this.room.name(id))) bjNames.push(this.room.name(id)); }
        if (r.result === 'charlie') { s.charlies++; charlieNames.push(this.room.name(id)); }
      }
      s.chips += back; s.net = back - staked;
      if (s.net > 0) { winners++; s.wins++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak); s.bigWin = Math.max(s.bigWin, s.net); if (!best || s.net > best.net) best = { id, net: s.net }; }
      else if (s.net < 0) { losers++; s.streak = 0; }
    }
    const bustWins = [];
    for (const [id, s] of this.seats) if (s.bust) {
      if (busted.has(s.bust)) { s.chips += BUST_PAYS; s.bustWon = true; s.bustHits++; bustWins.push(id); } else s.bustWon = false;
    }
    for (const [, s] of this.seats) s.low = Math.min(s.low, s.chips);
    this.phase = 'results';
    this.last = {
      dealer: d > 21 ? 'bust' : d, dealerBJ, winners, losers, bustWins: bustWins.map((id) => this.room.name(id)),
      best: best ? { name: this.room.name(best.id), net: best.net } : null, bjs: bjNames.slice(0, 6), charlies: charlieNames.slice(0, 4),
      hot: [...this.seats].filter(([id, s]) => s.streak >= 3 && this.room.get(id)).map(([id, s]) => ({ name: this.room.name(id), streak: s.streak })).sort((a, b) => b.streak - a.streak).slice(0, 3),
    };
    this.room.fx(d > 21 ? 'dealerBust' : 'settle');
    if (bjNames.length) this.room.fx('bjWin');
    this.setTimer(RESULT_SECONDS * 1000, () => this.afterResults());
  }
  afterResults() {
    if (this.round >= this.s.hands) { this.phase = 'over'; this.endsAt = 0; this.awards = this.makeAwards(); this.room.fx('win'); return; }
    this.betting();
  }
  next() { if (this.phase === 'results') { this.room.cancel(this.timer); this.afterResults(); } else if (this.phase === 'betting') { this.room.cancel(this.timer); this.deal(); } }

  // ---- player actions ----
  act(p, m) {
    const s = this.seats.get(p.id); if (!s) return { ok: false, error: 'You are not at the table.' };
    if (this.phase === 'over') return { ok: false, error: 'The casino is closed.' };
    if (m.op === 'bet') {
      if (this.phase !== 'betting') return { ok: false, error: 'Bets are closed.' };
      const raw = typeof m.amount === 'number' || typeof m.amount === 'string' ? Number(m.amount) : NaN;
      if (!Number.isFinite(raw) || raw < 0) return { ok: false, error: 'Bet a number of chips.' };
      const amt = Math.floor(raw);
      if (amt === 0) { s.bet = 0; return { ok: true }; }
      if (amt < MIN_BET) return { ok: false, error: `The minimum bet is ${MIN_BET}.` };
      if (amt > s.chips) return { ok: false, error: 'You don’t have that many chips.' };
      s.bet = amt;
      if (s.bust && s.chips < amt + BUST_STAKE) s.bust = null;
      this.room.fx(amt === s.chips && amt >= 100 ? 'allin' : 'chip', { name: p.name });
      this.maybeDealEarly();
      return { ok: true };
    }
    if (m.op === 'bust') {
      if (!on(this.s.bustBets)) return { ok: false, error: 'Bust Bets are off.' };
      if (this.phase !== 'betting') return { ok: false, error: 'Bets are closed.' };
      if (!m.on) { s.bust = null; return { ok: true }; }
      if (typeof m.on !== 'string' || m.on === p.id || !this.seats.has(m.on) || !this.room.get(m.on)) return { ok: false, error: 'Pick another player.' };
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
      if (t > 21) this.room.fx('bust');
      else if (this.event === 'charlie' && h.cards.length >= 5) { h.done = true; h.charlie = true; this.room.fx('charlie'); }
      else this.room.fx('deal', { n: 1 });
      return { ok: true };
    }
    if (op === 'stand') { h.done = true; return { ok: true }; }
    if (op === 'double') {
      if (h.cards.length !== 2) return { ok: false, error: 'You can only double on your first two cards.' };
      if (s.chips < h.bet) return { ok: false, error: 'Not enough chips to double.' };
      s.chips -= h.bet; h.bet *= 2; h.doubled = true; h.cards.push(this.draw()); h.done = true;
      this.room.fx(total(h.cards).t > 21 ? 'bust' : 'double');
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
      this.timer = this.room.after(1500, () => {
        if (this.phase !== 'betting') return;
        for (const p of this.room.list()) if (p.bot && !(this.seats.get(p.id) || {}).bet) this.botBet(p); // slow bots don't miss the hand
        this.deal();
      });
    }
  }

  // ---- bots: sensible, simple players ----
  botBet(p) {
    const s = this.seats.get(p.id); if (!s || this.phase !== 'betting') return;
    const r = this.room.rng();
    s.bet = Math.min(s.chips, Math.max(MIN_BET, Math.round((s.chips * (0.05 + r * 0.15 + (this.event === 'finale' ? 0.25 : 0))) / 5) * 5));
    if (on(this.s.bustBets) && r < 0.25) { const others = [...this.seats.keys()].filter((id) => id !== p.id && this.room.get(id)); const t = others[Math.floor(this.room.rng() * others.length)]; if (t && s.chips >= s.bet + BUST_STAKE) s.bust = t; }
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

  // ---- the end ----
  makeAwards() {
    const rows = [...this.seats].filter(([id]) => this.room.get(id)).map(([id, s]) => ({ id, name: this.room.name(id), ...s, climb: s.chips - s.low }));
    const best = (key, min) => { const r = rows.slice().sort((a, b) => b[key] - a[key])[0]; return r && r[key] >= min ? r : null; };
    const out = [];
    let r;
    if ((r = best('bigWin', 1))) out.push({ icon: '💰', title: 'Big Score', id: r.id, name: r.name, why: `won ${r.bigWin} chips on one hand` });
    if ((r = best('bjs', 1))) out.push({ icon: '🃏', title: 'Natural', id: r.id, name: r.name, why: `${r.bjs} blackjack${r.bjs === 1 ? '' : 's'}` });
    if ((r = best('bestStreak', 3))) out.push({ icon: '🔥', title: 'Hot Hand', id: r.id, name: r.name, why: `won ${r.bestStreak} hands in a row` });
    if ((r = best('climb', Math.round(this.s.startChips / 2)))) if (r.low < this.s.startChips / 2) out.push({ icon: '🦅', title: 'Comeback Kid', id: r.id, name: r.name, why: `climbed back ${r.climb} chips from ${r.low}` });
    if ((r = best('bustHits', 1))) out.push({ icon: '🎯', title: 'Bust Bandit', id: r.id, name: r.name, why: `${r.bustHits} Bust Bet${r.bustHits === 1 ? '' : 's'} paid off` });
    if ((r = best('busts', 3))) out.push({ icon: '🧨', title: 'Daredevil', id: r.id, name: r.name, why: `went bust ${r.busts} times and kept hitting` });
    return out;
  }
  results() { return this.standings().map((r) => r.id); }

  // ---- views ----
  standings() {
    return [...this.seats].filter(([id]) => this.room.get(id)).map(([id, s]) => ({ id, name: this.room.name(id), av: this.room.get(id).avatar || null, chips: s.chips, rebuys: s.rebuys, wins: s.wins, bjs: s.bjs, streak: s.streak }))
      .sort((a, b) => b.chips - a.chips || a.rebuys - b.rebuys || b.wins - a.wins);
  }
  handView(h) { const { t, soft } = total(h.cards); return { cards: h.cards.map(C.base), total: t, soft: soft && t <= 21, bet: h.bet, done: h.done, doubled: !!h.doubled, charlie: !!h.charlie, result: h.result || null, bj: isBJ(h.cards, h.split) }; }
  dealerView() {
    const cards = this.dealer.hidden ? this.dealer.cards.slice(0, 1).map(C.base).concat(this.dealer.cards.length > 1 ? ['??'] : []) : this.dealer.cards.map(C.base);
    return { cards, total: this.dealer.hidden ? (this.dealer.cards[0] ? value(this.dealer.cards[0]) : 0) : total(this.dealer.cards).t, hidden: this.dealer.hidden };
  }
  eventView() { return this.event ? { key: this.event, ...EVENTS[this.event] } : null; }
  // Who the table is waiting on right now (names), so the TV can call them out.
  waitingOn() {
    const out = [];
    for (const [id, s] of this.seats) {
      const p = this.room.get(id); if (!p) continue;
      if (this.phase === 'betting' && !p.bot && !s.bet) out.push(p.name);
      if (this.phase === 'playing' && s.hands.some((h) => !h.done)) out.push(p.name);
    }
    return out;
  }
  tv() {
    const st = this.standings(), rank = new Map(st.map((x, i) => [x.id, i + 1]));
    const bustCount = {};
    for (const [, s] of this.seats) if (s.bust) bustCount[s.bust] = (bustCount[s.bust] || 0) + 1;
    const wait = this.waitingOn();
    return {
      phase: this.phase, round: this.round, totalHands: this.s.hands, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      dealer: this.dealerView(), last: this.last, bustBets: on(this.s.bustBets), event: this.eventView(),
      waitingOn: wait.slice(0, 8), waitingCount: wait.length,
      seats: [...this.seats].filter(([id]) => this.room.get(id)).map(([id, s]) => ({
        id, name: this.room.name(id), av: this.room.get(id).avatar || null, color: this.room.get(id).color, chips: s.chips, bet: s.bet, rank: rank.get(id), streak: s.streak,
        hands: s.hands.map((h) => this.handView(h)), net: this.phase === 'results' ? s.net || 0 : null, targeted: bustCount[id] || 0,
        acting: this.phase === 'playing' && s.hands.some((h) => !h.done),
      })),
      top: st.slice(0, 10), awards: this.phase === 'over' ? this.awards : null,
    };
  }
  view(p) {
    const s = this.seat(p), st = this.standings();
    return {
      phase: this.phase, round: this.round, totalHands: this.s.hands, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      chips: s.chips, bet: s.bet, lastBet: s.lastBet, minBet: MIN_BET, bust: s.bust, bustName: s.bust ? this.room.name(s.bust) : null, bustStake: BUST_STAKE, bustPays: BUST_PAYS, bustBets: on(this.s.bustBets),
      bustWon: this.phase === 'results' ? s.bustWon : null, event: this.eventView(), streak: s.streak, comeback: this.comeback(),
      hands: s.hands.map((h) => this.handView(h)), active: s.hands.findIndex((h) => !h.done),
      canDouble: (() => { const h = s.hands.find((x) => !x.done); return !!h && h.cards.length === 2 && s.chips >= h.bet; })(),
      canSplit: s.hands.length === 1 && !s.hands[0].done && s.hands[0].cards.length === 2 && C.rankOf(s.hands[0].cards[0]) === C.rankOf(s.hands[0].cards[1]) && s.chips >= s.hands[0].bet,
      dealer: this.dealerView(), net: this.phase === 'results' ? s.net || 0 : null, rebuys: s.rebuys,
      rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length, leader: st[0] ? { name: st[0].name, chips: st[0].chips } : null,
      others: this.phase === 'betting' && on(this.s.bustBets) ? st.filter((x) => x.id !== p.id).map((x) => ({ id: x.id, name: x.name })) : [],
      final: this.phase === 'over' ? st.slice(0, 10) : null, awards: this.phase === 'over' ? this.awards.filter((a) => a.id === p.id) : null,
    };
  }
}

module.exports = {
  key: 'blackjack', name: 'Blackjack Night', min: 1, best: [2, 12], howSteps: 6, fields, defaults,
  create: (room, settings) => new Blackjack(room, settings),
  _test: { total, isBJ, MIN_BET, BUST_STAKE, BUST_PAYS, EVENTS },
};
