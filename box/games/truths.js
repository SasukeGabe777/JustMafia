'use strict';
// Two Truths & a Lie: everyone types two true things and one lie about themselves on their
// phone. Then, one player at a time, the TV shows their three statements (shuffled) and
// everyone else votes for the lie. Guess right: +1. Fool people: +1 for each one you fooled.
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'writeSeconds', label: 'Time to write', options: opt([[90, '1½ minutes'], [120, '2 minutes'], [180, '3 minutes']]) },
  { key: 'voteSeconds', label: 'Time to vote', options: opt([[20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds']]) },
  { key: 'featured', label: 'Players in the hot seat', options: opt([[6, '6 players'], [10, '10 players'], [20, '20 players'], [100, 'Everyone']]) },
  { key: 'talk', label: 'Discussion before the vote', options: opt([[0, 'None'], [15, '15 seconds'], [30, '30 seconds']]) },
];
const defaults = { writeSeconds: 120, voteSeconds: 30, featured: 10, talk: 15 };
const REVEAL_SECONDS = 9;
const clean = (s) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);
// Statements for test bots (made up).
const BOT_FACTS = [
  ['I once ate 12 tacos in one sitting', 'I have never seen the ocean', 'I can whistle with my fingers'],
  ['I was born on a leap day', 'I own three pet snails', 'I have climbed a volcano'],
  ['I can’t swim', 'I once met a famous chef', 'I sleep with socks on'],
  ['I have a twin', 'I collect spoons', 'I broke my arm skateboarding'],
  ['I have been on TV', 'I hate chocolate', 'I can juggle four balls'],
  ['I once got lost in IKEA for two hours', 'I speak three languages', 'I have never ridden a bike'],
];

class Truths {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'write'; this.sets = new Map(); this.scores = new Map(); this.queue = []; this.cur = null; this.endsAt = 0; this.timer = null; this.history = [];
  }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  start() {
    for (const p of this.room.list()) this.scores.set(p.id, 0);
    this.setTimer(this.s.writeSeconds * 1000, () => this.beginRounds());
    let i = 0;
    for (const p of this.room.list()) if (p.bot) { const f = BOT_FACTS[i++ % BOT_FACTS.length]; this.room.after(2000 + this.room.rng() * 6000, () => this.act(p, { op: 'write', items: f, lie: Math.floor(this.room.rng() * 3) })); }
  }
  joined(p) { if (!this.scores.has(p.id)) this.scores.set(p.id, 0); }
  maybeAllWritten() {
    if (this.phase !== 'write') return;
    if (this.room.list().every((p) => this.sets.has(p.id))) { this.room.cancel(this.timer); this.endsAt = this.room.now() + 1500; this.timer = this.room.after(1500, () => this.beginRounds()); }
  }
  beginRounds() {
    if (this.phase !== 'write') return;
    const ids = [...this.sets.keys()].filter((id) => this.room.get(id));
    const r = this.room.rng; for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    // Humans first (they wrote their own), then bots, up to the setting.
    ids.sort((a, b) => Number(!!this.room.get(a).bot) - Number(!!this.room.get(b).bot));
    this.queue = ids.slice(0, this.s.featured); this.total = this.queue.length;
    if (!this.queue.length) { this.phase = 'over'; this.endsAt = 0; return; }
    this.nextSeat();
  }
  nextSeat() {
    const id = this.queue.shift();
    if (!id) { this.phase = 'over'; this.endsAt = 0; this.room.fx('win'); return; }
    const set = this.sets.get(id);
    // shuffle the three statements for display
    const order = [0, 1, 2]; const r = this.room.rng; for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    this.cur = { id, items: order.map((k) => set.items[k]), lie: order.indexOf(set.lie), votes: new Map(), n: this.total - this.queue.length };
    this.room.fx('flip');
    if (this.s.talk) { this.phase = 'talk'; this.setTimer(this.s.talk * 1000, () => this.openVote()); }
    else this.openVote();
  }
  openVote() {
    this.phase = 'vote'; this.room.fx('gavel');
    this.setTimer(this.s.voteSeconds * 1000, () => this.reveal());
    for (const p of this.room.list()) if (p.bot && p.id !== this.cur.id) this.room.after(1500 + this.room.rng() * 6000, () => { if (this.phase === 'vote') { this.cur.votes.set(p.id, Math.floor(this.room.rng() * 3)); this.maybeAllVoted(); } });
  }
  maybeAllVoted() { const voters = this.room.list().filter((p) => p.id !== this.cur.id); if (voters.every((p) => this.cur.votes.has(p.id))) this.reveal(); }
  reveal() {
    if (this.phase !== 'vote') return;
    const c = this.cur; let fooled = 0;
    for (const [pid, pick] of c.votes) { if (pick === c.lie) this.scores.set(pid, (this.scores.get(pid) || 0) + 1); else fooled++; }
    this.scores.set(c.id, (this.scores.get(c.id) || 0) + fooled);
    const tally = [0, 0, 0]; for (const v of c.votes.values()) tally[v]++;
    c.result = { tally, fooled, right: c.votes.size - fooled };
    this.history.push({ name: this.room.name(c.id), fooled, of: c.votes.size });
    this.phase = 'reveal'; this.room.fx(fooled > c.votes.size / 2 ? 'laugh' : 'cheer');
    this.setTimer(REVEAL_SECONDS * 1000, () => this.nextSeat());
  }
  next() { if (this.phase === 'write') { this.room.cancel(this.timer); this.beginRounds(); } else if (this.phase === 'talk') { this.room.cancel(this.timer); this.openVote(); } else if (this.phase === 'vote') { this.room.cancel(this.timer); this.reveal(); } else if (this.phase === 'reveal') { this.room.cancel(this.timer); this.nextSeat(); } }

  act(p, m) {
    if (m.op === 'write') {
      if (this.phase !== 'write') return { ok: false, error: 'Writing time is over.' };
      const items = Array.isArray(m.items) ? m.items.map(clean) : [];
      if (items.length !== 3 || items.some((x) => x.length < 3)) return { ok: false, error: 'Write all three (a few words each).' };
      const lie = Number(m.lie);
      if (![0, 1, 2].includes(lie)) return { ok: false, error: 'Mark which one is the lie.' };
      this.sets.set(p.id, { items, lie });
      this.maybeAllWritten();
      return { ok: true };
    }
    if (m.op === 'vote') {
      if (this.phase !== 'vote') return { ok: false, error: 'Voting isn’t open.' };
      if (p.id === this.cur.id) return { ok: false, error: 'Keep a straight face! You can’t vote on your own.' };
      const k = Number(m.pick); if (![0, 1, 2].includes(k)) return { ok: false, error: 'Pick 1, 2 or 3.' };
      this.cur.votes.set(p.id, k); this.maybeAllVoted();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }

  standings() { return [...this.scores].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), points: pts })).sort((a, b) => b.points - a.points); }
  tv() {
    const c = this.cur;
    return {
      phase: this.phase, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      written: this.sets.size, of: this.room.players.size, waiting: this.phase === 'write' ? this.room.list().filter((p) => !this.sets.has(p.id)).map((p) => p.name) : [],
      seat: c && this.phase !== 'write' ? { name: this.room.name(c.id), items: c.items, n: c.n, total: this.total, voted: c.votes.size, lie: this.phase === 'reveal' ? c.lie : null, result: this.phase === 'reveal' ? c.result : null } : null,
      standings: this.standings().slice(0, 12), history: this.history.slice(-5),
    };
  }
  view(p) {
    const c = this.cur, st = this.standings();
    return {
      phase: this.phase, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      written: !!this.sets.get(p.id), mySet: this.sets.get(p.id) || null,
      seat: c && this.phase !== 'write' ? { name: this.room.name(c.id), items: c.items, mine: c.id === p.id, lie: this.phase === 'reveal' ? c.lie : null, myVote: c.votes.has(p.id) ? c.votes.get(p.id) : null, result: this.phase === 'reveal' ? c.result : null, n: c.n, total: this.total } : null,
      points: this.scores.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length, final: this.phase === 'over' ? st.slice(0, 10) : null,
    };
  }
}

module.exports = {
  key: 'truths', name: 'Two Truths & a Lie', min: 3, fields, defaults,
  create: (room, settings) => new Truths(room, settings),
};
