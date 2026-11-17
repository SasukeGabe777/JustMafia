'use strict';
// Alien Abduction screens. Look: a cartoon spaceship cross-section (the starship Biscuit) in a
// purple deep-space night, neon goo-green aliens (the Gloop), chunky retro sci-fi type (Righteous).
// BOX.alienArt (below) draws everything on canvas and is shared by the title screen and the intro.
// TV: the ship flies across the screen with the crew inside its three rooms; the HUD shows the
// trip home, the systems, the phase card and the crew. Phone: a hidden role card (tap to peek),
// big station buttons, quick claims for the discussion, a vote grid, and private notes.
(function () {
  const { esc, mmss } = BOX;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const HEAD = '"Righteous", "Lilita One", sans-serif', BODY = '"Fredoka", system-ui, sans-serif';
  const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  try { if (document.fonts) document.fonts.load('40px "Righteous"'); } catch { /* fine */ }

  // =========================================================================================
  // BOX.alienArt: the cartoon kit (1920×1080 world, cover-fitted)
  // =========================================================================================
  function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function glow(g, x, y, r, col, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  function text(g, s, x, y, px, fill, o = {}) {
    g.save(); g.font = `${o.weight || ''} ${px}px ${o.font || HEAD}`; g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'middle';
    let k = 1; if (o.max) { const w = g.measureText(s).width; if (w > o.max) k = o.max / w; }
    g.translate(x, y); g.scale(k, k);
    if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.lw || px / 6; g.strokeStyle = o.stroke; g.strokeText(s, 0, 0); }
    g.fillStyle = fill; g.fillText(s, 0, 0); g.restore();
  }
  const emo = new Map();
  function emoji(g, e, x, y, px) {
    const q = Math.max(16, Math.round(px / 8) * 8), key = e + '|' + q;
    let c = emo.get(key);
    if (!c) { c = document.createElement('canvas'); c.width = c.height = Math.ceil(q * 1.3); const x2 = c.getContext('2d'); x2.font = `${q}px ${EMOJI}`; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(e, c.width / 2, c.height / 2 + q * 0.06); emo.set(key, c); if (emo.size > 300) emo.delete(emo.keys().next().value); }
    const s = px / q; g.drawImage(c, x - (c.width * s) / 2, y - (c.height * s) / 2, c.width * s, c.height * s);
  }
  function cover(g, w, h, d) { const sc = Math.max(w / 1920, h / 1080); g.setTransform(d * sc, 0, 0, d * sc, d * (w - 1920 * sc) / 2, d * (h - 1080 * sc) / 2); return sc; }
  // seeded stars (x, y, depth, size, phase)
  const srand = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const R0 = srand(4242);
  const STARS = Array.from({ length: 260 }, () => ({ x: R0() * 2400 - 240, y: R0() * 1300 - 110, z: 0.2 + R0() * 0.8, r: 0.8 + R0() * 2.2, p: R0() * TAU }));
  const NEB = [[420, 260, 520, '150,70,255'], [1500, 820, 620, '40,200,220'], [1200, 160, 420, '255,90,190']];
  function space(g, t, o = {}) {
    const bg = g.createLinearGradient(0, -100, 0, 1180); bg.addColorStop(0, '#05021a'); bg.addColorStop(0.55, '#140838'); bg.addColorStop(1, '#250d4a');
    g.fillStyle = bg; g.fillRect(-400, -300, 2720, 1700);
    for (const [x, y, r, c] of NEB) glow(g, x + Math.sin(t * 0.05 + x) * 40, y + Math.cos(t * 0.04 + y) * 30, r, `rgba(${c},A)`, 0.16);
    const warp = o.warp || 0, speed = o.speed == null ? 40 : o.speed;
    g.save();
    for (const s of STARS) {
      const x = ((s.x - t * speed * s.z * (1 + warp * 30)) % 2400 + 2400) % 2400 - 240;
      const tw = 0.55 + 0.45 * Math.sin(t * 2 + s.p);
      if (warp > 0.02) { g.strokeStyle = `rgba(220,230,255,${0.4 + 0.5 * s.z})`; g.lineWidth = s.r; g.beginPath(); g.moveTo(x, s.y); g.lineTo(x + warp * 420 * s.z, s.y); g.stroke(); }
      else { g.globalAlpha = tw * (0.4 + 0.6 * s.z); g.fillStyle = s.z > 0.85 ? '#fff6d8' : '#cfd8ff'; g.beginPath(); g.arc(x, s.y, s.r * s.z, 0, TAU); g.fill(); }
    }
    g.restore();
    if (o.planet !== false) ringPlanet(g, 1580, 190, 70, t);
  }
  function ringPlanet(g, x, y, r, t) {
    g.save(); g.translate(x, y); g.rotate(-0.35);
    g.strokeStyle = 'rgba(255,200,140,0.55)'; g.lineWidth = 10; g.beginPath(); g.ellipse(0, 0, r * 1.9, r * 0.45, 0, Math.PI, TAU); g.stroke();
    const pg = g.createLinearGradient(-r, -r, r, r); pg.addColorStop(0, '#ffb36b'); pg.addColorStop(1, '#a8406a');
    g.fillStyle = pg; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; for (let i = -2; i <= 2; i++) g.fillRect(-r, i * r * 0.32 - 4, r * 2, 7);
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.strokeStyle = 'rgba(0,0,0,0)'; g.stroke();
    g.strokeStyle = 'rgba(255,220,170,0.8)'; g.lineWidth = 10; g.beginPath(); g.ellipse(0, 0, r * 1.9, r * 0.45, 0, 0, Math.PI); g.stroke();
    g.restore();
  }
  function homePlanet(g, x, y, r, t) {
    glow(g, x, y, r * 1.5, 'rgba(110,190,255,A)', 0.45);
    g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
    const sea = g.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r); sea.addColorStop(0, '#5fd0ff'); sea.addColorStop(1, '#1b4fb0');
    g.fillStyle = sea; g.fillRect(x - r, y - r, r * 2, r * 2);
    const R = srand(77); g.fillStyle = '#5cd36a';
    for (let i = 0; i < 9; i++) { const lx = x - r + (((R() * 2 * r + t * 14) % (2.6 * r)) - 0.3 * r), ly = y - r * 0.7 + R() * r * 1.4, lr = r * (0.12 + R() * 0.2); g.beginPath(); g.ellipse(lx, ly, lr * 1.4, lr, R() * 3, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 7; i++) { const cx = x - r + (((R() * 2 * r + t * 26) % (2.6 * r)) - 0.3 * r), cy = y - r * 0.8 + R() * r * 1.6; g.beginPath(); g.ellipse(cx, cy, r * 0.2, r * 0.05, 0, 0, TAU); g.fill(); }
    const sh = g.createLinearGradient(x - r, y, x + r, y); sh.addColorStop(0, 'rgba(0,0,30,0)'); sh.addColorStop(1, 'rgba(0,0,30,0.45)'); g.fillStyle = sh; g.fillRect(x - r, y - r, r * 2, r * 2);
    g.restore();
  }
  // A crew member: chunky suit, bubble helmet with the player's avatar inside. Feet at (x, y).
  function astro(g, x, y, sc, t, o = {}) {
    const col = o.color || '#ff8a4d', ph = o.ph || 0, pose = o.pose || 'idle';
    g.save(); g.translate(x, y); g.scale(sc, sc);
    if (o.alpha != null) g.globalAlpha *= o.alpha;
    const bob = pose === 'float' ? Math.sin(t * 1.6 + ph) * 10 : pose === 'walk' ? Math.abs(Math.sin(t * 8 + ph)) * -8 : Math.sin(t * 2.2 + ph) * 3;
    if (pose === 'float') g.rotate(Math.sin(t * 0.9 + ph) * 0.35);
    g.translate(0, bob);
    const ink = '#1d1036';
    g.lineJoin = 'round'; g.lineCap = 'round';
    if (o.ghost) {
      g.globalAlpha *= 0.55;
      g.fillStyle = '#d9ccff'; g.beginPath(); g.moveTo(-42, -100);
      for (let i = 0; i <= 6; i++) { const xx = -42 + i * 14, yy = -10 + Math.sin(t * 5 + i + ph) * 8; g.lineTo(xx, yy); }
      g.lineTo(42, -100); g.closePath(); g.fill();
    } else {
      // legs + boots
      const sw = pose === 'walk' ? Math.sin(t * 8 + ph) * 10 : 0;
      for (const [lx, d] of [[-17, sw], [17, -sw]]) { g.fillStyle = col; rr(g, lx - 12 + d * 0.3, -46, 24, 40, 10); g.fill(); g.strokeStyle = ink; g.lineWidth = 6; g.stroke(); g.fillStyle = '#3b2a5c'; rr(g, lx - 15 + d * 0.3, -14, 30, 16, 7); g.fill(); }
    }
    // backpack
    g.fillStyle = '#c9c2d9'; rr(g, -58, -112, 26, 64, 10); g.fill(); g.strokeStyle = ink; g.lineWidth = 6; g.stroke();
    // body
    g.fillStyle = o.ghost ? '#e8e0ff' : col; rr(g, -44, -118, 88, 82, 32); g.fill(); g.strokeStyle = ink; g.lineWidth = 7; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.85)'; rr(g, -20, -96, 40, 26, 8); g.fill();
    for (let i = 0; i < 3; i++) { g.fillStyle = ['#ff4d6d', '#ffd23f', '#3ee6c1'][i]; g.beginPath(); g.arc(-10 + i * 10, -83, 4, 0, TAU); g.fill(); }
    // arms
    const arm = (sx, side) => {
      let hx = sx + side * 18, hy = -60 + Math.sin(t * 2 + ph) * 2;
      if (pose === 'wave' && side > 0) { hx = sx + 34; hy = -170 + Math.sin(t * 9 + ph) * 16; }
      if (pose === 'cheer') { hx = sx + side * 34; hy = -178 + Math.sin(t * 7 + ph + side) * 8; }
      if (pose === 'float') { hx = sx + side * 40; hy = -130; }
      if (pose === 'work' && side > 0) { hx = sx + 38; hy = -92 + Math.sin(t * 14 + ph) * 12; }
      g.strokeStyle = ink; g.lineWidth = 26; g.beginPath(); g.moveTo(sx, -100); g.lineTo(hx, hy); g.stroke();
      g.strokeStyle = o.ghost ? '#e8e0ff' : col; g.lineWidth = 16; g.beginPath(); g.moveTo(sx, -100); g.lineTo(hx, hy); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(hx, hy, 12, 0, TAU); g.fill(); g.lineWidth = 5; g.strokeStyle = ink; g.stroke();
      if (pose === 'work' && side > 0) { g.save(); g.translate(hx, hy); g.rotate(-0.6 + Math.sin(t * 14 + ph) * 0.4); g.fillStyle = '#b8c4d6'; rr(g, -4, -30, 8, 32, 3); g.fill(); g.beginPath(); g.arc(0, -32, 10, 0, TAU); g.fill(); g.restore(); }
    };
    arm(-40, -1); arm(40, 1);
    // helmet
    const hy = -168;
    if (o.alien) { // the disguise slips: antennae poke out of the helmet
      for (const s of [-1, 1]) { g.strokeStyle = '#3fbf3a'; g.lineWidth = 7; g.beginPath(); g.moveTo(s * 20, hy - 40); g.quadraticCurveTo(s * 34, hy - 80, s * 28 + Math.sin(t * 4 + s) * 6, hy - 96); g.stroke(); g.fillStyle = '#b6ff5a'; g.beginPath(); g.arc(s * 28 + Math.sin(t * 4 + s) * 6, hy - 98, 10, 0, TAU); g.fill(); }
    }
    g.fillStyle = o.alien ? '#2d6b2a' : '#20134a'; g.beginPath(); g.arc(0, hy, 56, 0, TAU); g.fill();
    if (o.avatar) emoji(g, o.avatar, 0, hy + 4, 70);
    if (o.alien) { g.fillStyle = 'rgba(120,255,90,0.35)'; g.beginPath(); g.arc(0, hy, 56, 0, TAU); g.fill(); }
    const gl = g.createLinearGradient(-50, hy - 50, 40, hy + 50); gl.addColorStop(0, 'rgba(200,240,255,0.55)'); gl.addColorStop(0.5, 'rgba(200,240,255,0.08)'); gl.addColorStop(1, 'rgba(200,240,255,0.2)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, hy, 56, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 6; g.beginPath(); g.arc(0, hy, 42, -2.6, -1.9); g.stroke();
    g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.arc(0, hy, 56, 0, TAU); g.stroke();
    g.fillStyle = '#c9c2d9'; rr(g, -34, hy + 46, 68, 16, 8); g.fill(); g.strokeStyle = ink; g.lineWidth = 5; g.stroke();
    if (o.alien) { g.fillStyle = '#7dff6a'; for (let i = 0; i < 3; i++) { const dx = -28 + i * 26, dl = 10 + ((t * 30 + i * 17) % 26); g.beginPath(); g.ellipse(dx, -118 + dl, 6, 9, 0, 0, TAU); g.fill(); } }
    g.restore();
  }
  // One of the Gloop: a wobbly neon blob with three eyes. Bottom at (x, y).
  function gloop(g, x, y, sc, t, o = {}) {
    const ph = o.ph || 0;
    g.save(); g.translate(x, y); g.scale(sc, sc);
    if (o.alpha != null) g.globalAlpha *= o.alpha;
    const sq = 1 + Math.sin(t * 3 + ph) * 0.05;
    g.scale(1 / sq, sq);
    for (const s of [-1, 1]) { const tx = s * 34 + Math.sin(t * 3 + ph + s) * 10, ty = -190 + Math.cos(t * 2 + s) * 6; g.strokeStyle = '#2f8a2a'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * 20, -120); g.quadraticCurveTo(s * 40, -160, tx, ty); g.stroke(); glow(g, tx, ty, 30, 'rgba(200,255,120,A)', 0.6); g.fillStyle = '#e8ff7a'; g.beginPath(); g.arc(tx, ty, 11, 0, TAU); g.fill(); }
    const body = g.createRadialGradient(-20, -100, 10, 0, -70, 110); body.addColorStop(0, '#c8ff8a'); body.addColorStop(0.6, '#62e04a'); body.addColorStop(1, '#2f9a32');
    g.fillStyle = body; g.beginPath();
    for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU, rad = 78 + Math.sin(a * 3 + t * 4 + ph) * 5 + (Math.sin(a) > 0.6 ? 6 : 0); const px = Math.cos(a) * rad, py = -72 + Math.sin(a) * rad * 0.92; if (i) g.lineTo(px, Math.min(py, 0)); else g.moveTo(px, Math.min(py, 0)); }
    g.closePath(); g.fill(); g.strokeStyle = '#1d5a1a'; g.lineWidth = 7; g.stroke();
    // drips
    g.fillStyle = '#62e04a'; for (let i = 0; i < 3; i++) { const dx = -40 + i * 40, dl = 6 + ((t * 18 + i * 11 + ph * 9) % 18); g.beginPath(); g.ellipse(dx, dl - 4, 7, 10, 0, 0, TAU); g.fill(); }
    // eyes
    const look = Math.sin(t * 0.9 + ph) * 6;
    for (const [ex, ey, er] of [[-30, -95, 18], [8, -112, 22], [38, -88, 15]]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, ey, er, 0, TAU); g.fill(); g.strokeStyle = '#1d5a1a'; g.lineWidth = 4; g.stroke(); const bl = Math.sin(t * 1.3 + ex) > 0.97 ? 0.15 : 1; g.fillStyle = '#1a0b2a'; g.beginPath(); g.ellipse(ex + look * 0.6, ey + 2, er * 0.45, er * 0.5 * bl, 0, 0, TAU); g.fill(); }
    g.strokeStyle = '#1a3d14'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.arc(4, -58, 24, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    if (o.wave) { g.strokeStyle = '#62e04a'; g.lineWidth = 16; g.beginPath(); g.moveTo(70, -70); g.lineTo(110, -120 + Math.sin(t * 8) * 18); g.stroke(); }
    g.restore();
  }
  function saucer(g, x, y, sc, t, o = {}) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    if (o.beam) {
      const len = o.beamLen || 700, k = o.beam;
      const bg = g.createLinearGradient(0, 30, 0, len); bg.addColorStop(0, `rgba(170,255,120,${0.55 * k})`); bg.addColorStop(1, `rgba(170,255,120,${0.05 * k})`);
      g.fillStyle = bg; g.beginPath(); g.moveTo(-70, 30); g.lineTo(70, 30); g.lineTo(240, len); g.lineTo(-240, len); g.closePath(); g.fill();
      g.strokeStyle = `rgba(220,255,180,${0.35 * k})`; g.lineWidth = 3; for (let i = 0; i < 5; i++) { const yy = 30 + (((t * 260 + i * len / 5) % len)); const w = 70 + (170 * (yy - 30)) / len; g.beginPath(); g.ellipse(0, yy, w, 14, 0, 0, TAU); g.stroke(); }
    }
    glow(g, 0, 0, 260, 'rgba(150,255,120,A)', 0.18);
    g.fillStyle = 'rgba(170,240,255,0.55)'; g.beginPath(); g.ellipse(0, -18, 92, 88, 0, Math.PI, TAU); g.fill();
    if (!o.empty) gloop(g, 0, -10, 0.55, t, { ph: 1 });
    g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.ellipse(-36, -70, 16, 26, -0.5, 0, TAU); g.fill();
    g.strokeStyle = '#1d1036'; g.lineWidth = 7; g.beginPath(); g.ellipse(0, -18, 92, 88, 0, Math.PI, TAU); g.stroke();
    const disc = g.createLinearGradient(0, -30, 0, 40); disc.addColorStop(0, '#e9e6f5'); disc.addColorStop(0.5, '#9b95b8'); disc.addColorStop(1, '#5a5378');
    g.fillStyle = disc; g.beginPath(); g.ellipse(0, 0, 230, 52, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#4a4466'; g.beginPath(); g.ellipse(0, 22, 120, 22, 0, 0, Math.PI); g.fill();
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI, lx = Math.cos(a) * -200, ly = 10 + Math.sin(a) * 26; const on = (Math.floor(t * 8) + i) % 3 === 0; g.fillStyle = on ? '#fff36a' : ['#ff5aa0', '#5ae0ff', '#a6ff5a'][i % 3]; g.beginPath(); g.arc(lx, ly, on ? 11 : 8, 0, TAU); g.fill(); }
    g.restore();
  }
  // The starship Biscuit, side view, cut away to show its three rooms. Centre at (x, y).
  const ROOMS = [['engines', -555, '#3a1830', '#6a2840', '🔥 ENGINES'], ['oxygen', -175, '#0f3a34', '#1d6450', '🫧 AIR GARDEN'], ['shields', 205, '#141f50', '#25418a', '🛡️ SHIELD DOME']];
  const ROOM_W = 330, ROOM_H = 236, ROOM_Y = -118;
  function roomOf(key) { const r = ROOMS.find((x) => x[0] === key) || ROOMS[1]; return { x: r[1], y: ROOM_Y, w: ROOM_W, h: ROOM_H, cx: r[1] + ROOM_W / 2, floor: ROOM_Y + ROOM_H - 16 }; }
  function shipHull(g) {
    g.beginPath(); g.moveTo(-600, -160); g.lineTo(420, -160); g.bezierCurveTo(650, -160, 760, -50, 760, 0); g.bezierCurveTo(760, 50, 650, 160, 420, 160);
    g.lineTo(-600, 160); g.quadraticCurveTo(-650, 160, -650, 110); g.lineTo(-650, -110); g.quadraticCurveTo(-650, -160, -600, -160); g.closePath();
  }
  function ship(g, x, y, sc, t, o = {}) {
    const hp = o.hp || { oxygen: 3, engines: 3, shields: 3 }, max = o.hpMax || 3, ink = '#1d1036';
    const shake = o.shake ? Math.sin(t * 60) * o.shake * 10 : 0;
    g.save(); g.translate(x + shake, y + Math.sin(t * 1.4) * 8 + (o.shake ? Math.cos(t * 47) * o.shake * 6 : 0)); g.scale(sc, sc); g.rotate(Math.sin(t * 0.8) * 0.012 + (o.tilt || 0));
    // shield bubble
    const sh = clamp(hp.shields / max);
    if (sh > 0) { g.save(); g.globalAlpha = 0.12 + 0.18 * sh; g.strokeStyle = '#7fe6ff'; g.lineWidth = 6; g.setLineDash([30, 18]); g.lineDashOffset = -t * 40; g.beginPath(); g.ellipse(40, 0, 860, 330, 0, 0, TAU); g.stroke(); g.restore(); g.save(); g.globalAlpha = 0.06 * sh; g.fillStyle = '#7fe6ff'; g.beginPath(); g.ellipse(40, 0, 860, 330, 0, 0, TAU); g.fill(); g.restore(); }
    // flame
    const en = clamp(hp.engines / max), fl = (140 + 140 * en) * (1 + (o.jump || 0) * 2.5) * (0.9 + 0.1 * Math.sin(t * 30));
    if (en > 0 || o.jump) for (const [w, c] of [[110, 'rgba(255,90,60,0.9)'], [80, 'rgba(255,190,70,0.95)'], [44, 'rgba(255,250,210,1)']]) { g.fillStyle = c; g.beginPath(); g.moveTo(-720, -w / 2); g.quadraticCurveTo(-720 - fl * 0.6, -w * 0.7, -720 - fl * (w / 110), 0); g.quadraticCurveTo(-720 - fl * 0.6, w * 0.7, -720, w / 2); g.closePath(); g.fill(); }
    else { for (let i = 0; i < 4; i++) { const k = ((t * 0.6 + i / 4) % 1); g.fillStyle = `rgba(120,110,140,${0.5 * (1 - k)})`; g.beginPath(); g.arc(-740 - k * 160, Math.sin(i + t) * 20, 26 + k * 40, 0, TAU); g.fill(); } }
    // fins
    for (const s of [-1, 1]) { g.fillStyle = '#ff6b6b'; g.beginPath(); g.moveTo(-600, s * 150); g.lineTo(-700, s * 300); g.lineTo(-610, s * 300); g.lineTo(-400, s * 150); g.closePath(); g.fill(); g.strokeStyle = ink; g.lineWidth = 10; g.lineJoin = 'round'; g.stroke(); }
    // nozzle
    g.fillStyle = '#5a5378'; g.beginPath(); g.moveTo(-645, -86); g.lineTo(-725, -116); g.lineTo(-725, 116); g.lineTo(-645, 86); g.closePath(); g.fill(); g.strokeStyle = ink; g.lineWidth = 9; g.stroke();
    // dome on top of the shield room
    g.fillStyle = 'rgba(160,230,255,0.4)'; g.beginPath(); g.ellipse(370, -158, 120, 105, 0, Math.PI, TAU); g.fill(); g.strokeStyle = ink; g.lineWidth = 9; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 7; g.beginPath(); g.ellipse(370, -158, 90, 78, 0, Math.PI * 1.15, Math.PI * 1.45); g.stroke();
    g.strokeStyle = ink; g.lineWidth = 6; g.beginPath(); g.moveTo(370, -263); g.lineTo(370, -310); g.stroke(); g.fillStyle = Math.sin(t * 5) > 0 ? '#ff4d6d' : '#ffd23f'; g.beginPath(); g.arc(370, -316, 12, 0, TAU); g.fill();
    // hull
    const hg = g.createLinearGradient(0, -160, 0, 160); hg.addColorStop(0, '#fff8ea'); hg.addColorStop(0.55, '#efe2c8'); hg.addColorStop(1, '#c9b392');
    g.fillStyle = hg; shipHull(g); g.fill(); g.strokeStyle = ink; g.lineWidth = 11; g.stroke();
    g.save(); shipHull(g); g.clip();
    g.fillStyle = '#36d6c3'; g.fillRect(-700, 122, 1500, 16); g.fillStyle = '#ff6b6b'; g.fillRect(-700, 140, 1500, 8);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = -600; i < 700; i += 60) { g.beginPath(); g.arc(i, -144, 4, 0, TAU); g.fill(); }
    g.restore();
    // nose portholes + name
    for (const [px, py, pr] of [[600, -30, 30], [660, 40, 20]]) { g.fillStyle = '#20134a'; g.beginPath(); g.arc(px, py, pr, 0, TAU); g.fill(); g.strokeStyle = ink; g.lineWidth = 7; g.stroke(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(px - pr * 0.3, py - pr * 0.3, pr * 0.3, 0, TAU); g.fill(); }
    text(g, 'BISCUIT', -620, -228, 34, '#fff8ea', { stroke: ink, lw: 8 });
    // the rooms
    for (const [key, rx, c1, c2, label] of ROOMS) {
      const R = roomOf(key), alarm = o.alarm === key, h = hp[key] == null ? max : hp[key];
      g.save(); rr(g, rx, ROOM_Y, ROOM_W, ROOM_H, 26); g.clip();
      const ig = g.createLinearGradient(0, ROOM_Y, 0, ROOM_Y + ROOM_H); ig.addColorStop(0, c2); ig.addColorStop(1, c1); g.fillStyle = ig; g.fillRect(rx, ROOM_Y, ROOM_W, ROOM_H);
      roomProps(g, key, R, t, h / max);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(rx, R.floor, ROOM_W, 30);
      // crew inside this room
      const here = (o.crew || []).filter((c) => c.room === key);
      here.forEach((c, i) => { const n = here.length, px = R.cx + (n === 1 ? 0 : (i - (n - 1) / 2) * Math.min(80, (ROOM_W - 70) / Math.max(1, n - 1))); astro(g, px, R.floor + 6, n > 4 ? 0.42 : 0.5, t, { color: c.color, avatar: c.avatar, pose: c.pose || (alarm && o.working ? 'work' : 'idle'), ph: i * 1.7 + rx }); });
      if (alarm) { g.fillStyle = `rgba(255,40,70,${0.18 + 0.16 * Math.sin(t * 8)})`; g.fillRect(rx, ROOM_Y, ROOM_W, ROOM_H); }
      if (o.boom && o.boom.room === key) { const k = o.boom.k; if (k > 0 && k < 1) { glow(g, R.cx, R.y + R.h / 2, 260 * easeOut(k * 2), 'rgba(255,170,60,A)', 0.9 * (1 - k)); } }
      if (o.fixed && o.fixed.room === key) { const k = o.fixed.k; if (k > 0 && k < 1) glow(g, R.cx, R.y + R.h / 2, 240, 'rgba(120,255,160,A)', 0.6 * Math.sin(k * Math.PI)); }
      g.restore();
      g.strokeStyle = ink; g.lineWidth = 10; rr(g, rx, ROOM_Y, ROOM_W, ROOM_H, 26); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 4; rr(g, rx + 8, ROOM_Y + 8, ROOM_W - 16, ROOM_H - 16, 20); g.stroke();
      // cracks for lost HP
      const lost = max - h;
      g.strokeStyle = '#1d1036'; g.lineWidth = 5;
      for (let i = 0; i < lost; i++) { const cx = rx + 40 + ((i * 97) % (ROOM_W - 80)), cy = ROOM_Y + 30 + ((i * 53) % 80); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 18, cy + 22); g.lineTo(cx + 6, cy + 40); g.lineTo(cx + 26, cy + 62); g.stroke(); g.beginPath(); g.moveTo(cx + 18, cy + 22); g.lineTo(cx + 40, cy + 18); g.stroke(); }
      // smoke + sparks when hurting
      if (lost >= 1) for (let i = 0; i < lost + 1; i++) { const k = (t * 0.5 + i / (lost + 1)) % 1; g.fillStyle = `rgba(90,80,110,${0.45 * (1 - k)})`; g.beginPath(); g.arc(R.cx - 60 + i * 50 + Math.sin(t + i) * 14, ROOM_Y - 20 - k * 160, 18 + k * 36, 0, TAU); g.fill(); }
      if (lost >= 2 && Math.sin(t * 7 + rx) > 0.6) for (let i = 0; i < 6; i++) { g.strokeStyle = '#ffd23f'; g.lineWidth = 4; const a = (i / 6) * TAU + t * 5, sx = rx + ROOM_W - 30, sy = ROOM_Y + 30; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.cos(a) * 30, sy + Math.sin(a) * 30); g.stroke(); }
      // the label plate
      g.fillStyle = alarm ? (Math.sin(t * 8) > 0 ? '#ff4d6d' : '#8a1030') : '#2a1a52'; rr(g, R.cx - 120, ROOM_Y - 52, 240, 42, 14); g.fill(); g.strokeStyle = ink; g.lineWidth = 5; g.stroke();
      text(g, label, R.cx, ROOM_Y - 30, 24, '#fff', { font: HEAD, max: 220 });
      // siren on alarm
      if (alarm) { g.save(); g.translate(rx + ROOM_W - 30, ROOM_Y + 4); g.fillStyle = '#ff4d6d'; g.beginPath(); g.arc(0, 0, 18, Math.PI, TAU); g.fill(); g.globalCompositeOperation = 'lighter'; g.rotate(t * 6); g.fillStyle = 'rgba(255,80,100,0.25)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 260, -0.25, 0.25); g.closePath(); g.fill(); g.restore(); }
    }
    g.restore();
  }
  function roomProps(g, key, R, t, health) {
    const ink = '#1d1036';
    if (key === 'engines') {
      const fx = R.x + 90, fy = R.floor - 70;
      glow(g, fx, fy, 120, 'rgba(255,140,60,A)', 0.25 + 0.35 * health);
      g.fillStyle = '#5a3a4a'; rr(g, fx - 60, fy - 60, 120, 130, 24); g.fill(); g.strokeStyle = ink; g.lineWidth = 6; g.stroke();
      g.fillStyle = health > 0.3 ? `rgba(255,${150 + 80 * Math.sin(t * 9) | 0},60,1)` : '#4a2a2a'; g.beginPath(); g.arc(fx, fy, 34, 0, TAU); g.fill(); g.stroke();
      const wx = R.x + R.w - 90, wy = R.floor - 70, sp = t * (0.5 + 3 * health);
      g.strokeStyle = '#c9c2d9'; g.lineWidth = 8; g.beginPath(); g.arc(wx, wy, 58, 0, TAU); g.stroke();
      g.lineWidth = 4; for (let i = 0; i < 6; i++) { const a = sp + (i / 6) * TAU; g.beginPath(); g.moveTo(wx, wy); g.lineTo(wx + Math.cos(a) * 56, wy + Math.sin(a) * 56); g.stroke(); }
      emoji(g, '🐹', wx, wy + 30, 40);
    } else if (key === 'oxygen') {
      for (let i = 0; i < 3; i++) { const px = R.x + 60 + i * 105, py = R.floor - 6; g.fillStyle = '#c96a3a'; rr(g, px - 24, py - 40, 48, 40, 8); g.fill(); g.strokeStyle = ink; g.lineWidth = 4; g.stroke(); const sw = Math.sin(t * 1.5 + i) * 0.15, droop = (1 - health) * 0.9; g.fillStyle = health > 0.4 ? '#5cd36a' : '#8a9a4a'; for (let l = 0; l < 4; l++) { g.save(); g.translate(px, py - 40); g.rotate((l - 1.5) * 0.5 + sw + droop * (l < 2 ? -1 : 1)); g.beginPath(); g.ellipse(0, -36, 13, 36, 0, 0, TAU); g.fill(); g.restore(); } }
      const n = Math.round(3 + 9 * health);
      for (let i = 0; i < n; i++) { const k = (t * 0.25 + i / n) % 1; g.strokeStyle = 'rgba(180,255,240,0.7)'; g.lineWidth = 3; g.beginPath(); g.arc(R.x + 30 + ((i * 71) % (R.w - 60)) + Math.sin(t * 2 + i) * 8, R.floor - 20 - k * (R.h - 40), 6 + (i % 3) * 3, 0, TAU); g.stroke(); }
    } else {
      const cx = R.x + R.w / 2, cy = R.y + 82;
      g.fillStyle = '#0a1230'; g.beginPath(); g.arc(cx, cy, 58, 0, TAU); g.fill(); g.strokeStyle = '#7fe6ff'; g.lineWidth = 4; g.stroke();
      g.strokeStyle = 'rgba(127,230,255,0.4)'; g.beginPath(); g.arc(cx, cy, 36, 0, TAU); g.stroke(); g.beginPath(); g.arc(cx, cy, 16, 0, TAU); g.stroke();
      g.save(); g.beginPath(); g.arc(cx, cy, 58, 0, TAU); g.clip(); g.fillStyle = 'rgba(127,230,255,0.35)'; g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, 60, t * 2, t * 2 + 0.7); g.closePath(); g.fill(); g.restore();
      g.fillStyle = '#2a1a52'; rr(g, R.x + 30, R.floor - 50, R.w - 60, 44, 10); g.fill(); g.strokeStyle = ink; g.lineWidth = 4; g.stroke();
      for (let i = 0; i < 6; i++) { g.fillStyle = (Math.floor(t * 3) + i) % 3 ? ['#ff4d6d', '#ffd23f', '#3ee6c1'][i % 3] : '#fff'; g.beginPath(); g.arc(R.x + 60 + i * 42, R.floor - 28, 9, 0, TAU); g.fill(); }
      if (health < 0.5) { g.fillStyle = `rgba(255,255,255,${0.1 + 0.1 * Math.sin(t * 30)})`; g.fillRect(R.x, R.y, R.w, R.h); }
    }
  }
  function bubblePod(g, x, y, sc, t, o = {}) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    glow(g, 0, -10, 200, o.alien ? 'rgba(130,255,100,A)' : 'rgba(170,220,255,A)', 0.35);
    if (o.alien) gloop(g, 0, 70, 0.75, t, { wave: true }); else astro(g, 0, 90, 0.65, t, { color: o.color, avatar: o.avatar, pose: o.pose || 'float', ph: 2, ghost: o.ghost });
    const bg = g.createRadialGradient(-50, -60, 10, 0, 0, 150); bg.addColorStop(0, 'rgba(255,255,255,0.35)'); bg.addColorStop(0.7, 'rgba(170,220,255,0.12)'); bg.addColorStop(1, 'rgba(170,220,255,0.4)');
    g.fillStyle = bg; g.beginPath(); g.arc(0, 0, 145, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 145, 0, TAU); g.stroke();
    g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 112, -2.5, -1.9); g.stroke();
    g.restore();
  }
  BOX.alienArt = { rr, glow, text, emoji, cover, space, ringPlanet, homePlanet, astro, gloop, saucer, ship, roomOf, bubblePod, util: { TAU, clamp, lerp, ease, easeOut, srand }, HEAD, BODY };

  // =========================================================================================
  // Shared bits
  // =========================================================================================
  const A = BOX.alienArt;
  const SYS = { oxygen: { icon: '🫧', name: 'Oxygen', room: 'Air Garden' }, engines: { icon: '🔥', name: 'Engines', room: 'Engine Room' }, shields: { icon: '🛡️', name: 'Shields', room: 'Shield Dome' } };
  const SYS_KEYS = ['oxygen', 'engines', 'shields'];
  const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + 's'}`;
  const av = (x) => (x && x.avatar ? esc(x.avatar) : '🙂');
  const ends = {};
  const timer = (key, endsIn) => { if (!endsIn) return ''; if (!ends[key]) ends[key] = Date.now() + endsIn; return `<span class="timer" data-ends="${ends[key]}">${mmss(ends[key] - Date.now())}</span>`; };
  const podWord = (s) => (s.family === false ? 'airlock' : 'bubble pod');
  const ROLE_TXT = {
    crew: { t: 'Crew', i: '🧑‍🚀', d: 'Fix the ship, get home, and find the aliens. Watch who you work beside!' },
    scanner: { t: 'Scanner', i: '🔬', d: 'Crew. Each shift, scan one crewmate: you’ll learn if they’re an alien. (The Mimic reads as crew!)' },
    engineer: { t: 'Engineer', i: '🔧', d: 'Crew. After each shift you see how many sabotages hit EACH station.' },
    alien: { t: 'Alien', i: '👽', d: 'Sabotage the repairs without getting caught. Win by breaking the ship or matching the crew’s numbers.' },
    mimic: { t: 'Alien Mimic', i: '🎭', d: 'An alien whose disguise is perfect: the Scanner reads you as crew. Sabotage and bluff!' },
  };
  const REASON = {
    home: ['🌍', 'The Biscuit made it home!', 'Enough clean repairs got the crew all the way back to Earth.'],
    caught: ['🫧', 'Every alien was caught!', 'The crew found all the Gloop and popped them off the ship.'],
    broken: ['💥', 'The ship broke down!', 'One system hit zero. The Gloop tow the Biscuit away.'],
    outnumber: ['👽', 'The aliens took over!', 'There are as many aliens as crew now. The ship is theirs.'],
    fuel: ['⛽', 'Out of fuel!', 'The Biscuit ran dry before reaching home. The mothership swoops in.'],
  };
  const claimHtml = (c) => {
    const tgt = c.target ? `<b class="aa-tg">${av(c.target)} ${esc(c.target.name)}</b>` : '';
    const st = c.station ? `<b class="aa-st">${esc(c.station.icon)} ${esc(c.station.label)}</b>` : '';
    const line = { where: `I was at ${st}`, sus: `I suspect ${tgt} 🤨`, clear: `I trust ${tgt} 👍`, scan: `I scanned ${tgt}: ${c.alien ? '<b class="aa-al">👽 ALIEN!</b>' : '<b class="aa-cr">🧑‍🚀 crew</b>'}`, sab: `🔧 Sabotage hit ${st}` }[c.kind] || '';
    return `<div class="aa-claim k-${esc(c.kind)}"><span class="aa-cav" style="--c:${esc(c.color)}">${av(c)}</span><div><small>${esc(c.name)}</small><p>${line}</p></div></div>`;
  };
  function haptic(ctx, kind) { try { if (ctx.haptic) ctx.haptic(kind); else ctx.vibrate(kind === 'tap' ? 10 : 40); } catch { /* none */ } }

  // =========================================================================================
  // One animation loop for every canvas on this page
  // =========================================================================================
  const loops = new Set(); let raf = 0;
  function addLoop(fn) { loops.add(fn); if (!raf) raf = requestAnimationFrame(tick); }
  function tick(now) { raf = 0; for (const fn of [...loops]) { try { if (fn(now) === false) loops.delete(fn); } catch (e) { fn.errs = (fn.errs || 0) + 1; if (fn.errs < 3) console.error(e); if (fn.errs > 200) loops.delete(fn); } } if (loops.size) raf = requestAnimationFrame(tick); }
  function fit(cv, cap = 1.5) { const d = Math.min(cap, window.devicePixelRatio || 1), w = cv.clientWidth || 1, h = cv.clientHeight || 1; if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); } return { w, h, d }; }

  // =========================================================================================
  // TV
  // =========================================================================================
  const T = { s: null, key: '', t0: 0 };
  const phaseKey = (s) => s.phase + ':' + s.round;
  function mountTv(el) {
    if (el._aa && el.contains(el._aa.root)) return el._aa;
    el.innerHTML = '<div class="aa-tv"><div class="aa-stage" data-keep><canvas class="aa-cv"></canvas></div><div class="aa-hud" id="aa-hud"></div></div>';
    const z = { root: el.firstElementChild, cv: el.querySelector('.aa-cv'), hud: el.querySelector('#aa-hud') };
    el._aa = z; T.key = '';
    addLoop((now) => { if (!z.cv.isConnected) return false; drawTv(z, now); return true; });
    return z;
  }
  // Which room each crew member stands in (cosmetic): everyone rushes to the emergency during a shift.
  function crewRooms(s) {
    const live = (s.crew || []).filter((c) => c.alive).slice(0, 12);
    const busy = s.phase === 'shift' || s.phase === 'emergency';
    return live.map((c, i) => ({ ...c, room: busy && s.emergency && i % 3 !== 2 ? s.emergency.sys : SYS_KEYS[i % 3] }));
  }
  function drawTv(z, now) {
    const s = T.s; if (!s) return;
    const { w, h, d } = fit(z.cv), g = z.cv.getContext('2d'), t = now / 1000, u = Date.now() - T.t0;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05021a'; g.fillRect(0, 0, z.cv.width, z.cv.height);
    cover(g, w, h, d);
    const R = s.report, E = s.emergency, sysKey = E && E.sys;
    let warp = 0, shake = 0, boom = null, fixed = null, shipX = 960, shipY = 690, sc = 0.8, jump = 0;
    if (s.phase === 'emergency') shake = 0.4 * Math.max(0, 1 - u / 1500);
    if (s.phase === 'report' && R) {
      if (R.S) { boom = { room: R.sys, k: (u - 1600) / 1400 }; if (u > 1600 && u < 2600) shake = 1 - (u - 1600) / 1000; }
      else fixed = { room: R.sys, k: (u - 1400) / 1600 };
      if (R.jumped) { const k = clamp((u - 3200) / 2600); warp = Math.sin(k * Math.PI); jump = warp; shipX = 960 + Math.sin(k * Math.PI) * 140; }
    }
    if (s.phase === 'over') {
      drawOver(g, s, t, u); return;
    }
    if (s.phase === 'eject') { drawEject(g, s, t, u); return; }
    space(g, t, { warp, speed: s.phase === 'roles' ? 60 : 40 });
    const crew = crewRooms(s);
    // ghosts drift around the ship
    const ghosts = (s.crew || []).filter((c) => c.ghost).slice(0, 10);
    ghosts.forEach((c, i) => { const a = t * 0.18 + (i / Math.max(1, ghosts.length)) * TAU; astro(g, shipX + Math.cos(a) * 860, shipY + 40 + Math.sin(a) * 330, 0.42, t, { color: c.color, avatar: c.avatar, ghost: true, pose: 'float', ph: i }); });
    ship(g, shipX, shipY, sc, t, { hp: s.hp, hpMax: s.hpMax, alarm: (s.phase === 'emergency' || s.phase === 'shift' || (s.phase === 'report' && u < 3000)) ? sysKey : null, working: s.phase === 'shift', crew, shake, boom, fixed, jump });
    // the abduction: a saucer swoops down and beams someone up
    if (s.phase === 'report' && R && R.abducted) {
      const k = clamp((u - 4600) / 3600);
      if (k > 0) {
        const sx = lerp(2200, 1180, easeOut(k * 2)) + (k > 0.75 ? (k - 0.75) * 4 * -1600 : 0), sy = 220;
        const lift = clamp((k - 0.3) / 0.45);
        saucer(g, sx, sy, 0.75, t, { beam: k > 0.2 && k < 0.8 ? 1 : 0, beamLen: 560 });
        if (k > 0.25 && k < 0.78) astro(g, sx, lerp(shipY + 40, sy + 80, ease(lift)), 0.5, t, { color: R.abducted.color, avatar: R.abducted.avatar, pose: 'float', ph: 3, alpha: 1 - clamp((lift - 0.85) / 0.15) });
      }
    }
    if (s.phase === 'emergency' || (s.phase === 'report' && R && R.S && u > 1600 && u < 2400)) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = `rgba(255,30,60,${0.12 + 0.1 * Math.sin(t * 10)})`; g.fillRect(0, 0, z.cv.width, z.cv.height); }
    // vignette
    g.setTransform(1, 0, 0, 1, 0, 0);
    const vg = g.createRadialGradient(z.cv.width / 2, z.cv.height / 2, z.cv.height * 0.35, z.cv.width / 2, z.cv.height / 2, z.cv.width * 0.75); vg.addColorStop(0, 'rgba(5,2,26,0)'); vg.addColorStop(1, 'rgba(5,2,26,0.65)'); g.fillStyle = vg; g.fillRect(0, 0, z.cv.width, z.cv.height);
  }
  function drawEject(g, s, t, u) {
    const e = s.eject || {}, o = e.out;
    space(g, t, { speed: 25 });
    ship(g, 520, 720, 0.5, t, { hp: s.hp, hpMax: s.hpMax, crew: crewRooms(s) });
    if (!o) { emoji(g, '🤷', 1340, 700, 200); return; }
    const k = clamp(u / 5200), x = lerp(780, 1480, easeOut(k)), y = 730 - Math.sin(k * Math.PI) * 70;
    // the hatch puff
    if (u < 900) { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, r = u / 900 * 120; g.fillStyle = `rgba(220,230,255,${0.5 * (1 - u / 900)})`; g.beginPath(); g.arc(780 + Math.cos(a) * r, 720 + Math.sin(a) * r, 24, 0, TAU); g.fill(); } }
    const reveal = u > 2600;
    bubblePod(g, x, y, 0.9, t, { alien: reveal && o.alien, color: o.color, avatar: o.avatar, pose: reveal && !o.alien ? 'float' : 'float' });
    if (reveal && o.alien) for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + t, r = 190 + ((u - 2600) / 8) % 120; g.fillStyle = `rgba(160,255,110,${0.6})`; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, 6, 0, TAU); g.fill(); }
  }
  function drawOver(g, s, t, u) {
    const ov = s.over || {}, crewWin = ov.winner === 'crew';
    space(g, t, { speed: crewWin ? 20 : 30, planet: !crewWin });
    if (crewWin) {
      const k = easeOut(u / 4000);
      homePlanet(g, lerp(2300, 1560, k), 1000, 470, t);
      ship(g, lerp(380, 760, k), 790, 0.5, t, { hp: s.hp, hpMax: s.hpMax, tilt: 0.08, crew: (s.crew || []).filter((c) => c.alive && !c.alien).slice(0, 9).map((c, i) => ({ ...c, room: SYS_KEYS[i % 3], pose: 'cheer' })) });
      for (let i = 0; i < 24; i++) { const k2 = ((t * 0.4 + i / 24) % 1), x = 200 + ((i * 263) % 1500), y = 1000 - k2 * 900; g.fillStyle = ['#ffd23f', '#ff5aa0', '#5ae0ff', '#a6ff5a'][i % 4]; g.globalAlpha = 1 - k2; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
    } else {
      const k = easeOut(u / 3000), lift = clamp((u - 2500) / 6000);
      ship(g, 960, lerp(940, 860, lift) + Math.sin(t) * 10, 0.45, t, { hp: s.hp, hpMax: s.hpMax, tilt: Math.sin(t * 0.7) * 0.05 });
      saucer(g, 960, lerp(-200, 620, k), 0.8, t, { beam: k > 0.9 ? 1 : 0, beamLen: 330 });
      const al = (ov.aliens || []).slice(0, 6);
      al.forEach((a, i) => gloop(g, [300, 1620, 520, 1400, 140, 1780][i], 1010, 0.75, t, { ph: i, wave: true }));
    }
  }
  // ---------- the HUD ----------
  function topBar(s) {
    const trip = Array.from({ length: s.home }, (_, i) => `<i class="${i < s.progress ? 'on' : ''}">${i < s.progress ? '●' : '○'}</i>`).join('');
    const sys = SYS_KEYS.map((k) => { const h = s.hp[k]; return `<span class="aa-sysb ${h <= 1 ? 'low' : ''} ${s.emergency && s.emergency.sys === k && (s.phase === 'emergency' || s.phase === 'shift') ? 'alarm' : ''}">${SYS[k].icon}<span class="bars">${Array.from({ length: s.hpMax }, (_, i) => `<b class="${i < h ? 'on' : ''}"></b>`).join('')}</span></span>`; }).join('');
    const clock = s.endsIn ? `<span class="aa-clock">⏱ ${timer('t' + phaseKey(s), s.endsIn)}</span>` : '';
    return `<div class="aa-top"><span class="aa-shift">SHIFT <b>${s.round || 1}</b>/${s.maxRounds}</span>
      <span class="aa-trip" title="Jumps home">🚀<span class="dots">${trip}</span>🌍</span>
      <span class="aa-sys">${sys}</span><span class="aa-sp"></span>
      <span class="aa-aliens">👽 <b>${s.aliensLeft}</b> aboard${s.beam ? ' · 🛸 beam ready' : ''}</span>${clock}</div>`;
  }
  function crewStrip(s) {
    const list = s.crew || [];
    return `<div class="aa-crew ${list.length > 10 ? 'many' : ''}">${list.map((c) => {
      const st = c.alien === true ? '<em class="al">👽</em>' : c.abducted ? '<em>🛸</em>' : c.ghost ? '<em>👻</em>' : c.picked || c.voted ? '<em class="ok">✓</em>' : '';
      return `<span class="aa-chip ${c.ghost || c.gone ? 'ghost' : ''} ${c.alien ? 'alien' : ''} ${(s.phase === 'shift' && c.picked === false) || (s.phase === 'vote' && c.voted === false) ? 'wait' : ''}" style="--c:${esc(c.color)}"><span class="h">${av(c)}</span><b>${esc(c.name)}</b>${st}</span>`;
    }).join('')}</div>`;
  }
  function stationsRow(E) { return `<div class="aa-stations">${E.stations.map((x) => `<span class="aa-stn"><i>${esc(x.icon)}</i>${esc(x.label)}</span>`).join('')}</div>`; }
  function center(s) {
    const E = s.emergency, R = s.report;
    switch (s.phase) {
      case 'roles': {
        const sp = s.specials || {};
        return `<div class="aa-card aa-roles"><div class="aa-kicker">🔒 TOP SECRET</div><h1>Check your phone for your role!</h1>
          <p>Don’t let anyone peek. <b class="aa-al">${plural(s.aliensTotal, 'alien')}</b> ${s.aliensTotal === 1 ? 'is' : 'are'} hiding among the crew.</p>
          <div class="aa-rolechips"><span>🧑‍🚀 Crew</span>${sp.scanner ? '<span>🔬 Scanner</span>' : ''}${sp.engineer ? '<span>🔧 Engineer</span>' : ''}<span class="al">👽 Alien</span>${sp.mimic ? '<span class="al">🎭 Mimic</span>' : ''}</div>
          <p class="aa-sub">Make ${plural(s.home, 'clean jump')} to get home in ${s.maxRounds} shifts.${s.beam ? ' A lone alien has one 🛸 abduction beam.' : ''}</p></div>`;
      }
      case 'emergency':
        return `<div class="aa-card aa-alarm"><div class="aa-siren">🚨 EMERGENCY · ${esc(E.icon)} ${esc(E.room.toUpperCase())}</div><h1>${esc(E.title)}</h1><p>${esc(E.text)}</p>${stationsRow(E)}</div>`;
      case 'shift': {
        const sh = s.shift || { picked: 0, of: 0, waiting: [] };
        return `<div class="aa-card aa-shiftc"><div class="aa-kicker">${esc(E.icon)} ${esc(E.title)}</div><h2>Pick a station on your phone!</h2>${stationsRow(E)}
          <div class="aa-prog"><div class="fill" style="width:${sh.of ? Math.round((sh.picked / sh.of) * 100) : 0}%"></div><span>🔧 ${sh.picked} / ${sh.of} at work</span></div>
          <p class="aa-sub">${E.block > 1 ? `Big crew: it takes <b>2 sabotages</b> to stop the jump.` : 'One sabotage stops the jump.'} ${sh.waiting.length ? `· Waiting for ${sh.waiting.map(esc).join(', ')}` : '· Everyone’s at work!'}</p></div>`;
      }
      case 'report': {
        if (!R) return '';
        const head = R.S ? `<div class="aa-big bad">💥 ${plural(R.S, 'sabotage')} detected</div><h2>in the ${esc(SYS[R.sys].room)}! <span class="aa-dmg">${SYS[R.sys].icon} −${R.damage}</span></h2>`
          : `<div class="aa-big good">✅ Clean repair!</div><h2>${esc(SYS[R.sys].room)} fixed ${SYS[R.sys].icon} +1</h2>`;
        const jump = R.jumped ? `<div class="aa-jump">🚀 JUMP! ${s.progress >= s.home ? 'We’re home!!' : `${plural(s.home - s.progress, 'jump')} to go`}</div>` : `<div class="aa-nojump">🛑 No jump this shift</div>`;
        const heal = Object.entries(R.healed || {}).map(([k, n]) => `👻 The ghosts patched ${SYS[k].icon} +${n}`).join(' · ');
        const brk = R.broke ? `<div class="aa-big bad aa-late">💀 ${esc(SYS[R.broke].name)} is DOWN!</div>` : '';
        const abd = R.abducted ? `<div class="aa-abd aa-late2">🛸 …and <b>${av(R.abducted)} ${esc(R.abducted.name)}</b> has been ABDUCTED!</div>` : '';
        return `<div class="aa-card aa-report ${R.S ? 'bad' : 'good'}">${head}${jump}${heal ? `<p class="aa-sub">${heal}</p>` : ''}${brk}${abd}<p class="aa-sub">Nobody knows where it happened… except, maybe, the 🔧 Engineer.</p></div>`;
      }
      case 'discuss': case 'vote': {
        const cl = s.claims || [], wh = s.whispers || [];
        const left = s.phase === 'discuss'
          ? `<div class="aa-kicker">🗣️ DISCUSSION</div><h2>Who’s acting weird?</h2><p class="aa-sub">Talk it out! Post claims from your phone: 📍 where you were, 🤨 who you suspect.</p>`
          : `<div class="aa-kicker">🗳️ VOTE</div><h2>Who goes in the ${podWord(s)}?</h2>
            <div class="aa-prog"><div class="fill" style="width:${s.vote && s.vote.of ? Math.round((s.vote.voted / s.vote.of) * 100) : 0}%"></div><span>${s.vote ? `${s.vote.voted} / ${s.vote.of} voted` : ''}</span></div>
            <p class="aa-sub">Vote on your phone, or ⏭️ skip. A tie ejects nobody.</p>`;
        const last = R ? `<div class="aa-last">${R.S ? `💥 ${plural(R.S, 'sabotage')} in the ${esc(SYS[R.sys].room)}` : `✅ Clean repair in the ${esc(SYS[R.sys].room)}`}${R.abducted ? ` · 🛸 ${esc(R.abducted.name)} abducted` : ''}</div>` : '';
        const ghosts = wh.length ? `<div class="aa-whisper">👻 The ghosts feel a chill near… ${wh.map((w) => `<b>${av(w)} ${esc(w.name)}</b>${w.n > 1 ? ` ×${w.n}` : ''}`).join(', ')}</div>` : '';
        return `<div class="aa-talk"><div class="aa-card aa-talkl">${left}${last}${ghosts}</div>
          <div class="aa-feed">${cl.length ? cl.slice(0, 5).map(claimHtml).join('') : '<div class="aa-empty">No claims yet… somebody say something! 📱</div>'}</div></div>`;
      }
      case 'eject': {
        const e = s.eject || {}, o = e.out;
        if (!o) return `<div class="aa-card aa-ej"><div class="aa-big">${e.why === 'tie' ? '⚖️ It’s a tie!' : '⏭️ Vote skipped!'}</div><h2>Nobody goes in the ${podWord(s)} this time.</h2>${e.rows && e.rows.length ? `<p class="aa-sub">${e.rows.map((r) => `${av(r)} ${esc(r.name)} ${r.n}`).join(' · ')}${e.skip ? ` · ⏭️ skip ${e.skip}` : ''}</p>` : ''}</div>`;
        return `<div class="aa-card aa-ej"><h2>${av(o)} <b>${esc(o.name)}</b> ${s.family === false ? 'is thrown out the airlock' : 'is popped into the bubble pod'}… <span class="muted">(${plural(o.n, 'vote')})</span></h2>
          <div class="aa-verdict ${o.alien ? 'al' : 'cr'}">${o.alien ? '👽 …and was an ALIEN!' : '🧑‍🚀 …and was NOT an alien.'}</div>
          <p class="aa-sub aa-late">👽 ${plural(s.aliensLeft, 'alien')} left aboard</p></div>`;
      }
      case 'over': {
        const ov = s.over || {}, [ic, title, line] = REASON[ov.reason] || ['🏁', 'Game over', ''];
        const crewWin = ov.winner === 'crew';
        const rows = (ov.standings || []).slice(0, 12).map((r, i) => `<div class="aa-row ${r.won ? 'won' : ''}" style="--c:${esc(r.color)};animation-delay:${(0.6 + i * 0.08).toFixed(2)}s"><span class="n">${i + 1}</span><span class="h">${av(r)}</span><b>${esc(r.name)}</b><span class="role">${(ROLE_TXT[r.role] || {}).i || ''} ${esc((ROLE_TXT[r.role] || {}).t || '')}</span><span class="pts">⭐ ${r.pts}</span></div>`).join('');
        return `<div class="aa-overc"><div class="aa-card aa-win ${crewWin ? 'crew' : 'aliens'}"><div class="aa-big">${crewWin ? '🧑‍🚀 THE CREW WINS!' : '👽 THE ALIENS WIN!'}</div><h2>${ic} ${esc(title)}</h2><p class="aa-sub">${esc(line)}</p>
          <div class="aa-reveal">The aliens were: ${(ov.aliens || []).map((a) => `<b>${av(a)} ${esc(a.name)}${a.role === 'mimic' ? ' 🎭' : ''}</b>`).join(', ')}</div></div>
          <div class="aa-card aa-board"><h3>Crew log · ⭐ contribution</h3>${rows}</div></div>`;
      }
    }
    return '';
  }
  function tv(el, s) {
    if (!s) return;
    const z = mountTv(el), k = phaseKey(s);
    if (k !== T.key) { T.key = k; T.t0 = Date.now() - (s.phase === 'report' ? Math.max(0, 9000 - (s.endsIn || 9000)) : s.phase === 'eject' ? Math.max(0, 7500 - (s.endsIn || 7500)) : 0); }
    T.s = s;
    const html = `${s.phase === 'over' ? '' : topBar(s)}<div class="aa-center aa-p-${esc(s.phase)}" id="aa-c-${esc(k.replace(':', '-'))}">${center(s)}</div>${s.phase === 'over' ? '' : crewStrip(s)}`;
    if (z._html !== html) { z._html = html; BOX.morph(z.hud, html); }
  }

  // =========================================================================================
  // TV lobby: the boarding dock
  // =========================================================================================
  const CONSOLE = { trip: ['🗺️', 'Flight plan'], aliens: ['👽', 'Alien infiltrators'], talk: ['🗣️', 'Crew meetings'], specials: ['🎖️', 'Special crew'], showIntro: ['🎬', 'Launch sequence'] };
  const SHORT = { trip: { 3: 'Short hop · 3', 4: 'Standard · 4', 5: 'Long haul · 5' }, aliens: { auto: 'Auto', 1: '1', 2: '2', 3: '3' }, talk: { 30: '30s', 45: '45s', 60: '60s', 90: '90s' }, specials: { true: 'On', false: 'Off' }, showIntro: { true: 'On', false: 'Skip' } };
  let lobbyErr = '';
  function lobbyBg(cv, el) {
    addLoop((now) => {
      if (!cv.isConnected) return false;
      const { w, h, d } = fit(cv, 1), g = cv.getContext('2d'), t = now / 1000;
      g.setTransform(1, 0, 0, 1, 0, 0); cover(g, w, h, d);
      space(g, t, { speed: 12 });
      const L = el.__L, ppl = L ? L.players.slice(0, 12) : [];
      ship(g, 1560, 850, 0.42, t, { crew: ppl.map((p, i) => ({ ...p, room: SYS_KEYS[i % 3], pose: i % 4 === 0 ? 'wave' : 'idle' })) });
      saucer(g, 1700 + Math.sin(t * 0.4) * 60, 120 + Math.sin(t * 0.9) * 20, 0.35, t, {});
      return true;
    });
  }
  function lobbyTv(el, L) {
    el.__L = L;
    const n = L.players.length, need = Math.max(0, (L.min || 4) - n);
    if (!el._aal || !el.contains(el._aal)) {
      el.innerHTML = '<div class="aa-lobby"><canvas class="aa-lbg"></canvas><div class="aa-lui" id="aa-lui"></div></div>';
      el._aal = el.firstElementChild; lobbyBg(el.querySelector('.aa-lbg'), el);
    }
    const rows = L.fields.map((f) => {
      const [ic, what] = CONSOLE[f.key] || ['⚙️', f.label], cur = String(L.settings[f.key]);
      return `<div class="aa-cons"><span class="ic">${ic}</span><div class="lb">${esc(what)}<small>${esc(f.label)}</small></div><div class="sw">${f.options.map((o) => `<button class="${String(o.value) === cur ? 'on' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}" title="${esc(o.label)}">${esc((SHORT[f.key] || {})[String(o.value)] || o.label)}</button>`).join('')}</div></div>`;
    }).join('');
    const sel = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
    BOX.morph(el.querySelector('#aa-lui'), `<header class="aa-lhead"><div class="aa-logo"><span class="a">ALIEN</span><span class="b">ABDUCTION</span></div><div class="aa-ltag">The starship Biscuit is heading home… but some of the crew aren’t who they say they are.</div></header>
      <section class="aa-pass"><div class="aa-pt">🎫 BOARDING PASS</div><img id="qr" alt="QR code to join" src="${esc(L.qr)}"><div class="aa-url">${esc(L.joinUrl.replace(/^https?:\/\//, ''))}</div>
        <div class="aa-gate"><small>Gate code</small><div id="code">${esc(L.code)}</div></div>
        <div class="aa-vip">${L.vip ? `👑 Captain <b>${esc(L.vip)}</b> can launch from their phone` : 'The first to board is the captain 👑'}</div></section>
      <section class="aa-console"><h3>🎛️ Mission console</h3><div id="aa-rows">${rows}</div><div id="settings" class="aa-sr">${sel}</div>
        <button class="aa-start" id="start" ${need ? 'disabled' : ''}>🚀 Launch the Biscuit</button><div class="aa-err" id="lobby-err">${esc(need ? `${plural(need, 'more crew member')} needed (4 minimum, best with 5–12)` : lobbyErr)}</div>
        <div class="aa-links"><button id="add-bots">+ 5 test bots</button><button id="rm-bots">remove bots</button><button id="aa-pick">🎮 another game</button><button id="aa-back">◀ games</button></div></section>
      <section class="aa-manifest"><h3>🧑‍🚀 Crew manifest <b>${n}</b></h3><div class="aa-roster" id="roster">${L.players.map((p) => `<span class="chip aa-mchip ${p.online ? '' : 'off'}" data-kick="${esc(p.id)}" title="Click to remove" style="--c:${esc(p.color || '#7dff6a')}"><span class="h">${esc(p.avatar || '🙂')}</span><b>${esc(p.name)}</b></span>`).join('') || '<div class="aa-empty">Scan the boarding pass to join the crew!</div>'}</div>${L.lineupHtml ? `<div class="aa-lineup">${L.lineupHtml}</div>` : ''}</section>`);
    const box = el.querySelector('#aa-lui');
    for (const s of box.querySelectorAll('select[data-set]')) s.onchange = () => { BOX.sfx('click'); L.set(s.dataset.set, s.value); };
    for (const b of box.querySelectorAll('[data-k]')) b.onclick = () => { const s = box.querySelector(`select[data-set="${b.dataset.k}"]`); if (s) { s.value = b.dataset.v; s.onchange(); } };
    box.querySelector('#start').onclick = async () => { const r = await L.start(); lobbyErr = r && !r.ok ? r.error || 'Could not start.' : ''; const e = box.querySelector('#lobby-err'); if (e) e.textContent = lobbyErr; if (r && r.ok) BOX.sfx('whoosh'); };
    box.querySelector('#add-bots').onclick = () => L.bots(5);
    box.querySelector('#rm-bots').onclick = () => L.removeBots();
    box.querySelector('#aa-pick').onclick = () => L.pick();
    box.querySelector('#aa-back').onclick = () => L.back();
    for (const c of box.querySelectorAll('[data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) L.kick(c.dataset.kick); };
  }

  // =========================================================================================
  // Phone
  // =========================================================================================
  const P = { peek: false, peekT: 0, opened: '', say: null, felt: {}, game: '' };
  function feel(ctx, chan, key, kind) { if (P.felt[chan] === key) return; P.felt[chan] = key; haptic(ctx, kind); }
  function paint(el, html, key) {
    if (el._aaKey === key && el._aaHtml === html) return;
    el._aaKey = key; el._aaHtml = html;
    BOX.morph(el, `<div class="aa-ph" id="aap-${esc(key)}">${html}</div>`);
  }
  function roleBadge(v) {
    const m = v.me, r = ROLE_TXT[m.role];
    return `<button class="aa-peek ${P.peek ? 'open' : ''} ${m.side === 'aliens' ? 'al' : ''}" id="aa-peek">${P.peek ? `${r.i} <b>${esc(r.t)}</b>` : '🔒 Tap to see your role'}</button>`;
  }
  function head(v) {
    const m = v.me;
    return `<div class="aa-phead">${roleBadge(v)}<span class="aa-pp">⭐ ${m.pts}</span><span class="aa-ps">${m.ghost ? '👻 Ghost' : `Shift ${v.round || 1}/${v.maxRounds}`}</span></div>`;
  }
  // Private notes: what only this player knows.
  function notes(v) {
    const out = [], m = v.me;
    if (v.allies && v.allies.length) out.push(`<li>👽 Your fellow aliens: ${v.allies.map((a) => `<b>${av(a)} ${esc(a.name)}</b>${a.role === 'mimic' ? ' 🎭' : ''}${a.alive ? '' : ' 👻'}`).join(', ')}</li>`);
    if (m.side === 'aliens' && v.beam) out.push('<li>🛸 Your abduction beam is charged (use it during a shift).</li>');
    if (v.myStation != null && v.report && v.report.stations[v.myStation]) { const st = v.report.stations[v.myStation]; out.push(`<li>📍 You worked at <b>${esc(st.icon)} ${esc(st.label)}</b> ${v.mates && v.mates.length ? `with ${v.mates.map((x) => `<b>${av(x)} ${esc(x.name)}</b>`).join(', ')}` : '<b>alone</b>'}.</li>`); }
    if (v.breakdown && v.report) out.push(`<li>🔧 Engineer readout: ${v.report.stations.map((st, i) => `${esc(st.icon)} ${v.breakdown[i] ? `<b class="aa-al">💥${v.breakdown[i]}</b>` : '<b class="aa-cr">0</b>'}`).join(' · ')}</li>`);
    if (v.scanLog && v.scanLog.length) out.push(`<li>🔬 Scans: ${v.scanLog.map((x) => `${av(x)} ${esc(x.name)} ${x.alien ? '<b class="aa-al">👽</b>' : '<b class="aa-cr">🧑‍🚀</b>'}`).join(' · ')}</li>`);
    return out.length ? `<div class="aa-notes"><div class="aa-nt">🗒️ Your secret notes</div><ul>${out.join('')}</ul></div>` : '';
  }
  function nameGrid(list, sel, attr, extra = '') { return `<div class="aa-names">${list.map((c) => `<button class="aa-name ${sel === c.id ? 'sel' : ''}" ${attr}="${esc(c.id)}" style="--c:${esc(c.color)}"><span class="h">${av(c)}</span><b>${esc(c.name)}</b>${sel === c.id ? '<em>✓</em>' : ''}</button>`).join('')}${extra}</div>`; }
  function rolePhone(v) {
    const m = v.me, r = ROLE_TXT[m.role], open = P.opened === v.round + ':' + m.role;
    if (!open) return `<div class="aa-dossier" id="aa-open"><div class="stamp">TOP SECRET</div><div class="big">📁</div><h2>Your role is inside</h2><p>Cover your screen, then tap to open.</p></div>`;
    return `<div class="aa-rolecard ${m.side}"><div class="ri">${r.i}</div><div class="rk">You are</div><h2>${m.side === 'aliens' ? 'an ' : 'the '}${esc(r.t)}${m.role === 'crew' ? ' member' : ''}</h2><p>${esc(r.d)}</p>
      ${v.allies && v.allies.length ? `<p class="aa-allies">Your fellow aliens: ${v.allies.map((a) => `<b>${av(a)} ${esc(a.name)}</b>`).join(', ')}</p>` : ''}
      ${m.side === 'aliens' && v.beam ? '<p class="aa-allies">🛸 You’re alone, so you get one abduction beam!</p>' : ''}</div>`;
  }
  function shiftPhone(v, ctx) {
    const m = v.me, E = v.emergency, mine = v.mine, t = timer('p' + v.round, v.endsIn);
    if (m.ghost) {
      const crewGhost = m.side === 'crew';
      return { html: `<div class="aa-pcard ghostc"><h3>👻 Spooky chores</h3>${crewGhost ? `<p>Patch a system (every 2 ghost patches heal it by 1):</p><div class="aa-sysbtns">${SYS_KEYS.map((k) => `<button class="aa-sysbtn ${v.patched === k ? 'sel' : ''}" data-patch="${k}">${SYS[k].icon}<b>${SYS[k].name}</b><small>${'●'.repeat(v.hp[k])}${'○'.repeat(Math.max(0, v.hpMax - v.hp[k]))}</small></button>`).join('')}</div>` : '<p>You’re an alien ghost. You don’t fix things… but you can still whisper lies. 😈</p>'}
        <p>Whisper a suspect to the TV (optional):</p>${nameGrid(v.choices, v.whispered, 'data-wh', `<button class="aa-name skip ${v.whispered === 'skip' ? 'sel' : ''}" data-wh="skip"><b>🤐 Stay quiet</b></button>`)}<p class="muted center">${t}</p></div>`,
        bind: (el) => {
          for (const b of el.querySelectorAll('[data-patch]')) b.onclick = async () => { const r = await ctx.act({ op: 'patch', sys: b.dataset.patch }); if (r.ok) haptic(ctx, 'select'); };
          for (const b of el.querySelectorAll('[data-wh]')) b.onclick = async () => { const r = await ctx.act({ op: 'whisper', id: b.dataset.wh }); if (r.ok) { haptic(ctx, 'tap'); ctx.sfx('pop'); } };
        } };
    }
    const alien = m.side === 'aliens';
    const st = E.stations.map((x, i) => {
      const sel = mine && mine.station === i;
      if (!alien) return `<button class="aa-stbtn ${sel ? 'sel' : ''}" data-st="${i}" data-sab="0"><span class="i">${esc(x.icon)}</span><b>${esc(x.label)}</b>${sel ? '<em>✓ 🔧 fixing</em>' : '<small>🔧 Fix</small>'}</button>`;
      return `<div class="aa-stduo ${sel ? 'sel' : ''}"><div class="t"><span class="i">${esc(x.icon)}</span><b>${esc(x.label)}</b></div><div class="b"><button class="fix ${sel && !mine.sab ? 'on' : ''}" data-st="${i}" data-sab="0">🔧 Fix</button><button class="sab ${sel && mine.sab ? 'on' : ''}" data-st="${i}" data-sab="1">💥 Sabotage</button></div></div>`;
    }).join('');
    let extra = '';
    if (m.role === 'scanner') extra = `<div class="aa-pcard"><h3>🔬 Scan one crewmate</h3>${nameGrid(v.choices, v.scanned, 'data-scan', `<button class="aa-name skip ${v.scanned === 'skip' ? 'sel' : ''}" data-scan="skip"><b>⏭️ No scan</b></button>`)}</div>`;
    if (alien && v.beam) extra = `<div class="aa-pcard beamc"><h3>🛸 Abduction beam <small>(1 charge, optional)</small></h3>${nameGrid(v.choices.filter((c) => !(v.allies || []).some((a) => a.id === c.id)), v.beamAt, 'data-beam', `<button class="aa-name skip ${!v.beamAt ? 'sel' : ''}" data-beam="skip"><b>✋ Not now</b></button>`)}</div>`;
    const done = mine && (m.role !== 'scanner' || v.scanned);
    return { html: `<div class="aa-pcard"><div class="aa-pk">${esc(E.icon)} ${esc(E.title)}</div><h3>${mine ? '✓ Locked in! You can change until time’s up.' : 'Pick your station'}</h3><div class="aa-sts ${alien ? 'duo' : ''}">${st}</div><p class="muted center">${done ? 'Waiting for the crew… ' : ''}${t}</p></div>${extra}`,
      bind: (el) => {
        for (const b of el.querySelectorAll('[data-st]')) b.onclick = async () => { const r = await ctx.act({ op: 'shift', station: Number(b.dataset.st), sab: b.dataset.sab === '1' }); if (r.ok) { haptic(ctx, b.dataset.sab === '1' ? 'buzz' : 'select'); ctx.sfx('click'); } };
        for (const b of el.querySelectorAll('[data-scan]')) b.onclick = async () => { const r = await ctx.act({ op: 'scan', id: b.dataset.scan }); if (r.ok) { haptic(ctx, 'select'); ctx.sfx('zap'); } };
        for (const b of el.querySelectorAll('[data-beam]')) b.onclick = async () => { const r = await ctx.act({ op: 'abduct', id: b.dataset.beam }); if (r.ok) haptic(ctx, b.dataset.beam === 'skip' ? 'tap' : 'warn'); };
      } };
  }
  function reportPhone(v, ctx) {
    const R = v.report, m = v.me; if (!R) return '';
    const lines = [];
    if (R.abducted && R.abducted.id === m.id) { feel(ctx, 'abd', v.round, 'big'); return `<div class="aa-pcard abd"><div class="big">🛸</div><h2>You’ve been abducted!</h2><p>The Gloop beamed you aboard their saucer. You’re a 👻 ghost now: keep helping with spooky chores.</p></div>`; }
    lines.push(R.S ? `<div class="aa-res bad">💥 ${plural(R.S, 'sabotage')} hit the ${esc(SYS[R.sys].room)}</div>` : `<div class="aa-res good">✅ Clean repair!</div>`);
    if (R.jumped) lines.push('<p class="center">🚀 The ship jumped closer to home!</p>');
    if (v.scan) lines.push(`<div class="aa-scanres ${v.scan.alien ? 'al' : 'cr'}">🔬 Scan: <b>${av(v.scan)} ${esc(v.scan.name)}</b> is ${v.scan.alien ? '👽 AN ALIEN!' : '🧑‍🚀 crew'}</div>`);
    if (v.mySab) lines.push('<p class="center aa-al">😈 Your sabotage landed.</p>');
    feel(ctx, 'rep', v.round, R.S ? (m.side === 'aliens' ? 'success' : 'error') : (m.side === 'aliens' ? 'error' : 'success'));
    return `<div class="aa-pcard">${lines.join('')}</div>`;
  }
  const SAY = [['where', '📍', 'I was at…'], ['sus', '🤨', 'I suspect…'], ['clear', '👍', 'I trust…'], ['scan', '🔬', 'I scanned…'], ['sab', '🔧', 'Sabotage hit…']];
  function discussPhone(v, ctx) {
    const m = v.me, key = 'say' + v.round;
    if (m.ghost) return { html: `<div class="aa-pcard ghostc"><h3>👻 Ghosts can’t talk</h3><p>But the living can hear your whispers on the TV. Watch them squirm…</p></div>` };
    if (P.say && P.say.key !== key) P.say = null;
    const t = timer('d' + v.round, v.endsIn), left = v.sayLeft == null ? 6 : v.sayLeft;
    const send = async (msg) => { const r = await ctx.act({ op: 'say', ...msg }); if (r.ok) { haptic(ctx, 'success'); ctx.sfx('pop'); P.say = null; ctx.redraw(); } };
    if (P.say && P.say.kind) {
      const k = P.say.kind, [, ic, lab] = SAY.find((x) => x[0] === k);
      let body;
      if (k === 'where' || k === 'sab') body = `<div class="aa-sts">${v.emergency.stations.map((x, i) => `<button class="aa-stbtn" data-sst="${i}"><span class="i">${esc(x.icon)}</span><b>${esc(x.label)}</b></button>`).join('')}</div>`;
      else if (k === 'scan' && P.say.id) body = `<p class="center">${esc((v.choices.find((c) => c.id === P.say.id) || {}).name || '')} is…</p><div class="aa-yn"><button class="al" data-scv="1">👽 an ALIEN</button><button class="cr" data-scv="0">🧑‍🚀 crew</button></div>`;
      else body = nameGrid(v.choices, null, 'data-sid');
      return { html: `<div class="aa-pcard"><h3>${ic} ${lab}</h3>${body}<button class="btn ghost small aa-back" id="aa-sback">◀ Back</button></div>`,
        bind: (el) => {
          for (const b of el.querySelectorAll('[data-sst]')) b.onclick = () => send({ kind: k, station: Number(b.dataset.sst) });
          for (const b of el.querySelectorAll('[data-sid]')) b.onclick = () => { if (k === 'scan') { P.say.id = b.dataset.sid; haptic(ctx, 'tap'); ctx.redraw(); } else send({ kind: k, id: b.dataset.sid }); };
          for (const b of el.querySelectorAll('[data-scv]')) b.onclick = () => send({ kind: 'scan', id: P.say.id, alien: b.dataset.scv === '1' });
          el.querySelector('#aa-sback').onclick = () => { P.say = null; ctx.redraw(); };
        } };
    }
    return { html: `<div class="aa-pcard"><h3>🗣️ Talk it out! <small>${t}</small></h3><p class="muted">Say it out loud, or post a claim to the TV (${left} left):</p>
      <div class="aa-says">${SAY.map(([k, ic, lab]) => `<button class="aa-say k-${k}" data-say="${k}" ${left <= 0 ? 'disabled' : ''}><span>${ic}</span>${lab}</button>`).join('')}</div></div>`,
      bind: (el) => { for (const b of el.querySelectorAll('[data-say]')) b.onclick = () => { P.say = { key, kind: b.dataset.say }; haptic(ctx, 'tap'); ctx.redraw(); }; } };
  }
  function votePhone(v, ctx) {
    const m = v.me, t = timer('v' + v.round, v.endsIn);
    if (m.ghost) return { html: `<div class="aa-pcard ghostc"><h3>👻 Ghosts don’t vote</h3><p>Float around and judge silently.</p></div>` };
    return { html: `<div class="aa-pcard"><h3>🗳️ Who goes in the ${podWord(v)}? <small>${t}</small></h3>${nameGrid(v.choices, v.myVote, 'data-vote', `<button class="aa-name skip ${v.myVote === 'skip' ? 'sel' : ''}" data-vote="skip"><b>⏭️ Skip vote</b></button>`)}<p class="muted center">${v.myVote ? 'Vote cast. You can change it until everyone’s in.' : 'Tap a name.'}</p></div>`,
      bind: (el) => { for (const b of el.querySelectorAll('[data-vote]')) b.onclick = async () => { const r = await ctx.act({ op: 'vote', id: b.dataset.vote }); if (r.ok) { haptic(ctx, 'select'); ctx.sfx('ballot'); } }; } };
  }
  function ejectPhone(v, ctx) {
    const e = v.eject || {}, o = e.out, m = v.me;
    if (!o) return `<div class="aa-pcard"><div class="big">${e.why === 'tie' ? '⚖️' : '⏭️'}</div><h3>Nobody was ejected.</h3></div>`;
    if (o.id === m.id) { feel(ctx, 'ej', v.round, 'big'); return `<div class="aa-pcard abd"><div class="big">🫧</div><h2>You were ejected!</h2><p>You’re a 👻 ghost now. You can still do spooky chores and whisper suspects.</p></div>`; }
    feel(ctx, 'ej', v.round, o.alien ? (m.side === 'crew' ? 'success' : 'error') : (m.side === 'crew' ? 'error' : 'success'));
    return `<div class="aa-pcard"><h3>${av(o)} ${esc(o.name)} was…</h3><div class="aa-verdict ${o.alien ? 'al' : 'cr'}">${o.alien ? '👽 an ALIEN!' : '🧑‍🚀 NOT an alien.'}</div></div>`;
  }
  function overPhone(v, ctx) {
    const m = v.me, r = ROLE_TXT[m.role], ov = v.over || {}, [ic, title] = REASON[ov.reason] || ['🏁', 'Game over'];
    feel(ctx, 'over', 1, v.won ? 'win' : 'error');
    const st = v.stats || {}, bits = [['fix', '🔧 fixes'], ['sabotage', '💥 sabotages'], ['ejectAlien', '🫧 aliens caught'], ['scanAlien', '🔬 aliens scanned'], ['abduct', '🛸 abductions'], ['patch', '👻 patches']].filter(([k]) => st[k]).map(([k, l]) => `<span>${st[k]} ${l}</span>`).join('');
    return `<div class="aa-pcard aa-endc ${v.won ? 'won' : 'lost'}"><div class="big">${v.won ? '🏆' : '😵'}</div><h2>${v.won ? 'Your side won!' : 'Your side lost…'}</h2><p>${ic} ${esc(title)}</p>
      <div class="aa-rolecard mini ${m.side}">You were <b>${r.i} ${esc(r.t)}</b></div><p>⭐ ${m.pts} · #${v.rank} of ${v.of}</p><div class="aa-stats">${bits}</div></div>`;
  }
  function phone(el, v, ctx) {
    if (!v) return;
    if (!v.me) { paint(el, `<div class="aa-pcard"><div class="big">🧳</div><h3>You’re a stowaway this trip!</h3><p>Watch the big screen. You’ll join the crew next game.</p></div>`, 'stow'); return; }
    if (v.phase === 'roles' && P.ph !== 'roles') { P.felt = {}; P.opened = ''; P.say = null; } // a new game
    P.ph = v.phase;
    const m = v.me, key = v.phase + '-' + v.round;
    let html = head(v), bind = null;
    if (v.phase === 'roles') { feel(ctx, 'roles', 1, 'big'); html += rolePhone(v); }
    else if (v.phase === 'emergency') { feel(ctx, 'em', v.round, m.ghost ? 'tap' : 'warn'); html += `<div class="aa-pcard alarm"><div class="aa-pk">🚨 EMERGENCY</div><h2>${esc(v.emergency.icon)} ${esc(v.emergency.title)}</h2><p>${esc(v.emergency.text)}</p><p class="muted">${m.ghost ? 'Ghost chores coming up…' : 'Get ready to pick a station!'}</p></div>`; }
    else if (v.phase === 'shift') { feel(ctx, 'sh', v.round, 'turn'); const r = shiftPhone(v, ctx); html += r.html; bind = r.bind; }
    else if (v.phase === 'report') html += reportPhone(v, ctx);
    else if (v.phase === 'discuss') { const r = discussPhone(v, ctx); html += r.html; bind = r.bind; }
    else if (v.phase === 'vote') { feel(ctx, 'vo', v.round, m.ghost ? 'tap' : 'turn'); const r = votePhone(v, ctx); html += r.html; bind = r.bind; }
    else if (v.phase === 'eject') html += ejectPhone(v, ctx);
    else if (v.phase === 'over') html += overPhone(v, ctx);
    if (v.phase !== 'roles' && v.phase !== 'over') html += notes(v);
    paint(el, html, key + (P.say ? ':' + P.say.kind + (P.say.id || '') : ''));
    const pk = el.querySelector('#aa-peek');
    if (pk) pk.onclick = () => { P.peek = !P.peek; clearTimeout(P.peekT); if (P.peek) P.peekT = setTimeout(() => { P.peek = false; ctx.redraw(); }, 3500); haptic(ctx, 'tap'); ctx.redraw(); };
    const op = el.querySelector('#aa-open');
    if (op) op.onclick = () => { P.opened = v.round + ':' + m.role; haptic(ctx, m.side === 'aliens' ? 'buzz' : 'success'); ctx.sfx(m.side === 'aliens' ? 'eerie' : 'chime'); ctx.redraw(); };
    if (bind) bind(el);
  }

  BOX.games.alien = {
    name: 'Alien Abduction', icon: '🛸', lobbyTv,
    about: 'Some of the crew are secretly aliens. Fix the ship, spot the saboteurs, and pop them out in a bubble pod before the Biscuit breaks down.',
    how: [
      'Everyone gets a secret role: crew, or one of the hidden 👽 aliens. The 🔬 Scanner and 🔧 Engineer help the crew; the 🎭 Mimic fools the Scanner.',
      'Each shift a system breaks. Pick a repair station on your phone; aliens can 💥 sabotage instead of fixing.',
      'The TV shows how many sabotages hit, but not who. No sabotage = a clean repair and the ship jumps closer to home.',
      'Talk it out, post claims from your phone (📍 where you were, 🤨 who you suspect), then vote someone into the bubble pod, or skip.',
      'Crew win by reaching home or catching every alien. Aliens win by breaking a system, matching the crew’s numbers, or running out the fuel.',
      'Ejected players become 👻 ghosts: they patch systems and whisper suspects.',
    ],
    music: (s) => ({ roles: 'intro', emergency: 'alarm', shift: 'think', report: 'reveal', discuss: 'play', vote: 'think', eject: 'reveal', over: s.over && s.over.winner === 'aliens' ? 'lose' : 'finale' }[s.phase] || 'play'),
    fx: { roles: 'eerie', alarm: 'siren', shift: 'click', sabotage: 'explosion', jump: 'whoosh', discuss: 'pop', say: 'pop', vote: 'ballot', gotcha: 'triumph', oops: 'wail', skip: 'shrug', win: 'win', lose: 'lose' },
    tv, phone,
  };
})();
