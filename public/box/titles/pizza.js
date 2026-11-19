'use strict';
// JustPizza title screen (format: public/box/title.js): Nonna Pina's pizzeria at night. Warm
// brick, the wood oven glowing on the right, flour in the lamplight, and a big pizza turning on
// the counter while toppings rain down onto it. The logo is the shop's neon sign.
(function () {
  const TAU = Math.PI * 2, OUT = '#2a160c';
  const KINDS = ['pep', 'mush', 'olive', 'basil', 'pine', 'pepper'];
  function topping(g, k, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.lineWidth = 1.4; g.strokeStyle = OUT;
    if (k === 'pep') { g.fillStyle = '#b3261b'; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#7d150e'; g.beginPath(); g.arc(-2.5, -2, 1.6, 0, TAU); g.arc(2.5, 2.2, 1.3, 0, TAU); g.fill(); }
    else if (k === 'mush') { g.fillStyle = '#d8c1a0'; g.beginPath(); g.moveTo(-7, 0); g.quadraticCurveTo(-7, -8, 0, -8); g.quadraticCurveTo(7, -8, 7, 0); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#efe2cc'; g.fillRect(-2.5, 0, 5, 7); g.strokeRect(-2.5, 0, 5, 7); }
    else if (k === 'olive') { g.strokeStyle = '#1e1e24'; g.lineWidth = 3.6; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.stroke(); }
    else if (k === 'basil') { g.fillStyle = '#2d8a3e'; g.beginPath(); g.moveTo(0, -8); g.quadraticCurveTo(7, -2, 0, 8); g.quadraticCurveTo(-7, -2, 0, -8); g.fill(); g.stroke(); }
    else if (k === 'pine') { g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(-6, -6); g.lineTo(6, -6); g.lineTo(7, 4); g.lineTo(0, 7); g.lineTo(-7, 4); g.closePath(); g.fill(); g.stroke(); }
    else { g.strokeStyle = '#2f9e44'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, 6.5, 7, 0, 0, TAU); g.stroke(); }
    g.restore();
  }
  BOX.titles.pizza = {
    logo: '<span class="a">Just</span><span class="b">Pizza</span>',
    tagline: 'A customer shows their pizza for a few seconds. Rebuild it from memory!',
    start: '🍕 Open the kitchen', meta: '1–100 cooks · 10–15 min',
    font: "'Pacifico', cursive",
    theme: { card: 'rgba(40, 14, 6, 0.86)', ink: '#fff4dc', accent: '#ffb43a', button: '#c8321f', buttonInk: '#ffffff', border: '#ffb43a' },
    css: '.bt-pizza .bt-logo .a { color: #eaffef; text-shadow: 0 0 6px #3fd06a, 0 0 22px #3fd06a; } .bt-pizza .bt-logo .b { color: #fff1ec; margin-left: .08em; text-shadow: 0 0 6px #ff3b2a, 0 0 24px #ff3b2a; } .bt-pizza .bt-logo { font-weight: 400; }',
    init(W, H) {
      const rnd = Math.random;
      return {
        drops: Array.from({ length: 26 }, (_, i) => ({ k: KINDS[i % KINDS.length], a: rnd() * TAU, r: 0.15 + rnd() * 0.7, t0: rnd() * 6, rot: rnd() * TAU })),
        rain: Array.from({ length: 22 }, (_, i) => ({ k: KINDS[i % KINDS.length], x: rnd(), y: rnd(), v: 0.05 + rnd() * 0.07, s: 0.8 + rnd() * 0.9, rot: rnd() * TAU, spin: (rnd() - 0.5) * 3 })),
        flour: Array.from({ length: 60 }, () => [rnd(), rnd(), 1 + rnd() * 2.5, 8 + rnd() * 24, rnd() * TAU]),
      };
    },
    draw(g, W, H, t, S) {
      // brick wall
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#8a3a1f'); gr.addColorStop(1, '#4a1a0c'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const bw = Math.max(60, W / 18), bh = bw * 0.36;
      g.fillStyle = 'rgba(40,12,4,0.55)';
      for (let y = 0; y < H * 0.72; y += bh) { g.fillRect(0, y, W, 3); for (let x = ((y / bh) % 2 ? bw / 2 : 0); x < W; x += bw) g.fillRect(x, y, 3, bh); }
      // the oven's glow and a warm lamp pool
      gr = g.createRadialGradient(W * 0.92, H * 0.55, 10, W * 0.92, H * 0.55, W * 0.45); gr.addColorStop(0, `rgba(255,140,50,${0.45 + 0.06 * Math.sin(t * 7)})`); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      gr = g.createRadialGradient(W * 0.5, H * 0.1, 10, W * 0.5, H * 0.4, W * 0.5); gr.addColorStop(0, 'rgba(255,220,150,0.35)'); gr.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // the oven on the right and the menu board on the left
      const ox = W * 0.93, oy = H * 0.8, orr = Math.min(W, H) * 0.42;
      g.fillStyle = '#8c3b1d'; g.beginPath(); g.arc(ox, oy, orr, Math.PI, TAU); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
      for (let r = 1; r < 5; r++) { g.strokeStyle = r % 2 ? '#b4552a' : '#d9773a'; g.lineWidth = orr * 0.07; g.beginPath(); g.arc(ox, oy, orr * (0.45 + r * 0.12), Math.PI, TAU); g.stroke(); }
      g.fillStyle = '#1a0a05'; g.beginPath(); g.arc(ox, oy, orr * 0.42, Math.PI, TAU); g.fill();
      for (let i = 0; i < 7; i++) { const fx = ox - orr * 0.3 + i * orr * 0.1, fh = orr * (0.18 + 0.12 * Math.abs(Math.sin(t * 6 + i * 1.7))); const fg = g.createLinearGradient(0, oy, 0, oy - fh); fg.addColorStop(0, '#ff5a1a'); fg.addColorStop(0.6, '#ffb22e'); fg.addColorStop(1, 'rgba(255,240,170,0)'); g.fillStyle = fg; g.beginPath(); g.moveTo(fx - orr * 0.06, oy); g.quadraticCurveTo(fx, oy - fh * 1.2, fx + orr * 0.06, oy); g.fill(); }
      const mbx = W * 0.04, mby = H * 0.1, mbw = Math.min(W * 0.2, 300), mbh = mbw * 1.1;
      g.fillStyle = '#4e2a12'; g.fillRect(mbx - 10, mby - 10, mbw + 20, mbh + 20); g.fillStyle = '#26302a'; g.fillRect(mbx, mby, mbw, mbh);
      g.fillStyle = '#f4f1e6'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = `${Math.round(mbw * 0.17)}px "Caveat Brush", cursive`; g.fillText('Menu', mbx + mbw / 2, mby + mbw * 0.2);
      g.font = `${Math.round(mbw * 0.1)}px "Caveat Brush", cursive`; g.textAlign = 'left';
      ['Margherita', 'Pepperoni', 'Funghi', 'Hawaiian', 'Nonna’s'].forEach((n, i) => { g.fillStyle = '#f4f1e6'; g.fillText(n, mbx + mbw * 0.1, mby + mbw * (0.42 + i * 0.16)); g.fillStyle = '#ffd27a'; g.fillText(String(9 + i), mbx + mbw * 0.8, mby + mbw * (0.42 + i * 0.16)); });
      // toppings drifting down through the lamplight
      for (const d of S.rain) { const y = ((d.y + t * d.v) % 1.1) * H - H * 0.05; topping(g, d.k, d.x * W, y, Math.min(W, H) / 380 * d.s, d.rot + t * d.spin); }
      // counter
      const cy = H * 0.8;
      g.fillStyle = '#efe8dc'; g.fillRect(0, cy, W, H * 0.04); g.fillStyle = '#5a2f14'; g.fillRect(0, cy + H * 0.04, W, H);
      const sq = Math.max(18, W / 60);
      for (let x = 0; x < W; x += sq) for (let r = 0; r < 2; r++) { g.fillStyle = ((x / sq + r) % 2) < 1 ? '#c8321f' : '#fff4dc'; g.fillRect(x, cy + H * 0.04 + r * sq * 0.6, sq, sq * 0.6); }
      // the turning pizza on its board
      const R = Math.min(W, H) * 0.36, px = W * 0.5, py = cy + R * 0.1;
      g.save(); g.translate(px, py); g.scale(1, 0.42);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(10, 30, R * 1.12, 0, TAU); g.fill();
      g.fillStyle = '#b5773e'; g.beginPath(); g.arc(0, 0, R * 1.12, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
      g.rotate(t * 0.25);
      g.fillStyle = '#d9963f'; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = '#c8321f'; g.beginPath(); g.arc(0, 0, R * 0.87, 0, TAU); g.fill();
      g.fillStyle = '#ffd968'; g.beginPath(); for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU, rr = R * (0.8 + 0.04 * Math.sin(i * 3.3)); g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.fill();
      g.strokeStyle = 'rgba(110,50,15,0.35)'; g.lineWidth = 2; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(i * TAU / 8) * R, Math.sin(i * TAU / 8) * R); g.stroke(); }
      // toppings that have landed (they turn with the pie)
      for (const d of S.drops) { const ph = ((t - d.t0) % 6 + 6) % 6; if (ph > 1.1 && ph < 5.6) topping(g, d.k, Math.cos(d.a) * R * d.r, Math.sin(d.a) * R * d.r, R / 110, d.rot); }
      g.restore();
      // toppings falling
      for (const d of S.drops) {
        const ph = ((t - d.t0) % 6 + 6) % 6; if (ph > 1.1) continue;
        const k = ph / 1.1, a = d.a + t * 0.25, tx = px + Math.cos(a) * R * d.r, ty = py + Math.sin(a) * R * d.r * 0.42;
        topping(g, d.k, tx, ty - (1 - k * k) * H * 0.5, R / 120, d.rot + ph * 4);
      }
      // flour in the light
      g.fillStyle = 'rgba(255,245,225,0.5)';
      for (const [x, y, r, v, p] of S.flour) { const yy = ((y * H + t * v) % H), xx = x * W + Math.sin(t + p) * 14; g.beginPath(); g.arc(xx, yy, r, 0, TAU); g.fill(); }
      const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    },
  };
})();
