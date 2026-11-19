'use strict';
// Debate Club intro: the hall of the debating society. The house lights are down; one spotlight
// finds the moderator's lectern, the giant gavel slams ("ORDER! ORDER!") and the plaque lights up.
// Judge Penelope Gavel welcomes the house, the camera swings between the blue and red podiums
// (FOR! AGAINST!), then the members take their seats on the benches (the roll call).
// Engine + API: public/box/show.js. Phones load this file for the tutorial only (no BOX.studio
// there), so everything that needs the engine is built later, once BOX.studio exists.
(function () {
  BOX.intros = BOX.intros || {};
  const I = BOX.intros.debate = {
    title: 'Debate Club',
    // How to play (box/howto.js): 6 steps (the module's howSteps).
    tutorial: [
      { icon: '🎤', title: 'Two debaters, one silly topic', text: 'Each debate, two players step up to the podiums with a topic and a side: “Is cereal a soup? You say YES.” Everyone else is the audience.', phone: 'Debaters: your side shows in big letters.' },
      { icon: '🃏', title: 'Prep with argument cards', text: '30 seconds to plan. Your phone deals 3 argument cards (Made-Up Statistic, Dramatic Pause…). Tap one during your speech and it pops up on the TV.', phone: 'Tap “I’m ready ✓”, then tap a card mid-speech.' },
      { icon: '⏱️', title: 'The speeches', text: 'Opening statements (45 s each), rebuttals, one question from the audience, then a typed closing line you read out loud. Done early? Pass the mic.', phone: 'Speaking? Tap “I’m done ✓” to pass the mic.' },
      { icon: '👏', title: 'Heckle (nicely)', text: 'Audience: react live. 👏 😂 🤔 push the crowd meter toward the speaker, 🍅 pulls it back. Send in a question; the room votes which one gets asked.', phone: 'Tap 👏 😂 🤔 🍅. Type a question and tap Send.' },
      { icon: '🗳️', title: 'The crowd decides', text: 'Vote for the winner, then pick the best line. Debaters score their vote share (up to 1000) +200 for the win, up to +300 crowd meter, +250 best line. Back the winner: +100.', phone: 'Tap a side, then tap the speech with the best line.' },
      { icon: '⚡', title: 'Twists', text: '🔄 Swap Sides: mid-debate, argue the opposite! ⚖️ Lawyer Mode: defend an object accused of a crime. 🌶️ Hot Takes: 20 seconds each. 👥 Team Debates in big rooms.' },
    ],
    theme: { accent: '#f2b84b', accent2: '#3f8cff', accent3: '#ffd77a', ink: '#fff3dc', fade: '#0a1028', rim: '#f2b84b',
      floor1: '#8c5530', floor2: '#4a2814', disc1: '#18234a', disc2: '#0d1430', pod1: '#6b3e22', pod2: '#3a2112', podTop: '#f2b84b', seat: '#5b3520', audWall1: '#18234a', audWall2: '#080d22',
      spots: ['255,240,200', '255,226,170', '200,220,255', '255,200,200'], confetti: ['#f2b84b', '#ffd77a', '#3f8cff', '#ff4d5e', '#fff3dc', '#ffffff'] },
    host: {
      name: 'Judge Penelope Gavel',
      voice: { like: /female|zira|aria|jenny|libby|sonia|hazel|susan|samantha|serena|natasha/i, accent: /en-(GB|AU|US)/i, pitch: 1.05, rate: 1.06 },
      look: { skin: '#e8b48f', skinShade: '#c99071', suit: '#5a1e2c', suit2: '#3a0f1a', sleeve: '#5a1e2c', lapel: '#f2b84b', shirt: '#fffdf7', cuff: '#fffdf7', tie: 'bow', tieColor: '#1b4fa8',
        hair: 'bun', hairColor: '#d8d2c8', hairShade: '#b3aba0', brow: '#8a8278', glasses: '#2a1a12', prop: 'gavel', grin: true },
    },
    lines: {
      welcome: 'Order! Order! Welcome to Debate Club, the most argumentative room in town. I’m Judge Penelope Gavel.',
      roll: 'Members of the house, take your seats!', more: '…and {n} more!',
      play: 'The motion is on the table. Let the debate begin!',
    },
  };

  function build() {
    if (I.stage || !BOX.studio) return !!I.stage;
    const ST = BOX.studio, { lerp, ss, ease, easeOut, back, TAU, clamp } = ST.util, { rr, text } = ST.draw;
    const SIGN = 'Bungee, "Lilita One", sans-serif';
    const BRASS = '#f2b84b', BRASS2 = '#ffd77a', WOOD = '#5b3520', BLUE = '#3f8cff', RED = '#ff4d5e';
    try { if (document.fonts) document.fonts.load('40px Bungee'); } catch { /* fine */ }

    function wall(g, t) {
      let gr = g.createLinearGradient(0, -300, 0, 800); gr.addColorStop(0, '#070b1f'); gr.addColorStop(0.6, '#1a2552'); gr.addColorStop(1, '#0d1430');
      g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1100);
      for (let i = -3; i <= 15; i++) { const x = i * 160; g.fillStyle = 'rgba(255,255,255,0.035)'; g.fillRect(x - 16, -300, 32, 1100); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 16, -300, 5, 1100); }
      for (const wx of [170, 1750]) {
        const ww = 190, top = 60, wh = 440;
        g.save(); g.beginPath(); g.moveTo(wx - ww / 2, top + wh); g.lineTo(wx - ww / 2, top + ww / 2); g.arc(wx, top + ww / 2, ww / 2, Math.PI, 0); g.lineTo(wx + ww / 2, top + wh); g.closePath();
        const wg = g.createLinearGradient(0, top, 0, top + wh); wg.addColorStop(0, '#2b4a8a'); wg.addColorStop(1, '#0f1d40'); g.fillStyle = wg; g.fill();
        g.lineWidth = 12; g.strokeStyle = WOOD; g.stroke(); g.clip();
        g.strokeStyle = WOOD; g.lineWidth = 6; g.beginPath(); g.moveTo(wx, top); g.lineTo(wx, top + wh); for (let k = 1; k < 4; k++) { g.moveTo(wx - ww / 2, top + (wh * k) / 4); g.lineTo(wx + ww / 2, top + (wh * k) / 4); } g.stroke();
        g.fillStyle = 'rgba(255,250,220,0.9)'; g.beginPath(); g.arc(wx + 36, top + 80, 22, 0, TAU); g.fill();
        g.restore();
      }
      // wainscoting
      gr = g.createLinearGradient(0, 560, 0, 800); gr.addColorStop(0, '#6b3e22'); gr.addColorStop(1, '#3a2112');
      g.fillStyle = gr; g.fillRect(-600, 560, 3120, 240); g.fillStyle = BRASS; g.fillRect(-600, 552, 3120, 10);
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 4; for (let x = -560; x < 2500; x += 200) { rr(g, x, 590, 170, 160, 10); g.stroke(); }
      // chandelier
      const sw = Math.sin(t * 0.8) * 0.03;
      g.save(); g.translate(960, -300); g.rotate(sw); g.strokeStyle = '#c99a3a'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 340); g.stroke();
      g.translate(0, 340); g.fillStyle = '#e8b04a'; g.beginPath(); g.ellipse(0, 0, 120, 22, 0, 0, TAU); g.fill();
      for (let i = -4; i <= 4; i++) { const lx = i * 28; g.fillStyle = '#fff5d6'; g.fillRect(lx - 4, -30, 8, 24); g.fillStyle = `rgba(255,210,110,${0.7 + 0.3 * Math.sin(t * 9 + i)})`; g.beginPath(); g.ellipse(lx, -38, 5, 9, 0, 0, TAU); g.fill(); }
      g.restore();
    }
    function floor(g) {
      const gr = g.createLinearGradient(0, 800, 0, 1300); gr.addColorStop(0, '#8c5530'); gr.addColorStop(1, '#3a2112');
      g.fillStyle = gr; g.fillRect(-600, 800, 3120, 700);
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 3; g.beginPath(); for (let i = -16; i <= 16; i++) { g.moveTo(960 + i * 80, 800); g.lineTo(960 + i * 240, 1400); } g.stroke();
      g.fillStyle = BRASS; g.fillRect(-600, 794, 3120, 8);
    }
    function deb(g, x, y, sc, col, label, t, talk, jump = 0) {
      g.save(); g.translate(x, y); g.scale(sc, sc);
      const bob = Math.sin(t * (talk ? 9 : 2) + x) * (talk ? 6 : 2) - jump * 30;
      // a silhouette debater behind the desk
      g.save(); g.translate(0, -300 + bob);
      g.fillStyle = col; rr(g, -60, 40, 120, 110, 40); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-16, 40); g.lineTo(0, 70); g.lineTo(16, 40); g.closePath(); g.fill();
      g.fillStyle = '#f1c9a5'; g.beginPath(); g.arc(0, 0, 58, 0, TAU); g.fill();
      g.fillStyle = '#3a2112'; g.beginPath(); g.arc(0, -16, 60, Math.PI * 1.05, Math.PI * 1.95); g.fill();
      g.fillStyle = '#24160c'; g.beginPath(); g.arc(-20, 6, 7, 0, TAU); g.arc(20, 6, 7, 0, TAU); g.fill();
      g.strokeStyle = '#24160c'; g.lineWidth = 5; g.beginPath(); if (talk) g.ellipse(0, 30, 12, 6 + 6 * Math.abs(Math.sin(t * 12)), 0, 0, TAU); else g.arc(0, 26, 12, 0.2, Math.PI - 0.2); g.stroke();
      g.restore();
      g.fillStyle = '#6b3e22'; g.beginPath(); g.moveTo(-130, -130); g.lineTo(130, -130); g.lineTo(146, 0); g.lineTo(-146, 0); g.closePath();
      const dg = g.createLinearGradient(0, -130, 0, 0); dg.addColorStop(0, '#9a5e34'); dg.addColorStop(1, '#4a2814'); g.fillStyle = dg; g.fill();
      g.fillStyle = BRASS; rr(g, -144, -146, 288, 20, 7); g.fill();
      g.fillStyle = col; rr(g, -96, -104, 192, 60, 12); g.fill();
      text(g, label, 0, -73, 40, '#fff', { font: SIGN, max: 180 });
      g.fillStyle = col; g.fillRect(-146, -10, 292, 10);
      g.restore();
    }
    function bubble(g, x, y, str, k, side, px = 46) {
      if (k <= 0) return;
      const s = back(k);
      g.save(); g.translate(x, y); g.scale(s, s);
      g.font = `${px}px ${SIGN}`; const w = g.measureText(str).width + px * 1.3, h = px * 1.9;
      g.fillStyle = '#fff'; rr(g, -w / 2, -h / 2, w, h, h / 2); g.fill();
      g.beginPath(); g.moveTo(side * w * 0.04 - px * 0.4, h / 2 - 4); g.lineTo(-side * w * 0.12, h / 2 + px); g.lineTo(side * w * 0.04 + px * 0.4, h / 2 - 4); g.closePath(); g.fill();
      text(g, str, 0, 3, px, side < 0 ? '#2f6fe0' : '#e03042', { font: SIGN });
      g.restore();
    }
    function bigGavel(g, x, y, sc, a) {
      g.save(); g.translate(x, y); g.scale(sc, sc);
      g.fillStyle = '#3a2112'; g.beginPath(); g.ellipse(0, 26, 110, 28, 0, 0, TAU); g.fill();
      g.fillStyle = '#8c5530'; g.beginPath(); g.ellipse(0, 8, 110, 28, 0, 0, TAU); g.fill(); g.fillStyle = BRASS; g.fillRect(-110, 6, 220, 8);
      g.save(); g.translate(180, -16); g.rotate(-a);
      g.fillStyle = '#6b3e22'; rr(g, -240, -11, 240, 22, 11); g.fill();
      g.save(); g.translate(-240, 0); g.fillStyle = '#7a4826'; rr(g, -42, -64, 84, 128, 14); g.fill(); g.fillStyle = BRASS; g.fillRect(-42, -48, 84, 12); g.fillRect(-42, 36, 84, 12); g.restore();
      g.restore(); g.restore();
    }
    function logo(g, s, lit) {
      const w = 760, h = 270;
      if (lit > 0.5) { g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(0, 0, 60, 0, 0, 560); rg.addColorStop(0, `rgba(255,215,122,${0.28 * lit})`); rg.addColorStop(1, 'rgba(255,215,122,0)'); g.fillStyle = rg; g.fillRect(-600, -600, 1200, 1200); g.restore(); }
      g.strokeStyle = '#000'; g.lineWidth = 6; g.beginPath(); g.moveTo(-220, -h / 2); g.lineTo(-220, -h / 2 - 300); g.moveTo(220, -h / 2); g.lineTo(220, -h / 2 - 300); g.stroke();
      g.fillStyle = '#3a2112'; rr(g, -w / 2 - 14, -h / 2 - 14, w + 28, h + 28, 30); g.fill();
      g.fillStyle = BRASS; rr(g, -w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 26); g.fill();
      const pg = g.createLinearGradient(0, -h / 2, 0, h / 2); pg.addColorStop(0, '#7a4826'); pg.addColorStop(1, '#4a2814');
      g.fillStyle = pg; rr(g, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 20); g.fill();
      for (const [nx, ny] of [[-w / 2 + 30, -h / 2 + 30], [w / 2 - 30, -h / 2 + 30], [-w / 2 + 30, h / 2 - 30], [w / 2 - 30, h / 2 - 30]]) { g.fillStyle = BRASS2; g.beginPath(); g.arc(nx, ny, 9, 0, TAU); g.fill(); }
      g.globalAlpha = 0.3 + 0.7 * lit;
      text(g, '★ THE HONOURABLE SOCIETY OF ★', 0, -78, 28, BRASS2, { font: SIGN });
      text(g, 'DEBATE', 0, -8, 104, '#fff3dc', { font: SIGN, stroke: '#24160c', lw: 12, max: 680 });
      g.save(); g.rotate(-0.04); g.fillStyle = BRASS2; rr(g, -150, 50, 300, 78, 14); g.fill(); text(g, 'CLUB', 0, 92, 74, '#24160c', { font: SIGN }); g.restore();
      g.globalAlpha = 1;
    }
    // The moderator's lectern (the host stands behind it).
    function podium(g, s, x, y, sc) {
      g.save(); g.translate(x, y); g.scale(sc, sc);
      const dg = g.createLinearGradient(0, 0, 0, 230); dg.addColorStop(0, '#9a5e34'); dg.addColorStop(1, '#4a2814');
      g.fillStyle = dg; g.beginPath(); g.moveTo(-160, 0); g.lineTo(160, 0); g.lineTo(130, 240); g.lineTo(-130, 240); g.closePath(); g.fill();
      g.fillStyle = BRASS; rr(g, -180, -18, 360, 30, 10); g.fill();
      g.beginPath(); g.arc(0, 120, 56, 0, TAU); g.fillStyle = '#3a2112'; g.fill(); g.lineWidth = 8; g.strokeStyle = BRASS; g.stroke();
      text(g, '⚖', 0, 124, 64, BRASS2, { font: '"Segoe UI Symbol", serif' });
      g.restore();
    }
    function stage(g, s, o = {}) {
      wall(g, s.t); floor(g);
      if (o.logo !== 0) { g.save(); g.translate(960, 290); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
      if (!o.bare) { deb(g, 330, 960, 1, BLUE, o.labels ? o.labels[0] : 'FOR', s.t, o.talk === 0, o.jump || 0); deb(g, 1590, 960, 1, RED, o.labels ? o.labels[1] : 'AGAINST', s.t, o.talk === 1, o.jump || 0); }
      if (o.host !== false) s.hostAt(960, 820, 0.78);
      if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(4,6,18,${(1 - o.lights) * 0.9})`; g.fillRect(-600, -300, 3120, 1700); }
      s.spots(o.spots == null ? 0.55 : o.spots);
    }
    // The roll call: the members take their seats on the benches of the house.
    function roll(g, s, F, u, per, o) {
      s.cam(960, 540, 1); stage(g, s, { host: false, bare: true, logo: 0, lights: 0.8, spots: 0.7 });
      const tk = easeOut(u / 500);
      g.globalAlpha = tk; text(g, 'MEMBERS OF THE HOUSE', 960, 130, 84, BRASS2, { font: SIGN, stroke: '#24160c', lw: 12, max: 1600 }); text(g, 'take your seats!', 960, 210, 48, '#fff3dc', { font: SIGN, stroke: '#24160c', lw: 8 }); g.globalAlpha = 1;
      const n = F.length, rows = n > 8 ? 2 : 1, cols = Math.ceil(n / rows), step = Math.min(240, 1700 / Math.max(1, cols));
      for (let row = 0; row < rows; row++) { // back row first
        const by = row ? 870 : 530, bw = Math.min(1840, cols * step + 120);
        F.forEach((c, i) => {
          if (Math.floor(i / cols) !== row) return;
          const k = back((u - i * per) / 420); if (k <= 0) return;
          const rowN = row === rows - 1 ? n - row * cols : cols, col = i - row * cols, x = 960 + (col - (rowN - 1) / 2) * step, sc = Math.min(1.1, step / 200) * (rows > 1 ? 0.8 : 1);
          const hop = Math.max(0, Math.sin(s.t * 3 + i)) * 6;
          g.save(); g.translate(x, by - 40 - (1 - k) * 160); g.scale(sc, sc);
          g.fillStyle = c.color || BLUE; rr(g, -58, -150 - hop, 116, 140, 44); g.fill();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -190 - hop, 62, 0, TAU); g.fill(); g.lineWidth = 7; g.strokeStyle = c.color || BLUE; g.stroke();
          s.face(c, 0, -188 - hop, 82);
          g.restore();
        });
        // the bench in front of this row (its back hides their knees), then the name plates
        const bg = g.createLinearGradient(0, by - 70, 0, by + 70); bg.addColorStop(0, '#9a5e34'); bg.addColorStop(1, '#4a2814');
        g.fillStyle = bg; rr(g, 960 - bw / 2, by - 70, bw, 130, 14); g.fill();
        g.fillStyle = BRASS; g.fillRect(960 - bw / 2, by - 74, bw, 8);
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; for (let x = 960 - bw / 2 + 30; x < 960 + bw / 2 - 60; x += 140) { rr(g, x, by - 52, 110, 92, 8); g.stroke(); }
        F.forEach((c, i) => {
          if (Math.floor(i / cols) !== row) return;
          const k = back((u - i * per) / 420); if (k <= 0) return;
          const rowN = row === rows - 1 ? n - row * cols : cols, col = i - row * cols, x = 960 + (col - (rowN - 1) / 2) * step;
          g.globalAlpha = clamp(k);
          const w = Math.min(step * 0.92, 220);
          g.fillStyle = BRASS2; rr(g, x - w / 2, by - 30, w, 50, 8); g.fill(); g.strokeStyle = '#7a4d12'; g.lineWidth = 3; g.stroke();
          text(g, c.name, x, by - 4, 32, '#24160c', { max: w - 16 }); g.globalAlpha = 1;
        });
      }
      if (o.more && u > n * per - 1400) text(g, '…and ' + o.more + ' more!', 960, 1030, 52, BRASS2, { font: SIGN, stroke: '#24160c', lw: 8 });
    }
    Object.assign(I, {
      stage, logo, podium, roll,
      hostCam: { x: 960, y: 640, z: 1.8 },
      castOpening: [
        // 1. House lights down; one spot on the lectern; the giant gavel slams: ORDER!
        { ms: 2600, sfx: [[0, 'swell'], [1500, 'gavel'], [1950, 'gavel']],
          draw(g, s) {
            const T = s.T, slam = T < 1500 ? ss(700, 1450, T) * 0.9 : T < 1560 ? lerp(0.9, -0.1, (T - 1500) / 60) : T < 1950 ? (T < 1800 ? ss(1560, 1800, T) * 0.7 : lerp(0.7, -0.1, (T - 1800) / 150)) : 0;
            const shake = (T > 1500 && T < 1700) || (T > 1950 && T < 2150) ? (Math.random() - 0.5) * 14 : 0;
            s.cam(960 + shake, 560 + shake, 1.04 + 0.06 * ease(s.k));
            stage(g, s, { host: false, lights: T < 1500 ? 0.15 : 0.15 + 0.85 * ss(1500, 2300, T), logo: T < 1500 ? 0.15 : 1, spots: ss(1600, 2400, T) });
            g.save(); g.globalCompositeOperation = 'lighter'; const rg = g.createRadialGradient(960, 860, 0, 960, 860, 360); rg.addColorStop(0, 'rgba(255,236,190,0.45)'); rg.addColorStop(1, 'rgba(255,236,190,0)'); g.fillStyle = rg; g.beginPath(); g.ellipse(960, 860, 380, 300, 0, 0, TAU); g.fill(); g.restore();
            bigGavel(g, 900, 900, 1, slam);
            if (T > 1500) { const k = clamp((T - 1500) / 600); g.strokeStyle = `rgba(255,215,122,${0.8 * (1 - k)})`; g.lineWidth = 12 * (1 - k) + 2; g.beginPath(); g.ellipse(900, 920, 140 + k * 700, 34 + k * 160, 0, 0, TAU); g.stroke(); }
            if (T > 1500) text(g, 'ORDER!', 960, 560, 150 * back((T - 1500) / 300), BRASS2, { font: SIGN, stroke: '#24160c', lw: 16 });
            if (T > 1950) text(g, 'ORDER!', 960, 720, 110 * back((T - 1950) / 300), '#fff3dc', { font: SIGN, stroke: '#24160c', lw: 14 });
          } },
        // 2. The moderator welcomes the house.
        { ms: 2400, sfx: [[0, 'whoosh'], [200, 'cheer']], pose: [[0, 'gavel', 900], [900, 'wave', 1400]], say: 'welcome', sayAt: 100, fit: 3800, crowd: [[100, 'cheer', 2000]],
          draw(g, s) {
            const k = ease(s.T / 1700);
            s.cam(960, lerp(540, 620, k), lerp(1, 1.7, k));
            stage(g, s, { spots: 1 });
            s.backs(-60, 980, 2040, 120, 'cheer');
          } },
        // 3. Blue podium, red podium: FOR! AGAINST!
        { ms: 2200, sfx: [[0, 'whoosh'], [350, 'pop'], [1150, 'pop']],
          draw(g, s) {
            const T = s.T, k = ease(T / 2200), cx = T < 1000 ? lerp(520, 640, T / 1000) : lerp(1280, 1400, (T - 1000) / 1200);
            s.cam(cx, 700, 1.5 - 0.1 * k);
            stage(g, s, { host: false, logo: 1, talk: T < 1000 ? 0 : 1, labels: ['FOR', 'AGAINST'] });
            bubble(g, 400, 470, 'FOR!', (T - 300) / 300, -1, 64);
            bubble(g, 1520, 470, 'AGAINST!', (T - 1100) / 300, 1, 64);
          } },
      ],
    });
    return true;
  }
  if (!build()) { let n = 0; const iv = setInterval(() => { if (build() || ++n > 60) clearInterval(iv); }, 200); }
})();
