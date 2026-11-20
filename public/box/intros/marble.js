'use strict';
// JustMarble intro: a cosy woodworking shop at night. A hanging lamp clicks on over the bench,
// where three phone-sized pieces of a wooden labyrinth lie side by side; a glass marble rolls
// across all three, hopping the gaps between them, and drops into the goal. Then Tilly Burl
// (canvas apron, pencil behind the ear) welcomes everyone. In the roll call every player rolls
// in as a marble and settles into their own carved cup.
// Engine + API: public/box/show.js ('cast' mode).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, back, rng, OUT, TAU } = ST.util, { rr, text } = ST.draw;
  const LOGO = '"Lilita One", sans-serif';
  const R = rng(5150);
  // Three pieces of maze on the bench (each 5 x 7 cells), and the marble's route across them.
  const CW = 5, CH = 7, CS = 62, GAP = 46, PX0 = 960 - (3 * CW * CS + 2 * GAP) / 2, PY0 = 330;
  const WALLS = (() => { // a hand-made little maze: [piece, x, y, 'h'|'v'] wall segments
    const w = []; const r2 = rng(77);
    for (let p = 0; p < 3; p++) for (let y = 0; y <= CH; y++) for (let x = 0; x <= CW; x++) {
      if (y < CH && (x === 0 || x === CW)) { if (!(y === 3 && ((x === CW && p < 2) || (x === 0 && p > 0)))) w.push([p, x, y, 'v']); }
      else if (y < CH && r2() < 0.28) w.push([p, x, y, 'v']);
      if (x < CW && (y === 0 || y === CH)) w.push([p, x, y, 'h']); else if (x < CW && r2() < 0.3 && y !== 3 && y !== 4) w.push([p, x, y, 'h']);
    }
    return w;
  })();
  const cell = (p, x, y) => [PX0 + p * (CW * CS + GAP) + (x + 0.5) * CS, PY0 + (y + 0.5) * CS];
  const ROUTE = [cell(0, 1, 0), cell(0, 1, 2), cell(0, 2, 3), cell(0, 4, 3), cell(1, 0, 3), cell(1, 2, 3), cell(1, 2, 5), cell(1, 4, 5), cell(1, 4, 3), cell(2, 0, 3), cell(2, 3, 3), cell(2, 3, 6)];
  const GOAL = ROUTE[ROUTE.length - 1];
  const dust = Array.from({ length: 40 }, () => [R() * 1920, R() * 900, 1 + R() * 2.5, R() * TAU]);

  function marble(g, x, y, r, spin = 0, tint = '#6fb7ff') {
    g.fillStyle = 'rgba(30,12,2,0.35)'; g.beginPath(); g.ellipse(x + r * 0.25, y + r * 0.4, r, r * 0.75, 0, 0, TAU); g.fill();
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, '#f4fbff'); gr.addColorStop(0.35, tint); gr.addColorStop(0.85, '#3a3fd6'); gr.addColorStop(1, '#1d1773');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(x, y, r * 0.9, 0, TAU); g.clip(); g.strokeStyle = 'rgba(255,90,160,0.75)'; g.lineWidth = r * 0.28; g.beginPath();
    for (let a = 0; a < 5; a += 0.2) { const rr2 = r * (0.15 + a * 0.15); g.lineTo(x + Math.cos(a + spin) * rr2, y + Math.sin(a + spin) * rr2 * 0.6); } g.stroke(); g.restore();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.42, r * 0.22, r * 0.14, -0.6, 0, TAU); g.fill();
  }
  function planks(g, x, y, w, h, base, seed) {
    const r = rng(seed); g.fillStyle = base; g.fillRect(x, y, w, h);
    for (let yy = y; yy < y + h; yy += 70) { g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.1})`; g.fillRect(x, yy, w, 3); g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { const gy = yy + 10 + r() * 55; g.beginPath(); for (let xx = x; xx <= x + w; xx += 40) g.lineTo(xx, gy + Math.sin(xx * 0.01 + k) * 4); g.stroke(); } }
  }
  function pieces(g, o) {
    for (let p = 0; p < 3; p++) {
      const x = PX0 + p * (CW * CS + GAP), w = CW * CS, h = CH * CS;
      rr(g, x - 22, PY0 - 22, w + 44, h + 44, 26); g.fillStyle = '#16131c'; g.fill(); // the phone
      const gr = g.createLinearGradient(x, PY0, x + w, PY0 + h); gr.addColorStop(0, '#ecc991'); gr.addColorStop(1, '#d6a96c'); g.fillStyle = gr; g.fillRect(x, PY0, w, h);
      g.strokeStyle = 'rgba(120,70,25,0.12)'; g.lineWidth = 2; for (let k = 0; k < 14; k++) { const gy = PY0 + 10 + k * 31; g.beginPath(); for (let xx = x; xx <= x + w; xx += 20) g.lineTo(xx, gy + Math.sin(xx * 0.03 + k + p) * 3); g.stroke(); }
    }
    g.lineCap = 'round';
    for (const pass of [0, 1]) {
      g.strokeStyle = pass ? '#6b3a17' : 'rgba(40,18,4,0.4)'; g.lineWidth = 11; g.beginPath();
      for (const [p, x, y, d] of WALLS) { const X = PX0 + p * (CW * CS + GAP) + x * CS + (pass ? 0 : 4), Y = PY0 + y * CS + (pass ? 0 : 6); g.moveTo(X, Y); if (d === 'v') g.lineTo(X, Y + CS); else g.lineTo(X + CS, Y); }
      g.stroke();
    }
    // the goal cup
    g.save(); g.translate(GOAL[0], GOAL[1]); g.strokeStyle = '#ffd23f'; g.lineWidth = 6; g.setLineDash([10, 8]); g.lineDashOffset = -(o.t || 0) * 30; g.beginPath(); g.arc(0, 0, 24, 0, TAU); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#1a0c04'; g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.fill(); g.restore();
  }
  function logo(g, s, lit) {
    g.save(); g.globalAlpha = Math.max(0, Math.min(1, lit));
    rr(g, -380, -110, 760, 220, 34); const gr = g.createLinearGradient(0, -110, 0, 110); gr.addColorStop(0, '#e9c48c'); gr.addColorStop(1, '#c9955a'); g.fillStyle = gr; g.fill();
    g.lineWidth = 12; g.strokeStyle = '#6b3a17'; g.stroke();
    for (const [x, y] of [[-350, -80], [350, -80], [-350, 80], [350, 80]]) { g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); }
    text(g, 'Just', -170, 6, 104, '#3b1d08', { font: LOGO });
    text(g, 'Marble', 120, 6, 104, '#2f47d6', { font: LOGO, stroke: '#f6dcae' });
    g.restore();
  }
  function stage(g, s, o = {}) {
    const t = s.t;
    planks(g, -600, -300, 3120, 1100, '#4a2a12', 11); // the shop wall
    // pegboard with tool silhouettes
    rr(g, 140, 40, 520, 240, 10); g.fillStyle = '#8a6a44'; g.fill();
    g.fillStyle = 'rgba(40,20,5,0.55)'; for (let y = 60; y < 270; y += 26) for (let x = 160; x < 650; x += 26) { g.beginPath(); g.arc(x, y, 3, 0, TAU); g.fill(); }
    g.fillStyle = '#2b170a'; rr(g, 200, 90, 26, 150, 8); g.fill(); rr(g, 260, 80, 90, 24, 8); g.fill(); rr(g, 400, 100, 140, 18, 6); g.fill(); g.beginPath(); g.arc(600, 160, 40, 0, TAU); g.fill();
    rr(g, 1300, 60, 460, 200, 10); g.fillStyle = '#3b2010'; g.fill(); // shelf of finished boards
    for (let i = 0; i < 5; i++) { rr(g, 1320 + i * 88, 90, 70, 150, 8); g.fillStyle = i % 2 ? '#d9ad70' : '#c9955a'; g.fill(); }
    // the bench
    let gr = g.createLinearGradient(0, 760, 0, 1300); gr.addColorStop(0, '#7a4a22'); gr.addColorStop(1, '#3b2010'); g.fillStyle = gr; g.fillRect(-600, 250, 3120, 1100);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-600, 250, 3120, 12);
    if (!o.bare) pieces(g, { t });
    if (o.extra) o.extra(g, s);
    // the lamp's warm cone
    const lit = o.lights == null ? 1 : o.lights;
    gr = g.createRadialGradient(960, 560, 50, 960, 560, 900); gr.addColorStop(0, `rgba(255,214,150,${0.22 * lit})`); gr.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    g.fillStyle = '#1a0c04'; g.fillRect(955, -300, 10, 330); rr(g, 880, 20, 160, 70, 30); g.fill();
    g.fillStyle = `rgba(255,240,200,${lit})`; g.beginPath(); g.ellipse(960, 92, 60, 12, 0, 0, TAU); g.fill();
    for (const [x0, y0, r, ph] of dust) { const a = 0.25 * lit * (0.5 + 0.5 * Math.sin(t + ph)); g.fillStyle = `rgba(255,230,180,${a})`; g.beginPath(); g.arc(x0 + Math.sin(t * 0.3 + ph) * 20, (y0 + t * 8) % 900, r, 0, TAU); g.fill(); }
    if (o.host !== false) s.hostAt(960, 960, 0.8);
    if (lit < 1) { g.fillStyle = `rgba(10,4,0,${(1 - lit) * 0.88})`; g.fillRect(-600, -300, 3120, 1700); }
    if (o.logo) { g.save(); g.translate(960, 150); logo(g, s, o.logo); g.restore(); }
  }
  // The marble's run across the three phones, hopping the gaps between them.
  function run(g, s) {
    const dur = 2600, k = Math.min(1, s.T / dur), seg = k * (ROUTE.length - 1), i = Math.min(ROUTE.length - 2, Math.floor(seg)), f = ease(seg - i);
    const a = ROUTE[i], b = ROUTE[i + 1], hop = Math.abs(a[0] - b[0]) > CS * 1.5 && Math.floor((a[0] - PX0) / (CW * CS + GAP)) !== Math.floor((b[0] - PX0) / (CW * CS + GAP)) ? Math.sin(f * Math.PI) * 40 : 0;
    let x = lerp(a[0], b[0], f), y = lerp(a[1], b[1], f) - hop, r = 22;
    if (s.T > dur) { const u = Math.min(1, (s.T - dur) / 400); x = GOAL[0]; y = GOAL[1]; r = 22 * (1 - u * 0.7); }
    s.cam(lerp(820, 1000, ease(k)), lerp(520, 560, k), lerp(1.5, 1.25, ease(k)));
    stage(g, s, { host: false });
    marble(g, x, y, r, s.T / 120);
    if (s.T > dur) {
      const u = (s.T - dur) / 1000;
      for (let j = 0; j < 26; j++) { const ang = (j / 26) * TAU, v = 120 + (j % 4) * 60; g.globalAlpha = Math.max(0, 1 - u); g.fillStyle = j % 2 ? '#ffd23f' : '#fff'; g.fillRect(GOAL[0] + Math.cos(ang) * v * u - 5, GOAL[1] + Math.sin(ang) * v * u - 5, 10, 10); }
      g.globalAlpha = 1;
      const kk = back(Math.min(1, (s.T - dur) / 420));
      if (kk > 0) { g.save(); g.translate(GOAL[0], GOAL[1] - 120); g.scale(kk, kk); rr(g, -150, -46, 300, 92, 46); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke(); text(g, 'HOME!', 0, 4, 56, '#3b1d08', { font: LOGO }); g.restore(); }
    }
  }
  // Tilly Burl: canvas apron over a flannel shirt, a pencil behind the ear, a carving tool.
  const look = { skin: '#c98d62', skinShade: '#a8714a', suit: '#b5462c', suit2: '#7a2a18', sleeve: '#b5462c', lapel: '#d9c39a', shirt: '#d9c39a', cuff: '#d9c39a', tie: 'long', tieColor: '#8a6a44', hair: 'bun', hairColor: '#5a3418', brow: '#4a2a12', prop: 'mic', grin: true, sparkle: '#ffd23f' };
  const TINTS = ['#6fb7ff', '#ff7ac6', '#8bd346', '#ffb400', '#3ee6ff', '#b18cff', '#ff5a5f'];
  function roll(g, s, F, u, per, o) {
    const n = F.length;
    s.cam(960, 540, 1); stage(g, s, { host: false, bare: true });
    g.fillStyle = 'rgba(10,4,0,0.45)'; g.fillRect(-600, -300, 3120, 1700);
    text(g, 'TONIGHT’S MARBLE MASTERS', 960, 140, 76, '#ffd23f', { font: LOGO, stroke: '#3b1d08' });
    const cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), tw = Math.min(260, 1640 / Math.max(1, cols));
    F.forEach((c, i) => {
      const at = i * per, k = (u - at) / 700; if (k <= 0) return;
      const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
      const x = 960 + (col - (rowN - 1) / 2) * tw, y = (rows > 1 ? 450 : 560) + row * 300, rad = Math.min(rows > 1 ? 62 : 80, tw * 0.32);
      // a carved cup on the bench
      g.fillStyle = '#2b170a'; g.beginPath(); g.ellipse(x, y + rad * 0.85, rad * 1.15, rad * 0.4, 0, 0, TAU); g.fill();
      const roll2 = Math.min(1, k), xx = roll2 < 1 ? lerp(-200, x, ease(roll2)) : x, settle = roll2 < 1 ? 0 : Math.sin(Math.min(1, (u - at - 700) / 500) * Math.PI * 3) * 8 * Math.max(0, 1 - (u - at - 700) / 500);
      marble(g, xx + settle, y, rad, (u - at) / 90, c.color || TINTS[i % TINTS.length]);
      s.face(c, xx + settle, y, rad * 0.9);
      if (k > 0.7) text(g, c.name, x, y + rad + 50, 32, '#fff2dc', { max: tw * 0.85, font: LOGO });
    });
    if (o.more && u > n * per - 1200) text(g, '…and ' + o.more + ' more marble masters!', 960, 1010, 50, '#ffe7a8', { font: LOGO });
  }
  BOX.intros = BOX.intros || {};
  BOX.intros.marble = {
    title: 'JustMarble',
    // How to play (box/howto.js): one card per step (module howSteps = 6).
    tutorial: [
      { icon: '📱', title: 'Your piece of the maze', text: 'Every phone shows one piece of a wooden maze. Put your phones together, screens up, just like the map on the TV.', phone: 'Look for your board number, then put your phone next to your neighbours and tap ✋ I’m ready.', say: 'Every phone shows one piece of a wooden maze. Put your phones together, just like the map on the TV!' },
      { icon: '🔮', title: 'Drag to roll', text: 'The marble starts on one phone. Whoever has it holds a finger on their board and drags the way it should roll.', phone: 'When the marble is on your phone, hold a finger on the board and drag. Drag further to roll faster.' },
      { icon: '➡️', title: 'Pass it on', text: 'Roll it through a gap at the edge (the little yellow arrows) and it lands on your neighbour’s phone.', phone: 'Yellow arrows at the edge of your board are gaps to your neighbours.' },
      { icon: '🗣️', title: 'Work it out together', text: 'Nobody can see the whole maze alone. Talk! The TV only uncovers the maze where the marble has been.' },
      { icon: '🕳️', title: 'Holes and twists', text: 'Holes send the marble back to where it came onto your board. Each maze has a twist: ice, a backwards board, gems everywhere…' },
      { icon: '🏁', title: 'Scoring', text: 'Clear the maze and everyone scores, more with time to spare. +30 for a pass that gets closer, +25 per 💎, +50 for sinking it, −15 per hole.', say: 'Scoring. Clear the maze and everyone scores, more with time to spare. 30 points for a pass that gets closer, 25 for every gem, and 50 for sinking it. Each hole costs 15.' },
    ],
    theme: { accent: '#ffd23f', accent2: '#2f47d6', accent3: '#e3bb80', ink: '#fff2dc', fade: '#170b04', confetti: ['#ffd23f', '#6fb7ff', '#ff7ac6', '#e3bb80', '#ffffff'] },
    host: {
      name: 'Tilly Burl',
      voice: { kokoro: 'bf_isabella', cb: 'warm', speed: 0.93, like: /female|libby|sonia|hazel|samantha|zira/i, accent: /en-GB|en-US/i, pitch: 1.05, rate: 1.0 },
      look,
    },
    lines: {
      welcome: 'Welcome to the workshop! I carved you a maze, and every one of you holds a piece of it!',
      roll: 'Let’s meet tonight’s marble masters!', more: '…and {n} more marble masters!', others: 'And everyone else around the table!',
      play: 'Phones together, steady hands, and roll it home!',
    },
    stage, logo, roll,
    podiumGlyph: '🔮',
    hostCam: { x: 960, y: 700, z: 1.35 },
    castOpening: [
      { ms: 2400, sfx: [[250, 'click'], [1200, 'swell']],
        draw(g, s) { const lit = ss(250, 900, s.T); s.cam(960, lerp(420, 520, ease(s.k)), lerp(1.6, 1.15, ease(s.k))); stage(g, s, { host: false, lights: 0.15 + 0.85 * lit, logo: ss(900, 2000, s.T) }); } },
      { ms: 3300, sfx: [[100, 'whoosh'], [2600, 'win']], draw: run },
      { ms: 2800, sfx: [[0, 'whoosh'], [300, 'cheer']], pose: [[0, 'wave', 1500], [1600, 'point', 1000]], say: 'welcome', sayAt: 150, fit: 2800, crowd: [[200, 'cheer', 2000]],
        draw(g, s) { const k = ease(s.T / 1800); s.cam(960, lerp(560, 660, k), lerp(1, 1.3, k)); stage(g, s, { logo: k < 0.5 ? 1 - k * 2 : 0 }); } },
    ],
  };
})();
