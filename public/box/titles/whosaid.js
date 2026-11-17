'use strict';
// Who Said It? title screen: a hushed, starry night crowd. Anonymous confessions float up in
// pastel speech bubbles from a row of silhouettes, neighbours whisper "psst…" to each other,
// a sleepy crescent moon keeps the secret, and every few seconds the crowd's guess lands on
// someone: a "?" hovers over their head, then flips to "!" as they light up.
(function () {
  const TAU = Math.PI * 2;
  const SAYS = [
    ['I still sleep', 'with a nightlight'], ['I can whistle', 'through my nose'], ['I once got lost', 'in a corn maze', 'for 3 hours'],
    ['I’ve never', 'eaten a taco'], ['My first crush', 'was a cartoon fox'], ['I talk to', 'my houseplants'], ['I’m secretly', 'scared of ducks'],
    ['I cried at a', 'car commercial'], ['I can’t ride', 'a bike'], ['I named my car', 'Gerald'], ['???'], ['psst… it', 'was me'],
    ['I’ve eaten cereal', 'with orange juice'], ['I know every word', 'to a sea shanty'],
  ];
  const BUB = ['#fff3b0', '#c8f7e8', '#ffd6ec', '#e3d6ff', '#cfe9ff', '#ffe0c2'];
  const RIM = ['#9b7bff', '#7ef3d0', '#ff7ac8', '#ffd36e', '#6ec8ff'];
  const GUESS = 4.8, DASH = [2, 10], NODASH = [];
  const ease = (k) => 1 - Math.pow(1 - k, 3);
  const pop = (k) => (k >= 1 ? 1 : 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2));

  BOX.titles.whosaid = {
    logo: '<span class="a">Who Said</span> <span class="b">It<span class="q">?</span></span>',
    tagline: 'Everyone secretly answers a personal question. Read the answers out, then guess who wrote each one.',
    start: '🤫 Start whispering',
    meta: '3–100 players · 10–20 min',
    font: "'Caveat Brush', 'Lilita One', cursive",
    theme: { card: 'rgba(32, 16, 70, 0.88)', ink: '#fdf3ff', muted: '#dccdff', accent: '#7ef3d0', button: '#ff7ac8', buttonInk: '#2b0a3d', border: '#9b7bff' },
    css: `.bt-whosaid .bt-logo { font-size: clamp(56px, 7.2vw, 108px); line-height: 0.95; }
      .bt-whosaid .bt-logo .a { display: inline-block; color: #fdf3ff; transform: rotate(-4deg); text-shadow: 0 5px 0 #4b2a8f, 0 0 30px rgba(155, 123, 255, 0.6); }
      .bt-whosaid .bt-logo .b { display: inline-block; color: #7ef3d0; transform: rotate(3deg); text-shadow: 0 5px 0 #1d5e63; }
      .bt-whosaid .bt-logo .q { display: inline-block; margin-left: 0.04em; color: #ff7ac8; font-size: 1.3em; line-height: 0.7; transform-origin: 50% 85%; text-shadow: 0 5px 0 #8a1f5c; animation: btWsQ 3.2s ease-in-out infinite; }
      @keyframes btWsQ { 0%, 100% { transform: rotate(-10deg); } 50% { transform: rotate(12deg) translateY(-0.04em); } }
      .bt-whosaid .bt-card { border-radius: 34px 34px 34px 8px; box-shadow: 0 16px 0 rgba(10, 4, 30, 0.45), 0 0 70px rgba(155, 123, 255, 0.35); }
      .bt-whosaid .bt-go { font-size: clamp(30px, 3vw, 40px); padding: 10px 34px; }
      .bt-whosaid .bt-tag { font-family: 'Fredoka', sans-serif; font-weight: 500; }`,
    init(W, H) {
      const rnd = (a, b) => a + Math.random() * (b - a);
      const cardW = Math.min(640, W * 0.92), side = Math.max(150, (W - cardW) / 2 - 20);
      const sc = Math.max(0.45, Math.min(3, H / 900, side / 420));
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      // Sky, stars and the horizon glow, drawn once.
      const sky = document.createElement('canvas'); sky.width = Math.max(1, Math.round(W * dpr)); sky.height = Math.max(1, Math.round(H * dpr));
      const sg = sky.getContext('2d'); sg.scale(dpr, dpr);
      const gr = sg.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#120a34'); gr.addColorStop(0.55, '#2a1663'); gr.addColorStop(1, '#3b2a7a'); sg.fillStyle = gr; sg.fillRect(0, 0, W, H);
      const hz = sg.createRadialGradient(W / 2, H * 1.1, 0, W / 2, H * 1.1, Math.max(W, H) * 0.7); hz.addColorStop(0, 'rgba(126,243,208,0.35)'); hz.addColorStop(1, 'rgba(126,243,208,0)'); sg.fillStyle = hz; sg.fillRect(0, 0, W, H);
      for (let i = 0; i < 160; i++) { sg.fillStyle = `rgba(255,255,255,${rnd(0.15, 0.6)})`; sg.beginPath(); sg.arc(rnd(0, W), rnd(0, H * 0.7), rnd(0.6, 1.6) * Math.max(1, sc), 0, TAU); sg.fill(); }
      // The crowd: silhouettes along the bottom, some with hair or hats.
      const sp = 112 * sc, n = Math.ceil(W / sp) + 1;
      const heads = Array.from({ length: n }, (_, i) => ({ x: (i + 0.25 + Math.random() * 0.5) * (W / n), s: rnd(0.88, 1.15), ph: rnd(0, TAU), style: (i * 3) % 5, rim: RIM[i % RIM.length] }));
      const sideHeads = heads.filter((h) => h.x < side - 20 * sc || h.x > W - side + 20 * sc);
      // Crescent moon sprite: a disc with a bite taken out.
      const mr = 58 * sc, moon = document.createElement('canvas'); moon.width = moon.height = Math.max(2, Math.round(mr * 2 * dpr));
      const mg = moon.getContext('2d'); mg.scale(moon.width / 2 / mr, moon.width / 2 / mr);
      mg.fillStyle = '#fff2c4'; mg.beginPath(); mg.arc(mr, mr, mr, 0, TAU); mg.fill();
      mg.globalCompositeOperation = 'destination-out'; mg.beginPath(); mg.arc(mr * 1.62, mr * 0.78, mr * 0.84, 0, TAU); mg.fill();
      return {
        sc, side, sky, moon, heads, sideHeads: sideHeads.length ? sideHeads : heads,
        f: {
          bub: `${Math.round(30 * sc)}px 'Caveat Brush', cursive`, q: `${Math.round(60 * sc)}px 'Caveat Brush', cursive`,
          big: `${Math.round(130 * sc)}px 'Caveat Brush', cursive`, psst: `${Math.round(26 * sc)}px 'Caveat Brush', cursive`,
        },
        twinkle: Array.from({ length: 22 }, () => ({ x: rnd(0, W), y: rnd(0, H * 0.6), ph: rnd(0, TAU), r: rnd(1.5, 3) * sc })),
        qs: Array.from({ length: 6 }, (_, i) => ({ x: i % 2 ? rnd(W - side, W - 40 * sc) : rnd(30 * sc, side), off: i / 6, v: rnd(0.03, 0.05), ph: rnd(0, TAU), s: rnd(0.6, 1.1) })),
        bubbles: Array.from({ length: 7 }, () => ({ on: false, x: 0, y: 0, age: 0, life: 1, lines: null, c: '', w: 0, h: 0, ox: 0, ph: 0 })),
        next: 0.2, si: Math.floor(Math.random() * SAYS.length), last: 0,
      };
    },
    draw(g, W, H, t, S) {
      const sc = S.sc, dt = Math.min(0.1, Math.max(0, t - S.last)); S.last = t;
      g.drawImage(S.sky, 0, 0, W, H);
      for (const s of S.twinkle) { g.fillStyle = 'rgba(255,250,220,' + (0.35 + 0.35 * Math.sin(t * 1.5 + s.ph)) + ')'; g.beginPath(); g.arc(s.x, s.y, s.r, 0, TAU); g.fill(); }

      // A sleepy crescent moon keeping the secret.
      const mx = W - S.side * 0.45, my = H * 0.17 + Math.sin(t * 0.5) * 4 * sc, mr = 58 * sc;
      g.fillStyle = 'rgba(255,242,196,0.08)'; g.beginPath(); g.arc(mx, my, mr * 1.9, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,242,196,0.1)'; g.beginPath(); g.arc(mx, my, mr * 1.4, 0, TAU); g.fill();
      g.drawImage(S.moon, mx - mr, my - mr, mr * 2, mr * 2);
      g.strokeStyle = '#6a4e9e'; g.lineWidth = 3.5 * sc; g.lineCap = 'round';
      g.beginPath(); g.arc(mx - mr * 0.5, my - mr * 0.2, 8 * sc, 0.2, Math.PI - 0.2); g.stroke();
      g.beginPath(); g.moveTo(mx - mr * 0.62, my + mr * 0.3); g.lineTo(mx - mr * 0.32, my + mr * 0.3); g.stroke();
      g.fillStyle = 'rgba(255,242,196,' + (0.55 + 0.25 * Math.sin(t * 1.2)) + ')'; g.font = S.f.psst; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('shhh…', mx - mr * 1.5, my + mr * 1.1 + Math.sin(t * 1.2) * 4 * sc);

      // Big faint question marks drifting up the sides.
      g.font = S.f.big;
      for (const q of S.qs) {
        const k = (q.off + t * q.v) % 1, y = H * (1.05 - k * 1.2);
        g.save(); g.translate(q.x, y); g.rotate(Math.sin(t * 0.7 + q.ph) * 0.25); g.scale(q.s, q.s);
        g.fillStyle = 'rgba(200,180,255,' + (0.14 * Math.sin(k * Math.PI)) + ')'; g.fillText('?', 0, 0); g.restore();
      }

      // Speech bubbles: spawn from a side head, rise, wobble and fade.
      // The first frame fast-forwards a few seconds so the sky is already full of secrets.
      for (let it = S.warm ? 1 : 50; it > 0; it--) {
      const d = S.warm ? dt : 0.1;
      S.next -= d;
      if (S.next <= 0) {
        const b = S.bubbles.find((x) => !x.on);
        if (b) {
          const h = S.sideHeads[Math.floor(Math.random() * S.sideHeads.length)], lines = SAYS[S.si++ % SAYS.length];
          g.font = S.f.bub; let w = 0; for (const l of lines) w = Math.max(w, g.measureText(l).width);
          b.w = w + 34 * sc; b.h = lines.length * 33 * sc + 24 * sc; b.lines = lines; b.c = BUB[S.si % BUB.length];
          const left = h.x < W / 2, lo = left ? 10 * sc + b.w / 2 : W - S.side + b.w / 2, hi = left ? S.side - b.w / 2 : W - 10 * sc - b.w / 2;
          b.x = Math.max(lo, Math.min(Math.max(lo, hi), h.x)); b.ox = h.x - b.x; b.y = H - 150 * sc * h.s;
          b.on = true; b.age = 0; b.life = 7.5; b.ph = Math.random() * TAU;
        }
        S.next = 1.1;
      }
      for (const b of S.bubbles) if (b.on) { b.age += d; if (b.age > b.life) b.on = false; }
      }
      S.warm = true;
      for (const b of S.bubbles) {
        if (!b.on) continue;
        const k = b.age / b.life, y = b.y - b.age * 70 * sc, x = b.x + Math.sin(b.age * 1.3 + b.ph) * 12 * sc, s = pop(Math.min(1, b.age / 0.4)) * 0.5 + 0.5 * Math.min(1, b.age / 0.4);
        g.save(); g.translate(x, y - b.h / 2); g.scale(s, s); g.globalAlpha = Math.min(1, (1 - k) * 3.5);
        g.fillStyle = 'rgba(10,4,30,0.3)'; g.beginPath(); g.roundRect(-b.w / 2 + 5 * sc, -b.h / 2 + 7 * sc, b.w, b.h, 22 * sc); g.fill();
        g.fillStyle = b.c; g.beginPath(); g.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, 22 * sc); g.fill();
        const tx = Math.max(-b.w / 2 + 24 * sc, Math.min(b.w / 2 - 24 * sc, b.ox * 0.4));
        g.beginPath(); g.moveTo(tx - 12 * sc, b.h / 2 - 2); g.lineTo(tx + 14 * sc, b.h / 2 - 2); g.lineTo(tx + b.ox * 0.08 - 4 * sc, b.h / 2 + 22 * sc); g.closePath(); g.fill();
        g.fillStyle = '#2b0a3d'; g.font = S.f.bub; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let i = 0; i < b.lines.length; i++) g.fillText(b.lines[i], 0, (i - (b.lines.length - 1) / 2) * 33 * sc + 2 * sc);
        g.restore();
      }
      g.globalAlpha = 1;

      // Who's being guessed this round: "?" hovers, then flips to "!" as they light up.
      const gc = Math.floor(t / GUESS), gl = t - gc * GUESS, sh = S.sideHeads, target = sh[(gc * 5 + 2) % sh.length];
      // The crowd.
      const by = H + 8 * sc;
      for (const h of S.heads) {
        const s = h.s * sc, hx = h.x, hy = by - 92 * s + Math.sin(t * 1.4 + h.ph) * 3 * sc, isT = h === target;
        const lit = isT && gl > 1.7 ? ease(Math.min(1, (gl - 1.7) / 0.3)) * Math.min(1, (GUESS - gl) / 0.4) : 0;
        if (lit > 0) { g.fillStyle = 'rgba(126,243,208,' + (0.22 * lit) + ')'; g.beginPath(); g.arc(hx, hy + 20 * s, 95 * s, 0, TAU); g.fill(); }
        g.fillStyle = '#140a30'; g.strokeStyle = lit > 0 ? '#7ef3d0' : h.rim; g.lineWidth = (2.5 + lit * 2.5) * sc; g.globalAlpha = 1;
        g.beginPath(); g.ellipse(hx, by, 62 * s, 58 * s, 0, Math.PI, TAU); g.closePath(); g.fill(); g.stroke();
        g.beginPath(); g.arc(hx, hy, 34 * s, 0, TAU); g.fill(); g.stroke();
        if (h.style === 1) { g.beginPath(); g.arc(hx, hy - 38 * s, 14 * s, 0, TAU); g.fill(); g.stroke(); }
        else if (h.style === 2) { g.beginPath(); g.ellipse(hx, hy - 22 * s, 38 * s, 7 * s, 0, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.roundRect(hx - 22 * s, hy - 56 * s, 44 * s, 36 * s, 6 * s); g.fill(); g.stroke(); }
        else if (h.style === 3) { g.beginPath(); g.arc(hx + 30 * s, hy + 8 * s, 13 * s, 0, TAU); g.fill(); g.stroke(); }
        else if (h.style === 4) { g.beginPath(); g.moveTo(hx - 30 * s, hy - 14 * s); g.lineTo(hx - 18 * s, hy - 48 * s); g.lineTo(hx - 4 * s, hy - 30 * s); g.lineTo(hx + 10 * s, hy - 50 * s); g.lineTo(hx + 20 * s, hy - 28 * s); g.lineTo(hx + 32 * s, hy - 40 * s); g.lineTo(hx + 32 * s, hy - 12 * s); g.fill(); }
        // Eyes glance sideways.
        const look = Math.sin(t * 0.9 + h.ph * 3) * 6 * s;
        g.fillStyle = lit > 0 ? '#ffffff' : 'rgba(255,255,255,0.75)';
        g.beginPath(); g.ellipse(hx - 11 * s + look, hy - 2 * s, 4.5 * s, 6 * s, 0, 0, TAU); g.ellipse(hx + 11 * s + look, hy - 2 * s, 4.5 * s, 6 * s, 0, 0, TAU); g.fill();
        if (isT && gl > 0.2 && gl < GUESS - 0.3) {
          const qk = Math.min(1, (gl - 0.2) / 0.35), ex = gl > 1.7, bob = Math.sin(t * 4) * 4 * sc;
          g.save(); g.translate(hx, hy - 90 * s + bob); const ps = ex ? pop(Math.min(1, (gl - 1.7) / 0.35)) : pop(qk) * (1 + 0.06 * Math.sin(t * 5));
          g.scale(ps, ps); g.font = S.f.q; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = 'rgba(10,4,30,0.5)'; g.fillText(ex ? '!' : '?', 3 * sc, 4 * sc);
          g.fillStyle = ex ? '#7ef3d0' : '#ff7ac8'; g.fillText(ex ? '!' : '?', 0, 0); g.restore();
        }
      }

      // Whispers between neighbours on each side.
      for (let side = 0; side < 2; side++) {
        const a = side === 0 ? S.heads[0] : S.heads[S.heads.length - 1], b = side === 0 ? S.heads[1] : S.heads[S.heads.length - 2];
        if (!a || !b) continue;
        const wl = (t + side * 1.6) % 3.2; if (wl > 2.2) continue;
        const ay = by - 92 * a.s * sc, byy = by - 92 * b.s * sc, cx = (a.x + b.x) / 2, cy = Math.min(ay, byy) - 70 * sc;
        const al = Math.min(1, wl / 0.3, (2.2 - wl) / 0.3);
        g.globalAlpha = al; g.strokeStyle = '#fdf3ff'; g.lineWidth = 3 * sc; g.setLineDash(DASH); g.lineDashOffset = -t * 30;
        g.beginPath(); g.moveTo(a.x, ay - 30 * a.s * sc); g.quadraticCurveTo(cx, cy, b.x, byy - 30 * b.s * sc); g.stroke(); g.setLineDash(NODASH);
        g.fillStyle = '#fdf3ff'; g.font = S.f.psst; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('psst…', cx, cy - 4 * sc - wl * 6 * sc);
        g.globalAlpha = 1;
      }
    },
  };
})();
