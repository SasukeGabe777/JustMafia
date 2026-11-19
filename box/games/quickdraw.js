'use strict';
// Quick Draw: a fast western reflex showdown (5–8 minutes) for JustGameBox.
// Rounds of short challenges, played on a big tap pad on every phone:
//   draw   DRAW! duels: wait for the signal, tap first; a false start costs you. Bracket duels
//          (4–8 gunslingers) or a free-for-all of three shots (2–3, or 9+).
//   flash  Lantern: tap only when the lantern on the TV turns GREEN, never on the decoys.
//   count  Chicken Run: tap your clicker for every 🐔 crossing Main Street (not the decoys).
//   shake  Stampede: shake the phone (or mash the pad) to gallop your horse to the finish.
//   copy   Copycat: repeat the drum rhythm the TV plays.
// FAIR TIMING: the server picks every signal time in advance (server clock). The TV and phones
// estimate the server clock with a few pings (op 'ping' / host 'qdPing') and show the signal at
// that moment; phones report each tap's time on the server clock, so network lag never decides
// a duel. Claimed times are clamped to what is physically possible (≤ arrival, ≥ arrival − 800 ms,
// ≥ 100 ms after a signal). Points by rank each challenge, a podium streak bonus, −50 for every
// false start, double points in the final showdown, and awards at the end.
// Per-game gear (JustGold shop): each duellist's hat (pub() carries it to the TV and phones).
const GEARS = require('../../public/shared/gear');
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rounds', label: 'Challenges', options: opt([[5, '5 challenges (≈5 min)'], [7, '7 challenges (≈6 min)'], [10, '10 challenges (≈8 min)']]) },
  { key: 'mix', label: 'Challenge mix', options: opt([['all', 'Everything'], ['still', 'No shaking'], ['duel', 'DRAW! duels only']]) },
  { key: 'pace', label: 'Difficulty', options: opt([['easy', '🟢 Greenhorn (easy)'], ['normal', '🟡 Gunslinger'], ['sharp', '🔴 Sharpshooter (hard)']]) },
];
const defaults = { rounds: 7, mix: 'all', pace: 'normal' };
const KINDS = ['draw', 'flash', 'count', 'shake', 'copy'];

const INTRO_MS = 4500, RESULT_MS = 6500;
const ARM_MS = 1800, DRAW_WIN = 2000, SHOT_MS = 2600, FFA_SHOTS = 3;
const MAX_LAG = 800, MIN_RT = 100, MISS_MS = 1000, FLASH_MISS = 1200;
const FALSE_PEN = 50;
const COUNT_RUN = 10500, LOCK_MS = 6500;
const SHAKE_COUNT = 3500, SHAKE_MS = 15000, MAX_RATE = 12, TICK = 250;
const RANK_PTS = [500, 400, 330, 270, 220, 180, 150, 125, 110, 100];
const PACE = {
  easy: { wait: [1800, 4000], flashDur: 950, decoys: [1, 3], chickens: [5, 8], others: [2, 3], cross: [2200, 3600], target: 30, beats: [4, 5], grid: [300, 600], words: false, rooster: false },
  normal: { wait: [1500, 4500], flashDur: 750, decoys: [2, 4], chickens: [8, 13], others: [3, 5], cross: [1700, 3000], target: 40, beats: [5, 6], grid: [250, 500, 750], words: false, rooster: false },
  sharp: { wait: [1200, 5500], flashDur: 560, decoys: [2, 5], chickens: [11, 17], others: [4, 7], cross: [1300, 2500], target: 50, beats: [6, 7], grid: [250, 375, 500, 750], words: true, rooster: true },
};
const DECOYS = [['#e8323c', 'RED'], ['#ffc61a', 'YELLOW'], ['#2f7bff', 'BLUE'], ['#a34bff', 'PURPLE'], ['#ff8a1f', 'ORANGE']];
const GREEN = ['#22d35b', 'GREEN'];
const JIBES = {
  family: ['Easy there, partner!', 'Whoa, Nelly!', 'Hold your horses!', 'Too quick on the trigger!'],
  grown: ['Shot your own boot!', 'Trigger-happy much?', 'The tumbleweed saw that.', 'Yeehaw… oops.'],
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);

// Rhythm accuracy 0..1: each expected gap vs the gap the player tapped (relative error, capped),
// missing gaps count as fully wrong and extra taps cost a little.
function rhythmAcc(gaps, taps) {
  if (!Array.isArray(taps) || taps.length < 2) return 0;
  const got = []; for (let i = 1; i < taps.length; i++) got.push(taps[i] - taps[i - 1]);
  let err = 0;
  for (let i = 0; i < gaps.length; i++) err += i < got.length ? Math.min(1, Math.abs(got[i] - gaps[i]) / Math.max(200, gaps[i])) : 1;
  const extra = Math.max(0, got.length - gaps.length);
  return clamp(1 - err / gaps.length - extra * 0.15, 0, 1);
}

class Game {
  constructor(room, s) {
    this.room = room;
    const pick = (f, v) => (f.options.some((o) => o.value === v) ? v : defaults[f.key]);
    this.s = {}; for (const f of fields) this.s[f.key] = pick(f, s ? s[f.key] : undefined);
    this.P = PACE[this.s.pace] || PACE.normal;
    this.phase = 'intro'; this.n = 0; this.seq = 0; this.c = null; this.lineup = [];
    this.points = new Map(); this.stats = new Map(); this.timer = null; this.tick = null; this.endsAt = 0;
    this.final = null; this.history = [];
  }
  now() { return this.room.now(); }
  rnd(a, b) { return a + this.room.rng() * (b - a); }
  ri(a, b) { return Math.floor(this.rnd(a, b + 1)); }
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.room.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.timer = this.room.after(Math.max(0, ms), fn); }
  stat(id) { let s = this.stats.get(id); if (!s) { s = { best: null, falses: 0, wins: 0, streak: 0, bestStreak: 0, countErr: null, copy: null, shake: null, played: 0 }; this.stats.set(id, s); } return s; }
  family() { return this.room.family !== false; } // family-safe unless the room says otherwise
  active() { return this.room.list().filter((p) => p.bot || p.sockets > 0); }
  pub(id) { const p = this.room.get(id); return p ? { id, name: p.name, avatar: p.avatar, color: p.color, gear: GEARS.gearSet(p, 'quickdraw') } : { id, name: '—', avatar: '👻', color: '#888' }; }
  // A tap time on the server clock: the phone's claim, clamped to what is physically possible.
  claim(t) { const R = this.now(); return fin(t) ? clamp(t, R - MAX_LAG, R) : R; }

  // ---------- lineup ----------
  buildLineup() {
    const N = this.s.rounds, mix = this.s.mix;
    if (mix === 'duel') return Array(N).fill('draw');
    const pool = KINDS.filter((k) => k !== 'draw' && !(mix === 'still' && k === 'shake'));
    const out = ['draw'];
    let bag = [];
    while (out.length < N - 1) {
      if (!bag.length) bag = this.shuffle([...pool, 'draw']);
      let i = bag.findIndex((k) => k !== out[out.length - 1] && !(out.length === N - 2 && k === 'draw'));
      if (i < 0) i = 0;
      out.push(bag.splice(i, 1)[0]);
    }
    if (N > 1) out.push('draw'); // the final showdown
    return out;
  }

  start() {
    for (const p of this.room.list()) { this.points.set(p.id, 0); this.stat(p.id); }
    this.lineup = this.buildLineup();
    this.nextChallenge();
  }
  joined(p) { if (!this.points.has(p.id)) this.points.set(p.id, 0); this.stat(p.id); }
  left() { this.checkDone(); }

  nextChallenge() {
    this.room.cancel(this.tick); this.tick = null;
    if (this.n >= this.lineup.length) return this.end();
    this.n++;
    const kind = this.lineup[this.n - 1];
    this.c = { kind, id: ++this.seq, mult: this.n === this.lineup.length && this.lineup.length > 1 ? 2 : 1, roster: this.active().map((p) => p.id), step: 'intro', res: null, fs: new Map() };
    this.phase = 'intro'; this.endsAt = this.now() + INTRO_MS;
    this.room.fx('intro', { kind, final: this.c.mult > 1 });
    this.setTimer(INTRO_MS, () => this.begin());
  }
  begin() {
    const c = this.c; if (!c || this.phase !== 'intro') return;
    this.phase = 'play'; this.endsAt = 0;
    ({ draw: () => this.setupDraw(), flash: () => this.setupFlash(), count: () => this.setupCount(), shake: () => this.setupShake(), copy: () => this.setupCopy() })[c.kind]();
  }
  addFalse(id) { const c = this.c; c.fs.set(id, (c.fs.get(id) || 0) + 1); this.stat(id).falses++; }
  // A bot's tap at server time `at` (it is scheduled for that moment, so `at` is also the arrival).
  botAt(at, fn) { this.room.after(Math.max(0, at - this.now()), () => { if (this.c && this.phase === 'play') fn(); }); }

  // ---------- DRAW! ----------
  setupDraw() {
    const c = this.c, ids = this.shuffle(c.roster);
    c.mode = ids.length >= 4 && ids.length <= 8 ? 'duel' : 'ffa';
    c.best = new Map(); // id -> best valid ms this challenge
    if (c.mode === 'duel') { c.alive = ids; c.outs = []; c.heat = 0; c.heats = Math.ceil(Math.log2(ids.length)); }
    else { c.shot = 0; c.sum = new Map(ids.map((id) => [id, 0])); c.shots = []; }
    this.heat();
  }
  heat() {
    const c = this.c, now = this.now();
    c.step = 'standoff'; c.taps = new Map();
    c.armAt = now + ARM_MS; c.goAt = c.armAt + Math.round(this.rnd(...this.P.wait)); c.endAt = c.goAt + DRAW_WIN;
    if (c.mode === 'duel') {
      c.heat++; c.pairs = []; c.bye = null;
      const a = c.alive.slice();
      if (a.length % 2) c.bye = a.splice(Math.floor(this.room.rng() * a.length), 1)[0];
      for (let i = 0; i < a.length; i += 2) c.pairs.push({ a: a[i], b: a[i + 1], win: null });
      c.inHeat = new Set(a);
    } else { c.shot++; c.inHeat = new Set(c.roster); }
    this.endsAt = c.endAt;
    this.room.fx('standoff', { heat: c.heat || c.shot });
    this.room.after(c.goAt - now, () => { if (this.c === c && c.step === 'standoff') this.room.fx('go'); });
    this.setTimer(c.endAt - now, () => this.resolveHeat());
    for (const id of c.inHeat) {
      const p = this.room.get(id); if (!p || !p.bot) continue;
      const jumpy = this.room.rng() < 0.07;
      const at = jumpy ? c.goAt - this.rnd(150, 1100) : c.goAt + this.rnd(190, 480);
      this.botAt(Math.max(c.armAt + 50, at), () => this.drawTap(p, at, c.id));
    }
  }
  drawTap(p, t, cid) {
    const c = this.c;
    if (!c || c.kind !== 'draw' || c.step !== 'standoff' || cid !== c.id) return { ok: false, quiet: true };
    if (!c.inHeat.has(p.id)) return { ok: false, quiet: true, watching: true }; // knocked out or a bye: just watching
    const R = this.now();
    if (R < c.armAt) return { ok: true, quiet: true, early: true }; // still walking out: ignore
    if (c.taps.has(p.id)) return { ok: true, quiet: true, again: true };
    t = this.claim(t);
    const early = R < c.goAt || t < c.goAt;
    const r = early ? { false: true } : { ms: Math.max(MIN_RT, Math.round(t - c.goAt)) };
    c.taps.set(p.id, r);
    if (early) this.addFalse(p.id);
    else { const b = c.best.get(p.id); if (b == null || r.ms < b) c.best.set(p.id, r.ms); const st = this.stat(p.id); if (st.best == null || r.ms < st.best) st.best = r.ms; }
    this.room.fx(early ? 'false' : 'bang', { id: p.id });
    if ([...c.inHeat].every((id) => c.taps.has(id) || !this.room.get(id))) this.setTimer(400, () => this.resolveHeat());
    return { ok: true, ...r };
  }
  // A shot's score: a valid time, else no tap, else a false start (worst).
  heatScore(r) { return !r ? 5000 : r.false ? 9000 : r.ms; }
  resolveHeat() {
    const c = this.c; if (!c || c.kind !== 'draw' || c.step !== 'standoff') return;
    c.step = 'shot'; this.endsAt = 0;
    if (c.mode === 'duel') {
      const out = [];
      for (const pr of c.pairs) {
        const ra = c.taps.get(pr.a), rb = c.taps.get(pr.b), sa = this.heatScore(ra), sb = this.heatScore(rb);
        pr.ra = ra || null; pr.rb = rb || null;
        pr.coin = sa === sb;
        pr.win = sa < sb ? pr.a : sb < sa ? pr.b : (this.room.rng() < 0.5 ? pr.a : pr.b);
        const lose = pr.win === pr.a ? pr.b : pr.a;
        out.push({ id: lose, score: lose === pr.a ? sa : sb });
      }
      c.outs.push(out);
      c.alive = c.alive.filter((id) => !out.some((o) => o.id === id));
      this.room.fx('duelDone');
      this.setTimer(SHOT_MS, () => (c.alive.length > 1 ? this.heat() : this.finishDraw()));
    } else {
      const shot = [];
      for (const id of c.roster) {
        const r = c.taps.get(id) || null;
        c.sum.set(id, (c.sum.get(id) || 0) + (r && r.ms ? r.ms : MISS_MS));
        shot.push({ id, r });
      }
      shot.sort((x, y) => this.heatScore(x.r) - this.heatScore(y.r));
      c.shots.push(shot);
      this.room.fx('duelDone');
      this.setTimer(SHOT_MS, () => (c.shot < FFA_SHOTS ? this.heat() : this.finishDraw()));
    }
  }
  finishDraw() {
    const c = this.c, rows = [];
    if (c.mode === 'duel') {
      const R = c.outs.length;
      for (const id of c.alive) rows.push({ id, sort: -1, label: '🏆 Last one standing', did: true });
      c.outs.forEach((out, k) => { for (const o of out) rows.push({ id: o.id, sort: (R - k) * 100000 + o.score, label: k === R - 1 ? '🥈 Lost the final' : `Out in round ${k + 1}`, did: true }); });
      c.champ = c.alive[0] || null;
    } else {
      for (const id of c.roster) {
        const b = c.best.get(id), tot = c.sum.get(id) || 0;
        rows.push({ id, sort: tot, label: b != null ? `best ${(b / 1000).toFixed(3)}s` : (c.fs.get(id) ? 'All false starts!' : 'Never drew'), did: b != null || (c.fs.get(id) || 0) > 0 });
      }
    }
    for (const r of rows) { const b = c.best.get(r.id); r.ms = b == null ? null : b; }
    this.finish(rows);
  }

  // ---------- Lantern (colour flash) ----------
  setupFlash() {
    const c = this.c, P = this.P, now = this.now();
    let t = now + 2400; c.armAt = t; c.flashes = [];
    for (let g = 0; g < 3; g++) {
      const d = this.ri(...P.decoys);
      for (let i = 0; i < d; i++) {
        const [col, name] = DECOYS[this.ri(0, DECOYS.length - 1)];
        const word = P.words && this.room.rng() < 0.45 ? 'GREEN' : name;
        const dur = Math.round(P.flashDur * this.rnd(0.85, 1.15));
        c.flashes.push({ at: Math.round(t), dur, col, word, green: false });
        t += dur + this.rnd(350, 900);
      }
      const word = P.words && this.room.rng() < 0.45 ? DECOYS[this.ri(0, DECOYS.length - 1)][1] : GREEN[1];
      c.flashes.push({ at: Math.round(t), dur: Math.round(P.flashDur * 1.1), col: GREEN[0], word, green: true, g });
      t += P.flashDur * 1.1 + this.rnd(600, 1100);
    }
    c.flashes.forEach((f, i) => { const nx = c.flashes[i + 1]; f.win = f.green ? Math.round(Math.min(1500, (nx ? nx.at : f.at + 1500) - f.at)) : f.dur; });
    c.endAt = Math.round(t + 300); c.got = new Map(); c.fkeys = new Map(); c.step = 'flash';
    this.endsAt = c.endAt;
    this.room.fx('lantern');
    this.setTimer(c.endAt - now, () => this.finishFlash());
    for (const id of c.roster) {
      const p = this.room.get(id); if (!p || !p.bot) continue;
      for (const f of c.flashes) {
        if (f.green && this.room.rng() < 0.93) { const at = f.at + this.rnd(240, 560); this.botAt(at, () => this.flashTap(p, at, c.id)); }
        else if (!f.green && this.room.rng() < 0.06) { const at = f.at + this.rnd(150, f.dur - 50); this.botAt(at, () => this.flashTap(p, at, c.id)); }
      }
    }
  }
  flashTap(p, t, cid) {
    const c = this.c;
    if (!c || c.kind !== 'flash' || c.step !== 'flash' || cid !== c.id) return { ok: false, quiet: true };
    if (!c.roster.includes(p.id)) return { ok: false, error: 'Next challenge!' };
    t = this.claim(t);
    if (t < c.armAt) return { ok: true, quiet: true, early: true };
    let i = -1; for (let k = 0; k < c.flashes.length; k++) if (c.flashes[k].at <= t) i = k;
    const f = c.flashes[i];
    if (f && f.green && t < f.at + f.win) {
      let got = c.got.get(p.id); if (!got) { got = [null, null, null]; c.got.set(p.id, got); }
      if (got[f.g] != null) return { ok: true, quiet: true, again: true };
      const ms = Math.max(MIN_RT, Math.round(t - f.at)); got[f.g] = ms;
      const st = this.stat(p.id); if (st.best == null || ms < st.best) st.best = ms;
      this.room.fx('hit', { id: p.id });
      return { ok: true, ms };
    }
    // A decoy (or an empty gap): one false start per flash, however hard you mash.
    let ks = c.fkeys.get(p.id); if (!ks) { ks = new Set(); c.fkeys.set(p.id, ks); }
    const key = f && t < f.at + f.dur ? 'f' + i : 'g' + i;
    if (ks.has(key)) return { ok: true, quiet: true, false: true };
    ks.add(key); this.addFalse(p.id);
    this.room.fx('false', { id: p.id });
    return { ok: true, false: true };
  }
  finishFlash() {
    const c = this.c; if (!c || c.kind !== 'flash' || c.step !== 'flash') return;
    const rows = c.roster.map((id) => {
      const got = c.got.get(id) || [null, null, null], hits = got.filter((x) => x != null), tot = got.reduce((a, x) => a + (x == null ? FLASH_MISS : x), 0);
      const best = hits.length ? Math.min(...hits) : null;
      return { id, sort: tot, ms: best, label: hits.length ? `${hits.length}/3 greens · avg ${(hits.reduce((a, x) => a + x, 0) / hits.length / 1000).toFixed(3)}s` : 'Missed every green', did: hits.length > 0 || (c.fs.get(id) || 0) > 0 };
    });
    this.finish(rows);
  }

  // ---------- Chicken Run (count it) ----------
  setupCount() {
    const c = this.c, P = this.P, now = this.now();
    c.runAt = now + 1600; c.runEnd = c.runAt + COUNT_RUN; c.lockEnd = c.runEnd + LOCK_MS;
    const N = this.ri(...P.chickens), D = this.ri(...P.others);
    const others = ['🦆', '🦃', ...(P.rooster ? ['🐓', '🐓'] : []), '🐇'];
    const crit = [];
    const add = (e, at) => {
      const dur = Math.round(this.rnd(...P.cross));
      crit.push({ e, at: Math.round(clamp(at, 0, COUNT_RUN - dur - 200)), dur, y: +this.rnd(0.08, 0.92).toFixed(3), dir: this.room.rng() < 0.5 ? 1 : -1, hop: +this.rnd(0.6, 1.4).toFixed(2) });
    };
    let left = N;
    while (left > 0) { const burst = Math.min(left, this.room.rng() < 0.3 ? this.ri(2, 3) : 1), at = this.rnd(0, COUNT_RUN - 1500); for (let i = 0; i < burst; i++) add('🐔', at + i * this.rnd(80, 300)); left -= burst; }
    for (let i = 0; i < D; i++) add(others[this.ri(0, others.length - 1)], this.rnd(0, COUNT_RUN - 1500));
    crit.sort((a, b) => a.at - b.at);
    c.crit = crit; c.answer = N; c.counts = new Map(); c.locked = new Map(); c.step = 'run';
    this.endsAt = c.runEnd;
    this.room.fx('chickens');
    this.setTimer(c.runEnd - now, () => { c.step = 'lock'; this.endsAt = c.lockEnd; this.room.fx('lockin'); this.setTimer(LOCK_MS, () => this.finishCount()); });
    for (const id of c.roster) {
      const p = this.room.get(id); if (!p || !p.bot) continue;
      const r = this.room.rng(), n = Math.max(0, N + (r < 0.4 ? 0 : r < 0.65 ? 1 : r < 0.85 ? -1 : r < 0.93 ? 2 : -2));
      this.botAt(c.runEnd + this.rnd(500, 4500), () => this.countAct(p, { op: 'lock', c: c.id, n }));
    }
  }
  countAct(p, m) {
    const c = this.c;
    if (!c || c.kind !== 'count' || m.c !== c.id || (c.step !== 'run' && c.step !== 'lock')) return { ok: false, quiet: true };
    if (!c.roster.includes(p.id)) return { ok: false, error: 'Next challenge!' };
    const n = m.n;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 99) return { ok: false, error: 'Count from 0 to 99.' };
    if (c.locked.has(p.id)) return { ok: false, error: 'You already locked in.' };
    c.counts.set(p.id, n);
    if (m.op === 'count') return { ok: true, quiet: true };
    if (c.step !== 'lock') return { ok: false, error: 'Wait until the last chicken crosses!' };
    c.locked.set(p.id, this.now());
    if (c.roster.every((id) => c.locked.has(id) || !this.room.get(id))) this.setTimer(900, () => this.finishCount());
    return { ok: true };
  }
  finishCount() {
    const c = this.c; if (!c || c.kind !== 'count' || c.step === 'done') return;
    c.step = 'done';
    const rows = c.roster.map((id) => {
      const n = c.counts.has(id) ? c.counts.get(id) : null, err = n == null ? 99 : Math.abs(n - c.answer), lk = c.locked.has(id) ? c.locked.get(id) - c.runEnd : LOCK_MS + 1;
      const st = this.stat(id); if (n != null) st.countErr = (st.countErr || 0) + err;
      return { id, sort: err * 100000 + lk, n, err, label: n == null ? 'No count' : `${n} 🐔 · ${err === 0 ? 'exact!' : `off by ${err}`}`, did: n != null };
    });
    this.finish(rows);
  }

  // ---------- Stampede (shake it) ----------
  setupShake() {
    const c = this.c, now = this.now();
    c.goAt = now + SHAKE_COUNT; c.endAt = c.goAt + SHAKE_MS; c.target = this.P.target; c.step = 'race';
    c.prog = new Map(c.roster.map((id) => [id, { n: 0, fin: null }]));
    c.bots = new Map();
    for (const id of c.roster) { const p = this.room.get(id); if (p && p.bot) c.bots.set(id, this.rnd(6, 10.5)); }
    this.endsAt = c.endAt;
    this.room.fx('stampede');
    this.room.after(c.goAt - now, () => { if (this.c === c && c.step === 'race') this.room.fx('gallop'); });
    const tick = () => {
      if (this.c !== c || c.step !== 'race') return;
      const R = this.now();
      if (R >= c.goAt) for (const [id, rate] of c.bots) {
        const pr = c.prog.get(id); if (!pr || pr.fin != null) continue;
        const want = Math.min(c.target, Math.floor(((R - c.goAt) / 1000) * rate));
        if (want > pr.n) { pr.n = want; if (pr.n >= c.target) { pr.fin = Math.round(c.goAt + (c.target / rate) * 1000); this.room.fx('finish', { id }); } }
      }
      if (R >= c.endAt || [...c.prog.entries()].every(([id, pr]) => pr.fin != null || !this.room.get(id))) return this.finishShake();
      this.tick = this.room.after(TICK, tick);
    };
    this.tick = this.room.after(TICK, tick);
    this.setTimer(c.endAt - now + 50, () => this.finishShake());
  }
  shakeAct(p, m) {
    const c = this.c;
    if (!c || c.kind !== 'shake' || c.step !== 'race' || m.c !== c.id) return { ok: false, quiet: true };
    const pr = c.prog.get(p.id); if (!pr) return { ok: false, error: 'Next challenge!' };
    const n = m.n;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 1000) return { ok: false, error: 'Bad shake.' };
    const R = this.now();
    if (R < c.goAt - 300 || pr.fin != null) return { ok: true, quiet: true };
    // Never more than MAX_RATE shakes a second since the start (plus a little slack for lag).
    const cap = Math.floor((Math.max(0, R - c.goAt) / 1000) * MAX_RATE) + 4;
    const v = Math.min(n, cap, c.target);
    if (v > pr.n) pr.n = v;
    if (pr.n >= c.target) {
      const minT = c.goAt + (c.target / MAX_RATE) * 1000;
      pr.fin = Math.round(clamp(this.claim(m.t), Math.min(R, minT), R));
      this.room.fx('finish', { id: p.id });
      return { ok: true, fin: pr.fin - c.goAt };
    }
    return { ok: true, quiet: true, n: pr.n };
  }
  finishShake() {
    const c = this.c; if (!c || c.kind !== 'shake' || c.step !== 'race') return;
    c.step = 'done'; this.room.cancel(this.tick); this.tick = null;
    const rows = c.roster.map((id) => {
      const pr = c.prog.get(id) || { n: 0, fin: null }, ms = pr.fin == null ? null : pr.fin - c.goAt;
      if (ms != null) { const st = this.stat(id); if (st.shake == null || ms < st.shake) st.shake = ms; }
      return { id, sort: ms != null ? ms : 1e6 - pr.n, fin: ms, label: ms != null ? `🏁 ${(ms / 1000).toFixed(2)}s` : `${Math.round((pr.n / c.target) * 100)}% of the way`, did: pr.n > 0 };
    });
    this.finish(rows);
  }

  // ---------- Copycat (rhythm) ----------
  pattern(beats) {
    const grid = this.P.grid, gaps = [];
    for (let i = 0; i < beats - 1; i++) gaps.push(grid[this.ri(0, grid.length - 1)]);
    while (gaps.reduce((a, x) => a + x, 0) > 3600) gaps[gaps.indexOf(Math.max(...gaps))] = grid[0];
    if (gaps.every((g) => g === gaps[0]) && gaps.length > 1) gaps[gaps.length - 1] = grid[(grid.indexOf(gaps[0]) + 1) % grid.length];
    return gaps;
  }
  setupCopy() {
    const c = this.c;
    c.pats = this.P.beats.map((b) => this.pattern(b)); c.k = -1;
    c.acc = new Map(); c.sub = new Map();
    this.copyNext();
  }
  copyNext() {
    const c = this.c, now = this.now();
    c.k++; c.gaps = c.pats[c.k];
    const total = c.gaps.reduce((a, x) => a + x, 0);
    c.demoAt = now + 1700; c.beats = [c.demoAt]; for (const g of c.gaps) c.beats.push(c.beats[c.beats.length - 1] + g);
    c.listenEnd = c.demoAt + total + 700; c.repeatEnd = c.listenEnd + total + 4500; c.step = 'listen';
    this.endsAt = 0;
    this.room.fx('listen', { k: c.k });
    this.setTimer(c.listenEnd - now, () => { c.step = 'repeat'; this.endsAt = c.repeatEnd; this.room.fx('repeat'); this.setTimer(c.repeatEnd - this.now(), () => this.copyEnd()); });
    for (const id of c.roster) {
      const p = this.room.get(id); if (!p || !p.bot) continue;
      const noise = this.rnd(20, 110), taps = [0];
      for (const g of c.gaps) taps.push(taps[taps.length - 1] + Math.max(60, Math.round(g + this.rnd(-noise, noise))));
      if (this.room.rng() < 0.1) taps.pop();
      const k = c.k;
      this.botAt(c.listenEnd + this.rnd(600, 1400) + taps[taps.length - 1], () => this.copyAct(p, { op: 'rhythm', c: c.id, k, taps }));
    }
  }
  copyAct(p, m) {
    const c = this.c;
    if (!c || c.kind !== 'copy' || m.c !== c.id || c.step !== 'repeat' || m.k !== c.k) return { ok: false, quiet: true };
    if (!c.roster.includes(p.id)) return { ok: false, error: 'Next challenge!' };
    const taps = m.taps;
    if (!Array.isArray(taps) || taps.length < 1 || taps.length > 16 || !taps.every((x) => fin(x) && x >= 0 && x <= 20000)) return { ok: false, error: 'Bad rhythm.' };
    for (let i = 1; i < taps.length; i++) if (taps[i] < taps[i - 1]) return { ok: false, error: 'Bad rhythm.' };
    let acc = c.acc.get(p.id); if (!acc) { acc = [null, null]; c.acc.set(p.id, acc); }
    if (acc[c.k] != null) return { ok: false, error: 'Already sent!' };
    const base = taps[0];
    acc[c.k] = rhythmAcc(c.gaps, taps.map((x) => x - base));
    let sub = c.sub.get(p.id); if (!sub) { sub = [0, 0]; c.sub.set(p.id, sub); }
    sub[c.k] = this.now() - c.listenEnd;
    this.room.fx('rhythm', { id: p.id });
    if (c.roster.every((id) => (c.acc.get(id) || [])[c.k] != null || !this.room.get(id))) this.setTimer(900, () => this.copyEnd());
    return { ok: true, acc: Math.round(acc[c.k] * 100) };
  }
  copyEnd() {
    const c = this.c; if (!c || c.kind !== 'copy' || c.step === 'done') return;
    if (c.k < c.pats.length - 1) { c.step = 'between'; this.room.fx('nextBeat'); return this.setTimer(1200, () => this.copyNext()); }
    c.step = 'done';
    const rows = c.roster.map((id) => {
      const a = c.acc.get(id) || [null, null], did = a.some((x) => x != null), avg = (a[0] || 0) / 2 + (a[1] || 0) / 2, sub = c.sub.get(id) || [9e4, 9e4];
      if (did) { const st = this.stat(id); if (st.copy == null || avg > st.copy) st.copy = avg; }
      return { id, sort: Math.round((1 - avg) * 1e6) + (sub[0] + sub[1]) / 100, acc: avg, label: did ? `${Math.round(avg * 100)}% in rhythm` : 'Missed the beat', did };
    });
    this.finish(rows);
  }

  // ---------- scoring ----------
  finish(rows) {
    const c = this.c; if (!c || this.phase !== 'play') return;
    this.room.cancel(this.tick); this.tick = null;
    c.step = 'done';
    rows = rows.filter((r) => this.room.get(r.id)).sort((a, b) => a.sort - b.sort);
    const n = rows.length, pod = n <= 3 ? 1 : n <= 5 ? 2 : 3;
    rows.forEach((r, i) => { r.rank = i > 0 && rows[i - 1].sort === r.sort ? rows[i - 1].rank : i; });
    for (const r of rows) {
      const st = this.stat(r.id), fs = c.fs.get(r.id) || 0;
      let gain = r.did ? (RANK_PTS[r.rank] || 100) * c.mult : 0;
      r.base = gain;
      if (r.did && r.rank < pod) { st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); } else st.streak = 0;
      r.streak = st.streak;
      r.bonus = st.streak >= 2 ? Math.min(200, 50 * (st.streak - 1)) : 0;
      r.pen = fs * FALSE_PEN; r.fs = fs;
      gain += r.bonus - r.pen;
      if (r.rank === 0 && r.did) st.wins++;
      st.played++;
      r.gain = gain;
      this.points.set(r.id, Math.max(0, (this.points.get(r.id) || 0) + gain));
    }
    const top = rows[0];
    const jibes = JIBES[this.family() ? 'family' : 'grown'];
    c.res = {
      rows: rows.map((r) => ({ ...this.pub(r.id), rank: r.rank, label: r.label, gain: r.gain, base: r.base, bonus: r.bonus, pen: r.pen, fs: r.fs, streak: r.streak, ms: r.ms == null ? null : r.ms, n: r.n == null ? null : r.n })),
      top: top ? this.pub(top.id) : null, answer: c.kind === 'count' ? c.answer : null,
      jibe: rows.some((r) => r.fs) ? jibes[this.ri(0, jibes.length - 1)] : null,
    };
    this.history.push({ kind: c.kind, top: top ? top.id : null });
    this.phase = 'result'; this.endsAt = this.now() + RESULT_MS;
    this.room.fx('result', { kind: c.kind });
    this.setTimer(RESULT_MS, () => this.nextChallenge());
  }
  standings() {
    return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ ...this.pub(id), points: pts, wins: this.stat(id).wins }))
      .sort((a, b) => b.points - a.points || b.wins - a.wins || a.name.localeCompare(b.name));
  }
  awards() {
    const ids = [...this.stats.keys()].filter((id) => this.room.get(id)), A = [];
    const best = (f, cmp, ok = () => true) => { let w = null; for (const id of ids) { const v = f(this.stat(id)); if (v == null || !ok(v)) continue; if (!w || cmp(v, w.v) < 0) w = { id, v }; } return w; };
    const add = (key, icon, title, w, txt) => { if (w) A.push({ key, icon, title, ...this.pub(w.id), text: txt(w.v) }); };
    add('fast', '⚡', 'Fastest Hand', best((s) => s.best, (a, b) => a - b), (v) => `${(v / 1000).toFixed(3)}s reaction`);
    add('jumpy', '🦘', 'Jumpy', best((s) => s.falses, (a, b) => b - a, (v) => v > 0), (v) => `${v} false start${v === 1 ? '' : 's'}`);
    if (this.history.some((h) => h.kind === 'count')) add('eye', '🎯', 'Eagle Eye', best((s) => s.countErr, (a, b) => a - b), (v) => (v === 0 ? 'counted every chicken' : `off by just ${v}`));
    if (this.history.some((h) => h.kind === 'shake')) add('dust', '🐎', 'Dust Devil', best((s) => s.shake, (a, b) => a - b), (v) => `finished in ${(v / 1000).toFixed(2)}s`);
    if (this.history.some((h) => h.kind === 'copy')) add('beat', '🥁', 'Copycat', best((s) => s.copy, (a, b) => b - a), (v) => `${Math.round(v * 100)}% in rhythm`);
    add('streak', '🔥', 'Hot Streak', best((s) => s.bestStreak, (a, b) => b - a, (v) => v >= 2), (v) => `${v} podiums in a row`);
    return A;
  }
  end() {
    this.room.cancel(this.timer); this.room.cancel(this.tick); this.tick = null;
    this.phase = 'over'; this.endsAt = 0; this.c = null;
    this.final = { standings: this.standings(), awards: this.awards() };
    this.room.fx('win');
  }
  checkDone() {
    const c = this.c; if (!c || this.phase !== 'play') return;
    const here = (id) => !!this.room.get(id);
    if (c.kind === 'draw' && c.step === 'standoff' && [...c.inHeat].every((id) => c.taps.has(id) || !here(id))) this.setTimer(400, () => this.resolveHeat());
  }
  // Host "Skip ahead".
  next() {
    const c = this.c;
    if (this.phase === 'intro') return this.begin();
    if (this.phase === 'result') return this.nextChallenge();
    if (this.phase !== 'play' || !c) return;
    if (c.kind === 'draw') { if (c.step === 'standoff') this.resolveHeat(); this.finishDraw(); }
    else if (c.kind === 'flash') this.finishFlash();
    else if (c.kind === 'count') this.finishCount();
    else if (c.kind === 'shake') this.finishShake();
    else if (c.kind === 'copy') { c.k = c.pats.length - 1; this.copyEnd(); }
  }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }

  act(p, m) {
    if (m.op === 'ping') return { ok: true, quiet: true, now: this.now() };
    if (this.phase !== 'play' || !this.c) return { ok: false, quiet: true }; // a late tap: nothing to say
    const cid = Number(m.c);
    switch (m.op) {
      case 'tap': return this.c.kind === 'draw' ? this.drawTap(p, m.t, cid) : this.c.kind === 'flash' ? this.flashTap(p, m.t, cid) : { ok: false, quiet: true };
      case 'count': case 'lock': return this.countAct(p, { op: m.op, c: cid, n: m.n });
      case 'shake': return this.shakeAct(p, { c: cid, n: m.n, t: m.t });
      case 'rhythm': return this.copyAct(p, { c: cid, k: m.k, taps: m.taps });
      default: return { ok: false, error: 'Unknown move.' };
    }
  }
  // The TV syncs its clock too (box host action 'qdPing').
  hostAct(m) { if (m && m.type === 'qdPing') return { ok: true, now: this.now() }; return { ok: false, error: 'Unknown action.' }; }

  // ---------- screens ----------
  base() {
    return { phase: this.phase, n: this.n, of: this.lineup.length, now: this.now(), endsIn: this.endsAt ? Math.max(0, this.endsAt - this.now()) : 0, lineup: this.lineup, family: this.family() };
  }
  cPub() {
    const c = this.c; if (!c) return null;
    const o = { kind: c.kind, id: c.id, mult: c.mult, step: c.step, res: this.phase === 'result' ? c.res : null };
    if (this.phase !== 'play') return o;
    if (c.kind === 'draw') {
      Object.assign(o, { mode: c.mode, armAt: c.armAt, goAt: c.goAt, endAt: c.endAt, heat: c.heat || 0, heats: c.heats || 0, shot: c.shot || 0, shots: FFA_SHOTS });
      const res = (r) => (r ? (r.false ? { false: true } : { ms: r.ms }) : null);
      const show = c.step === 'shot';
      if (c.mode === 'duel') {
        o.pairs = c.pairs.map((pr) => ({ a: { ...this.pub(pr.a), r: show ? res(pr.ra) : null, tapped: c.taps.has(pr.a) }, b: { ...this.pub(pr.b), r: show ? res(pr.rb) : null, tapped: c.taps.has(pr.b) }, win: show ? pr.win : null, coin: show ? !!pr.coin : false }));
        o.bye = c.bye ? this.pub(c.bye) : null;
        o.out = c.outs.flat().map((x) => x.id);
      } else {
        o.count = c.inHeat.size; o.tapped = c.taps.size;
        if (show) { const shot = c.shots[c.shots.length - 1] || []; o.shotRes = shot.slice(0, 16).map((x) => ({ ...this.pub(x.id), r: res(x.r) })); o.more = Math.max(0, shot.length - 16); }
      }
    } else if (c.kind === 'flash') {
      Object.assign(o, { armAt: c.armAt, endAt: c.endAt, flashes: c.flashes.map((f) => ({ at: f.at, dur: f.dur, col: f.col, word: f.word, green: f.green })), hits: [...c.got.values()].reduce((a, g) => a + g.filter((x) => x != null).length, 0), falses: [...c.fs.values()].reduce((a, x) => a + x, 0) });
    } else if (c.kind === 'count') {
      Object.assign(o, { runAt: c.runAt, runEnd: c.runEnd, lockEnd: c.lockEnd, crit: c.crit, locked: c.locked.size, of: c.roster.length });
    } else if (c.kind === 'shake') {
      Object.assign(o, { goAt: c.goAt, endAt: c.endAt, target: c.target, racers: c.roster.map((id) => { const pr = c.prog.get(id) || { n: 0, fin: null }; return { ...this.pub(id), n: pr.n, fin: pr.fin == null ? null : pr.fin - c.goAt }; }) });
    } else if (c.kind === 'copy') {
      Object.assign(o, { k: c.k, pats: c.pats.length, beats: c.beats, demoAt: c.demoAt, listenEnd: c.listenEnd, repeatEnd: c.repeatEnd, done: c.roster.filter((id) => (c.acc.get(id) || [])[c.k] != null).length, of: c.roster.length });
    }
    return o;
  }
  tv() {
    const st = this.standings();
    return { ...this.base(), c: this.cPub(), standings: st.slice(0, 12), players: st.length, final: this.phase === 'over' ? this.final : null };
  }
  view(p) {
    const st = this.standings(), i = st.findIndex((r) => r.id === p.id), c = this.c, b = this.base();
    const v = { ...b, me: p.id, gear: GEARS.gearSet(p, 'quickdraw'), points: this.points.get(p.id) || 0, rank: i + 1, of: st.length, total: this.lineup.length, streak: this.stat(p.id).streak, final: this.phase === 'over' ? this.final : null };
    if (!c) return v;
    v.c = { kind: c.kind, id: c.id, mult: c.mult, step: c.step, in: c.roster.includes(p.id) };
    if (this.phase === 'result' && c.res) { v.c.mine = c.res.rows.find((r) => r.id === p.id) || null; v.c.top = c.res.top; v.c.answer = c.res.answer; v.c.jibe = c.res.jibe; }
    if (this.phase !== 'play') return v;
    const V = v.c;
    if (c.kind === 'draw') {
      Object.assign(V, { mode: c.mode, armAt: c.armAt, goAt: c.goAt, endAt: c.endAt, heat: c.heat || 0, heats: c.heats || 0, shot: c.shot || 0, shots: FFA_SHOTS, inHeat: c.inHeat.has(p.id) });
      const r = c.taps.get(p.id); V.my = r ? (r.false ? { false: true } : { ms: r.ms }) : null;
      if (c.mode === 'duel') {
        const pr = c.pairs.find((x) => x.a === p.id || x.b === p.id);
        V.opp = pr ? this.pub(pr.a === p.id ? pr.b : pr.a) : null;
        V.bye = c.bye === p.id; V.out = c.outs.flat().some((x) => x.id === p.id);
        if (c.step === 'shot' && pr) { V.won = pr.win === p.id; V.coin = !!pr.coin; const or = c.taps.get(pr.a === p.id ? pr.b : pr.a); V.oppR = or ? (or.false ? { false: true } : { ms: or.ms }) : null; }
      }
    } else if (c.kind === 'flash') {
      Object.assign(V, { armAt: c.armAt, endAt: c.endAt, hits: (c.got.get(p.id) || []).filter((x) => x != null).length, falses: c.fs.get(p.id) || 0 });
    } else if (c.kind === 'count') {
      Object.assign(V, { runAt: c.runAt, runEnd: c.runEnd, lockEnd: c.lockEnd, count: c.counts.has(p.id) ? c.counts.get(p.id) : null, locked: c.locked.has(p.id) });
    } else if (c.kind === 'shake') {
      const pr = c.prog.get(p.id) || { n: 0, fin: null };
      Object.assign(V, { goAt: c.goAt, endAt: c.endAt, target: c.target, n: pr.n, fin: pr.fin == null ? null : pr.fin - c.goAt, place: pr.fin == null ? null : 1 + [...c.prog.values()].filter((x) => x.fin != null && x.fin < pr.fin).length });
    } else if (c.kind === 'copy') {
      const a = (c.acc.get(p.id) || [])[c.k];
      Object.assign(V, { k: c.k, pats: c.pats.length, beats: c.beats, listenEnd: c.listenEnd, repeatEnd: c.repeatEnd, sent: a != null, acc: a == null ? null : Math.round(a * 100) });
    }
    return v;
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ minutes: M }) => PF.best({ rounds: [7, 5, 10] }, (s) => 0.5 + s.rounds * 0.75, M);

module.exports = {
  partyFit,
  difficulty: { key: 'pace', values: { easy: 'easy', medium: 'normal', hard: 'sharp' } }, // Party Mode's "How hard?" (box/party-fit.js)
  key: 'quickdraw', name: 'Quick Draw', min: 2, best: [2, 20], howSteps: 6, fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/quickdraw.js)
  locked: { how: 'Finish a game of President to unlock it.' }, // public/unlocks.js + UNLOCK_RULES in box/room.js
  create: (room, settings) => new Game(room, settings),
  _test: { rhythmAcc, PACE, RANK_PTS, FALSE_PEN, MAX_RATE, MIN_RT, MAX_LAG },
};
