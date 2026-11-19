'use strict';
// JustPizza: Nonna Pina's pizzeria. A customer comes to the counter and shows (or tells) the
// pizza they want; then it's hidden and everyone rebuilds it from memory on their phone: crust,
// sauce, cheese, and toppings painted onto the slices. The closest pizza earns the biggest tip.
//
// A pizza: { crust, sauce, cheese, top: { <topping>: mask } }. The pie has 8 slices, numbered
// clockwise from 12 o'clock; a topping's mask has bit i set when it covers slice i.
// Scoring (match(), 0..100) compares crust, sauce, cheese and the toppings: which kinds, how many
// slices each, and where they sit. A pizza is round, so placement is compared under every turn
// and flip of the pie (pepperoni on "one half" can be either half). Deterministic, no randomness.
//
// Modes (setting `mode`, like Quick Draw's variations):
//   classic  Classic Order: the customer shows the pizza for a few seconds.
//   rush     Lunch Rush: twice the orders, small and quick; serving early earns a speed tip.
//   halves   Half & Half: a different topping on every half or quarter.
//   phone    Phone Order: no picture, the customer reads the order out in words.
//   flash    Flash Order: a glimpse of two seconds, and more toppings.
//   chef     Head Chef: one player sees the ticket on their phone and describes it out loud;
//            everyone else builds. The head chef earns the cooks' average. It rotates.
//   mixed    A different mode every round.
// Every phone input is validated; timers use room.after; results() lists ids best-first.
const GEARS = require('../../public/shared/gear');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const MODES = {
  classic: { name: 'Classic Order', icon: '🍕', peek: 6000, build: 1, tops: [2, 3], place: ['whole', 'whole', 'half'] },
  rush: { name: 'Lunch Rush', icon: '⏱️', peek: 3500, build: 0.5, tops: [1, 2], place: ['whole', 'whole', 'whole', 'half'], speed: true },
  halves: { name: 'Half & Half', icon: '🌗', peek: 7000, build: 1, sections: true },
  phone: { name: 'Phone Order', icon: '☎️', peek: 9500, build: 1, tops: [2, 3], place: ['whole', 'half', 'half'], words: true },
  flash: { name: 'Flash Order', icon: '⚡', peek: 2200, build: 1, tops: [4, 5], place: ['whole', 'half', 'half'] },
  chef: { name: 'Head Chef', icon: '👩‍🍳', peek: 4000, build: 1.25, tops: [3, 4], place: ['whole', 'half', 'half'], chef: true },
};
const MODE_KEYS = Object.keys(MODES);
const fields = [
  { key: 'mode', label: 'Kitchen mode', options: opt([['classic', '🍕 Classic Order'], ['rush', '⏱️ Lunch Rush'], ['halves', '🌗 Half & Half'], ['phone', '☎️ Phone Order'], ['flash', '⚡ Flash Order'], ['chef', '👩‍🍳 Head Chef'], ['mixed', '🎲 Mixed (a new mode each order)']]) },
  { key: 'rounds', label: 'Orders', options: opt([[3, '3 orders'], [5, '5 orders'], [8, '8 orders']]) },
  { key: 'seconds', label: 'Time to build', options: opt([[30, '30 seconds'], [45, '45 seconds'], [60, '60 seconds']]) },
];
const defaults = { mode: 'mixed', rounds: 5, seconds: 45 };

const CRUSTS = ['thin', 'classic', 'deep'];
const SAUCES = ['tomato', 'white', 'pesto', 'bbq', 'none'];
const TOPPINGS = ['pepperoni', 'mushroom', 'pepper', 'olive', 'onion', 'pineapple', 'ham', 'basil', 'jalapeno', 'sausage'];
const NAMES = { thin: 'thin crust', classic: 'classic crust', deep: 'deep dish', tomato: 'tomato sauce', white: 'white garlic sauce', pesto: 'pesto', bbq: 'barbecue sauce', none: 'no sauce', pepperoni: 'pepperoni', mushroom: 'mushrooms', pepper: 'green peppers', olive: 'black olives', onion: 'red onion', pineapple: 'pineapple', ham: 'ham', basil: 'basil', jalapeno: 'jalapeños', sausage: 'sausage' };
const CHEESE_WORD = ['no cheese', 'cheese', 'extra cheese'];
const WHOLE = 0xff, HALVES = [0x0f, 0xf0], QUARTERS = [0x03, 0x0c, 0x30, 0xc0];
const W = { crust: 0.08, sauce: 0.12, cheese: 0.1, top: 0.7 };

// The customers who come to the counter (drawn on the TV from these looks).
const CUSTOMERS = [
  { id: 'gus', name: 'Gus', job: 'the firefighter', skin: '#e0a67a', shirt: '#d6452f', hat: 'helmet', hair: '#3a2416' },
  { id: 'dot', name: 'Dot', job: 'the marathon runner', skin: '#8d5a3b', shirt: '#2fb3a4', hat: 'band', hair: '#1d120b' },
  { id: 'ted', name: 'Grandpa Ted', job: 'the retired sailor', skin: '#f0c4a0', shirt: '#2c4f8a', hat: 'sailor', hair: '#e9e4dc', beard: true },
  { id: 'kiki', name: 'Kiki', job: 'the skateboarder', skin: '#c98d62', shirt: '#9b5de5', hat: 'cap', hair: '#ff5fa2' },
  { id: 'lou', name: 'Big Lou', job: 'the trucker', skin: '#b5784f', shirt: '#4a7a3a', hat: 'trucker', hair: '#2a1a10', beard: true },
  { id: 'mia', name: 'Little Mia', job: 'who just won her football match', skin: '#f2c9a5', shirt: '#ffb703', hat: 'bows', hair: '#7a3e1d', kid: true },
  { id: 'hugo', name: 'Professor Hugo', job: 'the astronomer', skin: '#d7a07a', shirt: '#6b4fa0', hat: 'none', hair: '#8a8a8a', glasses: true },
  { id: 'daisy', name: 'Officer Daisy', job: 'on her lunch break', skin: '#6e4630', shirt: '#2a3f6e', hat: 'police', hair: '#1b0f08' },
  { id: 'biscuit', name: 'Biscuit', job: 'a very good dog', dog: true, skin: '#c8924f', shirt: '#e63946', hat: 'none', hair: '#8a5a2b' },
];
// Nonna Pina's lines during the game (copied into the intro's `story` so they are pre-voiced).
const NONNA = {
  first: 'Here comes our first customer. Look closely, my darlings!',
  look: ['Eyes on the order. Remember everything!', 'Look, look! Crust, sauce, cheese, toppings.', 'Another hungry customer. Watch carefully!'],
  phone: 'The phone is ringing! Listen carefully.',
  flash: 'Blink and you miss it!',
  rush: 'Lunch rush! Fast, fast, fast!',
  chef: 'One of you has the ticket. Read it out loud, and do not show your phone!',
  chefBuild: 'Listen to your head chef, and build it!',
  build: ['Now make it! From memory!', 'Quick, quick, before the oven gets cold!', 'To your stations! Make it just like the order.'],
  great: ['Perfetto! Just like my mamma made.', 'Bellissimo! The customer is so happy.'],
  ok: ['Not bad, not bad. A little more love next time.', 'Close! The customer will still pay.'],
  bad: ['Mamma mia! What is this?', 'Oh no. That customer will not come back.'],
  last: 'Last order of the night. Make it beautiful!',
  over: 'We close the shop. Grazie, my cooks, you did beautifully!',
};
const REVEAL_MS = 9000, RUSH_REVEAL_MS = 6500, WALK_MS = 1600;
const BEST_BONUS = 150;

const pop8 = (m) => { let n = 0; for (let i = 0; i < 8; i++) if (m & (1 << i)) n++; return n; };
const rot = (m, r) => ((m << r) | (m >>> (8 - r))) & 0xff;
const flip = (m) => { let o = 0; for (let i = 0; i < 8; i++) if (m & (1 << i)) o |= 1 << (7 - i); return o; };

// A clean pizza from anything a phone sends (null when it isn't a pizza at all).
function clean(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const out = { crust: CRUSTS.includes(p.crust) ? p.crust : 'classic', sauce: SAUCES.includes(p.sauce) ? p.sauce : 'none', cheese: Number.isInteger(p.cheese) && p.cheese >= 0 && p.cheese <= 2 ? p.cheese : 0, top: {} };
  const t = p.top && typeof p.top === 'object' && !Array.isArray(p.top) ? p.top : {};
  for (const k of TOPPINGS) { const m = t[k]; if (Number.isInteger(m) && m > 0 && m <= 0xff) out.top[k] = m; }
  return out;
}
// How close `got` is to `want`, 0..100. An empty (missing) pizza scores 0.
function match(want, got) {
  if (!want || !got) return 0;
  const ci = CRUSTS.indexOf(want.crust), cj = CRUSTS.indexOf(got.crust);
  const crust = ci === cj ? 1 : Math.abs(ci - cj) === 1 ? 0.4 : 0;
  const sauce = want.sauce === got.sauce ? 1 : 0;
  const cheese = Math.max(0, 1 - Math.abs((want.cheese || 0) - (got.cheese || 0)) * 0.5);
  const kinds = TOPPINGS.filter((k) => (want.top[k] || 0) || (got.top[k] || 0));
  let top = 1;
  if (kinds.length) {
    // Placement: the best overlap (Jaccard over slice+topping pairs) under any turn or flip.
    let place = 0;
    for (let f = 0; f < 2; f++) for (let r = 0; r < 8; r++) {
      let inter = 0, uni = 0;
      for (const k of kinds) { const a = want.top[k] || 0, b = rot(f ? flip(got.top[k] || 0) : got.top[k] || 0, r); inter += pop8(a & b); uni += pop8(a | b); }
      place = Math.max(place, uni ? inter / uni : 1);
    }
    // Amounts: each topping kind, how many slices it covers (missing or extra kinds score 0).
    let amt = 0;
    for (const k of kinds) { const a = pop8(want.top[k] || 0), b = pop8(got.top[k] || 0); amt += Math.min(a, b) / Math.max(a, b); }
    top = 0.55 * place + 0.45 * (amt / kinds.length);
  }
  return Math.round(100 * (W.crust * crust + W.sauce * sauce + W.cheese * cheese + W.top * top));
}
// The order read out in words (Phone Order, and the head chef's ticket).
function describe(o) {
  const base = `A ${NAMES[o.crust]}, ${NAMES[o.sauce]}, ${CHEESE_WORD[o.cheese] || 'cheese'}`;
  const secs = o.sections || [];
  if (!secs.length) return base + '. Nothing else on it.';
  const list = (a) => (a.length < 2 ? a[0] : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const nm = (ks) => list(ks.map((k) => NAMES[k]));
  const whole = secs.filter((s) => s.kind === 'whole'), halves = secs.filter((s) => s.kind === 'half'), quarters = secs.filter((s) => s.kind === 'quarter');
  const parts = [];
  if (whole.length) parts.push(`${nm(whole.flatMap((s) => s.kinds))} all over`);
  if (halves.length === 2) parts.push(`${nm(halves[0].kinds)} on one half and ${nm(halves[1].kinds)} on the other half`);
  else if (halves.length === 1) parts.push(`${nm(halves[0].kinds)} on just one half`);
  if (quarters.length) {
    const q = quarters.slice().sort((a, b) => a.at - b.at);
    parts.push(q.length === 1 ? `${nm(q[0].kinds)} on just one quarter` : `going around the pie, one quarter each: ${q.map((s) => nm(s.kinds)).join(', then ')}${q.length < 4 ? ', and the rest plain' : ''}`);
  }
  return `${base}: ${parts.join('; ')}.`;
}

class Game {
  constructor(room, s) {
    this.room = room;
    const pick = (f, v) => (f.options.some((o) => String(o.value) === String(v)) ? f.options.find((o) => String(o.value) === String(v)).value : defaults[f.key]);
    this.s = {}; for (const f of fields) this.s[f.key] = pick(f, s ? s[f.key] : undefined);
    this.phase = 'intro'; this.round = 0; this.total = this.s.mode === 'rush' ? this.s.rounds * 2 : this.s.rounds;
    this.c = null; this.points = new Map(); this.stats = new Map(); this.timer = null; this.endsAt = 0;
    this.nonna = null; this.nonnaSeq = 0; this.history = []; this.lastMode = null; this.chefTurn = 0; this.final = null;
    this.custBag = [];
  }
  now() { return this.room.now(); }
  rng() { return this.room.rng(); }
  ri(a, b) { return a + Math.floor(this.rng() * (b - a + 1)); }
  pickOf(a) { return a[Math.floor(this.rng() * a.length) % a.length]; }
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.now() + ms; this.timer = this.room.after(Math.max(0, ms), fn); }
  stat(id) { let s = this.stats.get(id); if (!s) { s = { best: 0, perfect: 0, served: 0, fast: null, sum: 0, n: 0, chef: 0 }; this.stats.set(id, s); } return s; }
  active() { return this.room.list().filter((p) => p.bot || p.sockets > 0); }
  pub(id) { const p = this.room.get(id); return p ? { id, name: p.name, avatar: p.avatar, color: p.color, gear: GEARS.gearSet(p, 'pizza') } : { id, name: '—', avatar: '👻', color: '#888' }; }
  say(text) { if (text) this.nonna = { text, key: ++this.nonnaSeq, at: this.now() }; }
  line(k) { const v = NONNA[k]; return Array.isArray(v) ? this.pickOf(v) : v; }

  start() { for (const p of this.room.list()) { this.points.set(p.id, 0); this.stat(p.id); } this.nextRound(); }
  joined(p) { if (!this.points.has(p.id)) this.points.set(p.id, 0); this.stat(p.id); }
  left() { this.checkDone(); }

  // ---------- orders ----------
  modeFor() {
    if (this.s.mode !== 'mixed') return this.s.mode === 'chef' && this.active().length < 2 ? 'phone' : this.s.mode;
    let pool = MODE_KEYS.filter((k) => k !== this.lastMode && !(k === 'chef' && this.active().length < 3));
    if (!pool.length) pool = ['classic'];
    return this.pickOf(pool);
  }
  makeOrder(mode) {
    const M = MODES[mode];
    const o = { crust: this.pickOf(CRUSTS), sauce: this.pickOf(['tomato', 'tomato', 'tomato', 'white', 'pesto', 'bbq', 'none']), cheese: this.pickOf([1, 1, 1, 2, 2, 0]), top: {}, sections: [] };
    const kinds = this.shuffle(TOPPINGS);
    const add = (kind, mask, ks, at = 0) => { o.sections.push({ kind, mask, kinds: ks, at }); for (const k of ks) o.top[k] = (o.top[k] || 0) | mask; };
    if (M.sections) {
      if (this.rng() < 0.5) { // halves: 1-2 toppings each side
        add('half', HALVES[0], kinds.splice(0, this.ri(1, 2))); add('half', HALVES[1], kinds.splice(0, this.ri(1, 2)));
      } else { // quarters (sometimes with a topping all over too)
        if (this.rng() < 0.35) add('whole', WHOLE, kinds.splice(0, 1));
        QUARTERS.forEach((m, i) => add('quarter', m, kinds.splice(0, 1), i));
      }
    } else {
      const n = this.ri(...M.tops); let halfSlot = 0, qSlot = 0;
      for (let i = 0; i < n; i++) {
        const k = kinds.pop(); let pl = this.pickOf(M.place);
        if (pl === 'half' && halfSlot > 1) pl = 'whole';
        if (pl === 'quarter' && qSlot > 3) pl = 'whole';
        if (pl === 'whole') { const w = o.sections.find((s) => s.kind === 'whole'); if (w) { w.kinds.push(k); o.top[k] = WHOLE; } else add('whole', WHOLE, [k]); }
        else if (pl === 'half') add('half', HALVES[halfSlot++], [k]);
        else { add('quarter', QUARTERS[qSlot], [k], qSlot); qSlot++; }
      }
    }
    o.words = describe(o);
    return o;
  }
  nextCustomer() {
    if (!this.custBag.length) this.custBag = this.shuffle(CUSTOMERS.map((c) => c.id));
    const id = this.custBag.pop(); return CUSTOMERS.find((c) => c.id === id);
  }

  // ---------- a round: order (memorize) -> build -> reveal ----------
  nextRound() {
    if (this.round >= this.total) return this.end();
    this.round++;
    const mode = this.modeFor(); this.lastMode = mode;
    const M = MODES[mode], order = this.makeOrder(mode);
    let chef = null;
    if (M.chef) {
      const pool = this.active(); const humans = pool.filter((p) => !p.bot), list = humans.length >= 2 ? humans : pool;
      chef = list.length ? list[this.chefTurn++ % list.length].id : null;
    }
    const peek = M.peek;
    this.c = { id: this.round, mode, order, customer: this.nextCustomer(), chef, peek, showAt: this.now() + WALK_MS, drafts: new Map(), served: new Map(), rows: null, buildMs: 0 };
    this.phase = 'order';
    this.say(this.line(this.round === this.total && this.total > 1 ? 'last' : M.words ? 'phone' : mode === 'flash' ? 'flash' : mode === 'rush' && this.round <= 2 ? 'rush' : M.chef ? 'chef' : this.round === 1 ? 'first' : 'look'));
    this.room.fx('order', { mode });
    this.setTimer(WALK_MS + peek, () => this.build());
    const cid = this.c.id; this.room.after(WALK_MS, () => { if (this.c && this.c.id === cid) this.room.fx('shown'); }); // the TV gets the order once the customer reaches the counter
  }
  build() {
    const c = this.c; if (!c || this.phase !== 'order') return;
    this.phase = 'build';
    const M = MODES[c.mode];
    c.buildMs = Math.max(15000, Math.round(this.s.seconds * 1000 * M.build));
    c.buildAt = this.now(); c.endAt = c.buildAt + c.buildMs;
    this.say(this.line(M.chef ? 'chefBuild' : 'build'));
    this.room.fx('build');
    this.setTimer(c.buildMs, () => this.reveal());
    for (const p of this.room.list()) if (p.bot && p.id !== c.chef) this.botPlan(p);
  }
  // A bot remembers the order imperfectly, then serves at a random moment.
  botPlan(p) {
    const c = this.c, cid = c.id;
    let skill = 0.45 + ((String(p.id).length * 7 + String(p.name).length * 13) % 40) / 100; // 0.45–0.84, steady per bot
    if (c.mode === 'flash') skill -= 0.15; if (c.mode === 'chef' || c.mode === 'phone') skill -= 0.05;
    const pz = this.botMemory(c.order, skill);
    const at = c.buildMs * (0.3 + this.rng() * 0.6);
    this.room.after(at * 0.5, () => { if (this.c && this.c.id === cid && this.phase === 'build' && !c.served.has(p.id)) c.drafts.set(p.id, pz); });
    this.room.after(at, () => { if (this.c && this.c.id === cid && this.phase === 'build') this.serve(p, pz); });
  }
  botMemory(o, skill) {
    const miss = (k = 1) => this.rng() > skill + (1 - skill) * (1 - k);
    const pz = { crust: miss(0.6) ? this.pickOf(CRUSTS) : o.crust, sauce: miss(0.5) ? this.pickOf(SAUCES) : o.sauce, cheese: miss(0.6) ? this.ri(0, 2) : o.cheese, top: {} };
    for (const k of Object.keys(o.top)) {
      if (miss(0.4)) continue; // forgot it
      let m = o.top[k];
      if (miss(0.5)) m = this.pickOf([WHOLE, HALVES[0], HALVES[1], QUARTERS[this.ri(0, 3)]]); // wrong place
      const kk = miss(0.3) ? this.pickOf(TOPPINGS) : k; // mixed it up with another topping
      pz.top[kk] = (pz.top[kk] || 0) | m;
    }
    return pz;
  }

  serve(p, pz) {
    const c = this.c; if (!c || this.phase !== 'build' || c.served.has(p.id) || p.id === c.chef) return false;
    c.drafts.set(p.id, pz); c.served.set(p.id, this.now());
    this.room.fx('serve', { id: p.id });
    this.checkDone();
    return true;
  }
  builders() { const c = this.c; return this.active().filter((p) => !c || p.id !== c.chef); }
  checkDone() {
    const c = this.c; if (!c || this.phase !== 'build') return;
    const b = this.builders();
    if (b.length && b.every((p) => c.served.has(p.id))) this.setTimer(900, () => this.reveal());
    else if (!b.length) this.setTimer(900, () => this.reveal());
  }
  reveal() {
    const c = this.c; if (!c || this.phase !== 'build') return;
    this.phase = 'reveal';
    const M = MODES[c.mode], rows = [];
    for (const [id, pz] of c.drafts) {
      if (id === c.chef || !this.room.get(id)) continue;
      const score = match(c.order, pz), at = c.served.get(id);
      let tip = score * 10, speed = 0;
      if (M.speed && at != null && score >= 50) speed = Math.round(score * 3 * Math.max(0, (c.endAt - at) / c.buildMs));
      rows.push({ id, pizza: pz, score, tip, speed, served: at != null, secs: at != null ? Math.round((at - c.buildAt) / 100) / 10 : null });
    }
    // Cooks who never touched their phone this round: an empty plate.
    for (const p of this.builders()) if (!c.drafts.has(p.id)) rows.push({ id: p.id, pizza: null, score: 0, tip: 0, speed: 0, served: false, secs: null });
    rows.sort((a, b) => b.score - a.score || (a.secs == null ? 1e9 : a.secs) - (b.secs == null ? 1e9 : b.secs));
    const top = rows.length ? rows[0].score : 0;
    for (const r of rows) {
      r.best = top > 0 && r.score === top;
      r.gain = r.tip + r.speed + (r.best ? BEST_BONUS : 0);
      this.points.set(r.id, (this.points.get(r.id) || 0) + r.gain);
      const st = this.stat(r.id); st.best = Math.max(st.best, r.score); st.sum += r.score; st.n++;
      if (r.score >= 95) st.perfect++;
      if (r.served) { st.served++; if (st.fast == null || r.secs < st.fast) st.fast = r.secs; }
    }
    let chefRow = null;
    if (c.chef && this.room.get(c.chef)) {
      const cooked = rows.filter((r) => r.pizza), avg = cooked.length ? Math.round(cooked.reduce((a, r) => a + r.score, 0) / cooked.length) : 0;
      chefRow = { id: c.chef, avg, gain: avg * 8 };
      this.points.set(c.chef, (this.points.get(c.chef) || 0) + chefRow.gain); this.stat(c.chef).chef++;
    }
    c.rows = rows; c.chefRow = chefRow; c.top = top;
    const mood = top >= 85 ? 'great' : top >= 55 ? 'ok' : 'bad';
    c.mood = mood;
    this.say(this.line(mood));
    this.history.push({ mode: c.mode, top, best: rows[0] && rows[0].best ? rows[0].id : null, customer: c.customer.name });
    this.room.fx('reveal', { mood });
    this.setTimer(c.mode === 'rush' ? RUSH_REVEAL_MS : REVEAL_MS, () => this.nextRound());
  }
  end() {
    this.room.cancel(this.timer); this.phase = 'over'; this.endsAt = 0;
    const st = this.standings();
    this.final = { standings: st, awards: this.awards() };
    this.say(this.line('over'));
    this.room.fx('win');
  }
  awards() {
    const ids = [...this.stats.keys()].filter((id) => this.room.get(id)), A = [];
    const best = (f, cmp, ok = () => true) => { let w = null; for (const id of ids) { const v = f(this.stat(id)); if (v == null || !ok(v)) continue; if (!w || cmp(v, w.v) < 0) w = { id, v }; } return w; };
    const add = (key, icon, title, w, txt) => { if (w) A.push({ key, icon, title, ...this.pub(w.id), text: txt(w.v) }); };
    add('best', '🏅', 'Best Pizza', best((s) => s.best, (a, b) => b - a, (v) => v > 0), (v) => `a ${v}% match`);
    add('perfect', '👌', 'Perfetto!', best((s) => s.perfect, (a, b) => b - a, (v) => v > 0), (v) => `${v} near-perfect pizza${v === 1 ? '' : 's'}`);
    add('fast', '🛵', 'Fastest Hands', best((s) => s.fast, (a, b) => a - b), (v) => `served in ${v}s`);
    add('steady', '🎯', 'Steady Cook', best((s) => (s.n >= 2 ? Math.round(s.sum / s.n) : null), (a, b) => b - a), (v) => `${v}% average match`);
    return A;
  }
  standings() {
    return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ ...this.pub(id), points: pts, best: this.stat(id).best }))
      .sort((a, b) => b.points - a.points || b.best - a.best || a.name.localeCompare(b.name));
  }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }
  next() {
    if (this.phase === 'order') return this.build();
    if (this.phase === 'build') return this.reveal();
    if (this.phase === 'reveal') return this.nextRound();
  }

  act(p, m) {
    m = m || {};
    const c = this.c;
    if (m.op === 'build' || m.op === 'serve') {
      if (this.phase !== 'build' || !c) return { ok: false, quiet: true };
      if (p.id === c.chef) return { ok: false, error: 'You’re the head chef: describe the order out loud!' };
      if (Number(m.round) && Number(m.round) !== c.id) return { ok: false, quiet: true };
      const pz = clean(m.pizza); if (!pz) return { ok: false, error: 'That isn’t a pizza.' };
      if (c.served.has(p.id)) return { ok: false, quiet: true, served: true };
      if (m.op === 'build') { c.drafts.set(p.id, pz); return { ok: true, quiet: true }; }
      this.serve(p, pz); return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }

  // ---------- screens ----------
  // Is the order on the TV right now? (The secret stays on the server until then.)
  tvOrder() {
    const c = this.c; if (!c) return { picture: false, words: false };
    if (this.phase === 'reveal') return { picture: true, words: true };
    const M = MODES[c.mode];
    if (this.phase === 'order') {
      if (M.chef) return { picture: false, words: false };
      return { picture: !M.words && this.now() >= c.showAt, words: !!M.words && this.now() >= c.showAt };
    }
    // build: only when the head chef can't describe it (a bot, or they left): then the ticket is read out.
    if (this.phase === 'build' && M.chef) { const ch = c.chef && this.room.get(c.chef); if (!ch || ch.bot || !(ch.sockets > 0)) return { picture: false, words: true }; }
    return { picture: false, words: false };
  }
  cPub() {
    const c = this.c; if (!c) return null;
    const M = MODES[c.mode], vis = this.tvOrder();
    const o = { id: c.id, mode: c.mode, modeName: M.name, modeIcon: M.icon, customer: c.customer, chef: c.chef ? this.pub(c.chef) : null, showIn: Math.max(0, c.showAt - this.now()), peek: c.peek, speed: !!M.speed };
    if (vis.picture) o.order = { crust: c.order.crust, sauce: c.order.sauce, cheese: c.order.cheese, top: c.order.top };
    if (vis.words) o.words = c.order.words;
    if (this.phase === 'build' || this.phase === 'reveal') {
      const b = this.builders();
      o.cooks = b.slice(0, 40).map((p) => ({ ...this.pub(p.id), served: c.served.has(p.id), busy: c.drafts.has(p.id) }));
      o.served = b.filter((p) => c.served.has(p.id)).length; o.of = b.length;
    }
    if (this.phase === 'reveal' && c.rows) {
      o.rows = c.rows.slice(0, 12).map((r) => ({ ...this.pub(r.id), pizza: r.pizza, score: r.score, gain: r.gain, speed: r.speed, best: r.best, secs: r.secs }));
      o.more = Math.max(0, c.rows.length - 12); o.mood = c.mood; o.top = c.top;
      o.chefRow = c.chefRow ? { ...this.pub(c.chefRow.id), avg: c.chefRow.avg, gain: c.chefRow.gain } : null;
    }
    return o;
  }
  base() { return { phase: this.phase, round: this.round, of: this.total, mode: this.s.mode, endsIn: this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.now()) : 0, nonna: this.nonna }; }
  tv() {
    const st = this.standings();
    return { ...this.base(), c: this.cPub(), standings: st.slice(0, 10), players: st.length, final: this.phase === 'over' ? this.final : null };
  }
  view(p) {
    const st = this.standings(), i = st.findIndex((r) => r.id === p.id), c = this.c;
    const v = { ...this.base(), me: p.id, points: this.points.get(p.id) || 0, rank: i + 1, ranked: st.length, final: this.phase === 'over' ? this.final : null };
    if (!c) return v;
    const M = MODES[c.mode];
    v.c = { id: c.id, mode: c.mode, modeName: M.name, modeIcon: M.icon, customer: { name: c.customer.name, job: c.customer.job }, isChef: c.chef === p.id, chef: c.chef ? this.pub(c.chef) : null, speed: !!M.speed, buildMs: c.buildMs };
    if (c.chef === p.id && this.phase !== 'reveal') v.c.ticket = { crust: c.order.crust, sauce: c.order.sauce, cheese: c.order.cheese, top: c.order.top, words: c.order.words };
    if (this.phase === 'build') {
      v.c.served = c.served.has(p.id); v.c.draft = c.drafts.get(p.id) || null;
      v.c.waiting = this.builders().filter((x) => !c.served.has(x.id)).length;
    }
    if (this.phase === 'reveal' && c.rows) {
      const r = c.rows.find((x) => x.id === p.id), place = c.rows.indexOf(r) + 1;
      v.c.order = { crust: c.order.crust, sauce: c.order.sauce, cheese: c.order.cheese, top: c.order.top, words: c.order.words };
      v.c.mine = r ? { pizza: r.pizza, score: r.score, gain: r.gain, speed: r.speed, best: r.best, place, of: c.rows.length } : null;
      if (c.chefRow && c.chefRow.id === p.id) v.c.chefRow = { avg: c.chefRow.avg, gain: c.chefRow.gain };
    }
    return v;
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ players: P, minutes: M }) => {
  const seconds = M <= 7 ? 30 : M >= 16 ? 60 : 45;
  const { rounds } = PF.best({ rounds: [5, 3, 8] }, (s) => 0.5 + s.rounds * (seconds + 85) / 60, M);
  return { rounds, seconds, mode: P <= 1 ? 'classic' : 'mixed' };
};

module.exports = {
  partyFit,
  key: 'pizza', name: 'JustPizza', min: 1, best: [3, 10], howSteps: 6, fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/pizza.js): Nonna Pina's pizzeria
  create: (room, settings) => new Game(room, settings),
  _test: { match, clean, describe, rot, flip, pop8, MODES, TOPPINGS, CRUSTS, SAUCES, CUSTOMERS, NONNA, WHOLE, HALVES, QUARTERS },
};
