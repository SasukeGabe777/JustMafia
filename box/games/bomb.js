'use strict';
// Bomb Squad: a co-op, talk-it-out defusal game. Each round a cartoon bomb arrives. The DEFUSER
// sees it on their phone (nobody else can). Everyone else holds DIFFERENT pages of the field
// manual, with each module's rules split between two experts, so the room has to talk.
// Wrong moves are strikes (and burn 15 s off the clock); three strikes or 0:00 is BOOM.
// Bombs ramp up (more modules, less time, a needy Radio from bomb 3). Big groups split into
// squads that defuse their own bombs in parallel. All module rules here are original.
// Content is family-safe throughout (cartoon bombs, silly words), so room.family needs no branch.
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'bombs', label: 'Bombs', options: opt([[3, '3 bombs (~10 min)'], [4, '4 bombs (~13 min)'], [5, '5 bombs (~17 min)']]) },
  { key: 'fuse', label: 'Fuse length', options: opt([['long', 'Long fuse (relaxed)'], ['normal', 'Normal fuse'], ['short', 'Short fuse (hard)']]) },
  { key: 'squads', label: 'Squads', options: opt([['auto', 'Auto (big groups split up)'], ['one', 'One big squad']]) },
  { key: 'difficulty', label: 'Difficulty', options: opt([['easy', '🟢 Easy (fewer modules, no radio)'], ['medium', '🟡 Medium'], ['hard', '🔴 Hard (more modules, radio from bomb 2)']]) },
];
const defaults = { bombs: 4, fuse: 'normal', squads: 'auto', difficulty: 'medium' };
// Difficulty: how many modules each bomb has (first bomb, growth per bomb, most) and from which bomb the needy Radio joins.
const LEVEL = { easy: { first: 2, max: 4, radio: 99 }, medium: { first: 3, max: 6, radio: 2 }, hard: { first: 4, max: 6, radio: 1 } };

const BRIEF_MS = 9000, REVEAL_MS = 11000, BURN_MS = 15000, RADIO_MS = 25000, MAX_STRIKES = 3;
const FUSE = { long: 1.35, normal: 1, short: 0.75 };
const TYPES = ['wires', 'plunger', 'glyphs', 'maze', 'dial', 'lamps'];
const OP = { wires: 'cut', plunger: 'plunger', glyphs: 'glyph', maze: 'move', dial: 'dial', lamps: 'lamp' };
const INFO = { wires: ['Fuse Lines', '🔌'], plunger: ['The Plunger', '🔴'], glyphs: ['Glyph Pad', '🔣'], maze: ['Tunnel Map', '🧭'], dial: ['Combination Dial', '🔢'], lamps: ['Signal Lamps', '💡'], radio: ['Radio Check', '📻'] };
const SQUADS = [{ name: 'Red Wire', color: '#ff5a4e' }, { name: 'Blue Wire', color: '#3ea8ff' }, { name: 'Yellow Wire', color: '#ffd23f' }, { name: 'Green Wire', color: '#45e07a' }];
const PTS = { solve: 150, assist: 100, defuse: 200, strike: -25, radio: 50, radioAssist: 50 };

// ---------- the rules (all original) ----------
const WIRE_COLORS = ['red', 'blue', 'yellow', 'green', 'white', 'black'];
const STICKERS = ['purple', 'orange', 'teal', 'pink'];
const ANCHOR = { purple: 'yellow', orange: 'blue', teal: 'red', pink: 'green' };
const CAPS = ['red', 'blue', 'green', 'yellow', 'white'];
const LABELS = ['GO', 'STOP', 'NOPE', 'MAYBE', 'PANIC', 'CALM', 'OOPS'];
const STRIPS = { blue: 2, red: 3, white: 4, yellow: 5, green: 6 };
const GLYPHS = ['🦑', '🌵', '🍄', '🎈', '🧲', '🦴', '🌙', '🔔', '🌀', '🦷', '🍩', '🔑', '🐌', '🎩', '🧊', '🐸', '🦀', '🍋', '🛸', '🧀', '🎲', '🐙', '⚓', '🥕'];
const GLYPH_VAL = [17, 42, 8, 63, 29, 51, 3, 76, 34, 12, 88, 45, 21, 67, 5, 39, 92, 14, 58, 26, 71, 9, 83, 47];
const LETTER_VAL = { A: 3, B: 7, C: 1, D: 9, E: 4, F: 0, G: 6, H: 2, I: 8, J: 5, K: 1, L: 7, M: 3, N: 0, O: 5, P: 9, Q: 2, R: 6, S: 4, T: 8, U: 1, V: 7, W: 3, X: 0, Y: 6, Z: 2 };
const WORDS = ['CAT', 'OWL', 'BUS', 'JAM', 'FOX', 'ZAP', 'KIT', 'MOP', 'HUG', 'YAK', 'WIG', 'PEG', 'RUN', 'TOP', 'NUT', 'VAN', 'BOX', 'GUM', 'DOT', 'LID', 'SUN', 'FIG', 'ELK', 'ZIP', 'HAT', 'BEE', 'COW', 'JET'];
const LAMP_COLORS = ['red', 'green', 'blue', 'yellow'];
const SHAPES = ['triangle', 'circle', 'square', 'diamond'];
const LAMP_V = { red: 'square', green: 'circle', blue: 'diamond', yellow: 'triangle' };
const LAMP_N = { red: 'triangle', green: 'diamond', blue: 'circle', yellow: 'square' };
const CALLSIGNS = [['OTTER', 3], ['BADGER', 5], ['PELICAN', 1], ['WALRUS', 6], ['GECKO', 2], ['PANDA', 4], ['FALCON', 4], ['MOOSE', 2], ['LLAMA', 6], ['HERON', 1], ['BISON', 5], ['KOALA', 3]];
const SERIAL_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // serials never use I or O
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const SHAPE_SIGN = { triangle: '▲', circle: '●', square: '■', diamond: '◆' };

// Six 5×5 tunnel maps, carved once from fixed seeds. Wall bits: 1 up, 2 right, 4 down, 8 left.
const MAPS = (() => {
  const stars = [[1, 0], [4, 1], [2, 2], [0, 3], [3, 4], [1, 3]], maps = [];
  for (let m = 0; m < 6; m++) {
    let s = 1234567 + m * 7919;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const walls = Array(25).fill(15), seen = new Set([0]), stack = [0];
    while (stack.length) {
      const c = stack[stack.length - 1], x = c % 5, y = Math.floor(c / 5), nb = [];
      if (y > 0 && !seen.has(c - 5)) nb.push([c - 5, 1, 4]);
      if (x < 4 && !seen.has(c + 1)) nb.push([c + 1, 2, 8]);
      if (y < 4 && !seen.has(c + 5)) nb.push([c + 5, 4, 1]);
      if (x > 0 && !seen.has(c - 1)) nb.push([c - 1, 8, 2]);
      if (!nb.length) { stack.pop(); continue; }
      const [n, a, b] = nb[Math.floor(r() * nb.length)];
      walls[c] &= ~a; walls[n] &= ~b; seen.add(n); stack.push(n);
    }
    for (let k = 0; k < 3; k++) { const c = Math.floor(r() * 25); if (c % 5 < 4) { walls[c] &= ~2; walls[c + 1] &= ~8; } }
    maps.push({ n: m + 1, star: stars[m][1] * 5 + stars[m][0], walls });
  }
  return maps;
})();
const DIRS = { u: [0, -1, 1], r: [1, 0, 2], d: [0, 1, 4], l: [-1, 0, 8] };

// The field manual: two halves per module, so two experts each hold part of it.
const ORDER_LINE = 'Order: with 0 or 1 batteries, press the shapes in the order the lamps flashed. With 2 or more batteries, press them in REVERSE order.';
const MANUAL = {
  wires: {
    A: { title: 'Find the anchor colour', lines: ['Ask the defuser what colour the STICKER on the bomb’s plate is.', 'That gives you the anchor colour. Which line to cut is on the OTHER half of this page: find who has it!'],
      table: [['Sticker', 'Anchor colour'], ...STICKERS.map((s) => [cap(s), cap(ANCHOR[s])])] },
    B: { title: 'Which line to cut', lines: ['Count lines from the TOP. You need the anchor colour from the other half of this page.',
      '• Exactly ONE line in the anchor colour? Cut it.',
      '• More than one? If the serial number ends in an EVEN digit, cut the top one of them. ODD: cut the bottom one.',
      '• None at all? Cut the line just below the first WHITE line. If that white line is the bottom one, cut the top line. No white line either? Cut the bottom line.'] },
  },
  plunger: {
    A: { title: 'Tap or hold?', lines: ['Go down the list. The FIRST rule that matches wins.', '1. The label says PANIC → TAP it.', '2. The label says CALM → HOLD it.', '3. Red cap and 2 or more batteries → TAP it.', '4. White cap and the SPARK light is on → HOLD it.', '5. The label has exactly 4 letters → HOLD it.', '6. Anything else → TAP it.', 'A tap is a quick press. If it needs holding, the other half of this page says when to let go.'] },
    B: { title: 'Holding it down', lines: ['While the plunger is held down, a coloured strip lights up beside it and a pressure gauge counts 1 to 6, over and over.', 'Let go when the gauge shows:'],
      table: [['Strip colour', 'Let go on'], ...Object.entries(STRIPS).map(([c, n]) => [cap(c), String(n)])] },
  },
  glyphs: {
    A: { title: 'Glyph values · part 1', lines: ['The pad has four keys, each with a picture. Every picture has a value.', 'Press all four from the LOWEST value to the HIGHEST. If the SPARK light is on, go from HIGHEST to LOWEST.', 'Pictures not on this list are on the other glyph page.'], glyphs: GLYPHS.slice(0, 12).map((g, i) => [g, GLYPH_VAL[i]]) },
    B: { title: 'Glyph values · part 2', lines: ['The pad has four keys, each with a picture. Every picture has a value.', 'Press all four from the LOWEST value to the HIGHEST. If the SPARK light is on, go from HIGHEST to LOWEST.', 'Pictures not on this list are on the other glyph page.'], glyphs: GLYPHS.slice(12).map((g, i) => [g, GLYPH_VAL[i + 12]]) },
  },
  maze: {
    A: { title: 'Tunnel maps 1–3', lines: ['The defuser sees a 5×5 grid with a ★ star, the spark ✨ and the exit 🚪, but NOT the walls.', 'Find the map whose ★ is in the same square. Thick lines are walls: steer the spark to the exit one step at a time.', 'Bumping into a wall is a strike! Maps 4–6 are on the other page.'], maps: MAPS.slice(0, 3) },
    B: { title: 'Tunnel maps 4–6', lines: ['The defuser sees a 5×5 grid with a ★ star, the spark ✨ and the exit 🚪, but NOT the walls.', 'Find the map whose ★ is in the same square. Thick lines are walls: steer the spark to the exit one step at a time.', 'Bumping into a wall is a strike! Maps 1–3 are on the other page.'], maps: MAPS.slice(3) },
  },
  dial: {
    A: { title: 'Letter codes A–M', lines: ['The dial’s little screen shows a three-letter word. Turn each letter into a digit.', 'Then ADD the number of batteries to each digit (past 9 wraps round: 8 + 3 is 1).', 'If the serial number ends in an ODD digit, enter the three digits in REVERSE order.', 'Letters N–Z are on the other page.'], letters: Object.entries(LETTER_VAL).slice(0, 13) },
    B: { title: 'Letter codes N–Z', lines: ['The dial’s little screen shows a three-letter word. Turn each letter into a digit.', 'Then ADD the number of batteries to each digit (past 9 wraps round: 8 + 3 is 1).', 'If the serial number ends in an ODD digit, enter the three digits in REVERSE order.', 'Letters A–M are on the other page.'], letters: Object.entries(LETTER_VAL).slice(13) },
  },
  lamps: {
    A: { title: 'Lamp code · serial WITH a vowel', lines: ['The lamps flash a sequence of colours. Turn each flash into a shape.', 'Use THIS table only if the serial number has a vowel in it (A, E or U: serials never use I or O).', ORDER_LINE],
      table: [['Flash', 'Press'], ...LAMP_COLORS.map((c) => [cap(c), `${SHAPE_SIGN[LAMP_V[c]]} ${cap(LAMP_V[c])}`])] },
    B: { title: 'Lamp code · serial with NO vowel', lines: ['The lamps flash a sequence of colours. Turn each flash into a shape.', 'Use THIS table only if the serial number has NO vowel (no A, E or U).', ORDER_LINE],
      table: [['Flash', 'Press'], ...LAMP_COLORS.map((c) => [cap(c), `${SHAPE_SIGN[LAMP_N[c]]} ${cap(LAMP_N[c])}`])] },
  },
  radio: {
    A: { title: 'Radio callsigns · part 1', lines: ['Every so often the bomb’s radio crackles and asks for a callsign. The defuser must press the matching channel within 25 seconds, or it’s a strike!', 'It keeps coming back, so keep this page handy.'], table: [['Callsign', 'Channel'], ...CALLSIGNS.slice(0, 6).map(([w, c]) => [w, String(c)])] },
    B: { title: 'Radio callsigns · part 2', lines: ['Every so often the bomb’s radio crackles and asks for a callsign. The defuser must press the matching channel within 25 seconds, or it’s a strike!', 'It keeps coming back, so keep this page handy.'], table: [['Callsign', 'Channel'], ...CALLSIGNS.slice(6).map(([w, c]) => [w, String(c)])] },
  },
};
const section = (key) => { const [type, part] = key.split(':'); return { key, type, part, name: INFO[type][0], icon: INFO[type][1], ...MANUAL[type][part] }; };

const lastDigit = (b) => Number(b.serial[b.serial.length - 1]);
const hasVowel = (b) => /[AEU]/.test(b.serial);
const ANSWER = {
  wires(b, m) {
    const anchor = ANCHOR[b.sticker], idx = m.wires.map((c, i) => (c === anchor ? i : -1)).filter((i) => i >= 0);
    if (idx.length === 1) return idx[0];
    if (idx.length > 1) return lastDigit(b) % 2 === 0 ? idx[0] : idx[idx.length - 1];
    const w = m.wires.indexOf('white');
    if (w < 0) return m.wires.length - 1;
    return w === m.wires.length - 1 ? 0 : w + 1;
  },
  plunger(b, m) {
    const l = m.label;
    const how = l === 'PANIC' ? 'tap' : l === 'CALM' ? 'hold' : m.cap === 'red' && b.batteries >= 2 ? 'tap' : m.cap === 'white' && b.spark ? 'hold' : l.length === 4 ? 'hold' : 'tap';
    return { how, at: how === 'hold' ? STRIPS[m.strip] : null };
  },
  glyphs(b, m) { const o = m.keys.map((_, i) => i).sort((a, c) => GLYPH_VAL[m.keys[a]] - GLYPH_VAL[m.keys[c]]); return b.spark ? o.reverse() : o; },
  dial(b, m) { const d = [...m.word].map((c) => (LETTER_VAL[c] + b.batteries) % 10); return lastDigit(b) % 2 ? d.reverse() : d; },
  lamps(b, m) { const T = hasVowel(b) ? LAMP_V : LAMP_N, s = m.seq.map((c) => T[c]); return b.batteries >= 2 ? s.reverse() : s; },
};
function mazePath(map, from, to) {
  const prev = new Map([[from, null]]), q = [from];
  while (q.length) {
    const c = q.shift(); if (c === to) break;
    for (const [d, [dx, dy, bit]] of Object.entries(DIRS)) {
      if (MAPS[map].walls[c] & bit) continue;
      const n = c + dx + dy * 5; if (!prev.has(n)) { prev.set(n, [c, d]); q.push(n); }
    }
  }
  const out = []; let c = to; while (prev.get(c)) { const [p, d] = prev.get(c); out.unshift(d); c = p; }
  return out;
}

function makeBomb(rng, types, round, needy) {
  const pick = (a) => a[Math.floor(rng() * a.length)], D = () => String(Math.floor(rng() * 10));
  const serial = pick(SERIAL_ABC) + pick(SERIAL_ABC) + D() + '-' + pick(SERIAL_ABC) + D() + D();
  const b = { serial, batteries: Math.floor(rng() * 5), sticker: pick(STICKERS), spark: rng() < 0.5, strikes: 0, status: 'live', endsAt: 0, left: 0, timer: null, log: null, logN: 0, mods: [], radio: needy ? { active: false, call: 0, endsAt: 0, timer: null, n: 0 } : null };
  const GEN = {
    wires: () => ({ wires: Array.from({ length: 4 + Math.floor(rng() * (round > 1 ? 3 : 2)) }, () => pick(WIRE_COLORS)), cut: [] }),
    plunger: () => ({ cap: pick(CAPS), label: pick(LABELS), strip: pick(Object.keys(STRIPS)) }),
    glyphs: () => { const k = []; while (k.length < 4) { const g = Math.floor(rng() * GLYPHS.length); if (!k.includes(g)) k.push(g); } return { keys: k, pressed: [] }; },
    maze: () => { const map = Math.floor(rng() * MAPS.length); let a, z; do { a = Math.floor(rng() * 25); z = Math.floor(rng() * 25); } while (Math.abs((a % 5) - (z % 5)) + Math.abs(Math.floor(a / 5) - Math.floor(z / 5)) < 4); return { map, pos: a, exit: z, bumps: 0 }; },
    dial: () => ({ word: pick(WORDS) }),
    lamps: () => ({ seq: Array.from({ length: round > 2 ? 4 : 3 }, () => pick(LAMP_COLORS)), input: [] }),
  };
  b.mods = types.map((t, i) => ({ id: i, type: t, solved: false, owner: null, ...GEN[t]() }));
  return b;
}

class Game {
  constructor(room, s) {
    this.room = room; this.s = s; this.phase = 'brief'; this.round = 0; this.endsAt = 0; this.timer = null;
    this.squads = []; this.stats = new Map(); this.team = 0; this.secs = 0; this.nMods = 0; this.needy = false; this.roundStart = new Map(); this.history = []; this.final = null;
  }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  st(id) { let r = this.stats.get(id); if (!r) { r = { points: 0, solves: 0, assists: 0, strikes: 0, defused: 0, radio: 0 }; this.stats.set(id, r); } return r; }
  give(id, n) { if (!this.room.get(id)) return; const r = this.st(id); r.points = Math.max(0, r.points + n); }
  squadOf(id) { return this.squads.find((q) => q.members.includes(id)) || null; }
  liveSquads() { return this.squads.filter((q) => q.members.length); }

  start() {
    const ps = this.room.list(), n = ps.length;
    for (const p of ps) this.st(p.id);
    const k = this.s.squads === 'one' || n <= 6 ? 1 : Math.min(4, Math.ceil(n / 5));
    const order = ps.map((p) => p.id);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(this.room.rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    this.squads = Array.from({ length: k }, (_, i) => ({ id: i, ...SQUADS[i], members: [], ptr: 0, defusers: [], holders: new Map(), pages: new Map(), solo: false, bomb: null, total: 0, defusedN: 0 }));
    order.forEach((id, i) => this.squads[i % k].members.push(id));
    this.nextRound();
  }
  joined(p) {
    this.st(p.id);
    if (!this.squads.length || this.phase === 'over') return;
    const sq = this.squads.slice().sort((a, b) => a.members.length - b.members.length)[0];
    sq.members.push(p.id);
    if (sq.bomb && sq.bomb.status === 'live') { this.dealLate(sq, p.id); sq.solo = this.isSolo(sq); }
  }
  left(p) {
    const sq = this.squadOf(p.id); if (!sq) return;
    sq.members = sq.members.filter((id) => id !== p.id);
    for (const ids of sq.holders.values()) { const i = ids.indexOf(p.id); if (i >= 0) ids.splice(i, 1); }
    sq.pages.delete(p.id);
    const b = sq.bomb;
    if (sq.defusers.includes(p.id)) {
      sq.defusers = sq.defusers.filter((id) => id !== p.id);
      if (!sq.defusers.length && sq.members.length) {
        // Promote an expert (a human first) so the bomb still has hands on it.
        const next = sq.members.map((id) => this.room.get(id)).filter(Boolean).sort((a, c) => Number(a.bot) - Number(c.bot))[0];
        sq.defusers = [next.id]; sq.pages.delete(next.id);
        for (const ids of sq.holders.values()) { const i = ids.indexOf(next.id); if (i >= 0) ids.splice(i, 1); }
      }
      if (b) for (const m of b.mods) if (m.owner === p.id) m.owner = sq.defusers[0] || null;
      if (b && b.status === 'live' && sq.defusers[0]) { const np = this.room.get(sq.defusers[0]); if (np && np.bot && this.phase === 'tick') this.botWork(sq, np.id); }
    }
    sq.solo = this.isSolo(sq);
    if (!sq.members.length && b && b.status === 'live') { b.status = 'gone'; this.stopBomb(b); this.checkRoundEnd(); }
  }
  isSolo(sq) { const ex = sq.members.filter((id) => !sq.defusers.includes(id)); return ex.every((id) => { const p = this.room.get(id); return !p || p.bot; }); }

  // ---------- rounds ----------
  nextRound() {
    if (this.round >= this.s.bombs || !this.liveSquads().length) return this.end();
    this.round++; const r = this.round - 1;
    const L = LEVEL[this.s.difficulty] || LEVEL.medium;
    this.nMods = Math.min(L.max, L.first + r); this.needy = r >= L.radio;
    const order = TYPES.slice(); for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(this.room.rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const types = r === 0 ? ['wires', 'plunger', 'glyphs', ...order.filter((t) => !['wires', 'plunger', 'glyphs'].includes(t))].slice(0, this.nMods) : order.slice(0, this.nMods);
    this.secs = Math.round(((40 + 35 * this.nMods) * (FUSE[this.s.fuse] || 1) * (1 - 0.04 * r)) / 5) * 5;
    this.roundStart = new Map([...this.stats].map(([id, x]) => [id, x.points]));
    for (const sq of this.liveSquads()) {
      const len = sq.members.length, k = Math.min(len, len >= 10 ? 3 : len >= 6 ? 2 : 1);
      sq.defusers = []; for (let i = 0; i < k; i++) sq.defusers.push(sq.members[(sq.ptr + i) % len]);
      sq.ptr = (sq.ptr + k) % Math.max(1, len);
      sq.bomb = makeBomb(this.room.rng, types, this.round, this.needy);
      sq.bomb.mods.forEach((m, i) => { m.owner = sq.defusers[i % k]; });
      this.deal(sq, types);
      sq.solo = this.isSolo(sq);
    }
    this.phase = 'brief'; this.room.fx('round');
    this.setTimer(BRIEF_MS, () => this.arm());
  }
  // Hand out the manual: every module's two halves go to two different experts where possible.
  deal(sq, types) {
    sq.holders = new Map(); sq.pages = new Map();
    const keys = [...types, ...(this.needy ? ['radio'] : [])];
    const experts = sq.members.filter((id) => !sq.defusers.includes(id)), E = experts.length;
    for (const k of keys) for (const part of ['A', 'B']) sq.holders.set(k + ':' + part, []);
    for (const id of experts) sq.pages.set(id, []);
    if (!E) return;
    const put = (key, id) => { sq.holders.get(key).push(id); sq.pages.get(id).push(key); };
    keys.forEach((k, j) => { put(k + ':A', experts[j % E]); put(k + ':B', experts[(j + 1) % E]); });
    for (const id of experts) if (!sq.pages.get(id).length) this.dealLate(sq, id);
  }
  dealLate(sq, id) {
    if (!sq.pages.has(id)) sq.pages.set(id, []);
    const keys = [...sq.holders.keys()].sort((a, b) => sq.holders.get(a).length - sq.holders.get(b).length);
    if (!keys.length) return;
    sq.holders.get(keys[0]).push(id); sq.pages.get(id).push(keys[0]);
  }
  arm() {
    if (this.phase !== 'brief') return;
    this.phase = 'tick'; this.room.cancel(this.timer); this.endsAt = 0;
    const now = this.room.now();
    for (const sq of this.liveSquads()) {
      const b = sq.bomb; b.endsAt = now + this.secs * 1000;
      b.timer = this.room.after(this.secs * 1000, () => this.boom(sq, 'time'));
      if (b.radio) this.scheduleRadio(sq, 22000 + this.room.rng() * 15000);
      for (const id of sq.defusers) { const p = this.room.get(id); if (p && p.bot) this.botWork(sq, id); }
    }
    this.room.fx('arm');
  }
  stopBomb(b) { this.room.cancel(b.timer); b.timer = null; if (b.radio) { this.room.cancel(b.radio.timer); b.radio.timer = null; b.radio.active = false; } }
  note(sq, kind, text) { const b = sq.bomb; b.logN++; b.log = { kind, text, n: b.logN }; }
  strike(sq, p, why) {
    const b = sq.bomb; if (!b || b.status !== 'live') return;
    b.strikes++;
    if (p) { this.give(p.id, PTS.strike); this.st(p.id).strikes++; }
    this.note(sq, 'strike', why);
    this.room.fx('strike', { squad: sq.id });
    if (b.strikes >= MAX_STRIKES) return this.boom(sq, 'strikes');
    const left = b.endsAt - this.room.now(), burn = Math.max(0, Math.min(BURN_MS, left - 3000));
    b.endsAt -= burn; this.room.cancel(b.timer);
    b.timer = this.room.after(Math.max(0, b.endsAt - this.room.now()), () => this.boom(sq, 'time'));
  }
  solve(sq, m, p) {
    const b = sq.bomb; m.solved = true;
    this.give(p.id, PTS.solve); this.st(p.id).solves++;
    const helpers = new Set([...(sq.holders.get(m.type + ':A') || []), ...(sq.holders.get(m.type + ':B') || [])]);
    for (const id of helpers) { this.give(id, PTS.assist); this.st(id).assists++; }
    this.team += 100; sq.total += 100;
    this.note(sq, 'solve', `${INFO[m.type][0]} is safe!`);
    this.room.fx('solve', { squad: sq.id });
    if (b.mods.every((x) => x.solved)) this.defuse(sq);
  }
  defuse(sq) {
    const b = sq.bomb; if (b.status !== 'live') return;
    b.status = 'defused'; b.left = Math.max(0, b.endsAt - this.room.now()); this.stopBomb(b);
    const secs = Math.floor(b.left / 1000), bonus = 500 + secs * 5 - b.strikes * 50;
    this.team += bonus; sq.total += bonus; sq.defusedN++;
    for (const id of sq.members) this.give(id, PTS.defuse + secs * 2);
    for (const id of sq.defusers) this.st(id).defused++;
    this.note(sq, 'defused', 'DEFUSED!');
    this.room.fx('defused', { squad: sq.id });
    this.checkRoundEnd();
  }
  boom(sq, why) {
    const b = sq.bomb; if (!b || b.status !== 'live') return;
    b.status = 'boom'; b.why = why; b.left = 0; this.stopBomb(b);
    this.note(sq, 'boom', why === 'strikes' ? 'Three strikes!' : why === 'host' ? 'Fuse cut short!' : 'Out of time!');
    this.room.fx('boom', { squad: sq.id });
    this.checkRoundEnd();
  }
  checkRoundEnd() {
    if (this.phase !== 'tick') return;
    if (this.liveSquads().some((q) => q.bomb && q.bomb.status === 'live')) return;
    this.reveal();
  }
  reveal() {
    this.phase = 'reveal';
    this.history.push(this.liveSquads().map((q) => ({ squad: q.id, status: q.bomb.status })));
    this.room.fx(this.liveSquads().some((q) => q.bomb.status === 'defused') ? 'cheer' : 'groan');
    this.setTimer(REVEAL_MS, () => this.nextRound());
  }

  // ---------- the needy Radio ----------
  scheduleRadio(sq, ms) {
    const b = sq.bomb; if (!b || !b.radio) return;
    this.room.cancel(b.radio.timer);
    b.radio.timer = this.room.after(ms, () => this.radioPing(sq));
  }
  radioPing(sq) {
    const b = sq.bomb; if (!b || b.status !== 'live' || this.phase !== 'tick') return;
    const R = b.radio; R.active = true; R.n++; R.call = Math.floor(this.room.rng() * CALLSIGNS.length); R.endsAt = this.room.now() + RADIO_MS;
    R.timer = this.room.after(RADIO_MS, () => { if (!R.active) return; R.active = false; this.strike(sq, null, 'The radio went unanswered!'); if (b.status === 'live') this.scheduleRadio(sq, 35000 + this.room.rng() * 20000); });
    this.note(sq, 'radio', 'The radio is crackling!');
    this.room.fx('radio', { squad: sq.id });
    const owner = this.room.get(sq.defusers[0]);
    if (owner && owner.bot) this.room.after(4000 + this.room.rng() * 10000, () => {
      if (!R.active || b.status !== 'live') return;
      const right = CALLSIGNS[R.call][1], ch = this.room.rng() < 0.85 ? right : (right % 6) + 1;
      this.act(owner, { op: 'radio', ch }); this.room.sync();
    });
    this.room.sync();
  }

  // ---------- bots: a bot defuser works through its modules, sometimes fumbling ----------
  botWork(sq, id) {
    const b = sq.bomb;
    const go = () => {
      const p = this.room.get(id);
      if (!p || this.phase !== 'tick' || b.status !== 'live' || sq.bomb !== b) return;
      const m = b.mods.find((x) => x.owner === id && !x.solved); if (!m) return;
      const moves = this.room.rng() < 0.17 ? this.wrongMoves(b, m) : this.rightMoves(b, m);
      for (const mv of moves) { if (b.status !== 'live' || m.solved) break; this.act(p, mv); }
      this.room.sync();
      if (b.status === 'live') this.room.after(7000 + this.room.rng() * 15000 * (0.8 + this.nMods * 0.1), go);
    };
    this.room.after(9000 + this.room.rng() * 12000, go);
  }
  rightMoves(b, m) {
    const mod = m.id;
    switch (m.type) {
      case 'wires': return [{ op: 'cut', mod, wire: ANSWER.wires(b, m) }];
      case 'plunger': { const a = ANSWER.plunger(b, m); return [{ op: 'plunger', mod, how: a.how, at: a.at }]; }
      case 'glyphs': return ANSWER.glyphs(b, m).filter((k) => !m.pressed.includes(k)).map((key) => ({ op: 'glyph', mod, key }));
      case 'maze': return mazePath(m.map, m.pos, m.exit).map((dir) => ({ op: 'move', mod, dir }));
      case 'dial': return [{ op: 'dial', mod, code: ANSWER.dial(b, m) }];
      case 'lamps': return ANSWER.lamps(b, m).slice(m.input.length).map((shape) => ({ op: 'lamp', mod, shape }));
      default: return [];
    }
  }
  wrongMoves(b, m) {
    const mod = m.id;
    switch (m.type) {
      case 'wires': { const a = ANSWER.wires(b, m), w = m.wires.findIndex((_, i) => i !== a && !m.cut.includes(i)); return w >= 0 ? [{ op: 'cut', mod, wire: w }] : []; }
      case 'plunger': { const a = ANSWER.plunger(b, m); return [a.how === 'tap' ? { op: 'plunger', mod, how: 'hold', at: 1 } : { op: 'plunger', mod, how: 'tap' }]; }
      case 'glyphs': { const o = ANSWER.glyphs(b, m).filter((k) => !m.pressed.includes(k)); return o.length > 1 ? [{ op: 'glyph', mod, key: o[1] }] : []; }
      case 'maze': { const d = Object.keys(DIRS).find((k) => MAPS[m.map].walls[m.pos] & DIRS[k][2]); return d ? [{ op: 'move', mod, dir: d }] : []; }
      case 'dial': { const c = ANSWER.dial(b, m); return [{ op: 'dial', mod, code: [(c[0] + 1) % 10, c[1], c[2]] }]; }
      case 'lamps': { const want = ANSWER.lamps(b, m)[m.input.length]; return [{ op: 'lamp', mod, shape: SHAPES.find((s) => s !== want) }]; }
      default: return [];
    }
  }

  end() {
    this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer);
    for (const sq of this.squads) if (sq.bomb) this.stopBomb(sq.bomb);
    const rows = this.standings();
    const best = (k, min = 1) => { const top = Math.max(0, ...rows.map((r) => r[k])); return top >= min ? { names: rows.filter((r) => r[k] === top).map((r) => r.name), value: top } : null; };
    const played = this.history.reduce((n, h) => n + h.length, 0), defused = this.history.reduce((n, h) => n + h.filter((x) => x.status === 'defused').length, 0);
    this.final = { team: this.team, played, defused, awards: { hands: best('solves'), reader: best('assists'), cool: best('defused'), oops: best('strikes', 2) },
      squads: this.squads.filter((q) => q.members.length || q.total).map((q) => ({ name: q.name, color: q.color, total: q.total, defused: q.defusedN })) };
    this.room.fx('win');
  }
  next() {
    if (this.phase === 'brief') this.arm();
    else if (this.phase === 'tick') { for (const sq of this.liveSquads()) if (sq.bomb && sq.bomb.status === 'live') this.boom(sq, 'host'); }
    else if (this.phase === 'reveal') this.nextRound();
  }
  standings() {
    return [...this.stats].filter(([id]) => this.room.get(id)).map(([id, x]) => { const p = this.room.get(id); return { id, name: p.name, avatar: p.avatar, color: p.color, ...x }; })
      .sort((a, b) => b.points - a.points || b.solves - a.solves || b.assists - a.assists);
  }
  // Party points: player ids best-first by contribution once the game is over.
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }

  // ---------- phone input ----------
  act(p, m) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'Unknown move.' };
    if (m.op === 'radio') return this.actRadio(p, m);
    const type = Object.keys(OP).find((t) => OP[t] === m.op);
    if (!type) return { ok: false, error: 'Unknown move.' };
    if (this.phase !== 'tick') return { ok: false, error: this.phase === 'brief' ? 'The bomb isn’t armed yet!' : 'Not now.' };
    const sq = this.squadOf(p.id), b = sq && sq.bomb;
    if (!b) return { ok: false, error: 'You’re not on a squad.' };
    if (b.status !== 'live') return { ok: false, error: 'This bomb is finished.' };
    const i = m.mod;
    if (!Number.isInteger(i) || i < 0 || i >= b.mods.length) return { ok: false, error: 'No such module.' };
    const mod = b.mods[i];
    if (mod.owner !== p.id) return { ok: false, error: 'Only the defuser can touch that module!' };
    if (mod.solved) return { ok: false, error: 'That module is already safe.' };
    if (mod.type !== type) return { ok: false, error: 'That doesn’t work on this module.' };
    const ok = () => { this.solve(sq, mod, p); return { ok: true, result: 'solved' }; };
    const bad = (why) => { this.strike(sq, p, why); return { ok: true, result: 'strike' }; };
    switch (type) {
      case 'wires': {
        const w = m.wire;
        if (!Number.isInteger(w) || w < 0 || w >= mod.wires.length) return { ok: false, error: 'No such wire.' };
        if (mod.cut.includes(w)) return { ok: false, error: 'That line is already cut.' };
        mod.cut.push(w);
        return w === ANSWER.wires(b, mod) ? ok() : bad('Wrong line cut!');
      }
      case 'plunger': {
        if (m.how !== 'tap' && m.how !== 'hold') return { ok: false, error: 'Tap or hold the plunger.' };
        const a = ANSWER.plunger(b, mod);
        if (m.how === 'tap') return a.how === 'tap' ? ok() : bad('That plunger needed holding!');
        if (!Number.isInteger(m.at) || m.at < 1 || m.at > 6) return { ok: false, error: 'The gauge reads 1 to 6.' };
        if (a.how === 'tap') return bad('That plunger only wanted a tap!');
        return m.at === a.at ? ok() : bad(`Let go on ${m.at}: wrong number!`);
      }
      case 'glyphs': {
        const k = m.key;
        if (!Number.isInteger(k) || k < 0 || k > 3) return { ok: false, error: 'No such key.' };
        if (mod.pressed.includes(k)) return { ok: false, error: 'That key is already pressed.' };
        const want = ANSWER.glyphs(b, mod)[mod.pressed.length];
        if (k !== want) return bad('Wrong glyph!');
        mod.pressed.push(k);
        return mod.pressed.length === 4 ? ok() : { ok: true, result: 'ok' };
      }
      case 'maze': {
        const d = DIRS[m.dir];
        if (typeof m.dir !== 'string' || !Object.prototype.hasOwnProperty.call(DIRS, m.dir)) return { ok: false, error: 'Move up, down, left or right.' };
        if (MAPS[mod.map].walls[mod.pos] & d[2]) { mod.bumps++; return bad('The spark hit a wall!'); }
        mod.pos += d[0] + d[1] * 5;
        return mod.pos === mod.exit ? ok() : { ok: true, result: 'ok' };
      }
      case 'dial': {
        const c = m.code;
        if (!Array.isArray(c) || c.length !== 3 || !c.every((d) => Number.isInteger(d) && d >= 0 && d <= 9)) return { ok: false, error: 'Enter three digits.' };
        const want = ANSWER.dial(b, mod);
        return c.every((d, j) => d === want[j]) ? ok() : bad(`${c.join('')} is the wrong code!`);
      }
      case 'lamps': {
        if (!SHAPES.includes(m.shape)) return { ok: false, error: 'Press a shape.' };
        const want = ANSWER.lamps(b, mod);
        if (m.shape !== want[mod.input.length]) { mod.input = []; return bad('Wrong lamp signal!'); }
        mod.input.push(m.shape);
        return mod.input.length === want.length ? ok() : { ok: true, result: 'ok' };
      }
      default: return { ok: false, error: 'Unknown move.' };
    }
  }
  actRadio(p, m) {
    if (this.phase !== 'tick') return { ok: false, error: 'Not now.' };
    const sq = this.squadOf(p.id), b = sq && sq.bomb;
    if (!b || !b.radio || b.status !== 'live') return { ok: false, error: 'There’s no radio here.' };
    if (sq.defusers[0] !== p.id) return { ok: false, error: 'Only the defuser can work the radio.' };
    if (!b.radio.active) return { ok: false, error: 'The radio is quiet.' };
    const ch = m.ch;
    if (!Number.isInteger(ch) || ch < 1 || ch > 6) return { ok: false, error: 'Pick a channel 1 to 6.' };
    const R = b.radio; R.active = false; this.room.cancel(R.timer);
    if (ch !== CALLSIGNS[R.call][1]) { this.strike(sq, p, `Channel ${ch} was wrong!`); if (b.status === 'live') this.scheduleRadio(sq, 35000 + this.room.rng() * 20000); return { ok: true, result: 'strike' }; }
    this.give(p.id, PTS.radio); this.st(p.id).radio++;
    for (const id of new Set([...(sq.holders.get('radio:A') || []), ...(sq.holders.get('radio:B') || [])])) { this.give(id, PTS.radioAssist); this.st(id).assists++; }
    this.team += 50; sq.total += 50;
    this.note(sq, 'solve', 'Radio answered!');
    this.room.fx('solve', { squad: sq.id });
    this.scheduleRadio(sq, 35000 + this.room.rng() * 20000);
    return { ok: true, result: 'solved' };
  }

  // ---------- what the screens see ----------
  person(id) { const p = this.room.get(id); return p ? { id, name: p.name, avatar: p.avatar, color: p.color } : { id, name: '—', avatar: '🙂', color: '#888' }; }
  bombTv(sq) {
    const b = sq.bomb; if (!b) return null; const now = this.room.now();
    return { status: b.status, endsIn: b.status === 'live' && this.phase === 'tick' ? Math.max(0, b.endsAt - now) : 0, left: b.left, secs: this.secs, strikes: b.strikes, why: b.why || null,
      mods: b.mods.map((m) => ({ type: m.type, name: INFO[m.type][0], icon: INFO[m.type][1], solved: m.solved })),
      needy: !!b.radio, radio: b.radio && b.radio.active ? { endsIn: Math.max(0, b.radio.endsAt - now) } : null, log: b.log };
  }
  squadTv(sq) {
    const gained = sq.members.reduce((n, id) => n + (this.st(id).points - (this.roundStart.get(id) || 0)), 0);
    return { id: sq.id, name: sq.name, color: sq.color, defusers: sq.defusers.map((id) => this.person(id)), experts: sq.members.filter((id) => !sq.defusers.includes(id)).map((id) => this.person(id)), bomb: this.bombTv(sq), total: sq.total, gained };
  }
  tv() {
    const live = this.liveSquads(), now = this.room.now();
    const lefts = live.map((q) => q.bomb && q.bomb.status === 'live' && this.phase === 'tick' ? q.bomb.endsAt - now : Infinity).filter((x) => x < Infinity);
    return {
      phase: this.phase, round: this.round, of: this.s.bombs, secs: this.secs, mods: this.nMods, needy: this.needy, team: this.team,
      endsIn: this.phase === 'tick' ? Math.max(0, lefts.length ? Math.min(...lefts) : 0) : this.endsAt ? Math.max(0, this.endsAt - now) : 0,
      squads: live.map((q) => this.squadTv(q)),
      standings: this.standings().slice(0, 12).map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, color: r.color, points: r.points, solves: r.solves, assists: r.assists })),
      final: this.phase === 'over' ? this.final : null,
    };
  }
  modView(b, m, me) {
    const base = { id: m.id, type: m.type, name: INFO[m.type][0], icon: INFO[m.type][1], solved: m.solved, mine: m.owner === me, owner: this.room.name(m.owner) };
    if (m.owner !== me) return base;
    switch (m.type) {
      case 'wires': return { ...base, wires: m.wires, cut: m.cut };
      case 'plunger': return { ...base, cap: m.cap, label: m.label, strip: m.strip };
      case 'glyphs': return { ...base, keys: m.keys.map((g) => GLYPHS[g]), pressed: m.pressed };
      case 'maze': return { ...base, star: MAPS[m.map].star, pos: m.pos, exit: m.exit };
      case 'dial': return { ...base, word: m.word };
      case 'lamps': return { ...base, seq: m.seq, done: m.input.length };
      default: return base;
    }
  }
  view(p) {
    const s = this.st(p.id), rows = this.standings(), rank = rows.findIndex((r) => r.id === p.id) + 1;
    const sq = this.squadOf(p.id), b = sq && sq.bomb;
    const out = { phase: this.phase, round: this.round, of: this.s.bombs, secs: this.secs, mods: this.nMods, needy: this.needy, team: this.team, me: p.id,
      points: s.points, stats: s, rank, players: rows.length, gained: s.points - (this.roundStart.get(p.id) || 0), endsIn: this.phase === 'brief' && this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0 };
    if (this.phase === 'over') return { ...out, final: this.final, standings: rows.slice(0, 10).map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, points: r.points })) };
    if (!sq || !b) return { ...out, role: 'none' };
    const defuser = sq.defusers.includes(p.id);
    const bt = this.bombTv(sq);
    out.squad = { name: sq.name, color: sq.color, n: this.liveSquads().length };
    out.role = defuser ? 'defuser' : 'expert';
    out.defusers = sq.defusers.map((id) => this.person(id));
    out.bomb = { ...bt, mods: b.mods.map((m) => this.modView(b, m, p.id)) };
    const pageOf = (key) => { const x = section(key), done = key.startsWith('radio') ? false : b.mods.some((m) => m.type === x.type && m.solved); return { ...x, done, with: (sq.holders.get(x.type + ':' + (x.part === 'A' ? 'B' : 'A')) || []).filter((id) => id !== p.id).map((id) => this.room.name(id)) }; };
    if (defuser) {
      out.plate = { serial: b.serial, batteries: b.batteries, sticker: b.sticker, spark: b.spark };
      const R = b.radio;
      out.radio = R && R.active && sq.defusers[0] === p.id ? { call: CALLSIGNS[R.call][0], endsIn: Math.max(0, R.endsAt - this.room.now()), n: R.n } : null;
      out.radioMine = !!R && sq.defusers[0] === p.id;
      out.help = {};
      for (const [key, ids] of sq.holders) { const [t, part] = key.split(':'); (out.help[t] = out.help[t] || []).push(...ids.map((id) => ({ name: this.room.name(id), part }))); }
      if (sq.solo) out.manual = [...sq.holders.keys()].map(pageOf);
    } else {
      out.pages = (sq.pages.get(p.id) || []).map(pageOf);
    }
    return out;
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ minutes: M }) => {
  const per = { long: 3.6, normal: 2.8, short: 2 };
  const s = PF.best({ bombs: [4, 3, 5], fuse: ['normal', 'long', 'short'] }, (x) => 0.5 + x.bombs * per[x.fuse], M);
  return { bombs: s.bombs, fuse: s.fuse };
};

module.exports = {
  partyFit,
  key: 'bomb', name: 'Bomb Squad', min: 2, best: [3, 8], howSteps: 6, fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/bomb.js)
  locked: { how: 'Finish a game of Two Truths & a Lie to unlock it.' }, // public/unlocks.js + UNLOCK_RULES in box/room.js
  create: (room, settings) => new Game(room, settings),
  // For the tests: the rule book.
  _rules: { ANSWER, MAPS, mazePath, MANUAL, GLYPHS, CALLSIGNS, STRIPS },
};
