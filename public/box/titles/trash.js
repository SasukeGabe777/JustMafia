'use strict';
// TrashZombies title screen (format: public/box/title.js): dusk on a junky street. A garage door
// rattles up and up, light spills out onto the driveway, and zombies shamble in from the right
// past dumpsters and bins. Spray-paint logo.
(function () {
  const TAU = Math.PI * 2, OL = '#1b1410';
  BOX.titles.trash = {
    logo: '<span style="color:#fff6d8;-webkit-text-stroke:3px #1b1410;text-shadow:0 6px 0 #1b1410">Trash</span><span style="color:#9cff3c;-webkit-text-stroke:3px #1b1410;text-shadow:0 6px 0 #1b1410">Zombies</span>',
    tagline: 'Roll up the garage door. Walk out. Don’t get trashed.', start: '▶ Roll up the door', meta: 'Solo or 1–100 players · 5–30 min',
    font: "'Lilita One', sans-serif",
    theme: { card: 'rgba(24, 16, 20, 0.86)', button: '#9cff3c', buttonInk: '#1b1410', border: '#ff8c2e', accent: '#9cff3c' },
    init(W, H) {
      const r = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
      return { zs: Array.from({ length: 7 }, (_, i) => ({ x: W * (0.55 + i * 0.09) + r() * 40, sp: 14 + r() * 16, ph: r() * 6, s: 0.8 + r() * 0.5, c: ['#7fae6a', '#8fbf7a', '#9a8fbf'][i % 3] })), stars: Array.from({ length: 50 }, () => [r(), r() * 0.45, r()]) };
    },
    draw(g, W, H, t, S) {
      const ground = H * 0.68;
      let gr = g.createLinearGradient(0, 0, 0, ground); gr.addColorStop(0, '#24163a'); gr.addColorStop(0.55, '#6b3550'); gr.addColorStop(1, '#e0794a'); g.fillStyle = gr; g.fillRect(0, 0, W, ground);
      for (const [x, y, p] of S.stars) { g.globalAlpha = 0.3 + 0.3 * Math.sin(t * 1.5 + p * 9); g.fillStyle = '#fff6d8'; g.fillRect(x * W, y * H, 2, 2); } g.globalAlpha = 1;
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(W * 0.83, H * 0.2, Math.min(W, H) * 0.06, 0, TAU); g.fill();
      // skyline + junk piles
      g.fillStyle = '#2a1830'; for (let i = 0; i < 14; i++) { const x = (i / 14) * W, w = W / 16, h = H * (0.12 + ((i * 37) % 10) / 40); g.fillRect(x, ground - h, w, h); }
      g.fillStyle = '#3b2a2a'; g.beginPath(); g.moveTo(W * 0.5, ground); for (let x = W * 0.5; x <= W; x += 30) g.lineTo(x, ground - 40 - Math.abs(Math.sin(x * 0.02)) * 50); g.lineTo(W, ground); g.fill();
      // the street
      gr = g.createLinearGradient(0, ground, 0, H); gr.addColorStop(0, '#3b3a3f'); gr.addColorStop(1, '#1d1b20'); g.fillStyle = gr; g.fillRect(0, ground, W, H - ground);
      g.fillStyle = '#ffd23f'; for (let x = ((-t * 0) % 140); x < W; x += 140) g.fillRect(x, ground + (H - ground) * 0.55, 70, 8);
      // the garage (left): the door keeps rattling up, light floods out
      const gx = W * 0.08, gw = W * 0.28, gh = H * 0.36, gy = ground - gh;
      g.fillStyle = '#5a3a32'; g.fillRect(gx - 20, gy - 30, gw + 40, gh + 30); g.fillStyle = '#3b2420'; g.beginPath(); g.moveTo(gx - 40, gy - 30); g.lineTo(gx + gw / 2, gy - 90); g.lineTo(gx + gw + 40, gy - 30); g.fill();
      const cyc = (t % 7) / 7, open = cyc < 0.15 ? 0 : cyc < 0.55 ? (cyc - 0.15) / 0.4 : cyc < 0.85 ? 1 : 1 - (cyc - 0.85) / 0.15;
      const shake = open > 0 && open < 1 ? Math.sin(t * 60) * 2 : 0;
      g.fillStyle = '#ffe9a8'; g.fillRect(gx, gy, gw, gh);
      g.fillStyle = `rgba(255,233,168,${0.35 * open})`; g.beginPath(); g.moveTo(gx, ground); g.lineTo(gx + gw, ground); g.lineTo(gx + gw * 1.5, H); g.lineTo(gx - gw * 0.4, H); g.closePath(); g.fill();
      const dh = gh * (1 - open * 0.92); g.fillStyle = '#c9ccd1'; g.fillRect(gx + shake, gy, gw, dh); g.strokeStyle = '#8a8f98'; g.lineWidth = 3; g.beginPath(); for (let y = gy + dh - 4; y > gy; y -= 18) { g.moveTo(gx + shake, y); g.lineTo(gx + gw + shake, y); } g.stroke();
      g.strokeStyle = OL; g.lineWidth = 5; g.strokeRect(gx, gy, gw, gh);
      if (open > 0.6) { // a survivor silhouette with a blaster in the doorway
        const sx = gx + gw / 2, sy = ground - 4, s = gh / 220; g.fillStyle = '#1b1410';
        g.fillRect(sx - 12 * s, sy - 110 * s, 24 * s, 60 * s); g.beginPath(); g.arc(sx, sy - 128 * s, 18 * s, 0, TAU); g.fill(); g.fillRect(sx - 12 * s, sy - 50 * s, 9 * s, 50 * s); g.fillRect(sx + 3 * s, sy - 50 * s, 9 * s, 50 * s); g.fillRect(sx + 8 * s, sy - 95 * s, 50 * s, 10 * s);
      }
      // bins + a dumpster
      const bin = (x, c) => { g.fillStyle = c; g.strokeStyle = OL; g.lineWidth = 4; g.fillRect(x, ground - 60, 44, 60); g.strokeRect(x, ground - 60, 44, 60); g.fillRect(x - 4, ground - 68, 52, 10); g.strokeRect(x - 4, ground - 68, 52, 10); };
      bin(W * 0.42, '#6c7884'); bin(W * 0.46, '#3d7a4a');
      g.fillStyle = '#2f8a4a'; g.fillRect(W * 0.86, ground - 80, 130, 80); g.strokeStyle = OL; g.lineWidth = 5; g.strokeRect(W * 0.86, ground - 80, 130, 80); g.fillStyle = '#24603a'; g.fillRect(W * 0.855, ground - 92, 140, 14);
      // zombies shambling left
      for (const z of S.zs) {
        z.x -= (z.sp / 60) * (W / 1600); if (z.x < W * 0.38) z.x = W + 60;
        const s = z.s * (H / 900), y = ground + 10, sw = Math.sin(t * 4 + z.ph);
        g.save(); g.translate(z.x, y); g.scale(-s, s); g.lineCap = 'round'; g.strokeStyle = OL; g.lineWidth = 12;
        g.beginPath(); g.moveTo(-6, -50); g.lineTo(-6 + sw * 10, 0); g.moveTo(6, -50); g.lineTo(6 - sw * 10, 0); g.stroke();
        g.fillStyle = '#4a3a5a'; g.fillRect(-18, -110, 36, 62); g.strokeRect(-18, -110, 36, 62);
        g.strokeStyle = OL; g.lineWidth = 11; g.beginPath(); g.moveTo(8, -96); g.lineTo(50, -100 + sw * 4); g.moveTo(8, -84); g.lineTo(48, -86 - sw * 4); g.stroke(); g.strokeStyle = z.c; g.lineWidth = 6; g.stroke();
        g.fillStyle = z.c; g.beginPath(); g.arc(4, -128, 20, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OL; g.stroke();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(12, -132, 5, 0, TAU); g.fill(); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(13, -132, 2, 0, TAU); g.fill();
        g.restore();
      }
      // drifting litter
      g.fillStyle = 'rgba(242,239,230,0.6)'; for (let i = 0; i < 8; i++) { const x = ((i * 241 + t * 40) % (W + 100)) - 50, y = ground + 20 + ((i * 53) % (H - ground - 30)); g.save(); g.translate(x, y); g.rotate(t + i); g.fillRect(-6, -4, 12, 8); g.restore(); }
    },
  };
})();
