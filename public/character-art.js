// Original modular pixel characters. No external sprite sheet or role-derived costumes.
(function () {
  const A = window.MTArt, TAU = Math.PI * 2;
  // Face parts in head-local pixels: eyes y -45..-42, brows y -47 (below the hair
  // fringe), mouth around y -36. Features are 2px+ so they read at town scale.
  const LINE = '#2e2730', MOUTH = '#825147', DARK = '#4a2626', TEETH = '#f4ecdc', SHINE = '#eee8d8';
  function eyes({ rect, e, blink, iris }, h = 4) {
    if (blink) { rect(LINE, -7 + e, -43, 4, 1); rect(LINE, 3 + e, -43, 4, 1); return; }
    rect(LINE, -7 + e, -45 - (h - 4), 4, h); rect(LINE, 3 + e, -45 - (h - 4), 4, h);
    rect(iris, -6 + e, -44, 2, 2); rect(iris, 4 + e, -44, 2, 2); rect(SHINE, -6 + e, -45, 1, 1); rect(SHINE, 4 + e, -45, 1, 1);
  }
  const closed = (rect, x, curve) => { rect(LINE, x, -43, 4, 1); if (curve) { rect(LINE, x, -44, 1, 1); rect(LINE, x + 3, -44, 1, 1); } };
  const EXPRESSIONS = {
    smile(k) { const { rect, e, b } = k; eyes(k); b(-7 + e, -47, 4, 1); b(3 + e, -47, 4, 1); rect(MOUTH, -3 + e, -36, 6, 1); rect(MOUTH, -5 + e, -37, 2, 1); rect(MOUTH, 3 + e, -37, 2, 1); },
    grin(k) { const { rect, e } = k; for (const x of [-7 + e, 3 + e]) { rect(LINE, x + 1, -45, 2, 1); rect(LINE, x, -44, 1, 2); rect(LINE, x + 3, -44, 1, 2); } rect(DARK, -4 + e, -37, 8, 3); rect(TEETH, -3 + e, -37, 6, 1); rect(DARK, -5 + e, -38, 1, 1); rect(DARK, 4 + e, -38, 1, 1); rect('#df8f86', -9, -40, 2, 1); rect('#df8f86', 7, -40, 2, 1); },
    neutral(k) { const { rect, e } = k; eyes(k); rect(MOUTH, -2 + e, -36, 4, 1); },
    serious(k) { const { rect, e, b } = k; eyes(k); b(-8 + e, -47, 6, 2); b(2 + e, -47, 6, 2); rect(DARK, -3 + e, -36, 6, 1); },
    surprised(k) { const { rect, e, b } = k; eyes(k, 5); b(-7 + e, -48, 4, 1); b(3 + e, -48, 4, 1); rect(DARK, -2 + e, -38, 4, 4); rect('#b5545a', -1 + e, -36, 2, 1); },
    scared(k) { const { rect, e, b } = k; eyes(k, 5); b(-7 + e, -48, 4, 1); b(3 + e, -48, 4, 1); rect(DARK, -3 + e, -37, 6, 3); },
    sad(k) { const { rect, e, b } = k; eyes(k); b(-8 + e, -46, 3, 1); b(-5 + e, -47, 2, 1); b(3 + e, -47, 2, 1); b(5 + e, -46, 3, 1);
      rect(MOUTH, -3 + e, -37, 6, 1); rect(MOUTH, -5 + e, -36, 2, 1); rect(MOUTH, 3 + e, -36, 2, 1); rect('#7fc4e8', -7 + e, -41, 1, 2); },
    angry(k) { const { rect, e, b } = k; eyes(k); b(-8 + e, -47, 3, 1); b(-5 + e, -46, 3, 1); b(2 + e, -46, 3, 1); b(5 + e, -47, 3, 1);
      rect(DARK, -3 + e, -37, 6, 2); rect(TEETH, -2 + e, -37, 4, 1); },
    wink(k) { const { rect, e, iris } = k; rect(LINE, -7 + e, -45, 4, 4); rect(iris, -6 + e, -44, 2, 2); rect(SHINE, -6 + e, -45, 1, 1); closed(rect, 3 + e, true);
      rect(MOUTH, -3 + e, -36, 6, 1); rect(MOUTH, 3 + e, -37, 2, 1); },
    sleepy(k) { const { rect, e, iris, skin } = k; for (const x of [-7 + e, 3 + e]) { rect(LINE, x, -43, 4, 2); rect(iris, x + 1, -42, 2, 1); rect(A.shade(skin, -.12), x, -44, 4, 1); }
      rect(MOUTH, -1 + e, -36, 3, 2); rect('#9fb4d8', 9, -51, 3, 1); rect('#9fb4d8', 11, -50, 1, 1); rect('#9fb4d8', 9, -49, 3, 1); },
    // Internal (animation-only): X eyes and a slack mouth for the dead.
    xeyes(k) { const { rect, e } = k; for (const x of [-7 + e, 3 + e]) for (let i = 0; i < 4; i++) { rect(LINE, x + i, -45 + i, 1, 1); rect(LINE, x + 3 - i, -45 + i, 1, 1); }
      rect(DARK, -3 + e, -36, 6, 1); rect('#c4555a', e, -35, 2, 2); },
    smirk(k) { const { rect, e, b } = k; eyes(k); b(2 + e, -48, 6, 1); b(-8 + e, -47, 5, 1); rect(MOUTH, -2 + e, -36, 5, 1); rect(MOUTH, 3 + e, -37, 2, 1); },
  };
  function character(ctx, x, y, av, o = {}) {
    av = av || {}; const t = o.t || 0, step = o.walking ? Math.sin(t * 11) * 2 : 0;
    const cloth = av.color || '#9d7160', hair = av.hairColor || '#543626', skin = av.skin || '#d9a273';
    const outfit = av.outfit || 'traveler', f = o.facing || 0;
    const hairstyle = ({ royalBraids:'braids',windswept:'messy',silverCrest:'mohawk' })[av.hair] || av.hair;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(o.scale || 1, o.scale || 1);
    ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    ctx.fillStyle = 'rgba(9,13,18,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 4, 0, 0, TAU); ctx.fill();
    // Rig: lean the whole body from the feet (pulling forward, resisting backward).
    if (o.lean) ctx.rotate(o.lean);
    ctx.translate(0, -(o.walking ? Math.abs(step) : Math.sin(t * 2) * 0.5) - (o.jump || 0)); if (o.spin) ctx.rotate(o.spin);
    const fx = av.effect;
    if (fx === 'fireflies' || fx === 'embers') for (let i = 0; i < 5; i++) { const a = t * .8 + i * 1.25; ctx.fillStyle = fx === 'embers' ? '#e7a969' : '#b9d88d'; ctx.fillRect(Math.cos(a) * 22, -22 + Math.sin(a * 1.3) * 28, 1, 2); }
    else if (fx === 'sparkles') for (let i = 0; i < 6; i++) { if (Math.sin(t * 6 + i * 2.1) < .2) continue; const a = t * 1.4 + i * 1.05, x = Math.cos(a) * 20, y = -30 + Math.sin(a * 1.7) * 26; ctx.fillStyle = '#fff6c0'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5); }
    else if (fx === 'snow') for (let i = 0; i < 8; i++) { ctx.fillStyle = '#f4f8ff'; ctx.fillRect(((i * 13 + t * 6) % 44) - 22, -72 + ((t * 14 + i * 17) % 72), 2, 2); }
    else if (fx === 'hearts') for (let i = 0; i < 4; i++) { const p = (t * .5 + i / 4) % 1, x = Math.sin(i * 3 + t) * 16, y = -22 - p * 50; ctx.globalAlpha *= 1; ctx.fillStyle = `rgba(255,110,160,${1 - p})`; ctx.fillRect(x - 3, y, 3, 3); ctx.fillRect(x + 1, y, 3, 3); ctx.fillRect(x - 2, y + 3, 5, 2); ctx.fillRect(x - 1, y + 5, 3, 1); }
    else if (fx === 'shadow') for (let i = 0; i < 7; i++) { const p = (t * .4 + i / 7) % 1; ctx.fillStyle = `rgba(30,12,44,${.55 * (1 - p)})`; ctx.fillRect(-14 + i * 4 + Math.sin(t * 2 + i) * 2, -4 - p * 34, 3, 6); }
    else if (fx === 'bloodMist') for (let i = 0; i < 8; i++) { const p = (t * .35 + i / 8) % 1, a = i * .8 + t * .6; ctx.fillStyle = `rgba(170,20,36,${.45 * (1 - p)})`; ctx.fillRect(Math.cos(a) * (10 + p * 14), -6 - p * 40, 3, 3); }
    else if (fx === 'goldRain') for (let i = 0; i < 9; i++) { const p = (t * .55 + i / 9) % 1, x = Math.sin(i * 2.3) * 20 + Math.sin(t + i) * 2, y = -86 + p * 86, w = Math.max(1, Math.round(3 * Math.abs(Math.cos(t * 5 + i)))); ctx.fillStyle = `rgba(255,210,63,${p < .85 ? 1 : (1 - p) / .15})`; ctx.fillRect(x - w / 2, y, w, 3); if (i % 3 === 0) { ctx.fillStyle = '#fff1a0'; ctx.fillRect(x - .5, y, 1, 1); } }
    else if (fx === 'lightning' && Math.sin(t * 2.6) > .93) { ctx.strokeStyle = '#bfe4ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-6, -82); ctx.lineTo(2, -74); ctx.lineTo(-3, -70); ctx.lineTo(5, -62); ctx.stroke(); }
    const rect = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(a), Math.round(b), w, h); };
    const dark = A.shade(cloth, -.36), light = A.shade(cloth, .24);
    const armored = ['knight', 'royalGuard', 'sheriff', 'ghostHunter', 'samuraiArmor', 'bloodKnight'].includes(outfit);
    const robe = ['wizard', 'scholar', 'alchemist', 'storyteller', 'plagueDoctor', 'dress', 'royalRobe', 'vampire'].includes(outfit);
    const cloak = ['traveler', 'assassin', 'noble', 'royalGuard', 'storyteller', 'ghostHunter', 'pirateCoat', 'vampire', 'royalRobe'].includes(outfit);
    if (av.accessory === 'backpack' || av.accessory === 'satchel') { rect('#392c26', -14, -29, 28, 22); rect('#8e7048', -13, -28, 6, 19); }
    // Behind the body: capes and wings.
    if (av.accessory === 'cape') { rect('#3a0f1a', -16, -33, 32, 32); rect('#7a2236', -15, -32, 30, 30); rect('#d6af53', -15, -33, 30, 2); }
    if (av.accessory === 'fairyWings') { const flap = Math.sin(t * 6) * 2; for (const s of [-1, 1]) { rect('rgba(190,240,255,0.75)', s > 0 ? 9 : -21 + 0, -46 - flap, 12, 14); rect('rgba(255,190,240,0.7)', s > 0 ? 9 : -19, -32 + flap, 10, 9); rect('rgba(255,255,255,0.8)', s > 0 ? 12 : -18, -44 - flap, 2, 10); } }
    if (av.accessory === 'wings' || av.accessory === 'batWings') {
      const bat = av.accessory === 'batWings', flap = Math.sin(t * 3) * 2, c1 = bat ? '#2a1a2e' : '#f4f1e6', c2 = bat ? '#5a2a4e' : '#d9e6f2';
      for (let i = 0; i < 5; i++) { const h = 20 - i * 3, dy = -42 + i * 2 - flap * (i / 4); rect(c1, 9 + i * 3, dy, 3, h); rect(c1, -12 - i * 3, dy, 3, h); }
      rect(c2, 10, -38, 2, 12); rect(c2, -12, -38, 2, 12);
    }
    if (cloak) { rect('#20242c', -14, -32, 28, 26); rect(dark, -13, -31, 26, 25); rect(light, -13, -31, 3, 20); }
    // Stride: when walking, each foot lifts in turn (not just a sideways shuffle).
    // Dragged characters plant their heels instead (feet forward, no steps).
    const lL = o.walking ? Math.max(0, Math.sin(t * 11)) * 3 : 0, lR = o.walking ? Math.max(0, -Math.sin(t * 11)) * 3 : 0;
    const heel = o.dragged ? (o.dragged > 0 ? 3 : -3) : 0;
    rect('#19222e', -9 + step + heel, -13 - lL, 7, 13); rect('#19222e', 2 - step + heel, -13 - lR, 7, 13);
    rect(av.pants || '#355879', -8 + step + heel, -12 - lL, 5, 10); rect(av.pants || '#355879', 3 - step + heel, -12 - lR, 5, 10);
    const boots = ['leatherBoots', 'tallBoots', 'armoredBoots'].includes(av.shoeStyle), shoeY = av.shoeStyle === 'tallBoots' ? -10 : boots ? -7 : -4;
    rect('#1a1a20', -10 + step + heel, shoeY - lL, 9, -shoeY); rect('#1a1a20', 2 - step + heel, shoeY - lR, 9, -shoeY);
    rect(av.shoes || '#33251d', -9 + step + heel, shoeY - lL, 7, -shoeY - 1); rect(av.shoes || '#33251d', 3 - step + heel, shoeY - lR, 7, -shoeY - 1);
    if (av.shoeStyle === 'sandals') { rect(skin, -8 + step, -5, 6, 3); rect(skin, 3 - step, -5, 6, 3); }
    if (av.shoeStyle === 'armoredBoots') { rect('#aab5ba', -9 + step, -6, 7, 3); rect('#aab5ba', 3 - step, -6, 7, 3); }
    if (av.shoeStyle === 'nobleShoes') { rect('#d2b474',-11+step,-3,8,2); rect('#d2b474',4-step,-3,8,2); }
    rect('#23232b', -11, -33, 22, 24); rect(cloth, -9, -32, 18, 22); rect(light, -9, -31, 4, 17); rect(dark, 6, -30, 3, 20);
    if (robe) for (let row = 0; row < 5; row++) { rect('#24232c', -10 - row, -17 + row * 2, 20 + row * 2, 2); rect(cloth, -9 - row, -17 + row * 2, 18 + row * 2, 2); }
    const arm = o.walking ? Math.round(step) : 0;
    if (o.arms) {
      // Rig: each arm rotates from its shoulder joint (0 = hanging down; + swings it
      // toward screen-left, - toward screen-right). Used for gripping, pulling, raising.
      const limb = (sx, angle, sleeve) => { ctx.save(); ctx.translate(sx, -29); ctx.rotate(angle || 0); rect('#28242a', -2.5, 0, 5, 15); rect(sleeve, -1.5, 1, 3.5, 10); rect(skin, -2, 11, 4, 4); ctx.restore(); };
      limb(-11.5, o.arms.l, armored ? '#89959a' : dark); limb(11.5, o.arms.r, armored ? '#b9c2bd' : cloth);
    } else {
      rect('#28242a', -14, -29 - arm, 5, 15); rect('#28242a', 9, -29 + arm, 5, 15);
      rect(armored ? '#89959a' : dark, -13, -28 - arm, 4, 10); rect(armored ? '#b9c2bd' : cloth, 10, -28 + arm, 3, 10);
      rect(skin, -13, -18 - arm, 4, 4); rect(skin, 10, -18 + arm, 4, 4);
    }
    rect('#4c3529', -10, -15, 20, 3); rect('#d2b474', 0, -15, 3, 3);
    if (armored) { rect('#48505b', -9, -30, 18, 13); rect('#bec6bf', -8, -29, 15, 10); rect('#7c8990', 1, -29, 5, 10); rect('#d6bb7b', -2, -26, 4, 6); }
    if (['farmer', 'worker', 'overalls'].includes(outfit)) { rect('#455a61', -8, -27, 3, 16); rect('#455a61', 5, -27, 3, 16); rect('#455a61', -7, -22, 14, 10); rect('#d1b586', -5, -23, 2, 2); }
    if (['merchant', 'noble', 'mafiaSuit', 'detectiveCoat', 'jacket'].includes(outfit)) { rect('#e4d7b5', -3, -32, 6, 12); rect('#b8a078', -1, -30, 2, 10); for (let i = 0; i < 3; i++) rect('#d4bf83', 2, -20 + i * 3, 2, 1); }
    if (outfit === 'jester') { rect('#83517f', -9, -30, 9, 17); rect('#d2ad61', 1, -30, 7, 17); }
    // Wave 2 outfits.
    if (outfit === 'pirateCoat') { rect('#2b2018', -10, -32, 20, 24); rect('#c9a24a', -1, -30, 2, 18); rect('#9a2a2a', -10, -17, 20, 3); for (let i = 0; i < 3; i++) rect('#e6c778', -5, -28 + i * 5, 2, 2); }
    if (outfit === 'samuraiArmor') { rect('#7a1f1f', -10, -31, 20, 16); for (let i = 0; i < 3; i++) rect('#2a1a1a', -10, -27 + i * 5, 20, 1); rect('#d6af53', -2, -31, 4, 3); }
    if (outfit === 'bloodKnight') { rect('#3a0d14', -9, -30, 18, 15); rect('#8f1a2a', -8, -29, 16, 12); rect('#ff3a4a', -1, -26, 3, 3); }
    if (outfit === 'royalRobe') { rect('#5a2a8a', -10, -32, 20, 22); rect('#f2ead6', -11, -33, 22, 4); for (let i = 0; i < 5; i++) rect('#2b2018', -9 + i * 4, -32, 1, 2); rect('#d6af53', -1, -29, 2, 16); }
    if (outfit === 'cyber') { rect('#1a2030', -9, -32, 18, 22); rect('#3af0ff', -9, -24, 18, 1); rect('#3af0ff', -1, -32, 1, 22); rect('#ff3af0', 5, -30, 2, 2); }
    if (outfit === 'vampire') { rect('#16121a', -10, -32, 20, 22); rect('#8f1a2a', -4, -32, 8, 10); rect('#16121a', -14, -37, 6, 9); rect('#16121a', 8, -37, 6, 9); rect('#e6e0d6', -2, -31, 4, 6); }
    // Themes v2 world outfits.
    if (outfit === 'spaceSuit') { rect('#e4e8f3', -10, -32, 20, 24); rect('#b9c1da', -10, -20, 20, 3); rect('#4fb3ff', -6, -29, 5, 4); rect('#ff5a5a', 2, -29, 3, 2); rect('#8f7bff', 2, -26, 3, 2); }
    if (outfit === 'dragonScale') { rect('#5a1a10', -10, -32, 20, 22); for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) rect(r % 2 ? '#a8321e' : '#c2501f', -9 + c * 5 + (r % 2) * 2, -31 + r * 5, 3, 3); rect('#e9c46a', -1, -32, 2, 22); }
    if (outfit === 'rogueLeathers') { rect('#3a2a1e', -10, -32, 20, 22); rect('#5a3e28', -10, -32, 6, 22); rect('#2a1a10', -10, -18, 20, 3); rect('#c9a24a', -2, -18, 4, 3); rect('#2a1a10', 4, -30, 2, 14); }
    if (outfit === 'tuxedo') { rect('#16161c', -10, -32, 20, 22); rect('#f4f4f4', -3, -32, 6, 14); rect('#16161c', -1, -32, 2, 3); rect('#c0283c', -2, -31, 4, 2); rect('#16161c', -1, -26, 2, 1); rect('#16161c', -1, -22, 2, 1); }
    if (outfit === 'fedJacket') { rect('#1d3557', -10, -32, 20, 22); rect('#ffd21f', -7, -26, 14, 4); rect('#1d3557', -6, -25, 2, 2); rect('#1d3557', -2, -25, 2, 2); rect('#1d3557', 2, -25, 2, 2); rect('#e4dfcf', -2, -32, 4, 3); }
    if (outfit === 'parka') { rect('#c0392b', -11, -32, 22, 24); rect('#f2ead6', -12, -34, 24, 4); rect('#a02a1e', -1, -30, 2, 22); rect('#f2ead6', -11, -11, 22, 2); }
    if (outfit === 'blockArmor') { rect('#8fd0e8', -10, -32, 20, 22); rect('#5ab0d0', -10, -32, 20, 4); rect('#5ab0d0', -10, -20, 20, 2); rect('#d6f2ff', -8, -30, 4, 4); rect('#5ab0d0', -2, -28, 4, 6); }
    if (outfit === 'denimJacket') { rect('#3d5f8a', -10, -32, 20, 22); rect('#2e4a6e', -1, -32, 2, 22); rect('#e6e1d8', -3, -32, 6, 6); rect('#c9a24a', -6, -24, 2, 2); rect('#c9a24a', 4, -24, 2, 2); rect('#2e4a6e', -10, -14, 20, 2); }
    if (outfit === 'trenchCoat') { rect('#8a7a5a', -11, -32, 22, 26); rect('#6a5a40', -11, -20, 22, 3); rect('#6a5a40', -1, -32, 2, 26); rect('#d8d0b8', -4, -32, 3, 5); rect('#d8d0b8', 1, -32, 3, 5); rect('#3a3020', -7, -27, 2, 2); }
    if (av.accessory === 'badge') { rect('#d6af53', 3, -28, 6, 6); rect('#ffe48a', 4, -27, 4, 4); rect('#1d3557', 5, -26, 2, 2); }
    if (av.accessory === 'diceBag') { rect('#6a3a5a', 8, -20, 7, 8); rect('#8a5a7a', 9, -19, 5, 2); rect('#d6af53', 10, -22, 3, 2); rect('#c0283c', 14, -16, 3, 3); }
    if (av.accessory === 'wristwatch') { rect('#3a3a3a', -14, -16, 4, 3); rect('#e6e1d8', -13, -16, 2, 2); }
    if (av.accessory === 'torch') { const f = Math.sin(t * 12) > 0; rect('#5a3a20', 12, -26, 3, 14); rect(f ? '#ff9a2a' : '#ffb34a', 11, -32, 5, 6); rect('#ffe08a', 12, -30, 3, 3); }
    if (av.accessory === 'scarf') { rect('#e1b15f', -11, -33, 22, 4); rect('#ad7149', 5, -29, 4, 12); }
    if (av.accessory === 'amulet' || ['wizard', 'alchemist'].includes(outfit)) { rect('#d7b375', 0, -29, 2, 8); rect('#70c4bf', -2, -23, 6, 4); }
    // Long styles behind the head, then face, then fringes/headgear.
    if (['long', 'wavy', 'braids', 'bob', 'medium'].includes(hairstyle)) { rect('#251f25', -12, -52, 24, hairstyle === 'bob' ? 22 : 29); rect(hair, -11, -52, 22, hairstyle === 'bob' ? 20 : 27); }
    const faceW = av.face === 'oval' ? 16 : 20;
    rect('#30252a', -faceW / 2 - 1, -53, faceW + 2, 21); rect(skin, -faceW / 2, -52, faceW, 19);
    rect(A.shade(skin, -.18), faceW / 2 - 3, -50, 3, 17); rect(skin, -12, -45, 3, 7); rect(skin, 9, -45, 3, 7);
    if (av.face !== 'square') { rect('#30252a', -faceW / 2, -34, 3, 2); rect('#30252a', faceW / 2 - 3, -34, 3, 2); }
    const blink = Math.sin(t * 1.3 + (o.seed || 0)) > .985, eyeX = Math.round(f * 2);
    // Expressions: eyes, brows and mouth. A live animation state (scared) overrides the chosen mood.
    const mood = o.dead ? 'xeyes' : o.scared ? 'scared' : EXPRESSIONS[av.expression] ? av.expression : av.features === 'serious' ? 'serious' : 'smile';
    const brows = [], browColor = A.shade(hair, -.25);
    EXPRESSIONS[mood]({ rect, e: eyeX, blink, iris: av.eyes || '#342b25', b: (...r) => brows.push(r), skin });
    rect(A.shade(skin, -.25), eyeX, -41, 2, 3);
    if (av.features === 'freckles') for (const dx of [-8, -5, 5, 8]) rect('#a76c50', dx, -39, 1, 1);
    if (av.features === 'rosyCheeks') { rect('#df8f86', -9, -39, 3, 2); rect('#df8f86', 6, -39, 3, 2); }
    if (av.facialHair === 'moustache') rect(hair, -5, -38, 10, 2);
    if (av.facialHair === 'beard') { rect(hair, -8, -38, 16, 5); rect(hair, -5, -33, 10, 3); }
    const style = hairstyle || 'short';
    if (style !== 'bald') {
      rect('#2a2228', -11, -56, 22, 6); rect(hair, -10, -55, 20, style === 'buzzCut' ? 3 : 7);
      if (!['buzzCut', 'slickedBack', 'mohawk'].includes(style)) rect(hair, -10, -50, style === 'sidePart' ? 7 : 16, 3);
      if (['messy', 'curly', 'afro', 'wavy'].includes(style)) for (let i = 0; i < (style === 'afro' ? 9 : 6); i++) rect(hair, -13 + i * 3, -56 - (i % 3) * 2, 6, style === 'afro' ? 12 : 6);
      if (style === 'mohawk') { rect(hair, -3, -64, 6, 15); rect(A.shade(hair, .3), -3, -63, 2, 9); }
      if (style === 'undercut') { rect(A.shade(hair, .35), -10, -49, 3, 8); rect(hair, -6, -58, 17, 9); }
      if (style === 'ponytail') { rect(hair, 10, -52, 6, 23); rect('#d1aa68', 10, -49, 5, 2); }
      if (style === 'bun') { rect('#2a2228', -6, -63, 12, 8); rect(hair, -5, -62, 10, 7); }
      if (style === 'braids') for (let i = 0; i < 6; i++) { rect(hair, -13 + i % 2, -49 + i * 4, 5, 4); rect(hair, 9 - i % 2, -49 + i * 4, 5, 4); }
      rect(A.shade(hair, .22), -8, -54, style === 'slickedBack' ? 16 : 7, 2);
    }
    // Brows sit over the fringe so raised/lowered brows stay visible on every hairstyle.
    for (const [x, y, w, h] of brows) rect(browColor, x, y, w, h);
    const hat = av.hat;
    // Executioner hoods cover the whole head and face (only eye holes show).
    // 'execHood' is the anonymous NPC executioner; 'executionerHood' is the Hood of Mercy cosmetic.
    if (hat === 'execHood' || hat === 'executionerHood') {
      const mercy = hat === 'executionerHood', c = mercy ? '#8e1f2c' : '#17161b', c2 = mercy ? '#6a1420' : '#0d0c10';
      rect('#09080b', -13, -63, 26, 32); rect(c, -12, -62, 24, 30); rect(c2, 6, -60, 6, 27);
      rect(c, -7, -67, 14, 6); rect(c, -3, -70, 6, 4); rect(c, -15, -36, 30, 5); // peak + shoulders
      rect('#050406', -8 + eyeX, -47, 6, 4); rect('#050406', 2 + eyeX, -47, 6, 4); // eye holes
      rect(mercy ? '#f3d27a' : '#c8b9a4', -6 + eyeX, -46, 2, 2); rect(mercy ? '#f3d27a' : '#c8b9a4', 4 + eyeX, -46, 2, 2);
      if (mercy) { rect('#d6af53', -12, -33, 24, 2); rect('#d6af53', -1, -60, 2, 8); rect('#d6af53', -3, -57, 6, 2); }
    }
    if (hat === 'bandana') { rect('#9c4d4d',-12,-55,24,5); rect('#c37b65',-10,-54,20,1); rect('#9c4d4d',10,-51,6,13); }
    if (['hood', 'plagueHat'].includes(hat)) { rect(dark, -14, -59, 28, 9); rect(dark, -14, -51, 4, 18); rect(dark, 10, -51, 4, 18); if (hat === 'plagueHat') { rect('#d7d0b8', -6, -43, 16, 7); rect('#a29b83', 9, -41, 8, 3); } }
    else if (['wizardHat', 'party'].includes(hat)) { for (let i = 0; i < 7; i++) rect(hat === 'party' ? '#af6c99' : '#3d526b', -i * 2, -73 + i * 3, i * 4 + 2, 3); rect('#c1aa75', -16, -54, 32, 3); }
    else if (['helmet', 'cap', 'beanie', 'top', 'cowboy', 'wideBrim', 'chef', 'jesterHat', 'flowerCrown', 'crown', 'bow'].includes(hat)) {
      const metal = hat === 'crown' ? '#d6af53' : hat === 'helmet' ? '#a6b2b6' : hat === 'chef' ? '#eae5d7' : dark;
      rect('#27242d', -13, -61, 26, 10); rect(metal, -12, -60, 24, 9); rect(A.shade(metal, .25), -12, -60, 5, 7);
      if (['top','cowboy','wideBrim','plagueHat'].includes(hat)) rect(metal, -17, -52, 34, 3);
      if (hat === 'top') rect(metal, -9, -71, 18, 14);
      if (hat === 'helmet') rect('#d3dbd5', -2, -59, 4, 14);
      if (hat === 'crown' || hat === 'flowerCrown' || hat === 'jesterHat') for (let i = 0; i < 4; i++) rect(hat === 'flowerCrown' ? '#c97991' : '#e6c778', -12 + i * 7, -65 - i % 2 * 2, 4, 6);
    }
    // Wave 2 + Season 1 hats.
    if (hat === 'halo') { ctx.strokeStyle = '#ffe48a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -65, 11, 3, 0, 0, TAU); ctx.stroke(); }
    if (hat === 'pirate') { rect('#1a1418', -16, -60, 32, 7); rect('#1a1418', -10, -66, 20, 7); rect('#e6e0d6', -2, -63, 4, 3); }
    if (hat === 'samurai' || hat === 'vikingHelm') {
      rect('#27242d', -13, -61, 26, 10); rect(hat === 'samurai' ? '#2a2a32' : '#a6b2b6', -12, -60, 24, 9);
      if (hat === 'samurai') { rect('#d6af53', -8, -68, 3, 8); rect('#d6af53', 5, -68, 3, 8); rect('#7a1f1f', -14, -52, 28, 3); }
      else { rect('#e6dcc0', -18, -66, 5, 9); rect('#e6dcc0', 13, -66, 5, 9); rect('#e6dcc0', -20, -70, 3, 5); rect('#e6dcc0', 17, -70, 3, 5); }
    }
    if (hat === 'antlers') for (const s of [-1, 1]) { rect('#6a4a2a', s * 6 - 1, -66, 2, 12); rect('#6a4a2a', s * 8 - 1, -71, 2, 6); rect('#6a4a2a', s * 11 - 1, -66, 2, 5); }
    if (hat === 'catEars') for (const s of [-1, 1]) { rect(hair, s * 7 - 3, -61, 6, 6); rect(hair, s * 7 - 2, -64, 4, 3); rect('#e8a0b0', s * 7 - 1, -61, 2, 3); }
    if (hat === 'beret') { rect('#2a2a3a', -13, -60, 24, 6); rect('#3a3a4e', -12, -61, 20, 4); rect('#2a2a3a', -1, -64, 2, 3); }
    if (hat === 'pumpkin') { rect('#c4561a', -14, -66, 28, 24); rect('#e0702a', -12, -64, 24, 20); rect('#3a6a2a', -2, -70, 4, 5); rect('#1a0a04', -8 + eyeX, -58, 5, 4); rect('#1a0a04', 3 + eyeX, -58, 5, 4); rect('#1a0a04', -6 + eyeX, -50, 12, 3); }
    if (hat === 'bloodCrown') { rect('#3a0d14', -12, -60, 24, 6); for (let i = 0; i < 5; i++) rect('#8f1a2a', -12 + i * 6, -66 - (i % 2) * 2, 4, 7); rect('#ff3a4a', -2, -59, 4, 3); }
    // Themes v2 world hats.
    if (hat === 'spaceHelmet') { ctx.strokeStyle = 'rgba(200,240,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -44, 15, 0, TAU); ctx.stroke(); rect('rgba(220,245,255,0.9)', -12, -55, 2, 5); rect('rgba(220,245,255,0.9)', -10, -57, 3, 2); rect('#e4e8f3', -14, -33, 28, 3); rect('#ff5a5a', 10, -60, 2, 4); }
    if (hat === 'elfCirclet') { rect('#d6af53', -12, -56, 24, 2); rect('#9fe8ff', -2, -59, 4, 4); rect('#d6af53', -14, -55, 3, 2); rect('#d6af53', 11, -55, 3, 2); rect(skin, -14, -47, 3, 3); rect(skin, 11, -47, 3, 3); }
    if (hat === 'dragonHorns') for (const s of [-1, 1]) { rect('#3a1a10', s * 7 - 2, -60, 4, 6); rect('#5a2a18', s * 9 - 2, -64, 4, 5); rect('#e9e2cf', s * 11 - 2, -68, 3, 5); }
    if (hat === 'furHat') { rect('#7a5434', -14, -60, 28, 10); rect('#a8845a', -13, -61, 26, 4); rect('#7a5434', -15, -52, 5, 12); rect('#7a5434', 10, -52, 5, 12); rect('#e6dcc0', -13, -53, 3, 6); rect('#e6dcc0', 10, -53, 3, 6); }
    if (hat === 'cubeHelm') { rect('#5a5a5a', -14, -62, 28, 12); rect('#7a7a7a', -13, -61, 26, 4); rect('#5a5a5a', -14, -52, 4, 8); rect('#5a5a5a', 10, -52, 4, 8); rect('#9fe8ff', -2, -60, 4, 3); }
    if (hat === 'featherCap') { rect('#2a5a3a', -13, -59, 26, 8); rect('#3a7a4a', -12, -60, 20, 3); rect('#2a5a3a', 6, -57, 10, 3); rect('#c0283c', -12, -66, 2, 10); rect('#e04a5a', -14, -68, 3, 4); }
    // High Roller line (tiers 2 and 3).
    if (hat === 'dealerVisor') { rect('#1f7a4a', -14, -55, 28, 3); rect('#2fa060', -16, -53, 22, 3); rect('rgba(140,230,170,.55)', -16, -52, 22, 2); rect('#f6f2e6', 9, -61, 6, 8); rect('#c0283c', 11, -59, 2, 2); }
    if (hat === 'highRoller') { rect('#141018', -17, -52, 34, 3); rect('#1c1622', -11, -70, 22, 18); rect('#2a2230', -11, -70, 22, 2); rect('#e2b23c', -11, -57, 22, 3); for (let i = 0; i < 4; i++) rect(Math.sin(t * 3 + i) > .4 ? '#ffffff' : '#9fe8ff', -9 + i * 5, -56, 2, 1); rect('#f6f2e6', 6, -68, 6, 9); rect('#141018', 8, -66, 2, 2); }
    if (hat === 'fedora') { rect('#2a2a2e', -17, -52, 34, 3); rect('#2a2a2e', -11, -61, 22, 9); rect('#3a3a40', -11, -61, 22, 2); rect('#8a1f1f', -11, -55, 22, 2); }
    if (av.accessory === 'shades') { rect('#101014', -9 + eyeX, -46, 8, 4); rect('#101014', 1 + eyeX, -46, 8, 4); rect('#101014', -1 + eyeX, -45, 2, 1); rect('rgba(255,255,255,0.35)', -8 + eyeX, -46, 2, 1); }
    // Wave 2 face/neck accessories.
    if (av.accessory === 'mask') { rect('#2a1a3a', -10 + eyeX, -48, 20, 6); rect('#d6af53', -10 + eyeX, -48, 20, 1); rect('#0a0610', -8 + eyeX, -47, 6, 4); rect('#0a0610', 2 + eyeX, -47, 6, 4); }
    if (av.accessory === 'goldChain') { for (let i = 0; i < 6; i++) rect('#e6c778', -6 + i * 2, -31 + Math.abs(i - 2.5), 2, 2); rect('#ffd96b', -2, -27, 4, 4); }
    if (av.accessory === 'pipe') { rect('#5a3a20', 4 + eyeX, -37, 7, 2); rect('#3a2414', 10 + eyeX, -40, 4, 4); }
    if (av.accessory === 'rose') { rect('#3a7a3a', 7, -26, 1, 8); rect('#c0283c', 6, -29, 4, 4); }
    if (av.accessory === 'glasses') { ctx.strokeStyle = '#293039'; ctx.lineWidth = 1; ctx.strokeRect(-9 + eyeX, -47, 8, 7); ctx.strokeRect(1 + eyeX, -47, 8, 7); }
    if (av.accessory === 'eyepatch') { rect('#191f29', -8 + eyeX, -46, 7, 6); rect('#191f29', -11, -49, 22, 1); }
    if (av.accessory === 'earring') rect('#ead18a', 11, -40, 2, 5);
    if (av.accessory === 'monocle') { ctx.strokeStyle='#d1b574';ctx.lineWidth=1;ctx.beginPath();ctx.arc(5+eyeX,-43,5,0,TAU);ctx.stroke();rect('#d1b574',10,-39,1,10); }
    if (av.hair === 'royalBraids') { rect('#d5b66f',-11,-31,4,3); rect('#d5b66f',9,-31,4,3); }
    if (av.hair === 'windswept') rect(hair,4,-63,12,4);
    if (av.hair === 'silverCrest') rect('#ddd8ca',-2,-64,3,8);
    if (av.faceSprite) { ctx.imageSmoothingEnabled = false; ctx.drawImage(av.faceSprite, -8, -50, 16, 16); }
    if (o.theme === 'space') { rect('#7ed6cf', -10, -25, 3, 6); rect('#c4d8da', 6, -26, 3, 10); }
    if (o.theme === 'fantasy') { rect('#c8b6df', -1, -30, 2, 9); rect('#7ed6cf', -3, -24, 6, 4); }
    // RSP Supply: everyone wears the company lanyard; a blue-and-yellow ID badge on the chest.
    if (o.theme === 'rsp') { rect('#1f4fa8', -5, -33, 2, 12); rect('#1f4fa8', 3, -33, 2, 12); rect('#1f4fa8', -5, -22, 10, 1); rect('#ffd21f', -4, -21, 8, 7); rect('#1f4fa8', -3, -20, 6, 2); rect('#0f2a63', -2, -17, 4, 1); }
    if (['spies','fbi'].includes(o.theme)) { rect('#d0c8b7', -4, -32, 8, 7); rect('#32333e', -1, -28, 2, 9); rect('#c4ad73', 5, -27, 3, 3); }
    ctx.restore();
  }
  A.drawCharacter = character; A.EXPRESSIONS = Object.keys(EXPRESSIONS).filter((k) => !['scared', 'xeyes'].includes(k));
  // Ghost looks: Classic is the see-through townsperson; the others are costume ghosts (avatar.js).
  const costumeGhost = A.drawGhost;
  A.drawGhost = function (ctx, x, y, av, o = {}) { if (av && av.ghostSkin && av.ghostSkin !== 'classic' && costumeGhost) { costumeGhost(ctx, x, y, av, { ...o, scale: (o.scale || 1) * 1.4 }); return; } ctx.save(); ctx.globalAlpha *= .52; ctx.shadowColor = '#a8d6df'; ctx.shadowBlur = o.glow ? 15 : 4; character(ctx, x, y - 7 + Math.sin((o.t || 0) * 2.5 + (o.seed || 0)) * 4, av, { ...o, alpha: o.alpha == null ? .85 : o.alpha }); ctx.restore(); };
})();
