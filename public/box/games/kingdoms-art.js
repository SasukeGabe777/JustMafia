'use strict';
// JustKingdoms art, all original and drawn in code: hex math (pointy-top axial q,r), textured
// terrain, owner tint + kingdom borders, castles that grow with the age, villages, army banners,
// rockets, the Peace Monument, the round table (lobby) and the medieval title scene.
// Shared by the TV (kingdoms-tv.js) and, if it wants, the phone: window.KINGDOM_ART.
(function () {
  const TAU = Math.PI * 2, SQ3 = Math.sqrt(3);
  const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const rnd = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

  // ---------- colour helpers ----------
  function rgb(hex) {
    const h = String(hex || '#888').replace('#', '');
    const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  }
  const rgba = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
  const shade = (hex, f) => { const [r, g, b] = rgb(hex); const m = (v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); return `rgb(${m(r)},${m(g)},${m(b)})`; };
  const lum = (hex) => { const [r, g, b] = rgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const inkOn = (hex) => (lum(hex) > 0.62 ? '#2a1a08' : '#fffaf0');
  const ALLY_COLORS = ['#ffe27a', '#9ff0ff', '#ffb3f0', '#b8ff9a', '#ffc58a', '#c9b8ff', '#ffffff'];
  const allyColor = (id) => ALLY_COLORS[(parseInt(String(id || '').replace(/\D/g, ''), 10) || 0) % ALLY_COLORS.length];

  // ---------- hex math (pointy-top, axial) ----------
  const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  // edge k faces DIRS[k]; its corners sit at these angles (degrees, y down)
  const EDGE = [[-30, 30], [-90, -30], [-150, -90], [150, 210], [90, 150], [30, 90]];
  const toPx = (q, r, L) => [L.ox + L.s * SQ3 * (q + r / 2), L.oy + L.s * 1.5 * r];
  // Fit a world of radius R into a box (x, y, w, h).
  function fit(R, x, y, w, h) {
    const s = Math.max(4, Math.min(w / (SQ3 * (2 * R + 1)), h / (3 * R + 2)));
    return { s, ox: x + w / 2, oy: y + h / 2, R };
  }
  function hexPath(g, x, y, s) {
    g.beginPath();
    for (let i = 0; i < 6; i++) { const a = ((60 * i - 30) * Math.PI) / 180; const px = x + s * Math.cos(a), py = y + s * Math.sin(a); i ? g.lineTo(px, py) : g.moveTo(px, py); }
    g.closePath();
  }
  const corner = (x, y, s, deg) => [x + s * Math.cos((deg * Math.PI) / 180), y + s * Math.sin((deg * Math.PI) / 180)];

  // ---------- terrain ----------
  const TERR = {
    p: { base: '#b7cc68', edge: '#9db552' }, f: { base: '#6b9b4c', edge: '#557f3b' }, h: { base: '#bfa271', edge: '#a3875a' },
    g: { base: '#c2a56a', edge: '#a58a50' }, l: { base: '#4f97c8', edge: '#3d7fae' }, m: { base: '#8d8c88', edge: '#74736f' }, r: { base: '#d3c49a', edge: '#b9a97c' },
  };
  function tree(g, x, y, k, c1, c2) {
    g.fillStyle = '#5a3b1e'; g.fillRect(x - k * 0.08, y - k * 0.05, k * 0.16, k * 0.3);
    g.fillStyle = c1; g.beginPath(); g.moveTo(x, y - k); g.lineTo(x + k * 0.45, y + 0.05 * k); g.lineTo(x - k * 0.45, y + 0.05 * k); g.closePath(); g.fill();
    g.fillStyle = c2; g.beginPath(); g.moveTo(x, y - k); g.lineTo(x - k * 0.45, y + 0.05 * k); g.lineTo(x - k * 0.05, y + 0.05 * k); g.closePath(); g.fill();
  }
  function mountain(g, x, y, w, h) {
    g.fillStyle = '#6f6d69'; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - h); g.lineTo(x + w / 2, y); g.closePath(); g.fill();
    g.fillStyle = '#9b9994'; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w / 2, y); g.lineTo(x + w * 0.08, y); g.closePath(); g.fill();
    g.fillStyle = '#f4f6fb'; g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + w * 0.16, y - h * 0.66); g.lineTo(x + w * 0.04, y - h * 0.72); g.lineTo(x - w * 0.06, y - h * 0.62); g.lineTo(x - w * 0.16, y - h * 0.68); g.closePath(); g.fill();
  }
  // One terrain hex with its texture (static: drawn once into the cached map layer).
  function drawTerrain(g, T, x, y, s) {
    const P = TERR[T.t] || TERR.p, R = rnd(Math.floor(hash(T.q + 50, T.r + 50) * 1e9));
    hexPath(g, x, y, s);
    const gr = g.createLinearGradient(x, y - s, x, y + s); gr.addColorStop(0, shade(P.base, 0.08)); gr.addColorStop(1, P.edge);
    g.fillStyle = gr; g.fill();
    g.save(); hexPath(g, x, y, s * 0.97); g.clip();
    const k = s;
    if (T.t === 'p') {
      g.strokeStyle = 'rgba(222,190,80,.9)'; g.lineWidth = Math.max(1, k * 0.045); g.lineCap = 'round';
      for (let i = 0, n = 9 + Math.floor(k / 10); i < n; i++) {
        const px = x + (R() - 0.5) * k * 1.3, py = y + (R() - 0.5) * k * 1.2;
        for (let j = -1; j <= 1; j++) { g.beginPath(); g.moveTo(px + j * k * 0.06, py + k * 0.1); g.quadraticCurveTo(px + j * k * 0.08, py - k * 0.05, px + j * k * 0.12, py - k * 0.12); g.stroke(); }
      }
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x - k, y - k * 0.2, k * 2, k * 0.12);
    } else if (T.t === 'f') {
      const pts = []; for (let i = 0, n = 7 + Math.floor(k / 14); i < n; i++) pts.push([x + (R() - 0.5) * k * 1.25, y + (R() - 0.5) * k * 1.15]);
      pts.sort((a, b) => a[1] - b[1]);
      for (const [px, py] of pts) tree(g, px, py + k * 0.15, k * (0.36 + R() * 0.14), R() < 0.5 ? '#2f6f35' : '#377d3a', '#4f9a4a');
    } else if (T.t === 'h' || T.t === 'g') {
      for (let i = 0; i < 3; i++) {
        const px = x + (i - 1) * k * 0.5 + (R() - 0.5) * k * 0.2, py = y + (i === 1 ? -k * 0.15 : k * 0.25), w = k * (0.6 + R() * 0.3);
        g.fillStyle = shade(P.base, -0.18); g.beginPath(); g.ellipse(px, py, w / 2, w * 0.32, 0, Math.PI, 0); g.fill();
        g.fillStyle = shade(P.base, 0.18); g.beginPath(); g.ellipse(px - w * 0.08, py - w * 0.04, w * 0.28, w * 0.18, 0, Math.PI, 0); g.fill();
      }
      if (T.t === 'g') {
        g.strokeStyle = '#ffd84a'; g.lineWidth = Math.max(1.2, k * 0.07); g.lineCap = 'round';
        for (let i = 0; i < 3; i++) { g.beginPath(); let px = x + (R() - 0.5) * k, py = y + (R() - 0.5) * k; g.moveTo(px, py); for (let j = 0; j < 3; j++) { px += (R() - 0.3) * k * 0.3; py += (R() - 0.5) * k * 0.3; g.lineTo(px, py); } g.stroke(); }
        g.fillStyle = '#fff3a8'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(x + (R() - 0.5) * k, y + (R() - 0.5) * k, k * 0.06, 0, TAU); g.fill(); }
      }
    } else if (T.t === 'l') {
      const gl = g.createRadialGradient(x, y, k * 0.1, x, y, k); gl.addColorStop(0, '#79b9e6'); gl.addColorStop(1, '#3b7fb2'); g.fillStyle = gl; g.fill();
      g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = Math.max(1, k * 0.05);
      for (let i = 0; i < 3; i++) { const px = x + (R() - 0.5) * k, py = y + (R() - 0.5) * k * 0.9; g.beginPath(); g.moveTo(px - k * 0.18, py); g.quadraticCurveTo(px - k * 0.09, py - k * 0.08, px, py); g.quadraticCurveTo(px + k * 0.09, py + k * 0.08, px + k * 0.18, py); g.stroke(); }
    } else if (T.t === 'm') {
      mountain(g, x - k * 0.32, y + k * 0.45, k * 0.9, k * 0.85);
      mountain(g, x + k * 0.3, y + k * 0.5, k * 0.8, k * 0.7);
      mountain(g, x + k * 0.02, y + k * 0.3, k * 1.0, k * 1.05);
    } else if (T.t === 'r') {
      g.strokeStyle = 'rgba(120,100,60,.35)'; g.lineWidth = 1;
      for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(x - k, y + i * k * 0.25); g.lineTo(x + k, y + i * k * 0.25); g.stroke(); }
      const col = (px, h) => { g.fillStyle = '#efe6cc'; g.fillRect(px - k * 0.08, y + k * 0.3 - h, k * 0.16, h); g.fillStyle = '#c8bb94'; g.fillRect(px + k * 0.02, y + k * 0.3 - h, k * 0.06, h); g.fillStyle = '#f7f0dc'; g.fillRect(px - k * 0.11, y + k * 0.3 - h - k * 0.06, k * 0.22, k * 0.07); };
      col(x - k * 0.45, k * 0.5); col(x - k * 0.15, k * 0.75); col(x + k * 0.15, k * 0.6); col(x + k * 0.45, k * 0.3);
      g.fillStyle = '#efe6cc'; g.fillRect(x - k * 0.55, y - k * 0.5, k * 0.75, k * 0.08);
      g.fillStyle = '#e4d9b9'; g.beginPath(); g.ellipse(x + k * 0.35, y + k * 0.45, k * 0.18, k * 0.07, 0.3, 0, TAU); g.fill();
    }
    g.restore();
    if (T.x) { // rich heartland: golden inner glow
      hexPath(g, x, y, s * 0.86); g.strokeStyle = 'rgba(255,220,90,.55)'; g.lineWidth = Math.max(1.5, s * 0.07); g.stroke();
    }
    hexPath(g, x, y, s); g.strokeStyle = 'rgba(40,28,10,.16)'; g.lineWidth = 1; g.stroke();
  }

  // Owner tint and a clean outer border per kingdom (static layer). tiles: [{q,r,o}], colorOf(id)
  function drawOwnership(g, tiles, L, colorOf) {
    const idx = new Map(); for (const T of tiles) idx.set(T.q + ',' + T.r, T);
    for (const T of tiles) {
      if (!T.o) continue; const c = colorOf(T.o); if (!c) continue;
      const [x, y] = toPx(T.q, T.r, L);
      hexPath(g, x, y, L.s); g.fillStyle = rgba(c, T.t === 'l' || T.t === 'm' ? 0.18 : 0.3); g.fill();
    }
    const lw = Math.max(2, L.s * 0.13);
    g.lineCap = 'round';
    for (const pass of [0, 1]) for (const T of tiles) {
      if (!T.o) continue; const c = colorOf(T.o); if (!c) continue;
      const [x, y] = toPx(T.q, T.r, L);
      for (let k = 0; k < 6; k++) {
        const N = idx.get((T.q + DIRS[k][0]) + ',' + (T.r + DIRS[k][1]));
        if (N && N.o === T.o) continue;
        const inset = L.s - lw * 0.55;
        const [ax, ay] = corner(x, y, inset, EDGE[k][0]), [bx, by] = corner(x, y, inset, EDGE[k][1]);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by);
        if (pass === 0) { g.strokeStyle = 'rgba(25,14,4,.55)'; g.lineWidth = lw + 2.5; } else { g.strokeStyle = shade(c, 0.05); g.lineWidth = lw; }
        g.stroke();
      }
    }
  }

  // ---------- buildings ----------
  function house(g, x, y, w, roof, wall = '#e9d9b4') {
    const h = w * 0.62;
    g.fillStyle = wall; g.fillRect(x - w / 2, y - h, w, h);
    g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + w * 0.15, y - h, w * 0.35, h);
    g.fillStyle = roof; g.beginPath(); g.moveTo(x - w * 0.62, y - h); g.lineTo(x, y - h - w * 0.55); g.lineTo(x + w * 0.62, y - h); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.moveTo(x, y - h - w * 0.55); g.lineTo(x + w * 0.62, y - h); g.lineTo(x + w * 0.1, y - h); g.closePath(); g.fill();
    g.fillStyle = '#5a3a1c'; g.fillRect(x - w * 0.12, y - h * 0.5, w * 0.24, h * 0.5);
  }
  function crenels(g, x, y, w, k, col) { g.fillStyle = col; const n = Math.max(2, Math.round(w / k)); const cw = w / (2 * n - 1); for (let i = 0; i < n; i++) g.fillRect(x - w / 2 + i * 2 * cw, y - k * 0.7, cw, k * 0.7); }
  function tower(g, x, y, w, h, roof, stone = '#c9c2b2', cone = true) {
    g.fillStyle = stone; g.fillRect(x - w / 2, y - h, w, h);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + w * 0.12, y - h, w * 0.38, h);
    g.fillStyle = 'rgba(40,30,20,.55)'; g.fillRect(x - w * 0.1, y - h * 0.7, w * 0.2, h * 0.16);
    if (cone) {
      g.fillStyle = roof; g.beginPath(); g.moveTo(x - w * 0.62, y - h); g.lineTo(x, y - h - w * 1.15); g.lineTo(x + w * 0.62, y - h); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.moveTo(x, y - h - w * 1.15); g.lineTo(x + w * 0.62, y - h); g.lineTo(x + w * 0.08, y - h); g.closePath(); g.fill();
    } else crenels(g, x, y - h, w * 1.1, w * 0.3, stone);
  }
  // `crest` (optional, shop gear: public/shared/gear.js kingdoms/crest paint): an emoji emblem on the
  // flag, with a gold ring and glow when crest.glow. Without it the flag is drawn exactly as before.
  function flag(g, x, y, h, color, t, big = 1, crest) {
    g.strokeStyle = '#3a2810'; g.lineWidth = Math.max(1, h * 0.06); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.stroke();
    const fw = h * 0.7 * big, fh = h * 0.38 * big, top = y - h;
    g.fillStyle = color; g.beginPath(); g.moveTo(x, top);
    for (let i = 1; i <= 6; i++) { const u = i / 6; g.lineTo(x + fw * u, top + Math.sin(t * 6 - u * 4) * fh * 0.18 * u); }
    for (let i = 6; i >= 0; i--) { const u = i / 6; g.lineTo(x + fw * u, top + fh + Math.sin(t * 6 - u * 4) * fh * 0.18 * u); }
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
    if (crest && crest.icon) emblem(g, x + fw * 0.5, top + fh * 0.5 + Math.sin(t * 6 - 2) * fh * 0.09, fh * 0.95, crest, h);
  }
  // A crest emblem: a pale disc with the emoji on it (gold ring and glow for shiny crests).
  function emblem(g, cx, cy, size, crest, h) {
    const r = size * 0.55; g.save();
    if (crest.glow) { g.shadowColor = '#ffd34d'; g.shadowBlur = Math.max(4, h * 0.25); }
    g.fillStyle = 'rgba(255,248,225,.92)'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); g.shadowBlur = 0;
    g.strokeStyle = crest.glow ? '#e0a400' : 'rgba(40,25,10,.6)'; g.lineWidth = Math.max(1, r * 0.16); g.stroke();
    g.font = `${Math.max(6, Math.round(r * 1.45))}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
    g.fillText(crest.icon, cx, cy + r * 0.08); g.textBaseline = 'alphabetic'; g.restore();
  }
  // A capital: grows from a hamlet (age 1) to a grand castle (age 5). walls 0-3 draw a ring.
  // Where a capital's banner flies (so the TV can wave it on top of a cached castle).
  function castleFlag(x, y, s, age) {
    const k = s * (0.95 + age * 0.06), by = y + k * 0.3;
    if (age <= 1) return { x: x + k * 0.05, y: by - k * 0.35, h: k * 0.75, big: 1 };
    if (age === 2) return { x, y: by - k * 1.3, h: k * 0.5, big: 1 };
    const kh = k * (0.7 + age * 0.12);
    return { x, y: by - k * 0.3 - kh - k * (age === 5 ? 0.57 : 0.5), h: k * 0.5, big: age === 5 ? 1.2 : 1 };
  }
  function drawCastle(g, x, y, s, age, color, walls, t, noFlag) {
    age = Math.max(1, Math.min(5, age || 1));
    const k = s * (0.95 + age * 0.06), roof = shade(color, -0.12), stone = age >= 3 ? '#d4cdbd' : '#b89b6e';
    g.save();
    // ground shadow + plot
    g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(x, y + k * 0.32, k * 0.8, k * 0.26, 0, 0, TAU); g.fill();
    if (walls > 0) {
      g.fillStyle = 'rgba(120,110,95,.35)'; g.beginPath(); g.ellipse(x, y + k * 0.18, k * 0.86, k * 0.42, 0, 0, TAU); g.fill();
    }
    const by = y + k * 0.3;
    if (age <= 1) {
      house(g, x - k * 0.3, by - k * 0.02, k * 0.42, roof); house(g, x + k * 0.28, by + k * 0.04, k * 0.38, shade(roof, -0.15)); house(g, x - k * 0.02, by - k * 0.22, k * 0.36, '#c9963f');
    } else if (age === 2) {
      // wooden keep and palisade
      g.fillStyle = '#8a5c2f'; for (let i = -4; i <= 4; i++) { g.fillRect(x + i * k * 0.13 - k * 0.05, by - k * 0.35, k * 0.1, k * 0.35); g.beginPath(); g.moveTo(x + i * k * 0.13 - k * 0.05, by - k * 0.35); g.lineTo(x + i * k * 0.13, by - k * 0.45); g.lineTo(x + i * k * 0.13 + k * 0.05, by - k * 0.35); g.fill(); }
      tower(g, x, by - k * 0.1, k * 0.4, k * 0.75, roof, '#a87a46');
      house(g, x - k * 0.42, by, k * 0.3, shade(roof, -0.1)); house(g, x + k * 0.44, by, k * 0.3, shade(roof, -0.1));
    } else {
      const n = age === 3 ? 2 : age === 4 ? 3 : 4;
      // curtain wall + keep
      g.fillStyle = stone; g.fillRect(x - k * 0.62, by - k * 0.42, k * 1.24, k * 0.42);
      crenels(g, x, by - k * 0.42, k * 1.24, k * 0.13, stone);
      g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x - k * 0.62, by - k * 0.12, k * 1.24, k * 0.12);
      g.fillStyle = '#4a3420'; g.beginPath(); g.moveTo(x - k * 0.12, by); g.lineTo(x - k * 0.12, by - k * 0.2); g.arc(x, by - k * 0.2, k * 0.12, Math.PI, 0); g.lineTo(x + k * 0.12, by); g.fill();
      const kh = k * (0.7 + age * 0.12);
      tower(g, x, by - k * 0.3, k * 0.46, kh, roof, stone, age < 5);
      if (age === 5) { // grand keep: crown of turrets
        tower(g, x - k * 0.14, by - k * 0.3 - kh, k * 0.16, k * 0.22, roof, stone); tower(g, x + k * 0.14, by - k * 0.3 - kh, k * 0.16, k * 0.22, roof, stone);
        tower(g, x, by - k * 0.3 - kh, k * 0.2, k * 0.34, '#ffd34d', stone);
      }
      const side = n === 2 ? [-0.6, 0.6] : n === 3 ? [-0.62, 0.62, 0] : [-0.66, 0.66, -0.36, 0.36];
      side.forEach((u, i) => { if (u === 0) return; const hh = k * (0.62 + (i >= 2 ? 0.18 : 0) + age * 0.04); tower(g, x + u * k, by - (i >= 2 ? k * 0.22 : 0), k * 0.26, hh, i >= 2 ? shade(roof, 0.12) : roof, stone); });
    }
    if (walls > 0) { // front wall arc, thicker with level
      g.strokeStyle = '#8e877a'; g.lineWidth = Math.max(1.5, k * (0.05 + walls * 0.035));
      g.beginPath(); g.ellipse(x, y + k * 0.18, k * 0.86, k * 0.42, 0, 0.1, Math.PI - 0.1); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = Math.max(1, k * 0.025); g.beginPath(); g.ellipse(x, y + k * 0.16, k * 0.86, k * 0.42, 0, 0.2, Math.PI - 0.2); g.stroke();
      for (const a of [0.35, 1.57, 2.79]) { const px = x + Math.cos(a) * k * 0.86, py = y + k * 0.18 + Math.sin(a) * k * 0.42; g.fillStyle = '#9d968a'; g.fillRect(px - k * 0.07, py - k * 0.16, k * 0.14, k * 0.18); }
    }
    if (!noFlag) { const F = castleFlag(x, y, s, age); flag(g, F.x, F.y, F.h, color, t, F.big); }
    g.restore();
  }
  // A village: 1-3 houses by level, roofs in the owner's colour, walls as a little ring.
  function drawVillage(g, x, y, s, level, color, walls) {
    const k = s * 0.7, roof = shade(color, -0.2);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(x, y + k * 0.35, k * 0.95, k * 0.32, 0, 0, TAU); g.fill();
    if (walls > 0) { g.strokeStyle = '#8e877a'; g.lineWidth = Math.max(1.2, k * 0.08 * walls); g.beginPath(); g.ellipse(x, y + k * 0.2, k * 1.0, k * 0.5, 0, 0, TAU); g.stroke(); }
    const spots = level >= 3 ? [[-0.42, 0.28], [0.42, 0.3], [0, 0.0]] : level === 2 ? [[-0.3, 0.25], [0.32, 0.2]] : [[0, 0.25]];
    spots.sort((a, b) => a[1] - b[1]).forEach(([u, v], i) => house(g, x + u * k, y + v * k, k * (0.62 + (i === spots.length - 1 ? 0.06 : 0)), i % 2 ? roof : shade(roof, 0.15)));
  }
  function badge(g, x, y, text, s, bg = 'rgba(30,18,6,.82)', fg = '#fff3d6') {
    g.font = `700 ${Math.round(s)}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = Math.max(s * 1.25, g.measureText(text).width + s * 0.6), h = s * 1.3;
    g.fillStyle = bg; roundRect(g, x - w / 2, y - h / 2, w, h, h / 2); g.fill();
    g.fillStyle = fg; g.fillText(text, x, y + 1); g.textBaseline = 'alphabetic';
    return w;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // ---------- armies ----------
  const UNIT_ICON = { militia: '🗡️', spear: '🔱', archer: '🏹', knight: '🐎', catapult: '☄️', guard: '🛡️', scout: '🔭', settlers: '🛻', peasant: '🧑‍🌾', bandits: '☠️' };
  // A marching banner: pole + waving flag in the owner's colour with the head count.
  function drawArmy(g, x, y, s, color, kind, n, t, bandit, crest) { // crest: optional shop-gear emblem (see flag)
    const k = Math.max(10, s * 0.9);
    const bob = Math.abs(Math.sin(t * 7)) * k * 0.05;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y + k * 0.08, k * 0.38, k * 0.12, 0, 0, TAU); g.fill();
    // little soldiers
    const m = Math.min(4, 1 + Math.floor(Math.log2(Math.max(1, n))));
    for (let i = 0; i < m; i++) {
      const sx = x - k * 0.28 + (i % 2) * k * 0.2 + Math.floor(i / 2) * k * 0.08, sy = y - (i % 2) * k * 0.08 - Math.abs(Math.sin(t * 9 + i)) * k * 0.05;
      g.fillStyle = bandit ? '#2b2b2b' : shade(color, -0.25); g.fillRect(sx - k * 0.06, sy - k * 0.28, k * 0.12, k * 0.24);
      g.fillStyle = '#f0c9a0'; g.beginPath(); g.arc(sx, sy - k * 0.34, k * 0.065, 0, TAU); g.fill();
      g.strokeStyle = '#ddd'; g.lineWidth = Math.max(1, k * 0.03); g.beginPath(); g.moveTo(sx + k * 0.08, sy - k * 0.02); g.lineTo(sx + k * 0.08, sy - k * 0.5); g.stroke();
    }
    const px = x + k * 0.12, py = y - bob;
    g.strokeStyle = '#2d1d0a'; g.lineWidth = Math.max(1.5, k * 0.07); g.beginPath(); g.moveTo(px, py); g.lineTo(px, py - k * 1.15); g.stroke();
    const fw = k * 0.95, fh = k * 0.55, top = py - k * 1.15, fc = bandit ? '#151515' : color;
    g.fillStyle = fc; g.beginPath(); g.moveTo(px, top);
    for (let i = 1; i <= 6; i++) { const u = i / 6; g.lineTo(px + fw * u, top + Math.sin(t * 7 - u * 4) * fh * 0.16 * u); }
    g.lineTo(px + fw * 0.85, top + fh * 0.5);
    for (let i = 6; i >= 0; i--) { const u = i / 6; g.lineTo(px + fw * u, top + fh + Math.sin(t * 7 - u * 4) * fh * 0.16 * u); }
    g.closePath(); g.fill(); g.strokeStyle = bandit ? '#c33' : 'rgba(0,0,0,.45)'; g.lineWidth = 1.2; g.stroke();
    g.font = `800 ${Math.round(fh * 0.72)}px Fredoka, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = bandit ? '#fff' : inkOn(color); g.fillText(bandit ? '☠ ' + n : String(n), px + fw * 0.42, top + fh * 0.52);
    g.textBaseline = 'alphabetic';
    if (!bandit && UNIT_ICON[kind]) { g.font = `${Math.round(k * 0.42)}px serif`; g.fillText(UNIT_ICON[kind], x - k * 0.42, y - k * 0.62); }
    if (!bandit && crest && crest.icon) emblem(g, px, top - fh * 0.15, fh * 0.6, crest, k);
  }

  // ---------- rocket & launch pad ----------
  function drawRocket(g, x, y, h, stages, t, flame, building) {
    const w = h * 0.26;
    const segH = h / 3;
    for (let i = 0; i < 3; i++) {
      const y0 = y - segH * (i + 1), built = i < stages, b = i === stages && building;
      if (!built && !b) continue;
      if (b) { g.setLineDash([3, 3]); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.5; g.strokeRect(x - w / 2, y0, w, segH); g.setLineDash([]); continue; }
      g.fillStyle = i === 2 ? '#f4f4f4' : '#e6e6ea'; g.fillRect(x - w / 2, y0, w, segH);
      g.fillStyle = i === 1 ? '#e94b3c' : '#c9ccd6'; g.fillRect(x - w / 2, y0 + segH * 0.38, w, segH * 0.2);
      if (i === 2) { g.fillStyle = '#e94b3c'; g.beginPath(); g.moveTo(x - w / 2, y0); g.lineTo(x, y0 - w * 1.2); g.lineTo(x + w / 2, y0); g.closePath(); g.fill(); g.fillStyle = '#7fd3ff'; g.beginPath(); g.arc(x, y0 + segH * 0.25, w * 0.18, 0, TAU); g.fill(); }
      if (i === 0) { g.fillStyle = '#e94b3c'; g.beginPath(); g.moveTo(x - w / 2, y0 + segH); g.lineTo(x - w, y0 + segH * 1.15); g.lineTo(x - w / 2, y0 + segH * 0.5); g.fill(); g.beginPath(); g.moveTo(x + w / 2, y0 + segH); g.lineTo(x + w, y0 + segH * 1.15); g.lineTo(x + w / 2, y0 + segH * 0.5); g.fill(); }
    }
    if (flame) {
      const fl = h * (0.35 + Math.sin(t * 40) * 0.06);
      const gr = g.createLinearGradient(x, y, x, y + fl); gr.addColorStop(0, '#fff7c2'); gr.addColorStop(0.4, '#ffb02e'); gr.addColorStop(1, 'rgba(255,60,20,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(x - w * 0.42, y); g.quadraticCurveTo(x, y + fl * 1.3, x + w * 0.42, y); g.closePath(); g.fill();
    }
  }
  function drawLaunchPad(g, x, y, s, stages, building, t) {
    const k = s * 0.6;
    g.fillStyle = '#6d6f78'; g.fillRect(x - k * 0.55, y - k * 0.08, k * 1.1, k * 0.16);
    g.strokeStyle = '#a14a2a'; g.lineWidth = Math.max(1, k * 0.05);
    g.beginPath(); g.moveTo(x + k * 0.38, y); g.lineTo(x + k * 0.38, y - k * 1.6); g.stroke();
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(x + k * 0.38, y - i * k * 0.27); g.lineTo(x + k * 0.22, y - i * k * 0.27 - k * 0.1); g.stroke(); }
    drawRocket(g, x, y - k * 0.08, k * 1.5, stages, t, false, building);
  }

  // ---------- Peace Monument ----------
  function drawMonument(g, x, y, s, pct, t) {
    const k = s * 1.1, h = k * 1.25;
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.ellipse(x, y + k * 0.1, k * 0.6, k * 0.16, 0, 0, TAU); g.fill();
    // ghost outline of the finished monument
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.setLineDash([3, 3]); g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x - k * 0.22, y); g.lineTo(x - k * 0.12, y - h); g.lineTo(x, y - h - k * 0.18); g.lineTo(x + k * 0.12, y - h); g.lineTo(x + k * 0.22, y); g.closePath(); g.stroke(); g.setLineDash([]);
    const top = y - h * Math.max(0, Math.min(1, pct));
    g.save(); g.beginPath(); g.rect(x - k, top, k * 2, y - top + 1); g.clip();
    const gr = g.createLinearGradient(x - k * 0.22, 0, x + k * 0.22, 0); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#cfc5ad');
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - k * 0.22, y); g.lineTo(x - k * 0.12, y - h); g.lineTo(x, y - h - k * 0.18); g.lineTo(x + k * 0.12, y - h); g.lineTo(x + k * 0.22, y); g.closePath(); g.fill();
    g.restore();
    g.fillStyle = '#e8dfc6'; g.fillRect(x - k * 0.34, y - k * 0.08, k * 0.68, k * 0.12);
    if (pct >= 1) { g.font = `${Math.round(k * 0.5)}px serif`; g.textAlign = 'center'; g.fillText('🕊️', x + Math.sin(t * 2) * k * 0.3, y - h - k * 0.4 + Math.cos(t * 3) * 4); }
  }

  // ---------- the round table (lobby) ----------
  // Seat i sits where its kingdom will be on the world map: seat 0 at the lower left, going
  // counter-clockwise on screen (right along the bottom, then up the right side). Screen angle, y down.
  const seatAngle = (i, N) => ((120 - (360 * i) / Math.max(1, N)) * Math.PI) / 180;
  // The table in parts so a screen can cache the static ones: rug → chairs → top → candles.
  function tableRug(g, cx, cy, rad) {
    g.fillStyle = 'rgba(120,30,30,.35)'; g.beginPath(); g.arc(cx, cy, rad * 1.62, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(230,190,90,.45)'; g.lineWidth = rad * 0.025; g.beginPath(); g.arc(cx, cy, rad * 1.55, 0, TAU); g.stroke();
  }
  function tableChairs(g, cx, cy, rad, seats, t, pops = {}) {
    const N = seats.length;
    const chairR = rad * 1.18;
    const pos = seats.map((p, i) => { const a = seatAngle(i, N); return { a, x: cx + Math.cos(a) * chairR, y: cy + Math.sin(a) * chairR }; });
    const cw = Math.min(rad * 0.42, (TAU * chairR) / Math.max(N, 1) * 0.72);
    seats.forEach((p, i) => {
      const { a, x, y } = pos[i]; const pop = pops[i] != null ? Math.max(0, 1 - (t - pops[i]) / 0.6) : 0;
      g.save(); g.translate(x, y); g.rotate(a - Math.PI / 2); g.scale(1 + pop * 0.35, 1 + pop * 0.35);
      if (!p) {
        const glow = 0.45 + Math.sin(t * 3 + i) * 0.25;
        g.shadowColor = `rgba(255,214,90,${glow})`; g.shadowBlur = cw * 0.5;
      }
      // chair back + seat
      g.fillStyle = '#6b4220'; roundRect(g, -cw * 0.5, cw * 0.18, cw, cw * 0.28, cw * 0.1); g.fill();
      g.fillStyle = '#8a5a2e'; roundRect(g, -cw * 0.42, -cw * 0.3, cw * 0.84, cw * 0.56, cw * 0.12); g.fill();
      g.shadowBlur = 0;
      if (p) {
        g.fillStyle = p.color; roundRect(g, -cw * 0.36, -cw * 0.24, cw * 0.72, cw * 0.44, cw * 0.1); g.fill();
        // a person from above: shoulders + head
        g.fillStyle = shade(p.color, -0.25); g.beginPath(); g.ellipse(0, cw * 0.02, cw * 0.36, cw * 0.17, 0, 0, TAU); g.fill();
        g.fillStyle = '#f0c9a0'; g.beginPath(); g.arc(0, -cw * 0.02, cw * 0.15, 0, TAU); g.fill();
        g.fillStyle = '#5a3a1c'; g.beginPath(); g.arc(0, cw * 0.03, cw * 0.15, 0, Math.PI); g.fill();
        g.strokeStyle = '#ffd34d'; g.lineWidth = Math.max(1.5, cw * 0.05); g.beginPath(); g.arc(0, -cw * 0.02, cw * 0.11, 0, TAU); g.stroke();
      } else {
        g.strokeStyle = `rgba(255,224,130,${0.5 + Math.sin(t * 3 + i) * 0.3})`; g.lineWidth = Math.max(1.5, cw * 0.05); g.setLineDash([cw * 0.08, cw * 0.06]);
        roundRect(g, -cw * 0.36, -cw * 0.24, cw * 0.72, cw * 0.44, cw * 0.1); g.stroke(); g.setLineDash([]);
      }
      g.restore();
    });
    return pos.map((p, i) => ({ ...p, cw, i }));
  }
  function tableTop(g, cx, cy, rad, seats) {
    const N = seats.length;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(cx + rad * 0.03, cy + rad * 0.05, rad * 1.02, 0, TAU); g.fill();
    const wood = g.createRadialGradient(cx - rad * 0.3, cy - rad * 0.3, rad * 0.1, cx, cy, rad);
    wood.addColorStop(0, '#b47a43'); wood.addColorStop(0.7, '#8d5a2c'); wood.addColorStop(1, '#6e431f');
    g.fillStyle = wood; g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.clip();
    g.strokeStyle = 'rgba(60,32,10,.28)'; g.lineWidth = Math.max(1, rad * 0.006);
    for (let i = -10; i <= 10; i++) { const yy = cy + i * rad * 0.1; g.beginPath(); g.moveTo(cx - rad, yy); for (let x = -rad; x <= rad; x += rad * 0.1) g.lineTo(cx + x, yy + Math.sin(x * 0.03 + i) * rad * 0.015); g.stroke(); }
    g.restore();
    g.strokeStyle = '#4e2e12'; g.lineWidth = rad * 0.05; g.beginPath(); g.arc(cx, cy, rad * 0.975, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,215,140,.35)'; g.lineWidth = rad * 0.012; g.beginPath(); g.arc(cx, cy, rad * 0.93, 0, TAU); g.stroke();
    // the world map rolled out in the middle
    const mw = rad * 0.95, mh = rad * 0.68;
    g.save(); g.translate(cx, cy); g.rotate(-0.05);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-mw / 2 + 5, -mh / 2 + 6, mw, mh);
    const parch = g.createLinearGradient(0, -mh / 2, 0, mh / 2); parch.addColorStop(0, '#f3e3bb'); parch.addColorStop(1, '#e2c88e');
    g.fillStyle = parch; g.fillRect(-mw / 2, -mh / 2, mw, mh);
    g.fillStyle = '#c9a463'; g.fillRect(-mw / 2 - rad * 0.03, -mh / 2 - rad * 0.02, rad * 0.06, mh + rad * 0.04); g.fillRect(mw / 2 - rad * 0.03, -mh / 2 - rad * 0.02, rad * 0.06, mh + rad * 0.04);
    const hs = mh * 0.09, Lm = { s: hs, ox: 0, oy: 0 };
    for (let r = -3; r <= 3; r++) for (let q = -3; q <= 3; q++) {
      if (Math.abs(q + r) > 3) continue; const [x, y] = toPx(q, r, Lm); const d = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
      hexPath(g, x, y, hs * 0.94); const hv = hash(q + 9, r + 9); g.fillStyle = d === 0 ? '#d8c08a' : hv < 0.15 ? '#8fb6c9' : hv < 0.45 ? '#9fb26a' : hv < 0.7 ? '#b9c27c' : '#c7ad7a'; g.fill();
    }
    // seat markers on the map: where each seated kingdom will start
    const mr = hs * 0.42 * Math.min(1, Math.sqrt(10 / Math.max(1, N)));
    seats.forEach((p, i) => { if (!p) return; const a = seatAngle(i, N); const x = Math.cos(a) * mh * 0.36, y = Math.sin(a) * mh * 0.36 + mh * 0.04; g.fillStyle = p.color; g.beginPath(); g.arc(x, y, mr, 0, TAU); g.fill(); g.strokeStyle = '#3a2408'; g.lineWidth = 1.2; g.stroke(); });
    g.fillStyle = '#7a4e1e'; g.font = `700 ${Math.round(mh * 0.08)}px 'Cinzel', serif`; g.textAlign = 'center'; g.fillText('THE KNOWN WORLD', 0, -mh * 0.39);
    g.restore();
    const goblet = (x, y) => { g.fillStyle = '#d9a93c'; g.beginPath(); g.arc(x, y, rad * 0.035, 0, TAU); g.fill(); g.fillStyle = '#7a1f2a'; g.beginPath(); g.arc(x, y, rad * 0.024, 0, TAU); g.fill(); };
    goblet(cx - rad * 0.5, cy + rad * 0.5); goblet(cx + rad * 0.55, cy - rad * 0.5); goblet(cx - rad * 0.15, cy - rad * 0.62);
  }
  function tableCandles(g, cx, cy, rad, t) {
    const candle = (x, y) => { g.fillStyle = '#f5ecd6'; g.fillRect(x - rad * 0.018, y - rad * 0.07, rad * 0.036, rad * 0.07); const fl = rad * (0.03 + Math.sin(t * 9 + x) * 0.006); const gr = g.createRadialGradient(x, y - rad * 0.09, 1, x, y - rad * 0.09, rad * 0.09); gr.addColorStop(0, 'rgba(255,220,120,.6)'); gr.addColorStop(1, 'rgba(255,200,80,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y - rad * 0.09, rad * 0.09, 0, TAU); g.fill(); g.fillStyle = '#ffcf4a'; g.beginPath(); g.ellipse(x, y - rad * 0.085, rad * 0.013, fl, 0, 0, TAU); g.fill(); };
    candle(cx - rad * 0.62, cy - rad * 0.3); candle(cx + rad * 0.64, cy + rad * 0.28); candle(cx + rad * 0.1, cy + rad * 0.6);
  }
  function drawTable(g, cx, cy, rad, seats, t, pops = {}) {
    tableRug(g, cx, cy, rad);
    const pos = tableChairs(g, cx, cy, rad, seats, t, pops);
    tableTop(g, cx, cy, rad, seats); tableCandles(g, cx, cy, rad, t);
    return pos;
  }

  // ---------- the title scene ----------
  const TITLE_KINGS = ['#e94b3c', '#3e7bfa', '#2fb36b', '#f2b705', '#a35cf0'];
  const titleCache = { sig: '', sky: null, vig: null };
  function titleLayers(W, H) {
    const sig = W + 'x' + H; if (titleCache.sig === sig) return titleCache;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return [c, c.getContext('2d')]; };
    const [c1, g] = mk();
    const sky = g.createLinearGradient(0, 0, 0, H * 0.7); sky.addColorStop(0, '#f6d6a0'); sky.addColorStop(0.55, '#f9e7c2'); sky.addColorStop(1, '#fff3da');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // parchment speckle (deterministic)
    g.fillStyle = 'rgba(150,100,40,.05)'; for (let i = 0; i < 140; i++) { const x = hash(i, 1) * W, y = hash(i, 2) * H * 0.6; g.beginPath(); g.arc(x, y, 1 + hash(i, 3) * 3, 0, TAU); g.fill(); }
    const [c2, v] = mk();
    const vg = v.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(60,30,0,0)'); vg.addColorStop(1, 'rgba(60,30,0,.35)');
    v.fillStyle = vg; v.fillRect(0, 0, W, H);
    Object.assign(titleCache, { sig, sky: c1, vig: c2 });
    return titleCache;
  }
  function drawTitleScene(g, W, H, t) {
    const TL = titleLayers(W, H);
    g.drawImage(TL.sky, 0, 0);
    // sun
    const sx = W * 0.8, sy = H * 0.2;
    g.fillStyle = 'rgba(255,190,90,.25)'; g.beginPath(); g.arc(sx, sy, 90 + Math.sin(t) * 6, 0, TAU); g.fill();
    g.fillStyle = '#ffc75a'; g.beginPath(); g.arc(sx, sy, 58, 0, TAU); g.fill();
    // clouds
    for (let i = 0; i < 5; i++) { const x = ((t * (8 + i * 3) + i * 380) % (W + 400)) - 200, y = H * (0.08 + i * 0.06); g.fillStyle = 'rgba(255,255,255,.8)'; for (const [dx, dy, r] of [[0, 0, 30], [32, -10, 26], [60, 2, 22], [-28, 4, 20]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fill(); } }
    // distant mountains
    g.fillStyle = '#c6b6a0'; g.beginPath(); g.moveTo(0, H * 0.55);
    for (let x = 0; x <= W; x += W / 14) g.lineTo(x, H * (0.4 + hash(Math.round(x), 7) * 0.12)); g.lineTo(W, H * 0.62); g.lineTo(0, H * 0.62); g.fill();
    // the launch pad far away on a hill (science!), with a lift-off every ~18 s
    const hill = (col, base, amp, f, off) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 12) g.lineTo(x, base + Math.sin(x / f + off) * amp); g.lineTo(W, H); g.fill(); };
    const yAt = (x, base, amp, f, off) => base + Math.sin(x / f + off) * amp;
    hill('#a9b97a', H * 0.58, 24, 260, 0.5);
    const px = W * 0.93, py = yAt(W * 0.93, H * 0.58, 24, 260, 0.5);
    const cyc = t % 18, lift = cyc > 12 ? (cyc - 12) : 0;
    g.fillStyle = '#7a7b84'; g.fillRect(px - 26, py - 4, 52, 6);
    g.strokeStyle = '#a14a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(px + 16, py); g.lineTo(px + 16, py - 58); g.stroke();
    const ry = py - 6 - lift * lift * 14;
    if (lift > 0) { for (let i = 0; i < 10; i++) { const a = (i / 10) * lift; g.fillStyle = `rgba(240,240,240,${0.5 - i * 0.04})`; g.beginPath(); g.arc(px + Math.sin(i * 2) * 6, py - 6 - (a * a * 14) + i * 10 + 20, 6 + i * 1.6, 0, TAU); g.fill(); } }
    if (ry > -80) drawRocket(g, px, ry, 52, 3, t, lift > 0 || (cyc > 11.2 && cyc < 12), false);
    // castles on the hills
    hill('#8fae5e', H * 0.66, 30, 210, 2.2);
    const cpos = [[0.1, 1.1], [0.25, 0.75], [0.79, 1.2]];
    cpos.forEach(([u, sc], i) => { const x = W * u, y = yAt(W * u, H * 0.66, 30, 210, 2.2); drawCastle(g, x, y + 4, 46 * sc * Math.min(1.4, W / 1400), [5, 3, 4][i], TITLE_KINGS[i], 2, t + i); });
    hill('#7a9c4c', H * 0.78, 18, 170, 4.1);
    // fields with wheat rows
    g.strokeStyle = 'rgba(235,205,95,.75)'; g.lineWidth = 2; g.lineCap = 'round';
    for (let i = 0; i < 70; i++) { const x = hash(i, 31) * W, y = H * (0.8 + hash(i, 32) * 0.08); for (let j = -1; j <= 1; j++) { g.beginPath(); g.moveTo(x + j * 3, y); g.quadraticCurveTo(x + j * 4, y - 6, x + j * 6, y - 11 + Math.sin(t * 1.5 + i) * 1.5); g.stroke(); } }
    // little trees
    for (let i = 0; i < 16; i++) { const x = hash(i, 11) * W, y = yAt(x, H * 0.78, 18, 170, 4.1) + 14; tree(g, x, y, 26 + hash(i, 12) * 14, '#2f6f35', '#4f9a4a'); }
    // the marching army along the road
    hill('#6a8a40', H * 0.9, 8, 120, 1);
    g.fillStyle = '#c9a66b'; g.fillRect(0, H * 0.905, W, H * 0.03);
    const sc = Math.min(1.6, W / 1100), gap = 48 * sc, n = Math.ceil(W / gap) + 2;
    for (let i = 0; i < n; i++) {
      const x = ((t * 55 + i * gap) % (n * gap)) - gap, y = H * 0.915;
      const col = TITLE_KINGS[Math.floor(i / 5) % TITLE_KINGS.length];
      if (i % 5 === 0) { drawArmy(g, x, y, 26 * sc, col, 'knight', 5 + i, t + i, false); continue; }
      const st = Math.sin(t * 9 + i) * 3;
      g.fillStyle = shade(col, -0.25); g.fillRect(x - 5 * sc, y - 22 * sc, 10 * sc, 16 * sc);
      g.strokeStyle = '#3a2810'; g.lineWidth = 2.5 * sc; g.beginPath(); g.moveTo(x - 3 * sc, y - 6 * sc); g.lineTo(x - 3 * sc + st, y + 2 * sc); g.moveTo(x + 3 * sc, y - 6 * sc); g.lineTo(x + 3 * sc - st, y + 2 * sc); g.stroke();
      g.fillStyle = '#f0c9a0'; g.beginPath(); g.arc(x, y - 27 * sc, 5 * sc, 0, TAU); g.fill();
      g.fillStyle = '#9aa0aa'; g.beginPath(); g.arc(x, y - 29 * sc, 5.5 * sc, Math.PI, 0); g.fill();
      g.strokeStyle = '#ccc'; g.lineWidth = 1.5 * sc; g.beginPath(); g.moveTo(x + 8 * sc, y - 4 * sc); g.lineTo(x + 8 * sc, y - 44 * sc); g.stroke();
      g.fillStyle = '#ddd'; g.beginPath(); g.moveTo(x + 8 * sc, y - 50 * sc); g.lineTo(x + 5 * sc, y - 43 * sc); g.lineTo(x + 11 * sc, y - 43 * sc); g.fill();
      g.fillStyle = col; g.beginPath(); g.arc(x - 7 * sc, y - 15 * sc, 6 * sc, 0, TAU); g.fill(); // shield
    }
    // birds
    g.strokeStyle = '#5a4630'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { const x = ((t * 40 + i * 90) % (W + 200)) - 100, y = H * 0.25 + i * 18 + Math.sin(t * 2 + i) * 8, w = Math.sin(t * 8 + i) * 5; g.beginPath(); g.moveTo(x - 9, y - w); g.quadraticCurveTo(x - 4, y - 4, x, y); g.quadraticCurveTo(x + 4, y - 4, x + 9, y - w); g.stroke(); }
    g.drawImage(TL.vig, 0, 0); // vignette
  }

  // Sea around the island world (static background).
  function drawSea(g, W, H) {
    const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
    gr.addColorStop(0, '#3f7ea3'); gr.addColorStop(1, '#1d3f5a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2;
    for (let i = 0; i < 160; i++) { const x = hash(i, 21) * W, y = hash(i, 22) * H, w = 10 + hash(i, 23) * 18; g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w / 2, y - 4, x, y); g.quadraticCurveTo(x + w / 2, y + 4, x + w, y); g.stroke(); }
  }
  // Coast: a soft shallow-water halo and a sandy rim around the outer hexes.
  function drawCoast(g, tiles, L) {
    g.save();
    for (const T of tiles) { const [x, y] = toPx(T.q, T.r, L); hexPath(g, x, y, L.s * 1.45); g.fillStyle = 'rgba(120,190,215,.10)'; g.fill(); }
    for (const T of tiles) { const [x, y] = toPx(T.q, T.r, L); hexPath(g, x, y + L.s * 0.08, L.s * 1.08); g.fillStyle = '#d9c48c'; g.fill(); }
    g.restore();
  }

  window.KINGDOM_ART = {
    TAU, SQ3, DIRS, EDGE, hash, rnd, rgb, rgba, shade, inkOn, allyColor, toPx, fit, hexPath, corner, TERR, UNIT_ICON,
    drawTerrain, drawOwnership, drawCastle, castleFlag, drawVillage, drawArmy, drawRocket, drawLaunchPad, drawMonument, drawTable, tableRug, tableChairs, tableTop, tableCandles, seatAngle,
    drawTitleScene, drawSea, drawCoast, flag, house, tower, tree, badge, roundRect,
  };
})();
