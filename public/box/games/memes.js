'use strict';
// Meme Maker screens. Part 1 is the MEME ART KIT (BOX.memes): 34 original cartoon templates drawn
// in code on a 600-wide canvas, each with marked caption slots, and the classic white Impact
// caption renderer (auto-fit, black outline). The TV, phones, title screen and intro all draw
// memes with BOX.memes.render / BOX.memes.url. Part 2 is the game: the corkboard lobby, the TV
// (round cards, who has posted, the meme parade, voting, winners, the gallery with PNG downloads)
// and the phone (a live preview while you type, voting, results).
(function () {
  const TAU = Math.PI * 2, INK = '#24202c';
  // ---------- drawing kit ----------
  function P(g, fill, fn, lw = 5, stroke = INK) {
    g.beginPath(); fn();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (lw) { g.lineWidth = lw; g.strokeStyle = stroke; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); }
  }
  const rrp = (g, x, y, w, h, r) => { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  const circ = (g, x, y, r, f, lw = 5) => P(g, f, () => g.arc(x, y, Math.max(0.1, r), 0, TAU), lw);
  const ell = (g, x, y, rx, ry, f, lw = 5, rot = 0) => P(g, f, () => g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU), lw);
  const rect = (g, x, y, w, h, r, f, lw = 5) => P(g, f, () => rrp(g, x, y, w, h, r), lw);
  const poly = (g, pts, f, lw = 5) => P(g, f, () => { g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); }, lw);
  const line = (g, pts, c = INK, lw = 5) => { g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); };
  const curve = (g, x1, y1, cx, cy, x2, y2, c = INK, lw = 5) => { g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo(cx, cy, x2, y2); g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.stroke(); };
  const limb = (g, x1, y1, x2, y2, c, w = 22) => { line(g, [x1, y1, x2, y2], INK, w + 9); line(g, [x1, y1, x2, y2], c, w); };
  const bend = (g, x1, y1, cx, cy, x2, y2, c, w = 22) => { curve(g, x1, y1, cx, cy, x2, y2, INK, w + 9); curve(g, x1, y1, cx, cy, x2, y2, c, w); };
  const vgrad = (g, y0, y1, a, b) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };
  const fillBg = (g, x, y, w, h, a, b) => { g.fillStyle = b ? vgrad(g, y, y + h, a, b) : a; g.fillRect(x, y, w, h); };
  const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const hash = (str) => { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
  const star = (g, x, y, r, f, lw = 0) => P(g, f, () => { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }, lw);
  const sparkle = (g, x, y, r, f = '#fff') => P(g, f, () => { g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); }, 0);
  const label = (g, t, x, y, px, c = INK, font = 'Fredoka') => { g.font = `700 ${px}px "${font}", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = c; g.fillText(t, x, y); };
  const drops = (g, pts) => { for (const [x, y, s] of pts) P(g, '#7fd3ff', () => { g.moveTo(x, y - 14 * s); g.quadraticCurveTo(x + 9 * s, y, x, y + 6 * s); g.quadraticCurveTo(x - 9 * s, y, x, y - 14 * s); }, 3); };
  const cloud = (g, x, y, s, f = '#fff', lw = 0) => P(g, f, () => { g.arc(x, y, 30 * s, Math.PI * 0.5, Math.PI * 1.5); g.arc(x + 35 * s, y - 22 * s, 32 * s, Math.PI, Math.PI * 1.85); g.arc(x + 75 * s, y - 8 * s, 26 * s, Math.PI * 1.3, Math.PI * 0.5); g.closePath(); }, lw);
  const heart = (g, x, y, s, f = '#ff4f7a') => P(g, f, () => { g.moveTo(x, y + 12 * s); g.bezierCurveTo(x - 22 * s, y - 4 * s, x - 10 * s, y - 20 * s, x, y - 8 * s); g.bezierCurveTo(x + 10 * s, y - 20 * s, x + 22 * s, y - 4 * s, x, y + 12 * s); }, 3);
  function flame(g, x, base, w, h, k = 0) {
    P(g, '#ff5a1f', () => { g.moveTo(x - w / 2, base); g.bezierCurveTo(x - w * 0.6, base - h * 0.5, x - w * 0.1 + k * 10, base - h * 0.7, x + k * 14, base - h); g.bezierCurveTo(x + w * 0.2, base - h * 0.6, x + w * 0.7, base - h * 0.45, x + w / 2, base); g.closePath(); }, 0);
    P(g, '#ffb11f', () => { g.moveTo(x - w * 0.3, base); g.bezierCurveTo(x - w * 0.35, base - h * 0.35, x, base - h * 0.5, x + k * 8, base - h * 0.68); g.bezierCurveTo(x + w * 0.15, base - h * 0.4, x + w * 0.4, base - h * 0.3, x + w * 0.3, base); g.closePath(); }, 0);
    P(g, '#fff1a8', () => { g.moveTo(x - w * 0.12, base); g.quadraticCurveTo(x - w * 0.1, base - h * 0.25, x, base - h * 0.34); g.quadraticCurveTo(x + w * 0.12, base - h * 0.2, x + w * 0.12, base); g.closePath(); }, 0);
  }
  // ---------- faces and people ----------
  function eyes(g, x, y, gap, r, kind = 'dot', look = 0, skin = '#f2c19b', up = 0) {
    for (const s of [-1, 1]) {
      const ex = x + (s * gap) / 2;
      if (kind === 'dot') ell(g, ex + look * r * 0.3, y + up * r * 0.3, r * 0.42, r * 0.55, INK, 0);
      else if (kind === 'big' || kind === 'wide') {
        ell(g, ex, y, r, r * 1.15, '#fff', 4);
        circ(g, ex + look * r * 0.45, y + up * r * 0.45, kind === 'wide' ? r * 0.2 : r * 0.5, INK, 0);
        if (kind === 'big') circ(g, ex + look * r * 0.45 - r * 0.16, y + up * r * 0.45 - r * 0.2, r * 0.15, '#fff', 0);
      } else if (kind === 'glare' || kind === 'half') {
        ell(g, ex, y, r, r * 0.95, '#fff', 4);
        circ(g, ex + look * r * 0.4, y + r * 0.25, r * 0.42, INK, 0);
        // the heavy eyelid
        P(g, skin, () => { g.ellipse(ex, y, r + 2, r * 0.95 + 2, 0, Math.PI, TAU); if (kind === 'glare') g.lineTo(ex - s * r, y + r * 0.1); g.closePath(); }, 0);
        if (kind === 'glare') line(g, [ex - s * r * 1.15, y - r * 0.05 + 2, ex + s * r * 1.05, y - r * 0.55], INK, 5);
        else line(g, [ex - r, y + 1, ex + r, y + 1], INK, 4);
      } else if (kind === 'happy') curve(g, ex - r * 0.75, y + r * 0.25, ex, y - r * 0.75, ex + r * 0.75, y + r * 0.25, INK, 5);
      else if (kind === 'closed') curve(g, ex - r * 0.75, y, ex, y + r * 0.6, ex + r * 0.75, y, INK, 5);
      else if (kind === 'heart') heart(g, ex, y, r * 0.06 * 10 / 6);
      else if (kind === 'x') { line(g, [ex - r * 0.5, y - r * 0.5, ex + r * 0.5, y + r * 0.5], INK, 5); line(g, [ex + r * 0.5, y - r * 0.5, ex - r * 0.5, y + r * 0.5], INK, 5); }
    }
    if (kind === 'shades') {
      for (const s of [-1, 1]) rect(g, x + (s * gap) / 2 - r * 1.25, y - r * 0.75, r * 2.5, r * 1.5, r * 0.55, '#15131c', 4);
      line(g, [x - gap / 2 + r * 1.2, y - r * 0.3, x + gap / 2 - r * 1.2, y - r * 0.3], INK, 5);
      line(g, [x - gap / 2 - r * 0.6, y - r * 0.35, x - gap / 2 - r * 0.1, y - r * 0.55], 'rgba(255,255,255,0.7)', 4);
    }
  }
  function mouth(g, x, y, w, kind = 'smile') {
    if (kind === 'smile') curve(g, x - w / 2, y, x, y + w * 0.5, x + w / 2, y, INK, 5);
    else if (kind === 'grin' || kind === 'open') {
      P(g, '#6b1d2c', () => { g.moveTo(x - w / 2, y); g.quadraticCurveTo(x, y + w * (kind === 'grin' ? 0.9 : 1.1), x + w / 2, y); g.closePath(); }, 4);
      if (kind === 'grin') P(g, '#fff', () => { g.moveTo(x - w * 0.42, y + 2); g.lineTo(x + w * 0.42, y + 2); g.lineTo(x + w * 0.36, y + w * 0.16); g.lineTo(x - w * 0.36, y + w * 0.16); g.closePath(); }, 0);
      else ell(g, x, y + w * 0.36, w * 0.2, w * 0.12, '#ff7a8a', 0);
    } else if (kind === 'o') ell(g, x, y + w * 0.1, w * 0.24, w * 0.32, '#6b1d2c', 4);
    else if (kind === 'flat') line(g, [x - w * 0.35, y + 4, x + w * 0.35, y + 4], INK, 5);
    else if (kind === 'frown') curve(g, x - w * 0.4, y + w * 0.25, x, y - w * 0.2, x + w * 0.4, y + w * 0.25, INK, 5);
    else if (kind === 'smirk') curve(g, x - w * 0.4, y + w * 0.08, x + w * 0.15, y + w * 0.22, x + w * 0.45, y - w * 0.16, INK, 5);
    else if (kind === 'wavy') line(g, [x - w * 0.42, y + 6, x - w * 0.25, y, x - w * 0.08, y + 6, x + w * 0.08, y, x + w * 0.25, y + 6, x + w * 0.42, y], INK, 4);
    else if (kind === 'full') { ell(g, x, y + 4, w * 0.4, w * 0.22, '#f2a0a8', 4); ell(g, x - w * 0.55, y - 2, w * 0.16, w * 0.12, '#f7a3a3', 0); ell(g, x + w * 0.55, y - 2, w * 0.16, w * 0.12, '#f7a3a3', 0); }
  }
  function hair(g, x, y, r, kind, c) {
    if (!kind || kind === 'none') return;
    if (kind === 'short') P(g, c, () => { g.arc(x, y, r + 3, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(x + r * 0.2, y - r * 0.5, x - r * 0.2, y - r * 0.62); g.quadraticCurveTo(x - r * 0.7, y - r * 0.45, x - r - 3, y - r * 0.05); g.closePath(); }, 4);
    else if (kind === 'spiky') P(g, c, () => { g.moveTo(x - r - 2, y - r * 0.1); for (let i = 0; i <= 6; i++) { const a = Math.PI * (1.05 + (i / 6) * 0.9); g.lineTo(x + Math.cos(a) * (r + 22), y + Math.sin(a) * (r + 22)); const b = Math.PI * (1.05 + ((i + 0.5) / 6) * 0.9); if (i < 6) g.lineTo(x + Math.cos(b) * (r - 2), y + Math.sin(b) * (r - 2)); } g.lineTo(x + r + 2, y - r * 0.1); g.quadraticCurveTo(x, y - r * 0.55, x - r - 2, y - r * 0.1); g.closePath(); }, 4);
    else if (kind === 'bun') { circ(g, x, y - r - 14, r * 0.38, c, 4); P(g, c, () => { g.arc(x, y, r + 3, Math.PI * 1.0, Math.PI * 2.0); g.quadraticCurveTo(x, y - r * 0.45, x - r - 3, y); g.closePath(); }, 4); }
    else if (kind === 'pomp') P(g, c, () => { g.moveTo(x - r - 2, y - r * 0.05); g.quadraticCurveTo(x - r * 1.1, y - r * 1.5, x + r * 0.2, y - r * 1.45); g.quadraticCurveTo(x + r * 1.4, y - r * 1.35, x + r + 2, y - r * 0.15); g.quadraticCurveTo(x, y - r * 0.6, x - r - 2, y - r * 0.05); g.closePath(); }, 4);
    else if (kind === 'messy') { for (let i = 0; i < 7; i++) { const a = Math.PI * (1.0 + i / 6); circ(g, x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, r * 0.36, c, 3); } }
    else if (kind === 'cap') { P(g, c, () => { g.arc(x, y - 4, r + 3, Math.PI, TAU); g.closePath(); }, 4); P(g, c, () => { g.moveTo(x + r * 0.2, y - 6); g.lineTo(x + r * 1.7, y - 2); g.quadraticCurveTo(x + r * 1.6, y + 10, x + r * 0.2, y + 6); g.closePath(); }, 4); }
  }
  // A cartoon person standing on (x, y); local units, about 320 tall at s = 1.
  function dude(g, x, y, s, o = {}) {
    g.save(); g.translate(x, y); g.scale(o.flip ? -s : s, s); if (o.rot) g.rotate(o.rot);
    const skin = o.skin || '#f2c19b', shirt = o.shirt || '#4f8cff', pants = o.pants || '#3b3f5c';
    if (o.legs !== 'none') {
      if (o.legs === 'walk') { limb(g, -14, -112, -48, -8, pants, 28); limb(g, 14, -112, 44, -8, pants, 28); ell(g, -54, -4, 22, 11, '#2b2b33', 4); ell(g, 52, -4, 22, 11, '#2b2b33', 4); }
      else if (o.legs === 'sit') { limb(g, -16, -112, 42, -110, pants, 30); limb(g, 16, -112, 62, -112, pants, 30); limb(g, 52, -110, 54, -10, pants, 28); ell(g, 66, -5, 22, 11, '#2b2b33', 4); }
      else { limb(g, -20, -112, -24, -10, pants, 28); limb(g, 20, -112, 24, -10, pants, 28); ell(g, -30, -5, 22, 11, '#2b2b33', 4); ell(g, 30, -5, 22, 11, '#2b2b33', 4); }
    }
    rect(g, -48, -218, 96, 122, 32, shirt);
    if (o.tie) poly(g, [0, -214, -9, -200, 0, -150, 9, -200], o.tie, 3);
    if (o.extra) o.extra(g);
    const L = o.armL || [-64, -118], R = o.armR || [64, -118];
    const arm = (sx, h, hc) => { if (hc) bend(g, sx, -198, hc[0], hc[1], h[0], h[1], shirt, 24); else limb(g, sx, -198, h[0], h[1], shirt, 24); circ(g, h[0], h[1], 14, skin, 4); };
    arm(-40, L, o.elbowL); if (o.hold) o.hold(g); arm(40, R, o.elbowR);
    face(g, 0, -266, Object.assign({ skin }, o));
    if (o.front) o.front(g);
    g.restore();
  }
  function face(g, x, y, o) {
    const r = o.headR || 52, skin = o.skin || '#f2c19b', lk = o.look || 0, hc = o.hairC || '#4a2c1d';
    if (o.hair === 'long') P(g, hc, () => { g.ellipse(x, y + r * 0.35, r * 1.18, r * 1.25, 0, 0, TAU); }, 4);
    circ(g, x - r * 0.98 - lk * 6, y + 4, r * 0.2, skin, 4); circ(g, x + r * 0.98 - lk * 6, y + 4, r * 0.2, skin, 4);
    circ(g, x, y, r, skin);
    hair(g, x, y, r, o.hair === 'long' ? 'short' : o.hair || 'short', hc);
    const fx = x + lk * r * 0.32;
    if (o.blush) { ell(g, fx - r * 0.55, y + r * 0.3, r * 0.17, r * 0.1, 'rgba(255,110,130,0.5)', 0); ell(g, fx + r * 0.55, y + r * 0.3, r * 0.17, r * 0.1, 'rgba(255,110,130,0.5)', 0); }
    eyes(g, fx, y - r * 0.08, r * 0.72, r * (o.eyeR || 0.2), o.eyes || 'dot', o.eyeLook != null ? o.eyeLook : lk, skin, o.eyeUp || 0);
    if (o.brows) for (const sgn of [-1, 1]) { const bx = fx + sgn * r * 0.36, by = y - r * 0.42 - (o.browUp || 0); const tilt = o.brows === 'angry' ? 9 : o.brows === 'worried' ? -9 : o.brows === 'up' ? 0 : 0; line(g, [bx - r * 0.2, by - (sgn < 0 ? -tilt : tilt), bx + r * 0.2, by - (sgn < 0 ? tilt : -tilt)], INK, 6); }
    if (o.nose !== false) curve(g, fx - 3, y + r * 0.12, fx + 6 + lk * 4, y + r * 0.2, fx, y + r * 0.27, 'rgba(36,32,44,0.55)', 4);
    mouth(g, fx, y + r * 0.45, r * 0.62, o.mouth || 'smile');
    if (o.sweat) drops(g, [[x + r * 0.9, y - r * 0.55, 1.2], [x - r * 0.95, y - r * 0.25, 0.9], [x + r * 1.15, y - r * 0.05, 0.8]]);
    if (o.beard) P(g, o.beard, () => { g.moveTo(x - r * 0.85, y + r * 0.2); g.quadraticCurveTo(x - r * 0.7, y + r * 1.9, x, y + r * 2.2); g.quadraticCurveTo(x + r * 0.7, y + r * 1.9, x + r * 0.85, y + r * 0.2); g.quadraticCurveTo(x, y + r * 0.85, x - r * 0.85, y + r * 0.2); g.closePath(); }, 4);
    if (o.hat) o.hat(g, x, y, r);
  }
  const TOP = [14, 8, 572, 148, 68, 't'];
  const BOT = (h) => [14, h - 156, 572, 148, 68, 'b'];
  const lb = (x, y, w, h, px = 48) => [x, y, w, h, px, 'm'];
  const panelLine = (g, y) => { g.fillStyle = INK; g.fillRect(0, y - 3, 600, 6); };
  const vLine = (g, x, y0, y1) => { g.fillStyle = INK; g.fillRect(x - 3, y0, 6, y1 - y0); };

  // ---------- the templates (all original art) ----------
  const T = {
    fine: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['ME AT GAME NIGHT', 'WHEN NOBODY READ THE RULES'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#f8c25a', '#e98a3a');
      g.fillStyle = 'rgba(70,40,40,0.5)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(i * 75, 30 + (i % 3) * 18, 70, 0, TAU); g.fill(); }
      rect(g, 40, 120, 150, 120, 8, '#bfe7ff'); line(g, [115, 120, 115, 240], INK, 5); line(g, [40, 180, 190, 180], INK, 5);
      for (let i = 0; i < 9; i++) flame(g, 30 + i * 70, 460, 110, 160 + ((i * 53) % 90), (i % 3) - 1);
      // the dog
      ell(g, 330, 380, 88, 96, '#c98a4b');
      ell(g, 330, 400, 50, 64, '#eac08d', 0);
      ell(g, 262, 236, 26, 60, '#7a4a28', 5, 0.35); ell(g, 398, 236, 26, 60, '#7a4a28', 5, -0.35);
      circ(g, 330, 236, 74, '#c98a4b');
      ell(g, 330, 270, 40, 30, '#eac08d', 4);
      ell(g, 330, 254, 15, 11, INK, 0);
      eyes(g, 330, 220, 56, 14, 'half', 0, '#c98a4b');
      curve(g, 314, 286, 330, 296, 346, 284, INK, 4);
      // little hat
      ell(g, 330, 168, 70, 14, '#3a2f4a'); rect(g, 290, 118, 80, 52, 24, '#3a2f4a'); g.fillStyle = '#c94a4a'; g.fillRect(292, 150, 76, 10);
      // table, mug, paw
      rect(g, -10, 448, 620, 36, 6, '#9a5b34'); rect(g, 30, 484, 26, 120, 4, '#7a4426'); rect(g, 544, 484, 26, 120, 4, '#7a4426');
      rect(g, 210, 392, 62, 58, 10, '#fff'); P(g, null, () => g.arc(274, 420, 16, -1.2, 1.2), 6);
      ell(g, 280, 410, 26, 18, '#c98a4b');
      for (const [x, y] of [[226, 378], [248, 370], [262, 382]]) curve(g, x, y, x - 8, y - 14, x + 2, y - 26, 'rgba(255,255,255,0.8)', 4);
    } },
    buttons: { n: 3, h: 700, slots: [lb(16, 18, 262, 120, 46), lb(322, 18, 262, 120, 46), [14, 596, 572, 96, 56, 'b']], sample: ['ONE MORE ROUND', 'GO TO BED', 'ME AT 2 AM'], draw(g) {
      fillBg(g, 0, 0, 600, 400, '#c9d3e6', '#9eabc6');
      rect(g, 30, 250, 540, 170, 18, '#727c94'); rect(g, 30, 250, 540, 26, 12, '#8e98b0', 0);
      for (const x of [165, 435]) { ell(g, x, 270, 92, 30, '#3b3f52'); P(g, '#ff3b47', () => { g.ellipse(x, 252, 70, 52, 0, Math.PI, TAU); g.lineTo(x + 70, 262); g.ellipse(x, 262, 70, 20, 0, 0, Math.PI); g.closePath(); }); ell(g, x - 22, 222, 18, 10, 'rgba(255,255,255,0.6)', 0, -0.3); }
      limb(g, 300, -40, 300, 140, '#f2c19b', 46);
      rect(g, 270, 128, 60, 60, 24, '#f2c19b'); limb(g, 300, 180, 300, 214, '#f2c19b', 16);
      drops(g, [[340, 170, 1], [258, 150, 0.9]]);
      panelLine(g, 400);
      fillBg(g, 0, 400, 600, 300, '#ffe1cf', '#ffc3a7');
      g.save(); g.beginPath(); g.rect(0, 403, 600, 297); g.clip();
      dude(g, 300, 980, 1.55, { shirt: '#4fbf8b', eyes: 'wide', eyeR: 0.24, brows: 'worried', mouth: 'wavy', sweat: true, armL: [-30, -290], elbowL: [-120, -210], hold: (h) => { rect(h, -78, -330, 90, 40, 14, '#fff', 4); }, legs: 'none' });
      g.restore();
    } },
    whowins: { n: 2, h: 560, slots: [[10, 432, 280, 120, 52, 'b'], [310, 432, 280, 120, 52, 'b']], sample: ['100 GROWN-UPS', 'ONE STUCK JAR LID'], draw(g) {
      fillBg(g, 0, 70, 300, 490, '#4a7cff', '#2a3fb0'); fillBg(g, 300, 70, 300, 490, '#ff9a4a', '#d9502a');
      g.fillStyle = '#fff'; g.fillRect(0, 0, 600, 70); label(g, 'WHO WOULD WIN?', 300, 37, 40, INK, 'Lilita One'); g.fillStyle = INK; g.fillRect(0, 68, 600, 5);
      // the muscle blob
      ell(g, 150, 330, 92, 104, '#9b5cff'); circ(g, 62, 250, 40, '#9b5cff'); circ(g, 238, 250, 40, '#9b5cff'); circ(g, 50, 205, 26, '#9b5cff'); circ(g, 250, 205, 26, '#9b5cff');
      curve(g, 110, 360, 150, 380, 190, 360, 'rgba(36,32,44,0.4)', 4);
      eyes(g, 150, 290, 56, 13, 'glare', 0, '#9b5cff'); mouth(g, 150, 320, 52, 'grin');
      // the tiny pebble, on its own little spotlight
      ell(g, 450, 360, 70, 16, 'rgba(255,255,220,0.45)', 0);
      ell(g, 450, 344, 30, 20, '#a8a29e', 4);
      eyes(g, 450, 340, 18, 6, 'big'); curve(g, 444, 352, 450, 356, 456, 352, INK, 3);
      // VS
      line(g, [300, 70, 280, 200, 320, 260, 290, 400, 300, 560], '#fff', 10);
      circ(g, 300, 270, 48, '#ffe14d', 6); label(g, 'VS', 300, 272, 44, INK, 'Lilita One');
    } },
    brain: { n: 4, h: 800, slots: [0, 1, 2, 3].map((i) => [10, i * 200 + 10, 282, 180, 46, 'm']), sample: ['LAUGHING', 'CRYING LAUGHING', 'SNORT LAUGHING', 'MAKING THE MEME'], draw(g) {
      const bgs = [['#25232f', '#191820'], ['#2b2d58', '#191a3a'], ['#3b2c7a', '#20184a'], ['#6b2fa8', '#14063a']];
      for (let i = 0; i < 4; i++) {
        const y = i * 200; g.fillStyle = '#fffaf0'; g.fillRect(0, y, 300, 200); fillBg(g, 300, y, 300, 200, bgs[i][0], bgs[i][1]);
        g.save(); g.beginPath(); g.rect(300, y, 300, 200); g.clip();
        if (i === 3) { const rg = g.createRadialGradient(450, y + 100, 10, 450, y + 100, 200); rg.addColorStop(0, 'rgba(255,240,150,0.9)'); rg.addColorStop(1, 'rgba(255,120,255,0)'); g.fillStyle = rg; g.fillRect(300, y, 300, 200); for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; line(g, [450 + Math.cos(a) * 60, y + 100 + Math.sin(a) * 60, 450 + Math.cos(a) * 220, y + 100 + Math.sin(a) * 220], 'rgba(255,255,200,0.45)', 6); } }
        if (i >= 2) for (let k = 0; k < 14; k++) sparkle(g, 310 + ((k * 97) % 280), y + 10 + ((k * 61) % 180), 4 + (k % 3) * 2, 'rgba(255,255,255,0.8)');
        const hc = i === 3 ? 'rgba(255,230,200,0.55)' : '#e8c6a4';
        P(g, hc, () => { g.arc(440, y + 110, 64, Math.PI * 0.75, Math.PI * 2.25); g.lineTo(520, y + 128); g.lineTo(500, y + 140); g.lineTo(492, y + 170); g.lineTo(430, y + 182); g.closePath(); }, 4);
        circ(g, 476, y + 96, 5, INK, 0);
        const br = [12, 26, 40, 52][i], bc = ['#ff9eb4', '#ff8aa6', '#ffd84a', '#fffbe0'][i];
        if (i >= 2) { const rg = g.createRadialGradient(432, y + 92, 0, 432, y + 92, br * 2.2); rg.addColorStop(0, 'rgba(255,240,120,0.9)'); rg.addColorStop(1, 'rgba(255,240,120,0)'); g.fillStyle = rg; g.beginPath(); g.arc(432, y + 92, br * 2.2, 0, TAU); g.fill(); }
        P(g, bc, () => { for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU; g.arc(432 + Math.cos(a) * br * 0.55, y + 92 + Math.sin(a) * br * 0.4, br * 0.5, 0, TAU); } }, 0);
        ell(g, 432, y + 92, br, br * 0.78, null, 3);
        curve(g, 432 - br * 0.5, y + 92, 432, y + 92 - br * 0.3, 432 + br * 0.5, y + 92, 'rgba(36,32,44,0.5)', 3);
        g.restore();
        vLine(g, 300, y, y + 200);
        if (i) panelLine(g, y);
      }
    } },
    catplate: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['WHEN THEY SAY IT’S', 'CHICKEN-FLAVOURED BROCCOLI'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#a6dccf', '#7cbfb0');
      for (let x = 20; x < 600; x += 60) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, 0, 18, 600); }
      // cat
      ell(g, 300, 470, 150, 120, '#f4f1ec');
      poly(g, [200, 210, 214, 100, 268, 176], '#f4f1ec'); poly(g, [400, 210, 386, 100, 332, 176], '#f4f1ec');
      poly(g, [214, 196, 220, 128, 254, 178], '#ffb3c1', 0); poly(g, [386, 196, 380, 128, 346, 178], '#ffb3c1', 0);
      ell(g, 300, 270, 128, 108, '#f4f1ec');
      ell(g, 300, 210, 50, 22, '#e3ddd4', 0);
      eyes(g, 300, 255, 110, 26, 'glare', 0, '#f4f1ec');
      line(g, [222, 222, 278, 238], INK, 7); line(g, [378, 222, 322, 238], INK, 7);
      poly(g, [290, 292, 310, 292, 300, 304], '#ff8fa3', 3);
      curve(g, 280, 322, 300, 312, 320, 322, INK, 4);
      for (const s of [-1, 1]) for (const k of [0, 1, 2]) line(g, [300 + s * 70, 300 + k * 12, 300 + s * 150, 288 + k * 18], 'rgba(36,32,44,0.6)', 3);
      // table + plate
      rect(g, -10, 420, 620, 200, 0, '#fff7ea'); for (let x = 0; x < 600; x += 50) { g.fillStyle = 'rgba(232,90,90,0.35)'; g.fillRect(x, 420, 25, 200); g.fillRect(0, 445 + (x % 100), 600, 10); }
      ell(g, 170, 432, 46, 26, '#f4f1ec'); ell(g, 430, 432, 46, 26, '#f4f1ec');
      ell(g, 300, 470, 140, 44, '#fff'); ell(g, 300, 466, 100, 28, '#f1f1f1', 3);
      for (const [x, y] of [[270, 446], [300, 440], [326, 448]]) { line(g, [x, y + 26, x, y + 6], '#6dbb4a', 10); for (const [dx, dy] of [[-12, 0], [12, 0], [0, -12], [-6, -6], [6, -6]]) circ(g, x + dx, y + dy, 11, '#4f9c34', 3); }
      circ(g, 360, 460, 8, '#9bd36a', 3);
    } },
    lookback: { n: 3, h: 600, slots: [lb(6, 150, 200, 86, 40), lb(206, 96, 196, 86, 40), lb(404, 150, 190, 86, 40)], sample: ['A NEW HOBBY', 'ME', 'MY 9 UNFINISHED HOBBIES'], draw(g) {
      fillBg(g, 0, 0, 600, 430, '#bfe7ff', '#e6f6ff');
      cloud(g, 60, 70, 0.8); cloud(g, 430, 50, 1);
      for (const [x, r] of [[40, 70], [560, 80]]) { rect(g, x - 12, 300, 24, 140, 6, '#8a5a3a'); circ(g, x, 290, r, '#5fbf5a'); }
      fillBg(g, 0, 430, 600, 170, '#7fcf6a', '#5fae4f');
      P(g, '#e9d8b4', () => { g.moveTo(0, 520); g.quadraticCurveTo(300, 470, 600, 520); g.lineTo(600, 600); g.lineTo(0, 600); g.closePath(); }, 0);
      dude(g, 112, 572, 0.9, { shirt: '#ff4f7a', pants: '#3a3a5a', hair: 'long', hairC: '#ffcf4a', eyes: 'happy', mouth: 'smile', legs: 'walk', flip: true, armL: [-58, -140], armR: [60, -170] });
      for (const [x, y] of [[50, 330], [170, 280], [60, 250]]) sparkle(g, x, y, 12, '#fff38a');
      dude(g, 330, 572, 0.92, { shirt: '#3d8bff', legs: 'walk', look: -1, eyes: 'big', eyeLook: -1, mouth: 'o', armR: [80, -126], armL: [-56, -120] });
      dude(g, 492, 572, 0.9, { shirt: '#9b5cff', hair: 'bun', hairC: '#2b1a12', eyes: 'glare', eyeLook: -1, look: -0.5, mouth: 'frown', legs: 'stand', armL: [-84, -126], armR: [56, -150], elbowR: [80, -170] });
    } },
    nahyeah: { n: 2, h: 640, slots: [[312, 10, 278, 300, 56, 'm'], [312, 330, 278, 300, 56, 'm']], sample: ['SLEEPING EARLY', 'ONE MORE MEME'], draw(g) {
      for (const [i, pose] of [[0, 'nah'], [1, 'yeah']]) {
        const y = i * 320;
        g.fillStyle = i ? '#ffe36b' : '#ffd23f'; g.fillRect(0, y, 300, 320); g.fillStyle = '#fff8e7'; g.fillRect(300, y, 300, 320);
        g.save(); g.beginPath(); g.rect(0, y, 300, 320); g.clip();
        const nah = pose === 'nah';
        dude(g, 150, y + 600, 1.5, {
          skin: '#ff9a5a', shirt: '#2fb38f', hair: 'pomp', hairC: '#3a2214', legs: 'none', look: nah ? -0.7 : 0.6, eyes: nah ? 'closed' : 'happy', mouth: nah ? 'frown' : 'grin', brows: nah ? 'angry' : null,
          armR: nah ? [70, -330] : [76, -262], elbowR: nah ? [110, -230] : [86, -190], armL: [-60, -120],
          front: (h) => { if (nah) { rect(h, 52, -380, 40, 56, 16, '#ff9a5a', 4); } else { rect(h, 62, -276, 38, 26, 12, '#ff9a5a', 4); limb(h, 96, -264, 98, -264, '#ff9a5a', 11); } },
        });
        g.restore();
        vLine(g, 300, y, y + 320);
      }
      panelLine(g, 320);
    } },
    galaxy: { n: 3, h: 660, slots: [0, 1, 2].map((i) => [10, i * 220 + 10, 282, 200, 48, 'm']), sample: ['TEXTING BACK', 'CALLING BACK', 'SENDING A MEME BACK'], draw(g) {
      const B = [['#2a2a33', '#1a1a20'], ['#18306b', '#0e1c45'], ['#3a1460', '#090218']];
      for (let i = 0; i < 3; i++) {
        const y = i * 220; g.fillStyle = '#fffaf0'; g.fillRect(0, y, 300, 220); fillBg(g, 300, y, 300, 220, B[i][0], B[i][1]);
        g.save(); g.beginPath(); g.rect(300, y, 300, 220); g.clip();
        const cx = 450, cy = y + 104;
        if (i < 2) {
          if (i === 1) { const rg = g.createRadialGradient(cx, cy - 10, 10, cx, cy - 10, 140); rg.addColorStop(0, 'rgba(255,240,140,0.85)'); rg.addColorStop(1, 'rgba(255,240,140,0)'); g.fillStyle = rg; g.fillRect(300, y, 300, 220); for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; line(g, [cx + Math.cos(a) * 62, cy - 10 + Math.sin(a) * 62, cx + Math.cos(a) * 92, cy - 10 + Math.sin(a) * 92], '#fff3a0', 6); } }
          circ(g, cx, cy - 12, 46, i ? '#fff7b0' : '#8d8d96');
          rect(g, cx - 22, cy + 28, 44, 34, 6, '#9aa0ad'); line(g, [cx - 22, cy + 40, cx + 22, cy + 40], INK, 3); line(g, [cx - 22, cy + 51, cx + 22, cy + 51], INK, 3);
          line(g, [cx - 12, cy + 26, cx - 6, cy - 6, cx, cy + 4, cx + 6, cy - 6, cx + 12, cy + 26], i ? '#ff9a2a' : '#5a5a62', 4);
        } else {
          for (let k = 0; k < 60; k++) circ(g, 300 + ((k * 137) % 300), y + ((k * 71) % 220), (k % 4) * 0.7 + 0.8, '#fff', 0);
          for (let arm = 0; arm < 3; arm++) for (let k = 0; k < 40; k++) { const t = k / 40, a = arm * (TAU / 3) + t * 5, r = 6 + t * 95; circ(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.55, 7 * (1 - t) + 2, `hsla(${280 + t * 80},100%,${75 - t * 25}%,0.8)`, 0); }
          const rg = g.createRadialGradient(cx, cy, 0, cx, cy, 40); rg.addColorStop(0, '#fff'); rg.addColorStop(1, 'rgba(255,220,255,0)'); g.fillStyle = rg; g.beginPath(); g.arc(cx, cy, 40, 0, TAU); g.fill();
        }
        g.restore(); vLine(g, 300, y, y + 220); if (i) panelLine(g, y);
      }
    } },
    shook: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['WHEN THE MEME', 'IS ACTUALLY FUNNY'], draw(g) {
      g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 600, 600);
      for (let k = 0; k < 24; k++) { g.fillStyle = k % 2 ? '#ffb02e' : '#ffd23f'; g.beginPath(); g.moveTo(300, 330); g.arc(300, 330, 700, (k / 24) * TAU, ((k + 1) / 24) * TAU); g.closePath(); g.fill(); }
      rect(g, 210, 470, 180, 160, 40, '#e85a8a');
      circ(g, 300, 320, 170, '#f7c9a3');
      hair(g, 300, 320, 170, 'spiky', '#5a3420');
      eyes(g, 300, 290, 150, 48, 'wide');
      line(g, [190, 196, 250, 184], INK, 9); line(g, [410, 196, 350, 184], INK, 9);
      ell(g, 300, 412, 40, 56, '#6b1d2c', 6);
      for (const s of [-1, 1]) { ell(g, 300 + s * 170, 380, 46, 64, '#f7c9a3', 5, s * 0.2); }
      for (const s of [-1, 1]) for (const k of [0, 1, 2]) line(g, [300 + s * (196 + k * 10), 200 - k * 30, 300 + s * (226 + k * 16), 176 - k * 34], INK, 6);
    } },
    pointing: { n: 3, h: 560, slots: [lb(16, 340, 268, 96, 44), lb(316, 340, 268, 96, 44), [14, 8, 572, 120, 58, 't']], sample: ['ME', 'ALSO ME', 'WHO ATE THE LAST COOKIE?'], draw(g) {
      fillBg(g, 0, 0, 600, 440, '#cfe2ff', '#b4cdf5'); fillBg(g, 0, 440, 600, 120, '#8fa6d4', '#7389ba');
      rect(g, 230, 150, 140, 180, 10, '#fff6d6'); line(g, [300, 150, 300, 330], INK, 4); line(g, [230, 240, 370, 240], INK, 4);
      const o = { shirt: '#3dbb73', pants: '#2c3a6b', hair: 'cap', hairC: '#ff5a3a', eyes: 'big', mouth: 'o', brows: 'up', browUp: 6, armL: [-50, -120], armR: [118, -232], elbowR: [70, -200] };
      dude(g, 140, 548, 0.95, o); dude(g, 460, 548, 0.95, Object.assign({}, o, { flip: true }));
      for (const x of [252, 348]) { line(g, [x, 130, x, 176], INK, 8); circ(g, x, 192, 5, INK, 0); }
    } },
    expect: { n: 2, h: 440, slots: [[10, 324, 280, 108, 46, 'b'], [310, 324, 280, 108, 46, 'b']], sample: ['MY BIRTHDAY CAKE', 'MY BIRTHDAY CAKE'], draw(g) {
      fillBg(g, 0, 0, 300, 440, '#dff7ff', '#bfe7ff'); fillBg(g, 300, 0, 300, 440, '#ddd5c6', '#bfb5a2');
      for (const [x, t] of [[150, 'EXPECTATION'], [450, 'REALITY']]) { rect(g, x - 92, 14, 184, 38, 19, '#fff', 4); label(g, t, x, 34, 22, INK); }
      // the dream cake
      ell(g, 150, 300, 120, 22, '#fff');
      rect(g, 66, 220, 168, 78, 14, '#ff8fb8'); rect(g, 86, 160, 128, 64, 14, '#ffc2dc'); rect(g, 106, 108, 88, 56, 12, '#ff8fb8');
      for (const [x0, w, y0] of [[66, 168, 220], [86, 128, 160], [106, 88, 108]]) P(g, '#fff', () => { g.moveTo(x0, y0 + 10); for (let x = x0; x <= x0 + w; x += 16) g.quadraticCurveTo(x + 8, y0 + 26, x + 16, y0 + 10); g.lineTo(x0 + w, y0); g.lineTo(x0, y0); g.closePath(); }, 0);
      circ(g, 150, 98, 14, '#e8243c'); line(g, [150, 84, 160, 70], '#3a8a3a', 4);
      for (const [x, y] of [[50, 120], [250, 90], [240, 200], [40, 230], [80, 70]]) sparkle(g, x, y, 14, '#ffe14d');
      // the real one
      P(g, '#c79a6a', () => { g.moveTo(350, 300); g.quadraticCurveTo(360, 230, 420, 246); g.quadraticCurveTo(470, 210, 520, 256); g.quadraticCurveTo(570, 270, 556, 300); g.closePath(); });
      P(g, '#ffd3e4', () => { g.moveTo(360, 284); g.quadraticCurveTo(400, 250, 440, 262); g.quadraticCurveTo(500, 236, 540, 280); g.lineTo(530, 296); g.quadraticCurveTo(450, 280, 370, 298); g.closePath(); }, 3);
      ell(g, 450, 302, 128, 20, null, 4);
      rect(g, 470, 196, 12, 64, 4, '#7ad0ff', 3); line(g, [476, 196, 488, 180], INK, 3);
      eyes(g, 440, 274, 30, 6, 'dot'); mouth(g, 440, 290, 18, 'frown');
      circ(g, 380, 200, 6, INK, 0); line(g, [374, 194, 366, 186], INK, 2); line(g, [386, 194, 394, 186], INK, 2);
      vLine(g, 300, 0, 440);
    } },
    temple: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['CAN’T LOSE AT CARDS', 'IF YOU NEVER SHUFFLE'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#7f5af0', '#2cb1ff');
      for (let k = 0; k < 12; k++) sparkle(g, 40 + ((k * 151) % 520), 40 + ((k * 89) % 300), 10 + (k % 3) * 6, 'rgba(255,255,255,0.8)');
      dude(g, 300, 860, 1.85, { shirt: '#ff7a3a', hair: 'short', hairC: '#2b1a12', eyes: 'half', mouth: 'smirk', brows: 'up', legs: 'none', armR: [62, -282], elbowR: [110, -170], armL: [-64, -118],
        front: (h) => { limb(h, 66, -290, 52, -306, '#f2c19b', 10); } });
    } },
    shark: { n: 2, h: 600, slots: [lb(290, 150, 300, 90, 44), lb(14, 440, 290, 96, 44)], sample: ['ME ON VACATION', 'MONDAY'], draw(g) {
      fillBg(g, 0, 0, 600, 230, '#9fe0ff', '#dff6ff'); circ(g, 520, 70, 40, '#ffe14d', 4); cloud(g, 60, 80, 0.9);
      fillBg(g, 0, 230, 600, 370, '#3aa7e6', '#1a5fa8');
      for (let y = 260; y < 600; y += 50) for (let x = (y / 50) % 2 ? 0 : 40; x < 600; x += 90) curve(g, x, y, x + 20, y - 10, x + 40, y, 'rgba(255,255,255,0.4)', 4);
      // swimmer in a donut float
      ell(g, 410, 330, 110, 42, '#ff8fb8'); ell(g, 410, 324, 50, 16, '#1a6fb8', 0);
      for (let k = 0; k < 14; k++) { const a = (k / 14) * TAU; line(g, [410 + Math.cos(a) * 82, 330 + Math.sin(a) * 30, 410 + Math.cos(a) * 92, 334 + Math.sin(a) * 30], ['#fff', '#ffe14d', '#7ad0ff'][k % 3], 5); }
      g.save(); g.beginPath(); g.rect(0, 0, 600, 324); g.clip();
      dude(g, 410, 520, 0.85, { shirt: '#ffe14d', eyes: 'shades', eyeR: 0.22, mouth: 'smile', legs: 'none', armL: [-40, -300], armR: [40, -300], elbowL: [-90, -250], elbowR: [90, -250] });
      g.restore();
      ell(g, 410, 340, 110, 38, null, 5);
      // the fin
      P(g, '#8a97a8', () => { g.moveTo(80, 380); g.quadraticCurveTo(130, 330, 150, 260); g.quadraticCurveTo(180, 340, 230, 380); g.closePath(); });
      curve(g, 60, 384, 150, 370, 250, 384, '#fff', 6);
    } },
    dragon: { n: 2, h: 600, slots: [lb(8, 392, 230, 96, 40), lb(296, 12, 296, 96, 46)], sample: ['ME, AT 7 AM', 'MY INBOX'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#ff9a5a', '#ffd88a');
      P(g, '#8a5a8a', () => { g.moveTo(0, 360); g.lineTo(60, 300); g.lineTo(130, 340); g.lineTo(200, 280); g.lineTo(260, 350); g.lineTo(260, 600); g.lineTo(0, 600); g.closePath(); }, 0);
      rect(g, 40, 250, 50, 120, 4, '#9a8aa8', 4); poly(g, [36, 252, 65, 210, 94, 252], '#c94a4a', 4);
      fillBg(g, 0, 520, 600, 80, '#6aa84f', '#4f8a3a');
      // dragon
      P(g, '#3fae6a', () => { g.moveTo(300, 560); g.quadraticCurveTo(250, 380, 380, 330); g.quadraticCurveTo(560, 300, 600, 420); g.lineTo(600, 560); g.closePath(); });
      P(g, '#2f8a52', () => { g.moveTo(420, 330); g.quadraticCurveTo(520, 150, 600, 120); g.lineTo(600, 330); g.closePath(); });
      P(g, '#3fae6a', () => { g.moveTo(380, 360); g.quadraticCurveTo(360, 260, 410, 200); g.lineTo(470, 240); g.quadraticCurveTo(450, 300, 460, 360); g.closePath(); });
      ell(g, 380, 190, 82, 58, '#3fae6a'); P(g, '#3fae6a', () => { g.moveTo(320, 180); g.lineTo(250, 200); g.lineTo(256, 238); g.lineTo(330, 236); g.closePath(); });
      poly(g, [400, 140, 420, 90, 432, 150], '#f4e3b0'); poly(g, [350, 146, 352, 96, 380, 140], '#f4e3b0');
      eyes(g, 372, 176, 0, 14, 'glare', -1, '#3fae6a');
      for (let k = 0; k < 4; k++) poly(g, [262 + k * 16, 236, 270 + k * 16, 252, 278 + k * 16, 236], '#fff', 2);
      flame(g, 220, 222, 46, 90, -1);
      for (let k = 0; k < 6; k++) poly(g, [330 + k * 40, 340 - k * 5, 345 + k * 40, 312 - k * 5, 360 + k * 40, 338 - k * 5], '#ffe14d', 3);
      // tiny knight
      dude(g, 120, 548, 0.34, { skin: '#c7cfd9', shirt: '#c7cfd9', pants: '#8a96a6', hair: 'none', eyes: 'dot', mouth: 'flat', armR: [90, -230], hat: (h, x, y, r) => { rect(h, x - r * 0.8, y - r * 0.25, r * 1.6, r * 0.2, 4, INK, 0); poly(h, [x, y - r - 30, x - 8, y - r, x + 8, y - r], '#e8243c', 4); } });
      line(g, [152, 470, 200, 410], '#e6e6e6', 4);
    } },
    chart: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['MY SNACK BUDGET', 'AFTER ONE TRIP TO THE STORE'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#e9f0fa', '#cbd8ea');
      rect(g, 250, 150, 320, 280, 10, '#fff'); line(g, [280, 180, 280, 400, 545, 400], INK, 5);
      for (let k = 1; k < 5; k++) line(g, [282, 400 - k * 44, 545, 400 - k * 44], 'rgba(36,32,44,0.15)', 3);
      line(g, [290, 380, 340, 330, 375, 352, 420, 270, 455, 300, 520, 170], '#e8243c', 12);
      poly(g, [500, 150, 560, 140, 540, 200], '#e8243c', 4);
      dude(g, 140, 640, 1.2, { shirt: '#3a3f5a', tie: '#e8243c', hair: 'short', hairC: '#c9a24a', eyes: 'half', mouth: 'smirk', legs: 'none', armR: [130, -300], elbowR: [110, -200],
        extra: (h) => { poly(h, [-20, -218, 0, -170, 20, -218], '#fff', 0); }, front: (h) => { limb(h, 130, -318, 130, -342, '#f2c19b', 12); } });
    } },
    awake: { n: 2, h: 600, slots: [lb(276, 52, 290, 166, 40), BOT(600)], sample: ['DID I EVER RETURN THAT LIBRARY BOOK FROM 2009?', 'ME AT 3 AM'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#1d2350', '#0d1030');
      rect(g, 30, 40, 170, 150, 8, '#2b3a7a'); circ(g, 120, 100, 34, '#fff3b0', 0); circ(g, 134, 92, 30, '#2b3a7a', 0);
      for (let k = 0; k < 6; k++) circ(g, 50 + ((k * 37) % 140), 60 + ((k * 53) % 110), 2.5, '#fff', 0);
      line(g, [115, 40, 115, 190], INK, 6); line(g, [30, 115, 200, 115], INK, 6);
      rect(g, 20, 330, 560, 60, 14, '#7a4a3a');
      ell(g, 170, 400, 110, 40, '#fff');
      circ(g, 180, 380, 54, '#f2c19b'); hair(g, 180, 380, 54, 'messy', '#3a2214');
      eyes(g, 180, 372, 40, 15, 'wide', 0, '#f2c19b', -1); mouth(g, 180, 404, 28, 'flat');
      P(g, '#5a7ae6', () => { g.moveTo(80, 420); g.quadraticCurveTo(300, 380, 590, 420); g.lineTo(590, 600); g.lineTo(80, 600); g.closePath(); });
      for (let x = 120; x < 590; x += 60) line(g, [x, 410, x - 10, 600], 'rgba(255,255,255,0.2)', 6);
      for (const [x, y, r] of [[236, 330, 9], [258, 296, 14]]) circ(g, x, y, r, '#fff', 4);
      ell(g, 420, 136, 172, 112, '#fff');
    } },
    ghost: { n: 2, h: 600, slots: [lb(10, 24, 310, 92, 46), lb(300, 270, 290, 92, 44)], sample: ['ME TRYING TO BE SCARY', 'MY CAT'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#5a4a8a', '#2e2552'); fillBg(g, 0, 470, 600, 130, '#7a5a3a', '#5a4026');
      rect(g, 380, 90, 150, 120, 6, '#c9a24a'); fillBg(g, 394, 104, 122, 92, '#9fd0ff', '#6ab07a');
      P(g, 'rgba(255,255,255,0.95)', () => { g.moveTo(90, 440); g.lineTo(90, 230); g.arc(170, 230, 80, Math.PI, TAU); g.lineTo(250, 440); for (let k = 0; k < 4; k++) g.quadraticCurveTo(250 - k * 40 - 20, 470, 250 - (k + 1) * 40, 440); g.closePath(); });
      ell(g, 60, 280, 40, 18, '#fff', 5, -0.6); ell(g, 280, 280, 40, 18, '#fff', 5, 0.6);
      ell(g, 145, 222, 14, 20, INK, 0); ell(g, 195, 222, 14, 20, INK, 0); ell(g, 170, 280, 22, 30, INK, 0);
      // the unbothered cat
      ell(g, 440, 500, 76, 64, '#9aa0ad');
      P(g, '#9aa0ad', () => { g.moveTo(510, 520); g.quadraticCurveTo(590, 520, 570, 440); }, 14); curve(g, 510, 520, 590, 520, 570, 440, '#9aa0ad', 10);
      poly(g, [384, 400, 392, 344, 424, 384], '#9aa0ad'); poly(g, [496, 400, 488, 344, 456, 384], '#9aa0ad');
      circ(g, 440, 420, 60, '#9aa0ad');
      eyes(g, 440, 414, 52, 14, 'half', 0.3, '#9aa0ad');
      poly(g, [434, 432, 446, 432, 440, 440], '#ff8fa3', 2); mouth(g, 440, 448, 30, 'flat');
    } },
    potato: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['ME AFTER SAYING', '“I’LL BE PRODUCTIVE TODAY”'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#f3d9b0', '#e6c08a');
      const rg = g.createRadialGradient(620, 300, 20, 620, 300, 420); rg.addColorStop(0, 'rgba(120,200,255,0.7)'); rg.addColorStop(1, 'rgba(120,200,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 600, 600);
      rect(g, 40, 280, 520, 160, 40, '#c94a4a'); rect(g, 20, 380, 560, 140, 30, '#e05a5a'); rect(g, 10, 330, 70, 180, 30, '#c94a4a'); rect(g, 520, 330, 70, 180, 30, '#c94a4a');
      ell(g, 300, 380, 180, 92, '#c9925a', 6, -0.08);
      for (const [x, y] of [[200, 350], [380, 330], [300, 430], [420, 410], [190, 420]]) ell(g, x, y, 10, 6, '#9a6a3a', 0);
      eyes(g, 300, 352, 70, 16, 'half', 0.6, '#c9925a'); mouth(g, 304, 388, 50, 'smile');
      rect(g, 410, 380, 40, 84, 10, '#3a3f5a'); circ(g, 430, 400, 6, '#e8243c', 0); ell(g, 430, 450, 24, 16, '#c9925a', 4);
      ell(g, 120, 470, 60, 24, '#fff'); for (let k = 0; k < 6; k++) ell(g, 90 + k * 12, 460 - (k % 2) * 6, 12, 8, '#ffd23f', 2);
    } },
    exit: { n: 3, h: 600, slots: [lb(40, 46, 230, 104, 40), lb(330, 46, 230, 104, 40), lb(210, 470, 260, 90, 40)], sample: ['DOING MY HOMEWORK', 'WATCHING 47 VIDEOS ABOUT PENGUINS', 'ME'], draw(g) {
      fillBg(g, 0, 0, 600, 260, '#8fd3ff', '#d8f1ff'); fillBg(g, 0, 260, 600, 340, '#7fcf6a', '#5fae4f');
      P(g, '#5a5f6e', () => { g.moveTo(250, 260); g.lineTo(330, 260); g.lineTo(520, 600); g.lineTo(-40, 600); g.closePath(); }, 0);
      P(g, '#5a5f6e', () => { g.moveTo(330, 260); g.lineTo(360, 260); g.quadraticCurveTo(470, 380, 640, 470); g.lineTo(640, 600); g.lineTo(520, 600); g.closePath(); }, 0);
      for (let k = 0; k < 6; k++) { const t = k / 6, y = 270 + t * t * 330; line(g, [290 - t * 40, y, 290 - t * 46, y + 10 + t * 30], '#fff', 3 + t * 8); }
      rect(g, 24, 30, 262, 132, 10, '#2f8a52', 5); rect(g, 314, 30, 262, 132, 10, '#2f8a52', 5);
      line(g, [155, 162, 155, 260], '#9aa0ad', 10); line(g, [445, 162, 445, 260], '#9aa0ad', 10);
      // the car, swerving
      g.save(); g.translate(360, 440); g.rotate(0.25);
      rect(g, -90, -60, 180, 90, 22, '#e8243c'); rect(g, -64, -100, 128, 52, 18, '#ff6a6a'); rect(g, -52, -92, 104, 36, 10, '#bfe7ff', 3);
      rect(g, -100, 18, 40, 30, 8, INK, 0); rect(g, 60, 18, 40, 30, 8, INK, 0); circ(g, -60, -20, 10, '#ffe14d', 3); circ(g, 60, -20, 10, '#ffe14d', 3);
      g.restore();
      for (const k of [0, 1, 2]) curve(g, 230 - k * 20, 520 + k * 20, 260, 470, 300, 452 + k * 10, 'rgba(255,255,255,0.7)', 4);
    } },
    scroll: { n: 2, h: 600, slots: [lb(150, 268, 300, 196, 40), [14, 500, 572, 92, 54, 'b']], sample: ['YOUR PHONE WAS IN YOUR HAND THE WHOLE TIME', ''], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#3a2a5a', '#1d1430');
      for (let k = 0; k < 5; k++) { rect(g, 20 + k * 120, 40, 90, 160, 4, ['#8a3a3a', '#3a6a8a', '#8a7a3a', '#5a3a8a', '#3a8a5a'][k], 4); }
      for (const x of [60, 540]) { rect(g, x - 12, 300, 24, 70, 4, '#fff6d6', 4); flame(g, x, 302, 24, 40); }
      dude(g, 300, 600, 1.45, { shirt: '#5a3aa8', skin: '#f2c19b', hair: 'none', eyes: 'wide', eyeR: 0.24, brows: 'up', browUp: 8, mouth: 'o', legs: 'none', beard: '#eeeeee', armL: [-120, -170], armR: [120, -170],
        hat: (h, x, y, r) => { poly(h, [x - r * 1.5, y - r * 0.55, x + r * 1.5, y - r * 0.55, x + r * 0.2, y - r * 2.6], '#5a3aa8', 5); star(h, x - 10, y - r * 1.3, 14, '#ffe14d'); } });
      rect(g, 130, 258, 340, 216, 6, '#f6e3b4'); ell(g, 130, 366, 22, 112, '#e6cf98'); ell(g, 470, 366, 22, 112, '#e6cf98');
    } },
    balloon: { n: 2, h: 600, slots: [lb(14, 470, 300, 110, 44), lb(286, 24, 300, 96, 44)], sample: ['ME', 'MY WEEKEND PLANS'], draw(g) {
      fillBg(g, 0, 0, 600, 460, '#8fd3ff', '#e2f6ff'); fillBg(g, 0, 460, 600, 140, '#7fcf6a', '#5fae4f');
      cloud(g, 40, 230, 1); cloud(g, 330, 300, 0.7);
      curve(g, 480, 200, 400, 300, 300, 360, INK, 3);
      ell(g, 480, 150, 58, 70, '#ff3b47'); ell(g, 460, 120, 14, 22, 'rgba(255,255,255,0.6)', 0, 0.3); poly(g, [474, 220, 486, 220, 480, 208], '#ff3b47', 3);
      dude(g, 180, 572, 0.82, { shirt: '#ffb02e', pants: '#3a6ab8', hair: 'spiky', hairC: '#6a3a1a', eyes: 'big', eyeUp: -1, eyeLook: 1, mouth: 'frown', brows: 'worried', armR: [90, -330], elbowR: [70, -260], armL: [-64, -118] });
    } },
    robot: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['HUMANS WILL PAY £6', 'FOR WATER IN A NICE BOTTLE'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#7fd6c8', '#3a9a8e');
      for (let k = 0; k < 8; k++) { g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, k * 80, 600, 4); }
      rect(g, 200, 330, 200, 170, 24, '#c7cfd9'); for (const s of [-1, 1]) { limb(g, 300 + s * 90, 360, 300 + s * 70, 440, '#aab4c2', 22); }
      line(g, [300, 160, 300, 120], INK, 5); circ(g, 300, 112, 12, '#ff5a5a');
      rect(g, 190, 160, 220, 170, 30, '#c7cfd9'); rect(g, 216, 186, 168, 110, 16, '#163447');
      ell(g, 262, 232, 18, 24, '#5af0ff', 0); ell(g, 338, 232, 18, 24, '#5af0ff', 0); curve(g, 282, 270, 300, 262, 318, 270, '#5af0ff', 5);
      P(g, '#e8243c', () => { g.moveTo(170, 440); g.lineTo(300, 470); g.lineTo(430, 440); g.lineTo(430, 520); g.lineTo(300, 550); g.lineTo(170, 520); g.closePath(); });
      line(g, [300, 470, 300, 550], INK, 5);
      P(g, '#fff6d6', () => { g.moveTo(186, 452); g.lineTo(292, 476); g.lineTo(292, 536); g.lineTo(186, 512); g.closePath(); }, 0); P(g, '#fff6d6', () => { g.moveTo(414, 452); g.lineTo(308, 476); g.lineTo(308, 536); g.lineTo(414, 512); g.closePath(); }, 0);
      label(g, 'HUMANS', 240, 486, 20, INK, 'Lilita One'); label(g, '101', 360, 486, 24, INK, 'Lilita One');
      label(g, '?', 470, 190, 90, '#ffe14d', 'Lilita One');
    } },
    fridge: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['ME AT 2 AM', '“I’M NOT EVEN HUNGRY”'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#1d1f3a', '#0f1022');
      P(g, 'rgba(255,250,200,0.25)', () => { g.moveTo(360, 160); g.lineTo(560, 160); g.lineTo(600, 600); g.lineTo(80, 600); g.closePath(); }, 0);
      rect(g, 360, 120, 200, 420, 14, '#fffbe6'); for (const y of [220, 310, 400]) line(g, [370, y, 550, y], '#cfd6e0', 6);
      rect(g, 390, 180, 40, 40, 6, '#ff8a3a', 3); rect(g, 470, 260, 50, 50, 8, '#7ad07a', 3); rect(g, 400, 350, 60, 50, 8, '#ffd3e4', 3);
      P(g, '#d9dfe8', () => { g.moveTo(560, 120); g.lineTo(600, 90); g.lineTo(600, 580); g.lineTo(560, 540); g.closePath(); });
      dude(g, 250, 640, 1.2, { shirt: '#5a8ae6', pants: '#5a8ae6', hair: 'messy', hairC: '#3a2214', eyes: 'wide', eyeLook: -1, mouth: 'full', legs: 'none', armL: [-30, -170], armR: [40, -200],
        extra: (h) => { for (let y = -210; y < -100; y += 22) line(h, [-46, y, 46, y], 'rgba(255,255,255,0.45)', 6); },
        hold: (h) => { rect(h, -70, -230, 90, 66, 10, '#fff'); ell(h, -25, -228, 40, 10, '#ff8fb8', 3); line(h, [40, -200, 40, -250], '#c7cfd9', 6); } });
      const rg = g.createRadialGradient(560, 300, 10, 560, 300, 400); rg.addColorStop(0, 'rgba(255,250,200,0.25)'); rg.addColorStop(1, 'rgba(255,250,200,0)'); g.fillStyle = rg; g.fillRect(0, 0, 600, 600);
    } },
    cactus: { n: 2, h: 600, slots: [lb(10, 110, 280, 92, 42), lb(318, 26, 272, 92, 42)], sample: ['ME', 'MY FAVOURITE SNACK'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#ffcf6a', '#ff9a5a'); circ(g, 120, 90, 50, '#fff3b0', 0);
      fillBg(g, 0, 470, 600, 130, '#f2c98a', '#e0a860');
      rect(g, 350, 180, 100, 340, 50, '#4fae5a'); rect(g, 270, 260, 60, 130, 30, '#4fae5a'); rect(g, 470, 220, 60, 120, 30, '#4fae5a');
      limb(g, 330, 360, 352, 360, '#4fae5a', 30); limb(g, 448, 300, 470, 300, '#4fae5a', 30);
      for (let k = 0; k < 18; k++) { const x = 360 + ((k * 37) % 80), y = 200 + ((k * 53) % 300); line(g, [x, y, x + 8, y - 8], INK, 2); }
      ell(g, 420, 240, 14, 10, '#ff7ad9', 3);
      dude(g, 270, 580, 0.95, { shirt: '#3d8bff', hair: 'short', hairC: '#2b1a12', eyes: 'closed', mouth: 'smile', blush: true, armR: [96, -186], armL: [96, -150], elbowL: [30, -120] });
      heart(g, 220, 220, 1.6); heart(g, 300, 160, 1.2); heart(g, 250, 120, 0.9);
      label(g, 'OW', 470, 420, 34, '#e8243c', 'Lilita One');
    } },
    snail: { n: 2, h: 600, slots: [lb(16, 170, 290, 96, 44), lb(300, 450, 290, 96, 44)], sample: ['ME, ONE TASK AT A TIME', 'EVERYONE WHO SAID “HURRY UP”'], draw(g) {
      fillBg(g, 0, 0, 600, 280, '#bfe7ff', '#e6f6ff'); fillBg(g, 0, 280, 600, 320, '#d9734a', '#b85a36');
      for (const y of [340, 440, 540]) line(g, [0, y, 600, y], 'rgba(255,255,255,0.7)', 5);
      for (let y = 280; y < 600; y += 24) for (let x = 0; x < 2; x++) { g.fillStyle = (y / 24 + x) % 2 ? '#fff' : INK; g.fillRect(40 + x * 24, y, 24, 24); }
      // the snail, racing
      for (const k of [0, 1, 2]) line(g, [340 + k * 10, 330 + k * 18, 420 + k * 10, 330 + k * 18], 'rgba(255,255,255,0.8)', 5);
      P(g, '#c9e86a', () => { g.moveTo(150, 400); g.lineTo(330, 400); g.quadraticCurveTo(340, 380, 320, 372); g.lineTo(180, 372); g.quadraticCurveTo(140, 340, 150, 400); }, 5);
      circ(g, 260, 330, 62, '#ffb02e'); P(g, null, () => { g.arc(260, 330, 40, 0, Math.PI * 1.6); }, 5); label(g, '1', 262, 334, 34, '#fff', 'Lilita One');
      line(g, [166, 360, 150, 320], INK, 5); line(g, [180, 360, 178, 316], INK, 5); circ(g, 150, 316, 8, INK, 0); circ(g, 178, 312, 8, INK, 0);
      P(g, '#e8243c', () => { g.arc(168, 368, 22, Math.PI, TAU); g.closePath(); }, 4);
      // the sleepy cheetah
      ell(g, 470, 410, 90, 40, '#ffcf4a');
      for (let k = 0; k < 9; k++) circ(g, 410 + ((k * 31) % 120), 396 + ((k * 17) % 26), 5, '#8a5a1a', 0);
      circ(g, 560, 390, 36, '#ffcf4a'); eyes(g, 562, 386, 26, 8, 'closed'); poly(g, [538, 362, 544, 346, 554, 360], '#ffcf4a', 4);
      label(g, 'z', 560, 330, 28, '#fff', 'Lilita One'); label(g, 'Z', 580, 300, 38, '#fff', 'Lilita One');
    } },
    mirror: { n: 2, h: 600, slots: [lb(10, 470, 280, 110, 44), lb(310, 470, 280, 110, 44)], sample: ['ME AT 7 AM', 'ME IN MY HEAD'], draw(g) {
      g.fillStyle = '#d8eef0'; g.fillRect(0, 0, 600, 600);
      for (let x = 0; x < 600; x += 50) for (let y = 0; y < 600; y += 50) { g.strokeStyle = 'rgba(36,32,44,0.12)'; g.lineWidth = 2; g.strokeRect(x, y, 50, 50); }
      rect(g, 316, 40, 260, 420, 130, '#c9a24a', 8); rect(g, 332, 56, 228, 388, 114, '#bfe7ff', 4);
      g.save(); g.beginPath(); rrp(g, 334, 58, 224, 384, 112); g.clip();
      dude(g, 446, 520, 0.95, { shirt: '#24202c', hair: 'pomp', hairC: '#3a2214', eyes: 'shades', eyeR: 0.22, mouth: 'grin', legs: 'none', armL: [-90, -250], elbowL: [-110, -170], armR: [90, -250], elbowR: [110, -170],
        front: (h) => { circ(h, -100, -200, 22, '#24202c', 4); circ(h, 100, -200, 22, '#24202c', 4); } });
      line(g, [360, 90, 400, 70], 'rgba(255,255,255,0.8)', 8);
      g.restore();
      dude(g, 150, 620, 1.05, { shirt: '#f2a6c8', hair: 'messy', hairC: '#3a2214', eyes: 'half', mouth: 'flat', legs: 'none', armR: [70, -190], hold: (h) => {}, front: (h) => { rect(h, 50, -226, 44, 50, 8, '#fff', 4); curve(h, 94, -216, 110, -200, 94, -186, INK, 4); } });
    } },
    ufo: { n: 3, h: 600, slots: [lb(8, 28, 200, 104, 40), lb(14, 300, 220, 96, 40), [14, 470, 572, 122, 60, 'b']], sample: ['THE SNACK DRAWER', 'ME', 'EVERY NIGHT AT 11 PM'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#1a1440', '#3a2a7a');
      for (let k = 0; k < 40; k++) circ(g, (k * 137) % 600, (k * 71) % 420, (k % 3) * 0.8 + 1, '#fff', 0);
      P(g, 'rgba(160,255,170,0.35)', () => { g.moveTo(290, 130); g.lineTo(370, 130); g.lineTo(470, 520); g.lineTo(190, 520); g.closePath(); }, 0);
      P(g, '#2a2050', () => { g.moveTo(0, 520); g.quadraticCurveTo(150, 470, 300, 510); g.quadraticCurveTo(450, 460, 600, 500); g.lineTo(600, 600); g.lineTo(0, 600); g.closePath(); }, 0);
      ell(g, 330, 120, 140, 38, '#b8c2d6'); P(g, '#9ff0ff', () => { g.ellipse(330, 100, 62, 50, 0, Math.PI, TAU); g.closePath(); }); for (let k = -2; k <= 2; k++) circ(g, 330 + k * 50, 126, 8, '#ffe14d', 3);
      // the cow, floating up, delighted
      g.save(); g.translate(330, 330); g.rotate(-0.2);
      ell(g, 0, 0, 80, 50, '#fff'); ell(g, -30, -10, 20, 16, INK, 0); ell(g, 30, 15, 24, 14, INK, 0);
      for (const x of [-50, -20, 25, 55]) limb(g, x, 30, x + 4, 70, '#fff', 14);
      circ(g, 86, -36, 38, '#fff'); ell(g, 104, -22, 22, 16, '#ffb3c1', 4); poly(g, [64, -66, 56, -84, 76, -70], '#f4e3b0', 3); poly(g, [104, -68, 110, -88, 116, -66], '#f4e3b0', 3);
      eyes(g, 86, -44, 26, 7, 'happy');
      g.restore();
    } },
    toast: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['THE ONE TIME', 'I TRY TO BE ORGANISED'], draw(g) {
      fillBg(g, 0, 0, 600, 430, '#ffe9c4', '#ffd79a'); fillBg(g, 0, 430, 600, 170, '#9a6a4a', '#7a4a32');
      for (let x = 0; x < 600; x += 60) { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.strokeRect(x, 0, 60, 60); g.strokeRect(x, 60, 60, 60); }
      rect(g, 30, 330, 170, 110, 26, '#c7cfd9'); rect(g, 60, 320, 40, 14, 4, INK, 0); rect(g, 120, 320, 40, 14, 4, INK, 0);
      for (const k of [0, 1, 2]) curve(g, 150 + k * 20, 320, 230, 200 - k * 20, 290, 220 + k * 10, 'rgba(36,32,44,0.4)', 4);
      ell(g, 330, 520, 90, 18, 'rgba(0,0,0,0.25)', 0);
      g.save(); g.translate(330, 330); g.rotate(2.7);
      rect(g, -80, -76, 160, 152, 40, '#c9783a'); rect(g, -66, -60, 132, 122, 30, '#f2c27a', 0); rect(g, -36, -86, 72, 40, 10, '#fff27a', 4);
      g.restore();
      eyes(g, 318, 344, 46, 12, 'wide'); mouth(g, 320, 376, 30, 'o');
    } },
    duckboss: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['WHEN YOU SAID', 'YOU’D “RUN THE MEETING”'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#f1e3c8', '#e2cfa8');
      rect(g, 360, 110, 200, 180, 6, '#9fd0ff', 5); for (let k = 0; k < 5; k++) rect(g, 370 + k * 38, 200 - (k % 3) * 30, 30, 100, 0, '#5a7aa8', 0); line(g, [460, 110, 460, 290], INK, 5);
      rect(g, 90, 150, 240, 300, 40, '#6a3a2a');
      ell(g, 210, 360, 92, 84, '#ffd23f');
      P(g, '#2b2b3a', () => { g.moveTo(130, 330); g.quadraticCurveTo(210, 300, 290, 330); g.lineTo(300, 440); g.lineTo(120, 440); g.closePath(); });
      poly(g, [196, 320, 224, 320, 216, 400, 204, 400], '#e8243c', 3); poly(g, [180, 312, 210, 330, 240, 312, 210, 300], '#fff', 3);
      circ(g, 210, 240, 70, '#ffd23f');
      eyes(g, 210, 226, 48, 13, 'half', 0, '#ffd23f');
      P(g, '#ff8a2a', () => { g.ellipse(210, 266, 42, 16, 0, 0, TAU); }); line(g, [172, 266, 248, 266], INK, 3);
      rect(g, 0, 420, 600, 180, 8, '#8a5a3a'); rect(g, 0, 420, 600, 22, 6, '#a06a46', 0);
      rect(g, 360, 370, 180, 56, 6, '#c9a24a'); label(g, 'THE BOSS', 450, 400, 28, INK, 'Lilita One');
      rect(g, 70, 380, 80, 44, 10, INK, 0); rect(g, 80, 360, 60, 20, 8, '#3a3f5a', 3);
    } },
    scale: { n: 3, h: 600, slots: [lb(16, 450, 268, 96, 44), lb(316, 300, 268, 96, 44), [14, 8, 572, 116, 58, 't']], sample: ['ONE COMPLIMENT', 'THE ONE THING I SAID IN 2014', 'MY BRAIN AT NIGHT'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#efe6ff', '#d6c6ff');
      rect(g, 220, 540, 160, 40, 10, '#c9a24a'); rect(g, 290, 200, 20, 350, 6, '#c9a24a');
      g.save(); g.translate(300, 200); g.rotate(-0.42);
      rect(g, -200, -10, 400, 20, 8, '#e0b84a'); circ(g, 0, 0, 18, '#c9a24a');
      g.restore();
      const L = [300 - 200 * Math.cos(0.42), 200 + 200 * Math.sin(0.42)], R = [300 + 200 * Math.cos(0.42), 200 - 200 * Math.sin(0.42)];
      for (const [x, y] of [L, R]) { line(g, [x, y, x - 60, y + 110], INK, 3); line(g, [x, y, x + 60, y + 110], INK, 3); P(g, '#e0b84a', () => { g.ellipse(x, y + 110, 72, 22, 0, 0, Math.PI); g.closePath(); }); }
      P(g, '#fff', () => { g.moveTo(L[0] - 40, L[1] + 104); g.quadraticCurveTo(L[0], L[1] + 60, L[0] + 44, L[1] + 96); g.quadraticCurveTo(L[0], L[1] + 92, L[0] - 40, L[1] + 104); }, 3);
      line(g, [L[0] - 40, L[1] + 104, L[0] + 44, L[1] + 96], INK, 2);
      P(g, '#5a5f6e', () => { g.moveTo(R[0] - 50, R[1] + 108); g.lineTo(R[0] + 50, R[1] + 108); g.lineTo(R[0] + 36, R[1] + 70); g.lineTo(R[0] + 60, R[1] + 56); g.lineTo(R[0] - 60, R[1] + 56); g.lineTo(R[0] - 36, R[1] + 70); g.closePath(); });
      label(g, '100 KG', R[0], R[1] + 86, 18, '#fff', 'Lilita One');
    } },
    volcano: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['ME IGNORING', 'MY 300 UNREAD EMAILS'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#ff7a3a', '#ffcf6a');
      for (let k = 0; k < 6; k++) circ(g, 250 + k * 22, 120 - k * 18, 40 + k * 6, 'rgba(70,50,60,0.55)', 0);
      P(g, '#6a4a4a', () => { g.moveTo(80, 470); g.lineTo(250, 170); g.lineTo(350, 170); g.lineTo(520, 470); g.closePath(); });
      P(g, '#ff3b1f', () => { g.moveTo(250, 172); g.quadraticCurveTo(230, 260, 260, 320); g.quadraticCurveTo(290, 250, 300, 172); g.quadraticCurveTo(330, 280, 350, 172); g.closePath(); }, 3);
      for (const [x, y, r] of [[260, 120, 18], [320, 90, 22], [360, 140, 14], [230, 150, 12]]) circ(g, x, y, r, '#ff5a1f', 3);
      fillBg(g, 0, 430, 600, 170, '#7fcf6a', '#5fae4f');
      P(g, '#fff', () => { g.moveTo(150, 520); g.lineTo(450, 520); g.lineTo(490, 600); g.lineTo(110, 600); g.closePath(); }, 0);
      for (let x = 150; x < 470; x += 40) { g.fillStyle = 'rgba(232,36,60,0.8)'; g.beginPath(); g.moveTo(x, 520); g.lineTo(x + 20, 520); g.lineTo(x + 25 + (x - 300) * 0.13, 600); g.lineTo(x + 5 + (x - 300) * 0.13, 600); g.fill(); }
      dude(g, 300, 590, 0.82, { shirt: '#3d8bff', pants: '#3a3a5a', legs: 'sit', eyes: 'closed', mouth: 'grin', armR: [70, -220], elbowR: [90, -160], front: (h) => { rect(h, 50, -246, 50, 30, 8, '#f2c27a', 4); line(h, [54, -232, 96, -232], '#6dbb4a', 5); } });
    } },
    trophy: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['GOT A PRIZE', 'FOR SHOWING UP'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#8ab8ff', '#5a8ae6'); fillBg(g, 0, 460, 600, 140, '#e6b06a', '#c98a4a');
      rect(g, 360, 380, 200, 30, 6, '#8a5a3a');
      P(g, '#ffd23f', () => { g.moveTo(390, 150); g.lineTo(530, 150); g.quadraticCurveTo(530, 280, 470, 300); g.lineTo(470, 340); g.lineTo(510, 380); g.lineTo(410, 380); g.lineTo(450, 340); g.lineTo(450, 300); g.quadraticCurveTo(390, 280, 390, 150); g.closePath(); });
      P(g, null, () => { g.arc(386, 200, 34, Math.PI * 0.5, Math.PI * 1.5); }, 10); P(g, null, () => { g.arc(534, 200, 34, -Math.PI * 0.5, Math.PI * 0.5); }, 10);
      star(g, 460, 210, 26, '#fff7b0', 3);
      dude(g, 210, 590, 0.95, { shirt: '#e8243c', pants: '#3a3a5a', hair: 'spiky', hairC: '#3a2214', eyes: 'happy', mouth: 'grin', blush: true, armR: [70, -330], elbowR: [90, -250],
        front: (h) => { P(h, '#ffd23f', () => { h.moveTo(56, -370); h.lineTo(84, -370); h.lineTo(78, -352); h.lineTo(74, -346); h.lineTo(66, -346); h.lineTo(62, -352); h.closePath(); }, 3); } });
      for (const [x, y] of [[270, 210], [150, 250], [300, 300]]) sparkle(g, x, y, 12, '#fff38a');
    } },
    ship: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['ME, TWO HOURS INTO', 'A FIVE-MINUTE TASK'], draw(g) {
      fillBg(g, 0, 0, 600, 600, '#6a7a90', '#9aa8bb');
      cloud(g, 40, 120, 1.2, '#4a5568'); cloud(g, 360, 90, 1.4, '#4a5568');
      line(g, [500, 150, 470, 230, 500, 230, 460, 320], '#ffe14d', 6);
      g.save(); g.translate(300, 420); g.rotate(-0.38);
      P(g, '#c94a4a', () => { g.moveTo(-170, -10); g.lineTo(170, -10); g.lineTo(130, 70); g.lineTo(-130, 70); g.closePath(); });
      line(g, [0, -10, 0, -230], INK, 8); P(g, '#fff', () => { g.moveTo(6, -220); g.lineTo(120, -40); g.lineTo(6, -40); g.closePath(); });
      dude(g, -90, -8, 0.5, { shirt: '#fff', pants: '#2b3a6b', hair: 'none', eyes: 'closed', mouth: 'smile', armR: [40, -290], elbowR: [80, -230], hat: (h, x, y, r) => { P(h, '#fff', () => { h.ellipse(x, y - r * 0.7, r * 1.05, r * 0.45, 0, Math.PI, TAU); h.closePath(); }); rect(h, x - r * 0.9, y - r * 0.75, r * 1.8, r * 0.25, 6, INK, 0); } });
      g.restore();
      fillBg(g, 0, 440, 600, 160, '#2a6aa8', '#1a3f70');
      for (let x = 0; x < 640; x += 60) P(g, '#3a8ad6', () => { g.moveTo(x - 30, 444); g.quadraticCurveTo(x, 418, x + 30, 444); g.closePath(); }, 0);
      ell(g, 520, 520, 26, 14, '#ff8a3a', 3); poly(g, [544, 520, 560, 508, 560, 532], '#ff8a3a', 3); circ(g, 512, 516, 3, INK, 0);
    } },
    snowman: { n: 2, h: 600, slots: [TOP, BOT(600)], sample: ['ME IN AUGUST', '“IT’S A DRY HEAT”'], draw(g) {
      fillBg(g, 0, 0, 600, 380, '#5ac8ff', '#bfeaff'); fillBg(g, 0, 380, 600, 60, '#2a8ad6', '#3aa7e6'); fillBg(g, 0, 440, 600, 160, '#ffe3a0', '#f2c26a');
      circ(g, 510, 90, 56, '#ffe14d'); for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; line(g, [510 + Math.cos(a) * 66, 90 + Math.sin(a) * 66, 510 + Math.cos(a) * 86, 90 + Math.sin(a) * 86], '#ffe14d', 6); }
      eyes(g, 510, 84, 30, 7, 'shades'); mouth(g, 510, 104, 26, 'grin');
      ell(g, 280, 540, 170, 34, '#d9f2ff'); ell(g, 280, 490, 110, 70, '#fff'); ell(g, 270, 380, 74, 62, '#fff', 5, -0.1); circ(g, 286, 290, 54, '#fff');
      eyes(g, 286, 284, 44, 12, 'shades'); poly(g, [286, 300, 336, 310, 286, 314], '#ff8a2a', 3); mouth(g, 280, 322, 30, 'smile');
      drops(g, [[220, 340, 1], [340, 420, 1.1], [210, 460, 0.9]]);
      line(g, [326, 390, 410, 330], '#7a4a2a', 7);
      rect(g, 396, 300, 40, 50, 6, 'rgba(255,255,255,0.75)', 4); rect(g, 400, 318, 32, 28, 4, '#ff8a3a', 0); line(g, [426, 300, 446, 270], '#ff4f7a', 4); P(g, '#ff4f7a', () => { g.arc(446, 270, 18, Math.PI, TAU); g.closePath(); }, 3);
    } },
  };

  // ---------- captions ----------
  const CAPF = 'Impact, Anton, Haettenschweiler, "Arial Narrow Bold", "Arial Black", sans-serif';
  const HEADF = '600 30px "Fredoka", "Helvetica Neue", Arial, sans-serif';
  const mg = document.createElement('canvas').getContext('2d');
  function wrap(g, text, w) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (!cur || g.measureText(t).width <= w) cur = t; else { lines.push(cur); cur = wd; } }
    if (cur) lines.push(cur); return lines;
  }
  function caption(g, text, sl) {
    const [x, y, w, h, max, va] = sl; text = String(text).toUpperCase();
    let size = max, lines = [text];
    for (; size >= 12; size -= 2) { g.font = `${size}px ${CAPF}`; lines = wrap(g, text, w); if (lines.length * size * 1.06 <= h && lines.every((l) => g.measureText(l).width <= w)) break; }
    const lh = size * 1.06, total = lines.length * lh;
    let ty = va === 't' ? y : va === 'b' ? y + h - total : y + (h - total) / 2;
    g.textAlign = 'center'; g.textBaseline = 'top'; g.lineJoin = 'round'; g.miterLimit = 2;
    g.lineWidth = Math.max(4, size * 0.2); g.strokeStyle = '#000'; g.fillStyle = '#fff';
    for (const l of lines) { g.strokeText(l, x + w / 2, ty + size * 0.04); g.fillText(l, x + w / 2, ty + size * 0.04); ty += lh; }
  }
  function mark(g, sl, text, focus) {
    const [x, y, w, h] = sl;
    g.save(); g.setLineDash([12, 9]); g.lineWidth = focus ? 6 : 4;
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.beginPath(); rrp(g, x + 2, y + 2, w - 4, h - 4, 14); g.stroke();
    g.strokeStyle = focus ? '#ffe14d' : 'rgba(255,255,255,0.95)'; g.lineDashOffset = 4; g.beginPath(); rrp(g, x + 2, y + 2, w - 4, h - 4, 14); g.stroke();
    g.restore();
    if (focus) { g.fillStyle = 'rgba(255,225,77,0.18)'; g.beginPath(); rrp(g, x + 2, y + 2, w - 4, h - 4, 14); g.fill(); }
    if (text) { g.globalAlpha = 0.85; caption(g, text, [x + 8, y + 6, w - 16, h - 12, Math.min(34, sl[4] * 0.6), 'm']); g.globalAlpha = 1; }
  }
  const headLines = (text) => { mg.font = HEADF; return wrap(mg, text, 556); };
  const headH = (text) => (text ? 30 + headLines(text).length * 38 : 0);
  function fry(c, seed) {
    const g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height), a = d.data, r = rng(seed);
    for (let i = 0; i < a.length; i += 4) {
      let R = a[i], G = a[i + 1], B = a[i + 2]; const avg = (R + G + B) / 3;
      R = avg + (R - avg) * 2.4; G = avg + (G - avg) * 2.4; B = avg + (B - avg) * 2.4;
      R = (R - 128) * 1.6 + 150; G = (G - 128) * 1.5 + 118; B = (B - 128) * 1.4 + 70;
      const n = (r() - 0.5) * 70; a[i] = Math.round((R + n) / 40) * 40; a[i + 1] = Math.round((G + n) / 40) * 40; a[i + 2] = Math.round((B + n) / 40) * 40;
    }
    g.putImageData(d, 0, 0);
    const s = c.width / 600;
    g.font = `${Math.round(70 * s)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < 6; k++) g.fillText(['😂', '🔥', '👌', '💯', '😳', '🅱️'][k], (40 + r() * 520) * s, (60 + r() * (c.height / s - 120)) * s);
    for (let k = 0; k < 2; k++) { const x = (150 + r() * 300) * s, y = (150 + r() * 250) * s, rg = g.createRadialGradient(x, y, 0, x, y, 60 * s); rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.2, 'rgba(255,40,20,0.8)'); rg.addColorStop(1, 'rgba(255,0,0,0)'); g.fillStyle = rg; g.fillRect(x - 60 * s, y - 60 * s, 120 * s, 120 * s); }
  }
  // Draw a meme { tpl, caps, head } onto a canvas. o: { scale, canvas, marks, labels, focus, fried, stamp }
  function render(m, o = {}) {
    const tp = T[m.tpl] || T.fine, sc = o.scale || 1, hh = headH(m.head);
    const c = o.canvas || document.createElement('canvas');
    const W = Math.round(600 * sc), H = Math.round((tp.h + hh) * sc);
    if (c.width !== W) c.width = W; if (c.height !== H) c.height = H;
    const g = c.getContext('2d'); g.setTransform(sc, 0, 0, sc, 0, 0); g.clearRect(0, 0, 600, tp.h + hh);
    if (hh) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, 600, hh); g.font = HEADF; g.fillStyle = '#14121a'; g.textAlign = 'left'; g.textBaseline = 'top';
      headLines(m.head).forEach((l, i) => g.fillText(l, 22, 16 + i * 38));
    }
    g.save(); g.translate(0, hh); g.beginPath(); g.rect(0, 0, 600, tp.h); g.clip();
    try { tp.draw(g); } catch (e) { console.error(e); }
    g.restore();
    const caps = m.caps || [];
    g.save(); g.translate(0, hh);
    tp.slots.forEach((sl, i) => { const t = caps[i]; if (t) { caption(g, t, sl); if (o.marks && o.focus === i) mark(g, sl, '', true); } else if (o.marks) mark(g, sl, o.labels ? o.labels[i] : '', o.focus === i); });
    g.restore();
    if (o.fried) fry(c, hash(m.id || JSON.stringify(caps)));
    if (o.stamp) { g.setTransform(sc, 0, 0, sc, 0, 0); g.font = '600 15px "Fredoka", Arial, sans-serif'; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillStyle = 'rgba(255,255,255,0.8)'; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.strokeText('made in Meme Maker', 592, tp.h + hh - 6); g.fillText('made in Meme Maker', 592, tp.h + hh - 6); }
    return c;
  }
  const cache = new Map();
  function url(m, o = {}) {
    const k = JSON.stringify([m.tpl, m.caps, m.head || '', o.scale || 1, !!o.fried, !!o.marks, o.labels || 0]);
    let u = cache.get(k);
    if (!u) { u = render(m, o).toDataURL('image/jpeg', 0.88); if (cache.size > 160) cache.delete(cache.keys().next().value); cache.set(k, u); }
    return u;
  }
  function download(m, name, fried) {
    const c = render(m, { scale: 1.6, stamp: true, fried });
    const a = document.createElement('a'); a.download = (name || 'meme').replace(/[^\w-]+/g, '-').slice(0, 40) + '.png'; a.href = c.toDataURL('image/png');
    document.body.appendChild(a); a.click(); a.remove();
  }
  // Fonts that load late (Anton on phones without Impact): redraw anything cached.
  try { if (document.fonts) { document.fonts.load('40px Anton'); document.fonts.load(HEADF); document.fonts.addEventListener('loadingdone', () => cache.clear()); } } catch { /* fine */ }
  const samples = () => Object.keys(T).map((id) => ({ tpl: id, caps: T[id].sample || [] }));
  BOX.memes = { T, render, url, download, samples, ids: Object.keys(T), slots: (id) => (T[id] || T.fine).slots.length };

  // =====================================================================================
  //  Part 2: the game screens
  // =====================================================================================
  const { esc, timer } = BOX;
  const once = new Set();
  const first = (k) => { if (once.has(k)) return false; once.add(k); if (once.size > 400) once.clear(); return true; };
  const nm = (o) => (o ? (o.av ? esc(o.av) + ' ' : '') + esc(o.name) : '');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const tilt = (k, amp = 3) => (((hash(k) % 100) / 100) * 2 - 1) * amp;
  const PINS = ['#ff4f5a', '#ffd23f', '#3fa9ff', '#3ddc84', '#b77bff'];
  const pin = (k) => `<i class="mm-pin" style="--pc:${PINS[hash(k) % PINS.length]}"></i>`;
  const img = (m, scale, cls = '', extra = '') => `<img class="mm-img ${cls}" alt="meme" src="${url(m, { scale })}" ${extra}>`;
  const KIND_ICON = { free: '✏️', same: '👯', prompt: '💬', remix: '🔁', final: '👑' };

  // ---------- TV lobby: a corkboard; every setting is a meme printout you can tap ----------
  const LOBBY_TPL = { rounds: 'brain', seconds: 'fine', content: 'catplate', showIntro: 'shook' };
  let lobbyErr = '';
  function lobbyTv(el, L) {
    const n = L.players.length, need = Math.max(0, L.min - n), F = L.fields || [];
    const cards = F.map((f, i) => {
      const cur = f.options.find((o) => String(o.value) === String(L.settings[f.key])) || f.options[0];
      const tp = LOBBY_TPL[f.key] || BOX.memes.ids[(i * 7) % BOX.memes.ids.length], slots = T[tp].slots.length;
      const caps = slots === 4 ? ['', '', f.label, cur.label] : slots === 3 ? ['', '', ''] : [f.label, cur.label];
      if (slots === 3) caps[2] = f.label + ': ' + cur.label;
      return `<div role="button" tabindex="0" class="mm-print" data-rule="${esc(f.key)}" style="--tl:${tilt(f.key, 4).toFixed(1)}deg;--d:${i * 0.08}s">${pin(f.key)}
        <img class="mm-pimg" alt="" src="${url({ tpl: tp, caps }, 0.42)}">
        <span class="mm-plabel">${esc(f.label)}</span><span class="mm-pval">${esc(cur.label)}</span><span class="mm-ptap">tap to change ↻</span>
        <select data-set="${esc(f.key)}" tabindex="-1" aria-label="${esc(f.label)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
    }).join('');
    BOX.morph(el, `<div class="mm mm-cork mm-lobby">
      <section class="mm-joincard">${pin('join')}<div class="mm-jtitle">JOIN THE MEME TEAM</div>
        <div class="mm-qrwrap"><img id="qr" alt="QR code to join" src="${esc(L.qr)}"></div>
        <div class="mm-url">${esc(L.joinUrl.replace(/^https?:\/\//, ''))}</div>
        <div class="mm-codel">Room code</div><div class="mm-code" id="code">${esc(L.code)}</div>
        <div class="mm-vip">${L.vip ? `👑 <b>${esc(L.vip)}</b> is the host` : 'First to join is the host 👑'}</div></section>
      <section class="mm-center">
        <h1 class="mm-logo"><span>MEME</span><span>MAKER</span></h1>
        <div class="mm-sub">Caption the template. Make the room laugh. Win the vote.</div>
        <div class="mm-prints" id="settings">${cards}</div>
        <div class="mm-go"><button class="mm-start" id="start" ${need ? 'disabled' : ''}>🖼️ Start making memes</button>
          <div class="mm-err" id="lobby-err">${esc(lobbyErr)}</div>
          <div class="mm-need">${need ? `Need ${need} more player${need === 1 ? '' : 's'} to start` : `${plural(n, 'player')} ready · the host can start from their phone too`}</div>
          <div class="mm-links"><button class="mm-link" id="add-bots">+ add 5 test bots</button><button class="mm-link" id="rm-bots">remove bots</button><button class="mm-link" id="tv-switch">🎮 other game</button></div></div>
      </section>
      <section class="mm-cast"><div class="mm-casth">The meme team <b>${n}</b></div>
        <div class="mm-roster" id="roster">${L.players.map((p) => `<span class="chip mm-chip ${p.online ? '' : 'off'}" id="mmc-${esc(p.id)}" data-kick="${esc(p.id)}" title="Click to remove" style="--tl:${tilt(p.id, 5).toFixed(1)}deg">${pin(p.id)}<span class="mm-cav">${esc(p.avatar || '🙂')}</span><span class="mm-cnm">${esc(p.name)}</span>${p.bot ? '<small>bot</small>' : ''}</span>`).join('') || '<div class="mm-empty">Scan the code to join!<br>Your phone is your meme studio.</div>'}</div>
        ${L.lineupHtml ? `<div class="mm-lineup">${L.lineupHtml}</div>` : ''}</section>
    </div>`);
    for (const s of el.querySelectorAll('select[data-set]')) { s.onchange = () => L.set(s.dataset.set, s.value); s.onclick = (e) => e.stopPropagation(); }
    for (const b of el.querySelectorAll('[data-rule]')) b.onclick = () => { const s = b.querySelector('select'); s.selectedIndex = (s.selectedIndex + 1) % s.options.length; BOX.sfx('flip'); s.onchange(); };
    el.querySelector('#start').onclick = async () => { const r = await L.start(); lobbyErr = r && !r.ok ? r.error || 'Could not start.' : ''; const e = el.querySelector('#lobby-err'); if (e) e.textContent = lobbyErr; };
    el.querySelector('#add-bots').onclick = () => L.bots(5);
    el.querySelector('#rm-bots').onclick = () => L.removeBots();
    el.querySelector('#tv-switch').onclick = () => L.pick();
    for (const c of el.querySelectorAll('[data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) L.kick(c.dataset.kick); };
  }

  // ---------- TV ----------
  function scoreboard(list) {
    return `<aside class="mm-score">${pin('score')}<h3>Leaderboard</h3><div class="mm-rows">${(list || []).slice(0, 10).map((r, i) => `<div class="mm-row ${i === 0 && r.points > 0 ? 'lead' : ''}"><span class="mm-rk">${i === 0 && r.points > 0 ? '👑' : i + 1}</span><span class="mm-av">${esc(r.av || '🙂')}</span><span class="mm-nm">${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div></aside>`;
  }
  const topbar = (s) => `<header class="mm-top"><span class="mm-tag">${KIND_ICON[s.kind] || '🖼️'} ${esc(s.kindName)}</span>${s.final ? '' : `<span class="mm-tag dim">Round <b>${s.round}</b> of ${s.rounds - 1}</span>`}${s.endsIn && (s.phase === 'write' || s.phase === 'vote' || s.phase === 'semi') ? `<span class="mm-clock">⏱ ${timer(s.endsIn)}</span>` : ''}</header>`;

  function tvIntro(s) {
    const big = s.final ? 'MEME OF THE NIGHT' : `ROUND ${s.round}`;
    let show = '';
    if (s.kind === 'same' && s.sameTpl) show = `<div class="mm-introart">${img({ tpl: s.sameTpl, caps: [] }, 0.7, 'mm-pinned', `style="--tl:-2deg"`)}<div class="mm-cap">Everyone gets this one</div></div>`;
    else if (s.kind === 'prompt' && s.prompt) show = `<div class="mm-promptcard">${pin('p')}<small>Caption this situation</small><b>${esc(s.prompt)}</b></div>`;
    else if (s.kind === 'remix') show = `<div class="mm-remixart"><div class="mm-half">${img({ tpl: 'pointing', caps: ['', '', 'YOU START IT…'] }, 0.42, 'mm-pinned')}</div><div class="mm-arrow">➜</div><div class="mm-half">${img({ tpl: 'pointing', caps: ['THEY', 'FINISH IT', 'YOU START IT…'] }, 0.42, 'mm-pinned')}</div></div>`;
    else if (s.final) show = `<div class="mm-finalists">${(s.memes || []).map((m, i) => `<div class="mm-fin" style="--tl:${tilt(m.id, 4).toFixed(1)}deg;--d:${0.4 + i * 0.15}s">${pin(m.id)}${img(m, 0.36)}</div>`).join('')}</div>`;
    else show = `<div class="mm-introwall">${['fine', 'buttons', 'catplate', 'shook', 'duckboss'].map((t, i) => `<div class="mm-fin" style="--tl:${tilt(t, 5).toFixed(1)}deg;--d:${0.3 + i * 0.12}s">${pin(t)}${img({ tpl: t, caps: [] }, 0.3)}</div>`).join('')}</div>`;
    return `<div class="mm-intro ${s.final ? 'final' : ''}" id="mmi-${s.round}"><div class="mm-roundno">${big}</div><div class="mm-kindname">${KIND_ICON[s.kind] || ''} ${esc(s.kindName)}</div><div class="mm-blurb">${esc(s.blurb)}</div>${show}</div>`;
  }
  function tvWrite(s) {
    const hero = s.kind === 'same' && s.sameTpl ? `<div class="mm-hero">${img({ tpl: s.sameTpl, caps: [] }, 0.8, 'mm-pinned')}<div class="mm-cap">Same template, different jokes</div></div>`
      : s.kind === 'prompt' && s.prompt ? `<div class="mm-hero"><div class="mm-promptcard big">${pin('p')}<small>Caption this situation</small><b>${esc(s.prompt)}</b></div></div>`
        : s.kind === 'remix' ? `<div class="mm-hero"><div class="mm-promptcard big">${pin('r')}<small>${s.step === 1 ? 'Remix, part 1' : 'Remix, part 2'}</small><b>${s.step === 1 ? 'Write just the first half of your meme…' : 'Now finish somebody else’s meme!'}</b></div></div>`
          : `<div class="mm-hero"><div class="mm-promptcard big">${pin('f')}<small>Free caption</small><b>Everyone has their own template. Make it funny!</b></div></div>`;
    const left = s.writers - s.posted;
    return `<div class="mm-writing">${hero}<div class="mm-desk"><div class="mm-call">📱 Write your captions!</div><div class="mm-count"><b>${s.posted}</b> of ${s.writers} posted</div>
      ${s.hurry ? `<div class="mm-hurry">⏰ Hurry! Waiting on ${left} more…</div>` : ''}
      <div class="mm-polas">${s.table.map((p) => `<div class="mm-pola ${p.done ? 'done' : ''}" id="mmw-${esc(p.name)}-${p.done ? 1 : 0}" style="--tl:${tilt(p.name, 5).toFixed(1)}deg"><div class="mm-pface">${esc(p.av || '🙂')}</div><span>${esc(p.name)}</span>${p.done ? '<em>POSTED</em>' : '<i class="mm-dots"><b></b><b></b><b></b></i>'}</div>`).join('')}${s.tableMore ? `<div class="mm-pola more"><div class="mm-pface">+${s.tableMore}</div></div>` : ''}</div></div></div>`;
  }
  function tvParade(s) {
    const cur = s.memes[s.memes.length - 1], before = s.memes.slice(0, -1);
    if (!cur) return `<div class="mm-parade"><div class="mm-call">🖼️ Here come the memes…</div></div>`;
    return `<div class="mm-parade"><div class="mm-stagewrap"><div class="mm-counter">MEME ${s.memes.length} OF ${s.total}</div>
      <div class="mm-big" id="mmz-${esc(cur.id)}" style="--tl:${tilt(cur.id, 2.4).toFixed(1)}deg">${pin(cur.id)}${img(cur, 1.3)}</div></div>
      <div class="mm-strip">${before.slice(-7).map((m) => `<div class="mm-mini" id="mms-${esc(m.id)}" style="--tl:${tilt(m.id, 6).toFixed(1)}deg">${img(m, 0.3)}</div>`).join('')}</div></div>`;
  }
  function tvVote(s) {
    const n = s.memes.length;
    return `<div class="mm-voting"><div class="mm-callout">🗳️ Vote for the funniest on your phone! <b>${s.voted}</b> / ${s.voters} voted${s.notVoted.length && s.voted ? `<small>Waiting on: ${s.notVoted.map(esc).join(', ')}</small>` : ''}</div>
      <div class="mm-grid n${Math.min(n, 12)}">${s.memes.map((m, i) => `<div class="mm-gcard" id="mmv-${esc(m.id)}" style="--tl:${tilt(m.id, 2.5).toFixed(1)}deg;--d:${Math.min(i, 16) * 0.06}s"><span class="mm-num">${i + 1}</span>${img(m, n > 6 ? 0.55 : 0.75)}</div>`).join('')}</div></div>`;
  }
  function tvSemi(s) {
    return `<div class="mm-semi"><div class="mm-callout big">🏁 SEMI-FINAL! <span>So many memes! Vote on your phone. The top 8 make the big screen.</span><b>${s.voted} / ${s.voters} voted</b></div>
      <div class="mm-mosaic">${(s.wall || []).map((m, i) => `<div class="mm-tile" style="--tl:${tilt(m.id, 7).toFixed(1)}deg;--d:${(i % 20) * 0.05}s">${img(m, 0.28)}</div>`).join('')}${s.total > 40 ? `<div class="mm-tile more">+${s.total - 40}</div>` : ''}</div></div>`;
  }
  function tvResult(s) {
    const L = s.last; if (!L) return '';
    if (L.none) return `<div class="mm-result"><div class="mm-callout big">😶 Nobody posted a meme! Next round…</div></div>`;
    if (!L.winners.length) return `<div class="mm-result"><div class="mm-callout big">🤷 No votes this time!</div><div class="mm-others">${L.all.slice(0, 8).map((a) => `<div class="mm-ocard">${img(a, 0.4)}<div class="mm-by">${nm(a.by)}</div></div>`).join('')}</div></div>`;
    const wins = L.winners.map((w, i) => `<div class="mm-winner ${L.final ? 'gold' : ''}" style="--d:${i * 0.3}s">${pin(w.id)}${img(w, L.winners.length > 1 ? 0.75 : 1.05)}<div class="mm-stamp">${L.final ? 'MEME OF THE NIGHT' : 'WINNER'}</div>${w.unan ? '<div class="mm-stamp unan">UNANIMOUS!</div>' : ''}
      <div class="mm-credit">${nm(w.by)}${w.co ? ` <small>started by ${nm(w.co)}</small>` : ''}<span>${plural(w.votes, 'vote')}${L.final ? ' · +1000' : w.unan ? ' · +500 bonus' : ''}</span></div></div>`).join('');
    const others = L.all.filter((a) => !a.win);
    return `<div class="mm-result" id="mmr-${s.round}"><div class="mm-wins n${L.winners.length}">${wins}</div>
      ${others.length ? `<div class="mm-others">${others.slice(0, 6).map((a) => `<div class="mm-ocard" style="--tl:${tilt(a.id, 4).toFixed(1)}deg">${img(a, 0.32)}<div class="mm-by">${nm(a.by)}${a.co ? ' + ' + nm(a.co) : ''}<b>${a.votes} 🗳️</b></div></div>`).join('')}${others.length > 6 || L.more ? `<div class="mm-more">+${others.length - 6 + (L.more || 0)} more</div>` : ''}</div>` : ''}</div>`;
  }
  let gallery = [];
  function tvOver(el, s) {
    gallery = s.gallery || [];
    const w = s.standings[0];
    const awards = (s.awards || []).map((x, i) => `<div class="mm-award" style="--d:${0.8 + i * 0.2}s;--tl:${tilt(x.title, 3).toFixed(1)}deg">${pin(x.key)}<div class="ic">${x.icon}</div><div class="t">${esc(x.title)}</div><div class="n">${nm(x)}</div><div class="v">${esc(x.value)}</div>${x.key === 'fried' && x.meme ? `<img class="mm-fried" alt="deep-fried meme" src="${url(x.meme, { scale: 0.32, fried: true })}">` : ''}</div>`).join('');
    BOX.morph(el, `<div class="mm mm-cork mm-tv mm-over" data-phase="over"><section class="mm-overmain">
      <div class="mm-champ"><div class="mm-champl">Top meme lord</div><h2>${nm(w)}</h2>${w ? `<div class="mm-pts">${w.points} points</div>` : ''}</div>
      ${awards ? `<div class="mm-awards">${awards}</div>` : ''}
      <div class="mm-galh">🖼️ The gallery <small>click ⬇ to download a meme as a PNG</small></div>
      <div class="mm-gallery">${gallery.map((m, i) => `<figure class="mm-gal ${m.motn ? 'motn' : ''}" style="--tl:${tilt(m.id, 3).toFixed(1)}deg;--d:${0.2 + i * 0.07}s">${pin(m.id)}${img(m, 0.42)}<figcaption>${m.motn ? '👑 ' : m.win ? '🏆 ' : ''}${nm(m.by)}${m.co ? ' + ' + nm(m.co) : ''}<button class="mm-dl" data-dl="${esc(m.id)}" title="Download PNG">⬇</button></figcaption></figure>`).join('')}</div>
    </section>${scoreboard(s.standings)}</div>`);
    for (const b of el.querySelectorAll('[data-dl]')) b.onclick = () => { const m = gallery.find((x) => x.id === b.dataset.dl); if (m) BOX.memes.download(m, `meme-${m.by ? m.by.name : 'night'}`); BOX.sfx('pop'); };
  }
  function tv(el, s) {
    if (!s) return;
    if (s.phase === 'over') return tvOver(el, s);
    let body = '';
    if (s.phase === 'intro') body = tvIntro(s);
    else if (s.phase === 'write') body = tvWrite(s);
    else if (s.phase === 'pass') body = `<div class="mm-pass"><div class="mm-roundno">PASS IT ON!</div><div class="mm-spin">🔁</div><div class="mm-blurb">Your half-finished meme goes to someone else…</div></div>`;
    else if (s.phase === 'semi') body = tvSemi(s);
    else if (s.phase === 'parade') body = tvParade(s);
    else if (s.phase === 'vote') body = tvVote(s);
    else if (s.phase === 'result') body = tvResult(s);
    const side = s.phase === 'result' || s.phase === 'write';
    BOX.morph(el, `<div class="mm mm-cork mm-tv ${side ? 'side' : ''}" data-phase="${esc(s.phase)}"><section class="mm-main">${topbar(s)}<div class="mm-body" id="mmb-${s.round}-${esc(s.phase)}-${s.step}">${body}</div></section>${side ? scoreboard(s.standings) : ''}</div>`);
  }

  // ---------- phone ----------
  const drafts = {};
  let focus = -1, sendT = 0, voteRound = '';
  function preview(el, v, key) {
    const box = el.querySelector('.mm-prev'); if (!box) return;
    let c = box.querySelector('canvas'); if (!c) { c = document.createElement('canvas'); box.appendChild(c); }
    render({ tpl: v.card.tpl, caps: drafts[key], head: v.prompt || '' }, { canvas: c, scale: 1, marks: true, labels: v.slots, focus });
  }
  function phoneWrite(el, v, ctx) {
    const c = v.card, key = `${v.round}:${v.step}:${c.tpl}`;
    if (!drafts[key]) drafts[key] = c.caps.slice();
    const d = drafts[key];
    for (let i = 0; i < c.from; i++) d[i] = c.caps[i];
    if (first('turn:' + v.round + ':' + v.step)) ctx.haptic('turn');
    if (v.hurry && !c.done && first('hurry:' + v.round + ':' + v.step)) ctx.haptic('warn');
    const head = `<div class="mm-phtop"><span class="mm-ptag">${KIND_ICON[v.kind] || ''} ${esc(v.kindName)}</span><span class="mm-pround">Round ${v.round}/${v.rounds - 1}</span>${timer(v.endsIn)}</div>`;
    if (c.done) {
      BOX.morph(el, `<div class="mm mm-ph" data-phase="posted">${head}<div class="mm-posted"><div class="mm-pinned">${pin('mine')}${img({ tpl: c.tpl, caps: c.caps, head: v.prompt || '' }, 0.6)}</div><div class="mm-bigmsg">Posted! 🚀</div>
        <div class="mm-prog"><span style="width:${v.progress.of ? Math.round((v.progress.done / v.progress.of) * 100) : 0}%"></span></div><p class="mm-muted">${v.progress.done} / ${v.progress.of} posted · watch the TV</p></div></div>`);
      return;
    }
    const note = c.remix ? `<div class="mm-note">🔁 Finish <b>${esc(c.starter || 'someone')}</b>’s meme! Their half is locked in.</div>` : v.kind === 'remix' ? '<div class="mm-note">🔁 Write only the <b>first half</b>. Someone else finishes it!</div>' : v.kind === 'same' ? '<div class="mm-note">👯 Everyone has this same template. Out-joke them!</div>' : '';
    const fields = v.slots.map((lab, i) => {
      if (i < c.from) return `<div class="mm-locked"><small>${esc(lab)} · by ${esc(c.starter || 'them')}</small>${esc(c.caps[i] || '…')}</div>`;
      if (i >= c.upto) return `<div class="mm-locked later"><small>${esc(lab)}</small>Someone else writes this part</div>`;
      return `<label class="mm-field"><span>${esc(lab)}</span><input class="mm-in" id="mmin-${esc(key)}-${i}" data-slot="${i}" maxlength="60" value="${esc(d[i] || '')}" placeholder="${esc(lab)}…" autocomplete="off" autocapitalize="characters" enterkeyhint="next"></label>`;
    }).join('');
    const ready = d.slice(c.from, c.upto).some((x) => x && x.trim());
    BOX.morph(el, `<div class="mm mm-ph" data-phase="write">${head}
      ${v.prompt ? `<div class="mm-pbar"><small>Caption this:</small> ${esc(v.prompt)}</div>` : ''}${note}
      <div class="mm-prev" id="mmp-${esc(key)}" data-keep></div>
      <div class="mm-tname">🖼️ ${esc(v.tplName || '')}</div>
      <div class="mm-fields">${fields}</div>
      ${c.ideas && c.ideas.length && !c.remix ? `<div class="mm-ideas"><small>💡 Stuck? Tap an idea:</small>${c.ideas.map((t, i) => `<button class="mm-idea" data-idea="${i}">${esc(t)}</button>`).join('')}</div>` : ''}
      <div class="mm-acts">${c.canShuffle ? '<button class="mm-btn ghost" id="mm-shuf">🔀 New template <small>(once a round)</small></button>' : ''}<button class="mm-btn post ${ready ? 'ready' : ''}" id="mm-post" ${ready ? '' : 'disabled'}>Post it! 🚀</button></div></div>`);
    preview(el, v, key);
    const send = () => { clearTimeout(sendT); sendT = setTimeout(() => ctx.act({ op: 'draft', tpl: c.tpl, caps: drafts[key] }), 1200); };
    const postBtn = el.querySelector('#mm-post');
    for (const inp of el.querySelectorAll('.mm-in')) {
      const i = Number(inp.dataset.slot);
      inp.oninput = () => { d[i] = inp.value.slice(0, 60); preview(el, v, key); send(); const ok = d.slice(c.from, c.upto).some((x) => x && x.trim()); postBtn.disabled = !ok; postBtn.classList.toggle('ready', ok); };
      inp.onfocus = () => { focus = i; preview(el, v, key); };
      inp.onblur = () => { setTimeout(() => { if (!el.contains(document.activeElement) || !document.activeElement.classList.contains('mm-in')) { focus = -1; preview(el, v, key); } }, 50); };
      inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); const all = [...el.querySelectorAll('.mm-in')], k = all.indexOf(inp); if (all[k + 1]) all[k + 1].focus(); else inp.blur(); } };
    }
    for (const b of el.querySelectorAll('[data-idea]')) b.onclick = () => {
      const t = c.ideas[Number(b.dataset.idea)] || ''; let i = c.from; for (let k = c.from; k < c.upto; k++) if (!d[k]) { i = k; break; }
      d[i] = t.slice(0, 60); ctx.haptic('select'); send(); ctx.redraw();
    };
    const sh = el.querySelector('#mm-shuf'); if (sh) sh.onclick = async () => { const r = await ctx.act({ op: 'shuffle' }); if (r.ok) { ctx.haptic('success'); ctx.sfx('shuffle'); } };
    postBtn.onclick = async () => {
      clearTimeout(sendT);
      const r = await ctx.act({ op: 'post', tpl: c.tpl, caps: drafts[key] });
      if (r.ok) { ctx.haptic('success'); ctx.sfx('pop'); }
    };
  }
  function phoneVote(el, v, ctx) {
    const semi = v.phase === 'semi', rk = v.round + ':' + v.phase;
    if (first('vote:' + rk)) ctx.haptic('turn');
    if (voteRound !== rk) voteRound = rk;
    const canAny = v.ballot.some((b) => !b.mine);
    BOX.morph(el, `<div class="mm mm-ph" data-phase="vote"><div class="mm-phtop"><span class="mm-ptag">${semi ? '🏁 Semi-final' : v.final ? '👑 Meme of the Night' : '🗳️ Vote'}</span>${timer(v.endsIn)}</div>
      <div class="mm-hint">${!canAny ? 'All of these are yours! Sit back 😎' : v.myVote ? '✅ Vote cast! Tap another to change it.' : semi ? 'Your ballot: tap the funniest. The top 8 go to the TV.' : 'Tap the funniest meme (not your own).'}</div>
      <div class="mm-ballot">${v.ballot.map((m) => `<button class="mm-vote ${v.myVote === m.id ? 'sel' : ''} ${m.mine ? 'mine' : ''}" data-v="${esc(m.id)}" ${m.mine ? 'disabled' : ''}>${img(m, 0.5)}${m.mine ? '<span class="mm-yours">yours</span>' : ''}${v.myVote === m.id ? '<span class="mm-check">✅</span>' : ''}</button>`).join('')}</div></div>`);
    for (const b of el.querySelectorAll('[data-v]')) b.onclick = async () => { const r = await ctx.act({ op: 'vote', id: b.dataset.v }); if (r.ok) { ctx.haptic('select'); ctx.sfx('ballot'); } };
  }
  function phoneOver(el, v, ctx) {
    BOX.morph(el, `<div class="mm mm-ph" data-phase="over"><div class="mm-pcard mm-center"><div class="mm-rank">#${v.rank}</div><h3>${v.rank === 1 ? 'Top meme lord! 👑' : 'Game over!'}</h3><p class="mm-bigpts">${v.points} points</p>
      ${v.stats ? `<div class="mm-stats"><span>🖼️ ${plural(v.stats.memes, 'meme')}</span><span>🗳️ ${plural(v.stats.votes, 'vote')}</span><span>🏆 ${plural(v.stats.wins, 'round')} won</span></div>` : ''}
      ${(v.awards || []).map((a) => `<div class="mm-myaward">${a.icon} <b>${esc(a.title)}</b><small>${esc(a.value)}</small></div>`).join('')}</div>
      ${v.myBest ? `<div class="mm-label">Your best meme</div><div class="mm-pinned">${pin('best')}${img(v.myBest, 0.6)}</div>` : ''}
      <div class="mm-pcard">${(v.final10 || []).map((r, i) => `<div class="mm-row ${i === 0 ? 'lead' : ''}"><span class="mm-rk">${i === 0 ? '👑' : i + 1}</span><span class="mm-av">${esc(r.av || '🙂')}</span><span class="mm-nm">${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div></div>`);
    if (first('over:' + v.rank + ':' + v.points)) ctx.haptic(v.rank === 1 ? 'win' : 'big');
  }
  function phone(el, v, ctx) {
    if (!v) return;
    if (v.phase === 'over') return phoneOver(el, v, ctx);
    const top = (t) => `<div class="mm-phtop"><span class="mm-ptag">${KIND_ICON[v.kind] || ''} ${esc(v.kindName)}</span><span class="mm-pround">🏅 ${v.points} pts · #${v.rank || '-'}</span></div>${t || ''}`;
    if (v.phase === 'write' && v.card) return phoneWrite(el, v, ctx);
    if (v.phase === 'write') return BOX.morph(el, `<div class="mm mm-ph">${top()}<div class="mm-pcard mm-center"><div class="mm-emoji">⏳</div><h3>You’re in from the next round!</h3></div></div>`);
    if ((v.phase === 'vote' || v.phase === 'semi') && v.ballot.length) return phoneVote(el, v, ctx);
    if (v.phase === 'intro') {
      if (first('intro:' + v.round)) ctx.haptic('tap');
      return BOX.morph(el, `<div class="mm mm-ph" data-phase="intro">${top()}<div class="mm-pcard mm-center mm-roundcard"><div class="mm-emoji">${KIND_ICON[v.kind] || '🖼️'}</div><div class="mm-roundno sm">${v.final ? 'MEME OF THE NIGHT' : 'ROUND ' + v.round}</div><h3>${esc(v.kindName)}</h3><p>${esc(v.blurb)}</p>${v.final && v.inFinal ? '<p class="mm-note">🤫 One of yours made the final!</p>' : ''}</div></div>`);
    }
    if (v.phase === 'pass') return BOX.morph(el, `<div class="mm mm-ph">${top()}<div class="mm-pcard mm-center"><div class="mm-emoji mm-spin">🔁</div><h3>Passing memes around…</h3><p class="mm-muted">Get ready to finish someone else’s!</p></div></div>`);
    if (v.phase === 'parade' || v.phase === 'vote' || v.phase === 'semi') return BOX.morph(el, `<div class="mm mm-ph">${top()}<div class="mm-pcard mm-center"><div class="mm-emoji">👀</div><h3>Eyes on the TV!</h3><p class="mm-muted">${v.phase === 'parade' ? 'The memes are coming up one by one. Voting is next.' : 'Nothing to vote on for you this time.'}</p></div></div>`);
    if (v.phase === 'result' && v.last) {
      const r = v.myResult, won = !!(r && r.win), w = v.last.winners;
      if (first('res:' + v.round)) { if (won) { ctx.haptic('win'); ctx.sfx('win'); } else if (r && r.votes) ctx.haptic('success'); else ctx.haptic('tap'); }
      const msg = v.last.none ? 'Nobody posted this round.' : won ? (v.last.final ? '👑 MEME OF THE NIGHT!' : v.last.unan ? '🤝 UNANIMOUS WIN!' : '🏆 Your meme won!') : r ? `Your meme got ${plural(r.votes, 'vote')}.` : w.length ? `🏆 ${w.map((x) => nm(x.by)).join(' & ')} won!` : 'No votes this time!';
      return BOX.morph(el, `<div class="mm mm-ph" data-phase="result">${top()}<div class="mm-pcard mm-center ${won ? 'mm-won' : ''}"><h3>${msg}</h3></div>${w.slice(0, 1).map((m) => `<div class="mm-pinned">${pin(m.id)}${img(m, 0.6)}</div>`).join('')}</div>`);
    }
    BOX.morph(el, `<div class="mm mm-ph">${top()}<div class="mm-pcard mm-center"><div class="mm-emoji">🖼️</div><h3>Next round coming…</h3></div></div>`);
  }

  BOX.games.memes = {
    name: 'Meme Maker', icon: '🖼️',
    about: 'Caption original meme templates on your phone, then vote for the funniest on the big screen.',
    how: [
      'Every round your phone gets a meme template. Write the top and bottom text (or the labels) and watch it come together live.',
      'Rounds change it up: Free Caption, Same Template, Prompted situations, and Remix, where you finish someone else’s half-made meme.',
      'Stuck? Tap an idea, or swap your template once a round.',
      'The TV shows every meme, then everyone votes for the funniest. You can’t vote for your own! 100 points a vote, a bonus for winning, a big bonus for a unanimous win.',
      'The night ends with a Meme of the Night showdown, awards and a gallery you can download.',
    ],
    music: (s) => ({ intro: 'play', write: 'think', pass: 'play', semi: 'think', parade: 'play', vote: 'think', result: 'reveal', over: 'finale' }[s.phase] || 'play'),
    fx: { round: 'swell', write: 'pop', hurry: 'heartbeat', post: 'pop', pass: 'whoosh', semi: 'ballot', meme: 'flip', vote: 'gavel', ballot: 'ballot', reveal: 'drum', motn: 'drum', none: 'shrug', win: 'win' },
    onFx(f) { if (f.kind === 'reveal' || f.kind === 'motn') setTimeout(() => BOX.sfx(f.unan || f.kind === 'motn' ? 'swell' : 'cheer'), 1400); },
    lobbyTv,
    lobby: () => `<div class="mm mm-phlobby"><div class="mm-pinned">${pin('lob')}${img({ tpl: 'fine', caps: ['ME WAITING FOR', 'THE GAME TO START'] }, 0.55)}</div><p>Get your funniest thoughts ready…</p></div>`,
    tv, phone,
  };
})();
