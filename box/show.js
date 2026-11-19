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
// How to play: after the intro, the TV walks through the rules step by step (the steps are the
// game's intro `tutorial`, else its `how` list) while phones show each step with a "Got it" button.
// When every player has tapped Got it, it moves on. Module `howSteps` = how many steps (default 5).
const HOWTO_STEP_MS = 7500, HOWTO_END_MS = 2500, HOWTO_MIN_MS = 6000;
// Party Mode intros ("🎬 Intros" in the setup, box/room.js start()):
//  - 'card': a short title card instead of the cutscene ("Skip intros"): CARD_MS, then the game.
//  - opts.noHowto: the cutscene only, no how-to steps (the phones' ❓ still has them).
//  - opts.preview: the next game's cutscene played during the standings break ("Play them in
//    the break"); it never starts the game: opts.onDone runs when it ends.
const CARD_MS = 4500;
const howMs = (def) => Math.max(1, Math.min(8, def.howSteps || 5)) * HOWTO_STEP_MS + HOWTO_END_MS;
// A cast-mode game may ask for a longer opening (module `show: { facts: false, openMs }`) so its lines fit.
const castOpenMs = (def) => Math.max(CAST_OPEN_MS, Math.min(20000, Number(def && def.show && def.show.openMs) || 0));

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
  constructor(room, opts = {}) {
    this.def = opts.def || room.def;
    const cfg = this.def.show;
    this.mode = opts.mode || (cfg && typeof cfg === 'object' && cfg.facts === false ? 'cast' : 'facts');
    this.noHowto = !!opts.noHowto; this.preview = !!opts.preview; this.onDone = opts.onDone || null; this.info = opts.info || null;
    this.room = room; this.step = 'facts'; this.facts = new Map(); this.featured = []; this.ready = new Set();
    this.stepAt = room.now(); this.endsAt = this.stepAt + FACT_MS; this.timer = null; this.minTimer = null;
  }
  humans() { return this.room.list().filter((p) => !p.bot); }
  begin() {
    if (this.mode === 'card') return this.titleCard();
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
    const ms = castOpenMs(this.def) + this.featured.length * CAST_PER_MS + CAST_OUTRO_MS;
    this.endsAt = this.stepAt + ms;
    this.timer = this.room.after(ms, () => this.afterIntro());
  }
  // Skip intros: just the game's title card for a moment.
  titleCard() {
    this.step = 'card'; this.stepAt = this.room.now(); this.endsAt = this.stepAt + CARD_MS;
    this.timer = this.room.after(CARD_MS, () => this.finish());
  }
  // After the cutscene: how to play (or straight on).
  afterIntro() { if (this.noHowto) this.finish(); else this.howto(); }
  // How to play: step by step on the TV and every phone.
  howto() {
    if (this.step === 'howto' || this.step === 'done') return;
    this.room.cancel(this.timer);
    this.step = 'howto'; this.stepAt = this.room.now(); this.ready = new Set();
    const ms = howMs(this.def);
    this.endsAt = this.stepAt + ms;
    this.room.fx('howto');
    this.timer = this.room.after(ms, () => this.finish());
  }
  // A player tapped "Got it": once everyone has, the game starts (after a short beat).
  gotit(p) {
    if (this.step !== 'howto') return { ok: false, error: 'Watch the big screen!' };
    this.ready.add(p.id);
    const waiting = this.humans().filter((q) => q.sockets > 0 && !this.ready.has(q.id));
    if (!waiting.length && this.room.now() - this.stepAt >= HOWTO_MIN_MS) { this.room.cancel(this.timer); this.endsAt = this.room.now() + 1500; this.timer = this.room.after(1500, () => this.finish()); }
    return { ok: true };
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
    this.timer = this.room.after(ms, () => this.afterIntro());
  }
  skip() { if (this.step === 'facts') this.intros(); else if (this.step === 'intros') this.afterIntro(); else this.finish(); return { ok: true }; }
  finish() {
    if (this.step === 'done') return;
    this.step = 'done'; this.room.cancel(this.timer); this.room.cancel(this.minTimer);
    if (this.preview) { if (this.onDone) this.onDone(); return; }
    this.room.beginGame();
  }
  stop() { this.step = 'done'; this.room.cancel(this.timer); this.room.cancel(this.minTimer); }
  // What the running game wants its intro and how-to to know (e.g. YesChef's kitchen): game.showExtra().
  extra() { const g = !this.preview && this.room.game; try { return g && g.showExtra ? g.showExtra() : null; } catch { return null; } }
  card(id) { const p = this.room.get(id); return p ? { id, name: p.name, avatar: p.avatar, color: p.color, bot: !!p.bot, fact: this.facts.get(id) || null } : null; }
  tv() {
    const now = this.room.now(), humans = this.humans();
    return {
      mode: this.mode, step: this.step, game: this.def.key, title: this.def.name, info: this.info, preview: this.preview,
      stepAgo: now - this.stepAt, endsIn: Math.max(0, this.endsAt - now),
      extra: this.extra(),
      ...(this.mode === 'cast' ? { openMs: castOpenMs(this.def), perMs: CAST_PER_MS, outroMs: CAST_OUTRO_MS } : { perMs: PER_MS, outroMs: OUTRO_MS, minMs: FACT_MIN_MS }),
      howMs: howMs(this.def), howStepMs: HOWTO_STEP_MS, howSteps: Math.max(1, Math.min(8, this.def.howSteps || 5)), ready: this.ready.size, readyOf: humans.filter((p) => p.sockets > 0).length,
      submitted: humans.filter((p) => this.facts.has(p.id)).length, of: humans.length,
      waiting: humans.filter((p) => !this.facts.has(p.id) && p.sockets > 0).slice(0, 8).map((p) => p.name),
      featured: this.featured.map((id) => this.card(id)).filter(Boolean),
      others: this.room.list().filter((p) => !this.featured.includes(p.id)).slice(0, 60).map((p) => ({ name: p.name, avatar: p.avatar, color: p.color })),
    };
  }
  view(p) {
    const now = this.room.now(), i = this.featured.indexOf(p.id);
    const per = this.mode === 'cast' ? CAST_PER_MS : PER_MS, open = this.mode === 'cast' ? castOpenMs(this.def) : 0;
    return { mode: this.mode, step: this.step, title: this.def.name, info: this.info, myFact: this.facts.get(p.id) || null, endsIn: Math.max(0, this.endsAt - now), submitted: this.facts.size, of: this.room.list().length,
      // When it's your turn to be introduced, your phone lights up.
      introIn: i >= 0 && this.step === 'intros' ? open + i * per - (now - this.stepAt) : null, perMs: per, featured: i >= 0,
      game: this.def.key, extra: this.extra(), stepAgo: now - this.stepAt, howStepMs: HOWTO_STEP_MS, howSteps: Math.max(1, Math.min(8, this.def.howSteps || 5)), gotIt: this.ready.has(p.id) };
  }
}

module.exports = { castOpenMs, CARD_MS, HOWTO_STEP_MS, HOWTO_END_MS, HOWTO_MIN_MS, howMs, CAST_FIELD, CAST_OPEN_MS, CAST_PER_MS, CAST_OUTRO_MS, CAST_MAX, Show, SHOW_FIELD, FACT_MS, FACT_MIN_MS, PER_MS, OUTRO_MS, MAX_FEATURED, BOT_FACTS };
