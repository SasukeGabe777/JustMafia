'use strict';
// The JustGold chest (docs/justgold.md "The chest scene"): after every box game, each signed-in
// player's phone opens their own chest (it shakes, bursts open, coins fly in line by line while the
// counter rolls up to the new balance) and the TV shows everyone's chests in a row with their
// earnings and bonus callouts. The Party Mode finale opens the big legendary chest, with fireworks.
// The server has already paid the gold (box/room.js openChest); this only shows it.
//
//   JGChest.drawChest(ctx, x, baseY, width, { tier, open 0..1, t, shake 0..1, glow })   the art (canvas, original)
//   JGChest.drawCoin(ctx, x, y, r, t)                                                   a spinning JustGold coin
//   JGChest.phone(chest, o)   o: { vip, skip(), save(), haptic(kind), sound(kind), onDone(after) }
//   JGChest.tv(chest, o)      o: { players, skip(), sound(kind) }
//   JGChest.close()           JGChest.active() -> { id, where } | null
//   JGChest.TIERS             wood | silver | gold | epic | legendary (box/gold.js tierOf picks one)
// Sounds go through o.sound(kind) with kind: rattle | open | coin | done | fanfare (the pages route them to
// BOX.audio clips / stingers on the SFX bus, or SFX). prefers-reduced-motion: no shaking, few particles.
(function () {
  const TIERS = {
    wood: { name: 'Wooden chest', body: ['#b8743f', '#7c4520'], plank: 'rgba(60,28,8,.55)', band: '#6b717d', bandHi: '#b7bfcc', trim: '#3b1f0c', glow: '#ffd77a', lock: '#d6dbe3', gem: null, coins: 8, color: '#d89a5b' },
    silver: { name: 'Silver chest', body: ['#5f7fb5', '#3a4f7e'], plank: 'rgba(20,30,60,.5)', band: '#dfe7f2', bandHi: '#ffffff', trim: '#232c4a', glow: '#d3ecff', lock: '#f3f7fc', gem: '#5ab8ff', coins: 14, color: '#cfe1ff' },
    gold: { name: 'Golden chest', body: ['#c23a36', '#7d1f22'], plank: 'rgba(60,6,10,.5)', band: '#ffc83d', bandHi: '#fff3b0', trim: '#4a0e12', glow: '#ffe066', lock: '#ffd84a', gem: '#2ee6a6', coins: 22, color: '#ffd23f' },
    epic: { name: 'Epic chest', body: ['#8a4cf0', '#4b1fa0'], plank: 'rgba(30,6,70,.5)', band: '#ffc83d', bandHi: '#fff3b0', trim: '#22094d', glow: '#e2b8ff', lock: '#ffd84a', gem: '#ff4f9a', coins: 30, color: '#d9a8ff' },
    legendary: { name: 'Legendary chest', body: ['#ffd659', '#e3870f'], plank: 'rgba(130,60,0,.45)', band: '#fff8de', bandHi: '#ffffff', trim: '#7a3d00', glow: '#fff3b0', lock: '#7b3fe4', gem: '#3ee6ff', coins: 44, color: '#ffe680', crown: true },
  };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const back = (x) => { x = clamp(x, 0, 1); const c = 1.9; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

  // ---------- the art ----------
  function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function star(g, x, y, r, k = 0.38) { g.beginPath(); for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, rr2 = i % 2 ? r * k : r; g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } g.closePath(); }
  function drawCoin(g, x, y, r, t = 0) {
    const s = Math.abs(Math.cos(t * 5)) * 0.8 + 0.2; // spinning: the coin's width
    g.save(); g.translate(x, y);
    g.fillStyle = '#a8620a'; g.beginPath(); g.ellipse(0, r * 0.12, r * s, r, 0, 0, Math.PI * 2); g.fill();
    const gr = g.createLinearGradient(-r, -r, r, r); gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.45, '#ffcc33'); gr.addColorStop(1, '#e08f12');
    g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, r * s, r, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(150,80,0,.8)'; g.lineWidth = Math.max(1, r * 0.14); g.beginPath(); g.ellipse(0, 0, r * s * 0.72, r * 0.72, 0, 0, Math.PI * 2); g.stroke();
    if (s > 0.45) { g.fillStyle = 'rgba(150,80,0,.85)'; g.font = `900 ${Math.round(r * 1.05)}px Fredoka, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.scale(s, 1); g.fillText('J', 0, r * 0.06); g.restore(); }
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.ellipse(-r * s * 0.35, -r * 0.4, r * s * 0.18, r * 0.28, -0.5, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  // x = centre, baseY = the floor under the chest, w = body width.
  function drawChest(g, x, baseY, w, o = {}) {
    const T = TIERS[o.tier] || TIERS.wood, open = clamp(o.open || 0, 0, 1), t = o.t || 0;
    const hb = w * 0.5, lh = w * 0.34, top = baseY - hb, lx = x - w / 2, rim = w * 0.075;
    g.save();
    // shake: a wobble around the bottom
    if (o.shake) { const a = o.shake; g.translate(x, baseY); g.rotate(Math.sin(t * 38) * 0.07 * a); g.translate(Math.sin(t * 51) * w * 0.02 * a, -Math.abs(Math.sin(t * 19)) * w * 0.05 * a); g.translate(-x, -baseY); }
    if (o.squash) { g.translate(x, baseY); g.scale(1 + o.squash * 0.12, 1 - o.squash * 0.12); g.translate(-x, -baseY); }
    // shadow
    g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, baseY + w * 0.02, w * 0.6, w * 0.07, 0, 0, Math.PI * 2); g.fill();
    // glow behind when open
    if (open > 0.3 || o.glow) {
      const k = Math.max(open > 0.3 ? (open - 0.3) / 0.7 : 0, o.glow || 0), R = o.glowR || w * 1.25;
      const rg = g.createRadialGradient(x, top, 0, x, top, R); rg.addColorStop(0, T.glow); rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.globalAlpha = 0.55 * k; g.fillStyle = rg; g.beginPath(); g.arc(x, top, R, 0, Math.PI * 2); g.fill();
      // light beams, turning slowly
      g.globalAlpha = 0.5 * k; g.fillStyle = rg; // (beams fade out with the glow: no hard edge at the canvas border)
      for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.27 + Math.sin(t * 0.9 + i) * 0.05, len = R * (0.85 + 0.15 * Math.sin(t * 2 + i * 1.7)); g.beginPath(); g.moveTo(x - w * 0.05, top); g.lineTo(x + Math.cos(a - 0.06) * len, top + Math.sin(a - 0.06) * len); g.lineTo(x + Math.cos(a + 0.06) * len, top + Math.sin(a + 0.06) * len); g.closePath(); g.fill(); }
      g.globalAlpha = 1;
    }
    // the open lid stands up behind the chest: its inside faces us
    if (open >= 0.5) {
      const k = ease((open - 0.5) / 0.5), ih = lh * (0.35 + 0.75 * k), back0 = top - rim * 0.9, wide = w * (1 + 0.06 * k);
      g.beginPath(); g.moveTo(x - w / 2, back0); g.lineTo(x - wide / 2, back0 - ih); g.quadraticCurveTo(x, back0 - ih - lh * 0.35 * k, x + wide / 2, back0 - ih); g.lineTo(x + w / 2, back0); g.closePath();
      const ig = g.createLinearGradient(0, back0 - ih, 0, back0); ig.addColorStop(0, T.body[1]); ig.addColorStop(1, '#1d0c05'); g.fillStyle = ig; g.fill();
      g.lineWidth = Math.max(2, w * 0.035); g.strokeStyle = T.band; g.stroke();
      g.strokeStyle = T.trim; g.lineWidth = Math.max(1, w * 0.012); g.stroke();
    }
    // body
    const bg = g.createLinearGradient(0, top, 0, baseY); bg.addColorStop(0, T.body[0]); bg.addColorStop(1, T.body[1]);
    rr(g, lx, top, w, hb, w * 0.05); g.fillStyle = bg; g.fill();
    g.save(); rr(g, lx, top, w, hb, w * 0.05); g.clip();
    g.strokeStyle = T.plank; g.lineWidth = Math.max(1, w * 0.012);
    for (let i = 1; i < 3; i++) { const y = top + (hb * i) / 3; g.beginPath(); g.moveTo(lx, y); g.lineTo(lx + w, y); g.stroke(); }
    for (const bx of [-0.33, 0.33]) { // metal bands
      g.fillStyle = T.band; g.fillRect(x + bx * w - w * 0.045, top, w * 0.09, hb);
      g.fillStyle = T.bandHi; g.globalAlpha = 0.55; g.fillRect(x + bx * w - w * 0.045, top, w * 0.022, hb); g.globalAlpha = 1;
      g.fillStyle = T.trim; for (const ry of [0.22, 0.78]) { g.beginPath(); g.arc(x + bx * w, top + hb * ry, w * 0.014, 0, Math.PI * 2); g.fill(); }
    }
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(lx, top, w, hb * 0.12);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(lx, baseY - hb * 0.1, w, hb * 0.1);
    g.restore();
    g.lineWidth = Math.max(2, w * 0.028); g.strokeStyle = T.trim; rr(g, lx, top, w, hb, w * 0.05); g.stroke();
    // corners
    g.fillStyle = T.band; for (const cx of [lx, lx + w]) { g.beginPath(); g.moveTo(cx, baseY - w * 0.1); g.lineTo(cx, baseY); g.lineTo(cx + (cx === lx ? w * 0.1 : -w * 0.1), baseY); g.closePath(); g.fill(); }
    // the opening (seen from a little above): treasure inside
    if (open > 0.3) {
      const k = ease((open - 0.3) / 0.7);
      g.fillStyle = '#1a0b04'; rr(g, lx + w * 0.03, top - rim * k, w * 0.94, rim * 1.2 * k + 2, rim * 0.4); g.fill();
      g.save(); rr(g, lx + w * 0.03, top - rim * k, w * 0.94, rim * 1.2 * k + 2, rim * 0.4); g.clip();
      for (let i = 0; i < 14; i++) { const cx = lx + w * (0.1 + 0.8 * ((i * 0.618) % 1)), cy = top - rim * k * 0.4 + (i % 3) * rim * 0.25; g.fillStyle = i % 2 ? '#ffcc33' : '#ffe680'; g.beginPath(); g.ellipse(cx, cy, w * 0.045, w * 0.022, 0, 0, Math.PI * 2); g.fill(); }
      g.restore();
      g.strokeStyle = T.band; g.lineWidth = Math.max(2, w * 0.03); rr(g, lx + w * 0.03, top - rim * k, w * 0.94, rim * 1.2 * k + 2, rim * 0.4); g.stroke();
    }
    // the closed lid: a rounded dome on top (it lifts and tips back as it opens)
    if (open < 0.5) {
      const k = open / 0.5, lift = lh * 0.5 * k, sy = 1 - 0.75 * k;
      g.save(); g.translate(x, top - lift); g.scale(1, sy);
      g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(-w / 2, -lh * 0.45); g.bezierCurveTo(-w / 2, -lh * 1.1, w / 2, -lh * 1.1, w / 2, -lh * 0.45); g.lineTo(w / 2, 0); g.closePath();
      const lg = g.createLinearGradient(0, -lh, 0, 0); lg.addColorStop(0, T.body[0]); lg.addColorStop(1, T.body[1]); g.fillStyle = lg; g.fill();
      g.save(); g.clip();
      g.strokeStyle = T.plank; g.lineWidth = Math.max(1, w * 0.012); g.beginPath(); g.moveTo(-w / 2, -lh * 0.5); g.bezierCurveTo(-w * 0.3, -lh * 0.72, w * 0.3, -lh * 0.72, w / 2, -lh * 0.5); g.stroke();
      for (const bx of [-0.33, 0.33]) { g.fillStyle = T.band; g.fillRect(bx * w - w * 0.045, -lh * 1.2, w * 0.09, lh * 1.2); g.fillStyle = T.bandHi; g.globalAlpha = 0.55; g.fillRect(bx * w - w * 0.045, -lh * 1.2, w * 0.022, lh * 1.2); g.globalAlpha = 1; }
      g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.ellipse(-w * 0.12, -lh * 0.68, w * 0.26, lh * 0.12, -0.08, 0, Math.PI * 2); g.fill();
      g.restore();
      g.lineWidth = Math.max(2, w * 0.028); g.strokeStyle = T.trim; g.stroke();
      g.fillStyle = T.band; g.fillRect(-w / 2, -w * 0.035, w, w * 0.05); // the lid's rim
      if (T.gem) { // a gem on the lid
        const gy = -lh * 0.62; g.fillStyle = T.band; g.beginPath(); g.arc(0, gy, w * 0.075, 0, Math.PI * 2); g.fill();
        g.fillStyle = T.gem; g.beginPath(); g.moveTo(0, gy - w * 0.055); g.lineTo(w * 0.05, gy); g.lineTo(0, gy + w * 0.055); g.lineTo(-w * 0.05, gy); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(-w * 0.015, gy - w * 0.02, w * 0.012, 0, Math.PI * 2); g.fill();
      }
      if (T.crown) { // the legendary chest: a little crown
        const cy = -lh * 1.05; g.fillStyle = '#7b3fe4'; g.beginPath(); g.moveTo(-w * 0.12, cy + w * 0.06); g.lineTo(-w * 0.12, cy - w * 0.02); g.lineTo(-w * 0.06, cy + w * 0.02); g.lineTo(0, cy - w * 0.05); g.lineTo(w * 0.06, cy + w * 0.02); g.lineTo(w * 0.12, cy - w * 0.02); g.lineTo(w * 0.12, cy + w * 0.06); g.closePath(); g.fill();
        g.strokeStyle = '#fff8de'; g.lineWidth = Math.max(1, w * 0.01); g.stroke();
      }
      g.restore();
    }
    // the lock plate on the front (it pops when the chest opens)
    const lk = open > 0 ? 1 - clamp(open * 3, 0, 1) : 1;
    if (lk > 0) {
      g.globalAlpha = lk; const ly = top + hb * 0.08;
      rr(g, x - w * 0.085, ly, w * 0.17, w * 0.17, w * 0.03); g.fillStyle = T.lock; g.fill(); g.lineWidth = Math.max(1, w * 0.014); g.strokeStyle = T.trim; g.stroke();
      g.fillStyle = T.trim; g.beginPath(); g.arc(x, ly + w * 0.07, w * 0.024, 0, Math.PI * 2); g.fill(); g.fillRect(x - w * 0.011, ly + w * 0.075, w * 0.022, w * 0.05);
      g.globalAlpha = 1;
    }
    // shimmer for the legendary chest (and a glint on epic ones)
    if ((T.crown || o.tier === 'epic') && open < 1) {
      const p = (t * 0.45) % 1.6 - 0.3; g.save(); rr(g, lx, top - lh, w, hb + lh, w * 0.05); g.clip();
      const sg = g.createLinearGradient(lx + p * w * 1.4 - w * 0.2, 0, lx + p * w * 1.4 + w * 0.2, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(0.5, 'rgba(255,255,255,.45)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sg; g.fillRect(lx, top - lh, w, hb + lh); g.restore();
    }
    g.restore();
  }

  // ---------- particles (one overlay canvas per scene) ----------
  function Fx(cv) {
    const P = []; let W = 0, H = 0, dpr = 1;
    const fit = () => { dpr = Math.min(window.devicePixelRatio || 1, 2); W = cv.clientWidth || innerWidth; H = cv.clientHeight || innerHeight; if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); } };
    return {
      P, fit, get W() { return W; }, get H() { return H; },
      add(p) { if (P.length < 700) P.push(p); },
      // a coin that flies from (x0,y0) to (x1,y1) along an arc; onLand when it gets there
      flyer(x0, y0, x1, y1, delay, r, onLand) { this.add({ kind: 'fly', x0, y0, x1, y1, t: -delay, dur: 0.55 + Math.random() * 0.25, r, arc: 60 + Math.random() * 80, side: (Math.random() - 0.5) * 120, spin: Math.random() * 6, onLand }); },
      burst(x, y, n, o = {}) { for (let i = 0; i < n; i++) { const a = (o.up ? -Math.PI / 2 : 0) + (Math.random() - 0.5) * (o.spread || Math.PI * 2), v = (o.speed || 420) * (0.4 + Math.random() * 0.8); this.add({ kind: o.kind || 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: (o.life || 1.1) * (0.6 + Math.random() * 0.6), r: (o.r || 5) * (0.6 + Math.random() * 0.8), color: o.colors ? o.colors[i % o.colors.length] : '#fff3b0', g: o.gravity == null ? 700 : o.gravity, spin: Math.random() * 6 }); } },
      step(dt, g, now) {
        fit(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        for (let i = P.length - 1; i >= 0; i--) {
          const p = P[i]; p.t += dt;
          if (p.kind === 'fly') {
            if (p.t < 0) continue;
            const k = p.t / p.dur;
            if (k >= 1) { P.splice(i, 1); if (p.onLand) p.onLand(); continue; }
            const e = k * k * (3 - 2 * k), x = p.x0 + (p.x1 - p.x0) * e + Math.sin(k * Math.PI) * p.side * (1 - k), y = p.y0 + (p.y1 - p.y0) * e - Math.sin(k * Math.PI) * p.arc;
            drawCoin(g, x, y, p.r * (1 - 0.3 * k), now + p.spin);
            continue;
          }
          if (p.t > p.life) { P.splice(i, 1); continue; }
          p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.99;
          const a = 1 - p.t / p.life;
          if (p.kind === 'coin') drawCoin(g, p.x, p.y, p.r, now + p.spin);
          else if (p.kind === 'confetti') { g.save(); g.globalAlpha = Math.min(1, a * 2); g.translate(p.x, p.y); g.rotate(p.t * 8 + p.spin); g.fillStyle = p.color; g.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9); g.restore(); }
          else { g.globalAlpha = a; g.fillStyle = p.color; star(g, p.x, p.y, p.r * (0.6 + a * 0.6)); g.fill(); g.globalAlpha = 1; }
        }
      },
    };
  }
  const FIRE = ['#ff4f9a', '#ffd23f', '#3ee6ff', '#2ee6a6', '#b388ff', '#ff8c42', '#ffffff'];

  // ---------- styles (one sheet, shared by the TV, phones and JustMafia) ----------
  function styles() {
    if (document.getElementById('jgc-css')) return;
    const s = document.createElement('style'); s.id = 'jgc-css';
    s.textContent = `
.jgc-ov{position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;font-family:Fredoka,system-ui,sans-serif;color:#fff8ef;background:radial-gradient(ellipse at 50% 38%,rgba(78,34,150,.97),rgba(14,7,34,.985));-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:jgc-in .3s ease-out;overflow:hidden}
.jgc-ov.out{animation:jgc-out .45s ease-in forwards}
@keyframes jgc-in{from{opacity:0}to{opacity:1}}@keyframes jgc-out{to{opacity:0;transform:scale(1.04)}}
.jgc-fx{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3}
.jgc-rays{position:absolute;left:50%;top:42%;width:240vmax;height:240vmax;margin:-120vmax 0 0 -120vmax;background:repeating-conic-gradient(from 0deg,rgba(255,230,120,.07) 0 8deg,transparent 8deg 20deg);animation:jgc-spin 40s linear infinite;pointer-events:none;opacity:0;transition:opacity .6s}
.jgc-ov.opened .jgc-rays{opacity:1}
@keyframes jgc-spin{to{transform:rotate(360deg)}}
.jgc-card{position:relative;z-index:2;width:min(440px,94vw);max-height:100%;display:flex;flex-direction:column;align-items:center;text-align:center;padding:14px 14px 16px;box-sizing:border-box}
.jgc-kick{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#c9bfe6;margin:0}
.jgc-title{margin:2px 0 0;font-size:30px;line-height:1.1;text-shadow:0 3px 0 rgba(0,0,0,.35)}
.jgc-title .tier{color:var(--jgc-c,#ffd23f)}
.jgc-chest{width:100%;height:min(250px,30vh);display:block}
.jgc-count{display:flex;align-items:center;justify-content:center;gap:8px;font-size:22px;font-weight:600;background:rgba(0,0,0,.3);border:2px solid rgba(255,210,63,.45);border-radius:999px;padding:6px 18px 6px 8px;margin:2px 0 8px;font-variant-numeric:tabular-nums}
.jgc-count .ic{width:30px;height:30px}
.jgc-count b{font-size:32px;color:#ffd23f;min-width:2.2em;display:inline-block;transition:transform .12s}
.jgc-count b.bump{transform:scale(1.18)}
.jgc-count em{font-style:normal;color:#2ee6a6;font-size:20px}
.jgc-lines{list-style:none;margin:0;padding:0;width:100%;display:flex;flex-direction:column;gap:5px;max-height:38vh;overflow:auto}
.jgc-lines li{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:6px 10px;font-size:16px;text-align:left;opacity:0;transform:translateX(-18px) scale(.96);transition:opacity .25s,transform .3s cubic-bezier(.2,1.6,.4,1)}
.jgc-lines li.on{opacity:1;transform:none}
.jgc-lines li i{font-style:normal;font-size:20px;width:26px;text-align:center}
.jgc-lines li span{flex:1;min-width:0}
.jgc-lines li b{color:#ffd23f;font-size:18px}
.jgc-lines li.k-daily,.jgc-lines li.k-streak{border-color:rgba(255,140,66,.6);background:rgba(255,140,66,.14)}
.jgc-lines li.k-ach,.jgc-lines li.k-wins,.jgc-lines li.k-roll{border-color:rgba(62,230,255,.5);background:rgba(62,230,255,.1)}
.jgc-lines li.k-place,.jgc-lines li.k-stayed{border-color:rgba(255,210,63,.6);background:rgba(255,210,63,.12)}
.jgc-lines li.k-challenge,.jgc-lines li.k-level,.jgc-lines li.k-pass,.jgc-lines li.k-set{border-color:rgba(46,230,166,.55);background:rgba(46,230,166,.1)}
.jgc-guest{margin-top:10px;width:100%;display:flex;align-items:center;gap:10px;background:#ffd23f;color:#2a1650;border-radius:14px;padding:10px 12px;text-align:left;font-size:15px;box-shadow:0 4px 0 rgba(0,0,0,.3);animation:jgc-pulse 1.4s ease-in-out infinite}
.jgc-guest b{display:block;font-size:17px}
.jgc-guest button{margin-left:auto;border:0;border-radius:10px;background:#2a1650;color:#fff;font:inherit;font-weight:700;padding:8px 12px;cursor:pointer}
@keyframes jgc-pulse{50%{transform:scale(1.03)}}
.jgc-btns{display:flex;gap:8px;margin-top:12px}
.jgc-btns button{border:0;border-radius:12px;padding:10px 18px;font:inherit;font-weight:700;font-size:17px;cursor:pointer;background:#ffd23f;color:#2a1650;box-shadow:0 4px 0 rgba(0,0,0,.3)}
.jgc-btns button.ghost{background:rgba(255,255,255,.1);color:#fff8ef;box-shadow:none;border:2px solid rgba(255,255,255,.2)}
.jgc-total{font-size:44px;font-weight:700;color:#ffd23f;text-shadow:0 4px 0 rgba(0,0,0,.35);margin:0;opacity:0;transform:scale(.5);transition:opacity .3s,transform .45s cubic-bezier(.2,1.8,.4,1);height:0}
.jgc-ov.done .jgc-total{opacity:1;transform:none;height:auto}
.jgc-ov.jgc-party .jgc-title{font-size:34px;background:linear-gradient(90deg,#ffd23f,#ff8c42,#ff4f9a,#b388ff,#3ee6ff,#ffd23f);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:jgc-rainbow 3s linear infinite}
@keyframes jgc-rainbow{to{background-position:300% 0}}
/* the TV row */
.jgc-ov.jgc-tv{flex-direction:column;justify-content:flex-start;padding:4vh 3vw 3vh;box-sizing:border-box}
.jgc-tvhead{position:relative;z-index:2;text-align:center;margin-bottom:2vh}
.jgc-tvhead small{font-size:clamp(14px,1.4vw,26px);letter-spacing:.2em;color:#c9bfe6;text-transform:uppercase}
.jgc-tvhead h1{margin:.2vh 0 0;font-size:clamp(34px,4.6vw,88px);line-height:1;text-shadow:0 5px 0 rgba(0,0,0,.35)}
.jgc-ov.jgc-tv.jgc-party .jgc-tvhead h1{background:linear-gradient(90deg,#ffd23f,#ff8c42,#ff4f9a,#b388ff,#3ee6ff,#ffd23f);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:jgc-rainbow 3s linear infinite;filter:drop-shadow(0 5px 0 rgba(0,0,0,.35))}
.jgc-row{position:relative;z-index:2;display:flex;flex-wrap:wrap;justify-content:center;align-content:center;gap:1.4vw 1.2vw;width:100%;flex:1;min-height:0}
.jgc-cell{width:var(--cw,13vw);display:flex;flex-direction:column;align-items:center;text-align:center;opacity:0;transform:translateY(30px) scale(.9);transition:opacity .35s,transform .5s cubic-bezier(.2,1.6,.4,1)}
.jgc-cell.on{opacity:1;transform:none}
.jgc-cell canvas{width:100%;height:calc(var(--cw,13vw) * .8);display:block}
.jgc-who{display:flex;align-items:center;gap:.5vw;font-size:clamp(14px,1.25vw,26px);font-weight:600;max-width:100%}
.jgc-who .av{display:inline-flex;font-size:1.3em}
.jgc-who .av img{width:1.7em;height:1.7em;border-radius:50%;background:rgba(255,255,255,.1)}
.jgc-who b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jgc-n{font-size:clamp(22px,2.3vw,48px);font-weight:700;color:#ffd23f;font-variant-numeric:tabular-nums;text-shadow:0 3px 0 rgba(0,0,0,.35);line-height:1.15}
.jgc-n small{font-size:.5em;color:#fff8ef;margin-left:.2em}
.jgc-calls{display:flex;flex-direction:column;gap:.35vh;margin-top:.4vh;width:100%}
.jgc-calls span{font-size:clamp(11px,.95vw,19px);background:rgba(255,255,255,.1);border-radius:999px;padding:.25vh .6vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;transform:scale(.6);transition:opacity .3s,transform .35s cubic-bezier(.2,1.8,.4,1)}
.jgc-cell.opened .jgc-calls span{opacity:1;transform:none}
.jgc-cell.opened .jgc-calls span:nth-child(2){transition-delay:.25s}.jgc-cell.opened .jgc-calls span:nth-child(3){transition-delay:.5s}
.jgc-guestb{font-size:clamp(11px,.9vw,18px);color:#2a1650;background:#ffd23f;border-radius:999px;padding:.2vh .7vw;margin-top:.4vh}
.jgc-tvfoot{position:relative;z-index:2;display:flex;gap:2vw;align-items:center;justify-content:center;font-size:clamp(13px,1.1vw,22px);color:#c9bfe6;margin-top:1vh}
.jgc-tvfoot button{border:0;border-radius:12px;padding:.8vh 1.4vw;font:inherit;font-weight:700;cursor:pointer;background:rgba(255,255,255,.12);color:#fff8ef;border:2px solid rgba(255,255,255,.2)}
.jgc-tvfoot b{color:#ffd23f}
@media (prefers-reduced-motion:reduce){.jgc-rays{animation:none}.jgc-guest{animation:none}}
`;
    document.head.appendChild(s);
  }
  const coinSvg = '<svg class="ic" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="17" r="13" fill="#a8620a"/><circle cx="16" cy="15" r="13" fill="#ffcc33"/><circle cx="16" cy="15" r="9.5" fill="none" stroke="#a8620a" stroke-width="2"/><text x="16" y="20.5" text-anchor="middle" font-family="Fredoka,system-ui,sans-serif" font-weight="900" font-size="14" fill="#a8620a">J</text><ellipse cx="11" cy="9" rx="3" ry="2" fill="#fff" opacity=".7"/></svg>';

  // ---------- the running scene ----------
  let cur = null, lastDone = null; // { id, where, el, raf, timers, done }
  function close(fast) {
    const c = cur; if (!c) return; cur = null;
    cancelAnimationFrame(c.raf); for (const t of c.timers) clearTimeout(t);
    if (c.onKeys) removeEventListener('keydown', c.onKeys, true);
    if (fast) c.el.remove(); else { c.el.classList.add('out'); setTimeout(() => c.el.remove(), 460); }
    if (c.onDone) try { c.onDone(); } catch (e) { console.error(e); }
  }
  // The scene starts `startsIn` ms from now and lasts `left - startsIn` ms (the server's numbers).
  function timing(chest) { const wait = Math.max(0, Number(chest.startsIn) || 0), dur = Math.max(4000, (Number(chest.left) || chest.dur || 8000) - wait); return { wait, dur }; }
  const play = (o, kind) => { try { if (o.sound) o.sound(kind); } catch (e) { /* no sound */ } };
  const buzz = (o, kind) => { try { if (o.haptic) o.haptic(kind); } catch (e) { /* none */ } };

  // A phone: my own chest.
  function phone(chest, o = {}) {
    if (!chest) return null;
    if (cur && cur.id === chest.id) return cur;
    close(true); styles();
    const T = TIERS[chest.tier] || TIERS.wood, party = chest.kind === 'party', lines = (chest.lines || []).filter((l) => l && l.n > 0);
    const guest = !!chest.guest, before = guest || chest.before == null ? 0 : chest.before, after = guest || chest.after == null ? before + chest.n : chest.after;
    const { wait, dur } = timing(chest);
    const el = document.createElement('div'); el.className = 'jgc-ov jgc-phone' + (party ? ' jgc-party' : '') + ' tier-' + (chest.tier || 'wood');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Your JustGold chest'); el.style.setProperty('--jgc-c', T.color);
    el.dataset.chest = chest.id; el.dataset.tier = chest.tier || 'wood'; el.dataset.total = chest.n;
    el.innerHTML = `<div class="jgc-rays"></div><canvas class="jgc-fx"></canvas><div class="jgc-card">
      <p class="jgc-kick">${party ? '🎉 Party Mode finale' : esc(chest.title || 'Game') + ' · your chest'}</p>
      <h2 class="jgc-title">${party ? 'THE LEGENDARY PARTY CHEST' : `<span class="tier">${esc(T.name)}</span>!`}</h2>
      <canvas class="jgc-chest" aria-hidden="true"></canvas>
      <p class="jgc-total" data-jgc-total>+${chest.n} JG</p>
      <div class="jgc-count">${coinSvg}<b data-jgc-count>${guest ? 0 : before}</b><span>JG</span><em data-jgc-plus></em></div>
      <ul class="jgc-lines">${lines.map((l, i) => `<li class="k-${esc(l.key)}" data-line="${i}"><i>${esc(l.icon || '🪙')}</i><span>${esc(l.label)}</span><b>+${l.n}</b></li>`).join('')}</ul>
      ${guest ? `<div class="jgc-guest" data-jgc-guest><span><b>Save your stuff to keep this gold!</b>Pick a name + password and these ${chest.n} JG are yours, on any phone.</span><button data-jgc-save>💾 Save</button></div>` : ''}
      <div class="jgc-btns">${o.vip ? '<button class="ghost" data-jgc-skip>Skip for everyone ⏭</button>' : ''}<button data-jgc-close>${guest ? 'Later' : 'Nice!'}</button></div></div>`;
    document.body.appendChild(el);
    const fxc = el.querySelector('.jgc-fx'), cc = el.querySelector('.jgc-chest'), count = el.querySelector('[data-jgc-count]'), plus = el.querySelector('[data-jgc-plus]');
    const fx = Fx(fxc), RM = reduce();
    const c = cur = { id: chest.id, where: 'phone', guest, el, raf: 0, timers: [], onDone: () => { if (o.onDone) o.onDone(after, { saving: !!c.saving, guest }); } };
    el.querySelector('[data-jgc-close]').onclick = () => close();
    const sk = el.querySelector('[data-jgc-skip]'); if (sk) sk.onclick = () => { if (o.skip) o.skip(); close(); };
    const sv = el.querySelector('[data-jgc-save]'); if (sv) sv.onclick = () => { c.saving = true; if (o.save) o.save(); close(true); };
    // Timeline (s): drop in, shake, burst open, then one line at a time.
    const D = dur / 1000, SHAKE = RM ? 0 : 0.35, OPEN = SHAKE + (RM ? 0.1 : 1.0), L0 = OPEN + 0.55;
    const step = lines.length ? clamp((D - L0 - 2.0) / lines.length, 0.28, 0.75) : 0.5, END = L0 + lines.length * step + 0.9;
    let start = 0, last = 0, shown = guest ? 0 : before, landed = 0, opened = false, lineAt = -1, finished = false, rattle = 0;
    const totalCoins = Math.min(RM ? 10 : 46, Math.max(6, lines.length * 6)), worth = chest.n / Math.max(1, totalCoins);
    const queue = lines.map((l) => Math.max(2, Math.round((l.n / Math.max(1, chest.n)) * totalCoins)));
    const tgt = () => { const a = count.getBoundingClientRect(), b = fxc.getBoundingClientRect(); return { x: a.left - b.left + 22, y: a.top - b.top + a.height / 2 }; };
    const chestAt = () => { const a = cc.getBoundingClientRect(), b = fxc.getBoundingClientRect(); return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height * 0.6 }; };
    const setCount = (v) => { v = Math.round(v); if (String(v) !== count.textContent) { count.textContent = v; count.classList.add('bump'); setTimeout(() => count.classList.remove('bump'), 90); } };
    const frame = (now) => {
      if (cur !== c) return;
      if (!start) start = now; const t = (now - start) / 1000, dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
      // the chest
      const g = cc.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2), w = cc.clientWidth, h = cc.clientHeight;
      if (cc.width !== Math.round(w * dpr)) { cc.width = Math.round(w * dpr); cc.height = Math.round(h * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      const cw = Math.min(w * (party ? 0.62 : 0.55), h * (party ? 0.9 : 0.8)), drop = RM ? 1 : back(t / 0.45), base = h * 0.9 - (1 - drop) * h * 0.6;
      const shake = t > SHAKE && t < OPEN ? ease((t - SHAKE) / (OPEN - SHAKE)) : 0, open = t >= OPEN ? ease((t - OPEN) / 0.4) : 0;
      const squash = t >= OPEN && t < OPEN + 0.25 ? Math.sin(((t - OPEN) / 0.25) * Math.PI) : 0;
      drawChest(g, w / 2, base, cw, { tier: chest.tier, open, t, shake, squash, glow: open, glowR: Math.max(30, Math.min(w / 2, h * 0.9 - cw * 0.5)) });
      if (shake && t - rattle > 0.32) { rattle = t; play(o, 'rattle'); buzz(o, 'tap'); }
      if (!opened && t >= OPEN) {
        opened = true; el.classList.add('opened'); play(o, party ? 'fanfare' : 'open'); buzz(o, party ? 'big' : 'win');
        const p = chestAt();
        fx.burst(p.x, p.y - 20, RM ? 8 : party ? 70 : 34, { up: true, spread: 1.6, speed: 620, colors: [T.glow, '#ffffff', '#ffd23f'], r: 7 });
        if (!RM) fx.burst(p.x, p.y - 10, party ? 26 : 12, { kind: 'coin', up: true, spread: 1.2, speed: 700, r: 9, life: 1.2 });
        if (party && !RM) for (let k = 0; k < 4; k++) c.timers.push(setTimeout(() => { const W = fx.W, H = fx.H; fx.burst(W * (0.2 + Math.random() * 0.6), H * (0.12 + Math.random() * 0.25), 60, { colors: FIRE, speed: 360, gravity: 260, r: 6, life: 1.6 }); play(o, 'coin'); }, 350 + k * 650));
      }
      // one line at a time: it appears, its coins fly to the counter
      const li = t >= L0 ? Math.min(lines.length - 1, Math.floor((t - L0) / step)) : -1;
      while (lineAt < li) {
        lineAt++; const row = el.querySelector(`[data-line="${lineAt}"]`); if (row) { row.classList.add('on'); row.scrollIntoView({ block: 'nearest' }); }
        const p = chestAt(), q = tgt(), n = queue[lineAt], each = lines[lineAt].n / n;
        for (let k = 0; k < n; k++) fx.flyer(p.x + (Math.random() - 0.5) * 40, p.y - 20, q.x, q.y, k * 0.05, 9, () => { landed += each; shown = (guest ? 0 : before) + Math.min(chest.n, landed); setCount(shown); play(o, 'coin'); });
        if (lineAt % 2 === 0) buzz(o, 'tap');
      }
      fx.step(dt, fxc.getContext('2d'), t);
      if (!finished && t >= END) {
        finished = true; landed = chest.n; setCount(guest ? chest.n : after); plus.textContent = '+' + chest.n; el.classList.add('done'); el.querySelectorAll('[data-line]').forEach((x) => x.classList.add('on'));
        el.dataset.done = '1'; play(o, 'done'); buzz(o, 'success'); lastDone = { id: chest.id, where: 'phone', n: chest.n, count: Number(count.textContent), lines: el.querySelectorAll('[data-line].on').length, labels: lines.map((l) => l.label) };
        if (!RM) { const q = tgt(); fx.burst(q.x, q.y, 24, { colors: ['#ffd23f', '#fff3b0', '#2ee6a6'], speed: 300, gravity: 300, r: 5 }); }
      }
      if (party && !RM && opened && Math.random() < dt * 1.6) fx.burst(fx.W * Math.random(), fx.H * (0.1 + Math.random() * 0.3), 40, { colors: FIRE, speed: 300, gravity: 240, r: 5, life: 1.5 });
      // (the page closes it when the server's chest is over, or on Nice!; this is only a safety net)
      if (t > D + 8 && !el.querySelector('[data-jgc-guest]')) return close();
      c.raf = requestAnimationFrame(frame);
    };
    el.style.visibility = wait > 60 ? 'hidden' : '';
    c.timers.push(setTimeout(() => { el.style.visibility = ''; c.raf = requestAnimationFrame(frame); }, wait));
    return c;
  }

  // The TV: everyone's chests in a row.
  function tv(chest, o = {}) {
    if (!chest) return null;
    if (cur && cur.id === chest.id) return cur;
    close(true); styles();
    const party = chest.kind === 'party', rows = (chest.rows || []).slice();
    const { wait, dur } = timing(chest), n = rows.length, RM = reduce();
    const per = n <= 2 ? 21 : n <= 4 ? 18 : n <= 6 ? 14 : n <= 8 ? 11.5 : n <= 12 ? 13 : 10.5; // vw per chest (two rows past 8)
    const el = document.createElement('div'); el.className = 'jgc-ov jgc-tv' + (party ? ' jgc-party' : '');
    el.dataset.chest = chest.id; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', party ? 'The party chests' : 'Everyone’s JustGold chests');
    const pic = (r) => { const p = (o.players || []).find((x) => x.id === r.id) || r; try { if (window.BOX && BOX.portrait) return BOX.portrait.html(p, 56); } catch (e) { /* emoji */ } return esc(r.avatar || '🙂'); };
    el.innerHTML = `<div class="jgc-rays"></div><canvas class="jgc-fx"></canvas>
      <div class="jgc-tvhead"><small>${party ? `🎉 Party Mode · ${chest.games || ''} game${chest.games === 1 ? '' : 's'} tonight` : esc(chest.title || '') + ' · JustGold'}</small><h1>${party ? 'THE PARTY CHESTS!' : '💰 Chest time!'}</h1></div>
      <div class="jgc-row" style="--cw:${per}vw">${rows.map((r, i) => `<div class="jgc-cell" data-cell="${i}" data-tier="${esc(r.tier)}"><canvas></canvas>
        <div class="jgc-who"><span class="av">${pic(r)}</span><b>${esc(window.BOX && BOX.filterText ? BOX.filterText(r.name) : r.name)}</b></div>
        <div class="jgc-n">+<span data-n>0</span><small>JG</small></div>
        ${r.guest ? '<span class="jgc-guestb">💾 save it on your phone</span>' : ''}
        <div class="jgc-calls">${(r.callouts || []).slice(0, party ? 3 : 2).map((x) => `<span>${esc(x.icon)} ${esc(x.label)} <b>+${x.n}</b></span>`).join('')}</div></div>`).join('')}</div>
      <div class="jgc-tvfoot">${chest.more ? `<span>+${chest.more} more chests on their phones</span>` : ''}<span>Everyone earned <b data-sum>0</b> JG</span>${o.skip ? '<button data-jgc-skip>Skip ⏭ <small>(Enter)</small></button>' : ''}</div>`;
    document.body.appendChild(el);
    const fxc = el.querySelector('.jgc-fx'), fx = Fx(fxc), cells = [...el.querySelectorAll('[data-cell]')], sumEl = el.querySelector('[data-sum]');
    const c = cur = { id: chest.id, where: 'tv', el, raf: 0, timers: [] };
    const sk = el.querySelector('[data-jgc-skip]'); if (sk) sk.onclick = () => { if (o.skip) o.skip(); close(); };
    c.onKeys = (e) => { if ((e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') && o.skip) { e.preventDefault(); e.stopPropagation(); o.skip(); close(); } };
    addEventListener('keydown', c.onKeys, true);
    // Timeline: each chest appears, shakes, bursts, counts up (staggered left to right).
    const D = dur / 1000, gap = clamp((D * 0.35) / Math.max(1, n), 0.12, party ? 0.55 : 0.4), SH = RM ? 0.05 : party ? 1.1 : 0.8, CNT = party ? 2.2 : 1.6;
    const st = rows.map((r, i) => ({ r, t0: 0.4 + i * gap, open: false, shown: -1, cv: cells[i].querySelector('canvas'), num: cells[i].querySelector('[data-n]'), cell: cells[i], rattle: 0 }));
    let start = 0, last = 0, sum = 0, fanfare = false;
    const frame = (now) => {
      if (cur !== c) return;
      if (!start) start = now; const t = (now - start) / 1000, dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
      const fb = fxc.getBoundingClientRect(); let s2 = 0;
      for (const s of st) {
        const lt = t - s.t0; if (lt < 0) continue;
        if (!s.cell.classList.contains('on')) s.cell.classList.add('on');
        const g = s.cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2), w = s.cv.clientWidth, h = s.cv.clientHeight;
        if (s.cv.width !== Math.round(w * dpr)) { s.cv.width = Math.round(w * dpr); s.cv.height = Math.round(h * dpr); }
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
        const shake = lt < SH ? ease(lt / SH) : 0, open = lt >= SH ? ease((lt - SH) / 0.4) : 0, squash = lt >= SH && lt < SH + 0.22 ? Math.sin(((lt - SH) / 0.22) * Math.PI) : 0;
        const cw = Math.min(w * 0.62, h * 0.9); drawChest(g, w / 2, h * 0.92, cw, { tier: s.r.tier, open, t: t + s.t0, shake, squash, glow: open, glowR: Math.max(20, Math.min(w / 2, h * 0.92 - cw * 0.5)) });
        if (shake && lt - s.rattle > 0.3 && !RM) { s.rattle = lt; play(o, 'rattle'); }
        if (!s.open && lt >= SH) {
          s.open = true; s.cell.classList.add('opened'); play(o, party ? 'fanfare' : 'open');
          const b = s.cv.getBoundingClientRect(), x = b.left - fb.left + b.width / 2, y = b.top - fb.top + b.height * 0.55, T = TIERS[s.r.tier] || TIERS.wood;
          fx.burst(x, y, RM ? 6 : party ? 40 : 22, { up: true, spread: 1.5, speed: 520, colors: [T.glow, '#ffffff', '#ffd23f'], r: 7 });
          if (!RM) fx.burst(x, y, Math.min(T.coins, party ? 30 : 16), { kind: 'coin', up: true, spread: 1.3, speed: 640, r: 10, life: 1.3 });
        }
        const k = s.open ? ease((lt - SH) / CNT) : 0, v = Math.round(s.r.n * k);
        if (v !== s.shown) { s.shown = v; s.num.textContent = v; if (s.open && Math.random() < 0.5) play(o, 'coin'); }
        s2 += v;
      }
      if (s2 !== sum) { sum = s2; sumEl.textContent = sum; }
      if (!fanfare && st.length && st.every((s) => s.open) && t > st[st.length - 1].t0 + SH + CNT) { fanfare = true; play(o, 'done'); }
      if (!RM && st.some((s) => s.open) && Math.random() < dt * (party ? 2.4 : 0.6)) fx.burst(fx.W * (0.1 + Math.random() * 0.8), fx.H * (0.08 + Math.random() * 0.3), party ? 70 : 36, { colors: FIRE, speed: party ? 380 : 260, gravity: 220, r: party ? 6 : 4.5, life: 1.6 });
      if (party && !RM && Math.random() < dt * 8) fx.add({ kind: 'confetti', x: Math.random() * fx.W, y: -10, vx: (Math.random() - 0.5) * 60, vy: 120 + Math.random() * 120, t: 0, life: 4, r: 6 + Math.random() * 4, color: FIRE[Math.floor(Math.random() * FIRE.length)], g: 30, spin: Math.random() * 6 });
      fx.step(dt, fxc.getContext('2d'), t);
      if (t > D) { el.dataset.done = '1'; lastDone = { id: chest.id, where: 'tv', sum }; return close(); }
      c.raf = requestAnimationFrame(frame);
    };
    el.style.visibility = wait > 60 ? 'hidden' : '';
    c.timers.push(setTimeout(() => { el.style.visibility = ''; c.raf = requestAnimationFrame(frame); }, wait));
    return c;
  }

  window.JGChest = { TIERS, drawChest, drawCoin, phone, tv, close, styles, last: () => lastDone, active: () => (cur ? { id: cur.id, where: cur.where, guest: !!cur.guest } : null) };
})();
