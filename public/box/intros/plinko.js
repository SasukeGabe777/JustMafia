'use strict';
// JustDrop intro: a dark casino stage. Marquee bulbs blink on around the JUSTDROP sign, the
// camera rides down a giant glowing peg wall as one golden ball rattles into the JACKPOT,
// then Rocco Ricochet (sequinned jacket, slicked hair) opens the machine. In the roll call
// every player drops in as a ball and lands on their own slot.
// Engine + API: public/box/show.js ('cast' mode).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, OUT, TAU } = ST.util, { rr, text } = ST.draw;
  const BUNGEE = '"Bungee", "Lilita One", sans-serif';
  try { if (document.fonts) document.fonts.load('80px "Bungee"'); } catch { /* fine */ }
  const R = rng(4242);
  const WALL = { x0: 360, x1: 1560, y0: 120, y1: 760 };
  const PEGS = []; for (let r = 0; r < 10; r++) { const y = WALL.y0 + 40 + r * 64, off = r % 2 ? 40 : 0; for (let x = WALL.x0 + 40 + off; x < WALL.x1 - 20; x += 80) PEGS.push([x, y]); }
  const SLOTS = [['50', '#7a1630'], ['BUST', '#16121a'], ['200', '#5e0f24'], ['JACKPOT', '#ffd23f'], ['100', '#7a1630'], ['×2', '#1f9e5c'], ['BUST', '#16121a'], ['75', '#5e0f24']];
  const BALLC = ['#ff5a5f', '#ffb400', '#00d0b5', '#7b61ff', '#ff7ac6', '#3ec1ff', '#8bd346'];
  // A pre-baked golden-ball path down the wall into the jackpot (zig-zag between pegs).
  const GOLD = (() => { const pts = [[880, 90]]; let x = 880; for (let r = 0; r < 10; r++) { x += (r % 3 === 1 ? -40 : 40) * (r < 5 ? 1 : -0.5); pts.push([x, WALL.y0 + 40 + r * 64 - 18]); } pts.push([960 - 0, 810]); return pts; })();
  const bokeh = Array.from({ length: 18 }, () => [R() * 1920, 60 + R() * 700, 30 + R() * 60, R() * TAU]);

  function ball(g, x, y, r, c, glow = 0) {
    g.save(); if (glow) { g.shadowColor = c; g.shadowBlur = glow; }
    const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r); gr.addColorStop(0, '#fff'); gr.addColorStop(0.28, c); gr.addColorStop(1, '#1a0b2a');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
  }
  function bulbs(g, x, y, w, h, t, lit, n = 30) {
    for (let i = 0; i < n; i++) {
      const u = i / n, per = 2 * (w + h), d = u * per; let bx, by;
      if (d < w) { bx = x + d; by = y; } else if (d < w + h) { bx = x + w; by = y + d - w; } else if (d < 2 * w + h) { bx = x + w - (d - w - h); by = y + h; } else { bx = x; by = y + h - (d - 2 * w - h); }
      const on = lit > i / n && (i + Math.floor(t * 8)) % 3 !== 0;
      g.fillStyle = on ? '#fff6c8' : 'rgba(255,230,160,0.18)'; g.beginPath(); g.arc(bx, by, 9, 0, TAU); g.fill();
      if (on) { g.fillStyle = 'rgba(255,220,120,0.25)'; g.beginPath(); g.arc(bx, by, 18, 0, TAU); g.fill(); }
    }
  }
  function wall(g, s, o) {
    const t = s.t;
    rr(g, WALL.x0 - 30, WALL.y0 - 30, WALL.x1 - WALL.x0 + 60, 880 - WALL.y0, 40);
    const gr = g.createLinearGradient(0, WALL.y0, 0, 900); gr.addColorStop(0, '#4a0b1f'); gr.addColorStop(1, '#16030b'); g.fillStyle = gr; g.fill();
    g.lineWidth = 12; g.strokeStyle = '#d4a73c'; g.stroke();
    for (const [x, y] of PEGS) {
      const hit = o.gold != null ? Math.max(0, 1 - Math.hypot(x - o.gold[0], y - o.gold[1]) / 90) : 0;
      const tw = 0.6 + 0.4 * Math.sin(t * 3 + x * 0.05 + y * 0.03);
      g.fillStyle = hit > 0 ? '#fff' : `rgba(255, 231, 168, ${0.55 + 0.45 * tw * (o.lit == null ? 1 : o.lit)})`;
      g.beginPath(); g.arc(x, y, 9 + hit * 8, 0, TAU); g.fill();
    }
    const sw = (WALL.x1 - WALL.x0) / SLOTS.length;
    SLOTS.forEach(([lab, c], i) => {
      const x = WALL.x0 + i * sw, jk = lab === 'JACKPOT';
      g.fillStyle = c; g.fillRect(x, 780, sw, 90);
      if (jk && o.jack) { g.fillStyle = `rgba(255,255,255,${0.5 * o.jack})`; g.fillRect(x, 780, sw, 90); }
      g.fillStyle = '#eee'; g.fillRect(x - 3, 780, 6, 90);
      text(g, lab, x + sw / 2, 826, lab.length > 4 ? 26 : 36, jk ? '#3a2300' : '#fff', { font: BUNGEE });
    });
  }
  function logo(g, s, lit) {
    rr(g, -400, -120, 800, 240, 40); g.fillStyle = 'rgba(40, 4, 26, 0.94)'; g.fill(); g.lineWidth = 8; g.strokeStyle = '#d4a73c'; g.stroke();
    bulbs(g, -380, -100, 760, 200, s.t, lit, 34);
    g.save(); g.globalAlpha = Math.max(0.15, lit);
    if (lit > 0.2) { g.shadowColor = '#ff2f7d'; g.shadowBlur = 30 * lit; }
    text(g, 'JUST', -150, 4, 110, '#fff4d6', { font: BUNGEE, stroke: '#6d0530' });
    text(g, 'DROP', 150, 4, 110, '#ffd23f', { font: BUNGEE, stroke: '#a3104a' });
    g.restore();
  }
  function stage(g, s, o = {}) {
    const t = s.t;
    let gr = g.createLinearGradient(0, -300, 0, 1100); gr.addColorStop(0, '#12020f'); gr.addColorStop(1, '#2a0820'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    for (const [x0, y, r, ph] of bokeh) { const x = ((x0 + t * 20) % 2200) - 140, a = 0.12 + 0.1 * Math.sin(t + ph); const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(255,120,200,${a})`); rg.addColorStop(1, 'rgba(255,120,200,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    // velvet curtains
    for (const side of [-1, 1]) { const cx = side < 0 ? -200 : 2120; gr = g.createLinearGradient(cx - 300, 0, cx + 300, 0); gr.addColorStop(0, '#5a0018'); gr.addColorStop(0.5, '#a3103a'); gr.addColorStop(1, '#3a0010'); g.fillStyle = gr; g.fillRect(cx - 300, -300, 600, 1500); }
    wall(g, s, o);
    // stage floor
    gr = g.createLinearGradient(0, 880, 0, 1300); gr.addColorStop(0, '#3a0d4f'); gr.addColorStop(1, '#0b0216'); g.fillStyle = gr; g.fillRect(-600, 880, 3120, 600);
    g.fillStyle = '#d4a73c'; g.fillRect(-600, 878, 3120, 6);
    if (o.extra) o.extra(g, s);
    if (o.host !== false) s.hostAt(960, 960, 0.8);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(4,0,10,${(1 - o.lights) * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
    if (o.logo !== 0) { g.save(); g.translate(960, 170); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
    s.spots(o.spots == null ? 0.35 : o.spots);
  }
  function goldShot(g, s) {
    const T = s.T, dur = 1700, k = Math.min(1, T / dur);
    const seg = k * (GOLD.length - 1), i = Math.min(GOLD.length - 2, Math.floor(seg)), f = seg - i;
    const bounce = Math.abs(Math.sin(f * Math.PI)) * 14;
    const p = [lerp(GOLD[i][0], GOLD[i + 1][0], f), lerp(GOLD[i][1], GOLD[i + 1][1], f) - bounce];
    const jack = T > dur ? Math.max(0, 1 - (T - dur) / 900) : 0;
    s.cam(960, lerp(380, 640, ease(k)), lerp(1.7, 1.45, ease(k)));
    stage(g, s, { logo: 0, host: false, spots: 0.2, gold: p, jack });
    for (let j = 1; j < 8; j++) { const q = Math.max(0, seg - j * 0.18); const ii = Math.min(GOLD.length - 2, Math.floor(q)), ff = q - ii; g.globalAlpha = 0.35 * (1 - j / 8); ball(g, lerp(GOLD[ii][0], GOLD[ii + 1][0], ff), lerp(GOLD[ii][1], GOLD[ii + 1][1], ff), 26, '#ffd23f'); }
    g.globalAlpha = 1; ball(g, p[0], p[1], 28, '#ffd23f', 40);
    if (T > dur) {
      const u = T - dur;
      for (let j = 0; j < 40; j++) { const a = (j / 40) * TAU + j, v = 300 + (j % 5) * 120, tt = u / 1000; g.globalAlpha = Math.max(0, 1 - tt); g.fillStyle = j % 2 ? '#ffe14d' : '#fff'; g.fillRect(960 + Math.cos(a) * v * tt - 6, 790 + Math.sin(a) * v * tt + 600 * tt * tt - 6, 12, 12); }
      g.globalAlpha = 1;
      const kk = back(u / 420);
      if (kk > 0) { g.save(); g.translate(960, 640); g.scale(kk, kk); rr(g, -260, -60, 520, 120, 60); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 8; g.strokeStyle = OUT; g.stroke(); text(g, 'JACKPOT!', 0, 6, 74, '#3a2300', { font: BUNGEE }); g.restore(); }
    }
  }
  // Rocco Ricochet: a sequinned magenta jacket, slicked hair, a big grin and a mic.
  const look = { skin: '#d9a07a', skinShade: '#b97e58', suit: '#c2185b', suit2: '#7a0e3a', sleeve: '#c2185b', lapel: '#1a0b2a', shirt: '#fff4d6', cuff: '#fff4d6', tie: 'bow', tieColor: '#ffd23f', hair: 'pomp', hairColor: '#1a1420', brow: '#1a1420', prop: 'mic', grin: true, sparkle: '#ffd23f' };
  // Roll call: every player drops in as a ball onto their own slot plate.
  function roll(g, s, F, u, per, o) {
    const n = F.length;
    s.cam(960, 540, 1); stage(g, s, { host: false, logo: 0, spots: 0.4, lit: 0.5 });
    g.fillStyle = 'rgba(4,0,10,0.55)'; g.fillRect(-600, -300, 3120, 1700);
    text(g, 'TONIGHT’S HIGH ROLLERS', 960, 140, 76, '#ffd23f', { font: BUNGEE, stroke: '#a3104a' });
    const cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), tw = Math.min(260, 1640 / Math.max(1, cols));
    F.forEach((c, i) => {
      const at = i * per, k = (u - at) / 650; if (k <= 0) return;
      const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
      const x = 960 + (col - (rowN - 1) / 2) * tw, yEnd = (rows > 1 ? 470 : 600) + row * 300;
      const rad = Math.min(rows > 1 ? 66 : 84, tw * 0.34), col2 = c.color || BALLC[i % BALLC.length];
      // the slot plate
      rr(g, x - tw * 0.44, yEnd + rad + 8, tw * 0.88, 60, 14); g.fillStyle = 'rgba(40,4,26,0.95)'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#d4a73c'; g.stroke();
      // the drop with a bounce on landing
      const fall = Math.min(1, k), y = fall < 1 ? lerp(-150, yEnd, fall * fall) : yEnd - Math.abs(Math.sin(Math.min(1, (u - at - 650) / 500) * Math.PI * 2)) * 40 * Math.max(0, 1 - (u - at - 650) / 500);
      ball(g, x, y, rad, col2, 30);
      s.emoji(c.avatar || '🙂', x, y, rad * 0.95);
      if (k > 0.7) text(g, c.name, x, yEnd + rad + 39, 32, '#fff4d6', { max: tw * 0.8, font: '"Lilita One", sans-serif' });
    });
    if (o.more && u > n * per - 1200) text(g, '…and ' + o.more + ' more high rollers!', 960, 1010, 50, '#ffe7a8', { font: '"Lilita One", sans-serif' });
  }
  BOX.intros = BOX.intros || {};
  BOX.intros.plinko = {
    title: 'JustDrop',
    // How to play (box/howto.js): one card per step, 6 steps (module howSteps).
    tutorial: [
      { icon: '🎯', title: 'Aim', text: 'Pick where to drop your ball along the top of the board.', phone: 'Tap along the top of the board, then tap 🎯 Drop here!', say: 'Step right up! First, pick where to drop your ball along the top of the board.' },
      { icon: '✏️', title: 'Draw one line', text: 'See where everyone is dropping, then draw ONE line to steer balls: yours to the jackpot, a rival’s into a bust.', phone: 'Draw with your finger (2 strokes max), then tap ✅ Done!' },
      { icon: '⬇️', title: 'Drop!', text: 'Every ball drops at once. Slots pay money, ×2 doubles your round, STEAL robs the leader and BUST costs you.' },
      { icon: '💸', title: 'Line bonuses', text: 'Your line pays you too: 20% of any good slot a ball you touched lands in, +50 for every rival you bust.' },
      { icon: '🎁', title: 'Power-ups', text: 'Star pegs and 🎁 slots give power-ups: Sticky Ball, Mega Ball, Twin Drop, Eraser and Ink Refill.', phone: 'Got a power-up? Tap it before you lock in your drop.' },
      { icon: '🏆', title: 'Winning', text: 'Each round the board gets harder, and old lines stay as ghosts. Most money wins!' },
    ],
    theme: { accent: '#ffd23f', accent2: '#ff2f7d', accent3: '#3ee6ff', ink: '#fff4d6', fade: '#0b0216', confetti: ['#ffd23f', '#ff2f7d', '#3ee6ff', '#ffffff', '#8bd346'] },
    host: {
      name: 'Rocco Ricochet',
      voice: { like: /guy|davis|christopher|eric|andrew|brian|male/i, accent: /en-US/i, pitch: 1.05, rate: 1.12 },
      look,
    },
    lines: {
      welcome: 'Ladies and gentlemen, step right up to JustDrop! Where every bounce is a gamble!',
      roll: 'Let\'s meet tonight\'s high rollers!', more: '…and {n} more high rollers!', others: 'And everyone else at the machine!',
      play: 'Pick your spot, draw your line, and let it DROP!',
    },
    stage, logo, roll,
    podiumGlyph: '●',
    hostCam: { x: 960, y: 700, z: 1.35 },
    castOpening: [
      { ms: 2400, sfx: [[200, 'click'], [700, 'click'], [1300, 'swell']],
        draw(g, s) { const lit = ss(200, 1800, s.T); s.cam(960, lerp(260, 380, ease(s.k)), lerp(1.8, 1.25, ease(s.k))); stage(g, s, { lights: 0.25 + 0.75 * lit, logo: lit, spots: ss(1400, 2400, s.T) * 0.5, lit }); } },
      { ms: 2900, sfx: [[100, 'whoosh'], [1700, 'win']], draw: goldShot },
      { ms: 2700, sfx: [[0, 'whoosh'], [300, 'cheer']], pose: [[0, 'wave', 1500], [1600, 'point', 1000]], say: 'welcome', sayAt: 150, fit: 2700, crowd: [[200, 'cheer', 2000]],
        draw(g, s) { const k = ease(s.T / 1800); s.cam(960, lerp(520, 640, k), lerp(1, 1.3, k)); stage(g, s, { logo: k < 0.5 ? 1 : 0 }); } },
    ],
  };
})();
