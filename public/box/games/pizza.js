'use strict';
// YesChef (key `pizza`): TV and phone screens. The YesChef food court: on the TV a customer walks
// up to tonight's counter (pizzeria, taco truck, sushi bar, burger joint or sundae stand) and
// shows (or reads out) the dish they want; the owner (drawn with the intro's own characters,
// BOX.intros.pizza.owners) runs the kitchen; the reveal puts every cook's dish next to the order.
// The back wall is the intro's kitchen set (BOX.intros.pizza.backdrop) painted once on a canvas.
// Each phone becomes that kitchen's station: the base choices, then toppings painted onto slices,
// tacos or sushi pieces, or layers stacked in order (burgers, sundae scoops).
(function () {
  const { esc, timer } = BOX;
  const av = (r) => esc((r && r.avatar) || '🙂');
  const f1 = (n) => Math.round(n * 10) / 10;
  const face = (score) => (score >= 95 ? '😍' : score >= 80 ? '😋' : score >= 60 ? '🙂' : score >= 35 ? '😐' : '😖');
  const OL = '#2a160c';

  // ---------------- the kitchens (what the phones and TV need to know) ----------------
  const K = {
    pizza: {
      name: 'Pizzeria Pina', owner: 'Nonna Pina', dish: 'pizza', icon: '🍕', sign: ['Pizzeria', 'Pina'],
      rows: [
        { key: 'crust', label: 'Crust', opts: [['thin', 'Thin'], ['classic', 'Classic'], ['deep', 'Deep dish']], cls: 'crust' },
        { key: 'sauce', label: 'Sauce', opts: [['tomato', 'Tomato', '#c8321f'], ['white', 'White', '#f1e6c8'], ['pesto', 'Pesto', '#4f8a2b'], ['bbq', 'BBQ', '#6b2a14'], ['none', 'None', '#f0cf93']] },
        { key: 'cheese', label: 'Cheese', opts: [[0, 'No cheese'], [1, 'Cheese'], [2, 'Extra']], cls: 'ch', num: true },
      ],
      slots: 8, tops: ['pepperoni', 'mushroom', 'pepper', 'olive', 'onion', 'pineapple', 'ham', 'basil', 'jalapeno', 'sausage'],
      names: { pepperoni: 'Pepperoni', mushroom: 'Mushroom', pepper: 'Pepper', olive: 'Olive', onion: 'Onion', pineapple: 'Pineapple', ham: 'Ham', basil: 'Basil', jalapeno: 'Jalapeño', sausage: 'Sausage' },
      hint: 'tap or swipe the slices', all: '🍕 All over',
      mood: { great: ['😍', 'Perfetto!'], ok: ['🙂', 'Not bad!'], bad: ['😖', 'Mamma mia…'] },
      greet: 'Hi! I’d like exactly this one, please!', ring: 'Ring ring! Hello, Nonna? I’d like to order…',
    },
    taco: {
      name: 'El Cohete', owner: 'Tía Lupe', dish: 'taco plate', icon: '🌮', sign: ['El', 'Cohete'],
      rows: [
        { key: 'shell', label: 'Shell', opts: [['corn', 'Corn', '#f2c14e'], ['flour', 'Flour', '#f6e6c4'], ['crunchy', 'Crunchy', '#e39a2e']] },
        { key: 'filling', label: 'Filling', opts: [['asada', 'Asada', '#6b3a1f'], ['chicken', 'Chicken', '#e0b070'], ['pastor', 'Pastor', '#d4552a'], ['fish', 'Fish', '#f0c870'], ['beans', 'Beans', '#3a2224']] },
        { key: 'salsa', label: 'Salsa', opts: [['verde', 'Verde', '#4f9a3a'], ['roja', 'Roja', '#b8321f'], ['mango', 'Mango', '#ffb030'], ['none', 'None', '#eeeeee']] },
      ],
      slots: 3, tops: ['onion', 'cilantro', 'lime', 'pineapple', 'queso', 'lettuce', 'pico', 'avocado', 'radish', 'jalapeno'],
      names: { onion: 'Onion', cilantro: 'Cilantro', lime: 'Lime', pineapple: 'Pineapple', queso: 'Queso', lettuce: 'Lettuce', pico: 'Pico', avocado: 'Avocado', radish: 'Radish', jalapeno: 'Jalapeño' },
      hint: 'tap the tacos that get it', all: '🌮 All three',
      mood: { great: ['😍', '¡Delicioso!'], ok: ['🙂', 'Not bad!'], bad: ['😖', 'Ay, no…'] },
      greet: 'Hola! This plate, please!', ring: 'Ring ring! Tía Lupe? Can I get…',
    },
    sushi: {
      name: 'Ren’s Sushi Bar', owner: 'Chef Ren', dish: 'roll', icon: '🍣', sign: ['Ren’s', 'Sushi'],
      rows: [
        { key: 'wrap', label: 'Wrap', opts: [['nori', 'Nori', '#1f2d1f'], ['soy', 'Soy paper', '#f6a3b9'], ['cucumber', 'Cucumber', '#79b84a']] },
        { key: 'rice', label: 'Rice', opts: [['white', 'White', '#fbfaf5'], ['brown', 'Brown', '#d8c09a'], ['black', 'Black', '#4a3550']] },
        { key: 'filling', label: 'Inside', opts: [['salmon', 'Salmon', '#ff8c5a'], ['tuna', 'Tuna', '#c8243c'], ['crab', 'Crab', '#f4f1ea'], ['shrimp', 'Shrimp', '#f2b84a'], ['veggie', 'Veggie', '#7ac943']] },
      ],
      slots: 8, tops: ['roe', 'sesame', 'scallion', 'mayo', 'eel', 'avocado', 'crunch', 'jalapeno', 'lemon', 'chili'],
      names: { roe: 'Roe', sesame: 'Sesame', scallion: 'Scallion', mayo: 'Spicy mayo', eel: 'Eel sauce', avocado: 'Avocado', crunch: 'Crunch', jalapeno: 'Jalapeño', lemon: 'Lemon', chili: 'Chili' },
      hint: 'tap or swipe the pieces', all: '🍣 Every piece',
      mood: { great: ['😍', 'Exquisite!'], ok: ['🙂', 'Pretty good.'], bad: ['😖', 'Hmm…'] },
      greet: 'Good evening. This roll, please.', ring: 'Hello, Chef Ren? An order, please…',
    },
    burger: {
      name: 'Buck’s Burger Joint', owner: 'Big Buck', dish: 'burger', icon: '🍔', sign: ['Buck’s', 'Burgers'],
      rows: [{ key: 'bun', label: 'Bun', opts: [['sesame', 'Sesame', '#e8a04a'], ['brioche', 'Brioche', '#c9772e'], ['pretzel', 'Pretzel', '#7a4a24'], ['lettuce', 'Lettuce', '#6fc24a']] }],
      stack: ['patty', 'cheese', 'bacon', 'lettuce', 'tomato', 'onion', 'pickle', 'egg', 'ketchup', 'mustard'], max: 10,
      names: { patty: 'Patty', cheese: 'Cheese', bacon: 'Bacon', lettuce: 'Lettuce', tomato: 'Tomato', onion: 'Onion', pickle: 'Pickles', egg: 'Egg', ketchup: 'Ketchup', mustard: 'Mustard' },
      hint: 'tap to stack, bottom to top', undo: '↩ Take top off',
      mood: { great: ['😍', 'Yee-haw!'], ok: ['🙂', 'Not bad!'], bad: ['😖', 'Yikes…'] },
      greet: 'Howdy! One of these, please!', ring: 'Drive-thru? Yeah, I’ll have…',
    },
    sundae: {
      name: 'Coco’s Sundae Stand', owner: 'Coco Sprinkles', dish: 'sundae', icon: '🍨', sign: ['Coco’s', 'Sundaes'],
      rows: [
        { key: 'vessel', label: 'In a', opts: [['cone', 'Cone', '#e0a458'], ['cup', 'Cup', '#d8f0ff'], ['bowl', 'Bowl', '#c98a3e']] },
        { key: 'sauce', label: 'Sauce', opts: [['fudge', 'Fudge', '#4a2414'], ['caramel', 'Caramel', '#d98a2a'], ['berry', 'Berry', '#e0304a'], ['none', 'None', '#eeeeee']] },
      ],
      stack: ['vanilla', 'chocolate', 'strawberry', 'mint', 'mango', 'blueberry'], max: 4,
      slots: 1, tops: ['whip', 'cherry', 'sprinkles', 'nuts', 'wafer', 'banana', 'gummies', 'cookie', 'marshmallow', 'chips'],
      names: { vanilla: 'Vanilla', chocolate: 'Choc', strawberry: 'Strawberry', mint: 'Mint', mango: 'Mango', blueberry: 'Blueberry', whip: 'Whipped', cherry: 'Cherry', sprinkles: 'Sprinkles', nuts: 'Nuts', wafer: 'Wafer', banana: 'Banana', gummies: 'Gummies', cookie: 'Cookie', marshmallow: 'Mallows', chips: 'Choc chips' },
      hint: 'tap flavours, bottom to top', undo: '↩ Take a scoop off',
      mood: { great: ['😍', 'So sweet!'], ok: ['🙂', 'Pretty sweet!'], bad: ['😖', 'Brain freeze…'] },
      greet: 'Ooh! Can I have this one?', ring: 'Hi Coco! Can I order a…',
    },
  };
  const COURT = { name: 'YesChef food court', owner: 'Nonna Pina', icon: '🧑‍🍳', sign: ['Yes', 'Chef'] };
  const keyOf = (d, k) => (K[(d && d.k) || k] ? (d && d.k) || k : 'pizza');
  const S = (inner, label, size, cls, vb = [-110, -110, 220, 220]) => `<svg class="pz-svg ${cls || ''}" viewBox="${vb.join(' ')}" width="${size}" height="${Math.round((size * vb[3]) / vb[2])}" aria-label="${esc(label)}">${inner}</svg>`;
  const tr = (x, y, rot, s = 1) => `transform="translate(${f1(x)} ${f1(y)}) rotate(${Math.round(rot)})${s !== 1 ? ` scale(${s})` : ''}"`;

  // ================= PIZZA =================
  // Slices are numbered clockwise from 12 o'clock; topping masks have bit i for slice i.
  const SPOTS = [[0.78, 0.3], [0.78, 0.72], [0.55, 0.5], [0.6, 0.15], [0.6, 0.86], [0.32, 0.5], [0.9, 0.52]];
  const pt = (r, deg) => [Math.sin((deg * Math.PI) / 180) * r, -Math.cos((deg * Math.PI) / 180) * r];
  const SAUCE_COL = { tomato: '#c8321f', white: '#f1e6c8', pesto: '#4f8a2b', bbq: '#6b2a14', none: '#f0cf93' };
  function pizzaPiece(kind, x, y, rot) {
    const t = tr(x, y, rot);
    switch (kind) {
      case 'pepperoni': return `<g ${t}><circle r="7.2" fill="#b3261b" stroke="#6e130c" stroke-width="1.2"/><circle cx="-2.4" cy="-1.6" r="1.3" fill="#7d150e"/><circle cx="2.2" cy="2" r="1.1" fill="#7d150e"/><circle cx="2.4" cy="-2.6" r=".9" fill="#e0574a"/></g>`;
      case 'mushroom': return `<g ${t}><path d="M-6.5 0 Q-6 -7 0 -7 Q6 -7 6.5 0 Z" fill="#d8c1a0" stroke="#6b4e2e" stroke-width="1.1"/><rect x="-2.3" y="-0.5" width="4.6" height="6" rx="1.6" fill="#efe2cc" stroke="#6b4e2e" stroke-width="1"/></g>`;
      case 'pepper': return `<g ${t}><path d="M-5.5 -1 Q-6 -6 0 -6 Q6 -6 5.5 -1 Q5 5 0 6 Q-5 5 -5.5 -1Z" fill="none" stroke="#2f9e44" stroke-width="2.8"/></g>`;
      case 'olive': return `<g ${t}><circle r="4.6" fill="none" stroke="#1e1e24" stroke-width="3.2"/></g>`;
      case 'onion': return `<g ${t}><path d="M-6 3 Q0 -9 6 3" fill="none" stroke="#9d4edd" stroke-width="2.4" stroke-linecap="round"/><path d="M-3.5 3 Q0 -4 3.5 3" fill="none" stroke="#c77dff" stroke-width="1.6" stroke-linecap="round"/></g>`;
      case 'pineapple': return `<g ${t}><path d="M-5 -5 L5 -5 L6 3 L0 6 L-6 3Z" fill="#ffd23f" stroke="#b8860b" stroke-width="1.1" stroke-linejoin="round"/><path d="M-3 -2 L3 -2 M-3.5 1.5 L3.5 1.5" stroke="#e0a800" stroke-width=".9"/></g>`;
      case 'ham': return `<g ${t}><rect x="-5.5" y="-5" width="11" height="10" rx="2.5" fill="#f497a8" stroke="#b4546a" stroke-width="1.1"/><path d="M-3 -1 Q0 -3 3 -1" stroke="#fbd0d9" stroke-width="1.2" fill="none"/></g>`;
      case 'basil': return `<g ${t}><path d="M0 -7 Q6 -2 0 7 Q-6 -2 0 -7Z" fill="#2d8a3e" stroke="#16521f" stroke-width="1"/><path d="M0 -5 L0 5" stroke="#7ccf6a" stroke-width=".9"/></g>`;
      case 'jalapeno': return `<g ${t}><circle r="5.4" fill="#4caf50" stroke="#1f6b24" stroke-width="1.2"/><circle r="3" fill="#c5e8a5"/><circle cx="-1" cy="-.6" r=".7" fill="#f7f3d0"/><circle cx="1.1" cy=".8" r=".7" fill="#f7f3d0"/></g>`;
      case 'sausage': return `<g ${t}><path d="M-5 -3 Q-6 -6 -2 -6 Q2 -7 4 -4 Q7 -1 5 3 Q3 6 -1 5.5 Q-6 5 -6 1Z" fill="#8a4b2a" stroke="#4a2410" stroke-width="1.1"/><circle cx="-1.5" cy="-1.5" r="1" fill="#b06a3e"/><circle cx="1.8" cy="1.5" r=".8" fill="#5e2f16"/></g>`;
      default: return '';
    }
  }
  const PLATE = `<circle r="108" fill="#f7f2e8" stroke="${OL}" stroke-width="3"/><circle r="100" fill="none" stroke="#e2d8c5" stroke-width="2"/>`;
  const emptyPlate = (size, cls, vb) => S(`${PLATE}<text y="14" text-anchor="middle" font-size="44" fill="#c9bda5" font-family="Lilita One, sans-serif">?</text>`, 'an empty plate', size, cls);
  function pizzaSvg(p, o = {}) {
    const size = o.size || 200, cls = o.cls || '';
    if (!p) return emptyPlate(size, cls);
    const rim = { thin: 5, classic: 11, deep: 15 }[p.crust] || 11, R = 96, inner = R - rim;
    let s = PLATE;
    if (p.crust === 'deep') s += `<circle r="${R + 3}" fill="#3a3a42" stroke="#1d1d22" stroke-width="2"/>`;
    s += `<circle r="${R}" fill="url(#pzCrust)" stroke="#6b3a14" stroke-width="2.2"/>`;
    const wob = (r, amp, n, ph) => { let d = ''; for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2, rr = r + Math.sin(a * n + ph) * amp; d += (i ? 'L' : 'M') + f1(Math.cos(a) * rr) + ' ' + f1(Math.sin(a) * rr); } return d + 'Z'; };
    s += `<path d="${wob(inner - 1, 1.6, 7, 0.4)}" fill="${SAUCE_COL[p.sauce] || SAUCE_COL.none}"${p.sauce === 'none' ? ' opacity=".9"' : ''}/>`;
    if (p.sauce === 'pesto') s += `<path d="${wob(inner - 6, 1.2, 9, 1)}" fill="none" stroke="#6fb543" stroke-width="2" stroke-dasharray="3 5" opacity=".7"/>`;
    if (p.cheese > 0) {
      s += `<path d="${wob(inner - (p.cheese === 2 ? 3 : 9), p.cheese === 2 ? 2.5 : 3.5, 11, 2)}" fill="#ffd968" opacity="${p.cheese === 2 ? 0.97 : 0.88}"/>`;
      const spots = p.cheese === 2 ? 18 : 8;
      for (let i = 0; i < spots; i++) { const [x, y] = pt((inner - 14) * (0.25 + ((i * 37) % 70) / 100), i * 137.5); s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${p.cheese === 2 ? 4 : 3}" ry="2.4" fill="${i % 3 ? '#ffe9a6' : '#e8a93e'}" opacity=".75"/>`; }
    }
    if (o.slices !== false) for (let i = 0; i < 8; i++) { const [x, y] = pt(R - 2, i * 45); s += `<line x1="0" y1="0" x2="${f1(x)}" y2="${f1(y)}" stroke="rgba(110,50,15,.33)" stroke-width="1.3"/>`; }
    const top = p.top || {};
    for (let sl = 0; sl < 8; sl++) {
      const here = K.pizza.tops.filter((k) => (top[k] || 0) & (1 << sl)), n = here.length;
      here.forEach((k, j) => { for (let q = j, c = 0; q < SPOTS.length && c < 3; q += n, c++) { const [rf, af] = SPOTS[q], [x, y] = pt((inner - 4) * rf, sl * 45 + af * 45); s += pizzaPiece(k, x, y, (sl * 53 + q * 97 + j * 31) % 360); } });
    }
    if (o.hl) for (const sl of o.hl) { const [x1, y1] = pt(R, sl * 45), [x2, y2] = pt(R, sl * 45 + 45); s += `<path d="M0 0 L${f1(x1)} ${f1(y1)} A${R} ${R} 0 0 1 ${f1(x2)} ${f1(y2)}Z" fill="rgba(255,255,255,.22)"/>`; }
    return S(`<defs><radialGradient id="pzCrust"><stop offset=".75" stop-color="#e9b064"/><stop offset=".93" stop-color="#d48a3a"/><stop offset="1" stop-color="#a95f20"/></radialGradient></defs>${s}`, 'a pizza', size, cls);
  }

  // ================= TACOS: a plate of three, toppings on each =================
  const TACO_X = [-68, 0, 68], TACO_VB = [-110, -46, 220, 148];
  const SHELL = { corn: ['#f2c14e', '#c98a1e'], flour: ['#f6e6c4', '#c9a26a'], crunchy: ['#e39a2e', '#9a5a12'] };
  const FILL = { asada: '#6b3a1f', chicken: '#e0b070', pastor: '#d4552a', fish: '#f0c870', beans: '#3a2224' };
  const SALSA = { verde: '#4f9a3a', roja: '#b8321f', mango: '#ffb030' };
  function tacoPiece(kind, x, y, rot, sc = 1) {
    const t = tr(x, y, rot, sc);
    switch (kind) {
      case 'onion': return `<g ${t}><rect x="-4.5" y="-4" width="5" height="5" rx="1" fill="#fbf4ff" stroke="#9d4edd" stroke-width="1"/><rect x="1" y="-1" width="4.5" height="4.5" rx="1" fill="#fbf4ff" stroke="#9d4edd" stroke-width="1"/></g>`;
      case 'cilantro': return `<g ${t}><path d="M0 4 L0 -2" stroke="#2d6a1e" stroke-width="1"/><circle cx="-3" cy="-3" r="2.8" fill="#3fa34d" stroke="#1f5a1e" stroke-width=".8"/><circle cx="2.8" cy="-3.4" r="2.6" fill="#4cbb5a" stroke="#1f5a1e" stroke-width=".8"/><circle cx="0" cy="-6" r="2.6" fill="#3fa34d" stroke="#1f5a1e" stroke-width=".8"/></g>`;
      case 'lime': return `<g ${t}><path d="M-6 0 A6 6 0 0 0 6 0 Z" fill="#7ac943" stroke="#2f6d1e" stroke-width="1.2"/><path d="M-4.2 0.4 A4.2 4.2 0 0 0 4.2 0.4 Z" fill="#d7f5a0"/><path d="M0 0.6 L0 4 M0 0.6 L-2.6 3 M0 0.6 L2.6 3" stroke="#9bd35a" stroke-width=".7"/></g>`;
      case 'pineapple': return `<g ${t}><rect x="-4" y="-4" width="8" height="7" rx="1.5" fill="#ffd23f" stroke="#b8860b" stroke-width="1"/><path d="M-2 -1 L2 -1" stroke="#e0a800" stroke-width=".8"/></g>`;
      case 'queso': return `<g ${t}><path d="M-5 -1 L-2 -4 L1 -2 L-1 1Z" fill="#fffdf2" stroke="#c9bda5" stroke-width=".8"/><path d="M1 0 L4 -2 L5 2 L2 3Z" fill="#fffdf2" stroke="#c9bda5" stroke-width=".8"/><circle cx="-3" cy="3" r="1.6" fill="#fffdf2" stroke="#c9bda5" stroke-width=".7"/></g>`;
      case 'lettuce': return `<g ${t}><path d="M-6 2 Q-4 -3 -1 1 Q1 -4 3 1 Q5 -3 6.5 2" fill="none" stroke="#8fdc5a" stroke-width="2.6" stroke-linecap="round"/><path d="M-6 2 Q-4 -3 -1 1 Q1 -4 3 1 Q5 -3 6.5 2" fill="none" stroke="#3f8a2a" stroke-width=".7"/></g>`;
      case 'pico': return `<g ${t}><rect x="-5" y="-3" width="4" height="4" rx="1" fill="#e2453a" stroke="#8e1b14" stroke-width=".7"/><rect x="0" y="-4" width="3.5" height="3.5" rx="1" fill="#fff" stroke="#bbb" stroke-width=".6"/><rect x="1" y="0.5" width="4" height="4" rx="1" fill="#e2453a" stroke="#8e1b14" stroke-width=".7"/><rect x="-3" y="1.5" width="3" height="3" rx="1" fill="#4cbb5a"/></g>`;
      case 'avocado': return `<g ${t}><path d="M-7 1 Q0 -8 7 1 Q0 -2 -7 1Z" fill="#9ccf55" stroke="#3f6a1e" stroke-width="1.1"/><path d="M-5 0 Q0 -5 5 0" fill="none" stroke="#e1f2a8" stroke-width="1.2"/></g>`;
      case 'radish': return `<g ${t}><circle r="5" fill="#fff6f8" stroke="#e0306a" stroke-width="1.6"/><circle r="2.2" fill="none" stroke="#f7c6d4" stroke-width=".8"/></g>`;
      case 'jalapeno': return `<g ${t}><circle r="4.6" fill="#4caf50" stroke="#1f6b24" stroke-width="1.1"/><circle r="2.5" fill="#c5e8a5"/><circle cx="-.8" cy="-.5" r=".6" fill="#f7f3d0"/></g>`;
      default: return '';
    }
  }
  const TACO_SPOTS = [[-15, -20], [3, -28], [17, -17], [-6, -12], [10, -9], [-21, -9]];
  function tacoSvg(p, o = {}) {
    const size = o.size || 200, cls = o.cls || '';
    if (!p) return emptyPlate(size, cls);
    let s = `<ellipse cx="0" cy="52" rx="108" ry="46" fill="#e9774a" stroke="${OL}" stroke-width="3"/><ellipse cx="0" cy="50" rx="96" ry="37" fill="#fbe9cf"/><ellipse cx="0" cy="50" rx="96" ry="37" fill="none" stroke="#2f80c4" stroke-width="2" stroke-dasharray="6 5" opacity=".55"/>`;
    const [sc, sd] = SHELL[p.shell] || SHELL.corn, fill = FILL[p.filling] || FILL.beans, top = p.top || {};
    for (const i of [0, 2, 1]) { // the middle taco sits in front
      const x = TACO_X[i], y = 30;
      const hl = o.hl && o.hl.includes(i);
      s += `<g transform="translate(${x} ${y}) scale(1.22)">`;
      if (hl) s += `<ellipse cx="0" cy="-6" rx="38" ry="40" fill="rgba(255,255,255,.35)"/>`;
      // the filling mound, then the shell around it
      s += `<path d="M-31 -4 Q-31 -31 -12 -31 Q0 -41 12 -31 Q31 -31 31 -4Z" fill="${fill}" stroke="${OL}" stroke-width="1.4"/>`;
      for (let k = 0; k < 6; k++) s += `<circle cx="${-22 + k * 9}" cy="${-14 - (k % 2) * 6}" r="${2.2 + (k % 3) * 0.6}" fill="rgba(255,255,255,.18)"/>`;
      if (SALSA[p.salsa]) s += `<path d="M-26 -18 Q-18 -26 -10 -18 T6 -20 T22 -18" fill="none" stroke="${SALSA[p.salsa]}" stroke-width="4.2" stroke-linecap="round"/>`;
      const here = K.taco.tops.filter((k) => (top[k] || 0) & (1 << i)), n = here.length;
      here.forEach((k, j) => { for (let q = j, c = 0; q < TACO_SPOTS.length && c < 3; q += n, c++) { const [dx, dy] = TACO_SPOTS[q]; s += tacoPiece(k, dx, dy, (i * 53 + q * 97 + j * 31) % 70 - 35, 1.2); } });
      s += `<path d="M-34 -6 A34 34 0 0 0 34 -6 Z" fill="${sc}" stroke="${OL}" stroke-width="2.4"/>`;
      if (p.shell === 'crunchy') for (let k = 0; k < 5; k++) s += `<path d="M${-24 + k * 12} 0 Q${-22 + k * 12} 12 ${-20 + k * 11} 22" fill="none" stroke="${sd}" stroke-width="1.3" opacity=".6"/>`;
      else for (let k = 0; k < 7; k++) s += `<circle cx="${-22 + ((k * 17) % 44)}" cy="${2 + ((k * 11) % 20)}" r="${p.shell === 'flour' ? 2.4 : 1.1}" fill="${sd}" opacity="${p.shell === 'flour' ? 0.45 : 0.6}"/>`;
      s += `<path d="M-30 -5 A30 30 0 0 0 30 -5" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2"/></g>`;
    }
    return S(s, 'a plate of tacos', size, cls, TACO_VB);
  }

  // ================= SUSHI: a board of eight pieces (two rows of four) =================
  const SUSHI_VB = [-110, -86, 220, 174];
  const SUSHI_XY = [[-69, -34], [-23, -34], [23, -34], [69, -34], [-69, 34], [-23, 34], [23, 34], [69, 34]];
  const WRAP = { nori: ['#1f2d1f', '#34503a'], soy: ['#f6a3b9', '#ffd0dc'], cucumber: ['#5fa23a', '#a8dc7a'] };
  const RICE = { white: ['#fbfaf5', '#e4ded0'], brown: ['#dcc49c', '#b89a6a'], black: ['#4a3550', '#6e5478'] };
  function sushiFill(f) {
    switch (f) {
      case 'salmon': return `<rect x="-7" y="-6" width="14" height="12" rx="3" fill="#ff8c5a" stroke="#c4562a" stroke-width="1"/><path d="M-5 -3 L5 -1 M-5 1 L5 3" stroke="#ffe0cc" stroke-width="1.3"/>`;
      case 'tuna': return `<rect x="-7" y="-6" width="14" height="12" rx="3" fill="#c8243c" stroke="#7a1020" stroke-width="1"/><path d="M-4 -2 L4 0" stroke="#e85a6e" stroke-width="1.2"/>`;
      case 'crab': return `<rect x="-7" y="-5" width="14" height="10" rx="3" fill="#fbf6ee" stroke="#c9bda5" stroke-width="1"/><path d="M-7 -2 L7 -2" stroke="#e2453a" stroke-width="3.4"/>`;
      case 'shrimp': return `<path d="M-7 3 Q-8 -6 1 -6 Q8 -5 7 2 Q3 7 -2 6Z" fill="#f2b84a" stroke="#a8661a" stroke-width="1"/><path d="M5 -5 L10 -10 L11 -4Z" fill="#ff6a3a" stroke="#a83a1a" stroke-width=".8"/>`;
      default: return `<rect x="-7" y="-5" width="7" height="10" rx="2" fill="#7ac943" stroke="#3f7a1e" stroke-width=".9"/><rect x="0" y="-5" width="7" height="10" rx="2" fill="#c9e27a" stroke="#6a8a2a" stroke-width=".9"/>`;
    }
  }
  function sushiTop(kind, x, y) {
    const t = `transform="translate(${f1(x)} ${f1(y)})"`;
    switch (kind) {
      case 'roe': return `<g ${t}>${[[-3, -1], [0, -3], [3, -1], [-1.5, 2], [1.8, 2]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="2" fill="#ff7a1a" stroke="#b84a0a" stroke-width=".5"/>`).join('')}</g>`;
      case 'sesame': return `<g ${t}>${[[-4, -2, 20], [0, -4, -30], [4, -1, 60], [-2, 3, 0], [3, 3, -50]].map(([a, b, r]) => `<ellipse cx="${a}" cy="${b}" rx="1.6" ry=".9" transform="rotate(${r} ${a} ${b})" fill="#f0dc9a" stroke="#6a5a30" stroke-width=".5"/>`).join('')}</g>`;
      case 'scallion': return `<g ${t}><circle cx="-2.5" cy="-1" r="2.4" fill="none" stroke="#5fbf3a" stroke-width="1.4"/><circle cx="2.5" cy="1.5" r="2.2" fill="none" stroke="#7ad04a" stroke-width="1.4"/></g>`;
      case 'mayo': return `<g ${t}><ellipse rx="5.5" ry="4.2" fill="#ff9a5a" stroke="#c4562a" stroke-width=".9"/><ellipse cx="-1.6" cy="-1.4" rx="1.6" ry="1" fill="#ffd2b0"/></g>`;
      case 'eel': return `<g ${t}><path d="M-7 -2 L-3 2 L1 -2 L5 2 L8 -1" fill="none" stroke="#5a2a10" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></g>`;
      case 'avocado': return `<g ${t}><path d="M-8 2 Q0 -8 8 2 Q0 -2 -8 2Z" fill="#9ccf55" stroke="#3f6a1e" stroke-width="1"/></g>`;
      case 'crunch': return `<g ${t}>${[[-4, -1], [0, -3], [3.5, 0], [-1, 2.5], [2.5, 3]].map(([a, b], i) => `<path d="M${a - 1.6} ${b} L${a} ${b - 1.8} L${a + 1.8} ${b + 0.4} L${a + 0.2} ${b + 1.6}Z" fill="${i % 2 ? '#f2c14e' : '#e0a030'}" stroke="#9a6a12" stroke-width=".4"/>`).join('')}</g>`;
      case 'jalapeno': return `<g ${t}><circle r="4.2" fill="#4caf50" stroke="#1f6b24" stroke-width="1"/><circle r="2.3" fill="#c5e8a5"/></g>`;
      case 'lemon': return `<g ${t}><path d="M-5.5 1 A5.5 5.5 0 0 1 5.5 1Z" fill="#ffe14a" stroke="#c4a00a" stroke-width="1"/><path d="M0 1 L0 -3.5 M0 1 L-3 -2 M0 1 L3 -2" stroke="#fff6b0" stroke-width=".7"/></g>`;
      case 'chili': return `<g ${t}><path d="M-6 -3 Q-1 1 5 -4 M-5 2 Q0 -1 6 3 M-3 -5 Q1 0 3 5" fill="none" stroke="#e2302a" stroke-width="1" stroke-linecap="round"/></g>`;
      default: return '';
    }
  }
  const SUSHI_TOP_AT = [[0, -9], [-8, 4], [8, 4], [0, 4]];
  function sushiSvg(p, o = {}) {
    const size = o.size || 200, cls = o.cls || '';
    if (!p) return emptyPlate(size, cls);
    let s = `<rect x="-106" y="-80" width="212" height="160" rx="12" fill="#2a160c" opacity=".3" transform="translate(4 6)"/><rect x="-106" y="-80" width="212" height="160" rx="12" fill="#e0b070" stroke="${OL}" stroke-width="3"/>`;
    for (let k = 0; k < 7; k++) s += `<path d="M-100 ${-66 + k * 21} Q0 ${-60 + k * 21} 100 ${-68 + k * 21}" fill="none" stroke="#c4904a" stroke-width="1.2" opacity=".6"/>`;
    const [w1, w2] = WRAP[p.wrap] || WRAP.nori, [r1, r2] = RICE[p.rice] || RICE.white, top = p.top || {};
    SUSHI_XY.forEach(([x, y], i) => {
      const hl = o.hl && o.hl.includes(i);
      s += `<g transform="translate(${x} ${y})">${hl ? '<circle r="29" fill="rgba(255,255,255,.45)"/>' : ''}<ellipse cx="1.5" cy="3" rx="22" ry="22" fill="rgba(0,0,0,.22)"/>`;
      s += `<circle r="21.5" fill="${w1}" stroke="${OL}" stroke-width="1.8"/>${p.wrap === 'nori' ? `<path d="M-15 -12 A19 19 0 0 1 4 -19" fill="none" stroke="${w2}" stroke-width="2"/>` : `<circle r="19.5" fill="none" stroke="${w2}" stroke-width="1.2"/>`}`;
      s += `<circle r="17" fill="${r1}"/>`;
      for (let k = 0; k < 10; k++) { const a = k * 2.4, rr = 9 + (k % 3) * 2.4; s += `<ellipse cx="${f1(Math.cos(a) * rr)}" cy="${f1(Math.sin(a) * rr)}" rx="1.8" ry="1.1" transform="rotate(${k * 37} ${f1(Math.cos(a) * rr)} ${f1(Math.sin(a) * rr)})" fill="${r2}"/>`; }
      s += sushiFill(p.filling);
      const here = K.sushi.tops.filter((k) => (top[k] || 0) & (1 << i));
      here.slice(0, 4).forEach((k, j) => { const [dx, dy] = SUSHI_TOP_AT[here.length === 1 ? 3 : j]; s += sushiTop(k, dx, dy); });
      s += '</g>';
    });
    return S(s, 'a sushi roll', size, cls, SUSHI_VB);
  }

  // ================= BURGERS: a bun and layers stacked in order =================
  const LAYER_H = { patty: 15, cheese: 6, bacon: 7, lettuce: 8, tomato: 8, onion: 6, pickle: 6, egg: 9, ketchup: 5, mustard: 5 };
  function layerSvg(k, y, h) { // y = the layer's bottom
    const m = y - h / 2;
    switch (k) {
      case 'patty': return `<rect x="-78" y="${f1(y - h)}" width="156" height="${f1(h)}" rx="${f1(h / 2)}" fill="#6b3a1f" stroke="${OL}" stroke-width="2.2"/><path d="M-66 ${f1(m - h * 0.12)} Q-40 ${f1(m - h * 0.3)} -10 ${f1(m - h * 0.1)} T50 ${f1(m - h * 0.15)}" fill="none" stroke="#8a5230" stroke-width="2"/>`;
      case 'cheese': return `<path d="M-82 ${f1(y - h)} L82 ${f1(y - h)} L80 ${f1(y)} L58 ${f1(y)} L48 ${f1(y + h * 1.3)} L38 ${f1(y)} L-20 ${f1(y)} L-30 ${f1(y + h * 1.6)} L-40 ${f1(y)} L-80 ${f1(y)}Z" fill="#ffc93c" stroke="${OL}" stroke-width="1.8" stroke-linejoin="round"/>`;
      case 'bacon': return `<path d="M-80 ${f1(m)} Q-60 ${f1(m - h)} -40 ${f1(m)} T0 ${f1(m)} T40 ${f1(m)} T80 ${f1(m)}" fill="none" stroke="${OL}" stroke-width="${f1(h + 2.4)}" stroke-linecap="round"/><path d="M-80 ${f1(m)} Q-60 ${f1(m - h)} -40 ${f1(m)} T0 ${f1(m)} T40 ${f1(m)} T80 ${f1(m)}" fill="none" stroke="#b5452e" stroke-width="${f1(h)}" stroke-linecap="round"/><path d="M-80 ${f1(m)} Q-60 ${f1(m - h)} -40 ${f1(m)} T0 ${f1(m)} T40 ${f1(m)} T80 ${f1(m)}" fill="none" stroke="#f2b8a0" stroke-width="${f1(h * 0.3)}" stroke-linecap="round"/>`;
      case 'lettuce': { let d = `M-86 ${f1(y)}`; for (let i = 0; i <= 12; i++) d += ` L${-86 + i * 14.3} ${f1(y - h + (i % 2 ? h * 0.9 : 0))}`; return `<path d="${d} L86 ${f1(y)}Z" fill="#6fc24a" stroke="${OL}" stroke-width="1.8" stroke-linejoin="round"/>`; }
      case 'tomato': return [-36, 36].map((x) => `<rect x="${x - 36}" y="${f1(y - h)}" width="72" height="${f1(h)}" rx="${f1(h / 2)}" fill="#e2453a" stroke="${OL}" stroke-width="1.8"/><circle cx="${x - 14}" cy="${f1(m)}" r="1.6" fill="#ffd0c0"/><circle cx="${x + 12}" cy="${f1(m)}" r="1.6" fill="#ffd0c0"/>`).join('');
      case 'onion': return [-52, -18, 18, 52].map((x) => `<ellipse cx="${x}" cy="${f1(m)}" rx="18" ry="${f1(h / 2)}" fill="#f6eaff" stroke="#8a3ac0" stroke-width="2.2"/>`).join('');
      case 'pickle': return [-54, -18, 18, 54].map((x) => `<ellipse cx="${x}" cy="${f1(m)}" rx="16" ry="${f1(h / 2)}" fill="#8fbf3a" stroke="#3a5a12" stroke-width="1.8"/><circle cx="${x - 5}" cy="${f1(m)}" r="1.3" fill="#e8f5c0"/><circle cx="${x + 5}" cy="${f1(m)}" r="1.3" fill="#e8f5c0"/>`).join('');
      case 'egg': return `<path d="M-76 ${f1(y)} Q-82 ${f1(y - h)} -40 ${f1(y - h)} Q0 ${f1(y - h * 1.3)} 44 ${f1(y - h)} Q84 ${f1(y - h)} 74 ${f1(y)}Z" fill="#fffdf6" stroke="${OL}" stroke-width="1.8"/><ellipse cx="6" cy="${f1(y - h * 0.75)}" rx="20" ry="${f1(h * 0.62)}" fill="#ffb31a" stroke="#c4780a" stroke-width="1.4"/>`;
      case 'ketchup': case 'mustard': { const c = k === 'ketchup' ? '#d62828' : '#ffcc1a', s2 = k === 'ketchup' ? '#8e1414' : '#a8800a'; return `<path d="M-70 ${f1(y - h)} L70 ${f1(y - h)} L66 ${f1(y)} L48 ${f1(y)} Q44 ${f1(y + 6)} 40 ${f1(y)} L-10 ${f1(y)} Q-14 ${f1(y + 8)} -18 ${f1(y)} L-66 ${f1(y)}Z" fill="${c}" stroke="${s2}" stroke-width="1.4" stroke-linejoin="round"/>`; }
      default: return '';
    }
  }
  const BUN = { sesame: ['#e8a04a', '#c4782a'], brioche: ['#c9772e', '#8e4a14'], pretzel: ['#7a4a24', '#4a2a10'], lettuce: ['#6fc24a', '#3f8a2a'] };
  function burgerSvg(p, o = {}) {
    const size = o.size || 200, cls = o.cls || '';
    if (!p) return emptyPlate(size, cls);
    const st = (p.stack || []).slice(0, 12), [b1, b2] = BUN[p.bun] || BUN.sesame;
    const want = st.reduce((a, k) => a + (LAYER_H[k] || 6), 0), room = 120, kk = want > room ? room / want : 1;
    let s = `<ellipse cx="0" cy="92" rx="104" ry="16" fill="#f7f2e8" stroke="${OL}" stroke-width="3"/><ellipse cx="0" cy="90" rx="88" ry="10" fill="#e8e0d0"/>`;
    // bottom bun
    let y = 86;
    if (p.bun === 'lettuce') s += `<path d="M-84 ${y} Q-90 ${y - 18} -70 ${y - 18} L70 ${y - 18} Q90 ${y - 18} 84 ${y}Z" fill="${b1}" stroke="${OL}" stroke-width="2.4"/><path d="M-60 ${y - 9} L60 ${y - 9}" stroke="${b2}" stroke-width="1.6"/>`;
    else s += `<rect x="-76" y="${y - 18}" width="152" height="18" rx="8" fill="${b1}" stroke="${OL}" stroke-width="2.4"/><rect x="-74" y="${y - 18}" width="148" height="5" rx="2.5" fill="#f6d9a6"/>`;
    y -= 18;
    st.forEach((k) => { const h = (LAYER_H[k] || 6) * kk; s += layerSvg(k, y, h); y -= h; });
    if (o.hlTop && st.length) s += `<rect x="-90" y="${f1(y)}" width="180" height="${f1((LAYER_H[st[st.length - 1]] || 6) * kk)}" fill="rgba(255,255,255,.3)" rx="4"/>`;
    // top bun
    if (p.bun === 'lettuce') s += `<path d="M-84 ${f1(y)} Q-80 ${f1(y - 34)} 0 ${f1(y - 38)} Q80 ${f1(y - 34)} 84 ${f1(y)}Z" fill="${b1}" stroke="${OL}" stroke-width="2.4"/><path d="M0 ${f1(y - 34)} L0 ${f1(y - 4)} M-40 ${f1(y - 26)} L-20 ${f1(y - 6)} M40 ${f1(y - 26)} L20 ${f1(y - 6)}" stroke="${b2}" stroke-width="1.6"/>`;
    else {
      s += `<path d="M-80 ${f1(y)} Q-82 ${f1(y - 44)} 0 ${f1(y - 46)} Q82 ${f1(y - 44)} 80 ${f1(y)}Z" fill="${b1}" stroke="${OL}" stroke-width="2.4"/><path d="M-56 ${f1(y - 26)} Q-30 ${f1(y - 40)} 8 ${f1(y - 40)}" fill="none" stroke="rgba(255,255,255,.4)" stroke-width="4" stroke-linecap="round"/>`;
      if (p.bun === 'sesame') for (let i = 0; i < 11; i++) { const x = -54 + ((i * 37) % 108), yy = y - 14 - ((i * 13) % 24); s += `<ellipse cx="${x}" cy="${f1(yy)}" rx="3" ry="1.7" transform="rotate(${(i * 41) % 90 - 45} ${x} ${f1(yy)})" fill="#fff6dc" stroke="#b8925a" stroke-width=".5"/>`; }
      if (p.bun === 'pretzel') { s += `<path d="M-30 ${f1(y - 30)} L-10 ${f1(y - 14)} M10 ${f1(y - 36)} L30 ${f1(y - 18)}" stroke="#c9945a" stroke-width="3.4" stroke-linecap="round"/>`; for (let i = 0; i < 9; i++) s += `<rect x="${-48 + ((i * 29) % 96)}" y="${f1(y - 12 - ((i * 17) % 26))}" width="3" height="3" fill="#ffffff" transform="rotate(30 ${-48 + ((i * 29) % 96)} ${f1(y - 12 - ((i * 17) % 26))})"/>`; }
      if (p.bun === 'brioche') s += `<path d="M-40 ${f1(y - 20)} Q0 ${f1(y - 32)} 40 ${f1(y - 20)}" fill="none" stroke="#e8a85a" stroke-width="2" opacity=".6"/>`;
    }
    return S(s, 'a burger', size, cls);
  }

  // ================= SUNDAES: a cone, cup or bowl, scoops in order, sauce, toppings =================
  const SCOOP = { vanilla: ['#fff3d6', '#e9d6a8'], chocolate: ['#6b3a22', '#4a2414'], strawberry: ['#ff9ab0', '#e0607e'], mint: ['#a8ecc8', '#5fbf96'], mango: ['#ffc04a', '#e0901a'], blueberry: ['#9b8cff', '#6a5ad0'] };
  const DRIZZLE = { fudge: '#4a2414', caramel: '#d98a2a', berry: '#e0304a' };
  function scoopSvg(k, x, y, r) {
    const [c, d] = SCOOP[k] || SCOOP.vanilla;
    let d0 = `M${f1(x - r)} ${f1(y)} A${r} ${r} 0 1 1 ${f1(x + r)} ${f1(y)}`;
    for (let i = 6; i >= 0; i--) d0 += ` L${f1(x - r + (i / 6) * 2 * r)} ${f1(y + r * 0.22 + (i % 2 ? r * 0.26 : 0))}`;
    let s = `<path d="${d0} Z" fill="${c}" stroke="${OL}" stroke-width="2.2" stroke-linejoin="round"/>`;
    if (k === 'mint') for (let i = 0; i < 5; i++) s += `<rect x="${f1(x - r * 0.6 + ((i * 13) % (r * 1.2)))}" y="${f1(y - r * 0.55 + ((i * 7) % (r * 0.7)))}" width="3" height="2.2" fill="#3a2218" transform="rotate(${i * 40} ${f1(x)} ${f1(y)})"/>`;
    if (k === 'strawberry' || k === 'blueberry') for (let i = 0; i < 4; i++) s += `<circle cx="${f1(x - r * 0.5 + i * r * 0.35)}" cy="${f1(y - r * 0.3 + (i % 2) * r * 0.25)}" r="1.8" fill="${d}"/>`;
    s += `<ellipse cx="${f1(x - r * 0.38)}" cy="${f1(y - r * 0.45)}" rx="${f1(r * 0.24)}" ry="${f1(r * 0.13)}" transform="rotate(-30 ${f1(x - r * 0.38)} ${f1(y - r * 0.45)})" fill="rgba(255,255,255,.45)"/>`;
    return s;
  }
  function sundaeTop(k, x, y, r, i) {
    switch (k) {
      case 'whip': return `<path d="M${f1(x - 20)} ${f1(y)} Q${f1(x - 24)} ${f1(y - 12)} ${f1(x - 10)} ${f1(y - 12)} Q${f1(x - 12)} ${f1(y - 24)} ${f1(x + 2)} ${f1(y - 22)} Q${f1(x + 4)} ${f1(y - 34)} ${f1(x + 8)} ${f1(y - 36)} Q${f1(x + 12)} ${f1(y - 24)} ${f1(x + 14)} ${f1(y - 20)} Q${f1(x + 26)} ${f1(y - 14)} ${f1(x + 20)} ${f1(y)}Z" fill="#ffffff" stroke="${OL}" stroke-width="2" stroke-linejoin="round"/><path d="M${f1(x - 12)} ${f1(y - 8)} Q${f1(x)} ${f1(y - 14)} ${f1(x + 12)} ${f1(y - 8)}" fill="none" stroke="#e4e4ee" stroke-width="1.6"/>`;
      case 'cherry': return `<path d="M${f1(x + 2)} ${f1(y - 10)} Q${f1(x + 6)} ${f1(y - 24)} ${f1(x + 16)} ${f1(y - 26)}" fill="none" stroke="#3a6a1e" stroke-width="2"/><circle cx="${f1(x)}" cy="${f1(y - 4)}" r="8" fill="#e0304a" stroke="${OL}" stroke-width="2"/><circle cx="${f1(x - 2.5)}" cy="${f1(y - 6.5)}" r="2.2" fill="#ffb0b8"/>`;
      case 'sprinkles': return Array.from({ length: 9 }, (_, j) => { const a = j * 0.7 + 0.4, xx = x + Math.cos(a) * r * (0.3 + (j % 3) * 0.2), yy = y + 6 + Math.sin(a) * r * 0.3; return `<rect x="${f1(xx - 3)}" y="${f1(yy - 1)}" width="6" height="2.2" rx="1" fill="${['#ff4f6d', '#ffd23f', '#3ad0ff', '#7ac943', '#b388ff'][j % 5]}" transform="rotate(${j * 47} ${f1(xx)} ${f1(yy)})"/>`; }).join('');
      case 'nuts': return Array.from({ length: 6 }, (_, j) => { const xx = x - r * 0.6 + j * r * 0.24, yy = y + 8 + (j % 2) * 5; return `<path d="M${f1(xx - 3)} ${f1(yy)} L${f1(xx)} ${f1(yy - 3)} L${f1(xx + 3)} ${f1(yy + 0.5)} L${f1(xx)} ${f1(yy + 2.6)}Z" fill="#c4904a" stroke="#6a4218" stroke-width=".7"/>`; }).join('');
      case 'wafer': return `<g transform="translate(${f1(x + r * 0.55)} ${f1(y + 2)}) rotate(28)"><rect x="-5" y="-34" width="10" height="38" rx="3" fill="#f2c47a" stroke="${OL}" stroke-width="1.8"/><path d="M-5 -26 L5 -22 M-5 -16 L5 -12 M-5 -6 L5 -2" stroke="#c48a3a" stroke-width="1.2"/></g>`;
      case 'banana': return [-1, 1].map((sd) => `<ellipse cx="${f1(sd * (r + 6))}" cy="${f1(i)}" rx="9" ry="6" fill="#fff4b8" stroke="#c4a83a" stroke-width="1.6"/><circle cx="${f1(sd * (r + 6))}" cy="${f1(i)}" r="2" fill="#e8d07a"/>`).join('');
      case 'gummies': return [[-r * 0.7, 14, '#ff4f6d'], [r * 0.2, 18, '#7ac943'], [-r * 0.1, 10, '#ffd23f']].map(([dx, dy, c]) => `<g transform="translate(${f1(x + dx)} ${f1(y + dy)})"><ellipse cy="2" rx="3.6" ry="4.4" fill="${c}" stroke="${OL}" stroke-width="1"/><circle cy="-3" r="2.8" fill="${c}" stroke="${OL}" stroke-width="1"/></g>`).join('');
      case 'cookie': return Array.from({ length: 6 }, (_, j) => `<path d="M${f1(x - r * 0.5 + j * r * 0.2)} ${f1(y + 10 + (j % 2) * 4)} l3 -2 l2 3 l-3 2Z" fill="#4a2a18" stroke="#2a160c" stroke-width=".5"/>`).join('');
      case 'marshmallow': return [[-r * 0.45, 4], [r * 0.35, 8]].map(([dx, dy]) => `<rect x="${f1(x + dx - 4)}" y="${f1(y + dy - 4)}" width="8" height="7" rx="2.5" fill="#ffffff" stroke="#c9bda5" stroke-width="1"/>`).join('');
      case 'chips': return Array.from({ length: 5 }, (_, j) => { const xx = x - r * 0.5 + j * r * 0.25, yy = y + 12 + (j % 2) * 4; return `<path d="M${f1(xx - 2.6)} ${f1(yy + 1.5)} L${f1(xx)} ${f1(yy - 2.6)} L${f1(xx + 2.6)} ${f1(yy + 1.5)}Z" fill="#3a2218"/>`; }).join('');
      default: return '';
    }
  }
  function sundaeSvg(p, o = {}) {
    const size = o.size || 200, cls = o.cls || '';
    if (!p) return emptyPlate(size, cls);
    const st = (p.stack || []).slice(0, 4), n = st.length, r = n >= 4 ? 26 : n === 3 ? 29 : 32, step = n >= 4 ? 25 : 28;
    let s = '', baseY;
    if (p.vessel === 'cone') {
      baseY = 18;
      s += `<defs><clipPath id="pzCone"><path d="M-38 18 L38 18 L0 104Z"/></clipPath></defs><path d="M-38 ${baseY} L38 ${baseY} L0 104Z" fill="#e0a458" stroke="${OL}" stroke-width="2.6" stroke-linejoin="round"/><g clip-path="url(#pzCone)">`;
      for (let i = -3; i <= 3; i++) s += `<path d="M${-38 + (i + 3) * 12} ${baseY} L${(i + 3) * 6 - 10} 98" stroke="#b8742a" stroke-width="1.3" opacity=".7"/><path d="M${38 - (i + 3) * 12} ${baseY} L${10 - (i + 3) * 6} 98" stroke="#b8742a" stroke-width="1.3" opacity=".7"/>`;
      s += `</g><rect x="-41" y="${baseY - 4}" width="82" height="9" rx="4" fill="#e8b46a" stroke="${OL}" stroke-width="2"/>`;
    } else if (p.vessel === 'bowl') {
      baseY = 40;
      s += `<path d="M-72 ${baseY} Q-70 96 0 98 Q70 96 72 ${baseY}Z" fill="#c98a3e" stroke="${OL}" stroke-width="2.6"/>`;
      for (let i = 0; i < 6; i++) s += `<path d="M${-60 + i * 24} ${baseY + 2} L${-50 + i * 20} 92" stroke="#9a5e1e" stroke-width="1.4" opacity=".7"/><path d="M${-66 + i * 4} ${baseY + 12 + i * 9} L${66 - i * 4} ${baseY + 12 + i * 9}" stroke="#9a5e1e" stroke-width="1.2" opacity=".5"/>`;
      s += `<path d="M-76 ${baseY} Q-60 ${baseY - 10} -40 ${baseY - 2} Q-20 ${baseY - 12} 0 ${baseY - 2} Q20 ${baseY - 12} 40 ${baseY - 2} Q60 ${baseY - 10} 76 ${baseY}Z" fill="#e0a458" stroke="${OL}" stroke-width="2"/>`;
    } else {
      baseY = 26;
      s += `<ellipse cx="0" cy="100" rx="34" ry="7" fill="#d8f0ff" stroke="${OL}" stroke-width="2.2"/><rect x="-5" y="66" width="10" height="34" fill="#d8f0ff" stroke="${OL}" stroke-width="2"/>`;
      s += `<path d="M-58 ${baseY} L58 ${baseY} Q52 70 0 72 Q-52 70 -58 ${baseY}Z" fill="rgba(216,240,255,.85)" stroke="${OL}" stroke-width="2.6"/><path d="M-44 ${baseY + 8} Q-40 52 -18 62" fill="none" stroke="#ffffff" stroke-width="3" opacity=".7"/>`;
    }
    if (!n) s += `<text y="${baseY - 12}" text-anchor="middle" font-size="26" fill="rgba(255,255,255,.7)" font-family="Lilita One, sans-serif">?</text>`;
    const tops = K.sundae.tops.filter((k) => p.top && p.top[k]);
    if (tops.includes('banana')) s += sundaeTop('banana', 0, baseY - 2, r + 6, baseY - 4);
    let y = baseY;
    st.forEach((k, i) => { const x = i % 2 ? 4 : -4; s += scoopSvg(k, x, y, r); if (i < n - 1) y -= step; });
    const topX = n % 2 ? -4 : 4, topY = y - r;
    if (DRIZZLE[p.sauce] && n) { const c = DRIZZLE[p.sauce], yy = y - r * 0.55; s += `<path d="M${f1(topX - r * 0.86)} ${f1(yy)} Q${f1(topX - r * 0.6)} ${f1(yy - r * 0.5)} ${f1(topX)} ${f1(yy - r * 0.48)} Q${f1(topX + r * 0.6)} ${f1(yy - r * 0.5)} ${f1(topX + r * 0.86)} ${f1(yy)} L${f1(topX + r * 0.6)} ${f1(yy + 3)} L${f1(topX + r * 0.5)} ${f1(yy + 16)} L${f1(topX + r * 0.36)} ${f1(yy + 4)} L${f1(topX - r * 0.1)} ${f1(yy + 5)} L${f1(topX - r * 0.22)} ${f1(yy + 20)} L${f1(topX - r * 0.36)} ${f1(yy + 5)} L${f1(topX - r * 0.7)} ${f1(yy + 3)}Z" fill="${c}" stroke="${OL}" stroke-width="1.6" stroke-linejoin="round"/>`; }
    for (const k of ['gummies', 'nuts', 'cookie', 'chips', 'sprinkles', 'marshmallow', 'wafer']) if (tops.includes(k)) s += sundaeTop(k, topX, y - r * 0.7, r);
    let peak = topY + 4;
    if (tops.includes('whip')) { s += sundaeTop('whip', topX, peak + 2, r); peak -= 30; }
    if (tops.includes('cherry')) s += sundaeTop('cherry', topX + 4, peak, r);
    return S(s, 'a sundae', size, cls);
  }

  // The burger tray: each ingredient seen from above (or its bottle), in a 24×24 box.
  const BURGER_ICON = {
    patty: `<ellipse cx="0" cy="1" rx="10" ry="7.5" fill="#6b3a1f" stroke="${OL}" stroke-width="1.2"/><path d="M-6 -2 L4 -4 M-6 2 L6 0 M-4 5 L6 4" stroke="#3a1e0c" stroke-width="1.4" stroke-linecap="round"/>`,
    cheese: `<path d="M-9 -8 L9 -8 L9 6 L4 6 L3 10 L1 6 L-9 6Z" fill="#ffc93c" stroke="${OL}" stroke-width="1.2" stroke-linejoin="round"/><circle cx="-4" cy="-3" r="1.6" fill="#e8a820"/><circle cx="4" cy="1" r="1.3" fill="#e8a820"/>`,
    bacon: `<path d="M-11 2 Q-6 -6 -1 2 T9 2 L11 -2" fill="none" stroke="${OL}" stroke-width="6.4" stroke-linecap="round"/><path d="M-11 2 Q-6 -6 -1 2 T9 2 L11 -2" fill="none" stroke="#b5452e" stroke-width="4.4" stroke-linecap="round"/><path d="M-11 2 Q-6 -6 -1 2 T9 2 L11 -2" fill="none" stroke="#f2b8a0" stroke-width="1.2" stroke-linecap="round"/>`,
    lettuce: `<path d="M-10 4 Q-11 -6 -4 -8 Q0 -11 4 -8 Q11 -6 10 4 Q6 8 0 6 Q-6 8 -10 4Z" fill="#6fc24a" stroke="${OL}" stroke-width="1.2"/><path d="M0 6 L0 -7 M0 0 L-5 -4 M0 2 L5 -3" stroke="#c8f0a0" stroke-width="1"/>`,
    tomato: `<circle r="9.5" fill="#e2453a" stroke="${OL}" stroke-width="1.2"/><circle r="6.5" fill="#ff7a6a"/><path d="M0 -6 L0 6 M-5.5 -3 L5.5 3 M-5.5 3 L5.5 -3" stroke="#e2453a" stroke-width="1.4"/><circle r="1.8" fill="#fff0e0"/>`,
    onion: `<circle r="9.5" fill="#f6eaff" stroke="#8a3ac0" stroke-width="2"/><circle r="6" fill="none" stroke="#b06ae0" stroke-width="1.6"/><circle r="2.6" fill="none" stroke="#b06ae0" stroke-width="1.4"/>`,
    pickle: `<circle r="9" fill="#8fbf3a" stroke="#3a5a12" stroke-width="1.6"/><circle r="6.4" fill="#b8dc6a"/>${[[-3, -2], [3, -2], [0, 3], [-3, 3], [3, 3]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="1.1" fill="#e8f5c0"/>`).join('')}`,
    egg: `<path d="M-9 2 Q-11 -7 -2 -8 Q6 -11 9 -3 Q12 6 3 8 Q-7 10 -9 2Z" fill="#fffdf6" stroke="${OL}" stroke-width="1.2"/><circle cx="0.5" cy="0" r="4.2" fill="#ffb31a" stroke="#c4780a" stroke-width="1"/>`,
    ketchup: `<rect x="-5" y="-5" width="10" height="15" rx="3.5" fill="#d62828" stroke="${OL}" stroke-width="1.2"/><path d="M-2.4 -5 L0 -11 L2.4 -5Z" fill="#ffffff" stroke="${OL}" stroke-width="1"/><rect x="-3" y="0" width="6" height="5" fill="#fff" opacity=".8"/>`,
    mustard: `<rect x="-5" y="-5" width="10" height="15" rx="3.5" fill="#ffcc1a" stroke="${OL}" stroke-width="1.2"/><path d="M-2.4 -5 L0 -11 L2.4 -5Z" fill="#d62828" stroke="${OL}" stroke-width="1"/><rect x="-3" y="0" width="6" height="5" fill="#fff" opacity=".8"/>`,
  };
  // One drawing for any dish: d.k (or o.k) picks the kitchen.
  function dishSvg(d, o = {}) {
    const k = keyOf(d, o.k);
    return k === 'taco' ? tacoSvg(d, o) : k === 'sushi' ? sushiSvg(d, o) : k === 'burger' ? burgerSvg(d, o) : k === 'sundae' ? sundaeSvg(d, o) : pizzaSvg(d, o);
  }
  // A small picture of one topping / layer / scoop for the phone tray.
  function itemIcon(k, kind, size = 34) {
    const sv = (vb, inner) => `<svg viewBox="${vb}" width="${size}" height="${size}" aria-hidden="true">${inner}</svg>`;
    if (k === 'pizza') return sv('-10 -10 20 20', pizzaPiece(kind, -2.5, -2.5, 0) + pizzaPiece(kind, 3, 3, 40));
    if (k === 'taco') return sv('-10 -10 20 20', tacoPiece(kind, -2, -2, 0) + tacoPiece(kind, 3.5, 4, 30));
    if (k === 'sushi') return sv('-12 -12 24 24', `<circle r="11" fill="#fbfaf5" stroke="${OL}" stroke-width="1"/>${sushiTop(kind, 0, 0)}`);
    if (k === 'burger') return sv('-12 -12 24 24', BURGER_ICON[kind] || '');
    if (K.sundae.stack.includes(kind)) return sv('-40 -40 80 72', scoopSvg(kind, 0, 6, 30));
    return sv('-36 -46 72 72', `<circle cx="0" cy="8" r="24" fill="#fff3d6" stroke="${OL}" stroke-width="2"/>${sundaeTop(kind, 0, -14, 24, 10)}`);
  }

  // ---------------- the customers (SVG people at the counter) ----------------
  function customerSvg(c, mood = 'wait', size = 220) {
    if (!c) return '';
    const O = OL, sk = c.skin, sh = c.shirt, hr = c.hair;
    const eyes = mood === 'great' ? `<path d="M-15 -4 Q-10 -10 -5 -4 M5 -4 Q10 -10 15 -4" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`
      : `<circle cx="-10" cy="-4" r="3.4" fill="${O}"/><circle cx="10" cy="-4" r="3.4" fill="${O}"/>`;
    const brows = mood === 'bad' ? `<path d="M-17 -15 L-5 -10 M17 -15 L5 -10" stroke="${O}" stroke-width="3.2" stroke-linecap="round"/>` : mood === 'think' ? `<path d="M-16 -13 Q-10 -17 -4 -13 M4 -15 L16 -15" stroke="${O}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` : '';
    const mouth = mood === 'great' ? `<path d="M-11 8 Q0 22 11 8 Z" fill="#8a1c2b" stroke="${O}" stroke-width="2.4" stroke-linejoin="round"/>`
      : mood === 'ok' ? `<path d="M-9 9 Q0 16 9 9" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`
        : mood === 'bad' ? `<path d="M-10 15 Q0 6 10 15" stroke="${O}" stroke-width="3" fill="none" stroke-linecap="round"/>`
          : mood === 'say' ? `<ellipse cx="0" cy="11" rx="6" ry="5" fill="#8a1c2b" stroke="${O}" stroke-width="2.2"/>`
            : `<path d="M-7 10 L7 10" stroke="${O}" stroke-width="3" stroke-linecap="round"/>`;
    const cheeks = mood === 'great' || mood === 'ok' ? `<circle cx="-17" cy="5" r="4.5" fill="#ff7a8a" opacity=".45"/><circle cx="17" cy="5" r="4.5" fill="#ff7a8a" opacity=".45"/>` : mood === 'bad' ? `<circle cx="-17" cy="5" r="5" fill="#e63946" opacity=".35"/><circle cx="17" cy="5" r="5" fill="#e63946" opacity=".35"/>` : '';
    if (c.dog) {
      return `<svg class="pz-cust" viewBox="-80 -110 160 200" width="${size}" height="${size * 1.25}" aria-label="${esc(c.name)}">
        <ellipse cx="0" cy="84" rx="56" ry="8" fill="rgba(0,0,0,.3)"/>
        <path d="M-40 84 Q-46 30 0 26 Q46 30 40 84Z" fill="${sk}" stroke="${O}" stroke-width="4"/>
        <path d="M-26 34 L26 34 L20 46 L-20 46Z" fill="${sh}" stroke="${O}" stroke-width="3"/><circle cx="0" cy="50" r="6" fill="#ffd23f" stroke="${O}" stroke-width="2.5"/>
        <g transform="translate(0 -18)"><path d="M-40 -26 Q-58 -6 -44 22 Q-34 8 -28 -14Z" fill="${hr}" stroke="${O}" stroke-width="3.5"/><path d="M40 -26 Q58 -6 44 22 Q34 8 28 -14Z" fill="${hr}" stroke="${O}" stroke-width="3.5"/>
          <ellipse cx="0" cy="0" rx="36" ry="34" fill="${sk}" stroke="${O}" stroke-width="4"/><ellipse cx="0" cy="14" rx="18" ry="13" fill="#f3dcb8" stroke="${O}" stroke-width="2.5"/><ellipse cx="0" cy="6" rx="7" ry="5" fill="${O}"/>
          <g transform="translate(0 -2)">${eyes}</g><g transform="translate(0 10) scale(.8)">${mood === 'bad' ? mouth : mood === 'great' || mood === 'say' ? `<path d="M-6 8 Q0 22 6 8Z" fill="#ff7a8a" stroke="${O}" stroke-width="2"/>` : ''}</g>${brows}</g></svg>`;
    }
    const sc = c.kid ? 0.84 : 1;
    const hat = {
      helmet: `<path d="M-40 -26 Q-40 -66 0 -66 Q40 -66 40 -26Z" fill="#d6452f" stroke="${O}" stroke-width="4"/><path d="M-50 -24 L50 -24 L44 -16 L-44 -16Z" fill="#b5341f" stroke="${O}" stroke-width="3.5"/><rect x="-8" y="-60" width="16" height="26" rx="4" fill="#ffd23f" stroke="${O}" stroke-width="2.5"/>`,
      band: `<rect x="-38" y="-30" width="76" height="11" rx="5" fill="#ff5d8f" stroke="${O}" stroke-width="3"/>`,
      sailor: `<path d="M-34 -36 Q0 -56 34 -36 L30 -26 L-30 -26Z" fill="#fff" stroke="${O}" stroke-width="3.5"/><rect x="-32" y="-30" width="64" height="7" fill="#2c4f8a"/>`,
      cap: `<path d="M-36 -26 Q-36 -58 0 -58 Q36 -58 36 -26Z" fill="#222" stroke="${O}" stroke-width="3.5"/><path d="M20 -30 Q48 -32 58 -24 L22 -22Z" fill="#222" stroke="${O}" stroke-width="3"/>`,
      trucker: `<path d="M-37 -26 Q-37 -60 0 -60 Q37 -60 37 -26Z" fill="#fff" stroke="${O}" stroke-width="3.5"/><path d="M-37 -26 Q-37 -60 0 -60 L0 -26Z" fill="#c8321f"/><path d="M-37 -26 Q-60 -26 -66 -18 L-34 -20Z" fill="#c8321f" stroke="${O}" stroke-width="3"/>`,
      bows: `<path d="M-46 -30 l-12 -10 l0 18Z M-46 -30 l12 -10 l0 18Z" fill="#ff5d8f" stroke="${O}" stroke-width="2.5"/><path d="M46 -30 l-12 -10 l0 18Z M46 -30 l12 -10 l0 18Z" fill="#ff5d8f" stroke="${O}" stroke-width="2.5"/>`,
      police: `<path d="M-38 -28 L-34 -54 Q0 -66 34 -54 L38 -28Z" fill="#1f2f55" stroke="${O}" stroke-width="3.5"/><rect x="-40" y="-32" width="80" height="9" rx="3" fill="#111" stroke="${O}" stroke-width="2"/><path d="M-6 -50 L6 -50 L4 -40 L-4 -40Z" fill="#ffd23f" stroke="${O}" stroke-width="1.5"/>`,
      pilot: `<path d="M-38 -28 L-36 -50 Q0 -62 36 -50 L38 -28Z" fill="#1d2a44" stroke="${O}" stroke-width="3.5"/><rect x="-42" y="-32" width="84" height="9" rx="3" fill="#111" stroke="${O}" stroke-width="2"/><path d="M-14 -46 L0 -40 L14 -46 L0 -52Z" fill="#ffd23f" stroke="${O}" stroke-width="1.5"/>`,
      beanie: `<path d="M-38 -18 Q-40 -64 0 -64 Q40 -64 38 -18Z" fill="${c.id === 'yuki' ? '#ff6b35' : '#3a86ff'}" stroke="${O}" stroke-width="3.5"/><rect x="-40" y="-26" width="80" height="12" rx="5" fill="${c.id === 'yuki' ? '#ffd23f' : '#264653'}" stroke="${O}" stroke-width="3"/><circle cx="0" cy="-66" r="9" fill="#fff" stroke="${O}" stroke-width="3"/>`,
      hardhat: `<path d="M-40 -24 Q-40 -66 0 -66 Q40 -66 40 -24Z" fill="#ffc93c" stroke="${O}" stroke-width="4"/><path d="M-50 -24 L50 -24 L46 -16 L-46 -16Z" fill="#e0a800" stroke="${O}" stroke-width="3.5"/><rect x="-6" y="-64" width="12" height="40" rx="4" fill="#ffe08a" stroke="${O}" stroke-width="2"/>`,
      crown: `<path d="M-32 -30 L-36 -64 L-18 -48 L0 -70 L18 -48 L36 -64 L32 -30Z" fill="#ffd23f" stroke="${O}" stroke-width="3.5" stroke-linejoin="round"/><circle cx="0" cy="-42" r="5" fill="#ff4f6d" stroke="${O}" stroke-width="2"/>`,
      phones: `<path d="M-42 -4 Q-44 -60 0 -60 Q44 -60 42 -4" fill="none" stroke="#222" stroke-width="7"/><rect x="-52" y="-16" width="16" height="28" rx="6" fill="${c.id === 'kofi' ? '#ffd23f' : '#ef476f'}" stroke="${O}" stroke-width="3"/><rect x="36" y="-16" width="16" height="28" rx="6" fill="${c.id === 'kofi' ? '#ffd23f' : '#ef476f'}" stroke="${O}" stroke-width="3"/>`,
      beret: `<path d="M-40 -28 Q-46 -58 0 -58 Q44 -56 40 -30 Q0 -22 -40 -28Z" fill="${c.id === 'ines' ? '#c1121f' : '#2b2d42'}" stroke="${O}" stroke-width="3.5"/><path d="M2 -58 L4 -66" stroke="${O}" stroke-width="3"/>`,
      cowboy: `<ellipse cx="0" cy="-28" rx="62" ry="10" fill="#8a5a2b" stroke="${O}" stroke-width="3.5"/><path d="M-32 -30 Q-36 -70 -12 -64 Q0 -56 12 -64 Q36 -70 32 -30Z" fill="#a0693a" stroke="${O}" stroke-width="3.5"/><rect x="-32" y="-40" width="64" height="7" fill="#4a2a14"/>`,
      sunhat: `<ellipse cx="0" cy="-30" rx="66" ry="12" fill="#f2d16b" stroke="${O}" stroke-width="3.5"/><path d="M-34 -32 Q-34 -62 0 -62 Q34 -62 34 -32Z" fill="#f2d16b" stroke="${O}" stroke-width="3.5"/><rect x="-34" y="-42" width="68" height="8" fill="#6a994e"/>`,
      none: '',
    }[c.hat] || '';
    const hs = c.hs || (c.kid ? 'kid' : 'short');
    const covered = ['helmet', 'police', 'pilot', 'beanie', 'hardhat', 'cowboy', 'sunhat'].includes(c.hat);
    const hair = covered && hs !== 'long' ? '' : hs === 'sides' ? `<path d="M-38 -14 Q-44 -30 -32 -32 M38 -14 Q44 -30 32 -32" stroke="${hr}" stroke-width="10" fill="none" stroke-linecap="round"/>`
      : hs === 'kid' ? `<path d="M-36 -10 Q-40 -46 0 -44 Q40 -46 36 -10 Q30 -32 0 -32 Q-30 -32 -36 -10Z" fill="${hr}" stroke="${O}" stroke-width="3"/><circle cx="-44" cy="0" r="10" fill="${hr}" stroke="${O}" stroke-width="3"/><circle cx="44" cy="0" r="10" fill="${hr}" stroke="${O}" stroke-width="3"/>`
        : hs === 'long' ? `<path d="M-36 -18 Q-46 10 -34 26 M36 -18 Q46 10 34 26" stroke="${hr}" stroke-width="12" fill="none" stroke-linecap="round"/>${covered || c.hat === 'cap' ? '' : `<path d="M-36 -16 Q-40 -46 0 -46 Q40 -46 36 -16 Q20 -30 -36 -16Z" fill="${hr}" stroke="${O}" stroke-width="3"/>`}`
          : hs === 'top' ? `<path d="M-36 -16 Q-40 -46 0 -46 Q40 -46 36 -16Z" fill="${hr}" stroke="${O}" stroke-width="3"/><circle cx="0" cy="-50" r="12" fill="${hr}" stroke="${O}" stroke-width="3"/>`
            : `<path d="M-36 -16 Q-40 -46 0 -46 Q40 -46 36 -16 Q20 -30 -36 -16Z" fill="${hr}" stroke="${O}" stroke-width="3"/>`;
    const behind = hs === 'kid' || hs === 'long' || hs === 'top';
    const beard = c.beard ? `<path d="M-30 4 Q-30 40 0 44 Q30 40 30 4 Q20 22 0 22 Q-20 22 -30 4Z" fill="${hr}" stroke="${O}" stroke-width="3"/>` : '';
    const glasses = c.glasses ? `<circle cx="-11" cy="-4" r="9" fill="rgba(255,255,255,.25)" stroke="${O}" stroke-width="2.6"/><circle cx="11" cy="-4" r="9" fill="rgba(255,255,255,.25)" stroke="${O}" stroke-width="2.6"/><path d="M-2 -4 L2 -4" stroke="${O}" stroke-width="2.6"/>` : '';
    const extra = {
      daisy: `<path d="M-20 50 l6 -6 l6 6 l-6 6Z" fill="#ffd23f" stroke="${O}" stroke-width="2"/>`, mia: `<text x="0" y="66" text-anchor="middle" font-size="22" font-family="Lilita One, sans-serif" fill="#fff" stroke="${O}" stroke-width="1">10</text>`,
      gus: `<path d="M-46 66 L46 66" stroke="#ffd23f" stroke-width="7"/>`, ted: `<path d="M-20 26 L0 46 L20 26" fill="none" stroke="#fff" stroke-width="5"/>`, hugo: `<path d="M-10 28 L0 34 L10 28 L10 40 L0 34 L-10 40Z" fill="#ffd23f" stroke="${O}" stroke-width="2"/>`,
      nora: `<path d="M-16 30 L-16 60 M16 30 L16 60" stroke="#e9f2f7" stroke-width="4"/><circle cx="-16" cy="62" r="5" fill="#9aa0ad" stroke="${O}" stroke-width="2"/>`, rita: `<circle cx="22" cy="56" r="9" fill="#fff" stroke="${O}" stroke-width="2.5"/>`,
      grace: `<path d="M-30 40 L-10 40 M10 40 L30 40" stroke="#ffd23f" stroke-width="4"/><path d="M-6 30 L6 30 L0 40Z" fill="#1d2a44"/>`, tess: `<path d="M-46 56 L46 56" stroke="#e76f51" stroke-width="6"/>`,
      max: `<text x="0" y="66" text-anchor="middle" font-size="22" font-family="Lilita One, sans-serif" fill="#fff" stroke="${O}" stroke-width="1">7</text>`, pat: `<path d="M-12 40 L12 40 M0 28 L0 52" stroke="#fff" stroke-width="6"/>`,
      kofi: `<circle cx="-18" cy="54" r="10" fill="#ffd23f" stroke="${O}" stroke-width="2.5"/><circle cx="-18" cy="54" r="3" fill="${O}"/>`, ted2: `<path d="M-14 26 L0 34 L14 26" fill="none" stroke="#ffd23f" stroke-width="5"/>`,
      bo: `<path d="M-46 56 L46 56 M-46 66 L46 66" stroke="#fff3b0" stroke-width="4"/>`, reggie: `<path d="M-24 34 L24 34 L18 70 L-18 70Z" fill="#c9ccd3" stroke="${O}" stroke-width="2.5"/><path d="M0 40 L0 62 M-9 50 L9 50" stroke="#e63946" stroke-width="4"/>`,
    }[c.id] || '';
    return `<svg class="pz-cust" viewBox="-80 -110 160 200" width="${size}" height="${size * 1.25}" aria-label="${esc(c.name)}"><g transform="translate(0 ${c.kid ? 14 : 0}) scale(${sc})">
      <path d="M-54 90 Q-58 30 -30 24 L30 24 Q58 30 54 90Z" fill="${sh}" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>${extra}
      <rect x="-10" y="12" width="20" height="16" fill="${sk}" stroke="${O}" stroke-width="3"/>
      <g class="pz-head">${behind ? hair : ''}<circle cx="-36" cy="0" r="7" fill="${sk}" stroke="${O}" stroke-width="3"/><circle cx="36" cy="0" r="7" fill="${sk}" stroke="${O}" stroke-width="3"/>
        <ellipse cx="0" cy="-2" rx="36" ry="38" fill="${sk}" stroke="${O}" stroke-width="4"/>${behind ? '' : hair}${beard}${cheeks}${eyes}${glasses}${brows}<path d="M-3 2 Q0 6 3 2" stroke="${O}" stroke-width="2" fill="none"/>${mouth}${hat}</g></g></svg>`;
  }

  // ---------------- phone ----------------
  const PH = { endAt: 0, round: null, kit: 'pizza', draft: null, sel: null, sendT: 0, lastPhase: '', paint: null, lastTapAt: 0 };
  function blank(k) { const C = K[k], d = { k }; for (const r of C.rows) d[r.key] = r.opts.find((o) => o[0] === 'none' || o[0] === 0) ? (r.opts.find((o) => o[0] === 'none' || o[0] === 0))[0] : r.opts[k === 'pizza' ? 1 : 0][0]; if (C.slots) d.top = {}; if (C.stack) d.stack = []; return d; }
  const copy = (p, k) => { const d = { ...blank(k), ...p, k }; if (p.top) d.top = { ...p.top }; if (p.stack) d.stack = p.stack.slice(); return d; };
  const lvlChip = (L, short) => (L ? `<span class="pz-lvl l-${esc(L.key)}" title="${esc(L.name)}">${esc(L.icon)}${short ? '' : ' ' + esc(L.name)}</span>` : '');
  // Easy: what was on the ticket (no places, no order), as little pictures.
  const hintHtml = (h, k, size = 30) => { if (!h) return ''; const xs = [...(h.stack || []), ...(h.tops || [])]; return xs.length ? `<div class="pz-hintlist"><b>🧾 On the ticket:</b>${xs.map((x) => `<span>${itemIcon(k, x, size)}<small>${esc((K[k].names || {})[x] || x)}</small></span>`).join('')}</div>` : ''; };
  const barHtml = (v) => `<div class="pz-bar"><span>${lvlChip(v.level, true)} ${esc(v.c ? v.c.modeIcon : '🧑‍🍳')} Order ${v.round}/${v.of}${v.c ? ` · ${esc(v.c.modeName)}` : ''}</span><span class="pz-t">${(v.phase === 'build' || v.phase === 'order') && PH.endAt > Date.now() ? `<span class="timer" data-ends="${PH.endAt}">${BOX.mmss(PH.endAt - Date.now())}</span>` : ''}</span><b>💰 ${v.points}</b></div>`;
  // Which slot is under the finger: a pizza slice, a taco, a sushi piece (-1: none).
  function slotAt(box, x, y) {
    const sv = box.querySelector('svg'), vb = sv && sv.viewBox && sv.viewBox.baseVal && sv.viewBox.baseVal.width ? sv.viewBox.baseVal : { x: -110, y: -110, width: 220, height: 220 };
    const r = (sv || box).getBoundingClientRect(), u = vb.x + ((x - r.left) / r.width) * vb.width, w = vb.y + ((y - r.top) / r.height) * vb.height;
    if (PH.kit === 'pizza') { if (Math.hypot(u, w) > 100) return -1; let a = (Math.atan2(u, -w) * 180) / Math.PI; if (a < 0) a += 360; return Math.floor(a / 45) % 8; }
    if (PH.kit === 'taco') { if (Math.abs(u) > 108 || w < -46 || w > 100) return -1; return u < -33 ? 0 : u < 33 ? 1 : 2; }
    if (PH.kit === 'sushi') { let best = -1, bd = 34; SUSHI_XY.forEach(([sx, sy], i) => { const d = Math.hypot(u - sx, w - sy); if (d < bd) { bd = d; best = i; } }); return best; }
    return -1;
  }
  function drawDish(el) { const box = el.querySelector('#pz-pie'); if (box) box.innerHTML = dishSvg(PH.draft, { size: 300, cls: 'pz-big', k: PH.kit }); }
  function queueSend(ctx) {
    clearTimeout(PH.sendT);
    PH.sendT = setTimeout(() => { if (PH.draft && PH.round != null) ctx.act({ op: 'build', round: PH.round, dish: PH.draft }); }, 350);
  }
  function builderHtml(v) {
    const C0 = K[PH.kit], d = PH.draft, sel = PH.sel, pal = (v.c && v.c.palette) || {};
    // Easy / Medium: the tray holds what's in the order plus a few decoys.
    const C = { ...C0, tops: pal.tops && pal.tops.length ? pal.tops : C0.tops, stack: pal.stack && pal.stack.length ? pal.stack : C0.stack };
    const row = (lab, items) => `<div class="pz-row"><span class="pz-lab">${lab}</span><div class="pz-chips">${items}</div></div>`;
    const chip = (r, [val, label, col]) => `<button class="pz-chip ${r.cls ? `${r.cls}-${val}` : ''} ${d[r.key] === val ? 'on' : ''}" data-row="${r.key}" data-val="${esc(String(val))}">${col ? `<i class="sw" style="background:${col}"></i>` : r.cls ? '<i></i>' : ''}${esc(label)}</button>`;
    const rows = C.rows.map((r) => row(r.label, r.opts.map((o) => chip(r, o)).join(''))).join('');
    const tray = (list, kind) => `<div class="pz-tray ${kind}">${list.map((x) => `<button class="pz-top ${kind === 'paint' && sel === x ? 'on' : ''} ${(kind !== 'stack' && d.top && d.top[x]) ? 'used' : ''}" data-${kind}="${x}">${itemIcon(PH.kit, x, kind === 'stack' && PH.kit === 'burger' ? 38 : 34)}<span>${esc(C.names[x])}</span></button>`).join('')}</div>`;
    let hint, trays, tools;
    if (C.stack) {
      const nst = (d.stack || []).length;
      hint = `${nst}/${C.max} ${PH.kit === 'sundae' ? 'scoops' : 'layers'}: ${C.hint}`;
      trays = tray(C.stack, 'stack') + (C.slots ? `<div class="pz-sub">Toppings: tap to add or take off</div>${tray(C.tops, 'toggle')}` : '');
      tools = `<button class="pz-tool" id="pz-undo" ${nst ? '' : 'disabled'}>${C.undo}</button><button class="pz-tool" id="pz-clear">🧹 Start over</button>`;
    } else {
      const m = d.top[sel] || 0, full = (1 << C.slots) - 1;
      hint = `${esc(C.names[sel])}: ${C.hint}`;
      trays = tray(C.tops, 'paint');
      tools = `<button class="pz-tool" id="pz-all">${m === full ? '✖ Take off' : C.all}</button><button class="pz-tool" id="pz-clear">🧹 Clear toppings</button>`;
    }
    return `<div class="pz-ph k-${PH.kit}">${barHtml(v)}${hintHtml(v.c && v.c.hint, PH.kit, 26)}
      <div class="pz-stage"><div class="pz-pie k-${PH.kit}" id="pz-pie" data-keep></div><div class="pz-hint">${hint}</div></div>
      ${rows}${trays}<div class="pz-tools">${tools}</div>
      <button class="pz-serve" id="pz-serve">🛎️ Serve it!</button></div>`;
  }
  function bindBuilder(el, v, ctx) {
    const C = K[PH.kit];
    const changed = (h = 'tap') => { ctx.haptic(h); drawDish(el); queueSend(ctx); };
    const redraw = () => { phone(el, v, ctx, true); };
    for (const b of el.querySelectorAll('[data-row]')) b.onclick = () => { const r = C.rows.find((x) => x.key === b.dataset.row); const o = r && r.opts.find((x) => String(x[0]) === b.dataset.val); if (!o) return; PH.draft[r.key] = o[0]; changed('select'); redraw(); };
    for (const b of el.querySelectorAll('[data-paint]')) b.onclick = () => { PH.sel = b.dataset.paint; ctx.haptic('tap'); redraw(); };
    for (const b of el.querySelectorAll('[data-stack]')) b.onclick = () => { const st = PH.draft.stack; if (st.length >= C.max) { ctx.haptic('error'); return; } st.push(b.dataset.stack); changed('select'); redraw(); };
    for (const b of el.querySelectorAll('[data-toggle]')) b.onclick = () => { const x = b.dataset.toggle; if (PH.draft.top[x]) delete PH.draft.top[x]; else PH.draft.top[x] = 1; changed('select'); redraw(); };
    const q = (id) => el.querySelector(id);
    if (q('#pz-all')) q('#pz-all').onclick = () => { const k = PH.sel, full = (1 << C.slots) - 1; if ((PH.draft.top[k] || 0) === full) delete PH.draft.top[k]; else PH.draft.top[k] = full; changed('select'); redraw(); };
    if (q('#pz-undo')) q('#pz-undo').onclick = () => { if (PH.draft.stack.length) { PH.draft.stack.pop(); changed('tap'); redraw(); } };
    q('#pz-clear').onclick = () => { if (C.slots) PH.draft.top = {}; if (C.stack) PH.draft.stack = []; changed('warn'); redraw(); };
    q('#pz-serve').onclick = async () => {
      clearTimeout(PH.sendT);
      const r = await ctx.act({ op: 'serve', round: PH.round, dish: PH.draft });
      if (r && r.ok) { ctx.haptic('success'); ctx.sfx && ctx.sfx('chime'); }
    };
    // Painting (pizza slices, tacos, sushi pieces): press to add (or remove) the topping, then swipe across more.
    const box = q('#pz-pie');
    if (!C.stack) {
      const apply = (sl) => {
        if (sl < 0 || !PH.paint || PH.paint.done.has(sl)) return;
        PH.paint.done.add(sl);
        const k = PH.sel, m = PH.draft.top[k] || 0, bit = 1 << sl, nm = PH.paint.add ? m | bit : m & ~bit;
        if (nm === m) return;
        if (nm) PH.draft.top[k] = nm; else delete PH.draft.top[k];
        changed('tap');
      };
      box.onpointerdown = (e) => {
        const sl = slotAt(box, e.clientX, e.clientY); if (sl < 0) return;
        e.preventDefault(); try { box.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
        PH.paint = { add: !((PH.draft.top[PH.sel] || 0) & (1 << sl)), done: new Set() }; apply(sl);
      };
      box.onpointermove = (e) => { if (PH.paint) apply(slotAt(box, e.clientX, e.clientY)); };
      box.onpointerup = box.onpointercancel = () => { if (PH.paint) { PH.paint = null; redraw(); } };
    } else box.onpointerdown = box.onpointermove = box.onpointerup = null;
    drawDish(el);
  }
  function phone(el, v, ctx, local) {
    if (!v) return;
    const key = v.phase + ':' + v.round;
    document.body.dataset.kitchen = v.kitchen || 'pizza';
    if (!local) PH.endAt = v.endsIn ? Date.now() + v.endsIn : 0;
    if (!local && key !== PH.lastPhase) {
      PH.lastPhase = key;
      if (v.phase === 'order') ctx.haptic(v.c && v.c.isChef ? 'big' : 'turn');
      if (v.phase === 'build' && !(v.c && v.c.isChef)) ctx.haptic('turn');
      if (v.phase === 'reveal' && v.c && v.c.mine) ctx.haptic(v.c.mine.best ? 'win' : v.c.mine.score >= 60 ? 'success' : 'error');
      if (v.phase === 'over') ctx.haptic(v.rank === 1 ? 'win' : 'success');
    }
    const kit = (v.c && v.c.kitchen) || v.kitchen || 'pizza', C = K[kit] || K.pizza;
    if (v.phase === 'over') {
      const F = v.final || {}, mine = (F.awards || []).filter((a) => a.id === v.me);
      return BOX.morph(el, `<div class="pz-ph pz-card pz-end"><div class="pz-stamp">CLOSING TIME</div><h2>${v.rank === 1 ? '🏆 Best cook in town!' : `#${v.rank} of ${v.ranked}`}</h2><p class="pz-big-n">💰 ${v.points} in tips</p>
        ${mine.map((a) => `<div class="pz-aw">${esc(a.icon)} <b>${esc(a.title)}</b> <small>${esc(a.text)}</small></div>`).join('')}<p class="muted">${v.court ? 'Thanks from the whole YesChef food court!' : `Thanks from ${esc(C.owner)}!`}</p></div>`);
    }
    const c = v.c || {};
    if (c.isChef && (v.phase === 'order' || v.phase === 'build')) {
      const t = c.ticket || {};
      return BOX.morph(el, `<div class="pz-ph">${barHtml(v)}<div class="pz-card pz-ticket"><div class="pz-tk-h">🧑‍🍳 You’re the HEAD CHEF</div>
        <p class="pz-tk-say">Describe this ${esc(C.dish)} out loud. <b>Don’t show your screen!</b></p>${dishSvg(t, { size: 250, k: kit })}
        <p class="pz-tk-words">${esc(t.words || '')}</p>${v.phase === 'build' ? `<p class="muted">The cooks are building… you earn their average match.</p>` : `<p class="muted">The kitchen starts in a moment.</p>`}</div></div>`);
    }
    if (v.phase === 'order') {
      const msg = c.mode === 'phone' ? '☎️ Listen! The customer is reading the order.' : c.mode === 'chef' ? `👂 Listen to the head chef, ${esc(c.chef ? c.chef.name : '')}!` : `👀 Look at the TV and remember the ${esc(C.dish)}!`;
      return BOX.morph(el, `<div class="pz-ph">${barHtml(v)}<div class="pz-card pz-look"><div class="pz-kit">${C.icon} ${esc(C.name)} ${lvlChip(v.level)}</div><div class="pz-look-i">${c.mode === 'phone' ? '☎️' : c.mode === 'chef' ? '👂' : '👀'}</div><h2>${msg}</h2><p>${esc(c.customer ? c.customer.name : '')} ${esc(c.customer ? c.customer.job : '')} is ordering.</p>${c.speed ? '<p class="pz-rushnote">⏱️ Rush: serve fast for a speed tip!</p>' : ''}</div></div>`);
    }
    if (v.phase === 'build') {
      const tops = (c.palette && c.palette.tops && c.palette.tops.length ? c.palette.tops : C.tops) || null;
      if (PH.round !== v.round || PH.kit !== kit) { PH.round = v.round; PH.kit = kit; PH.draft = c.draft ? copy(c.draft, kit) : blank(kit); PH.sel = tops ? tops[0] : null; }
      if (tops && !tops.includes(PH.sel)) PH.sel = tops[0];
      if (c.served) {
        return BOX.morph(el, `<div class="pz-ph">${barHtml(v)}<div class="pz-card pz-served"><h2>🛎️ Served!</h2>${dishSvg(PH.draft, { size: 240, k: kit })}<p>Waiting for ${v.c.waiting} more cook${v.c.waiting === 1 ? '' : 's'}…</p></div></div>`);
      }
      if (!local && el.querySelector('#pz-pie') && PH.paint) return; // mid-swipe: don't touch the screen
      BOX.morph(el, builderHtml(v));
      bindBuilder(el, v, ctx);
      return;
    }
    if (v.phase === 'reveal') {
      const o = c.order, me = c.mine;
      if (c.chefRow) return BOX.morph(el, `<div class="pz-ph">${barHtml(v)}<div class="pz-card pz-rev"><h2>🧑‍🍳 Your cooks matched ${c.chefRow.avg}%</h2><p class="pz-gain">+${c.chefRow.gain}</p>${dishSvg(o, { size: 200, k: kit })}</div></div>`);
      return BOX.morph(el, `<div class="pz-ph">${barHtml(v)}<div class="pz-card pz-rev">
        <div class="pz-vs"><figure>${dishSvg(o, { size: 150, k: kit })}<figcaption>The order</figcaption></figure><figure>${dishSvg(me && me.pizza, { size: 150, k: kit })}<figcaption>Yours</figcaption></figure></div>
        ${me ? `<div class="pz-score"><span class="pz-face">${face(me.score)}</span><b>${me.score}%</b><small>match</small></div><p class="pz-gain">+${me.gain} tips${me.speed ? ` <small>(⏱️ +${me.speed} speed)</small>` : ''}${me.best ? ` <small>🏅 best ${esc(C.dish)}!</small>` : ''}</p><p class="muted">#${me.place} of ${me.of} this order</p>` : '<p>You sat this one out.</p>'}
        <p class="pz-words">${esc(o ? o.words : '')}</p></div></div>`);
    }
    BOX.morph(el, `<div class="pz-ph"><div class="pz-card"><h2>🧑‍🍳 Get ready…</h2></div></div>`);
  }

  // ---------------- TV ----------------
  const TV = { said: null, cv: null, raf: 0, host: null, anim: null, hostKit: null, sayUntil: 0, custSaid: null, bgKey: '' };
  const intro = () => BOX.intros && BOX.intros.pizza;
  const ownerOf = (k) => { const I = intro(); return I && I.owners ? I.owners[k] || I.owners.pizza : null; };
  function speak(text, spec, talk) {
    try { if (BOX.voice && BOX.voice.speak) BOX.voice.speak(text, spec || {}); } catch (e) { /* no voice */ }
    if (talk) { const ms = Math.max(1500, text.length * 62); TV.sayUntil = Date.now() + ms; if (TV.anim) TV.anim.talk(performance.now(), ms); }
  }
  // The owner herself (or himself), drawn with the intro's character, by the kitchen door.
  function ownerLoop() {
    TV.raf = requestAnimationFrame(ownerLoop);
    const cv = TV.cv; if (!cv || !cv.isConnected) return;
    const H = ownerOf(TV.kit); if (!H || !BOX.studio) return;
    if (TV.hostKit !== TV.kit) { try { TV.host = H.draw.bind(H); TV.anim = new BOX.studio.HostAnim(H); TV.hostKit = TV.kit; } catch (e) { return; } }
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    const sc = cv.height / 470; g.translate(cv.width / 2, cv.height * 1.02); g.scale(sc, sc);
    if (Date.now() < TV.sayUntil && TV.anim.talkUntil < performance.now()) TV.anim.talk(performance.now(), TV.sayUntil - Date.now());
    try { TV.host(g, TV.anim.frame(performance.now())); } catch (e) { /* drawing */ }
  }
  // The kitchen's back wall: the intro's set, painted once per kitchen (and on resize).
  function paintBackdrop(el, kit) {
    const box = el.querySelector('#pz-bg'); if (!box) return;
    if (!box.querySelector('canvas')) box.innerHTML = '<canvas></canvas>';
    const cv = box.querySelector('canvas'), I = intro();
    if (!I || !I.backdrop) { if (BOX.studio && BOX.studio.need) BOX.studio.need('pizza', () => { TV.bgKey = ''; paintBackdrop(el, kit); }); return; }
    const r = box.getBoundingClientRect(), dpr = Math.min(1.5, window.devicePixelRatio || 1), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
    const sig = kit + ':' + w + 'x' + h;
    if (TV.bgKey === sig && cv.width === w) return;
    if (!w || !h) return;
    TV.bgKey = sig; cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), sc = Math.max(w / 1920, h / 1080) * 1.02;
    g.setTransform(sc, 0, 0, sc, (w - 1920 * sc) / 2, h * 0.76 - 800 * sc);
    try { I.backdrop(g, kit, { t: 3.2, now: 0 }, { owners: kit === 'court' }); } catch (e) { console.error(e); }
  }
  function mount(el, kit) {
    TV.kit = kit;
    paintBackdrop(el, kit);
    const box = el.querySelector('#pz-nonna'); if (!box) return;
    if (!box.querySelector('canvas')) box.innerHTML = '<canvas></canvas>';
    TV.cv = box.querySelector('canvas');
    if (BOX.studio && BOX.studio.need) BOX.studio.need('pizza', () => {});
    if (!TV.raf) TV.raf = requestAnimationFrame(ownerLoop);
  }
  if (!window.__pzResize) { window.__pzResize = true; window.addEventListener('resize', () => { TV.bgKey = ''; }); }
  const CUST_VOICE = { like: /male|guy|david|mark|george|ryan|zira|aria|jenny/i, accent: /en-US|en-GB/i, pitch: 1.15, rate: 1.0 };
  function scene(inner, s, extraCls = '', kit = 'pizza') {
    const N = s.nonna, C = K[kit] || COURT, who = N && (K[N.who] || C);
    return `<div class="pz-tv k-${kit} ${extraCls}"><div class="pz-wall"></div><div class="pz-bg" id="pz-bg" data-keep></div><div class="pz-neon k-${kit}">${esc(C.sign[0])}<b>${esc(C.sign[1])}</b></div><div class="pz-yc">Yes<b>Chef</b>${s.court ? ' · food court' : ''}</div>
      <div class="pz-board"><small>ORDER</small><b>${s.round}<span>/${s.of}</span></b>${s.c ? `<em>${esc(s.c.modeIcon)} ${esc(s.c.modeName)}</em>` : ''}${lvlChip(s.level)}</div>
      ${inner}
      <div class="pz-counter"></div>
      <div class="pz-nonnabox"><div class="pz-nonna" id="pz-nonna" data-keep></div></div>${N ? `<div class="pz-nb" id="pz-nb-${N.key}"><b>${esc(who.owner)}</b><p>${esc(N.text)}</p></div>` : ''}</div>`;
  }
  function tvOrder(el, s, kit) {
    const c = s.c, cu = c.customer, walking = c.showIn > 0, C = K[kit];
    const greet = c.mode === 'phone' ? `☎️ ${esc(C.ring)}` : c.mode === 'chef' ? `I gave my ticket to the head chef, ${esc(c.chef ? c.chef.name : '')}. Listen to them!` : esc(C.greet);
    const show = c.order ? `<div class="pz-plate in" id="pz-pl-${c.id}"><div class="pz-memo">Remember it!</div>${dishSvg(c.order, { size: 430, k: kit })}<div class="pz-peek"><i style="animation-duration:${c.peek}ms"></i></div></div>`
      : c.words ? `<div class="pz-phonecard"><div class="pz-ring">☎️</div><p>“${esc(c.words)}”</p><div class="pz-peek"><i style="animation-duration:${c.peek}ms"></i></div></div>`
        : c.mode === 'chef' ? `<div class="pz-phonecard pz-chefcard"><div class="pz-ring">🧑‍🍳</div><p>${av(c.chef)} <b>${esc(c.chef ? c.chef.name : '')}</b> has the ticket.<br>Head chef, read it out loud!</p></div>` : '';
    BOX.morph(el, scene(`<div class="pz-cust-wrap arrive" id="pz-cu-${c.id}">${customerSvg(cu, walking ? 'wait' : 'say', 300)}</div><div class="pz-tag"><b>${esc(cu.name)}</b><small>${esc(cu.job)}</small></div>
      ${walking ? '' : `<div class="pz-bubble" id="pz-bu-${c.id}">${greet}</div>`}${show}`, s, 'ph-order', kit));
    mount(el, kit);
    // Easy: the customer reads the order out slower (a live clip at 0.8× speed).
    if (c.words && TV.custSaid !== c.id + ':w') { TV.custSaid = c.id + ':w'; speak(c.words, c.slow ? { ...CUST_VOICE, rate: 0.8, kokoro: 'bf_emma', speed: 0.8 } : CUST_VOICE, false); }
  }
  function cooksHtml(c) {
    return `<div class="pz-cooks">${(c.cooks || []).map((k) => `<span class="pz-cook ${k.served ? 'done' : ''}">${BOX.face ? BOX.face(k, 26) : av(k)} ${esc(k.name)} ${k.served ? '🛎️' : '<i class="pz-dots"><b></b><b></b><b></b></i>'}</span>`).join('')}</div>`;
  }
  function tvBuild(el, s, kit) {
    const c = s.c, cu = c.customer, C = K[kit];
    const center = c.words ? `<div class="pz-phonecard"><div class="pz-ring">📜</div><p>The head chef stepped out, so here’s the ticket: “${esc(c.words)}”</p></div>`
      : `<div class="pz-box ${c.hint ? 'has-hint' : ''}"><div class="pz-box-lid">?</div><div class="pz-box-txt">${c.mode === 'chef' ? `🧑‍🍳 ${esc(c.chef ? c.chef.name : '')} is describing it` : c.hint ? 'Hidden! Where did it all go?' : 'The order is a secret now. Cook from memory!'}</div>${hintHtml(c.hint, kit, 46)}</div>`;
    BOX.morph(el, scene(`<div class="pz-cust-wrap wait" id="pz-cu-${c.id}">${customerSvg(cu, 'think', 300)}</div><div class="pz-tag"><b>${esc(cu.name)}</b><small>is waiting…</small></div>
      <div class="pz-clock ${s.endsIn < 10000 ? 'low' : ''}">${timer(s.endsIn)}</div>${center}
      <div class="pz-status"><h3>${C.icon} Cooking! <small>${c.served} of ${c.of} served</small></h3>${cooksHtml(c)}</div>`, s, 'ph-build', kit));
    mount(el, kit);
  }
  function tvReveal(el, s, kit) {
    const c = s.c, cu = c.customer, C = K[kit], m = C.mood[c.mood] || C.mood.ok, rows = c.rows || [], top = rows[0];
    const reaction = !top ? 'Nobody made me anything?!' : c.mood === 'great' ? `${m[1]} ${esc(top.name)} nailed it!` : c.mood === 'ok' ? `${m[1]} ${esc(top.name)} came closest.` : `${m[1]} The best was ${esc(top.name)}’s…`;
    const n = rows.length + (c.more ? 1 : 0), sz = n <= 2 ? 250 : n <= 4 ? 190 : n <= 6 ? 160 : n <= 8 ? 140 : 112;
    BOX.morph(el, scene(`<div class="pz-cust-wrap react" id="pz-cu-${c.id}">${customerSvg(cu, c.mood || 'ok', 250)}</div><div class="pz-bubble rv" id="pz-bu-${c.id}-r">${m[0]} ${reaction}</div>
      <div class="pz-reveal" id="pz-rv-${c.id}"><figure class="pz-orderfig"><figcaption>THE ORDER</figcaption>${dishSvg(c.order, { size: 300, k: kit })}<p>${esc(c.words || '')}</p></figure>
        <div class="pz-grid" style="--sz:${sz}px">${rows.map((r, i) => `<figure class="pz-entry ${r.best ? 'best' : ''}" style="animation-delay:${i * 120}ms">${r.best ? '<div class="pz-crown">🏅</div>' : ''}${dishSvg(r.pizza, { size: sz, k: kit })}
          <figcaption><span>${av(r)} ${esc(r.name)}</span><b>${face(r.score)} ${r.score}%</b><small>+${r.gain}${r.speed ? ' ⏱️' : ''}</small></figcaption></figure>`).join('')}
          ${c.more ? `<div class="pz-more">+${c.more} more cooks</div>` : ''}</div></div>
      ${c.chefRow ? `<div class="pz-chefrow">🧑‍🍳 Head chef ${av(c.chefRow)} <b>${esc(c.chefRow.name)}</b>: the cooks averaged ${c.chefRow.avg}% · +${c.chefRow.gain}</div>` : ''}`, s, 'ph-reveal', kit));
    mount(el, kit);
  }
  function tvOver(el, s, kit) {
    const F = s.final || {}, st = F.standings || s.standings || [], pod = st.slice(0, 3);
    const order = [1, 0, 2].filter((i) => pod[i]);
    const big = (p, n) => (BOX.face ? BOX.face(p, n) : av(p));
    BOX.morph(el, scene(`<div class="pz-over"><h1>🏆 ${av(st[0])} ${esc((st[0] || {}).name || '')} is the best cook in town!</h1>
      <div class="pz-podium">${order.map((i) => `<div class="pz-pod p${i + 1}"><div class="pz-pav">${big(pod[i], 64)}</div><b>${esc(pod[i].name)}</b><span>💰 ${pod[i].points}</span><div class="pz-step">${i + 1}</div></div>`).join('')}</div>
      <div class="pz-awards">${(F.awards || []).map((a) => `<div class="pz-award"><i>${esc(a.icon)}</i><b>${esc(a.title)}</b><span>${av(a)} ${esc(a.name)}</span><small>${esc(a.text)}</small></div>`).join('')}</div>
      <div class="pz-rest">${st.slice(3, 12).map((r, i) => `<span>${i + 4}. ${av(r)} ${esc(r.name)} <b>${r.points}</b></span>`).join('')}</div></div>`, { ...s, c: null }, 'ph-over', kit));
    mount(el, kit);
  }

  function lobbyTv(el, L) {
    if (!el.querySelector('.pz-lobby')) {
      el.innerHTML = `<div class="pz-lobby"><div class="pz-wall"></div><div class="pz-bg" id="pz-bg" data-keep></div>
        <div class="pz-l-head"><div class="pz-neon big k-court">Yes<b>Chef</b></div><p>The YesChef food court is hiring! A customer shows their dish for a few seconds: rebuild it from memory.</p></div>
        <div class="pz-l-main">
          <div class="pz-l-board"><h2>Tonight’s kitchen <span class="pz-lvl" id="pz-l-lvl"></span></h2><div class="pz-l-set" id="settings"></div><div class="pz-l-err" id="lobby-err"></div>
            <button class="pz-l-start" id="start">🧑‍🍳 Open the kitchens</button><div class="pz-l-links"><button class="link" id="add-bots">+ 5 test bots</button> <button class="link" id="pick">🎮 Another game</button></div></div>
          <div class="pz-l-box"><div class="pz-l-boxlid">Scan to cook!</div><img id="qr" alt="QR code to join"><div class="pz-l-cl">Room code</div><div class="pz-l-code" id="code"></div></div>
        </div>
        <div class="pz-l-rail"><div class="pz-l-bar"></div><div class="pz-l-roster" id="roster"></div></div></div>`;
      el.querySelector('#start').onclick = async () => { const r = await L.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      el.querySelector('#add-bots').onclick = () => L.bots(5);
      el.querySelector('#pick').onclick = () => L.pick();
    }
    const kit = K[L.settings.kitchen] ? L.settings.kitchen : 'court';
    const lv = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard' }[L.settings.difficulty] || '', lvEl = el.querySelector('#pz-l-lvl');
    if (lvEl && lvEl.textContent !== lv) { lvEl.textContent = lv; lvEl.className = 'pz-lvl l-' + (L.settings.difficulty || ''); }
    TV.bgKey = TV.lobbyKit === kit ? TV.bgKey : ''; TV.lobbyKit = kit;
    paintBackdrop(el.querySelector('.pz-lobby'), kit);
    el.querySelector('#code').textContent = L.code;
    const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
    const set = el.querySelector('#settings'), sig = JSON.stringify(L.settings);
    if (set.dataset.sig !== sig && !set.contains(document.activeElement)) {
      set.dataset.sig = sig;
      set.innerHTML = L.fields.map((f) => `<label class="pz-l-f ${f.key === 'kitchen' ? 'wide' : ''}"><span>${esc(f.label)}</span><select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
      for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => L.set(s.dataset.set, s.value);
    }
    BOX.morph(el.querySelector('#roster'), L.players.map((p, i) => `<span class="chip pz-l-ticket" style="--r:${((i * 37) % 9) - 4}deg"><small>#${101 + i}</small>${av(p)} ${esc(p.name)}</span>`).join('') || '<span class="pz-l-empty">Scan the code to put on an apron. 3–10 cooks is perfect.</span>');
  }

  BOX.games.pizza = {
    name: 'YesChef', icon: '🧑‍🍳',
    about: 'The YesChef food court: pizza, tacos, sushi, burgers and sundaes. A customer shows their order for a few seconds; rebuild it from memory on your phone. Closest dish wins the tip.',
    how: [
      'Pick a kitchen in the settings (Pizzeria, Taco Truck, Sushi Bar, Burger Joint, Sundae Stand), or let it be a surprise, or open the whole food court: a new kitchen every order.',
      'A customer comes to the counter and shows the dish they want, for just a few seconds. Remember it! Then it’s hidden.',
      'On your phone, rebuild it: the base first (crust, tortilla, wrap, bun or cone), then the rest.',
      'Pizza, tacos and sushi: pick a topping and tap or swipe across the slices, tacos or pieces. Burgers and sundaes: stack it bottom to top. The order matters!',
      'Tap 🛎️ Serve when it’s ready. Modes: Lunch Rush (speed tips), each kitchen’s special (Half & Half, Mix & Match, Rainbow Roll, Tower Burger, Mega Sundae), Phone Order, Flash Order, Head Chef, or Mixed.',
      'The closer the match, the bigger the tip; the best dish each order earns a bonus. Most tips wins.',
    ],
    fx: { start: 'start', shown: 'pop', reveal: 'reveal', win: 'win' },
    // Recorded kitchen sounds (public/audio/sfx/pizza/): the shop door chimes as a customer walks in (or the
    // phone rings for a phone order), knives chop when the cooking starts, the counter bell dings for every
    // served dish, and the food court claps at the end. The old sound if there's no BOX.audio.
    onFx(f) {
      const a = BOX.audio, clip = (n, o) => { if (!a || !a.clip) return false; try { a.clip('pizza/' + n + '.ogg', o); } catch { /* no audio */ } return true; };
      if (f.kind === 'order') (f.mode === 'phone' ? clip('phone', { vol: 0.2, jitter: 0 }) : clip('door', { vol: 0.26 })) || BOX.sfx('join');
      else if (f.kind === 'build') clip('chop', { vol: 0.2 }) || BOX.sfx('whoosh');
      else if (f.kind === 'serve') clip('bell', { vol: 0.24, gap: 250 }) || BOX.sfx('chime');
      else if (f.kind === 'win') clip('applause', { vol: 0.13, delay: 1 });
    },
    // Each kitchen has its own tune while the order is shown; building is the shared kitchen groove.
    music: (s) => (s.phase === 'order' ? ({ pizza: 'play', taco: 'taco', sushi: 'sushi', burger: 'burger', sundae: 'sundae' }[s.kitchen] || 'play') : s.phase === 'build' ? 'think' : s.phase === 'reveal' ? 'reveal' : s.phase === 'over' ? 'finale' : undefined),
    lobbyTv,
    dishSvg, pizzaSvg, tacoSvg, sushiSvg, burgerSvg, sundaeSvg, customerSvg, itemIcon, KITCHENS: K, // shared drawings (the title screen and tests use them)
    tv(el, s) {
      if (!s) return;
      if (BOX.voice && BOX.voice.preload && !TV.pre) { TV.pre = true; try { BOX.voice.preload('pizza'); } catch (e) { /* no */ } }
      const kit = (s.c && s.c.kitchen) || s.kitchen || 'pizza';
      document.body.dataset.kitchen = kit;
      // The owner's lines (not over the customer reading a phone order)
      if (s.nonna && TV.said !== s.nonna.key) { TV.said = s.nonna.key; const quiet = s.phase === 'order' && s.c && s.c.mode === 'phone'; if (!quiet) { const O = ownerOf(s.nonna.who || kit); speak(s.nonna.text, O && O.voice, true); } }
      if (s.phase === 'over') return tvOver(el, s, s.court ? 'court' : kit);
      if (!s.c) { BOX.morph(el, scene('', s, '', kit)); return mount(el, kit); }
      if (s.phase === 'order') return tvOrder(el, s, kit);
      if (s.phase === 'build') return tvBuild(el, s, kit);
      if (s.phase === 'reveal') return tvReveal(el, s, kit);
    },
    phone,
  };
})();
