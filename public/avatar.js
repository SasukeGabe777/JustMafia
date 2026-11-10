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

  function drawCharacter(ctx, x, y, av, o = {}) {
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

  function drawGhost(ctx, x, y, av, o = {}) {
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

    ctx.shadowColor = 'rgba(200,220,255,0.9)';
    ctx.shadowBlur = o.glow ? 18 : 6;
    ctx.fillStyle = 'rgba(244,248,255,0.95)';
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
    ctx.strokeStyle = av.color; ctx.lineWidth = 2; ctx.stroke();

    ctx.fillStyle = '#1d1d24';
    ctx.beginPath(); ctx.ellipse(-5, -31, 2.4, 3.6, 0, 0, TAU); ctx.ellipse(5, -31, 2.4, 3.6, 0, 0, TAU); ctx.fill();
    if (o.mouth) { ctx.beginPath(); ctx.ellipse(0, -21, 3, 4, 0, 0, TAU); ctx.fill(); }
    drawHat(ctx, av.hat, 0, -31, 12, av.color, 0);
    ctx.restore();
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

  root.MTArt = { drawCharacter, drawGhost, drawShadowFigure, drawHat, roundRect, shade };
})(window);
