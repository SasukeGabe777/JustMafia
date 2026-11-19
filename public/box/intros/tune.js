'use strict';
// Tune Buzz intro: a midnight radio show. The studio is dark; the ON AIR sign flickers on, the
// giant equaliser wall rises, the neon logo buzzes to life, and DJ Wavelength spins in behind the
// mixing desk. A big pink buzzer slams; then tonight's callers spin up as vinyl records (the roll
// call). Engine + API: public/box/show.js. Phones load this file for the HOW TO PLAY steps only,
// without the engine, so nothing here touches BOX.studio until a draw call runs.
(function () {
  BOX.intros = BOX.intros || {};
  const TAU = Math.PI * 2;
  const NEON = '"Monoton", "Bungee", sans-serif', BUNGEE = '"Bungee", "Lilita One", sans-serif';
  const PINK = '#ff3d8b', CYAN = '#38e8ff', GOLD = '#ffd23f', NIGHT = '#0d0326';
  const cl = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const ease = (t) => { t = cl(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = (t) => 1 - Math.pow(1 - cl(t), 3);
  const ss = (a, b, v) => { const t = cl((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  try { if (document.fonts) { document.fonts.load('40px "Monoton"'); document.fonts.load('40px "Bungee"'); } } catch { /* fine */ }

  function vinyl(g, x, y, r, rot, label) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = '#0a0a0f'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1.5;
    for (let k = r * 0.45; k < r * 0.96; k += 5) { g.beginPath(); g.arc(0, 0, k, 0, TAU); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.09)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r * 0.95, -0.6, 0.1); g.closePath(); g.fill();
    g.fillStyle = label; g.beginPath(); g.arc(0, 0, r * 0.4, 0, TAU); g.fill();
    g.restore();
  }
  // The equaliser wall behind the desk. lvl 0..1 = how far it has risen.
  function eqWall(g, s, lvl) {
    const n = 40, x0 = 120, w = 1680, bw = w / n, base = 760, t = s.t, beat = (t * 116 / 60) % 1, pulse = Math.pow(1 - beat, 3);
    for (let i = 0; i < n; i++) {
      const f = i / n, shape = 0.5 + 0.5 * Math.sin(f * 7 + t * 0.6) * Math.sin(f * 3 + 1.3);
      const h = lvl * 520 * (0.25 + 0.6 * shape * (0.55 + 0.45 * Math.sin(t * (5 + (i % 6)) + i)) + 0.15 * pulse);
      const segs = Math.floor(h / 16);
      for (let k = 0; k < segs; k++) { g.fillStyle = `hsla(${320 - f * 160},100%,${50 + k}%,0.85)`; g.fillRect(x0 + i * bw + 3, base - (k + 1) * 16 + 3, bw - 6, 11); }
    }
  }
  function onAir(g, s, on) {
    g.save(); g.translate(1640, 150);
    g.fillStyle = '#1a0710'; s.rr(-170, -50, 340, 100, 16); g.fill();
    if (on > 0) { g.shadowColor = '#ff2d55'; g.shadowBlur = 50 * on; }
    g.fillStyle = on > 0.5 ? '#ff2d55' : '#4a1020'; s.rr(-160, -42, 320, 84, 12); g.fill(); g.shadowBlur = 0;
    s.text('● ON AIR', 0, 2, 50, on > 0.5 ? '#fff' : '#a07', { font: BUNGEE });
    g.restore();
  }
  function logo(g, s, lit) {
    const fl = lit >= 1 ? 1 : (Math.sin(s.t * 40) > 0.3 ? lit : lit * 0.3);
    g.save();
    g.shadowColor = PINK; g.shadowBlur = 40 * fl;
    s.text('TUNE', -150, 0, 150, fl > 0.5 ? '#fff' : '#5a2a4a', { font: NEON });
    g.shadowColor = '#ff9d2e'; g.shadowBlur = 40 * fl;
    const jig = lit >= 1 ? Math.sin(s.t * 30) * 3 * (Math.sin(s.t * 2.2) > 0.85 ? 1 : 0) : 0;
    s.text('BUZZ', 250 + jig, 0, 150, fl > 0.5 ? GOLD : '#5a4a2a', { font: NEON });
    g.restore();
  }
  // The mixing desk the host stands behind.
  function podium(g, s, x, y, sc) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    g.fillStyle = '#231d36'; s.rr(-260, 0, 520, 190, 18); g.fill();
    g.fillStyle = '#17132a'; s.rr(-250, 12, 500, 70, 10); g.fill();
    for (let i = 0; i < 10; i++) { const kx = -220 + i * 49, lv = 0.5 + 0.5 * Math.sin(s.t * 3 + i); g.fillStyle = '#0b0918'; g.fillRect(kx - 3, 22, 6, 50); g.fillStyle = i % 2 ? CYAN : PINK; g.fillRect(kx - 11, 22 + 40 * lv, 22, 10); }
    g.strokeStyle = PINK; g.lineWidth = 4; g.shadowColor = PINK; g.shadowBlur = 20; s.rr(-260, 0, 520, 190, 18); g.stroke(); g.shadowBlur = 0;
    s.text('📻 TUNE BUZZ FM', 0, 140, 44, CYAN, { font: BUNGEE });
    g.restore();
  }
  // The set. o: { host, bare, lights, logo, eq, air }
  function stage(g, s, o = {}) {
    const lights = o.lights == null ? 1 : o.lights;
    let gr = g.createLinearGradient(0, -200, 0, 1300); gr.addColorStop(0, '#1b0642'); gr.addColorStop(0.6, NIGHT); gr.addColorStop(1, '#030009');
    g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    // sweeping beams
    for (const [k, c] of [[0, '255,61,139'], [1, '56,232,255'], [2, '255,210,63']]) {
      const x = 960 + 900 * Math.sin(s.t * (0.3 + k * 0.06) + k * 2.2), a = 0.14 * lights;
      gr = g.createLinearGradient(x, -100, 960, 1080); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - 50, -100); g.lineTo(x + 50, -100); g.lineTo(1700, 1100); g.lineTo(220, 1100); g.closePath(); g.fill();
    }
    eqWall(g, s, o.eq == null ? 1 : o.eq);
    // floor
    gr = g.createLinearGradient(0, 760, 0, 1100); gr.addColorStop(0, '#1a0838'); gr.addColorStop(1, '#05010e'); g.fillStyle = gr; g.fillRect(-600, 760, 3120, 600);
    g.strokeStyle = 'rgba(255,61,139,0.25)'; g.lineWidth = 2;
    for (let i = -14; i <= 14; i++) { g.beginPath(); g.moveTo(960 + i * 40, 760); g.lineTo(960 + i * 170, 1100); g.stroke(); }
    for (let k = 1; k < 7; k++) { const y = 760 + 340 * Math.pow(k / 6, 1.6); g.beginPath(); g.moveTo(-600, y); g.lineTo(2520, y); g.stroke(); }
    if (o.air !== false) onAir(g, s, o.air == null ? 1 : o.air);
    if (o.logo !== 0) { g.save(); g.translate(960, 200); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
    if (!o.bare) {
      vinyl(g, 330, 690, 150, s.t * 3.4, PINK);
      vinyl(g, 1590, 690, 150, -s.t * 3.4 + 1, CYAN);
    }
    if (o.host !== false) s.hostAt(960, 700, 1);
    if (lights < 1) { g.fillStyle = `rgba(3,0,9,${0.85 * (1 - lights)})`; g.fillRect(-600, -300, 3120, 1700); }
  }
  // The big buzzer slam.
  function buzzer(g, s, T) {
    const slam = T > 500 && T < 800, k = cl((T - 500) / 900);
    if (T > 500) for (let r = 0; r < 3; r++) { const q = cl(k - r * 0.15); if (q <= 0) continue; g.strokeStyle = `rgba(255,61,139,${1 - q})`; g.lineWidth = 16 * (1 - q) + 2; g.beginPath(); g.ellipse(960, 760, 180 + q * 1100, (180 + q * 1100) * 0.3, 0, 0, TAU); g.stroke(); }
    g.fillStyle = '#2a2638'; g.beginPath(); g.ellipse(960, 800, 250, 80, 0, 0, TAU); g.fill();
    const press = slam ? 30 : 0;
    g.save(); g.shadowColor = PINK; g.shadowBlur = slam ? 120 : 50;
    const gr = g.createRadialGradient(900, 700 + press, 20, 960, 740 + press, 240); gr.addColorStop(0, '#ff9fc4'); gr.addColorStop(0.5, PINK); gr.addColorStop(1, '#a80c50');
    g.fillStyle = gr; g.beginPath(); g.ellipse(960, 750 + press, 210, 100, 0, 0, TAU); g.fill(); g.restore();
    if (T > 520) { const a = cl((T - 520) / 300); g.globalAlpha = a; s.text('BUZZ!', 960, 380 - 40 * easeOut((T - 520) / 500), 200, GOLD, { font: BUNGEE, stroke: '#6b1040', lw: 20 }); g.globalAlpha = 1; }
  }
  // Roll call: tonight's callers spin up as records on the shelf.
  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1); stage(g, s, { host: false, bare: true, logo: 0, lights: 0.7, eq: 0.5, air: false });
    const tk = easeOut(u / 500);
    g.globalAlpha = tk; s.text('Tonight’s callers…', 960, 170, 100, '#fff', { font: BUNGEE, stroke: '#3a0b5e', lw: 14, max: 1500 }); g.globalAlpha = 1;
    const n = F.length, rows = n > 8 ? 2 : 1, cols = Math.ceil(n / rows), step = Math.min(240, 1700 / Math.max(1, cols));
    F.forEach((c, i) => {
      const k = easeOut((u - i * per) / 600); if (k <= 0) return;
      const row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols, col = i - row * cols;
      const x = 960 + (col - (rowN - 1) / 2) * step, y = (rows === 2 ? 470 + row * 330 : 560) + (1 - k) * 400, r = Math.min(100, step * 0.42);
      g.globalAlpha = k;
      g.save(); g.shadowColor = c.color || PINK; g.shadowBlur = 40; vinyl(g, x, y, r, s.t * 4 + i, c.color || PINK); g.restore();
      s.face(c, x, y, r * 0.62);
      const w = Math.min(step * 0.95, 230);
      g.fillStyle = 'rgba(12,3,30,0.9)'; s.rr(x - w / 2, y + r + 12, w, 50, 12); g.fill(); g.strokeStyle = c.color || CYAN; g.lineWidth = 3; g.stroke();
      s.text(c.name, x, y + r + 38, 32, '#fff', { max: w - 16 });
      g.globalAlpha = 1;
    });
    if (o.more && u > F.length * per - 1400) s.text('…and ' + o.more + ' more on the line!', 960, 1010, 56, GOLD, { font: BUNGEE, stroke: '#3a0b5e', lw: 10 });
  }
  BOX.intros.tune = {
    title: 'Tune Buzz',
    // How to play (box/howto.js): 6 steps (module howSteps: 6).
    tutorial: [
      { icon: '📻', title: 'Bring your songs', text: 'Everyone adds songs from their phone. Search for anything, or paste a Spotify link.', phone: 'Search, tap a song, done.' },
      { icon: '✂️', title: 'Pick the tricky bit', text: 'You hear the preview and choose which few seconds the room hears first. Skip the obvious part!', phone: 'Slide to pick where the clip starts.' },
      { icon: '🎧', title: 'Name that tune', text: 'The TV plays the clip. Each listen is longer. Type the title: typos are fine. You sit out your own songs.', phone: 'Type the title. The artist too = +50.' },
      { icon: '⚡', title: 'Fast pays', text: '300 points at the first note, ticking down to 100 at the buzzer.' },
      { icon: '🔥', title: 'Rate it', text: 'After each song, rate how hard it was: 1 🍼 Too easy to 5 🔥 Impossible. Guessers’ points are multiplied by the average.', phone: 'Tap 1 to 5.' },
      { icon: '🎯', title: 'The sweet spot', text: 'Your song: some (not all) got it = 150 × difficulty. Everyone got it = 50 ×. Nobody = 0. Pick fun-hard, not impossible!', say: 'The sweet spot. Your song: if some, but not all, got it, you score 150 times the difficulty. If everyone got it, just 50 times. If nobody did, zero. Pick fun-hard, not impossible!' },
    ],
    theme: { accent: PINK, accent2: CYAN, accent3: GOLD, ink: '#fbf3ff', fade: '#06010f', rim: CYAN,
      floor1: '#2a0b5c', floor2: '#0d0326', disc1: '#3a0b5e', disc2: '#150437', pod1: '#231d36', pod2: '#17132a', podTop: PINK, seat: '#231d36', audWall1: '#150437', audWall2: '#06010f',
      spots: ['255,61,139', '56,232,255', '255,210,63', '255,255,255'], confetti: [PINK, CYAN, GOLD, '#5ff09a', '#ffffff', '#b07cff'] },
    host: {
      name: 'DJ Wavelength',
      voice: { kokoro: 'af_nova', speed: 1.0, gender: 'f', like: /female|aria|jenny|emma|ava|samantha/i, accent: /en-(US|GB)/i, pitch: 1.1, rate: 1.04 },
      look: { skin: '#8d5a3b', skinShade: '#6f4329', suit: '#3a0b5e', suit2: '#22073a', lapel: PINK, shirt: '#14052e', tie: 'none', hair: 'curly', hairColor: '#1a0b2a', brow: '#1a0b2a', glasses: CYAN, prop: 'headset', grin: true, sparkle: CYAN },
    },
    lines: {
      welcome: 'Good evening, night owls! You’re tuned to Tune Buzz FM, and I’m DJ Wavelength!',
      roll: 'Tonight’s callers are on the line!', more: '…and {n} more on the line!',
      play: 'The request line is open. Send me your songs!',
    },
    stage, logo, podium, roll, podiumGlyph: '♪',
    hostCam: { x: 960, y: 560, z: 1.6 },
    castOpening: [
      { ms: 2800, sfx: [[0, 'swell'], [900, 'click'], [1500, 'riser']],
        draw(g, s) {
          s.cam(960, lerp(600, 520, ease(s.k)), 1.12 - 0.08 * ease(s.k));
          stage(g, s, { host: false, lights: 0.1 + 0.9 * ss(900, 2400, s.T), air: s.T > 900 ? (s.T < 1300 ? (Math.sin(s.T / 30) > 0 ? 1 : 0) : 1) : 0, eq: ss(1000, 2600, s.T), logo: s.T < 1500 ? 0.15 : ss(1500, 2500, s.T) < 1 ? 0.6 : 1 });
        } },
      { ms: 2400, sfx: [[0, 'whoosh'], [200, 'cheer']], pose: [[100, 'wave', 1800]], say: 'welcome', sayAt: 100, fit: 4200, crowd: [[100, 'cheer', 2000]],
        draw(g, s) {
          const k = ease(s.T / 1800);
          s.cam(960, lerp(540, 560, k), lerp(1, 1.5, k));
          stage(g, s, {});
        } },
      { ms: 1900, sfx: [[480, 'boom'], [520, 'buzzer']],
        draw(g, s) {
          s.cam(960, 600, 1); stage(g, s, { host: false, bare: true, logo: 0.3, lights: 0.55 });
          buzzer(g, s, s.T);
        } },
    ],
  };
})();
