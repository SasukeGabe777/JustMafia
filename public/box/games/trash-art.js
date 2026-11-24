'use strict';
// TrashZombies art, all drawn in code: a cartoony "trash punk" look with chunky dark outlines.
//   TZA.areaCanvas(area)            the area's floor, decals, props and fence, pre-rendered once
//   TZA.drawArea(g, area, detail)   the same at any scale (TV thumbnails: detail 0)
//   TZA.zombie(type, frame, k)      a cached zombie sprite (side view, facing right) for k px/unit
//   TZA.drawPickup(g, x, y, id, t)  a glowing pickup; TZA.drawGarage(g, area, open, t) the garage
//   TZA.heroFrames(who, k)          the player's own JustGameBox character, pre-rendered frames
(function () {
  const W = window.TZW, TAU = Math.PI * 2, OL = '#1b1410';
  const M = 140; // the margin drawn around the area (outside the fence)
  const rr = (g, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255; if (f < 0) { r *= 1 + f; gg *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; gg += (255 - gg) * f; b += (255 - b) * f; } return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(gg) << 8) | Math.round(b)).toString(16).slice(1); };
  const fillOl = (g, c, w = 4) => { g.fillStyle = c; g.fill(); if (w) { g.lineWidth = w; g.strokeStyle = OL; g.lineJoin = 'round'; g.stroke(); } };
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };
  const rnd = (seed) => W.rng(seed);
  const CAR_COLORS = ['#d94a3a', '#3a7bd9', '#e0b230', '#4cae5a', '#9a5ad9', '#e8e2d4', '#2f3540'];
  const CONT_COLORS = ['#c0392b', '#2f6db5', '#2e8b57', '#e67e22'];

  // ---------------- the floor ----------------
  function floor(g, area, detail) {
    const B = area.biome, [a, b] = B.ground, AW = W.AW, AH = W.AH, r = rnd(W.hash(area.seed, 'floor', area.x, area.y));
    g.fillStyle = a; g.fillRect(0, 0, AW, AH);
    const st = B.style;
    if (st === 'street') {
      g.fillStyle = b; g.fillRect(0, 0, AW, 260); g.fillRect(0, AH - 260, AW, 260); // lawns
      g.fillStyle = '#a7a39a'; g.fillRect(0, 260, AW, 50); g.fillRect(0, AH - 310, AW, 50); // sidewalks
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; for (let x = 0; x < AW; x += 80) { g.beginPath(); g.moveTo(x, 260); g.lineTo(x, 310); g.moveTo(x, AH - 310); g.lineTo(x, AH - 260); g.stroke(); }
      g.fillStyle = '#ffd23f'; for (let x = 20; x < AW; x += 120) g.fillRect(x, AH / 2 - 5, 70, 10);
      if (detail) { g.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 60; i++) g.fillRect(r() * AW, 330 + r() * (AH - 660), 3, 3); }
    } else if (st === 'lot') {
      g.strokeStyle = 'rgba(240,240,240,0.75)'; g.lineWidth = 6;
      for (const y0 of [80, AH - 280]) for (let x = 80; x < AW; x += 160) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + 200); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.55)'; for (let x = 120; x < AW; x += 260) { g.save(); g.translate(x, AH / 2); g.beginPath(); g.moveTo(-30, -14); g.lineTo(10, -14); g.lineTo(10, -30); g.lineTo(40, 0); g.lineTo(10, 30); g.lineTo(10, 14); g.lineTo(-30, 14); g.closePath(); g.fill(); g.restore(); }
    } else if (st === 'slabs' || st === 'checker' || st === 'bricks' || st === 'planks') {
      const tw = st === 'planks' ? 160 : st === 'bricks' ? 80 : 80, th = st === 'planks' ? 40 : st === 'bricks' ? 40 : 80;
      for (let y = 0, row = 0; y < AH; y += th, row++) for (let x = -(st === 'bricks' || st === 'planks' ? (row % 2) * tw / 2 : 0); x < AW; x += tw) {
        if (st === 'checker') { if (((x / tw) + row) % 2 === 0) { g.fillStyle = b; g.fillRect(x, y, tw, th); } }
        else if (detail && r() < 0.35) { g.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.05)'; g.fillRect(x, y, tw, th); }
      }
      g.strokeStyle = st === 'checker' ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.28)'; g.lineWidth = st === 'planks' ? 3 : 2; g.beginPath();
      for (let y = 0, row = 0; y <= AH; y += th, row++) { g.moveTo(0, y); g.lineTo(AW, y); if (st !== 'checker' && st !== 'slabs' && y < AH) for (let x = -(row % 2) * tw / 2; x < AW; x += tw) { g.moveTo(x, y); g.lineTo(x, y + th); } }
      if (st === 'slabs' || st === 'checker') for (let x = 0; x <= AW; x += tw) { g.moveTo(x, 0); g.lineTo(x, AH); }
      g.stroke();
      if (st === 'bricks') { g.fillStyle = '#2c5a5a'; g.fillRect(0, AH / 2 - 60, AW, 120); g.fillStyle = 'rgba(160,255,120,0.25)'; for (let x = 0; x < AW; x += 50) g.fillRect(x + r() * 20, AH / 2 - 40 + r() * 70, 26, 4); g.fillStyle = '#556b55'; g.fillRect(0, AH / 2 - 66, AW, 8); g.fillRect(0, AH / 2 + 58, AW, 8); }
    } else if (st === 'stripes') {
      g.save(); g.globalAlpha = 0.5; g.fillStyle = b; for (let x = -AH; x < AW; x += 140) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 70, 0); g.lineTo(x + 70 + AH, AH); g.lineTo(x + AH, AH); g.closePath(); g.fill(); } g.restore();
      g.fillStyle = 'rgba(255,210,63,0.4)'; for (let i = 0; i < 40; i++) { circ(g, r() * AW, r() * AH, 4); g.fill(); }
    } else { // gravel, grass, dirt
      const n = detail ? (st === 'dirt' ? 260 : 700) : 60;
      for (let i = 0; i < n; i++) {
        const x = r() * AW, y = r() * AH, s = 2 + r() * (st === 'dirt' ? 22 : 6);
        g.fillStyle = r() < 0.5 ? b : shade(a, r() < 0.5 ? 0.06 : -0.1);
        if (st === 'grass' && detail) { g.strokeStyle = shade(b, -0.2); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y - 9); g.moveTo(x, y); g.lineTo(x + 4, y - 8); g.stroke(); }
        else { g.beginPath(); g.ellipse(x, y, s, s * 0.7, r() * 3, 0, TAU); g.fill(); }
      }
    }
  }
  function decals(g, area) {
    for (const d of area.decals) {
      g.save(); g.translate(d.x, d.y); g.rotate(d.a); g.scale(d.s, d.s);
      switch (d.k) {
        case 0: g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-26, 0); g.lineTo(-8, 4); g.lineTo(2, -6); g.lineTo(24, 2); g.moveTo(2, -6); g.lineTo(8, -18); g.stroke(); break; // crack
        case 1: g.fillStyle = 'rgba(40,60,30,0.35)'; g.beginPath(); g.ellipse(0, 0, 30, 18, 0, 0, TAU); g.fill(); break; // puddle
        case 2: g.fillStyle = '#e8e2d4'; g.fillRect(-8, -6, 16, 12); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1; g.strokeRect(-8, -6, 16, 12); break; // paper
        case 3: g.fillStyle = '#c0392b'; rr(g, -6, -9, 12, 18, 4); g.fill(); g.fillStyle = '#ddd'; g.fillRect(-6, -9, 12, 3); break; // can
        case 4: g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 9; g.beginPath(); g.moveTo(-40, 0); g.quadraticCurveTo(0, 14, 40, 4); g.stroke(); break; // skid
        default: g.fillStyle = 'rgba(120,200,60,0.25)'; circ(g, 0, 0, 12); g.fill(); circ(g, 14, 6, 7); g.fill(); break; // goo
      }
      g.restore();
    }
  }
  // ---------------- props (top-down 3/4: a top face and a darker front face) ----------------
  function block(g, x, y, w, h, top, depth = 18, r = 8) {
    rr(g, x, y + depth * 0.4, w, h, r); g.fillStyle = 'rgba(0,0,0,0.28)'; g.fill(); // shadow
    rr(g, x, y, w, h, r); fillOl(g, shade(top, -0.35));
    rr(g, x, y - depth, w, h, r); fillOl(g, top);
  }
  function prop(g, o, detail) {
    const { x, y, w, h, kind, v } = o, r = rnd(o.seed), cx = x + w / 2, cy = y + h / 2;
    switch (kind) {
      case 'car': {
        const col = CAR_COLORS[v % CAR_COLORS.length], vert = h > w;
        block(g, x, y + 10, w, h - 10, col, 22, 18);
        g.fillStyle = '#20262e'; if (vert) { rr(g, x + 12, y + h * 0.25, w - 24, h * 0.22, 6); g.fill(); rr(g, x + 12, y + h * 0.62, w - 24, h * 0.14, 6); g.fill(); } else { rr(g, x + w * 0.25, y + 4, w * 0.18, h - 30, 6); g.fill(); rr(g, x + w * 0.62, y + 4, w * 0.14, h - 30, 6); g.fill(); }
        g.fillStyle = 'rgba(160,220,255,0.35)'; if (vert) g.fillRect(x + 16, y + h * 0.27, w - 32, 6); else g.fillRect(x + w * 0.27, y + 8, 6, h - 38);
        if (detail) { g.fillStyle = '#8a4b22'; for (let i = 0; i < 3; i++) { circ(g, x + 14 + r() * (w - 28), y + r() * (h - 30), 4 + r() * 5); g.fill(); } }
        g.fillStyle = '#ffe9a8'; if (vert) { g.fillRect(x + 10, y + h - 12, 12, 6); g.fillRect(x + w - 22, y + h - 12, 12, 6); } else { g.fillRect(x + w - 10, y + h - 30, 6, 10); g.fillRect(x + 4, y + h - 30, 6, 10); }
        break;
      }
      case 'container': { const col = CONT_COLORS[v % CONT_COLORS.length]; block(g, x, y, w, h, col, 26, 4); g.strokeStyle = shade(col, -0.3); g.lineWidth = 3; g.beginPath(); if (w > h) for (let xx = x + 12; xx < x + w - 6; xx += 14) { g.moveTo(xx, y - 22); g.lineTo(xx, y + h - 30); } else for (let yy = y - 14; yy < y + h - 26; yy += 14) { g.moveTo(x + 6, yy); g.lineTo(x + w - 6, yy); } g.stroke(); break; }
      case 'tires': for (let i = 0; i < 3; i++) { circ(g, cx, cy + 8 - i * 9, w * 0.45); fillOl(g, '#26221f', 3); circ(g, cx, cy + 8 - i * 9, w * 0.2); g.fillStyle = '#4a433d'; g.fill(); } break;
      case 'trash': case 'bags': {
        const cols = kind === 'bags' ? ['#1e1e24', '#2b2b33', '#3a3340'] : ['#6b5a2a', '#4f6b2a', '#7a4a2a', '#5a5a62'];
        for (let i = 0; i < 6; i++) { const a = r() * TAU, d = r() * w * 0.25; circ(g, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7 - 6, w * (0.22 + r() * 0.12)); fillOl(g, cols[i % cols.length], 3); }
        if (detail && kind === 'trash') { g.fillStyle = '#e8e2d4'; g.fillRect(cx - 6, cy - 18, 12, 8); g.fillStyle = '#c0392b'; g.fillRect(cx + 8, cy - 6, 8, 12); }
        break;
      }
      case 'barrel': { const tox = v % 2 === 0; circ(g, cx, cy + 6, w * 0.45); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill(); circ(g, cx, cy, w * 0.45); fillOl(g, tox ? '#3f9a3a' : '#b4552a'); circ(g, cx, cy, w * 0.3); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3; g.stroke(); if (tox) { g.fillStyle = '#d6ff5a'; circ(g, cx, cy, 6); g.fill(); } break; }
      case 'fridge': block(g, x, y, w, h, '#e8e8e0', 30, 6); g.fillStyle = '#9aa'; g.fillRect(x + w - 14, y - 20, 5, 18); break;
      case 'bin': circ(g, cx, cy + 6, w * 0.42); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill(); circ(g, cx, cy, w * 0.42); fillOl(g, v % 2 ? '#3d7a4a' : '#6c7884'); circ(g, cx, cy, w * 0.16); fillOl(g, shade(v % 2 ? '#3d7a4a' : '#6c7884', -0.3), 3); break;
      case 'hedge': case 'bush': {
        const n = kind === 'hedge' ? 5 : 3;
        for (let i = 0; i < n; i++) { const px = x + (w / n) * (i + 0.5), py = cy + (kind === 'bush' ? (r() - 0.5) * 16 : 0); circ(g, px, py, Math.min(w / n, h) * 0.62); fillOl(g, i % 2 ? '#3f8a35' : '#4c9c3e', 3); }
        if (detail) { g.fillStyle = '#ff7ac6'; for (let i = 0; i < 4; i++) { circ(g, x + r() * w, y + r() * h, 3); g.fill(); } }
        break;
      }
      case 'tree': { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx + 10, cy + 12, w * 0.7, h * 0.45, 0, 0, TAU); g.fill(); for (const [dx, dy, s] of [[-14, 4, 0.5], [14, 2, 0.5], [0, -12, 0.58]]) { circ(g, cx + dx, cy + dy, w * s); fillOl(g, '#3a7f2e', 3); } circ(g, cx - 8, cy - 18, w * 0.2); g.fillStyle = '#5aa845'; g.fill(); break; }
      case 'mailbox': g.fillStyle = '#5a3a22'; g.fillRect(cx - 4, cy - 4, 8, 24); rr(g, cx - 18, cy - 22, 36, 22, 9); fillOl(g, '#2f6db5', 3); g.fillStyle = '#e8424f'; g.fillRect(cx + 10, cy - 32, 4, 14); break;
      case 'cart': { rr(g, x + 4, y - 6, w - 8, h - 6, 4); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fill(); g.strokeStyle = '#b8c2cc'; g.lineWidth = 3; g.strokeRect(x + 4, y - 14, w - 8, h - 10); g.beginPath(); for (let xx = x + 12; xx < x + w - 6; xx += 9) { g.moveTo(xx, y - 14); g.lineTo(xx, y + h - 24); } g.stroke(); g.fillStyle = '#e84a4a'; g.fillRect(x + 2, y - 18, w - 4, 6); break; }
      case 'barrier': { block(g, x, y, w, h, '#c9c3b6', 18, 6); g.fillStyle = '#e8483a'; for (let xx = x + 8; xx < x + w - 10; xx += 26) g.fillRect(xx, y - 16, 12, h - 4); break; }
      case 'pump': { block(g, x, y, w, h, '#d9483a', 34, 8); g.fillStyle = '#20262e'; rr(g, x + 10, y - 24, w - 20, 24, 4); g.fill(); g.fillStyle = '#7dff6a'; g.fillRect(x + 14, y - 20, w - 28, 6); g.strokeStyle = OL; g.lineWidth = 4; g.beginPath(); g.moveTo(x + w - 6, y + 10); g.quadraticCurveTo(x + w + 18, y + h * 0.5, x + w - 2, y + h - 30); g.stroke(); break; }
      case 'crate': { block(g, x, y, w, h, '#b07a3f', 22, 3); g.strokeStyle = '#6b4520'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 6, y - 16); g.lineTo(x + w - 6, y + h - 28); g.moveTo(x + w - 6, y - 16); g.lineTo(x + 6, y + h - 28); g.stroke(); break; }
      case 'shelf': { block(g, x, y, w, h, '#8a8f98', 28, 4); const cols = ['#ff6fb5', '#ffd23f', '#3ec1ff', '#7dff6a', '#ff8c42']; for (let i = 0; i < (w > h ? 10 : 4); i++) { g.fillStyle = cols[Math.floor(r() * 5)]; if (w > h) g.fillRect(x + 8 + i * (w - 16) / 10, y - 22, (w - 16) / 12, h - 18); else g.fillRect(x + 8, y - 22 + i * (h - 20) / 4, w - 16, (h - 20) / 6); } break; }
      case 'bench': { block(g, x, y + 8, w, h - 16, '#a8743a', 14, 4); g.strokeStyle = '#6b4520'; g.lineWidth = 3; g.beginPath(); if (w > h) for (let yy = y - 2; yy < y + h - 20; yy += 10) { g.moveTo(x + 4, yy); g.lineTo(x + w - 4, yy); } else for (let xx = x + 8; xx < x + w - 4; xx += 10) { g.moveTo(xx, y); g.lineTo(xx, y + h - 22); } g.stroke(); break; }
      case 'planter': circ(g, cx, cy + 6, w * 0.45); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill(); circ(g, cx, cy, w * 0.45); fillOl(g, '#b0673a'); for (let i = 0; i < 5; i++) { circ(g, cx + (r() - 0.5) * 24, cy - 6 + (r() - 0.5) * 18, 10); fillOl(g, '#4c9c3e', 2); } break;
      case 'fountain': circ(g, cx, cy, w * 0.48); fillOl(g, '#a7a39a'); circ(g, cx, cy, w * 0.38); g.fillStyle = '#3e8fb5'; g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; for (let i = 0; i < 6; i++) { circ(g, cx + (r() - 0.5) * w * 0.5, cy + (r() - 0.5) * h * 0.5, 4); g.fill(); } circ(g, cx, cy, 16); fillOl(g, '#c9c3b6', 3); break;
      case 'vent': { block(g, x, y, w, h, '#b8c2cc', 24, 4); circ(g, x + w * 0.3, y + h * 0.5 - 22, Math.min(w, h) * 0.3); fillOl(g, '#4c545d', 3); g.strokeStyle = '#2b3036'; g.lineWidth = 3; g.beginPath(); for (let a = 0; a < 3; a++) { const an = a * TAU / 3; g.moveTo(x + w * 0.3, y + h * 0.5 - 22); g.lineTo(x + w * 0.3 + Math.cos(an) * 16, y + h * 0.5 - 22 + Math.sin(an) * 16); } g.stroke(); break; }
      case 'tank': circ(g, cx + 8, cy + 10, w * 0.46); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill(); circ(g, cx, cy, w * 0.46); fillOl(g, '#7a5a3a'); g.strokeStyle = '#4a3520'; g.lineWidth = 3; for (let i = 1; i < 4; i++) { circ(g, cx, cy, w * 0.46 * i / 4); g.stroke(); } break;
      case 'dish': circ(g, cx, cy, w * 0.4); fillOl(g, '#e8e8e0', 3); g.strokeStyle = '#777'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 12, cy - 14); g.stroke(); circ(g, cx + 12, cy - 14, 4); g.fillStyle = '#333'; g.fill(); break;
      case 'pipe': { const vert = h > w; rr(g, x, y + 10, w, h, h / 2); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fill(); rr(g, x, y, w, h, vert ? w / 2 : h / 2); fillOl(g, '#6f7f6a'); g.fillStyle = '#4a5a48'; if (vert) for (let yy = y + 20; yy < y + h - 10; yy += 60) g.fillRect(x - 4, yy, w + 8, 10); else for (let xx = x + 20; xx < x + w - 10; xx += 60) g.fillRect(xx, y - 4, 10, h + 8); g.fillStyle = 'rgba(255,255,255,0.18)'; if (vert) g.fillRect(x + 8, y + 6, 6, h - 12); else g.fillRect(x + 6, y + 8, w - 12, 6); break; }
      case 'grate': rr(g, x, y, w, h, 4); fillOl(g, '#2b302c'); g.strokeStyle = '#596359'; g.lineWidth = 4; g.beginPath(); if (w > h) for (let xx = x + 10; xx < x + w; xx += 14) { g.moveTo(xx, y + 4); g.lineTo(xx, y + h - 4); } else for (let yy = y + 10; yy < y + h; yy += 14) { g.moveTo(x + 4, yy); g.lineTo(x + w - 4, yy); } g.stroke(); g.fillStyle = 'rgba(156,255,90,0.25)'; g.fillRect(x + 6, y + 6, w - 12, h - 12); break;
      case 'booth': { block(g, x, y + h * 0.3, w, h * 0.7, '#e8e2d4', 20, 4); g.save(); rr(g, x - 6, y - 10, w + 12, h * 0.55, 10); g.clip(); for (let xx = x - 6, i = 0; xx < x + w + 6; xx += 22, i++) { g.fillStyle = i % 2 ? '#e8424f' : '#fff3e0'; g.fillRect(xx, y - 10, 22, h * 0.55); } g.restore(); rr(g, x - 6, y - 10, w + 12, h * 0.55, 10); g.lineWidth = 4; g.strokeStyle = OL; g.stroke(); break; }
      case 'balloons': { g.fillStyle = '#555'; g.fillRect(cx - 6, cy + 4, 12, 12); const cols = ['#ff5a5f', '#ffd23f', '#3ec1ff', '#7dff6a', '#ff7ac6']; for (let i = 0; i < 5; i++) { const bx = cx + (r() - 0.5) * 40, by = cy - 14 + (r() - 0.5) * 30; g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy + 6); g.lineTo(bx, by); g.stroke(); circ(g, bx, by, 10); fillOl(g, cols[i], 2); } break; }
      case 'desk': block(g, x, y, w, h, '#c99a5a', 16, 4); g.fillStyle = '#8a9aa6'; g.fillRect(x + 6, y - 12, 8, 8); g.fillRect(x + w - 14, y - 12, 8, 8); g.fillStyle = '#fff'; g.fillRect(cx - 10, y - 8, 20, 12); break;
      case 'locker': { block(g, x, y, w, h, '#3e7fb5', 34, 3); g.strokeStyle = '#2a5a82'; g.lineWidth = 3; g.beginPath(); if (w > h) for (let xx = x + w / 6; xx < x + w - 4; xx += w / 6) { g.moveTo(xx, y - 30); g.lineTo(xx, y + h - 36); } else for (let yy = y - 30 + h / 6; yy < y + h - 36; yy += h / 6) { g.moveTo(x + 4, yy); g.lineTo(x + w - 4, yy); } g.stroke(); break; }
      case 'rope': for (let i = 4; i > 0; i--) { circ(g, cx, cy, i * w * 0.11); g.strokeStyle = i % 2 ? '#c9a26a' : '#a5824e'; g.lineWidth = 8; g.stroke(); } break;
      case 'wall': { rr(g, x, y, w, h, 0); fillOl(g, '#8a4a3a', 0); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); for (let yy = y; yy < y + h; yy += 20) { g.moveTo(x, yy); g.lineTo(x + w, yy); } g.stroke(); g.fillStyle = '#5a2f24'; g.fillRect(x, y + h - 14, w, 14); break; }
      default: block(g, x, y, w, h, '#888', 16, 6);
    }
  }
  // The fence around the area (gaps for exits are drawn by the game, they open and close).
  function fence(g, area) {
    const AW = W.AW, AH = W.AH, B = area.biome, e = area.exits, gapA = AW / 2 - 90, gapB = AW / 2 + 90, gA = AH / 2 - 90, gB = AH / 2 + 90;
    g.fillStyle = shade(B.edge, -0.25);
    g.fillRect(-M, -M, AW + 2 * M, M); g.fillRect(-M, AH, AW + 2 * M, M); g.fillRect(-M, 0, M, AH); g.fillRect(AW, 0, M, AH);
    // junk silhouettes outside
    const r = rnd(W.hash(area.seed, 'out', area.x, area.y));
    for (let i = 0; i < 26; i++) {
      const side = i % 4, t = r(); let x, y;
      if (side === 0) { x = t * AW; y = -40 - r() * 80; } else if (side === 1) { x = t * AW; y = AH + 40 + r() * 80; } else if (side === 2) { x = -40 - r() * 80; y = t * AH; } else { x = AW + 40 + r() * 80; y = t * AH; }
      if ((side < 2 && Math.abs(x - AW / 2) < 120) || (side >= 2 && Math.abs(y - AH / 2) < 120)) continue;
      g.fillStyle = shade(B.edge, -0.45 + r() * 0.15); rr(g, x - 30, y - 22, 40 + r() * 50, 30 + r() * 30, 8); g.fill();
    }
    // chain-link fence: posts + mesh
    const seg = (x1, y1, x2, y2) => {
      g.strokeStyle = 'rgba(200,210,220,0.35)'; g.lineWidth = 2; g.beginPath();
      const len = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(len / 14);
      for (let i = 0; i < n; i++) { const k = i / n; const px = x1 + (x2 - x1) * k, py = y1 + (y2 - y1) * k; if (x1 === x2) { g.moveTo(px - 8, py); g.lineTo(px + 8, py + 14); } else { g.moveTo(px, py - 8); g.lineTo(px + 14, py + 8); } }
      g.stroke();
      g.strokeStyle = '#6f7a85'; g.lineWidth = 5; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      g.fillStyle = '#4a525a'; for (let i = 0; i <= Math.floor(len / 120); i++) { const k = Math.min(1, (i * 120) / len); circ(g, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k, 7); g.fill(); }
    };
    seg(0, 0, e.n ? gapA : AW, 0); if (e.n) seg(gapB, 0, AW, 0);
    seg(0, AH, e.s ? gapA : AW, AH); if (e.s) seg(gapB, AH, AW, AH);
    seg(0, 0, 0, e.w ? gA : AH); if (e.w) seg(0, gB, 0, AH);
    seg(AW, 0, AW, e.e ? gA : AH); if (e.e) seg(AW, gB, AW, AH);
  }
  function drawGarageShell(g, area) {
    const G = area.garage; if (!G) return;
    // the garage floor (inside) and the roof edge
    g.fillStyle = '#3a3a3e'; g.fillRect(G.door.x, 0, G.door.w, G.h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(G.door.x + 20, 30, 60, 90); // a workbench shadow
    g.fillStyle = '#6b4520'; g.fillRect(G.door.x + 14, 20, 90, 40); g.fillStyle = '#9aa'; g.fillRect(G.door.x + G.door.w - 70, 30, 40, 70); // bench + shelf
    g.fillStyle = '#4a4a50'; g.fillRect(G.x - 10, G.h - 10, G.w + 20, 18); // roof edge / driveway lip
    g.fillStyle = '#8a8a86'; g.fillRect(G.door.x, G.h, G.door.w, 120); // driveway
    g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 2; g.strokeRect(G.door.x, G.h, G.door.w, 120);
  }
  function drawArea(g, area, detail = 1) {
    floor(g, area, detail);
    if (detail) decals(g, area);
    drawGarageShell(g, area);
    for (const o of area.obstacles.slice().sort((a, b) => a.y + a.h - (b.y + b.h))) prop(g, o, detail);
    fence(g, area);
  }
  // The pre-rendered area (world units 1:1, plus the margin M on every side).
  function areaCanvas(area, scale = 1) {
    const c = document.createElement('canvas'); c.width = Math.round((W.AW + 2 * M) * scale); c.height = Math.round((W.AH + 2 * M) * scale);
    const g = c.getContext('2d'); g.scale(scale, scale); g.translate(M, M); drawArea(g, area, 1);
    return { canvas: c, margin: M, scale };
  }
  // The roll-up door: open 0 (shut) .. 1 (up); it rattles while it lifts.
  function drawGarage(g, area, open, t) {
    const G = area.garage; if (!G) return;
    const dw = G.door.w, dx = G.door.x, dh = G.h, shake = open > 0 && open < 1 ? Math.sin(t * 60) * 3 : 0;
    const shown = dh * (1 - open);
    if (shown > 2) {
      g.save(); g.translate(shake, 0);
      g.fillStyle = '#c9ccd1'; g.fillRect(dx, 0, dw, shown);
      g.strokeStyle = '#8a8f98'; g.lineWidth = 4; g.beginPath(); for (let y = shown - 4; y > 0; y -= 22) { g.moveTo(dx, y); g.lineTo(dx + dw, y); } g.stroke();
      g.fillStyle = '#5a5f66'; g.fillRect(dx + dw / 2 - 30, shown - 18, 60, 8); // handle
      g.strokeStyle = OL; g.lineWidth = 4; g.strokeRect(dx, 0, dw, shown);
      g.restore();
    }
    // the roof over the garage (so we look "into" it from the street)
    g.fillStyle = '#3b2f2a'; g.fillRect(G.x, -16, G.w, 22);
    g.fillStyle = '#ffd23f'; g.font = 'bold 26px "Lilita One", sans-serif'; g.textAlign = 'center'; g.fillText('No.' + (10 + ((area.x * 7 + area.y * 3) % 89)), G.x + G.w / 2, -24);
  }

  // ---------------- zombies (cached sprites) ----------------
  const ZC = { walker: ['#7fae6a', '#6b4a8a'], runner: ['#8fbf7a', '#c0392b'], bloater: ['#9a8fbf', '#5a7a3a'], canhead: ['#79a86a', '#3d4a5a'], spitter: ['#a6d65a', '#2f6db5'], boss: ['#2e7d4a', '#244f33'] };
  function drawZombie(g, type, f, flash) {
    const [skin, cloth] = ZC[type] || ZC.walker, sw = Math.sin(f * TAU / 4), Z = W.ZOMBIES[type] || W.ZOMBIES.walker, R = Z.r;
    const S = flash ? '#ffffff' : null, c = (x) => S || x;
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 0, R * 0.95, R * 0.32, 0, 0, TAU); g.fill();
    if (type === 'boss') {
      // a dumpster with arms: the lid is the jaw
      g.save(); g.translate(0, -R * 0.9 - Math.abs(sw) * 3);
      for (const s of [-1, 1]) { g.strokeStyle = OL; g.lineWidth = 16; g.beginPath(); g.moveTo(s * R * 0.7, 0); g.lineTo(s * R * 1.15, R * 0.4 + sw * s * 8); g.stroke(); g.strokeStyle = c(skin); g.lineWidth = 10; g.stroke(); }
      rr(g, -R, -R * 0.55, R * 2, R * 1.35, 10); fillOl(g, c('#2f8a4a'), 5);
      g.fillStyle = c('#1f5a30'); for (let i = -2; i <= 2; i++) g.fillRect(i * R * 0.35 - 4, -R * 0.4, 8, R * 1.1);
      g.save(); g.translate(-R, -R * 0.55); g.rotate(-0.35 - Math.abs(sw) * 0.15); rr(g, 0, -14, R * 2.1, 16, 5); fillOl(g, c('#24603a'), 5); g.restore();
      g.fillStyle = '#1a0f0a'; g.beginPath(); g.moveTo(-R * 0.9, -R * 0.55); g.lineTo(R * 0.95, -R * 0.55 - R * 0.75 * (0.35 + Math.abs(sw) * 0.15)); g.lineTo(R * 0.95, -R * 0.5); g.closePath(); g.fill();
      g.fillStyle = flash ? '#fff' : '#ffef5a'; for (const ex of [-R * 0.35, R * 0.2]) { circ(g, ex, -R * 0.72, 7); g.fill(); }
      g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-R * 0.7 + i * R * 0.35, -R * 0.55); g.lineTo(-R * 0.6 + i * R * 0.35, -R * 0.4); g.lineTo(-R * 0.5 + i * R * 0.35, -R * 0.55); g.fill(); }
      g.fillStyle = c('#1d1d1d'); circ(g, -R * 0.7, R * 0.8, 10); g.fill(); circ(g, R * 0.7, R * 0.8, 10); g.fill();
      g.restore(); return;
    }
    const lean = type === 'runner' ? 0.28 : type === 'spitter' ? 0.2 : 0.06, fat = type === 'bloater' ? 1.5 : 1, h = R * 2.4;
    g.save(); g.rotate(lean * 0.6);
    // legs
    for (const s of [-1, 1]) { g.strokeStyle = OL; g.lineWidth = 9; g.beginPath(); g.moveTo(s * 5, -h * 0.38); g.lineTo(s * 5 + sw * s * 8, -2); g.stroke(); g.strokeStyle = c('#3a3a4a'); g.lineWidth = 5; g.stroke(); }
    // body
    g.save(); g.translate(0, -h * 0.55);
    if (type === 'bloater') { circ(g, 0, 0, R * 0.95); fillOl(g, c(skin)); g.fillStyle = c('#c8e06a'); for (const [px, py] of [[-8, -6], [10, 4], [-2, 12]]) { circ(g, px, py, 5); g.fill(); } }
    else { rr(g, -R * 0.55 * fat, -R * 0.65, R * 1.1 * fat, R * 1.25, 8); fillOl(g, c(cloth)); g.fillStyle = c(shade(cloth, -0.25)); g.fillRect(-R * 0.3, R * 0.2, R * 0.5, R * 0.18); }
    // arms reaching forward
    const ay = -R * 0.3;
    for (const s of [0, 1]) { g.strokeStyle = OL; g.lineWidth = 9; g.beginPath(); g.moveTo(R * 0.2, ay + s * 6); g.lineTo(R * 1.15, ay - 2 + s * 8 + sw * (s ? 4 : -4)); g.stroke(); g.strokeStyle = c(skin); g.lineWidth = 5; g.stroke(); }
    // head
    const hy = type === 'bloater' ? -R * 0.85 : -R * 0.95;
    if (type === 'canhead') {
      rr(g, -R * 0.6, hy - R * 0.75, R * 1.2, R * 1.05, 5); fillOl(g, c('#9aa5b1'));
      g.strokeStyle = c('#6c7884'); g.lineWidth = 3; g.beginPath(); for (let i = -1; i <= 1; i++) { g.moveTo(i * R * 0.3, hy - R * 0.7); g.lineTo(i * R * 0.3, hy + R * 0.25); } g.stroke();
      rr(g, -R * 0.72, hy - R * 0.9, R * 1.44, R * 0.2, 4); fillOl(g, c('#b7c2cc'), 3);
      g.fillStyle = '#1a1a1a'; g.fillRect(R * 0.05, hy - R * 0.25, R * 0.5, 6); g.fillStyle = flash ? '#fff' : '#ff4a3a'; circ(g, R * 0.35, hy - R * 0.22, 3); g.fill();
    } else {
      circ(g, R * 0.12, hy, R * 0.55); fillOl(g, c(skin));
      g.fillStyle = '#fff'; circ(g, R * 0.32, hy - 3, 5); g.fill(); circ(g, R * 0.02, hy - 2, 3.5); g.fill();
      g.fillStyle = '#c0392b'; circ(g, R * 0.34, hy - 3, 2); g.fill();
      g.strokeStyle = OL; g.lineWidth = 2.5; g.beginPath(); g.moveTo(R * 0.05, hy + 7); g.lineTo(R * 0.45, hy + 6); g.stroke();
      if (type === 'spitter') { g.fillStyle = '#b6ff3c'; g.beginPath(); g.ellipse(R * 0.42, hy + 10, 4, 7, 0, 0, TAU); g.fill(); }
      if (type === 'runner') { g.fillStyle = c(cloth); g.beginPath(); g.arc(R * 0.08, hy - 2, R * 0.6, Math.PI * 0.9, Math.PI * 1.9); g.fill(); g.lineWidth = 3; g.strokeStyle = OL; g.stroke(); }
      if (type === 'walker') { g.strokeStyle = '#3a4a2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(R * -0.2, hy - R * 0.45); g.lineTo(R * -0.05, hy - R * 0.62); g.moveTo(R * 0.1, hy - R * 0.5); g.lineTo(R * 0.15, hy - R * 0.7); g.stroke(); }
    }
    g.restore(); g.restore();
  }
  const zcache = new Map();
  function zombie(type, frame, k, flash) {
    const key = type + frame + (flash ? 'f' : '') + k.toFixed(2);
    let c = zcache.get(key); if (c) return c;
    const R = (W.ZOMBIES[type] || W.ZOMBIES.walker).r, size = R * (type === 'boss' ? 2.6 : 3.4);
    c = document.createElement('canvas'); c.width = Math.ceil(size * 2 * k); c.height = Math.ceil(size * 2.1 * k);
    const g = c.getContext('2d'); g.scale(k, k); g.translate(size, size * 1.6); drawZombie(g, type, frame, flash);
    c.ox = size; c.oy = size * 1.6; c.k = k;
    if (zcache.size > 200) zcache.clear();
    zcache.set(key, c); return c;
  }

  // ---------------- pickups ----------------
  function drawPickup(g, x, y, id, t, alpha = 1) {
    const P = W.PK[id] || W.PICKUPS[0], bob = Math.sin(t * 4 + x) * 4;
    g.save(); g.globalAlpha = alpha; g.translate(x, y + bob);
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, 40); gr.addColorStop(0, P.color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = alpha * (0.55 + 0.25 * Math.sin(t * 6)); g.fillStyle = gr; circ(g, 0, 0, 40); g.fill(); g.globalAlpha = alpha;
    circ(g, 0, 0, 22); g.fillStyle = 'rgba(20,16,12,0.75)'; g.fill(); g.lineWidth = 4; g.strokeStyle = P.color; g.stroke();
    g.font = '24px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(P.icon, 0, 1);
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
      c.ox = 55; c.oy = 104; return c;
    };
    const F = { idle: make({ walking: false, t: 0.3 }), hurt: make({ scared: true, t: 0.3 }), dead: make({ dead: true, t: 0.3, lean: 1.2 }) };
    for (let i = 0; i < 8; i++) F['w' + i] = make({ walking: true, t: (i / 8) * (TAU / 11) });
    if (hcache.size > 24) hcache.clear();
    hcache.set(key, F); return F;
  }
  // The gun every hero carries: a taped-together pipe blaster.
  function drawGun(g, x, y, ang, kick, mini) {
    g.save(); g.translate(x, y); g.rotate(ang); if (Math.abs(ang) > Math.PI / 2) g.scale(1, -1);
    g.translate(-kick * 4, 0);
    if (mini) { rr(g, 0, -9, 46, 18, 5); fillOl(g, '#5a5f66', 3); for (let i = 0; i < 3; i++) { g.fillStyle = '#2b2f33'; g.fillRect(40, -8 + i * 6, 16, 4); } g.fillStyle = '#ffb02e'; g.fillRect(8, -9, 10, 18); }
    else { rr(g, 0, -6, 40, 12, 4); fillOl(g, '#7a8590', 3); g.fillStyle = '#e8d8a0'; g.fillRect(14, -7, 8, 14); rr(g, 2, 2, 10, 14, 3); fillOl(g, '#5a3a22', 2); g.fillStyle = '#2b2f33'; g.fillRect(36, -4, 8, 8); }
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
    tcache.set(key, c); return c;
  }
  window.TZA = { M, OL, rr, shade, circ, drawArea, areaCanvas, drawGarage, zombie, drawZombie, drawPickup, heroFrames, drawGun, thumb, fillOl };
})();
