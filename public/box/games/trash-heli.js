'use strict';
// JustZombies on the phone: helipads, helicopter travel and the flying rides (extends TZSim.Sim; after
// trash-more.js). Uses TZW, TZX (trash-extra.js: HELI, helipads, padSpot, VEHICLES), the server op 'heli'.
//   Helipads: a few per map (seeded), found by exploring (the server shares them on the team's map).
//   Stand on one, tap 🚁 FLY, pick ANY block the team has explored: you board (the hero climbs in),
//   the chopper lifts off, the aerial view sweeps over the town (trash.js), then it hovers over the pad
//   at the other end and you slide down the rope. A cooldown (longer in Score attack / Party) keeps it fair;
//   friends in either block see the helicopter come and go.
//   Flying rides (rare, timed, with HP): the gunship (chain gun + rockets fire down by themselves), the
//   jetpack (short hops over zombies and walls), the hang-glider (always moving, you shoot as you soar).
//   While you're up high, walls don't stop you and zombies can't reach you (spit still can).
(function () {
  const W = window.TZW, X = window.TZX, TAU = Math.PI * 2;
  const Sim = window.TZSim.Sim, proto = Sim.prototype;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), d2 = (a, b, x, y) => (a - x) * (a - x) + (b - y) * (b - y);
  const H = X.HELI, PH = { board: 0.7, lift: 0.8, fly: H.flyS, drop: 1.5, away: 1.2 };
  const ease = (u) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };

  // ---------------- helipads ----------------
  Object.assign(proto, {
    padHere() {
      if (!this.area) return null;
      if (!this._padA || this._padA.area !== this.area) this._padA = { area: this.area, pad: X.isPad(this.seed, this.cell[0], this.cell[1]) ? X.padSpot(this.area) : null };
      return this._padA.pad;
    },
    heliWait() { return Math.max(0, ((this.heliAt || 0) - Date.now()) / 1000); },
    nearPad() {
      const pd = this.padHere(); if (!pd || this.heli || this.ride || this.boarding || this.dead || this.down || this.phase !== 'play' || this.build || this.hordeS) return null;
      return d2(pd.x, pd.y, this.p.x, this.p.y) < H.near * H.near ? pd : null;
    },
    // ask the server to fly to block k ("x,y"); the flight starts when it says yes
    heliGo(k) {
      if (this.heli || this._heliAsk || !this.nearPad()) return Promise.resolve({ ok: false, error: 'Stand on the helipad.' });
      this._heliAsk = true;
      return this.o.report({ op: 'heli', to: k }, true).then((r) => {
        this._heliAsk = false;
        if (!r || !r.ok) { if (r && r.wait) this.heliAt = Date.now() + r.wait; this.banner = { text: '🚁 NOT NOW', sub: (r && r.error) || 'The pilot can’t fly right now.', t: 2.4 }; return r || { ok: false }; }
        const [x, y] = String(r.to).split(',').map(Number), pd = this.padHere();
        this.heliAt = Date.now() + (r.cd || H.cd);
        this.heli = { phase: 'board', t: 0, to: [x, y], from: this.cell.slice(), pad: { x: pd.x, y: pd.y }, x0: this.p.x, y0: this.p.y, area: r.area || null, name: (this.homes.some((h) => h[0] === x && h[1] === y) ? W.HOME : W.biomeOf(this.seed, x, y)).name };
        this.o.on('heli', { phase: 'board' }); return r;
      }).catch(() => { this._heliAsk = false; return { ok: false }; });
    },
    // where the chopper is (world x, y, height) and whether you're inside: for the renderers
    heliPose() {
      const h = this.heli; if (!h) return null; const u = h.t / PH[h.phase], pd = h.pad;
      if (h.phase === 'board') return { x: pd.x, y: pd.y, alt: 0, inside: u > 0.85, rotor: 0.5 + u };
      if (h.phase === 'lift') return { x: pd.x, y: pd.y - u * 40, alt: ease(u) * 150, inside: true, rotor: 1 };
      if (h.phase === 'fly') return { x: pd.x, y: pd.y, alt: 160, inside: true, rotor: 1, flying: true };
      if (h.phase === 'drop') { const dropU = clamp(u / 0.8, 0, 1); return { x: pd.x, y: pd.y, alt: 115, inside: false, rotor: 1, rope: 1 - clamp((u - 0.85) / 0.15, 0, 1), heroAlt: (1 - ease(dropU)) * 95 }; }
      return null;
    },
    heliStep(dt) {
      const h = this.heli, P = this.p;
      if (this.flyover) { this.flyover.t += dt; if (this.flyover.t > this.flyover.T) this.flyover = null; }
      if (!h) return;
      h.t += dt; P.inv = Math.max(P.inv, 0.6); P.vx = 0; P.vy = 0;
      if (h.phase === 'board') { const u = clamp(h.t / (PH.board * 0.8), 0, 1); P.x = h.x0 + (h.pad.x - h.x0) * u; P.y = h.y0 + (h.pad.y + 30 - h.y0) * u; P.moving = u < 1; if (P.moving) P.walkT += dt; }
      if (h.t < PH[h.phase]) return;
      h.t = 0;
      if (h.phase === 'board') { h.phase = 'lift'; this.o.on('heli', { phase: 'lift' }); }
      else if (h.phase === 'lift') { h.phase = 'fly'; this.heliArrive(); }
      else if (h.phase === 'fly') { h.phase = 'drop'; this.o.on('heli', { phase: 'drop' }); }
      else if (h.phase === 'drop') { // touch down: the chopper flies off, you're free
        this.heli = null; P.inv = Math.max(P.inv, 1.2); this.flyover = { kind: 'away', t: 0, T: PH.away, pad: h.pad, mine: true };
        this.banner = { text: '🚁 ' + h.name.toUpperCase(), sub: 'Dropped off. The pilot will be back in ' + Math.round(this.heliWait()) + ' s', t: 2.4 }; this.o.on('heli', { phase: 'down' });
      }
    },
    // the new block, as the chopper flies there (you arrive on its pad, the next wave waits for you)
    heliArrive() {
      const h = this.heli, [x, y] = h.to;
      this.wave++; this.enterArea(x, y, null); this.mode = 'solo'; this.areaMembers = [this.me.id]; this.host = this.me.id;
      if (h.area) this.setArea(h.area);
      const pd = this.padHere() || X.padSpot(this.area); h.pad = { x: pd.x, y: pd.y }; this.p.x = pd.x; this.p.y = pd.y + 20;
      this.startWave(); this.banner = null; this.spawnCd = Math.max(this.spawnCd || 0, PH.fly + PH.drop + 1); this.reportStatus(true);
      this.o.on('enter', { biome: this.area.biome, wave: this.wave, heli: true });
    },
  });
  // a friend's helicopter comes or goes (the server tells the block's members)
  const baseLive = proto.onLive;
  proto.onLive = function (m) {
    if (m && m.t === 'heli' && (!m.area || m.area === this.cell[0] + ',' + this.cell[1])) { if (m.id !== (this.me && this.me.id)) { const pd = this.padHere() || { x: this.p.x + 200, y: this.p.y - 100 }; this.flyover = { kind: m.phase === 'in' ? 'in' : 'off', t: 0, T: 3.2, pad: { x: pd.x, y: pd.y }, who: m.id }; this.o.on('heli', { phase: 'flyover' }); } return; }
    return baseLive.call(this, m);
  };
  // the chopper of a flyover: where it is
  proto.flyoverPose = function () {
    const F = this.flyover; if (!F) return null; const u = clamp(F.t / F.T, 0, 1), pd = F.pad;
    if (F.kind === 'away') return { x: pd.x + ease(u) * 900, y: pd.y - ease(u) * 500, alt: 115 + u * 200, alpha: 1 - clamp((u - 0.7) / 0.3, 0, 1) };
    if (F.kind === 'off') return { x: pd.x + ease(Math.max(0, u - 0.3) / 0.7) * 900, y: pd.y - ease(Math.max(0, u - 0.3) / 0.7) * 500, alt: ease(u / 0.4) * 200 + u * 150, alpha: 1 - clamp((u - 0.75) / 0.25, 0, 1) };
    const a = u < 0.4 ? ease(u / 0.4) : 1, b = u > 0.65 ? ease((u - 0.65) / 0.35) : 0; // 'in': flies in, hovers (the rope), flies off
    return { x: pd.x - (1 - a) * 900 + b * 900, y: pd.y + (1 - a) * 500 - b * 500, alt: 200 - a * 85 + b * 150, rope: u > 0.4 && u < 0.65 ? 1 : 0, alpha: u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1 };
  };

  // ---------------- flying rides ----------------
  const flyV = (r) => (r && X.VEHICLES[r.kind] && X.VEHICLES[r.kind].fly ? X.VEHICLES[r.kind] : null);
  proto.flying = function () { return flyV(this.ride) ? this.ride : null; };
  proto.airborne = function () { const r = this.flying(); return !!((r && (r.alt || 0) > 25) || (this.jet && this.jet.alt > 25)); };
  const baseEnterRide = proto.enterRide;
  proto.enterRide = function (v) {
    const out = baseEnterRide.call(this, v), r = this.ride, V = flyV(r);
    if (V) { r.fp = false; r.alt = r.alt || 0; r.hopT = 0; r.gcd = 0.4; r.rcd = 1; r.head = Math.atan2(Math.sin(this.p.aim), Math.cos(this.p.aim)); this.banner = { text: V.icon + ' ' + V.name.toUpperCase() + '!', sub: V.desc, t: 2.6 }; this.o.report({ op: 'ev', k: 'ride', id: r.kind }); }
    return out;
  };
  const baseCollide = proto.collide;
  proto.collide = function (e) { if (e === this.p && this.airborne()) return; return baseCollide.call(this, e); };
  const baseContact = proto.contact;
  proto.contact = function (dt) { if (this.airborne() || this.heli) return; return baseContact.call(this, dt); };
  const baseMove = proto.moveYou;
  proto.moveYou = function (dt, I) {
    if (this.heli) { if (this.p.inv > 0) this.p.inv -= dt; return; }
    const r = this.flying(), V = flyV(r);
    if (V && V.glide) { // the glider never stops: steer it
      const want = I.mx || I.my ? Math.atan2(I.my, I.mx) : r.head, da = Math.atan2(Math.sin(want - r.head), Math.cos(want - r.head));
      r.head += clamp(da, -2.6 * dt, 2.6 * dt); I = { ...I, mx: Math.cos(r.head), my: Math.sin(r.head) };
    }
    return baseMove.call(this, dt, I);
  };
  const baseShoot = proto.shoot;
  proto.shoot = function (dt, I) { if (this.heli) return; const r = this.flying(); if (r && r.kind === 'gunship') return; return baseShoot.call(this, dt, I); };
  const baseRide = proto.rideStep;
  proto.rideStep = function (dt) {
    baseRide.call(this, dt); this.heliStep(dt); this.rocketStep(dt);
    const r = this.flying(), V = flyV(r); if (!r) return; const P = this.p, sp = Math.hypot(P.vx, P.vy);
    // height: the gunship and the glider climb and stay up; the jetpack hops while you move
    if (V.hop) { if (sp > 40 || (r.alt || 0) > 4) { r.hopT += dt; const ph = (r.hopT % V.hop) / V.hop; r.alt = Math.sin(Math.PI * ph) * V.alt; if (sp <= 40 && ph > 0.9) { r.alt = 0; r.hopT = 0; } } else r.alt = 0; }
    else r.alt = (r.alt || 0) + (V.alt - (r.alt || 0)) * Math.min(1, dt * 2.2);
    if (this.airborne() && r.stuck) this.speedMul /= Math.max(0.12, 1 - 0.2 * r.stuck); // (up there nobody slows you down)
    // the gunship's guns fire down by themselves at the nearest zombies
    if (r.kind === 'gunship' && V.gun && r.alt > 60) {
      const G = V.gun, z = this.nearestZ(P.x, P.y, G.range); r.gcd -= dt; r.rcd -= dt;
      if (z && r.gcd <= 0) { r.gcd = 1 / G.rate; const a = Math.atan2(z.y - P.y, z.x - P.x) + (this.rng() - 0.5) * 0.08; P.aim = a; this.fireBullet(P.x, P.y, a, G.dmg); this.muzzle = 0.05; P.kick = 0.4; this.o.on('shot', { mini: true }); }
      if (z && r.rcd <= 0) { r.rcd = G.rocket; (this.rockets || (this.rockets = [])).push({ x0: P.x, y0: P.y, x: z.x, y: z.y, t: 0, T: Math.max(0.25, Math.hypot(z.x - P.x, z.y - P.y) / 900), alt: r.alt }); this.snd('cannon', P.x, P.y); }
    }
  };
  proto.rocketStep = function (dt) {
    const L = this.rockets; if (!L || !L.length) return; const V = X.VEHICLES.gunship.gun;
    for (let i = L.length - 1; i >= 0; i--) { const k = L[i]; k.t += dt; const u = Math.min(1, k.t / k.T);
      if (this.fx.length < 200) this.fx.push({ k: 's', x: k.x0 + (k.x - k.x0) * u, y: k.y0 + (k.y - k.y0) * u, h: k.alt * (1 - u), r: 8, t: 0, life: 0.5, a: 0.35, c: '#8a8580' });
      if (k.t >= k.T) { L.splice(i, 1); this.boom(k.x, k.y, V.rad, V.rdmg * (1 + 0.08 * this.wave), '#ff8c42', false); } }
  };
  // what the renderers stand up for us: the pad's chopper, the flight, a friend's flyover
  const baseStanding = proto.extraStanding;
  proto.extraStanding = function (list) {
    if (baseStanding) baseStanding.call(this, list);
    const pd = this.padHere(), hp = this.heliPose(), fo = this.flyoverPose();
    if (hp) list.push({ k: 'heli', x: hp.x, y: hp.y, alt: hp.alt, rope: hp.rope, heroAlt: hp.heroAlt, still: hp.rotor < 0.6, dz: hp.alt > 40 ? 4000 : 0 });
    else if (pd && this.heliWait() <= 0 && !(this.flyover && this.flyover.mine)) list.push({ k: 'heli', x: pd.x, y: pd.y, alt: 0, still: !this.nearPad(), parked: true, dz: 0 });
    if (fo) list.push({ k: 'heli', x: fo.x, y: fo.y, alt: fo.alt, rope: fo.rope, alpha: fo.alpha, dz: 4000 });
  };
  const baseHoles = proto.lightHoles;
  proto.lightHoles = function (hole) { if (baseHoles) baseHoles.call(this, hole); const pd = this.padHere(); if (pd) hole(pd.x, pd.y, 170, 0.55); const r = this.flying(); if (r) hole(this.p.x, this.p.y, 220, 0.6); };
  // the run save carries the cooldown
  const baseSave = proto.saveData;
  if (baseSave) proto.saveData = function () { const d = baseSave.call(this); if (d) d.heliAt = this.heliAt || 0; return d; };
  // ---------------- the jetpack (a rare pickup) ----------------
  // Walk over it: it straps on (the hero's quick grab). 10 s of fuel (the ring by you, the HUD timer): fly freely with
  // the walking controls, faster, shooting as usual, over walls, cars and hordes; melee / contact can't reach you up
  // there, but spit (spitters, the Sludge-type bosses' globs: anything thrown) still can. When it runs dry you float
  // down over ~1.25 s (you can steer a little) and land on open ground (never inside a wall: nudged out), dust puff.
  const JET = { alt: 75, speed: 1.5, fall: 1.25, fallSpeed: 0.45, drop: 0.04 };
  proto.jetAlt = function () { return this.jet ? this.jet.alt : 0; };
  const baseDrop = proto.dropPickup;
  proto.dropPickup = function (x, y) { if (this.rng() < JET.drop && !(this.pk || []).some((p) => p.k === 'jetpack')) { this.pk.push({ id: this.pkid++, k: 'jetpack', x: clamp(x, 60, W.AW - 60), y: clamp(y, 60, W.AH - 60), life: 22 }); return; } return baseDrop.call(this, x, y); };
  const baseApply = proto.applyPickup;
  proto.applyPickup = function (k) { const out = baseApply.call(this, k); if (k === 'jetpack') { this.jet = this.jet || { alt: 0 }; this.jet.fall = false; this.banner = { text: '🎒 JETPACK!', sub: '10 seconds of fuel: fly over everything', t: 2 }; this.o.on('jet', { on: true }); } return out; };
  // open ground nearest to (x, y) for a body of radius r
  proto.openSpot = function (x, y, r) {
    const hit = (px, py) => px < r || py < r || px > W.AW - r || py > W.AH - r || this.area.obstacles.some((o) => !o.low && px + r > o.x && px - r < o.x + o.w && py + r > o.y && py - r < o.y + o.h);
    if (!hit(x, y)) return { x, y };
    for (let d = 20; d < 700; d += 20) for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d; if (!hit(px, py)) return { x: px, y: py }; }
    return { x: this.area.hub.x, y: this.area.hub.y };
  };
  proto.jetStep = function (dt) {
    const J = this.jet, P = this.p, B = this.buffs; if (!J) return;
    if (this.dead || this.ride || this.heli) { this.jet = null; B.jetpack = 0; return; }
    if (B.jetpack > 0 && !J.fall) {
      J.alt += (JET.alt - J.alt) * Math.min(1, dt * 4); this.speedMul = (this.speedMul || 1) * JET.speed;
      if (this.fx.length < 200 && Math.random() < 0.6) this.fx.push({ k: 's', x: P.x + (this.rng() - 0.5) * 10, y: P.y + 4, h: Math.max(0, J.alt - 20), r: 9 + this.rng() * 6, t: 0, life: 0.8, a: 0.35, c: '#8a8580' });
    } else if (!J.fall) { J.fall = true; J.t = 0; J.a0 = J.alt; this.banner = { text: '🎒 OUT OF FUEL', sub: 'Floating down…', t: 1.4 }; this.o.on('jet', { on: false }); }
    if (J.fall) {
      J.t += dt; const u = Math.min(1, J.t / JET.fall); J.alt = J.a0 * (1 - u * u * (3 - 2 * u)); this.speedMul = (this.speedMul || 1) * JET.fallSpeed;
      if (u >= 1) { this.jet = null; const q = this.openSpot(P.x, P.y, P.r + 2); P.x = q.x; P.y = q.y; P.inv = Math.max(P.inv, 0.3);
        for (let i = 0; i < 8; i++) this.fx.push({ k: 's', x: P.x + (this.rng() - 0.5) * 50, y: P.y, r: 12 + this.rng() * 10, t: 0, life: 0.7, a: 0.45, c: '#b8a890' }); this.o.on('land', {}); }
    }
  };
  const baseRide2 = proto.rideStep;
  proto.rideStep = function (dt) { baseRide2.call(this, dt); this.jetStep(dt); };
  window.TZHeli = { PH, JET };
})();
