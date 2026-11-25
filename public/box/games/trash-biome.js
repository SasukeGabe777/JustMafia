'use strict';
// JustZombies on the phone: the wild realms (extends TZSim.Sim; after trash-heli.js). The map is a mix of a
// few town blocks and the countryside, the frozen north and volcano land (trash-world.js town(): realms).
//   Frozen: ice sheets and the frozen lake are slippery (you keep your momentum); frozen zombies are slower but
//     tougher and shatter when they die; when the weather turns (rain / fog) up here it's a blizzard that
//     closes in around you. Snow falls all the time.
//   Volcano: lava rivers burn you (and the zombies that blunder in); ember zombies hit harder and burst into
//     flame when they die (hurting the zombies round them); ash falls; every so often the volcano ERUPTS:
//     warning rings on the ground, then fireballs come down on them.
//   Country: open fields (half of them come over the fences from every side), tall corn hides the zombies in
//     it until they're close, hay bales are cover; farmer zombies.
// Uses TZW (realms, hazards on the area), the hooks of trash-sim / trash-iso (drawExtraGround, extraStanding,
// drawBiomeSky).
(function () {
  const W = window.TZW, TAU = Math.PI * 2;
  const Sim = window.TZSim.Sim, proto = Sim.prototype;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const B = { iceGrip: 0.06, lavaDps: 18, lavaZ: 40, eruptEvery: [28, 46], eruptWarn: 2.2, eruptFall: 0.7, eruptN: [5, 8], eruptRad: 95, eruptDmg: 26,
    frost: { speed: 0.8, hp: 1.35 }, ember: { speed: 1.06, dmg: 1.3 }, farmer: { hp: 1.12 } };
  const realm = (s) => (s.area && s.area.realm) || 'city';
  // the hazard under a spot (lava rectangles, ice ellipses)
  proto.hazardAt = function (x, y) {
    const H = this.area && this.area.hazards; if (!H || !H.length) return null;
    for (const h of H) {
      if (h.kind === 'lava') { if (x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.h) return 'lava'; }
      else { const dx = (x - h.x - h.w / 2) / (h.w / 2), dy = (y - h.y - h.h / 2) / (h.h / 2); if (dx * dx + dy * dy < 1) return 'ice'; }
    }
    return null;
  };
  proto.inCorn = function (z) { const L = this.area && this.area.soft; if (!L) return false; for (const o of L) if (o.hide && z.x > o.x - 10 && z.x < o.x + o.w + 10 && z.y > o.y - 10 && z.y < o.y + o.h + 10) return true; return false; };
  // on the ice you slide: the new velocity only creeps toward where you push
  const baseMove = proto.moveYou;
  proto.moveYou = function (dt, I) {
    const P = this.p, vx0 = P.vx || 0, vy0 = P.vy || 0, onIce = !this.heli && !(this.airborne && this.airborne()) && this.hazardAt(P.x, P.y) === 'ice';
    const out = baseMove.call(this, dt, I);
    if (onIce && !this.ride) {
      const g = 1 - Math.pow(1 - B.iceGrip, dt * 60), nvx = vx0 + (P.vx - vx0) * g, nvy = vy0 + (P.vy - vy0) * g;
      P.x += (nvx - P.vx) * dt; P.y += (nvy - P.vy) * dt; P.vx = nvx; P.vy = nvy; P.moving = Math.hypot(nvx, nvy) > 30; this.onIce = true;
      if (!this._iceSaid) { this._iceSaid = true; this.popup('SLIPPERY!', '#bfefff', P.x, P.y - 110); }
      this.collide(P);
    } else this.onIce = false;
    return out;
  };
  // lava: it burns you (unless you fly over it) and the zombies that walk in; the volcano erupts now and then
  const baseRideStep = proto.rideStep;
  proto.rideStep = function (dt) {
    if (baseRideStep) baseRideStep.call(this, dt);
    this.biomeStep(dt);
  };
  proto.biomeStep = function (dt) {
    const P = this.p, A = this.area; if (!A || this.phase !== 'play') return;
    if (A.hazards && A.hazards.length) {
      const up = this.heli || (this.airborne && this.airborne());
      if (!up && !this.dead && this.hazardAt(P.x, P.y) === 'lava') {
        this.lavaT = (this.lavaT || 0) - dt; this.inLava = true;
        if (this.lavaT <= 0 && P.inv < 5) { this.lavaT = 0.3; const inv = P.inv; P.inv = 0; this.hurt(B.lavaDps * 0.3, P.x, P.y); if (P.inv < inv) P.inv = inv; if (!this._lavaSaid) { this._lavaSaid = true; this.banner = { text: '🔥 LAVA!', sub: 'It burns: get out (or fly over it)', t: 1.8 }; } if (this.fx.length < 200) this.particle(P.x, P.y - 10, (this.rng() - 0.5) * 80, -90, '#ff8c2e', 0.5, 5); }
      } else this.inLava = false;
      if (this.mode !== 'guest') for (const z of this.z) { if (z.hp <= 0 || z.boss || z.fb || z.mb) continue; if ((z.lavaT || 0) > this.t) continue; if (this.hazardAt(z.x, z.y) === 'lava') { z.lavaT = this.t + 0.25; this.damageZ(z, B.lavaZ * 0.25 * (1 + 0.05 * this.wave), this.me.id, 0, 0, { burn: 1 }); } }
    }
    // the eruption (volcano land only; solo or the area's host decides, everyone sees it from the snapshot fx)
    if (realm(this) === 'volcano' && this.mode !== 'guest') {
      const E = this.erupt || (this.erupt = { t: B.eruptEvery[0] * 0.6, spots: null, ph: 'wait' });
      E.t -= dt;
      if (E.ph === 'wait' && E.t <= 0 && !this.dead) {
        const n = B.eruptN[0] + Math.floor(this.rng() * (B.eruptN[1] - B.eruptN[0] + 1)); E.spots = [];
        for (let i = 0; i < n; i++) { const a = this.rng() * TAU, d = 60 + this.rng() * 420; E.spots.push({ x: clamp(P.x + Math.cos(a) * d, 60, W.AW - 60), y: clamp(P.y + Math.sin(a) * d, 60, W.AH - 60) }); }
        E.ph = 'warn'; E.t = B.eruptWarn; this.shake = Math.max(this.shake, 0.35); this.banner = { text: '🌋 ERUPTION!', sub: 'Fireballs incoming: get out of the red rings', t: 2 }; this.o.on('erupt', {});
      } else if (E.ph === 'warn' && E.t <= 0) { E.ph = 'fall'; E.t = B.eruptFall; }
      else if (E.ph === 'fall' && E.t <= 0) {
        for (const q of E.spots) this.boom(q.x, q.y, B.eruptRad, B.eruptDmg * (1 + 0.04 * this.wave), '#ff6a2a', true);
        E.ph = 'wait'; E.spots = null; E.t = B.eruptEvery[0] + this.rng() * (B.eruptEvery[1] - B.eruptEvery[0]);
      }
    } else if (this.erupt && realm(this) !== 'volcano') this.erupt = null;
    this.snowT = (this.snowT || 0) + dt;
  };
  // the realm's zombie looks (and how they play)
  const baseMakeZ = proto.makeZ;
  proto.makeZ = function (type, x, y) {
    const z = baseMakeZ.call(this, type, x, y), R0 = realm(this), Zd = W.ZOMBIES[type] || {};
    if (Zd.boss || z.fb || z.mb || type === 'icecream' || type === 'compactor') return z;
    if (R0 === 'frozen') { z.variant = 'frost'; z.speed *= B.frost.speed; z.hp *= B.frost.hp; z.mhp *= B.frost.hp; }
    else if (R0 === 'volcano') { z.variant = 'ember'; z.speed *= B.ember.speed; z.dmg *= B.ember.dmg; }
    else if (R0 === 'country' && (z.id % 2 === 0)) { z.variant = 'farmer'; z.hp *= B.farmer.hp; z.mhp *= B.farmer.hp; }
    return z;
  };
  const baseKill = proto.killZ;
  proto.killZ = function (z, by) {
    baseKill.call(this, z, by);
    if (z.variant === 'frost') { for (let i = 0; i < 10 && this.fx.length < 210; i++) this.particle(z.x, z.y - 30, (this.rng() - 0.5) * 320, -60 - this.rng() * 240, i % 2 ? '#dff4ff' : '#8fd0ff', 0.6, 6); this.snd('splat', z.x, z.y); this.shattered = (this.shattered || 0) + 1; }
    else if (z.variant === 'ember' && this.mode !== 'guest') { this.fx.push({ k: 'fire', x: z.x, y: z.y - 10, r: 50, t: 0, life: 0.35 }); for (const q of this.z) { if (q === z || q.hp <= 0) continue; const dx = q.x - z.x, dy = q.y - z.y; if (dx * dx + dy * dy < 70 * 70) this.damageZ(q, 12 * (1 + 0.05 * this.wave), this.me.id, 0, 0, { burn: 1 }); } }
  };
  // country: wide open, they come over the fences from every side
  const baseSpawn = proto.spawnOne;
  proto.spawnOne = function (type) {
    if (realm(this) !== 'country' || this.rng() < 0.5) return baseSpawn.call(this, type);
    const ex = this.area.exits, saved = { ...ex }; for (const k of Object.keys(ex)) ex[k] = null; // (no road bias this time)
    try { return baseSpawn.call(this, type); } finally { Object.assign(ex, saved); }
  };
  // the eruption's warning rings (on the ground) and the falling fireballs (standing up)
  const baseGround = proto.drawExtraGround;
  proto.drawExtraGround = function (g, t, vis) {
    if (baseGround) baseGround.call(this, g, t, vis);
    const E = this.erupt; if (!E || !E.spots) return;
    const u = E.ph === 'warn' ? 1 - E.t / B.eruptWarn : 1, pulse = 0.5 + 0.5 * Math.sin(t * 14);
    for (const q of E.spots) { g.globalAlpha = 0.25 + 0.35 * pulse; g.fillStyle = '#ff3a1a'; g.beginPath(); g.arc(q.x, q.y, B.eruptRad * (0.4 + 0.6 * u), 0, TAU); g.fill(); g.globalAlpha = 0.9; g.strokeStyle = '#ffb02e'; g.lineWidth = 5; g.beginPath(); g.arc(q.x, q.y, B.eruptRad, 0, TAU); g.stroke(); }
    g.globalAlpha = 1;
  };
  const baseStanding = proto.extraStanding;
  proto.extraStanding = function (list) {
    if (baseStanding) baseStanding.call(this, list);
    const E = this.erupt; if (!E || !E.spots || E.ph === 'wait') return;
    const h = E.ph === 'warn' ? 900 : (E.t / B.eruptFall) * 700;
    for (const q of E.spots) list.push({ x: q.x, y: q.y, dz: 2000, draw: (g, t) => { const y = q.y - h; g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(q.x, y, 2, q.x, y, 46); gr.addColorStop(0, 'rgba(255,240,170,1)'); gr.addColorStop(0.4, 'rgba(255,120,30,0.9)'); gr.addColorStop(1, 'rgba(255,40,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(q.x, y, 46, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#3a2a24'; g.beginPath(); g.arc(q.x, y, 14, 0, TAU); g.fill(); g.strokeStyle = 'rgba(80,70,70,0.5)'; g.lineWidth = 10; g.beginPath(); g.moveTo(q.x, y - 20); g.lineTo(q.x + 6, y - 120); g.stroke(); void t; } });
  };
  const baseHoles = proto.lightHoles;
  proto.lightHoles = function (hole) { if (baseHoles) baseHoles.call(this, hole); const H = this.area && this.area.hazards; if (!H) return; let n = 0; for (const h of H) if (h.kind === 'lava' && (n++ % 3 === 0)) hole(h.x + h.w / 2, h.y + h.h / 2, 130, 0.45); };
  // the sky over the realm (screen space): snowfall and the blizzard up north, ash in volcano land
  proto.blizzard = function () { return realm(this) === 'frozen' && (this.wxk === 'rain' || this.wxk === 'fog'); };
  proto.drawBiomeSky = function (g, V, t, C) {
    const R0 = realm(this), w = V.w, h = V.h; if (R0 !== 'frozen' && R0 !== 'volcano') return;
    const fr = R0 === 'frozen', bl = fr && this.blizzard(), n = fr ? (bl ? 160 : 70) : 60;
    g.fillStyle = fr ? 'rgba(255,255,255,0.85)' : 'rgba(70,62,62,0.75)';
    for (let i = 0; i < n; i++) { const sp = 30 + (i % 7) * 12, x = ((i * 173.3 + t * (bl ? 260 : fr ? 30 : 18) * (1 + (i % 3) * 0.3)) % (w + 40)) - 20, y = ((i * 97.7 + t * sp * (fr ? 1 : 0.6)) % (h + 40)) - 20, r = fr ? 1.5 + (i % 3) : 1.2 + (i % 2); g.globalAlpha = fr ? 0.75 : 0.6; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    if (!fr) { g.globalAlpha = 1; for (let i = 0; i < 10; i++) { const x = ((i * 211 + t * 40) % (w + 20)) - 10, y = h - ((i * 131 + t * 70) % (h + 20)); g.fillStyle = 'rgba(255,140,40,0.8)'; g.fillRect(x, y, 2.5, 2.5); } }
    g.globalAlpha = 1;
    if (bl) { // the blizzard: white-out except close round you
      const [X, Y] = C.toScreen(this.p.x, this.p.y, 40), R1 = Math.min(w, h) * 0.22, R2 = Math.max(w, h) * 0.6, gr = g.createRadialGradient(X, Y, R1, X, Y, R2); gr.addColorStop(0, 'rgba(235,242,250,0)'); gr.addColorStop(1, 'rgba(235,242,250,0.88)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
  };
  window.TZBiome = { B };
})();
