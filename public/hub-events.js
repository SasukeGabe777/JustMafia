// The title screen's seasonal background (public/hub.html). Every event in public/shared/seasons.js
// gets its own animated scene behind the menu: falling leaves for Harvest Fest, snow and northern
// lights for Frostival, a blood-red moon with bats for the Blood Moon, fireworks, bubbles, sky
// lanterns, and so on (all original, drawn on one <canvas>). With no event (or an unknown kind) a
// soft party-light scene keeps the usual look.
//
// Kept gentle so the game tiles stay readable: the scene lives at the edges (sky, a horizon of
// silhouettes) and in small, slow particles; it is darkened toward the middle by CSS (hub.css
// .ev-bg + .ev-shade). Performance: the still parts are painted once per resize on an offscreen
// canvas, particles are capped by screen area, it runs at ~30 fps, pauses in a hidden tab and,
// with prefers-reduced-motion, draws one still frame. Testing: /?eventDate=YYYY-MM-DD previews
// any date's event (seasons.js clock()).
(function () {
  const SZ = window.MT_SEASONS;
  const season = SZ && SZ.currentSeason ? SZ.currentSeason() : null;
  const PI = Math.PI, TAU = PI * 2;
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const rng = (seed) => () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- little drawings ----------
  const sprites = new Map();
  // A soft glowing dot (pre-rendered once per colour and size): cheap glows without shadowBlur.
  function glowSprite(c, r) {
    const key = c + r; if (sprites.has(key)) return sprites.get(key); if (sprites.size > 160) sprites.clear();
    const cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(r * 2); const g = cv.getContext('2d');
    const gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, c); gr.addColorStop(0.35, c.replace(/[\d.]+\)$/, (m) => String(parseFloat(m) * 0.45) + ')')); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); sprites.set(key, cv); return cv;
  }
  const dot = (g, x, y, c, r) => { const s = glowSprite(c, Math.max(2, Math.round(r))); g.drawImage(s, x - s.width / 2, y - s.height / 2); };
  const heartPath = (g, r) => { g.beginPath(); g.moveTo(0, r * 0.95); g.bezierCurveTo(-r * 1.7, -r * 0.2, -r * 0.75, -r * 1.45, 0, -r * 0.5); g.bezierCurveTo(r * 0.75, -r * 1.45, r * 1.7, -r * 0.2, 0, r * 0.95); g.closePath(); };
  const starPath = (g, r, inner = 0.45) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, d = i % 2 ? r * inner : r; g.lineTo(Math.cos(a) * d, Math.sin(a) * d); } g.closePath(); };
  const SHAPES = {
    leaf: (g, p) => { g.beginPath(); g.moveTo(0, -p.r); g.quadraticCurveTo(p.r * 0.9, -p.r * 0.2, 0, p.r); g.quadraticCurveTo(-p.r * 0.9, -p.r * 0.2, 0, -p.r); g.fillStyle = p.c; g.fill(); g.strokeStyle = 'rgba(60,20,0,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -p.r); g.lineTo(0, p.r * 1.3); g.stroke(); },
    maple: (g, p) => { g.save(); g.scale(p.r / 10, p.r / 10); g.beginPath(); const pts = [[0, -10], [2.4, -4.6], [6.6, -6.2], [5.2, -1.4], [9.4, 0.4], [5, 2.6], [5.8, 6], [1.2, 4.2], [0, 10], [-1.2, 4.2], [-5.8, 6], [-5, 2.6], [-9.4, 0.4], [-5.2, -1.4], [-6.6, -6.2], [-2.4, -4.6]]; pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = p.c; g.fill(); g.restore(); },
    petal: (g, p) => { g.beginPath(); g.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, TAU); g.fillStyle = p.c; g.fill(); g.beginPath(); g.ellipse(-p.r * 0.2, -p.r * 0.1, p.r * 0.4, p.r * 0.2, 0, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill(); },
    heart: (g, p) => { heartPath(g, p.r); g.fillStyle = p.c; g.fill(); },
    flake: (g, p) => { if (p.r < 3) { dot(g, 0, 0, 'rgba(255,255,255,0.9)', p.r * 2.2); return; } g.strokeStyle = p.c; g.lineWidth = Math.max(1, p.r / 4); g.lineCap = 'round'; g.beginPath(); for (let k = 0; k < 3; k++) { const a = k * PI / 3; g.moveTo(Math.cos(a) * p.r, Math.sin(a) * p.r); g.lineTo(-Math.cos(a) * p.r, -Math.sin(a) * p.r); } g.stroke(); },
    confetti: (g, p) => { g.scale(1, Math.cos(p.ph * 3 + p.rot * 2)); g.fillStyle = p.c; g.fillRect(-p.r, -p.r * 0.55, p.r * 2, p.r * 1.1); },
    sprinkle: (g, p) => { g.fillStyle = p.c; g.beginPath(); g.ellipse(0, 0, p.r, p.r * 0.32, 0, 0, TAU); g.fill(); },
    clover: (g, p) => { for (let k = 0; k < 4; k++) { g.save(); g.rotate(k * PI / 2 + PI / 4); g.translate(0, -p.r * 0.6); g.rotate(PI); heartPath(g, p.r * 0.6); g.fillStyle = p.c; g.fill(); g.restore(); } g.strokeStyle = p.c; g.lineWidth = p.r * 0.22; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(p.r * 0.5, p.r * 1.2, p.r * 0.3, p.r * 1.8); g.stroke(); },
    coin: (g, p) => { g.scale(Math.cos(p.ph * 2 + p.rot * 3), 1); g.beginPath(); g.arc(0, 0, p.r, 0, TAU); g.fillStyle = '#ffd25a'; g.fill(); g.strokeStyle = '#b8862a'; g.lineWidth = 1.2; g.stroke(); },
    lantern: (g, p) => { dot(g, 0, 0, 'rgba(255,140,60,0.55)', p.r * 3.4); g.fillStyle = p.c; g.beginPath(); g.moveTo(-p.r * 0.7, -p.r); g.lineTo(p.r * 0.7, -p.r); g.quadraticCurveTo(p.r * 1.05, 0, p.r * 0.55, p.r); g.lineTo(-p.r * 0.55, p.r); g.quadraticCurveTo(-p.r * 1.05, 0, -p.r * 0.7, -p.r); g.fill(); g.fillStyle = 'rgba(255,240,180,0.85)'; g.beginPath(); g.ellipse(0, p.r * 0.8, p.r * 0.35, p.r * 0.2, 0, 0, TAU); g.fill(); },
    bubble: (g, p) => { g.beginPath(); g.arc(0, 0, p.r, 0, TAU); g.strokeStyle = 'rgba(200,245,255,0.55)'; g.lineWidth = 1.2; g.stroke(); g.fillStyle = 'rgba(160,230,255,0.08)'; g.fill(); g.beginPath(); g.arc(-p.r * 0.35, -p.r * 0.35, p.r * 0.25, 0, TAU); g.fillStyle = 'rgba(255,255,255,0.55)'; g.fill(); },
    spark: (g, p) => { dot(g, 0, 0, p.c, p.r * 3); },
    star: (g, p) => { starPath(g, p.r); g.fillStyle = p.c; g.fill(); },
    feather: (g, p) => { g.beginPath(); g.ellipse(0, 0, p.r * 0.35, p.r, 0, 0, TAU); g.fillStyle = p.c; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -p.r); g.lineTo(0, p.r * 1.3); g.stroke(); },
    seed: (g, p) => { g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 0.8; g.beginPath(); for (let k = 0; k < 8; k++) { const a = -PI + k * PI / 7; g.moveTo(0, 0); g.lineTo(Math.cos(a) * p.r, Math.sin(a) * p.r); } g.moveTo(0, 0); g.lineTo(0, p.r * 1.3); g.stroke(); },
    plane: (g, p) => { g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(p.r, 0); g.lineTo(-p.r, -p.r * 0.5); g.lineTo(-p.r * 0.5, 0); g.lineTo(-p.r, p.r * 0.55); g.closePath(); g.fill(); g.fillStyle = 'rgba(200,210,230,0.85)'; g.beginPath(); g.moveTo(p.r, 0); g.lineTo(-p.r * 0.5, 0); g.lineTo(-p.r, p.r * 0.55); g.closePath(); g.fill(); },
    gear: (g, p) => { g.beginPath(); for (let k = 0; k < 20; k++) { const a = k * PI / 10, d = k % 2 ? p.r * 0.78 : p.r; g.lineTo(Math.cos(a) * d, Math.sin(a) * d); } g.closePath(); g.fillStyle = p.c; g.fill(); g.beginPath(); g.arc(0, 0, p.r * 0.32, 0, TAU); g.fillStyle = 'rgba(10,14,24,0.9)'; g.fill(); },
    note: (g, p) => { g.fillStyle = p.c; g.beginPath(); g.ellipse(0, p.r, p.r * 0.5, p.r * 0.36, -0.4, 0, TAU); g.fill(); g.fillRect(p.r * 0.38, -p.r, p.r * 0.16, p.r * 2); },
  };

  // ---------- particles ----------
  // spec: { n, shape, colors, size: [min, max], vy: [min, max] (px/s, - rises), vx, sway, spin, alpha }
  function makeField(spec, w, h, R) {
    const area = Math.max(0.35, Math.min(1.15, (w * h) / (1920 * 1080)));
    const n = Math.max(4, Math.round(spec.n * area)), list = [];
    for (let i = 0; i < n; i++) list.push(spawn(spec, w, h, R, true));
    return list;
  }
  function spawn(spec, w, h, R, anywhere) {
    const up = spec.vy[0] < 0, r = lerp(spec.size[0], spec.size[1], R() ** 1.6);
    const k = (r - spec.size[0]) / Math.max(0.01, spec.size[1] - spec.size[0]); // bigger = nearer = faster
    const x0 = spec.zone ? lerp(spec.zone[0], spec.zone[1], R()) * w : R() * w;
    return { x: x0, y: anywhere ? R() * h : up ? h + 30 : -30, r, vy: lerp(spec.vy[0], spec.vy[1], k * 0.7 + R() * 0.3), vx: (spec.vx || 0) * (0.6 + R() * 0.8), sway: (spec.sway || 0) * (0.5 + R()), ph: R() * TAU, rot: R() * TAU, vr: (spec.spin || 0) * (R() - 0.5) * 2, c: spec.colors[Math.floor(R() * spec.colors.length)], a: lerp(spec.alpha ? spec.alpha[0] : 0.6, spec.alpha ? spec.alpha[1] : 0.9, k) };
  }
  function runField(g, list, spec, t, dt, w, h, R) {
    const draw = SHAPES[spec.shape];
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      p.y += p.vy * dt; p.x += (p.vx + Math.sin(t * 0.9 + p.ph) * p.sway) * dt; p.rot += p.vr * dt;
      if ((p.vy > 0 && p.y > h + 40) || (p.vy < 0 && p.y < -40) || p.x < -60 || p.x > w + 60) { list[i] = spawn(spec, w, h, R, false); if (spec.vx && Math.abs(spec.vx) > Math.abs(spec.vy[1])) { list[i].x = spec.vx > 0 ? -40 : w + 40; list[i].y = R() * h * (spec.band || 1); } continue; }
      g.save(); g.globalAlpha = p.a * (spec.fade ? Math.max(0, Math.min(1, (spec.vy[0] < 0 ? p.y / (h * spec.fade) : (h - p.y) / (h * spec.fade)))) : 1); g.translate(p.x, p.y); g.rotate(p.rot); draw(g, p); g.restore();
    }
  }

  // ---------- still parts (painted once per size) ----------
  function sky(g, w, h, stops) { const gr = g.createLinearGradient(0, 0, 0, h); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  function starsStill(g, w, h, n, R, maxY = 0.75, a = 0.7) { for (let i = 0; i < n; i++) { const x = R() * w, y = R() * h * maxY, r = R() < 0.1 ? 1.6 : R() * 1.1 + 0.3; g.globalAlpha = a * (0.35 + R() * 0.65); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } g.globalAlpha = 1; }
  function hills(g, w, h, base, amp, color, R, bumps = 4) {
    const ys = Array.from({ length: bumps + 2 }, () => R()), step = w / bumps;
    g.beginPath(); g.moveTo(0, h); for (let i = 0; i <= bumps + 1; i++) { const x = i * step, y = h - base - ys[i] * amp; if (!i) g.lineTo(x, y); else { const px = (i - 0.5) * step, py = h - base - (ys[i - 1] + ys[i]) / 2 * amp - amp * 0.25; g.quadraticCurveTo(px, py, x, y); } }
    g.lineTo(w, h); g.closePath(); g.fillStyle = color; g.fill();
  }
  function pines(g, w, h, base, color, R, minH, maxH, gap = 26) { g.fillStyle = color; for (let x = -10; x < w + 20; x += gap * (0.6 + R() * 0.8)) { const th = lerp(minH, maxH, R()), tw = th * 0.42, y = h - base; g.beginPath(); g.moveTo(x, y - th); g.lineTo(x + tw / 2, y); g.lineTo(x - tw / 2, y); g.closePath(); g.fill(); } g.fillRect(0, h - base, w, base); }
  function skyline(g, w, h, base, color, R, lit) {
    g.fillStyle = color; let x = 0; const rects = [];
    while (x < w) { const bw = 30 + R() * 70, bh = base + R() * base * 2.2; g.fillRect(x, h - bh, bw - 4, bh); rects.push([x, h - bh, bw - 4, bh]); if (R() < 0.3) { g.fillRect(x + bw / 2 - 3, h - bh - 18, 3, 18); } x += bw; }
    if (lit) for (const [rx, ry, rw, rh] of rects) for (let yy = ry + 8; yy < h - 8; yy += 12) for (let xx = rx + 6; xx < rx + rw - 6; xx += 10) if (R() < 0.18) { g.fillStyle = lit[Math.floor(R() * lit.length)]; g.fillRect(xx, yy, 4, 5); }
  }
  function moon(g, x, y, r, c, glowC, craters = true) {
    const gr = g.createRadialGradient(x, y, r * 0.5, x, y, r * 3.2); gr.addColorStop(0, glowC); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = c; g.fill();
    if (craters) { g.fillStyle = 'rgba(0,0,0,0.12)'; for (const [dx, dy, rr] of [[-0.3, -0.2, 0.2], [0.25, 0.15, 0.14], [0.05, 0.42, 0.1], [-0.4, 0.3, 0.08]]) { g.beginPath(); g.arc(x + dx * r, y + dy * r, rr * r, 0, TAU); g.fill(); } }
  }
  const sz = (w, h) => Math.min(w, h * 1.6); // a size unit that suits phones and TVs

  // ---------- moving extras ----------
  function fireworks(g, t, w, h, S, colors, maxY = 0.45) {
    S.fw = S.fw || []; S.fwNext = S.fwNext || 0;
    if (t > S.fwNext) { S.fwNext = t + 0.5 + S.R() * 0.9; const side = S.R() < 0.3; S.fw.push({ x: side ? (S.R() < 0.5 ? 0.03 + S.R() * 0.06 : 0.91 + S.R() * 0.06) * w : (0.05 + S.R() * 0.9) * w, y: side ? (0.1 + S.R() * 0.8) * h : (0.03 + S.R() * maxY) * h, t0: t, c: colors[Math.floor(S.R() * colors.length)], n: 14 + Math.floor(S.R() * 8), r: sz(w, h) * (0.05 + S.R() * 0.05) }); }
    S.fw = S.fw.filter((f) => t - f.t0 < 2.2);
    for (const f of S.fw) {
      const k = (t - f.t0) / 2.2; if (k < 0.18) { const q = k / 0.18; dot(g, f.x, lerp(h, f.y, q), 'rgba(255,240,200,0.9)', 5); continue; }
      const e = (k - 0.18) / 0.82, rad = f.r * (1 - (1 - e) ** 3); g.globalAlpha = Math.max(0, 1 - e) * 0.85;
      for (let i = 0; i < f.n; i++) { const a = (i / f.n) * TAU, x = f.x + Math.cos(a) * rad, y = f.y + Math.sin(a) * rad + e * e * 30; dot(g, x, y, f.c, 6); }
      g.globalAlpha = 1;
    }
  }
  function streaks(g, t, w, h, S, every = 1.6, len = 140) {
    S.st = S.st || []; S.stNext = S.stNext || 0.5;
    if (t > S.stNext) { S.stNext = t + every * (0.5 + S.R()); S.st.push({ x: (0.3 + S.R() * 0.8) * w, y: S.R() * h * 0.35, t0: t, v: 700 + S.R() * 500 }); }
    S.st = S.st.filter((s) => t - s.t0 < 1.4);
    for (const s of S.st) { const k = (t - s.t0) / 1.4, d = (t - s.t0) * s.v, x = s.x - d * 0.85, y = s.y + d * 0.5; const gr = g.createLinearGradient(x, y, x + len * 0.85, y - len * 0.5); gr.addColorStop(0, `rgba(255,255,255,${Math.max(0, 0.95 * (1 - k)).toFixed(3)})`); gr.addColorStop(1, 'rgba(160,200,255,0)'); g.strokeStyle = gr; g.lineWidth = 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + len * 0.85, y - len * 0.5); g.stroke(); g.globalAlpha = Math.max(0, 1 - k); dot(g, x, y, 'rgba(255,255,255,1)', 6); g.globalAlpha = 1; }
  }
  function twinkles(g, t, S) { for (const s of S.tw) { const k = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph); g.globalAlpha = k; dot(g, s.x, s.y, 'rgba(255,255,255,0.9)', s.r); } g.globalAlpha = 1; }
  const makeTwinkles = (w, h, R, n, maxY = 0.6) => Array.from({ length: n }, () => ({ x: R() * w, y: R() * h * maxY, r: 3 + R() * 4, sp: 1 + R() * 2, ph: R() * TAU }));
  function bats(g, t, w, h, S, n = 5, color = 'rgba(10,0,6,0.85)') {
    for (let i = 0; i < n; i++) {
      const sp = 0.025 + (i % 3) * 0.012, p = (t * sp + i / n) % 1, x = lerp(-60, w + 60, p), y = h * (0.12 + ((i * 37) % 30) / 100) + Math.sin(t * 2 + i) * 18, s = 0.8 + (i % 3) * 0.35, fl = Math.sin(t * 10 + i * 2) * 6 * s;
      g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = color; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-6, -6 - fl, -16, -2 - fl); g.quadraticCurveTo(-11, 0, -8, 4); g.quadraticCurveTo(-4, 1, 0, 4); g.quadraticCurveTo(4, 1, 8, 4); g.quadraticCurveTo(11, 0, 16, -2 - fl); g.quadraticCurveTo(6, -6 - fl, 0, 0); g.fill(); g.restore();
    }
  }
  function waves(g, t, w, h, base, color, amp = 8, speed = 1, len = 120) { g.fillStyle = color; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w + 10; x += 10) g.lineTo(x, h - base + Math.sin(x / len * TAU / 2 + t * speed) * amp + Math.sin(x / (len * 0.43) + t * speed * 1.7) * amp * 0.4); g.lineTo(w, h); g.closePath(); g.fill(); }
  function aurora(g, t, w, h) {
    for (let k = 0; k < 3; k++) {
      const c = ['rgba(90,255,170,', 'rgba(140,110,255,', 'rgba(80,200,255,'][k], y0 = h * (0.16 + k * 0.07);
      g.beginPath(); for (let x = 0; x <= w; x += 16) g.lineTo(x, y0 + Math.sin(x * 0.004 + t * 0.35 + k * 1.7) * h * 0.05 + Math.sin(x * 0.011 + t * 0.6 + k) * h * 0.015);
      for (let x = w; x >= 0; x -= 16) g.lineTo(x, y0 + h * 0.12 + Math.sin(x * 0.004 + t * 0.35 + k * 1.7 + 0.6) * h * 0.04);
      g.closePath(); const gr = g.createLinearGradient(0, y0 - h * 0.05, 0, y0 + h * 0.16); gr.addColorStop(0, c + '0)'); gr.addColorStop(0.4, c + '0.16)'); gr.addColorStop(1, c + '0)'); g.fillStyle = gr; g.fill();
    }
  }
  function grid(g, t, w, h) {
    const hy = h * 0.68; g.strokeStyle = 'rgba(255,58,209,0.35)'; g.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { const k = ((i + (t * 0.5) % 1) / 14) ** 2, y = hy + k * (h - hy); g.globalAlpha = 0.2 + k * 0.8; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.globalAlpha = 0.6; for (let i = -16; i <= 16; i++) { g.beginPath(); g.moveTo(w / 2 + i * w * 0.012, hy); g.lineTo(w / 2 + i * w * 0.12, h); g.stroke(); } g.globalAlpha = 1;
  }
  function banners(g, t, w, h, colors, y0, n) {
    // strings of cut-paper flags across the top, swaying
    for (let row = 0; row < 1; row++) {
      const y = y0 + row * h * 0.07, sag = Math.min(26, h * 0.025), cnt = Math.ceil(w / (n * (row ? 1.2 : 1)));
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x <= w; x += 20) g.lineTo(x, y + Math.sin((x / w) * PI) * sag); g.stroke();
      for (let i = 0; i < cnt; i++) { const x = (i + 0.5 + row * 0.5) * (w / cnt), yy = y + Math.sin((x / w) * PI) * sag, sw = Math.sin(t * 1.5 + i + row) * 0.12, fw = Math.min(28, w / cnt * 0.8), fh = fw * 1.1;
        g.save(); g.translate(x, yy); g.rotate(sw); g.globalAlpha = 0.6; g.fillStyle = colors[(i + row * 2) % colors.length]; g.beginPath(); g.moveTo(-fw / 2, 0); g.lineTo(fw / 2, 0); g.lineTo(fw / 2, fh); for (let k = 0; k < 4; k++) g.lineTo(fw / 2 - (k + 0.5) * fw / 4, fh - (k % 2 ? 0 : fh * 0.12)); g.lineTo(-fw / 2, fh); g.closePath(); g.fill();
        g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(0, fh * 0.42, fw * 0.16, 0, TAU); g.fill(); for (const dx of [-0.28, 0.28]) { g.beginPath(); g.arc(dx * fw, fh * 0.7, fw * 0.07, 0, TAU); g.fill(); } g.restore(); }
    }
  }

  // ---------- the scenes ----------
  // sky: gradient stops (dark at the top so white text reads); paint(g, w, h, R): still layer;
  // fields: particle specs; frame(g, t, dt, w, h, S): extra animation over the particles.
  const SCENES = {
    newyear: { sky: ['#0c0a2a', '#1a1640', '#2a1a4a'], paint(g, w, h, R) { starsStill(g, w, h, 160, R, 0.7); skyline(g, w, h, h * 0.06, '#0a0820', R, ['rgba(255,210,90,0.7)', 'rgba(255,255,255,0.5)']); },
      fields: [{ n: 70, shape: 'confetti', colors: ['#ffd25a', '#f4f1ff', '#ff4f9a', '#b8c0d0'], size: [3, 6], vy: [30, 70], sway: 25, spin: 3, alpha: [0.35, 0.75] }], frame: (g, t, dt, w, h, S) => fireworks(g, t, w, h, S, ['rgba(255,210,90,0.95)', 'rgba(255,255,255,0.95)', 'rgba(255,90,170,0.9)'], 0.14) },
    lantern: { sky: ['#1a0610', '#4a0d18', '#6a1a1a'], paint(g, w, h, R) { starsStill(g, w, h, 70, R, 0.5, 0.5); moon(g, w * 0.82, h * 0.18, sz(w, h) * 0.045, '#ffe8b0', 'rgba(255,200,120,0.25)'); hills(g, w, h, h * 0.04, h * 0.1, '#2a0408', R, 5); },
      fields: [{ n: 26, shape: 'lantern', colors: ['#ff6a3a', '#ff8a3a', '#ffb04a', '#ff4a3a'], size: [6, 16], vy: [-30, -14], sway: 14, spin: 0.2, alpha: [0.5, 0.95], fade: 0.25 }] },
    hearts: { sky: ['#2a0a24', '#4a1035', '#5a1a40'], paint(g, w, h, R) { for (let i = 0; i < 18; i++) dot(g, R() * w, R() * h, `rgba(255,${120 + Math.floor(R() * 80)},180,0.18)`, 30 + R() * 60); },
      fields: [{ n: 40, shape: 'heart', colors: ['#ff5c8a', '#ff8fb4', '#ffd0de', '#e8326a'], size: [5, 16], vy: [-40, -16], sway: 18, spin: 0.4, alpha: [0.3, 0.8], fade: 0.2 }] },
    carnival: { sky: ['#1a0a30', '#2a1240', '#1f2a1a'], paint(g, w, h, R) { for (let i = 0; i < 5; i++) { const x = (i + 0.5) / 5 * w, c = ['rgba(180,92,255,0.10)', 'rgba(47,154,74,0.10)', 'rgba(255,210,63,0.10)'][i % 3]; g.fillStyle = c; g.beginPath(); g.moveTo(x - 20, h); g.lineTo(x + 20, h); g.lineTo(x + (i - 2) * w * 0.12 + 140, 0); g.lineTo(x + (i - 2) * w * 0.12 - 140, 0); g.closePath(); g.fill(); } },
      fields: [{ n: 50, shape: 'confetti', colors: ['#b45cff', '#2f9a4a', '#ffd23f', '#ff4f9a'], size: [3, 7], vy: [30, 70], sway: 30, spin: 3, alpha: [0.35, 0.8] }, { n: 12, shape: 'feather', colors: ['#b45cff', '#2f9a4a', '#ffd23f'], size: [8, 16], vy: [14, 30], sway: 40, spin: 0.8, alpha: [0.35, 0.7] }] },
    neon: { sky: ['#0a0418', '#1a0a3a', '#3a0a4a'], paint(g, w, h, R) { starsStill(g, w, h, 90, R, 0.5, 0.6); const sx = w / 2, sy = h * 0.6, r = sz(w, h) * 0.13; const gr = g.createLinearGradient(0, sy - r, 0, sy + r); gr.addColorStop(0, '#ffd23f'); gr.addColorStop(1, '#ff3ad1'); g.save(); g.globalAlpha = 0.55; g.beginPath(); g.arc(sx, sy, r, PI, TAU); g.fillStyle = gr; g.fill(); g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 6; i++) g.fillRect(sx - r, sy - r * 0.55 + i * r * 0.1, r * 2, 2 + i * 1.6); g.restore(); skyline(g, w, h * 0.7, h * 0.02, '#12061f', R, ['rgba(255,58,209,0.8)', 'rgba(58,232,255,0.8)']); g.fillStyle = '#0a0418'; g.fillRect(0, h * 0.68, w, h * 0.32); },
      fields: [{ n: 30, shape: 'spark', colors: ['rgba(255,58,209,0.8)', 'rgba(58,232,255,0.8)', 'rgba(180,92,255,0.8)'], size: [1.5, 3.5], vy: [-14, -6], sway: 6, alpha: [0.3, 0.8], fade: 0.3 }], frame: (g, t, dt, w, h) => grid(g, t, w, h) },
    clover: { sky: ['#06261a', '#0f4a2a', '#164a30'], paint(g, w, h, R) { const cx = w * 0.5, cy = h * 1.05, r0 = sz(w, h) * 0.75; ['rgba(255,74,74,', 'rgba(255,154,58,', 'rgba(255,210,63,', 'rgba(46,204,113,', 'rgba(58,160,255,', 'rgba(138,90,255,'].forEach((c, i) => { g.beginPath(); g.arc(cx, cy, r0 - i * 16, PI, TAU); g.strokeStyle = c + '0.13)'; g.lineWidth = 16; g.stroke(); }); hills(g, w, h, h * 0.03, h * 0.08, '#062a14', R, 5); },
      fields: [{ n: 34, shape: 'clover', colors: ['#2ecc71', '#5ae08a', '#1fa85a'], size: [5, 13], vy: [20, 45], sway: 22, spin: 0.9, alpha: [0.3, 0.75] }, { n: 10, shape: 'coin', colors: ['#ffd25a'], size: [4, 7], vy: [25, 50], sway: 10, spin: 1, alpha: [0.4, 0.8] }] },
    bloom: { sky: ['#1a1030', '#3a1a48', '#4a2a4a'], paint(g, w, h, R) { const branch = (x, y, dir, s) => { g.strokeStyle = '#1a0a14'; g.lineWidth = 10 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + dir * 120 * s, y + 40 * s, x + dir * 260 * s, y + 20 * s); g.stroke(); g.lineWidth = 5 * s; g.beginPath(); g.moveTo(x + dir * 120 * s, y + 30 * s); g.quadraticCurveTo(x + dir * 170 * s, y + 80 * s, x + dir * 210 * s, y + 95 * s); g.stroke(); for (let i = 0; i < 26; i++) { const bx = x + dir * R() * 260 * s, by = y + R() * 100 * s; for (let k = 0; k < 5; k++) { g.fillStyle = R() < 0.5 ? 'rgba(255,170,210,0.85)' : 'rgba(255,215,235,0.85)'; g.beginPath(); g.ellipse(bx + Math.cos(k * 1.26) * 5 * s, by + Math.sin(k * 1.26) * 5 * s, 4 * s, 3 * s, k, 0, TAU); g.fill(); } } }; const s = Math.max(0.5, Math.min(0.85, w / 1900)); branch(-10, -h * 0.03, 1, s); branch(w + 10, h * (w < 700 ? 0.42 : 0.12), -1, s); hills(g, w, h, h * 0.02, h * 0.07, '#1f1430', R, 5); },
      fields: [{ n: 50, shape: 'petal', colors: ['#ffaad2', '#ffd0e6', '#ff8fc6', '#fff0f6'], size: [3, 8], vy: [18, 45], sway: 30, spin: 1.5, alpha: [0.35, 0.85] }] },
    earth: { sky: ['#06202a', '#0f3a3a', '#16402a'], paint(g, w, h, R) { starsStill(g, w, h, 60, R, 0.4, 0.4); const r = sz(w, h) * 0.5, cx = w * 0.5, cy = h + r * 0.62; const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.2, cx, cy, r); gr.addColorStop(0, '#2a8ad0'); gr.addColorStop(1, '#0a3a6a'); g.save(); g.globalAlpha = 0.55; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fillStyle = gr; g.fill(); g.clip(); g.fillStyle = '#3a9a4a'; for (const [dx, dy, rx, ry] of [[-0.4, -0.5, 0.3, 0.16], [0.2, -0.7, 0.22, 0.1], [0.45, -0.35, 0.18, 0.2], [-0.1, -0.25, 0.14, 0.08]]) { g.beginPath(); g.ellipse(cx + dx * r, cy + dy * r, rx * r, ry * r, 0.3, 0, TAU); g.fill(); } g.restore(); g.beginPath(); g.arc(cx, cy, r + 6, PI * 1.1, PI * 1.9); g.strokeStyle = 'rgba(120,220,255,0.25)'; g.lineWidth = 10; g.stroke(); pines(g, w, h, h * 0.015, 'rgba(6,30,20,0.9)', R, h * 0.05, h * 0.12, 30); },
      fields: [{ n: 26, shape: 'leaf', colors: ['#5ab03a', '#7ad04a', '#3a8a2a'], size: [5, 10], vy: [15, 35], sway: 30, spin: 1.2, alpha: [0.3, 0.7] }, { n: 16, shape: 'seed', colors: ['#fff'], size: [4, 7], vy: [-12, -4], vx: 18, sway: 12, alpha: [0.3, 0.7] }] },
    fiesta: { sky: ['#0a1f3a', '#0f3a5a', '#1a4a5a'], paint(g, w, h, R) { starsStill(g, w, h, 50, R, 0.5, 0.4); hills(g, w, h, h * 0.03, h * 0.07, '#082a3a', R, 5); },
      fields: [{ n: 40, shape: 'confetti', colors: ['#ff5a9a', '#ffe14a', '#3ad0c0', '#ff7a1a', '#b45cff'], size: [3, 6], vy: [25, 60], sway: 25, spin: 3, alpha: [0.3, 0.75] }, { n: 12, shape: 'petal', colors: ['#ff5a9a', '#ffe14a', '#ff7a1a'], size: [5, 9], vy: [20, 40], sway: 20, spin: 1, alpha: [0.35, 0.7] }],
      frame: (g, t, dt, w, h) => banners(g, t, w, h, ['#ff5a9a', '#ffe14a', '#3ad0c0', '#ff7a1a', '#b45cff', '#7ad04a'], -3, 44) },
    dino: { sky: ['#1a0e08', '#3a1a0a', '#5a2a10'], paint(g, w, h, R) {
      const vx = w * 0.78, vb = h, vw = sz(w, h) * 0.32, vh = h * 0.3; g.fillStyle = '#1a0c06'; g.beginPath(); g.moveTo(vx - vw, vb); g.lineTo(vx - vw * 0.18, vb - vh); g.lineTo(vx + vw * 0.18, vb - vh); g.lineTo(vx + vw, vb); g.closePath(); g.fill(); const lg = g.createLinearGradient(0, vb - vh, 0, vb - vh * 0.6); lg.addColorStop(0, 'rgba(255,120,40,0.7)'); lg.addColorStop(1, 'rgba(255,120,40,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(vx - vw * 0.18, vb - vh); g.lineTo(vx + vw * 0.18, vb - vh); g.lineTo(vx + vw * 0.05, vb - vh * 0.6); g.lineTo(vx - vw * 0.1, vb - vh * 0.65); g.fill();
      hills(g, w, h, h * 0.03, h * 0.06, '#120804', R, 6);
      const dinoS = (x, s) => { g.save(); g.translate(x, h - h * 0.04); g.scale(s, s); g.fillStyle = '#120804'; g.beginPath(); g.moveTo(-60, 0); g.quadraticCurveTo(-40, -40, 0, -42); g.quadraticCurveTo(30, -44, 40, -80); g.quadraticCurveTo(44, -118, 66, -120); g.quadraticCurveTo(80, -118, 76, -110); g.quadraticCurveTo(62, -110, 56, -90); g.quadraticCurveTo(50, -50, 40, -24); g.lineTo(40, 0); g.lineTo(28, 0); g.lineTo(26, -14); g.lineTo(-12, -14); g.lineTo(-14, 0); g.lineTo(-26, 0); g.lineTo(-30, -16); g.quadraticCurveTo(-70, -10, -110, 4); g.closePath(); g.fill(); g.restore(); };
      const k = Math.max(0.5, Math.min(1.3, h / 900)); dinoS(w * 0.12, k); dinoS(w * 0.3, k * 0.6);
      for (let i = 0; i < 4; i++) { const px = w * (0.45 + i * 0.07), ph = h * (0.1 + R() * 0.05); g.fillStyle = '#120804'; g.fillRect(px, h - ph - h * 0.03, 5, ph); for (let k2 = 0; k2 < 5; k2++) { g.save(); g.translate(px + 2, h - ph - h * 0.03); g.rotate(-PI / 2 + (k2 - 2) * 0.55); g.beginPath(); g.ellipse(18, 0, 20, 5, 0, 0, TAU); g.fill(); g.restore(); } } },
      fields: [{ n: 30, shape: 'spark', colors: ['rgba(255,140,40,0.9)', 'rgba(255,200,80,0.9)'], size: [1.5, 3], vy: [-40, -15], sway: 12, alpha: [0.4, 0.9], zone: [0.68, 0.9], fade: 0.5 }],
      frame: (g, t, dt, w, h) => { for (let i = 0; i < 2; i++) { const p = (t * 0.03 + i / 2) % 1, x = lerp(w + 60, -60, p), y = h * (0.15 + i * 0.1) + Math.sin(t + i) * 10, fl = Math.sin(t * 5 + i) * 8; g.save(); g.translate(x, y); g.fillStyle = 'rgba(18,8,4,0.85)'; g.beginPath(); g.moveTo(-4, 0); g.lineTo(-30, -6 - fl); g.lineTo(-10, 4); g.lineTo(10, 4); g.lineTo(30, -6 - fl); g.lineTo(4, 0); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-6, 0); g.lineTo(-16, -4); g.lineTo(-4, 3); g.fill(); g.restore(); } } },
    deepsea: { sky: ['#06264a', '#061a3a', '#030a1a'], paint(g, w, h, R) { for (let i = 0; i < 6; i++) { const x = (0.1 + R() * 0.8) * w, gr = g.createLinearGradient(x, 0, x + w * 0.1, h * 0.8); gr.addColorStop(0, 'rgba(140,220,255,0.10)'); gr.addColorStop(1, 'rgba(140,220,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 30, 0); g.lineTo(x + 30, 0); g.lineTo(x + w * 0.16, h * 0.8); g.lineTo(x + w * 0.04, h * 0.8); g.closePath(); g.fill(); } hills(g, w, h, h * 0.02, h * 0.05, '#020814', R, 7); },
      fields: [{ n: 40, shape: 'bubble', colors: ['#fff'], size: [2, 9], vy: [-50, -18], sway: 12, alpha: [0.3, 0.8] }],
      frame: (g, t, dt, w, h, S) => {
        for (let i = 0; i < 8; i++) { const x = (i + 0.5) / 8 * w + ((i * 53) % 40) - 20; g.strokeStyle = i % 2 ? 'rgba(30,120,90,0.55)' : 'rgba(20,90,70,0.55)'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, h); for (let k = 1; k <= 6; k++) g.lineTo(x + Math.sin(t * 0.8 + k * 0.7 + i) * 10 * k / 6, h - k * h * 0.035); g.stroke(); }
        for (let i = 0; i < 4; i++) { const p = (t * 0.018 + i / 4) % 1, x = w * [0.035, 0.965, 0.515, 0.93][i] + Math.sin(t * 0.3 + i) * 12, y = lerp(h + 60, -80, p), r = sz(w, h) * (0.018 + (i % 2) * 0.01), pulse = 1 + Math.sin(t * 2 + i) * 0.1, c = ['rgba(255,122,208,', 'rgba(122,216,255,', 'rgba(196,138,255,'][i % 3];
          g.save(); g.translate(x, y); dot(g, 0, 0, c + '0.35)', r * 3); g.scale(pulse, 1 / pulse); g.fillStyle = c + '0.4)'; g.beginPath(); g.arc(0, 0, r, PI, 0); g.quadraticCurveTo(0, r * 0.4, -r, 0); g.fill(); g.strokeStyle = c + '0.45)'; g.lineWidth = 1.5; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(k * r * 0.35, r * 0.1); g.quadraticCurveTo(k * r * 0.35 + Math.sin(t * 3 + k) * 6, r * 1.2, k * r * 0.3, r * 2.2); g.stroke(); } g.restore(); }
      } },
    summer: { sky: ['#1a1a4a', '#7a3a6a', '#e8864a'], paint(g, w, h, R) { const sx = w * 0.5, sy = h * 0.8, r = sz(w, h) * 0.1; moon(g, sx, sy, r, '#ffd27a', 'rgba(255,190,100,0.35)', false); const palm = (x, s, dir) => { g.save(); g.translate(x, h); g.scale(s * dir, s); g.fillStyle = '#1a0e1e'; g.beginPath(); g.moveTo(-6, 0); g.quadraticCurveTo(10, -120, 40, -230); g.lineTo(48, -228); g.quadraticCurveTo(20, -120, 8, 0); g.closePath(); g.fill(); g.translate(44, -232); for (let k = 0; k < 6; k++) { g.save(); g.rotate(-PI + k * 0.6 - 0.2); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(50, -20, 100, 14); g.quadraticCurveTo(50, -6, 0, 6); g.fill(); g.restore(); } g.restore(); }; const k = Math.max(0.5, Math.min(1.3, h / 900)); palm(w * 0.06, k, 1); palm(w * 0.95, k * 0.85, -1); },
      fields: [{ n: 18, shape: 'spark', colors: ['rgba(255,230,160,0.7)'], size: [1.5, 3], vy: [-10, -4], sway: 8, alpha: [0.2, 0.6] }],
      frame: (g, t, dt, w, h) => { waves(g, t, w, h, h * 0.1, 'rgba(26,80,130,0.85)', 8, 0.8); waves(g, t + 2, w, h, h * 0.06, 'rgba(16,50,100,0.95)', 6, 1.1, 90); } },
    fireworks: { sky: ['#06081e', '#101a4a', '#1a1a4a'], paint(g, w, h, R) { starsStill(g, w, h, 110, R, 0.6); hills(g, w, h, h * 0.03, h * 0.08, '#05061a', R, 5); },
      frame: (g, t, dt, w, h, S) => fireworks(g, t, w, h, S, ['rgba(255,74,90,0.95)', 'rgba(255,230,128,0.95)', 'rgba(58,232,255,0.9)', 'rgba(180,92,255,0.9)', 'rgba(255,255,255,0.95)'], 0.16) },
    space: { sky: ['#03040f', '#0c0f2e', '#1a1440'], paint(g, w, h, R) { starsStill(g, w, h, 260, R, 1, 0.8); const p = (x, y, r, c1, c2, ring) => { const gr = g.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.globalAlpha = 0.8; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = gr; g.fill(); if (ring) { g.strokeStyle = 'rgba(255,190,120,0.6)'; g.lineWidth = r * 0.12; g.beginPath(); g.ellipse(x, y, r * 1.8, r * 0.42, -0.3, 0, TAU); g.stroke(); } g.globalAlpha = 1; }; const s = sz(w, h); p(w * 0.86, h * 0.22, s * 0.07, '#ffb04a', '#8a3a1a', true); p(w * 0.1, h * 0.75, s * 0.11, '#8a7aff', '#2a1a6a', false); p(w * 0.62, h * 0.88, s * 0.035, '#7ad8ff', '#1a4a8a', false); },
      frame: (g, t, dt, w, h, S) => { twinkles(g, t, S); const p = (t * 0.04) % 1, x = lerp(-80, w + 80, p), y = lerp(h * 0.85, h * 0.1, p); g.save(); g.translate(x, y); g.rotate(-0.6 + PI / 2); g.fillStyle = 'rgba(230,236,250,0.9)'; g.beginPath(); g.ellipse(0, 0, 7, 18, 0, 0, TAU); g.fill(); g.fillStyle = '#ff4a5a'; g.beginPath(); g.moveTo(-7, 8); g.lineTo(-13, 18); g.lineTo(-5, 14); g.fill(); g.beginPath(); g.moveTo(7, 8); g.lineTo(13, 18); g.lineTo(5, 14); g.fill(); dot(g, 0, 26 + Math.sin(t * 30) * 2, 'rgba(255,170,60,0.9)', 12); g.restore(); } },
    meteor: { sky: ['#04031a', '#0d0a30', '#1a1450'], paint(g, w, h, R) { starsStill(g, w, h, 300, R, 1, 0.8); g.save(); g.translate(w * 0.5, h * 0.4); g.rotate(-0.5); const gr = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.5); gr.addColorStop(0, 'rgba(160,140,255,0.16)'); gr.addColorStop(1, 'rgba(160,140,255,0)'); g.scale(1, 0.22); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, w * 0.5, 0, TAU); g.fill(); g.restore(); hills(g, w, h, h * 0.02, h * 0.06, '#03020e', R, 6); },
      frame: (g, t, dt, w, h, S) => { twinkles(g, t, S); streaks(g, t, w, h, S, 1.1, 170); } },
    school: { sky: ['#1c2e26', '#23382c', '#1c2e26'], paint(g, w, h, R) { g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 2; g.lineCap = 'round'; g.font = `${Math.round(sz(w, h) * 0.03)}px 'Comic Sans MS', 'Fredoka', cursive`; g.fillStyle = 'rgba(255,255,255,0.10)'; const words = ['A+', 'abc', '2+2=4', 'E=mc²', '★', 'π', '✏️', 'ABC', '1 2 3', '△ ○ □']; for (let i = 0; i < 16; i++) { g.save(); g.translate(R() * w, R() * h); g.rotate((R() - 0.5) * 0.4); g.fillText(words[i % words.length], 0, 0); g.restore(); } for (let i = 0; i < 6; i++) { g.beginPath(); const x = R() * w, y = R() * h; g.arc(x, y, 20 + R() * 30, 0, PI * (1 + R())); g.stroke(); } g.fillStyle = '#7a5a34'; g.fillRect(0, h - 14, w, 14); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(w * 0.7, h - 20, 40, 6); g.fillStyle = 'rgba(255,200,200,0.7)'; g.fillRect(w * 0.7 + 50, h - 19, 24, 5); },
      fields: [{ n: 9, shape: 'plane', colors: ['#fff'], size: [9, 16], vy: [-8, 8], vx: 70, sway: 25, band: 0.85, alpha: [0.35, 0.7] }] },
    robot: { sky: ['#0a0e18', '#121a28', '#1c2333'], paint(g, w, h, R) { g.strokeStyle = 'rgba(74,224,255,0.12)'; g.lineWidth = 2; for (let i = 0; i < 26; i++) { let x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { if (R() < 0.5) x += (R() - 0.5) * 300; else y += (R() - 0.5) * 300; g.lineTo(x, y); } g.stroke(); g.fillStyle = 'rgba(74,224,255,0.2)'; g.beginPath(); g.arc(x, y, 4, 0, TAU); g.fill(); } },
      frame: (g, t, dt, w, h, S) => { const s = sz(w, h); const G = [[0.04, 0.9, 0.12, '#3a4250', 0.2], [0.14, 1.02, 0.08, '#2a3140', -0.3], [0.96, 0.12, 0.1, '#3a4250', 0.25], [0.88, 0.02, 0.06, '#2a3140', -0.4]]; for (const [x, y, r, c, sp] of G) { g.save(); g.translate(x * w, y * h); g.rotate(t * sp); SHAPES.gear(g, { r: r * s, c }); g.restore(); } for (const p of S.pulses) { p.k = (p.k + dt * 0.25) % 1; dot(g, lerp(p.x0, p.x1, p.k), lerp(p.y0, p.y1, p.k), 'rgba(74,224,255,0.8)', 8); } },
      init: (w, h, R) => ({ pulses: Array.from({ length: 8 }, () => { const x0 = R() * w, y0 = R() * h, hor = R() < 0.5; return { x0, y0, x1: hor ? x0 + (R() - 0.5) * 600 : x0, y1: hor ? y0 : y0 + (R() - 0.5) * 600, k: R() }; }) }),
      fields: [{ n: 16, shape: 'spark', colors: ['rgba(255,138,58,0.8)', 'rgba(74,224,255,0.8)'], size: [1.5, 3], vy: [-12, -4], sway: 6, alpha: [0.3, 0.7] }] },
    pirate: { sky: ['#06101e', '#0f2a3a', '#1a3a4a'], paint(g, w, h, R) { starsStill(g, w, h, 120, R, 0.6, 0.6); moon(g, w * 0.93, h * 0.3, sz(w, h) * 0.04, '#f4e6c0', 'rgba(244,230,192,0.2)'); },
      frame: (g, t, dt, w, h, S) => {
        waves(g, t, w, h, h * 0.13, 'rgba(10,40,60,0.9)', 7, 0.6, 140);
        const sx = w * 0.72, sy = h - h * 0.11 + Math.sin(t * 1.2) * 4, k = Math.max(0.5, Math.min(1.2, h / 900)); g.save(); g.translate(sx, sy); g.rotate(Math.sin(t * 1.2) * 0.03); g.scale(k, k); g.fillStyle = '#050a12';
        g.beginPath(); g.moveTo(-90, -10); g.lineTo(90, -10); g.lineTo(70, 18); g.lineTo(-74, 18); g.closePath(); g.fill(); g.fillRect(-4, -150, 6, 140); g.fillRect(-50, -120, 4, 110);
        g.beginPath(); g.moveTo(6, -140); g.quadraticCurveTo(60, -100, 6, -40); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-44, -110); g.quadraticCurveTo(-4, -80, -44, -30); g.closePath(); g.fill(); g.fillRect(2, -160, 18, 10); g.restore();
        waves(g, t + 1.4, w, h, h * 0.07, 'rgba(6,24,40,0.97)', 6, 0.9, 100);
        for (let i = 0; i < 3; i++) { const p = (t * 0.02 + i / 3) % 1, x = lerp(-40, w + 40, p), y = h * (0.25 + i * 0.07) + Math.sin(t * 1.5 + i) * 10, fl = Math.sin(t * 6 + i) * 4; g.strokeStyle = 'rgba(240,240,250,0.7)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x - 14, y - fl); g.quadraticCurveTo(x - 7, y - 6 - fl * 0.5, x, y); g.quadraticCurveTo(x + 7, y - 6 - fl * 0.5, x + 14, y - fl); g.stroke(); }
      } },
    bloodmoon: { sky: ['#0a0204', '#1a0408', '#2a060c'], paint(g, w, h, R) { starsStill(g, w, h, 80, R, 0.6, 0.45); const r = sz(w, h) * 0.12, x = w * 0.9, y = h * 0.2; const gr = g.createRadialGradient(x, y, r * 0.8, x, y, r * 4); gr.addColorStop(0, 'rgba(255,40,50,0.35)'); gr.addColorStop(1, 'rgba(255,40,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); const mg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); mg.addColorStop(0, '#ff5a4a'); mg.addColorStop(1, '#8a0a14'); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = mg; g.fill(); g.fillStyle = 'rgba(60,0,8,0.35)'; for (const [dx, dy, rr] of [[-0.3, -0.2, 0.2], [0.25, 0.15, 0.14], [0.05, 0.42, 0.1], [-0.4, 0.3, 0.08]]) { g.beginPath(); g.arc(x + dx * r, y + dy * r, rr * r, 0, TAU); g.fill(); }
      hills(g, w, h, h * 0.03, h * 0.07, '#0a0103', R, 5); const tree = (tx, s) => { g.save(); g.translate(tx, h - h * 0.05); g.scale(s, s); g.strokeStyle = '#0a0103'; g.lineCap = 'round'; const br = (len, wd, dep) => { g.lineWidth = wd; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len); g.stroke(); if (dep <= 0) return; g.translate(0, -len); for (const a of [-0.5, 0.45]) { g.save(); g.rotate(a + (R() - 0.5) * 0.3); br(len * 0.7, wd * 0.65, dep - 1); g.restore(); } }; br(90, 12, 5); g.restore(); }; const k = Math.max(0.5, Math.min(1.3, h / 900)); tree(w * 0.08, k); tree(w * 0.93, k * 0.75); },
      fields: [{ n: 14, shape: 'spark', colors: ['rgba(255,60,70,0.7)'], size: [1.5, 3], vy: [-10, -3], sway: 8, alpha: [0.2, 0.6] }],
      frame: (g, t, dt, w, h) => bats(g, t, w, h, null, 6) },
    spooky: { sky: ['#0e0618', '#2a1240', '#1a0a20'], paint(g, w, h, R) { starsStill(g, w, h, 90, R, 0.6, 0.5); moon(g, w * 0.94, h * 0.26, sz(w, h) * 0.07, '#f4e8c0', 'rgba(255,240,190,0.25)'); hills(g, w, h, h * 0.03, h * 0.1, '#0a0410', R, 4);
      const hx = w * 0.8, hy = h - h * 0.08, k = Math.max(0.5, Math.min(1.3, h / 900)); g.save(); g.translate(hx, hy); g.scale(k, k); g.fillStyle = '#0a0410'; g.fillRect(-70, -90, 140, 90); g.beginPath(); g.moveTo(-84, -90); g.lineTo(0, -150); g.lineTo(84, -90); g.fill(); g.fillRect(30, -150, 22, 50); g.beginPath(); g.moveTo(24, -150); g.lineTo(41, -180); g.lineTo(58, -150); g.fill(); g.fillStyle = 'rgba(255,170,60,0.75)'; for (const [x, y] of [[-46, -66], [24, -66], [-12, -118]]) g.fillRect(x, y, 18, 20); g.restore();
      for (let i = 0; i < 5; i++) { const px = w * (0.06 + i * 0.09), py = h - h * 0.035 - R() * 8, r = 10 + R() * 8; g.fillStyle = '#e8762a'; g.beginPath(); g.ellipse(px, py, r * 1.2, r, 0, 0, TAU); g.fill(); g.fillStyle = '#ffd25a'; g.beginPath(); g.moveTo(px - r * 0.5, py - r * 0.2); g.lineTo(px - r * 0.2, py - r * 0.5); g.lineTo(px - r * 0.1, py - r * 0.1); g.fill(); g.beginPath(); g.moveTo(px + r * 0.5, py - r * 0.2); g.lineTo(px + r * 0.2, py - r * 0.5); g.lineTo(px + r * 0.1, py - r * 0.1); g.fill(); g.fillRect(px - r * 0.5, py + r * 0.2, r, r * 0.22); } },
      fields: [{ n: 26, shape: 'leaf', colors: ['#e8762a', '#8a3ac0', '#b6ff5c'], size: [4, 8], vy: [15, 35], sway: 30, spin: 1.4, alpha: [0.25, 0.6] }],
      frame: (g, t, dt, w, h) => { bats(g, t, w, h, null, 4, 'rgba(8,2,12,0.85)'); for (let i = 0; i < 3; i++) { const p = (t * 0.025 + i / 3) % 1, x = w * (0.2 + i * 0.3) + Math.sin(t * 0.7 + i) * 40, y = lerp(h * 0.9, h * 0.15, p), a = Math.sin(p * PI) * 0.35; g.save(); g.globalAlpha = a; g.translate(x, y); g.fillStyle = '#f4f0ff'; g.beginPath(); g.arc(0, 0, 18, PI, 0); g.lineTo(18, 26); for (let k = 0; k < 4; k++) g.lineTo(18 - (k + 0.5) * 9, 26 - (k % 2 ? 0 : 6)); g.lineTo(-18, 26); g.closePath(); g.fill(); g.fillStyle = '#1a0a20'; g.beginPath(); g.arc(-6, -2, 3, 0, TAU); g.arc(6, -2, 3, 0, TAU); g.fill(); g.restore(); } } },
    campfire: { sky: ['#05080f', '#0f1a26', '#1a1e26'], paint(g, w, h, R) { starsStill(g, w, h, 220, R, 0.7, 0.75); moon(g, w * 0.86, h * 0.16, sz(w, h) * 0.03, '#f4eedc', 'rgba(240,235,220,0.15)'); const gr = g.createRadialGradient(w * 0.5, h, 0, w * 0.5, h, h * 0.6); gr.addColorStop(0, 'rgba(255,140,50,0.32)'); gr.addColorStop(1, 'rgba(255,140,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); pines(g, w, h, h * 0.02, '#04070c', R, h * 0.1, h * 0.26, 34); },
      fields: [{ n: 40, shape: 'spark', colors: ['rgba(255,154,58,0.9)', 'rgba(255,210,120,0.9)', 'rgba(255,110,40,0.9)'], size: [1.5, 3.5], vy: [-60, -25], sway: 18, alpha: [0.4, 0.95], zone: [0.3, 0.7], fade: 0.45 }],
      frame: (g, t, dt, w, h, S) => twinkles(g, t, S) },
    harvest: { sky: ['#1a0a06', '#3a1608', '#5a2a10'], paint(g, w, h, R) { moon(g, w * 0.9, h * 0.22, sz(w, h) * 0.1, '#ffb04a', 'rgba(255,150,60,0.3)'); hills(g, w, h, h * 0.05, h * 0.1, '#2a1006', R, 4); hills(g, w, h, h * 0.02, h * 0.06, '#1a0804', R, 6);
      for (let i = 0; i < 7; i++) { const px = w * (0.05 + R() * 0.9), py = h - h * 0.025, r = 9 + R() * 9; g.fillStyle = '#c8621a'; g.beginPath(); g.ellipse(px, py, r * 1.25, r, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(80,30,0,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(px, py, r * 0.5, r, 0, 0, TAU); g.stroke(); g.fillStyle = '#3a5a1a'; g.fillRect(px - 2, py - r - 5, 4, 7); }
      const bale = (x) => { g.fillStyle = '#2a1206'; g.fillRect(x, h - h * 0.08, 70, 36); }; bale(w * 0.14); },
      fields: [{ n: 46, shape: 'maple', colors: ['#e8862a', '#c0392b', '#e0b020', '#b5562e'], size: [6, 14], vy: [20, 50], sway: 40, spin: 1.6, alpha: [0.35, 0.85] }] },
    gingerbread: { sky: ['#1a0e14', '#3a1a1e', '#4a2414'], paint(g, w, h, R) { starsStill(g, w, h, 80, R, 0.5, 0.5); const k = Math.max(0.5, Math.min(1.2, h / 900)); let x = -20; while (x < w + 40) { const hw = (70 + R() * 50) * k, hh = (60 + R() * 50) * k; g.fillStyle = '#5a2e14'; g.fillRect(x, h - hh, hw, hh); g.beginPath(); g.moveTo(x - 8, h - hh); g.lineTo(x + hw / 2, h - hh - hw * 0.55); g.lineTo(x + hw + 8, h - hh); g.closePath(); g.fill(); g.strokeStyle = 'rgba(255,248,240,0.75)'; g.lineWidth = 3; g.beginPath(); for (let k2 = 0; k2 <= 8; k2++) { const px = lerp(x - 8, x + hw / 2, k2 / 8), py = lerp(h - hh, h - hh - hw * 0.55, k2 / 8); g.lineTo(px, py + (k2 % 2 ? 3 : 0)); } for (let k2 = 1; k2 <= 8; k2++) { const px = lerp(x + hw / 2, x + hw + 8, k2 / 8), py = lerp(h - hh - hw * 0.55, h - hh, k2 / 8); g.lineTo(px, py + (k2 % 2 ? 3 : 0)); } g.stroke(); g.fillStyle = 'rgba(255,200,110,0.65)'; g.fillRect(x + hw * 0.2, h - hh * 0.65, hw * 0.22, hh * 0.25); g.fillStyle = ['#ff4a5a', '#3ad04a', '#ffd23f'][Math.floor(R() * 3)]; g.beginPath(); g.arc(x + hw * 0.72, h - hh * 0.5, 6 * k, PI, 0); g.fill(); x += hw + 30 * k + R() * 60; } },
      fields: [{ n: 50, shape: 'sprinkle', colors: ['#ff4a5a', '#ffd23f', '#3ad04a', '#3a8aff', '#ff8fd0', '#ffffff'], size: [3, 6], vy: [25, 55], sway: 14, spin: 2, alpha: [0.35, 0.8] }, { n: 30, shape: 'flake', colors: ['#fff'], size: [1.5, 3], vy: [15, 35], sway: 14, alpha: [0.3, 0.7] }] },
    frost: { sky: ['#050f26', '#0f2250', '#1d3a7a'], paint(g, w, h, R) { starsStill(g, w, h, 120, R, 0.6, 0.6); hills(g, w, h, h * 0.04, h * 0.08, '#c8dcf0', R, 4); pines(g, w, h, h * 0.03, 'rgba(14,30,60,0.95)', R, h * 0.06, h * 0.16, 40); g.fillStyle = '#dde8f6'; g.fillRect(0, h - h * 0.03, w, h * 0.03); },
      fields: [{ n: 110, shape: 'flake', colors: ['rgba(255,255,255,0.9)'], size: [1.2, 6], vy: [18, 60], sway: 18, spin: 0.6, alpha: [0.35, 0.9] }], frame: (g, t, dt, w, h) => aurora(g, t, w, h) },
    // No event (or an unknown kind): the usual party lights stay; just a few soft floating lights.
    default: { sky: null, fields: [{ n: 22, shape: 'spark', colors: ['rgba(255,79,154,0.7)', 'rgba(62,230,255,0.7)', 'rgba(255,210,63,0.7)'], size: [2, 5], vy: [-14, -5], sway: 10, alpha: [0.2, 0.55] }] },
  };

  // ---------- run it ----------
  const kind = season && SCENES[season.kind] ? season.kind : 'default', scene = SCENES[kind];
  const host = document.querySelector('.bg'); if (!host) return;
  const cv = document.createElement('canvas'); cv.className = 'ev-bg'; cv.setAttribute('aria-hidden', 'true');
  const shade = document.createElement('div'); shade.className = 'ev-shade'; shade.setAttribute('aria-hidden', 'true');
  host.after(cv, shade);
  document.body.classList.add('ev-on', 'ev-' + kind);
  document.body.dataset.eventKind = kind; // for tests and screenshots
  if (season && season.theme) for (const [k, v] of Object.entries({ '--ev-a': season.theme.a, '--ev-b': season.theme.b, '--ev-c': season.theme.c })) document.body.style.setProperty(k, v);
  const g = cv.getContext('2d'); if (!g) return;
  const still = document.createElement('canvas'), sg = still.getContext('2d');
  let W = 0, H = 0, dpr = 1, S = null, fields = [];
  function resize() {
    W = window.innerWidth; H = window.innerHeight; dpr = Math.min(1.5, window.devicePixelRatio || 1);
    for (const c of [cv, still]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const R = rng(1234 + (season ? season.start.length + season.kind.length * 97 : 7));
    sg.setTransform(dpr, 0, 0, dpr, 0, 0); sg.clearRect(0, 0, W, H);
    if (scene.sky) sky(sg, W, H, scene.sky);
    if (scene.paint) scene.paint(sg, W, H, R);
    S = { R: rng(99), ...(scene.init ? scene.init(W, H, R) : {}), tw: makeTwinkles(W, H, R, Math.round(18 * Math.max(0.5, Math.min(1.2, (W * H) / (1920 * 1080))))) };
    fields = (scene.fields || []).map((spec) => ({ spec, list: makeField(spec, W, H, S.R) }));
  }
  let last = 0, t = 0, raf = 0;
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.033;
    if (last && now - last < 30) { schedule(); return; } // ~30 fps is plenty for drifting snow
    last = now; t += dt;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(still, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    try {
      for (const f of fields) runField(g, f.list, f.spec, t, dt, W, H, S.R);
      if (scene.frame) scene.frame(g, t, dt, W, H, S);
    } catch (e) { if (window.JGEventBg) window.JGEventBg.error = String(e && e.stack || e); /* a scene bug never breaks the menu */ }
    schedule();
  }
  function schedule() { if (!raf && !reduce && !document.hidden) raf = requestAnimationFrame(frame); }
  resize();
  if (reduce) { t = 6; frame(performance.now()); frame(performance.now() + 40); }
  else schedule();
  let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); if (reduce) { last = 0; frame(performance.now()); } }, 150); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = 0; schedule(); } });
  window.JGEventBg = { kind, season, scenes: Object.keys(SCENES) };
})();
