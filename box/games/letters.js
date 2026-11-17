'use strict';
// Letter Rush: a letter is rolled, a list of categories goes up, and everyone races to write
// one answer per category that starts with that letter. Then the review goes category by
// category: answers that match someone else's (case, accents, "the", plurals and small typos
// don't matter) score 0, unique answers score 1, and alliteration (two or more words starting
// with the letter, "Big Blue Banana") scores 2. Anyone can 👎 challenge an answer; a quick
// room vote decides if it counts. Rounds: normal, Speed (fewer categories, less time), Theme
// (every category from one theme) and the final Double Letter round (two letters, double
// points). Five scoring answers in a row: a 🔥 streak bonus. All categories are original.
const { THEMES, CATS } = require('./letters-cats');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rounds', label: 'Rounds', options: opt([[3, '3 rounds'], [5, '5 rounds']]) },
  { key: 'seconds', label: 'Writing time', options: opt([[60, '60 seconds'], [90, '90 seconds'], [120, '2 minutes']]) },
  { key: 'cats', label: 'Categories', options: opt([[6, '6 per list'], [8, '8 per list'], [10, '10 per list']]) },
  { key: 'set', label: 'Category set', options: opt([['family', 'Family (all ages)'], ['party', 'Party (grown-up, still clean)'], ['mix', 'Everything']]) },
  { key: 'hard', label: 'Hard letters', options: opt([['off', 'Off (no Q, X, Z)'], ['on', 'On (Q, X, Z too)']]) },
];
const defaults = { rounds: 3, seconds: 90, cats: 8, set: 'mix', hard: 'off' };

const ROLL_MS = 5600, VOTE_MS = 12000, VERDICT_MS = 3600, SCORES_MS = 9000, ALL_IN_MS = 1200;
const ANSWER_MAX = 40, STREAK_EVERY = 5, MAX_CHALLENGED = 6;
// Letters: common ones come up most; J K U V Y less; Q X Z only with hard letters on.
const COMMON = 'ABCDEFGHILMNOPRSTW', TRICKY = 'JKUVY', HARD = 'QXZ';
const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

// ---------- matching ----------
const ARTICLES = new Set(['the', 'a', 'an']);
const SMALL = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'at', 'for', 'with', 'my', 'your', 'de', 'la', 'le', 'el']);
// Lower-case words, accents and punctuation gone ("Café-au-Lait!" -> cafe au lait).
function words(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/['’`]/g, '').replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
}
function singular(w) {
  if (w.length <= 3) return w;
  if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
  if (/(ss|us|is)$/.test(w)) return w;
  if (/(ches|shes|xes|zes|sses)$/.test(w)) return w.slice(0, -2);
  if (/s$/.test(w)) return w.slice(0, -1);
  return w;
}
// The matching key: no "the" (or a leading a / an), every word singular.
function norm(text) {
  let ws = words(text);
  ws = ws.filter((w, i) => w !== 'the' && !(i === 0 && ARTICLES.has(w) && ws.length > 1));
  if (!ws.length) ws = words(text);
  const key = ws.map(singular).join(' ');
  return { key, flat: key.replace(/ /g, '') };
}
// Damerau-Levenshtein (adjacent swaps count as one), bailing out early past `max`.
function dist(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let best = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      best = Math.min(best, d[i][j]);
    }
    if (best > max) return max + 1;
  }
  return d[a.length][b.length];
}
// Same answer? Exact key, same letters without spaces, or a small typo on a long enough word.
function same(a, b) {
  if (!a.flat || !b.flat) return false;
  if (a.key === b.key || a.flat === b.flat) return true;
  const n = Math.min(a.flat.length, b.flat.length), tol = n >= 10 ? 2 : n >= 6 ? 1 : 0;
  return tol > 0 && a.flat[0] === b.flat[0] && dist(a.flat, b.flat, tol) <= tol;
}
// Does it start with (one of) the letters? "The Beatles" counts for T and for B.
function startsRight(text, letters) {
  const ws = words(text); if (!ws.length) return false;
  const ok = (w) => letters.some((L) => w[0] === L.toLowerCase());
  return ok(ws[0]) || (ARTICLES.has(ws[0]) && ws.length > 1 && ok(ws[1]));
}
// Alliteration: two or more real words starting with the round's letter(s).
function alliterates(text, letters) {
  const ls = letters.map((L) => L.toLowerCase());
  return words(text).filter((w) => !SMALL.has(w) && ls.includes(w[0])).length >= 2;
}

// Test bots write from this word bank (a few alliterations, plurals and typos sneak in).
const BOT = {
  A: ['Apple', 'Anchor', 'Alligator', 'Airport', 'Avocado', 'Awesome Apple'], B: ['Banana', 'Bear', 'Bicycle', 'Bubble', 'Big Blue Banana', 'Bacon'],
  C: ['Cat', 'Cheese', 'Castle', 'Cookie', 'Crazy Cat', 'Carrot'], D: ['Dog', 'Donut', 'Drum', 'Dragon', 'Daisy', 'Dancing Dog'],
  E: ['Egg', 'Eagle', 'Elephant', 'Elbow', 'Eraser', 'Eager Eel'], F: ['Frog', 'Fish', 'Fork', 'Flower', 'Fire', 'Fancy Fish'],
  G: ['Goat', 'Grape', 'Guitar', 'Ghost', 'Garden', 'Giant Grape'], H: ['Hat', 'Horse', 'Honey', 'Hammer', 'House', 'Happy Hippo'],
  I: ['Ice', 'Igloo', 'Iron', 'Ink', 'Island', 'Itchy Iguana'], J: ['Jam', 'Jelly', 'Jet', 'Juice', 'Jacket', 'Jolly Jaguar'],
  K: ['Kite', 'Key', 'Kangaroo', 'Kettle', 'King', 'Kooky Koala'], L: ['Lemon', 'Lion', 'Lamp', 'Leaf', 'Ladder', 'Lazy Llama'],
  M: ['Moon', 'Mouse', 'Milk', 'Mango', 'Mirror', 'Mighty Moose'], N: ['Nest', 'Nose', 'Noodle', 'Nut', 'Nail', 'Noisy Newt'],
  O: ['Owl', 'Orange', 'Ocean', 'Oven', 'Onion', 'Odd Octopus'], P: ['Pizza', 'Penguin', 'Pencil', 'Pillow', 'Pumpkin', 'Purple Penguin'],
  Q: ['Queen', 'Quilt', 'Quail', 'Quiz', 'Quarter', 'Quiet Quokka'], R: ['Rabbit', 'Rocket', 'Rain', 'Rose', 'Robot', 'Red Rocket'],
  S: ['Sun', 'Snake', 'Sock', 'Spoon', 'Soup', 'Silly Snake'], T: ['Tiger', 'Toast', 'Train', 'Tree', 'Turtle', 'Tiny Turtle'],
  U: ['Umbrella', 'Unicorn', 'Uncle', 'Ukulele', 'Utensil', 'Unusual Unicorn'], V: ['Violin', 'Van', 'Vase', 'Volcano', 'Vest', 'Very Violet Van'],
  W: ['Whale', 'Water', 'Window', 'Wagon', 'Worm', 'Wild Walrus'], X: ['Xylophone', 'X-ray', 'Xenon', 'Xerox', 'X marks the spot', 'Xtra Xylophone'],
  Y: ['Yo-yo', 'Yak', 'Yogurt', 'Yellow', 'Yacht', 'Young Yak'], Z: ['Zebra', 'Zipper', 'Zoo', 'Zucchini', 'Zero', 'Zany Zebra'],
};

class LetterRush {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'roll'; this.round = 0; this.type = 'normal'; this.theme = null; this.letters = []; this.cats = [];
    this.sheets = new Map(); this.scores = new Map(); this.stats = new Map(); this.used = new Set(); this.usedLetters = new Set();
    this.rev = null; this.ci = 0; this.endsAt = 0; this.timer = null; this.soon = false; this.roundGain = new Map(); this.awards = null; this.highlights = null;
    this.firstDone = null; this.feed = []; this.bestAllit = null; this.bestMeld = null;
  }
  shuffle(a) { const r = this.room.rng; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  pick(a) { return a[Math.floor(this.room.rng() * a.length)]; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  stopTimer() { this.room.cancel(this.timer); this.timer = null; this.endsAt = 0; }
  seat(p) {
    if (this.scores.has(p.id)) return;
    this.scores.set(p.id, 0);
    this.stats.set(p.id, { unique: 0, allit: 0, shared: 0, challenged: 0, struck: 0, sharp: 0, streak: 0, best: 0, first: 0, filled: 0, wrong: 0 });
  }
  active() { return this.room.list().filter((p) => p.bot || p.sockets > 0); }
  who(id) { const p = this.room.get(id); return { name: this.room.name(id), av: p && p.avatar ? String(p.avatar).slice(0, 8) : '' }; }
  add(id, pts) { this.scores.set(id, (this.scores.get(id) || 0) + pts); this.roundGain.set(id, (this.roundGain.get(id) || 0) + pts); }

  start() { for (const p of this.room.list()) this.seat(p); this.plan = this.makePlan(); this.nextRound(); }
  joined(p) { this.seat(p); }
  left() { if (this.phase === 'write') this.maybeAllDone(); else if (this.phase === 'review') this.maybeAllReady(); else if (this.phase === 'vote') this.maybeAllVoted(); }
  makePlan() {
    const n = Number(this.s.rounds) === 5 ? 5 : 3;
    if (n === 5) return ['normal', 'speed', 'theme', 'normal', 'double'];
    return ['normal', this.room.rng() < 0.5 ? 'speed' : 'theme', 'double'];
  }

  // ---------- letters and categories ----------
  rollLetter(exclude = []) {
    const bag = [];
    const put = (str, w) => { for (const L of str) if (!this.usedLetters.has(L) && !exclude.includes(L)) for (let i = 0; i < w; i++) bag.push(L); };
    put(COMMON, 3); put(TRICKY, 1); if (this.s.hard === 'on') put(HARD, 1);
    if (!bag.length) { this.usedLetters.clear(); put(COMMON, 1); }
    const L = this.pick(bag.filter((x) => !exclude.includes(x)).length ? bag.filter((x) => !exclude.includes(x)) : COMMON.split(''));
    this.usedLetters.add(L); return L;
  }
  pool() {
    if (this.s.set === 'family') return CATS.filter((c) => !c.p);
    return CATS;
  }
  weight(c) { return this.s.set === 'party' ? (c.p ? 4 : 1) : 1; }
  drawCats(n, theme) {
    let pool = this.pool().filter((c) => !this.used.has(c.t) && (!theme || c.th === theme));
    if (pool.length < n) pool = CATS.filter((c) => !this.used.has(c.t) && (!theme || c.th === theme));
    if (pool.length < n) { this.used.clear(); pool = this.pool().filter((c) => !theme || c.th === theme); }
    const out = [], bag = pool.slice();
    while (out.length < n && bag.length) {
      const total = bag.reduce((s, c) => s + this.weight(c), 0); let r = this.room.rng() * total, i = 0;
      for (; i < bag.length - 1; i++) { r -= this.weight(bag[i]); if (r < 0) break; }
      out.push(bag.splice(i, 1)[0]);
    }
    // No two categories from the same theme next to each other if it can be helped.
    for (const c of out) this.used.add(c.t);
    return theme ? out.map((c) => c.t) : this.spread(out).map((c) => c.t);
  }
  spread(list) { const a = this.shuffle(list.slice()); for (let i = 1; i < a.length; i++) if (a[i].th === a[i - 1].th) { const j = a.findIndex((x, k) => k > i && x.th !== a[i - 1].th); if (j > 0) [a[i], a[j]] = [a[j], a[i]]; } return a; }
  pickTheme(n) {
    const keys = Object.keys(THEMES).filter((k) => this.pool().filter((c) => c.th === k && !this.used.has(c.t)).length >= n);
    return this.pick(keys.length ? keys : Object.keys(THEMES));
  }
  catCount() { const n = Number(this.s.cats) || 8; return this.type === 'speed' ? Math.max(4, Math.ceil(n / 2)) : n; }
  writeMs() { const sec = Number(this.s.seconds) || 90; return (this.type === 'speed' ? Math.round((sec * 0.45) / 5) * 5 : sec) * 1000; }
  mult() { return this.type === 'double' ? 2 : 1; }

  // ---------- rounds ----------
  nextRound() {
    if (this.round >= this.plan.length) return this.finish();
    this.round++; this.type = this.plan[this.round - 1]; this.roundGain = new Map(); this.firstDone = null;
    const n = this.catCount();
    this.theme = this.type === 'theme' ? this.pickTheme(n) : null;
    this.cats = this.drawCats(n, this.theme);
    const a = this.rollLetter(); this.letters = this.type === 'double' ? [a, this.rollLetter([a, ...HARD])] : [a];
    if (this.type === 'double') this.letters.sort();
    this.sheets = new Map(); this.rev = null; this.ci = 0;
    this.phase = 'roll'; this.room.fx('roll', { double: this.type === 'double' });
    this.setTimer(ROLL_MS, () => this.beginWrite());
  }
  sheet(id) { let s = this.sheets.get(id); if (!s) { s = { a: this.cats.map(() => ''), done: false, at: 0 }; this.sheets.set(id, s); } return s; }
  beginWrite() {
    if (this.phase !== 'roll') return;
    this.phase = 'write'; this.soon = false; this.room.fx('go');
    for (const p of this.room.list()) this.sheet(p.id);
    const ms = this.writeMs(); this.setTimer(ms, () => this.beginReview());
    for (const p of this.room.list()) if (p.bot) this.botWrite(p, ms);
  }
  botWrite(p, ms) {
    const r = this.room.rng;
    this.cats.forEach((_, i) => this.room.after(800 + r() * ms * 0.55, () => {
      if (this.phase !== 'write' || r() < 0.15) return;
      const L = this.pick(this.letters), bank = BOT[L] || BOT.A;
      let t = this.pick(bank); const q = r(); if (q < 0.08) t += 's'; else if (q < 0.12) t = t.toUpperCase(); else if (q < 0.15 && t.length > 6) t = t.slice(0, -2) + t.slice(-1) + t.slice(-2, -1);
      this.act(p, { op: 'ans', i, text: t });
    }));
    this.room.after(ms * (0.45 + r() * 0.25), () => { if (this.phase === 'write') this.act(p, { op: 'done', on: true }); });
  }
  maybeAllDone() {
    if (this.phase !== 'write' || this.soon) return;
    const act = this.active();
    if (act.length && act.every((p) => (this.sheets.get(p.id) || {}).done)) { this.soon = true; this.setTimer(ALL_IN_MS, () => this.beginReview()); }
  }

  // ---------- review ----------
  beginReview() {
    if (this.phase !== 'write') return;
    this.soon = false;
    // Snapshot: each category's answers, judged (wrong letter / repeat / shared / unique / bonus).
    this.judged = this.cats.map((cat, ci) => this.judge(ci));
    for (const [id, sh] of this.sheets) { const st = this.stats.get(id); if (st) st.filled += sh.a.filter(Boolean).length; }
    this.ci = -1; this.nextCat();
  }
  judge(ci) {
    const items = [];
    for (const [id, sh] of this.sheets) {
      const text = sh.a[ci]; if (!text) continue;
      const it = { id, text, n: norm(text), status: 'ok', pts: 0, bonus: false, ch: new Set(), votes: new Map() };
      if (!startsRight(text, this.letters)) it.status = 'wrong';
      else if (sh.a.some((t, k) => k < ci && t && startsRight(t, this.letters) && same(norm(t), it.n))) it.status = 'repeat';
      items.push(it);
    }
    // Group matching answers (union-find over everyone's valid answers).
    const ok = items.filter((x) => x.status === 'ok'), par = ok.map((_, i) => i);
    const root = (i) => (par[i] === i ? i : (par[i] = root(par[i])));
    for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) if (root(i) !== root(j) && same(ok[i].n, ok[j].n)) par[root(i)] = root(j);
    const groups = new Map();
    ok.forEach((x, i) => { const r = root(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(x); });
    const out = [];
    for (const g of groups.values()) {
      if (g.length > 1) { for (const x of g) x.status = 'shared'; }
      else { const x = g[0]; x.bonus = alliterates(x.text, this.letters); x.pts = (x.bonus ? 2 : 1) * this.mult(); }
      out.push(g);
    }
    // Shared groups first (biggest first), then the unique answers.
    out.sort((a, b) => b.length - a.length);
    return { cat: this.cats[ci], items, groups: out };
  }
  nextCat() {
    this.ci++;
    if (this.ci >= this.cats.length) return this.endRound();
    this.rev = this.judged[this.ci]; this.rev.ready = new Set(); this.rev.verdict = null; this.rev.trial = [];
    this.phase = 'review'; this.soon = false; this.room.fx('cat', { shared: this.rev.groups.some((g) => g.length > 1) });
    const n = this.rev.items.length;
    this.setTimer(Math.max(7000, Math.min(15000, 6000 + n * 350)), () => this.endLook());
    const r = this.room.rng;
    for (const p of this.room.list()) if (p.bot) {
      this.room.after(1500 + r() * 3500, () => {
        if (this.phase !== 'review' || !this.rev) return;
        const mine = this.rev.items.filter((x) => x.status === 'ok' && x.id !== p.id);
        if (mine.length && r() < 0.12) this.act(p, { op: 'challenge', id: this.pick(mine).id, on: true });
        this.act(p, { op: 'ready' });
      });
    }
  }
  maybeAllReady() {
    if (this.phase !== 'review' || this.soon || !this.rev) return;
    const act = this.active();
    if (act.length && act.every((p) => this.rev.ready.has(p.id))) { this.soon = true; this.setTimer(600, () => this.endLook()); }
  }
  endLook() {
    if (this.phase !== 'review') return;
    this.soon = false;
    const trial = this.rev.items.filter((x) => x.status === 'ok' && x.ch.size).sort((a, b) => b.ch.size - a.ch.size).slice(0, MAX_CHALLENGED);
    for (const x of trial) { const st = this.stats.get(x.id); if (st) st.challenged++; }
    if (!trial.length) return this.closeCat();
    this.rev.trial = trial; this.phase = 'vote'; this.room.fx('vote');
    this.setTimer(VOTE_MS, () => this.verdict());
    const r = this.room.rng;
    for (const p of this.room.list()) if (p.bot) this.room.after(1000 + r() * 4000, () => {
      if (this.phase !== 'vote') return;
      for (const x of this.rev.trial) if (x.id !== p.id) this.act(p, { op: 'vote', id: x.id, keep: r() < 0.6 });
    });
  }
  canVote(p, x) { return x.id !== p.id; }
  maybeAllVoted() {
    if (this.phase !== 'vote' || this.soon) return;
    const act = this.active();
    if (act.every((p) => this.rev.trial.every((x) => !this.canVote(p, x) || x.votes.has(p.id)))) { this.soon = true; this.setTimer(800, () => this.verdict()); }
  }
  verdict() {
    if (this.phase !== 'vote') return;
    this.soon = false;
    let struck = 0;
    for (const x of this.rev.trial) {
      let yes = 0, no = 0; for (const v of x.votes.values()) (v ? yes++ : no++);
      x.tally = { yes, no };
      if (no > yes) {
        x.status = 'struck'; x.pts = 0; struck++;
        const st = this.stats.get(x.id); if (st) st.struck++;
        for (const c of x.ch) { const cs = this.stats.get(c); if (cs) cs.sharp++; }
      }
    }
    this.rev.verdict = { struck, kept: this.rev.trial.length - struck };
    this.phase = 'verdict'; this.room.fx('verdict', { struck });
    this.setTimer(VERDICT_MS, () => this.closeCat());
  }
  // Points for this category go on the board; streaks move.
  closeCat() {
    const rev = this.rev, by = new Map(rev.items.map((x) => [x.id, x]));
    const fires = [];
    for (const g of rev.groups) if (g.length > 1) for (const x of g) { const st = this.stats.get(x.id); if (st) st.shared++; }
    for (const g of rev.groups) if (g.length > 1 && (!this.bestMeld || g.length > this.bestMeld.n)) this.bestMeld = { n: g.length, text: g[0].text, cat: rev.cat, names: g.slice(0, 6).map((x) => this.room.name(x.id)) };
    for (const id of this.scores.keys()) {
      if (!this.room.get(id)) continue;
      const x = by.get(id), st = this.stats.get(id);
      if (x && x.status === 'wrong') st.wrong++;
      if (x && x.status === 'ok' && x.pts > 0) {
        this.add(id, x.pts); st.unique++; if (x.bonus) {
          st.allit++;
          const wc = words(x.text).length; if (!this.bestAllit || wc > this.bestAllit.wc) this.bestAllit = { wc, text: x.text, cat: rev.cat, ...this.who(id) };
        }
        st.streak++; st.best = Math.max(st.best, st.streak);
        if (st.streak % STREAK_EVERY === 0) { this.add(id, 1); fires.push(this.room.name(id)); }
      } else if (this.sheets.has(id)) st.streak = 0;
    }
    rev.fires = fires;
    if (fires.length) this.room.fx('streak');
    this.nextCat();
  }
  endRound() {
    this.rev = null; this.phase = 'scores'; this.room.fx('scores');
    this.setTimer(SCORES_MS, () => this.nextRound());
  }
  finish() {
    this.stopTimer(); this.phase = 'over'; this.rev = null;
    this.awards = this.makeAwards();
    this.highlights = { allit: this.bestAllit, meld: this.bestMeld };
    this.room.fx('win');
  }
  makeAwards() {
    const here = [...this.stats].filter(([id]) => this.room.get(id));
    const best = (val, min = 1) => { let top = null; for (const [id, st] of here) { const v = val(st); if (v < min) continue; if (!top || v > top.v) top = { id, v }; } return top; };
    const out = [];
    const push = (key, icon, title, blurb, t, text) => { if (t) out.push({ key, icon, title, blurb, ...this.who(t.id), id: t.id, value: text(t.v) }); };
    push('wordsmith', '🖋️', 'Wordsmith', 'Most alliteration bonuses', best((s) => s.allit), (v) => `${v} alliteration${v === 1 ? '' : 's'}`);
    push('unique', '🦄', 'One of a Kind', 'Most unique answers', best((s) => s.unique), (v) => `${v} unique`);
    push('meld', '🧠', 'Mind Meld', 'Matched the most answers', best((s) => s.shared), (v) => `${v} shared`);
    push('challenged', '👎', 'Most Challenged', 'The room had doubts', best((s) => s.challenged), (v) => `challenged ${v}×`);
    push('sharp', '🔎', 'Sharp Eye', 'Challenges that stuck', best((s) => s.sharp), (v) => `${v} struck`);
    push('streak', '🔥', 'On a Roll', 'Longest scoring streak', best((s) => s.best, 4), (v) => `${v} in a row`);
    push('speed', '⚡', 'Speed Demon', 'First to finish a list', best((s) => s.first), (v) => `first ${v}×`);
    return out;
  }
  next() {
    if (this.phase === 'roll') this.beginWrite();
    else if (this.phase === 'write') this.beginReview();
    else if (this.phase === 'review') this.endLook();
    else if (this.phase === 'vote') this.verdict();
    else if (this.phase === 'verdict') { this.stopTimer(); this.closeCat(); }
    else if (this.phase === 'scores') this.nextRound();
  }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }

  // ---------- phone moves ----------
  act(p, m) {
    if (!this.scores.has(p.id)) this.seat(p);
    m = m && typeof m === 'object' ? m : {};
    if (m.op === 'ans' || m.op === 'sheet') {
      if (this.phase !== 'write') return { ok: false, error: 'Pencils down! Time is up.' };
      const sh = this.sheet(p.id), before = sh.a.filter(Boolean).length;
      if (m.op === 'ans') {
        const i = Number(m.i);
        if (!Number.isInteger(i) || i < 0 || i >= this.cats.length) return { ok: false, error: 'That category isn’t on the list.' };
        if (typeof m.text !== 'string') return { ok: false, error: 'Type an answer.' };
        sh.a[i] = clean(m.text, ANSWER_MAX);
      } else {
        if (!Array.isArray(m.answers) || m.answers.length > this.cats.length) return { ok: false, error: 'That list doesn’t fit.' };
        m.answers.forEach((t, i) => { if (typeof t === 'string') sh.a[i] = clean(t, ANSWER_MAX); });
      }
      if (m.done === true) return this.act(p, { op: 'done', on: true });
      return sh.a.filter(Boolean).length !== before ? { ok: true } : { ok: true, quiet: true };
    }
    if (m.op === 'done') {
      if (this.phase !== 'write') return { ok: false, error: 'Pencils down! Time is up.' };
      const sh = this.sheet(p.id), on = m.on !== false;
      if (on && !sh.done) {
        sh.done = true; sh.at = this.room.now();
        if (!this.firstDone && sh.a.some(Boolean)) { this.firstDone = p.id; const st = this.stats.get(p.id); if (st) st.first++; this.room.fx('first', { id: p.id }); }
      } else if (!on) sh.done = false;
      this.maybeAllDone();
      return { ok: true };
    }
    if (m.op === 'challenge') {
      if (this.phase !== 'review' || !this.rev) return { ok: false, error: 'You can only challenge during the review.' };
      const x = typeof m.id === 'string' ? this.rev.items.find((y) => y.id === m.id) : null;
      if (!x) return { ok: false, error: 'That answer isn’t up right now.' };
      if (x.id === p.id) return { ok: false, error: 'You can’t challenge your own answer!' };
      if (x.status !== 'ok') return { ok: false, error: 'That answer already scores nothing.' };
      if (m.on === false) x.ch.delete(p.id); else x.ch.add(p.id);
      if (m.on !== false) this.room.fx('challenge');
      return { ok: true };
    }
    if (m.op === 'ready') {
      if (this.phase !== 'review' || !this.rev) return { ok: false, error: 'Not now.' };
      this.rev.ready.add(p.id); this.maybeAllReady();
      return { ok: true };
    }
    if (m.op === 'vote') {
      if (this.phase !== 'vote' || !this.rev) return { ok: false, error: 'Voting is closed.' };
      const x = typeof m.id === 'string' ? this.rev.trial.find((y) => y.id === m.id) : null;
      if (!x) return { ok: false, error: 'That answer isn’t on trial.' };
      if (!this.canVote(p, x)) return { ok: false, error: 'You can’t vote on your own answer.' };
      if (typeof m.keep !== 'boolean') return { ok: false, error: 'Vote counts or doesn’t count.' };
      x.votes.set(p.id, m.keep); this.maybeAllVoted();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }

  // ---------- state ----------
  standings() {
    return [...this.scores].filter(([id]) => this.room.get(id)).map(([id, pts]) => {
      const st = this.stats.get(id) || {};
      return { id, ...this.who(id), points: pts, unique: st.unique || 0, streak: st.streak || 0, gain: this.roundGain.get(id) || 0 };
    }).sort((a, b) => b.points - a.points || b.unique - a.unique);
  }
  endsIn() { return this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.room.now()) : 0; }
  itemPublic(x) { return { id: x.id, ...this.who(x.id), text: x.text, status: x.status, pts: x.pts, bonus: x.bonus, ch: x.ch.size, tally: x.tally || null }; }
  // Grouped answers for the TV. Big rooms: the first 24 groups (challenged ones always shown).
  revPublic() {
    const R = this.rev; if (!R) return null;
    const onTrial = new Set(R.trial.map((x) => x.id));
    let groups = R.groups.map((g) => ({ text: g[0].text, shared: g.length > 1, n: g.length, items: g.slice(0, 8).map((x) => this.itemPublic(x)), more: Math.max(0, g.length - 8), trial: g.some((x) => onTrial.has(x.id)), ch: g.reduce((s, x) => s + x.ch.size, 0) }));
    const cap = 24, more = Math.max(0, groups.length - cap);
    if (more) groups = groups.filter((g, i) => i < cap || g.trial);
    const bad = R.items.filter((x) => x.status === 'wrong' || x.status === 'repeat');
    return {
      ci: this.ci, of: this.cats.length, cat: R.cat, groups, more, bad: bad.slice(0, 12).map((x) => this.itemPublic(x)), badMore: Math.max(0, bad.length - 12),
      answered: R.items.length, ready: R.ready.size, trial: R.trial.map((x) => this.itemPublic(x)), verdict: R.verdict, fires: R.fires || [],
    };
  }
  base() {
    const T = this.theme ? THEMES[this.theme] : null;
    return {
      phase: this.phase, round: this.round, rounds: (this.plan || []).length || Number(this.s.rounds) || 3, type: this.type, letters: this.letters, cats: this.cats,
      theme: T ? { name: T.name, icon: T.icon } : null, mult: this.mult(), endsIn: this.endsIn(), plan: this.plan || [],
    };
  }
  tv() {
    const out = { ...this.base(), standings: this.standings().slice(0, this.phase === 'over' ? 12 : 10) };
    if (this.phase === 'write' || this.phase === 'roll') {
      const list = this.room.list();
      out.progress = list.slice(0, 30).map((p) => { const sh = this.sheets.get(p.id); return { ...this.who(p.id), id: p.id, filled: sh ? sh.a.filter(Boolean).length : 0, done: !!(sh && sh.done) }; });
      out.done = list.filter((p) => (this.sheets.get(p.id) || {}).done).length; out.of = list.length; out.more = Math.max(0, list.length - 30);
      out.first = this.firstDone ? this.who(this.firstDone) : null;
    }
    if (this.rev) out.rev = this.revPublic();
    if (this.phase === 'scores') out.gains = this.standings().filter((r) => r.gain > 0).sort((a, b) => b.gain - a.gain).slice(0, 8);
    if (this.phase === 'over') { out.awards = this.awards; out.highlights = this.highlights; }
    return out;
  }
  view(p) {
    const st = this.standings(), me = this.stats.get(p.id) || {}, sh = this.sheets.get(p.id), R = this.rev;
    const out = { ...this.base(), points: this.scores.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length, streak: me.streak || 0, max: ANSWER_MAX, gain: this.roundGain.get(p.id) || 0 };
    if (this.phase === 'write' || this.phase === 'roll') { out.mine = sh ? sh.a : this.cats.map(() => ''); out.done = !!(sh && sh.done); }
    if (R) {
      const x = R.items.find((y) => y.id === p.id);
      out.rev = { ci: this.ci, of: this.cats.length, cat: R.cat, mine: x ? this.itemPublic(x) : null, ready: R.ready.has(p.id), verdict: R.verdict, fires: R.fires || [],
        others: R.items.filter((y) => y.status === 'ok' && y.id !== p.id).slice(0, 60).map((y) => ({ ...this.itemPublic(y), mine: y.ch.has(p.id) })),
        meld: x && x.status === 'shared' ? (R.groups.find((g) => g.includes(x)) || []).filter((y) => y !== x).slice(0, 6).map((y) => this.room.name(y.id)) : [],
        trial: R.trial.map((y) => ({ ...this.itemPublic(y), own: y.id === p.id, vote: y.votes.has(p.id) ? y.votes.get(p.id) : null })) };
    }
    if (this.phase === 'over') {
      out.final = st.slice(0, 10); out.awards = (this.awards || []).filter((a) => a.id === p.id).map((a) => ({ icon: a.icon, title: a.title, value: a.value }));
      out.stats = { unique: me.unique || 0, allit: me.allit || 0, shared: me.shared || 0, best: me.best || 0, filled: me.filled || 0 };
    }
    return out;
  }
}

module.exports = {
  key: 'letters', name: 'Letter Rush', min: 2, best: [3, 10], howSteps: 6, fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/letters.js)
  locked: { how: 'Finish a game of Who Said It? to unlock it.' }, // public/unlocks.js + UNLOCK_RULES in box/room.js
  create: (room, settings) => new LetterRush(room, settings),
  // for tests
  norm, same, startsRight, alliterates, words, THEMES, CATS,
};
