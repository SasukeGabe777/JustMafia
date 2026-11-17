'use strict';
// JustFunny title screen: movie night in a cosy living room, seen from the TV. The card
// is the screen; its glow washes over the room. Friends on the couch crack up, popcorn
// pops out of the bucket, laughs and reactions float up, and someone votes to skip.
(function () {
  const TAU = Math.PI * 2;
  const REACTS = ['😂', '🤣', '😆', '👏', '💀', '😹', '🙈', '👍', '🍿'];
  const LAUGHS = ['HA!', 'HAHA', 'LOL', 'hehe', 'HA HA!', 'lmao'];
  const SKIN = ['#f5cfa8', '#c98d5e', '#8a5a3b', '#e9b48a', '#5c3a26', '#f1c27d', '#a86b45'];
  const HAIR = ['#2b1a12', '#e0a03a', '#7a2f1c', '#1d1d2a', '#c45a9a', '#3a2418', '#e8e4dc'];
  const SHIRT = ['#3fb6ff', '#ff6b8b', '#7ee081', '#ffb347', '#b48cff', '#ff5e5e', '#35d0b5'];
  const SEATS = [0.07, 0.19, 0.31, 0.5, 0.69, 0.81, 0.93];

  BOX.titles.funny = {
    logo: '<span class="a">Just</span><span class="b">Funny</span>',
    tagline: 'A watch party: take turns putting funny videos on the TV. Boring? Skip it!',
    start: '🍿 Start the watch party',
    meta: '2–100 players · 15–45 min',
    font: "'Luckiest Guy', cursive",
    theme: { card: 'rgba(18, 10, 32, 0.88)', ink: '#fff4e0', muted: '#ffd9c2', accent: '#ffd23f', button: '#ff4f6d', buttonInk: '#fff8f0', border: '#ffd23f' },
    css: `.bt-funny .bt-logo .a { display: block; color: #7fe3ff; font-size: 0.55em; letter-spacing: 0.12em; text-shadow: 0 4px 0 #1f4f7a; }
      .bt-funny .bt-logo .b { display: inline-block; color: #ffd23f; font-size: 1.2em; letter-spacing: 0.02em; text-shadow: 0 5px 0 #c2410c, 0 10px 0 #6b1d0a, 0 0 40px rgba(255, 210, 63, 0.45); animation: btFunnyWobble 2.8s ease-in-out infinite; }
      @keyframes btFunnyWobble { 0%, 100% { transform: rotate(-3deg) scale(1); } 50% { transform: rotate(2deg) scale(1.04); } }
      @media (prefers-reduced-motion: reduce) { .bt-funny .bt-logo .b { animation: none; transform: rotate(-2deg); } }
      .bt-funny .bt-card { border-width: 6px; border-radius: 26px; box-shadow: 0 0 0 10px #1b1424, 0 0 0 14px #3a2c4a, 0 18px 40px rgba(0, 0, 0, 0.55), 0 0 90px rgba(127, 227, 255, 0.35); }
      .bt-funny .bt-go { box-shadow: 0 7px 0 #8f1630; }`,
    init(W, H) {
      const rnd = (a, b) => a + Math.random() * (b - a);
      const s = Math.max(0.6, Math.min(W / 1600, H / 900));
      // Fairy lights hanging in two swags across the top.
      const bulbs = [];
      for (let i = 0; i < 26; i++) { const u = i / 25, x = u * W, sw = (u * 2) % 1, y = H * 0.035 + Math.sin(sw * Math.PI) * H * 0.07; bulbs.push({ x, y, hue: [48, 330, 190, 120, 20][i % 5], ph: rnd(0, TAU) }); }
      const people = SEATS.map((x, i) => ({ x, skin: SKIN[i % SKIN.length], hair: HAIR[(i * 3) % HAIR.length], shirt: SHIRT[i % SHIRT.length], style: i % 4, ph: rnd(0, TAU), sp: rnd(0.45, 0.75), sz: rnd(0.92, 1.08) }));
      const pop = Array.from({ length: 14 }, (_, i) => ({ ph: i / 14, vx: rnd(-70, 70), vy: rnd(380, 520), r: rnd(0, TAU) }));
      const floats = Array.from({ length: 16 }, (_, i) => ({ ph: i / 16, side: i % 2, x: rnd(0.02, 0.26), drift: rnd(0.7, 1.3), e: i % 3 === 2 ? null : REACTS[i % REACTS.length], word: LAUGHS[i % LAUGHS.length], sz: rnd(0.8, 1.25) }));
      const stripes = []; for (let x = 0; x < W; x += 46 * s) stripes.push(x);
      return { s, bulbs, people, pop, floats, stripes };
    },
    draw(g, W, H, t, S) {
      const s = S.s, cx = W / 2, cy = H * 0.46;
      // The TV's colour, drifting slowly (as if a video is playing).
      const hue = 195 + Math.sin(t * 0.35) * 60 + Math.sin(t * 0.13) * 30;
      // ---- Wall ----
      const wall = g.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, '#24133a'); wall.addColorStop(1, '#170c26'); g.fillStyle = wall; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.025)'; for (const x of S.stripes) g.fillRect(x, 0, 18 * s, H);
      // Glow from the TV (the card sits in the middle of it).
      const glow = g.createRadialGradient(cx, cy, 40 * s, cx, cy, Math.max(W, H) * 0.62);
      glow.addColorStop(0, `hsla(${hue}, 90%, 65%, 0.42)`); glow.addColorStop(0.45, `hsla(${hue}, 80%, 55%, 0.16)`); glow.addColorStop(1, 'hsla(0,0%,0%,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      // Floor lamp on the right with a warm cone of light.
      const lx = W * 0.9, ly = H * 0.33;
      const warm = g.createRadialGradient(lx, ly, 10 * s, lx, ly + 120 * s, 330 * s); warm.addColorStop(0, 'rgba(255,200,110,0.42)'); warm.addColorStop(1, 'rgba(255,170,80,0)');
      g.fillStyle = warm; g.fillRect(0, 0, W, H);
      g.strokeStyle = '#1a0f22'; g.lineWidth = 7 * s; g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx, H * 0.8); g.stroke();
      g.fillStyle = '#ffcf7a'; g.beginPath(); g.moveTo(lx - 34 * s, ly - 70 * s); g.lineTo(lx + 34 * s, ly - 70 * s); g.lineTo(lx + 56 * s, ly); g.lineTo(lx - 56 * s, ly); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,240,200,0.9)'; g.fillRect(lx - 56 * s, ly - 4 * s, 112 * s, 6 * s);
      // Framed picture on the left wall: a goofy cartoon face whose eyes follow the TV.
      const fx = W * 0.14, fy = H * 0.3, fw = 150 * s, fh = 120 * s;
      g.fillStyle = '#c98b3c'; g.fillRect(fx - fw / 2 - 10 * s, fy - fh / 2 - 10 * s, fw + 20 * s, fh + 20 * s);
      g.fillStyle = '#7fe3ff'; g.fillRect(fx - fw / 2, fy - fh / 2, fw, fh);
      g.fillStyle = '#7ee081'; g.beginPath(); g.moveTo(fx - fw / 2, fy + fh / 2); g.quadraticCurveTo(fx, fy + fh * 0.05, fx + fw / 2, fy + fh / 2); g.fill();
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(fx - fw * 0.25, fy - fh * 0.2, 16 * s, 0, TAU); g.fill();
      g.fillStyle = '#ff9fb2'; g.beginPath(); g.arc(fx + fw * 0.12, fy + fh * 0.05, 30 * s, 0, TAU); g.fill();
      const look = Math.sin(t * 0.7) * 3 * s;
      g.fillStyle = '#fff'; g.beginPath(); g.arc(fx + fw * 0.05, fy - 2 * s, 9 * s, 0, TAU); g.arc(fx + fw * 0.2, fy - 2 * s, 9 * s, 0, TAU); g.fill();
      g.fillStyle = '#1b1424'; g.beginPath(); g.arc(fx + fw * 0.05 + 3 * s + look, fy - 1 * s, 4 * s, 0, TAU); g.arc(fx + fw * 0.2 + 3 * s + look, fy - 1 * s, 4 * s, 0, TAU); g.fill();
      g.strokeStyle = '#1b1424'; g.lineWidth = 3 * s; g.beginPath(); g.arc(fx + fw * 0.12, fy + 12 * s, 11 * s, 0.2, Math.PI - 0.2); g.stroke();
      // ---- Curtains on both sides ----
      const curtain = (x0, dir) => {
        const cw = W * 0.075;
        for (let i = 0; i < 5; i++) {
          const x = x0 + dir * i * cw / 5, sway = Math.sin(t * 0.6 + i) * 3 * s;
          g.fillStyle = i % 2 ? '#7d1838' : '#9c2348'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + dir * cw / 5, 0);
          g.quadraticCurveTo(x + dir * (cw / 5 + cw * 0.5 * (i / 5)) + sway, H * 0.45, x + dir * cw / 5 + sway, H); g.lineTo(x + sway, H);
          g.quadraticCurveTo(x + dir * cw * 0.5 * (i / 5) + sway, H * 0.45, x, 0); g.fill();
        }
        g.fillStyle = '#ffd23f'; g.fillRect(dir > 0 ? x0 : x0 - cw * 0.9, H * 0.5, cw * 0.9, 12 * s);
      };
      curtain(0, 1); curtain(W, -1);
      g.fillStyle = '#4a2a18'; g.fillRect(0, 0, W, 10 * s);
      // ---- Fairy lights (slow, soft twinkle) ----
      g.strokeStyle = 'rgba(30,20,30,0.9)'; g.lineWidth = 2 * s; g.beginPath();
      S.bulbs.forEach((b, i) => (i ? g.lineTo(b.x, b.y) : g.moveTo(b.x, b.y))); g.stroke();
      for (const b of S.bulbs) {
        const a = 0.65 + 0.35 * Math.sin(t * 1.4 + b.ph);
        g.fillStyle = `hsla(${b.hue}, 100%, 70%, ${0.22 * a})`; g.beginPath(); g.arc(b.x, b.y + 10 * s, 17 * s, 0, TAU); g.fill();
        g.fillStyle = `hsla(${b.hue}, 100%, ${55 + a * 20}%, 1)`; g.beginPath(); g.ellipse(b.x, b.y + 10 * s, 6 * s, 9 * s, 0, 0, TAU); g.fill();
      }

      // ---- Floating laughs and reactions on both sides ----
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const f of S.floats) {
        const u = (t * 0.11 * f.drift + f.ph) % 1, x = (f.side ? 1 - f.x : f.x) * W + Math.sin(u * 9 + f.ph * 20) * 18 * s, y = H * 0.82 - u * H * 0.66;
        const a = u < 0.12 ? u / 0.12 : u > 0.8 ? (1 - u) / 0.2 : 1, sc = (0.7 + 0.3 * Math.min(1, u * 5)) * f.sz;
        g.globalAlpha = a;
        if (f.e) { g.font = `${Math.round(46 * s * sc)}px serif`; g.fillText(f.e, x, y); }
        else {
          g.font = `${Math.round(34 * s * sc)}px 'Luckiest Guy', cursive`; const w = g.measureText(f.word).width + 26 * s;
          g.save(); g.translate(x, y); g.rotate(Math.sin(f.ph * 30) * 0.18);
          g.fillStyle = '#fff4e0'; g.beginPath(); g.roundRect(-w / 2, -24 * s * sc, w, 46 * s * sc, 18 * s); g.fill();
          g.beginPath(); g.moveTo(-8 * s, 20 * s * sc); g.lineTo(-14 * s, 34 * s * sc); g.lineTo(4 * s, 20 * s * sc); g.fill();
          g.fillStyle = '#ff4f6d'; g.fillText(f.word, 0, 2 * s); g.restore();
        }
      }
      g.globalAlpha = 1;

      // ---- The couch and the audience ----
      const backY = H * 0.8, seatY = H * 0.93;
      g.fillStyle = '#c4532b'; g.beginPath(); g.roundRect(-20 * s, backY, W + 40 * s, H - backY + 20 * s, 40 * s); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 1; i < 4; i++) g.fillRect(W * i / 4 - 3 * s, backY + 20 * s, 6 * s, seatY - backY - 20 * s);
      for (const p of S.people) {
        const laugh = Math.max(0, Math.sin(t * p.sp + p.ph)), bob = Math.abs(Math.sin(t * 9 + p.ph)) * 7 * s * laugh, tilt = Math.sin(t * 4.5 + p.ph) * 0.08 * laugh;
        const x = p.x * W, sz = s * p.sz * 1.15, y = backY + 30 * s - bob;
        // Body.
        g.fillStyle = p.shirt; g.beginPath(); g.ellipse(x, y + 62 * sz, 58 * sz, 54 * sz, 0, Math.PI, TAU); g.fill(); g.fillRect(x - 58 * sz, y + 62 * sz, 116 * sz, 60 * sz);
        g.save(); g.translate(x, y); g.rotate(tilt);
        // TV light on the face: a cool rim on top of the skin colour.
        g.fillStyle = p.skin; g.beginPath(); g.arc(0, 0, 38 * sz, 0, TAU); g.fill();
        g.fillStyle = `hsla(${hue}, 90%, 70%, 0.18)`; g.beginPath(); g.arc(0, 0, 38 * sz, 0, TAU); g.fill();
        // Hair.
        g.fillStyle = p.hair; g.beginPath();
        if (p.style === 0) { g.arc(0, -4 * sz, 40 * sz, Math.PI * 1.05, Math.PI * 1.95); g.closePath(); }
        else if (p.style === 1) { for (let k = 0; k < 7; k++) { const a = Math.PI + k / 6 * Math.PI; g.moveTo(Math.cos(a) * 34 * sz, Math.sin(a) * 30 * sz - 6 * sz); g.arc(Math.cos(a) * 34 * sz, Math.sin(a) * 30 * sz - 6 * sz, 14 * sz, 0, TAU); } }
        else if (p.style === 2) { g.arc(0, -6 * sz, 40 * sz, Math.PI * 1.02, Math.PI * 1.98); g.closePath(); g.moveTo(14 * sz, -46 * sz); g.arc(0, -46 * sz, 14 * sz, 0, TAU); }
        else { g.arc(0, -10 * sz, 40 * sz, Math.PI, TAU); g.lineTo(46 * sz, -10 * sz); g.lineTo(-40 * sz, -10 * sz); g.closePath(); }
        g.fill();
        // Face: squeezed-shut laughing eyes and a big open mouth, or a calm smile.
        g.strokeStyle = '#1b1424'; g.lineWidth = 3.5 * sz; g.fillStyle = '#1b1424';
        if (laugh > 0.35) {
          g.beginPath(); g.moveTo(-18 * sz, -2 * sz); g.lineTo(-10 * sz, -8 * sz); g.lineTo(-2 * sz, -2 * sz); g.moveTo(2 * sz, -2 * sz); g.lineTo(10 * sz, -8 * sz); g.lineTo(18 * sz, -2 * sz); g.stroke();
          g.beginPath(); g.moveTo(-15 * sz, 8 * sz); g.lineTo(15 * sz, 8 * sz); g.arc(0, 8 * sz, 15 * sz, 0, Math.PI); g.fill();
          g.fillStyle = '#ff7a8a'; g.beginPath(); g.arc(0, 17 * sz, 6 * sz, Math.PI, TAU); g.fill();
          g.fillStyle = 'rgba(255,90,120,0.35)'; g.beginPath(); g.arc(-24 * sz, 8 * sz, 7 * sz, 0, TAU); g.arc(24 * sz, 8 * sz, 7 * sz, 0, TAU); g.fill();
        } else {
          g.beginPath(); g.arc(-10 * sz, -4 * sz, 4 * sz, 0, TAU); g.arc(10 * sz, -4 * sz, 4 * sz, 0, TAU); g.fill();
          g.beginPath(); g.arc(0, 6 * sz, 11 * sz, 0.3, Math.PI - 0.3); g.stroke();
        }
        g.restore();
      }
      // Two friends vote with paddles now and then: one wants to skip, one wants more.
      const vote = (i, emoji, ph, dir) => {
        const p = S.people[i], up = Math.max(0, Math.min(1, Math.sin(t * 0.5 + ph) * 3)), x = p.x * W + dir * 56 * s, y = backY + 20 * s - up * 90 * s;
        if (up <= 0) return;
        g.strokeStyle = '#7a4a22'; g.lineWidth = 6 * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 90 * s); g.stroke();
        g.fillStyle = '#fff4e0'; g.beginPath(); g.arc(x, y - 18 * s, 32 * s, 0, TAU); g.fill();
        g.strokeStyle = '#1b1424'; g.lineWidth = 3 * s; g.stroke();
        g.font = `${Math.round(36 * s)}px serif`; g.fillStyle = '#000'; g.fillText(emoji, x, y - 16 * s);
      };
      vote(0, '⏭️', 0, 1); vote(6, '👍', 2.2, -1);
      // Front seat cushion.
      g.fillStyle = '#a8401e'; g.beginPath(); g.roundRect(-20 * s, seatY, W + 40 * s, H - seatY + 30 * s, 26 * s); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, seatY + 6 * s, W, 4 * s);

      // ---- Popcorn bucket, bottom left, popping ----
      const bx = W * 0.25, by = H - 8 * s, bw = 120 * s, bh = 130 * s;
      g.fillStyle = '#fff1c8';
      for (const k of S.pop) {
        const u = (t * 0.55 + k.ph) % 1, tt = u * 1.3, x = bx + k.vx * tt * s, y = by - bh - 10 * s - (k.vy * tt - 420 * tt * tt) * s;
        if (y > by - bh + 10 * s) continue;
        g.save(); g.translate(x, y); g.rotate(k.r + t * 2);
        g.beginPath(); g.arc(-6 * s, 0, 9 * s, 0, TAU); g.arc(6 * s, -3 * s, 9 * s, 0, TAU); g.arc(1 * s, 7 * s, 8 * s, 0, TAU); g.fill(); g.restore();
      }
      // Heap on top.
      for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(bx - bw * 0.42 + i * bw * 0.105, by - bh - 4 * s + (i % 2) * 8 * s, 15 * s, 0, TAU); g.fill(); }
      g.save(); g.beginPath(); g.moveTo(bx - bw * 0.55, by - bh); g.lineTo(bx + bw * 0.55, by - bh); g.lineTo(bx + bw * 0.42, by); g.lineTo(bx - bw * 0.42, by); g.closePath(); g.clip();
      for (let i = -3; i <= 3; i++) { g.fillStyle = i % 2 ? '#e8323f' : '#fff4e0'; g.beginPath(); g.moveTo(bx + i * bw * 0.16 - bw * 0.08 * 1.1, by - bh); g.lineTo(bx + i * bw * 0.16 + bw * 0.08 * 1.1, by - bh); g.lineTo(bx + i * bw * 0.13 + bw * 0.065, by); g.lineTo(bx + i * bw * 0.13 - bw * 0.065, by); g.fill(); }
      g.restore();
            // A remote on the cushion, bottom right.
      g.save(); g.translate(W * 0.8, H - 30 * s); g.rotate(-0.25);
      g.fillStyle = '#26203a'; g.beginPath(); g.roundRect(-70 * s, -18 * s, 140 * s, 36 * s, 14 * s); g.fill();
      g.fillStyle = '#ff4f6d'; g.beginPath(); g.arc(-48 * s, 0, 8 * s, 0, TAU); g.fill();
      g.fillStyle = '#7fe3ff'; for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(-20 * s + i * 22 * s, 0, 6 * s, 0, TAU); g.fill(); }
      g.restore();
    },
  };
})();
