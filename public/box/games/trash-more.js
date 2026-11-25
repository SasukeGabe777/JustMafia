'use strict';
// TrashZombies on the phone, part 4 (extends TZSim.Sim; after trash-fight.js): the phase 3 systems.
//   vehicles (shopping cart, ride-on mower, the rare garbage truck), survivors to escort to a shop
//   or the clinic, gameplay weather (rain, fog, heat wave), Garage Defense (the build phase, the
//   horde at your garage door), the two new bosses and their arenas (an ice-cream truck that laps
//   the block and leaves slush, a compactor whose walls slam shut), gifts from helpers (supply
//   crates, hordes sent at the leader), the helpers' event vote, loadouts from unlocks (starting
//   weapon, outfit, difficulty tier, the new classes), the TV spotlight stream and the run save.
// Uses TZW, TZX (trash-extra.js), TZR, TZP, TZA, TZB.
(function () {
  const W = window.TZW, X = window.TZX, TAU = Math.PI * 2;
  const R = () => window.TZR, PP = () => window.TZP, A = () => window.TZA;
  const Sim = window.TZSim.Sim, proto = Sim.prototype;
  const d2 = (a, b, x, y) => (a - x) * (a - x) + (b - y) * (b - y);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const VK = ['', 'cart', 'mower', 'gtruck'], FITS = ['', 'cone', 'lid', 'chef', 'goggles', 'cape', 'crown'];
  const ZT = Object.keys(W.ZOMBIES);
  function mo(s) {
    if (s._mo) return s; s._mo = true;
    const Rs = (s.o && s.o.restore) || {}, L = Rs.load || null;
    Object.assign(s, { load: L, tier: (L && X.TIERS[L.tier] && L.tier) || 'normal', fit: (L && L.fit) || null, home: (Rs.home || Rs.cell || [4, 4]).slice(), wxk: 'clear', ride: null, parked: null, wrecked: {}, npc: null, hiding: null, survSt: {}, kfq: [], multiSent: 0,
      gd: null, build: null, hordeS: null, slush: [], crush: [], crushSeq: 0, crushHit: new Set(), crates: [], giftN: null, evN: null, pendingEv: null, spotOn: false, tvAt: 0, saved: null });
    // the look of the sky comes from the seed; rain and fog only show when the weather really turns (setWeather)
    if (window.TZSim && window.TZSim.weather && !s._wx) { s._wxBase = window.TZSim.weather(s.seed); s._wx = { tod: s._wxBase.tod, rain: false, fog: false, heat: false }; }
    return s;
  }
  // ---------------- wrap the sim ----------------
  const baseInit = proto.initPlay;
  proto.initPlay = function () {
    baseInit.call(this); mo(this);
    const L = this.load; if (L && L.wp && R().WEAPONS[L.wp] && L.wp !== 'pistol' && !this.weapons.some((w) => w.id === L.wp)) this.addWeapon(L.wp, true); // your unlocked starting weapon
  };
  const baseStats = proto.stats;
  proto.stats = function () { baseStats.call(this); const S = this.S, c = this.cls; if (c === 'janitor') { S.slow = Math.max(S.slow, 0.15); S.armor *= 0.9; } if (c === 'courier') S.speed *= 1.2; };
  const baseSetClass = proto.setClass;
  proto.setClass = function (id) {
    const C = R().CLASSES[id]; if (C && C.locked && !(this.load && (this.load.classes || []).includes(id))) return false; // unlock it first (never in Party Mode)
    const ok = baseSetClass.call(this, id); if (ok) { if (id === 'sparky') this.addWeapon('coil', true); if (id === 'chef') this.addWeapon('flamer', true); this.stats(); } return ok;
  };
  const baseBuy = proto.buy;
  proto.buy = function (id, arg) { const n = this.heals ? this.heals.length : 0, r = baseBuy.call(this, id, arg); if (r.ok && this.cls === 'chef' && this.heals.length > n) { const h = this.heals[this.heals.length - 1]; h.left *= 2; h.rate *= 2; } return r; };
  const baseDamage = proto.damageZ;
  proto.damageZ = function (z, dmg, by, kx = 0, ky = 0, o = {}) {
    if (this._mo) {
      if (o.shock) dmg *= (this.wxk === 'rain' ? X.WX.shockRain : 1) * (this.cls === 'sparky' ? 1.3 : 1);
      if (o.burn) { if (this.wxk === 'rain') { o = { ...o, burn: o.burn * X.WX.burnRain }; dmg *= X.WX.fireRain; } else if (this.cls === 'chef') o = { ...o, burn: o.burn * 1.5 }; }
      z.noticed = true;
    }
    return baseDamage.call(this, z, dmg, by, kx, ky, o);
  };
  const baseMakeZ = proto.makeZ;
  proto.makeZ = function (type, x, y) {
    const z = baseMakeZ.call(this, type, x, y), T = this._mo && X.TIERS[this.tier];
    if (T && this.tier !== 'normal') { z.hp *= T.hp; z.mhp *= T.hp; z.dmg *= T.dmg; z.speed *= T.speed; }
    if (type === 'icecream' || type === 'compactor') z.noCollide = type === 'icecream';
    return z;
  };
  const baseSpawnFinal = proto.spawnFinal;
  proto.spawnFinal = function () { const had = this.finalSpawned; baseSpawnFinal.call(this); const z = !had && this.z.find((q) => q.fb); if (z && z.fb === 'icecream') z.noCollide = true; };
  const baseHurt = proto.hurt;
  proto.hurt = function (dmg, fx, fy) {
    if (this._mo && this.ride && !this.dead && this.phase === 'play' && !(this.p.inv > 0) && !(this.buffs.shield > 0)) { // the ride takes the hit
      const r = this.ride; r.hp -= dmg * (this.cls === 'courier' ? 0.6 : 1) * (r.kind === 'gtruck' ? 0.5 : 1); this.p.inv = 0.3; this.shake = Math.max(this.shake, 0.12);
      this.o.on('hurt', { hp: this.p.hp, mhp: this.S.mhp, ride: true }); if (r.hp <= 0) this.wreck(); return;
    }
    return baseHurt.call(this, dmg, fx, fy);
  };
  const baseTargets = proto.targets;
  proto.targets = function () {
    const L = baseTargets.call(this); if (!this._mo) return L;
    if (this.npc && this.npc.hp > 0) L.push(this.npc);
    for (const o of this.others.values()) if (o.npc && o.npc.hp > 0) L.push(o.npc);
    const b = this.build; if (b) { if (this.hordeS && !this.hordeS.done && !this.hordeS.failed && b.door.hp > 0) L.push(b.door); for (const it of b.items) if (it.k === 'decoy' && it.hp > 0) L.push(it); }
    return L;
  };
  const baseEnter = proto.enterArea;
  proto.enterArea = function (cx, cy, from, home) {
    baseEnter.call(this, cx, cy, from, home); mo(this);
    this.slush.length = 0; this.crush.length = 0; this.crates.length = 0; this.parked = null; this.hiding = null;
    const k = this.cellKey(), kind = X.vehicleAt(this.seed, cx, cy, this.homes);
    if (kind && !this.wrecked[k] && !this.ride) this.parked = { kind, ...this.freeSpot(240, 1), hp: X.VEHICLES[kind].hp, mhp: X.VEHICLES[kind].hp, face: 1 };
    const S0 = X.survivorAt(this.seed, cx, cy, this.homes, PP().placeAt);
    if (S0 && !this.survSt[S0.id] && !(this.npc && this.npc.id === S0.id)) this.hiding = { ...S0, ...this.freeSpot(320, 2), hp: X.SURV_HP, mhp: X.SURV_HP, face: -1 };
    if (this.npc) { this.npc.x = clamp(this.p.x - 50, 40, W.AW - 40); this.npc.y = clamp(this.p.y + 30, 40, W.AH - 40); this.npc.asked = false; }
  };
  const baseExit = proto.exitOpen;
  proto.exitOpen = function (d) { if (this.build) return false; return baseExit.call(this, d); };
  const baseStart = proto.startWave;
  proto.startWave = function () {
    const n0 = this.events ? this.events.length : 0; baseStart.call(this); mo(this);
    if (this.pendingEv && this.mode !== 'guest' && this.startEvent && X.VOTE_EVENTS[this.pendingEv]) { // the helpers voted for this one
      if (this.events.length > n0) this.events.length = n0;
      const k = this.pendingEv, E = X.VOTE_EVENTS[k]; this.pendingEv = null; this.startEvent(k);
      this.banner = { text: E.icon + ' ' + E.name.toUpperCase() + '!', sub: 'The helpers voted for this one', t: 3 };
    }
  };
  const baseKill = proto.onKill;
  proto.onKill = function (z, by, mine) {
    baseKill.call(this, z, by, mine); if (!mine || !this._mo) return;
    const ZD = W.ZOMBIES[z.type] || {}; this.kfq.push([Math.max(0, ZT.indexOf(z.type)), z.elite ? 1 : 0, ZD.boss ? 1 : 0]); if (this.kfq.length > 300) this.kfq.shift();
    if (ZD.boss) this.o.report({ op: 'ev', k: 'bossdown', id: z.fb ? 'final' : z.mb || z.type });
    const n = this.multi ? this.multi.n : 0; if (n < 2) this.multiSent = 0; else if (n >= 4 && n >= this.multiSent + 2) { this.multiSent = n; this.o.report({ op: 'ev', k: 'multi', n }); }
  };
  const baseClear = proto.onClear;
  proto.onClear = function () {
    baseClear.call(this); mo(this);
    const H = this.hordeS; if (H && !H.done && !H.failed && this.build) { // the horde is beaten
      H.done = true; const D = this.build.door, bonus = X.hordeBonus(H.night, D.hp / D.mhp); this.score += bonus;
      this.popup('GARAGE HELD +' + bonus, '#ffd23f', this.p.x, this.p.y - 160); this.banner = { text: '🏚️ YOU HELD THE GARAGE!', sub: 'Dawn is coming… +' + bonus + ' points', t: 4 };
      this.o.report({ op: 'hordeend', ok: true, door: Math.round((100 * D.hp) / D.mhp) / 100 }); this.o.on('horde', { ok: true, bonus });
    }
  };
  const baseApply = proto.applyPickup;
  proto.applyPickup = function (k) {
    baseApply.call(this, k);
    if (k === 'truck' && this._mo && !this.dead && !this.down) { // the rare garbage truck: you drive it
      if (this.ride && this.ride.kind !== 'gtruck') this.parked = { ...this.ride, x: clamp(this.p.x - 90, 60, W.AW - 60), y: this.p.y };
      const V = X.VEHICLES.gtruck; this.ride = { kind: 'gtruck', hp: V.hp, mhp: V.hp, time: V.time * (this.cls === 'courier' ? 1.3 : 1), face: this.p.face };
      this.buffs.truck = this.ride.time; this.banner = { text: '🚛 GARBAGE TRUCK!', sub: 'Drive it for ' + Math.round(this.ride.time) + ' s (🚪 hops you out)', t: 2.4 }; this.o.report({ op: 'ev', k: 'ride', id: 'gtruck' }); this.o.on('ride', { on: true, kind: 'gtruck' });
    }
  };
  const baseDrop = proto.dropPickup;
  proto.dropPickup = function (x, y) { baseDrop.call(this, x, y); const p = this.pk[this.pk.length - 1]; if (p && p.k === 'truck' && this.rng() < 0.6) p.k = 'snack'; }; // the truck stays rare
  const basePlay = proto.playStep;
  proto.playStep = function (dt, I) { basePlay.call(this, dt, I); this.moreStep(dt, I); };
  const baseDie = proto.die;
  proto.die = function () { if (this._mo) { if (this.ride) { this.ride = null; this.buffs.truck = 0; } if (this.npc) this.loseNpc(); } return baseDie.call(this); };
  const baseNet = proto.netStep;
  proto.netStep = function () { baseNet.call(this); if (this._mo && this.spotOn && !this.dead) { const now = performance.now(); if (now - this.tvAt > 160) { this.tvAt = now; this.o.live(this.tvSnap()); } } };

  Object.assign(proto, {
    initMore() { mo(this); },
    // a free spot for a parked ride or a hiding survivor (off the buildings, away from you)
    freeSpot(minD, salt) {
      const r = W.rng(W.hash(this.seed, 'spot', this.cell[0], this.cell[1], salt)), S = this.area.spot, G = this.area.garage;
      const bad = (x, y) => this.area.obstacles.some((o) => x > o.x - 50 && x < o.x + o.w + 50 && y > o.y - 50 && y < o.y + o.h + 50) || (S && x > S.x - 60 && x < S.x + S.w + 60 && y > S.y - 60 && y < S.y + S.h + 90) || (G && x > G.x - 60 && x < G.x + G.w + 60 && y > G.y - 60 && y < G.y + G.h + 60);
      for (let i = 0; i < 60; i++) { const x = 160 + r() * (W.AW - 320), y = 170 + r() * (W.AH - 330); if (d2(x, y, this.p.x, this.p.y) < minD * minD || bad(x, y)) continue; return { x, y }; }
      return { x: clamp(this.area.hub.x + 110, 120, W.AW - 120), y: clamp(this.area.hub.y + 70, 140, W.AH - 120) };
    },
    // ---------------- the world from the server (every update) ----------------
    setWorld(v) {
      mo(this); if (!v) return;
      if (v.weather) this.setWeather(v.weather.k);
      if (v.surv) { this.survSt = {}; for (const [k, st, by] of v.surv) this.survSt[k] = { st, by }; if (this.hiding && this.survSt[this.hiding.id]) this.hiding = null; if (this.npc && this.survSt[this.npc.id] && this.survSt[this.npc.id].st !== 'escort') this.npc = null; }
      const me = v.me || {};
      this.setGifts(me.gifts || []); this.setNextEv(v.nextEv || null);
      if (me.spot != null) this.spotOn = !!me.spot;
      if (v.garage) this.setGarage(v.garage);
    },
    setWeather(k, pin) {
      if (pin) this.wxPin = k; else if (this.wxPin && k !== this.wxPin) return; // (screenshots pin it)
      if (!X.WEATHER[k] || k === this.wxk) return; const was = this.wxk; this.wxk = k;
      const base = (this._wxBase = this._wxBase || window.TZSim.weather(this.seed)); this._wx = { tod: base.tod, rain: k === 'rain', fog: k === 'fog', heat: k === 'heat' };
      this.zSpeedMul = k === 'heat' ? X.WX.heatSpeed : 1;
      if (was !== k && this.phase !== 'intro') { const Wd = X.WEATHER[k]; this.banner = { text: Wd.icon + ' ' + Wd.name.toUpperCase(), sub: Wd.tip, t: 3 }; this.wxT = 6; this.o.on('weather', { k }); }
    },
    setGifts(list) {
      const top = list.reduce((m, g) => Math.max(m, g.n || 0), 0);
      if (this.giftN == null) { this.giftN = top; return; }
      for (const g of list) if (g.n > this.giftN) { this.giftN = g.n; this.gift(g); }
    },
    gift(g) {
      if (this.dead) return; const P = this.p;
      if (g.kind === 'crate') { const a = this.rng() * TAU; this.crates.push({ x: clamp(P.x + Math.cos(a) * 170, 90, W.AW - 90), y: clamp(P.y + Math.sin(a) * 120, 120, W.AH - 90), t: 0, land: 2.2, from: g.from || '' }); this.banner = { text: '📦 SUPPLY CRATE!', sub: (g.from || 'A friend') + ' dropped it for you: grab it!', t: 2.6 }; this.o.on('crate', g); }
      else if (g.kind === 'horde') { this.banner = { text: '🧟 INCOMING!', sub: (g.from || 'Someone') + ' sent a horde at you, leader!', t: 2.8 }; this.shake = 0.3; if (this.mode === 'guest') this.pend.push({ t: 'fx', kind: 'horde', n: g.cnt, from: g.from }); else this.sendHorde(g.cnt, g.from); this.o.on('sent', g); }
    },
    sendHorde(n) { const k = Math.min(16, n || 8); for (let i = 0; i < k && this.z.length < 110; i++) { const z = this.spawnOne(i % 3 === 0 ? 'runner' : 'walker'); z.sent = true; z.noticed = true; } if (this.spec) this.spec.target += k; return k; },
    setNextEv(e) {
      if (this.evN == null) { this.evN = e ? e.n : 0; return; }
      if (e && e.n > this.evN) { this.evN = e.n; this.pendingEv = e.k; const E = X.VOTE_EVENTS[e.k]; if (E) this.popup('🗳️ NEXT: ' + E.name.toUpperCase(), '#c37bff', this.p.x, this.p.y - 140); }
    },
    liveExtra(m) { if (m.t === 'spot') this.spotOn = !!m.on; },
    // who a zombie goes for: a blaring decoy pulls everything near it; in fog they only notice you up close
    pickTarget(z, tg, bd) {
      if (!this._mo) return tg; const b = this.build;
      if (b) for (const it of b.items) if (it.k === 'decoy' && it.hp > 0 && d2(z.x, z.y, it.x, it.y) < 560 * 560) return it;
      if (this.wxk === 'fog' && tg && !z.noticed && !z.boss && !this.hordeS) {
        if (bd < X.WX.fogNotice * X.WX.fogNotice) { z.noticed = true; return tg; }
        if (!z.wan || d2(z.x, z.y, z.wan.x, z.wan.y) < 40 * 40) z.wan = { x: clamp(z.x + (this.rng() - 0.5) * 520, 90, W.AW - 90), y: clamp(z.y + (this.rng() - 0.5) * 420, 110, W.AH - 70), slowK: 0.35 };
        return z.wan;
      }
      return tg;
    },
    // ---------------- vehicles ----------------
    nearVehicle() { if (!this._mo || this.dead || this.down || !this.parked || this.ride || this.phase !== 'play') return null; return d2(this.parked.x, this.parked.y, this.p.x, this.p.y) < 125 * 125 ? this.parked : null; },
    toggleRide() {
      if (!this._mo || this.dead || this.down || this.phase !== 'play') return false; const P = this.p;
      if (this.ride) {
        const r = this.ride; this.ride = null; if (r.kind === 'gtruck') this.buffs.truck = 0;
        if (r.kind !== 'gtruck' || r.time > 0.5) this.parked = { ...r, x: clamp(P.x, 60, W.AW - 60), y: clamp(P.y, 80, W.AH - 40) };
        P.x = clamp(P.x + 70 * (P.face || 1), P.r, W.AW - P.r); P.inv = Math.max(P.inv, 0.4); this.collide(P); this.o.on('ride', { on: false }); return 'out';
      }
      const v = this.nearVehicle(); if (!v) return false;
      this.ride = { ...v }; this.parked = null; P.x = v.x; P.y = v.y; if (v.kind === 'gtruck') this.buffs.truck = v.time;
      this.o.report({ op: 'ev', k: 'ride', id: v.kind }); this.o.on('ride', { on: true, kind: v.kind }); return 'in';
    },
    wreck() {
      const r = this.ride, V = X.VEHICLES[r.kind]; this.ride = null; if (r.kind === 'gtruck') this.buffs.truck = 0; else this.wrecked[this.cellKey()] = 1;
      this.boom(this.p.x, this.p.y, 110, 0, '#ff8c42', false); this.popup(V.name.toUpperCase() + ' WRECKED!', '#ff6a5a', this.p.x, this.p.y - 130); this.p.inv = 1; this.o.on('wreck', { kind: r.kind });
    },
    rideStep(dt) {
      const r = this.ride; if (!r) return; const V = X.VEHICLES[r.kind], P = this.p;
      if (r.kind === 'gtruck') { r.time -= dt; this.buffs.truck = Math.max(0.01, r.time); if (r.time <= 0) { this.ride = null; this.buffs.truck = 0; this.banner = { text: '🚛 TIME’S UP', sub: 'The truck rolls off on its route', t: 2 }; this.o.on('ride', { on: false }); return; } }
      let n = 0; const sp = Math.hypot(P.vx, P.vy);
      for (const z of this.z) {
        if (z.hp <= 0) continue; const rr = V.r + z.r + 6, dd = d2(z.x, z.y, P.x, P.y); if (dd > rr * rr) continue; n++;
        if (V.blade && (z.bladeT || 0) <= this.t) { z.bladeT = this.t + 0.2; const d = Math.sqrt(dd) || 1; this.damageZ(z, V.blade * 0.2 * (1 + 0.08 * this.wave), this.me.id, ((z.x - P.x) / d) * 160, ((z.y - P.y) / d) * 160); }
        if (V.ram && sp > 170 && (z.ramT || 0) <= this.t) { z.ramT = this.t + 0.5; const d = Math.sqrt(dd) || 1; this.damageZ(z, V.ram + this.wave, this.me.id, ((z.x - P.x) / d) * 460, ((z.y - P.y) / d) * 460); }
      }
      r.stuck = n; r.face = P.face;
      this.speedMul *= r.kind === 'gtruck' ? Math.max(0.5, 1 - 0.05 * n) : V.speed * Math.max(0.12, 1 - 0.2 * n); // a crowd of zombies stops you
    },
    // ---------------- survivors ----------------
    loseNpc() { const N = this.npc; if (!N) return; this.npc = null; for (let i = 0; i < 12; i++) this.particle(N.x, N.y - 30, (this.rng() - 0.5) * 260, -this.rng() * 260, '#8a1a12', 0.6, 5); this.banner = { text: '💔 ' + N.name.toUpperCase() + ' DIDN’T MAKE IT', sub: 'The zombies got them', t: 3 }; this.o.report({ op: 'ev', k: 'survlost' }); this.o.on('survlost', { name: N.name }); },
    survStep(dt) {
      const P = this.p, H = this.hiding;
      if (H && !this.npc && !this.dead && !this.down && !H.asking && (H.askAt || 0) <= this.t && d2(H.x, H.y, P.x, P.y) < 100 * 100) {
        H.asking = true; H.askAt = this.t + 2;
        this.o.report({ op: 'escort', cell: H.id }, true).then((r) => { H.asking = false; if (r && r.ok) { if (this.hiding !== H) return; this.npc = { ...H, follow: true, asked: false }; this.hiding = null; this.banner = { text: '🧍 ' + H.name.toUpperCase() + ' IS WITH YOU', sub: 'Bring them to a shop or the clinic for a reward', t: 3 }; this.o.on('escort', { name: H.name }); } else if (r && r.error && /already|Not here/.test(r.error)) this.hiding = null; });
      }
      if (H) H.t = (H.t || 0) + dt;
      const N = this.npc; if (!N) return;
      const tx = P.x - (P.face || 1) * 62, ty = P.y + 22, dd = Math.hypot(tx - N.x, ty - N.y), sp = 280 * (this.ride ? 1.7 : 1) * (this.cls === 'courier' ? 1.2 : 1);
      N.moving = dd > 10; if (dd > 10) { N.x += ((tx - N.x) / dd) * Math.min(dd, sp * dt); N.y += ((ty - N.y) / dd) * Math.min(dd, sp * dt); N.face = tx > N.x ? 1 : -1; N.walkT = (N.walkT || 0) + dt; }
      if (dd > 650) { N.x = tx; N.y = ty; } N.r = 16; this.collide(N);
      for (const z of this.z) { if (z.hp <= 0 || !z.dmg) continue; if (d2(z.x, z.y, N.x, N.y) < (z.r + 20) * (z.r + 20)) { N.hp -= z.dmg * dt * 1.1; N.hurtT = 0.25; } }
      if (N.hurtT > 0) N.hurtT -= dt;
      if (N.hp <= 0) return this.loseNpc();
      const type = PP().placeAt(this.seed, this.cell[0], this.cell[1], this.homes), D = type && this.shopDoor();
      if (D && !N.asked && (N.askAt || 0) <= this.t && d2(N.x, N.y, D.x, D.y) < 210 * 210 && d2(P.x, P.y, D.x, D.y) < 240 * 240) {
        N.asked = true; N.askAt = this.t + 2;
        this.o.report({ op: 'rescue' }, true).then((r) => { if (r && r.ok) { this.cash += r.cash; this.score += r.score; if (r.clinic) this.p.hp = this.S.mhp; this.popup('RESCUED +$' + r.cash, '#7dff6a', N.x, N.y - 100); this.banner = { text: '🎉 ' + N.name.toUpperCase() + ' IS SAFE!', sub: `+$${r.cash} · +${r.score} points${r.clinic ? ' · the clinic patched you up' : ''}`, t: 3.5 }; if (this.npc === N) this.npc = null; this.o.on('rescue', r); } else N.asked = false; });
      }
    },
    // ---------------- Garage Defense ----------------
    setGarage(G) {
      this.gd = G;
      if (G.phase === 'build' && (!this.build || this.build.night !== G.night)) this.toGarage(G.night);
      if (G.phase === 'horde' && (!this.build || this.build.night !== G.night)) this.toGarage(G.night);
      if (G.phase === 'horde' && this.build && (!this.hordeS || this.hordeS.night !== G.night)) this.startHorde(G.night);
      if (G.phase === 'explore' && this.build) this.endNight();
    },
    toGarage(night) {
      if (this.dead) return; const h = this.home;
      if (this.cell[0] !== h[0] || this.cell[1] !== h[1] || !this.area.garage) { this.enterArea(h[0], h[1], null, true); this.mode = 'solo'; this.areaMembers = [this.me.id]; this.host = this.me.id; }
      if (this.ride && this.ride.kind === 'gtruck') { this.ride = null; this.buffs.truck = 0; }
      if (this.phase === 'intro') { this.phase = 'play'; this.introT = 99; }
      this.z.length = 0; this.spit.length = 0; this.cleared = true; this.bossDue = false; if (this.events) this.events.length = 0; this.cards = this.cards || null;
      const G = this.area.garage || { x: W.AW / 2 - 120, y: 100, w: 240, h: 160 }, mhp = X.GARAGE.door + 150 * (night - 1);
      const door = { x: G.x + G.w / 2, y: G.y + G.h + 12, r: 44, hp: mhp, mhp, door: true };
      this.build = { night, door, items: [], spent: 0 }; this.hordeS = null; if (this.coins) this.coins.length = 0; this._plArea = this.area; // (the yard keeps its night turrets)
      this.p.x = door.x; this.p.y = door.y + 110;
      if (this._savedBuild && this._savedBuild.night === night) { const sb = this._savedBuild; this._savedBuild = null; door.hp = clamp(sb.door, 1, mhp); for (const it of sb.items || []) this.placeBuild(it.k, it.x, it.y, it.hp); }
      this.banner = { text: '🌙 HORDE NIGHT ' + night, sub: 'Back at your garage: build defenses before the horde comes!', t: 4 }; this.o.on('build', { night });
    },
    placeBuild(k, x, y, hp) {
      const B = X.BUILD[k], b = this.build; let it = null;
      if (k === 'barricade') { const m = B.hp + 40 * (b.night - 1), o = { x: x - 60, y: y - 14, w: 120, h: 28, kind: 'barricade', low: true, bar: true, hp: hp || m, mhp: m }; this.area.obstacles.push(o); it = { k, o, x, y }; }
      else if (k === 'turret') { const T = { x, y, life: 1e9, cd: 0, a: 0, night: true }; this.turrets.push(T); it = { k, T, x, y }; }
      else if (k === 'spikes') it = { k, x, y, w: 150, h: 34 };
      else if (k === 'flamer') it = { k, x, y, cd: 1.5 };
      else if (k === 'decoy') it = { k, x, y, hp: hp || B.hp, mhp: B.hp, t: 0, decoy: true };
      if (it) b.items.push(it); return it;
    },
    buildBuy(k) {
      const B = X.BUILD[k], b = this.build; if (!B || !b) return { ok: false, error: 'Only on a horde night.' };
      if (this.dead) return { ok: false, error: 'You’re down.' };
      const c = X.buildCost(k, b.night); if (this.cash < c) return { ok: false, error: 'Not enough cash.' };
      const P = this.p, D = b.door, G = this.area.garage;
      if (k === 'repair') { if (D.hp >= D.mhp) return { ok: false, error: 'The door is in one piece.' }; D.hp = Math.min(D.mhp, D.hp + B.n); }
      else {
        if (b.items.length >= 24) return { ok: false, error: 'The yard is full.' };
        let x = P.x + (P.face || 1) * 70, y = P.y + 10; const dd = Math.hypot(x - D.x, y - D.y);
        if (dd > X.GARAGE.yard) { x = D.x + ((x - D.x) / dd) * X.GARAGE.yard; y = D.y + ((y - D.y) / dd) * X.GARAGE.yard; }
        if (G && x > G.x - 20 && x < G.x + G.w + 20 && y < G.y + G.h + 50) y = G.y + G.h + 50;
        this.placeBuild(k, clamp(x, 80, W.AW - 80), clamp(y, 90, W.AH - 50));
      }
      this.cash -= c; b.spent += c; this.o.report({ op: 'ev', k: 'build', id: k }); this.o.on('buy', { id: k }); return { ok: true };
    },
    startHorde(night) {
      if (!this.build || this.dead) return; this.hordeS = { night, done: false, failed: false };
      if (this.phase !== 'play') { this.phase = 'play'; this.introT = 99; }
      const sp = this.spec = W.waveSpec(Math.max(5 * night, this.wave), 1, this.set.diff); sp.target = X.hordeSize(night, 1); sp.cap = Math.min(90, sp.cap + 20); sp.every *= 0.7; sp.boss = night >= 2;
      this.bossDue = sp.boss; this.bossSpawned = false; this.waveKills = 0; this.spawned = 0; this.spawnCd = 1; this.cleared = false; this.mode = 'solo';
      this.banner = { text: '🧟 THE HORDE IS HERE!', sub: 'Hold the garage door!', t: 3 }; this.shake = 0.4; this.o.on('hordestart', { night });
    },
    endNight() {
      if (!this.build) return; this.area.obstacles = this.area.obstacles.filter((o) => !o.bar); this.turrets = this.turrets.filter((T) => !T.night);
      this.build = null; this.hordeS = null; this.z.length = 0; this.cleared = true; this.bossDue = false;
      if (!this.dead) this.banner = { text: '🌅 DAWN', sub: 'Explore again: the next horde night comes in 5 waves', t: 3.5 };
    },
    doorBroke() {
      const H = this.hordeS, lost = Math.round(this.cash * 0.3); this.cash -= lost; H.failed = true; this.z.length = 0; this.cleared = true; this.shake = 0.8;
      this.banner = { text: '💥 THE DOOR BROKE!', sub: `They raided your garage (-$${lost}). The town loses hope…`, t: 4 }; this.o.report({ op: 'hordeend', ok: false }); this.o.on('horde', { ok: false });
    },
    garageStep(dt) {
      const b = this.build, D = b.door, H = this.hordeS, on = H && !H.done && !H.failed;
      for (const z of this.z) {
        if (z.hp <= 0) continue; const pz = z._p;
        if (on && D.hp > 0 && d2(z.x, z.y, D.x, D.y) < (z.r + 50) * (z.r + 50)) D.hp -= z.dmg * dt * 0.9;
        for (const it of b.items) {
          if (it.k === 'barricade') { const o = it.o; if (z.x > o.x - z.r - 8 && z.x < o.x + o.w + z.r + 8 && z.y > o.y - z.r - 8 && z.y < o.y + o.h + z.r + 8) o.hp -= z.dmg * dt * 0.9; }
          else if (it.k === 'decoy') { if (it.hp > 0 && d2(z.x, z.y, it.x, it.y) < (z.r + 34) * (z.r + 34)) it.hp -= z.dmg * dt * 0.9; }
          else if (it.k === 'spikes' && z.x > it.x - it.w / 2 && z.x < it.x + it.w / 2 && z.y > it.y - it.h / 2 - 10 && z.y < it.y + it.h / 2 + 10) {
            z.hp -= (16 + 5 * b.night) * dt; z.flash = 0.05; if (pz) { z.x = pz[0] + (z.x - pz[0]) * 0.45; z.y = pz[1] + (z.y - pz[1]) * 0.45; } // shredded and slowed
            if (z.hp <= 0) { z.hp = 1; this.damageZ(z, 5, this.me.id); }
          }
        }
        z._p = [z.x, z.y];
      }
      for (let i = b.items.length - 1; i >= 0; i--) {
        const it = b.items[i];
        if (it.k === 'barricade' && it.o.hp <= 0) { const j = this.area.obstacles.indexOf(it.o); if (j >= 0) this.area.obstacles.splice(j, 1); b.items.splice(i, 1); for (let k = 0; k < 10; k++) this.particle(it.x, it.y - 10, (this.rng() - 0.5) * 300, -this.rng() * 260, '#a8743a', 0.6, 6); this.popup('BARRICADE DOWN', '#ffb02e', it.x, it.y - 50); }
        else if (it.k === 'decoy') { it.t += dt; if (it.hp <= 0) { b.items.splice(i, 1); this.boom(it.x, it.y, 90, 0, '#ff5a3c', false); } }
        else if (it.k === 'flamer' && on) { it.cd -= dt; if (it.cd <= 0) { it.cd = 2.6; const rain = this.wxk === 'rain', R0 = rain ? 110 : 165; this.fx.push({ k: 'ring', x: it.x, y: it.y - 10, r: R0 - 20, R: R0 + 10, t: 0, life: 0.45, c: rain ? '#8ab0d0' : '#ff8c42' }); if (!rain && this.fx.length < 200) this.fx.push({ k: 'fire', x: it.x, y: it.y - 10, r: R0 * 0.6, t: 0, life: 0.4 }); for (const z of this.z) if (z.hp > 0 && d2(z.x, z.y, it.x, it.y) < R0 * R0) this.damageZ(z, 18 + 6 * b.night, this.me.id, 0, 0, { burn: 1.5 }); } }
      }
      if (on && D.hp <= 0) this.doorBroke();
    },
    // ---------------- boss arenas (hazards are run by the area host and sent to guests) ----------------
    jingle(z) { this.jingleAt = this.t; this.o.on('jingle', { key: z.fb || z.mb }); },
    arenaStep(dt) {
      const P = this.p, host = this.mode !== 'guest';
      for (let i = this.slush.length - 1; i >= 0; i--) { const q = this.slush[i]; q.t += dt; if (q.t > q.life) { this.slush.splice(i, 1); continue; } if (!this.dead && d2(q.x, q.y, P.x, P.y) < q.r * q.r) this.speedMul *= 0.5; }
      for (let i = this.crush.length - 1; i >= 0; i--) {
        const c = this.crush[i]; c.t += dt;
        if (c.t >= c.warn && !this.crushHit.has(c.id)) {
          this.crushHit.add(c.id); if (this.crushHit.size > 200) this.crushHit.clear(); this.shake = Math.max(this.shake, 0.45);
          const inBand = (x, y) => Math.abs((c.v ? x : y) - c.c) < c.w / 2;
          if (!this.dead && !this.down && inBand(P.x, P.y)) { this.hurt(40 * (1 + 0.05 * this.wave), c.v ? c.c : P.x, c.v ? P.y : c.c); this.popup('CRUNCH!', '#ff5a3c', P.x, P.y - 120); }
          if (this.npc && inBand(this.npc.x, this.npc.y)) this.npc.hp -= 60;
          if (host) for (const z of this.z) if (z.hp > 0 && !z.boss && inBand(z.x, z.y)) this.damageZ(z, 400, this.me.id);
        }
        if (host && c.t > c.life) this.crush.splice(i, 1);
      }
    },
    snapExtra() { if (!this.slush.length && !this.crush.length) return {}; return { ar: { s: this.slush.map((q) => [Math.round(q.x), Math.round(q.y), q.r, Math.round((q.life - q.t) * 10) / 10]), c: this.crush.map((c) => [c.id, c.v ? 1 : 0, Math.round(c.c), c.w, Math.round(c.t * 100) / 100, c.warn]) } }; },
    snapIn(m) {
      const ar = m.ar; if (!ar) { this.slush.length = 0; this.crush.length = 0; return; }
      this.slush = (ar.s || []).map(([x, y, r, left]) => ({ x, y, r, t: 0, life: left }));
      this.crush = (ar.c || []).map(([id, v, c, w, t, warn]) => ({ id, v: !!v, c, w, t, warn, life: warn + 0.7 }));
    },
    // ---------------- helpers' crates ----------------
    crateStep(dt) {
      const P = this.p;
      for (let i = this.crates.length - 1; i >= 0; i--) {
        const c = this.crates[i]; c.t += dt; if (c.t < c.land) continue;
        if (!c.landed) { c.landed = true; this.shake = Math.max(this.shake, 0.15); this.fx.push({ k: 'ring', x: c.x, y: c.y, r: 10, R: 80, t: 0, life: 0.35, c: '#ffd23f' }); }
        if (!this.dead && d2(c.x, c.y, P.x, P.y - 20) < 75 * 75) {
          this.crates.splice(i, 1); const cash = 30 + 6 * this.wave; this.cash += cash; P.hp = Math.min(this.S.mhp, P.hp + 40);
          const L = ['shield', 'minigun', 'rockets', 'raygun', 'xp2', 'freeze']; this.applyPickup(L[Math.floor(this.rng() * L.length)]);
          this.popup('CRATE +$' + cash + ' +40❤', '#ffd23f', c.x, c.y - 90); this.o.on('crategot', { from: c.from });
        } else if (c.t > 60) this.crates.splice(i, 1);
      }
    },
    // ---------------- the frame (after the core, play and fight steps) ----------------
    moreStep(dt, I) {
      mo(this); void I;
      if (this.wxT > 0) this.wxT -= dt;
      if (this.wxk === 'rain') for (const z of this.z) if (z.burnT > 0) z.burnT -= dt * 1.5; // the rain puts fires out
      this.rideStep(dt); this.survStep(dt); this.crateStep(dt); this.arenaStep(dt);
      if (this.build) this.garageStep(dt);
    },
    // ---------------- talking to the server and the other phones ----------------
    statusExtra() {
      const out = {}; if (!this._mo) return out;
      if (this.kfq.length) { const agg = new Map(); for (const [ti, el, b] of this.kfq) { const k = ti + ':' + el; const a = agg.get(k) || [ti, 0, el, b]; a[1]++; agg.set(k, a); } out.kf = [...agg.values()].slice(0, 20); this.kfq.length = 0; }
      if (this.build) out.gdoor = Math.max(0, Math.round(this.build.door.hp));
      out.veh = this.ride ? this.ride.kind : '';
      return out;
    },
    youExtra() { if (!this._mo) return []; const N = this.npc; return [Math.max(0, VK.indexOf(this.ride ? this.ride.kind : '')), Math.max(0, FITS.indexOf(this.fit || '')), N ? Math.round(N.x) : -1, N ? Math.round(N.y) : -1, N ? Math.round(N.hp) : 0]; },
    otherExtra(o, you) {
      o.veh = VK[you[12]] || null; o.fit = FITS[you[13]] || null;
      if (you[14] >= 0 && you[14] != null) { if (!o.npc) o.npc = { x: you[14], y: you[15], tx: you[14], ty: you[15], hp: you[16], mhp: X.SURV_HP, other: o.id }; o.npc.tx = you[14]; o.npc.ty = you[15]; o.npc.hp = you[16]; o.npc.x += (o.npc.tx - o.npc.x) * 0.5; o.npc.y += (o.npc.ty - o.npc.y) * 0.5; } else o.npc = null;
    },
    // the spotlight: a small picture of your fight for the TV (only while you're the one in trouble)
    tvSnap() {
      const P = this.p, near = []; for (const q of this.z) if (q.hp > 0) near.push([d2(q.x, q.y, P.x, P.y), q]); near.sort((a, b) => a[0] - b[0]);
      const z = [], bk = []; near.slice(0, 45).forEach(([, q], i) => { z.push(q.ti, Math.round(q.x), Math.round(q.y), q.mhp ? Math.round((100 * q.hp) / q.mhp) : 100, q.face || 1); if (q.fb || q.mb) bk.push([i, q.fb || q.mb]); });
      return { t: 'tv', c: this.cell, h: this.isHome(this.cell[0], this.cell[1]) ? 1 : 0, w: this.wave, you: this.youMsg(), z, bk, hp: Math.round(P.hp), mhp: Math.round(this.S.mhp), dn: this.down ? Math.ceil(this.down.t) : 0,
        o: [...this.others.values()].map((o) => [o.id, Math.round(o.x), Math.round(o.y), Math.round(o.hp || 0), Math.round(o.mhp || 0), o.down ? 1 : 0]), n: this.npc ? [Math.round(this.npc.x), Math.round(this.npc.y), this.npc.name] : null,
        b: this.build ? [Math.round(this.build.door.hp), this.build.door.mhp] : null, wx: this.wxk, fit: this.fit, veh: this.ride ? this.ride.kind : null };
    },
    // ---------------- the run save (the phone keeps it in localStorage: trash.js) ----------------
    saveData() {
      mo(this); const P = this.p, b = this.build;
      return { v: 1, seed: this.seed, cell: this.cell.slice(), wave: this.wave, lvl: this.lvl, xp: Math.round(this.xp * 10) / 10, ab: { ...this.ab }, kills: this.killCount, hp: Math.round(P.hp), lives: P.lives, hearts: this.hearts, eq: { ...this.eq },
        cash: Math.round(this.cash || 0), score: Math.round(this.score || 0), bombs: this.bombs || 0, kits: this.kits || 0, plates: this.plates || 0, pocket: this.pocket || null, gear: { ...(this.gear || {}) }, rerolls: this.rerolls || 0, bought: { ...(this.bought || {}) }, mapTaken: { ...(this.mapTaken || {}) },
        gun: this._fi ? { ...this.gun } : null, weapons: this._fi ? this.weapons.map((w) => ({ id: w.id, lv: w.lv, tier: w.tier })) : [], cores: this.cores || 0, cls: this.cls || null, items: { ...(this.items || {}) }, combos: this.combos ? [...this.combos] : [], lockedItems: { ...(this.lockedItems || {}) }, rerollsDone: this.rerollsDone || 0, usedTurret: !!this.usedTurret,
        ride: this.ride ? { ...this.ride } : null, npc: this.npc ? { id: this.npc.id, name: this.npc.name, color: this.npc.color, hp: Math.round(this.npc.hp), mhp: this.npc.mhp } : null, giftN: this.giftN, evN: this.evN, wrecked: { ...this.wrecked },
        build: b ? { night: b.night, door: Math.round(b.door.hp), items: b.items.map((it) => ({ k: it.k, x: Math.round(it.x), y: Math.round(it.y), hp: it.o ? Math.round(it.o.hp) : it.hp != null ? Math.round(it.hp) : undefined })) } : null, at: Date.now() };
    },
    loadSave(d) {
      mo(this); if (!d || d.v !== 1 || d.seed !== this.seed) return false;
      const num = (v, lo, hi, def) => (Number.isFinite(v) ? clamp(v, lo, hi) : def), P = this.p;
      this.wave = Math.max(this.wave, num(d.wave, 1, 999, 1)); this.killCount = Math.max(this.killCount, num(d.kills, 0, 1e7, 0));
      if (num(d.lvl, 1, 999, 1) > this.lvl) { this.lvl = d.lvl; this.xp = num(d.xp, 0, 1e6, 0); } else if (d.lvl === this.lvl) this.xp = Math.max(this.xp, num(d.xp, 0, 1e6, 0));
      const tot = (ab) => Object.values(ab || {}).reduce((s, n) => s + (n || 0), 0); if (d.ab && tot(d.ab) > tot(this.ab)) this.ab = Object.fromEntries(Object.entries(d.ab).filter(([k, n]) => W.AB[k] && Number.isFinite(n)));
      this.eq = { ...this.eq, ...(d.eq || {}) }; this.hearts = Math.max(this.hearts, num(d.hearts, 0, 99, 0));
      Object.assign(this, { cash: num(d.cash, 0, 1e7, 0), score: Math.max(this.score || 0, num(d.score, 0, 1e9, 0)), bombs: num(d.bombs, 0, 99, 0), kits: num(d.kits, 0, 99, 0), plates: num(d.plates, 0, 999, 0), pocket: W.PK[d.pocket] ? d.pocket : null, rerolls: num(d.rerolls, 0, 99, 0), bought: d.bought || {}, mapTaken: d.mapTaken || {} });
      if (d.gear) this.gear = { mhp: num(d.gear.mhp, 0, 9999, 0), vest: num(d.gear.vest, 0, 99, 0), torch: num(d.gear.torch, 0, 99, 0) };
      if (this._fi) {
        if (d.gun && d.gun.id === 'pistol') this.gun = { id: 'pistol', lv: num(d.gun.lv, 1, 10, 1), tier: num(d.gun.tier, 1, 3, 1) };
        if (Array.isArray(d.weapons)) this.weapons = d.weapons.filter((w) => w && R().WEAPONS[w.id] && w.id !== 'pistol').slice(0, R().SLOTS).map((w) => ({ id: w.id, lv: num(w.lv, 1, 10, 1), tier: num(w.tier, 1, 3, 1), cd: 0.4, a: 0, swing: 0 }));
        this.cores = num(d.cores, 0, 99, 0); if (d.cls && R().CLASSES[d.cls]) this.cls = d.cls;
        this.items = Object.fromEntries(Object.entries(d.items || {}).filter(([k, n]) => R().ITEMS[k] && Number.isFinite(n)));
        this.combos = new Set((d.combos || []).filter((c) => R().COMBOS.some((C) => C.id === c))); this.lockedItems = d.lockedItems || {}; this.rerollsDone = num(d.rerollsDone, 0, 99, 0); this.usedTurret = !!d.usedTurret;
      }
      if (d.ride && X.VEHICLES[d.ride.kind]) { this.ride = { ...d.ride }; if (this.ride.kind === 'gtruck') this.buffs.truck = this.ride.time; }
      if (d.npc && d.npc.id) this.npc = { ...d.npc, x: P.x - 50, y: P.y + 24, follow: true, asked: false };
      if (d.giftN != null) this.giftN = d.giftN; if (d.evN != null) this.evN = d.evN; this.wrecked = d.wrecked || {};
      if (d.build) this._savedBuild = d.build;
      this.stats(); P.lives = Math.max(P.lives, num(d.lives, 0, 99, 0)); if (d.hp > 0) P.hp = Math.min(this.S.mhp, d.hp);
      if (this.phase === 'intro' && (d.kills > 0 || d.cash > 0)) { this.phase = 'play'; this.introT = 99; this.startWave(); } // straight back into it
      this.saved = d.at || Date.now(); return true;
    },
    // ---------------- drawing ----------------
    kp() { const c = this.cam; return Math.max(0.2, Math.round((c ? c.k : 1) * (this._dpr || 1) * 10) / 10); },
    drawUnderYou(g, t) { mo(this); const P = this.p; if (this.fit === 'cape') drawFit(g, 'cape', P.x, P.y, P.face, t, P.moving); if (this.ride) drawVehicle(g, this.ride.kind, P.x, P.y, P.face, t, P.moving, this.ride); },
    drawOtherExtra(g, o, who, over) {
      if (!over) { if (o.fit === 'cape') drawFit(g, 'cape', o.x, o.y, o.face || 1, this.t, true); if (o.veh) drawVehicle(g, o.veh, o.x, o.y, o.face || 1, this.t, true, null); return; }
      if (o.fit && o.fit !== 'cape') drawFit(g, o.fit, o.x, o.y, o.face || 1, this.t, false);
      if (o.npc) drawNpc(g, { ...o.npc, id: 'npc:' + o.id, name: '', color: '#e8b830' }, this.kp(), this.t, false);
    },
  });
  // the hero's outfit goes on top (drawOnYou is drawn after the hero)
  const baseOnYou = proto.drawOnYou;
  proto.drawOnYou = function (g, t) {
    if (baseOnYou) baseOnYou.call(this, g, t); if (!this._mo) return; const P = this.p;
    if (this.fit && this.fit !== 'cape') drawFit(g, this.fit, P.x, P.y, P.face, t, P.moving);
    if (this.ride) { const r = this.ride, V = X.VEHICLES[r.kind]; const w = 70; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(P.x - w / 2, P.y + 16, w, 7); g.fillStyle = r.hp / r.mhp < 0.3 ? '#ff4a3a' : '#7fd6ff'; g.fillRect(P.x - w / 2 + 1, P.y + 17, (w - 2) * Math.max(0, r.hp / r.mhp), 5); if (r.kind === 'gtruck') { g.font = 'bold 18px "Lilita One", sans-serif'; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(15,10,6,0.9)'; const s = '🚛 ' + Math.ceil(r.time) + 's'; g.strokeText(s, P.x, P.y + 44); g.fillStyle = '#9cff5a'; g.fillText(s, P.x, P.y + 44); } void V; }
  };
  const baseGround = proto.drawExtraGround;
  proto.drawExtraGround = function (g, t, vis) {
    baseGround.call(this, g, t, vis); if (!this._mo) return;
    // the ice-cream truck's track, the compactor's walls (their arenas)
    const boss = this.z.find((z) => z.hp > 0 && (z.fb === 'icecream' || z.mb === 'icecream' || z.fb === 'compactor' || z.mb === 'compactor'));
    if (boss) drawArena(g, boss.fb || boss.mb, t);
    for (const q of this.slush) { if (!vis(q.x, q.y)) continue; g.globalAlpha = Math.min(1, (q.life - q.t)) * 0.7; g.fillStyle = '#cfe9ff'; g.beginPath(); g.ellipse(q.x, q.y, q.r, q.r * 0.55, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,170,210,0.55)'; g.beginPath(); g.ellipse(q.x - 12, q.y - 4, q.r * 0.45, q.r * 0.22, 0.3, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.ellipse(q.x + 10, q.y - 8, q.r * 0.18, q.r * 0.08, 0, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    for (const c of this.crush) drawCrushZone(g, c, t);
    const b = this.build;
    if (b) {
      const D = b.door; g.strokeStyle = 'rgba(255,210,63,0.25)'; g.setLineDash([14, 10]); g.lineWidth = 4; g.beginPath(); g.arc(D.x, D.y, X.GARAGE.yard, 0.05, Math.PI - 0.05); g.stroke(); g.setLineDash([]);
      for (const it of b.items) if (it.k === 'spikes') drawSpikes(g, it, t);
    }
    for (const c of this.crates) if (c.t < c.land) { const u = c.t / c.land; g.fillStyle = `rgba(0,0,0,${0.15 + 0.25 * u})`; g.beginPath(); g.ellipse(c.x, c.y, 34 * (0.4 + 0.6 * u), 11 * (0.4 + 0.6 * u), 0, 0, TAU); g.fill(); }
  };
  const baseStanding = proto.extraStanding;
  proto.extraStanding = function (list) {
    baseStanding.call(this, list); if (!this._mo) return;
    const kp = this.kp(), near = this.nearVehicle();
    if (this.parked) { const v = this.parked, lab = (g) => label(g, near ? '🚪 TAP ' + X.VEHICLES[v.kind].icon + ' TO GET IN' : X.VEHICLES[v.kind].icon + ' ' + X.VEHICLES[v.kind].name + ' · ' + Math.round(X.VEHICLES[v.kind].time || 0) + ' s', v.x, v.y - 96, near ? '#9cff5a' : '#ffe9a8', near ? 20 : 16); list.push({ k: 'veh', v, x: v.x, y: v.y, label: lab, draw: (g, t) => { drawVehicle(g, v.kind, v.x, v.y, v.face || 1, t, false, v); lab(g); } }); }
    if (this.hiding) { const h = this.hiding; list.push({ k: 'npc', n: h, hiding: true, x: h.x, y: h.y, labels: (g, t) => npcLabels(g, h, t, true), draw: (g, t) => { drawNpc(g, h, kp, t, true); } }); }
    if (this.npc) { const N = this.npc; list.push({ k: 'npc', n: N, x: N.x, y: N.y, labels: (g, t) => npcLabels(g, N, t, false), draw: (g, t) => drawNpc(g, N, kp, t, false) }); }
    for (const c of this.crates) if (c.t >= c.land * 0.2) list.push({ k: 'crate', c, x: c.x, y: c.y, labels: (g) => { if (c.landed && c.from) label(g, '📦 from ' + c.from, c.x, c.y - 70, '#ffd23f', 14); }, draw: (g, t) => drawCrate(g, c, t) });
    const b = this.build;
    if (b) {
      list.push({ x: b.door.x, y: b.door.y - 2, draw: (g) => drawDoorBar(g, b.door) });
      for (const it of b.items) { if (it.k === 'barricade') list.push({ k: 'barricade', o: it.o, x: it.o.x + it.o.w / 2, y: it.o.y + it.o.h / 2, draw: (g) => drawBarricade(g, it.o) }); else if (it.k === 'flamer') list.push({ k: 'flamer', it, x: it.x, y: it.y, draw: (g, t) => drawFlamer(g, it, t) }); else if (it.k === 'decoy') list.push({ k: 'decoy', it, x: it.x, y: it.y, draw: (g, t) => drawDecoy(g, it, t) }); }
    }
  };
  const baseAir = proto.drawExtraAir;
  proto.drawExtraAir = function (g, t, vis) { baseAir.call(this, g, t, vis); if (!this._mo) return; for (const c of this.crates) if (c.t < c.land) drawChute(g, c, t); for (const c of this.crush) drawCrushWalls(g, c, t); };
  const baseHoles = proto.lightHoles;
  proto.lightHoles = function (hole) {
    baseHoles.call(this, hole); if (!this._mo) return;
    for (const c of this.crates) hole(c.x, c.y, 120, 0.7);
    if (this.npc) hole(this.npc.x, this.npc.y - 30, 110, 0.6); if (this.hiding) hole(this.hiding.x, this.hiding.y - 30, 90, 0.5);
    if (this.ride) hole(this.p.x + Math.cos(this.p.aim) * 120, this.p.y - 20 + Math.sin(this.p.aim) * 80, 200, 0.6);
    const b = this.build; if (b) { hole(b.door.x, b.door.y, 200, 0.7); for (const it of b.items) if (it.k === 'decoy' && Math.sin(t2(this) * 14) > 0) hole(it.x, it.y, 160, 0.7); }
    for (const c of this.crush) if (c.t < c.warn) hole(c.v ? c.c : W.AW / 2, c.v ? W.AH / 2 : c.c, 260, 0.35);
  };
  const t2 = (s) => s.t;

  // ---------------- the new bosses: patterns ----------------
  const TZB = window.TZB || (window.TZB = { stepBoss: () => 1, drawBoss: () => {} }), baseStepBoss = TZB.stepBoss, baseDrawBoss = TZB.drawBoss;
  TZB.stepBoss = function (sim, z, dt, tg) { const k = z.fb || z.mb; if (k === 'icecream') return iceStep(sim, z, dt, tg); if (k === 'compactor') return crunchStep(sim, z, dt, tg); return baseStepBoss(sim, z, dt, tg); };
  TZB.drawBoss = function (g, z, t) { const k = z.fb || z.mb; if (k === 'icecream') return drawIce(g, z, t); if (k === 'compactor') return drawCrunch(g, z, t); return baseDrawBoss(g, z, t); };
  const LAP = { cx: W.AW / 2, cy: W.AH / 2 + 30, rx: W.AW * 0.36, ry: W.AH * 0.31 };
  // Mister Brain Freeze laps the block playing its jingle; it leaves slush, parks to serve rings of frozen cones.
  function iceStep(s, z, dt, tg) {
    mo(s); const ph2 = z.hp < z.mhp * 0.5;
    if (z.la == null) { z.la = Math.atan2((z.y - LAP.cy) / LAP.ry, (z.x - LAP.cx) / LAP.rx); z.serve = 0; z.cd = 5; z.slushT = 0; z.jt = 12; z.noCollide = true; s.jingle(z); }
    z.cd -= dt; z.jt -= dt; if (z.jt <= 0) { z.jt = 12; s.jingle(z); }
    if (z.serve > 0) { z.serve -= dt; z.cx = 0; return -1; }
    if (z.cd <= 0 && tg) { z.cd = ph2 ? 4.5 : 6.5; z.serve = ph2 ? 1.3 : 2; const n = ph2 ? 12 : 8, off = s.rng() * TAU; for (let i = 0; i < n; i++) { const a = off + (i * TAU) / n; s.spit.push({ x: z.x, y: z.y - z.r, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, life: 2.2, dmg: z.dmg * 0.5, col: '#ffc8e0', big: true, debuff: null }); } s.shake = Math.max(s.shake, 0.15); return -1; }
    const sp = z.speed * (ph2 ? 1.35 : 1) * (s.zSpeedMul || 1), px = z.x; z.la += (sp / ((LAP.rx + LAP.ry) / 2)) * dt;
    const tx = LAP.cx + Math.cos(z.la) * LAP.rx, ty = LAP.cy + Math.sin(z.la) * LAP.ry, k = Math.min(1, dt * 3);
    z.x += (tx - z.x) * k; z.y += (ty - z.y) * k; z.cx = z.x - px;
    z.slushT -= dt; if (z.slushT <= 0 && s.slush.length < 24) { z.slushT = ph2 ? 0.35 : 0.55; s.slush.push({ x: z.x - Math.sign(z.cx || 1) * 60, y: z.y + 6, r: 58, t: 0, life: 9 }); }
    return -1;
  }
  // The Big Crunch stomps after you; its arena walls slam shut on red crush zones (get out!).
  function crunchStep(s, z, dt, tg) {
    mo(s); const ph2 = z.hp < z.mhp * 0.5; z.ct = (z.ct == null ? 2.5 : z.ct) - dt; z.cd3 = (z.cd3 == null ? 4 : z.cd3) - dt;
    if (z.ct <= 0 && tg) {
      z.ct = ph2 ? 4 : 6; const n = ph2 ? 2 : 1;
      for (let i = 0; i < n; i++) { const v = s.rng() < 0.5, at = (v ? tg.x : tg.y) + (s.rng() - 0.5) * 140 + (i ? (s.rng() < 0.5 ? -1 : 1) * (v ? 380 : 260) : 0); s.crush.push({ id: ++s.crushSeq, v, c: clamp(at, 140, (v ? W.AW : W.AH) - 140), w: 230, t: 0, warn: 1.6, life: 2.3 }); }
      s.shake = Math.max(s.shake, 0.15);
    }
    if (z.cd3 <= 0 && tg) { z.cd3 = ph2 ? 3 : 4.5; const a = Math.atan2(tg.y - z.y, tg.x - z.x); for (let i = -1; i <= 1; i++) s.spit.push({ x: z.x, y: z.y - z.r, vx: Math.cos(a + i * 0.3) * 270, vy: Math.sin(a + i * 0.3) * 270, life: 2.2, dmg: z.dmg * 0.5, col: '#8a8f98', big: true }); }
    return ph2 ? 1.3 : 1;
  }

  // ---------------- art (all original) ----------------
  const OL = '#1b1410';
  const rr = (g, x, y, w, h, r) => A().rr(g, x, y, w, h, r);
  const fo = (g, c, w = 3) => { g.fillStyle = c; g.fill(); if (w) { g.lineWidth = w; g.strokeStyle = OL; g.lineJoin = 'round'; g.stroke(); } };
  function label(g, s, x, y, c, px = 16) { g.font = `bold ${px}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = 'rgba(15,10,6,0.9)'; g.strokeText(s, x, y); g.fillStyle = c; g.fillText(s, x, y); }
  function drawVehicle(g, kind, x, y, face, t, moving, v) {
    g.save(); g.translate(x, y); if (face < 0) g.scale(-1, 1);
    const bob = moving ? Math.sin(t * 18) * 1.5 : 0;
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); g.ellipse(6, 4, kind === 'gtruck' ? 96 : 52, kind === 'gtruck' ? 22 : 13, 0, 0, TAU); g.fill();
    if (kind === 'cart') {
      for (const wx of [-30, 26]) for (const wy of [2, -14]) { g.fillStyle = '#222'; g.beginPath(); g.arc(wx, wy + bob * 0.2, 5, 0, TAU); g.fill(); }
      rr(g, -34, -46 + bob, 70, 40, 6); fo(g, 'rgba(190,200,210,0.35)', 3);
      g.strokeStyle = '#aab3bc'; g.lineWidth = 2; g.beginPath(); for (let i = -28; i < 34; i += 10) { g.moveTo(i, -44 + bob); g.lineTo(i + 4, -8 + bob); } for (let j = -40; j < -8; j += 9) { g.moveTo(-32, j + bob); g.lineTo(34, j + bob); } g.stroke();
      g.strokeStyle = '#c0392b'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-34, -50 + bob); g.lineTo(-48, -60 + bob); g.stroke();
    } else if (kind === 'mower') {
      g.fillStyle = 'rgba(120,200,90,0.35)'; g.beginPath(); g.ellipse(34, -2, 30, 10, 0, 0, TAU); g.fill();
      if (moving) { g.strokeStyle = 'rgba(220,255,200,0.6)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 3; i++) { const a = t * 30 + i * 2.1; g.moveTo(34, -2); g.lineTo(34 + Math.cos(a) * 26, -2 + Math.sin(a) * 9); } g.stroke(); }
      for (const [wx, r] of [[-26, 13], [30, 9]]) { g.fillStyle = '#1d1d1d'; g.beginPath(); g.arc(wx, -8 + bob * 0.2, r, 0, TAU); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(wx, -8, r * 0.4, 0, TAU); g.fill(); }
      rr(g, -40, -40 + bob, 84, 30, 10); fo(g, '#d0402a', 3); rr(g, 10, -52 + bob, 30, 16, 6); fo(g, '#e8e2d4', 3);
      rr(g, -30, -58 + bob, 26, 20, 6); fo(g, '#2a2a2e', 3); g.fillStyle = '#ffef9a'; g.beginPath(); g.arc(42, -34 + bob, 4, 0, TAU); g.fill();
    } else {
      // the garbage truck: green hopper behind, a white cab in front
      for (const wx of [-60, -10, 62]) { g.fillStyle = '#1d1d1d'; g.beginPath(); g.arc(wx, -4 + bob * 0.2, 15, 0, TAU); g.fill(); g.fillStyle = '#888'; g.beginPath(); g.arc(wx, -4, 6, 0, TAU); g.fill(); }
      rr(g, -92, -86 + bob, 120, 78, 10); fo(g, '#3d8a4a', 4); g.strokeStyle = '#2b6a38'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(-84 + i * 28, -80 + bob); g.lineTo(-84 + i * 28, -16 + bob); } g.stroke();
      rr(g, 30, -74 + bob, 64, 66, 10); fo(g, '#e8e2d4', 4); rr(g, 46, -66 + bob, 40, 24, 5); fo(g, '#20262e', 3);
      g.fillStyle = '#ffef5a'; g.beginPath(); g.arc(90, -20 + bob, 5, 0, TAU); g.fill(); g.fillStyle = '#ff5a3c'; g.fillRect(-90, -30 + bob, 6, 10);
    }
    g.restore();
    if (v && v.mhp && v.hp < v.mhp && !moving) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(x - 30, y + 14, 60, 6); g.fillStyle = '#7fd6ff'; g.fillRect(x - 29, y + 15, 58 * Math.max(0, v.hp / v.mhp), 4); }
  }
  // outfit pieces (drawn at the hero's head; feet at 0,0)
  function drawFit(g, fit, x, y, face, t, moving) {
    g.save(); g.translate(x, y); if (face < 0) g.scale(-1, 1);
    const hy = -94;
    if (fit === 'cone') { g.beginPath(); g.moveTo(-15, hy + 6); g.lineTo(15, hy + 6); g.lineTo(2, hy - 32); g.closePath(); fo(g, '#ff7a1a', 3); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-9, hy - 6); g.lineTo(9, hy - 6); g.lineTo(6, hy - 14); g.lineTo(-6, hy - 14); g.closePath(); g.fill(); rr(g, -19, hy + 3, 38, 6, 2); fo(g, '#e05a10', 2); }
    else if (fit === 'lid') { g.beginPath(); g.ellipse(0, hy + 4, 22, 8, 0, Math.PI, TAU); g.closePath(); fo(g, '#9aa2aa', 3); g.beginPath(); g.ellipse(0, hy + 4, 23, 5, 0, 0, TAU); fo(g, '#7a838c', 2); rr(g, -6, hy - 8, 12, 5, 2); fo(g, '#5a636c', 2); }
    else if (fit === 'chef') { rr(g, -14, hy - 4, 28, 12, 3); fo(g, '#f4f1ea', 2); for (const [cx, cy, r] of [[-9, hy - 12, 10], [0, hy - 20, 12], [9, hy - 12, 10]]) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); fo(g, '#fbf8f2', 2); } g.fillStyle = 'rgba(60,40,20,0.25)'; g.fillRect(-12, hy, 24, 3); }
    else if (fit === 'goggles') { g.strokeStyle = '#3a2a1c'; g.lineWidth = 4; g.beginPath(); g.moveTo(-17, hy + 22); g.lineTo(17, hy + 22); g.stroke(); for (const ex of [-7, 9]) { g.beginPath(); g.arc(ex, hy + 22, 7, 0, TAU); fo(g, '#9fe0ff', 3); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(ex - 2, hy + 20, 2.2, 0, TAU); g.fill(); } }
    else if (fit === 'crown') { const cols = ['#ffd23f', '#e8424f', '#3ec1ff']; for (let i = 0; i < 3; i++) { const cx = -12 + i * 12, cy = hy - (i === 1 ? 8 : 2); g.beginPath(); for (let k = 0; k < 12; k++) { const a = (k * TAU) / 12, r = k % 2 ? 7 : 8.5; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); fo(g, cols[i], 2); g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(cx - 2, cy - 2, 2, 0, TAU); g.fill(); } }
    else if (fit === 'cape') { const fl = (moving ? 1 : 0.35) * Math.sin(t * 10); g.beginPath(); g.moveTo(-10, -78); g.lineTo(10, -78); g.quadraticCurveTo(-8, -40, -26 - fl * 6, -12); g.lineTo(-40 - fl * 10, -20 + fl * 4); g.quadraticCurveTo(-26, -50, -10, -78); g.closePath(); fo(g, '#1c1c22', 3); g.strokeStyle = 'rgba(160,170,190,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, -70); g.quadraticCurveTo(-20, -44, -30, -22); g.stroke(); }
    g.restore();
  }
  function drawNpc(g, N, kp, t, hiding) {
    const who = { id: 'npc:' + N.id, name: N.name, color: N.color };
    if (hiding) { g.fillStyle = `rgba(255,240,160,${0.25 + 0.15 * Math.sin(t * 4)})`; g.beginPath(); g.ellipse(N.x, N.y - 30, 60, 70, 0, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(N.x + 6, N.y + 2, 22, 8, 0, 0, TAU); g.fill();
    g.strokeStyle = N.color || '#e8b830'; g.lineWidth = 2.5; g.setLineDash([6, 5]); g.beginPath(); g.ellipse(N.x, N.y, 22, 8, 0, 0, TAU); g.stroke(); g.setLineDash([]);
    window.TZSim.heroDraw(g, who, N.x, N.y, { k: kp, moving: !!N.moving, walkT: N.walkT || 0, face: N.face || 1, hurt: N.hurtT > 0 });
    npcLabels(g, N, t, hiding);
  }
  function npcLabels(g, N, t, hiding) {
    if (N.name) label(g, (hiding ? '🙋 ' : '🧍 ') + N.name, N.x, N.y - 108, hiding ? '#ffe066' : '#fff', 16);
    if (hiding) label(g, 'HELP! Walk up to me', N.x, N.y - 128 + Math.sin(t * 3) * 3, '#ffd23f', 14);
    else if (N.mhp) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(N.x - 22, N.y - 96, 44, 6); g.fillStyle = N.hp / N.mhp < 0.35 ? '#ff4a3a' : '#7dff6a'; g.fillRect(N.x - 21, N.y - 95, 42 * Math.max(0, N.hp / N.mhp), 4); }
  }
  function drawCrate(g, c, t) {
    const u = c.t < c.land ? c.t / c.land : 1, h = (1 - u) * 260; g.save(); g.translate(c.x, c.y - h);
    if (c.landed) { const gl = g.createRadialGradient(0, -20, 4, 0, -20, 80); gl.addColorStop(0, `rgba(255,210,63,${0.45 + 0.2 * Math.sin(t * 5)})`); gl.addColorStop(1, 'rgba(255,210,63,0)'); g.fillStyle = gl; g.beginPath(); g.arc(0, -20, 80, 0, TAU); g.fill(); }
    rr(g, -30, -46, 60, 46, 5); fo(g, '#8a5a2a', 3); g.strokeStyle = '#5a3a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-30, -23); g.lineTo(30, -23); g.moveTo(0, -46); g.lineTo(0, 0); g.stroke();
    g.fillStyle = '#e8483a'; g.fillRect(-8, -30, 16, 14); g.fillStyle = '#fff'; g.fillRect(-2, -28, 4, 10); g.fillRect(-6, -25, 12, 4);
    g.restore(); if (c.landed && c.from) label(g, '📦 from ' + c.from, c.x, c.y - 70, '#ffd23f', 14);
  }
  function drawChute(g, c, t) { const u = c.t / c.land, h = (1 - u) * 260, x = c.x + Math.sin(t * 2) * 6, y = c.y - h - 110; g.fillStyle = '#e8483a'; g.beginPath(); g.ellipse(x, y, 52, 30, 0, Math.PI, TAU); g.fill(); g.fillStyle = '#f4f1ea'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - 52 + i * 35, y); g.quadraticCurveTo(x - 34 + i * 35, y - 32, x - 17 + i * 35, y); g.fill(); } g.strokeStyle = 'rgba(30,20,10,0.7)'; g.lineWidth = 1.5; g.beginPath(); for (const dx of [-48, -16, 16, 48]) { g.moveTo(x + dx, y); g.lineTo(c.x, c.y - h - 46); } g.stroke(); }
  function drawSpikes(g, it, t) { g.save(); g.translate(it.x, it.y); rr(g, -it.w / 2, -it.h / 2, it.w, it.h, 4); fo(g, '#3a3f44', 2); g.fillStyle = '#c9ccd1'; for (let i = 0; i < 9; i++) { const sx = -it.w / 2 + 8 + i * ((it.w - 16) / 8); g.beginPath(); g.moveTo(sx - 5, 6); g.lineTo(sx, -12); g.lineTo(sx + 5, 6); g.closePath(); g.fill(); } g.restore(); void t; }
  function drawBarricade(g, o) { g.save(); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(o.x + 4, o.y + o.h - 4, o.w, 10); for (let i = 0; i < 3; i++) { rr(g, o.x, o.y - 30 + i * 16, o.w, 13, 3); fo(g, i % 2 ? '#9a6a32' : '#b07a3a', 2); } g.fillStyle = '#5a5f66'; for (const px of [o.x + 10, o.x + o.w - 18]) g.fillRect(px, o.y - 34, 8, o.h + 30); g.fillStyle = '#ffd23f'; g.fillRect(o.x + o.w / 2 - 14, o.y - 22, 28, 6); if (o.hp < o.mhp) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(o.x + 10, o.y - 46, o.w - 20, 6); g.fillStyle = '#ffb02e'; g.fillRect(o.x + 11, o.y - 45, (o.w - 22) * Math.max(0, o.hp / o.mhp), 4); } g.restore(); }
  function drawFlamer(g, it, t) { g.save(); g.translate(it.x, it.y); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(4, 2, 20, 7, 0, 0, TAU); g.fill(); rr(g, -8, -40, 16, 40, 4); fo(g, '#c0392b', 2); g.beginPath(); g.arc(0, -44, 11, 0, TAU); fo(g, '#7a8088', 2); g.save(); g.rotate(t * 6); g.fillStyle = '#2a2e33'; for (let i = 0; i < 4; i++) { g.rotate(TAU / 4); g.fillRect(4, -2, 10, 4); } g.restore(); g.fillStyle = `rgba(255,140,40,${0.5 + 0.4 * Math.sin(t * 9)})`; g.beginPath(); g.arc(0, -44, 4, 0, TAU); g.fill(); g.restore(); }
  function drawDecoy(g, it, t) { const on = Math.sin(t * 14) > 0; g.save(); g.translate(it.x, it.y); A().car(g, -50, -40, 100, 50, '#6a8ab5', false, { r: W.rng(7) }); g.fillStyle = on ? '#ff3a2a' : '#5a1a14'; g.beginPath(); g.arc(-20, -44, 7, 0, TAU); g.fill(); g.fillStyle = on ? '#3a8aff' : '#14205a'; g.beginPath(); g.arc(20, -44, 7, 0, TAU); g.fill(); if (on) { g.strokeStyle = 'rgba(255,80,60,0.6)'; g.lineWidth = 3; for (let k = 1; k <= 2; k++) { g.beginPath(); g.arc(0, -44, 18 * k + (t * 40) % 18, -2.4, -0.7); g.stroke(); } } g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(-30, -70, 60, 6); g.fillStyle = '#ff5a3c'; g.fillRect(-29, -69, 58 * Math.max(0, it.hp / it.mhp), 4); g.restore(); }
  function drawDoorBar(g, D) { const w = 150; g.fillStyle = 'rgba(15,10,6,0.75)'; g.fillRect(D.x - w / 2 - 3, D.y - 26, w + 6, 14); g.fillStyle = D.hp / D.mhp < 0.3 ? '#ff4a3a' : '#ffd23f'; g.fillRect(D.x - w / 2, D.y - 23, w * Math.max(0, D.hp / D.mhp), 8); label(g, '🚪 ' + Math.ceil(Math.max(0, D.hp)), D.x, D.y - 38, '#ffe9a8', 15); }
  function drawCrushZone(g, c, t) {
    if (c.t >= c.warn + 0.5) return; const a = c.t < c.warn ? 0.18 + 0.22 * (Math.sin(t * (8 + 10 * (c.t / c.warn))) > 0 ? 1 : 0.3) : 0.35;
    g.save(); g.globalAlpha = a; g.fillStyle = '#ff2a1a'; if (c.v) g.fillRect(c.c - c.w / 2, -40, c.w, W.AH + 80); else g.fillRect(-40, c.c - c.w / 2, W.AW + 80, c.w);
    g.globalAlpha = Math.min(0.8, a + 0.25); g.strokeStyle = '#ffd23f'; g.lineWidth = 6; g.setLineDash([22, 16]); g.beginPath(); if (c.v) { g.moveTo(c.c - c.w / 2, -40); g.lineTo(c.c - c.w / 2, W.AH + 40); g.moveTo(c.c + c.w / 2, -40); g.lineTo(c.c + c.w / 2, W.AH + 40); } else { g.moveTo(-40, c.c - c.w / 2); g.lineTo(W.AW + 40, c.c - c.w / 2); g.moveTo(-40, c.c + c.w / 2); g.lineTo(W.AW + 40, c.c + c.w / 2); } g.stroke(); g.setLineDash([]); g.restore();
  }
  function drawCrushWalls(g, c, t) {
    if (c.t < c.warn - 0.5 || c.t > c.warn + 0.6) return; const u = c.t < c.warn ? (c.t - (c.warn - 0.5)) / 0.5 : Math.max(0, 1 - (c.t - c.warn) / 0.6), half = c.w / 2;
    g.save(); g.fillStyle = '#6a7078'; g.strokeStyle = OL; g.lineWidth = 4;
    const plate = (x, y, w, h) => { g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h); g.fillStyle = '#ffd23f'; for (let i = 0; i < Math.max(w, h); i += 60) { if (w > h) g.fillRect(x + i, y + h / 2 - 6, 30, 12); else g.fillRect(x + w / 2 - 6, y + i, 12, 30); } g.fillStyle = '#6a7078'; };
    if (c.v) { const L = W.AW, sx = c.c - half - 400 * (1 - u), ex = c.c + half + 400 * (1 - u); g.globalAlpha = Math.min(1, u * 2); plate(sx - 60, -40, 60 + half * u, W.AH + 80); plate(ex - half * u, -40, 60 + half * u, W.AH + 80); void L; }
    else { const sy = c.c - half - 300 * (1 - u), ey = c.c + half + 300 * (1 - u); g.globalAlpha = Math.min(1, u * 2); plate(-40, sy - 60, W.AW + 80, 60 + half * u); plate(-40, ey - half * u, W.AW + 80, 60 + half * u); }
    g.restore(); void t;
  }
  function drawArena(g, kind, t) {
    g.save();
    if (kind === 'icecream') { // the Brain Freeze speedway: a painted lap round the block
      g.strokeStyle = 'rgba(255,180,220,0.22)'; g.lineWidth = 90; g.beginPath(); g.ellipse(LAP.cx, LAP.cy, LAP.rx, LAP.ry, 0, 0, TAU); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 4; g.setLineDash([30, 26]); g.lineDashOffset = -t * 60; g.stroke(); g.setLineDash([]);
      g.font = '28px sans-serif'; g.textAlign = 'center'; for (let i = 0; i < 6; i++) { const a = i * (TAU / 6) + t * 0.2; g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 3 + i); g.fillText(i % 2 ? '🎵' : '🍦', LAP.cx + Math.cos(a) * (LAP.rx + 80), LAP.cy + Math.sin(a) * (LAP.ry + 70)); } g.globalAlpha = 1;
    } else { // the Big Crunch's pit: steel walls with hazard stripes down both sides
      for (const x of [0, W.AW - 70]) { g.fillStyle = '#4a4f56'; g.fillRect(x, 0, 70, W.AH); g.fillStyle = '#ffd23f'; for (let y = (t * 20) % 80 - 80; y < W.AH; y += 80) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 70, y + 40); g.lineTo(x + 70, y + 64); g.lineTo(x, y + 24); g.closePath(); g.fill(); } g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + (x ? 0 : 60), 0, 10, W.AH); }
    }
    g.restore();
  }
  // Mister Brain Freeze: an ice-cream van with a soft-serve swirl on the roof and a grin for a grille
  function drawIce(g, z, t) {
    const R0 = z.r, ph2 = z.hp < z.mhp * 0.5, fl = z.flash > 0; g.save(); g.translate(z.x, z.y); if ((z.face || 1) < 0) g.scale(-1, 1);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 0, R0 * 1.5, R0 * 0.38, 0, 0, TAU); g.fill();
    const bob = Math.sin(t * 14) * (z.serve > 0 ? 0 : 2);
    for (const wx of [-R0 * 0.9, R0 * 0.8]) { g.fillStyle = '#1d1d1d'; g.beginPath(); g.arc(wx, -R0 * 0.12, R0 * 0.24, 0, TAU); g.fill(); g.fillStyle = '#ff9ac8'; g.beginPath(); g.arc(wx, -R0 * 0.12, R0 * 0.09, 0, TAU); g.fill(); }
    g.translate(0, bob);
    rr(g, -R0 * 1.4, -R0 * 1.3, R0 * 2.5, R0 * 1.15, 14); fo(g, fl ? '#fff' : ph2 ? '#ffd6e8' : '#f6f2ea', 5);
    g.fillStyle = '#ff7ab8'; g.fillRect(-R0 * 1.36, -R0 * 0.55, R0 * 2.42, 12); g.fillStyle = '#7fd6ff'; g.fillRect(-R0 * 1.36, -R0 * 0.43, R0 * 2.42, 6);
    rr(g, -R0 * 0.9, -R0 * 1.15, R0 * 1.0, R0 * 0.45, 6); fo(g, z.serve > 0 ? '#ffe9a8' : '#2a2a34', 3); // the serving hatch
    rr(g, R0 * 0.55, -R0 * 1.15, R0 * 0.45, R0 * 0.38, 6); fo(g, '#20262e', 3);
    g.fillStyle = '#1a0f0a'; rr(g, R0 * 0.95, -R0 * 0.62, R0 * 0.18, R0 * 0.3, 4); g.fill(); g.fillStyle = '#fff'; for (let i = 0; i < 3; i++) g.fillRect(R0 * 0.97, -R0 * 0.6 + i * 8, 7, 5);
    g.fillStyle = ph2 ? '#ff3a6a' : '#ffef5a'; g.beginPath(); g.arc(R0 * 1.02, -R0 * 0.82, 6, 0, TAU); g.fill();
    // the swirl on the roof, with eyes
    g.save(); g.translate(-R0 * 0.2, -R0 * 1.3); g.beginPath(); g.moveTo(-R0 * 0.28, 0); g.lineTo(R0 * 0.28, 0); g.lineTo(0, R0 * 0.5); g.closePath(); g.translate(0, 0); fo(g, '#d9a441', 3);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(0, -i * R0 * 0.22 - 6, R0 * (0.42 - i * 0.1), R0 * 0.15, 0, 0, TAU); fo(g, ph2 ? '#ff9ac8' : '#fff4fa', 3); }
    g.beginPath(); g.arc(R0 * 0.02, -R0 * 0.78, 6, 0, TAU); fo(g, '#ff7ab8', 2);
    for (const ex of [-10, 10]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, -R0 * 0.3, 7, 0, TAU); g.fill(); g.fillStyle = OL; g.beginPath(); g.arc(ex + 2, -R0 * 0.3, 3.5, 0, TAU); g.fill(); }
    g.restore();
    // the speaker horn: notes when it plays
    rr(g, R0 * 0.3, -R0 * 1.55, R0 * 0.3, R0 * 0.25, 4); fo(g, '#9aa2aa', 3);
    if (Math.sin(t * 3) > 0) { g.font = `${Math.round(R0 * 0.4)}px sans-serif`; g.textAlign = 'center'; g.fillText('🎵', R0 * 0.6 + Math.sin(t * 4) * 6, -R0 * 1.8 - (t * 30) % 20); }
    g.restore();
  }
  // The Big Crunch: a walking trash compactor, hydraulic arms, a jaw full of crushed cans
  function drawCrunch(g, z, t) {
    const R0 = z.r, ph2 = z.hp < z.mhp * 0.5, fl = z.flash > 0; g.save(); g.translate(z.x, z.y); if ((z.face || 1) < 0) g.scale(-1, 1);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(0, 0, R0 * 1.3, R0 * 0.4, 0, 0, TAU); g.fill();
    const stomp = Math.abs(Math.sin(t * 4)) * 5;
    for (const s of [-1, 1]) { rr(g, s * R0 * 0.5 - 16, -R0 * 0.45, 32, R0 * 0.45, 4); fo(g, '#3a3f44', 3); rr(g, s * R0 * 0.5 - 22, -8, 44, 12, 4); fo(g, '#2a2e33', 3); }
    g.translate(0, -stomp);
    rr(g, -R0 * 1.0, -R0 * 1.9, R0 * 2.0, R0 * 1.5, 8); fo(g, fl ? '#fff' : ph2 ? '#8a5a4a' : '#6a7078', 5);
    g.fillStyle = '#ffd23f'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-R0 + i * R0 * 0.36, -R0 * 1.9); g.lineTo(-R0 + i * R0 * 0.36 + 16, -R0 * 1.9); g.lineTo(-R0 + i * R0 * 0.36 + 6, -R0 * 1.7); g.lineTo(-R0 + i * R0 * 0.36 - 10, -R0 * 1.7); g.closePath(); g.fill(); }
    // the jaw: crushed cans for teeth, opening and shutting
    const jaw = 6 + Math.abs(Math.sin(t * (ph2 ? 6 : 3))) * 16; rr(g, -R0 * 0.7, -R0 * 1.1, R0 * 1.4, jaw + 14, 6); fo(g, '#1a1410', 3);
    const cans = ['#e8424f', '#3ec1ff', '#9cff3c', '#ffd23f']; for (let i = 0; i < 6; i++) { g.fillStyle = cans[i % 4]; g.fillRect(-R0 * 0.62 + i * R0 * 0.22, -R0 * 1.1, R0 * 0.14, 9); g.fillRect(-R0 * 0.62 + i * R0 * 0.22, -R0 * 1.1 + jaw + 5, R0 * 0.14, 9); }
    for (const ex of [-R0 * 0.4, R0 * 0.4]) { g.fillStyle = ph2 ? '#ff2a1a' : '#ff7a3a'; g.beginPath(); g.arc(ex, -R0 * 1.45, 9, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,200,120,0.5)'; g.beginPath(); g.arc(ex, -R0 * 1.45, 15, 0, TAU); g.fill(); }
    for (const s of [-1, 1]) { const ex = Math.sin(t * 3 + s) * 10; g.strokeStyle = '#2a2e33'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * R0 * 0.95, -R0 * 1.4); g.lineTo(s * (R0 * 1.4 + ex), -R0 * 1.0); g.stroke(); g.strokeStyle = '#c9ccd1'; g.lineWidth = 6; g.stroke(); rr(g, s * (R0 * 1.4 + ex) - 14, -R0 * 1.1, 28, 26, 4); fo(g, '#5a5f66', 3); }
    g.restore();
  }
  window.TZMore = { drawVehicle, drawFit, drawIce, drawCrunch, drawNpc, VK, FITS, LAP };
})();
