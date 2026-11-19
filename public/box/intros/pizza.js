'use strict';
// JustPizza intro: not a studio but Nonna Pina's pizzeria, just before opening time. The wood
// oven roars and a pizza slides in on the peel; the neon sign in the window buzzes on and the
// lamps warm up the room; then Nonna Pina, fifty years behind this counter, waves her new cooks
// in. In the roll call every cook's order ticket is clipped to the ticket rail over the counter.
// Nonna is the in-game character too (public/box/games/pizza.js draws her with host.draw and
// speaks her lines). Her in-game lines are listed in `story` (copied from box/games/pizza.js,
// NONNA) so tools/voice-gen.js pre-voices them.
// Engine + API: public/box/show.js ('cast' mode).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, rng, OUT, TAU } = ST.util, { rr, text } = ST.draw;
  const SIGN = '"Pacifico", cursive', CHALK = '"Caveat Brush", "Permanent Marker", cursive', BOLD = '"Lilita One", sans-serif';
  try { if (document.fonts) for (const f of ['40px "Pacifico"', '40px "Caveat Brush"', '40px "Lilita One"']) document.fonts.load(f); } catch { /* fine */ }
  const R = rng(1962);
  const RED = '#c8321f', GREEN = '#2f8a3e', CREAM = '#fff4dc', GOLD = '#ffb43a', WOOD = '#7a4320', WOOD2 = '#4e2a12';
  const COUNTER_Y = 800, NONNA = [960, 812, 1.0];

  // ---- fixed decoration ----
  const bricks = (() => { const a = []; for (let row = 0; row < 42; row++) for (let i = -1; i < 22; i++) a.push([i * 100 + (row % 2 ? 50 : 0), row * 34, 0.75 + R() * 0.35]); return a; })();
  const jars = [[300, '#e9a23b'], [360, '#c8321f'], [420, '#6aa84f'], [480, '#f4e3b5'], [1440, '#c8321f'], [1500, '#e9a23b']];
  const flour = Array.from({ length: 50 }, () => [R() * 1920, R() * 1080, 1 + R() * 3, 10 + R() * 30, R() * TAU]);

  // ---- the room ----
  function wall(g, lit, band = true) {
    let gr = g.createLinearGradient(0, -300, 0, 1000); gr.addColorStop(0, '#5a2414'); gr.addColorStop(1, '#3a160b'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    for (const [x, y, k] of bricks) { g.fillStyle = `rgba(${Math.round(176 * k)},${Math.round(78 * k)},${Math.round(48 * k)},1)`; rr(g, x + 3, y - 300 + 3, 94, 28, 4); g.fill(); }
    // plaster band and a tiled skirting behind the counter
    if (band) { g.fillStyle = '#f1dcb5'; g.fillRect(-600, 560, 3120, 60); g.fillStyle = 'rgba(120,60,20,0.25)'; g.fillRect(-600, 612, 3120, 8);
    for (let x = -600; x < 2520; x += 60) { g.fillStyle = (x / 60) % 2 ? '#2f6d4a' : '#f6efe0'; g.fillRect(x, 620, 60, 60); } }
    // warm light falling on the wall
    gr = g.createRadialGradient(960, 300, 50, 960, 300, 1100); gr.addColorStop(0, `rgba(255,190,110,${0.28 * lit})`); gr.addColorStop(1, 'rgba(255,190,110,0)'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
  }
  function menuBoard(g) {
    g.fillStyle = WOOD2; rr(g, 150, 90, 420, 400, 12); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#26302a'; g.fillRect(172, 112, 376, 356);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 10; i++) g.fillRect(180 + i * 37, 120, 18, 340);
    text(g, 'Menu', 360, 160, 62, CREAM, { font: CHALK });
    const items = [['Margherita', '9'], ['Pepperoni', '11'], ['Funghi', '10'], ['Hawaiian', '11'], ['Nonna’s Special', '14']];
    items.forEach(([n, p], i) => { text(g, n, 196, 230 + i * 48, 34, '#f4f1e6', { font: CHALK, align: 'left', max: 280 }); text(g, p, 528, 230 + i * 48, 34, '#ffd27a', { font: CHALK, align: 'right' }); });
    g.strokeStyle = 'rgba(244,241,230,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(210, 196); g.lineTo(510, 196); g.stroke();
  }
  function shelf(g) {
    g.fillStyle = WOOD; g.fillRect(250, 520, 300, 18); g.fillRect(1380, 520, 200, 18); g.lineWidth = 4; g.strokeStyle = OUT; g.strokeRect(250, 520, 300, 18); g.strokeRect(1380, 520, 200, 18);
    for (const [x, c] of jars) {
      g.fillStyle = 'rgba(230,240,245,0.55)'; rr(g, x - 22, 450, 44, 70, 8); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = c; rr(g, x - 18, 476, 36, 40, 5); g.fill();
      g.fillStyle = '#c9a06a'; g.fillRect(x - 20, 444, 40, 10); g.strokeRect(x - 20, 444, 40, 10);
    }
    // a pot of basil
    g.fillStyle = '#b5552c'; g.beginPath(); g.moveTo(1508, 520); g.lineTo(1572, 520); g.lineTo(1562, 470); g.lineTo(1518, 470); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.32; g.fillStyle = i % 2 ? GREEN : '#3fa34d'; g.beginPath(); g.ellipse(1540 + Math.cos(a) * 30, 450 + Math.sin(a) * 34, 16, 9, a, 0, TAU); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(); }
  }
  function flames(g, x, y, w, h, t, k = 1) {
    for (let i = 0; i < 9; i++) {
      const u = i / 8, fx = x - w / 2 + u * w, fh = h * (0.55 + 0.45 * Math.abs(Math.sin(t * 6 + i * 1.7))) * (1 - Math.abs(u - 0.5) * 0.9) * k;
      const gr = g.createLinearGradient(0, y, 0, y - fh); gr.addColorStop(0, '#ff5a1a'); gr.addColorStop(0.5, '#ffb22e'); gr.addColorStop(1, 'rgba(255,240,170,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(fx - w / 12, y); g.quadraticCurveTo(fx - w / 18, y - fh * 0.6, fx + Math.sin(t * 5 + i) * 8, y - fh); g.quadraticCurveTo(fx + w / 18, y - fh * 0.6, fx + w / 12, y); g.fill();
    }
  }
  function oven(g, s, o) {
    const x = 1660, y = 560, t = s.t, fire = o.fire == null ? 1 : o.fire;
    // the dome, tiled in copper and cream
    g.fillStyle = '#8c3b1d'; g.beginPath(); g.ellipse(x, y, 300, 300, 0, Math.PI, TAU); g.fill(); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
    for (let r = 0; r < 6; r++) for (let i = 0; i < 12; i++) { const a = Math.PI + (i + (r % 2) * 0.5) / 12 * Math.PI, rad = 70 + r * 40; if (a > TAU) continue; g.fillStyle = (i + r) % 3 ? '#b4552a' : '#d9773a'; g.beginPath(); g.arc(x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.98, 15, 0, TAU); g.fill(); }
    g.fillStyle = '#e8d3a8'; g.fillRect(x - 330, y - 10, 660, 40); g.strokeRect(x - 330, y - 10, 660, 40);
    // the mouth with the fire inside
    g.fillStyle = '#1a0a05'; g.beginPath(); g.moveTo(x - 140, y + 30); g.lineTo(x - 140, y - 60); g.arc(x, y - 60, 140, Math.PI, TAU); g.lineTo(x + 140, y + 30); g.closePath(); g.fill(); g.lineWidth = 6; g.stroke();
    g.save(); g.clip(); flames(g, x + 40, y + 30, 220, 170, t, fire);
    const gr = g.createRadialGradient(x + 40, y, 10, x + 40, y, 220); gr.addColorStop(0, `rgba(255,170,60,${0.6 * fire})`); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(x - 160, y - 220, 320, 260); g.restore();
    g.strokeStyle = '#e8d3a8'; g.lineWidth = 14; g.beginPath(); g.arc(x, y - 60, 150, Math.PI, TAU); g.stroke();
    // its glow on the room
    g.save(); g.globalCompositeOperation = 'lighter';
    const gw = g.createRadialGradient(x, y, 60, x, y, 520); gw.addColorStop(0, `rgba(255,120,40,${(0.22 + 0.05 * Math.sin(t * 7)) * fire})`); gw.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gw; g.fillRect(x - 600, y - 600, 1200, 1100);
    g.restore();
  }
  function lamps(g, s, lit) {
    for (const x of [560, 960, 1360]) {
      g.strokeStyle = '#2a1a10'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, -300); g.lineTo(x, 40); g.stroke();
      g.fillStyle = '#2e5e3f'; g.beginPath(); g.moveTo(x - 70, 110); g.quadraticCurveTo(x, -10, x + 70, 110); g.closePath(); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = lit > 0.1 ? `rgba(255,236,170,${0.5 + 0.5 * lit})` : '#5b5b4a'; g.beginPath(); g.ellipse(x, 110, 30, 12, 0, 0, TAU); g.fill();
      if (lit > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, 110, 0, 820); gr.addColorStop(0, `rgba(255,214,140,${0.22 * lit})`); gr.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 50, 110); g.lineTo(x + 50, 110); g.lineTo(x + 230, 820); g.lineTo(x - 230, 820); g.closePath(); g.fill(); g.restore(); }
    }
  }
  // A whole pizza on the counter: crust, tomato, cheese and pepperoni.
  function pie(g, x, y, r, tilt = 0.45, spin = 0) {
    g.save(); g.translate(x, y); g.scale(1, tilt);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(6, 16, r, 0, TAU); g.fill();
    g.fillStyle = '#d9963f'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#c8321f'; g.beginPath(); g.arc(0, 0, r * 0.86, 0, TAU); g.fill();
    g.fillStyle = '#ffd466'; g.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, rad = r * (0.76 + 0.05 * Math.sin(i * 2.7)); g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } g.fill();
    g.rotate(spin);
    for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3, rad = r * (i % 2 ? 0.5 : 0.25); g.fillStyle = '#a5221a'; g.beginPath(); g.arc(Math.cos(a) * rad, Math.sin(a) * rad, r * 0.11, 0, TAU); g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(60,10,5,0.6)'; g.stroke(); }
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + 1, rad = r * 0.55; g.fillStyle = GREEN; g.beginPath(); g.ellipse(Math.cos(a) * rad, Math.sin(a) * rad, r * 0.09, r * 0.05, a, 0, TAU); g.fill(); }
    g.restore();
  }
  function counter(g, s) {
    // the marble top
    let gr = g.createLinearGradient(0, COUNTER_Y, 0, COUNTER_Y + 50); gr.addColorStop(0, '#f6f1ea'); gr.addColorStop(1, '#d9d1c4'); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y, 3120, 50);
    g.lineWidth = 5; g.strokeStyle = OUT; g.strokeRect(-600, COUNTER_Y, 3120, 50);
    g.strokeStyle = 'rgba(140,130,120,0.35)'; g.lineWidth = 2; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(i * 280 - 100, COUNTER_Y + 8); g.quadraticCurveTo(i * 280 + 40, COUNTER_Y + 40, i * 280 + 180, COUNTER_Y + 20); g.stroke(); }
    // the wooden front with a red-and-white checked band
    gr = g.createLinearGradient(0, COUNTER_Y + 50, 0, 1200); gr.addColorStop(0, WOOD); gr.addColorStop(1, WOOD2); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y + 50, 3120, 500);
    for (let x = -600; x < 2520; x += 40) for (let r = 0; r < 2; r++) { g.fillStyle = ((x / 40) + r) % 2 ? RED : CREAM; g.fillRect(x, COUNTER_Y + 62 + r * 20, 40, 20); }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; for (let x = -560; x < 2520; x += 220) { g.beginPath(); g.moveTo(x, COUNTER_Y + 110); g.lineTo(x, 1200); g.stroke(); }
    // props: a pizza on its board, tomatoes, a flour sack, the order bell
    g.fillStyle = '#b5773e'; g.beginPath(); g.ellipse(560, COUNTER_Y + 6, 150, 40, 0, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    pie(g, 560, COUNTER_Y - 2, 120, 0.3);
    for (const [x, y] of [[1260, -8], [1296, -14], [1280, -30]]) { g.fillStyle = '#e03a24'; g.beginPath(); g.arc(x, COUNTER_Y + y, 22, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); g.fillStyle = GREEN; g.beginPath(); g.ellipse(x, COUNTER_Y + y - 20, 9, 4, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#efe3c6'; g.beginPath(); g.moveTo(1390, COUNTER_Y + 4); g.quadraticCurveTo(1380, COUNTER_Y - 90, 1420, COUNTER_Y - 110); g.lineTo(1480, COUNTER_Y - 110); g.quadraticCurveTo(1520, COUNTER_Y - 90, 1510, COUNTER_Y + 4); g.closePath(); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    text(g, 'FARINA', 1450, COUNTER_Y - 50, 22, RED, { font: BOLD });
    g.fillStyle = '#d8b24a'; g.beginPath(); g.arc(1150, COUNTER_Y - 4, 26, Math.PI, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(); g.fillStyle = '#333'; g.fillRect(1120, COUNTER_Y - 4, 60, 8); g.beginPath(); g.arc(1150, COUNTER_Y - 32, 6, 0, TAU); g.fill();
  }
  // The neon sign: "Just" in green script, "Pizza" in red, on a dark plate.
  function logo(g, s, lit) {
    lit = Math.max(0, Math.min(1, lit));
    rr(g, -330, -110, 660, 220, 28); g.fillStyle = 'rgba(20,10,8,0.92)'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#5a3a2a'; g.stroke();
    const tube = (str, x, y, px, col) => {
      g.font = `${px}px ${SIGN}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = 6; g.strokeStyle = 'rgba(90,80,70,0.7)'; g.strokeText(str, x, y);
      if (lit > 0) { g.save(); g.globalAlpha = lit; g.shadowColor = col; g.shadowBlur = 34; g.strokeStyle = col; g.lineWidth = 7; g.strokeText(str, x, y); g.shadowBlur = 12; g.fillStyle = '#fff6e6'; g.fillText(str, x, y); g.restore(); }
    };
    tube('Just', -150, -10, 84, '#3fd06a');
    tube('Pizza', 100, 6, 104, '#ff3b2a');
  }
  function dust(g, s, k = 1) { g.fillStyle = 'rgba(255,245,225,0.35)'; for (const [x, y, r, v, p] of flour) { const yy = (y + s.t * v) % 1080, xx = x + Math.sin(s.t + p) * 20; g.globalAlpha = 0.5 * k; g.beginPath(); g.arc(xx, yy, r, 0, TAU); g.fill(); } g.globalAlpha = 1; }
  function stage(g, s, o = {}) {
    const lit = o.lights == null ? 1 : o.lights;
    wall(g, lit);
    menuBoard(g);
    shelf(g);
    g.save(); g.translate(960, 240); g.scale(0.7, 0.7); logo(g, s, o.logo == null ? 1 : o.logo); g.restore();
    oven(g, s, o);
    lamps(g, s, lit);
    if (o.host !== false) s.host(NONNA[0], NONNA[1], NONNA[2]);
    counter(g, s);
    if (o.extra) o.extra(g, s);
    dust(g, s, lit);
    if (lit < 1) { g.fillStyle = `rgba(10,4,2,${(1 - lit) * 0.7})`; g.fillRect(-600, -300, 3120, 1700); }
    const v = g.createRadialGradient(960, 540, 520, 960, 540, 1300); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = v; g.fillRect(-600, -300, 3120, 1700);
  }

  // ---- the roll call: every cook's ticket clipped to the ticket rail ----
  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1);
    wall(g, 1, false);
    g.fillStyle = 'rgba(30,12,6,0.45)'; g.fillRect(-600, -300, 3120, 1700);
    text(g, 'TONIGHT’S COOKS', 960, 120, 76, CREAM, { font: BOLD, stroke: OUT, lw: 12 });
    const n = F.length, cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), tw = Math.min(330, 1720 / Math.max(1, cols));
    const railY = (row) => (rows > 1 ? 230 : 330) + row * 400;
    for (let row = 0; row < rows; row++) { const y = railY(row); g.fillStyle = '#c9ccd3'; rr(g, 120, y - 12, 1680, 24, 12); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(); }
    F.forEach((c, i) => {
      const k = (u - i * per) / 380; if (k <= 0) return;
      const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
      const x = 960 + (col - (rowN - 1) / 2) * tw, y = railY(row), e = easeOut(Math.min(1, k)), w = Math.min(250, tw * 0.8), h = w * (rows > 1 ? 1.25 : 1.5);
      const swing = Math.sin((u - i * per) / 160) * 0.12 * Math.max(0, 1 - k / 3);
      g.save(); g.translate(x, lerp(y - 300, y, e)); g.rotate(swing); g.globalAlpha = Math.min(1, k * 2);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-w / 2 + 8, 18, w, h);
      g.fillStyle = '#fffaf0'; g.beginPath(); g.moveTo(-w / 2, 10); g.lineTo(w / 2, 10); g.lineTo(w / 2, 10 + h);
      for (let z = 0; z <= 10; z++) g.lineTo(w / 2 - (z / 10) * w, 10 + h - (z % 2 ? 10 : 0)); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(60,40,20,0.6)'; g.stroke();
      g.fillStyle = RED; g.fillRect(-w / 2, 10, w, 34); text(g, 'ORDER #' + (101 + i), 0, 28, 22, '#fff', { font: BOLD, max: w - 10 });
      g.fillStyle = c.color || '#e9a23b'; g.beginPath(); g.arc(0, 10 + h * 0.46, w * 0.3, 0, TAU); g.fill();
      s.emoji(c.avatar || '🙂', 0, 10 + h * 0.46, w * 0.42);
      text(g, c.name, 0, 10 + h * 0.82, 34, '#2a1a10', { font: CHALK, max: w - 16 });
      g.fillStyle = '#9aa0ad'; rr(g, -18, -6, 36, 24, 5); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
      g.restore();
    });
    if (o.more && u > n * per - 1200) text(g, '…and ' + o.more + ' more cooks in the kitchen', 960, 1010, 44, CREAM, { font: BOLD, stroke: OUT, lw: 8 });
  }

  // Nonna Pina: a white chef's jacket with a red neckerchief, silver hair in a bun under a
  // little chef's hat, round glasses and a big grin. host.draw = the shared character + the hat.
  const look = { skin: '#eab48c', skinShade: '#c98d66', suit: '#fbf7ee', suit2: '#ddd5c4', sleeve: '#f4efe4', lapel: '#e7dfcf', shirt: '#fbf7ee', cuff: RED, tie: 'bow', tieColor: RED, hair: 'bun', hairColor: '#dcd6cc', hairShade: '#b9b2a6', brow: '#a39c90', glasses: '#8a5a2a', grin: true, prop: null };
  let base = null;
  function nonnaDraw(g, a) {
    if (!base) base = ST.makeHost(look);
    base(g, a);
    // the chef's hat, moving with her head (same sway, bounce and nod as the shared character)
    const sway = Math.sin(a.t * 0.9 + a.seed) * 4, bounce = a.talk ? -Math.abs(Math.sin(a.t * 6.2)) * 4 : Math.sin(a.t * 1.6) * 1.5;
    g.save(); g.translate(sway, bounce); g.translate(0, -215); g.rotate(Math.sin(a.t * 1.7 + a.seed) * 0.035 + (a.talk ? Math.sin(a.t * 5.1) * 0.045 : 0)); g.translate(0, 215);
    g.fillStyle = '#ffffff'; g.lineWidth = 5; g.strokeStyle = OUT;
    g.beginPath(); g.arc(-34, -392, 30, 0, TAU); g.arc(0, -406, 36, 0, TAU); g.arc(34, -392, 30, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#ffffff'; rr(g, -52, -386, 104, 42, 8); g.fill(); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(-48, -368, 96, 8);
    g.fillStyle = RED; g.beginPath(); g.arc(30, -364, 7, 0, TAU); g.fill();
    g.restore();
  }

  BOX.intros = BOX.intros || {};
  BOX.intros.pizza = {
    title: 'JustPizza',
    // How to play (box/howto.js): one card per step (module howSteps = 6). Nonna explains it.
    tutorial: [
      { icon: '🛎️', title: 'A customer comes in', text: 'A customer comes to the counter and shows the pizza they want. Look closely: in a few seconds it is gone!', phone: 'Watch the TV while the order is shown.', say: 'A customer comes to the counter and shows me the pizza they want. Look closely, my darlings, because in a few seconds it is gone!' },
      { icon: '🍕', title: 'Build it from memory', text: 'On your phone: pick the crust, the sauce and how much cheese.', phone: 'Tap a crust, a sauce and the cheese.', say: 'Then you make it from memory. Pick the crust, the sauce, and how much cheese.' },
      { icon: '🍄', title: 'Toppings in the right place', text: 'Pick a topping, then tap or swipe across the slices. Halves and quarters matter (which half does not).', phone: 'Pick a topping, then swipe across the slices.', say: 'Pick a topping, then tap or swipe across the slices. If they want it on half the pizza, put it on half the pizza!' },
      { icon: '🛵', title: 'Serve it', text: 'Tap Serve when it is ready. When the clock runs out, whatever is on your counter goes out.', phone: 'Tap 🛎️ Serve when your pizza is ready.', say: 'Tap serve when it is ready. When the clock runs out, whatever is on your counter goes to the customer.' },
      { icon: '🎲', title: 'Kitchen modes', text: 'Lunch Rush (quick orders, speed tips), Half & Half, Phone Order (just listen), Flash Order (two seconds!) and Head Chef (one of you reads the ticket out loud).', say: 'Some nights are different. A lunch rush, half and half, orders over the phone, a flash order, or one of you is head chef and reads the ticket out loud.' },
      { icon: '💰', title: 'Tips', text: 'The closer your pizza is to the order, the bigger the tip. The best pizza earns a bonus. Most tips at closing time wins.', say: 'The closer your pizza is to the order, the bigger the tip. The best pizza of the round gets a bonus. Most tips at closing time wins!' },
    ],
    // Every line Nonna says during the game, copied character for character from box/games/pizza.js (NONNA).
    story: [
      'Here comes our first customer. Look closely, my darlings!',
      'Eyes on the order. Remember everything!',
      'Look, look! Crust, sauce, cheese, toppings.',
      'Another hungry customer. Watch carefully!',
      'The phone is ringing! Listen carefully.',
      'Blink and you miss it!',
      'Lunch rush! Fast, fast, fast!',
      'One of you has the ticket. Read it out loud, and do not show your phone!',
      'Listen to your head chef, and build it!',
      'Now make it! From memory!',
      'Quick, quick, before the oven gets cold!',
      'To your stations! Make it just like the order.',
      'Perfetto! Just like my mamma made.',
      'Bellissimo! The customer is so happy.',
      'Not bad, not bad. A little more love next time.',
      'Close! The customer will still pay.',
      'Mamma mia! What is this?',
      'Oh no. That customer will not come back.',
      'Last order of the night. Make it beautiful!',
      'We close the shop. Grazie, my cooks, you did beautifully!',
    ],
    theme: { accent: GOLD, accent2: RED, accent3: '#3fd06a', ink: CREAM, panel: 'rgba(40,16,8,0.9)', fade: '#1a0a05', confetti: [RED, GOLD, '#3fd06a', CREAM, '#ff8a3d'] },
    host: {
      name: 'Nonna Pina',
      voice: { kokoro: 'bf_lily', speed: 1.0, like: /female|sonia|libby|emma|serena|zira|elsa/i, accent: /en-GB|en-US|it-IT/i, pitch: 1.05, rate: 1 },
      look,
      draw: nonnaDraw,
    },
    lines: {
      welcome: 'Benvenuti! I am Nonna Pina. Fifty years I make pizza at this counter, and tonight the whole town is hungry. You are my new cooks!',
      roll: 'Let me see my new cooks.',
      more: '…and {n} more cooks in my kitchen.',
      others: 'And the rest of you: wash your hands!',
      play: 'Aprons on! Here comes the first customer.',
    },
    stage, logo, roll, pie, flames,
    podium() { /* no podium: Nonna stands behind her counter */ },
    hostCam: { x: 960, y: 560, z: 1.5 },
    castOpening: [
      // The oven roars and a pizza slides in on the peel.
      { ms: 2600, sfx: [[150, 'whoosh'], [1300, 'swell']],
        draw(g, s) {
          const k = s.k;
          s.cam(lerp(1700, 1640, ease(k)), lerp(520, 500, ease(k)), lerp(2.6, 2.0, ease(k)));
          stage(g, s, { host: false, lights: 0.35, logo: 0, fire: 0.6 + 0.6 * ss(0, 0.4, k),
            extra(g2) { const px = lerp(1300, 1700, easeOut(ss(0.2, 0.75, k))); g2.fillStyle = '#c9a06a'; g2.fillRect(px - 420, 538, 300, 14); g2.lineWidth = 3; g2.strokeStyle = OUT; g2.strokeRect(px - 420, 538, 300, 14); g2.fillStyle = '#c9a06a'; g2.beginPath(); g2.ellipse(px, 545, 110, 20, 0, 0, TAU); g2.fill(); g2.stroke(); pie(g2, px, 535, 90, 0.25, k); } });
        } },
      // The neon sign buzzes on and the lamps warm up the shop.
      { ms: 2800, sfx: [[300, 'click'], [900, 'click']],
        draw(g, s) {
          const k = s.k, sign = k < 0.2 ? 0 : k < 0.3 ? (Math.sin(k * 260) > 0 ? 0.9 : 0.1) : k < 0.36 ? 0.3 : 1;
          s.cam(960, lerp(260, 420, ease(k)), lerp(2.0, 1.15, ease(k)));
          stage(g, s, { host: false, logo: sign, lights: 0.3 + 0.7 * ss(0.35, 0.8, k) });
        } },
      // Nonna Pina waves her new cooks in.
      { ms: 3200, sfx: [[0, 'join']], pose: [[500, 'wave', 1500]], say: 'welcome', sayAt: 350, fit: 6000,
        draw(g, s) {
          const k = s.k;
          s.cam(960, lerp(560, 600, ease(k)), lerp(1.05, 1.45, ease(k)));
          stage(g, s, {});
        } },
    ],
  };
})();
