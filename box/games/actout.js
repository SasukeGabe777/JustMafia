'use strict';
// Act It Out: charades for the whole room. Each turn one actor (a pair or a trio in big rooms)
// gets a secret prompt on their phone and performs it in the room. Everyone else types guesses
// on their phones (fuzzy matching: typos, plurals, verb forms and synonyms count) or shouts
// them out, and the actor taps "They got it!" to credit whoever said it. The TV shows the
// spotlight, the timer and the guesses (blurred until one is right).
// Twists: 🎞️ Silent movie, 🔊 Sound effects only, 🎨 Act it as… (a random style), 🧊 Freeze
// frame (one pose; a new one only when the phone buzzes), 🏃 Charades relay (the spotlight
// passes between actors) and 👯 Two-person scene (two actors, two secret prompts, guess both).
// Scoring: the first right guesser gets 100 + up to 100 for speed; the actor gets the same,
// +50 on a twist turn. After every turn the room applauds (👏 +25 each) the best performance.
// The final turn counts double. Awards at the end ("Oscar-worthy", "Mime Master", …).
const { CATS, FAMILY, ALL, STYLES } = require('./actout-prompts');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'turns', label: 'Turns', options: opt([[6, '6 turns (~10 min)'], [8, '8 turns (~13 min)'], [10, '10 turns (~16 min)'], [12, '12 turns (~20 min)']]) },
  { key: 'seconds', label: 'Time to act', options: opt([[45, '45 seconds'], [60, '60 seconds'], [90, '90 seconds']]) },
  { key: 'twists', label: 'Twists', options: opt([['some', 'Every other turn'], ['lots', 'Every turn'], ['off', 'Off: classic charades']]) },
  { key: 'pack', label: 'Prompts', options: opt([['mix', 'Everything (still clean)'], ['family', 'Family (all ages)'], ['party', 'Party (grown-up, still clean)']]) },
];
const defaults = { turns: 8, seconds: 60, twists: 'some', pack: 'mix' };

const CAST_MS = 15000, CUE_MS = 2800, BRAVO_MS = 11000, BRAVO_MIN_MS = 4000, BRAVO_DONE_MS = 1600;
const GUESS = 100, ACT = 100, SPEED = 100, TWIST_BONUS = 50, CLAP = 25, FINAL_MULT = 2;
const POSES = 4, GUESS_GAP_MS = 600, MAX_GUESSES = 80, MAX_LEN = 60, FEED = 40;
const TWISTS = {
  classic: { icon: '🎭', name: 'Act it out', rule: 'Gestures, faces and noises: just don’t say the words!' },
  silent: { icon: '🎞️', name: 'Silent movie', rule: 'No sounds at all. Not even a hum!' },
  sound: { icon: '🔊', name: 'Sound effects only', rule: 'Hands behind your back! Noises only, no words.' },
  style: { icon: '🎨', name: 'Act it as…', rule: 'Stay in character the whole time!' },
  freeze: { icon: '🧊', name: 'Freeze frame', rule: 'Strike ONE pose and hold it. Change pose only when your phone buzzes!' },
  relay: { icon: '🏃', name: 'Charades relay', rule: 'The spotlight passes between actors: take over when your phone buzzes!' },
  scene: { icon: '👯', name: 'Two-person scene', rule: 'Two actors, two secret prompts, one scene. Guess both!' },
};
// Which categories suit a twist (a pose for "Movie title" is too hard; emotions need a face).
const CAT_FOR = { sound: ['animal', 'job', 'sport', 'action', 'disaster'], freeze: ['animal', 'job', 'sport', 'emotion', 'action'] };

// ---------------- fuzzy guess matching ----------------
const STOP = new Set('a an the of to in on at for with and or my your his her their its our is are was be some who that this from into by up out it i you very im its what about as so just'.split(' '));
const IRREG = { teeth: 'tooth', mice: 'mouse', feet: 'foot', geese: 'goose', men: 'man', women: 'woman', children: 'child', people: 'person', ate: 'eat', flew: 'fly', ran: 'run', swam: 'swim', fell: 'fall', caught: 'catch', drove: 'drive', knives: 'knife', wolves: 'wolf', leaves: 'leaf', loo: 'toilet' };
function stem(w) {
  if (IRREG[w]) return IRREG[w];
  if (w.length > 4 && w.endsWith('ies')) w = w.slice(0, -3) + 'y';
  else if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && /(ches|shes|xes|sses)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  if (w.length > 3 && /([bdfgklmnprtz])\1$/.test(w)) w = w.slice(0, -1);
  return w;
}
const SYN_GROUPS = [
  ['dog', 'puppy', 'doggy', 'pup', 'hound'], ['cat', 'kitten', 'kitty'], ['rabbit', 'bunny'], ['turtle', 'tortoise'], ['crocodile', 'alligator', 'croc', 'gator'],
  ['monkey', 'ape', 'chimp', 'chimpanzee'], ['car', 'automobile'], ['phone', 'cellphone', 'smartphone', 'mobile'], ['mom', 'mum', 'mother', 'mommy', 'mama'],
  ['dad', 'father', 'daddy', 'papa'], ['grandma', 'granny', 'grandmother', 'nana'], ['grandpa', 'grandfather', 'granddad', 'grandad'], ['tv', 'television', 'telly'],
  ['bike', 'bicycle'], ['big', 'giant', 'huge', 'large', 'enormous', 'massive', 'gigantic'], ['small', 'tiny', 'little', 'mini'],
  ['terrified', 'scared', 'afraid', 'frightened', 'fear', 'petrified', 'horrified'], ['overjoyed', 'happy', 'joyful', 'glad', 'cheerful', 'joy', 'ecstatic', 'elated'],
  ['heartbroken', 'sad', 'unhappy', 'upset', 'gloomy', 'crying', 'devastated'], ['furious', 'angry', 'mad', 'cross', 'rage', 'livid', 'annoyed'],
  ['sleepy', 'tired', 'exhausted', 'drowsy'], ['shop', 'store'], ['fridge', 'refrigerator'], ['bath', 'bathtub', 'tub'], ['trash', 'garbage', 'rubbish'],
  ['sofa', 'couch'], ['pants', 'trousers', 'jeans'], ['cookie', 'biscuit'], ['candy', 'sweets'], ['soccer', 'football'], ['movie', 'film'],
  ['ghost', 'spirit', 'phantom', 'spook'], ['run', 'jog', 'sprint'], ['eat', 'munch', 'chew'], ['sleep', 'nap', 'snooze'], ['jump', 'hop', 'leap'],
  ['throw', 'toss'], ['fall', 'tumble'], ['laugh', 'giggle', 'chuckle'], ['shout', 'yell', 'scream'], ['police', 'cop', 'policeman', 'policewoman'],
  ['firefighter', 'fireman', 'firewoman'], ['plane', 'airplane', 'aeroplane', 'jet'], ['boat', 'ship'], ['present', 'gift'], ['toilet', 'bathroom', 'restroom', 'lavatory'],
  ['taxi', 'cab'], ['chef', 'cook'], ['waiter', 'waitress'], ['doctor', 'doc', 'physician'], ['teacher', 'tutor', 'professor'],
  ['photo', 'picture', 'pic', 'photograph'], ['house', 'home'], ['wash', 'clean', 'scrub'], ['baby', 'infant', 'newborn'], ['kid', 'child'],
  ['scary', 'spooky', 'creepy'], ['spaghetti', 'pasta', 'noodle'], ['lego', 'brick'], ['road', 'street'], ['cold', 'freezing', 'chilly'],
  ['wedding', 'marriage'], ['party', 'celebration'], ['alien', 'martian', 'extraterrestrial'], ['robot', 'android', 'droid'],
  ['surprised', 'shocked', 'astonished', 'stunned', 'amazed'], ['disgusted', 'grossed', 'gross', 'yuck', 'revolted'], ['proud', 'pride'],
  ['bored', 'boring', 'boredom'], ['nervous', 'anxious', 'worried', 'jittery'], ['confused', 'puzzled', 'baffled', 'perplexed'],
  ['guilty', 'guilt'], ['embarrassed', 'embarrassing', 'mortified', 'ashamed'], ['lonely', 'alone', 'lonesome'], ['hungry', 'starving', 'famished'],
  ['jealous', 'envious', 'envy'], ['dinosaur', 'dino'], ['hamster', 'gerbil'], ['pajamas', 'pyjamas', 'pjs'], ['tire', 'tyre'], ['neighbor', 'neighbour'],
  ['sneaky', 'sneak'], ['present', 'gift'], ['ballet', 'ballerina'], ['skateboard', 'skating'], ['dj', 'deejay'], ['bouncer', 'doorman'],
];
const SYN = new Map();
for (const grp of SYN_GROUPS) { const root = stem(grp[0]); for (const w of grp) if (!SYN.has(stem(w))) SYN.set(stem(w), root); }
const norm = (s) => String(s || '').toLowerCase().replace(/[’‘`]/g, "'").replace(/'s\b/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const canon = (w) => { const st = stem(w); return SYN.get(st) || st; };
const keyWords = (s) => { const ws = norm(s).split(' ').filter(Boolean); const k = ws.filter((w) => !STOP.has(w)); return (k.length ? k : ws).map(canon); };
function lev(a, b, cap = 9) {
  if (a === b) return 0; if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let best = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < best) best = cur[j]; }
    if (best > cap) return cap + 1; prev = cur;
  }
  return prev[b.length];
}
const tol = (n) => (n >= 8 ? 2 : n >= 4 ? 1 : 0);
const wordHit = (a, b) => a === b || (a.length >= 4 && b.length >= 4 && lev(a, b, 2) <= tol(Math.min(a.length, b.length)));
// One answer: 'right' | 'close' | 'no'.
function judgeOne(guess, answer) {
  const gk = keyWords(guess), ak = keyWords(answer);
  if (!gk.length || !ak.length) return 'no';
  const gj = gk.join(''), aj = ak.join('');
  if (gj === aj || (aj.length >= 5 && lev(gj, aj, 4) <= Math.floor(aj.length / 6))) return 'right';
  const hit = ak.filter((w) => gk.some((g) => wordHit(g, w))).length;
  const need = ak.length <= 2 ? ak.length : ak.length - 1;
  if (hit >= need && gk.length <= ak.length + 2) return 'right';
  if (ak.length === 1) { const d = lev(gj, aj, 6); return d <= Math.max(1, Math.floor(aj.length * 0.4)) || (gj.length >= 4 && aj.includes(gj)) ? 'close' : 'no'; }
  return hit >= 1 ? 'close' : 'no';
}
function judge(guess, prompt) {
  let best = 'no';
  for (const a of prompt.answers) { const r = judgeOne(guess, a); if (r === 'right') return 'right'; if (r === 'close') best = 'close'; }
  return best;
}
const clean = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
const words = (t) => t.split(/\s+/).filter(Boolean).length;

class ActOut {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'cast'; this.n = 0; this.t = null; this.endsAt = 0; this.phaseMs = 0; this.timer = null; this.subTimer = null;
    this.scores = new Map(); this.stats = new Map(); this.acted = new Map(); this.skill = new Map();
    this.used = new Set(); this.twistDeck = []; this.lastTwist = null; this.lastCat = null; this.styleDeck = [];
  }
  // ---- helpers ----
  shuffle(a) { const r = this.room.rng; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.phaseMs = ms; this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  seat(p) {
    if (this.scores.has(p.id)) return;
    this.scores.set(p.id, 0); this.acted.set(p.id, 0); this.skill.set(p.id, 0.6 + this.room.rng() * 0.9);
    this.stats.set(p.id, { right: 0, guesses: 0, close: 0, claps: 0, solvedActs: 0, fastestActMs: null, fastestGuessMs: null, bestClaps: 0 });
  }
  here(id) { return !!this.room.get(id); }
  familyOnly() { return this.room.family === true || this.s.pack === 'family'; }
  pool() { return this.familyOnly() ? FAMILY : this.s.pack === 'party' ? ALL.filter((x) => x.party) : ALL; }
  isFinal() { return this.n >= this.s.turns && this.s.turns >= 3; }

  start() { for (const p of this.room.list()) this.seat(p); this.nextTurn(); }
  joined(p) { this.seat(p); }
  left(p) {
    const t = this.t; if (!t || !t.cast.includes(p.id)) { if (this.phase === 'bravo') this.maybeAllClapped(); return; }
    if (this.phase === 'bravo' || this.phase === 'over') return;
    const k = t.role.get(p.id);
    t.cast = t.cast.filter((id) => id !== p.id); t.role.delete(p.id);
    if (t.kind === 'scene' && !t.cast.some((id) => t.role.get(id) === k) && !t.prompts[k].solved) t.prompts[k].gone = true;
    if (t.kind === 'relay' && t.leg >= t.cast.length) t.leg = Math.max(0, t.cast.length - 1);
    if (!t.cast.length || t.prompts.every((pr) => pr.solved || pr.gone)) this.endAct();
  }

  // ---- drawing prompts, twists, actors ----
  drawPrompt(cats, avoid = []) {
    let pool = this.pool().filter((x) => !this.used.has(x.text) && (!cats || cats.includes(x.cat)) && !avoid.includes(x.cat));
    if (!pool.length) pool = this.pool().filter((x) => (!cats || cats.includes(x.cat)) && !avoid.includes(x.cat));
    if (!pool.length) pool = this.pool();
    // Spread the categories: prefer one we didn't just have.
    const fresh = pool.filter((x) => x.cat !== this.lastCat); if (fresh.length) pool = fresh;
    const byCat = {}; for (const x of pool) (byCat[x.cat] = byCat[x.cat] || []).push(x);
    const cs = Object.keys(byCat), cat = cs[Math.floor(this.room.rng() * cs.length)], list = byCat[cat];
    const pick = list[Math.floor(this.room.rng() * list.length)];
    this.used.add(pick.text); this.lastCat = pick.cat;
    return { text: pick.text, answers: pick.answers, cat: pick.cat, words: words(pick.text), solved: null, gone: false, skipped: [] };
  }
  twistFor(n, players) {
    if (this.s.twists === 'off' || n === 1) return 'classic';
    if (this.s.twists === 'some' && n % 2 === 1) return 'classic';
    const ok = ['silent', 'sound', 'style', 'freeze'].concat(players >= 4 ? ['relay', 'scene'] : []);
    this.twistDeck = this.twistDeck.filter((k) => ok.includes(k));
    if (!this.twistDeck.length) { this.twistDeck = this.shuffle(ok.slice()); if (this.twistDeck[this.twistDeck.length - 1] === this.lastTwist && this.twistDeck.length > 1) this.twistDeck.unshift(this.twistDeck.pop()); }
    return (this.lastTwist = this.twistDeck.pop());
  }
  pickStyle() { if (!this.styleDeck.length) this.styleDeck = this.shuffle(STYLES.slice()); return this.styleDeck.pop(); }
  pickCast(size) {
    const ids = this.room.list().map((p) => p.id), out = [];
    for (let i = 0; i < size; i++) {
      const left = ids.filter((id) => !out.includes(id)); if (!left.length) break;
      const fewest = Math.min(...left.map((id) => this.acted.get(id) || 0));
      let pool = left.filter((id) => (this.acted.get(id) || 0) === fewest);
      const humans = pool.filter((id) => !this.room.get(id).bot);
      if (humans.length) pool = humans;
      out.push(pool[Math.floor(this.room.rng() * pool.length)]);
    }
    for (const id of out) this.acted.set(id, (this.acted.get(id) || 0) + 1);
    return out;
  }
  castSize(kind, n) {
    if (kind === 'scene') return 2;
    if (kind === 'relay') return n >= 7 ? 3 : 2;
    return n >= 12 ? 3 : n >= 8 ? 2 : 1;
  }

  // ---- the turn ----
  nextTurn() {
    if (this.n >= this.s.turns) return this.finish();
    const players = this.room.list().length;
    if (players < 2) return this.finish();
    this.n++;
    const kind = this.twistFor(this.n, players);
    const cast = this.pickCast(Math.min(this.castSize(kind, players), Math.max(1, players - 1)));
    const t = { n: this.n, kind, style: kind === 'style' ? this.pickStyle() : null, cast, role: new Map(), prompts: [], ready: false,
      feed: [], gs: new Map(), claps: new Map(), gained: new Map(), why: new Map(), actStart: 0, actMs: this.s.seconds * 1000, leg: 0, legEndsAt: 0, pose: 1, seq: 0, ended: null };
    if (kind === 'scene' && cast.length >= 2) {
      const a = this.drawPrompt(null), b = this.drawPrompt(null, [a.cat]);
      t.prompts = [a, b]; t.role.set(cast[0], 0); t.role.set(cast[1], 1);
    } else {
      if (kind === 'scene') t.kind = 'classic';
      t.prompts = [this.drawPrompt(CAT_FOR[kind] || null)];
      for (const id of cast) t.role.set(id, 0);
    }
    this.t = t; this.phase = 'cast';
    this.room.fx(this.isFinal() ? 'final' : 'cast', { kind: t.kind });
    this.setTimer(CAST_MS, () => this.cue());
    for (const id of cast) { const p = this.room.get(id); if (p && p.bot) { this.room.after(1500 + this.room.rng() * 2000, () => { if (this.phase === 'cast' && this.t === t) this.cue(); }); break; } }
  }
  cue() {
    if (this.phase !== 'cast') return;
    this.phase = 'cue'; this.t.ready = true; this.room.fx('cue');
    this.setTimer(CUE_MS, () => this.action());
  }
  action() {
    if (this.phase !== 'cue') return;
    const t = this.t; this.phase = 'act'; t.actStart = this.room.now();
    this.room.fx('action', { kind: t.kind });
    this.setTimer(t.actMs, () => this.endAct());
    if (t.kind === 'relay') this.startLeg(0, t.actMs / Math.max(1, t.cast.length));
    if (t.kind === 'freeze') this.nextPose(t);
    for (const p of this.room.list()) if (p.bot && !t.cast.includes(p.id)) this.room.after(2500 + this.room.rng() * 5000, () => this.botGuess(p, t));
  }
  startLeg(i, ms) {
    const t = this.t; t.leg = i;
    this.room.cancel(this.subTimer); this.subTimer = null;
    if (i >= t.cast.length - 1) { t.legEndsAt = this.endsAt; return; }
    t.legEndsAt = this.room.now() + ms;
    this.subTimer = this.room.after(ms, () => { if (this.phase === 'act' && this.t === t) { this.room.fx('baton'); this.startLeg(i + 1, ms); } });
  }
  passBaton() {
    const t = this.t, legsLeft = t.cast.length - 1 - t.leg; if (legsLeft <= 0) return false;
    const ms = Math.max(3000, (this.endsAt - this.room.now()) / legsLeft);
    this.room.fx('baton'); this.startLeg(t.leg + 1, ms); return true;
  }
  nextPose(t) {
    const ms = t.actMs / POSES;
    this.room.cancel(this.subTimer);
    this.subTimer = this.room.after(ms, () => { if (this.phase === 'act' && this.t === t && t.pose < POSES) { t.pose++; this.room.fx('pose', { n: t.pose }); this.nextPose(t); } });
  }
  remaining() { return Math.max(0, this.endsAt - this.room.now()); }
  add(id, pts, why) {
    if (!this.scores.has(id) || !pts) return;
    this.scores.set(id, this.scores.get(id) + pts);
    this.t.gained.set(id, (this.t.gained.get(id) || 0) + pts);
    if (why) { const w = this.t.why.get(id) || []; w.push(why); this.t.why.set(id, w); }
  }
  solve(k, byId, text) {
    const t = this.t, pr = t.prompts[k]; if (!pr || pr.solved || pr.gone) return false;
    const ms = this.room.now() - t.actStart, frac = t.actMs ? this.remaining() / t.actMs : 0, speed = Math.round((SPEED * frac) / 10) * 10;
    const mult = this.isFinal() ? FINAL_MULT : 1;
    pr.solved = { by: byId, ms, text: text || null };
    this.add(byId, (GUESS + speed) * mult, 'guess');
    const st = this.stats.get(byId); if (st) { st.right++; if (st.fastestGuessMs == null || ms < st.fastestGuessMs) st.fastestGuessMs = ms; }
    const actors = t.kind === 'scene' ? t.cast.filter((id) => t.role.get(id) === k) : t.cast;
    for (const id of actors) {
      this.add(id, (ACT + speed + (t.kind !== 'classic' ? TWIST_BONUS : 0)) * mult, 'act');
      const sa = this.stats.get(id); if (sa) { sa.solvedActs++; if (sa.fastestActMs == null || ms < sa.fastestActMs) sa.fastestActMs = ms; }
    }
    this.room.fx('got', { id: byId, k });
    if (t.prompts.every((x) => x.solved || x.gone)) { this.room.cancel(this.timer); this.endsAt = this.room.now() + 1400; this.phaseMs = 1400; this.timer = this.room.after(1400, () => this.endAct()); }
    return true;
  }
  endAct() {
    if (this.phase !== 'act' && this.phase !== 'cast' && this.phase !== 'cue') return;
    this.room.cancel(this.subTimer); this.subTimer = null;
    const t = this.t; t.ended = this.room.now();
    this.phase = 'bravo';
    this.room.fx(t.prompts.some((x) => x.solved) ? 'reveal' : 'nobody');
    this.setTimer(BRAVO_MS, () => this.nextTurn());
    this.bravoAt = this.room.now();
    for (const p of this.room.list()) if (p.bot && !t.cast.includes(p.id) && t.cast.length) this.room.after(1200 + this.room.rng() * 3500, () => {
      if (this.phase !== 'bravo' || this.t !== t || this.room.rng() < 0.15) return;
      const live = t.cast.filter((id) => this.here(id)); if (live.length) this.clap(p, live[Math.floor(this.room.rng() * live.length)]);
    });
  }
  voters() { const t = this.t; return this.room.list().filter((p) => !t.cast.includes(p.id) && (p.bot || p.sockets > 0)); }
  clap(p, id) {
    const t = this.t;
    if (t.claps.has(p.id)) return { ok: false, error: 'You already applauded!' };
    t.claps.set(p.id, id);
    this.add(id, CLAP, 'clap');
    const st = this.stats.get(id); if (st) { st.claps++; const n = [...t.claps.values()].filter((x) => x === id).length; if (n > st.bestClaps) st.bestClaps = n; }
    this.room.fx('clap', { id });
    this.maybeAllClapped();
    return { ok: true };
  }
  maybeAllClapped() {
    if (this.phase !== 'bravo') return;
    const t = this.t, vs = this.voters();
    if (vs.length && vs.every((p) => t.claps.has(p.id))) {
      const at = Math.max(BRAVO_DONE_MS, BRAVO_MIN_MS - (this.room.now() - this.bravoAt));
      if (this.endsAt - this.room.now() > at) { this.room.cancel(this.timer); this.endsAt = this.room.now() + at; this.timer = this.room.after(at, () => this.nextTurn()); }
    }
  }
  finish() { this.room.cancel(this.timer); this.room.cancel(this.subTimer); this.timer = this.subTimer = null; this.phase = 'over'; this.endsAt = 0; this.room.fx('win'); }
  next() {
    if (this.phase === 'cast') this.cue();
    else if (this.phase === 'cue') { this.room.cancel(this.timer); this.action(); }
    else if (this.phase === 'act') { this.room.cancel(this.timer); this.endAct(); }
    else if (this.phase === 'bravo') { this.room.cancel(this.timer); this.nextTurn(); }
  }

  // ---- phones ----
  act(p, m) {
    const t = this.t;
    if (!m || typeof m.op !== 'string') return { ok: false, error: 'Unknown move.' };
    if (!this.scores.has(p.id) || !t) return { ok: false, error: 'You’re in from the next turn!' };
    const actor = t.cast.includes(p.id);
    switch (m.op) {
      case 'ready':
        if (!actor) return { ok: false, error: 'Only the actor can start the scene.' };
        if (this.phase !== 'cast') return { ok: false, error: 'Already rolling!' };
        this.cue(); return { ok: true };
      case 'skip': {
        if (!actor) return { ok: false, error: 'Only the actor can skip.' };
        if (this.phase !== 'cast' && this.phase !== 'cue' && this.phase !== 'act') return { ok: false, error: 'Not now.' };
        const k = t.role.get(p.id), pr = t.prompts[k];
        if (!pr || pr.solved || pr.gone) return { ok: false, error: 'Not now.' };
        if (pr.skipped.length) return { ok: false, error: 'You already used your skip.' };
        const fresh = this.drawPrompt(t.kind === 'scene' ? null : CAT_FOR[t.kind] || null, t.kind === 'scene' ? t.prompts.filter((_, i) => i !== k).map((x) => x.cat) : []);
        fresh.skipped = pr.skipped.concat(pr.text);
        t.prompts[k] = fresh; this.room.fx('skip');
        return { ok: true };
      }
      case 'got': {
        if (!actor) return { ok: false, error: 'Only the actor can confirm.' };
        if (this.phase !== 'act') return { ok: false, error: 'The clock isn’t running.' };
        const k = t.role.get(p.id);
        if (typeof m.id !== 'string' || !this.here(m.id) || t.cast.includes(m.id) || !this.scores.has(m.id)) return { ok: false, error: 'Pick who guessed it.' };
        if (!t.prompts[k] || t.prompts[k].solved) return { ok: false, error: 'Already guessed!' };
        this.solve(k, m.id, null); return { ok: true };
      }
      case 'pass':
        if (t.kind !== 'relay' || this.phase !== 'act') return { ok: false, error: 'Not now.' };
        if (t.cast[t.leg] !== p.id) return { ok: false, error: 'It’s not your leg.' };
        return this.passBaton() ? { ok: true } : { ok: false, error: 'You’re the last runner!' };
      case 'guess': {
        if (this.phase !== 'act') return { ok: false, error: 'Guessing isn’t open right now.' };
        if (actor) return { ok: false, error: 'You’re acting! No guessing your own prompt.' };
        const text = typeof m.text === 'string' ? clean(m.text) : '';
        if (!text) return { ok: false, error: 'Type a guess first.' };
        const g = t.gs.get(p.id) || { n: 0, last: -1e12, list: [] }; t.gs.set(p.id, g);
        const now = this.room.now();
        if (now - g.last < GUESS_GAP_MS) return { ok: false, error: 'Slow down a little!' };
        if (g.n >= MAX_GUESSES) return { ok: false, error: 'That’s plenty of guesses for one turn!' };
        g.n++; g.last = now;
        let res = 'no', k = -1;
        t.prompts.forEach((pr, i) => { if (pr.solved || pr.gone || res === 'right') return; const r = judge(text, pr); if (r === 'right' || (r === 'close' && res === 'no')) { res = r; k = i; } });
        const st = this.stats.get(p.id); st.guesses++; if (res === 'close') st.close++;
        g.list.push({ text, res }); if (g.list.length > 8) g.list.shift();
        t.feed.push({ id: p.id, text, res, k, seq: ++t.seq }); if (t.feed.length > FEED) t.feed.shift();
        if (res === 'right') this.solve(k, p.id, text);
        return { ok: true, res };
      }
      case 'clap': {
        if (this.phase !== 'bravo') return { ok: false, error: 'Applause comes after the scene!' };
        if (actor) return { ok: false, error: 'No applauding yourself!' };
        if (typeof m.id !== 'string' || !t.cast.includes(m.id) || !this.here(m.id)) return { ok: false, error: 'Applaud one of the actors.' };
        return this.clap(p, m.id);
      }
      default: return { ok: false, error: 'Unknown move.' };
    }
  }

  // Bots: a guess every few seconds; the right answer gets likelier as the clock runs down.
  botGuess(p, t) {
    if (this.phase !== 'act' || this.t !== t || !this.here(p.id) || t.cast.includes(p.id)) return;
    const open = t.prompts.map((pr, i) => [pr, i]).filter(([pr]) => !pr.solved && !pr.gone);
    if (!open.length) return;
    const [pr] = open[Math.floor(this.room.rng() * open.length)];
    const frac = t.actMs ? (this.room.now() - t.actStart) / t.actMs : 1;
    const chance = (0.06 + 0.3 * frac) * (this.skill.get(p.id) || 1);
    let text;
    if (this.room.rng() < chance) text = pr.answers[Math.floor(this.room.rng() * pr.answers.length)];
    else { const same = ALL.filter((x) => x.cat === pr.cat && x.text !== pr.text); text = same.length ? same[Math.floor(this.room.rng() * same.length)].text : 'no idea'; }
    const g = t.gs.get(p.id); if (g) g.last = -1e12;
    this.act(p, { op: 'guess', text });
    this.room.after(2500 + this.room.rng() * 5500, () => this.botGuess(p, t));
  }

  // ---- state ----
  pub(id) { const p = this.room.get(id); return p ? { id, name: p.name, avatar: p.avatar || null, color: p.color } : { id, name: '—', avatar: null, color: '#888' }; }
  standings() {
    return [...this.scores].filter(([id]) => this.here(id)).map(([id, points]) => ({ ...this.pub(id), points, gain: (this.t && this.phase === 'bravo' && this.t.gained.get(id)) || 0 }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  }
  // Player ids best-first once the game is over (for the party scoreboard across games).
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }
  awards() {
    const st = this.standings(), out = [];
    const top = (fn, min = 1, low = false) => {
      let best = null, who = [];
      for (const r of st) { const v = fn(this.stats.get(r.id)); if (v == null || v < min && !low) continue; if (best == null || (low ? v < best : v > best)) { best = v; who = [r]; } else if (v === best) who.push(r); }
      return best == null ? null : { who: who.slice(0, 3), v: best };
    };
    const secs = (ms) => (ms / 1000).toFixed(1) + 's';
    const add = (key, icon, title, a, why) => { if (a) out.push({ key, icon, title, ids: a.who.map((r) => r.id), name: a.who.map((r) => r.name).join(' & '), avatar: a.who[0].avatar, color: a.who[0].color, why: why(a.v) }); };
    add('oscar', '🏆', 'Oscar-worthy', top((s) => s.claps), (v) => `${v} 👏 from the room`);
    add('mime', '🤐', 'Mime Master', top((s) => s.fastestActMs, 0, true), (v) => `got guessed in ${secs(v)}`);
    add('reader', '🔮', 'Mind Reader', top((s) => s.right), (v) => `${v} right guess${v === 1 ? '' : 'es'}`);
    add('quick', '⚡', 'Quickest Guess', top((s) => s.fastestGuessMs, 0, true), (v) => `nailed one in ${secs(v)}`);
    add('stealer', '🌟', 'Scene Stealer', top((s) => s.bestClaps, 2), (v) => `${v} 👏 for a single scene`);
    add('close', '🔥', 'So Close', top((s) => s.close, 2), (v) => `${v} red-hot guesses`);
    add('typist', '⌨️', 'Keyboard Warrior', top((s) => s.guesses, 6), (v) => `${v} guesses typed`);
    return out.slice(0, 6);
  }
  promptPub(pr, k, reveal) {
    const c = CATS[pr.cat] || { icon: '🎭', label: pr.cat };
    return { k, cat: pr.cat, icon: c.icon, catLabel: c.label, words: pr.words, gone: pr.gone,
      text: reveal || pr.solved ? pr.text : null, skipped: reveal ? pr.skipped : [],
      solved: pr.solved ? { ...this.pub(pr.solved.by), ms: pr.solved.ms, said: pr.solved.text } : null };
  }
  common() {
    const t = this.t, reveal = this.phase === 'bravo' || this.phase === 'over';
    const tw = t ? TWISTS[t.kind] : null;
    return {
      phase: this.phase, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, phaseMs: this.phaseMs,
      n: this.n, of: this.s.turns, last: this.isFinal(), mult: FINAL_MULT, seconds: this.s.seconds,
      kind: t ? t.kind : null, twist: tw ? { icon: tw.icon, name: tw.name, rule: tw.rule } : null, style: t && t.style ? { icon: t.style.icon, label: t.style.label } : null,
      cast: t ? t.cast.filter((id) => this.here(id)).map((id, i) => ({ ...this.pub(id), k: t.role.get(id), leg: i })) : [],
      prompts: t ? t.prompts.map((pr, k) => this.promptPub(pr, k, reveal)) : [],
      relay: t && t.kind === 'relay' && this.phase === 'act' ? { leg: t.leg, of: t.cast.length, legEndsIn: Math.max(0, t.legEndsAt - this.room.now()), id: t.cast[t.leg] } : null,
      pose: t && t.kind === 'freeze' && (this.phase === 'act') ? { n: t.pose, of: POSES } : null,
    };
  }
  tv() {
    const t = this.t, c = this.common(), st = this.standings();
    const out = { ...c, count: st.length, standings: st.slice(0, 8) };
    if (t && (this.phase === 'act' || this.phase === 'bravo')) {
      out.feed = t.feed.slice(-12).map((f) => ({ ...this.pub(f.id), text: f.text, res: f.res, seq: f.seq }));
      out.guessCount = t.feed.length; out.guessers = this.room.list().length - t.cast.length;
    }
    if (t && this.phase === 'bravo') {
      const counts = {}; for (const v of t.claps.values()) counts[v] = (counts[v] || 0) + 1;
      out.claps = c.cast.map((a) => ({ id: a.id, n: counts[a.id] || 0 }));
      out.clapped = t.claps.size; out.voters = this.voters().length;
      out.gains = [...t.gained].filter(([id]) => this.here(id)).map(([id, pts]) => ({ ...this.pub(id), pts, why: t.why.get(id) || [] })).sort((a, b) => b.pts - a.pts).slice(0, 6);
    }
    if (this.phase === 'over') out.final = { standings: st.slice(0, 12), awards: this.awards() };
    return out;
  }
  view(p) {
    const t = this.t, c = this.common(), st = this.standings(), rank = st.findIndex((r) => r.id === p.id) + 1;
    const out = { ...c, me: p.id, points: this.scores.get(p.id) || 0, rank, count: st.length };
    if (!this.scores.has(p.id) || !t) return { ...out, role: 'watch' };
    const actor = t.cast.includes(p.id);
    out.role = actor ? 'actor' : 'guesser';
    if (actor) {
      const k = t.role.get(p.id), pr = t.prompts[k];
      if (pr) { const cp = CATS[pr.cat] || {}; out.mine = { k, text: pr.text, icon: cp.icon, catLabel: cp.label, words: pr.words, canSkip: !pr.skipped.length && !pr.solved && this.phase !== 'bravo', solved: !!pr.solved }; }
      if (t.kind === 'relay') out.myLeg = t.cast.indexOf(p.id);
      if (this.phase === 'act') out.choices = this.room.list().filter((x) => !t.cast.includes(x.id) && this.scores.has(x.id)).map((x) => this.pub(x.id));
      if (t.kind === 'scene') { const o = t.cast.find((id) => id !== p.id); out.partner = o ? this.pub(o) : null; }
    } else {
      const g = t.gs.get(p.id);
      out.myGuesses = g ? g.list.slice(-5) : [];
      out.solvedByMe = t.prompts.map((pr, k) => (pr.solved && pr.solved.by === p.id ? k : -1)).filter((k) => k >= 0);
    }
    if (this.phase === 'bravo') { out.myClap = t.claps.get(p.id) || null; out.clapsForMe = [...t.claps.values()].filter((x) => x === p.id).length; }
    out.gain = (this.phase === 'bravo' && t.gained.get(p.id)) || 0;
    out.why = (this.phase === 'bravo' && t.why.get(p.id)) || [];
    if (this.phase === 'over') { const aw = this.awards(); out.final = { top: st.slice(0, 5), awards: aw, mine: aw.filter((a) => a.ids.includes(p.id)) }; }
    return out;
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ minutes: M }) => {
  const seconds = M <= 7 ? 45 : 60;
  const { turns } = PF.best({ turns: [8, 6, 10, 12] }, (s) => 0.5 + s.turns * (seconds * 0.8 + 35) / 60, M);
  return { turns, seconds };
};

module.exports = {
  partyFit,
  key: 'actout', name: 'Act It Out', min: 3, best: [4, 12], fields, defaults, howSteps: 6, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/actout.js)
  locked: { how: 'Finish a game of JustSketch Relay to unlock it.' }, // public/unlocks.js + UNLOCK_RULES in box/room.js
  create: (room, settings) => new ActOut(room, settings),
  _test: { judge, judgeOne, keyWords, stem, TWISTS, POSES, GUESS, ACT, SPEED, TWIST_BONUS, CLAP, FINAL_MULT, CAST_MS, CUE_MS, BRAVO_MS },
};
