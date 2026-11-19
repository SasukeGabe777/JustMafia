'use strict';
// JustEscape: a co-op escape room told as a detective story. Detective Hazel Finch needs the
// players' help to open locked rooms and unmask the culprit (box/games/escape-rooms.js has the
// story, the rooms and Hazel's lines).
//
// Each room: Hazel's intro (phase 'story') → the locks (phase 'play'): every puzzle lock is
// split between phones, so one player holds the INPUT (the keypad, the clock hands, the switches,
// the lantern) and others hold the EVIDENCE (a journal, a photo, a map). Nobody can open a
// lock alone; the room talks. All puzzle locks are open at once; when they are all solved the
// final lock opens: everyone reads out their clues and votes for the culprit together.
// → 'outro' (solved or out of time) → the next room, or the case is closed ('over').
//
// Rooms: 1, 2 or 3 (about 15 / 30 / 45 minutes); difficulty easy / medium / hard, or 'climb'
// (easy → medium → hard). Bots (and players who drop out) work their locks on a timer, and
// whatever evidence they hold is shown to the others in that lock ("Bo read it out").
const { ROOMS, LINES, TRAITS, SYMBOLS, COLORS } = require('./escape-rooms');
const GEARS = require('../../public/shared/gear'); // JustGold gear: each detective's magnifier

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rooms', label: 'Case length', options: opt([[1, '1 room · about 15 min'], [2, '2 rooms · about 30 min'], [3, '3 rooms · about 45 min']]) },
  { key: 'difficulty', label: 'Difficulty', options: opt([['climb', 'Easy → Medium → Hard'], ['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']]) },
  { key: 'hints', label: 'Hints', options: opt([['on', 'Hazel can give hints'], ['off', 'No hints']]) },
];
const defaults = { rooms: 1, difficulty: 'climb', hints: 'on' };

const ROOM_MS = 15 * 60 * 1000, OUTRO_MS = 17000, TICK_MS = 1000, OFFLINE_MS = 10000, ACCUSE_PENALTY_MS = 60000;
const storyMs = (text) => Math.min(45000, 8000 + text.length * 62);
const DIFF = {
  easy: { label: 'Easy', locks: 2, suspects: 4, cipher: 3, legend: 6, split: false, twist: 0, switches: 4, key: false, word: 5, frags: 2, maze: 5, reset: false, negatives: false, bot: [35, 70] },
  medium: { label: 'Medium', locks: 3, suspects: 5, cipher: 4, legend: 8, split: false, twist: 1, switches: 5, key: true, word: 6, frags: 2, maze: 6, reset: false, negatives: true, bot: [50, 95] },
  hard: { label: 'Hard', locks: 4, suspects: 6, cipher: 5, legend: 10, split: true, twist: 2, switches: 6, key: true, word: 7, frags: 3, maze: 7, reset: true, negatives: true, bot: [65, 120] },
};
const PTS = { lock: 60, hands: 20, wrong: -10, vote: 50, room: 150, perSec: 1 / 6, hint: -25, roomMin: 50, failLock: 30 };
const MAX_HINTS = 2;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

class Game {
  constructor(room, s) {
    this.room = room; this.s = { ...defaults, ...s };
    this.s.rooms = Math.max(1, Math.min(3, Number(this.s.rooms) || 1));
    this.phase = 'story'; this.ri = -1; this.points = new Map(); this.stats = new Map();
    this.endsAt = 0; this.timer = null; this.ticker = null; this.events = []; this.history = [];
    this.locks = []; this.ready = new Set(); this.hazel = null; this.said = new Set();
  }
  rng() { return this.room.rng(); }
  rint(n) { return Math.floor(this.rng() * n); }
  pick(a) { return a[this.rint(a.length)]; }
  shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = this.rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  add(id, n) { if (!this.room.get(id)) return; this.points.set(id, Math.max(0, (this.points.get(id) || 0) + n)); }
  stat(id) { let r = this.stats.get(id); if (!r) { r = { locks: 0, opened: 0, wrong: 0, caught: 0, hints: 0 }; this.stats.set(id, r); } return r; }
  log(t, icon = '') { this.events.push({ t, icon, at: this.room.now() }); if (this.events.length > 6) this.events.shift(); }
  say(key, text) { this.hazel = { key, text: text || LINES[key] || '', at: this.room.now() }; this.room.fx('say', { line: key }); }
  diffOf(i) { return this.s.difficulty === 'climb' ? ['easy', 'medium', 'hard'][Math.min(2, i)] : DIFF[this.s.difficulty] ? this.s.difficulty : 'easy'; }
  live() { return this.room.list().filter((p) => p.bot || p.sockets > 0); }

  start() { for (const p of this.room.list()) this.points.set(p.id, 0); this.nextRoom(); }
  joined(p) { if (!this.points.has(p.id)) this.points.set(p.id, 0); if (this.phase === 'play') this.assignLate(p); }
  left() { if (this.phase === 'play') this.checkVotes(); if (this.phase === 'story') this.maybeGo(); }

  // ---------------- rooms ----------------
  nextRoom() {
    this.ri++;
    if (this.ri >= this.s.rooms) return this.end();
    this.R = ROOMS[this.ri]; this.dk = this.diffOf(this.ri); this.D = DIFF[this.dk];
    this.phase = 'story'; this.ready = new Set(); this.events = []; this.hints = 0; this.roomStart = 0;
    this.buildLocks();
    this.say('intro:' + this.R.key, this.R.intro);
    this.room.fx('story');
    this.setTimer(storyMs(this.R.intro), () => this.go());
    for (const p of this.room.list()) if (p.bot) this.ready.add(p.id);
  }
  maybeGo() { if (this.phase === 'story' && this.live().filter((p) => !p.bot).every((p) => this.ready.has(p.id))) this.go(); }
  go() {
    if (this.phase !== 'story') return;
    this.phase = 'play'; this.roomStart = this.room.now(); this.said = new Set();
    this.setTimer(ROOM_MS, () => this.finishRoom(false));
    this.say('start'); this.room.fx('go');
    this.room.cancel(this.ticker); this.ticker = this.room.after(TICK_MS, () => this.tick());
  }

  // ---------------- locks ----------------
  buildLocks() {
    const R = this.R, D = this.D, kinds = R.kinds.slice(0, D.locks);
    this.locks = kinds.map((k, i) => ({ id: i + 1, kind: k, ...R.props[k], ...this['make_' + k](D), solved: false, by: null, hintText: [], tries: 0, botAt: 0, roles: [] }));
    const fin = { id: this.locks.length + 1, kind: 'deduce', name: 'Who did it?', icon: '🔎', ...this.make_deduce(D), solved: false, by: null, hintText: [], tries: 0, roles: [] };
    this.locks.push(fin);
    this.assign();
  }
  // Symbols → numbers in a journal; the safe door shows symbols; the keypad wants the numbers.
  make_cipher(D) {
    const syms = this.shuffle(SYMBOLS).slice(0, D.legend), digits = this.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, D.legend);
    const map = new Map(syms.map((s, i) => [s, digits[i]]));
    const seq = this.shuffle(syms).slice(0, D.cipher), answer = seq.map((s) => map.get(s)).join('');
    const pairs = this.shuffle([...map]);
    const legends = D.split ? [pairs.filter((_, i) => i % 2 === 0), pairs.filter((_, i) => i % 2 === 1)] : [pairs];
    return {
      answer,
      parts: [
        ...legends.map((l, i) => ({ role: 'eyes', part: 'legend', label: legends.length > 1 ? `Code key, half ${i + 1} of 2` : null, data: { pairs: l } })),
        { role: 'eyes', part: 'engraving', data: { seq } },
        { role: 'hands', part: 'keypad', data: { len: D.cipher } },
      ],
    };
  }
  // A photo shows a clock; set the real clock to match (fixed by the note on medium / hard).
  make_dial(D) {
    const h = 1 + this.rint(12), m = this.rint(12) * 5;
    let ah = h, am = m, note = null;
    if (D.twist) {
      const dh = 1 + this.rint(3), fast = this.rng() < 0.5, dm = D.twist > 1 ? 5 * (1 + this.rint(5)) : 0;
      let total = (h % 12) * 60 + m + (fast ? -1 : 1) * (dh * 60 + dm); total = ((total % 720) + 720) % 720;
      ah = Math.floor(total / 60) || 12; am = total % 60;
      note = `The clock in the photo is ${dh} hour${dh > 1 ? 's' : ''}${dm ? ` and ${dm} minutes` : ''} ${fast ? 'fast' : 'slow'}. Set the real time.`;
    }
    return {
      answer: `${ah}:${am}`,
      parts: [
        { role: 'eyes', part: 'photo', data: { h, m } },
        ...(note ? [{ role: 'eyes', part: 'note', data: { text: note } }] : []),
        { role: 'hands', part: 'dial', data: {} },
      ],
    };
  }
  // A row of coloured switches; a card says which go up (by colour, or by symbol + a key card).
  make_switches(D) {
    const cols = this.shuffle(COLORS).slice(0, D.switches);
    let up = cols.map(() => this.rng() < 0.5); if (up.every(Boolean) || !up.some(Boolean)) up[0] = !up[0];
    const order = this.shuffle(cols.map((_, i) => i));
    const parts = [{ role: 'hands', part: 'panel', data: { switches: cols.map(([name, hex], i) => ({ n: i + 1, name, hex })) } }];
    if (D.key) {
      const syms = this.shuffle(SYMBOLS).slice(0, cols.length);
      parts.push({ role: 'eyes', part: 'pattern', data: { rows: order.map((i) => ({ sym: syms[i], up: up[i] })) } });
      parts.push({ role: 'eyes', part: 'key', data: { rows: this.shuffle(cols.map(([name, hex], i) => ({ sym: syms[i], name, hex }))) } });
    } else parts.push({ role: 'eyes', part: 'pattern', data: { rows: order.map((i) => ({ name: cols[i][0], hex: cols[i][1], up: up[i] })) } });
    return { answer: up.map((u) => (u ? 1 : 0)).join(''), parts };
  }
  // A word split over tags: each shows some letters and where they go.
  make_word(D) {
    const words = this.R.words[D.word] || this.R.words[5], w = this.pick(words);
    const pos = this.shuffle([...w].map((_, i) => i)), groups = Array.from({ length: D.frags }, () => []);
    pos.forEach((p, i) => groups[i % D.frags].push(p));
    return {
      answer: w,
      parts: [
        ...groups.map((g) => ({ role: 'eyes', part: 'tag', data: { len: w.length, letters: g.sort((a, b) => a - b).map((p) => ({ pos: p + 1, ch: w[p] })) } })),
        { role: 'hands', part: 'letters', data: { len: w.length } },
      ],
    };
  }
  // A dark grid: the map holder guides the lantern holder step by step.
  make_maze(D) {
    const n = D.maze;
    for (let tries = 0; tries < 200; tries++) {
      const walls = Array.from({ length: n * n }, () => (this.rng() < 0.3 ? 1 : 0));
      const start = 0, exit = n * n - 1 - this.rint(n); walls[start] = 0; walls[exit] = 0;
      const dist = this.mazeDist(walls, n, start);
      if (dist[exit] >= n + 2) return { answer: null, maze: { n, walls, start, exit, pos: start, bumps: 0 }, parts: [{ role: 'eyes', part: 'map', data: { n } }, { role: 'hands', part: 'lantern', data: { n } }] };
    }
    const walls = Array(n * n).fill(0); return { answer: null, maze: { n, walls, start: 0, exit: n * n - 1, pos: 0, bumps: 0 }, parts: [{ role: 'eyes', part: 'map', data: { n } }, { role: 'hands', part: 'lantern', data: { n } }] };
  }
  mazeDist(walls, n, from) {
    const d = Array(n * n).fill(-1); d[from] = 0; const q = [from];
    for (let i = 0; i < q.length; i++) { const c = q[i], x = c % n, y = Math.floor(c / n); for (const [dx, dy] of Object.values(DIRS)) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue; const k = ny * n + nx; if (!walls[k] && d[k] < 0) { d[k] = d[c] + 1; q.push(k); } } }
    return d;
  }
  // The line-up: suspects with a hat, a coat and something in hand; every phone gets clues.
  make_deduce(D) {
    const people = this.shuffle(this.R.suspects).slice(0, D.suspects), seen = new Set();
    const sus = people.map(([name, job], i) => {
      let t; do { t = { hat: this.pick(TRAITS.hat), coat: this.pick(TRAITS.coat), item: this.pick(TRAITS.item) }; } while (seen.has(t.hat + t.coat + t.item)); seen.add(t.hat + t.coat + t.item);
      return { id: i + 1, name, job, ...t };
    });
    const culprit = this.pick(sus);
    const says = (k, v, not) => ({ k, v, not, text: k === 'hat' ? (v === 'no hat' ? `The culprit ${not ? 'wore a hat' : 'wore no hat'}` : `The culprit ${not ? 'did not wear' : 'wore'} ${v}`) : k === 'coat' ? `The culprit’s coat ${not ? 'was not' : 'was'} ${v}` : `The culprit ${not ? 'was not carrying' : 'was carrying'} ${v}` });
    const fits = (s, c) => (c.not ? s[c.k] !== c.v : s[c.k] === c.v);
    const pool = [];
    for (const k of ['hat', 'coat', 'item']) {
      pool.push(says(k, culprit[k], false));
      if (D.negatives) for (const v of TRAITS[k]) if (v !== culprit[k]) pool.push(says(k, v, true));
    }
    let left = sus.slice(); const clues = [];
    for (const c of this.shuffle(pool)) {
      if (left.length <= 1) break;
      const keep = left.filter((s) => fits(s, c));
      // Hard cases prefer clues that only rule out one person at a time.
      if (keep.length < left.length && (D.negatives ? keep.length >= left.length - 2 || clues.length > 3 : true)) { clues.push(c); left = keep; }
    }
    if (left.length > 1) for (const c of pool) { if (left.length <= 1) break; const keep = left.filter((s) => fits(s, c)); if (keep.length < left.length) { clues.push(c); left = keep; } }
    // Everyone should have something to read out: pad with true (if unhelpful) clues.
    const extra = this.shuffle(pool.filter((c) => !clues.includes(c)));
    while (clues.length < Math.min(8, this.room.list().length) && extra.length) clues.push(extra.pop());
    return { answer: culprit.id, suspects: sus, clues: this.shuffle(clues).map((c) => c.text), parts: [] };
  }
  // Hand out the roles: in each lock the input and the evidence go to different people if possible.
  assign() {
    const ps = this.shuffle(this.room.list()).map((p) => p.id), n = ps.length; if (!n) return;
    let c = 0;
    for (const L of this.locks) {
      if (L.kind === 'deduce') continue;
      L.roles = [];
      // The controls first; then the evidence, never on the controls phone (unless playing solo),
      // spread over different people where there are enough of them.
      const parts = [...L.parts.filter((x) => x.role === 'hands'), ...L.parts.filter((x) => x.role !== 'hands')];
      let hands = null;
      for (const part of parts) {
        let id = ps[c % n], tries = 0;
        const bad = (x) => (n > 1 && x === hands) || (L.roles.some((r) => r.id === x) && tries < n);
        while (bad(id) && tries < 2 * n) { c++; id = ps[c % n]; tries++; }
        if (part.role === 'hands') hands = id;
        L.roles.push({ ...part, id }); c++;
      }
    }
    // Spare players get a copy of evidence in the smallest team.
    const has = new Set(this.locks.flatMap((L) => L.roles.map((r) => r.id)));
    for (const id of ps) if (!has.has(id)) this.giveCopy(id);
    // The final clues: spread over everyone.
    const fin = this.locks[this.locks.length - 1];
    fin.hold = new Map(ps.map((id) => [id, []]));
    fin.clues.forEach((t, i) => fin.hold.get(ps[i % n]).push(t));
    fin.votes = new Map();
  }
  giveCopy(id) {
    const open = this.locks.filter((L) => L.kind !== 'deduce' && !L.solved);
    if (!open.length) return;
    const L = open.sort((a, b) => new Set(a.roles.map((r) => r.id)).size - new Set(b.roles.map((r) => r.id)).size)[0];
    const eyes = L.roles.filter((r) => r.role === 'eyes'); if (!eyes.length) return;
    L.roles.push({ ...this.pick(eyes), id, copy: true });
  }
  assignLate(p) {
    if (this.locks.some((L) => L.roles.some((r) => r.id === p.id))) return;
    this.giveCopy(p.id);
    const fin = this.locks[this.locks.length - 1]; if (fin.hold && !fin.hold.has(p.id)) fin.hold.set(p.id, [this.pick(fin.clues)]);
  }
  lockById(id) { return this.locks.find((L) => L.id === id); }
  final() { return this.locks[this.locks.length - 1]; }
  puzzlesDone() { return this.locks.filter((L) => L.kind !== 'deduce').every((L) => L.solved); }
  holders(L) { return [...new Set(L.roles.map((r) => r.id))]; }
  handsOf(L) { const r = L.roles.find((x) => x.role === 'hands'); return r ? r.id : null; }
  // A bot or a player who dropped out: their evidence is read out to the rest of the lock.
  away(id) { const p = this.room.get(id); return !p || p.bot || (p.sockets <= 0 && this.room.now() - (p.goneAt || 0) > OFFLINE_MS); }

  solve(L, by) {
    if (L.solved) return;
    L.solved = true; L.by = by; L.at = this.room.now();
    for (const id of this.holders(L)) { this.add(id, PTS.lock); this.stat(id).locks++; }
    if (by) { this.add(by, PTS.hands); this.stat(by).opened++; }
    this.log(`${L.name} is open!`, '🔓'); this.say('lock'); this.room.fx('opened', { lock: L.id });
    if (this.puzzlesDone()) { this.say('accuse'); this.room.fx('accuse'); }
  }

  tick() {
    this.ticker = null;
    if (this.phase !== 'play') return;
    const now = this.room.now();
    for (const p of this.room.list()) { if (!p.bot && p.sockets <= 0 && !p.goneAt) p.goneAt = now; if (p.sockets > 0) p.goneAt = 0; }
    // Bots (and absent players) holding an input work it out after a while.
    for (const L of this.locks) {
      if (L.solved || L.kind === 'deduce') continue;
      const h = this.handsOf(L);
      if (!h || !this.away(h)) { L.botAt = 0; continue; }
      if (!L.botAt) { const [a, b] = this.D.bot; L.botAt = now + (a + this.rng() * (b - a)) * 1000; }
      else if (now >= L.botAt) this.solve(L, h);
    }
    // Bots vote once the line-up opens.
    if (this.puzzlesDone()) {
      const F = this.final();
      for (const p of this.room.list()) if (this.away(p.id) && this.room.get(p.id) && !F.votes.has(p.id)) {
        if (!F.botVoteAt) F.botVoteAt = now + 8000 + this.rng() * 10000;
        if (now >= F.botVoteAt) F.votes.set(p.id, this.rng() < 0.85 ? F.answer : this.pick(F.suspects).id);
      }
      this.checkVotes();
    }
    if (this.phase !== 'play') return;
    const left = this.endsAt - now;
    if (left <= ROOM_MS / 2 && !this.said.has('half')) { this.said.add('half'); this.say('half'); }
    if (left <= 60000 && !this.said.has('minute')) { this.said.add('minute'); this.say('minute'); }
    this.room.sync();
    this.ticker = this.room.after(TICK_MS, () => this.tick());
  }
  checkVotes() {
    if (this.phase !== 'play' || !this.puzzlesDone()) return;
    const F = this.final(), voters = this.live();
    if (!voters.length || !voters.every((p) => F.votes.has(p.id))) return;
    const tally = new Map(); for (const p of voters) tally.set(F.votes.get(p.id), (tally.get(F.votes.get(p.id)) || 0) + 1);
    const top = Math.max(...tally.values()), lead = [...tally].filter(([, n]) => n === top);
    if (lead.length > 1) { F.votes = new Map(); F.botVoteAt = 0; this.log('A tie! Talk it through and vote again.', '⚖️'); this.room.fx('tie'); return; }
    const pickId = lead[0][0];
    if (pickId === F.answer) {
      for (const p of voters) if (F.votes.get(p.id) === F.answer) { this.add(p.id, PTS.vote); this.stat(p.id).caught++; }
      F.solved = true; F.by = null; this.say('right'); this.room.fx('caught');
      this.finishRoom(true);
    } else {
      F.tries++; F.votes = new Map(); F.botVoteAt = 0; F.wrong = (F.wrong || []).concat(pickId);
      this.endsAt = Math.max(this.room.now() + 5000, this.endsAt - ACCUSE_PENALTY_MS);
      this.room.cancel(this.timer); this.timer = this.room.after(this.endsAt - this.room.now(), () => this.finishRoom(false));
      const s = F.suspects.find((x) => x.id === pickId);
      this.log(`${s ? s.name : 'They'} didn’t do it! (−1 minute)`, '❌'); this.say('wrongAccuse'); this.room.fx('wrongAccuse');
    }
  }
  finishRoom(cleared) {
    if (this.phase !== 'play') return;
    this.room.cancel(this.ticker); this.ticker = null;
    const now = this.room.now(), left = Math.max(0, Math.round((this.endsAt - now) / 1000)), everyone = this.room.list().map((p) => p.id);
    const opened = this.locks.filter((L) => L.solved && L.kind !== 'deduce').length;
    if (cleared) for (const id of everyone) this.add(id, Math.max(PTS.roomMin, PTS.room + Math.round(left * PTS.perSec) + PTS.hint * this.hints));
    else for (const id of everyone) this.add(id, PTS.failLock * opened);
    const stars = cleared ? (left >= 300 && this.hints <= 1 ? 3 : left >= 60 ? 2 : 1) : 0;
    const F = this.final(), culprit = F.suspects.find((s) => s.id === F.answer);
    this.history.push({ key: this.R.key, name: this.R.name, icon: this.R.icon, diff: this.D.label, cleared, stars, secs: Math.round((now - this.roomStart) / 1000), hints: this.hints, culprit: culprit ? culprit.name : '' });
    const last = this.ri + 1 >= this.s.rooms;
    const said = cleared ? this.R.solved : this.R.failed, epi = last && cleared ? this.R.epilogue : '';
    const text = said + (epi ? ' ' + epi : '');
    this.outro = { cleared, left, stars, culprit: culprit ? { ...culprit } : null, last };
    this.phase = 'outro';
    this.say((cleared ? 'solved:' : 'failed:') + this.R.key, cleared ? this.R.solved : this.R.failed);
    if (epi) this.room.after(storyMs(said) - 4000, () => { if (this.phase === 'outro') this.say('epilogue:' + this.R.key, epi); });
    this.room.fx(cleared ? 'win' : 'timeup');
    this.setTimer(Math.max(OUTRO_MS, storyMs(said)) + (epi ? storyMs(epi) - 4000 : 0), () => this.nextRoom());
    this.outroText = text;
  }
  end() { this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.room.cancel(this.ticker); this.room.fx('over'); }
  next() { if (this.phase === 'story') this.go(); else if (this.phase === 'play') this.finishRoom(false); else if (this.phase === 'outro') this.nextRoom(); }
  standings() { return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), avatar: (this.room.get(id) || {}).avatar, points: pts, ...this.stat(id) })).sort((a, b) => b.points - a.points); }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }

  // ---------------- phones ----------------
  hintFor(L, level) {
    const F = this.final();
    switch (L.kind) {
      case 'cipher': return level === 1 ? 'Whoever has the code key: read out every symbol and its number. Whoever sees the door: read the symbols in order, left to right.' : `The first number is ${L.answer[0]}.`;
      case 'dial': return level === 1 ? `Set the clock to the time in the photograph${L.parts.some((p) => p.part === 'note') ? ', then move it as the note says' : ''}.` : `The hour hand should point at ${L.answer.split(':')[0]}.`;
      case 'switches': return level === 1 ? `Read out which go up and which go down${L.parts.some((p) => p.part === 'key') ? '. The second card tells you which symbol is which colour' : ''}.` : `Switch 1 goes ${L.answer[0] === '1' ? 'up' : 'down'}.`;
      case 'word': return level === 1 ? 'Each tag shows letters and the spot they go in. Read them out with their numbers.' : `The word starts with ${L.answer[0]}.`;
      case 'maze': { const M = L.maze, d = this.mazeDist(M.walls, M.n, M.exit); const x = M.pos % M.n, y = Math.floor(M.pos / M.n); const step = Object.entries(DIRS).find(([, [dx, dy]]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < M.n && ny < M.n && d[ny * M.n + nx] === d[M.pos] - 1; }); return level === 1 ? 'Whoever has the map: say one step at a time. Up, down, left or right.' : `From where the light is now, go ${step ? step[0] : 'back to the start'}.`; }
      default: { const inn = F.suspects.filter((s) => s.id !== F.answer && !(F.wrong || []).includes(s.id)); return level === 1 ? 'Read every clue out loud, then cross off anyone who does not fit them all.' : `It was not ${inn.length ? this.pick(inn).name : 'anyone you already accused'}.`; }
    }
  }
  act(p, m) {
    const op = m && m.op;
    if (op === 'ready') { if (this.phase !== 'story') return { ok: false, error: 'Not now.' }; this.ready.add(p.id); this.maybeGo(); return { ok: true }; }
    if (this.phase !== 'play') return { ok: false, error: 'Wait for Hazel…' };
    if (op === 'vote') {
      if (!this.puzzlesDone()) return { ok: false, error: 'Open every lock first.' };
      const F = this.final(), s = F.suspects.find((x) => x.id === m.suspect);
      if (!s) return { ok: false, error: 'Pick one of the suspects.' };
      F.votes.set(p.id, s.id); this.checkVotes(); return { ok: true };
    }
    const L = this.lockById(m && m.lock);
    if (!['answer', 'move', 'hint'].includes(op)) return { ok: false, error: 'Unknown move.' };
    if (!L) return { ok: false, error: 'No such lock.' };
    if (L.solved) return { ok: false, error: 'That one is already open!' };
    if (op === 'hint') {
      if (this.s.hints === 'off') return { ok: false, error: 'Hints are off tonight.' };
      if (L.kind === 'deduce' && !this.puzzlesDone()) return { ok: false, error: 'Open the other locks first.' };
      if (L.kind !== 'deduce' && !this.holders(L).includes(p.id)) return { ok: false, error: 'Ask about a lock you are working on.' };
      if (L.hintText.length >= MAX_HINTS) return { ok: false, error: 'Hazel has told you all she knows about this one.' };
      L.hintText.push(this.hintFor(L, L.hintText.length + 1)); this.hints++; this.stat(p.id).hints++;
      this.log(`Hint for ${L.name}`, '💡'); this.say('hint'); this.room.fx('hint', { lock: L.id });
      return { ok: true };
    }
    if (L.kind === 'deduce') return { ok: false, error: 'Vote for a suspect.' };
    if (this.handsOf(L) !== p.id) return { ok: false, error: 'Someone else has the controls for this one. Tell them what you see!' };
    if (op === 'move') {
      if (L.kind !== 'maze') return { ok: false, error: 'Nothing to move here.' };
      const d = DIRS[m.dir]; if (!d) return { ok: false, error: 'Up, down, left or right.' };
      const M = L.maze, x = M.pos % M.n, y = Math.floor(M.pos / M.n), nx = x + d[0], ny = y + d[1];
      if (nx < 0 || ny < 0 || nx >= M.n || ny >= M.n || M.walls[ny * M.n + nx]) {
        M.bumps++; M.bumpAt = this.room.now(); if (this.D.reset) M.pos = M.start;
        return { ok: true, bump: true, reset: this.D.reset };
      }
      M.pos = ny * M.n + nx; M.trail = (M.trail || []).concat(M.pos).slice(-60);
      if (M.pos === M.exit) this.solve(L, p.id);
      return { ok: true, solved: L.solved };
    }
    // answer
    let v = m.value, right = false;
    if (L.kind === 'cipher') { v = String(v == null ? '' : v).replace(/\D/g, ''); if (v.length !== L.answer.length) return { ok: false, error: `Enter ${L.answer.length} numbers.` }; right = v === L.answer; }
    else if (L.kind === 'dial') { const h = Number(v && v.h), mi = Number(v && v.m); if (!Number.isInteger(h) || h < 1 || h > 12 || !Number.isInteger(mi) || mi < 0 || mi > 55 || mi % 5) return { ok: false, error: 'Set the hour and the minutes.' }; right = `${h}:${mi}` === L.answer; }
    else if (L.kind === 'switches') { v = String(v == null ? '' : v); if (!/^[01]+$/.test(v) || v.length !== L.answer.length) return { ok: false, error: 'Set every switch.' }; right = v === L.answer; }
    else if (L.kind === 'word') { v = String(v == null ? '' : v).toUpperCase().replace(/[^A-Z]/g, ''); if (v.length !== L.answer.length) return { ok: false, error: `The word has ${L.answer.length} letters.` }; right = v === L.answer; }
    else return { ok: false, error: 'Nothing to enter here.' };
    if (right) { this.solve(L, p.id); return { ok: true, right: true }; }
    L.tries++; this.add(p.id, PTS.wrong); this.stat(p.id).wrong++;
    this.log(`${L.name}: not quite!`, '✖'); if (L.tries % 2 === 1) this.say('wrong'); this.room.fx('wrong', { lock: L.id });
    return { ok: true, right: false };
  }

  // ---------------- what the screens see ----------------
  // gear: the player's magnifier (shown next to their name on the TV case board and phones).
  who(id) { const p = this.room.get(id) || {}; return { id, name: this.room.name(id), avatar: p.avatar || '🙂', color: p.color || '#fff', bot: !!p.bot, gear: GEARS.gearSet(p, 'escape') }; }
  roleData(L, r) {
    const d = { ...r.data };
    if (L.kind === 'maze') { const M = L.maze; if (r.part === 'map') Object.assign(d, { walls: M.walls, start: M.start, exit: M.exit, pos: M.pos }); else Object.assign(d, { bumps: M.bumps, bumpAt: M.bumpAt || 0, steps: (M.trail || []).length, atStart: M.pos === M.start }); }
    return d;
  }
  lockTv(L) {
    const base = { id: L.id, kind: L.kind, name: L.name, icon: L.icon, solved: L.solved, by: L.by ? this.room.name(L.by) : null, hints: L.hintText, tries: L.tries };
    if (L.kind === 'deduce') return { ...base, open: this.puzzlesDone() };
    return { ...base, open: true, team: L.roles.map((r) => ({ ...this.who(r.id), role: r.role, label: this.partLabel(L, r) })), maze: L.kind === 'maze' ? { n: L.maze.n, pos: L.maze.pos, exit: L.maze.exit, trail: L.maze.trail || [] } : null };
  }
  partLabel(L, r) {
    if (r.label) return r.label;
    const eyes = L.eyes || [];
    switch (r.part) {
      case 'legend': return eyes[0]; case 'engraving': return eyes[1]; case 'photo': return eyes[0]; case 'note': return eyes[1];
      case 'pattern': return eyes[0]; case 'key': return eyes[1]; case 'tag': return eyes[0]; case 'map': return eyes[0];
      default: return L.hands;
    }
  }
  roomTv() { return this.R ? { i: this.ri + 1, of: this.s.rooms, key: this.R.key, name: this.R.name, icon: this.R.icon, scene: this.R.scene, diff: this.D.label } : null; }
  storyText() { return this.phase === 'story' ? this.R.intro : this.phase === 'outro' ? this.outroText : null; }
  tv() {
    const F = this.locks.length ? this.final() : null;
    return {
      phase: this.phase, room: this.roomTv(), endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, roomMs: ROOM_MS,
      story: this.storyText(), hazel: this.hazel, ready: this.ready.size, readyOf: this.live().filter((p) => !p.bot).length,
      locks: this.locks.map((L) => this.lockTv(L)),
      accuse: F && this.puzzlesDone() && this.phase !== 'story' ? { suspects: F.suspects, votes: F.votes.size, of: this.live().length, wrong: F.wrong || [], answer: this.phase === 'outro' || this.phase === 'over' ? F.answer : null } : null,
      outro: this.phase === 'outro' ? this.outro : null, history: this.history, events: this.events.slice(-5),
      standings: this.standings().slice(0, 12), hints: this.hints || 0, hintsOn: this.s.hints !== 'off',
    };
  }
  view(p) {
    const base = { phase: this.phase, room: this.roomTv(), endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, points: this.points.get(p.id) || 0, ready: this.ready.has(p.id), hintsOn: this.s.hints !== 'off', history: this.history, gear: GEARS.gearSet(p, 'escape') }; // gear: your magnifier
    if (this.phase === 'over') { const st = this.standings(); return { ...base, rank: st.findIndex((r) => r.id === p.id) + 1, of: st.length, stats: this.stat(p.id) }; }
    if (this.phase === 'story' || this.phase === 'outro') return { ...base, story: this.storyText(), outro: this.phase === 'outro' ? this.outro : null };
    const cards = [];
    for (const L of this.locks) {
      if (L.kind === 'deduce') continue;
      const mine = L.roles.filter((r) => r.id === p.id);
      if (!mine.length) continue;
      const team = L.roles.filter((r) => r.id !== p.id).map((r) => ({ ...this.who(r.id), role: r.role, label: this.partLabel(L, r) }));
      // Evidence held by bots / absent players is read out to the rest of the lock.
      const shared = L.roles.filter((r) => r.id !== p.id && r.role === 'eyes' && this.away(r.id)).map((r) => ({ from: this.who(r.id), part: r.part, label: this.partLabel(L, r), data: this.roleData(L, r) }));
      for (const r of mine) cards.push({ lock: L.id, kind: L.kind, name: L.name, icon: L.icon, role: r.role, part: r.part, label: this.partLabel(L, r), copy: !!r.copy, data: this.roleData(L, r), solved: L.solved, by: L.by ? this.room.name(L.by) : null, team, shared, hints: L.hintText, hintsLeft: MAX_HINTS - L.hintText.length });
    }
    const F = this.final(), open = this.puzzlesDone();
    return {
      ...base, cards,
      locks: this.locks.filter((L) => L.kind !== 'deduce').map((L) => ({ id: L.id, name: L.name, icon: L.icon, solved: L.solved })),
      accuse: { open, suspects: F.suspects, clues: F.hold ? F.hold.get(p.id) || [] : [], vote: F.votes.get(p.id) || null, votes: F.votes.size, of: this.live().length, wrong: F.wrong || [], hints: F.hintText, hintsLeft: MAX_HINTS - F.hintText.length, id: F.id },
    };
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ minutes: M }) => {
  const rooms = M <= 20 ? 1 : M <= 38 ? 2 : 3;
  return { rooms, difficulty: M <= 8 ? 'easy' : 'climb' };
};

module.exports = {
  partyFit,
  key: 'escape', name: 'JustEscape', min: 1, best: [2, 6], howSteps: 6, fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/escape.js): Detective Hazel Finch
  create: (room, settings) => new Game(room, settings),
  DIFF, PTS, ROOM_MS,
};
