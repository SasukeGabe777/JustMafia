'use strict';
// Two Truths & a Lie: everyone types two true things and one lie about themselves on their
// phone. Then, one player at a time, the TV shows their three statements (shuffled); the room
// grills them, and everyone else votes for the lie (leaning early is allowed while they talk).
// Guess right: +1. Fool people: +1 for each one you fooled (at most 5 a turn, so big rooms stay fair). The game ends with awards, the
// most believable lie, the truth nobody believed, and the lies we never got to.
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'writeSeconds', label: 'Time to write', options: opt([[90, '1½ minutes'], [120, '2 minutes'], [180, '3 minutes']]) },
  { key: 'voteSeconds', label: 'Time to vote', options: opt([[20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds']]) },
  { key: 'featured', label: 'Players in the hot seat', options: opt([['auto', 'Auto (everyone, up to 12)'], [6, '6 players'], [10, '10 players'], [20, '20 players'], [100, 'Everyone']]) },
  { key: 'talk', label: 'Grill them before the vote', options: opt([[0, 'None'], [15, '15 seconds'], [30, '30 seconds'], [45, '45 seconds']]) },
];
const defaults = { writeSeconds: 120, voteSeconds: 30, featured: 'auto', talk: 15 };
const REVEAL_SECONDS = 10, ITEM_MAX = 90, AUTO_FEATURED = 12;
const clean = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200c\u200e\u200f\u202a-\u202e\u2066-\u2069<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, ITEM_MAX);
// Statements for test bots (made up).
const BOT_FACTS = [
  ['I once ate 12 tacos in one sitting', 'I have never seen the ocean', 'I can whistle with my fingers'],
  ['I was born on a leap day', 'I own three pet snails', 'I have climbed a volcano'],
  ['I can’t swim', 'I once met a famous chef', 'I sleep with socks on'],
  ['I have a twin', 'I collect spoons', 'I broke my arm skateboarding'],
  ['I have been on TV', 'I hate chocolate', 'I can juggle four balls'],
  ['I once got lost in a furniture store for two hours', 'I speak three languages', 'I have never ridden a bike'],
  ['I was a spelling bee champion', 'I have a tattoo of a potato', 'I once fell asleep at a rock concert'],
  ['I’ve been chased by a goose', 'I can do a backflip', 'I have read every book in a series twice'],
  ['I once won a pie-eating contest', 'I’m allergic to cats', 'I’ve never had a cavity'],
  ['I named my car Gerald', 'I can solve a puzzle cube', 'I was in a school play as a tree'],
];

class Truths {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'write'; this.sets = new Map(); this.scores = new Map(); this.stats = new Map();
    this.queue = []; this.cur = null; this.endsAt = 0; this.timer = null; this.history = []; this.featuredIds = new Set();
    this.total = 0; this.awards = null; this.highlights = null; this.gallery = null;
  }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  seat(p) { if (!this.scores.has(p.id)) { this.scores.set(p.id, 0); this.stats.set(p.id, { right: 0, guesses: 0, fooled: 0, faced: 0, seats: 0 }); } }
  start() {
    for (const p of this.room.list()) this.seat(p);
    this.setTimer(this.s.writeSeconds * 1000, () => this.beginRounds());
    let i = Math.floor(this.room.rng() * BOT_FACTS.length);
    for (const p of this.room.list()) if (p.bot) { const f = BOT_FACTS[i++ % BOT_FACTS.length]; this.room.after(2000 + this.room.rng() * 6000, () => this.act(p, { op: 'write', items: f, lie: Math.floor(this.room.rng() * 3) })); }
  }
  joined(p) { this.seat(p); }
  left(p) {
    if (this.phase === 'write') return this.maybeAllWritten();
    if (!this.cur) return;
    if (p.id === this.cur.id && (this.phase === 'talk' || this.phase === 'vote')) { this.room.cancel(this.timer); this.cur.votes.clear(); return this.nextSeat(); }
    if (this.phase === 'vote') this.maybeAllVoted();
  }
  maybeAllWritten() {
    if (this.phase !== 'write' || this.allIn) return;
    const list = this.room.list();
    if (list.length && list.every((p) => this.sets.has(p.id))) { this.allIn = true; this.setTimer(1500, () => this.beginRounds()); }
  }
  featuredCount() { return this.s.featured === 'auto' ? AUTO_FEATURED : Number(this.s.featured) || AUTO_FEATURED; }
  beginRounds() {
    if (this.phase !== 'write') return;
    this.allIn = false;
    const ids = [...this.sets.keys()].filter((id) => this.room.get(id));
    const r = this.room.rng; for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    // Humans first (they wrote their own), then bots, up to the setting.
    ids.sort((a, b) => Number(!!this.room.get(a).bot) - Number(!!this.room.get(b).bot));
    this.queue = ids.slice(0, this.featuredCount()); this.total = this.queue.length;
    this.featuredIds = new Set(this.queue);
    if (!this.queue.length) return this.finish();
    this.nextSeat();
  }
  nextSeat() {
    let id = this.queue.shift();
    while (id && !this.room.get(id)) { this.total--; id = this.queue.shift(); }
    if (!id) return this.finish();
    const set = this.sets.get(id);
    // shuffle the three statements for display
    const order = [0, 1, 2]; const r = this.room.rng; for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    this.seatN = (this.seatN || 0) + 1;
    this.cur = { id, items: order.map((k) => set.items[k]), lie: order.indexOf(set.lie), votes: new Map(), n: this.seatN, result: null, gains: null };
    this.room.fx('flip');
    if (this.s.talk) { this.phase = 'talk'; this.room.fx('talk'); this.setTimer(this.s.talk * 1000, () => this.openVote()); }
    else this.openVote();
    // Bots lean early sometimes, otherwise vote once voting opens.
    for (const p of this.room.list()) if (p.bot && p.id !== id) {
      const at = (this.s.talk ? this.s.talk * 1000 * (this.room.rng() < 0.4 ? 0.5 : 1) : 0) + 1500 + this.room.rng() * 6000;
      this.room.after(at, () => { if ((this.phase === 'vote' || this.phase === 'talk') && this.cur && this.cur.id === id && this.room.get(p.id)) { this.cur.votes.set(p.id, Math.floor(this.room.rng() * 3)); if (this.phase === 'vote') this.maybeAllVoted(); } });
    }
  }
  openVote() {
    if (this.phase === 'reveal' || this.phase === 'over') return;
    this.phase = 'vote'; this.room.fx('gavel');
    this.setTimer(this.s.voteSeconds * 1000, () => this.reveal());
    this.maybeAllVoted();
  }
  voters() { return this.room.list().filter((p) => p.id !== this.cur.id); }
  maybeAllVoted() { if (this.phase !== 'vote') return; const v = this.voters(); if (v.every((p) => this.cur.votes.has(p.id))) this.reveal(); }
  reveal() {
    if (this.phase !== 'vote') return;
    const c = this.cur; let fooled = 0; const gains = {}, rightNames = [];
    for (const [pid, pick] of c.votes) {
      const st = this.stats.get(pid); if (st) st.guesses++;
      if (pick === c.lie) { this.scores.set(pid, (this.scores.get(pid) || 0) + 1); gains[pid] = 1; if (st) st.right++; rightNames.push(this.room.name(pid)); }
      else { fooled++; gains[pid] = 0; }
    }
    this.scores.set(c.id, (this.scores.get(c.id) || 0) + Math.min(fooled, 5)); // capped: a big room can't hand one liar the game
    const ast = this.stats.get(c.id); if (ast) { ast.fooled += fooled; ast.faced += c.votes.size; ast.seats++; }
    const tally = [0, 0, 0]; for (const v of c.votes.values()) tally[v]++;
    // Plot twist: a TRUE statement got more votes than the lie.
    let twist = null; for (let i = 0; i < 3; i++) if (i !== c.lie && tally[i] > tally[c.lie] && (twist == null || tally[i] > tally[twist])) twist = i;
    c.result = { tally, fooled, right: c.votes.size - fooled, voted: c.votes.size, twist, first: rightNames.slice(0, 8) };
    c.gains = gains;
    const p = this.room.get(c.id);
    this.history.push({ id: c.id, name: this.room.name(c.id), av: p && p.avatar ? String(p.avatar).slice(0, 8) : '', items: c.items, lie: c.lie, tally, fooled, of: c.votes.size });
    this.phase = 'reveal'; this.room.fx('drum', { fooled: c.votes.size > 0 && fooled > c.votes.size / 2, twist: twist != null });
    this.setTimer(REVEAL_SECONDS * 1000, () => this.nextSeat());
  }
  finish() {
    this.room.cancel(this.timer); this.timer = null;
    this.phase = 'over'; this.endsAt = 0; this.cur = null;
    this.makeEnd(); this.room.fx('win');
  }
  makeEnd() {
    const here = [...this.stats].filter(([id]) => this.room.get(id));
    const best = (val, min = 1) => { let top = null; for (const [id, st] of here) { const v = val(st); if (v == null || v < min) continue; if (!top || v > top.v) top = { id, v }; } return top; };
    const out = [];
    const push = (key, icon, title, blurb, t, text) => { if (t) out.push({ key, icon, title, blurb, ...this.who(t.id), id: t.id, value: text(t.v) }); };
    push('liar', '😈', 'Master of Deception', 'Fooled the most people', best((s) => s.fooled), (v) => `fooled ${v}`);
    push('detect', '🕵️', 'Lie Detector', 'Spotted the most lies', best((s) => s.right), (v) => `${v} spotted`);
    push('open', '📖', 'Open Book', 'Nobody believed their lie', best((s) => (s.seats && s.faced ? 1 - s.fooled / s.faced : null), 0.75), () => 'easy to read');
    this.awards = out;
    const rated = this.history.filter((h) => h.of > 0);
    const lie = rated.slice().sort((a, b) => b.fooled / b.of - a.fooled / a.of || b.fooled - a.fooled)[0];
    let truth = null;
    for (const h of rated) for (let i = 0; i < 3; i++) if (i !== h.lie && h.tally[i] > 0 && (!truth || h.tally[i] / h.of > truth.share)) truth = { name: h.name, av: h.av, text: h.items[i], votes: h.tally[i], of: h.of, share: h.tally[i] / h.of };
    this.highlights = {
      lie: lie && lie.fooled ? { name: lie.name, av: lie.av, text: lie.items[lie.lie], fooled: lie.fooled, of: lie.of } : null,
      truth: truth && truth.share >= 0.34 ? truth : null,
    };
    // Everyone who wrote a set but never got the hot seat: their lie is revealed on the way out.
    this.gallery = [...this.sets].filter(([id]) => !this.featuredIds.has(id) && this.room.get(id)).slice(0, 12)
      .map(([id, s]) => ({ ...this.who(id), lie: s.items[s.lie] }));
  }
  next() {
    if (this.phase === 'write') { this.room.cancel(this.timer); this.beginRounds(); }
    else if (this.phase === 'talk') { this.room.cancel(this.timer); this.openVote(); }
    else if (this.phase === 'vote') { this.room.cancel(this.timer); this.reveal(); }
    else if (this.phase === 'reveal') { this.room.cancel(this.timer); this.nextSeat(); }
  }

  act(p, m) {
    if (!this.scores.has(p.id)) this.seat(p);
    m = m && typeof m === 'object' ? m : {};
    if (m.op === 'write') {
      if (this.phase !== 'write') return { ok: false, error: 'Writing time is over.' };
      const items = Array.isArray(m.items) ? m.items.slice(0, 4).map((x) => (typeof x === 'string' ? clean(x) : '')) : [];
      if (items.length !== 3 || items.some((x) => x.length < 3)) return { ok: false, error: 'Write all three (a few words each).' };
      if (new Set(items.map((x) => x.toLowerCase())).size < 3) return { ok: false, error: 'Write three different things.' };
      const lie = Number(m.lie);
      if (![0, 1, 2].includes(lie)) return { ok: false, error: 'Mark which one is the lie.' };
      this.sets.set(p.id, { items, lie });
      if (!p.bot) this.room.fx('ready');
      this.maybeAllWritten();
      return { ok: true };
    }
    if (m.op === 'vote') {
      if (this.phase !== 'vote' && this.phase !== 'talk') return { ok: false, error: 'Voting isn’t open.' };
      if (p.id === this.cur.id) return { ok: false, error: 'Keep a straight face! You can’t vote on your own.' };
      const k = Number(m.pick); if (![0, 1, 2].includes(k)) return { ok: false, error: 'Pick 1, 2 or 3.' };
      this.cur.votes.set(p.id, k); this.maybeAllVoted();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }

  who(id) { const p = this.room.get(id); return { name: this.room.name(id), av: p && p.avatar ? String(p.avatar).slice(0, 8) : '' }; }
  standings() { return [...this.scores].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, ...this.who(id), points: pts, right: (this.stats.get(id) || {}).right || 0 })).sort((a, b) => b.points - a.points || b.right - a.right); }
  // Best first, once the game is over (for the party scoreboard across games).
  results() { return this.standings().map((r) => r.id); }
  endsIn() { return this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.room.now()) : 0; }
  seatPublic() {
    const c = this.cur; if (!c || this.phase === 'write' || this.phase === 'over') return null;
    const voters = this.voters(), shown = this.phase === 'reveal';
    return { ...this.who(c.id), items: c.items, n: c.n, total: this.total, voted: c.votes.size, of: voters.length,
      notVoted: this.phase === 'vote' ? voters.filter((p) => !c.votes.has(p.id)).slice(0, 20).map((p) => p.name) : [],
      lie: shown ? c.lie : null, result: shown ? c.result : null };
  }
  tv() {
    const list = this.room.list();
    return {
      phase: this.phase, endsIn: this.endsIn(),
      written: this.sets.size, of: this.room.players.size,
      waiting: this.phase === 'write' ? list.filter((p) => !this.sets.has(p.id)).map((p) => p.name) : [],
      table: this.phase === 'write' ? list.slice(0, 40).map((p) => ({ ...this.who(p.id), done: this.sets.has(p.id) })) : [], tableMore: Math.max(0, list.length - 40),
      seat: this.seatPublic(), featured: this.phase === 'write' ? Math.min(this.featuredCount(), list.length) : this.total,
      standings: this.standings().slice(0, this.phase === 'over' ? 10 : 12), history: this.history.slice(-5).map((h) => ({ name: h.name, fooled: h.fooled, of: h.of })),
      awards: this.awards, highlights: this.highlights, gallery: this.gallery,
    };
  }
  view(p) {
    const c = this.cur, st = this.standings(), me = this.stats.get(p.id) || {};
    const sp = this.seatPublic();
    return {
      phase: this.phase, endsIn: this.endsIn(),
      written: !!this.sets.get(p.id), mySet: this.sets.get(p.id) || null, progress: { done: this.sets.size, of: this.room.players.size },
      seat: sp ? { ...sp, notVoted: undefined, mine: c.id === p.id, myVote: c.votes.has(p.id) ? c.votes.get(p.id) : null, gain: c.gains && p.id in c.gains ? c.gains[p.id] : null } : null,
      points: this.scores.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length, final: this.phase === 'over' ? st.slice(0, 10) : null,
      awards: this.phase === 'over' ? (this.awards || []).filter((a) => a.id === p.id).map((a) => ({ icon: a.icon, title: a.title, value: a.value })) : null,
      stats: this.phase === 'over' ? { right: me.right || 0, guesses: me.guesses || 0, fooled: me.fooled || 0 } : null,
    };
  }
}

module.exports = {
  key: 'truths', name: 'Two Truths & a Lie', min: 3, best: [4, 10], fields, defaults,
  create: (room, settings) => new Truths(room, settings),
};
