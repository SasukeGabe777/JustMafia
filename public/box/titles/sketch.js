'use strict';
// JustSketch Relay title screen: an open sketchbook page. On the left a scribble keeps
// morphing from one thing into the next while the guesses underneath get it wrong; on the
// right a pencil draws doodles line by line; along the bottom a relay of sticky notes slides
// past, the prompt falling apart note by note; a paper plane loops across the top.
(function () {
  const TAU = Math.PI * 2;
  const INK = '#2b2a4a', RED = '#ff5a5f', BLUE = '#3d7bd9', HAND = "'Caveat Brush', cursive";
  const N = 160; // points per morph outline

  // ---- Morph outlines (unit coords, y down, clockwise from the top) ----
  const poly = (pts) => pts;
  function arcPts(cx, cy, rx, ry, a0, a1, n) { const out = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return out; }
  const D = Math.PI / 180;
  const SHAPES = [
    { name: 'a fish', tint: '#8fd3ff', pts: () => [...arcPts(0.15, 0, 0.75, 0.55, -90 * D, 150 * D, 40), [-0.75, 0.15], [-1, 0.5], [-1, -0.5], [-0.75, -0.15], ...arcPts(0.15, 0, 0.75, 0.55, 210 * D, 270 * D, 10)] },
    { name: 'a cat?', tint: '#ffc58f', pts: () => [[0, -0.6], [0.35, -0.62], [0.62, -1], [0.74, -0.42], ...arcPts(0, 0.12, 0.8, 0.75, -40 * D, 220 * D, 44), [-0.74, -0.42], [-0.62, -1], [-0.35, -0.62]] },
    { name: 'a house!', tint: '#ffe27a', pts: () => poly([[0, -1], [0.88, -0.18], [0.66, -0.18], [0.66, 0.9], [-0.66, 0.9], [-0.66, -0.18], [-0.88, -0.18]]) },
    { name: 'a star', tint: '#fff08a', pts: () => Array.from({ length: 10 }, (_, i) => { const a = -90 * D + i * 36 * D, r = i % 2 ? 0.42 : 1; return [Math.cos(a) * r, Math.sin(a) * r + 0.08]; }) },
    { name: 'a heart <3', tint: '#ff9fb2', pts: () => Array.from({ length: 64 }, (_, i) => { const u = i / 64 * TAU, s = Math.sin(u); return [16 * s * s * s / 17, -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u)) / 17 - 0.1]; }) },
    { name: 'a flower??', tint: '#d6a8ff', pts: () => Array.from({ length: 96 }, (_, i) => { const a = -90 * D + i / 96 * TAU, r = 0.58 + 0.38 * Math.cos(6 * (a + 90 * D)); return [Math.cos(a) * r, Math.sin(a) * r]; }) },
  ];
  // Resample a closed polygon to N points spaced evenly along its length.
  function resample(pts) {
    const segs = [], out = new Float32Array(N * 2); let total = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push(l); total += l; }
    let k = 0, acc = 0;
    for (let j = 0; j < N; j++) {
      const want = j / N * total;
      while (acc + segs[k] < want && k < segs.length - 1) { acc += segs[k]; k++; }
      const a = pts[k], b = pts[(k + 1) % pts.length], f = segs[k] ? (want - acc) / segs[k] : 0;
      out[j * 2] = a[0] + (b[0] - a[0]) * f; out[j * 2 + 1] = a[1] + (b[1] - a[1]) * f;
    }
    return out;
  }

  // ---- Doodles drawn stroke by stroke (unit coords) ----
  const circ = (cx, cy, r, n = 22) => arcPts(cx, cy, r, r, 0, TAU, n);
  const spiral = () => { const o = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU * 2.4, r = 0.05 + i / 60 * 0.5; o.push([-0.1 + Math.cos(a) * r, 0.05 + Math.sin(a) * r]); } return o; };
  const DOODLES = [
    { name: 'a rocket', strokes: [[[0, -1], [0.3, -0.5], [0.3, 0.5], [-0.3, 0.5], [-0.3, -0.5], [0, -1]], circ(0, -0.18, 0.14), [[0.3, 0.15], [0.58, 0.68], [0.3, 0.5]], [[-0.3, 0.15], [-0.58, 0.68], [-0.3, 0.5]], [[-0.16, 0.55], [-0.06, 0.82], [0, 0.66], [0.07, 0.95], [0.16, 0.55]]] },
    { name: 'a snail', strokes: [spiral().reverse(), [[-0.95, 0.62], [0.7, 0.62], [0.92, 0.35], [0.78, 0.08], [0.55, 0.3]], [[0.78, 0.1], [0.72, -0.3]], [[0.86, 0.12], [0.98, -0.25]], circ(0.72, -0.34, 0.05, 8), circ(0.99, -0.29, 0.05, 8)] },
    { name: 'a robot', strokes: [[[-0.4, -0.75], [0.4, -0.75], [0.4, -0.2], [-0.4, -0.2], [-0.4, -0.75]], [[0, -0.75], [0, -0.98]], circ(0, -1, 0.06, 8), circ(-0.17, -0.5, 0.08, 10), circ(0.17, -0.5, 0.08, 10), [[-0.15, -0.32], [0.15, -0.32]], [[-0.55, -0.1], [0.55, -0.1], [0.55, 0.65], [-0.55, 0.65], [-0.55, -0.1]], [[-0.55, 0.05], [-0.9, 0.4], [-0.82, 0.55]], [[0.55, 0.05], [0.9, -0.25], [0.95, -0.4]], [[-0.3, 0.65], [-0.3, 0.98]], [[0.3, 0.65], [0.3, 0.98]]] },
    { name: 'pizza!', strokes: [[[-0.75, -0.6], [0.75, -0.6], [0, 0.95], [-0.75, -0.6]], arcPts(0, -0.45, 0.82, 0.32, 200 * D, 340 * D, 14), circ(-0.25, -0.25, 0.12, 12), circ(0.22, -0.18, 0.11, 12), circ(0.02, 0.25, 0.1, 12), [[-0.4, 0.05], [-0.33, 0.12]]] },
  ];
  function prepDoodle(d) {
    const strokes = d.strokes.map((s) => { const pts = new Float32Array(s.length * 2), len = [0]; let L = 0; s.forEach((p, i) => { pts[i * 2] = p[0]; pts[i * 2 + 1] = p[1]; if (i) { L += Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]); len.push(L); } }); return { pts, len, L }; });
    return { name: d.name, strokes, total: strokes.reduce((a, s) => a + s.L, 0) };
  }

  // ---- The relay along the bottom: prompt → drawing → guess → ... ----
  const RELAY = [
    { w: 'a cat on a skateboard' }, { d: 1 }, { w: 'cat in a car?' }, { d: 0 }, { w: 'tiny lion taxi' }, { d: 3 },
    { w: 'sun eating a bus' }, { d: 2 }, { w: 'breakfast pizza' }, { d: 4 }, { w: 'a nervous hamburger' }, { d: 5 }, { w: 'flower bus???' }, { d: 0 },
  ];
  const NOTE_COLS = ['#fff27a', '#ffc2d6', '#b8f0c8', '#c9dcff', '#ffd59a'];

  BOX.titles.sketch = {
    logo: '<span class="a">JustSketch</span><span class="b">Relay</span>',
    tagline: 'Draw it, guess it, pass it on. Watch your prompt fall apart.',
    start: '✏️ Grab a pencil',
    meta: '3–100 players · 10–20 min',
    font: "'Permanent Marker', cursive",
    theme: { card: 'rgba(255, 253, 244, 0.95)', ink: INK, muted: '#5a5878', accent: RED, button: '#ffcf3f', buttonInk: INK, border: INK },
    css: `.bt-sketch .bt-logo { text-shadow: none; }
      .bt-sketch .bt-logo .a { display: block; color: ${INK}; font-size: 0.82em; letter-spacing: 0.02em; }
      .bt-sketch .bt-logo .b { display: inline-block; color: ${RED}; font-size: 1.12em; transform: rotate(-4deg); padding: 0 0.25em; margin-top: 0.04em;
        background: linear-gradient(176deg, transparent 18%, rgba(255, 220, 60, 0.85) 20%, rgba(255, 220, 60, 0.85) 82%, transparent 84%); border-radius: 0.3em 0.1em 0.4em 0.15em; }
      .bt-sketch .bt-card { border-radius: 6px 18px 8px 22px; border-width: 3px; box-shadow: 8px 10px 0 rgba(43, 42, 74, 0.85); transform-origin: center; }
      .bt-sketch .bt-card::before { content: ''; position: absolute; left: 50%; top: -16px; width: 130px; height: 32px; transform: translateX(-50%) rotate(-3deg); background: rgba(255, 140, 160, 0.55); border: 1px dashed rgba(43, 42, 74, 0.25); }
      .bt-sketch .bt-card { overflow: visible; }
      .bt-sketch .bt-tag { font-family: 'Caveat Brush', cursive; font-size: clamp(22px, 2vw, 28px); color: #4a4870; }
      .bt-sketch .bt-go { box-shadow: 4px 6px 0 ${INK}; border: 3px solid ${INK}; }
      .bt-sketch .bt-how-btn { font-family: 'Caveat Brush', cursive; font-size: 20px; }`,
    init(W, H) {
      if (document.fonts && document.fonts.load) document.fonts.load(`30px ${HAND}`).catch(() => {});
      const rnd = (a, b) => a + Math.random() * (b - a);
      const s = Math.max(0.6, Math.min(W / 1600, H / 900));
      // Wobble tables for the hand-drawn "line boil" (three frames, cycled slowly).
      const jit = [0, 1, 2].map(() => { const j = new Float32Array(N * 2); for (let i = 0; i < N * 2; i++) j[i] = rnd(-1, 1); return j; });
      // Paper speckles and corner doodles, made once.
      const specks = Array.from({ length: 90 }, () => [rnd(0, W), rnd(0, H), rnd(0.6, 1.8) * s]);
      const notes = RELAY.map((r, i) => ({ ...r, col: NOTE_COLS[i % NOTE_COLS.length], rot: rnd(-0.07, 0.07) }));
      return {
        s, jit, specks, notes,
        shapes: SHAPES.map((sh) => ({ name: sh.name, tint: sh.tint, p: resample(sh.pts()) })),
        doodles: DOODLES.map(prepDoodle),
        buf: new Float32Array(N * 2),
        stars: Array.from({ length: 7 }, (_, i) => ({ x: i < 4 ? rnd(0.03, 0.27) : rnd(0.73, 0.97), y: i < 4 ? rnd(0.03, 0.11) : rnd(0.04, 0.2), r: rnd(10, 18) * s, rot: rnd(0, TAU), ph: rnd(0, TAU) })),
      };
    },
    draw(g, W, H, t, S) {
      const s = S.s, boil = Math.floor(t * 5) % 3, jit = S.jit[boil];
      g.lineCap = 'round'; g.lineJoin = 'round';
      // ---- Sketchbook paper ----
      g.fillStyle = '#fbf6e8'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(110, 160, 220, 0.32)'; g.lineWidth = Math.max(1, 1.5 * s);
      const gap = 38 * s; g.beginPath(); for (let y = gap * 2; y < H; y += gap) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke();
      g.strokeStyle = 'rgba(240, 110, 120, 0.45)'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(W * 0.045, 0); g.lineTo(W * 0.045, H); g.stroke();
      g.fillStyle = 'rgba(120, 100, 70, 0.12)'; for (const p of S.specks) g.fillRect(p[0], p[1], p[2], p[2]);
      // Coffee ring stain, top right.
      g.strokeStyle = 'rgba(160, 110, 60, 0.16)'; g.lineWidth = 7 * s; g.beginPath(); g.arc(W * 0.9, H * 0.13, 58 * s, 0.3, TAU - 0.4); g.stroke();
      g.lineWidth = 2 * s; g.beginPath(); g.arc(W * 0.9 + 4 * s, H * 0.13 + 2 * s, 50 * s, 1.2, TAU + 0.6); g.stroke();
      // Hole punches down the left edge.
      g.fillStyle = '#e4dccb'; for (let y = H * 0.12; y < H; y += H * 0.26) { g.beginPath(); g.arc(W * 0.018, y, 9 * s, 0, TAU); g.fill(); }

      // ---- Little starry doodles in the top corners, gently twisting ----
      g.strokeStyle = INK; g.lineWidth = 2.5 * s;
      for (const st of S.stars) {
        const x = st.x * W, y = st.y * H + Math.sin(t * 1.3 + st.ph) * 4 * s;
        g.save(); g.translate(x, y); g.rotate(st.rot + Math.sin(t * 0.8 + st.ph) * 0.2); g.beginPath();
        for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 0.45 : 1) * st.r; g.lineTo(Math.cos(a) * r + jit[i * 2] * s, Math.sin(a) * r + jit[i * 2 + 1] * s); }
        g.stroke(); g.restore();
      }

      // ---- Left: the morphing scribble and the wrong guesses ----
      const shapes = S.shapes, hold = 1.7, morph = 1.1, per = hold + morph;
      const k = Math.floor(t / per), f = t - k * per, a = shapes[k % shapes.length], b = shapes[(k + 1) % shapes.length];
      let m = f < hold ? 0 : (f - hold) / morph; m = m * m * (3 - 2 * m);
      const mx = W * 0.155, my = H * 0.42, R = Math.min(W * 0.095, H * 0.17), buf = S.buf;
      for (let i = 0; i < N * 2; i++) buf[i] = a.p[i] + (b.p[i] - a.p[i]) * m;
      const tracePath = (ox, oy, amp) => { g.beginPath(); for (let i = 0; i < N; i++) { const x = mx + buf[i * 2] * R + jit[i * 2] * amp + ox, y = my + buf[i * 2 + 1] * R + jit[(i * 2 + 7) % (N * 2)] * amp + oy; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
      // Watercolour-ish fill (slightly off the line, like a hurried colouring-in).
      tracePath(6 * s, 5 * s, 0); g.fillStyle = m < 0.5 ? a.tint : b.tint; g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = INK; g.lineWidth = 5 * s; tracePath(0, 0, 1.6 * s); g.stroke();
      g.lineWidth = 1.6 * s; g.globalAlpha = 0.5; tracePath(2 * s, -2 * s, 2.5 * s); g.stroke(); g.globalAlpha = 1;
      // Speech bubble with the current guess.
      const guess = m < 0.5 ? a.name : b.name, pop = f < 0.25 ? f / 0.25 : (f > hold + morph * 0.5 && f < hold + morph * 0.75 ? 0.6 : 1);
      const gx = mx, gy = my + R * 1.45 + 30 * s;
      g.font = `${Math.round(40 * s)}px ${HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const tw = g.measureText('is it ' + guess).width + 36 * s;
      g.save(); g.translate(gx, gy); g.rotate(-0.04); g.scale(0.85 + 0.15 * pop, 0.85 + 0.15 * pop);
      g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 3 * s; g.beginPath(); g.roundRect(-tw / 2, -30 * s, tw, 60 * s, 26 * s); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-14 * s, -30 * s); g.lineTo(-4 * s, -50 * s); g.lineTo(6 * s, -30 * s); g.fillStyle = '#fff'; g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.fillRect(-12 * s, -32 * s, 16 * s, 6 * s);
      g.fillStyle = INK; g.fillText('is it ', -g.measureText(guess).width / 2, 2 * s);
      g.fillStyle = RED; g.fillText(guess, g.measureText('is it ').width / 2, 2 * s);
      g.restore();
      // Previous guesses, crossed out above it.
      g.font = `${Math.round(30 * s)}px ${HAND}`; g.fillStyle = 'rgba(43,42,74,0.55)';
      for (let j = 1; j <= 2; j++) {
        const old = shapes[(k - j + shapes.length * 4 + (m >= 0.5 ? 1 : 0)) % shapes.length].name, ox = mx + (j === 1 ? -0.5 : 0.55) * R, oy = my - R * 1.25 - (j - 1) * 36 * s;
        g.fillText(old, ox, oy); const w = g.measureText(old).width;
        g.strokeStyle = RED; g.lineWidth = 3 * s; g.beginPath(); g.moveTo(ox - w / 2 - 4 * s, oy + 3 * s); g.lineTo(ox + w / 2 + 4 * s, oy - 4 * s); g.stroke();
      }

      // ---- Right: a pencil drawing doodles stroke by stroke ----
      const dd = S.doodles, dper = 4.6, dk = Math.floor(t / dper), df = t - dk * dper, doo = dd[dk % dd.length];
      const dx = W * 0.845, dy = H * 0.43, DR = Math.min(W * 0.085, H * 0.16);
      const prog = Math.min(1, df / 3) * doo.total, fade = df > dper - 0.5 ? (dper - df) / 0.5 : 1;
      g.globalAlpha = fade; g.strokeStyle = BLUE; g.lineWidth = 5 * s;
      let left = prog, tipX = dx, tipY = dy;
      for (const st of doo.strokes) {
        if (left <= 0) break;
        const P = st.pts, n = P.length / 2;
        g.beginPath(); g.moveTo(dx + P[0] * DR, dy + P[1] * DR); tipX = dx + P[0] * DR; tipY = dy + P[1] * DR;
        for (let i = 1; i < n; i++) {
          if (st.len[i] <= left) { tipX = dx + P[i * 2] * DR + jit[i % N] * s; tipY = dy + P[i * 2 + 1] * DR + jit[(i + 3) % N] * s; g.lineTo(tipX, tipY); }
          else { const u = (left - st.len[i - 1]) / (st.len[i] - st.len[i - 1]); tipX = dx + (P[i * 2 - 2] + (P[i * 2] - P[i * 2 - 2]) * u) * DR; tipY = dy + (P[i * 2 - 1] + (P[i * 2 + 1] - P[i * 2 - 1]) * u) * DR; g.lineTo(tipX, tipY); break; }
        }
        g.stroke(); left -= st.L;
      }
      // Prompt card above the doodle.
      g.font = `${Math.round(34 * s)}px ${HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const pr = 'draw: ' + doo.name, pw = g.measureText(pr).width + 34 * s;
      g.save(); g.translate(dx, dy - DR * 1.45 - 10 * s); g.rotate(0.035);
      g.fillStyle = '#fff27a'; g.fillRect(-pw / 2, -26 * s, pw, 52 * s);
      g.fillStyle = 'rgba(255,140,160,0.6)'; g.fillRect(-26 * s, -36 * s, 52 * s, 16 * s);
      g.fillStyle = INK; g.fillText(pr, 0, 2 * s); g.restore();
      // Countdown under the doodle, like the in-game timer.
      const secs = Math.max(0, Math.ceil(3 - df));
      g.font = `${Math.round(30 * s)}px ${HAND}`; g.fillStyle = secs <= 1 ? RED : INK;
      g.fillText(df < 3 ? `⏱ ${secs}…` : 'pass it on! →', dx, dy + DR * 1.35 + 24 * s);
      g.globalAlpha = 1;
      // The pencil itself (drawn, not an emoji), resting on the tip of the line.
      const lift = df > 3 ? Math.min(1, (df - 3) / 0.4) : 0, px = tipX + lift * 30 * s, py = tipY - lift * 40 * s;
      g.save(); g.translate(px, py); g.rotate(-0.85 + Math.sin(t * 9) * 0.04 * (1 - lift)); const ps = 1.25 * s;
      g.fillStyle = INK; g.beginPath(); g.moveTo(0, 0); g.lineTo(9 * ps, -5 * ps); g.lineTo(9 * ps, 5 * ps); g.fill();
      g.fillStyle = '#f2c99a'; g.beginPath(); g.moveTo(5 * ps, -3 * ps); g.lineTo(26 * ps, -10 * ps); g.lineTo(26 * ps, 10 * ps); g.lineTo(5 * ps, 3 * ps); g.fill();
      g.fillStyle = '#ffc93c'; g.fillRect(26 * ps, -10 * ps, 92 * ps, 20 * ps);
      g.fillStyle = '#e8a91c'; g.fillRect(26 * ps, 3 * ps, 92 * ps, 7 * ps);
      g.fillStyle = '#b9bcc8'; g.fillRect(118 * ps, -10 * ps, 14 * ps, 20 * ps);
      g.fillStyle = '#ff8fa8'; g.beginPath(); g.roundRect(132 * ps, -10 * ps, 18 * ps, 20 * ps, [0, 6 * ps, 6 * ps, 0]); g.fill();
      g.strokeStyle = INK; g.lineWidth = 2 * s; g.strokeRect(26 * ps, -10 * ps, 106 * ps, 20 * ps);
      g.restore();

      // ---- Bottom: the relay of sticky notes sliding past ----
      const notes = S.notes, nw = 190 * s, nh = 112 * s, step = nw + 70 * s, chainW = notes.length * step;
      const off = (t * 55 * s) % chainW, ny = H - nh / 2 - 22 * s;
      g.font = `${Math.round(27 * s)}px ${HAND}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < notes.length; i++) {
        let x = i * step - off + nw / 2; if (x < -step) x += chainW; if (x > W + step) continue;
        for (let rep = 0; rep < 2; rep++) {
          const cx = x + rep * chainW; if (cx < -step || cx > W + step) continue;
          const nt = notes[i];
          // Dashed arrow to the next note.
          g.strokeStyle = 'rgba(43,42,74,0.6)'; g.lineWidth = 3 * s; g.setLineDash([8 * s, 8 * s]);
          g.beginPath(); g.moveTo(cx + nw / 2 + 8 * s, ny); g.quadraticCurveTo(cx + step / 2, ny - 30 * s, cx + step - nw / 2 - 10 * s, ny); g.stroke(); g.setLineDash([]);
          g.beginPath(); g.moveTo(cx + step - nw / 2 - 22 * s, ny - 9 * s); g.lineTo(cx + step - nw / 2 - 10 * s, ny); g.lineTo(cx + step - nw / 2 - 24 * s, ny + 6 * s); g.stroke();
          g.save(); g.translate(cx, ny + Math.sin(t * 1.5 + i) * 3 * s); g.rotate(nt.rot);
          g.fillStyle = 'rgba(43,42,74,0.18)'; g.fillRect(-nw / 2 + 5 * s, -nh / 2 + 6 * s, nw, nh);
          g.fillStyle = nt.w ? nt.col : '#ffffff'; g.fillRect(-nw / 2, -nh / 2, nw, nh);
          g.strokeStyle = 'rgba(43,42,74,0.35)'; g.lineWidth = 1.5 * s; g.strokeRect(-nw / 2, -nh / 2, nw, nh);
          if (nt.w) {
            g.fillStyle = INK; const words = nt.w.split(' ');
            if (g.measureText(nt.w).width > nw - 20 * s) { const h2 = Math.ceil(words.length / 2); g.fillText(words.slice(0, h2).join(' '), 0, -15 * s); g.fillText(words.slice(h2).join(' '), 0, 17 * s); }
            else g.fillText(nt.w, 0, 0);
          } else {
            // A tiny version of one of the morph shapes.
            const p = S.shapes[nt.d].p, r = nh * 0.33;
            g.strokeStyle = INK; g.lineWidth = 3 * s; g.beginPath();
            for (let j = 0; j < N; j += 2) { const X = p[j * 2] * r + jit[j] * s, Y = p[j * 2 + 1] * r + jit[j + 1] * s; j ? g.lineTo(X, Y) : g.moveTo(X, Y); }
            g.closePath(); g.stroke();
          }
          g.restore();
        }
      }

      // ---- Top: a paper plane looping along a dashed trail ----
      const pt = t * 0.16, path = (u) => [((u % 1) * (W + 300)) - 150, H * 0.1 + Math.sin(u * TAU * 2) * H * 0.045];
      g.strokeStyle = 'rgba(61,123,217,0.55)'; g.lineWidth = 2.5 * s; g.setLineDash([6 * s, 10 * s]); g.beginPath();
      for (let j = 0; j <= 30; j++) { const u = pt - 0.25 + j / 30 * 0.25; if (u % 1 > pt % 1) continue; const [x, y] = path(u); j ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke(); g.setLineDash([]);
      const [ax, ay] = path(pt), [bx, by] = path(pt + 0.002);
      g.save(); g.translate(ax, ay); g.rotate(Math.atan2(by - ay, bx - ax)); const q = 1.5 * s;
      g.fillStyle = '#ffffff'; g.strokeStyle = INK; g.lineWidth = 2.5 * s;
      g.beginPath(); g.moveTo(28 * q, 0); g.lineTo(-22 * q, -16 * q); g.lineTo(-12 * q, 0); g.lineTo(-22 * q, 14 * q); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#dfe6f5'; g.beginPath(); g.moveTo(28 * q, 0); g.lineTo(-12 * q, 0); g.lineTo(-18 * q, 7 * q); g.closePath(); g.fill(); g.stroke();
      g.restore();
    },
  };
})();
