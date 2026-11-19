'use strict';
// YesChef intro (game key `pizza`): the YesChef food court at night. Five kitchens under one
// roof and five owners who all want the best cooks in town. The neon sign buzzes on, the stalls
// light up one by one, the camera runs past the owners waving from their counters, then cuts
// inside tonight's kitchen (box/show.js sends it as show.extra.kitchen; 'court' = all of them)
// where its owner welcomes the cooks. In the roll call every cook's ticket is clipped to the rail.
//
// The owners (each drawn with the shared host kit plus their own hat, each with a Kokoro voice):
//   pizza  Nonna Pina, fifty years at the pizzeria counter
//   taco   Tía Lupe, who drove her taco truck El Cohete across the whole country
//   sushi  Chef Ren, quiet and precise, eight pieces to a roll
//   burger Big Buck, flipping burgers since the jukebox was new
//   sundae Coco Sprinkles, the sweetest stand in the food court
// onShow(show) picks the kitchen; host, lines, tutorial, story and theme follow it. `variants`
// lets tools/voice-gen.js render every owner's lines in their own voice. The in-game TV
// (public/box/games/pizza.js) draws the owners with owners[k].draw and backdrop(g, k).
// Every line an owner says in the game is in their `story` (copied from box/games/pizza.js LINES).
// Engine + API: public/box/show.js ('cast' mode).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, rng, OUT, TAU } = ST.util, { rr, text } = ST.draw;
  const SIGN = '"Pacifico", cursive', CHALK = '"Caveat Brush", "Permanent Marker", cursive', BOLD = '"Lilita One", sans-serif';
  try { if (document.fonts) for (const f of ['40px "Pacifico"', '40px "Caveat Brush"', '40px "Lilita One"']) document.fonts.load(f); } catch { /* fine */ }
  const R = rng(1962);
  const RED = '#c8321f', GREEN = '#2f8a3e', CREAM = '#fff4dc', GOLD = '#ffb43a', WOOD = '#7a4320', WOOD2 = '#4e2a12';
  const COUNTER_Y = 800, HOST = [960, 812, 1.0];
  const KEYS = ['pizza', 'taco', 'sushi', 'burger', 'sundae'];

  // ================= the pizzeria (Nonna Pina) =================
  const bricks = (() => { const a = []; for (let row = 0; row < 42; row++) for (let i = -1; i < 22; i++) a.push([i * 100 + (row % 2 ? 50 : 0), row * 34, 0.75 + R() * 0.35]); return a; })();
  const jars = [[300, '#e9a23b'], [360, '#c8321f'], [420, '#6aa84f'], [480, '#f4e3b5'], [1440, '#c8321f'], [1500, '#e9a23b']];
  const flour = Array.from({ length: 50 }, () => [R() * 1920, R() * 1080, 1 + R() * 3, 10 + R() * 30, R() * TAU]);
  function wall(g, lit, band = true) {
    let gr = g.createLinearGradient(0, -300, 0, 1000); gr.addColorStop(0, '#5a2414'); gr.addColorStop(1, '#3a160b'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    for (const [x, y, k] of bricks) { g.fillStyle = `rgba(${Math.round(176 * k)},${Math.round(78 * k)},${Math.round(48 * k)},1)`; rr(g, x + 3, y - 300 + 3, 94, 28, 4); g.fill(); }
    if (band) { g.fillStyle = '#f1dcb5'; g.fillRect(-600, 560, 3120, 60); g.fillStyle = 'rgba(120,60,20,0.25)'; g.fillRect(-600, 612, 3120, 8);
    for (let x = -600; x < 2520; x += 60) { g.fillStyle = (x / 60) % 2 ? '#2f6d4a' : '#f6efe0'; g.fillRect(x, 620, 60, 60); } }
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
    g.fillStyle = '#8c3b1d'; g.beginPath(); g.ellipse(x, y, 300, 300, 0, Math.PI, TAU); g.fill(); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
    for (let r = 0; r < 6; r++) for (let i = 0; i < 12; i++) { const a = Math.PI + (i + (r % 2) * 0.5) / 12 * Math.PI, rad = 70 + r * 40; if (a > TAU) continue; g.fillStyle = (i + r) % 3 ? '#b4552a' : '#d9773a'; g.beginPath(); g.arc(x + Math.cos(a) * rad, y + Math.sin(a) * rad * 0.98, 15, 0, TAU); g.fill(); }
    g.fillStyle = '#e8d3a8'; g.fillRect(x - 330, y - 10, 660, 40); g.strokeRect(x - 330, y - 10, 660, 40);
    g.fillStyle = '#1a0a05'; g.beginPath(); g.moveTo(x - 140, y + 30); g.lineTo(x - 140, y - 60); g.arc(x, y - 60, 140, Math.PI, TAU); g.lineTo(x + 140, y + 30); g.closePath(); g.fill(); g.lineWidth = 6; g.stroke();
    g.save(); g.clip(); flames(g, x + 40, y + 30, 220, 170, t, fire);
    const gr = g.createRadialGradient(x + 40, y, 10, x + 40, y, 220); gr.addColorStop(0, `rgba(255,170,60,${0.6 * fire})`); gr.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gr; g.fillRect(x - 160, y - 220, 320, 260); g.restore();
    g.strokeStyle = '#e8d3a8'; g.lineWidth = 14; g.beginPath(); g.arc(x, y - 60, 150, Math.PI, TAU); g.stroke();
    g.save(); g.globalCompositeOperation = 'lighter';
    const gw = g.createRadialGradient(x, y, 60, x, y, 520); gw.addColorStop(0, `rgba(255,120,40,${(0.22 + 0.05 * Math.sin(t * 7)) * fire})`); gw.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = gw; g.fillRect(x - 600, y - 600, 1200, 1100);
    g.restore();
  }
  function lamps(g, lit, xs = [560, 960, 1360], col = '#2e5e3f') {
    for (const x of xs) {
      g.strokeStyle = '#2a1a10'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, -300); g.lineTo(x, 40); g.stroke();
      g.fillStyle = col; g.beginPath(); g.moveTo(x - 70, 110); g.quadraticCurveTo(x, -10, x + 70, 110); g.closePath(); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = lit > 0.1 ? `rgba(255,236,170,${0.5 + 0.5 * lit})` : '#5b5b4a'; g.beginPath(); g.ellipse(x, 110, 30, 12, 0, 0, TAU); g.fill();
      if (lit > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, 110, 0, 820); gr.addColorStop(0, `rgba(255,214,140,${0.22 * lit})`); gr.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 50, 110); g.lineTo(x + 50, 110); g.lineTo(x + 230, 820); g.lineTo(x - 230, 820); g.closePath(); g.fill(); g.restore(); }
    }
  }
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
  function pizzaCounter(g) {
    let gr = g.createLinearGradient(0, COUNTER_Y, 0, COUNTER_Y + 50); gr.addColorStop(0, '#f6f1ea'); gr.addColorStop(1, '#d9d1c4'); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y, 3120, 50);
    g.lineWidth = 5; g.strokeStyle = OUT; g.strokeRect(-600, COUNTER_Y, 3120, 50);
    g.strokeStyle = 'rgba(140,130,120,0.35)'; g.lineWidth = 2; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(i * 280 - 100, COUNTER_Y + 8); g.quadraticCurveTo(i * 280 + 40, COUNTER_Y + 40, i * 280 + 180, COUNTER_Y + 20); g.stroke(); }
    gr = g.createLinearGradient(0, COUNTER_Y + 50, 0, 1200); gr.addColorStop(0, WOOD); gr.addColorStop(1, WOOD2); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y + 50, 3120, 500);
    for (let x = -600; x < 2520; x += 40) for (let r = 0; r < 2; r++) { g.fillStyle = ((x / 40) + r) % 2 ? RED : CREAM; g.fillRect(x, COUNTER_Y + 62 + r * 20, 40, 20); }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; for (let x = -560; x < 2520; x += 220) { g.beginPath(); g.moveTo(x, COUNTER_Y + 110); g.lineTo(x, 1200); g.stroke(); }
    g.fillStyle = '#b5773e'; g.beginPath(); g.ellipse(560, COUNTER_Y + 6, 150, 40, 0, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    pie(g, 560, COUNTER_Y - 2, 120, 0.3);
    for (const [x, y] of [[1260, -8], [1296, -14], [1280, -30]]) { g.fillStyle = '#e03a24'; g.beginPath(); g.arc(x, COUNTER_Y + y, 22, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); g.fillStyle = GREEN; g.beginPath(); g.ellipse(x, COUNTER_Y + y - 20, 9, 4, 0, 0, TAU); g.fill(); }
    g.fillStyle = '#efe3c6'; g.beginPath(); g.moveTo(1390, COUNTER_Y + 4); g.quadraticCurveTo(1380, COUNTER_Y - 90, 1420, COUNTER_Y - 110); g.lineTo(1480, COUNTER_Y - 110); g.quadraticCurveTo(1520, COUNTER_Y - 90, 1510, COUNTER_Y + 4); g.closePath(); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    text(g, 'FARINA', 1450, COUNTER_Y - 50, 22, RED, { font: BOLD });
    bell(g, 1150);
  }
  function bell(g, x) { g.fillStyle = '#d8b24a'; g.beginPath(); g.arc(x, COUNTER_Y - 4, 26, Math.PI, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(); g.fillStyle = '#333'; g.fillRect(x - 30, COUNTER_Y - 4, 60, 8); g.beginPath(); g.arc(x, COUNTER_Y - 32, 6, 0, TAU); g.fill(); }
  function dust(g, s, k = 1, col = 'rgba(255,245,225,0.35)') { g.fillStyle = col; for (const [x, y, r, v, p] of flour) { const yy = (y + s.t * v) % 1080, xx = x + Math.sin(s.t + p) * 20; g.globalAlpha = 0.5 * k; g.beginPath(); g.arc(xx, yy, r, 0, TAU); g.fill(); } g.globalAlpha = 1; }
  // A neon tube sign on a dark plate: [[text, colour, px], ...] side by side.
  function neon(g, parts, lit, o = {}) {
    lit = Math.max(0, Math.min(1, lit));
    const w = o.w || 660, h = o.h || 220, font = o.font || SIGN;
    if (o.plate !== false) { rr(g, -w / 2, -h / 2, w, h, 28); g.fillStyle = o.plateCol || 'rgba(20,10,8,0.92)'; g.fill(); g.lineWidth = 6; g.strokeStyle = o.rim || '#5a3a2a'; g.stroke(); }
    g.font = `${parts[0][2]}px ${font}`; const widths = parts.map(([t, , px]) => { g.font = `${px}px ${font}`; return g.measureText(t).width; });
    let x = -widths.reduce((a, b) => a + b + 14, -14) / 2;
    parts.forEach(([str, col, px], i) => {
      const cx = x + widths[i] / 2; x += widths[i] + 14;
      g.font = `${px}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
      g.lineWidth = 6; g.strokeStyle = 'rgba(90,80,70,0.7)'; g.strokeText(str, cx, i % 2 ? 6 : -8);
      if (lit > 0) { g.save(); g.globalAlpha = lit; g.shadowColor = col; g.shadowBlur = 34; g.strokeStyle = col; g.lineWidth = 7; g.strokeText(str, cx, i % 2 ? 6 : -8); g.shadowBlur = 12; g.fillStyle = '#fff6e6'; g.fillText(str, cx, i % 2 ? 6 : -8); g.restore(); }
    });
  }
  // The YesChef neon sign: "Yes" in gold, "Chef" in hot coral.
  function logo(g, s, lit) { neon(g, [['Yes', '#ffd23f', 92], ['Chef', '#ff4f6d', 108]], lit, { w: 640 }); }
  function pizzaBack(g, s, o) {
    const lit = o.lights == null ? 1 : o.lights;
    wall(g, lit); menuBoard(g); shelf(g);
    if (o.logo !== 0 && !o.backdrop) { g.save(); g.translate(960, 240); g.scale(0.7, 0.7); neon(g, [['Pizzeria', '#3fd06a', 84], ['Pina', '#ff3b2a', 104]], o.logo == null ? 1 : o.logo, { w: 760 }); g.restore(); }
    oven(g, s, o); lamps(g, lit);
  }

  // ================= El Cohete, the taco truck (Tía Lupe) =================
  const picado = ['#ff4f6d', '#ffd23f', '#2ec4b6', '#9b5de5', '#ff8c42', '#3fd06a'];
  function bunting(g, y, cols, t, x0 = -600, x1 = 2520, size = 70, sag = 40) {
    g.strokeStyle = '#3a2a20'; g.lineWidth = 3; g.beginPath();
    for (let x = x0; x <= x1; x += 20) { const k = ((x - x0) % 640) / 640; g.lineTo(x, y + Math.sin(k * Math.PI) * sag); } g.stroke();
    let i = 0;
    for (let x = x0 + 30; x < x1; x += size * 1.05, i++) {
      const k = ((x - x0) % 640) / 640, yy = y + Math.sin(k * Math.PI) * sag, sw = Math.sin(t * 2 + i) * 0.06;
      g.save(); g.translate(x, yy); g.rotate(sw); g.fillStyle = cols[i % cols.length];
      g.beginPath(); g.moveTo(-size * 0.42, 0); g.lineTo(size * 0.42, 0); g.lineTo(size * 0.42, size * 0.7); g.lineTo(0, size * 0.85); g.lineTo(-size * 0.42, size * 0.7); g.closePath(); g.fill();
      g.globalCompositeOperation = 'destination-out'; for (const [dx, dy] of [[-12, 18], [12, 18], [0, 34], [-14, 46], [14, 46]]) { g.beginPath(); g.arc(dx * size / 70, dy * size / 70, 5 * size / 70, 0, TAU); g.fill(); }
      g.restore();
    }
  }
  function tacoBack(g, s, o) {
    const t = s.t || 0, lit = o.lights == null ? 1 : o.lights;
    // dusk sky behind the truck
    let gr = g.createLinearGradient(0, -300, 0, 900); gr.addColorStop(0, '#2b1b4e'); gr.addColorStop(0.55, '#a33b5c'); gr.addColorStop(1, '#ff9a5a'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    // the truck body, turquoise with a yellow stripe
    gr = g.createLinearGradient(0, 0, 0, 900); gr.addColorStop(0, '#2fc4b4'); gr.addColorStop(1, '#16867c'); g.fillStyle = gr; rr(g, -200, 20, 2320, 1100, 60); g.fill(); g.lineWidth = 8; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#ffd23f'; g.fillRect(-200, 640, 2320, 26);
    // the serving window and the kitchen inside it
    gr = g.createLinearGradient(0, 260, 0, 800); gr.addColorStop(0, '#3d4b52'); gr.addColorStop(1, '#22302f'); g.fillStyle = gr; rr(g, 420, 250, 1080, 560, 18); g.fill(); g.lineWidth = 10; g.strokeStyle = '#c9d2d6'; g.stroke(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.save(); rr(g, 425, 255, 1070, 550, 16); g.clip();
    g.fillStyle = '#e8eef0'; for (let x = 430; x < 1500; x += 64) for (let y = 260; y < 800; y += 48) { g.globalAlpha = 0.08 + ((x + y) % 3) * 0.03; g.fillRect(x, y, 60, 44); } g.globalAlpha = 1;
    // a shelf with salsa bottles and a stack of tortillas, the comal steaming on the right
    g.fillStyle = '#8a5a34'; g.fillRect(470, 420, 330, 14);
    [['#3f9a3a', 500], ['#c8321f', 560], ['#ff9f1c', 620], ['#c8321f', 680], ['#3f9a3a', 740]].forEach(([c, x]) => { g.fillStyle = c; rr(g, x - 16, 350, 32, 70, 8); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); g.fillStyle = '#fff'; g.fillRect(x - 10, 372, 20, 16); g.fillStyle = '#333'; g.fillRect(x - 8, 338, 16, 14); });
    g.fillStyle = '#555c60'; rr(g, 1180, 560, 280, 30, 8); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    for (let i = 0; i < 3; i++) { g.fillStyle = '#f2d28a'; g.beginPath(); g.ellipse(1240 + i * 80, 556, 34, 9, 0, 0, TAU); g.fill(); g.lineWidth = 2; g.stroke(); }
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 6; g.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const x = 1220 + i * 70, ph = t * 1.5 + i; g.beginPath(); g.moveTo(x, 540); g.bezierCurveTo(x - 20, 500 - (ph % 1) * 20, x + 20, 470, x - 6 + Math.sin(ph) * 10, 430); g.stroke(); }
    g.restore();
    // the awning, red and yellow stripes with a scalloped edge
    for (let i = 0; i < 18; i++) { g.fillStyle = i % 2 ? '#ffd23f' : '#e2453a'; g.beginPath(); g.moveTo(390 + i * 63, 180); g.lineTo(453 + i * 63, 180); g.lineTo(453 + i * 63, 236); g.arc(421.5 + i * 63, 236, 31.5, 0, Math.PI); g.closePath(); g.fill(); }
    g.lineWidth = 5; g.strokeStyle = OUT; g.strokeRect(390, 170, 1134, 14);
    // the truck's painted name, a rocket and a chalk menu
    if (!o.backdrop && o.logo !== 0) { g.save(); g.translate(960, 100); g.scale(0.62, 0.62); neon(g, [['El', '#ffd23f', 90], ['Cohete', '#ff4f6d', 110]], o.logo == null ? 1 : o.logo, { w: 720, plateCol: 'rgba(20,40,44,0.92)', rim: '#ffd23f' }); g.restore(); }
    g.save(); g.translate(1720, 340); g.rotate(-0.5); g.fillStyle = '#f4f1ea'; g.beginPath(); g.moveTo(0, -120); g.quadraticCurveTo(50, -60, 44, 60); g.lineTo(-44, 60); g.quadraticCurveTo(-50, -60, 0, -120); g.fill(); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#e2453a'; g.beginPath(); g.arc(0, -20, 22, 0, TAU); g.fill(); g.stroke(); flames(g, 0, 130, 80, 90 + Math.sin(t * 9) * 10, t, 1); g.restore();
    g.fillStyle = '#2a2420'; rr(g, 40, 170, 300, 400, 14); g.fill(); g.lineWidth = 6; g.strokeStyle = '#ffd23f'; g.stroke();
    text(g, 'TACOS', 190, 220, 54, '#ffd23f', { font: CHALK });
    ['Asada', 'Pollo', 'Al Pastor', 'Pescado', 'Frijoles'].forEach((n, i) => text(g, n, 70, 290 + i * 54, 36, '#f4f1e6', { font: CHALK, align: 'left' }));
    bunting(g, -10, picado, t, -600, 2520, 74, 50);
    if (lit < 1) { g.fillStyle = `rgba(10,4,20,${(1 - lit) * 0.6})`; g.fillRect(-600, -300, 3120, 1700); }
  }
  function tacoCounter(g, s) {
    // the window ledge, then the truck below it
    let gr = g.createLinearGradient(0, COUNTER_Y, 0, COUNTER_Y + 40); gr.addColorStop(0, '#eef2f4'); gr.addColorStop(1, '#a9b4ba'); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y, 3120, 40); g.lineWidth = 5; g.strokeStyle = OUT; g.strokeRect(-600, COUNTER_Y, 3120, 40);
    gr = g.createLinearGradient(0, COUNTER_Y + 40, 0, 1200); gr.addColorStop(0, '#22a89a'); gr.addColorStop(1, '#0f5f58'); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y + 40, 3120, 500);
    for (let x = -600; x < 2520; x += 120) { g.fillStyle = picado[(x / 120 + 10) % picado.length | 0]; g.beginPath(); g.moveTo(x, COUNTER_Y + 70); g.lineTo(x + 60, COUNTER_Y + 110); g.lineTo(x + 120, COUNTER_Y + 70); g.lineTo(x + 60, COUNTER_Y + 150); g.closePath(); g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; }
    // a basket of limes, a molcajete of salsa, a taco plate and the bell
    for (const [x, y] of [[1300, -14], [1336, -18], [1318, -34], [1352, -2]]) { g.fillStyle = '#7ac943'; g.beginPath(); g.ellipse(x, COUNTER_Y + y, 20, 16, 0.3, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); }
    g.fillStyle = '#5a5552'; g.beginPath(); g.ellipse(640, COUNTER_Y - 10, 70, 30, 0, 0, Math.PI); g.lineTo(570, COUNTER_Y - 18); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#3f9a3a'; g.beginPath(); g.ellipse(640, COUNTER_Y - 18, 66, 14, 0, 0, TAU); g.fill(); g.stroke();
    taco(g, 470, COUNTER_Y - 20, 70);
    bell(g, 1150);
  }
  function taco(g, x, y, w, shell = '#f2c14e') {
    g.save(); g.translate(x, y);
    g.fillStyle = '#6b3a1f'; g.beginPath(); g.ellipse(0, -w * 0.18, w * 0.42, w * 0.2, 0, Math.PI, TAU); g.fill();
    for (let i = 0; i < 5; i++) { g.fillStyle = ['#4caf50', '#e2453a', '#fff', '#7ac943', '#ffd23f'][i]; g.beginPath(); g.arc(-w * 0.3 + i * w * 0.15, -w * 0.3 - (i % 2) * 6, w * 0.07, 0, TAU); g.fill(); }
    g.fillStyle = shell; g.beginPath(); g.moveTo(-w / 2, -w * 0.18); g.arc(0, -w * 0.18, w / 2, Math.PI, 0, true); g.closePath(); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.restore();
  }

  // ================= Ren's Sushi Bar (Chef Ren) =================
  function noren(g, t, y0 = -300, y1 = 190, x0 = 380, x1 = 1540) {
    const n = 4, w = (x1 - x0) / n;
    g.fillStyle = '#6b4a2a'; g.fillRect(x0 - 30, y0, x1 - x0 + 60, 20);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * w, sw = Math.sin(t * 1.3 + i) * 6;
      g.fillStyle = '#24345e'; g.beginPath(); g.moveTo(x + 4, y0 + 20); g.lineTo(x + w - 4, y0 + 20); g.lineTo(x + w - 4 + sw, y1); g.lineTo(x + 4 + sw, y1); g.closePath(); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 5; g.beginPath(); for (let k = 0; k <= 6; k++) { const xx = x + 20 + k * (w - 40) / 6; g.lineTo(xx + sw, y1 - 40 + (k % 2 ? -14 : 0)); } g.stroke();
    }
    g.fillStyle = '#fff'; g.beginPath(); g.arc((x0 + x1) / 2, (y0 + y1) / 2 + 30, 58, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    // a fish crest on the curtain
    g.fillStyle = '#24345e'; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + 30;
    g.beginPath(); g.ellipse(cx - 6, cy, 30, 16, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(cx + 18, cy); g.lineTo(cx + 40, cy - 16); g.lineTo(cx + 40, cy + 16); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 22, cy - 4, 4, 0, TAU); g.fill();
  }
  function lantern(g, x, y, t, i, col = '#ff6b4a') {
    const sw = Math.sin(t * 1.2 + i) * 0.05;
    g.save(); g.translate(x, y); g.rotate(sw);
    g.strokeStyle = '#2a1a10'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -400); g.lineTo(0, -60); g.stroke();
    const gr = g.createRadialGradient(0, 0, 10, 0, 0, 80); gr.addColorStop(0, '#fff3c4'); gr.addColorStop(1, col); g.fillStyle = gr;
    g.beginPath(); g.ellipse(0, 0, 58, 72, 0, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(120,40,20,0.4)'; g.lineWidth = 2; for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(0, 0, Math.abs(k) * 14 + 4, 72, 0, 0, TAU); g.stroke(); }
    g.fillStyle = '#2a1a10'; g.fillRect(-30, -78, 60, 12); g.fillRect(-30, 66, 60, 12);
    g.save(); g.globalCompositeOperation = 'lighter'; const gw = g.createRadialGradient(0, 0, 20, 0, 0, 220); gw.addColorStop(0, 'rgba(255,170,90,0.25)'); gw.addColorStop(1, 'rgba(255,170,90,0)'); g.fillStyle = gw; g.fillRect(-220, -220, 440, 440); g.restore();
    g.restore();
  }
  function sushiBack(g, s, o) {
    const t = s.t || 0, lit = o.lights == null ? 1 : o.lights;
    let gr = g.createLinearGradient(0, -300, 0, 900); gr.addColorStop(0, '#d9b98a'); gr.addColorStop(1, '#b08458'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    for (let x = -600; x < 2520; x += 46) { g.fillStyle = (x / 46) % 2 ? 'rgba(90,50,20,0.10)' : 'rgba(255,240,210,0.10)'; g.fillRect(x, -300, 40, 1400); g.fillStyle = 'rgba(70,40,15,0.35)'; g.fillRect(x + 40, -300, 6, 1400); }
    // the back shelf: a big teapot, cups, a rice tub and a little pine in a pot
    g.fillStyle = '#6b4a2a'; g.fillRect(260, 520, 420, 18); g.fillRect(1260, 520, 420, 18); g.lineWidth = 4; g.strokeStyle = OUT; g.strokeRect(260, 520, 420, 18); g.strokeRect(1260, 520, 420, 18);
    g.fillStyle = '#3c5a4a'; g.beginPath(); g.ellipse(340, 470, 56, 50, 0, 0, TAU); g.fill(); g.stroke(); g.fillRect(320, 410, 40, 14); g.beginPath(); g.moveTo(390, 470); g.quadraticCurveTo(430, 440, 438, 420); g.lineWidth = 12; g.strokeStyle = '#3c5a4a'; g.stroke();
    for (const x of [470, 530, 590]) { g.fillStyle = '#f1ead8'; rr(g, x - 20, 482, 40, 38, 8); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); g.fillStyle = '#24345e'; g.fillRect(x - 20, 494, 40, 6); }
    g.fillStyle = '#c9a06a'; rr(g, 1300, 440, 150, 80, 10); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(); g.strokeStyle = '#8a5a34'; g.lineWidth = 6; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(1300, 460 + i * 22); g.lineTo(1450, 460 + i * 22); g.stroke(); }
    g.fillStyle = '#8a4b2a'; rr(g, 1540, 470, 80, 50, 6); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    for (const [dx, dy, r] of [[0, -60, 40], [-36, -40, 30], [36, -44, 32], [0, -100, 26]]) { g.fillStyle = '#2f6d4a'; g.beginPath(); g.ellipse(1580 + dx, 470 + dy, r, r * 0.6, 0, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); }
    g.strokeStyle = '#5a3a20'; g.lineWidth = 8; g.beginPath(); g.moveTo(1580, 470); g.lineTo(1578, 410); g.stroke();
    noren(g, t);
    lantern(g, 170, 330, t, 0); lantern(g, 1750, 330, t, 1);
    if (!o.backdrop && o.logo !== 0) { g.save(); g.translate(960, 300); g.scale(0.55, 0.55); neon(g, [['Ren’s', '#ffffff', 96], ['Sushi', '#ff6b4a', 106]], o.logo == null ? 1 : o.logo, { w: 760, plateCol: 'rgba(30,24,20,0.92)', rim: '#c9a06a', font: BOLD }); g.restore(); }
    gr = g.createRadialGradient(960, 400, 60, 960, 400, 1100); gr.addColorStop(0, `rgba(255,210,150,${0.25 * lit})`); gr.addColorStop(1, 'rgba(255,210,150,0)'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    if (lit < 1) { g.fillStyle = `rgba(12,8,4,${(1 - lit) * 0.7})`; g.fillRect(-600, -300, 3120, 1700); }
  }
  function sushiCounter(g, s) {
    const t = s.t || 0;
    let gr = g.createLinearGradient(0, COUNTER_Y, 0, COUNTER_Y + 46); gr.addColorStop(0, '#f6e2bd'); gr.addColorStop(1, '#ddc08e'); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y, 3120, 46); g.lineWidth = 5; g.strokeStyle = OUT; g.strokeRect(-600, COUNTER_Y, 3120, 46);
    gr = g.createLinearGradient(0, COUNTER_Y + 46, 0, 1200); gr.addColorStop(0, '#5a3a20'); gr.addColorStop(1, '#2e1c0e'); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y + 46, 3120, 500);
    // the conveyor belt with little plates riding along it
    g.fillStyle = '#9aa3ab'; g.fillRect(-600, COUNTER_Y + 60, 3120, 60); g.lineWidth = 4; g.strokeStyle = OUT; g.strokeRect(-600, COUNTER_Y + 60, 3120, 60);
    g.fillStyle = 'rgba(0,0,0,0.15)'; for (let x = -600 + ((t * 80) % 40); x < 2520; x += 40) g.fillRect(x, COUNTER_Y + 62, 4, 56);
    const cols = ['#e63946', '#ffd23f', '#3a86ff', '#2a9d8f'];
    for (let i = 0; i < 14; i++) { const x = ((i * 190 + t * 80) % 2660) - 400; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x, COUNTER_Y + 84, 52, 16, 0, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = cols[i % 4]; g.stroke(); sushiPiece(g, x - 18, COUNTER_Y + 70, 14, i); sushiPiece(g, x + 18, COUNTER_Y + 70, 14, i + 1); }
    // a board of rolls, the bell
    g.fillStyle = '#c9a06a'; rr(g, 430, COUNTER_Y - 26, 260, 30, 6); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    for (let i = 0; i < 4; i++) sushiPiece(g, 470 + i * 60, COUNTER_Y - 44, 24, i);
    bell(g, 1150);
  }
  function sushiPiece(g, x, y, r, i) {
    g.fillStyle = '#1f2d1f'; g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, TAU); g.fill(); g.lineWidth = 2.5; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#fbfaf5'; g.beginPath(); g.ellipse(x, y, r * 0.78, r * 0.6, 0, 0, TAU); g.fill();
    g.fillStyle = ['#ff8c5a', '#c8243c', '#7ac943', '#ffb84a'][i % 4]; g.beginPath(); g.ellipse(x, y, r * 0.34, r * 0.28, 0, 0, TAU); g.fill();
  }

  // ================= Buck's Burger Joint (Big Buck) =================
  function burgerBack(g, s, o) {
    const t = s.t || 0, lit = o.lights == null ? 1 : o.lights;
    g.fillStyle = '#fff1d0'; g.fillRect(-600, -300, 3120, 1700);
    for (let x = -600; x < 2520; x += 120) { g.fillStyle = 'rgba(214,40,40,0.08)'; g.fillRect(x, -300, 60, 760); }
    // checkered tiles under a chrome strip
    for (let y = 450; y < 820; y += 46) for (let x = -600; x < 2520; x += 46) { g.fillStyle = ((x + y) / 46) % 2 ? '#d62828' : '#fbf7ee'; g.fillRect(x, y, 46, 46); }
    let gr = g.createLinearGradient(0, 430, 0, 456); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#9aa3ab'); gr.addColorStop(1, '#e8ecef'); g.fillStyle = gr; g.fillRect(-600, 430, 3120, 26); g.lineWidth = 3; g.strokeStyle = OUT; g.strokeRect(-600, 430, 3120, 26);
    // the flat-top grill and its hood, patties sizzling
    g.fillStyle = '#b8c0c6'; g.beginPath(); g.moveTo(1290, 120); g.lineTo(1830, 120); g.lineTo(1900, 300); g.lineTo(1220, 300); g.closePath(); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#3a3a40'; rr(g, 1240, 560, 640, 70, 10); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#22242a'; g.fillRect(1250, 548, 620, 16);
    for (let i = 0; i < 4; i++) { const x = 1320 + i * 150; g.fillStyle = '#6b3a1f'; g.beginPath(); g.ellipse(x, 546, 56, 15, 0, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); if (i % 2) { g.fillStyle = '#ffc93c'; g.beginPath(); g.moveTo(x - 44, 538); g.lineTo(x + 44, 538); g.lineTo(x + 30, 552); g.lineTo(x - 30, 552); g.closePath(); g.fill(); } }
    g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 7; g.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const x = 1300 + i * 100, ph = (t * 0.9 + i * 0.37) % 1; g.globalAlpha = 1 - ph; g.beginPath(); g.moveTo(x, 520 - ph * 40); g.bezierCurveTo(x - 24, 480 - ph * 120, x + 24, 440 - ph * 140, x, 380 - ph * 160); g.stroke(); } g.globalAlpha = 1;
    // the lightbox menu
    g.fillStyle = '#1b1b20'; rr(g, 70, 110, 420, 300, 14); g.fill(); g.lineWidth = 6; g.strokeStyle = '#c9ccd3'; g.stroke();
    text(g, 'BURGERS', 280, 160, 46, '#ffd23f', { font: BOLD });
    [['Classic', '7'], ['Double Buck', '10'], ['Tower', '13'], ['Sunrise Egg', '9']].forEach(([n, p], i) => { text(g, n, 100, 220 + i * 50, 32, '#ffffff', { font: BOLD, align: 'left' }); text(g, p, 460, 220 + i * 50, 32, '#ff6b6b', { font: BOLD, align: 'right' }); });
    if (!o.backdrop && o.logo !== 0) { g.save(); g.translate(960, 200); g.scale(0.66, 0.66); neon(g, [['Buck’s', '#ff3b3b', 104], ['Burgers', '#3ad0ff', 96]], o.logo == null ? 1 : o.logo, { w: 800, plateCol: 'rgba(20,20,26,0.92)', rim: '#c9ccd3' }); g.restore(); }
    lamps(g, lit, [560, 1360], '#d62828');
    if (lit < 1) { g.fillStyle = `rgba(10,6,4,${(1 - lit) * 0.7})`; g.fillRect(-600, -300, 3120, 1700); }
  }
  function burgerCounter(g) {
    let gr = g.createLinearGradient(0, COUNTER_Y, 0, COUNTER_Y + 44); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d9dde0'); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y, 3120, 44); g.lineWidth = 5; g.strokeStyle = OUT; g.strokeRect(-600, COUNTER_Y, 3120, 44);
    gr = g.createLinearGradient(0, COUNTER_Y + 44, 0, 1200); gr.addColorStop(0, '#e63946'); gr.addColorStop(1, '#8e1b24'); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y + 44, 3120, 500);
    gr = g.createLinearGradient(0, COUNTER_Y + 60, 0, COUNTER_Y + 84); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#9aa3ab'); gr.addColorStop(1, '#eef1f3'); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y + 60, 3120, 24);
    for (let x = -540; x < 2520; x += 160) { g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, COUNTER_Y + 90, 70, 300); }
    // ketchup, mustard, a napkin box, a burger on its paper, the bell
    for (const [x, c, cap] of [[1290, '#d62828', '#fff'], [1350, '#ffc93c', '#d62828']]) { g.fillStyle = c; rr(g, x - 20, COUNTER_Y - 100, 40, 100, 12); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(); g.fillStyle = cap; g.beginPath(); g.moveTo(x - 10, COUNTER_Y - 100); g.lineTo(x, COUNTER_Y - 128); g.lineTo(x + 10, COUNTER_Y - 100); g.closePath(); g.fill(); g.stroke(); }
    g.fillStyle = '#c9ccd3'; rr(g, 1420, COUNTER_Y - 70, 90, 70, 8); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(); g.fillStyle = '#fff'; g.fillRect(1440, COUNTER_Y - 84, 50, 20);
    g.fillStyle = '#fff6e0'; g.beginPath(); g.moveTo(400, COUNTER_Y + 2); g.lineTo(700, COUNTER_Y + 2); g.lineTo(670, COUNTER_Y - 14); g.lineTo(430, COUNTER_Y - 14); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    burger(g, 550, COUNTER_Y - 12, 150);
    bell(g, 1150);
  }
  function burger(g, x, y, w) {
    g.save(); g.translate(x, y); g.lineWidth = 4; g.strokeStyle = OUT;
    const h = w * 0.11;
    g.fillStyle = '#d9963f'; rr(g, -w * 0.45, -h, w * 0.9, h, h / 2); g.fill(); g.stroke();
    g.fillStyle = '#5a2e14'; rr(g, -w * 0.5, -h * 2.4, w, h * 1.4, h * 0.7); g.fill(); g.stroke();
    g.fillStyle = '#ffc93c'; g.beginPath(); g.moveTo(-w * 0.48, -h * 2.5); g.lineTo(w * 0.48, -h * 2.5); g.lineTo(w * 0.3, -h * 1.7); g.lineTo(0, -h * 2.4); g.lineTo(-w * 0.3, -h * 1.6); g.closePath(); g.fill();
    g.fillStyle = '#5fbf3a'; g.beginPath(); for (let i = 0; i <= 10; i++) g.lineTo(-w * 0.52 + i * w * 0.104, -h * 2.7 + (i % 2 ? 8 : -2)); g.lineTo(w * 0.5, -h * 3.1); g.lineTo(-w * 0.5, -h * 3.1); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#e8a04a'; g.beginPath(); g.moveTo(-w * 0.48, -h * 3); g.bezierCurveTo(-w * 0.48, -h * 6.2, w * 0.48, -h * 6.2, w * 0.48, -h * 3); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff6dc'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(-w * 0.3 + i * w * 0.1, -h * (4.3 + (i % 3) * 0.4), 4, 2.4, 0.4, 0, TAU); g.fill(); }
    g.restore();
  }

  // ================= Coco's Sundae Stand (Coco Sprinkles) =================
  const sprinkles = Array.from({ length: 60 }, () => [R() * 1920, R() * 1080, R() * TAU, 30 + R() * 60, Math.floor(R() * 6)]);
  const SPR = ['#ff4f6d', '#ffd23f', '#3ad0ff', '#7ac943', '#b388ff', '#ffffff'];
  function scoop(g, x, y, r, col, drip = true) {
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, Math.PI * 0.95, Math.PI * 2.05);
    if (drip) for (let i = 0; i <= 6; i++) { const xx = x + r - (i / 6) * 2 * r; g.lineTo(xx, y + r * 0.25 + (i % 2 ? r * 0.28 : 0)); }
    g.closePath(); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.14, -0.5, 0, TAU); g.fill();
  }
  function cone(g, x, y, w, h) {
    g.fillStyle = '#e0a458'; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.lineTo(x, y + h); g.closePath(); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    g.save(); g.clip(); g.strokeStyle = 'rgba(120,60,10,0.45)'; g.lineWidth = 3; for (let i = -6; i < 8; i++) { g.beginPath(); g.moveTo(x - w / 2 + i * w / 6, y); g.lineTo(x + i * w / 6 - w / 2 + h * 0.6, y + h); g.stroke(); g.beginPath(); g.moveTo(x + w / 2 - i * w / 6, y); g.lineTo(x - i * w / 6 + w / 2 - h * 0.6, y + h); g.stroke(); } g.restore();
  }
  function sundaeBack(g, s, o) {
    const t = s.t || 0, lit = o.lights == null ? 1 : o.lights;
    for (let x = -600; x < 2520; x += 80) { g.fillStyle = (x / 80) % 2 ? '#ffd6e7' : '#fff6fa'; g.fillRect(x, -300, 80, 1400); }
    g.fillStyle = '#bff0e2'; g.fillRect(-600, 560, 3120, 260); g.fillStyle = '#8fe3d0'; g.fillRect(-600, 552, 3120, 14);
    // a giant cone sign on the left, shelves of sprinkles and cherries on the right
    g.save(); g.translate(260, 120); g.rotate(-0.12); cone(g, 0, 160, 170, 300); scoop(g, 0, 150, 90, '#ff9ab0'); scoop(g, -30, 60, 74, '#a8ecc8'); scoop(g, 24, -10, 64, '#fff3d6');
    g.fillStyle = '#e0304a'; g.beginPath(); g.arc(24, -82, 22, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(); g.beginPath(); g.moveTo(24, -102); g.quadraticCurveTo(34, -130, 52, -136); g.stroke(); g.restore();
    g.fillStyle = '#ff8fc8'; g.fillRect(1300, 380, 420, 16); g.fillRect(1300, 500, 420, 16); g.lineWidth = 4; g.strokeStyle = OUT; g.strokeRect(1300, 380, 420, 16); g.strokeRect(1300, 500, 420, 16);
    [['#ff4f6d', 1350], ['#ffd23f', 1430], ['#3ad0ff', 1510], ['#7ac943', 1590], ['#b388ff', 1670]].forEach(([c, x], i) => {
      g.fillStyle = 'rgba(230,245,255,0.6)'; rr(g, x - 28, 300, 56, 80, 10); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
      g.fillStyle = c; for (let k = 0; k < 10; k++) g.fillRect(x - 20 + (k * 13) % 40, 330 + (k * 7) % 44, 8, 3);
      g.fillStyle = i % 2 ? '#e0304a' : '#6b3a22'; g.beginPath(); g.arc(x, 476, 18, 0, TAU); g.fill(); g.stroke();
    });
    bunting(g, -40, ['#ff8fc8', '#8fe3d0', '#ffd23f', '#b388ff', '#ffffff'], t, -600, 2520, 66, 46);
    if (!o.backdrop && o.logo !== 0) { g.save(); g.translate(960, 230); g.scale(0.62, 0.62); neon(g, [['Coco’s', '#ff5fa2', 100], ['Sundaes', '#3ad0ff', 96]], o.logo == null ? 1 : o.logo, { w: 820, plateCol: 'rgba(60,20,50,0.9)', rim: '#ff8fc8' }); g.restore(); }
    for (const [x, y, a, v, c] of sprinkles) { const yy = (y + t * v) % 1080; g.save(); g.translate(x, yy); g.rotate(a + t); g.fillStyle = SPR[c]; g.globalAlpha = 0.5; g.fillRect(-7, -2.5, 14, 5); g.restore(); }
    if (lit < 1) { g.fillStyle = `rgba(30,10,30,${(1 - lit) * 0.65})`; g.fillRect(-600, -300, 3120, 1700); }
  }
  function sundaeCounter(g) {
    let gr = g.createLinearGradient(0, COUNTER_Y, 0, COUNTER_Y + 40); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#f1dde8'); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y, 3120, 40); g.lineWidth = 5; g.strokeStyle = OUT; g.strokeRect(-600, COUNTER_Y, 3120, 40);
    gr = g.createLinearGradient(0, COUNTER_Y + 40, 0, 1200); gr.addColorStop(0, '#8fe3d0'); gr.addColorStop(1, '#3fae96'); g.fillStyle = gr; g.fillRect(-600, COUNTER_Y + 40, 3120, 500);
    // the freezer glass with the tubs inside
    g.fillStyle = 'rgba(220,245,255,0.55)'; g.fillRect(-600, COUNTER_Y + 56, 3120, 110); g.lineWidth = 4; g.strokeStyle = OUT; g.strokeRect(-600, COUNTER_Y + 56, 3120, 110);
    const tubs = ['#fff3d6', '#6b3a22', '#ff9ab0', '#a8ecc8', '#ffc04a', '#9b8cff'];
    for (let i = 0, x = -560; x < 2520; x += 150, i++) { g.fillStyle = '#c9ccd3'; g.fillRect(x, COUNTER_Y + 110, 130, 50); g.fillStyle = tubs[i % 6]; g.beginPath(); g.ellipse(x + 65, COUNTER_Y + 112, 62, 22, 0, Math.PI, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); }
    // a sundae glass, a jar of cherries, the bell
    g.save(); g.translate(560, COUNTER_Y - 8);
    g.fillStyle = 'rgba(230,245,255,0.8)'; g.beginPath(); g.moveTo(-70, -80); g.lineTo(70, -80); g.lineTo(20, 0); g.lineTo(-20, 0); g.closePath(); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    scoop(g, 0, -96, 46, '#ff9ab0'); scoop(g, -20, -140, 36, '#6b3a22'); g.fillStyle = '#e0304a'; g.beginPath(); g.arc(-12, -184, 13, 0, TAU); g.fill(); g.stroke(); g.restore();
    g.fillStyle = 'rgba(230,245,255,0.7)'; rr(g, 1290, COUNTER_Y - 90, 80, 90, 14); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    for (let i = 0; i < 6; i++) { g.fillStyle = '#e0304a'; g.beginPath(); g.arc(1310 + (i % 3) * 20, COUNTER_Y - 20 - Math.floor(i / 3) * 22, 10, 0, TAU); g.fill(); }
    bell(g, 1150);
  }

  // ================= the owners =================
  // Each owner: the shared cartoon host (BOX.studio.makeHost) plus their own hat, moving with the head.
  function withHat(look, hat) {
    let base = null;
    return function (g, a) {
      if (!base) base = ST.makeHost(look);
      base(g, a);
      const sway = Math.sin(a.t * 0.9 + a.seed) * 4, bounce = a.talk ? -Math.abs(Math.sin(a.t * 6.2)) * 4 : Math.sin(a.t * 1.6) * 1.5;
      g.save(); g.translate(sway, bounce); g.translate(0, -215); g.rotate(Math.sin(a.t * 1.7 + a.seed) * 0.035 + (a.talk ? Math.sin(a.t * 5.1) * 0.045 : 0)); g.translate(0, 215);
      g.lineWidth = 5; g.strokeStyle = OUT; g.lineJoin = 'round'; g.lineCap = 'round';
      hat(g, a);
      g.restore();
    };
  }
  const HATS = {
    pizza(g) { // a puffy white chef's hat with a red dot
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(-34, -392, 30, 0, TAU); g.arc(0, -406, 36, 0, TAU); g.arc(34, -392, 30, 0, TAU); g.fill(); g.stroke();
      rr(g, -52, -386, 104, 42, 8); g.fill(); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(-48, -368, 96, 8);
      g.fillStyle = RED; g.beginPath(); g.arc(30, -364, 7, 0, TAU); g.fill();
    },
    taco(g) { // a red polka-dot bandana knotted at the side, and gold hoops
      g.strokeStyle = '#f4c430'; g.lineWidth = 5; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 60, -264, 11, 0, TAU); g.stroke(); }
      g.lineWidth = 5; g.strokeStyle = OUT;
      g.fillStyle = '#e2453a'; g.beginPath(); g.moveTo(-66, -302); g.bezierCurveTo(-74, -386, 74, -386, 66, -302); g.quadraticCurveTo(0, -330, -66, -302); g.closePath(); g.fill(); g.stroke();
      g.save(); g.clip(); g.fillStyle = '#fff'; for (const [x, y] of [[-40, -340], [-12, -358], [18, -352], [44, -334], [-26, -318], [4, -330], [32, -316], [-52, -316]]) { g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); } g.restore();
      g.fillStyle = '#e2453a'; g.beginPath(); g.moveTo(62, -318); g.lineTo(104, -296); g.lineTo(88, -280); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(62, -312); g.lineTo(96, -262); g.lineTo(78, -260); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.arc(64, -314, 11, 0, TAU); g.fill(); g.stroke();
    },
    sushi(g) { // an indigo headband with a white wave, tied at the side
      g.fillStyle = '#24345e'; rr(g, -62, -340, 124, 22, 8); g.fill(); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 12; i++) g.lineTo(-54 + i * 9, -329 + (i % 2 ? -4 : 4)); g.stroke();
      g.strokeStyle = OUT; g.lineWidth = 4; g.fillStyle = '#24345e';
      g.beginPath(); g.moveTo(58, -334); g.lineTo(94, -352); g.lineTo(98, -336); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(58, -326); g.lineTo(92, -304); g.lineTo(80, -296); g.closePath(); g.fill(); g.stroke();
    },
    burger(g) { // a white paper diner hat with a red stripe and a star
      g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-70, -322); g.lineTo(-54, -378); g.quadraticCurveTo(0, -396, 54, -378); g.lineTo(70, -322); g.quadraticCurveTo(0, -338, -70, -322); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#d62828'; g.beginPath(); g.moveTo(-66, -334); g.quadraticCurveTo(0, -350, 66, -334); g.lineTo(68, -326); g.quadraticCurveTo(0, -342, -68, -326); g.closePath(); g.fill();
      g.fillStyle = '#ffd23f'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, an = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(an) * r, -364 + Math.sin(an) * r); } g.closePath(); g.fill(); g.lineWidth = 3; g.stroke();
    },
    sundae(g) { // a striped pink soda-fountain cap with a cherry on top
      g.save(); g.translate(8, 0); g.rotate(0.12);
      g.fillStyle = '#ff8fc8'; g.beginPath(); g.moveTo(-54, -334); g.lineTo(-44, -384); g.lineTo(44, -384); g.lineTo(54, -334); g.quadraticCurveTo(0, -346, -54, -334); g.closePath(); g.fill(); g.stroke();
      g.save(); g.clip(); g.fillStyle = '#ffffff'; for (let x = -50; x < 60; x += 22) g.fillRect(x, -390, 10, 60); g.restore();
      g.beginPath(); g.moveTo(-54, -334); g.lineTo(-44, -384); g.lineTo(44, -384); g.lineTo(54, -334); g.quadraticCurveTo(0, -346, -54, -334); g.closePath(); g.stroke();
      g.fillStyle = '#e0304a'; g.beginPath(); g.arc(4, -398, 14, 0, TAU); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(6, -410); g.quadraticCurveTo(14, -436, 30, -440); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(-1, -402, 4, 0, TAU); g.fill();
      g.restore();
    },
  };
  const LOOKS = {
    pizza: { skin: '#eab48c', skinShade: '#c98d66', suit: '#fbf7ee', suit2: '#ddd5c4', sleeve: '#f4efe4', lapel: '#e7dfcf', shirt: '#fbf7ee', cuff: RED, tie: 'bow', tieColor: RED, hair: 'bun', hairColor: '#dcd6cc', hairShade: '#b9b2a6', brow: '#a39c90', glasses: '#8a5a2a', grin: true, prop: null },
    taco: { skin: '#b77b53', skinShade: '#9a6240', suit: '#1f9e8f', suit2: '#137266', sleeve: '#1f9e8f', lapel: '#f4c430', shirt: '#fff4dc', cuff: '#f4c430', tie: 'none', hair: 'curly', hairColor: '#2a1612', hairShade: '#120806', brow: '#2a1612', grin: true, prop: null },
    sushi: { skin: '#f0cfa8', skinShade: '#d6ad84', suit: '#f8f8f4', suit2: '#d6d6ce', sleeve: '#f2f2ec', lapel: '#24345e', shirt: '#24345e', cuff: '#24345e', tie: 'none', hair: 'short', hairColor: '#17171d', brow: '#17171d', grin: false, prop: null },
    burger: { skin: '#e6ab80', skinShade: '#c98a60', suit: '#ffffff', suit2: '#d9d9d9', sleeve: '#ffffff', lapel: '#d62828', shirt: '#ffffff', cuff: '#d62828', tie: 'none', hair: 'bald', mustache: '#7a4a24', brow: '#7a4a24', grin: true, prop: null },
    sundae: { skin: '#8a5a3c', skinShade: '#6e4630', suit: '#8fe3d0', suit2: '#55c2aa', sleeve: '#8fe3d0', lapel: '#ff8fc8', shirt: '#ffffff', cuff: '#ff8fc8', tie: 'bow', tieColor: '#ff5fa2', hair: 'curly', hairColor: '#ff8fc8', hairShade: '#d95f9e', brow: '#5a3020', grin: true, prop: null },
  };
  const owner = (k, name, voice) => ({ name, voice, look: LOOKS[k], draw: withHat(LOOKS[k], HATS[k]) });
  const OWNERS = {
    pizza: owner('pizza', 'Nonna Pina', { kokoro: 'bf_lily', speed: 1.0, like: /female|sonia|libby|emma|serena|zira|elsa/i, accent: /en-GB|en-US|it-IT/i, pitch: 1.05, rate: 1 }),
    taco: owner('taco', 'Tía Lupe', { kokoro: 'af_bella', speed: 1.05, like: /female|aria|jenny|zira|paulina|sabina/i, accent: /en-US|es-MX|es-US/i, pitch: 1.08, rate: 1.05 }),
    sushi: owner('sushi', 'Chef Ren', { kokoro: 'am_michael', speed: 0.95, like: /male|guy|david|mark|ryan/i, accent: /en-US|en-GB/i, pitch: 0.95, rate: 0.95 }),
    burger: owner('burger', 'Big Buck', { kokoro: 'am_fenrir', speed: 0.98, like: /male|guy|david|mark|george/i, accent: /en-US/i, pitch: 0.85, rate: 1 }),
    sundae: owner('sundae', 'Coco Sprinkles', { kokoro: 'af_heart', speed: 1.1, like: /female|aria|jenny|zira|ana/i, accent: /en-US/i, pitch: 1.2, rate: 1.1 }),
  };
  const anims = {};
  function drawOwner(g, k, x, y, sc, now, pose) {
    const O = OWNERS[k]; const A = anims[k] || (anims[k] = new ST.HostAnim(O));
    if (pose && (A.pose !== pose || now > A.poseUntil)) A.setPose(pose, 900, now);
    g.save(); g.translate(x, y); g.scale(sc, sc); try { O.draw(g, A.frame(now)); } catch (e) { /* drawing */ } g.restore();
  }

  // ================= the food court =================
  const KIT = {
    pizza: { back: pizzaBack, counter: pizzaCounter, sign: [['Pizzeria', '#3fd06a'], ['Pina', '#ff3b2a']], stall: '#8a3a1f', awn: ['#c8321f', '#fff4dc'], front: '#7a4320', icon: '🍕', theme: { accent: GOLD, accent2: RED, accent3: '#3fd06a', ink: CREAM, panel: 'rgba(40,16,8,0.9)', fade: '#1a0a05', confetti: [RED, GOLD, '#3fd06a', CREAM, '#ff8a3d'] }, tick: RED },
    taco: { back: tacoBack, counter: tacoCounter, sign: [['El', '#ffd23f'], ['Cohete', '#ff4f6d']], stall: '#1fa596', awn: ['#e2453a', '#ffd23f'], front: '#16867c', icon: '🌮', theme: { accent: '#ffd23f', accent2: '#ff4f6d', accent3: '#2ec4b6', ink: '#fff8e6', panel: 'rgba(16,50,48,0.9)', fade: '#140a24', confetti: picado }, tick: '#e2453a' },
    sushi: { back: sushiBack, counter: sushiCounter, sign: [['Ren’s', '#ffffff'], ['Sushi', '#ff6b4a']], stall: '#c49a6a', awn: ['#24345e', '#f4efe4'], front: '#5a3a20', icon: '🍣', theme: { accent: '#ff6b4a', accent2: '#24345e', accent3: '#ffd9a8', ink: '#fff8ee', panel: 'rgba(36,52,94,0.92)', fade: '#120c08', confetti: ['#ff6b4a', '#ffffff', '#24345e', '#ffd9a8', '#7ac943'] }, tick: '#24345e' },
    burger: { back: burgerBack, counter: burgerCounter, sign: [['Buck’s', '#ff3b3b'], ['Burgers', '#3ad0ff']], stall: '#fff1d0', awn: ['#d62828', '#ffffff'], front: '#c1272d', icon: '🍔', theme: { accent: '#ffc93c', accent2: '#d62828', accent3: '#3ad0ff', ink: '#ffffff', panel: 'rgba(30,20,20,0.9)', fade: '#100808', confetti: ['#d62828', '#ffc93c', '#3ad0ff', '#ffffff', '#5fbf3a'] }, tick: '#d62828' },
    sundae: { back: sundaeBack, counter: sundaeCounter, sign: [['Coco’s', '#ff5fa2'], ['Sundaes', '#3ad0ff']], stall: '#ffd6e7', awn: ['#ff8fc8', '#ffffff'], front: '#55c2aa', icon: '🍨', theme: { accent: '#ff8fc8', accent2: '#3ad0ff', accent3: '#ffd23f', ink: '#ffffff', panel: 'rgba(70,24,60,0.9)', fade: '#1a0a18', confetti: SPR }, tick: '#ff5fa2' },
  };
  const STALL_X = [220, 590, 960, 1330, 1700];
  const COURT_THEME = { accent: '#ffd23f', accent2: '#ff4f6d', accent3: '#3ad0ff', ink: '#ffffff', panel: 'rgba(24,16,44,0.92)', fade: '#0c0818', confetti: ['#ffd23f', '#ff4f6d', '#3ad0ff', '#7ac943', '#ff8fc8'] };
  const stars = Array.from({ length: 80 }, () => [R() * 2400 - 240, R() * 300 - 300, 1 + R() * 2.4, R() * TAU]);
  function courtBack(g, s, o = {}) {
    const t = s.t || 0, lit = o.lights == null ? 1 : o.lights;
    let gr = g.createLinearGradient(0, -300, 0, 900); gr.addColorStop(0, '#0d0b2a'); gr.addColorStop(0.6, '#2a1c5a'); gr.addColorStop(1, '#4a2a6a'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    for (const [x, y, r, p] of stars) { g.fillStyle = `rgba(255,255,240,${0.4 + 0.4 * Math.sin(t * 2 + p)})`; g.beginPath(); g.arc(x, y + 300, r, 0, TAU); g.fill(); }
    // the hall: a big glass roof frame and the plaza floor
    g.strokeStyle = 'rgba(200,190,255,0.18)'; g.lineWidth = 8; for (let x = -600; x < 2520; x += 240) { g.beginPath(); g.moveTo(x, -300); g.lineTo(960 + (x - 960) * 0.6, 260); g.stroke(); }
    gr = g.createLinearGradient(0, 850, 0, 1400); gr.addColorStop(0, '#5a4a6e'); gr.addColorStop(1, '#2a2040'); g.fillStyle = gr; g.fillRect(-600, 850, 3120, 600);
    for (let y = 0; y < 6; y++) for (let x = -12; x < 13; x++) { const yy = 860 + y * y * 14 + y * 30, w = 140 + y * 26; g.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'; g.fillRect(960 + x * w - w / 2, yy, w, 30 + y * 30); }
    // string lights across the hall
    for (let row = 0; row < 2; row++) {
      const y0 = 120 + row * 70;
      g.strokeStyle = '#1a1030'; g.lineWidth = 3; g.beginPath(); for (let x = -600; x <= 2520; x += 20) g.lineTo(x, y0 + Math.sin(((x + 600) / 3120) * Math.PI * 3) * 30); g.stroke();
      for (let x = -580, i = 0; x < 2520; x += 64, i++) { const y = y0 + Math.sin(((x + 600) / 3120) * Math.PI * 3) * 30 + 10, on = lit > 0.2 ? 0.6 + 0.4 * Math.sin(t * 3 + i) : 0.15; g.fillStyle = `rgba(255,${200 + (i % 3) * 20},${120 + (i % 2) * 80},${on})`; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); if (on > 0.5) { g.fillStyle = `rgba(255,220,150,${on * 0.18})`; g.beginPath(); g.arc(x, y, 26, 0, TAU); g.fill(); } }
    }
    const lits = o.lit || [lit, lit, lit, lit, lit];
    KEYS.forEach((k, i) => stall(g, s, k, STALL_X[i], lits[i], o));
    if (o.logo !== 0) { g.save(); g.translate(960, 96); g.scale(0.62, 0.62); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
  }
  function stall(g, s, k, x, lit, o) {
    const K = KIT[k], w = 340, t = s.t || 0, now = s.now || performance.now();
    // the back of the stall in the kitchen's colours, a little window of light
    g.fillStyle = K.stall; rr(g, x - w / 2, 300, w, 420, 10); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    if (k === 'pizza') { g.fillStyle = 'rgba(0,0,0,0.25)'; for (let r = 0; r < 12; r++) g.fillRect(x - w / 2, 300 + r * 35, w, 3); }
    if (k === 'taco') { g.fillStyle = '#ffd23f'; g.fillRect(x - w / 2, 610, w, 14); }
    if (k === 'sushi') { g.fillStyle = 'rgba(70,40,15,0.35)'; for (let xx = x - w / 2; xx < x + w / 2; xx += 26) g.fillRect(xx, 300, 4, 420); }
    if (k === 'burger') { for (let yy = 560; yy < 720; yy += 32) for (let xx = x - w / 2; xx < x + w / 2; xx += 32) { g.fillStyle = ((xx - x + w / 2 + yy) / 32) % 2 ? '#d62828' : '#fbf7ee'; g.fillRect(xx, yy, 32, 32); } }
    if (k === 'sundae') { for (let xx = x - w / 2; xx < x + w / 2; xx += 40) { g.fillStyle = (xx - x) / 40 % 2 ? '#ffffff' : '#ffc2dc'; g.fillRect(xx, 300, 20, 420); } }
    if (o.owners !== false) drawOwner(g, k, x, 728, 0.52, now, o.wave && o.wave[KEYS.indexOf(k)] ? 'wave' : null);
    // counter front
    g.fillStyle = K.front; rr(g, x - w / 2 - 10, 700, w + 20, 160, 8); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(x - w / 2 - 14, 694, w + 28, 16); g.strokeRect(x - w / 2 - 14, 694, w + 28, 16);
    g.font = '86px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(K.icon, x, 786);
    // the scalloped awning and the sign
    const n = 8, sw = (w + 40) / n;
    for (let i = 0; i < n; i++) { const ax = x - w / 2 - 20 + i * sw; g.fillStyle = K.awn[i % 2]; g.beginPath(); g.moveTo(ax, 330); g.lineTo(ax + sw, 330); g.lineTo(ax + sw, 380); g.arc(ax + sw / 2, 380, sw / 2, 0, Math.PI); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); }
    g.save(); g.translate(x, 282); g.scale(0.4, 0.4); neon(g, K.sign.map(([tx, c], i) => [tx, c, i ? 96 : 84]), lit, { w: 820, h: 170, font: k === 'sushi' || k === 'burger' ? BOLD : SIGN }); g.restore();
    if (lit < 1) { g.fillStyle = `rgba(6,4,20,${(1 - lit) * 0.75})`; rr(g, x - w / 2 - 22, 240, w + 44, 630, 10); g.fill(); }
    else { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, 520, 20, x, 520, 260); gr.addColorStop(0, `rgba(255,220,160,${0.12 + 0.03 * Math.sin(t * 2 + x)})`); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(x - 260, 260, 520, 520); g.restore(); }
  }

  // ================= what the intro shows: the current kitchen =================
  let cur = 'court';
  const pick = (k) => (KIT[k] ? k : 'court');
  // The kitchen's back wall (no host, no counter): the in-game TV paints it behind its screens.
  function backdrop(g, k, s = { t: 0, now: 0 }, o = {}) { k = pick(k); if (k === 'court') courtBack(g, s, { owners: o.owners, logo: o.logo }); else KIT[k].back(g, s, { backdrop: true, logo: 0, ...o }); }
  function stage(g, s, o = {}) {
    const k = pick(o.kitchen || cur);
    if (k === 'court') {
      courtBack(g, s, o);
      if (o.host !== false) s.host(960, 1010, 0.95);
      return;
    }
    KIT[k].back(g, s, o);
    if (o.host !== false) s.host(HOST[0], HOST[1], HOST[2]);
    KIT[k].counter(g, s);
    if (o.extra) o.extra(g, s);
    if (k === 'pizza') dust(g, s, o.lights == null ? 1 : o.lights);
    const lit = o.lights == null ? 1 : o.lights;
    if (k === 'pizza' && lit < 1) { g.fillStyle = `rgba(10,4,2,${(1 - lit) * 0.7})`; g.fillRect(-600, -300, 3120, 1700); }
    const v = g.createRadialGradient(960, 540, 520, 960, 540, 1300); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = v; g.fillRect(-600, -300, 3120, 1700);
  }
  // A caption across the bottom of the screen (screen space).
  function caption(g, s, str, k, y = 960, px = 64) {
    if (k <= 0) return;
    g.save(); g.setTransform(s.base[0], 0, 0, s.base[0], s.base[1], s.base[2]); g.globalAlpha = Math.min(1, k);
    g.fillStyle = 'rgba(10,6,24,0.7)'; rr(g, 160, y - px * 0.85, 1600, px * 1.7, px * 0.5); g.fill();
    text(g, str, 960, y, px, '#ffffff', { font: BOLD, stroke: OUT, lw: 8, max: 1500 });
    g.restore();
  }

  // ---- the roll call: every cook's ticket clipped to the ticket rail ----
  function roll(g, s, F, u, per, o) {
    const k = pick(cur);
    s.cam(960, 540, 1);
    backdrop(g, k, s, { owners: false, logo: 0 });
    g.fillStyle = 'rgba(20,10,30,0.5)'; g.fillRect(-600, -300, 3120, 1700);
    text(g, 'TONIGHT’S COOKS', 960, 120, 76, CREAM, { font: BOLD, stroke: OUT, lw: 12 });
    const n = F.length, cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), tw = Math.min(330, 1720 / Math.max(1, cols));
    const railY = (row) => (rows > 1 ? 230 : 330) + row * 400, tick = k === 'court' ? '#ff4f6d' : KIT[k].tick;
    for (let row = 0; row < rows; row++) { const y = railY(row); g.fillStyle = '#c9ccd3'; rr(g, 120, y - 12, 1680, 24, 12); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(); }
    F.forEach((c, i) => {
      const kk = (u - i * per) / 380; if (kk <= 0) return;
      const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
      const x = 960 + (col - (rowN - 1) / 2) * tw, y = railY(row), e = easeOut(Math.min(1, kk)), w = Math.min(250, tw * 0.8), h = w * (rows > 1 ? 1.25 : 1.5);
      const swing = Math.sin((u - i * per) / 160) * 0.12 * Math.max(0, 1 - kk / 3);
      g.save(); g.translate(x, lerp(y - 300, y, e)); g.rotate(swing); g.globalAlpha = Math.min(1, kk * 2);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-w / 2 + 8, 18, w, h);
      g.fillStyle = '#fffaf0'; g.beginPath(); g.moveTo(-w / 2, 10); g.lineTo(w / 2, 10); g.lineTo(w / 2, 10 + h);
      for (let z = 0; z <= 10; z++) g.lineTo(w / 2 - (z / 10) * w, 10 + h - (z % 2 ? 10 : 0)); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(60,40,20,0.6)'; g.stroke();
      g.fillStyle = tick; g.fillRect(-w / 2, 10, w, 34); text(g, 'ORDER #' + (101 + i), 0, 28, 22, '#fff', { font: BOLD, max: w - 10 });
      if (!s.body(c, 0, 10 + h * 0.7, h * 0.52)) { g.fillStyle = c.color || '#e9a23b'; g.beginPath(); g.arc(0, 10 + h * 0.46, w * 0.3, 0, TAU); g.fill(); s.emoji(c.avatar || '🙂', 0, 10 + h * 0.46, w * 0.42); }
      text(g, c.name, 0, 10 + h * 0.84, 34, '#2a1a10', { font: CHALK, max: w - 16 });
      g.fillStyle = '#9aa0ad'; rr(g, -18, -6, 36, 24, 5); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
      g.restore();
    });
    if (o.more && u > n * per - 1200) text(g, '…and ' + o.more + ' more cooks in the kitchen', 960, 1010, 44, CREAM, { font: BOLD, stroke: OUT, lw: 8 });
  }

  // ================= words: intro lines, how to play, in-game lines =================
  const LINES = {
    pizza: { welcome: 'Benvenuti to the YesChef food court! I am Nonna Pina, and tonight my pizzeria needs you!', roll: 'Let me see my new cooks.', more: '…and {n} more cooks in my kitchen.', others: 'And the rest of you: wash your hands!', play: 'Aprons on! Here comes the first customer.' },
    taco: { welcome: 'Hola, cooks! I am Tía Lupe. My taco truck is the fastest in the food court, and tonight it is yours!', roll: 'Who is on my truck tonight?', more: '…and {n} more cooks squeezed in my truck.', others: 'And everybody else, grab an apron!', play: 'Hot griddle! Here they come!' },
    sushi: { welcome: 'Welcome. I am Chef Ren. At my sushi bar, every piece is a promise. Tonight, you keep it.', roll: 'My new cooks. Let me see you.', more: '…and {n} more at the counter.', others: 'And the rest of you. Sharpen your knives.', play: 'Breathe. The first guest is here.' },
    burger: { welcome: 'Howdy, cooks! Big Buck here. Best burgers in the food court, and tonight you are flipping them!', roll: 'Let me get a look at my crew!', more: '…and {n} more on the grill.', others: 'And the rest of y’all, grab a spatula!', play: 'Grill is hot! Order up!' },
    sundae: { welcome: 'Hiii! I am Coco Sprinkles! Welcome to my sundae stand, the sweetest spot in the food court!', roll: 'Ooh, who is scooping with me tonight?', more: '…and {n} more sweeties!', others: 'And everyone else, grab a scoop!', play: 'Scoops up! Here comes a customer!' },
    court: { welcome: 'Tonight the whole food court is open! Pizza, tacos, sushi, burgers and sundaes. Every owner wants you!', roll: 'Let me see tonight’s cooks.', more: '…and {n} more cooks in the food court.', others: 'And the rest of you: wash your hands!', play: 'Aprons on! Here comes the first customer.' },
  };
  // How to play (box/howto.js), six steps (module howSteps = 6), in each owner's words.
  const step = (icon, title, txt, phone, say) => ({ icon, title, text: txt, phone, say });
  const TUTORIAL = {
    pizza: [
      step('🛎️', 'A customer comes in', 'A customer comes to the counter and shows the pizza they want. Look closely: in a few seconds it is gone!', 'Watch the TV while the order is shown.', 'A customer shows me the pizza they want. Look closely, my darlings, in a few seconds it is gone!'),
      step('🍕', 'Build it from memory', 'On your phone: pick the crust, the sauce and how much cheese.', 'Tap a crust, a sauce and the cheese.', 'Then you make it from memory. Pick the crust, the sauce, and how much cheese.'),
      step('🍄', 'Toppings in the right place', 'Pick a topping, then tap or swipe across the slices. Halves and quarters matter (which half does not).', 'Pick a topping, then swipe across the slices.', 'Pick a topping, then swipe across the slices. Half the pizza means half the pizza!'),
      step('🛵', 'Serve it', 'Tap Serve when it is ready. When the clock runs out, whatever is on your counter goes out.', 'Tap 🛎️ Serve when your pizza is ready.', 'Tap serve when it is ready. When the clock runs out, whatever you made goes out.'),
      step('🎲', 'Kitchen modes', 'Lunch Rush (speed tips), Half & Half, Phone Order (just listen), Flash Order (two seconds!) and Head Chef (one of you reads the ticket out loud).', null, 'Some nights are different: a lunch rush, half and half, phone orders, flash orders, or a head chef.'),
      step('💰', 'Tips', 'The closer your pizza is to the order, the bigger the tip. The best pizza earns a bonus. Most tips at closing time wins.', null, 'The closer your pizza, the bigger the tip. The best one gets a bonus. Most tips wins!'),
    ],
    taco: [
      step('🛎️', 'A customer comes in', 'A customer walks up to the truck and shows the plate of three tacos they want. In a few seconds it is gone!', 'Watch the TV while the order is shown.', 'A customer shows me the taco plate they want. Look closely, mis amigos, it disappears fast!'),
      step('🌮', 'Shell, filling, salsa', 'On your phone: pick the tortilla, the filling and the salsa for the plate.', 'Tap a tortilla, a filling and a salsa.', 'Then build it from memory. Pick the tortilla, the filling and the salsa.'),
      step('🥑', 'Toppings on each taco', 'Pick a topping, then tap the tacos that get it. How many tacos counts; which one does not.', 'Pick a topping, then tap the tacos.', 'Pick a topping and tap the tacos that get it. Two tacos with onion means two tacos!'),
      step('🛵', 'Serve it', 'Tap Serve when it is ready. When the clock runs out, whatever is on your plate goes out.', 'Tap 🛎️ Serve when your plate is ready.', 'Tap serve when it is ready. When time is up, whatever is on your plate goes out!'),
      step('🎲', 'Truck modes', 'Taco Rush (speed tips), Mix & Match (every taco different), Phone Order (just listen), Flash Order (two seconds!) and Head Chef (one of you reads the ticket).', null, 'Some nights are crazy: a taco rush, mix and match, phone orders, flash orders, or a head chef.'),
      step('💰', 'Tips', 'The closer your plate is to the order, the bigger the tip. The best plate earns a bonus. Most tips when the grill goes off wins.', null, 'The closer your plate, the bigger the tip. The best one gets a bonus. Most tips wins!'),
    ],
    sushi: [
      step('🛎️', 'A guest comes in', 'A guest sits at the counter and shows the roll they want: eight pieces. In a few seconds it is gone.', 'Watch the TV while the order is shown.', 'A guest shows me the roll they want. Eight pieces. Watch closely. It will not stay long.'),
      step('🍣', 'Wrap, rice, filling', 'On your phone: pick the wrap, the rice and the filling inside the roll.', 'Tap a wrap, a rice and a filling.', 'Then roll it from memory. Choose the wrap, the rice and the filling.'),
      step('🥢', 'Toppings on each piece', 'Pick a topping, then tap or swipe across the eight pieces. One row, every other piece, a pair: it matters. The board can be turned around.', 'Pick a topping, then swipe across the pieces.', 'Pick a topping and swipe across the pieces. One row, every other piece, every piece. It matters.'),
      step('🛎️', 'Serve it', 'Tap Serve when it is ready. When the clock runs out, whatever is on your board goes out.', 'Tap 🛎️ Serve when your roll is ready.', 'Tap serve when it is ready. When time is up, your board goes to the guest.'),
      step('🎲', 'Counter modes', 'Conveyor Rush (speed tips), Rainbow Roll (patterns of toppings), Phone Order (just listen), Flash Order (two seconds!) and Head Chef (one of you reads the ticket).', null, 'Some evenings are different. A conveyor rush, a rainbow roll, phone orders, flash orders, or a head chef.'),
      step('💰', 'Tips', 'The closer your roll is to the order, the bigger the tip. The best roll earns a bonus. Most tips at the end wins.', null, 'The closer your roll, the bigger the tip. The best one earns a bonus. Most tips wins.'),
    ],
    burger: [
      step('🛎️', 'A customer comes in', 'A customer comes to the counter and shows the burger they want. In a few seconds it is gone!', 'Watch the TV while the order is shown.', 'A customer shows me the burger they want. Look sharp, folks, it is gone in a few seconds!'),
      step('🍔', 'Pick the bun', 'On your phone: pick the bun first. Sesame, brioche, pretzel, or a lettuce wrap.', 'Tap a bun.', 'Then build it from memory. First up, pick the bun.'),
      step('🥓', 'Stack it in order', 'Tap ingredients to stack them from the bottom up. The order matters! Undo takes the top layer off.', 'Tap ingredients, bottom to top.', 'Tap the ingredients to stack them, bottom to top. The order matters, partner!'),
      step('🛎️', 'Serve it', 'Tap Serve when it is ready. When the clock runs out, whatever is on your plate goes out.', 'Tap 🛎️ Serve when your burger is ready.', 'Hit serve when it is ready. When time is up, whatever you stacked goes out!'),
      step('🎲', 'Grill modes', 'Drive-Thru Rush (speed tips), Tower Burger (seven or eight layers!), Phone Order (just listen), Flash Order (two seconds!) and Head Chef (one of you reads the ticket).', null, 'Some nights get wild: a drive-thru rush, tower burgers, phone orders, flash orders, or a head chef.'),
      step('💰', 'Tips', 'The closer your burger is to the order, the bigger the tip. The best burger earns a bonus. Most tips at closing time wins.', null, 'The closer your burger, the bigger the tip. Best burger gets a bonus. Most tips wins!'),
    ],
    sundae: [
      step('🛎️', 'A customer comes in', 'A customer comes to the stand and shows the sundae they want. In a few seconds it melts away!', 'Watch the TV while the order is shown.', 'A customer shows me the sundae they want. Look quick, sweeties, before it melts away!'),
      step('🍦', 'Cone, cup or bowl', 'On your phone: pick a cone, a cup or a bowl, and the sauce.', 'Tap a cone, cup or bowl, and a sauce.', 'Then scoop it from memory. Pick a cone, a cup or a bowl, and the sauce.'),
      step('🍒', 'Scoops in order, then toppings', 'Tap flavours to stack the scoops from the bottom up (the order matters!), then tap every topping it had.', 'Tap flavours bottom to top, then toppings.', 'Tap the flavours to stack your scoops, bottom to top, then add the toppings.'),
      step('🛎️', 'Serve it', 'Tap Serve when it is ready. When the clock runs out, whatever is in your cone goes out.', 'Tap 🛎️ Serve when your sundae is ready.', 'Tap serve when it is ready. When time is up, your sundae goes out, melty or not!'),
      step('🎲', 'Stand modes', 'Heat Wave (speed tips), Mega Sundae (four scoops, lots of toppings), Phone Order (just listen), Flash Order (two seconds!) and Head Chef (one of you reads the ticket).', null, 'Some days are wild: a heat wave, mega sundaes, phone orders, flash orders, or a head chef.'),
      step('💰', 'Tips', 'The closer your sundae is to the order, the bigger the tip. The best sundae earns a bonus. Most tips at closing time wins.', null, 'The closer your sundae, the bigger the tip. The best one gets a bonus. Most tips wins!'),
    ],
    court: [
      step('🔀', 'A new kitchen every order', 'Tonight the whole food court is open: pizza, tacos, sushi, burgers and sundaes. Every order comes from a different kitchen.', 'Watch the TV: which kitchen is it?', 'Tonight the whole food court is open. Every order comes from a different kitchen!'),
      step('👀', 'Look, then build', 'A customer shows what they want for a few seconds. Then rebuild it on your phone from memory.', 'Watch the TV while the order is shown.', 'A customer shows you what they want. Then you build it on your phone, from memory.'),
      step('🧑‍🍳', 'Every kitchen is different', 'Pizza: toppings on the slices. Tacos: on each taco. Sushi: on each piece. Burgers and sundaes: stack it in the right order.', 'Your phone becomes that kitchen’s station.', 'Toppings go on slices, tacos or pieces. Burgers and sundaes are stacked, and the order matters.'),
      step('🛵', 'Serve it', 'Tap Serve when it is ready. When the clock runs out, whatever you made goes out.', 'Tap 🛎️ Serve when it is ready.', 'Tap serve when it is ready. When the clock runs out, whatever you made goes out.'),
      step('🎲', 'Kitchen modes', 'Lunch Rush (speed tips), each kitchen’s special, Phone Order (just listen), Flash Order (two seconds!) and Head Chef (one of you reads the ticket out loud).', null, 'Some nights are different: a lunch rush, each kitchen’s special, phone orders, flash orders, or a head chef.'),
      step('💰', 'Tips', 'The closer your dish is to the order, the bigger the tip. The best dish earns a bonus. Most tips at closing time wins.', null, 'The closer your dish, the bigger the tip. The best one gets a bonus. Most tips wins!'),
    ],
  };
  // Every line each owner says during the game, copied character for character from box/games/pizza.js (LINES).
  const STORY = {
    pizza: [
      'Here comes our first customer. Look closely, my darlings!',
      'Eyes on the order. Remember everything!', 'Look, look! Crust, sauce, cheese, toppings.', 'Another hungry customer. Watch carefully!',
      'The phone is ringing! Listen carefully.', 'Blink and you miss it!', 'Lunch rush! Fast, fast, fast!',
      'One of you has the ticket. Read it out loud, and do not show your phone!', 'Listen to your head chef, and build it!',
      'Now make it! From memory!', 'Quick, quick, before the oven gets cold!', 'To your stations! Make it just like the order.',
      'Perfetto! Just like my mamma made.', 'Bellissimo! The customer is so happy.',
      'Not bad, not bad. A little more love next time.', 'Close! The customer will still pay.',
      'Mamma mia! What is this?', 'Oh no. That customer will not come back.',
      'Last order of the night. Make it beautiful!', 'We close the shop. Grazie, my cooks, you did beautifully!',
    ],
    taco: [
      'Our first customer! Watch the plate, mis amigos!',
      'Look! Shell, filling, salsa, and what goes on each taco.', 'Eyes on the plate. Every taco counts!', 'Here comes another hungry one. Watch closely!',
      'The truck phone is ringing! Listen!', 'Quick look! Faster than a hot tortilla!', 'Taco rush! The line goes around the block!',
      'One of you has the ticket. Read it out loud, no peeking!', 'Listen to your head chef and fill those tacos!',
      'Now build it! From memory!', 'To the griddle! Go, go, go!', 'Three tacos, just like the order!',
      'Perfecto! That plate is a work of art!', 'Wow! The customer is dancing!',
      'Close! A little more salsa in your heart next time.', 'Not bad! They will still leave a tip.',
      'Ay, no! What happened to my tacos?', 'Oh dear. That customer is going to the burger joint.',
      'Last plate before the truck closes. Make it shine!', 'The grill is off! Gracias, my cooks. What a night!',
    ],
    sushi: [
      'Our first guest. Watch carefully. Every piece matters.',
      'Look closely. The wrap, the rice, the filling, every piece.', 'Breathe. Watch. Remember.', 'A new guest. Eyes on the board.',
      'A phone order. Listen with your whole heart.', 'A single glimpse. Like a falling leaf.', 'The conveyor is speeding up. Stay calm, move fast.',
      'One of you holds the ticket. Speak clearly. Do not show it.', 'Listen to your head chef. Then roll.',
      'Now, roll it. From memory.', 'To your boards. Precise and calm.', 'Eight pieces. Make every one count.',
      'Beautiful. Like a poem on a plate.', 'Perfect balance. The guest bows to you.',
      'Good. Not perfect. Tomorrow, better.', 'Close. The guest is pleased enough.',
      'Hmm. The fish is crying.', 'That roll has lost its way.',
      'Last order of the evening. Make it your finest.', 'The knives are clean. Thank you, my cooks. Well rolled.',
    ],
    burger: [
      'Order up! Here comes our first customer, folks!',
      'Watch that stack! Bottom to top, it all counts.', 'Eyes on the burger! What goes where?', 'Another hungry customer! Look sharp!',
      'Drive-thru speaker! Listen up!', 'Blink and that burger is gone!', 'Drive-thru rush! Flip it fast!',
      'One of you has the ticket. Holler it out, but keep that phone hidden!', 'Listen to your head chef and stack it up!',
      'Now build it! Bottom bun up!', 'Fire up the grill! Go, go, go!', 'Stack it just like the order, partner!',
      'Now that is a burger! Order up!', 'Hoo-wee! Best burger this side of the food court!',
      'Not bad! Maybe watch that stack a little closer.', 'Close enough! They are still munching.',
      'Whoa! That is not a burger, that is a sandwich mystery!', 'Yikes! That one fell apart before the table.',
      'Last call at the grill! Make it a big one!', 'Grill is off, lights are low. Great flipping tonight, cooks!',
    ],
    sundae: [
      'First customer! Ooh, look at that sundae!',
      'Watch it! The scoops go in order, bottom to top!', 'Eyes on the sundae! Cone, scoops, sauce, toppings!', 'Another sweet tooth! Look closely!',
      'Ring ring! A sundae order by phone! Listen!', 'Quick, before it melts!', 'Heat wave! Everybody wants ice cream right now!',
      'One of you has the ticket! Read it out, but no peeking!', 'Listen to your head chef and scoop it up!',
      'Now scoop it! From memory!', 'Grab your scoops! Go, go, go!', 'Make it just like the order, sweeties!',
      'Sweet perfection! Look at that smile!', 'Ooh, sprinkles of joy! Perfect!',
      'Pretty sweet! A little melty, but nice.', 'Close! They are still licking the spoon.',
      'Oh no, brain freeze! What is that?', 'Uh oh. That sundae melted all over the floor.',
      'Last scoop of the night! Make it magical!', 'The freezer is closed! Thanks, sweeties, you were cool!',
    ],
  };

  // ================= the opening =================
  const castOpening = [
    // The YesChef sign buzzes on over the food court and the stalls light up one by one.
    { ms: 3000, sfx: [[200, 'click'], [700, 'click'], [1300, 'swell']],
      draw(g, s) {
        const k = s.k, sign = k < 0.12 ? 0 : k < 0.22 ? (Math.sin(k * 260) > 0 ? 0.9 : 0.1) : k < 0.27 ? 0.3 : 1;
        s.cam(960, lerp(470, 520, ease(k)), lerp(1.12, 1.0, ease(k)));
        courtBack(g, s, { logo: sign, lights: 0.2 + 0.8 * ss(0.3, 0.6, k), lit: KEYS.map((_, i) => ss(0.35 + i * 0.1, 0.45 + i * 0.1, k)), owners: true });
        caption(g, s, 'THE YESCHEF FOOD COURT', ss(0.45, 0.65, k), 970, 72);
      } },
    // The camera runs past the stalls; the owners wave from their counters.
    { ms: 3000, sfx: [[0, 'whoosh']],
      draw(g, s) {
        const k = s.k, x = lerp(330, 1590, ease(k)), near = STALL_X.map((sx) => Math.abs(sx - x) < 260);
        s.cam(x, 560, 1.75);
        courtBack(g, s, { owners: true, wave: near });
        caption(g, s, k < 0.5 ? 'Five kitchens. Five owners.' : 'All of them want the best cooks in town.', 1 - Math.abs(k - 0.5) * 0.6, 980, 56);
      } },
    // Inside tonight's kitchen: its owner welcomes the cooks.
    { ms: 8000, sfx: [[0, 'join']], pose: [[400, 'wave', 1800]], say: 'welcome', sayAt: 300, fit: 7200,
      draw(g, s) {
        const k = s.k;
        if (pick(cur) === 'court') s.cam(960, lerp(700, 760, ease(k)), lerp(1.0, 1.35, ease(k)));
        else s.cam(960, lerp(560, 600, ease(k)), lerp(1.05, 1.4, ease(k)));
        stage(g, s, {});
      } },
  ];

  BOX.intros = BOX.intros || {};
  const I = BOX.intros.pizza = {
    title: 'YesChef',
    // The game tells the intro its kitchen (box/show.js: show.extra = game.showExtra()). Returns true when it changed.
    onShow(show) { const k = pick(show && show.extra && show.extra.kitchen); if (k === cur) return false; cur = k; return true; },
    variants: [...KEYS, 'court'].map((kitchen) => ({ kitchen })), // tools/voice-gen.js renders each one in its owner's voice
    get kitchen() { return cur; },
    get host() { return OWNERS[cur] || OWNERS.pizza; },
    get lines() { return LINES[cur] || LINES.court; },
    get tutorial() { return TUTORIAL[cur] || TUTORIAL.court; },
    get story() { return cur === 'court' ? [] : STORY[cur]; },
    get theme() { return cur === 'court' ? COURT_THEME : KIT[cur].theme; },
    owners: OWNERS, STORY, LINES, TUTORIAL, KITCHENS: KEYS,
    stage, logo, roll, pie, flames, backdrop, drawOwner, courtBack, taco, burger, scoop, cone, sushiPiece,
    podium() { /* no podium: the owner stands behind the counter */ },
    hostCam: { x: 960, y: 560, z: 1.5 },
    castOpening,
  };
  void I;
})();
