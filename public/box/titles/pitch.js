'use strict';
// JustPitch title screen (format: public/box/title.js): the keynote hall at night. Velvet curtains,
// sweeping coral / teal / gold stage lights, a big projection screen where a scribbled slide builds
// itself line by line (a "product" with arrows and a rocket-shaped sales graph), a walnut podium
// with a brass mic, and cue cards drifting down from backstage.
(function () {
  const TAU = Math.PI * 2;
  const CARDS = ['Sing it!', 'Mention your nan', 'Do an accent', 'NOW ONLY $1!', 'It just broke.', 'Explain slide 3', 'Next question!', '“Chapter one…”'];
  BOX.titles.pitch = {
    logo: '<span class="a">Just</span><span class="b">Pitch</span>',
    tagline: 'Sell it to the room while your rival sabotages you from backstage. Then swap!',
    start: '🎤 Open the show', meta: '3–100 players · best 4–10 · 15–25 min',
    font: "'Anton', 'Bungee', sans-serif",
    theme: { card: 'rgba(12, 14, 44, 0.86)', ink: '#f2f4ff', muted: '#b9c0f0', accent: '#18d4c8', button: '#ff5a3c', buttonInk: '#ffffff', border: '#ffc83d' },
    css: '.bt-pitch .bt-logo { letter-spacing: 0.03em; text-shadow: 0 6px 0 #ff5a3c, 0 14px 30px rgba(0,0,0,0.6); } .bt-pitch .bt-logo .a { color: #18d4c8; } .bt-pitch .bt-logo .b { color: #fff; }',
    init(W, H) {
      return { cards: Array.from({ length: 9 }, (_, i) => ({ x: Math.random(), y: Math.random(), r: (Math.random() - 0.5) * 0.6, v: 0.02 + Math.random() * 0.03, s: CARDS[i % CARDS.length], w: Math.random() * TAU })) };
    },
    draw(g, W, H, t, S) {
      // hall
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0b0e2c'); gr.addColorStop(0.6, '#1a2160'); gr.addColorStop(1, '#090a20');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const u = Math.min(W / 1600, H / 900);
      // stage lights (behind everything)
      g.save(); g.globalCompositeOperation = 'lighter';
      const beam = (x, col, ph) => {
        const a = Math.sin(t * 0.5 + ph) * 0.35;
        g.save(); g.translate(x, -20); g.rotate(a);
        const bg = g.createLinearGradient(0, 0, 0, H * 1.1); bg.addColorStop(0, `rgba(${col},0.45)`); bg.addColorStop(1, `rgba(${col},0)`);
        g.fillStyle = bg; g.beginPath(); g.moveTo(-14 * u, 0); g.lineTo(14 * u, 0); g.lineTo(240 * u, H * 1.1); g.lineTo(-240 * u, H * 1.1); g.closePath(); g.fill(); g.restore();
      };
      beam(W * 0.22, '255,90,60', 0); beam(W * 0.78, '24,212,200', 2); beam(W * 0.5, '255,200,61', 4);
      g.restore();
      // the screen
      const sw = 620 * u, sh = 380 * u, sx = W * 0.5 - sw / 2, sy = H * 0.12;
      g.fillStyle = '#1a1d33'; g.fillRect(sx - 12 * u, sy - 12 * u, sw + 24 * u, sh + 24 * u);
      g.fillStyle = '#f4f6ff'; g.fillRect(sx, sy, sw, sh);
      g.fillStyle = '#1d2560'; g.fillRect(sx, sy, sw, 56 * u);
      g.fillStyle = '#ff5a3c'; g.beginPath(); g.arc(sx + 34 * u, sy + 28 * u, 16 * u, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.font = `${30 * u}px Anton, Impact, sans-serif`; g.textBaseline = 'middle'; g.fillText('OUR PRODUCT', sx + 62 * u, sy + 30 * u);
      // a slide that draws itself (loops every 7 s)
      const k = (t % 7) / 5;
      const pen = (pts, col, w, from, to) => {
        const f = Math.max(0, Math.min(1, (k - from) / (to - from))); if (f <= 0) return;
        const n = Math.max(2, Math.floor(pts.length / 2 * f));
        g.strokeStyle = col; g.lineWidth = w * u; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
        for (let i = 0; i < n; i++) { const X = sx + pts[i * 2] * sw, Y = sy + pts[i * 2 + 1] * sh; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }
        g.stroke();
      };
      // a toaster with wings, an arrow, a graph going up
      pen([0.12, 0.6, 0.12, 0.85, 0.38, 0.85, 0.38, 0.6, 0.12, 0.6], '#1d1b26', 6, 0, 0.25);
      pen([0.18, 0.6, 0.18, 0.52, 0.24, 0.52, 0.24, 0.6, 0.27, 0.6, 0.27, 0.52, 0.33, 0.52, 0.33, 0.6], '#e63946', 5, 0.2, 0.35);
      pen([0.12, 0.66, 0.03, 0.58, 0.06, 0.72, 0.12, 0.72], '#2f7bff', 5, 0.3, 0.42);
      pen([0.38, 0.66, 0.47, 0.58, 0.44, 0.72, 0.38, 0.72], '#2f7bff', 5, 0.38, 0.48);
      pen([0.55, 0.88, 0.62, 0.78, 0.68, 0.82, 0.76, 0.6, 0.82, 0.66, 0.92, 0.24], '#2bb673', 7, 0.5, 0.75);
      pen([0.86, 0.26, 0.92, 0.24, 0.92, 0.32], '#2bb673', 7, 0.72, 0.8);
      pen([0.42, 0.4, 0.5, 0.32, 0.6, 0.38], '#8e44ff', 4, 0.8, 0.9);
      if (k > 0.9) { g.fillStyle = '#e63946'; g.font = `${44 * u}px "Permanent Marker", cursive`; g.fillText('???', sx + sw * 0.62, sy + sh * 0.3); }
      // curtains
      for (const side of [0, 1]) {
        g.save(); if (side) { g.translate(W, 0); g.scale(-1, 1); }
        const cw = W * 0.14;
        for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#8c1736' : '#6e0f2a'; const x = (i / 7) * cw, sway = Math.sin(t * 0.8 + i) * 4 * u; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + cw / 7 + 2, 0); g.lineTo(x + cw / 7 + sway + 2, H * 0.84); g.lineTo(x + sway, H * 0.84); g.fill(); }
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(cw - 20 * u, 0, 20 * u, H * 0.84); g.restore();
      }
      // floor + podium + mic
      g.fillStyle = '#26132c'; g.fillRect(0, H * 0.8, W, H * 0.2); g.fillStyle = 'rgba(255,200,61,0.4)'; g.fillRect(0, H * 0.8, W, 4 * u);
      const px = W * 0.5, py = H * 0.62, pw = 220 * u;
      gr = g.createLinearGradient(0, py, 0, H * 0.86); gr.addColorStop(0, '#8a4b26'); gr.addColorStop(1, '#3d1f0e');
      g.fillStyle = gr; g.beginPath(); g.moveTo(px - pw / 2, py); g.lineTo(px + pw / 2, py); g.lineTo(px + pw * 0.4, H * 0.86); g.lineTo(px - pw * 0.4, H * 0.86); g.closePath(); g.fill();
      g.fillStyle = '#ffc83d'; g.fillRect(px - pw / 2 - 10 * u, py - 12 * u, pw + 20 * u, 16 * u);
      g.strokeStyle = '#c4ccd2'; g.lineWidth = 5 * u; g.beginPath(); g.moveTo(px, py - 12 * u); g.quadraticCurveTo(px + 6 * u, py - 60 * u, px - 10 * u, py - 80 * u); g.stroke();
      g.fillStyle = '#d8dee9'; g.beginPath(); g.ellipse(px - 12 * u, py - 92 * u, 12 * u, 18 * u, -0.4, 0, TAU); g.fill();
      // cue cards drifting down from backstage
      g.font = `${20 * u}px "Permanent Marker", cursive`; g.textBaseline = 'middle'; g.textAlign = 'center';
      for (const c of S.cards) {
        c.y += c.v / 60; if (c.y > 1.1) { c.y = -0.1; c.x = Math.random(); }
        const x = c.x * W, y = c.y * H, r = c.r + Math.sin(t + c.w) * 0.15;
        g.save(); g.translate(x, y); g.rotate(r); g.globalAlpha = 0.85;
        const w = g.measureText(c.s).width + 28 * u;
        g.fillStyle = '#fff7c2'; g.fillRect(-w / 2, -22 * u, w, 44 * u); g.strokeStyle = '#0b0d24'; g.lineWidth = 2 * u; g.strokeRect(-w / 2, -22 * u, w, 44 * u);
        g.fillStyle = '#0b0d24'; g.fillText(c.s, 0, 2 * u); g.restore();
      }
      g.textAlign = 'left'; g.globalAlpha = 1;
    },
  };
})();
