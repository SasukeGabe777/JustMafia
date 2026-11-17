'use strict';
// JustBid title screen: a self-storage lot at dusk. Two roll-up doors take turns rattling
// open: one hides glittering treasure, the other a stinky heap of junk. Bidders in the
// crowd raise paddles with rising bids, and the auctioneer's gavel bangs down "SOLD!".
(function () {
  const TAU = Math.PI * 2;
  const LOOP = 10;
  // [emoji, x (−1..1 across the door), height above floor (0..1 of door), size]
  const LOOT = [
    ['🖼️', -0.62, 0.42, 1.0], ['🏺', 0.6, 0.38, 0.95], ['🎸', -0.2, 0.5, 1.15], ['👑', 0.25, 0.6, 0.9],
    ['💰', -0.55, 0.12, 1.1], ['💎', 0.05, 0.22, 0.95], ['🏆', 0.5, 0.12, 1.05], ['💍', -0.15, 0.08, 0.7],
  ];
  const JUNK = [
    ['📦', -0.6, 0.3, 1.2], ['🪑', 0.55, 0.32, 1.15], ['📦', -0.1, 0.42, 1.0], ['🧸', 0.2, 0.55, 0.8],
    ['🥫', -0.55, 0.06, 0.75], ['🧦', 0.05, 0.05, 0.8], ['🗑️', 0.55, 0.06, 0.95], ['🍌', -0.25, 0.04, 0.6],
  ];

  function layer(W, H) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr));
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, x];
  }
  function ease(u) { u = Math.min(1, Math.max(0, u)); return u * u * (3 - 2 * u); }
  function door(b, x, y, w, h, col, k) {
    // A closed corrugated roll-up door, its top at y.
    b.fillStyle = col; b.fillRect(x, y, w, h);
    const step = 11 * k + 4;
    for (let yy = y + step; yy < y + h; yy += step) {
      b.fillStyle = 'rgba(0,0,0,0.22)'; b.fillRect(x, yy, w, 2 * k + 1);
      b.fillStyle = 'rgba(255,255,255,0.14)'; b.fillRect(x, yy + 2 * k + 1, w, 1.5 * k + 0.5);
    }
    const sh = b.createLinearGradient(x, 0, x + w, 0); sh.addColorStop(0, 'rgba(0,0,0,0.25)'); sh.addColorStop(0.3, 'rgba(0,0,0,0)'); sh.addColorStop(0.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.3)');
    b.fillStyle = sh; b.fillRect(x, y, w, h);
    b.fillStyle = '#2a2a30'; b.fillRect(x, y + h - 9 * k - 3, w, 9 * k + 3);
    b.fillStyle = '#c9ccd4'; b.fillRect(x + w / 2 - 18 * k, y + h - 24 * k - 6, 36 * k, 7 * k + 2);
  }

  BOX.titles.bid = {
    logo: '<span class="a">Just</span><span class="b">Bid!</span>',
    tagline: 'Bid on mystery storage lockers. Treasure or trash? Only the door knows.',
    start: '🔨 Open the auction',
    meta: '1–100 players · 15–30 min',
    font: "'Black Ops One', sans-serif",
    theme: { card: 'rgba(24, 20, 30, 0.92)', ink: '#fff4e0', muted: '#f2d6a8', accent: '#ffb21f', button: '#ffb21f', buttonInk: '#24160a', border: '#ffb21f' },
    css: `.bt-bid .bt-card { border: 9px solid transparent; background: linear-gradient(rgba(24, 20, 30, 0.93), rgba(24, 20, 30, 0.93)) padding-box, repeating-linear-gradient(-45deg, #ffb21f 0 18px, #1d1a22 18px 36px) border-box; }
      .bt-bid .bt-logo { white-space: nowrap; }
      .bt-bid .bt-logo .a { display: inline-block; font-size: 0.42em; vertical-align: 0.9em; background: #fff4e0; color: #24160a; padding: 0.12em 0.3em 0.05em; border-radius: 0.18em; transform: rotate(-8deg); margin-right: 0.12em; text-shadow: none; box-shadow: 0 4px 0 rgba(0,0,0,.35); }
      .bt-bid .bt-logo .b { display: inline-block; color: #ffb21f; font-size: 1.15em; transform: rotate(-2deg); text-shadow: 0 6px 0 #6b3a00, 0 0 30px rgba(255, 178, 31, 0.4); }`,
    init(W, H) {
      const sideW = Math.max(150, (W - Math.min(640, W * 0.92)) / 2), k = Math.min(H / 900, sideW / 480);
      const lx = sideW * 0.5, rx = W - sideW * 0.5;
      const yR = H * 0.25, yD = H * 0.37, yG = H * 0.76;
      const nU = Math.max(2, Math.round((rx - lx) / (270 * k + 30))), uw = (rx - lx) / nU, dw = Math.min(uw * 0.8, sideW * 0.72), dh = yG - yD;
      const [bg, b] = layer(W, H);
      // Dusk sky with a few early stars.
      const sky = b.createLinearGradient(0, 0, 0, yG); sky.addColorStop(0, '#160f30'); sky.addColorStop(0.45, '#4d2558'); sky.addColorStop(0.8, '#c4553a'); sky.addColorStop(1, '#f39a45');
      b.fillStyle = sky; b.fillRect(0, 0, W, yG);
      b.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 60; i++) { const x = Math.random() * W, y = Math.random() * yR * 0.9, r = Math.random() * 1.6 + 0.4; b.fillRect(x, y, r, r); }
      // Distant skyline silhouette behind the roof.
      b.fillStyle = '#2b1838';
      for (let x = 0; x < W;) { const w = (40 + Math.random() * 70) * k + 10, h = (30 + Math.random() * 90) * k; b.fillRect(x, yR - h, w, h + 4); x += w + 4 * k; }
      // The building: wall, parapet, siding lines.
      b.fillStyle = '#5d6070'; b.fillRect(0, yR, W, yG - yR);
      b.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = yR + 14 * k; y < yD; y += 14 * k + 2) b.fillRect(0, y, W, 2);
      b.fillStyle = '#3b3d4a'; b.fillRect(0, yR - 10 * k - 4, W, 16 * k + 6);
      b.fillStyle = '#ffb21f'; b.fillRect(0, yR + 6 * k + 2, W, 5 * k + 2);
      // Units and doors.
      const doorCols = ['#e8762b', '#e06a22', '#f08435', '#2a9d8f', '#e8762b', '#d9622a'];
      const units = [];
      for (let i = -Math.ceil(lx / uw) - 1, c = 0; lx + i * uw < W + uw; i++, c++) units.push({ cx: lx + i * uw, n: 100 + ((i * 37 + 211) % 89 + 89) % 89, col: doorCols[((i % 6) + 6) % 6] });
      for (const u of units) {
        const x = u.cx - dw / 2;
        b.fillStyle = '#2a2b33'; b.fillRect(x - 8 * k - 2, yD - 8 * k - 2, dw + 16 * k + 4, dh + 8 * k + 2);
        door(b, x, yD, dw, dh, u.col, k);
        // Number plate.
        b.fillStyle = '#f4efe2'; b.beginPath(); b.roundRect(u.cx - 30 * k - 6, yD - 46 * k - 8, 60 * k + 12, 28 * k + 6, 5 * k); b.fill();
        b.fillStyle = '#24160a'; b.font = `bold ${20 * k + 4}px Arial, sans-serif`; b.textAlign = 'center'; b.textBaseline = 'middle'; b.fillText(String(u.n), u.cx, yD - 32 * k - 5);
        // Wall lamp between units with a warm cone of light.
        const lxm = u.cx + uw / 2, ly = yD - 30 * k;
        const cone = b.createLinearGradient(0, ly, 0, yG + 40 * k); cone.addColorStop(0, 'rgba(255, 214, 140, 0.28)'); cone.addColorStop(1, 'rgba(255, 214, 140, 0)');
        b.fillStyle = cone; b.beginPath(); b.moveTo(lxm - 8 * k, ly); b.lineTo(lxm + 8 * k, ly); b.lineTo(lxm + uw * 0.42, yG + 40 * k); b.lineTo(lxm - uw * 0.42, yG + 40 * k); b.closePath(); b.fill();
        b.fillStyle = '#25252c'; b.beginPath(); b.roundRect(lxm - 12 * k - 2, ly - 10 * k - 2, 24 * k + 4, 12 * k + 3, 3); b.fill();
        b.fillStyle = '#ffe6a8'; b.fillRect(lxm - 9 * k - 1, ly + 1, 18 * k + 2, 3 * k + 1);
      }
      // Ground: hazard stripe, asphalt, parking lines.
      const hz = 12 * k + 4;
      b.save(); b.beginPath(); b.rect(0, yG, W, hz); b.clip(); b.fillStyle = '#1d1a22'; b.fillRect(0, yG, W, hz); b.fillStyle = '#ffb21f';
      for (let x = -hz * 2; x < W + hz * 2; x += hz * 2) { b.beginPath(); b.moveTo(x, yG + hz); b.lineTo(x + hz, yG); b.lineTo(x + hz * 2, yG); b.lineTo(x + hz, yG + hz); b.closePath(); b.fill(); }
      b.restore();
      const ag = b.createLinearGradient(0, yG + hz, 0, H); ag.addColorStop(0, '#3a3742'); ag.addColorStop(1, '#17151c'); b.fillStyle = ag; b.fillRect(0, yG + hz, W, H - yG - hz);
      b.strokeStyle = 'rgba(255, 220, 120, 0.45)'; b.lineWidth = 4 * k + 1;
      for (let x = -W * 0.2; x < W * 1.2; x += 150 * k + 30) { b.beginPath(); b.moveTo(x, yG + hz + 6); b.lineTo(x + (x - W / 2) * 0.35, H); b.stroke(); }
      const rnd = (a, z) => a + Math.random() * (z - a);
      // Crowd along the bottom, leaving the gavel corner free.
      const crowd = [];
      for (let x = 30 * k; x < W - sideW * 0.42; x += (64 + Math.random() * 30) * k + 12) crowd.push({ x, s: rnd(0.85, 1.15), ph: rnd(0, TAU), sp: rnd(0.5, 0.9), paddle: Math.abs(x - W / 2) > 430 * Math.min(1, W / 1600) && Math.random() < 0.75, n: 1 + Math.floor(Math.random() * 99) });
      return {
        bg, k, sideW, lx, rx, yD, yG, dw, dh, crowd,
        sparks: Array.from({ length: 10 }, () => ({ x: rnd(-0.9, 0.9), y: rnd(0.1, 0.8), ph: rnd(0, TAU) })),
      };
    },
    draw(g, W, H, t, S) {
      const { k, lx, rx, yD, yG, dw, dh, sideW } = S;
      g.drawImage(S.bg, 0, 0, W, H);
      // Facility sign on the roof.
      const sy = H * 0.13, sw = Math.min(W * 0.46, 560 * k + 60), sh = 64 * k + 14;
      g.fillStyle = '#2a2b33'; g.fillRect(W / 2 - sw * 0.35, sy, 8 * k + 2, H * 0.25 - sy); g.fillRect(W / 2 + sw * 0.35 - 8 * k, sy, 8 * k + 2, H * 0.25 - sy);
      g.fillStyle = '#1c1a22'; g.beginPath(); g.roundRect(W / 2 - sw / 2, sy - sh / 2, sw, sh, 10 * k); g.fill();
      g.strokeStyle = '#ffb21f'; g.lineWidth = 4 * k + 1; g.stroke();
      g.save(); g.shadowColor = '#ff9a1f'; g.shadowBlur = (12 + 4 * Math.sin(t * 1.5)) * k;
      g.fillStyle = '#ffc94d'; g.font = `${34 * k + 8}px 'Black Ops One', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('★ LOCKER ROW STORAGE ★', W / 2, sy + 2); g.restore();
      // The two mystery lockers: treasure on the left, junk on the right, taking turns.
      for (let d = 0; d < 2; d++) {
        const cx = d ? rx : lx, x = cx - dw / 2, lt = (t + (d ? LOOP / 2 : 0)) % LOOP;
        const open = lt < 1 ? 0 : lt < 2.3 ? ease((lt - 1) / 1.3) : lt < 6.6 ? 1 : ease(1 - (lt - 6.6) / 1.3);
        const rattle = lt > 0.4 && lt < 1 ? Math.sin(lt * 60) * 2 * k : 0;
        if (open > 0) {
          g.save(); g.beginPath(); g.rect(x, yD, dw, dh); g.clip();
          const ig = g.createLinearGradient(0, yD, 0, yD + dh); ig.addColorStop(0, '#120e18'); ig.addColorStop(1, d ? '#2b2620' : '#3a2a12'); g.fillStyle = ig; g.fillRect(x, yD, dw, dh);
          const fy = yD + dh - 6 * k, base = dw * 0.27;
          if (!d) {
            const pulse = 0.75 + 0.25 * Math.sin(t * 2.2);
            const gl = g.createRadialGradient(cx, fy - dh * 0.25, 0, cx, fy - dh * 0.25, dw * 0.8); gl.addColorStop(0, `rgba(255, 210, 90, ${0.55 * pulse * open})`); gl.addColorStop(1, 'rgba(255, 210, 90, 0)');
            g.fillStyle = gl; g.fillRect(x, yD, dw, dh);
          }
          g.font = `${base}px serif`; g.textAlign = 'center'; g.textBaseline = 'bottom';
          const items = d ? JUNK : LOOT;
          for (let i = 0; i < items.length; i++) {
            const it = items[i], s = base * it[3];
            g.font = `${s}px serif`; g.fillText(it[0], cx + it[1] * dw * 0.42, fy - it[2] * dh * 0.55);
          }
          if (!d) {
            g.fillStyle = '#fff6c8';
            for (const p of S.sparks) {
              const a = 0.5 + 0.5 * Math.sin(t * 3 + p.ph), r = (5 + 6 * a) * k + 1, px = cx + p.x * dw * 0.45, py = fy - p.y * dh * 0.7;
              g.globalAlpha = a * open; g.beginPath(); g.moveTo(px, py - r); g.quadraticCurveTo(px, py, px + r, py); g.quadraticCurveTo(px, py, px, py + r); g.quadraticCurveTo(px, py, px - r, py); g.quadraticCurveTo(px, py, px, py - r); g.fill();
            }
            g.globalAlpha = 1;
          } else {
            // Stink lines and a buzzing fly.
            g.strokeStyle = `rgba(150, 220, 90, ${0.6 * open})`; g.lineWidth = 3 * k + 1; g.lineCap = 'round';
            for (let j = 0; j < 3; j++) {
              const sx = cx + (j - 1) * dw * 0.25, rise = ((t * 0.6 + j * 0.33) % 1);
              g.globalAlpha = 1 - rise; g.beginPath();
              for (let q = 0; q <= 8; q++) { const yy = fy - dh * (0.45 + rise * 0.3) - q * 6 * k; const xx = sx + Math.sin(q * 0.9 + t * 3 + j) * 6 * k; q ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
              g.stroke();
            }
            g.globalAlpha = 1; g.font = `${base * 0.45}px serif`;
            g.fillText('🪰', cx + Math.sin(t * 2.1) * dw * 0.3, fy - dh * 0.55 + Math.sin(t * 4.2) * dh * 0.08);
          }
          g.restore();
        }
        // The door itself, rolled up by `open`, with the roll drum at the top.
        const vis = dh * (1 - open);
        if (vis > 1) {
          g.save(); g.beginPath(); g.rect(x - 2, yD, dw + 4, vis); g.clip(); g.translate(rattle, 0);
          const col = d ? '#2a9d8f' : '#e8762b';
          g.fillStyle = col; g.fillRect(x, yD, dw, vis);
          const step = 11 * k + 4;
          for (let yy = yD + vis - step; yy > yD; yy -= step) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(x, yy, dw, 2 * k + 1); g.fillStyle = 'rgba(255,255,255,0.14)'; g.fillRect(x, yy + 2 * k + 1, dw, 1.5 * k + 0.5); }
          g.fillStyle = '#2a2a30'; g.fillRect(x, yD + vis - 9 * k - 3, dw, 9 * k + 3);
          g.fillStyle = '#c9ccd4'; g.fillRect(cx - 18 * k, yD + vis - 24 * k - 6, 36 * k, 7 * k + 2);
          g.font = `${30 * k + 6}px 'Black Ops One', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(30, 16, 6, 0.55)';
          g.fillText('?', cx, yD + vis - dh * 0.5);
          if (open === 0) {
            // Padlock on the handle.
            const py = yD + dh - 12 * k;
            g.strokeStyle = '#b8bcc6'; g.lineWidth = 4 * k + 1; g.beginPath(); g.arc(cx, py - 4 * k, 9 * k + 2, Math.PI, TAU); g.stroke();
            g.fillStyle = '#d9a52a'; g.beginPath(); g.roundRect(cx - 13 * k - 2, py - 4 * k, 26 * k + 4, 22 * k + 4, 4 * k); g.fill();
          }
          g.restore();
        }
        g.fillStyle = '#3a3a44'; g.fillRect(x - 6 * k, yD - 4 * k, dw + 12 * k, 12 * k + 3);
        // Verdict stamp.
        const st = lt - 2.4;
        if (st > 0 && lt < 6.6) {
          const pop = Math.min(1, st / 0.22), sc = 1.6 - 0.6 * pop;
          g.save(); g.translate(cx, yD + dh * 0.2); g.rotate(d ? 0.12 : -0.12); g.scale(sc, sc); g.globalAlpha = pop;
          const word = d ? 'TRASH!' : 'TREASURE!';
          g.font = `${30 * k + 8}px 'Black Ops One', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          const tw = g.measureText(word).width + 28 * k + 8, th = 48 * k + 10;
          g.fillStyle = d ? '#6b4a2b' : '#1f9d5a'; g.beginPath(); g.roundRect(-tw / 2, -th / 2, tw, th, 8 * k); g.fill();
          g.strokeStyle = '#fff4e0'; g.lineWidth = 3 * k + 1; g.beginPath(); g.roundRect(-tw / 2 + 5 * k, -th / 2 + 5 * k, tw - 10 * k, th - 10 * k, 5 * k); g.stroke();
          g.fillStyle = '#fff4e0'; g.fillText(word, 0, 2 * k);
          g.restore();
        }
      }
      // The crowd of bidders, paddles going up.
      for (let i = 0; i < S.crowd.length; i++) {
        const p = S.crowd[i], s = p.s * k, bx = p.x, by = H + 10 * k, sway = Math.sin(t * p.sp + p.ph) * 3 * k;
        const ph = t * p.sp + p.ph, up = p.paddle ? ease((Math.sin(ph) - 0.55) / 0.25) : 0;
        if (up > 0) {
          const hx = bx + 34 * s, hy = by - 120 * s - up * 70 * s;
          g.strokeStyle = '#8a6a44'; g.lineWidth = 5 * s; g.beginPath(); g.moveTo(hx, hy + 36 * s); g.lineTo(hx, hy + 100 * s); g.stroke();
          g.fillStyle = '#fff4e0'; g.beginPath(); g.ellipse(hx, hy, 24 * s, 28 * s, 0, 0, TAU); g.fill();
          g.strokeStyle = '#ffb21f'; g.lineWidth = 3 * s; g.stroke();
          g.fillStyle = '#24160a'; g.font = `${20 * s}px 'Black Ops One', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(p.n), hx, hy + 2 * s);
          if (up > 0.9) {
            const amt = '$' + (25 * ((Math.floor(ph / TAU) * 3 + i) % 16 + 1));
            g.globalAlpha = (up - 0.9) * 10; g.font = `${22 * s}px 'Black Ops One', sans-serif`;
            const bw = g.measureText(amt).width + 18 * s;
            g.fillStyle = '#ffb21f'; g.beginPath(); g.roundRect(hx - bw / 2, hy - 72 * s, bw, 32 * s, 16 * s); g.fill();
            g.fillStyle = '#24160a'; g.fillText(amt, hx, hy - 55 * s); g.globalAlpha = 1;
          }
        }
        g.fillStyle = '#0f0c16';
        g.beginPath(); g.ellipse(bx + sway, by - 18 * s, 46 * s, 50 * s, 0, Math.PI, TAU); g.fill();
        g.beginPath(); g.arc(bx + sway * 1.4, by - 86 * s, 24 * s, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255, 160, 80, 0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(bx + sway * 1.4, by - 86 * s, 24 * s, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
      }
      // The auctioneer's gavel in the corner: raise, then bang. SOLD!
      const gx = W - sideW * 0.3, gy = H * 0.93, gt = t % 3.6;
      g.fillStyle = '#5a3416'; g.beginPath(); g.ellipse(gx, gy + 10 * k, 52 * k + 6, 16 * k + 3, 0, 0, TAU); g.fill();
      g.fillStyle = '#8a5428'; g.beginPath(); g.ellipse(gx, gy, 52 * k + 6, 16 * k + 3, 0, 0, TAU); g.fill();
      const ang = gt < 2.6 ? -0.9 - 0.15 * ease(gt / 2.6) : gt < 2.75 ? -1.05 + 1.05 * ease((gt - 2.6) / 0.15) : -0.9 * ease((gt - 2.75) / 0.85);
      g.save(); g.translate(gx + 100 * k, gy - 46 * k); g.rotate(-ang);
      g.fillStyle = '#7a4520'; g.beginPath(); g.roundRect(-118 * k, -6 * k, 110 * k, 12 * k + 1, 5 * k); g.fill();
      g.fillStyle = '#a0612e'; g.beginPath(); g.roundRect(-148 * k, -30 * k, 52 * k, 60 * k, 10 * k); g.fill();
      g.fillStyle = '#d9a52a'; g.fillRect(-140 * k, -30 * k, 6 * k, 60 * k); g.fillRect(-110 * k, -30 * k, 6 * k, 60 * k);
      g.restore();
      const sold = gt - 2.75;
      if (sold > 0 && sold < 0.85) {
        const u = sold / 0.85, sc = 0.7 + 0.5 * Math.min(1, u * 4);
        g.save(); g.translate(gx - 10 * k, gy - 90 * k); g.scale(sc, sc); g.globalAlpha = 1 - u * u;
        g.fillStyle = '#ffd23f'; g.beginPath();
        for (let i = 0; i < 24; i++) { const r = (i % 2 ? 44 : 70) * k, a = (i / 24) * TAU; i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.75) : g.moveTo(r, 0); }
        g.closePath(); g.fill();
        g.fillStyle = '#c0242f'; g.font = `${32 * k + 4}px 'Black Ops One', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SOLD!', 0, 2 * k);
        g.restore();
      }
    },
  };
})();
