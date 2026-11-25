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
  const BREAK_S = 30; // seconds between waves (then the next wave starts by itself)
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
      this.buffs = { shield: 0, minigun: 0, kicks: 0, freeze: 0, xp2: 0, scope: 0 };
      this.story = o.story || null; this.locks = o.locks || null; this.eq = { ...(R.eq || {}) }; this.hearts = R.hearts || 0; this.looted = new Set(); this.asked = {};
      this.stats(); P.hp = R.hp > 0 ? Math.min(R.hp, this.S.mhp) : this.S.mhp; P.lives = (this.ab.life || 0) - (R.livesUsed || 0) + this.hearts;
      this.timers = { bomb: 4, zap: 2, shove: 3, drone: 0, pk: 12, regen: 0 };
      this.orbHit = new Map(); this.raccoon = null; this.drones = []; this.decals = []; this.corpses = []; this.muzzle = 0; this.slowmo = 0; this.sq = [];
      const home = !R.wave || (R.wave === 1 && R.cell && R.home && R.cell[0] === R.home[0] && R.cell[1] === R.home[1]);
      if (this.initPlay) this.initPlay(); // score, cash, shops (trash-play.js)
      this.enterArea(this.cell[0], this.cell[1], null, home);
      if (!home) { this.phase = 'play'; this.startWave(); }
    }
    // ---------------- stats from abilities ----------------
    // ---------------- Regular mode ----------------
    cellKey(c = this.cell) { return c[0] + ',' + c[1]; }
    isDoorCell() { const st = this.story; return !!(st && st.plan && st.plan.door && st.plan.door[0] === this.cell[0] && st.plan.door[1] === this.cell[1]); }
    tierAt(x, y) { const st = this.story; return st && st.tiers ? st.tiers[y * W.GRID + x] || 0 : 0; }
    gateLeft(dir) { // zombies still needed to open the gate that way (0 = open)
      const st = this.story; if (!st) return 0;
      const d = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[dir], x = this.cell[0] + d[0], y = this.cell[1] + d[1];
      if (!W.inGrid(x, y)) return 0; const t = this.tierAt(x, y); if (t <= st.tier) return 0;
      return Math.max(1, (st.needs[t - 1] || 0) - st.kills);
    }
    exitOpen(dir) { return this.cleared && this.area.exits[dir] && !this.gateLeft(dir); }
    findHere() { const st = this.story; if (!st || !st.plan) return null; const k = this.cellKey(), id = st.plan.finds[k]; return id && !(st.taken || []).includes(k) && !this.looted.has(k) ? id : null; }
    setStory(st, me) {
      const was = this.story; this.story = st || null;
      if (me) {
        const eq = me.eq || {}; if (Object.keys(eq).some((k) => !this.eq[k])) { this.eq = { ...this.eq, ...eq }; this.stats(); }
        if ((me.hearts || 0) > this.hearts) { this.p.lives += me.hearts - this.hearts; this.hearts = me.hearts; }
      }
      if (st && st.doorOpen && this.isDoorCell() && this.mode !== 'guest' && !this.finalSpawned && !this.finalDead && this.phase === 'play') this.spawnFinal();
      void was;
    }
    applyFind(id) {
      const F = window.TZS && TZS.FINDS[id]; if (!F) return;
      if (F.kind === 'equip' || F.kind === 'ability') { this.eq[id] = 1; this.stats(); }
      if (F.kind === 'token') { this.p.lives++; this.hearts++; }
      this.fx.push({ k: 'txt', x: this.p.x, y: this.p.y - 90, text: F.name + '!', t: 0, life: 1.6, c: '#ffd23f' });
      this.fx.push({ k: 'ring', x: this.p.x, y: this.p.y - 20, r: 10, R: 160, t: 0, life: 0.5, c: '#ffd23f' });
      this.o.on('find', { id });
    }
    storyStep() {
      const st = this.story, P = this.p; if (!st || this.dead) return;
      // (finds sit in chests you open by hand: trash-gates.js openChest)
      if (this.isDoorCell() && !st.doorOpen && this.cleared && st.keys >= 3 && !this.asked.door) {
        const D = this.area.spot; if (D && P.x > D.x - 30 && P.x < D.x + D.w + 30 && P.y < D.y + D.h + 70) {
          this.asked.door = 1; this.o.report({ op: 'door' }).then((r) => { if (r && r.ok) { st.doorOpen = true; if (this.mode !== 'guest') this.spawnFinal(); } else this.asked.door = 0; });
        }
      }
    }
    spawnFinal() {
      if (this.finalSpawned || !this.story) return;
      const key = this.story.plan.boss, B = TZS.BOSSES[key];
      this.finalSpawned = true; this.cleared = false;
      const D = this.area.spot || { x: W.AW / 2 - 150, y: 0, w: 300, h: 170 }, z = this.makeZ('final', D.x + D.w / 2, D.y + D.h + 60);
      z.fb = key; z.r = B.r; z.speed = B.speed; z.dmg = B.dmg * (1 + 0.04 * (this.wave - 1)); z.xp = 60; z.cd = 2; z.cd2 = 4;
      z.hp = z.mhp = B.hp * (1 + 0.6 * (this.areaMembers.length - 1)) * (1 + 0.05 * (this.lvl - 1)) * (this.set.diff === 'hard' ? 1.3 : this.set.diff === 'chill' ? 0.75 : 1);
      this.banner = { text: B.icon + ' ' + B.name.toUpperCase(), sub: B.desc, t: 3 }; this.shake = 0.6;
      this.o.on('final', { key });
    }
    // Every ability stacks without a cap. Damage, health, bullets, orbiters and drones keep growing
    // (past a count, extra bullets / hubcaps / drones merge into stronger ones so the phone stays
    // smooth); fire rate, dodge, armour, speed, slow and cooldowns use soft caps (W.soft) that get
    // closer and closer to a sane limit but never pass it.
    stats() {
      const a = (id) => this.ab[id] || 0, lv = this.lvl, soft = W.soft, E = this.eq || {};
      const spread = (1 + a('spread')) * (E.twin ? 2 : 1), shots = Math.min(9, spread);
      this.S = {
        rate: 5.5 * (1 + soft(a('rapid'), 2.4, 0.86)), dmg: 10 * (1 + 0.25 * a('big') + 0.04 * Math.max(0, a('rapid') - 8)) * (1 + 0.03 * (lv - 1)) * (spread / shots),
        br: 5 + Math.min(10, 1.6 * a('big')) + (spread > shots ? 2 : 0), bspeed: 980, pierce: Math.min(8, a('pierce') + (E.blower ? 1 : 0)), pierceDmg: 1 + 0.15 * Math.max(0, a('pierce') - 8),
        bounce: Math.min(6, a('bounce')), crit: Math.min(0.8, soft(a('crit'), 0.7, 0.88) + (E.goggles ? 0.15 : 0)), critMul: 3 + 0.2 * Math.max(0, a('crit') - 6), burn: a('burn'),
        spread: shots, rear: a('rear'), rearDmg: 1 + 0.25 * Math.max(0, a('rear') - 2), mhp: 100 + 25 * a('hp') + (this.gear ? this.gear.mhp : 0), regen: a('regen'), armor: (0.3 + 0.7 * Math.pow(0.9, a('plating'))) * Math.pow(0.92, this.gear ? this.gear.vest : 0), dodge: soft(a('dodge'), 0.6, 0.9),
        thorns: 15 * a('thorns'), shove: a('shove'), orbit: Math.min(10, a('orbit')), orbitN: a('orbit'), drone: a('drone'), bomb: a('bomb'), zap: a('zap'), magnet: 95 * (1 + soft(a('magnet'), 2.5, 0.8)),
        slow: Math.max(soft(a('slow'), 0.6, 0.85), E.boombox ? 0.25 : 0), raccoon: a('raccoon'), speed: 255 * (1 + soft(a('kicks'), 0.8, 0.85)) * (E.skates ? 1.3 : 1),
        view: 1 + W.soft(a('eagle') + (this.gear ? this.gear.torch : 0), 0.55, 0.8), knock: E.blower ? 3 : 1, aimRange: E.goggles ? 860 : 640, leech: E.leech ? 2 : 0, fire: !!E.fire, storm: !!E.storm, lid: !!E.lid,
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
      const P = this.p, G = this.area.garage;
      if (from) { const a = W.arrival(this.area, from); P.x = a.x; P.y = a.y; }
      else if (G) { P.x = G.x + G.w / 2; P.y = G.y + 120; } else { P.x = this.area.hub.x; P.y = this.area.hub.y; }
      if (this.raccoon) { this.raccoon.x = P.x; this.raccoon.y = P.y + 30; }
      this.finalSpawned = false; this.finalDead = false;
      if (this.isDoorCell() && this.area.spot) { const D = this.area.spot; this.area.obstacles.push({ x: D.x, y: D.y, w: D.w, h: D.h, kind: 'none' }); }
      this.decals = []; this.corpses = []; this.mx = this.mx || null;
    }
    // where the landmark of this area stands (the find crate, the boss door, the shop)
    spotXY() { const D = this.area.spot || { x: W.AW / 2 - 150, y: 0, w: 300, h: 170 }; return { x: D.x + D.w / 2, y: D.y + D.h / 2 + 10 }; }
    // Walking out of an exit: the next cell is the next wave.
    leave(dir) {
      const d = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[dir], nx = this.cell[0] + d[0], ny = this.cell[1] + d[1];
      if (!W.inGrid(nx, ny)) return;
      this.wave++; this.enterArea(nx, ny, dir); this.mode = 'solo'; this.areaMembers = [this.me.id]; this.host = this.me.id;
      this.o.report({ op: 'enter', x: nx, y: ny }).then((r) => { if (r && r.ok && r.area) this.setArea(r.area); });
      this.startWave(); this.reportStatus(true);
      this.o.on('enter', { biome: this.area.biome, wave: this.wave });
    }
    // The break between waves: about 30 s to shop or walk on; then the next wave comes to you, wherever
    // you are (every mode; Garage Defense's build phase has its own server clock). The host's clock rules a
    // co-op area (guests see it in the snapshot), so nobody can hold it open.
    breakStep(dt) {
      if (!this.cleared) { this.breakT = null; return; }
      if (this.build || this.hordeS || this.dead || this.down || this.phase !== 'play' || (this.finalSpawned && !this.finalDead) || this.mode === 'guest') return;
      if (this.breakT == null) this.breakT = BREAK_S;
      if (this.menuPause && this.mode === 'solo') return;
      const before = Math.ceil(this.breakT); this.breakT -= dt;
      if (Math.ceil(this.breakT) !== before && this.breakT > 0 && this.breakT <= 5) this.o.on('tick', { n: Math.ceil(this.breakT) });
      if (this.breakT <= 0) this.nextWave();
    }
    nextWave() {
      this.breakT = null; this.wave++; this.cleared = false; this.waveKills = 0; this.spawned = 0; this.bossSpawned = false;
      this.startWave(); this.banner = { text: 'WAVE ' + this.wave, sub: 'Break’s over: here they come!', t: 2.6 };
      this.o.report({ op: 'ev', k: 'wave', wave: this.wave }); this.reportStatus(true); this.o.on('wave', { wave: this.wave });
    }
    startWave() {
      this.breakT = null;
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
      const AW = W.AW, AH = W.AH, side = Math.floor(this.rng() * 4), P = this.p;
      // half of them shamble in down the streets, the rest over the fences
      const road = this.rng() < 0.5 && this.area.exits[['n', 's', 'w', 'e'][side]], t = road ? (road.p + (this.rng() - 0.5) * road.w * 0.8) / (side < 2 ? AW : AH) : 0.08 + this.rng() * 0.84;
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
      else { this.kills.push([by, z.xp, z.ti, z.elite ? 1 : 0]); if (this.set.xp !== 'own' || mine) this.gainXp(z.xp); }
      this.gore(z);
      if (this.onKill) this.onKill(z, by, mine);
      if (W.ZOMBIES[z.type].pops) this.boom(z.x, z.y, 95, 22 * (this.spec ? this.spec.dmgMul : 1), '#b6ff3c', true);
      if (mine && this.S.leech) this.p.hp = Math.min(this.S.mhp, this.p.hp + this.S.leech);
      if (z.fb) { this.finalDead = true; this.shake = 1; for (let i = 0; i < 60; i++) this.particle(z.x, z.y - z.r, (this.rng() - 0.5) * 700, (this.rng() - 0.8) * 600, ['#ffd23f', '#9cff3c', '#ff5a3c'][i % 3], 1.2, 8); this.o.report({ op: 'ev', k: 'victory' }); this.o.on('victory', this.summary()); }
      else if (z.boss) { this.dropPickup(z.x, z.y); this.shake = Math.max(this.shake, 0.5); this.o.on('bossdown', {}); if (this.dropMap) this.dropMap(z.x + 40, z.y); }
      else if (this.rng() < 0.025) this.dropPickup(z.x, z.y);
      this.booms.push([1, Math.round(z.x), Math.round(z.y)]);
    }
    // a zombie goes down: blood drops, a splat that fades, the body topples over
    gore(z) {
      const goo = W.ZOMBIES[z.type] && (W.ZOMBIES[z.type].pops || z.type === 'spitter');
      for (let i = 0; i < (z.boss ? 26 : 7); i++) this.particle(z.x, z.y - z.r, (this.rng() - 0.5) * 300, (this.rng() - 0.75) * 300, goo ? '#9ad83a' : i % 2 ? '#6a0e0a' : '#8a1a12', 0.5 + this.rng() * 0.3, 3 + this.rng() * 4);
      this.decal(goo ? 'goo' : 'blood', z.x + (this.rng() - 0.5) * 16, z.y - 4, (z.boss ? 2.2 : 0.8) + this.rng() * 0.5);
      // the body plays its death animation, lingers and fades (the iso view); capped at 40
      if (this.corpses.length >= 40) this.corpses.shift();
      this.corpses.push({ type: z.type, v: z.id % 5, x: z.x, y: z.y, face: z.face || 1, t: 0, life: z.boss ? 6 : 4.8, dir: z._dir || 'S', boss: z.fb || z.mb || (z.boss ? z.type : null) });
      if (this.fx.length < MAX_FX - 10) this.fx.push({ k: 'spurt', x: z.x, y: z.y - 30, t: 0, life: 0.4, goo, big: true, wa: Math.atan2(z.y - this.p.y, z.x - this.p.x) });
      this.snd(z.boss ? 'bossdie' : goo ? 'splat' : 'kill', z.x, z.y);
    }
    decal(k, x, y, s = 1) { if (this.decals.length > 70) this.decals.shift(); this.decals.push({ k, x, y, s, rot: this.rng() * TAU, i: Math.floor(this.rng() * 4), t: 0, life: k === 'scorch' ? 30 : 16, a: 0.9 }); }
    droneN() { return Math.min(4, this.S.drone || 0); }
    fxHit(z, dmg, crit) {
      this.particle(z.x, z.y - z.r * 1.4, (this.rng() - 0.5) * 160, -80 - this.rng() * 120, crit ? '#ffe066' : '#8fd65a', 0.3, crit ? 6 : 3);
      if (this.fx.length < MAX_FX - 40 && this.rng() < 0.6) this.fx.push({ k: 'spurt', x: z.x, y: z.y - 30, t: 0, life: 0.3, goo: !!(W.ZOMBIES[z.type] && (W.ZOMBIES[z.type].pops || z.type === 'spitter')), wa: Math.atan2(z.y - this.p.y, z.x - this.p.x) });
      this.snd('hit', z.x, z.y);
    }
    // a sound for the phone to play (trash-sound.js drains it; a test sandbox just ignores it)
    snd(name, x, y) { if (this.sq.length < 40) this.sq.push([name, x, y]); }
    // An explosion: hurts zombies (and you, if it's a bloater popping next to you).
    boom(x, y, rad, dmg, color, hurtsYou) {
      this.snd(rad > 120 ? 'boom' : 'boomsmall', x, y);
      this.fx.push({ k: 'ring', x, y, r: 10, R: rad, t: 0, life: 0.35, c: color }); this.shake = Math.max(this.shake, 0.2);
      if (this.fx.length < MAX_FX - 10) { this.fx.push({ k: 'fire', x, y: y - 10, r: rad * 0.55, t: 0, life: 0.35 }); for (let i = 0; i < 5; i++) this.fx.push({ k: 's', x: x + (this.rng() - 0.5) * rad * 0.6, y: y - 10 + (this.rng() - 0.5) * rad * 0.4, r: 18 + this.rng() * rad * 0.25, t: 0, life: 1 + this.rng() * 0.8, a: 0.45, c: color === '#b6ff3c' ? '#4a5a2a' : '#34312e' }); }
      this.decal(color === '#b6ff3c' ? 'goo' : 'scorch', x, y, rad / 70);
      if (hurtsYou && dist2(x, y, this.p.x, this.p.y) < rad * rad) this.hurt(dmg, x, y);
      if (this.mode === 'guest' && hurtsYou) return;
      for (const z of this.z) if (z.hp > 0 && dist2(x, y, z.x, z.y) < (rad + z.r) * (rad + z.r)) { const d = Math.hypot(z.x - x, z.y - y) || 1; this.damageZ(z, hurtsYou ? dmg * 1.5 : dmg, this.me.id, ((z.x - x) / d) * 260, ((z.y - y) / d) * 260); }
    }
    particle(x, y, vx, vy, c, life, s) { if (this.fx.length >= MAX_FX) this.fx.shift(); this.fx.push({ k: 'p', x, y, vx, vy, c, t: 0, life, s }); }
    // ---------------- you ----------------
    hurt(dmg, fx, fy) {
      const P = this.p, B = this.buffs;
      if (this.dead || P.inv > 0 || B.shield > 0 || this.phase !== 'play' || (this.choosing && this.mode !== 'solo')) return;
      if (this.S.lid && (this.lidAt || 0) <= this.t) { this.lidAt = this.t + 8; P.inv = 0.6; this.fx.push({ k: 'txt', x: P.x, y: P.y - 80, text: 'BLOCKED!', t: 0, life: 0.7, c: '#b7c2cc' }); return; }
      if (P.armor > 0) { P.armor = 0; P.inv = 0.6; this.o.on('armor', {}); this.fx.push({ k: 'ring', x: P.x, y: P.y - 20, r: 10, R: 70, t: 0, life: 0.3, c: '#b7c2cc' }); return; }
      if (this.rng() < this.S.dodge) { this.fx.push({ k: 'txt', x: P.x, y: P.y - 70, text: 'DODGE!', t: 0, life: 0.7, c: '#ffe066' }); P.inv = 0.3; return; }
      if (this.shopping && this.mode !== 'solo') return;
      if (this.plates > 0) { this.plates--; P.inv = 0.6; this.fx.push({ k: 'txt', x: P.x, y: P.y - 80, text: 'PLATE!', t: 0, life: 0.7, c: '#c9ccd1' }); if (this.onHurt) this.onHurt(0); return; }
      if (this.onHurt) this.onHurt(dmg);
      const d = dmg * this.S.armor; P.hp -= d; P.inv = 0.75; this.flash = 0.25; this.shake = Math.max(this.shake, 0.18);
      if (fx != null) { const L = Math.hypot(P.x - fx, P.y - fy) || 1; P.vx += ((P.x - fx) / L) * 260; P.vy += ((P.y - fy) / L) * 260; }
      this.o.on('hurt', { hp: P.hp, mhp: this.S.mhp });
      if (P.hp <= 0) {
        if (P.lives > 0) { P.lives--; P.hp = this.S.mhp * 0.6; P.inv = 2.2; this.boom(P.x, P.y, 220, 80, '#ffd23f', false); this.o.on('down', {}); if (this.hearts > 0) { this.hearts--; this.o.report({ op: 'ev', k: 'heart' }); } else this.o.report({ op: 'ev', k: 'down' }); return; }
        P.hp = 0; if (this.goDown && this.goDown()) return; this.die();
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
      dt = Math.min(dt, 0.05);
      if (this.slowmo > 0) { this.slowmo -= dt; dt *= 0.35; } // dramatic slow motion (solo)
      if (this.mapInput) I = this.mapInput(I || {});
      this.t += dt; this._lastInput = I;
      this.flash = this.flash > 0 ? Math.max(0, this.flash - dt) : Math.min(0, this.flash + dt);
      this.shake = Math.max(0, this.shake - dt);
      if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
      if (this.phase === 'intro') { this.updateIntro(dt, I); this.fxStep(dt); return; }
      if (this.phase === 'dead') { this.fxStep(dt); this.netStep(); return; }
      if (this.down) { this.downStep(dt); this.fxStep(dt); this.netStep(); if (this.mode !== 'guest') { this.spawnStep(dt); this.zombieStep(dt); } else this.guestStep(dt); this.othersStep(dt); return; }
      const slow = this.paused || (this.evo && this.mode === 'solo') ? 0 : 1, sdt = dt * slow;
      this.breakStep(dt); // the short break between waves runs even while you shop (only the solo pause menu stops it)
      if (this.evo && slow === 0) this.evoStep(dt);
      if (sdt > 0) {
        this.moveYou(sdt, I);
        this.shoot(sdt, I);
        this.abilities(sdt);
        if (this.mode !== 'guest') { this.spawnStep(sdt); this.zombieStep(sdt); this.pickupStep(sdt); this.waveStep(); } else this.guestStep(sdt);
        this.bulletStep(sdt);
        this.contact(sdt);
        this.gemStep(sdt);
        this.storyStep();
        if (this.playStep) this.playStep(sdt, I);
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
      const G = this.area.garage, gy = G ? G.y : 0;
      if (T > 2.9) { P.moving = true; P.walkT += dt; P.y = Math.min(gy + 380, gy + 120 + (T - 2.9) * 170); P.face = 1; P.aim = 0.5; }
      if (T > 1.3 && T < 2.9) this.shake = Math.max(this.shake, 0.12);
      if (T > 4.5) { this.phase = 'play'; P.moving = false; this.startWave(); this.o.on('start', {}); this.reportStatus(true); }
    }
    moveYou(dt, I) {
      const P = this.p, S = this.S, B = this.buffs;
      let mx = I.mx || 0, my = I.my || 0; const m = Math.hypot(mx, my); if (m > 1) { mx /= m; my /= m; }
      if ((this.choosing || this.shopping) && this.mode !== 'solo') { mx = 0; my = 0; }
      const sp = S.speed * (B.kicks > 0 ? 1.5 : 1) * (this.speedMul || 1);
      P.vx = P.vx * Math.pow(0.0005, dt) + mx * sp * (1 - Math.pow(0.0005, dt)) * 1.0;
      P.vy = P.vy * Math.pow(0.0005, dt) + my * sp * (1 - Math.pow(0.0005, dt)) * 1.0;
      P.x += P.vx * dt; P.y += P.vy * dt;
      P.moving = Math.hypot(P.vx, P.vy) > 30; if (P.moving) P.walkT += dt;
      this.collide(P);
      // the edges: closed unless this area is cleared and there is an exit lane here
      const AW = W.AW, AH = W.AH, E = this.area.exits, O = (d) => this.exitOpen(d), on = (d, v) => E[d] && Math.abs(v - E[d].p) < E[d].w / 2 - 10;
      const inN = on('n', P.x), inS = on('s', P.x), inW = on('w', P.y), inE = on('e', P.y);
      if (O('n') && inN && P.y < -10) return this.leave('n');
      if (O('s') && inS && P.y > AH + 10) return this.leave('s');
      if (O('w') && inW && P.x < -10) return this.leave('w');
      if (O('e') && inE && P.x > AW + 10) return this.leave('e');
      P.x = clamp(P.x, O('w') && inW ? -30 : P.r, O('e') && inE ? AW + 30 : AW - P.r);
      P.y = clamp(P.y, O('n') && inN ? -30 : P.r, O('s') && inS ? AH + 30 : AH - P.r);
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
      if ((this.choosing || this.shopping) && this.mode !== 'solo') return;
      if (I.ax || I.ay) { P.aim = Math.atan2(I.ay, I.ax); fire = I.mouse ? !!I.fire : true; }
      else if (this.set.aim !== 'off' && !I.mouse) { const z = this.nearestZ(P.x, P.y - 24, S.aimRange); if (z) { P.aim = Math.atan2(z.y - z.r - (P.y - 24), z.x - P.x); fire = true; } }
      if (Math.cos(P.aim) > 0.15) P.face = 1; else if (Math.cos(P.aim) < -0.15) P.face = -1;
      P.fireCd -= dt; if (!fire || P.fireCd > 0) return;
      const mini = B.minigun > 0, rate = S.rate * (mini ? 3.5 : 1) * (this.rateMul || 1);
      P.fireCd += 1 / rate; if (P.fireCd < -0.05) P.fireCd = 0;
      P.kick = 1;
      const ox = P.x + Math.cos(P.aim) * 34, oy = P.y - 26 + Math.sin(P.aim) * 34;
      const dirs = [];
      const n = S.spread, step = 0.13;
      for (let i = 0; i < n; i++) dirs.push(P.aim + (i - (n - 1) / 2) * step + (mini ? (this.rng() - 0.5) * 0.12 : 0));
      const front = dirs.length;
      if (S.rear >= 1) dirs.push(P.aim + Math.PI); if (S.rear >= 2) { dirs.push(P.aim + Math.PI / 2, P.aim - Math.PI / 2); }
      dirs.forEach((a, i) => this.fireBullet(ox, oy, a, i >= front ? S.rearDmg : 1));
      this.muzzle = 0.05; this.shotN = (this.shotN || 0) + 1;
      if (this.casings !== false && this.fx.length < MAX_FX - 20) { const ca = P.aim + Math.PI / 2 * P.face; this.fx.push({ k: 'c', x: P.x + P.face * 10, y: P.y - 30, vx: Math.cos(ca) * 90 + (this.rng() - 0.5) * 40, vy: -120 - this.rng() * 60, gy: P.y + 4 + (this.rng() - 0.5) * 16, t: 0, life: 1.4, rot: this.rng() * 3, vr: 18 }); }
      this.o.on('shot', { mini });
    }
    fireBullet(x, y, a, mul = 1) {
      const S = this.S; if (this.b.length >= MAX_B) this.b.shift();
      const crit = this.rng() < S.crit;
      this.b.push({ x, y, vx: Math.cos(a) * S.bspeed, vy: Math.sin(a) * S.bspeed, r: S.br * (crit ? 1.3 : 1), dmg: S.dmg * mul * S.pierceDmg * (crit ? S.critMul : 1), crit, pierce: S.pierce, bounce: S.bounce, life: 0.8, hit: null, burn: S.burn });
      if (this.mode !== 'solo') this.shots.push([Math.round(x), Math.round(y), Math.round(a * 100) / 100]);
    }
    bulletStep(dt) {
      const obs = this.area.obstacles;
      for (let i = this.b.length - 1; i >= 0; i--) {
        const b = this.b[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
        if (b.ret && !b.back && b.life < 0.7) { b.back = true; b.vx = -b.vx; b.vy = -b.vy; b.hit = null; } // the boomerang hubcap comes back
        let dead = b.life <= 0 || b.x < -60 || b.y < -60 || b.x > W.AW + 60 || b.y > W.AH + 60;
        if (!dead) for (const o of obs) if (!o.low && b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) {
          if (b.bounce > 0) { b.bounce--; const px = b.x - b.vx * dt, py = b.y - b.vy * dt; if (px <= o.x || px >= o.x + o.w) b.vx = -b.vx; else b.vy = -b.vy; b.x = px; b.y = py; b.life = Math.max(b.life, 0.4); }
          else { dead = true; this.particle(b.x, b.y, (this.rng() - 0.5) * 120, (this.rng() - 0.5) * 120, '#ffe9a8', 0.18, 3); }
          break;
        }
        if (!dead) for (const z of this.z) {
          if (z.hp <= 0 || (b.hit && b.hit.includes(z.id))) continue;
          const zr = z.r + b.r, zy = z.y - z.r;
          if (dist2(b.x, b.y, z.x, zy) < zr * zr) {
            const sp = Math.hypot(b.vx, b.vy) || 1;
            this.damageZ(z, b.dmg, this.me.id, (b.vx / sp) * 140 * this.S.knock * (b.kb || 1), (b.vy / sp) * 140 * this.S.knock * (b.kb || 1), { crit: b.crit, burn: b.burn });
            if (b.zap || b.boom) this.bulletHit(b, z);
            if (b.pierce > 0) { b.pierce--; (b.hit || (b.hit = [])).push(z.id); } else { dead = true; }
            break;
          }
        }
        if (dead) { if (b.boom && b.pierce && this.bulletEnd) this.bulletEnd(b); else if (b.boom && b.life <= 0 && this.bulletEnd) this.bulletEnd(b); this.b.splice(i, 1); }
      }
      for (let i = this.ghost.length - 1; i >= 0; i--) { const b = this.ghost[i]; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; let dead = b.life <= 0; if (!dead) for (const o of obs) if (!o.low && b.x > o.x && b.x < o.x + o.w && b.y > o.y && b.y < o.y + o.h) { dead = true; break; } if (dead) this.ghost.splice(i, 1); }
    }
    spawnStep(dt) {
      const sp = this.spec; if (!sp || this.cleared) return;
      if (this.banner && this.banner.t > 1.2) return;
      const live = this.z.length;
      if (this.bossDue && !this.bossSpawned && this.waveKills >= sp.target * 0.3) { this.bossSpawned = true; const z = this.spawnOne('boss'); this.o.report({ op: 'ev', k: 'boss', id: z.mb || 'boss' }); this.o.on('boss', {}); this.banner = { text: '⚠️ DUMPSTER BRUTE', sub: 'It smells you.', t: 2.2 }; z.y = z.y < 0 ? -70 : z.y; }
      if (this.waveKills + live >= sp.target + (this.bossDue ? 1 : 0)) return;
      this.spawnCd -= dt; if (this.spawnCd > 0 || live >= Math.min(MAX_Z, sp.cap)) return;
      this.spawnCd = sp.every * (0.6 + this.rng() * 0.8);
      const burst = this.wave >= 3 && this.rng() < 0.18 ? 3 : 1;
      for (let i = 0; i < burst; i++) this.spawnOne();
    }
    targets() {
      const L = [this.dead || this.down || ((this.choosing || this.shopping) && this.mode !== 'solo') ? null : this.p];
      for (const o of this.others.values()) if (o.hp > 0 && !o.ch && !o.down) L.push(o);
      return L.filter(Boolean);
    }
    zombieStep(dt) {
      const T = this.targets(), frozen = this.buffs.freeze > 0 || this.remoteFreeze > 0, Z = this.z, n = Z.length;
      if (this.remoteFreeze > 0) this.remoteFreeze -= dt;
      for (let i = 0; i < n; i++) {
        const z = Z[i]; if (z.hp <= 0) continue;
        if (z.flash > 0) z.flash -= dt;
        if (z.burnT > 0) { z.burnT -= dt; z.hp -= z.burn * dt; if (this.rng() < dt * 8) this.particle(z.x, z.y - z.r * 2, (this.rng() - 0.5) * 30, -60, '#ff8c42', 0.4, 4); if (z.hp <= 0) { this.killZ(z, this.me.id); continue; } }
        if (frozen) { z.kx = 0; z.ky = 0; continue; } // frozen solid: not even a shove moves them
        z.x += z.kx * dt; z.y += z.ky * dt; z.kx *= Math.pow(0.02, dt); z.ky *= Math.pow(0.02, dt);
        let tg = null, bd = Infinity; for (const p of T) { const d = dist2(z.x, z.y, p.x, p.y); if (d < bd) { bd = d; tg = p; } }
        if (this.pickTarget) { const t2 = this.pickTarget(z, tg, bd, dt); if (t2 !== tg) { tg = t2; bd = tg ? dist2(z.x, z.y, tg.x, tg.y) : Infinity; } } // trash-more.js
        let slow = 1; for (const p of T) if (p.slow && dist2(z.x, z.y, p.x, p.y) < 230 * 230) slow = Math.min(slow, 1 - p.slow);
        if (this.S.slow && !this.dead && dist2(z.x, z.y, this.p.x, this.p.y) < 230 * 230) slow = Math.min(slow, 1 - this.S.slow);
        let sp = z.speed * slow * (this.zSpeedMul || 1);
        if (!tg) { z.f += dt * 2; continue; }
        if (tg.slowK) sp *= tg.slowK;
        let dx = tg.x - z.x, dy = tg.y - z.y; const d = Math.sqrt(bd) || 1; dx /= d; dy /= d;
        if (W.ZOMBIES[z.type].spits) { // keep a distance and lob goo
          if (d < 280) { dx = -dx; dy = -dy; sp *= 0.6; } else if (d < 380) sp = 0;
          z.cd -= dt; if (z.cd <= 0 && d < 520) { z.cd = 2.6; const a = Math.atan2(tg.y - 20 - (z.y - z.r * 2), tg.x - z.x); this.spit.push({ x: z.x, y: z.y - z.r * 2, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, life: 2, dmg: z.dmg }); }
        }
        if (z.fb || z.mb) { const m = window.TZB ? TZB.stepBoss(this, z, dt, tg) : 1; z.x = clamp(z.x, 60, W.AW - 60); z.y = clamp(z.y, 80, W.AH - 40); if (m === -1) { z.face = (z.cx || 1) >= 0 ? 1 : -1; if (!z.noCollide) this.collide(z); continue; } sp *= m; }
        else if (z.boss) { z.cd -= dt; if (z.charge > 0) { z.charge -= dt; sp *= 3.2; } else if (z.cd <= 0 && d < 520) { z.cd = 4.5; z.charge = 0.7; this.shake = Math.max(this.shake, 0.2); } }
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
        if (!dead && !this.dead && dist2(s.x, s.y, this.p.x, this.p.y - 20) < 30 * 30) { this.hurt(s.dmg, s.x, s.y); if (s.debuff && this.applyDebuff) this.applyDebuff(s.debuff); dead = true; s.hitYou = true; }
        if (!dead) for (const o of this.area.obstacles) if (!o.low && s.x > o.x && s.x < o.x + o.w && s.y > o.y && s.y < o.y + o.h) { dead = true; break; }
        if (dead) { this.particle(s.x, s.y, 0, 0, s.col || '#b6ff3c', 0.3, 8); this.spitLands(s); this.spit.splice(i, 1); }
      }
    }
    // A guest: zombies glide to the host's positions; spit is checked against you.
    guestStep(dt) {
      const k = Math.min(1, dt * 14);
      for (const z of this.z) { const ox = z.x; z.x += (z.tx - z.x) * k; z.y += (z.ty - z.y) * k; if (Math.abs(z.x - ox) > 0.3) z.face = z.x > ox ? 1 : -1; z.f += dt * 4; if (z.flash > 0) z.flash -= dt; }
      for (let i = this.spit.length - 1; i >= 0; i--) { const s = this.spit[i]; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (!this.dead && dist2(s.x, s.y, this.p.x, this.p.y - 20) < 30 * 30) { this.hurt(s.dmg, s.x, s.y); if (s.debuff && this.applyDebuff) this.applyDebuff(s.debuff); s.life = 0; s.hitYou = true; } if (s.life <= 0) { this.spitLands(s); this.spit.splice(i, 1); } }
      for (const p of this.pk) p.life -= dt;
    }
    contact(dt) {
      const P = this.p; if (this.dead) return;
      for (const z of this.z) {
        if (z.hp <= 0 || !z.dmg) continue;
        const rr = z.r + P.r - 4;
        if (dist2(z.x, z.y, P.x, P.y) < rr * rr) {
          this.hurt(z.dmg, z.x, z.y);
          const ZD = W.ZOMBIES[z.type]; if (ZD && ZD.debuff && !ZD.ranged && this.applyDebuff) this.applyDebuff(ZD.debuff);
          if (this.S.thorns && (z.thornCd || 0) <= this.t) { z.thornCd = this.t + 0.5; this.damageZ(z, this.S.thorns, this.me.id); }
        }
      }
    }
    abilities(dt) {
      const S = this.S, P = this.p, T = this.timers;
      if (this.dead) return;
      if (S.fire) { T.fire = (T.fire || 0) - dt; if (T.fire <= 0) { T.fire = 0.5; for (const z of this.z) if (z.hp > 0 && dist2(z.x, z.y, P.x, P.y) < 160 * 160) this.damageZ(z, 10 + 0.5 * this.lvl, this.me.id, 0, 0, { burn: 1 }); this.fx.push({ k: 'ring', x: P.x, y: P.y - 6, r: 150, R: 165, t: 0, life: 0.45, c: '#ff8c42' }); } }
      if (S.storm) { T.storm = (T.storm || 1.5) - dt; if (T.storm <= 0) { T.storm = 1.5; const z = this.nearestZ(P.x, P.y, 700); if (z) { this.fx.push({ k: 'zap', x: z.x + 30, y: z.y - 400, x2: z.x, y2: z.y - z.r, t: 0, life: 0.25 }); this.damageZ(z, 40 + 4 * this.lvl, this.me.id, 0, 0, { shock: 1 }); } } }
      if (S.regen) { T.regen += dt; if (T.regen >= 1) { T.regen -= 1; P.hp = Math.min(S.mhp, P.hp + S.regen); } }
      if (S.orbit) {
        const n = S.orbit, R = 85, od = (12 + 3 * S.orbitN) * (S.orbitN > 10 ? 1 + 0.1 * (S.orbitN - 10) : 1);
        for (let i = 0; i < n; i++) {
          const a = this.t * 3.2 + (i * TAU) / n, ox = P.x + Math.cos(a) * R, oy = P.y - 20 + Math.sin(a) * R;
          for (const z of this.z) { if (z.hp <= 0) continue; const rr = z.r + 18; if (dist2(ox, oy, z.x, z.y - z.r) < rr * rr) { const last = this.orbHit.get(z.id) || 0; if (this.t - last > 0.35) { this.orbHit.set(z.id, this.t); this.damageZ(z, od, this.me.id, Math.cos(a) * 120, Math.sin(a) * 120); } } }
        }
        if (this.orbHit.size > 400) this.orbHit.clear();
      }
      if (S.drone) {
        // up to 4 drones; past that, every extra pick makes them hit harder (merged power)
        const n = this.droneN(), per = S.drone / n;
        for (let i = 0; i < n; i++) {
          const D = this.drones[i] || (this.drones[i] = { x: P.x, y: P.y - 90, cd: i * 0.2 }), a = this.t * 1.4 + (i * TAU) / n;
          D.x += (P.x + Math.cos(a) * 64 - D.x) * Math.min(1, dt * 5); D.y += (P.y - 90 + Math.sin(a) * 24 - D.y) * Math.min(1, dt * 5);
          D.cd -= dt; if (D.cd <= 0) { const z = this.nearestZ(D.x, D.y, 560); if (z) { D.cd = 1 / (1.6 + W.soft(per, 5, 0.85)); const an = Math.atan2(z.y - z.r - D.y, z.x - D.x); const s = this.S; this.b.push({ x: D.x, y: D.y, vx: Math.cos(an) * 900, vy: Math.sin(an) * 900, r: 4, dmg: s.dmg * 0.7 * (1 + 0.12 * Math.max(0, per - 3)), crit: false, pierce: 0, bounce: 0, life: 0.7, hit: null, burn: 0, drone: true }); if (this.mode !== 'solo') this.shots.push([Math.round(D.x), Math.round(D.y), Math.round(an * 100) / 100]); } }
        }
      }
      if (S.bomb) { T.bomb -= dt; if (T.bomb <= 0) { T.bomb = 2.5 + 6.5 * Math.pow(0.8, S.bomb); const z = this.nearestZ(P.x, P.y, 420); const bx = z ? z.x : P.x, by = z ? z.y : P.y; this.boom(bx, by, 150 + Math.min(220, 20 * S.bomb), 30 + 22 * S.bomb, '#ff8c42', false); this.o.on('bomb', {}); } }
      if (S.zap) {
        T.zap -= dt;
        if (T.zap <= 0) {
          T.zap = 0.6 + 1.8 * Math.pow(0.85, S.zap); let from = { x: P.x, y: P.y - 30 }, seen = [];
          for (let j = 0; j < Math.min(12, 2 + S.zap); j++) {
            let best = null, bd = 260 * 260; for (const z of this.z) { if (z.hp <= 0 || seen.includes(z.id)) continue; const d = dist2(from.x, from.y, z.x, z.y - z.r); if (d < bd) { bd = d; best = z; } }
            if (!best) break; seen.push(best.id); this.fx.push({ k: 'zap', x: from.x, y: from.y, x2: best.x, y2: best.y - best.r, t: 0, life: 0.18 }); this.damageZ(best, 16 + 7 * S.zap, this.me.id, 0, 0, { shock: 1 }); from = { x: best.x, y: best.y - best.r };
          }
        }
      }
      if (S.shove) { T.shove -= dt; if (T.shove <= 0) { const SR = 170 + Math.min(220, 25 * S.shove); T.shove = 1.2 + 4.3 * Math.pow(0.82, S.shove); this.fx.push({ k: 'ring', x: P.x, y: P.y - 10, r: 20, R: SR, t: 0, life: 0.4, c: '#a6d65a' }); for (const z of this.z) { const d = Math.hypot(z.x - P.x, z.y - P.y); if (d < SR && d > 0) this.damageZ(z, 4 * S.shove, this.me.id, ((z.x - P.x) / d) * 520, ((z.y - P.y) / d) * 520); } } }
      if (S.raccoon && this.raccoon) {
        const Rc = this.raccoon; Rc.t += dt; Rc.cd -= dt;
        const z = this.nearestZ(Rc.x, Rc.y, 380); let tx = P.x - 50 * P.face, ty = P.y + 30;
        if (z && Math.hypot(z.x - P.x, z.y - P.y) < 420) { tx = z.x; ty = z.y; }
        const d = Math.hypot(tx - Rc.x, ty - Rc.y), sp = 300 + Math.min(300, 40 * S.raccoon);
        if (d > 6) { Rc.x += ((tx - Rc.x) / d) * Math.min(d, sp * dt); Rc.y += ((ty - Rc.y) / d) * Math.min(d, sp * dt); Rc.face = tx > Rc.x ? 1 : -1; Rc.moving = true; } else Rc.moving = false;
        if (z && Rc.cd <= 0 && dist2(Rc.x, Rc.y, z.x, z.y) < (z.r + 22) * (z.r + 22)) { Rc.cd = 0.15 + 0.4 * Math.pow(0.85, S.raccoon); this.damageZ(z, 14 + 8 * S.raccoon, this.me.id, Rc.face * 100, 0); }
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
      if (this.finalSpawned && !this.finalDead) return;
      if (this.waveKills >= sp.target && this.z.length === 0 && (!this.bossDue || this.bossSpawned)) this.clear();
    }
    clear() {
      this.cleared = true; this.breakT = BREAK_S; this.banner = { text: 'AREA CLEAR!', sub: `Shop or walk on: the next wave comes in ${BREAK_S} s`, t: 3 };
      for (const g of this.gems) g.vac = true;
      if (this.onClear) this.onClear();
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
    // how far out the camera sits (Eagle Eye + binoculars), eased
    // a web or sludge blob that misses leaves a sticky patch where it lands
    spitLands(s) { if (s.hitYou || !this.webs) return; if (s.debuff === 'web' && this.webs.length < 10) this.webs.push({ x: s.x, y: s.y + 20, r: 46, t: 0, life: 10 }); else if (s.debuff === 'sludge' && this.puddles.length < 14) this.puddles.push({ x: s.x, y: s.y + 20, r: 55, t: 0, life: 7 }); }
    zoomStep(dt) { const want = (this.S.view || 1) * (this.buffs.scope > 0 ? 1.6 : 1) / (this.debuffs && this.debuffs.zoom > 0 ? 1.8 : 1); this._zoom = (this._zoom || want) + (want - (this._zoom || want)) * Math.min(1, dt * 2.5); return this._zoom; }
    buffStep(dt) { const B = this.buffs; for (const k in B) if (B[k] > 0) B[k] = Math.max(0, B[k] - dt); }
    othersStep(dt) { const k = Math.min(1, dt * 12); for (const o of this.others.values()) { o.x += (o.tx - o.x) * k; o.y += (o.ty - o.y) * k; o.walkT = (o.walkT || 0) + (Math.abs(o.tx - o.x) + Math.abs(o.ty - o.y) > 2 ? dt : 0); } }
    fxStep(dt) {
      for (let i = this.fx.length - 1; i >= 0; i--) {
        const f = this.fx[i]; f.t += dt;
        if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 500 * dt; }
        else if (f.k === 'c') { if (f.vr) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 700 * dt; f.rot += f.vr * dt; if (f.y > f.gy && f.vy > 0) { f.y = f.gy; f.vy *= -0.35; f.vx *= 0.5; f.vr *= 0.5; if (Math.abs(f.vy) < 30) f.vr = 0; } } }
        if (f.t >= f.life) this.fx.splice(i, 1);
      }
      if (this.muzzle > 0) this.muzzle -= dt;
      for (let i = this.decals.length - 1; i >= 0; i--) { const d = this.decals[i]; d.t += dt; if (d.t >= d.life) this.decals.splice(i, 1); }
      for (let i = this.corpses.length - 1; i >= 0; i--) { const c = this.corpses[i]; c.t += dt; if (c.t >= c.life) this.corpses.splice(i, 1); }
    }
    // ---------------- co-op messages ----------------
    netStep() {
      const now = performance.now();
      if (this.mode === 'host' && now - this.lastSnap > SNAP_MS) { this.lastSnap = now; this.sendSnap(); }
      if (this.mode === 'guest' && now - this.lastIn > IN_MS) { this.lastIn = now; this.sendIn(); }
      if (this.mode === 'solo') { this.shots.length = 0; this.kills.length = 0; this.booms.length = 0; this.hits.length = 0; }
    }
    youMsg() { const P = this.p; return [Math.round(P.x), Math.round(P.y), Math.round(P.aim * 100) / 100, Math.round(P.hp), Math.round(this.S.mhp), this.dead ? 1 : 0, this.choosing ? 1 : 0, Math.round(this.S.slow * 100) / 100, this.buffs.shield > 0 ? 1 : 0, P.face, this.down ? 1 : 0, (this.shopping || this.choosing) ? 1 : 0, ...(this.youExtra ? this.youExtra() : [])]; }
    sendSnap() {
      const z = []; for (const q of this.z) if (q.hp > 0) z.push(q.id, q.ti, Math.round(q.x), Math.round(q.y), Math.round(q.hp));
      const msg = { t: 'snap', w: [this.wave, this.waveKills, this.spec ? this.spec.target : 0, this.cleared ? 1 : 0, this.bossDue && !this.bossSpawned ? 1 : 0, this.breakT != null ? Math.round(this.breakT * 10) / 10 : -1], z, p: this.pk.map((p) => [p.id, p.k, Math.round(p.x), Math.round(p.y), Math.round(p.life)]),
        s: this.spit.map((s) => [Math.round(s.x), Math.round(s.y), Math.round(s.vx), Math.round(s.vy), Math.round(s.dmg), s.debuff ? ['blind','zoom','web','jam','confuse','leech','sludge','shake'].indexOf(s.debuff) : -1]), you: this.youMsg(), b: this.shots.splice(0, 40), k: this.kills.splice(0), e: this.booms.splice(0, 20), fz: this.buffs.freeze > 0 ? 1 : 0, ...(this.snapExtra ? this.snapExtra() : {}) };
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
      o.tx = you[0]; o.ty = you[1]; o.aim = you[2]; o.hp = you[3]; o.mhp = you[4]; o.dead = !!you[5]; o.ch = !!you[6]; o.slow = you[7] || 0; o.shield = !!you[8]; o.face = you[9] || 1; o.down = !!you[10]; o.busy = !!you[11]; o.seen = this.t; if (!o.down) o.rev = 0; if (this.otherExtra) this.otherExtra(o, you);
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
        else if (!cl && this.cleared) { this.cleared = false; this.breakT = null; this.banner = { text: 'WAVE ' + this.wave, sub: 'Break’s over: here they come!', t: 2.6 }; this.o.on('wave', { wave: this.wave }); }
        if (cl && m.w[5] != null && m.w[5] >= 0) this.breakT = m.w[5];
        const byId = new Map(this.z.map((z) => [z.id, z])), keep = [];
        for (let i = 0; i < m.z.length; i += 5) {
          const id = m.z[i]; let z = byId.get(id);
          if (!z) { const T = Object.keys(W.ZOMBIES)[m.z[i + 1]] || 'walker'; const Z = W.ZOMBIES[T]; z = { id, type: T, ti: m.z[i + 1], x: m.z[i + 2], y: m.z[i + 3], r: Z.r, hp: m.z[i + 4], mhp: m.z[i + 4], f: 0, face: 1, flash: 0, dmg: Z.dmg * (this.spec ? this.spec.dmgMul : 1), boss: !!Z.boss }; if (Z.mini) z.mb = T; if (T === 'final' && this.story && window.TZS) { const B = TZS.BOSSES[this.story.plan.boss]; z.fb = this.story.plan.boss; z.r = B.r; z.dmg = B.dmg; } }
          z.tx = m.z[i + 2]; z.ty = m.z[i + 3]; z.hp = m.z[i + 4]; if (z.hp > z.mhp) z.mhp = z.hp; keep.push(z);
        }
        const kept = new Set(keep.map((z) => z.id)); for (const z of this.z) if (!kept.has(z.id)) this.gore(z); // they fall over here too
        this.z = keep;
        const pk = new Map(this.pk.map((p) => [p.id, p])); this.pk = (m.p || []).map(([id, k, x, y, life]) => { const o = pk.get(id); return { id, k, x, y, life, asked: o ? o.asked : false }; });
        this.spit = (m.s || []).map(([x, y, vx, vy, dmg, db]) => ({ x, y, vx, vy, dmg, life: 1, debuff: ['blind','zoom','web','jam','confuse','leech','sludge','shake'][db] || null }));
        this.remoteFreeze = m.fz ? 0.3 : 0; if (this.snapIn) this.snapIn(m);
        for (const [by, xp, ti, el] of m.k || []) { if (by === this.me.id) { this.killCount++; if (this.onKill) this.onKill({ type: Object.keys(W.ZOMBIES)[ti] || 'walker', elite: !!el, x: this.p.x, y: this.p.y - 80, remote: true }, by, true); } if (this.set.xp !== 'own' || by === this.me.id) this.gainXp(xp); }
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
      if (m.t === 'revived' && this.down) { this.getUp(); return; }
      if (m.t === 'fx' && this.mode === 'host') { if (m.kind === 'nuke') { this.nuke(); this.flash = -0.4; } if (m.kind === 'freeze') this.buffs.freeze = Math.max(this.buffs.freeze, 6); if (m.kind === 'horde' && this.sendHorde) this.sendHorde(m.n, m.from, true); }
      if (this.liveExtra) this.liveExtra(m);
    }
    reportStatus(force) {
      if (!force && this.t - this.lastSt < ST_MS / 1000) return; this.lastSt = this.t;
      const P = this.p;
      this.o.report({ op: 'st', brk: this.cleared && this.breakT != null ? Math.ceil(this.breakT) : -1, hp: Math.max(0, Math.round(P.hp)), mhp: Math.round(this.S.mhp), lvl: this.lvl, xp: Math.round(this.xp), kills: this.killCount, wave: this.wave, ab: this.ab, ch: this.choosing ? 1 : 0, score: Math.round(this.score || 0), mult: this.mult || 1, wp: this._fi ? [[this.gun.id, this.gun.lv, this.gun.tier], ...this.weapons.map((w) => [w.id, w.lv, w.tier])] : undefined, ...(this.statusExtra ? this.statusExtra() : {}) }, true);
    }
  }

  // =============================================================== drawing
  const SPR = {}; // hero frames per player id
  // The camera leads where you're going (and where you aim by hand), eased over ~0.4 s.
  // state = { lx, ly } (world units, carried between frames). Pure, so it is tested.
  const LEAD = 0.12, LEAD_AIM = 0.07; // (subtle: the view is wide)
  function lead(state, P, vw, vh, dt, manual) {
    const sp = Math.hypot(P.vx || 0, P.vy || 0); let lx = 0, ly = 0;
    if (sp > 40) { const k = Math.min(1, sp / 250); lx = (P.vx / sp) * k * vw * LEAD; ly = (P.vy / sp) * k * vh * LEAD; }
    if (manual) { lx += Math.cos(P.aim) * vw * LEAD_AIM; ly += Math.sin(P.aim) * vh * LEAD_AIM; }
    const ease = 1 - Math.exp(-Math.max(0, dt) / 0.13);
    state.lx = (state.lx || 0) + (lx - (state.lx || 0)) * ease; state.ly = (state.ly || 0) + (ly - (state.ly || 0)) * ease; return state;
  }
  // The camera centre, kept inside the area (plus its margin).
  function camCenter(cx, cy, vw, vh, M) {
    const AW = W.AW, AH = W.AH;
    return { x: vw >= AW + 2 * M ? AW / 2 : clamp(cx, vw / 2 - M, AW + M - vw / 2), y: vh >= AH + 2 * M ? AH / 2 : clamp(cy, vh / 2 - M, AH + M - vh / 2) };
  }
  // The time of day and weather of a run (from the seed: every screen agrees).
  function weather(seed) { const h = W.hash(seed, 'tod'); return { tod: ['dusk', 'overcast', 'night', 'night', 'dusk'][h % 5], rain: (h >> 4) % 3 === 0, fog: (h >> 7) % 2 === 0 }; }
  const TODS = { night: { dark: 0.76, tint: 'rgba(30,50,110,0.16)', col: '4,6,16' }, dusk: { dark: 0.3, tint: 'rgba(255,120,50,0.13)', col: '40,14,30' }, overcast: { dark: 0.16, tint: 'rgba(90,105,125,0.1)', col: '20,24,32' } };
  function heroDraw(g, who, x, y, o) {
    const k = o.k, F = A().heroFrames(who, k), fr = o.dead ? F.dead : o.hurt ? F.hurt : o.moving ? F['w' + (Math.floor((o.walkT || 0) * 14) % 8)] : F.idle;
    g.save(); g.translate(x, y); if (o.face < 0) g.scale(-1, 1);
    if (o.alpha != null) g.globalAlpha = o.alpha;
    g.drawImage(fr, -fr.ox / 1, -fr.oy / 1, fr.width / k, fr.height / k);
    g.restore();
  }
  // cached splats (blood / goo / scorch) and the vignette
  const SPL = {};
  function splat(kind, i) {
    const key = kind + i; if (SPL[key]) return SPL[key];
    const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'), r = W.rng(W.hash(kind, i));
    const col = kind === 'goo' ? [120, 190, 50] : kind === 'scorch' ? [12, 10, 8] : [96, 10, 8];
    if (kind === 'scorch') { const gr = g.createRadialGradient(48, 48, 2, 48, 48, 46); gr.addColorStop(0, 'rgba(10,8,6,0.8)'); gr.addColorStop(0.6, 'rgba(20,14,10,0.45)'); gr.addColorStop(1, 'rgba(20,14,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, 96, 96); }
    else for (let k = 0; k < 14; k++) { const a = r() * TAU, d = k < 4 ? r() * 8 : 10 + r() * 30, s = k < 4 ? 10 + r() * 10 : 2 + r() * 5; g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.55 + r() * 0.35})`; g.beginPath(); g.ellipse(48 + Math.cos(a) * d, 48 + Math.sin(a) * d * 0.7, s, s * (0.6 + r() * 0.4), a, 0, TAU); g.fill(); }
    SPL[key] = c; return c;
  }
  let VIG = null;
  function vignette(w, h) {
    if (VIG && VIG.w === w && VIG.h === h) return VIG.c;
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w / 2)); c.height = Math.max(1, Math.round(h / 2)); const g = c.getContext('2d');
    const gr = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.hypot(c.width, c.height) * 0.6); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    VIG = { w, h, c }; return c;
  }
  let LC = null;
  function render(g, sim, V) {
    if (window.TZI && window.TZI.ready && window.TZI.render(g, sim, V)) return; // JustZombies: the isometric view (trash-iso.js); this flat one shows while the art loads
    const TA = A(), P = sim.p, k = V.k, hi = V.hi !== false, kp = Math.max(0.2, Math.round(V.k * V.dpr * 10) / 10), AW = W.AW, AH = W.AH;
    if (!sim.bg || sim.bg.area !== sim.area || sim.bg.hi !== hi) { const s = hi ? Math.min(1, Math.max(0.5, kp)) : Math.min(0.6, Math.max(0.4, kp * 0.6)); sim.bg = TA.areaCanvas(sim.area, s); sim.bg.area = sim.area; sim.bg.hi = hi; }
    const WX = sim._wx || (sim._wx = weather(sim.seed));
    // camera
    const vw = V.w / k, vh = V.h / k, intro = sim.phase === 'intro';
    const now = sim.t, cdt = Math.min(0.1, Math.max(0, now - (sim._camT == null ? now : sim._camT))); sim._camT = now;
    const manual = !!(sim._lastInput && (sim._lastInput.ax || sim._lastInput.ay) && !intro && (sim._lastInput.mouse || sim._lastInput.fire));
    const L = lead(sim._lead || (sim._lead = { lx: 0, ly: 0 }), P, vw, vh, cdt, manual);
    let cx = P.x, cy = P.y - 30; void L; // the camera stays on the hero (the owner found the look-ahead weird)
    const G = sim.area.garage;
    if (intro && G) { cx = G.x + G.w / 2; cy = Math.max(G.y + 60, P.y - 40); L.lx = 0; L.ly = 0; }
    const M = TA.M, C0 = camCenter(cx, cy, vw, vh, M); cx = C0.x; cy = C0.y;
    const sh = sim.shake > 0 ? sim.shake * 22 : 0, ox = vw / 2 - cx + (sh ? (Math.random() - 0.5) * sh : 0), oy = vh / 2 - cy + (sh ? (Math.random() - 0.5) * sh : 0);
    sim.cam = { ox, oy, k, vw, vh, toScreen: (x, y) => [(x + ox) * k, (y + oy) * k], toWorld: (x, y) => [x / k - ox, y / k - oy], dirToWorld: (dx, dy) => [dx, dy] };
    g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    g.fillStyle = '#0c0a08'; g.fillRect(0, 0, V.w, V.h);
    g.setTransform(V.dpr * k, 0, 0, V.dpr * k, ox * k * V.dpr, oy * k * V.dpr);
    const vis = (x, y, m = 120) => x > -ox - m && x < -ox + vw + m && y > -oy - m && y < -oy + vh + m;
    // the area floor + props (pre-rendered), cropped to the view
    const B = sim.bg, bs = B.scale, sx = Math.max(0, (-ox + M) * bs), sy = Math.max(0, (-oy + M) * bs), sw = Math.min(B.canvas.width - sx, vw * bs + 2), shh = Math.min(B.canvas.height - sy, vh * bs + 2);
    if (sw > 0 && shh > 0) g.drawImage(B.canvas, sx, sy, sw, shh, sx / bs - M, sy / bs - M, sw / bs, shh / bs);
    const t = sim.t;
    // fresh grime: blood, goo, scorch marks (they fade)
    for (const d of sim.decals) { if (!vis(d.x, d.y)) continue; const a = Math.min(1, (d.life - d.t) / 3) * (d.a || 0.9); if (a <= 0) continue; g.globalAlpha = a; const sp = splat(d.k, d.i % 4); g.save(); g.translate(d.x, d.y); g.rotate(d.rot); g.drawImage(sp, -48 * d.s, -48 * d.s * 0.7, 96 * d.s, 96 * d.s * 0.7); g.restore(); }
    g.globalAlpha = 1;
    // the fallen: they topple over, then fade into the ground
    for (const c of sim.corpses) {
      if (!vis(c.x, c.y) || c.boss) continue; const u = Math.min(1, c.t / 0.32), fade = Math.min(1, (c.life - c.t) / 0.8);
      const spr = TA.zombie(c.type, 1, kp, false, c.v); g.save(); g.globalAlpha = Math.max(0, fade); g.translate(c.x, c.y); if (c.face < 0) g.scale(-1, 1); g.rotate(-u * u * 1.45); g.drawImage(spr, -spr.ox, -spr.oy, spr.width / kp, spr.height / kp); g.restore();
    }
    g.globalAlpha = 1;
    // exits: open arrows on the road, shut barricades, or a locked gate with its kill count (trash-gates.js)
    const e = sim.area.exits;
    for (const [d, road] of Object.entries(e)) {
      if (!road) continue;
      const x = d === 'w' ? 0 : d === 'e' ? AW : road.p, y = d === 'n' ? 0 : d === 's' ? AH : road.p, horiz = d === 'n' || d === 's';
      const gi = sim.gateInfo ? sim.gateInfo(d) : null;
      if (gi && window.TZG) { TZG.drawGate(g, d, gi, t, road); continue; }
      if (sim.cleared) {
        const pulse = 0.55 + 0.35 * Math.sin(t * 6), dir = { n: -Math.PI / 2, s: Math.PI / 2, w: Math.PI, e: 0 }[d];
        g.save(); g.translate(x, y); g.rotate(dir); g.globalAlpha = pulse;
        g.fillStyle = '#9cff5a'; g.beginPath(); g.moveTo(-90, -30); g.lineTo(-40, -30); g.lineTo(-40, -56); g.lineTo(10, 0); g.lineTo(-40, 56); g.lineTo(-40, 30); g.lineTo(-90, 30); g.closePath(); g.fill();
        g.lineWidth = 3; g.strokeStyle = 'rgba(20,50,10,0.8)'; g.stroke(); g.restore();
      } else {
        // sawhorse barricades across the road
        g.save(); g.translate(x, y); if (!horiz) g.rotate(Math.PI / 2);
        const n = Math.max(2, Math.round(road.w / 70));
        for (let i = 0; i < n; i++) { const bx = -road.w / 2 + (i + 0.5) * (road.w / n) - 26; g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(bx + 6, 6, 52, 10); g.fillStyle = '#d9d2c2'; g.fillRect(bx, -8, 52, 12); g.fillStyle = '#b8332a'; for (let j = 0; j < 4; j++) g.fillRect(bx + 2 + j * 13, -8, 6, 12); g.fillStyle = '#ffb02e'; g.beginPath(); g.arc(bx + 4, -10, 3.5, 0, TAU); g.fill(); }
        g.restore();
      }
    }
    // brass casings on the ground, gems, pickups
    for (const f of sim.fx) if (f.k === 'c') { g.globalAlpha = Math.min(1, (f.life - f.t) * 2); g.fillStyle = f.t < f.life * 0.3 ? '#e8c46a' : '#b08a3a'; g.save(); g.translate(f.x, f.y); g.rotate(f.rot || 0); g.fillRect(-3, -1.5, 6, 3); g.restore(); }
    g.globalAlpha = 1;
    if (sim.gems.length) { g.fillStyle = '#5affc8'; g.strokeStyle = 'rgba(0,40,30,0.8)'; g.lineWidth = 1.5; g.beginPath(); for (const q of sim.gems) { const s = 7 + Math.sin(q.t * 8) * 1.5; g.moveTo(q.x, q.y - s); g.lineTo(q.x + s * 0.7, q.y); g.lineTo(q.x, q.y + s); g.lineTo(q.x - s * 0.7, q.y); g.closePath(); } g.fill(); g.stroke(); }
    for (const p of sim.pk) TA.drawPickup(g, p.x, p.y, p.k, t, p.life < 4 ? (Math.sin(t * 16) > 0 ? 1 : 0.35) : 1);
    if (sim.drawExtraGround) sim.drawExtraGround(g, t, vis);
    // everything that stands, sorted by feet (y)
    const list = sim._draw || (sim._draw = []); list.length = 0;
    for (const z of sim.z) if ((z.hp > 0 || sim.mode === 'guest') && vis(z.x, z.y, 200)) list.push(z);
    list.push(P);
    for (const o of sim.others.values()) list.push(o);
    if (sim.raccoon && sim.S.raccoon) list.push(sim.raccoon);
    if (sim.story && window.TZB && sim.isDoorCell() && sim.area.spot) list.push(sim._bd || (sim._bd = { bossDoor: true, y: sim.area.spot.y + sim.area.spot.h })); // (the chests: trash-gates.js)
    if (sim.extraStanding) sim.extraStanding(list);
    if (G) list.push(sim._door || (sim._door = { door: true, y: G.y + G.h + 0.5 })); if (G && sim._door.y !== G.y + G.h + 0.5) sim._door.y = G.y + G.h + 0.5;
    list.sort((a, b) => a.y - b.y);
    const frozen = sim.buffs.freeze > 0 || sim.remoteFreeze > 0;
    for (const q of list) {
      if (q === P) { drawYou(g, sim, V); continue; }
      if (q === sim.raccoon) { drawRaccoon(g, q, t); continue; }
      if (q.door) { TA.drawGarage(g, sim.area, intro ? clamp((sim.introT - 1.3) / 1.5, 0, 1) : 1, t); continue; }
      if (q.draw) { q.draw(g, t); continue; }
      if (q.tx != null && q.ti == null && q.id && sim.others.has(q.id)) { drawOther(g, sim, q, V); continue; }
      if (q.fb || q.mb) { if (window.TZB) TZB.drawBoss(g, q, t); continue; }
      if (q.type === 'stalker') q.alpha = 0.25 + 0.75 * Math.max(0, Math.sin(t * 2.2 + q.id)) ** 4;
      if (q.crate) { TZB.drawCrate(g, q.x, q.y, q.id, t, false); continue; }
      if (q.bossDoor) { TZB.drawDoor(g, sim.story.plan.doorLook, !!sim.story.doorOpen, t, sim.story.keys >= 3, sim.area.spot); continue; }
      const spr = TA.zombie(q.type, Math.floor(q.f) % 4, kp, q.flash > 0, q.id % 5);
      g.save(); g.translate(q.x, q.y); if (q.face < 0) g.scale(-1, 1); g.rotate(Math.sin(q.f * 1.7 + q.id) * 0.05);
      if (q.alpha != null) g.globalAlpha = q.alpha;
      g.drawImage(spr, -spr.ox, -spr.oy, spr.width / kp, spr.height / kp);
      g.restore();
      if (q.elite) { g.globalAlpha = 0.35 + 0.2 * Math.sin(t * 8); g.strokeStyle = q.elite; g.lineWidth = 4; g.beginPath(); g.ellipse(q.x, q.y - q.r * 1.2, q.r * 1.1, q.r * 1.5, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; }
      if (frozen) { g.fillStyle = 'rgba(170,230,255,0.42)'; g.beginPath(); g.ellipse(q.x, q.y - q.r * 1.1, q.r * 1.05, q.r * 1.4, 0, 0, TAU); g.fill(); }
      if (q.boss || (q.hp < q.mhp && q.mhp > 40)) { const w = q.boss ? 120 : 40; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(q.x - w / 2, q.y - q.r * (q.boss ? 2.6 : 2.7) - 10, w, 6); g.fillStyle = q.boss ? '#e8483a' : '#e0a030'; g.fillRect(q.x - w / 2 + 1, q.y - q.r * (q.boss ? 2.6 : 2.7) - 9, (w - 2) * Math.max(0, q.hp / q.mhp), 4); }
      if (q.burnT > 0) { g.fillStyle = 'rgba(255,140,40,0.7)'; g.beginPath(); g.arc(q.x + Math.sin(t * 30) * 3, q.y - q.r * 2.2, 6 + Math.sin(t * 20) * 2, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,220,120,0.8)'; g.beginPath(); g.arc(q.x, q.y - q.r * 2.1, 3, 0, TAU); g.fill(); }
    }
    // abilities around you
    if (!sim.dead && sim.S.orbit) for (let i = 0; i < sim.S.orbit; i++) { const a = sim.t * 3.2 + (i * TAU) / sim.S.orbit; drawHubcap(g, P.x + Math.cos(a) * 85, P.y - 20 + Math.sin(a) * 85, sim.t * 12, sim.S.orbitN > 10); }
    if (!sim.dead && sim.S.drone) for (let i = 0; i < sim.droneN(); i++) { const D = sim.drones[i]; if (D) drawDrone(g, D.x, D.y, t); }
    if (sim.drawExtraAir) sim.drawExtraAir(g, t, vis);
    // bullets: tracers with a hot core
    g.lineCap = 'round';
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = 'rgba(255,170,60,0.35)'; g.lineWidth = 9; g.beginPath(); for (const b of sim.b) { if (b.kind) continue; const s = 0.03; g.moveTo(b.x - b.vx * s, b.y - b.vy * s); g.lineTo(b.x, b.y); } g.stroke();
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = '#fff6d0'; g.lineWidth = 3; g.beginPath(); for (const b of sim.b) { if (b.kind) continue; const s = 0.018; g.moveTo(b.x - b.vx * s, b.y - b.vy * s); g.lineTo(b.x, b.y); } g.stroke();
    if (sim.b.some((b) => b.crit)) { g.strokeStyle = '#ff6a3c'; g.lineWidth = 5; g.beginPath(); for (const b of sim.b) if (b.crit && !b.kind) { g.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); g.lineTo(b.x, b.y); } g.stroke(); }
    if (sim.drawBullets) sim.drawBullets(g, t);
    if (sim.ghost.length) { g.strokeStyle = 'rgba(170,240,255,0.85)'; g.lineWidth = 3; g.beginPath(); for (const b of sim.ghost) { g.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); g.lineTo(b.x, b.y); } g.stroke(); }
    if (sim.spit.length) { for (const s of sim.spit) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(s.x + 6, s.y + 26, 8, 3, 0, 0, TAU); g.fill(); g.fillStyle = s.big ? '#c8ff4a' : '#a6e83a'; g.beginPath(); g.arc(s.x, s.y, s.big ? 12 : 8, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,200,0.6)'; g.beginPath(); g.arc(s.x - 3, s.y - 3, 3, 0, TAU); g.fill(); } }
    // effects: sparks, blood drops, smoke, shock rings, zaps, floating text
    for (const f of sim.fx) {
      const u = f.t / f.life;
      if (f.k === 'p') { g.globalAlpha = 1 - u; g.fillStyle = f.c; g.fillRect(f.x - f.s / 2, f.y - f.s / 2, f.s, f.s); }
      else if (f.k === 's') { g.globalAlpha = (1 - u) * (f.a || 0.5); g.fillStyle = f.c || '#3a3734'; g.beginPath(); g.arc(f.x, f.y - u * 40, f.r * (0.5 + u), 0, TAU); g.fill(); }
      else if (f.k === 'fire') { g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - u) * 0.9; const gr = g.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r * (0.6 + u * 0.6)); gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.4, 'rgba(255,150,40,0.8)'); gr.addColorStop(1, 'rgba(120,30,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, f.r * (0.6 + u * 0.6), 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; }
      else if (f.k === 'ring') { g.globalAlpha = (1 - u) * 0.8; g.strokeStyle = f.c; g.lineWidth = 8 * (1 - u) + 1.5; g.beginPath(); g.arc(f.x, f.y, f.r + (f.R - f.r) * u, 0, TAU); g.stroke(); }
      else if (f.k === 'zap') { g.globalAlpha = 1 - u; g.strokeStyle = '#d8f6ff'; g.lineWidth = 3; g.shadowColor = '#7fd6ff'; g.shadowBlur = hi ? 10 : 0; g.beginPath(); g.moveTo(f.x, f.y); const n = 5; for (let i = 1; i <= n; i++) { const kk = i / n; g.lineTo(f.x + (f.x2 - f.x) * kk + (i < n ? (Math.random() - 0.5) * 24 : 0), f.y + (f.y2 - f.y) * kk + (i < n ? (Math.random() - 0.5) * 24 : 0)); } g.stroke(); g.shadowBlur = 0; }
      else if (f.k === 'txt') { g.globalAlpha = 1 - u * u; g.font = `bold ${f.size || 28}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(15,10,6,0.9)'; g.strokeText(f.text, f.x, f.y - u * 40); g.fillStyle = f.c; g.fillText(f.text, f.x, f.y - u * 40); }
    }
    g.globalAlpha = 1;
    // muzzle flash
    if (sim.muzzle > 0 && !sim.dead) { const mx = P.x + Math.cos(P.aim) * 52, my = P.y - 28 + Math.sin(P.aim) * 52; g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(mx, my, 1, mx, my, 26); gr.addColorStop(0, 'rgba(255,250,220,1)'); gr.addColorStop(0.35, 'rgba(255,190,80,0.85)'); gr.addColorStop(1, 'rgba(255,120,20,0)'); g.fillStyle = gr; g.beginPath(); g.arc(mx, my, 26, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; }
    // ---------------- light, weather, mood (screen space) ----------------
    g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
    const T = TODS[WX.tod], toS = (x, y) => [(x + ox) * k, (y + oy) * k];
    if (T && !intro) {
      g.fillStyle = T.tint; g.fillRect(0, 0, V.w, V.h);
      // a darkness layer with holes for every light (low resolution, then scaled up)
      const ds = hi ? 0.35 : 0.22, lw = Math.max(16, Math.round(V.w * ds)), lh = Math.max(16, Math.round(V.h * ds));
      if (!LC) LC = document.createElement('canvas');
      if (LC.width !== lw || LC.height !== lh) { LC.width = lw; LC.height = lh; }
      const l = LC.getContext('2d'); l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, lw, lh);
      l.fillStyle = `rgba(${T.col},${T.dark})`; l.fillRect(0, 0, lw, lh);
      l.globalCompositeOperation = 'destination-out';
      const hole = (x, y, r, a = 1) => { const [sx2, sy2] = toS(x, y), R = r * k * ds; if (sx2 < -R || sy2 < -R || sx2 > V.w + R || sy2 > V.h + R) return; const gr = l.createRadialGradient(sx2 * ds, sy2 * ds, 0, sx2 * ds, sy2 * ds, R); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); l.fillStyle = gr; l.fillRect(sx2 * ds - R, sy2 * ds - R, R * 2, R * 2); };
      const view = sim.S.view || 1, scope = sim.buffs.scope > 0 ? 1.35 : 1;
      if (!sim.dead) {
        hole(P.x, P.y - 30, 150 * view * scope, 0.9);
        if (WX.tod === 'night') { // the flashlight cone
          const [hx, hy] = toS(P.x, P.y - 30), len = 620 * view * scope * k * ds, half = 0.42 * Math.min(1.6, view * scope), a0 = P.aim;
          const gr = l.createRadialGradient(hx * ds, hy * ds, 0, hx * ds, hy * ds, len); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          l.fillStyle = gr; l.beginPath(); l.moveTo(hx * ds, hy * ds); l.arc(hx * ds, hy * ds, len, a0 - half, a0 + half); l.closePath(); l.fill();
        }
      }
      if (sim.muzzle > 0) hole(P.x + Math.cos(P.aim) * 50, P.y - 28 + Math.sin(P.aim) * 50, 300, 0.85);
      for (const o of sim.others.values()) if (!o.dead) hole(o.x, o.y - 30, 170, 0.8);
      for (const Lt of TA.lights(sim.area)) hole(Lt.x, Lt.y, Lt.r, 0.85);
      for (const f of sim.fx) if ((f.k === 'ring' && f.R > 120) || f.k === 'fire') hole(f.x, f.y, (f.R || f.r * 3) * 1.3, (1 - f.t / f.life));
      for (const p of sim.pk) hole(p.x, p.y, 90, 0.6);
      if (sim.lightHoles) sim.lightHoles(hole);
      for (const z of sim.z) if (z.burnT > 0 || z.fb) hole(z.x, z.y - z.r, z.fb ? 220 : 90, 0.6);
      g.imageSmoothingEnabled = true; g.drawImage(LC, 0, 0, V.w, V.h);
      // the lamps glow warm
      g.globalCompositeOperation = 'lighter';
      for (const Lt of TA.lights(sim.area)) { const [lx, ly] = toS(Lt.x, Lt.y), R = Lt.r * k * 0.5; if (lx < -R || ly < -R || lx > V.w + R || ly > V.h + R) continue; const gr = g.createRadialGradient(lx, ly, 0, lx, ly, R); gr.addColorStop(0, Lt.c + (WX.tod === 'night' ? '0.22)' : '0.1)')); gr.addColorStop(1, Lt.c + '0)'); g.fillStyle = gr; g.fillRect(lx - R, ly - R, R * 2, R * 2); }
      g.globalCompositeOperation = 'source-over';
    }
    // rain and drifting fog
    if (WX.rain && !intro) {
      const n = hi ? 140 : 60, st = sim._rain || (sim._rain = Array.from({ length: 160 }, (_, i) => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 })));
      g.strokeStyle = 'rgba(190,210,230,0.32)'; g.lineWidth = 1.2; g.beginPath();
      for (let i = 0; i < n; i++) { const d = st[i]; d.y += 0.024 * d.s; d.x -= 0.004 * d.s; if (d.y > 1) { d.y -= 1; d.x = Math.random(); } if (d.x < 0) d.x += 1; const px = d.x * V.w, py = d.y * V.h; g.moveTo(px, py); g.lineTo(px - 5 * d.s, py + 18 * d.s); }
      g.stroke();
      if (hi) { g.fillStyle = 'rgba(200,220,240,0.25)'; for (let i = 0; i < 12; i++) { const px = (Math.sin(t * 3.1 + i * 7.7) * 0.5 + 0.5) * V.w, py = (Math.cos(t * 2.3 + i * 3.3) * 0.5 + 0.5) * V.h; g.beginPath(); g.ellipse(px, py, 5, 2, 0, 0, TAU); g.fill(); } }
    }
    if (WX.fog && !intro && sim.wxk === 'fog') { const R0 = Math.min(V.w, V.h) * 0.42, gr = g.createRadialGradient(V.w / 2, V.h / 2 - 10, R0 * 0.5, V.w / 2, V.h / 2 - 10, Math.max(V.w, V.h) * 0.7); gr.addColorStop(0, 'rgba(170,175,185,0)'); gr.addColorStop(1, `rgba(170,175,185,${hi ? 0.5 : 0.42})`); g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h); }
    if (hi && WX.fog && !intro) { const fogC = WX.tod === 'night' ? '120,130,150' : '200,190,180'; for (let i = 0; i < 5; i++) { const fx = ((i * 0.27 + t * 0.012 * (1 + i * 0.3)) % 1.4 - 0.2) * V.w, fy = (0.15 + 0.18 * i) * V.h, R = V.w * 0.35; const gr = g.createRadialGradient(fx, fy, 0, fx, fy, R); gr.addColorStop(0, `rgba(${fogC},0.07)`); gr.addColorStop(1, `rgba(${fogC},0)`); g.fillStyle = gr; g.fillRect(fx - R, fy - R, R * 2, R * 2); } }
    if (WX.heat && !intro) { g.fillStyle = `rgba(255,120,40,${0.07 + 0.03 * Math.sin(t * 1.3)})`; g.fillRect(0, 0, V.w, V.h); if (hi) { g.strokeStyle = 'rgba(255,220,180,0.07)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 9; i++) { const yy = ((i / 9 + t * 0.05) % 1) * V.h; for (let x = 0; x <= V.w; x += 40) { const y2 = yy + Math.sin(x * 0.03 + t * 3 + i) * 5; if (x) g.lineTo(x, y2); else g.moveTo(x, y2); } } g.stroke(); } }
    // dust motes in the light
    if (hi && !intro && WX.tod !== 'night') { g.fillStyle = 'rgba(255,240,210,0.25)'; for (let i = 0; i < 18; i++) { const px = ((i * 97 + t * 14 * (1 + (i % 3))) % V.w), py = ((i * 53 + Math.sin(t * 0.7 + i) * 30) % V.h); g.fillRect(px, py, 2, 2); } }
    g.drawImage(vignette(V.w, V.h), 0, 0, V.w, V.h);
    // the garage intro starts in the dark; a light flood when the door opens
    if (intro) {
      const T2 = sim.introT, dark = T2 < 1.3 ? 0.9 : Math.max(0, 0.9 - (T2 - 1.3) * 0.6);
      if (dark > 0) { g.fillStyle = `rgba(5,4,3,${dark})`; g.fillRect(0, 0, V.w, V.h); }
      if (T2 > 1.3 && T2 < 3.2) { g.fillStyle = `rgba(255,240,200,${0.3 * Math.sin(((T2 - 1.3) / 1.9) * Math.PI)})`; g.fillRect(0, 0, V.w, V.h); }
      if (T2 > 1.0 && T2 < 3.6) { g.fillStyle = 'rgba(255,240,210,0.55)'; for (let i = 0; i < 40; i++) { const px = ((i * 97 + T2 * 30 * (1 + (i % 3))) % V.w), py = ((i * 53 + Math.sin(T2 + i) * 20) % V.h); g.fillRect(px, py, 2, 2); } }
    }
    if (sim.flash > 0) { g.fillStyle = `rgba(200,20,10,${sim.flash * 1.1})`; g.fillRect(0, 0, V.w, V.h); }
    else if (sim.flash < 0) { g.fillStyle = `rgba(230,255,160,${-sim.flash})`; g.fillRect(0, 0, V.w, V.h); }
    const lowHp = !sim.dead && sim.p.hp / sim.S.mhp < 0.3 && sim.phase === 'play';
    if (lowHp) { const a = 0.25 + 0.15 * Math.sin(t * 7); const gr = g.createRadialGradient(V.w / 2, V.h / 2, Math.min(V.w, V.h) * 0.35, V.w / 2, V.h / 2, Math.max(V.w, V.h) * 0.75); gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, `rgba(170,0,0,${a})`); g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h); }
    if (sim.buffs.freeze > 0) { g.fillStyle = 'rgba(160,220,255,0.10)'; g.fillRect(0, 0, V.w, V.h); }
    const DBf = sim.debuffs || {};
    if (DBf.blind > 0 && !sim.dead) { const R0 = Math.min(V.w, V.h) * 0.2, gr = g.createRadialGradient(V.w / 2, V.h / 2 - 10, R0 * 0.6, V.w / 2, V.h / 2 - 10, R0 * 1.6); gr.addColorStop(0, 'rgba(14,6,22,0)'); gr.addColorStop(1, `rgba(14,6,22,${Math.min(0.97, DBf.blind * 0.6)})`); g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h); }
    if (DBf.confuse > 0) { g.fillStyle = `rgba(150,80,220,${0.12 + 0.06 * Math.sin(t * 6)})`; g.fillRect(0, 0, V.w, V.h); }
    if (DBf.web > 0) { g.strokeStyle = 'rgba(240,240,240,0.5)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * TAU) / 10; g.moveTo(V.w / 2, V.h / 2); g.lineTo(V.w / 2 + Math.cos(a) * V.w, V.h / 2 + Math.sin(a) * V.w); } g.stroke(); }
    if (sim.slowmo > 0) { g.fillStyle = `rgba(20,30,40,${Math.min(0.25, sim.slowmo * 0.4)})`; g.fillRect(0, 0, V.w, V.h); }
  }
  function drawYou(g, sim, V) {
    const P = sim.p, B = sim.buffs, t = sim.t;
    const kp = Math.max(0.2, Math.round(V.k * V.dpr * 10) / 10);
    // a soft shadow under the hero (light from the top-left)
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(P.x + 8, P.y + 2, 26, 9, 0, 0, TAU); g.fill();
    if (sim.dead) { heroDraw(g, sim.me, P.x, P.y, { k: kp, dead: true, face: P.face }); return; }
    const blink = P.inv > 0 && Math.sin(t * 40) > 0;
    if (sim.drawUnderYou) sim.drawUnderYou(g, t);
    g.strokeStyle = sim.me.color || '#ffd23f'; g.lineWidth = 2.5; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(P.x, P.y, 24, 9, 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
    const aimUp = Math.sin(P.aim) < -0.3;
    if (aimUp) gun(g, sim, P);
    heroDraw(g, sim.me, P.x, P.y, { k: kp, moving: P.moving || (sim.phase === 'intro' && sim.introT > 2.9), walkT: P.walkT, face: P.face, hurt: P.inv > 0.4, alpha: blink ? 0.5 : 1 });
    if (!aimUp && (sim.phase !== 'intro' || sim.introT > 2.9)) gun(g, sim, P);
    if (P.armor > 0) { const ay = P.y - 92; g.fillStyle = '#9aa2aa'; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(P.x, ay, 20, 7, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#6a737c'; g.fillRect(P.x - 6, ay - 7, 12, 5); }
    if (B.shield > 0) { g.strokeStyle = `rgba(110,227,255,${0.5 + 0.3 * Math.sin(t * 10)})`; g.lineWidth = 4; g.beginPath(); g.arc(P.x, P.y - 34, 46, 0, TAU); g.stroke(); g.fillStyle = 'rgba(110,227,255,0.12)'; g.fill(); }
    if (B.kicks > 0 && P.moving) for (let i = 0; i < 2; i++) sim.particle(P.x - P.vx * 0.04 + (Math.random() - 0.5) * 10, P.y - 4, -P.vx * 0.2, -20, '#7dff6a', 0.25, 4);
    if (sim.drawOnYou) sim.drawOnYou(g, t);
  }
  function gun(g, sim, P) { if (sim.drawGun) sim.drawGun(g, P); else A().drawGun(g, P.x + P.face * 13, P.y - 30, P.aim, P.kick, sim.buffs.minigun > 0); }
  function drawOther(g, sim, o, V) {
    const who = (sim.o.people && sim.o.people(o.id)) || { id: o.id, name: '?', color: '#fff' };
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(o.x + 8, o.y + 2, 26, 9, 0, 0, TAU); g.fill();
    g.strokeStyle = who.color || '#fff'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(o.x, o.y, 24, 9, 0, 0, TAU); g.stroke();
    if (sim.drawOtherExtra) sim.drawOtherExtra(g, o, who, false);
    heroDraw(g, who, o.x, o.y, { k: Math.max(0.2, Math.round(V.k * V.dpr * 10) / 10), moving: Math.abs(o.tx - o.x) + Math.abs(o.ty - o.y) > 2, walkT: o.walkT, face: o.face || 1, dead: o.dead || o.down });
    if (!o.dead && !o.down) A().drawGun(g, o.x + (o.face || 1) * 6, o.y - 28, o.aim || 0, 0, false);
    if (o.shield) { g.strokeStyle = 'rgba(110,227,255,0.6)'; g.lineWidth = 4; g.beginPath(); g.arc(o.x, o.y - 34, 44, 0, TAU); g.stroke(); }
    g.font = 'bold 20px "Lilita One", sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#1b1410'; g.strokeText(who.name || '', o.x, o.y - 92); g.fillStyle = who.color || '#fff'; g.fillText(who.name || '', o.x, o.y - 92);
    if (o.mhp) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(o.x - 24, o.y - 86, 48, 6); g.fillStyle = '#7dff6a'; g.fillRect(o.x - 23, o.y - 85, 46 * Math.max(0, o.hp / o.mhp), 4); }
    if (o.down) { const u = o.downT != null ? o.downT : 0; g.font = 'bold 18px "Lilita One", sans-serif'; g.lineWidth = 4; g.strokeText('🆘 HOLD NEAR TO REVIVE', o.x, o.y - 112); g.fillStyle = '#ff8c6a'; g.fillText('🆘 HOLD NEAR TO REVIVE', o.x, o.y - 112); if (o.rev > 0) { g.strokeStyle = '#7dff6a'; g.lineWidth = 6; g.beginPath(); g.arc(o.x, o.y - 40, 50, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, o.rev)); g.stroke(); } void u; }
    if (o.ch) { g.font = '24px sans-serif'; g.fillText('🃏', o.x + 30, o.y - 70); }
    if (sim.drawOtherExtra) sim.drawOtherExtra(g, o, who, true);
  }
  function drawHubcap(g, x, y, a, big) { g.save(); g.translate(x, y); g.rotate(a); const s = big ? 1.3 : 1; g.scale(s, s); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(6, 8, 16, 0, TAU); g.fill(); const gr = g.createRadialGradient(-5, -5, 2, 0, 0, 17); gr.addColorStop(0, '#eef1f4'); gr.addColorStop(1, '#7a838c'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill(); g.fillStyle = '#5a636c'; for (let i = 0; i < 5; i++) { g.rotate(TAU / 5); g.fillRect(3, -2, 11, 4); } g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill(); g.restore(); }
  function drawDrone(g, x, y, t) { g.save(); g.translate(x, y); g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(10, 90, 16, 5, 0, 0, TAU); g.fill(); g.fillStyle = '#3a3f44'; g.beginPath(); g.ellipse(0, 0, 15, 8, 0, 0, TAU); g.fill(); g.fillStyle = '#c9a43a'; g.fillRect(-6, -4, 12, 5); g.strokeStyle = '#2a2e33'; g.lineWidth = 2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 12, -4); g.lineTo(s * 22, -10); g.stroke(); g.fillStyle = 'rgba(200,200,200,0.5)'; g.beginPath(); g.ellipse(s * 22, -11, 12 * Math.abs(Math.sin(t * 40)), 3, 0, 0, TAU); g.fill(); } g.fillStyle = '#ff4a3a'; g.beginPath(); g.arc(4, 1, 2.5, 0, TAU); g.fill(); g.restore(); }
  function drawRaccoon(g, R, t) {
    const b = R.moving ? Math.abs(Math.sin(t * 16)) * 4 : 0;
    g.save(); g.translate(R.x, R.y); if (R.face < 0) g.scale(-1, 1);
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(4, 0, 20, 6, 0, 0, TAU); g.fill();
    g.translate(0, -b);
    g.fillStyle = '#6f747b'; g.beginPath(); g.ellipse(-16, -14, 14, 6, -0.6, 0, TAU); g.fill();
    g.fillStyle = '#2f3237'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(-12 - i * 6, -10 - i * 4, 2.5, 5, -0.6, 0, TAU); g.fill(); }
    const gr = g.createLinearGradient(0, -26, 0, -2); gr.addColorStop(0, '#9aa0a7'); gr.addColorStop(1, '#5d6268'); g.fillStyle = gr; g.beginPath(); g.ellipse(0, -14, 15, 11, 0, 0, TAU); g.fill();
    g.beginPath(); g.arc(13, -24, 10, 0, TAU); g.fill();
    g.fillStyle = '#26282c'; g.fillRect(6, -28, 15, 6); g.fillStyle = '#fff'; g.beginPath(); g.arc(16, -25, 2, 0, TAU); g.fill();
    g.fillStyle = '#15110d'; g.beginPath(); g.arc(23, -22, 2.5, 0, TAU); g.fill();
    g.fillStyle = '#7a8086'; g.beginPath(); g.moveTo(8, -31); g.lineTo(10, -38); g.lineTo(14, -32); g.fill();
    g.restore();
  }
  window.TZSim = { BREAK_S, Sim, render, heroDraw, SPR, lead, camCenter, weather, _drawRaccoon: drawRaccoon };
})();
