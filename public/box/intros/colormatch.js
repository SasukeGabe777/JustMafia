'use strict';
// Color Match intro: a dark paint studio. The lights come up on an easel, three drops of paint
// (red, yellow, blue) splat onto the blank canvas and the logo appears. The host, Hugo Hue (a
// chatty artist's palette in a beret), says hello. Then the canvas flashes a colour, counts down
// and wipes it away: "Remember it!". Roll call: everyone's paint chip is pinned to the studio wall.
// Engine + API: public/box/show.js.
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, TAU, clamp } = ST.util, { rr } = ST.draw;
  const FONT = '"Lilita One", "Fredoka", sans-serif', BODY = '"Fredoka", sans-serif';
  const INK = '#16161b';
  const PAINT = ['#ff4f5e', '#ff8c42', '#ffd23f', '#3fd17a', '#3ee6ff', '#3ea6ff', '#8b6bff', '#ff4f9a'];
  const r0 = rng(77);
  const WALL_SPLATS = Array.from({ length: 14 }, (_, i) => ({ x: r0() * 1920, y: 80 + r0() * 640, r: 20 + r0() * 50, c: PAINT[i % PAINT.length], n: 7 + Math.floor(r0() * 5), s: r0() * 100 }));
  const CX = 960, CY = 450, CW = 660, CH = 470; // the canvas on the easel
  const txt = (g, str, x, y, px, fill, font = FONT, stroke) => {
    g.font = `${px}px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (stroke) { g.lineJoin = 'round'; g.lineWidth = px * 0.16; g.strokeStyle = stroke; g.strokeText(str, x, y); }
    g.fillStyle = fill; g.fillText(str, x, y);
  };
  function splat(g, x, y, r, c, n, seed, k = 1) {
    if (k <= 0) return;
    const rnd = rng(seed * 97 + 13); g.fillStyle = c; g.beginPath();
    const lobes = Array.from({ length: n }, (_, i) => ({ a: (i / n) * TAU + rnd() * 0.4, l: 0.75 + rnd() * 0.5 }));
    lobes.forEach((lb, i) => {
      const R = r * k * lb.l, px = x + Math.cos(lb.a) * R, py = y + Math.sin(lb.a) * R;
      if (!i) g.moveTo(px, py); else { const m = (lobes[i - 1].a + lb.a) / 2; g.quadraticCurveTo(x + Math.cos(m) * r * k * 0.55, y + Math.sin(m) * r * k * 0.55, px, py); }
    });
    g.closePath(); g.fill();
    for (let i = 0; i < 6; i++) { const a = rnd() * TAU, d = r * k * (1.3 + rnd() * 1.2); g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.08 + rnd() * 0.1), 0, TAU); g.fill(); }
  }
  function wall(g, s) {
    const gr = g.createLinearGradient(0, -300, 0, 900); gr.addColorStop(0, '#2b2b32'); gr.addColorStop(1, '#1c1c21');
    g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    g.globalAlpha = 0.5; for (const w of WALL_SPLATS) splat(g, w.x, w.y, w.r, w.c, w.n, w.s); g.globalAlpha = 1;
    // floorboards
    const fl = g.createLinearGradient(0, 860, 0, 1400); fl.addColorStop(0, '#6b4a2e'); fl.addColorStop(1, '#3b2818');
    g.fillStyle = fl; g.fillRect(-600, 860, 3120, 600);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; for (let x = -600; x < 2600; x += 140) { g.beginPath(); g.moveTo(x, 860); g.lineTo(x - 120, 1400); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-600, 852, 3120, 12);
    // paint drips on the floor
    g.globalAlpha = 0.8; splat(g, 420, 960, 34, '#3ee6ff', 8, 3); splat(g, 1380, 1010, 26, '#ff4f9a', 7, 4); g.globalAlpha = 1;
  }
  function pots(g) {
    const P = [[260, 900, '#ff4f5e'], [360, 920, '#ffd23f'], [1660, 910, '#3ea6ff'], [1770, 930, '#3fd17a']];
    for (const [x, y, c] of P) {
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y + 62, 60, 14, 0, 0, TAU); g.fill();
      const tin = g.createLinearGradient(x - 50, 0, x + 50, 0); tin.addColorStop(0, '#9a9aa4'); tin.addColorStop(0.5, '#e8e8ee'); tin.addColorStop(1, '#8a8a94');
      g.fillStyle = tin; rr(g, x - 50, y - 20, 100, 80, 8); g.fill();
      g.fillStyle = c; g.beginPath(); g.ellipse(x, y - 20, 50, 14, 0, 0, TAU); g.fill();
      g.fillStyle = c; rr(g, x - 50, y - 20, 22, 40, 10); g.fill(); // a drip down the side
      g.fillStyle = '#fff'; rr(g, x - 30, y + 10, 60, 30, 4); g.fill(); g.fillStyle = c; rr(g, x - 22, y + 16, 44, 18, 3); g.fill();
    }
  }
  function easel(g) {
    g.strokeStyle = '#8a5a2e'; g.lineCap = 'round'; g.lineWidth = 26;
    g.beginPath(); g.moveTo(CX - 200, 900); g.lineTo(CX - 40, 140); g.moveTo(CX + 200, 900); g.lineTo(CX + 40, 140); g.moveTo(CX, 160); g.lineTo(CX, 920); g.stroke();
    g.fillStyle = '#a8703c'; rr(g, CX - CW / 2 - 30, CY + CH / 2 - 6, CW + 60, 26, 8); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.4)'; rr(g, CX - CW / 2 + 10, CY - CH / 2 + 16, CW, CH, 6); g.fill();
    g.fillStyle = '#fbfaf6'; rr(g, CX - CW / 2, CY - CH / 2, CW, CH, 6); g.fill();
  }
  function logo(g, s, lit) {
    g.save(); g.globalAlpha = clamp(lit);
    const L = 'Color Match'.split(''), cols = ['#ff4f5e', '#ff8c42', '#e0a800', '#2bb866', '#16b8d4', '', '#3ea6ff', '#8b6bff', '#ff4f9a', '#ff8c42', '#e0a800'];
    g.font = `128px ${FONT}`; const widths = L.map((ch) => g.measureText(ch).width), total = widths.reduce((a, b) => a + b, 0);
    let x = -total / 2;
    L.forEach((ch, i) => {
      const w = widths[i], bob = Math.sin(s.t * 3 + i * 0.6) * 6, k = back((lit * 1.6) - i * 0.06);
      if (ch !== ' ' && k > 0) { g.save(); g.translate(x + w / 2, bob); g.scale(k, k); txt(g, ch, 0, 0, 128, cols[i], FONT, INK); g.restore(); }
      x += w;
    });
    txt(g, 'See it · Remember it · Mix it', 0, 100, 34, INK, BODY);
    g.restore();
  }
  // Hugo Hue: a wooden artist's palette with a face, a beret and a brush.
  function hostDraw(g, a) {
    const t = a.t, bob = Math.sin(t * 2.2) * 4;
    g.save(); g.translate(0, bob);
    // arms (thin, painterly) to the hands; the right hand holds a brush
    for (const sd of ['l', 'r']) {
      const m = sd === 'l' ? -1 : 1, [hx, hy] = a.hands[sd], sx = m * 140, sy = -170;
      g.strokeStyle = '#6b4a2e'; g.lineWidth = 16; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo((sx + hx) / 2 + m * 30, (sy + hy) / 2 + 30, hx, hy); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(hx, hy, 20, 0, TAU); g.fill(); g.strokeStyle = INK; g.lineWidth = 4; g.stroke();
      if (sd === 'r') {
        g.save(); g.translate(hx, hy); g.rotate(-0.9 + Math.sin(t * 3) * 0.15);
        g.fillStyle = '#c8963e'; rr(g, -6, -110, 12, 120, 6); g.fill(); g.fillStyle = '#c0c0c8'; rr(g, -8, -132, 16, 26, 3); g.fill();
        g.fillStyle = PAINT[Math.floor(t / 2) % PAINT.length]; g.beginPath(); g.moveTo(-8, -132); g.quadraticCurveTo(0, -176, 8, -132); g.fill();
        g.restore();
      }
    }
    // the palette body (kidney shape) with a thumb hole
    g.save(); g.translate(0, -200);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(10, 14, 170, 135, 0, 0, TAU); g.fill();
    const wood = g.createLinearGradient(-170, -130, 170, 130); wood.addColorStop(0, '#e9c48a'); wood.addColorStop(1, '#c8965a');
    g.fillStyle = wood; g.beginPath(); g.ellipse(0, 0, 170, 135, 0, 0, TAU); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#8a5a2e'; g.stroke();
    g.fillStyle = '#5a3a1e'; g.beginPath(); g.ellipse(-112, 52, 22, 17, 0.3, 0, TAU); g.fill();
    // paint blobs round the rim
    [[-120, -40], [-80, -96], [-10, -112], [66, -100], [122, -56], [138, 18], [100, 82]].forEach(([x, y], i) => { g.fillStyle = PAINT[i]; g.beginPath(); g.ellipse(x, y, 24, 19, i, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.4)'; g.beginPath(); g.arc(x - 7, y - 6, 5, 0, TAU); g.fill(); });
    // face
    const lx = a.look * 6;
    if (a.blink < 0.5) { g.strokeStyle = INK; g.lineWidth = 7; g.beginPath(); g.moveTo(-58, 0); g.lineTo(-22, 0); g.moveTo(22, 0); g.lineTo(58, 0); g.stroke(); }
    else {
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-40, 0, 24, 28, 0, 0, TAU); g.ellipse(40, 0, 24, 28, 0, 0, TAU); g.fill();
      g.lineWidth = 4; g.strokeStyle = INK; g.stroke();
      g.fillStyle = INK; g.beginPath(); g.arc(-38 + lx, 4, 11, 0, TAU); g.arc(42 + lx, 4, 11, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-34 + lx, -1, 4, 0, TAU); g.arc(46 + lx, -1, 4, 0, TAU); g.fill();
    }
    g.strokeStyle = INK; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-64, -40); g.quadraticCurveTo(-40, -52 - a.mouth * 6, -18, -40); g.moveTo(18, -40); g.quadraticCurveTo(40, -52 - a.mouth * 6, 64, -40); g.stroke();
    // moustache + mouth
    const open = a.mouth * 26;
    g.fillStyle = '#7a1f2b'; g.beginPath(); g.ellipse(0, 52, 30, 6 + open * 0.6, 0, 0, Math.PI); g.fill();
    g.fillStyle = INK; g.beginPath(); g.moveTo(0, 40); g.bezierCurveTo(-30, 26, -56, 44, -62, 30); g.bezierCurveTo(-50, 56, -14, 52, 0, 46); g.bezierCurveTo(14, 52, 50, 56, 62, 30); g.bezierCurveTo(56, 44, 30, 26, 0, 40); g.fill();
    g.fillStyle = 'rgba(255,90,110,0.35)'; g.beginPath(); g.arc(-74, 30, 14, 0, TAU); g.arc(74, 30, 14, 0, TAU); g.fill();
    g.restore();
    // beret
    g.save(); g.translate(-10, -330); g.rotate(-0.18);
    g.fillStyle = '#c2183d'; g.beginPath(); g.ellipse(0, 0, 110, 40, 0, 0, TAU); g.fill();
    g.fillStyle = '#9e1131'; g.beginPath(); g.ellipse(0, 18, 96, 16, 0, 0, Math.PI); g.fill();
    g.strokeStyle = INK; g.lineWidth = 6; g.beginPath(); g.moveTo(0, -38); g.lineTo(6, -60); g.stroke();
    g.restore();
    g.restore();
  }
  // A little paint cart in front of Hugo.
  function podium(g, s, x, y, sc) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 250, 200, 26, 0, 0, TAU); g.fill();
    g.fillStyle = '#ffffff'; rr(g, -170, 0, 340, 240, 18); g.fill();
    g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
    PAINT.forEach((c, i) => { g.fillStyle = c; rr(g, -150 + i * 38, 20, 32, 120, 6); g.fill(); });
    txt(g, 'HUGO HUE', 0, 186, 44, INK, FONT);
    g.restore();
  }
  function stage(g, s, o = {}) {
    wall(g, s);
    pots(g);
    easel(g);
    if (o.splat != null) {
      const T = o.splat;
      [[CX - 150, CY - 40, '#ff4f5e', 0], [CX + 160, CY - 60, '#ffd23f', 350], [CX, CY + 110, '#3ea6ff', 700]].forEach(([x, y, c, at], i) => {
        const fall = (T - at) / 420;
        if (fall < 0) return;
        if (fall < 1) { g.fillStyle = c; g.beginPath(); g.ellipse(x, lerp(-200, y, fall * fall), 16, 26, 0, 0, TAU); g.fill(); }
        else splat(g, x, y, 70, c, 9, i + 1, easeOut((T - at - 420) / 220));
      });
    }
    if (o.logo) { g.save(); g.translate(CX, CY - 20); logo(g, s, o.logo); g.restore(); }
    if (o.host !== false) s.hostAt(1560, 640, 0.82);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(10,10,14,${(1 - o.lights) * 0.9})`; g.fillRect(-600, -300, 3120, 1700); }
  }
  // The roll call: everyone's paint chip pinned to the wall.
  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1); wall(g, s); pots(g);
    g.globalAlpha = easeOut(u / 500); txt(g, 'Tonight’s colour crew!', 960, 120, 84, '#fff', FONT, INK); g.globalAlpha = 1;
    const n = F.length, cols = Math.min(n, 6), rows = Math.ceil(n / cols), cw = n > 6 ? 230 : 260, ch = cw * 1.25, gap = 40;
    const totalW = cols * cw + (cols - 1) * gap, sy = rows > 1 ? 230 : 320;
    F.forEach((c, i) => {
      const d = (u - i * per) / 500; if (d <= 0) return;
      const col = i % cols, row = Math.floor(i / cols), x = 960 - totalW / 2 + col * (cw + gap) + cw / 2, y = sy + row * (ch + 50);
      const k = back(d), sway = Math.sin(s.t * 2 + i) * 0.04 * (1 - clamp(d - 1));
      g.save(); g.translate(x, lerp(-300, y, Math.min(1, d * 1.2))); g.rotate(((i * 37) % 9 - 4) * 0.012 + sway); g.scale(k, k);
      g.fillStyle = 'rgba(0,0,0,0.4)'; rr(g, -cw / 2 + 8, 12, cw, ch, 12); g.fill();
      g.fillStyle = '#fff'; rr(g, -cw / 2, 0, cw, ch, 12); g.fill();
      g.fillStyle = c.color || PAINT[i % PAINT.length]; rr(g, -cw / 2 + 12, 12, cw - 24, ch * 0.66, 8); g.fill();
      s.face(c, 0, 12 + ch * 0.33, cw * 0.42);
      const nm = c.name.length > 12 ? c.name.slice(0, 11) + '…' : c.name;
      g.font = `${Math.round(cw * 0.16)}px ${FONT}`; let px = Math.round(cw * 0.16); while (g.measureText(nm).width > cw - 24 && px > 16) { px -= 2; g.font = `${px}px ${FONT}`; }
      txt(g, nm, 0, 12 + ch * 0.66 + ch * 0.14, px, INK, FONT);
      txt(g, String(c.color || '').toUpperCase(), 0, ch - 18, Math.round(cw * 0.08), '#5d5d68', BODY);
      g.fillStyle = '#ff4f5e'; g.beginPath(); g.arc(0, -4, 12, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(-4, -8, 4, 0, TAU); g.fill();
      g.restore();
    });
    if (o.more && u > n * per - 1400) txt(g, '…and ' + o.more + ' more!', 960, 1000, 54, '#ffd23f', FONT, INK);
  }
  BOX.intros.colormatch = {
    title: 'Color Match',
    // How to play (box/howto.js): one card per step, 5 steps (module howSteps).
    tutorial: [
      { icon: '👀', title: 'Watch', text: 'A colour flashes on the TV for about 3 seconds, sometimes as an apple, a car or a sky. Then it’s gone!', say: 'Watch closely! A colour appears for three seconds, sometimes as an apple, a car or a sky. Then, poof, it is gone!' },
      { icon: '🎨', title: 'Mix it', text: 'Mix the colour from memory. No peeking!', phone: 'Drag the hue bar, then the brightness pad. Tap 🔒 Lock it in.' },
      { icon: '📊', title: 'Match %', text: 'Your mix appears next to the real colour with a % match. Closer means more points, up to 1000.' },
      { icon: '🌀', title: 'Special rounds', text: 'Watch for Blink (1 second!), Two-Tone, Name It, Halfway There and Odd One Out.', phone: 'Odd One Out: tap the tile that looks different, fast!' },
      { icon: '🔥', title: 'Combos', text: 'A perfect match (96% or more) builds a combo bonus. The last round is worth double. Most points wins!' },
    ],
    theme: { accent: '#ffd23f', accent2: '#ff4f9a', accent3: '#3ee6ff', ink: '#ffffff', fade: '#141418', rim: '#ffffff',
      spots: ['255,240,200', '255,200,220', '200,240,255', '255,255,255'], confetti: PAINT },
    host: {
      name: 'Hugo Hue',
      voice: { kokoro: 'bm_fable', cb: 'warm', orpheus: 'dan', speed: 1.0, like: /guy|thomas|henri|paul|male|daniel/i, accent: /en-(GB|US)|fr/i, pitch: 1.05, rate: 1.0 },
      draw: hostDraw,
    },
    lines: {
      welcome: 'Bonjour, colour lovers! I am Hugo Hue. I show you a colour, you remember it, you mix it. Simple? Ha! We shall see.',
      roll: 'Here is tonight’s colour crew!', more: '…and {n} more!',
      play: 'Eyes open, brushes ready. Let’s play Color Match!',
    },
    stage, logo, podium, roll,
    hostCam: { x: 1500, y: 470, z: 1.75 },
    castOpening: [
      { ms: 2700, sfx: [[0, 'swell'], [420, 'pop'], [770, 'pop'], [1120, 'pop'], [1500, 'chime']],
        draw(g, s) {
          s.cam(960, lerp(560, 520, ease(s.k)), 1.18 - 0.12 * ease(s.k));
          stage(g, s, { host: false, splat: s.T, logo: ss(1350, 2100, s.T), lights: ss(0, 700, s.T) });
        } },
      { ms: 2200, sfx: [[0, 'whoosh']], pose: [[100, 'wave', 1800]], say: 'welcome', sayAt: 100, fit: 5200,
        draw(g, s) {
          const k = ease(s.T / 1400);
          s.cam(lerp(960, 1460, k), lerp(520, 470, k), lerp(1.06, 1.6, k));
          stage(g, s, { splat: 9999, logo: 1 });
        } },
      { ms: 2400, sfx: [[0, 'whoosh'], [500, 'tick'], [1000, 'tick'], [1500, 'tick'], [1950, 'poof']],
        draw(g, s) {
          s.cam(CX, CY + 20, 1.32);
          stage(g, s, { host: false });
          const c = PAINT[6], T = s.T;
          if (T < 1900) {
            const k = easeOut(T / 300);
            g.fillStyle = c; rr(g, CX - (CW / 2 - 20) * k, CY - (CH / 2 - 20) * k, (CW - 40) * k, (CH - 40) * k, 6); g.fill();
            txt(g, 'Remember it!', CX, CY - 60, 74, '#fff', FONT, INK);
            const n = 3 - Math.floor(clamp((T - 400) / 500, 0, 2.99));
            if (T >= 400) txt(g, String(n), CX, CY + 70, Math.max(30, 150 * back(((T - 400) % 500) / 250)), '#fff', FONT, INK);
          } else {
            const w = ease((T - 1900) / 350);
            g.fillStyle = c; rr(g, CX - CW / 2 + 20, CY - CH / 2 + 20, (CW - 40) * (1 - w), CH - 40, 6); g.fill();
            g.globalAlpha = w; txt(g, '?', CX, CY, 260, '#d8d8de', FONT); g.globalAlpha = 1;
          }
        } },
    ],
  };
})();
