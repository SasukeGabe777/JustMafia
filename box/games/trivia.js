'use strict';
// Hot Take Trivia: fast multiple-choice trivia where you bet on how sure you are.
// Each question has four answers. On your phone you pick a confidence bet (1× hunch, 2× pretty
// sure, 3× HOT TAKE) and tap an answer. Right: 100 × bet, plus a speed bonus (up to +50) and a
// streak bonus (+50 from three in a row). Wrong: −50 × bet (never below zero; the Family setting
// makes wrong answers free). Midway there's a HOT SEAT: one player answers for double stakes while
// everyone else bets on whether they'll get it right. The last question is ALL IN: you see the
// category, wager any share of your points (players under 100 can wager up to 100), then answer.
// Categories rotate. Awards at the end: Big Better, Coward, Comeback, On Fire, Speed Demon…
const { CATEGORIES, Q } = require('./trivia-questions');

const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
const GROUPS = {
  all: CATEGORIES.map((c) => c.key),
  brainy: ['general', 'science', 'geography', 'history'],
  fun: ['food', 'animals', 'pop', 'sports', 'weird'],
};
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'questions', label: 'Questions', options: opt([[8, '8 questions'], [12, '12 questions'], [16, '16 questions']]) },
  { key: 'seconds', label: 'Answer timer', options: opt([[10, '10 seconds'], [15, '15 seconds'], [20, '20 seconds']]) },
  { key: 'cats', label: 'Categories', options: opt([['all', 'Everything (rotating)'], ['brainy', 'Brainy (science, history, places…)'], ['fun', 'Fun (food, animals, pop culture…)'], ...CATEGORIES.map((c) => [c.key, `${c.icon} ${c.label} only`])]) },
  { key: 'family', label: 'Family friendly', options: opt([[false, 'Off: full difficulty'], [true, 'On: easier, no point losses']]) },
];
const defaults = { questions: 12, seconds: 15, cats: 'all', family: false };

const INTRO_MS = 3000, HOT_INTRO_MS = 5000, ALLIN_INTRO_MS = 4500, WAGER_MS = 15000, DRUM_MS = 1800, REVEAL_MS = 8000, FINAL_REVEAL_MS = 9000, END_EARLY_MS = 900;
const BASE = 100, LOSS = 50, SPEED_MAX = 50, STREAK_AT = 3, STREAK_BONUS = 50, HOT_MULT = 2, PRED_WIN = 50, PRED_LOSS = 25, ALLIN_FLOOR = 100;
const BETS = [1, 2, 3];
// Hot Seat question numbers for each game length.
const hotSeats = (total) => (total >= 16 ? [6, 11] : total >= 12 ? [7] : total >= 6 ? [Math.ceil(total / 2) + 1] : []);
// Questions asked recently in this room (so "Play again" brings new ones).
const recent = new WeakMap();

class Trivia {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'intro'; this.n = 0; this.r = null; this.endsAt = 0; this.timer = null;
    this.scores = new Map(); this.stats = new Map(); this.bot = new Map();
    this.decks = {}; this.catOrder = this.shuffle((GROUPS[this.s.cats] || (CAT[this.s.cats] ? [this.s.cats] : GROUPS.all)).slice());
    this.halfRank = null; this.seated = new Map();
  }
  get total() { return Number(this.s.questions) || 12; }
  get secs() { return Number(this.s.seconds) || 15; }
  get family() { return this.s.family === true || this.s.family === 'true'; }
  shuffle(a) { const r = this.room.rng; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  seat(p) {
    if (this.scores.has(p.id)) return;
    this.scores.set(p.id, 0);
    this.stats.set(p.id, { answered: 0, correct: 0, betSum: 0, ones: 0, threes: 0, streak: 0, best: 0, fastSum: 0, burned: 0, preds: 0, predRight: 0, hotTakesRight: 0 });
    const r = this.room.rng;
    if (p.bot) this.bot.set(p.id, { skill: 0.35 + r() * 0.5, style: r() < 0.2 ? 'shy' : r() < 0.25 ? 'bold' : 'normal' });
  }
  start() { for (const p of this.room.list()) this.seat(p); this.nextRound(); }
  joined(p) { this.seat(p); } // plays from the next question
  left(p) {
    const r = this.r; if (!r) return;
    r.ids = r.ids.filter((id) => id !== p.id);
    if (r.seat === p.id) {
      if (this.phase === 'intro') { r.seat = r.ids.length >= 2 ? this.pickSeat(r.ids) : null; if (!r.seat) r.kind = 'normal'; }
      else if (this.phase === 'ask') { this.close(); return; }
    }
    this.maybeDone();
  }

  // ---- questions ----
  kindOf(n, players) { if (n === this.total) return 'allin'; return players >= 2 && hotSeats(this.total).includes(n) ? 'hot' : 'normal'; }
  draw(cat, want) {
    const seen = recent.get(this.room) || new Set(); recent.set(this.room, seen);
    if (!this.decks[cat] || !this.decks[cat].length) {
      let pool = Q[cat].map((row, i) => ({ row, id: cat + ':' + i })).filter((x) => !this.family || x.row[0] < 3);
      const fresh = pool.filter((x) => !seen.has(x.id));
      if (fresh.length >= 4) pool = fresh; else for (const x of pool) seen.delete(x.id);
      this.decks[cat] = this.shuffle(pool);
    }
    const d = this.decks[cat];
    let i = d.findIndex((x) => want(x.row[0])); if (i < 0) i = d.length - 1;
    const { row, id } = d.splice(i, 1)[0];
    seen.add(id); if (seen.size > 200) seen.delete(seen.values().next().value);
    const [diff, text, right, ...wrong] = row;
    const answers = this.shuffle([right, ...wrong]);
    return { id, diff, text, answers, correct: answers.indexOf(right) };
  }
  pickSeat(ids) {
    const fewest = Math.min(...ids.map((id) => this.seated.get(id) || 0));
    let pool = ids.filter((id) => (this.seated.get(id) || 0) === fewest);
    const humans = pool.filter((id) => !this.room.get(id).bot);
    if (humans.length) pool = humans; // put real people on the spot
    const id = pool[Math.floor(this.room.rng() * pool.length)];
    this.seated.set(id, (this.seated.get(id) || 0) + 1);
    return id;
  }

  nextRound() {
    if (this.n >= this.total) return this.finish();
    this.n++;
    const ids = this.room.list().map((p) => p.id).filter((id) => this.scores.has(id));
    const kind = this.kindOf(this.n, ids.length);
    const cat = this.catOrder[(this.n - 1) % this.catOrder.length];
    if (this.catOrder.length > 1 && (this.n % this.catOrder.length) === 0) { const last = this.catOrder[this.catOrder.length - 1]; this.shuffle(this.catOrder); if (this.catOrder[0] === last) this.catOrder.push(this.catOrder.shift()); }
    const want = kind === 'allin' ? (d) => d >= (this.family ? 1 : 2) : kind === 'hot' ? (d) => d <= 2 : () => true;
    this.r = { n: this.n, kind, cat, q: this.draw(cat, want), ids, seat: kind === 'hot' ? this.pickSeat(ids) : null, answers: new Map(), preds: new Map(), wagers: new Map(), stakes: new Map(), openedAt: 0, result: null, gained: new Map() };
    this.phase = 'intro';
    this.room.fx(kind === 'allin' ? 'allin' : kind === 'hot' ? 'hot' : 'question', { kind });
    this.setTimer(kind === 'hot' ? HOT_INTRO_MS : kind === 'allin' ? ALLIN_INTRO_MS : INTRO_MS, () => (kind === 'allin' ? this.openWager() : this.openAsk()));
  }
  openWager() {
    if (this.phase !== 'intro') return;
    this.phase = 'wager'; this.room.fx('wager');
    this.setTimer(WAGER_MS, () => this.openAsk());
    for (const id of this.r.ids) { const p = this.room.get(id); if (p && p.bot) this.room.after(1500 + this.room.rng() * (WAGER_MS * 0.5), () => this.botWager(p, this.r.n)); }
  }
  openAsk() {
    if (this.phase !== 'intro' && this.phase !== 'wager') return;
    const r = this.r;
    if (r.kind === 'allin') for (const id of r.ids) r.stakes.set(id, Math.round(((r.wagers.get(id) || 0) / 100) * this.stakeBase(id)));
    this.phase = 'ask'; r.openedAt = this.room.now(); this.room.fx('open');
    this.setTimer(this.secs * 1000, () => this.close());
    const span = this.secs * 1000 * 0.75;
    for (const id of r.ids) { const p = this.room.get(id); if (p && p.bot) this.room.after(1000 + this.room.rng() * span, () => this.botMove(p, r.n)); }
  }
  stakeBase(id) { return Math.max(this.scores.get(id) || 0, ALLIN_FLOOR); }
  // Everyone who has to act this phase has acted: end it a moment early.
  maybeDone() {
    const r = this.r; if (!r) return;
    const here = r.ids.filter((id) => this.room.get(id));
    let done = false;
    if (this.phase === 'wager') done = here.length > 0 && here.every((id) => r.wagers.has(id));
    else if (this.phase === 'ask') done = here.length > 0 && here.every((id) => (r.kind === 'hot' ? (id === r.seat ? r.answers.has(id) : r.preds.has(id)) : r.answers.has(id)));
    if (!done) return;
    this.room.fx('allIn');
    const ph = this.phase, n = r.n;
    this.room.cancel(this.timer); this.endsAt = this.room.now() + END_EARLY_MS;
    this.timer = this.room.after(END_EARLY_MS, () => { if (this.phase === ph && this.r.n === n) (ph === 'wager' ? this.openAsk() : this.close()); });
  }

  // ---- phone input (all validated) ----
  act(p, m) {
    const r = this.r;
    if (!m || typeof m !== 'object') return { ok: false, error: 'Unknown move.' };
    if (!['answer', 'predict', 'wager'].includes(m.op)) return { ok: false, error: 'Unknown move.' };
    if (!r || !this.scores.has(p.id) || !r.ids.includes(p.id)) return { ok: false, error: 'You’re in from the next question!' };
    if (m.op === 'wager') {
      if (this.phase !== 'wager') return { ok: false, error: 'Wagers aren’t open right now.' };
      const pct = m.pct;
      if (typeof pct !== 'number' || !Number.isInteger(pct) || pct < 0 || pct > 100) return { ok: false, error: 'Wager 0 to 100%.' };
      r.wagers.set(p.id, pct); this.maybeDone(); return { ok: true };
    }
    if (this.phase !== 'ask') return { ok: false, error: 'Answers aren’t open right now.' };
    const bet = r.kind === 'allin' ? 1 : m.bet;
    if (typeof bet !== 'number' || !BETS.includes(bet)) return { ok: false, error: 'Pick a bet: 1×, 2× or 3×.' };
    if (m.op === 'predict') {
      if (r.kind !== 'hot' || p.id === r.seat) return { ok: false, error: 'No predictions this question.' };
      if (typeof m.right !== 'boolean') return { ok: false, error: 'Tap RIGHT or WRONG.' };
      if (r.preds.has(p.id)) return { ok: false, error: 'Your prediction is locked in!' };
      r.preds.set(p.id, { right: m.right, bet }); this.maybeDone(); return { ok: true };
    }
    if (r.kind === 'hot' && p.id !== r.seat) return { ok: false, error: 'Only the Hot Seat answers this one. Predict instead!' };
    const a = m.a;
    if (typeof a !== 'number' || !Number.isInteger(a) || a < 0 || a > 3) return { ok: false, error: 'Pick one of the four answers.' };
    if (r.answers.has(p.id)) return { ok: false, error: 'You’re already locked in!' };
    r.answers.set(p.id, { a, bet, ms: this.room.now() - r.openedAt });
    this.maybeDone();
    return { ok: true };
  }

  // ---- bots ----
  botKnows(p) {
    const b = this.bot.get(p.id) || { skill: 0.5 }, d = this.r.q.diff;
    return this.room.rng() < Math.min(0.95, Math.max(0.1, b.skill + (2 - d) * 0.14));
  }
  botBet(p, sure) {
    const b = this.bot.get(p.id) || { style: 'normal' }, x = this.room.rng();
    if (b.style === 'shy') return 1;
    if (b.style === 'bold') return sure ? 3 : x < 0.6 ? 2 : 3;
    return sure ? (x < 0.5 ? 3 : 2) : x < 0.7 ? 1 : 2;
  }
  botMove(p, n) {
    const r = this.r;
    if (this.phase !== 'ask' || !r || r.n !== n || !this.room.get(p.id)) return;
    if (r.kind === 'hot' && p.id !== r.seat) {
      const sb = this.bot.get(r.seat), lean = sb ? sb.skill : 0.6;
      const guess = this.room.rng() < 0.7 ? this.room.rng() < lean + 0.1 : this.room.rng() < 0.5;
      this.act(p, { op: 'predict', right: guess, bet: BETS[Math.floor(this.room.rng() * 3)] });
      return;
    }
    const knows = this.botKnows(p);
    const wrong = [0, 1, 2, 3].filter((i) => i !== r.q.correct);
    const a = knows ? r.q.correct : wrong[Math.floor(this.room.rng() * 3)];
    const sure = knows ? this.room.rng() < 0.75 : this.room.rng() < 0.2;
    this.act(p, { op: 'answer', a, bet: this.botBet(p, sure) });
  }
  botWager(p, n) {
    if (this.phase !== 'wager' || !this.r || this.r.n !== n || !this.room.get(p.id)) return;
    const b = this.bot.get(p.id) || { style: 'normal' };
    const pct = b.style === 'bold' ? 100 : b.style === 'shy' ? 10 : [25, 50, 50, 75, 100][Math.floor(this.room.rng() * 5)];
    this.act(p, { op: 'wager', pct });
  }

  // ---- scoring ----
  add(id, pts) {
    if (!this.scores.has(id)) return 0;
    const before = this.scores.get(id), after = Math.max(0, before + pts);
    this.scores.set(id, after);
    const g = after - before; this.r.gained.set(id, (this.r.gained.get(id) || 0) + g);
    return g;
  }
  close() {
    if (this.phase !== 'ask') return;
    const r = this.r, q = r.q, fam = this.family, rows = [];
    let fastest = null;
    const answerers = r.kind === 'hot' ? [r.seat] : r.ids;
    for (const id of answerers) {
      if (!this.room.get(id) || !this.scores.has(id)) continue;
      const st = this.stats.get(id), ans = r.answers.get(id);
      if (r.kind === 'allin') {
        const stake = r.stakes.get(id) || 0, right = !!ans && ans.a === q.correct;
        if (right) { st.correct++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0;
        const g = this.add(id, right ? stake : -stake);
        rows.push({ id, a: ans ? ans.a : null, bet: 1, right, gained: g, stake, pct: r.wagers.get(id) || 0, streak: st.streak });
        continue;
      }
      if (!ans) { st.streak = 0; rows.push({ id, a: null, bet: 0, right: false, gained: 0, streak: 0 }); continue; }
      const right = ans.a === q.correct, mult = id === r.seat ? HOT_MULT : 1;
      st.answered++; st.betSum += ans.bet; if (ans.bet === 1) st.ones++; if (ans.bet === 3) st.threes++;
      let pts, speed = 0, streakBonus = 0;
      if (right) {
        st.correct++; st.streak++; st.best = Math.max(st.best, st.streak); st.fastSum += ans.ms;
        if (ans.bet === 3) st.hotTakesRight++;
        speed = Math.round(SPEED_MAX * Math.max(0, 1 - ans.ms / (this.secs * 1000)));
        streakBonus = st.streak >= STREAK_AT ? STREAK_BONUS : 0;
        pts = (BASE * ans.bet + speed + streakBonus) * mult;
        if (!fastest || ans.ms < fastest.ms) fastest = { id, ms: ans.ms };
      } else {
        st.streak = 0;
        pts = fam ? 0 : -LOSS * ans.bet * mult;
      }
      const g = this.add(id, pts);
      if (!right && ans.bet === 3) st.burned += -g;
      rows.push({ id, a: ans.a, bet: ans.bet, right, gained: g, speed, streakBonus, streak: st.streak, ms: ans.ms, seat: id === r.seat });
    }
    let hot = null;
    if (r.kind === 'hot') {
      const sa = r.answers.get(r.seat), seatRight = !!sa && sa.a === q.correct;
      const preds = [];
      for (const [id, pr] of r.preds) {
        if (!this.room.get(id)) continue;
        const ok = pr.right === seatRight, st = this.stats.get(id); st.preds++; if (ok) st.predRight++;
        const g = this.add(id, ok ? PRED_WIN * pr.bet : fam ? 0 : -PRED_LOSS * pr.bet);
        preds.push({ id, right: pr.right, bet: pr.bet, ok, gained: g });
      }
      for (const id of r.ids) if (id !== r.seat && !r.preds.has(id) && this.room.get(id)) preds.push({ id, right: null, bet: 0, ok: false, gained: 0 });
      hot = { seatRight, answered: !!sa, preds };
    }
    r.result = { rows, hot, fastest };
    this.phase = 'drum'; this.room.fx('lock');
    this.setTimer(DRUM_MS, () => this.reveal());
  }
  reveal() {
    if (this.phase !== 'drum') return;
    this.phase = 'reveal';
    const res = this.r.result, rights = res.rows.filter((x) => x.right).length;
    this.room.fx(this.r.kind === 'hot' ? (res.hot.seatRight ? 'seatRight' : 'seatWrong') : rights ? 'reveal' : 'nobody');
    if (this.n === Math.ceil(this.total / 2)) this.halfRank = new Map(this.standings().map((x, i) => [x.id, i + 1]));
    this.setTimer(this.n >= this.total ? FINAL_REVEAL_MS : REVEAL_MS, () => this.nextRound());
  }
  finish() { this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.timer = null; this.room.fx('win'); }
  next() {
    if (this.phase === 'intro') { this.room.cancel(this.timer); if (this.r.kind === 'allin') this.openWager(); else this.openAsk(); }
    else if (this.phase === 'wager') this.openAsk();
    else if (this.phase === 'ask') this.close();
    else if (this.phase === 'drum') this.reveal();
    else if (this.phase === 'reveal') this.nextRound();
  }

  // ---- public / private state ----
  pub(id) { const p = this.room.get(id); return p ? { name: p.name, avatar: p.avatar || null, color: p.color || '#ffd23f' } : { name: '—', avatar: null, color: '#888' }; }
  standings() {
    return [...this.scores].filter(([id]) => this.room.get(id))
      .map(([id, pts]) => ({ id, ...this.pub(id), points: pts, streak: this.stats.get(id).streak, correct: this.stats.get(id).correct }))
      .sort((a, b) => b.points - a.points || b.correct - a.correct);
  }
  // Player ids best-first once the game is over (for the party scoreboard across games).
  results() { return this.phase === 'over' ? this.standings().map((x) => x.id) : []; }
  awards() {
    const st = this.standings(), S = (id) => this.stats.get(id);
    const best = (fn, min = 1, low = false) => {
      let top = null, who = [];
      for (const x of st) {
        const v = fn(x.id); if (v == null || v < min) continue;
        if (top === null || (low ? v < top : v > top)) { top = v; who = [x.name]; } else if (v === top) who.push(x.name);
      }
      return top === null ? null : { names: who.slice(0, 4), more: Math.max(0, who.length - 4), value: top };
    };
    const out = [];
    const push = (k, a, fmt) => { if (a) out.push({ k, names: a.names, more: a.more || 0, text: fmt(a.value) }); };
    push('better', best((id) => (S(id).answered >= 3 ? Math.round((S(id).betSum / S(id).answered) * 10) / 10 : null), 2), (v) => `average bet ${v}×`);
    const cowards = st.filter((x) => S(x.id).answered >= 3 && S(x.id).ones === S(x.id).answered).map((x) => x.name);
    if (cowards.length) out.push({ k: 'coward', names: cowards.slice(0, 4), more: Math.max(0, cowards.length - 4), text: 'played 1× every single time' });
    if (this.halfRank && st.length >= 3) push('comeback', best((id) => (this.halfRank.has(id) ? this.halfRank.get(id) - (st.findIndex((x) => x.id === id) + 1) : null), 1), (v) => `climbed ${v} place${v === 1 ? '' : 's'} in the second half`);
    push('fire', best((id) => S(id).best, STREAK_AT), (v) => `${v} right in a row`);
    push('speed', best((id) => (S(id).correct >= 2 ? Math.round(S(id).fastSum / S(id).correct / 100) / 10 : null), 0, true), (v) => `${v}s average on right answers`);
    push('brain', best((id) => S(id).correct, 1), (v) => `${v} right answer${v === 1 ? '' : 's'}`);
    push('hot', best((id) => S(id).hotTakesRight, 2), (v) => `${v} hot takes (3×) that paid off`);
    push('burned', best((id) => S(id).burned, 1), (v) => `lost ${v} points on 3× bets`);
    push('oracle', best((id) => S(id).predRight, 1), (v) => `${v} Hot Seat call${v === 1 ? '' : 's'} right`);
    return out;
  }
  common() {
    const r = this.r, show = r && this.phase !== 'intro' && this.phase !== 'wager';
    return {
      phase: this.phase, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, seconds: this.secs,
      n: this.n, total: this.total, kind: r ? r.kind : null, family: this.family,
      cat: r ? CAT[r.cat] : null, diff: r ? r.q.diff : 0,
      text: show ? r.q.text : '', answers: show ? r.q.answers : null,
      correct: r && (this.phase === 'reveal' || this.phase === 'over') ? r.q.correct : null,
      seat: r && r.seat ? this.pub(r.seat) : null,
    };
  }
  publicResult() {
    const r = this.r;
    if (!r || !r.result || (this.phase !== 'reveal' && this.phase !== 'over')) return null;
    const res = r.result;
    const picks = [[], [], [], []];
    for (const x of res.rows) if (x.a != null) picks[x.a].push({ ...this.pub(x.id), bet: x.bet, stake: x.stake });
    return {
      picks: picks.map((l) => l.slice(0, 14)), more: picks.map((l) => Math.max(0, l.length - 14)),
      rows: res.rows.filter((x) => this.room.get(x.id)).sort((a, b) => b.gained - a.gained).slice(0, 16)
        .map((x) => ({ ...this.pub(x.id), a: x.a, bet: x.bet, right: x.right, gained: x.gained, speed: x.speed || 0, streak: x.streak, streakBonus: x.streakBonus || 0, stake: x.stake, pct: x.pct, seat: !!x.seat })),
      rights: res.rows.filter((x) => x.right).length, answered: res.rows.filter((x) => x.a != null).length,
      fastest: res.fastest && this.room.get(res.fastest.id) ? { ...this.pub(res.fastest.id), s: Math.round(res.fastest.ms / 100) / 10 } : null,
      hot: res.hot ? { seatRight: res.hot.seatRight, answered: res.hot.answered, preds: res.hot.preds.filter((x) => this.room.get(x.id)).slice(0, 20).map((x) => ({ ...this.pub(x.id), right: x.right, bet: x.bet, ok: x.ok, gained: x.gained })), yes: res.hot.preds.filter((x) => x.right === true).length, no: res.hot.preds.filter((x) => x.right === false).length } : null,
    };
  }
  tv() {
    const r = this.r, here = r ? r.ids.filter((id) => this.room.get(id)) : [];
    const acted = (id) => (this.phase === 'wager' ? r.wagers.has(id) : r.kind === 'hot' ? (id === r.seat ? r.answers.has(id) : r.preds.has(id)) : r.answers.has(id));
    const live = r && (this.phase === 'ask' || this.phase === 'wager');
    return {
      ...this.common(),
      locked: live ? here.filter(acted).length : 0, of: here.length,
      roster: live && here.length <= 24 ? here.map((id) => ({ ...this.pub(id), in: acted(id), seat: id === r.seat })) : null,
      result: this.publicResult(),
      standings: this.standings().slice(0, 10).map(({ id, ...x }) => x),
      final: this.phase === 'over' ? { awards: this.awards(), standings: this.standings().slice(0, 12).map(({ id, ...x }) => x) } : null,
    };
  }
  view(p) {
    const r = this.r, st = this.standings(), inRound = !!(r && r.ids.includes(p.id));
    const res = r && r.result && (this.phase === 'reveal' || this.phase === 'over') ? r.result : null;
    let mine = null;
    if (res && inRound) {
      const row = res.rows.find((x) => x.id === p.id), pr = res.hot && res.hot.preds.find((x) => x.id === p.id);
      mine = row ? { kind: 'answer', a: row.a, bet: row.bet, right: row.right, gained: row.gained, speed: row.speed || 0, streakBonus: row.streakBonus || 0, stake: row.stake, streak: row.streak }
        : pr ? { kind: 'pred', guess: pr.right, bet: pr.bet, ok: pr.ok, gained: pr.gained, seatRight: res.hot.seatRight } : null;
    }
    const s = this.stats.get(p.id);
    return {
      ...this.common(), myName: p.name, inRound, isSeat: !!(r && r.seat === p.id),
      myAnswer: r && r.answers.has(p.id) ? { a: r.answers.get(p.id).a, bet: r.answers.get(p.id).bet } : null,
      myPred: r && r.preds.has(p.id) ? r.preds.get(p.id) : null,
      myWager: r && r.wagers.has(p.id) ? r.wagers.get(p.id) : null, stakeBase: this.stakeBase(p.id), myStake: r && r.stakes.has(p.id) ? r.stakes.get(p.id) : null,
      mine, points: this.scores.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length, streak: s ? s.streak : 0,
      final: this.phase === 'over' ? { awards: this.awards(), standings: st.slice(0, 10).map(({ id, ...x }) => x) } : null,
    };
  }
}

module.exports = {
  key: 'trivia', name: 'Hot Take Trivia', min: 2, best: [2, 16], howSteps: 6, fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/trivia.js)
  locked: { how: 'Finish a game of Price Panic to unlock it.' }, // public/unlocks.js + UNLOCK_RULES in box/room.js
  create: (room, settings) => new Trivia(room, settings),
  _test: { CATEGORIES, Q, hotSeats, BASE, LOSS, SPEED_MAX, STREAK_BONUS, HOT_MULT, PRED_WIN, PRED_LOSS, ALLIN_FLOOR },
};
