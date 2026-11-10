// Original settlement illustration: procedural masonry, slate, timber and gardens.
// Houses retain the shared layout's door anchors; cosmetic damage never owns rules.
(function () {
  const TAU = Math.PI * 2, shade = window.MTArt.shade;
  const FAMILIES = ['Cottage', 'Timber house', 'Stone house', 'Townhouse', 'Farmhouse', 'Narrow home', 'Family home', 'Noble residence'];
  function building(ctx, x, y, index, palette, options = {}) {
    const family = index % 8, w = [68, 72, 70, 60, 78, 52, 78, 74][family], height = [42, 52, 46, 65, 43, 61, 51, 62][family];
    const wall = palette.walls[index % palette.walls.length], roof = palette.roofs[index % palette.roofs.length];
    const r = (color, a, b, c, d) => { ctx.fillStyle = color; ctx.fillRect(a, b, c, d); };
    const polygon = (color, points) => { ctx.fillStyle = color; ctx.beginPath(); points.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); ctx.fill(); };
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
    r('#40342c', -9, -27, 18, 28); r('#765238', -7, -25, 14, 25);
    r('#49382d', -3, -24, 1, 24); r('#c1a36a', 3, -13, 2, 3);
    r('#a49b83', -12, 0, 24, 3); r('#746c5a', -15, 3, 30, 3);
    const lit = options.lit || Math.sin((options.time || 0) * .7 + index) > -.75;
    for (const a of [-w / 2 + 12, w / 2 - 21]) {
      r('#453a32', a - 3, -34, 17, 20); r(lit ? '#dca45a' : '#4e6268', a, -32, 11, 15);
      r(lit ? '#ffe0a0' : '#758381', a + 1, -31, 4, 7); r('#5a4534', a + 5, -32, 1, 15); r('#5a4534', a, -24, 11, 1);
      r('#51492e', a - 3, -14, 17, 4); r('#627248', a - 2, -16, 15, 3);
    }
    if (height > 54) { r('#473e33', -19, -56, 12, 13); r('#e6ba76', -17, -54, 8, 9); r('#473e33', 10, -56, 12, 13); r('#e6ba76', 12, -54, 8, 9); }
    if (family === 4 || options.decor === 'flowers') { for (let i = 0; i < 6; i++) { r('#52673a', -40 + i * 6, -4, 3, 7); r(i % 2 ? '#c798a1' : '#dfbd67', -41 + i * 6, -6, 4, 3); } }
    if (family === 7 || options.decor === 'banner' || options.decor === 'heraldry') { r('#2c3546', 24, -48, 10, 20); r('#e6bd71', 28, -45, 2, 13); }
    if (options.decor === 'lanterns') { r('#353436', -w / 2 - 6, -18, 3, 20); r('#e6b66b', -w / 2 - 9, -22, 8, 9); }
    r('#63533d', w / 2 + 3, -11, 10, 12); r('#958060', w / 2 + 2, -9, 12, 2); r('#2e3938', -w / 2 - 9, -10, 8, 11); r('#60714c', -w / 2 - 11, -16, 12, 8);
    if (options.damage === 'damaged' || options.damage === 'burned') { r('#292726', 8, -height, 8, height); r('#3e3430', -w / 2, -8, w, 8); }
    ctx.restore();
  }
  function house(town, h, index, owner) {
    building(town.ctx, h.x + (h.shakeUntil > town.time ? Math.sin(town.time * 70) * 3 : 0), h.y, index, town.th.palette, { scale: h.s, theme: town.themeId, damage: owner && owner.houseState, decor: owner && owner.avatar.houseDecor, time: town.time, lit: town.dark > .4 });
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
  window.MT_WORLD = { FAMILIES, CIVICS, building, house, settlement };
})();
