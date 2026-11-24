'use strict';
// TrashZombies: the TV (a big map of the town grid, who is where, the kill feed, the results) and
// the phone (the WHOLE game: a full-screen canvas shooter, public/box/games/trash-sim.js).
// Phone controls: touch = drag anywhere to move (a floating stick appears under your thumb), the
// small stick bottom-right aims and fires (auto-aim shoots the nearest zombie while it's idle);
// keyboard + mouse = WASD / arrows to move, mouse to aim, hold the left button to fire, Esc / P to
// pause, 1 2 3 (or click) for the level-up cards, E grabs a pickup from a little further away.
(function () {
  const { esc, timer } = BOX;
  const W = () => window.TZW;
  const TAU = Math.PI * 2;
  const clip = (f, o) => { try { return !!(window.BOX && BOX.audio && BOX.audio.clip && BOX.audio.clip(f, o)); } catch { return false; } };
  const face = (x, n = 40) => (BOX.face ? BOX.face(x, n, { cls: 'tz-fc' }) : `<span class="tz-emo">${esc((x && x.avatar) || '🙂')}</span>`);
  const abIcons = (list) => (list || []).map((e) => { const id = Array.isArray(e) ? e[0] : e, n = Array.isArray(e) ? e[1] : 0, A = W().AB[id]; return A ? `<span class="tz-abi c-${A.cat}" title="${esc(A.name)}">${A.icon}${n > 1 ? `<sub>${n}</sub>` : ''}</span>` : ''; }).join('');
  const lookOf = (s, x, y) => (s.homes || []).some((h) => h[0] === x && h[1] === y) ? W().HOME : W().biomeOf(s.seed, x, y);
  const nm = (n) => esc(BOX.filterText ? BOX.filterText(n || '') : n || '');

  // ======================================================================= TV
  const TV = { el: null, s: null, raf: 0, anims: [], faces: new Map(), at: 0 };
  function faceImg(p) {
    let im = TV.faces.get(p.id);
    const url = BOX.faceUrl ? BOX.faceUrl({ ...p, bot: true }, 64) : '';
    if (!im || im.dataset.u !== url) { im = new Image(); im.dataset.u = url; if (url) im.src = url; TV.faces.set(p.id, im); }
    return im.complete && im.naturalWidth ? im : null;
  }
  function tvLoop() {
    cancelAnimationFrame(TV.raf);
    const step = () => {
      const c = TV.el && TV.el.querySelector('#tz-map');
      if (!c || !document.body.contains(c)) { TV.raf = 0; return; }
      const wv = c.clientWidth, hv = c.clientHeight, d = Math.min(2, window.devicePixelRatio || 1);
      if (c.width !== Math.round(wv * d) || c.height !== Math.round(hv * d)) { c.width = Math.round(wv * d); c.height = Math.round(hv * d); }
      const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); drawMap(g, wv, hv, performance.now() / 1000);
      TV.raf = requestAnimationFrame(step);
    };
    TV.raf = requestAnimationFrame(step);
  }
  function drawMap(g, w, h, t) {
    const s = TV.s; if (!s) return;
    const Z = W(), N = s.grid || Z.GRID, A = window.TZA;
    g.clearRect(0, 0, w, h);
    const cw = Math.min((w - 20) / N, ((h - 20) / N) * (Z.AW / Z.AH)), ch = cw * (Z.AH / Z.AW), x0 = (w - cw * N) / 2, y0 = (h - ch * N) / 2;
    const ex = new Set((s.explored || []).map((e) => e[0] + ',' + e[1]));
    // streets between explored cells
    g.fillStyle = '#141018'; g.fillRect(x0 - 8, y0 - 8, cw * N + 16, ch * N + 16);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = x0 + x * cw, py = y0 + y * ch, k = x + ',' + y;
      if (ex.has(k)) {
        const area = Z.genArea(s.seed, x, y, (s.homes || []).some((hh) => hh[0] === x && hh[1] === y));
        const tw = Math.max(16, Math.round(cw - 6)), th = Math.max(10, Math.round(ch - 6));
        if (A) g.drawImage(A.thumb(area, tw, th), px + 3, py + 3, cw - 6, ch - 6);
        g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.strokeRect(px + 3, py + 3, cw - 6, ch - 6);
        if (cw > 70) { g.font = `bold ${Math.max(10, Math.round(cw * 0.1))}px "Lilita One", sans-serif`; g.textAlign = 'left'; g.textBaseline = 'top'; const label = area.biome.icon + ' ' + area.biome.name; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(label, px + 8, py + 7); g.fillStyle = '#fff6d8'; g.fillText(label, px + 8, py + 7); }
      } else {
        g.fillStyle = (x + y) % 2 ? '#211a26' : '#1c1621'; g.fillRect(px + 3, py + 3, cw - 6, ch - 6);
        g.fillStyle = 'rgba(160,140,190,0.12)'; g.font = `${Math.round(ch * 0.4)}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', px + cw / 2, py + ch / 2);
      }
    }
    // co-op areas glow
    for (const c of s.coop || []) { const [x, y] = c.k.split(',').map(Number); const px = x0 + x * cw, py = y0 + y * ch; g.strokeStyle = `rgba(255,210,63,${0.6 + 0.4 * Math.sin(t * 4)})`; g.lineWidth = 6; g.strokeRect(px + 2, py + 2, cw - 4, ch - 4); g.font = `bold ${Math.max(11, Math.round(cw * 0.1))}px "Lilita One", sans-serif`; g.fillStyle = '#ffd23f'; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText('🤝 CO-OP', px + cw - 8, py + ch - 6); }
    // garage doors rolling up (a run starting)
    TV.anims = TV.anims.filter((a) => t - a.t0 < 4);
    for (const a of TV.anims) {
      const u = (t - a.t0) / 3, px = x0 + a.x * cw, py = y0 + a.y * ch, dw = cw * 0.36, dh = ch * 0.4, dx = px + cw / 2 - dw / 2, dy = py + ch * 0.08;
      g.fillStyle = `rgba(255,240,200,${0.5 * Math.sin(Math.min(1, u) * Math.PI)})`; g.beginPath(); g.moveTo(dx, dy + dh); g.lineTo(dx + dw, dy + dh); g.lineTo(dx + dw + cw * 0.2, py + ch); g.lineTo(dx - cw * 0.2, py + ch); g.closePath(); g.fill();
      const shown = dh * (1 - Math.min(1, Math.max(0, u * 1.4 - 0.2)));
      g.fillStyle = '#c9ccd1'; g.fillRect(dx + Math.sin(t * 50) * (u < 0.8 ? 2 : 0), dy, dw, shown); g.strokeStyle = '#1b1410'; g.lineWidth = 2; g.strokeRect(dx, dy, dw, dh);
    }
    // players
    const byCell = new Map();
    for (const p of s.players || []) { const k = p.x + ',' + p.y; if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push(p); }
    for (const [k, L] of byCell) {
      const [x, y] = k.split(',').map(Number), n = L.length, R = Math.max(12, Math.min(cw, ch) * (n > 3 ? 0.17 : 0.24));
      L.forEach((p, i) => {
        const col = n === 1 ? 0 : (i % 3) - (Math.min(n, 3) - 1) / 2, row = Math.floor(i / 3), cx = x0 + x * cw + cw / 2 + col * R * 2.1, cy = y0 + y * ch + ch * 0.56 + row * R * 2.1 - (n > 3 ? R : 0);
        const dead = p.state === 'dead';
        if (p.danger && !dead) { const pu = (t * 2) % 1; g.strokeStyle = `rgba(255,60,40,${1 - pu})`; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R + 4 + pu * R, 0, TAU); g.stroke(); }
        g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = dead ? '#444' : '#2a2230'; g.fill(); g.clip();
        const im = faceImg(p);
        if (im) { if (dead) g.filter = 'grayscale(1) brightness(0.6)'; g.drawImage(im, cx - R, cy - R, R * 2, R * 2); g.filter = 'none'; }
        else { g.font = `${Math.round(R * 1.3)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.avatar || '🙂', cx, cy + 2); }
        g.restore();
        g.lineWidth = 4; g.strokeStyle = dead ? '#777' : p.color || '#fff'; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke();
        if (dead) { g.font = `${Math.round(R)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('💀', cx + R * 0.7, cy - R * 0.7); }
        else if (p.ch) { g.font = `${Math.round(R * 0.8)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🃏', cx + R * 0.8, cy - R * 0.8); }
        // HP ring
        if (!dead && p.mhp) { g.strokeStyle = p.hp / p.mhp < 0.3 ? '#ff4a3a' : '#7dff6a'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R + 4, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, p.hp / p.mhp)); g.stroke(); }
        g.font = `bold ${Math.max(11, Math.round(R * 0.62))}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'top';
        const label = (BOX.filterText ? BOX.filterText(p.name) : p.name) + (dead ? '' : ' · W' + p.wave);
        g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(label, cx, cy + R + 5); g.fillStyle = '#fff'; g.fillText(label, cx, cy + R + 5);
      });
    }
  }
  function tvSide(s) {
    const P = (s.players || []).slice().sort((a, b) => (a.state === 'dead') - (b.state === 'dead') || b.wave - a.wave || b.kills - a.kills);
    const rows = P.map((p) => `<div class="tz-row ${p.state === 'dead' ? 'dead' : ''} ${p.danger ? 'danger' : ''}">${face({ ...p, bot: true }, 46)}<div class="tz-rmain"><b style="color:${esc(p.color || '#fff')}">${nm(p.name)}</b>
      <small>${p.state === 'dead' ? '💀 down · ' : p.ch ? '🃏 picking an ability · ' : ''}Wave ${p.wave} · Lv ${p.lvl} · ${p.kills} kills</small>
      <div class="tz-hp"><i style="width:${p.state === 'dead' || !p.mhp ? 0 : Math.round((100 * p.hp) / p.mhp)}%"></i></div><div class="tz-ab">${abIcons(p.ab)}</div></div></div>`).join('');
    const feed = (s.feed || []).slice().reverse().map((f) => `<li>${esc(f.icon)} ${nm(f.text)}</li>`).join('');
    const len = { endless: '♾️ Endless', w20: '🏁 First to wave 20' }[s.length] || '';
    return `<div class="tz-sidehead"><span class="tz-logo-s">Trash<b>Zombies</b></span>${s.endsIn ? `<span class="tz-clock">⏱ ${timer(s.endsIn)}</span>` : `<span class="tz-len">${len}</span>`}</div>
      <div class="tz-rows">${rows}</div><ul class="tz-feed">${feed}</ul>`;
  }
  function tvOver(el, s) {
    const st = s.standings || [], top = st.slice(0, 3);
    const pod = top.map((r, i) => `<div class="tz-pod p${i + 1}"><div class="tz-pbody">${BOX.body ? BOX.body({ ...r, bot: true }, i === 0 ? 210 : 170, { mood: 'grin' }) : esc(r.avatar)}</div><div class="tz-pbase"><b>${['🥇', '🥈', '🥉'][i]} ${nm(r.name)}</b><small>Wave ${r.wave} · ${r.kills} kills · Lv ${r.lvl}</small><div class="tz-ab">${abIcons(r.build)}</div></div></div>`).join('');
    const rest = st.slice(3).map((r, i) => `<li><span>#${i + 4}</span>${face(r, 34)}<b>${nm(r.name)}</b><small>Wave ${r.wave} · ${r.kills} kills · Lv ${r.lvl}</small><div class="tz-ab">${abIcons(r.build)}</div></li>`).join('');
    const why = { time: 'Time’s up! The garbage trucks roll in at dawn.', down: 'Everyone’s down. The zombies take the street…', w20: 'Wave 20 survived! The street is safe (for now).', host: 'The host called it a night.', empty: 'Everyone went home. The zombies have the town.' }[s.why] || 'The night is over.';
    BOX.morph(el, `<div class="tz-over"><h1 class="tz-logo">Trash<b>Zombies</b></h1><p class="tz-why">${esc(why)}</p><div class="tz-podium">${pod}</div>${rest ? `<ol class="tz-rest">${rest}</ol>` : ''}</div>`);
  }

  // ======================================================================= PHONE
  const PH = { root: null, cv: null, sim: null, run: null, v: null, ctx: null, raf: 0, last: 0, input: null, keys: new Set(), mouse: { x: 0, y: 0, down: false, on: false }, touch: { move: null, aim: null }, device: null, menu: false, frames: [], work: [], quality: 1, hint: 0, people: new Map(), overlay: '', vib: true };
  try { PH.vib = localStorage.getItem('tz.vib') !== '0'; } catch { /* private */ }
  const isTouch = () => (PH.device ? PH.device === 'touch' : ('ontouchstart' in window || navigator.maxTouchPoints > 0));
  function report(msg, quiet) {
    if (!PH.ctx) return Promise.resolve({ ok: false });
    // status pings are quiet: no toasts for them
    return quiet ? new Promise((res) => { try { PH.ctx.act(msg).then(res); } catch { res({ ok: false }); } }) : PH.ctx.act(msg);
  }
  function buzz(ms) { if (!PH.vib) return; try { if (PH.ctx && PH.ctx.vibrate) PH.ctx.vibrate(ms); else if (navigator.vibrate) navigator.vibrate(ms); } catch { /* no */ } }
  function newSim(v) {
    const me = { id: v.me.id, name: (PH.view && PH.view.me && PH.view.me.name) || 'You', color: (PH.view && PH.view.me && PH.view.me.color) || '#ffd23f', avatar: (PH.view && PH.view.me && PH.view.me.avatar) || '🙂' };
    PH.sim = new window.TZSim.Sim({
      seed: v.seed, homes: v.homes, me, settings: { diff: v.settings.diff, aim: PH.aimPref || v.settings.aim, xp: v.settings.xp }, restore: v.me,
      report, live: (m) => PH.ctx && PH.ctx.live && PH.ctx.live(m), people: (id) => PH.people.get(id), on: simEvent,
    });
    PH.run = v.me.run; PH.dead = null;
    if (v.area) PH.sim.setArea(v.area);
    window.TZ_DEBUG = debugApi();
  }
  function simEvent(kind, d) {
    const ctx = PH.ctx;
    if (kind === 'hurt') buzz(35);
    else if (kind === 'level') { if (ctx) ctx.haptic('win'); cardsUi(); }
    else if (kind === 'pickup') { if (ctx) ctx.haptic('success'); }
    else if (kind === 'boss') { buzz([80, 60, 120]); }
    else if (kind === 'down') { buzz(200); }
    else if (kind === 'dead') { buzz([120, 80, 300]); PH.dead = d; setTimeout(overlay, 1400); }
    else if (kind === 'clear') { if (ctx) ctx.haptic('success'); }
    else if (kind === 'enter') { if (ctx) ctx.haptic('turn'); }
    else if (kind === 'coop') { if (ctx) { ctx.haptic('big'); ctx.toast(d.mode === 'solo' ? 'You’re on your own again.' : `🤝 Co-op! ${d.members.length} of you in this area${d.mode === 'host' ? ' (your phone runs the zombies)' : ''}.`); } }
    else if (kind === 'start') { PH.hint = 7; }
  }
  // ---------- the game root (full screen, kept between updates) ----------
  function ensureRoot(el) {
    if (PH.root && el.contains(PH.root)) return PH.root;
    el.innerHTML = '';
    const r = document.createElement('div'); r.className = 'tz-root';
    r.innerHTML = `<canvas class="tz-cv"></canvas><button class="tz-pause" aria-label="Pause">⏸</button><div class="tz-ov" hidden></div><div class="tz-rot"><div>📱↻</div><b>Turn your phone sideways</b><small>TrashZombies plays best in landscape. (You can still play like this.)</small><button class="btn small" data-rot>Play anyway</button></div>`;
    el.appendChild(r); PH.root = r; PH.cv = r.querySelector('.tz-cv');
    r.querySelector('.tz-pause').onclick = (e) => { e.stopPropagation(); toggleMenu(); };
    r.querySelector('[data-rot]').onclick = () => { PH.rotOk = true; r.classList.remove('portrait'); };
    bindInput(r);
    document.body.classList.add('tz-playing');
    loop();
    return r;
  }
  function loop() {
    cancelAnimationFrame(PH.raf); PH.last = performance.now();
    const step = (now) => {
      if (!PH.root || !document.body.contains(PH.root)) { PH.raf = 0; document.body.classList.remove('tz-playing'); return; }
      const dt = Math.min(0.1, (now - PH.last) / 1000); PH.last = now;
      const t0 = performance.now();
      frame(dt);
      const work = performance.now() - t0;
      PH.frames.push(dt * 1000); PH.work.push(work); if (PH.frames.length > 240) { PH.frames.shift(); PH.work.shift(); }
      // keep it smooth: drop the resolution if frames get slow
      if (PH.frames.length >= 120 && PH.quality > 0.7) { const avg = PH.work.slice(-120).reduce((a, b) => a + b, 0) / 120; if (avg > 14) { PH.quality = 0.7; PH.frames.length = 0; PH.work.length = 0; } }
      PH.raf = requestAnimationFrame(step);
    };
    PH.raf = requestAnimationFrame(step);
  }
  function view() {
    const c = PH.cv, w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight, dpr = Math.min(1.75, window.devicePixelRatio || 1) * PH.quality;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    return { w, h, dpr, k: Math.min(w, h) / 500 };
  }
  function frame(dt) {
    const sim = PH.sim, V = view(), g = PH.cv.getContext('2d');
    PH.root.classList.toggle('portrait', V.h > V.w * 1.1 && !PH.rotOk);
    if (!sim) { g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0c0a08'; g.fillRect(0, 0, PH.cv.width, PH.cv.height); return; }
    const I = readInput(V, sim);
    if (PH.menu && sim.mode === 'solo') sim.paused = true; else if (!sim.cards) sim.paused = false;
    sim._lastInput = I;
    sim.update(dt, I);
    window.TZSim.render(g, sim, V);
    hud(g, sim, V, dt);
  }
  // ---------- input ----------
  function stickZone(V) { const r = Math.max(46, Math.min(70, Math.min(V.w, V.h) * 0.13)); return { x: V.w - r - 28, y: V.h - r - 28, r }; }
  function bindInput(r) {
    const cv = PH.cv;
    const pos = (e) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    cv.addEventListener('pointerdown', (e) => {
      const p = pos(e);
      if (e.pointerType === 'mouse') { PH.device = 'mouse'; PH.mouse.on = true; PH.mouse.x = p.x; PH.mouse.y = p.y; if (e.button === 0) PH.mouse.down = true; return; }
      PH.device = 'touch'; e.preventDefault();
      if (PH.sim && PH.sim.phase === 'intro') PH.skip = true;
      const V = { w: cv.clientWidth, h: cv.clientHeight }, Z = stickZone(V);
      if (!PH.touch.aim && Math.hypot(p.x - Z.x, p.y - Z.y) < Z.r * 1.45) { PH.touch.aim = { id: e.pointerId, x: p.x, y: p.y }; }
      else if (!PH.touch.move) PH.touch.move = { id: e.pointerId, ox: p.x, oy: p.y, x: p.x, y: p.y };
      try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
    }, { passive: false });
    cv.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (e.pointerType === 'mouse') { if (PH.device !== 'mouse' && Math.abs(e.movementX) + Math.abs(e.movementY) < 2) return; PH.device = 'mouse'; PH.mouse.on = true; PH.mouse.x = p.x; PH.mouse.y = p.y; return; }
      const T = PH.touch;
      if (T.aim && T.aim.id === e.pointerId) { T.aim.x = p.x; T.aim.y = p.y; }
      else if (T.move && T.move.id === e.pointerId) { T.move.x = p.x; T.move.y = p.y; const R = 64, dx = p.x - T.move.ox, dy = p.y - T.move.oy, d = Math.hypot(dx, dy); if (d > R * 1.6) { T.move.ox = p.x - (dx / d) * R * 1.6; T.move.oy = p.y - (dy / d) * R * 1.6; } }
    }, { passive: false });
    const up = (e) => {
      if (e.pointerType === 'mouse') { if (e.button === 0) PH.mouse.down = false; return; }
      const T = PH.touch; if (T.aim && T.aim.id === e.pointerId) T.aim = null; if (T.move && T.move.id === e.pointerId) T.move = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    if (!PH.keysBound) {
      PH.keysBound = true;
      window.addEventListener('keydown', (e) => {
        if (!PH.root || !document.body.contains(PH.root)) return;
        if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
        const k = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'e', ' '].includes(k)) { e.preventDefault(); PH.keys.add(k); if (PH.device !== 'mouse') PH.device = 'mouse'; }
        if (k === 'escape' || k === 'p') { e.preventDefault(); toggleMenu(); }
        if (PH.sim && PH.sim.cards && ['1', '2', '3'].includes(k)) choose(Number(k) - 1);
        if (PH.sim && PH.sim.phase === 'intro' && (k === ' ' || k === 'enter')) PH.skip = true;
        if (k === 'enter' && PH.root.querySelector('[data-again]')) PH.root.querySelector('[data-again]').click();
      });
      window.addEventListener('keyup', (e) => PH.keys.delete(e.key.toLowerCase()));
      window.addEventListener('blur', () => { PH.keys.clear(); PH.mouse.down = false; });
    }
  }
  function readInput(V, sim) {
    const I = { mx: 0, my: 0, ax: 0, ay: 0, fire: false, mouse: false, grab: false, skip: !!PH.skip };
    const K = PH.keys;
    if (K.has('a') || K.has('arrowleft')) I.mx -= 1; if (K.has('d') || K.has('arrowright')) I.mx += 1;
    if (K.has('w') || K.has('arrowup')) I.my -= 1; if (K.has('s') || K.has('arrowdown')) I.my += 1;
    if (K.has('e')) I.grab = true;
    const T = PH.touch;
    if (T.move) { const dx = T.move.x - T.move.ox, dy = T.move.y - T.move.oy, d = Math.hypot(dx, dy), R = 64; if (d > 8) { I.mx = (dx / Math.max(d, R)) * Math.min(1, d / R); I.my = (dy / Math.max(d, R)) * Math.min(1, d / R); } }
    if (T.aim) { const Z = stickZone(V), dx = T.aim.x - Z.x, dy = T.aim.y - Z.y; if (Math.hypot(dx, dy) > Z.r * 0.22) { I.ax = dx; I.ay = dy; I.fire = true; } }
    else if (PH.device === 'mouse' && PH.mouse.on && sim.cam) {
      const C = sim.cam, wx = PH.mouse.x / C.k - C.ox, wy = PH.mouse.y / C.k - C.oy;
      I.mouse = true; I.ax = wx - sim.p.x; I.ay = wy - (sim.p.y - 26); I.fire = PH.mouse.down || K.has(' ');
      if (!I.ax && !I.ay) I.ax = 0.001;
    }
    if (PH.skip) PH.skip = false;
    return I;
  }
  // ---------- HUD (drawn on the canvas, screen space) ----------
  function hud(g, sim, V, dt) {
    const d = V.dpr, P = sim.p, S = sim.S, Z = W(), w = V.w, h = V.h, small = Math.min(w, h) < 420;
    g.setTransform(d, 0, 0, d, 0, 0);
    const font = (px) => `bold ${px}px "Lilita One", sans-serif`;
    const txt = (s, x, y, px, c = '#fff', al = 'left') => { g.font = font(px); g.textAlign = al; g.textBaseline = 'middle'; g.lineWidth = Math.max(3, px / 5); g.strokeStyle = 'rgba(15,10,6,0.9)'; g.strokeText(s, x, y); g.fillStyle = c; g.fillText(s, x, y); };
    if (sim.phase === 'intro') { txt(sim.introT < 1.3 ? '…' : 'Rise and shine.', w / 2, h * 0.82, small ? 20 : 26, '#ffe9a8', 'center'); txt('tap to skip', w / 2, h - 18, 12, 'rgba(255,255,255,0.6)', 'center'); return; }
    // top-left: health, armour, shield, level + XP
    const bw = Math.min(260, w * 0.32), bx = 14, by = 14, bh = small ? 16 : 20;
    g.fillStyle = 'rgba(15,10,6,0.75)'; roundRect(g, bx - 4, by - 4, bw + 8, bh + 8, 8); g.fill();
    const hp = Math.max(0, P.hp / S.mhp); g.fillStyle = hp < 0.3 ? '#ff4a3a' : '#5ad65a'; roundRect(g, bx, by, bw * hp, bh, 6); g.fill();
    txt(`❤ ${Math.ceil(Math.max(0, P.hp))}/${Math.round(S.mhp)}`, bx + 8, by + bh / 2 + 1, small ? 12 : 14);
    let ix = bx + bw + 14;
    if (P.armor > 0) { txt('🗑️', ix, by + bh / 2, 18); ix += 26; }
    if (P.lives > 0) { txt('🍱×' + P.lives, ix, by + bh / 2, 15); ix += 44; }
    // XP bar
    const xy = by + bh + 10, need = Z.xpNeed(sim.lvl);
    g.fillStyle = 'rgba(15,10,6,0.75)'; roundRect(g, bx - 4, xy - 3, bw + 8, 12, 6); g.fill();
    g.fillStyle = '#5affc8'; roundRect(g, bx, xy, bw * Math.min(1, sim.xp / need), 6, 3); g.fill();
    txt('LV ' + sim.lvl, bx, xy + 20, small ? 14 : 16, '#5affc8');
    // buffs
    let fy = xy + 40;
    for (const [k, v] of Object.entries(sim.buffs)) if (v > 0) { const Pk = Z.PK[k === 'kicks' ? 'kicks' : k]; if (!Pk) continue; txt(`${Pk.icon} ${Math.ceil(v)}s`, bx, fy, small ? 14 : 16, Pk.color); fy += small ? 20 : 24; }
    // top-centre: wave + zombies left
    const left = sim.spec ? Math.max(0, sim.spec.target - sim.waveKills) : 0;
    txt(`WAVE ${sim.wave}`, w / 2, 22, small ? 20 : 26, '#ffd23f', 'center');
    txt(sim.cleared ? '✅ Area clear: find an exit' : `🧟 ${Math.max(left, sim.z.length)} left`, w / 2, small ? 44 : 50, small ? 13 : 16, sim.cleared ? '#7dff6a' : '#fff', 'center');
    if (sim.mode !== 'solo') txt(sim.mode === 'host' ? '🤝 CO-OP (host)' : '🤝 CO-OP', w / 2, small ? 62 : 72, 12, '#ffd23f', 'center');
    // top-right: minimap (under the pause button)
    minimap(g, sim, V);
    // the banner
    if (sim.banner) { const a = Math.min(1, sim.banner.t * 2), by2 = h * 0.24; g.globalAlpha = a; txt(sim.banner.text, w / 2, by2, small ? 34 : 46, '#ffd23f', 'center'); txt(sim.banner.sub, w / 2, by2 + (small ? 30 : 40), small ? 14 : 18, '#fff', 'center'); g.globalAlpha = 1; }
    // control hints
    if (PH.hint > 0) { PH.hint -= dt; g.globalAlpha = Math.min(1, PH.hint); txt(isTouch() ? 'Drag anywhere to move · right stick to aim' + (sim.set.aim !== 'off' ? ' (or just move: it auto-aims)' : '') : 'WASD to move · mouse to aim · hold click to shoot · Esc to pause', w / 2, h - 22, small ? 12 : 15, '#ffe9a8', 'center'); g.globalAlpha = 1; }
    // sticks (touch)
    if (isTouch() && !sim.dead) {
      const Zs = stickZone(V), T = PH.touch;
      g.globalAlpha = T.aim ? 0.9 : 0.55; g.fillStyle = 'rgba(15,10,6,0.45)'; g.beginPath(); g.arc(Zs.x, Zs.y, Zs.r, 0, TAU); g.fill(); g.strokeStyle = '#ff5a3c'; g.lineWidth = 3; g.stroke();
      let kx = Zs.x, ky = Zs.y; if (T.aim) { const dx = T.aim.x - Zs.x, dy = T.aim.y - Zs.y, dd = Math.hypot(dx, dy) || 1, m = Math.min(dd, Zs.r * 0.7); kx += (dx / dd) * m; ky += (dy / dd) * m; }
      g.fillStyle = '#ff5a3c'; g.beginPath(); g.arc(kx, ky, Zs.r * 0.42, 0, TAU); g.fill(); g.globalAlpha = 1;
      txt(T.aim ? '🔥' : sim.set.aim !== 'off' ? 'AUTO' : 'AIM', Zs.x, Zs.y - Zs.r - 12, 12, '#fff', 'center');
      if (T.move) { g.globalAlpha = 0.5; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(T.move.ox, T.move.oy, 56, 0, TAU); g.stroke(); const dx = T.move.x - T.move.ox, dy = T.move.y - T.move.oy, dd = Math.hypot(dx, dy) || 1, m = Math.min(dd, 56); g.fillStyle = '#fff'; g.beginPath(); g.arc(T.move.ox + (dx / dd) * m, T.move.oy + (dy / dd) * m, 24, 0, TAU); g.fill(); g.globalAlpha = 1; }
    }
    // exit arrows at the screen edge pointing to exits when cleared
    if (sim.cleared && !sim.dead) {
      const C = sim.cam; if (C) for (const [dd, ok] of Object.entries(sim.area.exits)) {
        if (!ok) continue; const ex = dd === 'w' ? 0 : dd === 'e' ? Z.AW : Z.AW / 2, ey = dd === 'n' ? 0 : dd === 's' ? Z.AH : Z.AH / 2;
        const sx = (ex + C.ox) * C.k, sy = (ey + C.oy) * C.k; if (sx > 30 && sx < w - 30 && sy > 30 && sy < h - 30) continue;
        const cx = Math.max(40, Math.min(w - 40, sx)), cy = Math.max(90, Math.min(h - 40, sy)), a = Math.atan2(sy - h / 2, sx - w / 2);
        g.save(); g.translate(cx, cy); g.rotate(a); g.globalAlpha = 0.6 + 0.4 * Math.sin(sim.t * 6); g.fillStyle = '#7dff6a'; g.beginPath(); g.moveTo(18, 0); g.lineTo(-10, -14); g.lineTo(-10, 14); g.closePath(); g.fill(); g.restore(); g.globalAlpha = 1;
      }
    }
  }
  function roundRect(g, x, y, w, h, r) { w = Math.max(0, w); r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function minimap(g, sim, V) {
    const v = PH.v; if (!v) return;
    const N = v.grid || 9, small = Math.min(V.w, V.h) < 420, cs = small ? 8 : 10, mw = N * cs, x0 = V.w - mw - 14, y0 = 62;
    g.fillStyle = 'rgba(15,10,6,0.75)'; roundRect(g, x0 - 5, y0 - 5, mw + 10, mw * 0.6 + 10 + 0, 6); g.fill();
    const ch = cs * 0.6, ex = new Set((v.explored || []).map((e) => e[0] + ',' + e[1]));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const seen = ex.has(x + ',' + y); g.fillStyle = seen ? lookOf(v, x, y).ground[0] : 'rgba(255,255,255,0.07)'; g.fillRect(x0 + x * cs + 0.5, y0 + y * ch + 0.5, cs - 1, ch - 1); }
    for (const p of v.players || []) { if (p.state === 'dead') continue; g.fillStyle = p.color || '#fff'; g.beginPath(); g.arc(x0 + p.x * cs + cs / 2, y0 + p.y * ch + ch / 2, 3, 0, TAU); g.fill(); }
    if (Math.sin(sim.t * 8) > -0.3) { g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.arc(x0 + sim.cell[0] * cs + cs / 2, y0 + sim.cell[1] * ch + ch / 2, 3.5, 0, TAU); g.fill(); g.stroke(); }
    // the nearest friend: "Ana 2⬆ 1➡"
    let best = null, bd = 99;
    for (const p of v.players || []) { if (p.bot || p.state === 'dead') continue; const d = Math.abs(p.x - sim.cell[0]) + Math.abs(p.y - sim.cell[1]); if (d > 0 && d < bd) { bd = d; best = p; } }
    if (best) {
      const dx = best.x - sim.cell[0], dy = best.y - sim.cell[1], s = (dy ? Math.abs(dy) + (dy < 0 ? '⬆' : '⬇') : '') + (dx ? ' ' + Math.abs(dx) + (dx < 0 ? '⬅' : '➡') : '');
      g.font = 'bold 12px "Lilita One", sans-serif'; g.textAlign = 'right'; g.textBaseline = 'top'; g.lineWidth = 3; g.strokeStyle = '#000'; const label = (best.name || '') + ' ' + s; g.strokeText(label, x0 + mw + 4, y0 + N * ch + 9); g.fillStyle = best.color || '#fff'; g.fillText(label, x0 + mw + 4, y0 + N * ch + 9);
    }
  }
  // ---------- overlays: cards, pause, death ----------
  function setOverlay(html, cls = '') {
    const ov = PH.root && PH.root.querySelector('.tz-ov'); if (!ov) return null;
    if (!html) { ov.hidden = true; ov.className = 'tz-ov'; PH.overlay = ''; return ov; }
    ov.hidden = false; ov.className = 'tz-ov ' + cls; BOX.morph(ov, html); PH.overlay = cls; return ov;
  }
  function cardsUi() {
    const sim = PH.sim; if (!sim || !sim.cards) return;
    const Z = W(), mouse = !isTouch();
    const cards = sim.cards.map((id, i) => {
      if (id === '_snack') return `<button class="tz-card c-def" data-card="${i}"><i>${mouse ? i + 1 : ''}</i><span class="tz-cat">Snack</span><b class="tz-ci">🌭</b><h3>Big Snack</h3><p>You have every ability maxed out! Heal 40.</p></button>`;
      const A = Z.AB[id], cur = sim.ab[id] || 0, C = Z.CATS[A.cat];
      return `<button class="tz-card c-${A.cat}" data-card="${i}"><i>${mouse ? i + 1 : ''}</i><span class="tz-cat" style="background:${C.color}">${C.name}</span><b class="tz-ci">${A.icon}</b><h3>${esc(A.name)}</h3><p>${esc(A.desc)}</p><small>${cur ? `Tier ${cur} → ${cur + 1} of ${A.max}` : `NEW · up to ${A.max} tiers`}</small></button>`;
    }).join('');
    const ov = setOverlay(`<div class="tz-lvl"><h2>LEVEL UP! <span>Lv ${sim.lvl - sim.pendingLevels + 1}</span></h2><p>${sim.mode === 'solo' ? 'The game is paused. Pick one:' : '🛡️ You can’t be hurt while you choose (the game keeps going for your friends).'}</p><div class="tz-cards">${cards}</div></div>`, 'cards');
    if (ov) for (const b of ov.querySelectorAll('[data-card]')) b.onclick = (e) => { e.stopPropagation(); choose(Number(b.dataset.card)); };
  }
  function choose(i) {
    const sim = PH.sim; if (!sim || !sim.cards) return;
    if (sim.pick(i)) { if (PH.ctx) PH.ctx.haptic('select'); if (sim.cards) cardsUi(); else setOverlay(''); }
  }
  function buildHtml(ab) {
    const Z = W(), L = Object.entries(ab || {}).filter(([, n]) => n > 0);
    if (!L.length) return '<p class="tz-mut">No abilities yet: level up by grabbing the green XP gems.</p>';
    return ['atk', 'def', 'spc'].map((c) => { const items = L.filter(([id]) => Z.AB[id] && Z.AB[id].cat === c); return items.length ? `<div class="tz-bcat c-${c}"><h4>${Z.CATS[c].name}</h4>${items.map(([id, n]) => `<div class="tz-bi"><span>${Z.AB[id].icon}</span><b>${esc(Z.AB[id].name)}</b><small>${'●'.repeat(n)}${'○'.repeat(Z.AB[id].max - n)}</small></div>`).join('')}</div>` : ''; }).join('');
  }
  function toggleMenu(force) {
    const sim = PH.sim; if (!sim || sim.dead) return;
    if (sim.cards) return;
    PH.menu = force != null ? force : !PH.menu;
    if (!PH.menu) { setOverlay(''); return; }
    const v = PH.v || {}, vip = PH.view && PH.view.vip, touch = isTouch();
    const ov = setOverlay(`<div class="tz-menu"><h2>${sim.mode === 'solo' ? '⏸ Paused' : '🤝 Co-op: the game keeps going!'}</h2>
      <div class="tz-mstats"><span>Wave <b>${sim.wave}</b></span><span>Level <b>${sim.lvl}</b></span><span>Kills <b>${sim.killCount}</b></span><span>📍 ${esc(sim.area.biome.name)}</span></div>
      <h3>Your build</h3><div class="tz-build">${buildHtml(sim.ab)}</div>
      <div class="tz-opts"><button class="btn small ${sim.set.aim !== 'off' ? 'green' : 'ghost'}" data-opt="aim">🎯 Auto-aim: ${sim.set.aim !== 'off' ? 'On' : 'Off'}</button><button class="btn small ${PH.vib ? 'green' : 'ghost'}" data-opt="vib">📳 Buzz: ${PH.vib ? 'On' : 'Off'}</button></div>
      <div class="tz-controls">${touch ? '👆 Drag anywhere to move · 🔴 the stick bottom-right aims and shoots · auto-aim shoots the nearest zombie when you let go.' : '⌨️ WASD / arrows move · 🖱️ mouse aims · hold left click (or Space) to shoot · E grabs a pickup · 1 2 3 pick cards · Esc pauses.'}</div>
      <div class="tz-mbtns"><button class="btn green big" data-opt="resume">▶ Keep playing</button>${vip ? '<button class="btn ghost small" data-opt="end">🏁 End the night (results)</button>' : ''}</div></div>`, 'menu');
    if (!ov) return;
    for (const b of ov.querySelectorAll('[data-opt]')) b.onclick = async (e) => {
      e.stopPropagation(); const o = b.dataset.opt;
      if (o === 'resume') return toggleMenu(false);
      if (o === 'aim') { sim.set.aim = sim.set.aim !== 'off' ? 'off' : 'on'; PH.aimPref = sim.set.aim; return toggleMenu(true); }
      if (o === 'vib') { PH.vib = !PH.vib; try { localStorage.setItem('tz.vib', PH.vib ? '1' : '0'); } catch { /* private */ } return toggleMenu(true); }
      if (o === 'end') { if (b.dataset.armed) { await report({ op: 'end' }); toggleMenu(false); } else { b.dataset.armed = '1'; b.textContent = 'Tap again to end for everyone'; } }
    };
  }
  function overlay() {
    const v = PH.v; if (!v || !PH.root) return;
    const me = v.me || {};
    if (me.state === 'dead' || (PH.sim && PH.sim.dead)) {
      const d = PH.dead || { wave: me.wave, kills: me.kills, lvl: me.lvl, ab: me.ab };
      const vip = PH.view && PH.view.vip, best = me.best;
      const body = BOX.body ? BOX.body({ id: me.id, name: PH.view && PH.view.me.name, bot: true }, 150, { mood: 'sad' }) : '';
      const ov = setOverlay(`<div class="tz-dead"><div class="tz-dbody">${body}</div><div class="tz-dmain"><h2>YOU GOT TRASHED</h2>
        <div class="tz-mstats"><span>Wave <b>${d.wave}</b></span><span>Kills <b>${d.kills}</b></span><span>Level <b>${d.lvl}</b></span></div>
        ${best && (best.wave > d.wave || (best.wave === d.wave && best.kills > d.kills)) ? `<p class="tz-mut">Best tonight: wave ${best.wave}, ${best.kills} kills</p>` : ''}
        <div class="tz-build">${buildHtml(d.ab)}</div>
        <div class="tz-mbtns"><button class="btn green big" data-again>🔁 Play again${isTouch() ? '' : ' (Enter)'}</button>${vip ? '<button class="btn ghost small" data-end>🏁 End the night</button>' : ''}</div></div></div>`, 'dead');
      if (!ov) return;
      const a = ov.querySelector('[data-again]'); if (a) a.onclick = async () => { a.disabled = true; const r = await report({ op: 'respawn' }); if (!r.ok) a.disabled = false; };
      const e = ov.querySelector('[data-end]'); if (e) e.onclick = async () => { if (e.dataset.armed) await report({ op: 'end' }); else { e.dataset.armed = '1'; e.textContent = 'Tap again to end for everyone'; } };
    }
  }
  function debugApi() {
    return {
      sim: () => PH.sim, frames: () => ({ dt: PH.frames.slice(), work: PH.work.slice(), quality: PH.quality }),
      spawn(n, type) { const s = PH.sim; for (let i = 0; i < n; i++) s.spawnOne(type); return s.z.length; },
      give(k) { PH.sim.applyPickup(k); return true; }, drop(k) { const s = PH.sim; s.pk.push({ id: s.pkid++, k, x: s.p.x + 60, y: s.p.y, life: 20 }); return true; },
      xp(n) { PH.sim.gainXp(n); return PH.sim.lvl; }, skip() { const s = PH.sim; if (s.phase === 'intro') s.introT = 99; return true; },
      clear() { const s = PH.sim; s.z.length = 0; s.waveKills = s.spec.target; s.bossDue = false; return true; },
      god(on) { PH.sim.p.inv = on ? 1e9 : 0; return true; }, kill() { const s = PH.sim; s.p.inv = 0; s.buffs.shield = 0; s.p.armor = 0; s.p.lives = 0; s.p.hp = 1; s.hurt(999); return s.dead; },
      walk(dir) { const s = PH.sim, Z = W(); s.cleared = true; if (dir === 'e') { s.p.x = Z.AW + 20; s.p.y = Z.AH / 2; } if (dir === 'w') { s.p.x = -20; s.p.y = Z.AH / 2; } if (dir === 'n') { s.p.x = Z.AW / 2; s.p.y = -20; } if (dir === 's') { s.p.x = Z.AW / 2; s.p.y = Z.AH + 20; } s.leave(dir); return s.cell.join(','); },
      teleport(x, y) { const s = PH.sim; s.p.x = x; s.p.y = y; return true; },
      stick() { const c = PH.cv; return stickZone({ w: c.clientWidth, h: c.clientHeight }); }, device: () => PH.device, menu: () => PH.menu,
      intro() { const s = PH.sim; if (!s.area.garage) return false; s.phase = 'intro'; s.introT = 0; s.p.x = W().AW / 2; s.p.y = 120; s.banner = null; return true; },
    };
  }

  BOX.games.trash = {
    name: 'TrashZombies', icon: '🗑️',
    about: 'Roll up the garage door and blast your way through an endless zombie town, level up, build your loadout, and find your friends on the map.',
    how: [
      'Your PHONE is the whole game: turn it sideways. Drag anywhere to move; the small stick bottom-right aims and shoots. Auto-aim shoots the nearest zombie while you just move.',
      'On a computer: WASD or arrows to move, the mouse to aim, hold left click to shoot, Esc to pause.',
      'Kill zombies, grab the green XP gems and level up: pick 1 of 3 abilities (Attack, Defense or Special). They stack!',
      'Glowing pickups give a quick boost: Bubble Shield, Trash-Can Armor, Buzzsaw Minigun, Rocket Sneakers, Garbage Day, Freezer Burn, Health Snack, Double XP.',
      'Clear the wave and the exits open: walk out an edge into a brand-new area for the next, tougher wave. Every 5th wave a Dumpster Brute shows up.',
      'The TV shows the town map. Walk into a friend’s area to team up: you share the zombies (and the XP).',
    ],
    fx: { start: 'start' },
    // ---------------- lobby ----------------
    lobbyTv(el, L) {
      if (!el.querySelector('.tz-lobby')) {
        el.innerHTML = `<div class="tz-lobby"><div class="tz-lb-sky"></div><div class="tz-lb-door"><div class="tz-lb-slats"></div><span>No. 13</span></div>
          <div class="tz-lb-main"><h1 class="tz-logo">Trash<b>Zombies</b></h1><p class="tz-tag">Roll up the garage. Walk out. Don’t get trashed.</p>
          <div class="tz-lb-row"><div class="tz-join"><img id="qr" alt="QR code to join"><div class="tz-code-l">Room code</div><div class="tz-code" id="code"></div><div class="tz-url">or go to <b id="url"></b></div><small>Your phone is the controller AND the screen</small></div>
          <div class="tz-lb-set"><h3>🛠️ House rules</h3><div class="tz-settings" id="settings"></div></div></div>
          <div class="tz-roster" id="roster"></div><div class="tz-err" id="lobby-err"></div>
          <button class="btn big tz-start" id="start">Roll up the door ▶</button>
          <div class="tz-links"><button class="link" id="add-bots">+ 5 test bots</button> <button class="link" id="pick">🎮 Another game</button></div></div></div>`;
        el.querySelector('#start').onclick = async () => { const r = await L.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
        el.querySelector('#add-bots').onclick = () => L.bots(5);
        el.querySelector('#pick').onclick = () => L.pick();
      }
      el.querySelector('#code').textContent = L.code; const u = el.querySelector('#url'); if (u) u.textContent = String(L.joinUrl || '').replace(/^https?:\/\//, '');
      const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
      const set = el.querySelector('#settings'), sig = JSON.stringify(L.settings);
      if (set.dataset.sig !== sig && !set.contains(document.activeElement)) {
        set.dataset.sig = sig;
        set.innerHTML = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
        for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => L.set(s.dataset.set, s.value);
      }
      BOX.morph(el.querySelector('#roster'), L.players.map((p) => `<span class="chip">${face({ ...p, bot: true }, 30)} ${nm(p.name)}</span>`).join('') || '<span class="muted">Scan the code to join! Solo works great too.</span>');
    },
    // ---------------- TV ----------------
    tv(el, s) {
      if (!s) return;
      TV.s = s;
      if (s.phase === 'over') { cancelAnimationFrame(TV.raf); TV.raf = 0; TV.el = null; return tvOver(el, s); }
      if (!el.querySelector('.tz-tv')) { el.innerHTML = '<div class="tz-tv"><div class="tz-mapw"><canvas id="tz-map"></canvas><div class="tz-maptag">🗺️ The town · walk into a friend’s area to team up</div></div><aside class="tz-side" id="tz-side"></aside></div>'; TV.el = el; tvLoop(); }
      TV.el = el; if (!TV.raf) tvLoop();
      BOX.morph(el.querySelector('#tz-side'), tvSide(s));
    },
    onFx(f) {
      const s = TV.s;
      if (f.kind === 'tzgarage') { TV.anims.push({ x: f.x, y: f.y, t0: performance.now() / 1000 }); clip('bid/garage-rollup.webm', { vol: 0.45 }) || BOX.sfx('creak'); }
      else if (f.kind === 'tzpick') { (BOX.audio && BOX.audio.stinger && BOX.audio.stinger('lvl', 'trash')) || BOX.sfx('chime'); }
      else if (f.kind === 'tzpickup') { if (f.pk === 'nuke') { BOX.sfx('explosion'); } else if (f.pk === 'freeze') BOX.sfx('freeze'); else if (f.pk === 'shield') BOX.sfx('shield'); else BOX.sfx('pop'); }
      else if (f.kind === 'tzboss') { clip('zombie/groan-' + (1 + Math.floor(Math.random() * 3)) + '.ogg', { vol: 0.6 }) || BOX.sfx('roar'); }
      else if (f.kind === 'tzdead') { clip('zombie/body-fall.ogg', { vol: 0.4 }) || BOX.sfx('fall'); }
      else if (f.kind === 'tzclear') { BOX.sfx('reveal'); }
      else if (f.kind === 'tzcoop') { BOX.sfx('join'); }
      void s;
    },
    music(s) { if (!s) return 'play'; if (s.phase === 'over') return 'finale'; const P = s.players || []; if (P.length && P.every((p) => p.state === 'dead')) return 'lose'; return P.some((p) => p.wave % 5 === 0 && p.state !== 'dead' && !p.bot) ? 'tense' : 'play'; },
    // ---------------- phone ----------------
    phone(el, v, ctx, view) {
      if (!v) return;
      PH.ctx = ctx; PH.view = view || PH.view; PH.v = v;
      for (const p of v.players || []) PH.people.set(p.id, p);
      if (view && view.me) PH.people.set(view.me.id, view.me);
      if (v.phase === 'over') {
        if (PH.root) { PH.root = null; PH.sim = null; cancelAnimationFrame(PH.raf); document.body.classList.remove('tz-playing'); }
        const st = v.standings || [], i = st.findIndex((r) => r.id === (v.me && v.me.id)), r = st[i] || {};
        BOX.morph(el, `<div class="card-box tz-ph-over"><h2 class="tz-logo sm">Trash<b>Zombies</b></h2><div class="tz-pbig">${BOX.body ? BOX.body({ id: v.me && v.me.id, bot: true }, 130, { mood: i === 0 ? 'grin' : 'smile' }) : ''}</div>
          <h3>${i === 0 ? '🏆 Top survivor!' : `#${i + 1} of ${st.length}`}</h3><p>Best run: wave <b>${r.wave || 1}</b> · ${r.kills || 0} kills · level ${r.lvl || 1}</p><div class="tz-ab">${abIcons(r.build)}</div>
          <ol class="tz-mini">${st.slice(0, 6).map((x) => `<li>${face(x, 26)} <b>${nm(x.name)}</b> <span>W${x.wave} · ${x.kills}k</span></li>`).join('')}</ol></div>`);
        if (!PH.overHaptic) { PH.overHaptic = true; ctx.haptic('win'); }
        return;
      }
      PH.overHaptic = false;
      if (!v.me) { BOX.morph(el, '<div class="card-box"><h3>Joining the night…</h3></div>'); return; }
      ensureRoot(el);
      if (v.me.state === 'dead' && (!PH.sim || PH.sim.dead || PH.run !== v.me.run)) { if (!PH.sim || PH.run !== v.me.run) { PH.sim = null; PH.run = v.me.run; } if (PH.overlay !== 'dead') overlay(); return; }
      if (!PH.sim || PH.run !== v.me.run) { setOverlay(''); PH.menu = false; newSim(v); }
      else if (v.area && PH.sim) PH.sim.setArea(v.area);
      if (PH.sim) { PH.sim.homes = v.homes || PH.sim.homes; }
      if (PH.sim && PH.sim.cards && PH.overlay !== 'cards') cardsUi();
    },
    live(m) { if (PH.sim) PH.sim.onLive(m); },
  };
})();
