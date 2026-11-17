'use strict';
// Bomb Squad title screen: a blueprint-blue disposal bay. A big cartoon bomb sits under a work
// lamp, its fuse fizzing and its red LED racing down. At the last second a pair of snips cuts a
// wire, the LED flips to a green SAFE and the room exhales... then the next bomb rolls in.
// Hazard tape runs along the floor; schematic lines drift across the walls.
(function () {
  const TAU = Math.PI * 2;
  const WIRES = ['#ff4a3d', '#3a8bff', '#ffd23f', '#3ccf6e'];
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function segText(g, txt, x, y, px, col) {
    g.save(); g.font = `${px}px "Press Start 2P", monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = col; g.shadowBlur = px * 0.6; g.fillStyle = col; g.fillText(txt, x, y); g.restore();
  }
  BOX.titles.bomb = {
    logo: '<span class="a">BOMB</span> <span class="b">SQUAD</span>',
    tagline: 'One of you sees the bomb. Everyone else has the manual. Talk fast.',
    start: '💣 Open the bomb bay', meta: '2–20 players · best 3–8 · 10–15 min · co-op',
    font: "'Black Ops One', 'Bungee', sans-serif",
    theme: { card: 'rgba(12, 18, 32, 0.88)', ink: '#f2f4f8', muted: '#a9b4c8', accent: '#ffcc1a', button: '#ff3b30', buttonInk: '#fff', border: '#ffcc1a' },
    css: `.bt-bomb .bt-logo { font-size: clamp(54px, 9vw, 112px); line-height: 0.95; letter-spacing: 0.02em; }
      .bt-bomb .bt-logo .a { color: #f2f4f8; text-shadow: 0 6px 0 #000; }
      .bt-bomb .bt-logo .b { color: #ffcc1a; text-shadow: 0 6px 0 #6b4f00, 0 0 30px rgba(255, 204, 26, 0.5); display: inline-block; animation: btbShake 3.2s ease-in-out infinite; }
      @keyframes btbShake { 0%, 84%, 100% { transform: none; } 86% { transform: translate(-4px, 2px) rotate(-2deg); } 88% { transform: translate(4px, -2px) rotate(2deg); } 90% { transform: translate(-3px, 1px); } 92% { transform: none; } }
      .bt-bomb .bt-card { box-shadow: 0 0 0 4px #15151a, 0 0 0 10px #ffcc1a, 0 0 60px rgba(255, 59, 48, 0.35); }
      .bt-bomb .bt-tag { font-family: 'Special Elite', monospace; }`,
    init(W, H) {
      const lines = Array.from({ length: 14 }, () => ({ x: Math.random() * W, y: Math.random() * H, w: 80 + Math.random() * 260, v: 6 + Math.random() * 14, d: Math.random() < 0.5 }));
      return { lines, sparks: [], last: 0 };
    },
    draw(g, W, H, t, S) {
      const dt = Math.min(0.05, t - (S.last || t)); S.last = t;
      // blueprint wall
      let gr = g.createRadialGradient(W * 0.5, H * 0.35, 10, W * 0.5, H * 0.5, Math.max(W, H) * 0.8);
      gr.addColorStop(0, '#22345a'); gr.addColorStop(0.6, '#121c33'); gr.addColorStop(1, '#070b15'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(140,180,255,0.08)'; g.lineWidth = 1;
      for (let x = (t * 6) % 40; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.strokeStyle = 'rgba(160,200,255,0.18)'; g.lineWidth = 2;
      for (const l of S.lines) {
        l.x += l.v * dt; if (l.x > W + 300) l.x = -300;
        g.beginPath(); g.moveTo(l.x, l.y); g.lineTo(l.x + l.w, l.y); if (l.d) { g.lineTo(l.x + l.w, l.y + 40); g.arc(l.x + l.w, l.y + 52, 12, -Math.PI / 2, TAU - Math.PI / 2); } g.stroke();
      }
      // the cycle: 7 s of countdown, a snip, 2.4 s of SAFE
      const CY = 9.4, c = t % CY, cut = c > 7, k = Math.min(1, c / 7);
      const side = W > H * 1.2, s = side ? Math.min(W * 0.33, H * 0.85) / 520 : Math.min(W, H * 1.25) / 900, bx = side ? W * 0.8 : W * 0.5, by = side ? H * 0.58 : H * 0.6, R = 210 * s;
      // floor + hazard tape
      g.fillStyle = '#0a0d14'; g.fillRect(0, by + R * 0.95, W, H);
      const ty = by + R * 0.95; g.save(); g.beginPath(); g.rect(0, ty, W, 26 * s + 6); g.clip();
      for (let x = -60 + ((t * 40) % 60); x < W + 60; x += 60) { g.fillStyle = '#ffcc1a'; g.beginPath(); g.moveTo(x, ty); g.lineTo(x + 30, ty); g.lineTo(x + 30 - 26 * s, ty + 26 * s + 6); g.lineTo(x - 26 * s, ty + 26 * s + 6); g.closePath(); g.fill(); }
      g.restore();
      // the work lamp's cone
      gr = g.createRadialGradient(bx, by - R * 1.6, 10, bx, by, R * 2.2); gr.addColorStop(0, 'rgba(255,240,200,0.28)'); gr.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(bx - 30 * s, 0); g.lineTo(bx + 30 * s, 0); g.lineTo(bx + R * 1.8, by + R); g.lineTo(bx - R * 1.8, by + R); g.closePath(); g.fill();
      // shadow
      g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.ellipse(bx, by + R * 0.95, R * 0.95, R * 0.14, 0, 0, TAU); g.fill();
      // the bomb (shakes harder near zero)
      const shake = !cut && k > 0.75 ? (k - 0.75) * 24 * s : 0;
      g.save(); g.translate(bx + (Math.random() - 0.5) * shake, by + (Math.random() - 0.5) * shake);
      // fuse
      const fuse = [[0, -R * 0.98], [-R * 0.05, -R * 1.25], [R * 0.25, -R * 1.42], [R * 0.45, -R * 1.3], [R * 0.6, -R * 1.5]];
      const burn = cut ? 0.55 : 1 - k * 0.45;
      g.lineCap = 'round'; g.strokeStyle = '#1a120a'; g.lineWidth = 16 * s; g.beginPath(); g.moveTo(fuse[0][0], fuse[0][1]); g.bezierCurveTo(fuse[1][0], fuse[1][1], fuse[2][0], fuse[2][1], fuse[3][0], fuse[3][1]); g.stroke();
      g.strokeStyle = '#d9b27a'; g.lineWidth = 9 * s; g.setLineDash([1000 * burn * s, 4000]); g.beginPath(); g.moveTo(fuse[0][0], fuse[0][1]); g.bezierCurveTo(fuse[1][0], fuse[1][1], fuse[2][0], fuse[2][1], fuse[3][0], fuse[3][1]); g.stroke(); g.setLineDash([]);
      // spark at the fuse tip (approximate the bezier at u)
      const u = Math.min(1, burn * 1.15), bez = (a, b2, c2, d, q) => (1 - q) ** 3 * a + 3 * (1 - q) ** 2 * q * b2 + 3 * (1 - q) * q * q * c2 + q ** 3 * d;
      const sx = bez(fuse[0][0], fuse[1][0], fuse[2][0], fuse[3][0], u), sy = bez(fuse[0][1], fuse[1][1], fuse[2][1], fuse[3][1], u);
      if (!cut) {
        if (Math.random() < 0.9) S.sparks.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * 240 * s, vy: (-Math.random() * 200 - 40) * s, t });
        g.fillStyle = 'rgba(255,200,80,0.35)'; g.beginPath(); g.arc(sx, sy, 26 * s, 0, TAU); g.fill();
        g.fillStyle = '#fff3a0'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t * 20, r = i % 2 ? 7 * s : 22 * s; g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } g.closePath(); g.fill();
      }
      // cap
      g.fillStyle = '#3b3e4a'; g.strokeStyle = '#07070a'; g.lineWidth = 8 * s; rr(g, -48 * s, -R * 1.08, 96 * s, 46 * s, 10 * s); g.fill(); g.stroke();
      // body
      gr = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.1); gr.addColorStop(0, '#727689'); gr.addColorStop(0.35, '#2c2e38'); gr.addColorStop(1, '#09090d');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.lineWidth = 10 * s; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.ellipse(-R * 0.42, -R * 0.45, R * 0.25, R * 0.14, -0.7, 0, TAU); g.fill();
      // wires across the front, one snipped when cut
      WIRES.forEach((col, i) => {
        const y = R * 0.42 + i * 16 * s, x0 = -R * 0.72, x1 = R * 0.72;
        g.strokeStyle = '#07070a'; g.lineWidth = 12 * s; g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo(0, y + 28 * s, x1, y); g.stroke();
        g.strokeStyle = col; g.lineWidth = 7 * s;
        if (cut && i === 2) {
          g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo(-R * 0.4, y + 18 * s, -R * 0.12, y + 30 * s); g.stroke();
          g.beginPath(); g.moveTo(R * 0.12, y + 34 * s); g.quadraticCurveTo(R * 0.4, y + 18 * s, x1, y); g.stroke();
        } else { g.beginPath(); g.moveTo(x0, y); g.quadraticCurveTo(0, y + 28 * s, x1, y); g.stroke(); }
      });
      // LED panel
      g.fillStyle = '#0b0b0f'; g.strokeStyle = '#3d4150'; g.lineWidth = 9 * s; rr(g, -R * 0.62, -R * 0.3, R * 1.24, R * 0.56, 14 * s); g.fill(); g.stroke();
      if (cut) segText(g, 'SAFE', 0, -R * 0.02, 54 * s, '#39e07a');
      else { const left = 30 * (1 - k), txt = left < 10 ? left.toFixed(1) : '0:' + String(Math.ceil(left)).padStart(2, '0'); segText(g, txt, 0, -R * 0.02, 52 * s, Math.floor(t * 4) % 2 && left < 6 ? '#7a1712' : '#ff3b30'); }
      g.restore();
      // the snips swoop in for the cut
      const sn = c > 6.4 ? Math.min(1, (c - 6.4) / 0.6) : 0;
      if (sn > 0 && c < 8.6) {
        const tx = bx, tyy = by + R * 0.42 + 2 * 16 * s + 14 * s, ox = bx + R * 2.2, oy = by + R * 1.4;
        const px = ox + (tx - ox) * sn, py = oy + (tyy - oy) * sn, open = cut ? 0.05 : 0.35 + 0.1 * Math.sin(t * 30);
        g.save(); g.translate(px, py); g.rotate(-0.6); g.scale(s * 1.4, s * 1.4);
        for (const side of [-1, 1]) { g.save(); g.rotate(side * open); g.fillStyle = '#c9ccd6'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-90, side * 8); g.lineTo(-90, side * -2); g.closePath(); g.fill(); g.fillStyle = side < 0 ? '#ff3b30' : '#ffcc1a'; rr(g, 6, side > 0 ? 2 : -14, 70, 12, 6); g.fill(); g.restore(); }
        g.fillStyle = '#333'; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); g.restore();
      }
      // relief flash when it's cut
      if (cut && c < 7.5) { g.fillStyle = `rgba(57,224,122,${0.25 * (1 - (c - 7) / 0.5)})`; g.fillRect(0, 0, W, H); }
      // sparks
      S.sparks = S.sparks.filter((p) => t - p.t < 0.6);
      for (const p of S.sparks) { const a = t - p.t; g.fillStyle = `rgba(255,${200 - a * 200},60,${1 - a / 0.6})`; g.fillRect(bx + p.x + p.vx * a - 2, by + p.y + p.vy * a + 300 * s * a * a - 2, 4, 4); }
    },
  };
})();
