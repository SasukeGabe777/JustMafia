'use strict';
// JustSummon title screen: the battlefield at the turn of day and night. Sunrise troops pour out
// of the left gate, Nightfall troops out of the right, and they clash at a front line that sways
// back and forth like a rope in a tug of war (sparks fly where they meet). A dragon of each
// colour crosses the sky now and then. Art: BOX.summonArt (public/box/games/summon.js).
(function () {
  const KINDS = ['spear', 'spear', 'archer', 'rider', 'shield', 'knight', 'mage', 'giant'];
  BOX.titles.summon = {
    logo: '<span class="a">Just</span><span class="b">Summon</span>',
    tagline: 'Summon troops. Counter everything. Drag the front line into their fortress.',
    start: '⚔️ Raise your banners', meta: '2–100 players · best 2–8 · 10–20 min',
    font: "'Luckiest Guy', 'Lilita One', sans-serif",
    theme: { card: 'rgba(22, 12, 44, 0.86)', ink: '#fff3d6', muted: '#d9cfff', accent: '#ffd23f', button: '#ff8a2a', buttonInk: '#2a0f05', border: '#8f7dff' },
    css: `.bt-summon .bt-logo { font-size: clamp(56px, 9vw, 112px); line-height: 0.95; letter-spacing: 0.02em; }
      .bt-summon .bt-logo .a { display: block; font-size: 0.55em; color: #fff3d6; text-shadow: 0 5px 0 #4a1a0a; }
      .bt-summon .bt-logo .b { display: inline-block; background: linear-gradient(90deg, #ffb347, #ffe14d 50%, #b9c2ff 50%, #8f7dff); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 6px 0 #1b1030) drop-shadow(0 0 22px rgba(255, 210, 63, 0.45)); animation: btsClash 3.2s ease-in-out infinite; }
      @keyframes btsClash { 0%, 100% { transform: translateX(-6px) rotate(-1.5deg); } 50% { transform: translateX(6px) rotate(1.5deg); } }
      .bt-summon .bt-card { box-shadow: 0 0 0 4px #2a1a50, 0 0 0 8px rgba(255, 138, 42, 0.5), 0 0 70px rgba(111, 99, 255, 0.45); }`,
    init(W, H) { return { units: [], next: 0, sparks: [], last: 0, bg: null, bgKey: '', dragons: [], nextDragon: 2 }; },
    draw(g, W, H, t, S) {
      const A = BOX.summonArt; if (!A) { g.fillStyle = '#1b1040'; g.fillRect(0, 0, W, H); return; }
      const dt = Math.min(0.05, t - (S.last || t)); S.last = t;
      // the still scene, painted once per size
      const key = W + 'x' + H;
      if (S.bgKey !== key) { const c = document.createElement('canvas'); c.width = W; c.height = H; A.paintScene(c.getContext('2d'), W, H, 0, { still: true }); S.bg = c; S.bgKey = key; }
      g.drawImage(S.bg, 0, 0, W, H);
      const sc = H / 1080, gy = H * 0.79;
      A.glow(g, W * 0.1, H * 0.3, H * (0.3 + 0.03 * Math.sin(t)), '255,220,140', 0.25);
      A.fortress(g, 0, W * 0.07, gy + 40 * sc, [{ hp: 1, max: 1 }, { hp: 1, max: 1 }, { hp: 1, max: 1 }], t, {});
      // the front sways like a rope
      const front = W * (0.5 + 0.12 * Math.sin(t * 0.45) + 0.04 * Math.sin(t * 1.3));
      if (t > S.next) {
        S.next = t + 0.35 + Math.random() * 0.4;
        for (const team of [0, 1]) if (S.units.filter((u) => u.team === team).length < 14) S.units.push({ team, k: KINDS[Math.floor(Math.random() * KINDS.length)], x: team ? W * 1.02 : -W * 0.02, lane: Math.floor(Math.random() * 4), ph: Math.random() * 6, sp: 60 + Math.random() * 40, hp: 3 + Math.random() * 4 });
      }
      for (const u of S.units) {
        const dir = u.team ? -1 : 1, stop = front - dir * (24 + u.lane * 6) * sc * 2;
        if ((stop - u.x) * dir > 0) { u.x += dir * u.sp * sc * 2 * dt; u.ph += dt * 9; u.fight = false; }
        else { u.fight = true; u.hp -= dt * (0.8 + Math.random()); if (Math.random() < dt * 3) S.sparks.push({ x: front + (Math.random() - 0.5) * 40 * sc, y: gy - (40 + Math.random() * 40) * sc, t, c: u.team ? '#4fe3ff' : '#ffd23f' }); }
      }
      S.units = S.units.filter((u) => u.hp > 0 && u.x > -W * 0.1 && u.x < W * 1.1);
      S.units.sort((a, b) => a.lane - b.lane);
      A.fortress(g, 1, W * 0.93, gy + 40 * sc, [{ hp: 1, max: 1 }, { hp: 1, max: 1 }, { hp: 1, max: 1 }], t, {});
      for (const u of S.units) {
        const s = (u.k === 'giant' ? 0.75 : 1) * sc * 1.25, y = gy + u.lane * 20 * sc;
        A.drawUnit(g, u.k, u.team, u.x, y, s, u.team ? -1 : 1, u.fight ? { atk: (t * 1.6 + u.ph) % 1 } : { ph: u.ph });
      }
      // dragons cross the sky
      if (t > S.nextDragon) { S.nextDragon = t + 7 + Math.random() * 6; const team = Math.random() < 0.5 ? 0 : 1; S.dragons.push({ team, x: team ? W * 1.15 : -W * 0.15, y: H * (0.25 + Math.random() * 0.15), ph: 0 }); }
      for (const d of S.dragons) { d.x += (d.team ? -1 : 1) * W * 0.12 * dt; d.ph += dt * 7; A.drawUnit(g, 'dragon', d.team, d.x, d.y + Math.sin(d.ph * 0.4) * 10 * sc, sc * 1.1, d.team ? -1 : 1, { ph: d.ph }); }
      S.dragons = S.dragons.filter((d) => d.x > -W * 0.2 && d.x < W * 1.2);
      // the clash
      A.glow(g, front, gy - 50 * sc, 140 * sc, '255,255,220', 0.25 + 0.1 * Math.sin(t * 8));
      S.sparks = S.sparks.filter((p) => t - p.t < 0.5);
      for (const p of S.sparks) { const k = (t - p.t) / 0.5; g.globalAlpha = 1 - k; g.fillStyle = p.c; for (let i = 0; i < 5; i++) { const a = i * 1.26 + p.t * 10; g.beginPath(); g.arc(p.x + Math.cos(a) * k * 40 * sc, p.y + Math.sin(a) * k * 40 * sc, 4 * sc * (1 - k) + 1, 0, Math.PI * 2); g.fill(); } }
      g.globalAlpha = 1;
      // the front flag
      A.line(g, front, gy + 30 * sc, front, gy - 170 * sc, 4 * sc, '#e8dcc0');
      g.save(); g.translate(front, gy - 168 * sc); g.scale(sc * 1.2, sc * 1.2); const wv = Math.sin(t * 3) * 5;
      for (const team of [0, 1]) { const d = team ? 1 : -1; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(d * 24, -4 + wv, d * 50, 4 + wv); g.lineTo(d * 48, 34 + wv); g.quadraticCurveTo(d * 24, 28, 0, 34); g.closePath(); g.fillStyle = A.TEAM[team].main; g.fill(); g.lineWidth = 2.5; g.strokeStyle = A.OUT; g.stroke(); A.emblem(g, team, d * 24, 17, 9); }
      g.restore();
    },
  };
})();
