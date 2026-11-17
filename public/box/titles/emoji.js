'use strict';
// Emoji Charades title screen: a sunny, bouncy emoji world. A cheeky describer on the left
// pops clues into a speech bubble (emojis only), the thinker on the right puzzles it out
// and lights up when it clicks. An emoji keyboard scrolls along the top, emoji balls
// bounce along a candy hill at the bottom and stickers float up the sides.
(function () {
  const TAU = Math.PI * 2;
  const EFONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const CLUES = [
    [['🌧️', '🐱', '🐶'], 'Raining cats and dogs!'],
    [['⏰', '🪽'], 'Time flies!'],
    [['🧊', '🔨'], 'Break the ice!'],
    [['🐘', '🛋️'], 'Elephant in the room!'],
    [['🍿', '🎬', '🌙'], 'Movie night!'],
    [['🐝', '🦵'], "The bee's knees!"],
    [['🤖', '💃'], 'The robot dance!'],
    [['🌈', '🦄'], 'Rainbow unicorn!'],
  ];
  const KEYS = ['😂', '🥹', '😎', '🤯', '🥳', '😴', '🤠', '👻', '🐸', '🍕', '🎉', '🚀', '🌮', '🦖', '🍩', '🐙', '⚡', '🎸', '🧠', '💖'];
  const BOUNCE = ['😆', '🐵', '🍉', '😺', '🌟', '🐥', '😜', '🍭', '🤪', '🐳', '😋'];
  const FLOAT = ['❓', '❗', '💬', '✨', '💡', '🎯', '🤔', '😮'];
  const CYCLE = 4.6;
  // Emoji glyphs are slow to rasterise every frame, so each one is drawn once into a sprite.
  const sprites = new Map();
  function sprite(e) {
    let c = sprites.get(e);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = 128;
      const x = c.getContext('2d'); x.font = `100px ${EFONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 64, 70);
      sprites.set(e, c);
    }
    return c;
  }
  function spr(g, e, x, y, size, rot, sx, sy) {
    g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale((sx || 1) * size / 128, (sy || 1) * size / 128);
    g.drawImage(sprite(e), -64, -64); g.restore();
  }
  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const pop = (x) => { x = Math.min(1, Math.max(0, x)); return x >= 1 ? 1 : x <= 0 ? 0 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * TAU / 3) + 1; };
  // Rounded bubble with a little tail.
  function bubble(g, x, y, w, h, r, tx, ty, fill, line) {
    g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, r);
    g.moveTo(tx - r * 0.55, y + h / 2 - r * 0.3); g.lineTo(tx - r * 0.15, ty); g.lineTo(tx + r * 0.6, y + h / 2 - r * 0.3); g.closePath();
    g.strokeStyle = line; g.lineWidth = Math.max(6, r * 0.36); g.lineJoin = 'round'; g.stroke();
    g.fillStyle = fill; g.fill();
  }
  BOX.titles.emoji = {
    logo: '<span class="a"><i>E</i><i>m</i><i class="o">😜</i><i>j</i><i>i</i></span><span class="b">Charades</span>',
    tagline: 'Describe it with emojis only. The room shouts the answer. Fewer emojis, more points!',
    start: '🎉 Start the party',
    meta: '3–100 players · 10–25 min',
    font: "'Luckiest Guy', 'Lilita One', sans-serif",
    theme: { card: 'rgba(66, 22, 128, 0.9)', ink: '#ffffff', muted: '#ffe3fb', accent: '#ffe14d', button: '#ff4f9a', buttonInk: '#ffffff', border: '#ffffff' },
    css: `.bt-emoji .bt-logo { line-height: 1; }
      .bt-emoji .bt-logo .a { display: block; font-size: 1.12em; }
      .bt-emoji .bt-logo i { font-style: normal; display: inline-block; animation: emHop 1.8s ease-in-out infinite; -webkit-text-stroke: 3px #2a0a55; paint-order: stroke fill; text-shadow: 0 7px 0 #2a0a55; }
      .bt-emoji .bt-logo .a i:nth-child(1) { color: #ffe14d; animation-delay: 0s; }
      .bt-emoji .bt-logo .a i:nth-child(2) { color: #3ee0ff; animation-delay: .12s; }
      .bt-emoji .bt-logo .a i:nth-child(3) { animation-delay: .24s; font-size: .82em; -webkit-text-stroke: 0; text-shadow: 0 6px 0 rgba(0,0,0,.25); vertical-align: .06em; }
      .bt-emoji .bt-logo .a i:nth-child(4) { color: #7dff6b; animation-delay: .36s; }
      .bt-emoji .bt-logo .a i:nth-child(5) { color: #ff8a3d; animation-delay: .48s; }
      .bt-emoji .bt-logo .b { display: inline-block; margin-top: .06em; color: #ff4f9a; transform: rotate(-3deg); font-size: .78em; -webkit-text-stroke: 3px #2a0a55; paint-order: stroke fill; text-shadow: 0 6px 0 #2a0a55, 0 0 0 #fff; letter-spacing: .03em; }
      @keyframes emHop { 0%, 60%, 100% { transform: translateY(0) scale(1, 1); } 20% { transform: translateY(-.14em) scale(.94, 1.06); } 40% { transform: translateY(0) scale(1.08, .92); } }
      .bt-emoji .bt-card { box-shadow: 0 18px 0 rgba(42, 10, 85, .45), 0 0 0 10px rgba(255, 255, 255, .18); }
      .bt-emoji .bt-go { box-shadow: 0 7px 0 #a01a5c; }`,
    init(W, H) {
      const rnd = (a, b) => a + Math.random() * (b - a);
      const u = Math.max(0.6, Math.min(W / 1600, H / 900) * 1.0);
      const zone = Math.max(150, (W - 680) / 2); // free width beside the card
      const sideX = (i) => (i ? W - zone / 2 : zone / 2);
      FLOAT.concat(KEYS, BOUNCE, ['🤩', '😜', '🤔', '🧐', '🥳', '⭐']).forEach(sprite);
      CLUES.forEach(([c]) => c.forEach(sprite));
      return {
        u, zone, sideX,
        floaters: Array.from({ length: 14 }, (_, i) => ({ e: FLOAT[i % FLOAT.length], side: i % 2, fx: rnd(0.12, 0.88), y: rnd(0, H), v: rnd(14, 30) * u, s: rnd(30, 48) * u, ph: rnd(0, TAU) })),
        dots: Array.from({ length: 34 }, (_, i) => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(4, 10) * u, c: ['#ffffff', '#ff4f9a', '#3ee0ff', '#7dff6b', '#a46bff'][i % 5], ph: rnd(0, TAU) })),
        bouncers: Array.from({ length: 12 }, (_, i) => ({ e: BOUNCE[i % BOUNCE.length], fx: (i + 0.5) / 12, ph: rnd(0, 1), sp: rnd(0.8, 1.1), hgt: rnd(0.045, 0.085) })),
        sparks: Array.from({ length: 10 }, (_, i) => ({ a: (i / 10) * TAU + rnd(-0.2, 0.2), d: rnd(0.8, 1.2) })),
        wrapCache: new Map(),
      };
    },
    draw(g, W, H, t, S) {
      const u = S.u, cx = W / 2;
      // Sunny backdrop with slow, soft rays.
      const bg = g.createRadialGradient(cx, H * 0.45, 40 * u, cx, H * 0.45, Math.max(W, H) * 0.75);
      bg.addColorStop(0, '#fff07a'); bg.addColorStop(0.55, '#ffc23d'); bg.addColorStop(1, '#ff8a3d');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.save(); g.translate(cx, H * 0.45); g.rotate(t * 0.04); g.fillStyle = 'rgba(255,255,255,0.13)';
      const R = Math.max(W, H);
      for (let i = 0; i < 18; i++) { const a = (i / 18) * TAU; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a, a + TAU / 36); g.closePath(); g.fill(); }
      g.restore();
      // Confetti dots, breathing gently.
      for (const d of S.dots) { g.globalAlpha = 0.55 + 0.25 * Math.sin(t * 1.4 + d.ph); g.fillStyle = d.c; g.beginPath(); g.arc(d.x, d.y + Math.sin(t * 0.8 + d.ph) * 6 * u, d.r, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      // Floating stickers drifting up the sides.
      for (const f of S.floaters) {
        f.y -= f.v / 60; if (f.y < -60 * u) { f.y = H + 60 * u; f.fx = 0.12 + Math.random() * 0.76; }
        const x = f.side ? W - S.zone + f.fx * S.zone : f.fx * S.zone;
        g.globalAlpha = 0.55; spr(g, f.e, x + Math.sin(t * 1.1 + f.ph) * 14 * u, f.y, f.s, Math.sin(t * 0.9 + f.ph) * 0.3); g.globalAlpha = 1;
      }
      // Emoji keyboard scrolling along the top.
      const kh = 64 * u, ky = 18 * u, kw = kh + 10 * u, total = KEYS.length * kw;
      g.fillStyle = 'rgba(66,22,128,0.82)'; g.beginPath(); g.roundRect(-20, ky - 10 * u, W + 40, kh + 20 * u, 0); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, ky + kh + 10 * u - 4 * u, W, 4 * u);
      const off = (t * 40 * u) % total;
      for (let x0 = -off; x0 < W; x0 += total) {
        for (let i = 0; i < KEYS.length; i++) {
          const x = x0 + i * kw; if (x < -kw || x > W) continue;
          const press = Math.max(0, Math.sin(t * 2.2 - i * 0.9)) ** 12; // one key at a time dips
          g.fillStyle = '#2a0a55'; g.beginPath(); g.roundRect(x + 4 * u, ky + 5 * u, kh, kh, 14 * u); g.fill();
          g.fillStyle = press > 0.3 ? '#ffe14d' : '#ffffff'; g.beginPath(); g.roundRect(x + 4 * u, ky + press * 5 * u, kh, kh, 14 * u); g.fill();
          spr(g, KEYS[i], x + 4 * u + kh / 2, ky + press * 5 * u + kh / 2, kh * 0.72);
        }
      }
      // The round: clue pops in, the thinker ponders, then it clicks.
      const round = Math.floor(t / CYCLE), p = t - round * CYCLE;
      const [clue, answer] = CLUES[round % CLUES.length];
      const solved = p > 2.7;
      const zone = S.zone, lx = S.sideX(0), rx = S.sideX(1);
      const face = Math.min(150 * u, zone * 0.6), faceY = H * 0.6;
      // Describer: big cheeky face, leaning as it "talks".
      const talk = p < 2.7 ? Math.sin(t * 7) * 0.05 : Math.sin(t * 3) * 0.03;
      g.fillStyle = 'rgba(120,40,0,0.18)'; g.beginPath(); g.ellipse(lx, faceY + face * 0.6, face * 0.42, face * 0.08, 0, 0, TAU); g.fill();
      spr(g, solved ? '🥳' : '😜', lx, faceY + Math.sin(t * 2.2) * 8 * u, face, talk, 1 + Math.sin(t * 4.4) * 0.03, 1 - Math.sin(t * 4.4) * 0.03);
      // Speech bubble with the clue emojis.
      const n = clue.length, es = Math.min(62 * u, (zone * 0.86 - 30 * u) / n);
      const bw = n * es + 34 * u, bh = es + 30 * u, by = faceY - face * 0.62 - bh / 2 - 22 * u;
      const bs = pop(p / 0.6);
      g.save(); g.translate(lx, by + bh / 2 + 18 * u); g.scale(bs, bs); g.translate(-lx, -(by + bh / 2 + 18 * u));
      bubble(g, lx, by, bw, bh, 22 * u, lx - 10 * u, by + bh / 2 + 22 * u, '#ffffff', '#2a0a55');
      for (let i = 0; i < n; i++) {
        const k = ease((p - 0.25 - i * 0.28) / 0.3); if (k <= 0) continue;
        spr(g, clue[i], lx - (n * es) / 2 + es * (i + 0.5), by + Math.sin(t * 3 + i) * 3 * u, es * 0.86 * (0.4 + 0.6 * pop(k)), 0);
      }
      g.restore();
      // Thinker: puzzled, then delighted.
      g.fillStyle = 'rgba(120,40,0,0.18)'; g.beginPath(); g.ellipse(rx, faceY + face * 0.6, face * 0.42, face * 0.08, 0, 0, TAU); g.fill();
      const jump = solved ? Math.abs(Math.sin((p - 2.7) * 6)) * Math.max(0, 1 - (p - 2.7) / 1.4) * 34 * u : 0;
      spr(g, solved ? '🤩' : (p < 1.6 ? '🤔' : '🧐'), rx, faceY - jump + Math.sin(t * 1.8 + 1) * 6 * u, face, solved ? 0 : Math.sin(t * 1.3) * 0.12);
      // Thought bubble: "?" while thinking, the answer once solved.
      const tw = Math.min(zone * 0.88, 300 * u), th = 96 * u, ty = faceY - face * 0.62 - th / 2 - 34 * u;
      g.fillStyle = '#ffffff'; g.strokeStyle = '#2a0a55'; g.lineWidth = 4 * u;
      for (const [dx, dy, r] of [[-face * 0.18, face * 0.5 + 2 * u, 7], [-face * 0.05, face * 0.5 - 22 * u, 11]]) { g.beginPath(); g.arc(rx + dx, ty + th / 2 + dy - face * 0.4 + 18 * u, r * u, 0, TAU); g.fill(); g.stroke(); }
      g.beginPath(); g.roundRect(rx - tw / 2, ty - th / 2, tw, th, th / 2); g.fill(); g.stroke();
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (!solved) {
        g.fillStyle = '#a46bff'; g.font = `${Math.round(54 * u)}px 'Luckiest Guy', sans-serif`;
        for (let i = 0; i < 3; i++) { const b = Math.max(0, Math.sin(t * 5 - i * 0.9)) * 10 * u; g.fillText(i === 1 ? '?' : '·', rx + (i - 1) * 46 * u, ty + 6 * u - b); }
      } else {
        const k = pop((p - 2.7) / 0.5);
        g.save(); g.translate(rx, ty); g.scale(k, k);
        let fs = 30 * u; g.font = `${Math.round(fs)}px 'Luckiest Guy', sans-serif`;
        const words = answer.split(' '); let lines = [answer];
        if (g.measureText(answer).width > tw - 30 * u) { const h = Math.ceil(words.length / 2); lines = [words.slice(0, h).join(' '), words.slice(h).join(' ')]; }
        const wmax = Math.max(...lines.map((l) => g.measureText(l).width));
        if (wmax > tw - 30 * u) { fs *= (tw - 30 * u) / wmax; g.font = `${Math.round(fs)}px 'Luckiest Guy', sans-serif`; }
        g.fillStyle = '#ff4f9a';
        lines.forEach((l, i) => g.fillText(l, 0, (i - (lines.length - 1) / 2) * fs * 1.05 + 3 * u));
        g.restore();
        // Sparkle burst and a score pop.
        const sp = (p - 2.7) / 1.5;
        if (sp < 1) {
          for (const s of S.sparks) { const d = (40 + 110 * ease(sp)) * u * s.d; spr(g, '⭐', rx + Math.cos(s.a) * d, faceY + Math.sin(s.a) * d * 0.8, 26 * u * (1 - sp * 0.6), sp * 3); }
          g.globalAlpha = 1 - sp * sp; g.font = `${Math.round(46 * u)}px 'Luckiest Guy', sans-serif`;
          g.lineWidth = 6 * u; g.strokeStyle = '#2a0a55'; g.strokeText('+' + (4 - n), rx + face * 0.55, faceY - face * 0.3 - sp * 50 * u);
          g.fillStyle = '#7dff6b'; g.fillText('+' + (4 - n), rx + face * 0.55, faceY - face * 0.3 - sp * 50 * u); g.globalAlpha = 1;
        }
      }
      // Candy hill and the bouncing emoji balls.
      const gy = H * 0.93;
      g.fillStyle = '#a46bff'; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, gy + Math.sin(x / (140 * u) + t * 0.5) * 7 * u);
      g.lineTo(W, H); g.fill();
      g.fillStyle = '#7b3fe0'; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, gy + 20 * u + Math.sin(x / (110 * u) - t * 0.4 + 2) * 6 * u);
      g.lineTo(W, H); g.fill();
      const bs2 = 58 * u;
      for (const b of S.bouncers) {
        const x = b.fx * W, ph = (t * b.sp + b.ph) % 1;
        const air = Math.sin(ph * Math.PI); // 0 on the ground, 1 at the top
        const squash = ph < 0.1 || ph > 0.9 ? 1 - Math.abs(Math.cos(ph * Math.PI)) : 1;
        const sy = 0.78 + 0.22 * Math.min(1, squash * 3 + air), sx = 2 - sy;
        const ground = gy + Math.sin(x / (140 * u) + t * 0.5) * 7 * u;
        g.fillStyle = 'rgba(42,10,85,0.25)'; g.beginPath(); g.ellipse(x, ground + 2 * u, bs2 * 0.36 * (1 - air * 0.4), 6 * u, 0, 0, TAU); g.fill();
        spr(g, b.e, x, ground - bs2 * 0.42 * sy - air * b.hgt * H, bs2, (ph - 0.5) * 0.5, sx, sy);
      }
    },
  };
})();
