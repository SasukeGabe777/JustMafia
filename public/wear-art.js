'use strict';
// Game wearables for the JustGameBox character (MTArt.drawCharacter / drawSmooth in avatar.js):
// the hats, masks, held props, badges and capes from each game's shop gear
// (public/shared/gear.js: items with paint.shape). Load after /avatar.js.
//
// drawSmooth calls MTArt.WEAR[shape](k) for every item in its `wear` option, in the right layer:
//   back  : behind the body (capes, packs)            k.SW = shoulder half-width
//   chest : over the clothes (badges, ties, aprons)   k.top/k.waist/k.bot = torso y range
//   hand  : in the right hand, origin = the hand, the arm points down (+y), props go up (-y)
//   face  : over the face (masks, glasses)            k.e = eye x-offset, k.ey = eye line
//   head  : on the head instead of the look's hat     k.top = top of the head (-57), k.HY = head centre
// Every shape gets the drawSmooth toolkit (P, done, circ, ell, rr, poly, lin, rect, line, star, sh,
// OL, t, HY, R, fem, skin, hairC, color) and the item's paint colours a, b, c, d (variant), glow.
// Style: bold dark outlines and soft gradients, like the character.
(function (root) {
  const A = root.MTArt; if (!A) return;
  const TAU = Math.PI * 2;
  const rgba = (hex, al) => { const n = parseInt(String(hex).slice(1), 16); return isNaN(n) ? hex : `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${al})`; };
  const W = {};

  // ---------------- head ----------------
  W.cowboy = ({ g, P, done, lin, rect, circ, star, line, HY, top, a, b, c, d, sh, OL }) => {
    P(); g.moveTo(-22, HY - 11); g.quadraticCurveTo(-16, HY - 4.5, 0, HY - 5); g.quadraticCurveTo(16, HY - 4.5, 22, HY - 11); g.quadraticCurveTo(14, HY - 7.5, 0, HY - 8); g.quadraticCurveTo(-14, HY - 7.5, -22, HY - 11); done(lin(a, HY - 11, HY - 5));
    P(); g.moveTo(-9.5, HY - 8); g.quadraticCurveTo(-12, top - 11, -4, top - 10); g.quadraticCurveTo(0, top - 6, 4, top - 10); g.quadraticCurveTo(12, top - 11, 9.5, HY - 8); g.closePath(); done(lin(a, top - 11, HY - 8));
    rect(b, -9.8, HY - 12.6, 19.6, 3);
    if (d === 'snake') for (let i = 0; i < 5; i++) { P(); g.moveTo(-8 + i * 4, HY - 11.1); g.lineTo(-6.5 + i * 4, HY - 12.4); g.lineTo(-5 + i * 4, HY - 11.1); g.lineTo(-6.5 + i * 4, HY - 9.8); g.closePath(); done(c, null); }
    if (d === 'star') star(0, HY - 11.2, 2.8, c);
    if (d === 'rose') { circ(6, HY - 11.5, 2.4); done(c, OL, 0.7); circ(6, HY - 11.5, 1); done(sh(c, -0.3), null); }
    if (d === 'cactus') { for (const s of [-1, 1]) { P(); g.moveTo(s * 2, top - 6); g.quadraticCurveTo(s * 7, top - 7, s * 6, top - 12); done(null, sh(a, 0.3), 1.6); } circ(0, top - 9, 2.2); done(c, OL, 0.7); }
    line(rgba('#ffffff', 0.35), 1.1, [[-7, top - 6], [-5, top - 9]]);
  };
  W.visor = ({ g, P, done, rr, circ, HY, R, a, b, c }) => {
    P(); g.moveTo(-R - 1, HY - 9); g.lineTo(R + 1, HY - 9); g.lineTo(R + 4, HY - 4.5); g.quadraticCurveTo(0, HY - 1.5, -R - 4, HY - 4.5); g.closePath(); done(rgba(a, 0.82), undefined, 1.2);
    rr(-R - 1, HY - 11.5, (R + 1) * 2, 3, 1.2); done(b);
    if (c) { rr(5, HY - 19, 6, 8, 1); done('#f6f2e6', undefined, 0.7); circ(8, HY - 15, 1.1); done(c, null); }
  };
  W.crown = ({ g, poly, done, lin, circ, rr, line, star, HY, top, a, b, c, d, OL }) => {
    if (d === 'paper') { poly([[-11, HY - 7], [-12, top - 6], [-7, top - 1], [-3.5, top - 8], [0, top - 1], [3.5, top - 8], [7, top - 1], [12, top - 6], [11, HY - 7]]); done(lin(a, top - 8, HY - 7, 0.1, -0.05)); for (let i = 0; i < 3; i++) { circ(-6 + i * 6, HY - 10, 1); done(b, null); } return; }
    const tall = d === 'imperial' ? 4 : 0;
    poly([[-11, HY - 7], [-12, top - 7 - tall], [-6, top - 1 - tall], [0, top - 10 - tall], [6, top - 1 - tall], [12, top - 7 - tall], [11, HY - 7]]); done(lin(a, top - 10 - tall, HY - 7));
    rr(-11.5, HY - 10, 23, 3.4, 1.5); done(lin(a, HY - 10, HY - 6.6, 0.25, -0.1), OL, 1);
    circ(0, HY - 8.3, 1.8); done(b, OL, 0.6); circ(-7, HY - 8.3, 1.2); done(c, null); circ(7, HY - 8.3, 1.2); done(c, null);
    for (const x of [-12, 0, 12]) { circ(x, (x ? top - 7 : top - 10) - tall, 1.4); done(c, OL, 0.5); }
    if (d === 'imperial') { line(OL, 2.6, [[0, top - 14 - tall], [0, top - 20 - tall]]); line(a, 1.4, [[0, top - 14 - tall], [0, top - 20 - tall]]); line(a, 1.4, [[-2.2, top - 18 - tall], [2.2, top - 18 - tall]]); }
    if (d === 'bone') for (const s of [-1, 1]) { circ(s * 6, top - 2, 1.4); done('#1a1418', null); }
  };
  W.helm = ({ g, P, done, lin, rr, rect, line, circ, HY, R, top, a, b, c, d, OL, sh }) => {
    if (d === 'horned') for (const s of [-1, 1]) { P(); g.moveTo(s * 11, HY - 7); g.quadraticCurveTo(s * 22, HY - 9, s * 20, top - 10); g.quadraticCurveTo(s * 17, HY - 12, s * 9, HY - 11); g.closePath(); done(lin(b, top - 10, HY - 7)); }
    if (d === 'plume') { P(); g.moveTo(-1, top - 1); g.quadraticCurveTo(-4, top - 16, 12, top - 14); g.quadraticCurveTo(4, top - 10, 3, top); g.closePath(); done(lin(c, top - 16, top)); }
    P(); g.arc(0, HY - 3, R + 2, Math.PI, 0); g.closePath(); done(lin(a, top - 4, HY - 3));
    for (const s of [-1, 1]) { rr(s > 0 ? R - 2 : -R - 2.5, HY - 5, 4.5, 11, 2); done(lin(sh(a, -0.1), HY - 5, HY + 6)); }
    rect(sh(a, -0.25), -R - 2, HY - 6, (R + 2) * 2, 2.2);
    if (d !== 'horned') { rr(-1.4, HY - 6, 2.8, 9, 1); done(sh(a, -0.1), OL, 0.8); }
    for (const s of [-1, 1]) { circ(s * 8, HY - 8, 0.9); done(b, null); }
    line(rgba('#ffffff', 0.6), 1.2, [[-8, top + 1], [-3, top - 1]]);
  };
  W.bandana = ({ g, P, done, lin, circ, rect, HY, R, top, a, b, d, OL }) => {
    P(); g.arc(0, HY - 2, R + 1, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(0, HY - 7, -R - 1, HY - 3); done(lin(a, top - 2, HY - 4));
    g.save(); P(); g.arc(0, HY - 2, R + 1, Math.PI * 1.02, Math.PI * 1.98); g.quadraticCurveTo(0, HY - 7, -R - 1, HY - 3); g.clip();
    if (d === 'stripes') for (let i = -16; i < 18; i += 5) { P(); g.moveTo(i, HY); g.lineTo(i + 6, top - 4); g.lineTo(i + 8.5, top - 4); g.lineTo(i + 2.5, HY); g.closePath(); done(b, null); }
    else if (d === 'camo') for (const [x, y, r] of [[-7, -9, 3], [2, -12, 2.5], [7, -7, 2.8], [-2, -6, 2], [-9, -4, 1.8]]) { circ(x, HY + y, r); done(b, null); }
    else if (d !== 'plain') for (const [dx, dy] of [[-7, -9], [0, -11], [7, -9], [-3.5, -6], [3.5, -6], [-10, -5], [10, -5]]) { circ(dx, HY + dy, 0.9); done(b, null); }
    g.restore();
    P(); g.moveTo(R - 1, HY - 5); g.lineTo(R + 7, HY - 2); g.lineTo(R + 3, HY + 1.5); g.closePath(); done(a, OL, 1);
    P(); g.moveTo(R - 1, HY - 4); g.lineTo(R + 5, HY + 4); g.lineTo(R + 1, HY + 4); g.closePath(); done(a, OL, 1);
  };
  W.headphones = ({ g, P, done, lin, rr, HY, R, a, b, OL }) => {
    P(); g.arc(0, HY - 1, R + 3, Math.PI * 1.06, Math.PI * 1.94); g.strokeStyle = OL; g.lineWidth = 4.2; g.lineCap = 'round'; g.stroke(); g.strokeStyle = a; g.lineWidth = 2.4; g.stroke();
    for (const s of [-1, 1]) { rr(s > 0 ? R - 1 : -R - 5, HY - 6, 6, 12, 3); done(lin(a, HY - 6, HY + 6)); rr(s > 0 ? R - 1.5 : -R - 2.5, HY - 4, 4, 8, 2); done(b, null); }
  };
  W.deerstalker = ({ g, P, done, lin, ell, circ, line, HY, R, top, a, b, c, OL }) => {
    ell(-R + 1, HY - 6.5, 6.5, 2.4, 0.25); done(lin(a, HY - 9, HY - 4)); ell(R - 1, HY - 6.5, 6.5, 2.4, -0.25); done(lin(a, HY - 9, HY - 4));
    P(); g.arc(0, HY - 4, R + 1.5, Math.PI, 0); g.closePath(); done(lin(a, top - 2, HY - 4));
    g.save(); P(); g.arc(0, HY - 4, R + 1.5, Math.PI, 0); g.closePath(); g.clip(); g.globalAlpha *= 0.55;
    for (let i = -16; i < 16; i += 4) { g.fillStyle = b; g.fillRect(i, top - 4, 1.4, 16); g.fillRect(-16, top - 3 + (i + 16) / 2.2, 32, 1.2); }
    g.restore();
    P(); g.arc(0, HY - 4, R + 1.5, Math.PI, 0); g.closePath(); done(null);
    for (const s of [-1, 1]) { P(); g.moveTo(s * (R + 1), HY - 5); g.quadraticCurveTo(s * (R + 2.5), HY + 2, s * (R - 1), HY + 4); g.lineTo(s * (R - 2.5), HY - 4); g.closePath(); done(lin(a, HY - 5, HY + 4)); }
    line(c, 1.4, [[-3, top - 1], [0, top - 3], [3, top - 1]]); circ(0, top - 1.5, 1.2); done(c, OL, 0.5);
  };
  W.gradcap = ({ g, rr, poly, done, lin, circ, line, HY, top, a, c, OL }) => {
    rr(-10.5, HY - 13, 21, 7, 3); done(lin(a, HY - 13, HY - 6));
    poly([[-19, top - 3], [0, top - 8.5], [19, top - 3], [0, top + 2.5]]); done(lin(a, top - 8, top + 2, 0.25, -0.1));
    circ(0, top - 3, 1.3); done(c, OL, 0.6);
    line(OL, 2.2, [[0, top - 3], [13, top - 1], [14, top + 9]]); line(c, 1.1, [[0, top - 3], [13, top - 1], [14, top + 9]]);
    rr(12.4, top + 8, 3.2, 5, 1); done(c, OL, 0.6);
  };
  W.chef = ({ g, P, done, rr, lin, line, HY, top, a, b, d }) => {
    const h = d === 'tall' ? 9 : 0, puffs = [[-6.5, top - 7 - h, 5.8], [6.5, top - 7 - h, 5.8], [0, top - 10.5 - h, 7]];
    rr(-9.5, top - 6 - h, 19, 13 + h, 2.5); done(lin(a, top - 6 - h, top + 7, 0.05, -0.12));
    for (const [x, y, r] of puffs) { g.beginPath(); g.arc(x, y, r, 0, TAU); done(a); }
    for (const [x, y, r] of puffs) { g.beginPath(); g.arc(x, y, r - 1.2, 0, TAU); done(a, null); }
    g.beginPath(); g.rect(-8.3, top - 6 - h, 16.6, 12 + h); done(a, null);
    line(rgba('#000000', 0.12), 1, [[-3, top - 4 - h], [-3, top + 1]]); line(rgba('#000000', 0.12), 1, [[3, top - 4 - h], [3, top + 1]]);
    rr(-10, top + 1, 20, 6, 2); done(d === 'tall' ? b : a);
  };
  W.straw = ({ g, ell, rr, done, lin, rect, line, HY, top, a, b, d }) => {
    const wide = d === 'boater' ? 18 : 23;
    ell(0, HY - 8, wide, 4.6); done(lin(a, HY - 12, HY - 4));
    if (d === 'boater') { rr(-9.5, top - 3, 19, 10, 1.5); done(lin(a, top - 3, top + 7)); }
    else { P_dome(g, top); done(lin(a, top - 6, HY - 8)); }
    rect(b, -9.5, HY - 12.8, 19, 3.2);
    for (let i = -18; i <= 18; i += 4) line(rgba('#7a5a20', 0.35), 0.7, [[i, HY - 10], [i * 1.05, HY - 6]]);
  };
  function P_dome(g, top) { g.beginPath(); g.moveTo(-9.5, top + 6); g.quadraticCurveTo(-10.5, top - 5, 0, top - 5.5); g.quadraticCurveTo(10.5, top - 5, 9.5, top + 6); g.closePath(); }
  W.propeller = ({ g, P, done, lin, line, ell, circ, HY, R, top, t, a, b, c, OL }) => {
    P(); g.arc(0, HY - 3, R + 1.5, Math.PI, 0); g.closePath(); done(lin(a, top - 3, HY - 3));
    g.save(); P(); g.arc(0, HY - 3, R + 1.5, Math.PI, 0); g.closePath(); g.clip(); for (let i = -2; i <= 2; i += 2) { g.fillStyle = b; g.beginPath(); g.moveTo(i * 3.5 - 1.5, HY - 3); g.lineTo(0, top - 3); g.lineTo(i * 3.5 + 1.5, HY - 3); g.fill(); } g.restore();
    P(); g.arc(0, HY - 3, R + 1.5, Math.PI, 0); g.closePath(); done(null);
    line(OL, 1.6, [[0, top - 2], [0, top - 7]]);
    const w = 9 * Math.abs(Math.cos(t * 9));
    ell(-w / 2 - 0.5, top - 7.5, w / 2 + 0.5, 1.6); done(c, OL, 0.8); ell(w / 2 + 0.5, top - 7.5, w / 2 + 0.5, 1.6); done(b, OL, 0.8);
    circ(0, top - 7.5, 1.3); done('#ffd23f', OL, 0.6);
  };
  W.cap = ({ g, P, done, lin, ell, circ, rr, line, HY, R, top, a, b, c, d, sh, OL }) => {
    const back = d === 'back', dir = back ? -1 : 1;
    if (back) { ell(-12, HY - 5, 7, 2.2, 0.15); done(sh(a, -0.3)); }
    P(); g.arc(0, HY - 4, R + 1, Math.PI, 0); g.closePath(); done(lin(a, top - 2, HY - 4));
    if (!back) { ell(dir * 13, HY - 4, 9, 2.4); done(sh(a, -0.3)); }
    circ(0, top - 0.5, 1.5); done(b, OL, 0.6);
    if (c && !back) { rr(-4, HY - 13, 8, 5, 1.5); done(c, OL, 0.7); }
    if (back) { rr(-3, HY - 7, 6, 3, 1); done(b, OL, 0.6); }
    line(rgba('#ffffff', 0.35), 1, [[-6, top + 3], [-1, top + 1]]);
  };
  W.hardhat = ({ g, P, done, lin, ell, rr, circ, line, HY, R, top, t, a, b, c, d, sh, OL }) => {
    ell(0, HY - 6, R + 5, 2.8); done(lin(sh(a, -0.1), HY - 9, HY - 3));
    P(); g.arc(0, HY - 6, R + 1, Math.PI, 0); g.closePath(); done(lin(a, top - 4, HY - 6));
    rr(-2, top - 5, 4, 12, 1.5); done(sh(a, 0.15), OL, 0.8);
    if (b) { rr(-R, HY - 9.5, R * 2, 2.4, 1); done(b, null); }
    if (d === 'lamp') { const k = 0.25 + 0.15 * Math.sin(t * 3); g.save(); g.fillStyle = rgba(c, k); g.beginPath(); g.moveTo(3, top + 2); g.lineTo(24, top - 2); g.lineTo(24, top + 12); g.closePath(); g.fill(); g.restore(); circ(3, top + 3, 3); done(c, OL, 0.8); }
  };
  W.antennae = ({ g, P, done, line, circ, star, HY, R, top, t, a, b, d, OL }) => {
    P(); g.arc(0, HY - 1, R + 1.5, Math.PI * 1.08, Math.PI * 1.92); g.strokeStyle = OL; g.lineWidth = 3.4; g.stroke(); g.strokeStyle = b; g.lineWidth = 1.8; g.stroke();
    for (const s of [-1, 1]) {
      const wob = Math.sin(t * 4 + s) * 1.5, tx = s * 9 + wob, ty = top - 13;
      P(); g.moveTo(s * 6, top + 1); g.quadraticCurveTo(s * 8, top - 6, tx, ty); g.strokeStyle = OL; g.lineWidth = 2.4; g.stroke(); g.strokeStyle = b; g.lineWidth = 1; g.stroke();
      if (d === 'heart') { P(); g.moveTo(tx, ty + 3); g.bezierCurveTo(tx - 5, ty - 1, tx - 2.5, ty - 4.5, tx, ty - 2); g.bezierCurveTo(tx + 2.5, ty - 4.5, tx + 5, ty - 1, tx, ty + 3); done(a, OL, 0.8); }
      else if (d === 'star') star(tx, ty, 3.6, a);
      else { circ(tx, ty, 2.8); done(a, OL, 0.8); circ(tx - 0.8, ty - 0.9, 0.8); done('#fff', null); }
    }
  };
  W.bubble = ({ g, circ, done, line, rr, HY, R, a }) => {
    circ(0, HY - 1, R + 6); const gg = g.createRadialGradient(-6, HY - 8, 2, 0, HY - 1, R + 6); gg.addColorStop(0, 'rgba(255,255,255,0.4)'); gg.addColorStop(1, rgba(a, 0.18)); done(gg, a, 1.8);
    line('rgba(255,255,255,0.8)', 1.8, [[-12, HY - 6], [-8, HY - 13]]); rr(-R - 2, HY + 12, (R + 2) * 2, 4, 2); done('#e4e8f3');
  };
  W.tophat = ({ g, ell, rr, done, lin, rect, star, HY, top, t, a, b, c, d }) => {
    ell(0, HY - 8, 17, 3.2); done(lin(a, HY - 11, HY - 5));
    rr(-9, top - 16, 18, 20, 2.5); done(lin(a, top - 16, top + 4));
    rect(b, -9, top - 1, 18, 3.4);
    if (d === 'glitter') for (let i = 0; i < 4; i++) { const k = Math.sin(t * 4 + i * 1.7); if (k > 0.1) star(-5 + i * 3.4, top - 12 + (i % 2) * 6, 1.6 * k, c); }
  };
  W.beret = ({ ell, done, lin, line, circ, top, R, a, b, d, OL }) => {
    ell(-2, top + 2, R + 2, 5, -0.12); done(lin(a, top - 3, top + 7)); line(OL, 2, [[0, top - 2.5], [0, top - 5]]);
    if (d === 'splat') for (const [x, y, r, col] of [[-8, 1, 1.6, b], [3, -0.5, 1.3, '#3ad8ff'], [8, 3, 1.4, '#ffd23f'], [-3, 4, 1.1, '#2ecc71']]) { circ(x, top + y, r); done(col, null); }
  };
  W.party = ({ poly, done, lin, line, circ, HY, top, a, b, c }) => {
    poly([[-8, HY - 9], [8, HY - 9], [1.5, top - 20]]); done(lin(a, top - 20, HY - 9));
    line(b, 2, [[-5, HY - 15], [5, HY - 17]]); line(b, 2, [[-2.5, top - 9], [3.5, top - 10.5]]); circ(1.5, top - 21, 2.6); done(c);
  };
  W.tiara = ({ g, P, done, poly, circ, HY, R, top, a, b, OL }) => {
    P(); g.ellipse(0, HY - 6, R + 0.5, 4, 0, Math.PI * 0.95, Math.PI * 2.05); g.strokeStyle = OL; g.lineWidth = 2.6; g.stroke(); g.strokeStyle = a; g.lineWidth = 1.4; g.stroke();
    poly([[-6, top + 3.5], [-3, top - 3], [0, top + 2.6], [3, top - 3], [6, top + 3.5], [0, top - 7.5]]); done(a, OL, 0.8);
    circ(0, top - 1, 1.8); done(b, OL, 0.6);
  };
  W.wig = ({ g, P, done, lin, circ, HY, R, top, a, sh }) => {
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { circ(s * (R + 1), HY - 5 + i * 5, 3.4); done(lin(a, HY - 9 + i * 5, HY - 1 + i * 5)); }
    P(); g.arc(0, HY - 3, R + 2.5, Math.PI, 0); g.closePath(); done(lin(a, top - 4, HY - 3));
    for (let i = 0; i < 4; i++) { P(); g.arc(-7.5 + i * 5, HY - 7, 2.6, Math.PI, 0); done(null, sh(a, -0.25), 0.9); }
  };
  W.newsboy = ({ g, P, done, lin, ell, circ, HY, R, top, a, b, sh, OL }) => {
    ell(5, HY - 6.5, 9, 2.4, 0.06); done(sh(a, -0.25));
    P(); g.moveTo(-R - 2, HY - 5); g.quadraticCurveTo(-R - 1, top - 6, 2, top - 4); g.quadraticCurveTo(R + 5, top - 2, R + 2, HY - 7); g.quadraticCurveTo(0, HY - 9, -R - 2, HY - 5); done(lin(a, top - 5, HY - 5));
    circ(1, top - 3.5, 1.4); done(b, OL, 0.6);
  };
  W.fedora = ({ g, P, done, lin, ell, rect, HY, top, a, b }) => {
    ell(0, HY - 8, 17.5, 3.3); done(lin(a, HY - 11, HY - 5));
    P(); g.moveTo(-9, HY - 9); g.lineTo(-8, top - 5); g.quadraticCurveTo(0, top - 1, 8, top - 5); g.lineTo(9, HY - 9); g.closePath(); done(lin(a, top - 6, HY - 9));
    rect(b, -9, HY - 13, 18, 2.8);
  };
  W.sweatband = ({ rr, done, lin, rect, HY, R, a, b }) => {
    rr(-R - 0.5, HY - 10, (R + 0.5) * 2, 5, 2.4); done(lin(a, HY - 10, HY - 5)); rect(b, -R + 0.5, HY - 8.2, (R - 0.5) * 2, 1.4);
  };
  W.laurel = ({ g, ell, done, circ, HY, R, a, c }) => {
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const an = Math.PI * (1.05 + i * 0.075), x = s * Math.cos(an) * -(R + 0.8), y = HY - 3 + Math.sin(an) * (R - 2.5); ell(x, y, 3, 1.5, s * (0.6 + i * 0.25)); done(i % 2 ? a : '#5fa04a', undefined, 0.8); }
    circ(0, HY - R + 1, 1.6); done(c, undefined, 0.6);
  };
  W.wizard = ({ g, P, done, lin, ell, rect, star, HY, top, t, a, b, c }) => {
    ell(0, HY - 8, 19, 3.4); done(lin(a, HY - 11, HY - 5));
    P(); g.moveTo(-10, HY - 9); g.quadraticCurveTo(-5, top - 12, 8 + Math.sin(t * 2), top - 20); g.quadraticCurveTo(2, top - 6, 10, HY - 9); g.closePath(); done(lin(a, top - 20, HY - 9));
    star(-2, top - 4, 2.4, c); star(4, top - 10, 1.5, c); rect(b, -10, HY - 12.5, 20, 2.4);
  };
  W.pith = ({ g, P, done, lin, ell, rect, HY, R, top, a, b }) => {
    ell(0, HY - 7, R + 6, 3.4); done(lin(a, HY - 10, HY - 4));
    P(); g.ellipse(0, HY - 7, R + 1, R - 1, 0, Math.PI, 0); g.closePath(); done(lin(a, top - 4, HY - 7));
    rect(b, -R - 1, HY - 10.5, (R + 1) * 2, 2.6);
  };

  // ---------------- face ----------------
  const eyesAt = (k) => [-4.6 + (k.e || 0), 4.6 + (k.e || 0)];
  W.shades = (k) => {
    const { rr, done, line, P, g, a, b, d, ey, OL } = k, [L, Rt] = eyesAt(k);
    if (d === 'aviator') { for (const cx of [L, Rt]) { P(); g.moveTo(cx - 3.8, ey - 2.4); g.lineTo(cx + 3.8, ey - 2.4); g.quadraticCurveTo(cx + 4, ey + 3.6, cx, ey + 3.4); g.quadraticCurveTo(cx - 4, ey + 3.6, cx - 3.8, ey - 2.4); done(a, b, 1.1); } }
    else for (const cx of [L, Rt]) { rr(cx - 3.6, ey - 2.4, 7.2, 4.8, 2); done(a, OL, 0.9); }
    line(b === OL ? OL : b, 1.2, [[L + 3, ey - 1.2], [Rt - 3, ey - 1.2]]);
    line('rgba(255,255,255,0.55)', 0.9, [[L - 2, ey - 1.2], [L - 0.5, ey - 1.7]]); line('rgba(255,255,255,0.55)', 0.9, [[Rt - 2, ey - 1.2], [Rt - 0.5, ey - 1.7]]);
  };
  W.pixelShades = (k) => {
    const { rect, ey } = k, [L, Rt] = eyesAt(k), e = k.e || 0;
    rect('#101014', L - 4.5, ey - 2.6, Rt - L + 9, 2); for (const cx of [L, Rt]) { rect('#101014', cx - 3.5, ey - 1, 7, 2); rect('#101014', cx - 2.5, ey + 1, 5, 1.6); rect('#ffffff', cx - 2.5, ey - 1, 1.4, 1.4); }
    rect('#101014', 8.5 + e, ey - 2.6, 4.5, 1.4);
  };
  W.glasses3d = (k) => {
    const { rr, done, ey, a } = k, [L, Rt] = eyesAt(k);
    rr(L - 4.6, ey - 3.2, Rt - L + 9.2, 6.4, 1.6); done(a, undefined, 1);
    rr(L - 3.2, ey - 2, 6.4, 4, 1); done('#e8323c', null); rr(Rt - 3.2, ey - 2, 6.4, 4, 1); done('#2ec5ff', null);
  };
  W.heartGlasses = (k) => {
    const { g, P, done, line, ey, a, b } = k, [L, Rt] = eyesAt(k);
    for (const cx of [L, Rt]) { P(); g.moveTo(cx, ey + 3.4); g.bezierCurveTo(cx - 6, ey, cx - 3, ey - 5, cx, ey - 2); g.bezierCurveTo(cx + 3, ey - 5, cx + 6, ey, cx, ey + 3.4); done(rgba(a, 0.9), b, 1); }
    line(b, 1.1, [[L + 3, ey - 1], [Rt - 3, ey - 1]]);
  };
  W.starGlasses = (k) => { const { star, line, ey, a, b } = k, [L, Rt] = eyesAt(k); star(L, ey, 4.4, a); star(Rt, ey, 4.4, a); line(b, 1.1, [[L + 3, ey - 0.5], [Rt - 3, ey - 0.5]]); };
  W.monocle = (k) => { const { circ, done, line, ey, a } = k, [, Rt] = eyesAt(k); circ(Rt, ey, 3.6); done('rgba(220,240,255,0.25)', a, 1.3); line(a, 0.8, [[Rt + 3.3, ey + 1], [Rt + 4.5, ey + 12]]); };
  W.specs = (k) => { const { rr, done, line, ey, a } = k, [L, Rt] = eyesAt(k); for (const cx of [L, Rt]) { rr(cx - 3.8, ey - 3, 7.6, 6, 1.6); done('rgba(200,230,255,0.25)', a, 1.6); } line(a, 1.4, [[L + 3.8, ey - 0.5], [Rt - 3.8, ey - 0.5]]); };
  W.domino = (k) => {
    const { g, P, done, lin, ell, line, ey, R, a, b } = k, [L, Rt] = eyesAt(k);
    P(); g.moveTo(-R + 0.5, ey - 1); g.quadraticCurveTo(L, ey - 6.5, 0, ey - 2); g.quadraticCurveTo(Rt, ey - 6.5, R - 0.5, ey - 1); g.quadraticCurveTo(Rt, ey + 5, 0, ey + 1.4); g.quadraticCurveTo(L, ey + 5, -R + 0.5, ey - 1); done(lin(a, ey - 5, ey + 4));
    for (const cx of [L, Rt]) { ell(cx, ey, 2, 1.5); done('#0a0610', null); }
    line(b, 0.8, [[-R + 2, ey - 1.6], [-3, ey - 3.2]]); line(b, 0.8, [[R - 2, ey - 1.6], [3, ey - 3.2]]);
  };
  W.hockey = (k) => {
    const { g, P, done, lin, ell, poly, HY, R, ey, a, b } = k, [L, Rt] = eyesAt(k), e = k.e || 0;
    P(); g.ellipse(e * 0.4, HY + 1, R - 1.5, R + 0.4, 0, 0, TAU); done(lin(a, HY - 12, HY + 13, 0.1, -0.12));
    for (const cx of [L, Rt]) { ell(cx, ey, 2.4, 1.8); done('#16121a', null); }
    for (const [x, y] of [[-3, 6], [0, 6], [3, 6], [-1.5, 9], [1.5, 9], [0, -7], [-6, -7], [6, -7]]) { ell(x + e, HY + y, 0.7, 0.9); done('#2a2228', null); }
    for (const s of [-1, 1]) { poly([[s * 2 + e, HY - 10], [s * 5 + e, HY - 7], [s * 2 + e, HY - 4]]); done(b, null); }
  };
  W.gasMask = (k) => {
    const { g, P, done, lin, circ, rr, line, HY, R, ey, a, b, OL } = k, [L, Rt] = eyesAt(k), e = k.e || 0;
    line(OL, 3, [[-R, ey - 1], [R, ey - 1]]); line(b, 1.6, [[-R, ey - 1], [R, ey - 1]]);
    P(); g.ellipse(e * 0.5, HY + 3, R - 2.5, R - 2, 0, 0, TAU); done(lin(a, HY - 8, HY + 14));
    for (const cx of [L, Rt]) { circ(cx, ey, 2.8); done('rgba(160,220,200,0.75)', OL, 1.2); }
    rr(-3.5 + e, HY + 6, 7, 7, 2.5); done(lin(b, HY + 6, HY + 13)); for (let i = 0; i < 3; i++) line(OL, 0.6, [[-2 + e, HY + 8 + i * 1.8], [2 + e, HY + 8 + i * 1.8]]);
  };
  W.goggles = (k) => {
    const { circ, done, line, ey, R, a, b, OL } = k, [L, Rt] = eyesAt(k);
    line(OL, 3.6, [[-R - 0.5, ey - 1], [R + 0.5, ey - 1]]); line(b, 2, [[-R - 0.5, ey - 1], [R + 0.5, ey - 1]]);
    for (const cx of [L, Rt]) { circ(cx, ey - 0.5, 3.9); done(b, OL, 1); circ(cx, ey - 0.5, 2.7); done(rgba(a, 0.75), null); }
    line('rgba(255,255,255,0.7)', 0.9, [[L - 1.6, ey - 2], [L - 0.4, ey - 2.6]]); line('rgba(255,255,255,0.7)', 0.9, [[Rt - 1.6, ey - 2], [Rt - 0.4, ey - 2.6]]);
  };
  W.clownNose = (k) => { const { circ, done, HY, a } = k; circ((k.e || 0), HY + 3.6, 2.9); done(a, undefined, 1); circ((k.e || 0) - 0.9, HY + 2.6, 0.8); done('rgba(255,255,255,0.7)', null); };
  W.groucho = (k) => {
    const { g, P, done, circ, line, ell, HY, ey, skin, sh, OL } = k, [L, Rt] = eyesAt(k), e = k.e || 0;
    for (const cx of [L, Rt]) { circ(cx, ey, 3.4); done('rgba(220,240,255,0.2)', '#16121a', 1.6); }
    line('#16121a', 2.2, [[L - 2.5, ey - 4.2], [L + 2.5, ey - 4.6]]); line('#16121a', 2.2, [[Rt - 2.5, ey - 4.6], [Rt + 2.5, ey - 4.2]]);
    ell(e, HY + 4, 2.8, 3.4); done(sh(skin, 0.05), OL, 1);
    P(); g.moveTo(e, HY + 6.5); g.quadraticCurveTo(e - 4, HY + 5, e - 6, HY + 8.4); g.quadraticCurveTo(e - 2, HY + 7.6, e, HY + 7.8); g.quadraticCurveTo(e + 2, HY + 7.6, e + 6, HY + 8.4); g.quadraticCurveTo(e + 4, HY + 5, e, HY + 6.5); done('#2a1a14', OL, 0.8);
  };
  W.dramaMask = (k) => {
    const { g, P, done, lin, ell, HY, R, ey, a, b } = k, [L, Rt] = eyesAt(k), e = k.e || 0;
    P(); g.moveTo(-R + 1 + e, HY - 8); g.quadraticCurveTo(e, HY - 12, R - 1 + e, HY - 8); g.quadraticCurveTo(R + e, HY + 6, e, HY + 11); g.quadraticCurveTo(-R + e, HY + 6, -R + 1 + e, HY - 8); done(lin(a, HY - 12, HY + 11));
    for (const cx of [L, Rt]) { P(); g.moveTo(cx - 2.6, ey + 0.6); g.quadraticCurveTo(cx, ey - 3, cx + 2.6, ey + 0.6); g.quadraticCurveTo(cx, ey - 0.6, cx - 2.6, ey + 0.6); done('#16121a', null); }
    P(); g.moveTo(-4 + e, HY + 4); g.quadraticCurveTo(e, HY + 10, 4 + e, HY + 4); g.quadraticCurveTo(e, HY + 6, -4 + e, HY + 4); done('#16121a', null);
    ell(-R + 2 + e, HY - 2, 1.6, 1); done(b, null); ell(R - 2 + e, HY - 2, 1.6, 1); done(b, null);
  };
  W.bubblePipe = (k) => {
    const { circ, done, line, rr, HY, t, a, b } = k, e = k.e || 0, my = HY + 7;
    line('#2b1f3d', 2.6, [[e + 2, my], [e + 8, my + 1.5]]); line(a, 1.4, [[e + 2, my], [e + 8, my + 1.5]]); rr(e + 7, my - 3, 4, 5, 1.4); done(a);
    for (let i = 0; i < 3; i++) { const p = (t * 0.5 + i / 3) % 1; circ(e + 10 + p * 4 + Math.sin(t * 3 + i) * 1.5, my - 5 - p * 16, 1.2 + p * 1.6); done(rgba(b, 0.35 * (1 - p) + 0.1), rgba('#ffffff', 0.8 * (1 - p)), 0.6); }
  };

  // ---------------- hand (origin = the hand; up is -y) ----------------
  const tilt = (g, an) => g.rotate(an);
  W.bat = ({ g, P, done, lin, rr, line, a, b, d, OL }) => {
    tilt(g, 0.45); P(); g.moveTo(-1.4, 4); g.lineTo(-2.6, -18); g.quadraticCurveTo(-3, -24, 0, -24.5); g.quadraticCurveTo(3, -24, 2.6, -18); g.lineTo(1.4, 4); g.closePath(); done(lin(a, -24, 4));
    rr(-1.8, -3, 3.6, 7, 1); done(b, OL, 0.8);
    if (d === 'nails') for (const y of [-21, -17, -13]) { line('#c4ccd2', 1, [[-2.6, y], [-5, y - 1]]); line('#c4ccd2', 1, [[2.6, y + 1.5], [5, y + 0.5]]); }
  };
  W.pan = ({ g, circ, done, lin, rr, a, b }) => { tilt(g, 0.5); rr(-1.3, -10, 2.6, 13, 1.2); done(b); circ(0, -17, 7); done(lin(a, -24, -10)); circ(0, -17, 5); done('rgba(0,0,0,0.25)', null); };
  W.magnifier = ({ g, circ, done, line, a, b, OL }) => {
    tilt(g, 0.35); line(OL, 3.6, [[0, 3], [0, -8]]); line(b, 2.2, [[0, 3], [0, -8]]);
    circ(0, -14, 6); done('rgba(200,235,255,0.35)', OL, 3.8); circ(0, -14, 6); done(null, a, 2.2);
    line('rgba(255,255,255,0.8)', 1, [[-3, -16], [-1.5, -17.8]]);
  };
  W.mic = ({ g, circ, done, lin, rr, line, a, b, OL }) => {
    tilt(g, 0.2); rr(-1.9, -9, 3.8, 11, 1.6); done(lin(b, -9, 2)); circ(0, -12, 4); done(lin(a, -16, -8));
    line(rgba('#000000', 0.3), 0.6, [[-3, -12], [3, -12]]); line(rgba('#000000', 0.3), 0.6, [[0, -15.5], [0, -8.5]]);
  };
  W.brush = ({ g, P, done, line, rr, a, b, OL }) => {
    tilt(g, 0.4); line(OL, 3, [[0, 6], [0, -12]]); line(a, 1.6, [[0, 6], [0, -12]]); rr(-1.6, -15, 3.2, 3.5, 0.6); done('#c4ccd2', OL, 0.7);
    P(); g.moveTo(-1.6, -15); g.quadraticCurveTo(-2, -19, 0, -22); g.quadraticCurveTo(2, -19, 1.6, -15); g.closePath(); done(b, OL, 0.8);
  };
  W.pencil = ({ g, rr, poly, done, lin, a, b, d, OL }) => {
    tilt(g, 0.5);
    if (d === 'quill') { g.beginPath(); g.moveTo(0, 4); g.quadraticCurveTo(-5, -10, 1, -24); g.quadraticCurveTo(5, -10, 0, 4); done(lin(a, -24, 4)); g.beginPath(); g.moveTo(0, 3); g.lineTo(0.8, -20); g.strokeStyle = b; g.lineWidth = 0.8; g.stroke(); return; }
    rr(-2, -16, 4, 18, 0.8); done(lin(a, -16, 2)); rr(-2, -19, 4, 3.5, 1); done(b, OL, 0.8);
    poly([[-2, 2], [2, 2], [0, 6.5]]); done('#f3d9a8', OL, 0.8); poly([[-0.8, 4.6], [0.8, 4.6], [0, 6.5]]); done('#2b1f3d', null);
  };
  W.gavel = ({ g, rr, done, lin, line, a, b, OL }) => {
    tilt(g, 0.3); line(OL, 3.2, [[0, 3], [0, -12]]); line(b, 1.8, [[0, 3], [0, -12]]);
    rr(-6.5, -17, 13, 6, 2); done(lin(a, -17, -11)); rr(-7.5, -17.5, 2, 7, 0.8); done(b, OL, 0.6); rr(5.5, -17.5, 2, 7, 0.8); done(b, OL, 0.6);
  };
  W.cutters = ({ g, P, done, line, a, OL }) => {
    tilt(g, 0.3);
    for (const s of [-1, 1]) { P(); g.moveTo(s * 1, -6); g.quadraticCurveTo(s * 4, 0, s * 2.5, 5); g.lineTo(s * 0.5, 5); g.quadraticCurveTo(s * 2, 0, s * -0.2, -6); g.closePath(); done(a, OL, 0.9); }
    P(); g.moveTo(-1.8, -6); g.lineTo(-1, -14); g.lineTo(0, -15); g.lineTo(1, -14); g.lineTo(1.8, -6); g.closePath(); done('#c4ccd2', OL, 0.9); line(OL, 0.6, [[0, -6], [0, -14]]);
  };
  W.raygun = ({ g, rr, done, lin, circ, poly, a, b, c, t, OL }) => {
    rr(-1.8, -4, 3.6, 7, 1.2); done(b); rr(-3, -10, 14, 6.4, 3); done(lin(a, -10, -3.6));
    for (let i = 0; i < 3; i++) { rr(1.5 + i * 2.6, -11, 1.2, 8.4, 0.5); done(b, null); }
    poly([[-3, -9], [-6.5, -12], [-5, -6]]); done(b, OL, 0.8);
    circ(12, -6.8, 1.8 + 0.4 * Math.sin(t * 8)); done(c, OL, 0.7);
  };
  W.sword = ({ g, rr, poly, done, lin, line, circ, a, b, OL }) => {
    tilt(g, 0.3); rr(-1.4, -4, 2.8, 7, 1); done('#5a3a20'); rr(-5.5, -6, 11, 2.6, 1.2); done(b);
    poly([[-1.9, -6], [-1.9, -26], [0, -29.5], [1.9, -26], [1.9, -6]]); done(lin(a, -29, -6, 0.3, -0.1)); line('rgba(255,255,255,0.7)', 0.7, [[-0.4, -8], [-0.4, -26]]);
    circ(0, 4, 1.6); done(b, OL, 0.6);
  };
  W.staff = ({ g, circ, done, line, a, c, t, OL }) => {
    tilt(g, 0.15); line(OL, 3.6, [[0, 10], [0, -32]]); line(a, 2.2, [[0, 10], [0, -32]]);
    g.save(); g.shadowColor = c; g.shadowBlur = 8 + 3 * Math.sin(t * 3); circ(0, -35, 4); done(c, OL, 1); g.restore(); circ(-1.2, -36.2, 1.1); done('rgba(255,255,255,0.8)', null);
  };
  W.flag = ({ g, P, done, lin, line, circ, a, b, c, t, OL }) => {
    tilt(g, 0.12); line(OL, 3, [[0, 8], [0, -32]]); line('#8a5a34', 1.6, [[0, 8], [0, -32]]);
    const w = Math.sin(t * 4) * 1.5; P(); g.moveTo(0, -31); g.quadraticCurveTo(7, -33 + w, 14, -31); g.lineTo(14, -21); g.quadraticCurveTo(7, -23 - w, 0, -21); g.closePath(); done(lin(a, -32, -21));
    circ(7, -26, 2.2); done(b, OL, 0.6); circ(0, -33, 1.4); done(c || '#ffd23f', OL, 0.6);
  };
  W.pitchfork = ({ g, line, a, b, OL }) => {
    tilt(g, 0.12); line(OL, 3, [[0, 10], [0, -26]]); line(a, 1.6, [[0, 10], [0, -26]]);
    line(OL, 2.6, [[-4.5, -26], [4.5, -26]]); for (const x of [-4.5, 0, 4.5]) { line(OL, 2.4, [[x, -26], [x, -34]]); line(b, 1.1, [[x, -26], [x, -34]]); } line(b, 1.2, [[-4.5, -26], [4.5, -26]]);
  };
  W.duck = ({ g, P, done, lin, circ, ell, a, b, OL }) => {
    ell(3, -4, 6.5, 4.6); done(lin(a, -9, 1)); circ(6.5, -10, 3.6); done(lin(a, -14, -6));
    P(); g.moveTo(9.5, -10.5); g.lineTo(13.5, -9.5); g.lineTo(9.5, -8.4); g.closePath(); done(b, OL, 0.8); circ(7.3, -11, 0.8); done(OL, null);
    P(); g.moveTo(-3, -6); g.quadraticCurveTo(-5.5, -8, -4, -3); done(a, OL, 1);
  };
  W.peel = ({ g, rr, ell, circ, done, lin, line, a, c, OL }) => {
    tilt(g, 0.25); line(OL, 3.2, [[0, 8], [0, -16]]); line(a, 1.8, [[0, 8], [0, -16]]);
    ell(0, -24, 8, 9.5); done(lin(a, -33, -15)); if (c) { circ(0, -24, 6); done(c, OL, 0.8); for (const [x, y] of [[-2.5, -26], [2.5, -23], [-1, -21], [2, -28]]) { circ(x, y, 1.1); done('#b8322c', null); } }
  };
  W.pizzaCutter = ({ g, circ, done, line, rr, a, OL }) => {
    tilt(g, 0.4); rr(-1.8, -6, 3.6, 10, 1.5); done(a); line(OL, 1.6, [[0, -6], [0, -11]]);
    circ(0, -15, 4.6); done('#d4dade', OL, 1.2); circ(0, -15, 1.1); done(a, null);
  };
  W.rollingPin = ({ g, rr, done, lin, a }) => { tilt(g, 1.2); rr(-12, -2.6, 24, 5.2, 2.6); done(lin(a, -2.6, 2.6, 0.2, -0.15)); rr(-16, -1.4, 4.5, 2.8, 1.2); done(a); rr(11.5, -1.4, 4.5, 2.8, 1.2); done(a); };
  W.trophy = ({ g, P, done, lin, rr, a, b, OL }) => {
    g.translate(2, -4);
    for (const s of [-1, 1]) { P(); g.arc(s * 5.4, -9, 2.6, 0, TAU); done(null, OL, 2.6); P(); g.arc(s * 5.4, -9, 2.6, 0, TAU); done(null, a, 1.2); }
    P(); g.moveTo(-5.5, -13); g.lineTo(5.5, -13); g.quadraticCurveTo(5.5, -4, 0, -3.5); g.quadraticCurveTo(-5.5, -4, -5.5, -13); g.closePath(); done(lin(a, -13, -3));
    rr(-1.2, -4, 2.4, 3.5, 0.6); done(a, OL, 0.7); rr(-4, -1, 8, 3, 1); done(b);
  };
  W.sign = ({ g, rr, done, lin, line, a, b, c, OL }) => {
    tilt(g, 0.06); line(OL, 3, [[0, 6], [0, -22]]); line('#a0703a', 1.6, [[0, 6], [0, -22]]);
    rr(-11, -36, 22, 15, 2); done(lin(a, -36, -21)); line(b, 1.8, [[-7, -31], [7, -31]]); line(b, 1.8, [[-5, -26.5], [5, -26.5]]);
    if (c) { line(c, 1.2, [[-11, -36], [11, -36]]); }
  };
  W.file = ({ g, rr, done, lin, line, a, b }) => {
    tilt(g, 0.15); rr(-3, -16, 13, 16, 1.2); done(lin(a, -16, 0)); rr(-1.5, -18, 10, 3, 0.8); done(a);
    rr(-1, -14, 9, 11, 0.6); done('#f6f2e6', null); for (let i = 0; i < 3; i++) line(b, 0.8, [[0, -12 + i * 3], [7, -12 + i * 3]]);
  };
  W.basket = ({ g, P, done, lin, rr, circ, line, a, OL }) => {
    g.translate(3, 2); P(); g.arc(0, -8, 6, Math.PI, 0); done(null, OL, 2.6); P(); g.arc(0, -8, 6, Math.PI, 0); done(null, a, 1.2);
    circ(-3, -8, 2.6); done('#e8323c', OL, 0.7); circ(1.5, -9, 2.2); done('#ffd23f', OL, 0.7); rr(2.5, -12, 2.6, 6, 0.8); done('#2ec5ff', OL, 0.6);
    P(); g.moveTo(-7.5, -8); g.lineTo(7.5, -8); g.lineTo(6, 0); g.lineTo(-6, 0); g.closePath(); done(lin(a, -8, 0));
    for (let i = -5; i <= 5; i += 2.5) line(rgba('#000000', 0.25), 0.7, [[i, -7], [i * 0.85, -1]]);
  };
  W.scanner = ({ g, rr, done, lin, poly, line, t, a, c, OL }) => {
    rr(-2, -6, 4, 9, 1.4); done(lin(a, -6, 3)); poly([[-3, -6], [9, -12], [10, -8], [-1, -2]]); done(lin(a, -12, -2));
    if (Math.sin(t * 5) > -0.3) line(rgba(c, 0.8), 1, [[10, -10], [22, -14]]);
  };
  W.phone = ({ g, rr, done, line, circ, t, a, b, OL }) => {
    tilt(g, -0.1); rr(-3.5, -15, 8, 14, 1.6); done(a); rr(-2.4, -13.6, 5.8, 10.6, 0.8); done(b, null);
    circ(0.5, -9, 1.6 + 0.3 * Math.sin(t * 4)); done('#ffd23f', null); line('rgba(255,255,255,0.6)', 0.8, [[-1.6, -12.6], [0, -13.2]]);
  };
  // JustSnap: a camera held up, ready to shoot (d: 'instant' | 'film'; glow = a flash now and then).
  W.camera = ({ g, rr, done, circ, rect, lin, line, star, t, a, b, d, glow }) => {
    tilt(g, -0.14);
    if (d === 'instant') {
      rr(-7.5, -16, 15, 12.5, 2.4); done(lin(a, -16, -3.5)); rect(b, -7.5, -12.4, 15, 2.2);
      circ(0, -9, 3.9); done('#2b2b33'); circ(0, -9, 2.3); done('#6ec6ff', null); circ(-0.8, -9.8, 0.8); done('rgba(255,255,255,0.85)', null);
      rr(3.4, -15.2, 2.8, 2, 0.6); done('#fff6c8', null); rr(-6, -4.6, 12, 1.6, 0.5); done('#f6f2e6', null);
    } else {
      rr(-8, -15, 16, 10.5, 2); done(lin(a, -15, -4.5)); rr(-3.6, -18, 7.2, 3.6, 1); done(a);
      circ(0, -9.6, 4.4); done(b); circ(0, -9.6, 2.9); done('#1d2230'); circ(-1, -10.6, 0.9); done('rgba(255,255,255,0.8)', null);
      rr(-7, -14, 3, 1.6, 0.5); done('#d8dbe2', null); line('rgba(255,255,255,0.35)', 0.8, [[-7, -6], [7, -6]]);
    }
    if (glow && Math.sin(t * 1.7) > 0.93) star(4.8, -17, 4.2, '#fffbe0');
  };
  W.popcorn = ({ g, P, done, circ, a, OL }) => {
    g.translate(3, 0);
    for (const [x, y] of [[-4, -13], [-1, -15], [2.5, -14], [5, -12.5], [0.5, -12], [-3, -11]]) { circ(x, y, 2.4); done('#fff6d6', OL, 0.7); }
    P(); g.moveTo(-6, -11); g.lineTo(6.5, -11); g.lineTo(5, 1); g.lineTo(-4.5, 1); g.closePath(); done('#ffffff');
    g.save(); g.clip(); g.fillStyle = a; for (let i = -6; i < 7; i += 4) g.fillRect(i, -12, 2, 14); g.restore();
    P(); g.moveTo(-6, -11); g.lineTo(6.5, -11); g.lineTo(5, 1); g.lineTo(-4.5, 1); g.closePath(); done(null, OL, 1.2);
  };
  W.chicken = ({ g, P, done, lin, circ, ell, line, a, b, OL }) => {
    tilt(g, 0.4); ell(0, -10, 3.4, 9); done(lin(a, -19, -1)); circ(0, -21, 3.2); done(a);
    P(); g.moveTo(2.6, -21.5); g.lineTo(6, -20.5); g.lineTo(2.6, -19.6); g.closePath(); done(b, OL, 0.7);
    P(); g.moveTo(-1.5, -24); g.lineTo(-0.5, -26.5); g.lineTo(0.5, -24.2); g.lineTo(1.5, -26.5); g.lineTo(2, -23.6); done('#e8323c', OL, 0.6); circ(1, -21.8, 0.6); done(OL, null);
    line(b, 1.1, [[-1.5, -1], [-2.5, 3]]); line(b, 1.1, [[1.5, -1], [2.5, 3]]);
  };
  W.megaphone = ({ g, P, done, lin, rr, a, b, OL }) => {
    rr(-1.8, -4, 3.6, 7, 1); done(b); P(); g.moveTo(-1, -9); g.lineTo(4, -9.5); g.lineTo(15, -15); g.lineTo(15, -1); g.lineTo(4, -5.5); g.lineTo(-1, -6); g.closePath(); done(lin(a, -15, -1));
    rr(13.6, -15.6, 3, 15.2, 1.4); done(b, OL, 0.8);
  };
  W.cards = ({ g, rr, done, circ, a, b, OL }) => {
    for (let i = -1; i <= 1; i++) { g.save(); g.translate(1, -2); g.rotate(i * 0.32); rr(-3.6, -15, 7.2, 10, 1.2); done(i === 1 ? '#ffffff' : a, OL, 0.9); if (i === 1) { circ(0, -10, 1.6); done(b, null); } g.restore(); }
  };
  W.lasso = ({ g, P, done, line, ell, a, t, OL }) => {
    for (let i = 0; i < 3; i++) { ell(2, -4, 6 - i * 0.6, 7 - i * 0.6, 0.3); done(null, OL, 2.6); ell(2, -4, 6 - i * 0.6, 7 - i * 0.6, 0.3); done(null, a, 1.3); }
    P(); g.moveTo(6, 0); g.quadraticCurveTo(14, 3 + Math.sin(t * 3) * 2, 16, -6); done(null, a, 1.4);
  };
  W.palette = ({ g, P, done, lin, circ, a, b }) => {
    g.translate(4, -3); g.rotate(-0.3);
    P(); g.ellipse(0, -4, 9, 6.5, 0, 0, TAU); done(lin(a, -10, 2)); circ(-4, -2, 1.6); done('rgba(0,0,0,0.35)', null);
    [['#e8323c', -2, -8], ['#ffd23f', 2.5, -8.5], ['#2ec5ff', 6, -5.5], [b, 5, -1], ['#2ecc71', 1, -3.5]].forEach(([col, x, y]) => { circ(x, y, 1.5); done(col, undefined, 0.6); });
  };
  W.flashlight = ({ g, rr, done, lin, a, c, t }) => {
    tilt(g, -0.6); g.save(); g.fillStyle = rgba(c, 0.22 + 0.06 * Math.sin(t * 3)); g.beginPath(); g.moveTo(-2, -14); g.lineTo(-9, -34); g.lineTo(9, -34); g.lineTo(2, -14); g.fill(); g.restore();
    rr(-2, -12, 4, 14, 1.2); done(lin(a, -12, 2)); rr(-3, -15, 6, 4, 1.2); done(a); rr(-2.2, -15.6, 4.4, 1.4, 0.6); done(c, null);
  };

  // ---------------- chest ----------------
  W.starBadge = ({ star, circ, done, SW, a, c }) => { star(SW * 0.45, -23, 3.9, a); circ(SW * 0.45, -23, 1.1); done(c, null); };
  W.bowtie = ({ poly, done, circ, a, b }) => { poly([[0, -30.5], [-5, -33], [-5, -28]]); done(a); poly([[0, -30.5], [5, -33], [5, -28]]); done(a); circ(0, -30.5, 1.6); done(b || a); };
  W.tie = ({ poly, done, lin, line, a, b }) => {
    poly([[-2, -31], [2, -31], [1.2, -28.5], [-1.2, -28.5]]); done(a, undefined, 0.8);
    poly([[-1.2, -28.5], [1.2, -28.5], [2.6, -18], [0, -15], [-2.6, -18]]); done(lin(a, -28, -15));
    if (b) for (let i = 0; i < 3; i++) line(b, 0.9, [[-1.8, -26 + i * 3.6], [1.8, -27.5 + i * 3.6]]);
  };
  W.medal = ({ poly, done, circ, star, a, b }) => {
    poly([[-4, -31.5], [-1, -31.5], [1, -24], [-1.6, -24]]); done(b, undefined, 0.8); poly([[4, -31.5], [1, -31.5], [-1, -24], [1.6, -24]]); done(b, undefined, 0.8);
    circ(0, -21, 3.8); done(a); star(0, -21, 2.2, '#fff6c0');
  };
  W.apron = ({ g, P, done, lin, line, rr, a, b, d, bot, fem }) => {
    const hw = fem ? 7.5 : 8.5, yb = Math.max(bot, -6) + 1;
    line('#2b1f3d', 2.4, [[-4, -31.5], [-hw + 1.5, -24]]); line('#2b1f3d', 2.4, [[4, -31.5], [hw - 1.5, -24]]);
    line(a, 1.2, [[-4, -31.5], [-hw + 1.5, -24]]); line(a, 1.2, [[4, -31.5], [hw - 1.5, -24]]);
    P(); g.moveTo(-hw + 1.5, -25); g.lineTo(hw - 1.5, -25); g.lineTo(hw, yb); g.lineTo(-hw, yb); g.closePath(); done(lin(a, -25, yb, 0.1, -0.1));
    g.save(); g.clip(); if (d === 'stripes') { g.fillStyle = b; for (let i = -10; i < 12; i += 4) g.fillRect(i, -26, 1.6, 26); } g.restore();
    P(); g.moveTo(-hw + 1.5, -25); g.lineTo(hw - 1.5, -25); g.lineTo(hw, yb); g.lineTo(-hw, yb); g.closePath(); done(null);
    rr(-4, -16, 8, 5, 1); done(b, undefined, 0.8);
    if (d === 'splat') for (const [x, y, r, col] of [[-4, -21, 1.4, '#e8323c'], [3, -19, 1.2, '#2ec5ff'], [-1, -10, 1.1, '#ffd23f'], [5, -12, 1, '#2ecc71']]) { g.beginPath(); g.arc(x, y, r, 0, TAU); done(col, null); }
  };
  W.sash = ({ g, P, done, lin, line, star, SW, a, c, fem }) => {
    const x0 = -SW + 1.5, y0 = -31, x1 = (fem ? 9 : 11), y1 = -12;
    P(); g.moveTo(x0, y0); g.lineTo(x0 + 5, y0); g.lineTo(x1, y1); g.lineTo(x1 - 5, y1 + 1.5); g.closePath(); done(lin(a, y0, y1));
    if (c) { line(c, 0.8, [[x0 + 0.6, y0 + 0.8], [x1 - 4.4, y1 + 0.8]]); line(c, 0.8, [[x0 + 4.4, y0 + 0.2], [x1 - 0.6, y1 - 0.6]]); star(0.5, -21.5, 2, c); }
  };
  W.nameTag = ({ rr, done, rect, line, a }) => { rr(1, -28.5, 8.5, 5.6, 1); done('#ffffff', undefined, 0.8); rect(a, 1.5, -28, 7.5, 1.8); line('#2b1f3d', 0.7, [[3, -24.6], [7.5, -24.6]]); };
  // JustSnap: a press pass on a lanyard.
  W.pressPass = ({ rr, done, rect, line, a, b }) => {
    line(b, 1.3, [[-4.5, -31.5], [0, -23.5], [4.5, -31.5]]);
    rr(-3.8, -24, 7.6, 9.4, 1.1); done('#ffffff', undefined, 0.8); rect(a, -3.8, -23.6, 7.6, 2.4);
    rect('#c9d8e6', -2.8, -20.4, 2.8, 3); line('#2b1f3d', 0.6, [[0.9, -19.8], [2.9, -19.8]]); line('#2b1f3d', 0.6, [[0.9, -18.4], [2.4, -18.4]]);
  };
  W.pin = ({ circ, done, star, a, b, d }) => { circ(5, -25, 3.2); done(a, undefined, 1); if (d === 'star') star(5, -25, 1.8, b); else { circ(5, -25, 1.5); done(b, null); } };
  W.vest = ({ g, P, done, lin, rr, line, SW, a, b, bot }) => {
    const yb = Math.max(bot, -9);
    for (const s of [-1, 1]) { P(); g.moveTo(s * 2.5, -31.5); g.lineTo(s * (SW - 0.5), -30.5); g.lineTo(s * (SW + 0.4), yb); g.lineTo(s * 1.4, yb); g.closePath(); done(lin(a, -31, yb)); rr(s > 0 ? 4 : -9, -22, 5, 5, 1); done(b, undefined, 0.8); }
    line('#2b1f3d', 0.8, [[-SW, -17], [SW, -17]]);
  };

  // ---------------- back ----------------
  W.cape = ({ poly, done, lin, rr, circ, SW, a, b, c }) => {
    poly([[-SW + 1, -31], [SW - 1, -31], [SW + 6, -1], [-SW - 6, -1]]); done(lin(a, -31, 0));
    poly([[-SW - 4.5, -6], [SW + 4.5, -6], [SW + 6, -1], [-SW - 6, -1]]); done(b || a, null);
    if (c) { rr(-SW + 1, -32.5, (SW - 1) * 2, 2.6, 1.2); done(c, undefined, 0.7); }
  };
  W.backpack = ({ rr, done, lin, SW, a, b, c }) => {
    if (c) { rr(-SW - 1, -36, (SW + 1) * 2, 5, 2.5); done(lin(c, -36, -31)); }
    rr(-SW - 1.5, -31, (SW + 1.5) * 2, 22, 5); done(lin(a, -31, -9)); rr(SW - 1, -26, 4.5, 9, 2); done(b);
  };
  W.jetpack = ({ g, rr, done, lin, P, SW, t, a, b }) => {
    for (const s of [-1, 1]) {
      const x = s * (SW - 2.5);
      const fl = 4 + Math.abs(Math.sin(t * 14 + s)) * 4; P(); g.moveTo(x - 2.5, -7); g.quadraticCurveTo(x, -7 + fl * 2.4, x + 2.5, -7); g.closePath(); done('#ffb23a', '#ff5a1f', 0.9);
      rr(x - 4, -34, 8, 28, 4); done(lin(a, -34, -6)); rr(x - 4, -27, 8, 2.4, 1); done(b, null);
    }
  };

  A.WEAR = W;
})(typeof window !== 'undefined' ? window : globalThis);
