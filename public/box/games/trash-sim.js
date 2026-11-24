'use strict';
// TrashZombies on the phone: the whole game runs here (window.TZSim).
//   const sim = new TZSim.Sim(opts)   opts: { seed, homes, me: { id, name, color, avatar }, settings,
//                                            restore (the server's copy of this run), report(msg) -> act,
//                                            live(msg) (co-op relay), on(kind, data) (UI + haptics) }
//   sim.update(dt, input)   input: { mx, my (move -1..1), ax, ay (aim, 0 = none), fire (bool), mouse (bool), grab }
//   TZSim.render(g, sim, view) draws a frame (view: { w, h, dpr, k })
// Modes: 'solo' (just you), 'host' (you run the zombies of a shared area and send snapshots),
// 'guest' (you see the host's zombies, your bullets hit them and you send the hits).
(function () {
  const W = window.TZW, A = () => window.TZA, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const SNAP_MS = 66, IN_MS = 66, ST_MS = 1000, MAX_Z = 90, MAX_B = 260, MAX_FX = 220;
  const dist2 = (a, b, x, y) => (a - x) * (a - x) + (b - y) * (b - y);

  class Sim {
    constructor(o) {
      this.o = o; this.seed = o.seed; this.homes = o.homes || []; this.me = o.me; this.set = o.settings || {};
      this.rng = W.rng(W.hash(o.seed, o.me.id, Date.now()));
      this.t = 0; this.mode = 'solo'; this.areaMembers = [o.me.id]; this.host = o.me.id;
      this.z = []; this.zid = 1; this.b = []; this.ghost = []; this.gems = []; this.pk = []; this.pkid = 1; this.fx = []; this.spit = []; this.others = new Map();
      this.hits = []; this.shots = []; this.kills = []; this.booms = []; this.pend = []; // co-op outboxes
      this.lastSnap = 0; this.lastIn = 0; this.lastSt = 0; this.snapAt = 0;
      this.cards = null; this.pendingLevels = 0; this.paused = false; this.choosing = false;
      this.dead = false; this.phase = 'intro'; this.introT = 0; this.banner = null; this.shake = 0; this.flash = 0;
      const R = o.restore || {};
      this.ab = { ...(R.ab || {}) }; this.lvl = R.lvl || 1; this.xp = R.xp || 0; this.killCount = R.kills || 0; this.wave = R.wave || 1;
      this.cell = (R.cell || [4, 4]).slice();
      const P = this.p = { x: W.AW / 2, y: W.AH / 2, vx: 0, vy: 0, r: 18, hp: 100, aim: 0, face: 1, fireCd: 0, inv: 0, walkT: 0, moving: false, kick: 0, armor: 0, lives: 0, down: 0 };
      this.buffs = { shield: 0, minigun: 0, kicks: 0, freeze: 0, xp2: 0 };
      this.stats(); P.hp = R.hp > 0 ? Math.min(R.hp, this.S.mhp) : this.S.mhp; P.lives = (this.ab.life || 0) - (R.livesUsed || 0);
      this.timers = { bomb: 4, zap: 2, shove: 3, drone: 0, pk: 12, regen: 0 };
      this.orbHit = new Map(); this.raccoon = null; this.drone = { x: 0, y: 0, cd: 0 };
      const home = !R.wave || (R.wave === 1 && R.cell && R.home && R.cell[0] === R.home[0] && R.cell[1] === R.home[1]);
      this.enterArea(this.cell[0], this.cell[1], null, home);
      if (!home) { this.phase = 'play'; this.startWave(); }
    }
    // ---------------- stats from abilities ----------------
    stats() {
      const a = (id) => this.ab[id] || 0, lv = this.lvl;
      this.S = {
        rate: 5.5 * (1 + 0.18 * a('rapid')), dmg: 10 * (1 + 0.25 * a('big')) * (1 + 0.03 * (lv - 1)), br: 5 + 1.6 * a('big'), bspeed: 980, pierce: a('pierce'), bounce: a('bounce'),
        crit: 0.1 * a('crit'), burn: a('burn'), spread: 1 + a('spread'), rear: a('rear'), mhp: 100 + 25 * a('hp'), regen: a('regen'), armor: 1 - 0.1 * a('plating'), dodge: 0.08 * a('dodge'),
        thorns: 15 * a('thorns'), shove: a('shove'), orbit: a('orbit'), drone: a('drone'), bomb: a('bomb'), zap: a('zap'), magnet: 95 * (1 + 0.6 * a('magnet')), slow: 0.15 * a('slow'), raccoon: a('raccoon'),
        speed: 255 * (1 + 0.1 * a('kicks')),
      };
      if (this.S.raccoon && !this.raccoon) this.raccoon = { x: this.p ? this.p.x : 800, y: this.p ? this.p.y : 480, cd: 0, face: 1, t: 0 };
    }
    // ---------------- areas ----------------
    isHome(x, y) { return this.homes.some((h) => h[0] === x && h[1] === y); }
    enterArea(cx, cy, from, home) {
      this.cell = [cx, cy];
      this.area = W.genArea(this.seed, cx, cy, home != null ? home : this.isHome(cx, cy));
      this.bg = null; // re-rendered by the renderer
      this.z.length = 0; this.b.length = 0; this.ghost.length = 0; this.gems.length = 0; this.pk.length = 0; this.spit.length = 0; this.fx.length = 0; this.others.clear(); this.orbHit.clear();
      this.cleared = false; this.waveKills = 0; this.spawned = 0; this.spawnCd = 1.6; this.bossDue = false; this.bossSpawned = false; this.snap = null;
      const P = this.p, AW = W.AW, AH = W.AH;
      if (from === 'n') { P.x = AW / 2; P.y = AH - 40; } else if (from === 's') { P.x = AW / 2; P.y = 40; } else if (from === 'w') { P.x = AW - 40; P.y = AH / 2; } else if (from === 'e') { P.x = 40; P.y = AH / 2; }
      else if (this.area.garage) { P.x = AW / 2; P.y = 120; } else { P.x = AW / 2; P.y = AH / 2; }
      if (this.raccoon) { this.raccoon.x = P.x; this.raccoon.y = P.y + 30; }
    }
    // Walking out of an exit: the next cell is the next wave.
    leave(dir) {
      const d = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[dir], nx = this.cell[0] + d[0], ny = this.cell[1] + d[1];
      if (!W.inGrid(nx, ny)) return;
      this.wave++; this.enterArea(nx, ny, dir); this.mode = 'solo'; this.areaMembers = [this.me.id]; this.host = this.me.id;
      this.o.report({ op: 'enter', x: nx, y: ny }).then((r) => { if (r && r.ok && r.area) this.setArea(r.area); });
      this.startWave(); this.reportStatus(true);
      this.o.on('enter', { biome: this.area.biome, wave: this.wave });
    }
    startWave() {
      this.spec = W.waveSpec(this.wave, this.areaMembers.length, this.set.diff);
      if (this.set.diff === 'chill') { this.spec.hpMul *= 0.75; this.spec.every *= 1.25; this.spec.dmgMul *= 0.7; this.spec.target = Math.round(this.spec.target * 0.85); }
      this.banner = { text: 'WAVE ' + this.wave, sub: this.area.biome.name + (this.spec.boss ? ' · ⚠️ BOSS' : ''), t: 2.6 };
      this.bossDue = this.spec.boss; this.spawnCd = 1.8; this.timers.pk = 8 + this.rng() * 6;
    }
    // Co-op membership from the server: who is here and who runs the zombies.
    setArea(a) {
      if (!a || a.k !== this.cell[0] + ',' + this.cell[1]) return;
      const was = this.mode, members = a.members || [this.me.id];
      this.areaMembers = members.slice(); this.host = a.host;
      this.mode = members.length < 2 ? 'solo' : a.host === this.me.id ? 'host' : 'guest';
      for (const id of [...this.others.keys()]) if (!members.includes(id)) this.others.delete(id);
      if (was === 'guest' && this.mode !== 'guest') this.takeOver();
      if (this.mode === 'guest' && was !== 'guest') { this.z.length = 0; this.pk.length = 0; this.gems.length = 0; }
      if (this.mode !== 'solo' && was === 'solo') { // gems in a shared area become XP straight away
        for (const g of this.gems) this.gainXp(g.v); this.gems.length = 0;
      }
      if (this.mode === 'host' && this.spec) { const old = this.spec; this.spec = W.waveSpec(this.wave, members.length, this.set.diff); this.spec.target = Math.max(old.target, this.spec.target); }
      if (was !== this.mode) this.o.on('coop', { mode: this.mode, members });
    }
    // The host left: carry on from the last snapshot.
    takeOver() {
      const s = this.snap; this.z.length = 0;
      if (s) {
        this.wave = Math.max(this.wave, s.w[0]); this.spec = W.waveSpec(this.wave, this.areaMembers.length, this.set.diff);
        this.waveKills = s.w[1]; this.spec.target = s.w[2]; this.cleared = !!s.w[3]; this.bossDue = !!s.w[4]; this.bossSpawned = !s.w[4];
        let maxId = 0;
        for (let i = 0; i < s.z.length; i += 5) { const T = Object.keys(W.ZOMBIES)[s.z[i + 1]]; const z = this.makeZ(T, s.z[i + 2], s.z[i + 3]); z.id = s.z[i]; z.hp = s.z[i + 4]; maxId = Math.max(maxId, z.id); }
        this.zid = maxId + 1;
        this.pk = (s.p || []).map(([id, k, x, y, life]) => ({ id, k, x, y, life }));
        this.pkid = this.pk.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      }
    }
    // ---------------- zombies ----------------
    makeZ(type, x, y) {
      const Z = W.ZOMBIES[type], sp = this.spec || W.waveSpec(this.wave, 1, this.set.diff);
      const z = { id: this.zid++, type, ti: Object.keys(W.ZOMBIES).indexOf(type), x, y, tx: x, ty: y, vx: 0, vy: 0, r: Z.r, hp: Z.hp * sp.hpMul, mhp: Z.hp * sp.hpMul, speed: Z.speed * sp.speedMul * (0.85 + this.rng() * 0.3), dmg: Z.dmg * sp.dmgMul, xp: Z.xp, flash: 0, burn: 0, burnT: 0, f: this.rng() * 4, face: 1, cd: 1 + this.rng() * 2, slow: 1, kx: 0, ky: 0, boss: !!Z.boss };
      if (Z.boss) { z.hp = z.mhp = Z.hp * sp.hpMul * (0.8 + this.wave * 0.06) * (1 + 0.5 * (this.areaMembers.length - 1)); z.charge = 0; }
      this.z.push(z); return z;
    }
    spawnOne(type) {
      const AW = W.AW, AH = W.AH, side = Math.floor(this.rng() * 4), t = 0.08 + this.rng() * 0.84, P = this.p;
      let x, y; if (side === 0) { x = t * AW; y = -50; } else if (side === 1) { x = t * AW; y = AH + 50; } else if (side === 2) { x = -50; y = t * AH; } else { x = AW + 50; y = t * AH; }
      if (dist2(x, y, P.x, P.y) < 260 * 260) { x = AW - x; y = AH - y; } // never right on top of you
      if (!type) { const ws = this.spec.weights, tot = ws.reduce((s, w) => s + w[1], 0); let r = this.rng() * tot; type = ws[0][0]; for (const [k, w] of ws) { r -= w; if (r <= 0) { type = k; break; } } }
      return this.makeZ(type, x, y);
    }
    damageZ(z, dmg, by, kx = 0, ky = 0, o = {}) {
      if (z.hp <= 0) return;
      if (this.mode === 'guest') { this.hits.push([z.id, Math.round(dmg * 10) / 10, Math.round(kx), Math.round(ky), o.burn || 0]); z.flash = 0.08; this.fxHit(z, dmg, o.crit); return; }
      z.hp -= dmg; z.flash = 0.08; if (o.burn) { z.burn = Math.max(z.burn, o.burn * 4); z.burnT = 3; }
      const res = z.boss ? 0.15 : W.ZOMBIES[z.type].tough ? 0.5 : 1; z.kx += kx * res; z.ky += ky * res;
      this.fxHit(z, dmg, o.crit);
      if (z.hp <= 0) this.killZ(z, by);
    }
    killZ(z, by) {
      z.hp = 0; this.waveKills++;
      const mine = by === this.me.id;
      if (mine) this.killCount++;
      // XP: gems when you're alone, straight XP in a shared area (shared, or to the shooter)
      if (this.mode === 'solo') { const n = Math.min(4, z.xp), v = z.xp / n; for (let i = 0; i < n; i++) this.gems.push({ x: z.x + (this.rng() - 0.5) * 20, y: z.y + (this.rng() - 0.5) * 20, v, t: 0 }); }
      else { this.kills.push([by, z.xp]); if (this.set.xp !== 'own' || mine) this.gainXp(z.xp); }
      for (let i = 0; i < (z.boss ? 30 : 8); i++) this.particle(z.x, z.y - z.r, (this.rng() - 0.5) * 300, (this.rng() - 0.7) * 300, z.boss ? '#2e7d4a' : '#7fbf4a', 0.5 + this.rng() * 0.3, 4 + this.rng() * 4);
      if (W.ZOMBIES[z.type].pops) this.boom(z.x, z.y, 95, 22 * (this.spec ? this.spec.dmgMul : 1), '#b6ff3c', true);
      if (z.boss) { this.dropPickup(z.x, z.y); this.shake = Math.max(this.shake, 0.5); this.o.on('bossdown', {}); }
      else if (this.rng() < 0.025) this.dropPickup(z.x, z.y);
      this.booms.push([1, Math.round(z.x), Math.round(z.y)]);
    }
    fxHit(z, dmg, crit) { this.particle(z.x, z.y - z.r * 1.4, (this.rng() - 0.5) * 160, -80 - this.rng() * 120, crit ? '#ffe066' : '#8fd65a', 0.3, crit ? 6 : 3); }
    // An explosion: hurts zombies (and you, if it's a bloater popping next to you).
    boom(x, y, rad, dmg, color, hurtsYou) {
      this.fx.push({ k: 'ring', x, y, r: 10, R: rad, t: 0, life: 0.35, c: color }); this.shake = Math.max(this.shake, 0.2);
      if (hurtsYou && dist2(x, y, this.p.x, this.p.y) < rad * rad) this.hurt(dmg, x, y);
      if (this.mode === 'guest' && hurtsYou) return;
      for (const z of this.z) if (z.hp > 0 && dist2(x, y, z.x, z.y) < (rad + z.r) * (rad + z.r)) { const d = Math.hypot(z.x - x, z.y - y) || 1; this.damageZ(z, hurtsYou ? dmg * 1.5 : dmg, this.me.id, ((z.x - x) / d) * 260, ((z.y - y) / d) * 260); }
    }
    particle(x, y, vx, vy, c, life, s) { if (this.fx.length >= MAX_FX) this.fx.shift(); this.fx.push({ k: 'p', x, y, vx, vy, c, t: 0, life, s }); }
    // ---------------- you ----------------
    hurt(dmg, fx, fy) {
      const P = this.p, B = this.buffs;
      if (this.dead || P.inv > 0 || B.shield > 0 || this.phase !== 'play' || (this.choosing && this.mode !== 'solo')) return;
      if (P.armor > 0) { P.armor = 0; P.inv = 0.6; this.o.on('armor', {}); this.fx.push({ k: 'ring', x: P.x, y: P.y - 20, r: 10, R: 70, t: 0, life: 0.3, c: '#b7c2cc' }); return; }
      if (this.rng() < this.S.dodge) { this.fx.push({ k: 'txt', x: P.x, y: P.y - 70, text: 'DODGE!', t: 0, life: 0.7, c: '#ffe066' }); P.inv = 0.3; return; }
      const d = dmg * this.S.armor; P.hp -= d; P.inv = 0.75; this.flash = 0.25; this.shake = Math.max(this.shake, 0.18);
      if (fx != null) { const L = Math.hypot(P.x - fx, P.y - fy) || 1; P.vx += ((P.x - fx) / L) * 260; P.vy += ((P.y - fy) / L) * 260; }
      this.o.on('hurt', { hp: P.hp, mhp: this.S.mhp });
      if (P.hp <= 0) {
        if (P.lives > 0) { P.lives--; P.hp = this.S.mhp * 0.6; P.inv = 2.2; this.boom(P.x, P.y, 220, 80, '#ffd23f', false); this.o.on('down', {}); this.o.report({ op: 'ev', k: 'down' }); return; }
        P.hp = 0; this.die();
      }
    }
    die() { this.dead = true; this.phase = 'dead'; this.cards = null; this.choosing = false; this.paused = false; this.reportStatus(true); this.o.report({ op: 'ev', k: 'dead' }); this.o.on('dead', this.summary()); }
    summary() { return { wave: this.wave, kills: this.killCount, lvl: this.lvl, ab: { ...this.ab }, biome: this.area.biome.name }; }
    gainXp(v) {
      if (this.dead) return;
      this.xp += v * (this.buffs.xp2 > 0 ? 2 : 1);
      while (this.xp >= W.xpNeed(this.lvl)) { this.xp -= W.xpNeed(this.lvl); this.lvl++; this.pendingLevels++; this.stats(); this.p.hp = Math.min(this.S.mhp, this.p.hp + 10); if (this.S.bomb) this.timers.bomb = 0; }
      if (this.pendingLevels && !this.cards) this.offerCards();
    }
    offerCards() {
      const ids = W.offer(this.rng, this.ab);
      this.cards = ids.length ? ids : ['_snack']; this.choosing = true; this.paused = this.mode === 'solo';
      this.o.on('level', { lvl: this.lvl - this.pendingLevels + 1, cards: this.cards });
    }
    pick(i) {
      if (!this.cards) return false;
      const id = this.cards[i]; if (id == null) return false;
      this.pendingLevels = Math.max(0, this.pendingLevels - 1);
      if (id !== '_snack') {
        this.ab[id] = (this.ab[id] || 0) + 1; const prevMhp = this.S.mhp; this.stats();
        if (id === 'hp') this.p.hp = Math.min(this.S.mhp, this.p.hp + 25 + (this.S.mhp - prevMhp) * 0);
        if (id === 'life') this.p.lives++;
        this.o.report({ op: 'ev', k: 'pick', id });
      } else this.p.hp = Math.min(this.S.mhp, this.p.hp + 40);
      this.cards = null; this.choosing = false; this.paused = false; this.p.inv = Math.max(this.p.inv, 0.8);
      if (this.pendingLevels) this.offerCards();
      this.reportStatus(true);
      return true;
    }
    applyPickup(k) {
      const P = this.p, B = this.buffs, Pk = W.PK[k]; if (!Pk) return;
      if (k === 'armor') P.armor = 1; else if (k === 'snack') P.hp = Math.min(this.S.mhp, P.hp + 35);
      else if (k === 'nuke') { this.flash = -0.6; this.shake = 0.5; if (this.mode === 'guest') this.pend.push({ t: 'fx', kind: 'nuke' }); else this.nuke(); }
      else if (k === 'freeze') { B.freeze = 6; if (this.mode === 'guest') this.pend.push({ t: 'fx', kind: 'freeze' }); }
      else B[k] = Pk.dur;
      this.fx.push({ k: 'txt', x: P.x, y: P.y - 80, text: Pk.name + '!', t: 0, life: 1.1, c: Pk.color });
      this.fx.push({ k: 'ring', x: P.x, y: P.y - 20, r: 10, R: 90, t: 0, life: 0.35, c: Pk.color });
      this.o.report({ op: 'ev', k: 'pickup', id: k }); this.o.on('pickup', { k });
    }
    nuke() { for (const z of this.z) if (z.hp > 0) this.damageZ(z, z.boss ? z.mhp * 0.3 : 99999, this.me.id); }
    dropPickup(x, y) { const L = W.PICKUPS, k = L[Math.floor(this.rng() * L.length)].id; this.pk.push({ id: this.pkid++, k, x: clamp(x, 60, W.AW - 60), y: clamp(y, 60, W.AH - 60), life: 22 }); }
    // ---------------- the frame ----------------
    update(dt, I) {
      dt = Math.min(dt, 0.05); this.t += dt; this._lastInput = I;
      this.flash = this.flash > 0 ? Math.max(0, this.flash - dt) : Math.min(0, this.flash + dt);
      this.shake = Math.max(0, this.shake - dt);
      if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
      if (this.phase === 'intro') { this.updateIntro(dt, I); this.fxStep(dt); return; }
      if (this.phase === 'dead') { this.fxStep(dt); this.netStep(); return; }
      const slow = this.paused ? 0 : 1, sdt = dt * slow;
      if (sdt > 0) {
        this.moveYou(sdt, I);
        this.shoot(sdt, I);
        this.abilities(sdt);
        if (this.mode !== 'guest') { this.spawnStep(sdt); this.zombieStep(sdt); this.pickupStep(sdt); this.waveStep(); } else this.guestStep(sdt);
        this.bulletStep(sdt);
        this.contact(sdt);
        this.gemStep(sdt);
        this.buffStep(sdt);
        this.othersStep(sdt);
      }
      this.fxStep(dt);
      this.netStep();
      if (this.t - this.lastSt > ST_MS / 1000) this.reportStatus();
    }
    updateIntro(dt, I) {
      this.introT += dt * (I && I.skip ? 6 : 1);
      const P = this.p, T = this.introT;
      if (T > 2.9) { P.moving = true; P.walkT += dt; P.y = Math.min(380, 120 + (T - 2.9) * 170); P.face = 1; P.aim = 0.5; }
      if (T > 1.3 && T < 2.9) this.shake = Math.max(this.shake, 0.12);
      if (T > 4.5) { this.phase = 'play'; P.moving = false; this.startWave(); this.o.on('start', {}); this.reportStatus(true); }
    }
    moveYou(dt, I) {
      const P = this.p, S = this.S, B = this.buffs;
      let mx = I.mx || 0, my = I.my || 0; const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
      if (this.choosing && this.mode !== 'solo') { mx = 0; my = 0; }
      const sp = S.speed * (B.kicks > 0 ? 1.5 : 1);
      P.vx = P.vx * Math.pow(0.0005, dt) + mx * sp * (1 - Math.pow(0.0005, dt)) * 1.0;
      P.vy = P.vy * Math.pow(0.0005, dt) + my * sp * (1 - Math.pow(0.0005, dt)) * 1.0;
      P.x += P.vx * dt; P.y += P.vy * dt;
      P.moving = Math.hypot(P.vx, P.vy) > 30; if (P.moving) P.walkT += dt;
      this.collide(P);
      // the edges: closed unless this area is cleared and there is an exit lane here
      const AW = W.AW, AH = W.AH, e = this.area.exits, open = this.cleared, inX = Math.abs(P.x - AW / 2) < 80, inY = Math.abs(P.y - AH / 2) < 80;
      if (open && e.n && inX && P.y < -10) return this.leave('n');
      if (open && e.s && inX && P.y > AH + 10) return this.leave('s');
      if (open && e.w && inY && P.x < -10) return this.leave('w');
      if (open && e.e && inY && P.x > AW + 10) return this.leave('e');
      P.x = clamp(P.x, open && e.w && inY ? -30 : P.r, open && e.e && inY ? AW + 30 : AW - P.r);
      P.y = clamp(P.y, open && e.n && inX ? -30 : P.r, open && e.s && inX ? AH + 30 : AH - P.r);
      if (P.inv > 0) P.inv -= dt;
      if (P.kick > 0) P.kick = Math.max(0, P.kick - dt * 8);
    }
    collide(e) {
      for (const o of this.area.obstacles) {
        const nx = clamp(e.x, o.x, o.x + o.w), ny = clamp(e.y, o.y, o.y + o.h), dx = e.x - nx, dy = e.y - ny, d2 = dx * dx + dy * dy;
        if (d2 < e.r * e.r) {
          if (d2 > 0.0001) { const d = Math.sqrt(d2), push = e.r - d; e.x += (dx / d) * push; e.y += (dy / d) * push; }
          else { // inside: push out the shortest way
            const l = e.x - o.x, r = o.x + o.w - e.x, t = e.y - o.y, b = o.y + o.h - e.y, m = Math.min(l, r, t, b);
            if (m === l) e.x = o.x - e.r; else if (m === r) e.x = o.x + o.w + e.r; else if (m === t) e.y = o.y - e.r; else e.y = o.y + o.h + e.r;
          }
        }
      }
    }
    nearestZ(x, y, range) {
      let best = null, bd = range * range;
      for (const z of this.z) { if (z.hp <= 0) continue; const d = dist2(x, y, z.x, z.y - z.r); if (d < bd) { bd = d; best = z; } }
      return best;
    }
    shoot(dt, I) {
      const P = this.p, S = this.S, B = this.buffs;
      let fire = false;
      if (this.choosing && this.mode !== 'solo') return;
      if (I.ax || I.ay) { P.aim = Math.atan2(I.ay, I.ax); fire = I.mouse ? !!I.fire : true; }
      else if (this.set.aim !== 'off' && !I.mouse) { const z = this.nearestZ(P.x, P.y - 24, 640); if (z) { P.aim = Math.atan2(z.y - z.r - (P.y - 24), z.x - P.x); fire = true; } }
      if (Math.cos(P.aim) > 0.15) P.face = 1; else if (Math.cos(P.aim) < -0.15) P.face = -1;
      P.fireCd -= dt; if (!fire || P.fireCd > 0) return;
      const mini = B.minigun > 0, rate = S.rate * (mini ? 3.5 : 1);
      P.fireCd += 1 / rate; if (P.fireCd < -0.05) P.fireCd = 0;
      P.kick = 1;
      const ox = P.x + Math.cos(P.aim) * 34, oy = P.y - 26 + Math.sin(P.aim) * 34;
      const dirs = [];
      const n = S.spread, step = 0.13;
      for (let i = 0; i < n; i++) dirs.push(P.aim + (i - (n - 1) / 2) * step + (mini ? (this.rng() - 0.5) * 0.12 : 0));
      if (S.rear >= 1) dirs.push(P.aim + Math.PI); if (S.rear >= 2) { dirs.push(P.aim + Math.PI / 2, P.aim - Math.PI / 2); }
      for (const a of dirs) this.fireBullet(ox, oy, a);
      this.o.on('shot', { mini });
    }
    fireBullet(x, y, a) {
      const S = this.S; if (this.b.length >= MAX_B) this.b.shift();
      const crit = this.rng() < S.crit;
      this.b.push({ x, y, vx: Math.cos(a) * S.bspeed, vy: Math.sin(a) * S.bspeed, r: S.br * (crit ? 1.3 : 1), dmg: S.dmg * (crit ? 3 : 1), crit, pierce: S.pierce, bounce: S.bounce, life: 0.8, hit: null, burn: S.burn });
      if (this.mode !== 'solo') this.shots.push([Math.round(x), Math.round(y), Math.round(a * 100) / 100]);
    }
    bulletStep(dt) {
      const obs = this.area.obstacles;
      for (let i = this.b.length - 1; i >= 0; i--) {
        const b = this.b[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        let dead = b.life <= 0 || b.x < -60 || b.y < -60 || b.x > W.AW + 60 || b.y > W.AH + 60;
        if (!dead) for (const o of obs) if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
          if (b.bounce > 0) { b.bounce--; const px = b.x - b.vx * dt, py = b.y - b.vy * dt; if (px <= o.x || px >= o.x + o.w) b.vx = -b.vx; else b.vy = -b.vy; b.x = px; b.y = py; b.life = Math.max(b.life, 0.4); }
          else { dead = true; this.particle(b.x, b.y, (this.rng() - 0.5) * 120, (this.rng() - 0.5) * 120, '#ffe9a8', 0.18, 3); }
          break;
        }
        if (!dead) for (const z of this.z) {
          if (z.hp <= 0 || (b.hit && b.hit.includes(z.id))) continue;
          const zr = z.r + b.r, zy = z.y - z.r;
          if (dist2(b.x, b.y, z.x, zy) < zr * zr) {
            const sp = Math.hypot(b.vx, b.vy) || 1;
            this.damageZ(z, b.dmg, this.me.id, (b.vx / sp) * 140, (b.vy / sp) * 140, { crit: b.crit, burn: b.burn });
            if (b.pierce > 0) { b.pierce--; (b.hit || (b.hit = [])).push(z.id); } else { dead = true; }
            break;
          }
        }
        if (dead) this.b.splice(i, 1);
      }
      for (let i = this.ghost.length - 1; i >= 0; i--) { const b = this.ghost[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; let dead = b.life <= 0; if (!dead) for (const o of obs) if (b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) { dead = true; break; } if (dead) this.ghost.splice(i, 1); }
    }
    spawnStep(dt) {
      const sp = this.spec; if (!sp || this.cleared) return;
      if (this.banner && this.banner.t > 1.2) return;
      const live = this.z.length;
      if (this.bossDue && !this.bossSpawned && this.waveKills >= sp.target * 0.3) { this.bossSpawned = true; const z = this.spawnOne('boss'); this.o.report({ op: 'ev', k: 'boss' }); this.o.on('boss', {}); this.banner = { text: '⚠️ DUMPSTER BRUTE', sub: 'It smells you.', t: 2.2 }; z.y = z.y < 0 ? -70 : z.y; }
      if (this.waveKills + live >= sp.target + (this.bossDue ? 1 : 0)) return;
      this.spawnCd -= dt; if (this.spawnCd > 0 || live >= Math.min(MAX_Z, sp.cap)) return;
      this.spawnCd = sp.every * (0.6 + this.rng() * 0.8);
      const burst = this.wave >= 3 && this.rng() < 0.18 ? 3 : 1;
      for (let i = 0; i < burst; i++) this.spawnOne();
    }
    targets() {
      const L = [this.dead || (this.choosing && this.mode !== 'solo') ? null : this.p];
      for (const o of this.others.values()) if (o.hp > 0 && !o.ch) L.push(o);
      return L.filter(Boolean);
    }
    zombieStep(dt) {
      const T = this.targets(), frozen = this.buffs.freeze > 0 || this.remoteFreeze > 0, Z = this.z, n = Z.length;
      if (this.remoteFreeze > 0) this.remoteFreeze -= dt;
      for (let i = 0; i < n; i++) {
        const z = Z[i]; if (z.hp <= 0) continue;
        if (z.flash > 0) z.flash -= dt;
        if (z.burnT > 0) { z.burnT -= dt; z.hp -= z.burn * dt; if (this.rng() < dt * 8) this.particle(z.x, z.y - z.r * 2, (this.rng() - 0.5) * 30, -60, '#ff8c42', 0.4, 4); if (z.hp <= 0) { this.killZ(z, this.me.id); continue; } }
        z.x += z.kx * dt; z.y += z.ky * dt; z.kx *= Math.pow(0.02, dt); z.ky *= Math.pow(0.02, dt);
        if (frozen) continue;
        let tg = null, bd = Infinity; for (const p of T) { const d = dist2(z.x, z.y, p.x, p.y); if (d < bd) { bd = d; tg = p; } }
        let slow = 1; for (const p of T) if (p.slow && dist2(z.x, z.y, p.x, p.y) < 230 * 230) slow = Math.min(slow, 1 - p.slow);
        if (this.S.slow && !this.dead && dist2(z.x, z.y, this.p.x, this.p.y) < 230 * 230) slow = Math.min(slow, 1 - this.S.slow);
        let sp = z.speed * slow;
        if (!tg) { z.f += dt * 2; continue; }
        let dx = tg.x - z.x, dy = tg.y - z.y; const d = Math.sqrt(bd) || 1; dx /= d; dy /= d;
        if (W.ZOMBIES[z.type].spits) { // keep a distance and lob goo
          if (d < 280) { dx = -dx; dy = -dy; sp *= 0.6; } else if (d < 380) sp = 0;
          z.cd -= dt; if (z.cd <= 0 && d < 520) { z.cd = 2.6; const a = Math.atan2(tg.y - 20 - (z.y - z.r * 2), tg.x - z.x); this.spit.push({ x: z.x, y: z.y - z.r * 2, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, life: 2, dmg: z.dmg }); }
        }
        if (z.boss) { z.cd -= dt; if (z.charge > 0) { z.charge -= dt; sp *= 3.2; } else if (z.cd <= 0 && d < 520) { z.cd = 4.5; z.charge = 0.7; this.shake = Math.max(this.shake, 0.2); } }
        // separation from nearby zombies (cheap: only a few neighbours)
        let sx = 0, sy = 0;
        for (let j = i + 1, c = 0; j < n && c < 10; j++) { const o = Z[j]; const ddx = z.x - o.x, ddy = z.y - o.y, rr = z.r + o.r; if (ddx > rr || ddx < -rr || ddy > rr || ddy < -rr) continue; c++; const dd = ddx * ddx + ddy * ddy; if (dd < rr * rr && dd > 0.01) { const k = (rr - Math.sqrt(dd)) * 0.5 / Math.sqrt(dd); sx += ddx * k; sy += ddy * k; o.x -= ddx * k; o.y -= ddy * k; } }
        z.x += dx * sp * dt + sx; z.y += dy * sp * dt + sy;
        z.face = dx >= 0 ? 1 : -1; z.f += dt * (sp / 18);
        if (z.x > 0 && z.y > 0 && z.x < W.AW && z.y < W.AH) this.collide(z);
      }
      // the dead are cleared out
      for (let i = Z.length - 1; i >= 0; i--) if (Z[i].hp <= 0) Z.splice(i, 1);
      for (let i = this.spit.length - 1; i >= 0; i--) {
        const s = this.spit[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
        let dead = s.life <= 0;
        if (!dead && !this.dead && dist2(s.x, s.y, this.p.x, this.p.y - 20) < 30 * 30) { this.hurt(s.dmg, s.x, s.y); dead = true; }
        if (!dead) for (const o of this.area.obstacles) if (s.x > o.x && s.x < o.x + o.w && s.y > o.y && s.y < o.y + o.h) { dead = true; break; }
        if (dead) { this.particle(s.x, s.y, 0, 0, '#b6ff3c', 0.3, 8); this.spit.splice(i, 1); }
      }
    }
    // A guest: zombies glide to the host's positions; spit is checked against you.
    guestStep(dt) {
      const k = Math.min(1, dt * 14);
      for (const z of this.z) { const ox = z.x; z.x += (z.tx - z.x) * k; z.y += (z.ty - z.y) * k; if (Math.abs(z.x - ox) > 0.3) z.face = z.x > ox ? 1 : -1; z.f += dt * 4; if (z.flash > 0) z.flash -= dt; }
      for (let i = this.spit.length - 1; i >= 0; i--) { const s = this.spit[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (!this.dead && dist2(s.x, s.y, this.p.x, this.p.y - 20) < 30 * 30) { this.hurt(s.dmg, s.x, s.y); s.life = 0; } if (s.life <= 0) this.spit.splice(i, 1); }
      for (const p of this.pk) p.life -= dt;
    }
    contact(dt) {
      const P = this.p; if (this.dead) return;
      for (const z of this.z) {
        if (z.hp <= 0) continue;
        const rr = z.r + P.r - 4;
        if (dist2(z.x, z.y, P.x, P.y) < rr * rr) {
          this.hurt(z.dmg, z.x, z.y);
          if (this.S.thorns && (z.thornCd || 0) <= this.t) { z.thornCd = this.t + 0.5; this.damageZ(z, this.S.thorns, this.me.id); }
        }
      }
    }
    abilities(dt) {
      const S = this.S, P = this.p, T = this.timers;
      if (this.dead) return;
      if (S.regen) { T.regen += dt; if (T.regen >= 1) { T.regen -= 1; P.hp = Math.min(S.mhp, P.hp + S.regen); } }
      if (S.orbit) {
        const n = S.orbit, R = 85;
        for (let i = 0; i < n; i++) {
          const a = this.t * 3.2 + (i * TAU) / n, ox = P.x + Math.cos(a) * R, oy = P.y - 20 + Math.sin(a) * R;
          for (const z of this.z) { if (z.hp <= 0) continue; const rr = z.r + 18; if (dist2(ox, oy, z.x, z.y - z.r) < rr * rr) { const last = this.orbHit.get(z.id) || 0; if (this.t - last > 0.35) { this.orbHit.set(z.id, this.t); this.damageZ(z, 12 + 3 * n, this.me.id, Math.cos(a) * 120, Math.sin(a) * 120); } } }
        }
        if (this.orbHit.size > 400) this.orbHit.clear();
      }
      if (S.drone) {
        const D = this.drone, a = this.t * 1.4; D.x += (P.x + Math.cos(a) * 60 - D.x) * Math.min(1, dt * 5); D.y += (P.y - 90 + Math.sin(a) * 20 - D.y) * Math.min(1, dt * 5);
        D.cd -= dt; if (D.cd <= 0) { const z = this.nearestZ(D.x, D.y, 560); if (z) { D.cd = 1 / (1.6 + 0.9 * S.drone); const an = Math.atan2(z.y - z.r - D.y, z.x - D.x); const s = this.S; this.b.push({ x: D.x, y: D.y, vx: Math.cos(an) * 900, vy: Math.sin(an) * 900, r: 4, dmg: s.dmg * 0.7, crit: false, pierce: 0, bounce: 0, life: 0.7, hit: null, burn: 0, drone: true }); if (this.mode !== 'solo') this.shots.push([Math.round(D.x), Math.round(D.y), Math.round(an * 100) / 100]); } }
      }
      if (S.bomb) { T.bomb -= dt; if (T.bomb <= 0) { T.bomb = 9 - 2 * S.bomb; const z = this.nearestZ(P.x, P.y, 420); const bx = z ? z.x : P.x, by = z ? z.y : P.y; this.boom(bx, by, 150 + 20 * S.bomb, 30 + 22 * S.bomb, '#ff8c42', false); this.o.on('bomb', {}); } }
      if (S.zap) {
        T.zap -= dt;
        if (T.zap <= 0) {
          T.zap = 2.4 - 0.25 * S.zap; let from = { x: P.x, y: P.y - 30 }, seen = [];
          for (let j = 0; j < 2 + S.zap; j++) {
            let best = null, bd = 260 * 260; for (const z of this.z) { if (z.hp <= 0 || seen.includes(z.id)) continue; const d = dist2(from.x, from.y, z.x, z.y - z.r); if (d < bd) { bd = d; best = z; } }
            if (!best) break; seen.push(best.id); this.fx.push({ k: 'zap', x: from.x, y: from.y, x2: best.x, y2: best.y - best.r, t: 0, life: 0.18 }); this.damageZ(best, 16 + 7 * S.zap, this.me.id); from = { x: best.x, y: best.y - best.r };
          }
        }
      }
      if (S.shove) { T.shove -= dt; if (T.shove <= 0) { T.shove = 5.5 - S.shove; this.fx.push({ k: 'ring', x: P.x, y: P.y - 10, r: 20, R: 170 + 25 * S.shove, t: 0, life: 0.4, c: '#a6d65a' }); for (const z of this.z) { const d = Math.hypot(z.x - P.x, z.y - P.y); if (d < 170 + 25 * S.shove && d > 0) this.damageZ(z, 4 * S.shove, this.me.id, ((z.x - P.x) / d) * 520, ((z.y - P.y) / d) * 520); } } }
      if (S.raccoon && this.raccoon) {
        const Rc = this.raccoon; Rc.t += dt; Rc.cd -= dt;
        const z = this.nearestZ(Rc.x, Rc.y, 380); let tx = P.x - 50 * P.face, ty = P.y + 30;
        if (z && Math.hypot(z.x - P.x, z.y - P.y) < 420) { tx = z.x; ty = z.y; }
        const d = Math.hypot(tx - Rc.x, ty - Rc.y), sp = 300 + 40 * S.raccoon;
        if (d > 6) { Rc.x += ((tx - Rc.x) / d) * Math.min(d, sp * dt); Rc.y += ((ty - Rc.y) / d) * Math.min(d, sp * dt); Rc.face = tx > Rc.x ? 1 : -1; Rc.moving = true; } else Rc.moving = false;
        if (z && Rc.cd <= 0 && dist2(Rc.x, Rc.y, z.x, z.y) < (z.r + 22) * (z.r + 22)) { Rc.cd = 0.55 - 0.08 * S.raccoon; this.damageZ(z, 14 + 8 * S.raccoon, this.me.id, Rc.face * 100, 0); }
      }
    }
    pickupStep(dt) {
      const T = this.timers;
      if (!this.cleared) { T.pk -= dt; if (T.pk <= 0 && this.pk.length < 2) { T.pk = 16 + this.rng() * 10; let x, y, tries = 0; do { x = 120 + this.rng() * (W.AW - 240); y = 120 + this.rng() * (W.AH - 240); tries++; } while (tries < 20 && this.area.obstacles.some((o) => x > o.x - 40 && x < o.x + o.w + 40 && y > o.y - 40 && y < o.y + o.h + 40)); this.dropPickup(x, y); } }
      for (let i = this.pk.length - 1; i >= 0; i--) { const p = this.pk[i]; p.life -= dt; if (p.life <= 0) { this.pk.splice(i, 1); continue; } }
    }
    grabCheck(I) {
      const P = this.p; if (this.dead) return;
      for (let i = this.pk.length - 1; i >= 0; i--) {
        const p = this.pk[i], r = I && I.grab ? 110 : 44;
        if (dist2(p.x, p.y, P.x, P.y - 20) < r * r) {
          if (this.mode === 'guest') { if (!p.asked) { p.asked = true; this.pend.push({ t: 'grab', id: p.id }); } }
          else { this.pk.splice(i, 1); this.applyPickup(p.k); }
        }
      }
    }
    waveStep() {
      const sp = this.spec; if (!sp || this.cleared) return;
      if (this.waveKills >= sp.target && this.z.length === 0 && (!this.bossDue || this.bossSpawned)) this.clear();
    }
    clear() {
      this.cleared = true; this.banner = { text: 'AREA CLEAR!', sub: 'Walk out an exit ➜ new area, next wave', t: 3 };
      for (const g of this.gems) g.vac = true;
      this.o.report({ op: 'ev', k: 'clear', wave: this.wave }); this.o.on('clear', { wave: this.wave }); this.reportStatus(true);
    }
    gemStep(dt) {
      const P = this.p, R = this.S.magnet;
      for (let i = this.gems.length - 1; i >= 0; i--) {
        const g = this.gems[i]; g.t += dt; const d = Math.hypot(P.x - g.x, P.y - 20 - g.y);
        if (g.vac || d < R) { const sp = 300 + (R - Math.min(d, R)) * 6 + (g.vac ? 500 : 0); g.x += ((P.x - g.x) / (d || 1)) * sp * dt; g.y += ((P.y - 20 - g.y) / (d || 1)) * sp * dt; }
        if (d < 26) { this.gems.splice(i, 1); this.gainXp(g.v); this.o.on('gem', {}); }
      }
      this.grabCheck(this._lastInput);
    }
    buffStep(dt) { const B = this.buffs; for (const k in B) if (B[k] > 0) B[k] = Math.max(0, B[k] - dt); }
    othersStep(dt) { const k = Math.min(1, dt * 12); for (const o of this.others.values()) { o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.walkT = (o.walkT || 0) + (Math.abs(o.tx - o.x) + Math.abs(o.ty - o.y) > 2 ? dt : 0); } }
    fxStep(dt) {
      for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; f.t += dt; if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 500 * dt; } if (f.t >= f.life) this.fx.splice(i, 1); }
    }
    // ---------------- co-op messages ----------------
    netStep() {
      const now = performance.now();
      if (this.mode === 'host' && now - this.lastSnap > SNAP_MS) { this.lastSnap = now; this.sendSnap(); }
      if (this.mode === 'guest' && now - this.lastIn > IN_MS) { this.lastIn = now; this.sendIn(); }
      if (this.mode === 'solo') { this.shots.length = 0; this.kills.length = 0; this.booms.length = 0; this.hits.length = 0; }
    }
    youMsg() { const P = this.p; return [Math.round(P.x), Math.round(P.y), Math.round(P.aim * 100) / 100, Math.round(P.hp), Math.round(this.S.mhp), this.dead ? 1 : 0, this.choosing ? 1 : 0, Math.round(this.S.slow * 100) / 100, this.buffs.shield > 0 ? 1 : 0, P.face]; }
    sendSnap() {
      const z = []; for (const q of this.z) if (q.hp > 0) z.push(q.id, q.ti, Math.round(q.x), Math.round(q.y), Math.round(q.hp));
      const msg = { t: 'snap', w: [this.wave, this.waveKills, this.spec ? this.spec.target : 0, this.cleared ? 1 : 0, this.bossDue && !this.bossSpawned ? 1 : 0], z, p: this.pk.map((p) => [p.id, p.k, Math.round(p.x), Math.round(p.y), Math.round(p.life)]),
        s: this.spit.map((s) => [Math.round(s.x), Math.round(s.y), Math.round(s.vx), Math.round(s.vy), Math.round(s.dmg)]), you: this.youMsg(), b: this.shots.splice(0, 40), k: this.kills.splice(0), e: this.booms.splice(0, 20), fz: this.buffs.freeze > 0 ? 1 : 0 };
      this.o.live(msg);
      for (const m of this.pend.splice(0)) this.o.live(m);
    }
    sendIn() {
      this.o.live({ t: 'in', you: this.youMsg(), h: this.hits.splice(0, 80), b: this.shots.splice(0, 40) });
      for (const m of this.pend.splice(0)) this.o.live(m);
    }
    other(id, you) {
      if (!you) return null;
      let o = this.others.get(id);
      if (!o) { o = { id, x: you[0], y: you[1], tx: you[0], ty: you[1] }; this.others.set(id, o); }
      o.tx = you[0]; o.ty = you[1]; o.aim = you[2]; o.hp = you[3]; o.mhp = you[4]; o.dead = !!you[5]; o.ch = !!you[6]; o.slow = you[7] || 0; o.shield = !!you[8]; o.face = you[9] || 1; o.seen = this.t;
      if (o.dead) o.hp = 0;
      return o;
    }
    ghostShots(list) { for (const [x, y, a] of list || []) { if (this.ghost.length > 200) this.ghost.shift(); this.ghost.push({ x, y, vx: Math.cos(a) * 980, vy: Math.sin(a) * 980, life: 0.6 }); } }
    onLive(m) {
      if (!m || (m.area && m.area !== this.cell[0] + ',' + this.cell[1])) return;
      if (m.t === 'area' || m.t === 'host') { this.setArea({ k: m.area, host: m.host, members: m.members }); return; }
      if (m.t === 'snap' && this.mode === 'guest' && m.from === this.host) {
        this.snap = m; this.snapAt = this.t;
        const [w, wk, tg, cl] = m.w; if (w > this.wave) this.wave = w; this.waveKills = wk; if (!this.spec) this.spec = W.waveSpec(this.wave, 2, this.set.diff); this.spec.target = tg;
        if (cl && !this.cleared) { this.cleared = true; this.banner = { text: 'AREA CLEAR!', sub: 'Walk out an exit ➜ new area, next wave', t: 3 }; this.o.report({ op: 'ev', k: 'clear', wave: this.wave }); this.o.on('clear', { wave: this.wave }); }
        const byId = new Map(this.z.map((z) => [z.id, z])), keep = [];
        for (let i = 0; i < m.z.length; i += 5) {
          const id = m.z[i]; let z = byId.get(id);
          if (!z) { const T = Object.keys(W.ZOMBIES)[m.z[i + 1]] || 'walker'; const Z = W.ZOMBIES[T]; z = { id, type: T, ti: m.z[i + 1], x: m.z[i + 2], y: m.z[i + 3], r: Z.r, hp: m.z[i + 4], mhp: m.z[i + 4], f: 0, face: 1, flash: 0, dmg: Z.dmg * (this.spec ? this.spec.dmgMul : 1), boss: !!Z.boss }; }
          z.tx = m.z[i + 2]; z.ty = m.z[i + 3]; z.hp = m.z[i + 4]; if (z.hp > z.mhp) z.mhp = z.hp; keep.push(z);
        }
        this.z = keep;
        const pk = new Map(this.pk.map((p) => [p.id, p])); this.pk = (m.p || []).map(([id, k, x, y, life]) => { const o = pk.get(id); return { id, k, x, y, life, asked: o ? o.asked : false }; });
        this.spit = (m.s || []).map(([x, y, vx, vy, dmg]) => ({ x, y, vx, vy, dmg, life: 1 }));
        this.remoteFreeze = m.fz ? 0.3 : 0;
        for (const [by, xp] of m.k || []) { if (by === this.me.id) this.killCount++; if (this.set.xp !== 'own' || by === this.me.id) this.gainXp(xp); }
        for (const [, x, y] of m.e || []) for (let i = 0; i < 6; i++) this.particle(x, y - 20, (this.rng() - 0.5) * 260, (this.rng() - 0.7) * 260, '#7fbf4a', 0.45, 4);
        this.other(m.from, m.you); this.ghostShots(m.b);
        return;
      }
      if (m.t === 'in' && this.mode === 'host') {
        this.other(m.from, m.you); this.ghostShots(m.b);
        const byId = new Map(this.z.map((z) => [z.id, z]));
        for (const [id, dmg, kx, ky, burn] of m.h || []) { const z = byId.get(id); if (z && z.hp > 0) this.damageZ(z, Math.min(dmg, 2000), m.from, kx, ky, { burn }); }
        return;
      }
      if (m.t === 'grab' && this.mode === 'host') { const i = this.pk.findIndex((p) => p.id === m.id); if (i >= 0) { const p = this.pk.splice(i, 1)[0]; this.o.live({ t: 'give', to: m.from, k: p.k, id: p.id }); } return; }
      if (m.t === 'give' && m.to === this.me.id) { this.pk = this.pk.filter((p) => p.id !== m.id); this.applyPickup(m.k); return; }
      if (m.t === 'fx' && this.mode === 'host') { if (m.kind === 'nuke') { this.nuke(); this.flash = -0.4; } if (m.kind === 'freeze') this.buffs.freeze = Math.max(this.buffs.freeze, 6); }
    }
    reportStatus(force) {
      if (!force && this.t - this.lastSt < ST_MS / 1000) return; this.lastSt = this.t;
      const P = this.p;
      this.o.report({ op: 'st', hp: Math.max(0, Math.round(P.hp)), mhp: Math.round(this.S.mhp), lvl: this.lvl, xp: Math.round(this.xp), kills: this.killCount, wave: this.wave, ab: this.ab, ch: this.choosing ? 1 : 0 }, true);
    }
  }

  // =============================================================== drawing
  const SPR = {}; // hero frames per player id
  function heroDraw(g, who, x, y, o) {
    const k = o.k, F = A().heroFrames(who, k), fr = o.dead ? F.dead : o.hurt ? F.hurt : o.moving ? F['w' + (Math.floor((o.walkT || 0) * 14) % 8)] : F.idle;
    g.save(); g.translate(x, y); if (o.face < 0) g.scale(-1, 1);
    if (o.alpha != null) g.globalAlpha = o.alpha;
    g.drawImage(fr, -fr.ox / 1, -fr.oy / 1, fr.width / k, fr.height / k);
    g.restore();
  }
  function render(g, sim, V) {
    const TA = A(), P = sim.p, k = V.k, kp = V.k * V.dpr, AW = W.AW, AH = W.AH;
    if (!sim.bg || sim.bg.area !== sim.area) { const s = Math.min(1, Math.max(0.5, kp)); sim.bg = TA.areaCanvas(sim.area, s); sim.bg.area = sim.area; }
    // camera
    const vw = V.w / k, vh = V.h / k, intro = sim.phase === 'intro';
    let cx = P.x, cy = P.y - 30;
    if (intro) { cx = AW / 2; cy = Math.max(60, P.y - 40); }
    const M = TA.M;
    cx = vw >= AW + 2 * M ? AW / 2 : clamp(cx, vw / 2 - M, AW + M - vw / 2);
    cy = vh >= AH + 2 * M ? AH / 2 : clamp(cy, vh / 2 - M, AH + M - vh / 2);
    const sh = sim.shake > 0 ? sim.shake * 22 : 0, ox = vw / 2 - cx + (sh ? (Math.random() - 0.5) * sh : 0), oy = vh / 2 - cy + (sh ? (Math.random() - 0.5) * sh : 0);
    sim.cam = { ox, oy, k };
    g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    g.fillStyle = '#0c0a08'; g.fillRect(0, 0, V.w, V.h);
    g.setTransform(V.dpr * k, 0, 0, V.dpr * k, ox * k * V.dpr, oy * k * V.dpr);
    // the area floor + props (pre-rendered), cropped to the view
    const B = sim.bg, bs = B.scale, sx = Math.max(0, (-ox + M) * bs), sy = Math.max(0, (-oy + M) * bs), sw = Math.min(B.canvas.width - sx, vw * bs + 2), shh = Math.min(B.canvas.height - sy, vh * bs + 2);
    if (sw > 0 && shh > 0) g.drawImage(B.canvas, sx, sy, sw, shh, sx / bs - M, sy / bs - M, sw / bs, shh / bs);
    // exits: open arrows or shut barriers
    const e = sim.area.exits, t = sim.t;
    for (const [d, ok] of Object.entries(e)) {
      if (!ok) continue;
      const x = d === 'w' ? 0 : d === 'e' ? AW : AW / 2, y = d === 'n' ? 0 : d === 's' ? AH : AH / 2, horiz = d === 'n' || d === 's';
      if (sim.cleared) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 6), dir = { n: -Math.PI / 2, s: Math.PI / 2, w: Math.PI, e: 0 }[d];
        g.save(); g.translate(x, y); g.rotate(dir); g.globalAlpha = pulse;
        g.fillStyle = '#7dff6a'; g.beginPath(); g.moveTo(-60, -50); g.lineTo(-10, -50); g.lineTo(-10, -80); g.lineTo(50, 0); g.lineTo(-10, 80); g.lineTo(-10, 50); g.lineTo(-60, 50); g.closePath(); g.fill();
        g.lineWidth = 6; g.strokeStyle = '#1b4a12'; g.stroke(); g.restore();
      } else {
        g.save(); g.fillStyle = '#e8483a';
        for (let i = -2; i <= 2; i++) { const px = horiz ? x + i * 36 - 14 : x - 10, py = horiz ? y - 10 : y + i * 36 - 14; g.fillRect(px, py, horiz ? 28 : 20, horiz ? 20 : 28); }
        g.fillStyle = '#f2f2f2'; for (let i = -2; i <= 2; i++) { const px = horiz ? x + i * 36 - 4 : x - 10, py = horiz ? y - 10 : y + i * 36 - 4; g.fillRect(px, py, horiz ? 8 : 20, horiz ? 20 : 8); }
        g.restore();
      }
    }
    // gems
    if (sim.gems.length) { g.fillStyle = '#5affc8'; g.strokeStyle = '#0a3a2a'; g.lineWidth = 2; g.beginPath(); for (const q of sim.gems) { const s = 7 + Math.sin(q.t * 8) * 1.5; g.moveTo(q.x, q.y - s); g.lineTo(q.x + s * 0.7, q.y); g.lineTo(q.x, q.y + s); g.lineTo(q.x - s * 0.7, q.y); g.closePath(); } g.fill(); g.stroke(); }
    for (const p of sim.pk) TA.drawPickup(g, p.x, p.y, p.k, t, p.life < 4 ? (Math.sin(t * 16) > 0 ? 1 : 0.35) : 1);
    // everything that stands, sorted by feet (y)
    const list = sim._draw || (sim._draw = []); list.length = 0;
    for (const z of sim.z) if (z.hp > 0 || sim.mode === 'guest') list.push(z);
    list.push(P);
    for (const o of sim.others.values()) list.push(o);
    if (sim.raccoon && sim.S.raccoon) list.push(sim.raccoon);
    const G = sim.area.garage; if (G) list.push(sim._door || (sim._door = { door: true, y: G.h + 0.5 })); if (G && sim._door.y !== G.h + 0.5) sim._door.y = G.h + 0.5;
    list.sort((a, b) => a.y - b.y);
    const frozen = sim.buffs.freeze > 0 || sim.remoteFreeze > 0;
    for (const q of list) {
      if (q === P) { drawYou(g, sim, V); continue; }
      if (q === sim.raccoon) { drawRaccoon(g, q, t); continue; }
      if (q.door) { TA.drawGarage(g, sim.area, intro ? clamp((sim.introT - 1.3) / 1.5, 0, 1) : 1, t); continue; }
      if (q.tx != null && q.ti == null && q.id && sim.others.has(q.id)) { drawOther(g, sim, q, V); continue; }
      const spr = TA.zombie(q.type, Math.floor(q.f) % 4, kp, q.flash > 0);
      g.save(); g.translate(q.x, q.y); if (q.face < 0) g.scale(-1, 1);
      g.drawImage(spr, -spr.ox, -spr.oy, spr.width / kp, spr.height / kp);
      g.restore();
      if (frozen) { g.fillStyle = 'rgba(170,230,255,0.45)'; g.beginPath(); g.ellipse(q.x, q.y - q.r * 1.1, q.r * 1.05, q.r * 1.4, 0, 0, TAU); g.fill(); }
      if (q.boss || (q.hp < q.mhp && q.mhp > 40)) { const w = q.boss ? 120 : 40; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(q.x - w / 2, q.y - q.r * (q.boss ? 2.6 : 2.7) - 10, w, 7); g.fillStyle = q.boss ? '#ff4a3a' : '#ffb02e'; g.fillRect(q.x - w / 2 + 1, q.y - q.r * (q.boss ? 2.6 : 2.7) - 9, (w - 2) * Math.max(0, q.hp / q.mhp), 5); }
      if (q.burnT > 0) { g.fillStyle = 'rgba(255,140,40,0.7)'; g.beginPath(); g.arc(q.x, q.y - q.r * 2.3, 6 + Math.sin(t * 20) * 2, 0, TAU); g.fill(); }
    }
    // abilities around you
    if (!sim.dead && sim.S.orbit) for (let i = 0; i < sim.S.orbit; i++) { const a = sim.t * 3.2 + (i * TAU) / sim.S.orbit; drawHubcap(g, P.x + Math.cos(a) * 85, P.y - 20 + Math.sin(a) * 85, sim.t * 12); }
    if (!sim.dead && sim.S.drone) drawDrone(g, sim.drone.x, sim.drone.y, t);
    // bullets (one path each colour)
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(255,190,60,0.45)'; g.lineWidth = 12; g.beginPath(); for (const b of sim.b) { const s = 0.022; g.moveTo(b.x - b.vx * s, b.y - b.vy * s); g.lineTo(b.x, b.y); } g.stroke();
    g.strokeStyle = '#fff3b0'; g.lineWidth = 5; g.beginPath(); for (const b of sim.b) { const s = 0.02; g.moveTo(b.x - b.vx * s, b.y - b.vy * s); g.lineTo(b.x, b.y); } g.stroke();
    if (sim.b.some((b) => b.crit)) { g.strokeStyle = '#ff5a3c'; g.lineWidth = 7; g.beginPath(); for (const b of sim.b) if (b.crit) { g.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); g.lineTo(b.x, b.y); } g.stroke(); }
    if (sim.ghost.length) { g.strokeStyle = '#9ff0ff'; g.lineWidth = 5; g.beginPath(); for (const b of sim.ghost) { g.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); g.lineTo(b.x, b.y); } g.stroke(); }
    if (sim.spit.length) { g.fillStyle = '#b6ff3c'; g.strokeStyle = '#3a5a0a'; g.lineWidth = 3; g.beginPath(); for (const s of sim.spit) { g.moveTo(s.x + 9, s.y); g.arc(s.x, s.y, 9, 0, TAU); } g.fill(); g.stroke(); }
    // effects
    for (const f of sim.fx) {
      const u = f.t / f.life;
      if (f.k === 'p') { g.globalAlpha = 1 - u; g.fillStyle = f.c; g.fillRect(f.x - f.s / 2, f.y - f.s / 2, f.s, f.s); }
      else if (f.k === 'ring') { g.globalAlpha = 1 - u; g.strokeStyle = f.c; g.lineWidth = 10 * (1 - u) + 2; g.beginPath(); g.arc(f.x, f.y, f.r + (f.R - f.r) * u, 0, TAU); g.stroke(); }
      else if (f.k === 'zap') { g.globalAlpha = 1 - u; g.strokeStyle = '#bfefff'; g.lineWidth = 4; g.beginPath(); g.moveTo(f.x, f.y); const n = 5; for (let i = 1; i <= n; i++) { const kk = i / n; g.lineTo(f.x + (f.x2 - f.x) * kk + (i < n ? (Math.random() - 0.5) * 24 : 0), f.y + (f.y2 - f.y) * kk + (i < n ? (Math.random() - 0.5) * 24 : 0)); } g.stroke(); }
      else if (f.k === 'txt') { g.globalAlpha = 1 - u * u; g.font = 'bold 30px "Lilita One", sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#1b1410'; g.strokeText(f.text, f.x, f.y - u * 40); g.fillStyle = f.c; g.fillText(f.text, f.x, f.y - u * 40); }
    }
    g.globalAlpha = 1;
    // light: the garage intro starts in the dark; a light flood when the door opens
    g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    if (intro) {
      const T = sim.introT, dark = T < 1.3 ? 0.9 : Math.max(0, 0.9 - (T - 1.3) * 0.6);
      if (dark > 0) { g.fillStyle = `rgba(5,4,3,${dark})`; g.fillRect(0, 0, V.w, V.h); }
      if (T > 1.3 && T < 3.2) { g.fillStyle = `rgba(255,240,200,${0.35 * Math.sin(((T - 1.3) / 1.9) * Math.PI)})`; g.fillRect(0, 0, V.w, V.h); }
      if (T > 1.0 && T < 3.6) { // dust motes
        g.fillStyle = 'rgba(255,240,210,0.55)'; for (let i = 0; i < 40; i++) { const px = ((i * 97 + T * 30 * (1 + (i % 3))) % V.w), py = ((i * 53 + Math.sin(T + i) * 20) % V.h); g.fillRect(px, py, 2, 2); }
      }
    }
    if (sim.flash > 0) { g.fillStyle = `rgba(255,40,30,${sim.flash * 1.2})`; g.fillRect(0, 0, V.w, V.h); }
    else if (sim.flash < 0) { g.fillStyle = `rgba(230,255,160,${-sim.flash})`; g.fillRect(0, 0, V.w, V.h); }
    const lowHp = !sim.dead && sim.p.hp / sim.S.mhp < 0.3 && sim.phase === 'play';
    if (lowHp) { const a = 0.25 + 0.15 * Math.sin(t * 7); const gr = g.createRadialGradient(V.w / 2, V.h / 2, Math.min(V.w, V.h) * 0.35, V.w / 2, V.h / 2, Math.max(V.w, V.h) * 0.75); gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, `rgba(200,0,0,${a})`); g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h); }
    if (sim.buffs.freeze > 0) { g.fillStyle = 'rgba(160,220,255,0.10)'; g.fillRect(0, 0, V.w, V.h); }
  }
  function drawYou(g, sim, V) {
    const P = sim.p, B = sim.buffs, t = sim.t;
    if (sim.dead) { heroDraw(g, sim.me, P.x, P.y, { k: V.k * V.dpr, dead: true, face: P.face }); return; }
    const blink = P.inv > 0 && Math.sin(t * 40) > 0;
    // aim line (subtle) and the ground ring in your colour
    g.strokeStyle = sim.me.color || '#ffd23f'; g.lineWidth = 3; g.globalAlpha = 0.8; g.beginPath(); g.ellipse(P.x, P.y, 24, 9, 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
    const aimUp = Math.sin(P.aim) < -0.3;
    if (aimUp) gun(g, sim, P);
    heroDraw(g, sim.me, P.x, P.y, { k: V.k * V.dpr, moving: P.moving || sim.phase === 'intro' && sim.introT > 2.9, walkT: P.walkT, face: P.face, hurt: P.inv > 0.4, alpha: blink ? 0.5 : 1 });
    if (!aimUp && (sim.phase !== 'intro' || sim.introT > 2.9)) gun(g, sim, P);
    if (P.armor > 0) { const ay = P.y - 92; g.fillStyle = '#b7c2cc'; g.strokeStyle = '#1b1410'; g.lineWidth = 3; g.beginPath(); g.ellipse(P.x, ay, 20, 7, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#7a8590'; g.fillRect(P.x - 6, ay - 7, 12, 5); g.strokeRect(P.x - 6, ay - 7, 12, 5); }
    if (B.shield > 0) { g.strokeStyle = `rgba(110,227,255,${0.5 + 0.3 * Math.sin(t * 10)})`; g.lineWidth = 5; g.beginPath(); g.arc(P.x, P.y - 34, 46, 0, TAU); g.stroke(); g.fillStyle = 'rgba(110,227,255,0.13)'; g.fill(); }
    if (B.kicks > 0 && P.moving) for (let i = 0; i < 2; i++) sim.particle(P.x - P.vx * 0.04 + (Math.random() - 0.5) * 10, P.y - 4, -P.vx * 0.2, -20, '#7dff6a', 0.25, 4);
  }
  function gun(g, sim, P) { A().drawGun(g, P.x + P.face * 13, P.y - 30, P.aim, P.kick, sim.buffs.minigun > 0); if (P.kick > 0.6 && sim.phase === 'play') { g.fillStyle = '#ffe066'; g.beginPath(); g.arc(P.x + Math.cos(P.aim) * 50, P.y - 28 + Math.sin(P.aim) * 50, 8 + Math.random() * 5, 0, TAU); g.fill(); } }
  function drawOther(g, sim, o, V) {
    const who = (sim.o.people && sim.o.people(o.id)) || { id: o.id, name: '?', color: '#fff' };
    g.strokeStyle = who.color || '#fff'; g.lineWidth = 3; g.beginPath(); g.ellipse(o.x, o.y, 24, 9, 0, 0, TAU); g.stroke();
    heroDraw(g, who, o.x, o.y, { k: V.k * V.dpr, moving: Math.abs(o.tx - o.x) + Math.abs(o.ty - o.y) > 2, walkT: o.walkT, face: o.face || 1, dead: o.dead });
    if (!o.dead) A().drawGun(g, o.x + (o.face || 1) * 6, o.y - 28, o.aim || 0, 0, false);
    if (o.shield) { g.strokeStyle = 'rgba(110,227,255,0.6)'; g.lineWidth = 4; g.beginPath(); g.arc(o.x, o.y - 34, 44, 0, TAU); g.stroke(); }
    g.font = 'bold 20px "Lilita One", sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#1b1410'; g.strokeText(who.name || '', o.x, o.y - 92); g.fillStyle = who.color || '#fff'; g.fillText(who.name || '', o.x, o.y - 92);
    if (o.mhp) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(o.x - 24, o.y - 86, 48, 6); g.fillStyle = '#7dff6a'; g.fillRect(o.x - 23, o.y - 85, 46 * Math.max(0, o.hp / o.mhp), 4); }
    if (o.ch) { g.font = '24px sans-serif'; g.fillText('🃏', o.x + 30, o.y - 70); }
  }
  function drawHubcap(g, x, y, a) { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#c9ced6'; g.strokeStyle = '#1b1410'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#7a8590'; for (let i = 0; i < 5; i++) { g.rotate(TAU / 5); g.fillRect(3, -2, 11, 4); } g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill(); g.restore(); }
  function drawDrone(g, x, y, t) { g.save(); g.translate(x, y); g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(0, 90, 16, 5, 0, 0, TAU); g.fill(); g.fillStyle = '#ffd23f'; g.strokeStyle = '#1b1410'; g.lineWidth = 3; g.beginPath(); g.ellipse(0, 0, 16, 9, 0, 0, TAU); g.fill(); g.stroke(); g.strokeStyle = '#555'; g.lineWidth = 2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 14, -6); g.lineTo(s * 22, -12); g.stroke(); g.fillStyle = 'rgba(200,200,200,0.6)'; g.beginPath(); g.ellipse(s * 22, -13, 12 * Math.abs(Math.sin(t * 40)), 3, 0, 0, TAU); g.fill(); } g.fillStyle = '#ff4a3a'; g.beginPath(); g.arc(4, 1, 3, 0, TAU); g.fill(); g.restore(); }
  function drawRaccoon(g, R, t) {
    const b = R.moving ? Math.abs(Math.sin(t * 16)) * 4 : 0;
    g.save(); g.translate(R.x, R.y); if (R.face < 0) g.scale(-1, 1);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, 0, 20, 6, 0, 0, TAU); g.fill();
    g.translate(0, -b); g.strokeStyle = '#1b1410'; g.lineWidth = 3;
    g.fillStyle = '#7a7f86'; g.beginPath(); g.ellipse(-16, -14, 14, 6, -0.6, 0, TAU); g.fill(); g.stroke(); // tail
    g.fillStyle = '#3a3d42'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(-12 - i * 6, -10 - i * 4, 2.5, 5, -0.6, 0, TAU); g.fill(); }
    g.fillStyle = '#8a8f96'; g.beginPath(); g.ellipse(0, -14, 15, 11, 0, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.arc(13, -24, 10, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#2b2d31'; g.fillRect(6, -28, 15, 6); g.fillStyle = '#fff'; g.beginPath(); g.arc(16, -25, 2.2, 0, TAU); g.fill();
    g.fillStyle = '#1b1410'; g.beginPath(); g.arc(23, -22, 2.5, 0, TAU); g.fill();
    g.fillStyle = '#8a8f96'; g.beginPath(); g.moveTo(8, -31); g.lineTo(10, -38); g.lineTo(14, -32); g.fill(); g.stroke();
    g.restore();
  }
  window.TZSim = { Sim, render, heroDraw, SPR };
})();
