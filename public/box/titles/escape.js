'use strict';
// JustEscape title screen: a rainy back alley at night. A heavy door wrapped in chains and
// padlocks, its keyhole glowing gold; a gas lamp with a magpie perched on top; wet cobbles
// reflecting the light; rain, and now and then a flash of lightning. Film-noir blue and gold.
(function () {
  const TAU = Math.PI * 2;
  const GOLD = '#e8b44a', OUT = '#0a0b10';
  function lock(g, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    g.lineWidth = 7; g.strokeStyle = '#9a9caa'; g.beginPath(); g.arc(0, -14, 14, Math.PI, TAU); g.lineTo(14, 0); g.moveTo(-14, -14); g.lineTo(-14, 0); g.stroke();
    g.fillStyle = '#c99a3a'; g.beginPath(); g.roundRect(-22, -4, 44, 36, 6); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(-18, 0, 6, 26);
    g.fillStyle = OUT; g.beginPath(); g.arc(0, 10, 5, 0, TAU); g.fill(); g.fillRect(-2, 10, 4, 12);
    g.restore();
  }
  function chain(g, x1, y1, x2, y2, s) {
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.max(2, Math.floor(d / (18 * s))), a = Math.atan2(y2 - y1, x2 - x1);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n, x = x1 + (x2 - x1) * u, y = y1 + (y2 - y1) * u + Math.sin(u * Math.PI) * 10 * s;
      g.save(); g.translate(x, y); g.rotate(a + (i % 2 ? Math.PI / 2 : 0) * 0.0);
      g.lineWidth = 5 * s; g.strokeStyle = OUT; g.beginPath(); g.ellipse(0, 0, 13 * s, (i % 2 ? 4 : 8) * s, 0, 0, TAU); g.stroke();
      g.lineWidth = 3.2 * s; g.strokeStyle = i % 2 ? '#6f7280' : '#a4a7b4'; g.stroke(); g.restore();
    }
  }
  BOX.titles.escape = {
    logo: '<span class="a">Just</span><span class="b">Escape</span>',
    tagline: 'A detective needs your help. Every phone holds a clue.',
    start: '▶ Take the case', meta: '1–12 players · best 2–6 · 15–45 min',
    font: "'Abril Fatface', serif",
    theme: { card: 'rgba(11, 13, 20, 0.88)', ink: '#f4ead5', muted: '#a9b8c8', accent: GOLD, button: GOLD, buttonInk: '#1a1206', border: '#3a4560' },
    css: `.bt-escape .bt-logo { font-size: clamp(54px, 8.5vw, 108px); line-height: 1; letter-spacing: 1px; }
      .bt-escape .bt-logo .a { font-family: 'Pacifico', cursive; font-size: 0.72em; color: #ffe2a0; margin-right: 0.12em; text-shadow: 0 0 10px rgba(232,180,74,0.9), 0 0 28px rgba(232,180,74,0.6); }
      .bt-escape .bt-logo .b { color: #fff1f0; text-shadow: 0 0 8px #ff3048, 0 0 22px #c8102e, 0 0 46px rgba(200,16,46,0.6); animation: bteBuzz 6s steps(1) infinite; }
      @keyframes bteBuzz { 0%, 61%, 63%, 65%, 100% { opacity: 1; } 62%, 64% { opacity: 0.35; } }
      .bt-escape .bt-tag { font-family: 'Special Elite', monospace; letter-spacing: 0.5px; }
      .bt-escape .bt-card { box-shadow: 0 0 0 3px #3a4560, 0 0 0 7px #0b0d14, 0 30px 70px rgba(0, 0, 0, 0.7); }`,
    init(W, H) {
      const drops = Array.from({ length: Math.round(W * H / 4500) }, () => ({ x: Math.random() * W * 1.2, y: Math.random() * H, l: 14 + Math.random() * 22, v: 700 + Math.random() * 500 }));
      const bricks = []; for (let y = 0, r = 0; y < H * 0.78; y += 34, r++) for (let x = (r % 2) * -40; x < W; x += 80) bricks.push([x, y, Math.random()]);
      return { drops, bricks, splash: [], last: 0, flash: 0, nextFlash: 3 + Math.random() * 4 };
    },
    draw(g, W, H, t, S) {
      const dt = Math.min(0.05, t - (S.last || t)); S.last = t;
      if (t > S.nextFlash) { S.flash = 1; S.nextFlash = t + 6 + Math.random() * 6; }
      S.flash = Math.max(0, S.flash - dt * 2.4); const fl = S.flash > 0.6 ? 1 : S.flash > 0.4 ? 0.2 : S.flash;
      const ground = H * 0.78, u = Math.min(W, H * 1.6) / 1000; // scale unit
      // night sky strip, brick wall
      let gr = g.createLinearGradient(0, 0, 0, ground); gr.addColorStop(0, '#0d1220'); gr.addColorStop(1, '#1a2133'); g.fillStyle = gr; g.fillRect(0, 0, W, ground);
      for (const [x, y, c] of S.bricks) { g.fillStyle = `rgba(${70 + c * 30},${40 + c * 14},${44 + c * 12},0.28)`; g.fillRect(x + 2, y + 2, 76, 30); }
      // wet street
      gr = g.createLinearGradient(0, ground, 0, H); gr.addColorStop(0, '#141a28'); gr.addColorStop(1, '#07090f'); g.fillStyle = gr; g.fillRect(0, ground, W, H - ground);
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, ground, W, 6 * u);
      // the door (left)
      const dw = 230 * u, dh = 400 * u, dx = Math.max(dw * 0.2, W * 0.15 - dw / 2), dy = ground - dh;
      g.fillStyle = '#1e1712'; g.fillRect(dx - 22 * u, dy - 26 * u, dw + 44 * u, dh + 26 * u);
      gr = g.createLinearGradient(dx, 0, dx + dw, 0); gr.addColorStop(0, '#3a2a1c'); gr.addColorStop(0.5, '#5a4128'); gr.addColorStop(1, '#2e2116'); g.fillStyle = gr; g.fillRect(dx, dy, dw, dh);
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 3 * u; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(dx + (dw / 5) * i, dy); g.lineTo(dx + (dw / 5) * i, ground); g.stroke(); }
      g.fillStyle = '#2a2c34'; for (const yy of [0.18, 0.78]) g.fillRect(dx - 6 * u, dy + dh * yy, dw + 12 * u, 16 * u);
      g.lineWidth = 4 * u; g.strokeStyle = OUT; g.strokeRect(dx, dy, dw, dh);
      // keyhole glow
      const kx = dx + dw * 0.78, ky = dy + dh * 0.52, pulse = 0.75 + 0.25 * Math.sin(t * 2.2);
      gr = g.createRadialGradient(kx, ky, 2, kx, ky, 120 * u); gr.addColorStop(0, `rgba(255,205,110,${0.55 * pulse})`); gr.addColorStop(1, 'rgba(255,205,110,0)'); g.fillStyle = gr; g.fillRect(kx - 130 * u, ky - 130 * u, 260 * u, 260 * u);
      g.fillStyle = '#b8862e'; g.beginPath(); g.ellipse(kx, ky + 8 * u, 18 * u, 32 * u, 0, 0, TAU); g.fill(); g.lineWidth = 2.5 * u; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = `rgba(255,230,150,${pulse})`; g.beginPath(); g.arc(kx, ky, 7 * u, 0, TAU); g.fill(); g.beginPath(); g.moveTo(kx - 4 * u, ky + 2 * u); g.lineTo(kx + 4 * u, ky + 2 * u); g.lineTo(kx + 6 * u, ky + 24 * u); g.lineTo(kx - 6 * u, ky + 24 * u); g.fill();
      // chains crossing the door, padlocks hanging off them
      chain(g, dx - 10 * u, dy + dh * 0.12, dx + dw + 10 * u, dy + dh * 0.9, u);
      chain(g, dx + dw + 10 * u, dy + dh * 0.12, dx - 10 * u, dy + dh * 0.9, u);
      chain(g, dx - 12 * u, dy + dh * 0.42, dx + dw + 12 * u, dy + dh * 0.42, u);
      lock(g, dx + dw * 0.5, dy + dh * 0.5, 1.15 * u, Math.sin(t * 1.3) * 0.08);
      lock(g, dx + dw * 0.22, dy + dh * 0.47, 0.85 * u, 0.2 + Math.sin(t * 1.1 + 1) * 0.06);
      lock(g, dx + dw * 0.4, dy + dh * 0.76, 0.9 * u, -0.15 + Math.sin(t * 1.7 + 2) * 0.06);
      // the gas lamp (right) with the magpie on top
      const lx = Math.min(W - 70 * u, W * 0.87), ltop = Math.max(ground - 470 * u, H * 0.2);
      gr = g.createRadialGradient(lx, ltop + 40 * u, 10, lx, ltop + 40 * u, 340 * u); gr.addColorStop(0, 'rgba(255,214,140,0.38)'); gr.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = gr; g.fillRect(lx - 360 * u, ltop - 320 * u, 720 * u, 720 * u);
      g.fillStyle = '#15171f'; g.fillRect(lx - 7 * u, ltop + 60 * u, 14 * u, ground - ltop - 60 * u); g.fillRect(lx - 22 * u, ground - 30 * u, 44 * u, 30 * u);
      g.beginPath(); g.moveTo(lx - 30 * u, ltop); g.lineTo(lx + 30 * u, ltop); g.lineTo(lx + 20 * u, ltop + 66 * u); g.lineTo(lx - 20 * u, ltop + 66 * u); g.closePath(); g.fillStyle = '#ffe3a0'; g.fill(); g.lineWidth = 5 * u; g.strokeStyle = '#15171f'; g.stroke();
      g.fillStyle = '#15171f'; g.beginPath(); g.moveTo(lx - 40 * u, ltop + 2 * u); g.lineTo(lx, ltop - 26 * u); g.lineTo(lx + 40 * u, ltop + 2 * u); g.fill();
      // magpie silhouette (white belly, long tail), bobbing its head
      g.save(); g.translate(lx + 4 * u, ltop - 30 * u); g.scale(1.35 * u, 1.35 * u);
      g.fillStyle = '#05060a'; g.beginPath(); g.moveTo(12, 0); g.lineTo(58, 20); g.lineTo(54, 26); g.lineTo(8, 10); g.fill();
      g.beginPath(); g.ellipse(-4, -2, 22, 13, -0.2, 0, TAU); g.fill();
      const bob = Math.sin(t * 1.4) > 0.85 ? 4 : 0; g.beginPath(); g.arc(-24, -16 + bob, 10, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-32, -18 + bob); g.lineTo(-46, -14 + bob); g.lineTo(-32, -11 + bob); g.fill();
      g.fillStyle = '#e8e8ee'; g.beginPath(); g.ellipse(-8, 3, 11, 6, -0.2, 0, TAU); g.fill();
      g.fillStyle = '#2d5f8a'; g.beginPath(); g.ellipse(6, -4, 12, 5, -0.2, 0, TAU); g.fill();
      g.fillStyle = GOLD; g.beginPath(); g.arc(-27, -18 + bob, 2.2, 0, TAU); g.fill();
      g.restore();
      // reflections on the wet street
      g.save(); g.globalAlpha = 0.22; g.fillStyle = '#ffd98a'; g.fillRect(lx - 14 * u, ground + 10 * u, 28 * u, (H - ground) * 0.8); g.fillStyle = '#ffcf70'; g.fillRect(kx - 5 * u, ground + 8 * u, 10 * u, (H - ground) * 0.5); g.restore();
      g.strokeStyle = 'rgba(160,190,220,0.12)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { const y = ground + (H - ground) * (0.2 + i * 0.14); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y + 6); g.stroke(); }
      // rain + splashes
      g.strokeStyle = 'rgba(170,200,230,0.38)'; g.lineWidth = 1.5; g.beginPath();
      for (const d of S.drops) {
        d.y += d.v * dt; d.x -= d.v * dt * 0.15;
        if (d.y > ground + Math.random() * (H - ground)) { if (S.splash.length < 60) S.splash.push({ x: d.x, y: d.y, life: 0.3 }); d.y = -20 - Math.random() * 60; d.x = Math.random() * W * 1.2; }
        g.moveTo(d.x, d.y); g.lineTo(d.x + d.l * 0.15, d.y - d.l);
      }
      g.stroke();
      g.strokeStyle = 'rgba(170,200,230,0.4)'; for (const p of S.splash) { p.life -= dt; const r = (0.3 - p.life) * 30; g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.3, 0, 0, TAU); g.stroke(); }
      S.splash = S.splash.filter((p) => p.life > 0);
      // lightning wash and a vignette
      if (fl > 0) { g.fillStyle = `rgba(200,220,255,${fl * 0.28})`; g.fillRect(0, 0, W, H); }
      gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    },
  };
})();
