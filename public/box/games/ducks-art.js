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
  function drawDuck(g, x, y, s, color, hat, t = 0, mode = 'stand', flip = false) {
    const [body, wing, head] = PAL[color] || PAL.sunny;
    g.save(); g.translate(x, y); g.scale(flip ? -s : s, s);
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
    g.fillStyle = head; g.beginPath(); g.arc(13, -13, 9, 0, TAU); g.fill();
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
  function duckImg(color, hat, mode = 'stand') {
    const k = color + hat + mode; if (imgCache[k]) return imgCache[k];
    const c = document.createElement('canvas'); c.width = 120; c.height = 100;
    drawDuck(c.getContext('2d'), 58, 60, 2, color, hat, 0, mode);
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
  function drawFarm(g, f, x, y, w, h, t, fx) {
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
    // decorations (emoji)
    if (f.decor.length && iw > 50) { g.font = `${Math.max(8, iw * 0.07)}px sans-serif`; g.textAlign = 'center'; f.decor.forEach((d, i) => g.fillText(DECOR_ICON[d] || '', ix + iw * (0.08 + i * 0.1), iy + ih * 0.16)); g.textAlign = 'left'; }
    // fence
    g.strokeStyle = '#8b5a2b'; g.lineWidth = Math.max(1.5, iw * 0.012); g.strokeRect(ix, iy, iw, ih);
    g.fillStyle = '#6b4420'; const posts = 6; for (let i = 0; i <= posts; i++) { g.fillRect(ix + (iw * i) / posts - 1.5, iy - 2, 3, 5); g.fillRect(ix + (iw * i) / posts - 1.5, iy + ih - 3, 3, 5); }
    // a fox at the fence / a lost duckling
    if (f.event === 'fox') drawFox(g, ix + iw * (0.05 + ((t * 0.08) % 0.3)), iy + ih * 0.95, iw / 260, t);
    // the duck
    const sp = duckSpot(f, t, k), ds = Math.max(0.25, iw / 220);
    if (f.event === 'duckling') drawDuck(g, ix + iw * sp.x - 26 * ds, iy + ih * sp.y + 6 * ds, ds * 0.5, 'sunny', 'none', t + 1, 'run', sp.flip);
    drawDuck(g, ix + iw * sp.x, iy + ih * sp.y, ds, f.color, f.hat, t + k, sp.mode, sp.flip);
    if (sp.mode === 'sleep') { g.fillStyle = '#fff'; g.font = `bold ${Math.max(8, 14 * ds)}px sans-serif`; g.fillText('z', ix + iw * sp.x + 16 * ds, iy + ih * sp.y - 22 * ds - ((t * 10) % 8)); }
    // effects from the phone (hearts when petted, sparkles on level up, crumbs when eating, dust when building)
    for (const e of fx) {
      const age = (performance.now() - e.at) / 1000; if (age > 1.6) continue;
      g.globalAlpha = 1 - age / 1.6; g.font = `${Math.max(10, 18 * ds)}px sans-serif`; g.textAlign = 'center';
      g.fillText({ pet: '❤️', levelUp: '⭐', eat: '🌽', build: '🔨', badge: '🏅', farm: '✨' }[e.kind] || '✨', ix + iw * sp.x + Math.sin(age * 6) * 8, iy + ih * sp.y - 30 * ds - age * 30);
      g.globalAlpha = 1; g.textAlign = 'left';
    }
    // sign: owner, mood, rank
    const fs = Math.max(9, Math.min(18, w * 0.065));
    g.font = `600 ${fs}px Fredoka, sans-serif`; const label = `${f.rank && f.rank <= 3 ? ['🥇', '🥈', '🥉'][f.rank - 1] + ' ' : ''}${f.owner}`;
    const tw = Math.min(iw - 6, g.measureText(label).width + 12);
    g.fillStyle = 'rgba(40,24,10,.75)'; g.fillRect(ix + 3, iy + 3, tw, fs + 6);
    g.fillStyle = '#fff'; g.fillText(label, ix + 9, iy + fs + 4, iw - 18);
    if (w > 90) { g.font = `${fs}px sans-serif`; g.fillText(MOOD(f.mood), ix + iw - fs * 1.4, iy + fs + 4); }
    if (w > 150) { const L = f.levels; g.font = `600 ${fs * 0.8}px Fredoka, sans-serif`; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(ix + 3, iy + ih - fs - 6, iw - 6, fs + 4); g.fillStyle = '#fff'; g.fillText(`🏃${L.run} 🌊${L.swim} 🪽${L.fly} 🧗${L.climb} 💪${L.stamina}`, ix + 8, iy + ih - 8, iw - 14); }
  }
  const DECOR_ICON = { flowers: '🌷', flag: '🚩', gnome: '🧙', lantern: '🏮', scarecrow: '🎃', fountain: '⛲', statue: '🗿', rainbow: '🌈' };
  function drawValley(g, W, H, farms, t, fxBy, born, weather) {
    // meadow + paths + trees around the edge
    g.fillStyle = '#5fb04a'; g.fillRect(0, 0, W, H);
    const L = valleyLayout(Math.max(1, farms.length), W - 20, H - 20);
    g.save(); g.translate(10, 10);
    g.fillStyle = '#c9a26b';
    for (let r = 0; r <= L.rows; r++) g.fillRect(L.ox - 4, L.oy + r * L.fh - 3, L.cols * L.fw + 8, 6);
    for (let c = 0; c <= L.cols; c++) g.fillRect(L.ox + c * L.fw - 3, L.oy - 4, 6, L.rows * L.fh + 8);
    const sorted = farms.slice().sort((a, b) => a.plot - b.plot);
    sorted.forEach((f, i) => {
      const { x, y } = L.cell(i);
      const age = (performance.now() - (born[f.id] || 0)) / 600, sc = Math.min(1, 0.3 + age * 0.7);
      g.save(); g.translate(x + L.fw / 2, y + L.fh / 2); g.scale(sc, sc); g.translate(-L.fw / 2, -L.fh / 2);
      drawFarm(g, f, 0, 0, L.fw, L.fh, t, fxBy[f.id] || []);
      g.restore();
    });
    g.restore();
    if (weather === 'rain') { g.fillStyle = 'rgba(40,60,90,.18)'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 1.5; for (let i = 0; i < 160; i++) { const rx = (i * 97 + t * 300) % W, ry = (i * 53 + t * 700) % H; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 3, ry + 12); g.stroke(); } }
    else if (weather === 'fog') { g.fillStyle = 'rgba(235,240,245,.28)'; g.fillRect(0, 0, W, H); }
    else if (weather === 'heat') { g.fillStyle = 'rgba(255,170,60,.12)'; g.fillRect(0, 0, W, H); }
    else if (weather === 'windy') { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; for (let i = 0; i < 14; i++) { const wx = (i * 211 + t * 260) % (W + 200) - 100, wy = (i * 67) % H; g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 40, wy - 10, wx + 80, wy); g.stroke(); } }
    if (!farms.length) { g.fillStyle = '#fff'; g.font = '600 32px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('Farms appear here as players join', W / 2, H / 2); g.textAlign = 'left'; }
  }

  // ---------- the race (side-scrolling) ----------
  const SEC_COLORS = { track: '#7bc96f', pond: '#4fb3ff', cliff: '#9a8f86', gap: '#c7b9a6' };
  function raceGeometry(R) {
    let acc = 0; const secs = R.sections.map((s) => { const len = { track: 80, pond: 60, cliff: 40, gap: 50 }[s]; const o = { type: s, a: acc, b: acc + len }; acc += len; return o; });
    return { secs, L: acc };
  }
  // Height of the ground at x (in metres) above the base line, and the pose there.
  function groundAt(G, x) {
    const s = G.secs.find((q) => x >= q.a && x < q.b) || G.secs[G.secs.length - 1];
    const f = (x - s.a) / (s.b - s.a);
    if (s.type === 'cliff') return { h: Math.min(1, f / 0.8) * 9, mode: f < 0.8 ? 'climb' : 'run', type: 'cliff', f };
    if (s.type === 'gap') return { h: Math.sin(Math.PI * f) * 6 + 1, mode: 'fly', type: 'gap', f };
    if (s.type === 'pond') return { h: -0.6, mode: 'swim', type: 'pond', f };
    return { h: 0, mode: 'run', type: 'track', f };
  }
  function drawRaceWorld(g, W, H, R, G, cam, PX, t) {
    const base = H * 0.72;
    // sky, sun, clouds, hills (parallax)
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, R.weather === 'rain' ? '#7d8ca3' : R.weather === 'fog' ? '#b7c0c9' : '#7cc8ff'); sky.addColorStop(1, R.weather === 'heat' ? '#ffd9a0' : '#d8f1ff');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    if (R.weather !== 'rain' && R.weather !== 'fog') { g.fillStyle = R.weather === 'heat' ? '#ff9f1c' : '#ffe066'; g.beginPath(); g.arc(W * 0.85, H * 0.15, 40, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 8; i++) { const cx = ((i * 380 - cam * PX * 0.15) % (W + 300) + W + 300) % (W + 300) - 150, cy = 50 + (i % 3) * 40; g.beginPath(); g.arc(cx, cy, 26, 0, TAU); g.arc(cx + 28, cy - 8, 22, 0, TAU); g.arc(cx + 54, cy, 24, 0, TAU); g.fill(); }
    g.fillStyle = '#9fd39a'; g.beginPath(); g.moveTo(0, base); for (let x = 0; x <= W; x += 20) g.lineTo(x, base - 90 - Math.sin((x + cam * PX * 0.35) / 160) * 40); g.lineTo(W, base); g.fill();
    // course
    const m2x = (m) => (m - cam) * PX;
    for (const s of G.secs) {
      const x0 = m2x(s.a), x1 = m2x(s.b); if (x1 < -50 || x0 > W + 50) continue;
      if (s.type === 'track') { g.fillStyle = '#6cc26a'; g.fillRect(x0, base, x1 - x0, H - base); g.fillStyle = '#d9a86c'; g.fillRect(x0, base, x1 - x0, 14); }
      if (s.type === 'pond') { g.fillStyle = '#6cc26a'; g.fillRect(x0, base + 30, x1 - x0, H); g.fillStyle = '#2f8fe0'; g.fillRect(x0, base + 0.6 * PX * 0.9, x1 - x0, H - base); g.fillStyle = 'rgba(255,255,255,.5)'; for (let x = x0; x < x1; x += 40) g.fillRect(x + ((t * 30) % 40), base + 12 + Math.sin(x + t * 3) * 2, 18, 3); }
      if (s.type === 'cliff') {
        g.fillStyle = '#8a7f76'; g.beginPath(); g.moveTo(x0, H); g.lineTo(x0, base); g.lineTo(x0 + (x1 - x0) * 0.8, base - 9 * PX * 0.9); g.lineTo(x1, base - 9 * PX * 0.9); g.lineTo(x1, H); g.fill();
        g.fillStyle = '#6f655d'; for (let i = 0; i < 12; i++) { const fx = x0 + ((i * 53) % (x1 - x0) * 0.8), fy = base - (fx - x0) / ((x1 - x0) * 0.8) * 9 * PX * 0.9 + 18 + (i % 3) * 14; g.fillRect(fx, fy, 14, 8); }
        g.fillStyle = '#6cc26a'; g.fillRect(x0 + (x1 - x0) * 0.8, base - 9 * PX * 0.9, (x1 - x0) * 0.2, 8);
      }
      if (s.type === 'gap') {
        g.fillStyle = '#5b4636'; g.fillRect(x0, base + 6, x1 - x0, H); g.fillStyle = '#2b1d14'; g.fillRect(x0 + 20, base + 6, x1 - x0 - 40, H);
        g.fillStyle = '#6cc26a'; g.fillRect(x0, base, 20, 10); g.fillRect(x1 - 20, base, 20, 10);
      }
    }
    // boost pads (track), fast currents (pond), updrafts (ravine)
    for (const bx of R.boosts || []) {
      const x = m2x(bx); if (x < -40 || x > W + 40) continue;
      const gt = groundAt(G, bx).type;
      if (gt === 'track') { g.fillStyle = '#ffd23f'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 20 + i * 14, base + 2); g.lineTo(x - 10 + i * 14, base + 7); g.lineTo(x - 20 + i * 14, base + 12); g.fill(); } }
      else if (gt === 'pond') { g.strokeStyle = '#bff3ff'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 30 + ((t * 60 + i * 20) % 60), base + 18 + i * 8); g.lineTo(x - 14 + ((t * 60 + i * 20) % 60), base + 18 + i * 8); g.stroke(); } }
      else if (gt === 'gap') { g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { const yy = base - ((t * 80 + i * 40) % 120); g.beginPath(); g.moveTo(x - 8, yy); g.quadraticCurveTo(x + 8, yy - 10, x - 4, yy - 22); g.stroke(); } }
    }
    // hurdles
    for (const hx of R.hurdles) { const x = m2x(hx); if (x < -20 || x > W + 20) continue; g.fillStyle = '#fff'; g.fillRect(x - 10, base - 30, 4, 32); g.fillRect(x + 8, base - 30, 4, 32); g.fillStyle = '#e63946'; g.fillRect(x - 12, base - 32, 26, 7); }
    // start and finish lines
    for (const [m, label] of [[0, 'START'], [G.L, 'FINISH']]) { const x = m2x(m); if (x < -60 || x > W + 60) continue; const gh = groundAt(G, Math.min(m, G.L - 0.01)).h * PX * 0.9; for (let y = 0; y < 120; y += 12) { g.fillStyle = (y / 12) % 2 ? '#fff' : '#1b1b2b'; g.fillRect(x, base - gh - 120 + y, 8, 12); } g.fillStyle = '#fff'; g.font = 'bold 18px Fredoka, sans-serif'; g.fillText(label, x - 20, base - gh - 128); }
    if (R.weather === 'rain') { g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1.5; for (let i = 0; i < 120; i++) { const rx = (i * 97 + t * 400) % W, ry = (i * 53 + t * 900) % H; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 4, ry + 14); g.stroke(); } }
    if (R.weather === 'fog') { g.fillStyle = 'rgba(230,235,240,.35)'; g.fillRect(0, 0, W, H); }
    return base;
  }

  window.DUCK_ART = { PAL, drawDuck, duckImg, drawFox, drawValley, valleyLayout, raceGeometry, groundAt, drawRaceWorld, SEC_COLORS, MOOD, DECOR_ICON };
})();
