'use strict';
// Tune Buzz: a music quiz played on the TV's speakers (key `tune`). Every clip is ORIGINAL
// music made in code by the TV's Web Audio engine: snippets of JustGameBox's own soundtracks
// (public/box/scores/*.js) and melodies generated on the spot (public/box/games/tune.js).
// The server only picks what plays (round type, seed, the answer) and keeps the clock.
//
// Round types:
//   game    Which game?       a snippet of one of the box's soundtracks: which game is it from?
//   vibe    Guess the vibe    a generated tune in a style (spooky, beach, space…): which scene?
//   inst    Instrument ID     a short phrase on one instrument: which instrument?
//   hl      Higher or lower   two notes (is the 2nd HIGHER or LOWER?) or two beats (FASTER or SLOWER?)
//   finish  Finish the melody a phrase, then three endings: which one fits?
//   rhythm  Rhythm tap        tap along with the beat on your phone; scored on timing (clock-synced)
//
// Quiz rounds: card (3.5 s) -> clip (music; BUZZ to answer early for a speed bonus; a wrong
// buzz locks you out for that clip) -> last call (everyone else answers, no bonus) -> reveal.
// Rhythm rounds: card -> tap (count-in, then 12 beats) -> reveal.
// The last round is the GRAND FINALE: double points.
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rounds', label: 'Rounds', options: opt([[12, '12 rounds (~8 min)'], [16, '16 rounds (~10 min)'], [20, '20 rounds (~12 min)']]) },
  { key: 'seconds', label: 'Last call', options: opt([[8, '8 seconds'], [10, '10 seconds'], [15, '15 seconds']]) },
  { key: 'mix', label: 'Round mix', options: opt([['all', 'Everything'], ['quiz', 'No rhythm tapping']]) },
];
const defaults = { rounds: 16, seconds: 10, mix: 'all' };

const CARD_MS = 3800, LEAD_MS = 1300, REVEAL_MS = 6500, PICK_MS = 5000;
const BASE = 100, SPEED = 200, FIRST = 100, WRONG = 50, RHYTHM_MAX = 400;
const COUNT_BEATS = 4, TAP_BEATS = 12;

// "Which game?": soundtracks the box already has (their title themes, section A or B).
const GAMES = [
  ['bid', 'JustBid', '🚪'], ['blackjack', 'Blackjack Night', '🃏'], ['blanks', 'JustBlanks', '📝'], ['colormatch', 'Color Match', '🎨'],
  ['ducks', 'JustRaiseDucks', '🦆'], ['emoji', 'Emoji Charades', '🤔'], ['funny', 'JustFunny', '😂'], ['kingdoms', 'JustKingdoms', '🏰'],
  ['letters', 'Letter Rush', '🔤'], ['likely', 'Most Likely To…', '👑'], ['plinko', 'JustDrop', '🎯'], ['president', 'President', '🎩'],
  ['price', 'Price Panic', '🏷️'], ['sketch', 'JustSketch Relay', '✏️'], ['spectrum', 'Where Do You Stand?', '🧭'], ['summon', 'JustSummon', '⚔️'],
  ['trivia', 'Hot Take Trivia', '🧠'], ['truths', 'Two Truths & a Lie', '🤥'], ['whosaid', 'Who Said It?', '🗣️'], ['zombie', 'Zombie Survival', '🧟'],
  ['menu', 'The Main Menu', '📺'],
].map(([id, label, icon]) => ({ id, label, icon }));
// "Guess the vibe": the client file has a generator for every one of these.
const VIBES = [
  ['spooky', 'Haunted house', '👻'], ['beach', 'Beach party', '🏖️'], ['space', 'Outer space', '🚀'], ['western', 'Wild West', '🤠'],
  ['royal', 'Royal parade', '👑'], ['circus', 'Circus', '🎪'], ['lullaby', 'Bedtime lullaby', '🌙'], ['chase', 'Car chase', '🏎️'],
  ['underwater', 'Under the sea', '🐠'], ['jungle', 'Jungle trek', '🌴'], ['rainy', 'Rainy day blues', '🌧️'], ['spy', 'Secret agent', '🕵️'],
  ['arcade', 'Retro arcade', '👾'], ['fairy', 'Fairy forest', '🧚'],
].map(([id, label, icon]) => ({ id, label, icon }));
const INSTRUMENTS = [
  ['piano', 'Piano', '🎹'], ['trumpet', 'Trumpet', '🎺'], ['sax', 'Saxophone', '🎷'], ['strings', 'Violins', '🎻'], ['guitar', 'Guitar', '🎸'],
  ['banjo', 'Banjo', '🪕'], ['organ', 'Organ', '⛪'], ['musicbox', 'Music box', '🎁'], ['marimba', 'Marimba', '🪵'], ['flute', 'Flute', '🌬️'],
  ['choir', 'Choir', '🎤'], ['harp', 'Harp', '🌈'], ['whistle', 'Whistling', '😗'], ['tuba', 'Tuba', '🐘'],
].map(([id, label, icon]) => ({ id, label, icon }));
// Options that sound too alike never appear together.
const CLASH = { fairy: ['lullaby'], lullaby: ['fairy'], beach: ['underwater'], underwater: ['beach'], chase: ['spy'], spy: ['chase'],
  musicbox: ['harp'], harp: ['musicbox'], flute: ['whistle'], whistle: ['flute'] };
const TYPES = {
  game: { title: 'Which game?', icon: '🎮', ask: 'Which JustGameBox game is this music from?' },
  vibe: { title: 'Guess the vibe', icon: '🌈', ask: 'Where would you hear this tune?' },
  inst: { title: 'Instrument ID', icon: '🎻', ask: 'Which instrument is playing?' },
  hl: { title: 'Higher or lower', icon: '↕️', ask: '' },
  finish: { title: 'Finish the melody', icon: '🧩', ask: 'Which ending fits the tune?' },
  rhythm: { title: 'Rhythm tap', icon: '🥁', ask: 'Tap along with the beat!' },
};
// The order rounds come in (the last one is always a Which game? finale).
const CYCLE = ['game', 'vibe', 'inst', 'hl', 'rhythm', 'game', 'finish', 'vibe', 'inst', 'hl', 'game', 'rhythm', 'finish', 'vibe', 'inst', 'game', 'hl', 'finish', 'vibe'];
// Clip lengths (the client generates music to fit them) and when buzzing opens.
function clipTiming(c) {
  switch (c.type) {
    case 'game': return { dur: 8000, buzzFrom: 0 };
    case 'vibe': return { dur: 8000, buzzFrom: 0 };
    case 'inst': return { dur: 6000, buzzFrom: 0 };
    case 'hl': return c.mode === 'pitch' ? { dur: 4200, buzzFrom: 2000 } : { dur: 6600, buzzFrom: 3400 };
    case 'finish': return { dur: 18400, buzzFrom: 9200 };
    default: return { dur: 6000, buzzFrom: 0 };
  }
}

class Game {
  constructor(room, s) {
    this.room = room;
    const pickNum = (v, list, d) => (list.includes(Number(v)) ? Number(v) : d);
    this.s = { rounds: pickNum(s.rounds, [12, 16, 20], 16), seconds: pickNum(s.seconds, [8, 10, 15], 10), mix: s.mix === 'quiz' ? 'quiz' : 'all' };
    // Every clip is original instrumental music and every label is all-ages, so the room's
    // family flag (default: family-safe) changes nothing today; it is kept for future packs.
    this.family = room.family !== false;
    this.phase = 'card'; this.round = 0; this.endsAt = 0; this.timer = null;
    this.points = new Map(); this.stats = new Map();
    this.cur = null; this.last = null; this.final = null;
    this.playlist = this.buildPlaylist();
    this.decks = { game: this.shuffle(GAMES.map((g) => g.id)), vibe: this.shuffle(VIBES.map((v) => v.id)), inst: this.shuffle(INSTRUMENTS.map((v) => v.id)) };
    this.pickTimers = new Map();
  }
  rint(n) { return Math.floor(this.room.rng() * n); }
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = this.rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  buildPlaylist() {
    const cyc = this.s.mix === 'quiz' ? CYCLE.filter((t) => t !== 'rhythm') : CYCLE;
    const out = []; for (let i = 0; out.length < this.s.rounds - 1; i++) out.push(cyc[i % cyc.length]);
    out.push('game'); return out;
  }
  draw(kind) { const d = this.decks[kind]; if (!d.length) this.decks[kind] = this.shuffle((kind === 'game' ? GAMES : kind === 'vibe' ? VIBES : INSTRUMENTS).map((x) => x.id)); return this.decks[kind].pop(); }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  stat(id) { let s = this.stats.get(id); if (!s) { s = { right: 0, wrong: 0, firsts: 0, fastest: null, rhythm: [], buzzRight: 0 }; this.stats.set(id, s); } return s; }
  start() { for (const p of this.room.list()) { this.points.set(p.id, 0); this.stat(p.id); } this.nextRound(); }
  joined(p) { if (!this.points.has(p.id)) { this.points.set(p.id, 0); this.stat(p.id); } }
  left() { this.maybeDone(); }
  active() { return this.room.list().filter((p) => p.bot || p.sockets > 0); }
  mult() { return this.round === this.playlist.length ? 2 : 1; }

  // ---------- round setup ----------
  options(pool, answer, n) {
    const clash = CLASH[answer] || [];
    const others = this.shuffle(pool.filter((x) => x.id !== answer && !clash.includes(x.id)));
    const picked = [];
    for (const o of others) { if (picked.length >= n - 1) break; if (picked.some((x) => (CLASH[x.id] || []).includes(o.id))) continue; picked.push(o); }
    return this.shuffle([pool.find((x) => x.id === answer), ...picked]);
  }
  makeClip(type) {
    const seed = 1 + this.rint(1e9);
    if (type === 'game') { const ans = this.draw('game'); return { type, seed, key: ans, sec: this.rint(2) ? 'A' : 'B', ans, choices: this.options(GAMES, ans, 4) }; }
    if (type === 'vibe') { const ans = this.draw('vibe'); return { type, seed, style: ans, ans, choices: this.options(VIBES, ans, 4) }; }
    if (type === 'inst') { const ans = this.draw('inst'); return { type, seed, inst: ans, ans, choices: this.options(INSTRUMENTS, ans, 4) }; }
    if (type === 'hl') {
      const hard = this.round > this.playlist.length / 2;
      if (this.rint(2)) {
        const a = 57 + this.rint(12), d = (hard ? 1 : 2) + this.rint(hard ? 4 : 5), up = !!this.rint(2);
        return { type, seed, mode: 'pitch', a, b: a + (up ? d : -d), ans: up ? 'up' : 'down', choices: [{ id: 'up', label: 'HIGHER', icon: '⬆️' }, { id: 'down', label: 'LOWER', icon: '⬇️' }] };
      }
      const a = 92 + this.rint(30), d = (hard ? 10 : 18) + this.rint(14), up = !!this.rint(2);
      return { type, seed, mode: 'tempo', a, b: a + (up ? d : -d), ans: up ? 'up' : 'down', choices: [{ id: 'up', label: 'FASTER', icon: '🐇' }, { id: 'down', label: 'SLOWER', icon: '🐢' }] };
    }
    if (type === 'finish') { const right = this.rint(3); return { type, seed, right, ans: 'e' + right, choices: [0, 1, 2].map((i) => ({ id: 'e' + i, label: `Ending ${i + 1}`, icon: ['1️⃣', '2️⃣', '3️⃣'][i] })) }; }
    // rhythm
    return { type, seed, bpm: 96 + this.rint(5) * 6, style: ['funk', 'rock', 'disco', 'march'][this.rint(4)] };
  }
  nextRound() {
    for (const h of this.pickTimers.values()) this.room.cancel(h); this.pickTimers.clear();
    if (this.round >= this.playlist.length) return this.end();
    this.round++;
    const type = this.playlist[this.round - 1];
    const c = this.makeClip(type); if (type !== 'rhythm') Object.assign(c, clipTiming(c)); this.cur = c;
    this.answers = new Map(); this.buzzes = new Map(); this.taps = new Map(); this.firstRight = null;
    this.phase = 'card'; this.last = null;
    this.room.fx(this.mult() > 1 ? 'finale' : 'round');
    this.setTimer(CARD_MS, () => (type === 'rhythm' ? this.startTap() : this.startClip()));
  }

  // ---------- quiz rounds ----------
  startClip() {
    const c = this.cur, t = clipTiming(c), now = this.room.now();
    c.dur = t.dur; c.buzzFrom = t.buzzFrom; c.at = now + LEAD_MS; c.buzzAt = c.at + t.buzzFrom; c.end = c.at + t.dur;
    this.phase = 'clip'; this.room.fx('clip');
    this.setTimer(LEAD_MS + t.dur, () => this.lastCall());
    this.botsBuzz();
  }
  lastCall() {
    if (this.phase !== 'clip') return;
    if (this.allIn()) return this.reveal();
    this.phase = 'last'; this.room.fx('last');
    this.setTimer(this.s.seconds * 1000, () => this.reveal());
    for (const p of this.room.list()) if (p.bot && !this.answers.has(p.id) && !this.isLocked(p.id)) {
      this.room.after(800 + this.room.rng() * (this.s.seconds * 700), () => { if (this.phase === 'last' && !this.answers.has(p.id)) { this.answer(p, this.botGuess(0.55)); } });
    }
  }
  botGuess(skill) { const c = this.cur; return this.room.rng() < skill ? c.ans : c.choices[this.rint(c.choices.length)].id; }
  botsBuzz() {
    const c = this.cur;
    for (const p of this.room.list()) if (p.bot && this.room.rng() < 0.45) {
      const at = c.buzzAt - this.room.now() + 400 + this.room.rng() * Math.max(500, c.end - c.buzzAt - 400);
      this.room.after(at, () => { if (this.phase !== 'clip') return; if (this.buzz(p).ok) this.room.after(600 + this.room.rng() * 2000, () => this.pick(p, this.botGuess(0.7))); });
    }
  }
  isLocked(id) { const b = this.buzzes.get(id); return !!(b && b.locked); }
  allIn() { return this.active().every((p) => this.answers.has(p.id) || this.isLocked(p.id)); }
  maybeDone() {
    if (this.phase === 'last' && this.allIn()) this.reveal();
    else if (this.phase === 'tap' && this.active().every((p) => (this.taps.get(p.id) || { done: false }).done)) { /* the beat plays to the end anyway */ }
  }
  buzz(p) {
    const c = this.cur, now = this.room.now();
    if (this.phase !== 'clip' || !c) return { ok: false, error: 'No buzzing right now.' };
    if (now < c.buzzAt) return { ok: false, error: 'Listen first! Buzzing opens in a moment.' };
    if (this.answers.has(p.id)) return { ok: false, error: 'You already answered.' };
    if (this.buzzes.has(p.id)) return this.isLocked(p.id) ? { ok: false, error: 'You’re locked out for this clip.' } : { ok: true };
    const b = { at: now, locked: false, open: true };
    this.buzzes.set(p.id, b); this.room.fx('buzz', { id: p.id });
    // Buzzing holds your answer for 5 seconds; let it run out and you're locked out.
    this.pickTimers.set(p.id, this.room.after(PICK_MS, () => { if (b.open && !this.answers.has(p.id)) { b.open = false; b.locked = true; b.timeout = true; this.stat(p.id).wrong++; this.room.fx('lockout', { id: p.id }); this.maybeDone(); } }));
    return { ok: true };
  }
  // A pick: right after a buzz (speed points) or in the last call.
  pick(p, id) {
    const c = this.cur; if (!c || (this.phase !== 'clip' && this.phase !== 'last')) return { ok: false, error: 'Not now.' };
    if (typeof id !== 'string' || !c.choices.some((x) => x.id === id)) return { ok: false, error: 'Pick one of the answers.' };
    if (this.answers.has(p.id)) return { ok: false, error: 'You already answered.' };
    const b = this.buzzes.get(p.id);
    if (b && b.locked) return { ok: false, error: 'You’re locked out for this clip.' };
    if (b && b.open) return this.buzzPick(p, b, id);
    if (this.phase !== 'last') return { ok: false, error: 'Buzz first to answer early!' };
    return this.answer(p, id);
  }
  buzzPick(p, b, id) {
    const c = this.cur, now = this.room.now();
    b.open = false; this.room.cancel(this.pickTimers.get(p.id)); this.pickTimers.delete(p.id);
    if (now - b.at > PICK_MS + 250) { b.locked = true; b.timeout = true; this.stat(p.id).wrong++; this.maybeDone(); return { ok: false, error: 'Too slow! You’re locked out for this clip.' }; }
    const right = id === c.ans;
    if (!right) {
      b.locked = true; b.pickId = id;
      const st = this.stat(p.id); st.wrong++;
      this.points.set(p.id, Math.max(0, (this.points.get(p.id) || 0) - WRONG * this.mult()));
      this.answers.set(p.id, { id, buzz: true, right: false, gain: -WRONG * this.mult(), at: b.at });
      this.room.fx('wrong', { id: p.id }); this.maybeDone();
      return { ok: true, right: false };
    }
    const span = Math.max(1, c.end - c.buzzAt), k = Math.max(0, Math.min(1, (c.end - b.at) / span));
    let gain = BASE + Math.round(SPEED * k / 10) * 10, first = false;
    if (!this.firstRight) { this.firstRight = p.id; first = true; gain += FIRST; }
    gain *= this.mult();
    this.answers.set(p.id, { id, buzz: true, right: true, gain, first, at: b.at, react: b.at - c.buzzAt });
    const st = this.stat(p.id); st.right++; st.buzzRight++; if (first) st.firsts++;
    const r = b.at - c.buzzAt; if (st.fastest == null || r < st.fastest) st.fastest = r;
    this.points.set(p.id, (this.points.get(p.id) || 0) + gain);
    this.room.fx('right', { id: p.id }); this.maybeDone();
    return { ok: true, right: true };
  }
  answer(p, id) {
    const c = this.cur, right = id === c.ans, gain = right ? BASE * this.mult() : 0;
    this.answers.set(p.id, { id, buzz: false, right, gain });
    const st = this.stat(p.id); if (right) st.right++;
    if (gain) this.points.set(p.id, (this.points.get(p.id) || 0) + gain);
    this.maybeDone();
    return { ok: true };
  }
  reveal() {
    if (this.phase !== 'clip' && this.phase !== 'last') return;
    for (const h of this.pickTimers.values()) this.room.cancel(h); this.pickTimers.clear();
    for (const [id, b] of this.buzzes) if (b.open && !this.answers.has(id)) { b.open = false; b.locked = true; b.timeout = true; this.stat(id).wrong++; }
    const c = this.cur, tally = {}; for (const ch of c.choices) tally[ch.id] = 0;
    for (const a of this.answers.values()) tally[a.id] = (tally[a.id] || 0) + 1;
    const right = [...this.answers].filter(([, a]) => a.right).sort((x, y) => (y[1].buzz - x[1].buzz) || ((x[1].at || 0) - (y[1].at || 0)));
    this.last = {
      ans: c.ans, answer: c.choices.find((x) => x.id === c.ans), tally,
      first: this.firstRight ? this.who(this.firstRight) : null,
      right: right.slice(0, 12).map(([id, a]) => ({ ...this.who(id), gain: a.gain, buzz: a.buzz, react: a.react != null ? a.react : null })), rightCount: right.length,
      lockouts: [...this.buzzes].filter(([, b]) => b.locked).map(([id]) => this.who(id)).slice(0, 10),
    };
    this.phase = 'reveal'; this.room.fx(right.length ? 'reveal' : 'nobody');
    this.setTimer(REVEAL_MS, () => this.nextRound());
  }

  // ---------- rhythm rounds ----------
  startTap() {
    const c = this.cur, now = this.room.now(), beat = Math.round(60000 / c.bpm);
    c.beatMs = beat; c.at = now + LEAD_MS; c.beatAt = c.at + COUNT_BEATS * beat; c.beats = TAP_BEATS; c.end = c.beatAt + TAP_BEATS * beat;
    this.phase = 'tap'; this.room.fx('clip');
    this.setTimer(c.end - now + 900, () => this.scoreTaps());
    for (const p of this.room.list()) if (p.bot) {
      const skill = 0.3 + this.room.rng() * 0.7, bias = (this.room.rng() - 0.5) * 80;
      for (let i = 0; i < TAP_BEATS; i++) {
        if (this.room.rng() > 0.2 + skill * 0.8) continue;
        const t = c.beatAt + i * beat + bias + (this.room.rng() - 0.5) * 2 * (25 + (1 - skill) * 110);
        this.room.after(t - now, () => { if (this.phase === 'tap') this.tap(p, t); });
      }
    }
  }
  tap(p, t) {
    const c = this.cur, now = this.room.now();
    if (this.phase !== 'tap' || !c) return { ok: false, error: 'Not now.', quiet: true };
    t = Number(t);
    if (!Number.isFinite(t)) return { ok: false, error: 'Bad tap.', quiet: true };
    // The phone sends its tap in server time (clock-synced). Trust it only near the real moment.
    if (Math.abs(t - now) > 1500) t = now;
    if (t < c.at - 500 || t > c.end + 800) return { ok: true, quiet: true };
    let rec = this.taps.get(p.id); if (!rec) { rec = { ts: [] }; this.taps.set(p.id, rec); }
    if (rec.ts.length >= TAP_BEATS * 4) return { ok: false, error: 'Easy, drummer!', quiet: true };
    rec.ts.push(Math.round(t));
    return { ok: true, quiet: true };
  }
  // Timing score: each beat takes its closest tap; a steady player's average lag (speakers,
  // Bluetooth) is forgiven up to 150 ms; extra taps (drumrolls) cost points.
  rhythmScore(ts) {
    const c = this.cur, beat = c.beatMs, half = beat / 2, errs = [];
    let extra = 0;
    for (let i = 0; i < c.beats; i++) {
      const b = c.beatAt + i * beat, near = ts.filter((t) => t >= b - half && t < b + half);
      if (!near.length) { errs.push(null); continue; }
      near.sort((x, y) => Math.abs(x - b) - Math.abs(y - b)); errs.push(near[0] - b); extra += near.length - 1;
    }
    const hit = errs.filter((e) => e != null).sort((a, b) => a - b);
    const bias = hit.length >= 3 ? Math.max(-150, Math.min(150, hit.reduce((a, b) => a + b, 0) / hit.length)) : 0;
    let raw = 0, perfect = 0;
    const marks = errs.map((e) => {
      if (e == null) return 0;
      const d = Math.abs(e - bias);
      if (d <= 45) { raw += 30; perfect++; return 3; }
      if (d <= 95) { raw += 20; return 2; }
      if (d <= 165) { raw += 10; return 1; }
      return 0;
    });
    raw = Math.max(0, raw - extra * 15);
    const acc = raw / (30 * c.beats);
    return { acc, perfect, marks, hits: hit.length, extra };
  }
  scoreTaps() {
    if (this.phase !== 'tap') return;
    const rows = [];
    for (const p of this.room.list()) {
      const rec = this.taps.get(p.id); if (!rec && !this.points.has(p.id)) continue;
      const r = this.rhythmScore(rec ? rec.ts : []);
      const gain = Math.round(r.acc * RHYTHM_MAX / 10) * 10 * this.mult();
      this.points.set(p.id, (this.points.get(p.id) || 0) + gain);
      this.stat(p.id).rhythm.push(r.acc);
      this.answers.set(p.id, { gain, acc: r.acc, marks: r.marks, perfect: r.perfect, tapped: !!rec });
      rows.push({ ...this.who(p.id), gain, acc: Math.round(r.acc * 100), marks: r.marks, perfect: r.perfect });
    }
    rows.sort((a, b) => b.acc - a.acc);
    this.last = { rhythm: true, rows: rows.slice(0, 12), more: Math.max(0, rows.length - 12), best: rows[0] && rows[0].acc > 0 ? rows[0] : null };
    this.phase = 'reveal'; this.room.fx('reveal');
    this.setTimer(REVEAL_MS, () => this.nextRound());
  }

  // ---------- the end ----------
  end() {
    this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.cur = null;
    const ids = [...this.points.keys()].filter((id) => this.room.get(id));
    const top = (fn, ok = (v) => v > 0, low = false) => {
      let best = null, who = [];
      for (const id of ids) { const v = fn(this.stat(id)); if (v == null || !ok(v)) continue; if (best == null || (low ? v < best : v > best)) { best = v; who = [id]; } else if (v === best) who.push(id); }
      return who.length ? { names: who.slice(0, 3).map((id) => this.room.name(id)), value: best } : null;
    };
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    this.final = {
      standings: this.standings(),
      awards: {
        ear: top((s) => s.right),
        finger: top((s) => s.fastest, (v) => v >= 0, true),
        metronome: top((s) => (s.rhythm.length ? Math.round(avg(s.rhythm) * 100) : null)),
        trigger: top((s) => s.wrong, (v) => v >= 2),
        first: top((s) => s.firsts),
      },
    };
    this.room.fx('win');
  }
  next() {
    if (this.phase === 'card') { this.room.cancel(this.timer); return this.cur.type === 'rhythm' ? this.startTap() : this.startClip(); }
    if (this.phase === 'clip') { this.room.cancel(this.timer); return this.lastCall(); }
    if (this.phase === 'last') return this.reveal();
    if (this.phase === 'tap') return this.scoreTaps();
    if (this.phase === 'reveal') return this.nextRound();
  }
  who(id) { const p = this.room.get(id); return { id, name: this.room.name(id), avatar: p ? p.avatar : '🙂', color: p ? p.color : '#888' }; }
  standings() { return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ ...this.who(id), points: pts })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)); }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }

  act(p, m) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'Unknown move.' };
    // Clock sync for rhythm rounds: the phone measures the round trip and lines its clock up.
    if (m.op === 'sync') return { ok: true, quiet: true, now: this.room.now() };
    if (this.phase === 'over') return { ok: false, error: 'The game is over.' };
    if (!this.points.has(p.id)) this.joined(p);
    if (m.op === 'buzz') return this.buzz(p);
    if (m.op === 'pick') return this.pick(p, m.id);
    if (m.op === 'tap') return this.tap(p, m.t);
    return { ok: false, error: 'Unknown move.' };
  }

  // ---------- screens ----------
  clipFor(full) {
    const c = this.cur; if (!c) return null;
    const T = TYPES[c.type], now = this.room.now();
    const out = { type: c.type, title: T.title, icon: T.icon, ask: c.type === 'hl' ? (c.mode === 'pitch' ? 'Is the second note HIGHER or LOWER?' : 'Is the second beat FASTER or SLOWER?') : T.ask, mode: c.mode || null };
    if (c.type !== 'rhythm') out.choices = c.choices;
    if (c.at != null) { out.atIn = c.at - now; out.endIn = c.end - now; }
    if (c.buzzAt != null) out.buzzIn = c.buzzAt - now;
    if (c.type === 'rhythm' && c.at != null) { out.beatMs = c.beatMs; out.beatAt = c.beatAt; out.beatIn = c.beatAt - now; out.beats = c.beats; out.count = COUNT_BEATS; out.bpm = c.bpm; }
    // Only the TV gets what to play (it includes the answer).
    if (full) { out.play = { ...c }; delete out.play.choices; }
    return out;
  }
  base() {
    return { phase: this.phase, round: this.round, of: this.playlist.length, mult: this.mult(), now: this.room.now(), endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, seconds: this.s.seconds };
  }
  tv() {
    const live = this.active();
    return {
      ...this.base(), clip: this.phase === 'over' ? null : this.clipFor(true), last: this.phase === 'reveal' ? this.last : null,
      answered: this.answers ? this.answers.size : 0, players: live.length,
      buzzed: this.buzzes ? [...this.buzzes].map(([id, b]) => ({ ...this.who(id), locked: b.locked, answered: this.answers.has(id), right: this.answers.has(id) ? this.answers.get(id).right : null })).slice(0, 16) : [],
      waiting: this.phase === 'last' ? live.filter((p) => !this.answers.has(p.id) && !this.isLocked(p.id)).map((p) => p.name).slice(0, 12) : null,
      next: this.round < this.playlist.length ? TYPES[this.playlist[this.round]].title : null,
      standings: this.standings().slice(0, 10), final: this.phase === 'over' ? this.final : null,
    };
  }
  view(p) {
    const b = this.buzzes && this.buzzes.get(p.id), a = this.answers && this.answers.get(p.id), st = this.standings(), rank = st.findIndex((r) => r.id === p.id) + 1;
    return {
      ...this.base(), clip: this.phase === 'over' ? null : this.clipFor(false), me: p.id,
      points: this.points.get(p.id) || 0, rank, ofPlayers: st.length,
      buzz: b ? { open: b.open, locked: b.locked, timeout: !!b.timeout, pickIn: b.open ? Math.max(0, b.at + PICK_MS - this.room.now()) : 0 } : null,
      mine: a ? { id: a.id || null, right: a.right, gain: a.gain, buzz: !!a.buzz, first: !!a.first, acc: a.acc != null ? Math.round(a.acc * 100) : null, marks: a.marks || null, perfect: a.perfect || 0 } : null,
      last: this.phase === 'reveal' ? this.last : null, final: this.phase === 'over' ? this.final : null,
    };
  }
}

module.exports = {
  key: 'tune', name: 'Tune Buzz', min: 2, best: [2, 16], fields, defaults, howSteps: 6,
  show: { facts: false }, // intro cutscene before the game (public/box/intros/tune.js)
  locked: { how: 'Finish a game of JustFunny to unlock it.' }, // public/unlocks.js + UNLOCK_RULES in box/room.js
  create: (room, settings) => new Game(room, settings),
  GAMES, VIBES, INSTRUMENTS, TYPES, clipTiming,
};
