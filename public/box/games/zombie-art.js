'use strict';
// Zombie Survival art kit (TV only): the six locations of the story, cartoon zombies (spooky-fun,
// never gory), survivors with emoji heads, ghosts, the rescue chopper. Everything draws in a
// 1920×1080 world; static scenery is cached per location. Used by the game screens
// (public/box/games/zombie.js), the title (titles/zombie.js) and the intro (intros/zombie.js).
(function () {
  if (!window.BOX) return;
  const TAU = Math.PI * 2, W = 1920, H = 1080, GROUND = 930;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const back = (t) => { t = clamp(t); const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const hash = (str) => { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
  const INK = '#120d1c';
  const FONT = '"Black Ops One", "Bungee", "Lilita One", sans-serif';
  const BODY = '"Fredoka", system-ui, sans-serif';
  const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  try { if (document.fonts) { document.fonts.load('40px "Black Ops One"'); document.fonts.load('40px "Creepster"'); } } catch { /* fine */ }

  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // ---------- emoji bitmaps (optionally tinted: 'sick' green, 'ghost' pale) ----------
  const ecache = new Map();
  function emojiImg(e, px, tint) {
    px = Math.max(8, Math.round(px / 8) * 8); const k = e + '|' + px + '|' + (tint || ''); let c = ecache.get(k);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = Math.ceil(px * 1.3);
      const x = c.getContext('2d'); x.font = `${px}px ${EMOJI}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(e || '🙂', c.width / 2, c.height / 2 + px * 0.06);
      if (tint) {
        x.globalCompositeOperation = 'source-atop';
        x.fillStyle = tint === 'sick' ? 'rgba(90,220,90,0.55)' : tint === 'ghost' ? 'rgba(220,235,255,0.7)' : tint; x.fillRect(0, 0, c.width, c.height);
      }
      if (ecache.size > 300) ecache.clear();
      ecache.set(k, c);
    }
    return c;
  }
  function emoji(g, e, x, y, px, tint) { const c = emojiImg(e, Math.min(px, 320), tint); const s = px * 1.3; g.drawImage(c, x - s / 2, y - s / 2, s, s); }
  function text(g, str, x, y, px, fill, o = {}) {
    const font = o.font || FONT; let p = px; g.font = `${p}px ${font}`;
    while (o.max && p > 10 && g.measureText(str).width > o.max) { p -= 2; g.font = `${p}px ${font}`; }
    g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'middle';
    if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.lw || p * 0.16; g.strokeStyle = o.stroke; g.strokeText(str, x, y); }
    g.fillStyle = fill; g.fillText(str, x, y);
  }
  // Cover-fit the 1920×1080 world into a w×h canvas (CSS px × dpr).
  function cover(g, w, h, dpr = 1) { const sc = Math.max(w / W, h / H); g.setTransform(sc * dpr, 0, 0, sc * dpr, (w - W * sc) / 2 * dpr, (h - H * sc) / 2 * dpr); return sc; }

  // ---------- shared scenery pieces ----------
  function sky(g, stops, h = H) { const gr = g.createLinearGradient(0, 0, 0, h); for (const [k, c] of stops) gr.addColorStop(k, c); g.fillStyle = gr; g.fillRect(0, 0, W, h); }
  function stars(g, r, n, maxY, a = 0.7) { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(255,255,240,${(0.2 + r() * a).toFixed(2)})`; g.beginPath(); g.arc(r() * W, r() * maxY, 0.8 + r() * 1.8, 0, TAU); g.fill(); } }
  function moon(g, x, y, R, col = '#fff1c2') {
    for (const [k, a] of [[3.2, 0.06], [2.1, 0.1], [1.45, 0.16]]) { g.fillStyle = `rgba(255,240,190,${a})`; g.beginPath(); g.arc(x, y, R * k, 0, TAU); g.fill(); }
    g.fillStyle = col; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
    g.fillStyle = 'rgba(200,180,130,0.35)'; for (const [dx, dy, r] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.13], [-0.05, 0.35, 0.1], [0.35, -0.35, 0.08]]) { g.beginPath(); g.arc(x + dx * R, y + dy * R, r * R, 0, TAU); g.fill(); }
  }
  function skyline(g, r, y, col, minH, maxH, wins) {
    g.fillStyle = col; let x = -20;
    while (x < W + 20) {
      const w = 60 + r() * 110, h = minH + r() * (maxH - minH);
      g.fillRect(x, y - h, w, h + 400);
      if (r() < 0.25) { g.fillRect(x + w * 0.4, y - h - 40, 6, 40); }
      if (wins) { g.save(); g.fillStyle = wins; for (let wy = y - h + 14; wy < y - 10; wy += 22) for (let wx = x + 10; wx < x + w - 12; wx += 18) if (r() < 0.22) g.fillRect(wx, wy, 8, 10); g.restore(); g.fillStyle = col; }
      x += w + 4;
    }
  }
  function car(g, x, y, s, col, o = {}) {
    g.save(); g.translate(x, y); g.scale(s * (o.flip ? -1 : 1), s);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 4, 170, 16, 0, 0, TAU); g.fill();
    g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 6; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-160, -20); g.lineTo(-150, -70); g.lineTo(-80, -78); g.lineTo(-40, -130); g.lineTo(70, -130); g.lineTo(110, -78); g.lineTo(160, -66); g.lineTo(165, -20); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = o.lit ? '#ffe9a8' : '#9fc3d8'; g.beginPath(); g.moveTo(-30, -82); g.lineTo(-4, -118); g.lineTo(40, -118); g.lineTo(40, -82); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(52, -82); g.lineTo(52, -118); g.lineTo(64, -118); g.lineTo(94, -82); g.closePath(); g.fill(); g.stroke();
    for (const wx of [-100, 100]) { g.fillStyle = '#1d1a24'; g.beginPath(); g.arc(wx, -18, 30, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#8a8798'; g.beginPath(); g.arc(wx, -18, 12, 0, TAU); g.fill(); }
    g.fillStyle = '#ffd36b'; rr(g, 145, -62, 16, 12, 4); g.fill();
    g.restore();
  }
  function hazard(g, x, y, s, t) { if (Math.floor(t * 2.2) % 2) return; g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 0, x, y, 60 * s); gr.addColorStop(0, 'rgba(255,170,40,0.9)'); gr.addColorStop(1, 'rgba(255,120,0,0)'); g.fillStyle = gr; g.fillRect(x - 60 * s, y - 60 * s, 120 * s, 120 * s); g.restore(); }
  function glow(g, x, y, r, col, a) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col.replace('A', a)); gr.addColorStop(1, col.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }

  // ---------- the six locations: static layer (cached) + animated layer ----------
  const LOC = {
    streets: {
      grade: 'rgba(40,10,60,A)',
      still(g) {
        const r = rng(11);
        sky(g, [[0, '#1c1238'], [0.4, '#4a2560'], [0.62, '#c4506a'], [0.74, '#ff8a5c'], [0.8, '#ffc27a']], 820);
        stars(g, r, 70, 300, 0.5);
        g.fillStyle = 'rgba(255,214,140,0.9)'; g.beginPath(); g.arc(1380, 690, 120, 0, TAU); g.fill();
        glow(g, 1380, 690, 380, 'rgba(255,170,90,A)', 0.4);
        skyline(g, r, 700, '#5a2f5f', 60, 210, 'rgba(255,200,120,0.55)');
        // water tower
        g.fillStyle = '#4a2650'; g.fillRect(400, 520, 8, 160); g.fillRect(470, 520, 8, 160); rr(g, 380, 450, 120, 80, 30); g.fill(); text(g, 'MAPLE HTS', 440, 492, 22, '#8d5a8a');
        // houses
        let x = -40;
        while (x < W) {
          const w = 230 + r() * 90, h = 150 + r() * 90, b = 790;
          g.fillStyle = '#21142f'; g.fillRect(x, b - h, w, h);
          g.beginPath(); g.moveTo(x - 18, b - h); g.lineTo(x + w / 2, b - h - 90 - r() * 40); g.lineTo(x + w + 18, b - h); g.fill();
          g.fillRect(x + w * 0.7, b - h - 70, 26, 60);
          for (let i = 0; i < 3; i++) { const lit = r() < 0.55; g.fillStyle = lit ? '#ffd36b' : '#3a2847'; g.fillRect(x + 26 + i * (w - 70) / 2, b - h + 34, 40, 46); if (lit) glow(g, x + 46 + i * (w - 70) / 2, b - h + 57, 70, 'rgba(255,200,90,A)', 0.25); g.fillStyle = '#21142f'; g.fillRect(x + 44 + i * (w - 70) / 2, b - h + 34, 4, 46); }
          g.fillStyle = '#2d1c3c'; g.fillRect(x + w / 2 - 24, b - 76, 48, 76);
          // tree
          if (r() < 0.6) { g.fillStyle = '#1a1026'; g.beginPath(); g.arc(x + w + 30, b - 140, 70, 0, TAU); g.arc(x + w + 70, b - 110, 56, 0, TAU); g.fill(); g.fillRect(x + w + 40, b - 110, 16, 110); }
          x += w + 90 + r() * 60;
        }
        // power lines
        g.strokeStyle = '#1a1026'; g.lineWidth = 3;
        for (const px of [160, 820, 1500]) { g.fillStyle = '#1a1026'; g.fillRect(px, 470, 10, 330); g.fillRect(px - 40, 490, 90, 8); }
        g.beginPath(); g.moveTo(-20, 520); g.quadraticCurveTo(490, 570, 825, 495); g.quadraticCurveTo(1160, 570, 1505, 495); g.quadraticCurveTo(1760, 560, 1940, 520); g.stroke();
        // fence, sidewalk, road
        g.fillStyle = '#e8d9c4'; for (let fx = 0; fx < W; fx += 34) { if (fx > 600 && fx < 900) continue; g.beginPath(); g.moveTo(fx, 800); g.lineTo(fx, 752); g.lineTo(fx + 11, 742); g.lineTo(fx + 22, 752); g.lineTo(fx + 22, 800); g.fill(); }
        g.fillStyle = '#d5c4ae'; g.fillRect(0, 770, 600, 8); g.fillRect(900, 770, W, 8);
        g.fillStyle = '#4a3a55'; g.fillRect(0, 800, W, 50); g.fillStyle = '#5c4a66'; g.fillRect(0, 800, W, 8);
        const rd = g.createLinearGradient(0, 850, 0, H); rd.addColorStop(0, '#2b2236'); rd.addColorStop(1, '#1a1422'); g.fillStyle = rd; g.fillRect(0, 850, W, H - 850);
        g.fillStyle = '#e8b84a'; for (let lx = 20; lx < W; lx += 150) g.fillRect(lx, 1010, 80, 10);
        // mailbox
        g.fillStyle = '#7a8a9a'; g.fillRect(1700, 740, 8, 60); rr(g, 1680, 712, 50, 34, 12); g.fill(); g.fillStyle = '#e04a4a'; g.fillRect(1722, 700, 6, 22);
        car(g, 230, 850, 0.9, '#3d6f8f', { flip: true });
      },
      live(g, t) {
        hazard(g, 100, 800, 1, t); hazard(g, 362, 790, 1, t);
        // street lamp
        g.fillStyle = '#1a1026'; g.fillRect(1180, 560, 10, 260); g.fillRect(1150, 560, 60, 10);
        const fl = (Math.sin(t * 13) + Math.sin(t * 7.3)) > 1.4 ? 0.2 : 1; g.fillStyle = `rgba(255,236,170,${0.5 + 0.5 * fl})`; rr(g, 1140, 568, 40, 16, 6); g.fill();
        glow(g, 1160, 600, 260, 'rgba(255,220,140,A)', 0.22 * fl);
        // crows
        g.strokeStyle = '#1a1026'; g.lineWidth = 4; g.lineCap = 'round';
        for (let i = 0; i < 4; i++) { const k = (t * 0.04 + i * 0.27) % 1, x = -100 + k * 2200, y = 180 + i * 40 + Math.sin(t + i) * 20, f = Math.sin(t * 9 + i) * 10; g.beginPath(); g.moveTo(x - 18, y - f); g.quadraticCurveTo(x - 6, y - 4, x, y); g.quadraticCurveTo(x + 6, y - 4, x + 18, y - f); g.stroke(); }
        // smoke from a distant fire
        for (let i = 0; i < 6; i++) { const k = (t * 0.05 + i / 6) % 1; g.fillStyle = `rgba(60,30,60,${0.35 * (1 - k)})`; g.beginPath(); g.arc(1660 + Math.sin(k * 5 + i) * 30, 640 - k * 420, 40 + k * 80, 0, TAU); g.fill(); }
        glow(g, 1660, 660, 120, 'rgba(255,120,60,A)', 0.35 + 0.1 * Math.sin(t * 6));
      },
    },
    mall: {
      grade: 'rgba(20,10,60,A)',
      still(g) {
        sky(g, [[0, '#1a1838'], [1, '#2c2852']], H);
        // skylight
        g.fillStyle = '#0d1030'; g.beginPath(); g.moveTo(560, 230); g.quadraticCurveTo(960, 10, 1360, 230); g.closePath(); g.fill();
        moon(g, 1120, 140, 42);
        g.strokeStyle = '#6c6aa0'; g.lineWidth = 6; g.beginPath(); g.moveTo(560, 230); g.quadraticCurveTo(960, 10, 1360, 230); g.stroke();
        for (let i = 1; i < 8; i++) { const x = 560 + i * 100; g.beginPath(); g.moveTo(x, 230); g.lineTo(960 + (x - 960) * 0.3, 60); g.stroke(); }
        // upper floor
        g.fillStyle = '#34305e'; g.fillRect(0, 230, W, 200);
        const shops = [['PRETZEL PLANET', '#ff6ec7'], ['SHOE-TOPIA', '#5ee6ff'], ['GADGET GALAXY', '#9dff6a'], ['SNOW CONE ZONE', '#ffd36b'], ['SPORTS DEPOT', '#ff8a4d']];
        shops.forEach(([n, c], i) => {
          const x = 30 + i * 380; g.fillStyle = '#211d40'; g.fillRect(x, 270, 340, 150); g.fillStyle = 'rgba(120,140,220,0.18)'; g.fillRect(x + 16, 320, 308, 100);
          g.save(); g.shadowColor = c; g.shadowBlur = 18; text(g, n, x + 170, 296, 26, c, { max: 320 }); g.restore();
        });
        g.fillStyle = '#4b4680'; g.fillRect(0, 420, W, 26); g.fillStyle = '#6c66a8'; for (let x = 0; x < W; x += 28) g.fillRect(x, 446, 4, 50); g.fillRect(0, 446, W, 6); g.fillRect(0, 492, W, 6);
        // ground floor stores
        g.fillStyle = '#29254c'; g.fillRect(0, 500, W, 300);
        [['FOOD COURT', '#ffd36b'], ['ARCADE', '#ff6ec7'], ['TOY TOWN', '#5ee6ff'], ['FASHION', '#c9a0ff']].forEach(([n, c], i) => {
          const x = 40 + i * 480; g.fillStyle = '#1a1734'; g.fillRect(x, 560, 420, 240); g.fillStyle = 'rgba(140,160,255,0.12)'; g.fillRect(x + 20, 610, 380, 190);
          g.save(); g.shadowColor = c; g.shadowBlur = 22; text(g, n, x + 210, 586, 34, c); g.restore();
          g.fillStyle = '#3a3566'; for (let k = 0; k < 6; k++) g.fillRect(x + 20 + k * 64, 610, 3, 190);
          g.fillStyle = '#4e4a80'; for (const sy of [660, 720, 780]) g.fillRect(x + 30, sy, 360, 8);
          const gc = ['#ff6ec7', '#5ee6ff', '#ffd36b', '#9dff6a', '#c9a0ff']; for (let k = 0; k < 18; k++) { g.fillStyle = gc[(k + i) % 5]; g.globalAlpha = 0.6; g.fillRect(x + 40 + (k % 6) * 58, 636 + Math.floor(k / 6) * 60, 30, 24); } g.globalAlpha = 1;
        });
        // escalator
        g.fillStyle = '#3d3870'; g.beginPath(); g.moveTo(1560, 800); g.lineTo(1880, 450); g.lineTo(1920, 450); g.lineTo(1920, 500); g.lineTo(1640, 800); g.fill();
        g.strokeStyle = '#8a86c8'; g.lineWidth = 8; g.beginPath(); g.moveTo(1560, 760); g.lineTo(1880, 410); g.stroke();
        // floor tiles
        for (let row = 0; row < 8; row++) {
          const y0 = 800 + row * row * 5 + row * 18, y1 = 800 + (row + 1) * (row + 1) * 5 + (row + 1) * 18;
          for (let c = -12; c < 13; c++) {
            const x0a = 960 + c * (60 + row * 20), x1a = 960 + (c + 1) * (60 + row * 20), x0b = 960 + c * (60 + (row + 1) * 20), x1b = 960 + (c + 1) * (60 + (row + 1) * 20);
            g.fillStyle = (row + c) % 2 ? '#3a3462' : '#4a4378'; g.beginPath(); g.moveTo(x0a, y0); g.lineTo(x1a, y0); g.lineTo(x1b, y1); g.lineTo(x0b, y1); g.fill();
          }
        }
        // planters
        for (const px of [120, 1780]) { g.fillStyle = '#5a3a2a'; rr(g, px - 60, 820, 120, 80, 10); g.fill(); g.fillStyle = '#1f5a3a'; for (let i = 0; i < 6; i++) { g.save(); g.translate(px, 820); g.rotate(-1.2 + i * 0.48); g.beginPath(); g.ellipse(0, -80, 18, 90, 0, 0, TAU); g.fill(); g.restore(); } }
      },
      live(g, t) {
        // light shafts from the skylight
        g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) { const a = 0.05 + 0.03 * Math.sin(t * 0.6 + i); g.fillStyle = `rgba(160,180,255,${a})`; g.beginPath(); g.moveTo(760 + i * 160, 120); g.lineTo(840 + i * 160, 120); g.lineTo(980 + i * 240, 1080); g.lineTo(780 + i * 240, 1080); g.fill(); }
        g.restore();
        // flickering sign
        if (Math.sin(t * 17) + Math.sin(t * 5.1) > -0.6) { g.save(); g.shadowColor = '#ff6ec7'; g.shadowBlur = 26; text(g, 'ARCADE', 760, 586, 34, '#ff6ec7'); g.restore(); }
        else { text(g, 'ARCADE', 760, 586, 34, '#5a3060'); }
        // a lost balloon
        const bx = 300 + ((t * 18) % 1500), by = 380 - Math.sin(t * 0.8) * 20;
        g.strokeStyle = '#ddd'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx, by + 40); g.quadraticCurveTo(bx + 10, by + 80, bx - 4, by + 120); g.stroke();
        g.fillStyle = '#ff5a7a'; g.beginPath(); g.ellipse(bx, by, 30, 38, 0, 0, TAU); g.fill();
      },
    },
    hospital: {
      grade: 'rgba(0,40,30,A)',
      still(g) {
        const vx = 960, vy = 520;
        g.fillStyle = '#20302e'; g.fillRect(0, 0, W, H);
        // ceiling
        g.fillStyle = '#5c726c'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, 0); g.lineTo(1160, 420); g.lineTo(760, 420); g.fill();
        // walls
        g.fillStyle = '#3c625a'; g.beginPath(); g.moveTo(0, 0); g.lineTo(760, 420); g.lineTo(760, 640); g.lineTo(0, H); g.fill();
        g.fillStyle = '#35574f'; g.beginPath(); g.moveTo(W, 0); g.lineTo(1160, 420); g.lineTo(1160, 640); g.lineTo(W, H); g.fill();
        // stripe
        g.fillStyle = '#7fb8a8'; g.beginPath(); g.moveTo(0, 700); g.lineTo(760, 560); g.lineTo(760, 572); g.lineTo(0, 730); g.fill(); g.beginPath(); g.moveTo(W, 700); g.lineTo(1160, 560); g.lineTo(1160, 572); g.lineTo(W, 730); g.fill();
        // floor
        const fl = g.createLinearGradient(0, 640, 0, H); fl.addColorStop(0, '#6c8a82'); fl.addColorStop(1, '#a5bdb5'); g.fillStyle = fl;
        g.beginPath(); g.moveTo(0, H); g.lineTo(760, 640); g.lineTo(1160, 640); g.lineTo(W, H); g.fill();
        g.strokeStyle = 'rgba(30,50,46,0.35)'; g.lineWidth = 2; for (let i = -8; i <= 8; i++) { g.beginPath(); g.moveTo(vx + i * 25, 640); g.lineTo(vx + i * 240, H); g.stroke(); }
        // far end: double doors + exit sign
        g.fillStyle = '#2a403b'; g.fillRect(760, 420, 400, 220); g.fillStyle = '#4e6e66'; g.fillRect(820, 470, 130, 170); g.fillRect(970, 470, 130, 170);
        g.fillStyle = '#9fd4c4'; g.fillRect(850, 500, 70, 50); g.fillRect(1000, 500, 70, 50);
        // side doors
        for (const [side, k] of [[-1, 0.25], [-1, 0.55], [1, 0.25], [1, 0.55]]) {
          const xA = side < 0 ? lerp(0, 760, k) : lerp(W, 1160, k), xB = side < 0 ? lerp(0, 760, k + 0.15) : lerp(W, 1160, k + 0.15);
          const top = (x) => lerp(0, 420, side < 0 ? x / 760 : (W - x) / 760) + 60 * (1 - (side < 0 ? x / 760 : (W - x) / 760)) + 120, bot = (x) => lerp(H, 640, side < 0 ? x / 760 : (W - x) / 760);
          g.fillStyle = '#2b4741'; g.beginPath(); g.moveTo(xA, top(xA)); g.lineTo(xB, top(xB)); g.lineTo(xB, bot(xB)); g.lineTo(xA, bot(xA)); g.fill();
          g.fillStyle = '#95c9b9'; const m = (xA + xB) / 2; g.fillRect(m - 14, top(m) + 30, 28, 36);
        }
        // sign
        g.fillStyle = '#e8f3ef'; rr(g, 820, 330, 280, 60, 8); g.fill(); text(g, 'WARD C', 940, 361, 34, '#2c5a50');
        g.fillStyle = '#e04a4a'; g.fillRect(1052, 340, 14, 40); g.fillRect(1039, 353, 40, 14);
        // nurses' station
        g.fillStyle = '#d9e6e1'; g.fillRect(1430, 740, 400, 120); g.fillStyle = '#b8ccc5'; g.fillRect(1410, 720, 440, 26); g.fillStyle = '#2c5a50'; g.fillRect(1470, 770, 120, 10);
        g.fillStyle = '#e8f3ef'; rr(g, 1520, 640, 220, 50, 8); g.fill(); text(g, 'NURSES', 1630, 666, 30, '#2c5a50'); g.fillStyle = '#1a2a28'; g.fillRect(1620, 690, 6, 30);
        // hospital beds along the left wall
        for (const [bx, by, bs] of [[150, 900, 1], [420, 790, 0.7]]) { g.save(); g.translate(bx, by); g.scale(bs, bs); g.fillStyle = '#c9d9d3'; rr(g, -150, -110, 300, 50, 10); g.fill(); g.fillStyle = '#ffffff'; rr(g, -160, -150, 320, 46, 18); g.fill(); g.fillStyle = '#9fd4ff'; rr(g, -150, -172, 90, 32, 14); g.fill(); g.strokeStyle = '#8a9a96'; g.lineWidth = 7; g.beginPath(); g.moveTo(-130, -60); g.lineTo(-130, 0); g.moveTo(130, -60); g.lineTo(130, 0); g.moveTo(-170, -210); g.lineTo(-170, -100); g.stroke(); g.restore(); }
        // gurney
        g.save(); g.translate(1100, 900); g.fillStyle = '#c9d9d3'; rr(g, -150, -70, 300, 30, 8); g.fill(); g.fillStyle = '#e8f0ec'; rr(g, -140, -96, 120, 30, 10); g.fill();
        g.strokeStyle = '#8a9a96'; g.lineWidth = 6; g.beginPath(); g.moveTo(-120, -40); g.lineTo(-120, 0); g.moveTo(120, -40); g.lineTo(120, 0); g.stroke(); g.fillStyle = '#333'; for (const wx of [-120, 120]) { g.beginPath(); g.arc(wx, 6, 10, 0, TAU); g.fill(); } g.restore();
        // IV stand
        g.strokeStyle = '#9fb0ac'; g.lineWidth = 5; g.beginPath(); g.moveTo(330, 900); g.lineTo(330, 640); g.moveTo(300, 650); g.lineTo(360, 650); g.stroke(); g.fillStyle = 'rgba(200,240,255,0.7)'; rr(g, 318, 656, 24, 46, 8); g.fill();
      },
      live(g, t) {
        // ceiling lights (one flickers)
        for (let i = 0; i < 5; i++) {
          const k = i / 5, y = lerp(30, 400, Math.pow(k, 0.8)), w = lerp(260, 60, k), on = i === 2 ? (Math.sin(t * 19) + Math.sin(t * 7)) > -0.4 : true;
          g.fillStyle = on ? '#effff8' : '#6a807a'; g.fillRect(960 - w / 2, y, w, 10 + 8 * (1 - k));
          if (on) glow(g, 960, y + 10, 260 * (1 - k * 0.6), 'rgba(200,255,235,A)', 0.14);
        }
        // the red emergency light
        const p = 0.5 + 0.5 * Math.sin(t * 4); glow(g, 960, 455, 160, 'rgba(255,40,40,A)', 0.25 * p);
        g.fillStyle = `rgba(255,${60 + 60 * p},60,1)`; rr(g, 905, 440, 110, 30, 6); g.fill(); text(g, 'EXIT', 960, 456, 22, '#fff');
      },
    },
    highway: {
      grade: 'rgba(10,20,60,A)',
      still(g) {
        const r = rng(21);
        sky(g, [[0, '#0b1230'], [0.55, '#1f2b55'], [0.7, '#3d3a66']], 700);
        stars(g, r, 120, 420, 0.7);
        moon(g, 1500, 170, 54);
        glow(g, 300, 640, 420, 'rgba(255,140,60,A)', 0.25);
        skyline(g, r, 640, '#232a4a', 40, 160, 'rgba(255,190,110,0.5)');
        g.fillStyle = '#1b2240'; g.beginPath(); g.moveTo(0, 640); for (let x = 0; x <= W; x += 60) g.lineTo(x, 610 + Math.sin(x / 210) * 24); g.lineTo(W, 700); g.lineTo(0, 700); g.fill();
        // road in perspective
        g.fillStyle = '#26283a'; g.beginPath(); g.moveTo(-200, H); g.lineTo(880, 640); g.lineTo(1040, 640); g.lineTo(2120, H); g.fill();
        g.fillStyle = '#1b1d2c'; g.beginPath(); g.moveTo(0, 640); g.lineTo(880, 640); g.lineTo(-200, H); g.lineTo(0, H); g.fill(); g.beginPath(); g.moveTo(W, 640); g.lineTo(1040, 640); g.lineTo(2120, H); g.lineTo(W, H); g.fill();
        g.fillStyle = '#e8d07a'; for (let i = 0; i < 9; i++) { const k0 = Math.pow(i / 9, 2), k1 = Math.pow((i + 0.5) / 9, 2); const y0 = 640 + k0 * 440, y1 = 640 + k1 * 440, w0 = 3 + k0 * 16, w1 = 3 + k1 * 16; g.beginPath(); g.moveTo(960 - w0, y0); g.lineTo(960 + w0, y0); g.lineTo(960 + w1, y1); g.lineTo(960 - w1, y1); g.fill(); }
        // guardrails
        g.strokeStyle = '#8a8fa8'; g.lineWidth = 6; g.beginPath(); g.moveTo(-200, 860); g.lineTo(870, 650); g.moveTo(2120, 860); g.lineTo(1050, 650); g.stroke();
        // the overpass
        g.fillStyle = '#2b3048'; g.fillRect(-60, 140, 2040, 90); g.fillStyle = '#3a4060'; g.fillRect(-60, 130, 2040, 14); g.fillStyle = '#20253a'; for (let x = 0; x < 1920; x += 60) g.fillRect(x, 108, 8, 24); g.fillRect(-60, 104, 2040, 8);
        g.fillStyle = '#262a42'; g.fillRect(150, 230, 70, 420); g.fillRect(1700, 230, 70, 420);
        // gantry sign
        g.fillStyle = '#2b3048'; g.fillRect(560, 330, 14, 330); g.fillRect(1346, 330, 14, 330); g.fillRect(560, 330, 800, 14);
        g.fillStyle = '#1f7a4a'; rr(g, 640, 350, 300, 130, 10); g.fill(); g.strokeStyle = '#e8f3ef'; g.lineWidth = 4; rr(g, 648, 358, 284, 114, 8); g.stroke();
        text(g, 'ROUTE 9', 790, 392, 34, '#fff', { font: BODY }); text(g, 'COAST  40 ➜', 790, 442, 30, '#fff', { font: BODY });
        g.fillStyle = '#1f7a4a'; rr(g, 980, 350, 300, 130, 10); g.fill(); g.strokeStyle = '#e8f3ef'; rr(g, 988, 358, 284, 114, 8); g.stroke();
        text(g, 'SAFE ZONE', 1130, 392, 32, '#fff', { font: BODY }); text(g, '⚠ CLOSED?', 1130, 442, 28, '#ffd36b', { font: BODY });
        // abandoned cars
        car(g, 640, 740, 0.45, '#7a3a3a'); car(g, 1290, 760, 0.5, '#3a5a7a', { flip: true }); car(g, 1060, 690, 0.3, '#6a6a3a');
        car(g, 260, 880, 0.85, '#4a6a4a', { flip: true }); car(g, 1700, 900, 0.9, '#8a5a2a');
      },
      live(g, t) {
        hazard(g, 1820, 830, 1.1, t); hazard(g, 372, 820, 0.9, t + 0.3); hazard(g, 1340, 728, 0.6, t + 0.6);
        // fog banks drifting
        for (let i = 0; i < 4; i++) { const x = ((t * 22 + i * 600) % 2600) - 340; g.fillStyle = 'rgba(160,170,210,0.07)'; g.beginPath(); g.ellipse(x, 700 + i * 30, 420, 50, 0, 0, TAU); g.fill(); }
      },
    },
    farm: {
      grade: 'rgba(10,20,50,A)',
      still(g) {
        const r = rng(31);
        sky(g, [[0, '#0a1530'], [0.6, '#1d3157'], [0.75, '#3b4a72']], 760);
        stars(g, r, 140, 460, 0.8);
        moon(g, 1260, 330, 150, '#fff3c4');
        g.fillStyle = '#16233a'; g.beginPath(); g.moveTo(0, 640); for (let x = 0; x <= W; x += 40) g.lineTo(x, 600 + Math.sin(x / 320) * 50); g.lineTo(W, 760); g.lineTo(0, 760); g.fill();
        g.fillStyle = '#1d2f45'; g.beginPath(); g.moveTo(0, 700); for (let x = 0; x <= W; x += 40) g.lineTo(x, 680 + Math.sin(x / 200 + 2) * 30); g.lineTo(W, 800); g.lineTo(0, 800); g.fill();
        // barn
        g.save(); g.translate(1450, 740);
        g.fillStyle = '#7a2424'; g.beginPath(); g.moveTo(-200, 0); g.lineTo(-200, -200); g.lineTo(-120, -300); g.lineTo(120, -300); g.lineTo(200, -200); g.lineTo(200, 0); g.fill();
        g.fillStyle = '#5a1a1a'; g.beginPath(); g.moveTo(-220, -196); g.lineTo(-126, -312); g.lineTo(126, -312); g.lineTo(220, -196); g.lineTo(200, -190); g.lineTo(120, -290); g.lineTo(-120, -290); g.lineTo(-200, -190); g.fill();
        g.strokeStyle = '#f0e6d8'; g.lineWidth = 10; g.strokeRect(-90, -150, 180, 150); g.beginPath(); g.moveTo(-90, -150); g.lineTo(90, 0); g.moveTo(90, -150); g.lineTo(-90, 0); g.stroke();
        g.strokeRect(-40, -260, 80, 70); g.restore();
        // silo
        g.fillStyle = '#5a6a7a'; g.fillRect(1680, 440, 120, 300); g.beginPath(); g.arc(1740, 440, 60, Math.PI, 0); g.fill(); g.strokeStyle = '#46525e'; g.lineWidth = 4; for (let y = 470; y < 740; y += 36) { g.beginPath(); g.moveTo(1680, y); g.lineTo(1800, y); g.stroke(); }
        // farmhouse
        g.fillStyle = '#2a2a3e'; g.fillRect(140, 560, 300, 200); g.beginPath(); g.moveTo(110, 566); g.lineTo(290, 440); g.lineTo(470, 566); g.fill();
        g.fillStyle = '#ffc860'; g.fillRect(190, 610, 60, 60); g.fillStyle = '#3a3a52'; g.fillRect(330, 610, 60, 60); g.fillStyle = '#1f1f30'; g.fillRect(270, 660, 50, 100);
        glow(g, 220, 640, 120, 'rgba(255,190,90,A)', 0.3);
        // corn rows
        for (let row = 0; row < 3; row++) for (let x = 520 + row * 20; x < 1240; x += 26) {
          const y = 760 + row * 22, h = 70 + r() * 30; g.strokeStyle = ['#4a5a2a', '#5a6a32', '#6a7a3a'][row]; g.lineWidth = 5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - h / 2, x + (r() - 0.5) * 20, y - h); g.stroke();
          g.fillStyle = '#c9a84a'; if (r() < 0.3) { g.beginPath(); g.ellipse(x + 4, y - h * 0.6, 4, 10, 0.3, 0, TAU); g.fill(); }
        }
        // field / dirt
        const gr = g.createLinearGradient(0, 800, 0, H); gr.addColorStop(0, '#2b3a2a'); gr.addColorStop(1, '#1a2418'); g.fillStyle = gr; g.fillRect(0, 820, W, H - 820);
        // fence
        g.fillStyle = '#6a5034'; for (let x = 0; x < W; x += 160) g.fillRect(x, 780, 14, 80); g.fillRect(0, 795, W, 10); g.fillRect(0, 828, W, 10);
        // hay bales
        for (const [x, y, s] of [[1230, 790, 1], [1330, 800, 0.9], [1280, 740, 0.85], [560, 810, 0.8]]) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#c9a23a'; rr(g, -70, -60, 140, 60, 12); g.fill(); g.strokeStyle = '#8a6a1a'; g.lineWidth = 3; for (let i = -55; i <= 55; i += 18) { g.beginPath(); g.moveTo(i, -54); g.lineTo(i + 6, -4); g.stroke(); } g.restore(); }
        // pumpkins
        for (const [x, s] of [[90, 1], [180, 0.7], [1840, 0.9]]) { g.fillStyle = '#e07a2a'; g.beginPath(); g.ellipse(x, 960, 40 * s, 30 * s, 0, 0, TAU); g.fill(); g.strokeStyle = '#a8501a'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, 960, 14 * s, 30 * s, 0, 0, TAU); g.stroke(); g.fillStyle = '#3a6a2a'; g.fillRect(x - 4, 926 - 6 * s, 8, 12); }
      },
      live(g, t) {
        // windmill
        g.save(); g.translate(1000, 470); g.fillStyle = '#2a3346'; g.beginPath(); g.moveTo(-14, 0); g.lineTo(14, 0); g.lineTo(30, 300); g.lineTo(-30, 300); g.fill();
        g.rotate(t * 0.7); g.fillStyle = '#c8cfd8'; for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); g.beginPath(); g.moveTo(0, -6); g.lineTo(110, -16); g.lineTo(110, 16); g.lineTo(0, 6); g.fill(); }
        g.fillStyle = '#2a3346'; g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.fill(); g.restore();
        // scarecrow sways
        g.save(); g.translate(700, 760); g.rotate(Math.sin(t * 0.9) * 0.05); g.strokeStyle = '#5a4026'; g.lineWidth = 8; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -170); g.moveTo(-70, -120); g.lineTo(70, -120); g.stroke();
        g.fillStyle = '#7a5a8a'; rr(g, -40, -140, 80, 80, 10); g.fill(); g.fillStyle = '#d9b46a'; g.beginPath(); g.arc(0, -168, 26, 0, TAU); g.fill(); g.fillStyle = '#3a2a1a'; g.beginPath(); g.moveTo(-40, -180); g.lineTo(40, -180); g.lineTo(18, -214); g.lineTo(-18, -214); g.fill();
        g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(-9, -170, 4, 0, TAU); g.arc(9, -170, 4, 0, TAU); g.fill(); g.restore();
        // fireflies
        for (let i = 0; i < 14; i++) { const x = (i * 137 + Math.sin(t * 0.4 + i) * 60) % W, y = 640 + Math.sin(t * 0.7 + i * 2) * 90 + (i % 3) * 40, a = 0.5 + 0.5 * Math.sin(t * 3 + i); glow(g, x, y, 14, 'rgba(220,255,120,A)', a * 0.9); }
      },
    },
    rescue: {
      grade: 'rgba(30,20,60,A)',
      still(g) {
        const r = rng(41);
        sky(g, [[0, '#1b2350'], [0.35, '#4d3d7a'], [0.5, '#c0607a'], [0.58, '#ff9e6b'], [0.62, '#ffd38a']], 660);
        stars(g, r, 40, 220, 0.5);
        g.fillStyle = 'rgba(255,230,160,0.95)'; g.beginPath(); g.arc(560, 640, 70, Math.PI, 0); g.fill(); glow(g, 560, 630, 300, 'rgba(255,200,120,A)', 0.4);
        // the harbor
        const sea = g.createLinearGradient(0, 640, 0, 800); sea.addColorStop(0, '#4a4a7a'); sea.addColorStop(1, '#22284e'); g.fillStyle = sea; g.fillRect(0, 640, W, 160);
        skyline(g, r, 660, '#2e2b55', 20, 90, null);
        g.fillStyle = 'rgba(46,43,85,0.9)'; g.fillRect(0, 640, W, 22);
        // lighthouse + pier + boat
        g.fillStyle = '#e8e0d8'; g.beginPath(); g.moveTo(1620, 640); g.lineTo(1636, 520); g.lineTo(1664, 520); g.lineTo(1680, 640); g.fill(); g.fillStyle = '#c84a4a'; g.fillRect(1630, 560, 42, 18); g.fillRect(1626, 600, 50, 18);
        g.fillStyle = '#3a2a2a'; g.fillRect(1100, 700, 340, 12); for (let x = 1110; x < 1440; x += 40) g.fillRect(x, 700, 8, 40);
        g.fillStyle = '#f0ece6'; g.beginPath(); g.moveTo(1180, 690); g.lineTo(1380, 690); g.lineTo(1350, 720); g.lineTo(1200, 720); g.fill(); g.fillStyle = '#d24a4a'; g.fillRect(1240, 664, 70, 26);
        // rooftop
        g.fillStyle = '#3a3b4e'; g.fillRect(0, 800, W, H - 800); g.fillStyle = '#4b4c62'; g.fillRect(0, 790, W, 22); g.fillStyle = '#2a2b3a'; g.fillRect(0, 812, W, 6);
        // helipad
        g.save(); g.translate(960, 930); g.scale(1, 0.32); g.strokeStyle = '#ffd34a'; g.lineWidth = 22; g.beginPath(); g.arc(0, 0, 420, 0, TAU); g.stroke(); g.restore();
        g.save(); g.translate(960, 930); g.scale(1.8, 0.6); text(g, 'H', 0, 0, 160, 'rgba(255,211,74,0.85)'); g.restore();
        // roof door shed + AC units + antenna
        g.fillStyle = '#4e4f66'; g.fillRect(40, 600, 230, 210); g.fillStyle = '#5e6078'; g.fillRect(30, 590, 250, 20); g.fillStyle = '#6a6c86'; g.fillRect(110, 670, 90, 140); g.fillStyle = '#2a2b3a'; g.fillRect(186, 740, 8, 12);
        for (const x of [1600, 1760]) { g.fillStyle = '#6a6c80'; g.fillRect(x, 700, 130, 110); g.fillStyle = '#4a4b5e'; g.beginPath(); g.arc(x + 65, 755, 38, 0, TAU); g.fill(); }
        g.strokeStyle = '#5a5c70'; g.lineWidth = 6; g.beginPath(); g.moveTo(1520, 800); g.lineTo(1520, 470); g.moveTo(1490, 540); g.lineTo(1550, 540); g.moveTo(1500, 600); g.lineTo(1540, 600); g.stroke();
      },
      live(g, t) {
        // sea glints
        for (let i = 0; i < 26; i++) { const x = (i * 97 + t * 30 * ((i % 3) + 1)) % W, y = 668 + (i * 37) % 120, a = 0.3 + 0.3 * Math.sin(t * 3 + i); g.fillStyle = `rgba(255,220,170,${a})`; g.fillRect(x, y, 26, 3); }
        // antenna blink
        if (Math.floor(t * 1.4) % 2) glow(g, 1520, 470, 40, 'rgba(255,40,40,A)', 0.9);
        g.fillStyle = Math.floor(t * 1.4) % 2 ? '#ff5050' : '#702020'; g.beginPath(); g.arc(1520, 470, 8, 0, TAU); g.fill();
        // gulls
        g.strokeStyle = '#f0e8f0'; g.lineWidth = 3; for (let i = 0; i < 3; i++) { const x = (t * 40 + i * 500) % 2200 - 140, y = 300 + i * 50, f = Math.sin(t * 6 + i) * 8; g.beginPath(); g.moveTo(x - 16, y - f); g.quadraticCurveTo(x - 6, y - 6, x, y); g.quadraticCurveTo(x + 6, y - 6, x + 16, y - f); g.stroke(); }
      },
    },
  };
  // Cached static layers (the last few locations only).
  const still = new Map();
  function stillOf(loc) {
    let c = still.get(loc);
    if (!c) {
      c = document.createElement('canvas'); c.width = W; c.height = H;
      try { LOC[loc].still(c.getContext('2d')); } catch (e) { console.error(e); }
      if (still.size > 3) still.delete(still.keys().next().value);
      still.set(loc, c);
    }
    return c;
  }
  function backdrop(g, loc, t, o = {}) {
    const L = LOC[loc] || LOC.streets;
    g.drawImage(stillOf(LOC[loc] ? loc : 'streets'), 0, 0, W, H);
    try { L.live(g, t); } catch (e) { /* keep drawing */ }
    if (o.dark) { g.fillStyle = L.grade.replace('A', o.dark); g.fillRect(-200, -200, W + 400, H + 400); }
  }
  // Low fog rolling along the ground.
  function fog(g, t, a = 0.18, y = 980) {
    for (let i = 0; i < 7; i++) { const x = ((t * (18 + i * 4) + i * 420) % 2700) - 400; g.fillStyle = `rgba(190,200,230,${a * (0.6 + 0.4 * Math.sin(t * 0.5 + i))})`; g.beginPath(); g.ellipse(x, y + (i % 3) * 30, 380, 60, 0, 0, TAU); g.fill(); }
  }
  // A vignette to frame the shot.
  function vignette(g, a = 0.55) { const gr = g.createRadialGradient(960, 560, 380, 960, 560, 1250); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(5,0,15,${a})`); g.fillStyle = gr; g.fillRect(-200, -200, W + 400, H + 400); }

  // ---------- a cartoon zombie (feet at x,y; s=1 is ~230 tall) ----------
  const SHIRTS = ['#7a5a9a', '#4a7a8a', '#9a6a3a', '#5a7a4a', '#8a4a5a', '#5a5a8a'];
  const SKINS = ['#9ccf7a', '#a8d68a', '#8cc49a', '#b3d47a'];
  function zombie(g, x, y, s, t, o = {}) {
    const seed = o.seed || 0, dir = o.dir || 1, ph = t * (o.speed || 3) + seed;
    const shirt = SHIRTS[seed % SHIRTS.length], skin = SKINS[seed % SKINS.length];
    const step = Math.sin(ph), bob = Math.abs(Math.cos(ph)) * 6, lean = 0.12 + Math.sin(ph * 0.5) * 0.04;
    g.save(); g.translate(x, y); g.scale(s * dir, s); if (o.alpha != null) g.globalAlpha *= o.alpha;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, 4, 54, 12, 0, 0, TAU); g.fill();
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INK;
    // legs (one drags)
    g.lineWidth = 22; g.strokeStyle = '#3a3550';
    g.beginPath(); g.moveTo(-12, -78); g.lineTo(-14 + step * 14, -4); g.moveTo(14, -78); g.lineTo(18 - step * 6, -2); g.stroke();
    g.fillStyle = '#2a2433'; g.beginPath(); g.ellipse(-12 + step * 14, -2, 18, 9, 0, 0, TAU); g.ellipse(22 - step * 6, 0, 18, 9, 0, 0, TAU); g.fill();
    g.translate(0, -bob); g.rotate(lean);
    // torso: a tattered shirt
    g.fillStyle = shirt; g.lineWidth = 6; g.strokeStyle = INK;
    g.beginPath(); g.moveTo(-36, -150); g.lineTo(36, -150); g.lineTo(40, -82); g.lineTo(26, -70); g.lineTo(14, -84); g.lineTo(0, -70); g.lineTo(-14, -84); g.lineTo(-30, -70); g.lineTo(-40, -82); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.moveTo(-6, -130); g.lineTo(8, -118); g.lineTo(-2, -108); g.fill();
    // arms out front, wobbling
    const ar = Math.sin(ph * 0.8) * 8;
    g.strokeStyle = skin; g.lineWidth = 17;
    g.beginPath(); g.moveTo(26, -140); g.lineTo(96, -142 + ar); g.moveTo(14, -132); g.lineTo(88, -124 - ar); g.stroke();
    g.fillStyle = skin; g.beginPath(); g.arc(100, -142 + ar, 11, 0, TAU); g.arc(92, -124 - ar, 11, 0, TAU); g.fill();
    // head
    g.translate(4, -184);
    g.fillStyle = skin; g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, 40, 44, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = 'rgba(60,110,50,0.4)'; g.beginPath(); g.arc(-16, 18, 8, 0, TAU); g.arc(20, -20, 6, 0, TAU); g.fill();
    // hair tuft
    g.strokeStyle = '#3a3a2a'; g.lineWidth = 5; g.beginPath(); g.moveTo(-10, -42); g.lineTo(-16, -60); g.moveTo(0, -44); g.lineTo(4, -62); g.moveTo(10, -42); g.lineTo(20, -56); g.stroke();
    // eyes: one big, one small, droopy lids
    g.fillStyle = '#fffbe8'; g.strokeStyle = INK; g.lineWidth = 4;
    g.beginPath(); g.arc(10, -6, 14, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(-16, -4, 9, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.arc(14 + Math.sin(ph * 0.3) * 3, -4, 4, 0, TAU); g.arc(-14, -2, 3, 0, TAU); g.fill();
    g.fillStyle = skin; g.fillRect(-4, -22, 30, 10); g.fillRect(-28, -16, 22, 7);
    // mouth: a goofy groan
    g.fillStyle = '#3a1a2a'; g.beginPath(); g.ellipse(4, 22, 14, 8 + Math.abs(Math.sin(ph * 0.7)) * 5, 0, 0, TAU); g.fill();
    g.fillStyle = '#fffbe8'; g.fillRect(-2, 15, 6, 6); g.fillRect(8, 15, 5, 5);
    g.restore();
  }
  // ---------- a survivor (feet at x,y; emoji head) ----------
  // o: { avatar, color, pose, ph, tint ('sick'|'ghost'), lean, crouch, item (emoji in hand), alpha, name }
  function survivor(g, x, y, s, t, o = {}) {
    const pose = o.pose || 'idle', ph = t * (pose === 'run' || pose === 'decoy' ? 11 : pose === 'sneak' ? 5 : 2) + (o.ph || 0);
    const col = o.color || '#ffb400', crouch = o.crouch || (pose === 'hide' ? 0.42 : pose === 'sneak' ? 0.18 : 0);
    g.save(); g.translate(x, y); g.scale(s * (o.dir || 1), s); if (o.alpha != null) g.globalAlpha *= o.alpha;
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 4, 46, 11, 0, 0, TAU); g.fill();
    g.lineCap = 'round'; g.lineJoin = 'round';
    const run = pose === 'run' || pose === 'decoy', walk = run || pose === 'sneak';
    const sw = walk ? Math.sin(ph) * (run ? 0.9 : 0.5) : 0, bob = run ? Math.abs(Math.sin(ph)) * 10 : pose === 'idle' ? Math.sin(ph) * 2 : 0;
    const hip = -64 * (1 - crouch * 0.6);
    // legs
    if (pose !== 'swim' && pose !== 'drive') {
      g.strokeStyle = '#2a2638'; g.lineWidth = 16;
      if (pose === 'rest') { g.beginPath(); g.moveTo(-8, -26); g.lineTo(34, -20); g.moveTo(8, -26); g.lineTo(40, -6); g.stroke(); }
      else { g.beginPath(); g.moveTo(-8, hip - bob); g.lineTo(-10 + Math.sin(sw) * 40, -4); g.moveTo(8, hip - bob); g.lineTo(10 - Math.sin(sw) * 40, -4); g.stroke(); }
    }
    g.translate(0, (pose === 'rest' ? -26 - hip : 0) - bob);
    g.rotate((o.lean || 0) + (run ? 0.18 : 0) + (pose === 'hold' ? 0.32 : 0));
    // torso
    const top = hip - 70 * (1 - crouch * 0.35);
    g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 5; rr(g, -26, top, 52, hip - top + 6, 16); g.fill(); g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-26, hip - 18, 52, 8);
    // arms by pose
    g.strokeStyle = col; g.lineWidth = 14; const sh = top + 12;
    let L = [-34, sh + 44], R = [34, sh + 44];
    if (run) { L = [-30 - Math.sin(ph) * 22, sh + 36]; R = [30 + Math.sin(ph) * 22, sh + 36]; }
    else if (pose === 'climb') { const k = Math.sin(t * 7 + (o.ph || 0)); L = [-26, sh - 50 - k * 16]; R = [26, sh - 50 + k * 16]; }
    else if (pose === 'fight') { const k = Math.max(0, Math.sin(t * 8 + (o.ph || 0))); R = [40 + k * 46, sh - 6 - k * 10]; L = [-30, sh + 30]; }
    else if (pose === 'hold') { L = [50, sh + 4]; R = [54, sh + 22]; }
    else if (pose === 'search') { const k = Math.sin(t * 9 + (o.ph || 0)); L = [-20, sh + 54 + k * 8]; R = [24, sh + 56 - k * 8]; }
    else if (pose === 'swim') { const k = Math.sin(t * 6 + (o.ph || 0)); L = [-46, sh + k * 20]; R = [46, sh - k * 20]; }
    else if (pose === 'talk' || pose === 'cheer') { const k = Math.sin(t * 6 + (o.ph || 0)); R = [36, sh - 40 - k * 10]; if (pose === 'cheer') L = [-36, sh - 40 + k * 10]; }
    else if (pose === 'hide') { L = [-14, sh - 18]; R = [14, sh - 18]; }
    g.beginPath(); g.moveTo(-20, sh); g.lineTo(L[0], L[1]); g.moveTo(20, sh); g.lineTo(R[0], R[1]); g.stroke();
    if (o.item) { g.save(); g.translate(R[0] + 8, R[1] - 6); g.rotate(pose === 'fight' ? -0.3 : 0); g.scale(o.dir || 1, 1); emoji(g, o.item, 0, 0, 44); g.restore(); }
    // head
    emoji(g, o.avatar || '🙂', 0, top - 36, 78, o.tint);
    g.restore();
  }
  // A ghost: a pale sheet with the avatar inside, bobbing.
  function ghost(g, x, y, s, t, o = {}) {
    const ph = t * 2 + (o.ph || 0);
    g.save(); g.translate(x, y + Math.sin(ph) * 10); g.scale(s, s); g.globalAlpha *= o.alpha == null ? 0.85 : o.alpha;
    g.fillStyle = 'rgba(225,235,255,0.85)'; g.strokeStyle = 'rgba(160,180,230,0.9)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-46, 40); g.lineTo(-46, -20); g.arc(0, -20, 46, Math.PI, 0); g.lineTo(46, 40);
    for (let i = 0; i < 4; i++) { const xx = 46 - (i + 0.5) * 23; g.quadraticCurveTo(xx + 6, 54 + Math.sin(ph * 2 + i) * 6, xx - 11.5, 40); }
    g.closePath(); g.fill(); g.stroke();
    emoji(g, o.avatar || '🙂', 0, -14, 52, 'ghost');
    g.fillStyle = '#2a3050'; g.beginPath(); g.ellipse(-14, -18, 5, 7, 0, 0, TAU); g.ellipse(14, -18, 5, 7, 0, 0, TAU); g.fill();
    g.restore();
  }
  // The rescue helicopter (s=1 is ~520 wide).
  function chopper(g, x, y, s, t, o = {}) {
    g.save(); g.translate(x, y); g.scale(s * (o.dir || 1), s); g.rotate(o.tilt || -0.04);
    g.strokeStyle = INK; g.lineWidth = 8; g.lineJoin = 'round';
    // tail
    g.fillStyle = '#e8eef4'; g.beginPath(); g.moveTo(-120, -20); g.lineTo(-330, -40); g.lineTo(-330, -10); g.lineTo(-120, 30); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#d24a4a'; g.beginPath(); g.moveTo(-330, -60); g.lineTo(-300, -30); g.lineTo(-330, -6); g.closePath(); g.fill(); g.stroke();
    g.save(); g.translate(-326, -30); g.rotate(t * 30); g.strokeStyle = 'rgba(40,40,60,0.6)'; g.lineWidth = 10; g.beginPath(); g.moveTo(-36, 0); g.lineTo(36, 0); g.stroke(); g.restore();
    // body
    g.fillStyle = '#f0f4f8'; g.beginPath(); g.ellipse(0, 0, 160, 92, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#d24a4a'; g.beginPath(); g.ellipse(0, 30, 156, 30, 0, 0, Math.PI); g.fill();
    g.fillStyle = '#7ec8ff'; g.beginPath(); g.moveTo(40, -70); g.quadraticCurveTo(150, -60, 150, 10); g.lineTo(60, 10); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#d24a4a'; g.fillRect(-60, -40, 50, 16); g.fillRect(-43, -57, 16, 50);
    // passengers in the window
    if (o.faces && o.faces.length) { g.save(); g.beginPath(); g.moveTo(40, -70); g.quadraticCurveTo(150, -60, 150, 10); g.lineTo(60, 10); g.closePath(); g.clip(); o.faces.slice(0, 3).forEach((e, i) => emoji(g, e, 80 + i * 26, -18, 40)); g.restore(); }
    // skids
    g.strokeStyle = '#4a4e5e'; g.lineWidth = 10; g.beginPath(); g.moveTo(-100, 80); g.lineTo(-90, 120); g.moveTo(80, 80); g.lineTo(70, 120); g.moveTo(-140, 122); g.lineTo(130, 122); g.stroke();
    // rotor
    g.fillStyle = '#4a4e5e'; g.fillRect(-12, -120, 24, 32);
    const w = Math.abs(Math.cos(t * 26)) * 330 + 40; g.fillStyle = 'rgba(40,44,60,0.75)'; g.beginPath(); g.ellipse(0, -122, w, 10, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(40,44,60,0.18)'; g.beginPath(); g.ellipse(0, -122, 340, 18, 0, 0, TAU); g.fill();
    if (o.ladder) { g.strokeStyle = '#c9a36b'; g.lineWidth = 5; const L = o.ladder; g.beginPath(); g.moveTo(-30, 122); g.quadraticCurveTo(-30 + Math.sin(t * 2) * 20, 122 + L / 2, -26 + Math.sin(t * 2.4) * 30, 122 + L); g.moveTo(10, 122); g.quadraticCurveTo(10 + Math.sin(t * 2) * 20, 122 + L / 2, 14 + Math.sin(t * 2.4) * 30, 122 + L); g.stroke(); }
    g.restore();
    // searchlight
    if (o.light) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(x, y, x + (o.lightX || 0), y + 900 * s); gr.addColorStop(0, 'rgba(255,250,210,0.35)'); gr.addColorStop(1, 'rgba(255,250,210,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x + 40 * s, y + 60 * s); g.lineTo(x + (o.lightX || 0) - 260, y + 900); g.lineTo(x + (o.lightX || 0) + 260, y + 900); g.lineTo(x + 90 * s, y + 60 * s); g.fill(); g.restore(); }
  }
  // Comic burst ("POW!", "GRR!") with a spiky outline.
  function burst(g, x, y, r, str, fill = '#ffd34a', ink = INK, k = 1) {
    g.save(); g.translate(x, y); g.scale(k, k); g.rotate(-0.08);
    g.fillStyle = fill; g.strokeStyle = ink; g.lineWidth = 6; g.beginPath();
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, rr2 = i % 2 ? r * 0.68 : r; g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2 * 0.75); }
    g.closePath(); g.fill(); g.stroke(); text(g, str, 0, 2, r * 0.5, ink, { max: r * 1.4 }); g.restore();
  }

  // ---------- name plates: big, high-contrast, readable from the couch ----------
  // A dark pill with a bold white name and the player's colour as the border. Centred on x, top at y.
  // o: { color, px (font size), max (max width), bg, ink, icon (emoji before the name) }
  function plate(g, x, y, name, o = {}) {
    let px = o.px || 32; const max = o.max || 360, icon = o.icon || '', iw = icon ? px * 1.15 : 0;
    g.font = `700 ${px}px ${BODY}`;
    let tw = g.measureText(name).width;
    while (px > 16 && tw + iw + px * 1.1 > max) { px -= 2; g.font = `700 ${px}px ${BODY}`; tw = g.measureText(name).width; }
    let label = name;
    if (tw + iw + px * 1.1 > max) { while (label.length > 2 && g.measureText(label + '…').width + iw + px * 1.1 > max) label = label.slice(0, -1); label += '…'; tw = g.measureText(label).width; }
    const w = tw + iw + px * 1.1, h = px * 1.55;
    g.fillStyle = 'rgba(0,0,0,0.45)'; rr(g, x - w / 2 + 3, y + 4, w, h, h / 2); g.fill();
    g.fillStyle = o.bg || 'rgba(12,10,20,0.92)'; rr(g, x - w / 2, y, w, h, h / 2); g.fill();
    g.lineWidth = Math.max(3, px * 0.14); g.strokeStyle = o.color || '#ffffff'; g.stroke();
    if (icon) emoji(g, icon, x - w / 2 + px * 0.55 + iw / 2 - px * 0.1, y + h / 2, px * 0.95);
    g.fillStyle = o.ink || '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, x + iw / 2, y + h / 2 + px * 0.04);
    return w;
  }

  // ---------- set pieces for the outcome scenes ----------
  const STYLE = {
    streets: { frame: '#6b4a2e', back: '#2e2018', board: '#8a6440', goods: ['🔧', '🪛', '🧰', '🔩', '🪣'], cover: 'car', wall: '#4a3a52', win: '#ffd36b', door: '#7a5a3a' },
    mall: { frame: '#5a5a86', back: '#221f40', board: '#7a78b0', goods: ['👟', '🎮', '🧸', '📦', '🧢'], cover: 'counter', wall: '#3a3566', win: '#9fc3ff', door: 'shutter' },
    hospital: { frame: '#dfe9e5', back: '#7f9a92', board: '#f4faf7', goods: ['💊', '🧴', '🩺', '🧪', '🧻'], cover: 'bed', wall: '#3c625a', win: '#c9fff0', door: '#9fb5ad' },
    highway: { frame: '#8a8a9a', back: '#2a2c3a', board: '#b0b0c0', goods: ['🥤', '🍫', '🛢️', '🔋', '🍿'], cover: 'car', wall: '#4a4c60', win: '#ffd9a0', door: '#6a6c80' },
    farm: { frame: '#7a5230', back: '#3a2414', board: '#9a6a3a', goods: ['🪣', '🥚', '🌽', '🧺', '🍎'], cover: 'hay', wall: '#7a2424', win: '#ffc860', door: '#6a4a2e' },
    rescue: { frame: '#5a6070', back: '#23262f', board: '#7a8090', goods: ['🧯', '🛟', '⚓', '📦', '🧭'], cover: 'ac', wall: '#4e4f66', win: '#ffe0a8', door: '#6a6c86' },
  };
  const styleOf = (loc) => STYLE[loc] || STYLE.streets;
  // A store shelf / cabinet. Returns the y of the middle shelf (where the pick-ups sit).
  function shelf(g, loc, x0, x1, top, bottom, title) {
    const S = styleOf(loc), w = x1 - x0, h = bottom - top;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x0 + 10, top + 14, w, h);
    g.fillStyle = S.back; g.fillRect(x0, top, w, h);
    g.fillStyle = S.frame; g.fillRect(x0 - 14, top - 16, w + 28, 22); g.fillRect(x0 - 14, top, 18, h); g.fillRect(x1 - 4, top, 18, h);
    const rows = [top + h * 0.34, top + h * 0.67, bottom - 10];
    for (const y of rows) { g.fillStyle = S.board; g.fillRect(x0, y, w, 14); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x0, y + 14, w, 6); }
    // filler goods on the top and bottom shelves
    const n = Math.floor(w / 95);
    for (let i = 0; i < n; i++) { emoji(g, S.goods[i % S.goods.length], x0 + 50 + i * (w - 100) / Math.max(1, n - 1), rows[0] - 30, 44); if (i % 2 === 0) emoji(g, S.goods[(i + 2) % S.goods.length], x0 + 50 + i * (w - 100) / Math.max(1, n - 1), rows[2] - 30, 44); }
    if (title) { const tw = Math.min(w * 0.7, 700); g.fillStyle = '#f4ead0'; rr(g, (x0 + x1) / 2 - tw / 2, top - 74, tw, 54, 10); g.fill(); g.strokeStyle = S.frame; g.lineWidth = 5; g.stroke(); text(g, title, (x0 + x1) / 2, top - 46, 32, '#2a2010', { max: tw - 24 }); }
    return rows[1];
  }
  // Cover to hide behind (feet line at y, centred on x).
  function hideCover(g, loc, kind, x, y, s) {
    const S = styleOf(loc); kind = kind || S.cover;
    g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = INK; g.lineWidth = 6; g.lineJoin = 'round';
    if (kind === 'car') { g.restore(); car(g, x, y, 0.62 * s, ['#c94a4a', '#3d6f8f', '#7a6a2a', '#5a7a4a'][Math.abs(Math.round(x)) % 4]); return; }
    if (kind === 'counter') { g.fillStyle = '#6a6a96'; rr(g, -130, -140, 260, 140, 10); g.fill(); g.stroke(); g.fillStyle = '#8a88c0'; rr(g, -142, -156, 284, 26, 8); g.fill(); g.stroke(); emoji(g, '🛎️', 80, -176, 40); }
    else if (kind === 'bed') { g.fillStyle = '#c9d9d3'; rr(g, -140, -110, 280, 50, 10); g.fill(); g.stroke(); g.fillStyle = '#ffffff'; rr(g, -150, -150, 300, 48, 18); g.fill(); g.stroke(); g.fillStyle = '#9fd4ff'; rr(g, -140, -175, 90, 34, 14); g.fill(); g.stroke(); g.strokeStyle = '#8a9a96'; g.lineWidth = 7; g.beginPath(); g.moveTo(-120, -60); g.lineTo(-120, 0); g.moveTo(120, -60); g.lineTo(120, 0); g.moveTo(150, -200); g.lineTo(150, -100); g.stroke(); }
    else if (kind === 'hay') { g.fillStyle = '#d9b24a'; rr(g, -130, -130, 260, 130, 22); g.fill(); g.stroke(); g.strokeStyle = '#a8842a'; g.lineWidth = 4; for (let i = -100; i <= 100; i += 26) { g.beginPath(); g.moveTo(i, -120); g.lineTo(i + 10, -8); g.stroke(); } g.strokeStyle = '#6a4a1a'; g.lineWidth = 6; g.beginPath(); g.moveTo(-130, -70); g.lineTo(130, -70); g.stroke(); }
    else if (kind === 'ac') { g.fillStyle = '#7a7c90'; rr(g, -125, -150, 250, 150, 8); g.fill(); g.stroke(); g.fillStyle = '#4a4b5e'; g.beginPath(); g.arc(-40, -75, 52, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#5a5c70'; for (let i = 0; i < 5; i++) g.fillRect(40, -130 + i * 24, 70, 12); }
    else { g.fillStyle = '#8a6440'; rr(g, -110, -140, 220, 140, 6); g.fill(); g.stroke(); g.beginPath(); g.moveTo(-110, -140); g.lineTo(110, 0); g.moveTo(110, -140); g.lineTo(-110, 0); g.stroke(); }
    g.restore();
  }
  // A door (or a roll-up shutter in the mall) on the right; open 0..1, shaking.
  function door(g, loc, x, y, open, shake) {
    const S = styleOf(loc), h = 430, w = 230;
    g.fillStyle = '#1a1420'; g.fillRect(x - 16, y - h - 16, w + 32, h + 16);
    g.fillStyle = '#3a3040'; g.fillRect(x - 26, y - h - 30, w + 52, 22);
    if (S.door === 'shutter') {
      const up = h * open;
      for (let yy = y - h + up; yy < y; yy += 26) { g.fillStyle = '#9a98c0'; g.fillRect(x + shake, yy, w, 22); g.fillStyle = '#6a68a0'; g.fillRect(x + shake, yy + 22, w, 4); }
      return;
    }
    g.save(); g.translate(x + shake, y);
    g.transform(1 - open * 0.8, -open * 0.15, 0, 1, 0, 0);
    g.fillStyle = S.door; g.strokeStyle = INK; g.lineWidth = 8; rr(g, 0, -h, w, h, 8); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6; g.strokeRect(24, -h + 30, w - 48, h * 0.38); g.strokeRect(24, -h * 0.5, w - 48, h * 0.38);
    g.fillStyle = '#e8c45a'; g.beginPath(); g.arc(w - 30, -h * 0.5, 10, 0, TAU); g.fill();
    g.restore();
  }
  // A building wall with a ledge to climb up to (top = ledge height).
  function wall(g, loc, x0, x1, top, y) {
    const S = styleOf(loc);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0 + 12, top + 12, x1 - x0, y - top);
    g.fillStyle = S.wall; g.fillRect(x0, top, x1 - x0, y - top);
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 3;
    for (let yy = top + 40; yy < y; yy += 40) { g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke(); for (let xx = x0 + ((yy / 40) % 2) * 50; xx < x1; xx += 100) { g.beginPath(); g.moveTo(xx, yy - 40); g.lineTo(xx, yy); g.stroke(); } }
    for (let xx = x0 + 120; xx < x1 - 100; xx += 300) { g.fillStyle = '#1a1420'; g.fillRect(xx, top + 70, 90, 110); g.fillStyle = S.win; g.globalAlpha = 0.55; g.fillRect(xx + 8, top + 78, 74, 94); g.globalAlpha = 1; }
    g.fillStyle = '#2a2430'; g.fillRect(x0 - 20, top - 20, x1 - x0 + 40, 26);
  }
  function campfire(g, x, y, t) {
    g.fillStyle = '#5a3a1a'; g.save(); g.translate(x, y); g.rotate(0.3); g.fillRect(-70, -12, 140, 20); g.rotate(-0.6); g.fillRect(-70, -12, 140, 20); g.restore();
    glow(g, x, y - 50, 240, 'rgba(255,160,60,A)', 0.45 + 0.1 * Math.sin(t * 9));
    emoji(g, '🔥', x, y - 50 + Math.sin(t * 12) * 3, 96);
  }
  function water(g, y, t) {
    g.fillStyle = 'rgba(40,90,170,0.82)'; g.fillRect(-300, y, 2600, 600);
    g.strokeStyle = 'rgba(200,230,255,0.7)'; g.lineWidth = 6; g.beginPath(); for (let x = -300; x < 2300; x += 30) g.lineTo(x, y + Math.sin(x / 60 + t * 4) * 9); g.stroke();
  }
  function exitSign(g, x, y) { g.fillStyle = '#1f7a4a'; rr(g, x - 90, y - 34, 180, 68, 10); g.fill(); g.strokeStyle = '#e8f3ef'; g.lineWidth = 4; g.stroke(); text(g, 'EXIT ➜', x, y + 2, 34, '#fff', { font: BODY }); }

  BOX.zombieArt = {
    W, H, GROUND, LOCS: Object.keys(LOC), INK, FONT, BODY,
    util: { clamp, lerp, ease, easeOut, back, rng, hash, TAU },
    rr, emoji, text, cover, backdrop, plate, styleOf, props: { shelf, cover: hideCover, door, wall, campfire, water, exitSign }, fog, vignette, zombie, survivor, ghost, chopper, car, burst, glow,
  };
})();
