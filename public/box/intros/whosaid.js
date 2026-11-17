'use strict';
// Who Said It? intro: whispers in the dark. A starry indigo night fades up, "psst…" lines
// pass between a crowd of silhouettes, pastel speech bubbles float up with anonymous secrets,
// one silhouette is caught ("?" then "!" as it lights up mint) and the sleepy crescent moon,
// who narrates, keeps everybody's secrets. Cast mode: opening, roll call, "Let's play".
// Engine + API: public/box/show.js.
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, TAU } = ST.util, { rr, text } = ST.draw;
  const CB = '"Caveat Brush", "Lilita One", cursive';
  const BUB = ['#fff3b0', '#c8f7e8', '#ffd6ec', '#e3d6ff', '#cfe9ff', '#ffe0c2'];
  const RIM = ['#9b7bff', '#7ef3d0', '#ff7ac8', '#ffd36e', '#6ec8ff'];
  const SAYS = ['I talk to my plants', 'I cried at a cartoon', 'I can’t ride a bike', 'I’m scared of ducks', 'I named my car Gerald', 'psst… it was me'];
  const R = rng(321);
  const STARS = Array.from({ length: 140 }, () => [R() * 2400 - 240, R() * 760, 0.8 + R() * 2.2, R() * TAU]);
  const CROWD = Array.from({ length: 14 }, (_, i) => ({ x: -40 + i * 150 + R() * 40, s: 0.85 + R() * 0.35, ph: R() * TAU, rim: RIM[i % RIM.length], style: (i * 3) % 4 }));
  try { if (document.fonts) document.fonts.load('40px "Caveat Brush"'); } catch { /* fine */ }

  function sky(g, s, lights) {
    const gr = g.createLinearGradient(0, -300, 0, 1080); gr.addColorStop(0, '#0c0628'); gr.addColorStop(0.55, '#2a1663'); gr.addColorStop(1, '#3b2a7a');
    g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    const hz = g.createRadialGradient(960, 1250, 0, 960, 1250, 1100); hz.addColorStop(0, 'rgba(126,243,208,0.4)'); hz.addColorStop(1, 'rgba(126,243,208,0)'); g.fillStyle = hz; g.fillRect(-600, -300, 3120, 1700);
    for (const [x, y, r, p] of STARS) { g.globalAlpha = (0.3 + 0.6 * Math.abs(Math.sin(s.t * 1.3 + p))) * lights; g.fillStyle = '#fffbe0'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
  }
  const moons = new Map();
  function crescent(r) { // a disc with a bite taken out, drawn once per size
    let c = moons.get(r); if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = Math.ceil(r * 2); const m = c.getContext('2d');
    m.fillStyle = '#fff2c4'; m.beginPath(); m.arc(r, r, r, 0, TAU); m.fill(); m.globalCompositeOperation = 'destination-out'; m.beginPath(); m.arc(r * 1.62, r * 0.78, r * 0.84, 0, TAU); m.fill();
    moons.set(r, c); return c;
  }
  function moon(g, x, y, r, talk, blink) {
    g.save(); g.translate(x, y);
    const glow = g.createRadialGradient(0, 0, r * 0.5, 0, 0, r * 2.2); glow.addColorStop(0, 'rgba(255,242,196,0.3)'); glow.addColorStop(1, 'rgba(255,242,196,0)'); g.fillStyle = glow; g.beginPath(); g.arc(0, 0, r * 2.2, 0, TAU); g.fill();
    g.drawImage(crescent(r), -r, -r, r * 2, r * 2);
    // sleepy eye + mouth on the crescent's inner edge
    g.strokeStyle = '#6a4e9e'; g.lineWidth = r * 0.07; g.lineCap = 'round';
    g.beginPath(); if (blink > 0.5) { g.moveTo(-r * 0.62, -r * 0.2); g.lineTo(-r * 0.36, -r * 0.2); } else g.arc(-r * 0.5, -r * 0.24, r * 0.13, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = '#6a4e9e'; g.beginPath(); g.ellipse(-r * 0.5, r * 0.32, r * 0.14, r * (0.03 + talk * 0.12), 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,140,170,0.35)'; g.beginPath(); g.arc(-r * 0.72, r * 0.1, r * 0.1, 0, TAU); g.fill();
    g.restore();
  }
  function silhouette(g, x, y, sc, rim, style, lit, look) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    if (lit > 0) { g.fillStyle = `rgba(126,243,208,${0.14 * lit})`; g.beginPath(); g.arc(0, -60, 110, 0, TAU); g.fill(); }
    g.fillStyle = '#140a30'; g.strokeStyle = lit > 0 ? '#7ef3d0' : rim; g.lineWidth = 5 + lit * 4;
    g.beginPath(); g.ellipse(0, 0, 92, 86, 0, Math.PI, TAU); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(0, -132, 50, 0, TAU); g.fill(); g.stroke();
    if (style === 1) { g.beginPath(); g.arc(0, -188, 20, 0, TAU); g.fill(); g.stroke(); }
    else if (style === 2) { g.beginPath(); g.ellipse(0, -164, 58, 11, 0, 0, TAU); g.fill(); g.stroke(); rr(g, -34, -214, 68, 54, 8); g.fill(); g.stroke(); }
    else if (style === 3) { g.beginPath(); g.arc(44, -120, 19, 0, TAU); g.fill(); g.stroke(); }
    g.fillStyle = lit > 0 ? '#fff' : 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(-16 + look, -136, 7, 9, 0, 0, TAU); g.ellipse(16 + look, -136, 7, 9, 0, 0, TAU); g.fill();
    g.restore();
  }
  function bubble(g, x, y, str, col, k, tail) {
    if (k <= 0) return;
    g.save(); g.font = `46px ${CB}`; const w = g.measureText(str).width + 60, h = 84, sc = 0.5 + 0.5 * back(Math.min(1, k * 1.5));
    g.translate(x, y); g.scale(sc, sc); g.globalAlpha = Math.min(1, k * 3);
    g.fillStyle = 'rgba(10,4,30,0.35)'; rr(g, -w / 2 + 6, -h / 2 + 8, w, h, 36); g.fill();
    g.fillStyle = col; rr(g, -w / 2, -h / 2, w, h, 36); g.fill();
    g.beginPath(); g.moveTo(tail - 16, h / 2 - 2); g.lineTo(tail + 16, h / 2 - 2); g.lineTo(tail - 4, h / 2 + 30); g.closePath(); g.fill();
    text(g, str, 0, 3, 46, '#2b0a3d', { font: CB });
    g.restore(); g.globalAlpha = 1;
  }
  function crowd(g, s, o) {
    for (let i = 0; i < CROWD.length; i++) {
      const c = CROWD[i], bob = Math.sin(s.t * 1.4 + c.ph) * 4, look = Math.sin(s.t * 0.9 + c.ph * 3) * 8;
      silhouette(g, c.x, 1100 + bob, c.s, c.rim, c.style, o.lit === i ? o.litK : 0, look);
    }
  }
  function stage(g, s, o = {}) {
    sky(g, s, o.lights == null ? 1 : o.lights);
    if (o.host !== false) s.host(-3000, -3000, 0.01);
    const A = s.intro && s.intro._anim;
    moon(g, 1560, 230, 120, A ? A.talk : 0, (s.t % 4.2) < 0.15 ? 1 : 0);
    if (o.logo !== 0) { g.save(); g.translate(960, 300); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
    if (!o.bare) crowd(g, s, o);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(4,2,14,${(1 - o.lights) * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
  }
  function logo(g, s, lit) {
    const k = Math.min(1, lit), sc = 0.6 + 0.4 * back(k);
    g.save(); g.scale(sc, sc); g.globalAlpha = Math.min(1, k * 1.4);
    g.save(); g.rotate(-0.06); text(g, 'Who Said', -150, -10, 170, '#fdf3ff', { font: CB, stroke: '#4b2a8f', lw: 16 }); g.restore();
    g.save(); g.rotate(0.05); text(g, 'It', 320, 10, 190, '#7ef3d0', { font: CB, stroke: '#1d5e63', lw: 16 }); g.restore();
    g.save(); g.translate(440, 20); g.rotate(Math.sin(s.t * 2) * 0.2); text(g, '?', 0, 0, 240, '#ff7ac8', { font: CB, stroke: '#8a1f5c', lw: 16 }); g.restore();
    g.restore(); g.globalAlpha = 1;
  }


  // Roll call layout: one or two rows of slots across the 1920x1080 world.
  function slots(n, w) { const cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / Math.max(1, cols)), tw = Math.min(w, 1640 / Math.max(1, cols)); return (i) => { const r = Math.floor(i / cols), rowN = r === rows - 1 ? n - r * cols : cols; return { x: 960 + ((i % cols) - (rowN - 1) / 2) * tw, row: r, rows, tw }; }; }

  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1); sky(g, s, 1); s.host(-3000, -3000, 0.01); const A = BOX.intros.whosaid._anim; moon(g, 1660, 170, 90, A ? A.talk : 0, 0);
    text(g, 'Tonight’s whisperers', 900, 150, 110, '#7ef3d0', { font: CB, stroke: '#1d5e63', lw: 12 });
    const at = slots(F.length, 240);
    F.forEach((c, i) => {
      const p = at(i), lit = ss(i * per, i * per + 400, u), sc = Math.min(1, p.tw / 240) * (p.rows > 1 ? 0.95 : 1.25), y = p.rows > 1 ? 560 + p.row * 380 : 820;
      g.save(); g.globalAlpha = 0.35 + 0.65 * Math.min(1, lit * 2);
      silhouette(g, p.x, y, sc, c.color || RIM[i % RIM.length], 0, lit, 0);
      if (lit > 0) s.emoji(c.avatar || '🙂', p.x, y - 132 * sc, 70 * sc * back(lit));
      g.restore();
      if (lit > 0) bubble(g, p.x, y - 260 * sc, c.name, BUB[i % BUB.length], lit, 0);
    });
    if (o.more && u > F.length * per - 1400) text(g, '…and ' + o.more + ' more in the crowd!', 960, 1040, 60, '#fdf3ff', { font: CB });
  }
  BOX.intros.whosaid = {
    title: 'Who Said It?',
    // How to play (box/howto.js): one card per step, 5 steps (module howSteps).
    tutorial: [
      { icon: '🌙', title: 'The question', text: 'A question goes up on the big screen. Everyone answers in secret: nobody sees whose answer is whose.', phone: 'Type your answer, then tap Whisper it 🤫.' },
      { icon: '🔦', title: 'The spotlight', text: 'Answers go into the spotlight one at a time. Guess who wrote each one.', phone: 'Tap the name of who you think said it.' },
      { icon: '💯', title: 'Scoring', text: 'Right guess: +100, and +50 more if you were one of the fastest. Three right in a row: 🔥 +50.' },
      { icon: '🎭', title: 'Poker face', text: 'When it’s your answer, don’t give yourself away! You get +50 for everyone you fool.' },
      { icon: '🎲', title: 'Double Down', text: 'Once a game, Double Down: double points if you’re right, −50 if you’re wrong. Most points wins!', phone: 'Tap 🎲 Double Down, then tap a name.' },
    ],
    theme: { accent: '#9b7bff', accent2: '#7ef3d0', accent3: '#7ef3d0', ink: '#fdf3ff', fade: '#0c0628', rim: '#9b7bff', floor1: '#2a1663', floor2: '#120a34', disc1: '#3b2a7a', disc2: '#1c0f45',
      spots: ['200,180,255', '126,243,208', '255,122,200', '200,180,255'], confetti: ['#fff3b0', '#c8f7e8', '#ffd6ec', '#e3d6ff', '#7ef3d0', '#ff7ac8'] },
    host: {
      name: 'The Moon',
      voice: { like: /female|zira|aria|jenny|samantha|hazel|libby|sonia/i, accent: /en-(GB|US)/i, pitch: 1.05, rate: 0.95 },
      // The moon is drawn by the set; the host figure itself stays out of frame.
      draw(g, a) { BOX.intros.whosaid._anim = a; },
    },
    lines: {
      welcome: 'Psst… everybody here has a secret. Answer in a whisper, then guess who said what.',
      roll: 'Tonight’s whisperers…', more: '…and {n} more in the crowd!',
      play: 'Shhh… let’s play Who Said It!',
      meet: 'Let’s meet the crowd.', joke: 'I see everything at night. I’m very good at this game.', banter: ['Whisper it on your phone…'],
      first: 'First, {name}', intros: ['And {name}', 'Here’s {name}'], last: 'And finally, {name}', noFact: 'a total mystery.', others: 'And everyone else!',
    },
    stage, logo, roll,
    podium() {},
    // Keep the moon talking: the engine draws the host each frame to update its animation.
    hostCam: { x: 960, y: 540, z: 1 },
    castOpening: [
      { ms: 2400, sfx: [[0, 'night'], [700, 'wind']],
        draw(g, s) {
          s.cam(960, lerp(700, 600, ease(s.k)), 1.15 - 0.1 * ease(s.k)); s.host(-2000, -2000, 0.01);
          stage(g, s, { logo: 0, lights: 0.25 + 0.75 * ss(0, 1600, s.T), lit: -1 });
          // whispers passing between neighbours
          for (let i = 0; i < 4; i++) {
            const a = CROWD[2 + i * 3], b = CROWD[3 + i * 3]; if (!a || !b) continue;
            const k = ss(300 + i * 350, 900 + i * 350, s.T); if (k <= 0) continue;
            g.save(); g.globalAlpha = Math.min(1, k * 2) * (1 - ss(1900, 2400, s.T)); g.strokeStyle = '#fdf3ff'; g.lineWidth = 5; g.setLineDash([4, 16]); g.lineDashOffset = -s.t * 60;
            g.beginPath(); g.moveTo(a.x, 950); g.quadraticCurveTo((a.x + b.x) / 2, 780, b.x, 950); g.stroke(); g.setLineDash([]);
            text(g, 'psst…', (a.x + b.x) / 2, 790 - k * 20, 48, '#fdf3ff', { font: CB }); g.restore();
          }
        } },
      { ms: 2400, sfx: [[100, 'pop'], [700, 'pop'], [1300, 'pop']], say: 'welcome', sayAt: 50, fit: 4600,
        draw(g, s) {
          s.cam(960, 560, 1); s.host(-2000, -2000, 0.01);
          stage(g, s, { logo: 0, lit: -1 });
          SAYS.forEach((str, i) => { const k = (s.T - i * 260) / 900; if (k <= 0) return; const c = CROWD[1 + i * 2]; bubble(g, Math.max(260, Math.min(1660, c.x)), 900 - Math.min(1, k) * 160 - Math.max(0, k - 1) * 120 - (i % 2) * 120, str, BUB[i % BUB.length], k, Math.max(-60, Math.min(60, c.x - Math.max(260, Math.min(1660, c.x))))); });
        } },
      { ms: 2400, sfx: [[500, 'drum'], [1200, 'chime']],
        draw(g, s) {
          const k = ease(s.T / 1800); s.cam(960, lerp(620, 540, k), lerp(1.2, 1, k)); s.host(-2000, -2000, 0.01);
          const lit = ss(1150, 1450, s.T);
          stage(g, s, { logo: ss(1300, 2100, s.T), lit: 6, litK: lit });
          const c = CROWD[6], qk = ss(200, 500, s.T);
          if (qk > 0) { g.save(); g.translate(c.x, 1100 - 330 * c.s + Math.sin(s.t * 4) * 6); const p = lit > 0 ? back(lit) : back(qk); g.scale(p, p); text(g, lit > 0 ? '!' : '?', 0, 0, 150, lit > 0 ? '#7ef3d0' : '#ff7ac8', { font: CB, stroke: '#140a30', lw: 12 }); g.restore(); }
        } },
    ],
  };
})();
