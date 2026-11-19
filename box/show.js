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
// Narration: the times above are minimums. Every shot, roll call, outro and how-to step that the
// narrator speaks in lasts at least its voice clip + a margin (box/narration.js reads the intro
// files and the clip manifest), so no line is cut off by the next one or by the game starting.
const NARR = require('./narration');
const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
// The whole cast-mode intro (opening + roll call + outro) for `n` featured players, `more` others.
function castPlan(def, n, more) {
  return safe(() => NARR.cast(def, n, more, { perMs: CAST_PER_MS, outroMs: CAST_OUTRO_MS, openMs: castOpenMs(def) }), null)
    || { openShots: null, openMs: castOpenMs(def), perMs: CAST_PER_MS, rollMs: n * CAST_PER_MS, moreAt: null, outroMs: CAST_OUTRO_MS, total: castOpenMs(def) + n * CAST_PER_MS + CAST_OUTRO_MS };
}
const castMs = (def, players) => { const n = Math.min(CAST_MAX, players); return castPlan(def, n, Math.max(0, players - n)).total; };
// The how-to steps: per-step ms (each at least its line) + the closing card.
function howPlan(def) {
  const p = safe(() => NARR.howto(def), null);
  if (p) return { steps: p.steps, lines: p.lines, endMs: p.endMs, total: p.total };
  const n = Math.max(1, Math.min(8, def.howSteps || 5));
  return { steps: null, lines: null, endMs: HOWTO_END_MS, total: n * HOWTO_STEP_MS + HOWTO_END_MS, n };
}

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
    this.plan = null; this.how = null; this.slots = null; this.minMs = FACT_MIN_MS; this.factPlan = null;
  }
  humans() { return this.room.list().filter((p) => !p.bot); }
  begin() {
    if (this.mode === 'card') return this.titleCard();
    if (this.mode === 'cast') return this.cast();
    // The opening shots + the joke play out before the phones' step can end.
    this.factPlan = safe(() => NARR.facts(this.def, { minMs: FACT_MIN_MS, outroMs: OUTRO_MS }), null);
    if (this.factPlan) this.minMs = this.factPlan.minMs;
    const maxMs = Math.max(FACT_MS, this.minMs + 5000);
    this.endsAt = this.stepAt + maxMs;
    this.timer = this.room.after(maxMs, () => this.intros());
    this.minTimer = this.room.after(this.minMs, () => this.check());
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
    this.plan = castPlan(this.def, this.featured.length, Math.max(0, people.length - this.featured.length));
    const ms = this.plan.total;
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
    this.how = howPlan(this.def);
    const ms = this.how.total;
    this.endsAt = this.stepAt + ms;
    this.room.fx('howto');
    this.timer = this.room.after(ms, () => this.finish());
  }
  // When the line of the how-to step showing at `at` (ms into the how-to) has been spoken.
  howLineEnd(at) {
    const H = this.how; if (!H || !H.steps) return 0;
    let t = 0;
    for (let i = 0; i < H.steps.length; i++) { if (at < t + H.steps[i]) return t + (H.lines[i] || 0) + 300; t += H.steps[i]; }
    return 0; // on the closing card
  }
  // A player tapped "Got it": once everyone has, the game starts after a short beat, once the
  // narrator has finished the step on screen (never mid-sentence).
  gotit(p) {
    if (this.step !== 'howto') return { ok: false, error: 'Watch the big screen!' };
    this.ready.add(p.id);
    const waiting = this.humans().filter((q) => q.sockets > 0 && !this.ready.has(q.id));
    const at = this.room.now() - this.stepAt;
    if (!waiting.length && at >= HOWTO_MIN_MS) {
      const wait = Math.max(1500, this.howLineEnd(at) - at);
      if (this.stepAt + at + wait < this.endsAt) { this.room.cancel(this.timer); this.endsAt = this.room.now() + wait; this.timer = this.room.after(wait, () => this.finish()); }
    }
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
    if (this.step !== 'facts' || this.room.now() - this.stepAt < this.minMs) return;
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
    // One reveal per contestant, each long enough for the host's line about them (names and fun
    // facts are spoken live, so the length is estimated from the words), then the outro.
    this.slots = this.featured.map((id) => { const c = this.card(id); return safe(() => NARR.reveal(`Give it up for ${c.name}! ${c.name} says: ${c.fact || 'a person of mystery'}!`, PER_MS), PER_MS); });
    const fp = this.factPlan, others = Math.max(0, people.length - this.featured.length);
    this.wallMs = others && fp ? fp.othersMs : others ? 2600 : 0;
    this.outroMs = fp ? this.wallMs + fp.playMs : OUTRO_MS;
    const ms = this.slots.reduce((a, x) => a + x, 0) + this.outroMs;
    this.endsAt = this.stepAt + ms;
    this.room.fx('showIntros');
    this.timer = this.room.after(ms, () => this.afterIntro());
  }
  // The host's Skip: the TV cuts the narrator short too (fx 'voiceCut').
  skip() { this.room.fx('voiceCut'); if (this.step === 'facts') this.intros(); else if (this.step === 'intros') this.afterIntro(); else this.finish(); return { ok: true }; }
  // ms into the 'intros' step when featured contestant i is introduced.
  slotAt(i) {
    if (this.mode === 'cast') return (this.plan ? this.plan.openMs : CAST_OPEN_MS) + i * CAST_PER_MS;
    if (!this.slots) return i * PER_MS;
    let t = 0; for (let k = 0; k < i && k < this.slots.length; k++) t += this.slots[k]; return t;
  }
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
      ...(this.mode === 'cast'
        ? { openMs: this.plan ? this.plan.openMs : CAST_OPEN_MS, perMs: CAST_PER_MS, outroMs: this.plan ? this.plan.outroMs : CAST_OUTRO_MS, openShots: this.plan ? this.plan.openShots : null, rollMs: this.plan ? this.plan.rollMs : null, moreAt: this.plan ? this.plan.moreAt : null }
        : { perMs: PER_MS, outroMs: this.outroMs || OUTRO_MS, minMs: this.minMs, openShots: this.factPlan ? this.factPlan.openShots : null, slots: this.slots, wallMs: this.wallMs == null ? null : this.wallMs }),
      ...this.howState(), ready: this.ready.size, readyOf: humans.filter((p) => p.sockets > 0).length,
      submitted: humans.filter((p) => this.facts.has(p.id)).length, of: humans.length,
      waiting: humans.filter((p) => !this.facts.has(p.id) && p.sockets > 0).slice(0, 8).map((p) => p.name),
      featured: this.featured.map((id) => this.card(id)).filter(Boolean),
      others: this.room.list().filter((p) => !this.featured.includes(p.id)).slice(0, 60).map((p) => ({ name: p.name, avatar: p.avatar, color: p.color })),
    };
  }
  // The how-to timing for the TV and phones: howStepsMs (per step) when the narration sets it.
  howState() {
    const H = this.how;
    const n = Math.max(1, Math.min(8, this.def.howSteps || 5));
    return { howMs: H ? H.total : howMs(this.def), howStepMs: HOWTO_STEP_MS, howSteps: H && H.steps ? H.steps.length : n, howStepsMs: H && H.steps ? H.steps : null, howEndMs: H ? H.endMs : HOWTO_END_MS };
  }
  view(p) {
    const now = this.room.now(), i = this.featured.indexOf(p.id);
    const per = this.mode === 'cast' ? CAST_PER_MS : PER_MS;
    return { mode: this.mode, step: this.step, title: this.def.name, info: this.info, myFact: this.facts.get(p.id) || null, endsIn: Math.max(0, this.endsAt - now), submitted: this.facts.size, of: this.room.list().length,
      // When it's your turn to be introduced, your phone lights up.
      introIn: i >= 0 && this.step === 'intros' ? this.slotAt(i) - (now - this.stepAt) : null, perMs: per, featured: i >= 0,
      game: this.def.key, extra: this.extra(), stepAgo: now - this.stepAt, ...this.howState(), gotIt: this.ready.has(p.id) };
  }
}

module.exports = { castOpenMs, CARD_MS, HOWTO_STEP_MS, HOWTO_END_MS, HOWTO_MIN_MS, howMs, castPlan, castMs, howPlan, CAST_FIELD, CAST_OPEN_MS, CAST_PER_MS, CAST_OUTRO_MS, CAST_MAX, Show, SHOW_FIELD, FACT_MS, FACT_MIN_MS, PER_MS, OUTRO_MS, MAX_FEATURED, BOT_FACTS };
