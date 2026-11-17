'use strict';
// Alien Abduction intro: deep space, the starship Biscuit cruising home. A Gloop saucer swoops in,
// drops a wobbly green stowaway onto the hull and it oozes in through the dome. Red alert, then the
// logo slams down. Roll call: the crew float past a scanner beam, and every one of them reads "???".
// No host: a narrator reads the lines. Engine + API: public/box/show.js.
// Phones load this file for the HOW TO PLAY steps without the intro engine, so nothing below may
// touch BOX.studio (or the art) until a drawing function runs.
(function () {
  BOX.intros = BOX.intros || {};
  const tutorial = [
    { icon: '🧑‍🚀', title: 'Secret roles', text: 'Most of you are crew. A few are secret 👽 aliens who know each other. Special crew: the 🔬 Scanner and 🔧 Engineer. The 🎭 Mimic is an alien who fools the Scanner.', phone: 'Tap the folder to see your role. Tap 🔒 any time to peek again.' },
    { icon: '🚨', title: 'Fix the ship', text: 'Each shift a system breaks: 🫧 Oxygen, 🔥 Engines or 🛡️ Shields. Everyone picks a repair station. Aliens can sabotage instead of fixing.', phone: 'Tap a station. Aliens get 🔧 Fix and 💥 Sabotage buttons.' },
    { icon: '💥', title: 'The report', text: 'The TV shows HOW MANY sabotages hit, never who. No sabotage = a clean repair and a 🚀 jump home. Each sabotage costs the system a bar; at zero it breaks.', phone: 'Your 🗒️ notes show who worked beside you. The Engineer sees every station’s count.' },
    { icon: '🗣️', title: 'Talk, then vote', text: 'Talk it out, then vote someone into the 🫧 bubble pod, or skip. A tie ejects nobody. The pod announces if they were an alien.', phone: 'Post claims (📍 I was at…, 🤨 I suspect…), then tap a name or ⏭️ Skip vote.' },
    { icon: '👻', title: 'Ghosts & the beam', text: 'Ejected players become ghosts: they patch systems (2 patches = +1 bar) and whisper suspects to the TV. A lone alien gets one 🛸 abduction beam!', phone: 'Ghosts: tap a system to patch, then a name to whisper.' },
    { icon: '🏁', title: 'How to win', text: 'Crew: make the clean jumps home (4 on a Standard trip, 2 spare shifts) or catch every alien. Aliens: break a system, match the crew’s numbers, or run out the fuel.' },
  ];
  const theme = { accent: '#7dff6a', accent2: '#5ae0ff', accent3: '#ff5aa0', ink: '#f4efff', fade: '#05021a', rim: '#7dff6a',
    confetti: ['#7dff6a', '#5ae0ff', '#ff5aa0', '#ffd23f', '#fff3df'], spots: ['170,255,140', '160,220,255', '255,190,240', '170,255,140'] };
  const lines = {
    welcome: 'Deep space. The starship Biscuit is finally heading home.',
    sneak: 'But something slipped aboard. Something… gooey.',
    roll: 'Meet the crew. Every one of them swears they’re human.', more: '…and {n} more!',
    play: 'Fix the ship. Trust no one. And whatever you do, don’t get abducted.',
  };
  const base = { title: 'Alien Abduction', tutorial, theme, host: null, lines };
  if (!BOX.studio) { BOX.intros.alien = { ...base, stage(g) { g.fillStyle = '#05021a'; g.fillRect(-600, -300, 3120, 1700); } }; return; }

  const { lerp, ss, ease, easeOut, back, clamp } = BOX.studio.util;
  const A = () => BOX.alienArt;
  const CAST = [['🦊', '#ff8a4d'], ['🐼', '#5ae0ff'], ['🐸', '#ffd23f'], ['🦄', '#ff5aa0'], ['🐯', '#b388ff'], ['🐧', '#36d6c3']];
  const shipCrew = (pose) => CAST.map(([avatar, color], i) => ({ avatar, color, room: ['engines', 'oxygen', 'shields'][i % 3], pose }));
  function stage(g, s, o = {}) {
    const Z = A(); if (!Z) { g.fillStyle = '#05021a'; g.fillRect(-600, -300, 3120, 1700); return; }
    Z.space(g, s.t, { speed: 40 });
    if (!o.bare) Z.ship(g, 960, 720, 0.6, s.t, { crew: shipCrew('idle') });
    if (o.logo) { g.save(); g.translate(960, 300); logo(g, s, o.logo); g.restore(); }
  }
  function logo(g, s, k) {
    const Z = A(); const kk = back(clamp(k));
    g.save(); g.scale(kk, kk); g.rotate(-0.03);
    Z.glow(g, 0, 0, 520, 'rgba(125,255,106,A)', 0.25);
    Z.text(g, 'ALIEN', 0, -40, 230, '#7dff6a', { stroke: '#1d5a1a', lw: 26 });
    Z.text(g, 'ABDUCTION', 0, 110, 96, '#fff3df', { stroke: '#1d1036', lw: 16 });
    g.restore();
  }
  BOX.intros.alien = {
    ...base,
    stage, logo: (g, s, lit) => logo(g, s, lit || 1),
    castOpening: [
      { ms: 2500, sfx: [[0, 'eerie'], [600, 'whoosh']], say: 'welcome', sayAt: 200, fit: 3600,
        draw(g, s) {
          const Z = A(); s.cam(lerp(700, 960, ease(s.k)), 600, lerp(1.35, 1.05, ease(s.k)));
          Z.space(g, s.t, { speed: 60 });
          Z.ship(g, lerp(300, 960, easeOut(s.T / 2400)), 700, 0.62, s.t, { crew: shipCrew('wave') });
        } },
      { ms: 2400, sfx: [[0, 'zap'], [700, 'glitch'], [1500, 'siren']], say: 'sneak', sayAt: 100, fit: 2600,
        draw(g, s) {
          const Z = A(); s.cam(960, 560, 1.08);
          Z.space(g, s.t, { speed: 40 });
          const alarm = s.T > 1500 ? 'oxygen' : null;
          Z.ship(g, 960, 720, 0.62, s.t, { crew: shipCrew(alarm ? 'idle' : 'idle'), alarm });
          const sx = lerp(2300, 1180, easeOut(s.T / 900)) - (s.T > 1700 ? (s.T - 1700) * 2.6 : 0);
          Z.saucer(g, sx, 230, 0.7, s.t, { beam: s.T > 700 && s.T < 1500 ? 1 : 0, beamLen: 380, empty: s.T > 800 });
          if (s.T > 750 && s.T < 1500) { const k = (s.T - 750) / 750; Z.gloop(g, lerp(1180, 1182, k), lerp(320, 560, ease(k)), lerp(0.4, 0.28, k), s.t, { ph: 1, alpha: 1 - ss(0.85, 1, k) }); }
          if (alarm) { g.fillStyle = `rgba(255,30,60,${0.14 + 0.1 * Math.sin(s.t * 10)})`; g.fillRect(-600, -300, 3120, 1700); }
        } },
      { ms: 2300, sfx: [[0, 'boom'], [150, 'sting']],
        draw(g, s) {
          s.cam(960, 520, 1.02);
          stage(g, s, { logo: clamp((s.T - 120) / 500) });
          if (s.T < 240) { g.fillStyle = `rgba(200,255,190,${0.75 * (1 - s.T / 240)})`; g.fillRect(-600, -300, 3120, 1700); }
          const k = back((s.T - 700) / 400); if (k > 0) { g.save(); g.translate(960, 520); g.scale(k, k); A().text(g, 'FIX THE SHIP · TRUST NO ONE', 0, 0, 46, '#fff', { stroke: '#1d1036', lw: 8 }); g.restore(); }
        } },
    ],
    // The roll call: the crew float past the scanner beam… and it can't tell who's who.
    roll(g, s, featured, u, per, o = {}) {
      const Z = A(); if (!Z) return;
      s.cam(960, 540, 1);
      Z.space(g, s.t, { speed: 30 });
      Z.text(g, 'THE CREW OF THE BISCUIT', 960, 130, 84, '#7dff6a', { stroke: '#1d5a1a', lw: 14, max: 1700 });
      Z.text(g, 'scanner status: inconclusive', 960, 208, 38, '#c9bde8', { font: '"Fredoka", sans-serif', stroke: '#05021a', lw: 6 });
      const n = featured.length, cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / Math.max(1, cols)), gap = Math.min(280, 1640 / Math.max(1, cols));
      // the scanner beam sweeps back and forth
      const bx = 960 + Math.sin(u / 500) * 820;
      g.save(); g.globalCompositeOperation = 'lighter'; const bg = g.createLinearGradient(bx - 60, 0, bx + 60, 0); bg.addColorStop(0, 'rgba(125,255,106,0)'); bg.addColorStop(0.5, 'rgba(125,255,106,0.22)'); bg.addColorStop(1, 'rgba(125,255,106,0)'); g.fillStyle = bg; g.fillRect(bx - 60, 250, 120, 830); g.restore();
      featured.forEach((c, i) => {
        const at = i * per; if (u < at) return;
        const k = clamp((u - at) / 600), col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
        const tx = 960 + (col - (rowN - 1) / 2) * gap, ty = (rows > 1 ? 620 : 780) + row * 280, sc = rows > 1 ? 0.78 : 1;
        const x = lerp(2100, tx, easeOut(k)), y = ty + Math.sin(s.t * 1.5 + i) * 12;
        Z.astro(g, x, y, sc, s.t, { avatar: c.avatar, color: c.color, pose: k < 1 ? 'float' : i % 3 === 0 ? 'wave' : 'idle', ph: i });
        if (k >= 1) {
          Z.text(g, c.name, tx, y + 40, 36, '#fff', { font: '"Fredoka", sans-serif', weight: 700, stroke: '#1d1036', lw: 7, max: gap * 0.92 });
          Z.text(g, '???', tx, y - 232 * sc, 34, '#7dff6a', { stroke: '#1d1036', lw: 6 });
        }
      });
      if (o.more && u > n * per - 1400) Z.text(g, `…and ${o.more} more!`, 960, 1020, 54, '#ffd23f', { stroke: '#1d1036', lw: 10 });
    },
  };
})();
