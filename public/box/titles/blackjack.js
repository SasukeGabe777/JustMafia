'use strict';
// Blackjack Night title screen: a late-night card lounge. Marquee bulbs chase along the
// top, neon signs glow on the wall, the dealer's shoe deals hand after hand (blackjack,
// bust, a solid 19) on the green felt, and chips get tossed onto the betting spot.
(function () {
  const TAU = Math.PI * 2;
  const LOOP = 7;
  const HANDS = [
    { cards: [['A', '♠', 0], ['K', '♥', 1]], say: 'BLACKJACK!', col: '#ffd166', ink: '#3a2300' },
    { cards: [['9', '♦', 1], ['7', '♣', 0], ['8', '♥', 1]], say: 'BUST!', col: '#e8323c', ink: '#fff2e6' },
    { cards: [['10', '♠', 0], ['9', '♥', 1]], say: '19 · STAND', col: '#3ee0a8', ink: '#032a1c' },
  ];
  const CHIPS = [['#e8323c', '#8e1420'], ['#2f6bff', '#163a99'], ['#1d1d22', '#000000'], ['#2fbf71', '#16703f']];

  function layer(W, H) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr));
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [c, x];
  }
  function card(g, cx, cy, w, sx, rank, suit, red, back) {
    // sx is the horizontal squash for the flip (1 = flat on the table).
    const h = w * 1.4;
    g.save(); g.translate(cx, cy); g.scale(Math.max(0.02, sx), 1);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.roundRect(-w / 2 + w * 0.05, -h / 2 + w * 0.08, w, h, w * 0.1); g.fill();
    if (back) { g.drawImage(back, -w / 2, -h / 2, w, h); g.restore(); return; }
    g.fillStyle = '#fffdf5'; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, w * 0.1); g.fill();
    g.strokeStyle = '#c9c2ae'; g.lineWidth = Math.max(1, w * 0.02); g.stroke();
    g.fillStyle = red ? '#cc1530' : '#14141c'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < 2; k++) {
      g.font = `bold ${w * (rank.length > 1 ? 0.21 : 0.26)}px Georgia, serif`; g.fillText(rank, -w * 0.32, -h * 0.36);
      g.font = `${w * 0.2}px Georgia, serif`; g.fillText(suit, -w * 0.32, -h * 0.2);
      g.rotate(Math.PI);
    }
    g.font = `${w * ('AJQK'.includes(rank) ? 0.66 : 0.52)}px Georgia, serif`; g.fillText(suit, 0, h * 0.03);
    if ('JQK'.includes(rank)) { g.font = `bold ${w * 0.2}px Georgia, serif`; g.fillStyle = '#d4a73c'; g.fillText(rank, 0, h * 0.3); }
    g.restore();
  }
  function chip(g, x, y, r, c, dash) {
    const ry = r * 0.42, hh = r * 0.2;
    g.fillStyle = c[1]; g.beginPath(); g.ellipse(x, y + hh, r, ry, 0, 0, TAU); g.fill(); g.fillRect(x - r, y, r * 2, hh);
    g.fillStyle = 'rgba(255,255,255,.85)'; for (const j of [-0.75, -0.25, 0.25, 0.75]) g.fillRect(x + r * j - r * 0.07, y + hh * 0.15, r * 0.14, hh * 0.9);
    g.fillStyle = c[0]; g.beginPath(); g.ellipse(x, y, r, ry, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = r * 0.12; g.setLineDash(dash);
    g.beginPath(); g.ellipse(x, y, r * 0.8, ry * 0.8, 0, 0, TAU); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(x, y, r * 0.45, ry * 0.45, 0, 0, TAU); g.fill();
  }

  BOX.titles.blackjack = {
    logo: '<span class="a">Blackjack</span><span class="b">Night</span>',
    tagline: 'The whole room against one dealer. Bet, hit, stand, and bet on your friends going bust.',
    start: '🃏 Open the table',
    meta: '1–100 players · 10–25 min',
    font: "'Righteous', sans-serif",
    theme: { card: 'rgba(8, 30, 22, 0.88)', ink: '#fdf6e3', muted: '#c4e6d2', accent: '#ffd166', button: '#e8323c', buttonInk: '#fff6e8', border: '#d4a73c' },
    css: `.bt-blackjack .bt-logo .a { display: block; color: #ffd166; letter-spacing: 0.03em; text-shadow: 0 5px 0 #6b3b00, 0 0 26px rgba(255, 209, 102, 0.35); }
      .bt-blackjack .bt-logo .b { display: inline-block; font-family: 'Pacifico', cursive; font-size: 0.78em; color: #ffe3f0; margin: -0.12em 0 0.12em; transform: rotate(-5deg); text-shadow: 0 0 6px #ff5fa2, 0 0 18px #ff2f7d, 0 0 38px rgba(255, 47, 125, 0.7); }
      .bt-blackjack .bt-card { box-shadow: inset 0 0 0 3px rgba(212, 167, 60, 0.35), 0 0 0 3px #3a1d0c, 0 18px 0 rgba(0,0,0,.3), 0 30px 70px rgba(0,0,0,.6); }
      .bt-blackjack .bt-go { box-shadow: 0 7px 0 #7a0f18; }`,
    init(W, H) {
      const sideW = Math.max(150, (W - Math.min(640, W * 0.92)) / 2), k = Math.min(H / 900, sideW / 480);
      const lx = sideW * 0.5, rx = W - sideW * 0.5;
      const [bg, b] = layer(W, H);
      // Lounge wall with art-deco fans and gold pinstripes.
      const wg = b.createLinearGradient(0, 0, 0, H * 0.6); wg.addColorStop(0, '#0d0820'); wg.addColorStop(1, '#241033'); b.fillStyle = wg; b.fillRect(0, 0, W, H);
      b.strokeStyle = 'rgba(212, 167, 60, 0.08)'; b.lineWidth = 2;
      for (let x = 0; x < W; x += 44 * k + 10) { b.beginPath(); b.moveTo(x, 0); b.lineTo(x, H * 0.6); b.stroke(); }
      for (const fx of [lx, rx]) {
        b.strokeStyle = 'rgba(212, 167, 60, 0.22)'; b.lineWidth = 2 * k + 1;
        for (let r = 1; r <= 4; r++) { b.beginPath(); b.arc(fx, H * 0.56, r * 60 * k + 20, Math.PI, TAU); b.stroke(); }
        for (let i = 1; i < 10; i++) { const a = Math.PI + (i / 10) * Math.PI; b.beginPath(); b.moveTo(fx + Math.cos(a) * 80 * k, H * 0.56 + Math.sin(a) * 80 * k); b.lineTo(fx + Math.cos(a) * (260 * k + 20), H * 0.56 + Math.sin(a) * (260 * k + 20)); b.stroke(); }
      }
      // The table: leather rail, then felt.
      const ex = W / 2, ey = H * 1.34, erx = W * 0.8, ery = H * 0.79, rail = 30 * k + 8;
      const rg = b.createLinearGradient(0, ey - ery - rail, 0, ey - ery + rail); rg.addColorStop(0, '#6b3519'); rg.addColorStop(0.5, '#3b1a0b'); rg.addColorStop(1, '#1e0c04');
      b.fillStyle = rg; b.beginPath(); b.ellipse(ex, ey, erx + rail, ery + rail, 0, 0, TAU); b.fill();
      b.strokeStyle = 'rgba(255, 200, 140, 0.25)'; b.lineWidth = 2; b.beginPath(); b.ellipse(ex, ey, erx + rail * 0.8, ery + rail * 0.8, 0, Math.PI, TAU); b.stroke();
      const fg = b.createRadialGradient(ex, H * 0.85, 0, ex, H * 0.85, W * 0.6); fg.addColorStop(0, '#16935b'); fg.addColorStop(0.6, '#0b6440'); fg.addColorStop(1, '#063a25');
      b.fillStyle = fg; b.beginPath(); b.ellipse(ex, ey, erx, ery, 0, 0, TAU); b.fill();
      b.strokeStyle = 'rgba(255, 224, 150, 0.4)'; b.lineWidth = 2 * k + 1;
      for (const f of [0.86, 0.79]) { b.beginPath(); b.ellipse(ex, ey, erx * f, ery * f, 0, Math.PI, TAU); b.stroke(); }
      // Lamp light pooling on the felt at each side.
      for (const px of [lx, rx]) {
        const lg = b.createRadialGradient(px, H * 0.8, 0, px, H * 0.8, sideW * 0.7); lg.addColorStop(0, 'rgba(255, 240, 190, 0.2)'); lg.addColorStop(1, 'rgba(255, 240, 190, 0)');
        b.fillStyle = lg; b.fillRect(px - sideW, H * 0.4, sideW * 2, H * 0.6);
      }
      // Betting spots.
      b.strokeStyle = 'rgba(255, 255, 255, 0.55)'; b.lineWidth = 3 * k + 1;
      const spot = { x: lx + sideW * 0.12, y: H * 0.83 };
      b.beginPath(); b.ellipse(spot.x, spot.y, 62 * k + 8, 26 * k + 4, 0, 0, TAU); b.stroke();
      b.beginPath(); b.roundRect(rx - sideW * 0.22 - 60 * k, H * 0.86 - 70 * k, 180 * k + 20, 140 * k, 16 * k); b.stroke();
      // Card back sprite.
      const cbw = 100, cbh = 140, [back, cb] = layer(cbw, cbh);
      cb.fillStyle = '#fffdf5'; cb.beginPath(); cb.roundRect(0, 0, cbw, cbh, 10); cb.fill();
      cb.fillStyle = '#b3122e'; cb.beginPath(); cb.roundRect(7, 7, cbw - 14, cbh - 14, 6); cb.fill();
      cb.save(); cb.beginPath(); cb.rect(7, 7, cbw - 14, cbh - 14); cb.clip(); cb.strokeStyle = 'rgba(255, 220, 160, 0.55)'; cb.lineWidth = 2;
      for (let i = -cbh; i < cbw + cbh; i += 12) { cb.beginPath(); cb.moveTo(i, 0); cb.lineTo(i + cbh, cbh); cb.moveTo(i, cbh); cb.lineTo(i + cbh, 0); cb.stroke(); }
      cb.restore(); cb.fillStyle = '#ffd166'; cb.font = '34px Georgia, serif'; cb.textAlign = 'center'; cb.textBaseline = 'middle'; cb.fillText('♠', cbw / 2, cbh / 2 + 2);
      // Bokeh sprites.
      const bokeh = ['255, 209, 102', '255, 95, 162', '90, 220, 255'].map((c) => {
        const [s, x] = layer(64, 64); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, `rgba(${c}, 0.55)`); gr.addColorStop(0.6, `rgba(${c}, 0.25)`); gr.addColorStop(1, `rgba(${c}, 0)`); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return s;
      });
      const rnd = (a, z) => a + Math.random() * (z - a);
      const cr = 26 * k + 6;
      return {
        bg, back, bokeh, sideW, k, lx, rx, spot, cr, dash: [cr * 0.28, cr * 0.22],
        bulbs: Math.max(12, Math.round(W / (38 * k + 12))),
        dots: Array.from({ length: 18 }, (_, i) => ({ x: rnd(0, W), y: rnd(0, H * 0.55), r: rnd(18, 60) * k + 8, v: rnd(4, 12) * k, ph: rnd(0, TAU), s: i % 3 })),
        stacks: [[lx - sideW * 0.26, H * 0.87, 7, 0], [lx - sideW * 0.08, H * 0.92, 5, 1], [lx - sideW * 0.4, H * 0.93, 4, 2]],
      };
    },
    draw(g, W, H, t, S) {
      const { k, lx, rx, sideW, cr } = S;
      g.drawImage(S.bg, 0, 0, W, H);
      // Drifting bokeh lights in the lounge.
      for (const d of S.dots) {
        const x = ((d.x + t * d.v) % (W + 120)) - 60, y = d.y + Math.sin(t * 0.4 + d.ph) * 12 * k;
        g.globalAlpha = 0.55 + 0.35 * Math.sin(t * 0.7 + d.ph); g.drawImage(S.bokeh[d.s], x - d.r, y - d.r, d.r * 2, d.r * 2);
      }
      g.globalAlpha = 1;
      // Marquee bulbs chasing gently along the top.
      const n = S.bulbs, gap = W / n, by = 16 * k + 6, br = 6 * k + 2;
      g.fillStyle = '#2a1508'; g.fillRect(0, 0, W, by * 2);
      g.fillStyle = '#d4a73c'; g.fillRect(0, by * 2 - 3, W, 3);
      for (let i = 0; i < n; i++) {
        const x = gap * (i + 0.5), w = 0.5 + 0.5 * Math.sin(i * 0.9 - t * 2.6), lit = 0.3 + 0.7 * w * w;
        g.globalAlpha = 0.25 * lit; g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(x, by, br * 2.4, 0, TAU); g.fill();
        g.globalAlpha = 1; g.fillStyle = `rgba(255, ${200 + 50 * lit | 0}, ${120 + 100 * lit | 0}, ${0.45 + 0.55 * lit})`; g.beginPath(); g.arc(x, by, br, 0, TAU); g.fill();
      }
      // Neon signs on the wall: "21" on the left, an ace on the right. Gentle breathing glow.
      const glow = 0.8 + 0.2 * Math.sin(t * 1.3);
      g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `${118 * k + 20}px 'Monoton', cursive`; g.shadowColor = '#ffb238'; g.shadowBlur = 26 * k * glow;
      g.fillStyle = '#ffe2a0'; g.fillText('21', lx, H * 0.3);
      g.shadowBlur = 0; g.font = `${24 * k + 6}px 'Righteous', sans-serif`; g.fillStyle = 'rgba(255, 210, 140, 0.85)';
      g.fillText('♦  OPEN ALL NIGHT  ♦', lx, H * 0.3 + 92 * k + 10);
      g.translate(rx, H * 0.3); g.rotate(0.12 + Math.sin(t * 0.6) * 0.03);
      const nw = 110 * k + 18, nh = nw * 1.4;
      g.shadowColor = '#ff2f7d'; g.shadowBlur = 22 * k * glow; g.strokeStyle = '#ffd0e4'; g.lineWidth = 5 * k + 2;
      g.beginPath(); g.roundRect(-nw / 2, -nh / 2, nw, nh, nw * 0.12); g.stroke();
      g.fillStyle = '#ffd0e4'; g.font = `${nw * 0.6}px Georgia, serif`; g.fillText('♠', 0, nh * 0.05);
      g.font = `bold ${nw * 0.24}px Georgia, serif`; g.fillText('A', -nw * 0.3, -nh * 0.34);
      g.restore();
      // Chip stacks and a chip tossed onto the bet every couple of seconds.
      for (const [x, y, c, col] of S.stacks) for (let i = 0; i < c; i++) chip(g, x, y - i * cr * 0.22, cr, CHIPS[col], S.dash);
      const tc = t % 12, tosses = Math.min(5, Math.floor(tc / 2)), slide = tc > 11 ? (tc - 11) : 0;
      g.globalAlpha = 1 - slide;
      for (let i = 0; i < tosses; i++) chip(g, S.spot.x + slide * 80 * k, S.spot.y - i * cr * 0.22, cr, CHIPS[i % 4], S.dash);
      g.globalAlpha = 1;
      const tu = (tc % 2) / 0.7;
      if (tc < 10 && tu < 1) {
        const from = S.stacks[0], c = tosses % 4, e = tu;
        const x = from[0] + (S.spot.x - from[0]) * e, y = from[1] - 7 * cr * 0.22 + (S.spot.y - tosses * cr * 0.22 - from[1] + 7 * cr * 0.22) * e - Math.sin(e * Math.PI) * 90 * k;
        g.save(); g.translate(x, y); g.scale(1, 0.4 + 0.6 * Math.abs(Math.cos(e * 7))); chip(g, 0, 0, cr, CHIPS[c], S.dash); g.restore();
      }
      // The dealer's shoe and the dealt hand on the right.
      const shoeX = W - sideW * 0.17, shoeY = H * 0.68, cw = Math.min(84 * k + 6, sideW * 0.2);
      g.fillStyle = '#3a1308'; g.beginPath(); g.roundRect(shoeX - 46 * k - 6, shoeY - 30 * k - 4, 92 * k + 12, 60 * k + 8, 10 * k); g.fill();
      g.drawImage(S.back, shoeX - 40 * k - 4, shoeY - 40 * k - 6, 50 * k + 4, 70 * k + 6);
      g.fillStyle = '#5a2210'; g.beginPath(); g.roundRect(shoeX - 46 * k - 6, shoeY - 8 * k, 92 * k + 12, 38 * k + 4, 10 * k); g.fill();
      const round = Math.floor(t / LOOP), lt = t % LOOP, hand = HANDS[round % HANDS.length], m = hand.cards.length;
      const hx = rx - sideW * 0.22 + 30 * k, hy = H * 0.86;
      const away = lt > LOOP - 0.8 ? (lt - (LOOP - 0.8)) / 0.8 : 0;
      for (let i = 0; i < m; i++) {
        const s = 0.4 + i * 0.75, u = Math.min(1, Math.max(0, (lt - s) / 0.45));
        if (lt < s) break;
        const e = 1 - (1 - u) * (1 - u), tx = hx + (i - (m - 1) / 2) * cw * 0.62, ty = hy + (i - (m - 1) / 2) * 6 * k;
        const x = shoeX + (tx - shoeX) * e + away * 120 * k, y = shoeY + (ty - shoeY) * e - away * 40 * k;
        const fl = Math.min(1, Math.max(0, (lt - s - 0.35) / 0.3)), sx = Math.abs(Math.cos(fl * Math.PI));
        g.globalAlpha = 1 - away;
        card(g, x, y, cw, sx, hand.cards[i][0], hand.cards[i][1], hand.cards[i][2], fl < 0.5 ? S.back : null);
      }
      g.globalAlpha = 1;
      const shout = lt - (0.4 + m * 0.75 + 0.3);
      if (shout > 0 && away < 1) {
        const pop = Math.min(1, shout / 0.25), sc = pop < 1 ? 0.6 + 0.6 * pop - 0.2 * pop * pop : 1 + Math.sin(shout * 3) * 0.03;
        g.save(); g.globalAlpha = 1 - away; g.translate(hx, hy - cw * 1.25); g.scale(sc, sc); g.rotate(-0.06);
        g.font = `${30 * k + 8}px 'Righteous', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        const tw = g.measureText(hand.say).width + 34 * k + 10, th = 50 * k + 10;
        g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.roundRect(-tw / 2 + 4, -th / 2 + 6, tw, th, th / 2); g.fill();
        g.fillStyle = hand.col; g.beginPath(); g.roundRect(-tw / 2, -th / 2, tw, th, th / 2); g.fill();
        g.fillStyle = hand.ink; g.fillText(hand.say, 0, 2);
        g.restore();
      }
      // Printed felt lettering, curving under the card.
      const ac = W / 2, ay = H * 0.05, ar = H * 0.88;
      g.fillStyle = 'rgba(255, 228, 160, 0.75)'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `${24 * k + 6}px 'Righteous', sans-serif`;
      arc(g, '♠  BLACKJACK PAYS 3 TO 2  ♥', ac, ay, ar);
      g.font = `${16 * k + 5}px 'Righteous', sans-serif`; g.fillStyle = 'rgba(255, 228, 160, 0.5)';
      arc(g, 'DEALER MUST STAND ON 17', ac, ay, ar - 40 * k - 6);
    },
  };
  function arc(g, text, cx, cy, r) {
    const total = g.measureText(text).width, sp = 1.06;
    let a = Math.PI / 2 + (total * sp) / r / 2;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i], w = g.measureText(ch).width * sp, mid = a - w / r / 2;
      g.save(); g.translate(cx + Math.cos(mid) * r, cy + Math.sin(mid) * r); g.rotate(mid - Math.PI / 2); g.fillText(ch, 0, 0); g.restore();
      a -= w / r;
    }
  }
})();
