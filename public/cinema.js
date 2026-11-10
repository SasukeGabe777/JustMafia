// Cinematic engine for the big screen. Plays data-driven scenes from
// scenes.js (timelines of [time, action, args]) with a reusable library of
// actions: spawn, walk, sneak, attack, shield, die, flee, knock, lights,
// camera moves, stage cuts, titles, music and sound.
//
// Two stages:
//   'town'     - the real town map, with the camera panning and zooming
//   'interior' - a full-screen close-up inside a house, drawn per theme
//
// Pure presentation: scenes only ever use public information (a house, a
// public victim name, an outcome that is announced anyway). Attackers and
// protectors are always anonymous figures.
(function () {
  const { drawCharacter, drawShadowFigure, roundRect, shade } = window.MTArt;
  const L = window.MT_LAYOUT;
  const { W, H, CX, CY, TAU } = L;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const EASE = {
    linear: (t) => t,
    inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
  };
  const FONT = "'Pixelify Sans', 'Silkscreen', monospace";
  const FLOOR = 900;     // interior: where the front of the floor is
  const WALL_BASE = 640; // interior: where the back wall meets the floor

  // ---------- theme kits ----------
  // Everything a theme changes about cinematics: the attacker's look and
  // weapon, the interior set, and the music's root note.
  const KITS = {
    modern: {
      weapon: 'knife', root: 110, assassin: { cloak: '#16161e', trim: '#2c2c3a', eyes: '#ff3434', hood: true },
      room: { style: 'bedroom', wall: '#6b5a7a', wall2: '#5d4d6c', floor: '#7a5536', floor2: '#6a4a2e', trim: '#efe6da', blanket: null, sky: '#0d1430' },
    },
    medieval: {
      weapon: 'dagger', root: 98, assassin: { cloak: '#2b2119', trim: '#4b3828', eyes: '#ffb030', hood: true },
      room: { style: 'cottage', wall: '#6f6457', wall2: '#5b5147', floor: '#5a4030', floor2: '#4a3426', trim: '#8a6a44', sky: '#101428' },
    },
    space: {
      weapon: 'blaster', root: 82, assassin: { cloak: '#1b2232', trim: '#3a4a6a', eyes: '#30fff0', visor: true },
      room: { style: 'habitat', wall: '#3a4258', wall2: '#323a4e', floor: '#2a3040', floor2: '#232838', trim: '#8a93a8', sky: '#03030c' },
    },
    fantasy: {
      weapon: 'wand', root: 104, assassin: { cloak: '#2a1840', trim: '#5a2a80', eyes: '#d080ff', hood: true },
      room: { style: 'cottage', wall: '#5a4d72', wall2: '#4b4062', floor: '#4f3a2c', floor2: '#433024', trim: '#c9a24a', sky: '#140a2a' },
    },
    dragons: {
      weapon: 'axe', root: 92, assassin: { cloak: '#3a1810', trim: '#6a2a18', eyes: '#ff7a20', hood: true, horns: true },
      room: { style: 'cottage', wall: '#7a5a44', wall2: '#684b38', floor: '#5a3a26', floor2: '#4a2e1e', trim: '#a8321e', sky: '#2a0a04' },
    },
    dungeon: {
      weapon: 'dagger', root: 87, assassin: { cloak: '#1c1a20', trim: '#36323c', eyes: '#7dff6a', hood: true },
      room: { style: 'cottage', wall: '#4e4a54', wall2: '#423e48', floor: '#3a363e', floor2: '#322e36', trim: '#6e6874', sky: '#050308' },
    },
    spies: {
      weapon: 'pistol', root: 104, assassin: { cloak: '#14171c', trim: '#2a2f38', eyes: '#ff3434', suit: true },
      room: { style: 'bedroom', wall: '#4a5560', wall2: '#404a54', floor: '#3a3a40', floor2: '#323238', trim: '#c3cbd0', sky: '#0a1018' },
    },
    fbi: {
      weapon: 'pistol', root: 98, assassin: { cloak: '#181a1e', trim: '#30343c', eyes: '#ff3434', hood: true },
      room: { style: 'bedroom', wall: '#6a6450', wall2: '#5c5644', floor: '#5a4a3a', floor2: '#4c3e30', trim: '#e4dfcf', sky: '#0a0e20' },
    },
  };
  const THEME_KIT = { smalltown: 'modern', medieval: 'medieval', space: 'space', fantasy: 'fantasy', dragons: 'dragons', dungeon: 'dungeon', spies: 'spies', fbi: 'fbi' };
  const RANGED = { blaster: { color: '#30fff0', sfx: 'zap' }, pistol: { color: '#ffd76a', sfx: 'shot' }, wand: { color: '#d080ff', sfx: 'zap' } };

  // ---------- figures ----------
  function drawWeapon(ctx, kind) {
    ctx.save();
    switch (kind) {
      case 'dagger':
        ctx.fillStyle = '#5a3a1e'; ctx.fillRect(-2, -3, 8, 6);
        ctx.fillStyle = '#d4af37'; ctx.fillRect(5, -6, 3, 12);
        ctx.fillStyle = '#dfe6ee'; ctx.beginPath(); ctx.moveTo(8, -3); ctx.lineTo(28, 0); ctx.lineTo(8, 3); ctx.closePath(); ctx.fill();
        break;
      case 'axe':
        ctx.fillStyle = '#6a4424'; ctx.fillRect(-4, -2, 30, 4);
        ctx.fillStyle = '#c9ced6'; ctx.beginPath(); ctx.moveTo(18, -2); ctx.quadraticCurveTo(26, -16, 32, -12); ctx.lineTo(30, 10); ctx.quadraticCurveTo(26, 14, 18, 2); ctx.closePath(); ctx.fill();
        break;
      case 'blaster':
        ctx.fillStyle = '#3a4a6a'; roundRect(ctx, -2, -4, 22, 8, 3); ctx.fill();
        ctx.fillStyle = '#20283a'; ctx.fillRect(2, 2, 5, 8);
        ctx.fillStyle = '#30fff0'; ctx.shadowColor = '#30fff0'; ctx.shadowBlur = 10; ctx.fillRect(18, -2, 5, 4);
        break;
      case 'pistol':
        ctx.fillStyle = '#1a1a1e'; roundRect(ctx, -2, -3, 18, 6, 2); ctx.fill(); ctx.fillRect(0, 1, 5, 8);
        ctx.fillStyle = '#2c2c32'; ctx.fillRect(14, -2, 10, 4);
        break;
      case 'wand':
        ctx.fillStyle = '#5a3a1e'; ctx.fillRect(-2, -2, 24, 4);
        ctx.fillStyle = '#e8b0ff'; ctx.shadowColor = '#d080ff'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(23, 0, 4, 0, TAU); ctx.fill();
        break;
      default: // knife
        ctx.fillStyle = '#2a2a2a'; ctx.fillRect(-2, -2.5, 9, 5);
        ctx.fillStyle = '#e6ecf2'; ctx.beginPath(); ctx.moveTo(7, -3); ctx.lineTo(22, -1); ctx.lineTo(7, 3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // Arm angle (radians, 0 = pointing forward) during an attack at progress p.
  function swingAngle(p, ranged) {
    if (p == null) return 0.9;
    if (ranged) return p < 0.3 ? lerp(0.9, 0, p / 0.3) : p < 0.8 ? 0 : lerp(0, 0.9, (p - 0.8) / 0.2);
    if (p < 0.4) return lerp(0.9, -2.3, EASE.out(p / 0.4));
    if (p < 0.55) return lerp(-2.3, 1.1, (p - 0.4) / 0.15);
    return lerp(1.1, 0.9, (p - 0.55) / 0.45);
  }

  function drawAssassin(ctx, x, y, o) {
    const k = o.kit || KITS.modern;
    const A = k.assassin;
    const t = o.t || 0;
    const bob = o.walking ? Math.abs(Math.sin(t * (o.gait === 'run' ? 14 : 8))) * 2.5 : Math.sin(t * 2) * 0.6;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((o.scale || 1) * (o.facing < 0 ? -1 : 1), o.scale || 1);
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, 17, 5, 0, 0, TAU); ctx.fill();
    const crouch = o.crouch ? 0.86 : 1;
    ctx.scale(1, crouch);
    ctx.translate(0, -bob);
    if (o.crouch) ctx.rotate(0.12);
    // legs
    const sw = o.walking ? Math.sin(t * (o.gait === 'run' ? 14 : 8)) * 4 : 0;
    ctx.fillStyle = shade(A.cloak, -0.3);
    roundRect(ctx, -8 + sw, -12, 6, 12, 2.5); ctx.fill();
    roundRect(ctx, 2 - sw, -12, 6, 12, 2.5); ctx.fill();
    // back arm
    ctx.fillStyle = A.trim;
    ctx.beginPath(); ctx.ellipse(-12, -26, 4, 8, 0.3, 0, TAU); ctx.fill();
    // cloak / body
    ctx.fillStyle = A.cloak;
    ctx.beginPath();
    if (A.suit) {
      roundRect(ctx, -13, -40, 26, 30, 7); ctx.fill();
      ctx.fillStyle = '#e8e8e8'; ctx.beginPath(); ctx.moveTo(-3, -40); ctx.lineTo(3, -40); ctx.lineTo(0, -30); ctx.closePath(); ctx.fill();
    } else {
      ctx.moveTo(-18, -6); ctx.quadraticCurveTo(-16, -32, -10, -40); ctx.lineTo(10, -40); ctx.quadraticCurveTo(16, -32, 18, -6);
      ctx.quadraticCurveTo(0, -1, -18, -6); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = A.trim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -38); ctx.lineTo(0, -8); ctx.stroke();
    }
    // head / hood / visor
    if (A.visor) {
      ctx.fillStyle = A.trim; ctx.beginPath(); ctx.arc(0, -50, 13, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a0f18'; roundRect(ctx, -9, -56, 20, 9, 4); ctx.fill();
    } else if (A.suit) {
      ctx.fillStyle = '#c9a07a'; ctx.beginPath(); ctx.arc(0, -50, 11, 0, TAU); ctx.fill();
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -53, 11.5, Math.PI, 0); ctx.fill(); // hat
      ctx.fillRect(-15, -54, 30, 3);
      ctx.fillStyle = '#0a0a0a'; roundRect(ctx, -9, -51, 8, 4, 2); ctx.fill(); roundRect(ctx, 1, -51, 8, 4, 2); ctx.fill();
    } else {
      ctx.fillStyle = A.cloak;
      ctx.beginPath(); ctx.moveTo(-13, -40); ctx.quadraticCurveTo(-15, -62, 0, -64); ctx.quadraticCurveTo(15, -62, 13, -40); ctx.closePath(); ctx.fill();
      if (A.horns) { ctx.fillStyle = '#d9c8a0'; ctx.beginPath(); ctx.moveTo(-9, -58); ctx.lineTo(-16, -72); ctx.lineTo(-5, -61); ctx.fill(); ctx.beginPath(); ctx.moveTo(9, -58); ctx.lineTo(16, -72); ctx.lineTo(5, -61); ctx.fill(); }
      ctx.fillStyle = '#050508'; ctx.beginPath(); ctx.ellipse(2, -50, 8, 9, 0, 0, TAU); ctx.fill();
    }
    // front arm + weapon
    const ranged = !!RANGED[k.weapon];
    const ang = swingAngle(o.attackP, ranged);
    ctx.save();
    ctx.translate(8, -32);
    ctx.rotate(ang);
    ctx.fillStyle = A.trim;
    roundRect(ctx, -4, -4, 16, 8, 4); ctx.fill();
    ctx.fillStyle = A.visor ? '#8a93a8' : '#1c1c22';
    ctx.beginPath(); ctx.arc(13, 0, 4, 0, TAU); ctx.fill();
    ctx.translate(14, 0);
    if (o.armed !== false) drawWeapon(ctx, k.weapon);
    ctx.restore();
    ctx.restore();
  }

  // Glowing eyes, drawn after the darkness so they pierce it.
  function drawAssassinEyes(ctx, x, y, o) {
    const k = o.kit || KITS.modern;
    const A = k.assassin;
    if (A.suit) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((o.scale || 1) * (o.facing < 0 ? -1 : 1), (o.scale || 1) * (o.crouch ? 0.86 : 1));
    ctx.globalAlpha *= (o.alpha == null ? 1 : o.alpha) * (o.eyes == null ? 1 : o.eyes);
    ctx.fillStyle = A.eyes; ctx.shadowColor = A.eyes; ctx.shadowBlur = 12;
    const ey = A.visor ? -52 : -51;
    ctx.beginPath(); ctx.ellipse(A.visor ? -2 : -1, ey, 2.4, 1.3, 0, 0, TAU); ctx.ellipse(A.visor ? 6 : 6, ey, 2.4, 1.3, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  const PROTECTOR_AV = { color: '#22252e', skin: '#d9a273', hat: 'none' };
  function drawProtector(ctx, x, y, o) {
    ctx.save();
    ctx.translate(x, y);
    const s = o.scale || 1;
    ctx.scale(s, s);
    drawCharacter(ctx, 0, 0, PROTECTOR_AV, { t: o.t, walking: o.walking, facing: o.facing || 0, alpha: o.alpha });
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    ctx.fillStyle = '#0a0a0a';
    roundRect(ctx, -9, -45, 8, 4.5, 2); ctx.fill(); roundRect(ctx, 1, -45, 8, 4.5, 2); ctx.fill();
    ctx.fillRect(-1, -44, 2, 1.5);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-3, -31); ctx.lineTo(3, -31); ctx.lineTo(0, -24); ctx.closePath(); ctx.fill();
    if (o.pose === 'guard') { // arms out
      ctx.fillStyle = shade(PROTECTOR_AV.color, -0.1);
      ctx.beginPath(); ctx.ellipse(-20, -25, 9, 3.6, 0.15, 0, TAU); ctx.ellipse(20, -25, 9, 3.6, -0.15, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  const DETECTIVE_AV = { color: '#a8875a', skin: '#f3c9a0', hat: 'top' };
  function drawDetective(ctx, x, y, o) {
    ctx.save();
    ctx.translate(x, y);
    const s = o.scale || 1;
    ctx.scale(s * (o.facing < 0 ? -1 : 1), s);
    drawCharacter(ctx, 0, 0, DETECTIVE_AV, { t: o.t, walking: o.walking, facing: 1, alpha: o.alpha });
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    // collar + magnifier
    ctx.fillStyle = shade(DETECTIVE_AV.color, -0.25);
    ctx.beginPath(); ctx.moveTo(-10, -31); ctx.lineTo(0, -22); ctx.lineTo(10, -31); ctx.lineTo(6, -31); ctx.lineTo(0, -26); ctx.lineTo(-6, -31); ctx.closePath(); ctx.fill();
    const lift = o.pose === 'peek' ? -18 : 0;
    ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(13, -20); ctx.lineTo(19, -26 + lift); ctx.stroke();
    ctx.strokeStyle = '#d4af37'; ctx.lineWidth = 2.5; ctx.fillStyle = 'rgba(190,230,255,0.45)';
    ctx.beginPath(); ctx.arc(23, -31 + lift, 6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // A resident: their real avatar, posed.
  function drawResident(ctx, a, t) {
    const s = a.scale || 1;
    ctx.save();
    ctx.translate(a.x, a.y);
    if (a.pose === 'sleep' || a.pose === 'sit') {
      ctx.rotate(a.pose === 'sleep' ? Math.PI / 2 : Math.PI / 2 - 0.9);
      drawCharacter(ctx, 0, 0, a.avatar, { theme: a.theme, t: a.pose === 'sleep' ? 0 : t, scale: s, scared: a.scared, alpha: a.alpha });
    } else if (a.pose === 'dead') {
      const p = clamp((t - (a.fallT || 0)) / 0.45, 0, 1);
      ctx.rotate(EASE.out(p) * (Math.PI / 2) * (a.facing < 0 ? 1 : -1));
      ctx.globalAlpha *= 1 - p * 0.25;
      drawCharacter(ctx, 0, 0, a.avatar, { theme: a.theme, t: 0, scale: s, scared: true, alpha: a.alpha });
    } else {
      const cower = a.pose === 'cower';
      if (cower) ctx.scale(1, 0.92);
      drawCharacter(ctx, 0, 0, a.avatar, { theme: a.theme, t, scale: s, walking: a.walking, facing: a.facing || 0, scared: a.scared || cower, alpha: a.alpha, jump: a.jump || 0 });
    }
    ctx.restore();
  }

  // ---------- interior sets ----------
  function drawInterior(ctx, k, room, t, avatarColor) {
    const R = k.room;
    // back wall
    ctx.fillStyle = R.wall; ctx.fillRect(0, 0, W, WALL_BASE);
    if (R.style === 'bedroom') {
      ctx.fillStyle = R.wall2;
      for (let x = 0; x < W; x += 70) ctx.fillRect(x, 0, 32, WALL_BASE);
      ctx.fillStyle = R.trim; ctx.fillRect(0, WALL_BASE - 26, W, 26);
    } else if (R.style === 'cottage') {
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3;
      for (let row = 0, y = 0; y < WALL_BASE; row++, y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        for (let x = (row % 2) * 70; x < W; x += 140) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 60); ctx.stroke(); }
      }
      ctx.fillStyle = R.trim; ctx.fillRect(0, 70, W, 22); // beam
    } else {
      ctx.fillStyle = R.wall2;
      for (let x = 0; x < W; x += 240) { roundRect(ctx, x + 8, 20, 224, WALL_BASE - 60, 10); ctx.fill(); }
      ctx.fillStyle = '#8a93a8';
      for (let x = 0; x < W; x += 240) for (const yy of [34, WALL_BASE - 54]) { ctx.beginPath(); ctx.arc(x + 22, yy, 4, 0, TAU); ctx.arc(x + 218, yy, 4, 0, TAU); ctx.fill(); }
      ctx.fillStyle = `rgba(48,255,240,${room.lamp > 0 ? 0.85 : 0.25})`; ctx.fillRect(0, 8, W, 6); // neon strip
    }
    // floor
    ctx.fillStyle = R.floor; ctx.fillRect(0, WALL_BASE, W, H - WALL_BASE);
    ctx.strokeStyle = R.floor2; ctx.lineWidth = 4;
    if (R.style === 'habitat') {
      for (let x = -400; x < W + 400; x += 90) { ctx.beginPath(); ctx.moveTo(CX + (x - CX) * 0.6, WALL_BASE); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = WALL_BASE; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    } else {
      for (let y = WALL_BASE + 30, g = 30; y < H; g *= 1.25, y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }
    // rug
    if (R.style !== 'habitat') { ctx.fillStyle = 'rgba(150,40,60,0.55)'; ctx.beginPath(); ctx.ellipse(760, 880, 330, 70, 0, 0, TAU); ctx.fill(); }

    // window
    const wx = 1250, wy = 140, ww = 300, wh = 330;
    const bolt = room.lightning;
    if (R.style === 'habitat') {
      ctx.fillStyle = R.trim; ctx.beginPath(); ctx.arc(wx + ww / 2, wy + wh / 2, 170, 0, TAU); ctx.fill();
      ctx.fillStyle = R.sky; ctx.beginPath(); ctx.arc(wx + ww / 2, wy + wh / 2, 150, 0, TAU); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(wx + ww / 2, wy + wh / 2, 150, 0, TAU); ctx.clip();
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${0.4 + (i % 3) * 0.2})`; ctx.fillRect(wx + ((i * 97) % ww), wy + ((i * 53) % wh), 2, 2); }
      ctx.fillStyle = '#c96a3a'; ctx.beginPath(); ctx.arc(wx + 220, wy + 240, 70, 0, TAU); ctx.fill();
      ctx.restore();
    } else {
      const sky = bolt > 0.05 ? `rgb(${lerp(20, 230, bolt) | 0},${lerp(26, 235, bolt) | 0},${lerp(60, 255, bolt) | 0})` : R.sky;
      ctx.fillStyle = sky;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = '#f4f1d8'; ctx.beginPath(); ctx.arc(wx + 210, wy + 90, 34, 0, TAU); ctx.fill();
      ctx.fillStyle = sky; ctx.beginPath(); ctx.arc(wx + 224, wy + 80, 30, 0, TAU); ctx.fill();
      ctx.strokeStyle = R.style === 'cottage' ? '#4a3626' : R.trim; ctx.lineWidth = 14;
      ctx.strokeRect(wx, wy, ww, wh);
      ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2); ctx.stroke();
      if (room.broken) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
        for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; ctx.beginPath(); ctx.moveTo(wx + 80, wy + 230); ctx.lineTo(wx + 80 + Math.cos(a) * 90, wy + 230 + Math.sin(a) * 90); ctx.stroke(); }
      }
      // curtains
      const sway = Math.sin(t * 1.3) * 6;
      ctx.fillStyle = R.style === 'cottage' ? '#5a4330' : '#7a2a3a';
      ctx.beginPath(); ctx.moveTo(wx - 50, wy - 30); ctx.lineTo(wx + 40, wy - 30); ctx.quadraticCurveTo(wx + 10 + sway, wy + wh / 2, wx + 30, wy + wh + 40); ctx.lineTo(wx - 50, wy + wh + 40); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(wx + ww + 50, wy - 30); ctx.lineTo(wx + ww - 40, wy - 30); ctx.quadraticCurveTo(wx + ww - 10 - sway, wy + wh / 2, wx + ww - 30, wy + wh + 40); ctx.lineTo(wx + ww + 50, wy + wh + 40); ctx.closePath(); ctx.fill();
    }
    // picture
    if (R.style === 'bedroom') {
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(690, 190, 180, 140);
      ctx.fillStyle = '#7cbf5a'; ctx.fillRect(704, 204, 152, 112);
      ctx.fillStyle = '#e4f0ff'; ctx.fillRect(704, 204, 152, 56);
      ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(740, 280); ctx.lineTo(770, 252); ctx.lineTo(800, 280); ctx.fill();
    } else if (R.style === 'cottage') {
      ctx.fillStyle = '#4a3626'; ctx.fillRect(660, 230, 260, 16); // shelf
      ctx.fillStyle = '#c9a24a'; ctx.fillRect(690, 196, 30, 34); ctx.fillStyle = '#7a4e2d'; ctx.fillRect(740, 206, 40, 24); ctx.fillStyle = '#5a8fb0'; ctx.beginPath(); ctx.arc(830, 214, 16, 0, TAU); ctx.fill();
    }

    // door (back wall, left)
    const dx = 220, dw = 210, dTop = 250;
    ctx.fillStyle = '#ffd98a'; ctx.fillRect(dx, dTop, dw, WALL_BASE - dTop); // hallway light behind
    if (R.style === 'habitat') {
      const o = room.door * dw / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(dx, dTop, dw, WALL_BASE - dTop); ctx.clip();
      ctx.fillStyle = '#5b6280'; ctx.fillRect(dx - o, dTop, dw / 2, WALL_BASE - dTop); ctx.fillRect(dx + dw / 2 + o, dTop, dw / 2, WALL_BASE - dTop);
      ctx.restore();
      ctx.strokeStyle = R.trim; ctx.lineWidth = 10; ctx.strokeRect(dx, dTop, dw, WALL_BASE - dTop);
    } else {
      const open = room.door;
      ctx.fillStyle = R.style === 'cottage' ? '#5a3a20' : '#7a4e2d';
      const pw = dw * (1 - open * 0.85);
      ctx.fillRect(dx, dTop, pw, WALL_BASE - dTop);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(dx + pw - 8, dTop, 8, WALL_BASE - dTop);
      if (open < 0.5) { ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(dx + pw - 26, dTop + 200, 7, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = R.style === 'cottage' ? '#3a2616' : R.trim; ctx.lineWidth = 16;
      ctx.strokeRect(dx - 4, dTop - 4, dw + 8, WALL_BASE - dTop + 8);
    }

    // nightstand + lamp / candle
    ctx.fillStyle = R.style === 'habitat' ? '#5b6280' : '#5a3a20';
    ctx.fillRect(1735, 560, 120, 130);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(1735, 620, 120, 6);
    if (R.style === 'cottage') {
      ctx.fillStyle = '#efe6c8'; ctx.fillRect(1785, 500, 18, 60);
      if (room.lamp > 0) { ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.ellipse(1794, 488, 7, 14, 0, 0, TAU); ctx.fill(); }
    } else if (R.style === 'bedroom') {
      ctx.fillStyle = '#d8c8a0'; ctx.fillRect(1788, 470, 14, 90);
      ctx.fillStyle = room.lamp > 0 ? '#ffe8a8' : '#cdbf9a';
      ctx.beginPath(); ctx.moveTo(1750, 480); ctx.lineTo(1840, 480); ctx.lineTo(1818, 410); ctx.lineTo(1772, 410); ctx.closePath(); ctx.fill();
    }
  }

  function drawBed(ctx, k, part, blanketColor) {
    const R = k.room;
    if (part === 'back') {
      ctx.fillStyle = R.style === 'habitat' ? '#8a93a8' : R.style === 'cottage' ? '#6a4a2a' : '#5a3a28';
      roundRect(ctx, 1600, 470, 70, 330, 14); ctx.fill(); // headboard (right)
      ctx.fillStyle = R.style === 'cottage' ? '#c9a24a' : '#e8e4f0';
      roundRect(ctx, 1170, 640, 470, 150, 24); ctx.fill(); // mattress
      ctx.fillStyle = '#ffffff'; roundRect(ctx, 1480, 615, 120, 70, 26); ctx.fill(); // pillow
    } else {
      ctx.fillStyle = blanketColor;
      roundRect(ctx, 1160, 660, 330, 150, 26); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(1180, 690, 290, 10);
      ctx.fillStyle = R.style === 'habitat' ? '#6a738a' : '#4a2e1e';
      ctx.fillRect(1160, 790, 500, 26); // frame
      ctx.fillRect(1170, 790, 22, 70); ctx.fillRect(1620, 790, 22, 70);
    }
  }

  // ---------- the engine ----------
  class Cinema {
    constructor(town) {
      this.town = town;
      this.scene = null;
      this.queue = [];
      this.actors = new Map();
      this.fx = [];
      this.loops = [];
      this.stage = 'town';
      this.letter = 0; this.letterTarget = 0;
      this.fade = 0; this.fadeAnim = null;
      this.title = null;
      this.shake = 0;
      this.flash = { a: 0, color: '255,255,255' };
      this.spot = null;
      this.fog = 0; this.fogTarget = 0;
      this.room = this.freshRoom();
      this.judgeMood = null;
      this.environment = null;
      this.snapshot = false;
      this.clock = 0;
      this.onChange = null;
    }

    freshRoom() { return { lamp: 0, door: 0, doorAnim: null, flickerUntil: 0, lightning: 0, broken: false }; }
    get active() { return !!this.scene; }
    kit() { return KITS[THEME_KIT[this.town.themeId] || 'modern'] || KITS.modern; }
    now() { return this.scene ? this.scene.t : 0; }

    // Plays a scene. bind: { victimId | house, outcome, multi, title, sub }.
    play(id, bind = {}, opts = {}) {
      const def = (window.MT_SCENES || {})[id];
      if (!def) return false;
      const item = { id, def, bind, opts };
      if (this.scene && opts.queue) { this.queue.push(item); return true; }
      if (this.scene) this.end(true, true);
      this.begin(item);
      return true;
    }

    begin(item) {
      const { def, bind } = item;
      const town = this.town;
      const victimChar = bind.victimId ? town.chars.get(bind.victimId) : null;
      // The victim's home (their own plot, or the house they're staying in).
      let houseIdx = bind.house != null ? bind.house : victimChar ? (victimChar.home != null ? victimChar.home : victimChar.house) : null;
      if (houseIdx == null || !town.houses[houseIdx]) {
        const built = town.houses.map((_, i) => i).filter((i) => town.ownerOf(i));
        houseIdx = built.length ? built[Math.floor(Math.random() * built.length)] : Math.floor(Math.random() * Math.max(1, town.houses.length));
      }
      const house = town.houses[houseIdx];
      const owner = victimChar || town.ownerOf(houseIdx);
      const outcome = (def.outcomes && def.outcomes[bind.outcome]) ? bind.outcome : def.defaultOutcome;
      this.ctx = {
        house, houseIdx, owner,
        name: (owner && owner.name) || 'Someone',
        avatar: (owner && owner.avatar) || { color: '#8a8a9a', skin: '#f3c9a0', hat: 'none' },
        outcome, multi: !!bind.multi, kit: this.kit(), bind,
        dir: house && house.x < CX ? 1 : -1, // which way is "toward town"
      };
      let steps = def.steps.slice();
      const oc = def.outcomes && def.outcomes[outcome];
      if (oc) steps = steps.concat(oc.steps);
      steps = steps.filter((s) => this.cond(s[3])).sort((a, b) => a[0] - b[0]);
      this.scene = { ...item, steps, idx: 0, t: 0, duration: (oc && oc.duration) || def.duration, phaseBound: !!item.opts.phaseBound };
      this.actors.clear(); this.fx = []; this.loops = []; this.title = null; this.spot = null;
      this.room = this.freshRoom();
      this.stage = 'town';
      this.environment = null; this.snapshot = false;
      if (this.onChange) this.onChange(true);
    }

    cond(c) {
      if (!c) return true;
      if (c.when === 'multi') return this.ctx.multi;
      if (c.when === 'single') return !this.ctx.multi;
      if (c.when === 'hasOwner') return !!this.ctx.owner;
      if (c.when === 'cheer') return this.ctx.bind.cheer !== false;
      return true;
    }

    end(interrupted, keepQueue) {
      const town = this.town;
      this.stage = 'town';
      this.letterTarget = 0;
      this.fadeTo(0, interrupted ? 0.2 : 0.5);
      this.actors.clear(); this.loops = []; this.spot = null; this.title = null; this.fogTarget = 0;
      town.focusSpot('overview', interrupted ? 0.5 : 1.4);
      town.cineDark = null;
      this.environment = null; this.snapshot = false;
      town.cineWindow = null;
      for (const c of town.chars.values()) {
        c.cineTarget = null;
        if (c.damagePending && this.ctx.owner && c.id === this.ctx.owner.id) { c.damagePending = false; c.houseState = ((town.state.players || []).find((p) => p.id === c.id) || {}).houseState || 'normal'; }
      }
      if (this.scene.id === 'explosion' && this.ctx.owner) { const p = (town.state.players || []).find((p) => p.id === this.ctx.owner.id); this.ctx.owner.houseState = p && p.houseState || 'normal'; }
      town.releaseAll();
      SFX.music(this.judgeMood, this.kit().root, this.town.themeId);
      this.scene = null;
      if (!keepQueue && this.queue.length) this.begin(this.queue.shift());
      else if (this.onChange) this.onChange(false);
    }

    stop() { this.queue = []; if (this.scene) this.end(true); }
    stopPhaseBound() {
      this.queue = this.queue.filter((q) => !q.opts.phaseBound);
      if (this.scene && this.scene.phaseBound) this.end(true);
    }

    fadeTo(to, dur) { this.fadeAnim = { from: this.fade, to, t0: this.clock, dur: Math.max(0.01, dur) }; }

    // ----- per-frame -----
    update(dt) {
      this.clock += dt;
      this.letter += (this.letterTarget - this.letter) * Math.min(1, dt * 4);
      this.fog += (this.fogTarget - this.fog) * Math.min(1, dt * 1.2);
      if (this.fadeAnim) {
        const f = this.fadeAnim, p = clamp((this.clock - f.t0) / f.dur, 0, 1);
        this.fade = lerp(f.from, f.to, EASE.inOut(p));
        if (p >= 1) this.fadeAnim = null;
      }
      this.shake = Math.max(0, this.shake - dt * 2.2);
      this.flash.a = Math.max(0, this.flash.a - dt * 2.5);
      this.room.lightning = Math.max(0, this.room.lightning - dt * 2);
      for (const e of this.fx) {
        e.life -= dt;
        if (e.vx != null) { e.vy += (e.g || 0) * dt; e.x += e.vx * dt; e.y += e.vy * dt; }
      }
      this.fx = this.fx.filter((e) => e.life > 0);
      const sc = this.scene;
      if (!sc) return;
      sc.t += dt;
      while (sc.idx < sc.steps.length && sc.steps[sc.idx][0] <= sc.t) {
        const [, action, args] = sc.steps[sc.idx++];
        try { this.run(action, args); } catch (e) { console.error('scene step failed', action, e); }
        if (this.scene !== sc) return; // scene ended inside a step
      }
      for (const l of this.loops) {
        while (sc.t >= l.next && l.next <= l.until) { SFX.play(l.sfx); l.next += l.every; }
      }
      this.loops = this.loops.filter((l) => l.next <= l.until);
      for (const a of this.actors.values()) this.updateActor(a, sc.t);
      const r = this.room;
      if (r.doorAnim) {
        const p = clamp((sc.t - r.doorAnim.t0) / r.doorAnim.dur, 0, 1);
        r.door = lerp(r.doorAnim.from, r.doorAnim.to, EASE.inOut(p));
        if (p >= 1) r.doorAnim = null;
      }
      if (sc.t < r.flickerUntil) r.lampLevel = Math.random() < 0.35 ? 0 : 1; else r.lampLevel = r.lamp;
      if (sc.t >= sc.duration) this.end(false);
    }

    updateActor(a, t) {
      if (a.move) {
        const m = a.move, p = clamp((t - m.t0) / m.dur, 0, 1);
        const e = (EASE[m.ease] || EASE.inOut)(p);
        a.x = lerp(m.from.x, m.to.x, e);
        a.y = lerp(m.from.y, m.to.y, e);
        a.walking = p < 1;
        if (Math.abs(m.to.x - m.from.x) > 2) a.facing = m.to.x > m.from.x ? 1 : -1;
        if (m.gait === 'sneak' && a.walking && Math.floor(t * 2.2) !== a.lastStep) { a.lastStep = Math.floor(t * 2.2); if (this.stage === 'interior') SFX.play('step'); }
        if (p >= 1) { a.move = null; a.walking = false; if (m.fadeOut) a.alphaAnim = { from: a.alpha, to: 0, t0: t, dur: 0.4 }; }
      }
      if (a.alphaAnim) {
        const f = a.alphaAnim, p = clamp((t - f.t0) / f.dur, 0, 1);
        a.alpha = lerp(f.from, f.to, p);
        if (p >= 1) a.alphaAnim = null;
      }
      if (a.attack) {
        const p = (t - a.attack.t0) / a.attack.dur;
        a.attackP = p >= 0 && p <= 1 ? p : null;
        if (p > 1) a.attack = null;
      }
      if (a.knock) {
        const p = clamp((t - a.knock.t0) / 0.35, 0, 1);
        a.x = a.knock.x0 + Math.sin(p * Math.PI) * a.knock.dx;
        if (p >= 1) a.knock = null;
      }
      a.jump = a.jumpUntil > t ? Math.sin(((a.jumpUntil - t) / 0.4) * Math.PI) * 14 * (a.scale || 1) : 0;
      if (a.bubble && a.bubble.until < t) a.bubble = null;
      if (this.stage === 'interior' && a.stage === 'interior') a.scale = this.depthScale(a.y) * (a.kind === 'resident' || a.kind === 'protector' || a.kind === 'detective' ? 1 : 1);
    }

    depthScale(y) { return 2.3 + clamp((y - WALL_BASE) / 260, 0, 1.3) * 1.0; }

    // ----- positions -----
    pt(at) {
      if (!at) return { x: CX, y: CY };
      if (typeof at === 'object') {
        const base = at.from ? this.pt(at.from) : { x: 0, y: 0 };
        return { x: base.x + (at.dx || 0) * (at.mirror ? this.ctx.dir : 1), y: base.y + (at.dy || 0) };
      }
      const h = this.ctx.house;
      const s = h ? h.s : 1;
      const d = this.ctx.dir;
      switch (at) {
        // town stage
        case 'door': return { x: h.x, y: h.y + 16 * s };
        case 'doorSide': return { x: h.x + 26 * s * d, y: h.y + 18 * s };
        case 'window': return { x: h.x - 19 * s, y: h.y + 12 * s };
        case 'street': return { x: h.x + 260 * d, y: h.y + 80 };
        case 'nearStreet': return { x: h.x + 120 * d, y: h.y + 50 };
        case 'away': return { x: h.x + 700 * d, y: h.y + 160 };
        case 'awayFar': return { x: d > 0 ? W + 120 : -120, y: h.y + 200 };
        case 'watch': return { x: h.x + 70 * d, y: h.y + 34 * s };
        case 'fountain': return { x: CX, y: CY + 78 };
        case 'cemetery': return { x: L.CEM.x + L.CEM.w / 2, y: L.CEM.y + L.CEM.h / 2 };
        // interior stage
        case 'offLeft': return { x: 330, y: WALL_BASE + 4 };
        case 'doorway': return { x: 330, y: WALL_BASE + 14 };
        case 'mid': return { x: 760, y: 840 };
        case 'bedside': return { x: 1050, y: 880 };
        case 'strike': return { x: 1300, y: 900 };
        case 'bed': return { x: 1420, y: 700 };
        case 'sitBed': return { x: 1380, y: 735 };
        case 'standBed': return { x: 1480, y: 905 };
        case 'corner': return { x: 1640, y: 930 };
        case 'guardSpot': return { x: 1250, y: 905 };
        case 'underWindow': return { x: 1360, y: 700 };
        case 'outWindow': return { x: 1400, y: 470 };
        case 'floorFront': return { x: 1260, y: 960 };
        default: return { x: CX, y: CY };
      }
    }

    who(id) {
      if (id === 'victim' && this.ctx.owner && this.town.chars.get(this.ctx.owner.id) && this.stage === 'town' && !this.actors.has('victim')) return this.town.chars.get(this.ctx.owner.id);
      return this.actors.get(id);
    }

    // ----- actions -----
    run(action, a) {
      const f = this['a_' + action];
      if (f) f.call(this, a == null ? {} : a);
    }

    text(s) { const b = this.ctx.bind; return String(s || '').replace(/\{name\}/g, this.ctx.name).replace(/\{title\}/g, b.title || '').replace(/\{sub\}/g, b.sub || '').replace(/\{mood\}/g, b.mood || ''); }

    a_letterbox(on) { this.letterTarget = on ? 1 : 0; }
    a_music(mood) { SFX.music(this.text(mood) || null, this.ctx.kit.root, this.town.themeId); }
    a_sfx(name) { SFX.play(name); }
    a_environment(a) { this.environment = { ...a, t0: this.scene.t }; this.ctx.house.shakeUntil = this.town.time + a.dur; }
    a_snapshot() { this.snapshot = true; }
    a_destroyHouse() { if (this.ctx.owner) { this.ctx.owner.houseState = 'destroyed'; this.ctx.owner.damagePending = false; } }
    a_loop(a) { this.loops.push({ sfx: a.sfx, every: a.every || 1, next: this.scene.t, until: a.until || this.scene.t + 5 }); }
    a_camera(a) {
      if (L.SPOTS[a.to]) return this.town.focusSpot(a.to, a.dur || 1.5, a.zoom);
      const p = a.to === 'house' ? { x: this.ctx.house.x, y: this.ctx.house.y - 20 * this.ctx.house.s } : this.pt(a.to);
      this.town.focus(p.x + (a.dx || 0), p.y + (a.dy || 0), a.zoom || 2, a.dur || 1.5);
    }
    a_dark(v) { this.town.cineDark = v; }
    a_stage(name) {
      this.stage = name;
      for (const [id, a] of this.actors) if (a.stage && a.stage !== name) this.actors.delete(id);
    }
    a_fade(a) { this.fadeTo(a.to == null ? 1 : a.to, a.dur || 0.5); }
    a_spawn(a) {
      if (a.ifAlive && this.ctx.owner && !this.ctx.owner.alive && !this.ctx.owner.deathPending) return;
      const p = this.pt(a.at);
      const kind = a.kind || 'figure';
      const actor = {
        id: a.id, kind, stage: this.stage, x: p.x, y: p.y, facing: a.facing || (this.ctx.dir > 0 ? -1 : 1),
        pose: a.pose || 'stand', alpha: a.alpha == null ? 1 : a.alpha, crouch: !!a.crouch, eyes: 1,
        avatar: kind === 'resident' ? this.ctx.avatar : null, theme: this.town.themeId, scale: 1, walking: false, armed: a.armed,
      };
      if (actor.stage === 'town') actor.scale = (this.ctx.house ? this.ctx.house.s : 1) * (a.scale || 1.05);
      else actor.scale = this.depthScale(p.y);
      if (a.fadeIn) { actor.alpha = 0; actor.alphaAnim = { from: 0, to: 1, t0: this.scene.t, dur: a.fadeIn }; }
      this.actors.set(a.id, actor);
    }
    a_move(a) {
      const actor = this.actors.get(a.id);
      if (!actor) return;
      const to = this.pt(a.to);
      actor.move = { from: { x: actor.x, y: actor.y }, to, t0: this.scene.t, dur: a.dur || 1, ease: a.ease || (a.gait === 'run' ? 'linear' : 'inOut'), gait: a.gait || 'walk', fadeOut: !!a.fadeOut };
      actor.gait = a.gait || 'walk';
      if (a.crouch != null) actor.crouch = a.crouch;
    }
    a_pose(a) { const x = this.actors.get(a.id); if (x) { x.pose = a.pose; if (a.crouch != null) x.crouch = a.crouch; if (a.pose === 'dead') x.fallT = this.scene.t; } }
    a_face(a) { const x = this.actors.get(a.id); if (x) x.facing = a.dir === 'left' ? -1 : 1; }
    a_alpha(a) { const x = this.actors.get(a.id); if (x) x.alphaAnim = { from: x.alpha, to: a.to, t0: this.scene.t, dur: a.dur || 0.5 }; }
    a_eyes(a) { const x = this.actors.get(a.id); if (x) x.eyes = a.on === false ? 0 : 1; }
    a_bubble(a) {
      const x = this.who(a.id);
      if (!x) return;
      if (x.kind) x.bubble = { text: this.text(a.text), until: this.scene.t + (a.dur || 1.6) };
      else x.bubble = { text: this.text(a.text), until: this.town.time + (a.dur || 1.6) };
    }
    a_jump(a) { const x = this.actors.get(a.id); if (x) x.jumpUntil = this.scene.t + 0.4; }
    a_scared(a) { const x = this.actors.get(a.id); if (x) x.scared = a.on !== false; }
    a_attack(a) {
      const x = this.actors.get(a.id);
      const target = this.actors.get(a.target);
      if (!x) return;
      const ranged = RANGED[this.ctx.kit.weapon];
      x.attack = { t0: this.scene.t, dur: ranged ? 0.9 : 0.7 };
      if (target) x.facing = target.x > x.x ? 1 : -1;
      const strikeAt = this.scene.t + (ranged ? 0.3 : 0.32);
      this.scene.steps.splice(this.scene.idx, 0, [strikeAt, 'strike', { id: a.id, target: a.target, blocked: !!a.blocked }]);
      this.scene.steps.sort((p, q) => p[0] - q[0]);
      SFX.play('whoosh');
    }
    a_strike(a) { // the moment an attack lands
      const x = this.actors.get(a.id);
      const target = this.actors.get(a.target);
      if (!x || !target) return;
      const ranged = RANGED[this.ctx.kit.weapon];
      const s = target.scale || 1;
      const hit = { x: target.x, y: target.y - 32 * s };
      if (ranged) {
        const from = { x: x.x + x.facing * 34 * (x.scale || 1), y: x.y - 32 * (x.scale || 1) };
        this.fx.push({ type: 'bolt', x0: from.x, y0: from.y, x1: hit.x, y1: hit.y, color: ranged.color, life: 0.25, max: 0.25, stage: this.stage });
        this.fx.push({ type: 'glow', x: from.x, y: from.y, r: 40 * (x.scale || 1) / 3, color: ranged.color, life: 0.18, max: 0.18, stage: this.stage });
        SFX.play(ranged.sfx);
      } else {
        x.knock = { t0: this.scene.t, x0: x.x, dx: x.facing * 40 * (x.scale || 1) / 3 };
        this.fx.push({ type: 'slash', x: hit.x, y: hit.y, r: 34 * s, dir: x.facing, life: 0.35, max: 0.35, stage: this.stage });
        SFX.play('slash');
      }
    }
    a_hit(a) {
      const x = this.actors.get(a.id);
      if (!x) return;
      this.flash = { a: 0.55, color: '255,40,40' };
      this.shake = 0.8;
      SFX.play('hit');
      x.knock = { t0: this.scene.t, x0: x.x, dx: (a.dir || 1) * 26 * (x.scale || 1) / 3 };
      for (let i = 0; i < 18; i++) {
        const ang = Math.random() * TAU, v = 80 + Math.random() * 240;
        this.fx.push({ type: 'spark', x: x.x, y: x.y - 34 * (x.scale || 1), vx: Math.cos(ang) * v, vy: Math.sin(ang) * v - 80, g: 500, color: Math.random() < 0.5 ? '#ff3a3a' : '#ffd0d0', size: 3 + Math.random() * 4, life: 0.7, max: 0.7, stage: this.stage });
      }
    }
    a_die(a) {
      const x = this.actors.get(a.id);
      if (!x) return;
      x.pose = 'dead'; x.fallT = this.scene.t; x.walking = false; x.move = null;
      SFX.play('fall');
    }
    a_shield(a) {
      const x = this.actors.get(a.id);
      if (!x) return;
      const s = x.scale || 1;
      this.fx.push({ type: 'ward', x: x.x, y: x.y - 32 * s, r: 44 * s, life: a.dur || 1.8, max: a.dur || 1.8, stage: this.stage });
      this.flash = { a: 0.35, color: '80,255,160' };
      SFX.play('shield');
    }
    a_smoke(a) {
      const x = this.who(a.id) || this.pt(a.at);
      const s = x.scale || 1;
      for (let i = 0; i < 16; i++) this.fx.push({ type: 'puff', x: x.x + (Math.random() - 0.5) * 30 * s, y: x.y - Math.random() * 50 * s, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 40, g: 0, r: (8 + Math.random() * 12) * s, life: 1.2, max: 1.2, stage: this.stage });
      SFX.play('poof');
    }
    a_glint(a) {
      const x = this.actors.get(a.id);
      if (!x) return;
      const s = x.scale || 1;
      this.fx.push({ type: 'glint', x: x.x + x.facing * 24 * s, y: x.y - 50 * s, r: 14 * s, life: 0.7, max: 0.7, stage: this.stage });
      SFX.play('reveal');
    }
    a_shards() {
      for (let i = 0; i < 26; i++) this.fx.push({ type: 'shard', x: 1330 + Math.random() * 80, y: 380 + Math.random() * 80, vx: (Math.random() - 0.3) * 300, vy: -100 - Math.random() * 200, g: 900, size: 4 + Math.random() * 6, life: 1.1, max: 1.1, stage: 'interior' });
      this.room.broken = true;
      SFX.play('shatter');
    }
    a_despawn(a) { this.actors.delete(a.id); }
    a_lamp(on) { this.room.lamp = on ? 1 : 0; }
    a_flicker(a) { this.room.flickerUntil = this.scene.t + (a.dur || 0.8); }
    a_thunder() { this.room.lightning = 1; this.flash = { a: 0.45, color: '220,230,255' }; SFX.play('thunder'); }
    a_door(a) { this.room.doorAnim = { from: this.room.door, to: a.to == null ? 1 : a.to, t0: this.scene.t, dur: a.dur || 1 }; }
    a_knock() { this.ctx.house.shakeUntil = this.town.time + 0.7; SFX.play('knock'); }
    a_houseLight(on) { this.town.cineWindow = on ? { house: this.ctx.houseIdx } : null; }
    a_shake(v) { this.shake = typeof v === 'number' ? v : 0.6; }
    a_flash(a) { this.flash = { a: a.a || 0.6, color: a.color || '255,255,255' }; }
    a_title(a) { this.title = { text: this.text(a.text), sub: this.text(a.sub), color: a.color || '#ffffff', t0: this.scene.t, dur: a.dur || 2.5 }; }
    a_untitle() { this.title = null; }
    a_spot(a) { this.spot = a && a.id ? a.id : null; }
    a_fog(on) { this.fogTarget = on ? 1 : 0; }
    a_confetti(n) { this.town.confetti(n || 120); }
    // Town residents (used by the execution scene).
    a_execute() { if (this.ctx.owner) this.town.finishDeath(this.ctx.owner.id); }
    a_hold() { if (this.ctx.owner) this.town.hold(this.ctx.owner.id); }
    a_release() { if (this.ctx.owner) this.town.release(this.ctx.owner.id); }
    a_walkResident(a) {
      const c = this.ctx.owner && this.town.chars.get(this.ctx.owner.id);
      if (c) c.cineTarget = this.pt(a.to);
    }
    a_crowd(a) {
      const others = [...this.town.chars.values()].filter((c) => c.alive && (!this.ctx.owner || c.id !== this.ctx.owner.id));
      const lines = a.lines || ['!'];
      for (let i = 0; i < Math.min(a.count || 3, others.length); i++) {
        const c = others.splice(Math.floor(Math.random() * others.length), 1)[0];
        c.bubble = { text: lines[Math.floor(Math.random() * lines.length)], until: this.town.time + (a.dur || 1.6) + i * 0.2 };
        c.jumpT = 0.5;
      }
    }

    // ----- drawing -----
    // Living cinematic actors in the town, for the depth-sorted entity list.
    townEntities() {
      if (this.stage !== 'town') return [];
      const t = this.now();
      return [...this.actors.values()].filter((a) => a.stage === 'town' && a.alpha > 0.01).map((a) => ({ y: a.y, draw: (ctx) => this.drawActor(ctx, a, t) }));
    }

    drawActor(ctx, a, t) {
      const kit = this.ctx.kit;
      const o = { t, walking: a.walking, gait: a.gait, facing: a.facing, scale: a.scale, alpha: a.alpha, crouch: a.crouch, attackP: a.attackP, kit, pose: a.pose, armed: a.armed };
      if (a.pose === 'dead' && a.kind !== 'resident') {
        const p = clamp((t - (a.fallT || 0)) / 0.45, 0, 1);
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(EASE.out(p) * (Math.PI / 2) * (a.facing < 0 ? 1 : -1)); ctx.translate(-a.x, -a.y);
        o.pose = 'stand'; o.walking = false;
        if (a.kind === 'protector') drawProtector(ctx, a.x, a.y, o); else drawShadowFigure(ctx, a.x, a.y, t, false);
        ctx.restore();
        return;
      }
      if (a.kind === 'assassin') drawAssassin(ctx, a.x, a.y, o);
      else if (a.kind === 'protector') drawProtector(ctx, a.x, a.y, o);
      else if (a.kind === 'detective') drawDetective(ctx, a.x, a.y, o);
      else if (a.kind === 'resident') drawResident(ctx, a, t);
      else {
        ctx.save(); ctx.translate(a.x, a.y); ctx.scale(a.scale, a.scale); ctx.globalAlpha *= a.alpha;
        drawShadowFigure(ctx, 0, 0, t, a.walking);
        ctx.restore();
      }
    }

    // Things that glow through the night overlay (town stage).
    drawTownGlow(ctx) {
      if (this.stage !== 'town') return;
      const env = this.environment;
      if (env && this.scene) {
        const h = this.ctx.house, elapsed = this.scene.t - env.t0, p = clamp(elapsed / 5, 0, 1);
        ctx.save();
          if (env.kind === 'fuse') {
            const x = h.x + 8, y = h.y - 8;
            ctx.strokeStyle = '#a88b54'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 20, y); ctx.lineTo(x + 10, y - 7); ctx.stroke();
            ctx.fillStyle = '#ffe2a0'; ctx.fillRect(x + Math.sin(elapsed * 30) * 3, y - 11, 5, 5);
          } else if (env.kind === 'explosion') {
            for (let i = 0; i < 24; i++) { const a = i * 2.4, distance = elapsed * (20 + i % 5 * 12); ctx.fillStyle = elapsed < .8 ? '#e6a45e' : '#4a4544'; ctx.fillRect(h.x + Math.cos(a) * distance, h.y - 30 + Math.sin(a) * distance - elapsed * 22 + elapsed * elapsed * 12, 5 + i % 8, 5); }
            for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(58,55,54,${Math.max(0,.65-elapsed*.09)})`; ctx.beginPath(); ctx.ellipse(h.x + Math.sin(i) * elapsed * 15, h.y - 25 - elapsed * 25, 10 + elapsed * 18, 8 + elapsed * 13, 0, 0, TAU); ctx.fill(); }
          } else if (['revival','ash'].includes(env.kind)) {
            for (let i = 0; i < 35; i++) { ctx.fillStyle = env.kind === 'revival' ? '#b8dec9' : '#aaa4a0'; const a = i * 2.4 + elapsed; ctx.fillRect(h.x + Math.cos(a) * (12 + elapsed * (env.kind === 'ash' ? 15 : 3)), h.y - i * 2 - elapsed * 10, 2, 3); }
          } else if (env.kind === 'flood') {
          ctx.fillStyle = `rgba(65,155,215,${0.45 + 0.2 * p})`; ctx.fillRect(h.x - 160, h.y + 30 - p * 120, 320, 140 * p);
          ctx.strokeStyle = '#afe3ff'; ctx.lineWidth = 3;
          for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.ellipse(h.x - 130 + i * 38, h.y + 30 - p * 120 + Math.sin(elapsed * 4 + i) * 5, 18, 4, 0, 0, TAU); ctx.stroke(); }
        } else if (env.kind === 'meteor') {
          if (elapsed <= 5) { const x = h.x - (1 - p) * 280, y = h.y - (1 - p) * 650;
            ctx.strokeStyle = '#ff974f'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(x - 80, y - 150); ctx.lineTo(x, y); ctx.stroke();
            ctx.fillStyle = '#ffe6a1'; ctx.beginPath(); ctx.arc(x, y, 17, 0, TAU); ctx.fill();
          } else { ctx.fillStyle = `rgba(255,120,40,${Math.max(0, 1 - (elapsed - 5) / 2)})`; ctx.beginPath(); ctx.arc(h.x, h.y, 40 + (elapsed - 5) * 80, 0, TAU); ctx.fill(); }
        } else {
          for (let i = 0; i < 14; i++) { const y = h.y - i * 13, w = 12 + i * 6;
            ctx.strokeStyle = `rgba(195,209,220,${0.6 - i * 0.02})`; ctx.lineWidth = 8;
            ctx.beginPath(); ctx.ellipse(h.x + Math.sin(elapsed * 8 + i * 0.4) * 16, y, w, 5 + i, elapsed * 0.15, 0, TAU); ctx.stroke();
          }
        }
        ctx.restore();
      }
      const t = this.now();
      for (const a of this.actors.values()) {
        if (a.stage === 'town' && a.kind === 'assassin' && a.alpha > 0.05) drawAssassinEyes(ctx, a.x, a.y, { ...a, kit: this.ctx.kit });
      }
      this.drawFx(ctx, 'town');
      void t;
    }

    // Speech bubbles on the crisp text overlay (world coordinates).
    drawTownTexts() {
      if (!this.scene || this.stage !== 'town') return;
      for (const a of this.actors.values()) if (a.stage === 'town' && a.bubble) this.town.drawBubble(a.x, a.y - 66 * (a.scale || 1), a.bubble.text);
    }

    drawInteriorTexts(ctx) {
      if (!this.scene) return;
      for (const a of this.actors.values()) if (a.stage === 'interior' && a.bubble) this.drawBigBubble(ctx, a.x, a.y - 74 * (a.scale || 1), a.bubble.text);
    }

    drawInteriorStage(ctx) {
      const kit = this.ctx.kit;
      const t = this.now();
      const r = this.room;
      drawInterior(ctx, kit, r, t);
      const res = [...this.actors.values()].filter((a) => a.stage === 'interior');
      const lying = res.filter((a) => a.kind === 'resident' && (a.pose === 'sleep' || a.pose === 'sit'));
      drawBed(ctx, kit, 'back');
      for (const a of lying) this.drawActor(ctx, a, t);
      drawBed(ctx, kit, 'front', shade(this.ctx.avatar.color, -0.15));
      res.filter((a) => !lying.includes(a)).sort((p, q) => p.y - q.y).forEach((a) => this.drawActor(ctx, a, t));
      this.drawFx(ctx, 'interior', 'under');

      // lighting
      const lamp = r.lampLevel == null ? r.lamp : r.lampLevel;
      ctx.fillStyle = `rgba(4,6,22,${0.8 - lamp * 0.38 - r.lightning * 0.5})`;
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = (x, y, rad, rgb, a) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
      };
      // moonlight through the window
      ctx.fillStyle = 'rgba(120,150,255,0.10)';
      ctx.beginPath(); ctx.moveTo(1250, 470); ctx.lineTo(1550, 470); ctx.lineTo(1500, 1080); ctx.lineTo(900, 1080); ctx.closePath(); ctx.fill();
      glow(1400, 300, 260, '140,170,255', 0.18);
      if (r.door > 0.05) {
        ctx.fillStyle = `rgba(255,210,130,${0.22 * r.door})`;
        ctx.beginPath(); ctx.moveTo(220, WALL_BASE); ctx.lineTo(430, WALL_BASE); ctx.lineTo(700 + r.door * 300, H); ctx.lineTo(60, H); ctx.closePath(); ctx.fill();
      }
      if (lamp > 0) {
        if (kit.room.style === 'habitat') glow(1400, 560, 420, '48,255,240', 0.16 * lamp);
        else glow(1795, 470, 520, '255,200,110', 0.45 * lamp);
      }
      ctx.restore();
      if (lamp > 0 && kit.room.style === 'bedroom') { ctx.fillStyle = 'rgba(255,232,168,0.9)'; ctx.beginPath(); ctx.moveTo(1750, 480); ctx.lineTo(1840, 480); ctx.lineTo(1818, 410); ctx.lineTo(1772, 410); ctx.closePath(); ctx.fill(); }
      for (const a of res) {
        if (a.kind === 'assassin' && a.alpha > 0.05) drawAssassinEyes(ctx, a.x, a.y, { ...a, kit });
      }
      this.drawFx(ctx, 'interior');
    }

    drawBigBubble(ctx, x, y, text) {
      ctx.font = `700 44px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = Math.max(70, ctx.measureText(text).width + 44);
      ctx.fillStyle = '#ffffff';
      roundRect(ctx, x - w / 2, y - 76, w, 64, 24); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 14, y - 14); ctx.lineTo(x + 14, y - 14); ctx.lineTo(x, y + 6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1d1d24'; ctx.fillText(text, x, y - 43);
    }

    drawFx(ctx, stage, layer) {
      for (const e of this.fx) {
        if (e.stage !== stage) continue;
        if (layer === 'under' && e.type !== 'puff') continue;
        if (layer !== 'under' && e.type === 'puff' && stage === 'interior') continue;
        const p = 1 - e.life / e.max;
        ctx.save();
        switch (e.type) {
          case 'slash':
            ctx.strokeStyle = `rgba(255,255,255,${1 - p})`; ctx.lineWidth = 8 * (1 - p) + 2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r, e.dir > 0 ? -1.2 : Math.PI + 1.2, e.dir > 0 ? -1.2 + p * 2.6 : Math.PI + 1.2 - p * 2.6, e.dir < 0); ctx.stroke();
            ctx.strokeStyle = `rgba(255,60,60,${0.8 * (1 - p)})`; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.8, -1, 1.2 * p); ctx.stroke();
            break;
          case 'bolt':
            ctx.strokeStyle = e.color; ctx.lineWidth = 7; ctx.shadowColor = e.color; ctx.shadowBlur = 20; ctx.globalAlpha = 1 - p;
            ctx.beginPath(); ctx.moveTo(e.x0, e.y0); ctx.lineTo(lerp(e.x0, e.x1, Math.min(1, p * 3)), lerp(e.y0, e.y1, Math.min(1, p * 3))); ctx.stroke();
            break;
          case 'glow': {
            const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 3);
            g.addColorStop(0, e.color); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.globalAlpha = 1 - p; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 3, 0, TAU); ctx.fill();
            break;
          }
          case 'ward':
            ctx.globalAlpha = p < 0.15 ? p / 0.15 : 1 - Math.max(0, (p - 0.7) / 0.3);
            ctx.strokeStyle = '#6dffb0'; ctx.lineWidth = 6; ctx.shadowColor = '#4dff9a'; ctx.shadowBlur = 24;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.9 + Math.sin(p * 20) * 0.03), 0, TAU); ctx.stroke();
            ctx.fillStyle = 'rgba(80,255,160,0.15)'; ctx.fill();
            break;
          case 'spark': case 'shard':
            ctx.globalAlpha = Math.max(0, e.life / e.max);
            ctx.fillStyle = e.color || '#dff4ff';
            if (e.type === 'shard') { ctx.translate(e.x, e.y); ctx.rotate(e.life * 9); ctx.fillRect(-e.size / 2, -e.size, e.size, e.size * 2); } else { ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, TAU); ctx.fill(); }
            break;
          case 'puff':
            ctx.globalAlpha = 0.5 * (1 - p);
            ctx.fillStyle = '#4a4458'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (1 + p), 0, TAU); ctx.fill();
            break;
          case 'glint':
            ctx.globalAlpha = 1 - p; ctx.strokeStyle = '#fff6c0'; ctx.lineWidth = 3; ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
            ctx.beginPath(); ctx.moveTo(e.x - e.r * (1 + p), e.y); ctx.lineTo(e.x + e.r * (1 + p), e.y); ctx.moveTo(e.x, e.y - e.r * (1 + p)); ctx.lineTo(e.x, e.y + e.r * (1 + p)); ctx.stroke();
            break;
          default: break;
        }
        ctx.restore();
      }
    }

    // Screen-space overlays drawn on top of either stage (logical 1920x1080 coords).
    drawOverlay(ctx, spotPos) {
      if (this.snapshot && this.scene && this.scene.t < 5.5) {
        ctx.fillStyle = '#e8d9bc'; ctx.fillRect(130, 260, 300, 340);
        ctx.fillStyle = '#34384b'; ctx.fillRect(145, 275, 270, 270);
        // An anonymous pixelated figure, never an original photo or secret role.
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
          ctx.fillStyle = (r + c) % 3 ? '#72798b' : '#a5adb9';
          if ((c > 1 && c < 6 && r > 3) || (c > 2 && c < 5 && r > 0)) ctx.fillRect(155 + c * 30, 285 + r * 30, 30, 30);
        }
      }
      if (this.fog > 0.01) {
        const t = performance.now() / 1000;
        ctx.save();
        for (let i = 0; i < 9; i++) {
          const x = ((i * 260 + t * (18 + i * 3)) % (W + 600)) - 300, y = 300 + (i % 4) * 180;
          const g = ctx.createRadialGradient(x, y, 0, x, y, 380);
          g.addColorStop(0, `rgba(200,210,235,${0.16 * this.fog})`); g.addColorStop(1, 'rgba(200,210,235,0)');
          ctx.fillStyle = g; ctx.fillRect(x - 380, y - 380, 760, 760);
        }
        ctx.restore();
      }
      if (this.spot && spotPos) {
        const g = ctx.createRadialGradient(spotPos.x, spotPos.y, 120, spotPos.x, spotPos.y, 420);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.78)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      if (this.flash.a > 0.01) { ctx.fillStyle = `rgba(${this.flash.color},${this.flash.a})`; ctx.fillRect(0, 0, W, H); }
      if (this.fade > 0.001) { ctx.fillStyle = `rgba(0,0,0,${this.fade})`; ctx.fillRect(-10, -10, W + 20, H + 20); }
      const bar = 120 * this.letter;
      if (bar > 0.5) { ctx.fillStyle = '#000'; ctx.fillRect(-10, -10, W + 20, bar + 10); ctx.fillRect(-10, H - bar, W + 20, bar + 10); }
      if (this.title && this.scene) {
        const tt = this.scene.t - this.title.t0;
        const a = tt < 0.5 ? tt / 0.5 : tt > this.title.dur - 0.5 ? Math.max(0, (this.title.dur - tt) / 0.5) : 1;
        if (a > 0) {
          ctx.save();
          ctx.globalAlpha = a;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = `700 96px ${FONT}`;
          ctx.shadowColor = this.title.color; ctx.shadowBlur = 30;
          ctx.fillStyle = this.title.color;
          ctx.fillText(this.title.text, W / 2, H / 2 - 30 + (1 - a) * 20, W - 160);
          ctx.shadowBlur = 0;
          if (this.title.sub) { ctx.font = `500 40px ${FONT}`; ctx.fillStyle = '#e8e4ff'; ctx.fillText(this.title.sub, W / 2, H / 2 + (this.snapshot ? 120 : 60), W - 160); }
          ctx.restore();
        }
      }
    }

    shakeOffset() {
      if (this.shake <= 0) return { x: 0, y: 0 };
      const m = this.shake * 14;
      return { x: (Math.random() - 0.5) * m, y: (Math.random() - 0.5) * m };
    }
  }

  window.Cinema = Cinema;
  window.MT_CINEMA_KITS = { KITS, THEME_KIT };
})();
