'use strict';
// Price Panic intro: a glitzy pink-and-gold studio with a marquee arch, giant swinging price
// tags and the host, Sterling Sparks, in a sequinned suit with a long silver mic.
// Engine + API: public/box/show.js. Also used as the in-game set (public/box/games/price.js).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, rng, OUT, FONT, TAU } = ST.util, { rr, text, floor } = ST.draw;
  const r = rng(77);
  const STARS = Array.from({ length: 34 }, () => [r() * 1920, r() * 700, 2 + r() * 4, r() * TAU]);
  const ARCH = [];
  for (let i = 0; i <= 64; i++) { // bulbs along the marquee arch
    const a = i / 64; let x, y;
    if (a < 0.2) { x = 300; y = lerp(760, 300, a / 0.2); }
    else if (a < 0.5) { const u = (a - 0.2) / 0.3; x = (1 - u) * (1 - u) * 300 + 2 * (1 - u) * u * 300 + u * u * 960; y = (1 - u) * (1 - u) * 300 + 2 * (1 - u) * u * 60 + u * u * 60; }
    else if (a < 0.8) { const u = (a - 0.5) / 0.3; x = (1 - u) * (1 - u) * 960 + 2 * (1 - u) * u * 1620 + u * u * 1620; y = (1 - u) * (1 - u) * 60 + 2 * (1 - u) * u * 60 + u * u * 300; }
    else { x = 1620; y = lerp(300, 760, (a - 0.8) / 0.2); }
    ARCH.push([x, y]);
  }
  function tag(g, x, y, sc, rot, label, col) {
    g.save(); g.translate(x, y);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -400); g.lineTo(0, 0); g.stroke();
    g.rotate(rot); g.scale(sc, sc);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(60, 40); g.lineTo(60, 230); g.lineTo(-60, 230); g.lineTo(-60, 40); g.closePath();
    g.fillStyle = col; g.fill(); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#1a0630'; g.beginPath(); g.arc(0, 38, 11, 0, TAU); g.fill();
    g.save(); g.translate(0, 140); g.rotate(-Math.PI / 2); text(g, label, 0, 0, 58, '#2a1650', { max: 170 }); g.restore();
    g.restore();
  }
  function stage(g, s, o = {}) {
    const t = s.t, th = s.theme;
    let gr = g.createLinearGradient(0, 0, 0, 780); gr.addColorStop(0, th.wall1); gr.addColorStop(1, th.wall2); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1100);
    for (let i = 0; i < 10; i++) { // glowing columns
      const x = -340 + i * 290, a = 0.12 + 0.07 * Math.sin(t * 1.3 + i);
      gr = g.createLinearGradient(x, 0, x + 130, 0); gr.addColorStop(0, 'rgba(255,79,154,0)'); gr.addColorStop(0.5, `rgba(255,79,154,${a})`); gr.addColorStop(1, 'rgba(255,79,154,0)');
      g.fillStyle = gr; g.fillRect(x, 0, 130, 760);
    }
    for (const [x, y, z, p] of STARS) { g.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + p)); g.fillStyle = '#fff4c2'; g.beginPath(); g.moveTo(x, y - z * 2); g.lineTo(x + z * 0.6, y); g.lineTo(x, y + z * 2); g.lineTo(x - z * 0.6, y); g.fill(); }
    g.globalAlpha = 1;
    // the marquee arch
    g.beginPath(); g.moveTo(300, 780); g.lineTo(300, 300); g.quadraticCurveTo(300, 60, 960, 60); g.quadraticCurveTo(1620, 60, 1620, 300); g.lineTo(1620, 780);
    g.lineWidth = 54; g.strokeStyle = '#3a0f66'; g.stroke(); g.lineWidth = 8; g.strokeStyle = th.accent; g.stroke();
    const chase = Math.floor(t * 9);
    for (let i = 0; i < ARCH.length; i++) { const on = (i + chase) % 4 === 0; g.fillStyle = on ? '#fffbe0' : 'rgba(255,230,160,0.35)'; g.beginPath(); g.arc(ARCH[i][0], ARCH[i][1], on ? 9 : 7, 0, TAU); g.fill(); }
    // inside the arch: a dark screen with sliding price stripes
    g.save(); g.beginPath(); g.moveTo(326, 780); g.lineTo(326, 300); g.quadraticCurveTo(326, 86, 960, 86); g.quadraticCurveTo(1594, 86, 1594, 300); g.lineTo(1594, 780); g.clip();
    g.fillStyle = 'rgba(10,2,24,0.55)'; g.fillRect(300, 60, 1320, 720);
    g.globalAlpha = 0.08; g.fillStyle = '#ffd23f'; for (let i = 0; i < 12; i++) { const x = ((i * 180 + t * 40) % 2000) - 100; g.beginPath(); g.moveTo(x, 760); g.lineTo(x + 70, 760); g.lineTo(x + 400, 80); g.lineTo(x + 330, 80); g.fill(); }
    g.globalAlpha = 1; g.restore();
    tag(g, 140, 300, 0.95, Math.sin(t * 1.1) * 0.09, '$9.99', '#ffd23f');
    tag(g, 1790, 340, 0.85, Math.sin(t * 1.3 + 1) * 0.09, '$$$', '#3ee6ff');
    tag(g, 60, 120, 0.6, Math.sin(t * 0.9 + 2) * 0.1, '50% OFF', '#ff4f9a');
    tag(g, 1870, 110, 0.6, Math.sin(t * 1.2 + 3) * 0.1, 'SALE', '#2ee6a6');
    floor(g, th, t);
    if (!o.game && !o.bare) { // contestant row (left)
      for (let i = 0; i < 3; i++) { const x = 470 + i * 190; g.save(); g.translate(x, 840); g.fillStyle = '#2a0b4a'; rr(g, -70, 0, 140, 120, 10); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(); g.fillStyle = ['#ff4f9a', '#3ee6ff', '#2ee6a6'][i]; rr(g, -56, 20, 112, 30, 8); g.fill(); g.restore(); }
    }
    if (o.host !== false) s.hostAt(1380, 800, 0.85);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(0,0,0,${(1 - o.lights) * 0.86})`; g.fillRect(-600, -300, 3120, 1700); }
    if (o.logo !== 0) { g.save(); g.translate(960, 300); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
    s.spots(o.spots == null ? 0.7 : o.spots);
  }
  function logo(g, s, lit) {
    g.rotate(-0.05);
    const w = 640, h = 240, pad = () => { g.beginPath(); g.moveTo(-w / 2 + 80, -h / 2); g.lineTo(w / 2 - 26, -h / 2); g.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + 26); g.lineTo(w / 2, h / 2 - 26); g.quadraticCurveTo(w / 2, h / 2, w / 2 - 26, h / 2); g.lineTo(-w / 2 + 80, h / 2); g.lineTo(-w / 2, 0); g.closePath(); };
    if (lit > 0.5) { g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(0, 0, 50, 0, 0, 480); rg.addColorStop(0, `rgba(255,200,80,${0.35 * lit})`); rg.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = rg; g.fillRect(-500, -500, 1000, 1000); g.restore(); }
    pad(); g.fillStyle = '#3a2c14'; g.fill(); g.globalAlpha = lit; g.fillStyle = '#ffd23f'; g.fill(); g.globalAlpha = 1; g.lineWidth = 12; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#1a0630'; g.beginPath(); g.arc(-w / 2 + 62, 0, 20, 0, TAU); g.fill();
    g.globalAlpha = 0.25 + 0.75 * lit;
    text(g, 'PRICE', 50, -46, 96, '#ff4f9a', { stroke: OUT, lw: 14 });
    text(g, 'PANIC!', 50, 58, 118, '#fff', { stroke: '#2a1650', lw: 18 });
    g.globalAlpha = 1;
    for (let i = 0; i < 18; i++) { const on = lit > 0.5 && (i + Math.floor(s.t * 8)) % 3 === 0; g.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.3)'; const x = -w / 2 + 110 + i * 28; g.beginPath(); g.arc(x, -h / 2 + 14, 5, 0, TAU); g.arc(x, h / 2 - 14, 5, 0, TAU); g.fill(); }
  }
  function podium(g, s, x, y, sc) { s.podium(x, y, sc, '$'); }

  BOX.intros.price = {
    title: 'Price Panic',
    // How to play (box/howto.js): one card per step, 6 steps (module howSteps).
    tutorial: [
      { icon: '🏷️', title: 'Guess the price', text: 'A product goes up on the big screen. How much does it cost?', phone: 'Slide or tap to set your guess (or ⌨️ Type an exact price), then tap 🔒 Lock in.' },
      { icon: '📉', title: 'Don’t go over!', text: 'The closer you are, the more points, up to 1000. Go OVER the real price and your points are cut in half!' },
      { icon: '🎯', title: 'Bonuses', text: 'Within 5% without going over: Bullseye, +500. The exact price: Jackpot, +1000! Three close rounds in a row: Hot Streak, +300.' },
      { icon: '⚡', title: 'Power-ups', text: 'Once each per game: 🎯 Double Down (×2), 🛡️ Bust Shield (no halving) and 👀 Peek at the room’s average.', phone: 'Tap a power-up before you lock in.' },
      { icon: '⬆️', title: 'Quick rounds', text: 'Higher or Lower? and Which Costs More? are fast-tap rounds. Be right AND quick for a speed bonus.', phone: 'Tap ⬆️ or ⬇️, or tap the pricier item.' },
      { icon: '🛒', title: 'Shopping Spree', text: 'The last round shows three items. Guess the TOTAL: it’s worth double points. Highest score wins!' },
    ],
    theme: { accent: '#ff4f9a', accent2: '#ffd23f', accent3: '#ffd23f', ink: '#fff8ef', fade: '#0d0322', wall1: '#2b0a4d', wall2: '#0f0424', floor1: '#2a0f4a', floor2: '#0b0318', disc1: '#5a1d7a', disc2: '#2a0b45',
      pod1: '#6b2196', pod2: '#2a0b4a', podTop: '#ffd23f', podPanel: '#1d0838', rim: '#ff8fd8', seat: '#4a1663', audWall1: '#22093c', audWall2: '#080212',
      spots: ['255,236,190', '255,120,200', '120,230,255', '255,236,190'], confetti: ['#ff4f9a', '#ffd23f', '#3ee6ff', '#2ee6a6', '#ffffff', '#b06cff'] },
    host: {
      name: 'Sterling Sparks',
      voice: { kokoro: 'am_puck', speed: 1.15, like: /guy|davis|christopher|eric|andrew|brian|google us english|male/i, accent: /en-US/i, pitch: 1.15, rate: 1.12 },
      look: { skin: '#f1c19a', skinShade: '#d99e78', suit: '#b0249a', suit2: '#6d0f66', lapel: '#ffd23f', shirt: '#fffdf7', tie: 'bow', tieColor: '#ffd23f', hair: 'pomp', hairColor: '#2a1838', hairShade: '#6a5590', streak: '#e6e2f4', brow: '#7d7a90', prop: 'mic', grin: true, sparkle: '#fff2a8' },
    },
    lines: {
      welcome: 'Good evening, and welcome to Price Panic! I\'m your host, Sterling Sparks!',
      joke: 'Prices are so high tonight, my suit had to take out a loan!',
      meet: 'Now let\'s meet tonight\'s contestants!',
      banter: ['Contestants, tell me something funny about yourselves!', 'Phones out, people! The audience is dying to know you!', 'Take your time. I\'ll just stand here… looking fabulous.', 'Type a funny fact! Bonus points for embarrassing!'],
      first: 'Let\'s meet our contestants! First up, {name}',
      intros: ['Say hello to {name}', 'Give it up for {name}', 'Make some noise for {name}', 'Here comes {name}', 'Put your hands together for {name}', 'Wave hello to {name}', 'Next up, it\'s {name}'],
      last: 'And last but not least, {name}',
      noFact: 'a person of mystery! No fact, no problem!',
      others: 'And a big hand for everyone else!',
      roll: 'Here\'s tonight\'s cast!', more: '…and {n} more!',
      play: 'Let\'s play Price Panic!',
    },
    stage, logo, podium,
    hostCam: { x: 1170, y: 610, z: 1.75 },
    opening: [
      { ms: 4800, sfx: [[150, 'swell'], [1500, 'start']],
        draw(g, s) {
          s.cam(960, lerp(620, 520, ease(s.k)), 1 + 0.1 * ease(s.k));
          stage(g, s, { lights: ss(400, 2600, s.T) * 0.95 + 0.05, logo: s.T < 1500 ? 0 : s.T < 2100 ? (Math.sin(s.T * 0.09) > 0.1 ? 1 : 0.15) : 1, spots: ss(300, 900, s.T) });
          s.sign(150, 690, 210, 66, 'ON AIR', s.T > 700);
        } },
      { ms: 4200, sfx: [[500, 'cheer']], crowd: [[500, 'cheer', 3700]],
        draw(g, s) { s.audience(ease(s.k), s.T > 500 ? 'cheer' : 'idle'); s.sign(960, 100, 440, 100, 'APPLAUSE', s.T > 500 && (s.T % 760) < 600, '255,150,40'); } },
      { ms: 3600, sfx: [[0, 'whoosh']], pose: [[0, 'wave', 2600]], say: 'welcome', sayAt: 300, fit: 4000,
        draw(g, s) { const k = ease(s.T / 2800); s.cam(lerp(960, 1335, k), lerp(540, 585, k), lerp(1, 2.35, k)); stage(g, s, {}); } },
    ],
  };
})();
