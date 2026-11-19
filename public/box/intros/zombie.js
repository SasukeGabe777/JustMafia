'use strict';
// Zombie Survival intro: an emergency broadcast on an old TV (color bars, sirens, a ticker that
// says to stay indoors), then the suburb at dusk as cartoon shamblers rise out of the fog, the
// logo slams down with a crack of lightning, and the survivors stumble into the street one by
// one for the roll call. No host: a narrator reads the lines. Engine + API: public/box/show.js.
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, clamp, TAU } = ST.util;
  const Z = () => BOX.zombieArt;
  const STENCIL = '"Black Ops One", "Bungee", sans-serif', TYPE = '"Special Elite", "Courier New", monospace';
  try { if (document.fonts) { document.fonts.load('40px "Black Ops One"'); document.fonts.load('40px "Special Elite"'); } } catch { /* fine */ }

  function stage(g, s, o = {}) {
    const A = Z(); if (!A) { g.fillStyle = '#0a0612'; g.fillRect(-600, -300, 3120, 1700); return; }
    A.backdrop(g, 'streets', s.t, { dark: o.lights != null ? 0.2 + (1 - o.lights) * 0.5 : 0.25 });
    if (!o.bare) for (let i = 0; i < 6; i++) { const dir = i % 2 ? 1 : -1, x = dir > 0 ? ((s.t * 34 + i * 600) % 2600) - 340 : 1920 - (((s.t * 34 + i * 600) % 2600) - 340); A.zombie(g, x, 1010 + (i % 3) * 22, 0.85, s.t, { seed: i, dir }); }
    A.fog(g, s.t, 0.22, 1000);
    if (o.logo) { g.save(); g.translate(960, 330); logo(g, s, o.logo); g.restore(); }
  }
  function logo(g, s, k) {
    const A = Z(); const kk = back(clamp(k));
    g.save(); g.scale(kk, kk); g.rotate(-0.04);
    A.text(g, 'ZOMBIE', 0, -40, 220, '#9dff5a', { font: STENCIL, stroke: '#10200a', lw: 26 });
    g.fillStyle = '#ffd34a'; g.fillRect(-330, 70, 660, 110); g.fillStyle = '#8a6a00'; g.fillRect(-330, 172, 660, 12);
    A.text(g, 'SURVIVAL', 0, 126, 92, '#141414', { font: STENCIL });
    g.restore();
  }
  // An old TV set on a dresser showing the emergency broadcast.
  function broadcast(g, s) {
    const A = Z(), T = s.T;
    g.fillStyle = '#120c0a'; g.fillRect(-600, -300, 3120, 1700);
    A.glow(g, 960, 520, 900, 'rgba(120,160,255,A)', 0.22);
    g.fillStyle = '#3a2416'; g.fillRect(-600, 860, 3120, 500);
    g.save(); g.translate(960, 500);
    g.fillStyle = '#6a4a2e'; g.strokeStyle = '#1a0f08'; g.lineWidth = 10; A.rr(g, -560, -360, 1120, 720, 60); g.fill(); g.stroke();
    g.fillStyle = '#1a1a1a'; A.rr(g, -480, -290, 820, 580, 50); g.fill();
    g.save(); A.rr(g, -460, -270, 780, 540, 46); g.clip();
    if (T < 700) { const bars = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']; bars.forEach((c, i) => { g.fillStyle = c; g.fillRect(-460 + i * 112, -270, 112, 540); }); }
    else {
      const red = Math.floor(T / 350) % 2; g.fillStyle = red ? '#a01818' : '#701010'; g.fillRect(-460, -270, 780, 540);
      A.text(g, '⚠ EMERGENCY ⚠', -70, -150, 76, '#fff', { font: STENCIL, max: 720 });
      A.text(g, 'BROADCAST', -70, -60, 70, '#ffd34a', { font: STENCIL });
      A.text(g, 'STAY INDOORS', -70, 40, 54, '#fff', { font: TYPE });
      A.text(g, 'DO NOT APPROACH', -70, 100, 44, '#fff', { font: TYPE });
      g.fillStyle = '#000'; g.fillRect(-460, 180, 780, 60);
      const msg = '  MAPLE HEIGHTS · SHAMBLERS REPORTED ON ELM STREET · LOCK YOUR DOORS · DO NOT FEED THEM ·';
      g.font = `36px ${TYPE}`; g.fillStyle = '#ffd34a'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(msg, 320 - (T * 0.35) % 1900, 212);
    }
    // scanlines + static
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = -270; y < 270; y += 6) g.fillRect(-460, y, 780, 2);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`; g.fillRect(-460 + Math.random() * 780, -270 + Math.random() * 540, 3, 2); }
    g.restore();
    // knobs + antenna
    for (const y of [-180, -40]) { g.fillStyle = '#c9a36b'; g.beginPath(); g.arc(440, y, 44, 0, TAU); g.fill(); g.stroke(); g.save(); g.translate(440, y); g.rotate(s.t); g.fillStyle = '#1a0f08'; g.fillRect(-4, -36, 8, 30); g.restore(); }
    g.fillStyle = '#2a1a10'; for (let i = 0; i < 6; i++) g.fillRect(400, 80 + i * 26, 80, 10);
    g.strokeStyle = '#999'; g.lineWidth = 8; g.beginPath(); g.moveTo(-40, -360); g.lineTo(-260, -620); g.moveTo(40, -360); g.lineTo(240, -640); g.stroke();
    g.restore();
    // red siren wash
    g.fillStyle = `rgba(255,30,30,${0.12 + 0.1 * Math.sin(s.t * 8)})`; g.fillRect(-600, -300, 3120, 1700);
  }

  BOX.intros.zombie = {
    title: 'Zombie Survival',
    // How to play (box/howto.js): one card per step, 6 steps (module howSteps).
    tutorial: [
      { icon: '🧟', title: 'Survive', text: 'Survive six days of a zombie outbreak until the rescue arrives. Every scene, you make a choice.', say: 'This is an emergency broadcast. Survive six days until the rescue arrives. Every scene, you make a choice.' },
      { icon: '📱', title: 'Choose', text: 'Pick an option, then watch the TV. No dice: your choices and what you carry decide your fate.', phone: 'Tap one of the options before time runs out. Freezing is risky!' },
      { icon: '🎒', title: 'Your gear', text: 'A 🔦 gets you through the dark, a 🪢 up the wall, a 🩹 cures a bite. Bullets run out!', phone: 'Your backpack says what each thing is good for. Tap 🎁 to give one to a friend.', say: 'Your gear. A flashlight gets you through the dark, a rope gets you up the wall, and a bandage cures a bite. Bullets run out! Your backpack says what each thing is good for. Tap the gift to give one to a friend.' },
      { icon: '📜', title: 'The story remembers', text: 'What you do early on comes back later. Something from day one can save you on the last night.', phone: 'Your 📜 badges show what the story remembers about you.' },
      { icon: '👻', title: 'Bitten? Fallen?', text: 'Bitten? Find a 🩹 medkit by the end of the next scene or you turn. Fall and you become a ghost.', phone: 'Ghost? Bless 🍀 or curse 🕯️ a survivor each scene.' },
      { icon: '🚁', title: 'Scoring', text: 'Points for every scene and every day you survive, and +500 for the rescue. Not everyone makes it: whoever gets furthest wins!' },
    ],
    theme: { accent: '#9dff5a', accent2: '#ffd34a', accent3: '#9dff5a', ink: '#ffffff', fade: '#05070a', rim: '#9dff5a',
      confetti: ['#9dff5a', '#ffd34a', '#ffffff', '#ff7ab8', '#6be4ff'], spots: ['200,255,170', '255,240,200', '200,220,255', '200,255,170'] },
    host: null,
    lines: {
      welcome: 'This is an emergency broadcast. Stay indoors. Do not approach the… the… oh no.',
      rise: 'By sundown, Maple Heights had a new population.',
      roll: 'Only a few made it to the safehouse.', more: '…and {n} more!',
      play: 'Stay together. Grab what you can. And whatever you do… don’t get bitten.',
    },
    stage, logo: (g, s, lit) => logo(g, s, lit || 1),
    castOpening: [
      { ms: 2600, sfx: [[0, 'glitch'], [500, 'siren'], [900, 'sting']], say: 'welcome', sayAt: 300, fit: 4200,
        draw(g, s) { s.cam(960, 520, 1.05 + 0.08 * ease(s.k)); broadcast(g, s); } },
      { ms: 2400, sfx: [[0, 'groan'], [900, 'drag'], [1500, 'groan']], say: 'rise', sayAt: 200, fit: 2600,
        draw(g, s) {
          const A = Z(); s.cam(960, lerp(620, 540, ease(s.k)), lerp(1.25, 1.02, ease(s.k)));
          A.backdrop(g, 'streets', s.t, { dark: 0.35 });
          for (let i = 0; i < 7; i++) { const x = 180 + i * 260, up = easeOut(clamp((s.T - i * 160) / 900)); g.save(); g.beginPath(); g.rect(-600, -300, 3120, 1060 + 300); g.clip(); A.zombie(g, x + (i % 2 ? 1 : -1) * s.T * 0.02, 1040 + (1 - up) * 260, 1, s.t, { seed: i, dir: i % 2 ? 1 : -1 }); g.restore(); }
          A.fog(g, s.t, 0.3, 1020);
        } },
      { ms: 2000, sfx: [[0, 'thunder'], [150, 'boom']],
        draw(g, s) {
          s.cam(960, 520, 1.02);
          stage(g, s, { logo: clamp((s.T - 150) / 500) });
          if (s.T < 260) { g.fillStyle = `rgba(230,240,255,${0.8 * (1 - s.T / 260)})`; g.fillRect(-600, -300, 3120, 1700); }
          const k = back((s.T - 700) / 400); if (k > 0) { g.save(); g.translate(960, 640); g.scale(k, k); Z().text(g, 'SIX DAYS · ONE HORDE · ONE WAY OUT', 0, 0, 46, '#fff', { font: TYPE, stroke: '#000', lw: 8 }); g.restore(); }
        } },
    ],
    // The roll call: survivors sprint in from the left and line up on the street.
    roll(g, s, featured, u, per, o = {}) {
      const A = Z(); if (!A) return;
      g.save(); g.setTransform(s.base[0], 0, 0, s.base[0], s.base[1], s.base[2]);
      A.backdrop(g, 'streets', s.t, { dark: 0.45 });
      const n = featured.length, cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / Math.max(1, cols)), gap = Math.min(270, 1600 / Math.max(1, cols));
      A.text(g, 'THE SURVIVORS', 960, 140, 90, '#9dff5a', { font: STENCIL, stroke: '#10200a', lw: 16 });
      A.text(g, 'signed in at the safehouse', 960, 222, 40, '#fff', { font: TYPE, stroke: '#000', lw: 6 });
      featured.forEach((c, i) => {
        const at = i * per, k = clamp((u - at) / 520); if (u < at) return;
        const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
        const tx = 960 + (col - (rowN - 1) / 2) * gap + (row % 2 ? gap / 2 : 0), y = (rows > 1 ? 850 : 960) + row * 175, sc = rows > 1 ? 0.82 - row * 0.02 : 1.1;
        const x = lerp(-200, tx, easeOut(k));
        A.survivor(g, x, y, sc, s.t, { id: c.id, name: c.name, bot: c.bot, avatar: c.avatar, color: c.color, pose: k < 1 ? 'run' : 'cheer', ph: i });
        if (k >= 1) A.text(g, c.name, tx, y + 40, 38, '#fff', { font: '"Fredoka", sans-serif', stroke: '#120d1c', lw: 7, max: gap * 0.9 });
      });
      // the horde in the distance, getting closer
      for (let i = 0; i < 5; i++) A.zombie(g, 2050 - u * 0.04 - i * 150, 800 + (i % 2) * 16, 0.5, s.t, { seed: i, dir: -1, alpha: 0.85 });
      A.fog(g, s.t, 0.2, 1010);
      if (o.more && u > n * per - 1400) A.text(g, `…and ${o.more} more!`, 960, 1010, 54, '#ffd34a', { stroke: '#000', lw: 10 });
      g.restore();
    },
  };
})();
