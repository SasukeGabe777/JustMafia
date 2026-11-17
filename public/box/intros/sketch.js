'use strict';
// JustSketch Relay intro: no studio, no host, just the sketchbook. A pencil writes the title
// across a blank ruled page and a highlighter swipes "Relay"; the camera follows a relay of
// sticky notes as doodles draw themselves (the prompt falling apart note by note); then the
// whole page, with a paper plane looping over it. Engine + API: public/box/show.js ('cast' mode).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, clamp, TAU } = ST.util;
  const INK = '#2b2a4a', RED = '#ff5a5f', BLUE = '#3d7bd9', PAPER = '#fbf6e8';
  const HAND = "'Caveat Brush', cursive", MARK = "'Permanent Marker', cursive";
  try { if (document.fonts) { document.fonts.load(`60px ${MARK}`); document.fonts.load(`40px ${HAND}`); } } catch { /* fine */ }

  // ---- doodles as polylines (unit coords), drawn part-way by length ----
  const arc = (cx, cy, rx, ry, a0, a1, n) => { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return o; };
  const circ = (cx, cy, r, n = 22) => arc(cx, cy, r, r, 0, TAU, n);
  const spiral = () => { const o = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU * 2.4, r = 0.05 + i / 60 * 0.5; o.push([-0.1 + Math.cos(a) * r, 0.05 + Math.sin(a) * r]); } return o; };
  const D = Math.PI / 180;
  const DOODLES = {
    rocket: [[[0, -1], [0.3, -0.5], [0.3, 0.5], [-0.3, 0.5], [-0.3, -0.5], [0, -1]], circ(0, -0.18, 0.14), [[0.3, 0.15], [0.58, 0.68], [0.3, 0.5]], [[-0.3, 0.15], [-0.58, 0.68], [-0.3, 0.5]], [[-0.16, 0.55], [-0.06, 0.82], [0, 0.66], [0.07, 0.95], [0.16, 0.55]]],
    snail: [spiral().reverse(), [[-0.95, 0.62], [0.7, 0.62], [0.92, 0.35], [0.78, 0.08], [0.55, 0.3]], [[0.78, 0.1], [0.72, -0.3]], [[0.86, 0.12], [0.98, -0.25]], circ(0.72, -0.34, 0.05, 8), circ(0.99, -0.29, 0.05, 8)],
    robot: [[[-0.4, -0.75], [0.4, -0.75], [0.4, -0.2], [-0.4, -0.2], [-0.4, -0.75]], [[0, -0.75], [0, -0.98]], circ(0, -1, 0.06, 8), circ(-0.17, -0.5, 0.08, 10), circ(0.17, -0.5, 0.08, 10), [[-0.15, -0.32], [0.15, -0.32]], [[-0.55, -0.1], [0.55, -0.1], [0.55, 0.65], [-0.55, 0.65], [-0.55, -0.1]], [[-0.55, 0.05], [-0.9, 0.4], [-0.82, 0.55]], [[0.55, 0.05], [0.9, -0.25], [0.95, -0.4]], [[-0.3, 0.65], [-0.3, 0.98]], [[0.3, 0.65], [0.3, 0.98]]],
    cat: [[[-0.6, -0.2], [-0.5, -0.85], [-0.2, -0.5], [0.2, -0.5], [0.5, -0.85], [0.6, -0.2]], arc(0, -0.05, 0.62, 0.5, -10 * D, 190 * D, 24), circ(-0.22, -0.12, 0.06, 8), circ(0.22, -0.12, 0.06, 8), [[-0.1, 0.12], [0, 0.2], [0.1, 0.12]], [[-0.85, 0.75], [0.85, 0.75]], circ(-0.55, 0.9, 0.12, 10), circ(0.55, 0.9, 0.12, 10)],
    pizza: [[[-0.75, -0.6], [0.75, -0.6], [0, 0.95], [-0.75, -0.6]], arc(0, -0.45, 0.82, 0.32, 200 * D, 340 * D, 14), circ(-0.25, -0.25, 0.12, 12), circ(0.22, -0.18, 0.11, 12), circ(0.02, 0.25, 0.1, 12)],
  };
  const prep = {};
  for (const [k, list] of Object.entries(DOODLES)) {
    const strokes = list.map((pts) => { const len = [0]; let L = 0; for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); len.push(L); } return { pts, len, L }; });
    prep[k] = { strokes, total: strokes.reduce((a, s) => a + s.L, 0) };
  }
  // Draw a doodle at (x, y), radius R, the first `k` (0..1) of its length; returns the pencil tip.
  function doodle(g, name, x, y, R, k, col, w, t) {
    const d = prep[name]; let left = clamp(k) * d.total, tip = [x, y];
    const wob = (i) => Math.sin(i * 12.9 + Math.floor(t * 5) * 1.7) * 1.4;
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const st of d.strokes) {
      if (left <= 0) break;
      const P = st.pts; g.beginPath(); g.moveTo(x + P[0][0] * R, y + P[0][1] * R); tip = [x + P[0][0] * R, y + P[0][1] * R];
      for (let i = 1; i < P.length; i++) {
        if (st.len[i] <= left) { tip = [x + P[i][0] * R + wob(i), y + P[i][1] * R + wob(i + 3)]; g.lineTo(tip[0], tip[1]); }
        else { const u = (left - st.len[i - 1]) / (st.len[i] - st.len[i - 1]); tip = [x + (P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u) * R, y + (P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u) * R]; g.lineTo(tip[0], tip[1]); break; }
      }
      g.stroke(); left -= st.L;
    }
    return tip;
  }
  // The yellow pencil, its tip at (x, y).
  function pencil(g, x, y, rot, sc) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
    g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = INK;
    g.fillStyle = '#f2c99a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(26, -10); g.lineTo(26, 10); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.moveTo(0, 0); g.lineTo(9, -3.5); g.lineTo(9, 3.5); g.fill();
    g.fillStyle = '#ffc93c'; g.fillRect(26, -10, 120, 20); g.fillStyle = '#e8a91c'; g.fillRect(26, 3, 120, 7); g.strokeRect(26, -10, 120, 20);
    g.fillStyle = '#b9bcc8'; g.fillRect(146, -10, 18, 20); g.strokeRect(146, -10, 18, 20);
    g.fillStyle = '#ff8fa8'; g.beginPath(); g.roundRect(164, -10, 22, 20, [0, 7, 7, 0]); g.fill(); g.stroke();
    g.restore();
  }
  function note(g, x, y, w, h, col, rot, str, px, font) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = 'rgba(43,42,74,0.16)'; g.fillRect(-w / 2 + 7, -h / 2 + 8, w, h);
    g.fillStyle = col; g.fillRect(-w / 2, -h / 2, w, h);
    g.fillStyle = 'rgba(255,140,160,0.55)'; g.fillRect(-36, -h / 2 - 12, 72, 22);
    if (str) {
      g.fillStyle = INK; g.font = `${px}px ${font || HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const words = String(str).split(' ');
      if (g.measureText(str).width > w - 30) { const h2 = Math.ceil(words.length / 2); g.fillText(words.slice(0, h2).join(' '), 0, -px * 0.55); g.fillText(words.slice(h2).join(' '), 0, px * 0.55); } else g.fillText(str, 0, 0);
    }
    g.restore();
  }
  function arrow(g, x0, y, x1, k) {
    if (k <= 0) return;
    g.save(); g.strokeStyle = 'rgba(43,42,74,0.7)'; g.lineWidth = 5; g.lineCap = 'round'; g.setLineDash([14, 14]);
    const xe = lerp(x0, x1, clamp(k)); g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo((x0 + xe) / 2, y - 50 * k, xe, y); g.stroke(); g.setLineDash([]);
    if (k >= 1) { g.beginPath(); g.moveTo(x1 - 20, y - 14); g.lineTo(x1, y); g.lineTo(x1 - 22, y + 10); g.stroke(); }
    g.restore();
  }
  function star(g, x, y, r, rot, t) {
    g.save(); g.translate(x, y); g.rotate(rot + Math.sin(t * 0.8 + x) * 0.2); g.beginPath();
    for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 0.45 : 1) * r; g.lineTo(Math.cos(a) * rr + Math.sin(i * 7 + Math.floor(t * 5)) * 1.5, Math.sin(a) * rr); }
    g.strokeStyle = INK; g.lineWidth = 4; g.stroke(); g.restore();
  }
  // The relay along the page: prompt → drawing → guess → drawing → guess.
  const CHAIN = [{ w: 'a cat on a skateboard', col: '#fff27a' }, { d: 'cat' }, { w: 'a cat in a car?', col: '#c9dcff' }, { d: 'robot' }, { w: 'robot taxi driver', col: '#ffc2d6' }, { d: 'rocket' }, { w: 'space taxi!!', col: '#b8f0c8' }];
  const CHAIN_Y = 820, CHAIN_X0 = 170, CHAIN_STEP = 265;

  function page(g, s) {
    g.fillStyle = PAPER; g.fillRect(-700, -400, 3320, 1900);
    g.strokeStyle = 'rgba(110,160,220,0.32)'; g.lineWidth = 2.5; g.beginPath();
    for (let y = 70; y < 1400; y += 54) { g.moveTo(-700, y); g.lineTo(2620, y); } g.stroke();
    g.strokeStyle = 'rgba(240,110,120,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(110, -400); g.lineTo(110, 1500); g.stroke();
    g.fillStyle = '#e4dccb'; for (let y = 120; y < 1100; y += 260) { g.beginPath(); g.arc(46, y, 15, 0, TAU); g.fill(); }
    g.strokeStyle = 'rgba(160,110,60,0.16)'; g.lineWidth = 12; g.beginPath(); g.arc(1730, 150, 92, 0.3, TAU - 0.4); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.arc(1736, 154, 80, 1.2, TAU + 0.6); g.stroke();
    star(g, 260, 120, 26, 0.2, s.t); star(g, 400, 70, 16, 1, s.t); star(g, 1530, 90, 20, 0.5, s.t); star(g, 1860, 300, 24, 2, s.t);
  }
  function logo(g, s, k) {
    // "JustSketch" written by pencil (k 0..0.7), then "Relay" with a highlighter swipe (0.7..1).
    const kw = clamp(k / 0.7), kr = clamp((k - 0.7) / 0.3);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = `150px ${MARK}`; const w1 = g.measureText('JustSketch').width;
    g.font = `170px ${MARK}`; const w2 = g.measureText('Relay').width;
    const total = w1 + 40 + w2, x0 = -total / 2;
    g.save(); g.beginPath(); g.rect(x0 - 20, -200, (w1 + 40) * kw, 400); g.clip();
    g.font = `150px ${MARK}`; g.fillStyle = INK; g.fillText('JustSketch', x0, 0); g.restore();
    if (kr > 0) {
      const rx = x0 + w1 + 40;
      g.save(); g.translate(rx + w2 / 2, 8); g.rotate(-0.07);
      g.fillStyle = 'rgba(255,220,60,0.85)'; g.beginPath(); g.roundRect(-w2 / 2 - 24, -78, (w2 + 48) * ease(kr), 150, [30, 10, 36, 14]); g.fill();
      g.globalAlpha = ss(0.3, 1, kr); g.font = `170px ${MARK}`; g.textAlign = 'center'; g.fillStyle = RED; g.fillText('Relay', 0, 4); g.restore();
    }
    return { tipX: x0 + (w1 + 40) * kw, tipY: 40, done: kw >= 1 };
  }
  function stage(g, s, o = {}) {
    const t = s.t;
    page(g, s);
    // Doodles in the margins.
    doodle(g, 'snail', 1660, 520, 120, o.chain == null ? 1 : o.chain, BLUE, 6, t);
    doodle(g, 'pizza', 290, 500, 110, o.chain == null ? 1 : o.chain, RED, 6, t);
    if (!o.bare) {
      const k = o.chain == null ? 1 : o.chain;
      CHAIN.forEach((c, i) => {
        const x = CHAIN_X0 + i * CHAIN_STEP, ki = clamp(k * CHAIN.length - i);
        if (ki <= 0) return;
        if (i) arrow(g, x - CHAIN_STEP + 105, CHAIN_Y, x - 105, clamp(ki * 3));
        if (c.w) note(g, x, CHAIN_Y + Math.sin(t * 1.5 + i) * 4, 200, 124, c.col, (i % 3 - 1) * 0.05, c.w, 36);
        else { note(g, x, CHAIN_Y, 190, 190, '#ffffff', 0.03, '', 0); doodle(g, c.d, x, CHAIN_Y, 66, ki, INK, 5, t); }
      });
    }
    if (o.lights != null && o.lights < 1 && !o.bare) { g.fillStyle = `rgba(43,42,74,${(1 - o.lights) * 0.55})`; g.fillRect(-700, -400, 3320, 1900); }
    if (o.logo !== 0 && !o.bare) { g.save(); g.translate(960, 300); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
  }
  function plane(g, s, u) {
    const path = (v) => [lerp(-200, 2120, v), 170 + Math.sin(v * TAU * 1.5) * 90];
    g.save(); g.strokeStyle = 'rgba(61,123,217,0.55)'; g.lineWidth = 4; g.setLineDash([10, 16]); g.beginPath();
    for (let j = 0; j <= 30; j++) { const v = u - 0.3 + j / 30 * 0.3; if (v < 0) continue; const [x, y] = path(v); j ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke(); g.setLineDash([]);
    const [ax, ay] = path(u), [bx, by] = path(u + 0.003);
    g.translate(ax, ay); g.rotate(Math.atan2(by - ay, bx - ax)); const q = 2.6;
    g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.moveTo(28 * q, 0); g.lineTo(-22 * q, -16 * q); g.lineTo(-12 * q, 0); g.lineTo(-22 * q, 14 * q); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#dfe6f5'; g.beginPath(); g.moveTo(28 * q, 0); g.lineTo(-12 * q, 0); g.lineTo(-18 * q, 7 * q); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  BOX.intros.sketch = {
    title: 'JustSketch Relay',
    // How to play (box/howto.js): one card per step, 5 steps (module howSteps).
    tutorial: [
      { icon: '✏️', title: 'Draw it', text: 'Everyone gets a secret prompt and draws it on their phone.', phone: 'Draw with your finger, then tap Done ✓. (🎲 New prompt swaps it.)' },
      { icon: '🔁', title: 'Pass it on', text: 'Your book passes around the circle. The next player sees only your drawing and guesses what it is.', phone: 'Type what you think it is, then tap Send guess ✓.' },
      { icon: '🎨', title: 'Draw the guess', text: 'The next player sees only that guess and draws it… and so on around the circle. Things get weird fast!', phone: 'Draw the words you see, then tap Done ✓.' },
      { icon: '📖', title: 'The reveal', text: 'The TV replays every book, entry by entry, from the first prompt to the final guess.' },
      { icon: '🏆', title: 'Scoring', text: 'Vote for the funniest entry: 100 points a vote. If a book’s last guess still matches the prompt, everyone on it gets +50!', phone: 'Tap the funniest entry to vote.' },
    ],
    theme: { accent: RED, accent2: BLUE, accent3: '#ffd23f', ink: INK, panel: '#fffdf4', fade: PAPER, rim: '#ffffff',
      confetti: ['#ff5a5f', '#3d7bd9', '#ffd23f', '#2bb673', '#ff8fa8', '#2b2a4a'] },
    host: null,
    lines: {
      welcome: 'Grab a pencil! It\'s JustSketch Relay. Draw it, guess it, pass it on!',
      roll: 'Meet tonight\'s artists!', more: '…and {n} more scribblers!', others: 'And every other artist in the room!',
      play: 'Pencils ready… draw!',
    },
    stage, logo,
    castOpening: [
      { ms: 2700, sfx: [[0, 'flip'], [1900, 'pop'], [2350, 'start']],
        draw(g, s) {
          const k = ss(150, 2500, s.T);
          s.cam(960, 330, 1.35 - 0.1 * ease(s.k));
          stage(g, s, { logo: k <= 0 ? 0 : k, chain: 0, bare: false });
          // the pencil, writing along the title
          if (k > 0) { g.save(); g.translate(960, 300); g.font = `150px ${MARK}`; const w1 = g.measureText('JustSketch').width; g.font = `170px ${MARK}`; const w2 = g.measureText('Relay').width; const x0 = -(w1 + 40 + w2) / 2, kw = clamp(k / 0.7);
            const px = kw < 1 ? x0 + (w1 + 40) * kw : lerp(x0 + w1 + 40, x0 + w1 + 40 + w2 + 30, clamp((k - 0.7) / 0.3)), py = 30 + Math.sin(s.T * 0.05) * 26;
            pencil(g, px, py, -0.9, 1.6); g.restore(); }
        } },
      { ms: 2300, sfx: [[100, 'whoosh'], [1200, 'chime']],
        draw(g, s) {
          const k = ease(s.k);
          s.cam(lerp(420, 1500, k), CHAIN_Y - 40, 1.55);
          stage(g, s, { chain: 0.12 + 0.88 * s.k });
          const i = Math.min(CHAIN.length - 1, Math.floor((0.12 + 0.88 * s.k) * CHAIN.length)), c = CHAIN[i];
          if (c.d) { const ki = clamp((0.12 + 0.88 * s.k) * CHAIN.length - i); const x = CHAIN_X0 + i * CHAIN_STEP; const tip = doodle(g, c.d, x, CHAIN_Y, 66, ki, 'rgba(0,0,0,0)', 1, s.t); pencil(g, tip[0], tip[1], -0.9, 0.9); }
        } },
      { ms: 2000, say: 'welcome', sayAt: 0, fit: 3600, sfx: [[200, 'whoosh']],
        draw(g, s) {
          s.cam(960, lerp(700, 560, ease(s.k)), lerp(1.25, 1.0, ease(s.k)));
          stage(g, s, {});
          plane(g, s, s.k * 0.9);
        } },
    ],
  };
})();
