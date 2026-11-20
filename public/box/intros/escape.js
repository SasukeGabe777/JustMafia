'use strict';
// JustEscape intro: not a studio but Detective Hazel Finch's office, late at night. Rain runs
// down a tall window over the city, lightning flickers and the old neon sign in the window
// buzzes on. The camera pushes in on her case board: three photos (a clock, a steam train, a
// lighthouse) get linked by red string to a card with a magpie on it, and a magpie feather
// spins down. Then Hazel turns from the window and asks for help. In the roll call every
// player is pinned to the case board as a polaroid, their name on a strip of tape.
// Engine + API: public/box/show.js ('cast' mode). Hazel's in-game lines are listed in `story`
// (copied from box/games/escape-rooms.js) so tools/voice-gen.js pre-voices them too.
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, OUT, TAU } = ST.util, { rr, text } = ST.draw;
  const TYPE = '"Special Elite", "Courier New", monospace';
  const MARK = '"Permanent Marker", "Lilita One", sans-serif';
  const NEON_A = '"Pacifico", cursive', NEON_B = '"Abril Fatface", "Lilita One", serif';
  try { if (document.fonts) for (const f of ['40px "Special Elite"', '40px "Permanent Marker"', '40px "Pacifico"', '40px "Abril Fatface"']) document.fonts.load(f); } catch { /* fine */ }
  const R = rng(1947);
  const RED = '#c8102e', GOLD = '#e8b44a', CREAM = '#f4ead5', RAIN = '#7fb3d5';

  // ---- the set, fixed ----
  const WIN = { x: 600, y: 60, w: 720, h: 640 };
  const BOARD = { x: 1380, y: 100, w: 500, h: 500 };
  const PIC = { clock: [1490, 225, -0.07], train: [1770, 245, 0.06], light: [1630, 470, -0.03] };
  const MAG = [1632, 330];
  const DESK_Y = 790, HAZEL = [960, 812, 1.05];
  const towers = (() => { const a = []; let x = WIN.x - 10; while (x < WIN.x + WIN.w) { const w = 40 + R() * 80, h = 110 + R() * 260; const lit = []; for (let yy = 16; yy < h - 10; yy += 22) for (let xx = 8; xx < w - 10; xx += 16) if (R() < 0.22) lit.push([xx, yy, R()]); a.push([x, w, h, lit, R() < 0.3]); x += w + 4 + R() * 10; } return a; })();
  const rain = Array.from({ length: 140 }, () => [R() * 900 - 100, R() * 800, 18 + R() * 30, 900 + R() * 700]);
  const beads = Array.from({ length: 34 }, () => [WIN.x + 20 + R() * (WIN.w - 40), R() * WIN.h, 2 + R() * 4, 18 + R() * 50]);
  const cork = Array.from({ length: 260 }, () => [R(), R(), 1 + R() * 2.5, R()]);
  const flashAt = (t) => { const p = t % 9; return Math.max(0, 1 - Math.abs(p - 0.4) / 0.08) * 0.8 + Math.max(0, 1 - Math.abs(p - 0.62) / 0.06) * 0.5; };

  // ---- small props ----
  function pin(g, x, y, c = RED) {
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(x + 4, y + 5, 9, 0, TAU); g.fill();
    g.fillStyle = c; g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(x - 3, y - 3, 3, 0, TAU); g.fill();
  }
  function string(g, a, b, k, sag = 30) {
    if (k <= 0) return;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2 + sag;
    g.strokeStyle = RED; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(a[0], a[1]);
    const n = 24; for (let i = 1; i <= Math.ceil(n * Math.min(1, k)); i++) { const u = Math.min(i / n, k), x = (1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * mx + u * u * b[0], y = (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * my + u * u * b[1]; g.lineTo(x, y); }
    g.stroke();
  }
  // A polaroid centred on (x, y): white frame, the picture drawn by fn(g, w, h) in a clip.
  function polaroid(g, x, y, w, rot, fn, sc = 1) {
    const h = w * 1.18, ph = w * 0.86;
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
    g.fillStyle = 'rgba(0,0,0,0.38)'; g.fillRect(-w / 2 + 8, -h / 2 + 10, w, h);
    g.fillStyle = '#f3efe4'; g.fillRect(-w / 2, -h / 2, w, h); g.lineWidth = 3; g.strokeStyle = 'rgba(40,30,20,0.6)'; g.strokeRect(-w / 2, -h / 2, w, h);
    const px = -w / 2 + w * 0.07, py = -h / 2 + w * 0.07, pw = w * 0.86;
    g.save(); g.beginPath(); g.rect(px, py, pw, ph); g.clip(); g.translate(px, py); fn(g, pw, ph); g.restore();
    g.restore();
  }
  function picClock(g, w, h) {
    let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5a4128'); gr.addColorStop(1, '#2a1c10'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#6b3f1d'; g.fillRect(w * 0.3, h * 0.08, w * 0.4, h); g.lineWidth = 3; g.strokeStyle = '#1a0e06'; g.strokeRect(w * 0.3, h * 0.08, w * 0.4, h);
    g.beginPath(); g.arc(w / 2, h * 0.08, w * 0.2, Math.PI, TAU); g.fillStyle = '#6b3f1d'; g.fill(); g.stroke();
    g.fillStyle = '#f2e3c0'; g.beginPath(); g.arc(w / 2, h * 0.3, w * 0.16, 0, TAU); g.fill(); g.stroke();
    g.strokeStyle = '#1a0e06'; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * w * 0.12, h * 0.3 + Math.sin(a) * w * 0.12); g.lineTo(w / 2 + Math.cos(a) * w * 0.145, h * 0.3 + Math.sin(a) * w * 0.145); g.stroke(); }
    g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, h * 0.3); g.lineTo(w / 2 + w * 0.08, h * 0.3 - w * 0.05); g.moveTo(w / 2, h * 0.3); g.lineTo(w / 2 - w * 0.02, h * 0.3 - w * 0.12); g.stroke();
    g.fillStyle = '#2a1608'; g.fillRect(w * 0.38, h * 0.52, w * 0.24, h * 0.42); g.fillStyle = '#d4a73c'; g.beginPath(); g.moveTo(w / 2, h * 0.54); g.lineTo(w / 2 + w * 0.05, h * 0.78); g.stroke(); g.beginPath(); g.arc(w / 2 + w * 0.05, h * 0.8, w * 0.05, 0, TAU); g.fill();
    gr = g.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.8); gr.addColorStop(0, 'rgba(255,220,160,0)'); gr.addColorStop(1, 'rgba(40,20,0,0.5)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  function picTrain(g, w, h) {
    let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1b2a44'); gr.addColorStop(1, '#0c1220'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(244,234,213,0.85)'; g.beginPath(); g.arc(w * 0.78, h * 0.2, w * 0.07, 0, TAU); g.fill();
    g.fillStyle = 'rgba(220,225,235,0.55)'; for (const [x, y, r] of [[0.28, 0.32, 0.1], [0.38, 0.22, 0.13], [0.52, 0.14, 0.15]]) { g.beginPath(); g.arc(w * x, h * y, w * r, 0, TAU); g.fill(); }
    g.fillStyle = '#0a0a0f'; g.fillRect(0, h * 0.86, w, h * 0.14);
    g.fillStyle = '#151820'; g.fillRect(w * 0.12, h * 0.48, w * 0.5, h * 0.28); g.fillRect(w * 0.58, h * 0.36, w * 0.3, h * 0.4); g.fillRect(w * 0.22, h * 0.36, w * 0.1, h * 0.14);
    g.fillStyle = RED; g.fillRect(w * 0.12, h * 0.7, w * 0.76, h * 0.04);
    g.fillStyle = '#ffd98a'; g.fillRect(w * 0.64, h * 0.42, w * 0.16, h * 0.12);
    g.fillStyle = '#2a2f3a'; for (const x of [0.22, 0.38, 0.54, 0.74]) { g.beginPath(); g.arc(w * x, h * 0.8, w * 0.075, 0, TAU); g.fill(); g.strokeStyle = '#8a8f9a'; g.lineWidth = 2; g.stroke(); }
    gr = g.createRadialGradient(w * 0.08, h * 0.58, 2, w * 0.08, h * 0.58, w * 0.3); gr.addColorStop(0, 'rgba(255,230,150,0.9)'); gr.addColorStop(1, 'rgba(255,230,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  function picLight(g, w, h) {
    let gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a3346'); gr.addColorStop(1, '#141a26'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,230,140,0.4)'; g.beginPath(); g.moveTo(w * 0.5, h * 0.22); g.lineTo(-w * 0.1, h * 0.05); g.lineTo(-w * 0.1, h * 0.3); g.closePath(); g.fill(); g.beginPath(); g.moveTo(w * 0.5, h * 0.22); g.lineTo(w * 1.1, h * 0.1); g.lineTo(w * 1.1, h * 0.34); g.closePath(); g.fill();
    g.fillStyle = '#1a1f28'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.8); g.lineTo(w * 0.3, h * 0.74); g.lineTo(w * 0.7, h * 0.76); g.lineTo(w, h * 0.84); g.lineTo(w, h); g.fill();
    g.save(); g.beginPath(); g.moveTo(w * 0.42, h * 0.76); g.lineTo(w * 0.45, h * 0.28); g.lineTo(w * 0.55, h * 0.28); g.lineTo(w * 0.58, h * 0.76); g.closePath(); g.fillStyle = '#efe6d4'; g.fill(); g.clip();
    g.fillStyle = RED; for (const y of [0.36, 0.52, 0.66]) g.fillRect(0, h * y, w, h * 0.07); g.restore();
    g.fillStyle = '#ffe08a'; g.fillRect(w * 0.44, h * 0.18, w * 0.12, h * 0.1); g.fillStyle = '#15161c'; g.beginPath(); g.moveTo(w * 0.42, h * 0.18); g.lineTo(w * 0.5, h * 0.1); g.lineTo(w * 0.58, h * 0.18); g.fill();
    g.strokeStyle = 'rgba(180,210,235,0.7)'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); for (let x = 0; x <= w; x += 6) g.lineTo(x, h * (0.86 + i * 0.05) + Math.sin(x * 0.12 + i) * 3); g.stroke(); }
  }
  function magpie(g, x, y, s, rot = 0) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    g.fillStyle = '#111318';
    g.beginPath(); g.moveTo(10, 4); g.lineTo(64, 22); g.lineTo(62, 30); g.lineTo(8, 16); g.fill(); // tail
    g.beginPath(); g.ellipse(-6, 4, 26, 15, -0.15, 0, TAU); g.fill();
    g.beginPath(); g.arc(-30, -10, 11, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-40, -12); g.lineTo(-54, -8); g.lineTo(-40, -5); g.fill();
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(-10, 10, 13, 7, -0.2, 0, TAU); g.fill();
    g.fillStyle = '#2d5f8a'; g.beginPath(); g.ellipse(4, 0, 15, 6, -0.2, 0, TAU); g.fill();
    g.strokeStyle = '#111318'; g.lineWidth = 3; g.beginPath(); g.moveTo(-8, 18); g.lineTo(-10, 30); g.moveTo(0, 18); g.lineTo(2, 30); g.stroke();
    g.fillStyle = GOLD; g.beginPath(); g.arc(-33, -12, 2.5, 0, TAU); g.fill();
    g.restore();
  }
  // A magpie tail feather: glossy blue-green-black with a white base.
  function feather(g, x, y, len, rot) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len * 0.12, -len * 0.16, len * 0.75, -len * 0.14, len, -len * 0.02); g.bezierCurveTo(len * 0.75, len * 0.08, len * 0.15, len * 0.1, 0, 0); g.closePath();
    const gr = g.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, '#f4f1ea'); gr.addColorStop(0.22, '#f4f1ea'); gr.addColorStop(0.28, '#0d1016'); gr.addColorStop(0.55, '#1d4f5c'); gr.addColorStop(0.75, '#2c2a6a'); gr.addColorStop(1, '#0d1016');
    g.fillStyle = gr; g.fill(); g.lineWidth = Math.max(2, len * 0.02); g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = Math.max(1, len * 0.012); g.beginPath(); g.moveTo(-len * 0.08, len * 0.01); g.quadraticCurveTo(len * 0.5, -len * 0.04, len * 0.98, -len * 0.02); g.stroke();
    g.restore();
  }

  // ---- the room ----
  function windowView(g, s, o) {
    const t = s.t, fl = o.flash || 0;
    g.save(); g.beginPath(); g.rect(WIN.x, WIN.y, WIN.w, WIN.h); g.clip();
    let gr = g.createLinearGradient(0, WIN.y, 0, WIN.y + WIN.h); gr.addColorStop(0, '#070b18'); gr.addColorStop(0.7, '#1a2440'); gr.addColorStop(1, '#2c3150'); g.fillStyle = gr; g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    if (fl > 0) { // the lightning bolt and the sky lighting up behind the towers
      g.fillStyle = `rgba(190,215,255,${fl * 0.75})`; g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
      g.strokeStyle = `rgba(255,255,255,${fl})`; g.lineWidth = 5; g.beginPath(); let bx = WIN.x + WIN.w * 0.7, by = WIN.y; g.moveTo(bx, by);
      const r2 = rng(Math.floor(t * 0.11) + 3); while (by < WIN.y + 330) { bx += (r2() - 0.5) * 70; by += 30 + r2() * 30; g.lineTo(bx, by); } g.stroke();
    }
    for (const [x, w, h, lit, ant] of towers) {
      const top = WIN.y + WIN.h - h;
      g.fillStyle = fl > 0.3 ? '#0a0d16' : '#11162a'; g.fillRect(x, top, w, h + 4);
      if (ant) { g.fillRect(x + w / 2 - 2, top - 40, 4, 40); g.fillStyle = `rgba(255,60,60,${0.5 + 0.5 * Math.sin(t * 3 + x)})`; g.beginPath(); g.arc(x + w / 2, top - 42, 4, 0, TAU); g.fill(); }
      for (const [xx, yy, p] of lit) { g.fillStyle = p < 0.15 ? 'rgba(127,179,213,0.8)' : `rgba(255,214,130,${0.55 + 0.35 * Math.sin(t * 0.3 + p * 20)})`; g.fillRect(x + xx, top + yy, 8, 11); }
    }
    g.strokeStyle = 'rgba(170,200,230,0.32)'; g.lineWidth = 2; g.beginPath();
    for (const [x0, y0, len, v] of rain) { const y = WIN.y + ((y0 + t * v) % 800) - 60, x = WIN.x + x0 + (y - WIN.y) * 0.18; g.moveTo(x, y); g.lineTo(x + len * 0.18, y + len); }
    g.stroke();
    for (const [x, y0, r, v] of beads) { const y = WIN.y + ((y0 + t * v) % WIN.h); g.fillStyle = 'rgba(200,225,245,0.35)'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = 'rgba(200,225,245,0.12)'; g.fillRect(x - r * 0.4, y - 60, r * 0.8, 60); }
    gr = g.createLinearGradient(WIN.x, 0, WIN.x + WIN.w, 0); gr.addColorStop(0, 'rgba(127,179,213,0.06)'); gr.addColorStop(0.5, 'rgba(127,179,213,0)'); gr.addColorStop(1, 'rgba(127,179,213,0.08)'); g.fillStyle = gr; g.fillRect(WIN.x, WIN.y, WIN.w, WIN.h);
    g.restore();
    // frame, mullions and half-raised blinds
    g.fillStyle = '#16100c'; for (let y = WIN.y; y < WIN.y + 96; y += 12) { g.fillRect(WIN.x, y, WIN.w, 8); }
    g.strokeStyle = '#2a1d14'; g.lineWidth = 16; g.beginPath(); g.moveTo(WIN.x + WIN.w / 2, WIN.y); g.lineTo(WIN.x + WIN.w / 2, WIN.y + WIN.h); g.moveTo(WIN.x, WIN.y + 330); g.lineTo(WIN.x + WIN.w, WIN.y + 330); g.stroke();
    g.lineWidth = 30; g.strokeStyle = '#2a1d14'; g.strokeRect(WIN.x - 6, WIN.y - 6, WIN.w + 12, WIN.h + 12); g.lineWidth = 4; g.strokeStyle = OUT; g.strokeRect(WIN.x - 21, WIN.y - 21, WIN.w + 42, WIN.h + 42);
    g.fillStyle = '#3a2a1c'; g.fillRect(WIN.x - 40, WIN.y + WIN.h + 6, WIN.w + 80, 22);
  }
  function door(g) {
    g.fillStyle = '#2a1d14'; g.fillRect(70, 120, 360, 760); g.lineWidth = 4; g.strokeStyle = OUT; g.strokeRect(70, 120, 360, 760);
    g.fillStyle = '#3b2a1c'; g.fillRect(100, 150, 300, 700);
    const gr = g.createLinearGradient(0, 170, 0, 470); gr.addColorStop(0, '#9aa7b4'); gr.addColorStop(1, '#6b7684'); g.fillStyle = gr; g.fillRect(124, 172, 252, 300);
    g.fillStyle = 'rgba(255,255,255,0.08)'; for (let i = 0; i < 40; i++) g.fillRect(124 + ((i * 53) % 252), 172 + ((i * 97) % 300), 3, 3);
    g.save(); g.translate(250, 0); g.scale(-1, 1); // lettering painted on the outside, read backwards
    text(g, 'HAZEL FINCH', 0, 290, 34, 'rgba(20,20,26,0.75)', { font: TYPE, max: 220 });
    text(g, 'DETECTIVE', 0, 340, 26, 'rgba(20,20,26,0.65)', { font: TYPE, max: 220 }); g.restore();
    g.fillStyle = GOLD; g.beginPath(); g.arc(380, 560, 12, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
  }
  function board(g, s, o) {
    const { x, y, w, h } = BOARD;
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x + 12, y + 16, w, h);
    g.fillStyle = '#4a2f18'; g.fillRect(x - 18, y - 18, w + 36, h + 36); g.lineWidth = 4; g.strokeStyle = OUT; g.strokeRect(x - 18, y - 18, w + 36, h + 36);
    g.fillStyle = '#b88a55'; g.fillRect(x, y, w, h);
    for (const [u, v, r, c] of cork) { g.fillStyle = c < 0.5 ? 'rgba(90,55,25,0.35)' : 'rgba(240,200,150,0.3)'; g.fillRect(x + u * w, y + v * h, r, r); }
    // notes and a map scrap for texture
    g.save(); g.translate(x + 70, y + 410); g.rotate(0.08); g.fillStyle = '#efe3b0'; g.fillRect(-46, -36, 92, 72); g.strokeStyle = 'rgba(60,60,90,0.5)'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-36, -18 + i * 14); g.lineTo(30 - i * 6, -18 + i * 14); g.stroke(); } g.restore(); pin(g, x + 70, y + 380, '#2d5f8a');
    g.save(); g.translate(x + 430, y + 420); g.rotate(-0.1); g.fillStyle = '#d9cfb8'; g.fillRect(-50, -44, 100, 88); g.strokeStyle = 'rgba(120,80,40,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-40, 30); g.lineTo(-10, -10); g.lineTo(20, 10); g.lineTo(38, -30); g.stroke(); g.setLineDash([4, 4]); g.beginPath(); g.moveTo(-40, -30); g.lineTo(30, 30); g.stroke(); g.setLineDash([]); g.restore(); pin(g, x + 430, y + 384, GOLD);
    // the magpie card in the middle
    g.save(); g.translate(MAG[0], MAG[1]); g.rotate(0.03); g.fillStyle = '#f6f1e2'; g.fillRect(-70, -48, 140, 96); g.fillStyle = 'rgba(200,16,46,0.4)'; g.fillRect(-70, -32, 140, 2); g.restore();
    magpie(g, MAG[0] - 8, MAG[1] + 8, 1.05);
    text(g, '?', MAG[0] + 48, MAG[1] - 12, 44, RED, { font: MARK });
    // the three rooms of the case
    const k = o.string == null ? 1 : o.string;
    polaroid(g, ...PIC.clock.slice(0, 2), 150, PIC.clock[2], picClock);
    polaroid(g, ...PIC.train.slice(0, 2), 150, PIC.train[2], picTrain);
    polaroid(g, ...PIC.light.slice(0, 2), 150, PIC.light[2], picLight);
    const pc = [PIC.clock[0], PIC.clock[1] - 80], pt = [PIC.train[0], PIC.train[1] - 80], pl = [PIC.light[0], PIC.light[1] - 80], pm = [MAG[0], MAG[1] - 42];
    string(g, pc, pm, k * 3, 26); string(g, pm, pt, k * 3 - 1, 26); string(g, pm, pl, k * 3 - 2, 10);
    for (const p of [pc, pt, pl, pm]) pin(g, p[0], p[1]);
  }
  // Hazel from behind (looking out of the window), for the turn in the opening.
  function backView(g) {
    const coat = '#6e5028';
    g.beginPath(); g.moveTo(-98, -192); g.quadraticCurveTo(-118, -100, -84, 8); g.lineTo(84, 8); g.quadraticCurveTo(118, -100, 98, -192); g.quadraticCurveTo(0, -226, -98, -192); g.closePath();
    g.fillStyle = coat; g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, -200); g.lineTo(0, 6); g.stroke();
    g.fillStyle = '#5a4428'; g.fillRect(-100, -70, 200, 20);
    for (const sd of [-1, 1]) { g.strokeStyle = OUT; g.lineCap = 'round'; g.lineWidth = 44; g.beginPath(); g.moveTo(sd * 88, -186); g.lineTo(sd * 104, -96); g.lineTo(sd * 92, -14); g.stroke(); g.strokeStyle = coat; g.lineWidth = 35; g.stroke(); }
    g.fillStyle = '#5a4428'; g.beginPath(); g.moveTo(-60, -200); g.lineTo(0, -250); g.lineTo(60, -200); g.lineTo(0, -186); g.closePath(); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#20140c'; g.beginPath(); g.ellipse(0, -296, 64, 70, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#23222b'; g.beginPath(); g.ellipse(0, -336, 112, 22, 0, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(-60, -340); g.bezierCurveTo(-66, -392, -52, -416, -24, -411); g.quadraticCurveTo(0, -396, 24, -411); g.bezierCurveTo(52, -416, 66, -392, 60, -340); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = RED; g.fillRect(-61, -362, 122, 14);
  }
  function hazel(g, s, o) {
    const [x, y, sc] = HAZEL, turn = o.turn == null ? 1 : o.turn;
    if (turn >= 1) { s.host(x, y, sc); return; }
    const sx = Math.abs(Math.cos(turn * Math.PI));
    g.save(); g.translate(x, y); g.scale(sc * Math.max(0.04, sx), sc);
    if (turn < 0.5) backView(g); else { g.restore(); g.save(); g.translate(x, y); g.scale(Math.max(0.04, sx), 1); g.translate(-x, -y); s.host(x, y, sc); }
    g.restore();
  }
  function desk(g, s) {
    // the desk top, front panel and drawers
    g.fillStyle = '#3a2516'; g.beginPath(); g.moveTo(320, DESK_Y); g.lineTo(1600, DESK_Y); g.lineTo(1660, DESK_Y + 60); g.lineTo(260, DESK_Y + 60); g.closePath(); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    const gr = g.createLinearGradient(0, DESK_Y + 60, 0, 1150); gr.addColorStop(0, '#4a2f1b'); gr.addColorStop(1, '#1c120a'); g.fillStyle = gr; g.fillRect(260, DESK_Y + 60, 1400, 400); g.strokeRect(260, DESK_Y + 60, 1400, 400);
    g.fillStyle = '#2b1b10'; g.fillRect(250, DESK_Y + 56, 1420, 14);
    for (const dx of [300, 1340]) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4; for (let i = 0; i < 2; i++) g.strokeRect(dx, DESK_Y + 90 + i * 90, 280, 76); g.fillStyle = GOLD; for (let i = 0; i < 2; i++) { g.beginPath(); g.arc(dx + 140, DESK_Y + 128 + i * 90, 8, 0, TAU); g.fill(); } }
    // case files, a cup, the magnifying glass and the feather
    g.save(); g.translate(720, DESK_Y + 30); g.rotate(-0.05); g.fillStyle = '#c9a66b'; g.fillRect(-110, -20, 220, 44); g.fillStyle = '#b8945a'; g.fillRect(-100, -30, 200, 40); g.fillStyle = RED; g.fillRect(40, -30, 30, 40); g.restore();
    g.fillStyle = '#e8e1d0'; rr(g, 580, DESK_Y - 30, 50, 56, 8); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); g.beginPath(); g.arc(634, DESK_Y - 4, 14, -1.2, 1.2); g.stroke();
    g.strokeStyle = 'rgba(220,220,220,0.35)'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 2; i++) { g.moveTo(595 + i * 18, DESK_Y - 40); g.bezierCurveTo(585 + i * 18, DESK_Y - 70 - Math.sin(s.t * 2 + i) * 6, 610 + i * 18, DESK_Y - 90, 600 + i * 18, DESK_Y - 120); } g.stroke();
    g.save(); g.translate(1230, DESK_Y + 28); g.rotate(-0.4); g.fillStyle = '#5a3418'; rr(g, 40, -8, 90, 16, 8); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(); g.fillStyle = 'rgba(180,215,240,0.35)'; g.beginPath(); g.arc(0, 0, 40, 0, TAU); g.fill(); g.strokeStyle = GOLD; g.lineWidth = 9; g.stroke(); g.restore();
    feather(g, 1070, DESK_Y + 36, 130, -0.08);
  }
  function lamps(g, s, o) {
    const lit = o.lights == null ? 1 : o.lights;
    // the brass desk lamp (left) and the green banker's lamp (right)
    g.strokeStyle = '#8a6a2c'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(450, DESK_Y + 20); g.lineTo(430, DESK_Y - 160); g.lineTo(520, DESK_Y - 240); g.stroke();
    g.fillStyle = '#6b5020'; rr(g, 400, DESK_Y + 6, 100, 26, 10); g.fill();
    g.save(); g.translate(540, DESK_Y - 238); g.rotate(0.5); g.fillStyle = '#b08a3a'; g.beginPath(); g.moveTo(-30, -20); g.lineTo(30, -20); g.lineTo(60, 40); g.lineTo(-60, 40); g.closePath(); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = `rgba(255,236,190,${0.3 + 0.7 * lit})`; g.beginPath(); g.ellipse(0, 40, 58, 10, 0, 0, TAU); g.fill(); g.restore();
    g.fillStyle = '#b08a3a'; g.fillRect(1440, DESK_Y - 70, 10, 90); rr(g, 1395, DESK_Y + 8, 100, 22, 10); g.fill();
    g.fillStyle = '#1f6b3e'; g.beginPath(); g.moveTo(1360, DESK_Y - 60); g.quadraticCurveTo(1445, DESK_Y - 120, 1530, DESK_Y - 60); g.closePath(); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = 'rgba(160,255,190,0.35)'; g.beginPath(); g.ellipse(1420, DESK_Y - 82, 30, 7, -0.3, 0, TAU); g.fill();
    g.fillStyle = `rgba(255,236,190,${0.3 + 0.7 * lit})`; g.fillRect(1370, DESK_Y - 62, 150, 5);
    if (lit <= 0) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    let gr = g.createRadialGradient(600, DESK_Y + 20, 20, 600, DESK_Y + 20, 520); gr.addColorStop(0, `rgba(255,190,100,${0.32 * lit})`); gr.addColorStop(1, 'rgba(255,190,100,0)'); g.fillStyle = gr; g.fillRect(0, 200, 1300, 900);
    gr = g.createRadialGradient(1445, DESK_Y + 10, 10, 1445, DESK_Y + 10, 300); gr.addColorStop(0, `rgba(170,255,160,${0.18 * lit})`); gr.addColorStop(1, 'rgba(170,255,160,0)'); g.fillStyle = gr; g.fillRect(1100, 500, 700, 600);
    gr = g.createRadialGradient(960, 620, 40, 960, 620, 700); gr.addColorStop(0, `rgba(255,200,120,${0.12 * lit})`); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(200, 0, 1520, 1100);
    g.restore();
  }
  // The neon sign in the window: "Just" in gold script, "Escape" in red, on a dark plate.
  function logo(g, s, lit) {
    lit = Math.max(0, Math.min(1, lit));
    g.strokeStyle = '#3a3a44'; g.lineWidth = 5; g.beginPath(); g.moveTo(-250, -110); g.lineTo(-230, -200); g.moveTo(250, -110); g.lineTo(230, -200); g.stroke();
    rr(g, -340, -110, 680, 220, 24); g.fillStyle = 'rgba(12,10,16,0.92)'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#3a3a44'; g.stroke();
    const tube = (str, x, y, px, font, col) => {
      g.font = `${px}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineJoin = 'round'; g.lineWidth = 6; g.strokeStyle = 'rgba(80,80,90,0.7)'; g.strokeText(str, x, y);
      if (lit > 0) { g.save(); g.globalAlpha = lit; g.shadowColor = col; g.shadowBlur = 34; g.strokeStyle = col; g.lineWidth = 7; g.strokeText(str, x, y); g.shadowBlur = 14; g.fillStyle = '#fff6e6'; g.fillText(str, x, y); g.restore(); }
    };
    tube('Just', -170, -6, 96, NEON_A, GOLD);
    tube('Escape', 105, 8, 108, NEON_B, '#ff3048');
  }
  function stage(g, s, o = {}) {
    const fl = o.flash != null ? o.flash : flashAt(s.t);
    let gr = g.createLinearGradient(0, -300, 0, 1000); gr.addColorStop(0, '#141a26'); gr.addColorStop(1, '#0d1018'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    g.fillStyle = 'rgba(255,255,255,0.025)'; for (let x = -600; x < 2520; x += 46) g.fillRect(x, -300, 18, 1700); // striped wallpaper
    g.fillStyle = '#1c140e'; g.fillRect(-600, 760, 3120, 400);
    door(g);
    windowView(g, s, { flash: fl });
    if (o.logo) { g.save(); g.translate(960, 210); g.scale(0.62, 0.62); logo(g, s, o.logo); g.restore(); }
    // window light on the wall and a lightning wash over the room
    g.fillStyle = `rgba(127,179,213,${0.05 + fl * 0.18})`; g.beginPath(); g.moveTo(WIN.x, WIN.y + WIN.h + 30); g.lineTo(WIN.x + WIN.w, WIN.y + WIN.h + 30); g.lineTo(WIN.x + WIN.w + 260, 1100); g.lineTo(WIN.x + 160, 1100); g.fill();
    board(g, s, o);
    if (o.host !== false) hazel(g, s, o);
    desk(g, s);
    if (o.extra) o.extra(g, s);
    lamps(g, s, o);
    const lit = o.lights == null ? 1 : o.lights;
    if (lit < 1) { g.fillStyle = `rgba(4,6,12,${(1 - lit) * 0.7})`; g.fillRect(-600, -300, 3120, 1700); }
    if (fl > 0) { g.fillStyle = `rgba(200,225,255,${fl * 0.22})`; g.fillRect(-600, -300, 3120, 1700); }
    const v = g.createRadialGradient(960, 540, 500, 960, 540, 1300); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = v; g.fillRect(-600, -300, 3120, 1700);
  }

  // ---- the roll call: partners pinned to the case board ----
  function roll(g, s, F, u, per, o) {
    const n = F.length;
    s.cam(960, 540, 1);
    g.fillStyle = '#b88a55'; g.fillRect(-600, -300, 3120, 1700);
    for (const [a, b, r, c] of cork) for (let q = 0; q < 3; q++) { g.fillStyle = c < 0.5 ? 'rgba(90,55,25,0.35)' : 'rgba(240,200,150,0.3)'; g.fillRect(((a + q * 0.37) % 1) * 1920, ((b + q * 0.61) % 1) * 1080, r * 1.6, r * 1.6); }
    g.fillStyle = '#4a2f18'; g.fillRect(-600, -300, 3120, 330); g.fillRect(-600, 1050, 3120, 400);
    g.save(); g.translate(960, 105); g.rotate(-0.012); g.fillStyle = '#f3ecd9'; g.fillRect(-520, -48, 1040, 96); g.restore();
    text(g, 'NEW PARTNERS ON THE CASE', 960, 108, 58, '#1d1a22', { font: TYPE, max: 980 });
    pin(g, 470, 72); pin(g, 1450, 72);
    const cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), tw = Math.min(290, 1700 / Math.max(1, cols)), pw = Math.min(220, tw * 0.8);
    const pos = F.map((c, i) => { const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols; return [960 + (col - (rowN - 1) / 2) * tw, (rows > 1 ? 380 : 560) + row * 360]; });
    // red string from partner to partner as they are pinned
    for (let i = 1; i < n; i++) { const k = (u - i * per - 300) / 400; if (k > 0) string(g, [pos[i - 1][0], pos[i - 1][1] - pw * 0.55], [pos[i][0], pos[i][1] - pw * 0.55], Math.min(1, k), 40); }
    F.forEach((c, i) => {
      const k = (u - i * per) / 420; if (k <= 0) return;
      const [x, y] = pos[i], e = easeOut(Math.min(1, k)), rot = ((i * 37) % 9 - 4) * 0.018, sc = lerp(1.4, 1, e);
      g.save(); g.globalAlpha = Math.min(1, k * 2.5);
      polaroid(g, x, y, pw, rot, (g2, w, h) => {
        const gr = g2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, c.color || '#3a4a66'); gr.addColorStop(1, '#141824'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
        s.face(c, w / 2, h * 0.52, h * 0.62);
        g2.fillStyle = 'rgba(255,240,210,0.12)'; g2.fillRect(0, 0, w, h);
      }, sc);
      g.restore();
      if (k >= 1) {
        pin(g, x, y - pw * 0.55);
        const tk = easeOut(Math.min(1, (k - 1) * 3));
        g.save(); g.translate(x, y + pw * 0.66); g.rotate(-rot * 1.5); g.globalAlpha = tk;
        g.fillStyle = 'rgba(236,222,180,0.92)'; g.fillRect(-pw * 0.55, -26, pw * 1.1, 52);
        text(g, c.name, 0, 2, 34, '#1d1a22', { font: MARK, max: pw });
        g.restore();
      }
    });
    if (o.more && u > n * per - 1200) { g.save(); g.translate(960, 1010); g.rotate(0.01); g.fillStyle = '#f3ecd9'; g.fillRect(-420, -34, 840, 68); g.restore(); text(g, '…and ' + o.more + ' more partners on the case', 960, 1012, 40, '#1d1a22', { font: TYPE, max: 800 }); }
  }

  // Hazel Finch: a long tan trench coat, a dark hat with a red band, round gold glasses,
  // a crimson scarf-tie and her case cards.
  const look = { skin: '#7a4a2e', skinShade: '#5e3620', suit: '#b08850', suit2: '#6e5028', sleeve: '#a07a44', lapel: '#8a6a3a', shirt: '#f4ead5', cuff: '#6e5028', tie: 'long', tieColor: RED, hair: 'curly', hairColor: '#20140c', brow: '#20140c', hat: '#2b2a33', hatBand: RED, glasses: GOLD, prop: 'cards', grin: false };

  BOX.intros = BOX.intros || {};
  BOX.intros.escape = {
    title: 'JustEscape',
    // How to play (box/howto.js): one card per step (module howSteps = 6). Hazel explains it.
    tutorial: [
      { icon: '📱', title: 'Every phone is different', text: 'Each phone holds a different piece of evidence (a journal, a photograph, a map) or the controls of a lock.', phone: 'Look at your phone: it shows your evidence, or the lock you control.', say: 'Look at your phones. Each of you is holding something different: a journal, a photograph, a map, or the controls of a lock.' },
      { icon: '🗣️', title: 'Read it out loud', text: 'Nobody can open a lock alone. Read your evidence out loud and listen to the others.', phone: 'Read your evidence out loud. The others need it!', say: 'Nobody can open a lock alone. Read your evidence out loud, and listen to each other. That is how detectives work.' },
      { icon: '🔐', title: 'Work the lock', text: 'Whoever holds the controls enters the answer: a keypad, clock hands, switches, a letter lock, or a lantern led through a dark maze by the map holder’s directions.', phone: 'Holding the controls? Enter what the others tell you, then tap to try it.', say: 'Whoever holds the controls enters the answer. A keypad, clock hands, switches, a letter lock, or a lantern in a dark cellar, guided by whoever holds the map.' },
      { icon: '🔎', title: 'Ask Hazel', text: 'Stuck? Ask Hazel for a hint. It costs the team a few points.', phone: 'Tap 🔎 Hint when you are stuck. It costs the team a little.', say: 'If you are stuck, ask me for a hint. It will cost the team a little, but I am always glad to help.' },
      { icon: '🫵', title: 'Catch the culprit', text: 'When every lock is open, everyone reads out their clues and votes for the culprit from the line-up. A wrong accusation costs a minute.', phone: 'Read your clues, then vote for the culprit.', say: 'When every lock is open, read out your clues and point to the culprit. Choose carefully. A wrong accusation costs us a minute.' },
      { icon: '🏅', title: 'Scoring', text: 'Clear the room with time left for team points. You also score for every lock you helped open, and for catching the culprit.', say: 'Clear the room with time to spare for team points. You also score for every lock you help open, and for catching the culprit.' },
    ],
    // Every line Hazel says during the game, copied character for character from
    // box/games/escape-rooms.js (ROOMS[].intro / solved / failed / epilogue, then LINES).
    story: [
      "Thank goodness you came. I am Detective Hazel Finch. My old friend Elias Vane, the clockmaker, has vanished, and his study was locked from the inside. His Golden Gear is gone too. Each of you is holding a different piece of the evidence. Talk to each other, open every lock, and tell me who did it.",
      "Splendid work! A magpie feather, tucked inside the clock. Our thief works for someone called the Magpie, and here is a ticket for the Midnight Express.",
      "Time is up! I picked the last lock myself. We found the culprit, but the Magpie’s trail went cold for a while.",
      "The Golden Gear is back where it belongs, and Elias was hiding safe in the clock tower all along. But the Magpie is still out there. Case closed, for tonight.",
      "All aboard the Midnight Express. The Magpie’s crew struck again: the Duchess’s blue diamond was swapped for glass somewhere in Car Seven. The train reaches the border at dawn. Search the carriage, open every lock, and find the swapper before we arrive.",
      "The real diamond! And a lighthouse key, stamped Gull Point. The Magpie is hiding by the sea.",
      "We are pulling into the station! I cracked the last lock just in time, but the Magpie’s crew got a head start.",
      "The diamond is back with the Duchess, and the swapper is in handcuffs. The Magpie slipped off at the last station, though. Another night, my friends.",
      "Gull Point lighthouse. The storm is rolling in, and the Magpie is somewhere inside with everything they ever stole. This is the hardest lock of my career, and I cannot open it alone. Light the lamp, open the vault, and unmask the Magpie at last.",
      "The lamp is lit and the vault is open! Every stolen treasure, right here.",
      "The storm hit and I forced the vault myself. We caught the Magpie, but only just. Next time, let us be quicker.",
      "The Magpie is caught at last, the treasures go home, and Elias wants to build you all a clock. Case closed. You are the finest detectives I have ever worked with.",
      "The clock is ticking. Read your evidence out loud, and listen to each other.",
      "Click! That lock is open.",
      "Hmm, that is not it. Check the evidence again.",
      "Every lock is open. Now, who did it? Share your clues and point to the culprit.",
      "No. The evidence does not fit that person. Look again, carefully.",
      "Got them! Well spotted, detectives.",
      "A hint, from one detective to another.",
      "Half the time is gone. Keep going!",
      "One minute left!",
      "Case closed.",
    ],
    theme: { accent: GOLD, accent2: RED, accent3: RAIN, ink: CREAM, panel: 'rgba(14,16,26,0.9)', fade: '#0b0d14', confetti: [GOLD, RED, CREAM, RAIN, '#2d5f8a'] },
    host: {
      name: 'Hazel Finch',
      voice: { kokoro: 'bf_alice', cb: 'calm', orpheus: 'leah', speed: 1.0, like: /female|libby|sonia|hazel|serena|zira/i, accent: /en-GB|en-US/i, pitch: 1, rate: 1 },
      look,
    },
    lines: {
      welcome: 'Thank goodness you’re here. I’m Hazel Finch, and I have a case I can’t crack alone.',
      roll: 'Let me see my new partners.',
      more: '…and {n} more partners on the case.',
      others: 'And the rest of you: keep your eyes open.',
      play: 'Grab your evidence. The clock is ticking.',
    },
    stage, logo, roll, feather, magpie,
    podium() { /* no podium: Hazel stands behind her desk */ },
    hostCam: { x: 960, y: 560, z: 1.6 },
    castOpening: [
      // Rain on the window, lightning, and the old neon sign buzzing on.
      { ms: 2600, sfx: [[200, 'thunder'], [1200, 'click']],
        draw(g, s) {
          const k = s.k, fl = Math.max(0, 1 - Math.abs(k - 0.1) / 0.05) + Math.max(0, 1 - Math.abs(k - 0.2) / 0.04) * 0.6;
          const sign = k < 0.42 ? 0 : k < 0.5 ? (Math.sin(k * 300) > 0 ? 0.8 : 0.1) : k < 0.56 ? 0.25 : 1;
          s.cam(960, lerp(300, 360, ease(k)), lerp(2.1, 1.6, ease(k)));
          stage(g, s, { host: false, flash: fl, logo: sign, lights: 0.25 + 0.4 * ss(0.6, 1, k) });
        } },
      // A push-in on the case board: red string links the three rooms, a feather spins down.
      { ms: 3000, sfx: [[100, 'whoosh'], [1500, 'swell']],
        draw(g, s) {
          const k = s.k;
          s.cam(lerp(1500, 1630, ease(k)), lerp(380, 360, ease(k)), lerp(1.3, 1.85, ease(k)));
          stage(g, s, { host: false, string: ss(0.08, 0.7, k), lights: 0.85, extra: null });
          const f = ss(0.3, 1, k); if (f > 0) { g.save(); g.globalAlpha = Math.min(1, f * 4); feather(g, 1640 + Math.sin(k * 14) * 60, lerp(120, 560, f), 110, Math.sin(k * 9) * 1.2 + k * 3); g.restore(); }
        } },
      // Hazel turns from the window and asks for help.
      { ms: 2900, sfx: [[0, 'whoosh']], pose: [[700, 'wave', 1300]], say: 'welcome', sayAt: 450, fit: 4200,
        draw(g, s) {
          const k = s.k, turn = ss(0.05, 0.22, k);
          s.cam(960, lerp(470, 560, ease(k)), lerp(1.75, 1.2, ease(k)));
          stage(g, s, { turn, lights: 0.7 + 0.3 * ss(0, 0.3, k) });
        } },
    ],
  };
})();
