'use strict';
// Most Likely To… title screen: an awards night. Velvet curtains, sweeping spotlights and
// a marquee announcing tonight's award. The nominees line up on stage, ballots fly to the
// winner, a crown floats down onto their head and gold confetti rains.
(function () {
  const TAU = Math.PI * 2;
  const AWARDS = ['befriend a pigeon', 'cry at a commercial', 'start a conga line', 'talk to their plants', 'get lost in a mall', 'eat dessert first', 'become famous by accident', 'win a staring contest with a cat'];
  const COLS = [['#ff6b8b', '#ffc2cf'], ['#5ec8ff', '#c4ecff'], ['#ffb43c', '#ffe2a8'], ['#8be06b', '#d4f7c4'], ['#b07cff', '#e2d0ff'], ['#ff8a4d', '#ffd2b8'], ['#3fe0c5', '#bff6ec'], ['#ff7ad9', '#ffd0f2']];
  const CYCLE = 6.2;
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const ease = (x) => 1 - Math.pow(1 - clamp01(x), 3);
  function curtain(w, h, flip) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, w, 0), folds = 6;
    for (let i = 0; i <= folds * 4; i++) { const k = i / (folds * 4), s = 0.5 + 0.5 * Math.sin(k * folds * TAU); gr.addColorStop(k, `hsl(${348 + s * 4} ${70 + s * 10}% ${12 + s * 22}%)`); }
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    // Shade toward the stage side and gold trim on the inner edge.
    const sh = x.createLinearGradient(0, 0, w, 0); sh.addColorStop(flip ? 1 : 0, 'rgba(0,0,0,0)'); sh.addColorStop(flip ? 0 : 1, 'rgba(0,0,0,0.45)');
    x.fillStyle = sh; x.fillRect(0, 0, w, h);
    x.fillStyle = '#e9b53c'; x.fillRect(flip ? 0 : w - Math.max(4, w * 0.04), 0, Math.max(4, w * 0.04), h);
    return c;
  }
  function valance(w, h) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h * 1.4));
    const x = c.getContext('2d'), n = Math.max(6, Math.round(w / (h * 1.6))), sw = w / n;
    const gr = x.createLinearGradient(0, 0, 0, h * 1.3); gr.addColorStop(0, '#3d0616'); gr.addColorStop(1, '#a3163c');
    x.fillStyle = gr; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, 0);
    for (let i = n; i > 0; i--) { x.lineTo(i * sw, h); x.quadraticCurveTo((i - 0.5) * sw, h * 1.4, (i - 1) * sw, h); }
    x.closePath(); x.fill();
    x.strokeStyle = '#e9b53c'; x.lineWidth = Math.max(3, h * 0.07); x.beginPath(); x.moveTo(w, h);
    for (let i = n; i > 0; i--) x.quadraticCurveTo((i - 0.5) * sw, h * 1.4 - x.lineWidth, (i - 1) * sw, h);
    x.stroke();
    x.fillStyle = '#e9b53c'; for (let i = 0; i < n; i++) { x.beginPath(); x.arc((i + 0.5) * sw, h * 1.2, h * 0.09, 0, TAU); x.fill(); }
    return c;
  }
  function crown(g, x, y, s) {
    g.save(); g.translate(x, y); g.scale(s, s);
    g.fillStyle = '#ffd54a'; g.strokeStyle = '#8a5a00'; g.lineWidth = 3; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(-30, 0); g.lineTo(-34, -30); g.lineTo(-16, -14); g.lineTo(0, -38); g.lineTo(16, -14); g.lineTo(34, -30); g.lineTo(30, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffea8a'; g.beginPath(); g.roundRect(-31, -6, 62, 10, 4); g.fill(); g.stroke();
    g.fillStyle = '#ff3d6e'; g.beginPath(); g.arc(0, -1, 4, 0, TAU); g.fill();
    g.fillStyle = '#4fd7ff'; g.beginPath(); g.arc(-17, -1, 3, 0, TAU); g.arc(17, -1, 3, 0, TAU); g.fill();
    g.fillStyle = '#fff'; for (const [px, py] of [[-34, -30], [0, -38], [34, -30]]) { g.beginPath(); g.arc(px, py, 4, 0, TAU); g.fill(); }
    g.restore();
  }
  BOX.titles.likely = {
    logo: '<span class="cr">👑</span><span class="a">Most Likely</span><span class="b">To…</span>',
    tagline: 'Vote who in the room fits the prompt. Winners collect ridiculous titles (and crowns).',
    start: '🏆 Open the ceremony',
    meta: '3–100 players · 5–15 min',
    font: "'Abril Fatface', serif",
    theme: { card: 'rgba(46, 5, 24, 0.9)', ink: '#fff3d6', muted: '#f6d3a6', accent: '#ffd54a', button: '#ffcf3f', buttonInk: '#4b0a1f', border: '#e9b53c' },
    css: `.bt-likely .bt-logo { line-height: .95; position: relative; padding-top: .28em; }
      .bt-likely .bt-logo .cr { position: absolute; left: 50%; top: -.12em; font-size: .5em; transform: translateX(-50%) rotate(-8deg); animation: lkCrown 3s ease-in-out infinite; text-shadow: none; }
      .bt-likely .bt-logo .a, .bt-likely .bt-logo .b { display: block; background: linear-gradient(180deg, #fff6c4 0%, #ffd54a 45%, #d9900f 70%, #ffe27a 100%); -webkit-background-clip: text; background-clip: text; color: transparent; text-shadow: none; filter: drop-shadow(0 5px 0 #5a0b22); }
      .bt-likely .bt-logo .a { font-size: .74em; letter-spacing: .02em; }
      .bt-likely .bt-logo .b { font-size: 1.35em; font-style: italic; }
      @keyframes lkCrown { 0%, 100% { transform: translateX(-50%) translateY(0) rotate(-8deg); } 50% { transform: translateX(-50%) translateY(-.12em) rotate(6deg); } }
      .bt-likely .bt-card { box-shadow: 0 18px 0 rgba(0,0,0,.35), 0 0 0 3px #5a0b22, 0 0 70px rgba(255, 213, 74, .3); }
      .bt-likely .bt-go { background: linear-gradient(180deg, #ffe58a, #ffc21f); box-shadow: 0 7px 0 #8a5a00; font-family: 'Abril Fatface', serif; }`,
    init(W, H) {
      const rnd = (a, b) => a + Math.random() * (b - a);
      const u = Math.max(0.6, Math.min(W / 1600, H / 900));
      const cw = Math.max(70, W * 0.085), vh = Math.max(36, H * 0.07);
      const n = 8, x0 = cw + 50 * u, x1 = W - cw - 50 * u;
      const order = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
      const signH = Math.max(64 * u, Math.min(130 * u, (H - 560) / 2 - 10 * u));
      return {
        u, cw, vh, signH,
        curL: curtain(cw, H, false), curR: curtain(cw, H, true), val: valance(W, vh),
        people: Array.from({ length: n }, (_, i) => ({ x: x0 + (x1 - x0) * (i / (n - 1)), col: COLS[i], ph: rnd(0, TAU), h: rnd(0.9, 1.1) })),
        order,
        confetti: Array.from({ length: 46 }, (_, i) => ({ x: rnd(0, 1), y: rnd(0, H), v: rnd(30, 70) * u, w: rnd(6, 11) * u, ph: rnd(0, TAU), sp: rnd(2, 5), col: ['#ffd54a', '#fff3d6', '#ff6b8b', '#ffb43c'][i % 4] })),
        burst: Array.from({ length: 22 }, (_, i) => ({ a: -Math.PI / 2 + rnd(-1.2, 1.2), v: rnd(220, 420) * u, col: ['#ffd54a', '#fff3d6', '#ff6b8b', '#5ec8ff'][i % 4], r: rnd(0, TAU) })),
        bulbs: 0,
      };
    },
    draw(g, W, H, t, S) {
      const u = S.u, P = S.people, n = P.length;
      const round = Math.floor(t / CYCLE), p = t - round * CYCLE;
      const win = S.order[round % n], wp = P[win];
      const runner = S.order[(round + 3) % n];
      const award = AWARDS[round % AWARDS.length];
      const floorY = H * 0.8, feet = H * 0.975;
      // Back wall: deep velvet dark with a warm glow behind the card.
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#22030f'); bg.addColorStop(0.75, '#3c0719'); bg.addColorStop(1, '#16020a');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      const glow = g.createRadialGradient(W / 2, H * 0.48, 0, W / 2, H * 0.48, W * 0.5); glow.addColorStop(0, 'rgba(255,190,90,0.28)'); glow.addColorStop(1, 'rgba(255,190,90,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      // Starry backdrop dots.
      g.fillStyle = 'rgba(255,220,150,0.35)';
      for (let i = 0; i < 40; i++) { const sx = ((i * 197.3) % 1) * W + ((i * 7919) % W), sy = ((i * 131) % (floorY * 0.9)); g.globalAlpha = 0.25 + 0.2 * Math.sin(t * 0.9 + i); g.beginPath(); g.arc(sx % W, sy + 30 * u, 2.2 * u, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      // Stage floor.
      const fl = g.createLinearGradient(0, floorY, 0, H); fl.addColorStop(0, '#6b2a12'); fl.addColorStop(1, '#2a0d05');
      g.fillStyle = fl; g.fillRect(0, floorY, W, H - floorY);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
      for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(W / 2 + i * W * 0.05, floorY); g.lineTo(W / 2 + i * W * 0.12, H); g.stroke(); }
      g.fillStyle = '#e9b53c'; g.fillRect(0, floorY - 3 * u, W, 6 * u);
      // Spotlights: sweep lazily, then both lock onto the winner when the crown drops.
      const lock = ease((p - 2.2) / 0.8) * (1 - ease((p - 5.6) / 0.6));
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 2; k++) {
        const sx = k ? W * 0.82 : W * 0.18, sy = -20 * u;
        const free = W * (k ? 0.68 : 0.32) + Math.sin(t * 0.5 + k * 2.1) * W * 0.22;
        const tx = free + (wp.x - free) * lock, ty = feet;
        const ang = Math.atan2(ty - sy, tx - sx), len = Math.hypot(tx - sx, ty - sy), spread = 90 * u;
        const cone = g.createLinearGradient(sx, sy, tx, ty); cone.addColorStop(0, 'rgba(255,240,190,0.28)'); cone.addColorStop(1, 'rgba(255,240,190,0.06)');
        g.fillStyle = cone; g.save(); g.translate(sx, sy); g.rotate(ang);
        g.beginPath(); g.moveTo(0, -10 * u); g.lineTo(len, -spread); g.lineTo(len, spread); g.lineTo(0, 10 * u); g.closePath(); g.fill(); g.restore();
        g.fillStyle = 'rgba(255,240,190,0.16)'; g.beginPath(); g.ellipse(tx, ty - 4 * u, spread * 1.05, 18 * u, 0, 0, TAU); g.fill();
      }
      g.restore();
      // Curtains (gently swaying) and the scalloped valance.
      const sway = Math.sin(t * 0.7) * 0.012;
      g.save(); g.transform(1, 0, sway, 1, 0, 0); g.drawImage(S.curL, -sway * H * 0.5 - 2, 0); g.restore();
      g.save(); g.transform(1, 0, -sway, 1, 0, 0); g.drawImage(S.curR, W - S.cw + sway * H * 0.5 + 2, 0); g.restore();
      // Tie-backs.
      g.fillStyle = '#e9b53c';
      g.beginPath(); g.ellipse(S.cw * 0.7, H * 0.55, 10 * u, 22 * u, 0.4, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(W - S.cw * 0.7, H * 0.55, 10 * u, 22 * u, -0.4, 0, TAU); g.fill();
      g.drawImage(S.val, 0, 0);
      // Nominees.
      for (let i = 0; i < n; i++) {
        const q = P[i]; q.feet = feet;
        const isWin = i === win, celebrate = isWin && p > 3.3 && p < 5.8;
        const hop = celebrate ? Math.abs(Math.sin((p - 3.3) * 5.5)) * 26 * u : 0;
        const bob = Math.sin(t * 2 + q.ph) * 3 * u;
        const bh = 112 * u * q.h, bw = 74 * u, x = q.x, top = feet - bh - hop + bob;
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, feet, bw * 0.55 * (1 - hop / (80 * u)), 8 * u, 0, 0, TAU); g.fill();
        // Body.
        g.fillStyle = q.col[0]; g.beginPath(); g.roundRect(x - bw / 2, top, bw, bh, [bw / 2, bw / 2, 16 * u, 16 * u]); g.fill();
        g.fillStyle = q.col[1]; g.beginPath(); g.ellipse(x, top + bh * 0.76, bw * 0.3, bh * 0.17, 0, 0, TAU); g.fill();
        // Little bow tie for the ceremony.
        g.fillStyle = '#1a0610'; g.beginPath(); g.moveTo(x, top + bh * 0.53); g.lineTo(x - 12 * u, top + bh * 0.47); g.lineTo(x - 12 * u, top + bh * 0.59); g.closePath(); g.moveTo(x, top + bh * 0.53); g.lineTo(x + 12 * u, top + bh * 0.47); g.lineTo(x + 12 * u, top + bh * 0.59); g.closePath(); g.fill();
        // Arms: everyone points at the winner while voting; the winner throws theirs up.
        g.strokeStyle = q.col[0]; g.lineWidth = 11 * u; g.lineCap = 'round';
        const voting = p > 0.6 && p < 3.2 && !isWin;
        const dir = Math.sign(wp.x - x) || 1;
        g.beginPath();
        if (celebrate) { g.moveTo(x - bw * 0.42, top + bh * 0.5); g.lineTo(x - bw * 0.72, top + bh * 0.12); g.moveTo(x + bw * 0.42, top + bh * 0.5); g.lineTo(x + bw * 0.72, top + bh * 0.12); }
        else if (voting) { g.moveTo(x + dir * bw * 0.42, top + bh * 0.52); g.lineTo(x + dir * bw * 0.85, top + bh * 0.38); g.moveTo(x - dir * bw * 0.42, top + bh * 0.55); g.lineTo(x - dir * bw * 0.55, top + bh * 0.78); }
        else { g.moveTo(x - bw * 0.42, top + bh * 0.55); g.lineTo(x - bw * 0.55, top + bh * 0.8); g.moveTo(x + bw * 0.42, top + bh * 0.55); g.lineTo(x + bw * 0.55, top + bh * 0.8); }
        g.stroke();
        // Face: eyes look at the winner.
        const look = isWin ? Math.sin(t * 1.3) * 0.5 : Math.max(-1, Math.min(1, (wp.x - x) / (W * 0.15)));
        const ey = top + bh * 0.24;
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - 13 * u, ey, 9 * u, 11 * u, 0, 0, TAU); g.ellipse(x + 13 * u, ey, 9 * u, 11 * u, 0, 0, TAU); g.fill();
        g.fillStyle = '#1a0610'; g.beginPath(); g.arc(x - 13 * u + look * 4 * u, ey + 2 * u, 5 * u, 0, TAU); g.arc(x + 13 * u + look * 4 * u, ey + 2 * u, 5 * u, 0, TAU); g.fill();
        g.strokeStyle = '#1a0610'; g.lineWidth = 3.5 * u; g.beginPath();
        if (celebrate) { g.fillStyle = '#5a0b22'; g.arc(x, top + bh * 0.36, 10 * u, 0, Math.PI); g.closePath(); g.fill(); }
        else { g.arc(x, top + bh * 0.33, 9 * u, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
        q.top = top;
      }
      // Ballots: each voter tosses one at the winner (a couple go to a runner-up).
      let votes = 0;
      for (let i = 0, k = 0; i < n; i++) {
        if (i === win) continue;
        k++;
        const toRunner = runner !== win && i !== runner && (k === 2 || k === 5), to = toRunner ? P[runner] : wp;
        const s0 = 0.7 + k * 0.22, q = (p - s0) / 0.75;
        if (q >= 1 && !toRunner) votes++;
        if (q <= 0 || q >= 1) continue;
        const a = P[i], e = ease(q);
        const bx = a.x + (to.x - a.x) * e, byy = a.top + 20 * u + (to.top - a.top) * e - Math.sin(q * Math.PI) * 120 * u;
        g.save(); g.translate(bx, byy); g.rotate(q * 6);
        g.fillStyle = '#fff3d6'; g.fillRect(-13 * u, -9 * u, 26 * u, 18 * u);
        g.strokeStyle = '#d12a52'; g.lineWidth = 3 * u; g.beginPath(); g.moveTo(-6 * u, 0); g.lineTo(-1 * u, 5 * u); g.lineTo(8 * u, -5 * u); g.stroke();
        g.restore();
      }
      // Vote tally above the winner.
      if (votes > 0 && p < 5.9) {
        const by = wp.top - 6 * u;
        g.fillStyle = '#5a0b22'; g.beginPath(); g.arc(wp.x + 50 * u, by + 33 * u, 19 * u, 0, TAU); g.fill();
        g.fillStyle = '#ffd54a'; g.beginPath(); g.arc(wp.x + 50 * u, by + 30 * u, 19 * u, 0, TAU); g.fill();
        g.fillStyle = '#4b0a1f'; g.font = `${Math.round(22 * u)}px 'Abril Fatface', serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(votes), wp.x + 50 * u, by + 31 * u);
      }
      // The crown floats down and settles on the winner's head.
      if (p > 2.3 && p < 6.0) {
        const d = ease((p - 2.3) / 1.0), fade = 1 - clamp01((p - 5.7) / 0.3);
        const cy = -60 * u + (wp.top + 4 * u - -60 * u) * d;
        g.globalAlpha = fade;
        g.fillStyle = 'rgba(255,213,74,0.25)'; g.beginPath(); g.arc(wp.x, cy - 16 * u, 46 * u * (0.6 + 0.4 * Math.sin(t * 3) ** 2), 0, TAU); g.fill();
        crown(g, wp.x, cy, 1.15 * u * (1 + 0.05 * Math.sin(t * 4)));
        g.globalAlpha = 1;
      }
      // Gold confetti: a gentle drizzle on the sides, a burst over the winner.
      for (const c of S.confetti) {
        c.y += c.v / 60; if (c.y > floorY) { c.y = -20 * u; c.x = Math.random(); }
        const side = c.x < 0.5 ? c.x * 2 * (W * 0.28) : W - (c.x - 0.5) * 2 * (W * 0.28);
        g.save(); g.translate(side + Math.sin(t + c.ph) * 18 * u, c.y); g.rotate(t * 0.8 + c.ph); g.scale(1, Math.cos(t * c.sp + c.ph));
        g.fillStyle = c.col; g.fillRect(-c.w / 2, -c.w * 0.3, c.w, c.w * 0.6); g.restore();
      }
      const bt = p - 3.3;
      if (bt > 0 && bt < 1.8) {
        g.globalAlpha = 1 - bt / 1.8;
        for (const b of S.burst) {
          const x = wp.x + Math.cos(b.a) * b.v * bt, y = wp.top + Math.sin(b.a) * b.v * bt + 260 * u * bt * bt;
          g.save(); g.translate(x, y); g.rotate(b.r + bt * 8); g.fillStyle = b.col; g.fillRect(-6 * u, -3 * u, 12 * u, 6 * u); g.restore();
        }
        g.globalAlpha = 1;
      }
      // Marquee sign announcing tonight's award, with softly chasing bulbs.
      const sw = Math.min(W * 0.5, 620 * u), sh = S.signH, sx = W / 2 - sw / 2, sy = S.vh * 0.35;
      g.fillStyle = '#5a0b22'; g.beginPath(); g.roundRect(sx - 6 * u, sy - 6 * u + 6 * u, sw + 12 * u, sh + 12 * u, 22 * u); g.fill();
      g.fillStyle = '#e9b53c'; g.beginPath(); g.roundRect(sx - 6 * u, sy - 6 * u, sw + 12 * u, sh + 12 * u, 22 * u); g.fill();
      g.fillStyle = '#2a0412'; g.beginPath(); g.roundRect(sx + 8 * u, sy + 8 * u, sw - 16 * u, sh - 16 * u, 14 * u); g.fill();
      const per = 2 * (sw + sh), nb = Math.floor(per / (26 * u));
      for (let i = 0; i < nb; i++) {
        let d = (i / nb) * per, bx, by;
        if (d < sw) { bx = sx + d; by = sy; } else if ((d -= sw) < sh) { bx = sx + sw; by = sy + d; } else if ((d -= sh) < sw) { bx = sx + sw - d; by = sy + sh; } else { d -= sw; bx = sx; by = sy + sh - d; }
        const lit = 0.55 + 0.45 * Math.sin(t * 2.5 - i * 0.6);
        g.fillStyle = `rgba(255,${200 + 40 * lit | 0},${120 + 80 * lit | 0},${0.45 + 0.55 * lit})`; g.beginPath(); g.arc(bx, by, 4.2 * u, 0, TAU); g.fill();
      }
      const fadeIn = ease(p / 0.5) * (1 - clamp01((p - CYCLE + 0.35) / 0.35));
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#f6d3a6'; g.font = `${Math.round(Math.min(18 * u, sh * 0.17))}px 'Nunito', sans-serif`;
      g.fillText('★  TONIGHT’S AWARD: MOST LIKELY TO…  ★', W / 2, sy + sh * 0.3);
      let fs = Math.min(40 * u, sh * 0.36); g.font = `italic ${Math.round(fs)}px 'Abril Fatface', serif`;
      const tw = g.measureText(award).width; if (tw > sw - 50 * u) { fs *= (sw - 50 * u) / tw; g.font = `italic ${Math.round(fs)}px 'Abril Fatface', serif`; }
      g.globalAlpha = fadeIn; g.fillStyle = '#ffd54a'; g.fillText(award, W / 2, sy + sh * 0.64 + (1 - fadeIn) * 8 * u); g.globalAlpha = 1;
    },
  };
})();
