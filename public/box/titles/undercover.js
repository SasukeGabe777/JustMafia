'use strict';
// JustUndercover title screen (format: public/box/title.js): the agency at night. A glowing
// dot-matrix world map scans behind the blinds, a searchlight sweeps the room, case files drift
// past with their CLASSIFIED stamps, and one red light keeps blinking: the mole.
(function () {
  const TAU = Math.PI * 2;
  BOX.titles.undercover = {
    logo: '<span class="a">Just</span><span class="b">Undercover</span>',
    tagline: 'A mole has slipped into the agency. Give clues, draw lines, read the room, and vote them out!',
    start: '🕵️ Open the case files', meta: '3–20 agents · 10–30 min',
    font: "'Rubik Mono One', sans-serif",
    theme: { card: 'rgba(8, 12, 24, 0.88)', ink: '#e9eefb', accent: '#f2c14e', button: '#e2363f', buttonInk: '#ffffff', border: '#f2c14e' },
    css: '.bt-undercover .bt-logo { font-weight: 400; letter-spacing: 0.02em; } .bt-undercover .bt-logo .a { display: block; font-size: 0.42em; color: #5ff2ff; letter-spacing: 0.3em; } .bt-undercover .bt-logo .b { color: #f2c14e; text-shadow: 0 0 18px rgba(242, 193, 78, 0.55), 0 5px 0 #05080f; }',
    init(W, H) {
      const rnd = Math.random, blobs = [[0.18, 0.32, 0.12, 0.12], [0.24, 0.62, 0.06, 0.14], [0.47, 0.28, 0.12, 0.1], [0.49, 0.56, 0.06, 0.12], [0.72, 0.34, 0.14, 0.12], [0.8, 0.7, 0.07, 0.06]];
      const dots = []; for (const [cx, cy, rx, ry] of blobs) for (let i = 0; i < 160; i++) { const a = rnd() * TAU, r = Math.sqrt(rnd()); dots.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]); }
      return { dots, files: Array.from({ length: 9 }, (_, i) => ({ x: rnd(), y: rnd(), v: 0.012 + rnd() * 0.02, r: (rnd() - 0.5) * 0.6, spin: (rnd() - 0.5) * 0.25, s: 0.7 + rnd() * 0.6, red: i % 3 === 0 })) };
    },
    draw(g, W, H, t, S) {
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#16223c'); gr.addColorStop(1, '#070b15'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // the map
      const step = Math.max(3, Math.min(W, H) / 220);
      for (const [x, y] of S.dots) { g.fillStyle = 'rgba(95,242,255,0.35)'; g.fillRect(x * W, y * H, step, step); }
      const sy = ((t * 0.12) % 1.1) * H; gr = g.createLinearGradient(0, sy - 60, 0, sy); gr.addColorStop(0, 'rgba(95,242,255,0)'); gr.addColorStop(1, 'rgba(95,242,255,0.16)'); g.fillStyle = gr; g.fillRect(0, sy - 60, W, 60);
      // the mole: a blinking red light and its ring
      const mx = W * 0.52, my = H * 0.3, b = 0.5 + 0.5 * Math.sin(t * 6), ring = (t % 1.4) / 1.4;
      g.fillStyle = `rgba(255,70,80,${0.6 + 0.4 * b})`; g.beginPath(); g.arc(mx, my, Math.max(5, W / 220), 0, TAU); g.fill();
      g.strokeStyle = `rgba(255,70,80,${0.8 * (1 - ring)})`; g.lineWidth = 3; g.beginPath(); g.arc(mx, my, 8 + ring * Math.min(W, H) * 0.08, 0, TAU); g.stroke();
      // blinds
      g.save(); g.globalCompositeOperation = 'lighter'; g.translate(W * 0.1, -H * 0.1); g.rotate(-0.25);
      for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(140,180,255,0.045)'; g.fillRect(-W * 0.2, i * H * 0.07, W * 0.9, H * 0.032); }
      g.restore();
      // the searchlight
      const a = Math.sin(t * 0.5) * 0.6; g.save(); g.translate(W * 0.5, H * 1.05); g.rotate(a);
      gr = g.createLinearGradient(0, 0, 0, -H * 1.2); gr.addColorStop(0, 'rgba(255,240,190,0.22)'); gr.addColorStop(1, 'rgba(255,240,190,0)'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(-W * 0.02, 0); g.lineTo(-W * 0.16, -H * 1.2); g.lineTo(W * 0.16, -H * 1.2); g.lineTo(W * 0.02, 0); g.fill(); g.restore();
      // case files drifting by
      const fw = Math.min(W, H) * 0.16;
      for (const f of S.files) {
        const x = ((f.x + t * f.v) % 1.2) * W - W * 0.1, y = f.y * H + Math.sin(t * 0.7 + f.x * 9) * H * 0.02;
        g.save(); g.translate(x, y); g.rotate(f.r + t * f.spin * 0.2); g.scale(f.s, f.s);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-fw / 2 + 6, -fw * 0.36 + 8, fw, fw * 0.72);
        g.fillStyle = '#ecd9a6'; g.fillRect(-fw / 2, -fw * 0.36, fw, fw * 0.72); g.fillRect(-fw / 2, -fw * 0.44, fw * 0.4, fw * 0.1);
        g.strokeStyle = 'rgba(60,40,10,0.6)'; g.lineWidth = 2; g.strokeRect(-fw / 2, -fw * 0.36, fw, fw * 0.72);
        g.fillStyle = 'rgba(60,40,10,0.35)'; for (let i = 0; i < 3; i++) g.fillRect(-fw * 0.38, -fw * 0.18 + i * fw * 0.12, fw * (0.5 + (i % 2) * 0.2), fw * 0.04);
        g.rotate(-0.25); g.strokeStyle = f.red ? '#e2363f' : '#3d8bff'; g.lineWidth = Math.max(2, fw * 0.03); g.strokeRect(-fw * 0.3, fw * 0.02, fw * 0.6, fw * 0.18);
        g.fillStyle = f.red ? '#e2363f' : '#3d8bff'; g.font = `${Math.round(fw * 0.11)}px "Rubik Mono One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.red ? 'MOLE' : 'AGENT', 0, fw * 0.115);
        g.restore();
      }
      const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    },
  };
})();
