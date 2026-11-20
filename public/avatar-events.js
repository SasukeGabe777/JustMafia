// Event items for the smooth JustGameBox character (public/avatar.js drawSmooth), one block per kind
// of event (public/shared/seasons.js ITEMS). Kept in its own file so the base character stays small:
// drawSmooth calls these through window.MT_EVENT_ART at a few hook points
//   hat(K, e, top), hatBack(K), details(K, bottom, dark, light) (inside the body clip), behind(K, bottom),
//   hand(K) (origin = the right hand, up is -y), chest(K), face(K, e, ey, L, Rt, mx, my), back(K),
//   shoe(K, lx) (one foot, toe to +x), effect(K, isBackLayer)
// and these tables: OUTFITS (like avatar.js OUTFITS: c colour, len, sleeve), OPEN_TOP (hats a bun shows
// through), HIDE_HAIR (hoods), SPOT (which game-wearable spot an accessory uses).
// K = { g, P, done, circ, ell, rr, poly, lin, rect, line, star, heart, sh, shade, OL, TAU, t, f, HY, R, fem, SW, skin, hairC, color, pants, shoes, cloth, outfit }.
// All original art. Load after (or before) avatar.js on every page that draws characters.
(function (root) {
  const PI = Math.PI, TAU = PI * 2;
  const A = { OUTFITS: {}, OPEN_TOP: {}, HIDE_HAIR: {}, SPOT: {}, hat: {}, hatBack: {}, details: {}, behind: {}, hand: {}, chest: {}, face: {}, back: {}, shoe: {}, effect: {} };

  // ---------- shared little drawings ----------
  // A headband over the top of the head.
  const band = (K, c, w = 2) => { const { g, P, HY, R, OL } = K; P(); g.arc(0, HY - 1, R + 0.8, PI * 1.08, PI * 1.92); g.strokeStyle = OL; g.lineWidth = w + 1.4; g.stroke(); g.strokeStyle = c; g.lineWidth = w; g.stroke(); };
  // A shoe or boot of height h (toe to +x).
  const boot = (K, lx, h, c, toe = 6.5, sole = null) => {
    const { g, P, done, lin, rect } = K;
    P(); g.moveTo(lx - 3.6, -h); g.lineTo(lx + 3.4, -h); g.lineTo(lx + 3.4, -3); g.quadraticCurveTo(lx + toe, -3, lx + toe, -1); g.lineTo(lx + toe, 0.3); g.lineTo(lx - 3.8, 0.3); g.closePath(); done(lin(c, -h, 0));
    if (sole) rect(sole, lx - 3.8, -1.1, toe + 3.8, 1.4);
  };
  const fadeOf = (p) => (p < 0.12 ? p / 0.12 : p > 0.85 ? (1 - p) / 0.15 : 1);
  // Things falling past the character (front layer): draw(x, y, i, p).
  const fall = (K, n, speed, draw) => { const { g, t } = K; for (let i = 0; i < n; i++) { const p = (t * speed + i / n) % 1, x = Math.sin(i * 2.37 + t * 0.6) * 20 + Math.sin(p * 8 + i) * 3, y = -82 + p * 84; g.save(); g.globalAlpha *= fadeOf(p); g.translate(x, y); draw(i, p); g.restore(); } };
  // Things rising around the character (front layer).
  const rise = (K, n, speed, draw, spread = 20) => { const { g, t } = K; for (let i = 0; i < n; i++) { const p = (t * speed + i / n) % 1, x = Math.sin(i * 2.9 + 1) * spread + Math.sin(t * 1.4 + i * 2) * 2.5, y = -4 - p * 80; g.save(); g.globalAlpha *= fadeOf(p); g.translate(x, y); draw(i, p); g.restore(); } };
  // Things circling the character: in front half the time, behind the rest.
  const orbit = (K, back, n, speed, rx, cy, ry, draw) => { const { g, t } = K; for (let i = 0; i < n; i++) { const a = t * speed + (i * TAU) / n, front = Math.sin(a) > 0; if (front === back) continue; g.save(); g.translate(Math.cos(a) * rx, cy + Math.sin(a) * ry); draw(i, a); g.restore(); } };
  // A four-leaf clover.
  const clover = (K, x, y, r, c = '#2ecc71') => { const { heart, line } = K; line('#1f7a3a', Math.max(0.6, r * 0.35), [[x, y], [x + r * 0.6, y + r * 1.8]]); for (let k = 0; k < 4; k++) { const a = k * PI / 2 + PI / 4; K.g.save(); K.g.translate(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62); K.g.rotate(a + PI / 2); heart(0, 0, r * 0.62, c, 0.5); K.g.restore(); } };
  const coin = (K, x, y, r) => { K.ell(x, y, r, r * 0.9); K.done('#ffd25a', K.OL, 0.6); K.ell(x, y, r * 0.55, r * 0.5); K.done(null, '#d4a020', 0.6); };
  // A five-point star (no outline), for glows.
  const starPath = (g, cx, cy, r, inner = 0.45) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, rad = i % 2 ? r * inner : r; g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); } g.closePath(); };
  const glow = (g, c, b = 6) => { g.shadowColor = c; g.shadowBlur = b; };

  // ======================= New Year Countdown =======================
  A.OPEN_TOP.starTiara = 1;
  A.hat.starTiara = (K, e, top) => {
    const { g, P, line, star, HY, R, OL, t } = K;
    P(); g.ellipse(0, HY - 6, R + 0.5, 4.2, 0, PI * 0.95, PI * 2.05); g.strokeStyle = OL; g.lineWidth = 3.2; g.stroke(); g.strokeStyle = '#dfe6ee'; g.lineWidth = 1.7; g.stroke();
    for (const [x, y, r] of [[-10, top + 4, 2.1], [10, top + 4, 2.1], [-5.5, top - 1, 2.9], [5.5, top - 1, 2.9], [0, top - 5, 4.3]]) { line('#c9d2dc', 1.1, [[x * 0.92, y + r * 0.6], [x * 0.85, HY - 9]]); star(x, y, r, '#ffd25a'); }
    const k = (Math.sin(t * 4) + 1) / 2; g.save(); g.globalAlpha *= k; glow(g, '#fff6c8', 5); starPath(g, 2.6, top - 8.5, 1.4, 0.3); g.fillStyle = '#ffffff'; g.fill(); g.restore();
  };
  A.OUTFITS.sequinSuit = { c: '#d4a43a', d: 'sequin', sleeve: '#c4942a' };
  A.details.sequin = (K, b) => {
    const { g, circ, done, poly, t, OL } = K;
    let row = 0; for (let y = -32; y < b + 2; y += 2.6, row++) for (let x = -15; x < 16; x += 2.6) { const k = Math.sin(t * 3 + x * 0.7 + y * 0.9); circ(x + (row % 2 ? 1.3 : 0), y, 0.95); done(k > 0.7 ? '#fff6c8' : k > 0 ? '#f0c85a' : '#b8862a', null); }
    poly([[-4.5, -32], [4.5, -32], [0, -22]]); done('#f4f1ea', null);
    poly([[-4.5, -32], [-1, -21], [-6.5, -25]]); done('#16141c', OL, 0.7); poly([[4.5, -32], [1, -21], [6.5, -25]]); done('#16141c', OL, 0.7);
    poly([[0, -29.6], [-3.6, -31.6], [-3.6, -27.6]]); done('#101014', OL, 0.5); poly([[0, -29.6], [3.6, -31.6], [3.6, -27.6]]); done('#101014', OL, 0.5);
  };
  A.hand.partyHorn = (K) => {
    const { g, rr, done, lin, P, OL, t, line } = K;
    g.rotate(0.45); const ext = Math.max(0, Math.sin(t * 2.2)); rr(-1.6, -7, 3.2, 7, 1.2); done('#ff4f9a', OL, 0.8);
    const L = 3 + ext * 12; rr(-2.2, -7 - L, 4.4, L, 2); done(lin('#ffd25a', -7 - L, -7)); for (let y = -9; y > -7 - L; y -= 3) line('#ff4f9a', 1, [[-2, y], [2, y - 1]]);
    if (ext < 0.6) { P(); g.arc(0, -7 - L - 2.6, 2.8, PI * 0.5, PI * 2.3); g.strokeStyle = OL; g.lineWidth = 3; g.stroke(); g.strokeStyle = '#ffd25a'; g.lineWidth = 1.8; g.stroke(); }
    else { for (let k = -1; k <= 1; k++) line(['#3ae8ff', '#ff4f9a', '#b45cff'][k + 1], 0.9, [[k * 1.2, -7 - L], [k * 2.6, -10 - L]]); }
  };
  A.face.starGlasses = (K, e, ey, L, Rt) => {
    const { g, star, circ, done, line, OL } = K;
    line('#e0a820', 1.3, [[L + 3.5, ey - 1], [Rt - 3.5, ey - 1]]); line('#e0a820', 1.1, [[-K.R + 0.5, ey - 1.5], [L - 4.5, ey - 1]]); line('#e0a820', 1.1, [[K.R - 0.5, ey - 1.5], [Rt + 4.5, ey - 1]]);
    for (const cx of [L, Rt]) { star(cx, ey - 0.6, 5.6, '#ffd25a'); circ(cx, ey - 0.2, 2.5); done('rgba(70,40,120,0.6)', OL, 0.6); line('rgba(255,255,255,0.75)', 0.7, [[cx - 1.3, ey - 1.2], [cx - 0.3, ey - 1.9]]); }
  };
  A.shoe.glitterShoes = (K, lx) => { const { circ, done, t } = K; boot(K, lx, 3.8, '#e8b83a', 6.5, 'rgba(0,0,0,0.3)'); for (let i = 0; i < 4; i++) { const k = Math.sin(t * 5 + i * 1.7 + lx); if (k < 0.3) continue; circ(lx - 2 + i * 2.2, -2.4 + (i % 2), 0.6 * k); done('#ffffff', null); } };
  A.effect.confetti = (K, back) => {
    if (back) return; const { rect } = K, C = ['#ffd25a', '#ff4f9a', '#3ae8ff', '#f4f1ff', '#b45cff'];
    fall(K, 12, 0.32, (i, p) => { K.g.rotate(K.t * 3 + i); K.g.scale(1, Math.cos(K.t * 6 + i)); rect(C[i % C.length], -1.5, -0.9, 3, 1.8); });
  };

  // ======================= Lantern Festival =======================
  A.hat.tasselCap = (K, e, top) => {
    const { g, P, done, lin, rr, circ, line, rect, HY, R, OL, t } = K;
    P(); g.arc(0, HY - 4, R + 1.2, PI, 0); g.closePath(); done(lin('#d42a2a', top - 2, HY - 4));
    for (const dx of [-7, 0, 7]) { P(); g.moveTo(dx * 0.3, top - 1); g.quadraticCurveTo(dx * 1.1, HY - 12, dx, HY - 7); g.strokeStyle = 'rgba(90,0,0,0.35)'; g.lineWidth = 0.9; g.stroke(); }
    rr(-R - 2, HY - 8.5, (R + 2) * 2, 4.6, 2.2); done(lin('#f0c040', HY - 8.5, HY - 4)); for (let x = -R; x < R + 1; x += 3) rect('rgba(160,60,0,0.35)', x, HY - 7.2, 1.2, 1.2);
    circ(0, top - 1.6, 2.3); done('#f0c040', OL, 0.8);
    const sw = Math.sin(t * 2.4) * 0.18; line(OL, 2.2, [[0, top - 1.6], [R - 1, HY - 8]]); line('#d42a2a', 1.1, [[0, top - 1.6], [R - 1, HY - 8]]); g.save(); g.translate(R - 1, HY - 8); g.rotate(-0.25 + sw); line(OL, 2.2, [[0, 0], [0, 7]]); line('#d42a2a', 1.1, [[0, 0], [0, 7]]);
    P(); g.moveTo(-1.8, 7); g.lineTo(1.8, 7); g.lineTo(2.6, 14); g.lineTo(-2.6, 14); g.closePath(); done('#f0c040', OL, 0.7); g.restore();
  };
  A.OUTFITS.silkJacket = { c: '#c8202a', d: 'silk' };
  A.details.silk = (K, b, dark, light) => {
    const { rect, rr, done, line, P, g, OL } = K;
    rect('#f0c040', -20, -32.5, 40, 3); line(dark, 0.9, [[1.5, -29.5], [1.5, b + 1]]);
    for (let i = 0; i < 4; i++) { const y = -26 + i * 4.6; line(OL, 2.2, [[-3.5, y], [4.5, y]]); line('#f0c040', 1.1, [[-3.5, y], [4.5, y]]); K.circ(-3.8, y, 1); done('#f0c040', OL, 0.5); K.circ(4.8, y, 1); done('#f0c040', OL, 0.5); }
    rect('#f0c040', -20, b - 3, 40, 2.4);
    for (const x of [-9, 9]) { P(); g.arc(x, -15, 2.2, PI, PI * 2.3); g.arc(x + 2.6, -14.6, 1.6, PI, PI * 2.2); g.strokeStyle = light; g.lineWidth = 0.9; g.stroke(); }
  };
  A.hand.paperLantern = (K) => {
    const { g, line, ell, done, lin, rr, OL, t } = K;
    g.rotate(0.35); line(OL, 2.6, [[0, 3], [0, -16]]); line('#8a5a34', 1.3, [[0, 3], [0, -16]]); line('#5a3a20', 0.8, [[0, -16], [4, -17]]);
    const sw = Math.sin(t * 2) * 0.12; g.translate(4, -17); g.rotate(sw); line('#3a2414', 0.7, [[0, 0], [0, 3]]);
    g.save(); glow(g, 'rgba(255,90,50,0.9)', 10); ell(0, 9, 6, 6.2); done(lin('#ff4a3a', 3, 15, 0.35, -0.2)); g.restore();
    ell(0, 9, 6, 6.2); done(null, OL, 1); for (const k of [-3, 0, 3]) { K.P(); g.ellipse(0, 9, Math.abs(k) + 0.6, 6.1, 0, 0, TAU); g.strokeStyle = 'rgba(120,10,10,0.45)'; g.lineWidth = 0.6; g.stroke(); }
    rr(-3, 2.4, 6, 1.8, 0.6); done('#f0c040', OL, 0.6); rr(-3, 14.6, 6, 1.8, 0.6); done('#f0c040', OL, 0.6); line('#f0c040', 1.2, [[0, 16.4], [0, 20]]);
  };
  A.hand.paperFan = (K) => {
    const { g, P, done, line, circ, OL, t } = K;
    g.rotate(-0.3 + Math.sin(t * 4) * 0.12); P(); g.moveTo(0, 0); g.arc(0, 0, 13, -PI * 0.85, -PI * 0.15); g.closePath(); done('#fff4f0');
    for (let k = 0; k <= 8; k++) { const a = -PI * 0.85 + k * PI * 0.7 / 8; line('rgba(140,60,40,0.5)', 0.6, [[0, 0], [Math.cos(a) * 13, Math.sin(a) * 13]]); }
    P(); g.arc(0, 0, 13, -PI * 0.85, -PI * 0.15); g.strokeStyle = '#d42a2a'; g.lineWidth = 1.6; g.stroke();
    for (const [x, y] of [[-5, -8], [3, -10], [6, -6]]) for (let k = 0; k < 5; k++) { circ(x + Math.cos(k * 1.26) * 1.2, y + Math.sin(k * 1.26) * 1.2, 1); done('#ff8fb4', null); }
    circ(0, 0, 1.2); done('#5a3a20', OL, 0.5);
  };
  A.shoe.silkSlippers = (K, lx) => { boot(K, lx, 2.8, '#c8202a', 6.6, '#3a1010'); K.line('#f0c040', 0.9, [[lx - 1, -1.8], [lx + 1.5, -2.6], [lx + 4, -1.8]]); };
  A.effect.skyLanterns = (K, back) => {
    if (back) return; const { g, rr, done } = K;
    rise(K, 5, 0.12, (i, p) => { g.rotate(Math.sin(K.t + i) * 0.1); g.save(); glow(g, 'rgba(255,150,60,0.9)', 8); rr(-2.4, -3.2, 4.8, 5.8, 1.6); done(i % 2 ? '#ff7a3a' : '#ffb04a', 'rgba(90,20,0,0.7)', 0.6); g.restore(); K.circ(0, 3.2, 0.9); done('#fff2b0', null); }, 22);
  };

  // ======================= Carnival =======================
  A.OPEN_TOP.plumeHeaddress = 1;
  A.hat.plumeHeaddress = (K, e, top) => {
    const { g, ell, done, lin, line, circ, HY, OL, t } = K;
    const C = ['#2f9a4a', '#b45cff', '#ffd23f', '#b45cff', '#2f9a4a', '#ffd23f', '#b45cff'];
    for (let i = 0; i < 7; i++) { const a = -PI / 2 + (i - 3) * 0.32 + Math.sin(t * 2 + i) * 0.04; g.save(); g.translate(0, top + 4); g.rotate(a + PI / 2); ell(0, -14, 3.4, 12); done(lin(C[i], -26, -2)); line('rgba(255,255,255,0.6)', 0.6, [[0, -3], [0, -24]]); g.restore(); }
    band(K, '#ffd23f', 2.6); for (const [x, c] of [[-6, '#3ae8ff'], [0, '#ff4f9a'], [6, '#3ae8ff']]) { circ(x, top + 2.2 + Math.abs(x) * 0.2, x ? 1.4 : 2.2); done(c, OL, 0.6); }
  };
  A.OUTFITS.harlequin = { c: '#7a3ab0', d: 'harlequin', sleeve: '#2f8a4a' };
  A.details.harlequin = (K, b) => {
    const { poly, done, rect, g, P, OL } = K;
    for (let r = 0; r < 7; r++) for (let c = -4; c <= 4; c++) { const x = c * 5 + (r % 2) * 2.5, y = -30 + r * 4.2; if ((r + c) % 2) continue; poly([[x, y - 2.8], [x + 2.5, y], [x, y + 2.8], [x - 2.5, y]]); done((r + c) % 4 === 0 ? '#2f8a4a' : '#ffd23f', null); }
    P(); for (let i = 0; i < 7; i++) g.arc(-7.5 + i * 2.5, -31.5, 1.9, 0, PI); done('#fbf8f0', OL, 0.6);
    rect('rgba(0,0,0,0.25)', -20, b - 2.4, 40, 2.4);
  };
  A.face.carnivalMask = (K, e, ey, L, Rt) => {
    const { g, P, done, lin, ell, line, circ, OL, t, R } = K;
    P(); g.moveTo(-R + 0.5, ey - 2); g.quadraticCurveTo(L - 1, ey - 7.5, -0.4, ey - 2.6); g.quadraticCurveTo(Rt + 1, ey - 7.5, R - 0.5, ey - 2); g.quadraticCurveTo(R - 1, ey + 3.5, Rt + 1, ey + 3.4); g.quadraticCurveTo(1, ey + 4, 0, ey + 1.6); g.quadraticCurveTo(-1, ey + 4, L - 1, ey + 3.4); g.quadraticCurveTo(-R + 1, ey + 3.5, -R + 0.5, ey - 2); g.closePath();
    done(lin('#b45cff', ey - 7, ey + 4)); for (const cx of [L, Rt]) { ell(cx, ey, 2.7, 2); done('#1a1020', OL, 0.6); }
    for (let i = 0; i < 6; i++) { const k = Math.sin(t * 5 + i * 1.9); if (k < 0.2) continue; circ(-9 + i * 3.6, ey - 3.6 + (i % 2) * 5.4, 0.55); done('#fff6c8', null); }
    g.save(); g.translate(R - 2, ey - 3); g.rotate(0.5 + Math.sin(t * 2) * 0.08); ell(3, -8, 2.4, 8.5); done(lin('#2f9a4a', -16, 0)); line('rgba(255,255,255,0.6)', 0.5, [[3, -1], [3, -15]]); ell(-0.5, -7, 1.8, 6.5, -0.25); done(lin('#ffd23f', -13, 0)); g.restore();
    circ(R - 2, ey - 3, 1.5); done('#ff4f9a', OL, 0.6);
  };
  A.chest.beads = (K) => {
    const { circ, done, g, SW } = K, C = ['#b45cff', '#2f9a4a', '#ffd23f'];
    C.forEach((c, k) => { const ry = 7 + k * 2.6, rx = SW * 0.55 + k * 0.6; for (let i = 0; i <= 12; i++) { const a = PI * (0.08 + i * 0.84 / 12); circ(Math.cos(a) * rx * (k % 2 ? 1 : 0.95), -32 + Math.sin(a) * ry, 1.05); done(c, 'rgba(0,0,0,0.45)', 0.4); } });
    void g;
  };
  A.effect.streamers = (K, back) => {
    const { g, t } = K, C = ['#ffd23f', '#b45cff', '#2f9a4a', '#ff4f9a'];
    for (let i = 0; i < 4; i++) {
      if (!back) return; const a0 = t * 0.9 + i * PI / 2;
      g.beginPath(); for (let k = 0; k <= 14; k++) { const a = a0 + k * 0.12, x = Math.cos(a) * (20 - k * 0.3), y = -70 + i * 6 + k * 3.6 + Math.sin(t * 3 + k * 0.8 + i) * 2; if (k) g.lineTo(x, y); else g.moveTo(x, y); }
      g.strokeStyle = C[i]; g.lineWidth = 1.6; g.lineCap = 'round'; g.stroke();
    }
  };

  // ======================= Neon Nights =======================
  A.OPEN_TOP.neonVisor = 1;
  A.hat.neonVisor = (K, e) => {
    const { g, P, done, HY, R, OL, t } = K;
    band(K, '#2a1440', 2.6);
    const k = 0.7 + 0.3 * Math.sin(t * 4); g.save(); glow(g, '#ff3ad1', 8 * k);
    P(); g.moveTo(-R - 1, HY - 8); g.quadraticCurveTo(0, HY - 11, R + 1, HY - 8); g.lineTo(R + 4 + e * 0.5, HY - 4.5); g.quadraticCurveTo(0, HY - 1.5, -R - 4 + e * 0.5, HY - 4.5); g.closePath();
    done(`rgba(255,58,209,${0.45 * k + 0.2})`, '#3ae8ff', 1.4); g.restore();
    K.line('rgba(255,255,255,0.7)', 0.9, [[-8, HY - 7.6], [-3, HY - 8.4]]); void OL;
  };
  A.OUTFITS.glowJacket = { c: '#1a1430', d: 'glow' };
  A.details.glow = (K, b) => {
    const { g, line, rr, done, t } = K, k = 0.65 + 0.35 * Math.sin(t * 3);
    g.save(); glow(g, '#3ae8ff', 6 * k); line('#3ae8ff', 1.1, [[0.8, -31], [0.8, b + 1]]); line('#3ae8ff', 1, [[-20, b - 3], [20, b - 3]]); g.restore();
    g.save(); glow(g, '#ff3ad1', 6 * k); line('#ff3ad1', 1, [[-10, -30], [-4, -20], [-10, -12]]); line('#ff3ad1', 1, [[11, -30], [5, -20], [11, -12]]); g.restore();
    rr(-9, -18, 6, 4.5, 1); done(null, `rgba(255,58,209,${k})`, 0.8); rr(4, -18, 6, 4.5, 1); done(null, `rgba(255,58,209,${k})`, 0.8);
  };
  A.hand.glowSticks = (K) => {
    const { g, rr, done, t } = K;
    for (const [rot, c] of [[-0.45, '#7aff5a'], [0.35, '#ff3ad1']]) { g.save(); g.rotate(rot + Math.sin(t * 6) * 0.12); glow(g, c, 9); rr(-1.3, -15, 2.6, 15, 1.3); done(c, 'rgba(0,0,0,0.5)', 0.6); g.restore(); }
  };
  A.face.shutterShades = (K, e, ey, L, Rt) => {
    const { rr, done, line, OL } = K;
    for (const cx of [L, Rt]) { rr(cx - 4, ey - 3.2, 8, 5.6, 1.4); done('rgba(30,10,40,0.35)', '#ff3ad1', 1.4); for (let k = 0; k < 4; k++) line('#ff3ad1', 0.9, [[cx - 3.6, ey - 2.2 + k * 1.3], [cx + 3.6, ey - 2.2 + k * 1.3]]); }
    line('#ff3ad1', 1.3, [[L + 4, ey - 1], [Rt - 4, ey - 1]]); line(OL, 0.8, [[-K.R + 0.5, ey - 1.5], [L - 4, ey - 1]]); line(OL, 0.8, [[K.R - 0.5, ey - 1.5], [Rt + 4, ey - 1]]);
  };
  A.shoe.lightUpKicks = (K, lx) => {
    const { rect, g, t } = K; boot(K, lx, 4.2, '#f4f4fa', 6.6);
    const C = ['#ff3ad1', '#3ae8ff', '#7aff5a', '#ffd23f'], c = C[Math.floor(t * 4 + lx) & 3];
    g.save(); glow(g, c, 6); rect(c, lx - 3.8, -1.4, 10.4, 1.7); g.restore(); K.line('#3ae8ff', 0.8, [[lx - 1.6, -3.6], [lx + 2.4, -2.6]]);
  };
  A.effect.neonRings = (K, back) => {
    const { g, t } = K, C = ['#ff3ad1', '#3ae8ff', '#b45cff'];
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.35 + i / 3) % 1, y = -2 - p * 26, r = 16 + Math.sin(p * PI) * 3;
      g.save(); g.globalAlpha *= fadeOf(p) * 0.9; glow(g, C[i], 6); g.beginPath(); g.ellipse(0, y, r, r * 0.26, 0, back ? PI : 0, back ? TAU : PI); g.strokeStyle = C[i]; g.lineWidth = 1.2; g.stroke(); g.restore();
    }
  };

  // ======================= Lucky Clover =======================
  A.hat.cloverHat = (K, e, top) => {
    const { g, ell, done, lin, rr, rect, OL, HY } = K;
    g.save(); g.translate(1.5, 0); g.rotate(0.08);
    ell(0, HY - 8.5, 15.5, 3.2); done(lin('#1f8a4a', HY - 12, HY - 5));
    rr(-8.5, top - 12, 17, 17.5, 2.4); done(lin('#2ecc71', top - 12, top + 6)); rect('#16141c', -8.5, top + 0.4, 17, 3.6);
    rr(-2.6, top - 0.2, 5.2, 4.8, 0.8); done(null, '#ffd25a', 1.3);
    clover(K, 5, top - 6, 2.4, '#7aff7a'); g.restore(); void OL;
  };
  A.OUTFITS.luckyVest = { c: '#f4f1ea', d: 'lucky', sleeve: '#f4f1ea' };
  A.details.lucky = (K, b) => {
    const { poly, done, lin, circ, OL, line } = K;
    for (const sx of [-1, 1]) { poly([[sx * 3.4, -31], [sx * 16, -31], [sx * 16, b + 1], [sx * 1.4, b + 1], [sx * 1.4, -21]]); done(lin('#1f8a4a', -31, b), OL, 0.8); }
    for (let i = 0; i < 3; i++) { circ(-2.6, -18 + i * 3.6, 0.9); done('#ffd25a', OL, 0.4); }
    poly([[0, -29.6], [-3.6, -31.8], [-3.6, -27.6]]); done('#2ecc71', OL, 0.5); poly([[0, -29.6], [3.6, -31.8], [3.6, -27.6]]); done('#2ecc71', OL, 0.5); circ(0, -29.6, 1); done('#1f8a4a', OL, 0.4);
    clover(K, 7.5, -25, 1.9, '#7aff7a'); line('rgba(0,0,0,0.25)', 0.7, [[-9, -14], [-5, -14]]);
  };
  A.hand.potOfGold = (K) => {
    const { g, P, done, lin, circ, ell, OL, t } = K;
    P(); g.arc(0, -7, 6.5, 1.2 * PI, 1.8 * PI, true); g.strokeStyle = OL; g.lineWidth = 2.4; g.stroke(); g.strokeStyle = '#5a5a66'; g.lineWidth = 1.1; g.stroke();
    for (const [x, y] of [[-3.5, -8], [0, -9.4], [3.4, -8], [-1.8, -10.6], [1.9, -10.8], [0, -12.2]]) coin(K, x, y, 1.9);
    P(); g.moveTo(-6, -7); g.quadraticCurveTo(-7.5, 1, -3, 2); g.lineTo(3, 2); g.quadraticCurveTo(7.5, 1, 6, -7); g.closePath(); done(lin('#3a3a44', -7, 2));
    ell(0, -7, 6.4, 1.8); done('#24242c', OL, 0.8); const k = Math.sin(t * 4); if (k > 0.4) { g.save(); glow(g, '#fff6c8', 6); starPath(g, 4, -14, 1.6 * k, 0.3); g.fillStyle = '#fff6c8'; g.fill(); g.restore(); }
    void circ;
  };
  A.chest.rainbowScarf = (K) => {
    const { g, rr, done, rect } = K, C = ['#ff4a4a', '#ff9a3a', '#ffd23f', '#2ecc71', '#3aa0ff', '#8a5aff'];
    rr(-11.5, -33.5, 23, 6, 3); done('#ff4a4a'); g.save(); rr(-11.5, -33.5, 23, 6, 3); g.clip(); C.forEach((c, i) => rect(c, -12 + i * 4, -34, 4, 7)); g.restore(); rr(-11.5, -33.5, 23, 6, 3); done(null);
    rr(3.5, -29.5, 6, 17, 2.4); done('#ff4a4a'); g.save(); rr(3.5, -29.5, 6, 17, 2.4); g.clip(); C.forEach((c, i) => rect(c, 3, -29.5 + i * 2.85, 7, 2.9)); g.restore(); rr(3.5, -29.5, 6, 17, 2.4); done(null);
    for (let i = 0; i < 4; i++) K.line(C[i + 1], 0.9, [[4.2 + i * 1.5, -12.6], [4.2 + i * 1.5, -10.6]]);
  };
  A.shoe.buckleShoes = (K, lx) => { const { rr, done } = K; boot(K, lx, 4, '#1c1c24', 6.6, 'rgba(255,255,255,0.12)'); rr(lx - 0.4, -3.8, 4, 3, 0.5); done(null, '#ffd25a', 1.2); };
  A.effect.luckyClovers = (K, back) => { if (back) return; fall(K, 7, 0.2, (i) => { K.g.rotate(K.t * 1.5 + i); clover(K, 0, 0, 2.2, i % 3 ? '#2ecc71' : '#7aff7a'); }); };

  // ======================= Green Earth =======================
  A.OPEN_TOP.leafCrown = 1;
  A.hat.leafCrown = (K) => {
    const { g, ell, done, lin, line, HY, R } = K;
    for (let i = 0; i < 11; i++) { const a = PI * (1.02 + i * 0.096), x = Math.cos(a) * (R + 0.6), y = HY - 2 + Math.sin(a) * (R - 2.5); g.save(); g.translate(x, y); g.rotate(a + PI / 2 + (i % 2 ? 0.5 : -0.5)); ell(0, -2.6, 2, 4); done(lin(i % 3 ? '#4aa83a' : '#7ad04a', -6.6, 1.4)); line('rgba(20,60,20,0.5)', 0.5, [[0, 0.8], [0, -5.6]]); g.restore(); }
  };
  A.OUTFITS.planterApron = { d: 'planter' };
  A.details.planter = (K, b) => {
    const { rr, done, lin, line, ell, rect, OL } = K;
    rr(-8, -26, 16, 30, 2.4); done(lin('#c9b48a', -26, 4)); line('#8a6a3a', 2.2, [[-6.5, -32], [-6.5, -25]]); line('#8a6a3a', 2.2, [[6.5, -32], [6.5, -25]]); rect('#8a6a3a', -20, -18, 40, 1.8);
    rr(-5, -14, 10, 7, 1.4); done(lin('#b39a6a', -14, -7)); line('#3a7a2a', 0.9, [[0, -9.5], [0, -13]]); ell(-1.6, -13.4, 1.8, 1, -0.5); done('#5ab03a', OL, 0.4); ell(1.6, -13.8, 1.8, 1, 0.5); done('#5ab03a', OL, 0.4);
    ell(-4, -21, 2.4, 1.2); done('rgba(90,60,30,0.35)', null);
  };
  A.hand.seedling = (K) => {
    const { g, poly, done, lin, rect, line, ell, OL, t } = K;
    poly([[-4.5, -9], [4.5, -9], [3.2, 0], [-3.2, 0]]); done(lin('#d0703a', -9, 0)); rect('#b85a2a', -5, -10, 10, 2); K.rr(-5, -10.2, 10, 2.4, 0.8); done(null, OL, 0.8); ell(0, -9.6, 4, 0.9); done('#4a2a14', null);
    g.save(); g.translate(0, -10); g.rotate(Math.sin(t * 2) * 0.1); line('#3a8a2a', 1.1, [[0, 0], [0, -6]]); ell(-2.6, -6.4, 2.8, 1.4, -0.4); done('#6ac04a', OL, 0.6); ell(2.6, -7, 2.8, 1.4, 0.4); done('#6ac04a', OL, 0.6); g.restore();
  };
  A.hand.wateringCan = (K) => {
    const { g, rr, done, lin, line, P, circ, OL, t } = K;
    g.rotate(-0.25); rr(-5, -10, 10, 9, 2); done(lin('#3aa05a', -10, -1));
    line(OL, 2.6, [[4, -4], [12, -11]]); line('#3aa05a', 1.4, [[4, -4], [12, -11]]); rr(10.5, -13.5, 4, 3.2, 1); done('#2a7a4a', OL, 0.7);
    P(); g.arc(-2, -10, 4, PI, 0); g.strokeStyle = OL; g.lineWidth = 2.2; g.stroke(); g.strokeStyle = '#3aa05a'; g.lineWidth = 1; g.stroke();
    for (let k = 0; k < 3; k++) { const p = (t * 1.2 + k / 3) % 1; circ(13.5 + k * 0.8, -10 + p * 9, 0.7); done(`rgba(90,190,255,${1 - p})`, null); }
  };
  A.shoe.gardenClogs = (K, lx) => { const { P, g, done, lin } = K; P(); g.moveTo(lx - 3.8, -4.2); g.quadraticCurveTo(lx + 2, -5.6, lx + 5.6, -3); g.quadraticCurveTo(lx + 7, -1.6, lx + 6.6, 0.3); g.lineTo(lx - 3.8, 0.3); g.closePath(); done(lin('#4aa83a', -5, 0)); for (let i = 0; i < 3; i++) { K.circ(lx + i * 1.8, -3, 0.5); done('rgba(0,0,0,0.35)', null); } };
  A.effect.seedPuffs = (K, back) => {
    if (back) return; const { g, line, t } = K;
    for (let i = 0; i < 6; i++) { const p = (t * 0.14 + i / 6) % 1, x = -24 + p * 50 + Math.sin(i * 3) * 4, y = -70 + i * 9 + Math.sin(t * 1.5 + i) * 4; g.save(); g.globalAlpha *= fadeOf(p); g.translate(x, y); g.rotate(Math.sin(t + i) * 0.4); line('#d8d0b8', 0.6, [[0, 0], [0, 3.4]]); for (let k = 0; k < 7; k++) { const a = -PI * 0.95 + k * PI * 0.9 / 6; line('rgba(255,255,255,0.9)', 0.5, [[0, 0], [Math.cos(a) * 2.6, Math.sin(a) * 2.6]]); } g.restore(); }
  };

  // ======================= Fiesta Flowers =======================
  A.OPEN_TOP.paperFlower = 1;
  const paperFlower = (K, x, y, r, c, mid) => { const { g, ell, done, circ, OL } = K; for (let k = 0; k < 8; k++) { g.save(); g.translate(x, y); g.rotate(k * PI / 4); ell(0, -r * 0.55, r * 0.42, r * 0.6); done(c, OL, 0.6); g.restore(); } for (let k = 0; k < 6; k++) { g.save(); g.translate(x, y); g.rotate(k * PI / 3 + 0.3); ell(0, -r * 0.3, r * 0.3, r * 0.4); done(K.sh(c, 0.25), null); g.restore(); } circ(x, y, r * 0.26); done(mid, OL, 0.6); };
  A.hat.paperFlower = (K) => { const { HY, R } = K; paperFlower(K, -R + 2, HY - 10, 9, '#ff5a9a', '#ffd23f'); paperFlower(K, -R + 10, HY - 13, 5, '#ffd23f', '#ff7a1a'); paperFlower(K, -R - 3, HY - 2, 4.4, '#3ad0c0', '#ff5a9a'); };
  A.OUTFITS.fiestaShirt = { c: '#f8f4ea', d: 'fiesta' };
  A.details.fiesta = (K, b) => {
    const { line, circ, done, rect, OL } = K, C = ['#ff5a9a', '#3ad0c0', '#ffd23f', '#ff7a1a'];
    for (const x of [-5, 5]) { line(C[x > 0 ? 1 : 0], 1.4, [[x, -31], [x, b]]); for (let y = -28; y < b; y += 4.5) { const c = C[Math.abs(Math.round(y)) % 4]; for (let k = 0; k < 5; k++) { circ(x + Math.cos(k * 1.26) * 1.4, y + Math.sin(k * 1.26) * 1.4, 0.9); done(c, null); } circ(x, y, 0.6); done('#ffffff', null); } }
    line('#ff7a1a', 1, [[-20, -26], [-16, -28], [-12, -26], [-8, -28]]); line('#ff7a1a', 1, [[8, -28], [12, -26], [16, -28], [20, -26]]);
    for (let i = 0; i < 3; i++) { circ(0, -24 + i * 5, 0.8); done('#c9c3b5', OL, 0.3); } rect('rgba(255,90,154,0.8)', -20, b - 2.4, 40, 2.4);
  };
  A.hand.maracas = (K) => {
    const { g, line, ell, done, lin, OL, t } = K, sh = Math.sin(t * 14) * 0.16;
    for (const [rot, c, s] of [[-0.5, '#ff5a9a', '#ffd23f'], [0.35, '#3ad0c0', '#ff7a1a']]) { g.save(); g.rotate(rot + sh); line(OL, 2.4, [[0, 3], [0, -6]]); line('#c98a4a', 1.2, [[0, 3], [0, -6]]); ell(0, -11, 4.2, 5.4); done(lin(c, -16, -6)); K.line(s, 1.1, [[-3.6, -11], [3.6, -11]]); K.line(s, 0.8, [[-3, -13.6], [3, -13.6]]); g.restore(); }
  };
  A.hand.pinata = (K) => {
    const { g, line, poly, done, OL, t, circ } = K;
    g.rotate(0.4); line(OL, 2.4, [[0, 3], [0, -14]]); line('#c98a4a', 1.1, [[0, 3], [0, -14]]);
    const sw = Math.sin(t * 2.5) * 0.25; g.translate(0, -14); g.rotate(sw - 0.4); line('#5a3a20', 0.6, [[0, 0], [0, 6]]); g.translate(0, 11);
    const C = ['#ff5a9a', '#ffd23f', '#3ad0c0', '#ff7a1a', '#b45cff'];
    for (let k = 0; k < 5; k++) { const a = -PI / 2 + k * TAU / 5; g.save(); g.rotate(a + PI / 2); poly([[-2.2, -3], [2.2, -3], [0, -9]]); done(C[k], OL, 0.6); line(C[(k + 2) % 5], 0.8, [[-0.2, -9], [0.4, -11.5]]); g.restore(); }
    circ(0, 0, 4.2); done('#ffd23f', OL, 0.8); circ(0, 0, 2); done('#ff5a9a', null);
  };
  A.effect.paperFlags = (K, back) => {
    if (back) return; const { g, poly, done, t } = K, C = ['#ff5a9a', '#3ad0c0', '#ffd23f', '#ff7a1a', '#b45cff', '#7ad04a'];
    g.beginPath(); for (let x = -24; x <= 24; x += 2) g.lineTo(x, -82 + (x * x) / 110); g.strokeStyle = '#5a3a20'; g.lineWidth = 0.7; g.stroke();
    for (let i = 0; i < 6; i++) { const x = -20 + i * 8, y = -82 + (x * x) / 110, sw = Math.sin(t * 3 + i) * 0.15; g.save(); g.translate(x, y); g.rotate(sw); poly([[-3, 0], [3, 0], [3, 6], [1.5, 7.4], [0, 6], [-1.5, 7.4], [-3, 6]]); done(C[i], 'rgba(0,0,0,0.4)', 0.5); K.circ(0, 3.2, 0.9); done('rgba(255,255,255,0.7)', null); g.restore(); }
  };

  // ======================= Dino Days =======================
  A.HIDE_HAIR.dinoHood = 1;
  A.hatBack.dinoHood = (K) => { const { ell, done, lin, HY, R } = K; ell(0, HY - 1, R + 4.5, R + 4.5); done(lin('#4a9a34', HY - 18, HY + 16)); };
  A.hat.dinoHood = (K, e, top) => {
    const { g, P, done, lin, poly, circ, HY, R, OL } = K;
    for (let i = 0; i < 4; i++) { const a = PI * (1.18 + i * 0.21), x = Math.cos(a) * (R + 4), y = HY - 1 + Math.sin(a) * (R + 4); g.save(); g.translate(x, y); g.rotate(a + PI / 2); poly([[-2.8, 1], [2.8, 1], [0, -5.5]]); done(lin('#ff9a3a', -5.5, 1)); g.restore(); }
    P(); g.arc(0, HY - 1, R + 4.5, PI * 0.9, PI * 2.1); g.arc(0, HY - 1, R + 0.6, PI * 2.04, PI * 0.96, true); g.closePath(); done(lin('#5aa83a', top - 5, HY + 6));
    for (let i = 0; i < 9; i++) { const a = PI * (1.06 + i * 0.11); poly([[Math.cos(a - 0.05) * (R + 0.7), HY - 1 + Math.sin(a - 0.05) * (R + 0.7)], [Math.cos(a + 0.05) * (R + 0.7), HY - 1 + Math.sin(a + 0.05) * (R + 0.7)], [Math.cos(a) * (R - 1.6), HY - 1 + Math.sin(a) * (R - 1.6)]]); done('#ffffff', OL, 0.5); }
    for (const sx of [-1, 1]) { circ(sx * 6 + e * 0.3, top - 2, 3.1); done('#ffffff', OL, 0.8); circ(sx * 6 + e * 0.5 + 0.6, top - 1.6, 1.5); done('#1a1020', null); }
  };
  A.OUTFITS.dinoOnesie = { c: '#5aa83a', d: 'dino' };
  A.details.dino = (K, b) => {
    const { ell, done, lin, line, circ } = K;
    ell(0, -16, 7, 14); done(lin('#f2e6b8', -30, -2)); for (let y = -26; y < b; y += 4) line('rgba(140,110,60,0.45)', 0.8, [[-5, y], [5, y]]);
    for (const [x, y, r] of [[-11, -26, 1.8], [-12, -18, 1.4], [11, -24, 1.6], [12, -15, 1.9], [-10, -11, 1.2]]) { circ(x, y, r); done('#3a7a24', null); }
  };
  A.back.dinoTail = (K) => {
    const { g, P, done, lin, poly, t } = K, sw = Math.sin(t * 2.6) * 0.12;
    g.save(); g.translate(-4, -12); g.rotate(sw);
    P(); g.moveTo(0, -5); g.quadraticCurveTo(-14, -6, -24, 6); g.quadraticCurveTo(-13, 3, 0, 5); g.closePath(); done(lin('#5aa83a', -6, 6));
    for (let i = 0; i < 4; i++) { const x = -4 - i * 5, y = -5 + i * 2.6; poly([[x + 2, y + 0.6], [x - 2, y + 1.4], [x - 0.6, y - 3.4 + i * 0.4]]); done('#ff9a3a', K.OL, 0.6); }
    g.restore();
  };
  A.hand.fossilBone = (K) => {
    const { g, rr, done, circ, OL } = K;
    g.rotate(0.5); rr(-1.8, -14, 3.6, 14, 1.6); done('#f2ead2'); for (const y of [-15, 1]) for (const sx of [-1, 1]) { circ(sx * 2, y, 2.4); done('#f2ead2', OL, 1); } rr(-1.2, -13.5, 2.4, 13, 1); done('#f2ead2', null);
    K.line('rgba(150,120,80,0.6)', 0.6, [[-0.6, -10], [0.6, -8]]); K.line('rgba(150,120,80,0.6)', 0.6, [[0.4, -5], [-0.6, -3.5]]);
  };
  A.shoe.dinoFeet = (K, lx) => { const { P, g, done, lin, poly } = K; P(); g.moveTo(lx - 4, -5); g.quadraticCurveTo(lx + 3, -6.4, lx + 6.2, -2.6); g.lineTo(lx + 6.6, 0.4); g.lineTo(lx - 4, 0.4); g.closePath(); done(lin('#5aa83a', -6, 0)); for (let i = 0; i < 3; i++) { const x = lx + 2.6 + i * 1.9; poly([[x - 0.9, 0.2], [x + 0.9, 0.2], [x + 1.6, 1.6]]); done('#ffffff', K.OL, 0.5); } };
  A.effect.pterodactyls = (K, back) => {
    orbit(K, back, 2, 0.8, 21, -70, 5, (i) => {
      const { g, P, done, t } = K, fl = Math.sin(t * 9 + i * 2) * 3; g.scale(Math.cos(t * 0.8 + i * PI) > 0 ? -1 : 1, 1);
      P(); g.moveTo(-1, 0); g.lineTo(-8, -1.5 - fl); g.lineTo(-3, 1.6); g.lineTo(3, 1.6); g.lineTo(8, -1.5 - fl); g.lineTo(1, 0); g.closePath(); done('#a86a3a', K.OL, 0.6);
      K.ell(0, 0.8, 1.8, 1.4); done('#c4844a', K.OL, 0.5); K.poly([[1.4, -0.2], [5, -0.6], [1.4, 1.2]]); done('#ffb04a', K.OL, 0.4); K.poly([[-1.4, 0], [-4, -2.6], [-0.6, -0.8]]); done('#c4844a', K.OL, 0.4);
    });
  };

  // ======================= Deep Sea =======================
  A.hat.octopusHat = (K, e, top) => {
    const { g, P, done, lin, circ, ell, line, HY, R, OL, t } = K;
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) {
      const x0 = sx * (R - 3 - k * 3), w = Math.sin(t * 2 + k + sx) * 1.5; P(); g.moveTo(x0 - 1.8, HY - 7); g.quadraticCurveTo(x0 + sx * (5 + k * 2) + w, HY - 1 + k * 3, x0 + sx * (3 + k) + w, HY + 5 + k * 2); g.quadraticCurveTo(x0 + sx * (6 + k) + w, HY + 6 + k * 2, x0 + sx * (6.5 + k) + w, HY + 3 + k * 2);
      g.quadraticCurveTo(x0 + sx * (8 + k * 2) + w, HY - 2, x0 + 1.8 * sx, HY - 7); g.closePath(); done(lin('#9a4ad0', HY - 7, HY + 6));
      circ(x0 + sx * (4 + k) + w * 0.5, HY + 0.5 + k * 2, 0.6); done('#f0c0ff', null);
    }
    ell(0, top + 2, R + 2, R - 1.5); done(lin('#b45cff', top - 10, HY - 3));
    for (const sx of [-1, 1]) { circ(sx * 4.4, top + 1, 2.6); done('#ffffff', OL, 0.8); circ(sx * 4.4 + 0.6, top + 1.4, 1.3); done('#1a1020', null); }
    P(); g.arc(0, top + 5, 2.4, 0.2, PI - 0.2); g.strokeStyle = OL; g.lineWidth = 1; g.stroke(); ell(-7.5, top + 4.6, 1.6, 0.9); done('rgba(255,120,200,0.5)', null); ell(7.5, top + 4.6, 1.6, 0.9); done('rgba(255,120,200,0.5)', null);
    line('rgba(255,255,255,0.5)', 1, [[-8, top - 3], [-4, top - 6]]);
  };
  A.OUTFITS.wetsuit = { c: '#1a1d26', d: 'wetsuit' };
  A.details.wetsuit = (K, b) => {
    const { poly, done, lin, line, rr, OL } = K;
    for (const sx of [-1, 1]) { poly([[sx * 20, -26], [sx * 9, -31], [sx * 6, -20], [sx * 10, b + 1], [sx * 20, b + 1]]); done(lin('#1ab0a8', -31, b), null); }
    line('#8a8f99', 1, [[0, -31.5], [0, b]]); rr(-1.2, -29, 2.4, 3.6, 0.8); done('#c4ccd2', OL, 0.5); line('#3ae8d0', 0.9, [[-7, -25], [-3, -25]]);
  };
  A.back.airTank = (K) => { const { rr, done, lin, rect, OL, SW } = K, x = SW - 3; rr(x, -44, 8.5, 32, 4.2); done(lin('#ffcf3f', -44, -12)); rect('rgba(0,0,0,0.18)', x + 0.5, -30, 7.5, 2); rr(x + 2.2, -48, 4, 4.5, 1); done('#8a8f99', OL, 0.8); rr(x + 1.2, -50, 6, 2, 0.8); done('#5a5f69', OL, 0.6); };
  A.SPOT.airTank = 'back';
  A.chest.airTank = (K) => { const { line, OL, SW } = K; for (const sx of [-1, 1]) { line(OL, 3, [[sx * (SW - 4), -31.5], [sx * (SW - 5), -15]]); line('#2a2f3a', 1.6, [[sx * (SW - 4), -31.5], [sx * (SW - 5), -15]]); } line(OL, 2.4, [[-SW + 5, -22], [SW - 5, -22]]); line('#2a2f3a', 1.2, [[-SW + 5, -22], [SW - 5, -22]]); };
  A.hand.trident = (K) => {
    const { g, line, OL, P } = K;
    g.rotate(0.12); line(OL, 3.2, [[0, 12], [0, -26]]); line('#e0b24a', 1.8, [[0, 12], [0, -26]]); line(OL, 3, [[-5, -26], [5, -26]]); line('#e0b24a', 1.6, [[-5, -26], [5, -26]]);
    for (const x of [-5, 0, 5]) { P(); g.moveTo(x - 1.5, -26); g.lineTo(x, -34 - (x ? 0 : 2)); g.lineTo(x + 1.5, -26); g.closePath(); g.fillStyle = '#ffd25a'; g.fill(); g.strokeStyle = OL; g.lineWidth = 0.9; g.stroke(); }
  };
  A.shoe.flippers = (K, lx) => { const { P, g, done, lin, line } = K; P(); g.moveTo(lx - 3.8, -4); g.lineTo(lx + 3, -4); g.lineTo(lx + 13, -1.6); g.quadraticCurveTo(lx + 14, 0.6, lx + 12, 1); g.lineTo(lx - 3.8, 0.6); g.closePath(); done(lin('#2a8aff', -4, 1)); line('rgba(255,255,255,0.4)', 0.7, [[lx + 4, -2.6], [lx + 11, -0.6]]); };
  A.effect.jellyfish = (K, back) => {
    orbit(K, back, 3, 0.5, 21, -38, 8, (i) => {
      const { g, P, done, line, t } = K, pulse = 1 + Math.sin(t * 3 + i) * 0.12, C = ['#ff7ad0', '#7ad8ff', '#c48aff'];
      g.translate(0, Math.sin(t * 1.6 + i * 2) * 8); g.scale(pulse, 1 / pulse); g.save(); glow(g, C[i], 7);
      P(); g.arc(0, 0, 4, PI, 0); g.quadraticCurveTo(0, 1.6, -4, 0); done(C[i] + 'cc', null); g.restore();
      for (let k = -2; k <= 2; k += 2) line(C[i], 0.6, [[k, 0.6], [k + Math.sin(t * 4 + k) * 1.2, 6]]);
    });
  };

  // ======================= Firework Fest =======================
  A.OPEN_TOP.sparklerCrown = 1;
  A.hat.sparklerCrown = (K, e, top) => {
    const { g, poly, done, lin, line, HY, t } = K;
    poly([[-11, HY - 7], [-11.5, top - 2], [11.5, top - 2], [11, HY - 7]]); done(lin('#1f2a6a', top - 2, HY - 7)); for (let x = -9; x < 10; x += 4.5) K.star(x, (top + HY - 9) / 2, 1.4, '#ffe680');
    for (let i = 0; i < 5; i++) { const x = -8 + i * 4, y0 = top - 2, y1 = top - 9 - (i % 2) * 3; line('#5a5f69', 1, [[x, y0], [x + (i - 2) * 0.8, y1]]);
      g.save(); glow(g, '#ffe680', 6); for (let k = 0; k < 6; k++) { const a = k * PI / 3 + t * 7 + i, r = 1.6 + ((t * 9 + k + i) % 1) * 2.2; line(k % 2 ? '#ffffff' : '#ffd25a', 0.6, [[x + (i - 2) * 0.8, y1], [x + (i - 2) * 0.8 + Math.cos(a) * r, y1 + Math.sin(a) * r]]); } g.restore(); }
  };
  A.OUTFITS.bandJacket = { c: '#c8202a', d: 'band' };
  A.details.band = (K, b) => {
    const { rect, line, circ, done, OL } = K;
    rect('#ffd25a', -20, -32.5, 40, 3); for (let i = 0; i < 5; i++) { const y = -27 + i * 3.6; line(OL, 2, [[-6, y], [6, y]]); line('#ffd25a', 1, [[-6, y], [6, y]]); circ(-6.4, y, 1); done('#ffd25a', OL, 0.4); circ(6.4, y, 1); done('#ffd25a', OL, 0.4); }
    rect('#f4f1ea', -20, b - 3.6, 40, 3); rect('#ffd25a', -20, b - 3.6, 40, 0.8);
  };
  A.hand.sparkler = (K) => {
    const { g, line, t } = K;
    g.rotate(0.3); line('#5a5f69', 1.2, [[0, 4], [0, -16]]); line('#8a8f99', 2.2, [[0, -8], [0, -16]]);
    g.save(); glow(g, '#ffe680', 10); for (let k = 0; k < 12; k++) { const a = k * PI / 6 + t * 5, r = 3 + ((t * 7 + k * 0.37) % 1) * 5; line(k % 3 ? '#ffd25a' : '#ffffff', 0.7, [[0, -16], [Math.cos(a) * r, -16 + Math.sin(a) * r]]); } K.circ(0, -16, 1.6); K.done('#ffffff', null); g.restore();
  };
  A.SPOT.snareDrum = 'chest';
  A.chest.snareDrum = (K) => {
    const { ell, done, lin, rr, line, OL, rect } = K;
    line(OL, 3, [[-9, -31], [7, -16]]); line('#f4f1ea', 1.6, [[-9, -31], [7, -16]]);
    rr(-9, -18, 18, 9, 1.5); done(lin('#f4f1ea', -18, -9)); for (let x = -7; x < 9; x += 3.4) line('#c4ccd2', 0.7, [[x, -17], [x + 1.7, -10]]);
    rect('#c8202a', -9, -18.6, 18, 1.6); rect('#c8202a', -9, -10.4, 18, 1.6); ell(0, -18, 9, 2); done('#fbf8f0', OL, 0.8);
    line(OL, 2.2, [[-6, -20], [-12, -27]]); line('#d9a866', 1.1, [[-6, -20], [-12, -27]]); line(OL, 2.2, [[5, -20], [11, -26]]); line('#d9a866', 1.1, [[5, -20], [11, -26]]);
  };
  A.shoe.bandBoots = (K, lx) => { boot(K, lx, 10, '#f4f1ea', 6.4, 'rgba(0,0,0,0.25)'); K.rect('#ffd25a', lx - 3.6, -10.4, 7, 1.4); K.line('#ffd25a', 1, [[lx + 3, -9.6], [lx + 4.4, -6]]); };
  A.effect.fireworkBursts = (K, back) => {
    if (back) return; const { g, t, line } = K, C = ['#ff4a5a', '#ffe680', '#3ae8ff', '#b45cff'];
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.45 + i / 3) % 1, x = [-14, 12, 0][i], y = [-74, -70, -84][i], r = 3 + p * 11, c = C[(i + Math.floor(t * 0.45 + i / 3)) % 4];
      if (p < 0.2) { const q = p / 0.2; line('rgba(255,240,200,0.7)', 0.8, [[x, y + 26 - q * 26], [x, y + 30 - q * 26]]); continue; }
      g.save(); g.globalAlpha *= 1 - p; glow(g, c, 6); for (let k = 0; k < 10; k++) { const a = k * TAU / 10; line(c, 0.9, [[x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55], [x + Math.cos(a) * r, y + Math.sin(a) * r]]); } g.restore();
    }
  };

  // ======================= Space Week =======================
  A.OPEN_TOP.alienBoppers = 1;
  A.hat.alienBoppers = (K, e, top) => {
    const { g, P, circ, done, t } = K; band(K, '#3ad04a', 2.2);
    for (const sx of [-1, 1]) { const bob = Math.sin(t * 4.5 + sx) * 1.6, hx = sx * 9 + bob * 0.3, hy = top - 12 + bob; P(); g.moveTo(sx * 6, top + 1.6); g.quadraticCurveTo(sx * 5, top - 6, hx, hy); g.strokeStyle = K.OL; g.lineWidth = 2.4; g.stroke(); g.strokeStyle = '#3ad04a'; g.lineWidth = 1.2; g.stroke();
      g.save(); glow(g, '#9aff5a', 8); circ(hx, hy, 2.8); done('#9aff5a', K.OL, 0.8); g.restore(); circ(hx - 0.8, hy - 0.8, 0.8); done('#ffffff', null); }
  };
  A.OUTFITS.flightSuit = { c: '#ff8a2a', d: 'flight' };
  A.details.flight = (K, b) => {
    const { line, circ, done, rr, rect, OL, star } = K;
    line('rgba(0,0,0,0.35)', 0.9, [[0.5, -31.5], [0.5, b]]); rr(-0.7, -30, 2.4, 3.2, 0.6); done('#c4ccd2', OL, 0.4);
    circ(-6, -24, 3.2); done('#1f3f8a', OL, 0.7); star(-6, -24, 1.7, '#ffd25a');
    rr(3, -26.5, 7, 3, 0.6); done('#f4f1ea', OL, 0.5); line('#1f3f8a', 0.6, [[4, -25], [8.6, -25]]);
    rr(3, -21.5, 6, 3.4, 0.6); done('#ffffff', OL, 0.5); rect('#3ae8ff', 3.4, -21, 5.2, 0.9); rect('#ff4a5a', 3.4, -19.6, 5.2, 0.9);
    rect('#5a5f69', -20, -14.5, 40, 2.2); rr(-1.6, -15, 3.2, 3.2, 0.6); done('#c4ccd2', OL, 0.5);
  };
  A.SPOT.jetpack = 'back';
  A.back.jetpack = (K) => {
    const { g, rr, done, lin, P, t, OL, SW } = K;
    for (const sx of [-1, 1]) {
      const x = sx * (SW + 1.2); // the tanks peek out past the shoulders
      rr(x - 4, -45, 8, 30, 4); done(lin('#c4ccd2', -45, -15)); K.rect('#ff4a5a', x - 4, -38, 8, 2.4); rr(x - 2.6, -48, 5.2, 4, 1.2); done('#ff4a5a', OL, 0.7); rr(x - 3, -16.5, 6, 3, 1); done('#5a5f69', OL, 0.7);
      const fl = 5 + Math.sin(t * 18 + sx) * 1.8; g.save(); glow(g, '#ff9a3a', 8); P(); g.moveTo(x - 2.6, -13.6); g.quadraticCurveTo(x, -13.6 + fl * 2, x + 2.6, -13.6); done('#ff9a3a', null); P(); g.moveTo(x - 1.3, -13.6); g.quadraticCurveTo(x, -13.6 + fl, x + 1.3, -13.6); done('#fff2a0', null); g.restore();
    }
  };
  A.chest.jetpack = (K) => { const { line, OL, SW } = K; for (const sx of [-1, 1]) { line(OL, 3, [[sx * (SW - 4), -31.5], [sx * (SW - 4.5), -18]]); line('#5a5f69', 1.6, [[sx * (SW - 4), -31.5], [sx * (SW - 4.5), -18]]); } K.rr(-3, -21, 6, 3.4, 1); K.done('#c4ccd2', OL, 0.7); };
  A.hand.pocketPlanet = (K) => {
    const { g, circ, done, lin, P, t } = K, y = -11 + Math.sin(t * 2.2) * 1.4;
    g.save(); glow(g, 'rgba(140,120,255,0.7)', 6); circ(0, y, 4.6); done(lin('#8a7aff', y - 5, y + 5, 0.3, -0.2)); g.restore();
    K.line('rgba(255,255,255,0.35)', 1, [[-3, y - 1.5], [2, y - 2.6]]);
    g.save(); g.translate(0, y); g.rotate(-0.3); P(); g.ellipse(0, 0, 8, 2.2, 0, 0, PI); g.strokeStyle = K.OL; g.lineWidth = 2; g.stroke(); g.strokeStyle = '#ffb04a'; g.lineWidth = 1; g.stroke(); g.restore();
  };
  A.shoe.moonBoots = (K, lx) => { const { rr, done, lin, rect } = K; rr(lx - 4.6, -8.6, 10.6, 9, 3); done(lin('#f4f4fa', -8.6, 0)); rect('#8a8f99', lx - 4.4, -1.4, 10.2, 1.4); for (let y = -6.6; y < -2; y += 2.2) K.line('rgba(120,130,150,0.45)', 0.7, [[lx - 3.6, y], [lx + 5, y]]); };
  A.effect.miniRockets = (K, back) => {
    orbit(K, back, 2, 1.1, 22, -34, 10, (i, a) => {
      const { g, rr, done, poly, circ, P } = K; g.rotate(a + PI); rr(-2, -5, 4, 9, 2); done(i ? '#f4f4fa' : '#ff4a5a', K.OL, 0.6); poly([[-2, -3], [0, -8], [2, -3]]); done(i ? '#ff4a5a' : '#f4f4fa', K.OL, 0.5); circ(0, -1, 1); done('#3ae8ff', null);
      g.save(); glow(g, '#ff9a3a', 5); P(); g.moveTo(-1.4, 4); g.quadraticCurveTo(0, 8 + Math.sin(K.t * 20) * 1.5, 1.4, 4); done('#ffd25a', null); g.restore();
    });
  };

  // ======================= Meteor Shower =======================
  A.OPEN_TOP.starCirclet = 1;
  A.hat.starCirclet = (K, e) => {
    const { g, P, HY, R, OL, t } = K;
    P(); g.ellipse(0, HY - 6, R + 0.6, 4.4, 0, PI * 0.95, PI * 2.05); g.strokeStyle = OL; g.lineWidth = 2.6; g.stroke(); g.strokeStyle = '#dfe6ee'; g.lineWidth = 1.3; g.stroke();
    const k = 0.75 + 0.25 * Math.sin(t * 3); g.save(); glow(g, '#bfe4ff', 9 * k); starPath(g, e * 0.3, HY - 11, 3.6, 0.42); g.fillStyle = '#eef8ff'; g.fill(); g.strokeStyle = OL; g.lineWidth = 0.8; g.stroke(); g.restore();
    for (const sx of [-1, 1]) K.star(sx * 7, HY - 9.4, 1.4, '#bfe4ff');
  };
  A.OUTFITS.stargazerCloak = { c: '#1f2a6a', len: 'r', d: 'stars' };
  A.behind.stargazerCloak = (K, b) => { const { poly, done, lin, SW } = K; poly([[-SW + 0.5, -31], [SW - 0.5, -31], [SW + 5, b + 3], [-SW - 5, b + 3]]); done(lin('#141c4a', -31, 0)); };
  A.details.stars = (K, b) => {
    const { line, circ, done, rect, t } = K;
    const pts = [[-8, -26], [-4, -20], [-9, -13], [-3, -8], [6, -27], [9, -21], [5, -15], [8, -7]];
    line('rgba(190,220,255,0.45)', 0.6, pts.slice(0, 4)); line('rgba(190,220,255,0.45)', 0.6, pts.slice(4));
    pts.forEach(([x, y], i) => { circ(x, y, 0.8 + (Math.sin(t * 3 + i) + 1) * 0.3); done('#eef8ff', null); });
    rect('#bfc8e8', -20, b - 3, 40, 1.6); circ(0, -31, 1.8); done('#dfe6ee', K.OL, 0.6);
  };
  A.hand.telescope = (K) => {
    const { g, rr, done, lin, OL } = K;
    g.rotate(0.55); rr(-1.6, -6, 3.2, 8, 1); done(lin('#1f2a6a', -6, 2)); rr(-2.2, -14, 4.4, 9, 1.2); done(lin('#3a4a9a', -14, -5)); rr(-2.9, -24, 5.8, 11, 1.4); done(lin('#1f2a6a', -24, -13));
    for (const y of [-14, -24, -6]) K.rect('#e0b24a', -2.9, y - 0.6, 5.8, 1.4); K.ell(0, -24.4, 2.6, 0.9); done('#bfe4ff', OL, 0.6);
  };
  A.chest.starPendant = (K) => { const { g, line, t } = K; line('#dfe6ee', 0.9, [[-5, -31], [0, -24.5], [5, -31]]); const k = 0.7 + 0.3 * Math.sin(t * 3); g.save(); glow(g, '#bfe4ff', 7 * k); starPath(g, 0, -22.5, 3, 0.45); g.fillStyle = '#eef8ff'; g.fill(); g.strokeStyle = K.OL; g.lineWidth = 0.7; g.stroke(); g.restore(); };
  A.effect.shootingStars = (K, back) => {
    if (!back) return; const { g, t } = K;
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.5 + i / 3) % 1; if (p > 0.6) continue; const q = p / 0.6, x = 28 - q * 56 + i * 6, y = -86 + q * 40 + i * 9;
      const gr = g.createLinearGradient(x, y, x + 14, y - 9); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(160,200,255,0)');
      g.save(); g.globalAlpha *= Math.sin(q * PI); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y - 9); g.strokeStyle = gr; g.lineWidth = 1.6; g.lineCap = 'round'; g.stroke(); glow(g, '#ffffff', 6); K.circ(x, y, 1.2); g.fillStyle = '#ffffff'; g.fill(); g.restore();
    }
  };

  // ======================= Back to School =======================
  A.hat.propellerCap = (K, e, top) => {
    const { g, P, done, lin, circ, rr, line, HY, R, OL, t } = K, C = ['#ff4a4a', '#ffd23f', '#3a8aff', '#2ecc71'];
    for (let k = 0; k < 4; k++) { P(); g.moveTo(0, HY - 4); g.arc(0, HY - 4, R + 1.4, PI + k * PI / 4, PI + (k + 1) * PI / 4); g.closePath(); done(lin(C[k], top - 2, HY - 4), null); }
    P(); g.arc(0, HY - 4, R + 1.4, PI, 0); g.closePath(); done(null);
    rr(-R - 2, HY - 7.5, (R + 2) * 2, 3.6, 1.8); done('#ffd23f', OL, 1); circ(0, top - 2, 1.6); done('#ff4a4a', OL, 0.7); line(OL, 1.6, [[0, top - 3], [0, top - 6]]);
    const s = Math.cos(t * 14); g.save(); g.translate(0, top - 6.5); g.scale(s, 1); K.ell(-4.5, 0, 4.5, 1.6); done('#3a8aff', OL, 0.7); K.ell(4.5, 0, 4.5, 1.6); done('#ff4a4a', OL, 0.7); g.restore(); circ(0, top - 6.5, 1); done('#ffd23f', OL, 0.5);
  };
  A.OUTFITS.varsityJacket = { c: '#1f3f8a', d: 'varsity', sleeve: '#f2ead6' };
  A.details.varsity = (K, b) => {
    const { g, rect, circ, done, rr, OL } = K;
    rect('#f2ead6', -20, -33, 40, 2); rect('#1f3f8a', -20, -31.3, 40, 1); rect('#f2ead6', -20, b - 3.6, 40, 1.2); rect('#1f3f8a', -20, b - 2.4, 40, 1); rect('#f2ead6', -20, b - 1.4, 40, 1.4);
    for (let i = 0; i < 4; i++) { circ(1, -27 + i * 4, 0.8); done('#f2ead6', null); }
    rr(-10.4, -27, 7.6, 8.6, 1.4); done('#f2ead6', OL, 0.7); g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#c8202a'; g.fillText('J', -6.6, -22.3);
  };
  A.hand.giantPencil = (K) => {
    const { g, rr, done, lin, poly, rect, OL } = K;
    g.rotate(0.45); rr(-2.2, -20, 4.4, 20, 0.6); done(lin('#ffd23f', -20, 0)); rect('rgba(0,0,0,0.12)', 0.4, -20, 1, 20); rr(-2.2, -0.6, 4.4, 3.4, 1); done('#ff8fb4', OL, 0.8); rect('#c4ccd2', -2.2, -1.4, 4.4, 1.4);
    poly([[-2.2, -20], [2.2, -20], [0, -26]]); done('#f2d8b0', OL, 0.8); poly([[-0.8, -24], [0.8, -24], [0, -26]]); done('#2b2b33', null);
  };
  A.hand.shinyApple = (K) => {
    const { g, P, done, lin, line, ell, OL } = K;
    P(); g.moveTo(0, -11); g.bezierCurveTo(-7, -14, -7.5, -2, -2, -0.6); g.quadraticCurveTo(0, 0, 2, -0.6); g.bezierCurveTo(7.5, -2, 7, -14, 0, -11); g.closePath(); done(lin('#e8202a', -13, 0));
    line('#5a3a20', 1.1, [[0, -11], [0.6, -14]]); ell(2.6, -13.6, 2.2, 1, -0.4); done('#4aa83a', OL, 0.5); ell(-3, -8, 1, 2, 0.3); done('rgba(255,255,255,0.6)', null);
  };
  A.shoe.sneakers = (K, lx) => { const { line } = K; boot(K, lx, 4.4, '#f8f8fc', 6.6, '#c4ccd2'); line('#3a8aff', 1, [[lx - 2.4, -2.4], [lx + 2.6, -3.6]]); line('#ff4a4a', 0.9, [[lx - 1, -4], [lx + 2.6, -4.2]]); };
  A.effect.paperPlanes = (K, back) => {
    orbit(K, back, 2, 0.9, 22, -68, 5, (i, a) => { const { g, poly, done } = K; g.scale(Math.sin(a) > 0 ? -1 : 1, 1); g.rotate(Math.sin(K.t * 2 + i) * 0.2); poly([[-6, 0], [6, -2], [-3, 2.4]]); done('#ffffff', K.OL, 0.6); poly([[-6, 0], [6, -2], [-2, -0.4]]); done('#dfe6ee', K.OL, 0.5); });
  };

  // ======================= Robot Rumble =======================
  A.hat.robotHelm = (K, e, top) => {
    const { g, P, done, lin, circ, rr, line, HY, R, OL, t } = K;
    for (const sx of [-1, 1]) { rr(sx > 0 ? R - 1 : -R - 4, HY - 6, 5, 9, 1.6); done(lin('#9aa6b0', HY - 6, HY + 3)); circ(sx * (R + 1.5), HY - 1.5, 1.2); done('#ff8a3a', OL, 0.5); }
    P(); g.arc(0, HY - 4, R + 1.6, PI, 0); g.closePath(); done(lin('#c4ccd6', top - 3, HY - 4)); rr(-R - 2, HY - 8, (R + 2) * 2, 4, 1); done(lin('#8a96a2', HY - 8, HY - 4));
    for (let x = -R; x <= R; x += 4.4) { circ(x, HY - 6, 0.7); done('#5a6470', null); } line('rgba(255,255,255,0.5)', 1.2, [[-8, top + 2], [-3, top - 1]]);
    line(OL, 1.6, [[0, top - 2], [0, top - 9]]); line('#8a96a2', 0.8, [[0, top - 2], [0, top - 9]]); const on = Math.sin(t * 5) > 0; g.save(); if (on) glow(g, '#ff4a4a', 8); circ(0, top - 10, 2); done(on ? '#ff4a4a' : '#8a2a2a', OL, 0.7); g.restore();
  };
  A.OUTFITS.roboSuit = { c: '#b8c2cc', d: 'robo', sleeve: '#9aa6b0' };
  A.details.robo = (K, b) => {
    const { rr, done, circ, rect, line, OL, t } = K;
    rr(-7, -28, 14, 11, 1.6); done('#2a3140', OL, 0.8); const C = ['#ff4a4a', '#7aff5a', '#3ae8ff', '#ffd23f'];
    for (let i = 0; i < 4; i++) { const on = Math.sin(t * 4 + i * 1.7) > 0; circ(-4.5 + i * 3, -25, 1); done(on ? C[i] : '#3a4250', null); }
    for (let i = 0; i < 3; i++) rect('#5a6470', -5, -21.6 + i * 1.6, 10, 0.8);
    circ(0, -12, 2.6); done('#8a96a2', OL, 0.7); line(OL, 0.8, [[0, -12], [Math.cos(t) * 2, -12 + Math.sin(t) * 2]]);
    for (const [x, y] of [[-11, -29], [11, -29], [-11, b - 3], [11, b - 3]]) { circ(x, y, 0.8); done('#6a7480', null); } rect('rgba(0,0,0,0.2)', -20, b - 2, 40, 2);
  };
  A.hand.bigWrench = (K) => {
    const { g, rr, done, lin, P, OL } = K;
    g.rotate(0.35); rr(-1.8, -16, 3.6, 18, 1.6); done(lin('#c4ccd6', -16, 2));
    P(); g.arc(0, -19, 4.6, 0, TAU); g.fillStyle = '#c4ccd6'; g.fill(); g.strokeStyle = OL; g.lineWidth = 1.3; g.stroke(); K.rect('#2b1f3d', -1.6, -24.5, 3.2, 5.4); K.rr(-1.6, -24.6, 3.2, 5.6, 0.4); done(null, OL, 0.8);
  };
  A.face.laserVisor = (K, e, ey, L, Rt) => {
    const { g, rr, done, R, t } = K;
    rr(-R + 0.5, ey - 3.2, 2 * R - 1, 5.6, 2.4); done('rgba(255,40,60,0.55)', '#5a6470', 1.3);
    const x = Math.sin(t * 2.5) * (R - 3); g.save(); glow(g, '#ff2a3a', 8); K.circ(x, ey - 0.4, 1.5); done('#ffd0d0', null); g.restore(); K.line('rgba(255,255,255,0.5)', 0.7, [[L - 3, ey - 2.2], [L + 1, ey - 2.2]]); void Rt;
  };
  A.shoe.mechBoots = (K, lx) => { const { rr, done, lin, rect } = K; rr(lx - 4.4, -7.4, 10.8, 7.8, 1.6); done(lin('#9aa6b0', -7.4, 0)); rect('#ff8a3a', lx - 4.2, -5.4, 10.4, 1.4); rect('#4a5260', lx - 4.4, -1.2, 10.8, 1.6); K.circ(lx - 2.4, -3, 0.6); done('#5a6470', null); };
  const gear = (K, r, c, n = 8) => { const { g, done, circ } = K; g.beginPath(); for (let k = 0; k < n * 2; k++) { const a = k * PI / n, rad = k % 2 ? r * 0.78 : r; g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } g.closePath(); done(c, K.OL, 0.7); circ(0, 0, r * 0.32); done('#3a3a44', null); };
  A.effect.gears = (K, back) => { orbit(K, back, 2, 0.6, 20, -40, 9, (i) => { K.g.rotate(K.t * (i ? -2 : 2)); gear(K, i ? 4 : 5.2, i ? '#c4ccd6' : '#e0b24a'); }); };

  // ======================= Pirate Week =======================
  A.hat.captainHat = (K, e, top) => {
    const { g, P, done, lin, line, ell, circ, HY, OL, t } = K;
    g.save(); g.translate(0, HY - 9); g.rotate(-0.06);
    P(); g.moveTo(-21, 2); g.quadraticCurveTo(-14, -15, 0, -17); g.quadraticCurveTo(14, -15, 21, 2); g.quadraticCurveTo(0, -3, -21, 2); g.closePath(); done(lin('#16141c', -17, 2));
    P(); g.moveTo(-19, 0.6); g.quadraticCurveTo(-13, -13.6, 0, -15.6); g.quadraticCurveTo(13, -13.6, 19, 0.6); g.strokeStyle = '#e0b24a'; g.lineWidth = 1.2; g.stroke();
    circ(0, -8, 3); done('#e0b24a', OL, 0.7); circ(0, -8, 1.5); done('#c8202a', null);
    g.save(); g.translate(4, -13); g.rotate(-0.9 + Math.sin(t * 2) * 0.06); ell(0, -7, 3, 9); done(lin('#fbf8f0', -16, 2)); line('rgba(150,150,170,0.6)', 0.6, [[0, 1], [0, -15]]); g.restore();
    g.restore(); void top;
  };
  A.OUTFITS.deckhand = { c: '#f4f1ea', d: 'deck' };
  A.details.deck = (K, b) => {
    const { rect, P, g, done, lin, OL } = K;
    for (let y = -30; y < b; y += 4) rect('#1f2f5a', -20, y, 40, 1.8);
    rect('#c8202a', -20, -15, 40, 4.4); P(); g.moveTo(6, -11); g.lineTo(9, -3); g.lineTo(5.5, -4); g.lineTo(4, -11); g.closePath(); done(lin('#c8202a', -11, -3), OL, 0.6);
    P(); g.moveTo(-3, -33); g.quadraticCurveTo(0, -27, 3, -33); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 0.8; g.stroke();
  };
  A.hand.cutlass = (K) => {
    const { g, P, done, lin, line, OL } = K;
    g.rotate(0.2); line(OL, 3, [[0, 3], [0, -3]]); line('#5a3a20', 1.6, [[0, 3], [0, -3]]); P(); g.arc(0, -1, 4.2, PI * 0.9, PI * 2.1); g.strokeStyle = OL; g.lineWidth = 2.4; g.stroke(); g.strokeStyle = '#e0b24a'; g.lineWidth = 1.2; g.stroke();
    P(); g.moveTo(-1.6, -3); g.quadraticCurveTo(-2.4, -14, 3, -24); g.quadraticCurveTo(2.6, -14, 1.6, -3); g.closePath(); done(lin('#e8eef4', -24, -3)); line('rgba(255,255,255,0.8)', 0.6, [[-0.6, -5], [0.6, -17]]);
  };
  A.hand.spyglass = (K) => {
    const { g, rr, done, lin, OL } = K;
    g.rotate(1.3); rr(-1.8, -8, 3.6, 8, 1); done(lin('#8a5a34', -8, 0)); rr(-2.3, -15, 4.6, 8, 1); done(lin('#e0b24a', -15, -7)); rr(-2.8, -22, 5.6, 8, 1); done(lin('#c49a3a', -22, -14));
    K.rect('#5a3a20', -2.8, -16, 5.6, 1.2); K.ell(0, -22.2, 2.5, 0.9); done('#bfe4ff', OL, 0.6);
  };
  A.shoe.buccaneerBoots = (K, lx) => { const { P, g, done, lin } = K; boot(K, lx, 11, '#1c1820', 6.6, 'rgba(255,255,255,0.1)'); P(); g.moveTo(lx - 4.6, -12.6); g.lineTo(lx + 4.4, -12.6); g.lineTo(lx + 3.8, -9); g.lineTo(lx - 4, -9); g.closePath(); done(lin('#5a3a20', -12.6, -9)); };
  A.effect.seagulls = (K, back) => {
    orbit(K, back, 2, 0.7, 22, -72, 5, (i) => { const { g, P, t } = K, fl = Math.sin(t * 7 + i * 2) * 2.4; P(); g.moveTo(-7, -fl); g.quadraticCurveTo(-3.5, -3 - fl * 0.5, 0, 0); g.quadraticCurveTo(3.5, -3 - fl * 0.5, 7, -fl); g.strokeStyle = K.OL; g.lineWidth = 2.6; g.stroke(); g.strokeStyle = '#ffffff'; g.lineWidth = 1.4; g.stroke(); K.circ(0, 0.4, 1.2); K.done('#ffffff', K.OL, 0.5); });
  };

  // ======================= Blood Moon =======================
  A.OPEN_TOP.wolfEars = 1;
  A.hat.wolfEars = (K, e, top) => {
    const { poly, done, lin, line } = K, fur = '#5a4a46';
    for (const s of [-1, 1]) { poly([[s * 3, top + 2.4], [s * 9.5, top - 11], [s * 13, top + 3.6]]); done(lin(fur, top - 11, top + 4)); poly([[s * 5.6, top + 1.6], [s * 9.4, top - 6.4], [s * 11, top + 2.4]]); done('#c87a8a', null);
      for (let k = 0; k < 3; k++) line('#8a7a74', 0.7, [[s * (6.5 + k), top + 1], [s * (7.2 + k * 1.2), top - 2.4]]); }
  };
  A.OUTFITS.hunterCoat = { c: '#5a0f1a', len: 'c', d: 'mhunter' };
  A.behind.hunterCoat = (K, b) => { const { poly, done, lin, SW } = K; poly([[-SW + 1, -20], [SW - 1, -20], [SW + 3, b + 4], [0, b + 1.5], [-SW - 3, b + 4]]); done(lin('#3a0810', -20, b + 4)); };
  A.details.mhunter = (K, b) => {
    const { rect, rr, done, line, OL, poly } = K;
    poly([[-4.5, -32], [-1, -22], [-7, -26]]); done('#3a0810', OL, 0.7); poly([[4.5, -32], [1, -22], [7, -26]]); done('#3a0810', OL, 0.7);
    for (let i = 0; i < 3; i++) { const y = -24 + i * 4.4; rect('#2a0a10', -20, y, 40, 1.8); rr(-1.6, y - 0.6, 3.2, 3, 0.5); done('#d8dde4', OL, 0.5); }
    rect('#1a0408', -20, -11, 40, 2.6); line('#3a0810', 0.9, [[0, -9], [0, b]]);
  };
  A.SPOT.crimsonCape = 'back';
  A.back.crimsonCape = (K) => {
    const { g, P, done, lin, poly, t, HY } = K, sw = Math.sin(t * 1.8) * 1.2;
    poly([[-9, -32], [9, -32], [18 + sw, -1], [-18 + sw, -1]]); done(lin('#a3101e', -32, 0));
    for (const s of [-1, 1]) { P(); g.moveTo(s * 7, -32); g.quadraticCurveTo(s * 15, HY + 2, s * 13, HY - 10); g.quadraticCurveTo(s * 10, HY - 2, s * 3, -33); g.closePath(); done(lin('#6a0810', HY - 10, -32)); }
  };
  A.chest.crimsonCape = (K) => { const { circ, done, line } = K; line('#2a0408', 1.2, [[-6, -31.5], [6, -31.5]]); circ(0, -31.5, 1.8); done('#d8dde4', K.OL, 0.6); circ(0, -31.5, 0.8); done('#c8102a', null); };
  A.hand.moonLantern = (K) => {
    const { g, rr, done, line, circ, P, OL, t } = K;
    P(); g.arc(0, -2, 2.6, PI, 0); g.strokeStyle = OL; g.lineWidth = 1.8; g.stroke(); const sw = Math.sin(t * 2) * 0.08; g.rotate(sw);
    rr(-4, 0, 8, 2, 0.6); done('#3a3a44', OL, 0.7); rr(-3.6, 2, 7.2, 9, 1); done('rgba(60,10,20,0.6)', OL, 0.9);
    g.save(); glow(g, '#ff3a4a', 10); circ(0, 6.5, 2.6); done('#ff3a4a', null); g.restore(); line('#3a3a44', 0.9, [[-3.6, 6.5], [3.6, 6.5]]); line('#3a3a44', 0.9, [[0, 2], [0, 11]]); rr(-4, 11, 8, 2, 0.6); done('#3a3a44', OL, 0.7);
  };
  A.effect.redMoon = (K, back) => {
    const { g, circ, done, P, t } = K;
    if (back) { g.save(); const gr = g.createRadialGradient(9, -70, 2, 9, -70, 22); gr.addColorStop(0, 'rgba(255,60,70,0.55)'); gr.addColorStop(1, 'rgba(255,40,60,0)'); g.fillStyle = gr; g.fillRect(-14, -94, 46, 48); g.restore();
      circ(9, -70, 11); done('#c8202a', 'rgba(80,0,10,0.8)', 0.8); for (const [x, y, r] of [[5, -73, 2.4], [12, -66, 1.8], [13, -74, 1.2]]) { circ(x, y, r); done('rgba(110,0,20,0.5)', null); } return; }
    for (let i = 0; i < 2; i++) { const a = t * 0.9 + i * PI, x = Math.cos(a) * 18, y = -78 + Math.sin(a * 2) * 3, fl = Math.sin(t * 12 + i) * 1.8; g.save(); g.translate(x, y); P(); g.moveTo(0, 0); g.quadraticCurveTo(-3, -2 - fl, -6.5, -0.6 - fl); g.quadraticCurveTo(-4.5, 0.4, -3, 1.6); g.quadraticCurveTo(-1.5, 0.6, 0, 1.6); g.quadraticCurveTo(1.5, 0.6, 3, 1.6); g.quadraticCurveTo(4.5, 0.4, 6.5, -0.6 - fl); g.quadraticCurveTo(3, -2 - fl, 0, 0); done('#1a0810', null); g.restore(); }
  };

  // ======================= Campfire Nights =======================
  A.hat.rangerHat = (K, e, top) => {
    const { g, P, done, lin, ell, rect, HY } = K;
    ell(0, HY - 8, 20, 3.6); done(lin('#b8935a', HY - 12, HY - 4));
    P(); g.moveTo(-9, HY - 9); g.lineTo(-7, top - 4); g.lineTo(-2.6, top - 8.5); g.lineTo(0, top - 5.5); g.lineTo(2.6, top - 8.5); g.lineTo(7, top - 4); g.lineTo(9, HY - 9); g.closePath(); done(lin('#c9a46a', top - 8, HY - 9));
    rect('#5a3a20', -9, HY - 12.6, 18, 2.8); K.line('rgba(80,50,20,0.5)', 0.8, [[0, top - 5], [0, HY - 13]]);
  };
  A.OUTFITS.campVest = { c: '#e8742a', d: 'camp', sleeve: '#3a6a4a' };
  A.details.camp = (K, b) => {
    const { line, circ, done, rect, OL, star } = K;
    for (let y = -27; y < b; y += 4.2) line('rgba(120,40,0,0.35)', 0.8, [[-20, y], [20, y]]);
    rect('#3a6a4a', -3.2, -33, 6.4, 34); line('#8a8f99', 1, [[3.4, -31], [3.4, b]]);
    circ(-9, -24, 2.2); done('#ffd23f', OL, 0.6); star(-9, -24, 1.2, '#c8202a'); circ(-9, -18.6, 2.1); done('#3a8aff', OL, 0.6); circ(-9, -18.6, 0.9); done('#ffffff', null); circ(9, -22, 2.2); done('#4aa83a', OL, 0.6); K.poly([[7.6, -21], [9, -23.6], [10.4, -21]]); done('#ffffff', null);
  };
  A.hand.marshmallow = (K) => {
    const { g, line, rr, done, OL, t } = K;
    g.rotate(0.6); line(OL, 2.4, [[0, 4], [0, -22]]); line('#8a5a34', 1.1, [[0, 4], [0, -22]]); rr(-2.8, -27, 5.6, 6.4, 2); done('#f4dcb0', OL, 0.9); rr(-2.8, -24.2, 5.6, 3.6, 1.6); done('#c98a3a', null); rr(-2.8, -27, 5.6, 6.4, 2); done(null, OL, 0.9);
    for (let k = 0; k < 2; k++) { const p = (t * 0.6 + k / 2) % 1; g.save(); g.globalAlpha *= 1 - p; line('rgba(255,255,255,0.8)', 0.9, [[k * 1.6 - 0.8, -28 - p * 5], [Math.sin(t * 3 + k) * 1.4, -31 - p * 7]]); g.restore(); }
  };
  A.hand.campLantern = (K) => {
    const { g, rr, done, P, OL, t, circ } = K;
    P(); g.arc(0, -15, 3, PI, 0); g.strokeStyle = OL; g.lineWidth = 1.8; g.stroke();
    rr(-4, -15, 8, 2.4, 1); done('#2a6a4a', OL, 0.7); rr(-3.4, -12.6, 6.8, 8.6, 1.4); done('rgba(255,230,160,0.5)', OL, 0.9);
    const k = 0.8 + 0.2 * Math.sin(t * 9); g.save(); glow(g, '#ffb04a', 12 * k); circ(0, -8.4, 2 * k); done('#fff2a0', null); g.restore(); rr(-4, -4, 8, 2.4, 1); done('#2a6a4a', OL, 0.7);
  };
  A.shoe.hikingBoots = (K, lx) => { const { line, rect } = K; boot(K, lx, 7.4, '#7a5434', 6.8); rect('#2b2620', lx - 3.9, -1.6, 10.8, 1.9); for (let y = -6.4; y < -2.5; y += 1.6) line('#e8323c', 0.8, [[lx - 1, y], [lx + 2.2, y + 0.6]]); };
  A.effect.campSparks = (K, back) => {
    if (back) return; const { g, circ, done } = K;
    rise(K, 10, 0.4, (i, p) => { g.save(); glow(g, '#ff9a3a', 5); circ(Math.sin(K.t * 4 + i) * 1.4, 0, 1 - p * 0.5); done(i % 3 ? '#ffb04a' : '#fff2a0', null); g.restore(); }, 17);
  };

  // ======================= Gingerbread Town =======================
  A.OPEN_TOP.gumdropCrown = 1;
  A.hat.gumdropCrown = (K, e, top) => {
    const { g, P, done, lin, circ, HY } = K, C = ['#ff4a5a', '#3ad04a', '#ffd23f', '#b45cff', '#ff9a3a'];
    P(); g.moveTo(-11.5, HY - 6); g.lineTo(-12, top - 1); for (let x = -12; x <= 12; x += 4) g.quadraticCurveTo(x + 2, top + 2.4, x + 4, top - 1); g.lineTo(11.5, HY - 6); g.closePath(); done(lin('#fbf4f0', top - 1, HY - 6));
    for (let i = 0; i < 5; i++) { const x = -9 + i * 4.5, y = top - 1.5 - (i === 2 ? 2 : i % 2 ? 1 : 0); P(); g.arc(x, y, 2.6, PI, 0); g.lineTo(x + 2.6, y + 1.4); g.lineTo(x - 2.6, y + 1.4); g.closePath(); done(lin(C[i], y - 3, y + 1.4)); circ(x - 0.8, y - 1, 0.45); done('rgba(255,255,255,0.8)', null); }
  };
  A.OUTFITS.gingerbreadSuit = { c: '#b8732e', d: 'ginger' };
  A.details.ginger = (K, b) => {
    const { g, circ, done, OL } = K;
    const zig = (y) => { g.beginPath(); for (let x = -20; x <= 20; x += 2) g.lineTo(x, y + ((x / 2) % 2 ? -1.1 : 1.1)); g.strokeStyle = '#fbf8f4'; g.lineWidth = 1.4; g.lineJoin = 'round'; g.stroke(); };
    zig(-29.5); zig(b - 2.4);
    for (const [y, c] of [[-24, '#ff4a5a'], [-18.5, '#3ad04a'], [-13, '#ffd23f']]) { circ(0, y, 1.8); done(c, OL, 0.6); circ(-0.6, y - 0.6, 0.45); done('rgba(255,255,255,0.8)', null); }
  };
  A.hand.lollipop = (K) => {
    const { g, line, circ, done, OL, P } = K;
    g.rotate(0.2); line(OL, 2.2, [[0, 3], [0, -12]]); line('#fbf8f4', 1.1, [[0, 3], [0, -12]]); circ(0, -18, 6.4); done('#ffffff', OL, 1.2);
    const C = ['#ff4a5a', '#ffd23f', '#3ad04a', '#3a8aff']; for (let k = 0; k < 4; k++) { P(); for (let a = 0; a < 5.2; a += 0.3) { const r = a * 1.15; g.lineTo(Math.cos(a + k * PI / 2) * r, -18 + Math.sin(a + k * PI / 2) * r); } g.strokeStyle = C[k]; g.lineWidth = 1.3; g.stroke(); }
  };
  A.chest.peppermintScarf = (K) => {
    const { g, rr, done, rect } = K;
    rr(-11.5, -33.5, 23, 6, 3); done('#fbf8f4'); g.save(); rr(-11.5, -33.5, 23, 6, 3); g.clip(); for (let i = -14; i < 14; i += 4) { g.save(); g.translate(i, -30.5); g.rotate(0.6); rect('#e8202a', -1, -6, 2, 12); g.restore(); } g.restore(); rr(-11.5, -33.5, 23, 6, 3); done(null);
    rr(3.5, -29.5, 6, 16, 2.4); done('#fbf8f4'); g.save(); rr(3.5, -29.5, 6, 16, 2.4); g.clip(); for (let y = -30; y < -12; y += 4) rect('#e8202a', 3, y, 7, 2); g.restore(); rr(3.5, -29.5, 6, 16, 2.4); done(null);
  };
  A.effect.sprinkles = (K, back) => {
    if (back) return; const C = ['#ff4a5a', '#ffd23f', '#3ad04a', '#3a8aff', '#ff8fd0', '#ffffff'];
    fall(K, 14, 0.3, (i) => { K.g.rotate(i * 1.3 + K.t); K.rr(-1.6, -0.55, 3.2, 1.1, 0.55); K.done(C[i % C.length], null); });
  };

  root.MT_EVENT_ART = A;
})(typeof window !== 'undefined' ? window : globalThis);
