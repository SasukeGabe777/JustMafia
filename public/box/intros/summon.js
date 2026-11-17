'use strict';
// JustSummon intro: dawn breaks over an empty battlefield (sun on one side, moon on the other),
// summoning circles flare at both gates and the first troops step out, then the logo slams
// down between a sun and a moon with a clash of sparks. The roll call is the two armies
// assembling: commanders march in under their team banner, alternating sides (the same split
// the game uses). No host: a narrator reads the lines. Engine + API: public/box/show.js.
(function () {
  // Phones load this file too (for the tutorial) without the intro engine: fall back to local helpers.
  const ST = BOX.studio || null, U0 = (ST && ST.util) || {};
  const clamp = U0.clamp || ((v, a = 0, b = 1) => (v < a ? a : v > b ? b : v)), lerp = U0.lerp || ((a, b, t) => a + (b - a) * t);
  const ease = U0.ease || ((t) => t), easeOut = U0.easeOut || ((t) => 1 - Math.pow(1 - clamp(t), 3)), back = U0.back || ((t) => clamp(t));
  const A = () => BOX.summonArt;
  const TROOPS = ['spear', 'archer', 'rider', 'shield', 'mage', 'knight'];

  function field(g, s, o = {}) {
    const a = A(); if (!a) { g.fillStyle = '#1b1040'; g.fillRect(-600, -300, 3120, 1700); return; }
    g.fillStyle = '#120a28'; g.fillRect(-600, -300, 3120, 1700);
    a.paintScene(g, 1920, 1080, s.t, {});
    a.fortress(g, 0, 150, 790, [{ hp: 1, max: 1 }, { hp: 1, max: 1 }, { hp: 1, max: 1 }, { hp: 1, max: 1 }], s.t, { glow: o.glow || 0 });
    a.fortress(g, 1, 1770, 790, [{ hp: 1, max: 1 }, { hp: 1, max: 1 }, { hp: 1, max: 1 }, { hp: 1, max: 1 }], s.t, { glow: o.glow || 0 });
  }
  function circle(g, x, y, k, team, t) {
    const a = A(), col = team ? '79,227,255' : '255,210,63';
    a.glow(g, x, y, 160 * k, col, 0.6 * k);
    g.save(); g.translate(x, y); g.scale(1, 0.3); g.rotate(t * 1.5 * (team ? -1 : 1));
    g.strokeStyle = `rgba(${col},${0.9 * k})`; g.lineWidth = 6;
    g.beginPath(); g.arc(0, 0, 110 * k, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(0, 0, 80 * k, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 6; i++) { const r = (i / 6) * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(r) * 80 * k, Math.sin(r) * 80 * k); g.lineTo(Math.cos(r + 2.1) * 80 * k, Math.sin(r + 2.1) * 80 * k); g.stroke(); }
    g.restore();
  }
  function logo(g, s, k) {
    const a = A(); if (!a) return; const kk = back(clamp(k, 0, 1));
    g.save(); g.scale(kk, kk);
    a.glow(g, -330, -10, 150, '255,210,63', 0.7); a.glow(g, 330, -10, 150, '79,227,255', 0.6);
    g.fillStyle = '#ffe9a8'; a.circ(g, -330, -10, 54); g.fill();
    g.fillStyle = '#eef1ff'; g.beginPath(); g.arc(330, -10, 56, -Math.PI / 2, Math.PI / 2, true); g.quadraticCurveTo(295, -10, 330, -66); g.closePath(); g.fill();
    a.text(g, 'JUST', 0, -96, 80, '#fff3d6', { font: a.LOGO, stroke: a.OUT, lw: 16 });
    const gr = g.createLinearGradient(-300, 0, 300, 0); gr.addColorStop(0, '#ffb347'); gr.addColorStop(0.5, '#ffe14d'); gr.addColorStop(0.5, '#b9c2ff'); gr.addColorStop(1, '#8f7dff');
    a.text(g, 'SUMMON', 0, 10, 170, gr, { font: a.LOGO, stroke: a.OUT, lw: 24 });
    g.restore();
  }

  BOX.intros = BOX.intros || {};
  BOX.intros.summon = {
    title: 'JustSummon',
    theme: { accent: '#ffd23f', accent2: '#ff8a2a', accent3: '#8f7dff', ink: '#ffffff', fade: '#0b0820', rim: '#ffd23f', confetti: ['#ff8a2a', '#ffd23f', '#6f63ff', '#4fe3ff', '#ffffff'], spots: ['255,210,140', '180,190,255', '255,230,180', '170,200,255'] },
    host: null,
    lines: {
      welcome: 'Two kingdoms. One battlefield. And a front line that only one of them will hold.',
      rise: 'At first light, the summoning circles awaken.',
      roll: 'Commanders, take your places!', more: '…and {n} more!',
      play: 'Summon wisely. Counter everything. Charge!',
    },
    stage(g, s, o = {}) { field(g, s); if (o.logo) { g.save(); g.translate(960, 330); logo(g, s, o.logo); g.restore(); } },
    logo: (g, s, lit) => logo(g, s, lit || 1),
    castOpening: [
      { ms: 2600, sfx: [[0, 'swell'], [1600, 'wind']], say: 'welcome', sayAt: 200, fit: 4200,
        draw(g, s) { s.cam(960, lerp(420, 560, ease(s.k)), lerp(1.35, 1.02, ease(s.k))); field(g, s); } },
      { ms: 2300, sfx: [[0, 'spirit'], [700, 'pop'], [1200, 'pop'], [1700, 'pop']], say: 'rise', sayAt: 100, fit: 2400,
        draw(g, s) {
          const a = A(); s.cam(960, 600, 1.05); field(g, s, { glow: s.k });
          for (const team of [0, 1]) {
            const gx = team ? 1640 : 280; circle(g, gx, 830, easeOut(s.k * 2), team, s.t);
            for (let i = 0; i < 4; i++) {
              const at = 0.2 + i * 0.17, k = clamp((s.k - at) / 0.3, 0, 1); if (!k) continue;
              const x = gx + (team ? -1 : 1) * (40 + k * 120 + i * 70);
              a.drawUnit(g, TROOPS[(i + team) % 4], team, x, 850 + (i % 2) * 22, 1.1, team ? -1 : 1, { ph: s.t * 8 + i, alpha: k, flash: 1 - k });
            }
          }
        } },
      { ms: 2100, sfx: [[0, 'thunder'], [120, 'boom'], [700, 'cheer']],
        draw(g, s) {
          s.cam(960, 520, 1.02); field(g, s, { glow: 0.5 });
          g.save(); g.translate(960, 380); logo(g, s, clamp(s.T / 420, 0, 1)); g.restore();
          if (s.T < 240) { g.fillStyle = `rgba(255,250,230,${0.85 * (1 - s.T / 240)})`; g.fillRect(-600, -300, 3120, 1700); }
          const k = back((s.T - 700) / 400); if (k > 0) { g.save(); g.translate(960, 600); g.scale(k, k); A().text(g, 'SUMMON · COUNTER · PUSH THE LINE', 0, 0, 46, '#fff', { font: A().BODY, weight: 700, stroke: '#1b1030', lw: 9 }); g.restore(); }
        } },
    ],
    // Roll call: the two armies assemble under their banners, one commander at a time.
    roll(g, s, featured, u, per, o = {}) {
      const a = A(); if (!a) return;
      g.save(); g.setTransform(s.base[0], 0, 0, s.base[0], s.base[1], s.base[2]);
      field(g, s, { glow: 0.4 });
      g.fillStyle = 'rgba(10,6,25,0.35)'; g.fillRect(-600, -300, 3120, 1700);
      a.text(g, 'THE ARMIES ASSEMBLE', 960, 120, 82, '#fff36b', { font: a.LOGO, stroke: a.OUT, lw: 14 });
      const sides = [[], []]; featured.forEach((c, i) => sides[i % 2].push({ c, i }));
      for (const team of [0, 1]) {
        const P = a.TEAM[team], bx = team ? 1440 : 480;
        // the banner
        g.save(); g.translate(bx, 200);
        a.line(g, -150, 0, 150, 0, 6, '#6b3d1f');
        g.beginPath(); g.moveTo(-130, 0); g.lineTo(130, 0); g.lineTo(130, 170); g.lineTo(0, 210); g.lineTo(-130, 170); g.closePath();
        g.fillStyle = P.main; g.fill(); g.lineWidth = 5; g.strokeStyle = a.OUT; g.stroke();
        g.strokeStyle = P.trim; g.lineWidth = 3; g.stroke();
        a.emblem(g, team, 0, 80, 46); a.text(g, P.name.toUpperCase(), 0, 168, 40, '#fff', { font: a.LOGO, stroke: a.OUT, lw: 8 });
        g.restore();
        const list = sides[team], n = list.length, cols = Math.min(3, Math.max(1, n));
        list.forEach(({ c, i }, j) => {
          const at = i * per, k = clamp((u - at) / 600, 0, 1); if (u < at) return;
          const col = j % cols, row = Math.floor(j / cols), tx = bx + (col - (Math.min(cols, n - row * cols) - 1) / 2) * 250, ty = 600 + row * 190;
          const x = lerp(team ? 2200 : -280, tx, easeOut(k)), k2 = TROOPS[(i + team) % TROOPS.length];
          a.drawUnit(g, k2, team, x - (team ? -1 : 1) * 70, ty + 40, 0.9, team ? -1 : 1, { ph: k < 1 ? s.t * 10 : s.t * 2 });
          a.circ(g, x + (team ? -1 : 1) * 30, ty - 30, 42); g.fillStyle = 'rgba(15,8,30,0.85)'; g.fill(); g.lineWidth = 5; g.strokeStyle = c.color || P.main; g.stroke();
          a.text(g, c.avatar || '🙂', x + (team ? -1 : 1) * 30, ty - 28, 48, '#fff');
          if (k >= 1) a.text(g, c.name, tx, ty + 72, 34, '#fff', { font: a.BODY, weight: 700, stroke: a.OUT, lw: 7, max: 230 });
        });
      }
      a.text(g, 'VS', 960, 640, 120, '#fff', { font: a.LOGO, stroke: a.OUT, lw: 16 });
      if (o.more && u > featured.length * per - 1400) a.text(g, `…and ${o.more} more!`, 960, 1010, 54, '#ffd23f', { stroke: '#000', lw: 10 });
      g.restore();
    },
    // How to play (box/show.js 'howto' step; module howSteps: 6).
    tutorial: [
      { icon: '⚔️', title: 'Two armies, one front line', text: '☀️ Sunrise vs 🌙 Nightfall. Your troops march on their own and fight whatever they meet. The flag in the middle is the FRONT LINE.', phone: 'Check your team at the top of your phone.' },
      { icon: '💰', title: 'Summon troops with gold', text: 'Tap a troop to summon it: Spearmen cost 50, Archers 60, Riders 80, Shieldwalls 70. Each troop type has a short cooldown (the ring on its button).', phone: 'Tap a troop button. Grey = not enough gold yet.' },
      { icon: '📈', title: 'Invest for later', text: 'You earn 10 gold a second. Every summon adds a little to YOUR income for the rest of the battle, and ⛏️ Gold Mines add +3 a second. Defend now, or invest to win later?', phone: '⛏️ Gold Mine is under the troops.' },
      { icon: '🔄', title: 'Counters decide fights', text: 'Spearmen beat Riders, Riders beat Archers, Archers beat Spearmen. Shieldwalls shrug off arrows; Mages melt armour. A counter hits ×1.75: SUPER EFFECTIVE!', phone: '✔ shows what a troop beats, ✖ what beats it. Tap “Who beats who?”' },
      { icon: '⭐', title: 'Level up your team', text: 'Spending earns team XP. Tier 2 unlocks Mages, Knights, Catapults and Healers (and ☄️ Meteor); Tier 3 unlocks Giants, Dragons and Ballistas. 📯 Rally Horn boosts your whole army.', phone: 'Locked troops show 🔒 and their tier.' },
      { icon: '🏰', title: 'Smash their fortress', text: 'Troops that reach the far wall damage its keeps. Knock down every enemy keep to win, or hold the front line deepest in their land when time runs out. Last 90 seconds: ⚡ FINAL CHARGE!', phone: 'Your keep’s health is on your phone. It buzzes when it’s hit!' },
    ],
  };
})();
