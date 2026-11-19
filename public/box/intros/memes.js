'use strict';
// Meme Maker intro (cast mode): a corkboard in the dark. A desk lamp clicks on over a blank meme
// template and the caption types itself in, Impact-style; then memes slap onto the board one after
// another with stamps, the MEME MAKER logo drops in, and the roll call pins every player up as a
// meme of their own (avatar + name as the caption). Engine + API: public/box/show.js.
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, back, rng, TAU, clamp } = ST.util, { rr, text } = ST.draw;
  const IMP = 'Impact, Anton, "Arial Black", sans-serif';
  const PINS = ['#ff4f5a', '#ffd23f', '#3fa9ff', '#3ddc84', '#b77bff'];
  const r = rng(4242);
  const SPECK = Array.from({ length: 900 }, () => [r() * 2400 - 240, r() * 1400 - 160, r() < 0.5]);
  const cache = new Map();
  const pic = (m, sc = 0.9) => { const k = JSON.stringify([m, sc]); let c = cache.get(k); if (!c && BOX.memes) { c = BOX.memes.render(m, { scale: sc }); cache.set(k, c); } return c; };
  const WALL = [
    { tpl: 'catplate', caps: ['WHEN THEY SAY', 'GAME NIGHT IS CANCELLED'], x: 330, y: 300, tl: -0.08 },
    { tpl: 'buttons', caps: ['BE CHILL', 'BE HILARIOUS', 'ME TONIGHT'], x: 1590, y: 330, tl: 0.07 },
    { tpl: 'brain', caps: ['TEXT', 'EMOJI', 'GIF', 'A MEME'], x: 360, y: 780, tl: 0.05 },
    { tpl: 'duckboss', caps: ['WHEN YOU’RE THE', 'FUNNIEST IN THE ROOM'], x: 1560, y: 790, tl: -0.06 },
    { tpl: 'galaxy', caps: ['LAUGHING', 'SNORTING', 'CRYING'], x: 760, y: 820, tl: -0.04 },
    { tpl: 'shook', caps: ['WHEN YOUR MEME', 'GETS EVERY VOTE'], x: 1180, y: 830, tl: 0.06 },
  ];
  const STAMPS = ['VIRAL!', 'LOL', '10/10', 'SO TRUE', 'CLASSIC', 'DEEP-FRIED'];
  function cork(g, lights = 1) {
    const gr = g.createLinearGradient(0, -300, 1920, 1380); gr.addColorStop(0, '#c8925a'); gr.addColorStop(1, '#93602f');
    g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    for (const [x, y, d] of SPECK) { g.fillStyle = d ? 'rgba(90,50,20,0.4)' : 'rgba(255,230,190,0.3)'; g.fillRect(x, y, 3, 3); }
    g.fillStyle = '#5a3818'; g.fillRect(-600, -300, 3120, 330); g.fillRect(-600, 1050, 3120, 400); g.fillRect(-600, -300, 640, 1700); g.fillRect(1880, -300, 640, 1700);
    g.strokeStyle = '#3a2210'; g.lineWidth = 10; g.strokeRect(40, 30, 1840, 1020);
    if (lights < 1) { g.fillStyle = `rgba(10,5,0,${(1 - lights) * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
  }
  function pinned(g, c, x, y, w, tl, pinC) {
    if (!c) return; const h = (c.height / c.width) * w;
    g.save(); g.translate(x, y); g.rotate(tl);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-w / 2 - 6, -h / 2 + 10, w + 24, h + 24);
    g.fillStyle = '#fff'; g.fillRect(-w / 2 - 12, -h / 2 - 12, w + 24, h + 24); g.drawImage(c, -w / 2, -h / 2, w, h);
    const pg = g.createRadialGradient(-4, -h / 2 - 16, 1, 0, -h / 2 - 12, 15); pg.addColorStop(0, '#fff'); pg.addColorStop(0.3, pinC); pg.addColorStop(1, pinC);
    g.fillStyle = pg; g.beginPath(); g.arc(0, -h / 2 - 12, 14, 0, TAU); g.fill();
    g.restore();
  }
  function stamp(g, t, x, y, k, rot = -0.22, col = '#ff4f5a') {
    if (k <= 0) return; const sc = lerp(3, 1, easeOut(k));
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc, sc); g.globalAlpha = clamp(k * 2);
    g.font = `64px ${IMP}`; const tw = g.measureText(t).width;
    g.fillStyle = col; g.fillRect(-tw / 2 - 20, -42, tw + 40, 84); g.strokeStyle = '#fff'; g.lineWidth = 7; g.strokeRect(-tw / 2 - 20, -42, tw + 40, 84);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, 4); g.restore();
  }
  function logo(g, s, lit) {
    g.save(); g.rotate(-0.04 + Math.sin(s.t * 1.6) * 0.015);
    g.globalAlpha = 0.25 + 0.75 * lit;
    g.font = `180px ${IMP}`; const a = g.measureText('MEME').width, b = g.measureText('MAKER').width, gap = 46, w = a + gap + b;
    text(g, 'MEME', -w / 2 + a / 2, 0, 180, '#fff', { font: IMP, stroke: '#000', lw: 26 });
    text(g, 'MAKER', w / 2 - b / 2, 0, 180, '#ffe14d', { font: IMP, stroke: '#000', lw: 26 });
    g.restore();
  }
  function stage(g, s, o = {}) {
    cork(g, o.lights == null ? 1 : o.lights);
    if (o.logo !== 0) {
      for (let i = 0; i < 4; i++) { const m = WALL[i]; pinned(g, pic(m, 0.6), m.x, m.y, 330, m.tl, PINS[i]); }
      g.save(); g.translate(960, 520); logo(g, s, o.logo == null ? 1 : o.logo); g.restore();
    }
  }
  // The roll call: everyone pinned up as a meme of their own.
  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1); cork(g, 1);
    text(g, 'TONIGHT’S MEME TEAM', 960, 140, 92, '#fff', { font: IMP, stroke: '#000', lw: 16, max: 1500 });
    const n = F.length, rows = n > 6 ? 2 : 1, cols = Math.ceil(n / rows), w = Math.min(300, 1600 / cols - 40), h = w * 1.1;
    F.forEach((c, i) => {
      const k = (u - i * per) / 450; if (k <= 0) return;
      const row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols, col = i - row * cols;
      const x = 960 + (col - (rowN - 1) / 2) * (w + 50), y = (rows === 2 ? 420 + row * (h + 70) : 590);
      const sc = lerp(1.8, 1, easeOut(k)), tl = ((i * 37) % 9 - 4) * 0.012;
      g.save(); g.translate(x, y); g.rotate(tl); g.scale(sc, sc); g.globalAlpha = clamp(k * 2);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-w / 2 - 4, -h / 2 + 10, w + 20, h + 20);
      g.fillStyle = '#fff'; g.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 20);
      g.fillStyle = c.color || '#3fa9ff'; g.fillRect(-w / 2, -h / 2, w, h);
      const sh = g.createRadialGradient(0, 0, 10, 0, 0, w); sh.addColorStop(0, 'rgba(255,255,255,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0.25)'); g.fillStyle = sh; g.fillRect(-w / 2, -h / 2, w, h);
      s.face(c, 0, -h * 0.02, w * 0.5);
      text(g, String(c.name || '').toUpperCase(), 0, h * 0.38, Math.round(w * 0.17), '#fff', { font: IMP, stroke: '#000', lw: Math.round(w * 0.04), max: w - 20 });
      text(g, 'ME, READY TO MEME', 0, -h * 0.4, Math.round(w * 0.1), '#fff', { font: IMP, stroke: '#000', lw: Math.round(w * 0.03), max: w - 20 });
      g.fillStyle = PINS[i % PINS.length]; g.beginPath(); g.arc(0, -h / 2 - 10, 12, 0, TAU); g.fill();
      g.restore();
    });
    if (o.more && u > n * per - 1400) text(g, '…and ' + o.more + ' more!', 960, 1010, 60, '#ffe14d', { font: IMP, stroke: '#000', lw: 12 });
  }
  BOX.intros.memes = {
    title: 'Meme Maker',
    // How to play (box/howto.js): one card per step, 5 steps (module howSteps).
    tutorial: [
      { icon: '🖼️', title: 'Your template', text: 'Every round your phone gets a meme template. Write the captions and watch it come together live.', phone: 'Type the top and bottom text, then tap Post it! 🚀' },
      { icon: '💡', title: 'Stuck?', text: 'Tap an idea for inspiration, or swap your template once a round.', phone: 'Tap 🔀 New template to swap.' },
      { icon: '🔄', title: 'Round types', text: 'Free Caption, Same Template, Prompted situations, and Remix, where you finish someone else’s half-made meme.' },
      { icon: '🗳️', title: 'Vote', text: 'The TV parades every meme, then everyone votes for the funniest: 100 points a vote. No voting for your own!', phone: 'Tap the funniest meme to vote.' },
      { icon: '🏆', title: 'Meme of the Night', text: 'The night ends with a Meme of the Night showdown, awards and a gallery you can download.' },
    ],
    theme: { accent: '#ffe14d', accent2: '#ff4f5a', accent3: '#3fa9ff', ink: '#ffffff', fade: '#2a1808', confetti: ['#ffe14d', '#ff4f5a', '#3fa9ff', '#3ddc84', '#ffffff', '#b77bff'] },
    host: null,
    lines: { roll: 'Here’s tonight’s meme team!', more: '…and {n} more!', play: 'Let’s make some memes!' },
    stage, logo, roll,
    castOpening: [
      // A lamp clicks on over a blank template, and the caption types itself in.
      { ms: 3000, sfx: [[150, 'click'], [700, 'talk'], [1700, 'talk'], [2500, 'pop']],
        draw(g, s) {
          s.cam(960, 540, lerp(1.25, 1.1, ease(s.k)));
          cork(g, 0.15 + 0.85 * ss(0, 400, s.T));
          const lamp = g.createRadialGradient(960, 520, 50, 960, 520, 700); lamp.addColorStop(0, `rgba(255,240,200,${0.35 * ss(0, 400, s.T)})`); lamp.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = lamp; g.fillRect(0, 0, 1920, 1080);
          const A = 'WHEN GAME NIGHT', B = 'FINALLY STARTS';
          const n1 = Math.floor(clamp((s.T - 500) / 900) * A.length), n2 = Math.floor(clamp((s.T - 1500) / 800) * B.length);
          pinned(g, pic({ tpl: 'fine', caps: [A.slice(0, n1), B.slice(0, n2)] }, 1), 960, 540, 620, -0.02, '#ff4f5a');
          stamp(g, 'VIRAL!', 1200, 760, (s.T - 2500) / 250, -0.25);
        } },
      // Memes slap onto the board, then the logo drops.
      { ms: 3000, sfx: [[0, 'whoosh'], [250, 'pop'], [550, 'pop'], [850, 'pop'], [1150, 'pop'], [1500, 'swell'], [1700, 'cheer']], crowd: [[1600, 'cheer', 1400]],
        draw(g, s) {
          s.cam(960, 540, lerp(1.08, 1, ease(s.k)));
          cork(g, 1);
          WALL.forEach((m, i) => { const k = (s.T - 200 - i * 280) / 260; if (k <= 0) return; const sc = lerp(2, 1, easeOut(k)); g.save(); g.globalAlpha = clamp(k * 2); g.translate(m.x, m.y); g.scale(sc, sc); g.translate(-m.x, -m.y); pinned(g, pic(m, 0.6), m.x, m.y, 330, m.tl, PINS[i % PINS.length]); g.restore(); stamp(g, STAMPS[i], m.x + 90, m.y + 120, (s.T - 600 - i * 280) / 220, 0.2 - i * 0.08, i % 2 ? '#3fa9ff' : '#ff4f5a'); });
          const k = back((s.T - 1500) / 600);
          if (k > 0) { g.save(); g.translate(960, 500); g.scale(k, k); logo(g, s, 1); g.restore(); text(g, 'Caption it. Vote on it. Go viral.', 960, 640, 54, '#fff', { stroke: '#000', lw: 10, max: 1400 }); }
        } },
    ],
  };
})();
