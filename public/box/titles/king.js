'use strict';
// Kill the King title screen (format: public/box/title.js): the castle at dusk with a crown on a
// cushion and a dagger hovering over it, goblin torches swarming on the hills, banners in the wind.
(function () {
  const TAU = Math.PI * 2, OUT = '#1a0b12';
  BOX.titles.king = {
    logo: '<span class="a">Kill the</span> <span class="b">King</span><span class="kk-tr">TRIAL</span>',
    tagline: 'Defend the castle together. Climb the ladder alone. Seize the crown if you dare.',
    start: '👑 Open the court', meta: '4–12 players · best 5–10 · 15–30 min · TRIAL game',
    font: "'Cinzel Decorative', 'Cinzel', serif",
    theme: { card: 'rgba(30, 14, 40, 0.86)', ink: '#f4ecff', muted: '#d9c6f0', accent: '#e0b84a', button: '#e0b84a', buttonInk: '#2a160c', border: '#8e1b2e' },
    css: `.bt-king .bt-logo .a { color: #f4ecff; font-size: 0.62em; display: block; } .bt-king .bt-logo .b { color: #e0b84a; text-shadow: 0 0 24px rgba(224,184,74,0.6), 0 5px 0 #000; }
      .bt-king .bt-logo .kk-tr { display: inline-block; margin-left: 14px; vertical-align: top; font: 700 18px/1 'Fredoka', sans-serif; letter-spacing: 0.12em; color: #2a160c; background: repeating-linear-gradient(135deg, #ffd23f 0 8px, #ffb000 8px 16px); padding: 5px 9px; border-radius: 6px; border: 2px solid #2a160c; transform: rotate(-6deg); }
      .bt-king .bt-tag { font-family: 'MedievalSharp', serif; }`,
    init(W, H) {
      let s = 7; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
      return { stars: Array.from({ length: 80 }, () => [r(), r() * 0.55, 0.6 + r() * 1.6, r() * 6]), torches: Array.from({ length: 50 }, () => [r(), r(), r() * 6]) };
    },
    draw(g, W, H, t, S) {
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#120a26'); gr.addColorStop(0.6, '#5a2550'); gr.addColorStop(1, '#d9774a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (const [x, y, r, p] of S.stars) { g.globalAlpha = 0.4 + 0.4 * Math.sin(t * 1.4 + p); g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(x * W, y * H, r, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      const k = Math.min(W / 1920, H / 1080) * 1.1;
      g.fillStyle = '#f6e7b8'; g.beginPath(); g.arc(W * 0.8, H * 0.18, 60 * k, 0, TAU); g.fill();
      g.fillStyle = '#3a1f3e'; g.beginPath(); g.moveTo(0, H * 0.75); for (let x = 0; x <= W; x += 30) g.lineTo(x, H * 0.72 - Math.sin(x / W * 6) * 50 * k - Math.sin(x / 70) * 8 * k); g.lineTo(W, H); g.lineTo(0, H); g.fill();
      for (const [a, b, p] of S.torches) { const x = W * (0.55 + a * 0.45) + Math.sin(t * 0.7 + p) * 8, y = H * (0.74 + b * 0.16); g.globalAlpha = 0.55 + 0.45 * Math.sin(t * 6 + p); g.fillStyle = '#ffb02e'; g.beginPath(); g.arc(x, y, 4 * k + 1, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      // castle (left)
      g.fillStyle = '#1d1028'; g.strokeStyle = OUT;
      for (const [x, w, h, f] of [[0.02, 0.07, 0.5, 0], [0.11, 0.09, 0.62, 1], [0.22, 0.07, 0.48, 2]]) {
        const X = W * x, Wd = W * w, Hh = H * h, top = H * 0.92 - Hh;
        g.fillRect(X, top, Wd, Hh); for (let i = 0; i < 4; i++) g.fillRect(X + i * Wd / 4 + 3, top - 20 * k, Wd / 4 - 7, 20 * k);
        g.fillStyle = '#ffcf6a'; g.fillRect(X + Wd / 2 - 8 * k, top + 60 * k, 16 * k, 26 * k); g.fillStyle = '#1d1028';
        g.fillStyle = '#b8233a'; g.beginPath(); g.moveTo(X + Wd / 2, top - 90 * k); g.lineTo(X + Wd / 2 + (50 + Math.sin(t * 3 + f) * 8) * k, top - 78 * k); g.lineTo(X + Wd / 2, top - 64 * k); g.fill(); g.fillStyle = '#1d1028';
        g.fillRect(X + Wd / 2 - 2, top - 92 * k, 4, 74 * k);
      }
      g.fillRect(0, H * 0.62, W * 0.3, H * 0.4);
      // the crown on its cushion with a dagger hovering above (bottom right of the card area)
      const cx = W * 0.84, cy = H * 0.62 + Math.sin(t * 1.2) * 6 * k;
      g.save(); g.translate(cx, cy); g.scale(k, k); g.lineWidth = 6; g.lineJoin = 'round';
      g.fillStyle = '#8e1b2e'; g.beginPath(); g.ellipse(0, 60, 130, 36, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#e0b84a'; g.beginPath(); g.moveTo(-80, 40); g.lineTo(-92, -40); g.lineTo(-44, 0); g.lineTo(0, -60); g.lineTo(44, 0); g.lineTo(92, -40); g.lineTo(80, 40); g.closePath(); g.fill(); g.stroke();
      for (const [x, c] of [[-46, '#3fd0ff'], [0, '#e8424f'], [46, '#9be36b']]) { g.fillStyle = c; g.beginPath(); g.arc(x, 18, 11, 0, TAU); g.fill(); g.stroke(); }
      const dy = -170 + Math.sin(t * 2) * 12; g.save(); g.translate(0, dy); g.rotate(0.06);
      g.fillStyle = '#d4dade'; g.beginPath(); g.moveTo(-12, 0); g.lineTo(0, 90); g.lineTo(12, 0); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#e0b84a'; g.fillRect(-36, -12, 72, 14); g.strokeRect(-36, -12, 72, 14);
      g.fillStyle = '#5a2c18'; g.fillRect(-8, -60, 16, 48); g.strokeRect(-8, -60, 16, 48);
      g.fillStyle = '#e8424f'; g.beginPath(); g.arc(0, -66, 10, 0, TAU); g.fill(); g.stroke();
      g.restore(); g.restore();
    },
  };
})();
