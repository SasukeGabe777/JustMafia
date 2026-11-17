'use strict';
// JustBlanks title screen: a cheeky game-show stage. A tangerine sunburst turns slowly behind
// the card, a purple prompt card on the left flips to a new prompt and scribbles a punchline
// into its blank, a fanned hand of answer cards on the right picks a winner, and a row of
// giggling faces on the stage lip bounces in a wave every time a card wins.
(function () {
  const TAU = Math.PI * 2;
  const EFONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const PROMPTS = [
    { p: ['My secret', 'talent is…'], a: 'napping on cue' },
    { p: ['Never trust', 'a guy who…'], a: 'claps at movies' },
    { p: ['Grandma’s new', 'hobby is…'], a: 'extreme karaoke' },
    { p: ['Worst thing to', 'find in soup:'], a: 'a tiny hat' },
    { p: ['My dog’s', 'search history:'], a: 'how 2 open fridge' },
    { p: ['Rejected ice', 'cream flavor:'], a: 'pickle surprise' },
  ];
  const ANSWERS = [
    ['a haunted', 'toaster'], ['my uncle’s', 'mustache'], ['an emotional', 'support pigeon'], ['way too much', 'glitter'],
    ['a suspicious', 'casserole'], ['interpretive', 'dance'], ['a very polite', 'ghost'], ['three raccoons', 'in a coat'],
    ['free samples', 'forever'], ['a dramatic', 'sneeze'],
  ];
  const STRIPES = ['#ff4f8b', '#3ec7ff', '#7ee06a', '#ffb627', '#b77bff'];
  const FACES = ['😂', '🤣', '😆', '😜', '😹', '🙃', '😝', '😅', '🤭', '😏'];
  const CONF = ['#ffe14d', '#ff4f8b', '#3ec7ff', '#7ee06a', '#ffffff', '#b77bff'];
  const PCYCLE = 5, FCYCLE = 3;
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
  const easeOut = (k) => 1 - (1 - k) * (1 - k) * (1 - k);
  // Draw text squeezed to fit a width (cards stay tidy whatever the answer).
  function fitText(g, s, x, y, maxW) {
    const w = g.measureText(s).width;
    if (w <= maxW) { g.fillText(s, x, y); return; }
    g.save(); g.translate(x, y); g.scale(maxW / w, 1); g.fillText(s, 0, 0); g.restore();
  }

  BOX.titles.blanks = {
    logo: '<span class="j">Just</span><span class="w">Bl<span class="slot"><i>a</i></span>nks</span>',
    tagline: 'Fill in the blank with the funniest card in your hand (or write your own). The room picks the winner.',
    start: '🃏 Deal me in',
    meta: '3–100 players · 15–30 min',
    font: "'Luckiest Guy', 'Lilita One', sans-serif",
    theme: { card: 'rgba(52, 14, 92, 0.9)', ink: '#fff6e8', muted: '#ffd6e6', accent: '#ffe14d', button: '#ffe14d', buttonInk: '#3a0f66', border: '#ff4f8b' },
    css: `.bt-blanks .bt-logo { font-size: clamp(64px, 8.4vw, 120px); line-height: 0.92; }
      .bt-blanks .bt-logo .j { display: block; font-size: 0.48em; color: #ff8fc0; letter-spacing: 0.08em; transform: rotate(-4deg); text-shadow: 0 4px 0 #1e0638; }
      .bt-blanks .bt-logo .w { display: inline-block; color: #ffe14d; transform: rotate(-2deg); text-shadow: 0 6px 0 #c2185b, 0 12px 0 rgba(0, 0, 0, 0.28); }
      .bt-blanks .bt-logo .slot { display: inline-block; position: relative; width: 0.6em; height: 0.72em; margin: 0 0.05em; border-bottom: 0.08em solid #fff6e8; border-radius: 0.04em; }
      .bt-blanks .bt-logo .slot i { position: absolute; left: 0; right: 0; bottom: 0; font-style: normal; color: #3ec7ff; text-shadow: 0 5px 0 #0d4f73; animation: btBlankDrop 5s cubic-bezier(.3, 1.5, .5, 1) infinite; }
      @keyframes btBlankDrop { 0%, 6% { transform: translateY(-1.1em) rotate(-25deg); opacity: 0; } 20% { transform: none; opacity: 1; } 84% { transform: none; opacity: 1; } 96%, 100% { transform: translateY(-0.4em) rotate(18deg); opacity: 0; } }
      .bt-blanks .bt-card { border-radius: 26px; box-shadow: 0 16px 0 #8a1546, 0 30px 60px rgba(60, 0, 30, 0.45); }
      .bt-blanks .bt-tag { font-family: 'Fredoka', sans-serif; font-weight: 600; }`,
    init(W, H) {
      const rnd = (a, b) => a + Math.random() * (b - a);
      const cardW = Math.min(640, W * 0.92), side = Math.max(150, (W - cardW) / 2 - 20);
      const sc = Math.max(0.45, Math.min(3, H / 900, side / 420));
      // Halftone dots fading in from two corners, drawn once.
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const ht = document.createElement('canvas'); ht.width = Math.max(1, Math.round(W * dpr)); ht.height = Math.max(1, Math.round(H * dpr));
      const hg = ht.getContext('2d'); hg.scale(dpr, dpr); hg.fillStyle = 'rgba(150, 20, 70, 0.28)';
      const step = 22 * sc, R = Math.min(W, H) * 0.75;
      for (const [cx, cy] of [[0, 0], [W, H], [W, 0]]) {
        for (let y = 0; y < H; y += step) for (let x = (Math.round(y / step) % 2) * step / 2; x < W; x += step) {
          const d = Math.hypot(x - cx, y - cy) / R; if (d >= 1) continue;
          hg.beginPath(); hg.arc(x, y, (1 - d) * step * 0.42, 0, TAU); hg.fill();
        }
      }
      const inSide = () => (Math.random() < 0.5 ? rnd(0, side) : rnd(W - side, W));
      const n = Math.ceil(W / (78 * sc)) + 1;
      return {
        sc, side, ht, lx: side / 2 + 8 * sc, rx: W - side / 2 - 8 * sc,
        f: {
          prompt: `${Math.round(36 * sc)}px 'Luckiest Guy', sans-serif`, ans: `${Math.round(30 * sc)}px 'Permanent Marker', cursive`,
          label: `${Math.round(17 * sc)}px 'Luckiest Guy', sans-serif`, card: `600 ${Math.round(19 * sc)}px 'Fredoka', sans-serif`,
          plus: `${Math.round(40 * sc)}px 'Luckiest Guy', sans-serif`, mini: `${Math.round(13 * sc)}px 'Luckiest Guy', sans-serif`,
          ha: `${Math.round(30 * sc)}px 'Luckiest Guy', sans-serif`,
        },
        conf: Array.from({ length: 34 }, (_, i) => ({ x: inSide(), y: rnd(-H, H), v: rnd(30, 70) * sc, r: rnd(0, TAU), vr: rnd(-2, 2), w: rnd(6, 12) * sc, h: rnd(10, 18) * sc, c: CONF[i % CONF.length] })),
        minis: Array.from({ length: 7 }, (_, i) => ({ off: i / 7, y: (i % 2 ? rnd(0.035, 0.09) : rnd(0.1, 0.15)) * H, v: rnd(22, 40) * sc, r: rnd(-0.4, 0.4), vr: rnd(-0.5, 0.5), c: STRIPES[i % STRIPES.length] })),
        crowd: Array.from({ length: n }, (_, i) => ({ x: (i + 0.5) * (W / n), e: FACES[(i * 7) % FACES.length], ph: rnd(0, TAU), s: rnd(0.9, 1.1) })),
        last: 0,
      };
    },
    draw(g, W, H, t, S) {
      const sc = S.sc, dt = Math.min(0.1, Math.max(0, t - S.last)); S.last = t;
      // Sunburst stage backdrop turning slowly.
      g.fillStyle = '#ff5a36'; g.fillRect(0, 0, W, H);
      const R = Math.hypot(W, H);
      g.save(); g.translate(W / 2, H * 0.46); g.rotate(t * 0.035); g.fillStyle = '#ff7a45'; g.beginPath();
      for (let i = 0; i < 24; i++) { const a = (i * TAU) / 24; g.moveTo(0, 0); g.arc(0, 0, R, a, a + TAU / 48); g.closePath(); }
      g.fill(); g.restore();
      if (!S.vig) { S.vig = g.createRadialGradient(W / 2, H * 0.46, Math.min(W, H) * 0.25, W / 2, H * 0.46, R * 0.62); S.vig.addColorStop(0, 'rgba(90,0,50,0)'); S.vig.addColorStop(1, 'rgba(90,0,50,0.5)'); }
      g.fillStyle = S.vig; g.fillRect(0, 0, W, H);
      g.drawImage(S.ht, 0, 0, W, H);

      // Little blank cards tumbling across the top.
      for (const m of S.minis) {
        const x = ((m.off * (W + 200) + t * m.v) % (W + 200)) - 100;
        g.save(); g.translate(x, m.y); g.rotate(m.r + Math.sin(t * 0.8 + m.off * 9) * 0.25);
        g.fillStyle = 'rgba(60,0,40,0.25)'; g.fillRect(-21 * sc, -27 * sc, 46 * sc, 60 * sc);
        g.fillStyle = '#fff4dc'; g.fillRect(-24 * sc, -30 * sc, 46 * sc, 60 * sc);
        g.fillStyle = m.c; g.fillRect(-24 * sc, -30 * sc, 46 * sc, 10 * sc);
        g.fillStyle = '#3a0f66'; g.fillRect(-15 * sc, 14 * sc, 28 * sc, 3 * sc);
        g.restore();
      }
      // Confetti drifting down the sides.
      for (const c of S.conf) {
        c.y += c.v * dt; c.r += c.vr * dt; if (c.y > H + 20) c.y = -20;
        g.save(); g.translate(c.x + Math.sin(c.r) * 10 * sc, c.y); g.rotate(c.r); g.scale(1, Math.cos(c.r * 1.7));
        g.fillStyle = c.c; g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); g.restore();
      }

      // The prompt card: flips to a new prompt, then a punchline is scribbled into the blank.
      const pc = Math.floor(t / PCYCLE), ph = t - pc * PCYCLE, P = PROMPTS[pc % PROMPTS.length];
      const cw = 300 * sc, ch = 390 * sc;
      let flip = 1; if (ph < 0.25) flip = Math.sin((ph / 0.25) * Math.PI / 2); else if (ph > PCYCLE - 0.25) flip = Math.cos(((ph - PCYCLE + 0.25) / 0.25) * Math.PI / 2);
      g.save(); g.translate(S.lx, H * 0.47 + Math.sin(t * 1.1) * 6 * sc); g.rotate(-0.08 + Math.sin(t * 0.7) * 0.02); g.scale(Math.max(0.02, flip), 1);
      g.fillStyle = 'rgba(80,0,40,0.4)'; g.beginPath(); g.roundRect(-cw / 2 + 12 * sc, -ch / 2 + 16 * sc, cw, ch, 24 * sc); g.fill();
      g.fillStyle = '#3a1470'; g.beginPath(); g.roundRect(-cw / 2, -ch / 2, cw, ch, 24 * sc); g.fill();
      g.strokeStyle = '#ffe14d'; g.lineWidth = 4 * sc; g.beginPath(); g.roundRect(-cw / 2 + 11 * sc, -ch / 2 + 11 * sc, cw - 22 * sc, ch - 22 * sc, 16 * sc); g.stroke();
      g.fillStyle = '#ff4f8b'; g.beginPath(); g.roundRect(-70 * sc, -ch / 2 - 6 * sc, 140 * sc, 34 * sc, 17 * sc); g.fill();
      g.fillStyle = '#fff6e8'; g.font = S.f.label; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FILL IT IN!', 0, -ch / 2 + 12 * sc);
      g.font = S.f.prompt; g.fillStyle = '#fff6e8'; g.textBaseline = 'alphabetic';
      for (let i = 0; i < P.p.length; i++) fitText(g, P.p[i], 0, -ch / 2 + 100 * sc + i * 46 * sc, cw - 50 * sc);
      const by = ch * 0.17;
      g.strokeStyle = '#ffe14d'; g.lineWidth = 5 * sc; g.lineCap = 'round'; g.beginPath(); g.moveTo(-cw / 2 + 32 * sc, by); g.lineTo(cw / 2 - 32 * sc, by); g.stroke();
      const typed = Math.max(0, Math.min(1, (ph - 0.45) / 1.3)), nch = Math.round(typed * P.a.length);
      g.font = S.f.ans; g.fillStyle = '#7ce8ff';
      if (nch > 0) fitText(g, P.a.slice(0, nch), 0, by - 10 * sc, cw - 60 * sc);
      if (ph > 0.3 && typed < 1) { g.fillStyle = 'rgba(255,225,77,' + (0.55 + 0.45 * Math.sin(t * 6)) + ')'; g.fillRect(-2 * sc, by - 40 * sc, 4 * sc, 32 * sc); }
      g.fillStyle = 'rgba(255,246,232,0.55)'; g.font = S.f.mini; g.fillText('JUSTBLANKS · PROMPT ' + (1 + (pc % PROMPTS.length)), 0, ch / 2 - 30 * sc);
      // "HA!" sticker slaps on once the answer lands.
      if (ph > 2.1) {
        const k = Math.min(1, (ph - 2.1) / 0.22), s = 1 + (1 - easeOut(k)) * 0.9;
        g.save(); g.translate(cw / 2 - 30 * sc, ch * 0.33); g.rotate(0.3); g.scale(s, s); g.globalAlpha = k;
        g.fillStyle = '#ffe14d'; g.beginPath();
        for (let i = 0; i < 20; i++) { const a = (i * TAU) / 20, r = (i % 2 ? 34 : 46) * sc; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        g.closePath(); g.fill(); g.fillStyle = '#c2185b'; g.font = S.f.ha; g.textBaseline = 'middle'; g.fillText('HA!', 0, 2 * sc);
        g.restore();
      }
      g.restore();

      // The hand of answer cards: one rises as the winner every few seconds.
      const fc = Math.floor(t / FCYCLE), fl = (t - fc * FCYCLE) / FCYCLE, pick = (fc * 3) % 5;
      const fx = S.rx, fy = H * 0.5 + 250 * sc, aw = 158 * sc, ah = 214 * sc;
      const bump = fl < 0.75 ? Math.sin(Math.min(1, fl / 0.22) * Math.PI / 2) : Math.max(0, 1 - (fl - 0.75) / 0.25);
      const set = Math.floor(fc / 5) * 2;
      for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 5; i++) {
        if ((i === pick) !== (pass === 1)) continue;
        const ang = (i - 2) * 0.2 + Math.sin(t * 0.9 + i) * 0.025, lift = i === pick ? 70 * sc * bump : 0;
        g.save(); g.translate(fx, fy); g.rotate(ang); g.translate(0, -ah * 1.12 - lift);
        g.fillStyle = 'rgba(80,0,40,0.35)'; g.beginPath(); g.roundRect(-aw / 2 + 8 * sc, -ah / 2 + 10 * sc, aw, ah, 16 * sc); g.fill();
        if (i === pick && bump > 0.05) { g.strokeStyle = 'rgba(255,225,77,' + bump + ')'; g.lineWidth = 12 * sc; g.beginPath(); g.roundRect(-aw / 2, -ah / 2, aw, ah, 16 * sc); g.stroke(); }
        g.fillStyle = '#fff4dc'; g.beginPath(); g.roundRect(-aw / 2, -ah / 2, aw, ah, 16 * sc); g.fill();
        g.fillStyle = STRIPES[i]; g.beginPath(); g.roundRect(-aw / 2, -ah / 2, aw, 30 * sc, [16 * sc, 16 * sc, 0, 0]); g.fill();
        const A = ANSWERS[(i + set) % ANSWERS.length];
        g.fillStyle = '#2a0b4f'; g.font = S.f.card; g.textAlign = 'center'; g.textBaseline = 'middle';
        fitText(g, A[0], 0, -ah * 0.08, aw - 22 * sc); fitText(g, A[1], 0, ah * 0.08, aw - 22 * sc);
        g.fillStyle = 'rgba(42,11,79,0.35)'; g.font = S.f.mini; g.fillText('ANSWER', 0, ah / 2 - 20 * sc);
        g.restore();
      }
      // A "+1" and a laughing face float up off the winning card.
      if (fl > 0.15 && fl < 0.85) {
        const k = (fl - 0.15) / 0.7, ang = (pick - 2) * 0.2, px = fx + Math.sin(ang) * (ah * 1.75), py = fy - Math.cos(ang) * (ah * 1.75) - k * 70 * sc;
        g.globalAlpha = Math.min(1, (1 - k) * 2.5); g.font = S.f.plus; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = '#c2185b'; g.fillText('+1', px - 18 * sc, py + 4 * sc); g.fillStyle = '#ffe14d'; g.fillText('+1', px - 18 * sc, py);
        const es = 46 * sc; g.drawImage(sprite('😂'), px + 22 * sc, py - es / 2 - 6 * sc, es, es);
        g.globalAlpha = 1;
      }

      // Stage lip with marquee bulbs and a giggling crowd that waves when a card wins.
      const sy = H - 34 * sc;
      g.fillStyle = '#3a1470'; g.fillRect(0, sy, W, H - sy);
      g.fillStyle = '#ffe14d'; g.fillRect(0, sy, W, 5 * sc);
      const gap = 34 * sc, chase = t * 3;
      for (let i = 0, x = gap / 2; x < W; i++, x += gap) {
        const a = 0.45 + 0.4 * Math.max(0, Math.sin(i * 0.9 - chase));
        g.fillStyle = 'rgba(255,240,170,' + a + ')'; g.beginPath(); g.arc(x, sy + 17 * sc, 6 * sc, 0, TAU); g.fill();
      }
      const fs = 58 * sc, tw = fl * FCYCLE;
      for (const c of S.crowd) {
        const jp = tw - 0.25 - (c.x / W) * 0.9;
        const jump = jp > 0 && jp < 0.45 ? Math.sin((jp / 0.45) * Math.PI) * 24 * sc : 0;
        const y = sy - fs * 0.38 + Math.sin(t * 2.2 + c.ph) * 3 * sc - jump, s = fs * c.s;
        g.drawImage(sprite(c.e), c.x - s / 2, y - s / 2, s, s);
      }
    },
  };
})();
