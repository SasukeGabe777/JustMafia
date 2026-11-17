'use strict';
// Quick Draw title screen: high noon on Main Street. Two gunslingers stand off under a blazing
// sun while a tumbleweed rolls past and chickens scuttle through; every few seconds the town
// bell rings, the screen flashes DRAW!, both slingers draw and one hat goes flying.
// Uses the shared western art in BOX.qdArt (public/box/games/quickdraw.js).
(function () {
  const TAU = Math.PI * 2, PER = 6.5;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  BOX.titles.quickdraw = {
    logo: '<span class="a">QUICK</span><span class="b">DRAW</span>',
    tagline: 'Wait for it… wait for it… DRAW! The fastest thumb in the West wins.',
    start: '▶ Ride into town', meta: '2–100 players · best 2–20 · 5–8 min',
    font: "'Abril Fatface', serif",
    theme: { card: 'rgba(40, 18, 6, 0.86)', ink: '#fff4d6', muted: '#ffe2b0', accent: '#f2b632', button: '#f2b632', buttonInk: '#3a1d0c', border: '#2a160a' },
    css: `.bt-quickdraw .bt-logo { font-size: clamp(60px, 10vw, 124px); line-height: 0.9; letter-spacing: 0.04em; }
      .bt-quickdraw .bt-logo .a { display: block; color: #fff4d6; text-shadow: 0 6px 0 #2a160a; }
      .bt-quickdraw .bt-logo .b { display: inline-block; color: #f2b632; text-shadow: 0 7px 0 #7a2a12, 0 0 34px rgba(242, 182, 50, 0.7); animation: qdtDraw ${PER}s ease-out infinite; }
      @keyframes qdtDraw { 0%, 54% { transform: none; } 56% { transform: scale(1.25) rotate(-4deg); } 62% { transform: scale(1.04); } 70%, 100% { transform: none; } }
      .bt-quickdraw .bt-tag { font-family: 'Special Elite', monospace; letter-spacing: 0.04em; }
      .bt-quickdraw .bt-card { box-shadow: 0 0 0 4px #5a3418, 0 30px 60px rgba(0, 0, 0, 0.55); border-radius: 10px; }`,
    init() { return { chickens: [], next: 1.5, hat: null }; },
    draw(g, W, H, t, S) {
      const A = BOX.qdArt;
      if (!A) { g.fillStyle = '#c9824a'; g.fillRect(0, 0, W, H); return; }
      const hz = A.scene(g, W, H, t, 'noon', { horizon: 0.58 });
      const ph = (t % PER) / PER, draw = ph > 0.55 ? clamp((ph - 0.55) / 0.03) : 0, flash = ph > 0.55 && ph < 0.6 ? 1 - (ph - 0.55) / 0.05 : 0;
      const tense = ph > 0.38 && ph < 0.55;
      if (tense) { g.fillStyle = `rgba(30,8,0,${0.18 * Math.sin(((ph - 0.38) / 0.17) * Math.PI)})`; g.fillRect(0, 0, W, H); }
      // chickens scuttle across the street
      if (t > S.next) { S.next = t + 2 + Math.random() * 3; S.chickens.push({ t0: t, dir: Math.random() < 0.5 ? 1 : -1, y: hz + (H - hz) * (0.35 + Math.random() * 0.5), sp: 0.12 + Math.random() * 0.08, e: Math.random() < 0.8 ? '🐔' : '🦆' }); }
      S.chickens = S.chickens.filter((c) => (t - c.t0) * c.sp < 1.2);
      for (const c of S.chickens) { const k = (t - c.t0) * c.sp, x = c.dir > 0 ? (-0.1 + k) * W : (1.1 - k) * W, sz = H * 0.06; A.emoji(g, c.e, x, c.y - Math.abs(Math.sin(t * 16)) * 6, sz, c.dir > 0); }
      // the duel
      const h = H * 0.36, fy = H * 0.94, fall = ph > 0.62 ? clamp((ph - 0.62) / 0.06) : 0, lose = Math.floor(t / PER) % 2;
      A.cowboy(g, W * 0.24, fy, h, 1, { arm: draw, band: '#c0392b', flash: lose === 1 ? flash : 0, fall: lose === 0 ? fall * 0.25 : 0, hat: !(lose === 0 && ph > 0.58) });
      A.cowboy(g, W * 0.76, fy, h, -1, { arm: draw, band: '#2f6b8a', flash: lose === 0 ? flash : 0, fall: lose === 1 ? fall * 0.25 : 0, hat: !(lose === 1 && ph > 0.58) });
      // a hat flies
      if (ph > 0.58) {
        const k = clamp((ph - 0.58) / 0.3), x0 = lose === 0 ? W * 0.24 : W * 0.76, dir = lose === 0 ? -1 : 1;
        g.save(); g.translate(x0 + dir * k * W * 0.12, fy - h * 0.92 - Math.sin(k * Math.PI) * H * 0.2 + k * h * 0.9); g.rotate(k * 9 * dir);
        g.fillStyle = '#1d100a'; g.beginPath(); g.ellipse(0, 0, h * 0.2, h * 0.035, 0, 0, TAU); g.fill(); g.fillRect(-h * 0.08, -h * 0.1, h * 0.16, h * 0.1); g.restore();
      }
      if (flash > 0) { g.fillStyle = `rgba(255,250,220,${flash * 0.8})`; g.fillRect(0, 0, W, H); }
      if (ph > 0.55 && ph < 0.75) { const k = clamp((ph - 0.55) / 0.04); A.text(g, 'DRAW!', W / 2, H * 0.9, Math.min(W, H) * 0.12 * (0.6 + 0.4 * k), '#ffd23f', { font: '"Abril Fatface", serif', stroke: '#3a1206', lw: 12 }); }
    },
  };
})();
