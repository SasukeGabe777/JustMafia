'use strict';
// Color Match: a JustGameBox game for 2–20. The TV flashes a colour for a few seconds (a big
// paint swatch, or an object such as an apple, a car or a sunset sky), then hides it. Everyone
// mixes it from memory on their phone (a saturation/brightness pad plus a hue bar) and locks in.
// Closest wins, scored by CIEDE2000 (ΔE00) in CIELAB: match % = 100 − 1.4·ΔE00.
// Round styles: Memory (3 s), Blink (1 s), Two-Tone (remember two colours), Name It (mix a colour
// name; scored against the ROOM'S AVERAGE when 3+ mix it), Halfway (mix the midpoint between two
// colours) and Odd One Out (spot the slightly different tile, fast). A perfect match (96%+) builds
// a combo; the last round is worth double. Awards at the end (Eagle Eye, Colour Blind? ...).
// Every phone input is validated (colours are clamped numbers). All content is original.

const GEARS = require('../../public/shared/gear'); // shop gear: the frame around your mix (slot colormatch/easel)

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rounds', label: 'Rounds', options: opt([[5, '5 rounds'], [7, '7 rounds'], [10, '10 rounds']]) },
  { key: 'seconds', label: 'Time to mix', options: opt([[15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds']]) },
  { key: 'styles', label: 'Round styles', options: opt([['mix', 'All styles'], ['memory', 'Memory only']]) },
];
const defaults = { rounds: 7, seconds: 20, styles: 'mix' };

const INTRO_MS = 2800;
const LOOK_MS = { memory: 3000, blink: 1000, two: 3500 };
const GRID = 16; // Odd One Out: a 4×4 grid
const PERFECT = 96; // "more than 95%"
const KINDS = {
  memory: { icon: '🧠', title: 'Memory Mix', rule: 'Look closely… then mix it from memory.' },
  blink: { icon: '⚡', title: 'Blink!', rule: 'One second. That’s all you get.' },
  two: { icon: '🎭', title: 'Two-Tone', rule: 'Two colours this time. Remember both!' },
  name: { icon: '🏷️', title: 'Name It', rule: 'Mix what this name looks like to you. Closest to the room’s average wins!' },
  gradient: { icon: '🌈', title: 'Halfway There', rule: 'Mix the colour exactly halfway between these two.' },
  odd: { icon: '🔍', title: 'Odd One Out', rule: 'One tile is ever so slightly different. Tap it, fast!' },
};
// Objects the colour can appear as on the TV (drawn by the client).
const OBJECTS = ['apple', 'car', 'balloon', 'sky', 'mug', 'umbrella', 'fish', 'shirt'];
const OBJECT_NAMES = { apple: 'an apple', car: 'a car', balloon: 'a balloon', sky: 'a sunset sky', mug: 'a mug', umbrella: 'an umbrella', fish: 'a fish', shirt: 'a T-shirt' };
// Name It: original colour names, each with our own paint-chip version.
const NAMES = [
  ['Mango Sorbet', '#ffa94d'], ['Grandma’s Teapot', '#7fa7a1'], ['Dragon Belly', '#c9d65a'], ['Midnight Pool', '#1f3f73'],
  ['Pickle Juice', '#a9b84a'], ['Bubblegum Rocket', '#ff7ab8'], ['Rusty Tractor', '#a8502c'], ['Lazy Lagoon', '#3fb7b0'],
  ['Toasted Marshmallow', '#d9a066'], ['Haunted Lilac', '#a996c9'], ['Lemon Fizz', '#f4e45a'], ['Frog Disco', '#3fd16a'],
  ['Cosy Pumpkin', '#e07b2c'], ['Seasick Mint', '#b5e3c0'], ['Velvet Plum', '#5e2a55'], ['Sunburnt Tourist', '#ef7d6b'],
  ['Thunder Cloud', '#5d6470'], ['Flamingo Gossip', '#f78fa7'], ['Ocean Nap', '#3d7fc1'], ['Spicy Paprika', '#c23b22'],
  ['Moss Pillow', '#6f8a3c'], ['Cotton Candy Sky', '#bcd4ff'], ['Blueberry Jam', '#4a3f8f'], ['Old Copper Kettle', '#b87333'],
  ['Glacier Ice', '#c8eef2'], ['Ketchup Emergency', '#d4231f'], ['Avocado Toast', '#9cb35e'], ['Lavender Nap', '#c4b0e6'],
  ['Wet Sand', '#a8916e'], ['Neon Lime Party', '#c6ff2e'], ['Rainy Tuesday', '#8a9bab'], ['Peach Fuzz Sweater', '#ffbe98'],
];

// ---------- colour maths ----------
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360; s /= 100; v /= 100;
  const c = v * s, hp = h / 60, x = c * (1 - Math.abs((hp % 2) - 1)), m = v - c;
  const [r, g, b] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  return [r, g, b].map((t) => Math.round((t + m) * 255));
}
const hex = (rgb) => '#' + rgb.map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0')).join('');
const fromHex = (h) => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const unlin = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const XN = 0.95047, ZN = 1.08883, EPS = 216 / 24389, KAP = 24389 / 27;
function rgbToLab(rgb) {
  const [r, g, b] = rgb.map(lin);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / XN, Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / ZN;
  const f = (t) => (t > EPS ? Math.cbrt(t) : (KAP * t + 16) / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labToRgb([L, a, b]) {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (f) => (f * f * f > EPS ? f * f * f : (116 * f - 16) / KAP);
  const X = inv(fx) * XN, Y = L > KAP * EPS ? Math.pow(fy, 3) : L / KAP, Z = inv(fz) * ZN;
  const r = 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z, g = -0.969266 * X + 1.8760108 * Y + 0.041556 * Z, bl = 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z;
  return [r, g, bl].map((c) => clamp(Math.round(unlin(clamp(c, 0, 1))), 0, 255));
}
// CIEDE2000 colour difference (Sharma, Wu & Dalal 2005).
function deltaE00(l1, l2) {
  const [L1, a1, b1] = l1, [L2, a2, b2] = l2, rad = Math.PI / 180, P7 = Math.pow(25, 7);
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2, Cb7 = Math.pow(Cb, 7);
  const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + P7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (b, a) => (b === 0 && a === 0 ? 0 : ((Math.atan2(b, a) / rad) + 360) % 360);
  const h1p = hue(b1, a1p), h2p = hue(b2, a2p), prod = C1p * C2p;
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0; if (prod !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(prod) * Math.sin((dhp / 2) * rad);
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (prod !== 0) { if (Math.abs(h1p - h2p) > 180) hbp += hbp < 360 ? 360 : -360; hbp /= 2; }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-Math.pow((hbp - 275) / 25, 2)), Cbp7 = Math.pow(Cbp, 7);
  const Rc = 2 * Math.sqrt(Cbp7 / (Cbp7 + P7)), Sl = 1 + (0.015 * Math.pow(Lbp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbp - 50, 2));
  const Sc = 1 + 0.045 * Cbp, Sh = 1 + 0.015 * Cbp * T, Rt = -Math.sin(2 * dTh * rad) * Rc;
  return Math.sqrt(Math.pow(dLp / Sl, 2) + Math.pow(dCp / Sc, 2) + Math.pow(dHp / Sh, 2) + Rt * (dCp / Sc) * (dHp / Sh));
}
const distHex = (a, b) => deltaE00(rgbToLab(fromHex(a)), rgbToLab(fromHex(b)));
// ΔE00 -> "% match" (0–100). ΔE00 ≈ 2 is barely visible; a memory guess is usually 5–15 off.
const matchPct = (dE) => clamp(100 - 1.4 * dE, 0, 100);
const avgLab = (labs) => labs.reduce((s, l) => [s[0] + l[0] / labs.length, s[1] + l[1] / labs.length, s[2] + l[2] / labs.length], [0, 0, 0]);

// A phone colour {h, s, v}: anything else is rejected; numbers are clamped.
function cleanColor(c) {
  if (!c || typeof c !== 'object') return null;
  const h = Number(c.h), s = Number(c.s), v = Number(c.v);
  if (![h, s, v].every(Number.isFinite)) return null;
  return hex(hsvToRgb(clamp(h, 0, 360) % 360, clamp(s, 0, 100), clamp(v, 0, 100)));
}
function cleanColors(list, n) {
  if (!Array.isArray(list) || list.length !== n) return null;
  const out = list.map(cleanColor);
  return out.every(Boolean) ? out : null;
}

class Game {
  constructor(room, s) {
    this.room = room; this.s = s; this.phase = 'intro'; this.round = 0; this.total = Number(s.rounds) || 7;
    this.kinds = []; this.cur = null; this.picks = new Map(); this.drafts = new Map();
    this.points = new Map(); this.combo = new Map(); this.stats = new Map();
    this.endsAt = 0; this.phaseAt = 0; this.timer = null; this.result = null; this.history = []; this.final = null;
  }
  rnd() { return this.room.rng(); }
  gauss() { const u = Math.max(1e-9, this.rnd()), v = this.rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  pick(a) { return a[Math.floor(this.rnd() * a.length) % a.length]; }
  shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(this.rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.phaseAt = this.room.now(); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  stat(id) { let st = this.stats.get(id); if (!st) { st = { n: 0, sum: 0, best: null, worst: null, maxCombo: 0, lockMs: 0, locks: 0, nameSum: 0, nameN: 0, oddFound: 0, oddMs: null }; this.stats.set(id, st); } return st; }
  active() { return this.room.list().filter((p) => p.bot || p.sockets > 0); }

  start() {
    for (const p of this.room.list()) this.joined(p);
    this.kinds = this.planKinds(this.total, this.s.styles);
    this.nextRound();
  }
  joined(p) { if (!this.points.has(p.id)) { this.points.set(p.id, 0); this.combo.set(p.id, 0); } }
  left() { this.maybeDone(); }

  // The round styles, in order: always a plain Memory round first, no style twice in a row.
  planKinds(n, styles) {
    const pool = styles === 'memory' ? ['memory', 'blink', 'two'] : ['memory', 'blink', 'two', 'name', 'gradient', 'odd'];
    const out = ['memory'];
    while (out.length < n) {
      const bag = this.shuffle(styles === 'memory' ? pool : out.length === 1 ? pool.filter((k) => k !== 'memory') : pool);
      for (const k of bag) { if (out.length >= n) break; if (k !== out[out.length - 1]) out.push(k); }
    }
    return out;
  }
  // A pleasant random target: mostly mid colours, sometimes pastel or deep, never too near the last one.
  randomColor(avoid = []) {
    for (let tries = 0; ; tries++) {
      const r = this.rnd(), h = this.rnd() * 360;
      const [s, v] = r < 0.18 ? [18 + this.rnd() * 25, 86 + this.rnd() * 12] : r < 0.32 ? [45 + this.rnd() * 45, 28 + this.rnd() * 22] : [35 + this.rnd() * 60, 50 + this.rnd() * 45];
      const c = hex(hsvToRgb(h, s, v));
      if (tries > 30 || avoid.every((a) => distHex(a, c) > 22)) return c;
    }
  }
  nextRound() {
    if (this.round >= this.total) return this.end();
    this.round++;
    const kind = this.kinds[this.round - 1] || 'memory', last = this.history.length ? [].concat(this.history[this.history.length - 1].target || []) : [];
    const cur = { kind, final: this.round === this.total };
    if (kind === 'memory') { cur.target = this.randomColor(last); cur.obj = this.rnd() < 0.65 ? this.pick(OBJECTS) : null; }
    else if (kind === 'blink') cur.target = this.randomColor(last);
    else if (kind === 'two') { const a = this.randomColor(last); let b = this.randomColor([a]); for (let i = 0; i < 20 && distHex(a, b) < 30; i++) b = this.randomColor([a]); cur.target = [a, b]; }
    else if (kind === 'name') { const used = new Set(this.history.map((h) => h.name)); const [name, ref] = this.pick(NAMES.filter(([nm]) => !used.has(nm))); cur.name = name; cur.ref = ref; }
    else if (kind === 'gradient') {
      let a, b; for (let i = 0; i < 40; i++) { a = this.randomColor(); b = this.randomColor([a]); if (distHex(a, b) > 38) break; }
      const mid = labToRgb(avgLab([rgbToLab(fromHex(a)), rgbToLab(fromHex(b))]));
      cur.ends = [a, b]; cur.target = hex(mid);
    } else if (kind === 'odd') {
      let base; do base = this.randomColor(); while (rgbToLab(fromHex(base))[0] < 30);
      const L = rgbToLab(fromHex(base)), want = cur.final ? 4.5 : 6, ang = this.rnd() * Math.PI * 2, dl = (this.rnd() - 0.5) * 0.6;
      let odd = base;
      for (let k = 0.5; k < 40; k += 0.25) { odd = hex(labToRgb([L[0] + dl * k, L[1] + Math.cos(ang) * k, L[2] + Math.sin(ang) * k])); if (distHex(base, odd) >= want) break; }
      cur.base = base; cur.oddColor = odd; cur.odd = Math.floor(this.rnd() * GRID);
      cur.tiles = Array.from({ length: GRID }, (_, i) => (i === cur.odd ? odd : base));
    }
    this.cur = cur; this.picks = new Map(); this.drafts = new Map(); this.result = null;
    this.phase = 'intro'; this.room.fx('round', { kind });
    this.setTimer(INTRO_MS, () => this.afterIntro());
  }
  afterIntro() {
    if (this.phase !== 'intro') return;
    if (LOOK_MS[this.cur.kind]) { this.phase = 'look'; this.room.fx('look', { kind: this.cur.kind }); this.setTimer(LOOK_MS[this.cur.kind], () => this.startPick()); this.room.sync(); }
    else this.startPick();
  }
  pickMs() { return Number(this.s.seconds) * 1000 || 20000; }
  startPick() {
    if (this.phase !== 'intro' && this.phase !== 'look') return;
    if (this.phase === 'look') this.room.fx('hide');
    this.phase = 'pick'; const ms = this.pickMs();
    this.setTimer(ms, () => this.reveal());
    const k = this.cur.kind, n = k === 'two' ? 2 : 1, rk = this.round;
    for (const p of this.room.list()) if (p.bot) {
      const skill = (p.id.charCodeAt(p.id.length - 1) % 7) / 7; // stable per bot
      this.room.after(1200 + this.rnd() * (ms * 0.55), () => {
        if (this.phase !== 'pick' || this.round !== rk || this.picks.has(p.id)) return;
        if (k === 'odd') { const right = this.rnd() < 0.45 + skill * 0.45; let i = this.cur.odd; if (!right) do i = Math.floor(this.rnd() * GRID); while (i === this.cur.odd); this.lockOdd(p, i); }
        else this.lock(p, this.botColors(n, skill));
        this.room.sync();
      });
    }
    this.room.sync();
  }
  botColors(n, skill) {
    const k = this.cur.kind, sd = (k === 'name' ? 9 : k === 'gradient' ? 7 : 6) + (1 - skill) * (k === 'blink' ? 20 : 15);
    const aim = k === 'name' ? [this.cur.ref] : [].concat(this.cur.target);
    return aim.slice(0, n).map((c) => { const L = rgbToLab(fromHex(c)); return hex(labToRgb([L[0] + this.gauss() * sd * 0.8, L[1] + this.gauss() * sd, L[2] + this.gauss() * sd])); });
  }
  lock(p, colors) {
    this.picks.set(p.id, { colors, ms: this.room.now() - this.phaseAt });
    this.room.fx('lock', { id: p.id }); this.maybeDone();
  }
  lockOdd(p, i) {
    this.picks.set(p.id, { i, ms: this.room.now() - this.phaseAt });
    this.room.fx('lock', { id: p.id }); this.maybeDone();
  }
  maybeDone() {
    if (this.phase !== 'pick') return;
    const act = this.active();
    if (act.length && act.every((p) => this.picks.has(p.id))) { this.room.fx('allin'); this.reveal(); }
  }

  reveal() {
    if (this.phase !== 'pick') return;
    const c = this.cur, k = c.kind, mult = c.final ? 2 : 1, ms = this.pickMs();
    // Drafts count when the clock runs out (a mix that was never locked in).
    for (const [id, d] of this.drafts) if (!this.picks.has(id) && this.room.get(id)) this.picks.set(id, { colors: d, ms, late: true });
    const res = { kind: k, round: this.round, final: c.final, obj: c.obj || null, name: c.name || null, ref: c.ref || null, ends: c.ends || null, entries: [] };
    let target = c.target;
    if (k === 'name') {
      const labs = [...this.picks.values()].map((pk) => rgbToLab(fromHex(pk.colors[0])));
      res.crowd = labs.length >= 3;
      res.avg = labs.length ? hex(labToRgb(avgLab(labs))) : null;
      target = res.crowd ? res.avg : c.ref;
    }
    if (k === 'odd') { res.tiles = c.tiles; res.odd = c.odd; res.base = c.base; res.oddColor = c.oddColor; res.counts = Array(GRID).fill(0); }
    res.target = target;
    for (const [id, pk] of this.picks) {
      const p = this.room.get(id); if (!p) continue;
      const e = { id, name: p.name, avatar: p.avatar, color: p.color, gear: GEARS.gearSet(p, 'colormatch'), ms: pk.ms, late: !!pk.late }; // gear: frames this mix on the reveal
      const st = this.stat(id);
      if (k === 'odd') {
        res.counts[pk.i]++;
        e.i = pk.i; e.correct = pk.i === c.odd; e.secs = Math.round(pk.ms / 100) / 10;
        e.pct = e.correct ? 100 : 0; e.perfect = e.correct;
        e.base = e.correct ? 300 + Math.round(500 * clamp(1 - pk.ms / ms, 0, 1)) : 0;
        if (e.correct) { st.oddFound++; if (st.oddMs == null || pk.ms < st.oddMs) st.oddMs = pk.ms; }
      } else {
        e.picks = pk.colors;
        const tg = [].concat(target);
        const pcts = tg.map((t, i) => matchPct(distHex(t, pk.colors[i] || pk.colors[0])));
        const raw = pcts.reduce((a, b) => a + b, 0) / pcts.length;
        e.raw = Math.round(raw * 10) / 10; e.pct = Math.round(raw); if (tg.length > 1) e.parts = pcts.map(Math.round);
        e.perfect = e.pct >= PERFECT;
        e.base = Math.round((raw * raw) / 10);
        st.n++; st.sum += raw;
        const label = this.roundLabel(c);
        if (!st.best || raw > st.best.pct) st.best = { pct: e.pct, label, round: this.round };
        if (!st.worst || raw < st.worst.pct) st.worst = { pct: e.pct, label, round: this.round };
        if (k === 'name' && res.crowd) { st.nameSum += raw; st.nameN++; }
      }
      if (!pk.late) { st.lockMs += pk.ms; st.locks++; }
      const cb = e.perfect ? (this.combo.get(id) || 0) + 1 : 0;
      this.combo.set(id, cb); e.combo = cb; if (cb > st.maxCombo) st.maxCombo = cb;
      e.bonus = e.perfect ? Math.min(500, 100 * cb) : 0;
      e.pts = (e.base + e.bonus) * mult;
      this.points.set(id, (this.points.get(id) || 0) + e.pts);
      res.entries.push(e);
    }
    // Players who never mixed lose their combo.
    for (const p of this.room.list()) if (!this.picks.has(p.id)) this.combo.set(p.id, 0);
    res.entries.sort(k === 'odd' ? (a, b) => (b.correct - a.correct) || (a.ms - b.ms) : (a, b) => (b.raw - a.raw) || (a.ms - b.ms));
    res.entries.forEach((e, i) => { e.rank = i + 1; });
    res.perfects = res.entries.filter((e) => e.perfect).length;
    this.result = res;
    this.history.push({ kind: k, target: k === 'odd' ? c.oddColor : target, name: c.name || null, obj: c.obj || null, label: this.roundLabel(c) });
    this.phase = 'reveal'; this.room.fx('reveal', { kind: k });
    if (res.perfects) this.room.fx('perfect');
    const n = res.entries.length;
    this.setTimer(Math.min(13000, 7000 + n * 320), () => this.nextRound());
  }
  roundLabel(c) {
    if (c.kind === 'name') return `“${c.name}”`;
    if (c.kind === 'gradient') return 'the halfway colour';
    if (c.kind === 'two') return 'the Two-Tone round';
    if (c.kind === 'blink') return 'the Blink round';
    if (c.kind === 'odd') return 'Odd One Out';
    return c.obj ? OBJECT_NAMES[c.obj] : 'the paint swatch';
  }

  end() {
    this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.result = null;
    this.final = this.awards();
    this.room.fx('win');
  }
  // End-of-game awards, each to a different person where possible.
  awards() {
    const rows = [...this.stats].filter(([id]) => this.room.get(id)).map(([id, st]) => ({ id, st }));
    const who = (id) => { const p = this.room.get(id); return { id, name: p.name, avatar: p.avatar, color: p.color, gear: GEARS.gearSet(p, 'colormatch') }; };
    const defs = [
      { icon: '🦅', title: 'Eagle Eye', list: rows.filter((r) => r.st.n >= 2).sort((a, b) => b.st.sum / b.st.n - a.st.sum / a.st.n), text: (r) => `${Math.round(r.st.sum / r.st.n)}% average match` },
      { icon: '🔥', title: 'On Fire', list: rows.filter((r) => r.st.maxCombo >= 2).sort((a, b) => b.st.maxCombo - a.st.maxCombo), text: (r) => `${r.st.maxCombo} perfect matches in a row` },
      { icon: '🎯', title: 'Bullseye', list: rows.filter((r) => r.st.best).sort((a, b) => b.st.best.pct - a.st.best.pct), text: (r) => `${r.st.best.pct}% on ${r.st.best.label}` },
      { icon: '🙈', title: 'Colour Blind?', list: rows.filter((r) => r.st.worst && r.st.worst.pct < 80).sort((a, b) => a.st.worst.pct - b.st.worst.pct), text: (r) => `a bold ${r.st.worst.pct}% on ${r.st.worst.label}. We love the confidence!` },
      { icon: '🐝', title: 'Hive Mind', list: rows.filter((r) => r.st.nameN).sort((a, b) => b.st.nameSum / b.st.nameN - a.st.nameSum / a.st.nameN), text: (r) => `${Math.round(r.st.nameSum / r.st.nameN)}% like the room’s average` },
      { icon: '🔍', title: 'Sharp Spotter', list: rows.filter((r) => r.st.oddMs != null).sort((a, b) => a.st.oddMs - b.st.oddMs), text: (r) => `found the odd tile in ${(r.st.oddMs / 1000).toFixed(1)} s` },
      { icon: '⚡', title: 'Quick Brush', list: rows.filter((r) => r.st.locks >= 2).sort((a, b) => a.st.lockMs / a.st.locks - b.st.lockMs / b.st.locks), text: (r) => `locked in after ${(r.st.lockMs / r.st.locks / 1000).toFixed(1)} s on average` },
    ];
    const given = new Set(), out = [];
    for (const d of defs) {
      if (!d.list.length || out.length >= 6) continue;
      const r = d.list.find((x) => !given.has(x.id)) || d.list[0];
      if (!r) continue;
      given.add(r.id); out.push({ icon: d.icon, title: d.title, ...who(r.id), text: d.text(r) });
    }
    return { awards: out, palette: this.history.map((h) => ({ c: h.target, kind: h.kind, label: h.label })) };
  }
  next() {
    if (this.phase === 'intro') this.afterIntro();
    else if (this.phase === 'look') this.startPick();
    else if (this.phase === 'pick') this.reveal();
    else if (this.phase === 'reveal') this.nextRound();
  }
  standings() {
    return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => { const p = this.room.get(id); return { id, name: p.name, avatar: p.avatar, color: p.color, gear: GEARS.gearSet(p, 'colormatch'), points: pts, combo: this.combo.get(id) || 0 }; }).sort((a, b) => b.points - a.points);
  }
  // Party points: player ids best-first once the game is over.
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }

  act(p, m) {
    m = m || {};
    if (!this.points.has(p.id)) this.joined(p);
    if (m.op === 'mix' || m.op === 'lock') {
      if (this.phase !== 'pick' || this.cur.kind === 'odd') return m.op === 'mix' ? { ok: true, quiet: true } : { ok: false, error: 'Not now.' };
      if (this.picks.has(p.id)) return m.op === 'mix' ? { ok: true, quiet: true } : { ok: false, error: 'You already locked in.' };
      const cols = cleanColors(m.colors, this.cur.kind === 'two' ? 2 : 1);
      if (!cols) return { ok: false, error: 'Mix a colour first.' };
      if (m.op === 'mix') { this.drafts.set(p.id, cols); return { ok: true, quiet: true }; }
      this.lock(p, cols); return { ok: true };
    }
    if (m.op === 'odd') {
      if (this.phase !== 'pick' || this.cur.kind !== 'odd') return { ok: false, error: 'Not now.' };
      if (this.picks.has(p.id)) return { ok: false, error: 'You already picked a tile.' };
      const i = Number(m.i);
      if (!Number.isInteger(i) || i < 0 || i >= GRID) return { ok: false, error: 'Tap one of the tiles.' };
      this.lockOdd(p, i); return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }

  // Public state: the target colour is only sent while it is on show ('look') and at the reveal.
  tv() {
    const c = this.cur || {}, ph = this.phase;
    const pub = { kind: c.kind, ...KINDS[c.kind || 'memory'], final: !!c.final };
    if (ph === 'look') { pub.target = c.target; pub.obj = c.obj || null; pub.lookMs = LOOK_MS[c.kind]; }
    if (ph === 'pick' || ph === 'intro') { pub.obj = c.kind === 'memory' ? c.obj || null : null; }
    if (ph === 'pick' || ph === 'look' || ph === 'intro') { if (c.kind === 'name') pub.name = c.name; if (c.kind === 'gradient') pub.ends = c.ends; }
    if (ph === 'pick' && c.kind === 'odd') pub.tiles = c.tiles;
    const act = this.active();
    return {
      phase: ph, round: this.round, of: this.total, endsIn: this.endsAt && ph !== 'over' ? Math.max(0, this.endsAt - this.room.now()) : 0,
      cur: pub, locked: act.filter((p) => this.picks.has(p.id)).length, players: act.length,
      chips: act.slice(0, 40).map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, color: p.color, in: this.picks.has(p.id) })),
      result: ph === 'reveal' ? this.result : null, final: ph === 'over' ? this.final : null,
      palette: this.history.map((h) => h.target), standings: this.standings().slice(0, 20),
    };
  }
  view(p) {
    const t = this.tv(), mine = this.picks.get(p.id), st = this.standings(), rank = st.findIndex((r) => r.id === p.id) + 1;
    if (t.phase === 'look') { t.cur = { ...t.cur }; delete t.cur.target; } // phones look at the TV
    const res = t.result, me = res ? res.entries.find((e) => e.id === p.id) || null : null;
    if (res) t.result = { ...res, entries: res.entries.slice(0, 3), count: res.entries.length };
    t.standings = st.slice(0, 8);
    return { ...t, locked: !!mine, mine: mine ? (mine.colors || null) : null, myTile: mine && mine.i != null ? mine.i : null, me,
      points: this.points.get(p.id) || 0, rank, combo: this.combo.get(p.id) || 0, myAwards: this.final ? this.final.awards.filter((a) => a.id === p.id) : [],
      myBest: this.stats.get(p.id) && this.stats.get(p.id).best };
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ minutes: M }) => {
  const seconds = M <= 7 ? 15 : 20;
  const { rounds } = PF.best({ rounds: [7, 5, 10] }, (s) => 0.5 + s.rounds * (seconds + 40) / 60, M);
  return { rounds, seconds };
};

module.exports = {
  partyFit,
  key: 'colormatch', name: 'Color Match', min: 2, best: [2, 20], fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/colormatch.js)
  locked: { how: 'Finish a game of Emoji Charades to unlock it.' }, // public/unlocks.js + UNLOCK_RULES in box/room.js
  create: (room, settings) => new Game(room, settings),
  // Exposed for the tests.
  _color: { hsvToRgb, hex, fromHex, rgbToLab, labToRgb, deltaE00, distHex, matchPct, cleanColor, KINDS, NAMES, OBJECTS },
};
