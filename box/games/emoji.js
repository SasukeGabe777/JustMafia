'use strict';
// Emoji Charades: each round a Clue Giver secretly picks an answer on their phone and spells it
// out with emojis only, tapped one by one onto the big screen. Everyone else races to type the
// answer. First right answer scores the most, fewer emojis score more, and the giver earns points
// for every person who gets it. Big rooms run 2-3 givers at once on separate "stages".
// The final round counts DOUBLE (a comeback chance), and the host can keep answers family-friendly.
const { CATEGORIES, ANSWERS, KEYBOARD, ALLOWED, SEPARATOR } = require('./emoji-content');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'seconds', label: 'Time to guess', options: opt([[60, '60 seconds'], [90, '90 seconds'], [120, '2 minutes']]) },
  { key: 'turns', label: 'Clues per player', options: opt([[1, '1 each'], [2, '2 each'], [3, '3 each']]) },
  { key: 'maxRounds', label: 'Most rounds', options: opt([[5, '5 rounds'], [8, '8 rounds'], [12, '12 rounds'], [20, '20 rounds']]) },
  { key: 'stages', label: 'Clue givers at once', options: opt([['auto', 'Auto (more in big groups)'], [1, '1 giver'], [2, '2 givers'], [3, '3 givers']]) },
  { key: 'category', label: 'Categories', options: opt([['all', 'All categories'], ...CATEGORIES.map((c) => [c.key, c.icon + ' ' + c.label])]) },
  { key: 'difficulty', label: 'Difficulty', options: opt([['mix', 'Mixed'], ['easy', 'Easy ★'], ['medium', 'Easy & medium'], ['hard', 'Medium & hard']]) },
  { key: 'family', label: 'Answers', options: opt([[false, 'Everything'], [true, 'Family-friendly only']]) },
  { key: 'ticker', label: 'Show wrong guesses on TV', options: opt([[true, 'Yes (anonymous)'], [false, 'No']]) },
];
const defaults = { seconds: 90, turns: 1, maxRounds: 8, stages: 'auto', category: 'all', difficulty: 'mix', family: false, ticker: true };
const FINAL_MULT = 2;

const PICK_SECONDS = 15, REVEAL_SECONDS = 9, MAX_CLUE = 20, MAX_GUESS = 40, GUESS_GAP = 900, HINT_COST = 75;
const HINT1 = 0.4, HINT2 = 0.7; // hints appear at these fractions of the round
const GUESS_BASE = [500, 400, 340, 290, 250, 220, 200, 180, 160, 150];
const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.key, c]));
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const SILLY = ['banana?', 'a duck wearing a hat', 'my ex', 'taxes', 'is it soup', 'Shrek 2', 'pineapple', 'the moon', 'grandma', 'a very small horse', 'nachos', 'jazz hands', 'my homework', 'Tuesday', 'cheese', 'a haunted toaster', 'dinosaur', 'love', 'pizza party', 'no idea lol', 'the Titanic', 'a sad clown', 'space', 'karate'];

// ---------- Forgiving answer matching ----------
const ARTICLES = new Set(['the', 'a', 'an']);
function words(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter((w) => w && !ARTICLES.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w)); // forgive plurals
}
function lev(a, b, cap = 9) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
    if (best > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}
const allowedTypos = (len) => (len <= 4 ? 0 : len <= 8 ? 1 : 2);
// 'correct' | 'close' | 'wrong' for a guess against an answer (and its alternates).
function judge(guess, answer, alts = []) {
  const gw = words(guess), g = gw.join('');
  if (!g) return 'wrong';
  let close = false;
  for (const target of [answer, ...alts]) {
    const tw = words(target), t = tw.join('');
    if (!t) continue;
    const d = lev(g, t, 6);
    if (d <= allowedTypos(t.length)) return 'correct';
    if (t.length >= 4 && d <= allowedTypos(t.length) + 2) close = true;
    // part of a multi-word answer ("lion" for The Lion King) or most of it
    if (tw.length > 1 && gw.some((w) => w.length >= 3 && tw.some((x) => x.length >= 3 && lev(w, x, 2) <= allowedTypos(x.length)))) close = true;
    if (g.length >= 4 && t.includes(g) && g.length >= t.length / 2) close = true;
  }
  return close ? 'close' : 'wrong';
}
// The answer's shape: "______ ___" (hint 1), then first letters "S_____ M__" (hint 2).
function pattern(text, level) {
  if (level <= 0) return null;
  return String(text).split(' ').map((w) => { let first = true; return [...w].map((ch) => { if (!/[a-z0-9]/i.test(ch.normalize('NFD').replace(/[̀-ͯ]/g, ''))) { first = ch !== "'" && ch !== '’'; return ch; } if (first) { first = false; if (level >= 2) return ch.toUpperCase(); } return '_'; }).join(''); });
}

class EmojiCharades {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'pick'; this.round = 0; this.totalRounds = 0;
    this.scores = new Map(); this.stats = new Map(); this.given = new Map();
    this.stages = []; this.ticker = []; this.tickSeq = 0; this.lastGuessAt = new Map(); this.myGuesses = new Map();
    this.used = new Set(); this.timer = null; this.hintTimers = []; this.endsAt = 0; this.clueStart = 0; this.roundPts = new Map(); this.history = []; this.awards = null;
  }
  rnd(n) { return Math.floor(this.room.rng() * n); }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = this.rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  seat(p) {
    if (!this.scores.has(p.id)) this.scores.set(p.id, 0);
    if (!this.stats.has(p.id)) this.stats.set(p.id, { solved: 0, fastest: null, totalMs: 0, giverPts: 0, cluesSolved: 0, emojisOnSolved: 0 });
    if (!this.given.has(p.id)) this.given.set(p.id, 0);
  }
  add(id, pts) { this.scores.set(id, Math.max(0, (this.scores.get(id) || 0) + pts)); this.roundPts.set(id, (this.roundPts.get(id) || 0) + pts); }
  isFinal() { return this.totalRounds >= 3 && this.round === this.totalRounds; }
  mult() { return this.isFinal() ? FINAL_MULT : 1; }
  stageCount() {
    const n = this.room.players.size;
    const want = this.s.stages === 'auto' ? (n <= 8 ? 1 : n <= 24 ? 2 : 3) : Number(this.s.stages) || 1;
    return Math.max(1, Math.min(3, want, Math.floor(n / 3) || 1));
  }

  start() {
    for (const p of this.room.list()) this.seat(p);
    const n = this.room.players.size;
    this.totalRounds = Math.max(1, Math.min(Number(this.s.maxRounds) || 8, Math.ceil(n * (Number(this.s.turns) || 1) / this.stageCount())));
    this.nextRound();
  }
  joined(p) { this.seat(p); }
  left(p) {
    if (this.phase !== 'pick' && this.phase !== 'clue') return;
    const st = this.stages.find((x) => x.giver === p.id && !x.left);
    if (st) { st.left = true; this.room.fx('poof'); }
    if (this.stages.every((x) => x.left)) { this.room.cancel(this.timer); this.reveal(); return; }
    if (this.phase === 'pick' && this.stages.every((x) => x.left || x.answer)) this.beginClue();
    else if (this.phase === 'clue') this.maybeAllSolved();
  }

  // Answers allowed by the settings, not used yet this game.
  pool() {
    const d = this.s.difficulty, ok = (a) => (d === 'easy' ? a.diff === 1 : d === 'medium' ? a.diff <= 2 : d === 'hard' ? a.diff >= 2 : true);
    const fam = this.s.family === true || this.s.family === 'true' || !!(this.room && this.room.family); // the TV's room-wide Family Mode wins
    const inCat = ANSWERS.filter((a) => (this.s.category === 'all' || a.cat === this.s.category) && (!fam || a.family));
    let list = inCat.filter((a) => ok(a) && !this.used.has(a.id));
    if (list.length < 3) list = inCat.filter((a) => !this.used.has(a.id));
    if (list.length < 3) { for (const a of inCat) this.used.delete(a.id); list = inCat.filter(ok); }
    return list.length >= 3 ? list : inCat;
  }
  offer() {
    const list = this.shuffle(this.pool().slice()), out = [];
    for (const a of list) { if (out.length >= 3) break; if (this.s.category === 'all' && out.some((o) => o.cat === a.cat)) continue; out.push(a); }
    for (const a of list) { if (out.length >= 3) break; if (!out.includes(a)) out.push(a); }
    for (const a of out) this.used.add(a.id);
    return out;
  }

  nextRound() {
    this.room.cancel(this.timer); for (const h of this.hintTimers) this.room.cancel(h); this.hintTimers = [];
    if (this.round >= this.totalRounds) return this.finish();
    const turns = Number(this.s.turns) || 1;
    const order = this.room.list();
    const start = order.length ? this.round % order.length : 0;
    const rotated = order.slice(start).concat(order.slice(0, start));
    const cands = rotated.filter((p) => (this.given.get(p.id) || 0) < turns).sort((a, b) => (this.given.get(a.id) || 0) - (this.given.get(b.id) || 0));
    const k = Math.min(this.stageCount(), cands.length, Math.max(1, order.length - 1));
    if (!k || order.length < 2) return this.finish();
    this.round++; this.phase = 'pick'; this.ticker = []; this.roundPts = new Map(); this.myGuesses = new Map();
    this.stages = cands.slice(0, k).map((p, i) => {
      this.given.set(p.id, (this.given.get(p.id) || 0) + 1);
      return { id: 'r' + this.round + 's' + i, n: i + 1, giver: p.id, giverName: p.name, color: p.color, options: this.offer(), answer: null, clue: [], seq: 0, solvers: [], hint: 0, giverHints: 0, left: false, emojisAtFirst: 0 };
    });
    this.room.fx(this.isFinal() ? 'final' : 'shuffle');
    this.setTimer(PICK_SECONDS * 1000, () => this.beginClue());
    for (const st of this.stages) { const g = this.room.get(st.giver); if (g && g.bot) this.room.after(1500 + this.room.rng() * 3000, () => this.act(g, { op: 'pick', i: this.rnd(3) })); }
  }

  beginClue() {
    if (this.phase !== 'pick') return;
    for (const st of this.stages) if (!st.answer && !st.left) st.answer = st.options[this.rnd(st.options.length)];
    this.phase = 'clue'; this.clueStart = this.room.now();
    const dur = (Number(this.s.seconds) || 90) * 1000;
    this.setTimer(dur, () => this.reveal());
    this.room.fx('go');
    for (const [frac, lvl] of [[HINT1, 1], [HINT2, 2]]) this.hintTimers.push(this.room.after(dur * frac, () => { if (this.phase !== 'clue') return; let up = false; for (const st of this.stages) if (st.hint < lvl) { st.hint = lvl; up = true; } if (up) this.room.fx('hint'); }));
    this.botsPlay(dur);
  }
  botsPlay(dur) {
    const r = this.room.rng;
    // Bot givers tap their clue one emoji at a time.
    for (const st of this.stages) {
      const g = this.room.get(st.giver); if (!g || !g.bot || st.left) continue;
      const plan = this.botClue(st.answer);
      plan.forEach((e, i) => this.room.after(1200 + i * (900 + r() * 1300), () => { if (this.phase === 'clue' && !st.left) this.act(g, e === SEPARATOR ? { op: 'sep' } : { op: 'emoji', e }); }));
    }
    // Bot guessers: some silly wrong guesses, and maybe the right answer after a while.
    const givers = new Set(this.stages.map((s) => s.giver));
    for (const p of this.room.list()) {
      if (!p.bot || givers.has(p.id)) continue;
      const wrong = Math.floor(r() * 2.6);
      for (let i = 0; i < wrong; i++) this.room.after(4000 + r() * dur * 0.8, () => { if (this.phase === 'clue') this.act(p, { op: 'guess', text: SILLY[this.rnd(SILLY.length)] }); });
      for (const st of this.stages) {
        if (st.left || r() > [0, 0.8, 0.6, 0.4][st.answer.diff]) continue;
        const at = dur * (0.12 + r() * 0.75);
        const tryGuess = () => {
          if (this.phase !== 'clue' || st.left || st.solvers.some((x) => x.id === p.id)) return;
          if (!st.clue.length) { if (this.room.now() + 3000 < this.endsAt) this.room.after(3000, tryGuess); return; }
          let text = st.answer.text;
          if (r() < 0.3 && st.answer.alts.length) text = st.answer.alts[this.rnd(st.answer.alts.length)];
          else if (r() < 0.3 && text.length > 6) { const k = 1 + this.rnd(text.length - 2); text = (text.slice(0, k) + text.slice(k + 1)).toLowerCase(); } // a typo
          const res = this.act(p, { op: 'guess', text });
          if (res && !res.ok) this.room.after(1200, tryGuess); // rate-limited: try again shortly
        };
        this.room.after(at, tryGuess);
      }
    }
  }
  // A clue for a bot: the hand-written one, or emojis whose search words match the answer.
  botClue(a) {
    if (a.clue.length) return a.clue.slice(0, MAX_CLUE);
    const out = [];
    for (const w of words(a.text)) for (const list of Object.values(KEYBOARD)) { const k = list.find((x) => x.tags.includes(w)); if (k && !out.includes(k.e)) { out.push(k.e); break; } }
    if (!out.length) { const all = Object.values(KEYBOARD).flat(); for (let i = 0; i < 3; i++) out.push(all[this.rnd(all.length)].e); }
    return out;
  }

  emojiCount(st) { return st.clue.filter((c) => c.e !== SEPARATOR).length; }
  eligible() { const givers = new Set(this.stages.map((s) => s.giver)); return this.room.list().filter((p) => !givers.has(p.id)); }
  maybeAllSolved() {
    if (this.phase !== 'clue') return;
    const live = this.stages.filter((s) => !s.left && s.answer); if (!live.length) return;
    const el = this.eligible(); if (!el.length) return;
    if (live.every((st) => el.every((p) => st.solvers.some((x) => x.id === p.id)))) {
      this.room.cancel(this.timer); this.endsAt = this.room.now() + 1500; this.timer = this.room.after(1500, () => this.reveal());
    }
  }
  solve(st, p) {
    const order = st.solvers.length, ms = this.room.now() - this.clueStart, n = this.emojiCount(st);
    const base = order < GUESS_BASE.length ? GUESS_BASE[order] : Math.max(100, 150 - 5 * (order - GUESS_BASE.length + 1));
    const mult = n <= 3 ? 1.5 : n <= 5 ? 1.25 : n <= 8 ? 1 : 0.8;
    const pts = Math.round(base * mult * (1 - 0.15 * st.hint) / 10) * 10 * this.mult();
    st.solvers.push({ id: p.id, name: p.name, ms, pts });
    if (!order) st.emojisAtFirst = n;
    this.add(p.id, pts);
    const s = this.stats.get(p.id); if (s) { s.solved++; s.totalMs += ms; if (s.fastest == null || ms < s.fastest) s.fastest = ms; }
    if (order === 0) this.room.fx('first', { name: p.name, stage: st.n }); else if (order < 4) this.room.fx('correct');
    this.maybeAllSolved();
    return pts;
  }

  reveal() {
    if (this.phase !== 'clue' && this.phase !== 'pick') return;
    this.room.cancel(this.timer); for (const h of this.hintTimers) this.room.cancel(h); this.hintTimers = [];
    const dur = (Number(this.s.seconds) || 90) * 1000, el = Math.max(1, this.eligible().length);
    for (const st of this.stages) {
      if (!st.answer) st.answer = st.options[0];
      const k = st.solvers.length; st.giverPts = 0;
      if (k && !st.left) {
        const n = st.emojisAtFirst, mult = n <= 3 ? 1.5 : n <= 5 ? 1.25 : n <= 8 ? 1 : 0.8;
        let pts = 100 + 60 * Math.min(k, 5) + 15 * Math.max(0, k - 5);
        pts = Math.min(900, pts) * mult;
        if (st.solvers[0].ms <= dur * 0.25) pts += 150;
        if (k >= el) pts += 100;
        st.giverPts = Math.round(pts / 10) * 10 * this.mult();
        this.add(st.giver, st.giverPts);
        const s = this.stats.get(st.giver); if (s) { s.giverPts += st.giverPts; s.cluesSolved++; s.emojisOnSolved += n; }
      }
      this.history.push({ answer: st.answer.text, giver: st.giverName, clue: st.clue.map((c) => c.e).join(''), first: k ? st.solvers[0].name : null, solved: k });
    }
    this.phase = 'reveal';
    this.room.fx(this.stages.some((st) => st.solvers.length) ? 'reveal' : 'boo');
    this.setTimer(REVEAL_SECONDS * 1000, () => this.nextRound());
  }
  finish() {
    this.room.cancel(this.timer); this.phase = 'over'; this.endsAt = 0; this.stages = [];
    const live = [...this.stats].filter(([id]) => this.room.get(id)).map(([id, s]) => ({ id, name: this.room.name(id), ...s }));
    const best = (list, key, low = false) => list.slice().sort((a, b) => (low ? a[key] - b[key] : b[key] - a[key]))[0] || null;
    const master = best(live.filter((x) => x.giverPts > 0), 'giverPts');
    const quick = best(live.filter((x) => x.fastest != null), 'fastest', true);
    const breaker = best(live.filter((x) => x.solved > 0), 'solved');
    const mini = best(live.filter((x) => x.cluesSolved > 0).map((x) => ({ ...x, avg: x.emojisOnSolved / x.cluesSolved })), 'avg', true);
    this.awards = [
      master && { icon: '🎨', title: 'Emoji Master', name: master.name, detail: `${master.giverPts} pts as Clue Giver` },
      quick && { icon: '⚡', title: 'Quick Draw', name: quick.name, detail: `solved one in ${(quick.fastest / 1000).toFixed(1)}s` },
      breaker && { icon: '🔓', title: 'Code Breaker', name: breaker.name, detail: `${breaker.solved} correct guess${breaker.solved === 1 ? '' : 'es'}` },
      mini && { icon: '🤏', title: 'Minimalist', name: mini.name, detail: `${mini.avg.toFixed(1)} emojis per solved clue` },
    ].filter(Boolean);
    this.room.fx('win');
  }
  next() {
    if (this.phase === 'pick') { this.room.cancel(this.timer); this.beginClue(); }
    else if (this.phase === 'clue') this.reveal();
    else if (this.phase === 'reveal') this.nextRound();
  }

  act(p, m) {
    const st = this.stages.find((x) => x.giver === p.id && !x.left);
    switch (m.op) {
      case 'pick': {
        if (this.phase !== 'pick') return { ok: false, error: 'Too late to choose.' };
        if (!st) return { ok: false, error: 'You’re not a Clue Giver this round.' };
        const i = Number(m.i); if (![0, 1, 2].includes(i) || !st.options[i]) return { ok: false, error: 'Pick one of the three.' };
        if (st.answer) return { ok: false, error: 'You already picked.' };
        st.answer = st.options[i]; this.room.fx('pick');
        if (this.stages.every((x) => x.left || x.answer)) { this.room.cancel(this.timer); this.beginClue(); }
        return { ok: true };
      }
      case 'emoji': case 'sep': case 'undo': case 'clear': case 'hint': {
        if (!st) return { ok: false, error: 'Only the Clue Giver can do that.' };
        if (this.phase !== 'clue') return { ok: false, error: 'Wait for the round to start.' };
        if (m.op === 'emoji' || m.op === 'sep') {
          const e = m.op === 'sep' ? SEPARATOR : String(m.e || '');
          if (e !== SEPARATOR && !ALLOWED.has(e)) return { ok: false, error: 'Only emojis from the keyboard.' };
          if (st.clue.length >= MAX_CLUE) return { ok: false, error: `That’s the limit (${MAX_CLUE}). Undo some first.` };
          if (e === SEPARATOR && (!st.clue.length || st.clue[st.clue.length - 1].e === SEPARATOR)) return { ok: false, error: 'Add an emoji before the word break.' };
          st.clue.push({ k: ++st.seq, e }); this.room.fx(e === SEPARATOR ? 'sep' : 'emoji', { stage: st.n });
          return { ok: true };
        }
        if (m.op === 'undo') { if (!st.clue.length) return { ok: false, error: 'Nothing to undo.' }; st.clue.pop(); this.room.fx('undo', { stage: st.n }); return { ok: true }; }
        if (m.op === 'clear') { st.clue = []; this.room.fx('undo', { stage: st.n }); return { ok: true }; }
        if (st.hint >= 2) return { ok: false, error: 'All the hints are already out.' };
        st.hint++; st.giverHints++; this.add(p.id, -HINT_COST); this.room.fx('hint');
        return { ok: true };
      }
      case 'guess': {
        if (this.phase !== 'clue') return { ok: false, error: 'Guessing is closed.' };
        if (this.stages.some((x) => x.giver === p.id)) return { ok: false, error: 'You’re the Clue Giver! No guessing.' };
        const text = clean(m.text, MAX_GUESS);
        if (!text) return { ok: false, error: 'Type a guess first.' };
        const now = this.room.now(), last = this.lastGuessAt.has(p.id) ? this.lastGuessAt.get(p.id) : -1e9;
        if (now - last < GUESS_GAP) return { ok: false, error: 'Easy! One guess a second.' };
        this.lastGuessAt.set(p.id, now);
        const open = this.stages.filter((x) => !x.left && x.answer && !x.solvers.some((y) => y.id === p.id));
        if (!open.length) return { ok: false, error: 'You already solved everything!' };
        let result = 'wrong', got = null;
        for (const x of open) { const r = judge(text, x.answer.text, x.answer.alts); if (r === 'correct') { got = x; result = 'correct'; break; } if (r === 'close') result = 'close'; }
        const mine = this.myGuesses.get(p.id) || []; this.myGuesses.set(p.id, mine);
        if (got) {
          const pts = this.solve(got, p);
          mine.push({ text, r: 'correct', pts, stage: got.n });
          if (mine.length > 8) mine.shift();
          return { ok: true, result, pts, answer: got.answer.text };
        }
        mine.push({ text, r: result }); if (mine.length > 8) mine.shift();
        if (result === 'wrong' && this.s.ticker !== false && this.s.ticker !== 'false') { this.ticker.push({ k: ++this.tickSeq, text }); if (this.ticker.length > 10) this.ticker.shift(); }
        return { ok: true, result };
      }
      default: return { ok: false, error: 'Unknown move.' };
    }
  }

  standings() { return [...this.scores].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), avatar: this.room.get(id).avatar || null, points: pts })).sort((a, b) => b.points - a.points); }
  // Player ids best-first once the game is over (for the party scoreboard across games).
  results() { return this.phase === 'over' ? this.standings().map((x) => x.id) : []; }
  // What everyone may see about a stage. The answer only appears in the reveal.
  pub(st, viewer) {
    const reveal = this.phase === 'reveal', c = st.answer ? CAT[st.answer.cat] : null;
    const el = this.eligible().length;
    return {
      id: st.id, n: st.n, giver: st.giverName, avatar: (this.room.get(st.giver) || {}).avatar || null, color: st.color, left: st.left, picked: !!st.answer,
      cat: c ? { label: c.label, icon: c.icon } : null, diff: st.answer ? st.answer.diff : 0,
      clue: st.clue, emojis: this.emojiCount(st), hint: st.answer && this.phase === 'clue' ? pattern(st.answer.text, st.hint) : null, hintLevel: st.hint,
      solved: st.solvers.length, of: el, firsts: st.solvers.slice(0, 3).map((x) => x.name),
      mine: viewer ? st.solvers.some((x) => x.id === viewer) : false,
      answer: reveal ? st.answer.text : null,
      result: reveal ? { first: st.solvers[0] ? { name: st.solvers[0].name, s: Math.round(st.solvers[0].ms / 100) / 10 } : null, solvers: st.solvers.slice(0, 12).map((x) => ({ name: x.name, pts: x.pts })), giverPts: st.giverPts || 0 } : null,
    };
  }
  tv() {
    return {
      phase: this.phase, round: this.round, total: this.totalRounds, endsIn: this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.room.now()) : 0,
      lastRound: this.phase !== 'over' && this.isFinal(), mult: FINAL_MULT,
      stages: this.stages.map((st) => this.pub(st)),
      ticker: this.ticker.slice(-8), standings: this.standings().slice(0, 10),
      awards: this.phase === 'over' ? this.awards : null, history: this.phase === 'over' ? this.history.slice(-12) : null,
    };
  }
  view(p) {
    const st = this.stages.find((x) => x.giver === p.id), table = this.standings();
    const me = st ? {
      n: st.n, left: st.left,
      options: this.phase === 'pick' && !st.answer ? st.options.map((a) => ({ text: a.text, cat: CAT[a.cat].label, icon: CAT[a.cat].icon, diff: a.diff })) : null,
      answer: st.answer ? st.answer.text : null, cat: st.answer ? CAT[st.answer.cat].label : null, catIcon: st.answer ? CAT[st.answer.cat].icon : null, diff: st.answer ? st.answer.diff : 0,
      clue: st.clue, hint: st.hint, canHint: this.phase === 'clue' && st.hint < 2, solved: st.solvers.length, of: this.eligible().length, max: MAX_CLUE,
    } : null;
    return {
      phase: this.phase, round: this.round, total: this.totalRounds, endsIn: this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.room.now()) : 0,
      role: st ? 'giver' : 'guesser', giver: me, hintCost: HINT_COST, lastRound: this.phase !== 'over' && this.isFinal(), mult: FINAL_MULT,
      stages: this.stages.map((x) => this.pub(x, p.id)), guesses: this.myGuesses.get(p.id) || [],
      roundPts: this.roundPts.get(p.id) || 0,
      points: this.scores.get(p.id) || 0, rank: table.findIndex((x) => x.id === p.id) + 1, of: table.length,
      final: this.phase === 'over' ? table.slice(0, 10) : null, awards: this.phase === 'over' ? this.awards : null,
    };
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ players: P, minutes: M }) => {
  // Every player gives clues (turns each) up to the round cap.
  const seconds = M <= 7 ? 60 : 90, per = (seconds + 40) / 60;
  const s = PF.best({ maxRounds: [8, 5, 12, 20], turns: [1, 2, 3] }, (x) => 0.5 + Math.min(x.maxRounds, x.turns * P) * per, M);
  return { maxRounds: s.maxRounds, turns: s.turns, seconds };
};

module.exports = {
  partyFit,
  key: 'emoji', name: 'Emoji Charades', min: 3, best: [4, 16], fields, defaults,
  create: (room, settings) => new EmojiCharades(room, settings),
  _test: { judge, words, lev, pattern },
};
