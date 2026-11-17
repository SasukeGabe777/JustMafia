'use strict';
// Letter Rush title screen: a desk at night. Cream letter tiles rain down and bounce, a giant
// red-lettered die tumbles in 3D on the left (it lands on a new letter every few seconds), and
// on the right a yellow legal pad fills itself in: a category, then a handwritten answer, then
// the score stamp (+1, a "MATCH" for a shared answer, +2 ✨ for alliteration).
(function () {
  const TAU = Math.PI * 2;
  const ABC = 'ABCDEFGHIJKLMNOPRSTWY';
  const PAD = [
    ['B', [['A fruit', 'Banana', '+1'], ['Something in a garage', 'Big blue bike', '+2 ✨'], ['A reason to be late', 'Bus broke down', '+2 ✨'], ['An animal', 'Bear', 'MATCH']]],
    ['S', [['A pizza topping', 'Sausage', 'MATCH'], ['A famous monster', 'Swamp thing', '+1'], ['Something cold', 'Snow', '+1'], ['A dance move', 'Silly shimmy', '+2 ✨']]],
    ['T', [['A board game', 'Tic-tac-toe', '+1'], ['Something sticky', 'Taffy', '+1'], ['A job', 'Teacher', 'MATCH'], ['A holiday', 'Thanksgiving', '+1']]],
  ];
  const ease = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);
  const back = (k) => { k = Math.max(0, Math.min(1, k)); const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function tile(g, x, y, s, rot, L, alpha) {
    g.save(); g.translate(x, y); g.rotate(rot); g.globalAlpha = alpha;
    g.fillStyle = 'rgba(0,0,0,0.3)'; rr(g, -s / 2 + s * 0.06, -s / 2 + s * 0.12, s, s, s * 0.18); g.fill();
    g.fillStyle = '#b48a4f'; rr(g, -s / 2, -s / 2 + s * 0.07, s, s, s * 0.18); g.fill();
    const gr = g.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.6, '#fff4dc'); gr.addColorStop(1, '#e7cf9f');
    g.fillStyle = gr; rr(g, -s / 2, -s / 2, s, s, s * 0.18); g.fill();
    g.fillStyle = '#1d1b3a'; g.font = `${Math.round(s * 0.62)}px Bungee, 'Lilita One', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L, 0, s * 0.05);
    g.restore(); g.globalAlpha = 1;
  }
  // A cube in orthographic 3D: each visible face is an exact parallelogram, drawn with setTransform.
  const FACES = [[[0, 0, 1], [1, 0, 0], [0, -1, 0]], [[0, 0, -1], [-1, 0, 0], [0, -1, 0]], [[1, 0, 0], [0, 0, -1], [0, -1, 0]], [[-1, 0, 0], [0, 0, 1], [0, -1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, 1]], [[0, -1, 0], [1, 0, 0], [0, 0, -1]]];
  function rot([x, y, z], ax, ay, az) {
    let c = Math.cos(ax), s = Math.sin(ax); [y, z] = [y * c - z * s, y * s + z * c];
    c = Math.cos(ay); s = Math.sin(ay); [x, z] = [x * c + z * s, -x * s + z * c];
    c = Math.cos(az); s = Math.sin(az); [x, y] = [x * c - y * s, x * s + y * c];
    return [x, y, z];
  }
  function cube(g, cx, cy, r, ax, ay, az, letters, dpr) {
    const faces = FACES.map((f, i) => ({ n: rot(f[0], ax, ay, az), u: rot(f[1], ax, ay, az), v: rot(f[2], ax, ay, az), L: letters[i], i })).filter((f) => f.n[2] > 0.02).sort((a, b) => a.n[2] - b.n[2]);
    for (const f of faces) {
      g.save();
      // world -> screen: centre + n*r, axes u*r and v*r (y down, so flip v's y sign already in FACES)
      g.setTransform(dpr * f.u[0] * r, dpr * f.u[1] * r, dpr * -f.v[0] * r, dpr * -f.v[1] * r, dpr * (cx + f.n[0] * r), dpr * (cy + f.n[1] * r));
      const lit = 0.55 + 0.45 * f.n[2];
      const gr = g.createRadialGradient(-0.4, -0.4, 0.1, 0, 0, 1.5); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#fff4dc'); gr.addColorStop(1, '#e2c58f');
      g.fillStyle = gr; rr(g, -1, -1, 2, 2, 0.32); g.fill();
      g.fillStyle = `rgba(20,30,60,${(1 - lit) * 0.8})`; rr(g, -1, -1, 2, 2, 0.32); g.fill();
      g.strokeStyle = 'rgba(180,138,79,0.8)'; g.lineWidth = 0.05; rr(g, -0.96, -0.96, 1.92, 1.92, 0.3); g.stroke();
      g.fillStyle = '#e63946'; g.font = '1.3px Bungee, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.L, 0, 0.08);
      g.restore();
    }
  }

  BOX.titles.letters = {
    logo: '<span class="t">LETTER</span><span class="r">RUSH!</span>',
    tagline: 'A letter is rolled. Race to fill every category with a word that starts with it. Match anyone and it scores nothing!',
    start: '🎲 Roll the dice',
    meta: '2–100 players · best 3–10 · 8–15 min',
    font: "'Bungee', 'Lilita One', sans-serif",
    theme: { card: 'rgba(11, 26, 51, 0.88)', ink: '#f4f7ff', muted: '#bfe0ff', accent: '#ffd23f', button: '#e63946', buttonInk: '#ffffff', border: '#ffd23f' },
    css: `.bt-letters .bt-logo { font-size: clamp(52px, 6.6vw, 100px); line-height: 0.95; display: flex; flex-direction: column; align-items: center; }
      .bt-letters .bt-logo .t { display: inline-block; letter-spacing: 0.06em; color: #fff4dc; text-shadow: 0 5px 0 #b48a4f, 0 10px 18px rgba(0,0,0,0.4); }
      .bt-letters .bt-logo .r { display: inline-block; color: #e63946; transform: rotate(-4deg); font-size: 1.15em; text-shadow: 0 6px 0 #9e1f2b, 0 0 30px rgba(230,57,70,0.45); animation: btLrR 2.4s ease-in-out infinite; }
      @keyframes btLrR { 0%, 100% { transform: rotate(-4deg) scale(1); } 50% { transform: rotate(-1deg) scale(1.05); } }
      .bt-letters .bt-card { border-radius: 10px 10px 26px 26px; border-top: 14px solid #e63946; box-shadow: 0 16px 0 rgba(0,0,0,0.35), 0 0 70px rgba(255,210,63,0.18); }
      .bt-letters .bt-go { font-family: 'Bungee', sans-serif; font-size: clamp(22px, 2.2vw, 30px); padding: 12px 34px; border-radius: 16px; box-shadow: 0 7px 0 #9e1f2b; }
      .bt-letters .bt-tag { font-family: 'Fredoka', sans-serif; font-weight: 500; }`,
    init(W, H) {
      const cardW = Math.min(640, W * 0.92), side = Math.max(150, (W - cardW) / 2 - 20);
      const sc = Math.max(0.45, Math.min(2.4, H / 900, side / 430));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // The desk, drawn once.
      const desk = document.createElement('canvas'); desk.width = Math.max(1, Math.round(W * dpr)); desk.height = Math.max(1, Math.round(H * dpr));
      const dg = desk.getContext('2d'); dg.scale(dpr, dpr);
      const gr = dg.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#16305a'); gr.addColorStop(1, '#0b1a33'); dg.fillStyle = gr; dg.fillRect(0, 0, W, H);
      const lamp = dg.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.35, Math.max(W, H) * 0.65); lamp.addColorStop(0, 'rgba(110,160,240,0.28)'); lamp.addColorStop(1, 'rgba(110,160,240,0)'); dg.fillStyle = lamp; dg.fillRect(0, 0, W, H);
      dg.strokeStyle = 'rgba(255,255,255,0.03)'; dg.lineWidth = 2; for (let x = 0; x < W; x += 120) { dg.beginPath(); dg.moveTo(x, 0); dg.lineTo(x, H); dg.stroke(); } for (let y = 0; y < H; y += 120) { dg.beginPath(); dg.moveTo(0, y); dg.lineTo(W, y); dg.stroke(); }
      const rain = Array.from({ length: Math.round(Math.min(46, 18 + W / 60)) }, () => ({ x: Math.random() * W, y: Math.random() * H * 1.2 - H * 0.2, v: 40 + Math.random() * 70, s: (22 + Math.random() * 34) * Math.max(0.7, sc * 0.8), r: Math.random() * TAU, vr: (Math.random() - 0.5) * 1.2, L: ABC[Math.floor(Math.random() * ABC.length)], a: 0.25 + Math.random() * 0.5 }));
      rain.sort((a, b) => a.s - b.s);
      return { sc, side, desk, dpr, rain, letters: ABC.slice(0, 6).split(''), shown: 'B', last: 0, roll: -1 };
    },
    draw(g, W, H, t, S) {
      const sc = S.sc, dt = Math.min(0.1, Math.max(0, t - S.last)); S.last = t;
      g.drawImage(S.desk, 0, 0, W, H);
      // Raining tiles (behind everything else).
      for (const d of S.rain) {
        d.y += d.v * dt; d.r += d.vr * dt;
        if (d.y > H + 60) { d.y = -60; d.x = Math.random() * W; d.L = ABC[Math.floor(Math.random() * ABC.length)]; }
        tile(g, d.x, d.y, d.s, d.r, d.L, d.a);
      }
      // The giant die on the left: tumbles for 1.6 s, then rests on a new letter for 2.4 s.
      const cyc = 4, k = (t % cyc) / cyc, n = Math.floor(t / cyc);
      if (n !== S.roll) { S.roll = n; S.shown = PAD[n % PAD.length][0]; S.letters = [S.shown, ...Array.from({ length: 5 }, (_, i) => ABC[(n * 7 + i * 5) % ABC.length])]; }
      const spin = Math.max(0, 1 - k / 0.4), e = ease(k / 0.4);
      const cx = S.side * 0.5, baseY = H * 0.55, r = 78 * sc;
      const hop = k < 0.4 ? Math.abs(Math.sin(e * Math.PI * 2.5)) * (1 - e) * 120 * sc : 0;
      const ax = -0.3 - spin * 8.5, ay = 0.42 + spin * 6.2, az = spin * 2.4 + Math.sin(t * 0.8) * 0.03;
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx, baseY + r * 1.55, r * 1.25 * (1 - hop / (300 * sc)), r * 0.28, 0, 0, TAU); g.fill();
      if (k > 0.4 && k < 0.55) { const q = (k - 0.4) / 0.15; g.strokeStyle = `rgba(255,210,63,${1 - q})`; g.lineWidth = 6 * sc; g.beginPath(); g.ellipse(cx, baseY + r * 1.5, r * (1.2 + q * 1.4), r * (0.3 + q * 0.35), 0, 0, TAU); g.stroke(); }
      cube(g, cx, baseY - hop, r, ax, ay, az, S.letters, S.dpr);
      g.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
      if (k > 0.42) {
        const p = back((k - 0.42) / 0.12);
        g.save(); g.translate(cx, baseY - r * 2.2); g.scale(p, p);
        g.font = `${Math.round(34 * sc)}px 'Caveat Brush', cursive`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd23f';
        g.fillText(`Your letter is ${S.shown}!`, 0, 0); g.restore();
      }
      // The legal pad on the right, filling itself in for the current letter.
      const pw = Math.min(S.side - 40 * sc, 380 * sc), ph = pw * 1.25, px = W - S.side / 2 - pw / 2, py = H * 0.5 - ph / 2;
      g.save(); g.translate(px + pw / 2, py + ph / 2); g.rotate(0.04 + Math.sin(t * 0.4) * 0.01); g.translate(-pw / 2, -ph / 2);
      g.fillStyle = 'rgba(0,0,0,0.3)'; rr(g, 8 * sc, 14 * sc, pw, ph, 12 * sc); g.fill();
      g.fillStyle = '#fff3a3'; rr(g, 0, 0, pw, ph, 10 * sc); g.fill();
      const top = 46 * sc, lh = (ph - top - 12 * sc) / 8, mx = 40 * sc;
      g.strokeStyle = '#9cc7f2'; g.lineWidth = 2 * sc; for (let i = 1; i <= 8; i++) { g.beginPath(); g.moveTo(0, top + i * lh); g.lineTo(pw, top + i * lh); g.stroke(); }
      g.strokeStyle = '#ff6b6b'; g.beginPath(); g.moveTo(mx, top); g.lineTo(mx, ph); g.stroke();
      g.fillStyle = '#c53030'; rr(g, 0, 0, pw, top, 10 * sc); g.fill(); g.fillRect(0, top / 2, pw, top / 2);
      const page = PAD[n % PAD.length];
      g.fillStyle = '#fff'; g.font = `${Math.round(18 * sc)}px Bungee, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(`Letter ${page[0]}`, mx, top / 2);
      const u = t % cyc;
      page[1].forEach(([cat, ans, mark], i) => {
        const y0 = top + (i * 2 + 1) * lh - lh * 0.3, y1 = top + (i * 2 + 2) * lh - lh * 0.3;
        g.fillStyle = '#3a3870'; g.font = `${Math.round(17 * sc)}px Fredoka, sans-serif`; g.fillText(`${i + 1}. ${cat}`, mx + 8 * sc, y0);
        const typed = Math.max(0, Math.min(ans.length, Math.floor((u - 0.9 - i * 0.6) * 14)));
        if (typed > 0) { g.fillStyle = '#1f4fbf'; g.font = `${Math.round(30 * sc)}px 'Caveat Brush', cursive`; g.fillText(ans.slice(0, typed), mx + 18 * sc, y1); }
        const sk = u - 1.7 - i * 0.6;
        if (sk > 0) {
          const p = back(sk / 0.25), meld = mark === 'MATCH';
          g.save(); g.translate(pw - 52 * sc, y1); g.rotate(-0.2); g.scale(p, p);
          g.strokeStyle = meld ? '#5b4bd6' : mark.includes('✨') ? '#c99700' : '#13897e'; g.fillStyle = g.strokeStyle; g.lineWidth = 3 * sc;
          g.font = `${Math.round((meld ? 15 : 20) * sc)}px Bungee, sans-serif`; g.textAlign = 'center';
          const w = g.measureText(mark).width + 14 * sc; rr(g, -w / 2, -14 * sc, w, 28 * sc, 6 * sc); g.stroke(); g.fillText(mark, 0, 1 * sc);
          g.restore();
          if (meld) { g.strokeStyle = 'rgba(230,57,70,0.7)'; g.lineWidth = 3 * sc; g.beginPath(); g.moveTo(mx + 14 * sc, y1); g.lineTo(mx + 22 * sc + g.measureText(ans).width * 1.35, y1 - 2 * sc); g.stroke(); }
        }
      });
      // A pencil scribbling along the line being written.
      const wi = Math.min(3, Math.max(0, Math.floor((u - 0.9) / 0.6))), wy = top + (wi * 2 + 2) * lh - lh * 0.3, wx = mx + 30 * sc + ((u * 160 * sc) % (pw * 0.5));
      g.save(); g.translate(wx, wy - 10 * sc + Math.sin(t * 30) * 2 * sc); g.rotate(-0.9);
      g.fillStyle = '#ffd23f'; g.fillRect(0, -6 * sc, 90 * sc, 12 * sc); g.fillStyle = '#f2b705'; g.fillRect(0, 0, 90 * sc, 6 * sc);
      g.fillStyle = '#ff8fa3'; g.fillRect(90 * sc, -6 * sc, 12 * sc, 12 * sc); g.fillStyle = '#f2d0a4'; g.beginPath(); g.moveTo(0, -6 * sc); g.lineTo(-18 * sc, 0); g.lineTo(0, 6 * sc); g.fill();
      g.fillStyle = '#333'; g.beginPath(); g.moveTo(-12 * sc, -2 * sc); g.lineTo(-18 * sc, 0); g.lineTo(-12 * sc, 2 * sc); g.fill();
      g.restore();
      g.restore();
    },
  };
})();
