'use strict';
// JustBlanks: a fill-in-the-blank party card game. A prompt card goes up on the TV; everyone
// plays their funniest answer card(s) from their phone (or types their own on a blank card);
// answers are read out one by one without names; then the Judge picks a winner (or everyone
// votes, for big groups). In Judge rounds everyone else can still ❤️ a crowd favourite.
// First to the target score (or the best score when the round limit is hit) wins, and the
// game ends with awards and the best lines of the night. All cards are original (blanks-cards.js).
const C = require('./blanks-cards');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'deck', label: 'Card deck', options: opt([['party', 'Party (all cards, a bit cheeky)'], ['family', 'Family-friendly only']]) },
  { key: 'mode', label: 'Who picks the winner', options: opt([['auto', 'Auto (Judge up to 10 players, vote above)'], ['judge', 'A rotating Judge'], ['vote', 'Everyone votes']]) },
  { key: 'toWin', label: 'Points to win', options: opt([[3, '3 points'], [5, '5 points'], [7, '7 points'], [10, '10 points']]) },
  { key: 'rounds', label: 'Round limit', options: opt([[8, '8 rounds'], [12, '12 rounds'], [20, '20 rounds'], [40, 'No limit']]) },
  { key: 'pickSeconds', label: 'Time to play a card', options: opt([[45, '45 seconds'], [60, '60 seconds'], [90, '90 seconds']]) },
  { key: 'blanks', label: 'Write-your-own cards per player', options: opt([[0, 'None'], [2, '2 per game'], [4, '4 per game'], [99, 'Unlimited']]) },
];
const defaults = { deck: 'party', mode: 'auto', toWin: 5, rounds: 12, pickSeconds: 60, blanks: 2 };
const HAND = 7, WIN_SECONDS = 9, MAX_ROUNDS = 40, HURRY_MS = 20000, REVEAL_TOTAL = 15000, REVEAL_MAX_STEPS = 30, WRITE_MAX = 70;
const clean = (s, max = WRITE_MAX) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200c\u200e\u200f\u202a-\u202e\u2066-\u2069<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const str = (s) => (typeof s === 'string' ? s.slice(0, 40) : '');

class Blanks {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'pick'; this.round = 0; this.scores = new Map(); this.hands = new Map(); this.blanksLeft = new Map();
    this.stats = new Map(); this.swapped = new Set(); this.reel = []; this.awards = null;
    this.judgeIdx = -1; this.judge = null; this.rmode = 'judge'; this.subs = []; this.votes = new Map(); this.hearts = new Map();
    this.endsAt = 0; this.timer = null; this.last = null; this.shown = 0; this.hurried = false; this.allIn = false;
  }
  shuffle(a) { const r = this.room.rng; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  mode() { return this.s.mode === 'auto' ? (this.room.players.size <= 10 ? 'judge' : 'vote') : this.s.mode; }
  family() { return this.s.deck === 'family'; }
  promptPool() { return this.family() ? C.FAMILY_PROMPTS : C.PROMPTS; }
  answerPool() { return this.family() ? C.FAMILY_ANSWERS : C.ANSWERS; }
  freshAnswers() { this.deckN = (this.deckN || 0) + 1; return this.shuffle(this.answerPool().map((text, i) => ({ id: 'a' + i + (this.deckN > 1 ? '_' + this.deckN : ''), text }))); }
  start() {
    this.answers = this.freshAnswers();
    this.prompts = this.shuffle(this.promptPool().slice());
    for (const p of this.room.list()) this.seat(p);
    this.nextRound();
  }
  seat(p) {
    if (!this.scores.has(p.id)) {
      this.scores.set(p.id, 0); this.blanksLeft.set(p.id, this.s.blanks); this.hands.set(p.id, []);
      this.stats.set(p.id, { wins: 0, love: 0, written: 0, playMs: 0, plays: 0 });
    }
    this.deal(p.id);
  }
  joined(p) { this.seat(p); }
  left(p) {
    if (p.id === this.judge) { // the Judge walked out: everyone votes this round instead
      this.judge = null; this.rmode = 'vote';
      if (this.phase === 'choose') { this.hearts = new Map(); this.botVotes(); }
    }
    if (this.phase === 'pick') this.maybeAllIn();
    else if (this.phase === 'choose') this.maybeAllVoted();
  }
  deal(id) {
    const h = this.hands.get(id) || [];
    while (h.length < HAND) {
      if (!this.answers.length) this.answers = this.freshAnswers();
      const c = this.answers.pop();
      if (!h.some((x) => x.text === c.text)) h.push(c);
    }
    this.hands.set(id, h);
  }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  endsIn() { return this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.room.now()) : 0; }
  limit() { return Math.min(Number(this.s.rounds) || MAX_ROUNDS, MAX_ROUNDS); }

  nextRound() {
    this.round++; this.phase = 'pick'; this.subs = []; this.votes = new Map(); this.hearts = new Map(); this.last = null; this.shown = 0;
    this.hurried = false; this.allIn = false; this.roundAt = this.room.now();
    if (!this.prompts.length) this.prompts = this.shuffle(this.promptPool().slice());
    const text = this.prompts.pop();
    this.prompt = { text, pick: (text.match(/___/g) || []).length || 1 };
    const ids = this.room.list().map((p) => p.id);
    this.rmode = this.mode();
    if (this.rmode === 'judge' && ids.length) { this.judgeIdx = (this.judgeIdx + 1) % ids.length; this.judge = ids[this.judgeIdx]; } else { this.judge = null; this.rmode = 'vote'; }
    for (const id of ids) this.deal(id);
    this.room.fx('deal');
    this.setTimer(this.s.pickSeconds * 1000, () => this.reveal());
    for (const p of this.room.list()) if (p.bot && p.id !== this.judge) this.room.after(1500 + this.room.rng() * 6000, () => this.botPlay(p));
  }
  players() { return this.room.list().filter((p) => p.id !== this.judge); }
  hasPlayed(id) { return this.subs.some((s) => s.by === id); }
  maybeAllIn() {
    if (this.phase !== 'pick' || this.allIn) return;
    const need = this.players();
    if (need.length && need.every((p) => this.hasPlayed(p.id))) { this.allIn = true; this.setTimer(900, () => this.reveal()); return; }
    // Hurry up: most of the room is in, so the stragglers get a short countdown instead of the full clock.
    if (!this.hurried && need.length >= 4 && this.subs.length >= Math.ceil(need.length * 2 / 3) && this.endsAt - this.room.now() > HURRY_MS + 2000) {
      this.hurried = true; this.setTimer(HURRY_MS, () => this.reveal()); this.room.fx('hurry');
    }
  }
  reveal() {
    if (this.phase !== 'pick') return;
    this.allIn = false;
    if (!this.subs.length) { this.last = { none: true }; this.phase = 'win'; return this.setTimer(3500, () => this.afterWin()); }
    this.shuffle(this.subs);
    this.phase = 'reveal'; this.shown = 0;
    // The whole read-out takes about 15 seconds however many answers there are.
    const steps = Math.min(this.subs.length, REVEAL_MAX_STEPS);
    const each = Math.max(1100, Math.min(2600, Math.round(REVEAL_TOTAL / steps)));
    const step = () => {
      this.shown++; this.room.fx('flip');
      if (this.shown < steps) this.setTimer(each, step);
      else this.setTimer(Math.max(1500, each), () => this.choose());
    };
    this.setTimer(600, step);
  }
  chooseMs() { return this.judge ? 40000 : Math.min(60000, 30000 + this.subs.length * 1000); }
  choose() {
    this.phase = 'choose'; this.shown = this.subs.length;
    this.room.fx('gavel');
    this.setTimer(this.chooseMs(), () => this.decide(true));
    if (this.judge) {
      const j = this.room.get(this.judge);
      if (j && j.bot) this.room.after(2500 + this.room.rng() * 3000, () => { if (this.phase === 'choose' && this.judge === j.id) this.pickWinner(this.subs[Math.floor(this.room.rng() * this.subs.length)].sid); });
      for (const b of this.room.list()) if (b.bot && b.id !== this.judge && this.room.rng() < 0.6) this.room.after(1000 + this.room.rng() * 4000, () => {
        const opts = this.subs.filter((s) => s.by !== b.id); if (opts.length && this.phase === 'choose' && this.judge) this.hearts.set(b.id, opts[Math.floor(this.room.rng() * opts.length)].sid);
      });
    } else this.botVotes();
    if (!this.judge) this.maybeAllVoted();
  }
  botVotes() {
    for (const b of this.room.list()) if (b.bot) this.room.after(1500 + this.room.rng() * 6000, () => {
      const opts = this.subs.filter((s) => s.by !== b.id);
      if (opts.length && this.phase === 'choose' && !this.judge && !this.votes.has(b.id)) { this.votes.set(b.id, opts[Math.floor(this.room.rng() * opts.length)].sid); this.maybeAllVoted(); }
    });
  }
  voters() { return this.room.list().filter((p) => this.subs.some((s) => s.by !== p.id)); }
  maybeAllVoted() {
    if (this.phase !== 'choose' || this.judge || this.allIn) return;
    const v = this.voters();
    if (v.every((p) => this.votes.has(p.id))) { this.allIn = true; this.setTimer(700, () => { this.allIn = false; this.decide(false); }); }
  }
  pickWinner(sid) { if (this.phase !== 'choose') return; const s = this.subs.find((x) => x.sid === sid); if (!s) return; this.award([s], 'judge'); }
  decide(timeout) {
    if (this.phase !== 'choose') return;
    const rnd = () => [this.subs[Math.floor(this.room.rng() * this.subs.length)]];
    if (this.judge) return this.award(rnd(), 'random'); // the Judge didn't pick in time
    const count = this.tally(this.votes);
    const top = Math.max(0, ...count.values());
    if (!top) return this.award(rnd(), 'random');
    const winners = this.subs.filter((s) => count.get(s.sid) === top);
    this.award(winners, winners.length > 1 ? 'tie' : 'vote');
  }
  tally(map) { const count = new Map(); for (const sid of map.values()) count.set(sid, (count.get(sid) || 0) + 1); return count; }
  who(id) { const p = this.room.get(id); return { name: this.room.name(id), av: p && p.avatar ? String(p.avatar).slice(0, 8) : '' }; }
  award(wins, how) {
    if (this.phase !== 'choose') return;
    const votes = this.tally(this.votes), hearts = this.tally(this.hearts), winSet = new Set(wins.map((w) => w.sid));
    for (const w of wins) this.scores.set(w.by, (this.scores.get(w.by) || 0) + 1);
    for (const s of this.subs) {
      const st = this.stats.get(s.by); if (!st) continue;
      st.love += (votes.get(s.sid) || 0) + (hearts.get(s.sid) || 0);
      if (winSet.has(s.sid)) { st.wins++; if (s.written) st.written++; }
    }
    const all = this.subs.map((s) => ({ sid: s.sid, ...this.who(s.by), cards: s.cards, written: !!s.written, votes: votes.get(s.sid) || 0, hearts: hearts.get(s.sid) || 0, win: winSet.has(s.sid) }))
      .sort((a, b) => Number(b.win) - Number(a.win) || (b.votes + b.hearts) - (a.votes + a.hearts));
    // Judge rounds: the room's ❤️ favourite gets a shout-out when it isn't the Judge's pick.
    let crowd = null;
    if (how === 'judge' || (this.judge && how === 'random')) { const fav = all.filter((a) => !a.win && a.hearts > 0).sort((a, b) => b.hearts - a.hearts)[0]; if (fav) crowd = fav; }
    this.last = { winners: all.filter((a) => a.win), how, random: how === 'random', judge: this.judge ? this.room.name(this.judge) : null, votes: this.judge ? null : Object.fromEntries(votes), all: all.slice(0, 30), more: Math.max(0, all.length - 30), crowd };
    for (const w of this.last.winners) this.reel.push({ prompt: this.prompt.text, cards: w.cards, name: w.name, av: w.av, love: w.votes + w.hearts, how, round: this.round });
    this.phase = 'win'; this.room.fx('reveal', { how });
    const champ = [...this.scores].some(([id, v]) => v >= this.s.toWin && this.room.get(id));
    this.ending = champ || this.round >= this.limit();
    this.setTimer(WIN_SECONDS * 1000, () => this.afterWin());
  }
  afterWin() {
    if (this.phase !== 'win') return;
    if (this.ending || this.round >= this.limit()) return this.finish();
    this.nextRound();
  }
  finish() {
    this.room.cancel(this.timer); this.timer = null;
    this.phase = 'over'; this.endsAt = 0; this.awards = this.makeAwards(); this.room.fx('win');
  }
  makeAwards() {
    const here = [...this.stats].filter(([id]) => this.room.get(id));
    const best = (val, min = 1) => { let top = null; for (const [id, st] of here) { const v = val(st); if (v == null || v < min) continue; if (!top || v > top.v) top = { id, v }; } return top; };
    const out = [];
    const push = (key, icon, title, blurb, t, text) => { if (t) out.push({ key, icon, title, blurb, ...this.who(t.id), id: t.id, value: text(t.v) }); };
    push('crowd', '❤️', 'Crowd Pleaser', 'Most votes and hearts', best((s) => s.love), (v) => `${v} ❤️`);
    push('word', '✍️', 'Wordsmith', 'Won with their own words', best((s) => s.written), (v) => `${v} written win${v === 1 ? '' : 's'}`);
    push('quick', '⚡', 'Quick Draw', 'Fastest to play a card', best((s) => (s.plays >= 2 ? -s.playMs / s.plays : null), -Infinity), (v) => `${(-v / 1000).toFixed(1)}s avg`);
    push('close', '🥈', 'So Close', 'Loved, but never won', best((s) => (s.wins ? null : s.love)), (v) => `${v} ❤️, 0 wins`);
    return out;
  }
  next() {
    if (this.phase === 'pick') { this.room.cancel(this.timer); this.reveal(); }
    else if (this.phase === 'reveal') { this.room.cancel(this.timer); this.choose(); }
    else if (this.phase === 'choose') { this.room.cancel(this.timer); this.decide(true); }
    else if (this.phase === 'win') { this.room.cancel(this.timer); this.afterWin(); }
  }

  act(p, m) {
    if (!this.scores.has(p.id)) this.seat(p);
    m = m && typeof m === 'object' ? m : {};
    if (m.op === 'play') {
      if (this.phase !== 'pick') return { ok: false, error: 'Cards are closed for this round.' };
      if (p.id === this.judge) return { ok: false, error: 'You’re the Judge this round!' };
      if (this.hasPlayed(p.id)) return { ok: false, error: 'You already played.' };
      const hand = this.hands.get(p.id) || [], want = this.prompt.pick;
      const ids = Array.isArray(m.cards) ? m.cards.slice(0, 4).map(str) : [];
      const written = Array.isArray(m.written) ? m.written.slice(0, 4).map((w) => (typeof w === 'string' ? clean(w) : '')).filter(Boolean) : [];
      if (ids.length + written.length !== want) return { ok: false, error: `Play ${want} card${want > 1 ? 's' : ''}.` };
      if (written.length > (this.blanksLeft.get(p.id) || 0)) return { ok: false, error: 'No blank cards left.' };
      const cards = ids.map((id) => hand.find((c) => c.id === id));
      if (cards.some((c) => !c) || new Set(ids).size !== ids.length) return { ok: false, error: 'Those aren’t your cards.' };
      // Order: the phone sends the order the player chose (written cards go where the player put them).
      let texts = cards.map((c) => c.text).concat(written);
      const order = Array.isArray(m.order) && m.order.length === want && m.order.every((o) => o === 'w' || o === 'c') ? m.order : null;
      if (order && order.filter((o) => o === 'w').length === written.length) { const pool = { c: cards.map((c) => c.text), w: written.slice() }; texts = order.map((o) => pool[o].shift()); }
      this.hands.set(p.id, hand.filter((c) => !ids.includes(c.id)));
      if (written.length && this.s.blanks < 99) this.blanksLeft.set(p.id, this.blanksLeft.get(p.id) - written.length);
      this.subs.push({ sid: 's' + this.round + '_' + Math.floor(this.room.rng() * 1e9).toString(36), by: p.id, cards: texts, written: written.length > 0 });
      const st = this.stats.get(p.id); if (st) { st.plays++; st.playMs += this.room.now() - this.roundAt; }
      this.room.fx('card');
      this.maybeAllIn();
      return { ok: true };
    }
    if (m.op === 'pick') {
      if (this.phase !== 'choose') return { ok: false, error: 'Not yet.' };
      if (p.id !== this.judge) return { ok: false, error: 'Only the Judge picks.' };
      if (!this.subs.some((x) => x.sid === m.sid)) return { ok: false, error: 'Pick an answer.' };
      this.pickWinner(m.sid); return { ok: true };
    }
    if (m.op === 'vote' || m.op === 'heart') {
      if (this.phase !== 'choose') return { ok: false, error: 'Not now.' };
      if (m.op === 'vote' && this.judge) return { ok: false, error: 'The Judge picks this round. Send a ❤️ instead!' };
      if (m.op === 'heart' && !this.judge) return { ok: false, error: 'Everyone votes this round.' };
      if (p.id === this.judge) return { ok: false, error: 'You’re the Judge: pick a winner!' };
      const s = this.subs.find((x) => x.sid === m.sid); if (!s) return { ok: false, error: 'Pick an answer.' };
      if (s.by === p.id) return { ok: false, error: 'You can’t vote for your own answer!' };
      if (m.op === 'heart') { this.hearts.set(p.id, s.sid); return { ok: true }; }
      this.votes.set(p.id, s.sid); this.maybeAllVoted(); return { ok: true };
    }
    if (m.op === 'swap') { // trade your whole hand once per game for a fresh one
      if (this.phase !== 'pick') return { ok: false, error: 'You can only swap while cards are being played.' };
      if (this.swapped.has(p.id)) return { ok: false, error: 'You already swapped your hand this game.' };
      if (this.hasPlayed(p.id)) return { ok: false, error: 'You already played this round.' };
      this.swapped.add(p.id); this.hands.set(p.id, []); this.deal(p.id); return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }
  botPlay(p) {
    if (this.phase !== 'pick' || this.hasPlayed(p.id) || p.id === this.judge || !this.room.get(p.id)) return;
    const hand = this.hands.get(p.id) || [], want = this.prompt.pick;
    if ((this.blanksLeft.get(p.id) || 0) > 0 && this.room.rng() < 0.08) {
      const w = C.BOT_WRITES[Math.floor(this.room.rng() * C.BOT_WRITES.length)];
      return this.act(p, { op: 'play', cards: hand.slice(0, want - 1).map((c) => c.id), written: [w] });
    }
    this.act(p, { op: 'play', cards: this.shuffle(hand.slice()).slice(0, want).map((c) => c.id) });
  }

  standings() {
    return [...this.scores].filter(([id]) => this.room.get(id))
      .map(([id, pts]) => ({ id, ...this.who(id), points: pts, love: (this.stats.get(id) || {}).love || 0 }))
      .sort((a, b) => b.points - a.points || b.love - a.love);
  }
  // Best first, once the game is over (for the party scoreboard across games).
  results() { return this.standings().map((r) => r.id); }
  bestLine() { return this.reel.slice().sort((a, b) => b.love - a.love || b.round - a.round)[0] || null; }
  tv() {
    const showSubs = this.phase === 'reveal' ? this.subs.slice(0, this.shown) : this.phase === 'choose' ? this.subs : [];
    const pl = this.phase === 'pick' ? this.players() : [];
    const voters = this.phase === 'choose' && !this.judge ? this.voters() : [];
    return {
      phase: this.phase, round: this.round, rounds: this.limit(), toWin: this.s.toWin, mode: this.rmode, endsIn: this.endsIn(), hurry: this.hurried && this.phase === 'pick',
      prompt: this.prompt, judge: this.judge ? this.who(this.judge) : null,
      played: this.subs.length, of: this.phase === 'pick' ? pl.length : this.subs.length,
      table: pl.slice(0, 40).map((p) => ({ ...this.who(p.id), done: this.hasPlayed(p.id) })), tableMore: Math.max(0, pl.length - 40),
      answers: showSubs.slice(0, 40).map((s) => ({ sid: s.sid, cards: s.cards })), total: this.subs.length,
      voted: this.judge ? this.hearts.size : this.votes.size, voters: voters.length,
      notVoted: voters.filter((p) => !this.votes.has(p.id)).slice(0, 24).map((p) => this.who(p.id).name),
      last: this.phase === 'win' ? this.last : null, standings: this.standings().slice(0, this.phase === 'over' ? 10 : 12),
      awards: this.awards, reel: this.phase === 'over' ? this.reel.slice(-8) : null, best: this.phase === 'over' ? this.bestLine() : null,
    };
  }
  view(p) {
    const st = this.standings(), mine = this.subs.find((s) => s.by === p.id);
    const res = this.phase === 'win' && this.last && this.last.all && mine ? this.last.all.find((a) => a.sid === mine.sid) || null : null;
    const pl = this.phase === 'pick' ? this.players() : [];
    return {
      phase: this.phase, round: this.round, rounds: this.limit(), toWin: this.s.toWin, mode: this.rmode, endsIn: this.endsIn(), hurry: this.hurried && this.phase === 'pick',
      prompt: this.prompt, isJudge: this.judge === p.id, judge: this.judge ? this.room.name(this.judge) : null,
      hand: this.hands.get(p.id) || [], blanks: this.s.blanks >= 99 ? 99 : this.blanksLeft.get(p.id) || 0, played: !!mine, mine: mine ? mine.cards : null, canSwap: !this.swapped.has(p.id),
      progress: { done: this.subs.length, of: pl.length || this.subs.length },
      answers: this.phase === 'choose' ? this.subs.map((s) => ({ sid: s.sid, cards: s.cards, mine: s.by === p.id })) : [],
      myVote: this.votes.get(p.id) || null, myHeart: this.hearts.get(p.id) || null,
      last: this.phase === 'win' ? this.last : null, myResult: res ? { win: res.win, votes: res.votes, hearts: res.hearts } : null,
      points: this.scores.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length,
      final: this.phase === 'over' ? st.slice(0, 10) : null,
      awards: this.phase === 'over' ? (this.awards || []).filter((a) => a.id === p.id).map((a) => ({ icon: a.icon, title: a.title, value: a.value })) : null,
      stats: this.phase === 'over' ? { wins: (this.stats.get(p.id) || {}).wins || 0, love: (this.stats.get(p.id) || {}).love || 0, written: (this.stats.get(p.id) || {}).written || 0 } : null,
      myBest: this.phase === 'over' ? this.reel.filter((r) => r.name === this.room.name(p.id)).slice(-1)[0] || null : null,
    };
  }
}

module.exports = {
  key: 'blanks', name: 'JustBlanks', min: 3, fields, defaults,
  create: (room, settings) => new Blanks(room, settings),
};
