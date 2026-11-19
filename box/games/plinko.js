'use strict';
// JustDrop: a Plinko-style peg drop for the whole room.
// Each round: everyone picks where to drop their ball along the top of the board (and maybe a
// power-up), then sees where everyone else is dropping and draws ONE line (a limited amount of
// ink, 2 strokes at most) to steer balls: theirs into the jackpot, or a rival's into a bust.
// Then every ball drops at once. The physics runs here on the server (plinko-physics.js,
// deterministic), the TV plays back the recorded paths, so what you see is what scored.
// Rounds get harder: more pegs, narrower jackpots, bust slots, ×2, STEAL, bumpers, spinners,
// wind, holes, and the lines from earlier rounds stay on the board as ghost obstacles.
// Big rooms are split into tables (boards) of up to 10 players; every table gets the same board.
const PH = require('./plinko-physics');
// Per-game gear (JustGold shop): each player's ball skin rides along with their balls and drop markers.
const GEARS = require('../../public/shared/gear');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rounds', label: 'Rounds', options: opt([[3, '3 rounds'], [4, '4 rounds'], [5, '5 rounds']]) },
  { key: 'ink', label: 'Ink', options: opt([[340, 'A little'], [520, 'Normal'], [760, 'Lots']]) },
  { key: 'style', label: 'Board', options: opt([['classic', 'Classic casino'], ['neon', 'Neon arcade'], ['chaos', 'Chaos (harder!)']]) },
  { key: 'powerups', label: 'Power-ups', options: opt([[true, 'On'], [false, 'Off']]) },
  { key: 'timer', label: 'Timer', options: opt([['quick', 'Quick'], ['normal', 'Normal'], ['relaxed', 'Relaxed']]) },
];
const defaults = { rounds: 4, ink: 520, style: 'classic', powerups: true, timer: 'normal' };
const TIMES = { quick: [15, 25], normal: [20, 35], relaxed: [30, 50] };
const TABLE_MAX = 10, INTRO_MS = 4500, RELEASE_MS = 2200, AFTER_MS = 2200, SCORE_MS = 9000, SUDDEN_AIM = 15;
const POWERS = {
  sticky: { name: 'Sticky Ball', icon: '🍯', about: 'Hardly bounces: it hugs lines and rolls along them.' },
  big: { name: 'Mega Ball', icon: '🎳', about: 'Huge and heavy: it shoves other balls aside (too big for the jackpot!).' },
  twin: { name: 'Twin Drop', icon: '👯', about: 'Drop two balls side by side. Both score.' },
  eraser: { name: 'Eraser', icon: '🧽', about: 'Wipe one rival’s line off the board this round.' },
  ink: { name: 'Ink Refill', icon: '🖋️', about: '60% more ink for your line this round.' },
};
const POWER_KEYS = Object.keys(POWERS), MAX_POWERS = 3;
const TRICK_BONUS = 75, TRICK_MIN = 14, ASSIST = 0.2, SABOTAGE = 50, X2_MIN = 60;

class Drop {
  constructor(room, s) {
    this.room = room; this.s = { ...defaults, ...s };
    this.phase = 'intro'; this.round = 0; this.level = 1; this.timer = null; this.endsAt = 0;
    this.ppl = new Map(); this.tables = []; this.board = null; this.inp = new Map();
    this.run = null; this.rres = null; this.sudden = null; this.sdOrder = []; this.best = null; this.awards = null; this.dropAt = 0;
  }
  rng() { return this.room.rng(); }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  // ---- the cast ----
  seat(p) {
    if (this.ppl.has(p.id)) return;
    this.ppl.set(p.id, { id: p.id, total: 0, gain: 0, prevRank: 0, powers: [], items: [], stats: { jack: 0, bust: 0, assist: 0, sabot: 0, tricks: 0, stars: 0, bounces: 0, best: 0, style: 0 } });
    if (this.started) { // late joiner: the emptiest table
      let t = this.tables.reduce((a, b) => (b.ids.length < a.ids.length ? b : a), this.tables[0] || null);
      if (!t || t.ids.length >= TABLE_MAX) { t = { ids: [], ghosts: [] }; this.tables.push(t); }
      t.ids.push(p.id);
      if (this.s.powerups) this.give(p.id, this.randPower());
    }
  }
  start() {
    const all = this.room.list();
    for (const p of all) this.seat(p);
    const n = Math.max(1, Math.ceil(all.length / TABLE_MAX));
    this.tables = Array.from({ length: n }, () => ({ ids: [], ghosts: [] }));
    all.forEach((p, i) => this.tables[i % n].ids.push(p.id));
    if (this.s.powerups) for (const p of all) this.give(p.id, this.randPower());
    this.started = true;
    this.nextRound();
  }
  joined(p) { if (this.started) this.seat(p); }
  left() { this.maybeDone(); }
  active() { return this.room.list().filter((p) => this.ppl.has(p.id) && (p.bot || p.sockets > 0)); }
  tableOf(id) { return this.tables.find((t) => t.ids.includes(id)) || null; }
  randPower() { return POWER_KEYS[Math.floor(this.rng() * POWER_KEYS.length)]; }
  give(id, k) { const P = this.ppl.get(id); if (!P || !POWERS[k] || P.powers.length >= MAX_POWERS) return false; P.powers.push(k); P.stats.stars += 0; return true; }
  levelFor(r) { const N = this.s.rounds; return N <= 1 ? 1 : Math.round(1 + ((r - 1) * 4) / (N - 1)); }
  // ---- a round: intro → aim → draw → drop → score ----
  nextRound() {
    if (this.round >= this.s.rounds) return this.finish();
    this.round++; this.level = this.levelFor(this.round);
    this.board = PH.makeBoard(this.level, () => this.rng(), { style: this.s.style, powerups: !!this.s.powerups });
    this.inp = new Map(); this.run = null; this.rres = null;
    this.phase = 'intro'; this.room.fx('round', { round: this.round });
    this.setTimer(INTRO_MS, () => this.aim());
  }
  input(id) { let i = this.inp.get(id); if (!i) { i = { x: null, locked: false, auto: false, power: null, strokes: [], done: false, target: null }; this.inp.set(id, i); } return i; }
  aim() {
    this.phase = 'aim'; this.room.fx('aim');
    const secs = this.sudden ? SUDDEN_AIM : TIMES[this.s.timer][0];
    this.setTimer(secs * 1000, () => this.endAim());
    for (const p of this.players()) if (p.bot) this.room.after(1200 + this.rng() * Math.min(6000, secs * 400), () => this.botAim(p));
  }
  players() { return this.room.list().filter((p) => this.ppl.has(p.id) && (!this.sudden || this.sudden.ids.includes(p.id))); }
  endAim() {
    if (this.phase !== 'aim') return;
    for (const p of this.players()) { const i = this.input(p.id); if (!i.locked) { i.x = i.x == null ? Math.round(150 + this.rng() * 700) : i.x; i.locked = true; i.auto = true; i.power = null; } }
    // spend the power-ups people picked
    for (const p of this.players()) { const i = this.input(p.id), P = this.ppl.get(p.id); if (i.power) { const at = P.powers.indexOf(i.power); if (at >= 0) P.powers.splice(at, 1); else i.power = null; } }
    if (this.sudden) return this.drop();
    this.phase = 'draw'; this.room.fx('draw');
    this.setTimer(TIMES[this.s.timer][1] * 1000, () => this.drop());
    for (const p of this.players()) if (p.bot) this.room.after(2000 + this.rng() * Math.min(9000, TIMES[this.s.timer][1] * 300), () => this.botDraw(p));
  }
  inkFor(id) { const i = this.inp.get(id); return Math.round(this.s.ink * (i && i.power === 'ink' ? 1.6 : 1)); }
  maybeDone() {
    if (this.phase === 'aim') { if (this.players().filter((p) => p.bot || p.sockets > 0).every((p) => this.input(p.id).locked)) this.endAim(); }
    else if (this.phase === 'draw') { if (this.players().filter((p) => p.bot || p.sockets > 0).every((p) => this.input(p.id).done)) this.drop(); }
  }
  // Every table's balls drop at once.
  drop() {
    if (this.phase !== 'draw' && this.phase !== 'aim') return;
    this.phase = 'drop'; this.room.fx('drop');
    const tabs = this.sudden ? [{ ids: this.sudden.ids, ghosts: [] }] : this.tables;
    let frames = 0;
    this.run = tabs.map((t, ti) => {
      const ids = t.ids.filter((id) => this.ppl.has(id) && this.room.get(id));
      const erased = new Set();
      for (const id of ids) { const i = this.input(id); if (i.power === 'eraser' && i.target && ids.includes(i.target) && i.target !== id) erased.add(i.target); }
      const lines = [];
      for (const g of t.ghosts) lines.push({ pts: g.pts, owner: g.owner, ghost: true });
      for (const id of ids) if (!erased.has(id)) for (const st of this.input(id).strokes) lines.push({ pts: st, owner: id, ghost: false });
      const balls = [];
      for (const id of ids) {
        const i = this.input(id); if (i.x == null) continue;
        if (i.power === 'twin') { balls.push({ owner: id, x: i.x - 28, k: 0 }); balls.push({ owner: id, x: i.x + 28, k: 1 }); }
        else balls.push({ owner: id, x: i.x, k: 0, big: i.power === 'big', sticky: i.power === 'sticky' });
      }
      const sim = PH.simulate(this.board, lines, balls);
      frames = Math.max(frames, sim.frames);
      return { ti, ids, erased: [...erased], sim, lines: ids.map((id) => ({ id, strokes: this.input(id).strokes, erased: erased.has(id) })).filter((l) => l.strokes.length) };
    });
    this.dropAt = this.room.now();
    const ms = RELEASE_MS + Math.ceil((frames / PH.FPS) * 1000) + AFTER_MS;
    this.setTimer(ms, () => this.score());
  }
  // ---- scoring ----
  score() {
    if (this.phase !== 'drop') return;
    const before = this.standings().map((r) => r.id), rankOf = new Map(before.map((id, i) => [id, i + 1]));
    const R = new Map(); const row = (id) => { let r = R.get(id); if (!r) { r = { id, items: [], gain: 0, x2: false, steal: 0 }; R.set(id, r); } return r; };
    const add = (id, t, v) => { if (!this.ppl.has(id)) return; const r = row(id); r.items.push({ t, v }); r.gain += v; };
    let trick = null;
    if (this.sudden) {
      const order = this.run[0].sim.balls.slice().sort((a, b) => this.board.slots[b.slot].v - this.board.slots[a.slot].v || a.landF - b.landF || String(a.owner).localeCompare(String(b.owner)));
      this.sdOrder = [...new Set(order.map((b) => b.owner))];
      this.rres = { sudden: true, order: order.map((b) => ({ id: b.owner, name: this.room.name(b.owner), slot: this.board.slots[b.slot].label })) };
      this.phase = 'score'; this.room.fx('suddenWin', { id: this.sdOrder[0] });
      return this.setTimer(6500, () => this.end());
    }
    for (const T of this.run) {
      const { sim } = T;
      const bySlot = new Map(); for (const b of sim.balls) { if (!bySlot.has(b.slot)) bySlot.set(b.slot, new Set()); bySlot.get(b.slot).add(b.owner); }
      // star pegs → power-ups
      for (const st of sim.stars) { const P = this.ppl.get(st.owner); if (!P) continue; P.stats.stars++; if (this.give(st.owner, this.randPower())) add(st.owner, '⭐ Star peg: power-up!', 0); else add(st.owner, '⭐ Star peg', 25); }
      for (const b of sim.balls) {
        const sl = this.board.slots[b.slot], P = this.ppl.get(b.owner); if (!P) continue;
        const shared = bySlot.get(b.slot).size >= 2;
        P.stats.bounces += b.pegs + b.bumps + b.spins + b.walls;
        b.style = PH.style(b, sl);
        let base = 0;
        if (sl.k === 'pts' || sl.k === 'jack') { base = sl.v; add(b.owner, sl.k === 'jack' ? `💰 JACKPOT ${sl.v}` : `Slot ${sl.v}`, sl.v); if (sl.k === 'jack') P.stats.jack++; if (shared) add(b.owner, '🤝 Shared slot combo', Math.round(sl.v / 2)); }
        else if (sl.k === 'bust') { base = sl.v; P.stats.bust++; const loss = shared ? Math.round(sl.v / 2) : sl.v; add(b.owner, shared ? '💥 Bust (shared, half off)' : '💥 BUST', loss); }
        else if (sl.k === 'x2') { row(b.owner).x2 = true; add(b.owner, '✖️2 slot', 0); }
        else if (sl.k === 'steal') { row(b.owner).steal++; }
        else if (sl.k === 'gift') { base = sl.v; add(b.owner, '🎁 Gift slot', sl.v); if (!this.give(b.owner, this.randPower())) add(b.owner, '🎁 (pockets full) bonus', 50); }
        P.stats.best = Math.max(P.stats.best, base);
        // lines that touched this ball pay their owners
        for (const o of b.touched) {
          if (!this.ppl.has(o)) continue;
          if (base > 0) { const v = Math.max(5, Math.round(base * ASSIST)); add(o, o === b.owner ? '✏️ Your line steered you' : `✏️ Assist: ${this.room.name(b.owner)}`, v); this.ppl.get(o).stats.assist += v; }
          else if (sl.k === 'bust' && o !== b.owner) { add(o, `😈 Sabotage: ${this.room.name(b.owner)}`, SABOTAGE); this.ppl.get(o).stats.sabot++; }
        }
        if (!trick || b.style > trick.style) trick = { style: b.style, id: b.owner, ti: T.ti, ball: sim.balls.indexOf(b), base, slot: sl.label };
        // the drop of the night
        const hl = b.style * (base > 0 ? 1 + base / 300 : 0.6);
        if (!this.best || hl > this.best.hl) this.best = { hl, round: this.round, id: b.owner, name: this.room.name(b.owner), color: (this.room.get(b.owner) || {}).color, slot: sl.label, k: sl.k, board: this.board, lines: this.linesFor(T), path: b.path, r: b.r };
      }
    }
    if (trick && trick.style >= TRICK_MIN) { add(trick.id, '🎪 Trick shot of the round', TRICK_BONUS); this.ppl.get(trick.id).stats.tricks++; this.ppl.get(trick.id).stats.style = Math.max(this.ppl.get(trick.id).stats.style, trick.style); } else trick = null;
    // ×2 doubles the round so far
    for (const r of R.values()) if (r.x2) { const v = Math.max(X2_MIN, r.gain * 2) - r.gain; r.items.push({ t: '✖️2 Round doubled', v }); r.gain += v; }
    // steals rob the leader (before this round)
    for (const r of R.values()) for (let k = 0; k < r.steal; k++) {
      const victim = before.find((id) => id !== r.id && this.ppl.has(id) && this.ppl.get(id).total > 0);
      if (!victim) { r.items.push({ t: '🦹 Steal (nobody to rob)', v: 60 }); r.gain += 60; continue; }
      const amt = Math.max(40, Math.min(250, Math.round(this.ppl.get(victim).total * 0.15)));
      r.items.push({ t: `🦹 Stole from ${this.room.name(victim)}`, v: amt }); r.gain += amt;
      const vr = row(victim); vr.items.push({ t: `🦹 Robbed by ${this.room.name(r.id)}`, v: -amt }); vr.gain -= amt;
    }
    for (const [id, P] of this.ppl) { const r = R.get(id); P.prevRank = rankOf.get(id) || 0; P.gain = r ? r.gain : 0; P.items = r ? r.items : []; P.total = Math.max(0, P.total + P.gain); }
    // ghosts: this round's lines stay on their table for the rest of the game (faded)
    for (const T of this.run) { const t = this.tables[T.ti]; if (!t) continue; for (const l of T.lines) if (!l.erased) for (const st of l.strokes) t.ghosts.push({ pts: st, owner: l.id, round: this.round }); }
    // catch-up: last place gets a power-up
    if (this.s.powerups && this.round < this.s.rounds) { const st = this.standings(); const last = st[st.length - 1]; if (st.length > 1 && last && this.give(last.id, this.randPower())) { const P = this.ppl.get(last.id); P.items.push({ t: '🆘 Catch-up power-up', v: 0 }); } }
    this.rres = { trick: trick ? { id: trick.id, name: this.room.name(trick.id), ti: trick.ti, ball: trick.ball, style: trick.style, slot: trick.slot } : null };
    this.phase = 'score'; this.room.fx('score');
    if (trick) this.room.fx('trick', { id: trick.id });
    this.setTimer(SCORE_MS, () => this.nextRound());
  }
  linesFor(T) { const t = this.tables[T.ti] || { ghosts: [] }; return { ghosts: t.ghosts.map((g) => ({ p: g.pts, c: this.color(g.owner) })), lines: T.lines.filter((l) => !l.erased).map((l) => ({ p: l.strokes, c: this.color(l.id) })) }; }
  color(id) { const p = this.room.get(id); return p ? p.color : '#888'; }
  gear(id) { return GEARS.gearSet(this.room.get(id), 'plinko'); } // { ball: value } (default 'classic')
  // ---- the end (with a sudden-death drop for a tie at the top) ----
  finish() {
    const st = this.standings();
    if (st.length >= 2 && st[0].total === st[1].total && !this.sudden && !this.sdOrder.length) {
      const ids = st.filter((r) => r.total === st[0].total).map((r) => r.id).slice(0, TABLE_MAX);
      this.sudden = { ids }; this.round = this.s.rounds; this.level = 5;
      this.board = PH.makeBoard(5, () => this.rng(), { style: this.s.style, powerups: false, sudden: true });
      this.inp = new Map(); this.run = null; this.rres = null;
      this.phase = 'intro'; this.room.fx('sudden');
      return this.setTimer(INTRO_MS, () => this.aim());
    }
    this.end();
  }
  end() {
    this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.run = null;
    this.awards = this.makeAwards();
    this.room.fx('win', { id: (this.standings()[0] || {}).id });
  }
  makeAwards() {
    const out = [], list = [...this.ppl.values()].filter((P) => this.room.get(P.id));
    const top = (f, min = 1) => { let b = null; for (const P of list) { const v = f(P); if (v >= min && (!b || v > b.v)) b = { P, v }; } return b; };
    const mk = (icon, title, f, why, min) => { const b = top(f, min); if (b) out.push({ icon, title, id: b.P.id, name: this.room.name(b.P.id), why: why(b.v) }); };
    mk('💰', 'High Roller', (P) => P.stats.jack, (v) => `${v} jackpot${v > 1 ? 's' : ''}`);
    mk('🎪', 'Trick Shot Artist', (P) => P.stats.tricks, (v) => `${v} trick-shot award${v > 1 ? 's' : ''}`);
    mk('🤝', 'Helping Hand', (P) => P.stats.assist, (v) => `${v} points from lines`, 20);
    mk('😈', 'Saboteur', (P) => P.stats.sabot, (v) => `sent ${v} ball${v > 1 ? 's' : ''} into a bust`);
    mk('💥', 'Bust Magnet', (P) => P.stats.bust, (v) => `${v} bust${v > 1 ? 's' : ''}`, 2);
    mk('⭐', 'Star Collector', (P) => P.stats.stars, (v) => `${v} star peg${v > 1 ? 's' : ''}`);
    mk('🏓', 'Pinball Wizard', (P) => P.stats.bounces, (v) => `${v} bounces`, 20);
    return out.slice(0, 6);
  }
  next() {
    if (this.phase === 'intro') this.aim();
    else if (this.phase === 'aim') this.endAim();
    else if (this.phase === 'draw') this.drop();
    else if (this.phase === 'drop') this.score();
    else if (this.phase === 'score') { if (this.rres && this.rres.sudden) this.end(); else this.nextRound(); }
  }
  standings() {
    const sd = (id) => { const i = this.sdOrder.indexOf(id); return i < 0 ? 99 : i; };
    return [...this.ppl.values()].filter((P) => this.room.get(P.id)).map((P) => { const p = this.room.get(P.id); return { id: P.id, name: p.name, avatar: p.avatar, color: p.color, total: P.total, gain: P.gain, prevRank: P.prevRank }; })
      .sort((a, b) => b.total - a.total || sd(a.id) - sd(b.id) || a.name.localeCompare(b.name));
  }
  // Party points: player ids best-first once the game is over.
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }
  // ---- phones ----
  act(p, m) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'Unknown move.' };
    if (!this.ppl.has(p.id)) return { ok: false, error: 'You joined mid-round: you’re in from the next one!' };
    const inRound = this.players().some((q) => q.id === p.id);
    if (m.op === 'aim') {
      if (this.phase !== 'aim' || !inRound) return { ok: false, error: 'Not now.' };
      const x = Number(m.x); if (typeof m.x !== 'number' || !Number.isFinite(x)) return { ok: false, error: 'Pick a spot on the board.' };
      const i = this.input(p.id); i.x = Math.round(Math.max(PH.BIG_R + 30, Math.min(PH.W - PH.BIG_R - 30, x)));
      if (m.power != null && m.power !== '') {
        if (this.sudden || !POWERS[m.power] || !this.ppl.get(p.id).powers.includes(m.power)) return { ok: false, error: 'You don’t have that power-up.' };
        i.power = m.power;
      } else i.power = null;
      i.locked = m.lock !== false; i.auto = false;
      this.maybeDone(); return { ok: true, x: i.x };
    }
    if (m.op === 'line') {
      if (this.phase !== 'draw' || !inRound) return { ok: false, error: 'Not now.' };
      const i = this.input(p.id);
      const c = PH.cleanStrokes(m.strokes, this.inkFor(p.id)); if (!c.ok) return c;
      if (m.target != null) {
        const t = this.tableOf(p.id);
        if (i.power !== 'eraser' || typeof m.target !== 'string' || m.target === p.id || !t || !t.ids.includes(m.target)) return { ok: false, error: 'You can’t erase that.' };
        i.target = m.target;
      }
      i.strokes = c.strokes; i.done = m.done === true;
      this.maybeDone(); return { ok: true, strokes: c.strokes, ink: this.inkFor(p.id) };
    }
    return { ok: false, error: 'Unknown move.' };
  }
  // ---- bots: sensible drops and lines (they test ideas with the same physics) ----
  slotWorth(sl) { return sl.k === 'pts' || sl.k === 'jack' ? sl.v : sl.k === 'bust' ? sl.v * 1.4 : sl.k === 'x2' ? 160 : sl.k === 'steal' ? 140 : sl.k === 'gift' ? 120 : 0; }
  botGhosts(id) { const t = this.sudden ? null : this.tableOf(id); return t ? t.ghosts.map((g) => ({ pts: g.pts, owner: g.owner, ghost: true })) : []; }
  botAim(p) {
    if (this.phase !== 'aim' || !this.ppl.has(p.id) || this.input(p.id).locked) return;
    const ghosts = this.botGhosts(p.id), tries = [];
    for (let k = 0; k < 8; k++) {
      const x = Math.round(60 + ((k + this.rng()) / 8) * 880);
      const sim = PH.simulate(this.board, ghosts, [{ owner: p.id, x }], { record: false, maxSteps: 240 * 9 });
      tries.push({ x, v: this.slotWorth(this.board.slots[sim.balls[0].slot]) + (this.rng() - 0.5) * 120 });
    }
    tries.sort((a, b) => b.v - a.v);
    const pick = tries[Math.floor(this.rng() * Math.min(3, tries.length))];
    const P = this.ppl.get(p.id), i = this.input(p.id);
    i.x = pick.x; i.locked = true; i.power = null;
    if (!this.sudden && P.powers.length && this.rng() < 0.6) i.power = P.powers[Math.floor(this.rng() * P.powers.length)];
    this.maybeDone();
  }
  botDraw(p) {
    if (this.phase !== 'draw' || !this.ppl.has(p.id) || this.input(p.id).done) return;
    const i = this.input(p.id), ink = this.inkFor(p.id), ghosts = this.botGhosts(p.id), t = this.tableOf(p.id);
    // eraser: wipe the leader's line on this table
    if (i.power === 'eraser' && t) { const lead = this.standings().find((r) => r.id !== p.id && t.ids.includes(r.id)); if (lead) i.target = lead.id; }
    const mine = { owner: p.id, x: i.x };
    const evalLine = (pts) => { const sim = PH.simulate(this.board, ghosts.concat(pts ? [{ pts, owner: p.id }] : []), [mine], { record: false, maxSteps: 240 * 9 }); return this.slotWorth(this.board.slots[sim.balls[0].slot]); };
    let best = { v: evalLine(null), pts: null };
    const len = Math.min(ink * 0.9, 260);
    for (let k = 0; k < 5; k++) {
      const y = 320 + this.rng() * 600, dir = this.rng() < 0.5 ? -1 : 1, ang = 0.35 + this.rng() * 0.5;
      const cx = Math.max(60, Math.min(940, i.x + (this.rng() - 0.5) * 140)), dx = Math.cos(ang) * len / 2 * dir, dy = Math.sin(ang) * len / 2;
      const pts = [[Math.round(cx - dx), Math.round(y - dy)], [Math.round(cx + dx), Math.round(y + dy)]];
      const c = PH.cleanStrokes([pts], ink); if (!c.ok || !c.strokes.length) continue;
      const v = evalLine(c.strokes[0]) + (this.rng() - 0.5) * 60; if (v > best.v) best = { v, pts: c.strokes[0] };
    }
    if (!best.pts) { const c = PH.cleanStrokes([[[i.x - 90, 700], [i.x + 90, 760]]], ink); best.pts = c.ok && c.strokes[0] ? c.strokes[0] : null; }
    i.strokes = best.pts ? [best.pts] : []; i.done = true;
    this.maybeDone();
  }
  // ---- what the screens get ----
  tableTv(T, full) {
    const t = this.tables[T.ti] || { ghosts: [] };
    return {
      ids: T.ids, erased: T.erased,
      ghosts: (this.sudden ? [] : t.ghosts).filter((g) => g.round < this.round || this.phase !== 'score').map((g) => ({ p: g.pts, c: this.color(g.owner) })),
      lines: T.lines.map((l) => ({ id: l.id, p: l.strokes, c: this.color(l.id), erased: l.erased })),
      balls: T.sim.balls.map((b) => ({ id: b.owner, c: this.color(b.owner), gear: this.gear(b.owner), r: b.r, big: b.big, sticky: b.sticky, slot: b.slot, landF: b.landF, path: full ? b.path : b.path.slice(-2) })),
      stars: T.sim.stars,
    };
  }
  tv() {
    const ph = this.phase, now = this.room.now();
    const base = { phase: ph, round: this.round, of: this.s.rounds, level: this.level, style: this.s.style, endsIn: this.endsAt ? Math.max(0, this.endsAt - now) : 0, sudden: this.sudden ? this.sudden.ids.map((id) => ({ id, name: this.room.name(id), color: this.color(id), avatar: (this.room.get(id) || {}).avatar })) : null };
    const st = this.standings().map((r, i) => ({ ...r, rank: i + 1 }));
    if (ph === 'over') return { ...base, standings: st, awards: this.awards || [], best: this.best ? { name: this.best.name, color: this.best.color, slot: this.best.slot, k: this.best.k, round: this.best.round, board: this.best.board, lines: this.best.lines, path: this.best.path, r: this.best.r } : null, sdWinner: this.sdOrder.length ? this.room.name(this.sdOrder[0]) : null };
    const who = this.players();
    const waiting = ph === 'aim' ? who.filter((p) => !this.input(p.id).locked) : ph === 'draw' ? who.filter((p) => !this.input(p.id).done) : [];
    const out = { ...base, board: this.board, standings: st.slice(0, 12), count: st.length, players: who.length,
      waiting: waiting.slice(0, 16).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color })), waitingN: waiting.length };
    const tabs = this.sudden ? [{ ids: this.sudden.ids, ghosts: [] }] : this.tables;
    if (ph === 'intro' || ph === 'aim' || ph === 'draw') {
      out.tables = tabs.map((t) => ({ ids: t.ids, ghosts: this.sudden ? [] : t.ghosts.map((g) => ({ p: g.pts, c: this.color(g.owner) })),
        drops: t.ids.filter((id) => this.room.get(id)).map((id) => { const i = this.inp.get(id); const p = this.room.get(id); return { id, name: p.name, c: p.color, gear: this.gear(id), av: p.avatar, locked: !!(i && i.locked), x: ph === 'draw' && i ? i.x : null, power: ph === 'draw' && i && i.power ? POWERS[i.power].icon : null }; }) }));
    }
    if ((ph === 'drop' || ph === 'score') && this.run) {
      out.t0Ago = now - this.dropAt; out.release = RELEASE_MS;
      out.tables = this.run.map((T) => this.tableTv(T, ph === 'drop' || (this.rres && this.rres.trick && this.rres.trick.ti === T.ti)));
      if (ph === 'score') {
        out.results = this.rres;
        out.gains = st.filter((r) => r.gain || (this.ppl.get(r.id).items || []).length).slice(0, 12).map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, color: r.color, gain: r.gain, items: (this.ppl.get(r.id).items || []).slice(0, 5) }));
      }
    }
    return out;
  }
  view(p) {
    const P = this.ppl.get(p.id), ph = this.phase, i = this.inp.get(p.id), now = this.room.now();
    const st = this.standings(), rank = st.findIndex((r) => r.id === p.id) + 1;
    const base = { phase: ph, style: this.s.style, round: this.round, of: this.s.rounds, level: this.level, endsIn: this.endsAt ? Math.max(0, this.endsAt - now) : 0, total: P ? P.total : 0, rank, count: st.length,
      powers: P ? P.powers.map((k) => ({ k, ...POWERS[k] })) : [], inRound: this.players().some((q) => q.id === p.id), sudden: !!this.sudden, gear: this.gear(p.id) };
    if (!P) return { ...base, spectator: true };
    if (ph === 'over') { const aw = (this.awards || []).filter((a) => a.id === p.id); return { ...base, awards: aw, winner: st[0] ? st[0].name : '', top: st.slice(0, 5).map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, total: r.total })) }; }
    const t = this.sudden ? { ids: this.sudden.ids, ghosts: [] } : this.tableOf(p.id) || { ids: [p.id], ghosts: [] };
    const out = { ...base, board: this.board, ghosts: t.ghosts.filter((g) => !(ph === 'score' && g.round === this.round)).map((g) => ({ p: g.pts, c: this.color(g.owner) })), ink: this.inkFor(p.id), me: { x: i ? i.x : null, locked: !!(i && i.locked), power: i ? i.power : null, strokes: i ? i.strokes : [], done: !!(i && i.done), target: i ? i.target : null, auto: !!(i && i.auto) } };
    if (ph === 'draw') out.drops = t.ids.filter((id) => this.room.get(id)).map((id) => { const q = this.inp.get(id), pl = this.room.get(id); return { id, name: pl.name, av: pl.avatar, c: pl.color, gear: this.gear(id), x: q ? q.x : null, me: id === p.id }; });
    if ((ph === 'drop' || ph === 'score') && this.run) {
      const T = this.run.find((r) => r.ids.includes(p.id));
      if (T) {
        out.mine = T.sim.balls.filter((b) => b.owner === p.id).map((b) => ({ path: ph === 'drop' ? b.path : b.path.slice(-2), slot: b.slot, landF: b.landF, r: b.r }));
        out.lines = T.lines.filter((l) => !l.erased).map((l) => ({ p: l.strokes, c: this.color(l.id) }));
        out.erasedMine = T.erased.includes(p.id);
      }
      out.t0Ago = now - this.dropAt; out.release = RELEASE_MS;
      if (ph === 'score') { out.gain = P.gain; out.items = P.items.slice(0, 8); out.trick = this.rres && this.rres.trick && this.rres.trick.id === p.id; out.sdOrder = this.rres && this.rres.sudden ? this.rres.order : null; }
    }
    return out;
  }
}
module.exports = {
  key: 'plinko', name: 'JustDrop', min: 1, best: [2, 10], howSteps: 6, fields, defaults,
  show: { facts: false }, // intro cutscene before the game (public/box/intros/plinko.js)
  locked: { how: 'Finish a game of Blackjack Night to unlock it.' },
  create: (room, settings) => new Drop(room, settings),
  _test: { POWERS, TIMES, TABLE_MAX, PH },
};
