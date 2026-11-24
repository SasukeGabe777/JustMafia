'use strict';
// TrashZombies art, all drawn in code: a gritty, realistic top-down town (3/4 view for anything
// that stands up). Light comes from the top-left, so every shadow falls down-right; static things
// are pre-rendered once per area onto an offscreen canvas.
//   TZA.areaCanvas(area, scale)      the area's ground, roads, decals, buildings, props, fence
//   TZA.drawArea(g, area, detail)    the same at any scale (TV thumbnails: detail 0, cheaper)
//   TZA.zombie(type, frame, k, flash, v)  a cached zombie sprite (side view, facing right)
//   TZA.drawPickup(g, x, y, id, t)   a glowing pickup; TZA.drawGarage(g, area, open, t) the door
//   TZA.heroFrames(who, k)           the player's own JustGameBox character, pre-rendered frames
//   TZA.lights(area)                 the street lamps (night lighting)
(function () {
  const W = window.TZW, TAU = Math.PI * 2, OL = '#15110d';
  const M = 140; // the margin drawn around the area (outside the fence)
  const rr = (g, x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255; if (f < 0) { r *= 1 + f; gg *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; } return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(gg) << 8) | Math.round(b)).toString(16).slice(1); };
  const fillOl = (g, c, w = 2) => { g.fillStyle = c; g.fill(); if (w) { g.lineWidth = w; g.strokeStyle = 'rgba(15,11,8,0.55)'; g.lineJoin = 'round'; g.stroke(); } };
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); };
  const ell = (g, x, y, a, b, rot = 0) => { g.beginPath(); g.ellipse(x, y, Math.max(0.1, a), Math.max(0.1, b), rot, 0, TAU); };
  const rnd = (seed) => W.rng(seed);
  const lin = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  const rad = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
  const CAR_COLORS = ['#8c2f27', '#2d4f7c', '#b08a2c', '#3f6b45', '#5b4a6e', '#c9c4b8', '#2a2e35', '#6e6a62', '#7a3c1e'];
  const SH = 'rgba(8,6,4,0.42)'; // shadow colour

  // ---------------- grain: a reusable noise texture (grit on asphalt, concrete, dirt) ----------------
  let NOISE = null;
  function noise() {
    if (NOISE) return NOISE;
    const c = document.createElement('canvas'); c.width = c.height = 192; const g = c.getContext('2d'), im = g.createImageData(192, 192), r = rnd(77);
    for (let i = 0; i < im.data.length; i += 4) { const v = r(), dark = v < 0.5; im.data[i] = im.data[i + 1] = im.data[i + 2] = dark ? 0 : 255; im.data[i + 3] = Math.floor(Math.pow(Math.abs(v - 0.5) * 2, 2.2) * 120); }
    g.putImageData(im, 0, 0); NOISE = c; return c;
  }
  function grain(g, x, y, w, h, a = 0.5) { g.save(); g.globalAlpha = a * 0.5; g.fillStyle = g.createPattern(noise(), 'repeat'); g.fillRect(x, y, w, h); g.restore(); }
  // soft mottling: big faint blobs of light and dark
  function mottle(g, r, x, y, w, h, n, cols, s0, s1) { for (let i = 0; i < n; i++) { g.fillStyle = cols[i % cols.length]; ell(g, x + r() * w, y + r() * h, s0 + r() * s1, (s0 + r() * s1) * (0.5 + r() * 0.5), r() * 3); g.fill(); } }
  // a soft drop shadow for something of height h standing on box (x,y,w,h0)
  function dropShadow(g, x, y, w, h, ht, round, blur) {
    g.save(); g.fillStyle = SH; if (blur) { g.filter = `blur(${Math.min(14, 3 + ht * 0.12)}px)`; }
    const dx = ht * 0.42, dy = ht * 0.3;
    if (round) { ell(g, x + w / 2 + dx, y + h / 2 + dy, w / 2 + 2, h / 2 + 2); g.fill(); }
    else { g.beginPath(); g.moveTo(x + w, y); g.lineTo(x + w + dx, y + dy); g.lineTo(x + w + dx, y + h + dy); g.lineTo(x + dx, y + h + dy); g.lineTo(x, y + h); g.lineTo(x + w, y + h); g.closePath(); g.fill(); g.fillRect(x, y, w, h); }
    g.restore();
  }
  // a box seen from above at 3/4: top face, then a darker front face of `fh` along the bottom
  function box3(g, x, y, w, h, top, fh, o = {}) {
    if (o.shadow !== false) dropShadow(g, x, y, w, h, o.ht || fh * 1.6, false, o.blur);
    const r = o.r || 3;
    rr(g, x, y + h - fh - 2, w, fh + 2, r); g.fillStyle = lin(g, 0, y + h - fh, 0, y + h, [[0, shade(top, -0.42)], [1, shade(top, -0.6)]]); g.fill();
    rr(g, x, y, w, h - fh, r); g.fillStyle = lin(g, x, y, x + w, y + h, [[0, shade(top, 0.12)], [1, shade(top, -0.12)]]); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + r, y + 1); g.lineTo(x + w - r, y + 1); g.moveTo(x + 1, y + r); g.lineTo(x + 1, y + h - fh - r); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; rr(g, x, y, w, h, r); g.stroke();
  }

  // ---------------- the ground off the road ----------------
  function lotGround(g, area, detail, r) {
    const B = area.biome, [a, b] = B.ground, X = -M, Y = -M, Wd = W.AW + 2 * M, Ht = W.AH + 2 * M, st = B.lot;
    g.fillStyle = a; g.fillRect(X, Y, Wd, Ht);
    const n = detail ? 1 : 0.25;
    if (st === 'lawn' || st === 'grass' || st === 'yard') {
      mottle(g, r, X, Y, Wd, Ht, 90 * n, ['rgba(120,150,60,0.18)', 'rgba(30,50,20,0.22)', 'rgba(110,90,50,0.16)'], 30, 90);
      if (detail) { g.strokeStyle = 'rgba(25,45,15,0.35)'; g.lineWidth = 1.2; g.beginPath(); for (let i = 0; i < 1400; i++) { const x = X + r() * Wd, y = Y + r() * Ht; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 5, y - 4 - r() * 5); } g.stroke();
        g.strokeStyle = 'rgba(170,200,110,0.25)'; g.beginPath(); for (let i = 0; i < 700; i++) { const x = X + r() * Wd, y = Y + r() * Ht; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 4, y - 3 - r() * 4); } g.stroke();
        mottle(g, r, X, Y, Wd, Ht, 14, ['rgba(95,75,45,0.45)'], 14, 30); grain(g, X, Y, Wd, Ht, 0.25); }
      if (st === 'yard') { // a blacktop court in the yard
        const cx = r() < 0.5 ? 120 : W.AW - 620, cy = r() < 0.5 ? 100 : W.AH - 380, cw = 500, ch = 280;
        g.fillStyle = '#3b3d40'; g.fillRect(cx, cy, cw, ch); if (detail) grain(g, cx, cy, cw, ch, 0.5);
        g.strokeStyle = 'rgba(230,230,220,0.55)'; g.lineWidth = 4; g.strokeRect(cx + 20, cy + 20, cw - 40, ch - 40); g.beginPath(); g.moveTo(cx + cw / 2, cy + 20); g.lineTo(cx + cw / 2, cy + ch - 20); g.stroke(); circ(g, cx + cw / 2, cy + ch / 2, 40); g.stroke();
      }
    } else if (st === 'dirt' || st === 'fair') {
      mottle(g, r, X, Y, Wd, Ht, 120 * n, ['rgba(40,28,14,0.22)', 'rgba(160,130,90,0.16)', 'rgba(70,60,30,0.2)'], 20, 80);
      if (detail) { for (let i = 0; i < 500; i++) { g.fillStyle = r() < 0.5 ? 'rgba(30,22,12,0.5)' : 'rgba(190,170,130,0.35)'; ell(g, X + r() * Wd, Y + r() * Ht, 1 + r() * 3, 1 + r() * 2, r() * 3); g.fill(); }
        g.strokeStyle = 'rgba(30,20,10,0.22)'; g.lineWidth = 10; for (let i = 0; i < 3; i++) { const y0 = Y + r() * Ht; g.beginPath(); g.moveTo(X, y0); g.bezierCurveTo(X + Wd * 0.3, y0 + (r() - 0.5) * 300, X + Wd * 0.7, y0 + (r() - 0.5) * 300, X + Wd, y0 + (r() - 0.5) * 200); g.stroke(); g.save(); g.translate(0, 26); g.stroke(); g.restore(); }
        grain(g, X, Y, Wd, Ht, 0.45); }
      if (st === 'fair' && detail) { const cs = ['#e8424f', '#ffd23f', '#3ec1ff', '#7dff6a', '#ff7ac6', '#fff']; for (let i = 0; i < 260; i++) { g.fillStyle = cs[i % cs.length]; g.globalAlpha = 0.55; g.fillRect(X + r() * Wd, Y + r() * Ht, 3, 2); } g.globalAlpha = 1; }
    } else if (st === 'parking') {
      g.fillStyle = '#3c3f44'; g.fillRect(X, Y, Wd, Ht); if (detail) grain(g, X, Y, Wd, Ht, 0.6);
      mottle(g, r, X, Y, Wd, Ht, 40 * n, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.03)'], 40, 120);
      g.strokeStyle = 'rgba(225,222,210,0.5)'; g.lineWidth = 4; g.beginPath();
      for (let row = 0; row < 4; row++) { const y0 = 60 + row * 240; for (let x = 40; x < W.AW; x += 130) { g.moveTo(x, y0); g.lineTo(x, y0 + 150); } g.moveTo(40, y0 + 150); g.lineTo(W.AW - 40, y0 + 150); }
      g.stroke();
    } else if (st === 'slabs' || st === 'plaza' || st === 'canal' || st === 'docks') {
      const tw = st === 'slabs' ? 160 : st === 'docks' ? 200 : 80, th = st === 'docks' ? 26 : st === 'slabs' ? 160 : 80;
      g.fillStyle = st === 'docks' ? '#5d4630' : a; g.fillRect(X, Y, Wd, Ht);
      if (detail) { for (let y = Y, row = 0; y < Y + Ht; y += th, row++) for (let x = X - (st === 'docks' ? (row % 3) * 60 : 0); x < X + Wd; x += tw) { const v = r(); g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.04 + r() * 0.09})` : `rgba(255,255,255,${r() * 0.05})`; g.fillRect(x, y, tw, th); } }
      g.strokeStyle = st === 'docks' ? 'rgba(20,12,6,0.6)' : 'rgba(30,28,24,0.32)'; g.lineWidth = st === 'docks' ? 3 : 2; g.beginPath();
      for (let y = Y; y <= Y + Ht; y += th) { g.moveTo(X, y); g.lineTo(X + Wd, y); }
      if (st !== 'docks') for (let x = X; x <= X + Wd; x += tw) { g.moveTo(x, Y); g.lineTo(x, Y + Ht); }
      g.stroke();
      if (detail) { grain(g, X, Y, Wd, Ht, 0.5); mottle(g, r, X, Y, Wd, Ht, 30, ['rgba(30,26,20,0.16)', 'rgba(60,50,30,0.14)'], 30, 90); }
      if (st === 'canal') { const cy = area.hub.y < W.AH / 2 ? W.AH - 210 : 110, chh = 120;
        g.fillStyle = '#2c2f2b'; g.fillRect(X, cy - 14, Wd, chh + 28); g.fillStyle = lin(g, 0, cy, 0, cy + chh, [[0, '#2c4a3a'], [0.5, '#3d6b4a'], [1, '#22382c']]); g.fillRect(X, cy, Wd, chh);
        if (detail) { g.strokeStyle = 'rgba(160,255,120,0.18)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 60; i++) { const x = X + r() * Wd, y = cy + 10 + r() * (chh - 20); g.moveTo(x, y); g.lineTo(x + 20 + r() * 30, y); } g.stroke(); }
        area._canal = cy; }
    } else { grain(g, X, Y, Wd, Ht, 0.4); }
  }

  // ---------------- roads ----------------
  function roads(g, area, detail, r) {
    const R = area.roads, SW = W.SW, hub = area.hub, ext = (q) => ({ ...q, x: q.x < -50 && q.w > 0 ? q.x - M : q.x, w: q.x < -50 ? q.w + M : q.x + q.w > W.AW + 50 ? q.w + M : q.w, y: q.y < -50 ? q.y - M : q.y, h: q.y < -50 ? q.h + M : q.y + q.h > W.AH + 50 ? q.h + M : q.h });
    const E = R.map(ext);
    // sidewalks + curbs
    for (const q of E) { g.fillStyle = '#8f8b83'; g.fillRect(q.x - SW, q.y - SW, q.w + 2 * SW, q.h + 2 * SW); }
    if (area.end === 'culdesac') { circ(g, hub.x, hub.y, R[0].w * 0.95 + SW); g.fillStyle = '#8f8b83'; g.fill(); }
    if (detail) for (const q of E) { grain(g, q.x - SW, q.y - SW, q.w + 2 * SW, q.h + 2 * SW, 0.35); g.strokeStyle = 'rgba(40,36,30,0.35)'; g.lineWidth = 2; g.beginPath();
      const vert = q.h > q.w; if (vert) { for (let y = q.y - SW; y < q.y + q.h + SW; y += 46) { g.moveTo(q.x - SW, y); g.lineTo(q.x, y); g.moveTo(q.x + q.w, y); g.lineTo(q.x + q.w + SW, y); } } else { for (let x = q.x - SW; x < q.x + q.w + SW; x += 46) { g.moveTo(x, q.y - SW); g.lineTo(x, q.y); g.moveTo(x, q.y + q.h); g.lineTo(x, q.y + q.h + SW); } } g.stroke(); }
    // asphalt
    const asph = '#3a3c3f';
    for (const q of E) { g.fillStyle = asph; g.fillRect(q.x, q.y, q.w, q.h); }
    if (area.end === 'culdesac') { circ(g, hub.x, hub.y, R[0].w * 0.95); g.fillStyle = asph; g.fill(); }
    for (const q of E) { g.strokeStyle = 'rgba(200,196,186,0.6)'; g.lineWidth = 5; g.strokeRect(q.x + 1, q.y + 1, q.w - 2, q.h - 2); }
    for (const q of E) { g.fillStyle = asph; g.fillRect(q.x + 3, q.y + 3, q.w - 6, q.h - 6); } // (curbs only on the outside)
    if (area.end === 'culdesac') { circ(g, hub.x, hub.y, R[0].w * 0.95 - 3); g.fillStyle = asph; g.fill(); }
    if (detail) {
      for (const q of E) { grain(g, q.x, q.y, q.w, q.h, 0.7); }
      // patches, cracks, oil
      for (const q of E) {
        const n = Math.round((q.w * q.h) / 26000);
        for (let i = 0; i < n; i++) { const x = q.x + r() * q.w, y = q.y + r() * q.h; const k = r();
          if (k < 0.3) { g.fillStyle = 'rgba(20,20,22,0.35)'; g.fillRect(x, y, 30 + r() * 60, 20 + r() * 40); }
          else if (k < 0.6) { g.fillStyle = 'rgba(8,8,10,0.4)'; ell(g, x, y, 10 + r() * 26, 6 + r() * 14, r() * 3); g.fill(); g.fillStyle = 'rgba(120,80,160,0.07)'; ell(g, x + 3, y - 2, 8 + r() * 10, 4 + r() * 6, r() * 3); g.fill(); }
          else { g.strokeStyle = 'rgba(10,10,10,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); let cx = x, cy = y; for (let j = 0; j < 5; j++) { cx += (r() - 0.5) * 40; cy += (r() - 0.5) * 40; g.lineTo(cx, cy); } g.stroke(); }
        }
      }
    }
    // lane paint: worn (dashed white on side streets, double yellow on the main streets)
    for (const q of R) {
      if (q.bend) continue;
      const vert = q.dir === 'n' || q.dir === 's', main = q.main, c = vert ? q.x + q.w / 2 : q.y + q.h / 2;
      const a0 = vert ? q.y : q.x, a1 = vert ? q.y + q.h : q.x + q.w, near = vert ? hub.y : hub.x, gap = q.w * 0.7;
      const seg = (s0, s1) => { if (s1 - s0 < 10) return; g.save(); g.globalAlpha = 0.75;
        if (main) { g.strokeStyle = '#c9a43a'; g.lineWidth = 5; g.setLineDash([]); for (const o of [-6, 6]) { g.beginPath(); if (vert) { g.moveTo(c + o, s0); g.lineTo(c + o, s1); } else { g.moveTo(s0, c + o); g.lineTo(s1, c + o); } g.stroke(); } }
        else { g.strokeStyle = '#d8d6cc'; g.lineWidth = 4; g.setLineDash([34, 30]); g.beginPath(); if (vert) { g.moveTo(c, s0); g.lineTo(c, s1); } else { g.moveTo(s0, c); g.lineTo(s1, c); } g.stroke(); }
        g.restore(); };
      if (near > a0 && near < a1) { seg(a0 - M, near - gap); seg(near + gap, a1 + M); } else seg(a0 - M, a1 + M);
      if (detail) { g.save(); g.globalCompositeOperation = 'destination-out'; g.globalAlpha = 0.3; g.fillStyle = g.createPattern(noise(), 'repeat'); g.restore(); }
    }
    // crosswalks at a main junction
    if (detail && R.filter((q) => q.main).length >= 3) {
      g.fillStyle = 'rgba(220,218,208,0.55)'; const w = R[0].w;
      for (const q of R) { if (q.bend) continue; const vert = q.dir === 'n' || q.dir === 's', sgn = q.dir === 'n' || q.dir === 'w' ? -1 : 1, d = w * 0.62 + 30;
        for (let i = -4; i <= 4; i++) { if (vert) g.fillRect(hub.x + i * (w / 10) - 7, hub.y + sgn * d - 18, 14, 36); else g.fillRect(hub.x + sgn * d - 18, hub.y + i * (w / 10) - 7, 36, 14); } }
    }
    // a dead end: a chained gate across the end, or a cul-de-sac
    if (area.end === 'gate') { const q = R[0], vert = q.dir === 'n' || q.dir === 's'; g.save(); g.translate(hub.x, hub.y); if (!vert) g.rotate(Math.PI / 2); g.fillStyle = '#5b6168'; g.fillRect(-q.w / 2 - SW, -6, q.w + 2 * SW, 8); g.strokeStyle = 'rgba(190,196,204,0.45)'; g.lineWidth = 1.5; g.beginPath(); for (let x = -q.w / 2 - SW; x < q.w / 2 + SW; x += 12) { g.moveTo(x, -30); g.lineTo(x + 12, -2); g.moveTo(x + 12, -30); g.lineTo(x, -2); } g.stroke(); g.fillStyle = '#c9a43a'; g.fillRect(-14, -12, 28, 14); g.restore(); }
    // drains + manholes
    if (detail) for (const q of R) { if (q.bend) continue; const vert = q.dir === 'n' || q.dir === 's'; const t = 0.3 + r() * 0.4, x = vert ? q.x + q.w * (0.25 + r() * 0.5) : q.x + q.w * t, y = vert ? q.y + q.h * t : q.y + q.h * (0.25 + r() * 0.5);
      circ(g, x, y, 17); g.fillStyle = '#2a2b2d'; g.fill(); g.strokeStyle = '#4a4b4e'; g.lineWidth = 3; g.stroke(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - 10, y); g.lineTo(x + 10, y); g.moveTo(x, y - 10); g.lineTo(x, y + 10); g.stroke(); }
  }

  // ---------------- decals: grime that sits on the ground ----------------
  function decals(g, area) {
    for (const d of area.decals) {
      g.save(); g.translate(d.x, d.y); g.rotate(d.a); g.scale(d.s, d.s);
      switch (d.k) {
        case 0: g.strokeStyle = 'rgba(10,10,10,0.4)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-36, 0); g.lineTo(-12, 5); g.lineTo(2, -7); g.lineTo(30, 3); g.moveTo(2, -7); g.lineTo(10, -22); g.moveTo(-12, 5); g.lineTo(-16, 18); g.stroke(); break; // crack
        case 1: g.fillStyle = 'rgba(30,40,45,0.35)'; ell(g, 0, 0, 34, 18); g.fill(); g.fillStyle = 'rgba(160,190,210,0.10)'; ell(g, -6, -4, 20, 8); g.fill(); break; // puddle
        case 2: g.fillStyle = 'rgba(220,214,196,0.85)'; g.fillRect(-9, -7, 18, 13); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(-9, 2, 18, 4); break; // paper
        case 3: g.fillStyle = '#8a2a22'; g.fillRect(-4, -7, 8, 14); g.fillStyle = '#b8b8b8'; g.fillRect(-4, -7, 8, 2); break; // can
        case 4: g.strokeStyle = 'rgba(10,10,10,0.25)'; g.lineWidth = 8; g.beginPath(); g.moveTo(-50, 0); g.quadraticCurveTo(0, 16, 50, 4); g.stroke(); g.beginPath(); g.moveTo(-50, 22); g.quadraticCurveTo(0, 38, 50, 26); g.stroke(); break; // skid marks
        case 5: g.fillStyle = 'rgba(70,10,8,0.35)'; ell(g, 0, 0, 16, 10); g.fill(); ell(g, 18, 6, 6, 4); g.fill(); ell(g, -14, 8, 4, 3); g.fill(); break; // old blood
        case 6: g.fillStyle = rad(g, 0, 0, 2, 44, [[0, 'rgba(10,8,6,0.55)'], [1, 'rgba(10,8,6,0)']]); circ(g, 0, 0, 44); g.fill(); break; // scorch
        default: g.fillStyle = 'rgba(120,90,40,0.6)'; for (let i = 0; i < 5; i++) { ell(g, i * 7 - 14, (i % 2) * 6, 5, 3, i); g.fill(); } // leaves
      }
      g.restore();
    }
  }

  // ---------------- buildings ----------------
  const ROOFS = { house: ['#5a4a44', '#4a4f57', '#6b3f34', '#55504a'], tower: ['#8a877f', '#77746c', '#6d6a63'], store: ['#8d8a82'], mall: ['#9a968c'], school: ['#8a867c'], plant: ['#7a7d76'], warehouse: ['#7d8288', '#8a6f55'], shack: ['#7a7064', '#6d7378'], kiosk: ['#8d8a82'], tent: ['#c23a3a'] };
  const WALLS = { house: ['#cdbfa6', '#a9b4b8', '#c9a27e', '#b9b1a4'], tower: ['#7d6253', '#8b8f94', '#6e5a4c'], store: ['#d2c7b3'], mall: ['#cfc6b4'], school: ['#a85d45'], plant: ['#8f948c'], warehouse: ['#8d9298'], shack: ['#8a7660'], kiosk: ['#cfc6b4'], tent: ['#e8e2d4'] };
  function building(g, o, detail) {
    const { x, y, w, h, style, v } = o, r = rnd(o.seed), roofC = (ROOFS[style] || ROOFS.tower)[v % (ROOFS[style] || ROOFS.tower).length], wallC = (WALLS[style] || WALLS.tower)[v % (WALLS[style] || WALLS.tower).length];
    const tall = { tower: 70, mall: 54, school: 50, store: 44, plant: 46, warehouse: 48, house: 40, shack: 30, kiosk: 30, tent: 26 }[style] || 40, fh = Math.min(tall, h * 0.32);
    dropShadow(g, x, y, w, h, tall * 1.5, false, detail);
    // front wall with windows
    const wy = y + h - fh;
    g.fillStyle = lin(g, 0, wy, 0, y + h, [[0, shade(wallC, -0.2)], [1, shade(wallC, -0.45)]]); g.fillRect(x, wy, w, fh);
    if (detail) { grain(g, x, wy, w, fh, 0.35);
      const n = Math.max(1, Math.floor(w / 70)), ww = Math.min(34, w / n - 16), wh = fh * 0.45;
      for (let i = 0; i < n; i++) { const wx = x + (i + 0.5) * (w / n) - ww / 2, broken = r() < 0.3;
        if (style === 'house' && i === Math.floor(n / 2)) { g.fillStyle = '#4a3226'; g.fillRect(wx + 4, y + h - fh * 0.85, ww - 8, fh * 0.85); continue; }
        g.fillStyle = broken ? '#121212' : lin(g, wx, wy, wx + ww, wy + wh, [[0, '#28333c'], [1, '#4b5d6a']]); g.fillRect(wx, wy + fh * 0.22, ww, wh);
        if (broken) { g.strokeStyle = 'rgba(200,220,230,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(wx, wy + fh * 0.22); g.lineTo(wx + ww * 0.6, wy + fh * 0.22 + wh * 0.5); g.lineTo(wx + ww * 0.2, wy + fh * 0.22 + wh); g.stroke(); }
        else if (r() < 0.25) { g.fillStyle = 'rgba(120,90,60,0.6)'; g.fillRect(wx, wy + fh * 0.22, ww, wh); } // boarded
      }
      if (style === 'store' || style === 'mall') { g.fillStyle = ['#a83a32', '#2f5f8a', '#7a6a2a'][v % 3]; g.fillRect(x + w * 0.2, wy + 2, w * 0.6, fh * 0.16); g.fillStyle = 'rgba(255,240,210,0.6)'; g.font = `bold ${Math.round(fh * 0.13)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(style === 'mall' ? 'SHOPPING CENTER' : ['QUIK-MART', 'GROCER', 'DELI'][v % 3], x + w / 2, wy + 2 + fh * 0.08); }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y + h - 3, w, 3);
    // the roof
    const ry = y, rh = h - fh;
    if (style === 'house') {
      const vert = rh > w; g.save();
      if (!vert) { g.fillStyle = lin(g, 0, ry, 0, ry + rh, [[0, shade(roofC, 0.18)], [0.5, shade(roofC, 0.05)], [0.5, shade(roofC, -0.25)], [1, shade(roofC, -0.35)]]); }
      else { g.fillStyle = lin(g, x, 0, x + w, 0, [[0, shade(roofC, 0.18)], [0.5, shade(roofC, 0.05)], [0.5, shade(roofC, -0.25)], [1, shade(roofC, -0.35)]]); }
      g.fillRect(x - 6, ry - 4, w + 12, rh + 8);
      if (detail) { g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 1.5; g.beginPath(); if (!vert) for (let yy = ry + 6; yy < ry + rh; yy += 9) { g.moveTo(x - 6, yy); g.lineTo(x + w + 6, yy); } else for (let xx = x; xx < x + w; xx += 9) { g.moveTo(xx, ry - 4); g.lineTo(xx, ry + rh + 4); } g.stroke(); grain(g, x - 6, ry - 4, w + 12, rh + 8, 0.45);
        g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 3; g.beginPath(); if (!vert) { g.moveTo(x - 6, ry + rh / 2); g.lineTo(x + w + 6, ry + rh / 2); } else { g.moveTo(x + w / 2, ry - 4); g.lineTo(x + w / 2, ry + rh + 4); } g.stroke();
        const cx = x + w * (0.2 + r() * 0.6), cy = ry + rh * 0.2; box3(g, cx, cy, 22, 26, '#7a4a3a', 8, { blur: false, ht: 30 });
        if (r() < 0.5) { g.fillStyle = 'rgba(60,40,20,0.35)'; ell(g, x + r() * w, ry + r() * rh, 30, 18, r()); g.fill(); } }
      g.restore();
    } else if (style === 'tent') {
      g.save(); rr(g, x - 4, ry - 4, w + 8, rh + 8, 10); g.clip();
      for (let xx = x - 4, i = 0; xx < x + w + 4; xx += 26, i++) { g.fillStyle = i % 2 ? '#b5343a' : '#e6dccb'; g.fillRect(xx, ry - 4, 26, rh + 8); }
      g.fillStyle = lin(g, x, 0, x + w, 0, [[0, 'rgba(255,255,255,0.15)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.3)']]); g.fillRect(x - 4, ry - 4, w + 8, rh + 8); if (detail) grain(g, x - 4, ry - 4, w + 8, rh + 8, 0.35); g.restore();
    } else {
      const corr = style === 'warehouse' || style === 'shack' || style === 'kiosk';
      g.fillStyle = shade(roofC, -0.15); g.fillRect(x, ry, w, rh); // parapet
      g.fillStyle = corr ? roofC : shade(roofC, -0.05); g.fillRect(x + 6, ry + 6, w - 12, rh - 12);
      if (detail) {
        if (corr) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); for (let xx = x + 8; xx < x + w - 6; xx += 10) { g.moveTo(xx, ry + 6); g.lineTo(xx, ry + rh - 6); } g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.1)'; g.beginPath(); for (let xx = x + 12; xx < x + w - 6; xx += 10) { g.moveTo(xx, ry + 6); g.lineTo(xx, ry + rh - 6); } g.stroke();
          for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(140,70,30,0.35)'; ell(g, x + 10 + r() * (w - 20), ry + 10 + r() * (rh - 20), 12 + r() * 24, 8 + r() * 14, r()); g.fill(); } }
        else { grain(g, x + 6, ry + 6, w - 12, rh - 12, 0.8); for (let i = 0; i < 80; i++) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.15)'; g.fillRect(x + 8 + r() * (w - 16), ry + 8 + r() * (rh - 16), 2, 2); } }
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.strokeRect(x + 6, ry + 6, w - 12, rh - 12);
        g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 1, ry + rh); g.lineTo(x + 1, ry + 1); g.lineTo(x + w, ry + 1); g.stroke();
        // stains, AC units, vents, skylights, a hatch
        for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(30,25,15,0.25)'; ell(g, x + 20 + r() * (w - 40), ry + 20 + r() * (rh - 40), 14 + r() * 30, 8 + r() * 16, r()); g.fill(); }
        const units = Math.max(1, Math.round((w * rh) / 30000)) + (style === 'tower' ? 1 : 0);
        for (let i = 0; i < units; i++) { const ux = x + 20 + r() * (w - 90), uy = ry + 16 + r() * Math.max(1, rh - 80); if (ux + 54 > x + w - 10 || uy + 48 > ry + rh - 8) continue;
          box3(g, ux, uy, 54, 46, '#a9aeb3', 12, { ht: 22 }); circ(g, ux + 27, uy + 17, 13); g.fillStyle = '#3a3f44'; g.fill(); g.strokeStyle = '#8a9096'; g.lineWidth = 2; g.beginPath(); for (let a = 0; a < 3; a++) { const an = a * TAU / 3 + r(); g.moveTo(ux + 27, uy + 17); g.lineTo(ux + 27 + Math.cos(an) * 12, uy + 17 + Math.sin(an) * 12); } g.stroke(); }
        if (style === 'mall' || style === 'school') for (let i = 0; i < Math.floor(w / 140); i++) { const sx = x + 40 + i * 140, sy = ry + rh / 2 - 22; if (sx + 70 > x + w - 20) break; g.fillStyle = lin(g, sx, sy, sx + 70, sy + 44, [[0, '#7c97a8'], [1, '#3c4f5c']]); g.fillRect(sx, sy, 70, 44); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2; g.strokeRect(sx, sy, 70, 44); g.beginPath(); g.moveTo(sx + 35, sy); g.lineTo(sx + 35, sy + 44); g.stroke(); if (r() < 0.4) { g.fillStyle = '#121212'; g.fillRect(sx + 4, sy + 4, 28, 36); } }
        for (let i = 0; i < 2; i++) { const vx = x + 16 + r() * (w - 40), vy = ry + 14 + r() * (rh - 36); circ(g, vx + 7, vy + 7, 7); g.fillStyle = '#5a5f64'; g.fill(); circ(g, vx + 7, vy + 7, 3.5); g.fillStyle = '#1e2124'; g.fill(); }
      }
    }
    // ambient occlusion where the wall meets the ground
    if (detail) { g.fillStyle = lin(g, 0, y + h, 0, y + h + 14, [[0, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - 4, y + h, w + 8, 14); }
  }

  // ---------------- props ----------------
  function car(g, x, y, w, h, col, vert, o = {}) {
    // a car seen from above (nose towards +x or +y), sitting in its box
    const L = vert ? h : w, Wd = vert ? w : h;
    g.save(); g.translate(x + w / 2, y + h / 2); if (vert) g.rotate(Math.PI / 2); if (o.flip) g.rotate(Math.PI);
    const bx = -L / 2, by = -Wd / 2;
    g.fillStyle = SH; g.save(); if (o.blur) g.filter = 'blur(5px)'; rr(g, bx + 10, by + 10, L, Wd, 14); g.fill(); g.restore();
    const body = o.burnt ? '#2b2624' : col;
    rr(g, bx, by, L, Wd, 14); g.fillStyle = lin(g, 0, by, 0, by + Wd, [[0, shade(body, 0.25)], [0.45, body], [1, shade(body, -0.45)]]); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2; g.stroke();
    // cabin: windshield, roof, rear window
    const cx0 = bx + L * 0.28, cl = L * 0.5;
    rr(g, cx0, by + Wd * 0.12, cl, Wd * 0.76, 8); g.fillStyle = o.burnt ? '#141210' : '#1d2a33'; g.fill();
    rr(g, cx0 + cl * 0.28, by + Wd * 0.16, cl * 0.46, Wd * 0.68, 5); g.fillStyle = lin(g, 0, by, 0, by + Wd, [[0, shade(body, 0.15)], [1, shade(body, -0.3)]]); g.fill();
    if (!o.burnt) { g.fillStyle = 'rgba(170,210,235,0.25)'; g.beginPath(); g.moveTo(cx0 + cl * 0.72, by + Wd * 0.16); g.lineTo(cx0 + cl * 0.98, by + Wd * 0.2); g.lineTo(cx0 + cl * 0.86, by + Wd * 0.5); g.closePath(); g.fill(); }
    if (o.wreck && !o.burnt) { g.strokeStyle = 'rgba(220,230,240,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx0 + cl * 0.8, by + Wd * 0.3); g.lineTo(cx0 + cl * 0.9, by + Wd * 0.55); g.lineTo(cx0 + cl * 0.75, by + Wd * 0.7); g.stroke(); g.fillStyle = 'rgba(40,30,20,0.4)'; ell(g, bx + L * 0.85, by + Wd * 0.3, 14, 9); g.fill(); }
    // lights, mirrors, hood line
    g.fillStyle = o.burnt ? '#333' : '#e8e2c8'; g.fillRect(bx + L - 6, by + 6, 5, 10); g.fillRect(bx + L - 6, by + Wd - 16, 5, 10);
    g.fillStyle = o.burnt ? '#333' : '#8a1a14'; g.fillRect(bx + 1, by + 6, 4, 10); g.fillRect(bx + 1, by + Wd - 16, 4, 10);
    g.fillStyle = shade(body, -0.4); g.fillRect(cx0 + cl * 0.85, by - 4, 6, 5); g.fillRect(cx0 + cl * 0.85, by + Wd - 1, 6, 5);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(bx + L * 0.86, by + 8); g.lineTo(bx + L * 0.86, by + Wd - 8); g.stroke();
    if (o.burnt) { g.fillStyle = 'rgba(120,60,30,0.5)'; for (let i = 0; i < 6; i++) { ell(g, bx + (o.r() * L), by + o.r() * Wd, 6 + o.r() * 10, 4 + o.r() * 6, o.r()); g.fill(); } }
    if (o.detail) grain(g, bx, by, L, Wd, 0.25);
    g.restore();
    if (o.burnt) { g.fillStyle = rad(g, x + w / 2, y + h / 2, 10, Math.max(w, h) * 0.9, [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(10,8,6,0.25)'], [1, 'rgba(10,8,6,0)']]); circ(g, x + w / 2, y + h / 2, Math.max(w, h) * 0.9); g.fill(); }
  }
  function cyl(g, cx, cy, rx, col, ht, o = {}) {
    // a round thing from above (barrel, bin, tank): shadow, rim and lit top
    g.save(); g.fillStyle = SH; if (o.blur) g.filter = 'blur(4px)'; ell(g, cx + ht * 0.4, cy + ht * 0.3, rx, rx * 0.95); g.fill(); g.restore();
    circ(g, cx, cy, rx); g.fillStyle = rad(g, cx - rx * 0.35, cy - rx * 0.35, rx * 0.1, rx * 1.1, [[0, shade(col, 0.3)], [0.7, col], [1, shade(col, -0.45)]]); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5; g.stroke();
  }
  function foliage(g, cx, cy, R, r, base, blur) {
    g.save(); g.fillStyle = 'rgba(8,10,4,0.4)'; if (blur) g.filter = 'blur(6px)'; ell(g, cx + R * 0.45, cy + R * 0.35, R * 1.05, R * 0.95); g.fill(); g.restore();
    for (let i = 0; i < 9; i++) { const a = r() * TAU, d = r() * R * 0.55, s = R * (0.38 + r() * 0.25); circ(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d, s); g.fillStyle = rad(g, cx + Math.cos(a) * d - s * 0.3, cy + Math.sin(a) * d - s * 0.3, 1, s * 1.1, [[0, shade(base, 0.25)], [0.6, base], [1, shade(base, -0.45)]]); g.fill(); }
    g.fillStyle = 'rgba(200,230,140,0.12)'; for (let i = 0; i < 14; i++) { circ(g, cx - R * 0.3 + (r() - 0.5) * R, cy - R * 0.3 + (r() - 0.5) * R, 2 + r() * 4); g.fill(); }
  }
  function prop(g, o, detail) {
    const { x, y, w, h, kind, v } = o, r = rnd(o.seed), cx = x + w / 2, cy = y + h / 2, B = !!detail, vert = h > w;
    switch (kind) {
      case 'bld': building(g, o, detail); break;
      case 'car': car(g, x - 4, y + 2, w + 8, h - 4, CAR_COLORS[(v + o.seed) % CAR_COLORS.length], vert, { blur: B, flip: v % 2, detail, r }); break;
      case 'wreck': car(g, x - 4, y + 2, w + 8, h - 4, CAR_COLORS[(v * 3 + o.seed) % CAR_COLORS.length], vert, { blur: B, flip: v % 2, wreck: true, burnt: v % 2 === 0, detail, r }); break;
      case 'stack': car(g, x - 2, y + 4, w + 4, h - 6, '#5a4a3a', vert, { blur: B, wreck: true, burnt: true, r }); g.save(); g.translate(6, -12); car(g, x, y + 4, w, h - 6, CAR_COLORS[v % CAR_COLORS.length], vert, { wreck: true, r, flip: 1 }); g.restore(); break;
      case 'bus': { dropShadow(g, x, y, w, h, 40, false, B); g.save(); g.translate(cx, cy); if (vert) g.rotate(Math.PI / 2); const L = vert ? h : w, Wd = vert ? w : h; rr(g, -L / 2, -Wd / 2, L, Wd, 10); g.fillStyle = lin(g, 0, -Wd / 2, 0, Wd / 2, [[0, '#e8b83a'], [1, '#a87a18']]); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.stroke(); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 6; i++) g.fillRect(-L / 2 + 20 + i * (L - 40) / 6, -Wd / 2 + 4, (L - 60) / 6, Wd - 8); g.fillStyle = '#1d2a33'; g.fillRect(L / 2 - 22, -Wd / 2 + 6, 14, Wd - 12); g.restore(); break; }
      case 'container': { const cols = ['#8a3a2a', '#2f5a85', '#3d6b4a', '#a8682a', '#6b6f74']; const c0 = cols[v % cols.length]; box3(g, x, y, w, h, c0, Math.min(26, h * 0.3), { blur: B, ht: 50 }); if (B) { g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 2; g.beginPath(); if (w > h) for (let xx = x + 8; xx < x + w - 4; xx += 9) { g.moveTo(xx, y + 2); g.lineTo(xx, y + h - Math.min(26, h * 0.3)); } else for (let yy = y + 8; yy < y + h - 26; yy += 9) { g.moveTo(x + 2, yy); g.lineTo(x + w - 2, yy); } g.stroke(); for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(120,55,25,0.4)'; ell(g, x + r() * w, y + r() * h * 0.7, 8 + r() * 16, 5 + r() * 8, r()); g.fill(); } } break; }
      case 'tires': for (let i = 0; i < 3; i++) { const tx = cx + (i - 1) * 8, ty = cy + 6 - i * 7; cyl(g, tx, ty, w * 0.42, '#1f1d1c', 14, { blur: B && i === 0 }); circ(g, tx, ty, w * 0.18); g.fillStyle = '#0d0c0b'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 3; circ(g, tx, ty, w * 0.32); g.stroke(); } break;
      case 'trash': case 'bags': case 'mound': {
        const cols = kind === 'trash' || kind === 'mound' ? ['#2a2a30', '#3a3530', '#4a4238', '#55503f', '#2c3a2a'] : ['#1c1c22', '#26262e', '#30303a'];
        if (kind !== 'bags') { g.fillStyle = 'rgba(30,25,15,0.5)'; ell(g, cx + 6, cy + 6, w * 0.55, h * 0.45); g.fill(); }
        const n = kind === 'mound' ? 22 : 8;
        for (let i = 0; i < n; i++) { const a = r() * TAU, d = r() * w * 0.32, s = w * (kind === 'mound' ? 0.1 + r() * 0.08 : 0.17 + r() * 0.1), bx = cx + Math.cos(a) * d, by = cy + Math.sin(a) * d * 0.8;
          g.fillStyle = SH; ell(g, bx + 4, by + 4, s, s * 0.85); g.fill();
          circ(g, bx, by, s); g.fillStyle = rad(g, bx - s * 0.4, by - s * 0.4, 1, s * 1.2, [[0, shade(cols[i % cols.length], 0.35)], [0.5, cols[i % cols.length]], [1, shade(cols[i % cols.length], -0.5)]]); g.fill();
          if (kind !== 'mound') { g.fillStyle = 'rgba(255,255,255,0.18)'; ell(g, bx - s * 0.35, by - s * 0.4, s * 0.25, s * 0.12, -0.6); g.fill(); } }
        if (B && kind !== 'bags') for (let i = 0; i < 8; i++) { g.fillStyle = ['#cfc8b6', '#8a2a22', '#2f5a85', '#c9a43a'][i % 4]; g.save(); g.translate(cx + (r() - 0.5) * w * 0.8, cy + (r() - 0.5) * h * 0.7); g.rotate(r() * 3); g.fillRect(-5, -3, 10, 6); g.restore(); }
        break;
      }
      case 'barrel': { const tox = v % 2 === 0, c0 = tox ? '#3d6a3a' : v === 1 ? '#7a3a22' : '#2f4f6e'; cyl(g, cx, cy, w * 0.42, c0, 26, { blur: B }); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; circ(g, cx, cy, w * 0.3); g.stroke(); circ(g, cx + w * 0.12, cy - w * 0.12, 4); g.fillStyle = '#222'; g.fill(); if (tox) { g.fillStyle = 'rgba(190,240,80,0.65)'; ell(g, cx + w * 0.35, cy + w * 0.3, 10, 6); g.fill(); } if (B) { g.fillStyle = 'rgba(110,50,20,0.4)'; ell(g, cx - 6, cy + 4, 8, 5); g.fill(); } break; }
      case 'fridge': box3(g, x, y, w, h, '#d9d5cb', 16, { blur: B, ht: 40 }); g.fillStyle = 'rgba(80,70,50,0.35)'; ell(g, cx - 6, cy - 4, 10, 6); g.fill(); g.fillStyle = '#8a8f94'; g.fillRect(x + w - 10, y + 6, 3, h - 26); break;
      case 'bin': { const c0 = v % 2 ? '#2f5a3a' : '#3a4048'; dropShadow(g, x + 6, y + 6, w - 12, h - 12, 24, false, B); rr(g, x + 6, y + 6, w - 12, h - 12, 5); g.fillStyle = lin(g, x, y, x + w, y + h, [[0, shade(c0, 0.2)], [1, shade(c0, -0.3)]]); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.moveTo(x + 10, y + 14); g.lineTo(x + w - 10, y + 14); g.stroke(); g.fillStyle = '#1a1a1a'; g.fillRect(x + 10, y + h - 12, 8, 6); g.fillRect(x + w - 18, y + h - 12, 8, 6); break; }
      case 'hedge': case 'bush': { const n = kind === 'hedge' ? Math.max(3, Math.round(Math.max(w, h) / 36)) : 1; if (kind === 'bush') foliage(g, cx, cy, w * 0.48, r, '#3f6b2e', B); else for (let i = 0; i < n; i++) { const px = vert ? cx : x + (w / n) * (i + 0.5), py = vert ? y + (h / n) * (i + 0.5) : cy; foliage(g, px, py, Math.min(w, h) * 0.55, r, '#36622a', B && i === 0); } break; }
      case 'tree': { const R = w * 0.78; foliage(g, cx, cy - 6, R, r, ['#355f28', '#41702e', '#4c6a2a', '#5b5a28'][v % 4], B); break; }
      case 'mailbox': g.fillStyle = SH; ell(g, cx + 8, cy + 6, 14, 6); g.fill(); g.fillStyle = '#4a3020'; g.fillRect(cx - 3, cy - 2, 6, 14); rr(g, cx - 13, cy - 14, 26, 14, 6); g.fillStyle = lin(g, 0, cy - 14, 0, cy, [[0, '#4a6a8a'], [1, '#2a3a4e']]); g.fill(); g.fillStyle = '#a83a32'; g.fillRect(cx + 9, cy - 22, 3, 10); break;
      case 'cart': { dropShadow(g, x + 6, y + 4, w - 12, h - 10, 18, false, B); g.strokeStyle = '#9aa2aa'; g.lineWidth = 2; g.strokeRect(x + 6, y + 4, w - 12, h - 14); g.beginPath(); for (let xx = x + 12; xx < x + w - 6; xx += 6) { g.moveTo(xx, y + 4); g.lineTo(xx, y + h - 10); } for (let yy = y + 10; yy < y + h - 10; yy += 6) { g.moveTo(x + 6, yy); g.lineTo(x + w - 6, yy); } g.stroke(); g.fillStyle = '#7a2a24'; g.fillRect(x + 4, y + h - 12, w - 8, 5); break; }
      case 'barrier': { box3(g, x, y + h * 0.2, w, h * 0.6, '#b3ada1', 10, { blur: B, ht: 26 }); g.fillStyle = 'rgba(150,40,30,0.55)'; for (let k = 0; k < 4; k++) { const t = (k + 0.5) / 4; if (vert) g.fillRect(x + 4, y + h * 0.2 + t * h * 0.6 - 6, w - 8, 8); else g.fillRect(x + t * w - 8, y + h * 0.2 + 3, 12, h * 0.6 - 16); } break; }
      case 'pump': { box3(g, x + 4, y + 8, w - 8, h - 16, '#b8433a', 20, { blur: B, ht: 46 }); g.fillStyle = '#1d2226'; g.fillRect(x + 12, y + 16, w - 24, 20); g.fillStyle = 'rgba(120,255,140,0.35)'; g.fillRect(x + 15, y + 19, w - 30, 6); g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + w - 8, y + 40); g.quadraticCurveTo(x + w + 14, y + h * 0.55, x + w - 4, y + h - 30); g.stroke(); break; }
      case 'crate': { box3(g, x + 2, y + 2, w - 4, h - 4, '#8a6238', 14, { blur: B, ht: 30 }); g.strokeStyle = 'rgba(40,24,10,0.6)'; g.lineWidth = 2; g.beginPath(); for (let k = 1; k < 4; k++) { g.moveTo(x + 2, y + 2 + k * (h - 18) / 4); g.lineTo(x + w - 2, y + 2 + k * (h - 18) / 4); } g.moveTo(x + 4, y + 4); g.lineTo(x + w - 4, y + h - 18); g.stroke(); if (B) grain(g, x, y, w, h, 0.3); break; }
      case 'dumpster': { const c0 = v % 2 ? '#2f5a3a' : '#2f4a6a'; box3(g, x, y, w, h, c0, Math.min(22, h * 0.35), { blur: B, ht: 40 }); g.fillStyle = shade(c0, -0.25); g.fillRect(x + 4, y + 4, w / 2 - 6, h - Math.min(22, h * 0.35) - 8); g.fillStyle = shade(c0, 0.08); g.fillRect(x + w / 2 + 2, y + 4, w / 2 - 6, h - Math.min(22, h * 0.35) - 8); g.fillStyle = 'rgba(120,60,25,0.45)'; for (let k = 0; k < 4; k++) { ell(g, x + r() * w, y + r() * h * 0.6, 6 + r() * 8, 4 + r() * 5, r()); g.fill(); } g.fillStyle = '#26262e'; circ(g, x + w + 4, cy + 6, 9); g.fill(); break; }
      case 'bench': case 'picnic': { const c0 = kind === 'picnic' ? '#7a5a3a' : '#6b4a2a'; dropShadow(g, x + 2, y + 6, w - 4, h - 12, 16, false, B); g.fillStyle = '#3a3a3a'; g.fillRect(x + 6, y + 8, 5, h - 16); g.fillRect(x + w - 11, y + 8, 5, h - 16); g.fillStyle = c0; for (let k = 0; k < (kind === 'picnic' ? 5 : 3); k++) { if (vert) g.fillRect(x + 6 + k * (w - 12) / (kind === 'picnic' ? 5 : 3), y + 4, (w - 12) / (kind === 'picnic' ? 5 : 3) - 3, h - 8); else g.fillRect(x + 2, y + 8 + k * (h - 16) / (kind === 'picnic' ? 5 : 3), w - 4, (h - 16) / (kind === 'picnic' ? 5 : 3) - 3); } g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 2, y + 8, w - 4, 2); break; }
      case 'planter': cyl(g, cx, cy, w * 0.44, '#7a7268', 20, { blur: B }); circ(g, cx, cy, w * 0.34); g.fillStyle = '#3a2a1a'; g.fill(); foliage(g, cx, cy - 2, w * 0.3, r, '#4a6a2a', false); break;
      case 'fountain': case 'pond': { const rx = w * 0.48, ry = h * 0.46; if (kind === 'fountain') { ell(g, cx + 6, cy + 6, rx, ry); g.fillStyle = SH; g.fill(); ell(g, cx, cy, rx, ry); g.fillStyle = '#9a958a'; g.fill(); } ell(g, cx, cy, rx * (kind === 'pond' ? 1 : 0.84), ry * (kind === 'pond' ? 1 : 0.84)); g.fillStyle = rad(g, cx - rx * 0.3, cy - ry * 0.3, 4, rx, [[0, '#4a6a5a'], [1, kind === 'pond' ? '#1f3a2c' : '#2c4a40']]); g.fill(); g.fillStyle = 'rgba(120,170,60,0.4)'; for (let k = 0; k < 10; k++) { circ(g, cx + (r() - 0.5) * rx * 1.4, cy + (r() - 0.5) * ry * 1.4, 3 + r() * 6); g.fill(); } if (kind === 'fountain') { circ(g, cx, cy, 14); g.fillStyle = '#b3ada1'; g.fill(); } break; }
      case 'tank': cyl(g, cx, cy, w * 0.46, '#6d7378', 50, { blur: B }); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; for (let k = 1; k < 4; k++) { circ(g, cx, cy, w * 0.46 * k / 4); g.stroke(); } g.fillStyle = 'rgba(130,60,25,0.4)'; ell(g, cx + 10, cy - 8, 16, 10); g.fill(); break;
      case 'pipe': { dropShadow(g, x, y, w, h, 20, false, B); g.save(); rr(g, x, y, w, h, Math.min(w, h) / 2); g.fillStyle = vert ? lin(g, x, 0, x + w, 0, [[0, '#8a9088'], [0.4, '#6a7068'], [1, '#3a3f38']]) : lin(g, 0, y, 0, y + h, [[0, '#8a9088'], [0.4, '#6a7068'], [1, '#3a3f38']]); g.fill(); g.fillStyle = '#4a4f48'; if (vert) for (let yy = y + 24; yy < y + h - 10; yy += 70) g.fillRect(x - 3, yy, w + 6, 9); else for (let xx = x + 24; xx < x + w - 10; xx += 70) g.fillRect(xx, y - 3, 9, h + 6); g.fillStyle = 'rgba(120,60,25,0.35)'; ell(g, x + w * 0.6, y + h * 0.6, 14, 6); g.fill(); g.restore(); break; }
      case 'grate': rr(g, x, y, w, h, 3); g.fillStyle = '#1e2220'; g.fill(); g.strokeStyle = '#555c56'; g.lineWidth = 3; g.beginPath(); if (w > h) for (let xx = x + 8; xx < x + w; xx += 10) { g.moveTo(xx, y + 3); g.lineTo(xx, y + h - 3); } else for (let yy = y + 8; yy < y + h; yy += 10) { g.moveTo(x + 3, yy); g.lineTo(x + w - 3, yy); } g.stroke(); g.fillStyle = 'rgba(150,255,90,0.12)'; g.fillRect(x + 4, y + 4, w - 8, h - 8); break;
      case 'booth': { box3(g, x, y + h * 0.35, w, h * 0.65, '#c9bfa8', 20, { blur: B, ht: 40 }); g.save(); rr(g, x - 6, y - 4, w + 12, h * 0.5, 8); g.clip(); for (let xx = x - 6, i = 0; xx < x + w + 6; xx += 18, i++) { g.fillStyle = i % 2 ? '#9a2e34' : '#ddd2bd'; g.fillRect(xx, y - 4, 18, h * 0.5); } g.fillStyle = lin(g, 0, y - 4, 0, y + h * 0.46, [[0, 'rgba(255,255,255,0.12)'], [1, 'rgba(0,0,0,0.35)']]); g.fillRect(x - 6, y - 4, w + 12, h * 0.5); g.restore(); break; }
      case 'balloons': { g.fillStyle = '#444'; g.fillRect(cx - 5, cy + 4, 10, 10); const cols = ['#a83a32', '#c9a43a', '#2f6a9a', '#4a8a3a', '#a84a7a']; for (let k = 0; k < 5; k++) { const bx = cx + (r() - 0.5) * 36, by = cy - 12 + (r() - 0.5) * 26; g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy + 6); g.lineTo(bx, by); g.stroke(); g.fillStyle = SH; ell(g, bx + 14, by + 22, 8, 6); g.fill(); circ(g, bx, by, 9); g.fillStyle = rad(g, bx - 3, by - 3, 1, 10, [[0, shade(cols[k], 0.4)], [1, cols[k]]]); g.fill(); } break; }
      case 'rope': for (let k = 4; k > 0; k--) { circ(g, cx, cy, k * w * 0.1); g.strokeStyle = k % 2 ? '#9a7a4a' : '#7a5e36'; g.lineWidth = 7; g.stroke(); } break;
      case 'lamp': { g.fillStyle = SH; g.save(); g.translate(cx, cy); g.rotate(0.6); g.fillRect(0, -2, 70, 4); g.restore(); circ(g, cx, cy, 6); g.fillStyle = '#3a3f44'; g.fill(); g.strokeStyle = '#4a4f54'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, cy - 30); g.stroke(); rr(g, cx - 10, cy - 36, 20, 10, 3); g.fillStyle = '#5a5f64'; g.fill(); g.fillStyle = 'rgba(255,230,170,0.7)'; g.fillRect(cx - 7, cy - 28, 14, 3); break; }
      case 'hydrant': g.fillStyle = SH; ell(g, cx + 6, cy + 6, 10, 7); g.fill(); circ(g, cx, cy, 9); g.fillStyle = rad(g, cx - 3, cy - 3, 1, 10, [[0, '#d65a4a'], [1, '#7a221a']]); g.fill(); circ(g, cx, cy, 4); g.fillStyle = '#5a1a14'; g.fill(); break;
      case 'wall': { const back = o.back; g.fillStyle = '#6b4a3a'; g.fillRect(x, y, w, h); if (B) { grain(g, x, y, w, h, 0.4); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; g.beginPath(); for (let yy = y; yy < y + h; yy += 12) { g.moveTo(x, yy); g.lineTo(x + w, yy); for (let xx = x + ((yy / 12) % 2) * 14; xx < x + w; xx += 28) { g.moveTo(xx, yy); g.lineTo(xx, yy + 12); } } g.stroke(); } if (!back) { g.fillStyle = '#4a3328'; g.fillRect(x, y + h - 14, w, 14); } break; }
      case 'none': break;
      default: box3(g, x, y, w, h, '#777', 14, { blur: B });
    }
  }
  // The fence around the area: chain-link with posts; open gaps where the roads cross.
  function fence(g, area, detail) {
    const AW = W.AW, AH = W.AH, e = area.exits, SWk = W.SW;
    // the world beyond the fence fades into the dark
    for (const [x, y, w, h, gx0, gy0, gx1, gy1] of [[-M, -M, AW + 2 * M, M, 0, -M, 0, 0], [-M, AH, AW + 2 * M, M, 0, AH + M, 0, AH], [-M, 0, M, AH, -M, 0, 0, 0], [AW, 0, M, AH, AW + M, 0, AW, 0]]) { g.fillStyle = lin(g, gx0, gy0, gx1, gy1, [[0, 'rgba(6,5,4,0.75)'], [1, 'rgba(6,5,4,0.05)']]); g.fillRect(x, y, w, h); }
    // town edge: the river or the highway
    const T = area.town || {}, N = W.GRID, edgeSide = { n: area.y === 0, s: area.y === N - 1, w: area.x === 0, e: area.x === N - 1 };
    for (const side of ['n', 's', 'w', 'e']) {
      if (!edgeSide[side]) continue; const kind = T.river === side ? 'river' : T.highway === side ? 'highway' : null; if (!kind) continue;
      const box = { n: [-M, -M, AW + 2 * M, M - 20], s: [-M, AH + 20, AW + 2 * M, M - 20], w: [-M, -M, M - 20, AH + 2 * M], e: [AW + 20, -M, M - 20, AH + 2 * M] }[side];
      if (kind === 'river') { g.fillStyle = lin(g, box[0], box[1], box[0] + (side === 'w' || side === 'e' ? box[2] : 0), box[1] + (side === 'n' || side === 's' ? box[3] : 0), [[0, '#1e3640'], [1, '#2c4f5a']]); g.fillRect(...box); if (detail) { g.strokeStyle = 'rgba(200,230,240,0.12)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 40; i++) { const px = box[0] + Math.random() * box[2], py = box[1] + Math.random() * box[3]; g.moveTo(px, py); g.lineTo(px + 24, py); } g.stroke(); } }
      else { g.fillStyle = '#2d2f32'; g.fillRect(...box); g.strokeStyle = 'rgba(220,216,200,0.45)'; g.lineWidth = 3; g.setLineDash([28, 24]); g.beginPath(); const horiz = side === 'n' || side === 's'; for (let k = 1; k < 3; k++) { if (horiz) { const yy = box[1] + (box[3] * k) / 3; g.moveTo(box[0], yy); g.lineTo(box[0] + box[2], yy); } else { const xx = box[0] + (box[2] * k) / 3; g.moveTo(xx, box[1]); g.lineTo(xx, box[1] + box[3]); } } g.stroke(); g.setLineDash([]); g.fillStyle = '#8a8f94'; if (horiz) g.fillRect(box[0], side === 'n' ? box[1] + box[3] - 6 : box[1], box[2], 6); else g.fillRect(side === 'w' ? box[0] + box[2] - 6 : box[0], box[1], 6, box[3]); }
    }
    const seg = (x1, y1, x2, y2) => {
      const len = Math.hypot(x2 - x1, y2 - y1); if (len < 4) return;
      g.strokeStyle = 'rgba(8,6,4,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x1 + 6, y1 + 5); g.lineTo(x2 + 6, y2 + 5); g.stroke();
      if (detail) { g.strokeStyle = 'rgba(190,198,206,0.32)'; g.lineWidth = 1.2; g.beginPath(); const n = Math.floor(len / 10); for (let i = 0; i < n; i++) { const k = i / n, px = x1 + (x2 - x1) * k, py = y1 + (y2 - y1) * k; if (x1 === x2) { g.moveTo(px - 5, py); g.lineTo(px + 5, py + 10); g.moveTo(px + 5, py); g.lineTo(px - 5, py + 10); } else { g.moveTo(px, py - 5); g.lineTo(px + 10, py + 5); g.moveTo(px, py + 5); g.lineTo(px + 10, py - 5); } } g.stroke(); }
      g.strokeStyle = '#7d858c'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.fillStyle = '#5a6168'; for (let i = 0; i <= Math.floor(len / 110); i++) { const k = Math.min(1, (i * 110) / len); circ(g, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 4); g.fill(); }
    };
    const run = (fixed, horiz, gap) => { const L = horiz ? AW : AH; if (!gap) { horiz ? seg(0, fixed, L, fixed) : seg(fixed, 0, fixed, L); return; } const a = gap.p - gap.w / 2 - SWk, b = gap.p + gap.w / 2 + SWk; if (horiz) { seg(0, fixed, a, fixed); seg(b, fixed, L, fixed); } else { seg(fixed, 0, fixed, a); seg(fixed, b, fixed, L); } };
    run(0, true, e.n); run(AH, true, e.s); run(0, false, e.w); run(AW, false, e.e);
  }
  function drawGarageShell(g, area, detail) {
    const G = area.garage; if (!G) return;
    // the house around the garage (seen with its roof cut away over the garage)
    const hx = G.x - 40, hw = G.w + 80;
    g.fillStyle = '#3a3633'; g.fillRect(G.door.x, G.y, G.door.w, G.h); if (detail) grain(g, G.door.x, G.y, G.door.w, G.h, 0.5);
    g.fillStyle = 'rgba(10,8,6,0.45)'; ell(g, G.door.x + G.door.w * 0.6, G.y + G.h * 0.55, 46, 26); g.fill(); // oil stain
    g.fillStyle = '#5a3c22'; g.fillRect(G.door.x + 14, G.y + 22, 110, 38); g.fillStyle = '#7a8086'; g.fillRect(G.door.x + 20, G.y + 26, 20, 10); g.fillRect(G.door.x + 60, G.y + 28, 30, 6); // workbench + tools
    g.fillStyle = '#6a6e72'; g.fillRect(G.door.x + G.door.w - 64, G.y + 24, 50, 120); g.fillStyle = '#a83a32'; g.fillRect(G.door.x + G.door.w - 58, G.y + 40, 16, 22); g.fillStyle = '#2f5a85'; g.fillRect(G.door.x + G.door.w - 40, G.y + 80, 18, 24); // shelf + cans
    g.fillStyle = rad(g, G.door.x + G.door.w / 2, G.y + 40, 10, 200, [[0, 'rgba(255,240,200,0.10)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(G.door.x, G.y, G.door.w, G.h);
    // the driveway
    g.fillStyle = '#7d7a73'; g.fillRect(G.door.x - 10, G.y + G.h, G.door.w + 20, 150); if (detail) { grain(g, G.door.x - 10, G.y + G.h, G.door.w + 20, 150, 0.5); g.fillStyle = 'rgba(10,8,6,0.3)'; ell(g, G.door.x + G.door.w / 2, G.y + G.h + 60, 40, 18); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(G.door.x - 10, G.y + G.h + 75); g.lineTo(G.door.x + G.door.w + 10, G.y + G.h + 75); g.stroke();
    void hx; void hw;
  }
  function drawSpot(g, area, detail) {
    const S = area.spot; if (!S) return;
    g.fillStyle = 'rgba(120,116,106,0.5)'; g.fillRect(S.x - 16, S.y, S.w + 32, S.h + 70); if (detail) grain(g, S.x - 16, S.y, S.w + 32, S.h + 70, 0.4);
  }
  function drawArea(g, area, detail = 1) {
    const r = rnd(W.hash(area.seed, 'floor', area.x, area.y));
    lotGround(g, area, detail, r);
    roads(g, area, detail, r);
    if (detail) decals(g, area);
    drawSpot(g, area, detail);
    drawGarageShell(g, area, detail);
    for (const o of area.obstacles.slice().sort((a, b) => a.y + a.h - (b.y + b.h))) prop(g, o, detail);
    fence(g, area, detail);
  }
  // The pre-rendered area (world units 1:1 at scale 1, plus the margin M on every side).
  function areaCanvas(area, scale = 1) {
    const c = document.createElement('canvas'); c.width = Math.round((W.AW + 2 * M) * scale); c.height = Math.round((W.AH + 2 * M) * scale);
    const g = c.getContext('2d'); g.scale(scale, scale); g.translate(M, M); drawArea(g, area, 1);
    return { canvas: c, margin: M, scale };
  }
  // Street lamps and lit windows: the light sources at night (world coordinates).
  function lights(area) {
    if (area._lights) return area._lights;
    const L = [];
    for (const o of area.obstacles) if (o.kind === 'lamp') L.push({ x: o.x + o.w / 2, y: o.y + o.h / 2 + 20, r: 260, c: 'rgba(255,214,150,' }); else if (o.kind === 'pump') L.push({ x: o.x + o.w / 2, y: o.y + o.h, r: 160, c: 'rgba(255,240,220,' });
    for (const q of area.roads) if (!q.bend && L.length < 6) { const vert = q.dir === 'n' || q.dir === 's'; L.push({ x: vert ? q.x - 10 : q.x + q.w * 0.5, y: vert ? q.y + q.h * 0.5 : q.y - 10, r: 230, c: 'rgba(255,200,130,' }); }
    if (area.garage) L.push({ x: area.garage.x + area.garage.w / 2, y: area.garage.y + area.garage.h + 30, r: 220, c: 'rgba(255,230,180,' });
    area._lights = L; return L;
  }
  // The roll-up door, seen from the street: a slatted face standing on the garage's front line.
  // open 0 (shut) .. 1 (rolled up into the lintel); it rattles while it lifts.
  const DOOR_H = 190;
  function drawGarage(g, area, open, t) {
    const G = area.garage; if (!G) return;
    const dw = G.door.w, dx = G.door.x, front = G.y + G.h, top = front - DOOR_H, shake = open > 0.01 && open < 0.99 ? Math.sin(t * 60) * 3 : 0;
    const bottom = front - DOOR_H * Math.min(1, Math.max(0, open));
    if (bottom - top > 2) {
      g.save(); g.translate(shake, 0);
      g.fillStyle = lin(g, 0, top, 0, bottom, [[0, '#8d9298'], [1, '#c4c7cb']]); g.fillRect(dx, top, dw, bottom - top);
      g.strokeStyle = 'rgba(40,44,48,0.55)'; g.lineWidth = 2; g.beginPath(); for (let y = bottom - 6; y > top; y -= 24) { g.moveTo(dx, y); g.lineTo(dx + dw, y); } g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1; g.beginPath(); for (let y = bottom - 4; y > top; y -= 24) { g.moveTo(dx, y); g.lineTo(dx + dw, y); } g.stroke();
      g.fillStyle = 'rgba(90,60,30,0.35)'; ell(g, dx + dw * 0.3, bottom - 20, 30, 10); g.fill();
      g.fillStyle = '#3e4348'; g.fillRect(dx + dw / 2 - 30, bottom - 20, 60, 7);
      if (open < 0.99) { g.fillStyle = 'rgba(255,233,168,0.8)'; g.fillRect(dx + 4, bottom - 3, dw - 8, 3); }
      g.restore();
    }
    g.fillStyle = '#4a3a30'; g.fillRect(dx - 14, top - 24, dw + 28, 26); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(dx - 14, top - 2, dw + 28, 4);
    g.fillStyle = '#d9c08a'; g.font = 'bold 20px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('No.' + (10 + ((area.x * 7 + area.y * 3) % 89)), dx + dw / 2, top - 11);
  }

  // ---------------- zombies (cached sprites, side view, feet at 0,0) ----------------
  // v: a variant (clothes and skin), so a crowd doesn't look like clones.
  const SKINS = ['#9aa88a', '#a7b096', '#8f9c7a', '#b3b09a', '#8aa080'], CLOTH = ['#4a5a6a', '#6a3a32', '#3d4a3a', '#5a4a6a', '#6b6252', '#2f3a4a', '#7a6a4a'], PANTS = ['#2f3440', '#3a3228', '#2a2a2a', '#45403a'];
  function drawZombie(g, type, f, flash, v = 0) {
    const Z = W.ZOMBIES[type] || W.ZOMBIES.walker, R = Z.r, sw = Math.sin(f * TAU / 4), sw2 = Math.cos(f * TAU / 4);
    const skin = type === 'spitter' ? '#a3b56a' : SKINS[v % SKINS.length], cloth = type === 'runner' ? ['#3a3f46', '#5a2a2a', '#2a3a2a'][v % 3] : CLOTH[(v * 3 + (type.length)) % CLOTH.length], pants = PANTS[v % PANTS.length];
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.fillStyle = 'rgba(0,0,0,0.38)'; ell(g, 4, 1, R * 0.95, R * 0.3); g.fill();
    if (type === 'boss') { drawBrute(g, R, sw, flash); return; }
    const lean = type === 'runner' ? 0.32 : type === 'spitter' ? 0.18 : type === 'crawler' ? 1.2 : 0.1, fat = type === 'bloater' ? 1.55 : type === 'brute' ? 1.35 : 1, h = R * 2.5;
    const skinG = (x0, y0, x1, y1) => lin(g, x0, y0, x1, y1, [[0, shade(skin, 0.15)], [1, shade(skin, -0.35)]]);
    g.save(); g.rotate(lean * 0.55 + sw * 0.04);
    // back leg, back arm (darker), body, front leg, front arm, head
    const leg = (s, dark) => { const lx = s * 4, fx = s * 4 + sw * s * 9, fy = -2; g.strokeStyle = dark ? shade(pants, -0.35) : pants; g.lineWidth = R * 0.36; g.beginPath(); g.moveTo(lx, -h * 0.4); g.quadraticCurveTo(lx + sw * s * 4, -h * 0.2, fx, fy - R * 0.1); g.stroke(); g.fillStyle = dark ? '#1a1612' : '#26201a'; ell(g, fx + 4, fy - 2, R * 0.28, R * 0.13); g.fill(); };
    leg(-1, true);
    const arm = (s, dark) => { const ay = -h * 0.66 + s * 4, reach = R * (type === 'runner' ? 1.0 : 1.25); g.strokeStyle = dark ? shade(cloth, -0.4) : shade(cloth, -0.1); g.lineWidth = R * 0.3; g.beginPath(); g.moveTo(R * 0.05, ay); g.lineTo(R * 0.55, ay + 2 + sw2 * s * 3); g.stroke(); g.strokeStyle = dark ? shade(skin, -0.4) : skin; g.lineWidth = R * 0.24; g.beginPath(); g.moveTo(R * 0.55, ay + 2 + sw2 * s * 3); g.lineTo(reach, ay - 3 + sw * s * 5); g.stroke(); g.fillStyle = dark ? shade(skin, -0.45) : shade(skin, -0.1); circ(g, reach + 2, ay - 3 + sw * s * 5, R * 0.13); g.fill(); };
    arm(-1, true);
    // torso
    g.save(); g.translate(0, -h * 0.58);
    if (type === 'bloater') { ell(g, 0, 2, R * 0.95, R * 1.0); g.fillStyle = rad(g, -R * 0.35, -R * 0.35, 2, R * 1.2, [[0, shade(skin, 0.1)], [0.7, shade(skin, -0.15)], [1, shade(skin, -0.5)]]); g.fill(); g.strokeStyle = 'rgba(90,40,60,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-R * 0.4, -R * 0.2); g.quadraticCurveTo(-R * 0.1, R * 0.1, -R * 0.3, R * 0.5); g.moveTo(R * 0.3, -R * 0.4); g.quadraticCurveTo(R * 0.5, 0, R * 0.2, R * 0.3); g.stroke(); g.fillStyle = 'rgba(200,220,90,0.55)'; for (const [px, py, s] of [[-8, -6, 5], [10, 6, 6], [-2, 14, 4]]) { circ(g, px, py, s); g.fill(); } g.fillStyle = cloth; g.fillRect(-R * 0.95, R * 0.45, R * 1.9, R * 0.5); }
    else {
      const tw = R * 0.62 * fat, th = R * 1.05;
      rr(g, -tw, -th * 0.6, tw * 2, th * 1.2, R * 0.3); g.fillStyle = lin(g, -tw, 0, tw, 0, [[0, shade(cloth, 0.12)], [1, shade(cloth, -0.4)]]); g.fill();
      // torn hem, stains, a ripped sleeve hole
      g.fillStyle = shade(cloth, -0.5); g.beginPath(); g.moveTo(-tw, th * 0.5); for (let i = 0; i <= 5; i++) g.lineTo(-tw + (i * tw * 2) / 5, th * 0.6 + (i % 2 ? 5 : -1)); g.lineTo(tw, th * 0.5); g.closePath(); g.fill();
      g.fillStyle = 'rgba(90,15,10,0.55)'; ell(g, tw * 0.3, -th * 0.1, R * 0.22, R * 0.3, 0.4); g.fill(); ell(g, -tw * 0.4, th * 0.3, R * 0.12, R * 0.08); g.fill();
      if (v % 3 === 1) { g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(-tw, i * th * 0.2); g.lineTo(tw, i * th * 0.2); g.moveTo(i * tw * 0.4, -th * 0.6); g.lineTo(i * tw * 0.4, th * 0.6); } g.stroke(); } // plaid
      if (v % 3 === 2 && type === 'walker') { g.fillStyle = '#6a1a1a'; g.beginPath(); g.moveTo(tw * 0.25, -th * 0.55); g.lineTo(tw * 0.42, -th * 0.55); g.lineTo(tw * 0.38, th * 0.2); g.lineTo(tw * 0.3, th * 0.25); g.closePath(); g.fill(); } // a tie
      g.fillStyle = skin; ell(g, tw * 0.6, -th * 0.15, R * 0.12, R * 0.18); g.fill(); // skin through a rip
    }
    g.restore();
    leg(1, false);
    arm(1, false);
    // head
    const hy = type === 'bloater' ? -h * 0.98 : -h * 0.93, hx = R * 0.18;
    if (type === 'canhead') {
      rr(g, hx - R * 0.55, hy - R * 0.62, R * 1.1, R * 1.0, 4); g.fillStyle = lin(g, hx - R * 0.55, 0, hx + R * 0.55, 0, [[0, '#c4cad0'], [0.4, '#8f979f'], [1, '#4a5056']]); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.5; g.beginPath(); for (let i = -1; i <= 1; i++) { g.moveTo(hx + i * R * 0.3, hy - R * 0.6); g.lineTo(hx + i * R * 0.3, hy + R * 0.36); } g.stroke();
      rr(g, hx - R * 0.66, hy - R * 0.74, R * 1.32, R * 0.16, 3); g.fillStyle = '#a9b0b7'; g.fill();
      g.fillStyle = '#0c0c0c'; g.fillRect(hx + R * 0.05, hy - R * 0.2, R * 0.46, 5); g.fillStyle = flash ? '#fff' : '#ff5a3a'; circ(g, hx + R * 0.32, hy - R * 0.17, 2.2); g.fill();
      g.fillStyle = 'rgba(120,60,25,0.5)'; ell(g, hx - R * 0.2, hy + R * 0.1, 5, 3); g.fill();
    } else {
      ell(g, hx, hy, R * 0.46, R * 0.52); g.fillStyle = rad(g, hx - R * 0.15, hy - R * 0.2, 1, R * 0.6, [[0, shade(skin, 0.2)], [0.7, skin], [1, shade(skin, -0.45)]]); g.fill();
      // sunken eye, glowing pupil, jaw, a wound
      g.fillStyle = 'rgba(30,20,20,0.7)'; ell(g, hx + R * 0.24, hy - R * 0.06, R * 0.13, R * 0.1); g.fill();
      g.fillStyle = type === 'spitter' ? '#d6ff5a' : '#e8e0b0'; circ(g, hx + R * 0.27, hy - R * 0.06, 2); g.fill();
      g.fillStyle = 'rgba(40,10,10,0.8)'; g.beginPath(); g.moveTo(hx + R * 0.1, hy + R * 0.2); g.lineTo(hx + R * 0.44, hy + R * 0.18); g.lineTo(hx + R * 0.36, hy + R * 0.32); g.closePath(); g.fill();
      g.fillStyle = 'rgba(110,20,15,0.6)'; ell(g, hx - R * 0.18, hy - R * 0.22, R * 0.1, R * 0.07); g.fill();
      // hair / hood
      if (type === 'runner') { g.fillStyle = shade(cloth, -0.15); g.beginPath(); g.arc(hx - 2, hy, R * 0.58, Math.PI * 0.75, Math.PI * 1.85); g.lineTo(hx - R * 0.2, hy + R * 0.3); g.closePath(); g.fill(); }
      else { g.strokeStyle = ['#2a2218', '#4a3a2a', '#6a6050', '#1a1a1a'][v % 4]; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI * (1.05 + i * 0.12); g.moveTo(hx + Math.cos(a) * R * 0.44, hy + Math.sin(a) * R * 0.48); g.lineTo(hx + Math.cos(a) * R * 0.62 - 3, hy + Math.sin(a) * R * 0.62 + (i % 2) * 4); } g.stroke(); }
      if (type === 'spitter') { g.fillStyle = 'rgba(190,240,80,0.85)'; ell(g, hx + R * 0.38, hy + R * 0.42, 3, 6); g.fill(); g.fillStyle = 'rgba(160,200,60,0.6)'; ell(g, hx - R * 0.05, hy + R * 0.55, R * 0.3, R * 0.18); g.fill(); }
    }
    g.restore();
    if (flash) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(-R * 3, -R * 4, R * 6, R * 5); g.globalCompositeOperation = 'source-over'; }
  }
  function drawBrute(g, R, sw, flash) {
    // the Dumpster Brute: a hulking zombie wearing a dumpster like armour
    g.save(); g.translate(0, -R * 0.85 - Math.abs(sw) * 3);
    for (const s of [-1, 1]) { g.strokeStyle = s < 0 ? '#5a6a4a' : '#7a8a62'; g.lineWidth = 15; g.beginPath(); g.moveTo(s * R * 0.6, -R * 0.1); g.lineTo(s * R * 1.15, R * 0.45 + sw * s * 8); g.stroke(); g.fillStyle = '#4a5a3a'; circ(g, s * R * 1.18, R * 0.5 + sw * s * 8, 9); g.fill(); }
    rr(g, -R, -R * 0.55, R * 2, R * 1.35, 8); g.fillStyle = lin(g, -R, 0, R, 0, [[0, '#3f6e4a'], [0.5, '#2f5a3a'], [1, '#1a3522']]); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = -2; i <= 2; i++) g.fillRect(i * R * 0.35 - 3, -R * 0.4, 6, R * 1.1);
    g.fillStyle = 'rgba(130,60,25,0.5)'; ell(g, -R * 0.5, R * 0.3, 14, 8); g.fill(); ell(g, R * 0.4, -R * 0.2, 10, 6); g.fill();
    g.save(); g.translate(-R, -R * 0.55); g.rotate(-0.3 - Math.abs(sw) * 0.12); rr(g, 0, -12, R * 2.1, 14, 4); g.fillStyle = '#24452e'; g.fill(); g.restore();
    g.fillStyle = '#0d0907'; g.beginPath(); g.moveTo(-R * 0.9, -R * 0.55); g.lineTo(R * 0.95, -R * 0.55 - R * 0.7 * (0.3 + Math.abs(sw) * 0.12)); g.lineTo(R * 0.95, -R * 0.5); g.closePath(); g.fill();
    ell(g, 0, -R * 0.75, R * 0.42, R * 0.3); g.fillStyle = '#8a9a72'; g.fill(); g.fillStyle = '#ffe26a'; circ(g, -R * 0.12, -R * 0.78, 4); g.fill(); circ(g, R * 0.16, -R * 0.78, 4); g.fill();
    g.fillStyle = '#d9d2b8'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-R * 0.7 + i * R * 0.35, -R * 0.55); g.lineTo(-R * 0.6 + i * R * 0.35, -R * 0.42); g.lineTo(-R * 0.5 + i * R * 0.35, -R * 0.55); g.fill(); }
    g.fillStyle = '#151515'; circ(g, -R * 0.7, R * 0.8, 10); g.fill(); circ(g, R * 0.7, R * 0.8, 10); g.fill();
    g.restore();
    if (flash) { g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(-R * 3, -R * 4, R * 6, R * 5); g.globalCompositeOperation = 'source-over'; }
  }
  const zcache = new Map();
  function zombie(type, frame, k, flash, v = 0) {
    const key = type + frame + (flash ? 'f' : '') + (v % 5) + k.toFixed(2);
    let c = zcache.get(key); if (c) return c;
    const R = (W.ZOMBIES[type] || W.ZOMBIES.walker).r, size = R * (type === 'boss' ? 2.6 : 3.4);
    c = document.createElement('canvas'); c.width = Math.ceil(size * 2 * k); c.height = Math.ceil(size * 2.1 * k);
    const g = c.getContext('2d'); g.scale(k, k); g.translate(size, size * 1.6); drawZombie(g, type, frame, flash, v);
    c.ox = size; c.oy = size * 1.6; c.k = k;
    if (zcache.size > 500) zcache.clear();
    zcache.set(key, c); return c;
  }

  // ---------------- pickups ----------------
  function drawPickup(g, x, y, id, t, alpha = 1) {
    const P = W.PK[id] || W.PICKUPS[0], bob = Math.sin(t * 4 + x) * 4;
    g.save(); g.globalAlpha = alpha; g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.35)'; ell(g, 4, 18, 18, 6); g.fill();
    g.translate(0, bob);
    const gr = rad(g, 0, 0, 4, 44, [[0, P.color], [1, 'rgba(0,0,0,0)']]);
    g.globalAlpha = alpha * (0.45 + 0.25 * Math.sin(t * 6)); g.fillStyle = gr; circ(g, 0, 0, 44); g.fill(); g.globalAlpha = alpha;
    circ(g, 0, 0, 21); g.fillStyle = rad(g, -6, -6, 2, 24, [[0, '#3a3530'], [1, '#14110e']]); g.fill(); g.lineWidth = 3; g.strokeStyle = P.color; g.stroke();
    g.font = '22px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(P.icon, 0, 1);
    g.restore();
  }
  // ---------------- the hero: your own character, pre-rendered ----------------
  // frames: 'idle', 'w0'..'w7' (walking), 'hurt', 'dead'; each facing right (flip for left).
  const hcache = new Map();
  function heroFrames(who, k) {
    const id = (who && who.id) || 'anon';
    let sig = ''; try { const L = window.BOX && BOX.lookOf ? BOX.lookOf({ id, name: who.name, bot: true }) : null; sig = L ? JSON.stringify(L) : ''; } catch (e) { sig = ''; }
    const key = id + ':' + k.toFixed(2) + ':' + sig;
    if (hcache.has(key)) return hcache.get(key);
    const make = (o) => {
      const c = document.createElement('canvas'), sc = 1.15; c.width = Math.ceil(110 * k); c.height = Math.ceil(120 * k);
      const g = c.getContext('2d'); g.scale(k, k);
      let ok = false;
      try { ok = !!(window.BOX && BOX.drawChar && BOX.drawChar(g, 55, 104, { id, name: who.name, avatar: who.avatar, color: who.color, bot: true }, { scale: sc, t: 0, facing: 0.75, noShadow: true, game: 'trash', ...o })); } catch (e) { ok = false; }
      if (!ok) { g.fillStyle = who.color || '#ffd23f'; circ(g, 55, 60, 26); g.fill(); g.font = '40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(who.avatar || '🙂', 55, 60); }
      // grade the character into the scene: a touch darker and cooler, light from the top-left
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = lin(g, 20, 20, 100, 110, [[0, 'rgba(255,240,210,0.06)'], [0.55, 'rgba(0,0,0,0)'], [1, 'rgba(10,12,20,0.32)']]); g.fillRect(0, 0, 110, 120); g.globalCompositeOperation = 'source-over';
      c.ox = 55; c.oy = 104; return c;
    };
    const F = { idle: make({ walking: false, t: 0.3 }), hurt: make({ scared: true, t: 0.3 }), dead: make({ dead: true, t: 0.3, lean: 1.2 }) };
    for (let i = 0; i < 8; i++) F['w' + i] = make({ walking: true, t: (i / 8) * (TAU / 11) });
    if (hcache.size > 24) hcache.clear();
    hcache.set(key, F); return F;
  }
  // The gun every hero carries: a taped-together pipe blaster (or the buzzsaw minigun).
  function drawGun(g, x, y, ang, kick, mini) {
    g.save(); g.translate(x, y); g.rotate(ang); if (Math.abs(ang) > Math.PI / 2) g.scale(1, -1);
    g.translate(-kick * 4, 0);
    if (mini) { rr(g, 0, -8, 44, 16, 4); g.fillStyle = lin(g, 0, -8, 0, 8, [[0, '#7a8088'], [1, '#2a2e33']]); g.fill(); for (let i = 0; i < 3; i++) { g.fillStyle = '#1c1f22'; g.fillRect(38, -7 + i * 5, 16, 3.5); } g.fillStyle = '#a8742a'; g.fillRect(8, -8, 9, 16); }
    else { rr(g, 0, -5, 36, 10, 3); g.fillStyle = lin(g, 0, -5, 0, 5, [[0, '#6f767d'], [1, '#25292d']]); g.fill(); g.fillStyle = '#9a8a5a'; g.fillRect(13, -6, 6, 12); rr(g, 2, 2, 9, 13, 2); g.fillStyle = '#3a2a1c'; g.fill(); g.fillStyle = '#16181a'; g.fillRect(33, -3, 7, 6); }
    g.restore();
  }
  // A thumbnail of an area for the TV map (cached per seed/cell).
  const tcache = new Map();
  function thumb(area, w, h) {
    const key = area.seed + ':' + area.x + ':' + area.y + ':' + (area.home ? 1 : 0) + ':' + w + 'x' + h;
    if (tcache.has(key)) return tcache.get(key);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.scale(w / W.AW, h / W.AH); drawArea(g, area, 0);
    if (area.garage) drawGarage(g, area, 0, 0);
    if (tcache.size > 200) tcache.clear();
    tcache.set(key, c); return c;
  }
  window.TZA = { M, OL, rr, shade, circ, ell, lin, rad, grain, drawArea, areaCanvas, drawGarage, zombie, drawZombie, drawPickup, heroFrames, drawGun, thumb, fillOl, lights, box3, cyl, car };
})();
