'use strict';
// JustSketch Relay: a drawing-telephone party game. Players sit in rings of 4–8. Everyone
// starts a "book" with a secret prompt and DRAWS it on their phone; the books pass around the
// ring: the next player sees only the drawing and GUESSES it, the next sees only that guess and
// DRAWS it, and so on. Then the TV reveals the books entry by entry, everyone votes for the
// funniest entry (×100 points), and books whose final guess still matches the prompt pay +50
// to everyone who worked on them. All prompts are original.
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'ringSize', label: 'Players per ring', options: opt([[4, 'About 4 per ring'], [6, 'About 6 per ring'], [8, 'About 8 per ring']]) },
  { key: 'prompts', label: 'Starting prompts', options: opt([['deck', 'Secret prompts from the deck'], ['write', 'Everyone writes their own']]) },
  { key: 'drawSeconds', label: 'Time to draw', options: opt([[45, '45 seconds'], [60, '60 seconds'], [90, '90 seconds']]) },
  { key: 'guessSeconds', label: 'Time to guess', options: opt([[20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds']]) },
  { key: 'showBooks', label: 'Books revealed on the TV', options: opt([[3, 'Up to 3 books'], [6, 'Up to 6 books'], [0, 'Every book']]) },
];
const defaults = { ringSize: 6, prompts: 'deck', drawSeconds: 60, guessSeconds: 30, showBooks: 6 };

const PALETTE = 8, ERASER = 8, SIZES = 3, MAX_STROKES = 400, MAX_POINTS = 8000;
const WRITE_SECONDS = 35, GRACE_MS = 1200, PASS_MS = 2500, ENTRY_DRAW_MS = 3600, ENTRY_TEXT_MS = 2600, FINAL_MS = 5000;
const VOTE_SECONDS = 15, RESULTS_MS = 4500, VOTE_POINTS = 100, CHAIN_BONUS = 50;
const AUTO_GUESS = '???';
const clean = (s, n = 60) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

// ~120 original, family-friendly prompts.
const PROMPTS = [
  'a penguin at a job interview', 'a cat on a skateboard', 'a giraffe stuck in an elevator', 'a dragon doing the dishes',
  'a snowman on a sunny beach', 'a robot walking a dog', 'a shark at the dentist', 'a cowboy riding a snail',
  'a wizard who lost his hat', 'grandma on a jet ski', 'a pizza with legs running away', 'a ghost doing yoga',
  'an octopus playing the drums', 'a banana wearing a superhero cape', 'a cloud crying rain', 'a hamster driving a race car',
  'an alien at a birthday party', 'a volcano sneezing', 'a frog on a lily pad throne', 'a burger in a bubble bath',
  'a knight scared of a tiny spider', 'a pirate with a rubber duck parrot', 'a dinosaur on a tricycle', 'a lighthouse wearing sunglasses',
  'a bee directing traffic', 'a vampire at the beach', 'a sloth winning a race', 'a toaster launching toast into space',
  'a mermaid stuck in a fishbowl', 'a bear stealing a picnic basket', 'a chef chasing a runaway chicken', 'a unicorn stuck in traffic',
  'a tiny house on a turtle’s back', 'the moon eating a cookie', 'a cactus giving a hug', 'a llama in a business suit',
  'a teacher on a pogo stick', 'a snail delivering the mail', 'an elephant hiding behind a lamp post', 'a monster under the bed reading a book',
  'a sandwich with way too many layers', 'a pigeon stealing french fries', 'a baby wearing a crown', 'a duck with an umbrella in the rain',
  'a superhero doing laundry', 'a broccoli bodybuilder', 'a king on a trampoline', 'a fish riding a bicycle',
  'a haunted vending machine', 'a tornado made of spaghetti', 'a dog doing its taxes', 'a koala DJ',
  'a sleepy sun in a nightcap', 'a carrot hiding from a rabbit', 'a mummy unravelling on the dance floor', 'an owl librarian',
  'a skeleton playing the xylophone', 'a submarine in a bathtub', 'a squirrel with a treasure map', 'a giant sneezing on a village',
  'a hot dog in a sleeping bag', 'a raccoon at a fancy restaurant', 'a castle made of pancakes', 'a pencil drawing itself',
  'a cow jumping over the moon', 'a dentist with a giant toothbrush', 'a gorilla at a tea party', 'a balloon escaping a party',
  'a caterpillar trying on shoes', 'a spaceship at a drive-thru', 'a polar bear with a sunburn', 'a family photo of potatoes',
  'a lion getting a haircut', 'a ninja tiptoeing past a sleeping cat', 'a waterfall of chocolate milk', 'a goat climbing a ladder',
  'a phone that needs a nap', 'a dragon roasting marshmallows', 'a crab with a tiny umbrella', 'a magician pulling a cat out of a hat',
  'a jellyfish at a disco', 'a lost sock on an adventure', 'an astronaut planting flowers on Mars', 'a puppy jumping into a pile of leaves',
  'a tree wearing a scarf', 'a whale in a swimming pool', 'a mouse lifting a giant cheese', 'a train made of sausages',
  'a grumpy cloud over one house', 'a queen bee on her throne', 'a kangaroo with a very full pocket', 'a turtle racing a rocket',
  'a ladybug with a backpack', 'a knight riding a goose', 'a sleepwalking zombie', 'a bowling ball with stage fright',
  'a camel at the North Pole', 'a pineapple in a tuxedo', 'a door that opens onto the ocean', 'a snowball fight between penguins',
  'a fox sneaking through a library', 'a time traveller late for school', 'a robot in love with a toaster', 'the tooth fairy with a wheelbarrow',
  'a bat hanging from a ceiling fan', 'a bunny singing into a carrot microphone', 'a crocodile at the hairdresser', 'a spider knitting a sweater',
  'a rainbow used as a slide', 'a horse in pajamas', 'a pizza delivery to the moon', 'a goldfish with a jetpack',
  'a hedgehog getting a hug', 'a ninja grandma', 'a mountain with a headache', 'a cupcake volcano',
  'a parrot that won’t stop talking', 'an ice cream cone melting in the sun', 'a mole popping up on a golf course', 'a dog walking its human',
  'a scarecrow scared of a crow', 'a sock puppet show', 'a hippo on a tightrope', 'a snail in a race car',
];
// Silly guesses for test bots.
const BOT_GUESSES = [
  'my uncle at a wedding', 'a potato', 'spaghetti', 'a confused lamp', 'modern art', 'a very angry egg', 'abstract feelings',
  'a horse? maybe?', 'the internet', 'my homework', 'a sad cloud', 'a dancing broom', 'soup', 'a wizard in trouble', 'tuesday',
  'a haunted sock', 'a tiny boat', 'grandpa’s car', 'a dinosaur sneezing', 'a lost balloon', 'a banana party', 'my cat at 3am',
  'an earthquake', 'a weird bird', 'a pancake tower', 'a disco ball', 'a chicken with a plan', 'a spooky tree',
  'a monster eating noodles', 'a fish wearing shoes', 'bubbles', 'my dentist', 'a UFO', 'a slice of cake', 'a sleepy dragon',
  'a pile of laundry', 'a squid on vacation', 'a lightbulb idea', 'the floor is lava', 'a snake in a hat',
];

// ---------- fuzzy matching (is this guess "the same thing"?) ----------
const STOP = new Set('a an the of on in at with and to is are was my his her their your our its some for from by into onto this that it who which very one'.split(' '));
const stem = (w) => (w.length > 5 && w.endsWith('ing') ? w.slice(0, -3) : w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)).map(stem);
function lev1(a, b) { // edit distance ≤ 1?
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}
const wordEq = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) || (Math.min(a.length, b.length) >= 5 && lev1(a, b));
// Dice similarity over content words: 1 = same idea, 0 = nothing in common.
function similarity(x, y) {
  const a = words(x), b = words(y);
  if (!a.length || !b.length) return 0;
  const used = new Array(b.length).fill(false); let common = 0;
  for (const w of a) { const k = b.findIndex((v, i) => !used[i] && wordEq(w, v)); if (k >= 0) { used[k] = true; common++; } }
  return (2 * common) / (a.length + b.length);
}
const matches = (x, y) => similarity(x, y) >= 0.5;

// ---------- drawings: compact strokes, validated ----------
// A drawing is [{ c: colour 0–7 (8 = eraser), s: size 0–2, p: [x0, y0, x1, y1, …] }] in a 0–1000 square.
function cleanStrokes(raw) {
  if (!Array.isArray(raw)) return { error: 'That drawing didn’t arrive. Press Done again.' };
  if (raw.length > MAX_STROKES) return { error: `Too many strokes (max ${MAX_STROKES}).` };
  const out = []; let pts = 0;
  for (const s of raw) {
    if (!s || typeof s !== 'object') return { error: 'That drawing is broken.' };
    if (!Number.isInteger(s.c) || s.c < 0 || s.c > ERASER) return { error: 'Only the palette colours, please.' };
    if (!Number.isInteger(s.s) || s.s < 0 || s.s >= SIZES) return { error: 'Unknown brush size.' };
    const p = s.p;
    if (!Array.isArray(p) || p.length < 2 || p.length % 2 || p.length > MAX_POINTS * 2) return { error: 'That drawing is broken.' };
    pts += p.length / 2;
    if (pts > MAX_POINTS) return { error: 'That drawing is too detailed. Try fewer strokes.' };
    for (const n of p) if (!Number.isInteger(n) || n < 0 || n > 1000) return { error: 'That drawing is off the page.' };
    out.push({ c: s.c, s: s.s, p: p.slice() });
  }
  return { strokes: out };
}

class Sketch {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'write'; this.books = []; this.rings = []; this.step = -1; this.steps = 0;
    this.tasks = new Map(); this.scores = new Map(); this.stats = new Map(); this.written = new Map(); this.rerolled = new Set();
    this.endsAt = 0; this.timer = null; this.ending = false; this.deck = [];
    this.show = []; this.showPos = -1; this.cur = null; this.entry = 0; this.votes = new Map(); this.awards = [];
    this.ver = 0; this.stCache = null;
  }
  shuffle(a) { const r = this.room.rng; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn, grace = 0) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms + grace, fn); }
  draw() { if (!this.deck.length) this.deck = this.shuffle(PROMPTS.slice()); return this.deck.pop(); }
  add(id, pts) { if (!pts) return; this.scores.set(id, (this.scores.get(id) || 0) + pts); this.ver++; }
  stat(id) { if (!this.stats.has(id)) this.stats.set(id, { drawVotes: 0, guessVotes: 0, correct: 0, guesses: 0, chaos: 0, wild: null }); return this.stats.get(id); }

  start() {
    const ids = this.shuffle(this.room.list().map((p) => p.id));
    for (const id of ids) { this.scores.set(id, 0); this.stat(id); }
    // Rings of roughly the chosen size (never smaller than 4 when there are several rings).
    const N = ids.length;
    let nR = Math.max(1, Math.round(N / this.s.ringSize));
    while (nR > 1 && Math.floor(N / nR) < 4) nR--;
    const base = Math.floor(N / nR), rem = N % nR;
    let at = 0;
    for (let r = 0; r < nR; r++) {
      const n = base + (r < rem ? 1 : 0), members = ids.slice(at, at + n); at += n;
      // Every book has to end on a guess: even rings go all the way round, odd rings stop one short.
      const ring = { n, members, steps: n % 2 ? n - 1 : n, books: [] };
      members.forEach((owner, pos) => {
        const book = { id: this.books.length, owner, ring: r, pos, entries: [null], tally: null, survived: false, scored: false, shown: false };
        this.books.push(book); ring.books.push(book);
      });
      this.rings.push(ring);
    }
    this.steps = Math.max(...this.rings.map((r) => r.steps));
    if (this.s.prompts === 'write') {
      this.phase = 'write';
      this.setTimer(WRITE_SECONDS * 1000, () => this.beginSteps(), GRACE_MS);
      for (const p of this.room.list()) if (p.bot) this.room.after(1500 + this.room.rng() * 8000, () => { if (this.phase === 'write') this.act(p, { op: 'prompt', text: this.draw() }); });
    } else this.beginSteps();
  }
  joined(p) { if (!this.scores.has(p.id)) { this.scores.set(p.id, 0); this.stat(p.id); this.ver++; } } // late joiners watch and vote
  left() { this.ver++; if (this.phase === 'step') this.checkDone(); else if (this.phase === 'write') this.checkWritten(); else if (this.phase === 'vote') this.checkVotes(); }

  // ---------- writing your own prompt ----------
  checkWritten() {
    if (this.phase !== 'write') return;
    const owners = this.books.map((b) => b.owner).filter((id) => this.room.get(id));
    if (owners.every((id) => this.written.has(id))) { this.room.cancel(this.timer); this.endsAt = this.room.now() + 800; this.timer = this.room.after(800, () => this.beginSteps()); }
  }
  beginSteps() {
    if (this.phase !== 'write' || this.step >= 0) return;
    for (const b of this.books) {
      const own = this.written.get(b.owner);
      b.entries[0] = { kind: 'prompt', by: b.owner, text: own || this.draw(), own: !!own };
    }
    this.nextStep();
  }

  // ---------- the relay ----------
  nextStep() {
    this.step++;
    if (this.step >= this.steps) return this.beginReveal();
    const kind = this.step % 2 === 0 ? 'draw' : 'guess';
    this.phase = 'step'; this.kind = kind; this.tasks = new Map(); this.ending = false;
    for (const ring of this.rings) {
      if (this.step >= ring.steps) continue;
      ring.members.forEach((pid, i) => {
        const book = ring.books[(((i - this.step) % ring.n) + ring.n) % ring.n];
        this.tasks.set(pid, { book: book.id, idx: this.step + 1, kind, done: false });
      });
    }
    const secs = kind === 'draw' ? this.s.drawSeconds : this.s.guessSeconds;
    this.setTimer(secs * 1000, () => this.endStep(), GRACE_MS);
    this.room.fx(kind, { step: this.step + 1 });
    const step = this.step;
    if (secs > 20) this.room.after((secs - 10) * 1000, () => { if (this.phase === 'step' && this.step === step && !this.ending) this.room.fx('hurry'); });
    // Bots doodle and guess after a little "thinking".
    for (const [pid, t] of this.tasks) {
      const p = this.room.get(pid); if (!p || !p.bot) continue;
      const wait = 1500 + this.room.rng() * Math.min(secs * 500, kind === 'draw' ? 12000 : 7000);
      this.room.after(wait, () => {
        if (this.phase !== 'step' || this.step !== step || !this.room.get(pid)) return;
        if (t.kind === 'draw') this.act(p, { op: 'draw', strokes: this.scribble() });
        else {
          const src = this.books[t.book].entries[t.idx - 2];
          this.act(p, { op: 'guess', text: this.room.rng() < 0.35 && src ? src.text : BOT_GUESSES[Math.floor(this.room.rng() * BOT_GUESSES.length)] });
        }
      });
    }
  }
  scribble() {
    const r = this.room.rng, out = [], n = 2 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      let x = 150 + Math.floor(r() * 700), y = 150 + Math.floor(r() * 700); const p = [x, y], k = 4 + Math.floor(r() * 12);
      for (let j = 0; j < k; j++) { x = Math.max(0, Math.min(1000, x + Math.floor((r() - 0.5) * 160))); y = Math.max(0, Math.min(1000, y + Math.floor((r() - 0.5) * 160))); p.push(x, y); }
      out.push({ c: Math.floor(r() * PALETTE), s: Math.floor(r() * SIZES), p });
    }
    return out;
  }
  checkDone() {
    if (this.phase !== 'step' || this.ending) return;
    for (const [pid, t] of this.tasks) if (!t.done && this.room.get(pid)) return;
    this.ending = true; this.room.cancel(this.timer); this.endsAt = this.room.now() + 800;
    this.timer = this.room.after(800, () => this.endStep());
  }
  endStep() {
    if (this.phase !== 'step') return;
    // Missed it? An auto entry keeps the chain going.
    for (const [pid, t] of this.tasks) {
      if (t.done) continue;
      t.done = true;
      this.books[t.book].entries[t.idx] = t.kind === 'draw' ? { kind: 'draw', by: pid, strokes: [], auto: true } : { kind: 'guess', by: pid, text: AUTO_GUESS, auto: true };
    }
    if (this.step + 1 >= this.steps) return this.beginReveal();
    this.phase = 'pass'; this.room.fx('pass');
    this.setTimer(PASS_MS, () => this.nextStep());
  }

  // ---------- the reveal ----------
  beginReveal() {
    for (const b of this.books) {
      const last = b.entries[b.entries.length - 1];
      b.final = last && last.kind === 'guess' ? last : null;
      b.survived = !!(b.final && !b.final.auto && matches(b.entries[0].text, b.final.text));
      b.change = b.final ? 1 - similarity(b.entries[0].text, b.final.text) : 0;
      for (let j = 2; j < b.entries.length; j += 2) {
        const g = b.entries[j], src = b.entries[j - 2]; if (!g || !src) continue;
        const st = this.stat(g.by); st.guesses++;
        if (g.auto) continue;
        if (matches(src.text, g.text)) st.correct++;
        const d = 1 - similarity(src.text, g.text); st.chaos += d;
        if (!st.wild || d > st.wild.d) st.wild = { d, from: src.text, to: g.text };
      }
    }
    // Books with humans in them first (owners, then contributors), then the rest.
    const human = (id) => { const p = this.room.get(id); return p && !p.bot; };
    const tier = (b) => (human(b.owner) ? 0 : b.entries.some((e) => e && human(e.by)) ? 1 : 2);
    const order = this.shuffle(this.books.slice()).sort((a, b) => tier(a) - tier(b));
    const max = this.s.showBooks > 0 ? this.s.showBooks : order.length;
    this.show = order.slice(0, max).map((b) => b.id);
    this.showPos = -1; this.tasks = new Map();
    this.nextBook();
  }
  nextBook() {
    this.showPos++;
    if (this.showPos >= this.show.length) return this.finish();
    this.cur = this.books[this.show[this.showPos]]; this.cur.shown = true;
    this.entry = 0; this.phase = 'show'; this.votes = new Map();
    this.room.fx('book', { n: this.showPos + 1 });
    this.setTimer(ENTRY_TEXT_MS, () => this.advanceEntry());
  }
  advanceEntry() {
    if (this.phase !== 'show') return;
    this.entry++;
    if (this.entry >= this.cur.entries.length) return this.goFinal();
    const e = this.cur.entries[this.entry];
    this.room.fx(e.kind === 'draw' ? 'flip' : 'guessIn');
    this.setTimer(e.kind === 'draw' ? ENTRY_DRAW_MS : ENTRY_TEXT_MS, () => this.advanceEntry());
  }
  scoreBook(b) {
    if (b.scored) return; b.scored = true;
    if (!b.survived) return;
    for (const id of new Set(b.entries.filter(Boolean).map((e) => e.by))) this.add(id, CHAIN_BONUS);
  }
  goFinal() {
    this.entry = this.cur.entries.length - 1; this.phase = 'final';
    this.scoreBook(this.cur);
    this.room.fx(this.cur.survived ? 'survived' : 'chaos');
    this.setTimer(FINAL_MS, () => this.openVote());
  }
  votable(b, id) { return b.entries.map((e, i) => (i > 0 && e && !e.auto && e.by !== id ? i : -1)).filter((i) => i > 0); }
  openVote() {
    if (this.phase !== 'final') return;
    this.phase = 'vote'; this.votes = new Map(); this.room.fx('vote');
    this.setTimer(VOTE_SECONDS * 1000, () => this.closeVote());
    const b = this.cur;
    if (!this.room.list().some((p) => this.votable(b, p.id).length)) { this.setTimer(1500, () => this.closeVote()); return; }
    for (const p of this.room.list()) {
      if (!p.bot) continue;
      this.room.after(1200 + this.room.rng() * 7000, () => {
        if (this.phase !== 'vote' || this.cur !== b || !this.room.get(p.id)) return;
        const ok = this.votable(b, p.id); if (ok.length) this.act(p, { op: 'vote', entry: ok[Math.floor(this.room.rng() * ok.length)] });
      });
    }
  }
  checkVotes() {
    if (this.phase !== 'vote') return;
    const voters = this.room.list().filter((p) => this.votable(this.cur, p.id).length);
    if (voters.every((p) => this.votes.has(p.id))) this.closeVote();
  }
  closeVote() {
    if (this.phase !== 'vote') return;
    const b = this.cur, tally = b.entries.map(() => 0);
    for (const i of this.votes.values()) tally[i]++;
    tally.forEach((n, i) => {
      if (!n) return; const e = b.entries[i];
      this.add(e.by, n * VOTE_POINTS);
      const st = this.stat(e.by); if (e.kind === 'draw') st.drawVotes += n; else st.guessVotes += n;
    });
    const top = Math.max(0, ...tally);
    b.tally = tally; b.top = top ? tally.map((n, i) => (n === top ? i : -1)).filter((i) => i >= 0) : [];
    this.phase = 'results'; this.room.fx(top ? 'results' : 'shrug');
    this.setTimer(RESULTS_MS, () => this.nextBook());
  }
  finish() {
    for (const b of this.books) this.scoreBook(b); // unshown books still pay the chain bonus
    const pick = (val, min = 1) => {
      let best = null, bv = 0;
      for (const [id, st] of this.stats) {
        if (!this.room.get(id)) continue;
        const v = val(st);
        if (v >= min && (best == null || v > bv || (v === bv && (this.scores.get(id) || 0) > (this.scores.get(best) || 0)))) { best = id; bv = v; }
      }
      return best == null ? null : { id: best, v: bv };
    };
    const A = [];
    const art = pick((s) => s.drawVotes); if (art) A.push({ key: 'artist', icon: '🎨', title: 'Best Artist', id: art.id, detail: `${art.v} vote${art.v === 1 ? '' : 's'} on their drawings` });
    const gue = pick((s) => s.guessVotes); if (gue) A.push({ key: 'guesser', icon: '💬', title: 'Best Guesser', id: gue.id, detail: `${gue.v} vote${gue.v === 1 ? '' : 's'} on their guesses` });
    const cha = pick((s) => s.chaos, 0.01);
    if (cha) { const w = this.stats.get(cha.id).wild; A.push({ key: 'chaos', icon: '🌀', title: 'Chaos Agent', id: cha.id, detail: w ? `“${w.from}” → “${w.to}”` : 'Sent the books off the rails' }); }
    const mind = pick((s) => s.correct); if (mind) A.push({ key: 'mind', icon: '🔮', title: 'Mind Reader', id: mind.id, detail: `${mind.v} spot-on guess${mind.v === 1 ? '' : 'es'}` });
    this.awards = A.map((a) => ({ ...a, name: this.room.name(a.id) }));
    this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.cur = null;
    this.room.fx('win');
  }

  next() {
    const ph = this.phase;
    if (ph === 'write') { this.room.cancel(this.timer); this.beginSteps(); }
    else if (ph === 'step') { this.room.cancel(this.timer); this.endStep(); }
    else if (ph === 'pass') { this.room.cancel(this.timer); this.nextStep(); }
    else if (ph === 'show') { this.room.cancel(this.timer); this.goFinal(); }
    else if (ph === 'final') { this.room.cancel(this.timer); this.openVote(); }
    else if (ph === 'vote') { this.room.cancel(this.timer); this.closeVote(); }
    else if (ph === 'results') { this.room.cancel(this.timer); this.nextBook(); }
  }

  act(p, m) {
    m = m || {};
    if (m.op === 'prompt') {
      if (this.phase !== 'write') return { ok: false, error: 'Prompt writing is over.' };
      if (!this.books.some((b) => b.owner === p.id)) return { ok: false, error: 'You joined mid-game: you’ll vote on the books!' };
      const text = clean(m.text);
      if (text.length < 3) return { ok: false, error: 'Write a few words for someone to draw.' };
      this.written.set(p.id, text); this.checkWritten();
      return { ok: true };
    }
    const t = this.tasks.get(p.id);
    if (m.op === 'reroll') {
      if (this.phase !== 'step' || this.step !== 0 || !t || t.done) return { ok: false, error: 'Too late to change it.' };
      const first = this.books[t.book].entries[0];
      if (first.own) return { ok: false, error: 'You wrote this one yourself!' };
      if (this.rerolled.has(p.id)) return { ok: false, error: 'You already swapped your prompt.' };
      this.rerolled.add(p.id); first.text = this.draw();
      return { ok: true };
    }
    if (m.op === 'draw' || m.op === 'guess') {
      if (this.phase !== 'step') return { ok: false, error: 'Time’s up for that one.' };
      if (!t) return { ok: false, error: 'Nothing for you to do right now. Hang tight!' };
      if (t.done) return { ok: false, error: 'Already sent!' };
      if (t.kind !== m.op) return { ok: false, error: t.kind === 'draw' ? 'This step is for drawing.' : 'This step is for guessing.' };
      let entry;
      if (m.op === 'draw') { const r = cleanStrokes(m.strokes); if (r.error) return { ok: false, error: r.error }; entry = { kind: 'draw', by: p.id, strokes: r.strokes }; }
      else { const text = clean(m.text); if (!text) return { ok: false, error: 'Type your guess first.' }; entry = { kind: 'guess', by: p.id, text }; }
      this.books[t.book].entries[t.idx] = entry; t.done = true;
      this.checkDone();
      return { ok: true };
    }
    if (m.op === 'vote') {
      if (this.phase !== 'vote') return { ok: false, error: 'Voting isn’t open.' };
      const i = Number(m.entry);
      if (!this.votable(this.cur, p.id).includes(i)) return { ok: false, error: this.cur.entries[i] && this.cur.entries[i].by === p.id ? 'No voting for yourself!' : 'Pick one of the entries.' };
      this.votes.set(p.id, i); this.checkVotes();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }

  // ---------- screens ----------
  standings() {
    if (this.stCache && this.stCache.ver === this.ver) return this.stCache.rows;
    const rows = [...this.scores].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), points: pts })).sort((a, b) => b.points - a.points);
    this.stCache = { ver: this.ver, rows };
    return rows;
  }
  pubEntry(e) { return e ? { kind: e.kind, by: this.room.name(e.by), byId: e.by, text: e.kind === 'draw' ? null : e.text, strokes: e.kind === 'draw' ? e.strokes : null, auto: !!e.auto } : null; }
  pubBook(b, upto = b.entries.length) {
    return { id: b.id, owner: this.room.name(b.owner), ownerId: b.owner, entries: b.entries.slice(0, upto).map((e) => this.pubEntry(e)), total: b.entries.length };
  }
  endsIn() { return this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0; }
  progress() {
    let done = 0, of = 0; const waiting = [];
    for (const [pid, t] of this.tasks) { if (!this.room.get(pid)) continue; of++; if (t.done) done++; else waiting.push(this.room.name(pid)); }
    return { done, of, waiting: waiting.slice(0, 30), more: Math.max(0, waiting.length - 30) };
  }
  tv() {
    const base = { phase: this.phase, endsIn: this.endsIn(), step: this.step + 1, steps: this.steps, rings: this.rings.length, standings: this.standings().slice(0, 10) };
    if (this.phase === 'write') {
      const owners = this.books.map((b) => b.owner).filter((id) => this.room.get(id));
      return { ...base, done: owners.filter((id) => this.written.has(id)).length, of: owners.length, waiting: owners.filter((id) => !this.written.has(id)).slice(0, 30).map((id) => this.room.name(id)) };
    }
    if (this.phase === 'step' || this.phase === 'pass') return { ...base, kind: this.kind, nextKind: this.step % 2 === 0 ? 'guess' : 'draw', ...this.progress() };
    if (this.cur) {
      const b = this.cur, upto = this.phase === 'show' ? this.entry + 1 : b.entries.length;
      return {
        ...base, n: this.showPos + 1, of: this.show.length, entry: this.entry, book: this.pubBook(b, upto),
        survived: this.phase !== 'show' ? b.survived : null, voted: this.phase === 'vote' ? this.votes.size : 0,
        tally: this.phase === 'results' ? b.tally : null, top: this.phase === 'results' ? b.top : null,
      };
    }
    if (this.phase === 'over') {
      return {
        ...base, standings: this.standings().slice(0, 12), awards: this.awards,
        gallery: this.books.map((b) => ({ id: b.id, owner: this.room.name(b.owner), prompt: b.entries[0] && b.entries[0].text, final: b.final ? b.final.text : '', survived: b.survived, shown: b.shown })),
      };
    }
    return base;
  }
  hostAct(m) {
    if (m.type !== 'sketchBook') return { ok: false, error: 'Unknown action.' };
    if (this.phase !== 'over') return { ok: false, error: 'The gallery opens at the end.' };
    const b = this.books[Number(m.book)];
    if (!b) return { ok: false, error: 'No such book.' };
    return { ok: true, book: { ...this.pubBook(b), survived: b.survived } };
  }
  view(p) {
    const st = this.standings(), rank = st.findIndex((x) => x.id === p.id) + 1;
    const base = { phase: this.phase, endsIn: this.endsIn(), step: this.step + 1, steps: this.steps, points: this.scores.get(p.id) || 0, rank, players: st.length, inGame: this.books.some((b) => b.owner === p.id) };
    if (this.phase === 'write') return { ...base, wrote: this.written.get(p.id) || null };
    if (this.phase === 'step' || this.phase === 'pass') {
      const t = this.tasks.get(p.id), pr = this.progress();
      const v = { ...base, kind: this.kind, nextKind: this.step % 2 === 0 ? 'guess' : 'draw', done: pr.done, total: pr.of, task: null };
      if (t && this.phase === 'step') {
        const b = this.books[t.book], src = b.entries[t.idx - 1];
        v.task = { key: `${this.step}:${b.id}`, kind: t.kind, done: t.done, first: t.idx === 1, own: t.idx === 1 && !!src.own, canReroll: t.idx === 1 && !src.own && !this.rerolled.has(p.id) };
        if (t.kind === 'draw') v.task.text = src.text; else { v.task.strokes = src.strokes; v.task.blank = !!src.auto; }
      }
      return v;
    }
    if (this.cur) {
      const b = this.cur, v = { ...base, n: this.showPos + 1, of: this.show.length, owner: this.room.name(b.owner), mine: b.owner === p.id, inBook: b.entries.some((e) => e && e.by === p.id) };
      if (this.phase === 'vote') { v.book = this.pubBook(b); v.can = this.votable(b, p.id); v.myVote = this.votes.has(p.id) ? this.votes.get(p.id) : null; }
      if (this.phase === 'results') { v.gain = b.entries.reduce((s, e, i) => s + (e && e.by === p.id ? (b.tally[i] || 0) : 0), 0); v.survived = b.survived; }
      if (this.phase === 'final') v.survived = b.survived;
      return v;
    }
    if (this.phase === 'over') {
      const mine = this.books.find((b) => b.owner === p.id);
      return { ...base, final: st.slice(0, 10), awards: this.awards.filter((a) => a.id === p.id), myBook: mine ? { prompt: mine.entries[0].text, final: mine.final ? mine.final.text : '', survived: mine.survived } : null };
    }
    return base;
  }
}

module.exports = {
  key: 'sketch', name: 'JustSketch Relay', min: 3, fields, defaults,
  create: (room, settings) => new Sketch(room, settings),
  _test: { similarity, matches, cleanStrokes, PROMPTS, MAX_POINTS, MAX_STROKES },
};
