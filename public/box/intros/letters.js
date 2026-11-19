'use strict';
// Letter Rush intro: a desk at night under a lamp. Letter tiles rain down and clatter into the
// logo, the big red-lettered die tumbles across the desk and lands, and a pencil races down a
// yellow legal pad scoring answers (+1, a MATCH stamp, +2 ✨). The roll call drops each
// player in as a letter tile with their initial. No host: a narrator reads the lines.
// Engine + API: public/box/show.js.
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, TAU, clamp } = ST.util, { rr, text } = ST.draw;
  const BUN = '"Bungee", "Lilita One", sans-serif', HW = '"Caveat Brush", "Lilita One", cursive', BODY = '"Fredoka", sans-serif';
  try { if (document.fonts) { document.fonts.load('40px "Bungee"'); document.fonts.load('40px "Caveat Brush"'); } } catch { /* fine */ }
  const ABC = 'ABCDEFGHIJKLMNOPRSTWY';
  const R = rng(4242);
  const RAIN = Array.from({ length: 40 }, () => ({ x: R() * 2400 - 240, y: R() * 1400 - 300, v: 120 + R() * 220, s: 50 + R() * 70, r: R() * TAU, vr: (R() - 0.5) * 1.6, L: ABC[Math.floor(R() * ABC.length)], a: 0.25 + R() * 0.4 }));
  const LOGO = 'LETTER';

  function tile(g, x, y, s, rot, L, o = {}) {
    g.save(); g.translate(x, y); g.rotate(rot || 0); if (o.alpha != null) g.globalAlpha = o.alpha;
    g.fillStyle = 'rgba(0,0,0,0.3)'; rr(g, -s / 2 + s * 0.06, -s / 2 + s * 0.14, s, s, s * 0.18); g.fill();
    g.fillStyle = '#b48a4f'; rr(g, -s / 2, -s / 2 + s * 0.08, s, s, s * 0.18); g.fill();
    const gr = g.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.6, '#fff4dc'); gr.addColorStop(1, '#e7cf9f');
    g.fillStyle = gr; rr(g, -s / 2, -s / 2, s, s, s * 0.18); g.fill();
    if (o.glow) { g.strokeStyle = o.glow; g.lineWidth = s * 0.06; rr(g, -s / 2, -s / 2, s, s, s * 0.18); g.stroke(); }
    text(g, L, 0, s * 0.05, s * 0.62, o.ink || '#1d1b3a', { font: BUN });
    g.restore(); g.globalAlpha = 1;
  }
  function desk(g, s, lights = 1) {
    const gr = g.createLinearGradient(0, -300, 0, 1400); gr.addColorStop(0, '#16305a'); gr.addColorStop(1, '#0b1a33'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    const lamp = g.createRadialGradient(960, 420, 0, 960, 420, 1100); lamp.addColorStop(0, `rgba(120,170,250,${0.32 * lights})`); lamp.addColorStop(1, 'rgba(120,170,250,0)'); g.fillStyle = lamp; g.fillRect(-600, -300, 3120, 1700);
    g.strokeStyle = 'rgba(255,255,255,0.035)'; g.lineWidth = 3; for (let x = -600; x < 2520; x += 160) { g.beginPath(); g.moveTo(x, -300); g.lineTo(x, 1400); g.stroke(); } for (let y = -300; y < 1400; y += 160) { g.beginPath(); g.moveTo(-600, y); g.lineTo(2520, y); g.stroke(); }
  }
  function rain(g, s, k = 1) {
    for (const d of RAIN) { const y = ((d.y + s.t * d.v) % 1700) - 300; tile(g, d.x, y, d.s, d.r + s.t * d.vr, d.L, { alpha: d.a * k }); }
  }
  // The pad: a yellow legal pad with a red header, margin and blue rules.
  function pad(g, x, y, w, h, rot, title) {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.3)'; rr(g, -w / 2 + 14, -h / 2 + 24, w, h, 18); g.fill();
    g.fillStyle = '#fff3a3'; rr(g, -w / 2, -h / 2, w, h, 16); g.fill();
    g.strokeStyle = '#9cc7f2'; g.lineWidth = 3; for (let yy = -h / 2 + 150; yy < h / 2; yy += 70) { g.beginPath(); g.moveTo(-w / 2, yy); g.lineTo(w / 2, yy); g.stroke(); }
    g.strokeStyle = '#ff6b6b'; g.lineWidth = 4; g.beginPath(); g.moveTo(-w / 2 + 90, -h / 2 + 90); g.lineTo(-w / 2 + 90, h / 2); g.stroke();
    g.fillStyle = '#c53030'; rr(g, -w / 2, -h / 2, w, 90, 16); g.fill(); g.fillRect(-w / 2, -h / 2 + 45, w, 45);
    if (title) text(g, title, 0, -h / 2 + 47, 40, '#fff', { font: BUN });
    g.restore();
  }
  // A cube in orthographic 3D (each face is an exact parallelogram drawn with transform()).
  const FACES = [[[0, 0, 1], [1, 0, 0], [0, -1, 0]], [[0, 0, -1], [-1, 0, 0], [0, -1, 0]], [[1, 0, 0], [0, 0, -1], [0, -1, 0]], [[-1, 0, 0], [0, 0, 1], [0, -1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, 1]], [[0, -1, 0], [1, 0, 0], [0, 0, -1]]];
  function rot([x, y, z], ax, ay, az) {
    let c = Math.cos(ax), sn = Math.sin(ax); [y, z] = [y * c - z * sn, y * sn + z * c];
    c = Math.cos(ay); sn = Math.sin(ay); [x, z] = [x * c + z * sn, -x * sn + z * c];
    c = Math.cos(az); sn = Math.sin(az); [x, y] = [x * c - y * sn, x * sn + y * c];
    return [x, y, z];
  }
  function die(g, cx, cy, r, ax, ay, az, letters) {
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(cx, cy + r * 1.6, r * 1.3, r * 0.3, 0, 0, TAU); g.fill();
    const faces = FACES.map((f, i) => ({ n: rot(f[0], ax, ay, az), u: rot(f[1], ax, ay, az), v: rot(f[2], ax, ay, az), L: letters[i] })).filter((f) => f.n[2] > 0.02).sort((a, b) => a.n[2] - b.n[2]);
    for (const f of faces) {
      g.save(); g.transform(f.u[0] * r, f.u[1] * r, -f.v[0] * r, -f.v[1] * r, cx + f.n[0] * r, cy + f.n[1] * r);
      const gr = g.createRadialGradient(-0.4, -0.4, 0.1, 0, 0, 1.5); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.6, '#fff4dc'); gr.addColorStop(1, '#e2c58f');
      g.fillStyle = gr; rr(g, -1, -1, 2, 2, 0.32); g.fill();
      g.fillStyle = `rgba(20,30,60,${(1 - (0.55 + 0.45 * f.n[2])) * 0.8})`; rr(g, -1, -1, 2, 2, 0.32); g.fill();
      g.fillStyle = '#e63946'; g.font = `1.3px ${BUN}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.L, 0, 0.08);
      g.restore();
    }
  }
  function logo(g, s, lit) {
    const k = clamp(lit == null ? 1 : lit);
    for (let i = 0; i < LOGO.length; i++) {
      const q = back(clamp(k * 1.6 - i * 0.1)); if (q <= 0) continue;
      tile(g, (i - 2.5) * 128, -60 - (1 - q) * 500, 118, (1 - q) * (i % 2 ? 0.8 : -0.8) + Math.sin(s.t * 2 + i) * 0.03, LOGO[i]);
    }
    const q = back(clamp(k * 2 - 1)); if (q > 0) { g.save(); g.translate(0, 110); g.rotate(-0.06); g.scale(q, q); text(g, 'RUSH!', 0, 0, 150, '#e63946', { font: BUN, stroke: '#5e1219', lw: 14 }); g.restore(); }
  }
  function stage(g, s, o = {}) {
    desk(g, s, o.lights == null ? 1 : o.lights);
    if (!o.bare) rain(g, s, 0.8);
    if (o.logo) { g.save(); g.translate(960, 400); logo(g, s, o.logo); g.restore(); }
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(4,8,20,${(1 - o.lights) * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
  }
  const ANS = [['A fruit', 'Banana', '+1', '#13897e'], ['An animal', 'Bear', 'MATCH', '#5b4bd6'], ['Something in a garage', 'Big blue bike', '+2 ✨', '#c99700'], ['A reason to be late', 'Bus broke down', '+2 ✨', '#c99700']];

  BOX.intros.letters = {
    title: 'Letter Rush',
    // How to play (box/howto.js): one card per step, 6 steps (module howSteps).
    tutorial: [
      { icon: '🎲', title: 'The letter', text: 'A letter is rolled and a list of categories goes up on the big screen.' },
      { icon: '✍️', title: 'Write fast', text: 'Write one answer per category that starts with that letter, before time runs out.', phone: 'Type an answer in each box. Enter jumps to the next one.' },
      { icon: '🎯', title: 'Be unique', text: 'Unique answers score 1. If anyone else wrote the same answer, it scores 0. Think different!' },
      { icon: '🅱️', title: 'Alliteration', text: 'Two or more words starting with the letter score 2, like “Big Blue Banana”. Five scoring answers in a row: 🔥 +1.' },
      { icon: '👎', title: 'Challenge', text: 'Something fishy? Challenge an answer and the room votes on whether it counts.', phone: 'Tap 👎 to challenge. Then vote ✓ Counts or ✗ Nope.' },
      { icon: '⚡', title: 'Special rounds', text: 'Watch for Speed rounds, Theme rounds and the final Double Letter round: two letters, double points. Most points wins!' },
    ],
    theme: { accent: '#ffd23f', accent2: '#e63946', accent3: '#fff4dc', ink: '#f4f7ff', fade: '#0b1a33', rim: '#ffd23f', floor1: '#16305a', floor2: '#0b1a33', disc1: '#1d4e89', disc2: '#12274a',
      spots: ['255,244,220', '255,210,63', '191,224,255', '255,244,220'], confetti: ['#fff4dc', '#ffd23f', '#e63946', '#2ec4b6', '#bfe0ff', '#ff9f1c'] },
    host: null,
    lines: {
      welcome: 'One letter. One list. Every answer has to start with it.',
      roll: 'Tonight’s wordsmiths!', more: '…and {n} more!',
      play: 'Pencils ready… let’s play Letter Rush!',
      meet: 'Let’s meet the players.', others: 'And everyone else!',
    },
    stage, logo,
    castOpening: [
      { ms: 2600, sfx: [[0, 'whoosh'], [500, 'pop'], [700, 'pop'], [900, 'pop'], [1100, 'pop'], [1300, 'pop'], [1500, 'pop'], [1800, 'swell']],
        draw(g, s) {
          s.cam(960, lerp(620, 520, ease(s.k)), lerp(1.15, 1, ease(s.k)));
          stage(g, s, { logo: ss(300, 2200, s.T), lights: 0.4 + 0.6 * ss(0, 1200, s.T) });
        } },
      { ms: 2600, sfx: [[0, 'diceRoll'], [1500, 'drum']], say: 'welcome', sayAt: 200, fit: 3400,
        draw(g, s) {
          s.cam(960, 560, 1.05);
          stage(g, s, {});
          const k = clamp(s.T / 1500), e = easeOut(k), spin = 1 - e;
          const x = lerp(-200, 960, e), hop = k < 1 ? Math.abs(Math.sin(k * Math.PI * 3)) * (1 - k) * 340 : 0;
          die(g, x, 560 - hop, 170, -0.3 - spin * 9, 0.42 + spin * 7, spin * 2.5, ['B', 'K', 'S', 'M', 'T', 'P']);
          if (s.T > 1500) { const q = back((s.T - 1500) / 350); g.strokeStyle = `rgba(255,210,63,${Math.max(0, 1 - (s.T - 1500) / 600)})`; g.lineWidth = 12; g.beginPath(); g.ellipse(960, 830, 200 + (s.T - 1500) * 0.5, 50 + (s.T - 1500) * 0.12, 0, 0, TAU); g.stroke();
            g.save(); g.translate(960, 230); g.scale(q, q); text(g, 'Your letter is B!', 0, 0, 96, '#ffd23f', { font: HW, stroke: '#0b1a33', lw: 12 }); g.restore(); }
        } },
      { ms: 2600, sfx: [[400, 'pop'], [900, 'chime'], [1400, 'pop'], [1900, 'chime']],
        draw(g, s) {
          s.cam(960, lerp(560, 600, ease(s.k)), lerp(1.02, 1.12, ease(s.k)));
          desk(g, s, 1); rain(g, s, 0.5);
          pad(g, 960, 600, 1100, 820, 0.02, 'Starts with B');
          g.save(); g.translate(960, 600); g.rotate(0.02);
          ANS.forEach(([cat, ans, mark, col], i) => {
            const y = -230 + i * 140, t0 = i * 480;
            text(g, `${i + 1}. ${cat}`, -440, y - 20, 34, '#3a3870', { font: BODY, align: 'left' });
            const typed = Math.max(0, Math.min(ans.length, Math.floor((s.T - t0) / 40)));
            if (typed) text(g, ans.slice(0, typed), -400, y + 36, 62, '#1f4fbf', { font: HW, align: 'left' });
            const q = back((s.T - t0 - 380) / 260);
            if (q > 0) { g.save(); g.translate(380, y + 30); g.rotate(-0.2); g.scale(q, q); g.strokeStyle = col; g.lineWidth = 6; rr(g, -100, -36, 200, 72, 12); g.stroke(); text(g, mark, 0, 2, mark === 'MATCH' ? 38 : 46, col, { font: BUN }); g.restore(); }
          });
          g.restore();
        } },
    ],
    // The roll call: each player drops in as a letter tile (their initial) with their avatar.
    roll(g, s, F, u, per, o = {}) {
      s.cam(960, 540, 1); desk(g, s, 1); rain(g, s, 0.35);
      text(g, 'Tonight’s wordsmiths', 960, 140, 96, '#ffd23f', { font: BUN, stroke: '#0b1a33', lw: 12 });
      const n = F.length, cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / Math.max(1, cols)), gap = Math.min(280, 1640 / Math.max(1, cols));
      F.forEach((c, i) => {
        const at = i * per; if (u < at) return;
        const k = clamp((u - at) / 520), col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
        const x = 960 + (col - (rowN - 1) / 2) * gap, y = rows > 1 ? 430 + row * 340 : 560, size = Math.min(200, gap * 0.72) * (rows > 1 ? 0.9 : 1);
        const q = back(k), L = (String(c.name || '?').match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase();
        tile(g, x, y - (1 - q) * 600, size, (1 - q) * (i % 2 ? 1 : -1) + Math.sin(s.t * 2 + i) * 0.04, L, { glow: k >= 1 ? '#ffd23f' : null });
        if (k > 0.5) { s.face(c, x + size * 0.42, y - size * 0.42, size * 0.42); text(g, c.name, x, y + size * 0.72, 44, '#fff', { font: BODY, stroke: '#0b1a33', lw: 8, max: gap * 0.95 }); }
      });
      if (o.more && u > n * per - 1400) text(g, `…and ${o.more} more!`, 960, 1010, 56, '#ffd23f', { font: BUN, stroke: '#0b1a33', lw: 10 });
    },
  };
})();
