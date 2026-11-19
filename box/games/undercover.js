'use strict';
// JustUndercover: the agency has a mole. Director Grey briefs the agents; every case each agent's
// phone gets a secret password, except the mole(s). Then the room gives clues (one word, one line
// of a shared drawing, or a tiny doodle), talks it over, and votes. Catch the mole, or let them
// slip away.
//
// Modes (setting `mode`):
//   words    Word Clues: the mole gets a SIMILAR word (beach / pool) and nobody knows which side
//            they are on. One-word clues in turns, discuss, vote someone out; repeat until the
//            moles are out, they match the agents left, or the interrogations run out.
//   sketch   Sketch Line: everyone knows the word except the faker, who only knows the category.
//            In turns, each adds ONE line to a shared drawing (two laps). One vote; a caught faker
//            still wins by naming the word.
//   blank    Blank Agent: Word Clues, but the mole gets no word at all, just the category. A
//            caught blank agent who names the password wins anyway.
//   double   Double Agents: Word Clues with (at least) two moles.
//   rival    Rival Words: no mole; half the room has one word, half the other. Give clues, then
//            secretly pick your teammates.
//   speed    Speed Round: Word Clues with 8-second clues and a short talk.
//   picture  Picture Clue: Word Clues, but every clue is a tiny doodle drawn on the phone.
//   mixed    Alternates Sketch Line with the word modes, case by case.
// Secrecy: tv() never carries a password (or who the moles are) before that case's reveal; each
// phone only gets its own card (view). Every phone input is validated; timers use room.after;
// results() lists ids best-first once the game is over.
const GEARS = require('../../public/shared/gear');
const { CATS, CAT_KEYS } = require('./undercover-words');
const PF = require('../party-fit');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const MODES = {
  words: { name: 'Word Clues', icon: '💬', kind: 'words' },
  sketch: { name: 'Sketch Line', icon: '✏️', kind: 'sketch' },
  blank: { name: 'Blank Agent', icon: '⬜', kind: 'words', blank: true },
  double: { name: 'Double Agents', icon: '👥', kind: 'words', double: true },
  rival: { name: 'Rival Words', icon: '⚔️', kind: 'rival' },
  speed: { name: 'Speed Round', icon: '⚡', kind: 'words', speed: true },
  picture: { name: 'Picture Clue', icon: '🖼️', kind: 'words', picture: true },
};
const MODE_KEYS = Object.keys(MODES);
const fields = [
  { key: 'mode', label: 'Mission type', options: opt([['mixed', '🎲 Mixed (words and sketches)'], ['words', '💬 Word Clues'], ['sketch', '✏️ Sketch Line'], ['blank', '⬜ Blank Agent'], ['double', '👥 Double Agents'], ['rival', '⚔️ Rival Words'], ['speed', '⚡ Speed Round'], ['picture', '🖼️ Picture Clue']]) },
  { key: 'rounds', label: 'Cases', options: opt([[1, '1 case'], [2, '2 cases'], [3, '3 cases'], [4, '4 cases'], [5, '5 cases'], [6, '6 cases']]) },
  { key: 'clue', label: 'Clue time', options: opt([[15, '15 seconds a clue'], [25, '25 seconds a clue'], [40, '40 seconds a clue']]) },
  { key: 'talk', label: 'Discussion', options: opt([[30, '30 seconds to talk'], [60, '1 minute to talk'], [90, '90 seconds to talk'], [120, '2 minutes to talk']]) },
  { key: 'moles', label: 'Moles', options: opt([['auto', '🕵️ Auto (by players)'], [1, '1 mole'], [2, '2 moles'], [3, '3 moles']]) },
  { key: 'pack', label: 'Word files', options: opt([['mix', '🗂️ Every file'], ...CAT_KEYS.map((k) => [k, `${CATS[k].icon} ${CATS[k].name}`])]) },
];
const defaults = { mode: 'mixed', rounds: 3, clue: 25, talk: 60, moles: 'auto', pack: 'mix' };

// Director Grey's lines (copied into the intro's `story` so they are pre-voiced).
const GREY = {
  brief: ['New case, agents. Check your phones, and keep your card to yourself.', 'A mole has slipped into the agency. Read your card, and trust no one.', 'Another file on my desk. Peek at your card, quietly.'],
  first: 'Our first case. Somebody in this room is not who they say they are.',
  last: 'Final case of the night. Make it count.',
  clue: ['One word each. Prove you know the password, without giving it away.', 'Clues, please. Not too obvious, not too vague.'],
  sketch: 'One line each. The faker only knows the category, so draw carefully.',
  picture: 'No words this time. Draw your clue.',
  blank: 'Somebody here has no password at all. Watch for the bluffer.',
  rival: 'Two teams, two passwords. Find your partners.',
  speed: 'Speed round! Quick clues, no hesitating.',
  talk: ['Talk it over. Who sounds like they are bluffing?', 'Discuss. Somebody here is guessing.'],
  vote: ['Time to vote. Point your finger.', 'Make your choice, agents.'],
  pick: 'Pick your teammates. Who shares your password?',
  caught: ['Caught red-handed! That was the mole.', 'Got them! The mole is unmasked.'],
  innocent: ['Oh dear. That was one of ours.', 'Wrong agent. The mole is still among us.'],
  tie: 'A split vote. Nobody leaves the room.',
  guess: 'One last chance, mole. Name the password.',
  cracked: 'Clever. The mole cracked the password.',
  wrong: 'Wrong password. Case closed.',
  nope: 'Wrong. Back to work, agents.',
  moles: 'The mole got away. We will get them next time.',
  agents: 'Case closed. Good work, agents.',
  teams: 'The teams are revealed. Let us see who found their partners.',
  over: 'That is all for tonight, agents. The agency thanks you.',
};

// Timing (ms). Clue/stroke turns use the clue setting; Speed Round uses SPEED_CLUE.
const BRIEF_MS = 9000, VOTE_MS = 30000, EJECT_MS = 7500, GUESS_MS = 25000, CASE_MS = 11000, PICK_MS = 35000;
const SPEED_CLUE = 8, SPEED_TALK = 30, PICTURE_EXTRA = 15, GRACE_MS = 2500, BETWEEN_TURNS = 700;
// Scoring.
const PTS = { vote: 50, agentsWin: 150, agentOut: 75, cycle: 75, molesWin: 300, guessBonus: 150, teamRight: 60, teamWrong: 30, found: 20 };
const MAX_CLUE = 24, MAX_STROKE_PTS = 220, MAX_DOODLE_STROKES = 14, MAX_DOODLE_PTS = 700, MAX_GUESS = 40;

// ---------- forgiving matching (like Tune Buzz) ----------
const norm = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘`´']/g, '').replace(/&/g, ' and ')
  .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(the|a|an) /, '');
const squash = (s) => { const n = norm(s).replace(/ /g, ''); return n.length > 3 && n.endsWith('s') && !n.endsWith('ss') ? n.replace(/(es|s)$/, '') : n; };
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let lo = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < lo) lo = cur[j]; }
    if (lo > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
const tolerance = (n) => (n <= 3 ? 0 : n <= 6 ? 1 : n <= 12 ? 2 : 3);
// Is the guess the word? Case, accents, spaces, punctuation, "the/a", plurals and small typos don't matter.
function sameWord(guess, word) {
  const g = squash(guess), w = squash(word);
  if (!g || !w) return false;
  if (g === w) return true;
  return lev(g, w, tolerance(w.length)) <= tolerance(w.length);
}
// A clue that gives the word away (the word itself, inside it, or nearly it).
function givesAway(clue, word) {
  if (!word) return false;
  const c = squash(clue), w = squash(word);
  if (!c || !w) return false;
  if (c === w || sameWord(clue, word)) return true;
  if (c.length >= 4 && w.includes(c)) return true;
  if (w.length >= 3 && c.includes(w)) return true;
  return norm(word).split(' ').some((part) => part.length >= 4 && squash(part) === c);
}
// One word: letters (any alphabet), digits, hyphen, apostrophe. Returns the tidy clue or an error.
function cleanClue(raw) {
  if (typeof raw !== 'string') return { error: 'Type a one-word clue.' };
  const s = raw.replace(/[\u0000-\u001f]/g, '').trim();
  if (!s) return { error: 'Type a one-word clue.' };
  if (/\s/.test(s)) return { error: 'One word only!' };
  if (s.length > MAX_CLUE) return { error: `Keep it under ${MAX_CLUE} letters.` };
  if (!/^[\p{L}\p{N}'’-]+$/u.test(s)) return { error: 'Letters only, one word.' };
  return { text: s };
}
// A stroke from a phone: { p: [x0, y0, x1, y1, …] } in 0..1000 (points capped).
function cleanStroke(raw, maxPts = MAX_STROKE_PTS) {
  const p = raw && Array.isArray(raw.p) ? raw.p : Array.isArray(raw) ? raw : null;
  if (!p || p.length < 2 || p.length % 2 || p.length > maxPts * 2) return null;
  for (const n of p) if (!Number.isInteger(n) || n < 0 || n > 1000) return null;
  return p.length === 2 ? [p[0], p[1], p[0], p[1]] : p.slice();
}
function cleanDoodle(raw) {
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_DOODLE_STROKES) return null;
  const out = []; let pts = 0;
  for (const s of raw) { const p = cleanStroke(s, MAX_DOODLE_PTS); if (!p) return null; pts += p.length / 2; out.push(p); }
  return pts > MAX_DOODLE_PTS ? null : out;
}

class Game {
  constructor(room, s) {
    this.room = room;
    const pick = (f, v) => { const o = f.options.find((x) => String(x.value) === String(v)); return o ? o.value : defaults[f.key]; };
    this.s = {}; for (const f of fields) this.s[f.key] = pick(f, s ? s[f.key] : undefined);
    this.phase = 'intro'; this.caseNo = 0; this.c = null; this.points = new Map(); this.stats = new Map();
    this.timer = null; this.endsAt = 0; this.say_ = null; this.sayKey = 0; this.history = []; this.final = null;
    this.usedPairs = new Set(); this.mixIdx = 0; this.lastMode = null;
  }
  now() { return this.room.now(); }
  rng() { return this.room.rng(); }
  pickOf(a) { return a[Math.floor(this.rng() * a.length) % a.length]; }
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.now() + ms; this.timer = this.room.after(Math.max(0, ms), fn); }
  stat(id) { let s = this.stats.get(id); if (!s) { s = { moleWins: 0, moleCases: 0, rightVotes: 0, votes: 0, survived: 0, cracked: 0, found: 0, agentWins: 0 }; this.stats.set(id, s); } return s; }
  add(id, n) { this.points.set(id, (this.points.get(id) || 0) + n); if (this.c) this.c.gains.set(id, (this.c.gains.get(id) || 0) + n); }
  active(p) { return !!p && (p.bot || p.sockets > 0); }
  pub(id) { const p = this.room.get(id); return p ? { id, name: p.name, avatar: p.avatar, color: p.color, bot: !!p.bot } : { id, name: '—', avatar: '👻', color: '#888' }; }
  say(k) { const v = GREY[k]; const text = Array.isArray(v) ? this.pickOf(v) : v; if (text) this.say_ = { text, key: ++this.sayKey }; }
  clueSecs() { return this.c && MODES[this.c.mode].speed ? SPEED_CLUE : this.s.clue; }
  talkSecs() { return this.c && MODES[this.c.mode].speed ? Math.min(SPEED_TALK, this.s.talk) : this.s.talk; }

  start() { for (const p of this.room.list()) { this.points.set(p.id, 0); this.stat(p.id); } this.nextCase(); }
  joined(p) { if (!this.points.has(p.id)) this.points.set(p.id, 0); this.stat(p.id); }
  left(p) {
    const c = this.c; if (!c) return;
    const r = c.roles.get(p.id); if (!r) return;
    r.out = true; r.left = true;
    if (this.phase === 'clue') { if (c.sim) this.checkClues(); else if (c.turnId === p.id) this.endTurn(); }
    else if (this.phase === 'talk') this.checkReady();
    else if (this.phase === 'vote') this.checkVotes();
    else if (this.phase === 'pick') this.checkPicks();
    else if (this.phase === 'guess' && c.guess && c.guess.id === p.id) this.afterGuess();
  }

  // ---------- a case: brief -> clue -> talk -> vote -> eject (-> guess) -> … -> case ----------
  modeFor() {
    const n = this.room.list().length;
    if (this.s.mode !== 'mixed') return this.s.mode;
    // Mixed: Sketch Line every other case, the word modes in turn in between.
    const words = ['words', 'blank', 'picture', n >= 6 ? 'double' : 'speed', 'speed'];
    const m = this.caseNo % 2 === 0 ? 'sketch' : words[this.mixIdx++ % words.length];
    return m;
  }
  moleCount(n, mode) {
    const M = MODES[mode]; if (M.kind === 'rival') return 0;
    const auto = n <= 6 ? 1 : n <= 11 ? 2 : 3;
    let k = this.s.moles === 'auto' ? auto : Number(this.s.moles);
    if (M.double) k = Math.max(k, 2);
    if (M.kind === 'sketch' && this.s.moles === 'auto') k = n >= 10 ? 2 : 1;
    return Math.max(1, Math.min(k, Math.floor((n - 1) / 2.5)));
  }
  pickPair() {
    const keys = this.s.pack === 'mix' ? CAT_KEYS : [this.s.pack];
    for (let tries = 0; tries < 60; tries++) {
      const cat = this.pickOf(keys), pairs = CATS[cat].pairs, i = Math.floor(this.rng() * pairs.length) % pairs.length;
      if (this.usedPairs.has(cat + i) && tries < 50) continue;
      this.usedPairs.add(cat + i);
      return { cat, pair: pairs[i] };
    }
    return { cat: keys[0], pair: CATS[keys[0]].pairs[0] };
  }
  nextCase() {
    if (this.caseNo >= this.s.rounds) return this.end();
    const ppl = this.room.list(); if (ppl.length < 3 && this.caseNo > 0) return this.end();
    this.caseNo++;
    const mode = this.modeFor(), M = MODES[mode];
    this.lastMode = mode;
    const { cat, pair } = this.pickPair();
    const flip = this.rng() < 0.5, agentWord = flip ? pair.b : pair.a, moleWord = flip ? pair.a : pair.b;
    const agentHints = flip ? pair.bh : pair.ah, moleHints = flip ? pair.ah : pair.bh;
    const order = this.shuffle(ppl.map((p) => p.id));
    const roles = new Map();
    if (M.kind === 'rival') {
      const half = Math.floor(order.length / 2), mix = this.shuffle(order);
      mix.forEach((id, i) => roles.set(id, { team: i < half ? 'a' : 'b', word: i < half ? pair.a : pair.b, hints: i < half ? pair.ah : pair.bh, mole: false, out: false }));
    } else {
      const k = this.moleCount(order.length, mode), moles = new Set(this.shuffle(order).slice(0, k));
      for (const id of order) {
        const mole = moles.has(id);
        if (!mole) roles.set(id, { mole: false, word: agentWord, hints: agentHints, out: false });
        else if (M.kind === 'sketch' || M.blank) roles.set(id, { mole: true, word: null, hints: [], out: false });
        else roles.set(id, { mole: true, word: moleWord, hints: moleHints, out: false });
      }
    }
    const n = order.length;
    this.c = {
      n: this.caseNo, mode, kind: M.kind, cat, pair, agentWord, moleWord: M.kind === 'words' && !M.blank ? moleWord : null,
      roles, order, cycle: 0, maxCycles: n <= 5 ? 2 : 3, laps: M.kind === 'words' ? 1 : n <= 8 ? 2 : 1,
      sim: !!M.picture || (M.kind !== 'sketch' && n > 10), clues: [], strokes: [], votes: new Map(), ready: new Set(), picks: new Map(),
      turnIdx: -1, turnId: null, lap: 0, turnAt: 0, ejects: [], eject: null, guess: null, result: null, gains: new Map(), startIdx: 0, seq: 0,
    };
    this.phase = 'brief';
    this.say(this.caseNo === 1 ? 'first' : this.caseNo === this.s.rounds && this.s.rounds > 1 ? 'last' : M.blank ? 'blank' : 'brief');
    this.room.fx('case', { mode });
    for (const id of order) if (roles.get(id).mole) this.stat(id).moleCases++;
    this.setTimer(BRIEF_MS, () => this.beginCycle());
  }
  alive() { const c = this.c; return c ? c.order.filter((id) => { const r = c.roles.get(id); return r && !r.out && this.room.get(id); }) : []; }
  beginCycle() {
    const c = this.c; if (!c) return;
    c.cycle++; c.lap = 1; c.ready = new Set(); c.votes = new Map(); c.eject = null; c.guess = null;
    this.phase = 'clue';
    const M = MODES[c.mode];
    this.say(c.cycle > 1 ? 'clue' : M.picture ? 'picture' : M.kind === 'sketch' ? 'sketch' : M.kind === 'rival' ? 'rival' : M.speed ? 'speed' : 'clue');
    this.room.fx('clues');
    if (c.sim) {
      const secs = this.clueSecs() + (M.picture ? PICTURE_EXTRA : 3);
      c.turnId = null; c.simDone = new Set();
      this.setTimer(secs * 1000, () => this.endClues());
      for (const id of this.alive()) { const p = this.room.get(id); if (p && p.bot) this.botClue(p, true); }
      return;
    }
    // Turns go round the table; each new interrogation starts one seat further on.
    const al = this.alive();
    c.turnList = al.length ? al.slice(c.startIdx % al.length).concat(al.slice(0, c.startIdx % al.length)) : [];
    c.startIdx++;
    c.turnIdx = -1;
    this.nextTurn();
  }
  nextTurn() {
    const c = this.c; if (!c || this.phase !== 'clue') return;
    c.turnIdx++;
    if (c.turnIdx >= c.turnList.length) {
      if (c.lap < c.laps) { c.lap++; c.turnIdx = 0; c.turnList = c.turnList.filter((id) => !c.roles.get(id).out); if (!c.turnList.length) return this.endClues(); }
      else return this.endClues();
    }
    const id = c.turnList[c.turnIdx], p = this.room.get(id), r = c.roles.get(id);
    if (!p || !r || r.out) return this.nextTurn();
    c.turnId = id; c.turnAt = this.now(); const seq = ++c.seq;
    this.room.fx('turn', { id });
    if (!this.active(p)) { this.setTimer(GRACE_MS, () => this.endTurn()); return; } // away: skip after a moment
    this.setTimer(this.clueSecs() * 1000, () => this.endTurn());
    if (p.bot) this.room.after(Math.min(this.clueSecs() * 1000 - 500, 1200 + this.rng() * 2600), () => { if (this.c === c && c.seq === seq && this.phase === 'clue') this.botClue(p, false); });
  }
  // The turn is over (a clue arrived, time ran out, or the player is away).
  endTurn() {
    const c = this.c; if (!c || this.phase !== 'clue' || c.sim) return;
    const id = c.turnId;
    if (id && !c.clues.some((x) => x.id === id && x.cycle === c.cycle && x.lap === c.lap)) c.clues.push({ id, cycle: c.cycle, lap: c.lap, text: null, miss: true });
    c.turnId = null; const seq = ++c.seq;
    this.room.cancel(this.timer); this.endsAt = 0;
    this.room.after(BETWEEN_TURNS, () => { if (this.c === c && c.seq === seq && this.phase === 'clue') this.nextTurn(); });
  }
  checkClues() {
    const c = this.c; if (!c || !c.sim || this.phase !== 'clue') return;
    const waiting = this.alive().filter((id) => this.active(this.room.get(id)) && !c.simDone.has(id));
    if (!waiting.length) this.setTimer(800, () => this.endClues());
  }
  endClues() {
    const c = this.c; if (!c || this.phase !== 'clue') return;
    if (c.sim) for (const id of this.alive()) if (!c.simDone.has(id)) c.clues.push({ id, cycle: c.cycle, lap: 1, text: null, miss: true });
    c.turnId = null;
    this.phase = 'talk'; this.say('talk'); this.room.fx('talk');
    this.setTimer(this.talkSecs() * 1000, () => this.toVote());
    for (const id of this.alive()) { const p = this.room.get(id); if (p && p.bot) this.room.after(1500 + this.rng() * 3000, () => { if (this.c === c && this.phase === 'talk') { c.ready.add(id); this.checkReady(); } }); }
    this.checkReady();
  }
  voters() { const c = this.c; return this.alive().filter((id) => this.active(this.room.get(id))); }
  checkReady() {
    const c = this.c; if (!c || this.phase !== 'talk') return;
    const v = this.voters();
    if (v.length && v.every((id) => c.ready.has(id))) this.setTimer(600, () => this.toVote());
    else if (!v.length) this.setTimer(600, () => this.toVote());
  }
  toVote() {
    const c = this.c; if (!c || this.phase !== 'talk') return;
    if (c.kind === 'rival') { this.phase = 'pick'; this.say('pick'); this.room.fx('vote'); this.setTimer(PICK_MS, () => this.endPicks()); for (const id of this.alive()) { const p = this.room.get(id); if (p && p.bot) this.room.after(1500 + this.rng() * 5000, () => { if (this.c === c && this.phase === 'pick') this.botPick(p); }); } return; }
    this.phase = 'vote'; c.votes = new Map(); this.say('vote'); this.room.fx('vote');
    this.setTimer((MODES[c.mode].speed ? 20000 : VOTE_MS), () => this.tally());
    for (const id of this.alive()) { const p = this.room.get(id); if (p && p.bot) this.room.after(1500 + this.rng() * 5000, () => { if (this.c === c && this.phase === 'vote') this.botVote(p); }); }
  }
  checkVotes() {
    const c = this.c; if (!c || this.phase !== 'vote') return;
    const v = this.voters();
    if (!v.length || v.every((id) => c.votes.has(id))) this.setTimer(900, () => this.tally());
  }
  tally() {
    const c = this.c; if (!c || this.phase !== 'vote') return;
    const count = new Map();
    for (const [voter, target] of c.votes) { if (!this.room.get(voter) || !this.room.get(target)) continue; count.set(target, (count.get(target) || 0) + 1); }
    const rows = [...count].map(([id, n]) => ({ id, n, by: [...c.votes].filter(([, t]) => t === id).map(([v]) => v) })).sort((a, b) => b.n - a.n);
    const top = rows[0], tie = !top || (rows[1] && rows[1].n === top.n);
    // Every vote cast on a mole earns the voter points.
    for (const [voter, target] of c.votes) {
      const r = c.roles.get(target), vr = c.roles.get(voter); this.stat(voter).votes++;
      if (r && r.mole && vr && !vr.mole) { this.add(voter, PTS.vote); this.stat(voter).rightVotes++; }
    }
    const ej = { cycle: c.cycle, id: tie ? null : top.id, tie, tally: rows, mole: null };
    if (!tie) {
      const r = c.roles.get(top.id); ej.mole = !!(r && r.mole);
      if (c.kind === 'words' && r) { r.out = true; r.outCycle = c.cycle; }
    }
    // Moles still hidden after an interrogation (Word Clues) earn points for slipping by.
    if (c.kind === 'words') for (const id of this.alive()) { const r = c.roles.get(id); if (r.mole) { this.add(id, PTS.cycle); this.stat(id).survived++; } }
    c.eject = ej; c.ejects.push(ej);
    this.phase = 'eject';
    this.say(tie ? 'tie' : ej.mole ? 'caught' : 'innocent');
    this.room.fx(tie ? 'tie' : ej.mole ? 'caught' : 'innocent', { id: ej.id });
    this.setTimer(EJECT_MS, () => this.afterEject());
  }
  afterEject() {
    const c = this.c; if (!c || this.phase !== 'eject') return;
    const ej = c.eject;
    // A caught mole gets one last chance to name the agents' password (Sketch Line / Blank Agent:
    // a right answer wins the case; Word Clues: a bonus).
    if (ej && ej.mole && this.room.get(ej.id)) {
      this.phase = 'guess'; c.guess = { id: ej.id, text: null, right: null };
      this.say('guess'); this.room.fx('guess', { id: ej.id });
      const p = this.room.get(ej.id);
      this.setTimer(GUESS_MS, () => this.afterGuess());
      if (p.bot) this.room.after(2500 + this.rng() * 4000, () => { if (this.c === c && this.phase === 'guess') this.botGuess(p); });
      else if (!this.active(p)) this.setTimer(GRACE_MS * 2, () => this.afterGuess());
      return;
    }
    this.decide();
  }
  submitGuess(p, text) {
    const c = this.c; c.guess.text = text; c.guess.right = sameWord(text, c.agentWord);
    this.room.fx(c.guess.right ? 'cracked' : 'wrong', { id: p.id });
    this.afterGuess();
  }
  afterGuess() {
    const c = this.c; if (!c || this.phase !== 'guess') return;
    const g = c.guess; if (g.right == null) g.right = false;
    const M = MODES[c.mode];
    if (g.right) { this.stat(g.id).cracked++; if (c.kind === 'words' && !M.blank) this.add(g.id, PTS.guessBonus); }
    this.say(g.right ? 'cracked' : c.kind === 'sketch' || M.blank ? 'wrong' : 'nope');
    this.phase = 'eject'; // a short beat for the answer, then on
    this.setTimer(4500, () => { if (this.phase === 'eject') this.decide(); });
  }
  // After a vote: does the case end, or is there another interrogation?
  decide() {
    const c = this.c; if (!c) return;
    const M = MODES[c.mode], g = c.guess, ej = c.eject;
    if (c.kind === 'sketch') {
      const caught = ej && ej.mole && !(g && g.right);
      return this.closeCase(caught ? 'agents' : 'moles', caught ? 'caught' : ej && ej.mole ? 'cracked' : ej && ej.tie ? 'tie' : 'wrong');
    }
    if (M.blank && g && g.right) return this.closeCase('moles', 'cracked');
    const al = this.alive(), molesLeft = al.filter((id) => c.roles.get(id).mole).length, agentsLeft = al.length - molesLeft;
    if (!molesLeft) return this.closeCase('agents', 'caught');
    if (agentsLeft <= molesLeft) return this.closeCase('moles', 'outnumber');
    if (c.cycle >= c.maxCycles) return this.closeCase('moles', 'escaped');
    this.beginCycle();
  }
  closeCase(winner, why) {
    const c = this.c; if (!c) return;
    this.room.cancel(this.timer);
    for (const [id, r] of c.roles) {
      if (!this.room.get(id) || r.left) continue;
      if (winner === 'agents' && !r.mole) { this.add(id, r.out ? PTS.agentOut : PTS.agentsWin); this.stat(id).agentWins++; }
      if (winner === 'moles' && r.mole && (!r.out || c.kind === 'sketch' || why === 'cracked')) { this.add(id, PTS.molesWin); this.stat(id).moleWins++; }
    }
    this.toResult(winner, why);
  }
  // Rival Words: everyone picks who they think shares their word.
  checkPicks() {
    const c = this.c; if (!c || this.phase !== 'pick') return;
    const v = this.voters();
    if (!v.length || v.every((id) => c.picks.has(id))) this.setTimer(900, () => this.endPicks());
  }
  endPicks() {
    const c = this.c; if (!c || this.phase !== 'pick') return;
    for (const [id, set] of c.picks) {
      const me = c.roles.get(id); if (!me || !this.room.get(id)) continue;
      let gain = 0;
      for (const t of set) { const r = c.roles.get(t); if (!r) continue; if (r.team === me.team) { gain += PTS.teamRight; const st = this.stat(t); st.found++; this.add(t, PTS.found); } else gain -= PTS.teamWrong; }
      if (gain > 0) this.add(id, gain); else if (gain < 0) this.add(id, Math.max(gain, -(this.points.get(id) || 0)));
    }
    this.say('teams');
    this.toResult('rival', 'teams');
  }
  toResult(winner, why) {
    const c = this.c;
    this.phase = 'case';
    c.result = { winner, why };
    if (winner === 'agents') this.say('agents'); else if (winner === 'moles') this.say(why === 'cracked' ? 'cracked' : 'moles');
    this.history.push({ n: c.n, mode: c.mode, winner, moles: [...c.roles].filter(([, r]) => r.mole).map(([id]) => id) });
    this.room.fx(winner === 'moles' ? 'molewin' : 'casewin', { winner });
    this.setTimer(CASE_MS, () => this.nextCase());
  }
  end() {
    this.room.cancel(this.timer); this.phase = 'over'; this.endsAt = 0;
    this.final = { standings: this.standings(), awards: this.awards() };
    this.say('over'); this.room.fx('win');
  }
  awards() {
    const ids = [...this.stats.keys()].filter((id) => this.room.get(id)), A = [];
    const best = (f) => { let w = null; for (const id of ids) { const v = f(this.stat(id)); if (v > 0 && (!w || v > w.v)) w = { id, v }; } return w; };
    const add = (key, icon, title, w, txt) => { if (w) A.push({ key, icon, title, ...this.pub(w.id), text: txt(w.v) }); };
    add('master', '🕶️', 'Master of Disguise', best((s) => s.moleWins), (v) => `got away ${v} time${v === 1 ? '' : 's'}`);
    add('eye', '🔎', 'Sharp Eye', best((s) => s.rightVotes), (v) => `${v} vote${v === 1 ? '' : 's'} on a mole`);
    add('cool', '🧊', 'Cool Under Pressure', best((s) => s.survived), (v) => `survived ${v} interrogation${v === 1 ? '' : 's'} as a mole`);
    add('codebreaker', '🔐', 'Codebreaker', best((s) => s.cracked), (v) => `cracked ${v} password${v === 1 ? '' : 's'}`);
    add('partner', '🤝', 'Good Partner', best((s) => s.found), (v) => `found by teammates ${v} time${v === 1 ? '' : 's'}`);
    return A.slice(0, 5);
  }
  standings() {
    return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ ...this.pub(id), points: pts, moleWins: this.stat(id).moleWins }))
      .sort((a, b) => b.points - a.points || b.moleWins - a.moleWins || a.name.localeCompare(b.name));
  }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }
  next() {
    const c = this.c;
    if (this.phase === 'brief') return this.beginCycle();
    if (this.phase === 'clue') return c.sim ? this.endClues() : c.turnId ? this.endTurn() : this.nextTurn();
    if (this.phase === 'talk') return this.toVote();
    if (this.phase === 'vote') return this.tally();
    if (this.phase === 'pick') return this.endPicks();
    if (this.phase === 'eject') return c.guess && c.guess.right != null ? this.decide() : this.afterEject();
    if (this.phase === 'guess') return this.afterGuess();
    if (this.phase === 'case') return this.nextCase();
  }

  // ---------- bots ----------
  botClue(p, sim) {
    const c = this.c, r = c.roles.get(p.id); if (!r || r.out) return;
    const M = MODES[c.mode];
    if (c.kind === 'sketch') return this.addStroke(p, this.botLine());
    if (M.picture) { const d = []; for (let i = 0, k = 2 + Math.floor(this.rng() * 3); i < k; i++) d.push(this.botLine(14)); return this.room.after(sim ? 2500 + this.rng() * 6000 : 0, () => { if (this.c === c && this.phase === 'clue' && !c.simDone.has(p.id)) this.addDoodle(p, d); }); }
    const used = new Set(c.clues.filter((x) => x.text).map((x) => squash(x.text)));
    const pool = [...(r.hints || []), ...CATS[c.cat].generic].filter((h) => !used.has(squash(h)) && !givesAway(h, r.word));
    const word = pool.length ? (this.rng() < 0.85 ? pool[0] : this.pickOf(pool)) : 'hmm';
    const go = () => { if (this.c === c && this.phase === 'clue') this.addClue(p, word); };
    if (sim) this.room.after(1500 + this.rng() * 4000, go); else go();
  }
  botLine(n = 18) {
    let x = 250 + this.rng() * 500, y = 250 + this.rng() * 500, a = this.rng() * Math.PI * 2;
    const p = [];
    for (let i = 0; i < n; i++) { p.push(Math.round(Math.max(20, Math.min(980, x))), Math.round(Math.max(20, Math.min(980, y)))); a += (this.rng() - 0.5) * 0.9; x += Math.cos(a) * 28; y += Math.sin(a) * 28; }
    return p;
  }
  // A bot's suspicion of each other player: clues that fit its own word look innocent, clues
  // that fit the other word (or no clue at all) look suspicious. A little noise keeps it human.
  suspicion(p, ids) {
    const c = this.c, me = c.roles.get(p.id);
    const mine = new Set((me.hints || []).map(squash));
    const other = new Set([...(c.pair.ah || []), ...(c.pair.bh || [])].map(squash).filter((h) => !mine.has(h)));
    return ids.map((id) => {
      let s = this.rng() * 1.6; const r = c.roles.get(id);
      if (c.kind === 'sketch') { if (r.mole && !me.mole && this.rng() < 0.45) s += 3; }
      else for (const cl of c.clues) if (cl.id === id) { if (cl.miss) s += 1; else if (cl.text && mine.has(squash(cl.text))) s -= 2; else if (cl.text && other.has(squash(cl.text))) s += 2; else if (!me.word && r.mole) s += 0; }
      if (c.kind !== 'sketch' && MODES[c.mode].picture && r.mole && !me.mole && this.rng() < 0.3) s += 2;
      return { id, s };
    }).sort((a, b) => b.s - a.s);
  }
  botVote(p) {
    const c = this.c; const ids = this.alive().filter((id) => id !== p.id); if (!ids.length) return;
    this.castVote(p, this.suspicion(p, ids)[0].id);
  }
  botPick(p) {
    const c = this.c, ids = this.alive().filter((id) => id !== p.id), want = Math.max(1, Math.round(ids.length / 2));
    const ranked = this.suspicion(p, ids).reverse(); // least suspicious = most likely a teammate
    c.picks.set(p.id, new Set(ranked.slice(0, want).map((x) => x.id))); this.checkPicks();
  }
  botGuess(p) {
    const c = this.c, right = this.rng() < 0.35;
    const g = right ? c.agentWord : this.pickOf(CATS[c.cat].pairs.map((x) => x.a).filter((w) => w !== c.agentWord));
    this.submitGuess(p, g);
  }

  // ---------- moves ----------
  addClue(p, text) { const c = this.c; c.clues.push({ id: p.id, cycle: c.cycle, lap: c.lap, text: this.room.cleanText(text) }); this.room.fx('clue', { id: p.id }); if (c.sim) { c.simDone.add(p.id); this.checkClues(); } else this.endTurn(); }
  addStroke(p, pts) { const c = this.c; c.strokes.push({ id: p.id, color: p.color, p: pts, lap: c.lap }); c.clues.push({ id: p.id, cycle: c.cycle, lap: c.lap, line: true }); this.room.fx('stroke', { id: p.id }); this.endTurn(); }
  addDoodle(p, d) { const c = this.c; c.clues.push({ id: p.id, cycle: c.cycle, lap: 1, doodle: d }); c.simDone.add(p.id); this.room.fx('clue', { id: p.id }); this.checkClues(); }
  castVote(p, target) { const c = this.c; c.votes.set(p.id, target); this.room.fx('voted', { id: p.id }); this.checkVotes(); }

  act(p, m) {
    m = m || {};
    const c = this.c, r = c && c.roles.get(p.id);
    const M = c ? MODES[c.mode] : null;
    switch (m.op) {
      case 'clue': {
        if (this.phase !== 'clue' || !r || r.out) return { ok: false, error: 'Not now.' };
        if (c.kind === 'sketch' || M.picture) return { ok: false, error: 'Draw your clue this time!' };
        if (c.sim ? c.simDone.has(p.id) : c.turnId !== p.id) return { ok: false, error: c.sim ? 'You already gave your clue.' : 'Wait for your turn.' };
        const cl = cleanClue(m.text); if (cl.error) return { ok: false, error: cl.error };
        if (givesAway(cl.text, r.word)) return { ok: false, error: 'That gives your password away! Try another word.' };
        if (c.clues.some((x) => x.text && squash(x.text) === squash(cl.text))) return { ok: false, error: 'Someone already said that. Pick another word.' };
        this.addClue(p, cl.text); return { ok: true };
      }
      case 'line': {
        if (this.phase !== 'clue' || !r || r.out || c.kind !== 'sketch') return { ok: false, error: 'Not now.' };
        if (c.turnId !== p.id) return { ok: false, error: 'Wait for your turn.' };
        const pts = cleanStroke(m.stroke); if (!pts) return { ok: false, error: 'Draw one line, then send it.' };
        this.addStroke(p, pts); return { ok: true };
      }
      case 'doodle': {
        if (this.phase !== 'clue' || !r || r.out || !M.picture) return { ok: false, error: 'Not now.' };
        if (c.simDone.has(p.id)) return { ok: false, error: 'You already sent your doodle.' };
        const d = cleanDoodle(m.strokes); if (!d) return { ok: false, error: 'Draw something small first (a few lines).' };
        this.addDoodle(p, d); return { ok: true };
      }
      case 'ready': {
        if (this.phase !== 'talk' || !r || r.out) return { ok: false, quiet: true };
        c.ready.add(p.id); this.checkReady(); return { ok: true };
      }
      case 'vote': {
        if (this.phase !== 'vote' || !r || r.out) return { ok: false, error: 'You can’t vote right now.' };
        const t = String(m.target || ''), tr = c.roles.get(t);
        if (t === p.id) return { ok: false, error: 'You can’t vote for yourself.' };
        if (!tr || tr.out || !this.room.get(t)) return { ok: false, error: 'Pick someone still in the room.' };
        this.castVote(p, t); return { ok: true };
      }
      case 'pick': {
        if (this.phase !== 'pick' || !r || r.out) return { ok: false, error: 'Not now.' };
        if (!Array.isArray(m.ids) || m.ids.length > 99) return { ok: false, error: 'Pick your teammates.' };
        const set = new Set();
        for (const x of m.ids) { const t = String(x); if (t === p.id || !c.roles.get(t) || !this.room.get(t)) return { ok: false, error: 'Pick players in this case.' }; set.add(t); }
        if (!set.size) return { ok: false, error: 'Pick at least one teammate.' };
        c.picks.set(p.id, set); this.checkPicks(); return { ok: true };
      }
      case 'guess': {
        if (this.phase !== 'guess' || !c.guess || c.guess.id !== p.id || c.guess.text != null) return { ok: false, error: 'Not now.' };
        const g = String(m.text == null ? '' : m.text).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, MAX_GUESS);
        if (!g) return { ok: false, error: 'Type your guess.' };
        this.submitGuess(p, this.room.cleanText(g)); return { ok: true };
      }
    }
    return { ok: false, error: 'Unknown move.' };
  }

  // ---------- screens ----------
  // Public: no passwords and no roles, except what has been revealed (ejections, the case end).
  casePub() {
    const c = this.c; if (!c) return null;
    const M = MODES[c.mode], reveal = this.phase === 'case' || this.phase === 'over';
    const cards = c.order.filter((id) => this.room.get(id)).map((id) => {
      const r = c.roles.get(id), p = this.room.get(id);
      const o = { ...this.pub(id), here: this.active(p), out: !!r.out, turn: c.turnId === id };
      if (r.out && r.outCycle) o.outRole = r.mole ? 'mole' : 'agent';
      if (reveal) { o.role = r.mole ? 'mole' : 'agent'; if (c.kind === 'rival') o.team = r.team; }
      o.clues = c.clues.filter((x) => x.id === id).map((x) => (x.doodle ? { doodle: x.doodle, cycle: x.cycle } : x.line ? { line: true, lap: x.lap } : { text: x.text, miss: !!x.miss, cycle: x.cycle }));
      if (this.phase === 'vote') o.voted = c.votes.has(id);
      if (this.phase === 'talk') o.ready = c.ready.has(id);
      if (this.phase === 'pick') o.voted = c.picks.has(id);
      if (c.sim && this.phase === 'clue') o.done = c.simDone.has(id);
      return o;
    });
    const o = { n: c.n, mode: c.mode, modeName: M.name, modeIcon: M.icon, kind: c.kind, picture: !!M.picture, blank: !!M.blank, cat: { key: c.cat, name: CATS[c.cat].name, icon: CATS[c.cat].icon },
      cycle: c.cycle, maxCycles: c.kind === 'words' ? c.maxCycles : 1, lap: c.lap, laps: c.laps, sim: c.sim, cards, turnId: c.turnId,
      moles: c.kind === 'rival' ? 0 : [...c.roles.values()].filter((r) => r.mole).length, strokes: c.kind === 'sketch' ? c.strokes.map((s) => ({ id: s.id, color: s.color, p: s.p })) : null };
    if (c.eject && (this.phase === 'eject' || this.phase === 'guess')) o.eject = { id: c.eject.id, tie: c.eject.tie, mole: c.eject.mole, tally: c.eject.tally.slice(0, 12).map((t) => ({ id: t.id, n: t.n, by: t.by.slice(0, 20) })) };
    // The guess is read out when it decides the case (Sketch Line, Blank Agent); in the word modes the
    // case may go on, so only right / wrong shows until the reveal.
    if (c.guess) o.guess = { id: c.guess.id, text: c.kind === 'sketch' || M.blank ? c.guess.text : null, right: c.guess.right };
    if (reveal && c.result) {
      o.result = { winner: c.result.winner, why: c.result.why, gains: [...c.gains].filter(([id]) => this.room.get(id)).map(([id, g]) => ({ ...this.pub(id), gain: g })).sort((a, b) => b.gain - a.gain) };
      o.words = c.kind === 'rival' ? { a: c.pair.a, b: c.pair.b } : { agents: c.agentWord, moles: c.moleWord };
      if (c.guess) o.guess = { id: c.guess.id, text: c.guess.text, right: c.guess.right };
    }
    return o;
  }
  base() { return { phase: this.phase, caseNo: this.caseNo, of: this.s.rounds, mode: this.s.mode, endsIn: this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.now()) : 0, grey: this.say_ }; }
  tv() {
    const st = this.standings();
    return { ...this.base(), c: this.casePub(), standings: st.slice(0, 12), players: st.length, final: this.phase === 'over' ? this.final : null };
  }
  view(p) {
    const st = this.standings(), i = st.findIndex((r) => r.id === p.id), c = this.c;
    const v = { ...this.tv(), me: p.id, points: this.points.get(p.id) || 0, rank: i + 1, ranked: st.length };
    if (!c) return v;
    const r = c.roles.get(p.id), M = MODES[c.mode];
    if (!r) { v.spectator = true; return v; }
    // Your card: your own password only (never anyone else's, never your role in Word Clues).
    v.card = { word: r.word, cat: CATS[c.cat].name, catIcon: CATS[c.cat].icon, noWord: !r.word, faker: c.kind === 'sketch' && r.mole, blank: !!M.blank && r.mole };
    v.out = !!r.out;
    v.myTurn = this.phase === 'clue' && !r.out && (c.sim ? !c.simDone.has(p.id) : c.turnId === p.id);
    if (this.phase === 'vote') v.myVote = c.votes.get(p.id) || null;
    if (this.phase === 'pick') v.myPicks = c.picks.has(p.id) ? [...c.picks.get(p.id)] : null;
    if (this.phase === 'talk') v.ready = c.ready.has(p.id);
    if (r.out && r.outCycle) v.outRole = r.mole ? 'mole' : 'agent';
    if ((this.phase === 'guess' || this.phase === 'eject') && c.guess && c.guess.id === p.id) v.guessing = { done: c.guess.text != null, right: c.guess.right };
    if (this.phase === 'case' && c.result) v.mine = { role: r.mole ? 'mole' : 'agent', team: r.team || null, gain: c.gains.get(p.id) || 0 };
    return v;
  }
}

// Minutes for a set of options with P players (Party Mode, and the menu's estimate).
function estimate(s, P) {
  const n = Math.max(3, Math.min(20, P || 6)), typing = Math.min(s.clue, 13), talk = s.talk, vote = 22, ej = 9, brief = 10, result = 12;
  const words = (t = typing, tk = talk, cyc = n <= 5 ? 1.5 : 1.8) => brief + cyc * ((n > 10 ? s.clue + 3 : n * t) + tk + vote + ej + 8) + result;
  const sketch = () => brief + (n <= 8 ? 2 : 1) * n * Math.min(s.clue, 11) + talk + vote + ej + 12 + result;
  const rival = () => brief + (n <= 8 ? 2 : 1) * n * typing + talk + 30 + result;
  const picture = () => brief + 1.8 * (s.clue + PICTURE_EXTRA + talk + vote + ej + 8) + result;
  const speed = () => words(6, Math.min(SPEED_TALK, talk));
  const per = { words: words(), blank: words(), double: words(), sketch: sketch(), rival: rival(), picture: picture(), speed: speed() };
  per.mixed = (per.sketch + (per.words + per.blank + per.picture + per.speed) / 4) / 2;
  return (s.rounds * (per[s.mode] || per.words)) / 60;
}
// Party Mode: settings that fit the players in the room and this game's minutes (box/party-fit.js).
const partyFit = ({ players: P, minutes: M }) => {
  const mode = 'mixed';
  const b = PF.best({ rounds: [3, 2, 4, 1, 5, 6], talk: [60, 30, 90, 120], clue: [25, 15, 40] }, (s) => estimate({ ...s, mode }, P), M);
  return { rounds: b.rounds, talk: b.talk, mode, clue: b.clue };
};

module.exports = {
  key: 'undercover', name: 'JustUndercover', min: 3, best: [4, 10], howSteps: 6, fields, defaults,
  show: { facts: false }, // intro cutscene (public/box/intros/undercover.js): Director Grey's briefing room
  partyFit,
  create: (room, settings) => new Game(room, settings),
  _test: { MODES, GREY, PTS, sameWord, givesAway, cleanClue, cleanStroke, cleanDoodle, norm, squash, estimate, CATS },
};
