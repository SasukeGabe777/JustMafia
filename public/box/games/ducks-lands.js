'use strict';
// JustRaiseDucks race landscapes, all original and drawn in code: the eight newer worlds
// (volcano, swamp, city rooftops, jungle, desert, sky islands, candy land, a haunted farm)
// and the maze section every world can have. DUCK_ART (ducks-art.js) draws the race; it asks
// this file for anything a newer world or the maze needs (far layers, props, ground, water,
// rock faces, pits, maze walls, jump obstacles, ambient weather), and draws the six original
// worlds exactly as before. Loaded after ducks-art.js.
(function () {
  const ART = window.DUCK_ART; if (!ART) return;
  const TAU = Math.PI * 2;
  const hash = (n) => { let h = ((n | 0) + 1) * 2654435761; h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); g.fill(); };
  const ell = (g, x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); g.fill(); };
  const wrap = (v, m) => ((v % m) + m) % m;

  // ---------- the worlds ----------
  // sky: gradient; hill: far layer colour; ground: below the course; path: the lanes; water, rock,
  // rockDark, pit: pond, cliff and ravine colours; prop: the mid-layer scenery; far: the far layer.
  // dark: light text on the course. clouds: cloud colour (null: none). amb: ambient effect.
  const THEMES = {
    volcano: { sky: ['#3d1714', '#e0703f'], hill: '#3a2624', hill2: '#2a1b1a', ground: '#3f2e2b', path: '#5a4741', water: '#5fb8c9', rock: '#3b3536', rockDark: '#242022', pit: '#1a0d0a', prop: 'basalt', far: 'volcano', sun: 'red', dark: true, clouds: 'rgba(70,50,48,.7)', amb: 'ash', maze: 'lavatubes' },
    swamp: { sky: ['#557566', '#c9d8b3'], hill: '#3f5a45', hill2: '#2f4636', ground: '#3f5a33', path: '#6b5a3a', water: '#4e7466', rock: '#6b5232', rockDark: '#4d3a22', pit: '#1d2a1a', prop: 'cypress', far: 'swamp', sun: 'pale', clouds: 'rgba(220,230,215,.55)', amb: 'swamp', maze: 'reeds' },
    city: { sky: ['#ff8f73', '#ffe2b5'], hill: '#9a7fa6', hill2: '#6b587a', ground: '#a8705a', path: '#56525c', water: '#4fa8e8', rock: '#b5654a', rockDark: '#8a4a35', pit: '#2a2433', prop: 'tower', far: 'skyline', sun: 'sunset', clouds: 'rgba(255,236,225,.8)', amb: 'birds', facade: true, maze: 'alley' },
    jungle: { sky: ['#86d2a8', '#eaf8d8'], hill: '#2f7a45', hill2: '#1f5a32', ground: '#3d7a35', path: '#7a5a35', water: '#3a9a8a', rock: '#6f7a70', rockDark: '#4f5a50', pit: '#10241a', prop: 'jpalm', far: 'jungle', clouds: 'rgba(255,255,255,.75)', amb: 'leaves', maze: 'temple' },
    desert: { sky: ['#ffb45e', '#fff1c9'], hill: '#e3a96a', hill2: '#cf8f52', ground: '#e2bd80', path: '#ecd09a', water: '#2fb0d0', rock: '#d99a5e', rockDark: '#b87a45', pit: '#4a2a14', prop: 'saguaro', far: 'dunes', sun: 'hot', clouds: null, amb: 'dust', maze: 'slot' },
    sky: { sky: ['#4fa6ff', '#e8f5ff'], hill: '#d6ecff', hill2: '#b8dcf8', ground: '#86613f', path: '#86d36d', water: '#7fd8ff', rock: '#8a7a6a', rockDark: '#6a5a4a', pit: null, prop: 'skytree', far: 'islands', clouds: 'rgba(255,255,255,.92)', amb: 'birds', floating: true, maze: 'cloudmaze' },
    candy: { sky: ['#ffaedc', '#fff2fb'], hill: '#ff9ccf', hill2: '#c9a7ff', ground: '#9fe0c4', path: '#ff9ecf', water: '#6b3a1f', rock: '#fff7fb', rockDark: '#e63962', pit: '#ff8fc8', prop: 'lollipop', far: 'candyhills', clouds: 'rgba(255,255,255,.95)', amb: 'sprinkles', maze: 'licorice' },
    haunted: { sky: ['#160f28', '#5b3f6e'], hill: '#251e33', hill2: '#1a1526', ground: '#2f3326', path: '#56473a', water: '#3d4f5c', rock: '#5a4a45', rockDark: '#3a2f2c', pit: '#0d0a14', prop: 'deadtree', far: 'farm', moon: true, stars: true, dark: true, clouds: 'rgba(70,60,95,.55)', amb: 'bats', maze: 'corn' },
  };
  // The maze in each of the original worlds.
  const OLD_MAZE = { meadow: 'hedge', beach: 'sandcastle', forest: 'hedge', snow: 'icecave', canyon: 'slot', night: 'hedge' };
  // Maze walls: wall, light (top/highlight), dark (shade), floor (the path), cave: a ceiling over it.
  const MAZE = {
    hedge: { wall: '#3f8f3a', light: '#62b552', dark: '#2a6b2a', floor: '#cdb38a', kind: 'leafy' },
    sandcastle: { wall: '#e5c98f', light: '#f6e3b8', dark: '#c4a265', floor: '#f2dcab', kind: 'blocks' },
    icecave: { wall: '#a8d4f0', light: '#e6f6ff', dark: '#76a9d2', floor: '#dcefff', kind: 'ice', cave: '#6f98bf' },
    slot: { wall: '#c8643c', light: '#e8915f', dark: '#8a3f22', floor: '#e0a070', kind: 'strata' },
    lavatubes: { wall: '#3b3536', light: '#5c5254', dark: '#1f1b1c', floor: '#4d403d', kind: 'basalt', cave: '#231c1c', glow: '#ff7a2a' },
    reeds: { wall: '#7a8a3a', light: '#a9b95c', dark: '#4f5a25', floor: '#6b5a3a', kind: 'reeds' },
    alley: { wall: '#9a5a45', light: '#bd7a5f', dark: '#6b3a2a', floor: '#6f6a72', kind: 'brick' },
    temple: { wall: '#8d8b72', light: '#aeac92', dark: '#5f5f4a', floor: '#b5a682', kind: 'temple', moss: '#5f9a4a' },
    cloudmaze: { wall: '#ffffff', light: '#ffffff', dark: '#cfe0f2', floor: '#eef6ff', kind: 'puffs' },
    licorice: { wall: '#2a1a1f', light: '#e63946', dark: '#120a0d', floor: '#ffc2e0', kind: 'licorice' },
    corn: { wall: '#b9a43f', light: '#e3d06a', dark: '#5f7a26', floor: '#6b5638', kind: 'corn' },
  };
  // Water colours of the newer pond variants.
  const WATER = { hotspring: '#58b6c8', murky: '#4e7466', fountain: '#4fa8e8', oasis: '#2fb0d0', skylake: '#7fd8ff', choco: '#6b3a1f', foggy: '#3f5160' };
  for (const [k, v] of Object.entries(OLD_MAZE)) if (ART.THEME[k]) ART.THEME[k].maze = v;
  Object.assign(ART.THEME, THEMES);

  // ---------- small art helpers ----------
  function windows(g, x, y, w, h, seed, lit, cell = 22) {
    for (let r = 0; r < h / cell - 0.5; r++) for (let c = 0; c < w / cell - 0.5; c++) {
      const k = hash(seed * 131 + r * 17 + c * 7);
      g.fillStyle = k < lit ? '#ffd97a' : 'rgba(30,24,50,.55)';
      g.fillRect(x + 6 + c * cell, y + 6 + r * cell, cell * 0.45, cell * 0.5);
    }
  }
  function puffs(g, x, y, w, r, col, seed = 0) { g.fillStyle = col; for (let i = 0; i <= w / (r * 0.9); i++) circ(g, x + i * r * 0.9, y + Math.sin(i * 1.7 + seed) * r * 0.25, r * (0.75 + 0.35 * hash(seed + i))); }
  // Lane depth helper: y of the lane line between lane i and i+1.
  const laneY = (base, band, laneN, i) => base + 8 - i * (band / laneN);

  // ---------- the ground under the course ----------
  // Old worlds: a flat fill. City: building fronts with windows under the rooftops. Sky Islands:
  // the island's earth, then its rocky underside floating over the sky.
  function fillGround(g, TH, x0, x1, hz, H, base, cam, PX) {
    if (TH.facade) {
      g.fillStyle = TH.ground; g.fillRect(x0, base + 12, x1 - x0 + 1, H - base);
      g.fillStyle = TH.path; g.fillRect(x0, hz, x1 - x0 + 1, base + 14 - hz);
      // window rows on the front wall, fixed to the world
      const cell = 34, start = Math.floor((x0 + cam * PX) / cell) * cell - cam * PX;
      for (let x = start; x < x1; x += cell) for (let r = 0; r < 3; r++) {
        const wx = x + 8, wy = base + 34 + r * 40; if (wx < x0 - 20 || wx > x1) continue;
        const k = hash(Math.round((x + cam * PX) / cell) * 7 + r);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(wx - 2, wy - 2, 20, 26);
        g.fillStyle = k < 0.3 ? '#ffd97a' : '#5d6f8f'; g.fillRect(wx, wy, 16, 22);
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(wx, wy, 16, 4);
      }
      g.fillStyle = '#c9c2b8'; g.fillRect(x0, base + 12, x1 - x0 + 1, 8); // the parapet ledge
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x0, base + 20, x1 - x0 + 1, 4);
      return;
    }
    if (TH.floating) {
      g.fillStyle = TH.ground; g.fillRect(x0, hz, x1 - x0 + 1, base + 46 - hz);
      // the island's underside: rock and roots hanging over the open sky
      g.fillStyle = '#6f5038'; g.beginPath(); g.moveTo(x0, base + 44);
      const step = 26, s0 = Math.floor((x0 + cam * PX) / step) * step - cam * PX;
      for (let x = s0; x <= x1 + step; x += step) { const k = hash(Math.round((x + cam * PX) / step)); g.lineTo(Math.min(x1, Math.max(x0, x)), base + 58 + k * 46); }
      g.lineTo(x1, base + 44); g.closePath(); g.fill();
      g.fillStyle = '#5a3f2b'; for (let x = s0; x < x1; x += step * 2) { const k = hash(Math.round((x + cam * PX) / step) + 9); if (x > x0) { g.fillRect(x, base + 48, 3, 18 + k * 30); } }
      g.fillStyle = '#9a7552'; g.fillRect(x0, base + 30, x1 - x0 + 1, 6);
      return;
    }
    g.fillStyle = TH.ground; g.fillRect(x0, hz, x1 - x0 + 1, H - hz);
  }

  // ---------- sky: suns, moons, stars ----------
  function sky(g, TH, W, H, t, R) {
    if (R.weather === 'rain' || R.weather === 'fog') { if (!TH.moon) return; }
    if (TH.stars) { for (let i = 0; i < 70; i++) { g.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(t * 1.5 + i)); g.fillStyle = '#fff'; g.fillRect((i * 151) % W, (i * 67) % (H * 0.45), 2, 2); } g.globalAlpha = 1; }
    if (TH.moon) {
      const mx = W * 0.8, my = H * 0.17;
      const gl = g.createRadialGradient(mx, my, 20, mx, my, 120); gl.addColorStop(0, 'rgba(220,235,190,.35)'); gl.addColorStop(1, 'rgba(220,235,190,0)'); g.fillStyle = gl; circ(g, mx, my, 120);
      g.fillStyle = '#e9f0c8'; circ(g, mx, my, 46); g.fillStyle = 'rgba(160,170,120,.35)'; circ(g, mx - 14, my - 8, 9); circ(g, mx + 12, my + 12, 6); circ(g, mx + 16, my - 14, 4);
      return;
    }
    if (TH.sun === 'red') { const gl = g.createRadialGradient(W * 0.8, H * 0.2, 10, W * 0.8, H * 0.2, 110); gl.addColorStop(0, 'rgba(255,120,60,.9)'); gl.addColorStop(0.45, 'rgba(255,90,40,.5)'); gl.addColorStop(1, 'rgba(255,90,40,0)'); g.fillStyle = gl; circ(g, W * 0.8, H * 0.2, 110); g.fillStyle = '#ff8a4a'; circ(g, W * 0.8, H * 0.2, 38); }
    else if (TH.sun === 'hot') { g.fillStyle = 'rgba(255,240,170,.45)'; circ(g, W * 0.84, H * 0.15, 78 + Math.sin(t * 2) * 4); g.fillStyle = '#fff6c4'; circ(g, W * 0.84, H * 0.15, 50); }
    else if (TH.sun === 'pale') { g.fillStyle = 'rgba(255,250,220,.4)'; circ(g, W * 0.82, H * 0.16, 60); g.fillStyle = 'rgba(255,252,230,.85)'; circ(g, W * 0.82, H * 0.16, 34); }
    else if (TH.sun === 'sunset') { const gl = g.createRadialGradient(W * 0.78, H * 0.34, 10, W * 0.78, H * 0.34, 160); gl.addColorStop(0, 'rgba(255,220,140,.9)'); gl.addColorStop(1, 'rgba(255,170,110,0)'); g.fillStyle = gl; circ(g, W * 0.78, H * 0.34, 160); g.fillStyle = '#ffd27a'; circ(g, W * 0.78, H * 0.34, 54); }
    else { g.fillStyle = '#ffe066'; circ(g, W * 0.85, H * 0.15, 40); }
  }

  // ---------- far layers (parallax) ----------
  function far(g, TH, W, hz, cam, PX, t) {
    const k = TH.far;
    if (k === 'volcano') {
      const P = 900, off = wrap(cam * PX * 0.18, P);
      for (let i = -1; i < W / P + 2; i++) {
        const cx = i * P - off + 420, top = hz - 250;
        g.fillStyle = TH.hill2; g.beginPath(); g.moveTo(cx - 330, hz); g.lineTo(cx - 52, top); g.lineTo(cx + 52, top); g.lineTo(cx + 330, hz); g.fill();
        g.fillStyle = '#ff7a2a'; g.beginPath(); g.ellipse(cx, top + 2, 50, 9, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,110,40,.8)'; g.lineWidth = 4; g.lineCap = 'round';
        for (const [dx, len] of [[-24, 90], [18, 130], [36, 60]]) { g.beginPath(); g.moveTo(cx + dx, top + 4); g.quadraticCurveTo(cx + dx * 1.6, top + len * 0.5, cx + dx * 2.6, top + len); g.stroke(); }
        g.lineCap = 'butt';
        for (let j = 0; j < 6; j++) { const a = wrap(t * 0.12 + j / 6, 1); g.fillStyle = `rgba(80,66,64,${0.55 * (1 - a)})`; circ(g, cx + Math.sin(j * 2 + t * 0.4) * 20 + a * 90, top - 20 - a * 170, 26 + a * 50); }
      }
      g.fillStyle = TH.hill; g.beginPath(); g.moveTo(0, hz);
      for (let x = 0; x <= W; x += 18) { const u = x + cam * PX * 0.35; g.lineTo(x, hz - 60 - Math.abs(Math.sin(u / 130)) * 50 - Math.sin(u / 47) * 10); }
      g.lineTo(W, hz); g.fill();
      return true;
    }
    if (k === 'skyline') {
      for (const [par, col, hMin, hMax, lit, seed] of [[0.15, TH.hill, 90, 230, 0, 3], [0.32, TH.hill2, 60, 170, 0.25, 11]]) {
        const off = cam * PX * par; let x = -wrap(off, 140) - 140, idx = Math.floor(off / 140) - 1;
        while (x < W + 140) {
          const w = 70 + hash(idx * 3 + seed) * 70, h = hMin + hash(idx * 5 + seed) * (hMax - hMin);
          g.fillStyle = col; g.fillRect(x, hz - h, w - 6, h + 2);
          if (hash(idx + seed * 7) < 0.3) { g.fillRect(x + w * 0.4, hz - h - 26, 4, 26); }
          if (lit) windows(g, x, hz - h, w - 6, h - 10, idx * 13 + seed, lit, 18);
          x += w; idx++;
        }
      }
      return true;
    }
    if (k === 'jungle') {
      g.fillStyle = TH.hill2;
      for (let i = -1; i < W / 70 + 2; i++) { const u = i + Math.floor(cam * PX * 0.2 / 70), x = i * 70 - wrap(cam * PX * 0.2, 70); circ(g, x, hz - 150 - hash(u) * 60, 60 + hash(u + 5) * 30); }
      // a stepped temple far away
      const P = 1300, off = wrap(cam * PX * 0.2, P);
      for (let i = -1; i < W / P + 2; i++) { const cx = i * P - off + 640; g.fillStyle = '#5f6f58'; for (let s = 0; s < 5; s++) g.fillRect(cx - 110 + s * 20, hz - 70 - s * 30, 220 - s * 40, 32); g.fillStyle = '#2f3a2c'; g.fillRect(cx - 12, hz - 214, 24, 22); }
      g.fillStyle = TH.hill;
      for (let i = -1; i < W / 50 + 2; i++) { const u = i + Math.floor(cam * PX * 0.38 / 50), x = i * 50 - wrap(cam * PX * 0.38, 50); circ(g, x, hz - 60 - hash(u * 3) * 40, 44 + hash(u * 7) * 20); }
      g.fillRect(0, hz - 60, W, 62);
      return true;
    }
    if (k === 'dunes') {
      for (const [par, col, hgt, f] of [[0.15, TH.hill, 120, 260], [0.35, TH.hill2, 70, 170]]) {
        g.fillStyle = col; g.beginPath(); g.moveTo(0, hz);
        for (let x = 0; x <= W; x += 16) { const u = x + cam * PX * par; g.lineTo(x, hz - hgt * (0.55 + 0.45 * Math.sin(u / f)) - Math.sin(u / (f * 0.37)) * 12); }
        g.lineTo(W, hz); g.fill();
      }
      // a mesa now and then
      const P = 1100, off = wrap(cam * PX * 0.12, P);
      for (let i = -1; i < W / P + 2; i++) { const cx = i * P - off + 300; g.fillStyle = '#c47a48'; g.beginPath(); g.moveTo(cx - 150, hz - 40); g.lineTo(cx - 110, hz - 170); g.lineTo(cx + 120, hz - 170); g.lineTo(cx + 160, hz - 40); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(cx - 104, hz - 170, 222, 10); }
      return true;
    }
    if (k === 'islands') {
      const P = 520, off = cam * PX * 0.22;
      for (let i = -1; i < W / P + 2; i++) {
        const u = i + Math.floor(off / P), cx = i * P - wrap(off, P) + 200, cy = hz - 150 - hash(u) * 170, w = 90 + hash(u + 3) * 80;
        g.fillStyle = '#c9a27a'; g.beginPath(); g.moveTo(cx - w, cy); g.lineTo(cx, cy + w * 0.9); g.lineTo(cx + w, cy); g.fill();
        g.fillStyle = '#9ad27f'; ell(g, cx, cy, w, 14);
        g.fillStyle = '#6fbf5a'; circ(g, cx - w * 0.3, cy - 18, 18); circ(g, cx + w * 0.25, cy - 14, 14);
        if (hash(u + 7) < 0.5) { g.fillStyle = 'rgba(200,235,255,.7)'; g.fillRect(cx + w * 0.5, cy + 4, 5, 70 + wrap(t * 20, 6)); }
      }
      g.fillStyle = 'rgba(255,255,255,.85)';
      for (let i = -1; i < W / 160 + 2; i++) { const x = i * 160 - wrap(cam * PX * 0.3, 160); circ(g, x, hz + 4, 50); circ(g, x + 60, hz - 10, 40); }
      return true;
    }
    if (k === 'candyhills') {
      for (const [par, col, hgt, f, stripe] of [[0.15, TH.hill2, 130, 200, 'rgba(255,255,255,.35)'], [0.35, TH.hill, 80, 120, 'rgba(255,255,255,.45)']]) {
        const P = f * 2, off = cam * PX * par;
        for (let i = -1; i < W / P + 2; i++) {
          const cx = i * P - wrap(off, P) + f, u = i + Math.floor(off / P), h = hgt * (0.7 + 0.3 * hash(u));
          g.fillStyle = col; g.beginPath(); g.ellipse(cx, hz, f * 1.05, h, 0, Math.PI, 0); g.fill();
          g.save(); g.beginPath(); g.ellipse(cx, hz, f * 1.05, h, 0, Math.PI, 0); g.clip();
          g.strokeStyle = stripe; g.lineWidth = 12; for (let s = -4; s < 6; s++) { g.beginPath(); g.moveTo(cx - f + s * 50, hz); g.lineTo(cx - f + s * 50 + h, hz - h); g.stroke(); }
          g.restore();
        }
      }
      return true;
    }
    if (k === 'swamp') {
      g.fillStyle = TH.hill2;
      for (let i = -1; i < W / 90 + 2; i++) { const u = i + Math.floor(cam * PX * 0.2 / 90), x = i * 90 - wrap(cam * PX * 0.2, 90), h = 110 + hash(u) * 80; g.fillRect(x - 5, hz - h, 10, h); ell(g, x, hz - h, 40, 16); ell(g, x + 14, hz - h + 20, 30, 12); }
      g.fillStyle = TH.hill; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= W; x += 20) g.lineTo(x, hz - 30 - Math.sin((x + cam * PX * 0.35) / 90) * 10); g.lineTo(W, hz); g.fill();
      g.fillStyle = 'rgba(220,232,215,.35)'; for (let i = 0; i < 4; i++) { const y = hz - 40 - i * 34, x = wrap(t * (10 + i * 4) - cam * PX * 0.1, W + 600) - 300; ell(g, x, y, 340, 18); ell(g, x + W * 0.55, y + 10, 300, 14); }
      return true;
    }
    if (k === 'farm') {
      g.fillStyle = TH.hill; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= W; x += 20) g.lineTo(x, hz - 60 - Math.sin((x + cam * PX * 0.25) / 210) * 30); g.lineTo(W, hz); g.fill();
      const P = 1200, off = wrap(cam * PX * 0.25, P);
      for (let i = -1; i < W / P + 2; i++) {
        const bx = i * P - off + 380, by = hz - 70;
        g.fillStyle = '#120d1c'; g.fillRect(bx - 60, by - 70, 120, 74); g.beginPath(); g.moveTo(bx - 72, by - 68); g.lineTo(bx, by - 120); g.lineTo(bx + 72, by - 68); g.fill();
        g.fillStyle = 'rgba(255,190,80,.75)'; g.fillRect(bx - 8, by - 92, 16, 14); // one lit window
        const wx = bx + 260; g.fillStyle = '#120d1c'; g.fillRect(wx - 4, by - 120, 8, 124);
        g.save(); g.translate(wx, by - 120); g.rotate(t * 0.4); for (let b = 0; b < 4; b++) { g.rotate(TAU / 4); g.fillRect(0, -4, 58, 8); } g.restore();
      }
      return true;
    }
    return false;
  }

  // ---------- mid-layer props ----------
  function prop(g, kind, x, base, t, k) {
    if (kind === 'basalt') {
      g.fillStyle = '#2a2324'; g.beginPath(); g.moveTo(x - 24, base); g.lineTo(x - 14, base - 90); g.lineTo(x - 2, base - 110); g.lineTo(x + 10, base - 84); g.lineTo(x + 24, base); g.fill();
      g.strokeStyle = 'rgba(255,120,40,.75)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x - 4, base - 100); g.lineTo(x + 2, base - 70); g.lineTo(x - 6, base - 40); g.lineTo(x + 2, base - 10); g.stroke();
      if (k % 2) { g.fillStyle = 'rgba(120,100,95,.5)'; for (let j = 0; j < 3; j++) { const a = wrap(t * 0.3 + j / 3, 1); circ(g, x - 2 + a * 20, base - 114 - a * 70, 6 + a * 14); } }
      return true;
    }
    if (kind === 'cypress') {
      g.fillStyle = '#3d3226'; g.beginPath(); g.moveTo(x - 16, base); g.quadraticCurveTo(x - 6, base - 20, x - 5, base - 110); g.lineTo(x + 5, base - 110); g.quadraticCurveTo(x + 6, base - 20, x + 16, base); g.fill();
      g.fillStyle = '#35502f'; ell(g, x, base - 120, 42, 18); ell(g, x - 20, base - 98, 28, 12); ell(g, x + 22, base - 104, 26, 11);
      g.strokeStyle = 'rgba(150,170,120,.85)'; g.lineWidth = 2; for (const dx of [-30, -16, -2, 14, 28]) { g.beginPath(); g.moveTo(x + dx, base - 108); g.quadraticCurveTo(x + dx + Math.sin(t + dx) * 3, base - 84, x + dx + 1, base - 70 + (dx % 3) * 6); g.stroke(); }
      return true;
    }
    if (kind === 'tower') { // a rooftop water tower or an antenna mast
      if (k % 2) { g.strokeStyle = '#4a3f4f'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 22, base); g.lineTo(x - 16, base - 50); g.moveTo(x + 22, base); g.lineTo(x + 16, base - 50); g.moveTo(x - 20, base - 20); g.lineTo(x + 20, base - 34); g.stroke(); g.fillStyle = '#8a5a3f'; g.fillRect(x - 26, base - 96, 52, 48); g.fillStyle = '#6b4430'; for (let i = 0; i < 4; i++) g.fillRect(x - 26, base - 90 + i * 12, 52, 2); g.fillStyle = '#4a3f4f'; g.beginPath(); g.moveTo(x - 30, base - 96); g.lineTo(x, base - 120); g.lineTo(x + 30, base - 96); g.fill(); }
      else { g.strokeStyle = '#4a3f4f'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - 120); for (let i = 1; i < 4; i++) { g.moveTo(x - 14 + i * 2, base - 30 * i); g.lineTo(x + 14 - i * 2, base - 30 * i); } g.stroke(); g.fillStyle = Math.sin(t * 3) > 0 ? '#ff4f4f' : '#7a2a2a'; circ(g, x, base - 124, 4); }
      return true;
    }
    if (kind === 'jpalm') {
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 9; g.beginPath(); g.moveTo(x, base); g.quadraticCurveTo(x - 14, base - 60, x + 4, base - 130); g.stroke();
      g.fillStyle = '#2f8f3f'; for (let i = 0; i < 6; i++) { g.save(); g.translate(x + 4, base - 130); g.rotate(-2.9 + i * 0.62 + Math.sin(t * 1.3 + i) * 0.04); g.beginPath(); g.ellipse(32, 0, 34, 9, 0, 0, TAU); g.fill(); g.restore(); }
      g.strokeStyle = '#3f7a2f'; g.lineWidth = 2; for (const dx of [-24, 18, 30]) { g.beginPath(); g.moveTo(x + dx, base - 124); g.quadraticCurveTo(x + dx + Math.sin(t + dx) * 4, base - 90, x + dx, base - 60); g.stroke(); g.fillStyle = '#4caf50'; ell(g, x + dx, base - 60, 4, 6); }
      return true;
    }
    if (kind === 'saguaro') {
      g.fillStyle = '#4f8f3a'; const r = 8;
      g.beginPath(); g.moveTo(x - r, base); g.lineTo(x - r, base - 80); g.arc(x, base - 80, r, Math.PI, 0); g.lineTo(x + r, base); g.fill();
      g.beginPath(); g.moveTo(x - r, base - 36); g.lineTo(x - 26, base - 36); g.lineTo(x - 26, base - 60); g.arc(x - 20, base - 60, 6, Math.PI, 0); g.lineTo(x - 14, base - 44); g.lineTo(x - r, base - 44); g.fill();
      if (k % 2) { g.beginPath(); g.moveTo(x + r, base - 50); g.lineTo(x + 24, base - 50); g.lineTo(x + 24, base - 70); g.arc(x + 18, base - 70, 6, 0, Math.PI, true); g.lineTo(x + 12, base - 58); g.lineTo(x + r, base - 58); g.fill(); }
      g.strokeStyle = 'rgba(30,70,20,.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 3, base - 84); g.lineTo(x - 3, base - 4); g.moveTo(x + 3, base - 84); g.lineTo(x + 3, base - 4); g.stroke();
      g.fillStyle = '#ff6fb5'; if (k % 3 === 0) circ(g, x, base - 90, 4);
      return true;
    }
    if (kind === 'skytree') {
      g.fillStyle = '#8a6a4a'; g.fillRect(x - 4, base - 40, 8, 40);
      g.fillStyle = k % 2 ? '#ffb3d9' : '#9ad27f'; circ(g, x, base - 54, 24); circ(g, x - 16, base - 42, 16); circ(g, x + 16, base - 44, 16);
      g.fillStyle = 'rgba(255,255,255,.35)'; circ(g, x - 7, base - 62, 7);
      return true;
    }
    if (kind === 'lollipop') {
      if (k % 2) { // a candy cane
        g.lineCap = 'round'; g.lineWidth = 12; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - 80); g.arc(x + 16, base - 80, 16, Math.PI, 0); g.stroke();
        g.strokeStyle = '#e63946'; g.lineWidth = 12; g.setLineDash([8, 10]); g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - 80); g.arc(x + 16, base - 80, 16, Math.PI, 0); g.stroke(); g.setLineDash([]); g.lineCap = 'butt';
      } else {
        g.fillStyle = '#fff'; g.fillRect(x - 3, base - 80, 6, 80);
        const cols = [['#ff4f9a', '#ffe14d'], ['#3ec1ff', '#fff'], ['#8be36a', '#ffb3d9']][Math.abs(k) % 3];
        g.fillStyle = cols[0]; circ(g, x, base - 100, 28);
        g.strokeStyle = cols[1]; g.lineWidth = 6; g.beginPath(); for (let a = 0; a < TAU * 2.2; a += 0.25) { const r = 2 + a * 3.6; g.lineTo(x + Math.cos(a + t * 0.5) * r, base - 100 + Math.sin(a + t * 0.5) * r); } g.stroke();
      }
      return true;
    }
    if (kind === 'deadtree') {
      g.strokeStyle = '#1c1624'; g.lineCap = 'round';
      const br = (x0, y0, a, len, w, d) => { if (d > 3 || len < 6) return; const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); br(x1, y1, a - 0.5 - hash(k * 7 + d) * 0.3, len * 0.68, w * 0.62, d + 1); br(x1, y1, a + 0.45 + hash(k * 3 + d) * 0.3, len * 0.62, w * 0.6, d + 1); };
      br(x, base, -Math.PI / 2 + (hash(k) - 0.5) * 0.3, 52, 10, 0); g.lineCap = 'butt';
      if (k % 2 === 0) { g.fillStyle = '#e8772e'; ell(g, x + 30, base - 9, 13, 10); g.fillStyle = '#ffd25a'; g.beginPath(); g.moveTo(x + 24, base - 12); g.lineTo(x + 28, base - 16); g.lineTo(x + 30, base - 11); g.fill(); g.beginPath(); g.moveTo(x + 32, base - 11); g.lineTo(x + 35, base - 16); g.lineTo(x + 38, base - 12); g.fill(); g.fillStyle = '#3d6b1f'; g.fillRect(x + 29, base - 22, 3, 5); }
      return true;
    }
    return false;
  }

  // ---------- track variants ----------
  const PATH = { lava: '#4a3a36', ash: '#787070', roots: '#6b4f30', roof: '#56525c', puddles: '#5c5862', cactus: '#ecd09a', dunes: '#f0d49a', cloudpath: '#f4f8ff', gumdrops: '#ff9ecf', taffy: '#ff8fc4', hay: '#8a6a40' };
  function track(g, s, TH, x0, x1, hz, base, band, laneN, H, t, cam, PX) {
    const v = s.v; if (!PATH[v]) return false;
    fillGround(g, TH, x0, x1, hz, H, base, cam, PX);
    g.fillStyle = PATH[v]; g.fillRect(x0, hz - 4, x1 - x0 + 1, band + 18);
    const wx = (px) => Math.round(px + cam * PX); // a world-fixed key for this screen x
    // lane lines
    g.fillStyle = v === 'cloudpath' ? 'rgba(160,200,240,.45)' : v === 'gumdrops' || v === 'taffy' ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.3)';
    for (let i = 1; i < laneN; i++) { const ly = laneY(base, band, laneN, i); for (let x = Math.max(x0, wrap(x0, 40) - 40); x < Math.min(x1, 4000); x += 40) g.fillRect(x, ly, 22, 2); }
    const step = 46, s0 = Math.floor((x0 + cam * PX) / step) * step - cam * PX;
    if (v === 'lava' || v === 'ash') {
      for (let x = s0; x < x1; x += step) { const k = hash(wx(x) / step | 0); if (x < x0) continue; const y = hz + band * k;
        if (v === 'lava') { g.strokeStyle = `rgba(255,${100 + 60 * Math.sin(t * 3 + k * 9) | 0},40,.8)`; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 10, y + 4); g.lineTo(x + 18, y + 1); g.lineTo(x + 28, y + 6); g.stroke(); }
        else { g.fillStyle = 'rgba(60,55,55,.5)'; g.fillRect(x + 4, y, 4, 3); g.fillRect(x + 22, y + 7, 3, 3); }
      }
    }
    if (v === 'roots') { g.strokeStyle = '#4a3420'; g.lineWidth = 4; for (let x = s0; x < x1; x += step) { if (x < x0) continue; const k = hash(wx(x) / step | 0); const y = hz + 4 + band * k; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 6, x + 30, y + 2); g.stroke(); } }
    if (v === 'roof' || v === 'puddles') {
      g.fillStyle = 'rgba(0,0,0,.15)'; for (let x = s0; x < x1; x += step * 2) if (x > x0) g.fillRect(x, hz - 4, 2, band + 18);
      if (v === 'puddles') for (let x = s0; x < x1; x += step * 2) { if (x < x0) continue; const k = hash((wx(x) / step | 0) + 4); const y = hz + 6 + band * k * 0.85; g.fillStyle = 'rgba(120,170,220,.75)'; ell(g, x + 20, y, 26, 5); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 8 + Math.sin(t * 2 + k * 9) * 3, y - 1, 10, 1.5); }
      g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x0, hz - 4, x1 - x0 + 1, 3);
    }
    if (v === 'cactus' || v === 'dunes') { g.strokeStyle = 'rgba(190,150,90,.55)'; g.lineWidth = 2; for (let x = s0; x < x1; x += step) { if (x < x0) continue; for (let r = 0; r < 3; r++) { const y = hz + 4 + r * band / 3 + 6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 12, y - 4, x + 24, y); g.stroke(); } } }
    if (v === 'cloudpath') { g.fillStyle = '#ffffff'; for (let x = s0; x < x1 + step; x += 24) { if (x < x0 - 20) continue; circ(g, x, hz - 4, 12 + hash(wx(x) / 24 | 0) * 6); circ(g, x + 8, base + 14, 10 + hash((wx(x) / 24 | 0) + 3) * 5); } }
    if (v === 'gumdrops' || v === 'taffy') {
      if (v === 'taffy') { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 8; for (let x = s0; x < x1; x += 34) { if (x < x0) continue; g.beginPath(); g.moveTo(x, base + 14); g.lineTo(x + band * 0.6, hz - 4); g.stroke(); } }
      const C = ['#ff4f9a', '#3ec1ff', '#ffe14d', '#8be36a', '#b388ff', '#fff'];
      for (let x = s0; x < x1; x += 18) { if (x < x0) continue; const k = wx(x) / 18 | 0; g.fillStyle = C[k % 6]; g.save(); g.translate(x, hz + 3 + band * hash(k)); g.rotate(hash(k + 1) * 3); g.fillRect(-4, -1.5, 8, 3); g.restore(); }
    }
    if (v === 'hay') { g.strokeStyle = 'rgba(230,200,110,.7)'; g.lineWidth = 1.5; for (let x = s0; x < x1; x += 14) { if (x < x0) continue; const k = hash(wx(x) / 14 | 0); const y = hz + band * k; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y - 3); g.stroke(); } }
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x0, base + 14, x1 - x0 + 1, 4);
    return true;
  }
  // The particle a footfall kicks up on this track variant (index into the race's particle colours).
  const DUSTOF = { lava: 7, ash: 7, roots: 1, roof: 0, puddles: 4, cactus: 2, dunes: 2, cloudpath: 3, gumdrops: 8, taffy: 8, hay: 0 };

  // ---------- pond extras ----------
  function pond(g, s, TH, x0, x1, hz, base, band, H, t, wy, cam, PX) {
    const v = s.v; if (!WATER[v]) return false;
    const step = 90, s0 = Math.floor((x0 + cam * PX) / step) * step - cam * PX;
    if (v === 'hotspring') { for (let x = s0; x < x1; x += step) { if (x < x0) continue; for (let j = 0; j < 3; j++) { const a = wrap(t * 0.5 + j / 3 + hash(x | 0), 1); g.fillStyle = `rgba(255,255,255,${0.35 * (1 - a)})`; circ(g, x + 20 + Math.sin(a * 6 + j) * 8, wy - band - a * 90, 10 + a * 22); } } }
    if (v === 'murky') {
      for (let x = s0; x < x1 - 40; x += step) { if (x < x0 + 20) continue; const k = hash(Math.round((x + cam * PX) / step)); const y = wy - band * (0.2 + 0.6 * k) + Math.sin(t * 1.5 + k * 9) * 2; g.fillStyle = '#5a3f26'; ell(g, x, y, 34, 6); g.fillStyle = '#7a5636'; ell(g, x - 30, y, 6, 6); g.fillStyle = '#4a3420'; ell(g, x - 30, y, 3, 3); }
      g.strokeStyle = '#4f6b2a'; g.lineWidth = 3; for (let x = s0; x < x1; x += 30) { if (x < x0 + 6) continue; const k = hash(Math.round((x + cam * PX) / 30)); if (k > 0.45) continue; g.beginPath(); g.moveTo(x, wy + 8); g.lineTo(x + Math.sin(t + k * 9) * 3, wy - band - 30 - k * 30); g.stroke(); g.fillStyle = '#6b4a2a'; ell(g, x + Math.sin(t + k * 9) * 3, wy - band - 30 - k * 30, 3.5, 9); }
    }
    if (v === 'fountain') {
      g.fillStyle = '#d8d0c4'; g.fillRect(x0 + 2, wy - band - 8, x1 - x0 - 4, 8); g.fillStyle = '#b8afa2'; for (let x = s0; x < x1; x += 30) if (x > x0) g.fillRect(x, wy - band - 8, 2, 8);
      for (let x = s0 + 45; x < x1 - 30; x += step * 2) { if (x < x0 + 30) continue; g.strokeStyle = 'rgba(220,245,255,.9)'; g.lineWidth = 3; for (const s2 of [-1, 1]) { g.beginPath(); g.moveTo(x, wy - band * 0.5); g.quadraticCurveTo(x + s2 * 18, wy - band * 0.5 - 70 - Math.sin(t * 6) * 4, x + s2 * 32, wy - band * 0.5); g.stroke(); } g.fillStyle = '#d8d0c4'; g.fillRect(x - 5, wy - band * 0.5 - 6, 10, 10); }
    }
    if (v === 'oasis') { g.strokeStyle = '#5f8f3a'; g.lineWidth = 3; for (const xx of [x0 + 10, x1 - 14]) for (let j = 0; j < 5; j++) { g.beginPath(); g.moveTo(xx + j * 3, wy - band); g.lineTo(xx + j * 3 + Math.sin(t + j) * 3 - 4 + j * 2, wy - band - 26 - j * 6); g.stroke(); } }
    if (v === 'skylake') { for (let x = s0; x < x1; x += 40) { if (x < x0) continue; const k = hash(Math.round((x + cam * PX) / 40)); g.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(t * 4 + k * 20)})`; g.fillRect(x, wy - band * k, 3, 3); } }
    if (v === 'choco') { g.strokeStyle = 'rgba(160,100,60,.7)'; g.lineWidth = 4; for (let x = s0; x < x1; x += 70) { if (x < x0) continue; const k = hash(Math.round((x + cam * PX) / 70)); const y = wy - band * k + 6; g.beginPath(); g.arc(x + wrap(t * 20, 70), y, 10, 0.3, 4.6); g.stroke(); } g.fillStyle = '#ff9ccf'; for (let x = s0; x < x1; x += 150) if (x > x0) { const y = wy - band * 0.5; ell(g, x + 30, y, 16, 5); g.fillStyle = '#fff'; ell(g, x + 26, y - 2, 4, 2); g.fillStyle = '#ff9ccf'; } }
    if (v === 'foggy') { g.fillStyle = 'rgba(210,220,230,.28)'; for (let j = 0; j < 3; j++) { const x = x0 + wrap(t * (14 + j * 6) + j * 200, Math.max(1, x1 - x0)); ell(g, x, wy - band * (0.2 + j * 0.3), 120, 12); } }
    return true;
  }

  // ---------- cliff faces ----------
  const CLIFF = { basalt: ['#3b3536', '#242022', '#4d4446'], mudbank: ['#6b5232', '#4d3a22', '#7d6340'], wall: ['#b5654a', '#8a4a35', '#c97a5f'], waterfall: ['#6f7a70', '#4f5a50', '#8a958a'], sandstone: ['#d99a5e', '#b87a45', '#e8b27a'], floating: ['#8a7a6a', '#6a5a4a', '#86d36d'], candycane: ['#fff7fb', '#ffd6e6', '#ffe3ef'], barn: ['#8a2f2a', '#5f1f1c', '#a5433c'] };
  // After the face is filled (with its path still set), pattern it. Returns true when the pattern
  // replaces the usual dark rock blotches.
  function cliff(g, s, x0, x1, base, H, t, cam, PX) {
    const v = s.v; if (!CLIFF[v]) return false;
    g.save(); g.clip();
    const wx = (px) => px + cam * PX;
    if (v === 'basalt') { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; for (let x = x0 - wrap(wx(x0), 22); x < x1; x += 22) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } g.strokeStyle = 'rgba(255,110,40,.7)'; g.lineWidth = 2; for (let x = x0 - wrap(wx(x0), 130) + 40; x < x1; x += 130) { g.beginPath(); g.moveTo(x, base - 40); g.lineTo(x + 6, base); g.lineTo(x - 4, base + 40); g.stroke(); } }
    if (v === 'mudbank') { g.fillStyle = 'rgba(40,28,14,.35)'; for (let x = x0 - wrap(wx(x0), 26); x < x1; x += 26) { const k = hash(Math.round(wx(x) / 26)); g.fillRect(x, base - 60 + k * 40, 5, 40 + k * 60); circ(g, x + 2.5, base - 20 + k * 40 + 40 + k * 60, 4); } }
    if (v === 'wall') {
      g.strokeStyle = 'rgba(80,30,20,.35)'; g.lineWidth = 1.5;
      for (let y = 0; y < H; y += 12) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); for (let x = x0 - wrap(wx(x0) + (y / 12 % 2) * 12, 24); x < x1; x += 24) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 12); g.stroke(); } }
      for (let x = x0 - wrap(wx(x0), 70) + 20; x < x1; x += 70) for (let y = base - 260; y < H; y += 74) { const k = hash(Math.round(wx(x) / 70) * 5 + Math.round(y / 74)); g.fillStyle = '#e8e0d4'; g.fillRect(x - 4, y + 40, 36, 6); g.fillStyle = k < 0.3 ? '#ffd97a' : '#4f5f7f'; g.fillRect(x, y, 28, 38); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(x, y, 28, 6); }
    }
    if (v === 'waterfall') {
      const span = x1 - x0, fx = x0 + span * 0.35, fw = Math.min(140, span * 0.3);
      g.fillStyle = 'rgba(170,220,255,.55)'; g.fillRect(fx, 0, fw, H);
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; for (let i = 0; i < 9; i++) { const xx = fx + (i + 0.5) * fw / 9, y = wrap(t * 260 + i * 53, 120); for (let yy = y - 120; yy < H; yy += 120) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + 40); g.stroke(); } }
      g.fillStyle = 'rgba(80,130,60,.5)'; for (let x = x0; x < x1; x += 34) if (x < fx - 10 || x > fx + fw + 10) circ(g, x, base - 30 + hash(Math.round(wx(x))) * 120, 10);
    }
    if (v === 'sandstone') { for (let y = 0, i = 0; y < H; y += 16, i++) { g.fillStyle = i % 2 ? 'rgba(255,230,190,.18)' : 'rgba(120,60,20,.15)'; g.beginPath(); g.moveTo(x0, y); for (let x = x0; x <= x1; x += 30) g.lineTo(x, y + Math.sin((wx(x)) / 60 + i) * 3); g.lineTo(x1, y + 10); g.lineTo(x0, y + 10); g.fill(); } }
    if (v === 'floating') { g.fillStyle = 'rgba(90,150,70,.45)'; for (let x = x0 - wrap(wx(x0), 40); x < x1; x += 40) circ(g, x, base - 120 + hash(Math.round(wx(x) / 40)) * 200, 12); }
    if (v === 'candycane') { g.strokeStyle = '#e63962'; g.lineWidth = 16; for (let x = x0 - wrap(wx(x0), 48) - H; x < x1 + H; x += 48) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); } }
    if (v === 'barn') { g.strokeStyle = 'rgba(30,8,8,.45)'; g.lineWidth = 2; for (let x = x0 - wrap(wx(x0), 18); x < x1; x += 18) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } g.strokeStyle = 'rgba(240,230,220,.8)'; g.lineWidth = 5; for (let x = x0 - wrap(wx(x0), 160) + 30; x < x1; x += 160) { const y = base - 30; g.strokeRect(x, y, 70, 70); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 70, y + 70); g.moveTo(x + 70, y); g.lineTo(x, y + 70); g.stroke(); } }
    g.restore();
    return v !== 'floating' && v !== 'mudbank' && v !== 'sandstone';
  }

  // ---------- ravines ----------
  function gap(g, s, TH, x0, x1, r0, r1, hz, H, base, band, t, cam, PX) {
    const v = s.v;
    const KNOWN = { lavapit: 1, bog: 1, street: 1, gorge: 1, sky: 1, cotton: 1, fogpit: 1 };
    if (!KNOWN[v]) return false;
    if (v === 'sky' || v === 'cotton') {
      // open sky below: clouds drifting under the gap
      const col = v === 'cotton' ? ['#ffc2e3', '#ffe0f1'] : ['#ffffff', '#eef7ff'];
      for (let i = 0; i < 6; i++) { const x = r0 + wrap(t * 12 + i * 90, Math.max(1, r1 - r0 + 120)) - 60; g.fillStyle = col[i % 2]; circ(g, x, base + 80 + (i % 3) * 40, 34); circ(g, x + 30, base + 70 + (i % 3) * 40, 26); }
    } else if (v === 'lavapit') {
      const gr = g.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, '#1a0d0a'); gr.addColorStop(0.6, '#5a1a0a'); gr.addColorStop(1, '#ff6a1a'); g.fillStyle = gr; g.fillRect(x0, hz - 4, x1 - x0 + 1, H);
      g.fillStyle = '#ff8a2a'; g.beginPath(); g.moveTo(x0, H); for (let x = x0; x <= x1; x += 12) g.lineTo(x, H - 30 + Math.sin(x / 20 + t * 2) * 5); g.lineTo(x1, H); g.fill();
      for (let i = 0; i < 5; i++) { const a = wrap(t * 0.7 + i / 5, 1), x = r0 + (r1 - r0) * hash(i * 13 + Math.floor(t * 0.7 + i / 5)); g.fillStyle = `rgba(255,200,80,${1 - a})`; circ(g, x, H - 34 - a * 26, 4 + a * 5); }
    } else if (v === 'bog') {
      g.fillStyle = '#1d2a1a'; g.fillRect(x0, hz - 4, x1 - x0 + 1, H);
      g.fillStyle = '#3f5235'; g.fillRect(x0, base + 70, x1 - x0 + 1, H); g.fillStyle = 'rgba(255,255,255,.15)'; for (let x = r0; x < r1; x += 50) g.fillRect(x + wrap(t * 10, 50), base + 76, 20, 2);
      g.strokeStyle = '#4f6b2a'; g.lineWidth = 3; for (let x = r0 + 20; x < r1; x += 46) { g.beginPath(); g.moveTo(x, base + 74); g.lineTo(x + 3, base + 30); g.stroke(); }
      g.fillStyle = 'rgba(220,232,215,.3)'; ell(g, (r0 + r1) / 2 + Math.sin(t * 0.5) * 30, base + 50, (r1 - r0) * 0.5, 16);
    } else if (v === 'street') {
      g.fillStyle = '#2a2433'; g.fillRect(x0, hz - 4, x1 - x0 + 1, H);
      g.fillStyle = '#3d3a4a'; g.fillRect(x0, H - 40, x1 - x0 + 1, 40); g.fillStyle = '#ffd97a'; for (let x = r0 + 30; x < r1; x += 80) { g.fillRect(x, H - 64, 3, 24); circ(g, x + 1.5, H - 66, 4); }
      g.fillStyle = '#e8d48a'; for (let x = r0; x < r1; x += 40) g.fillRect(x + 10, H - 22, 20, 3);
      const car = r0 + wrap(t * 60, Math.max(1, r1 - r0 + 60)) - 30; g.fillStyle = '#ff4f4f'; g.fillRect(car, H - 34, 26, 10); g.fillStyle = '#ffe9a0'; g.fillRect(car + 24, H - 31, 3, 3);
    } else if (v === 'gorge') {
      const gr = g.createLinearGradient(0, hz, 0, H); gr.addColorStop(0, '#14301f'); gr.addColorStop(1, '#0a1a10'); g.fillStyle = gr; g.fillRect(x0, hz - 4, x1 - x0 + 1, H);
      g.fillStyle = 'rgba(200,235,215,.22)'; for (let i = 0; i < 3; i++) ell(g, (r0 + r1) / 2 + Math.sin(t * 0.4 + i) * 40, base + 40 + i * 50, (r1 - r0) * 0.45, 14);
    } else if (v === 'fogpit') {
      g.fillStyle = TH.pit || '#0d0a14'; g.fillRect(x0, hz - 4, x1 - x0 + 1, H);
      for (let i = 0; i < 4; i++) { g.fillStyle = `rgba(190,180,215,${0.14 + i * 0.04})`; ell(g, r0 + wrap(t * (8 + i * 5) + i * 70, Math.max(1, r1 - r0)), base + 30 + i * 36, (r1 - r0) * 0.4, 12 + i * 3); }
    }
    // the walls of the gap
    if (v === 'street') {
      for (const [a, b, dir] of [[x0, r0, 1], [r1, x1, -1]]) { g.fillStyle = '#8a6b5a'; g.fillRect(Math.min(a, b), hz - 4, Math.abs(b - a) + 1, H); windows(g, Math.min(a, b), base + 24, Math.abs(b - a), H - base - 30, Math.round(a), 0.3, 26); }
    } else if (v === 'sky' || v === 'cotton') {
      const col = v === 'cotton' ? '#ffc2e3' : '#86613f';
      g.fillStyle = col; g.beginPath(); g.moveTo(x0, hz - 4); g.lineTo(r0, hz - 4); g.lineTo(r0 - 10, base + 46); g.lineTo(r0 - 50, base + 90); g.lineTo(x0, base + 110); g.fill();
      g.beginPath(); g.moveTo(x1, hz - 4); g.lineTo(r1, hz - 4); g.lineTo(r1 + 10, base + 46); g.lineTo(r1 + 50, base + 90); g.lineTo(x1, base + 110); g.fill();
    } else {
      const rd = v === 'lavapit' ? '#2a2122' : v === 'bog' ? '#3d3226' : v === 'gorge' ? '#4f5a50' : '#2a2433';
      g.fillStyle = rd; g.beginPath(); g.moveTo(r0, hz - 4); g.lineTo(r0 + 26, H); g.lineTo(x0, H); g.lineTo(x0, hz - 4); g.fill(); g.beginPath(); g.moveTo(r1, hz - 4); g.lineTo(r1 - 26, H); g.lineTo(x1, H); g.lineTo(x1, hz - 4); g.fill();
      if (v === 'gorge') { g.strokeStyle = '#3f8a3a'; g.lineWidth = 3; for (const [rx, d] of [[r0, 1], [r1, -1]]) for (let j = 0; j < 4; j++) { const xx = rx + d * (6 + j * 10); g.beginPath(); g.moveTo(xx, base + 10); g.quadraticCurveTo(xx + d * 8 + Math.sin(t + j) * 4, base + 70 + j * 18, xx + Math.sin(t * 0.8 + j) * 6, base + 120 + j * 30); g.stroke(); g.fillStyle = '#5fb34f'; ell(g, xx + Math.sin(t * 0.8 + j) * 6, base + 120 + j * 30, 5, 7); } }
    }
    // rim surfaces (the lanes on each side)
    g.fillStyle = TH.ground; g.fillRect(x0, hz - 4, r0 - x0, band + 18); g.fillRect(r1, hz - 4, x1 - r1, band + 18);
    g.fillStyle = TH.path; g.fillRect(x0, hz - 4, r0 - x0, 6); g.fillRect(r1, hz - 4, x1 - r1, 6); g.fillRect(x0, base + 10, r0 - x0, 8); g.fillRect(r1, base + 10, x1 - r1, 8);
    if (v === 'lavapit' || v === 'sky' || v === 'cotton') { g.strokeStyle = v === 'lavapit' ? 'rgba(255,150,60,.8)' : 'rgba(255,255,255,.8)'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { const x = (r0 + r1) / 2 + (i - 1) * 50, yy = base - wrap(t * 80 + i * 40, 160); g.beginPath(); g.moveTo(x - 8, yy); g.quadraticCurveTo(x + 8, yy - 10, x - 4, yy - 22); g.stroke(); } }
    return true;
  }

  // ---------- the maze ----------
  // Side view of a maze: a tall wall behind the lanes with a dark dead-end opening at every fork,
  // low wall rows between the lanes (broken at the forks), a gateway at each end, a signpost at
  // each fork, and a cave ceiling for the tunnel mazes. Every world has one (THEME.maze).
  function mazeWall(g, M, x0, x1, top, bot, t, cam, PX, seed) {
    const h = bot - top, wx = (px) => px + cam * PX;
    g.fillStyle = M.wall; g.fillRect(x0, top, x1 - x0, h);
    const step = M.kind === 'corn' || M.kind === 'reeds' ? 9 : 22, s0 = x0 - wrap(wx(x0), step);
    if (M.kind === 'leafy' || M.kind === 'puffs') {
      g.fillStyle = M.dark; g.fillRect(x0, bot - h * 0.25, x1 - x0, h * 0.25);
      for (let x = s0; x < x1 + step; x += step) { const k = hash(Math.round(wx(x) / step) + seed); g.fillStyle = M.light; circ(g, x, top + 4 + k * 4, step * 0.62); g.fillStyle = M.kind === 'puffs' ? '#f4f9ff' : M.wall; circ(g, x + step * 0.4, top + h * 0.45 + k * 6, step * 0.5); }
      if (M.kind === 'leafy') { g.fillStyle = 'rgba(255,255,255,.12)'; for (let x = s0; x < x1; x += step) circ(g, x + 5, top + 2, 4); }
    } else if (M.kind === 'blocks' || M.kind === 'temple' || M.kind === 'brick' || M.kind === 'ice' || M.kind === 'basalt') {
      const bh = M.kind === 'brick' ? 10 : 18, bw = M.kind === 'brick' ? 22 : 36;
      g.strokeStyle = M.dark; g.lineWidth = M.kind === 'brick' ? 1.2 : 2;
      for (let y = top, r = 0; y < bot; y += bh, r++) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); for (let x = x0 - wrap(wx(x0) + (r % 2) * bw / 2, bw); x < x1; x += bw) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, Math.min(bot, y + bh)); g.stroke(); } }
      g.fillStyle = M.light; g.fillRect(x0, top, x1 - x0, 5);
      if (M.kind === 'blocks') for (let x = s0; x < x1; x += 36) g.fillRect(x, top - 10, 18, 12); // sandcastle crenellations
      if (M.kind === 'temple') { g.fillStyle = M.moss; for (let x = s0; x < x1; x += step * 2) { const k = hash(Math.round(wx(x)) + seed); ell(g, x, top + 4, 16 + k * 10, 6); g.fillRect(x - 2, top + 4, 3, 10 + k * 18); } g.fillStyle = M.dark; for (let x = s0; x < x1; x += 110) { g.fillRect(x + 30, top + h * 0.35, 16, 16); g.fillStyle = M.light; g.fillRect(x + 34, top + h * 0.35 + 4, 8, 8); g.fillStyle = M.dark; } }
      if (M.kind === 'ice') { g.fillStyle = 'rgba(255,255,255,.4)'; for (let x = s0; x < x1; x += 40) g.fillRect(x + 6, top + 8, 4, h * 0.6); }
      if (M.kind === 'basalt') { g.strokeStyle = M.glow; g.lineWidth = 2; for (let x = s0; x < x1; x += 90) { const k = hash(Math.round(wx(x)) + seed); g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 2 + k * 9); g.beginPath(); g.moveTo(x + 10, top + 8); g.lineTo(x + 18, top + h * 0.4); g.lineTo(x + 8, top + h * 0.8); g.stroke(); } g.globalAlpha = 1; }
      if (M.kind === 'brick') { g.fillStyle = 'rgba(255,255,255,.18)'; for (let x = s0; x < x1; x += 140) { g.fillRect(x + 20, top + h * 0.3, 40, 10); g.fillStyle = 'rgba(80,200,255,.35)'; g.fillRect(x + 70, top + h * 0.5, 30, 8); g.fillStyle = 'rgba(255,255,255,.18)'; } }
    } else if (M.kind === 'strata') {
      for (let y = top, i = 0; y < bot; y += 12, i++) { g.fillStyle = i % 2 ? M.light : M.dark; g.globalAlpha = 0.35; g.beginPath(); g.moveTo(x0, y); for (let x = s0; x <= x1 + step; x += step) g.lineTo(Math.min(x1, x), y + Math.sin(wx(x) / 40 + i) * 4); g.lineTo(x1, y + 8); g.lineTo(x0, y + 8); g.fill(); }
      g.globalAlpha = 1;
    } else if (M.kind === 'reeds' || M.kind === 'corn') {
      g.fillStyle = M.dark; g.fillRect(x0, bot - h * 0.3, x1 - x0, h * 0.3);
      for (let x = s0; x < x1; x += step) {
        const k = hash(Math.round(wx(x) / step) + seed), sway = Math.sin(t * 1.4 + k * 6) * 3, tip = top - 6 - k * 14;
        g.strokeStyle = k < 0.5 ? M.light : M.wall; g.lineWidth = 3; g.beginPath(); g.moveTo(x, bot); g.quadraticCurveTo(x + sway * 0.5, (top + bot) / 2, x + sway, tip); g.stroke();
        if (M.kind === 'reeds') { if (k < 0.4) { g.fillStyle = '#6b4a2a'; ell(g, x + sway, tip + 6, 3, 8); } }
        else { g.fillStyle = M.dark; g.beginPath(); g.ellipse(x + sway * 0.6 + 6, top + h * 0.35 + k * 10, 8, 2.4, 0.6, 0, TAU); g.fill(); if (k < 0.25) { g.fillStyle = '#ffd25a'; ell(g, x + sway * 0.7 + 3, top + h * 0.5, 3, 7); } }
      }
    } else if (M.kind === 'licorice') {
      for (let y = top; y < bot; y += 14) { g.fillStyle = M.wall; g.fillRect(x0, y, x1 - x0, 12); g.strokeStyle = M.light; g.lineWidth = 3; for (let x = x0 - wrap(wx(x0), 16); x < x1; x += 16) { g.beginPath(); g.moveTo(x, y + 12); g.lineTo(x + 8, y); g.stroke(); } }
    }
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x0, bot - 4, x1 - x0, 4);
  }
  function signpost(g, x, y, sc, t) {
    g.fillStyle = '#7a4f2f'; g.fillRect(x - 2.5 * sc, y - 46 * sc, 5 * sc, 46 * sc);
    g.fillStyle = '#e9d3a8'; g.beginPath(); g.moveTo(x, y - 44 * sc); g.lineTo(x + 26 * sc, y - 44 * sc); g.lineTo(x + 33 * sc, y - 38 * sc); g.lineTo(x + 26 * sc, y - 32 * sc); g.lineTo(x, y - 32 * sc); g.fill();
    g.beginPath(); g.moveTo(x, y - 28 * sc); g.lineTo(x - 26 * sc, y - 28 * sc); g.lineTo(x - 33 * sc, y - 22 * sc); g.lineTo(x - 26 * sc, y - 16 * sc); g.lineTo(x, y - 16 * sc); g.fill();
    g.fillStyle = '#3c8a2c'; g.font = `800 ${11 * sc}px Fredoka, sans-serif`; g.textAlign = 'center'; g.fillText('→', x + 15 * sc, y - 34.5 * sc);
    g.fillStyle = '#c0392b'; g.fillText('?', x - 15 * sc, y - 18.5 * sc); g.textAlign = 'left';
  }
  function maze(g, s, R, TH, G, x0, x1, hz, base, band, laneN, H, t, cam, PX, m2x, W) {
    const M = MAZE[s.v] || MAZE[TH.maze] || MAZE.hedge, seed = Math.round(s.a);
    fillGround(g, TH, x0, x1, hz, H, base, cam, PX);
    // the floor: gravel paths
    g.fillStyle = M.floor; g.fillRect(x0, hz - 4, x1 - x0 + 1, band + 18);
    g.fillStyle = 'rgba(0,0,0,.08)'; for (let x = x0 - wrap(x0 + cam * PX, 26); x < x1; x += 26) for (let r = 0; r < 3; r++) g.fillRect(x + (r * 9) % 26, hz + 2 + r * band / 3 + (x % 7), 3, 2);
    const forks = (R.forks || []).filter((f) => f > s.a && f < s.b);
    // the back wall with a dead-end opening at each fork (where the wrong turn goes)
    const wh = Math.max(46, H * 0.12), top = hz - wh - 4;
    if (M.cave) { // tunnel mazes: a rock ceiling with drips over the whole section
      g.fillStyle = M.cave; g.beginPath(); g.moveTo(x0, 0); g.lineTo(x1, 0); for (let x = x1; x >= x0; x -= 24) g.lineTo(x, top - 50 - hash(Math.round((x + cam * PX) / 24) + seed) * 50); g.closePath(); g.fill();
      g.fillStyle = M.kind === 'ice' ? 'rgba(230,246,255,.9)' : M.glow ? 'rgba(255,122,42,.6)' : M.dark; for (let x = x0 - wrap(x0 + cam * PX, 60); x < x1; x += 60) { const k = hash(Math.round((x + cam * PX) / 60) + seed); const y0 = top - 50 - k * 50; g.beginPath(); g.moveTo(x - 6, y0); g.lineTo(x, y0 + 18 + k * 20); g.lineTo(x + 6, y0); g.fill(); }
    }
    mazeWall(g, M, x0, x1, top, hz - 2, t, cam, PX, seed);
    for (const f of forks) {
      const ox = m2x(f - 2.6), ow = Math.max(26, 2.2 * PX);
      g.fillStyle = 'rgba(10,8,6,.6)'; g.beginPath(); g.moveTo(ox - ow / 2, hz - 2); g.lineTo(ox - ow / 2, top + wh * 0.32); g.quadraticCurveTo(ox, top + 2, ox + ow / 2, top + wh * 0.32); g.lineTo(ox + ow / 2, hz - 2); g.fill();
      g.fillStyle = M.wall; g.globalAlpha = 0.65; g.fillRect(ox - ow * 0.28, top + wh * 0.5, ow * 0.56, wh * 0.5 - 2); g.globalAlpha = 1; // the dead end at the back of the alley
    }
    // low walls between the lanes, open at every fork
    const lh = Math.max(3, band / laneN * 0.26), top2 = M.kind === 'basalt' || M.kind === 'licorice' ? M.light : M.light, body = M.kind === 'basalt' ? M.light : M.wall;
    for (let i = 1; i < laneN; i++) {
      const ly = laneY(base, band, laneN, i);
      let a = s.a + 0.6; const pieces = [];
      for (const f of forks) { pieces.push([a, f - 1.2]); a = f + 1.2; }
      pieces.push([a, s.b - 0.6]);
      for (const [p, q] of pieces) { const px0 = Math.max(x0, m2x(p)), px1 = Math.min(x1, m2x(q)); if (px1 <= px0) continue; g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(px0, ly + 1, px1 - px0, 2); g.fillStyle = body; g.fillRect(px0, ly - lh + 1, px1 - px0, lh); g.fillStyle = top2; g.fillRect(px0, ly - lh + 1, px1 - px0, Math.max(1.5, lh * 0.35)); }
    }
    // the front edge
    g.fillStyle = M.dark; g.fillRect(x0, base + 10, x1 - x0 + 1, 8); g.fillStyle = M.wall; g.fillRect(x0, base + 8, x1 - x0 + 1, 5);
    // signposts at the forks (at the back edge, readable from the sofa)
    for (const f of forks) { const fx = m2x(f); if (fx > -60 && fx < W + 60) signpost(g, fx, hz + 2, Math.max(1.5, band / 46), t); }
    // gateways at both ends
    for (const [m, label] of [[s.a, true], [s.b, false]]) {
      const gx = m2x(m); if (gx < -80 || gx > W + 80) continue;
      const ph = wh + band * 0.5, pw = 16;
      g.fillStyle = M.dark; g.fillRect(gx - pw / 2, top - 14, pw, hz - top + band + 30); g.fillStyle = M.wall; g.fillRect(gx - pw / 2 + 3, top - 14, pw - 6, hz - top + band + 26);
      if (label) { g.fillStyle = '#5a3b22'; g.fillRect(gx - 4, top - 54, 64, 30); g.fillStyle = '#ffe7b0'; g.fillRect(gx - 1, top - 51, 58, 24); g.fillStyle = '#5a3b22'; g.font = '800 16px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('MAZE', gx + 28, top - 33); g.textAlign = 'left'; }
      void ph;
    }
    return true;
  }

  // ---------- jump obstacles (in one lane) ----------
  // Same contract as DUCK_ART.drawHurdle: x, gy = the lane's ground, s = scale, depth = lane depth.
  function hurdle(g, kind, x, gy, s, depth, fall, t) {
    if (kind === 'lava') { // a stream of lava across the lane: jump it
      g.save(); g.translate(x, gy);
      const w = 9 * s, dx = depth * 0.7 + 12 * s;
      g.fillStyle = '#2a1d1b'; g.beginPath(); g.moveTo(-w - 3 * s, 2 * s); g.lineTo(dx - w - 3 * s, -depth); g.lineTo(dx + w + 3 * s, -depth); g.lineTo(w + 3 * s, 2 * s); g.fill();
      const gl = 0.75 + 0.25 * Math.sin(t * 5 + x * 0.05);
      g.fillStyle = `rgba(255,${(110 + 60 * gl) | 0},30,1)`; g.beginPath(); g.moveTo(-w, 0); g.lineTo(dx - w, -depth); g.lineTo(dx + w, -depth); g.lineTo(w, 0); g.fill();
      g.fillStyle = 'rgba(255,230,120,.85)'; for (let i = 0; i < 3; i++) { const u = wrap(t * 0.6 + i / 3, 1); g.fillRect(dx * u - 2 * s, -depth * u - 1, 4 * s, 2 * s); }
      if (fall > 0 && fall < 1) { g.fillStyle = `rgba(120,110,110,${0.6 * (1 - fall)})`; circ(g, 0, -14 * s * fall, 8 * s); }
      g.restore(); return true;
    }
    if (kind === 'cactus') {
      g.save(); g.translate(x, gy); g.rotate(fall > 0 && fall < 1 ? Math.sin(fall * 18) * 0.1 * (1 - fall) : 0);
      const cx = depth * 0.35, cy = -depth * 0.5;
      g.fillStyle = '#3f7f2f'; g.fillRect(cx - 5 * s, cy - 24 * s, 10 * s, 24 * s); circ(g, cx, cy - 24 * s, 5 * s);
      g.fillRect(cx - 13 * s, cy - 15 * s, 8 * s, 5 * s); g.fillRect(cx - 13 * s, cy - 21 * s, 5 * s, 9 * s); g.fillRect(cx + 5 * s, cy - 12 * s, 8 * s, 5 * s); g.fillRect(cx + 9 * s, cy - 19 * s, 5 * s, 10 * s);
      g.strokeStyle = 'rgba(255,255,220,.8)'; g.lineWidth = 1; for (let i = 0; i < 6; i++) { const yy = cy - 4 * s - i * 3.5 * s; g.beginPath(); g.moveTo(cx - 5 * s, yy); g.lineTo(cx - 8 * s, yy - 1); g.moveTo(cx + 5 * s, yy); g.lineTo(cx + 8 * s, yy - 1); g.stroke(); }
      if (fall === 0) { g.fillStyle = '#ff6fb5'; circ(g, cx, cy - 29 * s, 2.5 * s); }
      g.restore(); return true;
    }
    if (kind === 'chimney') {
      g.save(); g.translate(x, gy);
      const cx = depth * 0.35, cy = -depth * 0.45, h = 22 * s, f = Math.min(1, fall);
      g.fillStyle = '#9a4a35'; g.fillRect(cx - 9 * s, cy - h, 18 * s, h);
      g.strokeStyle = 'rgba(60,20,10,.45)'; g.lineWidth = 1; for (let y = 0; y < h; y += 5 * s) { g.beginPath(); g.moveTo(cx - 9 * s, cy - y); g.lineTo(cx + 9 * s, cy - y); g.stroke(); }
      g.fillStyle = '#6f3526'; g.fillRect(cx - 8 * s, cy - h - 4 * s * (1 - f), 22 * s, 4 * s); // the cap (knocked off in a crash)
      if (f > 0) { g.fillStyle = '#6f3526'; g.save(); g.translate(cx + 14 * s * f, cy - h + 18 * s * f); g.rotate(f * 1.4); g.fillRect(-11 * s, -2 * s, 22 * s, 4 * s); g.restore(); }
      for (let i = 0; i < 3; i++) { const a = wrap(t * 0.5 + i / 3, 1); g.fillStyle = `rgba(200,200,205,${0.45 * (1 - a)})`; circ(g, cx + a * 12 * s, cy - h - 8 * s - a * 30 * s, (4 + a * 8) * s); }
      g.restore(); return true;
    }
    if (kind === 'root' || kind === 'hay') {
      g.save(); g.translate(x, gy);
      const wob = fall > 0 && fall < 1 ? Math.sin(fall * 20) * 0.08 * (1 - fall) : 0; g.rotate(wob);
      if (kind === 'root') {
        g.strokeStyle = '#5a3d22'; g.lineWidth = 7 * s; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-6 * s, 2 * s); g.quadraticCurveTo(depth * 0.3, -20 * s - depth * 0.5, depth * 0.7 + 6 * s, -depth + 2 * s); g.stroke();
        g.strokeStyle = '#7a5532'; g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(-4 * s, -1 * s); g.quadraticCurveTo(depth * 0.3, -22 * s - depth * 0.5, depth * 0.7 + 4 * s, -depth); g.stroke(); g.lineCap = 'butt';
        g.fillStyle = '#4f8f3a'; ell(g, depth * 0.3, -14 * s - depth * 0.5, 4 * s, 2 * s, 0.5);
      } else {
        const dx = depth * 0.6, hh = 8 * s;
        g.fillStyle = '#c9a44a'; g.beginPath(); g.moveTo(-8 * s, 0); g.lineTo(-8 * s + dx, -depth); g.lineTo(-8 * s + dx, -depth - hh); g.lineTo(-8 * s, -hh); g.fill();
        g.fillStyle = '#e3c264'; g.fillRect(-8 * s, -hh, 16 * s, hh); g.beginPath(); g.moveTo(-8 * s, -hh); g.lineTo(-8 * s + dx, -depth - hh); g.lineTo(8 * s + dx, -depth - hh); g.lineTo(8 * s, -hh); g.fill();
        g.strokeStyle = '#8a5a2a'; g.lineWidth = 1.5 * s; g.beginPath(); g.moveTo(-8 * s, -hh * 0.35); g.lineTo(8 * s, -hh * 0.35); g.moveTo(-8 * s, -hh * 0.7); g.lineTo(8 * s, -hh * 0.7); g.stroke();
        g.strokeStyle = 'rgba(160,120,40,.6)'; g.lineWidth = 1; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-6 * s + i * 3 * s, -hh); g.lineTo(-7 * s + i * 3 * s, -hh - 3 * s); g.stroke(); }
      }
      g.restore(); return true;
    }
    if (kind === 'gumdrop') {
      g.save(); g.translate(x, gy);
      const sq = fall > 0 ? 1 - 0.45 * Math.sin(Math.min(1, fall) * Math.PI) * (fall < 1 ? 1 : 0) : 1;
      const k = Math.abs(Math.round(gy)) % 4, cx = depth * 0.35 + (k - 1.5) * 2.5 * s, cy = -depth * 0.45, col = ['#ff4f9a', '#3ec1ff', '#8be36a', '#ffb13b'][k];
      g.fillStyle = 'rgba(0,0,0,.15)'; ell(g, cx, cy + 1, 14 * s, 3 * s);
      g.fillStyle = col; g.beginPath(); g.moveTo(cx - 8 * s, cy); g.quadraticCurveTo(cx - 8 * s, cy - 12 * s * sq, cx, cy - 12 * s * sq); g.quadraticCurveTo(cx + 8 * s, cy - 12 * s * sq, cx + 8 * s, cy); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.75)'; for (const [dx, dy] of [[-5, -5], [1, -10], [4, -4], [-2, -8]]) g.fillRect(cx + dx * s, cy + dy * s * sq, 2 * s, 2 * s);
      g.fillStyle = 'rgba(255,255,255,.4)'; ell(g, cx - 3.5 * s, cy - 8 * s * sq, 2.2 * s, 3.5 * s * sq, -0.4);
      g.restore(); return true;
    }
    return false;
  }

  // ---------- ambient life and weather of each world (over the ducks) ----------
  function ambient(g, W, H, R, TH, t) {
    const a = TH.amb;
    if (a === 'ash') { for (let i = 0; i < 46; i++) { const x = wrap(i * 97 + Math.sin(t * 0.7 + i) * 30 - t * 20, W), y = wrap(i * 53 + t * 40, H); g.fillStyle = i % 5 ? 'rgba(90,80,80,.55)' : 'rgba(255,140,60,.85)'; g.fillRect(x, y, i % 5 ? 3 : 2.5, i % 5 ? 3 : 2.5); } }
    else if (a === 'swamp') { for (let i = 0; i < 16; i++) { const x = wrap(i * 173 + Math.sin(t + i) * 40, W), y = H * 0.35 + wrap(i * 61, H * 0.4) + Math.sin(t * 2 + i) * 10; g.fillStyle = `rgba(220,255,120,${0.3 + 0.6 * Math.abs(Math.sin(t * 3 + i))})`; circ(g, x, y, 2.5); } g.fillStyle = 'rgba(215,228,210,.09)'; g.fillRect(0, H * 0.64, W, H * 0.08); }
    else if (a === 'leaves') { for (let i = 0; i < 14; i++) { const x = wrap(i * 211 - t * 30 + Math.sin(t + i) * 20, W), y = wrap(i * 89 + t * 50, H); g.save(); g.translate(x, y); g.rotate(t * 2 + i); g.fillStyle = i % 2 ? '#4caf50' : '#8bc34a'; ell(g, 0, 0, 6, 3); g.restore(); } }
    else if (a === 'dust') { g.strokeStyle = 'rgba(240,210,160,.45)'; g.lineWidth = 2; for (let i = 0; i < 10; i++) { const x = wrap(i * 301 + t * 180, W + 300) - 150, y = H * 0.4 + (i * 67) % (H * 0.5); g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 50, y - 8, x + 110, y); g.stroke(); } }
    else if (a === 'birds') { g.strokeStyle = 'rgba(40,40,60,.7)'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = wrap(i * 260 + t * 50, W + 200) - 100, y = H * 0.12 + i * 26 + Math.sin(t + i) * 6, f = Math.sin(t * 8 + i) * 5; g.beginPath(); g.moveTo(x - 9, y - f); g.quadraticCurveTo(x - 4, y - 4, x, y); g.quadraticCurveTo(x + 4, y - 4, x + 9, y - f); g.stroke(); } }
    else if (a === 'sprinkles') { const C = ['#ff4f9a', '#3ec1ff', '#ffe14d', '#8be36a', '#fff']; for (let i = 0; i < 26; i++) { const x = wrap(i * 137 + Math.sin(t + i) * 20, W), y = wrap(i * 71 + t * 34, H); g.save(); g.translate(x, y); g.rotate(t + i); g.fillStyle = C[i % 5]; g.fillRect(-4, -1.5, 8, 3); g.restore(); } }
    else if (a === 'bats') {
      for (let i = 0; i < 6; i++) { const x = wrap(i * 230 + t * 70, W + 200) - 100, y = H * 0.18 + i * 22 + Math.sin(t * 2 + i) * 18, f = Math.sin(t * 14 + i) * 8; g.fillStyle = '#0b0812'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - 8, y - 8 - f, x - 16, y - f); g.quadraticCurveTo(x - 8, y - 2, x, y + 3); g.quadraticCurveTo(x + 8, y - 2, x + 16, y - f); g.quadraticCurveTo(x + 8, y - 8 - f, x, y); g.fill(); }
      g.fillStyle = 'rgba(190,180,215,.12)'; for (let i = 0; i < 3; i++) ell(g, wrap(t * (12 + i * 5) + i * 400, W + 600) - 300, H * (0.66 + i * 0.08), 420, 26);
    }
  }

  window.DUCK_LANDS = { THEMES, MAZE, WATER, CLIFF, DUSTOF, fillGround, sky, far, prop, track, pond, cliff, gap, maze, hurdle, ambient };
})();
