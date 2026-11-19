'use strict';
// President intro: the curtains part on a velvet throne room, a crown floats down onto the
// empty throne, and the royal herald, Lord Pemberton Trumpington, opens the court.
// Engine + API: public/box/show.js ('cast' mode: these shots, the roll call, then the game).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, OUT, TAU } = ST.util, { rr, text } = ST.draw;
  const SERIF = '"Abril Fatface", Georgia, serif';
  try { if (document.fonts) document.fonts.load('80px "Abril Fatface"'); } catch { /* fine */ }
  const r = rng(1789);
  const GLIT = Array.from({ length: 46 }, () => [r() * 1920, r() * 1080, 3 + r() * 5, r() * TAU, 0.4 + r()]);

  // The wall (velvet, damask, pillars) never changes: paint it once.
  let wall = null;
  function wallLayer() {
    if (wall) return wall;
    const c = document.createElement('canvas'); c.width = 1920; c.height = 800; const b = c.getContext('2d');
    const gr = b.createRadialGradient(960, 360, 0, 960, 360, 1150); gr.addColorStop(0, '#5f1a78'); gr.addColorStop(0.55, '#2c0a3a'); gr.addColorStop(1, '#12031a');
    b.fillStyle = gr; b.fillRect(0, 0, 1920, 800);
    b.fillStyle = 'rgba(255, 210, 90, 0.08)';
    for (let y = 60, k = 0; y < 780; y += 70, k++) for (let x = (k % 2) * 36; x < 1960; x += 72) {
      b.beginPath(); b.moveTo(x, y - 12); b.lineTo(x + 8, y); b.lineTo(x, y + 12); b.lineTo(x - 8, y); b.closePath(); b.fill();
      b.beginPath(); b.arc(x, y - 18, 3, 0, TAU); b.fill();
    }
    for (const px of [210, 600, 1320, 1710]) { // marble pillars with gold capitals
      const pg = b.createLinearGradient(px - 46, 0, px + 46, 0); pg.addColorStop(0, '#cbb9c9'); pg.addColorStop(0.45, '#f6eef4'); pg.addColorStop(1, '#a893a6');
      b.fillStyle = pg; b.fillRect(px - 46, 110, 92, 680);
      b.strokeStyle = 'rgba(120, 90, 120, 0.35)'; b.lineWidth = 3; for (let i = -2; i <= 2; i++) { b.beginPath(); b.moveTo(px + i * 16, 130); b.lineTo(px + i * 16, 770); b.stroke(); }
      b.fillStyle = '#e8b43a'; b.fillRect(px - 64, 92, 128, 30); b.fillRect(px - 58, 760, 116, 30);
      b.fillStyle = '#ffd86a'; b.fillRect(px - 64, 92, 128, 6);
    }
    wall = c; return c;
  }
  function crown(g, x, y, s) { // y = bottom of the band
    const gr = g.createLinearGradient(0, y - s * 1.2, 0, y); gr.addColorStop(0, '#fff2a8'); gr.addColorStop(0.5, '#ffc93a'); gr.addColorStop(1, '#c47f12');
    g.fillStyle = gr; g.strokeStyle = '#6b3a05'; g.lineWidth = Math.max(2, s * 0.07); g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s * 1.08, y - s * 0.95); g.lineTo(x - s * 0.5, y - s * 0.45); g.lineTo(x, y - s * 1.2);
    g.lineTo(x + s * 0.5, y - s * 0.45); g.lineTo(x + s * 1.08, y - s * 0.95); g.lineTo(x + s, y); g.closePath(); g.fill(); g.stroke();
    rr(g, x - s * 1.04, y - s * 0.12, s * 2.08, s * 0.34, s * 0.08); g.fill(); g.stroke();
    g.fillStyle = '#fff6c8'; for (const [bx, by] of [[-1.08, -0.95], [0, -1.2], [1.08, -0.95]]) { g.beginPath(); g.arc(x + bx * s, y + by * s, s * 0.13, 0, TAU); g.fill(); g.stroke(); }
    g.fillStyle = '#e0233f'; g.beginPath(); g.arc(x, y + s * 0.05, s * 0.11, 0, TAU); g.fill();
    g.fillStyle = '#2f6bff'; g.beginPath(); g.arc(x - s * 0.55, y + s * 0.05, s * 0.08, 0, TAU); g.arc(x + s * 0.55, y + s * 0.05, s * 0.08, 0, TAU); g.fill();
  }
  const sparkle = (g, x, y, rad) => { g.beginPath(); g.moveTo(x, y - rad); g.quadraticCurveTo(x, y, x + rad, y); g.quadraticCurveTo(x, y, x, y + rad); g.quadraticCurveTo(x, y, x - rad, y); g.quadraticCurveTo(x, y, x, y - rad); g.fill(); };
  function throne(g, x, y) { // y = top of the dais
    g.save(); g.translate(x, y); g.lineJoin = 'round';
    g.fillStyle = '#e8b43a'; g.strokeStyle = OUT; g.lineWidth = 7;
    g.beginPath(); g.moveTo(-120, 0); g.lineTo(-120, -300); g.quadraticCurveTo(-120, -430, 0, -462); g.quadraticCurveTo(120, -430, 120, -300); g.lineTo(120, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#a3132f'; g.beginPath(); g.moveTo(-88, -110); g.lineTo(-88, -296); g.quadraticCurveTo(-88, -396, 0, -420); g.quadraticCurveTo(88, -396, 88, -296); g.lineTo(88, -110); g.closePath(); g.fill(); g.lineWidth = 5; g.stroke();
    g.fillStyle = 'rgba(255, 216, 106, 0.32)';
    for (let k = 0; k < 6; k++) for (let c = -2; c <= 2; c++) { const dx = c * 30 + (k % 2) * 15, dy = -150 - k * 40; if (Math.abs(dx) < 70) { g.beginPath(); g.moveTo(dx, dy - 10); g.lineTo(dx + 7, dy); g.lineTo(dx, dy + 10); g.lineTo(dx - 7, dy); g.fill(); } }
    crown(g, 0, -448, 44);
    g.fillStyle = '#e8b43a'; g.lineWidth = 6; rr(g, -172, -160, 84, 40, 18); g.fill(); g.stroke(); rr(g, 88, -160, 84, 40, 18); g.fill(); g.stroke();
    g.fillStyle = '#c11a3a'; rr(g, -128, -128, 256, 62, 22); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255, 140, 160, 0.6)'; g.lineWidth = 6; g.beginPath(); g.moveTo(-100, -116); g.lineTo(100, -116); g.stroke();
    g.fillStyle = '#e8b43a'; g.strokeStyle = OUT; g.lineWidth = 6; rr(g, -140, -72, 280, 72, 12); g.fill(); g.stroke();
    g.fillStyle = '#2f6bff'; g.beginPath(); g.arc(0, -36, 13, 0, TAU); g.fill(); g.fillStyle = '#e0233f'; g.beginPath(); g.arc(-80, -36, 9, 0, TAU); g.arc(80, -36, 9, 0, TAU); g.fill();
    g.restore();
  }
  function banner(g, x, len, col, suit, t) {
    g.save(); g.translate(x, 70); g.rotate(Math.sin(t * 0.9 + x) * 0.025);
    const bw = 120;
    g.fillStyle = '#e8b43a'; rr(g, -bw * 0.62, -8, bw * 1.24, 14, 6); g.fill();
    g.fillStyle = col; g.beginPath(); g.moveTo(-bw / 2, 0); g.lineTo(bw / 2, 0); g.lineTo(bw / 2, len); g.lineTo(0, len - 50); g.lineTo(-bw / 2, len); g.closePath(); g.fill();
    g.strokeStyle = '#e8b43a'; g.lineWidth = 5; g.stroke();
    crown(g, 0, len * 0.3, 26);
    text(g, suit, 0, len * 0.56, 70, suit === '♥' || suit === '♦' ? '#ff5a74' : '#f3e6ff', { font: 'Georgia, serif' });
    g.restore();
  }
  // Curtains: k = 0 open (tied back at the sides), 1 closed across the stage.
  function curtains(g, k) {
    for (const side of [0, 1]) {
      g.save(); if (side) { g.translate(1920, 0); g.scale(-1, 1); }
      const w = lerp(230, 1010, k), cg = g.createLinearGradient(0, 0, w, 0);
      const folds = 9; for (let i = 0; i <= folds; i++) cg.addColorStop(i / folds, i % 2 ? '#c11a3a' : '#5c0619');
      g.fillStyle = cg; g.beginPath(); g.moveTo(-40, -40); g.lineTo(w, -40);
      if (k > 0.98) g.lineTo(w, 1120);
      else { g.bezierCurveTo(w * 0.92, 320, w * 0.5, 520, w * 0.56, 640); g.bezierCurveTo(w * 0.62, 760, w * 0.95, 980, w * 1.02, 1120); }
      g.lineTo(-40, 1120); g.closePath(); g.fill();
      if (k < 0.98) { g.fillStyle = '#e8b43a'; g.beginPath(); g.ellipse(w * 0.3, 640, w * 0.34 + 10, 12, -0.1, 0, TAU); g.fill(); g.fillStyle = '#ffd86a'; g.beginPath(); g.arc(w * 0.62, 650, 12, 0, TAU); g.fill(); }
      g.restore();
    }
    // the valance with its gold fringe
    g.fillStyle = '#7c0d25'; g.fillRect(-40, -40, 2000, 86);
    g.strokeStyle = '#e8b43a'; g.lineWidth = 5;
    for (let x = -40; x < 1960; x += 150) { g.beginPath(); g.moveTo(x, 40); g.quadraticCurveTo(x + 75, 130, x + 150, 40); g.closePath(); g.fillStyle = '#7c0d25'; g.fill(); g.stroke(); }
    g.fillStyle = '#ffcf4a'; for (let x = -40; x < 1960; x += 150) g.fillRect(x - 3, 34, 6, 46);
  }
  function stage(g, s, o = {}) {
    const t = s.t;
    g.drawImage(wallLayer(), 0, 0, 1920, 800);
    g.save(); g.translate(960, 380); g.rotate(t * 0.06); g.fillStyle = 'rgba(255, 214, 90, 0.06)';
    for (let i = 0; i < 16; i++) { g.rotate(TAU / 16); g.beginPath(); g.moveTo(0, 0); g.lineTo(1300, -100); g.lineTo(1300, 100); g.closePath(); g.fill(); }
    g.restore();
    banner(g, 405, 330, '#3b1a6e', '♠', t); banner(g, 1515, 330, '#7a0f2e', '♥', t);
    if (!o.bare) { banner(g, 120, 260, '#7a0f2e', '♦', t); banner(g, 1800, 260, '#3b1a6e', '♣', t); }
    // the floor: polished marble and the red carpet up to the dais
    let gr = g.createLinearGradient(0, 780, 0, 1080); gr.addColorStop(0, '#4a1430'); gr.addColorStop(1, '#14040d'); g.fillStyle = gr; g.fillRect(-600, 780, 3120, 700);
    g.strokeStyle = 'rgba(255, 210, 120, 0.14)'; g.lineWidth = 2;
    g.beginPath(); for (let i = -14; i <= 14; i++) { g.moveTo(960 + i * 70, 780); g.lineTo(960 + i * 190, 1100); } g.stroke();
    g.beginPath(); for (const y of [810, 860, 930, 1020]) { g.moveTo(-600, y); g.lineTo(2520, y); } g.stroke();
    g.fillStyle = '#a3132f'; g.beginPath(); g.moveTo(860, 760); g.lineTo(1060, 760); g.lineTo(1260, 1100); g.lineTo(660, 1100); g.closePath(); g.fill();
    g.strokeStyle = '#e8b43a'; g.lineWidth = 6; g.beginPath(); g.moveTo(870, 760); g.lineTo(680, 1100); g.moveTo(1050, 760); g.lineTo(1240, 1100); g.stroke();
    // the dais and the throne
    for (let k = 0; k < 3; k++) { const w = 560 - k * 110, y = 760 - k * 40; g.fillStyle = k % 2 ? '#8c0f29' : '#6e0a22'; rr(g, 960 - w / 2, y - 40, w, 44, 6); g.fill(); g.fillStyle = '#e8b43a'; g.fillRect(960 - w / 2, y - 40, w, 7); }
    if (!o.noThrone) throne(g, 960, 640);
    if (o.crown != null) crown(g, 960, o.crown, 52);
    // gold glitter in the air
    g.fillStyle = '#ffd96a';
    for (const [x, y0, rad, ph, sp] of GLIT) { const y = ((y0 - t * 30 * sp) % 1080 + 1080) % 1080; g.globalAlpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 2 * sp + ph)); sparkle(g, x, y, rad); }
    g.globalAlpha = 1;
    if (o.host !== false) s.hostAt(1420, 800, 0.85);
    curtains(g, o.curtain || 0);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(8,0,12,${(1 - o.lights) * 0.86})`; g.fillRect(-600, -300, 3120, 1700); }
    if (o.logo !== 0) { g.save(); g.translate(960, 250); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
    s.spots(o.spots == null ? 0.45 : o.spots);
  }
  function logo(g, s, lit) {
    if (lit <= 0) return;
    g.save(); g.globalAlpha = Math.min(1, lit * 1.4);
    if (lit > 0.5) { g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(0, 0, 40, 0, 0, 520); rg.addColorStop(0, `rgba(255,200,80,${0.3 * lit})`); rg.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = rg; g.fillRect(-560, -560, 1120, 1120); g.restore(); }
    // ribbon tails, then the plaque
    g.fillStyle = '#5c0619'; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 330, -40); g.lineTo(sd * 440, -40); g.lineTo(sd * 405, 10); g.lineTo(sd * 440, 60); g.lineTo(sd * 330, 60); g.closePath(); g.fill(); }
    const pg = g.createLinearGradient(0, -90, 0, 90); pg.addColorStop(0, '#b9183f'); pg.addColorStop(1, '#6e0a22');
    rr(g, -360, -86, 720, 172, 26); g.fillStyle = pg; g.fill(); g.lineWidth = 12; g.strokeStyle = '#e8b43a'; g.stroke();
    rr(g, -340, -68, 680, 136, 18); g.lineWidth = 3; g.strokeStyle = 'rgba(255, 230, 150, 0.6)'; g.stroke();
    crown(g, 0, -86, 62);
    const tg = g.createLinearGradient(0, -60, 0, 60); tg.addColorStop(0, '#fff6c4'); tg.addColorStop(0.45, '#ffd34d'); tg.addColorStop(0.75, '#d18a12'); tg.addColorStop(1, '#ffe58a');
    text(g, 'President', 0, 12, 128, tg, { font: SERIF, stroke: '#3a0a1e', lw: 14, max: 640 });
    text(g, '♠ ♥  THE ROYAL CARD GAME  ♣ ♦', 0, 120, 30, '#f3d29e', { font: '"Fredoka", sans-serif', stroke: '#2a0618', lw: 6 });
    g.restore();
  }
  // The herald's lectern: gold, with the royal banner hanging in front and the decree on top.
  function podium(g, s, x, y, sc) {
    g.save(); g.translate(x, y); g.scale(sc, sc); g.lineJoin = 'round';
    g.fillStyle = '#e8b43a'; g.beginPath(); g.moveTo(-130, 4); g.lineTo(130, 4); g.lineTo(100, 220); g.lineTo(-100, 220); g.closePath(); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#a3132f'; g.beginPath(); g.moveTo(-82, 10); g.lineTo(82, 10); g.lineTo(82, 170); g.lineTo(0, 140); g.lineTo(-82, 170); g.closePath(); g.fill(); g.lineWidth = 4; g.strokeStyle = '#ffd86a'; g.stroke();
    crown(g, 0, 92, 30);
    g.fillStyle = '#f8ecc8'; g.save(); g.rotate(-0.06); rr(g, -112, -22, 224, 30, 10); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#c8a46a'; for (const sd of [-1, 1]) { g.beginPath(); g.arc(sd * 112, -7, 15, 0, TAU); g.fill(); g.stroke(); } g.restore();
    g.restore();
  }
  // Lord Pemberton: a cartoon herald in a crimson tunic with a powdered wig and a plumed cap.
  const herald = ST.makeHost({ skin: '#f3c9a6', skinShade: '#dba584', suit: '#a3132f', suit2: '#5c0619', sleeve: '#a3132f', cuff: '#fff6dc', lapel: '#e8b43a', shirt: '#fffdf5', tie: 'bow', tieColor: '#ffd34d', hair: 'curly', hairColor: '#f2eee6', brow: '#a89c90', mustache: '#ece6da', grin: true, sparkle: '#ffe58a' });
  function hostDraw(g, a) {
    herald(g, a);
    // the cap follows the head exactly (same sway, bounce and tilt as the engine's host)
    const sway = Math.sin(a.t * 0.9 + a.seed) * 4, bounce = a.talk ? -Math.abs(Math.sin(a.t * 6.2)) * 4 : Math.sin(a.t * 1.6) * 1.5;
    const tilt = Math.sin(a.t * 1.7 + a.seed) * 0.035 + (a.talk ? Math.sin(a.t * 5.1) * 0.045 : 0);
    g.save(); g.translate(sway, bounce - 215); g.rotate(tilt); g.translate(0, 215);
    g.lineJoin = 'round'; g.lineWidth = 5; g.strokeStyle = OUT;
    g.fillStyle = '#fff6ea'; g.beginPath(); g.moveTo(10, -372); g.bezierCurveTo(60, -470, 130, -450, 120, -400); g.bezierCurveTo(100, -420, 60, -420, 22, -366); g.fill(); g.stroke();
    g.fillStyle = '#7c0d25'; g.beginPath(); g.ellipse(0, -356, 74, 30, -0.08, Math.PI, TAU); g.lineTo(74, -352); g.quadraticCurveTo(0, -336, -74, -350); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e8b43a'; rr(g, -74, -362, 148, 14, 6); g.fill(); g.lineWidth = 3; g.stroke();
    g.fillStyle = '#e0233f'; g.beginPath(); g.arc(24, -356, 8, 0, TAU); g.fill(); g.stroke();
    g.restore();
  }

  // The roll call: each courtier, a playing card with their face, hops onto the carpet and bows.
  function roll(g, s, F, u, per, o) {
    const n = F.length;
    s.cam(960, 560, 1); stage(g, s, { host: false, bare: true, logo: 0, spots: 0.5 });
    g.fillStyle = 'rgba(10,0,16,0.35)'; g.fillRect(-600, -300, 3120, 1700);
    text(g, 'PRESENTING THE ROYAL COURT', 960, 120, 64, '#ffd34d', { font: SERIF, stroke: '#3a0a1e', lw: 12, max: 1500 });
    const cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), tw = Math.min(250, 1600 / Math.max(1, cols));
    F.forEach((c, i) => {
      const k = back((u - i * per) / 420); if (k <= 0) return;
      const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
      const x = 960 + (col - (rowN - 1) / 2) * tw, y = (rows > 1 ? 400 : 560) + row * 330;
      const bow = Math.max(0, Math.sin(((u - i * per - 500) / 700) * Math.PI)) * (u - i * per > 500 && u - i * per < 1200 ? 1 : 0);
      g.save(); g.translate(x, y + (1 - k) * -300); g.rotate((1 - Math.min(1, k)) * -0.6);
      g.save(); g.translate(0, 120); g.rotate(bow * 0.35); g.translate(0, -120);
      const w = Math.min(170, tw * 0.72), h = w * 1.4;
      g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, -w / 2 + 8, -h / 2 + 10, w, h, 14); g.fill();
      g.fillStyle = '#fffaf0'; rr(g, -w / 2, -h / 2, w, h, 14); g.fill(); g.lineWidth = 6; g.strokeStyle = '#d9a32b'; g.stroke();
      g.lineWidth = 5; g.strokeStyle = c.color || '#c11a3a'; rr(g, -w / 2 + 9, -h / 2 + 9, w - 18, h - 18, 9); g.stroke();
      const suit = ['♠', '♥', '♦', '♣'][i % 4]; text(g, suit, -w / 2 + 22, -h / 2 + 26, 26, i % 4 === 1 || i % 4 === 2 ? '#c8102e' : '#1d1230', { font: 'Georgia, serif' });
      s.face(c, 0, -6, w * 0.55);
      if (i === 0) crown(g, 0, -h / 2 - 2, 26);
      g.restore();
      rr(g, -tw * 0.42, h / 2 + 16, tw * 0.84, 48, 10); g.fillStyle = '#8c0f29'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#d9a32b'; g.stroke();
      text(g, c.name, 0, h / 2 + 41, 30, '#ffe9b0', { max: tw * 0.78 });
      g.restore();
    });
    if (o.more && u > n * per - 1400) text(g, '…and ' + o.more + ' more nobles!', 960, 1010, 50, '#ffd34d', { font: SERIF, stroke: '#3a0a1e', lw: 10 });
  }

  BOX.intros.president = {
    title: 'President',
    // How to play (box/howto.js): one card per step, 6 steps (module howSteps).
    tutorial: [
      { icon: '👑', title: 'Empty your hand', text: 'Be the first to get rid of every card in your hand. Finish first and you’re crowned President!', say: 'Hear ye! Be the first to empty thy hand, and the crown is thine!' },
      { icon: '🃏', title: 'Beat the pile', text: 'Play a single, pair, triple or four of a kind. The next player must beat it with the same number of cards.', phone: 'Tap a set to play it, or tap your cards, then tap Play.' },
      { icon: '📈', title: 'Card order', text: '3 is the lowest card, then up through King and Ace. 2 is the highest, and a 2 clears the pile so you lead again.' },
      { icon: '⚡', title: 'Pass or rebel', text: 'Can’t beat it? You pass automatically. Four of a kind starts a REVOLUTION: low cards beat high ones until the next deal.', phone: 'Nothing beats the pile? Your phone passes for you.' },
      { icon: '🤝', title: 'The royal trade', text: 'Finishing order gives titles, President down to Scum. Next deal the Scum must hand the President their best cards!', phone: 'President? Tap the cards to give back, then tap Give.' },
      { icon: '🏆', title: 'Points', text: 'President 4, Vice President 3, Citizen 2, Vice Scum 1, Scum 0. The last round counts double. Most points wins!', say: 'The President scores four, the Scum scores nothing. The last round counts double, and the most points wins the realm!' },
    ],
    theme: { accent: '#ffd34d', accent2: '#c11a3a', accent3: '#ffd34d', ink: '#fff4dc', fade: '#120318', wall1: '#4a1260', wall2: '#16041e', floor1: '#3a1028', floor2: '#12030b', disc1: '#8f1029', disc2: '#4d0717',
      pod1: '#8c0f29', pod2: '#3a0616', podTop: '#e8b43a', podPanel: '#2a0618', rim: '#ffd86a', seat: '#5c0619', audWall1: '#2a0838', audWall2: '#0c0210',
      spots: ['255,226,160', '255,200,120', '255,226,160', '255,170,190'], confetti: ['#ffd34d', '#fff2a8', '#c11a3a', '#ffffff', '#b06cff', '#e8b43a'] },
    host: {
      name: 'Lord Pemberton, Royal Herald',
      voice: { kokoro: 'bm_george', speed: 1.1, like: /george|ryan|thomas|daniel|uk english male|british|male/i, accent: /en-GB/i, pitch: 0.95, rate: 1.05 },
      draw: hostDraw,
    },
    lines: {
      welcome: 'Hear ye, hear ye! The royal court of President is now in session!',
      joke: 'The last Scum had to polish the throne with a toothbrush. Do try harder.',
      meet: 'Now, presenting the royal court!',
      banter: ['Courtiers, tell the herald something about yourselves!', 'Phones out, nobles! The crown is listening.'],
      first: 'Presenting first, {name}', intros: ['The noble {name}', 'Make way for {name}', 'Bow before {name}', 'Enter {name}'],
      last: 'And at last, {name}', noFact: 'a noble of great mystery!',
      roll: 'Presenting the royal court!', more: '…and {n} more nobles!', others: 'And all the lords and ladies of the court!',
      play: 'Let the royal game begin!',
    },
    stage, logo, podium, roll,
    hostCam: { x: 1210, y: 610, z: 1.75 },
    castOpening: [
      { ms: 2700, sfx: [[0, 'drum'], [900, 'swell'], [1500, 'chime']],
        draw(g, s) {
          s.cam(960, lerp(560, 520, ease(s.k)), 1 + 0.05 * ease(s.k));
          const open = ease(ss(250, 2000, s.T));
          stage(g, s, { curtain: 1 - open, lights: 0.25 + 0.75 * ss(200, 1700, s.T), logo: ss(1300, 2100, s.T), spots: ss(900, 1800, s.T) * 0.6 });
        } },
      { ms: 1900, sfx: [[0, 'whoosh'], [1100, 'chime']],
        draw(g, s) {
          const k = ease(s.T / 1900), land = easeOut(ss(0, 1100, s.T));
          s.cam(960, lerp(470, 440, k), lerp(1.75, 2.0, k));
          stage(g, s, { host: false, logo: 0, spots: 0.3, crown: lerp(-60, 528, land) });
          if (s.T > 1100) { // the coronation sparkle
            const u = ss(1100, 1900, s.T); g.fillStyle = '#ffe27a'; g.globalAlpha = 1 - u;
            for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; sparkle(g, 960 + Math.cos(a) * u * 190, 470 + Math.sin(a) * u * 150, 14 * (1 - u * 0.5)); }
            g.globalAlpha = 1;
          }
        } },
      { ms: 2700, sfx: [[0, 'whoosh'], [400, 'reveal']], pose: [[0, 'cheer', 1300], [1400, 'wave', 1300]], say: 'welcome', sayAt: 200, fit: 2600,
        draw(g, s) { const k = ease(s.T / 1900); s.cam(lerp(960, 1300, k), lerp(540, 575, k), lerp(1, 1.7, k)); stage(g, s, { logo: k < 0.35 ? 1 : 0 }); } },
    ],
  };
})();
