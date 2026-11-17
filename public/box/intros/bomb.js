'use strict';
// Bomb Squad intro: a red beacon spins in the dark disposal HQ while a teleprinter types out the
// call-out, the camera pushes in on a ticking cartoon bomb under the work lamp, then the
// BOMB SQUAD stencil slams down between sliding hazard tape. Roll call: the squad lines up
// behind the tape in hard hats. No host: a narrator reads the lines. Engine: public/box/show.js.
// Phones load this file for the HOW TO PLAY tutorial without the engine, so nothing here touches
// BOX.studio at load time.
(function () {
  BOX.intros = BOX.intros || {};
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const back = (t) => { t = clamp(t); const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const STEN = '"Black Ops One", "Bungee", sans-serif', TYPE = '"Special Elite", "Courier New", monospace', DIGI = '"Press Start 2P", monospace';
  try { if (document.fonts) { document.fonts.load('40px "Black Ops One"'); document.fonts.load('40px "Special Elite"'); document.fonts.load('20px "Press Start 2P"'); } } catch { /* fine */ }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function txt(g, str, x, y, px, fill, o = {}) {
    g.font = `${px}px ${o.font || STEN}`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
    if (o.max) { const w = g.measureText(str).width; if (w > o.max) { px *= o.max / w; g.font = `${px}px ${o.font || STEN}`; } }
    if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.lw || px * 0.16; g.strokeStyle = o.stroke; g.strokeText(str, x, y); }
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = px * 0.5; }
    g.fillStyle = fill; g.fillText(str, x, y); g.shadowBlur = 0;
  }
  function tape(g, y, h, off) {
    g.save(); g.beginPath(); g.rect(-600, y, 3120, h); g.clip();
    g.fillStyle = '#15151a'; g.fillRect(-600, y, 3120, h);
    for (let x = -700 + (off % 80); x < 2600; x += 80) { g.fillStyle = '#ffcc1a'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40, y); g.lineTo(x + 40 - h, y + h); g.lineTo(x - h, y + h); g.closePath(); g.fill(); }
    g.restore();
  }
  function wall(g, t, beacon) {
    let gr = g.createRadialGradient(960, 420, 50, 960, 540, 1300); gr.addColorStop(0, '#1f3054'); gr.addColorStop(1, '#060a14'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    g.strokeStyle = 'rgba(140,180,255,0.08)'; g.lineWidth = 2;
    for (let x = -600; x < 2600; x += 60) { g.beginPath(); g.moveTo(x, -300); g.lineTo(x, 1400); g.stroke(); }
    for (let y = -300; y < 1400; y += 60) { g.beginPath(); g.moveTo(-600, y); g.lineTo(2600, y); g.stroke(); }
    if (beacon) { // a rotating red beacon washes the room
      const a = t * 5; g.save(); g.globalCompositeOperation = 'lighter';
      for (const off of [0, Math.PI]) { gr = g.createRadialGradient(960, 120, 10, 960, 120, 1600); gr.addColorStop(0, `rgba(255,40,30,${0.4 * beacon})`); gr.addColorStop(1, 'rgba(255,40,30,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(960, 120); g.arc(960, 120, 2200, a + off - 0.35, a + off + 0.35); g.closePath(); g.fill(); }
      g.restore();
      g.fillStyle = '#5a0b07'; rr(g, 920, 70, 80, 70, 20); g.fill(); g.fillStyle = `rgba(255,${60 + 60 * Math.sin(t * 10)},40,1)`; g.beginPath(); g.arc(960, 100, 30, Math.PI, 0); g.fill();
    }
  }
  function bomb(g, x, y, R, t, o = {}) {
    g.save(); g.translate(x, y);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.ellipse(0, R * 0.98, R, R * 0.15, 0, 0, TAU); g.fill();
    if (o.shake) g.translate((Math.random() - 0.5) * o.shake, (Math.random() - 0.5) * o.shake);
    g.lineCap = 'round'; g.strokeStyle = '#1a120a'; g.lineWidth = R * 0.08; g.beginPath(); g.moveTo(0, -R * 0.98); g.bezierCurveTo(-R * 0.05, -R * 1.3, R * 0.3, -R * 1.45, R * 0.5, -R * 1.3); g.stroke();
    g.strokeStyle = '#d9b27a'; g.lineWidth = R * 0.045; g.stroke();
    const sx = R * 0.5, sy = -R * 1.3;
    g.fillStyle = 'rgba(255,200,80,0.35)'; g.beginPath(); g.arc(sx, sy, R * 0.14, 0, TAU); g.fill();
    g.fillStyle = '#fff3a0'; g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + t * 18, r = i % 2 ? R * 0.03 : R * 0.11; g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } g.closePath(); g.fill();
    for (let i = 0; i < 8; i++) { const a = t * 7 + i * 1.7, d = ((t * 3 + i * 0.13) % 1) * R * 0.3; g.fillStyle = '#ffd36b'; g.fillRect(sx + Math.cos(a) * d, sy + Math.sin(a) * d - d * 0.4, 5, 5); }
    g.fillStyle = '#3b3e4a'; g.strokeStyle = '#07070a'; g.lineWidth = R * 0.04; rr(g, -R * 0.24, -R * 1.08, R * 0.48, R * 0.22, R * 0.05); g.fill(); g.stroke();
    const gr = g.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.1, 0, 0, R * 1.1); gr.addColorStop(0, '#727689'); gr.addColorStop(0.35, '#2c2e38'); gr.addColorStop(1, '#09090d');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill(); g.lineWidth = R * 0.05; g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.beginPath(); g.ellipse(-R * 0.42, -R * 0.45, R * 0.25, R * 0.14, -0.7, 0, TAU); g.fill();
    ['#ff4a3d', '#3a8bff', '#ffd23f', '#3ccf6e'].forEach((c, i) => { const yy = R * 0.42 + i * R * 0.08; g.strokeStyle = '#07070a'; g.lineWidth = R * 0.06; g.beginPath(); g.moveTo(-R * 0.72, yy); g.quadraticCurveTo(0, yy + R * 0.14, R * 0.72, yy); g.stroke(); g.strokeStyle = c; g.lineWidth = R * 0.035; g.stroke(); });
    g.fillStyle = '#0b0b0f'; g.strokeStyle = '#3d4150'; g.lineWidth = R * 0.045; rr(g, -R * 0.62, -R * 0.3, R * 1.24, R * 0.56, R * 0.07); g.fill(); g.stroke();
    txt(g, o.led || '0:30', 0, -R * 0.02, R * 0.24, o.ledCol || '#ff3b30', { font: DIGI, glow: o.ledCol || '#ff3b30' });
    g.restore();
  }
  function logo(g, s, k) {
    const kk = back(clamp(k));
    g.save(); g.scale(kk, kk); g.rotate(-0.03);
    g.font = '170px ' + STEN; const wb = g.measureText('BOMB').width, wq = g.measureText('SQUAD').width, gap = 50, tot = wb + gap + wq, f = Math.min(1, 1500 / tot);
    g.scale(f, f);
    txt(g, 'BOMB', -tot / 2 + wb / 2, 0, 170, '#f2f4f8', { stroke: '#000', lw: 24 });
    txt(g, 'SQUAD', tot / 2 - wq / 2, 0, 170, '#ffcc1a', { stroke: '#3a2a00', lw: 24 });
    g.restore();
  }
  function stage(g, s, o = {}) {
    wall(g, s.t, o.beacon || 0);
    g.fillStyle = '#0a0d14'; g.fillRect(-600, 860, 3120, 600);
    tape(g, 860, 34, s.t * 60);
    // the workbench
    g.fillStyle = '#5a4128'; g.fillRect(560, 800, 800, 30); g.fillStyle = '#3a2a18'; g.fillRect(600, 830, 30, 60); g.fillRect(1290, 830, 30, 60);
    if (!o.bare) bomb(g, 960, 610, 190, s.t, { led: '1:45' });
    if (o.logo) { g.save(); g.translate(960, 230); logo(g, s, o.logo); g.restore(); }
  }

  BOX.intros.bomb = {
    title: 'Bomb Squad',
    // How to play (box/howto.js): one card per step, 6 steps (module howSteps: 6).
    tutorial: [
      { icon: '💣', title: 'One bomb, one defuser', text: 'Each round a bomb arrives. Only the DEFUSER can see it, on their phone. Nobody else can!', phone: 'Defuser? Describe everything on your bomb out loud: the plate, the wires, the pictures.', say: 'Each round a bomb arrives. Only the defuser can see it, on their phone. Nobody else can.' },
      { icon: '📖', title: 'Everyone else: the manual', text: 'Experts get DIFFERENT pages of the field manual. Each module’s rules are split between two experts, so the whole room has to talk.', phone: 'Expert? Flip through your pages, and ask the defuser what they see.' },
      { icon: '🔌', title: 'Six kinds of module', text: 'Fuse Lines, the Plunger, the Glyph Pad, the Tunnel Map, the Combination Dial and Signal Lamps. Make every module safe to defuse the bomb.', phone: 'Defuser: tap a module’s tab, then cut, tap, hold, press or steer.' },
      { icon: '✖', title: 'Strikes and BOOM', text: 'A wrong move is a strike and burns 15 seconds off the clock. Three strikes, or the timer hits 0:00, and it goes KA-BLAM!', phone: 'Your strikes show as ✖ ✖ ✖ at the top of the screen.' },
      { icon: '📻', title: 'It gets harder', text: 'Every bomb has more modules and less time. From bomb 3 the Radio asks for a callsign: answer it within 25 seconds. Big groups split into squads.' },
      { icon: '🏅', title: 'Scoring', text: 'The room shares one team score. You earn +150 for each module you solve, +100 for holding the right page, and +200 for every bomb your squad defuses.' },
    ],
    theme: { accent: '#ffcc1a', accent2: '#ff3b30', accent3: '#ffcc1a', ink: '#f2f4f8', fade: '#060a14', rim: '#ffcc1a', confetti: ['#ffcc1a', '#ff3b30', '#39e07a', '#3a8bff', '#ffffff'], spots: ['255,240,200', '255,120,100', '255,240,200', '200,220,255'] },
    host: null,
    lines: {
      welcome: 'Disposal unit, we have a call-out. A crate of very silly bombs just turned up at the town fair.',
      stakes: 'They’re ticking. They’re wired. And the only manual got torn into pieces.',
      roll: 'Suit up, squad.', more: '…and {n} more!',
      play: 'One of you sees the bomb. The rest of you read the manual. Talk fast, and cut carefully.',
    },
    stage, logo: (g, s, lit) => logo(g, s, lit || 1),
    castOpening: [
      { ms: 2800, sfx: [[0, 'siren'], [400, 'click'], [900, 'click']], say: 'welcome', sayAt: 200, fit: 4400,
        draw(g, s) {
          s.cam(960, 520, 1.05 + 0.05 * ease(s.k)); wall(g, s.t, 1);
          // the teleprinter
          g.fillStyle = '#d8d2c0'; rr(g, 560, 360, 800, 520, 24); g.fill(); g.lineWidth = 10; g.strokeStyle = '#2a2a30'; g.stroke();
          g.fillStyle = '#f6eed6'; g.fillRect(640, 200, 640, 360);
          const lines = ['** CALL-OUT · PRIORITY RED **', 'LOCATION: THE TOWN FAIR', 'ITEM: CRATE, TICKING', 'SEND: THE BOMB SQUAD'], shown = Math.floor(s.T / 26);
          let used = 0;
          lines.forEach((ln, i) => { const n = clamp(shown - used, 0, ln.length); used += ln.length + 6; if (n > 0) txt(g, ln.slice(0, n), 660, 250 + i * 70, 36, i === 0 ? '#c0262d' : '#23222a', { font: TYPE, align: 'left' }); });
          tape(g, 860, 34, s.t * 60);
        } },
      { ms: 2800, sfx: [[0, 'tick'], [1000, 'tick'], [2000, 'tick'], [500, 'heartbeat']], say: 'stakes', sayAt: 100, fit: 2700,
        draw(g, s) {
          const k = ease(s.k); s.cam(960, lerp(560, 600, k), lerp(1.0, 1.7, k));
          stage(g, s, { bare: true });
          const left = 30 - s.T / 1000 * 3;
          bomb(g, 960, 610, 190, s.t, { led: '0:' + String(Math.ceil(left)).padStart(2, '0'), shake: k * 6 });
          g.fillStyle = `rgba(0,0,0,${0.5 * (1 - k)})`; g.fillRect(-600, -300, 3120, 1700);
          const gr = g.createRadialGradient(960, 520, 100, 960, 560, 900); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.7)'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
        } },
      { ms: 2400, sfx: [[0, 'boom'], [120, 'whoosh']],
        draw(g, s) {
          s.cam(960, 540, 1.02);
          stage(g, s, { logo: clamp((s.T - 120) / 500) });
          const sl = easeOut(s.T / 500); tape(g, lerp(-400, 95, sl), 40, s.t * 200); tape(g, lerp(1300, 345, sl), 40, -s.t * 200);
          if (s.T < 260) { g.fillStyle = `rgba(255,250,230,${0.85 * (1 - s.T / 260)})`; g.fillRect(-600, -300, 3120, 1700); }
          const k = back((s.T - 800) / 400); if (k > 0) { g.save(); g.translate(960, 965); g.scale(k, k); txt(g, 'SEE IT · READ IT · CUT IT', 0, 0, 46, '#f2f4f8', { font: TYPE, stroke: '#000', lw: 8 }); g.restore(); }
        } },
    ],
    // Roll call: the squad lines up behind the hazard tape in hard hats.
    roll(g, s, F, u, per, o = {}) {
      s.cam(960, 540, 1);
      wall(g, s.t, 0.35);
      g.fillStyle = '#0a0d14'; g.fillRect(-600, 860, 3120, 600);
      txt(g, 'THE SQUAD', 960, 120, 96, '#ffcc1a', { stroke: '#000', lw: 16 });
      txt(g, 'reporting for duty', 960, 200, 40, '#f2f4f8', { font: TYPE });
      const n = F.length, cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / Math.max(1, cols)), gap = Math.min(270, 1600 / Math.max(1, cols));
      F.forEach((c, i) => {
        const at = i * per, k = (u - at) / 520; if (k <= 0) return;
        const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
        const x = 960 + (col - (rowN - 1) / 2) * gap + (row % 2 ? gap * 0.25 : 0), yEnd = (rows > 1 ? 470 : 600) + row * 250, R = rows > 1 ? 72 : 92;
        const y = lerp(1300, yEnd, easeOut(k)) - Math.abs(Math.sin(s.t * 3 + i)) * 6;
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.ellipse(x, yEnd + R * 1.05, R * 0.9, R * 0.18, 0, 0, TAU); g.fill();
        g.fillStyle = c.color || '#ffcc1a'; g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill(); g.lineWidth = 8; g.strokeStyle = '#0b0b0f'; g.stroke();
        s.emoji(c.avatar || '🙂', x, y + 6, R * 1.15);
        // hard hat
        g.fillStyle = '#ffcc1a'; g.strokeStyle = '#3a2a00'; g.lineWidth = 6; g.beginPath(); g.arc(x, y - R * 0.55, R * 0.78, Math.PI, 0); g.closePath(); g.fill(); g.stroke();
        rr(g, x - R * 1.0, y - R * 0.6, R * 2.0, R * 0.2, R * 0.08); g.fill(); g.stroke();
        g.fillStyle = '#ff3b30'; g.beginPath(); g.arc(x, y - R * 1.2, R * 0.13, 0, TAU); g.fill();
        if (k >= 1) txt(g, c.name, x, yEnd + R + 34, 36, '#fff', { font: '"Fredoka", sans-serif', stroke: '#0b0b0f', lw: 7, max: gap * 0.9 });
      });
      tape(g, 900, 46, s.t * 60);
      if (o.more && u > n * per - 1400) txt(g, `…and ${o.more} more!`, 960, 1010, 54, '#ffcc1a', { stroke: '#000', lw: 10 });
    },
  };
})();
