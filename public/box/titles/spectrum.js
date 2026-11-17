'use strict';
// Where Do You Stand? title screen: the sky itself is a scale, from a cheery sunrise on the
// left to a starry night on the right (a sleepy owl keeps watch). Along the bottom, friends
// slide along a big Morning person / Night owl slider and twins who land together get a heart.
// Little scale cards on each side keep swapping topics.
(function () {
  const TAU = Math.PI * 2;
  const SCALES = [
    ['🐱 Cats', 'Dogs 🐶'], ['🏖️ Beach', 'Mountains 🏔️'], ['🍰 Sweet', 'Salty 🥨'], ['📋 Plan it', 'Wing it 🎲'],
    ['🎤 Spotlight', 'Backstage 🎧'], ['🏙️ City', 'Country 🌾'], ['🌶️ Spicy', 'Mild 🥛'], ['📖 Book', 'Movie 🍿'],
  ];
  const PEOPLE = [
    ['#ff7a59', '#5a2a1a'], ['#ffc93c', '#3b2752'], ['#5fc9a8', '#2c1b10'], ['#6c8cff', '#f5d06b'], ['#ff7ab8', '#4a2a12'],
    ['#9a6bff', '#1b1630'], ['#4cc4ff', '#7a3b12'], ['#ffa94d', '#2a1a40'], ['#7fd862', '#5b3418'],
  ];
  const ROUND = 5.2;
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const ease = (x) => { x = clamp01(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const pop = (x) => { x = clamp01(x); return x >= 1 ? 1 : x <= 0 ? 0 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * TAU / 3) + 1; };
  const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  // Seeded random so each round's arrangement is stable.
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  function arrange(round, n) {
    const r = rng(round * 7919 + 17), slots = [];
    for (let k = 0; k < 6; k++) slots.push((k + 0.5) / 6 + (r() - 0.5) * 0.07);
    const kinds = [1, 1, 1, 0, 0, 0].sort(() => r() - 0.5); // 1 = a pair of twins
    const ids = Array.from({ length: n }, (_, i) => i).sort(() => r() - 0.5);
    const pos = new Array(n), pairs = [];
    let j = 0;
    slots.forEach((s, k) => {
      if (kinds[k]) { pos[ids[j]] = { s, off: -1 }; pos[ids[j + 1]] = { s, off: 1 }; pairs.push([ids[j], ids[j + 1], s]); j += 2; }
      else { pos[ids[j]] = { s, off: 0 }; j++; }
    });
    return { pos, pairs };
  }
  BOX.titles.spectrum = {
    logo: '<span class="a">Where Do You</span><span class="b">Stand?</span><span class="sl"><i></i></span>',
    tagline: 'Slide yourself onto fun scales, see where everyone lands, and find your twin in the room.',
    start: '🧭 Find your spot',
    meta: '3–100 players · 10–20 min',
    font: "'Fredoka', 'Nunito', sans-serif",
    theme: { card: 'rgba(255, 249, 240, 0.95)', ink: '#3b2752', muted: '#6e5a80', accent: '#ff7a59', button: '#ff7a59', buttonInk: '#ffffff', border: '#ffffff' },
    css: `.bt-spectrum .bt-logo { font-weight: 700; line-height: .92; text-shadow: none; }
      .bt-spectrum .bt-logo .a { display: block; font-size: .5em; color: #ff7a59; letter-spacing: .02em; }
      .bt-spectrum .bt-logo .b { display: inline-block; font-size: 1.12em; background: linear-gradient(90deg, #ffa53d 0%, #ff5f8f 45%, #5b4fd8 100%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 4px 0 rgba(59, 39, 82, .18)); padding: 0 .04em; }
      .bt-spectrum .bt-logo .sl { position: relative; display: block; width: 62%; height: .13em; margin: .12em auto .06em; border-radius: 99px; background: linear-gradient(90deg, #ffc23d, #ff7a8a, #5b4fd8); box-shadow: 0 3px 0 rgba(59, 39, 82, .15); }
      .bt-spectrum .bt-logo .sl i { position: absolute; top: 50%; left: 10%; width: .36em; height: .36em; margin: -.18em 0 0 -.18em; border-radius: 50%; background: #fff; border: .07em solid #3b2752; box-sizing: border-box; animation: spSlide 5.2s cubic-bezier(.6, 0, .3, 1) infinite; }
      @keyframes spSlide { 0%, 12% { left: 12%; } 30%, 45% { left: 78%; } 62%, 75% { left: 40%; } 92%, 100% { left: 12%; } }
      .bt-spectrum .bt-card { border-width: 5px; box-shadow: 0 16px 0 rgba(59, 39, 82, .22), 0 30px 60px rgba(30, 20, 70, .35); }
      .bt-spectrum .bt-go { font-weight: 700; box-shadow: 0 7px 0 #c4482b; }
      .bt-spectrum .bt-how-btn { font-weight: 600; }`,
    init(W, H) {
      const rnd = (a, b) => a + Math.random() * (b - a);
      const u = Math.max(0.6, Math.min(W / 1600, H / 900));
      const zone = Math.max(150, (W - 680) / 2);
      const n = PEOPLE.length, first = arrange(0, n);
      return {
        u, zone, n, round: 0, prev: first, cur: first,
        x: new Float32Array(n),
        stars: Array.from({ length: 70 }, () => ({ x: rnd(0.5, 1) * W, y: rnd(0, H * 0.7), r: rnd(1.2, 3) * u, ph: rnd(0, TAU) })),
        clouds: Array.from({ length: 5 }, (_, i) => ({ x: rnd(0, 0.45) * W, y: H * (0.1 + i * 0.12) + rnd(-20, 20) * u, s: rnd(0.7, 1.2) * u, v: rnd(6, 14) * u })),
        mini: [0, 1].map((side) => ({ side, dots: Array.from({ length: 4 }, (_, i) => ({ c: PEOPLE[(i * 2 + side) % PEOPLE.length][0], ph: rnd(0, TAU), sp: rnd(0.3, 0.6) })) })),
      };
    },
    draw(g, W, H, t, S) {
      const u = S.u, n = S.n;
      // Sky: sunrise on the left melting into night on the right.
      const sky = g.createLinearGradient(0, 0, W, 0);
      sky.addColorStop(0, '#ffe4a6'); sky.addColorStop(0.22, '#ffbe9a'); sky.addColorStop(0.45, '#f08fae'); sky.addColorStop(0.68, '#7e66c2'); sky.addColorStop(0.86, '#33307a'); sky.addColorStop(1, '#181645');
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      const vert = g.createLinearGradient(0, 0, 0, H); vert.addColorStop(0, 'rgba(40,20,80,0.12)'); vert.addColorStop(0.6, 'rgba(255,255,255,0)'); vert.addColorStop(1, 'rgba(255,220,180,0.18)');
      g.fillStyle = vert; g.fillRect(0, 0, W, H);
      // Stars on the night side, twinkling slowly.
      g.fillStyle = '#fff8e0';
      for (const s of S.stars) { g.globalAlpha = smooth(0.55, 0.8, s.x / W) * (0.45 + 0.4 * Math.sin(t * 1.2 + s.ph)); g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      // Sun with a sleepy-happy face and slowly turning rays.
      const sx = S.zone * 0.42, sy = H * 0.24 + Math.sin(t * 0.6) * 6 * u, sr = Math.min(64 * u, S.zone * 0.2);
      g.fillStyle = 'rgba(255,240,170,0.35)'; g.beginPath(); g.arc(sx, sy, sr * (1.7 + 0.08 * Math.sin(t * 1.3)), 0, TAU); g.fill();
      g.save(); g.translate(sx, sy); g.rotate(t * 0.15); g.fillStyle = '#ffcf3d';
      for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.beginPath(); g.roundRect(-sr * 0.1, -sr * 1.55, sr * 0.2, sr * 0.38, sr * 0.1); g.fill(); }
      g.restore();
      g.fillStyle = '#ffd84d'; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
      g.fillStyle = '#ffb33d'; g.beginPath(); g.arc(sx + sr * 0.15, sy + sr * 0.15, sr * 0.85, 0.2, 1.9); g.arc(sx, sy, sr, 1.9, 0.2, true); g.fill();
      g.strokeStyle = '#7a4a12'; g.lineWidth = 4 * u; g.lineCap = 'round';
      g.beginPath(); g.arc(sx - sr * 0.35, sy - sr * 0.08, sr * 0.14, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.beginPath(); g.arc(sx + sr * 0.35, sy - sr * 0.08, sr * 0.14, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.beginPath(); g.arc(sx, sy + sr * 0.18, sr * 0.3, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      g.fillStyle = 'rgba(255,120,110,0.45)'; g.beginPath(); g.arc(sx - sr * 0.55, sy + sr * 0.2, sr * 0.14, 0, TAU); g.arc(sx + sr * 0.55, sy + sr * 0.2, sr * 0.14, 0, TAU); g.fill();
      // Clouds on the morning side.
      for (const c of S.clouds) {
        c.x += c.v / 60; if (c.x > W * 0.5) c.x = -160 * u;
        g.globalAlpha = 0.85 * (1 - smooth(0.25, 0.5, c.x / W)); g.fillStyle = '#fff6ee';
        g.beginPath(); g.arc(c.x, c.y, 26 * c.s, 0, TAU); g.arc(c.x + 30 * c.s, c.y - 12 * c.s, 30 * c.s, 0, TAU); g.arc(c.x + 62 * c.s, c.y, 24 * c.s, 0, TAU); g.roundRect(c.x - 10 * c.s, c.y, 90 * c.s, 22 * c.s, 11 * c.s); g.fill();
      }
      g.globalAlpha = 1;
      // Moon on the night side.
      const mx = W - S.zone * 0.32, my = H * 0.17, mr = Math.min(48 * u, S.zone * 0.15);
      g.fillStyle = 'rgba(255,248,210,0.12)'; g.beginPath(); g.arc(mx, my, mr * 1.9, 0, TAU); g.fill();
      g.save(); g.beginPath(); g.rect(mx - mr * 2, my - mr * 2, mr * 4, mr * 4); g.arc(mx + mr * 0.42, my - mr * 0.22, mr * 0.86, 0, TAU); g.clip('evenodd');
      g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(mx, my, mr, 0, TAU); g.fill(); g.restore();
      // Owl on a branch, blinking now and then.
      const ox = W - S.zone * 0.28, oy = H * 0.44, os = Math.min(1.1 * u, S.zone / 300);
      g.strokeStyle = '#4a2c1f'; g.lineWidth = 12 * os; g.lineCap = 'round';
      g.beginPath(); g.moveTo(W + 10, oy + 52 * os); g.quadraticCurveTo(ox, oy + 40 * os, ox - 110 * os, oy + 62 * os); g.stroke();
      g.lineWidth = 6 * os; g.beginPath(); g.moveTo(ox - 60 * os, oy + 52 * os); g.quadraticCurveTo(ox - 80 * os, oy + 30 * os, ox - 92 * os, oy + 22 * os); g.stroke();
      g.fillStyle = '#7fd862'; g.beginPath(); g.ellipse(ox - 96 * os, oy + 18 * os, 12 * os, 6 * os, -0.6, 0, TAU); g.fill();
      g.save(); g.translate(ox, oy + Math.sin(t * 1.1) * 2 * u); g.rotate(Math.sin(t * 0.7) * 0.06); g.scale(os, os);
      g.fillStyle = '#8a6a9e'; g.beginPath(); g.ellipse(0, 0, 38, 46, 0, 0, TAU); g.fill();
      g.beginPath(); g.moveTo(-34, -26); g.lineTo(-30, -56); g.lineTo(-12, -38); g.closePath(); g.moveTo(34, -26); g.lineTo(30, -56); g.lineTo(12, -38); g.closePath(); g.fill();
      g.fillStyle = '#d9c7e6'; g.beginPath(); g.ellipse(0, 14, 24, 26, 0, 0, TAU); g.fill();
      g.fillStyle = '#6a4f80'; g.beginPath(); g.ellipse(-34, 6, 10, 28, 0.2, 0, TAU); g.ellipse(34, 6, 10, 28, -0.2, 0, TAU); g.fill();
      const blink = (t % 4.3) < 0.16;
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-15, -14, 14, 0, TAU); g.arc(15, -14, 14, 0, TAU); g.fill();
      if (blink) { g.strokeStyle = '#2a1a40'; g.lineWidth = 3; g.beginPath(); g.moveTo(-24, -14); g.lineTo(-6, -14); g.moveTo(6, -14); g.lineTo(24, -14); g.stroke(); }
      else { g.fillStyle = '#ffb83d'; g.beginPath(); g.arc(-15, -14, 8, 0, TAU); g.arc(15, -14, 8, 0, TAU); g.fill(); g.fillStyle = '#1b1630'; g.beginPath(); g.arc(-15, -14, 4.5, 0, TAU); g.arc(15, -14, 4.5, 0, TAU); g.fill(); }
      g.fillStyle = '#ffb83d'; g.beginPath(); g.moveTo(-5, -4); g.lineTo(5, -4); g.lineTo(0, 5); g.closePath(); g.fill();
      g.fillStyle = '#ffb83d'; for (const fx of [-10, 0, 10]) { g.beginPath(); g.arc(fx, 46, 4, 0, TAU); g.fill(); }
      g.restore();
      // Rolling hills, tinted from day to night.
      const hillA = g.createLinearGradient(0, 0, W, 0); hillA.addColorStop(0, '#9fdc7c'); hillA.addColorStop(0.5, '#7aa98f'); hillA.addColorStop(1, '#2f3f6e');
      const hillB = g.createLinearGradient(0, 0, W, 0); hillB.addColorStop(0, '#6cc26a'); hillB.addColorStop(0.5, '#4f8a77'); hillB.addColorStop(1, '#1f2a55');
      g.fillStyle = hillA; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W + 24; x += 24) g.lineTo(x, H * 0.74 + Math.sin(x / (260 * u) + 0.8) * 26 * u); g.lineTo(W, H); g.fill();
      g.fillStyle = hillB; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W + 24; x += 24) g.lineTo(x, H * 0.82 + Math.sin(x / (190 * u) + 2.4) * 16 * u); g.lineTo(W, H); g.fill();
      // Mini scale cards on each side, swapping topics.
      g.textBaseline = 'middle';
      for (const m of S.mini) {
        const cw = Math.min(S.zone * 0.8, 300 * u), ch = 78 * u;
        const cx = m.side ? W - S.zone * 0.5 - (S.zone * 0.08) : S.zone * 0.5, cy = H * (m.side ? 0.64 : 0.54) + Math.sin(t * 0.8 + m.side * 2) * 6 * u;
        const k = Math.floor((t + m.side * ROUND / 2) / ROUND), kp = (t + m.side * ROUND / 2) - k * ROUND;
        const [l, r] = SCALES[(k * 2 + m.side) % SCALES.length];
        const sc = pop(kp / 0.7) * (1 - smooth(ROUND - 0.3, ROUND, kp) * 0.15);
        g.save(); g.translate(cx, cy); g.rotate(m.side ? 0.04 : -0.04); g.scale(sc, sc);
        g.fillStyle = 'rgba(59,39,82,0.22)'; g.beginPath(); g.roundRect(-cw / 2, -ch / 2 + 6 * u, cw, ch, 20 * u); g.fill();
        g.fillStyle = m.side ? 'rgba(255,249,240,0.92)' : '#fff9f0'; g.beginPath(); g.roundRect(-cw / 2, -ch / 2, cw, ch, 20 * u); g.fill();
        let fs = 19 * u; g.font = `600 ${Math.round(fs)}px 'Fredoka', sans-serif`;
        const wsum = g.measureText(l).width + g.measureText(r).width;
        if (wsum > cw - 40 * u) { fs *= (cw - 40 * u) / wsum; g.font = `600 ${Math.round(fs)}px 'Fredoka', sans-serif`; }
        g.fillStyle = '#3b2752'; g.textAlign = 'left'; g.fillText(l, -cw / 2 + 14 * u, -ch * 0.2); g.textAlign = 'right'; g.fillText(r, cw / 2 - 14 * u, -ch * 0.2);
        const tw = cw - 36 * u, ty = ch * 0.2;
        g.fillStyle = '#eadff2'; g.beginPath(); g.roundRect(-tw / 2, ty - 5 * u, tw, 10 * u, 5 * u); g.fill();
        for (const d of m.dots) {
          const dx = Math.sin(t * d.sp + d.ph + k) * 0.46 * tw;
          g.fillStyle = '#fff'; g.beginPath(); g.arc(dx, ty, 10 * u, 0, TAU); g.fill();
          g.fillStyle = d.c; g.beginPath(); g.arc(dx, ty, 7.5 * u, 0, TAU); g.fill();
        }
        g.restore();
      }
      // The big slider along the bottom.
      const x0 = W * 0.06, x1 = W * 0.94, ty = H * 0.91, th = 18 * u;
      const track = g.createLinearGradient(x0, 0, x1, 0); track.addColorStop(0, '#ffc23d'); track.addColorStop(0.5, '#ff7a8a'); track.addColorStop(1, '#5b4fd8');
      g.fillStyle = 'rgba(30,20,60,0.3)'; g.beginPath(); g.roundRect(x0 - 4 * u, ty - th / 2 + 4 * u, x1 - x0 + 8 * u, th, th / 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.roundRect(x0 - 5 * u, ty - th / 2 - 5 * u, x1 - x0 + 10 * u, th + 10 * u, th); g.fill();
      g.fillStyle = track; g.beginPath(); g.roundRect(x0, ty - th / 2, x1 - x0, th, th / 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 1; i < 10; i++) { g.beginPath(); g.arc(x0 + (x1 - x0) * i / 10, ty, 3 * u, 0, TAU); g.fill(); }
      // End labels.
      g.font = `700 ${Math.round(22 * u)}px 'Fredoka', sans-serif`; g.textBaseline = 'middle';
      const label = (txt, x, align, bgc, fg) => {
        const w = g.measureText(txt).width + 30 * u, h = 40 * u, lx = align === 'left' ? x : x - w, ly = ty + th / 2 + 10 * u;
        g.fillStyle = bgc; g.beginPath(); g.roundRect(lx, ly, w, h, h / 2); g.fill();
        g.fillStyle = fg; g.textAlign = 'center'; g.fillText(txt, lx + w / 2, ly + h / 2 + 1 * u);
      };
      label('☀️ Morning person', x0 - 5 * u, 'left', '#fff4cf', '#7a4a12');
      label('Night owl 🦉', x1 + 5 * u, 'right', '#2a2766', '#fff3c4');
      // Friends slide to new spots each round; twins who land together get a heart.
      const round = Math.floor(t / ROUND), p = t - round * ROUND;
      if (round !== S.round) { S.prev = S.cur; S.cur = arrange(round, n); S.round = round; }
      const span = x1 - x0 - 60 * u, gap = 27 * u;
      const at = (a, i) => x0 + 30 * u + a.pos[i].s * span + a.pos[i].off * gap;
      for (let i = 0; i < n; i++) { const e = ease((p - 0.2 - i * 0.07) / 1.3); S.x[i] = at(S.prev, i) + (at(S.cur, i) - at(S.prev, i)) * e; }
      const pr = 24 * u;
      for (let i = 0; i < n; i++) {
        const x = S.x[i], moving = p > 0.2 + i * 0.07 && p < 1.5 + i * 0.07;
        const hop = moving ? Math.abs(Math.sin((p - 0.2 - i * 0.07) * 7)) * 10 * u : 0;
        const cy = ty - th / 2 - pr - 14 * u - hop, [col, hair] = PEOPLE[i];
        // Pin pointer.
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 9 * u, cy + pr * 0.8); g.lineTo(x, ty - th / 2 - 2 * u); g.lineTo(x + 9 * u, cy + pr * 0.8); g.closePath(); g.fill();
        g.beginPath(); g.arc(x, cy, pr + 4 * u, 0, TAU); g.fill();
        g.fillStyle = col; g.beginPath(); g.arc(x, cy, pr, 0, TAU); g.fill();
        // Hair tuft, eyes, smile.
        g.fillStyle = hair; g.beginPath(); g.arc(x, cy - pr * 0.15, pr, Math.PI * 1.08, Math.PI * 1.92); g.closePath(); g.fill();
        g.fillStyle = '#2a1a40'; g.beginPath(); g.arc(x - pr * 0.33, cy + pr * 0.05, pr * 0.11, 0, TAU); g.arc(x + pr * 0.33, cy + pr * 0.05, pr * 0.11, 0, TAU); g.fill();
        g.strokeStyle = '#2a1a40'; g.lineWidth = 2.5 * u; g.beginPath(); g.arc(x, cy + pr * 0.2, pr * 0.3, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      }
      // Hearts over twins once everyone has settled.
      const hp = p - 2.0;
      if (hp > 0) {
        const fade = 1 - smooth(ROUND - 2.0 - 0.4, ROUND - 2.0, hp);
        for (let k = 0; k < S.cur.pairs.length; k++) {
          const [a, b] = S.cur.pairs[k], hx = (S.x[a] + S.x[b]) / 2;
          const s = pop((hp - k * 0.2) / 0.6) * fade; if (s <= 0) continue;
          const hy = ty - th / 2 - pr * 2 - 30 * u - Math.sin(t * 2 + k) * 3 * u;
          g.save(); g.translate(hx, hy); g.scale(s * u * 1.15, s * u * 1.15);
          g.fillStyle = '#ff4f7b'; g.beginPath(); g.moveTo(0, 14); g.bezierCurveTo(-26, -4, -16, -24, 0, -12); g.bezierCurveTo(16, -24, 26, -4, 0, 14); g.fill();
          g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke();
          g.restore();
        }
      }
    },
  };
})();
