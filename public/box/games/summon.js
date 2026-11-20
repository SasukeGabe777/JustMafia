'use strict';
// JustSummon: TV, phones, the war-table lobby and the troop art (shared with the title screen
// and the intro through BOX.summonArt).
// TV: one wide side-view battlefield, dawn on the Sunrise side and starry night on the Nightfall
// side. Troops are drawn in code (one clear silhouette per troop, team colours), cached as
// bitmaps per animation frame and interpolated between the server's 5-per-second snapshots, so
// the march is smooth at 60 fps. The tug-of-war rope across the top is the hero: its knot is the
// front line. Hit sparks, arrows, boulders, fire, SUPER EFFECTIVE! pops, keep hits, meteors.
// Phone: gold and income up top (ticking live), a grid of summon buttons with costs, counter
// hints and cooldown rings, abilities and a gold mine. Taps act at once (optimistic), the
// server corrects. Buttons live in a data-keep grid so BOX.morph never rebuilds them.
(function () {
  const { esc } = BOX;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const back = (t) => { t = clamp(t, 0, 1); const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const LOGO = '"Luckiest Guy", "Lilita One", sans-serif', HUD = '"Lilita One", "Fredoka", sans-serif', BODY = '"Fredoka", system-ui, sans-serif';
  const OUT = '#1b1030';
  const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const AU = () => BOX.audio;
  const sting = (name) => { try { const a = AU(); if (a && a.stinger) return a.stinger(name, 'summon'); } catch { /* no audio */ } return false; };
  // Quiet recorded sound effects (public/audio/sfx/summon/, TV only; credits in credits.json there).
  const clip = (f, o) => { try { const a = AU(); return !!(a && a.clip && a.clip('summon/' + f, o)); } catch { return false; } };
  const CLIPS = { clash: ['sword-clash.ogg', 0.16], basehit: ['siege-thud.ogg', 0.24] }; // recorded instead of the synth stinger

  // ---------------- troops (names, icons, counters: mirrors box/games/summon.js) ----------------
  const U = {
    spear: { name: 'Spearmen', icon: '🔱', tier: 1, role: 'Cheap line infantry', beats: ['rider', 'knight'], weak: ['shield', 'giant'] },
    archer: { name: 'Archers', icon: '🏹', tier: 1, role: 'Shoots from behind, hits flyers', beats: ['spear', 'healer', 'dragon'], weak: ['shield', 'knight'], air: true },
    rider: { name: 'Riders', icon: '🐎', tier: 1, role: 'Fast raiders', beats: ['archer', 'mage', 'catapult', 'healer', 'ballista'], weak: ['spear', 'giant'] },
    shield: { name: 'Shieldwall', icon: '🛡️', tier: 1, role: 'Tough wall, shrugs off arrows', beats: ['archer'], weak: [] },
    mage: { name: 'Mages', icon: '🔮', tier: 2, role: 'Magic blasts melt armour', beats: ['shield', 'knight', 'giant'], weak: [], air: true },
    knight: { name: 'Knights', icon: '🏇', tier: 2, role: 'Heavy cavalry', beats: ['archer', 'shield', 'catapult', 'healer'], weak: ['giant'] },
    catapult: { name: 'Catapults', icon: '🪨', tier: 2, role: 'Long range, smashes walls', beats: ['spear', 'shield', 'archer'], weak: ['knight', 'giant'] },
    healer: { name: 'Healers', icon: '🌿', tier: 2, role: 'Heals the troops around them', beats: [], weak: [] },
    giant: { name: 'Giants', icon: '🗿', tier: 3, role: 'Huge, slow, wrecks melee', beats: ['spear', 'shield', 'knight', 'rider'], weak: ['mage'] },
    dragon: { name: 'Dragons', icon: '🐉', tier: 3, role: 'Flies over the ground army', beats: ['spear', 'shield', 'knight', 'giant', 'healer'], weak: [], air: true, fly: true },
    ballista: { name: 'Ballistas', icon: '🎯', tier: 3, role: 'Giant bolts: dragon & giant slayer', beats: ['dragon', 'giant', 'knight'], weak: ['spear', 'archer'], air: true },
  };
  const KEYS = Object.keys(U);
  const RANGED = { archer: 'arrow', mage: 'orb', catapult: 'rock', ballista: 'bolt', dragon: 'fire', healer: 'heal' };
  const feared = (k) => KEYS.filter((a) => U[a].beats.includes(k) && (!U[k].fly || U[a].air));
  const ABIL = [{ k: 'rally', name: 'Rally Horn', icon: '📯', tier: 1, cost: 120 }, { k: 'meteor', name: 'Meteor', icon: '☄️', tier: 2, cost: 250 }];
  const TEAM = [
    { name: 'Sunrise', icon: '☀️', main: '#ff8a2a', light: '#ffc857', dark: '#8f2d10', cloth: '#e0442a', trim: '#ffe08a', metal: '#f4e3c1', glow: '#ffd23f', ink: '#fff3d6', skin: '#f6c9a0', horse: '#9a5a2e', mane: '#3b1d0c', dragon: '#e2452b', belly: '#ffc857' },
    { name: 'Nightfall', icon: '🌙', main: '#6f63ff', light: '#a9b8ff', dark: '#1f1763', cloth: '#4334c4', trim: '#7ff0ff', metal: '#d3dbff', glow: '#4fe3ff', ink: '#e8ecff', skin: '#eac6a8', horse: '#3d3a56', mane: '#d9dcff', dragon: '#5a3fd6', belly: '#9be8ff' },
  ];

  // ---------------- drawing helpers ----------------
  function rr(g, x, y, w, h, r) { r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function fs(g, fill, lw = 2.6) { g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = OUT; g.stroke(); }
  function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
  function line(g, x1, y1, x2, y2, w, col) { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineCap = 'round'; g.lineWidth = w + 3; g.strokeStyle = OUT; g.stroke(); g.lineWidth = w; g.strokeStyle = col; g.stroke(); }
  // A crescent (lit side left): outer arc via the left, inner curve back.
  function moon(g, x, y, r) { g.beginPath(); g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, true); g.quadraticCurveTo(x - r * 0.62, y, x, y - r); g.closePath(); }
  function emblem(g, team, x, y, r) {
    const P = TEAM[team];
    if (team === 0) { g.fillStyle = P.trim; circ(g, x, y, r * 0.5); g.fill(); g.strokeStyle = P.trim; g.lineWidth = r * 0.18; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.65, y + Math.sin(a) * r * 0.65); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); } }
    else { g.fillStyle = P.trim; moon(g, x, y, r * 0.85); g.fill(); }
  }
  function text(g, str, x, y, px, fill, o = {}) {
    g.font = `${o.weight || ''} ${px}px ${o.font || HUD}`; g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'middle';
    if (o.max) { let p = px; while (p > 8 && g.measureText(str).width > o.max) { p -= 1; g.font = `${o.weight || ''} ${p}px ${o.font || HUD}`; } }
    if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.lw || px * 0.18; g.strokeStyle = o.stroke; g.strokeText(str, x, y); }
    g.fillStyle = fill; g.fillText(str, x, y);
  }
  function glow(g, x, y, r, rgb, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }

  // People: feet at (0,0), facing right, ~58 units tall.
  function legs(g, P, ph, o = {}) {
    const s = Math.sin(ph) * 0.55, hip = o.hip || -22;
    for (const [k, col] of [[-1, P.dark], [1, P.dark]]) {
      const a = s * k, fx = Math.sin(a) * -hip, fy = Math.cos(a) * -hip + hip;
      line(g, 0, hip, fx, fy, o.w || 6, col);
      g.fillStyle = '#3a2418'; rr(g, fx - 3, fy - 3, 9, 5, 2); g.fill();
    }
  }
  function torso(g, P, o = {}) { rr(g, -9, (o.top || -44), 18, 24, 6); fs(g, o.col || P.cloth); g.fillStyle = P.trim; g.fillRect(-9, (o.top || -44) + 17, 18, 3); }
  function head(g, P, y = -52, o = {}) {
    circ(g, 1, y, 8.5); fs(g, P.skin);
    g.fillStyle = OUT; circ(g, 5, y - 1, 1.5); g.fill();
    if (o.helm === 'round') { g.beginPath(); g.arc(1, y - 1, 9.5, Math.PI, 0); g.closePath(); fs(g, P.metal); g.fillStyle = P.cloth; g.beginPath(); g.ellipse(-2, y - 12, 8, 4, -0.3, 0, TAU); g.fill(); g.stroke(); }
    if (o.helm === 'hood') { g.beginPath(); g.moveTo(-9, y + 6); g.quadraticCurveTo(-12, y - 14, 4, y - 12); g.quadraticCurveTo(10, y - 8, 9, y - 2); g.lineTo(-2, y - 4); g.closePath(); fs(g, o.col || P.cloth); }
    if (o.helm === 'visor') { g.beginPath(); g.arc(1, y, 10, Math.PI * 0.9, Math.PI * 2.1); g.closePath(); fs(g, P.metal); g.fillStyle = OUT; g.fillRect(2, y - 2, 8, 2.5); }
  }
  const ART = {
    spear(g, P, a) {
      legs(g, P, a.ph); torso(g, P); head(g, P, -52, { helm: 'round' });
      const th = a.atk >= 0 ? Math.sin(Math.PI * a.atk) * 12 : 0;
      line(g, -10 + th, -30, 44 + th, -42, 3, '#8a5a2b');
      g.beginPath(); g.moveTo(44 + th, -47); g.lineTo(56 + th, -44.5); g.lineTo(44 + th, -38); g.closePath(); fs(g, P.metal, 2);
      line(g, 2, -36, 10 + th * 0.6, -34, 4, P.skin);
    },
    archer(g, P, a) {
      legs(g, P, a.ph); g.fillStyle = '#6b3d1f'; rr(g, -15, -48, 7, 22, 2); fs(g, '#6b3d1f', 2); g.fillStyle = P.metal; for (let i = 0; i < 3; i++) g.fillRect(-15 + i * 2.5, -52, 1.6, 5);
      torso(g, P, { col: P.dark }); head(g, P, -52, { helm: 'hood' });
      const pull = a.atk >= 0 ? Math.sin(Math.PI * a.atk) * 8 : 0;
      g.beginPath(); g.moveTo(14, -62); g.quadraticCurveTo(28, -42, 14, -20); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#a0682c'; g.stroke();
      g.beginPath(); g.moveTo(14, -62); g.lineTo(14 - pull, -41); g.lineTo(14, -20); g.lineWidth = 1.2; g.strokeStyle = '#f5f0e0'; g.stroke();
      line(g, 0, -38, 14 - pull, -41, 4, P.skin);
    },
    rider(g, P, a) { horse(g, P, a, false); line(g, -2, -66, 6, -58, 4, P.skin); rr(g, -8, -78, 15, 20, 5); fs(g, P.cloth); head(g, P, -84, { helm: 'round' }); const th = a.atk >= 0 ? Math.sin(Math.PI * a.atk) * 10 : 0; line(g, 2, -68, 36 + th, -76 + th * 0.6, 3, P.metal); },
    shield(g, P, a) {
      legs(g, P, a.ph, { w: 7 }); rr(g, -11, -46, 22, 26, 7); fs(g, P.cloth); head(g, P, -54, { helm: 'visor' });
      const b = a.atk >= 0 ? Math.sin(Math.PI * a.atk) * 7 : 0;
      rr(g, 8 + b, -60, 17, 54, 5); fs(g, P.main); g.strokeStyle = P.trim; g.lineWidth = 2; rr(g, 11 + b, -57, 11, 48, 3); g.stroke(); emblem(g, P.idx, 16.5 + b, -34, 7);
    },
    mage(g, P, a) {
      const sw = Math.sin(a.ph) * 3;
      g.beginPath(); g.moveTo(-14 + sw, 0); g.lineTo(14 + sw, 0); g.lineTo(7, -40); g.lineTo(-7, -40); g.closePath(); fs(g, P.cloth); g.fillStyle = P.trim; g.fillRect(-12 + sw, -5, 24, 3);
      head(g, P, -48); g.beginPath(); g.moveTo(-3, -44); g.lineTo(9, -44); g.lineTo(2, -30); g.closePath(); fs(g, '#f2f2f2', 1.8);
      g.beginPath(); g.moveTo(-14, -52); g.lineTo(16, -52); g.lineTo(4, -58); g.quadraticCurveTo(-2, -80, -12, -82); g.quadraticCurveTo(-4, -70, -6, -58); g.closePath(); fs(g, P.dark);
      g.fillStyle = P.trim; circ(g, -6, -66, 2.2); g.fill();
      const lift = a.atk >= 0 ? Math.sin(Math.PI * a.atk) * 8 : 0;
      line(g, 16, -2 - lift, 16, -60 - lift, 3, '#6b3d1f'); line(g, 4, -36, 16, -38 - lift, 4, P.skin);
      glow(g, 16, -66 - lift, 14 + lift, P.idx ? '79,227,255' : '255,210,63', 0.6); circ(g, 16, -66 - lift, 6); fs(g, P.glow, 2);
    },
    knight(g, P, a) {
      horse(g, P, a, true); line(g, -2, -70, 6, -62, 5, P.metal); rr(g, -9, -84, 18, 22, 5); fs(g, P.metal); g.fillStyle = P.cloth; g.fillRect(-9, -72, 18, 5);
      head(g, P, -90, { helm: 'visor' }); g.fillStyle = P.cloth; g.beginPath(); g.moveTo(-4, -100); g.quadraticCurveTo(-18, -110, -24, -96); g.quadraticCurveTo(-12, -100, -4, -96); g.fill(); g.stroke();
      const th = a.atk >= 0 ? Math.sin(Math.PI * a.atk) * 12 : 0; line(g, -10, -70, 54 + th, -80, 3.5, '#d9c9a0');
      g.fillStyle = P.main; g.beginPath(); g.moveTo(30 + th, -79); g.lineTo(44 + th, -84); g.lineTo(30 + th, -88); g.closePath(); g.fill();
    },
    catapult(g, P, a) {
      const sw = a.atk >= 0 ? Math.sin(Math.PI * clamp(a.atk * 1.4, 0, 1)) : 0, ang = -2.5 + sw * 1.9;
      rr(g, -30, -18, 60, 9, 3); fs(g, '#8b5a2b');
      g.beginPath(); g.moveTo(-14, -12); g.lineTo(0, -40); g.lineTo(14, -12); g.lineWidth = 7; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#a86d35'; g.stroke();
      const ex = Math.cos(ang) * 40, ey = -40 + Math.sin(ang) * 40;
      line(g, -Math.cos(ang) * 10, -40 - Math.sin(ang) * 10, ex, ey, 4, '#c08040');
      circ(g, ex, ey, 7); fs(g, '#6b3d1f'); if (sw < 0.5) { circ(g, ex, ey - 2, 5); fs(g, '#8d8478', 1.6); }
      rr(g, -Math.cos(ang) * 14 - 7, -40 - Math.sin(ang) * 14 - 5, 14, 12, 3); fs(g, '#5c5650');
      for (const x of [-20, 20]) { circ(g, x, -6, 9); fs(g, '#6b3d1f'); g.fillStyle = '#c08040'; circ(g, x, -6, 3); g.fill(); }
      line(g, 0, -40, 0, -64, 2, '#3a2418'); g.fillStyle = P.main; g.beginPath(); g.moveTo(0, -64); g.lineTo(16, -59); g.lineTo(0, -54); g.closePath(); fs(g, P.main, 1.6);
    },
    healer(g, P, a) {
      const sw = Math.sin(a.ph) * 2.5;
      g.beginPath(); g.moveTo(-13 + sw, 0); g.lineTo(13 + sw, 0); g.lineTo(7, -40); g.lineTo(-7, -40); g.closePath(); fs(g, '#f6f1e6'); g.fillStyle = P.main; g.fillRect(-2, -38, 4, 36);
      head(g, P, -48, { helm: 'hood', col: '#f6f1e6' });
      g.strokeStyle = P.glow; g.lineWidth = 2.5; g.beginPath(); g.ellipse(0, -66, 9, 3, 0, 0, TAU); g.stroke();
      line(g, 15, 0, 15, -58, 3, '#7a5a30'); line(g, 4, -34, 15, -36, 4, P.skin);
      const k = a.atk >= 0 ? Math.sin(Math.PI * a.atk) : 0;
      glow(g, 15, -62, 12 + k * 10, '140,255,170', 0.55 + k * 0.3);
      g.fillStyle = '#7dff9e'; g.beginPath(); g.ellipse(11, -63, 6, 3, -0.6, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.ellipse(19, -63, 6, 3, 0.6, 0, TAU); g.fill(); g.stroke();
    },
    giant(g, P, a) {
      const skin = P.idx ? '#8f93a8' : '#a3907e', s = Math.sin(a.ph) * 0.4;
      for (const k of [-1, 1]) { const ang = s * k; line(g, k * 10, -50, k * 10 + Math.sin(ang) * 46, -50 + Math.cos(ang) * 46, 16, skin); }
      g.beginPath(); g.ellipse(4, -88, 36, 42, 0.12, 0, TAU); fs(g, skin, 3);
      g.fillStyle = P.cloth; g.beginPath(); g.moveTo(-28, -60); g.lineTo(34, -60); g.lineTo(26, -36); g.lineTo(-22, -36); g.closePath(); fs(g, P.cloth, 3);
      g.strokeStyle = P.main; g.lineWidth = 5; for (const y of [-104, -92]) { g.beginPath(); g.moveTo(-10, y); g.lineTo(18, y + 4); g.stroke(); }
      circ(g, 22, -132, 15); fs(g, skin, 3); g.fillStyle = OUT; circ(g, 29, -134, 2.4); g.fill(); g.fillRect(24, -126, 10, 2.5);
      g.fillStyle = '#efe6d2'; for (const x of [12, 30]) { g.beginPath(); g.moveTo(x, -145); g.lineTo(x - 4, -158); g.lineTo(x + 5, -147); g.closePath(); g.fill(); g.stroke(); }
      const sw = a.atk >= 0 ? Math.sin(Math.PI * a.atk) : 0, ang = -1.9 + sw * 2.2;
      const hx = 30 + Math.cos(ang) * 30, hy = -100 + Math.sin(ang) * 30;
      line(g, 26, -104, hx, hy, 12, skin);
      g.save(); g.translate(hx, hy); g.rotate(ang + Math.PI / 2); rr(g, -9, -62, 18, 66, 9); fs(g, '#7a4a22', 3); g.fillStyle = '#5a3416'; for (let i = 0; i < 3; i++) { circ(g, (i - 1) * 5, -50 + i * 8, 2.5); g.fill(); } g.restore();
    },
    dragon(g, P, a) {
      const f = Math.sin(a.ph), body = P.dragon, wing = P.dark;
      g.beginPath(); g.moveTo(-30, -2); g.quadraticCurveTo(-62, 8, -78, -10 + f * 4); g.lineTo(-70, -2); g.quadraticCurveTo(-56, 14, -28, 6); g.closePath(); fs(g, body);
      g.beginPath(); g.moveTo(-80, -10 + f * 4); g.lineTo(-92, -16 + f * 4); g.lineTo(-86, -4 + f * 4); g.closePath(); fs(g, P.main, 2);
      g.beginPath(); g.moveTo(-8, -10); g.quadraticCurveTo(-26, -40 - f * 34, -60, -40 - f * 40); g.quadraticCurveTo(-44, -26 - f * 18, -40, -14 - f * 6); g.quadraticCurveTo(-28, -18, -20, -4); g.closePath(); fs(g, wing);
      g.beginPath(); g.ellipse(-4, 0, 34, 15, -0.08, 0, TAU); fs(g, body, 3);
      g.fillStyle = P.belly; g.beginPath(); g.ellipse(-2, 7, 26, 6, -0.08, 0, Math.PI); g.fill();
      g.beginPath(); g.moveTo(22, -8); g.quadraticCurveTo(36, -24, 44, -22); g.lineTo(50, -12); g.quadraticCurveTo(38, -6, 28, 6); g.closePath(); fs(g, body);
      g.beginPath(); g.moveTo(40, -28); g.quadraticCurveTo(58, -30, 66, -20); g.lineTo(64, -12); g.quadraticCurveTo(52, -10, 42, -12); g.closePath(); fs(g, body);
      const jaw = a.atk >= 0 ? Math.sin(Math.PI * a.atk) * 5 : 0;
      g.beginPath(); g.moveTo(44, -12); g.lineTo(62, -12 + jaw); g.lineTo(46, -6 + jaw); g.closePath(); fs(g, P.belly, 2);
      g.fillStyle = '#fff6c0'; circ(g, 54, -22, 2.8); g.fill(); g.fillStyle = OUT; circ(g, 55, -22, 1.3); g.fill();
      g.fillStyle = P.light; for (const [x, y] of [[42, -28], [48, -30]]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x - 10, y - 12); g.lineTo(x + 4, y - 2); g.closePath(); fs(g, P.light, 1.8); }
      g.beginPath(); g.moveTo(4, -10); g.quadraticCurveTo(10, -46 - f * 36, -14, -62 - f * 40); g.quadraticCurveTo(-6, -36 - f * 16, -16, -12); g.closePath(); fs(g, wing);
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(2, -12); g.quadraticCurveTo(0, -36 - f * 26, -12, -56 - f * 36); g.stroke();
      for (const x of [-14, 8]) line(g, x, 10, x + 3, 20, 4, body);
    },
    ballista(g, P, a) {
      const rec = a.atk >= 0 ? Math.sin(Math.PI * a.atk) * -6 : 0;
      rr(g, -30, -20, 52, 10, 3); fs(g, '#7a4a22'); for (const x of [-20, 12]) { circ(g, x, -8, 9); fs(g, '#5a3416'); g.fillStyle = '#c08040'; circ(g, x, -8, 3); g.fill(); }
      line(g, -6, -20, -10, -40, 5, '#a86d35'); rr(g + 0 && g, -30 + rec, -48, 66, 9, 3); fs(g, '#a86d35');
      g.beginPath(); g.moveTo(28 + rec, -70); g.quadraticCurveTo(40 + rec, -44, 28 + rec, -18); g.lineWidth = 7; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 4; g.strokeStyle = P.metal; g.stroke();
      g.beginPath(); g.moveTo(28 + rec, -70); g.lineTo(-10 + rec * 2, -44); g.lineTo(28 + rec, -18); g.lineWidth = 1.4; g.strokeStyle = '#f5f0e0'; g.stroke();
      if (a.atk < 0 || a.atk > 0.6) { line(g, -14, -44, 46, -44, 3, '#6b3d1f'); g.beginPath(); g.moveTo(46, -49); g.lineTo(58, -44); g.lineTo(46, -39); g.closePath(); fs(g, P.metal, 2); }
      g.fillStyle = P.main; g.beginPath(); g.moveTo(-26, -48); g.lineTo(-26, -66); g.lineTo(-12, -60); g.lineTo(-26, -54); g.fill(); g.stroke();
    },
  };
  function horse(g, P, a, armored) {
    const ph = a.ph * 1.6;
    for (const [x, o] of [[-18, 0], [-12, 1.6], [16, 3.1], [22, 4.7]]) { const s = Math.sin(ph + o) * 0.6; line(g, x, -26, x + Math.sin(s) * 14, -26 + Math.cos(s) * 24, 5, P.horse); }
    g.beginPath(); g.moveTo(-28, -36); g.quadraticCurveTo(-46, -30, -44, -14); g.quadraticCurveTo(-38, -26, -28, -28); g.closePath(); fs(g, P.mane, 2);
    g.beginPath(); g.ellipse(0, -36, 30, 13, 0, 0, TAU); fs(g, P.horse, 3);
    g.beginPath(); g.moveTo(18, -44); g.lineTo(32, -66); g.lineTo(46, -60); g.lineTo(50, -50); g.lineTo(38, -48); g.lineTo(28, -32); g.closePath(); fs(g, P.horse, 3);
    g.fillStyle = OUT; circ(g, 40, -59, 1.6); g.fill();
    g.fillStyle = P.mane; g.beginPath(); g.moveTo(32, -66); g.quadraticCurveTo(20, -60, 16, -44); g.lineTo(22, -46); g.quadraticCurveTo(26, -58, 34, -62); g.fill();
    if (armored) { g.beginPath(); g.moveTo(-26, -46); g.lineTo(24, -46); g.lineTo(28, -24); g.lineTo(-28, -24); g.closePath(); fs(g, P.cloth, 2.5); g.fillStyle = P.trim; for (let x = -24; x < 26; x += 8) { g.beginPath(); g.moveTo(x, -24); g.lineTo(x + 4, -19); g.lineTo(x + 8, -24); g.fill(); } emblem(g, P.idx, 0, -36, 7); g.beginPath(); g.moveTo(30, -66); g.lineTo(44, -62); g.lineTo(40, -52); g.lineTo(30, -56); g.closePath(); fs(g, P.metal, 2); }
    else { rr(g, -14, -50, 22, 10, 3); fs(g, P.cloth, 2); }
  }
  TEAM.forEach((P, i) => { P.idx = i; });
  // Bounding boxes for the cached bitmaps (local units: feet at 0, facing right).
  const BOX_OF = { spear: [-24, -82, 86, 92], archer: [-24, -78, 60, 88], rider: [-52, -112, 112, 122], shield: [-20, -78, 52, 88], mage: [-22, -96, 50, 106], knight: [-52, -122, 124, 132], catapult: [-46, -84, 92, 96], healer: [-20, -86, 48, 96], giant: [-50, -200, 132, 210], dragon: [-100, -112, 172, 140], ballista: [-38, -84, 104, 94] };
  // Cached animation frames: walk (8 frames) and attack (6 frames) per troop, team and size.
  const sprites = new Map();
  function sprite(k, team, pose, f, px) {
    px = Math.max(0.25, Math.round(px * 8) / 8);
    const key = k + team + pose + f + '|' + px; let c = sprites.get(key);
    if (c) return c;
    if (sprites.size > 1400) sprites.clear();
    const [bx, by, bw, bh] = BOX_OF[k];
    c = document.createElement('canvas'); c.width = Math.ceil(bw * px); c.height = Math.ceil(bh * px);
    const g = c.getContext('2d'); g.scale(px, px); g.translate(-bx, -by); g.lineJoin = 'round';
    try { ART[k](g, TEAM[team], pose === 'atk' ? { ph: 0, atk: f / 5 } : { ph: (f / 8) * TAU, atk: -1 }); } catch (e) { console.error(e); }
    c.bx = bx; c.by = by; c.px = px; sprites.set(key, c); return c;
  }
  // Draw troop k at (x, y) at scale s, facing dir (1 right / -1 left).
  function drawUnit(g, k, team, x, y, s, dir, o = {}) {
    const atk = o.atk != null && o.atk >= 0 && o.atk <= 1;
    const f = atk ? Math.min(5, Math.floor(o.atk * 6)) : ((Math.floor((o.ph || 0) / TAU * 8) % 8) + 8) % 8;
    const c = sprite(k, team, atk ? 'atk' : 'walk', f, s * (o.res || 1));
    const w = c.width / c.px * s, h = c.height / c.px * s;
    g.save(); g.translate(x, y); g.scale(dir, 1);
    if (o.alpha != null) g.globalAlpha = o.alpha;
    g.drawImage(c, c.bx * s, c.by * s, w, h);
    if (o.flash) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = o.flash * 0.6; g.drawImage(c, c.bx * s, c.by * s, w, h); }
    g.restore();
  }
  // Phone/lobby icons: a troop as an image URL.
  const iconCache = new Map();
  function iconUrl(k, team, size = 64) {
    const key = k + team + size; let u = iconCache.get(key); if (u) return u;
    const [bx, by, bw, bh] = BOX_OF[k], s = (size * 0.92) / Math.max(bw, bh);
    const c = document.createElement('canvas'); c.width = size; c.height = size; const g = c.getContext('2d');
    g.translate(size / 2 - (bx + bw / 2) * s, size / 2 - (by + bh / 2) * s); g.scale(s, s); g.lineJoin = 'round';
    try { ART[k](g, TEAM[team], { ph: 0.6, atk: -1 }); } catch { /* fine */ }
    u = c.toDataURL(); iconCache.set(key, u); return u;
  }

  // ---------------- the battlefield backdrop (cached per size) ----------------
  const VW = 1920, VH = 1080, GROUND = 760, FX0 = 150, FX1 = 1770;
  const X = (x) => FX0 + (x / 1000) * (FX1 - FX0);
  const laneY = (lane) => GROUND + 10 + lane * 30, US = 1.4;
  let bgCache = null;
  function backdrop(W, H, dpr, surge, gy) {
    const key = W + 'x' + H + '@' + dpr + (surge ? 's' : '') + gy;
    if (bgCache && bgCache.key === key) return bgCache.c;
    const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    paintScene(g, W, H, 0, { surge, still: true, gy });
    bgCache = { key, c }; return c;
  }
  // The scene in a W×H box: dawn sky on the left fading into night on the right.
  function paintScene(g, W, H, t, o = {}) {
    const sky = g.createLinearGradient(0, 0, W, 0);
    if (o.surge) { sky.addColorStop(0, '#7a2a1a'); sky.addColorStop(0.5, '#3b1838'); sky.addColorStop(1, '#120a30'); }
    else { sky.addColorStop(0, '#ff9f5a'); sky.addColorStop(0.28, '#f6728a'); sky.addColorStop(0.55, '#6a4a9a'); sky.addColorStop(0.78, '#2a2a6e'); sky.addColorStop(1, '#0d0c2e'); }
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    const v = g.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(10,6,30,0.35)'); v.addColorStop(0.55, 'rgba(10,6,30,0)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    // sun and moon
    const sy = H * 0.3;
    glow(g, W * 0.1, sy, H * 0.35, '255,220,140', 0.55); g.fillStyle = '#ffe9a8'; circ(g, W * 0.1, sy, H * 0.07); g.fill();
    glow(g, W * 0.9, sy * 0.8, H * 0.25, '170,190,255', 0.35); g.fillStyle = '#eef1ff'; moon(g, W * 0.9, sy * 0.8, H * 0.06); g.fill();
    // stars on the night side
    let r = 7; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    for (let i = 0; i < 90; i++) { const x = W * (0.55 + rnd() * 0.45), y = H * rnd() * 0.55, tw = o.still ? 0.7 : 0.5 + 0.5 * Math.sin(t * 2 + i); g.globalAlpha = ((x / W - 0.5) * 2) * tw; g.fillStyle = '#fff'; g.fillRect(x, y, 2, 2); }
    g.globalAlpha = 1;
    // mountains, hills
    const ridge = (base, amp, col, seed, jag) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += W / 60) { const k = x / W * 10 + seed; g.lineTo(x, base - amp * (0.5 + 0.3 * Math.sin(k * 1.7) + 0.2 * Math.sin(k * 4.3 + jag))); } g.lineTo(W, H); g.closePath(); g.fill(); };
    const mt = g.createLinearGradient(0, 0, W, 0); mt.addColorStop(0, '#b24a5a'); mt.addColorStop(0.5, '#5a3a7a'); mt.addColorStop(1, '#1c1a4a');
    ridge(H * 0.58, H * 0.22, mt, 1, 2);
    const hl = g.createLinearGradient(0, 0, W, 0); hl.addColorStop(0, '#7a3a3a'); hl.addColorStop(0.5, '#3e2d5c'); hl.addColorStop(1, '#17163a');
    ridge(H * 0.66, H * 0.1, hl, 5, 1);
    // ground
    const gy = o.gy != null ? o.gy - 22 : H * (GROUND / VH) - H * 0.02;
    const gr = g.createLinearGradient(0, gy, 0, H); gr.addColorStop(0, '#5f7a3a'); gr.addColorStop(0.3, '#46602c'); gr.addColorStop(1, '#22301a');
    g.fillStyle = gr; g.fillRect(0, gy, W, H - gy);
    const tint = g.createLinearGradient(0, 0, W, 0); tint.addColorStop(0, 'rgba(255,170,90,0.22)'); tint.addColorStop(0.5, 'rgba(0,0,0,0)'); tint.addColorStop(1, 'rgba(40,40,140,0.38)');
    g.fillStyle = tint; g.fillRect(0, gy, W, H - gy);
    // the road the armies march along
    g.fillStyle = 'rgba(160,120,70,0.45)'; g.fillRect(0, gy + H * 0.03, W, H * 0.1);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 160; i++) { const x = rnd() * W, y = gy + rnd() * (H - gy); g.fillRect(x, y, 3 + rnd() * 6, 2); }
    g.fillStyle = 'rgba(140,200,90,0.35)'; for (let i = 0; i < 220; i++) { const x = rnd() * W, y = gy + rnd() * H * 0.03; g.fillRect(x, y - 4, 2, 5); }
  }
  // A fortress at the edge: a wall with one tower per keep (up to 8 drawn), banners, damage.
  // JustGold gear: a player's castle banner (paint { a, b, pattern, icon, glow }), or null for the
  // team's plain flag. Flown over their keep's tower and shown next to their name on the TV.
  const gearBanner = (k) => (window.MT_GEAR && k ? MT_GEAR.paint('summon', 'banner', k.gear) : null);
  function bannerGear(g, b, dir, th, wv, P) {
    const a = b.a || P.main, c = b.b || '#fff';
    g.save();
    if (b.glow) { g.shadowColor = c; g.shadowBlur = 16; }
    const path = () => { g.beginPath(); g.moveTo(0, -th - 66); g.quadraticCurveTo(dir * 24, -th - 70 + wv, dir * 48, -th - 62 + wv); g.lineTo(dir * 46, -th - 30 + wv); g.quadraticCurveTo(dir * 22, -th - 38 - wv, 0, -th - 34); g.closePath(); };
    path(); g.fillStyle = a; g.fill(); g.shadowBlur = 0;
    g.save(); path(); g.clip(); g.fillStyle = c; g.globalAlpha = 0.85;
    if (b.pattern === 'stripes') for (let s = -10; s < 60; s += 12) g.fillRect(dir > 0 ? s : -s - 5, -th - 74, 5, 50);
    else if (b.pattern === 'stars') for (let s = 0; s < 5; s++) { circ(g, dir * (8 + s * 9), -th - 60 + (s % 2) * 22 + wv * 0.5, 1.8); g.fill(); }
    else if (b.pattern === 'flame') { g.fillStyle = c; g.beginPath(); g.moveTo(0, -th - 34); for (let s = 0; s <= 4; s++) g.lineTo(dir * s * 12, -th - 40 - (s % 2 ? 12 : 2) + wv * s / 4); g.lineTo(dir * 48, -th - 30 + wv); g.closePath(); g.fill(); }
    g.restore();
    path(); g.lineWidth = 2.5; g.strokeStyle = P.main; g.stroke(); // the team colour edge keeps sides clear
    if (b.icon) text(g, b.icon, dir * 22, -th - 50 + wv * 0.5, 20, '#fff');
    g.restore();
  }
  function fortress(g, team, x, base, keeps, t, o = {}) {
    const P = TEAM[team], dir = team === 0 ? 1 : -1, n = Math.max(1, Math.min(8, keeps.length || 1));
    const hp = keeps.length ? keeps.reduce((a, k) => a + k.hp, 0) / keeps.reduce((a, k) => a + k.max, 0) : 1;
    g.save(); g.translate(x + (o.shake || 0) * Math.sin(t * 60), base);
    // towers behind the wall (two rows when many keeps)
    for (let i = 0; i < n; i++) {
      const k = keeps[Math.floor((i * keeps.length) / n)] || { hp: 1, max: 1 }, row = n > 4 ? (i % 2) : 0, col = n > 4 ? Math.floor(i / 2) : i, cols = n > 4 ? Math.ceil(n / 2) : n;
      const tx = -dir * (20 + (cols - 1 - col) * (120 / Math.max(1, cols))) - dir * row * 24, th = 210 + row * 40 - (i % 3) * 14;
      const down = k.ghost || k.hp <= 0, hpk = k.hp / k.max;
      g.save(); g.translate(tx, 0);
      if (down) {
        g.fillStyle = '#4a4458'; g.beginPath(); g.moveTo(-26, -70); g.lineTo(-18, -96); g.lineTo(-6, -80); g.lineTo(6, -104); g.lineTo(20, -86); g.lineTo(26, -70); g.lineTo(26, 0); g.lineTo(-26, 0); g.closePath(); fs(g, '#4a4458', 3);
        for (let j = 0; j < 3; j++) { const sm = (t * 0.6 + j / 3 + i * 0.17) % 1; g.fillStyle = `rgba(60,55,70,${0.5 * (1 - sm)})`; circ(g, Math.sin(j + t) * 8, -100 - sm * 90, 10 + sm * 20); g.fill(); }
      } else {
        rr(g, -26, -th, 52, th, 4); fs(g, team ? '#6a6f95' : '#c9a98a', 3);
        g.fillStyle = 'rgba(0,0,0,0.15)'; for (let y = -th + 20; y < 0; y += 22) g.fillRect(-26, y, 52, 2);
        for (let j = 0; j < 4; j++) { rr(g, -28 + j * 15, -th - 14, 11, 16, 2); fs(g, team ? '#6a6f95' : '#c9a98a', 2.5); }
        g.fillStyle = '#1b1030'; rr(g, -7, -th + 34, 14, 22, 7); g.fill(); g.fillStyle = `rgba(255,${team ? 230 : 200},120,${0.6 + 0.4 * Math.sin(t * 3 + i)})`; rr(g, -4, -th + 38, 8, 16, 4); g.fill();
        // banner
        line(g, 0, -th - 14, 0, -th - 60, 2.5, '#3a2418');
        const wv = Math.sin(t * 4 + i) * 4, gb = gearBanner(k);
        if (gb) bannerGear(g, gb, dir, th, wv, P); // the keep owner's gear banner (JustGold shop)
        else {
          g.fillStyle = P.main; g.beginPath(); g.moveTo(0, -th - 58); g.quadraticCurveTo(dir * 18, -th - 62 + wv, dir * 36, -th - 54 + wv); g.lineTo(dir * 34, -th - 34 + wv); g.quadraticCurveTo(dir * 16, -th - 40 - wv, 0, -th - 36); g.closePath(); fs(g, P.main, 2);
          emblem(g, team, dir * 16, -th - 47 + wv * 0.5, 7);
        }
        if (hpk < 0.6) { g.strokeStyle = OUT; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-10, -th * 0.7); g.lineTo(2, -th * 0.55); g.lineTo(-4, -th * 0.45); g.lineTo(8, -th * 0.3); g.stroke(); }
        if (hpk < 0.3) for (let j = 0; j < 4; j++) { const fl = (t * 2 + j * 0.25 + i * 0.3) % 1; g.fillStyle = `rgba(255,${120 + j * 30},40,${1 - fl})`; circ(g, -10 + j * 7, -th - 4 - fl * 30, 6 * (1 - fl) + 2); g.fill(); }
      }
      g.restore();
    }
    // the front wall and the gate
    const wh = 120; rr(g, -dir * 150 - (dir > 0 ? 0 : 0), -wh, dir * 0 + 175, wh, 4);
    g.beginPath(); g.rect(dir > 0 ? -150 : -25, -wh, 175, wh); fs(g, team ? '#575b80' : '#b08d6c', 3);
    g.fillStyle = 'rgba(0,0,0,0.14)'; for (let y = -wh + 18; y < 0; y += 20) for (let xx = (dir > 0 ? -150 : -25) + ((y / 20) % 2 ? 0 : 18); xx < (dir > 0 ? 25 : 150); xx += 36) g.fillRect(xx, y, 30, 2);
    for (let j = 0; j < 7; j++) { const bx = (dir > 0 ? -150 : -25) + j * 25.5; rr(g, bx, -wh - 16, 18, 18, 2); fs(g, team ? '#575b80' : '#b08d6c', 2.5); }
    g.beginPath(); g.moveTo(-4 * dir - 18, 0); g.lineTo(-4 * dir - 18, -54); g.arc(-4 * dir, -54, 18, Math.PI, 0); g.lineTo(-4 * dir + 18, 0); g.closePath(); fs(g, '#2a1a12', 3);
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2; for (let xx = -18; xx <= 18; xx += 9) { g.beginPath(); g.moveTo(-4 * dir + xx, 0); g.lineTo(-4 * dir + xx, -66); g.stroke(); }
    if (o.glow) { glow(g, -4 * dir, -30, 80, team ? '79,227,255' : '255,200,80', 0.5 * o.glow); }
    g.restore();
    return hp;
  }

  // ---------------- TV ----------------
  const TV = { el: null, cv: null, raf: 0, W: 0, H: 0, dpr: 1, snaps: [], rt: 0, last: 0, vis: new Map(), parts: [], pops: [], shots: [], evSeen: 0, evQ: [], banner: null, shake: [0, 0], s: null, dead: new Set(), knot: 500, knotV: 0, wheelUntil: 0, tierCards: null, lastSnd: {}, meteor: [], overAt: 0, seenTicker: 0 };
  const now = () => performance.now();
  function sndOnce(name, gap) { const t = now(); if (TV.lastSnd[name] && t - TV.lastSnd[name] < gap) return; TV.lastSnd[name] = t; if (CLIPS[name] && clip(CLIPS[name][0], { vol: CLIPS[name][1] })) return; if (!sting(name)) BOX.sfx({ summon: 'pop', clash: 'hit', basehit: 'boom', arrow: 'arrow', slash: 'slash' }[name] || name); }
  function ensureTv(el) {
    if (TV.el === el && el.querySelector('#sm-cv')) return;
    TV.el = el; el.innerHTML = '<div class="sm-tv"><canvas id="sm-cv" class="sm-cv"></canvas><div class="sm-ov" id="sm-ov"></div></div>';
    TV.cv = el.querySelector('#sm-cv'); TV.snaps = []; TV.vis.clear(); TV.evSeen = 0; TV.evQ = []; TV.parts = []; TV.pops = []; TV.shots = []; TV.banner = null; TV.dead.clear(); TV.W = 0;
    cancelAnimationFrame(TV.raf);
    const loop = () => { if (!document.body.contains(TV.cv)) { TV.raf = 0; return; } try { frame(); } catch (e) { console.error(e); } TV.raf = requestAnimationFrame(loop); };
    TV.raf = requestAnimationFrame(loop);
  }
  function parseSnap(s) {
    const m = new Map(), u = s.u || [];
    for (let i = 0; i + 8 < u.length + 0.5 && i + 8 <= u.length - 1 + 1; i += 9) m.set(u[i], { id: u[i], k: KEYS[u[i + 1]], t: u[i + 2], x: u[i + 3], hp: u[i + 4], n: u[i + 5], atk: u[i + 6], tx: u[i + 7], lane: u[i + 8] });
    return { tk: s.tk, at: now(), u: m };
  }
  function tvState(el, s) {
    ensureTv(el);
    const prevPhase = TV.s && TV.s.phase;
    TV.s = s;
    if (s.phase !== 'over') TV.overAt = 0; else if (!TV.overAt) TV.overAt = now();
    const sn = parseSnap(s), last = TV.snaps[TV.snaps.length - 1];
    if (!last || sn.tk > last.tk) { TV.snaps.push(sn); if (TV.snaps.length > 6) TV.snaps.shift(); }
    else if (last && sn.tk < last.tk) { TV.snaps = [sn]; TV.rt = sn.tk; TV.evSeen = 0; }
    if (!TV.rt || prevPhase !== s.phase && s.phase === 'battle' && TV.rt < sn.tk - 10) TV.rt = sn.tk - 3;
    for (const e of s.ev || []) if (e.s > TV.evSeen) { TV.evSeen = e.s; TV.evQ.push(e); }
    overlay(s);
  }
  function overlay(s) {
    const ov = TV.el.querySelector('#sm-ov');
    if (s.phase !== 'over' || !s.result) { BOX.morph(ov, ''); return; }
    const r = s.result, w = r.winner, st = s.standings || [];
    const why = w < 0 ? 'Neither army would give an inch.' : r.reason === 'fortress' ? `${TEAM[1 - w].name}'s fortress has fallen!` : r.reason === 'front' ? `They held the line deep in ${TEAM[1 - w].name} land when time ran out.` : `The front was dead even, but their fortress stood stronger.`;
    const col = (t) => `<div class="sm-res-col t${t} ${w === t ? 'win' : ''}"><h3>${TEAM[t].icon} ${TEAM[t].name}</h3>${st.filter((x) => x.team === t).slice(0, 8).map((x, i) => `<div class="sm-res-row"><span class="n">${i + 1}</span><span class="av">${face(x, 34)}</span><span class="nm">${esc(x.name)}${x.ghost ? ' 👻' : ''}</span><span class="st">⚔️ ${x.dmg}  🏚️ ${x.base}</span><b>${x.score}</b></div>`).join('')}</div>`;
    const mvp = st[0];
    BOX.morph(ov, `<div class="sm-end ${w >= 0 ? 't' + w : 'draw'}"><div class="sm-end-top"><small>${w < 0 ? 'STALEMATE' : 'VICTORY'}</small><h2>${w < 0 ? '🤝 A DRAW!' : `${TEAM[w].icon} ${TEAM[w].name.toUpperCase()} WINS!`}</h2><p>${esc(why)}</p></div>
      <div class="sm-end-mid">${mvp ? `<div class="sm-mvp t${mvp.team}"><small>⭐ MVP</small><div class="av">${fig(mvp, 150, { mood: 'grin' })}</div><b>${esc(mvp.name)}</b><span>${mvp.score} pts</span></div>` : ''}
      <div class="sm-awards">${(r.awards || []).map((a) => `<div class="sm-aw t${a.team}"><i>${esc(a.icon)}</i><div><b>${esc(a.title)}</b><span>${BOX.hasLook && BOX.hasLook(a) ? face(a, 26) + ' ' : ''}${esc(a.name)}</span><small>${esc(a.why)}</small></div></div>`).join('')}</div></div>
      <div class="sm-res">${col(0)}${col(1)}</div></div>`);
  }

  // One frame: time, events, the scene, troops, effects, HUD.
  function frame() {
    const s = TV.s, cv = TV.cv; if (!s || !cv) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (TV.W !== W || TV.H !== H || TV.dpr !== dpr) { TV.W = W; TV.H = H; TV.dpr = dpr; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'), t = now() / 1000, dt = Math.min(0.1, TV.last ? t - TV.last : 0.016); TV.last = t;
    // the render clock trails the newest snapshot by ~3 ticks and glides
    const snaps = TV.snaps, newest = snaps[snaps.length - 1];
    if (newest) {
      const target = newest.tk + (now() - newest.at) / 100 - 3;
      TV.rt += dt * 10 * (s.phase === 'battle' ? 1 : 0);
      TV.rt += (target - TV.rt) * Math.min(1, dt * 3);
      TV.rt = clamp(TV.rt, snaps[0].tk, newest.tk + 0.9);
    }
    const rt = TV.rt;
    while (TV.evQ.length && (TV.evQ[0].tk <= rt + 0.5 || s.phase !== 'battle' || TV.evQ.length > 50)) applyEvent(TV.evQ.shift(), s);
    // world → screen: fit 1920×1080 (cover the width, centre vertically)
    const sc = Math.min(W / VW, H / VH), ox = (W - VW * sc) / 2, oy = (H - VH * sc) / 2;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(backdrop(W, H, dpr, s.surge, Math.round(oy + GROUND * sc)), 0, 0, W, H);
    g.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * ox + (TV.shake[0] ? (Math.random() - 0.5) * TV.shake[0] * 14 : 0), dpr * oy + (TV.shake[0] ? (Math.random() - 0.5) * TV.shake[0] * 10 : 0));
    TV.shake[0] = Math.max(0, TV.shake[0] - dt * 2.2);
    // front-line knot (smoothed) and the territory tint
    TV.knot += (s.front - TV.knot) * Math.min(1, dt * 2.5); TV.knotV = lerp(TV.knotV, s.front - TV.knot, 0.1);
    const fx = X(TV.knot);
    let gr = g.createLinearGradient(fx - 140, 0, fx + 140, 0); gr.addColorStop(0, 'rgba(255,150,60,0.20)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(90,80,255,0.24)');
    g.fillStyle = gr; g.fillRect(FX0 - 200, GROUND - 20, FX1 - FX0 + 400, 200);
    g.fillStyle = 'rgba(255,150,60,0.16)'; g.fillRect(-400, GROUND - 20, fx - 140 + 400, 200);
    g.fillStyle = 'rgba(90,80,255,0.2)'; g.fillRect(fx + 140, GROUND - 20, VW + 400 - fx, 200);
    // fortresses
    const T0 = s.teams[0], T1 = s.teams[1], keepFlash = TV.keepFlash || [0, 0];
    const hp0 = fortress(g, 0, 150, GROUND + 30, T0.keeps, t, { shake: keepFlash[0] > 0 ? 3 : 0, glow: T0.rally ? 1 : 0 });
    const hp1 = fortress(g, 1, 1770, GROUND + 30, T1.keeps, t, { shake: keepFlash[1] > 0 ? 3 : 0, glow: T1.rally ? 1 : 0 });
    keepFlash[0] = Math.max(0, keepFlash[0] - dt); keepFlash[1] = Math.max(0, keepFlash[1] - dt); TV.keepFlash = keepFlash;
    fortBar(g, 0, 150, GROUND - 270, hp0, T0); fortBar(g, 1, 1770, GROUND - 270, hp1, T1);
    // front banner on the field
    frontFlag(g, fx, GROUND + 6, t);
    // troops
    drawTroops(g, rt, t, s);
    drawShots(g, dt);
    drawParts(g, dt);
    drawMeteors(g, dt, t);
    drawPops(g, dt);
    hud(g, s, t);
    if (s.phase === 'ready') readyCard(g, s, t);
    else if (TV.wheelUntil > now() && TV.tierCards) tierCard(g, t);
    drawBanner(g, t);
    if (s.phase === 'over') { g.fillStyle = `rgba(8,4,20,${0.55 * clamp((now() - TV.overAt) / 1200, 0, 1)})`; g.fillRect(-400, -200, VW + 800, VH + 400); }
  }
  function fortBar(g, team, x, y, hp, T) {
    const P = TEAM[team], w = 220, bx = x - w / 2;
    rr(g, bx - 4, y - 4, w + 8, 30, 10); g.fillStyle = 'rgba(15,8,30,0.75)'; g.fill();
    rr(g, bx, y, w, 22, 8); g.fillStyle = '#2a1f3a'; g.fill();
    if (hp > 0) { rr(g, bx, y, Math.max(10, w * hp), 22, 8); const gg = g.createLinearGradient(0, y, 0, y + 22); gg.addColorStop(0, hp < 0.3 ? '#ff6b6b' : P.light); gg.addColorStop(1, hp < 0.3 ? '#c0182f' : P.main); g.fillStyle = gg; g.fill(); }
    text(g, `${P.icon} ${Math.round(hp * 100)}%`, x, y + 11, 18, '#fff', { stroke: OUT, lw: 4 });
    const down = T.keeps.filter((k) => k.ghost).length;
    if (down) text(g, `${down} keep${down === 1 ? '' : 's'} fallen`, x, y + 40, 15, '#ffb0b0', { stroke: OUT, lw: 4 });
  }
  function frontFlag(g, x, y, t) {
    glow(g, x, y - 60, 120, '255,255,255', 0.12);
    line(g, x, y + 20, x, y - 150, 4, '#e8dcc0');
    const wv = Math.sin(t * 3) * 6;
    g.save(); g.translate(x, y - 148);
    g.fillStyle = TEAM[0].main; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-24, -4 + wv, -50, 4 + wv); g.lineTo(-48, 34 + wv); g.quadraticCurveTo(-24, 28 - wv, 0, 34); g.closePath(); fs(g, TEAM[0].main, 2.5);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(24, -4 - wv, 50, 4 - wv); g.lineTo(48, 34 - wv); g.quadraticCurveTo(24, 28 + wv, 0, 34); g.closePath(); fs(g, TEAM[1].main, 2.5);
    emblem(g, 0, -24, 17 + wv * 0.5, 9); emblem(g, 1, 24, 17 - wv * 0.5, 9);
    g.restore();
    text(g, 'FRONT', x, y + 34, 18, '#fff', { stroke: OUT, lw: 5 });
  }
  // Interpolate every squad between the two snapshots around the render tick and draw them.
  function drawTroops(g, rt, t, s) {
    const snaps = TV.snaps; if (!snaps.length) return;
    let A = snaps[0], B = snaps[snaps.length - 1];
    for (let i = 0; i < snaps.length - 1; i++) if (snaps[i].tk <= rt && snaps[i + 1].tk >= rt) { A = snaps[i]; B = snaps[i + 1]; break; }
    if (rt >= B.tk) A = B;
    const f = B.tk > A.tk ? clamp((rt - A.tk) / (B.tk - A.tk), 0, 1) : 1;
    const list = [];
    for (const b of B.u.values()) {
      const a = A.u.get(b.id);
      if (!a && f < 0.5 && A !== B) continue; // not summoned yet
      let v = TV.vis.get(b.id);
      if (!v) { v = { born: now(), atkTk: -1, atkAt: -9, ph: Math.random() * TAU, lastX: b.x }; TV.vis.set(b.id, v); if (s.phase === 'battle') summonFlash(b); }
      const x = a ? lerp(a.x, b.x, f) : b.x;
      // a new attack happened between A and B: start the swing (and the projectile)
      if (a && a.atk !== b.atk && v.atkTk !== B.tk) { v.atkTk = B.tk; v.atkAt = now(); fire(b, x); }
      const moved = Math.abs(x - v.lastX); v.ph += moved * 0.35 + (b.tx < 0 ? 0 : 0); v.lastX = x;
      list.push({ u: b, x, v, hp: a ? lerp(a.hp, b.hp, f) : b.hp });
    }
    // squads that died between A and B
    for (const a of A.u.values()) if (!B.u.has(a.id) && !TV.dead.has(a.id)) {
      if (f < 0.6) { const v = TV.vis.get(a.id); if (v) list.push({ u: a, x: a.x, v, hp: 0, dying: 1 - f / 0.6 }); }
      else { TV.dead.add(a.id); death(a); TV.vis.delete(a.id); if (TV.dead.size > 3000) TV.dead.clear(); }
    }
    const flyY = (u, v) => 480 + u.lane * 26 + Math.sin(t * 2 + u.id) * 10;
    list.sort((p, q) => (U[p.u.k].fly ? 1 : 0) - (U[q.u.k].fly ? 1 : 0) || p.u.lane - q.u.lane);
    for (const it of list) {
      const { u, v } = it, k = u.k, team = u.t, dir = team === 0 ? 1 : -1, fly = U[k].fly;
      const big = US * (k === 'giant' ? 0.95 : k === 'dragon' ? 0.95 : k === 'knight' || k === 'rider' ? 0.82 : 0.9);
      const ap = (now() - v.atkAt) / 420, atk = ap >= 0 && ap <= 1 ? ap : -1;
      const y0 = fly ? flyY(u, v) : laneY(u.lane);
      const n = Math.min(5, u.n), sx = X(it.x);
      const flash = v.born && now() - v.born < 400 ? 1 - (now() - v.born) / 400 : 0;
      for (let m = n - 1; m >= 0; m--) {
        const ox = -dir * m * (fly ? 40 : k === 'giant' ? 46 : 20), oy = (m % 2 ? -8 : 6) * (m ? 1 : 0) * (fly ? 2.5 : 1);
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(sx + ox, (fly ? laneY(u.lane) + 6 : y0 + oy) + 2, fly ? 34 : k === 'giant' ? 48 : 22, 6, 0, 0, TAU); g.fill();
        drawUnit(g, k, team, sx + ox, y0 + oy, big, dir, { ph: v.ph + m * 1.3, atk: m ? (atk >= 0 ? clamp(atk - m * 0.08, -1, 1) : -1) : atk, alpha: it.dying != null ? it.dying : 1, flash: flash || (s.teams[team].rally ? 0.25 + 0.2 * Math.sin(t * 10) : 0) });
      }
      // health bar for hurt squads
      if (!it.dying && it.hp < 99) {
        const bw = 36 + n * 4, by = y0 - (k === 'giant' ? 200 : fly ? 80 : k === 'knight' ? 118 : k === 'rider' ? 104 : 86) * big;
        g.fillStyle = 'rgba(10,5,20,0.75)'; g.fillRect(sx - bw / 2 - 2, by - 2, bw + 4, 8);
        g.fillStyle = it.hp < 35 ? '#ff5b5b' : TEAM[team].light; g.fillRect(sx - bw / 2, by, (bw * it.hp) / 100, 4);
      }
      if (u.n > 5) text(g, '×' + u.n, sx, y0 + 18, 16, '#fff', { stroke: OUT, lw: 4 });
    }
  }
  function summonFlash(b) {
    const x = X(b.x), y = U[b.k].fly ? 500 : laneY(b.lane) - 40, P = TEAM[b.t];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; TV.parts.push({ x, y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 90 - 40, life: 0.6, max: 0.6, c: i % 2 ? P.glow : '#fff', r: 4 }); }
    TV.parts.push({ ring: true, x, y: y + 26, life: 0.5, max: 0.5, c: P.glow, r: 40 });
    sndOnce('summon', 160);
  }
  function death(a) {
    const x = X(a.x), y = U[a.k].fly ? 500 : laneY(a.lane) - 34, big = U[a.k].tier === 3;
    for (let i = 0; i < (big ? 30 : 10); i++) { const ang = Math.random() * TAU, sp = 40 + Math.random() * (big ? 260 : 120); TV.parts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 60, life: 0.8, max: 0.8, c: i % 3 ? 'rgba(220,210,230,0.9)' : TEAM[a.t].main, r: big ? 9 : 5, smoke: true }); }
    if (a.k === 'dragon') { TV.parts.push({ fall: true, k: a.k, t: a.t, x, y, vx: (a.t ? 1 : -1) * 40, vy: -40, life: 1.4, max: 1.4, rot: 0 }); }
  }
  // Attack visuals: melee sparks at the target, projectiles for shooters.
  function fire(b, x) {
    const sx = X(x), dir = b.t === 0 ? 1 : -1, kind = RANGED[b.k];
    const tx = b.tx >= 0 ? X(b.tx) : sx + dir * 30, fly = U[b.k].fly;
    const y = fly ? 480 + b.lane * 26 : laneY(b.lane) - 55;
    if (!kind) { setTimeout(() => spark(tx, laneY(b.lane) - 30, b.t), 180); if (Math.random() < 0.25) sndOnce('slash', 140); return; }
    if (kind === 'heal') { TV.shots.push({ kind, x0: sx, y0: y - 30, x1: tx, y1: laneY(b.lane) - 40, life: 0.5, max: 0.5, t: b.t }); return; }
    const ty = (b.tx >= 0 && Math.abs(b.tx - (b.t ? 40 : 960)) < 2) ? GROUND - 60 : laneY(Math.floor(Math.random() * 4)) - 34;
    const dist = Math.abs(tx - sx), dur = kind === 'rock' ? 0.9 : kind === 'fire' ? 0.35 : kind === 'bolt' ? 0.3 : 0.15 + dist / 1800;
    TV.shots.push({ kind, x0: sx + dir * 20, y0: kind === 'rock' ? y - 30 : y, x1: tx, y1: ty, life: dur, max: dur, t: b.t, arc: kind === 'rock' ? 220 : kind === 'arrow' ? 50 + dist * 0.12 : 0 });
    if (kind === 'arrow') sndOnce('arrow', 220); else if (kind === 'fire') sndOnce('fireBreath', 600); else if (kind === 'rock' || kind === 'bolt') sndOnce('whoosh', 300);
  }
  function spark(x, y, team) { for (let i = 0; i < 7; i++) { const a = Math.random() * TAU; TV.parts.push({ x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160 - 40, life: 0.28, max: 0.28, c: i % 2 ? '#fff6c8' : TEAM[team].glow, r: 3, star: true }); } }
  function drawShots(g, dt) {
    TV.shots = TV.shots.filter((p) => (p.life -= dt) > 0);
    for (const p of TV.shots) {
      const k = 1 - p.life / p.max, x = lerp(p.x0, p.x1, k), y = lerp(p.y0, p.y1, k) - Math.sin(Math.PI * k) * (p.arc || 0);
      const P = TEAM[p.t];
      if (p.kind === 'arrow' || p.kind === 'bolt') {
        const k2 = Math.max(0, k - 0.05), x2 = lerp(p.x0, p.x1, k2), y2 = lerp(p.y0, p.y1, k2) - Math.sin(Math.PI * k2) * (p.arc || 0), a = Math.atan2(y - y2, x - x2);
        g.save(); g.translate(x, y); g.rotate(a); const L = p.kind === 'bolt' ? 40 : 22; line(g, -L, 0, 0, 0, p.kind === 'bolt' ? 4 : 2, '#c9a06a'); g.fillStyle = '#eee'; g.beginPath(); g.moveTo(4, 0); g.lineTo(-4, -4); g.lineTo(-4, 4); g.fill(); g.restore();
      } else if (p.kind === 'orb') { glow(g, x, y, 26, p.t ? '79,227,255' : '255,210,63', 0.8); g.fillStyle = '#fff'; circ(g, x, y, 6); g.fill(); }
      else if (p.kind === 'rock') { circ(g, x, y, 10); fs(g, '#8d8478', 2.5); }
      else if (p.kind === 'fire') {
        for (let i = 0; i < 6; i++) { const q = clamp(k - i * 0.05, 0, 1), fx = lerp(p.x0, p.x1, q), fy = lerp(p.y0, p.y1, q) + Math.sin(i * 2.3) * 8; glow(g, fx, fy, 22 + i * 3, i % 2 ? '255,170,40' : (p.t ? '120,140,255' : '255,80,30'), 0.7); }
      } else if (p.kind === 'heal') { g.fillStyle = `rgba(140,255,170,${p.life / p.max})`; text(g, '+', lerp(p.x0, p.x1, 0.5), p.y1 - k * 30, 26, '#8dffaa', { stroke: OUT, lw: 4 }); }
      if (p.life - dt <= 0 && p.kind !== 'heal') {
        if (p.kind === 'rock') { for (let i = 0; i < 12; i++) { const a = Math.random() * Math.PI; TV.parts.push({ x: p.x1, y: p.y1 + 10, vx: Math.cos(a) * 180, vy: -Math.sin(a) * 200, life: 0.6, max: 0.6, c: '#9a8f80', r: 5, grav: true }); } TV.shake[0] = Math.max(TV.shake[0], 0.15); }
        else spark(p.x1, p.y1, p.t);
      }
    }
  }
  function drawParts(g, dt) {
    TV.parts = TV.parts.filter((p) => (p.life -= dt) > 0);
    if (TV.parts.length > 900) TV.parts.splice(0, TV.parts.length - 900);
    for (const p of TV.parts) {
      const k = p.life / p.max;
      if (p.ring) { g.strokeStyle = p.c; g.globalAlpha = k; g.lineWidth = 4; g.beginPath(); g.ellipse(p.x, p.y, p.r * (1.6 - k), p.r * 0.35 * (1.6 - k), 0, 0, TAU); g.stroke(); g.globalAlpha = 1; continue; }
      if (p.fall) { p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 2; g.save(); g.globalAlpha = k; g.translate(p.x, p.y); g.rotate(p.rot * (p.t ? -1 : 1)); drawUnit(g, p.k, p.t, 0, 0, 0.9, p.t ? -1 : 1, { ph: 0 }); g.restore(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; if (p.grav) p.vy += 600 * dt; else { p.vx *= 0.92; p.vy *= 0.92; }
      g.globalAlpha = k; g.fillStyle = p.c; circ(g, p.x, p.y, p.r * (p.smoke ? 2 - k : k + 0.3)); g.fill(); g.globalAlpha = 1;
    }
  }
  function drawPops(g, dt) {
    TV.pops = TV.pops.filter((p) => (p.life -= dt) > 0);
    for (const p of TV.pops) {
      const k = 1 - p.life / p.max, s = back(k * 3) * (p.small ? 0.7 : 1), y = p.y - k * 50;
      g.save(); g.globalAlpha = clamp(p.life / 0.3, 0, 1); g.translate(p.x, y); g.scale(s, s); g.rotate(p.small ? 0 : -0.06);
      if (p.icons) { const [a, d] = p.icons; const ia = sprite(a, p.t, 'walk', 0, 0.7), id = sprite(d, 1 - p.t, 'walk', 0, 0.7), sz = (c) => [c.width * 0.9 / c.px * 0.7, c.height * 0.9 / c.px * 0.7]; const [aw, ah] = sz(ia), [dw, dh] = sz(id); g.drawImage(ia, -70 - aw / 2, -30 - ah, aw, ah); text(g, '>', 0, -60, 40, '#7dff9e', { stroke: OUT, lw: 7 }); g.save(); g.scale(-1, 1); g.drawImage(id, -70 - dw / 2, -30 - dh, dw, dh); g.restore(); }
      text(g, p.text, 0, 0, p.small ? 26 : 40, p.col, { font: LOGO, stroke: OUT, lw: 8 });
      g.restore();
    }
  }
  function drawMeteors(g, dt, t) {
    TV.meteor = TV.meteor.filter((m) => (m.life -= dt) > -0.8);
    for (const m of TV.meteor) {
      if (m.life > 0) {
        const k = 1 - m.life / m.max, x = lerp(m.x + (m.t ? 500 : -500), m.x, k), y = lerp(-80, GROUND, k * k);
        for (let i = 0; i < 8; i++) glow(g, x - (m.t ? 1 : -1) * i * 30 * (1 - k * 0.3), y - i * 40, 50 - i * 4, i % 2 ? '255,160,40' : '255,90,30', 0.5);
        circ(g, x, y, 34); fs(g, '#5a3a2a', 4); g.fillStyle = '#ffb347'; circ(g, x + 6, y + 6, 14); g.fill();
        g.strokeStyle = 'rgba(255,80,40,0.6)'; g.lineWidth = 3; g.beginPath(); g.ellipse(m.x, GROUND + 40, 90 * k, 22 * k, 0, 0, TAU); g.stroke();
      } else {
        if (!m.boomed) { m.boomed = true; TV.shake[0] = 1; sndOnce('explosion', 100); for (let i = 0; i < 60; i++) { const a = Math.random() * Math.PI, sp = 100 + Math.random() * 500; TV.parts.push({ x: m.x, y: GROUND + 20, vx: Math.cos(a) * sp, vy: -Math.sin(a) * sp, life: 1.1, max: 1.1, c: i % 3 ? '#ff8a2a' : '#ffe08a', r: 7, grav: true }); } }
        const k = -m.life / 0.8; glow(g, m.x, GROUND + 10, 260 * (0.5 + k), '255,140,40', 0.9 * (1 - k));
      }
    }
  }
  function applyEvent(e, s) {
    if (e.k === 'sup') { if (TV.pops.some((p) => !p.small && Math.abs(p.x - X(e.x)) < 320 && p.life > 0.5)) return; TV.pops.push({ x: X(e.x), y: GROUND - 150, text: 'SUPER EFFECTIVE!', col: '#fff36b', life: 1.3, max: 1.3, icons: [e.a, e.d], t: e.t }); sndOnce('clash', 500); }
    else if (e.k === 'res') TV.pops.push({ x: X(e.x), y: GROUND - 120, text: 'RESISTED', col: '#c9c4d8', life: 0.9, max: 0.9, small: true, t: e.t });
    else if (e.k === 'tw') { const x0 = e.t === 0 ? 150 : 1770; for (let i = 0; i < Math.min(4, e.n); i++) TV.shots.push({ kind: 'arrow', x0: x0 + (e.t ? -1 : 1) * i * 12, y0: GROUND - 220 + i * 18, x1: X(e.x) + (Math.random() - 0.5) * 30, y1: GROUND - 10, life: 0.35 + i * 0.05, max: 0.35 + i * 0.05, t: e.t, arc: 40 }); }
    else if (e.k === 'keep') { (TV.keepFlash || (TV.keepFlash = [0, 0]))[e.t] = 0.3; TV.shake[0] = Math.max(TV.shake[0], 0.25); spark(e.t ? 1720 : 200, GROUND - 60 - Math.random() * 80, 1 - e.t); sndOnce('basehit', 700); }
    else if (e.k === 'down') { const k = s.teams[e.t].keeps.find((q) => q.id === e.id); TV.shake[0] = 1.2; clip('crumble.ogg', { vol: 0.28, pan: e.t ? 0.5 : -0.5 }); showBanner(`💥 ${k ? k.name + "'s" : 'A'} keep has fallen!`, TEAM[e.t].main, 2600); const x = e.t ? 1770 : 150; for (let i = 0; i < 50; i++) { const a = Math.random() * Math.PI, sp = 100 + Math.random() * 400; TV.parts.push({ x, y: GROUND - 120, vx: Math.cos(a) * sp, vy: -Math.sin(a) * sp, life: 1.2, max: 1.2, c: i % 2 ? '#9a8f80' : '#ff8a2a', r: 8, grav: true }); } }
    else if (e.k === 'tier') { const ks = KEYS.filter((k) => U[k].tier === e.tier); TV.tierCards = { team: e.t, tier: e.tier, keys: ks }; TV.wheelUntil = now() + 5200; }
    else if (e.k === 'rally') { showBanner(`📯 ${TEAM[e.t].name} RALLY!`, TEAM[e.t].main, 1800); }
    else if (e.k === 'meteor') { TV.meteor.push({ x: X(e.x), t: e.t, life: 0.9, max: 0.9 }); sndOnce('whoosh', 100); }
    else if (e.k === 'surge') { showBanner('⚡ FINAL CHARGE! ⚡', '#ffd23f', 3000); TV.shake[0] = 0.6; }
    else if (e.k === 'win') { if (e.t >= 0) showBanner(`🏆 ${TEAM[e.t].name.toUpperCase()} WINS!`, TEAM[e.t].main, 4000); }
  }
  function showBanner(text, col, ms) { TV.banner = { text, col, at: now(), ms }; }
  function drawBanner(g, t) {
    const b = TV.banner; if (!b) return; const k = (now() - b.at) / b.ms; if (k > 1) { TV.banner = null; return; }
    const s = back(k * 4), a = k > 0.85 ? (1 - k) / 0.15 : 1;
    g.save(); g.globalAlpha = a; g.translate(960, 300); g.scale(s, s);
    rr(g, -560, -58, 1120, 116, 30); g.fillStyle = 'rgba(15,8,30,0.85)'; g.fill(); g.lineWidth = 6; g.strokeStyle = b.col; g.stroke();
    text(g, b.text, 0, 4, 64, '#fff', { font: LOGO, stroke: OUT, lw: 10, max: 1060 });
    g.restore();
  }
  // Top HUD: team panels and the tug-of-war rope (the front line). Bottom: keeps + ticker.
  function hud(g, s, t) {
    for (const team of [0, 1]) teamPanel(g, team, s.teams[team], team ? 1400 : 20, 16, s);
    // the rope
    const x0 = 560, x1 = 1360, y = 92, kx = lerp(x0, x1, clamp((TV.knot - 40) / 920, 0, 1));
    rr(g, x0 - 30, 20, x1 - x0 + 60, 110, 24); g.fillStyle = 'rgba(15,8,30,0.72)'; g.fill();
    text(g, s.phase === 'ready' ? 'GET READY' : mmss(s.endsIn - (s.phase === 'battle' ? (now() - (TV.snaps.length ? TV.snaps[TV.snaps.length - 1].at : now())) : 0)), 960, 44, 34, s.surge ? '#ffd23f' : '#fff', { font: HUD, stroke: OUT, lw: 6 });
    if (s.surge) text(g, '⚡ FINAL CHARGE ⚡', 960, 72, 18, '#ffd23f', { stroke: OUT, lw: 4 });
    for (const [a, b, col] of [[x0, kx, TEAM[0].main], [kx, x1, TEAM[1].main]]) { line(g, a, y, b, y, 10, col); g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 2; for (let x = a; x < b; x += 14) { g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x + 8, y + 4); g.stroke(); } }
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(959, y - 18, 2, 36);
    for (const m of [0.25, 0.75]) g.fillRect(lerp(x0, x1, m) - 1, y - 10, 2, 20);
    text(g, TEAM[0].icon, x0 - 6, y, 30, '#fff'); text(g, TEAM[1].icon, x1 + 6, y, 30, '#fff');
    const pull = clamp(TV.knotV * 3, -1, 1);
    glow(g, kx, y, 44, '255,255,255', 0.35);
    circ(g, kx, y, 17); fs(g, '#fff6d6', 3.5);
    g.fillStyle = pull > 0.05 ? TEAM[0].main : pull < -0.05 ? TEAM[1].main : '#bfa77a'; circ(g, kx, y, 9); g.fill();
    if (Math.abs(pull) > 0.08) text(g, pull > 0 ? '▶' : '◀', kx + (pull > 0 ? 34 : -34), y, 24, pull > 0 ? TEAM[0].light : TEAM[1].light, { stroke: OUT, lw: 4 });
    // bottom: keeps and the ticker
    rr(g, 10, 900, 1900, 172, 22); g.fillStyle = 'rgba(15,8,30,0.72)'; g.fill();
    keepList(g, 0, s.teams[0].keeps, 24, 912); keepList(g, 1, s.teams[1].keeps, 1396, 912);
    const tk = (s.ticker || []).slice(-4);
    tk.forEach((m, i) => {
      const yy = 930 + i * 38, col = m.t === 0 ? TEAM[0].light : m.t === 1 ? TEAM[1].light : m.kind === 'tier' ? '#ffd23f' : '#fff';
      const age = i === tk.length - 1 && m.id !== TV.seenTicker ? 0 : 1; if (i === tk.length - 1) TV.seenTicker = m.id;
      void age;
      if (m.u && U[m.u]) { const c = sprite(m.u, m.t || 0, 'walk', 0, 0.42); g.drawImage(c, 584 - c.width / 2, yy - c.height + 16, c.width, c.height); }
      text(g, m.text, 610, yy, i === tk.length - 1 ? 26 : 22, col, { align: 'left', font: BODY, weight: 600, stroke: OUT, lw: 5, max: 760 });
    });
  }
  function teamPanel(g, team, T, x, y, s) {
    const P = TEAM[team], w = 500, right = team === 1, al = right ? 'right' : 'left', tx = right ? x + w - 22 : x + 22;
    rr(g, x, y, w, 118, 22); const gg = g.createLinearGradient(x, 0, x + w, 0); gg.addColorStop(right ? 1 : 0, P.dark); gg.addColorStop(right ? 0 : 1, 'rgba(15,8,30,0.7)'); g.fillStyle = gg; g.fill(); g.lineWidth = 3; g.strokeStyle = P.main; g.stroke();
    text(g, `${P.icon} ${P.name.toUpperCase()}`, tx, y + 30, 34, '#fff', { align: al, font: LOGO, stroke: OUT, lw: 6 });
    // tier pips + XP bar
    const px = right ? x + 22 : x + w - 22;
    for (let i = 1; i <= s.maxTier; i++) { const cx = right ? px + (i - 1) * 34 + 12 : px - (s.maxTier - i) * 34 - 12; circ(g, cx, y + 30, 13); fs(g, i <= T.tier ? P.glow : '#2a1f3a', 2.5); text(g, ['', 'I', 'II', 'III'][i], cx, y + 31, 13, i <= T.tier ? OUT : '#7a6f8a', { font: HUD }); }
    const bw = 220, bx = right ? x + w - 22 - bw : x + 22, by = y + 60;
    rr(g, bx, by, bw, 14, 7); g.fillStyle = '#2a1f3a'; g.fill();
    const prog = T.need ? clamp((T.xp - T.prev) / Math.max(1, T.need - T.prev), 0, 1) : 1;
    rr(g, right ? bx + bw - Math.max(14, bw * prog) : bx, by, Math.max(14, bw * prog), 14, 7); g.fillStyle = P.light; g.fill();
    text(g, T.need ? `TIER ${T.tier + 1} at ${Math.round(T.need / 100) / 10}k XP` : `TIER ${T.tier} · MAX`, right ? bx + bw : bx, by + 30, 15, P.ink, { align: al, font: BODY, weight: 600 });
    const sx = right ? x + 22 : x + w - 22;
    text(g, `💰 +${Math.round(T.income)}/s`, sx, y + 66, 22, '#ffe08a', { align: right ? 'left' : 'right', stroke: OUT, lw: 4 });
    text(g, `⚔️ ${T.troops} troops`, sx, y + 94, 18, '#fff', { align: right ? 'left' : 'right', stroke: OUT, lw: 4 });
    if (T.rally) text(g, '📯 RALLY!', x + w / 2, y + 140, 22, P.glow, { stroke: OUT, lw: 5 });
  }
  // Players are their characters: cached face images on the canvas, BOX.face / BOX.body in HTML.
  const FACES = new Map();
  const face = (p, n = 32, o) => (BOX.face ? BOX.face(p, n, o) : esc((p && p.avatar) || '🙂'));
  const fig = (p, h = 120, o) => (BOX.body ? BOX.body(p, h, o) : `<span style="font-size:${Math.round(h * 0.4)}px">${esc((p && p.avatar) || '🙂')}</span>`);
  function faceImg(p, px) {
    if (!p || !BOX.faceUrl) return null;
    const k = (p.id || p.name) + '|' + px; let e = FACES.get(k);
    if (!e) { const u = BOX.faceUrl(p, px); if (!u) return null; if (FACES.size > 200) FACES.clear(); e = Object.assign(new Image(), { src: u }); FACES.set(k, e); }
    return e.complete && e.naturalWidth ? e : null;
  }
  function keepList(g, team, keeps, x, y) {
    const P = TEAM[team], n = keeps.length, cols = n > 10 ? 3 : n > 4 ? 2 : 1, rows = Math.ceil(n / cols), cw = 500 / cols, ch = Math.min(38, 150 / Math.max(1, rows));
    keeps.forEach((k, i) => {
      const c = Math.floor(i / rows), r = i % rows, kx = x + c * cw, ky = y + r * ch, f = clamp(k.hp / k.max, 0, 1), fs2 = Math.min(22, ch * 0.62);
      const fim = k.ghost || k.ai ? null : faceImg(k, 64); // the commander's character (emoji without one)
      if (fim) { const fz = Math.min(36, ch * 1.05); g.drawImage(fim, kx + 14 - fz / 2, ky + ch / 2 - fz / 2, fz, fz); }
      else text(g, k.ghost ? '👻' : k.avatar || '🙂', kx + 14, ky + ch / 2, fs2, '#fff');
      text(g, k.name, kx + 32, ky + ch / 2 - (ch > 30 ? 6 : 0), Math.min(18, ch * 0.5), k.ghost ? '#8a809a' : '#fff', { align: 'left', font: BODY, weight: 600, max: cw * 0.5 });
      const gb = gearBanner(k); if (gb && gb.icon) text(g, gb.icon, kx + cw - 18, ky + ch / 2 - (ch > 30 ? 6 : 0), fs2 * 0.85, '#fff'); // gear banner emblem
      const bx = kx + (ch > 30 ? 32 : cw * 0.58), by = ky + (ch > 30 ? ch / 2 + 8 : ch / 2 - 4), bw = ch > 30 ? cw - 50 : cw * 0.36;
      g.fillStyle = '#2a1f3a'; g.fillRect(bx, by, bw, 7);
      g.fillStyle = f < 0.3 ? '#ff5b5b' : P.light; g.fillRect(bx, by, bw * f, 7);
    });
  }
  // Before the charge: the counter wheel and a countdown.
  function readyCard(g, s, t) {
    rr(g, 520, 160, 880, 650, 30); g.fillStyle = 'rgba(15,8,30,0.88)'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#ffd23f'; g.stroke();
    text(g, 'THE COUNTER WHEEL', 960, 204, 42, '#ffd23f', { font: LOGO, stroke: OUT, lw: 7 });
    text(g, 'Each arrow means “beats”. Summon on your phone!', 960, 246, 22, '#fff', { font: BODY, weight: 600 });
    wheel(g, 960, 495, 165, ['spear', 'rider', 'mage', 'shield', 'archer'], t);
    const left = Math.ceil(s.endsIn / 1000);
    text(g, left > 0 ? `CHARGE IN ${left}…` : 'CHARGE!', 960, 772, 40, '#fff', { font: LOGO, stroke: OUT, lw: 7 });
  }
  function wheel(g, cx, cy, R, keys, t) {
    const pos = {}; keys.forEach((k, i) => { const a = -Math.PI / 2 + (i / keys.length) * TAU; pos[k] = [cx + Math.cos(a) * R, cy + Math.sin(a) * R]; });
    for (const a of keys) for (const d of U[a].beats) if (pos[d]) {
      const [x1, y1] = pos[a], [x2, y2] = pos[d], ang = Math.atan2(y2 - y1, x2 - x1), sx = x1 + Math.cos(ang) * 58, sy = y1 + Math.sin(ang) * 58, ex = x2 - Math.cos(ang) * 62, ey = y2 - Math.sin(ang) * 62;
      const mx = (sx + ex) / 2 + Math.cos(ang + Math.PI / 2) * 18, my = (sy + ey) / 2 + Math.sin(ang + Math.PI / 2) * 18;
      g.beginPath(); g.moveTo(sx, sy); g.quadraticCurveTo(mx, my, ex, ey); g.lineWidth = 9; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 5; g.strokeStyle = '#7dff9e'; g.stroke();
      const ha = Math.atan2(ey - my, ex - mx); g.save(); g.translate(ex, ey); g.rotate(ha); g.beginPath(); g.moveTo(8, 0); g.lineTo(-12, -11); g.lineTo(-12, 11); g.closePath(); fs(g, '#7dff9e', 3); g.restore();
    }
    keys.forEach((k, i) => { const [x, y] = pos[k]; circ(g, x, y, 54); fs(g, i % 2 ? '#3a2a5a' : '#4a2f3a', 3); drawUnit(g, k, i % 2, x, y + 40, k === 'rider' ? 0.66 : 0.85, 1, { ph: t * 4 + i }); text(g, U[k].name, x, y + 70, 21, '#fff', { stroke: OUT, lw: 5 }); });
  }
  function tierCard(g, t) {
    const c = TV.tierCards, P = TEAM[c.team], k = clamp((TV.wheelUntil - now()) / 5200, 0, 1), a = k < 0.12 ? k / 0.12 : 1, s = back((1 - k) * 6);
    g.save(); g.globalAlpha = a; g.translate(960, 470); g.scale(s, s);
    const w = 260 * c.keys.length + 80;
    rr(g, -w / 2, -170, w, 340, 30); g.fillStyle = 'rgba(15,8,30,0.88)'; g.fill(); g.lineWidth = 5; g.strokeStyle = P.main; g.stroke();
    text(g, `${P.icon} ${P.name.toUpperCase()} REACHED TIER ${c.tier}!`, 0, -128, 42, '#fff', { font: LOGO, stroke: OUT, lw: 8, max: w - 40 });
    c.keys.forEach((key, i) => {
      const x = -w / 2 + 40 + 130 + i * 260;
      glow(g, x, 0, 90, c.team ? '79,227,255' : '255,210,63', 0.25);
      drawUnit(g, key, c.team, x, 50, key === 'giant' ? 0.55 : 0.9, 1, { ph: t * 6 + i });
      text(g, U[key].name, x, 84, 26, '#fff', { stroke: OUT, lw: 5 });
      text(g, 'beats ' + U[key].beats.map((b) => U[b].icon).join(' '), x, 118, 20, '#7dff9e', { font: BODY, weight: 700, stroke: OUT, lw: 4 });
      const fr = feared(key); if (fr.length) text(g, 'fears ' + fr.map((b) => U[b].icon).join(' '), x, 146, 18, '#ff9d9d', { font: BODY, weight: 700, stroke: OUT, lw: 4 });
    });
    g.restore();
  }

  // ---------------- the war-table lobby ----------------
  const FIELD_ICON = { length: '⏳', gold: '💰', pool: '🗡️', balance: '⚖️', mode: '🏳️', showIntro: '🎬' };
  let LOBBY = null, lobbyRaf = 0;
  function lobbyTv(el, L) {
    LOBBY = L;
    if (!el.querySelector('.sml')) {
      el.innerHTML = `<div class="sml"><canvas class="sml-bg"></canvas>
        <header class="sml-head"><h1><span class="a">Just</span><span class="b">Summon</span></h1><p>Summon troops · counter the enemy · drag the front line into their fortress</p></header>
        <div class="sml-grid">
          <div id="roster"></div>
          <div class="sml-map">
            <div class="sml-scroll"><div class="sml-scroll-h">📜 JOIN THE WAR</div><img id="qr" alt="QR code to join"><div class="sml-code-l">Room code</div><div class="sml-code" id="code"></div></div>
            <div class="sml-settings" id="settings"></div>
            <button class="sml-start" id="start"><span>📯 SOUND THE HORN</span><small>start the battle</small></button>
            <div class="sml-err" id="lobby-err"></div>
            <div class="sml-links"><button class="link" id="add-bots">🤖 + 5 test bots</button><button class="link" id="sml-rm">remove bots</button><button class="link" id="pick">🎮 Another game</button></div>
            <div id="sml-lineup"></div>
          </div>
        </div></div>`;
      el.querySelector('#start').onclick = async () => { const r = await LOBBY.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      el.querySelector('#add-bots').onclick = () => LOBBY.bots(5);
      el.querySelector('#sml-rm').onclick = () => LOBBY.removeBots();
      el.querySelector('#pick').onclick = () => LOBBY.pick();
      lobbyBg(el.querySelector('.sml-bg'));
    }
    el.querySelector('#code').textContent = L.code;
    const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
    const set = el.querySelector('#settings'), sig = JSON.stringify([L.settings, L.fields.map((f) => f.key)]);
    if (set.dataset.sig !== sig && !set.contains(document.activeElement && document.activeElement.tagName === 'SELECT' ? document.activeElement : null)) {
      set.dataset.sig = sig;
      set.innerHTML = L.fields.map((f) => `<label class="sml-piece"><span class="sml-seal">${FIELD_ICON[f.key] || '⚙️'}</span><span class="sml-lab">${esc(f.label)}</span><select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
      for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => LOBBY.set(s.dataset.set, s.value);
    }
    // players line up under their team banner (humans first, alternating: the game's own split)
    const ps = [...L.players.filter((p) => !p.bot), ...L.players.filter((p) => p.bot)], sides = [[], []];
    ps.forEach((p, i) => sides[i % 2].push(p));
    if (sides[0].length !== sides[1].length && L.settings.balance === 'ai') sides[sides[0].length < sides[1].length ? 0 : 1].push({ ai: true });
    const chip = (p, t) => p.ai ? `<span class="chip ai">🤖 AI ally</span>` : `<span class="chip ${p.online ? '' : 'off'}"><span class="av">${face(p, 32)}</span>${esc(p.name)}</span>`;
    const side = (t) => `<div class="sml-side t${t}"><div class="sml-banner"><div class="sml-emb">${TEAM[t].icon}</div><b>${TEAM[t].name}</b><small>${sides[t].filter((p) => !p.ai).length} commander${sides[t].filter((p) => !p.ai).length === 1 ? '' : 's'}</small></div><div class="sml-chips">${sides[t].map((p) => chip(p, t)).join('') || '<span class="sml-empty">Scan the scroll to enlist!</span>'}</div></div>`;
    BOX.morph(el.querySelector('#roster'), side(0) + side(1));
    const lu = el.querySelector('#sml-lineup'); if (lu.dataset.h !== (L.lineupHtml || '')) { lu.innerHTML = L.lineupHtml || ''; lu.dataset.h = L.lineupHtml || ''; }
    el.querySelector('#start').disabled = L.players.length < (L.min || 2);
  }
  // The lobby backdrop: the war table (wood), a parchment map with the battlefield road,
  // two castles, little troop pieces that march back and forth.
  function lobbyBg(cv) {
    cancelAnimationFrame(lobbyRaf);
    const step = () => {
      if (!document.body.contains(cv)) return;
      const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(1.5, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); const t = now() / 1000;
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#4a2a18'); gr.addColorStop(1, '#22120a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; for (let y = 0; y < H; y += 34) { g.beginPath(); g.moveTo(0, y + Math.sin(y) * 4); g.bezierCurveTo(W * 0.3, y + 8, W * 0.6, y - 8, W, y + 4); g.stroke(); }
      const mx = W * 0.04, my = H * 0.17, mw = W * 0.92, mh = H * 0.78;
      g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 30; rr(g, mx, my, mw, mh, 18); g.fillStyle = '#e9d6a8'; g.fill(); g.restore();
      gr = g.createRadialGradient(W / 2, H * 0.55, 50, W / 2, H * 0.55, mw * 0.7); gr.addColorStop(0, 'rgba(255,240,200,0)'); gr.addColorStop(1, 'rgba(120,80,30,0.45)'); g.fillStyle = gr; rr(g, mx, my, mw, mh, 18); g.fill();
      // the road between the two castles
      const ry = my + mh * 0.86;
      g.strokeStyle = 'rgba(120,80,40,0.55)'; g.lineWidth = 16; g.setLineDash([22, 14]); g.beginPath(); g.moveTo(mx + 60, ry); g.bezierCurveTo(W * 0.35, ry - 30, W * 0.65, ry + 30, mx + mw - 60, ry); g.stroke(); g.setLineDash([]);
      for (const team of [0, 1]) { const x = team ? mx + mw - 50 : mx + 50; g.save(); g.translate(x, ry + 10); g.scale(0.32, 0.32); fortress(g, team, 0, 0, [{ hp: 1, max: 1 }, { hp: 1, max: 1 }, { hp: 1, max: 1 }], t); g.restore(); }
      for (let i = 0; i < 6; i++) { const team = i % 2, k = ['spear', 'archer', 'rider'][i % 3], p = ((t * 0.05 + i / 6) % 1); const x = team ? lerp(mx + mw - 120, W / 2 + 20, p) : lerp(mx + 120, W / 2 - 20, p); drawUnit(g, k, team, x, ry + 6 + (i % 3) * 6, 0.32, team ? -1 : 1, { ph: t * 6 + i, alpha: 0.85 }); }
      g.strokeStyle = 'rgba(120,60,30,0.35)'; g.lineWidth = 2; g.beginPath(); g.arc(W / 2, ry - 10, 22, 0, TAU); g.moveTo(W / 2 - 30, ry - 10); g.lineTo(W / 2 + 30, ry - 10); g.moveTo(W / 2, ry - 40); g.lineTo(W / 2, ry + 20); g.stroke();
      lobbyRaf = requestAnimationFrame(step);
    };
    step();
  }

  // ---------------- phones ----------------
  const PH = { v: null, ctx: null, el: null, base: { gold: 0, at: 0, inc: 0 }, spentAt: 0, cdEnd: {}, abEnd: {}, raf: 0, built: '', felt: '', tier: 0, keepHp: null, lastBuzz: 0, wheel: false, team: 0, cap: 0, alive: 0 };
  const phoneGold = () => { const b = PH.base; return b.gold + (b.inc * (now() - b.at)) / 1000; };
  function phoneHaptics(v, ctx) {
    const fk = v.phase + ':' + (v.over ? (v.over.won ? 'w' : 'l') : '');
    if (PH.felt !== fk) {
      PH.felt = fk;
      if (v.phase === 'ready') ctx.haptic('turn');
      if (v.phase === 'battle') ctx.haptic('big');
      if (v.phase === 'over' && v.over) ctx.haptic(v.over.won ? 'win' : 'error');
    }
    if (v.tier && PH.tier && v.tier > PH.tier) { ctx.haptic('success'); ctx.toast(`⭐ Tier ${v.tier}! New troops: ${KEYS.filter((k) => U[k].tier === v.tier).map((k) => U[k].icon + ' ' + U[k].name).join(', ')}`); }
    PH.tier = v.tier || PH.tier;
    if (v.keep) { if (PH.keepHp != null && v.keep.hp < PH.keepHp && now() - PH.lastBuzz > 2500) { PH.lastBuzz = now(); ctx.haptic('big'); } PH.keepHp = v.keep.hp; }
  }
  // Your gear banner (JustGold shop) as a little pennant next to your side's name; '' by default.
  function phoneBanner(v) {
    const b = gearBanner(v); if (!b) return '';
    const e = BOX.esc;
    return `<svg class="sm-gearflag" width="38" height="28" viewBox="0 0 38 28" aria-hidden="true" style="vertical-align:middle;margin-left:6px${b.glow ? `;filter:drop-shadow(0 0 4px ${e(b.b || '#fff')})` : ''}"><path d="M3 2 L3 27" stroke="#3a2418" stroke-width="2.5"/><path d="M4 3 Q18 0 35 5 L34 20 Q18 15 4 19 Z" fill="${e(b.a || '#888')}" stroke="#1a1030" stroke-width="1.8"/>${b.icon ? `<text x="19" y="12.5" font-size="11" text-anchor="middle" dominant-baseline="middle">${e(b.icon)}</text>` : ''}</svg>`;
  }
  function phone(el, v, ctx) {
    if (!v) return;
    PH.v = v; PH.ctx = ctx; PH.el = el;
    phoneHaptics(v, ctx);
    if (v.watching) return BOX.morph(el, `<div class="sm-ph sm-msg"><div class="sm-big">📺</div><h3>You’re watching this battle</h3><p>Join the next one! Watch the big screen.</p></div>`);
    if (v.phase === 'over' && v.over) return phoneOver(el, v);
    PH.team = v.team;
    // server truth for gold (ignored for a moment right after a tap, unless it's lower)
    const g0 = phoneGold();
    if (now() - PH.spentAt > 450 || v.gold < g0) PH.base = { gold: v.gold, at: now(), inc: v.phase === 'battle' ? v.income : 0 };
    else PH.base.inc = v.phase === 'battle' ? v.income : 0;
    KEYS.forEach((k, i) => { const end = now() + (v.cds[i] || 0); if (!PH.cdEnd[k] || Math.abs(PH.cdEnd[k] - end) > 400 && now() - PH.spentAt > 450) PH.cdEnd[k] = end; });
    ABIL.forEach((a, i) => { PH.abEnd[a.k] = now() + (v.ab[i] || 0); });
    const P = TEAM[v.team], fort = v.fort || [100, 100], tierProg = v.need ? clamp((v.xp - v.prev) / Math.max(1, v.need - v.prev), 0, 1) : 1;
    const lead = v.team === 0 ? v.front - 500 : 500 - v.front;
    BOX.morph(el, `<div class="sm-ph t${v.team} ${v.phase === 'ready' ? 'waiting' : ''} ${v.ghost ? 'ghost' : ''}">
      <div class="sm-top"><div class="sm-team"><span>${P.icon}</span><b>${P.name}</b>${phoneBanner(v)}${v.ghost ? '<em>👻 ghost</em>' : ''}</div>
        <div class="sm-gold"><span class="ic">💰</span><b id="sm-gold" data-keep></b><small>+${Math.round(v.income * 10) / 10}/s</small></div></div>
      <div class="sm-stat">
        <div class="sm-bar" title="Your keep"><i style="width:${Math.round(100 * v.keep.hp / v.keep.max)}%"></i><span>🏰 ${v.ghost ? 'Keep fallen' : `Your keep ${Math.round(100 * v.keep.hp / v.keep.max)}%`}</span></div>
        <div class="sm-bar xp"><i style="width:${Math.round(tierProg * 100)}%"></i><span>⭐ Tier ${v.tier}${v.need ? ` → ${v.tier + 1}` : ' (max)'}</span></div>
        <div class="sm-front"><span class="l">${TEAM[0].icon} ${fort[0]}%</span><span class="rope"><i style="left:${clamp((v.front - 40) / 9.2, 0, 100)}%"></i></span><span class="r">${fort[1]}% ${TEAM[1].icon}</span></div>
        <div class="sm-hint">${v.phase === 'ready' ? `⚔️ Charge in ${Math.ceil(v.endsIn / 1000)}…` : lead > 120 ? '🔥 You’re pushing them back!' : lead < -120 ? '🛡️ Defend! Bonus damage near your fortress.' : '⚖️ The line is even.'} <span class="sm-troops">⚔️ ${v.alive}/${v.cap}</span>${v.surge ? ' <b class="sm-surge">⚡ FINAL CHARGE</b>' : ''}</div>
      </div>
      <div class="sm-grid" id="sm-grid" data-keep></div>
      <div class="sm-acts" id="sm-acts" data-keep></div>
      <button class="sm-wheel-btn" id="sm-wheel-btn">${PH.wheel ? '▲ Hide counters' : '🔄 Who beats who?'}</button>
      ${PH.wheel ? wheelHtml(v) : ''}
    </div>`);
    el.querySelector('#sm-wheel-btn').onclick = () => { PH.wheel = !PH.wheel; ctx.haptic('tap'); ctx.redraw(); };
    buildGrid(el, v);
    if (!PH.raf) PH.raf = requestAnimationFrame(phoneLoop);
    updatePhone();
  }
  const mini = (k, t) => `<img class="mi" src="${iconUrl(k, t, 40)}" alt="${esc(U[k].name)}" title="${esc(U[k].name)}">`;
  function wheelHtml(v) {
    const ks = KEYS.filter((k) => U[k].tier <= v.maxTier);
    return `<div class="sm-wheel">${ks.map((k) => `<div class="sm-wr ${U[k].tier > v.tier ? 'locked' : ''}"><img src="${iconUrl(k, v.team, 64)}" alt=""><div><b>${U[k].name}</b><small>${esc(U[k].role)}</small>
      <span class="ok">✔ ${U[k].beats.filter((b) => U[b].tier <= v.maxTier).map((b) => mini(b, 1 - v.team)).join('') || '—'}</span><span class="no">✖ ${feared(k).filter((b) => U[b].tier <= v.maxTier).map((b) => mini(b, 1 - v.team)).join('') || '—'}</span></div></div>`).join('')}
      <p class="sm-note">Flyers 🐉 can only be hit by shooters: Archers, Mages, Ballistas, Dragons and the fortress.</p></div>`;
  }
  function buildGrid(el, v) {
    const grid = el.querySelector('#sm-grid'), acts = el.querySelector('#sm-acts'), sig = v.team + ':' + v.maxTier;
    if (grid.dataset.sig !== sig) {
      grid.dataset.sig = sig;
      grid.innerHTML = KEYS.filter((k) => U[k].tier <= v.maxTier).map((k) => {
        const i = KEYS.indexOf(k), cost = v.defs[i][0];
        return `<button class="sm-u" data-u="${k}" data-cost="${cost}" data-tier="${U[k].tier}"><i class="sm-cd"></i><img src="${iconUrl(k, v.team, 80)}" alt=""><b>${U[k].name}</b><span class="sm-cost">💰${cost}</span>
          <span class="sm-ctr"><em class="ok">✔</em>${U[k].beats.filter((b) => U[b].tier <= v.maxTier).slice(0, 2).map((b) => mini(b, 1 - v.team)).join('')}${feared(k).length ? `<em class="no">✖</em>${feared(k).filter((b) => U[b].tier <= v.maxTier).slice(0, 1).map((b) => mini(b, 1 - v.team)).join('')}` : ''}</span>
          <span class="sm-lock">🔒 Tier ${U[k].tier}</span></button>`;
      }).join('');
      for (const b of grid.querySelectorAll('[data-u]')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); tapSummon(b); });
    }
    if (acts.dataset.sig !== sig) {
      acts.dataset.sig = sig;
      acts.innerHTML = `<button class="sm-a mine" data-a="mine"><i class="ic">⛏️</i><b>Gold Mine</b><small id="sm-mine-t"></small></button>` +
        ABIL.map((a) => `<button class="sm-a" data-a="${a.k}" data-cost="${a.cost}" data-tier="${a.tier}"><i class="sm-cd"></i><i class="ic">${a.icon}</i><b>${a.name}</b><small>💰${a.cost}${a.tier > 1 ? ` · Tier ${a.tier}` : ''}</small></button>`).join('');
      for (const b of acts.querySelectorAll('[data-a]')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); tapAct(b); });
    }
  }
  function tapSummon(b) {
    const v = PH.v, ctx = PH.ctx, k = b.dataset.u; if (!v || !ctx) return;
    if (v.phase !== 'battle') { ctx.haptic('warn'); return ctx.toast('Wait for the charge!'); }
    if (Number(b.dataset.tier) > v.tier) { ctx.haptic('error'); return ctx.toast(`🔒 ${U[k].name} unlock at Tier ${b.dataset.tier}. Summon more to level up your team!`); }
    if ((PH.cdEnd[k] || 0) > now() + 60) { ctx.haptic('error'); return; }
    const cost = Number(b.dataset.cost), gold = phoneGold();
    if (gold < cost) { ctx.haptic('error'); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return ctx.toast(`Need ${Math.ceil(cost - gold)} more gold`); }
    if (PH.alive >= PH.cap && PH.cap) { ctx.haptic('error'); return ctx.toast(`Troop limit reached (${PH.cap}). Wait for some to fall!`); }
    // optimistic: pay, start the cooldown, pop the button; the server confirms or undoes it
    PH.base.gold -= cost; PH.spentAt = now();
    const cd = v.defs[KEYS.indexOf(k)][1] * 1000 * (v.surge ? 0.6 : 1); PH.cdEnd[k] = now() + cd; PH.cdLen = PH.cdLen || {}; PH.cdLen[k] = cd;
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    ctx.haptic('select'); updatePhone();
    ctx.act({ op: 'summon', u: k }).then((r) => {
      if (r && r.ok) { PH.base = { gold: r.gold, at: now(), inc: PH.base.inc }; if (r.cd) PH.cdEnd[k] = now() + r.cd; PH.alive++; }
      else { PH.base.gold += cost; PH.cdEnd[k] = r && r.cd ? now() + r.cd : 0; b.classList.remove('pop'); }
      updatePhone();
    });
  }
  function tapAct(b) {
    const v = PH.v, ctx = PH.ctx, a = b.dataset.a; if (!v || !ctx) return;
    if (v.phase !== 'battle') { ctx.haptic('warn'); return ctx.toast('Wait for the charge!'); }
    if (a === 'mine') {
      if (v.mineCost == null) { ctx.haptic('error'); return ctx.toast('Your mines are maxed out!'); }
      if (phoneGold() < v.mineCost) { ctx.haptic('error'); return ctx.toast(`Need ${Math.ceil(v.mineCost - phoneGold())} more gold for a mine`); }
      PH.base.gold -= v.mineCost; PH.spentAt = now(); ctx.haptic('success');
      ctx.act({ op: 'mine' }).then((r) => { if (r && r.ok) { PH.base = { gold: r.gold, at: now(), inc: PH.base.inc + v.mineInc }; ctx.toast(`⛏️ Gold Mine ${r.mines}: +${v.mineInc} gold a second`); } else PH.base.gold += v.mineCost; updatePhone(); });
      return updatePhone();
    }
    const A = ABIL.find((x) => x.k === a); if (!A) return;
    if (A.tier > v.tier) { ctx.haptic('error'); return ctx.toast(`🔒 ${A.name} unlocks at Tier ${A.tier}.`); }
    if ((PH.abEnd[a] || 0) > now() + 60) { ctx.haptic('error'); return ctx.toast(`${A.name} is recharging (your team shares it).`); }
    if (phoneGold() < A.cost) { ctx.haptic('error'); return ctx.toast(`Need ${Math.ceil(A.cost - phoneGold())} more gold`); }
    PH.base.gold -= A.cost; PH.spentAt = now(); ctx.haptic('big');
    ctx.act({ op: 'ability', a }).then((r) => { if (r && r.ok) PH.base = { gold: r.gold, at: now(), inc: PH.base.inc }; else PH.base.gold += A.cost; updatePhone(); });
    updatePhone();
  }
  function phoneLoop() {
    if (!PH.el || !document.body.contains(PH.el) || !PH.el.querySelector('#sm-grid')) { PH.raf = 0; return; }
    updatePhone(); PH.raf = requestAnimationFrame(phoneLoop);
  }
  // Live parts of the phone: gold, affordability, cooldown rings (no morph needed).
  function updatePhone() {
    const v = PH.v, el = PH.el; if (!v || !el || v.phase === 'over') return;
    PH.cap = v.cap; if (!PH.altAt || now() - PH.altAt > 300) { PH.alive = v.alive; PH.altAt = now(); }
    const gold = Math.max(0, phoneGold()), gEl = el.querySelector('#sm-gold');
    if (gEl) { const s = String(Math.floor(gold)); if (gEl.textContent !== s) gEl.textContent = s; }
    const t = now();
    for (const b of el.querySelectorAll('.sm-u')) {
      const k = b.dataset.u, cost = Number(b.dataset.cost), locked = Number(b.dataset.tier) > v.tier;
      const left = Math.max(0, (PH.cdEnd[k] || 0) - t), len = (PH.cdLen && PH.cdLen[k]) || v.defs[KEYS.indexOf(k)][1] * 1000;
      b.classList.toggle('locked', locked); b.classList.toggle('poor', !locked && gold < cost); b.classList.toggle('cool', left > 0); b.classList.toggle('wait', v.phase !== 'battle');
      const p = left > 0 ? clamp(left / len, 0, 1).toFixed(3) : '0'; if (b.style.getPropertyValue('--p') !== p) b.style.setProperty('--p', p);
    }
    for (const b of el.querySelectorAll('.sm-a')) {
      const a = b.dataset.a;
      if (a === 'mine') { b.classList.toggle('poor', v.mineCost == null || gold < v.mineCost); const m = el.querySelector('#sm-mine-t'); const s = v.mineCost == null ? `${v.mines} mines · max` : `💰${v.mineCost} · +${v.mineInc}/s · have ${v.mines}`; if (m && m.textContent !== s) m.textContent = s; continue; }
      const A = ABIL.find((x) => x.k === a), left = Math.max(0, (PH.abEnd[a] || 0) - t);
      b.classList.toggle('locked', A.tier > v.tier); b.classList.toggle('poor', gold < A.cost); b.classList.toggle('cool', left > 0);
      const p = left > 0 ? clamp(left / ((a === 'rally' ? 60 : 90) * 1000), 0, 1).toFixed(3) : '0'; if (b.style.getPropertyValue('--p') !== p) b.style.setProperty('--p', p);
    }
  }
  function phoneOver(el, v) {
    const o = v.over, w = o.winner, P = TEAM[v.team];
    BOX.morph(el, `<div class="sm-ph sm-over t${v.team} ${o.won ? 'won' : 'lost'}">
      <div class="sm-big">${w < 0 ? '🤝' : o.won ? '🏆' : '🏳️'}</div>
      <h2>${w < 0 ? 'A draw!' : o.won ? `${P.icon} ${P.name} wins!` : `${TEAM[w].icon} ${TEAM[w].name} wins…`}</h2>
      <p>${o.won ? 'Glorious victory, commander!' : w < 0 ? 'Neither side gave an inch.' : 'Your army fought bravely.'}</p>
      ${o.mvp ? '<div class="sm-mvp-ph">⭐ YOU’RE THE MVP! ⭐</div>' : ''}
      <div class="sm-score"><b>${o.score}</b><span>battle score · #${o.teamRank} on your team</span></div>
      <div class="sm-stats"><div><b>${v.st.summons}</b><span>summoned</span></div><div><b>${v.st.kills}</b><span>defeated</span></div><div><b>${v.st.dmg}</b><span>damage</span></div><div><b>${v.st.base}</b><span>to keeps</span></div></div>
      ${(o.awards || []).map((a) => `<div class="sm-aw-ph"><i>${esc(a.icon)}</i><div><b>${esc(a.title)}</b><small>${esc(a.why)}</small></div></div>`).join('')}
    </div>`);
  }

  BOX.summonArt = { TEAM, U, KEYS, ART, drawUnit, sprite, fortress, paintScene, emblem, text, rr, glow, circ, line, wheel, iconUrl, LOGO, HUD, BODY, OUT };
  BOX.games.summon = {
    name: 'JustSummon', icon: '⚔️',
    about: 'Summon troops, counter your rivals and drag the front line into their fortress. A tug-of-war of tactics for two teams.',
    how: [
      'Two teams: ☀️ Sunrise vs 🌙 Nightfall. Each of you has a keep in your team’s fortress.',
      'Tap a troop on your phone to summon it (it costs gold and has a short cooldown). Troops march on their own and fight whatever they meet.',
      'Counters matter: Spearmen beat Riders, Riders beat Archers, Archers beat Spearmen, Shieldwalls shrug off arrows, Mages melt armour. ✔ shows what a troop beats, ✖ what beats it.',
      'Every summon adds to your income for the rest of the battle; Gold Mines are pure investment. Spend now to defend, or invest to win later?',
      'Your team levels up as it spends: Tier 2 and 3 unlock Knights, Catapults, Healers, Giants, Dragons and Ballistas. Dragons fly: only shooters can hit them.',
      'Troops that reach the far wall smash its keeps. Knock down every enemy keep, or hold the front line deepest in their land when time runs out!',
    ],
    // charge is a recorded war horn (onFx), not a synth sound.
    fx: { start: 'start', ready: 'drum', tier: 'triumph', keepdown: 'explosion', meteor: 'boom', rally: 'bell', surge: 'swell', win: 'win' },
    onFx(f) { if (f.kind === 'charge') clip('war-horn.ogg', { vol: 0.24, jitter: 0.02 }); }, // the armies charge: a war horn
    music(s) {
      if (!s) return 'play';
      if (s.phase === 'over') return 'finale';
      if (s.phase === 'ready') return 'think';
      const low = (s.teams || []).some((T) => { const hp = T.keeps.reduce((a, k) => a + k.hp, 0), mx = T.keeps.reduce((a, k) => a + k.max, 0); return mx && hp / mx < 0.35; });
      return s.surge || low ? 'tense' : 'play';
    },
    lobbyTv,
    tv(el, s) { if (s) tvState(el, s); },
    phone,
  };
})();
