'use strict';
// JustZombies on the phone, part 5 (extends TZSim.Sim; after trash-more.js): area locks and chests.
//   Locked gates (every mode): the town opens up as the team racks up zombie kills (trash-story.js
//   locks(); the server sends { req, kind, kills } every update). A locked road shows its gate with
//   "🔒 120 / 200 kills". Special blocks (the boss lair, key vaults, the master shops, zombie dens,
//   loot stashes) are harder inside: a bigger, tougher wave with more elites, and a boss in a den.
//   Chests: the story's finds (the key pieces above all) and the loot chests of loot stashes and dens
//   sit in a chest you open by hand once the area is clear (the OPEN button, F, or click it): the lid
//   creaks open, the find rises out of it, and there is a little loot too.
// All art here is drawn in code (original).
(function () {
  const W = window.TZW, TAU = Math.PI * 2, proto = window.TZSim.Sim.prototype, N = W.GRID;
  const TS = () => window.TZS;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const HARD = { target: 1.5, hp: 1.3, dmg: 1.15, every: 0.75, cap: 12, elite: 150 }; // elite: per 1000 (normally 25)
  const NAMES = { lair: 'The Boss Lair', key: 'A Key Vault', shop: 'A Master Shop', den: 'A Zombie Den', vault: 'A Loot Stash', crater: 'The Volcano Crater', fortress: 'The Frozen Fortress', '?': 'A Special Area' };
  const ICONS = { lair: '☠️', key: '🗝️', shop: '⚜️', den: '🧟', vault: '💎', crater: '🌋', fortress: '🏰', '?': '⭐' };
  const DENLIKE = { den: 1, crater: 1, fortress: 1 }; // a boss, a horde and a loot chest live here

  // ---------------- the locks from the server ----------------
  proto.setLocks = function (L) {
    if (!L || !Array.isArray(L.req)) return;
    const was = this.locks; this.locks = L;
    if (was && this.area && this.phase === 'play') { // a gate out of this block just opened
      for (const d of ['n', 's', 'w', 'e']) { if (!this.area.exits[d]) continue; const x = this.cell[0] + W.DIRS[d][0], y = this.cell[1] + W.DIRS[d][1]; if (!W.inGrid(x, y)) continue; const i = y * N + x; if (was.req[i] > (was.kills || 0) && !(L.req[i] > (L.kills || 0))) { this.banner = { text: '🔓 GATE OPEN!', sub: 'The team has the kills: a new road is open', t: 3 }; this.o.on('unlock', {}); break; } }
    }
    const k = this.areaKind(); if (k && k !== this.hard && this.spec && !this.cleared) this.makeHard(k, true); // (what it is shows up once we're in)
  };
  const baseWorld = proto.setWorld;
  proto.setWorld = function (v) {
    if (baseWorld) baseWorld.call(this, v); if (!v) return;
    if (v.locks) this.setLocks(v.locks);
    if (Array.isArray(v.chests)) { const s = this.chestDone || (this.chestDone = new Set()); for (const k of v.chests) s.add(k); }
  };
  proto.areaKind = function (c) { const L = this.locks; c = c || this.cell; return L && L.kind ? L.kind[c[1] * N + c[0]] || null : null; };
  // the gate into a neighbour: null when it's open, else { have, need, kind }
  proto.gateInfo = function (dir) {
    const L = this.locks; if (!L || !L.req) return null;
    const d = W.DIRS[dir], x = this.cell[0] + d[0], y = this.cell[1] + d[1]; if (!W.inGrid(x, y)) return null;
    const i = y * N + x, need = L.req[i] || 0, have = L.kills || 0; if (!need || have >= need) return null;
    return { have, need, kind: L.kind ? L.kind[i] : null };
  };
  proto.gateLeft = function (dir) { const G = this.gateInfo(dir); return G ? Math.max(1, G.need - G.have) : 0; };
  // the nearest locked gate (for the HUD): one out of this block first, else the cheapest anywhere
  proto.nextGate = function () {
    const L = this.locks; if (!L || !L.req) return null; let best = null;
    for (const d of ['n', 's', 'w', 'e']) { if (!this.area.exits[d]) continue; const G = this.gateInfo(d); if (G && (!best || G.need < best.need)) best = G; }
    if (best) return { ...best, here: true };
    for (let i = 0; i < L.req.length; i++) if (L.req[i] > (L.kills || 0) && (!best || L.req[i] < best.need)) best = { have: L.kills || 0, need: L.req[i], kind: L.kind ? L.kind[i] : null };
    return best;
  };

  // ---------------- special blocks are harder ----------------
  proto.makeHard = function (k, late) {
    const sp = this.spec; if (!sp || this.build) return;
    const again = !!this.hard; this.hard = k; // (a '?' that turns out to be a den: only the den part is new)
    if (!again) { sp.target = Math.round(sp.target * HARD.target); sp.hpMul *= HARD.hp; sp.dmgMul *= HARD.dmg; sp.every *= HARD.every; sp.cap = Math.min(90, sp.cap + HARD.cap); }
    if (DENLIKE[k] && this.mode !== 'guest' && !this.bossSpawned) { sp.boss = true; this.bossDue = true; }
    this.banner = { text: (ICONS[k] || '⭐') + ' ' + (NAMES[k] || NAMES['?']).toUpperCase(), sub: k === 'crater' ? 'The volcano crater: lava, fire zombies and a boss' : k === 'fortress' ? 'The frozen fortress: ice, frozen zombies and a boss' : k === 'den' ? 'A zombie den: a boss and a horde live here' : 'A special area: more, tougher zombies (and elites)', t: 3 };
    if (DENLIKE[k] && this.startEvent && this.mode !== 'guest' && !late) this.startEvent('horde');
    for (const z of this.z) if (!z.hardDone) { z.hardDone = true; this.hardZ(z); }
  };
  proto.hardZ = function (z) {
    if (z.boss || z.elite || W.ZOMBIES[z.type].nest) return;
    if (this.wave >= 3 && W.hash(this.seed, this.cell[0], this.cell[1], z.id, 'hard') % 1000 < HARD.elite) { z.elite = ['#ffd23f', '#7fd6ff', '#ff5a8a'][z.id % 3]; z.hp *= 3; z.mhp *= 3; z.dmg *= 1.5; z.xp *= 3; }
  };
  const baseStart = proto.startWave;
  proto.startWave = function () { baseStart.call(this); this.hard = null; const k = this.areaKind(); if (k) this.makeHard(k, false); };
  const baseMakeZ = proto.makeZ;
  proto.makeZ = function (type, x, y) { const z = baseMakeZ.call(this, type, x, y); if (this.hard) { z.hardDone = true; this.hardZ(z); } return z; };

  // ---------------- chests ----------------
  // where the chest of this block stands (by the landmark; beside a shop when there's a shop here)
  proto.chestSpot = function () {
    const S = this.area.spot || { x: W.AW / 2 - 150, y: 0, w: 300, h: 170 }, P = window.TZP;
    if (!(P && P.placeAt(this.seed, this.cell[0], this.cell[1], this.homes))) return { x: S.x + S.w / 2, y: S.y + S.h / 2 + 10 }; // on the landmark
    // a shop stands on the landmark: the chest goes beside it, somewhere clear
    const cx = S.x + S.w / 2, by = S.y + S.h, side = cx > W.AW / 2 ? -1 : 1, obs = this.area.obstacles;
    const C = [[cx + side * (S.w / 2 + 120), by + 30], [cx - side * (S.w / 2 + 120), by + 30], [cx + side * 220, by + 150], [cx - side * 220, by + 150], [cx, by + 190], [cx + side * (S.w / 2 + 120), by - 60]];
    const ok = ([x, y]) => x > 120 && x < W.AW - 120 && y > 150 && y < W.AH - 70 && !obs.some((o) => x > o.x - 60 && x < o.x + o.w + 60 && y > o.y - 30 && y < o.y + o.h + 90) && !(x > S.x - 50 && x < S.x + S.w + 50 && y > S.y - 30 && y < S.y + S.h + 60);
    const c = C.find(ok) || C[0]; return { x: clamp(c[0], 140, W.AW - 140), y: clamp(c[1], 160, W.AH - 90) };
  };
  // no trader or camper parks on top of a chest (they'd park on the landmark)
  const baseClear = proto.onClear;
  proto.onClear = function () {
    if (!this.chestHere()) return baseClear.call(this);
    const own = Object.prototype.hasOwnProperty.call(this, 'placeType'), keep = this.placeType;
    this.placeType = function () { return keep.call(this) || 'chest'; };
    try { return baseClear.call(this); } finally { if (own) this.placeType = keep; else delete this.placeType; }
  };
  // the unopened chest in this block, if any: { kind: 'find' | 'loot', id, x, y }
  proto.chestHere = function () {
    if (!this.area || this.area.garage || this.isDoorCell()) return null;
    const k = this.cellKey(), fid = this.findHere && this.findHere(), sp = this._chestAt && this._chestAt.k === k ? this._chestAt : (this._chestAt = { k, ...this.chestSpot() });
    if (fid) return { kind: 'find', id: fid, x: sp.x, y: sp.y };
    const ak = this.areaKind(); if ((ak === 'vault' || DENLIKE[ak]) && !(this.chestDone && this.chestDone.has(k))) return { kind: 'loot', id: ak, x: sp.x, y: sp.y };
    return null;
  };
  proto.chestNear = function () {
    if (!this.cleared || this.dead || this.down || this.phase !== 'play' || this.chestAnim || this.build) return null;
    const C = this.chestHere(); if (!C || this.asked['c' + this.cellKey()]) return null;
    return Math.hypot(this.p.x - C.x, this.p.y - C.y) < 140 ? C : null;
  };
  proto.openChest = function () {
    const C = this.chestNear(); if (!C) return false;
    const k = this.cellKey(), A = (this.chestAnim = { ...C, k, t: 0, got: null, shown: false });
    this.asked['c' + k] = 1; this.shake = Math.max(this.shake, 0.12); this.o.on('chestopen', { kind: C.kind, id: C.id });
    const msg = C.kind === 'find' ? { op: 'find', x: this.cell[0], y: this.cell[1] } : { op: 'chest', cell: k };
    this.o.report(msg).then((r) => {
      if (this.chestAnim !== A) return;
      if (r && r.ok) { A.got = r; if (C.kind === 'find') this.looted.add(k); else (this.chestDone || (this.chestDone = new Set())).add(k); }
      else { this.chestAnim = null; this.asked['c' + k] = 0; this.banner = { text: '🔒 IT WON’T BUDGE', sub: (r && r.error) || 'Try again', t: 2 }; }
    });
    return true;
  };
  // the lid opens (0.6 s), then what was inside rises out; the loot lands around the chest
  proto.chestStep = function (dt) {
    const A = this.chestAnim; if (!A) return; A.t += dt;
    if (!A.shown && A.got && A.t >= 0.7) {
      A.shown = true; const r = A.got, P = this.p;
      if (A.kind === 'find' && r.find) this.applyFind(r.find);
      if (r.cash) { if (this._pl) this.cash += r.cash; if (this.popup) this.popup('+$' + r.cash, '#ffd23f', A.x, A.y - 120); }
      for (const [i, k] of (r.loot || []).entries()) { const a = (i / Math.max(1, r.loot.length)) * TAU + 0.4; this.pk.push({ id: this.pkid++, k, x: clamp(A.x + Math.cos(a) * 110, 60, W.AW - 60), y: clamp(A.y + 40 + Math.sin(a) * 60, 80, W.AH - 60), life: 30 }); }
      if (r.weapon && this.drops) this.drops.push({ k: 'weapon', x: clamp(A.x + 70, 80, W.AW - 80), y: clamp(A.y + 70, 80, W.AH - 80), t: 0 });
      for (let i = 0; i < 26; i++) this.particle(A.x + (this.rng() - 0.5) * 40, A.y - 40, (this.rng() - 0.5) * 320, -160 - this.rng() * 240, i % 2 ? '#ffd23f' : '#fff6c0', 0.8, 5);
      this.fx.push({ k: 'ring', x: A.x, y: A.y - 30, r: 10, R: 200, t: 0, life: 0.6, c: '#ffd23f' });
      this.o.on('chestgot', { kind: A.kind, id: A.id, cash: r.cash || 0 }); void P;
    }
    if (A.t > 2.6 || (!A.got && A.t > 8)) this.chestAnim = null;
  };
  const basePlay = proto.playStep;
  proto.playStep = function (dt, I) { basePlay.call(this, dt, I); this.chestStep(dt); };
  const baseStanding = proto.extraStanding;
  proto.extraStanding = function (list) {
    if (baseStanding) baseStanding.call(this, list);
    const A = this.chestAnim, C = A && A.k === this.cellKey() ? A : this.chestHere(); if (!C) return;
    const near = !A && this.cleared && Math.hypot(this.p.x - C.x, this.p.y - C.y) < 140, sim = this;
    const look = C.kind === 'find' ? ((window.TZS.FINDS[C.id] || {}).kind === 'key' ? 'key' : 'find') : C.id;
    list.push({ k: 'chest', C, A, look, near, cleared: sim.cleared, x: C.x, y: C.y, labels: (g, t) => chestTop(g, C.x, C.y, look, t, A ? A.t : -1, A, near, sim.cleared), draw: (g, t) => drawChest(g, C.x, C.y, look, t, A ? A.t : -1, A, near, sim.cleared) });
  };
  const baseHoles = proto.lightHoles;
  proto.lightHoles = function (hole) {
    if (baseHoles) baseHoles.call(this, hole); const C = this.chestAnim || this.chestHere(); if (C) hole(C.x, C.y - 30, this.chestAnim ? 260 : 150, 0.8);
    for (const d of ['n', 's', 'w', 'e']) { const e = this.area.exits[d]; if (!e || !this.gateInfo(d)) continue; hole(d === 'w' ? 150 : d === 'e' ? W.AW - 150 : e.p, d === 'n' ? 90 : d === 's' ? W.AH - 90 : e.p - 60, 220, 0.75); } // the gate sign stays readable at night
  };

  // ---------------- art: chests and gates (drawn in code) ----------------
  const LOOK = {
    key: { body: '#c9a646', dark: '#7a5a1a', lid: '#e8c862', band: '#5a3a10', glow: '255,210,63' },
    find: { body: '#8a5a2a', dark: '#4e3016', lid: '#a46c34', band: '#3a3a3e', glow: '156,255,60' },
    vault: { body: '#5b3f8c', dark: '#2e1f4a', lid: '#7a58b4', band: '#d9b44a', glow: '200,140,255' },
    den: { body: '#5d6a52', dark: '#2c3326', lid: '#76845f', band: '#9aa2aa', glow: '160,255,90' },
  };
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function drawChest(g, x, y, look, t, at, A, near, cleared) {
    const L = LOOK[look] || LOOK.find, open = at >= 0 ? clamp(at / 0.6, 0, 1) : 0, big = look === 'vault' || look === 'key' ? 1.12 : 1;
    g.save(); g.translate(x, y); g.scale(big, big);
    // glow on the ground (stronger once it's clear, and when the lid is up)
    const gl = g.createRadialGradient(0, -20, 6, 0, -20, 110); gl.addColorStop(0, `rgba(${L.glow},${0.35 + 0.25 * Math.sin(t * 4) * (cleared ? 1 : 0.4) + open * 0.4})`); gl.addColorStop(1, `rgba(${L.glow},0)`);
    g.fillStyle = gl; g.beginPath(); g.arc(0, -20, 110, 0, TAU); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(4, 4, 52, 13, 0, 0, TAU); g.fill();
    // the body: planks (or plates), corner bands, the lock plate
    rr(g, -46, -50, 92, 52, 7); g.fillStyle = L.body; g.fill(); g.lineWidth = 4; g.strokeStyle = '#1b1410'; g.stroke();
    g.strokeStyle = L.dark; g.lineWidth = 3; g.beginPath(); for (const yy of [-34, -18]) { g.moveTo(-44, yy); g.lineTo(44, yy); } g.stroke();
    g.fillStyle = L.band; for (const xx of [-46, 34]) g.fillRect(xx, -50, 12, 52);
    if (look === 'vault') { g.fillStyle = '#ff5a8a'; g.beginPath(); g.arc(-20, -26, 5, 0, TAU); g.fill(); g.fillStyle = '#5affc8'; g.beginPath(); g.arc(20, -26, 5, 0, TAU); g.fill(); }
    if (look === 'den') { g.strokeStyle = 'rgba(120,200,60,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-30, -2); g.quadraticCurveTo(-26, 8, -22, -2); g.moveTo(14, -2); g.quadraticCurveTo(18, 10, 22, -2); g.stroke(); }
    // inner light when open
    if (open > 0) { g.globalCompositeOperation = 'lighter'; const lg = g.createLinearGradient(0, -52, 0, -170); lg.addColorStop(0, `rgba(${L.glow},${0.7 * open})`); lg.addColorStop(1, `rgba(${L.glow},0)`); g.fillStyle = lg; g.beginPath(); g.moveTo(-40, -50); g.lineTo(40, -50); g.lineTo(60, -170); g.lineTo(-60, -170); g.closePath(); g.fill(); g.globalCompositeOperation = 'source-over'; }
    // the lid: hinged at the back, swings up and back
    g.save(); g.translate(0, -50); const sh = Math.cos(open * Math.PI * 0.62); g.scale(1, Math.max(0.18, sh) * (sh >= 0 ? 1 : -1));
    rr(g, -48, -20, 96, 22, 8); g.fillStyle = L.lid; g.fill(); g.lineWidth = 4; g.strokeStyle = '#1b1410'; g.stroke();
    g.fillStyle = L.band; g.fillRect(-48, -20, 12, 22); g.fillRect(36, -20, 12, 22);
    g.restore();
    // the lock (a keyhole on a key chest)
    if (open < 0.3) { rr(g, -10, -42, 20, 20, 4); g.fillStyle = look === 'key' ? '#fff0b0' : '#3a3a3e'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#1b1410'; g.stroke(); g.fillStyle = '#1b1410'; g.beginPath(); g.arc(0, -35, 3, 0, TAU); g.fill(); g.fillRect(-1.5, -35, 3, 8); }
    g.restore();
    chestTop(g, x, y, look, t, at, A, near, cleared);
  }
  // what's inside rises out; the 'open me' hint (also drawn over the iso chest art)
  function chestTop(g, x, y, look, t, at, A, near, cleared) {
    const big = look === 'vault' || look === 'key' ? 1.12 : 1;
    if (A && A.shown) {
      const u = clamp((at - 0.7) / 0.6, 0, 1), F = A.kind === 'find' ? (window.TZS.FINDS[A.id] || {}) : null, icon = F ? F.icon : A.id === 'vault' ? '💎' : '💰';
      g.save(); g.translate(x, y - 70 - 70 * u); const s = 0.6 + 0.6 * u + 0.05 * Math.sin(t * 8); g.scale(s, s);
      g.font = '54px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, 0, 0); g.restore();
    } else if (!A) {
      g.font = '30px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(look === 'key' ? '🗝️' : look === 'vault' ? '💎' : look === 'den' ? '🧰' : '❔', x, y - 100 * big + Math.sin(t * 3) * 5);
      const label = near ? (window.matchMedia && matchMedia('(pointer: fine)').matches ? '🖱️ Click (or F) to open' : '👆 Tap OPEN') : cleared ? '' : '🔒 Clear the area first';
      if (label) { g.font = 'bold 22px "Lilita One", sans-serif'; g.lineWidth = 5; g.strokeStyle = '#1b1410'; g.strokeText(label, x, y + 34); g.fillStyle = near ? '#9cff3c' : '#ffd23f'; g.fillText(label, x, y + 34); }
    }
  }
  // a locked gate across the road: chain-link panels, a padlock, and the kill counter
  function drawGate(g, dir, G, t, road) {
    if (typeof G === 'number') G = { have: 0, need: G, kind: null };
    const p = road ? road.p : (dir === 'n' || dir === 's' ? W.AW / 2 : W.AH / 2), hw = road ? road.w / 2 + 30 : 100, x = dir === 'w' ? 0 : dir === 'e' ? W.AW : p, y = dir === 'n' ? 0 : dir === 's' ? W.AH : p, horiz = dir === 'n' || dir === 's', sp = !!G.kind;
    g.save(); g.translate(x, y); if (!horiz) g.rotate(Math.PI / 2);
    rr(g, -hw, -18, hw * 2, 36, 6); g.fillStyle = sp ? '#6a5a2a' : '#5a5f66'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#1b1410'; g.stroke();
    g.strokeStyle = sp ? '#3a2e10' : '#2b2f33'; g.lineWidth = 4; g.beginPath(); for (let i = -hw + 10; i <= hw - 10; i += 18) { g.moveTo(i, -16); g.lineTo(i + 10, 16); } g.stroke();
    g.strokeStyle = sp ? '#ffd23f' : '#c9ccd1'; g.lineWidth = 6; g.setLineDash([10, 6]); g.beginPath(); g.moveTo(-hw + 4, -10); g.lineTo(hw - 4, 10); g.moveTo(-hw + 4, 10); g.lineTo(hw - 4, -10); g.stroke(); g.setLineDash([]);
    rr(g, -16, -22, 32, 34, 6); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#1b1410'; g.stroke();
    g.restore();
    // the sign: progress bar + count (and what's behind it, when it's special)
    const lx = dir === 'w' ? 40 : dir === 'e' ? W.AW - 40 : p, ly = dir === 'n' ? 78 : dir === 's' ? W.AH - 96 : p - 84, al = dir === 'w' ? 'left' : dir === 'e' ? 'right' : 'center';
    const bw = 240, bx = al === 'left' ? lx : al === 'right' ? lx - bw : lx - bw / 2, u = clamp(G.have / Math.max(1, G.need), 0, 1);
    g.fillStyle = 'rgba(15,10,6,0.82)'; rr(g, bx - 8, ly - 26, bw + 16, sp ? 84 : 62, 10); g.fill();
    g.font = 'bold 26px "Lilita One", sans-serif'; g.textAlign = al; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = '#1b1410';
    const s = `🔒 ${G.have} / ${G.need} kills`; g.strokeText(s, lx, ly); g.fillStyle = '#ffd23f'; g.fillText(s, lx, ly);
    g.fillStyle = 'rgba(255,255,255,0.15)'; rr(g, bx, ly + 18, bw, 12, 6); g.fill(); g.fillStyle = u > 0.8 ? '#9cff3c' : '#ffb02e'; rr(g, bx, ly + 18, Math.max(12, bw * u), 12, 6); g.fill();
    if (sp) { g.font = 'bold 19px "Lilita One", sans-serif'; const s2 = `${ICONS[G.kind] || '⭐'} ${G.kind === '?' ? 'Special area' : NAMES[G.kind]}: tough zombies`; g.lineWidth = 5; g.strokeText(s2, lx, ly + 46); g.fillStyle = '#ffe9a8'; g.fillText(s2, lx, ly + 46); }
    void t;
  }
  // the gate's sign alone, centred on (lx, ly) (the iso view stands real fence panels across the road)
  function drawGateSign(g, lx, ly, G, t) {
    const sp = !!G.kind, bw = 240, bx = lx - bw / 2, u = clamp(G.have / Math.max(1, G.need), 0, 1);
    g.fillStyle = 'rgba(15,10,6,0.82)'; rr(g, bx - 8, ly - 26, bw + 16, sp ? 84 : 62, 10); g.fill();
    g.font = 'bold 26px "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 6; g.strokeStyle = '#1b1410';
    const s = `🔒 ${G.have} / ${G.need} kills`; g.strokeText(s, lx, ly); g.fillStyle = '#ffd23f'; g.fillText(s, lx, ly);
    g.fillStyle = 'rgba(255,255,255,0.15)'; rr(g, bx, ly + 18, bw, 12, 6); g.fill(); g.fillStyle = u > 0.8 ? '#9cff3c' : '#ffb02e'; rr(g, bx, ly + 18, Math.max(12, bw * u), 12, 6); g.fill();
    if (sp) { g.font = 'bold 19px "Lilita One", sans-serif'; const s2 = `${ICONS[G.kind] || '⭐'} ${G.kind === '?' ? 'Special area' : NAMES[G.kind]}: tough zombies`; g.lineWidth = 5; g.strokeText(s2, lx, ly + 46); g.fillStyle = '#ffe9a8'; g.fillText(s2, lx, ly + 46); }
    void t;
  }
  window.TZG = { drawChest, drawGate, drawGateSign, chestTop, HARD, NAMES, ICONS };
})();
