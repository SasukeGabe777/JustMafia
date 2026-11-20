'use strict';
// Hot Take Trivia intro: a neon quiz studio. In the dark, the four giant answer panels
// (▲ A, ◆ B, ● C, ■ D) slam on one by one, the HOT TAKE sign bursts into flames, the host
// Blaze Bixby (flame-red pompadour, question cards) welcomes everyone, the Hot-o-meter
// boils over at 3×, then the contestants step up to their buzzer podiums (the roll call).
// Engine + API: public/box/show.js.
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, TAU, clamp } = ST.util, { rr, text } = ST.draw;
  const TITLE = '"Lilita One", "Fredoka", sans-serif';
  const COLS = ['#ff4d5e', '#3e8bff', '#ffb52e', '#22c97a'], SH = ['▲', '◆', '●', '■'], LET = ['A', 'B', 'C', 'D'];
  const r = rng(4242);
  const EMBERS = Array.from({ length: 60 }, () => [r() * 1920, r() * 1080, 1 + r() * 3, 0.3 + r() * 0.9, r() * TAU]);

  function flameGrad(g, y0, y1) { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.25, '#ffd23f'); gr.addColorStop(0.6, '#ff8a00'); gr.addColorStop(1, '#ff3d2e'); return gr; }
  function flames(g, x0, x1, base, hgt, t, a = 1) {
    if (a <= 0) return;
    g.save(); g.globalAlpha = a;
    for (const [col, k, ph] of [['rgba(255,61,46,0.9)', 1, 0], ['rgba(255,138,0,0.92)', 0.7, 1.6], ['rgba(255,214,70,0.95)', 0.42, 3]]) {
      const pts = [];
      for (let x = x0 - 40; x <= x1 + 80; x += 40) { const n = Math.sin(x * 0.011 + t * 2.8 + ph) * 0.5 + Math.sin(x * 0.027 - t * 4 + ph * 2) * 0.3 + Math.sin(x * 0.006 + t * 1.2) * 0.35; pts.push([x, base - Math.max(10, hgt * k * (1 + 0.55 * n))]); }
      g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], base); g.lineTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length - 1; i++) g.quadraticCurveTo(pts[i][0], pts[i][1] - hgt * k * 0.25, (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      g.lineTo(pts[pts.length - 1][0], base); g.closePath(); g.fill();
    }
    g.restore();
  }
  // One giant answer panel on the back wall. on: 0..1 lit.
  function panel(g, i, x, y, w, h, on, t) {
    g.save();
    g.fillStyle = '#140628'; rr(g, x - 8, y - 8, w + 16, h + 16, 26); g.fill();
    g.globalAlpha = 0.18 + 0.82 * on;
    if (on > 0.5) { g.shadowColor = COLS[i]; g.shadowBlur = 50 * on; }
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, COLS[i]); gr.addColorStop(1, ST.util.shade(COLS[i], -0.35));
    g.fillStyle = gr; rr(g, x, y, w, h, 20); g.fill(); g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.22)'; rr(g, x + 18, y + 18, h - 36, h - 36, 16); g.fill();
    text(g, SH[i], x + h / 2, y + h / 2 - 10, 64, '#fff', { font: TITLE });
    text(g, LET[i], x + h / 2, y + h / 2 + 40, 34, '#fff', { font: TITLE });
    // a bar of "answer text" lights
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let k = 0; k < 3; k++) { const bw = (w - h - 60) * [0.85, 0.6, 0.72][k]; rr(g, x + h + 10, y + 38 + k * 34, bw * (0.5 + 0.5 * on), 16, 8); g.fill(); }
    g.restore();
    // chaser bulbs
    const n = 22;
    for (let k = 0; k < n; k++) { const bx = x + (k / (n - 1)) * w, lit = on > 0.5 && Math.sin(t * 6 - k * 0.7 + i) > 0; g.fillStyle = lit ? '#fff6c8' : 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(bx, y - 18, 5, 0, TAU); g.fill(); }
  }
  function logo(g, s, lit) {
    const t = s.t;
    if (lit > 0.4) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const rg = g.createRadialGradient(0, 20, 40, 0, 20, 520); rg.addColorStop(0, `rgba(255,120,20,${0.45 * lit})`); rg.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = rg; g.fillRect(-600, -500, 1200, 1000);
      g.restore();
      flames(g, -380, 380, 40, 70 * lit, t, lit);
    }
    g.fillStyle = '#1d0b3d'; rr(g, -390, -150, 780, 250, 36); g.fill();
    g.lineWidth = 8; g.strokeStyle = lit > 0.4 ? '#ff8a00' : '#4a2a6a'; g.stroke();
    g.globalAlpha = 0.25 + 0.75 * lit;
    text(g, 'HOT TAKE', 0, -52, 132, flameGrad(g, -110, 10), { font: TITLE, stroke: '#5a1200', lw: 14, max: 720 });
    const neon = lit > 0.4 && Math.sin(t * 13) > -0.92;
    g.save(); if (neon) { g.shadowColor = '#3ee6ff'; g.shadowBlur = 30; }
    text(g, 'T R I V I A', 0, 52, 68, neon ? '#3ee6ff' : '#2a6a7a', { font: TITLE }); g.restore();
    g.globalAlpha = 1;
  }
  // The Hot-o-meter: a giant thermometer that fills 1× → 2× → 3×. f 0..1
  function meter(g, s, x, y, h, f) {
    const w = 70;
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.1)'; rr(g, x - w / 2 - 16, y - 16, w + 32, h + 32 + 110, 60); g.fill();
    g.strokeStyle = '#fff4e6'; g.lineWidth = 8; rr(g, x - w / 2, y, w, h, w / 2); g.stroke();
    g.beginPath(); g.arc(x, y + h + 50, 70, 0, TAU); g.stroke();
    g.fillStyle = flameGrad(g, y, y + h + 100); g.shadowColor = '#ff8a00'; g.shadowBlur = 40;
    g.beginPath(); g.arc(x, y + h + 50, 58, 0, TAU); g.fill();
    const top = y + h - (h - 16) * f; rr(g, x - w / 2 + 14, top, w - 28, y + h - top + 30, (w - 28) / 2); g.fill();
    g.shadowBlur = 0;
    [['1×', 0.25, '#bfe9ff'], ['2×', 0.55, '#ffc58a'], ['3×  HOT TAKE!', 0.88, '#ffd23f']].forEach(([lab, k, c]) => {
      const ty = y + h - (h - 16) * k; g.fillStyle = f >= k ? c : 'rgba(255,255,255,0.3)'; g.fillRect(x + w / 2 + 10, ty - 4, 30, 8);
      text(g, lab, x + w / 2 + 52, ty, f >= k ? 54 : 44, f >= k ? c : 'rgba(255,255,255,0.4)', { font: TITLE, align: 'left' });
    });
    g.restore();
  }
  function stage(g, s, o = {}) {
    const t = s.t, lights = o.lights == null ? 1 : o.lights, on = o.board == null ? 1 : o.board;
    let gr = g.createLinearGradient(0, -300, 0, 820); gr.addColorStop(0, '#0b0320'); gr.addColorStop(0.7, '#2a0f58'); gr.addColorStop(1, '#3a0e2e');
    g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1120);
    // the answer wall
    const pw = 600, ph = 170, gx = 960 - pw - 30, gy = 300;
    for (let i = 0; i < 4; i++) panel(g, i, gx + (i % 2) * (pw + 60), gy + Math.floor(i / 2) * (ph + 60), pw, ph, clamp((on * 4 - i) * 1.5), t);
    // floor: neon grid
    gr = g.createLinearGradient(0, 800, 0, 1080); gr.addColorStop(0, '#2a0b45'); gr.addColorStop(1, '#0b0320');
    g.fillStyle = gr; g.fillRect(-600, 800, 3120, 700);
    g.save(); g.beginPath(); g.rect(-600, 800, 3120, 700); g.clip(); g.strokeStyle = 'rgba(255,120,40,0.4)'; g.lineWidth = 2;
    for (let i = -20; i <= 20; i++) { g.beginPath(); g.moveTo(960 + i * 70, 800); g.lineTo(960 + i * 220, 1400); g.stroke(); }
    const off = (t * 0.4) % 1; for (let j = 0; j < 8; j++) { const k = (j + off) / 8, y = 800 + 600 * k * k; g.beginPath(); g.moveTo(-600, y); g.lineTo(2520, y); g.stroke(); }
    g.restore();
    g.fillStyle = '#ff8a00'; g.fillRect(-600, 796, 3120, 6);
    flames(g, -600, 2520, 806, 26 * (o.fire == null ? 1 : o.fire), t, 0.8 * lights);
    if (o.logo !== 0) { g.save(); g.translate(960, 150); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
    if (o.host !== false) s.hostAt(1560, 820, 0.78);
    // embers
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [x, y0, rad, sp, ph] of EMBERS) { const y = ((y0 - t * 120 * sp) % 1080 + 1080) % 1080; g.globalAlpha = 0.35 * lights; g.fillStyle = rad > 2.5 ? '#ffd23f' : '#ff6a2e'; g.beginPath(); g.arc(x + Math.sin(t + ph) * 10, y, rad, 0, TAU); g.fill(); }
    g.restore(); g.globalAlpha = 1;
    if (lights < 1) { g.fillStyle = `rgba(6,0,16,${(1 - lights) * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
    s.spots(o.spots == null ? 0.5 : o.spots);
  }
  function podium(g, s, x, y, sc) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    g.fillStyle = '#1d0b3d'; g.beginPath(); g.moveTo(-140, 0); g.lineTo(140, 0); g.lineTo(115, 230); g.lineTo(-115, 230); g.closePath(); g.fill();
    g.lineWidth = 8; g.strokeStyle = '#ff8a00'; g.stroke();
    rr(g, -160, -18, 320, 30, 10); g.fillStyle = '#ff8a00'; g.fill();
    text(g, '?', 0, 120, 120, flameGrad(g, 60, 180), { font: TITLE, stroke: '#5a1200', lw: 10 });
    g.restore();
  }
  // Buzzer podiums for the roll call.
  const spots = (n) => { const rows = n > 8 ? 2 : 1, cols = Math.ceil(n / rows), step = Math.min(230, 1640 / Math.max(1, cols)); return Array.from({ length: n }, (_, i) => { const row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols, col = i - row * cols; return { x: 960 + (col - (rowN - 1) / 2) * step, row, step }; }); };
  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1); stage(g, s, { host: false, logo: 0, lights: 0.7, spots: 0.8 });
    const tk = easeOut(u / 500);
    g.globalAlpha = tk; text(g, 'Tonight’s contestants!', 960, 150, 100, flameGrad(g, 100, 200), { font: TITLE, stroke: '#5a1200', lw: 14, max: 1500 }); g.globalAlpha = 1;
    const P = spots(F.length);
    F.forEach((c, i) => {
      const k = back((u - i * per) / 520); if (k <= 0) return;
      const p = P[i], baseY = p.row ? 1010 : (F.length > 8 ? 720 : 880), sc = Math.min(1.25, p.step / 190);
      const lit = clamp((u - i * per - 250) / 200), buzz = lit > 0 && (u - i * per) < 900 ? 1 + 0.4 * Math.sin((u - i * per) / 30) : 1;
      g.save(); g.translate(p.x, baseY + (1 - Math.min(1, k)) * 400); g.scale(sc, sc);
      // the contestant behind the podium
      g.fillStyle = c.color || '#ff8a00'; rr(g, -50, -300, 100, 150, 46); g.fill(); g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.3)'; g.stroke();
      s.face(c, 0, -330, 76);
      // buzzer
      g.save(); if (lit > 0) { g.shadowColor = c.color || '#ff8a00'; g.shadowBlur = 40 * lit * buzz; }
      g.fillStyle = lit > 0 ? (c.color || '#ff8a00') : '#4a2a6a'; g.beginPath(); g.ellipse(0, -170, 40, 22, 0, Math.PI, 0); g.fill(); g.restore();
      g.fillStyle = '#2a0f58'; rr(g, -60, -172, 120, 14, 6); g.fill();
      // podium
      g.fillStyle = '#1d0b3d'; g.beginPath(); g.moveTo(-90, -160); g.lineTo(90, -160); g.lineTo(76, 0); g.lineTo(-76, 0); g.closePath(); g.fill();
      g.strokeStyle = c.color || '#ff8a00'; g.lineWidth = 6; g.stroke();
      g.fillStyle = '#fff4e6'; rr(g, -78, -120, 156, 52, 10); g.fill();
      text(g, c.name, 0, -94, 34, '#1d0b3d', { font: TITLE, max: 142 });
      text(g, '0', 0, -36, 40, '#ffd23f', { font: TITLE });
      g.restore();
    });
    if (o.more && u > F.length * per - 1400) text(g, '…and ' + o.more + ' more!', 960, 1040, 56, '#ffd23f', { font: TITLE, stroke: '#5a1200', lw: 10 });
  }
  BOX.intros.trivia = {
    title: 'Hot Take Trivia',
    // How to play (box/howto.js): one card per step, 6 steps (module howSteps).
    tutorial: [
      { icon: '❓', title: 'The question', text: 'A question and four answers go up on the TV. Be quick: the clock is ticking!' },
      { icon: '🔥', title: 'Bet on it', text: 'How sure are you? 🧊 1× Hunch, 🌶️ 2× Sure or 🔥 3× HOT TAKE.', phone: 'Tap 1×, 2× or 3×, then tap your answer.', say: 'Bet on it. How sure are you? Bet once for a hunch, double if you’re sure, or triple for a hot take. Pick your bet, then tap your answer.' },
      { icon: '✅', title: 'Scoring', text: 'Right: 100 × your bet, plus up to 50 for speed. Wrong: lose 50 × your bet. Three right in a row: streak bonus!' },
      { icon: '💺', title: 'Hot Seat', text: 'Midway, one player answers for double points while everyone else bets on whether they’ll get it right.', phone: 'Not in the seat? Tap ✅ RIGHT or ❌ WRONG.' },
      { icon: '💰', title: 'All In', text: 'The final question: see the category, bet any share of your points, then answer.', phone: 'Tap how much to bet (up to 🔥 ALL IN), then your answer.' },
      { icon: '🏆', title: 'Winning', text: 'Most points wins! Plus awards like Big Better, Coward, Comeback Kid and Speed Demon.' },
    ],
    theme: { accent: '#ff8a00', accent2: '#ffd23f', accent3: '#3ee6ff', ink: '#fff4e6', fade: '#0b0320', rim: '#ff8a00',
      floor1: '#2a0b45', floor2: '#0b0320', disc1: '#3a1780', disc2: '#1d0b3d', pod1: '#2a0f58', pod2: '#1d0b3d', podTop: '#ff8a00', seat: '#2a0f58', audWall1: '#1d0b3d', audWall2: '#0b0320',
      spots: ['255,170,80', '62,230,255', '255,210,63', '255,77,94'], confetti: ['#ff4d5e', '#3e8bff', '#ffb52e', '#22c97a', '#ffd23f', '#ff8a00'] },
    host: {
      name: 'Blaze Bixby',
      voice: { kokoro: 'am_eric', cb: 'hype', speed: 0.9, like: /guy|davis|christopher|eric|andrew|brian|george|male/i, accent: /en-(US|GB)/i, pitch: 1.1, rate: 1.05 },
      look: { skin: '#e0a77a', skinShade: '#c4875c', suit: '#2a0d55', suit2: '#160630', lapel: '#ff8a00', shirt: '#fff4e6', tie: 'long', tieColor: '#ff3d2e', hair: 'pomp', hairColor: '#ff5a1a', hairShade: '#c2410c', streak: '#ffd23f', brow: '#a8360a', prop: 'cards', grin: true },
    },
    lines: {
      welcome: 'Welcome to Hot Take Trivia! I’m Blaze Bixby. Know it? Then bet on it!',
      roll: 'Tonight’s contestants!', more: '…and {n} more!',
      play: 'Phones out. Let’s turn up the heat!',
    },
    stage, logo, podium, roll,
    hostCam: { x: 1420, y: 620, z: 1.7 },
    castOpening: [
      { ms: 2900, sfx: [[0, 'swell'], [500, 'click'], [800, 'click'], [1100, 'click'], [1400, 'click'], [1900, 'whoosh'], [2100, 'reveal']],
        draw(g, s) {
          s.cam(960, lerp(470, 520, ease(s.k)), 1.12 - 0.1 * ease(s.k));
          stage(g, s, { host: false, board: clamp((s.T - 400) / 1300), lights: 0.2 + 0.8 * ss(300, 2200, s.T), logo: s.T < 1900 ? 0.15 : ease((s.T - 1900) / 400), fire: ss(1900, 2600, s.T), spots: ss(2000, 2700, s.T) });
        } },
      { ms: 2300, sfx: [[0, 'whoosh'], [200, 'cheer']], pose: [[100, 'wave', 1800]], say: 'welcome', sayAt: 100, fit: 4200, crowd: [[100, 'cheer', 2000]],
        draw(g, s) {
          const k = ease(s.T / 1600);
          s.cam(lerp(960, 1420, k), lerp(520, 600, k), lerp(1, 1.6, k));
          stage(g, s, { spots: 1 });
          s.backs(-60, 960, 2040, 130, 'cheer');
        } },
      { ms: 2300, sfx: [[0, 'tension'], [1500, 'boom'], [1650, 'cheer']], crowd: [[1500, 'cheer', 800]],
        draw(g, s) {
          s.cam(960, 540, 1); stage(g, s, { host: false, logo: 0.3, lights: 0.45, board: 0.3 });
          const f = ease(s.T / 1500), boil = ss(1450, 1700, s.T);
          g.save(); g.translate(0, (1 - easeOut(s.T / 350)) * 900);
          meter(g, s, 760, 230, 430, f);
          g.restore();
          if (boil > 0) {
            g.save(); g.globalCompositeOperation = 'lighter';
            const rg = g.createRadialGradient(760, 220, 0, 760, 220, 600 * boil); rg.addColorStop(0, 'rgba(255,200,60,0.9)'); rg.addColorStop(0.4, 'rgba(255,90,20,0.5)'); rg.addColorStop(1, 'rgba(255,60,20,0)');
            g.fillStyle = rg; g.beginPath(); g.arc(760, 220, 600 * boil, 0, TAU); g.fill(); g.restore();
            flames(g, 200, 1720, 1100, 150 * boil, s.t, boil);
            s.emoji('🔥', 760, 160, 180 * back((s.T - 1450) / 400));
          }
        } },
    ],
  };
})();
