'use strict';
// Zombie Survival: a story that plays out over six days of a (cartoony) zombie outbreak.
// Every scene is a scenario with 3–5 options ("the medkit, the pistol or the rope?", "hold the
// door or run out the back?"). Everyone picks on their phone; then the TV acts out what
// happened to each group, and who made it, who got bitten and who fell.
//
// How fates are decided: by your choices, not by dice. (The data format is documented at the
// top of box/games/zombie-story.js.)
//   Your result in a scene = f(the option you picked, what you carry, your condition, the story
//   flags you earned earlier). Two people with the same history who pick the same option
//   always share the same fate, and the TV says why: "Ana clicked on a flashlight…", "Ben had
//   no light…", "Because Cy left Hank's shutter open on day one, the horde followed…".
//   Results step from safe → hurt → bitten → dead:
//     default = the option's danger for this difficulty, one step worse if you froze,
//               ± the group (the door held / nobody covered) ± the crowd ± the option's twist
//     an item you carry (`help`) caps it ("with a rope you do no worse than safe"); it gets used
//     story `shift` rules move it a step; a matching `result` rule decides it outright
//   The only luck is one twist per OPTION per scene, seeded once for the room (so everyone who
//   picked it shares it): sometimes an option goes a step better or worse than it looked.
//   Ghosts nudge one step at the edges: a blessing turns hurt into safe; two curses (more curses
//   than blessings by two) turn safe into hurt.
//   Hurt twice = you fall (unless a medkit patches you). Bitten = you turn at the end of the
//   NEXT scene unless you have a medkit by then (a friend can give you one!) or took the vaccine.
//   On the last night a fresh bite needs a medkit right away.
// Difficulty: Forgiving (safer defaults, everyone starts with a medkit, the story never wipes
// everyone out before the last night), Normal (that mercy too), Brutal (no mercy: most dangerous
// options need the right item or flag, and many people die).
// The dead become ghosts: each scene they bless 🍀 or curse 🕯️ a survivor and score if they
// called it. Points: +100 per scene survived, +150 per new day reached, +40 when an item or an
// earlier choice saved you (and +40 to the friend who gave you that item), +500 for the rescue,
// hero / helper bonuses, ghost points. results() ranks survivors first, then how far each got.
// With 1–3 players, AI survivors join the group.
const STORY = require('./zombie-story');
const GEARS = require('../../public/shared/gear'); // JustGold gear: each survivor's bandana
const { ITEMS, FLAGS, CHAPTERS, SCENARIOS } = STORY;

const TIERS = ['safe', 'hurt', 'bitten', 'dead'];
const TI = { safe: 0, hurt: 1, bitten: 2, dead: 3 };
const DEFAULT = { forgiving: [0, 0, 1, 1], normal: [0, 0, 1, 2], brutal: [0, 0, 2, 3] };
const RISKY = [0.5, 2, 1, 1]; // a 'risky' option is the one most likely to go worse than it looked
const TWIST = { forgiving: [0.2, 0.05], normal: [0.12, 0.12], brutal: [0.06, 0.14] }; // [a step better, a step worse]
const clampT = (t) => Math.max(0, Math.min(3, t));

// ---- the story, prepared: rule hints, and which chapter first hands out each flag ----
function atoms(c, out = { has: new Set(), flag: new Set() }, neg = false) {
  if (!c || typeof c !== 'object') return out;
  if (c.has && !neg) out.has.add(c.has);
  if (c.flag && !neg) out.flag.add(c.flag);
  if (c.not) atoms(c.not, out, !neg);
  for (const x of [].concat(c.all || [], c.any || [])) atoms(x, out, neg);
  return out;
}
function allFlags(c, out = new Set()) {
  if (!c || typeof c !== 'object') return out;
  if (c.flag) out.add(c.flag);
  if (c.not) allFlags(c.not, out);
  for (const x of [].concat(c.all || [], c.any || [])) allFlags(x, out);
  return out;
}
const CH_IDX = new Map(CHAPTERS.map((c, i) => [c.key, i]));
function prepare(t) {
  for (const s of t.SCENARIOS) {
    const refs = new Set();
    for (const o of s.options) {
      o.outcomes = o.outcomes || [];
      const items = new Set(Object.keys(o.help || {})), flags = new Set();
      for (const r of o.outcomes) {
        for (const f of allFlags(r.if)) refs.add(f);
        const good = r.result ? TI[r.result] < DEFAULT.normal[o.danger] : r.shift < 0;
        if (good) { const a = atoms(r.if); a.has.forEach((k) => items.add(k)); a.flag.forEach((f) => flags.add(f)); }
      }
      o.hintItems = [...items]; o.hintFlags = [...flags];
    }
    s.refs = [...refs];
  }
  // the first chapter that can hand out each flag
  const from = new Map();
  for (const s of t.SCENARIOS) {
    const ci = CH_IDX.has(s.ch) ? CH_IDX.get(s.ch) : null; if (ci == null) continue;
    for (const o of s.options) for (const f of [o.setFlag, o.badFlag, ...o.outcomes.map((r) => r.setFlag)]) if (f && (!from.has(f) || from.get(f) > ci)) from.set(f, ci);
  }
  for (const s of t.SCENARIOS) {
    const ci = CH_IDX.get(s.ch);
    s.callback = !!s.final || (ci != null && s.refs.some((f) => from.has(f) && from.get(f) < ci));
  }
  return t;
}
// Two tellings of the same story: the normal one and the gentler Family one (room.family).
const TOLD = [false, true].map((fam) => { const t = prepare(STORY.story(fam)); return { ...t, SC: new Map(t.SCENARIOS.map((x) => [x.id, x])), CH: new Map(t.CHAPTERS.map((c) => [c.key, c])) }; });

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'length', label: 'Story length', options: opt([['short', 'Short (~12 min)'], ['normal', 'Normal (~20 min)'], ['long', 'Long (~25 min)']]) },
  { key: 'difficulty', label: 'Difficulty', options: opt([['forgiving', 'Forgiving'], ['normal', 'Normal'], ['brutal', 'Brutal: many won’t make it']]) },
  { key: 'timer', label: 'Time to choose', options: opt([[20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds']]) },
  { key: 'ghosts', label: 'Ghosts', options: opt([[true, 'On: the dead haunt the living'], [false, 'Off: the dead just watch']]) },
  { key: 'narrator', label: 'Narrator voice', options: opt([[true, 'On'], [false, 'Off: subtitles only']]) },
];
const defaults = { length: 'normal', difficulty: 'normal', timer: 30, ghosts: true, narrator: true };

const PER_CHAPTER = { short: 2, normal: 3, long: 4 };
const RESCUE_PRE = { short: 0, normal: 1, long: 1 };
const CHAPTER_MS = 8000, READ_MS = 4000, BOARD_MS = 5500, ALLIN_MS = 3500;
// Outcome beats (ms): see buildOutcome.
const RECAP_BASE = 3600, RECAP_PER = 900, RECAP_MAX = 8000, ACT_MS = 2400, CONSEQ_MS = 1500, TAIL_MS = 1800;
const FEV_IN = 1800, FEV_PER = 900, TALLY_MS = 6000, FINAL_MS = 5000, MIN_OUT = 14000;
const perOf = (n) => (n <= 4 ? 1000 : Math.max(250, Math.round(4000 / n))); // one verdict stamp at a time
const SURVIVE = 100, DAY = 150, RESCUE = 500, GIFT = 20, SAVE = 30, SAVED = 40, BLESS = 30, CURSE = 50;
const CAP = 4; // backpack slots
const MIN_GROUP = 4; // fewer players than this: AI survivors join
const SHOW = 16; // people per group acted out on the TV (the rest are counted)
const NPCS = [['Granny Mae', '👵'], ['Coach Duffy', '🧔'], ['Chef Rosa', '👩‍🍳'], ['Dusty', '🤠'], ['Nurse Ivy', '👩‍⚕️'], ['Skater Leo', '🛹']];
const NPC_COLORS = ['#c9a36b', '#8fb3a0', '#d98a6c', '#a3a0d9'];
const newStats = () => ({ survived: 0, found: 0, gifts: 0, saves: 0, hero: 0, heroPts: 0, ghostPts: 0, haunts: 0, close: 0, shots: 0, lucky: 0, savedBy: 0, days: 1 });

class Zombie {
  constructor(room, settings) {
    this.room = room; this.s = { ...defaults, ...settings };
    if (!DEFAULT[this.s.difficulty]) this.s.difficulty = 'normal';
    this.family = !!(room && room.family); this.T = TOLD[this.family ? 1 : 0]; // the story as told in this room
    this.phase = 'chapter'; this.ppl = new Map(); this.plan = []; this.idx = -1; this.r = null;
    this.timer = null; this.endsAt = 0; this.chapter = null; this.history = []; this.epilogue = null; this.npcN = 0;
  }
  rng() { return this.room.rng(); }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }

  // ---- the cast ----
  fresh(extra) {
    const x = { alive: true, status: 'ok', bittenAt: 0, hurtAt: 0, items: [], flags: new Set(), gifted: {}, pts: 0, diedAt: 0, diedHow: '', diedDay: 0, diedPlace: '', joinedAt: Math.max(1, this.idx + 2), st: newStats(), ...extra };
    if (this.s.difficulty === 'forgiving') x.items.push({ k: 'medkit', n: 1 }); // medkits are plentiful
    return x;
  }
  seat(p) {
    if (this.ppl.has(p.id)) return;
    this.ppl.set(p.id, this.fresh({ id: p.id, npc: false }));
  }
  addNpc() {
    const [name, avatar] = NPCS[this.npcN % NPCS.length], id = 'npc' + (++this.npcN);
    this.ppl.set(id, this.fresh({ id, npc: true, name, avatar, color: NPC_COLORS[this.npcN % NPC_COLORS.length], joinedAt: 1 }));
  }
  here(x) { return !!x && (x.npc || !!this.room.get(x.id)); }
  pub(x) {
    if (x.npc) return { id: x.id, name: x.name, avatar: x.avatar, color: x.color, npc: true };
    const p = this.room.get(x.id);
    // gear: the player's bandana, drawn on their survivor on the TV and shown on their phone.
    return p ? { id: x.id, name: p.name, avatar: p.avatar || '🙂', color: p.color, bot: !!p.bot, gear: GEARS.gearSet(p, 'zombie') } : { id: x.id, name: '—', avatar: '🙂', color: '#888' };
  }
  name(x) { return x.npc ? x.name : this.room.name(x.id); }
  isBot(x) { if (x.npc) return true; const p = this.room.get(x.id); return !!(p && p.bot); }
  start() {
    for (const p of this.room.list()) this.seat(p);
    while (this.ppl.size < MIN_GROUP) this.addNpc();
    this.buildPlan();
    this.nextScene();
  }
  joined(p) { if (this.phase !== 'over') this.seat(p); } // a new survivor stumbles in from the next scene
  left(p) {
    const r = this.r;
    if (r && this.phase === 'choose') { r.picks.delete(p.id); r.haunts.delete(p.id); this.maybeAllIn(); }
  }

  // ---- the story: one chapter per day, scenes drawn from each chapter's pool ----
  buildPlan() {
    const per = PER_CHAPTER[this.s.length] || 3, pre = RESCUE_PRE[this.s.length] == null ? 1 : RESCUE_PRE[this.s.length];
    const anyPool = this.shuffle(this.T.SCENARIOS.filter((s) => s.ch === 'any'));
    for (const c of this.T.CHAPTERS) {
      if (c.key === 'rescue') {
        const pool = this.shuffle(this.T.SCENARIOS.filter((s) => s.ch === 'rescue' && !s.final));
        for (const s of pool.slice(0, pre)) this.plan.push({ id: s.id, ch: c.key });
        const fin = this.shuffle(this.T.SCENARIOS.filter((s) => s.final))[0];
        this.plan.push({ id: fin.id, ch: c.key });
        continue;
      }
      const pool = this.shuffle(this.T.SCENARIOS.filter((s) => s.ch === c.key && !s.first));
      const first = c.key === 'outbreak' ? this.T.SCENARIOS.filter((s) => s.first).sort((a, b) => a.first - b.first) : [];
      const list = [...first];
      // From three scenes a chapter, one of them may be a wildcard (night watch, the fog…).
      const wild = per >= 3 && anyPool.length && this.rng() < 0.6 ? 1 : 0;
      while (list.length < per - wild && pool.length) list.push(pool.shift());
      // From day two on, every day has at least one scene that remembers an earlier day.
      if (c.day > 1 && !list.some((s) => s.callback)) {
        const cb = pool.find((s) => s.callback);
        if (cb) list[list.length - 1] = cb;
      }
      if (wild) list.splice(Math.max(1, first.length) + Math.floor(this.rng() * (list.length - Math.max(1, first.length) + 1)), 0, anyPool.shift());
      for (const s of list.slice(0, Math.max(per, first.length))) this.plan.push({ id: s.id, ch: c.key });
    }
  }
  sceneOf(i = this.idx) { const p = this.plan[i]; return p ? this.T.SC.get(p.id) : null; }
  living() { return [...this.ppl.values()].filter((x) => x.alive && this.here(x)); }
  livingPlayers() { return this.living().filter((x) => !x.npc); }

  nextScene() {
    if (this.phase === 'over') return;
    if (this.idx >= 0 && !this.livingPlayers().length) return this.finish();
    this.idx++;
    if (this.idx >= this.plan.length) return this.finish();
    const ch = this.T.CH.get(this.plan[this.idx].ch);
    this.r = null;
    if (!this.chapter || this.chapter.key !== ch.key) {
      // a new day: everyone still standing earns the day
      if (this.chapter) for (const x of this.living()) { x.st.days = ch.day; this.score(x, DAY); }
      this.chapter = ch; this.phase = 'chapter';
      this.room.fx('chapter', { day: ch.day });
      this.setTimer(CHAPTER_MS, () => this.openChoose());
      return;
    }
    this.openChoose();
  }
  openChoose() {
    if (this.phase === 'over') return;
    const sc = this.sceneOf();
    const ids = this.living().map((x) => x.id);
    // One twist per option for the whole room (hidden until the outcome), and the option
    // anybody who freezes ends up doing.
    const [better, worse] = TWIST[this.s.difficulty] || TWIST.normal, twist = new Map();
    for (const o of sc.options) { const y = this.rng(), w = worse * RISKY[o.danger]; twist.set(o.k, y < better ? -1 : y < better + w ? 1 : 0); }
    const panic = Math.floor(this.rng() * sc.options.length);
    this.r = { n: this.idx + 1, sc, ids, picks: new Map(), froze: new Set(), gifts: new Map(), haunts: new Map(), outcome: null, fates: new Map(), twist, panic };
    this.phase = 'choose';
    this.room.fx('scene', { n: this.r.n });
    const ms = this.s.timer * 1000 + READ_MS;
    this.setTimer(ms, () => this.close());
    const n = this.r.n, span = Math.max(2500, ms * 0.55);
    for (const x of this.ppl.values()) {
      if (!this.here(x) || !this.isBot(x)) continue;
      if (x.alive) this.room.after(1800 + this.rng() * span, () => this.botMove(x, n));
      else if (!x.npc && this.s.ghosts) this.room.after(2500 + this.rng() * span, () => this.botHaunt(x, n));
    }
  }

  // ---- items and flags ----
  has(x, k) { return x.items.some((i) => i.k === k); }
  itemCount(x, k) { const i = x.items.find((y) => y.k === k); return i ? (i.n == null ? 1 : i.n) : 0; }
  addItem(x, k) {
    const I = this.T.ITEMS[k]; if (!I) return null;
    const cur = x.items.find((i) => i.k === k);
    if (cur) { if (I.uses) cur.n = Math.min(I.uses * 3, (cur.n || 0) + (k === 'gun' ? 2 : I.uses)); return { got: k, dropped: null }; }
    let dropped = null;
    if (x.items.length >= CAP) { const d = x.items.findIndex((i) => i.k !== 'medkit'); dropped = x.items.splice(d >= 0 ? d : 0, 1)[0].k; }
    x.items.push({ k, n: I.uses || null });
    return { got: k, dropped };
  }
  useItem(x, k) {
    const i = x.items.findIndex((y) => y.k === k); if (i < 0) return false;
    const it = x.items[i];
    if (it.n != null) { it.n--; if (it.n <= 0) x.items.splice(i, 1); }
    return true;
  }
  locked(x, o) { return !!(o.need && !this.has(x, o.need)); }
  test(x, c) {
    if (!c || typeof c !== 'object') return true;
    if (c.has) return this.has(x, c.has);
    if (c.flag) return x.flags.has(c.flag);
    if (c.not) return !this.test(x, c.not);
    if (c.all) return c.all.every((y) => this.test(x, y));
    if (c.any) return c.any.some((y) => this.test(x, y));
    if (c.hurt != null) return (x.status === 'hurt') === !!c.hurt;
    if (c.bitten != null) return (x.status === 'bitten') === !!c.bitten;
    return false;
  }
  ruleIcon(r) {
    const a = atoms(r.if), k = [...a.has][0], f = [...a.flag][0], nf = [...allFlags(r.if)][0];
    if (r.icon) return r.icon;
    if (k) return this.T.ITEMS[k].icon;
    if (f) return this.T.FLAGS[f].icon;
    if (r.if && r.if.not && r.if.not.has) return this.T.ITEMS[r.if.not.has].icon;
    if (nf) return this.T.FLAGS[nf].icon;
    return '⚠️';
  }
  // A rule matched only the people it was written for.
  goodRule(o, r) { return r.result ? TI[r.result] < DEFAULT.normal[o.danger] : r.shift < 0; }

  // ---- the verdict for one person: pure (it changes nothing) ----
  // env: { shift (group + crowd), twist, froze, haunt (blesses − curses) }
  judge(x, o, env = {}) {
    const D = DEFAULT[this.s.difficulty] || DEFAULT.normal;
    const base = clampT(D[o.danger] + (env.shift || 0) + (env.twist || 0) + (env.froze ? 1 : 0));
    const v = { base, tier: base, rule: null, used: null, help: null, reasons: [], saved: false, doomed: false };
    // 1) a story verdict decides it outright (the first one that matches)
    for (const r of o.outcomes) {
      if (!r.result || !this.test(x, r.if)) continue;
      v.rule = r; v.tier = TI[r.result];
      if (r.use && this.has(x, r.use)) v.used = r.use;
      v.reasons.push({ icon: this.ruleIcon(r), line: r.line, good: v.tier < base, bad: v.tier > base });
      v.saved = v.tier < base; v.doomed = v.tier > base;
      return this.haunted(v, x, env);
    }
    // 2) the best item you carry caps how badly it can go
    if (o.help) for (const [k, cap] of Object.entries(o.help)) if (this.has(x, k) && TI[cap] < v.tier) { v.tier = TI[cap]; v.help = k; }
    if (v.help) { v.used = this.T.ITEMS[v.help].uses ? v.help : null; v.saved = true; }
    // 3) things you did earlier push it a step either way (they stack)
    for (const r of o.outcomes) {
      if (r.result || !r.shift || !this.test(x, r.if)) continue;
      v.tier = clampT(v.tier + r.shift);
      v.reasons.push({ icon: this.ruleIcon(r), line: r.line, good: r.shift < 0, bad: r.shift > 0 });
      if (r.shift > 0) v.doomed = true; else v.saved = true;
    }
    if (v.help) v.reasons.unshift({ icon: this.T.ITEMS[v.help].icon, item: v.help, good: true });
    // 4) or just a reason worth telling
    if (!v.reasons.length) for (const r of o.outcomes) if (!r.result && !r.shift && r.line && this.test(x, r.if)) { v.reasons.push({ icon: this.ruleIcon(r), line: r.line, note: true }); break; }
    if (v.saved && v.tier >= base) v.saved = false;
    return this.haunted(v, x, env);
  }
  haunted(v, x, env) {
    const h = env.haunt || 0;
    if (h > 0 && v.tier === 1) { v.tier = 0; v.ghost = 'bless'; }
    else if (h <= -2 && v.tier === 0 && x.status !== 'hurt') { v.tier = 1; v.ghost = 'curse'; }
    return v;
  }

  // ---- phone moves ----
  act(p, m) {
    const x = this.ppl.get(p.id), r = this.r;
    if (!x) return { ok: false, error: 'You’ll join the story at the next scene!' };
    if (!m || (m.op !== 'choose' && m.op !== 'give' && m.op !== 'haunt')) return { ok: false, error: 'Unknown move.' };
    if (this.phase !== 'choose' || !r) return { ok: false, error: 'Not now. Watch the big screen!' };
    if (m.op === 'haunt') {
      if (!this.s.ghosts) return { ok: false, error: 'Ghosts are switched off this game.' };
      if (x.alive) return { ok: false, error: 'You’re still alive! Ghosts only.' };
      if (m.mode !== 'bless' && m.mode !== 'curse') return { ok: false, error: 'Bless or curse?' };
      const t = typeof m.to === 'string' ? this.ppl.get(m.to) : null;
      if (!t || !t.alive || !r.ids.includes(t.id) || !this.here(t)) return { ok: false, error: 'Pick a survivor who is still in this scene.' };
      r.haunts.set(x.id, { to: t.id, mode: m.mode });
      this.maybeAllIn();
      return { ok: true };
    }
    if (!x.alive) return { ok: false, error: 'You’re a ghost now 👻' };
    if (!r.ids.includes(x.id)) return { ok: false, error: 'You’ll join the story at the next scene!' };
    if (m.op === 'choose') {
      const o = typeof m.k === 'string' ? r.sc.options.find((y) => y.k === m.k) : null;
      if (!o) return { ok: false, error: 'Pick one of the options.' };
      if (this.locked(x, o)) return { ok: false, error: `You need ${this.T.ITEMS[o.need].icon} ${this.T.ITEMS[o.need].name.toLowerCase()} for that.` };
      r.picks.set(x.id, o.k);
      this.maybeAllIn();
      return { ok: true };
    }
    // give one item to another survivor
    if (r.gifts.has(x.id)) return { ok: false, error: 'You already gave something this scene.' };
    if (typeof m.item !== 'string' || !Object.prototype.hasOwnProperty.call(this.T.ITEMS, m.item) || !this.has(x, m.item)) return { ok: false, error: 'You don’t have that.' };
    const t = typeof m.to === 'string' ? this.ppl.get(m.to) : null;
    if (!t || t === x || !t.alive || !this.here(t)) return { ok: false, error: 'Pick a survivor to give it to.' };
    if (this.has(t, m.item) && !this.T.ITEMS[m.item].uses) return { ok: false, error: 'They already have one.' };
    if (!this.has(t, m.item) && t.items.length >= CAP) return { ok: false, error: 'Their backpack is full.' };
    return { ok: true, ...this.give(x, t, m.item) };
  }
  give(x, t, k) {
    const it = x.items.find((i) => i.k === k), whole = k === 'gun' || k === 'bat';
    if (whole || it.n == null || it.n <= 1) x.items.splice(x.items.indexOf(it), 1); else it.n--;
    const cur = t.items.find((i) => i.k === k);
    if (cur) { if (cur.n != null) cur.n += whole ? it.n : 1; } else t.items.push({ k, n: whole ? it.n : this.T.ITEMS[k].uses ? 1 : null });
    t.gifted[k] = x.id; // if it saves them later, the giver scores too
    this.r.gifts.set(x.id, { to: t.id, item: k });
    let pts = GIFT; x.st.gifts++;
    const saving = k === 'medkit' && t.status === 'bitten';
    if (saving) { pts += SAVE; x.st.saves++; }
    this.score(x, pts);
    this.room.fx('gift', { id: x.id, to: t.id, item: k, save: saving });
    return { saving };
  }
  maybeAllIn() {
    const r = this.r; if (this.phase !== 'choose' || !r) return;
    const waiting = r.ids.some((id) => { const x = this.ppl.get(id); return x && x.alive && !x.npc && this.here(x) && !r.picks.has(id); });
    if (waiting) return;
    const ghostsLeft = this.s.ghosts && [...this.ppl.values()].some((x) => !x.alive && !x.npc && this.here(x) && !r.haunts.has(x.id) && !this.isBot(x));
    const ms = ghostsLeft ? ALLIN_MS : 1200;
    if (this.endsAt - this.room.now() > ms) { this.room.fx('allin'); this.setTimer(ms, () => this.close()); }
  }

  // ---- AI survivors and bots ----
  // They judge each option the way the story would for them (without knowing the twists or
  // what the others will do), prefer what their gear and past help with, and are sometimes rash.
  pickFor(x) {
    const opts = this.r.sc.options.filter((o) => !this.locked(x, o));
    if (this.rng() < 0.15) return opts[Math.floor(this.rng() * opts.length)];
    let best = null, bs = Infinity;
    for (const o of opts) {
      const v = this.judge(x, o);
      let s = v.tier * 10 + this.rng() * 4;
      if (v.saved) s -= 2;
      if (o.gain) s -= 3;
      if (o.setFlag && !(this.T.FLAGS[o.setFlag] || {}).bad && !x.flags.has(o.setFlag)) s -= 3;
      if (o.hero) s -= 1;
      if (o.role === 'cover' || o.role === 'hold') s -= 4; // team players
      if (o.heal && (x.status === 'hurt' || x.flags.has('injured_leg'))) s -= 6;
      if (o.cure && x.status === 'bitten' && !this.has(x, 'medkit')) s -= 25;
      if (s < bs) { bs = s; best = o; }
    }
    return best || opts[0];
  }
  botMove(x, n) {
    const r = this.r;
    if (this.phase !== 'choose' || !r || r.n !== n || !x.alive || !this.here(x) || !r.ids.includes(x.id)) return;
    if (!r.picks.has(x.id)) r.picks.set(x.id, this.pickFor(x).k);
    // Hand a spare medkit to a bitten friend.
    if (!r.gifts.has(x.id) && this.has(x, 'medkit')) {
      const sick = this.living().filter((t) => t !== x && t.status === 'bitten' && !this.has(t, 'medkit'));
      const spare = this.itemCount(x, 'medkit') > 1 || x.status === 'ok';
      if (sick.length && spare && this.rng() < 0.55) this.give(x, sick[Math.floor(this.rng() * sick.length)], 'medkit');
    }
    this.maybeAllIn();
  }
  botHaunt(x, n) {
    const r = this.r;
    if (this.phase !== 'choose' || !r || r.n !== n || x.alive || !this.here(x) || r.haunts.has(x.id) || this.rng() < 0.2) return;
    const t = r.ids.map((id) => this.ppl.get(id)).filter((y) => y && y.alive && this.here(y));
    if (!t.length) return;
    r.haunts.set(x.id, { to: t[Math.floor(this.rng() * t.length)].id, mode: this.rng() < 0.55 ? 'curse' : 'bless' });
    this.maybeAllIn();
  }

  // ---- what happened ----
  score(x, pts) { if (!x.npc) x.pts += pts; }
  close() {
    if (this.phase !== 'choose' || !this.r) return;
    this.resolve();
    this.phase = 'outcome';
    this.room.fx('outcome', { n: this.r.n });
    const final = !!this.r.sc.final;
    this.setTimer(this.r.outcome.ms, () => (final || !this.livingPlayers().length ? this.finish() : this.board()));
  }
  board() {
    if (this.phase !== 'outcome') return;
    this.phase = 'board'; this.room.fx('board');
    this.setTimer(BOARD_MS, () => this.nextScene());
  }
  // What the group did: the door, the decoys, the vote, the crowd. Steps per option.
  groupEffects(sc, living, picks) {
    const count = new Map(sc.options.map((o) => [o.k, 0]));
    for (const x of living) count.set(picks.get(x.id), (count.get(picks.get(x.id)) || 0) + 1);
    const total = Math.max(1, living.length), shift = new Map(sc.options.map((o) => [o.k, 0]));
    const G = sc.group; let groupLine = '', groupOk = null, voteWin = null;
    if (G && G.type === 'hold') {
      const holders = sc.options.filter((o) => o.role === 'hold').reduce((a, o) => a + count.get(o.k), 0);
      groupOk = holders >= Math.max(1, Math.ceil(G.need * total));
      for (const o of sc.options) if (o.role === 'hold') shift.set(o.k, groupOk ? 0 : 1); else if (o.role === 'run') shift.set(o.k, groupOk ? -1 : 1);
      groupLine = groupOk ? G.ok : G.bad;
    } else if (G && G.type === 'cover') {
      const cov = sc.options.filter((o) => o.role === 'cover').reduce((a, o) => a + count.get(o.k), 0);
      groupOk = cov > 0;
      for (const o of sc.options) if (o.role !== 'cover') shift.set(o.k, groupOk ? -1 : (G.none || 1));
      groupLine = groupOk ? G.ok : G.bad;
    } else if (G && G.type === 'vote') {
      let top = -1; for (const o of sc.options) if (count.get(o.k) > top) { top = count.get(o.k); voteWin = o.k; }
      groupLine = (G.ok && G.ok[voteWin]) || '';
    }
    for (const o of sc.options) {
      const c = count.get(o.k);
      if (o.crowd > 0 && total >= 3 && c / total > 0.5) shift.set(o.k, shift.get(o.k) + 1);
      else if (o.crowd < 0 && c >= 2 && c / total >= 1 / 3) shift.set(o.k, shift.get(o.k) - 1);
    }
    return { count, shift, groupLine, groupOk, voteWin };
  }
  resolve() {
    const r = this.r, sc = r.sc, n = r.n, final = !!sc.final;
    const living = r.ids.map((id) => this.ppl.get(id)).filter((x) => x && x.alive && this.here(x));
    // Nobody picked in time: AI and bots pick for themselves; people froze (they all end up
    // doing the same panicked thing, one step worse).
    for (const x of living) {
      if (r.picks.has(x.id)) continue;
      if (this.isBot(x)) { r.picks.set(x.id, this.pickFor(x).k); continue; }
      let i = r.panic, o = sc.options[i];
      for (let j = 0; j < sc.options.length && this.locked(x, o); j++) { i = (i + 1) % sc.options.length; o = sc.options[i]; }
      r.picks.set(x.id, o.k); r.froze.add(x.id);
    }
    const { count, shift, groupLine, groupOk, voteWin } = this.groupEffects(sc, living, r.picks);
    const haunt = new Map(); for (const [, h] of r.haunts) haunt.set(h.to, (haunt.get(h.to) || 0) + (h.mode === 'bless' ? 1 : -1));
    // 1) every verdict, worked out before anything changes
    const fates = new Map();
    for (const x of living) {
      const o = sc.options.find((y) => y.k === r.picks.get(x.id));
      const v = this.judge(x, o, { shift: shift.get(o.k), twist: r.twist.get(o.k), froze: r.froze.has(x.id), haunt: haunt.get(x.id) || 0 });
      let fate = TIERS[v.tier], patch = false, twice = false;
      if (fate === 'hurt' && x.status === 'hurt') { if (this.has(x, 'medkit') && v.used !== 'medkit') patch = true; else { fate = 'dead'; twice = true; } }
      if (fate === 'bitten' && x.status === 'bitten') fate = 'dead';
      fates.set(x.id, { x, o, v, fate, patch, twice, used: v.used, got: null, dropped: null, healed: false, cured: false, lucky: false });
    }
    // 2) the bites that come due: earlier ones now, and on the last night fresh ones too
    const medkitLeft = (f) => this.itemCount(f.x, 'medkit') - (f.patch ? 1 : 0) - (f.used === 'medkit' ? 1 : 0) > 0;
    const due = (f) => f.fate !== 'dead' && ((f.x.status === 'bitten' && f.x.bittenAt < n) || (final && (f.fate === 'bitten' || f.x.status === 'bitten'))) && !(f.o.cure && f.fate !== 'bitten');
    const turns = (f) => due(f) && !medkitLeft(f) && !f.x.flags.has('vaccinated');
    // Mercy (Forgiving and Normal): the story never wipes out every player before the last night.
    const players = [...fates.values()].filter((f) => !f.x.npc);
    if (!final && this.s.difficulty !== 'brutal' && players.length && players.every((f) => f.fate === 'dead' || turns(f))) {
      for (const f of players) {
        if (f.fate === 'dead') { f.fate = 'hurt'; f.patch = false; f.twice = false; f.lucky = true; f.x.st.lucky++; }
        else if (turns(f)) f.x.st.lucky++;
        if (turns(f)) f.spare = true;
      }
    }
    // 3) apply: fates, items used, pick-ups, flags, heals and cures
    for (const f of fates.values()) {
      const x = f.x, o = f.o, v = f.v;
      if (f.used) { if (f.used === 'gun') x.st.shots++; this.useItem(x, f.used); }
      if (o.need && this.T.ITEMS[o.need].uses && o.need !== 'medkit') this.useItem(x, o.need);
      if (f.patch) this.useItem(x, 'medkit');
      if (f.fate === 'dead') { this.kill(x, this.howDied(f), n, false, this.diedWhy(f)); continue; }
      const via = v.help || (v.rule && atoms(v.rule.if).has.size ? [...atoms(v.rule.if).has][0] : null);
      if (v.saved) {
        x.st.savedBy++; this.score(x, SAVED);
        const giver = via && x.gifted[via] && this.ppl.get(x.gifted[via]);
        if (giver && giver !== x) { giver.st.saves++; this.score(giver, SAVED); f.thanks = this.name(giver); }
      }
      if (f.fate === 'bitten') { x.status = 'bitten'; x.bittenAt = n; }
      else if (f.fate === 'hurt') { if (x.status !== 'bitten') x.status = 'hurt'; x.hurtAt = n; x.st.close++; }
      if (o.cure && x.status === 'bitten' && x.bittenAt < n && f.fate !== 'bitten') { x.status = 'ok'; f.cured = true; x.st.close++; }
      if (o.heal && f.fate === 'safe') { if (x.status === 'hurt') { x.status = 'ok'; f.healed = true; } if (x.flags.delete('injured_leg')) f.healed = true; }
      // a list: the first thing you don't have yet (so the same history finds the same thing)
      const og = Array.isArray(o.gain) ? (o.gain.find((y) => !this.has(x, y)) || o.gain[0]) : o.gain;
      for (const k of [og, v.rule && v.rule.gain]) if (k) { const g = this.addItem(x, k); if (g) { if (!f.got) { f.got = g.got; f.dropped = g.dropped; } x.st.found++; } }
      for (const fl of [o.setFlag, v.rule && v.rule.setFlag, (f.fate === 'hurt' || f.fate === 'bitten') && o.badFlag]) if (fl && !x.flags.has(fl)) { x.flags.add(fl); (f.flags = f.flags || []).push(fl); }
      if (o.hero) { this.score(x, o.hero); x.st.hero++; x.st.heroPts += o.hero; }
      if (f.fate === 'safe' && x.status === 'hurt' && x.hurtAt <= n - 1) { x.status = 'ok'; f.healed = true; }
    }
    // Vote gift: everyone who backed the winning option and came through gets it.
    if (voteWin && sc.group.gift && sc.group.gift[voteWin]) {
      for (const f of fates.values()) if (f.o.k === voteWin && f.x.alive) { const g = this.addItem(f.x, sc.group.gift[voteWin]); if (g) { if (!f.got) { f.got = g.got; f.dropped = g.dropped; } f.x.st.found++; } }
    }
    // The fever: a medkit cures the bite, then the vaccine; otherwise they turn now.
    const fever = [];
    for (const f of fates.values()) {
      const x = f.x;
      if (!x.alive || x.status !== 'bitten' || (x.bittenAt >= n && !final)) continue;
      if (this.has(x, 'medkit')) { this.useItem(x, 'medkit'); x.status = 'ok'; x.st.close++; fever.push({ f, fate: 'cured', how: '🩹' }); }
      else if (x.flags.has('vaccinated')) { x.flags.delete('vaccinated'); x.status = 'ok'; x.st.close++; x.st.savedBy++; this.score(x, SAVED); fever.push({ f, fate: 'cured', how: '💉' }); }
      else if (f.spare) { x.status = 'ok'; fever.push({ f, fate: 'cured', how: '🍀' }); }
      else { this.kill(x, final ? 'was bitten on the way aboard, and the bite took hold' : 'turned after a bite', n, true); fever.push({ f, fate: 'turned' }); }
    }
    // Points: survivors, the rescue, and the ghosts who called it.
    for (const f of fates.values()) if (f.x.alive) { f.x.st.survived++; this.score(f.x, SURVIVE + (final ? RESCUE : 0)); }
    for (const [gid, h] of r.haunts) {
      const g = this.ppl.get(gid), f = fates.get(h.to); if (!g || !f) continue;
      g.st.haunts++;
      const fell = !f.x.alive || f.fate !== 'safe';
      if (h.mode === 'bless' ? !fell : fell) { const pts = h.mode === 'bless' ? BLESS : CURSE; this.score(g, pts); g.st.ghostPts += pts; h.hit = true; }
    }
    r.fates = fates;
    r.outcome = this.buildOutcome(r, fates, fever, groupLine, groupOk, count);
    this.history.push({ n, id: sc.id, title: sc.title, day: this.chapter.day, fell: r.outcome.tally.fell });
  }
  howDied(f) {
    if (f.v.rule && f.v.doomed) return f.v.rule.line;
    return f.twice ? `${f.o.bad}, hurt for the second time` : f.o.bad;
  }
  diedWhy(f) { const bad = !f.v.rule && f.v.reasons.find((y) => y.bad && y.line); return bad ? this.fill(bad.line, this.name(f.x)) + '.' : ''; }
  kill(x, how, n, turned = false, why = '') {
    x.alive = false; x.status = turned ? 'turned' : 'dead'; x.diedAt = n; x.diedHow = how; x.diedWhy = why;
    x.diedDay = this.chapter ? this.chapter.day : 1; x.diedPlace = this.chapter ? this.chapter.place || this.chapter.name : '';
  }
  names(list) {
    const ns = list.map((f) => this.name(f.x));
    if (ns.length <= 3) return ns.length > 1 ? ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1] : ns[0] || '';
    return `${ns.slice(0, 2).join(', ')} and ${ns.length - 2} others`;
  }
  // "{who}" in a story line stands for the names (or "they").
  fill(line, who) { return line.includes('{who}') ? line.replace(/\{who\}/g, who) : `${who} ${line}`; }
  // One sentence for everybody who did the same thing and met the same fate for the same reasons.
  sentence(fs) {
    const f = fs[0], o = f.o, v = f.v, who = this.names(fs), parts = [];
    for (const y of v.reasons) if (!y.item && !y.note && y.line && y !== (v.rule && v.reasons[0])) parts.push(this.fill(y.line, who) + '.');
    let main;
    if (v.rule) main = `${who} ${v.rule.line}`;
    else {
      const note = v.reasons.find((y) => y.note);
      main = note && f.fate !== 'safe' ? `${who} ${note.line}` : `${who} ${f.fate === 'safe' ? o.ok : o.bad}`;
      if (v.help) { const I = this.T.ITEMS[v.help]; main += `${f.fate === 'safe' ? ', thanks to the' : ', even with the'} ${I.icon} ${I.name.toLowerCase()}`; }
    }
    if (f.patch) main += '. A 🩹 medkit patched up their second injury';
    else if (f.twice) main += '. It was their second injury';
    if (f.lucky && f.fate !== 'dead') main += '. Somehow, they crawled away';
    if (v.ghost) main += v.ghost === 'bless' ? '. A ghostly hand pulled them clear 🍀' : '. A ghostly chill tripped them up 🕯️';
    if (f.thanks) main += ` (a gift from ${f.thanks})`;
    parts.push(main + '.');
    return parts.join(' ');
  }
  sig(f) { return [f.fate, f.v.rule ? f.o.outcomes.indexOf(f.v.rule) : '', f.v.help || '', f.v.reasons.map((y) => y.line || y.item).join('|'), f.patch, f.twice, f.lucky, f.v.ghost || '', f.thanks || ''].join('/'); }
  why(f) {
    const v = f.v, main = v.rule ? v.reasons[0] : v.reasons.find((y) => y.bad) || v.reasons.find((y) => y.good) || v.reasons[0];
    if (!main) return null;
    const who = this.name(f.x);
    const text = main.item ? `${f.fate === 'safe' ? 'saved by the' : 'even with the'} ${this.T.ITEMS[main.item].name.toLowerCase()}` : main.line.includes('{who}') ? this.fill(main.line, who) : main.line;
    return { icon: main.icon, text, good: !!main.good, bad: !!main.bad };
  }
  buildOutcome(r, fates, fever, groupLine, groupOk, count) {
    // The outcome plays in beats, so a first-time viewer can follow who did what:
    //  recap (what everyone chose) → each group in turn: ACT (they do it), CONSEQ (zombies arrive,
    //  the door holds or breaks), then one verdict stamp per person → the bites resolving → a calm tally.
    const sc = r.sc, groups = [];
    const order = { safe: 0, hurt: 1, bitten: 2, dead: 3 };
    for (const o of sc.options) {
      const fs = [...fates.values()].filter((f) => f.o.k === o.k);
      if (!fs.length) continue;
      // people with the same fate for the same reason stand together
      const subs = new Map();
      for (const f of fs) { const k = this.sig(f); if (!subs.has(k)) subs.set(k, []); subs.get(k).push(f); }
      const list = [...subs.values()].sort((a, b) => order[a[0].fate] - order[b[0].fate] || (a[0].x.npc ? 1 : 0) - (b[0].x.npc ? 1 : 0));
      const sorted = list.flat();
      const c = { safe: 0, hurt: 0, bitten: 0, dead: 0 }; for (const f of fs) c[f.fate]++;
      const tw = r.twist.get(o.k) || 0;
      groups.push({ k: o.k, icon: o.icon, label: o.label, anim: o.anim, role: o.role || null, need: o.need ? this.T.ITEMS[o.need].icon : null,
        gain: o.gain ? [].concat(o.gain).map((k) => this.T.ITEMS[k].icon).join('') : '', line: list.map((s) => this.sentence(s)).join(' '), counts: c, total: fs.length,
        twist: tw < 0 ? 'better' : tw > 0 ? 'worse' : null,
        setup: `${this.names(fs)}: ${o.label.charAt(0).toLowerCase() + o.label.slice(1)}`, fs: sorted,
        people: sorted.slice(0, SHOW).map((f, i) => ({ ...this.pub(f.x), fate: f.fate, got: f.got ? this.T.ITEMS[f.got].icon : null, used: f.used ? this.T.ITEMS[f.used].icon : f.v.help ? this.T.ITEMS[f.v.help].icon : null, froze: r.froze.has(f.x.id), lucky: !!f.lucky, healed: f.healed, cured: f.cured, why: this.why(f), saved: f.v.saved, doomed: f.v.doomed, fi: i })),
        more: Math.max(0, fs.length - SHOW), sev: c.dead * 3 + c.bitten * 2 + c.hurt });
    }
    groups.sort((a, b) => a.sev - b.sev); // the worst news last
    const recapMs = Math.min(RECAP_MAX, RECAP_BASE + RECAP_PER * groups.length);
    let t = recapMs;
    for (const g of groups) {
      const shown = Math.min(g.total, SHOW), per = perOf(shown);
      g.at = t; g.verdictAt = t + ACT_MS + CONSEQ_MS; g.per = per; g.ms = ACT_MS + CONSEQ_MS + shown * per + TAIL_MS;
      g.fs.forEach((f, i) => { f.revealAt = g.verdictAt + Math.min(i, shown) * per; f.line = g.line; });
      g.people.forEach((p, i) => { p.at = g.verdictAt + i * per; delete p.fi; });
      delete g.fs; t += g.ms;
    }
    let feverOut = null;
    if (fever.length) {
      const shown = Math.min(fever.length, SHOW);
      fever.forEach((v, i) => { v.revealAt = t + FEV_IN + Math.min(i, shown) * FEV_PER; });
      const by = (how) => fever.filter((v) => v.fate === 'cured' && v.how === how).map((v) => v.f);
      feverOut = { at: t, per: FEV_PER, revealIn: FEV_IN, line: this.T.BITE_LINES[r.n % this.T.BITE_LINES.length] + ' ' + [
        by('🩹').length ? `${this.names(by('🩹'))} patched up the bite with a medkit just in time.` : '',
        by('💉').length ? `${this.names(by('💉'))} felt Dr. Okafor’s shot kick in. The bite didn’t take!` : '',
        by('🍀').length ? `${this.names(by('🍀'))} shook off the fever. Lucky.` : '',
        fever.filter((v) => v.fate === 'turned').length ? `${this.names(fever.filter((v) => v.fate === 'turned').map((v) => v.f))} turned. Groan.` : '',
      ].filter(Boolean).join(' '), people: fever.slice(0, SHOW).map((v) => ({ ...this.pub(v.f.x), fate: v.fate, how: v.how || null, at: v.revealAt })) };
      t += FEV_IN + shown * FEV_PER + TAIL_MS;
    }
    const all = [...fates.values()], list = (fn) => all.filter(fn).slice(0, 40).map((f) => this.pub(f.x));
    const tally = {
      made: all.filter((f) => f.x.alive).length, bitten: all.filter((f) => f.x.alive && f.x.status === 'bitten').length, hurt: all.filter((f) => f.x.alive && f.x.status === 'hurt').length, fell: all.filter((f) => !f.x.alive).length,
      lists: { ok: list((f) => f.x.alive && f.x.status === 'ok'), hurt: list((f) => f.x.alive && f.x.status === 'hurt'), bitten: list((f) => f.x.alive && f.x.status === 'bitten'), fell: list((f) => !f.x.alive) },
    };
    const ms = Math.max(MIN_OUT, t + TALLY_MS + (sc.final ? FINAL_MS : 0));
    const recap = groups.map((g) => g.setup).join('. ') + '.';
    return { n: r.n, ms, final: !!sc.final, title: sc.title, groupLine, groupOk, groups, fever: feverOut, tally, endAt: t, recapMs, recap, picks: Object.fromEntries(count) };
  }
  finish() {
    if (this.phase === 'over') return;
    this.room.cancel(this.timer); this.timer = null; this.endsAt = 0;
    const lastFinal = this.r && this.r.sc && this.r.sc.final && this.r.fates && this.r.fates.size;
    this.phase = 'over';
    this.epilogue = this.buildEpilogue(!!lastFinal);
    this.room.fx(this.epilogue.rescued.length ? 'win' : 'wipe');
  }
  next() {
    this.room.cancel(this.timer);
    if (this.phase === 'chapter') this.openChoose();
    else if (this.phase === 'choose') this.close();
    else if (this.phase === 'outcome') { if ((this.r && this.r.sc.final) || !this.livingPlayers().length) this.finish(); else this.board(); }
    else if (this.phase === 'board') this.nextScene();
  }

  // ---- how far everyone got ----
  reach(x) { return x.alive ? (this.phase === 'over' && this.epilogue && this.epilogue.reachedEnd ? this.plan.length + 1 : Math.max(this.r ? this.r.n : this.idx + 1, 0)) : x.diedAt; }
  reachText(x, rescued) {
    if (rescued) return 'Rescued';
    if (x.alive) { const c = this.chapter || this.T.CHAPTERS[0]; return `Day ${c.day} · ${c.place || c.name}`; }
    return `Day ${x.diedDay} · ${x.diedPlace}`;
  }
  flagList(x) { return [...x.flags].filter((f) => this.T.FLAGS[f]).map((f) => ({ k: f, icon: this.T.FLAGS[f].icon, label: this.T.FLAGS[f].label, bad: !!this.T.FLAGS[f].bad })); }

  // ---- the end ----
  buildEpilogue(reachedEnd) {
    const r = this.r, finalF = (x) => (r && r.fates ? r.fates.get(x.id) : null);
    const everyone = [...this.ppl.values()].filter((x) => this.here(x));
    const rescued = reachedEnd ? everyone.filter((x) => x.alive) : [];
    const fates = everyone.map((x) => {
      let line;
      const isRescued = rescued.includes(x);
      if (isRescued) {
        const f = finalF(x), bits = [];
        if (x.st.saves) bits.push(`after saving ${x.st.saves === 1 ? 'a friend' : x.st.saves + ' friends'}`);
        else if (x.st.savedBy >= 2) bits.push(`after their gear and past choices saved them ${x.st.savedBy} times`);
        else if (x.st.close >= 2) bits.push(`after ${x.st.close} close calls`);
        else if (this.has(x, 'gun')) bits.push(`with ${this.itemCount(x, 'gun')} ${this.T.ITEMS.gun.unit} to spare`);
        const how = f ? (f.v.rule ? f.v.rule.line : f.o.ok) : 'made it out';
        line = `${this.name(x)} ${how}${bits.length ? ', ' + bits[0] : ''}.`;
      } else if (x.alive) line = `${this.name(x)} made it to Day ${(this.chapter || this.T.CHAPTERS[0]).day}, and was still out there when the story ended.`;
      else {
        const ghost = x.st.haunts ? ` Then haunted ${x.st.haunts} survivor${x.st.haunts === 1 ? '' : 's'} as a ghost.` : '';
        line = `${this.name(x)} made it to Day ${x.diedDay}, ${x.diedPlace}, then ${x.diedHow}.${x.diedWhy ? ' ' + x.diedWhy : ''}${ghost}`;
      }
      return { ...this.pub(x), alive: x.alive, rescued: isRescued, diedAt: x.diedAt, day: x.alive ? (this.chapter || {}).day || 1 : x.diedDay, reach: this.reachText(x, isRescued), line, pts: x.npc ? null : x.pts, survived: x.st.survived, flags: this.flagList(x).slice(0, 6) };
    });
    fates.sort((a, b) => (b.rescued - a.rescued) || (b.alive - a.alive) || (b.diedAt - a.diedAt) || ((b.pts || 0) - (a.pts || 0)));
    const players = everyone.filter((x) => !x.npc);
    const best = (fn, min = 1) => { let top = min - 1, who = []; for (const x of players) { const v = fn(x); if (v > top) { top = v; who = [x]; } else if (v === top && v >= min) who.push(x); } return top >= min ? { names: who.slice(0, 4).map((x) => this.name(x)), value: top } : null; };
    const dead = players.filter((x) => !x.alive && x.diedAt);
    const first = dead.length ? Math.min(...dead.map((x) => x.diedAt)) : 0;
    const awards = [
      ['hero', '🦸', 'Hero of the Apocalypse', best((x) => x.st.hero), (v) => `${v} heroic move${v === 1 ? '' : 's'}`],
      ['angel', '🎁', 'Guardian Angel', best((x) => x.st.gifts + x.st.saves), (v) => `${v} gifts and saves`],
      ['planner', '🧠', 'Planned Ahead', best((x) => x.st.savedBy, 2), (v) => `saved ${v} times by gear or past choices`],
      ['packrat', '🎒', 'Pack Rat', best((x) => x.st.found, 3), (v) => `found ${v} items`],
      ['lives', '🍀', 'Nine Lives', best((x) => x.st.close + x.st.lucky, 2), (v) => `${v} close calls`],
      ['trigger', '🔫', 'Trigger Happy', best((x) => x.st.shots, 2), (v) => `${v} shots fired`],
      ['ghost', '👻', 'Poltergeist', best((x) => x.st.ghostPts, 30), (v) => `${v} ghost points`],
      ['first', '💀', 'Taking One for the Team', first ? { names: dead.filter((x) => x.diedAt === first).slice(0, 4).map((x) => this.name(x)), value: first } : null, (v) => `first to fall (scene ${v})`],
    ].filter((a) => a[3]).map(([k, icon, title, a, txt]) => ({ k, icon, title, names: a.names, text: txt(a.value) }));
    return { rescued: rescued.map((x) => this.pub(x)), fates: fates.slice(0, 60), more: Math.max(0, fates.length - 60), awards, reachedEnd, scenes: this.history.length, wipe: !rescued.length, difficulty: this.s.difficulty };
  }
  // Survivors first, then whoever got furthest, then points.
  standings() {
    return [...this.ppl.values()].filter((x) => !x.npc && this.here(x))
      .sort((a, b) => (b.alive - a.alive) || this.reach(b) - this.reach(a) || b.pts - a.pts || b.st.survived - a.st.survived)
      .map((x) => ({ ...this.pub(x), pts: x.pts, alive: x.alive, status: x.status, survived: x.st.survived, reach: this.reachText(x, this.phase === 'over' && x.alive && this.epilogue && this.epilogue.reachedEnd) }));
  }
  results() { return this.phase === 'over' ? this.standings().map((x) => x.id) : []; }

  // ---- public / private state ----
  optionInfo(o) {
    const I = this.T.ITEMS, F = this.T.FLAGS;
    return { k: o.k, icon: o.icon, label: o.label, anim: o.anim, need: o.need ? I[o.need].icon : null, help: o.hintItems.map((k) => I[k].icon).join(''), flags: o.hintFlags.map((f) => F[f].icon).join(''),
      gain: o.gain ? [].concat(o.gain).map((k) => I[k].icon).join('') : '', heal: !!o.heal, cure: !!o.cure, hero: !!o.hero, role: o.role || null, danger: o.danger };
  }
  sceneInfo() {
    const sc = this.r ? this.r.sc : this.phase === 'chapter' ? null : this.sceneOf();
    return sc ? { id: sc.id, title: sc.title, text: sc.text, final: !!sc.final, options: sc.options.map((o) => this.optionInfo(o)) } : null;
  }
  common() {
    const ch = this.chapter || this.T.CHAPTERS[0];
    return {
      phase: this.phase, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      n: this.r ? this.r.n : this.idx + 1, total: this.plan.length, ghosts: !!this.s.ghosts, narrator: this.s.narrator !== false, difficulty: this.s.difficulty,
      chapter: { key: ch.key, day: ch.day, name: ch.name, loc: ch.loc, line: ch.line, last: ch.key === 'rescue' },
      scene: this.phase === 'chapter' ? null : this.sceneInfo(),
    };
  }
  person(x) {
    return { ...this.pub(x), alive: x.alive, status: x.status, items: x.items.map((i) => this.T.ITEMS[i.k].icon).join(''), flags: [...x.flags].map((f) => (this.T.FLAGS[f] || {}).icon || '').join(''), pts: x.npc ? null : x.pts, diedAt: x.diedAt };
  }
  tv() {
    const r = this.r, all = [...this.ppl.values()].filter((x) => this.here(x));
    const living = all.filter((x) => x.alive), ghosts = all.filter((x) => !x.alive);
    const choosing = this.phase === 'choose' && r;
    const haunts = r && (this.phase === 'outcome' || this.phase === 'board') ? [...r.haunts].slice(0, 12).map(([g, h]) => ({ from: this.name(this.ppl.get(g)), to: this.name(this.ppl.get(h.to)), mode: h.mode, hit: !!h.hit })) : [];
    return {
      ...this.common(),
      chosen: choosing ? r.ids.filter((id) => r.picks.has(id) && this.ppl.get(id) && !this.ppl.get(id).npc).length : 0,
      of: choosing ? r.ids.filter((id) => { const x = this.ppl.get(id); return x && !x.npc && x.alive && this.here(x); }).length : 0,
      haunted: choosing ? r.haunts.size : 0,
      waiting: choosing && r.ids.length <= 24 ? r.ids.map((id) => this.ppl.get(id)).filter((x) => x && !x.npc && x.alive && this.here(x) && !r.picks.has(x.id)).map((x) => this.name(x)) : null,
      gifts: r ? [...r.gifts].slice(-6).map(([g, v]) => ({ from: this.name(this.ppl.get(g)), to: this.name(this.ppl.get(v.to)), item: this.T.ITEMS[v.item].icon })) : [],
      people: living.slice(0, 100).map((x) => this.person(x)), ghostList: ghosts.slice(0, 100).map((x) => this.person(x)),
      alive: living.length, dead: ghosts.length,
      outcome: r && r.outcome && (this.phase === 'outcome' || this.phase === 'board') ? r.outcome : null, haunts,
      standings: this.standings().slice(0, 10),
      epilogue: this.phase === 'over' ? this.epilogue : null,
    };
  }
  view(p) {
    const x = this.ppl.get(p.id), r = this.r, st = this.standings();
    const base = { ...this.common(), rank: st.findIndex((y) => y.id === p.id) + 1, of: st.length };
    if (!x) return { ...base, me: null };
    const me = { ...this.person(x), items: x.items.map((i) => ({ k: i.k, icon: this.T.ITEMS[i.k].icon, name: this.T.ITEMS[i.k].name, n: i.n, unit: this.T.ITEMS[i.k].unit || null, hint: this.T.ITEMS[i.k].hint || '' })),
      flags: this.flagList(x), bittenNow: x.status === 'bitten' && r && x.bittenAt < r.n, inScene: !!(r && r.ids.includes(x.id)), joinedAt: x.joinedAt, st: x.st, reach: this.reachText(x, false) };
    const out = { ...base, me };
    if (r && this.phase === 'choose') {
      out.pick = r.picks.get(x.id) || null;
      out.locked = r.sc.options.filter((o) => this.locked(x, o)).map((o) => o.k);
      // "your gear or your past could help here" (no spoilers about how much)
      out.boost = r.sc.options.filter((o) => !this.locked(x, o) && ((o.help && Object.keys(o.help).some((k) => this.has(x, k))) || o.outcomes.some((y) => this.goodRule(o, y) && this.test(x, y.if)))).map((o) => o.k);
      out.gave = r.gifts.has(x.id) ? { ...r.gifts.get(x.id), to: this.name(this.ppl.get(r.gifts.get(x.id).to)) } : null;
      const others = this.living().filter((y) => y !== x);
      out.others = others.sort((a, b) => (b.status === 'bitten') - (a.status === 'bitten')).slice(0, 60).map((y) => ({ id: y.id, name: this.name(y), avatar: this.pub(y).avatar, status: y.status, medkit: this.has(y, 'medkit') }));
      out.haunt = r.haunts.get(x.id) || null;
    }
    if (r && r.outcome && (this.phase === 'outcome' || this.phase === 'board')) {
      const f = r.fates.get(x.id);
      if (f) {
        const fev = r.outcome.fever && r.outcome.fever.people.find((y) => y.id === x.id), I = this.T.ITEMS;
        out.mine = { fate: !x.alive && fev ? 'turned' : f.fate, cured: f.cured || !!(fev && fev.fate === 'cured'), cureHow: fev ? fev.how : null, healed: f.healed, label: f.o.label, icon: f.o.icon, line: this.sentence([f]), why: this.why(f),
          got: f.got ? I[f.got].icon + ' ' + I[f.got].name : null, dropped: f.dropped ? I[f.dropped].icon + ' ' + I[f.dropped].name : null, used: f.used ? I[f.used].icon : null,
          flags: (f.flags || []).map((k) => ({ icon: this.T.FLAGS[k].icon, label: this.T.FLAGS[k].label, bad: !!this.T.FLAGS[k].bad })), froze: r.froze.has(x.id), lucky: !!f.lucky, saved: f.v.saved, doomed: f.v.doomed,
          at: f.revealAt || 0, feverAt: fev ? fev.at : null, ms: r.outcome.ms, alive: x.alive };
      }
      const h = r.haunts.get(x.id);
      if (h) out.myHaunt = { to: this.name(this.ppl.get(h.to)), mode: h.mode, hit: !!h.hit, pts: h.hit ? (h.mode === 'bless' ? BLESS : CURSE) : 0, at: r.outcome.endAt };
      out.outMs = r.outcome.ms;
    }
    if (this.phase === 'over' && this.epilogue) {
      const f = this.epilogue.fates.find((y) => y.id === x.id);
      out.end = { line: f ? f.line : '', reach: f ? f.reach : '', rescued: !!(f && f.rescued), awards: this.epilogue.awards.filter((a) => a.names.includes(this.name(x))).map((a) => ({ icon: a.icon, title: a.title })), standings: st.slice(0, 8), wipe: this.epilogue.wipe };
    }
    return out;
  }
}

module.exports = {
  key: 'zombie', name: 'Zombie Survival', min: 1, best: [4, 16], howSteps: 6, fields, defaults,
  locked: { how: 'Finish a Party Mode to unlock it.' },
  create: (room, settings) => new Zombie(room, settings),
  _test: { ITEMS, FLAGS, CHAPTERS, SCENARIOS, DEFAULT, TIERS, PER_CHAPTER, TOLD },
};
