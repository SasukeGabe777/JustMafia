'use strict';
// Tune Buzz title screen: a neon radio studio at midnight. A giant equaliser skyline pulses to
// the beat, two vinyl records spin on the decks, a big pink buzzer slams down every few beats and
// fires shock rings, and notes drift up through sweeping stage lights. Format: public/box/title.js.
(function () {
  const TAU = Math.PI * 2;
  const BPM = 116;
  function record(g, x, y, r, rot, label) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = '#0b0b10'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 1;
    for (let k = r * 0.42; k < r * 0.97; k += 4) { g.beginPath(); g.arc(0, 0, k, 0, TAU); g.stroke(); }
    // shine
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r * 0.96, -0.5, 0.1); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r * 0.96, Math.PI - 0.5, Math.PI + 0.1); g.closePath(); g.fill();
    g.fillStyle = label; g.beginPath(); g.arc(0, 0, r * 0.36, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.font = `${Math.round(r * 0.18)}px Bungee, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', 0, -r * 0.14);
    g.fillStyle = '#0b0b10'; g.beginPath(); g.arc(0, 0, r * 0.05, 0, TAU); g.fill();
    g.restore();
  }
  BOX.titles.tune = {
    logo: '<span class="a">TUNE</span><span class="b">BUZZ</span>',
    tagline: 'Bring your songs. Name theirs. A few seconds is all you get!',
    start: '🔴 Go on air', meta: '2–100 players · best 3–12 · 8–15 min',
    font: "'Monoton', 'Bungee', sans-serif",
    theme: { card: 'rgba(16, 4, 40, 0.86)', ink: '#fbf3ff', muted: '#c9b6ef', accent: '#38e8ff', button: '#ff3d8b', buttonInk: '#fff', border: '#38e8ff' },
    css: `.bt-tune .bt-logo { font-size: clamp(60px, 9vw, 124px); line-height: 1; font-weight: 400; letter-spacing: 0.02em; }
      .bt-tune .bt-logo .a { color: #fff; text-shadow: 0 0 8px #ff3d8b, 0 0 24px #ff3d8b, 0 0 60px #ff3d8b; }
      .bt-tune .bt-logo .b { color: #ffd23f; margin-left: 0.18em; display: inline-block; text-shadow: 0 0 8px #ff9d2e, 0 0 30px #ff9d2e; animation: bttBuzz 2.07s ease-in-out infinite; }
      @keyframes bttBuzz { 0%, 80%, 100% { transform: none; } 83% { transform: translate(-5px, 1px) rotate(-2deg); } 86% { transform: translate(5px, -1px) rotate(2deg); } 89% { transform: translateX(-3px); } 92% { transform: translateX(3px); } }
      .bt-tune .bt-card { box-shadow: 0 0 0 3px #ff3d8b, 0 0 60px rgba(255, 61, 139, 0.5), 0 0 120px rgba(56, 232, 255, 0.25); }
      .bt-tune .bt-go { font-family: 'Bungee', sans-serif; font-weight: 400; letter-spacing: 0.04em; }`,
    init(W, H) {
      return {
        notes: Array.from({ length: 34 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: 18 + Math.random() * 40, s: 18 + Math.random() * 26, w: Math.random() * TAU, e: ['🎵', '🎶', '♪', '♫'][Math.floor(Math.random() * 4)] })),
        rings: [], lastSlam: -1, last: 0,
      };
    },
    draw(g, W, H, t, S) {
      const beat = t * BPM / 60, bf = beat % 1, pulse = Math.pow(1 - bf, 3), bar = Math.floor(beat / 4), inBar = beat % 4;
      // night studio
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1b0642'); gr.addColorStop(0.6, '#0d0326'); gr.addColorStop(1, '#040010'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // sweeping lights
      for (const [k, c] of [[0, '255,61,139'], [1, '56,232,255'], [2, '255,210,63']]) {
        const x = W * (0.5 + 0.45 * Math.sin(t * (0.28 + k * 0.05) + k * 2.2));
        gr = g.createLinearGradient(x, 0, W / 2, H); gr.addColorStop(0, `rgba(${c},${0.16 + 0.08 * pulse})`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 40, 0); g.lineTo(x + 40, 0); g.lineTo(W / 2 + W * 0.4, H); g.lineTo(W / 2 - W * 0.4, H); g.closePath(); g.fill();
      }
      // equaliser skyline
      const n = Math.max(32, Math.round(W / 34)), bw = W / n, base = H * 0.86;
      for (let i = 0; i < n; i++) {
        const f = i / n, shape = 0.5 + 0.5 * Math.sin(f * 7 + t * 0.6) * Math.sin(f * 3 + 1.3);
        const h = H * (0.1 + 0.32 * shape * (0.55 + 0.45 * Math.sin(t * (5 + (i % 6)) + i)) + 0.12 * pulse);
        const segs = Math.floor(h / 12);
        for (let s = 0; s < segs; s++) { g.fillStyle = `hsla(${320 - f * 160},100%,${50 + s}%,0.85)`; g.fillRect(i * bw + 2, base - (s + 1) * 12 + 2, bw - 4, 9); }
        g.fillStyle = `hsla(${320 - f * 160},100%,60%,0.12)`; g.fillRect(i * bw + 2, base + 4, bw - 4, h * 0.3);
      }
      // decks
      const r = Math.min(W, H) * 0.16;
      record(g, W * 0.12, H * 0.62, r, t * 3.3, '#ff3d8b');
      record(g, W * 0.88, H * 0.62, r, -t * 3.3 + 1, '#38e8ff');
      // the buzzer: slams on beat 1 of every other bar
      const slam = bar % 2 === 0 && inBar < 0.35, bx = W * 0.5, by = H * 0.84, br = Math.min(W, H) * 0.09;
      if (slam && S.lastSlam !== bar) { S.lastSlam = bar; S.rings.push({ t0: t }); }
      S.rings = S.rings.filter((q) => t - q.t0 < 1.4);
      for (const q of S.rings) { const k = (t - q.t0) / 1.4; g.strokeStyle = `rgba(255,61,139,${1 - k})`; g.lineWidth = 8 * (1 - k) + 1; g.beginPath(); g.ellipse(bx, by, br + k * W * 0.35, (br + k * W * 0.35) * 0.32, 0, 0, TAU); g.stroke(); }
      g.fillStyle = '#2a2638'; g.beginPath(); g.ellipse(bx, by + br * 0.35, br * 1.35, br * 0.5, 0, 0, TAU); g.fill();
      const press = slam ? br * 0.18 : 0;
      g.save(); g.shadowColor = '#ff3d8b'; g.shadowBlur = 30 + 50 * (slam ? 1 : pulse * 0.4);
      gr = g.createRadialGradient(bx - br * 0.3, by - br * 0.3 + press, br * 0.1, bx, by + press, br * 1.1); gr.addColorStop(0, '#ff9fc4'); gr.addColorStop(0.5, '#ff3d8b'); gr.addColorStop(1, '#a80c50');
      g.fillStyle = gr; g.beginPath(); g.ellipse(bx, by - br * 0.1 + press, br * 1.1, br * 0.55, 0, 0, TAU); g.fill(); g.restore();
      // drifting notes
      const dt = Math.min(0.05, t - (S.last || t)); S.last = t;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const p of S.notes) {
        p.y -= p.v * dt; if (p.y < -30) { p.y = H + 30; p.x = Math.random() * W; }
        g.globalAlpha = 0.35 + 0.25 * pulse; g.fillStyle = '#fff'; g.font = `${p.s}px serif`; g.fillText(p.e, p.x + Math.sin(t + p.w) * 20, p.y);
      }
      g.globalAlpha = 1;
      // ON AIR sign
      const on = Math.sin(t * 3) > -0.6;
      g.save(); g.font = `${Math.round(Math.min(W, H) * 0.035)}px Bungee, sans-serif`; g.textAlign = 'left';
      const tx = W * 0.04, ty = H * 0.08, tw = g.measureText('● ON AIR').width + 28;
      g.fillStyle = on ? '#ff2d55' : '#4a1020'; g.shadowColor = '#ff2d55'; g.shadowBlur = on ? 30 : 0; g.fillRect(tx, ty - Math.min(W, H) * 0.03, tw, Math.min(W, H) * 0.06);
      g.shadowBlur = 0; g.fillStyle = on ? '#fff' : '#a77'; g.fillText('● ON AIR', tx + 14, ty + 2); g.restore();
    },
  };
})();
