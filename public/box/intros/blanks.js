'use strict';
// JustBlanks intro: the cheeky game-show stage from the title screen. A tangerine sunburst
// turns behind a purple proscenium with marquee bulbs; the pink curtains part as answer cards
// rain down, a giant prompt card flips in and a punchline is scribbled into its blank (HA!),
// then the host, Polly Punchline, deals everyone in. Cast mode: opening, roll call, "Let's play".
// Engine + API: public/box/show.js.
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, OUT, TAU } = ST.util, { rr, text, floor } = ST.draw;
  const LG = '"Luckiest Guy", "Lilita One", sans-serif', MK = '"Permanent Marker", cursive';
  const STRIPES = ['#ff4f8b', '#3ec7ff', '#7ee06a', '#ffb627', '#b77bff'];
  const ANS = ['a haunted toaster', 'way too much glitter', 'interpretive dance', 'a very polite ghost', 'three raccoons in a coat', 'a dramatic sneeze', 'free samples forever', 'a suspicious casserole'];
  const R = rng(4242);
  const RAIN = Array.from({ length: 46 }, (_, i) => ({ x: R() * 2200 - 140, d: R() * 1.2, v: 520 + R() * 420, r: R() * TAU, vr: (R() - 0.5) * 3, c: STRIPES[i % 5], s: 0.6 + R() * 0.6, a: ANS[i % ANS.length] }));
  try { if (document.fonts) { document.fonts.load('40px "Luckiest Guy"'); document.fonts.load('40px "Permanent Marker"'); } } catch { /* fine */ }

  function answerCard(g, x, y, sc, rot, c, label) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc);
    g.fillStyle = 'rgba(80,0,40,0.35)'; rr(g, -66, -86, 140, 186, 14); g.fill();
    g.fillStyle = '#fff4dc'; rr(g, -74, -96, 140, 186, 14); g.fill();
    g.fillStyle = c; rr(g, -74, -96, 140, 30, 14); g.fill(); g.fillRect(-74, -80, 140, 14);
    if (label) { g.fillStyle = '#2a0b4f'; g.font = `600 22px "Fredoka", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; const w = label.split(' '), h = Math.ceil(w.length / 2); g.fillText(w.slice(0, h).join(' '), -4, -8, 124); g.fillText(w.slice(h).join(' '), -4, 22, 124); }
    g.restore();
  }
  function promptCard(g, x, y, sc, flip, lines, ans, typed, t) {
    g.save(); g.translate(x, y); g.scale(sc * Math.max(0.02, flip), sc);
    g.fillStyle = 'rgba(80,0,40,0.4)'; rr(g, -280, -350, 600, 740, 40); g.fill();
    g.fillStyle = '#3a1470'; rr(g, -300, -370, 600, 740, 40); g.fill();
    g.strokeStyle = '#ffe14d'; g.lineWidth = 8; rr(g, -278, -348, 556, 696, 28); g.stroke();
    g.fillStyle = '#ff4f8b'; rr(g, -140, -392, 280, 64, 32); g.fill();
    text(g, 'FILL IT IN!', 0, -358, 34, '#fff6e8', { font: LG });
    lines.forEach((l, i) => text(g, l, 0, -190 + i * 84, 70, '#fff6e8', { font: LG, max: 500 }));
    g.strokeStyle = '#ffe14d'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(-220, 120); g.lineTo(220, 120); g.stroke();
    const n = Math.round(ans.length * typed);
    if (n > 0) text(g, ans.slice(0, n), 0, 82, 66, '#7ce8ff', { font: MK, max: 440 });
    if (typed > 0 && typed < 1) { g.fillStyle = `rgba(255,225,77,${0.6 + 0.4 * Math.sin(t * 12)})`; g.fillRect(-4, 30, 8, 70); }
    text(g, 'JUSTBLANKS · PROMPT 1', 0, 300, 26, 'rgba(255,246,232,0.5)', { font: LG });
    g.restore();
  }
  function ha(g, x, y, k) {
    if (k <= 0) return;
    const s = 1 + (1 - easeOut(k)) * 1.2;
    g.save(); g.translate(x, y); g.rotate(0.3); g.scale(s, s); g.globalAlpha = Math.min(1, k * 2);
    g.fillStyle = '#ffe14d'; g.beginPath(); for (let i = 0; i < 20; i++) { const a = (i * TAU) / 20, r = i % 2 ? 90 : 124; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill();
    g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
    text(g, 'HA!', 0, 6, 84, '#c2185b', { font: LG }); g.restore(); g.globalAlpha = 1;
  }
  function rain(g, T, k) {
    for (const c of RAIN) {
      const u = T / 1000 - c.d; if (u < 0) continue;
      const y = -200 + u * c.v; if (y > 1300) continue;
      answerCard(g, c.x + Math.sin(u * 2 + c.r) * 40, y, c.s * k, c.r + u * c.vr, c.c, c.s > 0.95 ? c.a : '');
    }
  }
  function curtains(g, open, t) {
    const w = 980 * (1 - ease(open)) + 150;
    for (const side of [-1, 1]) {
      g.save(); if (side > 0) { g.translate(1920, 0); g.scale(-1, 1); }
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#7a0f3d'); gr.addColorStop(1, '#c2185b');
      g.fillStyle = gr; g.beginPath(); g.moveTo(-40, -40); g.lineTo(w, -40);
      for (let y = 0; y <= 1120; y += 40) g.lineTo(w + Math.sin(y * 0.02 + t * 2) * 14 - (open > 0.5 ? (1 - y / 1120) * 0 : 0), y);
      g.lineTo(-40, 1120); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 10; for (let x = 40; x < w; x += 70) { g.beginPath(); g.moveTo(x, -40); g.lineTo(x + Math.sin(t + x) * 6, 1120); g.stroke(); }
      g.fillStyle = '#ffe14d'; rr(g, w - 60, 520, 70, 26, 13); g.fill();
      g.restore();
    }
  }
  function stage(g, s, o = {}) {
    const t = s.t;
    g.fillStyle = '#ff5a36'; g.fillRect(-600, -300, 3120, 1700);
    g.save(); g.translate(960, 470); g.rotate(t * 0.05); g.fillStyle = '#ff7a45'; g.beginPath();
    for (let i = 0; i < 24; i++) { const a = (i * TAU) / 24; g.moveTo(0, 0); g.arc(0, 0, 2400, a, a + TAU / 48); g.closePath(); } g.fill(); g.restore();
    const vg = g.createRadialGradient(960, 470, 300, 960, 470, 1400); vg.addColorStop(0, 'rgba(90,0,50,0)'); vg.addColorStop(1, 'rgba(90,0,50,0.6)'); g.fillStyle = vg; g.fillRect(-600, -300, 3120, 1700);
    // the proscenium with chasing bulbs
    g.lineWidth = 60; g.strokeStyle = '#3a1470'; g.beginPath(); g.moveTo(200, 800); g.lineTo(200, 260); g.quadraticCurveTo(200, 70, 960, 70); g.quadraticCurveTo(1720, 70, 1720, 260); g.lineTo(1720, 800); g.stroke();
    g.lineWidth = 6; g.strokeStyle = '#ffe14d'; g.stroke();
    const chase = Math.floor(t * 8);
    for (let i = 0; i <= 56; i++) {
      const a = i / 56; let x, y;
      if (a < 0.2) { x = 200; y = lerp(790, 260, a / 0.2); } else if (a < 0.8) { const u = (a - 0.2) / 0.6, th = Math.PI * (1 - u); x = 960 + Math.cos(th) * 760; y = 260 - Math.sin(th) * 190; } else { x = 1720; y = lerp(260, 790, (a - 0.8) / 0.2); }
      const on = (i + chase) % 3 === 0; g.fillStyle = on ? '#fffbe0' : 'rgba(255,240,170,0.4)'; g.beginPath(); g.arc(x, y, on ? 10 : 7, 0, TAU); g.fill();
    }
    floor(g, s.theme, t);
    if (!o.bare) { // giant answer cards leaning on the set
      answerCard(g, 330, 690, 1.05, -0.18, '#3ec7ff', 'a very polite ghost');
      answerCard(g, 1590, 700, 1, 0.16, '#7ee06a', 'way too much glitter');
    }
    if (o.curtain != null) curtains(g, o.curtain, t);
    if (o.host !== false) s.hostAt(1400, 800, 0.85);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(20,0,20,${(1 - o.lights) * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
    if (o.logo !== 0) { g.save(); g.translate(960, 290); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
    s.spots(o.spots == null ? 0.5 : o.spots);
  }
  function logo(g, s, lit) {
    const k = Math.min(1, lit);
    g.save(); g.scale(0.6 + 0.4 * back(k), 0.6 + 0.4 * back(k)); g.globalAlpha = Math.min(1, k * 1.5);
    g.save(); g.rotate(-0.06); text(g, 'JUST', -190, -112, 66, '#ff8fc0', { font: LG, stroke: '#1e0638', lw: 10 }); g.restore();
    g.save(); g.rotate(-0.03);
    g.font = `190px ${LG}`; g.textAlign = 'left'; g.textBaseline = 'middle';
    const a = 'BL', b = 'NKS', wa = g.measureText(a).width, wb = g.measureText(b).width, gap = 150, x0 = -(wa + gap + wb) / 2;
    for (const [str, x] of [[a, x0], [b, x0 + wa + gap]]) { g.fillStyle = '#c2185b'; g.fillText(str, x, 50); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillText(str, x, 64); g.lineJoin = 'round'; g.lineWidth = 12; g.strokeStyle = OUT; g.strokeText(str, x, 30); g.fillStyle = '#ffe14d'; g.fillText(str, x, 30); }
    g.fillStyle = '#fff6e8'; g.fillRect(x0 + wa + 12, 96, gap - 24, 14);
    const drop = ((s.t * 1000) % 5000) / 5000, dy = drop < 0.2 ? (1 - easeOut(drop / 0.2)) * -160 : drop > 0.86 ? (drop - 0.86) * -500 : 0;
    g.globalAlpha = Math.min(1, k * 1.5) * (drop > 0.92 ? 1 - (drop - 0.92) / 0.08 : 1);
    g.textAlign = 'center'; g.lineWidth = 12; g.strokeStyle = OUT; g.strokeText('A', x0 + wa + gap / 2, 30 + dy); g.fillStyle = '#3ec7ff'; g.fillText('A', x0 + wa + gap / 2, 30 + dy);
    g.restore(); g.restore(); g.globalAlpha = 1;
  }
  function podium(g, s, x, y, sc) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    g.fillStyle = '#3a1470'; g.beginPath(); g.moveTo(-150, 4); g.lineTo(150, 4); g.lineTo(124, 214); g.lineTo(-124, 214); g.closePath(); g.fill(); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = '#ffe14d'; g.lineWidth = 5; rr(g, -110, 34, 220, 150, 18); g.stroke();
    answerCard(g, -26, 110, 0.55, -0.15, '#ff4f8b'); answerCard(g, 30, 112, 0.55, 0.12, '#3ec7ff');
    rr(g, -164, -14, 328, 26, 12); g.fillStyle = '#ff4f8b'; g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    g.restore();
  }


  // Roll call layout: one or two rows of slots across the 1920x1080 world.
  function slots(n, w) { const cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / Math.max(1, cols)), tw = Math.min(w, 1640 / Math.max(1, cols)); return (i) => { const r = Math.floor(i / cols), rowN = r === rows - 1 ? n - r * cols : cols; return { x: 960 + ((i % cols) - (rowN - 1) / 2) * tw, row: r, rows, tw }; }; }

  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1); stage(g, s, { host: false, bare: true, logo: 0, lights: 0.6, spots: 0.5 });
    g.fillStyle = 'rgba(42,11,79,0.35)'; g.fillRect(-600, -300, 3120, 1700);
    text(g, 'TONIGHT’S COMEDIANS', 960, 150, 84, '#ffe14d', { font: LG, stroke: '#c2185b', lw: 14 });
    const at = slots(F.length, 250);
    F.forEach((c, i) => {
      const k = easeOut((u - i * per) / 420); if (k <= 0) return;
      const p = at(i), y = (p.rows > 1 ? 420 + p.row * 330 : 560), sc = Math.min(1, p.tw / 250), rot = ((i % 3) - 1) * 0.06;
      g.save(); g.translate(lerp(960, p.x, k), lerp(-300, y, k)); g.rotate(rot + (1 - k) * 2); g.scale(sc, sc);
      g.fillStyle = 'rgba(80,0,40,0.4)'; rr(g, -96, -126, 210, 270, 20); g.fill();
      g.fillStyle = '#fff4dc'; rr(g, -106, -136, 210, 270, 20); g.fill();
      g.fillStyle = c.color || STRIPES[i % 5]; rr(g, -106, -136, 210, 40, 20); g.fill(); g.fillRect(-106, -116, 210, 20);
      s.face(c, -1, -10, 100);
      text(g, c.name, -1, 96, 38, '#2a0b4f', { font: LG, max: 180 });
      g.restore();
    });
    if (o.more && u > F.length * per - 1400) text(g, '…and ' + o.more + ' more!', 960, 1000, 60, '#ffe14d', { font: LG, stroke: '#3a1470', lw: 12 });
  }
  BOX.intros.blanks = {
    title: 'JustBlanks',
    // How to play (box/howto.js): one card per step, 5 steps (module howSteps).
    tutorial: [
      { icon: '🃏', title: 'The prompt', text: 'A prompt card with a blank goes up on the big screen. Fill it in with the funniest card in your hand!' },
      { icon: '📱', title: 'Play a card', text: 'Pick the answer that fits best. Some prompts need two cards. Blank cards let you write your own.', phone: 'Tap your funniest card, then tap Play it!' },
      { icon: '🎤', title: 'The reading', text: 'Answers are read out one by one with no names, so nobody knows whose is whose. Once a game you can swap your whole hand.', phone: '🔄 New hand swaps all your cards (once a game).' },
      { icon: '👑', title: 'The Judge', text: 'The Judge crowns the funniest card (in big groups everyone votes). Not judging? Send a ❤️ to your favourite.', phone: 'Judge? Tap the funniest, then tap 👑 Crown the winner.' },
      { icon: '🏆', title: 'Winning', text: 'The winning card earns a point. First to the target score wins, with awards and the best lines of the night!' },
    ],
    theme: { accent: '#ff4f8b', accent2: '#ffe14d', accent3: '#ffe14d', ink: '#fff6e8', fade: '#2a0b4f', floor1: '#3a1470', floor2: '#1a0538', disc1: '#5a249c', disc2: '#2a0b4f', rim: '#ffb0d6',
      pod1: '#3a1470', pod2: '#1a0538', podTop: '#ff4f8b', spots: ['255,240,170', '255,140,200', '120,220,255', '255,240,170'], confetti: ['#ffe14d', '#ff4f8b', '#3ec7ff', '#7ee06a', '#ffffff', '#b77bff'] },
    host: {
      name: 'Polly Punchline',
      voice: { kokoro: 'af_bella', speed: 1.12, like: /female|zira|aria|jenny|samantha|susan|hazel|libby|sonia/i, accent: /en-(US|GB)/i, pitch: 1.2, rate: 1.12 },
      look: { skin: '#f6c39a', skinShade: '#dba17a', suit: '#ff4f8b', suit2: '#c2185b', sleeve: '#ff4f8b', lapel: '#ffe14d', shirt: '#fff6e8', cuff: '#fff6e8', tie: 'bow', tieColor: '#3ec7ff', hair: 'curly', hairColor: '#7b2cbf', brow: '#4a1680', prop: 'cards', grin: true, glasses: '#2a0b4f' },
    },
    lines: {
      welcome: 'Welcome to JustBlanks! Fill in the blank, and the funniest card wins!',
      roll: 'Here are tonight’s comedians!', more: '…and {n} more!',
      play: 'Shuffle up and deal!',
      meet: 'Let’s meet the players!', joke: 'I asked my deck for a joke. It said: blank.', banter: ['Pick your funniest card!'],
      first: 'First up, {name}', intros: ['Here comes {name}', 'Give it up for {name}'], last: 'And finally, {name}', noFact: 'a total wild card!', others: 'And everyone else!',
    },
    stage, logo, podium, roll,
    hostCam: { x: 1200, y: 610, z: 1.7 },
    castOpening: [
      { ms: 2700, sfx: [[100, 'swell'], [700, 'shuffle'], [1500, 'cheer']], crowd: [[1400, 'cheer', 1600]],
        draw(g, s) {
          s.cam(960, lerp(600, 540, ease(s.k)), 1.08 - 0.08 * ease(s.k));
          stage(g, s, { host: false, curtain: ss(300, 2200, s.T), logo: ss(900, 1700, s.T), lights: 0.35 + 0.65 * ss(0, 1200, s.T), spots: ss(600, 1400, s.T) });
          rain(g, s.T, 1);
          s.backs(-60, 960, 2040, 130, s.T > 1400 ? 'cheer' : 'idle');
        } },
      { ms: 2400, sfx: [[0, 'flip'], [1500, 'pop']],
        draw(g, s) {
          s.cam(960, 540, 1); stage(g, s, { host: false, logo: 0, lights: 0.55, spots: 0.3 });
          g.fillStyle = 'rgba(42,11,79,0.45)'; g.fillRect(-600, -300, 3120, 1700);
          const f = ss(0, 380, s.T);
          promptCard(g, 960, 560, 0.9 + 0.05 * s.k, f, ['YOUR FRIENDS', 'ARE…'], 'HILARIOUS', ss(600, 1400, s.T), s.t);
          ha(g, 1240, 820, ss(1450, 1750, s.T));
        } },
      { ms: 2900, sfx: [[0, 'whoosh']], pose: [[0, 'wave', 2200], [2200, 'point', 700]], say: 'welcome', sayAt: 150, fit: 3200,
        draw(g, s) { const k = ease(s.T / 2000); s.cam(lerp(960, 1290, k), lerp(540, 590, k), lerp(1, 2.1, k)); stage(g, s, {}); s.backs(-60, 980, 2040, 120); } },
    ],
  };
})();
