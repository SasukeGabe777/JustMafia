'use strict';
// TrashZombies intro: pitch dark inside a garage, a single bulb swinging. The heavy roll-up door
// rattles, jams, then rolls up: light floods in, dust in the beam, and the street outside is
// crawling with zombies between the dumpsters. The spray-paint TRASHZOMBIES logo slaps onto the
// door. Roll call: every survivor steps out of their own garage door with their blaster.
// No host: a narrator reads the lines. Engine: public/box/show.js ('cast' mode).
// Phones load this file for the HOW TO PLAY tutorial without the engine, so nothing here touches
// BOX.studio at load time.
(function () {
  BOX.intros = BOX.intros || {};
  const TAU = Math.PI * 2, OL = '#1b1410';
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const back = (t) => { t = clamp(t); const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const LOGO = '"Lilita One", sans-serif';
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function txt(g, str, x, y, px, fill, o = {}) {
    g.font = `${px}px ${o.font || LOGO}`; g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
    if (o.max) { const w = g.measureText(str).width; if (w > o.max) { px *= o.max / w; g.font = `${px}px ${o.font || LOGO}`; } }
    if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.lw || px * 0.16; g.strokeStyle = o.stroke; g.strokeText(str, x, y); }
    g.fillStyle = fill; g.fillText(str, x, y);
  }
  // A shambling zombie, side view, facing left, feet at (x, y).
  function zombie(g, x, y, s, t, ph, skin = '#7fae6a', cloth = '#4a3a5a') {
    const sw = Math.sin(t * 4 + ph);
    g.save(); g.translate(x, y); g.scale(-s, s); g.lineCap = 'round';
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 0, 40, 10, 0, 0, TAU); g.fill();
    g.strokeStyle = OL; g.lineWidth = 14; g.beginPath(); g.moveTo(-8, -60); g.lineTo(-8 + sw * 12, 0); g.moveTo(8, -60); g.lineTo(8 - sw * 12, 0); g.stroke();
    g.fillStyle = cloth; rr(g, -22, -132, 44, 76, 10); g.fill(); g.lineWidth = 5; g.stroke();
    g.lineWidth = 13; g.beginPath(); g.moveTo(10, -116); g.lineTo(62, -120 + sw * 5); g.moveTo(10, -100); g.lineTo(58, -102 - sw * 5); g.stroke(); g.strokeStyle = skin; g.lineWidth = 7; g.stroke();
    g.fillStyle = skin; g.beginPath(); g.arc(5, -152, 24, 0, TAU); g.fill(); g.lineWidth = 5; g.strokeStyle = OL; g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(15, -157, 6, 0, TAU); g.fill(); g.fillStyle = '#c0392b'; g.beginPath(); g.arc(16, -157, 2.5, 0, TAU); g.fill();
    g.restore();
  }
  function bin(g, x, y, c, s = 1) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = c; g.strokeStyle = OL; g.lineWidth = 6; rr(g, -40, -110, 80, 110, 8); g.fill(); g.stroke(); rr(g, -48, -126, 96, 18, 6); g.fill(); g.stroke(); g.restore(); }
  // The street outside (what you see through / after the door).
  function street(g, s, o = {}) {
    let gr = g.createLinearGradient(0, -300, 0, 700); gr.addColorStop(0, '#24163a'); gr.addColorStop(0.6, '#6b3550'); gr.addColorStop(1, '#e0794a'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1000);
    g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(1500, 150, 70, 0, TAU); g.fill();
    g.fillStyle = '#2a1830'; for (let i = 0; i < 22; i++) { const x = -600 + i * 150, h = 160 + ((i * 37) % 9) * 30; g.fillRect(x, 700 - h, 130, h); g.fillStyle = 'rgba(255,220,120,0.5)'; if (i % 3 === 0) g.fillRect(x + 30, 720 - h, 20, 24); g.fillStyle = '#2a1830'; }
    gr = g.createLinearGradient(0, 700, 0, 1400); gr.addColorStop(0, '#3b3a3f'); gr.addColorStop(1, '#141216'); g.fillStyle = gr; g.fillRect(-600, 700, 3120, 800);
    g.fillStyle = '#ffd23f'; for (let x = -600; x < 2600; x += 220) g.fillRect(x, 930, 110, 14);
    g.fillStyle = '#2f8a4a'; g.strokeStyle = OL; g.lineWidth = 7; rr(g, 1450, 640, 300, 170, 8); g.fill(); g.stroke(); g.fillStyle = '#24603a'; rr(g, 1440, 618, 320, 30, 8); g.fill(); g.stroke();
    bin(g, 420, 820, '#6c7884'); bin(g, 530, 830, '#3d7a4a', 0.9); bin(g, 1880, 840, '#6c7884', 1.1);
    const n = o.zombies == null ? 9 : o.zombies;
    for (let i = 0; i < n; i++) { const x = 2300 - ((s.t * 40 + i * 230) % 1900), y = 860 + (i % 3) * 60; zombie(g, x, y, 0.9 + (i % 3) * 0.15, s.t, i * 1.7, ['#7fae6a', '#8fbf7a', '#9a8fbf', '#a6d65a'][i % 4], ['#4a3a5a', '#c0392b', '#2f6db5', '#5a4a2a'][i % 4]); }
    // drifting litter
    g.fillStyle = 'rgba(242,239,230,0.7)'; for (let i = 0; i < 14; i++) { const x = ((i * 241 + s.t * 70) % 2400) - 300, y = 760 + ((i * 97) % 500); g.save(); g.translate(x, y); g.rotate(s.t * 2 + i); g.fillRect(-10, -7, 20, 14); g.restore(); }
  }
  // Inside the garage, looking at the door from inside. open: 0 shut .. 1 up.
  function garage(g, s, open, o = {}) {
    const shake = open > 0.02 && open < 0.98 ? Math.sin(s.t * 70) * 6 : 0;
    // the outside shows through the opening
    g.save(); g.beginPath(); g.rect(300, 120, 1320, 780); g.clip(); street(g, s, { zombies: o.zombies }); g.restore();
    // walls
    g.fillStyle = '#2a2024'; g.fillRect(-600, -300, 900, 1700); g.fillRect(1620, -300, 900, 1700); g.fillRect(300, -300, 1320, 420);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; for (let y = -300; y < 1400; y += 60) { g.beginPath(); g.moveTo(-600, y); g.lineTo(300, y); g.moveTo(1620, y); g.lineTo(2520, y); g.stroke(); }
    // shelves with junk, a workbench, a hanging bulb
    g.fillStyle = '#5a3a22'; g.fillRect(-200, 380, 420, 18); g.fillRect(-200, 560, 420, 18); g.fillRect(1700, 420, 420, 18);
    for (let i = 0; i < 6; i++) { g.fillStyle = ['#c0392b', '#ffd23f', '#2f6db5', '#9cff3c', '#ff8c2e', '#c9ccd1'][i]; g.fillRect(-180 + i * 64, 330, 44, 50); }
    g.fillStyle = '#6b4520'; g.fillRect(1720, 740, 460, 40); g.fillRect(1740, 780, 24, 160); g.fillRect(2140, 780, 24, 160);
    // the door itself (slats), rolling up
    const top = 120, h = 780 * (1 - open);
    if (h > 2) {
      g.save(); g.translate(shake, 0);
      const gr = g.createLinearGradient(0, top, 0, top + h); gr.addColorStop(0, '#9aa0a8'); gr.addColorStop(1, '#c9ccd1'); g.fillStyle = gr; g.fillRect(300, top, 1320, h);
      g.strokeStyle = '#6c7178'; g.lineWidth = 6; for (let y = top + h - 8; y > top; y -= 52) { g.beginPath(); g.moveTo(300, y); g.lineTo(1620, y); g.stroke(); }
      g.fillStyle = '#4a4f56'; g.fillRect(900, top + h - 40, 120, 18);
      // light leaks under the door
      g.fillStyle = 'rgba(255,233,168,0.9)'; g.fillRect(300, top + h, 1320, Math.max(3, 8 * (1 - open)));
      if (o.logo) logoOn(g, s, o.logo, top + h - 360);
      g.restore();
    }
    g.strokeStyle = OL; g.lineWidth = 14; g.strokeRect(300, 120, 1320, 780);
    // the floor
    g.fillStyle = '#3a3a3e'; g.fillRect(-600, 900, 3120, 600);
    // the light beam + dust
    if (open > 0.05) {
      const a = Math.min(1, open * 1.4);
      const gr = g.createLinearGradient(0, 900, 0, 1400); gr.addColorStop(0, `rgba(255,233,168,${0.45 * a})`); gr.addColorStop(1, 'rgba(255,233,168,0)'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(300, 900); g.lineTo(1620, 900); g.lineTo(2000, 1400); g.lineTo(-80, 1400); g.closePath(); g.fill();
      g.fillStyle = `rgba(255,240,210,${0.6 * a})`; for (let i = 0; i < 60; i++) { const x = 300 + ((i * 137 + s.t * 20 * (1 + (i % 4))) % 1320), y = 140 + ((i * 89 + Math.sin(s.t + i) * 30) % 1200); g.fillRect(x, y, 4, 4); }
    }
    // darkness inside (lifts as the door opens), the bulb's pool of light
    const dark = clamp(0.88 - open * 1.1, 0, 0.88);
    if (dark > 0) { g.fillStyle = `rgba(6,4,3,${dark})`; g.fillRect(-600, -300, 3120, 1700); }
    const bx = 960 + Math.sin(s.t * 1.6) * 80, by = 60;
    g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.moveTo(960, -300); g.lineTo(bx, by); g.stroke();
    g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(bx, by + 16, 16, 0, TAU); g.fill();
    if (dark > 0.2) { const rg = g.createRadialGradient(bx, by + 20, 10, bx, by + 300, 520); rg.addColorStop(0, `rgba(255,230,160,${0.35 * dark})`); rg.addColorStop(1, 'rgba(255,230,160,0)'); g.fillStyle = rg; g.fillRect(-600, -300, 3120, 1700); }
  }
  function logoOn(g, s, k, y = 420) {
    g.save(); g.translate(960, y); g.rotate(-0.04); g.scale(back(k), back(k));
    txt(g, 'TRASH', -250, 0, 210, '#fff6d8', { stroke: OL, lw: 26 });
    txt(g, 'ZOMBIES', 250, 40, 210, '#9cff3c', { stroke: OL, lw: 26 });
    // paint drips
    g.fillStyle = '#9cff3c'; for (const [x, l] of [[60, 70], [190, 110], [330, 50], [440, 90]]) { g.fillRect(x, 120, 14, l * clamp(k * 2 - 1)); g.beginPath(); g.arc(x + 7, 120 + l * clamp(k * 2 - 1), 9, 0, TAU); g.fill(); }
    g.restore();
  }
  function stage(g, s, o = {}) { garage(g, s, o.game ? 1 : o.open != null ? o.open : 1, { logo: o.logo ? Math.min(1, o.logo) : 0, zombies: o.bare ? 4 : 9 }); if (o.logo && (o.open == null || o.open >= 1)) logoOn(g, s, o.logo, 300); }
  function logo(g, s, lit) { g.save(); g.globalAlpha = clamp(lit == null ? 1 : lit); g.translate(-960, -380); logoOn(g, s, 1, 380); g.restore(); }

  BOX.intros.trash = {
    title: 'TrashZombies',
    tutorial: [
      { icon: '📱', title: 'Your phone is the game', text: 'Turn your phone sideways. Drag anywhere to move. The small stick bottom-right aims and shoots. Auto-aim shoots the nearest zombie while you just move.', phone: 'Turn your phone sideways and drag to move!', say: 'Your phone is the whole game. Turn it sideways, drag anywhere to move, and use the small stick to aim. Or just move, and auto-aim does the shooting.' },
      { icon: '⬆️', title: 'Level up', text: 'Zombies drop green XP gems. Every level, pick one of 3 abilities: Attack, Defense or Special. They stack!', say: 'Zombies drop green gems. Every level up, pick one of three abilities, attack, defense or special. They stack up into your build.' },
      { icon: '🫧', title: 'Grab the pickups', text: 'Glowing pickups give a quick boost: a Bubble Shield, Trash-Can Armor, a Buzzsaw Minigun, Garbage Day and more.', say: 'Grab the glowing pickups for a quick boost, like a bubble shield, trash can armor, or a buzzsaw minigun.' },
      { icon: '🚪', title: 'Clear it, walk on', text: 'Clear the wave and the exits open. Walk out an edge into a brand-new area for the next, tougher wave. Every 5th wave, a boss.', say: 'Clear the wave and the exits open. Walk out into a brand new area for the next, tougher wave. Every fifth wave brings a boss.' },
      { icon: '🗺️', title: 'Find your friends', text: 'Everyone starts in their own garage. The TV shows the town map: walk into a friend’s area to team up and share the zombies.', say: 'Everyone starts in their own garage. The big screen shows the town map. Walk into a friend’s area to team up.' },
    ],
    theme: { accent: '#9cff3c', accent2: '#ff8c2e', accent3: '#ffd23f', ink: '#f2efe6', panel: 'rgba(24,16,20,0.92)', fade: '#0c0a08', confetti: ['#9cff3c', '#ff8c2e', '#ffd23f', '#c9ccd1', '#ff5a3c'] },
    host: null,
    lines: {
      welcome: 'It is quiet in here. Too quiet. Somebody has to open the garage door.',
      stakes: 'Out there, the whole town is trash. And the trash is walking.',
      roll: 'Survivors, step outside.', more: '…and {n} more survivors!',
      play: 'Grab your blaster, check your phone, and don’t get trashed.',
    },
    stage, logo,
    castOpening: [
      // Dark garage, a swinging bulb; the door rattles.
      { ms: 3000, sfx: [[200, 'creak'], [1500, 'rattle']], say: 'welcome', sayAt: 200,
        draw(g, s) { s.cam(960, 520, lerp(1.25, 1.1, ease(s.k))); garage(g, s, s.T > 1500 ? Math.max(0, Math.sin((s.T - 1500) / 120) * 0.02) : 0, { zombies: 9 }); } },
      // The door rolls up: light floods in, the street outside is full of zombies.
      { ms: 3200, sfx: [[0, 'drag'], [900, 'swell']], say: 'stakes', sayAt: 400,
        draw(g, s) { const k = easeOut(s.T / 2200); s.cam(960, lerp(520, 560, k), lerp(1.1, 1.0, k)); garage(g, s, k, { zombies: 9 }); if (s.T < 300) { g.fillStyle = `rgba(255,250,230,${0.4 * (1 - s.T / 300)})`; g.fillRect(-600, -300, 3120, 1700); } } },
      // The logo slaps onto the screen.
      { ms: 2400, sfx: [[0, 'boom'], [150, 'whoosh']],
        draw(g, s) { s.cam(960, 540, 1.0); garage(g, s, 1, { zombies: 9 }); g.fillStyle = 'rgba(12,8,6,0.35)'; g.fillRect(-600, -300, 3120, 1700); logoOn(g, s, clamp(s.T / 500), 420); const k = back((s.T - 800) / 400); if (k > 0) { g.save(); g.translate(960, 760); g.scale(k, k); txt(g, 'MOVE · SHOOT · LEVEL UP · DON’T GET TRASHED', 0, 0, 44, '#ffe9a8', { stroke: OL, lw: 9 }); g.restore(); } } },
    ],
    // Roll call: every survivor steps out of their own little garage door, blaster in hand.
    roll(g, s, F, u, per, o = {}) {
      s.cam(960, 540, 1);
      street(g, s, { zombies: 5 });
      g.fillStyle = 'rgba(12,8,6,0.45)'; g.fillRect(-600, -300, 3120, 1700);
      txt(g, 'THE SURVIVORS', 960, 120, 96, '#9cff3c', { stroke: OL, lw: 16 });
      const n = F.length, cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / Math.max(1, cols)), gap = Math.min(290, 1640 / Math.max(1, cols));
      F.forEach((c, i) => {
        const at = i * per, k = (u - at) / 700; if (k <= 0) return;
        const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
        const x = 960 + (col - (rowN - 1) / 2) * gap, yb = (rows > 1 ? 560 : 760) + row * 330, dw = Math.min(220, gap * 0.8), dh = rows > 1 ? 230 : 300;
        // the little garage
        g.fillStyle = '#5a3a32'; g.fillRect(x - dw / 2 - 16, yb - dh - 30, dw + 32, dh + 30); g.strokeStyle = OL; g.lineWidth = 6; g.strokeRect(x - dw / 2 - 16, yb - dh - 30, dw + 32, dh + 30);
        g.fillStyle = '#ffe9a8'; g.fillRect(x - dw / 2, yb - dh, dw, dh);
        const open = easeOut(k * 1.4), dh2 = dh * (1 - open);
        // the survivor walks out
        if (s.body) s.body(c, x, yb + lerp(-10, 30, easeOut(k)), dh * 0.82, { walking: k < 1, t: s.t + i, facing: 0.6 });
        else s.face(c, x, yb - dh * 0.4, dh * 0.4);
        g.fillStyle = '#c9ccd1'; g.fillRect(x - dw / 2, yb - dh, dw, dh2); g.strokeStyle = '#8a8f98'; g.lineWidth = 3; for (let y = yb - dh + dh2 - 6; y > yb - dh; y -= 20) { g.beginPath(); g.moveTo(x - dw / 2, y); g.lineTo(x + dw / 2, y); g.stroke(); }
        if (k >= 0.8) txt(g, c.name, x, yb + 70, 38, c.color || '#fff', { font: '"Fredoka", sans-serif', stroke: OL, lw: 8, max: gap * 0.92 });
      });
      if (o.more && u > n * per - 1400) txt(g, `…and ${o.more} more survivors!`, 960, 1020, 54, '#ffd23f', { stroke: OL, lw: 10 });
    },
  };
})();
