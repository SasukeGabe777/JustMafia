'use strict';
// JustDrop: a casino peg drop. The TV is the board (one per table in big rooms): velvet and
// gold (classic), black-light neon, or hazard-striped chaos. Balls are played back from the
// server's recorded physics paths, so every bounce on screen is the one that scored.
// The lobby is an arcade cabinet (settings are chip buttons on its control panel). Phones get
// the board to pick a drop spot, then a drawing pad with an ink meter for the one line.
(function () {
  const { esc } = BOX;
  const TAU = Math.PI * 2;
  const W = 1000, H = 1300, SLOT_TOP = 1150, LINE_TOP = 150, LINE_BOT = 1080;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const AU = () => BOX.audio;
  const sting = (name) => { try { const a = AU(); if (a && a.stinger) return a.stinger(name, 'plinko'); } catch { /* no audio */ } return false; };
  const PAL = {
    classic: { bg1: '#4a0b1f', bg2: '#16030b', frame: '#d4a73c', frame2: '#7a5312', peg: '#fff1c2', pegGlow: '#ffd166', zone: 'rgba(0,0,0,0.28)', grid: 'rgba(255,215,140,0.06)', ink: '#fff4d6',
      slot: { pts: ['#7a1630', '#5e0f24'], jack: ['#ffd23f', '#d99a00'], bust: ['#16121a', '#000'], x2: ['#1f9e5c', '#116a3c'], steal: ['#7b3fd9', '#4a1f8f'], gift: ['#2f8bff', '#1a55b3'] }, bump: '#ff3b5c', spin: '#ffd166', ghost: 0.32 },
    neon: { bg1: '#0c0630', bg2: '#020109', frame: '#ff2fd0', frame2: '#3ee6ff', peg: '#c9fbff', pegGlow: '#3ee6ff', zone: 'rgba(62,230,255,0.07)', grid: 'rgba(62,230,255,0.08)', ink: '#e8fdff',
      slot: { pts: ['#1c1150', '#140a3a'], jack: ['#ffe14d', '#ff9d00'], bust: ['#ff2f4f', '#7a0018'], x2: ['#2bff9a', '#00995a'], steal: ['#b04dff', '#5a0fa8'], gift: ['#3ea0ff', '#1650b0'] }, bump: '#ff2fd0', spin: '#3ee6ff', ghost: 0.38 },
    chaos: { bg1: '#2b0c3d', bg2: '#0e0412', frame: '#ff6a00', frame2: '#ffd23f', peg: '#ffd9a8', pegGlow: '#ff8a1f', zone: 'rgba(255,106,0,0.10)', grid: 'rgba(255,160,60,0.07)', ink: '#fff0de',
      slot: { pts: ['#4d1a5e', '#36104a'], jack: ['#ffe14d', '#ff9d00'], bust: ['#e01e37', '#6d0010'], x2: ['#2fbf71', '#16703f'], steal: ['#3a3aff', '#1a1a8f'], gift: ['#00b3c4', '#006b78'] }, bump: '#ff2f4f', spin: '#ffd23f', ghost: 0.34 },
  };
  const pal = (st) => PAL[st] || PAL.classic;
  const slotInk = (k) => (k === 'jack' ? '#3a2300' : '#fff');

  // ---------------- board drawing (shared by the TV, the phones and the lobby) ----------------
  const layers = new Map();
  // repaint the cached boards once the slot font has loaded
  try { if (document.fonts) { document.fonts.load('40px "Bungee"').then(() => layers.clear()).catch(() => {}); document.fonts.ready.then(() => layers.clear()).catch(() => {}); } } catch { /* fine */ }
  const sigOf = (b) => b._sig || (b._sig = `${b.level}|${b.sudden ? 1 : 0}|${b.pegs.length}|${b.pegs.slice(0, 6).join()}|${b.slots.map((s) => s.x0 + s.k + s.v).join('.')}`);
  function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  // The board's still parts, painted once per size into an offscreen canvas.
  function staticLayer(board, style, px) { // px: device pixels per world unit
    const key = sigOf(board) + '|' + style + '|' + px.toFixed(4);
    let c = layers.get(key); if (c) return c;
    if (layers.size > 24) layers.clear();
    c = document.createElement('canvas'); c.width = Math.ceil(W * px); c.height = Math.ceil(H * px);
    const g = c.getContext('2d'); g.scale(px, px); const P = pal(style);
    rr(g, 0, 0, W, H, 34); g.save(); g.clip();
    let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, P.bg1); gr.addColorStop(1, P.bg2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    if (style === 'classic') { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 3; for (let x = 20; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } }
    if (style === 'neon') { g.strokeStyle = P.grid; g.lineWidth = 2; for (let x = 0; x <= W; x += 50) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y <= H; y += 50) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
    if (style === 'chaos') { g.save(); g.globalAlpha = 0.09; g.fillStyle = '#ffd23f'; for (let i = -H; i < W; i += 90) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 45, 0); g.lineTo(i + 45 + H, H); g.lineTo(i + H, H); g.fill(); } g.restore(); }
    // drop zone
    g.fillStyle = P.zone; g.fillRect(0, 0, W, 140);
    g.fillStyle = 'rgba(255,255,255,0.10)'; for (let x = 50; x < W; x += 100) { g.beginPath(); g.moveTo(x - 14, 116); g.lineTo(x + 14, 116); g.lineTo(x, 132); g.fill(); }
    g.setLineDash([10, 12]); g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, LINE_TOP); g.lineTo(W, LINE_TOP); g.stroke(); g.setLineDash([]);
    // slots
    for (const s of board.slots) {
      const cols = P.slot[s.k] || P.slot.pts, w = s.x1 - s.x0;
      gr = g.createLinearGradient(0, SLOT_TOP, 0, H); gr.addColorStop(0, cols[0]); gr.addColorStop(1, cols[1]); g.fillStyle = gr; g.fillRect(s.x0, SLOT_TOP, w, H - SLOT_TOP);
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(s.x0, SLOT_TOP, w, 6);
      if (s.k === 'bust') { g.save(); g.beginPath(); g.rect(s.x0, SLOT_TOP, w, H - SLOT_TOP); g.clip(); g.globalAlpha = 0.25; g.fillStyle = '#ffd23f'; for (let i = -200; i < w + 200; i += 34) { g.beginPath(); g.moveTo(s.x0 + i, H); g.lineTo(s.x0 + i + 16, H); g.lineTo(s.x0 + i + 16 + 150, SLOT_TOP); g.lineTo(s.x0 + i + 150, SLOT_TOP); g.fill(); } g.restore(); }
      const edge = s.x0 <= 0 || s.x1 >= W, lab = s.label, rot = w < 70 && lab.length > 2, room = rot ? H - SLOT_TOP - 40 : w - (edge ? 44 : 14);
      g.save(); g.translate((s.x0 + s.x1) / 2 + (s.x0 <= 0 ? 10 : s.x1 >= W ? -10 : 0), SLOT_TOP + 70);
      if (rot) g.rotate(-Math.PI / 2);
      let f2 = rot ? Math.min(54, w * 0.7) : 56;
      g.font = `${Math.round(f2)}px "Bungee", "Lilita One", sans-serif`;
      const tw = g.measureText(lab).width; if (tw > room) { f2 = (f2 * room) / tw; g.font = `${Math.round(f2)}px "Bungee", "Lilita One", sans-serif`; }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = f2 * 0.16; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(lab, 0, 0); g.fillStyle = slotInk(s.k); g.fillText(lab, 0, 0);
      g.restore();
    }
    for (let i = 1; i < board.slots.length; i++) { const x = board.slots[i].x0; gr = g.createLinearGradient(x - 5, 0, x + 5, 0); gr.addColorStop(0, '#777'); gr.addColorStop(0.5, '#fff'); gr.addColorStop(1, '#666'); g.fillStyle = gr; g.fillRect(x - 4, SLOT_TOP, 8, H - SLOT_TOP); g.beginPath(); g.arc(x, SLOT_TOP, 6, 0, TAU); g.fillStyle = '#eee'; g.fill(); }
    // pegs
    for (const p of board.pegs) {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(p[0] + 3, p[1] + 4, 9, 0, TAU); g.fill();
      gr = g.createRadialGradient(p[0] - 3, p[1] - 3, 1, p[0], p[1], 10); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, P.peg); gr.addColorStop(1, P.pegGlow);
      g.fillStyle = gr; g.beginPath(); g.arc(p[0], p[1], 8, 0, TAU); g.fill();
    }
    g.restore();
    // frame
    g.lineWidth = 14; g.strokeStyle = P.frame; rr(g, 7, 7, W - 14, H - 14, 30); g.stroke();
    g.lineWidth = 4; g.strokeStyle = P.frame2; rr(g, 17, 17, W - 34, H - 34, 24); g.stroke();
    layers.set(key, c); return c;
  }
  const windAt = (wd, t) => (wd && wd.amp ? wd.amp * Math.sin(t * wd.w + wd.ph) : 0);
  // Moving parts, bulbs, stars, wind: drawn every frame in world units.
  function drawLive(g, board, style, t, now, o = {}) {
    const P = pal(style);
    // chasing bulbs on the frame
    const n = 40;
    for (let i = 0; i < n; i++) {
      const u = i / n, per = 2 * (W + H), d = u * per; let x, y;
      if (d < W) { x = d; y = 7; } else if (d < W + H) { x = W - 7; y = d - W; } else if (d < 2 * W + H) { x = W - (d - W - H); y = H - 7; } else { x = 7; y = H - (d - 2 * W - H); }
      const on = (i + Math.floor(now / 140)) % 4 === 0;
      g.fillStyle = on ? '#fffbe0' : 'rgba(255,240,200,0.35)'; g.beginPath(); g.arc(x, y, on ? 7 : 5, 0, TAU); g.fill();
    }
    // star pegs
    for (let i = 0; i < board.pegs.length; i++) {
      const p = board.pegs[i]; if (!p[2] || (o.taken && o.taken.has(i))) continue;
      const k = 0.5 + 0.5 * Math.sin(now / 220 + i);
      g.save(); g.shadowColor = '#ffe14d'; g.shadowBlur = 20 * k; g.fillStyle = '#ffe14d'; star(g, p[0], p[1], 15 + 3 * k, 7); g.fill(); g.restore();
    }
    // bumpers
    for (const b of board.bumpers) {
      const x = b.x + (b.ax ? b.ax * Math.sin(b.w * t + b.ph) : 0);
      if (b.ax) { g.setLineDash([6, 10]); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.beginPath(); g.moveTo(b.x - b.ax, b.y); g.lineTo(b.x + b.ax, b.y); g.stroke(); g.setLineDash([]); }
      // a ringed pop bumper with chasing bulbs (it never looks like a ball)
      const hit = o.bumpHit ? o.bumpHit(b) : 0, R = b.r * (1 + hit * 0.2);
      g.save(); g.shadowColor = P.bump; g.shadowBlur = 22 + hit * 40;
      g.fillStyle = '#1a0b2a'; g.beginPath(); g.arc(x, b.y, R + 8, 0, TAU); g.fill();
      g.lineWidth = 6; g.strokeStyle = P.bump; g.beginPath(); g.arc(x, b.y, R + 5, 0, TAU); g.stroke(); g.restore();
      const gr = g.createRadialGradient(x, b.y, 2, x, b.y, R); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#ffe0e8'); gr.addColorStop(1, P.bump);
      g.fillStyle = gr; g.beginPath(); g.arc(x, b.y, R - 2, 0, TAU); g.fill();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + now / 400; g.fillStyle = (i + Math.floor(now / 120)) % 2 ? '#fff6c8' : P.bump; g.beginPath(); g.arc(x + Math.cos(a) * (R + 5), b.y + Math.sin(a) * (R + 5), 3.5, 0, TAU); g.fill(); }
      g.fillStyle = '#1a0b2a'; star(g, x, b.y, R * 0.6, R * 0.26); g.fill();
    }
    // spinners
    for (const s of board.spinners) {
      const a = s.ph + s.w * t, ux = Math.cos(a) * s.len / 2, uy = Math.sin(a) * s.len / 2;
      g.save(); g.shadowColor = P.spin; g.shadowBlur = 12; g.lineCap = 'round'; g.strokeStyle = P.spin; g.lineWidth = 13; g.beginPath(); g.moveTo(s.x - ux, s.y - uy); g.lineTo(s.x + ux, s.y + uy); g.stroke(); g.restore();
      g.fillStyle = '#222'; g.beginPath(); g.arc(s.x, s.y, 9, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(s.x, s.y, 4, 0, TAU); g.fill();
    }
    // wind
    if (board.wind && board.wind.amp) {
      const wv = windAt(board.wind, t), k = wv / board.wind.amp;
      g.save(); g.globalAlpha = 0.25 + 0.5 * Math.abs(k); g.fillStyle = '#bff4ff'; g.font = '34px "Bungee", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const arrows = Math.max(1, Math.round(Math.abs(k) * 3)), str = (wv < 0 ? '◀' : '▶').repeat(arrows);
      g.fillText('WIND ' + str, W / 2, 40);
      g.restore();
    }
  }
  function star(g, x, y, R, r) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, q = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); }
  function drawStroke(g, pts, color, o = {}) {
    if (!pts || pts.length < 2) return;
    let n = pts.length, last = null;
    if (o.prog != null && o.prog < 1) { // draw-in animation: only part of the line so far
      let L = 0; for (let i = 1; i < n; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      let left = L * Math.max(0, o.prog); const out = [pts[0]];
      for (let i = 1; i < n && left > 0; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (d <= left) { out.push(pts[i]); left -= d; } else { const k = left / d; out.push([lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]); left = 0; } }
      pts = out; n = pts.length; last = pts[n - 1]; if (n < 2) return;
    }
    g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = o.alpha == null ? 1 : o.alpha;
    if (o.ghost) g.setLineDash([14, 12]);
    if (!o.ghost) { g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = (o.w || 11) + 6; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); g.shadowColor = color; g.shadowBlur = o.glow == null ? 16 : o.glow; }
    g.strokeStyle = color; g.lineWidth = o.w || 11; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
    if (!o.ghost) { g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 3; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
    if (last) { g.fillStyle = '#fff'; g.beginPath(); g.arc(last[0], last[1], 9, 0, TAU); g.fill(); }
    g.restore();
  }
  // o.gear: the owner's ball skin (JustGold shop gear). Its paint replaces the plain colour; a ring in
  // the player's colour keeps the ball recognisable. No gear (or an unknown one): the classic ball.
  function drawBall(g, x, y, r, color, o = {}) {
    const pt = o.gear && window.MT_GEAR ? window.MT_GEAR.paint('plinko', 'ball', o.gear) : null;
    if (pt) return drawSkinBall(g, x, y, r, color, o, pt);
    g.save();
    if (o.glow) { g.shadowColor = color; g.shadowBlur = o.glow; }
    const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, color); gr.addColorStop(1, shade(color, -0.55));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
    g.lineWidth = Math.max(2, r * 0.14); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    if (o.sticky) { g.fillStyle = 'rgba(255,190,40,0.75)'; g.beginPath(); g.arc(x + r * 0.3, y + r * 0.4, r * 0.35, 0, TAU); g.fill(); }
  }
  function drawSkinBall(g, x, y, r, color, o, pt) {
    g.save();
    if (o.glow || pt.glow) { g.shadowColor = pt.glow ? pt.a : color; g.shadowBlur = (o.glow || 10) * (pt.glow ? 1.6 : 1); }
    const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r);
    gr.addColorStop(0, pt.c || '#ffffff'); gr.addColorStop(0.3, pt.a); gr.addColorStop(1, pt.b || shade(pt.a, -0.55));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.shadowBlur = 0;
    g.beginPath(); g.arc(x, y, r * 0.96, 0, TAU); g.clip();
    const p = pt.pattern; g.fillStyle = pt.c || '#ffffff'; g.strokeStyle = pt.c || '#ffffff'; g.globalAlpha = 0.75;
    if (p === 'stripes') { g.strokeStyle = pt.b; g.lineWidth = r * 0.3; for (const dx of [-0.55, 0.55]) { g.beginPath(); g.moveTo(x + dx * r, y - r); g.lineTo(x + dx * r, y + r); g.stroke(); } g.strokeStyle = pt.c || '#fff'; g.beginPath(); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke(); }
    else if (p === 'dots') { for (let i = 0; i < 5; i++) { const a = i * 1.26; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.16, 0, TAU); g.fill(); } }
    else if (p === 'check') { const s = r * 0.42; for (let i = -3; i < 3; i++) for (let j = -3; j < 3; j++) if ((i + j) & 1) g.fillRect(x + i * s, y + j * s, s, s); }
    else if (p === 'flame') { g.fillStyle = pt.c || '#fff'; g.beginPath(); g.moveTo(x - r * 0.5, y + r * 0.6); g.quadraticCurveTo(x - r * 0.2, y - r * 0.9, x, y - r * 0.2); g.quadraticCurveTo(x + r * 0.2, y - r * 0.9, x + r * 0.5, y + r * 0.6); g.fill(); }
    else if (p === 'stars' || p === 'swirl' || p === 'wave') { g.lineWidth = r * 0.16; g.beginPath(); g.arc(x, y, r * 0.55, 0.4, 2.8); g.stroke(); }
    g.restore();
    g.lineWidth = Math.max(2, r * 0.18); g.strokeStyle = color; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.42, r * 0.22, r * 0.13, -0.6, 0, TAU); g.fill();
    if (o.sticky) { g.fillStyle = 'rgba(255,190,40,0.75)'; g.beginPath(); g.arc(x + r * 0.3, y + r * 0.4, r * 0.35, 0, TAU); g.fill(); }
  }
  function shade(hex, k) { const n = parseInt(String(hex).slice(1), 16); if (!Number.isFinite(n)) return hex; const f = (c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; }
  function trail(g, path, f, color, len, width) {
    const i1 = Math.min(Math.floor(f), path.length / 2 - 1), i0 = Math.max(0, i1 - len);
    if (i1 - i0 < 1) return;
    g.save(); g.lineCap = 'round';
    for (let i = i0 + 1; i <= i1; i++) { const k = (i - i0) / (i1 - i0 + 1); g.globalAlpha = k * 0.55; g.strokeStyle = color; g.lineWidth = width * k; g.beginPath(); g.moveTo(path[(i - 1) * 2], path[(i - 1) * 2 + 1]); g.lineTo(path[i * 2], path[i * 2 + 1]); g.stroke(); }
    g.restore();
  }
  const posAt = (path, f) => { const n = path.length / 2; if (n === 0) return [W / 2, 70]; if (f <= 0) return [path[0], path[1]]; const i = Math.floor(f); if (i >= n - 1) return [path[(n - 1) * 2], path[(n - 1) * 2 + 1]]; const k = f - i; return [lerp(path[i * 2], path[i * 2 + 2], k), lerp(path[i * 2 + 1], path[i * 2 + 3], k)]; };
  // Where a landed ball comes to rest (stacked in its slot).
  function restSpots(board, balls) {
    const by = new Map();
    balls.forEach((b, i) => { if (!by.has(b.slot)) by.set(b.slot, []); by.get(b.slot).push(i); });
    const out = [];
    for (const [slot, list] of by) {
      const s = board.slots[slot] || { x0: 0, x1: W }; list.sort((a, b) => balls[a].landF - balls[b].landF);
      list.forEach((bi, k) => { const b = balls[bi], end = b.path.length ? b.path[b.path.length - 2] : (s.x0 + s.x1) / 2; const room = Math.max(1, Math.floor((s.x1 - s.x0 - 8) / (b.r * 2))); out[bi] = [clamp(end + ((k % room) - (room - 1) / 2) * 0, s.x0 + b.r + 5, s.x1 - b.r - 5) + (room > 1 ? ((k % room) - (room - 1) / 2) * b.r * 1.9 : 0), H - 8 - b.r - Math.floor(k / room) * b.r * 1.8]; });
    }
    return out;
  }

  // ---------------- the TV ----------------
  const TV = { s: null, at: 0, dropKey: '', dropStart: 0, landed: new Set(), parts: [], pops: [], flash: new Map(), lastTick: 0, phaseKey: '', phaseTotal: 1, endsLocal: 0, raf: 0, starsSeen: new Set(), bumpT: new Map(), scoreStart: 0, rest: new Map() };
  function tvFrame() {
    TV.raf = requestAnimationFrame(tvFrame);
    const cv = document.getElementById('pk-cv'); if (!cv || !TV.s) return;
    const bar = document.getElementById('pk-tbar'); if (bar) bar.style.transform = `scaleX(${TV.endsLocal ? clamp((TV.endsLocal - Date.now()) / TV.phaseTotal, 0, 1) : 0})`;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const s = TV.s, now = Date.now();
    if (s.phase === 'over') return drawBest(g, w, h, dpr, s, now);
    const tables = s.tables || [{ ids: [], ghosts: [], drops: [] }];
    const n = tables.length, cols = n <= 4 ? n : Math.ceil(Math.sqrt(n * 1.7)), rows = Math.ceil(n / cols);
    const cw = w / cols, ch = h / rows, lab = n > 1 ? 30 : 0;
    const sc = Math.min((cw - 14) / W, (ch - 10 - lab) / H);
    tables.forEach((T, ti) => {
      const cx = (ti % cols) * cw + cw / 2, cy = Math.floor(ti / cols) * ch + lab + (ch - lab) / 2;
      const ox = cx - (W * sc) / 2, oy = cy - (H * sc) / 2;
      if (n > 1) { g.font = `${Math.max(14, Math.min(24, lab - 6))}px "Bungee", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffe7a8'; g.fillText(`TABLE ${String.fromCharCode(65 + ti)}`, cx, oy - lab / 2 - 2); }
      g.save(); g.translate(ox, oy); g.scale(sc, sc);
      drawTable(g, s, T, ti, sc * dpr, now);
      g.restore();
    });
  }
  function dropTime(s, now) { return s.phase === 'drop' ? (now - TV.dropStart - (s.release || 2200)) / 1000 : s.phase === 'score' ? 99 : (now % 600000) / 1000; }
  function drawTable(g, s, T, ti, px, now) {
    const board = s.board; if (!board) return;
    const P = pal(s.style), layer = staticLayer(board, s.style, px);
    g.drawImage(layer, 0, 0, W, H);
    const tt = dropTime(s, now), fps = board.fps || 30;
    // replay of the trick shot in the score phase loops slowly
    const trick = s.phase === 'score' && s.results && s.results.trick && s.results.trick.ti === ti ? s.results.trick : null;
    let fr = s.phase === 'drop' ? Math.max(0, tt * fps) : 1e9;
    let bumpTime = s.phase === 'drop' ? Math.max(0, tt) : tt;
    let trickF = 0;
    if (trick && T.balls && T.balls[trick.ball]) { const b = T.balls[trick.ball], per = (b.landF / fps) / 0.6 + 1.6; const loc = ((now - TV.scoreStart) / 1000) % per; trickF = loc * fps * 0.6; bumpTime = trickF / fps; }
    // star pegs already taken by now
    const taken = new Set(); for (const st of T.stars || []) if (fr >= st.f) taken.add(st.i);
    for (const st of T.stars || []) { const key = TV.dropKey + ':' + ti + ':' + st.i; if (s.phase === 'drop' && fr >= st.f && !TV.starsSeen.has(key)) { TV.starsSeen.add(key); const p = board.pegs[st.i]; burst(ti, p[0], p[1], '#ffe14d', 26); pop(ti, p[0], p[1] - 30, '⭐ POWER-UP', nameOf(s, st.owner), colorOf(s, st.owner)); sting('star'); } }
    drawLive(g, board, s.style, bumpTime, now, { taken, bumpHit: (b) => { const v = TV.bumpT.get(ti + ':' + b.x + ':' + b.y); return v ? clamp(1 - (now - v) / 250, 0, 1) : 0; } });
    // peg flashes
    for (const [k, at] of TV.flash) { if (!k.startsWith(ti + ':')) continue; const a = 1 - (now - at) / 380; if (a <= 0) { TV.flash.delete(k); continue; } const p = board.pegs[Number(k.split(':')[1])]; if (!p) continue; g.save(); g.globalAlpha = a; g.shadowColor = P.pegGlow; g.shadowBlur = 30; g.fillStyle = '#fff'; g.beginPath(); g.arc(p[0], p[1], 10 + 8 * a, 0, TAU); g.fill(); g.restore(); }
    // ghost lines from earlier rounds
    for (const gh of T.ghosts || []) drawStroke(g, gh.p, gh.c, { ghost: true, alpha: P.ghost, w: 9 });
    // this round's lines (revealed when the drop starts)
    if (T.lines) {
      const el = s.phase === 'drop' ? (now - TV.dropStart) / 1000 : 9;
      T.lines.forEach((l, li) => {
        const prog = clamp((el - 0.15 - li * 0.12) / 0.8, 0, 1);
        if (l.erased) { const k = clamp((el - 1.1) / 0.5, 0, 1); if (k >= 1) return; for (const st of l.p) drawStroke(g, st, l.c, { prog, alpha: 1 - k }); if (k > 0 && k < 1) { const p0 = l.p[0] && l.p[0][0]; if (p0) { g.save(); g.globalAlpha = 1 - k; g.font = '60px serif'; g.textAlign = 'center'; g.fillText('🧽', p0[0] + k * 200, p0[1] - 30); g.restore(); } } return; }
        for (const st of l.p) drawStroke(g, st, l.c, { prog });
      });
    }
    // drop markers before the drop
    if (T.drops && (s.phase === 'draw' || s.phase === 'aim' || s.phase === 'intro')) {
      const shown = T.drops.filter((d) => d.x != null);
      for (const d of shown) {
        g.setLineDash([8, 14]); g.strokeStyle = d.c; g.globalAlpha = 0.35; g.lineWidth = 4; g.beginPath(); g.moveTo(d.x, 90); g.lineTo(d.x, SLOT_TOP); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
        drawBall(g, d.x, 70 + Math.sin(now / 300 + d.x) * 4, 22, d.c, { glow: 14, gear: d.gear });
        g.font = '30px "Segoe UI Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.av || '🙂', d.x, 70 + Math.sin(now / 300 + d.x) * 4);
        if (d.power) { g.font = '26px "Segoe UI Emoji", sans-serif'; g.fillText(d.power, d.x + 26, 44); }
      }
    }
    // the balls
    if (T.balls) {
      const rest = TV.rest.get(TV.dropKey + ':' + ti) || (() => { const r = restSpots(board, T.balls); TV.rest.set(TV.dropKey + ':' + ti, r); return r; })();
      T.balls.forEach((b, bi) => {
        const isTrick = trick && bi === trick.ball;
        let f = isTrick ? trickF : fr;
        const n = b.path.length / 2;
        const landedNow = !isTrick && (s.phase === 'score' || f >= b.landF);
        if (landedNow) {
          const key = TV.dropKey + ':' + ti + ':' + bi;
          const spot = rest[bi] || [b.path[b.path.length - 2], H - 30];
          let x = spot[0], y = spot[1];
          if (s.phase === 'drop') { const k = easeOut((f - b.landF) / 8); const e = posAt(b.path, n - 1); x = lerp(e[0], spot[0], k); y = lerp(e[1], spot[1], k); }
          if (s.phase === 'drop' && !TV.landed.has(key)) { TV.landed.add(key); landFx(s, ti, b, board); }
          drawBall(g, x, y, b.r * 1.15, b.c, { glow: trick ? 0 : 10, sticky: b.sticky, gear: b.gear });
          if (trick) { g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.arc(x, y, b.r + 1, 0, TAU); g.fill(); }
          return;
        }
        if (s.phase === 'drop' && f <= 0) { // waiting at the top, wobbling
          const p0 = posAt(b.path, 0); drawBall(g, p0[0], p0[1] + Math.sin(now / 90 + bi) * 3, b.r * 1.3, b.c, { glow: 14, sticky: b.sticky, gear: b.gear });
          return;
        }
        if (s.phase === 'score' && isTrick && f >= b.landF) f = b.landF;
        const p = posAt(b.path, f);
        trail(g, b.path, f, b.c, isTrick ? 26 : 10, b.r * 1.8);
        drawBall(g, p[0], p[1], b.r * 1.3, b.c, { glow: isTrick ? 40 : 18, sticky: b.sticky, gear: b.gear });
        if (isTrick) { g.font = '28px "Bungee", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText(trick.name, p[0], p[1] - b.r - 22); }
        // peg flashes + ticks + bumper hits
        if (s.phase === 'drop' || isTrick) {
          for (let i = 0; i < board.pegs.length; i++) { const q = board.pegs[i], dx = q[0] - p[0], dy = q[1] - p[1]; if (dx * dx + dy * dy < (b.r + 12) * (b.r + 12)) { const k = ti + ':' + i; if (!TV.flash.has(k) || now - TV.flash.get(k) > 200) { TV.flash.set(k, now); if (now - TV.lastTick > 65 && s.phase === 'drop') { TV.lastTick = now; sting('peg'); } } } }
          for (const bb of board.bumpers) { const x = bb.x + (bb.ax ? bb.ax * Math.sin(bb.w * bumpTime + bb.ph) : 0); if (Math.hypot(x - p[0], bb.y - p[1]) < bb.r + b.r + 6) { const k = ti + ':' + bb.x + ':' + bb.y; if (!TV.bumpT.has(k) || now - TV.bumpT.get(k) > 300) { TV.bumpT.set(k, now); if (s.phase === 'drop') { sting('bumper'); burst(ti, p[0], p[1], P.bump, 8); } } } }
        }
      });
    }
    // countdown before release
    if (s.phase === 'drop' && tt < 0) {
      const sec = Math.ceil(-tt), k = (-tt) % 1;
      g.save(); g.globalAlpha = clamp(k * 1.4, 0, 1); g.font = `${Math.round(200 + 80 * k)}px "Bungee", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 14; g.strokeStyle = 'rgba(0,0,0,0.6)';
      const txt = sec >= 3 ? 'READY' : sec === 2 ? 'SET' : 'DROP!'; g.font = `${Math.round(120 + 40 * k)}px "Bungee", sans-serif`; g.strokeText(txt, W / 2, 620); g.fillStyle = '#ffe14d'; g.fillText(txt, W / 2, 620); g.restore();
    }
    // particles + pop-ups
    TV.parts = TV.parts.filter((q) => now - q.t < q.life);
    for (const q of TV.parts) { if (q.ti !== ti) continue; const a = (now - q.t) / 1000; const x = q.x + q.vx * a, y = q.y + q.vy * a + 900 * a * a; g.globalAlpha = 1 - (now - q.t) / q.life; g.fillStyle = q.c; g.fillRect(x - q.s / 2, y - q.s / 2, q.s, q.s); }
    g.globalAlpha = 1;
    TV.pops = TV.pops.filter((q) => now - q.t < 2600);
    for (const q of TV.pops) {
      if (q.ti !== ti) continue; const a = (now - q.t) / 2600, k = easeOut(a * 5), y = q.y - a * 140;
      g.save(); g.globalAlpha = a > 0.75 ? (1 - a) / 0.25 : 1; g.translate(q.x, y); g.scale(0.4 + 0.6 * k, 0.4 + 0.6 * k); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `${q.big ? 92 : 58}px "Bungee", sans-serif`; g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(q.text, 0, 0); g.fillStyle = q.big ? '#ffe14d' : q.bad ? '#ff5a6a' : '#ffffff'; g.fillText(q.text, 0, 0);
      if (q.sub) { g.font = '40px "Lilita One", sans-serif'; g.lineWidth = 8; g.strokeText(q.sub, 0, q.big ? 76 : 56); g.fillStyle = q.c || '#fff'; g.fillText(q.sub, 0, q.big ? 76 : 56); }
      g.restore();
    }
  }
  const nameOf = (s, id) => { const r = (s.standings || []).find((x) => x.id === id); return r ? r.name : ''; };
  const colorOf = (s, id) => { const r = (s.standings || []).find((x) => x.id === id); return r ? r.color : '#fff'; };
  function burst(ti, x, y, c, n) { const now = Date.now(); for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 200 + Math.random() * 600; TV.parts.push({ ti, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 400, c, s: 8 + Math.random() * 12, t: now, life: 900 + Math.random() * 700 }); } if (TV.parts.length > 900) TV.parts.splice(0, TV.parts.length - 900); }
  function pop(ti, x, y, text, sub, c, o = {}) { TV.pops.push({ ti, x: clamp(x, 160, W - 160), y, text, sub, c, t: Date.now(), ...o }); }
  function landFx(s, ti, b, board) {
    const sl = board.slots[b.slot]; if (!sl) return;
    const x = (sl.x0 + sl.x1) / 2, nm = nameOf(s, b.id);
    if (sl.k === 'jack') { burst(ti, x, SLOT_TOP, '#ffe14d', 60); burst(ti, x, SLOT_TOP, '#fff', 30); pop(ti, x, SLOT_TOP - 160, 'JACKPOT!', `${nm} +${sl.v}`, b.c, { big: true }); sting('jackpot'); }
    else if (sl.k === 'bust') { burst(ti, x, SLOT_TOP + 40, '#333', 30); burst(ti, x, SLOT_TOP + 40, '#ff3b3b', 20); pop(ti, x, SLOT_TOP - 80, 'BUST!', nm, b.c, { bad: true }); sting('bust'); }
    else { burst(ti, x, SLOT_TOP + 20, b.c, 22); pop(ti, x, SLOT_TOP - 80, sl.k === 'pts' ? '+' + sl.v : sl.label, nm, b.c); sting(sl.k === 'pts' ? 'slot' : 'special'); }
  }
  // Game over: the drop of the night, replayed on its own board.
  function drawBest(g, w, h, dpr, s, now) {
    const B = s.best; if (!B || !B.board) return;
    const sc = Math.min((w - 10) / W, (h - 10) / H), ox = (w - W * sc) / 2, oy = (h - H * sc) / 2;
    g.save(); g.translate(ox, oy); g.scale(sc, sc);
    g.drawImage(staticLayer(B.board, s.style, sc * dpr), 0, 0, W, H);
    const fps = B.board.fps || 30, n = B.path.length / 2, per = n / fps / 0.7 + 1.8, loc = (now / 1000) % per, f = Math.min(n - 1, loc * fps * 0.7);
    drawLive(g, B.board, s.style, f / fps, now, {});
    for (const gh of (B.lines && B.lines.ghosts) || []) drawStroke(g, gh.p, gh.c, { ghost: true, alpha: pal(s.style).ghost, w: 9 });
    for (const l of (B.lines && B.lines.lines) || []) for (const st of l.p) drawStroke(g, st, l.c, {});
    const p = posAt(B.path, f); trail(g, B.path, f, B.color, 30, B.r * 1.6); drawBall(g, p[0], p[1], B.r, B.color || '#fff', { glow: 40 });
    g.restore();
  }

  // ---------------- TV lobby: the arcade cabinet ----------------
  const CHIP_C = ['#e8323c', '#2f6bff', '#2fbf71', '#8b3fd9', '#ff8c42'];
  const FIELD_ICON = { rounds: '🔁', ink: '🖋️', style: '🎨', powerups: '⚡', timer: '⏱️', showIntro: '🎬' };
  const hidden = (f, val) => `<select class="pk-hide" data-set="${esc(f.key)}" tabindex="-1" aria-label="${esc(f.label)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(val) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
  function lobbyBg(cv) {
    const balls = Array.from({ length: 26 }, (_, i) => ({ x: Math.random(), y: Math.random(), v: 0.05 + Math.random() * 0.12, c: CHIP_C[i % 5], r: 6 + Math.random() * 10, ph: Math.random() * TAU }));
    const step = () => {
      if (!cv.isConnected) return; requestAnimationFrame(step);
      const w = cv.clientWidth, h = cv.clientHeight; if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      const g = cv.getContext('2d'), t = performance.now() / 1000;
      const gr = g.createRadialGradient(w / 2, h * 0.3, 50, w / 2, h * 0.5, w * 0.8); gr.addColorStop(0, '#3a0d4f'); gr.addColorStop(1, '#0b0216'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,215,140,0.12)'; for (let y = 30, r = 0; y < h; y += 56, r++) for (let x = (r % 2) * 28; x < w; x += 56) { g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); }
      for (const b of balls) { b.y += b.v / 60; if (b.y > 1.05) { b.y = -0.05; b.x = Math.random(); } const x = b.x * w + Math.sin(t * 2 + b.ph) * 20; g.globalAlpha = 0.5; drawBall(g, x, b.y * h, b.r, b.c, {}); }
      g.globalAlpha = 1;
    };
    requestAnimationFrame(step);
  }
  function lobbyTv(el, L) {
    if (!el.querySelector('.pkl')) {
      el.innerHTML = `<div class="pkl"><canvas class="pkl-bg"></canvas>
        <div class="pkl-cab">
          <div class="pkl-marquee"><div class="pkl-bulbs"></div><h1>Just<b>Drop</b></h1><p>Drop it · Draw it · Win it</p></div>
          <div class="pkl-body">
            <div class="pkl-ticket"><div class="pkl-tk-top">🎟️ SCAN TO PLAY</div><img id="qr" alt="QR code to join"><div class="pkl-tk-lab">Room code</div><div class="pkl-code" id="code"></div><div class="pkl-url" id="pkl-url"></div></div>
            <div class="pkl-panel"><div class="pkl-panel-h">🎛️ CONTROL PANEL</div><div class="pkl-settings" id="settings"></div></div>
            <div class="pkl-btns"><button class="pkl-start" id="start"><span>START</span><small>insert coin</small></button><div class="pkl-err" id="lobby-err"></div></div>
          </div>
          <div class="pkl-how"><span>1 · Pick your drop spot</span><span>2 · Draw ONE line (limited ink)</span><span>3 · Watch every ball drop at once</span><span>💰 Jackpots · 💥 Busts · ✏️ lines pay you</span></div>
          <div class="pkl-roster-h">Players at the machine <b id="pkl-n"></b></div>
          <div class="pkl-roster" id="roster"></div>
          <div id="pkl-lineup"></div>
          <div class="pkl-links"><button class="link" id="add-bots">🤖 + 5 test bots</button><button class="link" id="pkl-rm">remove bots</button><button class="link" id="pick">🎮 Another game</button></div>
        </div></div>`;
      lobbyBg(el.querySelector('.pkl-bg'));
      el.querySelector('#start').onclick = async () => { const r = await L.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      el.querySelector('#add-bots').onclick = () => L.bots(5);
      el.querySelector('#pkl-rm').onclick = () => L.removeBots();
      el.querySelector('#pick').onclick = () => L.pick();
      el.querySelector('.pkl-bulbs').innerHTML = Array.from({ length: 22 }, (_, i) => `<i style="--i:${i}"></i>`).join('');
    }
    LOBBY = L;
    el.querySelector('#code').textContent = L.code;
    el.querySelector('#pkl-url').textContent = (L.joinUrl || '').replace(/^https?:\/\//, '').replace(/\?.*$/, '');
    const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
    const set = el.querySelector('#settings'), sig = JSON.stringify([L.settings, L.fields.map((f) => f.key)]);
    if (set.dataset.sig !== sig && !set.contains(document.activeElement && document.activeElement.tagName === 'SELECT' ? document.activeElement : null)) {
      set.dataset.sig = sig;
      set.innerHTML = L.fields.map((f) => `<div class="pkl-row"><div class="pkl-lab">${FIELD_ICON[f.key] || '🎚️'} ${esc(f.label)}</div><div class="pkl-chips">${f.options.map((o, i) => `<button class="pkl-chip ${String(L.settings[f.key]) === String(o.value) ? 'on' : ''}" style="--c:${CHIP_C[i % CHIP_C.length]}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}">${esc(o.label)}</button>`).join('')}</div>${hidden(f, L.settings[f.key])}</div>`).join('');
      for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => LOBBY.set(s.dataset.set, s.value);
      for (const b of set.querySelectorAll('[data-k]')) b.onclick = () => { const s = set.querySelector(`[data-set="${b.dataset.k}"]`); if (s) { s.value = b.dataset.v; s.onchange(); } for (const x of set.querySelectorAll(`[data-k="${b.dataset.k}"]`)) x.classList.toggle('on', x === b); BOX.sfx('pop'); };
    }
    el.querySelector('#pkl-n').textContent = L.players.length ? `(${L.players.length})` : '';
    BOX.morph(el.querySelector('#roster'), L.players.map((p) => `<span class="chip ${p.online ? '' : 'off'}"><i class="pkl-ball" style="--c:${esc(p.color)}"></i><span class="av">${esc(p.avatar || '🙂')}</span>${esc(p.name)}</span>`).join('') || '<span class="pkl-empty">Scan the ticket to join! 🎟️</span>');
    const lu = el.querySelector('#pkl-lineup'); if (lu.dataset.h !== (L.lineupHtml || '')) { lu.innerHTML = L.lineupHtml || ''; lu.dataset.h = L.lineupHtml || ''; }
    el.querySelector('#start').disabled = L.players.length < (L.min || 1);
  }
  let LOBBY = null;

  // ---------------- TV game screens ----------------
  const PH_TITLE = { intro: 'Get ready', aim: '📱 Pick your drop spot!', draw: '✏️ Draw ONE line: bend the balls!', drop: 'Here they come…', score: 'Round results' };
  const stars5 = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 5 - n));
  function boardRows(s, opts = {}) {
    const st = s.standings || [];
    return st.map((r) => {
      const mv = r.prevRank && s.phase === 'score' ? r.prevRank - r.rank : 0;
      return `<div class="pk-row ${r.rank === 1 ? 'top' : ''}" style="--c:${esc(r.color)}"><span class="n">${r.rank}</span><i class="pk-dot"></i><span class="av">${esc(r.avatar || '')}</span><span class="nm">${esc(r.name)}</span>${mv ? `<span class="mv ${mv > 0 ? 'up' : 'dn'}">${mv > 0 ? '▲' : '▼'}${Math.abs(mv)}</span>` : ''}${opts.gain && r.gain ? `<span class="gn ${r.gain < 0 ? 'neg' : ''}">${r.gain > 0 ? '+' : ''}${r.gain}</span>` : ''}<b>${r.total}</b></div>`;
    }).join('');
  }
  // Right column: who we're waiting on + the live leaderboard.
  function sideHtml(s) {
    const lb = `<div class="pk-card pk-lb"><h3>🏆 Leaderboard${s.count > (s.standings || []).length ? ` <small>top ${s.standings.length} of ${s.count}</small>` : ''}</h3>${boardRows(s, { gain: s.phase === 'score' })}</div>`;
    if (s.phase === 'aim' || s.phase === 'draw') {
      const wt = s.waiting || [];
      return `<div class="pk-card pk-wait"><h3>${wt.length ? `⏳ Waiting on ${s.waitingN}` : '✅ Everyone’s in!'}</h3><div class="pk-wchips">${wt.map((p) => `<span style="--c:${esc(p.color)}">${esc(p.avatar || '')} ${esc(p.name)}</span>`).join('')}${s.waitingN > wt.length ? `<span>+${s.waitingN - wt.length}</span>` : ''}</div></div>${lb}`;
    }
    return lb;
  }
  // Left column: the three steps and a guide to this board's slots, or the round's payouts.
  const GUIDE = { jack: ['💰', 'JACKPOT', 'the big one'], bust: ['💥', 'BUST', 'you lose points'], x2: ['✖️', '×2', 'doubles your round'], steal: ['🦹', 'STEAL', 'rob the leader'], gift: ['🎁', 'GIFT', '+50 and a power-up'] };
  function leftHtml(s) {
    if (s.phase === 'score' && s.results && s.results.sudden) return `<div class="pk-card pk-trick"><div class="ic">⚡</div><div><small>SUDDEN DEATH</small><b>${esc((s.results.order[0] || {}).name || '')} wins it!</b><span>${s.results.order.map((o) => `${esc(o.name)}: ${esc(o.slot)}`).join(' · ')}</span></div></div>`;
    if (s.phase === 'score' && s.results) {
      const tr = s.results.trick;
      const gains = (s.gains || []).slice().sort((a, b) => b.gain - a.gain).slice(0, 7);
      return `${tr ? `<div class="pk-card pk-trick"><div class="ic">🎪</div><div><small>CROWD FAVOURITE · TRICK SHOT</small><b>${esc(tr.name)}</b><span>+75 · style ${tr.style} · landed ${esc(tr.slot)}</span></div></div>` : ''}<div class="pk-card pk-gains"><h3>💵 This round</h3>${gains.map((r) => `<div class="pk-gr" style="--c:${esc(r.color)}"><span class="av">${esc(r.avatar || '')}</span><span class="nm">${esc(r.name)}<small>${esc((r.items || []).filter((x) => x.v || /Star|×2|Steal/.test(x.t)).slice(0, 2).map((x) => x.t).join(' · '))}</small></span><b class="${r.gain < 0 ? 'neg' : ''}">${r.gain > 0 ? '+' : ''}${r.gain}</b></div>`).join('')}</div>`;
    }
    const steps = [['aim', '🎯', 'Pick your drop spot', 'Tap along the top of the board on your phone. Got a power-up? Use it!'], ['draw', '✏️', 'Draw ONE line', 'Everyone’s spot is showing now. Help yourself… or wreck a rival.'], ['drop', '⬇️', 'Watch them drop', 'Lines pay their owner: 20% of good slots, +50 per rival busted.']];
    const cur = s.phase === 'intro' ? '' : s.phase;
    const b = s.board || { slots: [], pegs: [], bumpers: [], spinners: [], wind: {} };
    const kinds = [...new Set(b.slots.map((x) => x.k))].filter((k) => GUIDE[k]);
    const gl = kinds.map((k) => { const sl = b.slots.find((x) => x.k === k); return `<div class="pk-gd ${k}"><i>${GUIDE[k][0]}</i><b>${k === 'jack' || k === 'bust' ? esc(String(sl.v)) : GUIDE[k][1]}</b><span>${GUIDE[k][2]}</span></div>`; });
    if ((b.pegs || []).some((p) => p[2])) gl.push('<div class="pk-gd"><i>⭐</i><b>STAR PEG</b><span>first touch wins a power-up</span></div>');
    if (b.bumpers.length) gl.push('<div class="pk-gd"><i>🔴</i><b>BUMPERS</b><span>kick balls away hard</span></div>');
    if (b.spinners.length) gl.push('<div class="pk-gd"><i>🌀</i><b>SPINNERS</b><span>whack balls sideways</span></div>');
    if (b.wind && b.wind.amp) gl.push('<div class="pk-gd"><i>🌬️</i><b>WIND</b><span>shifts left and right</span></div>');
    if (s.round > 1 && !s.sudden) gl.push('<div class="pk-gd"><i>👻</i><b>GHOSTS</b><span>old lines still deflect</span></div>');
    return `<div class="pk-card pk-steps">${steps.map(([k, ic, t, d]) => `<div class="pk-st ${k === cur ? 'on' : ''}"><i>${ic}</i><div><b>${t}</b>${k === cur ? `<small>${d}</small>` : ''}</div></div>`).join('')}</div>
      <div class="pk-card pk-guide"><h3>🎰 This board</h3>${gl.join('')}</div>`;
  }
  function overlayHtml(s) {
    if (s.phase === 'intro') {
      if (s.sudden) return `<div class="pk-intro sudden"><small>IT’S A TIE AT THE TOP!</small><h2>⚡ SUDDEN DEATH DROP ⚡</h2><p>${s.sudden.map((p) => `<span style="--c:${esc(p.color)}">${esc(p.avatar || '')} ${esc(p.name)}</span>`).join(' vs ')}</p><p class="pk-news"><span>One ball each · no lines · highest slot wins</span></p></div>`;
      return `<div class="pk-intro"><small>ROUND ${s.round} OF ${s.of}</small><h2>${s.round === s.of ? 'FINAL DROP!' : s.round === 1 ? 'FIRST DROP!' : 'NEXT BOARD!'}</h2><div class="pk-lvl">DIFFICULTY <b>${stars5(s.level)}</b></div><p class="pk-news">${(s.board && s.board.news || []).map((n) => `<span>${esc(n)}</span>`).join('')}${s.round > 1 ? '<span>👻 last round’s lines stay as ghosts</span>' : ''}</p></div>`;
    }
    return '';
  }
  function tvGame(el, s) {
    if (!s) return;
    const key = s.phase + ':' + s.round + ':' + (s.sudden ? 1 : 0);
    if (TV.phaseKey !== key) { TV.phaseKey = key; TV.phaseTotal = Math.max(1, s.endsIn || 1); if (s.phase === 'score') TV.scoreStart = Date.now(); }
    TV.endsLocal = s.endsIn ? Date.now() + s.endsIn : 0;
    if (s.phase === 'drop' || s.phase === 'score') {
      const dk = s.round + ':' + (s.sudden ? 'sd' : '');
      if (TV.dropKey !== dk) { TV.dropKey = dk; TV.dropStart = Date.now() - (s.t0Ago || 0); TV.landed = new Set(); TV.rest = new Map(); TV.starsSeen = new Set(); if (s.phase === 'score') TV.dropStart -= 60000; }
    }
    TV.s = s; TV.at = Date.now();
    if (!TV.raf) TV.raf = requestAnimationFrame(tvFrame);
    if (s.phase === 'over') return tvOver(el, s);
    const style = s.style || 'classic';
    BOX.morph(el, `<div class="pk-tv pk-${esc(style)}">
      <div class="pk-top"><div class="pk-rnd">${s.sudden ? '⚡ SUDDEN DEATH' : `ROUND <b>${s.round}</b>/${s.of}`}</div><div class="pk-ph">${esc(s.phase === 'intro' ? (s.sudden ? 'Tie-breaker!' : 'Here’s the board') : PH_TITLE[s.phase] || '')}</div><div class="pk-lv">${stars5(s.level)}</div><div class="pk-timer"><i id="pk-tbar"></i></div></div>
      <div class="pk-main"><aside class="pk-left">${leftHtml(s)}</aside><div class="pk-stagewrap"><div class="pk-stage" id="pk-stage" data-keep></div><div class="pk-ov">${overlayHtml(s)}</div></div><aside class="pk-side">${sideHtml(s)}</aside></div></div>`);
    mountCv(el);
  }
  function mountCv(el) { const st = el.querySelector('#pk-stage'); if (st && !st.querySelector('canvas')) st.innerHTML = '<canvas id="pk-cv"></canvas>'; }
  function tvOver(el, s) {
    const st = s.standings || [], w = st[0] || {};
    const pod = [st[1], st[0], st[2]].map((r, i) => (r ? `<div class="pk-pod p${[2, 1, 3][i]}" style="--c:${esc(r.color)}"><div class="av">${esc(r.avatar || '')}</div><div class="nm">${esc(r.name)}</div><div class="pts">${r.total}</div><div class="blk">${[2, 1, 3][i]}</div></div>` : '<div class="pk-pod empty"></div>')).join('');
    BOX.morph(el, `<div class="pk-tv pk-${esc(s.style || 'classic')} pk-over">
      <div class="pk-win"><small>JACKPOT CHAMPION</small><h2>🏆 ${esc(w.name || '')} wins!</h2>${s.sdWinner ? '<p>…after a sudden-death drop!</p>' : ''}</div>
      <div class="pk-main"><div class="pk-endl"><div class="pk-podium">${pod}</div>
        <div class="pk-awards">${(s.awards || []).map((a) => `<div class="pk-aw"><div class="ic">${esc(a.icon)}</div><div><b>${esc(a.title)}</b><span>${esc(a.name)}</span><small>${esc(a.why)}</small></div></div>`).join('')}</div>
        <div class="pk-card pk-lb small">${boardRows({ ...s, standings: st.slice(3, 11), phase: 'over' })}</div></div>
        <div class="pk-stagewrap best">${s.best ? `<div class="pk-best-h">🎬 DROP OF THE NIGHT · <b style="color:${esc(s.best.color || '#fff')}">${esc(s.best.name)}</b> · round ${s.best.round} · ${esc(s.best.slot)}</div>` : ''}<div class="pk-stage" id="pk-stage" data-keep></div></div></div></div>`);
    mountCv(el);
  }

  // ---------------- phones ----------------
  const PP = { round: '', strokes: [], redo: [], cur: null, x: null, power: null, target: null, felt: '', V: null, ctx: null, color: '#ffd23f', sending: false, raf: 0, dropStart: 0, dropKey: '' };
  const inkUsed = () => PP.strokes.reduce((a, s) => a + len(s), 0) + (PP.cur ? len(PP.cur) : 0);
  const len = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
  function phoneCanvas(el) {
    const pad = el.querySelector('#pk-pad'); if (!pad) return null;
    let cv = pad.querySelector('canvas');
    if (!cv) {
      cv = document.createElement('canvas'); cv.className = 'pk-pcv'; pad.appendChild(cv);
      const pt = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
      cv.addEventListener('pointerdown', (e) => {
        const V = PP.V; if (!V) return; e.preventDefault();
        try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
        if (V.phase === 'aim') { PP.x = clamp(pt(e)[0], 60, W - 60); PP.aimDrag = true; drawPhone(); }
        else if (V.phase === 'draw' && !V.me.done) {
          if (PP.strokes.length >= 2) { PP.ctx.toast('Two strokes max: undo one first.'); PP.ctx.haptic('error'); return; }
          if (V.ink - inkUsed() < 10) { PP.ctx.toast('Out of ink! Undo to try again.'); PP.ctx.haptic('warn'); return; }
          const p = pt(e); PP.cur = [[Math.round(p[0]), Math.round(clamp(p[1], LINE_TOP, LINE_BOT))]]; PP.ctx.haptic('tap'); drawPhone();
        }
      });
      cv.addEventListener('pointermove', (e) => {
        const V = PP.V; if (!V) return;
        if (V.phase === 'aim' && PP.aimDrag) { PP.x = clamp(pt(e)[0], 60, W - 60); drawPhone(); return; }
        if (!PP.cur) return; e.preventDefault();
        const p = pt(e), q = [Math.round(clamp(p[0], 4, W - 4)), Math.round(clamp(p[1], LINE_TOP, LINE_BOT))], l = PP.cur[PP.cur.length - 1], d = Math.hypot(q[0] - l[0], q[1] - l[1]);
        if (d < 8) return;
        const left = V.ink - inkUsed();
        if (left <= 0) { finishStroke(true); return; }
        if (d > left) { const k = left / d; PP.cur.push([Math.round(l[0] + (q[0] - l[0]) * k), Math.round(l[1] + (q[1] - l[1]) * k)]); finishStroke(true); return; }
        if (PP.cur.length < 300) PP.cur.push(q);
        drawPhone(); inkMeter();
      });
      const up = () => { if (PP.aimDrag) { PP.aimDrag = false; PP.ctx.haptic('select'); PP.ctx.redraw(); } if (PP.cur) finishStroke(false); };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    return cv;
  }
  function finishStroke(empty) {
    const st = PP.cur; PP.cur = null;
    if (st && st.length >= 2 && len(st) >= 12) { PP.strokes.push(st); PP.redo = []; sendLine(false); }
    if (empty) { PP.ctx.toast('🖋️ Out of ink!'); PP.ctx.haptic('warn'); }
    PP.ctx.redraw();
  }
  async function sendLine(done) {
    const V = PP.V; if (!V || V.phase !== 'draw') return;
    const msg = { op: 'line', strokes: PP.strokes, done };
    if (PP.target && V.me.power === 'eraser') msg.target = PP.target;
    const r = await PP.ctx.act(msg);
    if (r && r.ok && done) { PP.ctx.haptic('success'); PP.ctx.sfx('chime'); }
    return r;
  }
  function inkMeter() { const m = document.getElementById('pk-ink'); if (!m || !PP.V) return; const k = clamp(1 - inkUsed() / PP.V.ink, 0, 1); m.style.setProperty('--k', k.toFixed(3)); const t = document.getElementById('pk-inkt'); if (t) t.textContent = Math.round(k * 100) + '%'; }
  function drawPhone() {
    const V = PP.V, cv = document.querySelector('#pk-pad canvas'); if (!V || !cv || !V.board) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight; if (!w) return;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'), sc = w / W, now = Date.now(); g.setTransform(dpr * sc, 0, 0, dpr * sc, 0, 0); g.clearRect(0, 0, W, H);
    const style = V.style || PP.style || 'classic';
    g.drawImage(staticLayer(V.board, style, sc * dpr), 0, 0, W, H);
    let tt = (now % 600000) / 1000;
    if (V.phase === 'drop') tt = Math.max(0, (now - PP.dropStart - (V.release || 2200)) / 1000);
    drawLive(g, V.board, style, tt, now, {});
    for (const gh of V.ghosts || []) drawStroke(g, gh.p, gh.c, { ghost: true, alpha: pal(style).ghost, w: 9 });
    if (V.phase === 'draw' || V.phase === 'aim') {
      for (const d of V.drops || []) if (d.x != null) { g.setLineDash([8, 14]); g.strokeStyle = d.c; g.globalAlpha = d.me ? 0.6 : 0.3; g.lineWidth = 4; g.beginPath(); g.moveTo(d.x, 90); g.lineTo(d.x, SLOT_TOP); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; drawBall(g, d.x, 70, d.me ? 26 : 20, d.c, { glow: d.me ? 20 : 6, gear: d.gear }); g.font = `${d.me ? 32 : 26}px "Segoe UI Emoji", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.av || '🙂', d.x, 71); }
      if (V.phase === 'aim' && PP.x != null) {
        g.setLineDash([10, 12]); g.strokeStyle = PP.color; g.globalAlpha = 0.7; g.lineWidth = 5; g.beginPath(); g.moveTo(PP.x, 100); g.lineTo(PP.x, SLOT_TOP); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
        const big = PP.power === 'big', twin = PP.power === 'twin';
        if (twin) { drawBall(g, PP.x - 28, 70, 15 * 1.5, PP.color, { glow: 18, gear: V.gear }); drawBall(g, PP.x + 28, 70, 15 * 1.5, PP.color, { glow: 18, gear: V.gear }); }
        else drawBall(g, PP.x, 70, (big ? 24 : 15) * 1.6, PP.color, { glow: 24, sticky: PP.power === 'sticky', gear: V.gear });
        g.fillStyle = '#fff'; g.font = '44px "Bungee", sans-serif'; g.textAlign = 'center'; g.fillText('▼', PP.x, 140);
      }
      if (V.phase === 'draw') {
        for (const st of PP.strokes) drawStroke(g, st, PP.color, { w: 13 });
        if (PP.cur) drawStroke(g, PP.cur, PP.color, { w: 13, alpha: 0.85 });
        if (!PP.strokes.length && !PP.cur) { g.save(); g.globalAlpha = 0.5 + 0.3 * Math.sin(now / 300); g.fillStyle = '#fff'; g.font = '56px "Lilita One", sans-serif'; g.textAlign = 'center'; g.fillText('✏️ Draw with your finger', W / 2, 620); g.restore(); }
      }
    }
    if ((V.phase === 'drop' || V.phase === 'score') && V.mine) {
      for (const l of V.lines || []) for (const st of l.p) drawStroke(g, st, l.c, { glow: 6 });
      const fr = V.phase === 'drop' ? tt * (V.board.fps || 30) : 1e9;
      for (const b of V.mine) {
        const n = b.path.length / 2;
        if (V.phase === 'drop' && now - PP.dropStart < (V.release || 2200)) { drawBall(g, b.path[0], b.path[1], b.r * 1.3, PP.color, { glow: 20, gear: V.gear }); continue; }
        const f = Math.min(fr, n - 1), p = posAt(b.path, f);
        trail(g, b.path, f, PP.color, 10, b.r * 1.8);
        drawBall(g, p[0], f >= n - 1 ? H - b.r * 1.3 - 10 : p[1], b.r * 1.3, PP.color, { glow: 24, gear: V.gear });
      }
    }
  }
  function phoneLoop() { PP.raf = requestAnimationFrame(phoneLoop); if (!document.querySelector('#pk-pad canvas')) return; if (PP.V && (PP.V.phase === 'drop' || PP.V.phase === 'aim' || PP.V.phase === 'intro' || PP.V.board && (PP.V.board.bumpers.length || PP.V.board.spinners.length || PP.V.board.wind.amp))) drawPhone(); }
  const powerChip = (p, on) => `<button class="pk-pw ${on ? 'on' : ''}" data-pw="${esc(p.k)}"><span class="ic">${esc(p.icon)}</span><span><b>${esc(p.name)}</b><small>${esc(p.about)}</small></span></button>`;
  function phone(el, v, ctx, full) {
    if (!v) return;
    PP.V = v; PP.ctx = ctx; if (full && full.me) PP.color = full.me.color || PP.color;
    
    const rk = v.round + ':' + (v.sudden ? 'sd' : '');
    if (PP.round !== rk) { PP.round = rk; PP.strokes = []; PP.redo = []; PP.cur = null; PP.x = v.me && v.me.x != null ? v.me.x : null; PP.power = null; PP.target = null; }
    if (v.phase === 'draw' && PP.adopted !== rk) { PP.adopted = rk; if (!PP.strokes.length && !PP.cur && v.me && v.me.strokes && v.me.strokes.length) PP.strokes = v.me.strokes.map((s) => s.map((p) => p.slice())); }
    if (v.phase === 'drop' && PP.dropKey !== rk) { PP.dropKey = rk; PP.dropStart = Date.now() - (v.t0Ago || 0); }
    if (!PP.raf) PP.raf = requestAnimationFrame(phoneLoop);
    // haptics at the big moments
    const fk = v.phase + rk;
    if (PP.felt !== fk) {
      PP.felt = fk;
      if (v.phase === 'aim' && v.inRound) ctx.haptic('turn');
      if (v.phase === 'draw' && v.inRound) ctx.haptic('turn');
      if (v.phase === 'drop') ctx.haptic('big');
      if (v.phase === 'score') ctx.haptic(v.trick || (v.items || []).some((x) => /JACKPOT/.test(x.t)) ? 'win' : v.gain < 0 ? 'error' : 'success');
      if (v.phase === 'over') ctx.haptic(v.rank === 1 ? 'win' : 'success');
    }
    const head = `<div class="pk-ph-top"><span>${v.sudden ? '⚡ Sudden death' : `Round ${v.round}/${v.of}`}</span><span>💰 <b>${v.total}</b></span><span>#${v.rank || '–'} of ${v.count}</span></div>`;
    const pad = '<div class="pk-pad" id="pk-pad" data-keep></div>';
    if (v.spectator) return BOX.morph(el, `<div class="pk-phone">${head}<div class="pk-msg"><h3>You’re in from the next round!</h3><p>Watch the big screen 📺</p></div></div>`);
    if (v.phase === 'over') {
      return BOX.morph(el, `<div class="pk-phone pk-end"><div class="pk-place">${v.rank === 1 ? '🏆' : v.rank <= 3 ? ['', '', '🥈', '🥉'][v.rank] : '🎯'}</div><h2>${v.rank === 1 ? 'You win!' : `You finished #${v.rank}`}</h2><p class="pk-big">💰 ${v.total}</p>
        ${(v.awards || []).map((a) => `<div class="pk-aw"><div class="ic">${esc(a.icon)}</div><div><b>${esc(a.title)}</b><small>${esc(a.why)}</small></div></div>`).join('')}
        <div class="pk-top5">${(v.top || []).map((r, i) => `<div><span>${i + 1}. ${esc(r.avatar || '')} ${esc(r.name)}</span><b>${r.total}</b></div>`).join('')}</div></div>`);
    }
    if (!v.inRound) return BOX.morph(el, `<div class="pk-phone">${head}<div class="pk-msg"><h3>⚡ Sudden death!</h3><p>The tied leaders get one ball each. Watch the TV!</p></div></div>`);
    if (v.phase === 'intro') {
      return BOX.morph(el, `<div class="pk-phone">${head}<div class="pk-msg"><h3>${v.sudden ? '⚡ Sudden death drop!' : `Round ${v.round}: get ready!`}</h3><p>${v.sudden ? 'One ball, no lines. Highest slot wins.' : 'Look at the new board on the TV.'}</p></div>${pad}
        ${v.powers.length ? `<div class="pk-pows-h">Your power-ups</div><div class="pk-pows">${v.powers.map((p) => `<span class="pk-pwmini">${esc(p.icon)} ${esc(p.name)}</span>`).join('')}</div>` : ''}</div>`), after(el);
    }
    if (v.phase === 'aim') {
      const locked = v.me.locked;
      if (PP.x == null) PP.x = 500;
      BOX.morph(el, `<div class="pk-phone">${head}<div class="pk-hint">${locked ? '✅ Locked in! Tap the board to move it.' : '👆 Tap or slide along the board to aim'}</div>${pad}
        ${v.powers.length && !v.sudden ? `<div class="pk-pows-h">Use a power-up? <small>(one per round)</small></div><div class="pk-pows">${v.powers.filter((p, i, a) => a.findIndex((q) => q.k === p.k) === i).map((p) => powerChip(p, PP.power === p.k)).join('')}</div>` : ''}
        <button class="btn big pk-go ${locked && v.me.x === Math.round(PP.x) ? 'done' : ''}" id="pk-lock">${locked && v.me.x === Math.round(PP.x) && (v.me.power || null) === PP.power ? '✅ Locked in' : '🎯 Drop here!'}</button>
        <div class="pk-time">${BOX.timer(v.endsIn)}</div></div>`);
      for (const b of el.querySelectorAll('[data-pw]')) b.onclick = () => { PP.power = PP.power === b.dataset.pw ? null : b.dataset.pw; ctx.haptic('select'); ctx.redraw(); };
      el.querySelector('#pk-lock').onclick = async () => { const r = await ctx.act({ op: 'aim', x: Math.round(PP.x), power: PP.power }); if (r && r.ok) { ctx.haptic('success'); ctx.sfx('pop'); } };
      return after(el);
    }
    if (v.phase === 'draw') {
      const done = v.me.done, isEr = v.me.power === 'eraser';
      const others = (v.drops || []).filter((d) => !d.me);
      BOX.morph(el, `<div class="pk-phone">${head}<div class="pk-hint">${done ? '✅ Line locked. Waiting for the drop…' : `✏️ Draw one line (${2 - PP.strokes.length} stroke${PP.strokes.length === 1 ? '' : 's'} left)`}${v.me.power ? ` · ${esc(({ sticky: '🍯', big: '🎳', twin: '👯', eraser: '🧽', ink: '🖋️' })[v.me.power] || '')} on` : ''}</div>
        <div class="pk-inkbar"><span>🖋️ Ink</span><div class="pk-ink" id="pk-ink"><i></i></div><b id="pk-inkt"></b></div>${pad}
        ${isEr && !done ? `<div class="pk-pows-h">🧽 Erase whose line?</div><div class="pk-targets">${others.map((d) => `<button class="pk-tg ${PP.target === d.id ? 'on' : ''}" data-tg="${esc(d.id)}" style="--c:${esc(d.c)}">${esc(d.av || '')} ${esc(d.name)}</button>`).join('')}</div>` : ''}
        <div class="pk-tools"><button class="btn ghost" id="pk-undo" ${!PP.strokes.length || done ? 'disabled' : ''}>↶ Undo</button><button class="btn ghost" id="pk-redo" ${!PP.redo.length || done ? 'disabled' : ''}>↷ Redo</button><button class="btn ghost" id="pk-clear" ${!PP.strokes.length || done ? 'disabled' : ''}>🗑️</button></div>
        <button class="btn big pk-go ${done ? 'done' : ''}" id="pk-done">${done ? '✏️ Edit my line' : PP.strokes.length ? '✅ Done!' : '✅ No line this time'}</button>
        <div class="pk-time">${BOX.timer(v.endsIn)}</div></div>`);
      for (const b of el.querySelectorAll('[data-tg]')) b.onclick = () => { PP.target = b.dataset.tg; ctx.haptic('select'); sendLine(false); ctx.redraw(); };
      el.querySelector('#pk-undo').onclick = () => { const s = PP.strokes.pop(); if (s) { PP.redo.push(s); ctx.haptic('tap'); sendLine(false); ctx.redraw(); } };
      el.querySelector('#pk-redo').onclick = () => { const s = PP.redo.pop(); if (s && PP.strokes.length < 2 && inkUsed() + len(s) <= v.ink + 1) { PP.strokes.push(s); ctx.haptic('tap'); sendLine(false); } else if (s) { PP.redo.push(s); ctx.haptic('error'); } ctx.redraw(); };
      el.querySelector('#pk-clear').onclick = () => { PP.redo = PP.redo.concat(PP.strokes.reverse()); PP.strokes = []; ctx.haptic('buzz'); sendLine(false); ctx.redraw(); };
      el.querySelector('#pk-done').onclick = async () => { if (done) { await sendLine(false); ctx.haptic('tap'); return; } await sendLine(true); };
      after(el); inkMeter(); return;
    }
    if (v.phase === 'drop') {
      return BOX.morph(el, `<div class="pk-phone">${head}<div class="pk-hint big">👀 Watch the TV!</div>${v.erasedMine ? '<div class="pk-bad">🧽 Someone erased your line!</div>' : ''}${pad}</div>`), after(el);
    }
    if (v.phase === 'score') {
      if (v.sdOrder) return BOX.morph(el, `<div class="pk-phone">${head}<div class="pk-msg"><h3>${v.sdOrder[0] && v.sdOrder[0].id === (full && full.me && full.me.id) ? '🏆 You won the sudden death!' : 'Sudden death is over!'}</h3>${v.sdOrder.map((o, i) => `<p>${i + 1}. ${esc(o.name)}: ${esc(o.slot)}</p>`).join('')}</div></div>`);
      return BOX.morph(el, `<div class="pk-phone">${head}<div class="pk-gain ${v.gain < 0 ? 'neg' : v.gain >= 300 ? 'hot' : ''}">${v.gain > 0 ? '+' : ''}${v.gain}</div>${v.trick ? '<div class="pk-good">🎪 TRICK SHOT OF THE ROUND!</div>' : ''}
        <div class="pk-items">${(v.items || []).map((x) => `<div><span>${esc(x.t)}</span><b class="${x.v < 0 ? 'neg' : ''}">${x.v ? (x.v > 0 ? '+' : '') + x.v : ''}</b></div>`).join('') || '<div><span>No points this round</span></div>'}</div>
        <p class="pk-sub">You’re <b>#${v.rank}</b> of ${v.count}</p><div class="pk-mini">${pad}</div>${v.powers.length ? `<div class="pk-pows">${v.powers.map((p) => `<span class="pk-pwmini">${esc(p.icon)} ${esc(p.name)}</span>`).join('')}</div>` : ''}</div>`), after(el);
    }
    BOX.morph(el, `<div class="pk-phone">${head}</div>`);
  }
  function after(el) { phoneCanvas(el); drawPhone(); }

  BOX.games.plinko = {
    name: 'JustDrop', icon: '🎯',
    about: 'A Plinko-style peg drop: pick your spot, draw one line to bend everyone’s luck, and chase the jackpot.',
    how: [
      'Pick where to drop your ball along the top of the board.',
      'Then see where everyone else is dropping and draw ONE line (limited ink, 2 strokes max) to steer balls: yours into the jackpot, or a rival’s into a bust.',
      'Every ball drops at once. Slots pay points; ×2 doubles your round; STEAL robs the leader; BUST costs you.',
      'Lines pay their owner: 20% of any good slot a ball they touched lands in, +50 for every rival sent into a bust.',
      'Star pegs and 🎁 slots give power-ups: Sticky Ball, Mega Ball, Twin Drop, Eraser, Ink Refill.',
      'Each round the board gets harder and old lines stay as ghosts. Most money wins!',
    ],
    fx: { start: 'start', round: 'pop', aim: 'chime', draw: 'pop', drop: 'whoosh', score: 'chime', trick: 'cheer', sudden: 'drum', suddenWin: 'win', win: 'win' },
    music(s) { if (!s) return 'play'; if (s.phase === 'over') return 'finale'; if (s.phase === 'aim' || s.phase === 'draw') return 'think'; if (s.phase === 'score') return 'reveal'; if (s.phase === 'intro') return s.sudden ? 'tense' : 'play'; return 'play'; },
    lobbyTv,
    tv(el, s) { tvGame(el, s); },
    phone,
    _draw: { staticLayer, drawLive, drawBall, drawStroke, pal, rr, star, W, H, SLOT_TOP },
  };
})();
