'use strict';
// Where Do You Stand? intro: the sky is a scale. It starts as night, the sun rises on the left
// and the sky warms from sunrise to starry night across the screen. The host, Ollie (a night
// owl on a branch), says hello, then everyone drops onto a giant slider along the hills and
// slides to their spot; twins who land together get a heart.
// Engine + API: public/box/show.js.
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, TAU, clamp } = ST.util, { rr, text } = ST.draw;
  const FONT = '"Fredoka", "Nunito", sans-serif';
  const INK = '#3b2752', CREAM = '#fff9f0', CORAL = '#ff7a59';
  try { if (document.fonts) document.fonts.load('700 40px "Fredoka"'); } catch { /* fine */ }
  const r = rng(321);
  const STARS = Array.from({ length: 90 }, () => [r() * 2400 - 240, r() * 720, 1.5 + r() * 3, r() * TAU]);
  const CLOUDS = Array.from({ length: 5 }, (_, i) => [r() * 900 - 300, 120 + i * 90 + r() * 30, 0.8 + r() * 0.6, 10 + r() * 14]);
  const PEOPLE = [['#ff7a59', '#5a2a1a'], ['#ffc93c', '#3b2752'], ['#5fc9a8', '#2c1b10'], ['#6c8cff', '#f5d06b'], ['#ff7ab8', '#4a2a12'], ['#9a6bff', '#1b1630'], ['#4cc4ff', '#7a3b12'], ['#ffa94d', '#2a1a40'], ['#7fd862', '#5b3418']];
  const SPOTS = [0.08, 0.2, 0.2, 0.37, 0.52, 0.52, 0.7, 0.86, 0.86]; // pairs share a spot (twins)
  const X0 = 140, X1 = 1780, TY = 900;
  const bold = (g, str, x, y, px, fill) => { g.font = `700 ${px}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fill; g.fillText(str, x, y); };
  const trackGrad = (g) => { const gr = g.createLinearGradient(X0, 0, X1, 0); gr.addColorStop(0, '#ffc23d'); gr.addColorStop(0.5, '#ff7a8a'); gr.addColorStop(1, '#5b4fd8'); return gr; };

  function sky(g, s, dawn) {
    let gr = g.createLinearGradient(-300, 0, 2220, 0);
    const day = ['#ffe4a6', '#ffbe9a', '#f08fae', '#7e66c2', '#33307a', '#181645'];
    const night = ['#2a2a6a', '#262463', '#221f5a', '#1d1a50', '#191645', '#14123a'];
    const mix = (a, b, k) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const c = (sh) => Math.round(((pb >> sh) & 255) * k + ((pa >> sh) & 255) * (1 - k)); return `rgb(${c(16)},${c(8)},${c(0)})`; };
    day.forEach((c, i) => gr.addColorStop(i / 5, mix(night[i], c, dawn)));
    g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    // stars: everywhere at night, only on the night side by day
    g.fillStyle = '#fff8e0';
    for (const [x, y, rad, ph] of STARS) { const side = ss(700, 1500, x); g.globalAlpha = (1 - dawn + dawn * side) * (0.4 + 0.45 * Math.sin(s.t * 1.2 + ph)); g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    // the moon
    const mx = 1720, my = 170;
    g.fillStyle = 'rgba(255,248,210,0.14)'; g.beginPath(); g.arc(mx, my, 110, 0, TAU); g.fill();
    g.save(); g.beginPath(); g.rect(mx - 140, my - 140, 280, 280); g.arc(mx + 26, my - 14, 52, 0, TAU); g.clip('evenodd');
    g.fillStyle = '#fff3c4'; g.beginPath(); g.arc(mx, my, 60, 0, TAU); g.fill(); g.restore();
    // the sun, rising
    const sy = lerp(980, 250, easeOut(dawn)), sx = 300, sr = 96;
    g.fillStyle = 'rgba(255,240,170,0.32)'; g.beginPath(); g.arc(sx, sy, sr * 1.8, 0, TAU); g.fill();
    g.save(); g.translate(sx, sy); g.rotate(s.t * 0.15); g.fillStyle = '#ffcf3d';
    for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); rr(g, -sr * 0.1, -sr * 1.55, sr * 0.2, sr * 0.38, sr * 0.1); g.fill(); }
    g.restore();
    g.fillStyle = '#ffd84d'; g.beginPath(); g.arc(sx, sy, sr, 0, TAU); g.fill();
    g.strokeStyle = '#7a4a12'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.arc(sx - 34, sy - 8, 13, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.beginPath(); g.arc(sx + 34, sy - 8, 13, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    g.beginPath(); g.arc(sx, sy + 16, 28, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.fillStyle = 'rgba(255,120,110,0.45)'; g.beginPath(); g.arc(sx - 54, sy + 20, 13, 0, TAU); g.arc(sx + 54, sy + 20, 13, 0, TAU); g.fill();
    // clouds on the morning side
    g.fillStyle = '#fff6ee';
    for (const [x0, y, sc, v] of CLOUDS) {
      const x = ((x0 + s.t * v) % 1100) - 200; g.globalAlpha = 0.85 * dawn * (1 - ss(500, 900, x));
      for (const [cx, cy, cr] of [[x, y, 30], [x + 36 * sc, y - 14 * sc, 36], [x + 74 * sc, y, 28]]) { g.beginPath(); g.arc(cx, cy, cr * sc, 0, TAU); g.fill(); } rr(g, x - 12 * sc, y, 108 * sc, 26 * sc, 13 * sc); g.fill();
    }
    g.globalAlpha = 1;
  }
  function hills(g) {
    let gr = g.createLinearGradient(-300, 0, 2220, 0); gr.addColorStop(0, '#9fdc7c'); gr.addColorStop(0.5, '#7aa98f'); gr.addColorStop(1, '#2f3f6e');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-600, 1400); for (let x = -600; x <= 2520; x += 30) g.lineTo(x, 790 + Math.sin(x / 300 + 0.8) * 34); g.lineTo(2520, 1400); g.fill();
    gr = g.createLinearGradient(-300, 0, 2220, 0); gr.addColorStop(0, '#6cc26a'); gr.addColorStop(0.5, '#4f8a77'); gr.addColorStop(1, '#1f2a55');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-600, 1400); for (let x = -600; x <= 2520; x += 30) g.lineTo(x, 880 + Math.sin(x / 210 + 2.4) * 20); g.lineTo(2520, 1400); g.fill();
  }
  function track(g) {
    g.fillStyle = 'rgba(30,20,60,0.3)'; rr(g, X0 - 6, TY - 6, X1 - X0 + 12, 30, 15); g.fill();
    g.fillStyle = '#fff'; rr(g, X0 - 8, TY - 19, X1 - X0 + 16, 38, 19); g.fill();
    g.fillStyle = trackGrad(g); rr(g, X0, TY - 11, X1 - X0, 22, 11); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 1; i < 10; i++) { g.beginPath(); g.arc(X0 + (X1 - X0) * i / 10, TY, 4, 0, TAU); g.fill(); }
    const label = (txt, x, right, bg, fg) => { g.font = `700 30px ${FONT}`; const w = g.measureText(txt).width + 40; const lx = right ? x - w : x; g.fillStyle = bg; rr(g, lx, TY + 30, w, 52, 26); g.fill(); bold(g, txt, lx + w / 2, TY + 57, 30, fg); };
    label('☀️ Morning person', X0 - 10, false, '#fff4cf', '#7a4a12');
    label('Night owl 🦉', X1 + 10, true, '#2a2766', '#fff3c4');
  }
  function person(g, x, y, i, sc) {
    const [col, hair] = PEOPLE[i % PEOPLE.length], pr = 34 * sc;
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 12 * sc, y + pr * 0.8); g.lineTo(x, y + pr + 26 * sc); g.lineTo(x + 12 * sc, y + pr * 0.8); g.closePath(); g.fill();
    g.beginPath(); g.arc(x, y, pr + 5 * sc, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x, y, pr, 0, TAU); g.fill();
    g.fillStyle = hair; g.beginPath(); g.arc(x, y - pr * 0.15, pr, Math.PI * 1.08, Math.PI * 1.92); g.closePath(); g.fill();
    g.fillStyle = '#2a1a40'; g.beginPath(); g.arc(x - pr * 0.33, y + pr * 0.05, pr * 0.11, 0, TAU); g.arc(x + pr * 0.33, y + pr * 0.05, pr * 0.11, 0, TAU); g.fill();
    g.strokeStyle = '#2a1a40'; g.lineWidth = 3.5 * sc; g.beginPath(); g.arc(x, y + pr * 0.2, pr * 0.3, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  }
  function heart(g, x, y, sc) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    g.fillStyle = '#ff4f7b'; g.beginPath(); g.moveTo(0, 14); g.bezierCurveTo(-26, -4, -16, -24, 0, -12); g.bezierCurveTo(16, -24, 26, -4, 0, 14); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.stroke(); g.restore();
  }
  // the people sliding along the big track; T = ms since they started dropping in
  function crowd(g, s, T) {
    const span = X1 - X0 - 80, gap = 36;
    for (let i = 0; i < PEOPLE.length; i++) {
      const d = (T - i * 160) / 500; if (d <= 0) continue;
      const twin = i > 0 && SPOTS[i] === SPOTS[i - 1] ? 1 : i < PEOPLE.length - 1 && SPOTS[i] === SPOTS[i + 1] ? -1 : 0;
      const start = X0 + 40 + span * ((i + 0.5) / PEOPLE.length), end = X0 + 40 + span * SPOTS[i] + twin * gap;
      const slide = ease((T - 1300 - i * 60) / 900), x = lerp(start, end, slide);
      const drop = Math.min(1, d), y = lerp(-80, TY - 76, drop * drop) - (slide > 0 && slide < 1 ? Math.abs(Math.sin(slide * 9)) * 14 : 0);
      person(g, x, y, i, 1);
      if (twin === 1 && T > 2300) heart(g, x - gap, TY - 160 - Math.sin(s.t * 3 + i) * 4, 1.4 * back((T - 2300 - i * 60) / 500));
    }
  }
  function stage(g, s, o = {}) {
    const dawn = o.dawn == null ? 1 : o.dawn;
    sky(g, s, dawn);
    if (o.logo !== 0) { g.save(); g.translate(960, 330); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
    hills(g);
    if (o.host !== false) s.hostAt(1530, 610, 0.72);
    track(g);
    if (o.crowd != null) crowd(g, s, o.crowd);
    else if (!o.bare) crowd(g, s, 99999);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(20,16,50,${(1 - o.lights) * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
  }
  function logo(g, s, lit) {
    g.globalAlpha = clamp(lit * 1.2);
    g.fillStyle = 'rgba(59,39,82,0.22)'; rr(g, -390, -150, 780, 300, 50); g.fill();
    g.fillStyle = CREAM; rr(g, -390, -164, 780, 300, 50); g.fill(); g.lineWidth = 8; g.strokeStyle = '#fff'; g.stroke();
    bold(g, 'Where Do You', 0, -98, 54, CORAL);
    const gr = g.createLinearGradient(-320, 0, 320, 0); gr.addColorStop(0, '#ffa53d'); gr.addColorStop(0.45, '#ff5f8f'); gr.addColorStop(1, '#5b4fd8');
    g.font = `700 150px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = gr; g.fillText('Stand?', 0, 0);
    // the little slider with its knob gliding
    const tw = 440, ty = 92;
    g.fillStyle = '#fff'; rr(g, -tw / 2 - 6, ty - 13, tw + 12, 26, 13); g.fill();
    const tg = g.createLinearGradient(-tw / 2, 0, tw / 2, 0); tg.addColorStop(0, '#ffc23d'); tg.addColorStop(0.5, '#ff7a8a'); tg.addColorStop(1, '#5b4fd8');
    g.fillStyle = tg; rr(g, -tw / 2, ty - 7, tw, 14, 7); g.fill();
    const kx = -tw / 2 + tw * (0.5 + 0.4 * Math.sin(s.t * 1.3));
    g.fillStyle = '#fff'; g.beginPath(); g.arc(kx, ty, 20, 0, TAU); g.fill(); g.lineWidth = 7; g.strokeStyle = INK; g.stroke();
    g.globalAlpha = 1;
  }
  // Ollie: a night owl perched on a branch (the podium).
  function hostDraw(g, a) {
    const t = a.t, bob = Math.sin(t * 2) * 3;
    g.save(); g.translate(0, bob);
    // wings (reach toward the hands)
    for (const sd of ['l', 'r']) {
      const m = sd === 'l' ? -1 : 1, [hx, hy] = a.hands[sd];
      const sx = m * 92, sy = -170, ang = Math.atan2(hy - sy, hx - sx);
      g.save(); g.translate(sx, sy); g.rotate(ang - Math.PI / 2);
      g.fillStyle = '#6a4f80'; g.beginPath(); g.ellipse(0, 70, 34, 86, 0, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(40,20,60,0.4)'; g.lineWidth = 4; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(-18 + k * 18, 110); g.lineTo(-12 + k * 12, 150); g.stroke(); }
      g.restore();
    }
    // body + tufts
    g.fillStyle = '#8a6a9e'; g.beginPath(); g.ellipse(0, -170, 118, 160, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-100, -260); g.lineTo(-96, -350); g.lineTo(-40, -300); g.closePath(); g.moveTo(100, -260); g.lineTo(96, -350); g.lineTo(40, -300); g.closePath(); g.fill();
    g.fillStyle = '#d9c7e6'; g.beginPath(); g.ellipse(0, -110, 76, 90, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(106,79,128,0.5)'; g.lineWidth = 4; for (let k = 0; k < 3; k++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(-36 + j * 36, -150 + k * 34, 12, 0.2, Math.PI - 0.2); g.stroke(); }
    // face
    const lx = a.look * 6;
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-46, -240, 44, 0, TAU); g.arc(46, -240, 44, 0, TAU); g.fill();
    g.lineWidth = 6; g.strokeStyle = '#6a4f80'; g.beginPath(); g.arc(-46, -240, 44, 0, TAU); g.stroke(); g.beginPath(); g.arc(46, -240, 44, 0, TAU); g.stroke();
    if (a.blink < 0.5) { g.strokeStyle = '#2a1a40'; g.lineWidth = 7; g.beginPath(); g.moveTo(-72, -240); g.lineTo(-20, -240); g.moveTo(20, -240); g.lineTo(72, -240); g.stroke(); }
    else {
      g.fillStyle = '#ffb83d'; g.beginPath(); g.arc(-46 + lx, -238, 26, 0, TAU); g.arc(46 + lx, -238, 26, 0, TAU); g.fill();
      g.fillStyle = '#1b1630'; g.beginPath(); g.arc(-46 + lx, -238, 15, 0, TAU); g.arc(46 + lx, -238, 15, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(-40 + lx, -246, 5, 0, TAU); g.arc(52 + lx, -246, 5, 0, TAU); g.fill();
    }
    // beak: opens while talking
    const open = a.mouth * 22;
    g.fillStyle = '#ffb83d'; g.beginPath(); g.moveTo(-18, -206); g.lineTo(18, -206); g.lineTo(0, -180 - open * 0.2); g.closePath(); g.fill();
    if (open > 2) { g.fillStyle = '#c4581b'; g.beginPath(); g.moveTo(-14, -200 + 4); g.lineTo(14, -200 + 4); g.lineTo(0, -176 + open); g.closePath(); g.fill(); }
    // a little scarf: coral like the game
    g.fillStyle = CORAL; rr(g, -78, -196 + 24, 156, 26, 13); g.fill(); rr(g, 40, -174, 26, 60, 10); g.fill();
    g.restore();
  }
  // The branch Ollie perches on.
  function podium(g, s, x, y, sc) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    g.strokeStyle = '#4a2c1f'; g.lineCap = 'round'; g.lineWidth = 34;
    g.beginPath(); g.moveTo(700, 40); g.quadraticCurveTo(0, -10, -220, 30); g.stroke();
    g.lineWidth = 14; g.beginPath(); g.moveTo(-120, 10); g.quadraticCurveTo(-170, -50, -200, -70); g.stroke();
    g.fillStyle = '#7fd862'; for (const [lx, ly, rot] of [[-205, -78, -0.6], [-150, -40, 0.4], [180, -20, -0.3], [320, -6, 0.5]]) { g.beginPath(); g.ellipse(lx, ly, 26, 12, rot, 0, TAU); g.fill(); }
    g.fillStyle = '#ffb83d'; for (const fx of [-40, -20, 20, 40]) { g.beginPath(); g.arc(fx, -10, 9, 0, TAU); g.fill(); }
    g.restore();
  }

  // The roll call: everyone drops onto the big slider and slides to their spot.
  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1); stage(g, s, { host: false, bare: true, logo: 0 });
    g.globalAlpha = easeOut(u / 500); bold(g, 'Everyone on the scale!', 960, 200, 92, '#fff'); g.globalAlpha = 1;
    const n = F.length, span = X1 - X0 - 120;
    F.forEach((c, i) => {
      const d = (u - i * per) / 450; if (d <= 0) return;
      const x = X0 + 60 + span * ((i + 0.5) / n), drop = Math.min(1, d), y = lerp(-100, TY - 96, drop * drop) - (n > 9 && i % 2 ? 150 : 0);
      const pr = n > 9 ? 40 : 54;
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x - 14, y + pr * 0.8); g.lineTo(x, TY - 14); g.lineTo(x + 14, y + pr * 0.8); g.closePath(); g.fill();
      g.beginPath(); g.arc(x, y, pr + 7, 0, TAU); g.fill();
      g.fillStyle = c.color || CORAL; g.beginPath(); g.arc(x, y, pr, 0, TAU); g.fill();
      s.face(c, x, y, pr * 1.3);
      g.font = '700 30px ' + FONT; const w = Math.min(span / n + 40, g.measureText(c.name).width + 30);
      g.fillStyle = '#fff'; rr(g, x - w / 2, y - pr - 56, w, 42, 21); g.fill();
      bold(g, c.name.length > 12 ? c.name.slice(0, 11) + '…' : c.name, x, y - pr - 35, 26, INK);
    });
    if (o.more && u > n * per - 1400) bold(g, '…and ' + o.more + ' more!', 960, 300, 54, '#fff3c4');
  }
  BOX.intros.spectrum = {
    title: 'Where Do You Stand?',
    // How to play (box/howto.js): one card per step, 5 steps (module howSteps).
    tutorial: [
      { icon: '↔️', title: 'The spectrum', text: 'A spectrum goes up on the big screen, like 🌅 Morning person ↔ Night owl 🌙. No wrong answers!' },
      { icon: '📍', title: 'Find your spot', text: 'Place yourself where YOU stand. Nobody sees it until the reveal.', phone: 'Drag the marker (or tap ◀ ▶), then tap Lock it in 🔒.' },
      { icon: '📊', title: 'The reveal', text: 'Everyone’s dots slide onto one line. +50 if you’re within 10 of the room average, +25 for the closest pair.', phone: 'Waiting? Guess where the room average lands: +75 if you’re close.' },
      { icon: '🔦', title: 'Read a Friend', text: 'Every 3rd round, one player places themselves and everyone guesses where. Closest: 300, 200, 100, +150 for a bullseye.', phone: 'Drag to where you think they stand, then lock it in.' },
      { icon: '🔗', title: 'Twins', text: 'At the end, meet your twin tonight (the person most like you) and your opposite. Go say hi!', say: 'Hoo-hoo! At the end you meet your twin tonight, and your opposite. Go say hi!' },
    ],
    theme: { accent: '#ff7a59', accent2: '#ffc23d', accent3: '#fff3c4', ink: '#fff9f0', fade: '#181645', rim: '#fff3c4',
      spots: ['255,240,200', '255,200,170', '200,190,255', '255,240,200'], confetti: ['#ffc23d', '#ff7a8a', '#5b4fd8', '#7fd862', '#ffffff', '#4cc4ff'] },
    host: {
      name: 'Ollie the Owl',
      voice: { kokoro: 'bm_lewis', cb: 'calm', orpheus: 'zac', speed: 1.05, like: /guy|davis|eric|andrew|brian|male/i, accent: /en-(GB|US)/i, pitch: 1.25, rate: 1.05 },
      draw: hostDraw,
    },
    lines: {
      welcome: 'Hoo-hoo! Welcome to Where Do You Stand? I\'m Ollie. Morning person or night owl? I know where I stand!',
      roll: 'Here\'s everyone on the scale tonight!', more: '…and {n} more!',
      play: 'Let\'s find out where you stand!',
    },
    stage, logo, podium, roll,
    hostCam: { x: 1420, y: 520, z: 1.7 },
    castOpening: [
      { ms: 2700, sfx: [[0, 'swell'], [900, 'chime'], [1700, 'pop']],
        draw(g, s) {
          s.cam(960, lerp(600, 540, ease(s.k)), 1.06 - 0.06 * ease(s.k));
          stage(g, s, { host: false, dawn: ease(s.T / 2200), logo: ss(1300, 1900, s.T), bare: true });
        } },
      { ms: 2100, sfx: [[0, 'owl'], [300, 'whoosh']], pose: [[100, 'wave', 1800]], say: 'welcome', sayAt: 100, fit: 4200,
        draw(g, s) {
          const k = ease(s.T / 1500);
          s.cam(lerp(960, 1380, k), lerp(540, 500, k), lerp(1, 1.55, k));
          stage(g, s, { bare: true });
        } },
      { ms: 2200, sfx: [[0, 'pop'], [320, 'pop'], [640, 'pop'], [1300, 'whoosh'], [1900, 'chime']],
        draw(g, s) {
          s.cam(960, lerp(640, 620, s.k), 1.12);
          stage(g, s, { host: false, logo: 0.9, crowd: s.T * 1.1 });
        } },
    ],
  };
})();
