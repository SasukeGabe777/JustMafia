'use strict';
// Emoji Charades intro: the sunny emoji world from the title screen. Emojis rain down and
// bounce on the candy hills while the logo letters drop in one by one, the host (Winky, a
// giant winking emoji with floating gloves) pops up from behind a huge keyboard key, and a
// phone shows how the game works: emojis pop into a bubble... and somebody cracks it.
// Engine + API: public/box/show.js.
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, TAU, clamp } = ST.util, { rr, text } = ST.draw;
  const FONT = '"Luckiest Guy", "Lilita One", sans-serif';
  const DEEP = '#2a0a55', PURPLE = '#421680';
  try { if (document.fonts) document.fonts.load('40px "Luckiest Guy"'); } catch { /* fine */ }
  const r = rng(4242);
  const DOTS = Array.from({ length: 46 }, (_, i) => [r() * 2400 - 240, r() * 820, 5 + r() * 8, ['#ffffff', '#ff4f9a', '#3ee0ff', '#7dff6b', '#a46bff'][i % 5], r() * TAU]);
  const KEYS = ['😂', '🥹', '😎', '🤯', '🥳', '😴', '🤠', '👻', '🐸', '🍕', '🎉', '🚀', '🌮', '🦖', '🍩', '🐙', '⚡', '🎸', '🧠', '💖'];
  const BALLS = ['😆', '🐵', '🍉', '😺', '🌟', '🐥', '😜', '🍭', '🤪', '🐳', '😋', '🎈', '🦄', '🍔'];
  const RAIN = Array.from({ length: 26 }, (_, i) => ({ e: BALLS[i % BALLS.length], x: 80 + r() * 1760, d: r() * 900, s: 70 + r() * 50, sp: 0.8 + r() * 0.5 }));
  const HILL = (x, t) => 905 + Math.sin(x / 150 + t * 0.5) * 9;

  function hills(g, t) {
    g.fillStyle = '#a46bff'; g.beginPath(); g.moveTo(-600, 1400);
    for (let x = -600; x <= 2520; x += 30) g.lineTo(x, HILL(x, t));
    g.lineTo(2520, 1400); g.fill();
    g.fillStyle = '#7b3fe0'; g.beginPath(); g.moveTo(-600, 1400);
    for (let x = -600; x <= 2520; x += 30) g.lineTo(x, 945 + Math.sin(x / 115 - t * 0.4 + 2) * 8);
    g.lineTo(2520, 1400); g.fill();
  }
  function keyboard(g, s) {
    g.fillStyle = 'rgba(66,22,128,0.85)'; g.fillRect(-600, 0, 3120, 112);
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(-600, 108, 3120, 6);
    const kw = 96, total = KEYS.length * kw, off = (s.t * 50) % total;
    for (let x0 = -600 - off; x0 < 2520; x0 += total) KEYS.forEach((e, i) => {
      const x = x0 + i * kw, press = Math.max(0, Math.sin(s.t * 2.2 - i * 0.9)) ** 12;
      g.fillStyle = DEEP; rr(g, x + 8, 22, 80, 80, 16); g.fill();
      g.fillStyle = press > 0.3 ? '#ffe14d' : '#fff'; rr(g, x + 8, 16 + press * 6, 80, 80, 16); g.fill();
      s.emoji(e, x + 48, 56 + press * 6, 54);
    });
  }
  function stage(g, s, o = {}) {
    const t = s.t;
    let gr = g.createRadialGradient(960, 480, 40, 960, 480, 1500);
    gr.addColorStop(0, '#fff07a'); gr.addColorStop(0.5, '#ffc23d'); gr.addColorStop(1, '#ff8a3d');
    g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    g.save(); g.translate(960, 480); g.rotate(t * 0.05); g.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 2400, a, a + TAU / 36); g.closePath(); g.fill(); }
    g.restore();
    for (const [x, y, rad, c, ph] of DOTS) { g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 1.4 + ph); g.fillStyle = c; g.beginPath(); g.arc(x, y + Math.sin(t + ph) * 6, rad, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    if (!o.noKeys) keyboard(g, s);
    if (o.logo !== 0) { g.save(); g.translate(960, 330); logo(g, s, o.logo == null ? 1 : o.logo, o.letters); g.restore(); }
    if (o.host !== false) { const up = o.hostUp == null ? 1 : o.hostUp; s.host(1460, 860 + (1 - easeOut(up)) * 420, 0.82); podium(g, s, 1460, 860, 0.82); }
    hills(g, t);
    if (!o.bare) { // emoji balls bouncing along the hill
      for (let i = 0; i < 12; i++) {
        const x = 70 + i * 160 + (i % 2) * 30; if (o.host !== false && Math.abs(x - 1460) < 170) continue;
        const ph = (t * (0.9 + (i % 3) * 0.12) + i * 0.37) % 1, air = Math.sin(ph * Math.PI), sq = 0.8 + 0.2 * Math.min(1, air * 3);
        g.fillStyle = 'rgba(42,10,85,0.25)'; g.beginPath(); g.ellipse(x, HILL(x, t) + 4, 30 * (1 - air * 0.4), 7, 0, 0, TAU); g.fill();
        g.save(); g.translate(x, HILL(x, t) - 32 * sq - air * 90); g.scale(2 - sq, sq); s.emoji(BALLS[i % BALLS.length], 0, 0, 66); g.restore();
      }
    }
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(42,10,85,${(1 - o.lights) * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
  }
  // The logo: EM😜JI hops, CHARADES tilts. letters (0..1) drops the letters in one by one.
  function logo(g, s, lit, letters) {
    const L = letters == null ? 1 : letters, t = s.t;
    const parts = [['E', '#ffe14d'], ['M', '#3ee0ff'], ['😜', null], ['J', '#7dff6b'], ['I', '#ff8a3d']];
    if (lit > 0.5) { g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(0, 0, 40, 0, 0, 520); rg.addColorStop(0, `rgba(255,255,255,${0.35 * lit})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(-560, -560, 1120, 1120); g.restore(); }
    g.globalAlpha = 0.3 + 0.7 * lit;
    parts.forEach(([c, col], i) => {
      const k = back(clamp((L * 7 - i) / 1.2)); if (k <= 0) return;
      const hop = Math.max(0, Math.sin(t * 3.5 - i * 0.7)) ** 3 * 16;
      const x = -300 + i * 150, y = -70 - hop - (1 - k) * 500;
      g.save(); g.translate(x, y); g.scale(k, k); g.rotate((i % 2 ? 1 : -1) * 0.05);
      if (!col) s.emoji(c, 0, 4, 150);
      else text(g, c, 0, 0, 170, col, { font: FONT, stroke: DEEP, lw: 20 });
      g.restore();
    });
    const k2 = back(clamp((L * 7 - 5.2) / 1.4));
    if (k2 > 0) { g.save(); g.translate(30, 95); g.rotate(-0.05); g.scale(k2, k2); text(g, 'CHARADES', 0, 0, 120, '#ff4f9a', { font: FONT, stroke: DEEP, lw: 18 }); g.restore(); }
    g.globalAlpha = 1;
  }
  // A giant keyboard key the host stands behind.
  function podium(g, s, x, y, sc) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    g.fillStyle = DEEP; rr(g, -170, 14, 340, 200, 40); g.fill();
    g.fillStyle = '#fff'; rr(g, -170, 0, 340, 190, 40); g.fill(); g.lineWidth = 8; g.strokeStyle = DEEP; g.stroke();
    g.fillStyle = '#efe6ff'; rr(g, -140, 22, 280, 140, 28); g.fill();
    s.emoji('😂', 0, 94, 118);
    g.restore();
  }
  // Winky: a big winking emoji host with floating gloves.
  function hostDraw(g, a) {
    const t = a.t, bob = Math.sin(t * 3) * 6, cx = 0, cy = -235 + bob, R = 150;
    g.save();
    g.fillStyle = 'rgba(42,10,85,0.2)'; g.beginPath(); g.ellipse(0, -2, 150, 22, 0, 0, TAU); g.fill();
    // bow tie
    g.fillStyle = '#ff4f9a'; g.strokeStyle = DEEP; g.lineWidth = 6; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(0, cy + R - 8); g.lineTo(-48, cy + R - 34); g.lineTo(-48, cy + R + 22); g.closePath(); g.moveTo(0, cy + R - 8); g.lineTo(48, cy + R - 34); g.lineTo(48, cy + R + 22); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(0, cy + R - 6, 13, 0, TAU); g.fill(); g.stroke();
    // face
    const fg = g.createRadialGradient(cx - 50, cy - 60, 20, cx, cy, R);
    fg.addColorStop(0, '#fff6a0'); fg.addColorStop(0.6, '#ffd63d'); fg.addColorStop(1, '#ffb020');
    g.fillStyle = fg; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill(); g.lineWidth = 9; g.strokeStyle = DEEP; g.stroke();
    g.fillStyle = 'rgba(255,90,120,0.35)'; g.beginPath(); g.ellipse(cx - 92, cy + 30, 26, 16, 0, 0, TAU); g.ellipse(cx + 92, cy + 30, 26, 16, 0, 0, TAU); g.fill();
    const lx = a.look * 7, wink = !a.talk && (t % 3.2) < 0.9;
    // left eye
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx - 52, cy - 38, 26, 36 * a.blink, 0, 0, TAU); g.fill(); g.lineWidth = 6; g.stroke();
    if (a.blink > 0.5) { g.fillStyle = DEEP; g.beginPath(); g.arc(cx - 50 + lx, cy - 32, 13, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 46 + lx, cy - 37, 4, 0, TAU); g.fill(); }
    // right eye (winks)
    if (wink) { g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx + 28, cy - 34); g.quadraticCurveTo(cx + 52, cy - 52, cx + 76, cy - 34); g.stroke(); }
    else { g.fillStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.ellipse(cx + 52, cy - 38, 26, 36 * a.blink, 0, 0, TAU); g.fill(); g.stroke(); if (a.blink > 0.5) { g.fillStyle = DEEP; g.beginPath(); g.arc(cx + 54 + lx, cy - 32, 13, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + 58 + lx, cy - 37, 4, 0, TAU); g.fill(); } }
    // brows
    g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(cx - 78, cy - 92 - (a.talk ? 6 : 0)); g.quadraticCurveTo(cx - 52, cy - 108, cx - 26, cy - 92); g.moveTo(cx + 26, cy - 94); g.quadraticCurveTo(cx + 52, cy - 112 - (a.talk ? 8 : 0), cx + 78, cy - 96); g.stroke();
    // mouth: talking = open, else a cheeky grin with the tongue out
    if (a.mouth > 0.05) {
      const mh = 18 + a.mouth * 62;
      g.fillStyle = '#7a1030'; g.beginPath(); g.ellipse(cx, cy + 58, 58, mh / 2, 0, 0, TAU); g.fill(); g.lineWidth = 7; g.stroke();
      g.save(); g.beginPath(); g.ellipse(cx, cy + 58, 58, mh / 2, 0, 0, TAU); g.clip(); g.fillStyle = '#ff6f8e'; g.beginPath(); g.ellipse(cx, cy + 58 + mh / 2, 40, 22, 0, 0, TAU); g.fill(); g.restore();
    } else {
      g.fillStyle = '#7a1030'; g.beginPath(); g.moveTo(cx - 70, cy + 34); g.quadraticCurveTo(cx, cy + 120, cx + 70, cy + 34); g.quadraticCurveTo(cx, cy + 62, cx - 70, cy + 34); g.fill(); g.lineWidth = 7; g.stroke();
      g.fillStyle = '#ff6f8e'; g.beginPath(); g.ellipse(cx + 18, cy + 84, 24, 30, 0.3, 0, Math.PI); g.fill(); g.lineWidth = 5; g.stroke();
    }
    // floating gloves
    for (const sd of ['l', 'r']) {
      const [hx, hy] = a.hands[sd], m = sd === 'l' ? -1 : 1;
      g.save(); g.translate(hx + m * 40, hy - 40 + bob); g.rotate(m * 0.3);
      g.fillStyle = '#fff'; g.lineWidth = 6; g.strokeStyle = DEEP;
      rr(g, -22, 26, 44, 22, 8); g.fill(); g.stroke();
      g.beginPath(); g.arc(0, 0, 34, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(m * -30, -6, 12, 18, m * 0.5, 0, TAU); g.fill(); g.stroke();
      g.restore();
    }
    g.restore();
  }
  // A phone demo: emojis pop into a bubble, then somebody cracks it.
  function phoneDemo(g, s, k) {
    const T = s.T, clue = ['🦁', '👑', '🎶'];
    g.save(); g.translate(960, 560 + (1 - easeOut(k)) * 700); g.rotate(-0.04);
    g.fillStyle = 'rgba(42,10,85,0.3)'; rr(g, -250, -390, 520, 820, 70); g.fill();
    g.fillStyle = DEEP; rr(g, -270, -410, 520, 820, 70); g.fill();
    g.fillStyle = '#fff6e6'; rr(g, -244, -366, 468, 730, 46); g.fill();
    g.fillStyle = DEEP; rr(g, -70, -396, 120, 18, 9); g.fill();
    // incoming bubble with the clue
    g.fillStyle = '#fff'; g.strokeStyle = DEEP; g.lineWidth = 8; rr(g, -210, -300, 400, 150, 50); g.fill(); g.stroke();
    clue.forEach((e, i) => { const p = back((T - 400 - i * 380) / 360); if (p > 0) s.emoji(e, -100 + i * 110, -225, 96 * p); });
    // the typing guess, then the answer
    const solved = T > 1700;
    g.fillStyle = solved ? '#7dff6b' : '#efe6ff'; rr(g, -150, -60, 360, 120, 46); g.fill(); g.stroke();
    if (!solved) { for (let i = 0; i < 3; i++) { g.fillStyle = '#a46bff'; g.beginPath(); g.arc(-10 + i * 46, 0 - Math.max(0, Math.sin(s.t * 8 - i)) * 12, 12, 0, TAU); g.fill(); } }
    else { const p = back((T - 1700) / 300); g.save(); g.translate(30, 2); g.scale(p, p); text(g, 'THE LION KING!', 0, 0, 44, DEEP, { font: FONT, max: 330 }); g.restore(); }
    if (solved) { const q = ss(1700, 2200, T); text(g, '+500', 120, -120 - q * 40, 60, '#7dff6b', { font: FONT, stroke: DEEP, lw: 10 }); s.emoji('🤩', -150, 200, 140 * back((T - 1750) / 350)); }
    g.restore();
  }

  const spots = (n) => { const rows = n > 8 ? 2 : 1, cols = Math.ceil(n / rows), step = Math.min(230, 1640 / Math.max(1, cols)); return Array.from({ length: n }, (_, i) => { const row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols, col = i - row * cols; return { x: 960 + (col - (rowN - 1) / 2) * step, row, step }; }); };
  // The roll call: every player pops up on the candy hill as a big bouncing emoji face.
  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1); stage(g, s, { host: false, bare: true, logo: 0, noKeys: false });
    const tk = back(u / 400);
    g.save(); g.translate(960, 200); g.scale(tk, tk); text(g, 'TONIGHT’S EMOJI EXPERTS', 0, 0, 84, '#ffe14d', { font: FONT, stroke: DEEP, lw: 14, max: 1600 }); g.restore();
    const P = spots(F.length);
    F.forEach((c, i) => {
      const k = back((u - i * per) / 420); if (k <= 0) return;
      const p = P[i], baseY = p.row ? 820 : (F.length > 8 ? 560 : 640), sz = Math.min(170, p.step * 0.72);
      const hop = Math.abs(Math.sin(s.t * 4 + i)) * 18;
      g.save(); g.translate(p.x, baseY - hop); g.scale(k, k); s.emoji(c.avatar || '🙂', 0, -sz * 0.45, sz); g.restore();
      g.font = '44px ' + FONT; const w = Math.min(p.step * 0.95, g.measureText(c.name).width * Math.min(1, 34 / 44) + 40);
      g.globalAlpha = Math.min(1, k); g.fillStyle = '#fff'; g.strokeStyle = c.color || DEEP; g.lineWidth = 6; rr(g, p.x - w / 2, baseY + 20, w, 54, 27); g.fill(); g.stroke();
      text(g, c.name, p.x, baseY + 49, 34, DEEP, { font: FONT, max: w - 20 }); g.globalAlpha = 1;
    });
    if (o.more && u > F.length * per - 1400) text(g, '…AND ' + o.more + ' MORE!', 960, 990, 60, '#ffe14d', { font: FONT, stroke: DEEP, lw: 12 });
  }
  BOX.intros.emoji = {
    title: 'Emoji Charades',
    // How to play (box/howto.js): one card per step, 5 steps (module howSteps).
    tutorial: [
      { icon: '🎬', title: 'The Clue Giver', text: 'Each round a Clue Giver secretly picks a movie, animal, food, place or saying from three choices.', phone: 'Clue Giver? Tap one of the three answers.' },
      { icon: '😀', title: 'Emojis only', text: 'They spell it out using ONLY emojis. Each one pops up on the big screen.', phone: 'Tap emojis to add them. ⌫ Undo takes one back, │ New word starts the next word.' },
      { icon: '⌨️', title: 'Guess it', text: 'Everyone else races to type the answer. Guess as often as you like: small typos are fine!', phone: 'Type your guess and tap Send ➤.' },
      { icon: '⭐', title: 'Scoring', text: 'The first right answer scores 500, then less. Fewer emojis means bigger points. The Clue Giver scores when people get it.' },
      { icon: '🏆', title: 'Hints & winning', text: 'Stuck? Hints show the words, then the first letters. The last round counts DOUBLE. Most points wins!' },
    ],
    theme: { accent: '#ff4f9a', accent2: '#ffe14d', accent3: '#ffe14d', ink: '#ffffff', fade: '#2a0a55', rim: '#ffe14d',
      confetti: ['#ffe14d', '#ff4f9a', '#3ee0ff', '#7dff6b', '#ffffff', '#a46bff'], spots: ['255,250,210', '255,200,240', '200,240,255', '255,250,210'] },
    host: {
      name: 'Winky',
      voice: { kokoro: 'af_sky', speed: 1.15, like: /aria|jenny|ava|emma|samantha|zira|female/i, accent: /en-US/i, pitch: 1.45, rate: 1.15 },
      draw: hostDraw,
    },
    lines: {
      welcome: 'Hiya! I\'m Winky, and welcome to Emoji Charades, where words are BANNED!',
      roll: 'Here are tonight\'s emoji experts!', more: '…and {n} more!',
      play: 'Phones out! Let\'s play Emoji Charades!',
    },
    stage, logo: (g, s, lit) => logo(g, s, lit, 1), podium, roll,
    hostCam: { x: 1380, y: 650, z: 1.8 },
    castOpening: [
      { ms: 2800, sfx: [[0, 'swell'], [520, 'pop'], [690, 'pop'], [860, 'pop'], [1030, 'pop'], [1200, 'pop'], [1500, 'whoosh']],
        draw(g, s) {
          s.cam(960, 520, 1.02 + 0.04 * ease(s.k));
          stage(g, s, { host: false, letters: clamp((s.T - 400) / 1400), lights: 0.4 + 0.6 * ss(0, 600, s.T), bare: true });
          // the emoji rain bouncing onto the hill
          for (const d of RAIN) {
            const u = (s.T - d.d) / 700; if (u <= 0) continue;
            const land = HILL(d.x, s.t) - d.s * 0.4, fall = Math.min(1, u);
            let y = lerp(-140, land, fall * fall);
            if (u > 1) y = land - Math.abs(Math.sin((u - 1) * 4 * d.sp)) * 120 * Math.max(0, 1 - (u - 1) * 0.6);
            s.emoji(d.e, d.x, y, d.s);
          }
        } },
      { ms: 2000, sfx: [[100, 'pop'], [300, 'cheer']], pose: [[150, 'wave', 1700]], say: 'welcome', sayAt: 150, fit: 3200,
        draw(g, s) {
          const k = ease(s.T / 1400);
          s.cam(lerp(960, 1330, k), lerp(520, 610, k), lerp(1.05, 1.45, k));
          stage(g, s, { hostUp: back((s.T - 100) / 600) });
          const bk = back((s.T - 700) / 400);
          if (bk > 0) { g.save(); g.translate(1730, 420); g.scale(bk, bk); g.fillStyle = '#fff'; g.strokeStyle = DEEP; g.lineWidth = 8; rr(g, -150, -60, 300, 120, 50); g.fill(); g.stroke(); ['👋', '😜', '🎉'].forEach((e, i) => s.emoji(e, -90 + i * 90, 0, 76)); g.restore(); }
        } },
      { ms: 2200, sfx: [[0, 'whoosh'], [400, 'pop'], [780, 'pop'], [1160, 'pop'], [1700, 'chime']],
        draw(g, s) {
          s.cam(960, 540, 1); stage(g, s, { host: false, logo: 0.25 });
          g.fillStyle = 'rgba(42,10,85,0.35)'; g.fillRect(-600, -300, 3120, 1700);
          phoneDemo(g, s, s.T / 450);
          const tk = back((s.T - 200) / 400);
          if (tk > 0) { g.save(); g.translate(1530, 300); g.rotate(0.08); g.scale(tk, tk); text(g, 'SAY IT WITH', 0, -50, 64, '#fff', { font: FONT, stroke: DEEP, lw: 12 }); text(g, 'EMOJIS!', 0, 30, 96, '#ffe14d', { font: FONT, stroke: DEEP, lw: 16 }); g.restore(); }
          const tk2 = back((s.T - 500) / 400);
          if (tk2 > 0) { g.save(); g.translate(400, 740); g.rotate(-0.08); g.scale(tk2, tk2); text(g, 'GUESS IT', 0, -40, 64, '#fff', { font: FONT, stroke: DEEP, lw: 12 }); text(g, 'FIRST!', 0, 36, 96, '#7dff6b', { font: FONT, stroke: DEEP, lw: 16 }); g.restore(); }
        } },
    ],
  };
})();
