'use strict';
// JustPitch intro: the keynote hall at night. The house is dark; a clicker CLICKS and the big
// screen flickers on with the logo; the stage lights sweep up and Vance Velvet (a slick presenter in
// a teal suit with a headset mic) strolls to the podium. The screen shows a "product" slide that a
// scribble from backstage ruins line by line ("SABOTAGE!"), then the roll call: every speaker's
// name badge on the screen. Engine + API: public/box/show.js ('cast' mode).
// Phones load this file for the how-to-play steps only (no BOX.studio there).
(function () {
  BOX.intros = BOX.intros || {};
  const I = BOX.intros.pitch = {
    title: 'JustPitch',
    // How to play (box/howto.js): 6 steps (the module's howSteps).
    tutorial: [
      { icon: '🎤', title: 'Two on stage, one pitch each', text: 'Each match, two players face off. One presents out loud to the room: a silly product, a book, a scandal. The other is backstage on their phone, sabotaging.', phone: 'Presenting? Stand up by the TV and talk to the room.', say: 'Two on stage, one pitch each. Each match, two players face off. One presents out loud to the room: a silly product, a book, or a scandal. The other is backstage on their phone, sabotaging.' },
      { icon: '✏️', title: 'Draw their slides', text: 'First you both draw at once: the slides (or book cover, Exhibit A, product shot) for the OTHER player’s pitch. They see them for the first time live on the TV.', phone: 'Draw on your phone, then tap Send ✓.', say: 'Draw their slides. First you both draw at once: the slides, or the book cover, or the product shot, for the other player’s pitch. They see them for the first time, live on the TV.' },
      { icon: '😈', title: 'Sabotage from backstage', text: 'Backstage? Flip to the next slide when it hurts most and send cue cards: “Sing the next sentence!” “Introduce your co-founder!” Or write your own.', phone: 'Tap a card to send it. ▶ shows the next slide.', say: 'Sabotage from backstage. Flip to the next slide when it hurts most, and send cue cards: sing the next sentence! Introduce your co-founder! Or write your own.' },
      { icon: '🎬', title: 'Do what the card says', text: 'Presenting? Cue cards flash on your phone and the TV at the same time. Do it, keep a straight face, tap Done it ✓.', phone: 'Tap Done it ✓ after each cue: +10.', say: 'Do what the card says. Cue cards flash on your phone and the TV at the same time. Do it, keep a straight face, and tap done.' },
      { icon: '⇄', title: 'Swap and vote', text: 'Then you swap, with a new topic. The audience reacts live, then votes: 100 points a vote, 300 for the win, 50 for the nastiest saboteur. Big groups play a bracket!', phone: 'Audience: react, then vote for who sold it better.', say: 'Swap and vote. Then you swap, with a new topic. The audience reacts live, then votes: a hundred points a vote, three hundred for the win, and fifty for the nastiest saboteur. Big groups play a bracket!' },
      { icon: '🎭', title: 'Five shows', text: '🗣️ Focus Group (panelists shout lines) · 📊 The Big Presentation · 📚 Buy My Book (rate it in stars) · 🎙️ Press Conference (send in questions) · 📺 Late-Night Infomercial.', say: 'Five shows: the Focus Group, where panelists shout lines. The Big Presentation. Buy My Book, rated in stars. The Press Conference, where you send in questions. And the Late-Night Infomercial.' },
    ],
    theme: { accent: '#ffc83d', accent2: '#ff5a3c', accent3: '#18d4c8', ink: '#f2f4ff', panel: 'rgba(12, 14, 44, 0.92)', fade: '#07081a',
      confetti: ['#ff5a3c', '#18d4c8', '#ffc83d', '#ffffff', '#8e7bff'], spots: ['255,120,90', '120,240,230', '255,220,140', '255,240,210'] },
    host: {
      name: 'Vance Velvet',
      voice: { kokoro: 'am_michael', cb: 'hype', orpheus: 'leo', speed: 1.04, like: /male|guy|david|mark|george|ryan|daniel/i, accent: /en-(US|GB)/i, pitch: 1.0, rate: 1.05 },
      look: { skin: '#c98a5c', skinShade: '#a86c42', suit: '#0f8f88', suit2: '#0a5e5a', sleeve: '#0f8f88', lapel: '#ffc83d', shirt: '#14163a', cuff: '#ffc83d', tie: 'bow', tieColor: '#ff5a3c',
        hair: 'pomp', hairColor: '#1b1410', hairShade: '#3a2a20', brow: '#1b1410', prop: 'headset', grin: true },
    },
    lines: {
      welcome: 'Good evening, and welcome to JustPitch! I’m Vance Velvet. Tonight you will sell the impossible, live, while somebody backstage does everything they can to stop you.',
      roll: 'Please welcome tonight’s speakers!', more: '…and {n} more speakers!',
      play: 'Mics are hot, slides are ready. Let’s pitch!',
    },
  };

  function build() {
    if (I.stage || !BOX.studio) return !!I.stage;
    const ST = BOX.studio, { lerp, ss, ease, easeOut, back, TAU, clamp } = ST.util, { rr, text } = ST.draw;
    const BIG = 'Anton, Bungee, Impact, sans-serif', HAND = '"Permanent Marker", cursive';
    try { if (document.fonts) { document.fonts.load('60px Anton'); document.fonts.load('40px "Permanent Marker"'); } } catch { /* fine */ }
    const SX = 560, SY = 90, SW = 800, SH = 470; // the projection screen
    function hall(g, t, lights) {
      let gr = g.createLinearGradient(0, -300, 0, 900); gr.addColorStop(0, '#07081c'); gr.addColorStop(0.6, '#1a2160'); gr.addColorStop(1, '#0d0f30');
      g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1200);
      // truss with lamps
      g.fillStyle = '#20243f'; g.fillRect(-600, -40, 3120, 26);
      for (let i = 0; i < 14; i++) { const x = 60 + i * 140; g.fillStyle = '#30365c'; rr(g, x - 16, -18, 32, 34, 6); g.fill(); g.fillStyle = ['#ff5a3c', '#18d4c8', '#ffc83d'][i % 3]; g.globalAlpha = 0.4 + 0.6 * lights; g.beginPath(); g.arc(x, 12, 10, 0, TAU); g.fill(); g.globalAlpha = 1; }
      // beams
      if (lights > 0) {
        g.save(); g.globalCompositeOperation = 'lighter';
        for (const [x, col, ph] of [[300, '255,90,60', 0], [960, '255,200,61', 2], [1620, '24,212,200', 4]]) {
          const a = Math.sin(t * 0.6 + ph) * 0.3; g.save(); g.translate(x, 0); g.rotate(a);
          const bg = g.createLinearGradient(0, 0, 0, 1100); bg.addColorStop(0, `rgba(${col},${0.42 * lights})`); bg.addColorStop(1, `rgba(${col},0)`);
          g.fillStyle = bg; g.beginPath(); g.moveTo(-16, 0); g.lineTo(16, 0); g.lineTo(300, 1100); g.lineTo(-300, 1100); g.closePath(); g.fill(); g.restore();
        }
        g.restore();
      }
      // curtains
      for (const side of [0, 1]) {
        g.save(); if (side) { g.translate(1920, 0); g.scale(-1, 1); }
        for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#8c1736' : '#6e0f2a'; const x = -560 + i * 82, sway = Math.sin(t * 0.7 + i) * 5; g.beginPath(); g.moveTo(x, -300); g.lineTo(x + 84, -300); g.lineTo(x + 84 + sway, 880); g.lineTo(x + sway, 880); g.fill(); }
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(150, -300, 30, 1180); g.restore();
      }
      // floor
      gr = g.createLinearGradient(0, 860, 0, 1400); gr.addColorStop(0, '#3b2140'); gr.addColorStop(1, '#120914');
      g.fillStyle = gr; g.fillRect(-600, 860, 3120, 600); g.fillStyle = 'rgba(255,200,61,0.5)'; g.fillRect(-600, 856, 3120, 6);
    }
    function screen(g, on, draw) {
      g.fillStyle = '#1a1d33'; rr(g, SX - 18, SY - 18, SW + 36, SH + 36, 10); g.fill();
      g.fillStyle = on > 0 ? `rgba(240,243,255,${0.15 + 0.85 * on})` : '#0b0c1c'; g.fillRect(SX, SY, SW, SH);
      if (on > 0 && draw) { g.save(); g.beginPath(); g.rect(SX, SY, SW, SH); g.clip(); g.globalAlpha = on; draw(g); g.restore(); g.globalAlpha = 1; }
      if (on > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(960, 325, 50, 960, 325, 700); rg.addColorStop(0, `rgba(160,180,255,${0.18 * on})`); rg.addColorStop(1, 'rgba(160,180,255,0)'); g.fillStyle = rg; g.fillRect(SX - 300, SY - 200, SW + 600, SH + 400); g.restore(); }
    }
    function logo(g, s, lit) {
      g.save(); g.globalAlpha = clamp(lit);
      text(g, 'Just', -150, -10, 150, '#18d4c8', { font: BIG, stroke: '#0b0d24', lw: 14 });
      text(g, 'Pitch', 130, -10, 170, '#ffffff', { font: BIG, stroke: '#ff5a3c', lw: 16 });
      text(g, 'SELL IT · SURVIVE IT · SWAP IT', 0, 110, 40, '#ffc83d', { font: BIG });
      g.restore();
    }
    function logoSlide(g, k) { g.fillStyle = '#14163a'; g.fillRect(SX, SY, SW, SH); g.save(); g.translate(960, SY + SH / 2 - 10); g.scale(0.85, 0.85); logo(g, null, k); g.restore(); }
    // A product slide that gets "sabotaged" line by line.
    function productSlide(g, k) {
      g.fillStyle = '#fff'; g.fillRect(SX, SY, SW, SH);
      g.fillStyle = '#1d2560'; g.fillRect(SX, SY, SW, 80); text(g, 'OUR PRODUCT', SX + 40, SY + 42, 48, '#fff', { font: BIG, align: 'left' });
      g.fillStyle = '#ff5a3c'; g.beginPath(); g.arc(SX + SW - 50, SY + 40, 22, 0, TAU); g.fill();
      const pen = (pts, col, w, from, to) => {
        const f = clamp((k - from) / (to - from)); if (f <= 0) return;
        const n = Math.max(2, Math.floor(pts.length / 2 * f));
        g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
        for (let i = 0; i < n; i++) { const X = SX + pts[i * 2] * SW, Y = SY + pts[i * 2 + 1] * SH; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }
        g.stroke();
      };
      pen([0.15, 0.55, 0.15, 0.85, 0.42, 0.85, 0.42, 0.55, 0.15, 0.55], '#1d1b26', 9, 0, 0.2);
      pen([0.2, 0.55, 0.2, 0.45, 0.27, 0.45, 0.27, 0.55, 0.3, 0.55, 0.3, 0.45, 0.37, 0.45, 0.37, 0.55], '#e63946', 7, 0.15, 0.3);
      pen([0.15, 0.62, 0.05, 0.5, 0.08, 0.7, 0.15, 0.7], '#2f7bff', 7, 0.3, 0.4); pen([0.42, 0.62, 0.52, 0.5, 0.49, 0.7, 0.42, 0.7], '#2f7bff', 7, 0.36, 0.46);
      pen([0.58, 0.88, 0.64, 0.76, 0.7, 0.8, 0.78, 0.58, 0.84, 0.64, 0.94, 0.22], '#2bb673', 10, 0.5, 0.72);
      if (k > 0.78) text(g, 'SABOTAGE!', SX + SW * 0.62, SY + SH * 0.36, 70 * back((k - 0.78) / 0.12), '#e63946', { font: HAND, stroke: '#fff', lw: 8 });
    }
    function podium(g, s, x, y, sc) {
      g.save(); g.translate(x, y); g.scale(sc, sc);
      const dg = g.createLinearGradient(0, 0, 0, 240); dg.addColorStop(0, '#8a4b26'); dg.addColorStop(1, '#3d1f0e');
      g.fillStyle = dg; g.beginPath(); g.moveTo(-170, 0); g.lineTo(170, 0); g.lineTo(140, 250); g.lineTo(-140, 250); g.closePath(); g.fill();
      g.fillStyle = '#ffc83d'; rr(g, -190, -18, 380, 30, 10); g.fill();
      g.fillStyle = '#14163a'; rr(g, -110, 70, 220, 90, 14); g.fill(); text(g, '🎤', 0, 118, 60, '#fff');
      g.restore();
    }
    function stage(g, s, o = {}) {
      const lights = o.lights == null ? 1 : o.lights;
      hall(g, s.t, lights);
      screen(g, o.screen == null ? 1 : o.screen, o.slide || ((gg) => logoSlide(gg, o.logo == null ? 1 : o.logo)));
      if (o.host !== false) s.hostAt(960, 840, 0.78);
      if (lights < 1) { g.fillStyle = `rgba(4,5,18,${(1 - lights) * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
      s.spots(o.spots == null ? 0.5 : o.spots);
    }
    Object.assign(I, {
      stage, logo, podium,
      hostCam: { x: 960, y: 640, z: 1.8 },
      castOpening: [
        // 1. Dark hall; the clicker clicks and the screen flickers on with the logo; the lights sweep up.
        { ms: 2600, sfx: [[300, 'click'], [600, 'swell'], [1600, 'pop']],
          draw(g, s) {
            const T = s.T, on = T < 500 ? 0 : T < 900 ? (Math.random() < 0.5 ? 0.4 : 0.9) : 1;
            s.cam(960, 420, 1.25 - 0.15 * ease(s.k));
            stage(g, s, { host: false, screen: on, lights: ss(1200, 2400, T), logo: ss(900, 1700, T), spots: ss(1500, 2500, T) });
          } },
        // 2. Vance Velvet at the podium: welcome.
        { ms: 2600, sfx: [[0, 'whoosh'], [150, 'cheer']], pose: [[0, 'wave', 1400], [1400, 'talk', 1200]], say: 'welcome', sayAt: 100, crowd: [[100, 'cheer', 2200]],
          draw(g, s) { const k = ease(s.T / 1800); s.cam(960, lerp(460, 620, k), lerp(1, 1.6, k)); stage(g, s, { spots: 1 }); s.backs(-60, 1000, 2040, 120, 'cheer'); } },
        // 3. The demo: a product slide, sabotaged line by line from backstage.
        { ms: 3600, sfx: [[0, 'whoosh'], [2900, 'laugh']], pose: [[0, 'point', 2600], [2700, 'shrug', 900]], crowd: [[2900, 'laugh', 700]],
          draw(g, s) { s.cam(960, 400, 1.35); stage(g, s, { slide: (gg) => productSlide(gg, s.T / 3200) }); } },
      ],
    });
    return true;
  }
  if (!build()) { let n = 0; const iv = setInterval(() => { if (build() || ++n > 60) clearInterval(iv); }, 200); }
})();
