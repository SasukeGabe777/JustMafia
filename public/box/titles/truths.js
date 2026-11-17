'use strict';
// Two Truths & a Lie title screen: a late-night interrogation room. A lamp swings over the
// card, a spotlight walks along a three-suspect lineup on the left and stamps each one TRUTH
// or LIE (the liar's nose grows), a polygraph on the right scribbles its needle across the
// paper along the floor and goes wild on the lie, and a magnifier circles a fingerprint.
(function () {
  const TAU = Math.PI * 2;
  const STEP = 2.4, ROUND = STEP * 3;
  const LIARS = [2, 0, 1, 1, 2, 0];
  const mod = (a, n) => ((a % n) + n) % n;
  const easeOut = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
  // Which suspect is lit at time tt, who the liar is that round, and how far through the step.
  function phase(tt) {
    const round = Math.floor(tt / ROUND), k = Math.floor(mod(tt, ROUND) / STEP);
    return { k, lie: k === LIARS[mod(round, LIARS.length)], s: mod(tt, STEP) / STEP };
  }
  // The polygraph trace at time tt (-1..1): calm for truths, jagged for the lie.
  function trace(tt) {
    const p = phase(tt), wild = p.lie ? Math.sin(Math.PI * p.s) : 0;
    const w = Math.sin(tt * 6.1) * 0.55 + Math.sin(tt * 11.7 + 1) * 0.3 + Math.sin(tt * 23.3) * (0.15 + wild * 0.5);
    return Math.max(-1, Math.min(1, w * (0.28 + wild * 0.72)));
  }
  const SUSPECTS = [
    { h: 1.0, c: '#121a2e', hair: 0 }, { h: 0.9, c: '#141d33', hair: 1 }, { h: 1.07, c: '#10182a', hair: 2 },
  ];

  BOX.titles.truths = {
    logo: '<span class="a">Two Truths</span><span class="amp">&amp;</span><span class="lie">a Lie</span>',
    tagline: 'Type two truths and one lie about yourself. The room plays detective and votes on which one is the lie.',
    start: '🔎 Open the case',
    meta: '3–100 players · 10–25 min',
    font: "'Black Ops One', 'Bungee', sans-serif",
    theme: { card: 'rgba(16, 22, 38, 0.9)', ink: '#f3ead2', muted: '#cfc5aa', accent: '#ff4b3e', button: '#f2c94c', buttonInk: '#1a1408', border: '#c9a24a' },
    css: `.bt-truths .bt-logo { font-size: clamp(48px, 6.2vw, 90px); line-height: 1.02; }
      .bt-truths .bt-logo .a { display: block; color: #f3ead2; text-shadow: 0 5px 0 #000, 0 0 28px rgba(255, 220, 150, 0.25); }
      .bt-truths .bt-logo .amp { display: inline-block; color: #c9a24a; font-size: 0.72em; margin-right: 0.25em; vertical-align: 0.12em; }
      .bt-truths .bt-logo .lie { display: inline-block; margin-top: 0.12em; padding: 0.04em 0.24em 0.02em; color: #ff4b3e; border: 0.075em solid currentColor; border-radius: 0.14em; transform: rotate(-7deg); text-shadow: none; box-shadow: inset 0 0 0 0.03em rgba(255, 75, 62, 0.3); animation: btStamp 0.55s 0.5s cubic-bezier(.2, 1.5, .4, 1) both; }
      @keyframes btStamp { from { transform: rotate(-16deg) scale(2.4); opacity: 0; } }
      .bt-truths .bt-tag { margin-top: 22px; }
      .bt-truths .bt-tag, .bt-truths .bt-fine, .bt-truths .bt-how { font-family: 'Special Elite', monospace; }
      .bt-truths .bt-card { border-radius: 14px; border-width: 3px; box-shadow: 0 0 0 8px rgba(201, 162, 74, 0.18), 0 30px 70px rgba(0, 0, 0, 0.6); }`,
    init(W, H) {
      const rnd = (a, b) => a + Math.random() * (b - a);
      const cardW = Math.min(640, W * 0.92), side = Math.max(150, (W - cardW) / 2 - 20);
      const sc = Math.max(0.45, Math.min(3, H / 900, side / 420));
      // Brick wall, drawn once.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const wall = document.createElement('canvas'); wall.width = Math.max(1, Math.round(W * dpr)); wall.height = Math.max(1, Math.round(H * dpr));
      const wg = wall.getContext('2d'); wg.scale(dpr, dpr);
      wg.fillStyle = '#080c16'; wg.fillRect(0, 0, W, H);
      const bw = 72 * sc, bh = 30 * sc;
      for (let r = 0, y = 0; y < H; r++, y += bh) for (let x = (r % 2) * -bw / 2; x < W; x += bw) {
        const l = 10 + Math.random() * 5; wg.fillStyle = `hsl(222 28% ${l}%)`; wg.fillRect(x + 2 * sc, y + 2 * sc, bw - 4 * sc, bh - 4 * sc);
      }
      const vg = wg.createRadialGradient(W / 2, H * 0.4, Math.min(W, H) * 0.2, W / 2, H * 0.4, Math.hypot(W, H) * 0.6);
      vg.addColorStop(0, 'rgba(4,6,12,0.1)'); vg.addColorStop(1, 'rgba(4,6,12,0.85)'); wg.fillStyle = vg; wg.fillRect(0, 0, W, H);
      // Fingerprint ridges (fixed gaps so it reads as a print).
      const ridges = Array.from({ length: 13 }, (_, i) => ({ rx: (7 + i * 5.2) * sc, ry: (9 + i * 6.6) * sc, a0: rnd(-0.6, 0.4), a1: TAU - rnd(0.3, 1.1) }));
      const floor = H * 0.8, panelR = Math.min(side + 10 * sc, W * 0.32);
      return {
        sc, side, wall, ridges, floor, panelR,
        sx: [0.2, 0.5, 0.8].map((f) => panelR * f), mx: W - side / 2,
        f: {
          num: `${Math.round(20 * sc)}px 'Black Ops One', sans-serif`, stamp: `${Math.round(34 * sc)}px 'Black Ops One', sans-serif`,
          ft: `${Math.round(14 * sc)}px 'Special Elite', monospace`, label: `${Math.round(17 * sc)}px 'Special Elite', monospace`,
          bulb: `${Math.round(15 * sc)}px 'Black Ops One', sans-serif`,
        },
        dust: Array.from({ length: 26 }, () => ({ x: rnd(-1, 1), y: rnd(0, 1), v: rnd(0.01, 0.04), ph: rnd(0, TAU) })),
      };
    },
    draw(g, W, H, t, S) {
      const sc = S.sc, P = phase(t);
      g.drawImage(S.wall, 0, 0, W, H);

      // The swinging lamp over the table, its light pooling behind the card.
      const sw = Math.sin(t * 0.8) * 0.05, lampY = 70 * sc;
      g.save(); g.translate(W / 2, 0); g.rotate(sw);
      if (!S.cone) { S.cone = g.createLinearGradient(0, lampY, 0, H * 0.95); S.cone.addColorStop(0, 'rgba(255,226,150,0.28)'); S.cone.addColorStop(1, 'rgba(255,226,150,0)'); }
      g.fillStyle = S.cone; g.beginPath(); g.moveTo(-50 * sc, lampY); g.lineTo(50 * sc, lampY); g.lineTo(W * 0.42, H * 0.95); g.lineTo(-W * 0.42, H * 0.95); g.closePath(); g.fill();
      for (const d of S.dust) {
        const y = mod(d.y - t * d.v, 1), yy = lampY + y * H * 0.8, half = 50 * sc + (W * 0.42 - 50 * sc) * y * 1.1;
        g.fillStyle = 'rgba(255,236,190,' + (0.35 * Math.sin(y * Math.PI)) + ')'; g.fillRect(d.x * half * 0.9 + Math.sin(t + d.ph) * 8 * sc, yy, 3 * sc, 3 * sc);
      }
      g.strokeStyle = '#2b2b2b'; g.lineWidth = 3 * sc; g.beginPath(); g.moveTo(0, -10); g.lineTo(0, lampY - 34 * sc); g.stroke();
      g.fillStyle = '#1f4a36'; g.beginPath(); g.moveTo(-18 * sc, lampY - 36 * sc); g.lineTo(18 * sc, lampY - 36 * sc); g.lineTo(56 * sc, lampY); g.lineTo(-56 * sc, lampY); g.closePath(); g.fill();
      g.fillStyle = '#c9a24a'; g.fillRect(-58 * sc, lampY - 3 * sc, 116 * sc, 6 * sc);
      g.fillStyle = '#fff3c4'; g.beginPath(); g.ellipse(0, lampY + 4 * sc, 22 * sc, 9 * sc, 0, 0, Math.PI); g.fill();
      g.restore();

      // The lineup wall with height lines.
      const fl = S.floor, top = H * 0.16, pr = S.panelR;
      g.fillStyle = '#2a3550'; g.fillRect(0, top, pr, fl - top);
      g.strokeStyle = 'rgba(200,214,240,0.45)'; g.lineWidth = 2 * sc; g.fillStyle = 'rgba(200,214,240,0.7)'; g.font = S.f.ft; g.textAlign = 'right'; g.textBaseline = 'middle';
      for (let k = 1; k * 48 * sc < fl - top - 20 * sc; k++) {
        const y = fl - k * 48 * sc; g.beginPath(); g.moveTo(0, y); g.lineTo(pr - 34 * sc, y); g.stroke(); g.fillText((3 + k * 0.5).toFixed(1) + "'", pr - 4 * sc, y);
      }
      g.fillStyle = '#c9a24a'; g.fillRect(0, fl, pr, 6 * sc); g.fillStyle = '#0c1220'; g.fillRect(0, fl + 6 * sc, pr, H - fl);
      // Spotlight glides between suspects.
      const k = P.k, prevK = (k + 2) % 3, move = easeOut(Math.min(1, P.s / 0.14));
      const lx = S.sx[prevK] + (S.sx[k] - S.sx[prevK]) * move;
      g.fillStyle = 'rgba(255,240,200,0.13)'; g.beginPath(); g.moveTo(lx - 14 * sc, top); g.lineTo(lx + 14 * sc, top); g.lineTo(lx + 74 * sc, fl); g.lineTo(lx - 74 * sc, fl); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,240,200,0.25)'; g.beginPath(); g.ellipse(lx, fl, 74 * sc, 14 * sc, 0, 0, TAU); g.fill();
      for (let i = 0; i < 3; i++) {
        const su = SUSPECTS[i], x = S.sx[i], lit = i === k && P.s > 0.1, h = su.h;
        const headY = fl - 205 * sc * h, hr = 30 * sc, bob = Math.sin(t * 1.6 + i * 2) * 2 * sc;
        g.fillStyle = lit ? '#3a4766' : su.c;
        g.beginPath(); g.moveTo(x - 58 * sc, fl); g.lineTo(x - 54 * sc, headY + 70 * sc); g.quadraticCurveTo(x - 50 * sc, headY + 40 * sc, x, headY + 38 * sc); g.quadraticCurveTo(x + 50 * sc, headY + 40 * sc, x + 54 * sc, headY + 70 * sc); g.lineTo(x + 58 * sc, fl); g.closePath(); g.fill();
        g.fillRect(x - 11 * sc, headY + 20 * sc, 22 * sc, 22 * sc);
        g.beginPath(); g.arc(x, headY + bob, hr, 0, TAU); g.fill();
        if (su.hair === 1) { g.beginPath(); g.arc(x, headY - hr * 0.95 + bob, hr * 0.45, 0, TAU); g.fill(); }
        if (su.hair === 2) { g.fillRect(x - hr * 1.1, headY - hr * 0.55 + bob, hr * 2.2, 6 * sc); g.fillRect(x - hr * 0.75, headY - hr * 1.25 + bob, hr * 1.5, hr * 0.75); }
        // Eyes dart about nervously under the light.
        const look = Math.sin(t * 3 + i * 1.7) > 0.3 ? 5 : Math.sin(t * 3 + i * 1.7) < -0.3 ? -5 : 0;
        g.fillStyle = lit ? '#fff' : 'rgba(255,255,255,0.18)';
        g.beginPath(); g.arc(x - 10 * sc + look * sc, headY - 3 * sc + bob, 4.5 * sc, 0, TAU); g.arc(x + 10 * sc + look * sc, headY - 3 * sc + bob, 4.5 * sc, 0, TAU); g.fill();
        // The liar's nose grows.
        if (lit && P.lie) {
          const n = (6 + 48 * easeOut(Math.min(1, (P.s - 0.1) / 0.6))) * sc;
          g.fillStyle = '#5a6a90'; g.beginPath(); g.moveTo(x + 6 * sc, headY + 2 * sc + bob); g.lineTo(x + 8 * sc + n, headY + 7 * sc + bob); g.lineTo(x + 6 * sc, headY + 12 * sc + bob); g.closePath(); g.fill();
          g.fillStyle = 'rgba(140,200,255,0.8)'; g.beginPath(); g.arc(x - hr - 4 * sc, headY - 6 * sc + bob + mod(t * 30, 30) * sc, 4 * sc, 0, TAU); g.fill();
        }
        // Placard.
        g.fillStyle = '#f3ead2'; g.fillRect(x - 26 * sc, headY + 92 * sc, 52 * sc, 34 * sc);
        g.fillStyle = '#1a1408'; g.font = S.f.num; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), x, headY + 110 * sc);
        // TRUTH / LIE stamp slams down above the lit suspect.
        if (lit && P.s > 0.42) {
          const kk = Math.min(1, (P.s - 0.42) / 0.08), s = 1 + (1 - kk) * 0.9, col = P.lie ? '#ff4b3e' : '#56d98a', txt = P.lie ? 'LIE!' : 'TRUTH';
          g.save(); g.translate(x, headY - 70 * sc); g.rotate(i % 2 ? 0.12 : -0.12); g.scale(s, s); g.globalAlpha = kk;
          g.font = S.f.stamp; const tw = g.measureText(txt).width + 22 * sc;
          g.fillStyle = 'rgba(8,12,22,0.75)'; g.fillRect(-tw / 2, -24 * sc, tw, 48 * sc);
          g.strokeStyle = col; g.lineWidth = 4 * sc; g.strokeRect(-tw / 2, -24 * sc, tw, 48 * sc);
          g.fillStyle = col; g.fillText(txt, 0, 2 * sc); g.restore();
        }
      }

      // Fingerprint evidence with a circling magnifying glass.
      const fx = S.mx, fy = H * 0.3;
      g.fillStyle = '#efe4c8'; g.save(); g.translate(fx, fy); g.rotate(0.06);
      g.fillRect(-110 * sc, -120 * sc, 220 * sc, 250 * sc);
      g.fillStyle = '#c9a24a'; g.fillRect(-14 * sc, -132 * sc, 28 * sc, 22 * sc);
      g.fillStyle = '#5a4a2a'; g.font = S.f.label; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('EXHIBIT A', 0, 104 * sc);
      g.restore();
      const ridge = (cx, cy, z, col, lw) => {
        g.strokeStyle = col; g.lineWidth = lw;
        for (const r of S.ridges) { g.beginPath(); g.ellipse(cx, cy, r.rx * z, r.ry * z, 0.15, r.a0, r.a1); g.stroke(); }
      };
      ridge(fx, fy - 10 * sc, 1, 'rgba(60,50,40,0.55)', 2.5 * sc);
      const mgx = fx + Math.cos(t * 0.6) * 46 * sc, mgy = fy - 10 * sc + Math.sin(t * 0.85) * 46 * sc, mr = 52 * sc;
      g.save(); g.beginPath(); g.arc(mgx, mgy, mr, 0, TAU); g.clip();
      g.fillStyle = '#fff6dd'; g.fillRect(mgx - mr, mgy - mr, mr * 2, mr * 2);
      g.translate(mgx, mgy); g.scale(1.8, 1.8); g.translate(-mgx, -mgy);
      ridge(fx, fy - 10 * sc, 1, 'rgba(40,30,20,0.85)', 2.5 * sc);
      g.restore();
      g.strokeStyle = '#c9a24a'; g.lineWidth = 9 * sc; g.beginPath(); g.arc(mgx, mgy, mr, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 4 * sc; g.beginPath(); g.arc(mgx, mgy, mr - 12 * sc, -2.4, -1.6); g.stroke();
      g.strokeStyle = '#3b2716'; g.lineWidth = 16 * sc; g.lineCap = 'round'; g.beginPath(); g.moveTo(mgx + mr * 0.74, mgy + mr * 0.74); g.lineTo(mgx + mr * 1.6, mgy + mr * 1.6); g.stroke();

      // Polygraph: paper runs along the floor, the needle writes the trace.
      const mw = 230 * sc, mh = 150 * sc, mx0 = Math.min(W - mw - 14 * sc, S.mx - mw / 2), my0 = H - mh - 18 * sc;
      const py = H - 78 * sc, ph = 58 * sc, penX = mx0 - 8 * sc, speed = 110 * sc;
      g.fillStyle = '#efe4c8'; g.fillRect(0, py, mx0 + 10 * sc, ph);
      g.strokeStyle = 'rgba(200,80,80,0.22)'; g.lineWidth = 1.5 * sc;
      for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, py + (ph * i) / 4); g.lineTo(penX, py + (ph * i) / 4); g.stroke(); }
      const gap = 40 * sc;
      for (let x = penX - mod(t * speed, gap); x > 0; x -= gap) { g.beginPath(); g.moveTo(x, py); g.lineTo(x, py + ph); g.stroke(); }
      g.strokeStyle = '#c4271d'; g.lineWidth = 2.5 * sc; g.lineJoin = 'round'; g.beginPath();
      const mid = py + ph / 2, amp = ph * 0.42, dx = 3;
      for (let x = penX; x >= -dx; x -= dx) { const y = mid + trace(t - (penX - x) / speed) * amp; if (x === penX) g.moveTo(x, y); else g.lineTo(x, y); }
      g.stroke();
      // Machine body, dials and the pen arm.
      g.fillStyle = '#5a3a22'; g.beginPath(); g.roundRect(mx0, my0, mw, mh, 12 * sc); g.fill();
      g.fillStyle = '#6e4a2c'; g.fillRect(mx0 + 8 * sc, my0 + 8 * sc, mw - 16 * sc, mh * 0.5);
      g.fillStyle = '#c9a24a'; g.fillRect(mx0, my0 + mh - 12 * sc, mw, 6 * sc);
      const cur = trace(t);
      for (let i = 0; i < 3; i++) {
        const dx0 = mx0 + mw * (0.22 + i * 0.28), dy0 = my0 + mh * 0.3, dr = 24 * sc;
        g.fillStyle = '#f3ead2'; g.beginPath(); g.arc(dx0, dy0, dr, 0, TAU); g.fill();
        g.strokeStyle = '#c9a24a'; g.lineWidth = 4 * sc; g.stroke();
        const a = -Math.PI / 2 + cur * (0.7 + i * 0.25) + Math.sin(t * (1 + i)) * 0.15;
        g.strokeStyle = '#1a1408'; g.lineWidth = 3 * sc; g.beginPath(); g.moveTo(dx0, dy0); g.lineTo(dx0 + Math.cos(a) * dr * 0.8, dy0 + Math.sin(a) * dr * 0.8); g.stroke();
      }
      const tipY = mid + cur * amp;
      g.strokeStyle = '#2b2b2b'; g.lineWidth = 4 * sc; g.beginPath(); g.moveTo(mx0 + 20 * sc, my0 + mh * 0.62); g.lineTo(penX, tipY); g.stroke();
      g.fillStyle = '#c4271d'; g.beginPath(); g.arc(penX, tipY, 5 * sc, 0, TAU); g.fill();
      // The LIE bulb glows softly while the liar talks.
      const glow = P.lie ? Math.sin(Math.PI * P.s) : 0, bx = mx0 + mw * 0.78, byy = my0 - 22 * sc;
      g.fillStyle = '#2b2b2b'; g.fillRect(bx - 22 * sc, byy + 6 * sc, 44 * sc, 16 * sc);
      if (glow > 0.02) { g.fillStyle = 'rgba(255,70,50,' + (0.3 * glow) + ')'; g.beginPath(); g.arc(bx, byy, 44 * sc, 0, TAU); g.fill(); }
      g.fillStyle = glow > 0.02 ? `rgb(${120 + 135 * glow}, ${40 + 40 * glow}, 40)` : '#5a1a16'; g.beginPath(); g.arc(bx, byy, 18 * sc, Math.PI, 0); g.lineTo(bx + 18 * sc, byy + 6 * sc); g.lineTo(bx - 18 * sc, byy + 6 * sc); g.fill();
      g.fillStyle = '#f3ead2'; g.font = S.f.bulb; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LIE', bx, byy + 15 * sc);
      g.fillStyle = 'rgba(243,234,210,0.8)'; g.font = S.f.ft; g.fillText('POLYGRAPH  MK-II', mx0 + mw * 0.36, my0 - 10 * sc);
    },
  };
})();
