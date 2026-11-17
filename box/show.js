'use strict';
// Intro cutscenes. Two modes:
//  - 'facts' (game shows: Price Panic, JustBid; module `show: true`): described below.
//  - 'cast' (every other small game; module `show: { facts: false }`): a short cutscene with
//    no phone step: the opening shots (OPEN_MS), a quick roll call of the players, the game.
// Game-show mode:
// When the host starts, the TV plays a show opening (studio, live audience, the host) while
// every phone writes a funny fact about themselves. Then the host introduces the
// contestants one by one, and the game begins. The server owns the timing so the TV and
// phones stay in step; the TV draws it all (public/box/show.js).
const FACT_MS = 45000; // longest the phones get to write
const FACT_MIN_MS = 20000; // the opening plays at least this long (studio → audience → host)
const PER_MS = 5200; // each featured contestant
const OUTRO_MS = 6000; // "Let's play!" before the game
const MAX_FEATURED = 8; // more than this: the rest wave from a contestant wall
const CAST_OPEN_MS = 7000, CAST_PER_MS = 900, CAST_OUTRO_MS = 3000, CAST_MAX = 12; // cast mode

const CAST_FIELD = { key: 'showIntro', label: 'Intro cutscene', options: [{ value: true, label: 'On' }, { value: false, label: 'Off: straight to the game' }] };
const SHOW_FIELD = { key: 'showIntro', label: 'Game-show opening', options: [{ value: true, label: 'On: meet the contestants' }, { value: false, label: 'Off: straight to the game' }] };

const BOT_FACTS = [
  'Once lost a staring contest to a goldfish.',
  'Owns 14 identical gray hoodies.',
  'Can whistle the whole alphabet song backwards.',
  'Was banned from a ball pit in 2009.',
  'Thinks cereal is a soup and will not discuss it.',
  'Has never once won a raffle. Not once.',
  'Sneezes exactly three times, every time.',
  'Named their houseplant Kevin. Kevin is thriving.',
  'Can fit an entire donut in their mouth. Has proof.',
  'Got lost in a corn maze for four hours. It was a small maze.',
  'Taught a parrot to say "beep boop".',
  'Still has the receipt for every pair of socks.',
];
const clean = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 90);

class Show {
  constructor(room) {
    const cfg = room.def.show;
    this.mode = cfg && typeof cfg === 'object' && cfg.facts === false ? 'cast' : 'facts';
    this.room = room; this.step = 'facts'; this.facts = new Map(); this.featured = [];
    this.stepAt = room.now(); this.endsAt = this.stepAt + FACT_MS; this.timer = null; this.minTimer = null;
  }
  humans() { return this.room.list().filter((p) => !p.bot); }
  begin() {
    if (this.mode === 'cast') return this.cast();
    this.timer = this.room.after(FACT_MS, () => this.intros());
    this.minTimer = this.room.after(FACT_MIN_MS, () => this.check());
    let i = 0;
    for (const p of this.room.list()) if (p.bot) {
      const fact = BOT_FACTS[(i++ + p.name.length) % BOT_FACTS.length];
      this.room.after(3000 + this.room.rng() * 12000, () => { if (this.step === 'facts' && !this.facts.has(p.id)) this.facts.set(p.id, fact); });
    }
  }
  // Cast mode: no phone step, straight into the cutscene and the roll call.
  cast() {
    const people = this.room.list();
    this.featured = [...people.filter((p) => !p.bot), ...people.filter((p) => p.bot)].slice(0, CAST_MAX).map((p) => p.id);
    this.step = 'intros'; this.stepAt = this.room.now();
    const ms = CAST_OPEN_MS + this.featured.length * CAST_PER_MS + CAST_OUTRO_MS;
    this.endsAt = this.stepAt + ms;
    this.timer = this.room.after(ms, () => this.finish());
  }
  submit(p, text) {
    if (this.mode === 'cast') return { ok: false, error: 'Watch the big screen!' };
    if (this.step !== 'facts') return { ok: false, error: 'Too late: the show has started!' };
    if (typeof text !== 'string') return { ok: false, error: 'Type a funny fact.' };
    const t = clean(text);
    if (t.length < 3) return { ok: false, error: 'Tell us a bit more!' };
    this.facts.set(p.id, t);
    this.check();
    return { ok: true };
  }
  // Everyone's in and the opening has played: on to the contestants.
  check() {
    if (this.step !== 'facts' || this.room.now() - this.stepAt < FACT_MIN_MS) return;
    if (this.humans().every((p) => this.facts.has(p.id) || p.sockets === 0)) this.intros();
  }
  intros() {
    if (this.step !== 'facts') return;
    this.room.cancel(this.timer); this.room.cancel(this.minTimer);
    const withFact = (list) => list.filter((p) => this.facts.has(p.id));
    const people = this.room.list();
    this.featured = [...withFact(people.filter((p) => !p.bot)), ...withFact(people.filter((p) => p.bot))].slice(0, MAX_FEATURED).map((p) => p.id);
    // Nobody wrote anything: still meet a few contestants.
    if (!this.featured.length) this.featured = people.slice(0, Math.min(4, MAX_FEATURED)).map((p) => p.id);
    this.step = 'intros'; this.stepAt = this.room.now();
    const ms = this.featured.length * PER_MS + OUTRO_MS;
    this.endsAt = this.stepAt + ms;
    this.room.fx('showIntros');
    this.timer = this.room.after(ms, () => this.finish());
  }
  skip() { if (this.step === 'facts') this.intros(); else this.finish(); return { ok: true }; }
  finish() { if (this.step === 'done') return; this.step = 'done'; this.room.cancel(this.timer); this.room.cancel(this.minTimer); this.room.beginGame(); }
  card(id) { const p = this.room.get(id); return p ? { id, name: p.name, avatar: p.avatar, color: p.color, bot: !!p.bot, fact: this.facts.get(id) || null } : null; }
  tv() {
    const now = this.room.now(), humans = this.humans();
    return {
      mode: this.mode, step: this.step, game: this.room.def.key, title: this.room.def.name,
      stepAgo: now - this.stepAt, endsIn: Math.max(0, this.endsAt - now),
      ...(this.mode === 'cast' ? { openMs: CAST_OPEN_MS, perMs: CAST_PER_MS, outroMs: CAST_OUTRO_MS } : { perMs: PER_MS, outroMs: OUTRO_MS, minMs: FACT_MIN_MS }),
      submitted: humans.filter((p) => this.facts.has(p.id)).length, of: humans.length,
      waiting: humans.filter((p) => !this.facts.has(p.id) && p.sockets > 0).slice(0, 8).map((p) => p.name),
      featured: this.featured.map((id) => this.card(id)).filter(Boolean),
      others: this.room.list().filter((p) => !this.featured.includes(p.id)).slice(0, 60).map((p) => ({ name: p.name, avatar: p.avatar, color: p.color })),
    };
  }
  view(p) {
    const now = this.room.now(), i = this.featured.indexOf(p.id);
    const per = this.mode === 'cast' ? CAST_PER_MS : PER_MS, open = this.mode === 'cast' ? CAST_OPEN_MS : 0;
    return { mode: this.mode, step: this.step, title: this.room.def.name, myFact: this.facts.get(p.id) || null, endsIn: Math.max(0, this.endsAt - now), submitted: this.facts.size, of: this.room.list().length,
      // When it's your turn to be introduced, your phone lights up.
      introIn: i >= 0 && this.step === 'intros' ? open + i * per - (now - this.stepAt) : null, perMs: per, featured: i >= 0 };
  }
}

module.exports = { CAST_FIELD, CAST_OPEN_MS, CAST_PER_MS, CAST_OUTRO_MS, CAST_MAX, Show, SHOW_FIELD, FACT_MS, FACT_MIN_MS, PER_MS, OUTRO_MS, MAX_FEATURED, BOT_FACTS };
