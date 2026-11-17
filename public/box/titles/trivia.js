'use strict';
// Hot Take Trivia title screen: a neon quiz studio on fire. Answer tiles (▲ ◆ ● ■) drift up
// through the haze and flash when one turns out right, the Hot-o-meter on the left fills up
// from 1× to 3× and boils over in sparks, poker-style bet chips flip on the right, and a
// wall of flames licks along the bottom over a scrolling neon floor grid.
(function () {
  const TAU = Math.PI * 2;
  const COLS = ['#ff4d5e', '#3e8bff', '#ffb52e', '#22c97a'], SH = ['▲', '◆', '●', '■'], LET = ['A', 'B', 'C', 'D'];
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const ease = (x) => 1 - Math.pow(1 - clamp01(x), 3);
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function tile(g, x, y, s, i, rot, glow) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    if (glow > 0) { g.shadowColor = '#fff'; g.shadowBlur = 40 * glow; }
    g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, -60, -30, 120, 68, 16); g.fill();
    g.fillStyle = COLS[i]; rr(g, -60, -36, 120, 68, 16); g.fill();
    g.shadowBlur = 0;
    if (glow > 0) { g.strokeStyle = `rgba(255,255,255,${glow})`; g.lineWidth = 6; rr(g, -60, -36, 120, 68, 16); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.22)'; rr(g, -50, -26, 44, 48, 10); g.fill();
    g.fillStyle = '#fff'; g.font = '26px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(SH[i], -28, -6); g.font = '16px "Lilita One", sans-serif'; g.fillText(LET[i], -28, 14);
    g.fillStyle = 'rgba(255,255,255,0.75)'; rr(g, 4, -14, 44, 8, 4); g.fill(); rr(g, 4, 2, 30, 8, 4); g.fill();
    if (glow > 0.5) { g.font = '30px sans-serif'; g.fillText('✔', 40, -40); }
    g.restore();
  }
  function chip(g, x, y, r, n, flip) {
    const cols = { 1: ['#bfe9ff', '#2a7fc0'], 2: ['#ffc58a', '#d9531e'], 3: ['#ffd23f', '#ff3d2e'] }[n];
    g.save(); g.translate(x, y); g.scale(Math.max(0.05, Math.abs(Math.cos(flip))), 1);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, r * 0.18, r, r, 0, 0, TAU); g.fill();
    g.fillStyle = cols[1]; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.strokeStyle = cols[0]; g.lineWidth = r * 0.22; g.setLineDash([r * 0.38, r * 0.3]); g.beginPath(); g.arc(0, 0, r * 0.86, 0, TAU); g.stroke(); g.setLineDash([]);
    g.fillStyle = cols[0]; g.beginPath(); g.arc(0, 0, r * 0.62, 0, TAU); g.fill();
    g.fillStyle = '#2a0d55'; g.font = `${Math.round(r * 0.62)}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(n + '×', 0, r * 0.04);
    g.restore();
  }
  function flames(g, W, H, t, u) {
    const base = H + 10, layers = [['rgba(255,61,46,0.85)', 1, 0], ['rgba(255,138,0,0.9)', 0.72, 1.7], ['rgba(255,210,63,0.95)', 0.45, 3.1]];
    for (const [col, k, ph] of layers) {
      const pts = [], step = 34 * u;
      for (let x = -step; x <= W + step * 2; x += step) {
        const n = Math.sin(x * 0.011 + t * 2.6 + ph) * 0.5 + Math.sin(x * 0.027 - t * 3.7 + ph * 2) * 0.3 + Math.sin(x * 0.006 + t * 1.1) * 0.35;
        pts.push([x, base - Math.max(8 * u, (62 + 46 * n) * k * u * (1 + 0.18 * Math.sin(x * 0.04 + t * 7 + ph)))]);
      }
      g.fillStyle = col;
      g.beginPath(); g.moveTo(pts[0][0], base); g.lineTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; g.quadraticCurveTo(pts[i][0], pts[i][1] - 18 * u * k, mx, my); }
      g.lineTo(W + step * 2, base); g.closePath(); g.fill();
    }
  }
  function meter(g, x, y, h, u, t, S) {
    // The Hot-o-meter: a thermometer whose mercury rises 1× → 2× → 3× and boils over.
    const cyc = 6, p = (t % cyc) / cyc, fill = ease(p / 0.75), boil = p > 0.75 ? (p - 0.75) / 0.25 : 0;
    const w = 34 * u, bulb = 34 * u;
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.12)'; rr(g, x - w / 2 - 8 * u, y - 8 * u, w + 16 * u, h + 16 * u, w); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 4 * u; rr(g, x - w / 2, y, w, h, w / 2); g.stroke();
    g.beginPath(); g.arc(x, y + h + bulb * 0.6, bulb, 0, TAU); g.stroke();
    const gr = g.createLinearGradient(0, y + h, 0, y); gr.addColorStop(0, '#ff3d2e'); gr.addColorStop(0.6, '#ff8a00'); gr.addColorStop(1, '#ffd23f');
    g.fillStyle = gr; g.shadowColor = '#ff8a00'; g.shadowBlur = 20 * u;
    g.beginPath(); g.arc(x, y + h + bulb * 0.6, bulb - 6 * u, 0, TAU); g.fill();
    const top = y + h - (h - 10 * u) * fill;
    rr(g, x - w / 2 + 7 * u, top, w - 14 * u, y + h - top + 12 * u, (w - 14 * u) / 2); g.fill();
    g.shadowBlur = 0;
    g.font = `${Math.round(22 * u)}px "Lilita One", sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle';
    [['1×', 0.25, '#bfe9ff'], ['2×', 0.55, '#ffc58a'], ['3×', 0.88, '#ffd23f']].forEach(([lab, k, c]) => {
      const ty = y + h - (h - 10 * u) * k, lit = fill >= k;
      g.fillStyle = lit ? c : 'rgba(255,255,255,0.35)'; g.fillRect(x + w / 2 + 4 * u, ty - 2 * u, 12 * u, 4 * u);
      g.fillText(lab, x + w / 2 + 22 * u, ty);
    });
    g.textAlign = 'center'; g.fillStyle = '#ffd23f'; g.font = `${Math.round(18 * u)}px "Lilita One", sans-serif`;
    g.fillText('HOT-O-METER', x, y - 26 * u);
    if (boil > 0) {
      if (!S.boilAt || t - S.boilAt > cyc * 0.9) { S.boilAt = t; S.sparks = Array.from({ length: 26 }, () => ({ a: -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v: (120 + Math.random() * 260) * u, r: (2 + Math.random() * 4) * u })); }
      const k = t - S.boilAt;
      for (const s of S.sparks) {
        const sx = x + Math.cos(s.a) * s.v * k, sy = y + Math.sin(s.a) * s.v * k + 300 * u * k * k;
        g.globalAlpha = clamp01(1 - k / 1.4); g.fillStyle = Math.random() < 0.5 ? '#ffd23f' : '#ff6a2e';
        g.beginPath(); g.arc(sx, sy, s.r, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      g.font = `${Math.round(40 * u * (1 + 0.15 * Math.sin(t * 20)))}px "Segoe UI Emoji", sans-serif`; g.fillText('🔥', x, y - 60 * u);
    }
    g.restore();
  }

  BOX.titles.trivia = {
    logo: '<span class="h">HOT TAKE</span><span class="t">TRIVIA</span>',
    tagline: 'Know it? Bet on it. Pick your answer, then go 1×, 2× or 3× HOT TAKE.',
    start: '🔥 Start the show',
    meta: '2–16 players · 5–10 min',
    font: "'Lilita One', sans-serif",
    theme: { card: 'rgba(22, 8, 50, 0.88)', ink: '#fff4e6', muted: '#cbb8f0', accent: '#ffd23f', button: '#ff8a00', buttonInk: '#2a0d55', border: '#ff8a00' },
    css: `.bt-trivia .bt-logo { line-height: .9; display: flex; flex-direction: column; align-items: center; }
      .bt-trivia .bt-logo .h { font-size: 1.12em; background: linear-gradient(180deg, #fff3a0 0%, #ffd23f 22%, #ff8a00 55%, #ff3d2e 100%); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: none; filter: drop-shadow(0 5px 0 #5a1200) drop-shadow(0 0 24px rgba(255, 110, 20, .6)); animation: ttTitleFlick 2.6s ease-in-out infinite; }
      .bt-trivia .bt-logo .t { font-size: .62em; letter-spacing: .4em; margin-left: .4em; color: #3ee6ff; text-shadow: 0 0 8px #3ee6ff, 0 0 26px rgba(62, 230, 255, .7); animation: ttTitleNeon 4s steps(1) infinite; }
      @keyframes ttTitleFlick { 50% { filter: drop-shadow(0 5px 0 #5a1200) drop-shadow(0 0 40px rgba(255, 170, 20, .9)); } }
      @keyframes ttTitleNeon { 0%, 100% { opacity: 1; } 91% { opacity: .35; } 93% { opacity: 1; } 95% { opacity: .5; } }
      .bt-trivia .bt-card { box-shadow: 0 16px 0 rgba(0,0,0,.35), 0 0 0 3px #5a1f00, 0 0 80px rgba(255, 110, 20, .35); }
      .bt-trivia .bt-go { background: linear-gradient(180deg, #ffd23f, #ff8a00 60%, #ff3d2e); color: #2a0d55; box-shadow: 0 7px 0 #a33a00; font-family: 'Lilita One', sans-serif; }`,
    init(W, H) {
      const rnd = (a, b) => a + Math.random() * (b - a);
      const u = Math.max(0.55, Math.min(W / 1600, H / 900));
      return {
        u,
        tiles: Array.from({ length: 12 }, (_, i) => ({ x: rnd(0, 1), y: rnd(0, 1), v: rnd(0.025, 0.06), s: rnd(0.55, 1.05), r: rnd(-0.4, 0.4), vr: rnd(-0.25, 0.25), i: i % 4, ph: rnd(0, 20) })),
        embers: Array.from({ length: 70 }, () => ({ x: rnd(0, 1), y: rnd(0, 1), v: rnd(0.04, 0.14), r: rnd(1, 3.2), w: rnd(0, TAU) })),
        qs: Array.from({ length: 9 }, () => ({ x: rnd(0, 1), y: rnd(0, 1), v: rnd(0.01, 0.025), s: rnd(30, 70), ph: rnd(0, TAU) })),
        sparks: [], boilAt: 0,
      };
    },
    draw(g, W, H, t, S) {
      const u = S.u;
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b0320'); bg.addColorStop(0.55, '#24104f'); bg.addColorStop(1, '#3a0e2e');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const glow = g.createRadialGradient(W / 2, H * 1.05, 0, W / 2, H * 1.05, W * 0.7); glow.addColorStop(0, 'rgba(255,110,20,0.55)'); glow.addColorStop(1, 'rgba(255,110,20,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      // studio light beams
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 4; k++) {
        const sx = W * (0.15 + k * 0.23), a = Math.PI / 2 + Math.sin(t * 0.4 + k * 1.7) * 0.35, len = H * 1.2, sp = 0.09;
        const cg = g.createLinearGradient(sx, 0, sx + Math.cos(a) * len, Math.sin(a) * len); cg.addColorStop(0, ['rgba(255,77,94,0.22)', 'rgba(62,139,255,0.22)', 'rgba(255,181,46,0.22)', 'rgba(34,201,122,0.22)'][k]); cg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = cg; g.beginPath(); g.moveTo(sx, -10); g.lineTo(sx + Math.cos(a - sp) * len, Math.sin(a - sp) * len); g.lineTo(sx + Math.cos(a + sp) * len, Math.sin(a + sp) * len); g.closePath(); g.fill();
      }
      g.restore();
      // neon floor grid
      const hz = H * 0.66;
      g.save(); g.beginPath(); g.rect(0, hz, W, H - hz); g.clip();
      g.strokeStyle = 'rgba(255,120,40,0.45)'; g.lineWidth = 2;
      for (let i = -16; i <= 16; i++) { g.beginPath(); g.moveTo(W / 2 + i * W * 0.03, hz); g.lineTo(W / 2 + i * W * 0.16, H); g.stroke(); }
      const off = (t * 0.35) % 1;
      for (let j = 0; j < 9; j++) { const k = (j + off) / 9, y = hz + (H - hz) * k * k; g.globalAlpha = 0.25 + 0.6 * k; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.restore(); g.globalAlpha = 1;
      // floating question marks
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const q of S.qs) {
        q.y -= q.v / 60; if (q.y < -0.1) { q.y = 1.1; q.x = Math.random(); }
        g.globalAlpha = 0.12 + 0.08 * Math.sin(t + q.ph); g.fillStyle = '#cbb8f0'; g.font = `${Math.round(q.s * u)}px "Lilita One", sans-serif`;
        g.fillText('?', q.x * W + Math.sin(t * 0.7 + q.ph) * 20 * u, q.y * H);
      }
      g.globalAlpha = 1;
      // drifting answer tiles; every so often one lights up as the right answer
      for (const k of S.tiles) {
        k.y -= k.v / 60; k.r += k.vr / 60;
        if (k.y < -0.12) { k.y = 1.08; k.x = Math.random(); }
        const glowK = Math.max(0, Math.sin((t + k.ph) * 0.9)) ** 18;
        g.globalAlpha = 0.5 + 0.5 * glowK;
        tile(g, k.x * W, k.y * H, k.s * u, k.i, k.r, glowK);
      }
      g.globalAlpha = 1;
      // the Hot-o-meter (left) and the bet chips (right)
      const mh = Math.min(H * 0.42, 380 * u);
      meter(g, Math.max(70 * u, W * 0.09), H * 0.5 - mh / 2, mh, u, t, S);
      const cx = W - Math.max(90 * u, W * 0.1), cy = H * 0.5;
      for (let n = 1; n <= 3; n++) {
        const hop = Math.max(0, Math.sin(t * 2.2 - n * 0.9)) ** 3;
        chip(g, cx + (n - 2) * 34 * u, cy + (n - 2) * 110 * u - hop * 40 * u, 46 * u * (n === 3 ? 1.15 : 1), n, hop * Math.PI);
      }
      g.fillStyle = '#ffd23f'; g.font = `${Math.round(18 * u)}px "Lilita One", sans-serif`; g.fillText('PLACE YOUR BETS', cx, cy - 200 * u);
      // embers and the wall of flames
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const e of S.embers) {
        e.y -= e.v / 60; e.w += 0.03; if (e.y < -0.02) { e.y = 1.02; e.x = Math.random(); }
        g.globalAlpha = clamp01((e.y - 0.1) * 1.4);
        g.fillStyle = e.r > 2.4 ? '#ffd23f' : '#ff6a2e'; g.beginPath(); g.arc(e.x * W + Math.sin(e.w) * 14 * u, e.y * H, e.r * u, 0, TAU); g.fill();
      }
      g.restore(); g.globalAlpha = 1;
      flames(g, W, H, t, u);
    },
  };
})();
