'use strict';
// Price Panic title screen: a busy neon supermarket. Price tags rain down and spin, a
// cash register's display rolls numbers, and shopping carts race across the checkout belt.
(function () {
  const TAU = Math.PI * 2;
  const ITEMS = ['🧸', '🎧', '🍕', '👟', '📺', '🧁', '🎸', '🛹', '🍩', '⌚', '🪴', '🎮', '🧃', '🕶️', '🚲', '🍦'];
  BOX.titles.price = {
    logo: '<span class="a">Price</span><span class="b">Panic!</span>',
    tagline: 'Guess what it costs. Closest wins, but go over and you bust!',
    start: '💸 Open the store',
    meta: '1–100 players · 10–20 min',
    font: "'Bungee', sans-serif",
    theme: { card: 'rgba(28, 6, 52, 0.84)', ink: '#fff7e6', muted: '#ffd9f0', accent: '#3ef0ff', button: '#3ef0a0', buttonInk: '#082a1c', border: '#ff4fb0' },
    css: `.bt-price .bt-logo .a { color: #ffe23f; display: block; }
      .bt-price .bt-logo .b { color: #ff4fb0; display: inline-block; transform: rotate(-3deg); text-shadow: 0 6px 0 #6a0f45, 0 0 30px rgba(255, 79, 176, 0.6); }
      .bt-price .bt-card { box-shadow: 0 18px 0 rgba(0,0,0,.28), 0 0 60px rgba(255, 79, 176, 0.35); }`,
    init(W, H) {
      const rnd = (a, b) => a + Math.random() * (b - a);
      return {
        tags: Array.from({ length: 22 }, (_, i) => ({ x: rnd(0, W), y: rnd(-H, H), v: rnd(40, 110), r: rnd(0, TAU), vr: rnd(-1.5, 1.5), price: (Math.random() < 0.6 ? rnd(1, 99).toFixed(2) : String(Math.round(rnd(100, 999)))), hue: [50, 320, 185, 140][i % 4], s: rnd(0.7, 1.25) })),
        items: Array.from({ length: 8 }, (_, i) => ({ e: ITEMS[i % ITEMS.length], off: i / 8 })),
      };
    },
    draw(g, W, H, t, S) {
      // Back wall: deep purple with glowing aisle signs.
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a0b4d'); bg.addColorStop(1, '#12052a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      // Shelves with products.
      for (let row = 0; row < 3; row++) {
        const y = H * (0.18 + row * 0.17);
        g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(0, y + 34, W, 8);
        g.font = '34px serif'; g.textAlign = 'center'; g.textBaseline = 'bottom';
        for (let x = 30 + (row % 2) * 40; x < W; x += 80) { g.globalAlpha = 0.35; g.fillText(ITEMS[(Math.floor(x / 80) + row * 5) % ITEMS.length], x, y + 34); }
        g.globalAlpha = 1;
      }
      // Neon aisle signs, flickering.
      const sign = (x, y, text, col) => { const on = Math.sin(t * 13 + x) > -0.92; g.font = "bold 26px 'Bungee', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = on ? 24 : 4; g.fillStyle = on ? col : 'rgba(255,255,255,.25)'; g.fillText(text, x, y); g.shadowBlur = 0; };
      sign(W * 0.14, H * 0.08, 'AISLE 7', '#3ef0ff'); sign(W * 0.86, H * 0.08, 'SALE!', '#ff4fb0'); sign(W * 0.5, H * 0.06, '★ BARGAINS ★', '#ffe23f');
      // Checkout belt with items sliding along and carts racing.
      const by = H * 0.86;
      g.fillStyle = '#1b1b2b'; g.fillRect(0, by, W, H - by);
      g.fillStyle = '#2d2d44'; for (let x = -((t * 120) % 40); x < W; x += 40) g.fillRect(x, by + 6, 20, 6);
      g.font = '44px serif'; g.textBaseline = 'bottom';
      for (const it of S.items) { const x = ((it.off * (W + 200) + t * 120) % (W + 200)) - 100; g.fillText(it.e, x, by + 2); }
      const cart = (x, y, sc, col) => {
        g.save(); g.translate(x, y); g.scale(sc, sc); g.strokeStyle = col; g.lineWidth = 5; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(-50, -48); g.lineTo(-38, -48); g.lineTo(-28, -8); g.lineTo(34, -8); g.lineTo(44, -38); g.lineTo(-33, -38); g.stroke();
        g.fillStyle = col; g.beginPath(); g.arc(-18, 4, 6, 0, TAU); g.arc(26, 4, 6, 0, TAU); g.fill();
        g.font = '26px serif'; g.textAlign = 'center'; g.fillText('🎁🧸', 6, -14); g.restore();
      };
      cart(((t * 260) % (W + 400)) - 200, H * 0.97, 1.1, '#3ef0ff');
      cart(W + 200 - ((t * 190 + 300) % (W + 400)), H * 0.995, 0.9, '#ffe23f');
      // Falling, spinning price tags.
      for (const p of S.tags) {
        p.y += p.v / 60; p.r += p.vr / 60; if (p.y > H + 60) { p.y = -60; p.x = Math.random() * W; }
        g.save(); g.translate(p.x, p.y); g.rotate(Math.sin(p.r) * 0.6); g.scale(p.s, p.s);
        g.fillStyle = `hsl(${p.hue} 95% 62%)`; g.beginPath(); g.moveTo(-44, -18); g.lineTo(30, -18); g.lineTo(46, 0); g.lineTo(30, 18); g.lineTo(-44, 18); g.closePath(); g.fill();
        g.fillStyle = '#12052a'; g.beginPath(); g.arc(32, 0, 4, 0, TAU); g.fill();
        g.font = "bold 16px 'Bungee', sans-serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$' + p.price, -6, 1);
        g.restore();
      }
      // A cash register in the corner with a rolling display.
      const rx = W * 0.88, ry = H * 0.74;
      g.fillStyle = '#ff4fb0'; g.beginPath(); g.roundRect(rx - 70, ry - 20, 140, 90, 12); g.fill();
      g.fillStyle = '#0b2a1c'; g.beginPath(); g.roundRect(rx - 56, ry - 66, 112, 42, 8); g.fill();
      g.fillStyle = '#3ef0a0'; g.font = "18px 'Press Start 2P', monospace"; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('$' + String(Math.floor((t * 37) % 1000)).padStart(3, '0') + '.' + String(Math.floor((t * 600) % 100)).padStart(2, '0'), rx, ry - 44);
      g.fillStyle = '#ffd9f0'; for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { g.fillRect(rx - 52 + j * 28, ry - 8 + i * 22, 20, 14); }
    },
  };
})();
