'use strict';
// Act It Out title screen: a plum-velvet theatre. The curtains part, gold comedy & tragedy
// masks hang over the stage, a spotlight swings in and finds a mime who acts out one charade
// after another (penguin, fishing, surfing, superhero, robot…). The audience's heads bob in
// the front row and their guess bubbles pop up: "?" until someone gets it.
(function () {
  const TAU = Math.PI * 2;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  // Poses: [lUpper, lFore, rUpper, rFore, lThigh, lShin, rThigh, rShin, lean, headTilt] (radians, 0 = straight down)
  const P = {
    stand: [0.2, 0.1, -0.2, -0.1, 0.08, 0, -0.08, 0, 0, 0],
    penguin: [0.5, 0.2, -0.5, -0.2, 0.15, 0, -0.15, 0, 0.12, 0.2],
    penguin2: [0.5, 0.2, -0.5, -0.2, 0.15, 0, -0.15, 0, -0.12, -0.2],
    fish: [-2.1, -0.6, -1.7, -1.2, 0.25, -0.1, -0.15, 0.1, 0.1, 0.25],
    fish2: [-2.6, -0.4, -2.2, -0.9, 0.25, -0.1, -0.15, 0.1, -0.08, 0.1],
    surf: [1.4, 0.3, -1.6, -0.2, 0.7, -0.9, -0.5, 0.7, 0.25, -0.15],
    hero: [-2.9, 0, 0.6, 1.9, 0.12, 0, -0.35, 0, 0, -0.2],
    robot: [1.57, -1.57, -1.57, 1.57, 0.1, 0, -0.1, 0, 0, 0.3],
    robot2: [1.57, 1.57, -1.57, -1.57, 0.1, 0, -0.1, 0, 0, -0.3],
    think: [0.3, 0.1, -0.5, -2.6, 0.1, 0, -0.1, 0, 0.05, 0.25],
    boo: [-2.4, -0.5, 2.4, 0.5, 0.35, -0.3, -0.35, 0.3, 0, 0],
  };
  const ACTS = [
    { poses: ['penguin', 'penguin2'], speed: 3.2, guess: ['🐧?', 'a duck?', 'PENGUIN!'] },
    { poses: ['fish', 'fish2'], speed: 1.6, guess: ['🎣?', 'rowing?', 'FISHING!'] },
    { poses: ['surf', 'surf'], speed: 1, guess: ['skiing?', '🏄?', 'SURFING!'] },
    { poses: ['hero', 'hero'], speed: 1, guess: ['waving?', '🦸?', 'SUPERHERO!'] },
    { poses: ['robot', 'robot2'], speed: 2.4, guess: ['🤖?', 'dancing?', 'A ROBOT!'] },
    { poses: ['boo', 'think'], speed: 1.2, guess: ['a ghost?', '👻?', 'GHOST!'] },
  ];
  const CYCLE = 5.2;
  const lerpPose = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  function curtain(w, h, flip) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
    const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, w, 0), folds = 5;
    for (let i = 0; i <= folds * 4; i++) { const k = i / (folds * 4), s = 0.5 + 0.5 * Math.sin(k * folds * TAU); gr.addColorStop(k, `hsl(${312 + s * 6} ${55 + s * 12}% ${12 + s * 22}%)`); }
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    const sh = x.createLinearGradient(0, 0, w, 0); sh.addColorStop(flip ? 1 : 0, 'rgba(0,0,0,0)'); sh.addColorStop(flip ? 0 : 1, 'rgba(0,0,0,0.5)'); x.fillStyle = sh; x.fillRect(0, 0, w, h);
    x.fillStyle = '#e9b53c'; x.fillRect(flip ? 0 : w - Math.max(4, w * 0.035), 0, Math.max(4, w * 0.035), h);
    return c;
  }
  function valance(w, h) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h * 1.5));
    const x = c.getContext('2d'), n = Math.max(6, Math.round(w / (h * 1.7))), sw = w / n;
    const gr = x.createLinearGradient(0, 0, 0, h * 1.4); gr.addColorStop(0, '#3a0b33'); gr.addColorStop(1, '#8a2a7a');
    x.fillStyle = gr; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, 0);
    for (let i = n; i > 0; i--) { x.lineTo(i * sw, h); x.quadraticCurveTo((i - 0.5) * sw, h * 1.45, (i - 1) * sw, h); }
    x.closePath(); x.fill();
    x.strokeStyle = '#ffc93c'; x.lineWidth = Math.max(3, h * 0.08); x.beginPath(); x.moveTo(w, h);
    for (let i = n; i > 0; i--) x.quadraticCurveTo((i - 0.5) * sw, h * 1.45 - x.lineWidth, (i - 1) * sw, h);
    x.stroke();
    x.fillStyle = '#ffc93c'; for (let i = 0; i < n; i++) { x.beginPath(); x.arc((i + 0.5) * sw, h * 1.3, h * 0.1, 0, TAU); x.fill(); }
    return c;
  }
  // Comedy (smiling) and tragedy (frowning) masks, gold.
  function mask(g, x, y, s, happy, rot) {
    g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
    const gr = g.createLinearGradient(-40, -50, 40, 50); gr.addColorStop(0, '#fff1b8'); gr.addColorStop(0.5, '#ffc93c'); gr.addColorStop(1, '#a8700f');
    g.fillStyle = gr; g.strokeStyle = '#4a1a10'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(-42, -40); g.quadraticCurveTo(0, -62, 42, -40); g.quadraticCurveTo(48, 10, 26, 40); g.quadraticCurveTo(0, 62, -26, 40); g.quadraticCurveTo(-48, 10, -42, -40); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#2a0d26';
    for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(sx * 17, -12, 11, happy ? 7 : 8, sx * (happy ? -0.3 : 0.35), 0, TAU); g.fill(); }
    g.beginPath();
    if (happy) { g.moveTo(-22, 14); g.quadraticCurveTo(0, 42, 22, 14); g.quadraticCurveTo(0, 26, -22, 14); }
    else { g.moveTo(-20, 32); g.quadraticCurveTo(0, 10, 20, 32); g.quadraticCurveTo(0, 22, -20, 32); }
    g.fill();
    g.strokeStyle = '#8a2a7a'; g.lineWidth = 5; g.beginPath(); g.moveTo(happy ? 38 : -38, -30); g.quadraticCurveTo(happy ? 70 : -70, -10, happy ? 60 : -60, 40); g.stroke();
    g.restore();
  }
  // The mime: a dark silhouette with a gold rim, in white gloves.
  function mime(g, x, y, sc, pose, t) {
    const [lu, lf, ru, rf, lt, ls, rt, rs, lean, tilt] = pose;
    g.save(); g.translate(x, y); g.scale(sc, sc);
    const limb = (ax, ay, a1, a2, l1, l2, w, glove) => {
      const bx = ax + Math.sin(a1) * l1, by = ay + Math.cos(a1) * l1, cx = bx + Math.sin(a1 + a2) * l2, cy = by + Math.cos(a1 + a2) * l2;
      g.lineWidth = w; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(cx, cy); g.stroke();
      if (glove) { g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(cx, cy, w * 0.75, 0, TAU); g.fill(); }
    };
    g.strokeStyle = '#1a0b1e'; g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = 'rgba(255, 210, 120, 0.9)'; g.shadowBlur = 18;
    limb(-17, -110, lt, ls, 58, 56, 21, false); limb(17, -110, rt, rs, 58, 56, 21, false);
    g.save(); g.translate(0, -110); g.rotate(lean);
    g.fillStyle = '#1a0b1e'; g.beginPath(); g.moveTo(-30, 0); g.lineTo(-34, -96); g.quadraticCurveTo(0, -112, 34, -96); g.lineTo(30, 0); g.closePath(); g.fill();
    // stripes on the shirt (a mime!)
    g.shadowBlur = 0; g.fillStyle = 'rgba(255,250,240,0.85)'; for (let i = 0; i < 4; i++) g.fillRect(-31, -86 + i * 22, 62, 7);
    g.shadowBlur = 18; g.strokeStyle = '#1a0b1e';
    limb(-30, -92, -lu, -lf, 50, 46, 20, true); limb(30, -92, -ru, -rf, 50, 46, 20, true);
    g.save(); g.translate(0, -128); g.rotate(tilt);
    g.fillStyle = '#fffaf0'; g.beginPath(); g.ellipse(0, 0, 28, 33, 0, 0, TAU); g.fill();
    g.shadowBlur = 0; g.fillStyle = '#1a0b1e'; g.beginPath(); g.arc(-10, -4, 3.5, 0, TAU); g.arc(10, -4, 3.5, 0, TAU); g.fill();
    g.strokeStyle = '#d6264b'; g.lineWidth = 4; g.beginPath(); g.arc(0, 10, 9, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = '#1a0b1e'; g.fillRect(-26, -34, 52, 9); g.beginPath(); g.ellipse(0, -36, 20, 10, 0, Math.PI, TAU); g.fill();
    g.restore(); g.restore(); g.restore();
  }
  // Shared with the intro cutscene (public/box/intros/actout.js).
  BOX.actoutArt = { mime, mask, P, lerpPose, curtain, valance };
  BOX.titles.actout = {
    logo: '<span class="mk">🎭</span><span class="a">Act It</span><span class="b">Out!</span>',
    tagline: 'Charades for the whole room. One actor, one secret prompt, everyone guessing on their phones.',
    start: '🎬 Raise the curtain',
    meta: '3–100 players · best 4–12 · 10–15 min',
    font: "'Luckiest Guy', 'Lilita One', sans-serif",
    theme: { card: 'rgba(36, 8, 34, 0.9)', ink: '#fff4dc', muted: '#f1cfe6', accent: '#ffc93c', button: '#ffc93c', buttonInk: '#3a0b33', border: '#ffc93c' },
    css: `.bt-actout .bt-logo { line-height: .9; position: relative; padding-top: .3em; letter-spacing: .02em; }
      .bt-actout .bt-logo .mk { position: absolute; left: 50%; top: -.1em; font-size: .5em; transform: translateX(-50%); animation: aoTMask 2.6s ease-in-out infinite; }
      .bt-actout .bt-logo .a, .bt-actout .bt-logo .b { display: block; }
      .bt-actout .bt-logo .a { font-size: .78em; color: #fff4dc; text-shadow: 0 5px 0 #6b1d5e, 0 0 26px rgba(255, 201, 60, .35); }
      .bt-actout .bt-logo .b { font-size: 1.32em; color: #ffc93c; text-shadow: 0 6px 0 #8a5a00, 0 0 34px rgba(255, 201, 60, .7); transform: rotate(-3deg); }
      @keyframes aoTMask { 0%, 100% { transform: translateX(-50%) rotate(-10deg); } 50% { transform: translateX(-50%) rotate(10deg) translateY(-.08em); } }
      .bt-actout .bt-card { box-shadow: 0 18px 0 rgba(0,0,0,.35), 0 0 0 3px #3a0b33, 0 0 80px rgba(255, 201, 60, .28); }
      .bt-actout .bt-go { background: linear-gradient(180deg, #ffe08a, #ffc21f); box-shadow: 0 7px 0 #8a5a00; font-family: 'Lilita One', sans-serif; }`,
    init(W, H) {
      const u = Math.max(0.55, Math.min(W / 1600, H / 900));
      const cw = Math.max(80, W * 0.14), vh = Math.max(40, H * 0.075);
      return {
        u, cw, vh, curL: curtain(cw * 1.6, H, false), curR: curtain(cw * 1.6, H, true), val: valance(W, vh),
        heads: Array.from({ length: Math.ceil(W / (70 * u)) + 2 }, (_, i) => ({ x: (i - 0.5) * 70 * u + (i % 2) * 14 * u, ph: Math.random() * TAU, s: 0.85 + Math.random() * 0.3, c: ['#2a0d26', '#341033', '#22091f'][i % 3] })),
        dust: Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), v: 0.01 + Math.random() * 0.03, r: 1 + Math.random() * 2.2, ph: Math.random() * TAU })),
        bubbles: [],
      };
    },
    draw(g, W, H, t, S) {
      const u = S.u, floorY = H * 0.8, cx = W * 0.5;
      // the house: dark plum, the back wall glowing softly
      let gr = g.createRadialGradient(cx, H * 0.35, 40, cx, H * 0.45, Math.max(W, H) * 0.8); gr.addColorStop(0, '#46184a'); gr.addColorStop(0.6, '#1e0a22'); gr.addColorStop(1, '#0b0410'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // the back curtain (closed rear drape)
      g.fillStyle = 'rgba(90, 20, 80, 0.35)'; for (let x = 0; x < W; x += 46 * u) { g.fillRect(x, 0, 22 * u, floorY); }
      // the stage floor
      gr = g.createLinearGradient(0, floorY, 0, H); gr.addColorStop(0, '#6b3b16'); gr.addColorStop(1, '#2a1408'); g.fillStyle = gr; g.fillRect(0, floorY, W, H - floorY);
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 2; for (let i = -20; i <= 20; i++) { g.beginPath(); g.moveTo(cx + i * 60 * u, floorY); g.lineTo(cx + i * 140 * u, H); g.stroke(); }
      g.fillStyle = '#2a160a'; g.fillRect(0, floorY - 3, W, 6);
      // the spotlight: sweeps in, then follows the mime
      const act = Math.floor(t / CYCLE) % ACTS.length, p = t % CYCLE, A = ACTS[act];
      // the mime works the open stage beside the title card: left, then right, then left…
      const sideX = (i) => (i % 2 ? W * 0.785 : W * 0.215) + Math.sin(t * 0.5) * W * 0.02;
      const glide = ease(clamp(p / 0.9)), mx = sideX(act - 1) + (sideX(act) - sideX(act - 1)) * glide;
      const sweep = t < 1.6 ? ease(t / 1.6) : 1;
      const sx = cx + (mx - cx) * sweep;
      const beamTopX = cx + (sx - cx) * 0.25;
      g.save(); g.globalCompositeOperation = 'lighter';
      gr = g.createLinearGradient(0, 0, 0, floorY); gr.addColorStop(0, 'rgba(255, 240, 190, 0.02)'); gr.addColorStop(1, 'rgba(255, 236, 180, 0.32)');
      g.fillStyle = gr; g.beginPath(); g.moveTo(beamTopX - 30 * u, 0); g.lineTo(beamTopX + 30 * u, 0); g.lineTo(sx + 170 * u, floorY); g.lineTo(sx - 170 * u, floorY); g.closePath(); g.fill();
      gr = g.createRadialGradient(sx, floorY, 10, sx, floorY, 210 * u); gr.addColorStop(0, 'rgba(255, 240, 190, 0.55)'); gr.addColorStop(1, 'rgba(255, 240, 190, 0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(sx, floorY, 210 * u, 46 * u, 0, 0, TAU); g.fill();
      for (const d of S.dust) { d.y -= d.v / 60; if (d.y < 0) d.y = 1; const px = sx + (d.x - 0.5) * 300 * u * (d.y + 0.2), py = d.y * floorY; g.fillStyle = `rgba(255,240,200,${0.25 + 0.25 * Math.sin(t * 2 + d.ph)})`; g.beginPath(); g.arc(px, py, d.r * u, 0, TAU); g.fill(); }
      g.restore();
      // the mime acts out the charade
      const sw = (Math.sin(p * A.speed * Math.PI) + 1) / 2;
      let pose = lerpPose(P[A.poses[0]], P[A.poses[1]], A.poses[0] === A.poses[1] ? 0 : sw);
      if (p < 0.5) pose = lerpPose(P.stand, pose, ease(p / 0.5));
      if (p > CYCLE - 0.45) pose = lerpPose(pose, P.stand, ease((p - (CYCLE - 0.45)) / 0.45));
      const bob = A.poses[0] === 'surf' ? Math.sin(t * 3) * 8 * u : A.poses[0] === 'penguin' ? -Math.abs(Math.sin(t * 6.4)) * 6 * u : 0;
      if (sweep > 0.6) mime(g, sx, floorY + 6 * u + bob, 1.15 * u, pose, t);
      // footlights
      for (let i = 0; i < 16; i++) { const fx = W * 0.12 + (i / 15) * W * 0.76; g.fillStyle = '#fff3c4'; g.beginPath(); g.ellipse(fx, floorY + 10 * u, 11 * u, 6 * u, 0, 0, TAU); g.fill(); gr = g.createRadialGradient(fx, floorY, 2, fx, floorY, 60 * u); gr.addColorStop(0, 'rgba(255,220,140,0.35)'); gr.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = gr; g.beginPath(); g.arc(fx, floorY, 60 * u, 0, TAU); g.fill(); }
      // curtains: open at the start, then breathe
      const open = ease(clamp(t / 1.8)), cwid = S.cw * (1 + (1 - open) * 2.6), sway = Math.sin(t * 0.8) * 6 * u;
      g.drawImage(S.curL, 0, 0, S.curL.width, S.curL.height, -S.cw * 0.6 + sway, 0, cwid + S.cw * 0.6, H);
      g.drawImage(S.curR, 0, 0, S.curR.width, S.curR.height, W - cwid - sway, 0, cwid + S.cw * 0.6, H);
      for (const [x0, fl] of [[cwid * 0.9 + sway, 1], [W - cwid * 0.9 - sway, -1]]) { g.fillStyle = '#ffc93c'; g.beginPath(); g.ellipse(x0, H * 0.5, 12 * u, 20 * u, fl * 0.3, 0, TAU); g.fill(); g.strokeStyle = '#ffc93c'; g.lineWidth = 3 * u; g.beginPath(); g.moveTo(x0, H * 0.5 + 18 * u); g.lineTo(x0 + fl * 6 * u, H * 0.5 + 48 * u); g.stroke(); }
      g.drawImage(S.val, 0, 0);
      // the masks over the proscenium
      const mw = Math.sin(t * 1.3) * 0.08;
      mask(g, cx - 44 * u, S.vh * 0.95, 0.72 * u, true, -0.25 + mw);
      mask(g, cx + 44 * u, S.vh * 0.95, 0.72 * u, false, 0.25 - mw);
      // the audience: heads bob, guesses pop up (wrong, wrong, then right)
      const hy = H - 6 * u;
      S.heads.forEach((h, i) => {
        const hb = Math.sin(t * 2.2 + h.ph) * 4 * u, r = 34 * u * h.s;
        g.fillStyle = h.c; g.beginPath(); g.arc(h.x, hy - r * 0.6 + hb, r, 0, TAU); g.fill(); g.fillRect(h.x - r * 1.2, hy - r * 0.1 + hb, r * 2.4, r * 2);
        g.strokeStyle = 'rgba(255, 210, 120, 0.25)'; g.lineWidth = 2; g.beginPath(); g.arc(h.x, hy - r * 0.6 + hb, r, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      });
      A.guess.forEach((txt, j) => {
        const at = 1.2 + j * 1.15, k = p - at; if (k < 0 || p > CYCLE - 0.3) return;
        const right = j === A.guess.length - 1, sc = Math.min(1, k * 5) * (right ? 1 + 0.08 * Math.sin(k * 10) : 1);
        const bx = (act % 2 ? W * 0.62 : W * 0.38) + (j - 1) * W * 0.11 * (act % 2 ? 1 : -1), by = hy - 110 * u - (right ? 30 * u : j * 8 * u);
        g.save(); g.translate(bx, by); g.scale(sc * u, sc * u);
        g.font = `${right ? 40 : 30}px 'Lilita One', sans-serif`; const tw = g.measureText(txt).width + 40;
        g.fillStyle = right ? '#ffc93c' : 'rgba(255, 250, 240, 0.92)'; g.strokeStyle = right ? '#8a5a00' : 'rgba(42,13,38,.6)'; g.lineWidth = 4;
        g.beginPath(); g.roundRect(-tw / 2, -32, tw, 60, 26); g.fill(); g.stroke();
        g.beginPath(); g.moveTo(-10, 26); g.lineTo(0, 46); g.lineTo(10, 26); g.fill();
        g.fillStyle = '#2a0d26'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 0);
        g.restore();
      });
      // vignette
      gr = g.createRadialGradient(cx, H * 0.5, Math.min(W, H) * 0.35, cx, H * 0.5, Math.max(W, H) * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    },
  };
})();
