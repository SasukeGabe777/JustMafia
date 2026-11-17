'use strict';
// Act It Out intro: a plum-velvet theatre. The house lights dim and the logo glows on the closed
// curtain; the curtains part, a spotlight SNAPS on and a mime acts out a penguin while the front
// row's guess bubbles pop ("a duck?" "🐧?" "PENGUIN!"); then the stage pulls back as the gold
// masks swing in. Roll call: each player steps into their own spotlight with a name plate.
// No host: a narrator reads the lines. Engine + API: public/box/show.js ('cast' mode).
// The tutorial is defined first and the drawing only if BOX.studio exists: phones load this
// file for the how-to-play steps without the engine.
(function () {
  BOX.intros = BOX.intros || {};
  const I = BOX.intros.actout = {
    title: 'Act It Out',
    // How to play (box/howto.js): 6 steps (module howSteps: 6).
    tutorial: [
      { icon: '🔦', title: 'Take the stage', text: 'Each scene, one actor (a pair or a trio in big rooms) gets a SECRET prompt on their phone and acts it out for the room.', phone: 'Actor? Read your prompt, then tap 🎬 I’m ready: ACTION! You get one ⏭ Skip.', say: 'Each scene, one actor gets a secret prompt on their phone, and acts it out for the room.' },
      { icon: '💬', title: 'Guess it', text: 'Everyone else types guesses on their phone. Typos, plurals and synonyms count, and 🔥 means you’re close! Guesses show blurred on the TV until one is right.', phone: 'Type a guess and tap Guess! as often as you like.' },
      { icon: '📣', title: 'Shout it out', text: 'Shouting works too: the actor taps ✅ They got it! and picks who said it first.', phone: 'Actor: tap ✅ They got it! then tap the guesser’s name.' },
      { icon: '⭐', title: 'Scoring', text: 'The first right guess and the actor both score 100 + up to 100 for speed. A twist scene gives the actor +50. The final scene counts double!' },
      { icon: '🌀', title: 'Plot twists', text: '🎞️ Silent movie · 🔊 Sound effects only · 🎨 Act it as… a style · 🧊 Freeze frame (one pose per buzz) · 🏃 Relay · 👯 Two-person scene (two prompts, guess both).' },
      { icon: '👏', title: 'Bravo!', text: 'After every scene, applaud the best performance: each 👏 is +25 for the actor. The awards night crowns the Oscar-worthy and the Mime Master!', phone: 'Tap 👏 on the actor you loved.' },
    ],
    theme: { accent: '#ffc93c', accent2: '#ff5d73', accent3: '#ffe6a8', ink: '#fff4dc', panel: 'rgba(42, 13, 38, 0.9)', fade: '#0c0614',
      confetti: ['#ffc93c', '#ff5d73', '#fff4dc', '#35d0c3', '#b05ad0'], spots: ['255,240,190', '255,220,160', '255,240,210', '255,230,180'] },
    host: null,
    lines: {
      welcome: 'Ladies and gentlemen, please take your seats. The show is about to begin!',
      roll: 'Starring, tonight…', more: '…and {n} more stars!',
      play: 'Lights… camera… act it out!',
    },
  };
  const ST = BOX.studio; if (!ST) return;
  const { lerp, ss, ease, easeOut, back, rng, TAU, clamp } = ST.util, { rr, text } = ST.draw;
  const LUCKY = '"Luckiest Guy", "Lilita One", sans-serif', LIL = '"Lilita One", sans-serif';
  try { if (document.fonts) document.fonts.load('80px "Luckiest Guy"'); } catch { /* fine */ }
  const ART = () => BOX.actoutArt || null;
  const R = rng(777);
  const HEADS = Array.from({ length: 16 }, (_, i) => ({ x: -120 + i * 140 + R() * 40, ph: R() * TAU, s: 0.85 + R() * 0.35 }));
  const DUST = Array.from({ length: 50 }, () => ({ x: R(), y: R(), v: 0.02 + R() * 0.05, r: 1.5 + R() * 3 }));
  let CURL = null, CURR = null, VAL = null;
  function bake() { const A = ART(); if (!A || CURL) return; CURL = A.curtain(420, 1500, false); CURR = A.curtain(420, 1500, true); VAL = A.valance(3120, 110); }

  const FLOOR = 840;
  // The set. o.open 0..1 curtains, o.lights 0..1, o.spot {x, k} the spotlight, o.logo 0..1 (on the curtain), o.masks 0..1
  function stage(g, s, o = {}) {
    bake();
    const t = s.t, open = o.open == null ? 1 : o.open;
    let gr = g.createRadialGradient(960, 420, 60, 960, 500, 1500); gr.addColorStop(0, '#4a1a4e'); gr.addColorStop(0.6, '#1e0a22'); gr.addColorStop(1, '#0b0410'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    g.fillStyle = 'rgba(90, 20, 80, 0.4)'; for (let x = -600; x < 2520; x += 64) g.fillRect(x, -300, 30, FLOOR + 300);
    gr = g.createLinearGradient(0, FLOOR, 0, 1400); gr.addColorStop(0, '#6b3b16'); gr.addColorStop(1, '#1e0e05'); g.fillStyle = gr; g.fillRect(-600, FLOOR, 3120, 700);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3; for (let i = -16; i <= 16; i++) { g.beginPath(); g.moveTo(960 + i * 90, FLOOR); g.lineTo(960 + i * 210, 1400); g.stroke(); }
    g.fillStyle = '#2a160a'; g.fillRect(-600, FLOOR - 4, 3120, 8);
    if (o.extra) o.extra(g, s);
    if (o.spot) spotlight(g, s, o.spot.x, o.spot.k);
    // footlights
    const fl = o.lights == null ? 1 : o.lights;
    for (let i = 0; i < 18; i++) { const x = 180 + i * 92; g.fillStyle = fl > 0.2 ? '#fff3c4' : '#6a5a3a'; g.beginPath(); g.ellipse(x, FLOOR + 14, 16, 9, 0, 0, TAU); g.fill(); if (fl > 0.2) { const rg = g.createRadialGradient(x, FLOOR, 2, x, FLOOR, 90); rg.addColorStop(0, `rgba(255,220,140,${0.35 * fl})`); rg.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = rg; g.beginPath(); g.arc(x, FLOOR, 90, 0, TAU); g.fill(); } }
    // curtains (closed = meet in the middle)
    if (CURL) {
      const w = lerp(1180, 300, ease(open)), sway = Math.sin(t * 0.8) * 8;
      g.drawImage(CURL, -300 + sway, -300, w + 300, 1500);
      g.drawImage(CURR, 1920 - w - sway, -300, w + 300, 1500);
      if (o.logo && open < 0.35) { g.save(); g.globalAlpha = o.logo * (1 - open / 0.35); g.translate(960, 400); logo(g, s, o.logo); g.restore(); }
      g.drawImage(VAL, -600, -40);
    }
    // the masks over the stage
    const A = ART(), mk = o.masks == null ? 1 : o.masks;
    if (A && mk > 0) { const y = lerp(-160, 70, back(mk)), w = Math.sin(t * 1.3) * 0.08; A.mask(g, 900, y, 1.1, true, -0.25 + w); A.mask(g, 1020, y, 1.1, false, 0.25 - w); }
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(6,2,10,${(1 - o.lights) * 0.7})`; g.fillRect(-600, -300, 3120, 1700); }
  }
  function spotlight(g, s, x, k) {
    if (k <= 0) return;
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = clamp(k);
    let gr = g.createLinearGradient(0, -200, 0, FLOOR); gr.addColorStop(0, 'rgba(255,240,190,0.03)'); gr.addColorStop(1, 'rgba(255,236,180,0.38)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - 40, -300); g.lineTo(x + 40, -300); g.lineTo(x + 250, FLOOR); g.lineTo(x - 250, FLOOR); g.closePath(); g.fill();
    gr = g.createRadialGradient(x, FLOOR, 10, x, FLOOR, 300); gr.addColorStop(0, 'rgba(255,240,190,0.6)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, FLOOR, 300, 60, 0, 0, TAU); g.fill();
    for (const d of DUST) { const yy = ((d.y - s.t * d.v) % 1 + 1) % 1; g.fillStyle = 'rgba(255,240,200,0.35)'; g.beginPath(); g.arc(x + (d.x - 0.5) * 420 * (yy + 0.2), yy * FLOOR, d.r, 0, TAU); g.fill(); }
    g.restore();
  }
  function logo(g, s, lit) {
    const k = back(clamp(lit));
    g.save(); g.scale(k, k);
    rr(g, -440, -150, 880, 300, 40); g.fillStyle = 'rgba(42, 13, 38, 0.92)'; g.fill(); g.lineWidth = 10; g.strokeStyle = '#ffc93c'; g.stroke();
    for (let i = 0; i < 26; i++) { const x = -410 + i * 32.8, on = (i + Math.floor(s.t * 6)) % 3 !== 0; g.fillStyle = on ? '#fff3c4' : 'rgba(255,240,200,0.25)'; g.beginPath(); g.arc(x, -132, 7, 0, TAU); g.arc(x, 132, 7, 0, TAU); g.fill(); }
    g.save(); g.shadowColor = '#ffc93c'; g.shadowBlur = 30;
    text(g, 'ACT IT', 0, -38, 118, '#fff4dc', { font: LUCKY, stroke: '#6b1d5e', lw: 14 });
    g.rotate(-0.04); text(g, 'OUT!', 0, 76, 136, '#ffc93c', { font: LUCKY, stroke: '#8a5a00', lw: 14 });
    g.restore(); g.restore();
  }
  // Front-row heads and their guess bubbles.
  function front(g, s, bubbles) {
    for (const h of HEADS) { const r = 70 * h.s, y = 1130 + Math.sin(s.t * 2.2 + h.ph) * 6; g.fillStyle = '#1a0812'; g.beginPath(); g.arc(h.x, y - r * 0.6, r, 0, TAU); g.fill(); g.fillRect(h.x - r * 1.25, y - r * 0.1, r * 2.5, r * 2); g.strokeStyle = 'rgba(255,210,120,0.25)'; g.lineWidth = 3; g.beginPath(); g.arc(h.x, y - r * 0.6, r, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    for (const b of bubbles || []) {
      if (b.k <= 0) continue;
      const sc = back(clamp(b.k)), right = b.right;
      g.save(); g.translate(b.x, b.y); g.scale(sc, sc);
      g.font = `${right ? 66 : 50}px ${LIL}`; const tw = g.measureText(b.t).width + 60;
      rr(g, -tw / 2, -50, tw, 96, 44); g.fillStyle = right ? '#ffc93c' : 'rgba(255,250,240,0.95)'; g.fill(); g.lineWidth = 6; g.strokeStyle = right ? '#8a5a00' : '#2a0d26'; g.stroke();
      g.beginPath(); g.moveTo(-16, 44); g.lineTo(0, 76); g.lineTo(16, 44); g.fill();
      text(g, b.t, 0, 2, right ? 66 : 50, '#2a0d26', { font: LIL });
      g.restore();
    }
  }
  function mimeAt(g, s, x, kind, sc = 1.6) {
    const A = ART(); if (!A) return;
    const P = A.P, sw = (Math.sin(s.t * Math.PI * (kind === 'penguin' ? 3.2 : 1.6)) + 1) / 2;
    const pose = kind === 'penguin' ? A.lerpPose(P.penguin, P.penguin2, sw) : kind === 'bow' ? A.lerpPose(P.stand, P.think, 0.3) : A.lerpPose(P.hero, P.hero, 0);
    const bob = kind === 'penguin' ? -Math.abs(Math.sin(s.t * 6.4)) * 10 : 0;
    A.mime(g, x, FLOOR + 10 + bob, sc, pose, s.t);
  }
  function rollCall(g, s, F, u, per, o) {
    s.cam(960, 540, 1);
    const n = F.length, cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / Math.max(1, cols)), gap = Math.min(290, 1500 / Math.max(1, cols));
    stage(g, s, { masks: 1, lights: 0.85, extra(gg) {
      F.forEach((c, i) => {
        const k = clamp((u - i * per) / 500); if (k <= 0) return;
        const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
        const x = 960 + (col - (rowN - 1) / 2) * gap + (row % 2 ? gap / 3 : 0);
        spotlight(gg, s, x, k * (rows > 1 ? 0.6 : 0.85));
      });
    } });
    text(g, '★ STARRING ★', 960, 250, 84, '#ffc93c', { font: LUCKY, stroke: '#3a0b33', lw: 14 });
    F.forEach((c, i) => {
      const k = clamp((u - i * per) / 500); if (k <= 0) return;
      const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
      const x = 960 + (col - (rowN - 1) / 2) * gap + (row % 2 ? gap / 3 : 0), y = (rows > 1 ? 560 : 640) + row * 230, r = (rows > 1 ? 70 : 92) * easeOut(k);
      g.save(); g.shadowColor = 'rgba(255,220,140,0.8)'; g.shadowBlur = 40;
      g.fillStyle = '#fff4dc'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.restore();
      g.lineWidth = 10; g.strokeStyle = c.color || '#ffc93c'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
      s.emoji(c.avatar || '🙂', x, y + 4, r * 1.15);
      if (k >= 1) { rr(g, x - gap * 0.44, y + r + 14, gap * 0.88, 56, 14); g.fillStyle = '#2a0d26'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#ffc93c'; g.stroke(); text(g, c.name, x, y + r + 43, 34, '#fff4dc', { font: LIL, max: gap * 0.8 }); }
    });
    if (o.more && u > n * per - 1200) text(g, `…and ${o.more} more stars!`, 960, 1020, 52, '#ffe6a8', { font: LIL, stroke: '#2a0d26', lw: 8 });
  }
  Object.assign(I, {
    stage, logo, roll: rollCall,
    castOpening: [
      // The house goes dark; the footlights come up and the logo glows on the closed curtain.
      { ms: 2300, sfx: [[100, 'swell'], [900, 'click']],
        draw(g, s) { s.cam(960, lerp(470, 430, ease(s.k)), lerp(1.18, 1.06, ease(s.k))); stage(g, s, { open: 0, lights: 0.25 + 0.75 * ss(300, 1400, s.T), logo: ss(700, 1300, s.T), masks: 0 }); } },
      // The curtains part, the spotlight snaps on and the mime acts out a penguin; the front row guesses.
      { ms: 2900, sfx: [[0, 'whoosh'], [600, 'click'], [2200, 'cheer']], say: 'welcome', sayAt: 200, fit: 2700, crowd: [[2200, 'cheer', 1500]],
        draw(g, s) {
          const T = s.T, open = ease(clamp(T / 700)), spot = T > 600 ? 1 : 0;
          s.cam(960, lerp(540, 580, ease(s.k)), lerp(0.98, 1.06, ease(s.k)));
          stage(g, s, { open, spot: { x: 960, k: spot }, masks: 0, extra(gg) { if (spot) mimeAt(gg, s, 960, 'penguin'); } });
          if (!spot) { g.fillStyle = 'rgba(6,2,10,0.35)'; g.fillRect(-600, -300, 3120, 1700); }
          front(g, s, [
            { t: 'a duck?', x: 470, y: 560, k: (T - 1000) / 250 },
            { t: '🐧 ?', x: 1450, y: 500, k: (T - 1500) / 250 },
            { t: 'PENGUIN!', x: 1420, y: 680, k: (T - 2100) / 250, right: true },
          ]);
        } },
      // Pull back: the masks swing down over the stage, the tagline lands.
      { ms: 2200, sfx: [[0, 'whoosh'], [500, 'win']],
        draw(g, s) {
          const k = ease(s.T / 1600);
          s.cam(960, lerp(600, 520, k), lerp(1.22, 0.98, k));
          stage(g, s, { spot: { x: 960, k: 1 }, masks: ss(100, 900, s.T), extra(gg) { mimeAt(gg, s, 960, 'hero'); } });
          front(g, s, []);
          const kk = back((s.T - 700) / 450);
          if (kk > 0) { g.save(); g.translate(960, 205); g.scale(kk, kk); rr(g, -560, -50, 1120, 100, 50); g.fillStyle = 'rgba(42,13,38,0.92)'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#ffc93c'; g.stroke(); text(g, 'ONE ACTOR · ONE SECRET · EVERYONE GUESSES', 0, 4, 44, '#ffe6a8', { font: LIL, max: 1060 }); g.restore(); }
        } },
    ],
  });
})();
