'use strict';
// Color Match title screen: a paint studio after dark. Drops of paint fall and splat across the
// wall in every colour, a paint-chip fan opens and closes on the left, and a big hue ring turns on
// the right with a picker knob gliding round it. The logo is painted letter by letter.
(function () {
  const TAU = Math.PI * 2;
  const PAINT = ['#ff4f5e', '#ff8c42', '#ffd23f', '#3fd17a', '#3ee6ff', '#3ea6ff', '#8b6bff', '#ff4f9a'];
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
  const LETTERS = 'Color Match'.split('');
  BOX.titles.colormatch = {
    logo: LETTERS.map((ch, i) => (ch === ' ' ? ' ' : `<span style="--c:${['#ff4f5e', '#ff8c42', '#e0a800', '#2bb866', '#16b8d4', '', '#3ea6ff', '#8b6bff', '#ff4f9a', '#ff8c42', '#e0a800'][i]};--d:${(i * 0.08).toFixed(2)}s">${ch}</span>`)).join(''),
    tagline: 'A colour flashes for three seconds. Mix it from memory on your phone. Closest match wins!',
    start: '🖌️ Start mixing',
    meta: '2–20 players · 5–10 min',
    font: "'Lilita One', sans-serif",
    theme: { card: 'rgba(255, 255, 255, 0.97)', ink: '#16161b', muted: '#5d5d68', accent: '#ff4f9a', button: '#ffd23f', buttonInk: '#16161b', border: '#16161b' },
    css: `.bt-colormatch .bt-logo { font-weight: 400; letter-spacing: .01em; text-shadow: none; }
      .bt-colormatch .bt-logo span { display: inline-block; color: var(--c); -webkit-text-stroke: .025em #16161b; text-shadow: 0 .06em 0 #16161b; animation: cmTl 3.4s ease-in-out var(--d) infinite; }
      @keyframes cmTl { 0%, 72%, 100% { transform: none; } 82% { transform: translateY(-.12em) rotate(-5deg); } 91% { transform: translateY(.02em); } }
      .bt-colormatch .bt-card { border-width: 5px; border-radius: 26px; box-shadow: 0 14px 0 #16161b, 0 30px 70px rgba(0, 0, 0, .55); border-top: 16px solid; border-image: linear-gradient(90deg, #ff4f5e, #ff8c42, #ffd23f, #3fd17a, #3ee6ff, #3ea6ff, #8b6bff, #ff4f9a) 1; }
      .bt-colormatch .bt-go { box-shadow: 0 7px 0 #b58f00; border: 3px solid #16161b; }
      .bt-colormatch .bt-tag { font-family: 'Fredoka', sans-serif; font-weight: 500; }`,
    init(W, H) {
      const u = Math.max(0.6, Math.min(W / 1600, H / 900));
      return { u, splats: [], drops: [], next: 0, k: 0,
        motes: Array.from({ length: 26 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, s: (8 + Math.random() * 16) * u, v: (6 + Math.random() * 14) * u, c: PAINT[i % PAINT.length], r: Math.random() * TAU })) };
    },
    draw(g, W, H, t, S) {
      const u = S.u;
      const bg = g.createRadialGradient(W * 0.5, H * 0.45, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
      bg.addColorStop(0, '#2a2a31'); bg.addColorStop(1, '#141418'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // Drifting swatch squares.
      for (const m of S.motes) {
        m.y -= m.v / 60; m.r += 0.004; if (m.y < -40) { m.y = H + 40; m.x = Math.random() * W; }
        g.save(); g.translate(m.x, m.y); g.rotate(m.r); g.globalAlpha = 0.28; g.fillStyle = m.c; g.beginPath(); g.roundRect(-m.s / 2, -m.s / 2, m.s, m.s, m.s * 0.2); g.fill(); g.restore();
      }
      g.globalAlpha = 1;
      // Paint drops fall and splat onto the wall; splats slowly fade.
      if (t > S.next) {
        S.next = t + 0.55 + Math.random() * 0.6;
        const c = PAINT[S.k++ % PAINT.length], x = W * (0.06 + Math.random() * 0.88);
        S.drops.push({ x, y: -30, vy: 0, ty: H * (0.15 + Math.random() * 0.75), c });
      }
      for (const d of S.drops) {
        d.vy += 0.9 * u; d.y += d.vy;
        g.fillStyle = d.c; g.beginPath(); g.ellipse(d.x, d.y, 9 * u, 14 * u, 0, 0, TAU); g.fill();
        if (d.y >= d.ty) {
          d.dead = true;
          const n = 9 + Math.floor(Math.random() * 6), r = (34 + Math.random() * 40) * u;
          S.splats.push({ x: d.x, y: d.ty, c: d.c, born: t, r, lobes: Array.from({ length: n }, (_, i) => ({ a: (i / n) * TAU + Math.random() * 0.4, l: 0.75 + Math.random() * 0.5 })),
            dots: Array.from({ length: 7 }, () => ({ a: Math.random() * TAU, d: 1.4 + Math.random() * 1.4, s: 0.08 + Math.random() * 0.12 })) });
        }
      }
      S.drops = S.drops.filter((d) => !d.dead);
      S.splats = S.splats.filter((s) => t - s.born < 7);
      for (const s of S.splats) {
        const age = t - s.born, grow = easeOut(age / 0.25), fade = 1 - clamp01((age - 5) / 2);
        g.globalAlpha = 0.85 * fade; g.fillStyle = s.c; g.beginPath();
        s.lobes.forEach((lb, i) => { const rr = s.r * grow * lb.l, x = s.x + Math.cos(lb.a) * rr, y = s.y + Math.sin(lb.a) * rr * 0.85; if (i === 0) g.moveTo(x, y); else { const pa = s.lobes[i - 1].a, mid = (pa + lb.a) / 2; g.quadraticCurveTo(s.x + Math.cos(mid) * s.r * grow * 0.55, s.y + Math.sin(mid) * s.r * grow * 0.5, x, y); } });
        g.closePath(); g.fill();
        for (const d of s.dots) { g.beginPath(); g.arc(s.x + Math.cos(d.a) * s.r * d.d * grow, s.y + Math.sin(d.a) * s.r * d.d * grow * 0.85, s.r * d.s, 0, TAU); g.fill(); }
        // a drip running down
        const drip = Math.min(1, age / 3) * s.r * 1.4;
        g.beginPath(); g.roundRect(s.x - 5 * u, s.y, 10 * u, drip, 5 * u); g.fill(); g.beginPath(); g.arc(s.x, s.y + drip, 7 * u, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
      // The hue ring on the right with a knob gliding round it.
      const rx = W - Math.min(W * 0.16, 260 * u), ry = H * 0.42, R = Math.min(170 * u, W * 0.13), th = 30 * u, rot = t * 0.25;
      g.save(); g.translate(rx, ry);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(6 * u, 10 * u, R + th / 2 + 8 * u, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, R + th / 2 + 8 * u, 0, TAU); g.fill();
      for (let a = 0; a < 360; a += 3) { g.strokeStyle = `hsl(${a},95%,55%)`; g.lineWidth = th; g.beginPath(); g.arc(0, 0, R, (a - 1) * TAU / 360 + rot, (a + 3) * TAU / 360 + rot); g.stroke(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, R - th / 2 - 8 * u, 0, TAU); g.fill();
      const ka = t * 0.9, hue = (((ka - rot) * 360 / TAU) % 360 + 360) % 360;
      // inner swatch shows the hue under the knob
      g.fillStyle = `hsl(${hue},85%,55%)`; g.beginPath(); g.arc(0, 0, R - th / 2 - 22 * u, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(-R * 0.22, -R * 0.25, R * 0.18, R * 0.1, -0.6, 0, TAU); g.fill();
      g.lineWidth = 6 * u; g.strokeStyle = '#fff'; g.fillStyle = `hsl(${hue},95%,55%)`;
      g.beginPath(); g.arc(Math.cos(ka) * R, Math.sin(ka) * R, th * 0.7, 0, TAU); g.fill(); g.stroke();
      g.lineWidth = 2 * u; g.strokeStyle = '#16161b'; g.beginPath(); g.arc(Math.cos(ka) * R, Math.sin(ka) * R, th * 0.7 + 4 * u, 0, TAU); g.stroke();
      g.restore();
      // A paint-chip fan on the left, opening and closing.
      const fx = Math.min(W * 0.13, 220 * u), fy = H * 0.86, open = 0.5 + 0.5 * Math.sin(t * 0.7), cw = 64 * u, ch = 230 * u;
      for (let i = 0; i < 8; i++) {
        const a = -0.95 + i * (0.16 + 0.1 * open);
        g.save(); g.translate(fx, fy); g.rotate(a);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.roundRect(-cw / 2 + 4 * u, -ch + 6 * u, cw, ch, 8 * u); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.roundRect(-cw / 2, -ch, cw, ch, 8 * u); g.fill();
        const h = i * 45 + 5;
        for (let k = 0; k < 4; k++) { g.fillStyle = `hsl(${h},${80 - k * 8}%,${35 + k * 14}%)`; g.beginPath(); g.roundRect(-cw / 2 + 6 * u, -ch + 8 * u + k * 46 * u, cw - 12 * u, 40 * u, 4 * u); g.fill(); }
        g.restore();
      }
      g.fillStyle = '#c8963e'; g.beginPath(); g.arc(fx, fy - 14 * u, 12 * u, 0, TAU); g.fill(); g.fillStyle = '#16161b'; g.beginPath(); g.arc(fx, fy - 14 * u, 4 * u, 0, TAU); g.fill();
      // A brush sweeps a rainbow stroke along the bottom.
      const sw = (t * 0.22) % 1.4, x1 = W * Math.min(1, sw) , by = H * 0.95;
      const grad = g.createLinearGradient(0, 0, W, 0); PAINT.forEach((c, i) => grad.addColorStop(i / (PAINT.length - 1), c));
      g.globalAlpha = 1 - clamp01((sw - 1.15) / 0.25);
      g.strokeStyle = grad; g.lineCap = 'round'; g.lineWidth = 22 * u; g.beginPath();
      for (let x = 0; x <= x1; x += 16) g.lineTo(x, by + Math.sin(x / (90 * u)) * 6 * u);
      g.stroke(); g.globalAlpha = 1;
      if (sw < 1) { g.save(); g.translate(x1, by + Math.sin(x1 / (90 * u)) * 6 * u); g.rotate(-0.6); g.font = `${Math.round(54 * u)}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🖌️', 10 * u, -26 * u); g.restore(); }
    },
  };
})();
