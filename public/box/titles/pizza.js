'use strict';
// YesChef title screen (key `pizza`; format: public/box/title.js): the YesChef food court at night.
// String lights over five stalls (pizzeria, taco truck, sushi bar, burger joint, sundae stand),
// a lazy susan in front turning the five dishes past the camera, and ingredients from every
// kitchen raining through the lamplight. The logo is the food court's neon sign.
(function () {
  const TAU = Math.PI * 2, OUT = '#2a160c';
  const EMO = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  const STALLS = [
    { icon: '🍕', back: '#8a3a1f', awn: ['#c8321f', '#fff4dc'], sign: 'Pizzeria', glow: '#3fd06a' },
    { icon: '🌮', back: '#1fa596', awn: ['#e2453a', '#ffd23f'], sign: 'El Cohete', glow: '#ffd23f' },
    { icon: '🍣', back: '#c49a6a', awn: ['#24345e', '#f4efe4'], sign: 'Sushi', glow: '#ff6b4a' },
    { icon: '🍔', back: '#fff1d0', awn: ['#d62828', '#ffffff'], sign: 'Burgers', glow: '#3ad0ff' },
    { icon: '🍨', back: '#ffd6e7', awn: ['#ff8fc8', '#ffffff'], sign: 'Sundaes', glow: '#ff5fa2' },
  ];
  const BITS = ['pep', 'basil', 'lime', 'cil', 'sesame', 'roe', 'cheese', 'lettuce', 'spr', 'cherry'];
  function bit(g, k, x, y, s, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s); g.lineWidth = 1.4; g.strokeStyle = OUT;
    if (k === 'pep') { g.fillStyle = '#b3261b'; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#7d150e'; g.beginPath(); g.arc(-2.5, -2, 1.6, 0, TAU); g.arc(2.5, 2.2, 1.3, 0, TAU); g.fill(); }
    else if (k === 'basil' || k === 'cil') { g.fillStyle = k === 'basil' ? '#2d8a3e' : '#4cbb5a'; g.beginPath(); g.moveTo(0, -8); g.quadraticCurveTo(7, -2, 0, 8); g.quadraticCurveTo(-7, -2, 0, -8); g.fill(); g.stroke(); }
    else if (k === 'lime') { g.fillStyle = '#7ac943'; g.beginPath(); g.arc(0, 0, 8, 0, Math.PI); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#d7f5a0'; g.beginPath(); g.arc(0, 0.6, 5.6, 0, Math.PI); g.fill(); }
    else if (k === 'sesame') { g.fillStyle = '#fff6dc'; g.beginPath(); g.ellipse(0, 0, 4.4, 2.4, 0, 0, TAU); g.fill(); g.stroke(); }
    else if (k === 'roe') { g.fillStyle = '#ff7a1a'; for (const [a, b] of [[-3, 0], [3, 0], [0, -4], [0, 4]]) { g.beginPath(); g.arc(a, b, 3, 0, TAU); g.fill(); g.stroke(); } }
    else if (k === 'cheese') { g.fillStyle = '#ffc93c'; g.beginPath(); g.moveTo(-8, -6); g.lineTo(8, -6); g.lineTo(6, 6); g.lineTo(-7, 5); g.closePath(); g.fill(); g.stroke(); }
    else if (k === 'lettuce') { g.strokeStyle = '#6fc24a'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-8, 2); g.quadraticCurveTo(-4, -5, 0, 1); g.quadraticCurveTo(4, -5, 8, 2); g.stroke(); }
    else if (k === 'spr') { g.fillStyle = ['#ff4f6d', '#ffd23f', '#3ad0ff', '#7ac943'][Math.abs(Math.round(rot * 10)) % 4]; g.fillRect(-7, -2, 14, 4); }
    else { g.fillStyle = '#e0304a'; g.beginPath(); g.arc(0, 2, 7, 0, TAU); g.fill(); g.stroke(); g.strokeStyle = '#3a6a1e'; g.lineWidth = 2; g.beginPath(); g.moveTo(1, -4); g.quadraticCurveTo(4, -11, 9, -12); g.stroke(); }
    g.restore();
  }
  BOX.titles.pizza = {
    logo: '<span class="a">Yes</span><span class="b">Chef</span>',
    tagline: 'Five kitchens, one food court. A customer shows their dish for a few seconds: rebuild it from memory!',
    start: '🧑‍🍳 Open the kitchens', meta: '1–100 cooks · 10–15 min',
    font: "'Pacifico', cursive",
    theme: { card: 'rgba(20, 12, 40, 0.86)', ink: '#fff8ec', accent: '#ffd23f', button: '#ff4f6d', buttonInk: '#ffffff', border: '#ffd23f' },
    css: '.bt-pizza .bt-logo .a { color: #fff8d6; text-shadow: 0 0 6px #ffd23f, 0 0 22px #ffd23f; } .bt-pizza .bt-logo .b { color: #ffe3ea; margin-left: .08em; text-shadow: 0 0 6px #ff4f6d, 0 0 24px #ff4f6d; } .bt-pizza .bt-logo { font-weight: 400; }',
    init(W, H) {
      const rnd = Math.random;
      return {
        rain: Array.from({ length: 34 }, (_, i) => ({ k: BITS[i % BITS.length], x: rnd(), y: rnd(), v: 0.04 + rnd() * 0.06, s: 0.8 + rnd() * 0.9, rot: rnd() * TAU, spin: (rnd() - 0.5) * 3 })),
        stars: Array.from({ length: 70 }, () => [rnd(), rnd() * 0.4, 0.6 + rnd() * 1.6, rnd() * TAU]),
      };
    },
    draw(g, W, H, t, S) {
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d0b2a'); gr.addColorStop(0.55, '#2a1c5a'); gr.addColorStop(1, '#4a2a6a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (const [x, y, r, p] of S.stars) { g.fillStyle = `rgba(255,255,240,${0.35 + 0.35 * Math.sin(t * 2 + p)})`; g.beginPath(); g.arc(x * W, y * H, r, 0, TAU); g.fill(); }
      // string lights
      for (let row = 0; row < 2; row++) {
        const y0 = H * (0.08 + row * 0.06), amp = H * 0.03;
        g.strokeStyle = '#120a24'; g.lineWidth = 2; g.beginPath(); for (let x = 0; x <= W; x += 10) g.lineTo(x, y0 + Math.sin((x / W) * Math.PI * 3) * amp); g.stroke();
        for (let x = 12, i = 0; x < W; x += Math.max(26, W / 40), i++) { const y = y0 + Math.sin((x / W) * Math.PI * 3) * amp + 6, on = 0.6 + 0.4 * Math.sin(t * 3 + i + row); g.fillStyle = `rgba(255,${200 + (i % 3) * 20},${120 + (i % 2) * 80},${on})`; g.beginPath(); g.arc(x, y, 4.5, 0, TAU); g.fill(); g.fillStyle = `rgba(255,220,150,${on * 0.15})`; g.beginPath(); g.arc(x, y, 13, 0, TAU); g.fill(); }
      }
      // the five stalls along the back
      const sw = W / 5, top = H * 0.3, bot = H * 0.66;
      STALLS.forEach((st, i) => {
        const x = i * sw, cx = x + sw / 2, pad = sw * 0.06;
        g.fillStyle = st.back; g.fillRect(x + pad, top, sw - pad * 2, bot - top); g.lineWidth = 3; g.strokeStyle = OUT; g.strokeRect(x + pad, top, sw - pad * 2, bot - top);
        const n = 6, aw = (sw - pad) / n;
        for (let k = 0; k < n; k++) { const ax = x + pad / 2 + k * aw; g.fillStyle = st.awn[k % 2]; g.beginPath(); g.moveTo(ax, top); g.lineTo(ax + aw, top); g.lineTo(ax + aw, top + H * 0.04); g.arc(ax + aw / 2, top + H * 0.04, aw / 2, 0, Math.PI); g.closePath(); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(); }
        const fs = Math.max(12, Math.min(sw * 0.13, H * 0.045));
        g.font = `${fs}px "Pacifico", cursive`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(16,10,30,0.9)'; const tw = g.measureText(st.sign).width + fs; g.fillRect(cx - tw / 2, top - fs * 1.7, tw, fs * 1.5);
        g.save(); g.shadowColor = st.glow; g.shadowBlur = 14 + 4 * Math.sin(t * 3 + i); g.fillStyle = '#fff8ec'; g.fillText(st.sign, cx, top - fs * 0.95); g.restore();
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + pad, bot - H * 0.08, sw - pad * 2, H * 0.08);
        g.font = `${Math.round(Math.min(sw * 0.3, H * 0.11))}px ${EMO}`; g.fillText(st.icon, cx, top + (bot - top) * 0.5 + Math.sin(t * 2 + i) * 4);
        gr = g.createRadialGradient(cx, top + (bot - top) * 0.45, 4, cx, top + (bot - top) * 0.45, sw * 0.6); gr.addColorStop(0, 'rgba(255,220,160,0.22)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(x, top, sw, bot - top);
      });
      // the plaza floor
      gr = g.createLinearGradient(0, bot, 0, H); gr.addColorStop(0, '#5a4a6e'); gr.addColorStop(1, '#221a36'); g.fillStyle = gr; g.fillRect(0, bot, W, H - bot);
      // ingredients from every kitchen drifting through the light
      for (const d of S.rain) { const y = ((d.y + t * d.v) % 1.1) * H - H * 0.05; bit(g, d.k, d.x * W, y, Math.min(W, H) / 360 * d.s, d.rot + t * d.spin); }
      // the lazy susan: the five dishes turning past the front
      const cx = W * 0.5, cy = H * 0.8, R = Math.min(W * 0.36, H * 0.46);
      g.save(); g.translate(cx, cy); g.scale(1, 0.28);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(8, 30, R * 1.08, 0, TAU); g.fill();
      g.fillStyle = '#b5773e'; g.beginPath(); g.arc(0, 0, R * 1.08, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
      g.strokeStyle = 'rgba(80,40,10,0.35)'; g.lineWidth = 3; for (let r = 0.3; r < 1.05; r += 0.18) { g.beginPath(); g.arc(0, 0, R * r, 0, TAU); g.stroke(); }
      g.restore();
      const items = STALLS.map((st, i) => { const a = t * 0.35 + (i / 5) * TAU; return { st, a, depth: Math.sin(a) }; }).sort((p, q) => p.depth - q.depth);
      for (const { st, a, depth } of items) {
        const x = cx + Math.cos(a) * R * 0.78, y = cy + Math.sin(a) * R * 0.78 * 0.28, s = 0.75 + 0.25 * (depth + 1) / 2;
        const px = Math.round(Math.min(W, H) * 0.13 * s);
        g.fillStyle = 'rgba(247,242,232,0.95)'; g.beginPath(); g.ellipse(x, y + px * 0.3, px * 0.62, px * 0.18, 0, 0, TAU); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
        g.font = `${px}px ${EMO}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(st.icon, x, y + px * 0.32);
      }
      const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    },
  };
})();
