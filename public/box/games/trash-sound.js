'use strict';
// JustZombies sound on the phone (window.TZSnd): the staged CC0 clips (trash-assets/sfx, listed in
// manifest.sfx, credits in CREDITS.md) played through the box audio engine (public/box/audio.js:
// BOX.audio.sample / loop on its SFX bus, so the box volume + mute settings apply). audio.js is
// loaded on demand when a run starts, so other phone games stay exactly as they were.
//   TZSnd.init()            start loading (the phone page calls it with the game screen)
//   TZSnd.event(kind, d)    a game event (the sim's o.on(): shot, hurt, level, pickup, chest, ride, ...)
//   TZSnd.frame(sim, dt)    drain sim.sq (hits, kills, explosions, weapons) + ambience (groans, rain, engines)
// Volumes are kept low and spread out: gunfire ~0.2, hits ~0.1, explosions ~0.4, jingles ~0.45.
(function () {
  const BASE = '/box/games/trash-assets/';
  let M = null, started = false;
  const loops = {}, last = {};
  function init() {
    if (started) return; started = true;
    if (!(window.BOX && window.BOX.audio)) { const s = document.createElement('script'); s.src = '/box/audio.js'; document.head.appendChild(s); }
    fetch(BASE + 'manifest.json').then((r) => r.json()).then((m) => { M = m; }).catch(() => { M = null; });
  }
  const A = () => (window.BOX && BOX.audio && BOX.audio.sample ? BOX.audio : null);
  function url(k) { if (!M) return null; const key = M.aliases && M.aliases[k] && M.sfx[M.aliases[k]] ? M.aliases[k] : k; const S = M.sfx[key]; return S ? BASE + S.file : null; }
  function play(k, vol = 0.3, o = {}) {
    const au = A(), u = url(k); if (!au || !u) return false;
    const now = performance.now(), gap = o.gap != null ? o.gap : 60; if (now - (last[k] || 0) < gap) return false; last[k] = now;
    return au.sample(u, { vol, rate: o.rate, pan: o.pan, jitter: o.jitter != null ? o.jitter : 0.06, gap: 0 });
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function loop(name, key, vol, rate) {
    const au = A(); if (!au || !au.loop) return;
    let L = loops[name];
    if (vol <= 0.001) { if (L) { L.stop(0.4); delete loops[name]; } return; }
    if (!L || L.key !== key) { if (L) L.stop(0.3); const u = url(key); if (!u) return; L = loops[name] = au.loop(u, { vol: 0, rate }); L.key = key; }
    L.set(vol, rate);
  }
  function stopAll() { for (const k of Object.keys(loops)) { loops[k].stop(0.3); delete loops[k]; } }
  // where a sound is: quieter far away, panned left / right
  let here = null;
  function spot(x, y) {
    if (!here || x == null) return { v: 1, pan: 0 };
    const d = Math.hypot(x - here.x, y - here.y), v = Math.max(0.12, Math.min(1, 1 - d / 1100));
    return { v, pan: Math.max(-0.7, Math.min(0.7, ((x - here.x) - (y - here.y)) / 900)) };
  }
  const WEAPON = { shotgun: ['sfx.gun.shotgun', 0.22], smg: ['sfx.gun.smg', 0.14], nailgun: ['sfx.nailgun', 0.16], bat: ['sfx.swing.bat', 0.2], crossbow: ['sfx.crossbow', 0.2], hubcap: ['sfx.hubcap', 0.18],
    launcher: ['sfx.gun.heavy', 0.24], coil: ['sfx.gun.lightning', 0.18], rail: ['sfx.rail', 0.26], flamer: ['loop:sfx.flamer.loop', 0.18], blower: ['loop:sfx.blower.loop', 0.16], saw: ['loop:sfx.chainsaw.loop', 0.18] };
  const sustain = {};
  function weapon(id, x, y) {
    const W = WEAPON[id]; if (!W) return; const p = spot(x, y);
    if (W[0].startsWith('loop:')) { sustain[id] = { key: W[0].slice(5), vol: W[1] * p.v, until: performance.now() + 450 }; return; }
    play(W[0], W[1] * p.v, { pan: p.pan, gap: id === 'smg' ? 55 : 80 });
  }
  function event(kind, d = {}) {
    switch (kind) {
      case 'shot': { const sim = here && here.sim, B = sim ? sim.buffs : {}; if (B.minigun > 0) play('sfx.gun.minigun', 0.16, { gap: 45 }); else if (B.raygun > 0) play('sfx.gun.raygun', 0.16, { gap: 70 }); else if (B.rockets > 0) play('sfx.gun.rocket', 0.2, { gap: 120 }); else play(pick(['sfx.gun.pistol.light', 'sfx.gun.pistol']), 0.2, { gap: 70 }); break; }
      case 'hurt': play('sfx.player.hurt', 0.3, { gap: 250 }); break;
      case 'level': play('sfx.level.up', 0.45, { gap: 400 }); break;
      case 'pickup': play(d.k === 'snack' ? 'sfx.pickup.health' : d.k === 'nuke' ? 'sfx.explosion.b' : d.k === 'freeze' ? 'sfx.freeze' : d.k === 'shield' ? 'sfx.shield.up' : 'sfx.pickup.power', d.k === 'nuke' ? 0.5 : 0.35); break;
      case 'gem': play('sfx.pickup.xp', 0.12, { gap: 70, jitter: 0.15 }); break;
      case 'cash': play('sfx.pickup.cash', 0.2, { gap: 90 }); break;
      case 'start': play('sfx.wave.start', 0.35); break;
      case 'clear': play('sfx.level.up.b', 0.35); break;
      case 'boss': play('sfx.boss.intro', 0.45); play('sfx.zombie.brute', 0.35, { rate: 0.85 }); break;
      case 'bossdown': play('sfx.explosion.b', 0.45); break;
      case 'dead': play('sfx.game.over', 0.45); stopAll(); break;
      case 'chestopen': play('sfx.chest.latch', 0.35); setTimeout(() => play('sfx.chest.open', 0.4), 180); break;
      case 'chestgot': play('sfx.coins', 0.35); break;
      case 'buy': play('sfx.ui.buy', 0.3); break;
      case 'ride': if (d.on) { play('sfx.door', 0.35); play('sfx.zap', 0.18); } else play('sfx.door', 0.3); break;
      case 'rideend': play('sfx.crate.break', 0.35); play('sfx.explosion.small', 0.25); break;
      case 'wreck': play('sfx.crate.break', 0.4); play('sfx.explosion.small', 0.35); break;
      case 'evolve': play('sfx.level.up.b', 0.45); break;
      case 'build': play('sfx.build', 0.35); break;
      case 'hordestart': play('sfx.alarm', 0.3); break;
      case 'unlock': play('sfx.door', 0.35); break;
      case 'garage': play('sfx.garage.door', 0.5, { gap: 2000 }); break;
      case 'board': play('sfx.door', 0.35); break;
      case 'ram': play(pick(['sfx.hit.splat', 'sfx.hit.metal']), 0.3, { gap: 60 }); break;
      case 'weapon': case 'upgrade': case 'item': play('sfx.pickup', 0.3); break;
      case 'debuff': play('sfx.slime', 0.3, { gap: 400 }); break;
      case 'tick': play('sfx.ui.click', 0.25, { gap: 300 }); break;
      default: break;
    }
  }
  let groanT = 1.5;
  function frame(sim, dt) {
    init();
    here = { x: sim.p.x, y: sim.p.y, sim };
    // the sim's sound queue: hits, kills, explosions, the weapons that fire by themselves
    const q = sim.sq || [];
    let hits = 0;
    for (const [n, x, y] of q) {
      const p = spot(x, y);
      if (n === 'hit') { if (hits++ < 2) play(pick(['sfx.hit.flesh', 'sfx.hit.flesh.b', 'sfx.hit.flesh.c']), 0.1 * p.v, { pan: p.pan, gap: 45 }); }
      else if (n === 'kill') { play(pick(['sfx.hit.splat', 'sfx.hit.splat.b']), 0.16 * p.v, { pan: p.pan, gap: 50 }); if (Math.random() < 0.12) play(pick(['sfx.zombie.vox.3', 'sfx.zombie.vox.8', 'sfx.zombie.vox.12', 'sfx.zombie.vox.20']), 0.14 * p.v, { pan: p.pan, gap: 300 }); }
      else if (n === 'splat') play('sfx.slime', 0.2 * p.v, { pan: p.pan, gap: 80 });
      else if (n === 'bossdie') { play('sfx.explosion.b', 0.45); play('sfx.zombie.brute', 0.4, { rate: 0.7 }); }
      else if (n === 'boom') play(pick(['sfx.explosion', 'sfx.explosion.b']), 0.42 * p.v, { pan: p.pan, gap: 90 });
      else if (n === 'boomsmall') play(pick(['sfx.explosion.small', 'sfx.explosion.small.b']), 0.3 * p.v, { pan: p.pan, gap: 70 });
      else if (n === 'cannon') { play('sfx.gun.heavy', 0.4, { rate: 0.7, gap: 200 }); play('sfx.explosion.small', 0.25, { gap: 200 }); }
      else if (n.startsWith('w:')) weapon(n.slice(2), x, y);
    }
    q.length = 0;
    // sustained weapon loops (flamer, blower, chainsaw)
    const now = performance.now();
    for (const id of ['flamer', 'blower', 'saw']) { const S = sustain[id]; loop('w:' + id, S ? S.key : '', S && S.until > now && !sim.paused ? S.vol : 0, 1); }
    // groans from the nearest zombies
    groanT -= dt;
    if (groanT <= 0 && sim.phase === 'play' && !sim.paused) {
      let best = null, bd = 1e9; for (const z of sim.z) { if (z.hp <= 0) continue; const d = Math.hypot(z.x - sim.p.x, z.y - sim.p.y); if (d < bd) { bd = d; best = z; } }
      if (best && bd < 900) { const p = spot(best.x, best.y), big = best.boss || best.type === 'brute' || best.type === 'bloater'; play(big ? 'sfx.zombie.brute' : best.type === 'runner' || best.type === 'stalker' ? 'sfx.zombie.runner' : pick(['sfx.zombie.groan.a', 'sfx.zombie.groan.b', 'sfx.zombie.groan.c', 'sfx.zombie.moan.a', 'sfx.zombie.vox.1', 'sfx.zombie.vox.5', 'sfx.zombie.vox.10', 'sfx.zombie.vox.15']), (big ? 0.2 : 0.13) * p.v, { pan: p.pan, gap: 500, rate: 0.9 + Math.random() * 0.2 }); }
      groanT = 1.2 + Math.random() * 2.2 - Math.min(0.8, sim.z.length / 120);
    }
    // weather + engines
    const wx = sim._wx || {}, raining = (wx.rain || sim.wxk === 'rain') && sim.phase === 'play';
    loop('rain', 'sfx.rain.loop', raining && !sim.paused ? 0.16 : 0, 1);
    const r = sim.ride, mv = r ? Math.hypot(sim.p.vx || 0, sim.p.vy || 0) : 0;
    loop('engine', r ? (r.kind === 'gtruck' || r.kind === 'tank' ? 'sfx.engine.heavy' : 'sfx.engine.loop.high') : '', r && r.kind !== 'cart' && r.kind !== 'push' && !sim.paused && !sim.dead ? 0.16 : r && r.kind === 'push' && !sim.paused ? 0.1 : 0, 0.85 + Math.min(0.5, mv / 500));
    // helicopters (yours, a friend's, the gunship) and the jetpack: our own synthesized loops
    const hp = sim.heliPose && sim.heliPose(), fo = sim.flyover, rk = r && r.kind;
    const rotorV = (hp ? (hp.flying ? 0.3 : 0.26) : 0) + (fo ? 0.2 * (1 - Math.min(1, fo.t / fo.T)) : 0) + (rk === 'gunship' ? 0.2 : 0);
    loop('rotor', 'sfx.heli.rotor.loop', !sim.paused && !sim.dead ? Math.min(0.32, rotorV) : 0, hp && hp.flying ? 1.08 : 1);
    loop('jet', 'sfx.jet.loop', rk === 'jetpack' && !sim.paused && !sim.dead ? 0.08 + Math.min(0.12, (r.alt || 0) / 500) : 0, 0.9 + Math.min(0.3, (r && r.alt || 0) / 300));
    // the garage door in the intro
    if (sim.phase === 'intro' && sim.introT > 1.25 && !sim._doorSnd) { sim._doorSnd = true; event('garage'); }
    if (sim.dead || sim.phase === 'over') stopAll();
  }
  window.TZSnd = { init, play, event, frame, stopAll };
})();
