'use strict';
// JustZombies: your hero's arms, held gun and moves in the iso view (window.TZH; used by trash-iso.js).
// The JustGameBox character is drawn WITHOUT its own arms (BOX.drawChar noArms); these arms (sleeves in
// the outfit colour, hands in the skin tone, from BOX.armLook) run from the shoulders to the weapon:
// one arm for pistols / SMGs (the other hangs, or swings a bat / saw), two for long guns with the support
// hand on the fore-grip. Recoil goes through the hands (elbows bend), the muzzle climbs, the body leans;
// the minigun shakes as it spins up; the launcher kicks hard. Picking a weapon up is a short crouch-and-
// grab (the item flies into the hands), a timed super weapon is caught out of the air, a swap lowers the
// old gun and raises the new one, cash / health / armour get a quick grab and a flash.
// Pure helpers (equipStep, pose) are tested in tools/test-box-trash.js.
(function () {
  const TAU = Math.PI * 2, clamp = (v, a, b) => (v < a ? a : v > b ? b : v), lerp = (a, b, u) => a + (b - a) * u;
  const ease = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  // the art key of the held gun -> one-handed?
  const ONE = { 'weapon.pistol': 1, 'pickup.raygun': 1, 'weapon.nailgun': 1, 'weapon.smg': 1 };
  const DUR = { weapon: 0.42, catch: 0.45, swap: 0.3, small: 0.3 };
  // recoil per gun (how far the hands go back, the muzzle climb, the body lean)
  const KICK = { 'pickup.minigun': [2.2, 0.03, 0.01], 'weapon.launcher': [11, 0.32, 0.09], 'pickup.rockets': [8, 0.2, 0.06], 'weapon.shotgun': [8, 0.22, 0.06], 'weapon.rail': [7, 0.18, 0.05], 'weapon.crossbow': [4, 0.08, 0.02] };
  const KICK0 = [4.5, 0.14, 0.035];

  // The equip state machine. E: kept between frames; key: the held gun's art key; grab: the sim's last
  // grab ({ kind: 'weapon'|'catch'|'small', k, at, x, y }); now: sim time. Returns E with
  // E.kind / E.t (the running move), E.u (0..1 progress), E.active, E.old (the gun before a swap),
  // E.st / E.sk (a small grab reaction running).
  function equipStep(E, key, grab, now, dt) {
    E = E || {};
    if (E.key === undefined) { E.key = key; E.t = 9; E.st = 9; E.kind = null; E.ga = grab ? grab.at : null; }
    const fresh = !!(grab && grab.at !== E.ga && now - grab.at < 0.8);
    if (fresh) E.ga = grab.at;
    if (fresh && grab.kind === 'small') { if (!(E.st < 0.5)) { E.st = 0; E.sk = grab.k || 'cash'; } }
    else if (fresh) { E.kind = grab.kind === 'catch' ? 'catch' : 'weapon'; E.t = 0; E.old = E.key; E.from = grab.x != null ? [grab.x, grab.y] : null; }
    if (key !== E.key) { if (!(E.t < 0.15 && E.kind && E.kind !== 'swap')) { E.kind = E.key ? 'swap' : null; E.t = 0; E.old = E.key; } E.key = key; }
    E.t += dt; E.st = (E.st == null ? 9 : E.st) + dt;
    const d = DUR[E.kind] || 0.3; E.u = clamp(E.t / d, 0, 1); E.active = !!E.kind && E.t < d;
    E.su = clamp(E.st / DUR.small, 0, 1); E.sActive = E.st < DUR.small;
    return E;
  }
  // 2-bone reach: the elbow for a shoulder S and a hand T with forearm / upper-arm length a (the elbow
  // drops below the line). Returns [elbow, hand] (the hand is pulled in if out of reach).
  function ik(S, T, a) {
    let dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy) || 1e-6; const max = 2 * a * 0.995;
    if (d > max) { T = [S[0] + (dx / d) * max, S[1] + (dy / d) * max]; dx = T[0] - S[0]; dy = T[1] - S[1]; d = max; }
    const h = Math.sqrt(Math.max(0, a * a - (d / 2) * (d / 2))), mx = S[0] + dx / 2, my = S[1] + dy / 2, nx = -dy / d, ny = dx / d;
    const e1 = [mx + nx * h, my + ny * h], e2 = [mx - nx * h, my - ny * h];
    return [e1[1] >= e2[1] ? e1 : e2, T];
  }
  // Where everything goes this frame (screen px). o: { X, Y (feet), s (screen px per unit), face (±1),
  // aS (aim, screen radians), key, kick (0..1), bob (character units), moving, walkT, t, firing, mini (spin 0..1),
  // AL (BOX.armLook), E (equipStep), gunLen (px), gg / gf (grip / fore-grip along the gun 0..1), melee ({ a, swing } or null) }
  function pose(o) {
    const AL = o.AL, K = 1.15 * o.s, face = o.face, E = o.E || {};
    const one = !!ONE[o.key], KK = KICK[o.key] || KICK0, kick = o.kick || 0;
    // the body: recoil lean back, a walk sway, the crouch of a grab
    let crouch = 0; if (E.active && E.kind === 'weapon') crouch = Math.sin(Math.PI * clamp(E.u / 0.9, 0, 1));
    if (E.sActive) crouch = Math.max(crouch, 0.45 * Math.sin(Math.PI * E.su));
    const c0 = Math.cos(o.aS), s0 = Math.sin(o.aS);
    const body = { dx: -c0 * kick * KK[2] * 30 * o.s, dy: crouch * 9 * K, lean: -face * kick * KK[2] + (o.moving ? face * 0.04 : 0) + face * crouch * 0.12, sq: 1 - crouch * 0.16 };
    // shoulders (front = the aim side), moved with the body (lean about the feet)
    const sy = o.Y + (AL.y - (o.bob || 0)) * K * body.sq + body.dy, cl = Math.cos(body.lean), sl = Math.sin(body.lean);
    const sh = (side) => { const lx = side * face * AL.sw * K, ly = sy - o.Y; return [o.X + body.dx + lx * cl - ly * sl, o.Y + lx * sl + ly * cl]; };
    const SF = sh(1), SB = sh(-1);
    // the aim: the muzzle climbs on recoil, the minigun shakes; a grab / swap lowers the gun
    let ang = o.aS - face * kick * KK[1];
    if (o.mini > 0 && o.firing) ang += (Math.sin(o.t * 61) + Math.sin(o.t * 37)) * 0.02 * o.mini;
    const low = Math.atan2(0.92, 0.38 * face); // low ready: muzzle down and forward
    let lowK = 0, gunKey = o.key, item = null;
    if (E.active) {
      if (E.kind === 'swap') { lowK = Math.sin(Math.PI * E.u); if (E.u < 0.5 && E.old) gunKey = E.old; }
      else if (E.kind === 'weapon') lowK = E.u < 0.55 ? 1 : 1 - ease((E.u - 0.55) / 0.45);
      else if (E.kind === 'catch') lowK = E.u < 0.5 ? 0.6 : 0.6 * (1 - ease((E.u - 0.5) / 0.5));
    }
    const da = Math.atan2(Math.sin(low - ang), Math.cos(low - ang)); ang += da * lowK;
    const c = Math.cos(ang), sn = Math.sin(ang);
    const back = (one ? 4 : 6) * K * 0 + kick * KK[0] * o.s; // hands pushed back by the shot
    let G, F = null;
    if (one) G = [SF[0] + c * 12.5 * K - c * back, SF[1] + sn * 12.5 * K - sn * back + 1.5 * K];
    else {
      const mid = [(SF[0] + SB[0]) / 2 - face * 3 * K, (SF[1] + SB[1]) / 2 + 6 * K], L = o.gunLen * ((o.gf || 0.6) - (o.gg || 0.3)), reach = AL.len * 0.56 * 2 * K * 0.97;
      G = [mid[0] + c * 3 * K - c * back, mid[1] + sn * 4 * K - sn * back];
      // both hands must reach: the back hand the grip, the front hand the fore-grip (pull the gun in until they do)
      for (let i = 0; i < 24; i++) { const fx = G[0] + c * L - SF[0], fy = G[1] + sn * L - SF[1]; if (fx * fx + fy * fy <= reach * reach) break; G = [G[0] - c * 1.5 * K + (SF[0] - G[0] - c * L) * 0.04, G[1] - sn * 1.5 * K + (SF[1] - G[1] - sn * L) * 0.04]; }
      { const gx = G[0] - SB[0], gy = G[1] - SB[1], d = Math.hypot(gx, gy); if (d > reach) G = [SB[0] + (gx / d) * reach, SB[1] + (gy / d) * reach]; }
      F = [G[0] + c * L, G[1] + sn * L];
    }
    // a grab: both hands reach down to the item on the ground in front of you, then bring it up
    const ground = [o.X + face * 14 * K, o.Y - 3 * K];
    if (E.active && E.kind === 'weapon') {
      const r = E.u < 0.45 ? Math.sin(Math.PI * E.u / 0.9) : 1 - ease((E.u - 0.45) / 0.55);
      G = [lerp(G[0], ground[0], r), lerp(G[1], ground[1], r)]; if (F) F = [lerp(F[0], ground[0] + c * 8 * K, r), lerp(F[1], ground[1] + sn * 8 * K, r)];
      const fu = clamp(E.u / 0.45, 0, 1); item = { x: lerp(ground[0], G[0], ease(fu)), y: lerp(ground[1] - 2 * K, G[1], ease(fu)) - Math.sin(Math.PI * fu) * 10 * K, k: 1 - fu, spin: (1 - fu) * 1.4 };
    } else if (E.active && E.kind === 'catch') {
      const fu = clamp(E.u / 0.5, 0, 1), up = Math.sin(Math.PI * clamp(E.u / 0.5, 0, 1)) * 6 * K;
      G = [G[0], G[1] - up]; if (F) F = [F[0], F[1] - up];
      item = { x: lerp(G[0] + face * 20 * K, G[0], ease(fu)), y: lerp(G[1] - 90 * K, G[1], fu * fu), k: 1 - fu, spin: (1 - fu) * 2.2 };
    }
    // the free hand (one-handed guns): hangs and sways, grabs cash / health, or swings the melee weapon
    let free = null, swing = null;
    if (one) {
      const sw = o.moving ? Math.sin(o.walkT * 11 * 1.27) * 2.2 * K : Math.sin(o.t * 2) * 0.6 * K;
      free = [SB[0] - face * 2.5 * K + sw, SB[1] + 13 * K];
      if (o.melee) {
        const u = o.melee.swing || 0, sa = u > 0.02 ? o.melee.a + ((1 - u) * 2.6 - 1.3) * face : Math.atan2(0.95, -face * 0.35); // (at rest: hanging by your side)
        free = [SB[0] + Math.cos(sa) * 12 * K, SB[1] + Math.sin(sa) * 12 * K + 2 * K]; swing = { a: sa, u };
      }
      if (E.sActive) { const r = Math.sin(Math.PI * E.su); free = [lerp(free[0], ground[0] - face * 4 * K, r), lerp(free[1], ground[1] - 4 * K, r)]; }
    } else if (o.melee && o.melee.swing > 0.02) { const sa = o.melee.a + ((1 - o.melee.swing) * 2.6 - 1.3) * face; swing = { a: sa, u: o.melee.swing, at: [SB[0] + Math.cos(sa) * 6 * K, SB[1] + Math.sin(sa) * 6 * K + 3 * K] }; // (two-handed gun: the bat / saw swings from your back shoulder)
    }
    if (!one && E.sActive) { const r = Math.sin(Math.PI * E.su) * 0.6; F = [lerp(F[0], ground[0], r), lerp(F[1], ground[1], r)]; }
    const behind = sn < -0.35; // aiming away (up the screen): gun and arms go behind you
    return { SF, SB, G, F, free, swing, ang, c, sn, one, body, behind, gunKey, item, K, flash: E.sActive ? { x: (free || F || G)[0], y: (free || F || G)[1], u: E.su, k: E.sk } : null };
  }
  // an arm from shoulder S to hand T (sleeve, ink edge), the hand drawn by hand()
  function arm(g, S, T, AL, K) {
    const [E, H] = ik(S, T, AL.len * 0.56 * K), w = Math.max(2, AL.w * K * 0.92);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = AL.ink || '#2b1f3d'; g.lineWidth = w + Math.max(1.6, 1.5 * K); g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(E[0], E[1]); g.lineTo(H[0], H[1]); g.stroke();
    g.strokeStyle = AL.sleeve; g.lineWidth = w; g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(E[0], E[1]); g.lineTo(H[0], H[1]); g.stroke();
    // a little shade down the sleeve
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = w * 0.35; g.beginPath(); g.moveTo(E[0], E[1] + w * 0.25); g.lineTo(H[0], H[1] + w * 0.25); g.stroke();
    return H;
  }
  function hand(g, H, AL, K) { const r = Math.max(1.8, AL.hand * K * 1.05); g.fillStyle = AL.skin; g.strokeStyle = AL.ink || '#2b1f3d'; g.lineWidth = Math.max(1, 1.3 * K); g.beginPath(); g.arc(H[0], H[1], r, 0, TAU); g.fill(); g.stroke(); }
  // a bat or a chainsaw in the free hand (with a swoosh while it swings)
  function melee(g, id, H, a, u, K, tier, t) {
    g.save(); g.translate(H[0], H[1]); g.rotate(a);
    if (u > 0.05) { g.globalAlpha = u * 0.5; g.strokeStyle = '#fff8e0'; g.lineWidth = 10 * K; g.beginPath(); g.arc(0, 0, 30 * K, -1.1, 0.1); g.stroke(); g.globalAlpha = 1; }
    g.strokeStyle = '#2b1f3d'; g.lineWidth = 1.3 * K;
    if (id === 'saw') { g.fillStyle = tier >= 3 ? '#e0b030' : '#d9a441'; g.beginPath(); g.rect(-3 * K, -5 * K, 13 * K, 10 * K); g.fill(); g.stroke(); g.fillStyle = '#c9ccd1'; g.beginPath(); g.rect(10 * K, -2.5 * K, 24 * K, 5 * K); g.fill(); g.stroke(); g.fillStyle = '#3a3f47'; for (let i = 0; i < 6; i++) g.fillRect((11 + i * 4 + ((t * 40) % 4)) * K, -3.6 * K, 2 * K, 1.4 * K); }
    else { g.fillStyle = tier >= 3 ? '#e0b030' : '#a8743a'; g.beginPath(); g.moveTo(-2 * K, -1.8 * K); g.lineTo(30 * K, -3.6 * K); g.quadraticCurveTo(33 * K, 0, 30 * K, 3.6 * K); g.lineTo(-2 * K, 1.8 * K); g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#c9ccd1'; for (let i = 0; i < 3; i++) g.fillRect((16 + i * 5) * K, -4.6 * K, 1.4 * K, 2 * K); }
    g.restore();
  }
  window.TZH = { ONE, KICK, DUR, equipStep, pose, ik, arm, hand, melee };
})();
