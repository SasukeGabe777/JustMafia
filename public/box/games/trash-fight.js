'use strict';
// JustZombies on the phone, part 3 (extends TZSim.Sim; after trash-play.js): weapons that fire by
// themselves next to your pistol (levels 1-10 at the gun merchants, tiers 1-3 at the crucible, with
// the golden lift-up cutscene), weapon combos, timed super weapons (and the zombies that carry them),
// survivor classes, passive items (lock + reroll at the shops), the roaming trader truck, slow motion,
// the new zombies (crawlers, gas-bags, screamers, stalkers, brutes, riot shields, nests, the debuff
// zombies) and the debuffs they put on you, area events (car alarm, gas leak, supply drop, cash grab).
(function () {
  const W = window.TZW, R = () => window.TZR, PP = () => window.TZP, TAU = Math.PI * 2;
  const Sim = window.TZSim.Sim, proto = Sim.prototype;
  const d2 = (a, b, x, y) => (a - x) * (a - x) + (b - y) * (b - y);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ZT = Object.keys(W.ZOMBIES);
  function fi(s) {
    if (s._fi) return s; s._fi = true;
    Object.assign(s, { weapons: [], gun: { id: 'pistol', lv: 1, tier: 1 }, cores: 0, cls: null, items: {}, combos: new Set(), seenCombos: [], tcombo: null, debuffs: {}, immune: {}, webs: [], puddles: [], drops: [], events: [], truck: null, usedTurret: false, slowmo: 0, evo: null, rateMul: 1, speedMul: 1, wiggle: 0, _cc: 0, zfx: 0 });
    return s;
  }
  const hashZ = (s, z, salt) => W.hash(s.seed, z.id, salt) % 1000;
  // ---------------- wrap the core sim ----------------
  const baseStats = proto.stats;
  proto.stats = function () {
    baseStats.call(this); const S = this.S; if (!this._fi) return;
    const it = (k) => { let v = 0; for (const id of Object.keys(this.items || {})) v += (R().ITEMS[id].fx[k] || 0) * this.items[id]; return v; };
    const g = this.gun, cls = this.cls;
    S.dmg *= R().power(g.lv, g.tier) * Math.max(0.3, 1 + it('dmg')); S.rate *= R().speed(g.lv, g.tier) * (1 + it('rate'));
    S.mhp = Math.max(40, S.mhp + it('mhp') + (cls === 'brawler' ? Math.round(S.mhp * 0.4) : 0));
    S.speed *= Math.max(0.5, 1 + it('speed')); S.armor *= Math.max(0.5, 1 - it('armor')); S.dodge = Math.max(0, S.dodge + it('dodge'));
    S.crit = Math.min(0.85, S.crit + it('crit') + (cls === 'sharp' ? 0.15 : 0)); S.critMul += cls === 'sharp' ? 1 : 0; S.critHeal = it('critHeal');
    S.magnet *= 1 + it('magnet') + (cls === 'scav' ? 0.4 : 0); S.luck = 1 + it('luck') + (cls === 'scav' ? 1 : 0); S.interest = it('interest'); S.zslow = it('zslow'); S.xpMul = 1 + it('xp'); S.scoreMul = 1 + it('score');
    S.regen += cls === 'medic' ? 2 : 0; S.thorns += cls === 'brawler' ? 10 : 0; S.boomMul = cls === 'demo' ? 1.4 : 1; S.aimRange *= cls === 'sharp' ? 1.2 : 1;
    if (g.tier >= 2) { S.br += 2 * (g.tier - 1); S.pierce += g.tier - 1; }
    if (this.combos && this.combos.has('hubstorm')) S.orbit += 2;
    this.cashMul = (cls === 'scav' ? 1.6 : 1) * (S.luck || 1);
  };
  const baseOffer = proto.offerCards;
  proto.offerCards = function () {
    baseOffer.call(this); const C = this.cls && R().CLASSES[this.cls];
    if (C && this.cards && this.rng() < 0.45) { const id = C.bias[Math.floor(this.rng() * C.bias.length)], A = W.AB[id]; const i = this.cards.findIndex((c) => W.AB[c] && W.AB[c].cat === A.cat); if (i >= 0 && !this.cards.includes(id)) this.cards[i] = id; }
  };
  const basePlay = proto.playStep;
  proto.playStep = function (dt, I) { basePlay.call(this, dt, I); this.fightStep(dt, I); };
  const baseKill = proto.onKill;
  proto.onKill = function (z, by, mine) {
    fi(this); const sm = this.S.scoreMul || 1, before = this.score; baseKill.call(this, z, by, mine); if (sm !== 1) this.score = before + (this.score - before) * sm;
    if (z.remote) return;
    if (z.carry) this.pk.push({ id: this.pkid++, k: z.carry, x: clamp(z.x, 60, W.AW - 60), y: clamp(z.y, 60, W.AH - 60), life: 20 });
    const zx = clamp(z.x, 80, W.AW - 80), zy = clamp(z.y, 80, W.AH - 80);
    if (z.boss || z.mb) this.drops.push({ k: 'core', x: zx - 40, y: zy + 10, t: 0 });
    else if (z.elite && this.rng() < (this.set.mode === 'endless' ? 0.4 : 0.25)) this.drops.push({ k: 'weapon', x: zx, y: zy, t: 0 });
    else if (z.elite && this.set.mode === 'endless' && this.rng() < 0.05) this.drops.push({ k: 'core', x: zx, y: zy, t: 0 });
    if (this.mode === 'solo' && (z.boss || z.mb) && !z.fb) this.slowMo(0.9);
  };
  const baseClear = proto.onClear;
  proto.onClear = function () {
    fi(this); baseClear.call(this);
    if (this.S.interest) { this.cash += this.S.interest; this.popup('PIGGY BANK +$' + this.S.interest, '#ffd23f', this.p.x, this.p.y - 180); }
    if (this.mode === 'solo') this.slowMo(0.7);
    // the roaming trader parks here for a little while (no other place in this block)
    if (!this.placeType() && this.wave >= 3 && !this.isDoorCell() && this.rng() < 0.3) { this.truck = { cell: this.cellKey(), t: 35 }; this.banner = { text: '🚚 THE TRADER IS HERE', sub: 'Weapons + gear, parked for 35 seconds', t: 3 }; this.o.on('truck', {}); }
    if (this.mode === 'solo' && this.wave >= 4 && this.rng() < 0.12) this.startEvent('cash');
  };
  // what each place stocks besides its goods: weapons (gun merchants, the trader) and items
  const baseStock = proto.stockOf;
  proto.stockOf = function () {
    const S = baseStock.call(this); if (!S || S.extra) return S; fi(this); S.extra = true;
    const pickW = (n, rars) => { const L = Object.keys(R().WEAPONS).filter((k) => k !== 'pistol' && rars.includes(R().WEAPONS[k].rar) && !this.weapons.some((w) => w.id === k)), out = []; while (out.length < n && L.length) out.push(L.splice(Math.floor(this.rng() * L.length), 1)[0]); return out; };
    const t = S.type;
    S.weapons = t === 'tinker' ? pickW(2, ['common', 'rare']) : t === 'gunsmith' ? pickW(2, ['rare', 'epic']) : t === 'master' ? pickW(1, ['epic', 'legendary']) : t === 'truck' ? pickW(3, ['common', 'rare', 'epic', 'legendary']) : [];
    const keep = ((this.lockedItems || {})[t] || []).filter((id) => R().ITEMS[id]);
    const n = { market: 2, armor: 2, clinic: 1, truck: 3, camper: 2 }[t] || 0;
    S.items = n ? keep.concat(this.pickItems(t, Math.max(0, n - keep.length), keep)) : []; S.locked = Object.fromEntries(keep.map((k) => [k, 1]));
    return S;
  };
  const basePlace = proto.placeType;
  proto.placeType = function () { const t = basePlace.call(this); if (t) return t; return this.truck && this.truck.t > 0 && this.truck.cell === this.cellKey() ? 'truck' : null; };
  const baseStart = proto.startWave;
  proto.startWave = function () {
    baseStart.call(this); fi(this);
    if (this.spec && this.spec.mini) { this.spec.boss = true; this.bossDue = true; }
    if (this.mode !== 'guest' && this.wave >= 3 && this.rng() < 0.22) this.startEvent(['alarm', 'gas', 'drop', 'horde'][Math.floor(this.rng() * 4)]);
  };
  const baseSpawnOne = proto.spawnOne;
  proto.spawnOne = function (type) {
    if (type === 'boss' && this.spec && this.spec.mini) { const z = baseSpawnOne.call(this, this.spec.mini); z.mb = this.spec.mini; z.cd = 2; z.cd2 = 4; this.banner = { text: '⚠️ ' + W.ZOMBIES[z.mb].name.toUpperCase(), sub: 'A mini-boss: watch for its tricks', t: 2.4 }; return z; }
    return baseSpawnOne.call(this, type);
  };
  const baseMakeZ = proto.makeZ;
  proto.makeZ = function (type, x, y) {
    const z = baseMakeZ.call(this, type, x, y); fi(this); dress(this, z);
    if (z.elite && !z.boss) { z.hp *= 3; z.mhp *= 3; z.dmg *= 1.5; z.xp *= 3; }
    if (z.mb) { z.hp = z.mhp = W.ZOMBIES[type].hp * (this.spec ? this.spec.hpMul : 1) * (1 + 0.5 * (this.areaMembers.length - 1)); }
    return z;
  };
  // carriers and elites come from the zombie's id (so every phone in a co-op area agrees)
  function dress(s, z) {
    const Z = W.ZOMBIES[z.type]; if (!Z || Z.boss || Z.nest) return;
    if (s.wave >= 4 && hashZ(s, z, 'carry') < 30) z.carry = Object.keys(R().TIMED)[hashZ(s, z, 'what') % 4];
    if (s.wave >= 6 && hashZ(s, z, 'elite') < 25) z.elite = ['#ffd23f', '#7fd6ff', '#ff5a8a'][hashZ(s, z, 'ec') % 3];
  }
  const baseDamage = proto.damageZ;
  proto.damageZ = function (z, dmg, by, kx = 0, ky = 0, o = {}) {
    const Z = W.ZOMBIES[z.type];
    if (Z && Z.shield && (kx || ky)) { const from = kx > 0 ? -1 : 1; if (from === z.face) dmg *= 0.2; } // the shield faces you: hit it from the side or behind
    if (Z && Z.rage && z.hp > 0 && !z.rageT) { z.rageT = 4; z.speed *= 1.9; }
    if (o.crit && this.S.critHeal) this.p.hp = Math.min(this.S.mhp, this.p.hp + this.S.critHeal);
    return baseDamage.call(this, z, dmg, by, kx, ky, o);
  };
  const baseHurt = proto.hurt;
  proto.hurt = function (dmg, fx, fy) { if (this.evo && this.mode !== 'solo') return; return baseHurt.call(this, dmg, fx, fy); };
  const baseApply = proto.applyPickup;
  proto.applyPickup = function (k) { baseApply.call(this, k); fi(this); if (k === 'snack') this.cleanse(); if (R().TIMED[k]) this.timedCheck(); };
  const baseBoom = proto.boom;
  proto.boom = function (x, y, rad, dmg, color, hurtsYou) { const m = (this.S && this.S.boomMul) || 1; return baseBoom.call(this, x, y, rad * (hurtsYou ? 1 : m), dmg * (hurtsYou ? 1 : m), color, hurtsYou); };
  const baseUseTurret = proto.useTurret;
  proto.useTurret = function () { const ok = baseUseTurret.call(this); if (ok) { this.usedTurret = true; const T = this.turrets[this.turrets.length - 1]; if (this.cls === 'tinker') T.life *= 2; } return ok; };

  Object.assign(proto, {
    initFight() { fi(this); },
    // ---------------- classes ----------------
    setClass(id) {
      fi(this); if (!R().CLASSES[id] || this.cls) return false; this.cls = id;
      if (id === 'demo') this.bombs += 2; if (id === 'tinker') this.kits += 2; if (id === 'brawler') this.addWeapon('bat', true);
      this.stats(); this.p.hp = this.S.mhp; this.o.report({ op: 'ev', k: 'class', id }); return true;
    },
    // ---------------- weapons ----------------
    addWeapon(id, quiet) {
      fi(this); if (!R().WEAPONS[id] || id === 'pistol') return false;
      const have = this.weapons.find((w) => w.id === id);
      if (have) { if (have.lv < R().MAX_LV) { have.lv++; this.popup(R().wname(id, have.tier) + ' Lv ' + have.lv, '#7fd6ff', this.p.x, this.p.y - 110); } else this.cash += 25; return 'level'; } // a duplicate: +1 level
      if (this.weapons.length >= R().SLOTS) { this.cash += 25; this.popup('SLOTS FULL: +$25', '#ffd23f', this.p.x, this.p.y - 110); return 'cash'; }
      this.weapons.push({ id, lv: 1, tier: 1, cd: 0.4, a: 0, swing: 0 });
      if (!quiet) { this.banner = { text: R().WEAPONS[id].icon + ' ' + R().wname(id, 1).toUpperCase(), sub: 'It fires by itself, next to your pistol', t: 2.2 }; this.o.report({ op: 'ev', k: 'weapon', id }); }
      this.o.on('weapon', { id }); this.comboCheck(); return true;
    },
    weaponById(id) { return id === 'pistol' ? this.gun : this.weapons.find((w) => w.id === id); },
    upgrade(id, rank) {
      fi(this); const w = this.weaponById(id); if (!w) return { ok: false, error: 'You don’t have that.' };
      if (!R().canUpgrade(rank, w.lv)) return { ok: false, error: w.lv >= 10 ? 'Level 10: take it to the crucible to evolve.' : 'This merchant can’t work on that level.' };
      const c = R().upgradeCost(id, w.lv, w.tier, this.wave); if (this.cash < c) return { ok: false, error: 'Not enough cash.' };
      this.cash -= c; w.lv++; this.stats(); this.o.on('upgrade', { id, lv: w.lv }); this.o.report({ op: 'ev', k: 'upgrade', id, lv: w.lv, tier: w.tier });
      return { ok: true };
    },
    evolve(id) {
      fi(this); const w = this.weaponById(id); if (this.placeType() !== 'forge') return { ok: false, error: 'Only the crucible can do that.' };
      if (!w || !R().canEvolve(w, this.cores)) return { ok: false, error: !w ? 'You don’t have that.' : w.lv < 10 ? 'It needs to be level 10 first.' : w.tier >= 3 ? 'It’s already fully evolved!' : 'The fire needs a crucible core (bosses drop them).' };
      this.cores--; this.evo = { t: 0, id, from: w.tier, to: w.tier + 1, done: false };
      this.o.on('evolve', { id, tier: w.tier + 1 }); return { ok: true };
    },
    evoStep(dt) {
      const E = this.evo; E.t += dt;
      if (!E.done && E.t >= 1.7) { E.done = true; const w = this.weaponById(E.id); w.tier = E.to; w.lv = 1; this.stats(); this.flash = -0.5; this.o.report({ op: 'ev', k: 'evolve', id: E.id, tier: w.tier }); this.comboCheck(); }
      this.banner = null;
      if (E.t >= 3.4) { this.evo = null; this.p.inv = Math.max(this.p.inv, 1.2); this.banner = { text: '✨ ' + R().wname(E.id, E.to).toUpperCase(), sub: E.to >= 3 ? 'FULLY EVOLVED!' : 'Tier ' + E.to + ': back to level 1, with a lot more punch', t: 3 }; }
    },
    // the weapons fire at whatever is nearest in their reach
    weaponsStep(dt) {
      const P = this.p, S = this.S, combos = this.combos, rm = this.rateMul;
      for (const w of this.weapons) {
        const Wd = R().WEAPONS[w.id], pw = R().power(w.lv, w.tier), dmg = S.dmg * Wd.dmg * pw, ox = P.x, oy = P.y - 28;
        w.cd -= dt * R().speed(w.lv, w.tier) * rm; w.swing = Math.max(0, w.swing - dt * 4);
        if (w.cd > 0) continue;
        const z = this.nearestZ(ox, oy, Wd.range * (S.aimRange / 640)); if (!z) { w.cd = 0.1; continue; }
        const a = Math.atan2(z.y - z.r - oy, z.x - ox); w.a = a; w.cd = 1 / Wd.rate; if (this.snd) this.snd('w:' + w.id, P.x, P.y);
        const shot = (ang, o = {}) => { if (this.b.length >= 300) this.b.shift(); const sp = o.sp || 900; this.b.push({ x: ox + Math.cos(ang) * 26, y: oy + Math.sin(ang) * 26, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: o.r || 5, dmg: o.dmg || dmg, crit: false, pierce: o.pierce || 0, bounce: o.bounce || 0, life: o.life || (Wd.range / sp), hit: null, burn: o.burn || 0, kind: o.kind, color: Wd.color, boom: o.boom, zap: o.zap, ret: o.ret, kb: o.kb, t0: this.t }); if (this.mode !== 'solo') this.shots.push([Math.round(ox), Math.round(oy), Math.round(ang * 100) / 100]); };
        switch (Wd.kind) {
          case 'spread': for (let i = 0; i < Wd.pellets + w.tier - 1; i++) shot(a + (this.rng() - 0.5) * 0.55, { sp: 950, life: 0.36, r: 4, bounce: combos.has('pinball') ? 2 : 0 }); break;
          case 'rattle': { const cr = this.rng() < S.crit * (combos.has('luckyrattle') ? 2 : 1); shot(a + (this.rng() - 0.5) * 0.18, { sp: 1000, r: 3.5, dmg: dmg * (cr ? S.critMul : 1) }); break; }
          case 'nail': shot(a, { sp: 1100, r: 3, pierce: Wd.pierce + w.tier - 1, kind: 'nail', zap: combos.has('arcnails') }); break;
          case 'bolt': shot(a, { sp: 1300, r: 5, pierce: 99, kind: 'bolt', boom: combos.has('boombolts') ? 110 : 0 }); break;
          case 'boomer': shot(a, { sp: 700, r: 12, pierce: 99, kind: 'hubcap', ret: true, life: 1.4 }); break;
          case 'lob': shot(a, { sp: 620, r: 7, kind: 'grenade', boom: 120 + 20 * (w.tier - 1), life: Math.min(1, Math.sqrt(d2(z.x, z.y, ox, oy)) / 620) }); break;
          case 'zap': { let from = { x: ox, y: oy }; const seen = []; for (let j = 0; j < 3 + w.tier; j++) { let best = null, bd = 300 * 300; for (const q of this.z) { if (q.hp <= 0 || seen.includes(q.id)) continue; const dd = d2(from.x, from.y, q.x, q.y - q.r); if (dd < bd) { bd = dd; best = q; } } if (!best) break; seen.push(best.id); this.fx.push({ k: 'zap', x: from.x, y: from.y, x2: best.x, y2: best.y - best.r, t: 0, life: 0.18 }); this.damageZ(best, dmg, this.me.id, 0, 0, { shock: 1 }); from = { x: best.x, y: best.y - best.r }; } break; }
          case 'rail': { const L = 1400, cx = Math.cos(a), cy = Math.sin(a); for (const q of this.z) { if (q.hp <= 0) continue; const px = q.x - ox, py = q.y - q.r - oy, t = px * cx + py * cy; if (t < 0 || t > L) continue; const dd = Math.abs(px * cy - py * cx); if (dd < q.r + 10) { this.damageZ(q, dmg, this.me.id, cx * 200, cy * 200); if (combos.has('railstorm') && this.rng() < 0.4) this.fx.push({ k: 'zap', x: q.x, y: q.y - 300, x2: q.x, y2: q.y - q.r, t: 0, life: 0.2 }); } } this.fx.push({ k: 'rail', x: ox, y: oy, x2: ox + cx * L, y2: oy + cy * L, t: 0, life: 0.25, c: Wd.color }); break; }
          case 'cone': case 'push': { const reach = Wd.range, half = Wd.kind === 'cone' ? 0.38 : 0.5, fire = Wd.kind === 'cone' || combos.has('firetornado');
            for (const q of this.z) { if (q.hp <= 0) continue; const dx = q.x - ox, dy = q.y - q.r - oy, dd = Math.hypot(dx, dy); if (dd > reach + q.r) continue; let da = Math.atan2(dy, dx) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > half) continue; this.damageZ(q, dmg, this.me.id, (dx / (dd || 1)) * (Wd.kind === 'push' ? 420 : 30), (dy / (dd || 1)) * (Wd.kind === 'push' ? 420 : 30), { burn: fire ? 1 + w.tier : 0 }); }
            if (this.fx.length < 200) for (let i = 0; i < 2; i++) { const aa = a + (this.rng() - 0.5) * half * 2, rr = reach * (0.4 + this.rng() * 0.6); this.fx.push(fire ? { k: 'fire', x: ox + Math.cos(aa) * rr, y: oy + Math.sin(aa) * rr, r: 22, t: 0, life: 0.25 } : { k: 's', x: ox + Math.cos(aa) * rr, y: oy + Math.sin(aa) * rr, r: 10, t: 0, life: 0.35, a: 0.35, c: '#c8e0a0' }); }
            break; }
          case 'swing': case 'saw': { w.swing = 1; const reach = Wd.range + 20, m = combos.has('spikebat') && Wd.kind === 'swing' ? 2 : 1; for (const q of this.z) { if (q.hp <= 0) continue; if (d2(q.x, q.y, P.x, P.y) < (reach + q.r) * (reach + q.r)) { const dd = Math.hypot(q.x - P.x, q.y - P.y) || 1; this.damageZ(q, dmg * m, this.me.id, ((q.x - P.x) / dd) * (Wd.kind === 'swing' ? 380 : 60), ((q.y - P.y) / dd) * (Wd.kind === 'swing' ? 380 : 60), { burn: combos.has('sawfire') && Wd.kind === 'saw' ? 2 : m > 1 ? 1 : 0 }); } } break; }
        }
      }
    },
    // bullets with a trick: they explode, spark, or come back (called from the core bullet loop)
    bulletHit(b, z) { if (b.zap) { const q = this.nearestZ(z.x + 60, z.y, 200); if (q && q !== z) { this.fx.push({ k: 'zap', x: z.x, y: z.y - z.r, x2: q.x, y2: q.y - q.r, t: 0, life: 0.15 }); this.damageZ(q, b.dmg * 0.6, this.me.id, 0, 0, { shock: 1 }); } } if (b.boom && !b.pierce) this.boom(b.x, b.y, b.boom, b.dmg, '#ff8c42', false); },
    bulletEnd(b) { if (b.boom) this.boom(b.x, b.y, b.boom, b.dmg, '#ff8c42', false); },
    // ---------------- timed super weapons ----------------
    timedCheck() {
      const on = Object.keys(R().TIMED).filter((k) => this.buffs[k] > 0); const C = R().TIMED_COMBOS.find((c) => c.need.every((k) => on.includes(k)));
      if (C && (!this.tcombo || this.tcombo.name !== C.name)) { this.tcombo = C; this.banner = { text: C.icon + ' ' + C.name.toUpperCase() + '!', sub: 'Two super weapons fused (for a few seconds)', t: 2.4 }; this.o.on('combo', { timed: true, name: C.name }); }
      if (!C) this.tcombo = null;
    },
    timedStep(dt) {
      const B = this.buffs, P = this.p, T = this.timers; if (this.tcombo) this.timedCheck();
      const rocketMini = this.tcombo && this.tcombo.name === 'Rocket Minigun', rayMini = this.tcombo && this.tcombo.name === 'Ray Minigun';
      if (B.rockets > 0) { T.rk = (T.rk || 0) - dt; if (T.rk <= 0) { T.rk = 0.22; const z = this.z.filter((q) => q.hp > 0)[Math.floor(this.rng() * this.z.length)]; if (z) { const a = Math.atan2(z.y - z.r - (P.y - 40), z.x - P.x); this.b.push({ x: P.x, y: P.y - 40, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, r: 7, dmg: this.S.dmg * 3, pierce: 0, bounce: 0, life: 1.2, hit: null, burn: 0, kind: 'rocket', boom: 110, color: '#ff5a3c' }); } } }
      if (B.raygun > 0 || rayMini) { T.ray = (T.ray || 0) - dt; if (T.ray <= 0) { T.ray = rayMini ? 0.06 : 0.16; const z = this.nearestZ(P.x, P.y - 28, 800); const a = z ? Math.atan2(z.y - z.r - (P.y - 28), z.x - P.x) : P.aim; this.b.push({ x: P.x, y: P.y - 28, vx: Math.cos(a) * 1400, vy: Math.sin(a) * 1400, r: 8, dmg: this.S.dmg * 2.2, pierce: 99, bounce: 0, life: 0.7, hit: null, burn: 0, kind: 'ray', color: '#7dff6a' }); } }
      if (rocketMini) this._rocketMini = true; else this._rocketMini = false;
      if (B.truck > 0) { this.speedMul *= 1.5; for (const z of this.z) if (z.hp > 0 && d2(z.x, z.y, P.x, P.y) < (z.r + 60) * (z.r + 60)) { const dd = Math.hypot(z.x - P.x, z.y - P.y) || 1; this.damageZ(z, z.boss ? 60 : 400 + 40 * this.wave, this.me.id, ((z.x - P.x) / dd) * 700, ((z.y - P.y) / dd) * 700); if (this.tcombo && this.tcombo.name === 'Rocket Truck' && this.rng() < 0.2) this.boom(z.x, z.y, 90, this.S.dmg * 2, '#ff8c42', false); } }
    },
    // ---------------- combos ----------------
    comboCheck() {
      fi(this); const have = new Set([...this.weapons.map((w) => 'w:' + w.id), ...Object.keys(this.ab).filter((k) => this.ab[k] > 0).map((k) => 'a:' + k), ...(this.usedTurret ? ['g:turret'] : [])]);
      for (const C of R().COMBOS) if (!this.combos.has(C.id) && C.need.every((n) => have.has(n))) {
        this.combos.add(C.id); this.banner = { text: '🧪 COMBO: ' + C.name.toUpperCase() + '!', sub: C.desc, t: 3.2 }; this.shake = Math.max(this.shake, 0.3);
        this.o.on('combo', { id: C.id }); this.o.report({ op: 'ev', k: 'combo', id: C.id }); this.stats();
      }
    },
    // ---------------- debuffs ----------------
    applyDebuff(kind) {
      fi(this); const D = R().DEBUFFS[kind]; if (!D || this.dead || this.down || this.buffs.shield > 0 || (this.evo && this.mode !== 'solo')) return false;
      if (this.debuffs[kind] > 0) { this.debuffs[kind] = Math.max(this.debuffs[kind], D.dur * 0.6); return true; }
      if ((this.immune[kind] || 0) > this.t) return false;
      if (Object.values(this.debuffs).filter((v) => v > 0).length >= R().MAX_DEBUFFS) return false;
      this.debuffs[kind] = D.dur; this.popup(D.icon + ' ' + D.name.toUpperCase() + '!', '#ff9a8a', this.p.x, this.p.y - 120); this.o.on('debuff', { kind });
      if (kind === 'web') this.wiggle = 0;
      return true;
    },
    cleanse() { fi(this); const had = Object.values(this.debuffs).some((v) => v > 0); this.debuffs = {}; if (had) this.popup('CLEANSED!', '#9cff5a', this.p.x, this.p.y - 120); return had; },
    debuffStep(dt, I) {
      const Dv = this.debuffs;
      for (const k of Object.keys(Dv)) if (Dv[k] > 0) { Dv[k] -= dt; if (Dv[k] <= 0) { delete Dv[k]; this.immune[k] = this.t + R().IMMUNE_S; } }
      if (Dv.web > 0 && I) { const m = Math.hypot(I.mx || 0, I.my || 0), dx = (I.mx || 0) - (this._wgx || 0), dy = (I.my || 0) - (this._wgy || 0); this._wgx = I.mx || 0; this._wgy = I.my || 0; this.wiggle += Math.hypot(dx, dy) * (m > 0.3 ? 1 : 0); if (this.wiggle > 3) { Dv.web = 0; delete Dv.web; this.immune.web = this.t + R().IMMUNE_S; this.popup('BROKE FREE!', '#fff', this.p.x, this.p.y - 120); } }
      if (Dv.leech > 0) { this.xp = Math.max(0, this.xp - 2 * dt); this.cash = Math.max(0, this.cash - 1.2 * dt); }
      if (Dv.shake > 0) this.shake = Math.max(this.shake, 0.12);
      this.rateMul *= Dv.jam > 0 ? 0.4 : 1;
      this.speedMul *= Dv.web > 0 ? 0.12 : Dv.sludge > 0 ? 0.5 : 1;
    },
    // controls reversed while dizzy; aim wobbles while rattled
    mapInput(I) { if (!this._fi) return I; const D = this.debuffs; if (D.confuse > 0) I = { ...I, mx: -(I.mx || 0), my: -(I.my || 0) }; if (D.shake > 0 && (I.ax || I.ay)) { const a = Math.atan2(I.ay, I.ax) + Math.sin(this.t * 9) * 0.35; I = { ...I, ax: Math.cos(a), ay: Math.sin(a) }; } return I; },
    // ---------------- zombies doing their thing ----------------
    zombieExtra(dt) {
      const P = this.p, host = this.mode !== 'guest';
      for (const z of this.z) {
        if (z.hp <= 0) continue; const Z = W.ZOMBIES[z.type]; if (!Z) continue;
        const dd = d2(z.x, z.y, P.x, P.y);
        z.pt = (z.pt == null ? 1 + (z.id % 5) * 0.4 : z.pt) - dt;
        if (z.rageT > 0) { z.rageT -= dt; if (z.rageT <= 0) { z.speed /= 1.9; z.rageT = -1; } }
        // ranged debuff shots and carriers' weak shots (the area host runs them)
        if (host && z.pt <= 0 && (Z.ranged || z.carry) && dd < 520 * 520) { z.pt = Z.ranged ? 2.8 : 2.2; const a = Math.atan2(P.y - 20 - (z.y - z.r * 2), P.x - z.x); this.spit.push({ x: z.x, y: z.y - z.r * 2, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, life: 2, dmg: z.dmg * (z.carry ? 0.5 : 0.6), debuff: Z.ranged ? Z.debuff : null, col: z.carry ? '#ffb02e' : Z.aura }); continue; }
        // pulses: every phone checks itself (so guests feel them too)
        if (Z.pulse && z.pt <= 0 && dd < 300 * 300) {
          z.pt = 5; this.fx.push({ k: 'ring', x: z.x, y: z.y - z.r, r: 10, R: 300, t: 0, life: 0.45, c: Z.aura || '#fff' });
          if (Z.pulse === 'scream') { const d = Math.sqrt(dd) || 1; P.vx += ((P.x - z.x) / d) * 380; P.vy += ((P.y - z.y) / d) * 380; this.applyDebuff('shake'); }
          else this.applyDebuff(Z.debuff);
        }
        if (Z.trail && host && this.rng() < dt * 0.8 && this.puddles.length < 14) this.puddles.push({ x: z.x, y: z.y, r: 50, t: 0, life: 8 });
        if (Z.explodes && host && dd < (z.r + P.r + 26) * (z.r + P.r + 26)) { z.hp = 0; this.boom(z.x, z.y, 120, 30 * (this.spec ? this.spec.dmgMul : 1), '#ffb02e', true); this.killZ(z, null); }
        if (Z.nest && host) { z.nt = (z.nt || 3) - dt; if (z.nt <= 0 && this.z.length < 90) { z.nt = 4; for (let i = 0; i < 2; i++) this.makeZ('crawler', z.x + (this.rng() - 0.5) * 60, z.y + 20); } }
      }
      for (let i = this.puddles.length - 1; i >= 0; i--) { const q = this.puddles[i]; q.t += dt; if (q.t > q.life) { this.puddles.splice(i, 1); continue; } if (d2(q.x, q.y, P.x, P.y) < q.r * q.r) this.applyDebuff('sludge'); }
      for (let i = this.webs.length - 1; i >= 0; i--) { const q = this.webs[i]; q.t += dt; if (q.t > q.life) { this.webs.splice(i, 1); continue; } if (d2(q.x, q.y, P.x, P.y) < q.r * q.r && this.applyDebuff('web')) this.webs.splice(i, 1); }
    },
    // ---------------- slow motion (solo only: in co-op the others keep playing) ----------------
    slowMo(s) { if (this.mode === 'solo') this.slowmo = Math.max(this.slowmo || 0, s); },
    // ---------------- area events ----------------
    startEvent(k) {
      const P = this.p, ev = { k, t: 0 };
      if (k === 'alarm') { ev.x = 200 + this.rng() * (W.AW - 400); ev.y = 200 + this.rng() * (W.AH - 400); this.banner = { text: '🚨 CAR ALARM!', sub: 'That noise is bringing a horde…', t: 2.5 }; }
      else if (k === 'horde') { this.banner = { text: '🧟 HORDE RUSH!', sub: 'Here they come!', t: 2.5 }; ev.n = 18; }
      else if (k === 'gas') { const q = this.area.roads[0]; ev.x = q ? clamp(q.x + q.w / 2, 200, W.AW - 200) : W.AW / 2; ev.y = q ? clamp(q.y + q.h / 2, 200, W.AH - 200) : W.AH / 2; ev.r = 130; this.banner = { text: '☣️ GAS LEAK', sub: 'Shoot the cloud when they’re in it', t: 2.5 }; }
      else if (k === 'drop') { ev.x = 200 + this.rng() * (W.AW - 400); ev.y = 200 + this.rng() * (W.AH - 400); this.banner = { text: '📦 SUPPLY DROP', sub: 'Follow the flare!', t: 2.5 }; }
      else if (k === 'cash') { ev.end = 15; for (let i = 0; i < 36; i++) this.coins.push({ x: 120 + this.rng() * (W.AW - 240), y: 120 + this.rng() * (W.AH - 240), v: 2 + Math.floor(this.wave / 3), t: 0, hold: true }); this.banner = { text: '💰 CASH GRAB! 15 s', sub: 'Grab it all before it’s gone', t: 2.5 }; }
      this.events.push(ev); this.o.on('event', { k }); void P;
    },
    eventStep(dt) {
      for (let i = this.events.length - 1; i >= 0; i--) {
        const e = this.events[i]; e.t += dt;
        if (e.k === 'alarm' && !e.fired && e.t > 4 && this.mode !== 'guest') { e.fired = true; for (let j = 0; j < 12; j++) { const z = this.spawnOne('runner'); z.x = e.x + (this.rng() - 0.5) * 900; z.y = e.y < W.AH / 2 ? -40 : W.AH + 40; } this.spec.target += 12; }
        if (e.k === 'horde' && !e.fired && e.t > 2.5 && this.mode !== 'guest') { e.fired = true; for (let j = 0; j < e.n && this.z.length < 110; j++) this.spawnOne(); this.spec.target += e.n; }
        if (e.k === 'gas') { for (const b of this.b) if (!e.lit && d2(b.x, b.y, e.x, e.y) < e.r * e.r) { e.lit = true; this.boom(e.x, e.y, 260, 120 + 30 * this.wave, '#ffb02e', false); this.shake = 0.6; this.popup('KABOOM!', '#ffb02e', e.x, e.y - 60); } if (e.lit || e.t > 60) { this.events.splice(i, 1); continue; } }
        if (e.k === 'drop') { if (!e.landed && e.t > 7) { e.landed = true; this.shake = 0.3; } if (e.landed && d2(e.x, e.y, this.p.x, this.p.y) < 70 * 70) { const c = 40 + 6 * this.wave; this.cash += c; this.popup('SUPPLIES +$' + c, '#ffd23f', e.x, e.y - 80); const L = Object.keys(R().TIMED); this.applyPickup(L[Math.floor(this.rng() * L.length)]); if (this.rng() < 0.3) this.addWeapon(this.randomWeapon()); this.events.splice(i, 1); continue; } if (e.t > 60) { this.events.splice(i, 1); continue; } }
        if (e.k === 'cash' && e.t > e.end) { this.coins = this.coins.filter((c) => !c.hold); this.events.splice(i, 1); continue; }
        if ((e.k === 'alarm' || e.k === 'horde') && e.t > 8) this.events.splice(i, 1);
      }
    },
    randomWeapon() { const L = Object.keys(R().WEAPONS).filter((k) => k !== 'pistol'), w = { common: 6, rare: 3, epic: 1.5, legendary: 0.5 }; let tot = 0; for (const k of L) tot += w[R().WEAPONS[k].rar]; let r = this.rng() * tot; for (const k of L) { r -= w[R().WEAPONS[k].rar]; if (r <= 0) return k; } return L[0]; },
    // ---------------- the frame ----------------
    fightStep(dt, I) {
      fi(this); this.rateMul = 1; this.speedMul = 1;
      this.debuffStep(dt, I); this.timedStep(dt); this.weaponsStep(dt); this.zombieExtra(dt); this.eventStep(dt);
      if (this.truck && this.truck.t > 0) { this.truck.t -= dt; if (this.truck.t <= 0 && this.shopping) this.shopping = false; }
      // drops: weapons and crucible cores
      for (let i = this.drops.length - 1; i >= 0; i--) { const q = this.drops[i]; q.t += dt; if (d2(q.x, q.y, this.p.x, this.p.y - 20) < 60 * 60) { this.drops.splice(i, 1); if (q.k === 'core') { this.cores++; this.popup('CRUCIBLE CORE!', '#ff6a2a', q.x, q.y - 60); this.o.on('core', {}); } else { const id = this.randomWeapon(); this.addWeapon(id); } } else if (q.t > 45) this.drops.splice(i, 1); }
      // the raccoon fetches cash when there's nothing to bite
      if (this.raccoon && this.S.raccoon && this.coins.length && !this.nearestZ(this.raccoon.x, this.raccoon.y, 300)) { const c = this.coins[0], Rc = this.raccoon, d = Math.hypot(c.x - Rc.x, c.y - Rc.y); if (d < 20) { this.coins.shift(); this.cash += c.v; } else { Rc.x += ((c.x - Rc.x) / d) * 420 * dt; Rc.y += ((c.y - Rc.y) / d) * 420 * dt; Rc.face = c.x > Rc.x ? 1 : -1; Rc.moving = true; } }
      // flying turrets (combo) follow you
      if (this.combos.has('flyturret')) for (const T of this.turrets) { T.x += (this.p.x + 50 - T.x) * Math.min(1, dt * 2); T.y += (this.p.y + 20 - T.y) * Math.min(1, dt * 2); T.cd -= dt; }
      this._cc -= dt; if (this._cc <= 0) { this._cc = 0.5; this.comboCheck(); }
      if (this.evo) this.evoStep(dt);
    },
    // ---------------- shop extras: gun merchants, the crucible, the trader, items ----------------
    shopExtra(type) {
      fi(this); const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const St = this.stockOf(), rank = R().RANKS[type], out = [];
      const wline = (w, btn) => { const Wd = R().WEAPONS[w.id]; return `<div class="tz-good"><span class="tz-gi">${Wd.icon}</span><div><b>${esc(R().wname(w.id, w.tier))}</b><small>Lv ${w.lv}/10 · Tier ${w.tier}/3 · ${R().RARITY[Wd.rar].name}</small></div>${btn}</div>`; };
      const all = [this.gun, ...this.weapons];
      if (rank) {
        out.push(`<h3 class="tz-sh3">🛠️ Upgrades: Lv ${rank[0]} → ${rank[1]} here</h3>`);
        for (const w of all) { const ok = R().canUpgrade(type, w.lv), c = R().upgradeCost(w.id, w.lv, w.tier, this.wave); out.push(wline(w, ok ? `<button class="btn small ${this.cash >= c ? 'green' : 'ghost'}" data-up="${w.id}" ${this.cash < c ? 'disabled' : ''}>Lv ${w.lv + 1} · $${c}</button>` : `<small class="tz-why">${w.lv >= 10 ? 'Lv 10: evolve it at the crucible' : w.lv < rank[0] ? 'Too green for this shop' : 'Beyond this shop: Lv ' + rank[1] + '+'}</small>`)); }
      }
      if (type === 'forge') {
        out.push(`<h3 class="tz-sh3">🔥 Evolve a level-10 weapon · crucible cores: ${this.cores}</h3>`);
        for (const w of all) { const ok = R().canEvolve(w, this.cores); out.push(wline(w, ok ? `<button class="btn small green" data-evo="${w.id}">✨ Evolve → ${esc(R().wname(w.id, w.tier + 1))}</button>` : `<small class="tz-why">${w.tier >= 3 ? 'Fully evolved' : w.lv < 10 ? 'Needs Lv 10' : 'Needs a crucible core'}</small>`)); }
      }
      if (St && (St.weapons || []).length) { out.push('<h3 class="tz-sh3">🔫 Weapons for sale</h3>'); for (const id of St.weapons) { const Wd = R().WEAPONS[id], c = R().weaponCost(id, this.wave), sold = St.sold['w:' + id]; out.push(`<div class="tz-good ${sold ? 'sold' : ''}"><span class="tz-gi">${Wd.icon}</span><div><b style="color:${R().RARITY[Wd.rar].color}">${esc(Wd.names[0])}</b><small>${R().RARITY[Wd.rar].name} · fires by itself · ${this.weapons.length}/${R().SLOTS} slots</small></div><button class="btn small ${sold ? 'ghost' : this.cash >= c ? 'green' : 'ghost'}" data-wbuy="${id}" ${sold || this.cash < c ? 'disabled' : ''}>${sold ? 'Sold' : '$' + c}</button></div>`); } }
      if (St && (St.items || []).length) { out.push('<h3 class="tz-sh3">🎒 Items (they stay all run)</h3>'); for (const id of St.items) { const It = R().ITEMS[id], c = R().itemCost(id, this.wave), sold = St.sold['i:' + id], lk = St.locked && St.locked[id]; out.push(`<div class="tz-good ${sold ? 'sold' : ''}"><span class="tz-gi">${It.icon}</span><div><b style="color:${R().RARITY[It.rar].color}">${esc(It.name)}${this.items[id] ? ' ×' + this.items[id] : ''}</b><small>${esc(It.desc)}</small></div><button class="btn small ghost" data-lock="${id}" title="Keep it for your next visit">${lk ? '🔒' : '🔓'}</button><button class="btn small ${sold ? 'ghost' : this.cash >= c ? 'green' : 'ghost'}" data-ibuy="${id}" ${sold || this.cash < c ? 'disabled' : ''}>${sold ? 'Sold' : '$' + c}</button></div>`); }
        const rc = R().rerollCost(this.rerollsDone || 0); out.push(`<div class="tz-good"><span class="tz-gi">🎲</span><div><b>Reroll the shelf</b><small>New items (locked ones stay). The price doubles each time.</small></div><button class="btn small ${this.cash >= rc ? 'green' : 'ghost'}" data-reroll ${this.cash < rc ? 'disabled' : ''}>$${rc}</button></div>`); }
      if (type === 'clinic' && Object.keys(this.debuffs).length) out.push(`<div class="tz-good"><span class="tz-gi">🧼</span><div><b>Free check-up</b><small>Clears every debuff on you.</small></div><button class="btn small green" data-cleanse>Clean me</button></div>`);
      return out.join('');
    },
    shopBind(ov, refresh) {
      const St = this.stockOf();
      for (const b of ov.querySelectorAll('[data-up]')) b.onclick = (e) => { e.stopPropagation(); const r = this.upgrade(b.dataset.up, St.type); refresh(r.ok ? '' : r.error); };
      for (const b of ov.querySelectorAll('[data-evo]')) b.onclick = (e) => { e.stopPropagation(); const r = this.evolve(b.dataset.evo); if (r.ok) refresh(null, true); else refresh(r.error); };
      for (const b of ov.querySelectorAll('[data-wbuy]')) b.onclick = (e) => { e.stopPropagation(); const id = b.dataset.wbuy, c = R().weaponCost(id, this.wave); if (this.cash < c || St.sold['w:' + id]) return; if (this.weapons.length >= R().SLOTS && !this.weapons.some((w) => w.id === id)) return refresh('All weapon slots are full.'); this.cash -= c; St.sold['w:' + id] = 1; this.addWeapon(id); refresh(''); };
      for (const b of ov.querySelectorAll('[data-ibuy]')) b.onclick = (e) => { e.stopPropagation(); const r = this.buyItem(b.dataset.ibuy); refresh(r.ok ? '' : r.error); };
      for (const b of ov.querySelectorAll('[data-lock]')) b.onclick = (e) => { e.stopPropagation(); this.lockItem(b.dataset.lock); refresh(''); };
      const rr = ov.querySelector('[data-reroll]'); if (rr) rr.onclick = (e) => { e.stopPropagation(); const r = this.rerollShop(); refresh(r.ok ? '' : r.error); };
      const cl = ov.querySelector('[data-cleanse]'); if (cl) cl.onclick = (e) => { e.stopPropagation(); this.cleanse(); refresh(''); };
    },
    buyItem(id) { const St = this.stockOf(), It = R().ITEMS[id]; if (!St || !It || !(St.items || []).includes(id) || St.sold['i:' + id]) return { ok: false, error: 'Not for sale.' }; const c = R().itemCost(id, this.wave); if (this.cash < c) return { ok: false, error: 'Not enough cash.' }; this.cash -= c; St.sold['i:' + id] = 1; this.items[id] = (this.items[id] || 0) + 1; if (St.locked) delete St.locked[id]; this.stats(); this.o.on('item', { id }); return { ok: true }; },
    lockItem(id) { const St = this.stockOf(); if (!St || !(St.items || []).includes(id)) return false; St.locked = St.locked || {}; if (St.locked[id]) delete St.locked[id]; else St.locked[id] = 1; this.lockedItems = this.lockedItems || {}; this.lockedItems[St.type] = Object.keys(St.locked); return true; },
    rerollShop() { const St = this.stockOf(), c = R().rerollCost(this.rerollsDone || 0); if (!St) return { ok: false, error: 'No shop.' }; if (this.cash < c) return { ok: false, error: 'Not enough cash.' }; this.cash -= c; this.rerollsDone = (this.rerollsDone || 0) + 1; const keep = Object.keys(St.locked || {}).filter((id) => !St.sold['i:' + id]); St.items = keep.concat(this.pickItems(St.type, 3 - keep.length, keep)); for (const k of Object.keys(St.sold)) if (k.startsWith('i:') && !St.items.includes(k.slice(2))) delete St.sold[k]; return { ok: true }; },
    pickItems(type, n, not = []) { const L = Object.keys(R().ITEMS).filter((k) => !not.includes(k)), w = { common: 6, rare: 3, epic: 1.4, legendary: 0.5 }, out = []; for (let i = 0; i < n && L.length; i++) { let tot = 0; for (const k of L) tot += w[R().ITEMS[k].rar]; let r = this.rng() * tot, pick = L[0]; for (const k of L) { r -= w[R().ITEMS[k].rar]; if (r <= 0) { pick = k; break; } } out.push(pick); L.splice(L.indexOf(pick), 1); } return out; },
    // ---------------- drawing ----------------
    drawFightGround(g, t, vis) {
      for (const q of this.puddles) { if (!vis(q.x, q.y)) continue; g.globalAlpha = Math.min(1, (q.life - q.t)) * 0.75; g.fillStyle = '#4a7a2a'; g.beginPath(); g.ellipse(q.x, q.y, q.r, q.r * 0.55, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(190,255,110,0.35)'; g.beginPath(); g.ellipse(q.x - 10, q.y - 6, q.r * 0.4, q.r * 0.18, 0, 0, TAU); g.fill(); }
      for (const q of this.webs) { if (!vis(q.x, q.y)) continue; g.globalAlpha = 0.8; g.strokeStyle = 'rgba(240,240,240,0.8)'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; g.moveTo(q.x, q.y); g.lineTo(q.x + Math.cos(a) * q.r, q.y + Math.sin(a) * q.r * 0.6); } for (let k = 1; k <= 3; k++) { g.moveTo(q.x + q.r * k / 3, q.y); for (let i = 1; i <= 8; i++) { const a = (i * TAU) / 8; g.lineTo(q.x + Math.cos(a) * q.r * k / 3, q.y + Math.sin(a) * q.r * 0.6 * k / 3); } } g.stroke(); }
      g.globalAlpha = 1;
      for (const e of this.events) {
        if (e.k === 'gas' && !e.lit) { for (let i = 0; i < 4; i++) { const a = t * 0.6 + i * 1.6; g.fillStyle = 'rgba(150,200,60,0.22)'; g.beginPath(); g.arc(e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 26, e.r * 0.6, 0, TAU); g.fill(); } g.font = 'bold 22px "Lilita One", sans-serif'; g.textAlign = 'center'; g.fillStyle = '#d6ff5a'; g.fillText('☣️ shoot me', e.x, e.y - e.r - 6); }
        if (e.k === 'drop') { if (!e.landed) { const h = (7 - e.t) * 90; g.fillStyle = `rgba(255,60,40,${0.5 + 0.5 * Math.sin(t * 20)})`; g.beginPath(); g.arc(e.x, e.y, 10, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,90,60,0.25)'; g.beginPath(); g.arc(e.x, e.y, 40 + Math.sin(t * 8) * 6, 0, TAU); g.fill(); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(e.x, e.y, 30 * (1 - h / 700), 10, 0, 0, TAU); g.fill(); } else { window.TZA.box3(g, e.x - 30, e.y - 34, 60, 44, '#6b7a4a', 14, { ht: 30 }); g.fillStyle = '#fff'; g.font = '20px sans-serif'; g.textAlign = 'center'; g.fillText('📦', e.x, e.y - 50 + Math.sin(t * 4) * 4); } }
        if (e.k === 'alarm' && e.t < 8) { g.fillStyle = `rgba(255,40,40,${0.4 * (Math.sin(t * 16) > 0 ? 1 : 0)})`; g.beginPath(); g.arc(e.x, e.y, 60, 0, TAU); g.fill(); }
      }
      if (!this._iso) for (const q of this.drops) { const b = Math.sin(t * 4 + q.x) * 4; g.save(); g.translate(q.x, q.y - 16 + b); const gr = g.createRadialGradient(0, 0, 2, 0, 0, 46); gr.addColorStop(0, q.k === 'core' ? 'rgba(255,110,40,0.8)' : 'rgba(127,214,255,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 46, 0, TAU); g.fill(); g.font = '30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(q.k === 'core' ? '🔥' : '🎁', 0, 0); g.restore(); }
    },
    drawFightAir(g, t) {
      // auras on the special zombies, the timed weapons they carry, the stalkers' flicker
      if (!this._iso) for (const z of this.z) { // (the iso view draws these itself: trash-iso.js)
        if (z.hp <= 0) continue; const Z = W.ZOMBIES[z.type]; if (!Z) continue;
        if (Z.aura) { g.globalAlpha = 0.28 + 0.12 * Math.sin(t * 5 + z.id); g.fillStyle = Z.aura; g.beginPath(); g.ellipse(z.x, z.y - z.r * 1.2, z.r * 1.5, z.r * 1.8, 0, 0, TAU); g.fill(); g.globalAlpha = 1; g.font = `${Math.round(z.r * 0.9)}px sans-serif`; g.textAlign = 'center'; g.fillText(R().DEBUFFS[Z.debuff].icon, z.x, z.y - z.r * 3.1); }
        if (z.carry) { const T = R().TIMED[z.carry]; g.strokeStyle = T.color; g.lineWidth = 3; g.globalAlpha = 0.7 + 0.3 * Math.sin(t * 10); g.beginPath(); g.ellipse(z.x, z.y - z.r * 1.2, z.r * 1.2, z.r * 1.6, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; g.font = `${Math.round(z.r * 1.1)}px sans-serif`; g.textAlign = 'center'; g.fillText(T.icon, z.x + z.face * z.r * 1.1, z.y - z.r * 1.4); }
        if (Z.shield) { g.save(); g.translate(z.x + z.face * z.r * 0.9, z.y - z.r * 1.3); g.fillStyle = 'rgba(160,190,220,0.55)'; g.strokeStyle = '#2a3a4a'; g.lineWidth = 2; g.fillRect(-5, -z.r * 1.1, 10, z.r * 2.2); g.strokeRect(-5, -z.r * 1.1, 10, z.r * 2.2); g.restore(); }
        if (z.rageT > 0) { g.fillStyle = 'rgba(255,40,30,0.35)'; g.beginPath(); g.ellipse(z.x, z.y - z.r * 1.2, z.r * 1.3, z.r * 1.7, 0, 0, TAU); g.fill(); }
      }
      // weapons' moving parts
      for (const b of this.b) {
        if (!b.kind) continue;
        if (b.kind === 'nail') { g.strokeStyle = '#c9ccd1'; g.lineWidth = 2; g.beginPath(); g.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012); g.lineTo(b.x, b.y); g.stroke(); }
        else if (b.kind === 'bolt') { g.strokeStyle = '#8a6238'; g.lineWidth = 4; g.beginPath(); g.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); g.lineTo(b.x, b.y); g.stroke(); }
        else if (b.kind === 'hubcap') { window.TZA && drawCap(g, b.x, b.y, t * 20); }
        else if (b.kind === 'grenade' || b.kind === 'rocket') { g.fillStyle = b.kind === 'rocket' ? '#d9483a' : '#3a3f2a'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); if (b.kind === 'rocket' && this.fx.length < 210) this.fx.push({ k: 's', x: b.x, y: b.y, r: 6, t: 0, life: 0.4, a: 0.4, c: '#8a8580' }); }
        else if (b.kind === 'ray') { g.globalCompositeOperation = 'lighter'; g.strokeStyle = 'rgba(125,255,106,0.85)'; g.lineWidth = 7; g.beginPath(); g.moveTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03); g.lineTo(b.x, b.y); g.stroke(); g.globalCompositeOperation = 'source-over'; }
      }
      for (const f of this.fx) if (f.k === 'rail') { const u = f.t / f.life; g.globalAlpha = 1 - u; g.strokeStyle = f.c; g.lineWidth = 8 * (1 - u) + 1; g.beginPath(); g.moveTo(f.x, f.y); g.lineTo(f.x2, f.y2); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1; }
    },
    // the hero's extra weapons (small, around the hips) and the evolution cutscene
    drawOnYou(g, t) {
      if (!this._fi) return; const P = this.p;
      this.weapons.forEach((w, i) => {
        const Wd = R().WEAPONS[w.id], ang = w.a || 0, n = this.weapons.length, sa = Math.PI * (1.15 + (n > 1 ? (i / (n - 1)) * 0.7 : 0.35)), ox = P.x + Math.cos(sa) * 46, oy = P.y - 50 + Math.sin(sa) * 30 + Math.sin(t * 3 + i) * 3;
        if (Wd.kind === 'swing' || Wd.kind === 'saw') { g.save(); g.translate(P.x, P.y - 30); g.rotate(ang + (w.swing ? (1 - w.swing) * 2.4 - 1.2 : 0)); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(12, -2, Wd.range * 0.7, 8); g.fillStyle = w.tier >= 3 ? '#e0b030' : Wd.color; g.fillRect(10, -4, Wd.range * 0.7, 7); g.fillStyle = '#c9ccd1'; for (let k = 0; k < 4; k++) g.fillRect(20 + k * 12, -6, 3, 3); g.restore(); return; }
        g.save(); g.translate(ox, oy); if (Math.abs(ang) > Math.PI / 2) { g.rotate(ang); g.scale(0.55, -0.55); } else { g.rotate(ang); g.scale(0.55, 0.55); } drawWeaponIcon(g, w.id, w.tier); g.restore();
      });
      if (this.buffs.truck > 0 && !this.ride) { const A = window.TZA; g.save(); g.globalAlpha = 0.95; A.car(g, P.x - 90, P.y - 70, 180, 90, '#3d8a4a', false, { flip: P.face < 0 ? 1 : 0, r: W.rng(5) }); g.restore(); }
      if (this.evo) {
        const E = this.evo, u = E.t, lift = u < 0.8 ? u / 0.8 : u < 2.6 ? 1 : Math.max(0, 1 - (u - 2.6) / 0.8), gx = P.x, gy = P.y - 40 - lift * 90;
        // the golden beam from the sky, rotating rays, sparkles
        g.save(); g.globalCompositeOperation = 'lighter';
        const beam = g.createLinearGradient(0, gy - 500, 0, gy + 40); beam.addColorStop(0, 'rgba(255,220,120,0)'); beam.addColorStop(0.7, `rgba(255,214,100,${0.45 * lift})`); beam.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = beam; g.fillRect(gx - 60, gy - 500, 120, 540);
        g.translate(gx, gy); g.rotate(u * 1.5); for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.fillStyle = `rgba(255,210,90,${0.25 * lift})`; g.beginPath(); g.moveTo(0, 0); g.lineTo(140 * lift, -10); g.lineTo(140 * lift, 10); g.closePath(); g.fill(); }
        g.restore(); g.save(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 14; i++) { const a = i * 2.2 + u * 3, rr = 30 + ((u * 60 + i * 13) % 70); g.fillStyle = `rgba(255,245,200,${lift * (0.5 + 0.5 * Math.sin(u * 12 + i))})`; g.beginPath(); g.arc(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr * 0.7, 2.5, 0, TAU); g.fill(); }
        g.restore();
        // the weapon itself, turning over in the light (new look after the flash)
        const tier = E.done ? E.to : E.from; g.save(); g.translate(gx, gy); g.rotate(Math.sin(u * 3) * 0.3); g.scale(2.8, 2.8); drawWeaponIcon(g, E.id, tier); g.restore();
        g.font = 'bold 26px "Lilita One", sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = 'rgba(20,12,4,0.9)'; const nm = R().wname(E.id, tier); g.strokeText(nm, gx, gy - 70); g.fillStyle = E.done ? '#ffd23f' : '#fff'; g.fillText(nm, gx, gy - 70);
        if (u > 1.5 && u < 1.9) { g.fillStyle = `rgba(255,250,230,${1 - Math.abs(u - 1.7) / 0.2})`; g.beginPath(); g.arc(gx, gy, 70, 0, TAU); g.fill(); }
      }
    },
  });
  function drawCap(g, x, y, a) { g.save(); g.translate(x, y); g.rotate(a); const gr = g.createRadialGradient(-4, -4, 1, 0, 0, 13); gr.addColorStop(0, '#f2f4f6'); gr.addColorStop(1, '#6a737c'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 13, 0, TAU); g.fill(); g.fillStyle = '#4a525a'; for (let i = 0; i < 5; i++) { g.rotate(TAU / 5); g.fillRect(3, -1.5, 8, 3); } g.restore(); }
  // a weapon drawn big (evolution, HUD): its tier changes the finish (steel, chrome, gold)
  function drawWeaponIcon(g, id, tier) {
    const Wd = R().WEAPONS[id] || R().WEAPONS.pistol, fin = tier >= 3 ? ['#fff2b0', '#e0b030', '#8a6010'] : tier === 2 ? ['#e8f4ff', '#8ab0d0', '#3a5a7a'] : ['#c9ccd1', '#6f767d', '#2a2e33'];
    const gr = g.createLinearGradient(0, -8, 0, 8); gr.addColorStop(0, fin[0]); gr.addColorStop(0.5, fin[1]); gr.addColorStop(1, fin[2]);
    g.fillStyle = gr; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.5;
    const L = { spread: 46, rattle: 38, nail: 34, swing: 50, bolt: 44, cone: 40, push: 44, boomer: 0, lob: 40, zap: 34, saw: 50, rail: 56, pistol: 34 }[Wd.kind] || 36;
    if (Wd.kind === 'boomer') { g.beginPath(); g.arc(0, 0, 16, 0, TAU); g.fill(); g.stroke(); }
    else { g.beginPath(); g.rect(-L / 2, -6, L, 12); g.fill(); g.stroke(); g.beginPath(); g.rect(-L / 2 + 4, 4, 10, 14); g.fill(); g.stroke(); if (Wd.kind === 'zap' || tier >= 2) { g.fillStyle = tier >= 3 ? '#fff6c0' : Wd.color; g.fillRect(L / 2 - 10, -3, 8, 6); } }
    if (tier >= 3) { g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,220,120,0.35)'; g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill(); g.globalCompositeOperation = 'source-over'; }
  }
  window.TZFight = { drawWeaponIcon };
})();
