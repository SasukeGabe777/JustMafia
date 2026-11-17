'use strict';
// JustBid intro: an auction-house warehouse studio (corrugated walls, roll-up doors, crates,
// hanging lamps, a neon sign) and the auctioneer, Rusty Rattlebang, with his gavel.
// Engine + API: public/box/show.js. Also used as the in-game set (public/box/games/bid.js).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, OUT, TAU } = ST.util, { rr, text, floor } = ST.draw;
  function door(g, x, y, w, h, col, lift) {
    g.fillStyle = '#0d0907'; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,200,120,0.12)'; g.fillRect(x, y + h - 40, w, 40);
    const dh = h * (1 - lift);
    for (let yy = 0; yy < dh; yy += 22) { g.fillStyle = yy % 44 ? col : ST.util.shade(col, -0.2); g.fillRect(x, y + yy, w, Math.min(22, dh - yy)); }
    g.fillStyle = '#c9ccd6'; g.fillRect(x + w / 2 - 40, y + dh - 14, 80, 8);
    g.lineWidth = 12; g.strokeStyle = '#4a4e5c'; g.strokeRect(x - 6, y - 6, w + 12, h + 6);
  }
  function crate(g, x, y, sz) {
    g.fillStyle = '#9a6a3a'; g.fillRect(x, y, sz, sz); g.lineWidth = 5; g.strokeStyle = '#4a2c14'; g.strokeRect(x, y, sz, sz);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + sz, y + sz); g.moveTo(x + sz, y); g.lineTo(x, y + sz); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + sz * 0.45, sz, sz * 0.1);
  }
  const LAMPS = [380, 820, 1100, 1540];
  function stage(g, s, o = {}) {
    const t = s.t, th = s.theme;
    let gr = g.createLinearGradient(0, 0, 0, 780); gr.addColorStop(0, th.wall1); gr.addColorStop(1, th.wall2); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1100);
    for (let x = -600; x < 2520; x += 36) { g.fillStyle = (x / 36) % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.13)'; g.fillRect(x, 0, 18, 760); }
    g.fillStyle = '#22170f'; g.fillRect(-600, 0, 3120, 50); g.fillStyle = '#6a4a30'; for (let x = -580; x < 2520; x += 80) { g.beginPath(); g.arc(x, 25, 5, 0, TAU); g.fill(); }
    door(g, 110, 330, 330, 430, '#d0662a', 0.12 + 0.05 * Math.sin(t * 0.8));
    door(g, 1480, 330, 330, 430, '#2f8f9a', 0.3 + 0.05 * Math.sin(t * 0.7 + 1));
    text(g, 'UNIT 7', 275, 300, 34, '#ffcf7a'); text(g, 'UNIT 12', 1645, 300, 34, '#ffcf7a');
    // the sign board for the logo
    floor(g, th, t);
    if (!o.bare) { crate(g, 20, 640, 150); crate(g, 175, 680, 110); crate(g, 60, 520, 120); crate(g, 1740, 640, 150); crate(g, 1630, 690, 100); }
    for (const x of LAMPS) {
      g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, 50); g.lineTo(x, 140); g.stroke();
      g.fillStyle = '#3a3f4a'; g.beginPath(); g.moveTo(x - 50, 175); g.lineTo(x + 50, 175); g.lineTo(x + 18, 140); g.lineTo(x - 18, 140); g.closePath(); g.fill();
      g.fillStyle = '#ffe2a8'; g.beginPath(); g.arc(x, 178, 12, 0, Math.PI); g.fill();
    }
    if (o.host !== false) s.hostAt(1380, 800, 0.85);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(0,0,0,${(1 - o.lights) * 0.86})`; g.fillRect(-600, -300, 3120, 1700); }
    const lamp = o.lights == null ? 1 : o.lights;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const x of LAMPS) { gr = g.createLinearGradient(x, 175, x, 900); gr.addColorStop(0, `rgba(255,214,150,${0.3 * lamp})`); gr.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 46, 175); g.lineTo(x + 46, 175); g.lineTo(x + 240, 900); g.lineTo(x - 240, 900); g.fill(); }
    g.restore();
    if (o.logo !== 0) { g.save(); g.translate(960, 330); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
    s.spots(o.spots == null ? 0.6 : o.spots);
  }
  function neon(g, str, x, y, px, col, lit, font) {
    g.font = `${px}px ${font || ST.util.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    if (lit > 0.3) { g.globalAlpha = 0.2 * lit; g.strokeStyle = col; g.lineWidth = 22; g.strokeText(str, x, y); g.globalAlpha = 0.45 * lit; g.lineWidth = 10; g.strokeText(str, x, y); }
    g.globalAlpha = 1; g.lineWidth = 5; g.strokeStyle = lit > 0.3 ? col : '#3a332e'; g.strokeText(str, x, y);
    g.globalAlpha = lit; g.lineWidth = 1.8; g.strokeStyle = '#fff'; g.strokeText(str, x, y); g.globalAlpha = 1;
  }
  function logo(g, s, lit) {
    rr(g, -380, -135, 760, 270, 26); g.fillStyle = '#1b1410'; g.fill(); g.lineWidth = 10; g.strokeStyle = '#5a3a22'; g.stroke();
    g.fillStyle = '#8a6a50'; for (const [x, y] of [[-355, -110], [355, -110], [-355, 110], [355, 110]]) { g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); }
    neon(g, 'JUST', -150, -58, 76, '#7fd1ff', lit);
    neon(g, 'BID', 20, 40, 170, '#ff8a3d', lit);
    g.save(); g.translate(250, -20); g.rotate(-0.6); g.globalAlpha = 0.3 + 0.7 * lit;
    g.fillStyle = '#a0632e'; rr(g, -12, -10, 24, 120, 8); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    rr(g, -50, -50, 100, 48, 10); g.fill(); g.stroke(); g.fillStyle = '#ffd23f'; g.fillRect(-50, -30, 100, 8); g.restore();
    g.globalAlpha = 1;
    neon(g, 'SOLD!', 210, 85, 46, '#ff4f6a', lit > 0.5 && (s.t % 2.4) < 1.6 ? lit : 0.1);
  }
  function podium(g, s, x, y, sc) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    g.fillStyle = '#7a4a2a'; g.beginPath(); g.moveTo(-140, 4); g.lineTo(140, 4); g.lineTo(118, 210); g.lineTo(-118, 210); g.closePath(); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 3; for (let yy = 40; yy < 210; yy += 34) { g.beginPath(); g.moveTo(-136 + yy * 0.1, yy); g.lineTo(136 - yy * 0.1, yy); g.stroke(); }
    rr(g, -80, 50, 160, 104, 14); g.fillStyle = '#24160e'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#ffcf7a'; g.stroke();
    text(g, 'LOT', 0, 82, 34, '#ffcf7a'); text(g, '#' + (1 + Math.floor(s.t / 7) % 99), 0, 124, 44, '#fff');
    rr(g, -154, -14, 308, 24, 8); g.fillStyle = '#c98a4a'; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    // the sound block the gavel hits
    g.fillStyle = '#5a3418'; rr(g, 70, -32, 60, 20, 6); g.fill(); g.stroke();
    g.restore();
  }

  BOX.intros.bid = {
    title: 'JustBid',
    // How to play (box/howto.js): one card per step, 6 steps (module howSteps).
    tutorial: [
      { icon: '🔐', title: 'The locker', text: 'A storage locker rolls in with its door half up. You get 3 peeks inside, but careful: clues can lie!', say: 'A locker rolls in with the door half up. Three peeks inside, partner, but them clues can lie!' },
      { icon: '💵', title: 'Bid live', text: 'Everyone bids at the same time. Every new bid restarts “Going once… going twice… SOLD!”', phone: 'Tap +$10, +$25, +$100 or +$500 (or type an amount), then tap Bid.' },
      { icon: '🔦', title: 'Flashlight', text: 'Pay 5% of your cash (at least $25) for a private hint about what’s hidden inside.', phone: 'Tap 🔦 Flashlight peek for a secret hint.' },
      { icon: '📦', title: 'Unpacking', text: 'The winner’s locker is unpacked item by item, from Junk to LEGENDARY. Profit or loss?' },
      { icon: '🧩', title: 'Sets & loans', text: 'Collect 3 items from the same set for a bonus. Broke? Take a bank loan (2 max), repaid with 20% interest.', phone: 'Tap 🧩 My collection to see your sets, or 🏦 Loan for cash.' },
      { icon: '👑', title: 'Specials & winning', text: 'Watch for Sealed Bid, Mystery, Premium and the Grand Locker finale. Highest net worth (cash plus items) wins!', phone: 'Sealed Bid? Type one secret bid and tap Seal it ✉️.' },
    ],
    theme: { accent: '#ff8a3d', accent2: '#ffcf7a', accent3: '#ffd23f', ink: '#fff8ef', fade: '#120b07', wall1: '#3b2a20', wall2: '#140e0a', floor1: '#3a2b20', floor2: '#100b07', disc1: '#5a3c26', disc2: '#2a1c12',
      pod1: '#7a4a2a', pod2: '#2a1a10', podTop: '#c98a4a', rim: '#ffc27a', seat: '#4a2a18', audWall1: '#24170f', audWall2: '#0a0604',
      spots: ['255,222,170', '255,190,120', '255,222,170', '160,210,255'], confetti: ['#ffd23f', '#ff8a3d', '#2ee68a', '#7fd1ff', '#ffffff', '#ff4f6a'] },
    host: {
      name: 'Rusty Rattlebang',
      voice: { like: /guy|davis|eric|christopher|george|male/i, accent: /en-US/i, pitch: 0.8, rate: 1.3 },
      look: { skin: '#f0b48e', skinShade: '#d38f6a', suit: '#7a2e1d', suit2: '#4a180e', sleeve: '#e9d6b0', cuff: '#e9d6b0', lapel: '#5a1f12', shirt: '#e9d6b0', tie: 'bolo', tieColor: '#3ec6c0', hair: 'short', hairColor: '#c8642c', brow: '#a0461c', hat: '#c48a4a', hatBand: '#4a2410', mustache: '#c8642c', prop: 'gavel', watch: true },
    },
    lines: {
      welcome: 'Howdy, folks, and welcome to JustBid! I\'m Rusty Rattlebang, fastest gavel in the West!',
      joke: 'I once auctioned off my own shadow. The buyer still follows me everywhere!',
      meet: 'Now let\'s meet tonight\'s bidders!',
      banter: ['Contestants, tell me somethin\' funny about yourselves!', 'Do I hear a fun fact? Anybody? Going once…', 'Phones out, partners! Type it in!', 'Don\'t be shy! Every fact\'s a bargain!'],
      first: 'Let\'s meet our bidders! Lot number one, {name}',
      intros: ['Lot number {n}, {name}', 'Next on the block, {name}', 'Do I hear a cheer for {name}', 'Step on up, {name}', 'Here\'s a fine one, {name}'],
      last: 'And our final lot, {name}',
      noFact: 'a total mystery locker! Could be treasure!',
      others: 'And a hearty howdy to everyone else!',
      roll: 'Here are tonight\'s bidders!', more: '…and {n} more!',
      play: 'Let\'s play JustBid! Bidding is OPEN!',
    },
    stage, logo, podium,
    hostCam: { x: 1170, y: 610, z: 1.75 },
    opening: [
      { ms: 4800, sfx: [[150, 'creak'], [1500, 'gavel']],
        draw(g, s) {
          s.cam(960, lerp(620, 520, ease(s.k)), 1 + 0.1 * ease(s.k));
          stage(g, s, { lights: ss(300, 2400, s.T) * 0.95 + 0.05, logo: s.T < 1500 ? 0 : s.T < 2200 ? (Math.sin(s.T * 0.08) > 0.2 ? 1 : 0.1) : 1, spots: ss(300, 900, s.T) });
          s.sign(150, 690, 210, 66, 'ON AIR', s.T > 700);
        } },
      { ms: 4200, sfx: [[500, 'cheer']], crowd: [[500, 'cheer', 3700]],
        draw(g, s) { s.audience(ease(s.k), s.T > 500 ? 'cheer' : 'idle'); s.sign(960, 100, 440, 100, 'APPLAUSE', s.T > 500 && (s.T % 760) < 600, '255,150,40'); } },
      { ms: 3600, sfx: [[0, 'whoosh'], [2700, 'gavel']], pose: [[0, 'wave', 2200], [2400, 'gavel', 900]], say: 'welcome', sayAt: 300, fit: 4000,
        draw(g, s) { const k = ease(s.T / 2800); s.cam(lerp(960, 1335, k), lerp(540, 585, k), lerp(1, 2.35, k)); stage(g, s, {}); } },
    ],
  };
})();
