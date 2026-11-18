'use strict';
// JustMarble title screen: a walnut table under a warm lamp, with phones lying side by side.
// Each phone shows its own piece of a maple labyrinth, and glass marbles roll from phone to
// phone through the gaps, hop across, and drop into the goal cup with a sparkle.
(function () {
  const TAU = Math.PI * 2;
  const TINTS = ['#6fb7ff', '#ff7ac6', '#8bd346', '#ffb400', '#b18cff'];
  function marble(g, x, y, r, c, spin) {
    g.fillStyle = 'rgba(20,8,0,0.35)'; g.beginPath(); g.ellipse(x + r * 0.25, y + r * 0.4, r, r * 0.75, 0, 0, TAU); g.fill();
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, '#f4fbff'); gr.addColorStop(0.35, c); gr.addColorStop(1, '#1d1773');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(x, y, r * 0.9, 0, TAU); g.clip(); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = r * 0.22; g.beginPath(); for (let a = 0; a < 5; a += 0.25) g.lineTo(x + Math.cos(a + spin) * r * (0.1 + a * 0.15), y + Math.sin(a + spin) * r * (0.1 + a * 0.1)); g.stroke(); g.restore();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.42, r * 0.22, r * 0.14, -0.6, 0, TAU); g.fill();
  }
  // A small perfect maze over a strip of phones (grid gw x gh, split into phones of pw cells).
  function maze(gw, gh) {
    const cells = new Array(gw * gh).fill(0), seen = new Set([0]), st = [0];
    while (st.length) {
      const c = st[st.length - 1], x = c % gw, y = Math.floor(c / gw);
      const opts = [[1, 0, -1, 4], [2, 1, 0, 8], [4, 0, 1, 1], [8, -1, 0, 2]].filter(([, dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < gw && y + dy < gh && !seen.has((y + dy) * gw + x + dx));
      if (!opts.length) { st.pop(); continue; }
      const [b, dx, dy, bk] = opts[Math.floor(Math.random() * opts.length)], d = (y + dy) * gw + x + dx; cells[c] |= b; cells[d] |= bk; seen.add(d); st.push(d);
    }
    return cells;
  }
  function route(cells, gw, from, to) { // BFS path
    const prev = new Map([[from, -1]]), q = [from];
    for (let i = 0; i < q.length; i++) { const c = q[i], x = c % gw, y = Math.floor(c / gw); for (const [b, dx, dy] of [[1, 0, -1], [2, 1, 0], [4, 0, 1], [8, -1, 0]]) if (cells[c] & b) { const d = (y + dy) * gw + x + dx; if (!prev.has(d)) { prev.set(d, c); q.push(d); } } }
    const p = []; for (let c = to; c !== -1 && c != null; c = prev.get(c)) p.unshift(c); return p;
  }
  BOX.titles.marble = {
    logo: '<span class="a">Just</span><span class="b">Marble</span>',
    tagline: 'Every phone is a piece of the maze. Put them together. Roll it home.',
    start: '▶ Open the workshop', meta: '1–12 players · best 2–6 · 8–15 min',
    font: "'Lilita One', sans-serif",
    theme: { card: 'rgba(43, 23, 10, 0.88)', ink: '#fff2dc', muted: '#e3bb80', accent: '#ffd23f', button: '#2f47d6', buttonInk: '#fff', border: '#c9955a' },
    css: `.bt-marble .bt-logo { font-size: clamp(56px, 9vw, 112px); line-height: 0.95; }
      .bt-marble .bt-logo .a { color: #f6dcae; text-shadow: 0 5px 0 #6b3a17; }
      .bt-marble .bt-logo .b { display: inline-block; color: #8fc8ff; text-shadow: 0 6px 0 #1d1773, 0 0 30px rgba(111, 183, 255, 0.6); animation: btmRoll 3.2s ease-in-out infinite; }
      @keyframes btmRoll { 0%, 100% { transform: rotate(-3deg) translateX(-6px); } 50% { transform: rotate(3deg) translateX(6px); } }
      .bt-marble .bt-card { box-shadow: 0 0 0 4px #6b3a17, 0 0 0 8px #2b170a, 0 30px 60px rgba(0, 0, 0, 0.6); }`,
    init(W, H) {
      const phones = W > 900 ? 4 : 3, pw = 4, ph = 7, gw = phones * pw, gh = ph;
      const cells = maze(gw, gh), path = route(cells, gw, 0, gw * gh - 1);
      return { phones, pw, ph, gw, gh, cells, path, balls: [], next: 0, last: 0, sparks: [] };
    },
    draw(g, W, H, t, S) {
      const dt = Math.min(0.05, t - (S.last || t)); S.last = t;
      // walnut table + lamp light
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#3b2010'); gr.addColorStop(1, '#170b04'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; for (let y = 20; y < H; y += 28) { g.beginPath(); for (let x = 0; x <= W; x += 30) g.lineTo(x, y + Math.sin(x * 0.006 + y) * 6); g.stroke(); }
      gr = g.createRadialGradient(W / 2, H * 0.45, 30, W / 2, H * 0.45, Math.max(W, H) * 0.7); gr.addColorStop(0, 'rgba(255,214,150,0.28)'); gr.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // the phones, side by side
      const cs = Math.min((W * 0.9) / (S.gw + 1.1 * (S.phones - 1)), (H * 0.8) / S.gh), gap = cs * 1.1, bw = S.pw * cs;
      const ox = (W - (S.gw * cs + gap * (S.phones - 1))) / 2, oy = (H - S.gh * cs) / 2;
      const P = (gx, gy) => [ox + gx * cs + Math.floor(Math.min(S.gw - 0.001, Math.max(0, gx)) / S.pw) * gap, oy + gy * cs];
      for (let p = 0; p < S.phones; p++) {
        const x = ox + p * (bw + gap); g.fillStyle = '#100d14'; g.beginPath(); g.roundRect(x - cs * 0.3, oy - cs * 0.5, bw + cs * 0.6, S.gh * cs + cs, cs * 0.4); g.fill();
        gr = g.createLinearGradient(x, oy, x + bw, oy + S.gh * cs); gr.addColorStop(0, '#ecc991'); gr.addColorStop(1, '#d6a96c'); g.fillStyle = gr; g.fillRect(x, oy, bw, S.gh * cs);
      }
      g.lineCap = 'round'; g.lineWidth = Math.max(3, cs * 0.12);
      for (const pass of [0, 1]) {
        g.strokeStyle = pass ? '#6b3a17' : 'rgba(30,12,2,0.4)'; g.beginPath();
        for (let c = 0; c < S.cells.length; c++) {
          const x = c % S.gw, y = Math.floor(c / S.gw), m = S.cells[c], [X, Y] = P(x, y), d = pass ? 0 : cs * 0.06;
          if (!(m & 1)) { g.moveTo(X + d, Y + d); g.lineTo(X + cs + d, Y + d); }
          if (!(m & 8)) { g.moveTo(X + d, Y + d); g.lineTo(X + d, Y + cs + d); }
          if (y === S.gh - 1) { g.moveTo(X + d, Y + cs + d); g.lineTo(X + cs + d, Y + cs + d); }
          if (x === S.gw - 1 || (x % S.pw === S.pw - 1 && !(m & 2))) { g.moveTo(X + cs + d, Y + d); g.lineTo(X + cs + d, Y + cs + d); }
        }
        g.stroke();
      }
      // goal cup
      const [gx, gy] = P(S.gw - 0.5, S.gh - 0.5); g.strokeStyle = '#ffd23f'; g.lineWidth = Math.max(2, cs * 0.07); g.setLineDash([cs * 0.1, cs * 0.08]); g.lineDashOffset = -t * 20; g.beginPath(); g.arc(gx, gy, cs * 0.34, 0, TAU); g.stroke(); g.setLineDash([]);
      g.fillStyle = '#1a0c04'; g.beginPath(); g.arc(gx, gy, cs * 0.26, 0, TAU); g.fill();
      // marbles roll the route, a few at a time
      if (t > S.next && S.balls.length < 4) { S.next = t + 2.2 + Math.random() * 1.5; S.balls.push({ u: 0, c: TINTS[Math.floor(Math.random() * TINTS.length)], v: 3.2 + Math.random() * 1.2 }); }
      for (const b of S.balls) {
        b.u += b.v * dt; const i = Math.floor(b.u), f = b.u - i;
        if (i >= S.path.length - 1) { b.done = true; for (let k = 0; k < 14; k++) S.sparks.push({ x: gx, y: gy, vx: Math.cos(k) * (60 + k * 8), vy: Math.sin(k) * (60 + k * 8) - 60, life: 1 }); continue; }
        const a = S.path[i], c2 = S.path[i + 1], ax = (a % S.gw) + 0.5, ay = Math.floor(a / S.gw) + 0.5, bx = (c2 % S.gw) + 0.5, by = Math.floor(c2 / S.gw) + 0.5;
        const hop = Math.floor(ax / S.pw) !== Math.floor(bx / S.pw) ? Math.sin(f * Math.PI) * 0.5 : 0;
        const [x, y] = P(ax + (bx - ax) * f, ay + (by - ay) * f - hop);
        marble(g, x + (Math.floor(ax / S.pw) !== Math.floor(bx / S.pw) ? gap * (f - 0.5) * 0 : 0), y, cs * 0.24, b.c, b.u * 2);
      }
      S.balls = S.balls.filter((b) => !b.done);
      for (const s of S.sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 200 * dt; s.life -= dt; g.globalAlpha = Math.max(0, s.life); g.fillStyle = '#ffd23f'; g.fillRect(s.x - 3, s.y - 3, 6, 6); }
      g.globalAlpha = 1; S.sparks = S.sparks.filter((s) => s.life > 0);
    },
  };
})();
