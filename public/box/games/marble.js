'use strict';
// JustMarble: TV and phone screens. Every phone is one piece of a wooden labyrinth; the phone
// holding the marble runs the physics: the player holds a finger on the board and drags the way
// the marble should roll (a virtual joystick; arrow keys on a laptop) and tells the server when the marble rolls over the edge to a neighbour,
// drops in a hole, grabs a gem or reaches the goal. The TV shows the phones as a map and only
// uncovers the maze where the marble has been, until the end of the round.
(function () {
  const { esc, timer } = BOX;
  const N = 1, E = 2, S = 4, W = 8;
  const R = 0.22, T = 0.07; // marble radius, wall half-thickness (cells)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------- wood ----------------
  function grain(w, h, seed, light) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    const g = c.getContext('2d'), base = g.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, light ? '#e9c48c' : '#5a3418'); base.addColorStop(0.5, light ? '#dcb176' : '#4a2a12'); base.addColorStop(1, light ? '#e4bd83' : '#3b2010');
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    let s = seed || 7; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    g.lineWidth = 1;
    for (let i = 0; i < h / 3; i++) {
      const y = rnd() * h, a = 0.05 + rnd() * 0.09, amp = 2 + rnd() * 6, f = 0.004 + rnd() * 0.01;
      g.strokeStyle = light ? `rgba(120,70,25,${a})` : `rgba(0,0,0,${a})`; g.beginPath();
      for (let x = 0; x <= w; x += 8) g.lineTo(x, y + Math.sin(x * f + i) * amp);
      g.stroke();
    }
    for (let i = 0; i < 3; i++) { // knots
      const x = rnd() * w, y = rnd() * h, r = 4 + rnd() * 9;
      g.strokeStyle = light ? 'rgba(110,60,20,0.18)' : 'rgba(0,0,0,0.25)';
      for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x, y, r + k * 3, (r + k * 3) * 0.45, 0, 0, Math.PI * 2); g.stroke(); }
    }
    return c;
  }
  // Draw one board (cells: mask per cell, -1 = none) at ox,oy with cell size cs.
  // opts: { fog: Set of covered cell indexes (local), edges: true to mark gaps to neighbours }
  function drawPiece(g, ox, oy, cs, cw, ch, cells, opts = {}) {
    const bw = cw * cs, bh = ch * cs;
    const key = `${Math.round(bw)}x${Math.round(bh)}:${opts.seed || 1}`;
    drawPiece.cache = drawPiece.cache || new Map();
    let wood = drawPiece.cache.get(key); if (!wood) { wood = grain(bw, bh, opts.seed || 1, true); drawPiece.cache.set(key, wood); if (drawPiece.cache.size > 40) drawPiece.cache.delete(drawPiece.cache.keys().next().value); }
    g.drawImage(wood, ox, oy, bw, bh);
    if (opts.fog) { g.fillStyle = 'rgba(38, 20, 8, 0.86)'; for (let i = 0; i < cells.length; i++) if (opts.fog.has(i)) g.fillRect(ox + (i % cw) * cs - 0.5, oy + Math.floor(i / cw) * cs - 0.5, cs + 1, cs + 1); }
    const th = Math.max(2, cs * T * 2);
    const seg = [];
    for (let i = 0; i < cells.length; i++) {
      const m = cells[i]; if (m < 0) continue; if (opts.fog && opts.fog.has(i)) continue;
      const x = i % cw, y = Math.floor(i / cw), X = ox + x * cs, Y = oy + y * cs;
      if (!(m & N)) seg.push([X, Y, X + cs, Y]);
      if (!(m & W)) seg.push([X, Y, X, Y + cs]);
      if (!(m & S)) seg.push([X, Y + cs, X + cs, Y + cs]);
      if (!(m & E)) seg.push([X + cs, Y, X + cs, Y + cs]);
    }
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(40, 18, 4, 0.45)'; g.lineWidth = th; // shadow
    g.beginPath(); for (const [a, b, c, d] of seg) { g.moveTo(a + th * 0.35, b + th * 0.5); g.lineTo(c + th * 0.35, d + th * 0.5); } g.stroke();
    g.strokeStyle = '#6b3a17'; g.lineWidth = th;
    g.beginPath(); for (const [a, b, c, d] of seg) { g.moveTo(a, b); g.lineTo(c, d); } g.stroke();
    g.strokeStyle = 'rgba(255, 210, 150, 0.35)'; g.lineWidth = Math.max(1, th * 0.3); // top light
    g.beginPath(); for (const [a, b, c, d] of seg) { g.moveTo(a - th * 0.15, b - th * 0.15); g.lineTo(c - th * 0.15, d - th * 0.15); } g.stroke();
  }
  function drawHole(g, x, y, cs) {
    const r = cs * 0.3, gr = g.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
    gr.addColorStop(0, '#000'); gr.addColorStop(0.75, '#1a0c04'); gr.addColorStop(1, '#5a3418');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,220,170,0.35)'; g.lineWidth = Math.max(1, cs * 0.03); g.stroke();
  }
  function drawGem(g, x, y, cs, t) {
    const r = cs * 0.2 * (1 + Math.sin(t * 4 + x) * 0.06);
    g.save(); g.translate(x, y);
    g.fillStyle = '#4ee6ff'; g.strokeStyle = '#e6fbff'; g.lineWidth = Math.max(1, cs * 0.025);
    g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.85, -r * 0.2); g.lineTo(0, r); g.lineTo(-r * 0.85, -r * 0.2); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(0, -r); g.lineTo(r * 0.3, -r * 0.2); g.lineTo(-r * 0.3, -r * 0.2); g.closePath(); g.fill();
    g.restore();
  }
  function drawGoal(g, x, y, cs, t) {
    const r = cs * 0.34;
    g.save(); g.translate(x, y);
    g.strokeStyle = '#ffd23f'; g.lineWidth = Math.max(2, cs * 0.06); g.setLineDash([cs * 0.08, cs * 0.06]); g.lineDashOffset = -t * 20;
    g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    const gr = g.createRadialGradient(0, 0, 1, 0, 0, r * 0.8); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#3b1d08');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r * 0.8, 0, Math.PI * 2); g.fill();
    g.font = `${Math.round(cs * 0.36)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🏁', 0, 0);
    g.restore();
  }
  function drawStart(g, x, y, cs) {
    g.save(); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = Math.max(1, cs * 0.04); g.setLineDash([cs * 0.05, cs * 0.05]);
    g.beginPath(); g.arc(x, y, cs * 0.3, 0, Math.PI * 2); g.stroke(); g.restore();
  }
  function drawMarble(g, x, y, cs, scale = 1, spin = 0) {
    const r = cs * R * scale; if (r <= 0.5) return;
    g.fillStyle = 'rgba(30, 12, 2, 0.35)'; g.beginPath(); g.ellipse(x + r * 0.25, y + r * 0.35, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, '#f4fbff'); gr.addColorStop(0.35, '#6fb7ff'); gr.addColorStop(0.8, '#3a3fd6'); gr.addColorStop(1, '#1d1773');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    g.save(); g.beginPath(); g.arc(x, y, r * 0.92, 0, Math.PI * 2); g.clip(); // the swirl inside the glass
    g.strokeStyle = 'rgba(255, 90, 160, 0.75)'; g.lineWidth = r * 0.28; g.beginPath();
    for (let a = 0; a < Math.PI * 1.6; a += 0.2) { const rr = r * (0.15 + a * 0.22); g.lineTo(x + Math.cos(a + spin) * rr, y + Math.sin(a + spin) * rr * 0.6); }
    g.stroke(); g.restore();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.42, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2); g.fill();
  }

  // ---------------- phone: drag to roll ----------------
  // Hold a finger on the board and drag: the marble rolls the way you drag, harder the further
  // you drag (a virtual joystick). (Phone tilt sensors were unreliable in browsers, so it's drag.)
  const TILT = { drag: null, keys: { x: 0, y: 0 } };
  function tiltVec() {
    if (TILT.drag) return { x: clamp(TILT.drag.dx, -1, 1), y: clamp(TILT.drag.dy, -1, 1) };
    if (TILT.keys.x || TILT.keys.y) return { x: TILT.keys.x * 0.6, y: TILT.keys.y * 0.6 };
    return { x: 0, y: 0 };
  }
  window.addEventListener('keydown', (e) => { const k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!k || !document.body.classList.contains('g-marble')) return; if (k[0]) TILT.keys.x = k[0]; if (k[1]) TILT.keys.y = k[1]; e.preventDefault(); });
  window.addEventListener('keyup', (e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') TILT.keys.x = 0; if (e.key === 'ArrowUp' || e.key === 'ArrowDown') TILT.keys.y = 0; });

  // ---------------- phone: the board and its physics ----------------
  const PH = { V: null, ctx: null, cv: null, seq: 0, x: 0, y: 0, vx: 0, vy: 0, active: false, gone: null, fall: 0, lastSend: 0, lastT: 0, spin: 0, took: new Set(), bumpAt: 0, segs: null, segKey: '', raf: 0, sentFinish: false };
  function segsFor(v) {
    const k = v.cells.join(',') + v.cw; if (PH.segKey === k) return PH.segs;
    const segs = [];
    for (let i = 0; i < v.cells.length; i++) {
      const m = v.cells[i]; if (m < 0) continue; const x = i % v.cw, y = Math.floor(i / v.cw);
      if (!(m & N)) segs.push([x, y, x + 1, y]); if (!(m & W)) segs.push([x, y, x, y + 1]);
      if (!(m & S)) segs.push([x, y + 1, x + 1, y + 1]); if (!(m & E)) segs.push([x + 1, y, x + 1, y + 1]);
    }
    PH.segs = segs; PH.segKey = k; return segs;
  }
  function collide(segs) {
    let hit = 0;
    for (const [ax, ay, bx, by] of segs) {
      if (Math.abs((ax + bx) / 2 - PH.x) > 1.2 || Math.abs((ay + by) / 2 - PH.y) > 1.2) continue;
      const dx = bx - ax, dy = by - ay, t = clamp(((PH.x - ax) * dx + (PH.y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      const cx = ax + dx * t, cy = ay + dy * t; let nx = PH.x - cx, ny = PH.y - cy; const d = Math.hypot(nx, ny), min = R + T;
      if (d >= min || d === 0) continue;
      nx /= d; ny /= d; PH.x = cx + nx * min; PH.y = cy + ny * min;
      const vn = PH.vx * nx + PH.vy * ny; if (vn < 0) { PH.vx -= 1.35 * vn * nx; PH.vy -= 1.35 * vn * ny; hit = Math.max(hit, -vn); }
    }
    return hit;
  }
  function physics(dt) {
    const v = PH.V; if (!v || !PH.active || PH.gone || PH.fall) return;
    const segs = segsFor(v); let t = tiltVec(); if (v.mirror) t = { x: -t.x, y: -t.y };
    const G = v.ice ? 16 : 20, fr = v.ice ? 0.25 : 1.5, vmax = 8;
    const sp = Math.hypot(PH.vx, PH.vy), steps = Math.max(1, Math.ceil((sp * dt) / 0.06));
    let hit = 0;
    for (let i = 0; i < steps; i++) {
      const h = dt / steps;
      PH.vx += t.x * G * h; PH.vy += t.y * G * h;
      const k = Math.max(0, 1 - fr * h); PH.vx *= k; PH.vy *= k;
      const s = Math.hypot(PH.vx, PH.vy); if (s > vmax) { PH.vx *= vmax / s; PH.vy *= vmax / s; }
      PH.x += PH.vx * h; PH.y += PH.vy * h;
      hit = Math.max(hit, collide(segs));
    }
    PH.spin += (PH.vx + PH.vy) * dt * 2;
    if (hit > 2.2 && performance.now() - PH.bumpAt > 140) { PH.bumpAt = performance.now(); PH.ctx.haptic(hit > 4.5 ? 'buzz' : 'tap'); }
    // Over the edge (only possible through a gap): to the neighbour's phone.
    const side = PH.x < 0 ? 'W' : PH.x > v.cw ? 'E' : PH.y < 0 ? 'N' : PH.y > v.ch ? 'S' : null;
    if (side) {
      PH.gone = { side, at: performance.now(), x: PH.x, y: PH.y };
      const seq = PH.seq;
      PH.ctx.act({ op: 'pass', seq, side, x: PH.x, y: PH.y, vx: PH.vx, vy: PH.vy }).then((r) => { if (r && !r.ok && PH.seq === seq) { PH.gone = null; PH.x = clamp(PH.x, R, v.cw - R); PH.y = clamp(PH.y, R, v.ch - R); PH.vx = -PH.vx * 0.3; PH.vy = -PH.vy * 0.3; } });
      PH.ctx.haptic('select'); PH.ctx.sfx('pop'); return;
    }
    for (const h of v.holes) if (Math.hypot(h.x - PH.x, h.y - PH.y) < 0.2) {
      PH.fall = performance.now(); PH.fallAt = { x: h.x, y: h.y }; PH.ctx.haptic('error');
      const seq = PH.seq;
      setTimeout(() => { if (PH.fall && PH.seq === seq) PH.ctx.act({ op: 'hole', seq, id: h.id, x: h.x, y: h.y }).then((r) => { if (r && !r.ok && PH.seq === seq) PH.fall = 0; }); }, 550); return;
    }
    for (const gm of v.gems) if (!PH.took.has(gm.id) && Math.hypot(gm.x - PH.x, gm.y - PH.y) < 0.38) {
      PH.took.add(gm.id); PH.ctx.act({ op: 'gem', seq: PH.seq, id: gm.id, x: PH.x, y: PH.y }); PH.ctx.haptic('success'); PH.ctx.sfx('chime');
    }
    if (v.finish && !PH.sentFinish && Math.hypot(v.finish.x - PH.x, v.finish.y - PH.y) < 0.3) {
      PH.sentFinish = true; PH.ctx.act({ op: 'finish', seq: PH.seq, x: v.finish.x, y: v.finish.y }); PH.ctx.haptic('win');
    }
    const now = performance.now();
    if (now - PH.lastSend > 110) { PH.lastSend = now; PH.ctx.act({ op: 'mv', seq: PH.seq, x: +PH.x.toFixed(3), y: +PH.y.toFixed(3), vx: +PH.vx.toFixed(2), vy: +PH.vy.toFixed(2) }); }
  }
  function fit(v, W, H) { const cs = Math.min(W / (v.cw + 0.3), H / (v.ch + 0.3)); return { cs, ox: (W - v.cw * cs) / 2, oy: (H - v.ch * cs) / 2 }; }
  function drawPhone(tm) {
    const v = PH.V, cv = PH.cv; if (!v || !cv || !cv.isConnected || !v.cells) return;
    const box = cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    const Wd = Math.max(50, box.width), Hd = Math.max(50, box.height);
    if (cv.width !== Math.round(Wd * dpr) || cv.height !== Math.round(Hd * dpr)) { cv.width = Math.round(Wd * dpr); cv.height = Math.round(Hd * dpr); cv.style.width = Wd + 'px'; cv.style.height = Hd + 'px'; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, Wd, Hd);
    const { cs, ox, oy } = fit(v, Wd, Hd), t = tm / 1000;
    // frame
    g.fillStyle = '#3b2010'; const fr = cs * 0.14; g.beginPath(); g.roundRect(ox - fr, oy - fr, v.cw * cs + fr * 2, v.ch * cs + fr * 2, fr * 1.5); g.fill();
    drawPiece(g, ox, oy, cs, v.cw, v.ch, v.cells, { seed: (v.tile + 1) * 17 + v.round });
    // gaps to the neighbours: a little arrow and their name
    g.font = `600 ${Math.round(cs * 0.2)}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let i = 0; i < v.cells.length; i++) {
      const m = v.cells[i], x = i % v.cw, y = Math.floor(i / v.cw);
      const marks = [];
      if (x === v.cw - 1 && m & E) marks.push(['E', ox + v.cw * cs, oy + (y + 0.5) * cs, '▶']);
      if (x === 0 && m & W) marks.push(['W', ox, oy + (y + 0.5) * cs, '◀']);
      if (y === 0 && m & N) marks.push(['N', ox + (x + 0.5) * cs, oy, '▲']);
      if (y === v.ch - 1 && m & S) marks.push(['S', ox + (x + 0.5) * cs, oy + v.ch * cs, '▼']);
      for (const [, mx, my, ch] of marks) { g.fillStyle = 'rgba(255, 210, 63, 0.9)'; g.fillText(ch, mx, my); }
    }
    if (v.start && v.round) drawStart(g, ox + v.start.x * cs, oy + v.start.y * cs, cs);
    for (const h of v.holes) drawHole(g, ox + h.x * cs, oy + h.y * cs, cs);
    for (const gm of v.gems) if (!PH.took.has(gm.id)) drawGem(g, ox + gm.x * cs, oy + gm.y * cs, cs, t);
    if (v.finish) drawGoal(g, ox + v.finish.x * cs, oy + v.finish.y * cs, cs, t);
    if (PH.active) {
      let sc = 1, x = PH.x, y = PH.y;
      if (PH.fall) { const k = clamp((performance.now() - PH.fall) / 500, 0, 1); sc = 1 - k * 0.85; x = PH.x + (PH.fallAt.x - PH.x) * k; y = PH.y + (PH.fallAt.y - PH.y) * k; }
      if (PH.gone) { const k = clamp((performance.now() - PH.gone.at) / 300, 0, 1); sc = 1 - k; }
      drawMarble(g, ox + x * cs, oy + y * cs, cs, sc, PH.spin);
    }
    if (TILT.drag && PH.active && !PH.gone) { // the joystick under the finger
      const jx = TILT.drag.ox, jy = TILT.drag.oy, rad = Math.max(40, Wd / 7), kx = clamp(TILT.drag.dx, -1, 1), ky = clamp(TILT.drag.dy, -1, 1);
      g.fillStyle = 'rgba(43, 23, 10, 0.25)'; g.strokeStyle = 'rgba(255, 210, 63, 0.8)'; g.lineWidth = 3; g.beginPath(); g.arc(jx, jy, rad, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255, 210, 63, 0.9)'; g.beginPath(); g.moveTo(jx, jy); g.lineTo(jx + kx * rad, jy + ky * rad); g.stroke();
      g.fillStyle = 'rgba(255, 210, 63, 0.95)'; g.beginPath(); g.arc(jx + kx * rad, jy + ky * rad, rad * 0.32, 0, Math.PI * 2); g.fill();
    }
  }
  function phoneLoop(tm) {
    PH.raf = requestAnimationFrame(phoneLoop);
    if (!PH.cv || !PH.cv.isConnected) return;
    const dt = Math.min(0.05, Math.max(0, (tm - (PH.lastT || tm)) / 1000)); PH.lastT = tm;
    physics(dt); drawPhone(tm);
  }
  function mountPad(el) {
    const pad = el.querySelector('#mb-pad'); if (!pad) return;
    if (!pad.querySelector('canvas')) {
      pad.innerHTML = '<canvas></canvas>'; PH.cv = pad.querySelector('canvas');
      // Hold and drag anywhere on the board: a joystick appears where the finger went down.
      pad.addEventListener('pointerdown', (e) => { pad.setPointerCapture(e.pointerId); const r = pad.getBoundingClientRect(); TILT.drag = { sx: e.clientX, sy: e.clientY, ox: e.clientX - r.left, oy: e.clientY - r.top, dx: 0, dy: 0 }; if (PH.active && !PH.gone) PH.ctx.haptic('tap'); e.preventDefault(); });
      pad.addEventListener('pointermove', (e) => { if (!TILT.drag) return; const k = Math.max(40, pad.clientWidth / 7); TILT.drag.dx = (e.clientX - TILT.drag.sx) / k; TILT.drag.dy = (e.clientY - TILT.drag.sy) / k; });
      const up = () => { TILT.drag = null; }; pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
    } else PH.cv = pad.querySelector('canvas');
    if (!PH.raf) PH.raf = requestAnimationFrame(phoneLoop);
  }
  // Where the marble is, as an arrow from my board.
  function arrowTo(v) {
    if (v.holderTile < 0 || v.holderTile === v.tile) return '';
    const hx = v.holderTile % v.cols, hy = Math.floor(v.holderTile / v.cols), dx = hx - v.slot.x, dy = hy - v.slot.y;
    return ({ '-1,-1': '↖', '0,-1': '⬆', '1,-1': '↗', '-1,0': '⬅', '1,0': '➡', '-1,1': '↙', '0,1': '⬇', '1,1': '↘' })[`${Math.sign(dx)},${Math.sign(dy)}`] || '';
  }
  function miniMap(rows, cols, owners, me, hold) {
    return `<div class="mb-mini" style="grid-template-columns:repeat(${cols},1fr)">${Array.from({ length: rows * cols }, (_, i) => owners[i] != null
      ? `<div class="mb-mphone ${i === me ? 'me' : ''} ${i === hold ? 'hold' : ''}"><b>${i === me ? 'YOU' : esc(owners[i])}</b>${i === hold ? '<i>🔮</i>' : ''}</div>` : '<div class="mb-mphone none"></div>').join('')}</div>`;
  }

  function phone(el, v, ctx) {
    if (!v) return;
    PH.V = v; PH.ctx = ctx;
    const prev = PH.lastPhase; PH.lastPhase = v.phase + v.round;
    if (prev !== PH.lastPhase) {
      if (v.phase === 'lineup') ctx.haptic('turn');
      if (v.phase === 'result') ctx.haptic(v.last && v.last.won ? 'win' : 'warn');
      if (v.phase === 'over') ctx.haptic(v.rank === 1 ? 'win' : 'success');
      if (v.phase === 'lineup') { PH.took = new Set(); PH.active = false; }
    }
    // The marble: a new seq means it just arrived here (or came back out of a hole).
    if (v.marble && v.marble.seq !== PH.seq) {
      const fresh = !PH.active || PH.gone;
      Object.assign(PH, { seq: v.marble.seq, x: v.marble.x, y: v.marble.y, vx: v.marble.vx || 0, vy: v.marble.vy || 0, active: true, gone: null, fall: 0, sentFinish: false });
      if (fresh) { ctx.haptic('turn'); ctx.sfx('pop'); if (v.mirror) ctx.toast('🪞 Your board rolls backwards!'); }
    }
    if (!v.marble && v.phase === 'roll' && PH.active && !PH.gone && !PH.fall) PH.active = false;
    if (v.phase !== 'roll') { PH.active = false; PH.gone = null; PH.fall = 0; }

    const head = `<div class="mb-bar"><span>🪵 ${v.round}/${v.of}${v.mod ? ` · ${esc(v.mod.icon)} ${esc(v.mod.name)}` : ''}</span><span>${timer(v.endsIn)}</span><b>${v.points} pts</b></div>`;
    if (v.phase === 'over') {
      return BOX.morph(el, `<div class="mb-ph mb-end"><div class="mb-big">${v.rank === 1 ? '🏆' : '🔮'}</div><h2>${v.rank === 1 ? 'You win!' : `#${v.rank} of ${v.of}`}</h2>
        <p>${v.points} points · the team cleared ${v.cleared} of ${v.rounds} mazes</p>
        <div class="mb-stats"><span>➡️ ${v.stats.passes} good passes</span><span>💎 ${v.stats.gems} gems</span><span>🕳️ ${v.stats.drops} holes</span><span>🏁 ${v.stats.sinks} sunk</span></div></div>`);
    }
    if (v.spotter) {
      const b = v.board;
      return BOX.morph(el, `<div class="mb-ph">${head}<div class="card-box mb-spot"><h3>📣 You're the spotter</h3><p>Not enough room on the table this round! Watch the TV and shout directions.</p>
        ${b ? miniMap(b.rows, b.cols, b.owners, -1, v.holderTile) : ''}${v.holder ? `<p class="muted">🔮 The marble is on <b>${esc(v.holder)}</b>'s board.</p>` : ''}</div></div>`);
    }
    if (v.phase === 'lineup') {
      const nb = v.nb;
      BOX.morph(el, `<div class="mb-ph">${head}<div class="card-box mb-line">
        <h3>You're board ${v.tile + 1}</h3>
        ${miniMap(v.rows, v.cols, v.owners, v.tile, -1)}
        <p class="mb-nb">${nb.W ? `⬅ <b>${esc(nb.W)}</b>` : ''} ${nb.E ? `<b>${esc(nb.E)}</b> ➡` : ''}${nb.N ? `<br>⬆ above you: <b>${esc(nb.N)}</b>` : ''}${nb.S ? `<br>⬇ below you: <b>${esc(nb.S)}</b>` : ''}</p>
        <p class="muted">Put your phones together like the map on the TV, screens up.</p>
        <button class="btn big ${v.ready ? 'green' : ''}" id="mb-ready">${v.ready ? '✅ Ready!' : '✋ I’m ready'}</button></div>
        <div class="mb-pad mb-preview" id="mb-pad" data-keep></div></div>`);
      const rb = el.querySelector('#mb-ready');
      if (rb) rb.onclick = async () => { const r = await ctx.act({ op: 'ready' }); if (r.ok) ctx.haptic('success'); };
      mountPad(el); return;
    }
    if (v.phase === 'result') {
      const L = v.last || {};
      return BOX.morph(el, `<div class="mb-ph">${head}<div class="card-box mb-res"><div class="mb-big">${L.won ? '🏁' : '⏱️'}</div>
        <h2>${L.won ? 'Maze cleared!' : 'Out of time!'}</h2><p class="mb-gain">${v.gain >= 0 ? '+' : ''}${v.gain} for you this maze</p><p class="muted">Look at the TV: the whole maze is uncovered.</p></div></div>`);
    }
    // roll
    const mine = v.holderIsMe;
    const status = mine ? `<div class="mb-you">🔮 <b>Your marble!</b> Hold &amp; drag to roll it${v.mirror ? ' · 🪞 backwards!' : ''}</div>`
      : `<div class="mb-wait">${arrowTo(v)} The marble is on <b>${esc(v.holder || '…')}</b>'s board</div>`;
    BOX.morph(el, `<div class="mb-ph mb-rolling ${mine ? 'hold' : ''}">${head}${status}<div class="mb-pad" id="mb-pad" data-keep></div>
      <div class="mb-tools">${mine ? '<span class="muted small">👆 Hold a finger on the board and drag the way it should roll. Further = faster.</span>' : '<span class="muted small">Get ready: when it lands on your board, hold and drag.</span>'}</div></div>`);
    mountPad(el);
  }

  // ---------------- TV ----------------
  const TV = { S: null, cv: null, raf: 0, mx: null, my: null, trail: [], seq: 0 };
  function mapGeom(b, W, H) {
    const gapC = 0.8, bez = 0.35; // gap between phones and phone bezel (in cells)
    const pw = b.cw + bez * 2, ph = b.ch + bez * 2 + 0.6; // +0.6 for the name label
    const totW = b.cols * pw + (b.cols - 1) * gapC, totH = b.rows * ph + (b.rows - 1) * gapC;
    const cs = Math.min(W / (totW + 0.4), H / (totH + 0.4));
    const ox = (W - totW * cs) / 2, oy = (H - totH * cs) / 2;
    const tile = (t) => { const c = t % b.cols, r = Math.floor(t / b.cols); return { x: ox + (c * (pw + gapC) + bez) * cs, y: oy + (r * (ph + gapC) + bez + 0.6) * cs, px: ox + c * (pw + gapC) * cs, py: oy + (r * (ph + gapC) + 0.6) * cs, pw: pw * cs, ph: (ph - 0.6) * cs }; };
    // Global cell position → screen (t: which board, if known).
    const toScreen = (gx, gy, t) => { if (t == null) t = Math.floor(clamp(gy, 0, b.gh - 0.001) / b.ch) * b.cols + Math.floor(clamp(gx, 0, b.gw - 0.001) / b.cw); const o = tile(t), c = t % b.cols, r = Math.floor(t / b.cols); return [o.x + (gx - c * b.cw) * cs, o.y + (gy - r * b.ch) * cs]; };
    return { cs, tile, toScreen };
  }
  function drawTv(tm) {
    TV.raf = requestAnimationFrame(drawTv);
    const s = TV.S, cv = TV.cv; if (!s || !cv || !cv.isConnected || !s.board) return;
    const b = s.board, box = cv.parentElement.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(box.width * dpr) || cv.height !== Math.round(box.height * dpr)) { cv.width = Math.round(box.width * dpr); cv.height = Math.round(box.height * dpr); cv.style.width = box.width + 'px'; cv.style.height = box.height + 'px'; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, box.width, box.height);
    const { cs, tile, toScreen } = mapGeom(b, box.width, box.height), t = tm / 1000;
    const visited = new Set(b.visited), M = s.marble, lineup = s.phase === 'lineup';
    for (let i = 0; i < b.n; i++) {
      const o = tile(i), own = b.owners[i], hold = M && M.tile === i && s.phase === 'roll';
      // the phone
      g.save(); g.shadowColor = hold ? 'rgba(255, 210, 63, 0.9)' : 'rgba(0,0,0,0.5)'; g.shadowBlur = hold ? 30 + Math.sin(t * 5) * 8 : 18;
      g.fillStyle = '#16131c'; g.beginPath(); g.roundRect(o.px, o.py, o.pw, o.ph, cs * 0.45); g.fill(); g.restore();
      if (hold) { g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.roundRect(o.px, o.py, o.pw, o.ph, cs * 0.45); g.stroke(); }
      // its piece of the maze: covered until the marble has been there (all of it at the reveal)
      const c0 = (i % b.cols) * b.cw, r0 = Math.floor(i / b.cols) * b.ch, cells = [], fog = new Set();
      for (let y = 0; y < b.ch; y++) for (let x = 0; x < b.cw; x++) { const gi = (r0 + y) * b.gw + c0 + x; cells.push(b.cells[gi]); if (!b.reveal && !visited.has(gi)) fog.add(y * b.cw + x); }
      if (lineup) { g.fillStyle = '#4a2a12'; g.fillRect(o.x, o.y, b.cw * cs, b.ch * cs); }
      else drawPiece(g, o.x, o.y, cs, b.cw, b.ch, cells, { fog, seed: (i + 1) * 17 + s.round });
      if (b.mirror === i) { g.font = `${Math.round(cs * 0.8)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🪞', o.x + b.cw * cs / 2, o.y + b.ch * cs / 2); }
      // name
      g.font = `700 ${Math.round(clamp(cs * 0.42, 12, 30))}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom';
      const label = `${own.avatar} ${own.name}${lineup && (s.ready || []).includes(own.id) ? ' ✅' : ''}`;
      g.fillStyle = hold ? '#ffd23f' : own.online ? '#fff2dc' : 'rgba(255,242,220,0.45)'; g.fillText(label, o.px + o.pw / 2, o.py - cs * 0.12);
      if (lineup) { g.font = `800 ${Math.round(cs * 1.6)}px Lilita One, sans-serif`; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255, 210, 63, 0.85)'; g.fillText(String(i + 1), o.x + b.cw * cs / 2, o.y + b.ch * cs / 2); }
    }
    if (lineup) return;
    const sxy = toScreen((b.start % b.gw) + 0.5, Math.floor(b.start / b.gw) + 0.5), fxy = toScreen((b.finish % b.gw) + 0.5, Math.floor(b.finish / b.gw) + 0.5);
    drawStart(g, sxy[0], sxy[1], cs); drawGoal(g, fxy[0], fxy[1], cs, t);
    for (const gm of b.gems) if (!gm.by) { const [x, y] = toScreen(gm.x, gm.y); drawGem(g, x, y, cs, t); }
    if (b.reveal && b.holes) for (const [hx, hy] of b.holes) { const [x, y] = toScreen(hx, hy); drawHole(g, x, y, cs); }
    if (b.reveal && b.path) { // the right way, drawn at the end
      g.strokeStyle = 'rgba(255, 210, 63, 0.75)'; g.lineWidth = Math.max(3, cs * 0.12); g.lineJoin = 'round'; g.setLineDash([cs * 0.25, cs * 0.18]); g.lineDashOffset = -t * 30;
      g.beginPath(); for (const c of b.path) { const [x, y] = toScreen((c % b.gw) + 0.5, Math.floor(c / b.gw) + 0.5); g.lineTo(x, y); } g.stroke(); g.setLineDash([]);
    }
    if (M) {
      const [tx, ty] = toScreen(M.x, M.y, M.tile);
      if (TV.mx == null || M.seq !== TV.seq) { TV.mx = tx; TV.my = ty; TV.seq = M.seq; }
      TV.mx += (tx - TV.mx) * 0.25; TV.my += (ty - TV.my) * 0.25;
      drawMarble(g, TV.mx, TV.my, cs, 1.15, t * 2);
    }
  }
  function tvGame(el, s) {
    TV.S = s;
    const L = s.last, mod = s.mod || {};
    const side = `<aside class="mb-side">
      <div class="mb-mod"><span class="mb-mod-ic">${esc(mod.icon || '🪵')}</span><div><b>Maze ${s.round} of ${s.of}: ${esc(mod.name || '')}</b><small>${esc(mod.about || '')}</small></div></div>
      ${s.phase === 'roll' ? `<div class="mb-timer">${timer(s.endsIn)}</div>` : ''}
      ${s.phase === 'roll' && s.marble ? `<div class="mb-holder">🔮 <b>${esc(s.marble.name)}</b> has the marble</div>` : ''}
      ${s.gemsLeft ? `<div class="mb-gems">💎 ${s.gemsLeft} gem${s.gemsLeft === 1 ? '' : 's'} on the boards</div>` : ''}
      <ul class="mb-events">${(s.events || []).slice().reverse().map((e) => `<li>${esc(e.icon)} ${esc(e.t)}</li>`).join('')}</ul>
      <div class="mb-board">${(s.standings || []).slice(0, 8).map((r, i) => `<div class="mb-row"><span>${i + 1}</span><span>${esc(r.avatar || '')} ${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div>
      ${s.spotters && s.spotters.length ? `<p class="mb-spotters">📣 Spotting: ${s.spotters.map(esc).join(', ')}</p>` : ''}
    </aside>`;
    const top = s.phase === 'lineup'
      ? `<div class="mb-banner">📱 Put your phones together like this, screens up! <span>${timer(s.endsIn)}</span></div>`
      : s.phase === 'result' && L ? `<div class="mb-banner ${L.won ? 'won' : 'lost'}">${L.won ? `🏁 Cleared with ${L.left}s to spare!` : `⏱️ Out of time: ${Math.round((L.progress || 0) * 100)}% of the way`}</div>` : '';
    const res = s.phase === 'result' && L ? `<div class="mb-gains">${L.gains.slice(0, 8).map((x) => `<span>${esc(x.avatar || '')} ${esc(x.name)} <b>${x.n >= 0 ? '+' : ''}${x.n}</b></span>`).join('')}</div>` : '';
    BOX.morph(el, `<div class="mb-tv">${top}<div class="mb-main"><div class="mb-map" id="mb-map" data-keep></div>${side}</div>${res}</div>`);
    const map = el.querySelector('#mb-map'); if (!map.querySelector('canvas')) map.innerHTML = '<canvas></canvas>';
    TV.cv = map.querySelector('canvas'); if (!TV.raf) TV.raf = requestAnimationFrame(drawTv);
  }
  function tvOver(el, s) {
    const st = s.standings || [], w = st[0] || {};
    const award = (k, label, icon, low) => { const r = [...st].sort((a, b) => (low ? a[k] - b[k] : b[k] - a[k]))[0]; return r && (low || r[k] > 0) ? `<div class="mb-award"><i>${icon}</i><b>${esc(label)}</b><span>${esc(r.avatar || '')} ${esc(r.name)}</span></div>` : ''; };
    BOX.morph(el, `<div class="mb-tv mb-over"><h1>🏆 ${esc(w.avatar || '')} ${esc(w.name || '')} wins!</h1>
      <p class="mb-team">The team cleared <b>${s.cleared} of ${s.of}</b> mazes</p>
      <div class="mb-awards">${award('gems', 'Gem hunter', '💎')}${award('passes', 'Smooth hands', '➡️')}${award('sinks', 'The closer', '🏁')}${award('drops', 'Steadiest', '🧘', true)}</div>
      <div class="mb-board big">${st.map((r, i) => `<div class="mb-row"><span>${i + 1}</span><span>${esc(r.avatar || '')} ${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div></div>`);
  }

  function lobbyTv(el, L) {
    if (!el.querySelector('.mb-lobby')) {
      el.innerHTML = `<div class="mb-lobby"><div class="mb-l-board">
          <h1 class="mb-logo"><span>Just</span>Marble</h1>
          <p class="mb-l-tag">Every phone is one piece of the maze. Put them together and roll the marble home.</p>
          <div class="mb-l-cols">
            <div class="mb-l-join"><img id="qr" alt="QR code to join"><div class="mb-l-code-l">Room code</div><div class="mb-l-code" id="code"></div></div>
            <div class="mb-l-right"><div class="mb-l-set" id="settings"></div><div class="mb-l-roster" id="roster"></div>
              <div class="mb-l-err" id="lobby-err"></div><button class="mb-l-start" id="start">Roll ▶</button>
              <div class="mb-l-links"><button class="link" id="add-bots">+ 5 test bots</button> <button class="link" id="pick">🎮 Another game</button></div></div>
          </div></div></div>`;
      el.querySelector('#start').onclick = async () => { const r = await L.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      el.querySelector('#add-bots').onclick = () => L.bots(5);
      el.querySelector('#pick').onclick = () => L.pick();
    }
    el.querySelector('#code').textContent = L.code;
    const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
    const set = el.querySelector('#settings'), sig = JSON.stringify(L.settings);
    if (set.dataset.sig !== sig && !set.contains(document.activeElement)) {
      set.dataset.sig = sig;
      set.innerHTML = L.fields.map((f) => `<label class="mb-plate"><span>${esc(f.label)}</span><select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
      for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => L.set(s.dataset.set, s.value);
    }
    BOX.morph(el.querySelector('#roster'), L.players.map((p) => `<span class="chip mb-chip">${esc(p.avatar || '🙂')} ${esc(p.name)}</span>`).join('') || '<span class="muted">Scan the code to join! 2–6 players is perfect.</span>');
  }

  BOX.games.marble = {
    name: 'JustMarble', icon: '🔮',
    about: 'Every phone is a piece of a wooden maze. Put them together and roll the marble home.',
    how: [
      'Every phone shows one piece of a wooden maze. Put your phones together, screens up, like the map on the TV.',
      'The marble starts on one phone. Whoever has it holds a finger on their board and drags the way it should roll.',
      'Roll it through a gap at the edge and it lands on your neighbour’s phone. Talk! Only together can you see the whole maze.',
      'Get it into the 🏁 before time runs out. Holes send it back to where it came onto your board.',
      'Points: the whole team scores for clearing a maze (more with time left), +30 for a pass that gets closer to the goal, +25 per 💎, +50 for sinking it, −15 per hole.',
    ],
    fx: { start: 'start', lineup: 'pop', go: 'start', pass: 'pop', gem: 'chime', hole: 'buzz', win: 'win', timeup: 'buzz', over: 'win' },
    // Music: calm while lining up, the rolling groove (tense in the last 10 s), the reveal.
    music: (s) => (s.phase === 'lineup' ? 'think' : s.phase === 'roll' ? 'play' : s.phase === 'result' ? 'reveal' : s.phase === 'over' ? 'finale' : undefined),
    lobbyTv,
    tv(el, s) { if (!s) return; if (s.phase === 'over') return tvOver(el, s); tvGame(el, s); },
    phone,
    _test: { PH, TILT }, // for tools/e2e checks (steer the marble from a script)
  };
})();
