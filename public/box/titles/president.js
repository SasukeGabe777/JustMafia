'use strict';
// President title screen: a velvet throne room. A little playing card hops up the rank
// pyramid from SCUM to PRESIDENT, sits on the throne and gets crowned; a royal hand of
// cards fans on the right, banners sway, gold glitter rises and stray cards tumble down.
(function () {
  const TAU = Math.PI * 2;
  const RANKS = ['SCUM', 'VICE SCUM', 'CITIZEN', 'VICE PRES.', 'PRESIDENT'];
  const TIER = [['#4b3a44', '#352831', '#cbb8c4'], ['#5d4060', '#422c45', '#e2cde4'], ['#6d3a86', '#4c2860', '#f1dcff'], ['#9c2f63', '#6f1f45', '#ffe0ee'], ['#e3a826', '#a8761a', '#3a1206']];
  const HAND = [['2', '♠', 0], ['2', '♥', 1], ['A', '♦', 1], ['K', '♣', 0], ['Q', '♥', 1]];
  const FALL = [['K', '♠', 0], ['7', '♦', 1], ['2', '♣', 0], ['J', '♥', 1], ['5', '♠', 0], ['A', '♥', 1], ['9', '♣', 0], ['3', '♦', 1]];
  const LOOP = 8.5;

  function layer(W, H) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr));
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, x];
  }
  function star(g, x, y, r) {
    g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r);
    g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill();
  }
  function crown(g, x, y, s) {
    // y is the bottom of the band.
    const gr = g.createLinearGradient(0, y - s * 1.2, 0, y); gr.addColorStop(0, '#fff2a8'); gr.addColorStop(0.5, '#ffc93a'); gr.addColorStop(1, '#c47f12');
    g.fillStyle = gr; g.strokeStyle = '#6b3a05'; g.lineWidth = Math.max(1.5, s * 0.07); g.lineJoin = 'round';
    g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s * 1.08, y - s * 0.95); g.lineTo(x - s * 0.5, y - s * 0.45); g.lineTo(x, y - s * 1.2);
    g.lineTo(x + s * 0.5, y - s * 0.45); g.lineTo(x + s * 1.08, y - s * 0.95); g.lineTo(x + s, y); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.roundRect(x - s * 1.04, y - s * 0.12, s * 2.08, s * 0.34, s * 0.08); g.fill(); g.stroke();
    g.fillStyle = '#fff6c8';
    for (const [bx, by] of [[-1.08, -0.95], [0, -1.2], [1.08, -0.95]]) { g.beginPath(); g.arc(x + bx * s, y + by * s, s * 0.13, 0, TAU); g.fill(); g.stroke(); }
    g.fillStyle = '#e0233f'; g.beginPath(); g.arc(x, y + s * 0.05, s * 0.11, 0, TAU); g.fill();
    g.fillStyle = '#2f6bff'; g.beginPath(); g.arc(x - s * 0.55, y + s * 0.05, s * 0.08, 0, TAU); g.arc(x + s * 0.55, y + s * 0.05, s * 0.08, 0, TAU); g.fill();
  }
  function card(g, cx, cy, w, ang, rank, suit, red) {
    const h = w * 1.4;
    g.save(); g.translate(cx, cy); g.rotate(ang);
    g.fillStyle = 'rgba(10,0,10,.35)'; g.beginPath(); g.roundRect(-w / 2 + w * 0.05, -h / 2 + w * 0.07, w, h, w * 0.1); g.fill();
    g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, w * 0.1); g.fill();
    g.strokeStyle = '#d6b56a'; g.lineWidth = Math.max(1, w * 0.025); g.stroke();
    const ink = red ? '#c8102e' : '#1d1230'; g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < 2; k++) {
      g.font = `bold ${w * 0.25}px Georgia, serif`; g.fillText(rank, -w * 0.33, -h * 0.37);
      g.font = `${w * 0.19}px Georgia, serif`; g.fillText(suit, -w * 0.33, -h * 0.22);
      g.rotate(Math.PI);
    }
    if ('JQK'.includes(rank)) {
      g.strokeStyle = ink; g.lineWidth = Math.max(1, w * 0.02); g.strokeRect(-w * 0.24, -h * 0.3, w * 0.48, h * 0.6);
      crown(g, 0, -h * 0.1, w * 0.13);
      g.fillStyle = ink; g.font = `${w * 0.36}px 'Abril Fatface', Georgia, serif`; g.fillText(rank, 0, h * 0.12);
    } else {
      g.font = `${w * (rank === 'A' ? 0.62 : 0.5)}px Georgia, serif`; g.fillText(suit, 0, h * 0.03);
    }
    g.restore();
  }

  BOX.titles.president = {
    logo: '<span class="r">♠ ♥ the royal card game ♣ ♦</span><span class="a">President</span>',
    tagline: 'Climb from Scum to President. Beat the cards on the table and empty your hand first.',
    start: '👑 Open the court',
    meta: '3–100 players · 15–30 min',
    font: "'Abril Fatface', Georgia, serif",
    theme: { card: 'rgba(42, 6, 34, 0.86)', ink: '#fff4dc', muted: '#f3d29e', accent: '#ffd34d', button: '#ffc83a', buttonInk: '#3a0a1e', border: '#d9a32b' },
    css: `.bt-president .bt-logo .r { display: block; font-family: 'Fredoka', sans-serif; font-weight: 600; font-size: 0.2em; letter-spacing: 0.32em; text-transform: uppercase; color: #f3d29e; margin-bottom: 0.25em; text-shadow: none; }
      .bt-president .bt-logo .a { display: inline-block; background: linear-gradient(180deg, #fff6c4 0%, #ffd34d 45%, #d18a12 75%, #ffe58a 100%); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: none; filter: drop-shadow(0 5px 0 #5a0d2a) drop-shadow(0 0 22px rgba(255, 200, 60, 0.45)); padding: 0 0.06em; }
      .bt-president .bt-card { border-width: 5px; box-shadow: 0 0 0 3px #5a0d2a, 0 0 0 7px rgba(217, 163, 43, 0.55), 0 18px 0 rgba(0,0,0,.3), 0 30px 70px rgba(0,0,0,.55); }
      .bt-president .bt-go { font-family: 'Fredoka', sans-serif; font-weight: 700; }`,
    init(W, H) {
      const sideW = Math.max(150, (W - Math.min(640, W * 0.92)) / 2), k = Math.min(H / 900, sideW / 480);
      const cw = Math.max(34, W * 0.055), vh = 46 * k + H * 0.012, yF = H * 0.86;
      const [bg, b] = layer(W, H);
      // Velvet wall with a faint gold damask.
      const rg = b.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, Math.max(W, H) * 0.75);
      rg.addColorStop(0, '#521463'); rg.addColorStop(0.5, '#2a0838'); rg.addColorStop(1, '#100316'); b.fillStyle = rg; b.fillRect(0, 0, W, H);
      b.fillStyle = 'rgba(255, 210, 90, 0.07)';
      const sx = 74 * k + 20, sy = 84 * k + 20;
      for (let y = vh, r = 0; y < yF; y += sy, r++) for (let x = (r % 2) * sx / 2; x < W + sx; x += sx) {
        const d = 11 * k + 3; b.beginPath(); b.moveTo(x, y - d); b.lineTo(x + d * 0.6, y); b.lineTo(x, y + d); b.lineTo(x - d * 0.6, y); b.closePath(); b.fill();
        b.beginPath(); b.arc(x, y - d * 1.45, d * 0.25, 0, TAU); b.fill();
      }
      // Pillars of light behind each side.
      for (const px of [sideW * 0.55, W - sideW * 0.55]) {
        const lg = b.createLinearGradient(px - sideW * 0.4, 0, px + sideW * 0.4, 0); lg.addColorStop(0, 'rgba(255,200,90,0)'); lg.addColorStop(0.5, 'rgba(255,200,90,0.07)'); lg.addColorStop(1, 'rgba(255,200,90,0)');
        b.fillStyle = lg; b.fillRect(px - sideW * 0.4, 0, sideW * 0.8, yF);
      }
      // Marble floor and the red carpet up the middle.
      const fg = b.createLinearGradient(0, yF, 0, H); fg.addColorStop(0, '#3a1028'); fg.addColorStop(1, '#14040d'); b.fillStyle = fg; b.fillRect(0, yF, W, H - yF);
      b.strokeStyle = 'rgba(255, 210, 120, 0.12)'; b.lineWidth = 1;
      for (let i = -14; i <= 14; i++) { b.beginPath(); b.moveTo(W / 2 + i * W * 0.035, yF); b.lineTo(W / 2 + i * W * 0.09, H); b.stroke(); }
      for (let i = 1; i < 4; i++) { const y = yF + (H - yF) * (i * i) / 16; b.beginPath(); b.moveTo(0, y); b.lineTo(W, y); b.stroke(); }
      b.fillStyle = '#a3132f'; b.beginPath(); b.moveTo(W / 2 - W * 0.11, yF); b.lineTo(W / 2 + W * 0.11, yF); b.lineTo(W / 2 + W * 0.2, H); b.lineTo(W / 2 - W * 0.2, H); b.closePath(); b.fill();
      b.strokeStyle = '#e8b43a'; b.lineWidth = 3 * k + 1; b.beginPath(); b.moveTo(W / 2 - W * 0.1, yF); b.lineTo(W / 2 - W * 0.18, H); b.moveTo(W / 2 + W * 0.1, yF); b.lineTo(W / 2 + W * 0.18, H); b.stroke();
      b.fillStyle = 'rgba(0,0,0,0.3)'; b.fillRect(0, yF, W, 5 * k + 2);
      // Curtains at both edges, tied back.
      for (const side of [0, 1]) {
        b.save(); if (side) { b.translate(W, 0); b.scale(-1, 1); }
        const cg = b.createLinearGradient(0, 0, cw * 1.25, 0);
        for (let i = 0; i <= 6; i++) cg.addColorStop(i / 6, i % 2 ? '#c11a3a' : '#5c0619');
        b.fillStyle = cg; b.beginPath(); b.moveTo(0, 0); b.lineTo(cw * 1.25, 0);
        b.bezierCurveTo(cw * 1.1, H * 0.3, cw * 0.55, H * 0.5, cw * 0.62, H * 0.6);
        b.bezierCurveTo(cw * 0.7, H * 0.72, cw * 1.25, H * 0.9, cw * 1.35, H); b.lineTo(0, H); b.closePath(); b.fill();
        b.fillStyle = '#e8b43a'; b.beginPath(); b.ellipse(cw * 0.32, H * 0.6, cw * 0.42, 7 * k + 3, -0.1, 0, TAU); b.fill();
        b.fillStyle = '#ffd86a'; b.beginPath(); b.arc(cw * 0.7, H * 0.6 + 6 * k, 6 * k + 3, 0, TAU); b.fill();
        b.restore();
      }
      // Valance with scallops and gold fringe across the top.
      const sc = 92 * k + 30;
      b.fillStyle = '#8c0f29'; b.fillRect(0, 0, W, vh * 0.55);
      for (let x = 0; x < W + sc; x += sc) { b.beginPath(); b.moveTo(x, vh * 0.5); b.quadraticCurveTo(x + sc / 2, vh * 1.5, x + sc, vh * 0.5); b.closePath(); b.fill(); }
      b.strokeStyle = '#e8b43a'; b.lineWidth = 3 * k + 1.5;
      b.beginPath(); for (let x = 0; x < W + sc; x += sc) { b.moveTo(x, vh * 0.5); b.quadraticCurveTo(x + sc / 2, vh * 1.5, x + sc, vh * 0.5); } b.stroke();
      b.fillStyle = '#ffcf4a'; for (let x = 0; x < W + sc; x += sc) b.fillRect(x - 2, vh * 0.42, 4, vh * 0.35 + 8 * k);
      b.fillStyle = '#5c0619'; b.fillRect(0, vh * 0.12, W, 3 * k + 1);
      // Rank pyramid geometry (left side).
      const x0 = cw * 0.95, w0 = Math.max(80, sideW * 0.93 - x0), th = Math.min(54 * k + 4, H * 0.075);
      const tiers = RANKS.map((name, i) => ({ name, w: w0 * (1 - i * 0.15), y: yF - (i + 1) * th }));
      const spots = tiers.slice(0, 4).map((tr, i) => ({ x: x0 + (tr.w + tiers[i + 1].w) / 2, y: tr.y }));
      const top = tiers[4];
      spots.push({ x: x0 + top.w * 0.5, y: top.y - (92 * k + 18) * 0.36, throne: true });
      const rnd = (a, b2) => a + Math.random() * (b2 - a);
      const sideX = () => (Math.random() < 0.5 ? rnd(cw, sideW * 1.02) : W - rnd(cw, sideW * 1.02));
      return {
        bg, sideW, k, cw, vh, yF, x0, th, tiers, spots,
        glit: Array.from({ length: 38 }, () => ({ x: sideX(), y: rnd(0, H), v: rnd(10, 26) * k + 4, r: rnd(2.5, 6.5) * k + 1, ph: rnd(0, TAU), sw: rnd(0.4, 1.2) })),
        fall: FALL.map((c, i) => ({ c, x: i % 2 ? rnd(cw + 20, sideW * 0.95) : W - rnd(cw + 20, sideW * 0.95), y: rnd(0, H + 200), v: rnd(22, 40) * k + 6, vr: rnd(-0.6, 0.6), ph: rnd(0, TAU) })),
        burst: Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * TAU, d: rnd(0.7, 1.2) })),
      };
    },
    draw(g, W, H, t, S) {
      const { k, sideW, x0, th, tiers, spots, vh, yF } = S;
      g.drawImage(S.bg, 0, 0, W, H);
      // Slow sunburst behind the crown above the card.
      const cx = W / 2, cy = vh + 70 * k + 14;
      g.save(); g.translate(cx, cy); g.rotate(t * 0.08); g.fillStyle = 'rgba(255, 214, 90, 0.07)';
      const R = 360 * k + 80;
      for (let i = 0; i < 14; i++) { g.rotate(TAU / 14); g.beginPath(); g.moveTo(0, 0); g.lineTo(R, -R * 0.11); g.lineTo(R, R * 0.11); g.closePath(); g.fill(); }
      g.restore();
      crown(g, cx, cy + Math.sin(t * 1.4) * 3 * k, 38 * k + 8);
      // Tumbling cards in the distance.
      g.globalAlpha = 0.45;
      for (const f of S.fall) {
        const y = ((f.y + t * f.v) % (H + 220)) - 110;
        card(g, f.x + Math.sin(t * 0.7 + f.ph) * 26 * k, y, 40 * k + 10, Math.sin(t * 0.5 + f.ph) * 1.2 + t * f.vr, f.c[0], f.c[1], f.c[2]);
      }
      g.globalAlpha = 1;
      // Hanging banners, swaying.
      for (const [bx, suit, col] of [[sideW * 0.6, '♠', '#3b1a6e'], [W - sideW * 0.5, '♥', '#7a0f2e']]) {
        const len = H * 0.3, bw = 70 * k + 14, sway = Math.sin(t * 0.9 + bx) * 0.03;
        g.save(); g.translate(bx, vh * 0.3); g.rotate(sway);
        g.fillStyle = '#e8b43a'; g.fillRect(-bw * 0.62, -3, bw * 1.24, 6 * k + 3);
        g.fillStyle = col; g.beginPath(); g.moveTo(-bw / 2, 0); g.lineTo(bw / 2, 0); g.lineTo(bw / 2, len); g.lineTo(0, len - bw * 0.45); g.lineTo(-bw / 2, len); g.closePath(); g.fill();
        g.strokeStyle = '#e8b43a'; g.lineWidth = 3 * k + 1; g.stroke();
        crown(g, 0, len * 0.32, bw * 0.24);
        g.fillStyle = suit === '♥' ? '#ff5a74' : '#f3e6ff'; g.font = `${bw * 0.55}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(suit, 0, len * 0.55);
        g.restore();
      }
      // Rank pyramid, with the throne on top.
      const tt = t % LOOP;
      let on = 0; for (let i = 1; i < spots.length; i++) if (tt >= 0.7 + i * 1.0) on = i;
      for (let i = 0; i < tiers.length; i++) {
        const tr = tiers[i], c = TIER[i];
        g.fillStyle = c[0]; g.fillRect(x0, tr.y, tr.w, th);
        g.fillStyle = c[1]; g.fillRect(x0, tr.y + th * 0.82, tr.w, th * 0.18);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x0, tr.y, tr.w, 3 * k + 1);
        const lit = on === i || (i === 4 && on === 4);
        g.font = `${Math.min(th * 0.42, (tr.w * 0.9) / (tr.name.length * 0.62))}px 'Abril Fatface', Georgia, serif`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = lit ? (i === 4 ? '#3a1206' : '#ffe48a') : c[2]; g.globalAlpha = lit ? 1 : 0.75;
        g.fillText(tr.name, x0 + tr.w / 2, tr.y + th * 0.43); g.globalAlpha = 1;
      }
      const top = tiers[4], tx = x0 + top.w * 0.5, ty = top.y, thW = 30 * k + 6, thH = 92 * k + 18;
      g.fillStyle = '#e8b43a'; g.strokeStyle = '#8a5a0c'; g.lineWidth = 2 * k + 1;
      g.beginPath(); g.moveTo(tx - thW, ty); g.lineTo(tx - thW, ty - thH * 0.75); g.quadraticCurveTo(tx - thW, ty - thH, tx, ty - thH * 1.08); g.quadraticCurveTo(tx + thW, ty - thH, tx + thW, ty - thH * 0.75); g.lineTo(tx + thW, ty); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#b5163a'; g.beginPath(); g.roundRect(tx - thW * 0.68, ty - thH * 0.82, thW * 1.36, thH * 0.55, 8 * k + 2); g.fill();
      g.fillStyle = '#e8b43a'; g.fillRect(tx - thW * 1.15, ty - thH * 0.36, thW * 2.3, 7 * k + 3);
      g.fillStyle = '#ffd86a'; g.beginPath(); g.arc(tx, ty - thH * 0.98, 5 * k + 2, 0, TAU); g.fill();
      // The climbing card: hops one rank per second, then sits on the throne and is crowned.
      const hop = 0.55;
      let px = spots[0].x, py = spots[0].y, air = 0;
      for (let i = 1; i < spots.length; i++) {
        const s0 = 0.7 + i * 1.0 - hop;
        if (tt >= s0 + hop) { px = spots[i].x; py = spots[i].y; }
        else if (tt >= s0) { const u = (tt - s0) / hop, e = u * u * (3 - 2 * u); px = spots[i - 1].x + (spots[i].x - spots[i - 1].x) * e; py = spots[i - 1].y + (spots[i].y - spots[i - 1].y) * e - Math.sin(u * Math.PI) * (th * 0.9 + 14 * k); air = Math.sin(u * Math.PI); break; }
      }
      const crownedAt = 0.7 + 4 * 1.0 + 0.35;
      const fade = tt < 0.3 ? tt / 0.3 : tt > LOOP - 0.5 ? (LOOP - tt) / 0.5 : 1;
      const bob = air ? 0 : Math.abs(Math.sin(t * 3.2)) * 2.5 * k;
      const cwid = 26 * k + 6, chei = cwid * 1.38, squash = air ? 1 : 1 - Math.max(0, Math.sin(t * 6.4)) * 0.04;
      g.globalAlpha = fade;
      g.save(); g.translate(px, py - bob); g.scale(1 / squash, squash);
      g.strokeStyle = '#2a0b20'; g.lineWidth = 2.5 * k + 1; g.lineCap = 'round';
      const leg = air ? 0.3 : 0;
      g.beginPath(); g.moveTo(-cwid * 0.2, -chei * 0.3); g.lineTo(-cwid * (0.24 + leg), 0); g.moveTo(cwid * 0.2, -chei * 0.3); g.lineTo(cwid * (0.24 + leg), 0); g.stroke();
      g.fillStyle = '#fffaf0'; g.beginPath(); g.roundRect(-cwid / 2, -chei - chei * 0.18, cwid, chei, cwid * 0.15); g.fill(); g.stroke();
      g.fillStyle = '#d0142f'; g.font = `${cwid * 0.5}px Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♥', 0, -chei * 0.45);
      g.fillStyle = '#2a0b20'; g.beginPath(); g.arc(-cwid * 0.17, -chei * 0.88, cwid * 0.07, 0, TAU); g.arc(cwid * 0.17, -chei * 0.88, cwid * 0.07, 0, TAU); g.fill();
      g.beginPath(); g.arc(0, -chei * 0.78, cwid * 0.12, 0.2, Math.PI - 0.2); g.stroke();
      if (tt > crownedAt - 0.4) {
        const u = Math.min(1, (tt - crownedAt + 0.4) / 0.4), drop = (1 - u * u) * 60 * k;
        crown(g, 0, -chei * 1.18 - drop, cwid * 0.42);
      }
      g.restore();
      // Coronation burst of sparkles.
      const bt = tt - crownedAt;
      if (bt > 0 && bt < 1.4) {
        const u = bt / 1.4; g.fillStyle = '#ffe27a'; g.globalAlpha = fade * (1 - u);
        for (const p of S.burst) star(g, px + Math.cos(p.a) * p.d * u * 90 * k, py - chei + Math.sin(p.a) * p.d * u * 90 * k, (7 * k + 2) * (1 - u * 0.5));
      }
      g.globalAlpha = 1;
      // A royal hand of cards on the right, fanning and rippling.
      const hx = W - sideW * 0.5, hy = yF + 10 * k, cwd = Math.min(112 * k + 6, sideW * 0.27), fan = 0.95 + Math.sin(t * 0.8) * 0.12;
      for (let i = 0; i < HAND.length; i++) {
        const a = (i - (HAND.length - 1) / 2) * 0.24 * fan, lift = Math.max(0, Math.sin(t * 1.5 - i * 0.8)) * 16 * k, rr = cwd * 1.45 + lift;
        card(g, hx + Math.sin(a) * rr, hy - Math.cos(a) * rr, cwd, a, HAND[i][0], HAND[i][1], HAND[i][2]);
      }
      // Rising gold glitter.
      g.fillStyle = '#ffd96a';
      for (const p of S.glit) {
        const y = ((p.y - t * p.v) % H + H) % H;
        g.globalAlpha = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2 * p.sw + p.ph));
        star(g, p.x + Math.sin(t * p.sw + p.ph) * 12 * k, y, p.r);
      }
      g.globalAlpha = 1;
    },
  };
})();
