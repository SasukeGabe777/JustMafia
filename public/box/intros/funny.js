'use strict';
// JustFunny intro: movie night. The living-room lights go down and the fairy lights blink on
// one by one; the old TV flickers through static into the JustFunny logo while popcorn pops;
// then a reverse shot of the couch as tonight's friends drop into their seats.
// Engine + API: public/box/show.js ('cast' mode).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, clamp, rng, TAU } = ST.util, { rr, text } = ST.draw;
  const FONT = "'Luckiest Guy', 'Lilita One', cursive", DARK = '#1b1424';
  try { if (document.fonts) document.fonts.load(`80px ${FONT}`); } catch { /* fine */ }
  const R = rng(4242);
  const BULBS = Array.from({ length: 30 }, (_, i) => { const u = i / 29, sw = (u * 2) % 1; return { x: -100 + u * 2120, y: 40 + Math.sin(sw * Math.PI) * 80, hue: [48, 330, 190, 120, 20][i % 5], ph: R() * TAU, on: R() }; });
  const POP = Array.from({ length: 16 }, () => ({ ph: R(), vx: R() * 140 - 70, vy: 420 + R() * 160, r: R() * TAU }));
  const SKIN = ['#f5cfa8', '#c98d5e', '#8a5a3b', '#e9b48a', '#5c3a26', '#f1c27d'], HAIR = ['#2b1a12', '#e0a03a', '#7a2f1c', '#1d1d2a', '#c45a9a', '#3a2418'];
  const STATIC = (() => { const c = document.createElement('canvas'); c.width = 160; c.height = 90; const g = c.getContext('2d'), im = g.createImageData(160, 90); for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; } g.putImageData(im, 0, 0); return c; })();
  const TV = { x: 960, y: 380, w: 940, h: 560 };

  function room(g, s, o) {
    const t = s.t, hue = 210 + Math.sin(t * 0.4) * 50;
    let gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, '#2a1640'); gr.addColorStop(1, '#170c26'); g.fillStyle = gr; g.fillRect(-700, -400, 3320, 1900);
    g.fillStyle = 'rgba(255,255,255,0.03)'; for (let x = -600; x < 2520; x += 64) g.fillRect(x, -400, 26, 1500);
    // the TV glow on the wall
    const tv = o.tv == null ? 1 : o.tv;
    if (tv > 0) { gr = g.createRadialGradient(TV.x, TV.y, 60, TV.x, TV.y, 1100); gr.addColorStop(0, `hsla(${hue},90%,65%,${0.45 * tv})`); gr.addColorStop(1, 'hsla(0,0%,0%,0)'); g.fillStyle = gr; g.fillRect(-700, -400, 3320, 1900); }
    // framed picture (left) and floor lamp (right)
    g.fillStyle = '#c98b3c'; g.fillRect(150, 230, 230, 190); g.fillStyle = '#7fe3ff'; g.fillRect(166, 246, 198, 158);
    g.fillStyle = '#7ee081'; g.beginPath(); g.moveTo(166, 404); g.quadraticCurveTo(265, 320, 364, 404); g.fill();
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(210, 290, 20, 0, TAU); g.fill();
    const lamp = o.lamp == null ? 1 : o.lamp;
    gr = g.createRadialGradient(1700, 330, 10, 1700, 420, 420); gr.addColorStop(0, `rgba(255,200,110,${0.45 * lamp})`); gr.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = gr; g.fillRect(1200, -100, 900, 1100);
    g.strokeStyle = '#120a1c'; g.lineWidth = 10; g.beginPath(); g.moveTo(1700, 330); g.lineTo(1700, 860); g.stroke();
    g.fillStyle = lamp > 0.5 ? '#ffcf7a' : '#7a5a3a'; g.beginPath(); g.moveTo(1650, 230); g.lineTo(1750, 230); g.lineTo(1782, 330); g.lineTo(1618, 330); g.closePath(); g.fill();
    // curtains
    for (const [x0, dir] of [[-40, 1], [1960, -1]]) for (let i = 0; i < 6; i++) { const x = x0 + dir * i * 34, sw = Math.sin(t * 0.6 + i) * 4; g.fillStyle = i % 2 ? '#7d1838' : '#9c2348'; g.beginPath(); g.moveTo(x, -50); g.lineTo(x + dir * 34, -50); g.quadraticCurveTo(x + dir * 60 + sw, 500, x + dir * 34 + sw, 1100); g.lineTo(x + sw, 1100); g.quadraticCurveTo(x + dir * 20 + sw, 500, x, -50); g.fill(); }
    // the room lights: dim everything but the fairy lights and the TV
    const lights = o.lights == null ? 1 : o.lights;
    if (lights < 1) { g.fillStyle = `rgba(8,4,16,${(1 - lights) * 0.7})`; g.fillRect(-700, -400, 3320, 1900); }
    // fairy lights
    const lit = o.fairy == null ? 1 : o.fairy;
    g.strokeStyle = 'rgba(20,12,24,0.95)'; g.lineWidth = 3; g.beginPath(); BULBS.forEach((b, i) => (i ? g.lineTo(b.x, b.y) : g.moveTo(b.x, b.y))); g.stroke();
    for (const b of BULBS) {
      const on = b.on < lit, a = on ? 0.7 + 0.3 * Math.sin(t * 1.6 + b.ph) : 0.15;
      if (on) { g.fillStyle = `hsla(${b.hue},100%,70%,${0.25 * a})`; g.beginPath(); g.arc(b.x, b.y + 14, 30, 0, TAU); g.fill(); }
      g.fillStyle = `hsla(${b.hue},${on ? 100 : 30}%,${on ? 55 + a * 20 : 30}%,1)`; g.beginPath(); g.ellipse(b.x, b.y + 14, 9, 13, 0, 0, TAU); g.fill();
    }
  }
  function tvSet(g, s, o) {
    const { x, y, w, h } = TV, tv = o.tv == null ? 1 : o.tv;
    g.fillStyle = '#2a170a'; rr(g, x - 300, y + h / 2 + 10, 600, 40, 10); g.fill();
    g.fillStyle = '#3a2410'; g.fillRect(x - 220, y + h / 2 + 50, 30, 120); g.fillRect(x + 190, y + h / 2 + 50, 30, 120);
    let gr = g.createLinearGradient(0, y - h / 2, 0, y + h / 2); gr.addColorStop(0, '#8a5a2e'); gr.addColorStop(1, '#5a3518');
    rr(g, x - w / 2, y - h / 2, w, h, 44); g.fillStyle = gr; g.fill(); g.lineWidth = 8; g.strokeStyle = '#2a170a'; g.stroke();
    const sx = x - w / 2 + 30, sy = y - h / 2 + 28, sw = w - 60, sh = h - 100;
    g.save(); rr(g, sx, sy, sw, sh, 26); g.clip();
    g.fillStyle = '#05030a'; g.fillRect(sx, sy, sw, sh);
    if (tv > 0) {
      const st = o.stat == null ? 0 : o.stat;
      gr = g.createRadialGradient(x, sy + sh * 0.45, 30, x, sy + sh * 0.45, sw * 0.7); gr.addColorStop(0, '#3a2a8a'); gr.addColorStop(1, '#0a0624'); g.globalAlpha = tv; g.fillStyle = gr; g.fillRect(sx, sy, sw, sh);
      if (st > 0) { g.globalAlpha = st; g.imageSmoothingEnabled = false; const ox = Math.floor(s.now / 40) % 3 * 7; g.drawImage(STATIC, ox, 0, 140, 80, sx, sy, sw, sh); g.imageSmoothingEnabled = true; }
      g.globalAlpha = 1;
      if (o.logo !== 0 && tv > 0.5) { g.save(); g.translate(x, sy + sh / 2); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
      g.fillStyle = 'rgba(255,255,255,0.04)'; for (let yy = sy; yy < sy + sh; yy += 6) g.fillRect(sx, yy, sw, 2);
    }
    g.restore();
    g.lineWidth = 8; g.strokeStyle = '#120a14'; rr(g, sx, sy, sw, sh, 26); g.stroke();
    text(g, 'JUSTFUNNY', x - w / 2 + 150, y + h / 2 - 36, 30, '#ffd9a0', { font: FONT });
    for (const [kx, c] of [[x + w / 2 - 110, '#c9b89a'], [x + w / 2 - 60, '#ff6a7a']]) { g.fillStyle = c; g.beginPath(); g.arc(kx, y + h / 2 - 38, 16, 0, TAU); g.fill(); }
  }
  function logo(g, s, k) {
    const b = ST.util.back(clamp(k)), wob = Math.sin(s.t * 2.4) * 0.05;
    g.save(); g.scale(b, b); g.rotate(-0.04 + wob);
    text(g, 'JUST', 0, -95, 70, '#7fe3ff', { font: FONT, stroke: '#1f4f7a', lw: 10 });
    g.fillStyle = '#6b1d0a'; g.font = `200px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FUNNY', 0, 50 + 20);
    g.fillStyle = '#c2410c'; g.fillText('FUNNY', 0, 50 + 10);
    g.fillStyle = '#ffd23f'; g.fillText('FUNNY', 0, 50);
    g.restore();
  }
  function popcorn(g, s, bx, by, k) {
    g.fillStyle = '#fff1c8';
    if (k > 0) for (const p of POP) {
      const u = (s.t * 0.6 + p.ph) % 1, tt = u * 1.3, x = bx + p.vx * tt, y = by - 150 - (p.vy * tt - 460 * tt * tt);
      if (y > by - 140) continue;
      g.save(); g.translate(x, y); g.rotate(p.r + s.t * 2); g.beginPath(); g.arc(-8, 0, 12, 0, TAU); g.arc(8, -4, 12, 0, TAU); g.arc(1, 9, 11, 0, TAU); g.fill(); g.restore();
    }
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(bx - 60 + i * 15, by - 150 + (i % 2) * 10, 20, 0, TAU); g.fill(); }
    g.save(); g.beginPath(); g.moveTo(bx - 80, by - 150); g.lineTo(bx + 80, by - 150); g.lineTo(bx + 60, by); g.lineTo(bx - 60, by); g.closePath(); g.clip();
    for (let i = -4; i <= 4; i++) { g.fillStyle = i % 2 ? '#e8323f' : '#fff4e0'; g.fillRect(bx + i * 24 - 12, by - 160, 24, 170); }
    g.restore();
  }
  // A friend on the couch, facing the TV (and us, in the reverse shot): their avatar is the face.
  function friend(g, s, p, x, y, sc, laugh, i) {
    const bob = Math.abs(Math.sin(s.t * 8 + i)) * 10 * laugh;
    g.save(); g.translate(x, y - bob); g.scale(sc, sc);
    g.fillStyle = p.color || '#3fb6ff'; g.beginPath(); g.ellipse(0, 90, 82, 76, 0, Math.PI, TAU); g.fill(); g.fillRect(-82, 90, 164, 120);
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(-82, 150, 164, 60);
    s.emoji(p.avatar || '🙂', 0, 0, 120);
    g.restore();
    if (p.name) { g.save(); g.translate(x, y + 150 * sc); rr(g, -90 * sc, -22 * sc, 180 * sc, 44 * sc, 22 * sc); g.fillStyle = '#fff4e0'; g.fill(); text(g, p.name, 0, 2 * sc, 30 * sc, DARK, { font: FONT, max: 160 * sc }); g.restore(); }
  }
  function couchBack(g, y) {
    let gr = g.createLinearGradient(0, y, 0, y + 260); gr.addColorStop(0, '#d4643a'); gr.addColorStop(1, '#8f3a1c');
    g.fillStyle = gr; rr(g, -40, y, 2000, 300, 60); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 1; i < 4; i++) g.fillRect(i * 480 - 4, y + 30, 8, 180);
  }
  function backsOfHeads(g, s, n, y, laugh) {
    for (let i = 0; i < n; i++) {
      const x = 260 + i * (1400 / Math.max(1, n - 1)), bob = Math.abs(Math.sin(s.t * 7 + i * 1.7)) * 12 * laugh;
      g.fillStyle = ['#3fb6ff', '#ff6b8b', '#7ee081', '#ffb347', '#b48cff', '#35d0b5'][i % 6]; g.beginPath(); g.ellipse(x, y + 120, 110, 90, 0, Math.PI, TAU); g.fill(); g.fillRect(x - 110, y + 120, 220, 200);
      g.fillStyle = HAIR[i % HAIR.length]; g.beginPath(); g.arc(x, y - bob, 62, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(127,227,255,0.35)'; g.lineWidth = 5; g.beginPath(); g.arc(x, y - bob, 58, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
  }
  function stage(g, s, o = {}) {
    room(g, s, o);
    tvSet(g, s, o);
    if (!o.bare) {
      couchBack(g, 860);
      backsOfHeads(g, s, 5, 870, o.laugh == null ? 0.4 : o.laugh);
      popcorn(g, s, 240, 1080, o.pop == null ? 1 : o.pop);
    }
  }

  BOX.intros.funny = {
    title: 'JustFunny',
    theme: { accent: '#ff4f6d', accent2: '#7fe3ff', accent3: '#ffd23f', ink: '#fff4e0', panel: '#2c2440', fade: '#170c26', rim: '#7fe3ff',
      confetti: ['#ffd23f', '#ff4f6d', '#7fe3ff', '#7ee081', '#fff1c8', '#b48cff'] },
    host: null,
    lines: {
      welcome: 'Lights down, phones out! Welcome to JustFunny, the watch party!',
      roll: 'Who\'s on the couch tonight?', more: '…and {n} more on the floor!', others: 'And everyone squeezed in at the back!',
      play: 'Grab the popcorn. Press play!',
    },
    stage, logo,
    castOpening: [
      { ms: 2300, sfx: [[1500, 'click']],
        draw(g, s) {
          s.cam(960, 520, 1.08 - 0.04 * s.k);
          stage(g, s, { lights: 1 - ss(200, 1300, s.T) * 0.75, lamp: 1 - ss(700, 1400, s.T), fairy: ss(800, 2200, s.T), tv: 0, pop: 0, laugh: 0 });
        } },
      { ms: 2200, sfx: [[0, 'whoosh'], [750, 'start'], [1300, 'pop'], [1700, 'pop']],
        draw(g, s) {
          const on = ss(0, 250, s.T), flick = s.T < 700 ? (Math.sin(s.T * 0.09) > -0.3 ? 1 : 0.2) : 1;
          s.cam(960, lerp(470, 420, ease(s.k)), lerp(1.12, 1.32, ease(s.k)));
          stage(g, s, { lights: 0.25, lamp: 0, fairy: 1, tv: on * flick, stat: s.T < 750 ? 1 - ss(500, 750, s.T) : 0, logo: s.T < 750 ? 0 : clamp((s.T - 750) / 600), pop: s.T > 1100 ? 1 : 0, laugh: 0.2 });
        } },
      { ms: 2500, say: 'welcome', sayAt: 0, fit: 3600, sfx: [[300, 'cheer']],
        draw(g, s) {
          // the reverse shot: the couch, seen from the TV, as tonight's friends drop in
          const F = (s.show && s.show.featured) || [], n = Math.min(5, F.length);
          let gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, '#2a1640'); gr.addColorStop(1, '#120a1c'); g.fillStyle = gr; g.fillRect(-700, -400, 3320, 1900);
          const hue = 210 + Math.sin(s.t * 0.9) * 60;
          gr = g.createRadialGradient(960, 300, 50, 960, 500, 1100); gr.addColorStop(0, `hsla(${hue},90%,65%,0.35)`); gr.addColorStop(1, 'hsla(0,0%,0%,0)'); g.fillStyle = gr; g.fillRect(-700, -400, 3320, 1900);
          for (const b of BULBS) { g.fillStyle = `hsla(${b.hue},100%,65%,0.9)`; g.beginPath(); g.ellipse(b.x, b.y + 14, 9, 13, 0, 0, TAU); g.fill(); }
          s.cam(960, 600, lerp(1.08, 1, ease(s.k)));
          couchBack(g, 470);
          for (let i = 0; i < n; i++) {
            const at = 150 + i * 320, k = ST.util.back((s.T - at) / 420); if (k <= 0) continue;
            const x = 960 + (i - (n - 1) / 2) * 340, drop = (1 - k) * -500;
            friend(g, s, F[i], x, 560 + drop, 1.05, s.T > at + 600 ? 1 : 0, i);
          }
          let gr2 = g.createLinearGradient(0, 730, 0, 1080); gr2.addColorStop(0, '#b54a24'); gr2.addColorStop(1, '#7a2e14'); g.fillStyle = gr2; rr(g, -60, 745, 2040, 400, 50); g.fill();
          g.fillStyle = '#c4532b'; rr(g, -120, 520, 220, 600, 60); g.fill(); rr(g, 1820, 520, 220, 600, 60); g.fill();
          popcorn(g, s, 1700, 1040, 1);
          if (!n) text(g, 'SAVE ME A SEAT!', 960, 640, 110, '#ffd23f', { font: FONT, stroke: '#6b1d0a', lw: 14 });
        } },
    ],
  };
})();
