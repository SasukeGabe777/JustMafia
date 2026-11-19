'use strict';
// Blackjack Night intro: the neon sign buzzes on in a dark lounge, the dealer deals a
// blackjack across the green felt, and Lucky Lou in his green visor opens the table.
// Engine + API: public/box/show.js ('cast' mode: these shots, the roll call, then the game).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, OUT, TAU } = ST.util, { rr, text } = ST.draw;
  const RIGHT = '"Righteous", "Lilita One", sans-serif', SCRIPT = '"Pacifico", cursive';
  try { if (document.fonts) { document.fonts.load('80px "Righteous"'); document.fonts.load('80px "Pacifico"'); document.fonts.load('80px "Monoton"'); } } catch { /* fine */ }
  const r = rng(2121);
  const BOKEH = Array.from({ length: 22 }, (_, i) => [r() * 1920, 80 + r() * 600, 30 + r() * 70, r() * TAU, i % 3]);
  const BOKEH_C = ['255, 209, 102', '255, 95, 162', '90, 220, 255'];
  const CHIPC = [['#e8323c', '#8e1420'], ['#2f6bff', '#163a99'], ['#24242c', '#000000'], ['#2fbf71', '#16703f'], ['#8b3fd9', '#4a1a80']];

  let wall = null;
  function wallLayer() {
    if (wall) return wall;
    const c = document.createElement('canvas'); c.width = 1920; c.height = 820; const b = c.getContext('2d');
    const wg = b.createLinearGradient(0, 0, 0, 820); wg.addColorStop(0, '#0d0820'); wg.addColorStop(1, '#2a1240'); b.fillStyle = wg; b.fillRect(0, 0, 1920, 820);
    b.strokeStyle = 'rgba(212, 167, 60, 0.09)'; b.lineWidth = 2; for (let x = 0; x < 1920; x += 48) { b.beginPath(); b.moveTo(x, 60); b.lineTo(x, 820); b.stroke(); }
    for (const fx of [300, 1620]) {
      b.strokeStyle = 'rgba(212, 167, 60, 0.22)'; b.lineWidth = 3;
      for (let k = 1; k <= 5; k++) { b.beginPath(); b.arc(fx, 800, k * 70, Math.PI, TAU); b.stroke(); }
      for (let i = 1; i < 12; i++) { const a = Math.PI + (i / 12) * Math.PI; b.beginPath(); b.moveTo(fx + Math.cos(a) * 80, 800 + Math.sin(a) * 80); b.lineTo(fx + Math.cos(a) * 350, 800 + Math.sin(a) * 350); b.stroke(); }
    }
    b.fillStyle = '#2a1508'; b.fillRect(0, 0, 1920, 60); b.fillStyle = '#d4a73c'; b.fillRect(0, 56, 1920, 5);
    wall = c; return c;
  }
  function chip(g, x, y, rad, c) {
    const ry = rad * 0.42, hh = rad * 0.2;
    g.fillStyle = c[1]; g.beginPath(); g.ellipse(x, y + hh, rad, ry, 0, 0, TAU); g.fill(); g.fillRect(x - rad, y, rad * 2, hh);
    g.fillStyle = 'rgba(255,255,255,.85)'; for (const j of [-0.75, -0.25, 0.25, 0.75]) g.fillRect(x + rad * j - rad * 0.07, y + hh * 0.15, rad * 0.14, hh * 0.9);
    g.fillStyle = c[0]; g.beginPath(); g.ellipse(x, y, rad, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = rad * 0.12; g.setLineDash([rad * 0.28, rad * 0.22]);
    g.beginPath(); g.ellipse(x, y, rad * 0.8, ry * 0.8, 0, 0, TAU); g.stroke(); g.setLineDash([]);
  }
  function card(g, x, y, w, rot, sx, rank, suit, red, faceUp) {
    const h = w * 1.4;
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(Math.max(0.02, sx), 1);
    g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, -w / 2 + 6, -h / 2 + 8, w, h, w * 0.1); g.fill();
    if (!faceUp) {
      g.fillStyle = '#fffdf5'; rr(g, -w / 2, -h / 2, w, h, w * 0.1); g.fill();
      g.fillStyle = '#b3122e'; rr(g, -w / 2 + w * 0.07, -h / 2 + w * 0.07, w * 0.86, h - w * 0.14, w * 0.06); g.fill();
      g.save(); g.clip(); g.strokeStyle = 'rgba(255, 220, 160, 0.5)'; g.lineWidth = w * 0.02;
      for (let i = -h; i < w + h; i += w * 0.12) { g.beginPath(); g.moveTo(-w / 2 + i, -h / 2); g.lineTo(-w / 2 + i + h, h / 2); g.moveTo(-w / 2 + i, h / 2); g.lineTo(-w / 2 + i + h, -h / 2); g.stroke(); }
      g.restore(); text(g, '♠', 0, 4, w * 0.4, '#ffd166', { font: 'Georgia, serif' });
    } else {
      g.fillStyle = '#fffdf5'; rr(g, -w / 2, -h / 2, w, h, w * 0.1); g.fill(); g.strokeStyle = '#c9c2ae'; g.lineWidth = 3; g.stroke();
      const ink = red ? '#cc1530' : '#14141c';
      for (let k = 0; k < 2; k++) { text(g, rank, -w * 0.32, -h * 0.36, w * 0.26, ink, { font: 'Georgia, serif' }); text(g, suit, -w * 0.32, -h * 0.2, w * 0.2, ink, { font: 'Georgia, serif' }); g.rotate(Math.PI); }
      text(g, suit, 0, h * 0.03, w * 0.62, ink, { font: 'Georgia, serif' });
    }
    g.restore();
  }
  function neonText(g, str, x, y, px, font, core, glow, lit) {
    g.save(); g.font = `${px}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (lit > 0.05) { g.shadowColor = glow; g.shadowBlur = 40 * lit; g.fillStyle = core; g.globalAlpha = lit; g.fillText(str, x, y); g.shadowBlur = 16 * lit; g.fillText(str, x, y); }
    g.shadowBlur = 0; g.globalAlpha = 1 - lit * 0.5; g.strokeStyle = 'rgba(120, 100, 130, 0.5)'; g.lineWidth = 2; g.strokeText(str, x, y);
    g.restore();
  }
  // Neon flicker: on at `at` ms with two stutters.
  const flick = (T, at) => (T < at ? 0 : T < at + 90 ? 1 : T < at + 200 ? 0.15 : T < at + 260 ? 1 : T < at + 330 ? 0.3 : 1);
  function arcText(g, str, cx, cy, rad, px, col) {
    g.save(); g.font = `${px}px ${RIGHT}`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    const total = g.measureText(str).width * 1.06; let a = Math.PI / 2 + total / rad / 2;
    for (const ch of str) { const w = g.measureText(ch).width * 1.06, mid = a - w / rad / 2; g.save(); g.translate(cx + Math.cos(mid) * rad, cy + Math.sin(mid) * rad); g.rotate(mid - Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); a -= w / rad; }
    g.restore();
  }
  function felt(g, s, o) {
    // the table: leather rail on the dealer's side, then the felt rolling toward the camera
    let gr = g.createRadialGradient(960, 760, 50, 960, 900, 1300); gr.addColorStop(0, '#1db06f'); gr.addColorStop(0.5, '#0b6440'); gr.addColorStop(1, '#042a1a');
    g.fillStyle = gr; g.fillRect(-600, 800, 3120, 700);
    gr = g.createLinearGradient(0, 780, 0, 822); gr.addColorStop(0, '#6b3519'); gr.addColorStop(1, '#2a1206'); g.fillStyle = gr; g.fillRect(-600, 780, 3120, 40);
    g.fillStyle = '#d4a73c'; g.fillRect(-600, 818, 3120, 4);
    g.strokeStyle = 'rgba(255, 228, 160, 0.35)'; g.lineWidth = 3; g.beginPath(); g.ellipse(960, 640, 900, 420, 0, 0.18 * Math.PI, 0.82 * Math.PI); g.stroke();
    arcText(g, '♠  BLACKJACK PAYS 3 TO 2  ♥', 960, 520, 470, 34, 'rgba(255, 228, 160, 0.6)');
    arcText(g, 'DEALER MUST STAND ON 17', 960, 520, 420, 24, 'rgba(255, 228, 160, 0.42)');
    g.strokeStyle = 'rgba(255, 255, 255, 0.5)'; g.lineWidth = 4;
    for (let i = 0; i < 5; i++) { const a = Math.PI * (0.28 + i * 0.11), x = 960 + Math.cos(a) * 760, y = 640 + Math.sin(a) * 380; g.beginPath(); g.ellipse(x, y, 70, 30, 0, 0, TAU); g.stroke(); }
    if (!o.bare) {
      for (let i = 0; i < 6; i++) chip(g, 360, 980 - i * 9, 40, CHIPC[i % 5]);
      for (let i = 0; i < 4; i++) chip(g, 450, 1010 - i * 9, 40, CHIPC[(i + 2) % 5]);
      for (let i = 0; i < 7; i++) chip(g, 1560, 990 - i * 9, 40, CHIPC[(i + 1) % 5]);
    }
  }
  function stage(g, s, o = {}) {
    const t = s.t, lit = o.neon == null ? 1 : o.neon;
    g.drawImage(wallLayer(), 0, 0, 1920, 820);
    for (const [x0, y, rad, ph, c] of BOKEH) { // soft lounge lights drifting by
      const x = ((x0 + t * 14) % 2100) - 90, a = (0.35 + 0.25 * Math.sin(t * 0.7 + ph)) * (0.3 + 0.7 * lit);
      const rg = g.createRadialGradient(x, y, 0, x, y, rad); rg.addColorStop(0, `rgba(${BOKEH_C[c]},${a})`); rg.addColorStop(1, `rgba(${BOKEH_C[c]},0)`); g.fillStyle = rg; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
    for (let i = 0; i < 48; i++) { const x = 20 + i * 40, w = 0.5 + 0.5 * Math.sin(i * 0.9 - t * 3), on = (0.25 + 0.75 * w * w) * (0.3 + 0.7 * lit); g.fillStyle = `rgba(255, 230, 160, ${on})`; g.beginPath(); g.arc(x, 30, 8, 0, TAU); g.fill(); }
    neonText(g, '21', 300, 470, 190, '"Monoton", cursive', '#ffe2a0', '#ffb238', flick(o.T21 == null ? 1e9 : o.T21, 0) * lit);
    neonText(g, '♦ OPEN ALL NIGHT ♦', 300, 600, 34, RIGHT, '#ffd28c', '#ff9a2a', lit);
    g.save(); g.translate(1620, 470); g.rotate(0.12 + Math.sin(t * 0.6) * 0.03);
    if (lit > 0.05) { g.shadowColor = '#ff2f7d'; g.shadowBlur = 30 * lit; }
    g.strokeStyle = lit > 0.05 ? '#ffd0e4' : 'rgba(160,120,140,.5)'; g.lineWidth = 8; rr(g, -90, -126, 180, 252, 20); g.stroke();
    g.shadowBlur = 0; text(g, '♠', 0, 8, 120, lit > 0.05 ? '#ffd0e4' : 'rgba(160,120,140,.5)', { font: 'Georgia, serif' }); text(g, 'A', -52, -84, 44, lit > 0.05 ? '#ffd0e4' : 'rgba(160,120,140,.5)', { font: 'Georgia, serif' });
    g.restore();
    if (o.host !== false) s.hostAt(960, 800, 0.82);
    felt(g, s, o);
    if (o.deal) o.deal(g, s);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(4,0,10,${(1 - o.lights) * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
    if (o.logo !== 0) { g.save(); g.translate(960, 250); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
    s.spots(o.spots == null ? 0.35 : o.spots);
  }
  function logo(g, s, lit) {
    rr(g, -390, -130, 780, 260, 40); g.fillStyle = 'rgba(12, 6, 22, 0.92)'; g.fill(); g.lineWidth = 8; g.strokeStyle = '#3a2a10'; g.stroke();
    for (let i = 0; i < 30; i++) { // bulbs around the sign
      const a = i / 30, on = lit > 0.5 && (i + Math.floor(s.t * 8)) % 3 === 0;
      const x = a < 0.5 ? -360 + a * 2 * 720 : 360 - (a - 0.5) * 2 * 720, y = a < 0.5 ? -112 : 112;
      g.fillStyle = on ? '#fff3c4' : `rgba(255, 220, 150, ${0.15 + 0.3 * lit})`; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill();
    }
    neonText(g, 'BLACKJACK', 0, -26, 118, RIGHT, '#ffe7a8', '#ffb238', lit);
    g.save(); g.rotate(-0.06); neonText(g, 'Night', 60, 62, 92, SCRIPT, '#ffe3f0', '#ff2f7d', lit); g.restore();
  }
  // The dealer's chip rack sits right in front of him, on the table.
  function podium(g, s, x, y, sc) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    g.fillStyle = '#2a1206'; rr(g, -230, -6, 460, 70, 14); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    const cols = ['#8b3fd9', '#24242c', '#2fbf71', '#2f6bff', '#e8323c', '#e8323c', '#2f6bff', '#2fbf71', '#24242c', '#8b3fd9'];
    for (let i = 0; i < 10; i++) { const cx = -205 + i * 45.5; for (let k = 0; k < 6; k++) { g.fillStyle = cols[i]; rr(g, cx, 4 + k * 9, 36, 8, 3); g.fill(); g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(cx + 8, 5 + k * 9, 4, 6); g.fillRect(cx + 24, 5 + k * 9, 4, 6); } }
    g.restore();
  }
  // Lucky Lou: white shirt, black vest, red bow tie, slick hair, and the green dealer's visor.
  const lou = ST.makeHost({ skin: '#f0bf98', skinShade: '#d89c74', suit: '#1d1d26', suit2: '#0b0b10', sleeve: '#f5f1e6', cuff: '#fffdf7', lapel: '#2a2a36', shirt: '#fffdf7', tie: 'bow', tieColor: '#e8323c', hair: 'pomp', hairColor: '#1a1420', brow: '#1a1420', mustache: '#1a1420', prop: 'cards', grin: true });
  function hostDraw(g, a) {
    lou(g, a);
    const sway = Math.sin(a.t * 0.9 + a.seed) * 4, bounce = a.talk ? -Math.abs(Math.sin(a.t * 6.2)) * 4 : Math.sin(a.t * 1.6) * 1.5;
    const tilt = Math.sin(a.t * 1.7 + a.seed) * 0.035 + (a.talk ? Math.sin(a.t * 5.1) * 0.045 : 0);
    g.save(); g.translate(sway, bounce - 215); g.rotate(tilt); g.translate(0, 215);
    g.fillStyle = 'rgba(46, 200, 130, 0.78)'; g.strokeStyle = '#0d4a2c'; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-70, -330); g.quadraticCurveTo(0, -372, 70, -330); g.lineTo(84, -310); g.quadraticCurveTo(0, -346, -84, -310); g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = '#1a3a2a'; g.lineWidth = 6; g.beginPath(); g.arc(0, -296, 62, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
    g.restore();
  }
  // Shot 2: a blackjack dealt onto the felt (A♠ then K♥), flipped, and called.
  function dealShot(g, s) {
    const T = s.T, shoe = [1500, 860];
    const cards = [['A', '♠', false, 820, 930, -0.08, 250], ['K', '♥', true, 960, 925, 0.06, 520]];
    for (const [rank, suit, red, tx, ty, rot, at] of cards) {
      if (T < at) continue;
      const u = easeOut((T - at) / 380), fl = ss(at + 600, at + 820, T), sx = Math.abs(Math.cos(fl * Math.PI));
      card(g, lerp(shoe[0], tx, u), lerp(shoe[1], ty, u), 150, lerp(0.6, rot, u), sx, rank, suit, red, fl > 0.5);
    }
    for (let i = 0; i < 5; i++) { const at = 150 + i * 120; if (T < at) continue; const u = back((T - at) / 320); chip(g, lerp(560, 1150, (i % 2) * 0.1 + 0.5), 1010 - i * 9 * Math.min(1, u) - (1 - Math.min(1, u)) * 120, 42, CHIPC[i % 5]); }
    const k = back((T - 1400) / 380);
    if (k > 0) {
      g.save(); g.translate(890, 760); g.rotate(-0.06); g.scale(k, k);
      rr(g, -200, -48, 400, 96, 48); g.fillStyle = '#ffd166'; g.fill(); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
      text(g, 'BLACKJACK!', 0, 4, 60, '#3a2300', { font: RIGHT });
      g.restore();
    }
  }

  // The roll call: every player lands on the felt as a poker chip with their face on it.
  function roll(g, s, F, u, per, o) {
    const n = F.length;
    s.cam(960, 540, 1); stage(g, s, { bare: true, logo: 0, spots: 0.4 });
    g.fillStyle = 'rgba(4,0,10,0.35)'; g.fillRect(-600, -300, 3120, 1700);
    neonText(g, 'AT THE TABLE TONIGHT', 960, 150, 74, RIGHT, '#ffe3f0', '#ff2f7d', 1);
    const cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), tw = Math.min(250, 1600 / Math.max(1, cols));
    F.forEach((c, i) => {
      const k = easeOut((u - i * per) / 380); if (k <= 0) return;
      const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
      const x = 960 + (col - (rowN - 1) / 2) * tw, y = (rows > 1 ? 690 : 860) + row * 230 - (1 - k) * 600;
      const rad = Math.min(rows > 1 ? 70 : 84, tw * 0.36), spin = Math.cos((1 - k) * 9);
      g.save(); g.translate(x, y); g.scale(1, 0.55 + 0.45 * Math.abs(spin));
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(6, 12, rad, 0, TAU); g.fill();
      g.fillStyle = c.color || '#e8323c'; g.beginPath(); g.arc(0, 0, rad, 0, TAU); g.fill();
      g.fillStyle = '#fff'; for (let j = 0; j < 8; j++) { const a = j / 8 * TAU; g.save(); g.rotate(a); g.fillRect(-rad * 0.12, -rad, rad * 0.24, rad * 0.22); g.restore(); }
      g.fillStyle = '#fffdf5'; g.beginPath(); g.arc(0, 0, rad * 0.66, 0, TAU); g.fill();
      g.setLineDash([8, 6]); g.lineWidth = 4; g.strokeStyle = c.color || '#e8323c'; g.beginPath(); g.arc(0, 0, rad * 0.58, 0, TAU); g.stroke(); g.setLineDash([]);
      g.restore();
      if (k > 0.6) { s.face(c, x, y, rad * 0.8);
        rr(g, x - tw * 0.42, y + rad + 18, tw * 0.84, 48, 24); g.fillStyle = 'rgba(12,6,22,0.9)'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#ffd166'; g.stroke();
        text(g, c.name, x, y + rad + 43, 30, '#fdf6e3', { max: tw * 0.78, font: RIGHT }); }
    });
    if (o.more && u > n * per - 1400) neonText(g, '…and ' + o.more + ' more high rollers!', 960, 1010, 48, RIGHT, '#ffe7a8', '#ffb238', 1);
  }

  BOX.intros.blackjack = {
    title: 'Blackjack Night',
    // How to play (box/howto.js): one card per step, 6 steps (module howSteps).
    tutorial: [
      { icon: '🎰', title: 'Beat the dealer', text: 'Everyone plays at once against the dealer. Get closer to 21 than the dealer without going over. Most chips at the end wins!', say: 'Evening, high rollers! You all play against me at once. Beat my hand, and the most chips at the end wins.' },
      { icon: '🪙', title: 'Place your bet', text: 'Before every hand, bet some of your chips before the timer runs out.', phone: 'Tap chips to stack your bet, then tap Bet.' },
      { icon: '🃏', title: 'Card values', text: 'Face cards are 10, Aces are 1 or 11. Blackjack (an Ace and a 10-card) pays 3 to 2. The dealer draws to 17.' },
      { icon: '👆', title: 'Your move', text: 'Hit for another card, Stand to stop. Double doubles your bet for one last card. Split turns a pair into two hands.', phone: 'Tap Hit, Stand, Double or Split.' },
      { icon: '🎯', title: 'Bust Bets', text: 'Think a friend will go over 21? Bet 25 chips on it. If they bust, you get 75!', phone: 'Under Bust Bet, tap a friend’s name (or Nobody).' },
      { icon: '🍸', title: 'Twists & finale', text: 'Some hands get a twist: Happy Hour, Five-Card Charlie, Ties Win or Lucky 21. The last hand pays DOUBLE. Broke? Free comeback chips!' },
    ],
    theme: { accent: '#ffd166', accent2: '#ff2f7d', accent3: '#ffd166', ink: '#fdf6e3', fade: '#06030e', wall1: '#0d0820', wall2: '#2a1240', floor1: '#0b6440', floor2: '#042a1a', disc1: '#1db06f', disc2: '#063a25',
      pod1: '#2a1206', pod2: '#1a0b04', podTop: '#d4a73c', podPanel: '#0c0616', rim: '#ffb8e8', seat: '#3a1d0c', audWall1: '#120a24', audWall2: '#06030e',
      spots: ['255,236,190', '255,120,200', '120,230,255', '255,236,190'], confetti: ['#ffd166', '#e8323c', '#2f6bff', '#2fbf71', '#ffffff', '#ff2f7d'] },
    host: {
      name: 'Lucky Lou, your dealer',
      voice: { kokoro: 'am_michael', speed: 1.0, like: /guy|davis|christopher|eric|andrew|brian|male/i, accent: /en-US/i, pitch: 0.85, rate: 1.0 },
      draw: hostDraw,
    },
    lines: {
      welcome: 'Good evening, high rollers! Welcome to Blackjack Night. The table is open!',
      joke: 'The house always wins. Tonight, the house is just me and a very nervous goldfish.',
      meet: 'Let\'s see who\'s at my table!',
      banter: ['Players, tell the dealer something about yourselves!', 'Phones out! Chips up!'],
      first: 'First seat, {name}', intros: ['Pull up a chair, {name}', 'Deal in {name}', 'Lady Luck loves {name}', 'High roller {name}'],
      last: 'And our last seat, {name}', noFact: 'a mystery at the table!',
      roll: 'Here\'s who\'s at my table tonight!', more: '…and {n} more high rollers!', others: 'And everyone else at the table!',
      play: 'Place your bets!',
    },
    stage, logo, podium, roll,
    hostCam: { x: 960, y: 600, z: 1.75 },
    castOpening: [
      { ms: 2600, sfx: [[150, 'zap'], [650, 'zap'], [1250, 'swell']],
        draw(g, s) {
          const on = flick(s.T, 1200);
          s.cam(960, lerp(380, 440, ease(s.k)), lerp(1.55, 1.15, ease(s.k)));
          stage(g, s, { neon: Math.max(0.05, ss(1200, 2200, s.T)), T21: s.T - 200, lights: 0.3 + 0.7 * ss(1200, 2200, s.T), logo: Math.max(s.T < 600 ? flick(s.T, 150) * 0.45 : s.T < 1200 ? flick(s.T, 650) * 0.6 : 0, on), spots: ss(1600, 2400, s.T) * 0.5 });
        } },
      { ms: 1900, sfx: [[0, 'shuffle'], [250, 'deal'], [520, 'deal'], [850, 'flip'], [1120, 'flip'], [1400, 'chime']],
        draw(g, s) { s.cam(lerp(1000, 940, ease(s.k)), 880, 1.75); stage(g, s, { logo: 0, spots: 0.2, deal: dealShot }); } },
      { ms: 2600, sfx: [[0, 'whoosh'], [300, 'ballot']], pose: [[0, 'wave', 1500], [1600, 'point', 1000]], say: 'welcome', sayAt: 150, fit: 2600,
        draw(g, s) { const k = ease(s.T / 1800); s.cam(960, lerp(560, 600, k), lerp(1, 1.7, k)); stage(g, s, { logo: k < 0.4 ? 1 : 0 }); } },
    ],
  };
})();
