'use strict';
// TrashZombies Regular mode on the phone: the final bosses (art + attack patterns), the boss door
// landmarks, the find crates and the locked gates (window.TZB). Uses TZW, TZS and TZA.
(function () {
  const TAU = Math.PI * 2, OL = '#1b1410';
  const A = () => window.TZA;
  const rr = (g, x, y, w, h, r) => A().rr(g, x, y, w, h, r);
  const fillOl = (g, c, w = 4) => { g.fillStyle = c; g.fill(); if (w) { g.lineWidth = w; g.strokeStyle = OL; g.lineJoin = 'round'; g.stroke(); } };
  const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); };

  // ---------------- the bosses (feet at 0,0; facing right) ----------------
  function drawBoss(g, z, t) {
    const type = z.fb, R = z.r, fl = false, c = (x) => x, ph2 = z.hp < z.mhp * 0.5;
    g.save(); g.translate(z.x, z.y); if (z.face < 0) g.scale(-1, 1);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 0, R * 1.2, R * 0.38, 0, 0, TAU); g.fill();
    const bob = Math.sin(t * 6) * 3;
    if (type === 'truck') {
      // a garbage truck with a zombie face for a grille, arms out of the windows
      g.translate(0, -R * 0.2 + bob * 0.3);
      rr(g, -R * 1.3, -R * 1.5, R * 1.7, R * 1.3, 10); fillOl(g, c('#3d8a4a'), 5); // the hopper
      g.strokeStyle = c('#2b6a38'); g.lineWidth = 4; g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(-R * 1.25 + i * R * 0.4, -R * 1.45); g.lineTo(-R * 1.25 + i * R * 0.4, -R * 0.25); } g.stroke();
      rr(g, R * 0.35, -R * 1.25, R * 0.95, R * 1.05, 12); fillOl(g, c(ph2 ? '#ff8c2e' : '#e8e2d4'), 5); // the cab
      rr(g, R * 0.5, -R * 1.1, R * 0.6, R * 0.4, 6); fillOl(g, c('#20262e'), 3);
      g.fillStyle = fl ? '#fff' : '#ffef5a'; circ(g, R * 0.68, -R * 0.92, 6); g.fill(); circ(g, R * 0.92, -R * 0.92, 6); g.fill();
      g.fillStyle = '#1a0f0a'; rr(g, R * 1.0, -R * 0.55, R * 0.32, R * 0.3, 4); g.fill(); g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) g.fillRect(R * 1.03 + i * 8, -R * 0.55, 5, 7);
      for (const wx of [-R * 0.9, -R * 0.1, R * 0.9]) { circ(g, wx, -R * 0.15, R * 0.28); fillOl(g, '#1d1d1d', 4); circ(g, wx, -R * 0.15, R * 0.1); g.fillStyle = '#777'; g.fill(); }
      g.strokeStyle = OL; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(R * 0.7, -R * 1.0); g.lineTo(R * 1.35, -R * 1.35 + Math.sin(t * 8) * 8); g.stroke(); g.strokeStyle = c('#7fae6a'); g.lineWidth = 7; g.stroke();
      if (z.charge > 0) { g.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 4; i++) g.fillRect(-R * 1.8 - i * 26, -R * 1.2 + i * 18, 22, 6); }
    } else if (type === 'ratking') {
      // a huge rat queen with a bottle-cap crown and a cape of plastic bags
      g.translate(0, bob);
      g.strokeStyle = c('#c98a8a'); g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(-R * 0.8, -R * 0.5); g.quadraticCurveTo(-R * 1.8, -R * 0.2 + Math.sin(t * 5) * 14, -R * 1.6, -R * 1.2); g.stroke();
      g.beginPath(); g.moveTo(-R * 0.9, -R * 0.3); g.lineTo(-R * 1.25, -R * 1.3); g.lineTo(-R * 0.1, -R * 1.5); g.lineTo(R * 0.2, -R * 0.4); g.closePath(); fillOl(g, c(ph2 ? '#7a1f3d' : '#4a2a6a'), 4); // cape
      g.beginPath(); g.ellipse(0, -R * 0.75, R * 0.95, R * 0.72, 0, 0, TAU); fillOl(g, c('#7a7f86'), 5);
      g.beginPath(); g.ellipse(R * 0.85, -R * 1.15, R * 0.55, R * 0.42, -0.3, 0, TAU); fillOl(g, c('#8a8f96'), 5);
      g.beginPath(); g.moveTo(R * 1.25, -R * 1.2); g.lineTo(R * 1.6, -R * 1.05); g.lineTo(R * 1.25, -R * 0.95); fillOl(g, c('#c98a8a'), 3);
      circ(g, R * 0.6, -R * 1.55, R * 0.2); fillOl(g, c('#c98a8a'), 3); circ(g, R * 0.95, -R * 1.58, R * 0.18); fillOl(g, c('#c98a8a'), 3);
      g.fillStyle = fl ? '#fff' : '#ff3a3a'; circ(g, R * 1.0, -R * 1.25, 6); g.fill(); g.fillStyle = '#fff'; g.fillRect(R * 1.35, -R * 1.02, 5, 9); g.fillRect(R * 1.43, -R * 1.02, 5, 9);
      // bottle-cap crown
      for (let i = 0; i < 3; i++) { circ(g, R * 0.55 + i * 16, -R * 1.78 - (i === 1 ? 8 : 0), 10); fillOl(g, c(['#ffd23f', '#e8424f', '#3ec1ff'][i]), 3); }
      for (const s of [-1, 1]) { g.strokeStyle = OL; g.lineWidth = 8; g.beginPath(); g.moveTo(s * R * 0.4, -R * 0.2); g.lineTo(s * R * 0.5 + Math.sin(t * 10 + s) * 6, 0); g.stroke(); }
    } else if (type === 'sludge') {
      // a wobbling blob of toxic sludge with junk floating inside
      const w = 1 + Math.sin(t * 4) * 0.06, h = 1 - Math.sin(t * 4) * 0.06;
      g.scale(w, h);
      g.beginPath(); g.moveTo(-R * 1.1, 0); g.bezierCurveTo(-R * 1.3, -R * 1.4, R * 1.3, -R * 1.6, R * 1.1, 0); g.closePath(); fillOl(g, c(ph2 ? '#b6ff3c' : '#7ad03a'), 5);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(-R * 0.4, -R * 0.9, R * 0.25, R * 0.12, -0.5, 0, TAU); g.fill();
      g.fillStyle = 'rgba(40,60,20,0.5)'; g.fillRect(-R * 0.5, -R * 0.5, 18, 26); circ(g, R * 0.5, -R * 0.35, 10); g.fill(); // a can and a tire in there
      for (const [ex, s] of [[-R * 0.25, 1], [R * 0.3, 0.8]]) { circ(g, ex, -R * 0.95, 16 * s); fillOl(g, '#fff', 3); g.fillStyle = OL; circ(g, ex + 4, -R * 0.95, 7 * s); g.fill(); }
      g.strokeStyle = OL; g.lineWidth = 4; g.beginPath(); g.arc(0, -R * 0.55, R * 0.35, 0.2, Math.PI - 0.2); g.stroke();
    } else {
      // Grinny: a giant grinning corn-dog mascot suit, foam fingers up
      const spin = z.spin > 0 ? z.spin * 12 : 0;
      g.translate(0, bob); g.rotate(spin ? Math.sin(spin) * 0.15 : 0);
      for (const s of [-1, 1]) { g.strokeStyle = OL; g.lineWidth = 14; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * R * 0.25, -R * 0.4); g.lineTo(s * R * 0.3, 0); g.stroke(); g.strokeStyle = c('#2f6db5'); g.lineWidth = 9; g.stroke(); }
      rr(g, -R * 0.55, -R * 2.1, R * 1.1, R * 1.8, R * 0.55); fillOl(g, c('#d9893a'), 5); // the corn dog
      g.fillStyle = c('#b5652a'); for (let i = 0; i < 5; i++) { circ(g, -R * 0.2 + (i % 2) * R * 0.4, -R * 1.8 + i * R * 0.3, 5); g.fill(); }
      g.strokeStyle = c('#ffd23f'); g.lineWidth = 7; g.beginPath(); g.moveTo(-R * 0.3, -R * 1.5); g.quadraticCurveTo(0, -R * 1.3, R * 0.3, -R * 1.5); g.stroke(); // mustard
      for (const ex of [-R * 0.2, R * 0.2]) { circ(g, ex, -R * 1.25, 11); fillOl(g, '#fff', 3); g.fillStyle = fl ? '#fff' : (ph2 ? '#e8424f' : OL); circ(g, ex + 3, -R * 1.25, 5); g.fill(); }
      g.beginPath(); g.arc(0, -R * 0.95, R * 0.32, 0.1, Math.PI - 0.1); g.closePath(); fillOl(g, '#1a0f0a', 4); g.fillStyle = '#fff'; g.fillRect(-R * 0.25, -R * 0.95, R * 0.5, 7);
      for (const s of [-1, 1]) { g.save(); g.translate(s * R * 0.6, -R * 1.3); g.rotate(s * (0.5 + Math.sin(t * 6) * 0.2)); rr(g, -10, -R * 0.8, 20, R * 0.8, 8); fillOl(g, c('#ff5a3c'), 3); rr(g, -4, -R * 1.0, 8, R * 0.3, 4); fillOl(g, c('#ff5a3c'), 3); g.restore(); }
    }
    g.restore();
  }
  // ---------------- boss attack patterns (run on the area host) ----------------
  // sim helpers used: spawnOne(type), spit list, boom, particle, rng, shake
  function stepBoss(sim, z, dt, tg) {
    const ph2 = z.hp < z.mhp * 0.5, rng = () => sim.rng();
    z.cd -= dt; z.cd2 = (z.cd2 || 3) - dt;
    if (!tg) return 0;
    const dx = tg.x - z.x, dy = tg.y - z.y, d = Math.hypot(dx, dy) || 1;
    const lob = (a, sp, dmg, life = 2.2) => sim.spit.push({ x: z.x, y: z.y - z.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, dmg, big: true });
    const ring = (n, sp, off = 0) => { for (let i = 0; i < n; i++) lob(off + (i * TAU) / n, sp, z.dmg * 0.6); };
    const minions = (type, n) => { for (let i = 0; i < n && sim.z.length < 110; i++) { const m = sim.makeZ(type, z.x + (rng() - 0.5) * z.r * 2, z.y + (rng() - 0.5) * z.r); m.minion = true; } };
    let speedMul = 1;
    if (z.fb === 'truck') {
      if (z.charge > 0) { z.charge -= dt; speedMul = 5.2; }
      else if (z.cd <= 0) { z.cd = ph2 ? 2.2 : 3.4; z.charge = 0.8; z.cx = dx / d; z.cy = dy / d; sim.shake = Math.max(sim.shake, 0.3); }
      if (z.cd2 <= 0) { z.cd2 = ph2 ? 4 : 6.5; minions('bloater', ph2 ? 3 : 2); if (ph2) ring(10, 260, rng()); }
      if (z.charge > 0) { z.x += z.cx * z.speed * speedMul * dt; z.y += z.cy * z.speed * speedMul * dt; return -1; }
    } else if (z.fb === 'ratking') {
      if (d < 260) speedMul = -0.6; else if (d < 420) speedMul = 0.2;
      if (z.cd <= 0) { z.cd = ph2 ? 3.2 : 4.8; minions('runner', ph2 ? 7 : 5); }
      if (ph2 && z.cd2 <= 0) { z.cd2 = 5.5; for (let i = 0; i < 12; i++) sim.particle(z.x, z.y - 20, (rng() - 0.5) * 300, -rng() * 200, '#6b5a43', 0.6, 8); z.x = 200 + rng() * 1200; z.y = 200 + rng() * 560; sim.shake = 0.2; }
      if (z.cd2 <= 0) { z.cd2 = 3; const a = Math.atan2(dy, dx); for (let i = -1; i <= 1; i++) lob(a + i * 0.25, 340, z.dmg * 0.5); }
    } else if (z.fb === 'sludge') {
      if (z.cd <= 0) { z.cd = ph2 ? 1.6 : 2.4; const a = Math.atan2(dy, dx); for (let i = -1; i <= 1; i++) lob(a + i * 0.3, 230, z.dmg * 0.6, 3); }
      const marks = [0.75, 0.5, 0.25]; z.split = z.split || 0;
      if (z.split < marks.length && z.hp < z.mhp * marks[z.split]) { z.split++; minions('bloater', 3 + z.split); sim.boom(z.x, z.y, 140, 0, '#b6ff3c', false); }
    } else if (z.fb === 'mascot') {
      if (z.spin > 0) { z.spin -= dt; speedMul = 0; if (Math.floor(z.spin * 10) !== Math.floor((z.spin + dt) * 10)) ring(ph2 ? 14 : 10, 300, z.spin * 4); }
      else if (z.charge > 0) { z.charge -= dt; z.x += z.cx * z.speed * 4 * dt; z.y += z.cy * z.speed * 4 * dt; return -1; }
      else if (z.cd <= 0) { z.cd = ph2 ? 2.4 : 3.8; if (rng() < 0.5) { z.spin = 1.2; } else { z.charge = 0.6; z.cx = dx / d; z.cy = dy / d; } }
    }
    return speedMul;
  }

  // ---------------- landmarks: the find crate, the boss door, locked gates ----------------
  function drawCrate(g, x, y, id, t, open) {
    const F = window.TZS.FINDS[id] || {}, key = F.kind === 'key' || F.kind === 'map';
    g.save(); g.translate(x, y);
    const glow = g.createRadialGradient(0, -20, 6, 0, -20, 90); glow.addColorStop(0, key ? 'rgba(255,210,63,0.7)' : 'rgba(156,255,60,0.6)'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.6 + 0.3 * Math.sin(t * 4); g.fillStyle = glow; circ(g, 0, -20, 90); g.fill(); g.globalAlpha = 1;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 4, 46, 12, 0, 0, TAU); g.fill();
    rr(g, -42, -46, 84, 48, 6); fillOl(g, key ? '#c9a646' : '#8a5a2a', 4);
    g.strokeStyle = key ? '#7a5a1a' : '#5a3a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-42, -24); g.lineTo(42, -24); g.stroke();
    g.save(); g.translate(0, -46); if (open) g.rotate(-0.9); rr(g, -44, -14, 88, 16, 5); fillOl(g, key ? '#e0c060' : '#a06a32', 4); g.restore();
    g.fillStyle = '#3a3a3e'; g.fillRect(-7, -32, 14, 14);
    if (!open) { g.font = '30px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('❔', 0, -80 + Math.sin(t * 3) * 5); }
    g.restore();
  }
  const DOOR_POS = { x: 650, y: 40, w: 300, h: 170 };
  function drawDoor(g, look, open, t, ready, spot) {
    const D = window.TZS.DOORS.find((d) => d.key === look) || window.TZS.DOORS[0], { x, y, w, h } = spot || DOOR_POS;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x - 10, y + h, w + 20, 18);
    if (look === 'vault') { rr(g, x, y, w, h, 14); fillOl(g, '#8a8f98', 5); circ(g, x + w / 2, y + h / 2, h * 0.42); fillOl(g, open ? '#1a1410' : '#c9a646', 5); if (!open) { g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(t * 0.5); g.strokeStyle = OL; g.lineWidth = 8; for (let i = 0; i < 3; i++) { g.rotate(TAU / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(h * 0.3, 0); g.stroke(); } g.restore(); } }
    else if (look === 'hatch') { g.beginPath(); g.ellipse(x + w / 2, y + h / 2 + 20, w * 0.45, h * 0.4, 0, 0, TAU); fillOl(g, open ? '#0d140d' : '#4a5a48', 5); if (!open) { g.strokeStyle = '#2b302c'; g.lineWidth = 6; g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(x + w / 2 + i * 26, y + h * 0.2 + 20); g.lineTo(x + w / 2 + i * 26, y + h * 0.8 + 20); } g.stroke(); } else { g.fillStyle = 'rgba(156,255,60,0.4)'; g.beginPath(); g.ellipse(x + w / 2, y + h / 2 + 20, w * 0.35, h * 0.28, 0, 0, TAU); g.fill(); } }
    else if (look === 'lift') { rr(g, x, y, w, h, 6); fillOl(g, '#5a5f66', 5); const gap = open ? w * 0.42 : 2; g.fillStyle = '#9aa0a8'; g.fillRect(x + 12, y + 12, w / 2 - 12 - gap, h - 12); g.fillRect(x + w / 2 + gap, y + 12, w / 2 - 12 - gap, h - 12); g.fillStyle = open ? '#1a1410' : '#555'; if (open) g.fillRect(x + w / 2 - gap, y + 12, gap * 2, h - 12); g.fillStyle = '#ff5a3c'; g.fillRect(x + w / 2 - 20, y - 18, 40, 14); }
    else if (look === 'tunnel') { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + 50); g.quadraticCurveTo(x + w / 2, y - 50, x + w, y + 50); g.lineTo(x + w, y + h); g.closePath(); fillOl(g, '#a0407a', 5); g.beginPath(); g.moveTo(x + 40, y + h); g.lineTo(x + 40, y + 70); g.quadraticCurveTo(x + w / 2, y + 5, x + w - 40, y + 70); g.lineTo(x + w - 40, y + h); g.closePath(); fillOl(g, open ? '#140a10' : '#3a1030', 4); for (let i = 0; i < 6; i++) { g.fillStyle = Math.sin(t * 6 + i) > 0 ? '#ffd23f' : '#7a5a1a'; circ(g, x + 20 + i * (w - 40) / 5, y + 40 + Math.abs(i - 2.5) * 14, 7); g.fill(); } }
    else { rr(g, x, y, w, h, 4); fillOl(g, '#b4552a', 5); g.fillStyle = '#ffd23f'; for (let i = 0; i < 8; i++) g.fillRect(x + i * w / 8, y + h - 22, w / 16, 22); const jaw = open ? 0 : 1; g.fillStyle = '#2b2f33'; g.fillRect(x + 30, y + 26, w - 60, (h - 70) * jaw + 6); if (open) { g.fillStyle = '#1a1410'; g.fillRect(x + 30, y + 30, w - 60, h - 70); } }
    // the sign
    g.font = 'bold 26px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = OL;
    const label = open ? '☠️ ' + D.name.toUpperCase() : ready ? '🗝️ Walk up to open' : '🔒 Needs the 3-piece key';
    g.strokeText(label, x + w / 2, y + h + 44); g.fillStyle = open ? '#ff5a3c' : ready ? '#9cff3c' : '#ffd23f'; g.fillText(label, x + w / 2, y + h + 44);
    g.restore();
  }
  // A locked exit: a chained gate across the lane with the kill counter.
  function drawGate(g, dir, left, t, road) {
    const W = window.TZW, p = road ? road.p : (dir === 'n' || dir === 's' ? W.AW / 2 : W.AH / 2), hw = road ? road.w / 2 + 30 : 100, x = dir === 'w' ? 0 : dir === 'e' ? W.AW : p, y = dir === 'n' ? 0 : dir === 's' ? W.AH : p, horiz = dir === 'n' || dir === 's';
    g.save(); g.translate(x, y); if (!horiz) g.rotate(Math.PI / 2);
    rr(g, -hw, -18, hw * 2, 36, 6); fillOl(g, '#5a5f66', 3);
    g.strokeStyle = '#2b2f33'; g.lineWidth = 4; g.beginPath(); for (let i = -hw + 10; i <= hw - 10; i += 18) { g.moveTo(i, -16); g.lineTo(i + 10, 16); } g.stroke();
    g.strokeStyle = '#c9ccd1'; g.lineWidth = 6; g.setLineDash([10, 6]); g.beginPath(); g.moveTo(-hw + 4, -10); g.lineTo(hw - 4, 10); g.moveTo(-hw + 4, 10); g.lineTo(hw - 4, -10); g.stroke(); g.setLineDash([]);
    rr(g, -16, -22, 32, 34, 6); fillOl(g, '#ffd23f', 4);
    g.restore();
    const lx = dir === 'w' ? 60 : dir === 'e' ? W.AW - 60 : p, ly = dir === 'n' ? 70 : dir === 's' ? W.AH - 70 : p - 60;
    g.font = 'bold 26px "Lilita One", sans-serif'; g.textAlign = dir === 'w' ? 'left' : dir === 'e' ? 'right' : 'center'; g.textBaseline = 'middle';
    const s = `🔒 ${left} zombies to break through`; g.lineWidth = 6; g.strokeStyle = OL; g.strokeText(s, lx, ly); g.fillStyle = '#ffd23f'; g.fillText(s, lx, ly);
  }
  window.TZB = { drawBoss, stepBoss, drawCrate, drawDoor, drawGate, DOOR_POS };
})();
