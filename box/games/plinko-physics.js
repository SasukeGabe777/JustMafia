'use strict';
// JustDrop: the peg board and its physics. Everything here runs on the server only and is
// fully deterministic (fixed time step, no randomness inside the simulation), so the TV
// animation (the recorded paths) and the scoring always match exactly.
//
// The board is a 1000 x 1300 world: balls drop from y = 70, players' lines live between
// LINE_TOP and LINE_BOT, the slots start at SLOT_TOP.
const W = 1000, H = 1300;
const DROP_Y = 70, LINE_TOP = 150, LINE_BOT = 1080, SLOT_TOP = 1150, LAND_Y = SLOT_TOP + 46;
const PEG_R = 8, BALL_R = 15, BIG_R = 24, LINE_R = 5, DIV_R = 4, BUMP_R = 28, SPIN_R = 6;
const GRAV = 1500, DT = 1 / 240, REC = 8, FPS = 240 / REC, MAX_STEPS = 240 * 20, VMAX = 1500;
const CELL = 64;

// ---------- the boards: harder every level (1–5) ----------
// Slot kinds: pts (points), jack (the jackpot), bust (lose points), x2 (doubles your round),
// steal (takes points from the leader), gift (points + a power-up).
const SLOT_SETS = {
  1: [['pts', 25], ['pts', 50], ['pts', 100], ['pts', 150], ['jack', 300, 1], ['pts', 150], ['pts', 100], ['pts', 50], ['pts', 25]],
  2: [['pts', 50], ['pts', 100], ['pts', 150], ['pts', 100], ['pts', 50], ['bust', -100], ['x2'], ['gift', 50], ['jack', 400, 0.8]],
  3: [['pts', 50], ['pts', 100], ['pts', 150], ['pts', 200], ['pts', 100], ['pts', 50], ['bust', -150], ['bust', -150], ['x2'], ['steal'], ['gift', 50], ['jack', 600, 0.7]],
  4: [['pts', 50], ['pts', 100], ['pts', 150], ['pts', 200], ['pts', 250], ['pts', 100], ['bust', -150], ['bust', -150], ['bust', -150], ['x2'], ['steal'], ['gift', 50], ['jack', 800, 0.65]],
  5: [['pts', 75], ['pts', 100], ['pts', 150], ['pts', 250], ['pts', 300], ['pts', 150], ['bust', -200], ['bust', -200], ['bust', -200], ['x2'], ['x2'], ['steal'], ['gift', 50], ['jack', 1000, 0.65]],
};
const ROWS = [0, 8, 9, 10, 11, 12], SPACING = [0, 100, 96, 92, 88, 84];
const BUMPERS = [0, 0, 1, 2, 2, 3], SPINNERS = [0, 0, 0, 0, 2, 2], WIND = [0, 0, 0, 70, 120, 170];
const label = (k, v) => (k === 'pts' || k === 'jack' ? String(v) : k === 'bust' ? 'BUST' : k === 'x2' ? '×2' : k === 'steal' ? 'STEAL' : k === 'gift' ? '🎁' : '?');

function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Build one round's board. style: classic | neon | chaos (chaos adds bumpers, wind and holes early).
function makeBoard(level, rng, { style = 'classic', powerups = true, sudden = false } = {}) {
  const L = Math.max(1, Math.min(5, level | 0)), chaos = style === 'chaos';
  const news = [];
  // slots
  let specs = SLOT_SETS[L].map((s) => s.slice());
  if (!powerups) specs = specs.map((s) => (s[0] === 'gift' ? ['pts', 75] : s));
  if (sudden) specs = [100, 200, 300, 400, 500, 600, 700, 800, 900].map((v) => ['pts', v]);
  if (L === 1 && !chaos && !sudden) { /* the classic symmetric board */ } else shuffle(specs, rng);
  // keep the jackpot off the outer walls (it should be hard, not impossible)
  const ji = specs.findIndex((s) => s[0] === 'jack');
  if (ji === 0 || ji === specs.length - 1) { const to = ji === 0 ? 2 : specs.length - 3; [specs[ji], specs[to]] = [specs[to], specs[ji]]; }
  const weights = specs.map((s) => s[2] || 1), total = weights.reduce((a, b) => a + b, 0);
  let x = 0; const slots = specs.map((s, i) => { const w = (weights[i] / total) * W, sl = { x0: Math.round(x), x1: Math.round(x + w), k: s[0], v: s[1] == null ? 0 : s[1] }; sl.label = label(sl.k, sl.v); x += w; return sl; });
  slots[slots.length - 1].x1 = W;
  // jackpots never get narrower than a normal ball can fit (the mega ball is too big!)
  for (const sl of slots) if (sl.k === 'jack' && sl.x1 - sl.x0 < 46) sl.x1 = sl.x0 + 46;
  // pegs
  const rows = ROWS[L] + (chaos ? 1 : 0), sx = SPACING[L] - (chaos ? 4 : 0), y0 = 230, y1 = 1070;
  const pegs = [];
  for (let r = 0; r < rows; r++) {
    const y = Math.round(y0 + ((y1 - y0) * r) / (rows - 1)), off = r % 2 ? sx / 2 : 0;
    for (let px = sx / 2 + off - sx; px < W; px += sx) if (px >= 26 && px <= W - 26) pegs.push([Math.round(px), y, 0]);
  }
  // moving bumpers and spinners clear the pegs around them
  const nb = Math.min(4, BUMPERS[L] + (chaos ? 1 : 0)), ns = Math.min(3, SPINNERS[L] + (chaos && L >= 2 ? 1 : 0));
  const bumpers = [], spinners = [];
  const bandY = (i, n) => 380 + ((900 - 380) * (i + 0.5)) / n;
  for (let i = 0; i < nb; i++) bumpers.push({ x: Math.round(160 + rng() * 680), y: Math.round(bandY(i, nb) + (rng() - 0.5) * 60), r: BUMP_R, ax: L >= 3 || chaos ? Math.round(70 + rng() * 90) : 0, w: +(0.7 + rng() * 0.9).toFixed(3), ph: +(rng() * 6.283).toFixed(3) });
  for (let i = 0; i < ns; i++) spinners.push({ x: Math.round(i % 2 ? 620 + rng() * 220 : 160 + rng() * 220), y: Math.round(470 + i * 260 + rng() * 80), len: 130, w: +((rng() < 0.5 ? -1 : 1) * (1.6 + rng() * 1.2)).toFixed(3), ph: +(rng() * 3.14).toFixed(3) });
  const keep = (p) => !bumpers.some((b) => Math.abs(p[1] - b.y) < b.r + 40 && Math.abs(p[0] - b.x) < b.ax + b.r + 34) && !spinners.some((s) => Math.hypot(p[0] - s.x, p[1] - s.y) < s.len / 2 + 34);
  let out = pegs.filter(keep);
  // later boards lose a few pegs: holes make every drop less predictable
  const holes = L >= 3 || chaos ? 2 + L : 0;
  for (let i = 0; i < holes && out.length > 20; i++) out.splice(Math.floor(rng() * out.length), 1);
  // star pegs: the first ball to touch one wins a power-up
  if (powerups && !sudden) { const ns2 = L === 1 ? 1 : 2; for (let i = 0; i < ns2; i++) { const p = out[Math.floor(out.length * 0.15 + rng() * out.length * 0.7)]; if (p) p[2] = 1; } }
  const wind = { amp: sudden ? 0 : WIND[L] + (chaos ? 70 : 0), w: +(0.6 + rng() * 0.6).toFixed(3), ph: +(rng() * 6.283).toFixed(3) };
  // what's new this round (the TV announces it)
  if (L === 1) news.push('Drop it, draw a line, hit the jackpot!');
  if (slots.some((s) => s.k === 'bust')) news.push(`💥 ${slots.filter((s) => s.k === 'bust').length} bust slot${slots.filter((s) => s.k === 'bust').length > 1 ? 's' : ''}`);
  if (slots.some((s) => s.k === 'x2')) news.push('✖️2 doubles your round');
  if (slots.some((s) => s.k === 'steal')) news.push('🦹 STEAL robs the leader');
  if (bumpers.length) news.push(bumpers.some((b) => b.ax) ? '🔴 moving bumpers' : '🔴 bumpers');
  if (spinners.length) news.push('🌀 spinners');
  if (wind.amp) news.push('🌬️ shifting wind');
  if (holes) news.push('🕳️ missing pegs');
  return { level: L, w: W, h: H, dropY: DROP_Y, lineTop: LINE_TOP, lineBot: LINE_BOT, slotTop: SLOT_TOP, pegR: PEG_R, ballR: BALL_R, bigR: BIG_R, fps: FPS, pegs: out, slots, bumpers, spinners, wind, news, sudden: !!sudden };
}

const slotAt = (board, x) => { for (let i = 0; i < board.slots.length; i++) if (x < board.slots[i].x1) return i; return board.slots.length - 1; };
const windAt = (wd, t) => (wd && wd.amp ? wd.amp * Math.sin(t * wd.w + wd.ph) : 0);
const bumperAt = (b, t) => ({ x: b.x + (b.ax ? b.ax * Math.sin(b.w * t + b.ph) : 0), y: b.y, vx: b.ax ? b.ax * b.w * Math.cos(b.w * t + b.ph) : 0 });
const spinAngle = (s, t) => s.ph + s.w * t;

// ---------- lines from phones: clamp, simplify, trim to the ink budget ----------
function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  let idx = -1, dmax = 0; const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1], dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < pts.length - 1; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / len; if (d > dmax) { dmax = d; idx = i; } }
  if (dmax <= eps) return [pts[0], pts[pts.length - 1]];
  return rdp(pts.slice(0, idx + 1), eps).slice(0, -1).concat(rdp(pts.slice(idx), eps));
}
const polyLen = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
const MAX_STROKES = 2, MAX_RAW = 400, MAX_PTS = 24;
// Returns { ok, strokes } or { ok:false, error }. Strokes: [[[x,y],…], …] in board units, ints.
function cleanStrokes(raw, ink) {
  if (raw == null) return { ok: true, strokes: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'That line made no sense.' };
  if (raw.length > MAX_STROKES) return { ok: false, error: `${MAX_STROKES} strokes at most.` };
  let left = Math.max(0, Number(ink) || 0); const out = [];
  for (const st of raw) {
    if (!Array.isArray(st) || st.length > MAX_RAW) return { ok: false, error: 'That line made no sense.' };
    let pts = [];
    for (const p of st) {
      const x = Array.isArray(p) ? p[0] : p && p.x, y = Array.isArray(p) ? p[1] : p && p.y;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: 'That line made no sense.' };
      const q = [Math.round(Math.max(4, Math.min(W - 4, x))), Math.round(Math.max(LINE_TOP, Math.min(LINE_BOT, y)))];
      const l = pts[pts.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) >= 2) pts.push(q);
    }
    if (pts.length < 2) continue;
    let eps = 3; let s = rdp(pts, eps); while (s.length > MAX_PTS) { eps *= 1.6; s = rdp(pts, eps); }
    // trim to the ink that's left
    const t = [s[0]];
    for (let i = 1; i < s.length && left > 0; i++) {
      const [ax, ay] = t[t.length - 1], [bx, by] = s[i], d = Math.hypot(bx - ax, by - ay);
      if (d <= left) { t.push(s[i]); left -= d; } else { const k = left / d; t.push([Math.round(ax + (bx - ax) * k), Math.round(ay + (by - ay) * k)]); left = 0; }
    }
    if (t.length >= 2 && polyLen(t) >= 12) out.push(t);
    if (left <= 0) break;
  }
  return { ok: true, strokes: out };
}

// ---------- the simulation ----------
// lines: [{ pts:[[x,y]…], owner, ghost }]; balls: [{ owner, x, big, sticky, k }].
// Returns per ball: path (flat [x,y,…] every REC steps, ints), slot, landF, stats; plus star pickups.
function simulate(board, lines, balls, { record = true, maxSteps = MAX_STEPS } = {}) {
  // static capsules: line segments + slot dividers, in a grid
  const segs = []; // [ax, ay, bx, by, rad, owner, kind] kind: 0 line, 1 ghost, 2 divider
  for (const l of lines || []) for (let i = 1; i < l.pts.length; i++) segs.push([l.pts[i - 1][0], l.pts[i - 1][1], l.pts[i][0], l.pts[i][1], LINE_R, l.owner, l.ghost ? 1 : 0]);
  for (let i = 1; i < board.slots.length; i++) segs.push([board.slots[i].x0, SLOT_TOP, board.slots[i].x0, H + 60, DIV_R, null, 2]);
  const GW = Math.ceil(W / CELL) + 1, GH = Math.ceil((H + 80) / CELL) + 1;
  const pegCells = Array.from({ length: GW * GH }, () => []), segCells = Array.from({ length: GW * GH }, () => []);
  const cell = (x, y) => Math.max(0, Math.min(GW - 1, Math.floor(x / CELL))) + Math.max(0, Math.min(GH - 1, Math.floor(y / CELL))) * GW;
  board.pegs.forEach((p, i) => pegCells[cell(p[0], p[1])].push(i));
  segs.forEach((s, i) => {
    const pad = s[4] + BIG_R; const cx0 = Math.floor((Math.min(s[0], s[2]) - pad) / CELL), cx1 = Math.floor((Math.max(s[0], s[2]) + pad) / CELL), cy0 = Math.floor((Math.min(s[1], s[3]) - pad) / CELL), cy1 = Math.floor((Math.max(s[1], s[3]) + pad) / CELL);
    for (let cy = Math.max(0, cy0); cy <= Math.min(GH - 1, cy1); cy++) for (let cx = Math.max(0, cx0); cx <= Math.min(GW - 1, cx1); cx++) segCells[cx + cy * GW].push(i);
  });
  const B = balls.map((b, i) => {
    const r = b.big ? BIG_R : BALL_R;
    return { i, owner: b.owner, k: b.k || 0, big: !!b.big, sticky: !!b.sticky, r, m: b.big ? 3 : 1, x: Math.max(r + 2, Math.min(W - r - 2, b.x)), y: DROP_Y, vx: 0, vy: 0,
      path: record ? [] : null, done: false, slot: -1, landF: 0, pegs: 0, walls: 0, bumps: 0, spins: 0, lineHits: 0, ghostHits: 0, touched: new Set(), lastPeg: -1, phase: 0, phaseAll: false, chkX: 0, chkY: 0, stuck: 0 };
  });
  const stars = [], starTaken = new Set();
  const pegE = 0.55, lineE = 0.32, divE = 0.35, wallE = 0.6;
  let step = 0, alive = B.length;
  const rec = (b) => { if (b.path) b.path.push(Math.round(b.x), Math.round(b.y)); };
  if (record) for (const b of B) rec(b);
  function bounce(b, nx, ny, e, fr) { // reflect velocity off a surface with normal n (pointing at the ball)
    const vn = b.vx * nx + b.vy * ny; if (vn >= 0) return 0;
    const ee = b.sticky ? Math.min(e, 0.06) : e, ff = b.sticky ? 0.94 : fr;
    let tx = b.vx - vn * nx, ty = b.vy - vn * ny; tx *= ff; ty *= ff;
    b.vx = tx - ee * vn * nx; b.vy = ty - ee * vn * ny; return -vn;
  }
  while (alive > 0 && step < maxSteps) {
    const t = step * DT; const wind = windAt(board.wind, t);
    const bumps = board.bumpers.map((bb) => bumperAt(bb, t)), spins = board.spinners.map((s) => spinAngle(s, t));
    for (const b of B) {
      if (b.done) continue;
      b.vy += GRAV * DT; b.vx += wind * DT;
      const sp = Math.hypot(b.vx, b.vy); if (sp > VMAX) { b.vx *= VMAX / sp; b.vy *= VMAX / sp; }
      b.x += b.vx * DT; b.y += b.vy * DT;
      if (b.phase > 0) b.phase--;
      // walls + ceiling
      if (b.x < b.r) { b.x = b.r; if (b.vx < -30) b.walls++; b.vx = Math.abs(b.vx) * wallE; }
      if (b.x > W - b.r) { b.x = W - b.r; if (b.vx > 30) b.walls++; b.vx = -Math.abs(b.vx) * wallE; }
      if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.4; }
      if (!b.phaseAll) {
        // pegs (3x3 cells around the ball)
        const cx = Math.floor(b.x / CELL), cy = Math.floor(b.y / CELL);
        for (let yy = cy - 1; yy <= cy + 1; yy++) for (let xx = cx - 1; xx <= cx + 1; xx++) {
          if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
          for (const pi of pegCells[xx + yy * GW]) {
            const p = board.pegs[pi], dx = b.x - p[0], dy = b.y - p[1], rr = b.r + PEG_R, d2 = dx * dx + dy * dy;
            if (d2 >= rr * rr || d2 === 0) continue;
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d; b.x = p[0] + nx * rr; b.y = p[1] + ny * rr;
            const hit = bounce(b, nx, ny, pegE, 0.985);
            if (hit > 40 && b.lastPeg !== pi) { b.pegs++; b.lastPeg = pi; }
            if (p[2] && !starTaken.has(pi)) { starTaken.add(pi); stars.push({ f: Math.floor(step / REC), i: pi, owner: b.owner, ball: b.i }); }
          }
        }
        // line segments + dividers
        const ci = cell(b.x, b.y);
        for (const si of segCells[ci]) {
          const s = segs[si]; if (s[6] !== 2 && b.phase > 0) continue;
          const ax = s[0], ay = s[1], ex = s[2] - ax, ey = s[3] - ay, l2 = ex * ex + ey * ey;
          let u = l2 ? ((b.x - ax) * ex + (b.y - ay) * ey) / l2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
          const qx = ax + ex * u, qy = ay + ey * u, dx = b.x - qx, dy = b.y - qy, rr = b.r + s[4], d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) continue;
          let d = Math.sqrt(d2), nx, ny; if (d < 1e-6) { nx = 0; ny = -1; d = 0; } else { nx = dx / d; ny = dy / d; }
          b.x = qx + nx * rr; b.y = qy + ny * rr;
          const hit = bounce(b, nx, ny, s[6] === 2 ? divE : lineE, s[6] === 2 ? 0.98 : 0.996);
          if (s[6] === 0) { if (hit > 20 || !b.touched.has(s[5])) { if (!b.touched.has(s[5])) b.lineHits++; } b.touched.add(s[5]); }
          else if (s[6] === 1 && hit > 40) b.ghostHits++;
        }
        // bumpers: a big kick
        board.bumpers.forEach((bb, j) => {
          const P = bumps[j], dx = b.x - P.x, dy = b.y - P.y, rr = b.r + bb.r, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr || d2 === 0) return;
          const d = Math.sqrt(d2), nx = dx / d, ny = dy / d; b.x = P.x + nx * rr; b.y = P.y + ny * rr;
          const rvx = b.vx - P.vx, vn = rvx * nx + b.vy * ny;
          if (vn < 0) { const out = Math.max(-vn * 0.9, 620); b.vx = rvx - vn * nx + out * nx + P.vx; b.vy = b.vy - vn * ny + out * ny; b.bumps++; }
        });
        // spinners: rotating bars
        board.spinners.forEach((s, j) => {
          const a = spins[j], ux = Math.cos(a) * s.len / 2, uy = Math.sin(a) * s.len / 2, ax = s.x - ux, ay = s.y - uy, ex = ux * 2, ey = uy * 2, l2 = ex * ex + ey * ey;
          let u = ((b.x - ax) * ex + (b.y - ay) * ey) / l2; u = u < 0 ? 0 : u > 1 ? 1 : u;
          const qx = ax + ex * u, qy = ay + ey * u, dx = b.x - qx, dy = b.y - qy, rr = b.r + SPIN_R, d2 = dx * dx + dy * dy;
          if (d2 >= rr * rr) return;
          let d = Math.sqrt(d2), nx, ny; if (d < 1e-6) { nx = 0; ny = -1; } else { nx = dx / d; ny = dy / d; }
          b.x = qx + nx * rr; b.y = qy + ny * rr;
          const svx = -s.w * (qy - s.y), svy = s.w * (qx - s.x), rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny;
          if (vn < 0) { b.vx = rvx - 1.5 * vn * nx + svx; b.vy = rvy - 1.5 * vn * ny + svy; b.spins++; }
        });
      }
    }
    // balls knock each other around
    for (let i = 0; i < B.length; i++) {
      const a = B[i]; if (a.done || a.phaseAll) continue;
      for (let j = i + 1; j < B.length; j++) {
        const b = B[j]; if (b.done || b.phaseAll) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr) continue;
        let d = Math.sqrt(d2), nx, ny; if (d < 1e-6) { nx = (a.i < b.i ? 1 : -1); ny = 0; d = 0; } else { nx = dx / d; ny = dy / d; }
        const over = rr - d, ma = a.m, mb = b.m, tot = ma + mb;
        a.x -= nx * over * (mb / tot); a.y -= ny * over * (mb / tot); b.x += nx * over * (ma / tot); b.y += ny * over * (ma / tot);
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) { const jimp = (-(1 + 0.75) * vn) / (1 / ma + 1 / mb); a.vx -= (jimp / ma) * nx; a.vy -= (jimp / ma) * ny; b.vx += (jimp / mb) * nx; b.vy += (jimp / mb) * ny; }
      }
    }
    step++;
    for (const b of B) {
      if (b.done) continue;
      // stuck (resting on a flat line or wedged): first slip through lines, then through everything
      if (step % 180 === 0) {
        if (Math.hypot(b.x - b.chkX, b.y - b.chkY) < 6) { b.stuck++; if (b.stuck === 1) b.phase = 120; else { b.phaseAll = true; b.vx = 0; } }
        b.chkX = b.x; b.chkY = b.y;
      }
      if (b.y >= LAND_Y) { b.done = true; alive--; b.slot = slotAt(board, b.x); b.landF = Math.ceil(step / REC); rec(b); }
    }
    if (record && step % REC === 0) for (const b of B) if (!b.done) rec(b);
  }
  // anything still bouncing after the time limit drops straight into the slot below it
  for (const b of B) if (!b.done) { b.done = true; b.slot = slotAt(board, b.x); b.landF = Math.ceil(step / REC); if (record) { b.y = LAND_Y; rec(b); } }
  return {
    frames: Math.ceil(step / REC), stars,
    balls: B.map((b) => ({ owner: b.owner, k: b.k, big: b.big, sticky: b.sticky, r: b.r, path: b.path, slot: b.slot, landF: b.landF, x: Math.round(b.x),
      pegs: b.pegs, walls: b.walls, bumps: b.bumps, spins: b.spins, lineHits: b.lineHits, ghostHits: b.ghostHits, touched: [...b.touched].filter((o) => o != null), air: +(b.landF / FPS).toFixed(2) })),
  };
}

// How flashy a drop was (the crowd's "trick shot" award).
function style(b, slot) {
  let s = b.pegs + b.walls * 3 + b.bumps * 4 + b.spins * 5 + b.lineHits * 4 + b.ghostHits * 2 + (b.air > 6 ? 6 : 0);
  if (slot && slot.k === 'jack') s = Math.round(s * 1.5);
  return s;
}

module.exports = { W, H, DROP_Y, LINE_TOP, LINE_BOT, SLOT_TOP, BALL_R, BIG_R, FPS, MAX_STROKES, makeBoard, simulate, cleanStrokes, slotAt, polyLen, style, windAt, bumperAt };
