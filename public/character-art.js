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
    ctx.translate(0, -(o.walking ? Math.abs(step) : Math.sin(t * 2) * 0.5) - (o.jump || 0)); if (o.spin) ctx.rotate(o.spin);
    if (av.effect && av.effect !== 'none') for (let i = 0; i < 5; i++) { const a = t * .8 + i * 1.25; ctx.fillStyle = av.effect === 'embers' ? '#e7a969' : '#b9d88d'; ctx.fillRect(Math.cos(a) * 22, -22 + Math.sin(a * 1.3) * 28, 1, 2); }
    const rect = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(a), Math.round(b), w, h); };
    const dark = A.shade(cloth, -.36), light = A.shade(cloth, .24);
    const armored = ['knight', 'royalGuard', 'sheriff', 'ghostHunter'].includes(outfit);
    const robe = ['wizard', 'scholar', 'alchemist', 'storyteller', 'plagueDoctor', 'dress'].includes(outfit);
    const cloak = ['traveler', 'assassin', 'noble', 'royalGuard', 'storyteller', 'ghostHunter'].includes(outfit);
    if (av.accessory === 'backpack' || av.accessory === 'satchel') { rect('#392c26', -14, -29, 28, 22); rect('#8e7048', -13, -28, 6, 19); }
    if (cloak) { rect('#20242c', -14, -32, 28, 26); rect(dark, -13, -31, 26, 25); rect(light, -13, -31, 3, 20); }
    rect('#19222e', -9 + step, -13, 7, 13); rect('#19222e', 2 - step, -13, 7, 13);
    rect(av.pants || '#355879', -8 + step, -12, 5, 10); rect(av.pants || '#355879', 3 - step, -12, 5, 10);
    const boots = ['leatherBoots', 'tallBoots', 'armoredBoots'].includes(av.shoeStyle), shoeY = av.shoeStyle === 'tallBoots' ? -10 : boots ? -7 : -4;
    rect('#1a1a20', -10 + step, shoeY, 9, -shoeY); rect('#1a1a20', 2 - step, shoeY, 9, -shoeY);
    rect(av.shoes || '#33251d', -9 + step, shoeY, 7, -shoeY - 1); rect(av.shoes || '#33251d', 3 - step, shoeY, 7, -shoeY - 1);
    if (av.shoeStyle === 'sandals') { rect(skin, -8 + step, -5, 6, 3); rect(skin, 3 - step, -5, 6, 3); }
    if (av.shoeStyle === 'armoredBoots') { rect('#aab5ba', -9 + step, -6, 7, 3); rect('#aab5ba', 3 - step, -6, 7, 3); }
    if (av.shoeStyle === 'nobleShoes') { rect('#d2b474',-11+step,-3,8,2); rect('#d2b474',4-step,-3,8,2); }
    rect('#23232b', -11, -33, 22, 24); rect(cloth, -9, -32, 18, 22); rect(light, -9, -31, 4, 17); rect(dark, 6, -30, 3, 20);
    if (robe) for (let row = 0; row < 5; row++) { rect('#24232c', -10 - row, -17 + row * 2, 20 + row * 2, 2); rect(cloth, -9 - row, -17 + row * 2, 18 + row * 2, 2); }
    const arm = o.walking ? Math.round(step) : 0;
    rect('#28242a', -14, -29 - arm, 5, 15); rect('#28242a', 9, -29 + arm, 5, 15);
    rect(armored ? '#89959a' : dark, -13, -28 - arm, 4, 10); rect(armored ? '#b9c2bd' : cloth, 10, -28 + arm, 3, 10);
    rect(skin, -13, -18 - arm, 4, 4); rect(skin, 10, -18 + arm, 4, 4);
    rect('#4c3529', -10, -15, 20, 3); rect('#d2b474', 0, -15, 3, 3);
    if (armored) { rect('#48505b', -9, -30, 18, 13); rect('#bec6bf', -8, -29, 15, 10); rect('#7c8990', 1, -29, 5, 10); rect('#d6bb7b', -2, -26, 4, 6); }
    if (['farmer', 'worker', 'overalls'].includes(outfit)) { rect('#455a61', -8, -27, 3, 16); rect('#455a61', 5, -27, 3, 16); rect('#455a61', -7, -22, 14, 10); rect('#d1b586', -5, -23, 2, 2); }
    if (['merchant', 'noble', 'mafiaSuit', 'detectiveCoat', 'jacket'].includes(outfit)) { rect('#e4d7b5', -3, -32, 6, 12); rect('#b8a078', -1, -30, 2, 10); for (let i = 0; i < 3; i++) rect('#d4bf83', 2, -20 + i * 3, 2, 1); }
    if (outfit === 'jester') { rect('#83517f', -9, -30, 9, 17); rect('#d2ad61', 1, -30, 7, 17); }
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
    const mood = o.scared ? 'scared' : EXPRESSIONS[av.expression] ? av.expression : av.features === 'serious' ? 'serious' : 'smile';
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
  A.drawCharacter = character; A.EXPRESSIONS = Object.keys(EXPRESSIONS).filter((k) => k !== 'scared');
  A.drawGhost = function (ctx, x, y, av, o = {}) { ctx.save(); ctx.globalAlpha *= .52; ctx.shadowColor = '#a8d6df'; ctx.shadowBlur = o.glow ? 15 : 4; character(ctx, x, y - 7 + Math.sin((o.t || 0) * 2.5 + (o.seed || 0)) * 4, av, { ...o, alpha: o.alpha == null ? .85 : o.alpha }); ctx.restore(); };
})();
