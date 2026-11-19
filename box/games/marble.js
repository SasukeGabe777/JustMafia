'use strict';
// JustMarble: every phone is one piece of a wooden labyrinth. The pieces only make sense when
// everyone puts their phones together. The marble starts on one phone; whoever holds it drags
// a finger on their board to roll it (the physics runs on that phone), and when it rolls off the edge through
// a gap it lands on the neighbour's phone. Get it into the goal before time runs out.
//
// The maze is one big grid split into boards (rows × cols of phones). Cells carry wall bits;
// the server owns the maze, who holds the marble, and the score. The holder's phone owns the
// physics and reports moves (`mv`), hand-offs (`pass`), holes, gems and the finish; each report
// is checked against the maze. Bots (and players who drop out) roll it along the right path.
//
// Scoring (per round):
//   cleared:   everyone on a board +100, +2 per second left; the player who sinks it +50
//   pass:      +30 when the marble leaves your board closer to the goal than it arrived (max 3)
//   gem:       +25 to whoever's board it was on
//   hole:      −15 (the marble goes back to where it came onto your board)
//   not cleared: everyone gets up to 60 for how close the team got
// Per-game gear (JustGold shop): the marble wears its current holder's skin.
const GEARS = require('../../public/shared/gear');
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rounds', label: 'Rounds', options: opt([[3, '3 mazes'], [5, '5 mazes']]) },
  { key: 'size', label: 'Board size', options: opt([['small', 'Small boards'], ['medium', 'Medium boards'], ['large', 'Big boards']]) },
  { key: 'holes', label: 'Holes', options: opt([['off', 'No holes'], ['some', 'A few holes'], ['lots', 'Lots of holes']]) },
  { key: 'seconds', label: 'Time per maze', options: opt([['auto', 'Fits the maze'], [90, '90 seconds'], [120, '2 minutes'], [180, '3 minutes']]) },
];
const defaults = { rounds: 3, size: 'medium', holes: 'some', seconds: 'auto' };
const SIZES = { small: [4, 6], medium: [5, 7], large: [6, 9] }; // cells per phone: [across, down] (portrait)
const MAX_BOARDS = 12;
const LINEUP_MS = 15000, RESULT_MS = 9000, TICK_MS = 250, OFFLINE_MS = 4000;
const N = 1, E = 2, S = 4, W = 8;
const DIRS = [[N, 0, -1, S], [E, 1, 0, W], [S, 0, 1, N], [W, -1, 0, E]];
const SIDE = { N, E, S, W };
const PTS = { clear: 100, perSec: 2, sink: 50, pass: 30, passMax: 3, gem: 25, hole: -15, progress: 60 };
// Each maze has a twist. The first is always the warm-up.
const MODS = [
  { k: 'classic', name: 'Warm-up', icon: '🪵', about: 'A plain wooden maze. Put your phones together and find the way!', holes: 0, gems: 2 },
  { k: 'holes', name: 'Pitfalls', icon: '🕳️', about: 'Holes! Fall in and the marble goes back to where it came onto your board.', holes: 1, gems: 3 },
  { k: 'ice', name: 'Ice Rink', icon: '🧊', about: 'The wood is iced over. Gentle drags!', holes: 1, gems: 3, ice: true },
  { k: 'mirror', name: 'Mirror Board', icon: '🪞', about: 'One board rolls backwards. Who has it?', holes: 1, gems: 3, mirror: true },
  { k: 'gems', name: 'Gem Rush', icon: '💎', about: 'Gems everywhere. Grab them on the way for points!', holes: 1, gems: 8 },
];

function layout(n) {
  if (n <= 3) return { rows: 1, cols: n };
  if (n === 4) return { rows: 2, cols: 2 };
  if (n <= 8) return { rows: 2, cols: Math.ceil(n / 2) };
  return { rows: 3, cols: Math.ceil(n / 3) };
}

class Game {
  constructor(room, s) {
    this.room = room; this.s = { ...defaults, ...s };
    this.phase = 'lineup'; this.round = 0; this.points = new Map(); this.stats = new Map();
    this.endsAt = 0; this.timer = null; this.ticker = null; this.events = []; this.cleared = 0; this.totalTime = 0;
    this.board = null; this.marble = null; this.ready = new Set(); this.mods = []; this.last = null; this.spotted = new Map();
  }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  rng() { return this.room.rng(); }
  pick(a) { return a[Math.floor(this.rng() * a.length)]; }
  shuffle(a) { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  stat(id) { let r = this.stats.get(id); if (!r) { r = { drops: 0, gems: 0, passes: 0, sinks: 0 }; this.stats.set(id, r); } return r; }
  add(id, n) { if (this.room.get(id)) this.points.set(id, Math.max(0, (this.points.get(id) || 0) + n)); if (this.gain) this.gain.set(id, (this.gain.get(id) || 0) + n); }
  log(text, icon = '') { this.events.push({ t: text, icon, at: this.room.now() }); if (this.events.length > 6) this.events.shift(); }

  start() {
    for (const p of this.room.list()) this.points.set(p.id, 0);
    const rest = this.shuffle(MODS.slice(1));
    this.mods = [MODS[0], ...Array.from({ length: this.s.rounds - 1 }, (_, i) => rest[i % rest.length])];
    this.nextRound();
  }
  joined(p) { if (!this.points.has(p.id)) this.points.set(p.id, 0); }
  left() { if (this.phase === 'lineup') this.maybeGo(); }

  // ---------------- the maze ----------------
  nextRound() {
    if (this.round >= this.s.rounds) return this.end();
    this.round++; this.mod = this.mods[this.round - 1] || MODS[0];
    // Who gets a board: everyone up to 12; the rest are spotters (a different few each round).
    const all = this.shuffle(this.room.list()).sort((a, b) => (this.spotted.get(b.id) || 0) - (this.spotted.get(a.id) || 0));
    const boards = all.slice(0, MAX_BOARDS), spot = all.slice(MAX_BOARDS);
    for (const p of spot) this.spotted.set(p.id, (this.spotted.get(p.id) || 0) + 1);
    this.board = this.makeBoard(this.shuffle(boards).map((p) => p.id));
    this.spotters = spot.map((p) => p.id);
    this.ready = new Set(); this.events = []; this.gain = new Map(); this.passCount = new Map();
    this.phase = 'lineup'; this.marble = null; this.room.fx('lineup');
    this.setTimer(LINEUP_MS, () => this.go());
    for (const id of this.board.owners) { const p = this.room.get(id); if (p && p.bot) this.ready.add(id); }
    this.maybeGo();
  }
  makeBoard(owners) {
    const n = owners.length, { rows, cols } = layout(n), [cw, ch] = SIZES[this.s.size] || SIZES.medium;
    const gw = cols * cw, gh = rows * ch;
    const tileOf = (x, y) => (x < 0 || y < 0 || x >= gw || y >= gh ? -1 : Math.floor(y / ch) * cols + Math.floor(x / cw));
    const live = (x, y) => { const t = tileOf(x, y); return t >= 0 && t < n; };
    let best = null;
    for (let tries = 0; tries < 24; tries++) {
      const cells = new Array(gw * gh).fill(-1);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (live(x, y)) cells[y * gw + x] = 0;
      // Start: a cell on the first board. Carve a perfect maze (iterative backtracker).
      const sx = Math.floor(this.rng() * cw), sy = Math.floor(this.rng() * ch), start = sy * gw + sx;
      const seen = new Set([start]), stack = [start];
      while (stack.length) {
        const c = stack[stack.length - 1], x = c % gw, y = Math.floor(c / gw);
        const opts = DIRS.filter(([, dx, dy]) => live(x + dx, y + dy) && !seen.has((y + dy) * gw + x + dx));
        if (!opts.length) { stack.pop(); continue; }
        const [bit, dx, dy, back] = this.pick(opts), d = (y + dy) * gw + x + dx;
        cells[c] |= bit; cells[d] |= back; seen.add(d); stack.push(d);
      }
      // A few loops so there's more than one way (and a wrong turn isn't the end of the world).
      for (let c = 0; c < cells.length; c++) {
        if (cells[c] < 0 || this.rng() > 0.07) continue;
        const x = c % gw, y = Math.floor(c / gw);
        const opts = DIRS.filter(([bit, dx, dy]) => !(cells[c] & bit) && live(x + dx, y + dy));
        if (!opts.length) continue;
        const [bit, dx, dy, back] = this.pick(opts); cells[c] |= bit; cells[(y + dy) * gw + x + dx] |= back;
      }
      const dist = this.bfs(cells, gw, gh, start);
      const far = Math.max(...dist);
      const cand = []; for (let c = 0; c < cells.length; c++) if (dist[c] >= far * 0.7 && tileOf(c % gw, Math.floor(c / gw)) !== 0) cand.push(c);
      if (!cand.length) for (let c = 0; c < cells.length; c++) if (dist[c] === far) cand.push(c);
      const finish = this.pick(cand), path = this.pathTo(cells, gw, gh, start, finish);
      const touched = new Set(path.map((c) => tileOf(c % gw, Math.floor(c / gw)))).size;
      const target = n * (cw + ch) * 1.1, score = touched * 1000 - Math.abs(path.length - target);
      if (!best || score > best.score) best = { score, cells, start, finish, path };
      if (touched === n && tries >= 6) break;
    }
    const B = { rows, cols, cw, ch, gw, gh, n, owners, cells: best.cells, start: best.start, finish: best.finish, path: best.path, tileOf };
    B.goalDist = this.bfs(B.cells, gw, gh, B.finish);
    this.placeItems(B);
    B.mirror = this.mod.mirror ? this.pick(owners.map((_, i) => i).filter((i) => i !== 0 || n === 1)) : -1;
    B.visited = new Set([B.start]);
    return B;
  }
  bfs(cells, gw, gh, from) {
    const dist = new Array(cells.length).fill(-1); dist[from] = 0; const q = [from];
    for (let i = 0; i < q.length; i++) {
      const c = q[i], x = c % gw, y = Math.floor(c / gw);
      for (const [bit, dx, dy] of DIRS) if (cells[c] & bit) { const d = (y + dy) * gw + x + dx; if (dist[d] < 0) { dist[d] = dist[c] + 1; q.push(d); } }
    }
    return dist;
  }
  pathTo(cells, gw, gh, from, to) {
    const dist = this.bfs(cells, gw, gh, to); const path = [from]; let c = from;
    while (c !== to && path.length < cells.length) {
      const x = c % gw, y = Math.floor(c / gw);
      const nx = DIRS.filter(([bit]) => cells[c] & bit).map(([, dx, dy]) => (y + dy) * gw + x + dx).find((d) => dist[d] === dist[c] - 1);
      if (nx == null) break; c = nx; path.push(c);
    }
    return path;
  }
  placeItems(B) {
    const onPath = new Set(B.path), free = [], pathCells = [];
    for (let c = 0; c < B.cells.length; c++) {
      if (B.cells[c] < 0 || c === B.start || c === B.finish) continue;
      (onPath.has(c) ? pathCells : free).push(c);
    }
    const holeMul = this.s.holes === 'off' ? 0 : this.s.holes === 'lots' ? 2 : 1;
    const nHoles = Math.round(this.mod.holes * holeMul * B.n * 1.5);
    const nGems = Math.max(1, Math.round(this.mod.gems * Math.max(1, B.n / 3)));
    const used = new Set(); let id = 0;
    B.holes = []; B.gems = [];
    const take = (list) => { const l = this.shuffle(list.filter((c) => !used.has(c))); const c = l[0]; if (c != null) used.add(c); return c; };
    // Holes: in side passages, and (lots of holes / later twists) on the way itself, pushed against a wall so you can steer around them.
    for (let i = 0; i < nHoles; i++) {
      const onWay = holeMul === 2 ? i % 2 === 0 : i % 3 === 0;
      const c = take(onWay ? pathCells : free); if (c == null) continue;
      let ox = 0, oy = 0;
      if (onWay) {
        const closed = DIRS.filter(([bit]) => !(B.cells[c] & bit)); if (!closed.length) { used.delete(c); continue; }
        const [, dx, dy] = this.pick(closed); ox = dx * 0.27; oy = dy * 0.27;
      }
      B.holes.push({ id: ++id, c, x: (c % B.gw) + 0.5 + ox, y: Math.floor(c / B.gw) + 0.5 + oy });
    }
    for (let i = 0; i < nGems; i++) {
      const c = take(i % 2 ? free : pathCells) ?? take(free) ?? take(pathCells); if (c == null) continue;
      B.gems.push({ id: ++id, c, x: (c % B.gw) + 0.5, y: Math.floor(c / B.gw) + 0.5, by: null });
    }
  }
  cellAt(x, y) { const B = this.board, cx = Math.floor(x), cy = Math.floor(y); return cx < 0 || cy < 0 || cx >= B.gw || cy >= B.gh ? -1 : cy * B.gw + cx; }
  tileOrigin(t) { const B = this.board; return { x0: (t % B.cols) * B.cw, y0: Math.floor(t / B.cols) * B.ch }; }

  // ---------------- playing ----------------
  maybeGo() {
    if (this.phase !== 'lineup' || !this.board) return;
    const need = this.board.owners.filter((id) => { const p = this.room.get(id); return p && !p.bot && p.sockets > 0; });
    if (need.every((id) => this.ready.has(id))) this.go();
  }
  go() {
    if (this.phase !== 'lineup') return;
    const B = this.board;
    this.phase = 'roll'; this.roundStart = this.room.now();
    this.marble = { x: (B.start % B.gw) + 0.5, y: Math.floor(B.start / B.gw) + 0.5, vx: 0, vy: 0, seq: 1, tile: 0, holder: B.owners[0], entry: null, carry: null, offlineSince: 0, lastMove: this.room.now() };
    this.arrive(0, B.start);
    this.room.fx('go');
    this.roundSecs = this.s.seconds === 'auto' ? Math.max(60, Math.min(300, Math.round((45 + B.path.length * 1.3) / 15) * 15)) : Number(this.s.seconds) || 120;
    this.setTimer(this.roundSecs * 1000, () => this.finishRound(false));
    this.room.cancel(this.ticker); this.ticker = this.room.after(TICK_MS, () => this.tick());
    this.log(`${this.room.name(B.owners[0])} has the marble!`, '🔮');
  }
  // The marble lands on board t at cell c.
  arrive(t, c) {
    const M = this.marble, B = this.board;
    M.tile = t; M.holder = B.owners[t]; M.entry = { x: M.x, y: M.y, dist: B.goalDist[c] }; M.carry = null; M.offlineSince = 0;
    M.arrivedAt = this.room.now();
  }
  tick() {
    this.ticker = null;
    if (this.phase !== 'roll') return;
    const M = this.marble, p = this.room.get(M.holder), now = this.room.now();
    const offline = !p || (!p.bot && p.sockets <= 0);
    if (offline && !M.offlineSince) M.offlineSince = now; if (!offline) M.offlineSince = 0;
    if (p && p.bot) this.botStep(now);
    else if (offline && now - M.offlineSince > OFFLINE_MS) this.botStep(now);
    if (this.phase !== 'roll') return;
    if (this.dirty) { this.dirty = false; this.room.sync(); }
    this.ticker = this.room.after(TICK_MS, () => this.tick());
  }
  // Bots (and dropped players) roll the marble along the right way, a cell at a time.
  botStep(now) {
    const M = this.marble, B = this.board;
    if (now < (M.pauseUntil || 0)) return;
    if (!M.carry) {
      const here = this.cellAt(M.x, M.y), path = this.pathTo(B.cells, B.gw, B.gh, here, B.finish);
      const slip = this.mod.holes && this.s.holes !== 'off' && B.holes.some((h) => B.tileOf(h.c % B.gw, Math.floor(h.c / B.gw)) === M.tile) && this.rng() < 0.12;
      M.carry = { path, i: 1, next: now + 900 + this.rng() * 900, slip };
      return;
    }
    if (now < M.carry.next) return;
    if (M.carry.slip) { // even bots fall in sometimes
      M.carry.slip = false; const h = B.holes.find((x) => B.tileOf(x.c % B.gw, Math.floor(x.c / B.gw)) === M.tile);
      if (h) { this.dropIn(M.holder, h); M.pauseUntil = now + 1500; return; }
    }
    const c = M.carry.path[M.carry.i];
    if (c == null) { M.carry = null; return; }
    const t = B.tileOf(c % B.gw, Math.floor(c / B.gw));
    M.x = (c % B.gw) + 0.5; M.y = Math.floor(c / B.gw) + 0.5; M.carry.i++; M.carry.next = now + 380 + this.rng() * 320;
    this.visit(c); this.dirty = true;
    for (const g of B.gems) if (!g.by && g.c === c) this.grab(M.holder, g);
    if (c === B.finish) return this.finishRound(true);
    if (t !== M.tile) this.handOff(t, c);
  }
  visit(c) { if (c >= 0 && this.board.cells[c] >= 0) this.board.visited.add(c); }
  handOff(t, c) {
    const M = this.marble, B = this.board, from = M.holder;
    const closer = M.entry && B.goalDist[c] >= 0 && B.goalDist[c] < M.entry.dist;
    if (closer && (this.passCount.get(from) || 0) < PTS.passMax) { this.passCount.set(from, (this.passCount.get(from) || 0) + 1); this.add(from, PTS.pass); this.stat(from).passes++; }
    M.seq++; this.arrive(t, c);
    this.log(`${this.room.name(from)} → ${this.room.name(M.holder)}`, '➡️');
    this.room.fx('pass', { id: M.holder }); this.dirty = true;
  }
  dropIn(id, h) {
    const M = this.marble;
    this.add(id, PTS.hole); this.stat(id).drops++;
    this.log(`${this.room.name(id)} fell in a hole!`, '🕳️'); this.room.fx('hole', { id, x: h.x, y: h.y });
    if (M.entry) { M.x = M.entry.x; M.y = M.entry.y; } M.vx = 0; M.vy = 0; M.seq++; M.carry = null; this.dirty = true;
  }
  grab(id, g) {
    g.by = id; this.add(id, PTS.gem); this.stat(id).gems++;
    this.log(`${this.room.name(id)} grabbed a gem!`, '💎'); this.room.fx('gem', { id }); this.dirty = true;
  }
  finishRound(won) {
    if (this.phase !== 'roll') return;
    const B = this.board, M = this.marble, left = Math.max(0, Math.round((this.endsAt - this.room.now()) / 1000));
    this.room.cancel(this.ticker); this.ticker = null;
    const team = [...B.owners, ...this.spotters];
    if (won) {
      this.cleared++; this.totalTime += Math.round((this.room.now() - this.roundStart) / 1000);
      for (const id of team) this.add(id, PTS.clear + PTS.perSec * left);
      this.add(M.holder, PTS.sink); this.stat(M.holder).sinks++;
      this.log(`${this.room.name(M.holder)} sank it!`, '🏁'); this.room.fx('win');
    } else {
      this.totalTime += this.roundSecs;
      const startD = B.goalDist[B.start] || 1, now = Math.max(0, B.goalDist[this.cellAt(M.x, M.y)] ?? startD);
      const prog = Math.max(0, Math.min(1, 1 - now / startD));
      for (const id of team) this.add(id, Math.round(PTS.progress * prog));
      this.lastProgress = prog; this.room.fx('timeup');
    }
    this.last = { won, left, holder: M.holder, progress: won ? 1 : this.lastProgress, gains: [...this.gain].map(([id, n]) => ({ id, name: this.room.name(id), avatar: (this.room.get(id) || {}).avatar, n })).sort((a, b) => b.n - a.n) };
    this.phase = 'result';
    this.setTimer(RESULT_MS, () => this.nextRound());
  }
  end() { this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.room.cancel(this.ticker); this.room.fx('over'); }
  next() { if (this.phase === 'lineup') this.go(); else if (this.phase === 'roll') this.finishRound(false); else if (this.phase === 'result') this.nextRound(); }
  standings() { return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), avatar: (this.room.get(id) || {}).avatar, color: (this.room.get(id) || {}).color, points: pts, ...this.stat(id) })).sort((a, b) => b.points - a.points); }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }

  // ---------------- phones ----------------
  act(p, m) {
    const op = m && m.op, B = this.board, M = this.marble;
    if (op === 'ready') {
      if (this.phase !== 'lineup') return { ok: false, error: 'Not now.' };
      this.ready.add(p.id); this.maybeGo(); return { ok: true };
    }
    if (!['mv', 'pass', 'hole', 'gem', 'finish'].includes(op)) return { ok: false, error: 'Unknown move.' };
    // A late report from a phone that no longer has the marble is ignored quietly (no error toast).
    if (this.phase !== 'roll' || !M || M.holder !== p.id || m.seq !== M.seq) return { ok: true, stale: true, quiet: true };
    const x = Number(m.x), y = Number(m.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: 'Bad position.', quiet: true };
    const { x0, y0 } = this.tileOrigin(M.tile), gx = x0 + x, gy = y0 + y;
    // The marble can only be on (or just over the edge of) this board, near where it last was.
    if (x < -0.6 || y < -0.6 || x > B.cw + 0.6 || y > B.ch + 0.6) return { ok: false, error: 'Off the board.', quiet: true };
    const near = (ax, ay, d) => Math.hypot(ax - gx, ay - gy) <= d;
    M.lastMove = this.room.now(); M.carry = null;
    if (op === 'mv') {
      const vx = Number(m.vx) || 0, vy = Number(m.vy) || 0;
      M.x = Math.max(x0, Math.min(x0 + B.cw - 0.01, gx)); M.y = Math.max(y0, Math.min(y0 + B.ch - 0.01, gy));
      M.vx = Math.max(-10, Math.min(10, vx)); M.vy = Math.max(-10, Math.min(10, vy));
      this.visit(this.cellAt(M.x, M.y)); this.dirty = true;
      return { ok: true, quiet: true };
    }
    if (op === 'pass') {
      // Which edge it went over, the cell on this board next to it, and the gap that must be there.
      const side = SIDE[m.side]; if (!side) return { ok: false, error: 'Bad side.' };
      const lx = Math.max(0, Math.min(B.cw - 1, Math.floor(x))), ly = Math.max(0, Math.min(B.ch - 1, Math.floor(y)));
      const edgeOk = (side === E && lx === B.cw - 1) || (side === W && lx === 0) || (side === S && ly === B.ch - 1) || (side === N && ly === 0);
      const c = (y0 + ly) * B.gw + x0 + lx;
      if (!edgeOk || !(B.cells[c] & side)) return { ok: false, error: 'There is a wall there.' };
      const [, dx, dy] = DIRS.find(([bit]) => bit === side), d = c + dy * B.gw + dx;
      const t = B.tileOf((c % B.gw) + dx, Math.floor(c / B.gw) + dy);
      if (t < 0 || t >= B.n) return { ok: false, error: 'There is a wall there.' };
      // Land just inside the next board, keeping the position along the edge and the speed.
      const along = side === E || side === W ? Math.max(Math.floor(gy) + 0.25, Math.min(Math.floor(gy) + 0.75, gy)) : Math.max(Math.floor(gx) + 0.25, Math.min(Math.floor(gx) + 0.75, gx));
      if (side === E) { M.x = x0 + B.cw + 0.3; M.y = along; } else if (side === W) { M.x = x0 - 0.3; M.y = along; }
      else if (side === S) { M.y = y0 + B.ch + 0.3; M.x = along; } else { M.y = y0 - 0.3; M.x = along; }
      M.vx = Math.max(-6, Math.min(6, Number(m.vx) || 0)); M.vy = Math.max(-6, Math.min(6, Number(m.vy) || 0));
      this.visit(d); this.handOff(t, d);
      return { ok: true };
    }
    if (op === 'hole') {
      const h = B.holes.find((o) => o.id === m.id);
      if (!h || B.tileOf(h.c % B.gw, Math.floor(h.c / B.gw)) !== M.tile || !near(h.x, h.y, 1.2)) return { ok: false, error: 'No hole there.', quiet: true };
      this.dropIn(p.id, h); return { ok: true };
    }
    if (op === 'gem') {
      const g = B.gems.find((o) => o.id === m.id);
      if (!g || g.by || B.tileOf(g.c % B.gw, Math.floor(g.c / B.gw)) !== M.tile || !near(g.x, g.y, 1.2)) return { ok: false, error: 'No gem there.', quiet: true };
      M.x = gx; M.y = gy; this.grab(p.id, g); return { ok: true };
    }
    // finish
    const fx = (B.finish % B.gw) + 0.5, fy = Math.floor(B.finish / B.gw) + 0.5;
    if (B.tileOf(B.finish % B.gw, Math.floor(B.finish / B.gw)) !== M.tile || !near(fx, fy, 1)) return { ok: false, error: 'Not at the goal yet.', quiet: true };
    M.x = fx; M.y = fy; this.visit(B.finish); this.finishRound(true);
    return { ok: true };
  }

  boardTv(reveal) {
    const B = this.board; if (!B) return null;
    const who = (id) => { const p = this.room.get(id) || {}; return { id, name: this.room.name(id), avatar: p.avatar || '🙂', color: p.color || '#fff', bot: !!p.bot, online: !!p.bot || p.sockets > 0, gear: GEARS.gearSet(p, 'marble') }; };
    return {
      rows: B.rows, cols: B.cols, cw: B.cw, ch: B.ch, gw: B.gw, gh: B.gh, n: B.n, owners: B.owners.map(who),
      start: B.start, finish: B.finish, cells: B.cells, visited: [...B.visited], reveal: !!reveal,
      path: reveal ? B.path : null, holes: reveal ? B.holes.map((h) => [h.x, h.y]) : null,
      gems: B.gems.map((g) => ({ x: g.x, y: g.y, by: g.by })), mirror: reveal ? B.mirror : -1,
    };
  }
  // gear: the holder's marble skin (the marble changes skin as it is handed from phone to phone).
  marbleTv() { const M = this.marble; return M ? { x: M.x, y: M.y, tile: M.tile, holder: M.holder, name: this.room.name(M.holder), seq: M.seq, gear: GEARS.gearSet(this.room.get(M.holder), 'marble') } : null; }
  tv() {
    const done = this.phase === 'result' || this.phase === 'over';
    return {
      phase: this.phase, round: this.round, of: this.s.rounds, mod: this.mod ? { k: this.mod.k, name: this.mod.name, icon: this.mod.icon, about: this.mod.about } : null,
      endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, seconds: this.roundSecs || 0,
      board: this.boardTv(done), marble: this.marbleTv(), events: this.events.slice(-5), last: this.phase === 'result' || this.phase === 'over' ? this.last : null,
      ready: [...this.ready], spotters: (this.spotters || []).map((id) => this.room.name(id)),
      cleared: this.cleared, totalTime: this.totalTime, standings: this.standings().slice(0, 12),
      gemsLeft: this.board ? this.board.gems.filter((g) => !g.by).length : 0,
    };
  }
  view(p) {
    const B = this.board, M = this.marble, base = { phase: this.phase, round: this.round, of: this.s.rounds, mod: this.tv().mod, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, points: this.points.get(p.id) || 0, ready: this.ready.has(p.id), gear: GEARS.gearSet(p, 'marble') /* my marble skin */, last: this.phase === 'result' || this.phase === 'over' ? this.last : null };
    if (this.phase === 'over') { const st = this.standings(); return { ...base, rank: st.findIndex((r) => r.id === p.id) + 1, of: st.length, cleared: this.cleared, rounds: this.s.rounds, stats: this.stat(p.id) }; }
    const t = B ? B.owners.indexOf(p.id) : -1;
    if (!B || t < 0) return { ...base, spotter: true, board: B ? { rows: B.rows, cols: B.cols, owners: B.owners.map((id) => this.room.name(id)) } : null, holder: M ? this.room.name(M.holder) : null, holderTile: M ? M.tile : -1 };
    const { x0, y0 } = this.tileOrigin(t), sx = t % B.cols, sy = Math.floor(t / B.cols);
    const cells = []; for (let y = 0; y < B.ch; y++) for (let x = 0; x < B.cw; x++) cells.push(B.cells[(y0 + y) * B.gw + x0 + x]);
    const mine = (c) => B.tileOf(c % B.gw, Math.floor(c / B.gw)) === t;
    const local = (o) => ({ id: o.id, x: o.x - x0, y: o.y - y0 });
    const nb = (dx, dy) => { const nx = sx + dx, ny = sy + dy; if (nx < 0 || ny < 0 || nx >= B.cols || ny >= B.rows) return null; const i = ny * B.cols + nx; return i < B.n ? this.room.name(B.owners[i]) : null; };
    const holding = M && M.holder === p.id && this.phase === 'roll';
    return {
      ...base, tile: t, slot: { x: sx, y: sy }, rows: B.rows, cols: B.cols, n: B.n, owners: B.owners.map((id) => this.room.name(id)), cw: B.cw, ch: B.ch, cells,
      holes: B.holes.filter((h) => mine(h.c)).map(local), gems: B.gems.filter((g) => mine(g.c) && !g.by).map(local),
      start: mine(B.start) ? { x: (B.start % B.gw) - x0 + 0.5, y: Math.floor(B.start / B.gw) - y0 + 0.5 } : null,
      finish: mine(B.finish) ? { x: (B.finish % B.gw) - x0 + 0.5, y: Math.floor(B.finish / B.gw) - y0 + 0.5 } : null,
      nb: { N: nb(0, -1), E: nb(1, 0), S: nb(0, 1), W: nb(-1, 0) },
      ice: !!(this.mod && this.mod.ice), mirror: !!(holding && B.mirror === t),
      marble: holding ? { x: M.x - x0, y: M.y - y0, vx: M.vx, vy: M.vy, seq: M.seq } : null,
      holder: M ? this.room.name(M.holder) : null, holderTile: M ? M.tile : -1, holderIsMe: !!holding,
      gain: this.gain ? this.gain.get(p.id) || 0 : 0,
    };
  }
}

module.exports = {
  key: 'marble', name: 'JustMarble', min: 1, best: [2, 6], howSteps: 6, fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/marble.js)
  create: (room, settings) => new Game(room, settings),
  layout, SIZES, PTS, MODS,
};
