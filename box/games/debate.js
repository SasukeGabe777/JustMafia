'use strict';
// Debate Club: a talking and performance game. Each debate puts two debaters in the spotlight
// with a silly topic and a side ("Is cereal a soup? You say YES."). The debate runs in timed
// phases: PREP (argument cards on the phone) → OPENING statements → REBUTTALS → one AUDIENCE
// QUESTION (picked by the room from questions phones send in) → a typed CLOSING LINE, read out.
// Everyone else is the audience: live reactions (👏 😂 🤔 🍅) float up on the TV and move the
// crowd meter, then they vote for the winner and pick the best line.
// Twists: SWAP SIDES (a surprise after the openings), LAWYER MODE (defend an object accused of a
// crime), HOT TAKES (rapid 20-second rounds, new pairs each time), TEAM DEBATE (big rooms).
// Debater points: vote share (up to 1000) + 200 for the win + crowd meter (up to 300) + best line
// (250). Audience points: +100 for backing the winner, +50 for picking the best line, +100 when
// the room picks your question. Content: box/games/debate-topics.js (family and party packs).
const T = require('./debate-topics');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'debates', label: 'Debates', options: opt([[2, '2 debates (~10 min)'], [3, '3 debates (~14 min)'], [4, '4 debates (~18 min)']]) },
  { key: 'speech', label: 'Speech length', options: opt([['short', 'Short (30 s openings)'], ['normal', 'Standard (45 s openings)'], ['long', 'Long (60 s openings)']]) },
  { key: 'twists', label: 'Twists', options: opt([['mix', 'Twists on (swap, lawyer, hot takes, teams)'], ['off', 'Classic debates only']]) },
  { key: 'pack', label: 'Topics', options: opt([['auto', 'Mixed (family-safe in Family mode)'], ['family', 'Family pack only'], ['party', 'Party pack (grown-up, clean)']]) },
];
const defaults = { debates: 3, speech: 'normal', twists: 'mix', pack: 'auto' };

const SPEECH = { short: { open: 30, rebut: 20, answer: 15 }, normal: { open: 45, rebut: 30, answer: 20 }, long: { open: 60, rebut: 40, answer: 25 } };
const MS = { intro: 7000, prep: 30000, teamPrep: 40000, swap: 6000, ask: 12000, askStock: 5000, write: 25000, closer: 7000, vote: 20000, result: 12000,
  hotIntro: 5000, hotFirst: 8000, hot: 20000, hotVote: 12000, hotResult: 7000 };
const FULL = { share: 1000, win: 200, meter: 300, best: 250 };
const HOT = { share: 400, win: 100, meter: 100, best: 0 };
const CALLED = 100, HOT_CALLED = 50, BEST_PICK = 50, ASKED = 100, TEAM_MULT = 0.7, HOT_MINIS = 3;
const REACT = { clap: { e: '👏', v: 1 }, laugh: { e: '😂', v: 1 }, think: { e: '🤔', v: 0.5 }, tomato: { e: '🍅', v: -1 } };
const REACT_GAP = 250, REACT_CAP = 30; // per player: one counted tap every 250 ms, 30 per speech
const STAGES = ['open', 'rebut', 'answer', 'close'];
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

class DebateClub {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'intro'; this.lineup = []; this.di = -1; this.d = null;
    this.scores = new Map(); this.stats = new Map(); this.turns = new Map(); this.charm = new Map();
    this.decks = {}; this.rseq = 0; this.cseq = 0; this.timer = null; this.flushT = null; this.endsAt = 0; this.stepMs = 0; this.stepKey = 0;
    this.lastReact = new Map();
  }
  // ---------- helpers ----------
  rng() { return this.room.rng(); }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  deal(key, src) { if (!this.decks[key] || !this.decks[key].length) this.decks[key] = this.shuffle(src.slice()); return this.decks[key].pop(); }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.stepMs = ms; this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  here(id) { return !!this.room.get(id); }
  pub(id) { const p = this.room.get(id); return p ? { id, name: p.name, avatar: p.avatar || '🙂', color: p.color } : { id, name: '—', avatar: '👻', color: '#888' }; }
  seat(p) {
    if (this.scores.has(p.id)) return;
    this.scores.set(p.id, 0); this.turns.set(p.id, 0); this.charm.set(p.id, 0.3 + this.rng() * 1.4);
    this.stats.set(p.id, { debates: 0, wins: 0, votes: 0, maxShare: 0, swapWins: 0, bestLines: 0, cheers: 0, tomatoes: 0, asked: 0, called: 0 });
  }
  // Family mode on the room (main menu ⚙, room.family === true) always wins. Without a clear
  // room flag the mixed pack stays family-safe; the party pack is the host's explicit choice.
  family() {
    if (this.room.family === true || this.s.pack === 'family') return true;
    if (this.s.pack === 'party') return false;
    return this.room.family !== false;
  }
  partyChance() { return this.family() ? 0 : this.s.pack === 'party' ? 0.65 : 0.4; }
  // Player-typed text: the room's word filter (on in family mode), then our own clean-up.
  text(s, max) { let t = clean(s, max); try { if (this.room.cleanText) t = clean(this.room.cleanText(t), max); } catch { /* keep ours */ } return t; }

  start() { for (const p of this.room.list()) this.seat(p); this.lineup = this.planLineup(); this.nextDebate(); }
  joined(p) { this.seat(p); } // joins the audience straight away
  left(p) {
    const d = this.d; if (!d || this.phase === 'over') return;
    if (!d.ids.length || d.ids.every((id) => !this.here(id))) return this.nextDebate();
    const st = d.steps[d.step];
    if (this.phase === 'speech' && st && this.speakerOf(d, st) === p.id) return this.advance();
    if (this.phase === 'prep') this.checkReady(d);
    if (this.phase === 'write') this.checkWritten(d);
    if (this.phase === 'vote' || this.phase === 'ask') this.checkVoted(d);
  }

  // ---------- the night's lineup ----------
  planLineup() {
    const n = this.room.list().length, D = Math.max(1, Math.min(6, Number(this.s.debates) || 3));
    let kinds = ['classic'];
    if (this.s.twists === 'off') { while (kinds.length < D) kinds.push('classic'); }
    else {
      const pool = this.shuffle(['swap', 'lawyer', 'hot']);
      if (n >= 8) pool.unshift('team'); // big rooms always get a team debate
      while (kinds.length < D) kinds.push(pool.length ? pool.shift() : this.rng() < 0.5 ? 'swap' : 'classic');
      const h = kinds.indexOf('hot'); if (h > 0) { kinds.splice(h, 1); kinds.push('hot'); } // hot takes close the night
    }
    const out = [];
    kinds.forEach((kind, i) => {
      if (kind === 'hot') for (let m = 1; m <= HOT_MINIS; m++) out.push({ kind, num: i + 1, mini: m, minis: HOT_MINIS });
      else out.push({ kind, num: i + 1 });
    });
    return out;
  }
  pickIds(k, avoid = new Set()) {
    const ids = this.room.list().map((p) => p.id).filter((id) => !avoid.has(id));
    this.shuffle(ids);
    // fewest turns first; real people go first among equals, most of the time
    const key = (id) => (this.turns.get(id) || 0) * 10 + (this.room.get(id).bot && this.rng() < 0.8 ? 1 : 0);
    ids.sort((a, b) => key(a) - key(b));
    return ids.slice(0, k);
  }
  topic(kind) {
    if (kind === 'lawyer') {
      const c = this.rng() < this.partyChance() ? this.deal('cp', T.CASES_PARTY) : this.deal('cf', T.CASES_FAMILY);
      return { q: `${c.who} stands accused of ${c.crime}.`, sides: ['NOT GUILTY', 'GUILTY'], roles: ['Defence', 'Prosecution'], case: { who: c.who, e: c.e, crime: c.crime } };
    }
    const str = this.rng() < this.partyChance() ? this.deal('party', T.PARTY) : this.deal('family', T.FAMILY);
    const p = str.split(' | ');
    return p.length === 3 ? { q: p[0], sides: [p[1], p[2]], yn: false } : { q: str, sides: ['YES', 'NO'], yn: true };
  }
  cardsFor(kind, n) {
    const out = [];
    if (kind === 'lawyer') out.push(this.deal('legal', T.LEGAL));
    while (out.length < n) { const c = this.deal('cards', T.CARDS); if (!out.includes(c)) out.push(c); }
    return out.map(([icon, title, hint]) => ({ icon, title, hint, played: false }));
  }

  nextDebate() {
    this.room.cancel(this.timer);
    this.di++;
    const item = this.lineup[this.di];
    if (!item) return this.finish();
    const n = this.room.list().length;
    let kind = item.kind;
    const t = n >= 10 ? 3 : 2;
    if (kind === 'team' && n < 2 * t + 1) kind = 'classic';
    const size = kind === 'team' ? t : 1;
    const ids = this.pickIds(size * 2);
    if (ids.length < 2) return this.finish();
    for (const id of ids) this.turns.set(id, (this.turns.get(id) || 0) + 1);
    const teams = kind === 'team' ? [ids.filter((_, i) => i % 2 === 0), ids.filter((_, i) => i % 2 === 1)] : [[ids[0]], [ids[1]]];
    const d = {
      key: this.di, kind, num: item.num, mini: item.mini || 0, minis: item.minis || 0, topic: this.topic(kind), teams, ids,
      swapped: false, steps: [], step: -1, segs: [], ready: new Set(), asks: new Map(), choices: null, qvotes: new Map(), question: null,
      closers: [null, null], writers: [teams[0][STAGES.indexOf('close') % teams[0].length], teams[1][STAGES.indexOf('close') % teams[1].length]],
      votes: new Map(), best: new Map(), meter: [0, 0], tally: [{ clap: 0, laugh: 0, think: 0, tomato: 0 }, { clap: 0, laugh: 0, think: 0, tomato: 0 }],
      reacts: [], card: null, bubble: null, gained: new Map(), result: null, cards: new Map(),
    };
    for (const id of ids) d.cards.set(id, this.cardsFor(kind, kind === 'hot' ? 2 : kind === 'team' ? 2 : 3));
    d.steps = this.buildSteps(d);
    this.d = d;
    this.room.fx(kind === 'hot' ? (d.mini === 1 ? 'hot' : 'round') : kind === 'lawyer' ? 'court' : kind === 'team' ? 'team' : 'debate', { kind });
    this.go(0);
  }
  buildSteps(d) {
    const S = SPEECH[this.s.speech] || SPEECH.normal, st = [];
    const speech = (stage, side, sec) => st.push({ ph: 'speech', stage, side, ms: sec * 1000 });
    if (d.kind === 'hot') {
      st.push({ ph: 'intro', ms: d.mini === 1 ? MS.hotFirst : MS.hotIntro });
      speech('hot', 0, MS.hot / 1000); speech('hot', 1, MS.hot / 1000);
      st.push({ ph: 'vote', ms: MS.hotVote }, { ph: 'result', ms: MS.hotResult });
      return st;
    }
    st.push({ ph: 'intro', ms: MS.intro }, { ph: 'prep', ms: d.kind === 'team' ? MS.teamPrep : MS.prep });
    speech('open', 0, S.open); speech('open', 1, S.open);
    if (d.kind === 'swap') st.push({ ph: 'swap', ms: MS.swap });
    speech('rebut', 1, S.rebut); speech('rebut', 0, S.rebut);
    st.push({ ph: 'ask', ms: MS.ask });
    speech('answer', 0, S.answer); speech('answer', 1, S.answer);
    st.push({ ph: 'write', ms: MS.write }, { ph: 'closer', side: 0, ms: MS.closer }, { ph: 'closer', side: 1, ms: MS.closer });
    st.push({ ph: 'vote', ms: MS.vote }, { ph: 'result', ms: MS.result });
    return st;
  }
  // Who speaks this step: teams rotate (opening: 1st member, rebuttal: 2nd, question: 3rd, closing: the writer).
  speakerOf(d, st) {
    if (!st || (st.ph !== 'speech' && st.ph !== 'closer')) return null;
    const team = d.teams[st.side];
    if (st.ph === 'closer') return d.writers[st.side];
    const k = Math.max(0, STAGES.indexOf(st.stage));
    let id = team[k % team.length];
    if (!this.here(id)) id = team.find((x) => this.here(x)) || id; // a teammate covers for someone who left
    return id;
  }
  stance(d, side) { return d.swapped ? 1 - side : side; }
  sideLabel(d, side) { return d.topic.sides[this.stance(d, side)]; }
  audience(d = this.d) { return this.room.list().filter((p) => !d || !d.ids.includes(p.id)).map((p) => p.id); }
  isDebater(d, id) { return !!d && d.ids.includes(id); }
  sideOf(d, id) { return d.teams[0].includes(id) ? 0 : d.teams[1].includes(id) ? 1 : -1; }

  // ---------- the step machine ----------
  go(i) {
    const d = this.d; if (!d) return;
    const st = d.steps[i];
    if (!st) return this.nextDebate();
    d.step = i; this.stepKey++;
    const key = this.stepKey;
    // A speech with nobody left to give it is skipped.
    if ((st.ph === 'speech' || st.ph === 'closer') && !this.here(this.speakerOf(d, st))) return this.go(i + 1);
    this.phase = st.ph; d.bubble = null;
    let ms = st.ms;
    if (st.ph === 'prep') this.botsPrep(d, key);
    else if (st.ph === 'speech' || st.ph === 'closer') {
      const id = this.speakerOf(d, st);
      d.segs.push({ stage: st.ph === 'closer' ? 'close' : st.stage, side: st.side, id, r: { clap: 0, laugh: 0, think: 0, tomato: 0 }, counted: new Map(), text: st.ph === 'closer' ? d.closers[st.side] : null });
      this.room.fx(st.ph === 'closer' ? 'closer' : 'mic', { side: st.side });
      this.botsSpeech(d, key, id, st);
      if (st.stage === 'open' && st.side === 0) this.botsAsk(d, key);
    } else if (st.ph === 'swap') { d.swapped = true; this.room.fx('swap'); }
    else if (st.ph === 'ask') {
      const subs = [...d.asks].filter(([id]) => this.here(id));
      if (subs.length) {
        d.choices = this.shuffle(subs).slice(0, 4).map(([id, text]) => ({ id, text }));
        this.botsQVote(d, key);
      } else {
        d.choices = null; ms = MS.askStock;
        d.question = { text: this.deal(d.kind === 'lawyer' ? 'cq' : 'q', d.kind === 'lawyer' ? T.CASE_QUESTIONS : T.QUESTIONS), by: null };
      }
      this.room.fx('ask');
    } else if (st.ph === 'write') { this.room.fx('write'); this.botsWrite(d, key); }
    else if (st.ph === 'vote') { this.room.fx('vote'); this.botsVote(d, key); }
    else if (st.ph === 'result') this.score(d);
    else if (st.ph === 'intro' && d.mini <= 1) { /* the fx was played by nextDebate */ }
    this.setTimer(ms, () => { if (this.stepKey === key) this.advance(); });
  }
  advance() {
    const d = this.d; if (!d || this.phase === 'over') return;
    if (this.phase === 'ask') this.resolveAsk(d);
    this.go(d.step + 1);
  }
  soon(ms = 800) { const key = this.stepKey; this.setTimer(ms, () => { if (this.stepKey === key) this.advance(); }); }
  checkReady(d) { if (this.phase === 'prep' && d.ids.filter((id) => this.here(id)).every((id) => d.ready.has(id))) this.soon(900); }
  checkWritten(d) { if (this.phase === 'write' && d.writers.filter((id) => this.here(id)).every((id) => d.closers[this.sideOf(d, id)] != null)) this.soon(900); }
  checkVoted(d) {
    const aud = this.audience(d); if (!aud.length) return;
    if (this.phase === 'ask' && d.choices && aud.every((id) => d.qvotes.has(id))) this.soon(900);
    if (this.phase === 'vote' && aud.every((id) => d.votes.has(id) && (d.kind === 'hot' || d.best.has(id)))) this.soon(1000);
  }
  resolveAsk(d) {
    if (d.question || !d.choices) return;
    const n = d.choices.map(() => 0); for (const [, i] of d.qvotes) n[i]++;
    const top = Math.max(...n), tied = d.choices.map((_, i) => i).filter((i) => n[i] === top);
    const c = d.choices[tied[Math.floor(this.rng() * tied.length)]];
    d.question = { text: c.text, by: this.pub(c.id), votes: top };
    if (this.scores.has(c.id)) { this.add(d, c.id, ASKED); this.stats.get(c.id).asked++; }
  }
  add(d, id, pts) { if (!this.scores.has(id) || !pts) return; this.scores.set(id, this.scores.get(id) + pts); d.gained.set(id, (d.gained.get(id) || 0) + pts); }

  // ---------- scoring ----------
  score(d) {
    const P = d.kind === 'hot' ? HOT : FULL;
    const v = [0, 0]; for (const [, side] of d.votes) v[side]++;
    const total = v[0] + v[1], share = total ? [v[0] / total, v[1] / total] : [0.5, 0.5];
    const winner = v[0] > v[1] ? 0 : v[1] > v[0] ? 1 : null;
    const pos = d.meter.map((m) => Math.max(0, m)), sum = pos[0] + pos[1];
    const crowd = pos.map((m) => (sum > 0 ? Math.round((P.meter * m) / sum) : 0));
    // best line: the speech segment most of the audience picked (ties share it)
    const bc = d.segs.map(() => 0); for (const [, i] of d.best) if (bc[i] != null) bc[i]++;
    const btop = Math.max(0, ...bc), bestSegs = btop > 0 ? bc.map((c, i) => (c === btop ? i : -1)).filter((i) => i >= 0) : [];
    const breakdown = [];
    for (const side of [0, 1]) {
      const base = Math.round(P.share * share[side]), win = winner === side ? P.win : 0;
      for (const id of d.teams[side]) {
        const mult = d.kind === 'team' ? TEAM_MULT : 1;
        const best = P.best ? bestSegs.filter((i) => d.segs[i].id === id).length * P.best : 0;
        const row = { ...this.pub(id), side, share: Math.round(base * mult), win: Math.round(win * mult), crowd: Math.round(crowd[side] * mult), best };
        row.total = row.share + row.win + row.crowd + row.best;
        if (this.here(id)) {
          this.add(d, id, row.total);
          const s = this.stats.get(id);
          s.debates++; s.votes += v[side];
          if (winner === side) { s.wins++; if (d.kind === 'swap') s.swapWins++; }
          if (total >= 2) s.maxShare = Math.max(s.maxShare, share[side]);
          if (best) s.bestLines += best / P.best;
        }
        breakdown.push(row);
      }
    }
    let called = 0;
    for (const [id, side] of d.votes) if (winner !== null && side === winner) { this.add(d, id, d.kind === 'hot' ? HOT_CALLED : CALLED); if (this.stats.has(id)) this.stats.get(id).called++; called++; }
    for (const [id, i] of d.best) if (bestSegs.includes(i)) this.add(d, id, BEST_PICK);
    d.result = { votes: v, total, share: share.map((x) => Math.round(x * 100)), winner, crowd, breakdown, called,
      best: bestSegs.map((i) => ({ ...this.segPub(d, i), votes: btop })) };
    this.room.fx(winner === null ? 'tie' : 'gavel', { side: winner });
  }
  segPub(d, i) {
    const s = d.segs[i]; if (!s) return null;
    return { i, stage: s.stage, side: s.side, who: this.pub(s.id), text: s.text, label: this.stageLabel(d, s.stage) };
  }
  stageLabel(d, stage) {
    const law = d.kind === 'lawyer';
    return { open: law ? 'Opening argument' : 'Opening statement', rebut: law ? 'Cross-examination' : 'Rebuttal', answer: law ? 'Jury question' : 'Audience question', close: law ? 'Closing argument' : 'Closing line', hot: 'Hot take' }[stage] || stage;
  }
  finish() { this.room.cancel(this.timer); this.phase = 'over'; this.endsAt = 0; this.d = null; this.room.fx('win'); }
  next() { if (this.phase === 'over') return; if (!this.d) return this.nextDebate(); this.advance(); }

  // ---------- phone input ----------
  act(p, m) {
    const d = this.d;
    if (!m || typeof m.op !== 'string') return { ok: false, error: 'Unknown move.' };
    if (!this.scores.has(p.id)) this.seat(p);
    if (!d || this.phase === 'over') return { ok: false, error: 'The debate is over!' };
    const st = d.steps[d.step], deb = this.isDebater(d, p.id), side = this.sideOf(d, p.id);
    switch (m.op) {
      case 'react': {
        const R = REACT[m.e];
        if (!R) return { ok: false, error: 'Unknown reaction.' };
        if (deb) return { ok: false, error: 'Debaters can’t react… nice try! 😄' };
        if (this.phase !== 'speech' && this.phase !== 'closer') return { ok: false, quiet: true };
        const seg = d.segs[d.segs.length - 1]; if (!seg) return { ok: false, quiet: true };
        const now = this.room.now(), last = this.lastReact.get(p.id) || -1e9;
        if (now - last < REACT_GAP) return { ok: true, quiet: true };
        const c = seg.counted.get(p.id) || 0;
        if (c >= REACT_CAP) return { ok: true, quiet: true };
        this.lastReact.set(p.id, now); seg.counted.set(p.id, c + 1);
        seg.r[m.e]++; d.tally[seg.side][m.e]++; d.meter[seg.side] += R.v;
        const s = this.stats.get(seg.id); if (s) { if (m.e === 'tomato') s.tomatoes++; else s.cheers++; }
        d.reacts.push({ id: ++this.rseq, e: R.e, s: seg.side }); if (d.reacts.length > 30) d.reacts.shift();
        if (!this.flushT) this.flushT = this.room.after(300, () => { this.flushT = null; });
        return { ok: true, quiet: true };
      }
      case 'done': {
        if (!deb) return { ok: false, error: 'Only debaters can do that.' };
        if (this.phase === 'prep') { d.ready.add(p.id); this.checkReady(d); return { ok: true }; }
        if ((this.phase === 'speech' || this.phase === 'closer') && this.speakerOf(d, st) === p.id) { this.room.fx('pass'); this.advance(); return { ok: true }; }
        return { ok: false, error: 'It’s not your turn to speak.' };
      }
      case 'card': {
        if (!deb) return { ok: false, error: 'Only debaters have argument cards.' };
        if (this.phase !== 'speech' || this.speakerOf(d, st) !== p.id) return { ok: false, error: 'Play a card during your own speech.' };
        const cards = d.cards.get(p.id) || [], i = m.i;
        if (!Number.isInteger(i) || i < 0 || i >= cards.length) return { ok: false, error: 'Pick one of your cards.' };
        if (cards[i].played) return { ok: false, error: 'You already played that card.' };
        cards[i].played = true;
        d.card = { id: ++this.cseq, seg: d.segs.length - 1, side, icon: cards[i].icon, title: cards[i].title, hint: cards[i].hint, by: this.pub(p.id), at: this.room.now() };
        this.room.fx('card', { side });
        return { ok: true };
      }
      case 'ask': {
        if (deb) return { ok: false, error: 'The audience asks the questions!' };
        if (d.kind === 'hot') return { ok: false, error: 'No questions in hot takes!' };
        const askAt = d.steps.findIndex((x) => x.ph === 'ask');
        if (d.step >= askAt) return { ok: false, error: 'Too late: the question has been picked.' };
        const text = this.text(m.text, 90);
        if (text.length < 4) return { ok: false, error: 'Type a question (at least 4 letters).' };
        d.asks.set(p.id, /[?？]$/.test(text) ? text : text + '?');
        return { ok: true };
      }
      case 'qvote': {
        if (this.phase !== 'ask' || !d.choices) return { ok: false, error: 'Not now.' };
        if (deb) return { ok: false, error: 'The audience picks the question.' };
        const i = m.i;
        if (!Number.isInteger(i) || i < 0 || i >= d.choices.length) return { ok: false, error: 'Pick one of the questions.' };
        d.qvotes.set(p.id, i); this.checkVoted(d); return { ok: true };
      }
      case 'closer': {
        if (this.phase !== 'write') return { ok: false, error: 'Not now.' };
        const k = d.writers.indexOf(p.id);
        if (k < 0) return { ok: false, error: 'Your teammate writes the closing line.' };
        const text = this.text(m.text, 90);
        if (text.length < 3) return { ok: false, error: 'Write a closing line first.' };
        d.closers[k] = text; this.checkWritten(d); return { ok: true };
      }
      case 'vote': {
        if (this.phase !== 'vote') return { ok: false, error: 'Voting isn’t open.' };
        if (deb) return { ok: false, error: 'Debaters don’t vote. The crowd decides!' };
        const s = m.side;
        if (s !== 0 && s !== 1) return { ok: false, error: 'Pick a side.' };
        d.votes.set(p.id, s); this.checkVoted(d); return { ok: true };
      }
      case 'best': {
        if (this.phase !== 'vote' || d.kind === 'hot') return { ok: false, error: 'Not now.' };
        if (deb) return { ok: false, error: 'Debaters don’t vote.' };
        const i = m.i;
        if (!Number.isInteger(i) || i < 0 || i >= d.segs.length) return { ok: false, error: 'Pick one of the speeches.' };
        d.best.set(p.id, i); this.checkVoted(d); return { ok: true };
      }
    }
    return { ok: false, error: 'Unknown move.' };
  }

  // ---------- bots ----------
  later(d, key, ms, fn) { this.room.after(ms, () => { if (this.d === d && this.stepKey === key && this.phase !== 'over') fn(); }); }
  bot(id) { const p = this.room.get(id); return p && p.bot ? p : null; }
  botsPrep(d, key) { for (const id of d.ids) { const b = this.bot(id); if (b) this.later(d, key, 2000 + this.rng() * 8000, () => this.act(b, { op: 'done' })); } }
  botsSpeech(d, key, id, st) {
    const b = this.bot(id);
    if (b) {
      this.later(d, key, 900, () => { d.bubble = { side: st.side, text: st.ph === 'closer' ? null : T.BOT_LINES[Math.floor(this.rng() * T.BOT_LINES.length)] }; });
      if (st.ph === 'speech' && this.rng() < 0.6) this.later(d, key, 2500, () => { const cs = d.cards.get(id) || []; const i = cs.findIndex((c) => !c.played); if (i >= 0) this.act(b, { op: 'card', i }); });
      this.later(d, key, (st.ph === 'closer' ? 3500 : 6000) + this.rng() * 4000, () => this.act(b, { op: 'done' }));
    }
    // the audience bots react through the speech
    const fan = this.charm.get(id) || 1;
    for (const aid of this.audience(d)) {
      const ab = this.bot(aid); if (!ab) continue;
      const tick = () => {
        const r = this.rng() * (1 + fan);
        const e = r < 0.25 ? 'tomato' : r < 0.45 ? 'think' : r < 0.9 + fan * 0.3 ? 'clap' : 'laugh';
        this.act(ab, { op: 'react', e });
        this.later(d, key, 700 + this.rng() * 1800, tick);
      };
      this.later(d, key, 400 + this.rng() * 1500, tick);
    }
  }
  botsAsk(d, key) {
    for (const aid of this.audience(d)) { const ab = this.bot(aid); if (ab && this.rng() < 0.3) this.later(d, key, 1000 + this.rng() * 8000, () => this.act(ab, { op: 'ask', text: T.BOT_ASKS[Math.floor(this.rng() * T.BOT_ASKS.length)] })); }
  }
  botsQVote(d, key) { for (const aid of this.audience(d)) { const ab = this.bot(aid); if (ab) this.later(d, key, 1000 + this.rng() * 5000, () => this.act(ab, { op: 'qvote', i: Math.floor(this.rng() * d.choices.length) })); } }
  botsWrite(d, key) { for (const id of d.writers) { const b = this.bot(id); if (b) this.later(d, key, 2000 + this.rng() * 5000, () => this.act(b, { op: 'closer', text: T.BOT_CLOSERS[Math.floor(this.rng() * T.BOT_CLOSERS.length)] })); } }
  botsVote(d, key) {
    for (const aid of this.audience(d)) {
      const ab = this.bot(aid); if (!ab) continue;
      this.later(d, key, 1500 + this.rng() * (d.kind === 'hot' ? 5000 : 9000), () => {
        const m = d.meter, lean = (m[0] - m[1]) / (Math.abs(m[0]) + Math.abs(m[1]) + 4);
        this.act(ab, { op: 'vote', side: this.rng() < 0.5 + lean * 0.4 ? 0 : 1 });
        if (d.kind !== 'hot' && d.segs.length) {
          const w = d.segs.map((s) => 1 + Math.max(0, s.r.clap + s.r.laugh - s.r.tomato)); let t = this.rng() * w.reduce((a, b) => a + b, 0), i = 0;
          for (; i < w.length - 1; i++) { t -= w[i]; if (t <= 0) break; }
          this.act(ab, { op: 'best', i });
        }
      });
    }
  }

  // ---------- state for the screens ----------
  standings() {
    return [...this.scores].filter(([id]) => this.here(id)).map(([id, points]) => ({ ...this.pub(id), points, wins: this.stats.get(id).wins }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins);
  }
  // Player ids best-first once the game is over (for the party scoreboard across games).
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }
  awards() {
    const st = this.standings(), out = [];
    const top = (fn) => { let best = 0, who = []; for (const r of st) { const v = fn(this.stats.get(r.id)); if (v > best) { best = v; who = [r.name]; } else if (v === best && v > 0) who.push(r.name); } return best > 0 ? { names: who.slice(0, 3), value: best } : null; };
    const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    const A = [
      ['silver', '👅', 'Silver Tongue', (s) => s.bestLines, (v) => `${pl(v, 'best line')}`],
      ['crowd', '💖', 'Crowd Favourite', (s) => s.cheers, (v) => `${pl(v, 'cheer')} from the crowd`],
      ['flip', '🔄', 'Flip-flopper', (s) => s.swapWins, () => 'switched sides mid-debate… and won'],
      ['gavel', '🔨', 'Golden Gavel', (s) => s.wins, (v) => `${pl(v, 'debate')} won`],
      ['landslide', '🏔️', 'Landslide', (s) => (s.maxShare >= 0.6 ? Math.round(s.maxShare * 100) : 0), (v) => `won ${v}% of a vote`],
      ['question', '❓', 'Question Master', (s) => s.asked, (v) => `${pl(v, 'question')} picked by the room`],
      ['jury', '🔮', 'Jury Foreman', (s) => s.called, (v) => `backed the winner ${pl(v, 'time')}`],
      ['tomato', '🍅', 'Tomato Magnet', (s) => s.tomatoes, (v) => `caught ${pl(v, 'tomato')}`],
    ];
    for (const [k, icon, title, fn, txt] of A) { const t = top(fn); if (t) out.push({ k, icon, title, names: t.names, text: txt(t.value) }); }
    return out.slice(0, 6);
  }
  common() {
    const d = this.d, st = d && d.steps[d.step];
    const c = {
      phase: this.phase, endsIn: this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.room.now()) : 0, stepMs: this.stepMs, stepKey: this.stepKey,
      of: Number(this.s.debates) || 3,
    };
    if (!d) return c;
    const shownKind = d.kind === 'swap' && !d.swapped ? 'classic' : d.kind;
    const speaker = st ? this.speakerOf(d, st) : null;
    Object.assign(c, {
      dkey: d.key, n: d.num, kind: shownKind, mini: d.mini, minis: d.minis, swapped: d.swapped,
      topic: { q: d.topic.q, sides: d.topic.sides, roles: d.topic.roles || null, case: d.topic.case || null, yn: !!d.topic.yn },
      podiums: [0, 1].map((k) => ({ label: this.sideLabel(d, k), role: d.topic.roles ? d.topic.roles[k] : null, members: d.teams[k].map((id) => ({ ...this.pub(id), here: this.here(id) })), ready: d.teams[k].every((id) => d.ready.has(id) || !this.here(id)), speaking: speaker && d.teams[k].includes(speaker) ? speaker : null })),
      stage: st && st.ph === 'speech' ? st.stage : st && st.ph === 'closer' ? 'close' : null, stageLabel: st && (st.ph === 'speech' || st.ph === 'closer') ? this.stageLabel(d, st.ph === 'closer' ? 'close' : st.stage) : null,
      speakSide: st && (st.ph === 'speech' || st.ph === 'closer') ? st.side : null, speaker: speaker ? this.pub(speaker) : null,
      question: d.question ? { text: d.question.text, by: d.question.by ? d.question.by.name : null } : null,
    });
    return c;
  }
  tv() {
    const d = this.d, c = this.common();
    if (this.phase === 'over') return { ...c, standings: this.standings().slice(0, 12), awards: this.awards(), players: this.scores.size };
    const aud = d ? this.audience(d) : [];
    const voting = this.phase === 'vote' || (this.phase === 'ask' && d.choices);
    const done = (id) => (this.phase === 'vote' ? d.votes.has(id) && (d.kind === 'hot' || d.best.has(id)) : d.qvotes.has(id));
    return {
      ...c,
      reacts: d.reacts.slice(-30), meter: d.meter, tally: d.tally,
      card: d.card && this.phase === 'speech' && d.card.seg === d.segs.length - 1 && this.room.now() - d.card.at < 8000 ? { id: d.card.id, side: d.card.side, icon: d.card.icon, title: d.card.title, hint: d.card.hint, by: d.card.by.name } : null,
      bubble: d.bubble,
      asked: d.asks.size, choices: this.phase === 'ask' && d.choices ? d.choices.map((q) => ({ text: q.text })) : null,
      closers: this.phase === 'closer' || this.phase === 'vote' || this.phase === 'result' ? d.closers : null, written: d.closers.map((x) => x != null),
      voted: voting ? aud.filter(done).length : 0, crowd: aud.length,
      waiting: voting && aud.length <= 16 ? aud.filter((id) => !done(id)).map((id) => this.room.name(id)) : null,
      result: this.phase === 'result' ? d.result : null,
      segs: this.phase === 'vote' && d.kind !== 'hot' ? d.segs.map((_, i) => this.segPub(d, i)) : null,
      standings: this.standings().slice(0, 8),
    };
  }
  view(p) {
    const d = this.d, c = this.common(), st = this.standings(), rank = st.findIndex((r) => r.id === p.id) + 1;
    const base = { ...c, me: p.id, points: this.scores.get(p.id) || 0, rank, ofPlayers: st.length };
    if (this.phase === 'over') return { ...base, awards: this.awards(), standings: st.slice(0, 10), mine: this.stats.get(p.id) || null };
    if (!d) return base;
    const step = d.steps[d.step], deb = this.isDebater(d, p.id), side = this.sideOf(d, p.id), speaker = this.speakerOf(d, step);
    const askAt = d.steps.findIndex((x) => x.ph === 'ask');
    return {
      ...base,
      role: deb ? 'debater' : 'audience', side, team: deb && d.kind === 'team' ? d.teams[side].map((id) => this.pub(id)) : null,
      myLabel: deb ? this.sideLabel(d, side) : null, myRole: deb && d.topic.roles ? d.topic.roles[side] : null,
      isSpeaker: speaker === p.id, cards: deb ? d.cards.get(p.id) : null, ready: d.ready.has(p.id),
      canAsk: !deb && d.kind !== 'hot' && askAt >= 0 && d.step < askAt && (this.phase === 'prep' || this.phase === 'speech' || this.phase === 'swap'), myAsk: d.asks.get(p.id) || null,
      choices: this.phase === 'ask' && d.choices ? d.choices.map((q) => ({ text: q.text, mine: q.id === p.id })) : null, myQ: d.qvotes.has(p.id) ? d.qvotes.get(p.id) : null,
      isWriter: d.writers.includes(p.id), myCloser: d.writers.includes(p.id) ? d.closers[d.writers.indexOf(p.id)] : null, writer: deb ? this.pub(d.writers[side]) : null,
      myVote: d.votes.has(p.id) ? d.votes.get(p.id) : null, myBest: d.best.has(p.id) ? d.best.get(p.id) : null,
      segs: this.phase === 'vote' && !deb && d.kind !== 'hot' ? d.segs.map((_, i) => this.segPub(d, i)) : null,
      result: this.phase === 'result' && d.result ? { winner: d.result.winner, votes: d.result.votes, share: d.result.share, best: d.result.best, row: d.result.breakdown.find((r) => r.id === p.id) || null } : null,
      gained: this.phase === 'result' ? d.gained.get(p.id) || 0 : 0,
    };
  }
}

module.exports = {
  key: 'debate', name: 'Debate Club', min: 3, best: [4, 14], howSteps: 6, fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/debate.js)
  locked: { how: 'Finish a game of Where Do You Stand? to unlock it.' }, // public/unlocks.js + UNLOCK_RULES in box/room.js
  create: (room, settings) => new DebateClub(room, settings),
  _test: { T, FULL, HOT, CALLED, BEST_PICK, ASKED, TEAM_MULT, REACT, SPEECH, MS, clean },
};
