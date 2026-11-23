'use strict';
// JustPitch: the improv pitch game (the evolution of JustSketch Relay). Each MATCH puts two
// players on stage. While one PRESENTS out loud (a fake product, book, scandal or gadget) with
// the TV as their stage and screen, the other is the SABOTEUR backstage: they drew the
// presenter's slides on their phone (JustSketch's sketchpad) and now flip to them, send cue cards
// ("Sing the next sentence") and mode tricks from their phone in real time. The TV shows the
// backstage feed. Then they SWAP with a new topic, and the rest of the room (the AUDIENCE)
// votes on their phones. Most votes wins the match.
//   Match: card → prep (both draw the other one's visuals at once) → ready → pitch (A) →
//          ready (SWAP) → pitch (B) → vote → result.
//   Format: round-robin (3–4 players, everyone meets everyone) or a single-elimination bracket
//           (byes for odd counts), champion at the end.
//   Modes (box/games/pitch-content.js): Focus Group, The Big Presentation, Buy My Book (the
//           audience rates 1–5 stars; stars count as votes), Press Conference (the audience
//           sends questions in), Late-Night Infomercial (demos, callers, price tags). Mixed
//           rotates them.
// Scoring: +100 a vote (+20 a star), +300 the match win, +50 a "nastiest saboteur" vote, +50 to
// voters who backed the winner, +10 per cue the presenter took on, +500 the champion.
const C = require('./pitch-content');
const { cleanStrokes } = require('./sketch');
const GEARS = require('../../public/shared/gear');
const PF = require('../party-fit');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'mode', label: 'Mode', options: opt([['mix', '🎲 Mixed: a different mode each match'], ['focus', '🗣️ Focus Group'], ['deck', '📊 The Big Presentation'], ['book', '📚 Buy My Book'], ['press', '🎙️ Press Conference'], ['tv', '📺 Late-Night Infomercial']]) },
  { key: 'format', label: 'Matchups', options: opt([['auto', 'Auto: by the number of players'], ['robin', 'Everyone vs everyone (up to 5)'], ['bracket', 'Bracket (knockout, byes for odd counts)'], ['quick', 'Quick bracket: one round, then the top two in the final']]) },
  { key: 'pitchSeconds', label: 'Pitch length', options: opt([[45, '45 seconds'], [60, '60 seconds'], [90, '90 seconds']]) },
  { key: 'prepSeconds', label: 'Time to draw slides', options: opt([[30, '30 seconds'], [45, '45 seconds'], [60, '60 seconds']]) },
  { key: 'pack', label: 'Content', options: opt([['mix', 'Everything (still clean)'], ['family', 'Family (all ages)'], ['party', 'Party (grown-up, still clean)']]) },
];
const defaults = { mode: 'mix', format: 'auto', pitchSeconds: 60, prepSeconds: 45, pack: 'mix' };

const MS = { match: 6000, ready: 5500, vote: 20000, result: 9000, bracket: 7000, soon: 900 };
const PTS = { vote: 100, star: 20, win: 300, nasty: 50, called: 50, ack: 10, said: 10, champ: 500 };
const COOLDOWN = 6000, REDEAL_MS = 3000, HAND = 4, MIN_END_MS = 20000, FEED = 8, MAX_ASKS = 6, ASK_LEN = 80, CUSTOM_LEN = 80;
const SLIDE_PTS = 4000; // points per drawn slide (JustSketch allows 8000 for a whole page)
const REACT_GAP = 300, REACT_CAP = 40, FX_PER_SECOND = 8;
const REACT_VAL = { '👏': 1, '😂': 1, '😬': 0.5, '🔥': 1, '🍅': -1 };
const ROBIN_MAX = 5;
const CUSTOM_KIND = { focus: 'script', deck: 'cue', book: 'quote', press: 'question', tv: 'demo' };
// When an unshown visual pops up by itself (the saboteur forgot): fractions of the pitch.
const AUTO_AT = { deck: [0.08, 0.38, 0.68], book: [0.04], focus: [0.04], tv: [0.04], press: [0.4] };
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

class Pitch {
  constructor(room, s) {
    this.room = room; this.s = s;
    this.phase = 'intro'; this.m = null; this.half = 0; this.no = 0; this.played = 0;
    this.scores = new Map(); this.stats = new Map(); this.wins = new Map(); this.reach = new Map();
    this.decks = {}; this.seq = 0; this.timer = null; this.endsAt = 0; this.stepKey = 0;
    this.format = 'robin'; this.queue = []; this.rounds = []; this.byes = new Set(); this.modeDeck = [];
    this.champion = null; this.awards = []; this.history = []; this.lastReact = new Map(); this.fxWin = { t: 0, n: 0 };
  }
  // ---------- helpers ----------
  rng() { return this.room.rng(); }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  here(id) { return !!(id && this.room.get(id)); }
  pub(id) { const p = this.room.get(id); return p ? { id, name: p.name, avatar: p.avatar || '🙂', color: p.color } : { id, name: '—', avatar: '👻', color: '#888' }; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; const key = ++this.stepKey; this.timer = this.room.after(ms, () => { if (this.stepKey === key) fn(); }); }
  soon(fn, ms = MS.soon) { this.setTimer(ms, fn); }
  later(ms, fn) { const key = this.stepKey, m = this.m; this.room.after(ms, () => { if (this.stepKey === key && this.m === m && this.phase !== 'over') fn(); }); }
  family() { return this.room.family === true || this.s.pack === 'family'; }
  // Deal from a list (topics / cards), family-safe when asked; the Party pack leans on the grown-up ones.
  deal(key, list, isParty = (x) => !!(x && (x.p || x[1] === 1))) {
    const fam = this.family();
    if (!fam && this.s.pack === 'party') { const party = list.filter(isParty); if (party.length && this.rng() < 0.4) return this.dealFrom(key + ':p', party); }
    return this.dealFrom(key + (fam ? ':f' : ''), fam ? list.filter((x) => !isParty(x)) : list);
  }
  dealFrom(key, list) { if (!this.decks[key] || !this.decks[key].length) this.decks[key] = this.shuffle(list.slice()); return this.decks[key].pop(); }
  seat(p) {
    if (this.scores.has(p.id)) return;
    this.scores.set(p.id, 0); this.wins.set(p.id, 0); this.reach.set(p.id, 0);
    this.stats.set(p.id, { votes: 0, stars: 0, nasty: 0, acks: 0, cheers: 0, sent: 0, matches: 0, said: 0 });
  }
  add(id, pts) { if (!pts || !this.scores.has(id)) return; this.scores.set(id, this.scores.get(id) + pts); if (this.m) this.m.gained.set(id, (this.m.gained.get(id) || 0) + pts); }
  inMatch(id, m = this.m) { return !!m && (m.a === id || m.b === id); }
  audienceIds(m = this.m) { return this.room.list().filter((p) => !this.inMatch(p.id, m)).map((p) => p.id); }
  H(m = this.m, half = this.half) { return m ? m.halves[half] : null; }

  // ---------- the matchups ----------
  start() {
    for (const p of this.room.list()) this.seat(p);
    const ids = this.shuffle(this.room.list().map((p) => p.id)), n = ids.length;
    const f = this.s.format;
    this.entrants = n;
    this.format = f === 'robin' ? (n <= ROBIN_MAX ? 'robin' : 'bracket') : f === 'bracket' || f === 'quick' ? f : n <= 4 ? 'robin' : n <= 8 ? 'bracket' : 'quick';
    if (this.format === 'robin') this.queue = this.robin(ids);
    else this.rounds.push(this.makeRound(ids, 0));
    this.nextMatch();
  }
  // Circle method: everyone meets everyone, nobody plays twice in a row where it can be helped.
  robin(ids) {
    const list = ids.slice(); if (list.length % 2) list.push(null);
    const n = list.length, out = [];
    for (let r = 0; r < n - 1; r++) {
      for (let i = 0; i < n / 2; i++) { const a = list[i], b = list[n - 1 - i]; if (a && b) out.push(r % 2 ? [b, a] : [a, b]); }
      list.splice(1, 0, list.pop());
    }
    return out;
  }
  makeRound(ids, r) {
    const list = ids.slice(); let bye = null;
    if (list.length % 2) {
      // The bye goes to someone who hasn't had one (people before bots), never twice if it can be helped.
      const fresh = list.filter((id) => !this.byes.has(id)), pool = fresh.length ? fresh : list;
      const humans = pool.filter((id) => { const p = this.room.get(id); return p && !p.bot; });
      bye = (humans.length ? humans : pool)[Math.floor(this.rng() * (humans.length || pool.length))];
      this.byes.add(bye); list.splice(list.indexOf(bye), 1);
    }
    const pairs = []; for (let i = 0; i + 1 < list.length; i += 2) pairs.push({ a: list[i], b: list[i + 1], w: null, played: false });
    return { r, pairs, bye };
  }
  totalMatches() {
    if (this.format === 'robin') return this.history.length + this.queue.length + (this.m && !this.m.done ? 1 : 0);
    return matchCount(this.entrants || 2, this.format);
  }
  roundName(r) {
    if (this.format === 'robin') return null;
    const R = this.rounds[r]; if (!R) return null;
    const left = R.pairs.length * 2 + (R.bye ? 1 : 0);
    return left <= 2 ? 'The Final' : left <= 4 ? 'Semi-finals' : left <= 8 ? 'Quarter-finals' : `Round ${r + 1}`;
  }
  pickMode() {
    if (this.s.mode !== 'mix' && C.MODES[this.s.mode]) return this.s.mode;
    if (!this.modeDeck.length) { this.modeDeck = this.shuffle(C.MODE_KEYS.slice()); if (this.lastMode && this.modeDeck[this.modeDeck.length - 1] === this.lastMode) this.modeDeck.unshift(this.modeDeck.pop()); }
    return (this.lastMode = this.modeDeck.pop());
  }
  nextMatch() {
    this.room.cancel(this.timer);
    if (this.s.maxMatches && this.played >= this.s.maxMatches) return this.finish();
    let pair = null;
    if (this.format === 'robin') {
      while (this.queue.length && !pair) { const [a, b] = this.queue.shift(); if (this.here(a) && this.here(b)) pair = { a, b }; }
      if (!pair) return this.finish();
    } else {
      const R = this.rounds[this.rounds.length - 1];
      for (const pr of R.pairs) {
        if (pr.played) continue;
        if (this.here(pr.a) && this.here(pr.b)) { pair = pr; break; }
        pr.played = true; pr.w = this.here(pr.a) ? pr.a : this.here(pr.b) ? pr.b : null; pr.walkover = true; // a walkover
        if (pr.w) this.reach.set(pr.w, (this.reach.get(pr.w) || 0) + 1);
      }
      if (!pair) {
        const next = R.pairs.map((pr) => pr.w).filter((id) => this.here(id));
        if (R.bye && this.here(R.bye)) { next.push(R.bye); this.reach.set(R.bye, (this.reach.get(R.bye) || 0) + 1); }
        if (next.length <= 1) { this.champion = next[0] || null; return this.finish(); }
        // Quick bracket: after one round, the two best winners (biggest share of the vote) meet in the final.
        if (this.format === 'quick' && next.length > 2) {
          const share = (id) => { const pr = R.pairs.find((x) => x.w === id); return pr && !pr.walkover && pr.share != null ? pr.share : 0.5; };
          const tie = new Map(next.map((id) => [id, this.rng()]));
          next.sort((x, y) => share(y) - share(x) || tie.get(x) - tie.get(y)); next.length = 2;
        }
        this.rounds.push(this.makeRound(next, this.rounds.length));
        this.m = null; this.phase = 'bracket'; this.room.fx('bracket', { round: this.rounds.length });
        this.setTimer(MS.bracket, () => this.nextMatch());
        return;
      }
    }
    const mode = this.pickMode(), M = C.MODES[mode];
    const half = (pres, sab) => {
      const h = { pres, sab, topic: this.deal('t:' + mode, C.TOPICS[mode]), visuals: null, heads: null, shown: -1, cue: null, feed: [], hand: [], cool: 0, redealAt: 0,
        acks: 0, sent: 0, meter: 0, cheers: 0, asks: [], asked: new Set(), panel: null, price: null, start: 0, bubble: null, counted: new Map() };
      h.heads = mode === 'deck' ? this.dealFrom('heads', C.SLIDE_HEADS).slice() : [M.visual];
      return h;
    };
    this.no++;
    const m = { no: this.no, a: pair.a, b: pair.b, pair: this.format === 'robin' ? null : pair, round: this.rounds.length - 1, mode,
      halves: [half(pair.a, pair.b), half(pair.b, pair.a)], votes: new Map(), stars: new Map(), nasty: new Map(), spec: null, result: null, gained: new Map(), done: false };
    this.m = m; this.half = 0;
    for (const id of [m.a, m.b]) this.stats.get(id).matches++;
    this.phase = 'match'; this.room.fx('match', { mode });
    this.setTimer(MS.match, () => this.prep());
  }

  // ---------- prep: both draw the other one's visuals at the same time ----------
  prep() {
    const m = this.m; if (!m) return;
    if (this.forfeitCheck()) return;
    this.phase = 'prep'; this.room.fx('prep');
    this.setTimer(this.s.prepSeconds * 1000, () => this.ready(0));
    for (const h of m.halves) {
      const b = this.bot(h.sab); if (b) this.later(2500 + this.rng() * Math.min(12000, this.s.prepSeconds * 500), () => this.act(b, { op: 'slides', strokes: h.heads.map(() => this.scribble()) }));
    }
    if (m.mode === 'press') for (const id of this.audienceIds()) { const b = this.bot(id); if (b && this.rng() < 0.4) this.later(2000 + this.rng() * 9000, () => this.act(b, { op: 'ask', text: C.BOT_ASKS[Math.floor(this.rng() * C.BOT_ASKS.length)] })); }
  }
  scribble() {
    const r = () => this.rng(), out = [], n = 2 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      let x = 150 + Math.floor(r() * 700), y = 200 + Math.floor(r() * 600); const p = [x, y], k = 4 + Math.floor(r() * 10);
      for (let j = 0; j < k; j++) { x = Math.max(0, Math.min(1000, x + Math.floor((r() - 0.5) * 180))); y = Math.max(0, Math.min(1000, y + Math.floor((r() - 0.5) * 180))); p.push(x, y); }
      out.push({ c: [0, 1, 4, 5, 6, 2][Math.floor(r() * 6)], s: 1 + Math.floor(r() * 3), p });
    }
    return out;
  }
  checkDrawn() { const m = this.m; if (this.phase === 'prep' && m.halves.every((h) => h.visuals || !this.here(h.sab))) this.soon(() => this.ready(0), 1200); }

  // ---------- the pitches ----------
  ready(half) {
    const m = this.m; if (!m) return;
    if (this.forfeitCheck()) return;
    this.half = half; this.phase = 'ready';
    const h = this.H(); if (!h.visuals) h.visuals = h.heads.map(() => []); // nothing drawn: blank slides (explain them anyway!)
    this.room.fx(half ? 'swap' : 'ready', { half });
    this.setTimer(MS.ready, () => this.pitch());
  }
  pitch() {
    const m = this.m, h = this.H(); if (!m) return;
    if (this.forfeitCheck()) return;
    this.phase = 'pitch'; h.start = this.room.now(); h.cool = 0;
    h.hand = []; for (let i = 0; i < HAND; i++) h.hand.push(this.card(m.mode));
    const T = this.s.pitchSeconds * 1000;
    this.room.fx('mic', { half: this.half });
    this.setTimer(T, () => this.endPitch());
    // Visuals the saboteur hasn't shown pop up by themselves, so every drawing gets its moment.
    (AUTO_AT[m.mode] || []).forEach((f, i) => this.later(T * f, () => { if (h.shown < i && h.visuals && i < h.visuals.length) this.reveal(h, i); }));
    // Focus Group: panelists (audience phones) get a line to shout now and then.
    if (m.mode === 'focus') for (const f of [0.3, 0.62]) this.later(T * f + this.rng() * 3000, () => { if (!h.panel || h.panel.said || this.room.now() - h.panel.at > 9000) this.panelist(h, { kind: 'panel', text: this.dealFrom('shout', C.PANEL_SHOUTS), auto: true }); });
    this.botsPitch(h, T);
  }
  card(mode) {
    const own = C.MODE_CARDS[mode] || [];
    const isParty = (c) => !!(Array.isArray(c) && c[c.length - 1] === 1 && typeof c[c.length - 1] === 'number');
    if (own.length && this.rng() < 0.65) { const c = this.deal('c:' + mode, own, isParty); return { id: ++this.seq, kind: c[0], text: c[1] }; }
    const c = this.deal('cues', C.CUES, isParty); return { id: ++this.seq, kind: 'cue', text: c[0] };
  }
  reveal(h, i) {
    if (!h.visuals || i >= h.visuals.length || i <= h.shown) return false;
    h.shown = i; this.room.fx('slide', { i }); return true;
  }
  send(h, c, by = null) {
    const now = this.room.now();
    const cue = { id: ++this.seq, kind: c.kind, text: c.text, by, at: now, acked: false };
    h.cue = cue; h.feed.push(cue); if (h.feed.length > FEED) h.feed.shift();
    h.sent++; h.cool = now + COOLDOWN; this.stats.get(h.sab) && this.stats.get(h.sab).sent++;
    if (c.kind === 'price') h.price = c.text;
    if (c.kind === 'panel') this.panelist(h, { kind: 'panel', text: c.text, cue });
    this.room.fx('cue', { kind: c.kind });
    const pb = this.bot(h.pres); if (pb) this.later(1800 + this.rng() * 2500, () => this.act(pb, { op: 'ack', id: cue.id }));
    return cue;
  }
  // A panelist (an audience phone, people before bots) gets a line to shout out.
  panelist(h, { text, auto }) {
    const aud = this.audienceIds().filter((id) => this.here(id));
    const humans = aud.filter((id) => !this.room.get(id).bot), pool = humans.length ? humans : aud;
    if (!pool.length) return null;
    const to = pool[Math.floor(this.rng() * pool.length)];
    h.panel = { id: ++this.seq, to, name: this.room.name(to), text, said: false, at: this.room.now(), auto: !!auto };
    this.room.fx('panel');
    const b = this.bot(to); if (b) { const id = h.panel.id; this.later(1500 + this.rng() * 2500, () => this.act(b, { op: 'said', id })); }
    return h.panel;
  }
  endPitch() {
    if (this.phase !== 'pitch') return;
    const h = this.H(); h.ended = true;
    if (this.half === 0) this.ready(1); else this.vote();
  }

  // ---------- the vote ----------
  vote() {
    const m = this.m; if (!m) return;
    if (this.forfeitCheck()) return;
    this.phase = 'vote'; this.room.fx('vote');
    this.setTimer(MS.vote, () => this.closeVote());
    const opts = [m.a, m.b].map((id, i) => ({ id: String(i), label: (this.room.name(id) || '?') + ': ' + m.halves[i].topic.n, avatar: this.pub(id).avatar, color: this.pub(id).color }));
    if (this.room.audienceCount && this.room.audienceCount() > 0) { const r = this.room.openPoll({ q: m.mode === 'book' ? 'Which book would you buy?' : C.MODES[m.mode].vote, options: opts, ms: MS.vote, onClose: (res) => { m.spec = res.counts; } }); m.pollId = r && r.ok ? r.id : null; }
    const voters = this.audienceIds();
    if (!voters.length) { this.setTimer(1500, () => this.closeVote()); return; }
    for (const id of voters) {
      const b = this.bot(id); if (!b) continue;
      this.later(1500 + this.rng() * 9000, () => {
        const lean = (m.halves[0].meter - m.halves[1].meter) / (Math.abs(m.halves[0].meter) + Math.abs(m.halves[1].meter) + 4);
        const side = this.rng() < 0.5 + lean * 0.35 ? 0 : 1;
        if (m.mode === 'book') { const hi = 3 + Math.floor(this.rng() * 3), lo = 1 + Math.floor(this.rng() * 3); this.act(b, { op: 'stars', side, n: hi }); this.act(b, { op: 'stars', side: 1 - side, n: lo }); }
        else this.act(b, { op: 'vote', side });
        if (this.rng() < 0.7) this.act(b, { op: 'nasty', side: Math.floor(this.rng() * 2) });
      });
    }
  }
  voted(id) { const m = this.m; if (m.mode === 'book') { const s = m.stars.get(id); return !!(s && s[0] && s[1]); } return m.votes.has(id); }
  checkVoted() { if (this.phase !== 'vote') return; const v = this.audienceIds(); if (v.length && v.every((id) => this.voted(id))) this.soon(() => this.closeVote(), 1000); }
  closeVote() {
    const m = this.m; if (this.phase !== 'vote' || !m) return;
    if (m.pollId != null) this.room.closePoll(m.pollId);
    const book = m.mode === 'book', tally = [0, 0], nasty = [0, 0];
    if (book) { for (const s of m.stars.values()) { tally[0] += s[0] || 0; tally[1] += s[1] || 0; } }
    else for (const side of m.votes.values()) tally[side]++;
    for (const side of m.nasty.values()) nasty[side]++;
    // Watchers in audience mode count too, at most as much as the players voting (a big crowd can't swamp the room).
    const spec = [Number((m.spec || {})['0']) || 0, Number((m.spec || {})['1']) || 0], sTot = spec[0] + spec[1];
    let specAdd = [0, 0];
    if (sTot) { const cap = Math.max(2, this.audienceIds().length), k = Math.min(1, cap / sTot) * (book ? 4 : 1); specAdd = spec.map((x) => Math.round(x * k)); tally[0] += specAdd[0]; tally[1] += specAdd[1]; }
    let winner = tally[0] > tally[1] ? 0 : tally[1] > tally[0] ? 1 : null, tie = null;
    if (winner === null) { // tie-break: the crowd meter, then a coin flip
      const a = m.halves[0].meter, b = m.halves[1].meter;
      winner = a > b ? 0 : b > a ? 1 : this.rng() < 0.5 ? 0 : 1; tie = a !== b ? 'crowd' : 'coin';
    }
    const ids = [m.a, m.b];
    // Votes are points for the presenter of that pitch; nasty votes for its saboteur (the other one).
    for (const side of [0, 1]) {
      const id = ids[side], st = this.stats.get(id);
      this.add(id, book ? tally[side] * PTS.star : tally[side] * PTS.vote);
      if (st) { if (book) st.stars += tally[side]; else st.votes += tally[side]; }
      const sab = m.halves[side].sab; this.add(sab, nasty[side] * PTS.nasty); if (this.stats.get(sab)) this.stats.get(sab).nasty += nasty[side];
      this.add(id, m.halves[side].acks * PTS.ack);
    }
    const w = ids[winner];
    this.add(w, PTS.win); this.wins.set(w, (this.wins.get(w) || 0) + 1);
    if (this.format === 'robin') this.reach.set(w, (this.reach.get(w) || 0) + 1);
    else if (m.pair) { m.pair.w = w; m.pair.played = true; m.pair.share = tally[0] + tally[1] ? tally[winner] / (tally[0] + tally[1]) : 0.5; this.reach.set(w, (this.reach.get(w) || 0) + 1); }
    if (!book) for (const [vid, side] of m.votes) if (side === winner) this.add(vid, PTS.called);
    if (book) for (const [vid, s] of m.stars) if ((s[winner] || 0) > (s[1 - winner] || 0)) this.add(vid, PTS.called);
    m.result = { tally, nasty, winner, tie, book, spec: specAdd, avg: book ? [0, 1].map((i) => { const n = [...m.stars.values()].filter((s) => s[i]).length; return n ? Math.round((tally[i] - specAdd[i]) / n * 10) / 10 : 0; }) : null };
    this.finishMatch();
  }
  // Someone left mid-match: the other one wins by walkover (no votes, just the win).
  forfeitCheck() {
    const m = this.m; if (!m || m.done) return false;
    const ha = this.here(m.a), hb = this.here(m.b);
    if (ha && hb) return false;
    if (m.pollId != null) this.room.closePoll(m.pollId);
    const winner = ha ? 0 : hb ? 1 : null, w = winner == null ? null : [m.a, m.b][winner];
    if (w) {
      this.add(w, PTS.win); this.wins.set(w, (this.wins.get(w) || 0) + 1);
      if (this.format === 'robin') this.reach.set(w, (this.reach.get(w) || 0) + 1);
    }
    if (m.pair) { m.pair.w = w; m.pair.played = true; m.pair.walkover = true; if (w) this.reach.set(w, (this.reach.get(w) || 0) + 1); }
    m.result = { tally: [0, 0], nasty: [0, 0], winner, tie: null, walkover: true, book: m.mode === 'book', spec: [0, 0], avg: null };
    this.finishMatch();
    return true;
  }
  finishMatch() {
    const m = this.m; m.done = true; this.played++;
    this.history.push({ no: m.no, a: m.a, b: m.b, mode: m.mode, w: m.result.winner == null ? null : [m.a, m.b][m.result.winner], topics: m.halves.map((h) => h.topic.n), tally: m.result.tally, walkover: !!m.result.walkover });
    this.phase = 'result'; this.room.fx(m.result.walkover ? 'walkover' : 'winner', { side: m.result.winner });
    this.setTimer(MS.result, () => this.nextMatch());
  }
  finish() {
    this.room.cancel(this.timer); this.endsAt = 0;
    if (!this.champion) { const st = this.standings(); this.champion = st.length ? st[0].id : null; }
    if (this.champion) { this.add(this.champion, PTS.champ); this.reach.set(this.champion, (this.reach.get(this.champion) || 0) + 1); }
    this.m = null; this.phase = 'over';
    this.awards = this.makeAwards();
    this.room.fx('win');
  }
  makeAwards() {
    const pick = (f, min = 1) => { let best = null, bv = 0; for (const [id, st] of this.stats) { if (!this.here(id)) continue; const v = f(st); if (v >= min && v > bv) { best = id; bv = v; } } return best ? { id: best, v: bv } : null; };
    const A = [];
    const add = (key, icon, title, r, detail) => { if (r) A.push({ key, icon, title, id: r.id, name: this.room.name(r.id), detail: detail(r.v) }); };
    add('tongue', '🎤', 'Silver Tongue', pick((s) => s.votes), (v) => `${v} vote${v === 1 ? '' : 's'} from the room`);
    add('bestseller', '⭐', 'Bestselling Author', pick((s) => s.stars), (v) => `${v} star${v === 1 ? '' : 's'} for their books`);
    add('saboteur', '😈', 'Chief Saboteur', pick((s) => s.nasty), (v) => `${v} “nastiest saboteur” vote${v === 1 ? '' : 's'}`);
    add('cool', '🧊', 'Unflappable', pick((s) => s.acks, 2), (v) => `took on ${v} cue card${v === 1 ? '' : 's'}`);
    add('crowd', '🔥', 'Crowd Pleaser', pick((s) => s.cheers, 5), (v) => `${v} cheers from the audience`);
    return A;
  }

  // ---------- host + phones ----------
  next() {
    const ph = this.phase;
    if (ph === 'match') this.prep();
    else if (ph === 'prep') this.ready(0);
    else if (ph === 'ready') this.pitch();
    else if (ph === 'pitch') this.endPitch();
    else if (ph === 'vote') this.closeVote();
    else if (ph === 'result' || ph === 'bracket') this.nextMatch();
  }
  joined(p) { this.seat(p); } // late joiners are the audience (they vote)
  left(p) {
    const m = this.m; if (!m || this.phase === 'over' || m.done) return;
    if (this.inMatch(p.id)) {
      // A presenter who leaves mid-pitch: the match ends there and the other one wins.
      if (['match', 'prep', 'ready', 'pitch', 'vote'].includes(this.phase)) this.forfeitCheck();
      return;
    }
    const h = this.H(); if (h && h.panel && h.panel.to === p.id) h.panel = null;
    if (this.phase === 'vote') this.checkVoted();
  }
  results() {
    if (this.phase !== 'over') return [];
    return this.standings().map((r) => r.id);
  }
  act(p, msg) {
    const m = this.m, mm = msg || {};
    if (typeof mm.op !== 'string') return { ok: false, error: 'Unknown move.' };
    if (!this.scores.has(p.id)) this.seat(p);
    if (this.phase === 'over') return { ok: false, error: 'The show is over!' };
    const h = this.H(), ph = this.phase;
    switch (mm.op) {
      case 'slides': {
        if (ph !== 'prep' || !m) return { ok: false, error: 'The slides are locked in.' };
        const hh = m.halves.find((x) => x.sab === p.id); if (!hh) return { ok: false, error: 'You’re not backstage this time.' };
        const list = mm.strokes;
        if (!Array.isArray(list) || !list.length || list.length > hh.heads.length) return { ok: false, error: 'Those slides didn’t arrive. Press Done again.' };
        const out = [];
        for (const raw of list) {
          const r = cleanStrokes(raw == null ? [] : raw, pensOf(p)); if (r.error) return { ok: false, error: r.error };
          if (r.strokes.reduce((n, s) => n + s.p.length / 2, 0) > SLIDE_PTS) return { ok: false, error: 'That slide is too detailed. Try fewer strokes.' };
          out.push(r.strokes);
        }
        while (out.length < hh.heads.length) out.push([]);
        hh.visuals = out; this.checkDrawn();
        return { ok: true };
      }
      case 'next': {
        if (ph !== 'pitch' || !h || h.sab !== p.id) return { ok: false, error: 'Only the saboteur flips the slides.' };
        if (!this.reveal(h, h.shown + 1)) return { ok: false, error: 'No slides left!' };
        return { ok: true };
      }
      case 'cue': case 'custom': {
        if (ph !== 'pitch' || !h) return { ok: false, error: 'Wait for the pitch to start.' };
        if (h.sab !== p.id) return { ok: false, error: 'Only the saboteur sends cue cards.' };
        const now = this.room.now();
        if (now < h.cool) return { ok: false, error: `Give them a second! (${Math.ceil((h.cool - now) / 1000)} s)` };
        if (mm.op === 'custom') {
          let text = clean(mm.text, CUSTOM_LEN); try { text = clean(this.room.cleanText(text), CUSTOM_LEN); } catch { /* keep */ }
          if (text.length < 3) return { ok: false, error: 'Type a few words first.' };
          this.send(h, { kind: CUSTOM_KIND[m.mode] || 'cue', text }, 'custom');
          return { ok: true };
        }
        if (mm.ask != null) { // Press Conference: a question from the audience
          const i = mm.ask; if (!Number.isInteger(i) || i < 0 || i >= h.asks.length) return { ok: false, error: 'Pick one of the questions.' };
          const q = h.asks.splice(i, 1)[0];
          this.send(h, { kind: 'question', text: q.text }, q.name);
          if (this.scores.has(q.id)) this.add(q.id, PTS.called);
          return { ok: true };
        }
        const i = mm.i; if (!Number.isInteger(i) || i < 0 || i >= h.hand.length) return { ok: false, error: 'Pick one of your cards.' };
        const c = h.hand[i]; h.hand[i] = this.card(m.mode);
        this.send(h, c);
        return { ok: true };
      }
      case 'redeal': {
        if (ph !== 'pitch' || !h || h.sab !== p.id) return { ok: false, error: 'Not now.' };
        const now = this.room.now(); if (now < h.redealAt) return { ok: false, error: 'Shuffling…' };
        h.redealAt = now + REDEAL_MS; h.hand = h.hand.map(() => this.card(m.mode));
        return { ok: true };
      }
      case 'ack': {
        if (ph !== 'pitch' || !h || h.pres !== p.id) return { ok: false, error: 'Not now.' };
        if (!h.cue || h.cue.acked || (mm.id != null && mm.id !== h.cue.id)) return { ok: true, quiet: true };
        h.cue.acked = true; h.acks++; this.stats.get(p.id).acks++; this.room.fx('ack');
        return { ok: true };
      }
      case 'end': {
        if (ph !== 'pitch' || !h || h.pres !== p.id) return { ok: false, error: 'It’s not your pitch.' };
        if (this.room.now() - h.start < MIN_END_MS) return { ok: false, error: 'Keep going a little longer!' };
        this.endPitch(); return { ok: true };
      }
      case 'react': {
        const v = REACT_VAL[mm.e]; if (v == null) return { ok: false, error: 'Unknown reaction.' };
        if (ph !== 'pitch' || !h) return { ok: false, quiet: true };
        if (this.inMatch(p.id)) return { ok: false, error: 'The audience reacts. You’re busy! 😄' };
        const now = this.room.now(); if (now - (this.lastReact.get(p.id) || -1e9) < REACT_GAP) return { ok: true, quiet: true };
        const n = h.counted.get(p.id) || 0; if (n >= REACT_CAP) return { ok: true, quiet: true };
        this.lastReact.set(p.id, now); h.counted.set(p.id, n + 1);
        h.meter += v; if (v > 0) { h.cheers++; this.stats.get(h.pres).cheers++; }
        if (now - this.fxWin.t >= 1000) this.fxWin = { t: now, n: 0 };
        if (++this.fxWin.n <= FX_PER_SECOND) this.room.fx('react', { e: mm.e });
        return { ok: true, quiet: true };
      }
      case 'said': {
        if (ph !== 'pitch' || !h || !h.panel || h.panel.to !== p.id || h.panel.said) return { ok: false, quiet: true };
        if (mm.id != null && mm.id !== h.panel.id) return { ok: false, quiet: true };
        h.panel.said = true; this.add(p.id, PTS.said); this.stats.get(p.id).said++; this.room.fx('said');
        return { ok: true };
      }
      case 'ask': {
        if (!m || m.mode !== 'press') return { ok: false, error: 'Questions are for the Press Conference.' };
        if (!['prep', 'ready', 'pitch'].includes(ph)) return { ok: false, error: 'Not now.' };
        if (this.inMatch(p.id)) return { ok: false, error: 'The press asks the questions!' };
        const tgt = ph === 'prep' ? m.halves[0] : h;
        if (tgt.asked.has(p.id)) return { ok: false, error: 'One question per press conference. It’s with the saboteur!' };
        let text = clean(mm.text, ASK_LEN); try { text = clean(this.room.cleanText(text), ASK_LEN); } catch { /* keep */ }
        if (text.length < 4) return { ok: false, error: 'Type a question (at least 4 letters).' };
        if (!/[?？]$/.test(text)) text += '?';
        tgt.asked.add(p.id); tgt.asks.push({ id: p.id, name: this.room.name(p.id), text }); if (tgt.asks.length > MAX_ASKS) tgt.asks.shift();
        // Questions sent during the first conference carry over to the second one too.
        if (ph === 'prep') { const t2 = m.halves[1]; if (!t2.asked.has(p.id)) { t2.asked.add(p.id); t2.asks.push({ id: p.id, name: this.room.name(p.id), text }); } }
        return { ok: true };
      }
      case 'vote': case 'nasty': {
        if (ph !== 'vote') return { ok: false, error: 'Voting isn’t open.' };
        if (this.inMatch(p.id)) return { ok: false, error: 'No voting in your own match!' };
        const side = mm.side; if (side !== 0 && side !== 1) return { ok: false, error: 'Pick one of the two.' };
        if (mm.op === 'vote') { if (m.mode === 'book') return { ok: false, error: 'Rate the books with stars.' }; m.votes.set(p.id, side); }
        else m.nasty.set(p.id, side);
        this.checkVoted(); return { ok: true };
      }
      case 'stars': {
        if (ph !== 'vote' || m.mode !== 'book') return { ok: false, error: 'Not now.' };
        if (this.inMatch(p.id)) return { ok: false, error: 'No rating your own book!' };
        const side = mm.side, n = mm.n;
        if ((side !== 0 && side !== 1) || !Number.isInteger(n) || n < 1 || n > 5) return { ok: false, error: 'Give it 1 to 5 stars.' };
        const s = m.stars.get(p.id) || [0, 0]; s[side] = n; m.stars.set(p.id, s);
        this.checkVoted(); return { ok: true };
      }
    }
    return { ok: false, error: 'Unknown move.' };
  }

  // ---------- bots ----------
  bot(id) { const p = this.room.get(id); return p && p.bot ? p : null; }
  botsPitch(h, T) {
    const sb = this.bot(h.sab), pb = this.bot(h.pres);
    if (sb) {
      const tick = () => {
        if (this.phase !== 'pitch' || this.H() !== h) return;
        const r = this.rng();
        if (h.visuals && h.shown + 1 < h.visuals.length && r < 0.3) this.act(sb, { op: 'next' });
        else if (h.asks.length && r < 0.6) this.act(sb, { op: 'cue', ask: 0 });
        else this.act(sb, { op: 'cue', i: Math.floor(this.rng() * h.hand.length) });
        this.later(COOLDOWN + 1500 + this.rng() * 6000, tick);
      };
      this.later(2500 + this.rng() * 3000, tick);
    }
    if (pb) {
      const talk = () => { if (this.phase !== 'pitch' || this.H() !== h) return; h.bubble = { id: ++this.seq, text: C.BOT_LINES[Math.floor(this.rng() * C.BOT_LINES.length)] }; this.later(4000 + this.rng() * 4000, talk); };
      this.later(1200, talk);
    }
    for (const id of this.audienceIds()) {
      const b = this.bot(id); if (!b) continue;
      const tick = () => { this.act(b, { op: 'react', e: C.REACTS[Math.floor(this.rng() * C.REACTS.length)] }); this.later(1500 + this.rng() * 3500, tick); };
      this.later(1000 + this.rng() * 3000, tick);
    }
  }

  // ---------- screens ----------
  standings() {
    const champ = this.champion;
    return [...this.scores].filter(([id]) => this.here(id)).map(([id, points]) => ({ ...this.pub(id), points, wins: this.wins.get(id) || 0, reach: this.reach.get(id) || 0, champ: id === champ }))
      .sort((a, b) => (b.champ - a.champ) || (b.reach - a.reach) || (b.points - a.points));
  }
  endsIn() { return this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0; }
  bracketPub() {
    if (this.format === 'robin') return null;
    const nm = (id) => (id ? { id, name: this.room.name(id) || '—', here: this.here(id) } : null);
    return this.rounds.map((R) => ({ name: this.roundName(R.r), bye: nm(R.bye), pairs: R.pairs.map((pr) => ({ a: nm(pr.a), b: nm(pr.b), w: pr.w, live: !!(this.m && this.m.pair === pr && !this.m.done), walkover: !!pr.walkover })) }));
  }
  modePub(mode) { const M = C.MODES[mode]; return { key: mode, icon: M.icon, name: M.name, short: M.short, visual: M.visual, visuals: M.visuals, vote: M.vote, role: M.role }; }
  halfPub(h, i, full) {
    const slide = h.shown >= 0 && h.visuals ? { i: h.shown, of: h.visuals.length, head: h.heads[h.shown] || '', strokes: h.visuals[h.shown] || [] } : null;
    return { i, pres: this.pub(h.pres), sab: this.pub(h.sab), topic: full ? h.topic : null, slide, of: h.heads.length, heads: h.heads, cue: h.cue, feed: h.feed.slice(-6),
      price: h.price, panel: h.panel ? { id: h.panel.id, name: h.panel.name, to: h.panel.to, text: h.panel.text, said: h.panel.said } : null, meter: Math.round(h.meter * 10) / 10,
      cheers: h.cheers, asks: h.asks.length, bubble: h.bubble, sent: h.sent, acks: h.acks };
  }
  tv() {
    const base = { phase: this.phase, n: this.no, of: this.totalMatches(), format: this.format, endsIn: this.endsIn(), standings: this.standings().slice(0, 10), bracket: this.bracketPub(), round: this.m ? this.roundName(this.m.round) : this.rounds.length ? this.roundName(this.rounds.length - 1) : null };
    if (this.phase === 'over') {
      return { ...base, standings: this.standings().slice(0, 12), champion: this.champion ? this.pub(this.champion) : null, awards: this.awards, history: this.history.slice(-12).map((x) => ({ ...x, a: this.pub(x.a), b: this.pub(x.b), w: x.w ? this.pub(x.w) : null })) };
    }
    if (this.phase === 'bracket') return base;
    const m = this.m; if (!m) return base;
    const out = { ...base, mode: this.modePub(m.mode), a: this.pub(m.a), b: this.pub(m.b), half: this.half };
    if (this.phase === 'prep') out.drawn = m.halves.map((h) => !!h.visuals);
    if (this.phase === 'ready' || this.phase === 'pitch') out.h = this.halfPub(this.H(), this.half, true);
    if (this.phase === 'ready' && this.half === 1) out.prev = { topic: m.halves[0].topic, cheers: m.halves[0].cheers, sent: m.halves[0].sent };
    if (this.phase === 'vote' || this.phase === 'result') {
      out.topics = m.halves.map((h) => h.topic);
      out.covers = m.halves.map((h) => (h.visuals && h.visuals[0]) || []);
      const voters = this.audienceIds(); out.voters = voters.length; out.voted = voters.filter((id) => this.voted(id)).length;
    }
    if (this.phase === 'result') {
      const r = m.result; out.result = { ...r, winnerId: r.winner == null ? null : [m.a, m.b][r.winner], gains: [m.a, m.b].map((id) => m.gained.get(id) || 0) };
    }
    return out;
  }
  view(p) {
    const st = this.standings(), rank = st.findIndex((x) => x.id === p.id) + 1, m = this.m;
    const base = { phase: this.phase, endsIn: this.endsIn(), points: this.scores.get(p.id) || 0, rank, players: st.length, n: this.no, of: this.totalMatches(), round: m ? this.roundName(m.round) : this.rounds.length ? this.roundName(this.rounds.length - 1) : null };
    if (this.phase === 'over') return { ...base, final: st.slice(0, 10), champion: this.champion ? this.pub(this.champion) : null, awards: this.awards.filter((a) => a.id === p.id), wins: this.wins.get(p.id) || 0 };
    if (!m) { const nx = this.format !== 'robin' && this.rounds.length ? this.rounds[this.rounds.length - 1] : null; return { ...base, alive: !!(nx && (nx.bye === p.id || nx.pairs.some((pr) => pr.a === p.id || pr.b === p.id))), bye: !!(nx && nx.bye === p.id) }; }
    const side = m.a === p.id ? 0 : m.b === p.id ? 1 : -1;
    const v = { ...base, mode: this.modePub(m.mode), a: this.pub(m.a), b: this.pub(m.b), side, half: this.half, gear: GEARS.gearSet(p, 'pitch') };
    if (this.phase === 'match') return v;
    if (this.phase === 'prep') {
      if (side >= 0) {
        const hh = m.halves[1 - side], own = m.halves[side]; // I sabotage the other half; I present my own
        v.task = { key: `${m.no}:${1 - side}`, heads: hh.heads, opp: this.pub(hh.pres), oppTopic: hh.topic, sent: !!hh.visuals };
        v.myTopic = own.topic;
      } else { v.canAsk = m.mode === 'press' && !m.halves[0].asked.has(p.id); }
      return v;
    }
    if (this.phase === 'ready' || this.phase === 'pitch') {
      const h = this.H(); v.topic = h.topic; v.pres = this.pub(h.pres); v.sab = this.pub(h.sab);
      v.role = h.pres === p.id ? 'pres' : h.sab === p.id ? 'sab' : 'aud';
      if (v.role === 'pres') { v.cue = h.cue; v.canEnd = this.phase === 'pitch' && this.room.now() - h.start >= MIN_END_MS; v.slide = h.shown >= 0 ? { i: h.shown, of: h.visuals.length } : null; }
      if (v.role === 'sab' && this.phase === 'pitch') {
        v.hand = h.hand; v.coolIn = Math.max(0, h.cool - this.room.now()); v.slidesLeft = h.visuals ? h.visuals.length - 1 - h.shown : 0; v.slideNo = h.shown + 1; v.slidesOf = h.visuals ? h.visuals.length : 0;
        v.heads = h.heads; v.asks = m.mode === 'press' ? h.asks.map((q) => ({ name: q.name, text: q.text })) : []; v.sent = h.sent; v.last = h.cue;
        v.customKind = CUSTOM_KIND[m.mode] || 'cue';
      }
      if (v.role === 'aud') {
        v.reacts = C.REACTS;
        if (h.panel && h.panel.to === p.id && !h.panel.said) v.panel = { id: h.panel.id, text: h.panel.text };
        v.canAsk = m.mode === 'press' && !h.asked.has(p.id);
      }
      return v;
    }
    if (this.phase === 'vote') {
      v.topics = m.halves.map((h) => h.topic); v.canVote = side < 0;
      v.myVote = m.votes.has(p.id) ? m.votes.get(p.id) : null; v.myNasty = m.nasty.has(p.id) ? m.nasty.get(p.id) : null; v.myStars = m.stars.get(p.id) || [0, 0];
      return v;
    }
    if (this.phase === 'result') { v.gain = m.gained.get(p.id) || 0; v.won = side >= 0 && m.result.winner === side; v.lost = side >= 0 && m.result.winner === 1 - side; v.winner = m.result.winner == null ? null : this.pub([m.a, m.b][m.result.winner]); v.walkover = !!m.result.walkover; return v; }
    return v;
  }
}
// Gear: a pen set adds colours to the saboteur's sketchpad (same as JustSketch).
const pensOf = (p) => { const pt = GEARS.paint('sketch', 'pens', GEARS.gearOf(p, 'sketch', 'pens')); return pt && Array.isArray(pt.pens) ? pt.pens.map((c) => c.toLowerCase()) : []; };

// ---------- Party Mode ----------
// One match: card + prep + 2 × (ready + pitch) + vote + result (+ a bracket card between rounds).
const matchMin = (pitch, prep) => (MS.match + prep * 1000 + 2 * (MS.ready + pitch * 1000) + MS.vote * 0.8 + MS.result) / 60000;
const matchCount = (P, format) => (format === 'robin' ? (P * (P - 1)) / 2 : format === 'quick' ? (P <= 2 ? 1 : Math.floor(P / 2) + 1) : Math.max(1, P - 1));
const partyFit = ({ players: P, minutes: M }) => {
  const formats = P <= 3 ? ['robin'] : P <= 4 ? ['robin', 'bracket'] : P <= 8 ? ['bracket', 'quick'] : ['quick', 'bracket'];
  const s = PF.best({ format: formats, pitchSeconds: [60, 45, 90], prepSeconds: [45, 30, 60] }, (x) => 0.5 + matchCount(P, x.format) * (matchMin(x.pitchSeconds, x.prepSeconds) + (x.format === 'robin' ? 0 : 0.08)), M);
  return { pitchSeconds: s.pitchSeconds, format: s.format, prepSeconds: s.prepSeconds, mode: 'mix' };
};

module.exports = {
  key: 'pitch', name: 'JustPitch', min: 3, best: [4, 10], fields, defaults, howSteps: 6, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/pitch.js)
  locked: { how: 'Finish a game of JustSketch Relay to unlock it.' }, // public/unlocks.js + UNLOCK_RULES in box/room.js
  partyFit,
  // Practice: one quick match (30 s to draw, 45 s pitches).
  practiceSettings: () => ({ maxMatches: 1, pitchSeconds: 45, prepSeconds: 30 }),
  create: (room, settings) => new Pitch(room, settings),
  _test: { C, MS, PTS, COOLDOWN, MIN_END_MS, SLIDE_PTS, CUSTOM_KIND, matchCount, matchMin },
};
