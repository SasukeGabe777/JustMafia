'use strict';
// JustPizza: TV and phone screens. Nonna Pina's pizzeria: on the TV a customer walks up to the
// counter and shows (or reads out) the pizza they want, Nonna (drawn with the intro's own
// character, BOX.intros.pizza.host) runs the kitchen, and the reveal puts every cook's pizza
// next to the order. Each phone is a pizza station: crust, sauce, cheese, and toppings painted
// onto the slices with a tap or a swipe.
(function () {
  const { esc, timer } = BOX;
  const av = (r) => esc((r && r.avatar) || '🙂');
  const TOPS = ['pepperoni', 'mushroom', 'pepper', 'olive', 'onion', 'pineapple', 'ham', 'basil', 'jalapeno', 'sausage'];
  const TOP_NAME = { pepperoni: 'Pepperoni', mushroom: 'Mushroom', pepper: 'Pepper', olive: 'Olive', onion: 'Onion', pineapple: 'Pineapple', ham: 'Ham', basil: 'Basil', jalapeno: 'Jalapeño', sausage: 'Sausage' };
  const CRUSTS = [['thin', 'Thin'], ['classic', 'Classic'], ['deep', 'Deep dish']];
  const SAUCES = [['tomato', 'Tomato', '#c8321f'], ['white', 'White', '#f1e6c8'], ['pesto', 'Pesto', '#4f8a2b'], ['bbq', 'BBQ', '#6b2a14'], ['none', 'None', '#f0cf93']];
  const SAUCE_COL = Object.fromEntries(SAUCES.map(([k, , c]) => [k, c]));
  const CHEESES = [[0, 'No cheese'], [1, 'Cheese'], [2, 'Extra']];
  const MOOD = { great: ['😍', 'Perfetto!'], ok: ['🙂', 'Not bad!'], bad: ['😖', 'Mamma mia…'] };
  const face = (score) => (score >= 95 ? '😍' : score >= 80 ? '😋' : score >= 60 ? '🙂' : score >= 35 ? '😐' : '😖');

  // ---------------- the pizza (SVG, the same on the TV and phones) ----------------
  // Slices are numbered clockwise from 12 o'clock; topping masks have bit i for slice i.
  const SPOTS = [[0.78, 0.3], [0.78, 0.72], [0.55, 0.5], [0.6, 0.15], [0.6, 0.86], [0.32, 0.5], [0.9, 0.52]];
  const pt = (r, deg) => [Math.sin((deg * Math.PI) / 180) * r, -Math.cos((deg * Math.PI) / 180) * r];
  const f1 = (n) => Math.round(n * 10) / 10;
  function piece(kind, x, y, rot) {
    const t = `transform="translate(${f1(x)} ${f1(y)}) rotate(${Math.round(rot)})"`;
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
  function toppingIcon(kind, size = 34) {
    return `<svg viewBox="-10 -10 20 20" width="${size}" height="${size}" aria-hidden="true">${piece(kind, -2.5, -2.5, 0)}${piece(kind, 3, 3, 40)}</svg>`;
  }
  // pizzaSvg(p): p = { crust, sauce, cheese, top } or null (an empty plate). o.slices: show cut lines.
  function pizzaSvg(p, o = {}) {
    const size = o.size || 200, cls = o.cls || '';
    const plate = `<circle r="108" fill="#f7f2e8" stroke="#2a160c" stroke-width="3"/><circle r="100" fill="none" stroke="#e2d8c5" stroke-width="2"/>`;
    if (!p) return `<svg class="pz-svg ${cls}" viewBox="-110 -110 220 220" width="${size}" height="${size}" aria-label="an empty plate">${plate}<text y="14" text-anchor="middle" font-size="44" fill="#c9bda5" font-family="Lilita One, sans-serif">?</text></svg>`;
    const rim = { thin: 5, classic: 11, deep: 15 }[p.crust] || 11;
    const R = 96, inner = R - rim;
    let s = plate;
    if (p.crust === 'deep') s += `<circle r="${R + 3}" fill="#3a3a42" stroke="#1d1d22" stroke-width="2"/>`;
    s += `<circle r="${R}" fill="url(#pzCrust)" stroke="#6b3a14" stroke-width="2.2"/>`;
    // the sauce with a wobbly edge
    const wob = (r, amp, n, ph) => { let d = ''; for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2, rr = r + Math.sin(a * n + ph) * amp; d += (i ? 'L' : 'M') + f1(Math.cos(a) * rr) + ' ' + f1(Math.sin(a) * rr); } return d + 'Z'; };
    s += `<path d="${wob(inner - 1, 1.6, 7, 0.4)}" fill="${SAUCE_COL[p.sauce] || SAUCE_COL.none}"${p.sauce === 'none' ? ' opacity=".9"' : ''}/>`;
    if (p.sauce === 'pesto') s += `<path d="${wob(inner - 6, 1.2, 9, 1)}" fill="none" stroke="#6fb543" stroke-width="2" stroke-dasharray="3 5" opacity=".7"/>`;
    if (p.cheese > 0) {
      s += `<path d="${wob(inner - (p.cheese === 2 ? 3 : 9), p.cheese === 2 ? 2.5 : 3.5, 11, 2)}" fill="#ffd968" opacity="${p.cheese === 2 ? 0.97 : 0.88}"/>`;
      const spots = p.cheese === 2 ? 18 : 8;
      for (let i = 0; i < spots; i++) { const [x, y] = pt((inner - 14) * (0.25 + ((i * 37) % 70) / 100), i * 137.5); s += `<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="${p.cheese === 2 ? 4 : 3}" ry="2.4" fill="${i % 3 ? '#ffe9a6' : '#e8a93e'}" opacity=".75"/>`; }
    }
    if (o.slices !== false) for (let i = 0; i < 8; i++) { const [x, y] = pt(R - 2, i * 45); s += `<line x1="0" y1="0" x2="${f1(x)}" y2="${f1(y)}" stroke="rgba(110,50,15,.33)" stroke-width="1.3"/>`; }
    // toppings: each slice shares its spots between the toppings on it
    const top = p.top || {};
    for (let sl = 0; sl < 8; sl++) {
      const here = TOPS.filter((k) => (top[k] || 0) & (1 << sl)), n = here.length;
      here.forEach((k, j) => { for (let q = j, c = 0; q < SPOTS.length && c < 3; q += n, c++) { const [rf, af] = SPOTS[q], [x, y] = pt((inner - 4) * rf, sl * 45 + af * 45); s += piece(k, x, y, (sl * 53 + q * 97 + j * 31) % 360); } });
    }
    if (o.hl != null) for (const sl of o.hl) { const [x1, y1] = pt(R, sl * 45), [x2, y2] = pt(R, sl * 45 + 45); s += `<path d="M0 0 L${f1(x1)} ${f1(y1)} A${R} ${R} 0 0 1 ${f1(x2)} ${f1(y2)}Z" fill="rgba(255,255,255,.22)"/>`; }
    return `<svg class="pz-svg ${cls}" viewBox="-110 -110 220 220" width="${size}" height="${size}" aria-label="a pizza"><defs><radialGradient id="pzCrust"><stop offset=".75" stop-color="#e9b064"/><stop offset=".93" stop-color="#d48a3a"/><stop offset="1" stop-color="#a95f20"/></radialGradient></defs>${s}</svg>`;
  }

  // ---------------- the customers (SVG people at the counter) ----------------
  function customerSvg(c, mood = 'wait', size = 220) {
    if (!c) return '';
    const O = '#2a160c', sk = c.skin, sh = c.shirt, hr = c.hair;
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
      none: '',
    }[c.hat] || '';
    const hair = c.hat === 'helmet' || c.hat === 'police' ? '' : c.id === 'hugo' ? `<path d="M-38 -14 Q-44 -30 -32 -32 M38 -14 Q44 -30 32 -32" stroke="${hr}" stroke-width="10" fill="none" stroke-linecap="round"/>`
      : c.kid ? `<path d="M-36 -10 Q-40 -46 0 -44 Q40 -46 36 -10 Q30 -32 0 -32 Q-30 -32 -36 -10Z" fill="${hr}" stroke="${O}" stroke-width="3"/><circle cx="-44" cy="0" r="10" fill="${hr}" stroke="${O}" stroke-width="3"/><circle cx="44" cy="0" r="10" fill="${hr}" stroke="${O}" stroke-width="3"/>`
        : c.id === 'kiki' ? `<path d="M-36 -18 Q-46 10 -34 26 M36 -18 Q46 10 34 26" stroke="${hr}" stroke-width="12" fill="none" stroke-linecap="round"/>`
          : c.id === 'dot' ? `<path d="M-36 -16 Q-40 -46 0 -46 Q40 -46 36 -16Z" fill="${hr}" stroke="${O}" stroke-width="3"/><circle cx="0" cy="-50" r="12" fill="${hr}" stroke="${O}" stroke-width="3"/>`
            : `<path d="M-36 -16 Q-40 -46 0 -46 Q40 -46 36 -16 Q20 -30 -36 -16Z" fill="${hr}" stroke="${O}" stroke-width="3"/>`;
    const beard = c.beard ? `<path d="M-30 4 Q-30 40 0 44 Q30 40 30 4 Q20 22 0 22 Q-20 22 -30 4Z" fill="${hr}" stroke="${O}" stroke-width="3"/>` : '';
    const glasses = c.glasses ? `<circle cx="-11" cy="-4" r="9" fill="rgba(255,255,255,.25)" stroke="${O}" stroke-width="2.6"/><circle cx="11" cy="-4" r="9" fill="rgba(255,255,255,.25)" stroke="${O}" stroke-width="2.6"/><path d="M-2 -4 L2 -4" stroke="${O}" stroke-width="2.6"/>` : '';
    const extra = c.id === 'daisy' ? `<path d="M-20 50 l6 -6 l6 6 l-6 6Z" fill="#ffd23f" stroke="${O}" stroke-width="2"/>` : c.id === 'mia' ? `<text x="0" y="66" text-anchor="middle" font-size="22" font-family="Lilita One, sans-serif" fill="#fff" stroke="${O}" stroke-width="1">10</text>` : c.id === 'gus' ? `<path d="M-46 66 L46 66" stroke="#ffd23f" stroke-width="7"/>` : c.id === 'ted' ? `<path d="M-20 26 L0 46 L20 26" fill="none" stroke="#fff" stroke-width="5"/>` : c.id === 'hugo' ? `<path d="M-10 28 L0 34 L10 28 L10 40 L0 34 L-10 40Z" fill="#ffd23f" stroke="${O}" stroke-width="2"/>` : '';
    return `<svg class="pz-cust" viewBox="-80 -110 160 200" width="${size}" height="${size * 1.25}" aria-label="${esc(c.name)}"><g transform="translate(0 ${c.kid ? 14 : 0}) scale(${sc})">
      <path d="M-54 90 Q-58 30 -30 24 L30 24 Q58 30 54 90Z" fill="${sh}" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>${extra}
      <rect x="-10" y="12" width="20" height="16" fill="${sk}" stroke="${O}" stroke-width="3"/>
      <g class="pz-head">${c.kid || c.id === 'kiki' || c.id === 'dot' ? hair : ''}<circle cx="-36" cy="0" r="7" fill="${sk}" stroke="${O}" stroke-width="3"/><circle cx="36" cy="0" r="7" fill="${sk}" stroke="${O}" stroke-width="3"/>
        <ellipse cx="0" cy="-2" rx="36" ry="38" fill="${sk}" stroke="${O}" stroke-width="4"/>${c.kid || c.id === 'kiki' || c.id === 'dot' ? '' : hair}${beard}${cheeks}${eyes}${glasses}${brows}<path d="M-3 2 Q0 6 3 2" stroke="${O}" stroke-width="2" fill="none"/>${mouth}${hat}</g></g></svg>`;
  }

  // ---------------- phone ----------------
  const PH = { endAt: 0, round: null, draft: null, sel: 'pepperoni', sendT: 0, lastPhase: '', paint: null, hl: null, lastTapAt: 0 };
  const blank = () => ({ crust: 'classic', sauce: 'none', cheese: 0, top: {} });
  const copy = (p) => ({ crust: p.crust, sauce: p.sauce, cheese: p.cheese, top: { ...(p.top || {}) } });
  const barHtml = (v) => `<div class="pz-bar"><span>${esc(v.c ? v.c.modeIcon : '🍕')} Order ${v.round}/${v.of}${v.c ? ` · ${esc(v.c.modeName)}` : ''}</span><span class="pz-t">${(v.phase === 'build' || v.phase === 'order') && PH.endAt > Date.now() ? `<span class="timer" data-ends="${PH.endAt}">${BOX.mmss(PH.endAt - Date.now())}</span>` : ''}</span><b>💰 ${v.points}</b></div>`;
  function sliceAt(box, x, y) {
    const r = box.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = x - cx, dy = y - cy;
    if (Math.hypot(dx, dy) > (r.width / 2) * (100 / 110)) return -1;
    let a = (Math.atan2(dx, -dy) * 180) / Math.PI; if (a < 0) a += 360;
    return Math.floor(a / 45) % 8;
  }
  function drawPie(el) {
    const box = el.querySelector('#pz-pie'); if (!box) return;
    box.innerHTML = pizzaSvg(PH.draft, { size: 300, cls: 'pz-big' });
  }
  function queueSend(ctx) {
    clearTimeout(PH.sendT);
    PH.sendT = setTimeout(() => { if (PH.draft && PH.round != null) ctx.act({ op: 'build', round: PH.round, pizza: PH.draft }); }, 350);
  }
  function builderHtml(v) {
    const d = PH.draft, sel = PH.sel, m = d.top[sel] || 0;
    const row = (lab, items) => `<div class="pz-row"><span class="pz-lab">${lab}</span><div class="pz-chips">${items}</div></div>`;
    return `<div class="pz-ph">${barHtml(v)}
      <div class="pz-stage"><div class="pz-pie" id="pz-pie" data-keep></div><div class="pz-hint">${esc(TOP_NAME[sel])}: tap or swipe the slices</div></div>
      ${row('Crust', CRUSTS.map(([k, n]) => `<button class="pz-chip crust-${k} ${d.crust === k ? 'on' : ''}" data-crust="${k}"><i></i>${n}</button>`).join(''))}
      ${row('Sauce', SAUCES.map(([k, n, c]) => `<button class="pz-chip ${d.sauce === k ? 'on' : ''}" data-sauce="${k}"><i class="sw" style="background:${c}"></i>${n}</button>`).join(''))}
      ${row('Cheese', CHEESES.map(([k, n]) => `<button class="pz-chip ch-${k} ${d.cheese === k ? 'on' : ''}" data-cheese="${k}"><i></i>${n}</button>`).join(''))}
      <div class="pz-tray">${TOPS.map((k) => `<button class="pz-top ${sel === k ? 'on' : ''} ${d.top[k] ? 'used' : ''}" data-top="${k}">${toppingIcon(k, 34)}<span>${TOP_NAME[k]}</span></button>`).join('')}</div>
      <div class="pz-tools"><button class="pz-tool" id="pz-all">${m === 255 ? '✖ Take off' : '🍕 All over'}</button><button class="pz-tool" id="pz-clear">🧹 Clear toppings</button></div>
      <button class="pz-serve" id="pz-serve">🛎️ Serve it!</button></div>`;
  }
  function bindBuilder(el, v, ctx) {
    const changed = (h = 'tap') => { ctx.haptic(h); drawPie(el); queueSend(ctx); };
    const redraw = () => { phone(el, v, ctx, true); };
    for (const b of el.querySelectorAll('[data-crust]')) b.onclick = () => { PH.draft.crust = b.dataset.crust; changed('select'); redraw(); };
    for (const b of el.querySelectorAll('[data-sauce]')) b.onclick = () => { PH.draft.sauce = b.dataset.sauce; changed('select'); redraw(); };
    for (const b of el.querySelectorAll('[data-cheese]')) b.onclick = () => { PH.draft.cheese = Number(b.dataset.cheese); changed('select'); redraw(); };
    for (const b of el.querySelectorAll('[data-top]')) b.onclick = () => { PH.sel = b.dataset.top; ctx.haptic('tap'); redraw(); };
    el.querySelector('#pz-all').onclick = () => { const k = PH.sel; if ((PH.draft.top[k] || 0) === 255) delete PH.draft.top[k]; else PH.draft.top[k] = 255; changed('select'); redraw(); };
    el.querySelector('#pz-clear').onclick = () => { PH.draft.top = {}; changed('warn'); redraw(); };
    el.querySelector('#pz-serve').onclick = async () => {
      clearTimeout(PH.sendT);
      const r = await ctx.act({ op: 'serve', round: PH.round, pizza: PH.draft });
      if (r && r.ok) { ctx.haptic('success'); ctx.sfx && ctx.sfx('chime'); }
    };
    // Painting: press on a slice to add (or remove) the topping, then swipe across more slices.
    const box = el.querySelector('#pz-pie');
    const apply = (sl) => {
      if (sl < 0 || !PH.paint || PH.paint.done.has(sl)) return;
      PH.paint.done.add(sl);
      const k = PH.sel, m = PH.draft.top[k] || 0, bit = 1 << sl, nm = PH.paint.add ? m | bit : m & ~bit;
      if (nm === m) return;
      if (nm) PH.draft.top[k] = nm; else delete PH.draft.top[k];
      changed('tap');
    };
    box.onpointerdown = (e) => {
      const sl = sliceAt(box, e.clientX, e.clientY); if (sl < 0) return;
      e.preventDefault(); try { box.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
      PH.paint = { add: !((PH.draft.top[PH.sel] || 0) & (1 << sl)), done: new Set() }; apply(sl);
    };
    box.onpointermove = (e) => { if (PH.paint) apply(sliceAt(box, e.clientX, e.clientY)); };
    box.onpointerup = box.onpointercancel = () => { if (PH.paint) { PH.paint = null; redraw(); } };
    drawPie(el);
  }
  function phone(el, v, ctx, local) {
    if (!v) return;
    const key = v.phase + ':' + v.round;
    if (!local) PH.endAt = v.endsIn ? Date.now() + v.endsIn : 0;
    if (!local && key !== PH.lastPhase) {
      PH.lastPhase = key;
      if (v.phase === 'order') ctx.haptic(v.c && v.c.isChef ? 'big' : 'turn');
      if (v.phase === 'build' && !(v.c && v.c.isChef)) ctx.haptic('turn');
      if (v.phase === 'reveal' && v.c && v.c.mine) ctx.haptic(v.c.mine.best ? 'win' : v.c.mine.score >= 60 ? 'success' : 'error');
      if (v.phase === 'over') ctx.haptic(v.rank === 1 ? 'win' : 'success');
    }
    if (v.phase === 'over') {
      const F = v.final || {}, mine = (F.awards || []).filter((a) => a.id === v.me);
      return BOX.morph(el, `<div class="pz-ph pz-card pz-end"><div class="pz-stamp">CLOSING TIME</div><h2>${v.rank === 1 ? '🏆 Best cook in town!' : `#${v.rank} of ${v.ranked}`}</h2><p class="pz-big-n">💰 ${v.points} in tips</p>
        ${mine.map((a) => `<div class="pz-aw">${esc(a.icon)} <b>${esc(a.title)}</b> <small>${esc(a.text)}</small></div>`).join('')}<p class="muted">Grazie from Nonna Pina!</p></div>`);
    }
    const c = v.c || {};
    if (c.isChef && (v.phase === 'order' || v.phase === 'build')) {
      const t = c.ticket || {};
      return BOX.morph(el, `<div class="pz-ph">${barHtml(v)}<div class="pz-card pz-ticket"><div class="pz-tk-h">👩‍🍳 You’re the HEAD CHEF</div>
        <p class="pz-tk-say">Describe this pizza out loud. <b>Don’t show your screen!</b></p>${pizzaSvg(t, { size: 250 })}
        <p class="pz-tk-words">${esc(t.words || '')}</p>${v.phase === 'build' ? `<p class="muted">The cooks are building… you earn their average match.</p>` : `<p class="muted">The kitchen starts in a moment.</p>`}</div></div>`);
    }
    if (v.phase === 'order') {
      const msg = c.mode === 'phone' ? '☎️ Listen! The customer is reading the order.' : c.mode === 'chef' ? `👂 Listen to the head chef, ${esc(c.chef ? c.chef.name : '')}!` : '👀 Look at the TV and remember the pizza!';
      return BOX.morph(el, `<div class="pz-ph">${barHtml(v)}<div class="pz-card pz-look"><div class="pz-look-i">${c.mode === 'phone' ? '☎️' : c.mode === 'chef' ? '👂' : '👀'}</div><h2>${msg}</h2><p>${esc(c.customer ? c.customer.name : '')} ${esc(c.customer ? c.customer.job : '')} is ordering.</p>${c.speed ? '<p class="pz-rushnote">⏱️ Lunch rush: serve fast for a speed tip!</p>' : ''}</div></div>`);
    }
    if (v.phase === 'build') {
      if (PH.round !== v.round) { PH.round = v.round; PH.draft = c.draft ? copy(c.draft) : blank(); PH.sel = 'pepperoni'; }
      if (c.served) {
        return BOX.morph(el, `<div class="pz-ph">${barHtml(v)}<div class="pz-card pz-served"><h2>🛎️ Served!</h2>${pizzaSvg(PH.draft, { size: 240 })}<p>Waiting for ${v.c.waiting} more cook${v.c.waiting === 1 ? '' : 's'}…</p></div></div>`);
      }
      if (!local && el.querySelector('#pz-pie') && PH.paint) return; // mid-swipe: don't touch the screen
      BOX.morph(el, builderHtml(v));
      bindBuilder(el, v, ctx);
      return;
    }
    if (v.phase === 'reveal') {
      const o = c.order, me = c.mine;
      if (c.chefRow) return BOX.morph(el, `<div class="pz-ph">${barHtml(v)}<div class="pz-card pz-rev"><h2>👩‍🍳 Your cooks matched ${c.chefRow.avg}%</h2><p class="pz-gain">+${c.chefRow.gain}</p>${pizzaSvg(o, { size: 200 })}</div></div>`);
      return BOX.morph(el, `<div class="pz-ph">${barHtml(v)}<div class="pz-card pz-rev">
        <div class="pz-vs"><figure>${pizzaSvg(o, { size: 150 })}<figcaption>The order</figcaption></figure><figure>${pizzaSvg(me && me.pizza, { size: 150 })}<figcaption>Yours</figcaption></figure></div>
        ${me ? `<div class="pz-score"><span class="pz-face">${face(me.score)}</span><b>${me.score}%</b><small>match</small></div><p class="pz-gain">+${me.gain} tips${me.speed ? ` <small>(⏱️ +${me.speed} speed)</small>` : ''}${me.best ? ' <small>🏅 best pizza!</small>' : ''}</p><p class="muted">#${me.place} of ${me.of} this order</p>` : '<p>You sat this one out.</p>'}
        <p class="pz-words">${esc(o ? o.words : '')}</p></div></div>`);
    }
    BOX.morph(el, `<div class="pz-ph"><div class="pz-card"><h2>🍕 Get ready…</h2></div></div>`);
  }

  // ---------------- TV ----------------
  const TV = { said: null, cv: null, raf: 0, host: null, anim: null, sayUntil: 0, custSaid: null };
  function nonnaSpec() { const I = BOX.intros && BOX.intros.pizza; return I && I.host ? I.host : null; }
  function speak(text, spec, key, talk) {
    try { if (BOX.voice && BOX.voice.speak) BOX.voice.speak(text, spec || {}); } catch (e) { /* no voice */ }
    if (talk) { const ms = Math.max(1500, text.length * 62); TV.sayUntil = Date.now() + ms; if (TV.anim) TV.anim.talk(performance.now(), ms); }
  }
  // Nonna herself, drawn with the intro's character, in the kitchen doorway.
  function nonnaLoop() {
    TV.raf = requestAnimationFrame(nonnaLoop);
    const cv = TV.cv; if (!cv || !cv.isConnected) return;
    const H = nonnaSpec(); if (!H || !BOX.studio) return;
    if (!TV.host) { try { TV.host = H.draw ? H.draw.bind(H) : BOX.studio.makeHost(H.look || {}); TV.anim = new BOX.studio.HostAnim(H); } catch (e) { return; } }
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(r.width * dpr) || cv.height !== Math.round(r.height * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
    const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    const sc = cv.height / 470; g.translate(cv.width / 2, cv.height * 1.02); g.scale(sc, sc);
    if (Date.now() < TV.sayUntil && TV.anim.talkUntil < performance.now()) TV.anim.talk(performance.now(), TV.sayUntil - Date.now());
    try { TV.host(g, TV.anim.frame(performance.now())); } catch (e) { /* drawing */ }
  }
  function mountNonna(el) {
    const box = el.querySelector('#pz-nonna'); if (!box) return;
    if (!box.querySelector('canvas')) box.innerHTML = '<canvas></canvas>';
    TV.cv = box.querySelector('canvas');
    if (BOX.studio && BOX.studio.need) BOX.studio.need('pizza', () => {});
    if (!TV.raf) TV.raf = requestAnimationFrame(nonnaLoop);
  }
  const CUST_VOICE = { like: /male|guy|david|mark|george|ryan|zira|aria|jenny/i, accent: /en-US|en-GB/i, pitch: 1.15, rate: 1.0 };
  function scene(inner, s, extraCls = '') {
    const N = s.nonna;
    return `<div class="pz-tv ${extraCls}"><div class="pz-wall"></div><div class="pz-neon">Just<b>Pizza</b></div><div class="pz-oven"><i></i></div>
      <div class="pz-board"><small>ORDER</small><b>${s.round}<span>/${s.of}</span></b>${s.c ? `<em>${esc(s.c.modeIcon)} ${esc(s.c.modeName)}</em>` : ''}</div>
      ${inner}
      <div class="pz-counter"></div>
      <div class="pz-nonnabox"><div class="pz-nonna" id="pz-nonna" data-keep></div></div>${N ? `<div class="pz-nb" id="pz-nb-${N.key}"><b>Nonna Pina</b><p>${esc(N.text)}</p></div>` : ''}</div>`;
  }
  function tvOrder(el, s) {
    const c = s.c, cu = c.customer, walking = c.showIn > 0;
    const greet = c.mode === 'phone' ? '☎️ Ring ring! Hello, Nonna? I’d like to order…' : c.mode === 'chef' ? `I gave my ticket to the head chef, ${esc(c.chef ? c.chef.name : '')}. Listen to them!` : 'Hi! I’d like exactly this one, please!';
    const show = c.order ? `<div class="pz-plate in" id="pz-pl-${c.id}"><div class="pz-memo">Remember it!</div>${pizzaSvg(c.order, { size: 430 })}<div class="pz-peek"><i style="animation-duration:${c.peek}ms"></i></div></div>`
      : c.words ? `<div class="pz-phonecard"><div class="pz-ring">☎️</div><p>“${esc(c.words)}”</p><div class="pz-peek"><i style="animation-duration:${c.peek}ms"></i></div></div>`
        : c.mode === 'chef' ? `<div class="pz-phonecard pz-chefcard"><div class="pz-ring">👩‍🍳</div><p>${av(c.chef)} <b>${esc(c.chef ? c.chef.name : '')}</b> has the ticket.<br>Head chef, read it out loud!</p></div>` : '';
    BOX.morph(el, scene(`<div class="pz-cust-wrap arrive" id="pz-cu-${c.id}">${customerSvg(cu, walking ? 'wait' : 'say', 300)}</div><div class="pz-tag"><b>${esc(cu.name)}</b><small>${esc(cu.job)}</small></div>
      ${walking ? '' : `<div class="pz-bubble" id="pz-bu-${c.id}">${greet}</div>`}${show}`, s, 'ph-order'));
    mountNonna(el);
    if (c.words && TV.custSaid !== c.id + ':w') { TV.custSaid = c.id + ':w'; speak(c.words, CUST_VOICE, null, false); }
  }
  function cooksHtml(c) {
    return `<div class="pz-cooks">${(c.cooks || []).map((k) => `<span class="pz-cook ${k.served ? 'done' : ''}">${av(k)} ${esc(k.name)} ${k.served ? '🛎️' : '<i class="pz-dots"><b></b><b></b><b></b></i>'}</span>`).join('')}</div>`;
  }
  function tvBuild(el, s) {
    const c = s.c, cu = c.customer;
    const center = c.words ? `<div class="pz-phonecard"><div class="pz-ring">📜</div><p>The head chef stepped out, so here’s the ticket: “${esc(c.words)}”</p></div>`
      : `<div class="pz-box"><div class="pz-box-lid">?</div><div class="pz-box-txt">${c.mode === 'chef' ? `👩‍🍳 ${esc(c.chef ? c.chef.name : '')} is describing it` : 'The order is a secret now. Cook from memory!'}</div></div>`;
    BOX.morph(el, scene(`<div class="pz-cust-wrap wait" id="pz-cu-${c.id}">${customerSvg(cu, 'think', 300)}</div><div class="pz-tag"><b>${esc(cu.name)}</b><small>is waiting…</small></div>
      <div class="pz-clock ${s.endsIn < 10000 ? 'low' : ''}">${timer(s.endsIn)}</div>${center}
      <div class="pz-status"><h3>🍕 Cooking! <small>${c.served} of ${c.of} served</small></h3>${cooksHtml(c)}</div>`, s, 'ph-build'));
    mountNonna(el);
  }
  function tvReveal(el, s) {
    const c = s.c, cu = c.customer, m = MOOD[c.mood] || MOOD.ok, rows = c.rows || [], top = rows[0];
    const reaction = !top ? 'Nobody made me anything?!' : c.mood === 'great' ? `${m[1]} ${esc(top.name)} nailed it!` : c.mood === 'ok' ? `${m[1]} ${esc(top.name)} came closest.` : `${m[1]} The best was ${esc(top.name)}’s…`;
    const n = rows.length + (c.more ? 1 : 0), sz = n <= 2 ? 250 : n <= 4 ? 190 : n <= 6 ? 160 : n <= 8 ? 140 : 112;
    BOX.morph(el, scene(`<div class="pz-cust-wrap react" id="pz-cu-${c.id}">${customerSvg(cu, c.mood || 'ok', 250)}</div><div class="pz-bubble rv" id="pz-bu-${c.id}-r">${m[0]} ${reaction}</div>
      <div class="pz-reveal" id="pz-rv-${c.id}"><figure class="pz-orderfig"><figcaption>THE ORDER</figcaption>${pizzaSvg(c.order, { size: 300 })}<p>${esc(c.words || '')}</p></figure>
        <div class="pz-grid" style="--sz:${sz}px">${rows.map((r, i) => `<figure class="pz-entry ${r.best ? 'best' : ''}" style="animation-delay:${i * 120}ms">${r.best ? '<div class="pz-crown">🏅</div>' : ''}${pizzaSvg(r.pizza, { size: sz })}
          <figcaption><span>${av(r)} ${esc(r.name)}</span><b>${face(r.score)} ${r.score}%</b><small>+${r.gain}${r.speed ? ' ⏱️' : ''}</small></figcaption></figure>`).join('')}
          ${c.more ? `<div class="pz-more">+${c.more} more cooks</div>` : ''}</div></div>
      ${c.chefRow ? `<div class="pz-chefrow">👩‍🍳 Head chef ${av(c.chefRow)} <b>${esc(c.chefRow.name)}</b>: the cooks averaged ${c.chefRow.avg}% · +${c.chefRow.gain}</div>` : ''}`, s, 'ph-reveal'));
    mountNonna(el);
  }
  function tvOver(el, s) {
    const F = s.final || {}, st = F.standings || s.standings || [], pod = st.slice(0, 3);
    const order = [1, 0, 2].filter((i) => pod[i]);
    BOX.morph(el, scene(`<div class="pz-over"><h1>🏆 ${av(st[0])} ${esc((st[0] || {}).name || '')} is the best cook in town!</h1>
      <div class="pz-podium">${order.map((i) => `<div class="pz-pod p${i + 1}"><div class="pz-pav">${av(pod[i])}</div><b>${esc(pod[i].name)}</b><span>💰 ${pod[i].points}</span><div class="pz-step">${i + 1}</div></div>`).join('')}</div>
      <div class="pz-awards">${(F.awards || []).map((a) => `<div class="pz-award"><i>${esc(a.icon)}</i><b>${esc(a.title)}</b><span>${av(a)} ${esc(a.name)}</span><small>${esc(a.text)}</small></div>`).join('')}</div>
      <div class="pz-rest">${st.slice(3, 12).map((r, i) => `<span>${i + 4}. ${av(r)} ${esc(r.name)} <b>${r.points}</b></span>`).join('')}</div></div>`, { ...s, c: null }, 'ph-over'));
    mountNonna(el);
  }

  function lobbyTv(el, L) {
    if (!el.querySelector('.pz-lobby')) {
      el.innerHTML = `<div class="pz-lobby"><div class="pz-wall"></div>
        <div class="pz-l-head"><div class="pz-neon big">Just<b>Pizza</b></div><p>Nonna Pina’s pizzeria is hiring! A customer shows their pizza, you rebuild it from memory.</p></div>
        <div class="pz-l-main">
          <div class="pz-l-board"><h2>Tonight’s kitchen</h2><div class="pz-l-set" id="settings"></div><div class="pz-l-err" id="lobby-err"></div>
            <button class="pz-l-start" id="start">🍕 Open the kitchen</button><div class="pz-l-links"><button class="link" id="add-bots">+ 5 test bots</button> <button class="link" id="pick">🎮 Another game</button></div></div>
          <div class="pz-l-box"><div class="pz-l-boxlid">Scan to cook!</div><img id="qr" alt="QR code to join"><div class="pz-l-cl">Room code</div><div class="pz-l-code" id="code"></div></div>
        </div>
        <div class="pz-l-rail"><div class="pz-l-bar"></div><div class="pz-l-roster" id="roster"></div></div></div>`;
      el.querySelector('#start').onclick = async () => { const r = await L.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      el.querySelector('#add-bots').onclick = () => L.bots(5);
      el.querySelector('#pick').onclick = () => L.pick();
    }
    el.querySelector('#code').textContent = L.code;
    const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
    const set = el.querySelector('#settings'), sig = JSON.stringify(L.settings);
    if (set.dataset.sig !== sig && !set.contains(document.activeElement)) {
      set.dataset.sig = sig;
      set.innerHTML = L.fields.map((f) => `<label class="pz-l-f"><span>${esc(f.label)}</span><select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
      for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => L.set(s.dataset.set, s.value);
    }
    BOX.morph(el.querySelector('#roster'), L.players.map((p, i) => `<span class="chip pz-l-ticket" style="--r:${((i * 37) % 9) - 4}deg"><small>#${101 + i}</small>${av(p)} ${esc(p.name)}</span>`).join('') || '<span class="pz-l-empty">Scan the code to put on an apron. 3–10 cooks is perfect.</span>');
  }

  BOX.games.pizza = {
    name: 'JustPizza', icon: '🍕',
    about: 'A customer shows the pizza they want for a few seconds. Rebuild it from memory on your phone: closest pizza wins the tip.',
    how: [
      'A customer comes to Nonna Pina’s counter and shows the pizza they want, for just a few seconds. Remember it!',
      'Then it’s hidden. On your phone, rebuild it: crust, sauce, cheese.',
      'Pick a topping and tap or swipe across the slices. Halves and quarters matter (which half doesn’t).',
      'Tap 🛎️ Serve when it’s ready; when the clock runs out, whatever you made goes out.',
      'Modes: Lunch Rush (speed tips), Half & Half, Phone Order (just listen), Flash Order (two seconds!), Head Chef (one player reads the ticket out loud), or Mixed.',
      'The closer the match, the bigger the tip; the best pizza each order earns a bonus. Most tips wins.',
    ],
    fx: { start: 'start', order: 'join', shown: 'pop', build: 'whoosh', serve: 'chime', reveal: 'reveal', win: 'win' },
    music: (s) => (s.phase === 'order' ? 'play' : s.phase === 'build' ? 'think' : s.phase === 'reveal' ? 'reveal' : s.phase === 'over' ? 'finale' : undefined),
    lobbyTv,
    pizzaSvg, customerSvg, // shared drawings (the title screen and tests use them)
    tv(el, s) {
      if (!s) return;
      if (BOX.voice && BOX.voice.preload && !TV.pre) { TV.pre = true; try { BOX.voice.preload('pizza'); } catch (e) { /* no */ } }
      // Nonna's lines (not over the customer reading a phone order)
      if (s.nonna && TV.said !== s.nonna.key) { TV.said = s.nonna.key; const quiet = s.phase === 'order' && s.c && s.c.mode === 'phone'; if (!quiet) speak(s.nonna.text, (nonnaSpec() || {}).voice, s.nonna.key, true); }
      if (s.phase === 'over') return tvOver(el, s);
      if (!s.c) return BOX.morph(el, scene('', s));
      if (s.phase === 'order') return tvOrder(el, s);
      if (s.phase === 'build') return tvBuild(el, s);
      if (s.phase === 'reveal') return tvReveal(el, s);
    },
    phone,
  };
})();
