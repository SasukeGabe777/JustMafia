'use strict';
// JustDrop title screen: a glowing casino peg wall. Balls in every colour cascade through the
// pegs (each peg flashes when hit), land in the slot row, and the jackpot slot erupts in gold
// when one finds it. Marquee bulbs chase around the edge; neon light sweeps the velvet.
(function () {
  const TAU = Math.PI * 2;
  const COLS = ['#ff5a5f', '#ffb400', '#00d0b5', '#7b61ff', '#ff7ac6', '#3ec1ff', '#8bd346', '#ff8c42'];
  const SLOTS = [['25', '#7a1630'], ['100', '#5e0f24'], ['BUST', '#16121a'], ['250', '#7a1630'], ['JACKPOT', '#ffd23f'], ['×2', '#1f9e5c'], ['150', '#7a1630'], ['BUST', '#16121a'], ['50', '#5e0f24']];
  function shade(hex, k) { const n = parseInt(hex.slice(1), 16), f = (c) => Math.round(c * (1 + k)); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; }
  function ball(g, x, y, r, c) {
    g.save(); g.shadowColor = c; g.shadowBlur = r * 1.4;
    const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.28, c); gr.addColorStop(1, shade(c, -0.6));
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
  }
  BOX.titles.plinko = {
    logo: '<span class="a">Just</span><span class="b">Drop</span>',
    tagline: 'Pick your spot. Draw one line. Let it drop.',
    start: '▶ Insert coin', meta: '1–100 players · best 2–10 · 8–15 min',
    font: "'Bungee', 'Lilita One', sans-serif",
    theme: { card: 'rgba(28, 4, 30, 0.86)', ink: '#fff4d6', muted: '#ffc9df', accent: '#ffd166', button: '#ff2f7d', buttonInk: '#fff', border: '#d4a73c' },
    css: `.bt-plinko .bt-logo { font-size: clamp(56px, 9vw, 110px); line-height: 0.95; }
      .bt-plinko .bt-logo .a { color: #fff4d6; text-shadow: 0 5px 0 #6d0530; }
      .bt-plinko .bt-logo .b { color: #ffd23f; text-shadow: 0 6px 0 #a3104a, 0 0 34px rgba(255, 210, 63, 0.75); animation: btpDrop 2.6s cubic-bezier(.3, 1.6, .5, 1) infinite; display: inline-block; }
      @keyframes btpDrop { 0%, 70% { transform: translateY(0); } 78% { transform: translateY(10px) scaleY(0.9); } 86% { transform: translateY(-4px); } 100% { transform: translateY(0); } }
      .bt-plinko .bt-card { box-shadow: 0 0 0 4px #5a3a08, 0 0 60px rgba(255, 47, 125, 0.45); }`,
    init(W, H) {
      const top = H * 0.1, bot = H * 0.8, rows = Math.max(9, Math.round((bot - top) / 46)), sx = Math.max(46, W / 26);
      const pegs = [];
      for (let r = 0; r < rows; r++) { const y = top + ((bot - top) * r) / (rows - 1), off = r % 2 ? sx / 2 : 0; for (let x = off + sx / 2; x < W - 6; x += sx) pegs.push({ x, y, hit: -9 }); }
      const slotW = W / SLOTS.length;
      return { pegs, sx, top, bot, slotW, balls: [], next: 0, parts: [], jack: -9, last: 0 };
    },
    draw(g, W, H, t, S) {
      const dt = Math.min(0.05, t - (S.last || t)); S.last = t;
      // velvet + sweeping neon
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#3a0a26'); gr.addColorStop(1, '#0d0210'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 3; for (let x = 10; x < W; x += 34) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (const [k, c] of [[0, '255,47,125'], [1, '62,230,255']]) { const x = W * (0.5 + 0.45 * Math.sin(t * 0.35 + k * 2.4)); gr = g.createRadialGradient(x, H * 0.4, 10, x, H * 0.4, W * 0.35); gr.addColorStop(0, `rgba(${c},0.18)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
      // slots
      const sy = S.bot + 30;
      SLOTS.forEach(([lab, c], i) => {
        const x = i * S.slotW, jk = lab === 'JACKPOT', flash = jk ? Math.max(0, 1 - (t - S.jack) / 1.2) : 0;
        g.fillStyle = c; g.fillRect(x, sy, S.slotW, H - sy);
        if (jk) { g.fillStyle = `rgba(255,255,255,${0.15 + 0.15 * Math.sin(t * 6) + flash * 0.6})`; g.fillRect(x, sy, S.slotW, H - sy); }
        g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(x - 2, sy, 4, H - sy);
        g.font = `${Math.min(34, S.slotW * (lab.length > 4 ? 0.17 : 0.3))}px Bungee, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = jk ? '#3a2300' : '#fff'; g.fillText(lab, x + S.slotW / 2, sy + (H - sy) / 2);
      });
      // spawn balls
      if (t > S.next && S.balls.length < 26) { S.next = t + 0.22 + Math.random() * 0.35; S.balls.push({ x: W * (0.1 + Math.random() * 0.8), y: -20, vx: (Math.random() - 0.5) * 40, vy: 0, r: 9 + Math.random() * 5, c: COLS[Math.floor(Math.random() * COLS.length)] }); }
      // pegs
      for (const p of S.pegs) {
        const f = Math.max(0, 1 - (t - p.hit) / 0.35);
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.arc(p.x + 2, p.y + 3, 6, 0, TAU); g.fill();
        if (f > 0) { g.save(); g.shadowColor = '#ffd166'; g.shadowBlur = 24 * f; g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y, 6 + 6 * f, 0, TAU); g.fill(); g.restore(); }
        g.fillStyle = '#ffe7a8'; g.beginPath(); g.arc(p.x, p.y, 6, 0, TAU); g.fill();
      }
      // physics (just for show)
      const steps = 3, h = dt / steps;
      for (const b of S.balls) {
        for (let s = 0; s < steps; s++) {
          b.vy += 900 * h; b.x += b.vx * h; b.y += b.vy * h;
          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.6; } if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.6; }
          if (b.y > S.top - 20 && b.y < S.bot + 20) for (const p of S.pegs) {
            const dx = b.x - p.x, dy = b.y - p.y, rr = b.r + 6, d2 = dx * dx + dy * dy; if (d2 >= rr * rr || d2 === 0) continue;
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d; b.x = p.x + nx * rr; b.y = p.y + ny * rr;
            const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; b.vx += (Math.random() - 0.5) * 20; p.hit = t; }
          }
        }
        if (b.y > sy + 10 && !b.done) {
          b.done = true; const i = Math.min(SLOTS.length - 1, Math.max(0, Math.floor(b.x / S.slotW)));
          if (SLOTS[i][0] === 'JACKPOT') { S.jack = t; for (let k = 0; k < 40; k++) { const a = Math.random() * TAU, v = 150 + Math.random() * 450; S.parts.push({ x: b.x, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 300, t, c: k % 2 ? '#ffe14d' : '#fff' }); } }
          else for (let k = 0; k < 8; k++) { const a = Math.random() * TAU, v = 80 + Math.random() * 200; S.parts.push({ x: b.x, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 150, t, c: b.c }); }
        }
        // trail
        g.globalAlpha = 0.25; ball(g, b.x - b.vx * 0.02, b.y - b.vy * 0.02, b.r * 0.8, b.c); g.globalAlpha = 1;
        ball(g, b.x, b.y, b.r, b.c);
      }
      S.balls = S.balls.filter((b) => b.y < H + 30);
      S.parts = S.parts.filter((q) => t - q.t < 1.4);
      for (const q of S.parts) { const a = t - q.t; g.globalAlpha = 1 - a / 1.4; g.fillStyle = q.c; g.fillRect(q.x + q.vx * a - 4, q.y + q.vy * a + 500 * a * a - 4, 8, 8); }
      g.globalAlpha = 1;
      // chasing marquee bulbs
      const n = Math.round((W + H) / 30);
      for (let i = 0; i < n * 2; i++) {
        const u = i / (n * 2), per = 2 * (W + H), d = u * per; let x, y;
        if (d < W) { x = d; y = 8; } else if (d < W + H) { x = W - 8; y = d - W; } else if (d < 2 * W + H) { x = W - (d - W - H); y = H - 8; } else { x = 8; y = H - (d - 2 * W - H); }
        const on = (i + Math.floor(t * 7)) % 3 === 0;
        g.fillStyle = on ? '#fff6c8' : 'rgba(255,230,160,0.3)'; g.beginPath(); g.arc(x, y, on ? 6 : 4, 0, TAU); g.fill();
      }
    },
  };
})();
