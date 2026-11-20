'use strict';
// JustRaiseDucks art, all original and drawn in code: the duck (colors, hats, poses),
// Duck Valley (one farm per player, buildings and decorations, ducks doing what their
// owner is doing) and the side-scrolling race course (track, pond, cliff, ravine).
(function () {
  const PAL = {
    sunny: ['#ffd23f', '#f2b705', '#ffd23f'], snow: ['#f7f7f2', '#d9d9cf', '#f7f7f2'], cocoa: ['#a8774d', '#7a4f2f', '#a8774d'],
    mallard: ['#b59a78', '#8a6d4b', '#1f8a55'], bubblegum: ['#ff9dcf', '#e86aa8', '#ff9dcf'], sky: ['#8fd1ff', '#4fa6e8', '#8fd1ff'],
    midnight: ['#4a4f86', '#2f3363', '#4a4f86'], mint: ['#9ff3cd', '#5fd3a0', '#9ff3cd'], ember: ['#ff8a5b', '#e0603a', '#ff8a5b'], lilac: ['#c9a7ff', '#a07ce8', '#c9a7ff'],
  };
  const TAU = Math.PI * 2;
  const hash = (n) => { let h = (n + 1) * 2654435761; h ^= h >>> 15; return (h >>> 0) / 4294967296; };

  // ---------- the duck ----------
  function drawDuck(g, x, y, s, color, hat, t = 0, mode = 'stand', flip = false, stage = 2) {
    const [body, wing, head] = PAL[color] || PAL.sunny;
    g.save(); g.translate(x, y);
    if (stage >= 3) { const gl = g.createRadialGradient(0, -4, 4, 0, -4, 34 * s); gl.addColorStop(0, 'rgba(255,215,64,.45)'); gl.addColorStop(1, 'rgba(255,215,64,0)'); g.fillStyle = gl; g.beginPath(); g.arc(0, -4, 34 * s, 0, TAU); g.fill(); }
    const ss = s * (stage <= 0 ? 0.62 : stage === 1 ? 0.82 : 1);
    g.scale(flip ? -ss : ss, ss);
    const bob = mode === 'swim' ? Math.sin(t * 6) * 1.2 : mode === 'run' ? -Math.abs(Math.sin(t * 14)) * 2.5 : mode === 'fly' ? Math.sin(t * 5) * 2 : mode === 'peck' ? 0 : mode === 'sleep' ? 2 : 0;
    g.translate(0, bob);
    if (mode === 'climb') g.rotate(-0.9);
    if (mode === 'sleep') g.rotate(0.12);
    if (mode !== 'swim' && mode !== 'fly' && mode !== 'sleep') { // legs
      g.strokeStyle = '#f08a24'; g.lineWidth = 2.5; g.lineCap = 'round';
      const k = mode === 'run' || mode === 'climb' ? Math.sin(t * 14) * 5 : 0;
      for (const [dx, sw] of [[-4, k], [3, -k]]) { g.beginPath(); g.moveTo(dx, 9); g.lineTo(dx + sw, 18); g.lineTo(dx + sw + 5, 18); g.stroke(); }
    }
    if (mode === 'fly' || mode === 'swim') { g.fillStyle = 'rgba(0,0,0,0)'; }
    g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 18, 12, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-15, -4); g.lineTo(-24, -9); g.lineTo(-17, 4); g.fill();
    const peck = mode === 'peck' ? Math.max(0, Math.sin(t * 9)) * 9 : 0;
    g.save(); g.translate(0, peck); g.rotate(peck * 0.04);
    const hr = stage <= 0 ? 11 : 9; g.fillStyle = head; g.beginPath(); g.arc(13, -13, hr, 0, TAU); g.fill();
    if (stage <= 0) { g.strokeStyle = head; g.lineWidth = 2; g.beginPath(); g.moveTo(11, -23); g.quadraticCurveTo(9, -29, 14, -27); g.moveTo(14, -24); g.quadraticCurveTo(16, -30, 19, -26); g.stroke(); }
    g.fillStyle = '#ff9f1c'; g.beginPath(); g.moveTo(20, -14); g.quadraticCurveTo(30, -12, 21, -8); g.closePath(); g.fill();
    if (mode === 'sleep') { g.strokeStyle = '#1b1b2b'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(13, -15); g.lineTo(18, -15); g.stroke(); }
    else { g.fillStyle = '#1b1b2b'; g.beginPath(); g.arc(15.5, -15, 1.9, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(16.1, -15.6, 0.6, 0, TAU); g.fill(); }
    drawHat(g, hat);
    g.restore();
    g.fillStyle = wing; g.beginPath();
    if (mode === 'fly') { const f = Math.sin(t * 16) * 12; g.moveTo(-8, -2); g.quadraticCurveTo(-2, -16 - f, 8, -3); } else g.ellipse(-2, 1, 10, 6, -0.25, 0, TAU);
    g.fill();
    if (mode === 'swim') { g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-26, 8, 52, 3); }
    g.restore();
  }
  function drawHat(g, hat) {
    if (!hat || hat === 'none') return;
    if (hat === 'shades') { g.fillStyle = '#1b1b2b'; g.fillRect(10, -17, 10, 4.5); g.fillRect(6, -16, 5, 1.5); return; }
    if (hat === 'headband') { g.fillStyle = '#e63946'; g.fillRect(5, -19, 16, 3.5); g.fillRect(2, -18, 4, 7); return; }
    g.save(); g.translate(13, -21);
    if (hat === 'cap') { g.fillStyle = '#e63946'; g.beginPath(); g.arc(0, 0, 8, Math.PI, 0); g.fill(); g.fillRect(0, -2, 13, 3); }
    else if (hat === 'tophat') { g.fillStyle = '#1b1b2b'; g.fillRect(-9, -2, 18, 3); g.fillRect(-6, -14, 12, 13); g.fillStyle = '#e63946'; g.fillRect(-6, -5, 12, 3); }
    else if (hat === 'crown') { g.fillStyle = '#ffcc00'; g.beginPath(); g.moveTo(-8, 0); g.lineTo(-8, -9); g.lineTo(-4, -4); g.lineTo(0, -11); g.lineTo(4, -4); g.lineTo(8, -9); g.lineTo(8, 0); g.closePath(); g.fill(); }
    else if (hat === 'flower') { g.fillStyle = '#ff6fb5'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(Math.cos(i * 1.256) * 4, -3 + Math.sin(i * 1.256) * 4, 3, 0, TAU); g.fill(); } g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(0, -3, 2.4, 0, TAU); g.fill(); }
    else if (hat === 'bow') { g.fillStyle = '#e63946'; g.beginPath(); g.moveTo(0, -2); g.lineTo(-8, -7); g.lineTo(-8, 3); g.closePath(); g.moveTo(0, -2); g.lineTo(8, -7); g.lineTo(8, 3); g.closePath(); g.fill(); }
    else if (hat === 'viking') { g.fillStyle = '#9aa3ad'; g.beginPath(); g.arc(0, 2, 8, Math.PI, 0); g.fill(); g.fillStyle = '#fff4d6'; g.beginPath(); g.moveTo(-7, -1); g.quadraticCurveTo(-14, -6, -12, -14); g.lineTo(-5, -4); g.fill(); g.beginPath(); g.moveTo(7, -1); g.quadraticCurveTo(14, -6, 12, -14); g.lineTo(5, -4); g.fill(); }
    else if (hat === 'pirate') { g.fillStyle = '#1b1b2b'; g.beginPath(); g.moveTo(-12, 1); g.quadraticCurveTo(0, -16, 12, 1); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -5, 2, 0, TAU); g.fill(); }
    else if (hat === 'party') { g.fillStyle = '#3ec1ff'; g.beginPath(); g.moveTo(-6, 1); g.lineTo(0, -16); g.lineTo(6, 1); g.closePath(); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, -16, 2.5, 0, TAU); g.fill(); g.fillStyle = '#ff4f9a'; g.fillRect(-4, -6, 8, 2); }
    else if (hat === 'chef') { g.fillStyle = '#fff'; g.fillRect(-6, -6, 12, 7); for (const dx of [-5, 0, 5]) { g.beginPath(); g.arc(dx, -8, 5, 0, TAU); g.fill(); } }
    g.restore();
  }
  const imgCache = {};
  function duckImg(color, hat, mode = 'stand', stage = 2) {
    const k = color + hat + mode + stage; if (imgCache[k]) return imgCache[k];
    const c = document.createElement('canvas'); c.width = 120; c.height = 100;
    drawDuck(c.getContext('2d'), 58, stage <= 0 ? 66 : 60, 2, color, hat, 0, mode, false, stage);
    return (imgCache[k] = c.toDataURL());
  }
  function drawEgg(g, x, y, s, color, spots, t = 0, wobble = 0) {
    g.save(); g.translate(x, y); g.rotate(Math.sin(t * 9) * 0.12 * wobble); g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(0, 20, 16, 4, 0, 0, TAU); g.fill();
    g.fillStyle = color || '#f3ead9'; g.beginPath(); g.ellipse(0, 0, 15, 20, 0, 0, TAU); g.fill();
    g.fillStyle = spots || '#c9a978'; for (const [dx, dy, r] of [[-5, -8, 3], [6, -2, 2.5], [-2, 6, 3.2], [7, 9, 2], [-8, 3, 2]]) { g.beginPath(); g.arc(dx, dy, r, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(-6, -9, 3, 6, -0.4, 0, TAU); g.fill();
    g.restore();
  }
  function eggImg(color, spots) {
    const k = 'egg' + color + spots; if (imgCache[k]) return imgCache[k];
    const c = document.createElement('canvas'); c.width = 100; c.height = 110;
    drawEgg(c.getContext('2d'), 50, 52, 2.2, color, spots);
    return (imgCache[k] = c.toDataURL());
  }
  function drawFox(g, x, y, s, t) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = '#e8772e'; g.beginPath(); g.ellipse(0, 0, 14, 8, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-12, -2); g.quadraticCurveTo(-28, -10 + Math.sin(t * 5) * 4, -26, 4); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-25, 2, 3, 0, TAU); g.fill();
    g.fillStyle = '#e8772e'; g.beginPath(); g.moveTo(10, -4); g.lineTo(24, 0); g.lineTo(10, 6); g.fill();
    g.beginPath(); g.moveTo(10, -4); g.lineTo(12, -12); g.lineTo(16, -3); g.fill();
    g.fillStyle = '#1b1b2b'; g.beginPath(); g.arc(16, -1, 1.4, 0, TAU); g.fill(); g.beginPath(); g.arc(24, 0, 1.5, 0, TAU); g.fill();
    g.strokeStyle = '#5a2d0c'; g.lineWidth = 2.5; for (const dx of [-8, 6]) { g.beginPath(); g.moveTo(dx, 6); g.lineTo(dx + Math.sin(t * 10) * 2, 13); g.stroke(); }
    g.restore();
  }

  // The duck's hit shapes, from the same numbers drawDuck uses (stage size, scale, bob), so
  // mini-game collisions match what is on screen. Local units: body ellipse 18×12 at the
  // origin, head r 9 at (13,−13), tail to −24, legs down to 18 (when they show).
  //  - box: body + head, slightly inside the outline (tail tip and beak are soft)
  //  - feet: the narrow bottom zone (legs and belly) that trips over things
  //  - circle: a round core (body + head) for rings and clouds
  function duckBox(x, y, s, mode = 'stand', t = 0, stage = 2, flip = false) {
    const ss = s * (stage <= 0 ? 0.62 : stage === 1 ? 0.82 : 1);
    const bob = mode === 'swim' ? Math.sin(t * 6) * 1.2 : mode === 'run' ? -Math.abs(Math.sin(t * 14)) * 2.5 : mode === 'fly' ? Math.sin(t * 5) * 2 : mode === 'sleep' ? 2 : 0;
    const legs = mode !== 'swim' && mode !== 'fly' && mode !== 'sleep', yy = y + bob * ss, fx = flip ? -1 : 1;
    const L = x + Math.min(-19 * fx, 21 * fx) * ss, R = x + Math.max(-19 * fx, 21 * fx) * ss;
    return {
      ss, x, y: yy, l: L, r: R, t: yy - 21 * ss, b: yy + (legs ? 18 : 11) * ss,
      feet: { l: x - 12 * ss, r: x + 12 * ss, t: yy + 4 * ss, b: yy + (legs ? 18 : 11) * ss },
      cx: x + 1 * fx * ss, cy: yy - 4.5 * ss, rad: 14.5 * ss,
    };
  }

  // ---------- props, critters and icons ----------
  // Original vector art, used wherever something is drawn as an object (instead of emoji).
  // Every icon is drawn in a 32×32 box centred on (0,0); drawIcon scales it to `size` px.
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fill(); };
  const poly = (g, pts) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); };
  function starPath(g, x, y, R, r, n = 5, rot = -Math.PI / 2) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + (i * Math.PI) / n, q = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g.closePath(); }
  function drop(g, x, y, s) { g.beginPath(); g.moveTo(x, y - 8 * s); g.bezierCurveTo(x + 7 * s, y + 1 * s, x + 5 * s, y + 6 * s, x, y + 6 * s); g.bezierCurveTo(x - 5 * s, y + 6 * s, x - 7 * s, y + 1 * s, x, y - 8 * s); g.fill(); }
  const INK = '#3a2400';
  function trophy(g, c, d) {
    g.strokeStyle = c; g.lineWidth = 3; g.beginPath(); g.arc(-10, -6, 5, Math.PI * 0.5, Math.PI * 1.5); g.stroke(); g.beginPath(); g.arc(10, -6, 5, -Math.PI * 0.5, Math.PI * 0.5); g.stroke();
    g.fillStyle = c; g.beginPath(); g.moveTo(-11, -13); g.lineTo(11, -13); g.quadraticCurveTo(11, 4, 0, 5); g.quadraticCurveTo(-11, 4, -11, -13); g.fill();
    g.fillStyle = d; g.fillRect(-2.5, 4, 5, 6); g.fillRect(-8, 10, 16, 5); g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-7, -11, 3, 9);
  }
  function face(g, col, mouth) {
    g.fillStyle = col; circ(g, 0, 0, 14); g.strokeStyle = 'rgba(58,36,0,.6)'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = INK; circ(g, -5, -3, 1.9); circ(g, 5, -3, 1.9);
    g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); mouth(); g.stroke();
  }
  const ICONS = {
    corn(g) {
      g.fillStyle = '#4fae3c'; g.beginPath(); g.moveTo(-1, 15); g.quadraticCurveTo(-13, 6, -9, -7); g.quadraticCurveTo(-4, 4, 3, 9); g.closePath(); g.fill();
      g.save(); g.rotate(0.3);
      g.fillStyle = '#ffd23f'; ell(g, 0, -4, 7, 13);
      g.fillStyle = '#e9a800'; for (let i = -3; i <= 2; i++) for (const j of [-3.4, 0, 3.4]) if (Math.abs(j) < 6.5 * Math.sqrt(Math.max(0, 1 - ((i * 3.6) / 13) ** 2))) circ(g, j, -4 + i * 3.6, 1.2);
      g.fillStyle = 'rgba(255,255,255,.55)'; ell(g, -3, -9, 1.6, 4);
      g.restore();
      g.fillStyle = '#6cc94f'; g.beginPath(); g.moveTo(2, 15); g.quadraticCurveTo(14, 7, 12, -5); g.quadraticCurveTo(6, 5, -2, 9); g.closePath(); g.fill();
    },
    heart(g) { g.fillStyle = '#ff4f6d'; g.beginPath(); g.moveTo(0, 13); g.bezierCurveTo(-18, 1, -13, -14, 0, -6); g.bezierCurveTo(13, -14, 18, 1, 0, 13); g.fill(); g.fillStyle = 'rgba(255,255,255,.6)'; ell(g, -7, -4, 2.5, 3.5, -0.6); },
    star(g) { g.fillStyle = '#ffd23f'; starPath(g, 0, 1, 15, 6.5); g.fill(); g.strokeStyle = '#e09a00'; g.lineWidth = 2; g.stroke(); g.fillStyle = 'rgba(255,255,255,.6)'; circ(g, -3, -3, 2); },
    sparkle(g, t) { g.fillStyle = '#fff3a6'; starPath(g, 0, 0, 15, 3.5, 4, t * 0.5); g.fill(); g.fillStyle = '#fff'; starPath(g, 9, -9, 6, 1.5, 4, 0); g.fill(); starPath(g, -9, 9, 4, 1, 4, 0); g.fill(); },
    hammer(g) { g.save(); g.rotate(-0.6); g.fillStyle = '#a8774d'; g.fillRect(-2.5, -6, 5, 22); g.fillStyle = '#8b95a3'; g.fillRect(-11, -14, 22, 9); g.fillStyle = '#c3cbd6'; g.fillRect(-11, -14, 22, 3); g.restore(); },
    medal(g) {
      g.fillStyle = '#3ec1ff'; poly(g, [-9, -16, -2, -16, 3, -2, -4, -2]); g.fill(); g.fillStyle = '#e63946'; poly(g, [9, -16, 2, -16, -3, -2, 4, -2]); g.fill();
      g.fillStyle = '#ffcc00'; circ(g, 0, 6, 10); g.fillStyle = '#e9a800'; circ(g, 0, 6, 7); g.fillStyle = '#ffe680'; starPath(g, 0, 6.5, 5.5, 2.4); g.fill();
    },
    hatch(g) {
      g.fillStyle = '#ffd23f'; circ(g, 0, -5, 8); g.fillStyle = '#ff9f1c'; poly(g, [6, -6, 12, -4, 6, -2]); g.fill(); g.fillStyle = '#1b1b2b'; circ(g, 2.5, -7, 1.3);
      g.fillStyle = '#f3ead9'; g.beginPath(); g.moveTo(-12, 2); for (let i = 0; i <= 6; i++) g.lineTo(-12 + i * 4, i % 2 ? -3 : 1); g.lineTo(12, 2); g.ellipse(0, 2, 12, 13, 0, 0, Math.PI); g.closePath(); g.fill();
      g.fillStyle = '#c9a978'; circ(g, -4, 8, 2); circ(g, 5, 10, 1.6);
    },
    sprout(g) {
      g.fillStyle = '#8b5a2b'; ell(g, 0, 12, 12, 4); g.strokeStyle = '#3d8b37'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 12); g.lineTo(0, -2); g.stroke();
      g.fillStyle = '#5fbf4a'; ell(g, -6, -4, 7, 3.5, -0.5); ell(g, 6, -7, 7, 3.5, 0.5);
    },
    wheel(g, t) {
      const C = ['#ff4f9a', '#ffd23f', '#3ec1ff', '#2ee6a6', '#b388ff', '#ff8c42'];
      for (let i = 0; i < 6; i++) { const a = i * (TAU / 6) + t * 3; g.fillStyle = C[i]; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 14, a, a + TAU / 6); g.closePath(); g.fill(); }
      g.strokeStyle = '#5a3b22'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.stroke(); g.fillStyle = '#fff'; circ(g, 0, 0, 3.5);
      g.fillStyle = '#5a3b22'; poly(g, [-3, -17, 3, -17, 0, -11]); g.fill();
    },
    gift(g) {
      g.fillStyle = '#ff4f9a'; g.fillRect(-12, -3, 24, 16); g.fillStyle = '#ff7ab8'; g.fillRect(-14, -9, 28, 7); g.fillStyle = '#ffd23f'; g.fillRect(-2.5, -9, 5, 22);
      ell(g, -5, -12, 5, 3.5, -0.5); ell(g, 5, -12, 5, 3.5, 0.5);
    },
    bolt(g) { g.fillStyle = '#ffd23f'; poly(g, [4, -16, -9, 2, -1, 2, -5, 16, 9, -3, 1, -3, 7, -16]); g.fill(); g.strokeStyle = '#e08a00'; g.lineWidth = 1.5; g.lineJoin = 'round'; g.stroke(); },
    swirl(g, t) { g.strokeStyle = '#7fd0ff'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); for (let a = 0; a < TAU * 2.2; a += 0.2) { const r = 1 + a * 1.05; g.lineTo(Math.cos(a + t * 6) * r, Math.sin(a + t * 6) * r * 0.8); } g.stroke(); },
    dizzy(g, t) { for (let i = 0; i < 3; i++) { const a = t * 5 + (i * TAU) / 3; g.fillStyle = ['#ffd23f', '#fff3a6', '#ffb13b'][i]; starPath(g, Math.cos(a) * 12, Math.sin(a) * 5, 5.5, 2.3); g.fill(); g.strokeStyle = 'rgba(120,70,0,.6)'; g.lineWidth = 1; g.stroke(); } },
    alert(g) { g.fillStyle = '#ff6a5c'; starPath(g, 0, 0, 16, 11, 9); g.fill(); g.fillStyle = '#fff'; g.fillRect(-2, -9, 4, 11); circ(g, 0, 6, 2.3); },
    sweat(g) { g.fillStyle = '#7fd0ff'; drop(g, -4, 0, 1.2); drop(g, 7, -6, 0.8); g.fillStyle = 'rgba(255,255,255,.7)'; ell(g, -6, 0, 1.4, 2.6); },
    megaphone(g) {
      g.save(); g.rotate(-0.35); g.fillStyle = '#ff8c42'; poly(g, [-10, -4, 8, -12, 8, 12, -10, 4]); g.fill(); g.fillStyle = '#ffd23f'; ell(g, 8, 0, 3, 12);
      g.fillStyle = '#5a3b22'; g.fillRect(-15, -4, 6, 8); g.fillRect(-6, 4, 4, 7); g.restore();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.lineCap = 'round'; for (const r of [15, 20]) { g.beginPath(); g.arc(-4, 0, r, -1.1, -0.1); g.stroke(); }
    },
    trophy1(g) { trophy(g, '#ffcc00', '#c98f00'); },
    trophy2(g) { trophy(g, '#d7dde5', '#8b95a3'); },
    trophy3(g) { trophy(g, '#e0975a', '#a8683a'); },
    happy(g) { face(g, '#ffd23f', () => g.arc(0, 2, 7, 0.25, Math.PI - 0.25)); },
    okay(g) { face(g, '#ffe9a0', () => { g.moveTo(-5, 6); g.quadraticCurveTo(0, 8, 5, 6); }); },
    grumpy(g) { face(g, '#ff8a6a', () => { g.arc(0, 11, 6, Math.PI + 0.5, -0.5); g.moveTo(-8, -8); g.lineTo(-3, -6); g.moveTo(8, -8); g.lineTo(3, -6); }); },
    // what a duck is training (the farm's little thought bubble)
    hurdle(g) { g.fillStyle = '#fff'; g.fillRect(-11, -6, 4, 20); g.fillRect(7, -6, 4, 20); g.fillStyle = '#e63946'; g.fillRect(-14, -10, 28, 7); g.fillStyle = '#fff'; g.fillRect(-6, -10, 5, 7); g.fillRect(4, -10, 5, 7); },
    wave(g) { g.fillStyle = '#3ea7f0'; g.beginPath(); g.moveTo(-15, 12); g.lineTo(-15, 2); g.quadraticCurveTo(-8, -6, -1, 2); g.quadraticCurveTo(6, -14, 15, -2); g.lineTo(15, 12); g.closePath(); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-12, 1); g.quadraticCurveTo(-8, -3, -4, 1); g.moveTo(1, -2); g.quadraticCurveTo(6, -10, 12, -3); g.stroke(); },
    ring(g) { g.strokeStyle = '#ff4f9a'; g.lineWidth = 5; g.beginPath(); g.ellipse(0, 0, 7, 13, 0, 0, TAU); g.stroke(); g.fillStyle = '#ffd23f'; starPath(g, 0, 0, 4, 1.6); g.fill(); },
    climb(g) { g.fillStyle = '#9a8f86'; poly(g, [-15, 14, -9, -12, 2, -16, 14, -6, 15, 14]); g.fill(); g.fillStyle = '#2ee6a6'; ell(g, -4, -3, 5, 3.5); g.fillStyle = '#ffd23f'; ell(g, 6, 7, 4, 3); g.fillStyle = '#ff4f9a'; ell(g, 5, -9, 3.5, 2.5); },
    bug(g, t) { drawBug(g, 'ladybug', 0, 0, 13, t); },
    // farm decorations
    flowers(g, t) {
      for (const [x, c, h] of [[-9, '#ff6fb5', 10], [0, '#ffd23f', 14], [9, '#b388ff', 9]]) {
        g.strokeStyle = '#3d8b37'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 15); g.lineTo(x + Math.sin(t * 2 + x) * 1.5, 15 - h); g.stroke();
        g.fillStyle = c; const tx = x + Math.sin(t * 2 + x) * 1.5, ty = 15 - h; g.beginPath(); g.moveTo(tx - 5, ty - 6); g.lineTo(tx - 2.5, ty - 2); g.lineTo(tx, ty - 6); g.lineTo(tx + 2.5, ty - 2); g.lineTo(tx + 5, ty - 6); g.quadraticCurveTo(tx + 5, ty + 2, tx, ty + 2); g.quadraticCurveTo(tx - 5, ty + 2, tx - 5, ty - 6); g.fill();
      }
      g.fillStyle = '#5fbf4a'; ell(g, -5, 12, 4, 2, -0.5); ell(g, 5, 12, 4, 2, 0.5);
    },
    flag(g, t) { g.fillStyle = '#6b4420'; g.fillRect(-9, -15, 3, 31); g.fillStyle = '#e63946'; g.beginPath(); g.moveTo(-6, -15); g.quadraticCurveTo(3, -17 + Math.sin(t * 5) * 2, 13, -11); g.quadraticCurveTo(4, -6 + Math.sin(t * 5 + 1) * 2, -6, -4); g.closePath(); g.fill(); },
    gnome(g) {
      g.fillStyle = '#3e7bd6'; poly(g, [-9, 15, -7, 2, 7, 2, 9, 15]); g.fill(); g.fillStyle = '#f7d2b8'; circ(g, 0, -2, 5.5);
      g.fillStyle = '#fff'; poly(g, [-6, 0, 6, 0, 0, 11]); g.fill(); g.fillStyle = '#e63946'; poly(g, [-7, -4, 7, -4, 2, -17]); g.fill(); g.fillStyle = '#ff9f9f'; circ(g, 0, -1, 1.8);
    },
    lantern(g, t) {
      const gl = g.createRadialGradient(0, 0, 2, 0, 0, 16); gl.addColorStop(0, `rgba(255,220,120,${0.45 + Math.sin(t * 3) * 0.1})`); gl.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gl; circ(g, 0, 0, 16);
      g.strokeStyle = '#5a3b22'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -16); g.lineTo(0, -11); g.stroke();
      g.fillStyle = '#e63946'; ell(g, 0, 0, 10, 11); g.strokeStyle = '#b02a35'; g.lineWidth = 1; for (const x of [-5, 0, 5]) { g.beginPath(); g.ellipse(0, 0, Math.abs(x) + 0.5, 11, 0, 0, TAU); g.stroke(); }
      g.fillStyle = '#ffcc00'; g.fillRect(-5, -12, 10, 3); g.fillRect(-5, 9, 10, 3); g.fillRect(-1, 12, 2, 4);
    },
    scarecrow(g) {
      g.fillStyle = '#7a4f2f'; g.fillRect(-1.5, -6, 3, 22); g.fillRect(-14, -2, 28, 3);
      g.fillStyle = '#4f8fd6'; poly(g, [-8, -3, 8, -3, 10, 9, -10, 9]); g.fill(); g.fillStyle = '#e0b34a'; poly(g, [-14, -3, -16, 3, -12, 1]); g.fill(); poly(g, [14, -3, 16, 3, 12, 1]); g.fill();
      g.fillStyle = '#f2d59a'; circ(g, 0, -9, 5.5); g.fillStyle = '#c9893b'; ell(g, 0, -13, 10, 2.2); poly(g, [-5, -13, 5, -13, 3, -19, -3, -19]); g.fill();
      g.fillStyle = INK; circ(g, -2, -9, 0.9); circ(g, 2, -9, 0.9);
    },
    fountain(g, t) {
      g.fillStyle = '#a9b4c2'; ell(g, 0, 10, 15, 5); g.fillStyle = '#4fb3ff'; ell(g, 0, 9, 12, 3.2); g.fillStyle = '#a9b4c2'; g.fillRect(-2.5, -4, 5, 13); ell(g, 0, -4, 7, 2.5);
      g.strokeStyle = 'rgba(127,208,255,.95)'; g.lineWidth = 1.8; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(s * 7, -16 - Math.sin(t * 6) * 1.5, s * 10, 8); g.stroke(); }
      g.fillStyle = '#bfe7ff'; circ(g, 0, -8, 2);
    },
    statue(g) {
      g.fillStyle = '#9aa3ad'; g.fillRect(-10, 6, 20, 9); g.fillStyle = '#b8c0c9'; g.fillRect(-12, 4, 24, 3);
      g.fillStyle = '#c9d0d8'; ell(g, -1, -2, 9, 6); circ(g, 6, -9, 4.5); poly(g, [-8, -4, -13, -7, -9, 1]); g.fill(); g.fillStyle = '#9aa3ad'; poly(g, [10, -10, 14, -9, 10, -7]); g.fill();
    },
    rainbow(g) { const C = ['#ff5a5f', '#ffb13b', '#ffe14d', '#5fd36a', '#3ec1ff', '#8f6cff']; g.lineWidth = 2.6; C.forEach((c, i) => { g.strokeStyle = c; g.beginPath(); g.arc(0, 10, 15 - i * 2.4, Math.PI, 0); g.stroke(); }); g.fillStyle = '#fff'; circ(g, -12, 10, 3.5); circ(g, -9, 11, 3); circ(g, 12, 10, 3.5); circ(g, 9, 11, 3); },
    // climbing wall pieces
    crystal(g, t) {
      g.fillStyle = '#7fe0ff'; poly(g, [0, -14, 9, -4, 5, 12, -5, 12, -9, -4]); g.fill();
      g.fillStyle = '#4fb8f0'; poly(g, [0, -14, 9, -4, 0, -2]); g.fill(); poly(g, [-5, 12, 5, 12, 0, -2]); g.fill();
      g.strokeStyle = '#2f8fe0'; g.lineWidth = 1.2; poly(g, [0, -14, 9, -4, 5, 12, -5, 12, -9, -4]); g.stroke();
      g.fillStyle = `rgba(255,255,255,${0.6 + Math.sin(t * 6) * 0.3})`; starPath(g, -4, -6, 4, 1, 4, 0); g.fill();
    },
    rock(g) {
      g.fillStyle = '#c8553d'; poly(g, [-15, 7, -12, -6, -3, -13, 9, -10, 15, -1, 12, 10, -5, 13]); g.fill();
      g.fillStyle = '#e07a5f'; poly(g, [-12, -6, -3, -13, 9, -10, 3, -6, -6, -3]); g.fill();
      g.strokeStyle = '#6e2318'; g.lineWidth = 1.6; g.lineJoin = 'round'; g.beginPath(); g.moveTo(-2, -12); g.lineTo(1, -5); g.lineTo(-3, 1); g.lineTo(2, 8); g.moveTo(1, -5); g.lineTo(8, -2); g.stroke();
      g.strokeStyle = 'rgba(110,35,24,.8)'; g.lineWidth = 1.4; poly(g, [-15, 7, -12, -6, -3, -13, 9, -10, 15, -1, 12, 10, -5, 13]); g.stroke();
    },
  };
  function drawIcon(g, name, x, y, size, t = 0) {
    const f = ICONS[name] || ICONS.sparkle;
    g.save(); g.translate(x, y); g.scale(size / 32, size / 32); g.lineCap = 'butt'; g.lineJoin = 'miter'; f(g, t); g.restore();
  }
  const moodIcon = (m) => (m >= 70 ? 'happy' : m >= 30 ? 'okay' : 'grumpy');

  // Critters for the mini-games. r is the body radius in px (what a tap or a hit is measured against).
  function drawBug(g, kind, x, y, r, t = 0) {
    g.save(); g.translate(x, y); const k = r / 16; g.scale(k, k);
    const wig = Math.sin(t * 18) * 1.5;
    if (kind === 'bee') {
      const flap = Math.abs(Math.sin(t * 40));
      g.fillStyle = 'rgba(230,248,255,.85)'; ell(g, -4, -13, 7, 4 + flap * 4, -0.5); ell(g, 5, -13, 6, 3 + flap * 4, 0.5);
      g.fillStyle = '#1b1b2b'; poly(g, [-17, 0, -12, -3, -12, 3]); g.fill();
      g.fillStyle = '#ffc61a'; ell(g, -1, 0, 14, 11);
      g.save(); g.beginPath(); g.ellipse(-1, 0, 14, 11, 0, 0, TAU); g.clip(); g.fillStyle = '#1b1b2b'; for (const sx of [-9, -2, 5]) g.fillRect(sx, -12, 4, 24); g.restore();
      g.fillStyle = '#1b1b2b'; circ(g, 13, -1, 7); g.fillStyle = '#fff'; circ(g, 15, -3, 2.6); g.fillStyle = '#1b1b2b'; circ(g, 15.6, -2.6, 1.3);
      g.strokeStyle = '#e63946'; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(11.5, -7.5); g.lineTo(17.5, -5); g.stroke(); // angry brow
      g.strokeStyle = '#1b1b2b'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(14, -7); g.quadraticCurveTo(16, -14, 19, -14); g.stroke();
    } else if (kind === 'caterpillar') {
      for (let i = 4; i >= 0; i--) { const sx = -15 + i * 6.5, sy = Math.sin(t * 10 + i) * 2; g.fillStyle = i % 2 ? '#7ccf3a' : '#5fb32b'; circ(g, sx, sy + 3, 6.5); g.fillStyle = '#3f7f1f'; g.fillRect(sx - 1, sy + 8, 2, 3); }
      g.fillStyle = '#8be04a'; circ(g, 14, -3, 8); g.fillStyle = '#fff'; circ(g, 16, -5, 2.6); g.fillStyle = '#1b1b2b'; circ(g, 16.8, -5, 1.4);
      g.fillStyle = '#ff6f8f'; circ(g, 18, 0, 1.6);
      g.strokeStyle = '#3f7f1f'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(12, -10); g.lineTo(10, -16); g.moveTo(16, -10); g.lineTo(18, -16); g.stroke(); g.fillStyle = '#ffd23f'; circ(g, 10, -16, 1.8); circ(g, 18, -16, 1.8);
    } else if (kind === 'cricket') {
      g.strokeStyle = '#2f6b1f'; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(-4, 2); g.lineTo(-10, -10 + wig); g.lineTo(-16, 10); g.moveTo(2, 5); g.lineTo(-1, 12); g.moveTo(8, 5); g.lineTo(11, 12); g.stroke();
      g.fillStyle = '#6cc94f'; ell(g, -1, 1, 14, 7, -0.1); g.fillStyle = '#4fa63a'; ell(g, -3, -2, 11, 4, -0.15);
      g.fillStyle = '#7fe05f'; circ(g, 13, -2, 6.5); g.fillStyle = '#1b1b2b'; circ(g, 15, -4, 1.8);
      g.strokeStyle = '#2f6b1f'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(16, -7); g.quadraticCurveTo(22, -18, 8, -20 + wig); g.moveTo(14, -8); g.quadraticCurveTo(14, -18, 2, -18); g.stroke();
    } else { // ladybug / golden beetle (seen from above)
      const gold = kind === 'beetle';
      g.strokeStyle = '#1b1b2b'; g.lineWidth = 2; g.lineCap = 'round';
      for (const s of [-1, 1]) for (const dy of [-5, 1, 7]) { g.beginPath(); g.moveTo(s * 9, dy); g.lineTo(s * (16 + (dy === 1 ? wig : 0)), dy + (dy - 1) * 0.5); g.stroke(); }
      g.fillStyle = '#1b1b2b'; circ(g, 0, -12, 6.5);
      if (gold) { g.strokeStyle = '#1b1b2b'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -16); g.quadraticCurveTo(1, -22, 5, -22); g.stroke(); }
      else { g.strokeStyle = '#1b1b2b'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-2, -17); g.quadraticCurveTo(-5, -21, -8, -20); g.moveTo(2, -17); g.quadraticCurveTo(5, -21, 8, -20); g.stroke(); }
      g.fillStyle = '#fff'; circ(g, -3, -14, 1.6); circ(g, 3, -14, 1.6);
      const shell = g.createLinearGradient(-12, -8, 12, 14); if (gold) { shell.addColorStop(0, '#fff1a0'); shell.addColorStop(0.45, '#ffcc00'); shell.addColorStop(1, '#c98f00'); } else { shell.addColorStop(0, '#ff6b5f'); shell.addColorStop(1, '#d62c2c'); }
      g.fillStyle = shell; ell(g, 0, 2, 12, 13);
      g.strokeStyle = gold ? '#8a6200' : '#1b1b2b'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -11); g.lineTo(0, 15); g.stroke();
      g.fillStyle = gold ? 'rgba(255,255,255,.55)' : '#1b1b2b'; if (gold) ell(g, -5, -3, 2.5, 5, 0.3); else for (const [sx, sy, sr] of [[-6, -3, 2.6], [5, -1, 2.4], [-5, 8, 2.2], [6, 9, 2.6]]) circ(g, sx, sy, sr);
    }
    g.restore();
  }
  // A little songbird flying left (Hurdle Dash). s = 1 → body radius 12 px.
  function drawBird(g, x, y, s, t = 0) {
    g.save(); g.translate(x, y); g.scale(s, s);
    const f = Math.sin(t * 18);
    g.fillStyle = '#2f6fb8'; poly(g, [10, -2, 20, -7, 19, 3]); g.fill(); // tail
    g.fillStyle = '#4f9be8'; ell(g, 0, 0, 13, 10.5);
    g.fillStyle = '#e8f4ff'; ell(g, -3, 4, 8, 5.5);
    g.fillStyle = '#ff9f1c'; poly(g, [-11, -4, -19, -2, -11, 1]); g.fill();
    g.fillStyle = '#fff'; circ(g, -6, -4, 3); g.fillStyle = '#1b1b2b'; circ(g, -6.8, -4, 1.6);
    g.fillStyle = '#2f6fb8'; g.beginPath(); g.moveTo(-3, -3); g.quadraticCurveTo(4, -16 * f - 2, 10, -3); g.closePath(); g.fill();
    g.restore();
  }

  // ---------- Duck Valley ----------
  // Layout: farms in a grid, ordered by when each player joined (plot), with dirt roads between.
  function valleyLayout(n, W, H) {
    const aspect = 1.35; let best = null;
    for (let cols = 1; cols <= Math.max(1, n); cols++) {
      const rows = Math.ceil(n / cols), cw = W / cols, ch = H / rows, size = Math.min(cw / aspect, ch);
      if (!best || size > best.size) best = { cols, rows, size };
    }
    const fh = best.size, fw = fh * aspect;
    const ox = (W - best.cols * fw) / 2, oy = (H - best.rows * fh) / 2;
    return { ...best, fw, fh, ox, oy, cell: (i) => ({ x: ox + (i % best.cols) * fw, y: oy + Math.floor(i / best.cols) * fh }) };
  }
  const MOOD = (m) => (m >= 70 ? '😊' : m >= 30 ? '🙂' : '😠');
  // Where the duck is on its farm (fractions of the farm box), by what it's doing.
  function duckSpot(f, t, k) {
    const b = f.busy;
    if (b === 'hurdles') { const a = t * 1.6 + k; return { x: 0.5 + Math.cos(a) * 0.3, y: 0.62 + Math.sin(a) * 0.17, mode: 'run', flip: Math.sin(a) > 0 }; }
    if (b === 'paddle') { const a = t * 0.9 + k; return { x: 0.22 + Math.cos(a) * 0.07, y: 0.72 + Math.sin(a) * 0.04, mode: 'swim', flip: Math.sin(a) > 0 }; }
    if (b === 'rings') { const a = t * 1.2 + k; return { x: 0.5 + Math.cos(a) * 0.28, y: 0.28 + Math.sin(a * 2) * 0.08, mode: 'fly', flip: Math.sin(a) > 0 }; }
    if (b === 'climb') return { x: 0.86, y: 0.75 - ((t * 0.18 + k) % 1) * 0.4, mode: 'climb' };
    if (b === 'bugs') return { x: 0.72 + Math.sin(t * 0.7 + k) * 0.05, y: 0.78, mode: 'peck' };
    if (b === 'nap') return { x: 0.62, y: 0.42, mode: 'sleep' };
    // idle: wander slowly between a few spots
    const a = t * 0.25 + k * 7; return { x: 0.45 + Math.sin(a) * 0.15, y: 0.6 + Math.sin(a * 1.7) * 0.1, mode: Math.sin(a * 3) > 0.6 ? 'peck' : 'stand', flip: Math.cos(a) < 0 };
  }
  function drawFarm(g, f, x, y, w, h, t, fx, zoom = 1) {
    const k = hash(f.plot) * 10, pad = w * 0.04;
    const ix = x + pad, iy = y + pad, iw = w - pad * 2, ih = h - pad * 2;
    // grass + tufts
    g.fillStyle = '#86d36d'; g.fillRect(ix, iy, iw, ih);
    g.fillStyle = '#74c25c'; for (let i = 0; i < 14; i++) g.fillRect(ix + hash(f.plot * 31 + i) * iw, iy + hash(f.plot * 17 + i) * ih, Math.max(2, iw * 0.012), Math.max(2, ih * 0.03));
    // running track (oval dirt path) if built, wider with level
    if (f.buildings.track) { g.strokeStyle = '#d9a86c'; g.lineWidth = Math.max(2, ih * 0.05 * (0.8 + f.buildings.track * 0.2)); g.beginPath(); g.ellipse(ix + iw * 0.5, iy + ih * 0.62, iw * 0.3, ih * 0.17, 0, 0, TAU); g.stroke(); }
    // pond (bigger with the Lap Pool)
    const pr = 0.13 + f.buildings.pool * 0.025;
    g.fillStyle = f.buildings.pool ? '#2f8fe0' : '#4fb3ff'; g.beginPath(); g.ellipse(ix + iw * 0.22, iy + ih * 0.74, iw * pr, ih * pr * 0.8, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = Math.max(1, iw * 0.006); g.beginPath(); g.ellipse(ix + iw * 0.22, iy + ih * 0.74, iw * pr * 0.6, ih * pr * 0.4, 0, 0.3 + Math.sin(t) * 0.2, 2); g.stroke();
    // coop / house (grows with the Cozy Coop)
    const hs = 0.16 + f.buildings.coop * 0.03, hx = ix + iw * 0.6, hy = iy + ih * 0.14, hw = iw * hs, hh = ih * hs * 1.1;
    g.fillStyle = f.color === 'midnight' ? '#c94f4f' : '#d8634f'; g.fillRect(hx, hy + hh * 0.4, hw, hh * 0.6);
    g.fillStyle = '#7a3b2e'; g.beginPath(); g.moveTo(hx - hw * 0.12, hy + hh * 0.42); g.lineTo(hx + hw / 2, hy); g.lineTo(hx + hw * 1.12, hy + hh * 0.42); g.closePath(); g.fill();
    g.fillStyle = '#3b2418'; g.fillRect(hx + hw * 0.4, hy + hh * 0.66, hw * 0.22, hh * 0.34);
    // wind tower (spinning blades)
    if (f.buildings.tower) { const tx = ix + iw * 0.9, ty = iy + ih * 0.12; g.fillStyle = '#eee'; g.fillRect(tx - iw * 0.012, ty, iw * 0.024, ih * 0.3); g.save(); g.translate(tx, ty); g.rotate(t * (1 + f.buildings.tower)); g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { g.rotate(TAU / 4); g.fillRect(0, -ih * 0.012, iw * 0.08, ih * 0.024); } g.restore(); }
    // climbing wall
    if (f.buildings.wall) { const wx = ix + iw * 0.83, wy = iy + ih * 0.42; g.fillStyle = '#8b8f99'; g.fillRect(wx, wy, iw * 0.08, ih * 0.42); g.fillStyle = ['#ff4f9a', '#ffd23f', '#3ec1ff'][f.buildings.wall - 1]; for (let i = 0; i < 5; i++) g.fillRect(wx + iw * (0.015 + (i % 2) * 0.035), wy + ih * (0.05 + i * 0.075), iw * 0.02, ih * 0.025); }
    // bug garden (sunflowers)
    if (f.buildings.garden) for (let i = 0; i < 1 + f.buildings.garden; i++) { const gx = ix + iw * (0.68 + i * 0.06), gy = iy + ih * 0.9; g.strokeStyle = '#3d8b37'; g.lineWidth = Math.max(1, iw * 0.006); g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx, gy - ih * 0.1); g.stroke(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(gx, gy - ih * 0.1, iw * 0.018, 0, TAU); g.fill(); }
    // feeder
    if (f.buildings.feeder) { g.fillStyle = '#b08968'; g.beginPath(); g.ellipse(ix + iw * 0.45, iy + ih * 0.35, iw * 0.04, ih * 0.025, 0, 0, TAU); g.fill(); }
    // decorations (drawn art, along the top fence)
    if (f.decor.length && iw > 50) { const ds0 = Math.max(9, iw * 0.085); f.decor.forEach((d, i) => drawIcon(g, d, ix + iw * (0.08 + i * 0.1), iy + ih * 0.16 - ds0 * 0.35, ds0, t + i)); }
    // fence
    g.strokeStyle = '#8b5a2b'; g.lineWidth = Math.max(1.5, iw * 0.012); g.strokeRect(ix, iy, iw, ih);
    g.fillStyle = '#6b4420'; const posts = 6; for (let i = 0; i <= posts; i++) { g.fillRect(ix + (iw * i) / posts - 1.5, iy - 2, 3, 5); g.fillRect(ix + (iw * i) / posts - 1.5, iy + ih - 3, 3, 5); }
    // a fox at the fence / a lost duckling
    if (f.event === 'fox') drawFox(g, ix + iw * (0.05 + ((t * 0.08) % 0.3)), iy + ih * 0.95, iw / 260, t);
    // the duck
    const sp = f.stage === -1 ? { x: 0.52, y: 0.5, mode: 'stand' } : duckSpot(f, t, k), ds = Math.max(0.25, iw / 220);
    // trophy shelf by the house
    if (f.trophies && f.trophies.length) { const n = Math.min(6, f.trophies.length); g.fillStyle = '#7a4a24'; g.fillRect(ix + iw * 0.6, iy + ih * 0.36, iw * 0.24, ih * 0.025); const ts = Math.max(7, iw * 0.05); for (let i = 0; i < n; i++) drawIcon(g, 'trophy' + (f.trophies[i] >= 1 && f.trophies[i] <= 3 ? f.trophies[i] : 1), ix + iw * (0.6 + i * 0.04) + ts * 0.5, iy + ih * 0.355 - ts * 0.45, ts); }
    // the farmer: the player's own character (BOX.drawChar), by the coop, watching their duck
    const BX = window.BOX;
    if (f.id && BX && BX.drawChar && iw * zoom > 46) {
      const fx0 = ix + iw * 0.56, fy0 = iy + ih * 0.47, dx = ix + iw * sp.x;
      BX.drawChar(g, fx0, fy0, { id: f.id, name: f.owner || undefined, avatar: f.avatar }, { scale: (ih * 0.42) / 62, t: t + k, facing: dx < fx0 ? -0.7 : 0.7, scared: f.event === 'fox', game: 'ducks' });
    }
    if (f.event === 'duckling') drawDuck(g, ix + iw * sp.x - 26 * ds, iy + ih * sp.y + 6 * ds, ds * 0.5, 'sunny', 'none', t + 1, 'run', sp.flip);
    if (f.stage === -1) { g.fillStyle = '#c99a5b'; g.beginPath(); g.ellipse(ix + iw * sp.x, iy + ih * sp.y + 14 * ds, 22 * ds, 8 * ds, 0, 0, TAU); g.fill(); drawEgg(g, ix + iw * sp.x, iy + ih * sp.y, ds * 0.9, f.eggColor, null, t, 1); }
    else drawDuck(g, ix + iw * sp.x, iy + ih * sp.y, ds, f.color, f.hat, t + k, sp.mode, sp.flip, f.stage);
    if (sp.mode === 'sleep') { g.fillStyle = '#fff'; g.font = `bold ${Math.max(8, 14 * ds)}px sans-serif`; g.fillText('z', ix + iw * sp.x + 16 * ds, iy + ih * sp.y - 22 * ds - ((t * 10) % 8)); }
    // effects from the phone (hearts when petted, sparkles on level up, crumbs when eating, dust when building)
    for (const e of fx) {
      const age = (performance.now() - e.at) / 1000; if (age > 1.6) continue;
      g.globalAlpha = 1 - age / 1.6;
      drawIcon(g, FX_ICON[e.kind] || 'sparkle', ix + iw * sp.x + Math.sin(age * 6) * 8, iy + ih * sp.y - 36 * ds - age * 30, Math.max(12, 22 * ds), age);
      g.globalAlpha = 1;
    }
    // what the duck is doing right now: a little bubble with the mini-game's icon
    const BUSY = { hurdles: 'hurdle', paddle: 'wave', rings: 'ring', climb: 'climb', bugs: 'bug' };
    if (BUSY[f.busy] && f.owner) {
      const bx = ix + iw * sp.x + 14 * ds, by = iy + ih * sp.y - 34 * ds, br = Math.max(7, 11 * ds);
      g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); g.beginPath(); g.moveTo(bx - br * 0.5, by + br * 0.7); g.lineTo(bx - br * 0.9, by + br * 1.4); g.lineTo(bx, by + br * 0.9); g.fill();
      drawIcon(g, BUSY[f.busy], bx, by, br * 1.5, t);
    }
    // sign: owner, mood, rank (the phone draws its own overlay instead)
    if (!f.owner) return;
    const fs = Math.max(9 / zoom, Math.min(18 / Math.min(1, zoom), w * 0.075)); // readable even when the map is zoomed out
    g.font = `600 ${fs}px Fredoka, sans-serif`; const label = `${f.rank && f.rank <= 3 ? ['🥇', '🥈', '🥉'][f.rank - 1] + ' ' : ''}${f.avatar && !(BX && BX.hasLook && BX.hasLook({ id: f.id })) ? f.avatar + ' ' : ''}${f.owner}`;
    const tw = Math.min(iw - fs * 2.2 - 6, g.measureText(label).width + 12);
    g.fillStyle = 'rgba(40,24,10,.75)'; g.fillRect(ix + 3, iy + 3, tw, fs + 6);
    g.fillStyle = '#fff'; g.fillText(label, ix + 9, iy + fs + 4, tw - 12);
    // progress at a glance: the duck's total skill level in a badge (gold once it's a champion)
    if (f.stage >= 0 && f.total != null) {
      const r = fs * 0.95, cx = ix + iw - r - 4, cy = iy + r + 4;
      g.fillStyle = f.stage >= 3 ? '#ffd23f' : f.stage === 2 ? '#8be36a' : f.stage === 1 ? '#7fe0ff' : '#fff4d6'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,24,10,.8)'; g.lineWidth = Math.max(1, fs * 0.12); g.stroke();
      g.fillStyle = '#3a2400'; g.font = `800 ${fs * 0.95}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(f.total), cx, cy + 1); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      if (w * zoom > 90) drawIcon(g, moodIcon(f.mood), cx - r - fs * 0.8, iy + 3 + (fs + 6) / 2, fs * 1.15);
    } else if (w * zoom > 90) drawIcon(g, moodIcon(f.mood), ix + iw - fs * 0.9, iy + 3 + (fs + 6) / 2, fs * 1.15);
    if (w * zoom > 150) { const L = f.levels; g.font = `600 ${fs * 0.8}px Fredoka, sans-serif`; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(ix + 3, iy + ih - fs - 6, iw - 6, fs + 4); g.fillStyle = '#fff'; g.fillText(`🏃${L.run} 🌊${L.swim} 🪽${L.fly} 🧗${L.climb} 💪${L.stamina}`, ix + 8, iy + ih - 8, iw - 14); }
  }
  const FX_ICON = { pet: 'heart', levelUp: 'star', eat: 'corn', build: 'hammer', badge: 'medal', farm: 'sparkle', hatch: 'hatch', grow: 'sprout', spin: 'wheel', gift: 'gift' };
  const DECOR_ICON = { flowers: '🌷', flag: '🚩', gnome: '🧙', lantern: '🏮', scarecrow: '🎃', fountain: '⛲', statue: '🗿', rainbow: '🌈' };
  // ---------- Duck Valley: one shared map ----------
  // Farm plots sit on a grid of lots around the Raceway (centre), nearest lots first, so the
  // first players live close to the middle. Roads run along every gap; a river crosses the map.
  const CW = 300, CH = 230, FW = 244, FH = 182;
  function farmCells(n) {
    const R = Math.ceil(Math.sqrt(n + 1)) + 2, cells = [];
    for (let gx = -R; gx <= R; gx++) for (let gy = -R; gy <= R; gy++) if (gx || gy) cells.push({ gx, gy, d: Math.hypot(gx * 1.25, gy) + hash(gx * 31 + gy * 7 + 500) * 0.35 });
    cells.sort((a, b) => a.d - b.d);
    return cells.slice(0, n);
  }
  function drawTree(g, x, y, s, kind) {
    g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(x, y + 4 * s, 16 * s, 5 * s, 0, 0, TAU); g.fill();
    g.fillStyle = '#7a4f2f'; g.fillRect(x - 3 * s, y - 14 * s, 6 * s, 16 * s);
    g.fillStyle = kind ? '#3f9a4a' : '#4caf50'; g.beginPath(); g.arc(x, y - 22 * s, 15 * s, 0, TAU); g.arc(x - 10 * s, y - 14 * s, 10 * s, 0, TAU); g.arc(x + 10 * s, y - 14 * s, 10 * s, 0, TAU); g.fill();
    if (kind === 2) { g.fillStyle = '#ff6b6b'; for (const [dx, dy] of [[-6, -24], [5, -18], [8, -28]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, 2.4 * s, 0, TAU); g.fill(); } }
  }
  function drawRaceway(g, cx, cy, t) {
    // the valley's own race ground in the middle of town: oval track, flags, a grandstand
    g.fillStyle = '#7ccf6a'; g.fillRect(cx - FW / 2, cy - FH / 2, FW, FH);
    g.strokeStyle = '#d9a86c'; g.lineWidth = 22; g.beginPath(); g.ellipse(cx, cy + 8, 95, 58, 0, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 1.5; g.setLineDash([6, 6]); g.beginPath(); g.ellipse(cx, cy + 8, 95, 58, 0, 0, TAU); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#4fb3ff'; g.beginPath(); g.ellipse(cx, cy + 8, 50, 22, 0, 0, TAU); g.fill();
    for (let i = 0; i < 6; i++) { const fx = cx - 100 + i * 40, fy = cy - 78; g.fillStyle = '#6b4420'; g.fillRect(fx, fy, 2, 22); g.fillStyle = ['#ff4f9a', '#ffd23f', '#3ec1ff', '#2ee6a6', '#b388ff', '#ff8c42'][i]; g.beginPath(); g.moveTo(fx + 2, fy); g.lineTo(fx + 16 + Math.sin(t * 4 + i) * 3, fy + 5); g.lineTo(fx + 2, fy + 10); g.fill(); }
    g.fillStyle = '#8b5a2b'; g.fillRect(cx - 60, cy + 64, 120, 18); g.fillStyle = '#fff4d6'; g.font = '700 12px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('DUCK VALLEY RACEWAY', cx, cy + 77); g.textAlign = 'left';
    for (let i = 0; i < 9; i++) { const x = cx - 80 + i * 20; for (let j = 0; j < 4; j++) { if (hash(i * 9 + j + 77) < 0.75) continue; g.fillStyle = ['#ffd23f', '#f7f7f2', '#a8774d', '#ff9dcf'][j]; g.beginPath(); g.arc(x, cy + 8 + Math.sin(t * 6 + i) * 1.5 - 30 + j * 4, 2.6, 0, TAU); g.fill(); } }
  }
  function drawValley(g, W, H, farms, t, fxBy, born, weather) {
    const n = farms.length, cells = farmCells(n);
    // world bounds: always at least the 3×3 lots around the Raceway
    let x0 = -1, x1 = 1, y0 = -1, y1 = 1;
    for (const c of cells) { x0 = Math.min(x0, c.gx); x1 = Math.max(x1, c.gx); y0 = Math.min(y0, c.gy); y1 = Math.max(y1, c.gy); }
    const wx0 = (x0 - 0.5) * CW - 40, wx1 = (x1 + 0.5) * CW + 40, wy0 = (y0 - 0.5) * CH - 40, wy1 = (y1 + 0.5) * CH + 40;
    const sc = Math.min(W / (wx1 - wx0), H / (wy1 - wy0));
    const ox = W / 2 - ((wx0 + wx1) / 2) * sc, oy = H / 2 - ((wy0 + wy1) / 2) * sc;
    // meadow everywhere (also beyond the map edge)
    g.fillStyle = '#5fb04a'; g.fillRect(0, 0, W, H);
    g.save(); g.translate(ox, oy); g.scale(sc, sc);
    const gx0 = Math.floor(wx0 / CW) - 2, gx1 = Math.ceil(wx1 / CW) + 2, gy0 = Math.floor(wy0 / CH) - 2, gy1 = Math.ceil(wy1 / CH) + 2;
    g.fillStyle = '#58a845'; for (let i = 0; i < 260; i++) { const px = gx0 * CW + hash(i * 3) * (gx1 - gx0) * CW, py = gy0 * CH + hash(i * 3 + 1) * (gy1 - gy0) * CH; g.fillRect(px, py, 10, 4); }
    // roads along every gap between lots
    const riverRow = 0; // the river runs in the gap just above the Raceway row
    g.fillStyle = '#d2ab72';
    for (let gx = gx0; gx <= gx1; gx++) g.fillRect((gx + 0.5) * CW - 14, gy0 * CH, 28, (gy1 - gy0) * CH);
    for (let gy = gy0; gy <= gy1; gy++) if (gy !== riverRow - 1) g.fillRect(gx0 * CW, (gy + 0.5) * CH - 12, (gx1 - gx0) * CW, 24);
    g.fillStyle = 'rgba(120,80,40,.25)'; for (let gx = gx0; gx <= gx1; gx++) for (let y = gy0 * CH; y < gy1 * CH; y += 26) g.fillRect((gx + 0.5) * CW - 1, y, 2, 12);
    // the river (with bridges where the roads cross)
    const ry = (riverRow - 0.5) * CH;
    g.fillStyle = '#3d9be0'; g.beginPath(); g.moveTo(gx0 * CW, ry - 16);
    for (let x = gx0 * CW; x <= gx1 * CW; x += 20) g.lineTo(x, ry - 16 + Math.sin(x / 90) * 5);
    for (let x = gx1 * CW; x >= gx0 * CW; x -= 20) g.lineTo(x, ry + 16 + Math.sin(x / 90) * 5);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; for (let x = gx0 * CW; x < gx1 * CW; x += 60) { const xx = x + ((t * 25) % 60); g.beginPath(); g.moveTo(xx, ry + Math.sin(xx / 90) * 5); g.lineTo(xx + 18, ry + Math.sin((xx + 18) / 90) * 5); g.stroke(); }
    for (let gx = gx0; gx <= gx1; gx++) { const bx = (gx + 0.5) * CW; g.fillStyle = '#9c6b3c'; g.fillRect(bx - 18, ry - 22, 36, 44); g.fillStyle = '#7a4f2f'; for (let k = 0; k < 6; k++) g.fillRect(bx - 18, ry - 20 + k * 7, 36, 2); }
    // trees on empty lots and along the edges
    const used = new Set(cells.map((c) => c.gx + ',' + c.gy)); used.add('0,0');
    for (let gx = gx0; gx <= gx1; gx++) for (let gy = gy0; gy <= gy1; gy++) {
      if (used.has(gx + ',' + gy)) continue;
      const k = gx * 131 + gy * 17;
      for (let i = 0; i < 4; i++) drawTree(g, gx * CW + (hash(k + i) - 0.5) * FW * 0.9, gy * CH + (hash(k + i + 9) - 0.5) * FH * 0.8, 1.4 + hash(k + i + 3) * 0.6, Math.floor(hash(k + i + 5) * 3));
    }
    drawRaceway(g, 0, 0, t);
    // the farms
    farms.slice().sort((a, b) => a.plot - b.plot).forEach((f, i) => {
      const c = cells[i]; if (!c) return;
      const jx = (hash(f.plot * 13) - 0.5) * 16, jy = (hash(f.plot * 29) - 0.5) * 10;
      const fx = c.gx * CW - FW / 2 + jx, fy = c.gy * CH - FH / 2 + jy;
      const age = (performance.now() - (born[f.id] || 0)) / 600, pop = Math.min(1, 0.3 + age * 0.7);
      g.save(); g.translate(fx + FW / 2, fy + FH / 2); g.scale(pop, pop); g.translate(-FW / 2, -FH / 2);
      // screen-size aware: signs only when big enough to read
      drawFarm(g, { ...f, owner: f.owner }, 0, 0, FW, FH, t, fxBy[f.id] || [], sc);
      g.restore();
    });
    g.restore();
    if (weather === 'rain') { g.fillStyle = 'rgba(40,60,90,.18)'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.5; for (let i = 0; i < 160; i++) { const rx = (i * 97 + t * 300) % W, ry2 = (i * 53 + t * 700) % H; g.beginPath(); g.moveTo(rx, ry2); g.lineTo(rx - 3, ry2 + 12); g.stroke(); } }
    else if (weather === 'fog') { g.fillStyle = 'rgba(235,240,245,.28)'; g.fillRect(0, 0, W, H); }
    else if (weather === 'heat') { g.fillStyle = 'rgba(255,170,60,.12)'; g.fillRect(0, 0, W, H); }
    else if (weather === 'windy') { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; for (let i = 0; i < 14; i++) { const wx = (i * 211 + t * 260) % (W + 200) - 100, wy = (i * 67) % H; g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 40, wy - 10, wx + 80, wy); g.stroke(); } }
    if (!farms.length) { g.fillStyle = 'rgba(20,10,40,.55)'; g.fillRect(W / 2 - 260, H - 70, 520, 48); g.fillStyle = '#fff'; g.font = '600 24px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('Scan the code: your farm appears here!', W / 2, H - 38); g.textAlign = 'left'; }
  }

  // ---------- the race (side-scrolling) ----------
  const SEC_COLORS = { track: '#7bc96f', pond: '#4fb3ff', cliff: '#9a8f86', gap: '#c7b9a6' };
  const THEME = {
    meadow: { sky: ['#7cc8ff', '#d8f1ff'], hill: '#9fd39a', ground: '#6cc26a', path: '#d9a86c', water: '#2f8fe0', rock: '#8a7f76', rockDark: '#6f655d', pit: '#2b1d14', prop: 'tree' },
    beach: { sky: ['#8fdcff', '#fff3d6'], hill: '#f3dfae', ground: '#f0d9a0', path: '#e8c98a', water: '#22a7d6', rock: '#b8a48a', rockDark: '#9c8a70', pit: '#3a2c1c', prop: 'palm' },
    forest: { sky: ['#9fd8c8', '#e3f5e9'], hill: '#4f8f5b', ground: '#4f9a4a', path: '#8a6a45', water: '#2f7fb0', rock: '#7d776e', rockDark: '#5e594f', pit: '#1f160f', prop: 'pine' },
    snow: { sky: ['#b9d7f0', '#f4f8ff'], hill: '#e8f0fa', ground: '#f4f8ff', path: '#cfe0f0', water: '#7fb8e0', rock: '#9fb1c4', rockDark: '#7f93a8', pit: '#3b4a5c', prop: 'snowpine' },
    canyon: { sky: ['#ffb880', '#ffe8c8'], hill: '#c8643c', ground: '#d98b5a', path: '#e0a070', water: '#3a9ad0', rock: '#a0522d', rockDark: '#7f3f22', pit: '#3a1a0e', prop: 'cactus' },
    night: { sky: ['#0f1638', '#3a2f6b'], hill: '#26304f', ground: '#2f5a3a', path: '#6b5a3a', water: '#1f4f8f', rock: '#4a4a5a', rockDark: '#36364a', pit: '#0b0b14', prop: 'lamp', night: true },
  };
  function drawProp(g, kind, x, base, t) {
    if (kind === 'tree') { g.fillStyle = '#7a4f2f'; g.fillRect(x - 5, base - 60, 10, 60); g.fillStyle = '#4caf50'; g.beginPath(); g.arc(x, base - 72, 30, 0, TAU); g.arc(x - 20, base - 58, 20, 0, TAU); g.arc(x + 20, base - 58, 20, 0, TAU); g.fill(); }
    else if (kind === 'palm') { g.strokeStyle = '#8b5a2b'; g.lineWidth = 8; g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x + 14, base - 50, x + 4, base - 100); g.stroke(); g.fillStyle = '#3aa655'; for (let i = 0; i < 5; i++) { g.save(); g.translate(x + 4, base - 100); g.rotate(-2.6 + i * 0.75 + Math.sin(t + i) * 0.05); g.beginPath(); g.ellipse(26, 0, 28, 7, 0, 0, TAU); g.fill(); g.restore(); } }
    else if (kind === 'pine' || kind === 'snowpine') { g.fillStyle = '#5a3b22'; g.fillRect(x - 4, base - 20, 8, 20); g.fillStyle = kind === 'pine' ? '#2e6b3a' : '#3f6f55'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 30 + i * 6, base - 20 - i * 28); g.lineTo(x, base - 62 - i * 28); g.lineTo(x + 30 - i * 6, base - 20 - i * 28); g.fill(); } if (kind === 'snowpine') { g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 10 + i * 2, base - 50 - i * 28); g.lineTo(x, base - 62 - i * 28); g.lineTo(x + 10 - i * 2, base - 50 - i * 28); g.fill(); } } }
    else if (kind === 'cactus') { g.fillStyle = '#4f8f3a'; g.fillRect(x - 7, base - 70, 14, 70); g.fillRect(x - 24, base - 50, 10, 26); g.fillRect(x - 24, base - 30, 20, 9); g.fillRect(x + 14, base - 58, 10, 24); g.fillRect(x + 4, base - 40, 20, 9); }
    else if (kind === 'lamp') { g.fillStyle = '#333'; g.fillRect(x - 3, base - 70, 6, 70); g.fillStyle = '#ffe9a0'; g.beginPath(); g.arc(x, base - 74, 9, 0, TAU); g.fill(); const gl = g.createRadialGradient(x, base - 74, 2, x, base - 74, 60); gl.addColorStop(0, 'rgba(255,230,150,.35)'); gl.addColorStop(1, 'rgba(255,230,150,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x, base - 74, 60, 0, TAU); g.fill(); }
  }
  // ---------- the racing duck ----------
  // drawDuck's duck with working parts: two jointed legs with webbed feet placed by the caller
  // (so a planted foot stays planted while the body moves), a wing that folds, flaps or spreads,
  // a far wing behind the body when flying, an open beak (panting, quacking) and eyes that
  // squint when tired or spin after a crash. (x, y) is the body centre, s the scale. P is a pose
  // object the caller keeps and reuses (nothing is allocated per frame):
  //   lean: body tilt in radians (+ = nose down)        rot: the whole duck (tumbles)
  //   sx, sy: squash and stretch                         legs: draw the legs (false when flying folded)
  //   f1x, f1y, f2x, f2y: far and near foot, in local units (not tilted; the ground is y = 18)
  //   t1, t2: foot angles (0 = flat, + = toes down)      wing: 0 folded … 1 raised; flap: −1…1 stroke
  //   farWing: draw the far wing too                     eyes: '' | 'tired' | 'dizzy' | 'shut'
  //   beak: 0…1 open                                     hx, hy: head offset (stretch, droop)
  function racePose() { return { lean: 0, rot: 0, sx: 1, sy: 1, legs: true, f1x: -4, f1y: 18, f2x: 3, f2y: 18, t1: 0, t2: 0, wing: 0, flap: 0, farWing: false, eyes: '', beak: 0, hx: 0, hy: 0 }; }
  const LEG1 = 6.2, LEG2 = 6.8;
  function leg(g, hx, hy, fx, fy, toe, col) {
    let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy);
    const max = LEG1 + LEG2 - 0.05;
    if (d > max) { fx = hx + (dx / d) * max; fy = hy + (dy / d) * max; dx = fx - hx; dy = fy - hy; d = max; }
    d = Math.max(0.5, d);
    // the joint you see on a duck's leg bends backwards
    const a = Math.atan2(dy, dx) + Math.acos(Math.max(-1, Math.min(1, (LEG1 * LEG1 + d * d - LEG2 * LEG2) / (2 * LEG1 * d))));
    const kx = hx + Math.cos(a) * LEG1, ky = hy + Math.sin(a) * LEG1;
    g.strokeStyle = col; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(hx, hy); g.lineTo(kx, ky); g.lineTo(fx, fy); g.stroke();
    g.fillStyle = col; g.save(); g.translate(fx, fy); g.rotate(toe);
    g.beginPath(); g.moveTo(-1.8, -0.6); g.lineTo(6.4, -1.4); g.quadraticCurveTo(7.4, 0.6, 6.2, 1.6); g.lineTo(-1.6, 1.2); g.closePath(); g.fill();
    g.restore();
  }
  function wingShape(g, ang, col) {
    g.save(); g.translate(5, -3); g.rotate(ang); g.fillStyle = col;
    g.beginPath(); g.moveTo(1, -3); g.quadraticCurveTo(-8, -7, -19, -1); g.quadraticCurveTo(-11, 1, -14, 4); g.quadraticCurveTo(-6, 6, 1, 4); g.closePath(); g.fill();
    g.restore();
  }
  function drawRacer(g, x, y, s, color, hat, stage, P) {
    const [body, wing, head] = PAL[color] || PAL.sunny;
    const ss = s * (stage <= 0 ? 0.62 : stage === 1 ? 0.82 : 1);
    g.save(); g.translate(x, y);
    if (stage >= 3) { g.globalAlpha = 0.25; g.fillStyle = '#ffd740'; g.beginPath(); g.arc(0, -4, 30 * s, 0, TAU); g.fill(); g.globalAlpha = 1; }
    g.scale(ss, ss);
    if (P.rot) g.rotate(P.rot);
    const c = Math.cos(P.lean), sn = Math.sin(P.lean);
    const wa = P.wing * 1.5 + P.flap * 0.9; // wing angle: + lifts the wing tip
    if (P.farWing) { wingShape(g, wa * 0.92 - 0.12, wing); g.globalAlpha = 0.28; wingShape(g, wa * 0.92 - 0.12, '#000'); g.globalAlpha = 1; } // the far wing, behind the body
    if (P.legs) {
      // hips turn with the body; the feet are where the caller put them
      leg(g, -4 * c - 8 * sn, -4 * sn + 8 * c, P.f1x, P.f1y, P.t1, '#d06f1c');
      leg(g, 3 * c - 8 * sn, 3 * sn + 8 * c, P.f2x, P.f2y, P.t2, '#f08a24');
    }
    g.rotate(P.lean); if (P.sx !== 1 || P.sy !== 1) { g.translate(0, 8); g.scale(P.sx, P.sy); g.translate(0, -8); }
    g.fillStyle = body; g.beginPath(); g.ellipse(0, 0, 18, 12, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-15, -4); g.lineTo(-24, -9); g.lineTo(-17, 4); g.fill();
    g.save(); g.translate(P.hx, P.hy);
    const hr = stage <= 0 ? 11 : 9; g.fillStyle = head; g.beginPath(); g.arc(13, -13, hr, 0, TAU); g.fill();
    if (stage <= 0) { g.strokeStyle = head; g.lineWidth = 2; g.beginPath(); g.moveTo(11, -23); g.quadraticCurveTo(9, -29, 14, -27); g.moveTo(14, -24); g.quadraticCurveTo(16, -30, 19, -26); g.stroke(); }
    const op = P.beak * 4;
    g.fillStyle = '#ff9f1c'; g.beginPath(); g.moveTo(20, -14 - op * 0.3); g.quadraticCurveTo(30, -12 - op * 0.5, 21, -10 - op * 0.2); g.closePath(); g.fill();
    g.fillStyle = '#e8850f'; g.beginPath(); g.moveTo(20, -11 + op * 0.2); g.quadraticCurveTo(28, -10 + op, 21, -8 + op * 0.4); g.closePath(); g.fill();
    if (P.eyes === 'dizzy') { g.strokeStyle = '#1b1b2b'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(13.5, -17); g.lineTo(17.5, -13); g.moveTo(17.5, -17); g.lineTo(13.5, -13); g.stroke(); }
    else if (P.eyes === 'shut') { g.strokeStyle = '#1b1b2b'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(13, -15); g.quadraticCurveTo(15.5, -13, 18, -15); g.stroke(); }
    else {
      g.fillStyle = '#1b1b2b'; g.beginPath(); g.arc(15.5, -15, 1.9, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(16.1, -15.6, 0.6, 0, TAU); g.fill();
      if (P.eyes === 'tired') { g.fillStyle = head; g.fillRect(12.8, -18.2, 5.6, 3); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(13, -15.2); g.lineTo(18.2, -15.2); g.stroke(); }
    }
    drawHat(g, hat);
    g.restore();
    if (Math.abs(wa) < 0.05) { g.fillStyle = wing; g.beginPath(); g.ellipse(-2, 1, 10, 6, -0.25, 0, TAU); g.fill(); }
    else wingShape(g, wa, wing);
    g.restore();
  }
  // A hurdle (or a fallen log) across one lane: two posts and a striped bar going back into the
  // lane's depth. fall: 0 standing … 1 knocked flat (it tips forward, the way the duck was going).
  function drawHurdle(g, x, gy, s, depth, log, fall, t) {
    g.save(); g.translate(x, gy);
    if (log) {
      const wob = fall > 0 && fall < 1 ? Math.sin(fall * 20) * 0.08 * (1 - fall) : 0; g.rotate(wob);
      g.fillStyle = '#6e4527'; g.beginPath(); g.moveTo(-4 * s, -18 * s); g.lineTo(-4 * s + depth * 0.6, -18 * s - depth); g.lineTo(4 * s + depth * 0.6, -depth); g.lineTo(4 * s, 0); g.closePath(); g.fill();
      g.fillStyle = '#7a4f2f'; g.beginPath(); g.ellipse(0, -9 * s, 9 * s, 9 * s, 0, 0, TAU); g.fill();
      g.fillStyle = '#c99a5b'; g.beginPath(); g.ellipse(0, -9 * s, 6.5 * s, 6.5 * s, 0, 0, TAU); g.fill();
      g.strokeStyle = '#a0753f'; g.lineWidth = 1.2 * s; g.beginPath(); g.arc(0, -9 * s, 3.2 * s, 0, TAU); g.stroke();
      g.restore(); return;
    }
    g.rotate(Math.min(1, fall) * 1.42);
    const h = 20 * s, dx = depth * 0.7 + 12 * s, bt = 3.4 * s;
    // feet (pointing back at the runners), the back post, the striped bar, the front post
    g.fillStyle = '#7d848c'; g.fillRect(-9 * s, -1.5 * s, 10 * s, 3 * s); g.fillRect(dx - 9 * s, -depth - 1.5 * s, 10 * s, 3 * s);
    g.fillStyle = '#cfd3d8'; g.fillRect(dx - 1.8 * s, -h - depth, 3.6 * s, h);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      g.fillStyle = i % 2 ? '#ffffff' : '#e63946';
      g.beginPath(); g.moveTo(dx * a, -h - depth * a - bt); g.lineTo(dx * b, -h - depth * b - bt); g.lineTo(dx * b, -h - depth * b + bt); g.lineTo(dx * a, -h - depth * a + bt); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -h + bt); g.lineTo(dx, -h - depth + bt); g.stroke();
    g.fillStyle = '#ffffff'; g.fillRect(-1.8 * s, -h, 3.6 * s, h);
    g.restore();
  }

  // ---------- the course ----------
  // The course in metres: sections one after another. The server sends its section lengths.
  function raceGeometry(R) {
    const LEN = R.secLen || { track: 80, pond: 60, cliff: 40, gap: 50 };
    let acc = 0; const secs = R.sections.map((s) => { const type = s.type || s, len = LEN[type]; const o = { type, v: s.v || null, a: acc, b: acc + len }; acc += len; return o; });
    return { secs, L: acc };
  }
  const CLIFF_H = 10, CLIFF_STEPS = 5, CLIFF_FACE = 0.78, CLIFF_DOWN = 0.86, RIM = 1.3;
  function secAt(G, x) { const S = G.secs; for (let i = 0; i < S.length; i++) if (x < S[i].b) return S[i]; return S[S.length - 1]; }
  const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  // Height of the ground (metres above the base line) at x. The cliff is a staircase of rock
  // ledges (a steep riser, then a flat step) up to the top, then a slope back down; the ravine
  // has a rim on each side and a deep pit; the pond surface sits a little below the bank.
  function groundH(G, x) {
    if (x <= 0 || x >= G.L) return 0;
    const s = secAt(G, x), f = (x - s.a) / (s.b - s.a);
    if (s.type === 'cliff') {
      if (f < CLIFF_FACE) { const p = (f / CLIFF_FACE) * CLIFF_STEPS, k = Math.floor(p), u = p - k; return (CLIFF_H / CLIFF_STEPS) * (k + smooth(u / 0.26)); }
      if (f < CLIFF_DOWN) return CLIFF_H;
      return CLIFF_H * (1 - smooth((f - CLIFF_DOWN) / (1 - CLIFF_DOWN)));
    }
    if (s.type === 'gap') return x - s.a < RIM || s.b - x < RIM ? 0 : -14;
    if (s.type === 'pond') return x - s.a < 0.15 || s.b - x < 0.15 ? 0 : -0.6;
    return 0;
  }
  // Old interface (the pose and height at x), kept for anything that still asks.
  function groundAt(G, x) {
    const s = secAt(G, x), f = (x - s.a) / (s.b - s.a);
    if (s.type === 'cliff') return { h: groundH(G, x), mode: f < CLIFF_FACE ? 'climb' : 'run', type: 'cliff', f };
    if (s.type === 'gap') return { h: Math.sin(Math.PI * f) * 6 + 1, mode: 'fly', type: 'gap', f };
    if (s.type === 'pond') return { h: -0.6, mode: 'swim', type: 'pond', f };
    return { h: 0, mode: 'run', type: 'track', f };
  }
  // The world behind the ducks. band: how deep the lanes go (px), so the track, the water and the
  // ledges are wide enough for every lane. Hurdles are drawn per lane by the race (drawHurdle).
  function drawRaceWorld(g, W, H, R, G, cam, PX, t, VPX = PX, band = 0, laneN = 1) { // VPX: height scale, so zooming in never makes cliffs huge
    const base = H * 0.76, TH = THEME[R.theme] || THEME.meadow, YK = VPX * 0.9;
    // sky, sun or moon, stars, clouds, far hills with props (parallax)
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, R.weather === 'rain' && !TH.night ? '#7d8ca3' : TH.sky[0]); sky.addColorStop(1, R.weather === 'heat' ? '#ffd9a0' : TH.sky[1]);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    if (TH.night) { g.fillStyle = '#fff'; for (let i = 0; i < 90; i++) { const sx = (i * 137) % W, sy = (i * 71) % (base * 0.7); g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i)); g.fillRect(sx, sy, 2, 2); } g.globalAlpha = 1; g.fillStyle = '#fdf6d0'; g.beginPath(); g.arc(W * 0.82, H * 0.16, 34, 0, TAU); g.fill(); g.fillStyle = TH.sky[0]; g.beginPath(); g.arc(W * 0.82 + 14, H * 0.16 - 8, 30, 0, TAU); g.fill(); }
    else if (R.weather !== 'rain' && R.weather !== 'fog') { g.fillStyle = R.weather === 'heat' || R.theme === 'canyon' ? '#ff9f1c' : '#ffe066'; g.beginPath(); g.arc(W * 0.85, H * 0.15, 40, 0, TAU); g.fill(); }
    if (!TH.night) { g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 8; i++) { const cx = ((i * 380 - cam * PX * 0.15) % (W + 300) + W + 300) % (W + 300) - 150, cy = 50 + (i % 3) * 40; g.beginPath(); g.arc(cx, cy, 26, 0, TAU); g.arc(cx + 28, cy - 8, 22, 0, TAU); g.arc(cx + 54, cy, 24, 0, TAU); g.fill(); } }
    const hz = base - band; // the far edge of the course
    g.fillStyle = TH.hill; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= W; x += 20) g.lineTo(x, hz - 70 - Math.sin((x + cam * PX * 0.35) / 160) * 36); g.lineTo(W, hz); g.fill();
    for (let i = -1; i < W / 260 + 2; i++) { const off = (cam * PX * 0.55) % 260; drawProp(g, TH.prop, i * 260 - off + 60, hz - 6, t); }
    if (TH.night) for (let i = 0; i < 24; i++) { const fx = (i * 173 + Math.sin(t + i) * 40) % W, fy = hz - 40 - ((i * 37) % 140) + Math.sin(t * 2 + i) * 10; g.fillStyle = 'rgba(220,255,120,' + (0.4 + 0.6 * Math.abs(Math.sin(t * 3 + i))) + ')'; g.beginPath(); g.arc(fx, fy, 2.5, 0, TAU); g.fill(); }
    // course
    const m2x = (m) => (m - cam) * PX;
    for (const s of G.secs) {
      const x0 = m2x(s.a), x1 = m2x(s.b); if (x1 < -50 || x0 > W + 50) continue;
      if (s.type === 'track') {
        g.fillStyle = TH.ground; g.fillRect(x0, hz, x1 - x0 + 1, H - hz);
        g.fillStyle = s.v === 'ice' ? '#cfeaff' : s.v === 'sand' ? '#f2dca6' : s.v === 'mud' ? '#8a6240' : TH.path; g.fillRect(x0, hz - 4, x1 - x0 + 1, band + 18);
        // lane lines
        g.fillStyle = s.v === 'mud' ? 'rgba(60,35,15,.35)' : 'rgba(255,255,255,.35)';
        for (let i = 1; i < laneN; i++) { const ly = base + 8 - i * (band / laneN); for (let x = Math.max(x0, ((x0 % 40) + 40) % 40 - 40); x < Math.min(x1, W); x += 40) g.fillRect(x, ly, 22, 2); }
        if (s.v === 'ice') { g.fillStyle = 'rgba(255,255,255,.8)'; for (let x = x0; x < x1; x += 70) { g.fillRect(x + 10, base + 3, 30, 3); g.fillRect(x + 40, base - band * 0.5, 24, 2); } }
        if (s.v === 'sand') { g.fillStyle = '#d9bf85'; for (let x = x0; x < x1; x += 22) for (let r = 0; r < 4; r++) g.fillRect(x + ((r * 7) % 11), base + 4 - r * band / 4 + (x % 5), 3, 3); }
        if (s.v === 'mud') { g.fillStyle = '#6b4a2b'; for (let x = x0 + 30; x < x1 - 20; x += 90) for (let r = 0; r < 3; r++) { g.beginPath(); g.ellipse(x + r * 23, base + 4 - r * band / 3, 34, 6, 0, 0, TAU); g.fill(); } }
        g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x0, base + 14, x1 - x0 + 1, 4);
      }
      if (s.type === 'pond') {
        g.fillStyle = TH.ground; g.fillRect(x0, hz, x1 - x0 + 1, H - hz);
        const wy = base + 0.6 * YK;
        g.fillStyle = TH.water; g.fillRect(x0 + 4, wy - band - 2, x1 - x0 - 8, H);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x0 + 4, wy - band - 2, x1 - x0 - 8, 4);
        g.fillStyle = 'rgba(0,30,60,.18)'; g.fillRect(x0 + 4, wy + 46, x1 - x0 - 8, H);
        g.fillStyle = 'rgba(255,255,255,.45)';
        const speed = s.v === 'rapids' ? 140 : 30;
        for (let r = 0; r < 3; r++) for (let x = x0; x < x1 - 40; x += 46) g.fillRect(x + ((t * speed + r * 17) % 40), wy - r * band / 3 + 6 + Math.sin(x + t * 3 + r) * 2, s.v === 'rapids' ? 28 : 16, 2.5);
        if (s.v === 'waves') { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; g.beginPath(); for (let x = x0; x <= x1; x += 8) g.lineTo(x, wy + 10 + Math.sin(x / 18 + t * 4) * 5); g.stroke(); }
        if (s.v === 'lily') { for (let x = x0 + 40; x < x1; x += 110) { g.fillStyle = '#3fae5a'; g.beginPath(); g.ellipse(x, wy - band * 0.55, 22, 6, 0, 0.3, TAU); g.fill(); g.fillStyle = '#ff9ccf'; g.beginPath(); g.arc(x + 6, wy - band * 0.55 - 4, 4, 0, TAU); g.fill(); } }
        if (s.v === 'icy') { g.fillStyle = 'rgba(235,248,255,.9)'; for (let x = x0 + 20; x < x1; x += 120) { const yy = wy - band * 0.4; g.beginPath(); g.moveTo(x, yy + 8); g.lineTo(x + 30, yy + 4); g.lineTo(x + 44, yy + 12); g.lineTo(x + 6, yy + 16); g.fill(); } }
        // muddy banks at both ends
        g.fillStyle = TH.path; g.fillRect(x0 - 2, hz - 4, 8, band + 20); g.fillRect(x1 - 6, hz - 4, 8, band + 20);
      }
      if (s.type === 'cliff') {
        const N = 64, top = '#b9ad9f', rock = s.v === 'ice' ? '#bcd9f0' : TH.rock, dark = s.v === 'ice' ? '#9cc0dd' : TH.rockDark;
        // the ledges' walking surface (lane depth) …
        g.fillStyle = s.v === 'ice' ? '#e8f4ff' : TH.ground; g.beginPath(); g.moveTo(x0, base + 14);
        for (let i = 0; i <= N; i++) { const m = s.a + ((s.b - s.a) * i) / N; g.lineTo(m2x(m), base - groundH(G, Math.min(m, s.b - 0.001)) * YK - band - 4); }
        g.lineTo(x1, base + 14); g.closePath(); g.fill();
        g.fillStyle = s.v === 'ice' ? '#d4e8f8' : top; g.globalAlpha = 0.55; g.fill(); g.globalAlpha = 1;
        // … and the rock face in front
        g.fillStyle = rock; g.beginPath(); g.moveTo(x0, H);
        for (let i = 0; i <= N; i++) { const m = s.a + ((s.b - s.a) * i) / N; g.lineTo(m2x(m), base - groundH(G, Math.min(m, s.b - 0.001)) * YK + 14); }
        g.lineTo(x1, H); g.closePath(); g.fill();
        g.fillStyle = dark; for (let i = 0; i < 16; i++) { const m = s.a + (s.b - s.a) * ((i * 0.618) % 1) * 0.95, fy = base - groundH(G, m) * YK + 30 + (i % 4) * 16; g.fillRect(m2x(m), fy, 12 + (i % 3) * 4, 6); }
        // ledge lips
        g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3; g.beginPath();
        for (let k = 1; k <= CLIFF_STEPS; k++) { const m = s.a + (s.b - s.a) * CLIFF_FACE * ((k - 1 + 0.26) / CLIFF_STEPS), yy = base - (CLIFF_H / CLIFF_STEPS) * k * YK + 14; g.moveTo(m2x(m), yy); g.lineTo(m2x(m) + (s.b - s.a) * CLIFF_FACE / CLIFF_STEPS * 0.74 * PX, yy); }
        g.stroke();
      }
      if (s.type === 'gap') {
        const r0 = m2x(s.a + RIM), r1 = m2x(s.b - RIM);
        g.fillStyle = TH.pit; g.fillRect(x0, hz - 4, x1 - x0 + 1, H);
        g.fillStyle = TH.rockDark; g.beginPath(); g.moveTo(r0, hz - 4); g.lineTo(r0 + 26, H); g.lineTo(x0, H); g.lineTo(x0, hz - 4); g.fill(); g.beginPath(); g.moveTo(r1, hz - 4); g.lineTo(r1 - 26, H); g.lineTo(x1, H); g.lineTo(x1, hz - 4); g.fill();
        g.fillStyle = TH.ground; g.fillRect(x0, hz - 4, r0 - x0, band + 18); g.fillRect(r1, hz - 4, x1 - r1, band + 18);
        g.fillStyle = TH.path; g.fillRect(x0, base + 10, r0 - x0, 8); g.fillRect(r1, base + 10, x1 - r1, 8);
        if (s.v === 'clouds') { g.fillStyle = 'rgba(255,255,255,.9)'; for (let x = r0 + 30; x < r1 - 40; x += 70) { const cy = base + 40 + Math.sin(t + x) * 4; g.beginPath(); g.arc(x, cy, 18, 0, TAU); g.arc(x + 20, cy - 6, 16, 0, TAU); g.arc(x + 38, cy, 17, 0, TAU); g.fill(); } }
      }
    }
    // the run-up before the start and the run-out after the finish
    for (const [x0, x1] of [[-60, m2x(0)], [m2x(G.L), W + 60]]) { if (x1 <= x0) continue; g.fillStyle = TH.ground; g.fillRect(x0, hz, x1 - x0, H - hz); g.fillStyle = TH.path; g.fillRect(x0, hz - 4, x1 - x0, band + 18); g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x0, base + 14, x1 - x0, 4); }
    // boost pads (track), fast currents (pond), updrafts (ravine)
    for (const bx of R.boosts || []) {
      const x = m2x(bx); if (x < -40 || x > W + 40) continue;
      const gt = secAt(G, bx).type;
      if (gt === 'track') { g.fillStyle = '#ffd23f'; for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) { const yy = base + 2 - r * band * 0.5; g.beginPath(); g.moveTo(x - 20 + i * 14 + r * 8, yy); g.lineTo(x - 10 + i * 14 + r * 8, yy + 5); g.lineTo(x - 20 + i * 14 + r * 8, yy + 10); g.fill(); } }
      else if (gt === 'pond') { g.strokeStyle = '#bff3ff'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 30 + ((t * 60 + i * 20) % 60), base + 18 + i * 8); g.lineTo(x - 14 + ((t * 60 + i * 20) % 60), base + 18 + i * 8); g.stroke(); } }
      else if (gt === 'gap') { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { const yy = base - ((t * 80 + i * 40) % 160); g.beginPath(); g.moveTo(x - 8, yy); g.quadraticCurveTo(x + 8, yy - 10, x - 4, yy - 22); g.stroke(); } }
    }
    // start and finish lines (across every lane)
    for (const [m, label] of [[0, 'START'], [G.L, 'FINISH']]) {
      const x = m2x(m); if (x < -60 || x > W + 60) continue;
      const gh = groundH(G, Math.min(m, G.L - 0.01)) * YK;
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : '#1b1b2b'; g.beginPath(); const y0 = base - gh + 14 - (band + 14) * (i / 6), y1 = base - gh + 14 - (band + 14) * ((i + 1) / 6); g.moveTo(x + (y0 - base) * -0.5, y0); g.lineTo(x + 8 + (y0 - base) * -0.5, y0); g.lineTo(x + 8 + (y1 - base) * -0.5, y1); g.lineTo(x + (y1 - base) * -0.5, y1); g.fill(); }
      const px = x + band * 0.5; for (let y = 0; y < 120; y += 12) { g.fillStyle = (y / 12) % 2 ? '#fff' : '#1b1b2b'; g.fillRect(px, base - gh - band - 120 + y, 8, 12); }
      g.fillStyle = TH.night ? '#fff' : '#1b1240'; g.font = 'bold 18px Fredoka, sans-serif'; g.fillText(label, px - 20, base - gh - band - 128);
    }
    return base;
  }
  // Weather on top of everything (after the ducks).
  function drawRaceWeather(g, W, H, R, t) {
    if (R.weather === 'rain') { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 120; i++) { const rx = (i * 97 + t * 400) % W, ry = (i * 53 + t * 900) % H; g.moveTo(rx, ry); g.lineTo(rx - 4, ry + 14); } g.stroke(); }
    if (R.theme === 'snow') { g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 70; i++) { const sx = (i * 89 + Math.sin(t + i) * 20 + t * 30) % W, sy = (i * 61 + t * 60) % H; g.beginPath(); g.arc(sx, sy, 2.2, 0, TAU); g.fill(); } }
    if (R.weather === 'fog') { g.fillStyle = 'rgba(230,235,240,.35)'; g.fillRect(0, 0, W, H); }
  }

  window.DUCK_ART = { PAL, THEME, drawDuck, duckBox, duckImg, drawEgg, eggImg, drawFarm, drawFox, drawValley, valleyLayout, raceGeometry, groundAt, groundH, secAt, drawRaceWorld, drawRaceWeather, drawRacer, racePose, drawHurdle, SEC_COLORS, MOOD, DECOR_ICON, drawIcon, drawBug, drawBird, moodIcon, ICON_NAMES: Object.keys(ICONS) };
})();
