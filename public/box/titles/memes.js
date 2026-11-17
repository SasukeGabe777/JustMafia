'use strict';
// Meme Maker title screen: a corkboard wall papered with original meme printouts. Rows of pinned
// memes drift past in opposite directions; now and then a fresh one slaps onto the board with a
// "VIRAL!" stamp. Format: public/box/title.js. The memes are drawn by BOX.memes (games/memes.js).
(function () {
  const TAU = Math.PI * 2;
  const PINS = ['#ff4f5a', '#ffd23f', '#3fa9ff', '#3ddc84', '#b77bff'];
  const STAMPS = ['VIRAL!', 'LOL', '10/10', 'DEEP-FRIED', 'SO TRUE', 'CERTIFIED'];
  function cork(W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#c8925a'); gr.addColorStop(1, '#9a6434'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < (W * H) / 90; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(90,50,20,0.35)' : 'rgba(255,230,190,0.22)'; g.fillRect(Math.random() * W, Math.random() * H, 1.6, 1.6); }
    const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(40,20,5,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    return c;
  }
  BOX.titles.memes = {
    logo: '<span class="a">MEME</span><span class="b">MAKER</span>',
    tagline: 'Caption original meme templates on your phone. The room votes for the funniest.',
    start: '🖼️ Start making memes', meta: '3–100 players · 5–15 min',
    font: "Impact, Anton, 'Arial Black', sans-serif",
    theme: { card: 'rgba(28, 24, 32, 0.9)', ink: '#ffffff', muted: '#f3e3c8', accent: '#ffe14d', button: '#ff4f5a', buttonInk: '#ffffff', border: '#ffe14d' },
    css: `.bt-memes .bt-logo { display: flex; gap: .22em; justify-content: center; color: #fff; -webkit-text-stroke: .07em #000; paint-order: stroke fill; text-shadow: 0 .06em 0 #000; letter-spacing: .02em; font-weight: 400; animation: mmTWob 3.6s ease-in-out infinite; }
      .bt-memes .bt-logo .b { color: #ffe14d; }
      @keyframes mmTWob { 0%,100% { transform: rotate(-2deg); } 50% { transform: rotate(1.5deg) scale(1.03); } }
      .bt-memes .bt-card { box-shadow: 0 18px 0 rgba(0,0,0,.35), 0 0 0 4px #000, 0 0 60px rgba(255,225,77,.25); }
      .bt-memes .bt-go { font-family: Impact, Anton, 'Arial Black', sans-serif; letter-spacing: .03em; -webkit-text-stroke: 1px #000; paint-order: stroke fill; box-shadow: 0 6px 0 #000; }`,
    init(W, H) {
      const M = BOX.memes, list = M ? M.samples().sort(() => Math.random() - 0.5) : [];
      const rowH = Math.max(150, H / 3.3), rows = Math.ceil(H / rowH) + 1;
      const pics = list.map((m) => { const c = M.render(m, { scale: 0.5 }); const h = rowH * 0.8, w = (c.width / c.height) * h; return { c, w, h }; });
      const lanes = Array.from({ length: rows }, (_, r) => {
        const items = []; let x = -Math.random() * 200, k = r * 5;
        while (x < W + 900) { const p = pics[k++ % Math.max(1, pics.length)]; if (!p) break; items.push({ p, x, tl: (Math.random() * 2 - 1) * 0.07, pin: PINS[k % PINS.length] }); x += p.w + 40 + Math.random() * 30; }
        return { y: r * rowH + rowH * 0.1, dir: r % 2 ? 1 : -1, v: 18 + r * 6, items, span: x };
      });
      return { bg: cork(W, H), lanes, pics, slap: null, nextSlap: 1.5, rowH };
    },
    draw(g, W, H, t, S) {
      g.drawImage(S.bg, 0, 0, W, H);
      const dt = Math.min(0.05, t - (S.t0 || t)); S.t0 = t;
      for (const L of S.lanes) {
        for (const it of L.items) {
          it.x += L.dir * L.v * dt;
          if (L.dir < 0 && it.x + it.p.w < -60) it.x += L.span + 40; if (L.dir > 0 && it.x > W + 60) it.x -= L.span + 40;
          if (it.x > W + 60 || it.x + it.p.w < -60) continue;
          const cx = it.x + it.p.w / 2, cy = L.y + it.p.h / 2;
          g.save(); g.translate(cx, cy); g.rotate(it.tl + Math.sin(t * 0.8 + cx * 0.01) * 0.01);
          g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-it.p.w / 2 - 4, -it.p.h / 2 + 6, it.p.w + 16, it.p.h + 16);
          g.fillStyle = '#fff'; g.fillRect(-it.p.w / 2 - 7, -it.p.h / 2 - 7, it.p.w + 14, it.p.h + 14);
          g.drawImage(it.p.c, -it.p.w / 2, -it.p.h / 2, it.p.w, it.p.h);
          const pg = g.createRadialGradient(-3, -it.p.h / 2 - 9, 1, 0, -it.p.h / 2 - 6, 10); pg.addColorStop(0, '#fff'); pg.addColorStop(0.3, it.pin); pg.addColorStop(1, it.pin);
          g.fillStyle = pg; g.beginPath(); g.arc(0, -it.p.h / 2 - 6, 9, 0, TAU); g.fill();
          g.restore();
        }
      }
      // A fresh meme slaps onto the board now and then.
      if (t > S.nextSlap && S.pics.length) { const p = S.pics[Math.floor(Math.random() * S.pics.length)]; const side = Math.random() < 0.5; S.slap = { p, t0: t, x: side ? W * (0.08 + Math.random() * 0.14) : W * (0.78 + Math.random() * 0.14), y: H * (0.25 + Math.random() * 0.5), tl: (Math.random() * 2 - 1) * 0.15, stamp: STAMPS[Math.floor(Math.random() * STAMPS.length)] }; S.nextSlap = t + 4.2; }
      const s = S.slap;
      if (s) {
        const k = Math.min(1, (t - s.t0) / 0.35), sc = (2.2 - 1.2 * (1 - Math.pow(1 - k, 3))) * 1.15, fade = Math.min(1, Math.max(0, (s.t0 + 3.8 - t) / 0.4));
        g.save(); g.globalAlpha = fade * k; g.translate(s.x, s.y); g.rotate(s.tl); g.scale(sc, sc);
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(-s.p.w / 2 - 2, -s.p.h / 2 + 8, s.p.w + 16, s.p.h + 16);
        g.fillStyle = '#fff'; g.fillRect(-s.p.w / 2 - 8, -s.p.h / 2 - 8, s.p.w + 16, s.p.h + 16); g.drawImage(s.p.c, -s.p.w / 2, -s.p.h / 2, s.p.w, s.p.h);
        if (t - s.t0 > 0.5) {
          const q = Math.min(1, (t - s.t0 - 0.5) / 0.2);
          g.save(); g.translate(s.p.w * 0.25, s.p.h * 0.3); g.rotate(-0.25); g.scale(2 - q, 2 - q); g.globalAlpha = fade * q;
          g.font = '34px Impact, Anton, sans-serif'; const tw = g.measureText(s.stamp).width;
          g.fillStyle = '#ff4f5a'; g.fillRect(-tw / 2 - 12, -24, tw + 24, 48); g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(-tw / 2 - 12, -24, tw + 24, 48);
          g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.stamp, 0, 2); g.restore();
        }
        g.restore();
      }
    },
  };
})();
