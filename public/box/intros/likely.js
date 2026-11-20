'use strict';
// Most Likely To… intro: an awards night. The house lights drop, the velvet curtains part on
// a marquee sign, spotlights find the host (Velvet Vance, sequinned tux and gold mic) at his
// lectern, then a golden envelope opens: "And the nominees are…" (the roll call).
// Engine + API: public/box/show.js.
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, TAU, clamp } = ST.util, { rr, text } = ST.draw;
  const SERIF = '"Abril Fatface", Georgia, serif';
  const WINE = '#5a0b22', GOLD = '#e9b53c', GOLD2 = '#ffd54a', INK = '#4b0a1f';
  try { if (document.fonts) document.fonts.load('40px "Abril Fatface"'); } catch { /* fine */ }
  const r = rng(909);
  const STARS = Array.from({ length: 50 }, () => [r() * 1920, 60 + r() * 600, 1.5 + r() * 2.5, r() * TAU]);
  const CROWD = Array.from({ length: 9 }, (_, i) => ({ x: 380 + i * 145, c: ['#ff6b8b', '#5ec8ff', '#ffb43c', '#8be06b', '#b07cff', '#ff8a4d', '#3fe0c5', '#ff7ad9', '#ffd54a'][i], ph: r() * TAU }));

  function curtainHalf(g, x0, x1, side, t) {
    const w = x1 - x0; if (w <= 2) return;
    const gr = g.createLinearGradient(x0, 0, x1, 0), folds = Math.max(3, Math.round(w / 90));
    for (let i = 0; i <= folds * 2; i++) { const k = i / (folds * 2), sh = 0.5 + 0.5 * Math.sin(k * folds * TAU + t * 0.3); gr.addColorStop(k, `hsl(${348 + sh * 4} ${68 + sh * 12}% ${11 + sh * 24}%)`); }
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0, -40); g.lineTo(x1, -40);
    // the bottom hem sways a little
    for (let x = x1; x >= x0; x -= 40) g.lineTo(x, 820 + Math.sin(x / 70 + t) * 5);
    g.closePath(); g.fill();
    g.fillStyle = GOLD; g.fillRect(side < 0 ? x1 - 10 : x0, -40, 10, 870);
    g.fillRect(x0, 808, w, 12);
  }
  function valance(g) {
    const n = 16, sw = 2600 / n;
    const gr = g.createLinearGradient(0, -40, 0, 120); gr.addColorStop(0, '#3d0616'); gr.addColorStop(1, '#a3163c');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-340, -300); g.lineTo(2260, -300); g.lineTo(2260, 70);
    for (let i = n; i > 0; i--) { g.lineTo(-340 + (i - 1) * sw + sw, 70); g.quadraticCurveTo(-340 + (i - 0.5) * sw, 140, -340 + (i - 1) * sw, 70); }
    g.closePath(); g.fill();
    g.strokeStyle = GOLD; g.lineWidth = 7; g.beginPath(); g.moveTo(2260, 70);
    for (let i = n; i > 0; i--) g.quadraticCurveTo(-340 + (i - 0.5) * sw, 132, -340 + (i - 1) * sw, 70);
    g.stroke();
    g.fillStyle = GOLD; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(-340 + (i + 0.5) * sw, 116, 9, 0, TAU); g.fill(); }
  }
  function crown(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = GOLD2; g.strokeStyle = '#8a5a00'; g.lineWidth = 4; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-60, 0); g.lineTo(-68, -60); g.lineTo(-32, -28); g.lineTo(0, -76); g.lineTo(32, -28); g.lineTo(68, -60); g.lineTo(60, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffea8a'; rr(g, -62, -12, 124, 20, 8); g.fill(); g.stroke();
    g.fillStyle = '#ff3d6e'; g.beginPath(); g.arc(0, -2, 8, 0, TAU); g.fill();
    g.fillStyle = '#4fd7ff'; g.beginPath(); g.arc(-34, -2, 6, 0, TAU); g.arc(34, -2, 6, 0, TAU); g.fill();
    g.fillStyle = '#fff'; for (const [px, py] of [[-68, -60], [0, -76], [68, -60]]) { g.beginPath(); g.arc(px, py, 7, 0, TAU); g.fill(); }
    g.restore();
  }
  function pedestal(g, x, s) {
    g.fillStyle = '#2a0412'; rr(g, x - 70, 560, 140, 240, 8); g.fill(); g.strokeStyle = GOLD; g.lineWidth = 6; g.stroke();
    g.fillStyle = GOLD; g.fillRect(x - 84, 548, 168, 18); g.fillRect(x - 84, 790, 168, 14);
    crown(g, x, 530 + Math.sin(s.t * 1.6 + x) * 6, 0.9);
  }
  function stage(g, s, o = {}) {
    const t = s.t, open = o.curtain == null ? 1 : o.curtain;
    let gr = g.createLinearGradient(0, -300, 0, 820); gr.addColorStop(0, '#16020a'); gr.addColorStop(0.7, '#3c0719'); gr.addColorStop(1, '#22030f');
    g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1120);
    const glow = g.createRadialGradient(960, 380, 0, 960, 380, 900); glow.addColorStop(0, 'rgba(255,190,90,0.28)'); glow.addColorStop(1, 'rgba(255,190,90,0)');
    g.fillStyle = glow; g.fillRect(-600, -300, 3120, 1120);
    for (const [x, y, rad, ph] of STARS) { g.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 1.3 + ph)); g.fillStyle = '#ffe9b0'; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    // stage floor + the red carpet
    gr = g.createLinearGradient(0, 800, 0, 1080); gr.addColorStop(0, '#6b2a12'); gr.addColorStop(1, '#2a0d05');
    g.fillStyle = gr; g.fillRect(-600, 800, 3120, 700);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); for (let i = -14; i <= 14; i++) { g.moveTo(960 + i * 80, 800); g.lineTo(960 + i * 200, 1400); } g.stroke();
    g.fillStyle = GOLD; g.fillRect(-600, 796, 3120, 8);
    g.fillStyle = '#b3173a'; g.beginPath(); g.moveTo(840, 804); g.lineTo(1080, 804); g.lineTo(1290, 1400); g.lineTo(630, 1400); g.closePath(); g.fill();
    g.strokeStyle = GOLD; g.lineWidth = 6; g.beginPath(); g.moveTo(840, 804); g.lineTo(630, 1400); g.moveTo(1080, 804); g.lineTo(1290, 1400); g.stroke();
    if (!o.bare) { pedestal(g, 230, s); pedestal(g, 1690, s); }
    if (o.logo !== 0) { g.save(); g.translate(960, 300); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
    if (o.host !== false) s.hostAt(1380, 820, 0.8);
    // the main curtain (closed = 0, open = 1) and the side drapes
    const edge = lerp(962, 230, easeOut(open));
    curtainHalf(g, -400, edge, -1, t); curtainHalf(g, 1920 - edge, 2320, 1, t);
    valance(g);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(10,0,4,${(1 - o.lights) * 0.88})`; g.fillRect(-600, -300, 3120, 1700); }
    s.spots(o.spots == null ? 0.65 : o.spots);
  }
  function logo(g, s, lit) {
    const w = 760, h = 270;
    if (lit > 0.5) { g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(0, 0, 60, 0, 0, 560); rg.addColorStop(0, `rgba(255,200,90,${0.32 * lit})`); rg.addColorStop(1, 'rgba(255,200,90,0)'); g.fillStyle = rg; g.fillRect(-600, -600, 1200, 1200); g.restore(); }
    g.fillStyle = WINE; rr(g, -w / 2 - 12, -h / 2 + 2, w + 24, h + 24, 34); g.fill();
    g.fillStyle = GOLD; rr(g, -w / 2 - 12, -h / 2 - 12, w + 24, h + 24, 34); g.fill();
    g.fillStyle = '#2a0412'; rr(g, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 22); g.fill();
    const per = 2 * (w + h), nb = Math.floor(per / 30);
    for (let i = 0; i < nb; i++) {
      let d = (i / nb) * per, bx, by;
      if (d < w) { bx = -w / 2 + d; by = -h / 2; } else if ((d -= w) < h) { bx = w / 2; by = -h / 2 + d; } else if ((d -= h) < w) { bx = w / 2 - d; by = h / 2; } else { d -= w; bx = -w / 2; by = h / 2 - d; }
      const on = lit > 0.5 ? 0.55 + 0.45 * Math.sin(s.t * 3 - i * 0.6) : 0.15;
      g.fillStyle = `rgba(255,${200 + 40 * on | 0},${120 + 80 * on | 0},${0.35 + 0.65 * on})`; g.beginPath(); g.arc(bx, by, 6, 0, TAU); g.fill();
    }
    g.globalAlpha = 0.25 + 0.75 * lit;
    text(g, '★  TONIGHT’S AWARD  ★', 0, -82, 26, '#f6d3a6', { font: '"Nunito", sans-serif' });
    const gold = g.createLinearGradient(0, -60, 0, 110); gold.addColorStop(0, '#fff6c4'); gold.addColorStop(0.45, '#ffd54a'); gold.addColorStop(0.7, '#d9900f'); gold.addColorStop(1, '#ffe27a');
    text(g, 'Most Likely', 0, -18, 92, gold, { font: SERIF, stroke: WINE, lw: 10, max: 680 });
    g.save(); g.transform(1, 0, -0.18, 1, 14, 0); text(g, 'To…', 0, 78, 108, gold, { font: SERIF, stroke: WINE, lw: 10 }); g.restore();
    g.globalAlpha = 1;
    crown(g, 0, -h / 2 - 22 + Math.sin(s.t * 2) * 4, 0.75);
  }
  // A gold-fronted lectern for the host.
  function podium(g, s, x, y, sc) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    g.fillStyle = '#2a0412'; g.beginPath(); g.moveTo(-150, 0); g.lineTo(150, 0); g.lineTo(120, 230); g.lineTo(-120, 230); g.closePath(); g.fill();
    g.lineWidth = 8; g.strokeStyle = GOLD; g.stroke();
    rr(g, -170, -18, 340, 30, 10); g.fillStyle = GOLD; g.fill();
    crown(g, 0, 130, 0.8);
    g.restore();
  }
  // The envelope opens and the card rises.
  function envelope(g, s, T) {
    const k = easeOut(T / 500), flap = ss(500, 900, T), card = ease((T - 800) / 700);
    g.save(); g.translate(960, 640 + (1 - k) * 600);
    // card (behind the envelope front)
    g.save(); g.translate(0, -card * 330);
    g.fillStyle = '#fffaf0'; rr(g, -330, -200, 660, 400, 18); g.fill(); g.strokeStyle = GOLD; g.lineWidth = 8; rr(g, -312, -182, 624, 364, 10); g.stroke();
    text(g, 'AND THE NOMINEES ARE…', 0, -110, 34, '#9a6a2a', { font: '"Nunito", sans-serif' });
    if (card > 0.6) s.emoji('👑', 0, 10, 140 * back((T - 1250) / 400));
    g.restore();
    // envelope body
    g.fillStyle = '#e9b53c'; rr(g, -360, -40, 720, 300, 16); g.fill();
    g.fillStyle = '#f2c24a'; g.beginPath(); g.moveTo(-360, 250); g.lineTo(0, 60); g.lineTo(360, 250); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(138,90,0,0.5)'; g.lineWidth = 4; g.beginPath(); g.moveTo(-360, -40); g.lineTo(0, 120); g.lineTo(360, -40); g.stroke();
    // flap
    g.save(); g.translate(0, -40); g.scale(1, lerp(1, -1, flap));
    g.fillStyle = flap > 0.5 ? '#c99520' : '#ffd96a'; g.beginPath(); g.moveTo(-360, 0); g.lineTo(0, 190); g.lineTo(360, 0); g.closePath(); g.fill();
    g.restore();
    if (flap < 0.5) { g.fillStyle = '#a3163c'; g.beginPath(); g.arc(0, 140, 40, 0, TAU); g.fill(); text(g, '★', 0, 142, 40, GOLD2); }
    g.restore();
  }

  const spots = (n) => { const rows = n > 8 ? 2 : 1, cols = Math.ceil(n / rows), step = Math.min(230, 1640 / Math.max(1, cols)); return Array.from({ length: n }, (_, i) => { const row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols, col = i - row * cols; return { x: 960 + (col - (rowN - 1) / 2) * step, row, step }; }); };
  // The roll call: the nominees walk onto the red carpet under the spotlights.
  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1); stage(g, s, { host: false, bare: true, logo: 0, lights: 0.75, spots: 0.8 });
    const tk = easeOut(u / 500);
    g.globalAlpha = tk; text(g, 'And the nominees are…', 960, 220, 96, GOLD2, { font: SERIF, stroke: WINE, lw: 12, max: 1500 }); g.globalAlpha = 1;
    const P = spots(F.length);
    F.forEach((c, i) => {
      const k = easeOut((u - i * per) / 500); if (k <= 0) return;
      const p = P[i], feet = p.row ? 960 : (F.length > 8 ? 700 : 860), sc = Math.min(1.25, p.step / 180);
      const x = p.x + (1 - k) * -300, sway = Math.sin(s.t * 2 + i) * 0.04;
      g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(x, feet, 0, x, feet, 150 * sc); rg.addColorStop(0, 'rgba(255,236,190,0.35)'); rg.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(x, feet, 150 * sc, 40 * sc, 0, 0, TAU); g.fill(); g.restore();
      g.save(); g.translate(x, feet); g.scale(sc, sc); g.rotate(sway); g.globalAlpha = k;
      g.fillStyle = c.color || '#ff6b8b'; rr(g, -48, -190, 96, 160, 46); g.fill(); g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.3)'; g.stroke();
      g.fillStyle = '#1a0610'; g.beginPath(); g.moveTo(0, -95); g.lineTo(-22, -108); g.lineTo(-22, -82); g.closePath(); g.moveTo(0, -95); g.lineTo(22, -108); g.lineTo(22, -82); g.closePath(); g.fill();
      s.face(c, 0, -146, 70);
      g.restore(); g.globalAlpha = k;
      const w = Math.min(p.step * 0.95, 220);
      g.fillStyle = '#fff3d6'; rr(g, x - w / 2, feet - 22, w, 48, 6); g.fill(); g.strokeStyle = GOLD; g.lineWidth = 4; g.stroke();
      text(g, c.name, x, feet + 2, 32, INK, { font: SERIF, max: w - 16 }); g.globalAlpha = 1;
    });
    if (o.more && u > F.length * per - 1400) text(g, '…and ' + o.more + ' more!', 960, 1020, 56, GOLD2, { font: SERIF, stroke: WINE, lw: 10 });
  }
  BOX.intros.likely = {
    title: 'Most Likely To…',
    // How to play (box/howto.js): one card per step, 5 steps (module howSteps).
    tutorial: [
      { icon: '🎭', title: 'The prompt', text: 'A prompt goes up: “Who’s most likely to… survive a zombie apocalypse?” Think about everyone in the room.' },
      { icon: '🗳️', title: 'Vote', text: 'Vote for the player who fits it best. Votes are secret!', phone: 'Tap a player’s name to vote.' },
      { icon: '🔮', title: 'Predict', text: 'Then guess who the ROOM will pick. +100 if your vote matches the winner, +150 for a correct prediction.', phone: 'Tap who you think will win (or Skip prediction).' },
      { icon: '👑', title: 'The title', text: 'The winner is crowned with a new TITLE: fame, not points. Ties share the crown!' },
      { icon: '🔥', title: 'Bonus rounds', text: '👯 Double Trouble: pick two people. 🔥 Hot Seat: would they actually do it? The final prompt counts double!', phone: 'Hot Seat: tap 👍 YES or 👎 NO. Double Trouble: tap two, then Lock in the duo.' },
    ],
    theme: { accent: '#ff6b8b', accent2: '#ffd54a', accent3: '#ffd54a', ink: '#fff3d6', fade: '#16020a', rim: '#ffd54a',
      floor1: '#6b2a12', floor2: '#2a0d05', disc1: '#7a1030', disc2: '#3c0719', pod1: '#5a0b22', pod2: '#2a0412', podTop: '#e9b53c', seat: '#5a0b22', audWall1: '#2a0412', audWall2: '#0c0105',
      spots: ['255,236,190', '255,214,150', '255,236,190', '255,200,210'], confetti: ['#ffd54a', '#fff3d6', '#ff6b8b', '#e9b53c', '#ffffff', '#ffb43c'] },
    host: {
      name: 'Velvet Vance',
      voice: { kokoro: 'am_echo', cb: 'warm', speed: 1.0, like: /guy|davis|christopher|eric|andrew|brian|george|male/i, accent: /en-(US|GB)/i, pitch: 1.0, rate: 1.02 },
      look: { skin: '#c98d62', skinShade: '#a87048', suit: '#1c1024', suit2: '#0c0610', lapel: '#e9b53c', shirt: '#fffdf7', tie: 'bow', tieColor: '#a3163c', hair: 'pomp', hairColor: '#2a1a12', brow: '#2a1a12', prop: 'mic', grin: true, sparkle: '#ffd54a' },
    },
    lines: {
      welcome: 'Good evening, darlings, and welcome to the Most Likely To awards! I\'m Velvet Vance!',
      roll: 'And the nominees are…', more: '…and {n} more!',
      play: 'Let the ceremony begin!',
    },
    stage, logo, podium, roll,
    hostCam: { x: 1200, y: 620, z: 1.7 },
    castOpening: [
      { ms: 2700, sfx: [[0, 'swell'], [300, 'drum'], [1700, 'reveal']],
        draw(g, s) {
          s.cam(960, lerp(560, 520, ease(s.k)), 1.08 - 0.06 * ease(s.k));
          stage(g, s, { host: false, curtain: ease((s.T - 700) / 1600), lights: 0.15 + 0.85 * ss(500, 2000, s.T), logo: s.T < 1500 ? 0.1 : 1, spots: ss(1600, 2300, s.T) });
          if (s.T < 1500) { g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(960, 560, 0, 960, 560, 320); rg.addColorStop(0, 'rgba(255,236,190,0.45)'); rg.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(960, 560, 320, 300, 0, 0, TAU); g.fill(); g.restore(); }
        } },
      { ms: 2200, sfx: [[0, 'whoosh'], [200, 'cheer']], pose: [[100, 'wave', 1800]], say: 'welcome', sayAt: 100, fit: 3600, crowd: [[100, 'cheer', 2000]],
        draw(g, s) {
          const k = ease(s.T / 1600);
          s.cam(lerp(960, 1250, k), lerp(520, 600, k), lerp(1, 1.55, k));
          stage(g, s, { spots: 1 });
          s.backs(-60, 960, 2040, 130, 'cheer');
        } },
      { ms: 2100, sfx: [[0, 'whoosh'], [500, 'click'], [1250, 'chime']],
        draw(g, s) {
          s.cam(960, 540, 1); stage(g, s, { host: false, logo: 0.2, lights: 0.45 });
          envelope(g, s, s.T);
        } },
    ],
  };
})();
