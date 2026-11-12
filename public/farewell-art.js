// Update 8: farewell animations. A player buys and equips one in the shop
// (avatar field `deathAnim`); when that player dies, it plays over their body on the TV.
// It belongs to the victim, so it never hints at who the killer was.
//
// Every effect is a pure function of time, so the shop preview (looping) and the TV
// (once, settling at the end) draw exactly the same thing.
//   draw(ctx, kind, x, y, s, t, { avatar, once })
//   x, y: where the body lies (ground level); s: 1 = a town-sized character (~45px tall)
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const hash = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  function glow(ctx, x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  const KINDS = {
    // Rose petals drift down and settle around them.
    petals(ctx, x, y, s, t, o) {
      for (let i = 0; i < 22; i++) {
        const local = o.once ? clamp((t - i * 0.07) / 3.2, 0, 1) : (t * 0.32 + i / 22) % 1;
        if (o.once && t < i * 0.07) continue;
        const px = x + (hash(i) - 0.5) * 80 * s + Math.sin(local * 6 + i) * 9 * s * (1 - local);
        const py = y - 95 * s + local * (92 + hash(i + 9) * 8) * s;
        ctx.save(); ctx.translate(px, py); ctx.rotate(local * 5 + i);
        ctx.globalAlpha *= o.once ? 1 : Math.sin(local * Math.PI);
        ctx.fillStyle = i % 3 ? '#ff7aa8' : '#ffc2d8'; ctx.beginPath(); ctx.ellipse(0, 0, 3.2 * s, 2 * s, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    },
    // Fireflies rise from them and drift into the dark.
    fireflies(ctx, x, y, s, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const ph = (t * 0.28 + i / 14) % 1, a = Math.sin(ph * Math.PI) * (0.6 + 0.4 * Math.sin(t * 9 + i));
        const px = x + Math.sin(i * 7.3 + t * 1.6) * 34 * s + (hash(i) - 0.5) * 30 * s, py = y - 6 * s - ph * 130 * s;
        glow(ctx, px, py, 7 * s, '255,236,120', 0.55 * a); ctx.fillStyle = `rgba(255,250,200,${a})`; ctx.fillRect(px - s, py - s, 2 * s, 2 * s);
      }
      ctx.restore();
    },
    // A sealed letter flutters down and lands beside them.
    letter(ctx, x, y, s, t, o) {
      const p = o.once ? clamp(t / 2.6, 0, 1) : (t % 4) / 2.6, q = clamp(p, 0, 1);
      const px = x + 18 * s + Math.sin(q * 9) * 14 * s * (1 - q), py = y - 110 * s + q * 104 * s;
      ctx.save(); ctx.translate(px, py); ctx.rotate(Math.sin(q * 9) * 0.5 * (1 - q) + (q >= 1 ? 0.15 : 0));
      ctx.fillStyle = '#f6efdc'; ctx.fillRect(-9 * s, -6 * s, 18 * s, 12 * s);
      ctx.strokeStyle = '#b9a98a'; ctx.lineWidth = Math.max(1, s); ctx.beginPath(); ctx.moveTo(-9 * s, -6 * s); ctx.lineTo(0, 1 * s); ctx.lineTo(9 * s, -6 * s); ctx.stroke();
      ctx.fillStyle = '#b3262e'; ctx.beginPath(); ctx.arc(0, 1 * s, 2.4 * s, 0, TAU); ctx.fill();
      ctx.restore();
    },
    // A candle burns beside them, gutters, and goes out (a thin wisp of smoke).
    candle(ctx, x, y, s, t, o) {
      const tt = o.once ? t : t % 7, out = tt > 4.5, cx = x + 26 * s;
      ctx.fillStyle = '#efe6c8'; ctx.fillRect(cx - 2.5 * s, y - 14 * s, 5 * s, 14 * s);
      ctx.fillStyle = '#c9bd98'; ctx.fillRect(cx - 2.5 * s, y - 2 * s, 5 * s, 2 * s);
      if (!out) {
        const f = 1 + Math.sin(tt * 17) * 0.12 + (tt > 3.6 ? Math.sin(tt * 40) * 0.3 : 0);
        glow(ctx, cx, y - 19 * s, 22 * s, '255,190,90', 0.45);
        ctx.fillStyle = '#ffcf4a'; ctx.beginPath(); ctx.ellipse(cx, y - 19 * s, 2.6 * s, 5 * s * f, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff4c2'; ctx.beginPath(); ctx.ellipse(cx, y - 18 * s, 1.1 * s, 2.4 * s * f, 0, 0, TAU); ctx.fill();
      } else if (tt < 7) {
        for (let i = 0; i < 6; i++) { const k = ((tt - 4.5) * 0.6 + i / 6) % 1; ctx.fillStyle = `rgba(200,200,210,${0.35 * (1 - k)})`; ctx.beginPath(); ctx.arc(cx + Math.sin(k * 8 + i) * 4 * s, y - 16 * s - k * 40 * s, (1.5 + k * 3) * s, 0, TAU); ctx.fill(); }
      }
    },
    // A paper sky lantern lifts away into the night.
    lantern(ctx, x, y, s, t, o) {
      const k = o.once ? clamp(t / 6, 0, 1) : (t % 5) / 5;
      const px = x + Math.sin(t * 1.3) * 6 * s, py = y - 24 * s - k * 150 * s, a = o.once ? 1 - clamp((t - 5) / 1.5, 0, 1) : Math.sin(k * Math.PI) + 0.2;
      ctx.save(); ctx.globalAlpha *= clamp(a, 0, 1);
      glow(ctx, px, py, 26 * s, '255,170,80', 0.5);
      ctx.fillStyle = '#ff9a3c'; ctx.beginPath(); ctx.moveTo(px - 7 * s, py - 9 * s); ctx.lineTo(px + 7 * s, py - 9 * s); ctx.lineTo(px + 5 * s, py + 7 * s); ctx.lineTo(px - 5 * s, py + 7 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffe2a8'; ctx.fillRect(px - 2 * s, py - 4 * s, 4 * s, 8 * s);
      ctx.restore();
    },
    // Stars streak across the sky and sparkle over them.
    starfall(ctx, x, y, s, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const k = ((t + i * 0.75) % 2.2) / 2.2; if (k > 0.55) continue;
        const q = k / 0.55, sx = x - 110 * s + q * 220 * s + i * 20 * s, sy = y - 150 * s + i * 18 * s + q * 50 * s;
        const g = ctx.createLinearGradient(sx - 40 * s, sy - 10 * s, sx, sy); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, `rgba(255,248,210,${1 - q})`);
        ctx.strokeStyle = g; ctx.lineWidth = 2.4 * s; ctx.beginPath(); ctx.moveTo(sx - 40 * s, sy - 10 * s); ctx.lineTo(sx, sy); ctx.stroke();
      }
      for (let i = 0; i < 9; i++) { const a = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.7); const px = x + (hash(i) - 0.5) * 70 * s, py = y - 20 * s - hash(i + 3) * 60 * s; ctx.fillStyle = `rgba(255,250,220,${a})`; ctx.fillRect(px - 1.5 * s, py - 0.4 * s, 3 * s, 0.8 * s); ctx.fillRect(px - 0.4 * s, py - 1.5 * s, 0.8 * s, 3 * s); }
      ctx.restore();
    },
    // Their spirit rises from the body, glowing, and fades away.
    ascend(ctx, x, y, s, t, o) {
      const k = o.once ? clamp(t / 3.6, 0, 1) : (t % 4.2) / 3.6;
      if (k > 1) return;
      const py = y - 6 * s - k * 90 * s, a = (o.once ? 1 - k : Math.sin(Math.min(1, k) * Math.PI)) * 0.55;
      ctx.save(); ctx.globalAlpha *= a;
      glow(ctx, x, py - 20 * s, 34 * s, '200,225,255', 0.6);
      if (window.MTArt && o.avatar) window.MTArt.drawCharacter(ctx, x, py, o.avatar, { scale: 0.756 * s, t, expression: 'happy' });
      ctx.strokeStyle = 'rgba(255,240,170,.9)'; ctx.lineWidth = 1.6 * s; ctx.beginPath(); ctx.ellipse(x, py - 52 * s, 8 * s, 2.6 * s, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    },
    // Green ectoplasm bursts from the body, then the ghost pulls itself out of the goo.
    ectoplasm(ctx, x, y, s, t, o) {
      const tt = o.once ? t : t % 4.6, burst = clamp(tt / 0.6, 0, 1), rise = clamp((tt - 0.9) / 2.6, 0, 1);
      ctx.fillStyle = 'rgba(80,220,110,0.85)';
      ctx.beginPath(); ctx.ellipse(x, y - 1 * s, (14 + burst * 22) * s, (3 + burst * 4) * s, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 12; i++) {
        const a = hash(i) * Math.PI, k = clamp(tt / 1.1, 0, 1), d = (20 + hash(i + 4) * 40) * s * k;
        const px = x + Math.cos(a) * d * (i % 2 ? 1 : -1), py = y - Math.sin(a) * d * 1.3 + k * k * 30 * s;
        if (py > y) continue;
        ctx.fillStyle = `rgba(120,255,140,${0.9 * (1 - k * 0.6)})`; ctx.beginPath(); ctx.arc(px, py, (2.6 - k) * s, 0, TAU); ctx.fill();
      }
      for (let i = 0; i < 3; i++) { const dx = (i - 1) * 9 * s, len = (6 + 10 * Math.abs(Math.sin(tt * 2 + i))) * s * burst; ctx.fillStyle = 'rgba(80,220,110,0.75)'; ctx.fillRect(dx + x - 1.5 * s, y - 2 * s, 3 * s, len); }
      if (rise > 0 && window.MTArt && o.avatar) {
        ctx.save(); ctx.globalAlpha *= Math.min(1, rise * 2) * (o.once ? 1 - clamp((tt - 4) / 1, 0, 1) : 1);
        glow(ctx, x, y - 30 * s - rise * 30 * s, 30 * s, '120,255,150', 0.45);
        window.MTArt.drawGhost(ctx, x, y - rise * 34 * s, o.avatar, { scale: s, t, alpha: 0.85, glow: true });
        ctx.restore();
      }
    },
    // Spectral chains wrap the body, glow, and shatter: the soul breaks free and rises.
    soulChains(ctx, x, y, s, t, o) {
      const tt = o.once ? t : t % 5, wrap = clamp(tt / 1.2, 0, 1), snap = tt > 1.8, k = clamp((tt - 1.8) / 1.4, 0, 1);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineWidth = 1.6 * s;
      if (!snap) {
        for (let i = 0; i < 7; i++) {
          if (i / 7 > wrap) continue;
          const lx = x - 20 * s + i * 6.5 * s, ly = y - 6 * s + Math.sin(i * 1.7 + tt * 3) * 2 * s;
          ctx.strokeStyle = `rgba(150,200,255,${0.6 + 0.4 * Math.sin(tt * 9 + i)})`; ctx.beginPath(); ctx.ellipse(lx, ly, 3.2 * s, 2 * s, i % 2 ? 0.6 : -0.6, 0, TAU); ctx.stroke();
        }
        if (tt > 1.3) glow(ctx, x, y - 6 * s, 30 * s, '170,210,255', 0.5 * Math.sin((tt - 1.3) / 0.5 * Math.PI / 2));
      } else {
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.45, d = k * 60 * s;
          ctx.strokeStyle = `rgba(150,200,255,${1 - k})`; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * d, y - 6 * s + Math.sin(a) * d * 0.6 + k * k * 40 * s, 3 * s, 2 * s, k * 6 + i, 0, TAU); ctx.stroke();
        }
        if (k < 0.3) glow(ctx, x, y - 8 * s, 50 * s, '220,240,255', 0.9 * (1 - k / 0.3));
      }
      ctx.restore();
      if (snap && window.MTArt && o.avatar) {
        const up = clamp((tt - 1.9) / 2.4, 0, 1);
        ctx.save(); ctx.globalAlpha *= Math.min(1, up * 3) * (o.once ? 1 - clamp((tt - 4.6) / 1, 0, 1) : 1);
        window.MTArt.drawGhost(ctx, x, y - 6 * s - up * 50 * s, o.avatar, { scale: s, t, alpha: 0.85, glow: true });
        ctx.restore();
      }
    },
  };
  function draw(ctx, kind, x, y, s, t, o = {}) {
    const f = KINDS[kind]; if (!f) return;
    ctx.save(); try { f(ctx, x, y, s, Math.max(0, t), o); } finally { ctx.restore(); }
  }
  // A small looping preview for the shop: the character lying down with the effect.
  function preview(ctx, kind, w, h, t, avatar) {
    ctx.fillStyle = '#1d2236'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#2c3350'; ctx.fillRect(0, h * 0.78, w, h * 0.22);
    const s = h / 150, x = w / 2, y = h * 0.82;
    if (window.MTArt && avatar) { ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 2); ctx.translate(-x, -y); window.MTArt.drawCharacter(ctx, x + 2 * s, y + 16 * s, avatar, { scale: 0.62 * s, dead: true }); ctx.restore(); }
    draw(ctx, kind, x, y, s, t, { avatar, once: false });
  }
  window.MT_FAREWELL = { draw, preview, KINDS: Object.keys(KINDS) };
})();
