// Original settlement illustration: procedural masonry, slate, timber and gardens.
// Houses retain the shared layout's door anchors; cosmetic damage never owns rules.
(function () {
  const TAU = Math.PI * 2, shade = window.MTArt.shade;
  const FAMILIES = ['Cottage', 'Timber house', 'Stone house', 'Townhouse', 'Farmhouse', 'Narrow home', 'Family home', 'Noble residence'];
  // Player-chosen home styles: [base family, width, wall height]. Each style adds
  // its own signage and props in STYLE_ART; door and footprint stay in the slot.
  const STYLES = { cottage: [0, 64, 40], tavern: [6, 80, 52], bakery: [1, 70, 48], smithy: [4, 74, 42], apothecary: [3, 58, 64], library: [2, 76, 54], chapel: [5, 50, 60], tailor: [3, 62, 56], watchtower: [2, 56, 46], windmill: [0, 60, 42], farmhouse: [4, 78, 43], manor: [7, 82, 62] };
  const STYLE_ART = {
    cottage: { post({ r, w }) {
      for (let a = -w / 2 - 10; a < w / 2 + 10; a += 5) if (a < -13 || a > 11) r('#eee6d2', a, -7, 2, 8);
      r('#eee6d2', -w / 2 - 10, -5, w / 2 - 3, 1); r('#eee6d2', 12, -5, w / 2, 1);
    } },
    tavern: { post({ r, w, lit }) {
      r('#2b2420', 7, -50, 19, 2); r('#2b2420', 11, -48, 1, 3); r('#2b2420', 22, -48, 1, 3);
      r('#5a3b24', 8, -45, 17, 10); r('#e3b04b', 13, -42, 6, 6); r('#f5f0e0', 13, -43, 6, 2); r('#e3b04b', 19, -41, 2, 4);
      for (let i = 0; i < 2; i++) { const a = -w / 2 - 4 + i * 9; r('#6b4a2e', a, -10, 8, 10); r('#3a2d22', a, -8, 8, 1); r('#3a2d22', a, -3, 8, 1); }
      r('#353436', -13, -31, 2, 4); r(lit ? '#ffd27a' : '#a8875a', -15, -28, 6, 6);
    } },
    bakery: { post({ r, w, wall }) {
      for (const a of [-w / 2 + 12, w / 2 - 21]) for (let i = 0; i < 5; i++) { r(i % 2 ? '#f4ecdc' : '#c0473a', a - 4 + i * 4, -41, 4, 5); r(i % 2 ? '#f4ecdc' : '#c0473a', a - 3 + i * 4, -36, 2, 2); }
      r('#4a3426', -11, -46, 22, 9); r('#d49a52', -7, -44, 14, 5); r('#e7b46c', -6, -45, 12, 2); r('#a8703a', -3, -43, 1, 3); r('#a8703a', 2, -43, 1, 3);
      r('#8f4f3a', -w / 2 - 12, -20, 12, 20); r(shade(wall, -.3), -w / 2 - 13, -23, 14, 4); r('#2a2220', -w / 2 - 9, -11, 6, 7); r('#e98c3a', -w / 2 - 8, -8, 4, 4);
    } },
    smithy: { post({ r, w, polygon, time }) {
      r('#2b2523', w / 2 - 1, -30, 17, 30); polygon('#3b3532', [[w / 2 - 3, -30], [w / 2 + 19, -24], [w / 2 + 19, -21], [w / 2 - 3, -26]]);
      const flick = Math.sin(time * 9) > 0; r(flick ? '#f08a32' : '#e2672a', w / 2 + 3, -13, 10, 9); r('#ffd36b', w / 2 + 6, -10, 4, flick ? 5 : 3);
      r('#3c3f45', -w / 2 - 6, -7, 15, 3); r('#3c3f45', -w / 2 - 1, -4, 6, 3); r('#2b2d31', -w / 2 - 4, -1, 12, 2);
      r('#3a3430', -10, -40, 20, 10); r('#aab0b6', -6, -38, 9, 3); r('#7a5232', -2, -35, 2, 4);
    } },
    apothecary: { post({ r, w, height }) {
      r('#2f3a33', -9, -41, 18, 11); r('#5fc28a', -3, -38, 6, 6); r('#5fc28a', -1, -40, 2, 2); r('#c9f0d6', -2, -37, 2, 2);
      for (const a of [-w / 2 + 12, w / 2 - 21]) { r('#7bd389', a + 1, -21, 3, 5); r('#c27bd3', a + 5, -20, 3, 4); r('#d3c27b', a + 8, -21, 2, 5); }
      for (let i = 0; i < 3; i++) { r('#3a3430', -w / 2 + 3 + i * 4, -height + 4, 1, 3); r('#5f7a3a', -w / 2 + 2 + i * 4, -height + 7, 3, 7); }
    } },
    library: { post({ r, polygon }) {
      polygon('#cfc6ad', [[-22, -30], [0, -42], [22, -30]]); r('#b9af95', -22, -31, 44, 3);
      for (const a of [-19, -14, 10, 15]) { r('#e8e1cf', a, -30, 4, 30); r('#b9af95', a + 3, -30, 1, 30); }
      r('#efe3c0', -7, -38, 14, 4); r('#9a7b4a', -8, -38, 1, 4); r('#9a7b4a', 7, -38, 1, 4);
    }, windows({ r, a }) { ['#a33b3b', '#365fa8', '#3a8a5a', '#a87b2f'].forEach((c, i) => r(c, a + 1 + i * 2.5, -22, 2, 6)); } },
    chapel: { post({ r, polygon, top, height, wall, roof }) {
      r('#303139', -8, top - 25, 16, -height - top + 25); r(shade(wall, -.08), -7, top - 24, 14, -height - top + 24);
      r('#2a2a30', -4, top - 20, 8, 10); r('#d9b25a', -3, top - 15, 6, 5); r('#b38f3f', -1, top - 11, 2, 2);
      polygon('#272b34', [[-10, top - 23], [0, top - 46], [10, top - 23]]); polygon(roof, [[-8, top - 24], [0, top - 43], [8, top - 24]]);
      r('#4a4048', -7, -height + 7, 14, 14); r('#c9a7e3', -5, -height + 9, 10, 10); r('#e7c96b', -1, -height + 9, 2, 10); r('#e7c96b', -5, -height + 13, 10, 2);
    } },
    tailor: { post({ r, w }) {
      for (let i = 0; i < 8; i++) r(i % 2 ? '#f4ecdc' : '#3f6fa8', -16 + i * 4, -33, 4, 5);
      r('#3a3430', -10, -46, 20, 11); r('#c9a36a', -5, -44, 10, 2); r('#c9506a', -4, -42, 8, 4); r('#c9a36a', -5, -38, 10, 2);
      const a = w / 2 - 21; r('#e8dcc8', a + 4, -31, 3, 3); r('#8a5a9a', a + 3, -28, 5, 9);
      r('#6a8ac9', w / 2 + 2, -16, 5, 5); r('#c96a8a', w / 2 + 7, -16, 5, 5); r('#e3c15c', w / 2 + 4, -21, 5, 5);
    } },
    watchtower: { post({ r, w, top, wall, lit, time, index }) {
      const tx = -w / 2 - 14, ty = top - 18;
      r('#303139', tx - 1, ty - 1, 20, -ty + 1); r(shade(wall, -.12), tx, ty, 18, -ty);
      for (let row = ty + 6; row < 0; row += 8) r('rgba(20,24,31,.18)', tx, row, 18, 1);
      for (let i = 0; i < 4; i++) r(shade(wall, -.28), tx - 1 + i * 5.5, ty - 5, 3, 5);
      r('#2a2a30', tx + 7, ty + 12, 4, 10); if (lit) r('#ffc76b', tx + 8, ty + 14, 2, 6);
      r('#3a3430', tx + 8, ty - 20, 2, 16); r('#c4674f', tx + 10, ty - 20 + Math.sin(time * 3 + index), 9, 6);
    } },
    windmill: { post({ ctx, r, w, top, wall, roof, polygon, time, index }) {
      const hx = w / 2 + 8, hy = top - 4;
      polygon('#303139', [[w / 2 - 4, 1], [w / 2 + 21, 1], [w / 2 + 15, hy + 1], [w / 2 + 1, hy + 1]]);
      polygon(shade(wall, -.1), [[w / 2 - 3, 0], [w / 2 + 20, 0], [w / 2 + 14, hy + 2], [w / 2 + 2, hy + 2]]);
      polygon(roof, [[w / 2, hy + 3], [hx, hy - 9], [w / 2 + 16, hy + 3]]); r('#2a2a30', hx - 3, -16, 6, 16);
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(time * 1.1 + index);
      for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); r('#6b5a44', -1, -27, 2, 27); r('#d9ceb2', 1, -26, 5, 19); r('#a89878', 1, -20, 5, 1); r('#a89878', 1, -14, 5, 1); }
      ctx.restore(); r('#3a3430', hx - 2, hy - 2, 4, 4);
    } },
    farmhouse: { post({ r, w }) {
      for (let i = 0; i < 2; i++) { const a = -w / 2 - 15 + i * 3, b = -9 - i * 8; r('#d8b55a', a, b, 12, 8); r('#b8953a', a, b + 3, 12, 1); r('#b8953a', a + 5, b, 1, 8); }
      for (let i = 0; i < 4; i++) r('#8a6a48', w / 2 + 2 + i * 5, -11, 2, 11); r('#8a6a48', w / 2 + 1, -9, 18, 2); r('#8a6a48', w / 2 + 1, -4, 18, 2);
    } },
    manor: { pre({ r, w, wall, roof, polygon, lit }) {
      for (const s of [-1, 1]) {
        const a = s < 0 ? -w / 2 - 18 : w / 2 + 1;
        r('#303139', a - 1, -40, 19, 41); r(shade(wall, -.06), a, -39, 17, 39); polygon(roof, [[a - 3, -38], [a + 8, -52], [a + 20, -38]]);
        r('#453a32', a + 4, -30, 9, 13); r(lit ? '#dca45a' : '#4e6268', a + 5, -29, 7, 11);
      }
    }, post({ r }) {
      r('#3a3430', -14, -36, 28, 3); for (let i = 0; i < 6; i++) r('#8f8678', -12 + i * 5, -42, 2, 6); r('#3a3430', -14, -43, 28, 2);
      for (const a of [-27, 23]) { r('#8f8a80', a, -12, 5, 12); r('#b4ad9e', a - 1, -14, 7, 3); }
    } },
  };
  // Player-chosen doors (all fit the 18x28 doorway at the house's door anchor).
  const DOORS = {
    plank({ r }) { r('#40342c', -9, -27, 18, 28); r('#765238', -7, -25, 14, 25); r('#49382d', -3, -24, 1, 24); r('#c1a36a', 3, -13, 2, 3); },
    arched({ r }) { r('#40342c', -9, -27, 18, 28); r('#40342c', -7, -31, 14, 4); r('#8a5a36', -7, -25, 14, 25); r('#8a5a36', -5, -29, 10, 4); r('#5f3e26', -1, -28, 2, 28); r('#e2c278', 3, -13, 2, 3); },
    double({ r }) { r('#40342c', -11, -27, 22, 28); r('#6d4a33', -9, -25, 8, 25); r('#6d4a33', 1, -25, 8, 25); r('#2e241e', -1, -25, 2, 25); r('#c1a36a', -3, -13, 1, 3); r('#c1a36a', 2, -13, 1, 3); },
    painted({ r }) { r('#40342c', -9, -27, 18, 28); r('#a83f37', -7, -25, 14, 25); r('#c45a4d', -5, -23, 4, 8); r('#c45a4d', 1, -23, 4, 8); r('#c45a4d', -5, -12, 10, 6); r('#f0d27a', 3, -15, 2, 3); },
    round({ ctx, r }) { ctx.fillStyle = '#40342c'; ctx.beginPath(); ctx.arc(0, -11, 12, Math.PI, 0); ctx.fill(); r('#40342c', -12, -11, 24, 12); ctx.fillStyle = '#4f7a3c'; ctx.beginPath(); ctx.arc(0, -11, 10, Math.PI, 0); ctx.fill(); r('#4f7a3c', -10, -11, 20, 11); r('#e8c66d', -1, -9, 3, 3); },
    iron({ r }) { r('#25282d', -9, -27, 18, 28); r('#4a5058', -7, -25, 14, 25); for (const yy of [-22, -14, -6]) { r('#2f3439', -7, yy, 14, 2); r('#9aa3ab', -6, yy, 1, 1); r('#9aa3ab', 5, yy, 1, 1); } r('#c8ced3', 3, -16, 2, 4); },
  };
  // Yard decorations drawn in front of the house; free (shop decor is separate).
  const YARD = {
    fence({ r, w }) { for (let a = -w / 2 - 10; a <= w / 2 + 8; a += 5) if (a < -14 || a > 12) r('#f1e9d6', a, -8, 2, 9); r('#f1e9d6', -w / 2 - 10, -6, w / 2 - 4, 1); r('#f1e9d6', 13, -6, w / 2 - 2, 1); },
    flowerbed({ r, w }) { r('#5a3f2a', -w / 2 - 12, -5, 16, 5); r('#5a3f2a', w / 2 - 4, -5, 16, 5); for (let i = 0; i < 4; i++) { r('#4f7a3c', -w / 2 - 11 + i * 4, -9, 2, 5); r(['#e05a7a', '#f0d26a', '#9b6fe0', '#ffffff'][i], -w / 2 - 12 + i * 4, -11, 3, 3); r('#4f7a3c', w / 2 - 3 + i * 4, -9, 2, 5); r(['#ffffff', '#e05a7a', '#f0d26a', '#9b6fe0'][i], w / 2 - 4 + i * 4, -11, 3, 3); } },
    mailbox({ r, w }) { r('#5b4630', w / 2 + 6, -14, 2, 14); r('#3e6fb0', w / 2 + 2, -20, 10, 7); r('#2c4f80', w / 2 + 2, -14, 10, 1); r('#d84b3c', w / 2 + 11, -22, 1, 5); r('#d84b3c', w / 2 + 11, -22, 3, 2); },
    pumpkins({ r, w }) { for (const [a, s] of [[-w / 2 - 12, 8], [-w / 2 - 3, 6], [w / 2 + 3, 7]]) { r('#c9661f', a, -s, s + 2, s); r('#e98a30', a + 2, -s, 2, s); r('#4f7a3c', a + s / 2, -s - 3, 2, 3); } },
    birdhouse({ r, polygon, w }) { r('#6b4a2e', -w / 2 - 8, -26, 2, 26); r('#c08a52', -w / 2 - 13, -36, 12, 10); polygon('#8a3b2f', [[-w / 2 - 15, -36], [-w / 2 - 7, -43], [-w / 2 + 1, -36]]); r('#2a2220', -w / 2 - 8, -32, 2, 3); },
    well({ r, w }) { r('#6f6a64', w / 2 + 2, -12, 16, 12); r('#8d8780', w / 2 + 3, -11, 14, 3); r('#2b4a63', w / 2 + 4, -12, 12, 2); r('#5b4630', w / 2 + 3, -30, 2, 18); r('#5b4630', w / 2 + 15, -30, 2, 18); r('#7a3b2a', w / 2, -33, 20, 4); r('#c1a36a', w / 2 + 9, -26, 1, 10); },
    laundry({ r, w }) { r('#5b4630', -w / 2 - 14, -30, 2, 30); r('#5b4630', -w / 2 + 2, -30, 2, 30); r('#d8d2c4', -w / 2 - 13, -29, 16, 1); r('#d86b5c', -w / 2 - 11, -28, 5, 7); r('#6b9be0', -w / 2 - 5, -28, 4, 9); r('#f0d26a', -w / 2, -28, 3, 5); },
  };
  // A wooden sign by the path naming the owner and anyone staying with them.
  function sign(ctx, x, y, s, lines, colors) {
    const font = Math.max(11, Math.round(14 * s));
    ctx.save(); ctx.font = `600 ${font}px 'Pixelify Sans', monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const width = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 10, height = lines.length * (font + 2) + 6;
    ctx.fillStyle = '#4a2e1e'; ctx.fillRect(x - 2 * s, y - 2, 4 * s, 14 * s);
    ctx.fillStyle = '#4a2e1e'; ctx.fillRect(x - width / 2 - 2, y - height - 2, width + 4, height + 4);
    ctx.fillStyle = '#c99a5b'; ctx.fillRect(x - width / 2, y - height, width, height);
    ctx.fillStyle = '#b5844a'; ctx.fillRect(x - width / 2, y - height, width, 2);
    lines.forEach((l, i) => { ctx.fillStyle = colors[i] || '#2a1a12'; ctx.fillText(l, x, y - height + 4 + (i + .5) * (font + 2)); });
    ctx.restore();
  }
  function building(ctx, x, y, index, palette, options = {}) {
    const spec = STYLES[options.style], art = spec ? STYLE_ART[options.style] : {};
    const family = spec ? spec[0] : index % 8, w = spec ? spec[1] : [68, 72, 70, 60, 78, 52, 78, 74][family], height = spec ? spec[2] : [42, 52, 46, 65, 43, 61, 51, 62][family];
    const wall = options.wall || palette.walls[index % palette.walls.length], roof = options.roof || palette.roofs[index % palette.roofs.length];
    const r = (color, a, b, c, d) => { ctx.fillStyle = color; ctx.fillRect(a, b, c, d); };
    const polygon = (color, points) => { ctx.fillStyle = color; ctx.beginPath(); points.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); ctx.fill(); };
    const lit = options.lit || Math.sin((options.time || 0) * .7 + index) > -.75;
    const kit = { ctx, r, polygon, w, height, wall, roof, lit, index, time: options.time || 0, top: -height - (family === 7 ? 35 : 25) };
    ctx.save(); ctx.translate(x, y); ctx.scale(options.scale || 1, options.scale || 1);
    ctx.fillStyle = 'rgba(8,12,19,.3)'; ctx.beginPath(); ctx.ellipse(8, 3, w * .7, 12, 0, 0, TAU); ctx.fill();
    if (options.damage === 'destroyed') {
      ctx.fillStyle = '#272624'; ctx.beginPath(); ctx.ellipse(0, -3, 44, 18, 0, 0, TAU); ctx.fill();
      r('#514b48', -w / 2, -12, w, 14); r('#22252b', -w / 2 + 4, -10, w - 8, 10);
      for (let i = 0; i < 14; i++) r(i % 2 ? '#82705c' : '#443d39', -41 + (i * 17) % 79, -17 + (i * 7) % 28, 5 + i % 5, 4);
      polygon('#3e4047', [[-30, -7], [-16, -29], [3, -9]]); r('#302b25', 21, -35, 5, 29);
      for (let i = 0; i < 3; i++) { const p = ((options.time || 0) * .17 + i / 3) % 1; ctx.fillStyle = `rgba(80,76,73,${.35 * (1 - p)})`; ctx.beginPath(); ctx.ellipse(5 + p * 18, -15 - p * 60, 5 + p * 13, 8 + p * 13, 0, 0, TAU); ctx.fill(); }
      ctx.restore(); return;
    }
    if (art.pre) art.pre(kit);
    r('#303139', -w / 2 - 3, -height - 2, w + 6, height + 6);
    r(wall, -w / 2, -height, w, height); r(shade(wall, -.22), w / 2 - 12, -height, 12, height);
    for (let row = 0; row < height / 8; row++) {
      r('rgba(20,24,31,.16)', -w / 2, -height + row * 8, w, 1);
      for (let col = 0; col < w / 14; col++) r('rgba(20,24,31,.12)', -w / 2 + col * 14 + (row % 2) * 7, -height + row * 8, 1, 8);
    }
    if ([0, 1, 3, 4, 6].includes(family)) {
      for (const a of [-w / 2 + 3, w / 2 - 7, -3]) r('#45382f', a, -height, 5, height);
      r('#574333', -w / 2, -height + 26, w, 4);
      ctx.strokeStyle = '#5c4735'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w / 2 + 7, -height + 5); ctx.lineTo(-6, -height + 24); ctx.moveTo(5, -height + 24); ctx.lineTo(w / 2 - 8, -height + 5); ctx.stroke();
    }
    const top = -height - (family === 7 ? 35 : 25), eave = -height + 2;
    if (options.theme === 'space') {
      ctx.fillStyle = roof; ctx.beginPath(); ctx.ellipse(0, -height, w / 2 + 5, 26, 0, Math.PI, 0); ctx.fill();
      r('#82dbe0', -w / 2, -height, w, 3); r('#25323f', w / 2 - 12, top - 9, 2, 20); r('#8cf8de', w / 2 - 14, top - 11, 5, 4);
    } else if (['spies','fbi','dungeon'].includes(options.theme)) {
      r('#292f38', -w / 2 - 4, -height - 8, w + 8, 11); r(roof, -w / 2 - 2, -height - 7, w + 4, 5);
      r('#555c63', 12, -height - 22, 13, 14); r('#b1bbba', 14, -height - 20, 9, 2);
      if (options.theme !== 'dungeon') { r('#748b92', -w / 2 + 5, -height + 5, w - 10, 11); for (let a = -w / 2 + 14; a < w / 2 - 5; a += 12) r('#34434b', a, -height + 5, 2, 11); }
    } else {
      r('#444049', 14, top - 7, 10, 22); r('#94836c', 13, top - 9, 12, 4);
      polygon('#272b34', [[-w / 2 - 7, eave + 2], [-w / 2 + 7, top - 3], [w / 2 - 6, top - 3], [w / 2 + 7, eave + 2]]);
      polygon(roof, [[-w / 2 - 5, eave], [-w / 2 + 8, top], [w / 2 - 8, top], [w / 2 + 5, eave]]);
      for (let row = 0; row < 4; row++) {
        const yy = top + 3 + row * 6, inset = 8 - row * 3;
        r(shade(roof, row % 2 ? -.17 : .15), -w / 2 + inset, yy, w - inset * 2, 2);
        for (let col = 0; col < 6; col++) r(shade(roof, -.28), -w / 2 + 12 + col * 11 + row % 2 * 5, yy - 4, 1, 5);
      }
      r('#2a2a30', -w / 2 - 5, eave, w + 10, 4);
      if ([1, 3, 6, 7].includes(family)) {
        polygon('#302d32', [[-17, eave - 3], [0, top - 12], [17, eave - 3]]);
        polygon(shade(wall, -.08), [[-13, eave - 4], [0, top - 6], [13, eave - 4]]);
        r('#423e3a', -4, top + 2, 8, 10); r('#efc784', -2, top + 4, 4, 7);
      }
      if (options.theme === 'fantasy') { polygon('#363448', [[-12,top+5],[0,top-20],[12,top+5]]); r('#b1e0de',-2,top-24,4,4); }
    }
    DOORS[options.door] ? DOORS[options.door](kit) : DOORS.plank(kit);
    r('#a49b83', -12, 0, 24, 3); r('#746c5a', -15, 3, 30, 3);
    const ws = options.windows || 'classic', glass = lit ? '#dca45a' : '#4e6268', shine = lit ? '#ffe0a0' : '#758381';
    for (const a of [-w / 2 + 12, w / 2 - 21]) {
      const wt = ws === 'tall' ? -42 : -34, wh = ws === 'tall' ? 28 : 20;
      if (ws === 'round') {
        ctx.fillStyle = '#453a32'; ctx.beginPath(); ctx.arc(a + 5.5, -24, 9, 0, TAU); ctx.fill();
        ctx.fillStyle = glass; ctx.beginPath(); ctx.arc(a + 5.5, -24, 7, 0, TAU); ctx.fill(); r(shine, a + 2, -28, 3, 3); r('#5a4534', a + 5, -31, 1, 14); r('#5a4534', a - 1, -24, 13, 1);
      } else {
        r('#453a32', a - 3, wt, 17, wh); r(glass, a, wt + 2, 11, wh - 5); r(shine, a + 1, wt + 3, 4, 7);
        if (ws === 'stained') { const c = lit ? ['#e0775f', '#6f9ee0', '#f0d26a', '#78c27f'] : ['#7a4038', '#38507a', '#7a6a38', '#3f6a44']; r(c[0], a, wt + 2, 5, 7); r(c[1], a + 6, wt + 2, 5, 7); r(c[2], a, wt + 10, 5, 5); r(c[3], a + 6, wt + 10, 5, 5); }
        if (art.windows) art.windows({ ...kit, a });
        r('#5a4534', a + 5, wt + 2, 1, wh - 5); r('#5a4534', a, wt + 10, 11, 1);
        if (ws === 'shuttered') { for (const sx of [a - 9, a + 15]) { r('#3d5a34', sx, wt, 6, wh); r('#5d7a45', sx + 1, wt + 1, 4, wh - 2); r('#3d5a34', sx + 1, wt + 7, 4, 1); } }
      }
      r('#51492e', a - 3, -14, 17, 4); r('#627248', a - 2, -16, 15, 3);
      if (ws === 'planters') for (let i = 0; i < 4; i++) r(i % 2 ? '#e07a8f' : '#f0d26a', a - 1 + i * 4, -19, 3, 3);
    }
    if (height > 54) { r('#473e33', -19, -56, 12, 13); r('#e6ba76', -17, -54, 8, 9); r('#473e33', 10, -56, 12, 13); r('#e6ba76', 12, -54, 8, 9); }
    if ((spec ? options.style === 'farmhouse' : family === 4) || options.decor === 'flowers') { for (let i = 0; i < 6; i++) { r('#52673a', -40 + i * 6, -4, 3, 7); r(i % 2 ? '#c798a1' : '#dfbd67', -41 + i * 6, -6, 4, 3); } }
    if ((spec ? options.style === 'manor' : family === 7) || options.decor === 'banner' || options.decor === 'heraldry') { r('#2c3546', 24, -48, 10, 20); r('#e6bd71', 28, -45, 2, 13); }
    if (options.decor === 'lanterns') { r('#353436', -w / 2 - 6, -18, 3, 20); r('#e6b66b', -w / 2 - 9, -22, 8, 9); }
    if (!spec) { r('#63533d', w / 2 + 3, -11, 10, 12); r('#958060', w / 2 + 2, -9, 12, 2); r('#2e3938', -w / 2 - 9, -10, 8, 11); r('#60714c', -w / 2 - 11, -16, 12, 8); }
    if (art.post) art.post(kit);
    if (YARD[options.yard]) YARD[options.yard](kit);
    if (options.damage === 'damaged' || options.damage === 'burned') { r('#292726', 8, -height, 8, height); r('#3e3430', -w / 2, -8, w, 8); }
    ctx.restore();
  }
  // A home shows the owner's design. Damage shows the worst state among everyone
  // living there (a destroyed resident home is destroyed for the whole house).
  const WORST = ['normal', 'damaged', 'burned', 'destroyed'];
  function lookOptions(look) {
    look = look || {};
    return { style: look.style, wall: look.wall, roof: look.roof === 'theme' ? undefined : look.roof, door: look.door, windows: look.windows, yard: look.yard, decor: look.decor };
  }
  function house(town, h, index, owner, residents = owner ? [owner] : []) {
    const damage = residents.reduce((worst, c) => WORST.indexOf(c.houseState) > WORST.indexOf(worst) ? c.houseState : worst, 'normal');
    building(town.ctx, h.x + (h.shakeUntil > town.time ? Math.sin(town.time * 70) * 3 : 0), h.y, index, town.th.palette, { ...lookOptions(owner && owner.homeLook), scale: h.s, theme: town.themeId, damage, time: town.time, lit: town.dark > .4 });
  }
  // Sign text: owner first, then residents ("+ Ben, Cy"), kept short for the TV.
  function signLines(owner, residents) {
    const others = residents.filter((c) => c !== owner && !(c.id && c.id === owner.id)).map((c) => c.name);
    const lines = [`${owner.house + 1} · ${owner.name}`];
    if (others.length) lines.push('+ ' + (others.length > 2 ? `${others.slice(0, 2).join(', ')} +${others.length - 2}` : others.join(', ')));
    return lines;
  }
  function homeSign(town, h, owner, residents) {
    const lines = signLines(owner, residents);
    sign(town.ctx, h.x + 46 * h.s, h.y + 6 * h.s, h.s, lines, ['#2a1a12', '#5a3a22']);
  }
  const CIVICS = [[1, 660, 630, 'TAVERN', 1], [10, 1280, 410, 'GUILD HALL', 7], [10, 160, 450, 'SMITHY', 2], [10, 1415, 410, 'APOTHECARY', 5], [25, 1415, 665, 'MARKET', 4], [25, 1770, 450, 'INN', 3], [25, 1770, 665, 'SHOPS', 1], [25, 1590, 710, 'STABLES', 4], [50, 175, 670, 'WORKSHOPS', 2]];
  function settlement(town) {
    const ctx = town.ctx, n = town.chars.size, time = town.time;
    for (const [min, x, y, label, style] of CIVICS) if (n >= min) {
      building(ctx, x, y, style, town.th.palette, { scale: 1.1, time, theme: town.themeId, lit: true });
      ctx.fillStyle = '#382f29'; ctx.fillRect(x - 42, y + 9, 84, 15);
    }
    // Clouds and birds never carry player labels or selectable humanoid shapes.
    for (let i = 0; i < 4; i++) {
      const x = (time * 26 + i * 470) % 1920, y = 120 + Math.sin(time + i) * 25;
      ctx.strokeStyle = '#333e40'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6,y - Math.sin(time * 6) * 4); ctx.lineTo(x,y); ctx.lineTo(x + 6,y - Math.sin(time * 6) * 4); ctx.stroke();
      ctx.fillStyle = 'rgba(221,224,208,.09)'; ctx.beginPath(); ctx.ellipse((time * 8 + i * 650) % 1920,130 + i * 26,110,15,0,0,TAU); ctx.fill();
    }
    for (const h of town.houses) if (h.chimney && town.ownerOf(h.ri) && town.ownerOf(h.ri).houseState !== 'destroyed') for (let i = 0; i < 3; i++) {
      const p = (time * .23 + i / 3) % 1; ctx.fillStyle = `rgba(182,180,169,${(1-p)*.25})`; ctx.beginPath(); ctx.ellipse(h.x + 15 + p * 17,h.y - 60 - p * 44,3 + p * 8,4 + p * 10,0,0,TAU); ctx.fill();
    }
    if (n) {
      ctx.fillStyle = '#38383a'; ctx.beginPath(); ctx.ellipse(1280, 655, 29, 15, 0, 0, TAU); ctx.fill();
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; ctx.fillStyle = '#8b8271'; ctx.fillRect(1277 + Math.cos(a) * 27, 651 + Math.sin(a) * 12, 7, 6); }
      for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#edb966' : '#ca6a3b'; ctx.beginPath(); ctx.ellipse(1268 + i * 6, 651 - Math.sin(time * 7 + i) * 4, 5, 12 + Math.sin(time * 9 + i) * 4, 0, 0, TAU); ctx.fill(); }
    }
    if (n >= 50) {
      ctx.fillStyle = '#4e5150'; ctx.fillRect(35, 105, 1850, 9); ctx.fillRect(35, 1005, 835, 9); ctx.fillRect(1050, 1005, 835, 9);
      for (let x = 35; x < 1880; x += 34) { ctx.fillRect(x, 98, 19, 8); if (x < 860 || x > 1050) ctx.fillRect(x, 998, 19, 8); }
      for (const x of [860, 1045]) { ctx.fillStyle = '#686761'; ctx.fillRect(x, 951, 18, 65); ctx.fillStyle = '#31343b'; ctx.fillRect(x - 4, 943, 26, 10); }
    }
  }
  window.MT_WORLD = { FAMILIES, STYLES, DOORS: Object.keys(DOORS), YARD: Object.keys(YARD), CIVICS, building, house, sign, signLines, homeSign, lookOptions, settlement };
})();
