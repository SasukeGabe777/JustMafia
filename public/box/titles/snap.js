'use strict';
// JustSnap title screen (format: public/box/title.js): SNAP! magazine's wall at night. Instant
// photos tumble down and develop as they fall (dark first, then the picture fades in), camera
// flashes pop around the room, and a big camera on the right fires now and then.
(function () {
  const TAU = Math.PI * 2, INK = '#16141c', PINK = '#ff2e63', GOLD = '#ffcc33';
  const SKIES = [['#6ec6ff', '#ffe9a8'], ['#ff8fb1', '#ffd36e'], ['#3a2d7a', '#ff7a59'], ['#2ec4d6', '#e9fff7'], ['#1f3a5f', '#6ec6ff']];
  const THINGS = ['🌵', '🐶', '🍩', '🎈', '🧸', '🌻', '🦆', '🍉', '🎸', '😎', '🪴', '🐱'];
  function polaroid(g, p, t, s) {
    const w = s, h = s * 1.18, dev = Math.min(1, Math.max(0, (t - p.t0) / 3.2));
    g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-w / 2 + 6, -h / 2 + 8, w, h);
    g.fillStyle = '#fbf8f1'; g.fillRect(-w / 2, -h / 2, w, h);
    const pw = w * 0.86, ph = w * 0.86, px = -pw / 2, py = -h / 2 + w * 0.07;
    const [a, b] = SKIES[p.sky];
    const gr = g.createLinearGradient(0, py, 0, py + ph); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(px, py, pw, ph);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py + ph * 0.72, pw, ph * 0.28);
    g.font = `${Math.round(ph * 0.5)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(THINGS[p.k], 0, py + ph * 0.52);
    g.fillStyle = `rgba(30,20,24,${1 - dev})`; g.fillRect(px, py, pw, ph); // still developing
    g.restore();
  }
  BOX.titles.snap = {
    logo: '<span class="a">SNAP</span><span class="b">!</span>',
    tagline: 'Run around with your phone camera. Your photos hit the big screen, and the room votes.',
    start: '📸 Start the shoot', meta: '2–100 photographers · 10–30 min',
    font: "'Abril Fatface', Georgia, serif",
    theme: { card: 'rgba(22, 20, 28, 0.88)', ink: '#f7f3ea', accent: GOLD, button: PINK, buttonInk: '#ffffff', border: PINK },
    css: '.bt-snap .bt-logo { font-weight: 400; letter-spacing: -0.02em; transform: rotate(-3deg); } .bt-snap .bt-logo .a { color: #ff2e63; text-shadow: 3px 3px 0 #16141c, 7px 7px 0 #ffcc33; } .bt-snap .bt-logo .b { color: #ffcc33; text-shadow: 3px 3px 0 #16141c; margin-left: .04em; }',
    init(W, H) {
      const r = Math.random;
      return {
        pics: Array.from({ length: 16 }, (_, i) => ({ x: r() * W, y: r() * H, v: 18 + r() * 30, rot: (r() - 0.5) * 0.6, spin: (r() - 0.5) * 0.3, sky: i % SKIES.length, k: i % THINGS.length, t0: -r() * 4, s: 0.7 + r() * 0.6 })),
        flashes: [], next: 0.4,
      };
    },
    draw(g, W, H, t, S) {
      // the office wall: dark plum with a diagonal sheen
      let gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#2b2233'); gr.addColorStop(1, '#120f17'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.025)'; for (let x = -H; x < W; x += 36) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 18, 0); g.lineTo(x + 18 + H, H); g.lineTo(x + H, H); g.fill(); }
      gr = g.createRadialGradient(W * 0.75, H * 0.15, 10, W * 0.75, H * 0.15, W * 0.6); gr.addColorStop(0, 'rgba(255,46,99,0.25)'); gr.addColorStop(1, 'rgba(255,46,99,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // photos tumbling down, developing as they fall
      const base = Math.min(W, H) * 0.2;
      for (const p of S.pics) {
        p.y += p.v / 60; p.rot += p.spin / 60;
        if (p.y > H + base) { p.y = -base; p.x = Math.random() * W; p.t0 = t; p.k = (p.k + 5) % THINGS.length; }
        polaroid(g, p, t, base * p.s);
      }
      // the big camera, lower right
      const cs = Math.min(W, H) * 0.34, cx = W * 0.84, cy = H * 0.74;
      g.save(); g.translate(cx, cy); g.rotate(-0.12);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(10, cs * 0.5, cs * 0.75, cs * 0.12, 0, 0, TAU); g.fill();
      g.lineWidth = Math.max(3, cs * 0.025); g.strokeStyle = INK;
      g.fillStyle = '#2b2b33'; g.beginPath(); g.roundRect(-cs * 0.2, -cs * 0.52, cs * 0.4, cs * 0.16, cs * 0.04); g.fill(); g.stroke();
      gr = g.createLinearGradient(0, -cs * 0.4, 0, cs * 0.4); gr.addColorStop(0, '#f4f1ea'); gr.addColorStop(1, '#cfc8bb'); g.fillStyle = gr;
      g.beginPath(); g.roundRect(-cs * 0.7, -cs * 0.4, cs * 1.4, cs * 0.8, cs * 0.12); g.fill(); g.stroke();
      g.fillStyle = PINK; g.fillRect(-cs * 0.7, -cs * 0.12, cs * 1.4, cs * 0.12);
      g.fillStyle = INK; g.beginPath(); g.arc(0, 0, cs * 0.3, 0, TAU); g.fill();
      gr = g.createRadialGradient(-cs * 0.06, -cs * 0.06, 2, 0, 0, cs * 0.22); gr.addColorStop(0, '#9fe8ff'); gr.addColorStop(0.5, '#2a6f9a'); gr.addColorStop(1, '#0b1a2a'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, cs * 0.22, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(-cs * 0.08, -cs * 0.08, cs * 0.045, 0, TAU); g.fill();
      g.fillStyle = '#fff6c8'; g.beginPath(); g.roundRect(cs * 0.38, -cs * 0.34, cs * 0.22, cs * 0.14, cs * 0.03); g.fill(); g.stroke();
      g.restore();
      // flashes: random pops around the room, and the big camera firing every few seconds
      if (t > S.next) { S.flashes.push({ x: Math.random() * W, y: Math.random() * H * 0.7, t }); S.next = t + 0.5 + Math.random() * 1.4; }
      if (Math.floor(t / 4.5) !== S.bigN) { S.bigN = Math.floor(t / 4.5); S.flashes.push({ x: cx + cs * 0.3, y: cy - cs * 0.3, t, big: true }); }
      S.flashes = S.flashes.filter((f) => t - f.t < 0.6);
      for (const f of S.flashes) {
        const k = (t - f.t) / 0.6, r = (f.big ? W * 0.5 : Math.min(W, H) * 0.12) * (0.3 + k), a = (1 - k) * (f.big ? 0.75 : 0.6);
        gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r); gr.addColorStop(0, `rgba(255,255,240,${a})`); gr.addColorStop(1, 'rgba(255,255,240,0)'); g.fillStyle = gr; g.fillRect(f.x - r, f.y - r, r * 2, r * 2);
        if (!f.big) { g.strokeStyle = `rgba(255,255,255,${a})`; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const an = i * Math.PI / 4; g.beginPath(); g.moveTo(f.x - Math.cos(an) * r * 0.5, f.y - Math.sin(an) * r * 0.5); g.lineTo(f.x + Math.cos(an) * r * 0.5, f.y + Math.sin(an) * r * 0.5); g.stroke(); } }
      }
      const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    },
  };
})();
