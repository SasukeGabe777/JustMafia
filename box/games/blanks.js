'use strict';
// JustBlanks: a fill-in-the-blank party card game. A prompt card goes up on the TV; everyone
// plays their funniest answer card(s) from their phone (or types their own on a blank card);
// answers are shown without names; then the Judge picks a winner (or everyone votes, for big
// groups). First to the target score wins. All cards are original (blanks-cards.js).
const { PROMPTS, ANSWERS } = require('./blanks-cards');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'mode', label: 'Who picks the winner', options: opt([['auto', 'Auto (Judge up to 10 players, vote above)'], ['judge', 'A rotating Judge'], ['vote', 'Everyone votes']]) },
  { key: 'toWin', label: 'Points to win', options: opt([[3, '3 points'], [5, '5 points'], [7, '7 points'], [10, '10 points']]) },
  { key: 'pickSeconds', label: 'Time to play a card', options: opt([[45, '45 seconds'], [60, '60 seconds'], [90, '90 seconds']]) },
  { key: 'blanks', label: 'Write-your-own cards per player', options: opt([[0, 'None'], [2, '2 per game'], [4, '4 per game'], [99, 'Unlimited']]) },
];
const defaults = { mode: 'auto', toWin: 5, pickSeconds: 60, blanks: 2 };
const HAND = 7, REVEAL_EACH = 2200, CHOOSE_SECONDS = 40, WIN_SECONDS = 7, MAX_ROUNDS = 40;
const clean = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 70);

class Blanks {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'pick'; this.round = 0; this.scores = new Map(); this.hands = new Map(); this.blanksLeft = new Map();
    this.judgeIdx = -1; this.subs = []; this.endsAt = 0; this.timer = null; this.last = null;
  }
  shuffle(a) { const r = this.room.rng; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  mode() { return this.s.mode === 'auto' ? (this.room.players.size <= 10 ? 'judge' : 'vote') : this.s.mode; }
  start() {
    this.answers = this.shuffle(ANSWERS.map((text, i) => ({ id: 'a' + i, text })));
    this.prompts = this.shuffle(PROMPTS.slice());
    for (const p of this.room.list()) this.seat(p);
    this.nextRound();
  }
  seat(p) { if (!this.scores.has(p.id)) { this.scores.set(p.id, 0); this.blanksLeft.set(p.id, this.s.blanks); this.hands.set(p.id, []); } this.deal(p.id); }
  joined(p) { this.seat(p); }
  deal(id) { const h = this.hands.get(id) || []; while (h.length < HAND) { if (!this.answers.length) this.answers = this.shuffle(ANSWERS.map((text, i) => ({ id: 'a' + i + '_' + this.round, text }))); h.push(this.answers.pop()); } this.hands.set(id, h); }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }

  nextRound() {
    this.round++; this.phase = 'pick'; this.subs = []; this.votes = new Map(); this.last = null;
    if (!this.prompts.length) this.prompts = this.shuffle(PROMPTS.slice());
    const text = this.prompts.pop();
    this.prompt = { text, pick: (text.match(/___/g) || []).length || 1 };
    const ids = this.room.list().map((p) => p.id);
    if (this.mode() === 'judge') { this.judgeIdx = (this.judgeIdx + 1) % ids.length; this.judge = ids[this.judgeIdx]; } else this.judge = null;
    for (const id of ids) this.deal(id);
    this.room.fx('deal');
    this.setTimer(this.s.pickSeconds * 1000, () => this.reveal());
    for (const p of this.room.list()) if (p.bot && p.id !== this.judge) this.room.after(1500 + this.room.rng() * 6000, () => this.botPlay(p));
  }
  players() { return this.room.list().filter((p) => p.id !== this.judge); }
  maybeAllIn() {
    const need = this.players().filter((p) => !p.bot || true);
    if (need.every((p) => this.subs.some((s) => s.by === p.id))) { this.room.cancel(this.timer); this.timer = this.room.after(800, () => this.reveal()); this.endsAt = this.room.now() + 800; }
  }
  reveal() {
    if (this.phase !== 'pick') return;
    if (!this.subs.length) { this.last = { none: true }; this.phase = 'win'; return this.setTimer(3000, () => this.nextRound()); }
    this.shuffle(this.subs);
    this.phase = 'reveal'; this.shown = 0;
    const step = () => {
      this.shown++; this.room.fx('flip');
      if (this.shown < this.subs.length && this.shown < 12) { this.endsAt = this.room.now() + REVEAL_EACH; this.timer = this.room.after(REVEAL_EACH, step); }
      else this.choose();
    };
    this.endsAt = this.room.now() + REVEAL_EACH; this.timer = this.room.after(REVEAL_EACH, step);
  }
  choose() {
    this.phase = 'choose'; this.shown = this.subs.length;
    this.setTimer(CHOOSE_SECONDS * 1000, () => this.decide(true));
    const bots = this.room.list().filter((p) => p.bot);
    if (this.judge) { const j = this.room.get(this.judge); if (j && j.bot) this.room.after(2500 + this.room.rng() * 3000, () => this.pickWinner(this.subs[Math.floor(this.room.rng() * this.subs.length)].sid)); }
    else for (const b of bots) this.room.after(1500 + this.room.rng() * 6000, () => { const opts = this.subs.filter((s) => s.by !== b.id); if (opts.length && this.phase === 'choose') { this.votes.set(b.id, opts[Math.floor(this.room.rng() * opts.length)].sid); this.maybeAllVoted(); } });
  }
  maybeAllVoted() {
    const voters = this.room.list().filter((p) => this.subs.some((s) => s.by !== p.id));
    if (voters.every((p) => this.votes.has(p.id))) this.decide(false);
  }
  pickWinner(sid) { if (this.phase !== 'choose') return; const s = this.subs.find((x) => x.sid === sid); if (!s) return; this.award([s]); }
  decide(timeout) {
    if (this.phase !== 'choose') return;
    if (this.judge) { // Judge didn't pick in time: a random answer wins
      return this.award([this.subs[Math.floor(this.room.rng() * this.subs.length)]], timeout);
    }
    const count = new Map(); for (const sid of this.votes.values()) count.set(sid, (count.get(sid) || 0) + 1);
    const top = Math.max(0, ...count.values());
    const winners = top ? this.subs.filter((s) => count.get(s.sid) === top) : [this.subs[Math.floor(this.room.rng() * this.subs.length)]];
    this.voteCount = Object.fromEntries(count);
    this.award(winners);
  }
  award(wins, random = false) {
    for (const w of wins) this.scores.set(w.by, (this.scores.get(w.by) || 0) + 1);
    this.last = { winners: wins.map((w) => ({ sid: w.sid, name: this.room.name(w.by), cards: w.cards })), random, votes: this.voteCount || null, all: this.subs.map((s) => ({ sid: s.sid, name: this.room.name(s.by), cards: s.cards })) };
    this.voteCount = null;
    this.phase = 'win'; this.room.fx('win1');
    const champ = [...this.scores].find(([, v]) => v >= this.s.toWin);
    if (champ || this.round >= MAX_ROUNDS) { this.endsAt = this.room.now() + WIN_SECONDS * 1000; this.room.cancel(this.timer); this.timer = this.room.after(WIN_SECONDS * 1000, () => { this.phase = 'over'; this.endsAt = 0; this.room.fx('win'); }); return; }
    this.setTimer(WIN_SECONDS * 1000, () => this.nextRound());
  }
  next() { if (this.phase === 'pick') { this.room.cancel(this.timer); this.reveal(); } else if (this.phase === 'choose') { this.room.cancel(this.timer); this.decide(true); } else if (this.phase === 'win') { this.room.cancel(this.timer); this.nextRound(); } }

  act(p, m) {
    if (m.op === 'play') {
      if (this.phase !== 'pick') return { ok: false, error: 'Cards are closed for this round.' };
      if (p.id === this.judge) return { ok: false, error: 'You’re the Judge this round!' };
      if (this.subs.some((s) => s.by === p.id)) return { ok: false, error: 'You already played.' };
      const hand = this.hands.get(p.id) || [], want = this.prompt.pick;
      const ids = Array.isArray(m.cards) ? m.cards : [];
      const written = Array.isArray(m.written) ? m.written.map(clean).filter(Boolean) : [];
      if (ids.length + written.length !== want) return { ok: false, error: `Play ${want} card${want > 1 ? 's' : ''}.` };
      if (written.length > (this.blanksLeft.get(p.id) || 0)) return { ok: false, error: 'No blank cards left.' };
      const cards = ids.map((id) => hand.find((c) => c.id === id));
      if (cards.some((c) => !c) || new Set(ids).size !== ids.length) return { ok: false, error: 'Those aren’t your cards.' };
      // Order: the phone sends the order the player chose (written cards go where the player put them).
      const order = Array.isArray(m.order) && m.order.length === want ? m.order : null;
      let texts = cards.map((c) => c.text).concat(written);
      if (order) { const pool = { c: cards.map((c) => c.text), w: written.slice() }; texts = order.map((o) => (o === 'w' ? pool.w.shift() : pool.c.shift())).filter(Boolean); if (texts.length !== want) texts = cards.map((c) => c.text).concat(written); }
      this.hands.set(p.id, hand.filter((c) => !ids.includes(c.id)));
      if (written.length && this.s.blanks < 99) this.blanksLeft.set(p.id, this.blanksLeft.get(p.id) - written.length);
      this.subs.push({ sid: 's' + Math.floor(this.room.rng() * 1e9).toString(36), by: p.id, cards: texts });
      this.room.fx('card');
      this.maybeAllIn();
      return { ok: true };
    }
    if (m.op === 'pick') {
      if (this.phase !== 'choose') return { ok: false, error: 'Not yet.' };
      if (p.id !== this.judge) return { ok: false, error: 'Only the Judge picks.' };
      this.pickWinner(m.sid); return { ok: true };
    }
    if (m.op === 'vote') {
      if (this.phase !== 'choose' || this.judge) return { ok: false, error: 'Not now.' };
      const s = this.subs.find((x) => x.sid === m.sid); if (!s) return { ok: false, error: 'Pick an answer.' };
      if (s.by === p.id) return { ok: false, error: 'You can’t vote for your own answer!' };
      this.votes.set(p.id, s.sid); this.maybeAllVoted(); return { ok: true };
    }
    if (m.op === 'swap') { // trade your whole hand once per game for a fresh one
      if (this.phase !== 'pick' || this.swapped && this.swapped.has(p.id)) return { ok: false, error: 'You already swapped your hand this game.' };
      (this.swapped = this.swapped || new Set()).add(p.id); this.hands.set(p.id, []); this.deal(p.id); return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }
  botPlay(p) {
    if (this.phase !== 'pick' || this.subs.some((s) => s.by === p.id)) return;
    const hand = this.hands.get(p.id) || [];
    this.act(p, { op: 'play', cards: this.shuffle(hand.slice()).slice(0, this.prompt.pick).map((c) => c.id) });
  }

  standings() { return [...this.scores].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), points: pts })).sort((a, b) => b.points - a.points); }
  tv() {
    const showSubs = this.phase === 'reveal' ? this.subs.slice(0, this.shown) : this.phase === 'choose' || this.phase === 'win' ? this.subs : [];
    return {
      phase: this.phase, round: this.round, toWin: this.s.toWin, mode: this.mode(), endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      prompt: this.prompt, judge: this.judge ? this.room.name(this.judge) : null,
      played: this.subs.length, waiting: this.phase === 'pick' ? this.players().filter((p) => !this.subs.some((s) => s.by === p.id)).map((p) => p.name) : [],
      answers: showSubs.map((s) => ({ sid: s.sid, cards: s.cards })), total: this.subs.length, voted: this.votes ? this.votes.size : 0,
      last: this.last, standings: this.standings().slice(0, 12),
    };
  }
  view(p) {
    const st = this.standings(), mine = this.subs.find((s) => s.by === p.id);
    return {
      phase: this.phase, round: this.round, toWin: this.s.toWin, mode: this.mode(), endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      prompt: this.prompt, isJudge: this.judge === p.id, judge: this.judge ? this.room.name(this.judge) : null,
      hand: this.hands.get(p.id) || [], blanks: this.s.blanks >= 99 ? 99 : this.blanksLeft.get(p.id) || 0, played: !!mine, mine: mine ? mine.cards : null, canSwap: !(this.swapped && this.swapped.has(p.id)),
      answers: this.phase === 'choose' ? this.subs.map((s) => ({ sid: s.sid, cards: s.cards, mine: s.by === p.id })) : [], myVote: this.votes ? this.votes.get(p.id) || null : null,
      last: this.last, points: this.scores.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length, final: this.phase === 'over' ? st.slice(0, 10) : null,
    };
  }
}

module.exports = {
  key: 'blanks', name: 'JustBlanks', min: 3, fields, defaults,
  create: (room, settings) => new Blanks(room, settings),
};
