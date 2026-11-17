'use strict';
// Zombie Survival: a story that plays out over six days of a (cartoony) zombie outbreak.
// Every scene is a scenario with 3–5 options ("the medkit, the pistol or the rope?", "hold the
// door or run out the back?"). Everyone picks on their phone; then the TV acts out what
// happened to each group, and who made it, who got bitten and who fell.
//
// How fates are decided (rule-based with some luck, so it's fair and readable):
//   risk = option risk × difficulty (+ crowd effect) × group effect
//          × 1.4 if you're hurt × the best item that helps (it gets used: bullets, swings…)
//          + ghost haunts (±7% each, ±20% max) + 10% if you froze (didn't pick in time)
//   One roll: under the risk = something went wrong: a bite, an injury, or you fall
//   (the option sets the shares). Hurt twice = you fall. Bitten = you turn at the end of the
//   NEXT scene unless you have a medkit by then (a friend can give you one!).
//   Group effects: 'hold' (the door holds if enough people hold it: then the runners are
//   much safer), 'cover' (one decoy/lookout protects everybody else), 'vote' (the most-picked
//   option decides what happens).
// The dead become ghosts: each scene they bless 🍀 or curse 🕯️ a survivor (a small nudge to
// their luck) and score if they called it. Points: +100 per scene survived, +500 for the
// rescue, hero / helper bonuses, ghost points. With 1–3 players, AI survivors join the group.
const STORY = require('./zombie-story');
const { ITEMS, CHAPTERS, SCENARIOS } = STORY;
// Two tellings of the same story: the normal one and the gentler Family one (room.family).
const TOLD = [false, true].map((fam) => { const t = STORY.story(fam); return { ...t, SC: new Map(t.SCENARIOS.map((x) => [x.id, x])), CH: new Map(t.CHAPTERS.map((c) => [c.key, c])) }; });

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'length', label: 'Story length', options: opt([['short', 'Short (~12 min)'], ['normal', 'Normal (~20 min)'], ['long', 'Long (~25 min)']]) },
  { key: 'difficulty', label: 'Difficulty', options: opt([['forgiving', 'Forgiving'], ['normal', 'Normal'], ['brutal', 'Brutal']]) },
  { key: 'timer', label: 'Time to choose', options: opt([[20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds']]) },
  { key: 'ghosts', label: 'Ghosts', options: opt([[true, 'On: the dead haunt the living'], [false, 'Off: the dead just watch']]) },
  { key: 'narrator', label: 'Narrator voice', options: opt([[true, 'On'], [false, 'Off: subtitles only']]) },
];
const defaults = { length: 'normal', difficulty: 'normal', timer: 30, ghosts: true, narrator: true };

const PER_CHAPTER = { short: 2, normal: 3, long: 4 };
const RESCUE_PRE = { short: 0, normal: 1, long: 1 };
const DIFF = { forgiving: 0.5, normal: 0.78, brutal: 1.12 };
const CHAPTER_MS = 8000, READ_MS = 4000, BOARD_MS = 5500, ALLIN_MS = 3500;
// Outcome beats (ms): see buildOutcome.
const RECAP_BASE = 3600, RECAP_PER = 900, RECAP_MAX = 8000, ACT_MS = 2400, CONSEQ_MS = 1500, TAIL_MS = 1500;
const FEV_IN = 1800, FEV_PER = 900, TALLY_MS = 6000, FINAL_MS = 5000, MIN_OUT = 14000;
const perOf = (n) => (n <= 4 ? 1000 : Math.max(250, Math.round(4000 / n))); // one verdict stamp at a time
const SURVIVE = 100, RESCUE = 500, GIFT = 20, SAVE = 30, BLESS = 30, CURSE = 50;
const CAP = 4; // backpack slots
const MIN_GROUP = 4; // fewer players than this: AI survivors join
const SHOW = 16; // people per group acted out on the TV (the rest are counted)
const NPCS = [['Granny Mae', '👵'], ['Coach Duffy', '🧔'], ['Chef Rosa', '👩‍🍳'], ['Dusty', '🤠'], ['Nurse Ivy', '👩‍⚕️'], ['Skater Leo', '🛹']];
const NPC_COLORS = ['#c9a36b', '#8fb3a0', '#d98a6c', '#a3a0d9'];

class Zombie {
  constructor(room, settings) {
    this.room = room; this.s = { ...defaults, ...settings };
    this.family = !!(room && room.family); this.T = TOLD[this.family ? 1 : 0]; // the story as told in this room
    this.phase = 'chapter'; this.ppl = new Map(); this.plan = []; this.idx = -1; this.r = null;
    this.timer = null; this.endsAt = 0; this.chapter = null; this.history = []; this.epilogue = null; this.npcN = 0;
  }
  rng() { return this.room.rng(); }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }

  // ---- the cast ----
  seat(p) {
    if (this.ppl.has(p.id)) return;
    this.ppl.set(p.id, { id: p.id, npc: false, alive: true, status: 'ok', bittenAt: 0, hurtAt: 0, items: [], pts: 0, diedAt: 0, diedHow: '', diedDay: 0, joinedAt: Math.max(1, this.idx + 2),
      st: { survived: 0, found: 0, gifts: 0, saves: 0, hero: 0, heroPts: 0, ghostPts: 0, haunts: 0, close: 0, shots: 0, lucky: 0 } });
  }
  addNpc() {
    const [name, avatar] = NPCS[this.npcN % NPCS.length], id = 'npc' + (++this.npcN);
    this.ppl.set(id, { id, npc: true, name, avatar, color: NPC_COLORS[this.npcN % NPC_COLORS.length], alive: true, status: 'ok', bittenAt: 0, hurtAt: 0, items: [], pts: 0, diedAt: 0, diedHow: '', diedDay: 0, joinedAt: 1,
      st: { survived: 0, found: 0, gifts: 0, saves: 0, hero: 0, heroPts: 0, ghostPts: 0, haunts: 0, close: 0, shots: 0, lucky: 0 } });
  }
  here(x) { return !!x && (x.npc || !!this.room.get(x.id)); }
  pub(x) {
    if (x.npc) return { id: x.id, name: x.name, avatar: x.avatar, color: x.color, npc: true };
    const p = this.room.get(x.id);
    return p ? { id: x.id, name: p.name, avatar: p.avatar || '🙂', color: p.color, bot: !!p.bot } : { id: x.id, name: '—', avatar: '🙂', color: '#888' };
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
      const first = c.key === 'outbreak' ? this.T.SCENARIOS.filter((s) => s.first) : [];
      const list = [...first];
      // From three scenes a chapter, one of them may be a wildcard (night watch, the fog…).
      const wild = per >= 3 && anyPool.length && this.rng() < 0.6 ? 1 : 0;
      while (list.length < per - wild && pool.length) list.push(pool.shift());
      if (wild) list.splice(1 + Math.floor(this.rng() * (list.length)), 0, anyPool.shift());
      for (const s of list.slice(0, per)) this.plan.push({ id: s.id, ch: c.key });
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
    this.r = { n: this.idx + 1, sc, ids, picks: new Map(), froze: new Set(), gifts: new Map(), haunts: new Map(), outcome: null, fates: new Map() };
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

  // ---- items ----
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
    if (typeof m.item !== 'string' || !this.T.ITEMS[m.item] || !this.has(x, m.item)) return { ok: false, error: 'You don’t have that.' };
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
  estimate(x, o) {
    let r = o.risk + (o.crowd || 0) * 0.3;
    if (o.help) { let best = 1; for (const [k, f] of Object.entries(o.help)) if (this.has(x, k)) best = Math.min(best, f); r *= best; }
    if (x.status === 'hurt') r *= 1.4;
    if (o.gain) r -= 0.05;
    if (o.heal && x.status === 'hurt') r -= 0.12;
    if (o.cure && x.status === 'bitten' && !this.has(x, 'medkit')) r -= 0.6;
    if (o.role === 'hold' || o.role === 'cover') r -= 0.04;
    return r;
  }
  pickFor(x) {
    const opts = this.r.sc.options.filter((o) => !this.locked(x, o));
    if (this.rng() < 0.16) { const h = opts.filter((o) => o.hero); if (h.length) return h[Math.floor(this.rng() * h.length)]; }
    let best = null, bs = Infinity;
    for (const o of opts) { const s = this.estimate(x, o) + this.rng() * 0.14; if (s < bs) { bs = s; best = o; } }
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
  resolve() {
    const r = this.r, sc = r.sc, n = r.n, rng = () => this.rng();
    const living = r.ids.map((id) => this.ppl.get(id)).filter((x) => x && x.alive && this.here(x));
    // Nobody picked in time: AI and bots pick for themselves; people froze (a random option, a bit riskier).
    for (const x of living) {
      if (r.picks.has(x.id)) continue;
      if (this.isBot(x)) { r.picks.set(x.id, this.pickFor(x).k); continue; }
      const opts = sc.options.filter((o) => !this.locked(x, o));
      r.picks.set(x.id, opts[Math.floor(rng() * opts.length)].k); r.froze.add(x.id);
    }
    const count = new Map(sc.options.map((o) => [o.k, 0]));
    for (const x of living) count.set(r.picks.get(x.id), (count.get(r.picks.get(x.id)) || 0) + 1);
    const total = Math.max(1, living.length), mult = new Map(sc.options.map((o) => [o.k, 1]));
    const G = sc.group; let groupLine = '', groupOk = null, voteWin = null;
    if (G && G.type === 'hold') {
      const holders = sc.options.filter((o) => o.role === 'hold').reduce((a, o) => a + count.get(o.k), 0);
      groupOk = holders >= Math.max(1, Math.ceil(G.need * total));
      for (const o of sc.options) if (o.role === 'hold') mult.set(o.k, groupOk ? 1 : 1.8); else if (o.role === 'run') mult.set(o.k, groupOk ? 0.35 : 1.6);
      groupLine = groupOk ? G.ok : G.bad;
    } else if (G && G.type === 'cover') {
      const cov = sc.options.filter((o) => o.role === 'cover').reduce((a, o) => a + count.get(o.k), 0);
      groupOk = cov > 0;
      for (const o of sc.options) if (o.role !== 'cover') mult.set(o.k, groupOk ? G.factor : G.none);
      groupLine = groupOk ? G.ok : G.bad;
    } else if (G && G.type === 'vote') {
      let top = -1; for (const o of sc.options) if (count.get(o.k) > top) { top = count.get(o.k); voteWin = o.k; }
      groupLine = (G.ok && G.ok[voteWin]) || '';
    }
    const diff = DIFF[this.s.difficulty] || DIFF.normal;
    const fates = new Map();
    for (const x of living) {
      const o = sc.options.find((y) => y.k === r.picks.get(x.id));
      let risk = o.risk * diff + (o.crowd || 0) * (count.get(o.k) / total) * Math.min(1, total / 4);
      risk *= mult.get(o.k);
      if (x.status === 'hurt') risk *= 1.4;
      let used = null;
      if (o.help) { let best = 1; for (const [k, f] of Object.entries(o.help)) if (this.has(x, k) && f < best) { best = f; used = k; } if (used) { risk *= best; if (used === 'gun') x.st.shots++; this.useItem(x, used); } }
      if (o.need && this.T.ITEMS[o.need].uses && o.need !== 'medkit') this.useItem(x, o.need);
      let nudge = 0; for (const [, h] of r.haunts) if (h.to === x.id) nudge += h.mode === 'curse' ? 0.07 : -0.07;
      risk += Math.max(-0.2, Math.min(0.2, nudge));
      if (r.froze.has(x.id)) risk += 0.1;
      risk = Math.max(0.01, Math.min(0.92, risk));
      const roll = rng(), hit = roll < risk;
      let fate = 'safe';
      if (hit) {
        const b = o.bite == null ? 0.4 : o.bite, h = o.hurt == null ? 0.3 : o.hurt, sum = Math.max(1, b + h), y = rng();
        if (y < b / sum) fate = x.status === 'bitten' ? 'dead' : 'bitten';
        else if (y < (b + h) / sum) fate = x.status === 'hurt' ? 'dead' : 'hurt';
        else fate = 'dead';
      }
      fates.set(x.id, { x, o, fate, used, margin: roll - risk, got: null, dropped: null, healed: false, cured: false });
    }
    // Mercy: the story never ends before the rescue. If every player would fall, the luckiest one doesn't.
    const willLive = (f) => f.fate !== 'dead' && !(f.x.status === 'bitten' && f.x.bittenAt < n && !this.has(f.x, 'medkit') && !(f.o.cure));
    const players = [...fates.values()].filter((f) => !f.x.npc);
    if (!sc.final && players.length && !players.some(willLive)) {
      const best = players.sort((a, b) => b.margin - a.margin)[0];
      if (best.fate === 'dead') best.fate = best.x.status === 'hurt' ? 'safe' : 'hurt';
      best.lucky = true; best.x.st.lucky++;
      if (best.x.status === 'bitten' && !this.has(best.x, 'medkit')) best.spare = true; // the bite didn't take
    }
    // Apply fates, pick-ups, heals and cures.
    for (const f of fates.values()) {
      const x = f.x, o = f.o;
      if (f.fate === 'dead') { this.kill(x, o.bad, n); continue; }
      if (f.fate === 'bitten') { x.status = 'bitten'; x.bittenAt = n; }
      else if (f.fate === 'hurt') { if (x.status !== 'bitten') x.status = 'hurt'; x.hurtAt = n; x.st.close++; }
      if (f.fate === 'safe' || f.fate === 'hurt') {
        if (o.cure && x.status === 'bitten' && x.bittenAt < n) { x.status = 'ok'; f.cured = true; x.st.close++; }
        if (o.heal && x.status === 'hurt' && f.fate === 'safe') { x.status = 'ok'; f.healed = true; }
        if (o.gain) {
          const k = Array.isArray(o.gain) ? o.gain[Math.floor(rng() * o.gain.length)] : o.gain;
          const g = this.addItem(x, k); if (g) { f.got = g.got; f.dropped = g.dropped; x.st.found++; }
        }
        if (o.hero) { this.score(x, o.hero); x.st.hero++; x.st.heroPts += o.hero; }
      }
      if (f.fate === 'safe' && x.status === 'hurt' && x.hurtAt <= n - 2) { x.status = 'ok'; f.healed = true; }
    }
    // Vote gift: one of the people who backed the winning option gets it.
    if (voteWin && G.gift && G.gift[voteWin]) {
      const backers = [...fates.values()].filter((f) => f.o.k === voteWin && f.fate !== 'dead');
      if (backers.length) { const f = backers[Math.floor(rng() * backers.length)], g = this.addItem(f.x, G.gift[voteWin]); if (g) { f.got = g.got; f.dropped = g.dropped; f.x.st.found++; } }
    }
    // Earlier bites: a medkit cures it, otherwise they turn now.
    const fever = [];
    for (const f of fates.values()) {
      const x = f.x;
      if (!x.alive || x.status !== 'bitten' || x.bittenAt >= n) continue;
      if (this.has(x, 'medkit')) { this.useItem(x, 'medkit'); x.status = 'ok'; x.st.close++; fever.push({ f, fate: 'cured' }); }
      else if (f.spare) { x.status = 'ok'; fever.push({ f, fate: 'cured' }); }
      else { this.kill(x, 'turned after a bite', n, true); fever.push({ f, fate: 'turned' }); }
    }
    // Points: survivors, the rescue, and the ghosts who called it.
    for (const f of fates.values()) if (f.x.alive) { f.x.st.survived++; this.score(f.x, SURVIVE + (sc.final ? RESCUE : 0)); }
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
  kill(x, how, n, turned = false) {
    x.alive = false; x.status = turned ? 'turned' : 'dead'; x.diedAt = n; x.diedHow = how; x.diedDay = this.chapter ? this.chapter.day : 1; x.diedPlace = this.chapter ? this.chapter.name : '';
  }
  names(list) {
    const ns = list.map((f) => this.name(f.x));
    if (ns.length <= 3) return ns.length > 1 ? ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1] : ns[0] || '';
    return `${ns.slice(0, 2).join(', ')} and ${ns.length - 2} others`;
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
      fs.sort((a, b) => (a.x.npc ? 1 : 0) - (b.x.npc ? 1 : 0) || order[a.fate] - order[b.fate]);
      const clean = fs.filter((f) => f.fate === 'safe'), hit = fs.filter((f) => f.fate !== 'safe');
      const parts = [];
      if (clean.length) parts.push(`${this.names(clean)} ${o.ok}.`);
      if (hit.length) parts.push(`${this.names(hit)} ${o.bad}.`);
      const c = { safe: clean.length, hurt: 0, bitten: 0, dead: 0 }; for (const f of hit) c[f.fate]++;
      groups.push({ k: o.k, icon: o.icon, label: o.label, anim: o.anim, role: o.role || null, need: o.need ? this.T.ITEMS[o.need].icon : null,
        gain: o.gain ? [].concat(o.gain).map((k) => this.T.ITEMS[k].icon).join('') : '', line: parts.join(' '), counts: c, total: fs.length,
        setup: `${this.names(fs)}: ${o.label.charAt(0).toLowerCase() + o.label.slice(1)}`, fs,
        people: fs.slice(0, SHOW).map((f) => ({ ...this.pub(f.x), fate: f.fate, got: f.got ? this.T.ITEMS[f.got].icon : null, used: f.used ? this.T.ITEMS[f.used].icon : null, froze: r.froze.has(f.x.id), lucky: !!f.lucky, healed: f.healed, cured: f.cured, fi: fs.indexOf(f) })),
        more: Math.max(0, fs.length - SHOW), sev: c.dead * 3 + c.bitten * 2 + c.hurt });
    }
    groups.sort((a, b) => a.sev - b.sev); // the worst news last
    const recapMs = Math.min(RECAP_MAX, RECAP_BASE + RECAP_PER * groups.length);
    let t = recapMs;
    for (const g of groups) {
      const shown = Math.min(g.total, SHOW), per = perOf(shown);
      g.at = t; g.verdictAt = t + ACT_MS + CONSEQ_MS; g.per = per; g.ms = ACT_MS + CONSEQ_MS + shown * per + TAIL_MS;
      g.fs.forEach((f, i) => { f.revealAt = g.verdictAt + Math.min(i, shown) * per; });
      g.people.forEach((p, i) => { p.at = g.verdictAt + i * per; delete p.fi; });
      delete g.fs; t += g.ms;
    }
    let feverOut = null;
    if (fever.length) {
      const shown = Math.min(fever.length, SHOW);
      fever.forEach((v, i) => { v.revealAt = t + FEV_IN + Math.min(i, shown) * FEV_PER; });
      feverOut = { at: t, per: FEV_PER, revealIn: FEV_IN, line: this.T.BITE_LINES[r.n % this.T.BITE_LINES.length] + ' ' + [
        fever.filter((v) => v.fate === 'cured').length ? `${this.names(fever.filter((v) => v.fate === 'cured').map((v) => v.f))} patched up the bite just in time.` : '',
        fever.filter((v) => v.fate === 'turned').length ? `${this.names(fever.filter((v) => v.fate === 'turned').map((v) => v.f))} turned. Groan.` : '',
      ].filter(Boolean).join(' '), people: fever.slice(0, SHOW).map((v) => ({ ...this.pub(v.f.x), fate: v.fate, at: v.revealAt })) };
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
    const lastFinal = this.r && this.r.sc && this.r.sc.final;
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

  // ---- the end ----
  buildEpilogue(reachedEnd) {
    const r = this.r, finalOpt = (x) => { if (!r || !r.fates) return null; const f = r.fates.get(x.id); return f ? f.o : null; };
    const everyone = [...this.ppl.values()].filter((x) => this.here(x));
    const rescued = reachedEnd ? everyone.filter((x) => x.alive) : [];
    const fates = everyone.map((x) => {
      let line;
      if (x.alive && reachedEnd) {
        const o = finalOpt(x), bits = [];
        if (x.st.saves) bits.push(`after saving ${x.st.saves === 1 ? 'a friend' : x.st.saves + ' friends'} with a medkit`);
        else if (x.st.close >= 2) bits.push(`after ${x.st.close} close calls`);
        else if (this.has(x, 'gun')) bits.push(`with ${this.itemCount(x, 'gun')} bullet${this.itemCount(x, 'gun') === 1 ? '' : 's'} to spare`);
        line = `${this.name(x)} ${o ? o.ok : 'made it out'}${bits.length ? ', ' + bits[0] : ''}.`;
      } else if (x.alive) line = `${this.name(x)} was still out there when the story ended.`;
      else {
        const ghost = x.st.haunts ? `, then haunted ${x.st.haunts} survivor${x.st.haunts === 1 ? '' : 's'} as a ghost` : '';
        line = `${this.name(x)} ${x.diedHow} on Day ${x.diedDay}${ghost}.`;
      }
      return { ...this.pub(x), alive: x.alive, rescued: rescued.includes(x), diedAt: x.diedAt, day: x.diedDay, line, pts: x.npc ? null : x.pts, survived: x.st.survived };
    });
    fates.sort((a, b) => (b.rescued - a.rescued) || (b.alive - a.alive) || (b.diedAt - a.diedAt) || ((b.pts || 0) - (a.pts || 0)));
    const players = everyone.filter((x) => !x.npc);
    const best = (fn, min = 1) => { let top = min - 1, who = []; for (const x of players) { const v = fn(x); if (v > top) { top = v; who = [x]; } else if (v === top && v >= min) who.push(x); } return top >= min ? { names: who.slice(0, 4).map((x) => this.name(x)), value: top } : null; };
    const dead = players.filter((x) => !x.alive && x.diedAt);
    const first = dead.length ? Math.min(...dead.map((x) => x.diedAt)) : 0;
    const awards = [
      ['hero', '🦸', 'Hero of the Apocalypse', best((x) => x.st.hero), (v) => `${v} heroic move${v === 1 ? '' : 's'}`],
      ['angel', '🎁', 'Guardian Angel', best((x) => x.st.gifts), (v) => `gave away ${v} item${v === 1 ? '' : 's'}`],
      ['packrat', '🎒', 'Pack Rat', best((x) => x.st.found, 2), (v) => `found ${v} items`],
      ['lives', '🍀', 'Nine Lives', best((x) => x.st.close + x.st.lucky, 2), (v) => `${v} close calls`],
      ['trigger', '🔫', 'Trigger Happy', best((x) => x.st.shots, 2), (v) => `${v} bullets fired`],
      ['ghost', '👻', 'Poltergeist', best((x) => x.st.ghostPts, 30), (v) => `${v} ghost points`],
      ['first', '💀', 'Taking One for the Team', first ? { names: dead.filter((x) => x.diedAt === first).slice(0, 4).map((x) => this.name(x)), value: first } : null, (v) => `first to fall (scene ${v})`],
    ].filter((a) => a[3]).map(([k, icon, title, a, txt]) => ({ k, icon, title, names: a.names, text: txt(a.value) }));
    return { rescued: rescued.map((x) => this.pub(x)), fates: fates.slice(0, 60), more: Math.max(0, fates.length - 60), awards, reachedEnd, scenes: this.history.length, wipe: !rescued.length };
  }
  standings() {
    return [...this.ppl.values()].filter((x) => !x.npc && this.here(x))
      .sort((a, b) => b.pts - a.pts || b.st.survived - a.st.survived || (b.alive - a.alive))
      .map((x) => ({ ...this.pub(x), pts: x.pts, alive: x.alive, status: x.status, survived: x.st.survived }));
  }
  results() { return this.phase === 'over' ? this.standings().map((x) => x.id) : []; }

  // ---- public / private state ----
  sceneInfo() {
    const sc = this.r ? this.r.sc : this.phase === 'chapter' ? null : this.sceneOf();
    return sc ? { id: sc.id, title: sc.title, text: sc.text, final: !!sc.final, options: sc.options.map((o) => ({ k: o.k, icon: o.icon, label: o.label, anim: o.anim, need: o.need ? this.T.ITEMS[o.need].icon : null, help: o.help ? Object.keys(o.help).map((k) => this.T.ITEMS[k].icon).join('') : '', gain: o.gain ? [].concat(o.gain).map((k) => this.T.ITEMS[k].icon).join('') : '', heal: !!o.heal, cure: !!o.cure, hero: !!o.hero, role: o.role || null })) } : null;
  }
  common() {
    const ch = this.chapter || this.T.CHAPTERS[0];
    return {
      phase: this.phase, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      n: this.r ? this.r.n : this.idx + 1, total: this.plan.length, ghosts: !!this.s.ghosts, narrator: this.s.narrator !== false,
      chapter: { key: ch.key, day: ch.day, name: ch.name, loc: ch.loc, line: ch.line, last: ch.key === 'rescue' },
      scene: this.phase === 'chapter' ? null : this.sceneInfo(),
    };
  }
  person(x) {
    return { ...this.pub(x), alive: x.alive, status: x.status, items: x.items.map((i) => this.T.ITEMS[i.k].icon).join(''), pts: x.npc ? null : x.pts, diedAt: x.diedAt };
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
    const me = { ...this.person(x), items: x.items.map((i) => ({ k: i.k, icon: this.T.ITEMS[i.k].icon, name: this.T.ITEMS[i.k].name, n: i.n, unit: this.T.ITEMS[i.k].unit || null })), bittenNow: x.status === 'bitten' && r && x.bittenAt < r.n, inScene: !!(r && r.ids.includes(x.id)), joinedAt: x.joinedAt, st: x.st };
    const out = { ...base, me };
    if (r && this.phase === 'choose') {
      out.pick = r.picks.get(x.id) || null;
      out.locked = r.sc.options.filter((o) => this.locked(x, o)).map((o) => o.k);
      out.boost = r.sc.options.filter((o) => o.help && Object.keys(o.help).some((k) => this.has(x, k))).map((o) => o.k);
      out.gave = r.gifts.has(x.id) ? { ...r.gifts.get(x.id), to: this.name(this.ppl.get(r.gifts.get(x.id).to)) } : null;
      const others = this.living().filter((y) => y !== x);
      out.others = others.sort((a, b) => (b.status === 'bitten') - (a.status === 'bitten')).slice(0, 60).map((y) => ({ id: y.id, name: this.name(y), avatar: this.pub(y).avatar, status: y.status, medkit: this.has(y, 'medkit') }));
      out.haunt = r.haunts.get(x.id) || null;
    }
    if (r && r.outcome && (this.phase === 'outcome' || this.phase === 'board')) {
      const f = r.fates.get(x.id);
      if (f) {
        const g = r.outcome.groups.find((y) => y.k === f.o.k), fev = r.outcome.fever && r.outcome.fever.people.find((y) => y.id === x.id);
        out.mine = { fate: !x.alive && fev ? 'turned' : f.fate, cured: f.cured || !!(fev && fev.fate === 'cured'), healed: f.healed, label: f.o.label, icon: f.o.icon, line: g ? g.line : '', got: f.got ? this.T.ITEMS[f.got].icon + ' ' + this.T.ITEMS[f.got].name : null, dropped: f.dropped ? this.T.ITEMS[f.dropped].icon + ' ' + this.T.ITEMS[f.dropped].name : null, used: f.used ? this.T.ITEMS[f.used].icon : null, froze: r.froze.has(x.id), lucky: !!f.lucky,
          at: f.revealAt || 0, feverAt: fev ? fev.at : null, ms: r.outcome.ms, alive: x.alive };
      }
      const h = r.haunts.get(x.id);
      if (h) out.myHaunt = { to: this.name(this.ppl.get(h.to)), mode: h.mode, hit: !!h.hit, pts: h.hit ? (h.mode === 'bless' ? BLESS : CURSE) : 0, at: r.outcome.endAt };
      out.outMs = r.outcome.ms;
    }
    if (this.phase === 'over' && this.epilogue) {
      const f = this.epilogue.fates.find((y) => y.id === x.id);
      out.end = { line: f ? f.line : '', rescued: !!(f && f.rescued), awards: this.epilogue.awards.filter((a) => a.names.includes(this.name(x))).map((a) => ({ icon: a.icon, title: a.title })), standings: st.slice(0, 8), wipe: this.epilogue.wipe };
    }
    return out;
  }
}

module.exports = {
  key: 'zombie', name: 'Zombie Survival', min: 1, best: [4, 16], howSteps: 6, fields, defaults,
  locked: { how: 'Finish a Party Mode to unlock it.' },
  create: (room, settings) => new Zombie(room, settings),
  _test: { ITEMS, CHAPTERS, SCENARIOS, DIFF, PER_CHAPTER, TOLD },
};
