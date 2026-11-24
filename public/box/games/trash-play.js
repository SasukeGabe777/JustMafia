'use strict';
// TrashZombies on the phone, part 2 (extends TZSim.Sim): the score and kill streak, cash, the
// specialised places (market, surplus, clinic, the gun merchants, the crucible) and their shops,
// the pocket item, bomb charges and turret kits, going down and getting revived (Regular co-op),
// boss maps and hidden stashes. Uses TZW, TZP (trash-shop.js) and TZSim.
(function () {
  const W = window.TZW, P = () => window.TZP, TAU = Math.PI * 2;
  const Sim = window.TZSim.Sim, proto = Sim.prototype;
  const d2 = (a, b, x, y) => (a - x) * (a - x) + (b - y) * (b - y);
  const DOWN_S = 25, REVIVE_S = 2;
  function pl(s) {
    if (s._pl) return s; s._pl = true;
    const R = (s.o && s.o.restore) || {};
    Object.assign(s, { score: R.score || 0, combo: 0, comboT: 0, mult: 1, cash: R.cash || 0, coins: [], pocket: null, bombs: 0, kits: 0, turrets: [], plates: 0, stocks: {}, multi: { n: 0, t: -9 }, hitWave: false, mapItem: null, mapTaken: {}, rerolls: 0, heals: [], bought: {}, stashAsked: {}, camper: null, down: null });
    s.gear = s.gear || { mhp: 0, vest: 0, torch: 0 };
    return s;
  }
  Object.assign(proto, {
    // ---------------- score ----------------
    onKill(z, by, mine) {
      pl(this); if (!mine) return;
      const pts = P().points(z.type, z.elite) * this.mult;
      this.score += pts; this.combo++; this.comboT = 3.2; this.mult = P().mult(this.combo);
      if (this.t - this.multi.t < 0.35) this.multi.n++; else this.multi.n = 1; this.multi.t = this.t;
      if (this.multi.n >= 3) { const b = P().BONUS.multi * this.multi.n; this.score += b; this.popup('MULTI ×' + this.multi.n + '  +' + b, '#ffb02e', z.x, z.y - 90); if (this.multi.n >= 5 && this.slowMo) this.slowMo(0.6); }
      else if (z.boss || z.elite || pts >= 100) this.popup('+' + pts, '#ffe066', z.x, z.y - 80);
      // cash: coins on the ground when you're alone, straight into your pocket in co-op
      const v = 1 + Math.floor(this.wave / 4) + (z.elite ? 3 : 0), n = z.fb ? 25 : z.boss ? 10 : this.rng() < 0.4 * (this.cashMul || 1) ? 1 : 0;
      if (!n) return;
      if (this.mode === 'solo' && !z.remote) for (let i = 0; i < n; i++) { if (this.coins.length > 80) this.coins.shift(); this.coins.push({ x: z.x + (this.rng() - 0.5) * 30, y: z.y + (this.rng() - 0.5) * 20, v, t: 0 }); }
      else this.cash += n * v;
    },
    onHurt(dmg) { pl(this); if (dmg > 0) { if (this.mult > 1) this.popup('STREAK LOST', '#ff6a5a', this.p.x, this.p.y - 110); this.combo = 0; this.mult = 1; this.hitWave = true; } },
    onClear() {
      pl(this); const b = P().BONUS.clear * this.wave, f = this.hitWave ? 0 : P().BONUS.flawless * this.wave;
      this.score += b + f; this.popup('WAVE CLEAR +' + b, '#7dff6a', this.p.x, this.p.y - 120); if (f) this.popup('NO DAMAGE +' + f, '#5affc8', this.p.x, this.p.y - 150);
      this.hitWave = false;
      if (!this.placeType() && this.wave % 4 === 0 && !this.isDoorCell()) { this.camper = this.cellKey(); this.o.on('camper', {}); }
      if (this.stashHere()) this.claimStash();
    },
    popup(text, c, x, y) { if (this.fx.length < 200) this.fx.push({ k: 'txt', x, y, text, t: 0, life: 1.2, c, size: 24 }); },
    // ---------------- going down (Regular co-op): a teammate can pick you back up ----------------
    goDown() {
      pl(this); if (!this.story || !(this.o.mates && this.o.mates() > 0)) return false;
      this.down = { t: DOWN_S }; this.p.hp = 0; this.cards = null; this.choosing = false; this.shopping = false; this.o.on('downed', {});
      this.o.report({ op: 'ev', k: 'downed' }).then((r) => { if (this.down && r && r.ok === false) { this.down = null; this.die(); } });
      this.reportStatus(true); return true;
    },
    downStep(dt) { this.down.t -= dt; this.buffStep(dt); if (this.down.t <= 0) { this.down = null; this.die(); } },
    getUp() { this.down = null; this.p.hp = this.S.mhp * 0.4; this.p.inv = 2.5; this.banner = { text: 'BACK UP!', sub: 'A friend pulled you up', t: 2 }; this.o.on('revived', {}); this.reportStatus(true); },
    // ---------------- the place in this block ----------------
    placeType() { if (this.isDoorCell()) return null; const t = P().placeAt(this.seed, this.cell[0], this.cell[1], this.homes); return t || (this.camper === this.cellKey() ? 'camper' : null); },
    shopDoor() { const S = this.area.spot; return S ? { x: S.x + S.w / 2, y: S.y + S.h + 26 } : null; },
    // where the find crate stands: in front of the place if there is one
    spotXY() { const D = this.area.spot || { x: W.AW / 2 - 150, y: 0, w: 300, h: 170 }; return P() && this.placeType() ? { x: D.x - 10, y: D.y + D.h + 60 } : { x: D.x + D.w / 2, y: D.y + D.h / 2 + 10 }; },
    stockOf() {
      const type = this.placeType(); if (!type) return null; const k = this.cellKey() + ':' + type;
      let S = this.stocks[k]; if (!S || S.wave !== this.wave) S = this.stocks[k] = { wave: this.wave, type, list: P().stock(this.rng, type, this.wave), sold: {} };
      return S;
    },
    priceOf(id) { return P().price(id, this.wave, this.bought[id] || 0); },
    buy(id, arg) {
      pl(this); const St = this.stockOf(), G = P().GOODS[id]; if (!St || !G || !St.list.includes(id) || St.sold[id]) return { ok: false, error: 'Not for sale.' };
      const cost = this.priceOf(id); if (this.cash < cost) return { ok: false, error: 'Not enough cash.' };
      const Pp = this.p;
      switch (G.kind) {
        case 'food': this.heals.push({ left: G.heal, rate: G.heal / (G.heal > 50 ? 8 : 5) }); break;
        case 'buff': this.buffs[G.buff] = Math.max(this.buffs[G.buff] || 0, G.dur); break;
        case 'xp': this.gainXp(W.xpNeed(this.lvl) * 0.85); break;
        case 'reroll': this.rerolls++; break;
        case 'ability': { if (!W.AB[arg]) return { ok: false, error: 'Pick an ability.' }; this.ab[arg] = (this.ab[arg] || 0) + 1; this.stats(); if (arg === 'life') Pp.lives++; this.o.report({ op: 'ev', k: 'pick', id: arg }); break; }
        case 'pocket': { const L = W.PICKUPS.filter((q) => q.id !== 'snack'); this.pocket = L[Math.floor(this.rng() * L.length)].id; break; }
        case 'plates': this.plates += G.n; break;
        case 'mhp': this.gear.mhp += G.n; this.stats(); Pp.hp = Math.min(this.S.mhp, Pp.hp + G.n); break;
        case 'vest': this.gear.vest++; this.stats(); break;
        case 'bomb': this.bombs++; break;
        case 'turretkit': this.kits++; break;
        case 'torch': this.gear.torch++; this.stats(); break;
        case 'full': Pp.hp = this.S.mhp; break;
        case 'life': Pp.lives++; break;
        case 'heal': Pp.hp = Math.min(this.S.mhp, Pp.hp + G.n); break;
        default: return { ok: false, error: 'Not for sale.' };
      }
      this.cash -= cost; St.sold[id] = 1; this.bought[id] = (this.bought[id] || 0) + 1; this.o.on('buy', { id });
      this.o.report({ op: 'ev', k: 'buy', id, place: St.type });
      this.reportStatus(true); return { ok: true };
    },
    reroll() { pl(this); if (!this.rerolls || !this.cards) return false; this.rerolls--; this.cards = W.offer(this.rng, this.ab); return true; },
    // ---------------- the buttons ----------------
    usePocket() { pl(this); if (!this.pocket || this.dead || this.down) return false; const k = this.pocket; this.pocket = null; this.applyPickup(k); return true; },
    useBomb() {
      pl(this); if (!this.bombs || this.dead || this.down) return false; this.bombs--;
      this.flash = -0.6; this.shake = 0.7; this.fx.push({ k: 'ring', x: this.p.x, y: this.p.y - 20, r: 20, R: 760, t: 0, life: 0.6, c: '#ffb02e' });
      const dmg = 600 + 60 * this.wave;
      if (this.mode === 'guest') { for (const z of this.z) if (d2(z.x, z.y, this.p.x, this.p.y) < 760 * 760) this.damageZ(z, z.boss ? z.mhp * 0.15 : dmg, this.me.id); }
      else for (const z of this.z) if (z.hp > 0 && d2(z.x, z.y, this.p.x, this.p.y) < 760 * 760) this.damageZ(z, z.boss ? z.mhp * 0.15 : dmg, this.me.id, 0, 0);
      this.o.on('bomb', { big: true }); return true;
    },
    useTurret() { pl(this); if (!this.kits || this.dead || this.down) return false; this.kits--; this.turrets.push({ x: this.p.x + this.p.face * 40, y: this.p.y + 10, life: 30, cd: 0, a: 0 }); this.o.on('turret', {}); return true; },
    // ---------------- maps and stashes ----------------
    dropMap(x, y) { pl(this); if (this.wave % 5 !== 0 || this.mapTaken[this.wave] || this.mapItem) return; this.mapItem = { x: Math.max(80, Math.min(W.AW - 80, x)), y: Math.max(80, Math.min(W.AH - 80, y)), wave: this.wave }; },
    stashHere() { const L = (this.o.stashes && this.o.stashes()) || []; return L.includes(this.cellKey()) && !this.stashAsked[this.cellKey()]; },
    claimStash() { const k = this.cellKey(); this.stashAsked[k] = 1; this.o.report({ op: 'stash' }).then((r) => { if (r && r.ok) { this.cash += r.cash; this.popup('STASH +$' + r.cash, '#ffd23f', this.p.x, this.p.y - 120); this.o.on('stash', r); } }); },
    // ---------------- the frame ----------------
    playStep(dt, I) {
      pl(this); const Pp = this.p;
      if (this._plArea !== this.area) { this._plArea = this.area; const S = this.area.spot; if (S && this.placeType() && !this.isDoorCell()) this.area.obstacles.push({ x: S.x, y: S.y, w: S.w, h: S.h - 20, kind: 'none' }); this.coins.length = 0; this.turrets.length = 0; this.mapItem = null; }
      if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.combo = 0; this.mult = 1; } }
      // coins: pulled in like the XP gems
      const R = this.S.magnet;
      for (let i = this.coins.length - 1; i >= 0; i--) { const c = this.coins[i]; c.t += dt; const dd = Math.hypot(Pp.x - c.x, Pp.y - 20 - c.y); if (dd < R || this.cleared) { const sp = 320 + (R - Math.min(dd, R)) * 6 + (this.cleared ? 500 : 0); c.x += ((Pp.x - c.x) / (dd || 1)) * sp * dt; c.y += ((Pp.y - 20 - c.y) / (dd || 1)) * sp * dt; } if (dd < 28) { this.coins.splice(i, 1); this.cash += c.v; this.o.on('coin', {}); } else if (c.t > 40) this.coins.splice(i, 1); }
      // food heals over time
      for (let i = this.heals.length - 1; i >= 0; i--) { const h = this.heals[i], a = Math.min(h.left, h.rate * dt); h.left -= a; Pp.hp = Math.min(this.S.mhp, Pp.hp + a); if (h.left <= 0.01) this.heals.splice(i, 1); }
      // turrets
      for (let i = this.turrets.length - 1; i >= 0; i--) { const T = this.turrets[i]; T.life -= dt; T.cd -= dt; if (T.life <= 0) { this.turrets.splice(i, 1); continue; } const z = this.nearestZ(T.x, T.y - 30, 520); if (z) { T.a = Math.atan2(z.y - z.r - (T.y - 30), z.x - T.x); if (T.cd <= 0) { T.cd = 0.28; this.b.push({ x: T.x + Math.cos(T.a) * 24, y: T.y - 30 + Math.sin(T.a) * 24, vx: Math.cos(T.a) * 950, vy: Math.sin(T.a) * 950, r: 4, dmg: this.S.dmg * 0.9, crit: false, pierce: 0, bounce: 0, life: 0.6, hit: null, burn: 0, drone: true }); if (this.mode !== 'solo') this.shots.push([Math.round(T.x), Math.round(T.y - 30), Math.round(T.a * 100) / 100]); } } }
      // the boss map: walk over it to read it
      if (this.mapItem && d2(this.mapItem.x, this.mapItem.y, Pp.x, Pp.y - 20) < 60 * 60) {
        const M = this.mapItem; this.mapItem = null; this.mapTaken[M.wave] = 1;
        this.o.report({ op: 'ev', k: 'mapgot', wave: M.wave }).then((r) => { if (r && r.ok) this.o.on('maps', { options: r.options || [] }); });
      }
      // stand by a fallen friend to pull them up
      for (const o of this.others.values()) {
        if (o.down && !this.dead && d2(o.x, o.y, Pp.x, Pp.y) < 95 * 95) { o.rev = (o.rev || 0) + dt / REVIVE_S; if (o.rev >= 1 && !o.revAsked) { o.revAsked = true; this.o.report({ op: 'revive', id: o.id }).then((r) => { o.revAsked = false; if (r && r.ok) { o.down = false; o.rev = 0; this.popup('REVIVED!', '#7dff6a', o.x, o.y - 100); this.score += 300; } }); } }
        else if (o.rev) o.rev = Math.max(0, o.rev - dt);
      }
      // by the shop door (once the wave is cleared)
      const D = this.cleared && this.placeType() && this.shopDoor();
      this.nearShop = !!(D && d2(D.x, D.y, Pp.x, Pp.y) < 130 * 130);
      if (!this.nearShop && this.shopping) this.shopping = false;
    },
    // ---------------- drawing (called by TZSim.render) ----------------
    drawExtraGround(g, t, vis) {
      pl(this);
      for (const c of this.coins) { if (!vis(c.x, c.y)) continue; const s = Math.abs(Math.sin(c.t * 5)); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(c.x + 3, c.y + 4, 7, 3, 0, 0, TAU); g.fill(); g.fillStyle = '#e8b830'; g.beginPath(); g.ellipse(c.x, c.y - 4, 7 * (0.3 + 0.7 * s), 7, 0, 0, TAU); g.fill(); g.fillStyle = '#fff2a8'; g.beginPath(); g.ellipse(c.x - 1, c.y - 6, 2 * s, 2.5, 0, 0, TAU); g.fill(); }
      if (this.mapItem) { const M = this.mapItem, b = Math.sin(t * 4) * 4; g.save(); g.translate(M.x, M.y - 14 + b); const gr = g.createRadialGradient(0, 0, 4, 0, 0, 50); gr.addColorStop(0, 'rgba(255,220,120,0.7)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.fill(); g.rotate(-0.2); g.fillStyle = '#d9c08a'; g.fillRect(-20, -14, 40, 28); g.fillStyle = '#b89a5a'; g.fillRect(-24, -16, 6, 32); g.fillRect(18, -16, 6, 32); g.strokeStyle = '#8a2a22'; g.lineWidth = 2; g.beginPath(); g.moveTo(-12, -6); g.lineTo(0, 4); g.lineTo(10, -4); g.stroke(); g.fillStyle = '#8a2a22'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText('✕', 10, -2); g.restore(); }
    },
    extraStanding(list) {
      pl(this); const type = this.placeType(), S = this.area.spot;
      if (type && S) list.push(this._placeE && this._placeE.type === type && this._placeE.S === S ? this._placeE : (this._placeE = { type, S, y: S.y + S.h - 20, draw: (g, t) => drawPlace(g, type, S, t, this.cleared) }));
      for (const T of this.turrets) list.push(T._e || (T._e = { y: T.y, draw: (g, t) => drawTurret(g, T, t) }));
    },
    lightHoles(hole) { pl(this); const S = this.area.spot; if (S && this.placeType()) hole(S.x + S.w / 2, S.y + S.h + 20, 240, 0.8); for (const T of this.turrets) hole(T.x, T.y - 20, 110, 0.5); },
  });
  // A place's front: a little shop building with its sign (open once the wave is cleared).
  const LOOK = { market: ['#a8563a', '#e0a030', 'CORNER MARKET'], armor: ['#5a6a4a', '#9ab06a', 'ARMY SURPLUS'], clinic: ['#d8d4cc', '#e8483a', 'FREE CLINIC'], tinker: ['#6a5a4a', '#c9a43a', 'TINKERER'], gunsmith: ['#3a3f46', '#c9ccd1', 'GUNSMITH'], master: ['#2a2420', '#ffd23f', 'MASTER ARMORER'], forge: ['#3a2a22', '#ff6a2a', 'THE CRUCIBLE'], camper: ['#c9d4dc', '#3a7ab5', 'CAMPER'] };
  function drawPlace(g, type, S, t, open) {
    const A = window.TZA, [wall, accent, sign] = LOOK[type] || LOOK.market, Pl = P().PLACES[type], x = S.x, y = S.y, w = S.w, h = S.h;
    g.save();
    if (type === 'camper') {
      A.car(g, x + 20, y + 40, w - 40, h - 70, '#c9d4dc', false, { blur: false, r: W.rng(3) });
      g.fillStyle = '#3a7ab5'; g.fillRect(x + 40, y + 70, w - 80, 10);
    } else {
      A.box3(g, x, y, w, h - 10, wall, 70, { ht: 80 });
      // roof edge, the awning, the door, windows
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + 8, y + 8, w - 16, h - 96);
      const ay = y + h - 84; for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? accent : '#efe6d4'; g.beginPath(); g.moveTo(x + 10 + i * (w - 20) / 10, ay); g.lineTo(x + 10 + (i + 1) * (w - 20) / 10, ay); g.lineTo(x + 10 + (i + 1) * (w - 20) / 10 + 4, ay + 18); g.lineTo(x + 10 + i * (w - 20) / 10 + 4, ay + 18); g.closePath(); g.fill(); }
      g.fillStyle = open ? '#3a2e22' : '#1c1814'; g.fillRect(x + w / 2 - 22, y + h - 62, 44, 52);
      if (open) { const gr = g.createLinearGradient(0, y + h - 62, 0, y + h - 10); gr.addColorStop(0, 'rgba(255,220,150,0.7)'); gr.addColorStop(1, 'rgba(255,220,150,0.1)'); g.fillStyle = gr; g.fillRect(x + w / 2 - 22, y + h - 62, 44, 52); }
      for (const wx of [x + 22, x + w - 82]) { g.fillStyle = open ? 'rgba(255,214,140,0.65)' : '#20262c'; g.fillRect(wx, y + h - 60, 60, 34); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(wx, y + h - 60, 60, 34); }
      if (type === 'forge') { g.fillStyle = `rgba(255,${120 + Math.sin(t * 6) * 40},40,0.6)`; g.beginPath(); g.arc(x + w * 0.75, y + 40, 22, 0, TAU); g.fill(); }
      if (type === 'clinic') { g.fillStyle = '#e8483a'; g.fillRect(x + w / 2 - 8, y + 24, 16, 46); g.fillRect(x + w / 2 - 23, y + 39, 46, 16); }
    }
    // the sign
    g.font = 'bold 22px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lab = Pl.icon + ' ' + sign, sy = y + h + 8; g.lineWidth = 5; g.strokeStyle = 'rgba(15,10,6,0.9)'; g.strokeText(lab, x + w / 2, sy); g.fillStyle = accent; g.fillText(lab, x + w / 2, sy);
    g.font = 'bold 15px "Lilita One", sans-serif'; const st = open ? '🛒 OPEN: walk up' : '🔒 clear the wave to shop'; g.strokeText(st, x + w / 2, sy + 22); g.fillStyle = open ? '#9cff5a' : '#ffd23f'; g.fillText(st, x + w / 2, sy + 22);
    g.restore();
  }
  function drawTurret(g, T, t) {
    g.save(); g.translate(T.x, T.y); g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(6, 2, 22, 7, 0, 0, TAU); g.fill();
    g.fillStyle = '#4a4f56'; g.fillRect(-4, -26, 8, 26); g.fillStyle = '#6b7178'; g.beginPath(); g.ellipse(0, -2, 18, 6, 0, 0, TAU); g.fill();
    g.translate(0, -30); g.rotate(T.a); g.fillStyle = '#7a8088'; g.fillRect(-10, -8, 22, 16); g.fillStyle = '#2a2e33'; g.fillRect(10, -3, 18, 6); g.restore();
    if (T.life < 5 && Math.sin(t * 12) > 0) { g.fillStyle = '#ff4a3a'; g.beginPath(); g.arc(T.x, T.y - 44, 3, 0, TAU); g.fill(); }
  }
  window.TZPlay = { drawPlace, drawTurret, DOWN_S, REVIVE_S };
})();
