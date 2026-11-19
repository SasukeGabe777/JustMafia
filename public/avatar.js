// Character drawing shared by the big screen and the phone avatar preview.
// All functions draw with the character's FEET at (x, y).
(function (root) {
  const TAU = Math.PI * 2;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p);
    return `rgb(${r},${g},${b})`;
  }

  // hx, hy = head center, r = head radius, f = facing (-1..1)
  function drawHat(ctx, hat, hx, hy, r, color, f = 0) {
    ctx.save();
    switch (hat) {
      case 'top':
        ctx.fillStyle = '#1e1e24';
        roundRect(ctx, hx - r * 1.15, hy - r * 0.95, r * 2.3, r * 0.3, r * 0.12); ctx.fill();
        roundRect(ctx, hx - r * 0.72, hy - r * 2.05, r * 1.44, r * 1.2, r * 0.15); ctx.fill();
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(hx - r * 0.72, hy - r * 1.12, r * 1.44, r * 0.22);
        break;
      case 'cap':
        ctx.fillStyle = shade(color, -0.15);
        ctx.beginPath(); ctx.arc(hx, hy - r * 0.3, r * 1.0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = shade(color, -0.35);
        ctx.beginPath(); ctx.ellipse(hx + (f >= 0 ? 1 : -1) * r * 0.85, hy - r * 0.3, r * 0.7, r * 0.2, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(hx, hy - r * 1.28, r * 0.14, 0, TAU); ctx.fill();
        break;
      case 'crown': {
        ctx.fillStyle = '#f5c518';
        ctx.strokeStyle = '#b8860b'; ctx.lineWidth = r * 0.08;
        const y0 = hy - r * 0.75, y1 = hy - r * 1.7, w = r * 0.95;
        ctx.beginPath();
        ctx.moveTo(hx - w, y0); ctx.lineTo(hx - w, y1 + r * 0.25); ctx.lineTo(hx - w * 0.5, y0 - r * 0.45);
        ctx.lineTo(hx, y1); ctx.lineTo(hx + w * 0.5, y0 - r * 0.45); ctx.lineTo(hx + w, y1 + r * 0.25); ctx.lineTo(hx + w, y0);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(hx, y0 - r * 0.25, r * 0.15, 0, TAU); ctx.fill();
        break;
      }
      case 'beanie':
        ctx.fillStyle = shade(color, 0.1);
        ctx.beginPath(); ctx.arc(hx, hy - r * 0.25, r * 1.02, Math.PI, 0); ctx.fill();
        ctx.fillStyle = shade(color, -0.2);
        roundRect(ctx, hx - r * 1.08, hy - r * 0.45, r * 2.16, r * 0.42, r * 0.15); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy - r * 1.35, r * 0.3, 0, TAU); ctx.fill();
        break;
      case 'party': {
        const base = hy - r * 0.7;
        ctx.fillStyle = '#9b59b6';
        ctx.beginPath(); ctx.moveTo(hx - r * 0.7, base); ctx.lineTo(hx + r * 0.7, base); ctx.lineTo(hx + r * 0.1, hy - r * 2.3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = r * 0.15;
        ctx.beginPath(); ctx.moveTo(hx - r * 0.45, base - r * 0.45); ctx.lineTo(hx + r * 0.48, base - r * 0.55); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(hx - r * 0.2, base - r * 1.0); ctx.lineTo(hx + r * 0.3, base - r * 1.08); ctx.stroke();
        ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(hx + r * 0.1, hy - r * 2.3, r * 0.22, 0, TAU); ctx.fill();
        break;
      }
      case 'bow': {
        const bx = hx + r * 0.55, by = hy - r * 0.85;
        ctx.fillStyle = '#ff5fa2';
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - r * 0.7, by - r * 0.45); ctx.lineTo(bx - r * 0.7, by + r * 0.4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + r * 0.7, by - r * 0.45); ctx.lineTo(bx + r * 0.7, by + r * 0.4); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#d63384'; ctx.beginPath(); ctx.arc(bx, by, r * 0.2, 0, TAU); ctx.fill();
        break;
      }
      case 'cowboy':
        ctx.fillStyle = '#8b5a2b';
        ctx.beginPath(); ctx.ellipse(hx, hy - r * 0.75, r * 1.65, r * 0.32, 0, 0, TAU); ctx.fill();
        roundRect(ctx, hx - r * 0.75, hy - r * 1.75, r * 1.5, r * 1.05, r * 0.35); ctx.fill();
        ctx.fillStyle = '#5d3a1a'; ctx.fillRect(hx - r * 0.75, hy - r * 0.98, r * 1.5, r * 0.18);
        break;
      case 'chef':
        ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#d0d4dc'; ctx.lineWidth = r * 0.07;
        ctx.fillRect(hx - r * 0.75, hy - r * 1.3, r * 1.5, r * 0.6);
        ctx.strokeRect(hx - r * 0.75, hy - r * 1.3, r * 1.5, r * 0.6);
        ctx.beginPath();
        ctx.arc(hx - r * 0.5, hy - r * 1.55, r * 0.5, 0, TAU);
        ctx.arc(hx + r * 0.5, hy - r * 1.55, r * 0.5, 0, TAU);
        ctx.fill();
        ctx.beginPath(); ctx.arc(hx, hy - r * 1.85, r * 0.6, 0, TAU); ctx.fill();
        break;
      default: break;
    }
    ctx.restore();
  }

  // The original simple vector character (kept as drawClassic; drawCharacter is drawSmooth below).
  function drawClassic(ctx, x, y, av, o = {}) {
    const t = o.t || 0;
    const walking = !!o.walking;
    const bob = walking ? Math.abs(Math.sin(t * 11)) * 3 : Math.sin(t * 2.2 + (o.seed || 0)) * 0.8;
    const f = o.facing || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(o.scale || 1, o.scale || 1);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(0, 0, 13, 4.5, 0, 0, TAU); ctx.fill();

    ctx.translate(0, -bob - (o.jump || 0));
    if (o.spin) ctx.rotate(o.spin);

    // legs
    const sw = walking ? Math.sin(t * 11) * 3.5 : 0;
    ctx.fillStyle = av.pants || '#2d2f3a';
    roundRect(ctx, -8 + sw, -10, 6, 10, 2.5); ctx.fill();
    roundRect(ctx, 2 - sw, -10, 6, 10, 2.5); ctx.fill();
    ctx.fillStyle = av.shoes || '#33251d';
    ctx.fillRect(-9 + sw, -3, 8, 3); ctx.fillRect(2 - sw, -3, 8, 3);

    // body
    ctx.fillStyle = av.color;
    roundRect(ctx, -12, -31, 24, 24, 9); ctx.fill();
    ctx.fillStyle = shade(av.color, -0.22);
    roundRect(ctx, -12, -14, 24, 7, 3.5); ctx.fill();
    if (av.outfit === 'jacket') {
      ctx.fillStyle = '#efe6da'; ctx.fillRect(-3, -30, 6, 21);
    } else if (av.outfit === 'overalls') {
      ctx.fillStyle = av.pants || '#355879'; ctx.fillRect(-8, -23, 16, 15);
      ctx.fillRect(-8, -31, 3, 9); ctx.fillRect(5, -31, 3, 9);
    } else if (av.outfit === 'dress') {
      ctx.beginPath(); ctx.moveTo(-8, -25); ctx.lineTo(-17, -6); ctx.lineTo(17, -6); ctx.lineTo(8, -25); ctx.fill();
    }
    // One appearance, with theme equipment layered over the chosen clothes.
    if (o.theme === 'space') {
      ctx.strokeStyle = '#b4e7ef'; ctx.lineWidth = 2; ctx.strokeRect(-11, -30, 22, 21);
    } else if (['medieval', 'fantasy', 'dragons', 'dungeon'].includes(o.theme)) {
      ctx.fillStyle = shade(av.color, -0.4); ctx.fillRect(-14, -29, 4, 24); ctx.fillRect(10, -29, 4, 24);
    }
    // arms
    ctx.fillStyle = shade(av.color, -0.1);
    const as = walking ? Math.sin(t * 11) * 2.5 : 0;
    ctx.beginPath(); ctx.ellipse(-13, -20 - as, 3.6, 6.5, 0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(13, -20 + as, 3.6, 6.5, -0.2, 0, TAU); ctx.fill();

    // head
    ctx.fillStyle = av.skin;
    ctx.beginPath();
    if (av.face === 'square') roundRect(ctx, -11, -53, 22, 24, 4);
    else ctx.ellipse(0, -41, av.face === 'oval' ? 10 : 12, 12, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = av.hairColor || '#241b18';
    if (av.hair !== 'bald') {
      ctx.beginPath(); ctx.arc(0, -45, 12, Math.PI, TAU); ctx.fill();
      if (av.hair === 'long' || av.hair === 'bob') { ctx.fillRect(-13, -46, 4, av.hair === 'long' ? 23 : 16); ctx.fillRect(9, -46, 4, av.hair === 'long' ? 23 : 16); }
      if (av.hair === 'mohawk') ctx.fillRect(-3, -62, 6, 15);
      if (av.hair === 'curly') for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(-10 + i * 5, -53 + Math.abs(i - 2), 4, 0, TAU); ctx.fill(); }
    }
    // eyes
    const ex = f * 3;
    const blink = Math.sin(t * 1.3 + (o.seed || 0) * 7) > 0.985;
    ctx.fillStyle = av.eyes || '#1d1d24';
    if (o.scared) {
      ctx.beginPath(); ctx.arc(-4 + ex, -42, 2.6, 0, TAU); ctx.arc(4 + ex, -42, 2.6, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ex, -35, 2.5, 3, 0, 0, TAU); ctx.fill();
    } else if (blink) {
      ctx.fillRect(-6 + ex, -42, 4, 1.2); ctx.fillRect(2 + ex, -42, 4, 1.2);
    } else {
      ctx.beginPath(); ctx.arc(-4 + ex, -42, 1.9, 0, TAU); ctx.arc(4 + ex, -42, 1.9, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,120,120,0.35)';
    ctx.beginPath(); ctx.arc(-7 + ex, -37.5, 2.3, 0, TAU); ctx.arc(7 + ex, -37.5, 2.3, 0, TAU); ctx.fill();
    ctx.fillStyle = av.hairColor || '#241b18';
    if (av.facialHair === 'beard') { ctx.beginPath(); ctx.arc(0, -35, 8, 0, Math.PI); ctx.fill(); }
    if (av.facialHair === 'moustache') ctx.fillRect(-5, -36, 10, 2);
    if (av.features === 'freckles') for (const dx of [-8, -5, 5, 8]) ctx.fillRect(dx, -37, 1, 1);
    ctx.strokeStyle = '#6e3f36'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-3, -33); ctx.lineTo(3, av.features === 'serious' ? -33 : -32); ctx.stroke();
    if (av.accessory === 'glasses') { ctx.strokeStyle = '#272933'; ctx.strokeRect(-9 + ex, -46, 8, 7); ctx.strokeRect(1 + ex, -46, 8, 7); }
    if (av.accessory === 'earring') { ctx.fillStyle = '#ffd35c'; ctx.fillRect(11, -39, 2, 5); }
    if (av.accessory === 'scarf') { ctx.fillStyle = '#ffd35c'; ctx.fillRect(-11, -31, 22, 4); ctx.fillRect(5, -27, 4, 12); }

    drawHat(ctx, av.hat, 0, -41, 12, av.color, f);
    ctx.restore();
  }

  // Off-screen layer for see-through characters: vector art drawn straight at low alpha shows
  // every overlap (legs through the coat, the far arm through the body), so paint it opaque into
  // a buffer at the screen's resolution, then lay the buffer down translucent. `paint(b)` draws in
  // character units with the feet at (0, 0); `post(b, w, h, k)` may tint the buffer. Returns
  // false without a DOM (stub canvases in tests), and the caller draws straight instead.
  const LAYER = { l: 48, t: 108, w: 96, h: 122 }, layers = [];
  let layerDepth = 0;
  function viaLayer(ctx, x, y, s, alpha, paint, post) {
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc || typeof ctx.getTransform !== 'function' || typeof ctx.drawImage !== 'function' || layerDepth > 2) return false;
    const m = ctx.getTransform(), k = Math.min(8, Math.max(0.5, Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)))) * Math.abs(s);
    const bw = Math.max(1, Math.ceil(LAYER.w * k)), bh = Math.max(1, Math.ceil(LAYER.h * k));
    const c = layers[layerDepth] || (layers[layerDepth] = doc.createElement('canvas'));
    if (c.width < bw || c.height < bh) { c.width = Math.max(c.width, bw); c.height = Math.max(c.height, bh); }
    const b = c.getContext('2d');
    b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'source-over'; b.globalAlpha = 1; b.filter = 'none'; b.shadowBlur = 0; b.clearRect(0, 0, bw, bh);
    b.setTransform(k, 0, 0, k, LAYER.l * k, LAYER.t * k);
    layerDepth++; try { paint(b); } finally { layerDepth--; }
    b.setTransform(1, 0, 0, 1, 0, 0);
    if (post) post(b, bw, bh, k);
    b.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.drawImage(c, 0, 0, bw, bh, x - LAYER.l * s, y - LAYER.t * s, LAYER.w * s, LAYER.h * s);
    ctx.restore();
    return true;
  }
  // Ghosts. Classic (the default ghostSkin) is the player's own character, see-through, pale
  // blue and floating, its legs fading away; every other ghostSkin is a costume ghost (below),
  // drawn 1.4x so it stands as tall as a character. The shop and JustMafia share this.
  function drawGhost(ctx, x, y, av, o = {}) {
    av = av || {};
    if (av.ghostSkin && av.ghostSkin !== 'classic' && GHOST_SKINS[av.ghostSkin]) { costumeGhost(ctx, x, y, av, { ...o, scale: (o.scale || 1) * 1.4 }); return; }
    const t = o.t || 0, s = o.scale || 1, fl = Math.sin(t * 2.5 + (o.seed || 0)) * 4 * s, alpha = (o.alpha != null ? o.alpha : 0.85) * 0.78;
    const look = { ...av, effect: 'none' };
    const opts = { t, seed: o.seed, facing: o.facing, theme: o.theme, expression: o.mouth ? 'surprised' : o.expression, spin: o.spin, noShadow: true };
    ctx.save();
    ctx.fillStyle = 'rgba(160,200,255,0.16)'; ctx.beginPath(); ctx.ellipse(x, y, 11 * s, 3.5 * s, 0, 0, TAU); ctx.fill();
    ctx.shadowColor = '#a8d6ff'; ctx.shadowBlur = o.glow ? 12 : 4;
    const tinted = (b, w, h, k) => {
      b.globalCompositeOperation = 'source-atop';
      const tint = b.createLinearGradient(0, 0, 0, h); tint.addColorStop(0, 'rgba(205,228,255,0.3)'); tint.addColorStop(1, 'rgba(150,190,255,0.5)');
      b.fillStyle = tint; b.fillRect(0, 0, w, h);
      b.globalCompositeOperation = 'destination-out'; // the legs fade away
      const fade = b.createLinearGradient(0, (LAYER.t - 22) * k, 0, (LAYER.t + 1) * k); fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(1, 'rgba(0,0,0,1)');
      b.fillStyle = fade; b.fillRect(0, 0, w, h);
    };
    if (!viaLayer(ctx, x, y - 7 * s + fl, s, alpha, (b) => drawSmooth(b, 0, 0, look, opts), tinted)) {
      ctx.globalAlpha *= alpha; drawSmooth(ctx, x, y - 7 * s + fl, look, { ...opts, scale: s });
    }
    ctx.restore();
  }
  function costumeGhost(ctx, x, y, av, o = {}) {
    const t = o.t || 0;
    const fl = Math.sin(t * 2.5 + (o.seed || 0)) * 4;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(o.scale || 1, o.scale || 1);
    ctx.globalAlpha *= o.alpha != null ? o.alpha : 0.85;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 3.5, 0, 0, TAU); ctx.fill();
    ctx.translate(0, -8 + fl);
    if (o.spin) ctx.rotate(o.spin);

    const skin = GHOST_SKINS[av.ghostSkin] || GHOST_SKINS.classic;
    if (skin.wisp) { drawWisp(ctx, av, t, o); ctx.restore(); return; }
    if (skin.cape) { ctx.fillStyle = '#8f1a2a'; ctx.beginPath(); ctx.moveTo(-12, -34); ctx.lineTo(12, -34); ctx.lineTo(18 + Math.sin(t * 3) * 2, 2); ctx.lineTo(-18 + Math.sin(t * 3 + 1) * 2, 2); ctx.closePath(); ctx.fill(); }
    ctx.shadowColor = skin.glow;
    ctx.shadowBlur = o.glow ? 18 : 6;
    ctx.fillStyle = skin.body;
    ctx.beginPath();
    ctx.moveTo(-14, -30);
    ctx.arc(0, -30, 14, Math.PI, 0);
    ctx.lineTo(14, -2);
    const waves = 4, w = 28 / waves;
    for (let i = 0; i < waves; i++) {
      const x0 = 14 - i * w;
      const dy = Math.sin(t * 6 + i) * 2;
      ctx.quadraticCurveTo(x0 - w / 2, 5 + dy, x0 - w, -2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = skin.outline || av.color; ctx.lineWidth = 2; ctx.stroke();
    if (skin.stripes) { ctx.fillStyle = '#6f8fc8'; ctx.fillRect(-13, -9, 26, 2); ctx.fillRect(-13, -5, 26, 1.5); }
    if (skin.chains) {
      ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(-12 + i * 4.6, -16 + i * 1.6 + Math.sin(t * 4 + i) * 0.6, 2.4, 1.5, 0.5, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = '#6a6f78'; ctx.fillRect(9, -9, 7, 6); ctx.strokeStyle = '#8a8f99'; ctx.beginPath(); ctx.arc(12.5, -9, 2.4, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#2a2d33'; ctx.fillRect(12, -7, 1, 2);
    }

    if (skin.eyesGlow) {
      ctx.shadowColor = skin.eyesGlow; ctx.shadowBlur = 10; ctx.fillStyle = skin.eyesGlow;
      ctx.beginPath(); ctx.ellipse(-5, -31, 2.6, 1.8, -0.3, 0, TAU); ctx.ellipse(5, -31, 2.6, 1.8, 0.3, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = skin.eyes || '#1d1d24';
      const big = skin.stripes ? 1.35 : 1;
      ctx.beginPath(); ctx.ellipse(-5, -31, 2.4 * big, 3.6 * big, 0, 0, TAU); ctx.ellipse(5, -31, 2.4 * big, 3.6 * big, 0, 0, TAU); ctx.fill();
    }
    if (o.mouth) { ctx.fillStyle = skin.eyes || '#1d1d24'; ctx.beginPath(); ctx.ellipse(0, -21, 3, 4, 0, 0, TAU); ctx.fill(); }
    if (skin.thirdEye) {
      ctx.fillStyle = '#f6e6ff'; ctx.beginPath(); ctx.ellipse(0, -39, 3, 1.8, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#7a2ad0'; ctx.beginPath(); ctx.arc(Math.sin(t * 1.3), -39, 1.1, 0, TAU); ctx.fill();
      const bx = 15, by = -14 + Math.sin(t * 2) * 2, g = ctx.createRadialGradient(bx - 1, by - 1, 0, bx, by, 6); g.addColorStop(0, '#f3e2ff'); g.addColorStop(1, 'rgba(150,90,230,.75)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#5a3a20'; ctx.fillRect(bx - 4, by + 4, 8, 2);
    }
    if (skin.crown) { ctx.fillStyle = '#e2b23c'; ctx.beginPath(); ctx.moveTo(-8, -42); ctx.lineTo(-8, -50); ctx.lineTo(-4, -46); ctx.lineTo(0, -52); ctx.lineTo(4, -46); ctx.lineTo(8, -50); ctx.lineTo(8, -42); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#c0283c'; ctx.fillRect(-1, -46, 2, 2); }
    else if (!skin.stripes) drawHat(ctx, av.hat, 0, -31, 12, av.color, 0);
    ctx.restore();
  }
  // Ghost looks (cosmetic field ghostSkin): colors and extras drawn by drawGhost.
  const GHOST_SKINS = {
    classic: { body: 'rgba(244,248,255,0.95)', glow: 'rgba(200,220,255,0.9)' },
    sheet: { body: 'rgba(242,239,230,0.97)', glow: 'rgba(220,220,210,0.6)', outline: '#c9c3b2', eyes: '#16161c', stripes: true },
    chains: { body: 'rgba(214,224,240,0.92)', glow: 'rgba(170,190,220,0.8)', outline: '#6a6f78', chains: true },
    royalGhost: { body: 'rgba(255,240,190,0.95)', glow: 'rgba(255,214,110,0.95)', outline: '#c9962a', crown: true, cape: true },
    wisp: { wisp: true },
    shadowEyes: { body: 'rgba(28,20,40,0.92)', glow: 'rgba(160,20,40,0.85)', outline: '#3a1a2a', eyesGlow: '#ff3a3a' },
    oracle: { body: 'rgba(206,176,255,0.93)', glow: 'rgba(180,120,255,0.95)', outline: '#7a4ad0', eyes: '#3a1a6a', thirdEye: true },
  };
  // The Will-o'-Wisp: a flickering blue flame with eyes.
  function drawWisp(ctx, av, t, o) {
    const f = Math.sin(t * 11) * 1.5 + Math.sin(t * 7.3) * 1;
    const g = ctx.createRadialGradient(0, -22, 2, 0, -22, 30); g.addColorStop(0, 'rgba(140,220,255,0.75)'); g.addColorStop(1, 'rgba(60,140,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -22, 30, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(90,180,255,0.9)'; ctx.beginPath(); ctx.moveTo(0, -48 - f * 2); ctx.quadraticCurveTo(13, -26, 9, -12); ctx.quadraticCurveTo(0, -4, -9, -12); ctx.quadraticCurveTo(-13, -26, 0, -48 - f * 2); ctx.fill();
    ctx.fillStyle = 'rgba(220,250,255,0.95)'; ctx.beginPath(); ctx.moveTo(0, -36 - f); ctx.quadraticCurveTo(6, -22, 4, -15); ctx.quadraticCurveTo(0, -11, -4, -15); ctx.quadraticCurveTo(-6, -22, 0, -36 - f); ctx.fill();
    ctx.fillStyle = '#123'; ctx.beginPath(); ctx.ellipse(-3, -21, 1.4, 2.2, 0, 0, TAU); ctx.ellipse(3, -21, 1.4, 2.2, 0, 0, TAU); ctx.fill();
    if (o.mouth) { ctx.beginPath(); ctx.ellipse(0, -15.5, 1.6, 2, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = av.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, -4, 4, 0, TAU); ctx.stroke(); // their color, a faint ring below
  }

  function drawShadowFigure(ctx, x, y, t, walking) {
    const bob = walking ? Math.abs(Math.sin(t * 9)) * 2 : 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 5, 0, 0, TAU); ctx.fill();
    ctx.translate(0, -bob);
    ctx.fillStyle = '#0b0b12';
    ctx.beginPath();
    ctx.moveTo(-17, 0); ctx.quadraticCurveTo(-14, -30, -10, -40);
    ctx.arc(0, -44, 12, Math.PI * 0.9, Math.PI * 0.1, false);
    ctx.quadraticCurveTo(14, -30, 17, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff2a2a';
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.ellipse(-4, -44, 2.4, 1.4, 0, 0, TAU); ctx.ellipse(4, -44, 2.4, 1.4, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ---------- The smooth JustGameBox character ----------
  // Bold dark outlines, soft gradients and a big friendly head, in the style of the box's tile
  // art. Draws every look field in options.js (outfits, hats, hair, accessories, shoes,
  // expressions, effects). Feet at (x, y); about 60 units tall plus the hat at scale 1.
  const OL = '#2b1f3d', SKIN0 = '#f3c9a0';
  const isHex = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  const sh = (c, a) => (isHex(c) ? shade(c, a) : c);
  // Outfits: base colour ('' = the player's colour), length (s shirt, c coat, r robe, d dress),
  // armour sleeves, and the details drawn inside the body.
  const OUTFITS = {
    shirt: {}, jacket: { d: 'jacket' }, overalls: { d: 'overalls' }, dress: { len: 'd', d: 'dress' },
    peasant: { c: '#b99a6b', d: 'peasant' }, traveler: { len: 'c', d: 'traveler' }, villager: { d: 'villager' }, tunic: { len: 'c', d: 'tunic' },
    worker: { d: 'worker' }, merchant: { len: 'c', d: 'merchant' }, scholar: { c: '#34407a', len: 'r', d: 'scholar' }, farmer: { d: 'farmer' },
    knight: { c: '#b4bec9', arm: true, d: 'knight' }, noble: { len: 'c', d: 'noble' }, assassin: { c: '#2b2733', len: 'c', d: 'assassin' },
    royalGuard: { c: '#b0303a', len: 'c', d: 'royalGuard' }, plagueDoctor: { c: '#2a2a30', len: 'r', d: 'plague' }, wizard: { len: 'r', d: 'wizard' },
    executioner: { c: '#1f1b22', d: 'executioner' }, sheriff: { c: '#e2cfa4', d: 'sheriff' }, alchemist: { c: '#3f6b4a', len: 'r', d: 'alchemist' },
    jester: { c: '#83517f', d: 'jester' }, mafiaSuit: { c: '#25242d', d: 'mafia' }, detectiveCoat: { c: '#b08a58', len: 'c', d: 'trench' },
    ghostHunter: { c: '#5f6b45', d: 'hunter' }, storyteller: { c: '#6a3f8a', len: 'r', d: 'storyteller' }, pirateCoat: { c: '#3a2318', len: 'c', d: 'pirate' },
    samuraiArmor: { c: '#7a1f1f', len: 'c', arm: true, d: 'samurai' }, royalRobe: { c: '#5a2a8a', len: 'r', d: 'royal' }, cyber: { c: '#1a2030', d: 'cyber' },
    vampire: { c: '#16121a', len: 'r', d: 'vampire' }, bloodKnight: { c: '#3a0d14', arm: true, d: 'bloodKnight' }, spaceSuit: { c: '#e4e8f3', d: 'space' },
    dragonScale: { c: '#a8321e', arm: true, d: 'dragon' }, rogueLeathers: { c: '#4a3424', d: 'rogue' }, tuxedo: { c: '#16161c', d: 'tux' },
    fedJacket: { c: '#1d3557', d: 'fed' }, parka: { c: '#c0392b', len: 'c', d: 'parka' }, blockArmor: { c: '#8fd0e8', d: 'block' },
    denimJacket: { c: '#3d5f8a', d: 'denim' }, trenchCoat: { c: '#8a7a5a', len: 'c', d: 'trench' },
    // Shop seasons (limited-time) and theme sets (public/shared/shop-season.js).
    cosySweater: { c: '#b5562e', d: 'cosy' }, flannel: { c: '#b8322c', d: 'flannel' }, uglySweater: { c: '#2f7a3a', d: 'ugly' }, cupidCardigan: { c: '#ff8fb4', d: 'cupid' },
    gardener: { c: '#fff1b0', d: 'gardener' }, hawaiian: { c: '#22a9c4', d: 'hawaii' }, lifeguard: { c: '#e0302e', d: 'lifeguard' }, skeleton: { c: '#1b1922', d: 'skeleton' }, mummy: { c: '#e9e0c6', d: 'mummy' },
    secretAgent: { c: '#17181e', d: 'agent' }, chefCoat: { c: '#f7f5ef', len: 'c', d: 'chef' }, inverness: { c: '#9a7a4e', len: 'c', d: 'inverness' }, dealerVest: { c: '#f4f1ea', d: 'dealer' },
    survivor: { c: '#a8956a', d: 'survivor' }, photoVest: { c: '#cdb88c', d: 'photo' },
  };
  const LEN = { s: [-10, 0], c: [-4, 2], r: [-1.5, 5], d: [-5, 6] };
  const BACK_HAIR = { long: 1, wavy: 1, braids: 1, bob: 1, medium: 1, ponytail: 1, afro: 1, curly: 1, bun: 1, royalBraids: 1 };
  const FULL_HEAD = { pumpkin: 1, executionerHood: 1, execHood: 1 }; // execHood: JustMafia's anonymous NPC executioner
  const OPEN_TOP = { none: 1, bow: 1, halo: 1, flowerCrown: 1, elfCirclet: 1, catEars: 1, antlers: 1, dragonHorns: 1, dealerVisor: 1, bandana: 1, reindeerBand: 1, heartBoppers: 1, bunnyEars: 1, devilHorns: 1 };

  // Body type: 'female' | 'male' (avatar field `body`). Old looks without it: long hairstyles or
  // a dress read as female, everything else as male (MT_OPTIONS.inferBody is the same rule).
  const LONG_HAIR = { long: 1, wavy: 1, braids: 1, bob: 1, ponytail: 1, bun: 1, royalBraids: 1, medium: 1 };
  const bodyOf = (av) => (av && (av.body === 'female' || av.body === 'male') ? av.body : av && (LONG_HAIR[av.hair] || av.outfit === 'dress') ? 'female' : 'male');
  // Which look fields a game wearable replaces while it is worn (see o.wear below).
  const WEAR_HIDES = {
    face: { glasses: 1, shades: 1, monocle: 1, eyepatch: 1, mask: 1, pipe: 1, nightShades: 1, heartShades: 1, snorkel: 1 },
    hand: { torch: 1, rose: 1, wristwatch: 1, lasso: 1, woodenSpoon: 1, magnifier: 1, cardFan: 1, rayGun: 1, camera: 1, ciderMug: 1, candyCane: 1, loveLetter: 1, bouquet: 1, icePop: 1, treatBucket: 1 },
    chest: { badge: 1, goldChain: 1, amulet: 1, scarf: 1, diceBag: 1, satchel: 1, autumnScarf: 1 },
    back: { cape: 1, wings: 1, batWings: 1, fairyWings: 1, backpack: 1, cupidWings: 1, butterflyWings: 1, surfboard: 1 },
  };
  // drawSmooth options (all optional): t (seconds), walking, facing (-1..1), scale, alpha, jump,
  // spin, lean (radians, from the feet), arms ({ l, r } radians: 0 hangs down, + swings toward
  // screen-left), dragged (±1: heels dug in), scared, dead, expression (overrides the look's),
  // theme (JustMafia world equipment: space, fantasy, rsp, spies, fbi), seed, and
  // wear: [{ spot: 'head'|'face'|'hand'|'chest'|'back', shape, a, b, c, glow }] game wearables
  // (public/wear-art.js draws the shapes; a worn spot replaces the look's own hat/extra there).
  function drawSmooth(g, x, y, av, o = {}) {
    av = av || {};
    // See-through (fading in/out, a dead body paling): draw it opaque off-screen, then fade it.
    const fadeA = (o.alpha == null ? 1 : o.alpha) * (g.globalAlpha == null ? 1 : g.globalAlpha);
    if (fadeA <= 0.003) return;
    if (fadeA < 0.995 && !o._flat) {
      const s0 = o.scale || 1;
      if (viaLayer(g, x, y, s0, o.alpha == null ? 1 : o.alpha, (b) => drawSmooth(b, 0, 0, av, { ...o, scale: 1, alpha: null, _flat: true }))) return;
    }
    const t = o.t || 0, walking = !!o.walking, f = Math.max(-1, Math.min(1, o.facing || 0));
    const color = isHex(av.color) ? av.color : '#3498db', skin = isHex(av.skin) ? av.skin : SKIN0;
    const hairC = isHex(av.hairColor) ? av.hairColor : '#543626', pants = isHex(av.pants) ? av.pants : '#2d2f3a', shoes = isHex(av.shoes) ? av.shoes : '#33251d';
    const outfit = OUTFITS[av.outfit] ? av.outfit : 'shirt', OF = OUTFITS[outfit], cloth = OF.c || color;
    const WEAR = (Array.isArray(o.wear) ? o.wear : []).filter((w) => w && typeof w.shape === 'string');
    const worn = (spot) => WEAR.filter((w) => w.spot === spot);
    const wearSpots = new Set(WEAR.map((w) => w.spot));
    let hat = av.hat || 'none', acc = av.accessory || 'none';
    const hair = av.hair || 'short';
    if (wearSpots.has('head')) hat = 'none';
    for (const s of ['face', 'hand', 'chest', 'back']) if (wearSpots.has(s) && WEAR_HIDES[s][acc]) acc = 'none';
    const fem = bodyOf(av) === 'female';
    const SW = fem ? 9.6 : 12.8; // shoulder half-width
    const HY = -44, R = 13, lw = 1.5;
    const drawWear = (spot, extra) => {
      const A = root.MTArt && root.MTArt.WEAR; if (!A) return;
      for (const w of worn(spot)) { const fn = A[w.shape]; if (!fn) continue; g.save(); try { if (w.glow) { g.shadowColor = w.c || w.a || '#fff'; g.shadowBlur = 6; } fn({ g, P, done, circ, ell, rr, poly, lin, rect, line, star, sh, OL, t, HY, R, fem, SW, skin, hairC, color, a: w.a || '#c0392b', b: w.b || '#2b1f3d', c: w.c || '#ffffff', d: w.d || '', glow: !!w.glow, ...extra }); } catch (err) { /* a broken wearable never breaks the character */ } g.restore(); }
    };
    const bob = walking ? Math.abs(Math.sin(t * 11)) * 2.5 : Math.sin(t * 2.2 + (o.seed || 0)) * 0.7;
    const P = () => g.beginPath();
    const done = (fill, stroke = OL, w = lw) => { if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.stroke(); } };
    const circ = (cx, cy, r) => { P(); g.arc(cx, cy, r, 0, TAU); };
    const ell = (cx, cy, rx, ry, rot = 0) => { P(); g.ellipse(cx, cy, rx, ry, rot, 0, TAU); };
    const rr = (rx, ry, w, h, r) => roundRect(g, rx, ry, w, h, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    const poly = (pts) => { P(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath(); };
    const lin = (c, y0, y1, a = 0.18, b = -0.16) => { if (!isHex(c)) return c; const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, shade(c, a)); gr.addColorStop(1, shade(c, b)); return gr; };
    const rect = (c, rx, ry, w, h) => { g.fillStyle = c; g.fillRect(rx, ry, w, h); };
    const line = (c, w, pts) => { P(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); };
    const star = (cx, cy, r, c) => { P(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); } g.closePath(); done(c, OL, 0.8); };
    const heart = (cx, cy, r, c, w = 0.7) => { P(); g.moveTo(cx, cy + r * 0.95); g.bezierCurveTo(cx - r * 1.7, cy - r * 0.2, cx - r * 0.75, cy - r * 1.45, cx, cy - r * 0.5); g.bezierCurveTo(cx + r * 0.75, cy - r * 1.45, cx + r * 1.7, cy - r * 0.2, cx, cy + r * 0.95); g.closePath(); done(c, OL, w); };

    g.save();
    g.translate(x, y);
    g.scale(o.scale || 1, o.scale || 1);
    if (o.alpha != null) g.globalAlpha *= o.alpha;
    if (!o.noShadow) { g.fillStyle = 'rgba(0,0,0,0.22)'; ell(0, 0, 14, 4.5); g.fill(); }
    if (o.lean) g.rotate(o.lean);
    g.translate(0, -bob - (o.jump || 0));
    if (o.spin) g.rotate(o.spin);

    effect('back');
    drawWear('back');
    // ---- behind the body ----
    if (acc === 'cape') { poly([[-10, -31], [10, -31], [17, -1], [-17, -1]]); done(lin('#a3243a', -31, 0)); rect('#d6af53', -10, -32, 20, 2.5); }
    if (acc === 'wings' || acc === 'batWings') {
      const bat = acc === 'batWings', flap = Math.sin(t * 3) * 0.12;
      for (const s of [-1, 1]) {
        g.save(); g.scale(s, 1); g.translate(8, -26); g.rotate(-0.25 - flap);
        P(); g.moveTo(0, 0); g.quadraticCurveTo(10, -18, 24, -16);
        if (bat) { g.lineTo(20, -8); g.quadraticCurveTo(17, -4, 14, -6); g.quadraticCurveTo(10, 0, 6, 0); }
        else { g.quadraticCurveTo(22, -6, 18, -3); g.quadraticCurveTo(16, 2, 11, 1); g.quadraticCurveTo(8, 5, 3, 4); }
        g.closePath(); done(bat ? '#3a2340' : '#fbf8ee');
        if (!bat) { line('#c9d6e6', 0.9, [[6, -6], [16, -10]]); line('#c9d6e6', 0.9, [[5, -2], [13, -3]]); }
        g.restore();
      }
    }
    if (acc === 'fairyWings') {
      const flap = Math.sin(t * 6) * 0.15;
      for (const s of [-1, 1]) { g.save(); g.scale(s, 1); g.translate(6, -26); g.rotate(-0.4 - flap); ell(9, -6, 10, 6, -0.3); done('rgba(190,240,255,0.75)', '#7ab8d6', 1); ell(7, 5, 6, 4, 0.4); done('rgba(255,190,240,0.75)', '#d68ab8', 1); g.restore(); }
    }
    if (acc === 'backpack') { rr(-13, -30, 26, 20, 5); done(lin('#8a5a34', -30, -10)); }
    if (acc === 'cupidWings') {
      const flap = Math.sin(t * 4) * 0.14;
      for (const s of [-1, 1]) { g.save(); g.scale(s, 1); g.translate(7, -27); g.rotate(-0.35 - flap); P(); g.moveTo(0, 0); g.quadraticCurveTo(6, -13, 17, -12); g.quadraticCurveTo(16, -7, 13, -5); g.quadraticCurveTo(14, -1, 9, 0); g.quadraticCurveTo(7, 4, 2, 3); g.closePath(); done(lin('#fff4f8', -13, 4)); line('#ff8fb4', 1, [[4, -4], [13, -9]]); line('#ff8fb4', 1, [[3, -1], [10, -3]]); heart(15, -11, 1.6, '#ff5c8a', 0.5); g.restore(); }
    }
    if (acc === 'butterflyWings') {
      const flap = Math.abs(Math.sin(t * 5)) * 0.25;
      for (const s of [-1, 1]) { g.save(); g.scale(s, 1); g.translate(5, -24); g.scale(1 - flap, 1); g.rotate(-0.2);
        ell(11, -9, 11, 9, -0.5); done(lin('#ff9a2a', -18, 0)); ell(9, 6, 7, 6, 0.5); done(lin('#3aa0ff', 0, 12));
        line(OL, 1.2, [[2, -2], [19, -15]]); circ(15, -12, 2); done('#fff6d6', OL, 0.6); circ(9, -8, 1.5); done('#fff6d6', OL, 0.6); circ(10, 7, 1.6); done('#ffffff', OL, 0.6); g.restore(); }
    }
    if (acc === 'surfboard') { g.save(); g.translate(4, -30); g.rotate(0.62); ell(0, -2, 8, 33); done(lin('#ffe9a8', -35, 31)); g.save(); ell(0, -2, 8, 33); g.clip(); rect('#ff5c8a', -9, -27, 18, 5); rect('#22a9c4', -9, -21, 18, 3.5); g.restore(); line(sh('#ffe9a8', -0.3), 0.8, [[0, -33], [0, 28]]); g.restore(); }
    if (BACK_HAIR[hair] && !FULL_HEAD[hat] && !((hair === 'bun' || hair === 'afro') && !OPEN_TOP[hat])) backHair();
    if (hat === 'hood') { ell(0, HY - 1, R + 4, R + 4); done(lin(sh(color, -0.3), HY - 18, HY + 16)); }

    // ---- legs and shoes ----
    const sw = walking ? Math.sin(t * 11) * 3 : 0, heel = o.dragged ? (o.dragged > 0 ? 3 : -3) : 0;
    const legX = fem ? 3.9 : 4.9, legW = fem ? 5.8 : 7;
    for (const [lx, d] of [[-legX, sw + heel], [legX, -sw + heel]]) {
      rr(lx - legW / 2 + d, -14, legW, 13, 3); done(lin(pants, -14, 0, 0.12, -0.12));
      shoe(lx + d);
    }

    // ---- body ----
    const [bot, flare] = LEN[OF.len || 's'];
    if (['traveler', 'noble', 'royalGuard', 'storyteller', 'vampire', 'royalRobe', 'pirateCoat'].includes(outfit)) { // a cloak behind
      const cc = { traveler: '#6b4a33', noble: '#7a1f3a', royalGuard: '#1f2a55', storyteller: '#3a2a5a', vampire: '#8f1a2a', royalRobe: '#b0283c', pirateCoat: '#5a1414' }[outfit];
      poly([[-SW + 0.5, -31], [SW - 0.5, -31], [SW + 4.5, bot + 3], [-SW - 4.5, bot + 3]]); done(lin(cc, -31, 0));
    }
    bodyPath(bot, flare); done(lin(cloth, -31, bot));
    g.save(); bodyPath(bot, flare); g.clip(); details(OF.d, bot); g.restore();
    bodyPath(bot, flare); done(null);
    if (fem && !OF.arm) { P(); g.moveTo(-SW + 3.5, -24.5); g.quadraticCurveTo(-SW / 2, -22.2, -1.2, -24.3); g.moveTo(1.2, -24.3); g.quadraticCurveTo(SW / 2, -22.2, SW - 3.5, -24.5); g.strokeStyle = 'rgba(43,31,61,0.35)'; g.lineWidth = 0.9; g.stroke(); }
    drawWear('chest', { top: -31.5, waist: -20, bot });
    // arms (sleeves + hands); a game prop (o.wear 'hand') sits in the right hand
    const armC = OF.arm ? '#b4bec9' : outfit === 'jester' ? '#e0b24a' : cloth;
    const as = walking ? Math.sin(t * 11) * 0.25 : 0, aw = fem ? 5.8 : 7.4;
    for (const s of [-1, 1]) {
      const rig = o.arms ? (s < 0 ? o.arms.l : o.arms.r) || 0 : null;
      g.save(); g.translate(s * (SW - 0.6), -28.5); g.rotate(rig != null ? rig + s * 0.1 : s * (fem ? 0.12 : 0.2) + (s < 0 ? as : -as));
      rr(-aw / 2, -1, aw, 13.5, aw / 2); done(lin(s < 0 && outfit === 'jester' ? '#83517f' : armC, -1, 13));
      circ(0, 14, fem ? 2.7 : 3.1); done(skin);
      if (acc === 'wristwatch' && s < 0) { rr(-3.6, 9, 7.2, 3, 1.2); done('#3a3a3a', OL, 0.8); circ(0, 10.5, 1.2); done('#e6e1d8', null); }
      if (acc === 'torch' && s > 0) torch();
      if (acc === 'rose' && s > 0) { line('#3a7a3a', 1.2, [[1, 16], [3, 6]]); circ(3.5, 5, 2.6); done('#d0263c', OL, 0.8); }
      if (s > 0) { g.translate(0, 14); handProp(); drawWear('hand'); }
      g.restore();
    }
    // chest + neck accessories
    if (acc === 'scarf') { rr(-11, -33, 22, 5.5, 2.7); done(lin('#ffd35c', -33, -27)); rr(4, -29, 5, 13, 2); done(lin('#ffcf4a', -29, -16)); line('#e0a93a', 1, [[5, -21], [8, -21]]); }
    if (acc === 'autumnScarf') { rr(-11.5, -33.5, 23, 6, 3); done(lin('#b5562e', -33.5, -27.5)); g.save(); rr(-11.5, -33.5, 23, 6, 3); g.clip(); for (let i = -12; i < 12; i += 6) rect('#e8b23a', i, -34, 2.2, 7); g.restore(); rr(3.5, -29.5, 6, 16, 2.4); done(lin('#b5562e', -29, -13)); rect('#e8b23a', 3.5, -24, 6, 2); rect('#f3ead8', 3.5, -19.5, 6, 2); for (let i = 0; i < 4; i++) line('#b5562e', 0.9, [[4.2 + i * 1.5, -13.6], [4.2 + i * 1.5, -11.6]]);
      rr(-9, -29.5, 5.5, 12, 2.4); done(lin('#b5562e', -29, -17)); rect('#e8b23a', -9, -24, 5.5, 2); }
    if (outfit === 'inverness') { P(); g.moveTo(-SW - 3.5, -25); g.quadraticCurveTo(-SW - 1, -33.5, 0, -33); g.quadraticCurveTo(SW + 1, -33.5, SW + 3.5, -25); g.lineTo(SW + 4.5, -17); g.quadraticCurveTo(0, -14.5, -SW - 4.5, -17); g.closePath(); done(lin('#9a7a4e', -33, -15));
      g.save(); g.clip(); g.globalAlpha *= 0.5; for (let i = -18; i < 18; i += 4) { rect('#5a4428', i, -34, 1.1, 20); rect('#5a4428', -18, -33 + (i + 18) / 2.2, 36, 1); } g.restore(); rr(-4, -33.5, 8, 3, 1.4); done('#5a4428', OL, 0.7); }
    if (acc === 'backpack') { line(OL, 3.2, [[-8, -31], [-8, -17]]); line(OL, 3.2, [[8, -31], [8, -17]]); line('#8a5a34', 1.6, [[-8, -31], [-8, -17]]); line('#8a5a34', 1.6, [[8, -31], [8, -17]]); }
    if (acc === 'satchel') { line(OL, 3, [[-9, -31], [9, -14]]); line('#9a6a3a', 1.6, [[-9, -31], [9, -14]]); rr(6, -16, 10, 8, 2); done(lin('#9a6a3a', -16, -8)); rect('#d6af53', 10, -13, 2, 2); }
    if (acc === 'amulet' || outfit === 'alchemist' || outfit === 'wizard') { line('#d7b375', 1, [[-5, -31], [0, -23], [5, -31]]); P(); g.moveTo(0, -25); g.lineTo(2.6, -21.5); g.lineTo(0, -18); g.lineTo(-2.6, -21.5); g.closePath(); done('#70c4bf', OL, 0.9); }
    if (acc === 'goldChain') { P(); g.ellipse(0, -30, 6.5, 6, 0, 0.2, Math.PI - 0.2); g.strokeStyle = '#e6b83a'; g.lineWidth = 1.6; g.stroke(); circ(0, -23.5, 2.4); done('#ffd96b', OL, 0.8); }
    if (acc === 'badge') { star(5.5, -23, 3.6, '#ffd35c'); }
    if (acc === 'diceBag') { P(); g.moveTo(9, -19); g.quadraticCurveTo(16, -18, 15, -10); g.quadraticCurveTo(12, -7, 9, -10); g.quadraticCurveTo(7, -15, 9, -19); done('#7a3a6a'); rr(10, -12, 3.5, 3.5, 0.8); done('#fff', OL, 0.7); }
    // JustMafia world equipment over the clothes (o.theme).
    if (o.theme === 'space') { rr(-SW + 1, -27, 4, 8, 1.5); done('#7ed6cf', OL, 0.8); line('#c4d8da', 1.4, [[SW - 3, -30], [SW - 3, -18]]); }
    if (o.theme === 'fantasy') { line('#c8b6df', 1, [[-4, -31], [0, -24], [4, -31]]); circ(0, -23, 2.2); done('#7ed6cf', OL, 0.7); }
    if (o.theme === 'rsp') { line('#1f4fa8', 1.4, [[-4, -31.5], [0, -22]]); line('#1f4fa8', 1.4, [[4, -31.5], [0, -22]]); rr(-3.5, -22.5, 7, 7, 1); done('#ffd21f', OL, 0.7); rect('#1f4fa8', -2.5, -21, 5, 1.6); }
    if (o.theme === 'spies' || o.theme === 'fbi') { rr(2.5, -27, 5, 4, 1); done('#c4ad73', OL, 0.6); }

    // ---- head ----
    const ex = f * 2.2;
    if (!FULL_HEAD[hat]) {
      for (const s of [-1, 1]) { circ(s * (R - 0.5) + ex * 0.3, HY + 1, 3.3); done(skin); }
      if (hat === 'elfCirclet') for (const s of [-1, 1]) { poly([[s * 11, HY - 2], [s * 19, HY - 8], [s * 12, HY + 4]]); done(skin); }
      headPath();
      const sg = g.createRadialGradient(-4, HY - 5, 2, 0, HY, R + 2); sg.addColorStop(0, sh(skin, 0.12)); sg.addColorStop(1, sh(skin, -0.08));
      done(sg);
      face(ex);
      // A photo face (JustMafia phone only, never uploaded): the 16x16 pixel portrait inside the face.
      if (av.faceSprite && typeof g.drawImage === 'function') { g.save(); headPath(); g.clip(); g.imageSmoothingEnabled = false; try { g.drawImage(av.faceSprite, -9 + ex * 0.5, HY - 9, 18, 18); } catch (err) { /* not drawable */ } g.restore(); }
      frontHair(ex);
    }
    drawWear('face', { e: ex, ey: HY + 1 });
    drawHatSmooth(ex);
    drawWear('head', { e: ex, top: HY - R });
    effect('front');
    g.restore();

    // The head: a soft, narrower jaw and pointed chin (female) or a broader, squarer jaw (male).
    function headPath() {
      const sq = av.face === 'square', ov = av.face === 'oval';
      P();
      if (fem) {
        const rw = ov ? R - 2.2 : sq ? R - 0.3 : R - 1, k = sq ? 0.78 : 0.6;
        g.ellipse(0, HY, rw, R, 0, Math.PI, 0);
        g.bezierCurveTo(rw, HY + R * k, rw * 0.42, HY + R + 0.6, 0, HY + R + 0.6);
        g.bezierCurveTo(-rw * 0.42, HY + R + 0.6, -rw, HY + R * k, -rw, HY);
      } else {
        const rw = ov ? R - 1 : R + 0.5, jin = sq ? 2.4 : ov ? 5.5 : 4.2;
        g.ellipse(0, HY, rw, R, 0, Math.PI, 0);
        g.lineTo(rw, HY + 4); g.quadraticCurveTo(rw - 0.2, HY + R - 0.6, rw - jin, HY + R + 0.4);
        g.lineTo(-rw + jin, HY + R + 0.4); g.quadraticCurveTo(-rw + 0.2, HY + R - 0.6, -rw, HY + 4);
      }
      g.closePath();
    }

    // ===== parts =====
    // Torso: broad and straight (male) or narrow shoulders, a defined waist and hips (female).
    function bodyPath(b, fl) {
      if (fem) {
        const w0 = SW + 0.4, wa = 8.2, wy = -21, w1 = 11.2 + fl;
        P(); g.moveTo(-w0 + 3.5, -31.5); g.lineTo(w0 - 3.5, -31.5); g.quadraticCurveTo(w0, -31.5, w0, -27.5);
        g.quadraticCurveTo(w0, -24, wa, wy); g.quadraticCurveTo(w1 - 0.5, b + 6 > wy ? Math.min(-14, b) : -14, w1, b - 2);
        g.quadraticCurveTo(w1, b, w1 - 2.5, b); g.lineTo(-w1 + 2.5, b); g.quadraticCurveTo(-w1, b, -w1, b - 2);
        g.quadraticCurveTo(-w1 + 0.5, Math.min(-14, b), -wa, wy); g.quadraticCurveTo(-w0, -24, -w0, -27.5); g.quadraticCurveTo(-w0, -31.5, -w0 + 3.5, -31.5); g.closePath();
        return;
      }
      const w0 = SW, w1 = SW - 0.6 + fl;
      P(); g.moveTo(-w0 + 4, -31.5); g.lineTo(w0 - 4, -31.5); g.quadraticCurveTo(w0, -31.5, w0, -27);
      g.lineTo(w1, b - 2); g.quadraticCurveTo(w1, b, w1 - 2.5, b); g.lineTo(-w1 + 2.5, b); g.quadraticCurveTo(-w1, b, -w1, b - 2);
      g.lineTo(-w0, -27); g.quadraticCurveTo(-w0, -31.5, -w0 + 4, -31.5); g.closePath();
    }
    function shoe(lx) {
      const st = av.shoeStyle || 'simple';
      if (st === 'sandals') { rr(lx - 3.5, -3, 8, 3, 1.5); done(skin); line('#8a5a34', 1.4, [[lx - 3, -2.5], [lx + 4, -2.5]]); return; }
      if (st === 'flipFlops') { rr(lx - 3.6, -0.6, 10.4, 1.8, 0.9); done('#ff5c8a', OL, 0.8); rr(lx - 3.2, -3, 8, 2.8, 1.4); done(skin, OL, 0.8); line('#22a9c4', 1.2, [[lx - 2.5, -2], [lx + 1, -0.4], [lx + 4.4, -2]]); return; }
      if (st === 'iceSkates') { P(); g.moveTo(lx - 3.6, -7); g.lineTo(lx + 3.4, -7); g.lineTo(lx + 3.4, -4); g.quadraticCurveTo(lx + 6.5, -4, lx + 6.5, -2); g.lineTo(lx + 6.5, -0.6); g.lineTo(lx - 3.8, -0.6); g.closePath(); done(lin('#ffffff', -7, 0));
        line('#c0283c', 0.7, [[lx - 1, -6], [lx + 2, -5]]); line('#c0283c', 0.7, [[lx - 1, -4.6], [lx + 2, -3.6]]); line('#8a8f99', 1, [[lx - 2, -0.6], [lx - 2, 1.4]]); line('#8a8f99', 1, [[lx + 4.5, -0.6], [lx + 4.5, 1.4]]);
        P(); g.moveTo(lx - 4.5, 1.6); g.lineTo(lx + 6, 1.6); g.quadraticCurveTo(lx + 8.4, 1.6, lx + 8, -0.4); g.strokeStyle = OL; g.lineWidth = 2.4; g.stroke(); g.strokeStyle = '#dfe6ee'; g.lineWidth = 1.2; g.stroke(); return; }
      if (st === 'wellies') { P(); g.moveTo(lx - 3.8, -9.5); g.lineTo(lx + 3.6, -9.5); g.lineTo(lx + 3.6, -3); g.quadraticCurveTo(lx + 6.6, -3, lx + 6.6, -1); g.lineTo(lx + 6.6, 0.3); g.lineTo(lx - 3.8, 0.3); g.closePath(); done(lin('#ffd23f', -9.5, 0)); rr(lx - 4.3, -10.4, 8.4, 2.4, 1); done('#f2b21a', OL, 0.8); rect('rgba(0,0,0,0.25)', lx - 3.8, -0.9, 10.4, 1.2); line('rgba(255,255,255,0.55)', 0.9, [[lx - 2.4, -8], [lx - 2.4, -4]]); return; }
      const h = st === 'tallBoots' ? 10 : st === 'leatherBoots' || st === 'armoredBoots' || st === 'spurBoots' ? 6.5 : 3.5;
      const c = st === 'armoredBoots' ? '#aab5ba' : st === 'spurBoots' ? '#7a4a26' : st === 'leatherBoots' && !isHex(av.shoes) ? '#6b4423' : shoes;
      P(); g.moveTo(lx - 3.6, -h); g.lineTo(lx + 3.4, -h); g.lineTo(lx + 3.4, -3); g.quadraticCurveTo(lx + 6.5, -3, lx + 6.5, -1); g.lineTo(lx + 6.5, 0.3); g.lineTo(lx - 3.8, 0.3); g.closePath();
      done(lin(c, -h, 0));
      if (st === 'tallBoots') line(sh(c, 0.25), 1.6, [[lx - 3, -h + 1.3], [lx + 3, -h + 1.3]]);
      if (st === 'armoredBoots') line('#e8eef0', 1, [[lx - 2.5, -5], [lx + 2.5, -5]]);
      if (st === 'nobleShoes') { rr(lx - 0.5, -3.2, 3, 2.2, 0.6); done('#ffd35c', OL, 0.6); }
      if (st === 'spurBoots') { line(OL, 1.8, [[lx - 3.6, -2.4], [lx - 6.2, -2.4]]); line('#c4ccd2', 0.9, [[lx - 3.6, -2.4], [lx - 6.2, -2.4]]); star(lx - 7, -2.4, 1.8, '#dfe6ee'); line('#c9a14a', 1, [[lx - 3.4, -6.5], [lx + 3.2, -6.5]]); }
    }
    function details(d, b) {
      const dark = sh(cloth, -0.3), light = sh(cloth, 0.25);
      const vee = (c) => { poly([[-4.5, -32], [4.5, -32], [0, -22]]); done(c, null); };
      const btns = (bx, c, n = 3, y0 = -27, dy = 4.5) => { for (let i = 0; i < n; i++) { circ(bx, y0 + i * dy, 0.9); done(c, null); } };
      const belt = (by, c = '#4c3529', buck = '#d6af53') => { rect(c, -20, by, 40, 3); rr(-2, by - 0.4, 4, 3.8, 0.8); done(buck, OL, 0.6); };
      const lapels = (c) => { poly([[-4.5, -32], [-1, -23], [-6, -26]]); done(c, OL, 0.8); poly([[4.5, -32], [1, -23], [6, -26]]); done(c, OL, 0.8); };
      switch (d) {
        case 'jacket': rect('#f3ead8', -3.5, -32, 7, 24); lapels(dark); btns(5.5, '#f3ead8'); break;
        case 'overalls': case 'worker': case 'farmer': {
          const oc = d === 'overalls' ? pants : d === 'farmer' ? '#3d5f8a' : '#455a61';
          if (d === 'farmer') for (let i = -12; i < 14; i += 4) { rect(sh(cloth, -0.18), i, -32, 1.2, 30); rect(sh(cloth, -0.18), -14, -30 + i + 12, 28, 1.2); }
          rr(-7.5, -24, 15, 16, 2); done(lin(oc, -24, -8)); line(oc, 2.8, [[-6, -32], [-6, -23]]); line(oc, 2.8, [[6, -32], [6, -23]]);
          circ(-6, -23, 1); done('#ffd35c', null); circ(6, -23, 1); done('#ffd35c', null); rr(-3, -20, 6, 4, 1); done(sh(oc, 0.15), OL, 0.6); break;
        }
        case 'dress': rect(light, -20, -21, 40, 2.4); for (let i = 0; i < 4; i++) { circ(-9 + i * 6, -10, 1.2); done(light, null); } break;
        case 'peasant': rect('#7a5a3a', -20, -15, 40, 2.6); line('#7a5a3a', 0.9, [[-1.5, -31], [1.5, -27], [-1.5, -24]]); break;
        case 'traveler': poly([[-12, -32], [12, -32], [9, -24], [-9, -24]]); done(lin('#6b4a33', -32, -24)); circ(0, -25, 1.6); done('#d6af53', OL, 0.6); belt(-13); break;
        case 'villager': poly([[-12, -32], [-4, -32], [-2, -6], [-12, -6]]); done(lin('#5c7a43', -32, -6)); poly([[12, -32], [4, -32], [2, -6], [12, -6]]); done(lin('#5c7a43', -32, -6)); break;
        case 'tunic': belt(-14); vee(dark); break;
        case 'merchant': vee('#f3ead8'); btns(0, '#d6af53', 3, -21, 3.5); belt(-12, '#5a3a20'); rr(5, -11, 5, 4, 1.4); done('#9a6a3a', OL, 0.6); break;
        case 'scholar': line(color, 3.4, [[-10, -32], [8, -5]]); vee('#f3ead8'); break;
        case 'knight': rr(-6, -32, 12, 30, 2); done(lin(color, -32, 0)); rect('#ffd35c', -1, -29, 2, 12); rect('#ffd35c', -4.5, -25, 9, 2); line('#e8eef0', 1, [[-11, -29], [-8, -29]]); break;
        case 'noble': rect('#d6af53', -1, -32, 2, 30); btns(-3, '#ffd35c', 4, -27, 4); btns(3, '#ffd35c', 4, -27, 4); P(); for (let i = 0; i < 6; i++) g.arc(-6.25 + i * 2.5, -31.5, 1.6, Math.PI, 0); done('#fffaf0', OL, 0.6); break;
        case 'assassin': line('#a3243a', 3, [[-12, -14], [12, -14]]); line('#1a171f', 2, [[-9, -32], [9, -18]]); poly([[-4, -32], [4, -32], [0, -27]]); done('#1a171f', null); break;
        case 'royalGuard': btns(-3, '#ffd35c', 4, -27, 4); btns(3, '#ffd35c', 4, -27, 4); belt(-13, '#f3ead8', '#ffd35c'); rr(-13, -32, 6, 3, 1.4); done('#ffd35c', OL, 0.6); rr(7, -32, 6, 3, 1.4); done('#ffd35c', OL, 0.6); break;
        case 'plague': btns(0, '#8a7a5a', 5, -28, 4.5); belt(-14, '#5a3a20', '#8a7a5a'); break;
        case 'wizard': rect(light, -20, b - 3, 40, 2.5); star(-5, -18, 2.4, '#ffd35c'); star(6, -9, 1.8, '#ffd35c'); star(4, -24, 1.4, '#ffd35c'); break;
        case 'executioner': rr(-7, -26, 14, 22, 2); done(lin('#5a1a22', -26, -4)); belt(-14, '#2a2026', '#8a8f99'); break;
        case 'sheriff': poly([[-12, -32], [-4, -32], [-3, -10], [-12, -10]]); done(lin('#7a4f2e', -32, -10)); poly([[12, -32], [4, -32], [3, -10], [12, -10]]); done(lin('#7a4f2e', -32, -10)); star(-7, -23, 3, '#ffd35c'); belt(-13, '#5a3a20'); break;
        case 'alchemist': rr(-7, -22, 14, 22, 2); done(lin('#c9b48a', -22, 0)); rr(-4, -15, 4, 4, 1); done('#7ad08a', OL, 0.6); break;
        case 'jester': rect('#e0b24a', 0, -32, 14, 32); for (let i = 0; i < 3; i++) { poly([[0, -27 + i * 7], [2.5, -24 + i * 7], [0, -21 + i * 7], [-2.5, -24 + i * 7]]); done(i % 2 ? '#83517f' : '#3ab0a0', OL, 0.6); } P(); for (let i = 0; i < 5; i++) { g.lineTo(-10 + i * 5, -31.5); g.lineTo(-7.5 + i * 5, -27); } g.lineTo(12, -31.5); done(null, OL, 0.9); break;
        case 'mafia': for (let i = -11; i < 12; i += 3) rect('rgba(255,255,255,0.09)', i, -32, 0.6, 30); vee('#f3ead8'); poly([[-1.3, -29], [1.3, -29], [2, -18], [0, -16], [-2, -18]]); done('#c0283c', OL, 0.6); lapels('#1a1920'); break;
        case 'trench': lapels(dark); btns(-4, dark, 3, -24, 4); btns(4, dark, 3, -24, 4); belt(-14, dark, '#c9a24a'); break;
        case 'hunter': line('#3a3a2a', 2.2, [[-10, -32], [9, -14]]); line('#3a3a2a', 2.2, [[10, -32], [-9, -14]]); rr(-9, -22, 5, 5, 1); done('#7a8a55', OL, 0.6); rr(4, -22, 5, 5, 1); done('#7a8a55', OL, 0.6); belt(-12, '#3a3a2a', '#c9a24a'); break;
        case 'storyteller': rect('#d6af53', -1.2, -32, 2.4, 32); rect('#d6af53', -20, b - 3, 40, 2.4); star(-6, -22, 2, '#ffd35c'); break;
        case 'pirate': vee('#f3ead8'); rect('#d6af53', -5.5, -32, 1.4, 30); rect('#d6af53', 4.1, -32, 1.4, 30); line('#b0283c', 3.6, [[-12, -14], [12, -14]]); btns(-7.5, '#ffd35c', 3, -27, 4); btns(7.5, '#ffd35c', 3, -27, 4); break;
        case 'samurai': for (let i = 0; i < 6; i++) rect('rgba(0,0,0,0.3)', -14, -27 + i * 4, 28, 1); rect('#d6af53', -14, -31, 28, 1.5); rect('#2a1a1a', -14, -14, 28, 3); break;
        case 'royal': rect('#d6af53', -1.2, -32, 2.4, 32); rr(-13, -33, 26, 6, 3); done('#fbf7ee', OL, 0.8); for (let i = 0; i < 5; i++) rect('#2b2018', -9 + i * 4.5, -31, 1.2, 1.8); break;
        case 'cyber': line('#3af0ff', 1, [[-12, -20], [-4, -20], [-1, -24], [12, -24]]); line('#3af0ff', 1, [[0, -32], [0, -2]]); circ(6, -28, 1.5); done('#ff3af0', null); circ(-6, -14, 1.2); done('#3af0ff', null); break;
        case 'vampire': poly([[-5, -32], [5, -32], [3, -6], [-3, -6]]); done(lin('#8f1a2a', -32, -6)); vee('#efe7da'); circ(0, -24, 1.4); done('#c0283c', OL, 0.5); break;
        case 'bloodKnight': rr(-8, -30, 16, 14, 3); done(lin('#8f1a2a', -30, -16)); for (let i = 0; i < 3; i++) rect('rgba(0,0,0,0.35)', -14, -14 + i * 4, 28, 1); circ(0, -24, 2); done('#ff3a4a', OL, 0.7); break;
        case 'space': rr(-6, -28, 12, 8, 2); done('#cdd5ea', OL, 0.7); circ(-3, -24, 1.3); done('#4fb3ff', null); circ(0.5, -24, 1.3); done('#ff5a5a', null); circ(3.6, -24, 1.3); done('#8f7bff', null); rect('#b9c1da', -20, -15, 40, 2.5); break;
        case 'dragon': for (let r = 0; r < 7; r++) for (let c = -3; c < 4; c++) { P(); g.arc(c * 4 + (r % 2) * 2, -30 + r * 4, 2.2, 0, Math.PI); done(r % 2 ? '#c2501f' : '#8e2a16', 'rgba(0,0,0,0.35)', 0.5); } rect('#e9c46a', -1, -32, 2, 30); break;
        case 'rogue': line('#2a1a10', 2.6, [[-10, -32], [10, -12]]); belt(-13, '#2a1a10', '#c9a24a'); rr(-10, -11, 4, 4, 1); done('#5a3e28', OL, 0.6); break;
        case 'tux': vee('#f8f8f8'); lapels('#0c0c10'); poly([[-3.5, -30], [0, -28.5], [3.5, -30], [3.5, -27], [0, -28.5], [-3.5, -27]]); done('#c0283c', OL, 0.6); btns(0, '#16161c', 2, -24, 3.5); break;
        case 'fed': rect('#ffd21f', -14, -24, 28, 5); for (let i = 0; i < 3; i++) rect('#1d3557', -5 + i * 4, -23, 2, 3); vee('#e4dfcf'); break;
        case 'parka': rect(sh(cloth, -0.25), -0.8, -32, 1.6, 30); rect('#f2ead6', -20, b - 3, 40, 3); P(); for (let i = 0; i < 7; i++) g.arc(-9 + i * 3, -31, 2.4, 0, TAU); done('#f2ead6', null); break;
        case 'block': for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2) rect('#5ab0d0', -12 + c * 6, -32 + r * 6, 6, 6); rect('#d6f2ff', -8, -30, 4, 4); break;
        case 'denim': vee('#f2ede4'); rect(sh(cloth, -0.25), -0.7, -24, 1.4, 22); rr(-9, -24, 6, 5, 1); done(sh(cloth, -0.12), OL, 0.6); rr(3, -24, 6, 5, 1); done(sh(cloth, -0.12), OL, 0.6); circ(-6, -23, 0.8); done('#c9a24a', null); circ(6, -23, 0.8); done('#c9a24a', null); break;
        // ---- shop seasons & theme sets ----
        case 'cosy': { for (const cx of [-8, 8]) for (let i = 0; i < 6; i++) { ell(cx, -29 + i * 3.6, 1.7, 2.2, (i % 2 ? 0.5 : -0.5)); done(null, light, 0.9); }
          poly([[0, -26.5], [1.2, -24], [3.8, -25], [2.9, -22.3], [4.8, -21.2], [2.2, -20.3], [2.5, -18.3], [0, -19.3], [-2.5, -18.3], [-2.2, -20.3], [-4.8, -21.2], [-2.9, -22.3], [-3.8, -25], [-1.2, -24]]); done('#ffb02e', OL, 0.6); line(OL, 0.7, [[0, -19.3], [0, -16.5]]);
          rr(-6.5, -33, 13, 3.4, 1.6); done(light, OL, 0.6); rect(dark, -20, b - 3, 40, 3); for (let i = -20; i < 20; i += 2) rect('rgba(0,0,0,0.16)', i, b - 3, 0.7, 3); break; }
        case 'flannel': for (let i = -20; i < 20; i += 6) { rect('rgba(40,8,8,0.3)', i, -32, 2.6, 34); rect('rgba(40,8,8,0.22)', -20, -32 + (i + 20), 40, 2.6); rect('rgba(255,230,200,0.22)', i + 3.8, -32, 0.6, 34); }
          vee('#f3ead8'); btns(0, '#f3ead8', 3, -20, 4); rr(-10, -27, 5, 5, 1); done(null, 'rgba(0,0,0,0.4)', 0.7); rr(5, -27, 5, 5, 1); done(null, 'rgba(0,0,0,0.4)', 0.7); break;
        case 'ugly': { rect('#f3ead8', -20, -28, 40, 4.4); line('#c0283c', 1.2, [[-20, -26], [-17, -27.6], [-14, -26], [-11, -27.6], [-8, -26], [-5, -27.6], [-2, -26], [1, -27.6], [4, -26], [7, -27.6], [10, -26], [13, -27.6], [16, -26], [19, -27.6]]);
          rect('#c0283c', -20, b - 4, 40, 4); for (let i = -18; i < 20; i += 4) { circ(i, b - 2, 0.7); done('#fff', null); }
          for (const [fx, fy] of [[-9, -18], [9, -18], [-6, -13], [7, -12.5]]) for (let k = 0; k < 3; k++) line('#ffffff', 0.7, [[fx - Math.cos(k * 1.05) * 1.8, fy - Math.sin(k * 1.05) * 1.8], [fx + Math.cos(k * 1.05) * 1.8, fy + Math.sin(k * 1.05) * 1.8]]);
          for (const sx of [-1, 1]) { line('#6a4424', 1, [[sx * 2, -21], [sx * 4.2, -24.5]]); line('#6a4424', 1, [[sx * 3.4, -23.2], [sx * 5.4, -22.8]]); }
          ell(0, -18.4, 2.9, 3.2); done('#9a6a3a', OL, 0.7); circ(0, -16.2, 1.2); done('#ff3a3a', OL, 0.5); circ(-1, -19.2, 0.45); done(OL, null); circ(1, -19.2, 0.45); done(OL, null); break; }
        case 'cupid': { rect('#fff4f8', -3.2, -32, 6.4, 34); line(sh(cloth, -0.25), 0.8, [[-3.2, -32], [-3.2, 2]]); line(sh(cloth, -0.25), 0.8, [[3.2, -32], [3.2, 2]]);
          for (let i = 0; i < 4; i++) heart(-4.6, -27 + i * 5, 0.9, '#e8326a', 0.4); rr(5, -19, 6, 5.5, 1.2); done(sh(cloth, -0.08), OL, 0.6); heart(8, -16.6, 1.3, '#e8326a', 0.5);
          for (let i = -20; i < 20; i += 2) rect('rgba(0,0,0,0.1)', i, b - 3, 0.7, 3); heart(-1, -28.5, 1.2, '#ff5c8a', 0.4); break; }
        case 'gardener': { const oc = '#b9a3e3'; rect(oc, -20, -17, 40, 22); rr(-7, -27, 14, 11, 2); done(lin(oc, -27, -16)); line(oc, 2.8, [[-6, -32], [-6, -26]]); line(oc, 2.8, [[6, -32], [6, -26]]);
          circ(-6, -26, 1); done('#ffd35c', null); circ(6, -26, 1); done('#ffd35c', null); for (let k = 0; k < 5; k++) { circ(Math.cos(k * 1.26) * 2, -22 + Math.sin(k * 1.26) * 2, 1.4); done('#ff8fc6', OL, 0.4); } circ(0, -22, 1); done('#ffd23f', null);
          line('#8a8f99', 1.4, [[8, -18], [8, -12]]); poly([[6.4, -18], [9.6, -18], [8, -21.5]]); done('#c4ccd2', OL, 0.6); rr(5, -14, 6, 5, 1); done(sh(oc, -0.12), OL, 0.6); break; }
        case 'hawaii': { vee('#f3ead8'); lapels(sh(cloth, 0.2)); const fl = (x, y, c) => { ell(x + 2.4, y + 1.8, 2.6, 1.2, 0.6); done('#2f8a3a', null); for (let k = 0; k < 5; k++) { circ(x + Math.cos(k * 1.26) * 1.7, y + Math.sin(k * 1.26) * 1.7, 1.5); done(c, null); } circ(x, y, 0.8); done('#ffd23f', null); };
          fl(-8, -25, '#ff5a7a'); fl(8, -19, '#ffd23f'); fl(-6, -14, '#ff8a3a'); fl(9, -28.5, '#ff5a7a'); fl(2, -11, '#ff5a7a'); btns(0, '#f3ead8', 3, -20, 4); break; }
        case 'lifeguard': rect('#ffffff', -1.7, -23, 3.4, 9); rect('#ffffff', -4.5, -20.2, 9, 3.4); line('#ffd23f', 0.8, [[-4, -32], [-1.2, -26], [4, -32]]); rr(-2.8, -27, 3.4, 2.2, 0.8); done('#ffd23f', OL, 0.5); rect('rgba(255,255,255,0.85)', -20, b - 2.6, 40, 1.2); break;
        case 'skeleton': { const bone = '#f2efe2'; for (let i = 0; i < 6; i++) { rr(-1.3, -30 + i * 3.6, 2.6, 2.6, 0.9); done(bone, null); }
          for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) { P(); g.moveTo(sx * 1.6, -28.5 + i * 3.4); g.quadraticCurveTo(sx * 8, -30 + i * 3.4, sx * 9.5, -25.6 + i * 3.4); g.strokeStyle = bone; g.lineWidth = 1.5; g.lineCap = 'round'; g.stroke(); }
          P(); g.ellipse(0, b - 3.5, 6, 3, 0, 0, TAU); g.fillStyle = bone; g.fill(); circ(-2.4, b - 3.5, 1); done(cloth, null); circ(2.4, b - 3.5, 1); done(cloth, null); break; }
        case 'mummy': for (let i = 0; i < 12; i++) line('rgba(110,90,60,0.45)', 0.8, [[-20, -33 + i * 3.4 + (i % 2) * 2], [20, -30 + i * 3.4 - (i % 2) * 2]]); for (const [x, y] of [[-6, -26], [5, -18], [-3, -12]]) { rr(x, y, 4, 2.2, 0.6); done('rgba(150,120,80,0.3)', null); } line('#d8ceb0', 2.2, [[6, -23], [11, -20], [10, -16]]); break;
        case 'agent': vee('#f4f4f4'); poly([[-0.9, -30.5], [0.9, -30.5], [1.25, -17.5], [0, -16], [-1.25, -17.5]]); done('#0c0c10', OL, 0.5); lapels('#0c0c10'); rect('#e8e8ee', 6.5, -26, 3.2, 1.3); break;
        case 'chef': btns(-4.2, '#c9c3b5', 4, -27, 4.6); btns(4.2, '#c9c3b5', 4, -27, 4.6); line('rgba(0,0,0,0.12)', 0.8, [[-1.5, -31], [-1.5, b]]); poly([[-5.5, -32.5], [5.5, -32.5], [0, -26.5]]); done('#e8323c', OL, 0.7); circ(0, -27.4, 1.1); done('#b82a2a', null); break;
        case 'inverness': { g.globalAlpha *= 0.55; for (let i = -20; i < 20; i += 4) { rect('#5a4428', i, -32, 1.1, 36); rect('#5a4428', -20, -32 + (i + 20), 40, 1); } g.globalAlpha /= 0.55; btns(-3.5, '#3a2a18', 3, -14, 4); btns(3.5, '#3a2a18', 3, -14, 4); break; }
        case 'dealer': { for (const sx of [-1, 1]) { poly([[sx * 3.2, -31], [sx * 16, -31], [sx * 16, b + 1], [sx * 1.4, b + 1], [sx * 1.4, -22]]); done(lin('#a3243a', -31, b), OL, 0.8); }
          btns(-2.4, '#ffd35c', 3, -19, 4); line(sh('#a3243a', -0.35), 0.8, [[-9, -15], [-5, -15]]); line(sh('#a3243a', -0.35), 0.8, [[5, -15], [9, -15]]);
          poly([[0, -30], [-4.6, -32.4], [-4.6, -27.6]]); done('#101014', OL, 0.6); poly([[0, -30], [4.6, -32.4], [4.6, -27.6]]); done('#101014', OL, 0.6); circ(0, -30, 1.1); done('#101014', null); break; }
        case 'survivor': { rect('#55603a', -3.2, -32, 6.4, 34); line('rgba(0,0,0,0.35)', 0.8, [[-3.2, -32], [-3.2, 2]]); line('rgba(0,0,0,0.35)', 0.8, [[3.2, -32], [3.2, 2]]);
          for (const sx of [-1, 1]) { rr(sx > 0 ? 4 : -9.5, -24, 5.5, 5, 1); done(sh(cloth, -0.15), OL, 0.6); rr(sx > 0 ? 4 : -9.5, -16.5, 5.5, 5, 1); done(sh(cloth, -0.15), OL, 0.6); line(OL, 0.6, [[sx > 0 ? 4.4 : -9.1, -22.6], [sx > 0 ? 9.1 : -4.4, -22.6]]); }
          line(OL, 3, [[-10, -32], [9, -12]]); line('#4a3424', 1.8, [[-10, -32], [9, -12]]); rr(-7, -30.5, 3, 6, 1); done('#3a3a44', OL, 0.6); rect('#fff6a8', -6.6, -31.1, 2.2, 1.2); break; }
        case 'photo': { rect('#46627e', -3.2, -32, 6.4, 34); vee('#46627e'); line('rgba(0,0,0,0.35)', 0.8, [[-3.2, -27], [-3.2, 2]]); line('rgba(0,0,0,0.35)', 0.8, [[3.2, -27], [3.2, 2]]);
          for (const sx of [-1, 1]) for (const [py, ph] of [[-25, 4.6], [-18, 5], [-11.5, 4.4]]) { const px = sx > 0 ? 3.8 : -9.8; rr(px, py, 6, ph, 0.8); done(sh(cloth, -0.12), OL, 0.6); line(OL, 0.6, [[px + 0.5, py + 1.4], [px + 5.5, py + 1.4]]); }
          rr(-9.6, -30.5, 5, 3, 0.8); done('#ffffff', OL, 0.5); rect('#ff4f6d', -9.1, -29.8, 4, 1); break; }
        default: rect('rgba(255,255,255,0.12)', -11, -31, 4, 20); break;
      }
    }
    function torch() {
      line(OL, 3.6, [[1, 15], [3, 2]]); line('#7a4a22', 2, [[1, 15], [3, 2]]);
      const fl = Math.sin(t * 12) * 1;
      P(); g.moveTo(3, 3); g.quadraticCurveTo(-2, -2, 3.5, -8 - fl); g.quadraticCurveTo(8, -2, 3, 3); done('#ff9a2a', '#c4561a', 0.8);
      P(); g.moveTo(3, 2); g.quadraticCurveTo(1, -1, 3.5, -4 - fl); g.quadraticCurveTo(5.5, -1, 3, 2); done('#ffe08a', null);
    }
    // Shop-season and theme-set props held in the right hand (origin = the hand; up is -y).
    function handProp() {
      g.save();
      switch (acc) {
        case 'lasso': for (let i = 0; i < 3; i++) { ell(2, -4, 6 - i * 0.6, 7 - i * 0.6, 0.3); done(null, OL, 2.6); ell(2, -4, 6 - i * 0.6, 7 - i * 0.6, 0.3); done(null, '#c9a36a', 1.3); } P(); g.moveTo(6, 0); g.quadraticCurveTo(14, 3 + Math.sin(t * 3) * 2, 16, -6); done(null, '#c9a36a', 1.4); break;
        case 'woodenSpoon': g.rotate(0.35); line(OL, 3.4, [[0, 4], [0, -11]]); line('#d9a866', 2, [[0, 4], [0, -11]]); ell(0, -15, 3.2, 4.6); done(lin('#d9a866', -20, -10)); ell(0, -15.4, 1.8, 3); done('rgba(120,70,20,0.25)', null); break;
        case 'magnifier': g.rotate(0.35); line(OL, 3.6, [[0, 3], [0, -8]]); line('#5a3a20', 2.2, [[0, 3], [0, -8]]); circ(0, -14, 6); done('rgba(200,235,255,0.35)', OL, 3.8); circ(0, -14, 6); done(null, '#d6af53', 2.2); line('rgba(255,255,255,0.8)', 1, [[-3, -16], [-1.5, -17.8]]); break;
        case 'cardFan': for (let i = -1.5; i <= 1.5; i++) { g.save(); g.translate(1, -1); g.rotate(i * 0.3); rr(-3.6, -15, 7.2, 10, 1.2); done('#ffffff', OL, 0.9); P(); g.moveTo(0, -12.6); g.lineTo(1.6, -10); g.lineTo(0, -7.4); g.lineTo(-1.6, -10); g.closePath(); done(i > 0 ? '#c0283c' : '#1d1d24', null); g.restore(); } break;
        case 'rayGun': rr(-1.8, -4, 3.6, 7, 1.2); done('#c4ccd2'); rr(-3, -10, 14, 6.4, 3); done(lin('#ff5a1f', -10, -3.6)); for (let i = 0; i < 3; i++) { rr(1.5 + i * 2.6, -11, 1.2, 8.4, 0.5); done('#c4ccd2', null); } poly([[-3, -9], [-6.5, -12], [-5, -6]]); done('#c4ccd2', OL, 0.8); circ(12, -6.8, 1.8 + 0.4 * Math.sin(t * 8)); done('#7aff3a', OL, 0.7); break;
        case 'camera': g.rotate(-0.14); rr(-8, -15, 16, 10.5, 2); done(lin('#2b2b33', -15, -4.5)); rr(-3.6, -18, 7.2, 3.6, 1); done('#2b2b33'); circ(0, -9.6, 4.4); done('#8a8f99'); circ(0, -9.6, 2.9); done('#1d2230'); circ(-1, -10.6, 0.9); done('rgba(255,255,255,0.8)', null); rr(-7, -14, 3, 1.6, 0.5); done('#ff4f6d', null); if (Math.sin(t * 1.7) > 0.93) star(4.8, -17, 4.2, '#fffbe0'); break;
        case 'ciderMug': { rr(-4, -11, 8.4, 10, 1.8); done(lin('#c0392b', -11, -1)); P(); g.arc(4.6, -6, 2.6, -Math.PI / 2, Math.PI / 2); g.strokeStyle = OL; g.lineWidth = 2.6; g.stroke(); g.strokeStyle = '#c0392b'; g.lineWidth = 1.2; g.stroke(); rect('#f3ead8', -4, -8, 8.4, 1.6); ell(0.2, -11, 4, 1.2); done('#c9802a', OL, 0.6);
          for (let k = 0; k < 2; k++) { const p = (t * 0.6 + k / 2) % 1; g.save(); g.globalAlpha *= 1 - p; line('#ffffff', 1, [[-1 + k * 2.4, -12.5 - p * 6], [Math.sin(t * 3 + k) * 1.4 + k * 2.4, -15 - p * 8]]); g.restore(); } break; }
        case 'candyCane': { g.rotate(0.25); P(); g.moveTo(0, 4); g.lineTo(0, -14); g.arc(-3.5, -14, 3.5, 0, Math.PI, true); g.strokeStyle = OL; g.lineWidth = 4.4; g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = 2.8; g.stroke(); g.setLineDash && g.setLineDash([1.6, 1.8]); g.strokeStyle = '#e8323c'; g.stroke(); g.setLineDash && g.setLineDash([]); break; }
        case 'loveLetter': g.rotate(-0.2); rr(-6, -12, 12, 8.4, 1); done('#ffd0de'); line(OL, 0.8, [[-6, -12], [0, -7], [6, -12]]); heart(0, -7.4, 1.6, '#e8326a', 0.5); break;
        case 'bouquet': { g.rotate(0.15); for (const sx of [-2, 0, 2]) line('#3f8f3a', 1.2, [[0, 3], [sx * 1.4, -10]]); poly([[-4, -5], [4, -5], [1.4, 3], [-1.4, 3]]); done('#ffffff', OL, 0.8); for (const [fx, fy, fc] of [[-3, -12, '#ff8fc6'], [3, -12, '#ffd23f'], [0, -15, '#ff5a7a'], [-4.5, -9, '#b9a3e3'], [4.5, -9, '#ff8fc6']]) { for (let k = 0; k < 5; k++) { circ(fx + Math.cos(k * 1.26) * 1.5, fy + Math.sin(k * 1.26) * 1.5, 1.3); done(fc, OL, 0.4); } circ(fx, fy, 0.7); done('#fff6d6', null); } break; }
        case 'icePop': { g.rotate(0.2); rr(-0.8, -4, 1.6, 7, 0.6); done('#e9cf9a', OL, 0.6); rr(-3.4, -16, 6.8, 12.5, 3); done(lin('#ff5a7a', -16, -4)); g.save(); rr(-3.4, -16, 6.8, 12.5, 3); g.clip(); rect('#ffd23f', -4, -12, 8, 3); rect('#3aa0ff', -4, -8, 8, 4); g.restore(); rr(-3.4, -16, 6.8, 12.5, 3); done(null);
          const p = (t * 0.7) % 1; circ(-2.6, -4 + p * 6, 0.8); done('#3aa0ff', null); break; }
        case 'treatBucket': { line(OL, 2, [[-5, -10], [0, -16], [5, -10]]); line('#3a3a44', 1, [[-5, -10], [0, -16], [5, -10]]); P(); g.ellipse(0, -5, 6.4, 5.6, 0, 0, TAU); done(lin('#f28c2c', -11, 1)); for (const sx of [-1, 1]) { poly([[sx * 2.6 - 1.3, -6.4], [sx * 2.6 + 1.3, -6.4], [sx * 2.6, -8.4]]); done('#3a1a04', null); }
          P(); g.moveTo(-3, -3.2); for (let i = 0; i < 5; i++) g.lineTo(-3 + i * 1.5, -3.2 + (i % 2 ? 1.3 : 0)); g.lineTo(3, -3.2); g.quadraticCurveTo(0, 0, -3, -3.2); done('#3a1a04', null); for (const [cx, cc] of [[-2.5, '#ff5a7a'], [0.5, '#7aff3a'], [3, '#3aa0ff']]) { circ(cx, -10.4, 1.4); done(cc, OL, 0.5); } break; }
        default: break;
      }
      g.restore();
    }
    function backHair() {
      const c = lin(hairC, HY - 16, HY + 24, 0.12, -0.2);
      switch (hair) {
        case 'long': P(); g.moveTo(-R - 1, HY - 2); g.quadraticCurveTo(-R - 3, HY + 16, -R + 1, HY + 21); g.lineTo(R - 1, HY + 21); g.quadraticCurveTo(R + 3, HY + 16, R + 1, HY - 2); g.arc(0, HY - 2, R + 1, 0, Math.PI, true); done(c); break;
        case 'wavy': P(); g.moveTo(-R - 1, HY - 2); for (let i = 0; i < 4; i++) g.quadraticCurveTo(-R - 4 + (i % 2) * 3, HY + 3 + i * 4.5, -R - 1 + (i % 2 ? 0 : 1), HY + 5 + i * 4.5); g.lineTo(R + 1, HY + 20); for (let i = 3; i >= 0; i--) g.quadraticCurveTo(R + 4 - (i % 2) * 3, HY + 3 + i * 4.5, R + 1, HY + 1 + i * 4.5); g.arc(0, HY - 2, R + 1, 0, Math.PI, true); done(c); break;
        case 'bob': case 'medium': { const d = hair === 'bob' ? 10 : 14; P(); g.moveTo(-R - 1.5, HY - 2); g.lineTo(-R - 1.5, HY + d - 2); g.quadraticCurveTo(-R - 1.5, HY + d, -R + 2, HY + d); g.lineTo(R - 2, HY + d); g.quadraticCurveTo(R + 1.5, HY + d, R + 1.5, HY + d - 2); g.lineTo(R + 1.5, HY - 2); g.arc(0, HY - 2, R + 1.5, 0, Math.PI, true); done(c); break; }
        case 'braids': case 'royalBraids': for (const s of [-1, 1]) { for (let i = 0; i < 5; i++) { ell(s * (R - 0.5), HY + 2 + i * 4, 3, 2.6); done(c); } if (hair === 'royalBraids') { rr(s * (R - 0.5) - 2.5, HY + 20, 5, 2.4, 1); done('#d5b66f', OL, 0.6); } } circ(0, HY - 2, R + 1); done(c); break;
        case 'ponytail': { const sw2 = Math.sin(t * 3) * 1.5; P(); g.moveTo(R - 2, HY - 8); g.quadraticCurveTo(R + 9 + sw2, HY - 4, R + 5 + sw2, HY + 14); g.quadraticCurveTo(R + 1, HY + 6, R - 1, HY - 2); g.closePath(); done(c); circ(R - 1, HY - 6, 2); done('#e05a8a', OL, 0.7); break; }
        case 'afro': circ(0, HY - 3, R + 7); done(c); break;
        case 'curly': for (let i = 0; i < 9; i++) { const a = Math.PI * (0.9 + i * 0.15); circ(Math.cos(a) * (R + 1.5), HY - 2 + Math.sin(a) * (R + 1.5), 4.6); done(c); } break;
        case 'bun': circ(0, HY - R - 4, 6); done(c); break;
        default: break;
      }
    }
    function frontHair(e) {
      if (hat === 'hood' || hat === 'spaceHelmet' && false) return;
      const c = lin(hairC, HY - R - 4, HY, 0.2, -0.08), hl = sh(hairC, 0.3);
      const top = (hairline, lean = 0) => { // a cap of hair over the top of the head with a fringe edge
        P(); g.moveTo(-R - 0.8, HY + 2); g.arc(0, HY - 1, R + 1, Math.PI * 0.98, Math.PI * 2.02); g.lineTo(R + 0.8, HY + 2); hairline(); g.closePath(); done(c);
      };
      switch (hair) {
        case 'bald': ell(-4, HY - 8, 3, 1.5, -0.4); done('rgba(255,255,255,0.35)', null); return;
        case 'buzzCut': P(); g.arc(0, HY - 1, R + 0.6, Math.PI * 1.04, Math.PI * 1.96); g.quadraticCurveTo(0, HY - 9, -R * 0.98, HY - 4); g.closePath(); done(sh(hairC, 0.05), OL, 1); return;
        case 'mohawk': case 'silverCrest': { const mc = hair === 'silverCrest' ? '#ddd8ca' : hairC; P(); g.moveTo(-3.5, HY - R + 2); for (let i = 0; i < 4; i++) { g.lineTo(-3 + i * 2.2, HY - R - 9 + (i % 2) * 3); g.lineTo(-2 + i * 2.2, HY - R + 1); } g.lineTo(4, HY - R + 3); g.closePath(); done(lin(mc, HY - R - 10, HY - R + 3)); ell(0, HY - R + 2.5, 5, 1.8); done(sh(hairC, 0.2), null); return; }
        case 'slickedBack': top(() => { g.quadraticCurveTo(R * 0.5, HY - 10, 0, HY - 10.5); g.quadraticCurveTo(-R * 0.5, HY - 10, -R - 0.8, HY + 2); }); line(hl, 1.2, [[-6, HY - 12], [2, HY - 13]]); return;
        case 'sidePart': top(() => { g.quadraticCurveTo(R - 2, HY - 4, 4, HY - 8); g.quadraticCurveTo(-4, HY - 4, -R + 1, HY - 2); g.lineTo(-R - 0.8, HY + 3); }); line(hl, 1.1, [[-5, HY - 9], [3, HY - 11]]); return;
        case 'messy': case 'windswept': top(() => { for (let i = 0; i < 6; i++) { const px = R - i * (2 * R / 5.5); g.lineTo(px, HY - 4 + (i % 2 ? -4 : 1)); } g.lineTo(-R - 0.8, HY + 2); });
          P(); for (let i = 0; i < 5; i++) { const a = Math.PI * (1.1 + i * 0.2); g.moveTo(Math.cos(a) * R, HY - 1 + Math.sin(a) * R); g.lineTo(Math.cos(a) * (R + 5) + (hair === 'windswept' ? 4 : 0), HY - 1 + Math.sin(a) * (R + 4)); g.lineTo(Math.cos(a + 0.18) * R, HY - 1 + Math.sin(a + 0.18) * R); } done(c, OL, 1); return;
        case 'undercut': rect(sh(hairC, 0.35), -R + 0.5, HY - 6, 3, 6); P(); g.moveTo(-R + 3, HY - 5); g.quadraticCurveTo(-R, HY - R - 6, 4, HY - R - 4); g.quadraticCurveTo(R + 4, HY - R - 2, R + 1, HY - 3); g.quadraticCurveTo(3, HY - 9, -R + 3, HY - 5); done(c); return;
        case 'afro': P(); for (let i = 0; i < 7; i++) { const a = Math.PI * (1.05 + i * 0.15); g.arc(Math.cos(a) * (R + 1), HY - 3 + Math.sin(a) * (R + 1), 5, 0, TAU); } done(c, null); return;
        case 'curly': top(() => { for (let i = 0; i < 6; i++) g.arc(R - 2.5 - i * 4.4, HY - 5, 2.4, 0, Math.PI); g.lineTo(-R - 0.8, HY + 2); }); return;
        case 'long': case 'wavy': case 'medium': case 'bob': top(() => { g.quadraticCurveTo(R - 3, HY - 6, 0, HY - 8); g.quadraticCurveTo(-R + 3, HY - 6, -R - 0.8, HY + 6); }); return;
        case 'braids': case 'royalBraids': case 'ponytail': case 'bun': top(() => { g.quadraticCurveTo(0, HY - 11, -R - 0.8, HY + 2); }); return;
        default: // short
          top(() => { g.lineTo(R - 2, HY - 4); g.lineTo(R - 5, HY - 7); g.lineTo(R - 8, HY - 5); g.lineTo(-1, HY - 8); g.lineTo(-5, HY - 5); g.lineTo(-8, HY - 8); g.lineTo(-R + 1, HY - 4); });
          line(hl, 1.1, [[-6, HY - 11], [0, HY - 12.5]]);
      }
    }
    function face(e) {
      const ey = HY + 1, mood = o.dead ? 'dead' : o.scared ? 'scared' : (typeof o.expression === 'string' && o.expression) || av.expression || (av.features === 'serious' ? 'serious' : 'smile');
      const iris = isHex(av.eyes) ? av.eyes : '#342b25';
      const blink = !o.dead && Math.sin(t * 1.3 + (o.seed || 0) * 7) > 0.985;
      const lashes = (cx, dy = 0) => { if (!fem) return; const s = cx < e ? -1 : 1; line(OL, 1.1, [[cx + s * 0.4, ey - 2.6 + dy], [cx + s * 1.4, ey - 4.3 + dy]]); line(OL, 1.1, [[cx + s * 1.5, ey - 2.2 + dy], [cx + s * 3.3, ey - 3.8 + dy]]); line(OL, 1.1, [[cx + s * 2.2, ey - 1.2 + dy], [cx + s * 4.2, ey - 2.2 + dy]]); };
      const eye = (cx, big = 1) => { if (blink) { line(OL, 1.2, [[cx - 2, ey], [cx + 2, ey]]); lashes(cx, 2); return; } const bw = fem ? 2.15 : 1.9, bh = fem ? 2.8 : 2.5; ell(cx, ey, bw * big, bh * big); done(iris, OL, 0.8); circ(cx + 0.7, ey - 0.9, 0.8 * big); done('#fff', null); lashes(cx); };
      const shut = (cx, up = true) => { P(); if (up) g.arc(cx, ey + 1, 2.2, Math.PI * 1.15, Math.PI * 1.85); else g.arc(cx, ey - 1.2, 2.2, Math.PI * 0.15, Math.PI * 0.85); g.strokeStyle = OL; g.lineWidth = 1.2; g.stroke(); if (up) lashes(cx, 1.4); };
      let browed = false;
      // Brows: thick and straight (male) or thin and arched (female).
      const brow = (cx, a, dy = 0) => { browed = true; g.save(); g.translate(cx, ey - (fem ? 5 : 4.6) + dy); g.rotate(a); if (fem) { P(); g.moveTo(-2.3, 0.5); g.quadraticCurveTo(0, -1.1, 2.3, 0.4); g.strokeStyle = sh(hairC, -0.25); g.lineWidth = 0.95; g.lineCap = 'round'; g.stroke(); } else line(sh(hairC, -0.25), 2.2, [[-2.5, 0], [2.5, 0]]); g.restore(); };
      const L = -4.6 + e, Rt = 4.6 + e, my = HY + 7, mx = e;
      g.fillStyle = 'rgba(255,120,130,' + (av.features === 'rosyCheeks' ? 0.55 : 0.25) + ')'; ell(L - 2.8, HY + 4.5, 2.4, 1.5); g.fill(); ell(Rt + 2.8, HY + 4.5, 2.4, 1.5); g.fill();
      if (av.features === 'freckles') for (const [dx, dy] of [[-7, 3], [-5, 4.3], [-8.5, 4.6], [7, 3], [5, 4.3], [8.5, 4.6]]) { circ(dx + e, HY + dy, 0.45); done('#a76c50', null); }
      const LIP = '#d8576f';
      let said = 'smile';
      const mouth = (kind) => {
        said = kind;
        if (kind === 'tremble') { const j = Math.sin(t * 40) * 0.35; P(); g.moveTo(mx - 3, my + 0.6 + j); g.lineTo(mx - 1.5, my - 0.4 - j); g.lineTo(mx, my + 0.6 + j); g.lineTo(mx + 1.5, my - 0.4 - j); g.lineTo(mx + 3, my + 0.6 + j); g.strokeStyle = OL; g.lineWidth = 1.2; g.stroke(); return; }
        if (fem) switch (kind) {
          case 'smile': P(); g.moveTo(mx - 3.4, my - 1.5); g.quadraticCurveTo(mx, my - 0.6, mx + 3.4, my - 1.5); g.quadraticCurveTo(mx + 1.5, my + 2.6, mx, my + 2.5); g.quadraticCurveTo(mx - 1.5, my + 2.6, mx - 3.4, my - 1.5); done(LIP, OL, 0.8); line(sh(LIP, -0.35), 0.8, [[mx - 2.6, my - 0.9], [mx + 2.6, my - 0.9]]); circ(mx - 0.8, my + 1, 0.5); done('rgba(255,255,255,0.6)', null); return;
          case 'flat': case 'smirk': { const d = kind === 'smirk' ? 0.8 : 0; P(); g.moveTo(mx - 2.8, my); g.quadraticCurveTo(mx - 1, my - 1.6, mx, my - 0.9); g.quadraticCurveTo(mx + 1, my - 1.6, mx + 2.8, my - d); g.quadraticCurveTo(mx, my + 2, mx - 2.8, my); done(LIP, OL, 0.8); line(sh(LIP, -0.35), 0.7, [[mx - 2.2, my - 0.2], [mx + 2.2, my - 0.2 - d]]); return; }
          case 'frown': P(); g.moveTo(mx - 3, my + 1.2); g.quadraticCurveTo(mx, my - 2, mx + 3, my + 1.2); g.quadraticCurveTo(mx, my + 1.6, mx - 3, my + 1.2); done(LIP, OL, 0.8); return;
          case 'o': ell(mx, my + 0.5, 1.9, 2.3); done('#7a2a3a', LIP, 1.3); return;
          default: break;
        }
        switch (kind) {
          case 'smile': P(); g.arc(mx, my - 2, 3, Math.PI * 0.2, Math.PI * 0.8); g.strokeStyle = OL; g.lineWidth = 1.2; g.stroke(); break;
          case 'grin': P(); g.moveTo(mx - 3.6, my - 1.2); g.quadraticCurveTo(mx, my - 0.6, mx + 3.6, my - 1.2); g.quadraticCurveTo(mx + 3, my + 3.4, mx, my + 3.4); g.quadraticCurveTo(mx - 3, my + 3.4, mx - 3.6, my - 1.2); done('#7a2a3a', OL, 1); rect('#fff', mx - 2.6, my - 0.9, 5.2, 1.2); break;
          case 'flat': line(OL, 1.2, [[mx - 2, my], [mx + 2, my]]); break;
          case 'o': ell(mx, my + 0.5, 1.6, 2); done('#7a2a3a', OL, 1); break;
          case 'frown': P(); g.arc(mx, my + 2.2, 2.6, Math.PI * 1.2, Math.PI * 1.8); g.strokeStyle = OL; g.lineWidth = 1.2; g.stroke(); break;
          case 'grit': rr(mx - 3, my - 1, 6, 2.6, 1); done('#fff', OL, 1); line(OL, 0.6, [[mx, my - 1], [mx, my + 1.6]]); break;
          case 'smirk': P(); g.moveTo(mx - 2.4, my); g.quadraticCurveTo(mx + 1, my + 0.6, mx + 3, my - 1.6); g.strokeStyle = OL; g.lineWidth = 1.2; g.stroke(); break;
        }
      };
      switch (mood) {
        case 'dead': for (const cx of [L, Rt]) { line(OL, 1.2, [[cx - 1.8, ey - 1.8], [cx + 1.8, ey + 1.8]]); line(OL, 1.2, [[cx + 1.8, ey - 1.8], [cx - 1.8, ey + 1.8]]); } mouth('flat'); break;
        case 'surprised': eye(L, 1.2); eye(Rt, 1.2); brow(L, -0.15, -1.6); brow(Rt, 0.15, -1.6); mouth('o'); break;
        case 'scared': { // wide eyes, worried brows, a trembling mouth and a bead of sweat
          eye(L, 1.25); eye(Rt, 1.25); brow(L, -0.4, -1.4); brow(Rt, 0.4, -1.4);
          mouth('tremble');
          P(); g.moveTo(R - 3.5, HY - 6); g.quadraticCurveTo(R - 1.5, HY - 2.5, R - 3.5, HY - 1.5); g.quadraticCurveTo(R - 5.5, HY - 2.5, R - 3.5, HY - 6); done('#a8e0ff', OL, 0.7); break; }
        case 'grin': shut(L); shut(Rt); mouth('grin'); break;
        case 'neutral': eye(L); eye(Rt); mouth('flat'); break;
        case 'serious': eye(L); eye(Rt); brow(L, 0.15, 0.6); brow(Rt, -0.15, 0.6); mouth('flat'); break;
        case 'sad': eye(L); eye(Rt); brow(L, -0.35); brow(Rt, 0.35); mouth('frown'); ell(L - 0.5, ey + 4, 0.9, 1.4); done('#7fc4e8', null); break;
        case 'angry': eye(L); eye(Rt); brow(L, 0.45, 0.8); brow(Rt, -0.45, 0.8); mouth('grit'); break;
        case 'wink': eye(L); shut(Rt); mouth('smile'); break;
        case 'sleepy': for (const cx of [L, Rt]) { P(); g.arc(cx, ey - 0.4, 2, 0, Math.PI); g.fillStyle = iris; g.fill(); line(OL, 1.2, [[cx - 2.2, ey - 0.4], [cx + 2.2, ey - 0.4]]); } mouth('o'); g.fillStyle = '#9fb4d8'; g.font = 'bold 6px sans-serif'; g.fillText('z', R - 2, HY - R + 2 + Math.sin(t * 2) * 1); break;
        case 'smirk': eye(L); eye(Rt); brow(Rt, -0.2, -1.2); mouth('smirk'); break;
        default: eye(L); eye(Rt); mouth('smile');
      }
      if (!browed && mood !== 'dead' && mood !== 'sleepy') { brow(L, fem ? -0.08 : 0, fem ? -0.2 : 0); brow(Rt, fem ? 0.08 : 0, fem ? -0.2 : 0); }
      // facial hair
      if (av.facialHair === 'moustache') { P(); g.moveTo(mx, my - 2.2); g.quadraticCurveTo(mx - 3, my - 3.6, mx - 5, my - 1.2); g.quadraticCurveTo(mx - 2, my - 1.2, mx, my - 1.6); g.quadraticCurveTo(mx + 2, my - 1.2, mx + 5, my - 1.2); g.quadraticCurveTo(mx + 3, my - 3.6, mx, my - 2.2); done(hairC, OL, 0.8); }
      if (av.facialHair === 'beard') { P(); g.moveTo(-R + 1, HY + 1); g.quadraticCurveTo(-R + 1, HY + R + 3, 0, HY + R + 3); g.quadraticCurveTo(R - 1, HY + R + 3, R - 1, HY + 1); g.quadraticCurveTo(R - 3, HY + 6, mx + 4, my - 2); g.quadraticCurveTo(mx, my - 3, mx - 4, my - 2); g.quadraticCurveTo(-R + 3, HY + 6, -R + 1, HY + 1); done(lin(hairC, HY, HY + R + 3)); mouth(said); } // the mood's mouth again, over the beard
      // face accessories
      if (acc === 'glasses') { for (const cx of [L, Rt]) { circ(cx, ey, 3.3); done('rgba(200,230,255,0.25)', '#272933', 1.1); } line('#272933', 1, [[L + 3.3, ey], [Rt - 3.3, ey]]); }
      if (acc === 'shades') { for (const cx of [L, Rt]) { rr(cx - 3.5, ey - 2.4, 7, 4.6, 2); done('#101014', OL, 0.8); } line('#101014', 1.2, [[L + 3, ey - 1], [Rt - 3, ey - 1]]); line('rgba(255,255,255,0.5)', 0.9, [[L - 2, ey - 1.2], [L - 0.5, ey - 1.6]]); }
      if (acc === 'monocle') { circ(Rt, ey, 3.4); done('rgba(220,240,255,0.25)', '#d1b574', 1.1); line('#d1b574', 0.7, [[Rt + 3.2, ey + 1], [Rt + 4, ey + 12]]); }
      if (acc === 'eyepatch') { line('#191f29', 1, [[-R, HY - 6], [R, HY - 1]]); ell(L, ey, 3.2, 3); done('#191f29', OL, 0.8); }
      if (acc === 'mask') { P(); g.moveTo(-R + 1, ey - 1); g.quadraticCurveTo(L, ey - 6, 0, ey - 2); g.quadraticCurveTo(Rt, ey - 6, R - 1, ey - 1); g.quadraticCurveTo(Rt, ey + 4.5, 0, ey + 1.2); g.quadraticCurveTo(L, ey + 4.5, -R + 1, ey - 1); done(lin('#4a2a6a', ey - 5, ey + 4)); for (const cx of [L, Rt]) { ell(cx, ey, 1.9, 1.4); done('#0a0610', null); } line('#d6af53', 0.7, [[-R + 2, ey - 1.5], [-3, ey - 3]]); }
      if (acc === 'pipe') { line('#5a3a20', 1.4, [[mx + 2, my], [mx + 7, my + 1]]); rr(mx + 6, my - 2.5, 3.5, 4, 1); done('#3a2414', OL, 0.6); }
      if (acc === 'earring') { circ(-R + 0.5 + e * 0.3, HY + 4.5, 1.2); done('#ffd35c', OL, 0.6); }
      if (acc === 'nightShades') { rr(L - 4.4, ey - 3, 18.4, 5.6, 2.4); done('#15161c', OL, 0.9); const gl = 0.55 + 0.3 * Math.sin(t * 3); for (const cx of [L, Rt]) { ell(cx, ey - 0.2, 3.1, 2); done(`rgba(90,255,120,${gl})`, '#0a3a14', 0.6); } line('#15161c', 1.4, [[-R, ey - 1], [L - 4, ey - 1]]); line('#15161c', 1.4, [[Rt + 4, ey - 1], [R, ey - 1]]); line('rgba(255,255,255,0.6)', 0.8, [[L - 2, ey - 1.6], [L - 0.6, ey - 2]]); }
      if (acc === 'heartShades') { for (const cx of [L, Rt]) heart(cx, ey - 0.6, 3, 'rgba(232,30,80,0.88)', 1); line('#e81e50', 1.2, [[L + 2.2, ey - 1.6], [Rt - 2.2, ey - 1.6]]); line('rgba(255,255,255,0.7)', 0.8, [[L - 1.8, ey - 1.6], [L - 0.6, ey - 2.4]]); }
      if (acc === 'snorkel') { rr(L - 4.6, ey - 4, Rt - L + 9.2, 7.4, 3); done('rgba(170,230,255,0.45)', '#ff7a1a', 1.6); line('#ff7a1a', 1.2, [[-R, ey - 1], [L - 4.5, ey - 1]]); line('#ff7a1a', 1.2, [[Rt + 4.5, ey - 1], [R, ey - 1]]); line('rgba(255,255,255,0.7)', 0.9, [[L - 2.5, ey - 2.5], [L - 0.5, ey - 3]]);
        line(OL, 3.6, [[R + 1, ey + 3], [R + 2, HY - 16]]); line('#ffd23f', 2.2, [[R + 1, ey + 3], [R + 2, HY - 16]]); rr(R - 0.5, HY - 18, 5, 2.6, 1); done('#ff7a1a', OL, 0.7); line('#ffd23f', 1.6, [[R + 1, ey + 3], [mx + 3, my + 1]]); }
      if (acc === 'earmuffs') { P(); g.arc(0, HY - 1, R + 2.5, Math.PI * 1.05, Math.PI * 1.95); g.strokeStyle = OL; g.lineWidth = 3; g.stroke(); g.strokeStyle = '#c0283c'; g.lineWidth = 1.6; g.stroke(); for (const sx of [-1, 1]) { for (let k = 0; k < 7; k++) { circ(sx * (R + 1) + Math.cos(k * 0.9) * 2.4, HY + 1 + Math.sin(k * 0.9) * 2.8, 2.2); done('#ffffff', null); } ell(sx * (R + 1), HY + 1, 4.2, 4.8); done(null, OL, 1); ell(sx * (R + 1), HY + 1, 2.2, 2.6); done('#f4f0ff', null); } }
      if (hat === 'plagueHat') { P(); g.moveTo(-3 + e, ey + 1); g.quadraticCurveTo(10 + e, ey + 1, 15 + e, ey + 10); g.quadraticCurveTo(6 + e, ey + 8, -3 + e, ey + 6); g.closePath(); done(lin('#e2dcc4', ey, ey + 10)); for (const cx of [L, Rt]) { circ(cx, ey, 2.4); done('#2a2a30', OL, 0.8); } }
    }
    function drawHatSmooth(e) {
      const top = HY - R; // -57
      const brim = (rx, ry, c, yy = HY - 8) => { ell(0, yy, rx, ry); done(lin(c, yy - ry, yy + ry)); };
      switch (hat) {
        case 'top': case 'highRoller': brim(17, 3.2, '#1e1e24'); rr(-9, top - 16, 18, 20, 2.5); done(lin(hat === 'top' ? '#2a2a34' : '#1c1622', top - 16, top + 4)); rect(hat === 'top' ? '#c0392b' : '#e2b23c', -9, top - 1, 18, 3.4);
          if (hat === 'highRoller') { rr(4, top - 13, 6, 8, 1); done('#f6f2e6', OL, 0.6); P(); g.moveTo(7, top - 11); g.lineTo(8.5, top - 9); g.lineTo(7, top - 7); g.lineTo(5.5, top - 9); g.closePath(); done('#c0283c', null); for (let i = 0; i < 3; i++) { circ(-6 + i * 4, top + 0.7, 0.7); done(Math.sin(t * 3 + i) > 0.4 ? '#fff' : '#9fe8ff', null); } }
          break;
        case 'cap': { const d = f >= 0 ? 1 : -1; P(); g.arc(0, HY - 4, R + 1, Math.PI, 0); g.closePath(); done(lin(color, top - 2, HY - 4)); ell(d * 13, HY - 4, 9, 2.4); done(sh(color, -0.3)); circ(0, top - 0.5, 1.5); done('#fff', OL, 0.6); line('rgba(255,255,255,0.35)', 1, [[-6, top + 3], [-1, top + 1]]); break; }
        case 'crown': poly([[-11, HY - 7], [-12, top - 7], [-6, top - 1], [0, top - 10], [6, top - 1], [12, top - 7], [11, HY - 7]]); done(lin('#ffd84a', top - 10, HY - 7)); circ(0, HY - 10, 1.8); done('#e74c3c', OL, 0.6); circ(-7, HY - 9.5, 1.2); done('#3ee6ff', null); circ(7, HY - 9.5, 1.2); done('#2ee6a6', null); break;
        case 'beanie': P(); g.arc(0, HY - 4, R + 1.5, Math.PI, 0); g.closePath(); done(lin(sh(color, 0.15), top - 2, HY - 4)); rr(-R - 2, HY - 8, (R + 2) * 2, 6, 3); done(sh(color, -0.2)); circ(0, top - 3, 4); done('#fff'); break;
        case 'party': poly([[-8, HY - 9], [8, HY - 9], [1.5, top - 20]]); done(lin('#9b59b6', top - 20, HY - 9)); line('#ffd23f', 2, [[-5, HY - 15], [5, HY - 17]]); line('#3ee6ff', 2, [[-2.5, top - 9], [3.5, top - 10.5]]); circ(1.5, top - 21, 2.6); done('#ff4f9a', OL, 0.8); break;
        case 'bow': { const bx = 8, by = top + 3; poly([[bx, by], [bx - 7, by - 5], [bx - 7, by + 5]]); done('#ff5fa2'); poly([[bx, by], [bx + 7, by - 5], [bx + 7, by + 5]]); done('#ff5fa2'); circ(bx, by, 2.2); done('#d63384'); break; }
        case 'cowboy': P(); g.moveTo(-21, HY - 11); g.quadraticCurveTo(-16, HY - 5, 0, HY - 5.5); g.quadraticCurveTo(16, HY - 5, 21, HY - 11); g.quadraticCurveTo(14, HY - 8, 0, HY - 8.5); g.quadraticCurveTo(-14, HY - 8, -21, HY - 11); done(lin('#9b6a3b', HY - 11, HY - 5)); P(); g.moveTo(-9, HY - 8); g.quadraticCurveTo(-11, top - 10, -4, top - 9); g.quadraticCurveTo(0, top - 5, 4, top - 9); g.quadraticCurveTo(11, top - 10, 9, HY - 8); g.closePath(); done(lin('#9b6a3b', top - 10, HY - 8)); rect('#5d3a1a', -9.5, HY - 12, 19, 2.6); break;
        case 'chef': rr(-9, top - 3, 18, 8, 2); done('#fff'); P(); g.arc(-6, top - 6, 5.5, 0, TAU); g.arc(6, top - 6, 5.5, 0, TAU); g.moveTo(5, top - 10); g.arc(0, top - 10, 6.5, 0, TAU); done('#fff'); rr(-9, top - 1, 18, 6, 1.5); done('#fff'); break;
        case 'hood': P(); g.arc(0, HY - 1, R + 4, Math.PI * 0.92, Math.PI * 2.08); g.arc(0, HY - 1, R + 0.5, Math.PI * 2.02, Math.PI * 0.98, true); g.closePath(); done(lin(sh(color, -0.3), top - 4, HY + 6)); break;
        case 'helmet': P(); g.arc(0, HY - 3, R + 2, Math.PI, 0); g.closePath(); done(lin('#c4ccd2', top - 4, HY - 3)); rr(-1.6, HY - 6, 3.2, 10, 1); done('#a6b2b6'); rect('#8a959a', -R - 2, HY - 5, (R + 2) * 2, 2); for (const s of [-1, 1]) { circ(s * 9, HY - 7, 0.9); done('#7a858a', null); } line('rgba(255,255,255,0.6)', 1.2, [[-8, top + 1], [-3, top - 1]]); break;
        case 'wizardHat': brim(19, 3.4, '#3d4f8a'); P(); g.moveTo(-10, HY - 9); g.quadraticCurveTo(-5, top - 12, 8 + Math.sin(t * 2) * 1, top - 20); g.quadraticCurveTo(2, top - 6, 10, HY - 9); g.closePath(); done(lin('#4d62a8', top - 20, HY - 9)); star(-2, top - 4, 2.4, '#ffd35c'); star(4, top - 10, 1.5, '#ffd35c'); rect('#c1aa75', -10, HY - 12.5, 20, 2.4); break;
        case 'wideBrim': case 'fedora': case 'plagueHat': { const c = hat === 'wideBrim' ? '#7a5a3a' : hat === 'fedora' ? '#2a2a2e' : '#1d1d22'; brim(hat === 'fedora' ? 17 : 20, 3.4, c); P(); g.moveTo(-9, HY - 9); g.lineTo(-8, top - 5); g.quadraticCurveTo(0, top - (hat === 'fedora' ? 2 : 8), 8, top - 5); g.lineTo(9, HY - 9); g.closePath(); done(lin(c, top - 8, HY - 9)); rect(hat === 'fedora' ? '#8a1f1f' : '#3a2a20', -9, HY - 13, 18, 2.8); break; }
        case 'bandana': P(); g.arc(0, HY - 2, R + 1, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(0, HY - 7, -R - 1, HY - 3); done(lin('#c0392b', top - 2, HY - 4)); for (const [dx, dy] of [[-6, -9], [0, -11], [6, -9], [-3, -6], [3, -6]]) { circ(dx, HY + dy, 0.8); done('#fff', null); } P(); g.moveTo(R - 1, HY - 5); g.lineTo(R + 6, HY - 1); g.lineTo(R + 3, HY + 1); g.closePath(); done('#c0392b', OL, 1); break;
        case 'jesterHat': for (const [s, c] of [[-1, '#83517f'], [1, '#e0b24a']]) { P(); g.moveTo(0, HY - 9); g.quadraticCurveTo(s * 4, top - 12, s * 18, top - 4); g.quadraticCurveTo(s * 10, top - 2, s * 9, HY - 9); g.closePath(); done(lin(c, top - 12, HY - 9)); circ(s * 18, top - 3, 2.2); done('#ffd35c', OL, 0.8); } rr(-R - 1, HY - 11, (R + 1) * 2, 4, 2); done('#3ab0a0'); break;
        case 'flowerCrown': for (let i = 0; i < 7; i++) { const a = Math.PI * (1.05 + i * 0.15), fx = Math.cos(a) * (R + 0.5), fy = HY - 2 + Math.sin(a) * (R - 3); circ(fx, fy, 2.6); done(['#ff8cc6', '#ffd23f', '#c97991', '#ffffff'][i % 4], OL, 0.8); circ(fx, fy, 0.9); done('#e0a93a', null); } break;
        case 'execHood': { P(); g.moveTo(-R - 5, HY + 15); g.quadraticCurveTo(-R - 2, HY + 8, -R - 1.5, HY - 2); g.quadraticCurveTo(-R, top - 3, -1, top - 7); g.lineTo(1, top - 7); g.quadraticCurveTo(R, top - 3, R + 1.5, HY - 2); g.quadraticCurveTo(R + 2, HY + 8, R + 5, HY + 15); g.quadraticCurveTo(0, HY + 18, -R - 5, HY + 15); done(lin('#2a2830', top - 7, HY + 16, 0.08, -0.22)); line('rgba(0,0,0,0.35)', 1, [[-R + 1, HY + 12], [-R + 3, HY + 3]]); line('rgba(0,0,0,0.35)', 1, [[R - 1, HY + 12], [R - 3, HY + 3]]); for (const s of [-1, 1]) { ell(s * 4.6 + e, HY + 1, 3, 2.1, s * 0.15); done('#050406', OL, 0.8); circ(s * 4.6 + e, HY + 1, 0.9); done('#c8b9a4', null); } line('rgba(255,255,255,0.12)', 1.4, [[-8, top - 3], [-3, top - 8]]); break; }
        case 'executionerHood': { P(); g.moveTo(-R - 2, HY + 10); g.quadraticCurveTo(-R - 3, top - 4, 0, top - 9); g.quadraticCurveTo(R + 3, top - 4, R + 2, HY + 10); g.quadraticCurveTo(0, HY + 13, -R - 2, HY + 10); done(lin('#8e1f2c', top - 9, HY + 12)); for (const s of [-1, 1]) { ell(s * 4.6 + e, HY + 1, 2.8, 2); done('#050406', OL, 0.8); circ(s * 4.6 + e, HY + 1, 0.9); done('#f3d27a', null); } rect('#d6af53', -1, top - 6, 2, 9); rect('#d6af53', -3.5, top - 3, 7, 2); break; }
        case 'halo': g.save(); g.shadowColor = '#ffe48a'; g.shadowBlur = 6; ell(0, top - 6 + Math.sin(t * 2) * 0.8, 10, 2.8); g.strokeStyle = '#ffe48a'; g.lineWidth = 2.2; g.stroke(); g.restore(); break;
        case 'pirate': P(); g.moveTo(-18, HY - 8); g.quadraticCurveTo(-12, top - 10, 0, top - 6); g.quadraticCurveTo(12, top - 10, 18, HY - 8); g.quadraticCurveTo(0, HY - 13, -18, HY - 8); done(lin('#1e1a20', top - 10, HY - 8)); line('#d6af53', 1.2, [[-16, HY - 9], [0, HY - 12], [16, HY - 9]]); circ(0, top - 1, 2.6); done('#f3ead8', OL, 0.7); line('#f3ead8', 1, [[-3, top + 3], [3, top + 1]]); line('#f3ead8', 1, [[3, top + 3], [-3, top + 1]]); break;
        case 'samurai': P(); g.arc(0, HY - 4, R + 2, Math.PI, 0); g.closePath(); done(lin('#3a3a44', top - 4, HY - 4)); for (const s of [-1, 1]) { P(); g.moveTo(s * 3, top); g.quadraticCurveTo(s * 12, top - 6, s * 14, top - 14); g.quadraticCurveTo(s * 8, top - 6, s * 1, top + 2); done('#e2b23c', OL, 0.9); rr(s > 0 ? R - 1 : -R - 4, HY - 5, 5, 10, 2); done('#7a1f1f'); } rect('#7a1f1f', -R - 2, HY - 7, (R + 2) * 2, 2.5); break;
        case 'antlers': for (const s of [-1, 1]) { line(OL, 3.6, [[s * 5, top + 2], [s * 9, top - 10]]); line('#8a6a4a', 2, [[s * 5, top + 2], [s * 9, top - 10]]); line(OL, 3.2, [[s * 7, top - 4], [s * 13, top - 7]]); line('#8a6a4a', 1.7, [[s * 7, top - 4], [s * 13, top - 7]]); line(OL, 3.2, [[s * 8.5, top - 8], [s * 5, top - 13]]); line('#8a6a4a', 1.7, [[s * 8.5, top - 8], [s * 5, top - 13]]); } break;
        case 'catEars': for (const s of [-1, 1]) { poly([[s * 3, top + 1], [s * 10, top - 9], [s * 12, top + 4]]); done(hairC); poly([[s * 5.5, top + 1], [s * 9.5, top - 5], [s * 10.5, top + 2]]); done('#f2a0b8', null); } break;
        case 'vikingHelm': for (const s of [-1, 1]) { P(); g.moveTo(s * 11, HY - 7); g.quadraticCurveTo(s * 22, HY - 9, s * 20, top - 9); g.quadraticCurveTo(s * 17, HY - 12, s * 9, HY - 11); g.closePath(); done(lin('#efe6cc', top - 9, HY - 7)); } P(); g.arc(0, HY - 4, R + 1.5, Math.PI, 0); g.closePath(); done(lin('#b8c2c8', top - 3, HY - 4)); rect('#8a6a3a', -R - 1.5, HY - 7, (R + 1.5) * 2, 3); line('#8a6a3a', 2.4, [[0, top - 2], [0, HY - 7]]); break;
        case 'beret': ell(-2, top + 2, R + 2, 5, -0.12); done(lin('#3a3a52', top - 3, top + 7)); line(OL, 2, [[0, top - 2.5], [0, top - 5]]); break;
        case 'pumpkin': { const pc = HY - 3; for (const dx of [-8, 8, 0]) { ell(dx, pc, dx ? 9 : 10, 14); done(lin('#e0702a', pc - 14, pc + 14)); } line('#3a6a2a', 3, [[0, pc - 14], [2, pc - 19]]); for (const s of [-1, 1]) poly([[s * 4.5 - 2.5 + e, pc - 1], [s * 4.5 + 2.5 + e, pc - 1], [s * 4.5 + e, pc - 5]]), done('#3a1a04', null), poly([[s * 4.5 - 2.5 + e, pc - 1], [s * 4.5 + 2.5 + e, pc - 1], [s * 4.5 + e, pc - 5]]), g.fillStyle = '#ffd35c', g.globalAlpha *= 0.5, g.fill(), g.globalAlpha *= 2; P(); g.moveTo(-6 + e, pc + 5); for (let i = 0; i < 6; i++) g.lineTo(-6 + e + i * 2.4, pc + 5 + (i % 2 ? 2.5 : 0)); g.lineTo(6 + e, pc + 5); g.quadraticCurveTo(e, pc + 11, -6 + e, pc + 5); done('#3a1a04', null); break; }
        case 'bloodCrown': poly([[-11, HY - 7], [-12, top - 6], [-8, top - 1], [-4, top - 9], [0, top - 2], [4, top - 9], [8, top - 1], [12, top - 6], [11, HY - 7]]); done(lin('#5a1a24', top - 9, HY - 7)); ell(0, HY - 10, 2, 2.6); done('#ff3a4a', OL, 0.7); break;
        case 'spaceHelmet': { circ(0, HY - 1, R + 6); const gg = g.createRadialGradient(-6, HY - 8, 2, 0, HY - 1, R + 6); gg.addColorStop(0, 'rgba(255,255,255,0.35)'); gg.addColorStop(1, 'rgba(160,220,255,0.12)'); done(gg, '#cfe8f5', 1.8); line('rgba(255,255,255,0.75)', 1.8, [[-12, HY - 6], [-8, HY - 13]]); rr(-R - 2, HY + 12, (R + 2) * 2, 4, 2); done('#e4e8f3'); circ(R + 2, HY - 12, 1.3); done('#ff5a5a', null); break; }
        case 'elfCirclet': P(); g.ellipse(0, HY - 5, R + 0.5, 4, 0, Math.PI * 0.95, Math.PI * 2.05); g.strokeStyle = OL; g.lineWidth = 2.6; g.stroke(); g.strokeStyle = '#e2b23c'; g.lineWidth = 1.4; g.stroke(); poly([[0, HY - 12.5], [2.2, HY - 9.5], [0, HY - 6.5], [-2.2, HY - 9.5]]); done('#9fe8ff', OL, 0.8); break;
        case 'dragonHorns': for (const s of [-1, 1]) { P(); g.moveTo(s * 5, top + 2); g.quadraticCurveTo(s * 9, top - 8, s * 16, top - 12); g.quadraticCurveTo(s * 12, top - 3, s * 10, top + 4); g.closePath(); const hg = g.createLinearGradient(s * 5, top + 2, s * 16, top - 12); hg.addColorStop(0, '#5a2a18'); hg.addColorStop(1, '#e9e2cf'); done(hg); } break;
        case 'furHat': for (const s of [-1, 1]) { rr(s > 0 ? R - 3 : -R - 3, HY - 6, 6, 13, 3); done(lin('#7a5434', HY - 6, HY + 7)); } P(); g.arc(0, HY - 4, R + 2, Math.PI, 0); g.closePath(); done(lin('#8a6440', top - 3, HY - 4)); rr(-R - 3, HY - 9, (R + 3) * 2, 6, 3); done('#efe4c8'); break;
        case 'cubeHelm': rr(-R - 2, top - 3, (R + 2) * 2, 15, 1.5); done(lin('#7a7a7a', top - 3, top + 12)); rr(-R + 1, HY - 6, (R - 1) * 2, 3, 0.5); done('#222'); rect('#9fe8ff', -2, top - 1, 4, 3); rect('rgba(255,255,255,0.25)', -R - 1, top - 2, 5, 13); break;
        case 'featherCap': P(); g.moveTo(-R - 1, HY - 6); g.quadraticCurveTo(-R, top - 4, 2, top - 3); g.quadraticCurveTo(R + 6, top - 1, R + 5, HY - 6); g.closePath(); done(lin('#3a7a4a', top - 4, HY - 6)); P(); g.moveTo(-6, HY - 8); g.quadraticCurveTo(-14, top - 6, -10, top - 14); g.quadraticCurveTo(-8, top - 4, -4, HY - 8); done('#e04a5a', OL, 1); break;
        case 'dealerVisor': P(); g.moveTo(-R - 1, HY - 8); g.lineTo(R + 1, HY - 8); g.lineTo(R + 3, HY - 4); g.quadraticCurveTo(0, HY - 1, -R - 3, HY - 4); g.closePath(); done('rgba(47,160,96,0.8)', OL, 1.2); rect('#1f7a4a', -R - 1, HY - 10, (R + 1) * 2, 2.5); rr(6, top - 1, 6, 8, 1); done('#f6f2e6', OL, 0.7); circ(9, top + 3, 1); done('#c0283c', null); break;
        // ---- shop seasons & theme sets ----
        case 'pumpkinCap': { P(); g.arc(0, HY - 4, R + 1.5, Math.PI, 0); g.closePath(); done(lin('#f28c2c', top - 3, HY - 4)); for (const dx of [-8, -3, 3, 8]) { P(); g.moveTo(dx * 0.4, top - 1.5); g.quadraticCurveTo(dx * 1.15, HY - 12, dx * 1.05, HY - 6); g.strokeStyle = 'rgba(150,55,0,0.45)'; g.lineWidth = 1; g.stroke(); }
          rr(-R - 2, HY - 8.5, (R + 2) * 2, 5, 2.5); done(lin('#d06a1a', HY - 8.5, HY - 3.5)); for (let i = -R; i < R + 1; i += 2.5) rect('rgba(0,0,0,0.14)', i, HY - 8, 0.7, 4); rr(-1.6, top - 7, 3.2, 6.5, 1.2); done('#4a7a2a', OL, 0.8); ell(4.5, top - 4.5, 3.6, 1.8, -0.5); done('#62aa3e', OL, 0.8); line('#62aa3e', 1, [[-1, top - 5.5], [-4, top - 7], [-3, top - 9.5]]); break; }
        case 'strawHat': case 'gardenHat': { const st = hat === 'strawHat', c = st ? '#eac46a' : '#f6e8c6'; brim(st ? 21 : 20, 4.2, c); for (let i = -18; i < 19; i += 3) line('rgba(140,100,30,0.35)', 0.6, [[i, HY - 10], [i * 1.08, HY - 5.5]]);
          P(); g.moveTo(-9, HY - 9); g.lineTo(-8.5, top - 3); g.quadraticCurveTo(0, top - 6.5, 8.5, top - 3); g.lineTo(9, HY - 9); g.closePath(); done(lin(c, top - 6, HY - 9)); rect(st ? '#b5562e' : '#8fd0e8', -9, HY - 13.2, 18, 3.2);
          if (st) { ell(7.5, HY - 12.5, 3.4, 1.7, 0.6); done('#e0702a', OL, 0.6); ell(10.5, HY - 11.6, 2.8, 1.4, -0.4); done('#d4a020', OL, 0.6); ell(4.8, HY - 11.4, 2.4, 1.2, -0.9); done('#c0392b', OL, 0.6); }
          else for (const [fx, fc] of [[-6, '#ff8fc6'], [0, '#ffd23f'], [6, '#ff5a7a']]) { for (let k = 0; k < 5; k++) { circ(fx + Math.cos(k * 1.26) * 1.6, HY - 11.6 + Math.sin(k * 1.26) * 1.6, 1.3); done(fc, OL, 0.4); } circ(fx, HY - 11.6, 0.8); done('#fff6d6', null); } break; }
        case 'snowBeanie': { P(); g.arc(0, HY - 4, R + 1.5, Math.PI, 0); g.closePath(); done(lin('#3a6ad0', top - 3, HY - 4)); g.save(); P(); g.arc(0, HY - 4, R + 1.5, Math.PI, 0); g.clip(); line('#ffffff', 1.6, [[-16, top + 4], [16, top + 4]]); for (let i = -14; i < 15; i += 4) { poly([[i, top + 2.6], [i + 1.2, top + 1.2], [i + 2.4, top + 2.6]]); done('#ffffff', null); } g.restore();
          rr(-R - 2, HY - 8.5, (R + 2) * 2, 5.5, 2.6); done('#f4f8ff'); for (let i = -R; i < R + 1; i += 2.2) rect('rgba(60,90,160,0.18)', i, HY - 8, 0.7, 4.6); for (let k = 0; k < 3; k++) line('#ffffff', 0.9, [[-Math.cos(k * 1.05) * 3, HY - 13 - Math.sin(k * 1.05) * 3], [Math.cos(k * 1.05) * 3, HY - 13 + Math.sin(k * 1.05) * 3]]);
          for (let k = 0; k < 8; k++) { circ(Math.cos(k * 0.8) * 3.2, top - 5 + Math.sin(k * 0.8) * 3.2, 2.8); done('#ffffff', null); } circ(0, top - 5, 5.6); done(null, OL, 1.2); circ(0, top - 5, 4.2); done('#ffffff', null); circ(-1.5, top - 6.5, 1.2); done('#e8f0ff', null); break; }
        case 'reindeerBand': { for (const sd of [-1, 1]) { const x0 = sd * 7, y0 = top + 1.5; line(OL, 4.2, [[x0, y0], [sd * 11, top - 11]]); line('#a8743a', 2.6, [[x0, y0], [sd * 11, top - 11]]); line(OL, 3.6, [[sd * 9.5, top - 5], [sd * 15, top - 8]]); line('#a8743a', 2.1, [[sd * 9.5, top - 5], [sd * 15, top - 8]]); line(OL, 3.4, [[sd * 10.6, top - 9], [sd * 7.5, top - 14]]); line('#a8743a', 1.9, [[sd * 10.6, top - 9], [sd * 7.5, top - 14]]); }
          P(); g.arc(0, HY - 1, R + 0.8, Math.PI * 1.08, Math.PI * 1.92); g.strokeStyle = OL; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = '#8a1c2a'; g.lineWidth = 2; g.stroke();
          ell(-3, top + 1, 3.2, 1.6, 0.4); done('#2f8a3a', OL, 0.6); ell(2, top + 0.8, 3.2, 1.6, -0.4); done('#2f8a3a', OL, 0.6); for (const [bx, by] of [[-0.8, top + 1.6], [0.8, top + 2.2], [0.2, top + 0.2]]) { circ(bx, by, 1); done('#e8323c', OL, 0.4); }
          for (const sd of [-1, 1]) { circ(sd * 7.4, top + 3.2 + Math.sin(t * 6 + sd) * 0.3, 1.6); done('#ffd23f', OL, 0.6); } break; }
        case 'heartBoppers': { P(); g.arc(0, HY - 1, R + 0.8, Math.PI * 1.08, Math.PI * 1.92); g.strokeStyle = OL; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = '#ff5c8a'; g.lineWidth = 2; g.stroke();
          for (const sd of [-1, 1]) { const bob = Math.sin(t * 5 + sd) * 1.6, hx = sd * 10 + bob * 0.4, hy = top - 12 + bob; P(); g.moveTo(sd * 6, top + 1.5); for (let k = 1; k <= 6; k++) g.lineTo(sd * 6 + (hx - sd * 6) * k / 6 + (k % 2 ? 1.4 : -1.4), top + 1.5 + (hy + 3 - top - 1.5) * k / 6); g.strokeStyle = '#8a8f99'; g.lineWidth = 0.9; g.stroke(); heart(hx, hy, 3.4, '#ff3a6a', 1); line('rgba(255,255,255,0.7)', 0.8, [[hx - 2, hy - 1.6], [hx - 1, hy - 2.4]]); } break; }
        case 'bunnyEars': { P(); g.arc(0, HY - 1, R + 0.8, Math.PI * 1.08, Math.PI * 1.92); g.strokeStyle = OL; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = '#ffb3c8'; g.lineWidth = 2; g.stroke();
          const flop = Math.sin(t * 2) * 0.06; for (const sd of [-1, 1]) { g.save(); g.translate(sd * 5.5, top + 1); g.rotate(sd * 0.22 + (sd > 0 ? 0.25 + flop : 0)); ell(0, -10, 3.8, 10.5); done(lin('#ffffff', -20, 0)); ell(0, -10, 1.9, 7.5); done('#ffb3c8', null); g.restore(); } break; }
        case 'bucketHat': { P(); g.moveTo(-R - 6, HY - 4); g.lineTo(-R - 1, HY - 9.5); g.lineTo(R + 1, HY - 9.5); g.lineTo(R + 6, HY - 4); g.quadraticCurveTo(0, HY - 1, -R - 6, HY - 4); g.closePath(); done(lin('#2f9688', HY - 10, HY - 2));
          P(); g.moveTo(-R - 1, HY - 8.5); g.lineTo(-R + 2.5, top - 2); g.quadraticCurveTo(0, top - 5, R - 2.5, top - 2); g.lineTo(R + 1, HY - 8.5); g.closePath(); done(lin('#3fb6a8', top - 4, HY - 8)); g.save(); g.clip();
          for (const [lx, ly, a] of [[-7, top + 3, 0.6], [2, top + 1, -0.5], [7, top + 7, 0.9], [-2, HY - 11, -0.2]]) { ell(lx, ly, 3.2, 1.3, a); done('#ffe066', null); line('#2f9688', 0.5, [[lx - Math.cos(a) * 3, ly - Math.sin(a) * 3], [lx + Math.cos(a) * 3, ly + Math.sin(a) * 3]]); } g.restore(); line('rgba(0,0,0,0.25)', 0.8, [[-R - 1, HY - 9], [R + 1, HY - 9]]); break; }
        case 'witchHat': { brim(20, 3.6, '#2a1a3a'); P(); g.moveTo(-9, HY - 9); g.quadraticCurveTo(-4, top - 10, 3, top - 19); g.quadraticCurveTo(7, top - 23, 12, top - 18 + Math.sin(t * 2) * 0.6); g.quadraticCurveTo(7, top - 18, 5, top - 13); g.quadraticCurveTo(3, top - 6, 9, HY - 9); g.closePath(); done(lin('#3e2858', top - 20, HY - 9));
          rect('#8a3ac0', -9.3, HY - 13.6, 18.6, 3.2); rr(-2.4, HY - 14.4, 4.8, 4.8, 0.6); done(null, '#ffd23f', 1.2); star(6, top - 4, 1.4, '#b6ff5c'); break; }
        case 'devilHorns': for (const sd of [-1, 1]) { P(); g.moveTo(sd * 3.5, top + 3); g.quadraticCurveTo(sd * 5, top - 5, sd * 10.5, top - 9); g.quadraticCurveTo(sd * 9.5, top - 3, sd * 9.5, top + 3.5); g.closePath(); done(lin('#ff3a2a', top - 9, top + 3)); line('rgba(255,255,255,0.45)', 0.8, [[sd * 5, top], [sd * 7, top - 5]]); } break;
        case 'trilby': brim(15, 2.8, '#16161c'); P(); g.moveTo(-8.5, HY - 9); g.lineTo(-7.8, top - 2.5); g.quadraticCurveTo(-4, top - 6, 0, top - 3.2); g.quadraticCurveTo(4, top - 6, 7.8, top - 2.5); g.lineTo(8.5, HY - 9); g.closePath(); done(lin('#24242c', top - 6, HY - 9)); rect('#7a7a86', -8.5, HY - 12.4, 17, 2.2); line('rgba(255,255,255,0.18)', 1, [[-6, top + 1], [-4, top - 2]]); break;
        case 'deerstalker': { const a = '#a8865a', b2 = '#5a3a20'; ell(-R + 1, HY - 6.5, 6.5, 2.4, 0.25); done(lin(a, HY - 9, HY - 4)); ell(R - 1, HY - 6.5, 6.5, 2.4, -0.25); done(lin(a, HY - 9, HY - 4));
          P(); g.arc(0, HY - 4, R + 1.5, Math.PI, 0); g.closePath(); done(lin(a, top - 2, HY - 4)); g.save(); P(); g.arc(0, HY - 4, R + 1.5, Math.PI, 0); g.closePath(); g.clip(); g.globalAlpha *= 0.5; for (let i = -16; i < 16; i += 4) { g.fillStyle = b2; g.fillRect(i, top - 4, 1.3, 16); g.fillRect(-16, top - 3 + (i + 16) / 2.2, 32, 1.1); } g.restore();
          P(); g.arc(0, HY - 4, R + 1.5, Math.PI, 0); g.closePath(); done(null); ell(0, HY - 5, 9, 2.4); done(lin(sh(a, -0.1), HY - 7, HY - 3)); line(b2, 1, [[-3, top - 1], [0, top - 2.5], [3, top - 1]]); circ(0, top - 2, 1.2); done(b2, OL, 0.6); break; }
        case 'ufoHat': { const fy = top - 4 + Math.sin(t * 2.4) * 1.2; P(); g.ellipse(0, fy - 1, 7, 6.5, 0, Math.PI, TAU); g.closePath(); done('rgba(150,225,255,0.75)', OL, 1.2); circ(0, fy - 4, 1.8); done('#7aff3a', OL, 0.6); circ(-0.6, fy - 4.4, 0.4); done(OL, null); circ(0.8, fy - 4.4, 0.4); done(OL, null);
          ell(0, fy, 15, 4); done(lin('#c4ccd2', fy - 4, fy + 4)); line('rgba(255,255,255,0.6)', 1, [[-11, fy - 1.5], [-5, fy - 2.8]]); for (let i = -2; i <= 2; i++) { circ(i * 5, fy + 1.2, 1.1); done(Math.sin(t * 6 + i) > 0 ? ['#ff5a5a', '#ffd23f', '#7aff3a', '#3ad8ff', '#ff5ad1'][i + 2] : '#6a7078', null); } break; }
        default: break;
      }
    }
    function effect(layer) {
      const fx = av.effect; if (!fx || fx === 'none') return;
      const back = layer === 'back';
      g.save();
      if (fx === 'fireflies' || fx === 'embers') for (let i = 0; i < 6; i++) { const a = t * 0.8 + i * 1.05, front = Math.sin(a) > 0; if (front === back) continue; const px = Math.cos(a) * 20, py = -26 + Math.sin(a * 1.3 + i) * 24; const gg = g.createRadialGradient(px, py, 0, px, py, 4); const c = fx === 'embers' ? '255,150,60' : '200,240,120'; gg.addColorStop(0, `rgba(${c},0.95)`); gg.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gg; circ(px, py, 4); g.fill(); }
      else if (fx === 'sparkles' && !back) for (let i = 0; i < 6; i++) { const k = Math.sin(t * 5 + i * 2.1); if (k < 0.1) continue; const a = t * 1.2 + i * 1.05; star(Math.cos(a) * 19, -30 + Math.sin(a * 1.7) * 24, 2.6 * k, '#fff6c0'); }
      else if (fx === 'snow' && !back) for (let i = 0; i < 9; i++) { circ(((i * 13 + t * 5) % 46) - 23 + Math.sin(t + i) * 2, -74 + ((t * 13 + i * 17) % 74), 1.4); done('#f4f8ff', 'rgba(120,150,200,0.6)', 0.5); }
      else if (fx === 'hearts' && !back) for (let i = 0; i < 4; i++) { const p = (t * 0.5 + i / 4) % 1, hx = Math.sin(i * 3 + t) * 16, hy = -24 - p * 46; g.globalAlpha = 1 - p; P(); g.moveTo(hx, hy + 2.5); g.bezierCurveTo(hx - 5, hy - 1, hx - 2, hy - 4.5, hx, hy - 1.8); g.bezierCurveTo(hx + 2, hy - 4.5, hx + 5, hy - 1, hx, hy + 2.5); done('#ff6ea0', OL, 0.6); g.globalAlpha = 1; }
      else if ((fx === 'shadow' || fx === 'bloodMist') && back) { const c = fx === 'shadow' ? '40,16,60' : '170,20,36'; for (let i = 0; i < 7; i++) { const p = (t * 0.35 + i / 7) % 1, px = Math.sin(i * 2.3 + t) * (10 + p * 8), py = -4 - p * 40; const gg = g.createRadialGradient(px, py, 0, px, py, 8); gg.addColorStop(0, `rgba(${c},${0.5 * (1 - p)})`); gg.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gg; circ(px, py, 8); g.fill(); } }
      else if (fx === 'goldRain' && !back) for (let i = 0; i < 9; i++) { const p = (t * 0.55 + i / 9) % 1, px = Math.sin(i * 2.3) * 20, py = -84 + p * 84, w = Math.max(0.5, 2.6 * Math.abs(Math.cos(t * 5 + i))); g.globalAlpha = p < 0.85 ? 1 : (1 - p) / 0.15; ell(px, py, w, 2.6); done('#ffd23f', '#b8860b', 0.6); g.globalAlpha = 1; }
      else if (fx === 'lightning' && !back) { const k = Math.sin(t * 2.6); if (k > 0.8) { g.shadowColor = '#bfe4ff'; g.shadowBlur = 8; line('#e6f4ff', 1.8, [[-8, -84], [0, -74], [-5, -70], [4, -60]]); } const gg = g.createRadialGradient(0, -30, 0, 0, -30, 34); gg.addColorStop(0, 'rgba(150,200,255,0.0)'); gg.addColorStop(1, `rgba(150,200,255,${0.12 + 0.1 * Math.max(0, k)})`); g.fillStyle = gg; circ(0, -30, 34); g.fill(); }
      // ---- shop seasons & theme sets ----
      else if (fx === 'fallingLeaves' && !back) for (let i = 0; i < 7; i++) { const p = (t * 0.22 + i / 7) % 1, lx = Math.sin(i * 2.7 + t * 0.8) * 20 + Math.sin(p * 9 + i) * 3, ly = -80 + p * 82; g.save(); g.globalAlpha *= p > 0.85 ? (1 - p) / 0.15 : 1; g.translate(lx, ly); g.rotate(Math.sin(t * 2 + i) * 1.2); ell(0, 0, 3.4, 1.8); done(['#e8862a', '#c0392b', '#e0b020'][i % 3], OL, 0.6); line(OL, 0.5, [[-3, 0], [3, 0]]); g.restore(); }
      else if (fx === 'aurora' && back) { g.save(); for (let k = 0; k < 3; k++) { P(); for (let x = -30; x <= 30; x += 3) g.lineTo(x, -58 + k * 7 + Math.sin(x * 0.12 + t * 1.6 + k) * 4); g.strokeStyle = ['rgba(90,255,170,0.32)', 'rgba(150,110,255,0.28)', 'rgba(90,220,255,0.26)'][k]; g.lineWidth = 7 - k; g.lineCap = 'round'; g.stroke(); } g.restore(); }
      else if (fx === 'rosePetals' && !back) for (let i = 0; i < 7; i++) { const p = (t * 0.25 + i / 7) % 1, px = Math.sin(i * 2.2 + t) * 19, py = -78 + p * 80; g.save(); g.globalAlpha *= p > 0.85 ? (1 - p) / 0.15 : 1; g.translate(px, py); g.rotate(t * 2 + i); ell(0, 0, 2.6, 1.6); done(i % 2 ? '#e8323c' : '#ff5c8a', '#7a1035', 0.5); g.restore(); }
      else if (fx === 'butterflies') for (let i = 0; i < 3; i++) { const a = t * 0.9 + i * 2.1, front = Math.sin(a) > 0; if (front === back) continue; const bx = Math.cos(a) * 21, by = -40 + Math.sin(a * 1.6 + i) * 18, fl = Math.abs(Math.sin(t * 12 + i)); g.save(); g.translate(bx, by); for (const sd of [-1, 1]) { g.save(); g.scale(sd * (0.3 + fl * 0.7), 1); ell(2.2, -1.2, 2.4, 2); done(['#ff9a2a', '#3aa0ff', '#ff5ad1'][i], OL, 0.5); ell(1.8, 1.6, 1.6, 1.3); done(['#ffd23f', '#9fe8ff', '#ffb3e8'][i], OL, 0.5); g.restore(); } line(OL, 1, [[0, -2.4], [0, 2.4]]); g.restore(); }
      else if (fx === 'bubbles' && !back) for (let i = 0; i < 6; i++) { const p = (t * 0.3 + i / 6) % 1, bx = Math.sin(i * 2.4) * 18 + Math.sin(t * 2 + i) * 2, by = -6 - p * 76, r = 1.8 + (i % 3) * 0.9; g.save(); g.globalAlpha *= p > 0.8 ? (1 - p) / 0.2 : 1; circ(bx, by, r); done('rgba(190,235,255,0.25)', 'rgba(120,200,255,0.9)', 0.7); line('rgba(255,255,255,0.9)', 0.6, [[bx - r * 0.5, by - r * 0.3], [bx - r * 0.2, by - r * 0.6]]); g.restore(); }
      else if (fx === 'ghostly') for (let i = 0; i < 2; i++) { const a = t * 0.8 + i * Math.PI, front = Math.sin(a) > 0; if (front === back) continue; const gx = Math.cos(a) * 22, gy = -44 + Math.sin(t * 2 + i) * 4 - i * 14; g.save(); g.globalAlpha *= 0.85; g.translate(gx, gy); P(); g.arc(0, -2, 4, Math.PI, 0); g.lineTo(4, 3); for (let k = 0; k < 4; k++) g.lineTo(4 - (k + 0.5) * 2, 3 + (k % 2 ? 0 : 1.6)); g.lineTo(-4, 3); g.closePath(); done('#f4f6ff', OL, 0.7); circ(-1.4, -2.2, 0.6); done(OL, null); circ(1.4, -2.2, 0.6); done(OL, null); g.restore(); }
      else if (fx === 'batSwarm' && !back) for (let i = 0; i < 5; i++) { const a = t * 1.4 + i * 1.26, bx = Math.cos(a) * 16, by = -72 + Math.sin(a) * 4 + Math.sin(t * 3 + i) * 1.5, fl = Math.sin(t * 14 + i) * 1.6; g.save(); g.translate(bx, by); P(); g.moveTo(0, 0); g.quadraticCurveTo(-3, -2 - fl, -6, -1 - fl); g.quadraticCurveTo(-4.5, 0, -4.5, 1.2); g.quadraticCurveTo(-2.5, 0.4, 0, 1.4); g.quadraticCurveTo(2.5, 0.4, 4.5, 1.2); g.quadraticCurveTo(4.5, 0, 6, -1 - fl); g.quadraticCurveTo(3, -2 - fl, 0, 0); g.closePath(); done('#2a1240', OL, 0.6); g.restore(); }
      else if (fx === 'luckyDice') for (let i = 0; i < 2; i++) { const a = t * 1.1 + i * Math.PI, front = Math.sin(a) > 0; if (front === back) continue; const dx = Math.cos(a) * 20, dy = -30 + Math.sin(t * 2.2 + i * 2) * 10; g.save(); g.translate(dx, dy); g.rotate(t * 2.5 + i); rr(-3.6, -3.6, 7.2, 7.2, 1.4); done(i ? '#ffffff' : '#e8323c', OL, 0.8); const pc = i ? OL : '#ffffff'; for (const [px, py] of [[-1.7, -1.8], [-1.7, 0], [-1.7, 1.8], [1.7, -1.8], [1.7, 0], [1.7, 1.8]]) { circ(px, py, 0.6); done(pc, null); } g.restore(); }
      else if (fx === 'orbit') { const pl = [['#ff8a3a', 3.2, 0], ['#3ad8ff', 2.4, 2.1], ['#b6ff5c', 2, 4.2]]; if (back) { g.save(); ell(0, -24, 22, 6, -0.12); g.strokeStyle = 'rgba(160,200,255,0.4)'; g.lineWidth = 0.8; g.setLineDash && g.setLineDash([2, 2]); g.stroke(); g.setLineDash && g.setLineDash([]); g.restore(); }
        for (const [c, r, off] of pl) { const a = t * 0.9 + off, front = Math.sin(a) > 0; if (front === back) continue; const px = Math.cos(a) * 22, py = -24 + Math.sin(a) * 6 + px * -0.12 * 0.27; circ(px, py, r); done(lin(c, py - r, py + r, 0.3, -0.25), OL, 0.7); if (c === '#ff8a3a') { ell(px, py, r + 2, 0.9, -0.3); done(null, '#ffe08a', 0.8); } } }
      g.restore();
    }
  }
  // The moods a player can pick (MT_OPTIONS.expression); 'scared' and 'dead' are animation states.
  const EXPRESSIONS = ['smile', 'grin', 'neutral', 'serious', 'surprised', 'sad', 'angry', 'wink', 'sleepy', 'smirk'];
  root.MTArt = { drawCharacter: drawSmooth, drawSmooth, bodyOf, drawClassic, drawGhost, costumeGhost, drawShadowFigure, drawHat, roundRect, shade, EXPRESSIONS };
})(window);
