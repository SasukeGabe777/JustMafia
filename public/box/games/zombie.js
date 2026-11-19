'use strict';
// Zombie Survival screens.
// TV: a full-screen canvas scene for each location (public/box/games/zombie-art.js) with a HUD
// on top: chapter cards, the scenario and its options while phones choose, then the OUTCOME
// sequence (each group acts out its choice, zombies shamble in, fates are stamped: made it,
// hurt, bitten, fell → ghost), the survivors/ghosts board, and the epilogue.
// Phone: a survival-kit look. Your status and backpack, big option buttons, gifts for friends,
// bless/curse as a ghost, and your fate revealed in step with the TV.
// Lobby: the safehouse. Settings are supplies on the table, players sign the survivor log.
(function () {
  const { esc, mmss } = BOX;
  const A = () => BOX.zombieArt;
  const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + 's'}`;
  const STATUS = { ok: ['❤️', 'Healthy'], hurt: ['🤕', 'Hurt'], bitten: ['🦷', 'Bitten!'], dead: ['👻', 'Ghost'], turned: ['🧟', 'Turned'] };
  const FATE = {
    safe: { icon: '✅', word: 'MADE IT', cls: 'safe', col: '#7dff8a' },
    hurt: { icon: '🤕', word: 'HURT', cls: 'hurt', col: '#ffb347' },
    bitten: { icon: '🦷', word: 'BITTEN', cls: 'bitten', col: '#b6ff5a' },
    dead: { icon: '💀', word: 'FELL', cls: 'dead', col: '#ff6b6b' },
    turned: { icon: '🧟', word: 'TURNED', cls: 'dead', col: '#ff6b6b' },
    cured: { icon: '🩹', word: 'CURED', cls: 'safe', col: '#7dff8a' },
  };
  const ANIM_SFX = { run: 'step', decoy: 'siren', climb: 'creak', fight: 'hit', hide: 'heartbeat', sneak: 'drag', drive: 'whoosh', search: 'click', swim: 'whoosh', hold: 'knock', rest: 'chime', talk: 'talk' };
  const VOICE = { like: /guy|male|david|mark|daniel|george|ryan/i, accent: /en-(US|GB)/i, pitch: 0.82, rate: 1.0 };
  const DANGER = ['', '⚠️ risky', '☠️ dangerous', '☠️☠️ deadly'];
  const danger = (o) => (o.danger ? `<i class="zs-t danger d${o.danger}">${DANGER[o.danger] || ''}</i>` : '');
  const tag = (o) => [danger(o), o.need ? `<i class="zs-t need">needs ${o.need}</i>` : '', o.help || o.flags ? `<i class="zs-t help">better with ${o.help || ''}${o.flags || ''}</i>` : '', o.gain ? `<i class="zs-t gain">find ${o.gain}</i>` : '', o.heal ? '<i class="zs-t heal">heals</i>' : '', o.cure ? '<i class="zs-t cure">cures bites</i>' : '', o.hero ? '<i class="zs-t hero">🦸 hero</i>' : ''].join('');
  // countdowns whose end time stays fixed for one phase (so renders don't jitter)
  const ends = {};
  const timer = (key, endsIn) => { if (!endsIn) return ''; if (!ends[key]) ends[key] = Date.now() + endsIn; return `<span class="timer" data-ends="${ends[key]}">${mmss(ends[key] - Date.now())}</span>`; };
  const say = (s, text, fit) => { try { if (s && s.narrator !== false && BOX.studio && BOX.studio.say) BOX.studio.say(text, VOICE, fit); } catch { /* subtitles only */ } };

  // =========================================================================================
  // One animation loop for every canvas this page draws (TV scene, lobby backdrop).
  // =========================================================================================
  const loops = new Set();
  let raf = 0;
  function addLoop(fn) { loops.add(fn); if (!raf) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    for (const fn of [...loops]) { try { if (fn(now) === false) loops.delete(fn); } catch (e) { fn.errs = (fn.errs || 0) + 1; if (fn.errs < 4) { console.error(e); window.__zsErr = String(e && e.stack); } if (fn.errs > 300) loops.delete(fn); } }
    if (loops.size) raf = requestAnimationFrame(tick);
  }
  function fit(cv, cap = 1.5) {
    const d = Math.min(cap, window.devicePixelRatio || 1), w = cv.clientWidth || 1, h = cv.clientHeight || 1;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    return { w, h, d };
  }

  // =========================================================================================
  // TV
  // =========================================================================================
  const T = { s: null, at: 0, key: '', t0: 0, cues: new Set(), hud: '', said: '' };
  function phaseKey(s) { return s.phase + ':' + s.n + ':' + (s.phase === 'chapter' ? s.chapter.day : ''); }
  function elapsed() { return Date.now() - T.t0; }
  function mountTv(el) {
    if (el._zs && el.contains(el._zs.root)) return el._zs;
    el.innerHTML = '<div class="zs-tv"><div class="zs-stage" data-keep><canvas class="zs-cv"></canvas></div><div class="zs-hud" id="zs-hud"></div></div>';
    const z = { root: el.firstElementChild, cv: el.querySelector('.zs-cv'), hud: el.querySelector('#zs-hud') };
    el._zs = z; T.hud = ''; T.key = '';
    addLoop((now) => { if (!z.cv.isConnected) return false; drawTv(z, now); return true; });
    return z;
  }
  function onState(s) {
    const k = phaseKey(s), first = k !== T.key;
    T.s = s; T.at = Date.now();
    if (!first) return;
    T.key = k; T.cues = new Set();
    // where in this phase we are (the outcome has a fixed length)
    const total = s.phase === 'outcome' && s.outcome ? s.outcome.ms : null;
    T.t0 = total ? Date.now() - Math.max(0, total - s.endsIn) : Date.now();
    if (s.phase === 'chapter') say(s, `Day ${s.chapter.day}. ${s.chapter.name}. ${s.chapter.line.replace(/^Day \w+\.\s*/, '')}`, 6000);
    else if (s.phase === 'choose' && s.scene) say(s, `${s.scene.title}. ${s.scene.text}`);
    else if (s.phase === 'over' && s.epilogue) say(s, s.epilogue.wipe ? 'Nobody made it out. The city belongs to the shamblers now. But what a story.' : `The last flight lifts off. ${s.epilogue.rescued.length} survivor${s.epilogue.rescued.length === 1 ? '' : 's'} made it out.`, 6000);
  }
  const cue = (k, at, u, fn) => { if (u >= at && !T.cues.has(k)) { T.cues.add(k); if (u - at < 1500) fn(); } };

  // ---------- the scene ----------
  // The part of the 1920×1080 world that is visible (cover-fit crops top and bottom on wide
  // screens): the ground line follows it, so feet and name plates are never cut off.
  const V = { top: 0, bottom: 1080 };
  function drawTv(z, now) {
    const s = T.s; if (!s) return;
    const Z = A(); if (!Z) return;
    const { w, h, d } = fit(z.cv), g = z.cv.getContext('2d'), t = now / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0a0612'; g.fillRect(0, 0, z.cv.width, z.cv.height);
    const sc = Z.cover(g, w, h, d);
    V.top = Math.max(0, (1080 - h / sc) / 2); V.bottom = 1080 - V.top;
    const u = elapsed();
    const loc = s.phase === 'over' ? (s.epilogue && s.epilogue.wipe ? 'streets' : 'rescue') : s.chapter.loc;
    if (s.phase === 'chapter') drawChapter(g, s, t, u, loc);
    else if (s.phase === 'choose') drawChoose(g, s, t, loc);
    else if (s.phase === 'outcome' && s.outcome) drawOutcome(g, s, t, u, loc);
    else if (s.phase === 'board') drawBoard(g, s, t, loc);
    else if (s.phase === 'over') drawOver(g, s, t, u);
    else Z.backdrop(g, loc, t, { dark: 0.3 });
    Z.vignette(g, 0.45);
    // the HUD follows the timeline
    if (!z._h || now - z._h > 120) { z._h = now; const html = hud(s, u); if (html !== T.hud) { T.hud = html; BOX.morph(z.hud, html); } }
  }
  const W0 = 1920;
  function shamblers(g, t, n, y, s, o = {}) {
    const Z = A();
    for (let i = 0; i < n; i++) {
      const span = 2400, sp = 26 + (i % 3) * 7, dir = i % 2 ? 1 : -1;
      const x = dir > 0 ? ((t * sp + i * 530) % span) - 240 : W0 - (((t * sp + i * 530) % span) - 240);
      Z.zombie(g, x, y + (i % 3) * 14, s * (0.9 + (i % 3) * 0.08), t, { seed: i + 3, dir, alpha: o.alpha, speed: 2.4 });
    }
  }
  // A row of people with name plates under their feet. Plates stagger on 1–3 levels so they never overlap.
  function rowLayout(n, o = {}) {
    const m = Math.min(n, o.max || 16);
    const levels = m <= 8 ? 1 : m <= 16 ? 2 : 3, px = m <= 6 ? 36 : m <= 12 ? 32 : 28, step = px * 1.55 + 8;
    const y = o.y || Math.min(905, V.bottom - 24 - levels * step);
    const sc = (o.scale || 1) * (m <= 2 ? 1.2 : m <= 4 ? 1.05 : m <= 6 ? 0.92 : m <= 8 ? 0.8 : m <= 12 ? 0.66 : m <= 16 ? 0.56 : 0.44);
    const span = o.span || 1720, gap = Math.min(380 * sc + 70, span / Math.max(1, m));
    return Array.from({ length: m }, (_, i) => ({ x: (o.cx || 960) + (i - (m - 1) / 2) * gap, y, s: sc, lv: i % levels, step, px, pmax: Math.min(380, gap * levels - 18), i }));
  }
  function namePlate(g, name, P, o = {}) {
    A().plate(g, P.x, P.y + 14 + P.lv * P.step, name, { color: o.color, px: P.px, max: P.pmax, bg: o.bg, icon: o.icon });
  }
  // JustGold gear: the survivor's bandana paint, or null (no bandana: the default look).
  const bandanaOf = (p) => (window.MT_GEAR && p ? MT_GEAR.paint('zombie', 'bandana', p.gear) : null);
  function crowd(g, list, t, o = {}) {
    const Z = A(), L = rowLayout(list.length, { max: o.max || 24, scale: o.scale, y: o.y });
    for (const P of L) {
      const p = list[P.i];
      Z.survivor(g, P.x, P.y, P.s, t, { avatar: p.avatar, color: p.color, pose: o.pose || 'idle', ph: P.i * 1.7, tint: p.status === 'bitten' ? 'sick' : null, dir: P.i % 2 ? -1 : 1, bandana: bandanaOf(p) });
      if (p.status === 'bitten') Z.glow(g, P.x, P.y - 120 * P.s, 90 * P.s, 'rgba(140,255,90,A)', 0.25 + 0.15 * Math.sin(t * 4 + P.i));
      const b = p.status === 'hurt' ? '🩹' : p.status === 'bitten' ? '🦷' : null;
      if (b) Z.emoji(g, b, P.x + 36 * P.s, P.y - 200 * P.s, 30 + 20 * P.s);
      if (o.items && p.items) Z.text(g, p.items, P.x, P.y - 236 * P.s, 22 + 14 * P.s, '#fff', { font: '"Segoe UI Emoji", sans-serif' });
    }
    if (o.names !== false) for (const P of L) namePlate(g, list[P.i].name, P, { color: list[P.i].color });
    if (list.length > L.length) A().plate(g, 1830, L[0].y - 60, `+${list.length - L.length} more`, { px: 28, color: '#9dff5a' });
  }
  function ghosts(g, list, t, o = {}) {
    const Z = A(), n = Math.min(list.length, 14);
    for (let i = 0; i < n; i++) {
      const p = list[i], span = o.span || 1700, x = (o.x0 || 120) + ((i * 263 + t * 14 * (i % 2 ? 1 : -1)) % span + span) % span, y = (o.y || 170) + (i % 3) * 70;
      Z.ghost(g, x, y, o.s || 0.75, t, { avatar: p.avatar, ph: i, alpha: 0.6 });
      if (o.names) Z.plate(g, x, y + 50 * (o.s || 0.75) + 8 + Math.sin(t * 2 + i) * 10, p.name, { px: 22, max: 200, color: '#c9d4ff', bg: 'rgba(24,28,60,0.85)' });
    }
  }
  function drawChapter(g, s, t, u, loc) {
    const Z = A(), k = Math.min(1, u / 8000);
    g.save(); g.translate(960, 540); g.scale(1.08 - 0.08 * k, 1.08 - 0.08 * k); g.translate(-960, -540);
    Z.backdrop(g, loc, t, { dark: 0.15 }); shamblers(g, t, 4, 900, 0.55, { alpha: 0.85 }); Z.fog(g, t, 0.2);
    g.restore();
    g.fillStyle = `rgba(0,0,0,${0.75 * (1 - Z.util.clamp(u / 900))})`; g.fillRect(-200, -200, 2400, 1500);
  }
  function drawChoose(g, s, t, loc) {
    const Z = A();
    Z.backdrop(g, loc, t, { dark: 0.42 });
    shamblers(g, t, 4, 820, 0.5, { alpha: 0.7 });
    Z.fog(g, t, 0.16, 900);
    if (s.ghosts) ghosts(g, s.ghostList || [], t, { y: 640, s: 0.5 });
    crowd(g, s.people || [], t, { scale: 0.9 });
  }
  function drawBoard(g, s, t, loc) {
    const Z = A();
    Z.backdrop(g, loc, t, { dark: 0.5 });
    Z.fog(g, t, 0.18, 960);
    ghosts(g, s.ghostList || [], t, { y: 330, s: 0.75, x0: 80, span: 1250, names: (s.ghostList || []).length <= 8 });
    crowd(g, s.people || [], t, { items: true });
  }

  // ---------- the outcome, beat by beat ----------
  const CONSEQ = 1500; // matches the server: act, then the consequence, then one verdict per person
  const VERDICT = {
    safe: { icon: '✅', word: 'MADE IT', say: 'made it!', col: '#7dff8a', bg: 'rgba(20,70,30,0.95)' },
    hurt: { icon: '🤕', word: 'HURT', say: 'got hurt!', col: '#ffb347', bg: 'rgba(80,46,10,0.95)' },
    bitten: { icon: '🦷', word: 'BITTEN', say: 'got BITTEN!', col: '#c8ff5a', bg: 'rgba(40,70,10,0.95)' },
    dead: { icon: '💀', word: 'FELL', say: 'fell!', col: '#ff6b6b', bg: 'rgba(80,16,20,0.95)' },
    turned: { icon: '🧟', word: 'TURNED', say: 'turned!', col: '#ff6b6b', bg: 'rgba(80,16,20,0.95)' },
    cured: { icon: '🩹', word: 'CURED', say: 'is cured!', col: '#7dff8a', bg: 'rgba(20,70,30,0.95)' },
  };
  const gainList = (G) => Array.from(G.gain || '');
  const VEHICLES = ['🚜', '🚑', '🛺', '🚌', '♿', '🚨'];
  function stamp(g, x, y, f, rv, big) {
    const Z = A(), k = Z.util.back(Z.util.clamp(rv / 260)), V2 = VERDICT[f];
    g.save(); g.translate(x, y); g.scale(k * big, k * big); g.rotate(-0.05);
    g.font = `46px ${Z.FONT}`; const tw = g.measureText(V2.word).width + 96;
    g.fillStyle = 'rgba(0,0,0,0.5)'; Z.rr(g, -tw / 2 + 5, -34, tw, 74, 37); g.fill();
    g.fillStyle = V2.bg; Z.rr(g, -tw / 2, -38, tw, 74, 37); g.fill(); g.lineWidth = 6; g.strokeStyle = V2.col; g.stroke();
    Z.emoji(g, V2.icon, -tw / 2 + 40, 0, 44); Z.text(g, V2.word, 22, 2, 46, V2.col);
    g.restore();
  }
  // Where each person stands for this group's action.
  function groupLayout(G) {
    const n = G.people.length, a = G.anim, door = a === 'hold' && G.role === 'hold';
    if (door) { const span = Math.min(1150, 220 + n * 170); return rowLayout(n, { cx: 1585 - span / 2, span }); }
    if (a === 'run' || a === 'decoy') return rowLayout(n, { cx: 1080, span: 1500 });
    if (a === 'fight') return rowLayout(n, { cx: 780, span: 1250 });
    return rowLayout(n);
  }
  function drawGroup(g, s, G, u, t, loc) {
    const Z = A(), Pr = Z.props, { clamp, easeOut, lerp, ease } = Z.util;
    const v = u - G.at, actEnd = Math.max(1200, G.verdictAt - G.at - CONSEQ), inConseq = v >= actEnd, ppl = G.people, L = groupLayout(G), a = G.anim;
    const G0 = L.length ? L[0].y : 880, lastAt = ppl.length ? ppl[ppl.length - 1].at : G.verdictAt, gains = gainList(G);
    const minX = L.length ? L[0].x : 960, maxX = L.length ? L[L.length - 1].x : 960;
    const door = a === 'hold' && G.role === 'hold', doorOpen = door && s.outcome.groupOk === false ? clamp((v - actEnd - 500) / 400) : 0;
    // ----- the set for this action -----
    let shelfY = 0, ledge = 0;
    if (a === 'search') shelfY = Pr.shelf(g, loc, Math.min(minX - 150, 960 - 460), Math.max(maxX + 150, 960 + 460), G0 - 470, G0 - 40, G0 - 550 > V.top + 0.34 * (V.bottom - V.top) ? (s.outcome.title || '').toUpperCase() : null);
    if (a === 'climb') {
      ledge = G0 - Math.min(330, 0.3 * (V.bottom - V.top)); Pr.wall(g, loc, Math.min(minX - 170, 560), Math.max(maxX + 170, 1360), ledge, G0);
      L.forEach((P, i) => { const rope = ppl[i].used === '🪢' || G.icon === '🪢'; g.lineCap = 'round'; if (rope) { g.strokeStyle = '#c9a36b'; g.lineWidth = 9; g.beginPath(); g.moveTo(P.x + 18, ledge - 10); for (let yy = ledge; yy <= G0; yy += 30) g.lineTo(P.x + 18 + Math.sin(yy / 30 + t * 2) * 5, yy); g.stroke(); } else { g.strokeStyle = '#8a8fa8'; g.lineWidth = 16; g.beginPath(); g.moveTo(P.x + 22, ledge - 10); g.lineTo(P.x + 22, G0); g.stroke(); g.strokeStyle = '#5a5e74'; g.lineWidth = 22; for (let yy = ledge + 40; yy < G0; yy += 90) { g.beginPath(); g.moveTo(P.x + 22, yy); g.lineTo(P.x + 22, yy + 8); g.stroke(); } } });
    }
    if (door) Pr.door(g, loc, 1620, G0, doorOpen, inConseq && !doorOpen ? Math.sin(t * 45) * 7 : v < actEnd ? Math.sin(t * 30) * 3 : 0);
    if (a === 'run') Pr.exitSign(g, 1790, G0 - 420);
    if (a === 'rest') { if (loc === 'hospital') L.forEach((P) => Pr.cover(g, loc, 'bed', P.x, P.y - 4, P.s)); else Pr.campfire(g, 960, G0 - 10, t); }
    if (a === 'talk') { g.fillStyle = '#6a4a2e'; Z.rr(g, 900, G0 - 90, 120, 90, 8); g.fill(); Z.emoji(g, ppl.some((p) => p.used === '📻') ? '📻' : G.icon, 960, G0 - 130, 80); }
    if (a === 'swim') Pr.water(g, G0 - 60, t);
    // ----- zombies closing in -----
    const zn = Math.max(2, Math.min(6, Math.ceil(G.total / 2) + 1));
    for (let j = 0; j < zn; j++) {
      const left = j % 2 === 0, near = clamp((v - 200) / (actEnd + CONSEQ - 200)), seed = j + G.k.length;
      let x, y = G0 + 6 - (j % 3) * 14, dir = left ? 1 : -1;
      if (a === 'run' || a === 'decoy') { x = lerp(-420 - j * 140, minX - 230 - j * 110 + (a === 'decoy' ? 220 : 0), easeOut(clamp((v - 500) / (actEnd + CONSEQ - 500)))); dir = 1; }
      else if (a === 'sneak') { x = 620 + j * 280; y = G0 - 70; dir = inConseq && j === 1 ? -1 : 1; }
      else if (a === 'hide') { x = lerp(2150 + j * 170, -400 + j * 170, clamp((v - actEnd + 300) / (CONSEQ + 2600))); dir = -1; y = G0 + 12; }
      else if (a === 'fight') { x = lerp(2200 + j * 130, maxX + 230 + 60 * (L[0] ? L[0].s : 1) + j * 100, easeOut(near)); dir = -1; }
      else if (door) { if (!doorOpen) continue; x = lerp(1760, maxX + 170 + j * 90, easeOut(clamp((v - actEnd - 700) / 700))); dir = -1; }
      else { const gap = 250 + 110 * (L[0] ? L[0].s : 1); x = left ? lerp(-260 - j * 120, minX - gap - j * 90, easeOut(near)) : lerp(2180 + j * 120, maxX + gap + j * 90, easeOut(near)); }
      if (x > -400 && x < 2400) Z.zombie(g, x, y, (a === 'sneak' ? 0.75 : 0.9) * (L[0] ? Math.max(0.7, L[0].s) : 1), t, { seed, dir, speed: 3 });
      if (a === 'sneak' && inConseq && j === 1) Z.text(g, '?', x, y - 230, 70, '#ffd34a', { stroke: '#120d1c', lw: 10 });
    }
    if (door && !doorOpen) for (let k = 0; k < 3; k++) { g.save(); g.translate(1870, G0 - 300 + k * 90 + Math.sin(t * 6 + k) * 10); g.strokeStyle = '#9ccf7a'; g.lineWidth = 18; g.lineCap = 'round'; g.beginPath(); g.moveTo(60, 0); g.lineTo(-30 - Math.max(0, Math.sin(t * 5 + k)) * 40, 0); g.stroke(); g.restore(); }
    // ----- cars for the drivers -----
    const cars = a === 'drive' ? Math.ceil(ppl.length / 4) : 0, carX = [];
    if (cars) {
      const drive = clamp((u - lastAt - 1400) / 1800);
      for (let c = 0; c < cars; c++) {
        const cx0 = 960 + (c - (cars - 1) / 2) * 600, cx = lerp(-500, cx0, easeOut(clamp(v / (actEnd * 0.6)))) + drive * drive * 1600 + (inConseq && !drive ? Math.sin(t * 40 + c) * 5 : 0);
        carX.push(cx);
      }
    }
    // ----- the survivors -----
    const order = L.map((P) => P.i);
    const pos = [];
    for (const i of order) {
      const p = ppl[i], P = L[i], rv = u - p.at, F = rv >= 0 ? p.fate : null, bad = F && F !== 'safe';
      let x = P.x, y = P.y, pose = 'idle', dir = 1, crouch = 0, item = p.used || null, alpha = 1, lean = 0, hidden = false;
      const walk = easeOut(clamp(v / (actEnd * 0.5)));
      if (a === 'search') {
        x = lerp(-220 - i * 90, P.x, walk); pose = walk < 1 ? 'run' : F ? (bad ? 'idle' : 'cheer') : 'search';
      } else if (a === 'climb') {
        const up = 0.72 * ease(clamp((v - 200) / (actEnd + CONSEQ - 200)));
        y = lerp(P.y, ledge, up); pose = 'climb';
        if (F === 'safe') { y = lerp(lerp(P.y, ledge, 0.72), ledge, easeOut(clamp(rv / 500))); pose = rv > 500 ? 'cheer' : 'climb'; }
        else if (bad) { y = lerp(lerp(P.y, ledge, 0.72), P.y, clamp(rv / 380) ** 2); pose = 'idle'; }
      } else if (a === 'run') { x = lerp(-300 - i * 80, P.x, easeOut(clamp(v / actEnd))); pose = v < actEnd ? 'run' : F === 'safe' ? 'cheer' : 'idle'; }
      else if (a === 'decoy') { x = lerp(P.x - 520, P.x, easeOut(clamp(v / actEnd))); pose = v < actEnd + CONSEQ ? 'run' : F === 'safe' ? 'cheer' : 'idle'; }
      else if (a === 'sneak') { x = lerp(-260 - i * 80, P.x, clamp(v / (actEnd + CONSEQ))); pose = F ? (F === 'safe' ? 'cheer' : 'idle') : 'sneak'; }
      else if (a === 'hide') { x = lerp(-240 - i * 80, P.x, walk); pose = walk < 1 ? 'run' : F === 'safe' && rv > 200 ? 'cheer' : 'hide'; if (F === 'safe' && rv > 200) crouch = 0; }
      else if (door) { x = lerp(-240 - i * 80, P.x, walk); pose = walk < 1 ? 'run' : doorOpen > 0.5 && !F ? 'idle' : F === 'safe' ? 'cheer' : 'hold'; lean = pose === 'hold' ? 0.05 : 0; }
      else if (a === 'fight') { pose = F ? (F === 'safe' ? 'cheer' : 'idle') : inConseq ? 'fight' : 'idle'; item = p.used || (inConseq ? '👊' : null); }
      else if (a === 'drive') {
        const cx = carX[Math.floor(i / 4)], seat = i % 4;
        x = lerp(-260 - i * 70, cx - 60 + seat * 40, walk); pose = 'run';
        if (walk >= 1 && !bad) hidden = true; // inside the car
        if (bad) { x = cx + (seat % 2 ? 260 : -260); pose = 'idle'; }
        pos[i] = { x, y, hidden, cx, seat };
      } else if (a === 'swim') { x = lerp(-240 - i * 70, P.x, easeOut(clamp(v / actEnd))); pose = 'swim'; y = P.y - 40 + Math.sin(t * 3 + i) * 6; }
      else if (a === 'rest') { pose = F === 'safe' && rv > 300 ? 'cheer' : 'rest'; }
      else if (a === 'talk') { pose = 'talk'; }
      else { pose = 'idle'; item = item || (inConseq ? G.icon : null); }
      // the verdict: a zombie lunges at the unlucky ones; the fallen topple and a ghost rises
      if (bad && a !== 'drive') {
        const side = x < 960 ? -1 : 1, zk = clamp(rv / 260), zx = x + side * (150 - 40 * zk) * P.s;
        if (!(F === 'hurt' && rv > 1100)) Z.zombie(g, zx, y + 4, P.s * 0.95, t, { seed: i + 11, dir: -side, alpha: F === 'hurt' ? 1 - clamp((rv - 800) / 300) : zk });
      }
      if (F === 'dead') { const fk = clamp((rv - 350) / 450); lean = -1.45 * fk; alpha = 1 - clamp((rv - 1500) / 600); }
      if (F === 'safe' && rv < 600 && a !== 'climb') y -= Math.sin(clamp(rv / 600) * Math.PI) * 46 * P.s;
      if (rv > -120 && rv < 1400) Z.glow(g, x, y - 140 * P.s, 260 * P.s + 40, 'rgba(255,250,210,A)', 0.3 * (1 - clamp(rv / 1400)));
      if (!hidden && alpha > 0) {
        if (lean) { g.save(); g.translate(x, y); g.rotate(lean); g.translate(-x, -y); }
        if (a === 'swim') { Z.emoji(g, p.avatar, x, y - 30 * P.s, 90 * P.s, F === 'bitten' ? 'sick' : null); g.strokeStyle = 'rgba(220,240,255,0.8)'; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y + 8, 60 * P.s, 12, 0, 0, Math.PI * 2); g.stroke(); }
        else Z.survivor(g, x, y, P.s, t, { avatar: p.avatar, color: p.color, pose, ph: i * 1.3, tint: F === 'bitten' ? 'sick' : null, crouch, alpha, dir, lean: 0, item: a === 'search' && F && p.got && !bad ? null : item, bandana: bandanaOf(p) });
        if (lean) g.restore();
      }
      if (F === 'bitten') Z.glow(g, x, y - 120 * P.s, 110 * P.s, 'rgba(140,255,90,A)', 0.35);
      if (F === 'dead' && rv > 900) { const gk = clamp((rv - 900) / 1500); Z.ghost(g, x, y - 140 - gk * 240, P.s * 0.8, t, { avatar: p.avatar, alpha: 0.85 * (1 - clamp((rv - 2600) / 700)) }); }
      if (a === 'hide' && !(F === 'safe' && rv > 200)) Pr.cover(g, loc, null, P.x, P.y + 2, P.s * 1.05);
      // pick-ups: the item lifts off the shelf into their hands
      const icon = p.got || (a === 'search' ? gains[i % Math.max(1, gains.length)] : null);
      if (a === 'search' && icon) {
        const lift = F && p.got && !bad ? clamp(rv / 650) : 0, hx = x + 10, hy = y - 250 * P.s;
        const sx = P.x + 95 * P.s + 20, ix = lerp(sx, hx, easeOut(lift)), iy = lerp(shelfY - 30, hy, easeOut(lift)) - Math.sin(lift * Math.PI) * 60;
        if (!lift) Z.glow(g, sx, shelfY - 30, 70, 'rgba(255,240,150,A)', 0.35 + 0.15 * Math.sin(t * 5 + i));
        Z.emoji(g, icon, ix, iy, 58 + 20 * lift);
      } else if (p.got && F && !bad) { const gk = clamp((rv - 200) / 900); g.globalAlpha = 1 - clamp((rv - 2600) / 400); Z.text(g, '+', x - 34, y - 270 * P.s - gk * 40, 46, '#fff', { stroke: '#120d1c', lw: 8 }); Z.emoji(g, p.got, x + 12, y - 270 * P.s - gk * 40, 58); g.globalAlpha = 1; }
      if (a === 'fight' && inConseq && !F) { const k2 = clamp((v - actEnd - i * 140) / 220); if (k2 > 0 && k2 < 1) Z.burst(g, x + 120 * P.s, y - 170 * P.s, 70, p.used === '🔫' ? 'BANG!' : 'POW!', '#ffd34a', '#120d1c', Z.util.back(k2)); }
      if (a === 'decoy' && v > 200 && v < actEnd + CONSEQ) Z.emoji(g, G.icon, x + 110 * P.s + 30, y - 150 * P.s - Math.abs(Math.sin(t * 8 + i)) * 30, 70 + 30 * P.s);
      if (a === 'decoy' && v > 200 && v < actEnd + CONSEQ) Z.text(g, '!!!', x + 60, y - 260 * P.s + Math.sin(t * 12 + i) * 6, 50, '#ff7ab8', { stroke: '#120d1c', lw: 8 });
      if (a === 'rest' && !F) Z.text(g, 'z', x + 40 + Math.sin(t * 2 + i) * 10, y - 230 * P.s - ((t * 30 + i * 20) % 60), 40, '#c9d4ff', { stroke: '#120d1c', lw: 6 });
      if (a === 'talk' && !F && Math.floor(t * 1.5 + i) % 2) { g.fillStyle = '#fff'; Z.rr(g, x - 40, y - 300 * P.s, 80, 46, 20); g.fill(); Z.text(g, '…', x, y - 280 * P.s, 36, '#120d1c'); }
      if (p.froze && !F) Z.text(g, '❄️ froze!', x, y - 260 * P.s, 30, '#9fe8ff', { stroke: '#120d1c', lw: 6 });
      if (!pos[i]) pos[i] = { x, y };
    }
    // the cars over their passengers (heads in the windows)
    const veh = VEHICLES.includes(G.icon) ? G.icon : null;
    carX.forEach((cx, c) => {
      if (veh) { g.save(); g.translate(cx, G0 - 120); g.scale(-1, 1); Z.emoji(g, veh, 0, 0, 260); g.restore(); ppl.forEach((p, i) => { if (Math.floor(i / 4) !== c || !pos[i] || !pos[i].hidden) return; Z.emoji(g, p.avatar, cx - 70 + (i % 4) * 46, G0 - 280 + Math.sin(t * 8 + i) * 3, 64, p.at <= u && p.fate === 'bitten' ? 'sick' : null); }); return; }
      Z.car(g, cx, G0 - 10, 1.05, ['#c94a4a', '#3d6f8f', '#7a6a2a', '#5a7a4a'][c % 4]);
      ppl.forEach((p, i) => { if (Math.floor(i / 4) !== c || !pos[i] || !pos[i].hidden) return; Z.emoji(g, p.avatar, cx - 30 + (i % 4) * 42, G0 - 125 + Math.sin(t * 8 + i) * 3, 52, p.at <= u && p.fate === 'bitten' ? 'sick' : null); });
    });
    // big verdict stamps (the newest one large, the rest as a small icon)
    for (const i of order) {
      const p = ppl[i], P = L[i], rv = u - p.at; if (rv < 0) continue;
      const x = pos[i].hidden ? pos[i].cx - 30 + (i % 4) * 42 : pos[i].x, top = pos[i].hidden ? G0 - 200 : pos[i].y - 250 * P.s;
      if (rv < 1500 && i === lastRevealed(ppl, u)) stamp(g, x, Math.max(V.top + 0.4 * (V.bottom - V.top), top - 60), p.fate, rv, Math.max(0.75, Math.min(1.1, P.s + 0.25)));
      else if (p.fate !== 'dead') Z.emoji(g, VERDICT[p.fate].icon, x - 60 * P.s - 10, top + 30, 30 + 18 * P.s);
      if (p.why && (p.saved || p.doomed)) { const k2 = Z.util.clamp(rv / 400); Z.glow(g, x + 60 * P.s + 10, top + 30, 50, p.saved ? 'rgba(160,255,140,A)' : 'rgba(255,110,90,A)', 0.5 * k2); Z.emoji(g, p.why.icon, x + 60 * P.s + 10, top + 30 - (1 - k2) * 30, (30 + 18 * P.s) * (0.6 + 0.4 * k2)); }
    }
    // name plates last, so nothing ever covers them; after the verdict they take its colour
    for (const P of L) {
      const p = ppl[P.i], F = u >= p.at ? p.fate : null, V2 = F && VERDICT[F];
      const px = pos[P.i] && !pos[P.i].hidden && a !== 'climb' ? pos[P.i].x : P.x;
      namePlate(g, p.name, { ...P, x: px }, { color: V2 ? V2.col : p.color, bg: V2 ? V2.bg : null, icon: V2 ? V2.icon : null });
    }
    if (G.more) A().plate(g, 1830, G0 - 80, `+${G.more} more`, { px: 28, color: '#9dff5a' });
  }
  function lastRevealed(ppl, u) { let k = -1; ppl.forEach((p, i) => { if (u >= p.at) k = i; }); return k; }
  function drawFever(g, s, F, u, t) {
    const Z = A(), { clamp } = Z.util, n = F.people.length, L = rowLayout(n);
    g.fillStyle = 'rgba(20,60,10,0.35)'; g.fillRect(-200, -200, 2400, 1500);
    for (const P of L) {
      const p = F.people[P.i], rv = u - p.at, done = rv >= 0;
      if (done && p.fate === 'turned') {
        Z.zombie(g, P.x, P.y, P.s * 0.95, t, { seed: P.i + 7, dir: P.i % 2 ? -1 : 1 });
        Z.emoji(g, p.avatar, P.x + 4 * P.s * (P.i % 2 ? -1 : 1), P.y - 188 * P.s, 74 * P.s, 'sick');
      } else {
        Z.survivor(g, P.x + (done ? 0 : Math.sin(t * 30 + P.i) * 3), P.y, P.s, t, { avatar: p.avatar, color: p.color, pose: done ? 'cheer' : 'idle', ph: P.i, tint: done ? null : 'sick', bandana: bandanaOf(p) });
        if (!done) Z.glow(g, P.x, P.y - 130 * P.s, 120 * P.s, 'rgba(140,255,90,A)', 0.3 + 0.2 * Math.sin(t * 6));
        else { const k = clamp(rv / 700); Z.emoji(g, p.how || '🩹', P.x + 50, P.y - 220 * P.s - k * 40, 64); Z.glow(g, P.x, P.y - 120 * P.s, 160, 'rgba(255,255,200,A)', 0.4 * (1 - k)); }
      }
      if (done && rv < 1600) stamp(g, P.x, P.y - 300 * P.s, p.fate === 'turned' ? 'turned' : 'cured', rv, Math.max(0.75, P.s + 0.2));
    }
    for (const P of L) { const p = F.people[P.i], V2 = u >= p.at ? VERDICT[p.fate === 'turned' ? 'turned' : 'cured'] : null; namePlate(g, p.name, P, { color: V2 ? V2.col : '#c8ff5a', bg: V2 ? V2.bg : null, icon: V2 ? V2.icon : '🦷' }); }
  }
  function aliveAfter(O) {
    const out = []; for (const G of O.groups) for (const p of G.people) if (p.fate !== 'dead') out.push({ ...p, status: p.fate === 'safe' ? 'ok' : p.fate });
    if (O.fever) for (const p of O.fever.people) { const i = out.findIndex((x) => x.id === p.id); if (p.fate === 'turned' && i >= 0) out.splice(i, 1); }
    return out;
  }
  function drawOutcome(g, s, t, u, loc) {
    const Z = A(), O = s.outcome, groups = O.groups;
    const cur = groups.find((G) => u >= G.at && u < G.at + G.ms);
    const fever = O.fever && u >= O.fever.at && u < O.endAt ? O.fever : null;
    const seg = cur ? (u - cur.at) / cur.ms : 0, zoom = 1 + 0.035 * seg;
    g.save(); g.translate(960, 640); g.scale(zoom, zoom); g.translate(-960, -640);
    Z.backdrop(g, loc, t, { dark: cur || fever ? 0.3 : 0.55 });
    if (cur) drawGroup(g, s, cur, u, t, loc);
    else if (fever) drawFever(g, s, fever, u, t);
    else if (u < O.recapMs) { shamblers(g, t, 5, 860, 0.6, { alpha: 0.8 }); Z.fog(g, t, 0.25); }
    else drawTally(g, s, t, u);
    g.restore();
    // sound + narration on each beat
    cue('recap', 0, u, () => { BOX.sfx('groan'); say(s, 'Here’s what everyone chose. ' + O.recap, O.recapMs); });
    groups.forEach((G, gi) => {
      const actEnd = G.verdictAt - CONSEQ;
      cue('g' + gi, G.at, u, () => { BOX.sfx(ANIM_SFX[G.anim] || 'whoosh'); say(s, G.setup + '…', actEnd - G.at); });
      cue('c' + gi, actEnd, u, () => {
        if (G.role === 'hold' && G.anim === 'hold') BOX.sfx(O.groupOk === false ? 'shatter' : 'knock'); else BOX.sfx('groan');
        if (G.people.some((p) => p.used === '🔫')) BOX.sfx('shot');
      });
      cue('v' + gi, G.verdictAt, u, () => say(s, G.line, G.at + G.ms - G.verdictAt));
      G.people.forEach((p, i) => cue(`p${gi}-${i}`, p.at, u, () => {
        if (G.per < 450 && p.fate === 'safe') return;
        BOX.sfx({ safe: 'pop', hurt: 'hit', bitten: 'groan', dead: 'fall' }[p.fate] || 'pop');
        if (p.fate === 'dead') setTimeout(() => BOX.sfx('spirit'), 900);
      }));
    });
    if (O.fever) {
      cue('fv', O.fever.at, u, () => { BOX.sfx('heartbeat'); say(s, O.fever.line, O.endAt - O.fever.at); });
      O.fever.people.forEach((p, i) => cue('fp' + i, p.at, u, () => BOX.sfx(p.fate === 'turned' ? 'groan' : 'shield')));
    }
    cue('end', O.endAt, u, () => { BOX.sfx(O.final ? 'win' : 'reveal'); say(s, O.final ? `${O.tally.made} survivors made the last flight!` : `${O.tally.made} still standing${O.tally.fell ? `, ${O.tally.fell} fell` : ''}.`, 4000); });
  }
  function drawTally(g, s, t, u) {
    const Z = A(), O = s.outcome, v = u - O.endAt, alive = aliveAfter(O);
    if (O.final) {
      const k = Z.util.clamp(v / 4500), x = 960 + k * 1500 - 200, y = 330 - k * 260;
      Z.chopper(g, x, y, 0.85, t, { faces: alive.map((p) => p.avatar), ladder: 200 * (1 - k), light: true, lightX: -100 });
      crowd(g, alive.slice(0, Math.max(0, Math.round(alive.length * (1 - k * 1.6)))), t, { pose: 'cheer', names: false });
      return;
    }
    crowd(g, alive, t, { pose: 'idle', names: false });
    shamblers(g, t, 3, 800, 0.5, { alpha: 0.6 });
  }
  function drawOver(g, s, t, u) {
    const Z = A(), E = s.epilogue || { rescued: [], wipe: true };
    if (E.wipe) { Z.backdrop(g, 'streets', t, { dark: 0.6 }); shamblers(g, t, 9, 1000, 0.9); Z.fog(g, t, 0.3); return; }
    Z.backdrop(g, 'rescue', t, { dark: 0.15 });
    const k = ((u / 1000) % 14) / 14, x = -400 + k * 2800, y = 260 + Math.sin(t * 0.8) * 20;
    Z.chopper(g, x, y, 0.7, t, { faces: E.rescued.map((p) => p.avatar), tilt: -0.08 });
  }

  // ---------- the HUD ----------
  function topBar(s, right = '') {
    return `<div class="zs-top"><span class="zs-day">DAY ${s.chapter.day}</span><span class="zs-loc">${esc(s.chapter.name)}</span><span class="zs-n">Scene ${s.n} of ${s.total}</span><span class="zs-sp"></span>${right}<span class="zs-pop">🧍 ${s.alive}${s.ghosts || s.dead ? ` · 👻 ${s.dead}` : ''}</span></div>`;
  }
  const chip = (p) => `<span class="zs-nchip" style="--c:${esc(p.color || '#9dff5a')}"><i>${esc(p.avatar || '🙂')}</i>${esc(p.name)}</span>`;
  const chips = (list, more = 0, cap = 12) => list.slice(0, cap).map(chip).join('') + (list.length > cap || more ? `<span class="zs-nchip more">+${list.length - cap > 0 ? list.length - cap + more : more} more</span>` : '');
  function hud(s, u) {
    if (s.phase === 'chapter') {
      return `<div class="zs-chapter" id="zsc-${s.chapter.day}"><div class="zs-cday">DAY ${s.chapter.day}</div><div class="zs-cname">${esc(s.chapter.name)}</div><div class="zs-cline">${esc(s.chapter.line)}</div>${s.chapter.last ? '<div class="zs-clast">🚁 THE LAST NIGHT 🚁</div>' : ''}</div>`;
    }
    if (s.phase === 'choose' && s.scene) {
      const sc = s.scene, pct = s.of ? Math.round((s.chosen / s.of) * 100) : 0;
      return `${topBar(s, `<span class="zs-clock">⏱ ${timer('c' + s.n, s.endsIn)}</span>`)}
        <div class="zs-card ${sc.final ? 'final' : ''}" id="zsk-${s.n}">${sc.final ? '<div class="zs-final">🚁 THE RESCUE 🚁</div>' : ''}<h2>${esc(sc.title)}</h2><p>${esc(sc.text)}</p>
          <div class="zs-opts n${sc.options.length}">${sc.options.map((o, i) => `<div class="zs-opt" style="--d:${0.15 + i * 0.12}s"><span class="zs-oi">${o.icon}</span><b>${esc(o.label)}</b><span class="zs-tags">${tag(o)}</span></div>`).join('')}</div>
          <div class="zs-prog"><div class="fill" style="width:${pct}%"></div><span>📱 ${s.chosen} / ${s.of} survivors have chosen${s.ghosts && s.dead ? ` · 👻 ${s.haunted} haunting` : ''}</span></div>
          ${s.waiting && s.waiting.length && s.chosen ? `<div class="zs-wait">Still deciding: ${s.waiting.map(esc).join(', ')}</div>` : ''}
          ${s.gifts && s.gifts.length ? `<div class="zs-gifts">${s.gifts.map((x) => `<span>🎁 ${esc(x.from)} gave ${x.item} to ${esc(x.to)}</span>`).join('')}</div>` : ''}</div>`;
    }
    if (s.phase === 'outcome' && s.outcome) {
      const O = s.outcome, cur = O.groups.find((G) => u >= G.at && u < G.at + G.ms);
      const fever = O.fever && u >= O.fever.at && u < O.endAt;
      let mid = '';
      if (u < O.recapMs) {
        mid = `<div class="zs-recap" id="zsr-${s.n}"><h2>${esc(O.title || '')}: what everyone chose</h2><div class="zs-rgrid n${Math.min(5, O.groups.length)}">${O.groups.map((G, i) => `<div class="zs-rcard" style="--d:${0.2 + i * 0.35}s"><div class="zs-rh"><span>${G.icon}</span><b>${esc(G.label)}</b><small>${G.total}</small></div><div class="zs-rnames">${chips(G.people, G.more, 10)}</div></div>`).join('')}</div></div>`;
      } else if (cur) {
        const i = O.groups.indexOf(cur), actEnd = cur.verdictAt - CONSEQ, k = lastRevealed(cur.people, u), last = cur.people[cur.people.length - 1];
        let beat;
        if (u < actEnd) beat = `<div class="zs-beat" id="zsbt-${s.n}-${i}-a">▶ ${esc(cur.setup)}…</div>`;
        else if (u < cur.verdictAt) beat = `<div class="zs-beat warn" id="zsbt-${s.n}-${i}-c">${cur.role && O.groupLine ? `<b class="${O.groupOk === false ? 'bad' : 'good'}">${esc(O.groupLine)}</b>` : '🧟 Here they come…'}</div>`;
        else if (last && u < last.at + 1300 && k >= 0) { const p = cur.people[k], V2 = VERDICT[p.fate]; beat = `<div class="zs-beat verdict" id="zsbt-${s.n}-${i}-v${k}" style="--c:${V2.col}">${V2.icon} <b>${esc(p.name)}</b> ${V2.say}${p.why ? `<small class="zs-why ${p.why.good ? 'good' : p.why.bad ? 'bad' : ''}">${p.why.icon} ${esc(p.why.text)}</small>` : ''}</div>`; }
        else beat = `<div class="zs-beat line" id="zsbt-${s.n}-${i}-l">${esc(cur.line)}</div>`;
        mid = `<div class="zs-banner" id="zsb-${s.n}-${i}"><span class="zs-bi">${cur.icon}</span><b>${esc(cur.label)}</b><small>${plural(cur.total, 'survivor')} · ${i + 1} of ${O.groups.length}</small>${cur.twist && u >= actEnd ? `<em class="zs-twist ${cur.twist}">${cur.twist === 'worse' ? '😬 worse than it looked' : '🍀 better than it looked'}</em>` : ''}</div>${beat}`;
      } else if (fever) {
        const F = O.fever, k = lastRevealed(F.people, u);
        mid = `<div class="zs-banner fever" id="zsb-${s.n}-f"><span class="zs-bi">🌡️</span><b>The fever</b><small>bites from the last scene</small></div>${k >= 0 ? `<div class="zs-beat verdict" id="zsbt-${s.n}-f${k}" style="--c:${F.people[k].fate === 'turned' ? '#ff6b6b' : '#7dff8a'}">${F.people[k].fate === 'turned' ? '🧟' : '🩹'} <b>${esc(F.people[k].name)}</b> ${F.people[k].fate === 'turned' ? 'turned!' : F.people[k].how === '💉' ? 'the vaccine kicked in!' : 'is cured!'}</div>` : `<div class="zs-beat" id="zsbt-${s.n}-f">🦷 No medkit by now means trouble…</div>`}`;
      } else {
        const tl = O.tally, Ls = tl.lists || {};
        const col = (cls, icon, title, list, n) => (n ? `<div class="zs-tcol ${cls}"><h3>${icon} ${title} <b>${n}</b></h3><div class="zs-tnames">${chips(list, Math.max(0, n - list.length), 14)}</div></div>` : '');
        mid = `<div class="zs-tally2" id="zst-${s.n}">${O.final ? `<div class="zs-rescued">🚁 ${plural(tl.made, 'survivor')} made the last flight!</div>` : `<h2>End of the scene · ${tl.made} still standing</h2>`}
          <div class="zs-tcols">${col('ok', '✅', 'Made it', Ls.ok || [], tl.made - tl.hurt - tl.bitten)}${col('hu', '🤕', 'Hurt', Ls.hurt || [], tl.hurt)}${col('bi', '🦷', 'Bitten', Ls.bitten || [], tl.bitten)}${col('de', '💀', 'Fell', Ls.fell || [], tl.fell)}</div></div>`;
      }
      return `${topBar(s)}${mid}`;
    }
    if (s.phase === 'board') {
      return `${topBar(s, `<span class="zs-clock">Next scene ${timer('b' + s.n, s.endsIn)}</span>`)}
        <div class="zs-board"><h2 id="zsbh-${s.n}">${plural(s.alive, 'survivor')} still standing${s.dead ? ` · ${plural(s.dead, 'ghost')}` : ''}</h2>
        <aside class="zs-lead"><h3>🏆 Longest survivors</h3>${s.standings.slice(0, 8).map((r, i) => `<div class="zs-row ${r.alive ? '' : 'ghost'}"><span class="n">${i + 1}</span><span class="av">${r.alive ? esc(r.avatar) : '👻'}</span><span class="nm">${esc(r.name)}${r.alive ? '' : `<small class="zs-rch">${esc(r.reach || '')}</small>`}</span>${r.alive ? `<span class="st">${STATUS[r.status] ? STATUS[r.status][0] : ''}</span>` : ''}<b>${r.pts}</b></div>`).join('')}
        ${s.haunts && s.haunts.length ? `<h3>👻 Hauntings</h3>${s.haunts.slice(0, 5).map((h) => `<div class="zs-haunt">${esc(h.from)} ${h.mode === 'bless' ? '🍀 blessed' : '🕯️ cursed'} ${esc(h.to)} ${h.hit ? '<b>✓</b>' : ''}</div>`).join('')}` : ''}</aside></div>`;
    }
    if (s.phase === 'over' && s.epilogue) {
      const E = s.epilogue, st = s.standings;
      return `<div class="zs-end" id="zse"><div class="zs-endhead">${E.wipe ? '<h1 class="zs-wipe">NOBODY MADE IT</h1><p>The city belongs to the shamblers now… but what a story.</p>' : `<h1>THE END</h1><p>${plural(E.rescued.length, 'survivor')} made it out: ${E.rescued.slice(0, 10).map((p) => `${esc(p.avatar)} ${esc(p.name)}`).join(' · ')}${E.rescued.length > 10 ? ` +${E.rescued.length - 10}` : ''}</p>`}</div>
        <div class="zs-endgrid"><section class="zs-fates"><h3>📜 What happened to everyone</h3><div class="zs-roll"><div class="zs-rollin" style="--n:${E.fates.length}">${E.fates.map((f) => `<div class="zs-fate ${f.rescued ? 'r' : f.alive ? '' : 'd'}"><span>${f.rescued ? '🚁' : f.alive ? '🧍' : '👻'}</span><span class="av">${esc(f.avatar)}</span><span><b class="zs-reach">${esc(f.reach || '')}</b> ${esc(f.line)}${f.flags && f.flags.length ? ` <i class="zs-fflags">${f.flags.map((x) => x.icon).join('')}</i>` : ''}</span></div>`).join('')}</div></div></section>
        <section class="zs-awards">${E.awards.map((a, i) => `<div class="zs-award" style="--d:${0.6 + i * 0.25}s"><span class="ic">${a.icon}</span><b>${esc(a.title)}</b><span>${a.names.map(esc).join(', ')}</span><small>${esc(a.text)}</small></div>`).join('')}
          <div class="zs-final-board"><h3>🏆 Who got furthest</h3>${st.slice(0, 6).map((r, i) => `<div class="zs-row ${r.alive ? '' : 'ghost'}"><span class="n">${i === 0 ? '👑' : i + 1}</span><span class="av">${esc(r.avatar)}</span><span class="nm">${esc(r.name)}<small class="zs-rch">${esc(r.reach || '')}</small></span><b>${r.pts}</b></div>`).join('')}</div></section></div></div>`;
    }
    return '';
  }

  // =========================================================================================
  // TV lobby: the safehouse
  // =========================================================================================
  const SUPPLY = { length: ['🗺️', 'Map of the route'], difficulty: ['☠️', 'Danger level'], timer: ['⏱️', 'Wind-up timer'], ghosts: ['👻', 'Spirit board'], narrator: ['📻', 'Old radio'], showIntro: ['📺', 'Emergency broadcast'] };
  let lobbyErr = '';
  function lobbyBg(cv) {
    addLoop((now) => {
      if (!cv.isConnected) return false;
      const Z = A(); if (!Z) return true;
      const { w, h, d } = fit(cv, 1), g = cv.getContext('2d'), t = now / 1000;
      g.setTransform(1, 0, 0, 1, 0, 0); Z.cover(g, w, h, d);
      // the street outside, through the boarded window
      const WX = 900, WY = 560, WW = 820, WH = 340;
      g.save(); g.beginPath(); g.rect(WX, WY, WW, WH); g.clip();
      Z.backdrop(g, 'streets', t, { dark: 0.45 });
      for (let i = 0; i < 3; i++) { const x = i % 2 ? ((t * 40 + i * 700) % 2200) - 140 : 1920 - (((t * 40 + i * 700) % 2200) - 140); Z.zombie(g, x, 872 + i * 10, 0.8, t, { seed: i, dir: i % 2 ? 1 : -1, alpha: 0.95 }); }
      g.restore();
      // the safehouse walls (planks)
      g.fillStyle = '#2b1c14'; g.beginPath(); g.rect(-200, -200, 2400, 1500); g.rect(WX, WY, WW, WH); g.fill('evenodd');
      for (let y = -40; y < 1100; y += 64) { g.fillStyle = (y / 64) % 2 ? '#33221a' : '#2e1f17'; g.fillRect(-200, y, WX + 200, 60); g.fillRect(WX + WW, y, 2200 - WX - WW, 60); if (y + 60 < WY || y > WY + WH) g.fillRect(WX, y, WW, 60); }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; for (let y = -40; y < 1100; y += 64) { if (y > WY && y < WY + WH) { g.beginPath(); g.moveTo(-200, y); g.lineTo(WX, y); g.moveTo(WX + WW, y); g.lineTo(2200, y); g.stroke(); continue; } g.beginPath(); g.moveTo(-200, y); g.lineTo(2200, y); g.stroke(); }
      // boards over the window
      for (const [y, r] of [[WY + 70, 0.08], [WY + 190, -0.06], [WY + 290, 0.1]]) { g.save(); g.translate(WX + WW / 2, y); g.rotate(r); g.fillStyle = '#7a5434'; g.strokeStyle = '#3a2414'; g.lineWidth = 6; Z.rr(g, -460, -26, 920, 52, 6); g.fill(); g.stroke(); g.fillStyle = '#c9c9c9'; for (const nx of [-420, 420]) { g.beginPath(); g.arc(nx, 0, 7, 0, Z.util.TAU); g.fill(); } g.restore(); }
      g.strokeStyle = '#4a3020'; g.lineWidth = 22; g.strokeRect(WX, WY, WW, WH);
      // moonlight beams
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(160,190,255,0.06)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(WX + 40 + i * 260, WY + WH); g.lineTo(WX + 160 + i * 260, WY + WH); g.lineTo(WX + 300 + i * 330, 1080); g.lineTo(WX + 60 + i * 330, 1080); g.fill(); } g.restore();
      // a swinging lantern
      const sw = Math.sin(t * 1.3) * 0.12; g.save(); g.translate(700, 420); g.rotate(sw); g.strokeStyle = '#222'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 170); g.stroke();
      Z.glow(g, 0, 210, 420, 'rgba(255,180,90,A)', 0.32 + 0.04 * Math.sin(t * 9)); g.fillStyle = '#3a3a3a'; Z.rr(g, -30, 170, 60, 80, 10); g.fill(); g.fillStyle = '#ffcf6a'; Z.rr(g, -20, 182, 40, 56, 8); g.fill(); g.restore();
      Z.vignette(g, 0.65);
      return true;
    });
  }
  function lobbyTv(el, L) {
    const n = L.players.length, need = Math.max(0, (L.min || 1) - n);
    if (!el._zsl || !el.contains(el._zsl)) {
      el.innerHTML = '<div class="zs-lobby"><canvas class="zs-lbg"></canvas><div class="zs-lui" id="zs-lui"></div></div>';
      el._zsl = el.firstElementChild; lobbyBg(el.querySelector('.zs-lbg'));
    }
    const items = L.fields.map((f, i) => {
      const cur = f.options.find((o) => String(o.value) === String(L.settings[f.key])) || f.options[0];
      const [ic, what] = SUPPLY[f.key] || ['📦', f.label];
      return `<div class="zs-sup" role="button" tabindex="0" data-sup="${esc(f.key)}" style="--r:${((i % 3) - 1) * 2.5}deg;--d:${i * 0.08}s"><span class="ic">${ic}</span><span class="lb">${esc(f.label)}</span><b id="zsv-${esc(f.key)}-${esc(String(cur.value))}">${esc(cur.label)}</b><small>${esc(what)} · tap to change</small>
        <select data-set="${esc(f.key)}" tabindex="-1" aria-label="${esc(f.label)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(o.value) === String(cur.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
    }).join('');
    BOX.morph(el.querySelector('#zs-lui'), `<header class="zs-lhead"><div class="zs-logo"><span class="a">ZOMBIE</span><span class="b">SURVIVAL</span></div><div class="zs-ltag">The safehouse is open. Sign in, grab your supplies, and try to live till the rescue.</div></header>
      <section class="zs-board-l"><div class="zs-note"><span class="pin"></span><div class="zs-nt">SURVIVORS: SCAN TO SIGN IN</div><img id="qr" alt="QR code to join" src="${esc(L.qr)}"><div class="zs-url">${esc(L.joinUrl.replace(/^https?:\/\//, ''))}</div></div>
        <div class="zs-sign"><small>Safehouse code</small><div id="code">${esc(L.code)}</div></div>
        <div class="zs-vip">${L.vip ? `👑 <b>${esc(L.vip)}</b> leads the group and can start from their phone` : 'The first survivor to sign in leads the group 👑'}</div></section>
      <section class="zs-table"><h3>🧰 Supplies on the table</h3><div class="zs-sups" id="settings">${items}</div>
        <button class="zs-start" id="start" ${need ? 'disabled' : ''}>🚪 Open the door. Let’s go!</button><div class="zs-err" id="lobby-err">${esc(lobbyErr)}</div>
        <div class="zs-links"><button id="add-bots">+ 5 test bots</button><button id="rm-bots">remove bots</button><button id="zs-pick">🎮 another game</button><button id="zs-back">◀ games</button></div></section>
      <section class="zs-log"><h3>📋 Survivor log <b>${n}</b>/${L.max || 100} ${n && n < 4 ? '<small>AI survivors will join a small group</small>' : ''}</h3><div class="zs-roster" id="roster">${L.players.map((p, i) => `<span class="chip zs-chip ${p.online ? '' : 'off'}" id="zsl-${esc(p.id)}" data-kick="${esc(p.id)}" title="Click to remove" style="--c:${esc(p.color || '#ffd23f')};--r:${((i * 7) % 5) - 2}deg"><span class="av">${esc(p.avatar || '🙂')}</span><span class="nm">${esc(p.name)}</span><small>#${String(i + 1).padStart(2, '0')}</small></span>`).join('') || '<div class="zs-empty">The log is empty. Scan the note to sign in!</div>'}</div>${L.lineupHtml ? `<div class="zs-lineup">${L.lineupHtml}</div>` : ''}</section>`);
    const box = el.querySelector('#zs-lui');
    for (const s of box.querySelectorAll('select[data-set]')) { s.onchange = () => { BOX.sfx('click'); L.set(s.dataset.set, s.value); }; s.onclick = (e) => e.stopPropagation(); }
    for (const b of box.querySelectorAll('[data-sup]')) b.onclick = () => { const s = b.querySelector('select'); s.selectedIndex = (s.selectedIndex + 1) % s.options.length; s.onchange(); };
    box.querySelector('#start').onclick = async () => { const r = await L.start(); lobbyErr = r && !r.ok ? r.error || 'Could not start.' : ''; const e = box.querySelector('#lobby-err'); if (e) e.textContent = lobbyErr; if (r && r.ok) BOX.sfx('creak'); };
    box.querySelector('#add-bots').onclick = () => L.bots(5);
    box.querySelector('#rm-bots').onclick = () => L.removeBots();
    box.querySelector('#zs-pick').onclick = () => L.pick();
    box.querySelector('#zs-back').onclick = () => L.back();
    for (const c of box.querySelectorAll('[data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) L.kick(c.dataset.kick); };
  }

  // =========================================================================================
  // Phone
  // =========================================================================================
  const P = { give: false, item: null, felt: '', warned: '', turnKey: '', revealT: 0 };
  function paint(el, html, key) {
    if (el._zsKey === key && el._zsHtml === html) return false;
    const fresh = el._zsKey !== key; el._zsKey = key; el._zsHtml = html;
    BOX.morph(el, `<div class="zs-ph" id="zsp-${esc(key)}">${html}</div>`);
    return fresh;
  }
  function head(v) {
    const me = v.me; if (!me) return '';
    const [ic, word] = me.alive ? STATUS[me.status] || STATUS.ok : STATUS.dead;
    const slots = [0, 1, 2, 3].map((i) => { const it = me.items && me.items[i]; return `<span class="zs-slot ${it ? 'on' : ''}">${it ? `${it.icon}${it.n != null && it.n > 1 ? `<i>${it.n}</i>` : ''}` : ''}</span>`; }).join('');
    const calm = v.phase === 'chapter' || v.phase === 'choose' || v.phase === 'board';
    const hints = me.alive && calm && me.items && me.items.length ? `<div class="zs-hints">${me.items.map((i) => `<span><b>${i.icon} ${esc(i.name)}${i.n != null && i.unit ? ` (${i.n} ${esc(i.unit)})` : ''}</b> ${esc(i.hint || '')}</span>`).join('')}</div>` : '';
    const story = me.flags && me.flags.length ? `<div class="zs-story"><span class="lb">📜</span>${me.flags.map((f) => `<span class="zs-badge ${f.bad ? 'bad' : ''}">${f.icon} ${esc(f.label)}</span>`).join('')}</div>` : '';
    // Your gear bandana (JustGold shop), as a little knot next to your status.
    const bd = me.alive ? bandanaOf(me) : null;
    const knot = bd ? `<svg class="zs-bandana" width="34" height="22" viewBox="0 0 34 22" aria-hidden="true" style="vertical-align:middle;margin-right:4px${bd.glow ? `;filter:drop-shadow(0 0 4px ${esc(bd.a || '#fff')})` : ''}"><path d="M4 6 Q17 1 30 6 L30 13 Q17 8 4 13 Z" fill="${esc(bd.a || '#d0302a')}" stroke="#1a1a1a" stroke-width="1.6"/><path d="M4 9 L0 18 L5 16 L7 20 L8 11 Z" fill="${esc(bd.a || '#d0302a')}" stroke="#1a1a1a" stroke-width="1.4"/>${bd.pattern === 'dots' ? `<circle cx="11" cy="7.5" r="1.4" fill="${esc(bd.b || '#fff')}"/><circle cx="17" cy="6.5" r="1.4" fill="${esc(bd.b || '#fff')}"/><circle cx="23" cy="7.5" r="1.4" fill="${esc(bd.b || '#fff')}"/>` : bd.pattern === 'stripes' ? `<path d="M10 11 L13 4 M17 10 L20 3.5 M24 11 L27 4.5" stroke="${esc(bd.b || '#fff')}" stroke-width="2.2"/>` : ''}</svg>` : '';
    return `<div class="zs-phead"><span class="zs-stat ${me.alive ? me.status : 'ghost'}">${knot}${ic} ${word}</span><span class="zs-pts">⭐ ${me.pts || 0}</span><span class="zs-scn">Day ${v.chapter.day} · ${v.n}/${v.total}</span></div>${me.alive ? `<div class="zs-pack"><span class="lb">🎒</span>${slots}</div>${hints}` : ''}${me.alive && calm ? story : ''}`;
  }
  function phone(el, v, ctx, outer) {
    if (!v) return;
    const me = v.me;
    if (!me) { paint(el, `<div class="zs-pcard"><div class="zs-pbig">🚪</div><h3>You’ll join the story at the next scene!</h3></div>`, 'wait'); return; }
    const key = v.phase + '-' + v.n;
    if (v.phase === 'choose' && P.turnKey !== key) { P.turnKey = key; P.give = false; P.item = null; ctx.haptic(me.alive ? 'turn' : 'select'); if (me.alive && me.status === 'bitten') { ctx.haptic('warn'); } }
    let html = head(v), bind = null;
    if (v.phase === 'choose' || v.phase === 'chapter') P.head = html;
    if (v.phase === 'outcome' && v.mine && P.head && !revealed(v, outer)) html = P.head;
    if (v.phase === 'chapter') html += `<div class="zs-pcard zs-pch"><div class="zs-pday">DAY ${v.chapter.day}</div><h2>${esc(v.chapter.name)}</h2><p>${esc(v.chapter.line)}</p><p class="muted">📺 Watch the big screen…</p></div>`;
    else if (v.phase === 'choose' && v.scene) { const r = me.alive ? choosePhone(v, ctx) : ghostPhone(v, ctx); html += r.html; bind = r.bind; }
    else if (v.phase === 'outcome' || v.phase === 'board') html += resultPhone(v, ctx, outer);
    else if (v.phase === 'over') html += endPhone(v, ctx);
    paint(el, html, key);
    if (bind) bind(el);
  }
  function choosePhone(v, ctx) {
    const me = v.me, sc = v.scene;
    if (!me.inScene) return { html: '<div class="zs-pcard"><div class="zs-pbig">🚪</div><h3>You stumble into the group…</h3><p>You’re in from the next scene.</p></div>' };
    const t = timer('p' + v.n, v.endsIn);
    const alert = me.status === 'bitten' ? `<div class="zs-alert bite">🦷 <b>You’re bitten!</b> ${me.items.some((i) => i.k === 'medkit') ? 'Your 🩹 medkit will cure it at the end of this scene.' : me.bittenNow ? 'Get a 🩹 medkit from a friend before this scene ends, or you turn!' : 'Find a 🩹 medkit by the end of the NEXT scene, or you turn.'}</div>` : me.status === 'hurt' ? '<div class="zs-alert hurt">🤕 You’re hurt: get hurt again and you fall (a 🩹 medkit would patch you up). One clean escape, or a rest, heals you.</div>' : '';
    const opts = sc.options.map((o) => {
      const lock = v.locked.includes(o.k), sel = v.pick === o.k, boost = v.boost.includes(o.k);
      return `<button class="zs-po ${sel ? 'sel' : ''} ${lock ? 'lock' : ''}" data-k="${esc(o.k)}" ${lock ? 'disabled' : ''}><span class="ic">${o.icon}</span><span class="tx"><b>${esc(o.label)}</b><span class="zs-tags">${lock ? `<i class="zs-t need">🔒 needs ${o.need}</i>` : ''}${boost ? '<i class="zs-t boost">⭐ your gear or past could help</i>' : o.help || o.flags ? `<i class="zs-t help">better with ${o.help || ''}${o.flags || ''}</i>` : ''}${danger(o)}${o.gain ? `<i class="zs-t gain">find ${o.gain}</i>` : ''}${o.heal ? '<i class="zs-t heal">heals</i>' : ''}${o.cure ? '<i class="zs-t cure">cures bites</i>' : ''}${o.hero ? '<i class="zs-t hero">🦸 hero</i>' : ''}</span></span>${sel ? '<em>✓</em>' : ''}</button>`;
    }).join('');
    const give = me.items.length && v.others.length ? (v.gave ? `<div class="zs-gave">🎁 You gave ${esc(v.gave.item ? ({ gun: '🔫', medkit: '🩹', rope: '🪢', flashlight: '🔦', bat: '🏏', keys: '🔑', firecrackers: '🧨', radio: '📻' })[v.gave.item] : '')} to ${esc(v.gave.to)}</div>` : !P.give ? '<button class="zs-gbtn" id="zs-give">🎁 Give an item to a survivor</button>' : `<div class="zs-givebox"><div class="zs-gh">🎁 Give what?</div><div class="zs-gitems">${me.items.map((i) => `<button class="${P.item === i.k ? 'sel' : ''}" data-item="${esc(i.k)}">${i.icon}<small>${esc(i.name)}</small></button>`).join('')}</div>
      ${P.item ? `<div class="zs-gh">…to whom?</div><div class="zs-gto">${v.others.map((o) => `<button data-to="${esc(o.id)}" class="${o.status === 'bitten' ? 'bit' : ''}">${esc(o.avatar)} ${esc(o.name)}${o.status === 'bitten' ? ' <i>🦷 bitten</i>' : o.status === 'hurt' ? ' <i>🤕</i>' : ''}</button>`).join('')}</div>` : ''}<button class="zs-link" id="zs-gx">cancel</button></div>`) : '';
    return {
      html: `<div class="zs-pscene ${sc.final ? 'final' : ''}"><h3>${sc.final ? '🚁 ' : ''}${esc(sc.title)}</h3><p>${esc(sc.text)}</p></div>${alert}
        <div class="zs-step">${v.pick ? '✅ Locked in. You can still change.' : '👇 What do you do?'} ${t}</div><div class="zs-pos">${opts}</div>${give}`,
      bind: (el) => {
        for (const b of el.querySelectorAll('[data-k]')) b.onclick = async () => { const r = await ctx.act({ op: 'choose', k: b.dataset.k }); if (r && r.ok) { ctx.haptic('select'); ctx.sfx('pop'); ctx.redraw(); } };
        const gb = el.querySelector('#zs-give'); if (gb) gb.onclick = () => { P.give = true; ctx.haptic('tap'); ctx.redraw(); };
        const gx = el.querySelector('#zs-gx'); if (gx) gx.onclick = () => { P.give = false; P.item = null; ctx.redraw(); };
        for (const b of el.querySelectorAll('[data-item]')) b.onclick = () => { P.item = b.dataset.item; ctx.haptic('tap'); ctx.redraw(); };
        for (const b of el.querySelectorAll('[data-to]')) b.onclick = async () => { const r = await ctx.act({ op: 'give', item: P.item, to: b.dataset.to }); if (r && r.ok) { P.give = false; P.item = null; ctx.haptic('success'); ctx.sfx('chime'); if (r.saving) ctx.toast('🩹 You just saved a life!'); ctx.redraw(); } };
      },
    };
  }
  function ghostPhone(v, ctx) {
    if (!v.ghosts) return { html: '<div class="zs-pcard ghost"><div class="zs-pbig">👻</div><h3>You’re a ghost</h3><p>Ghosts are off this game. Watch the others try to survive!</p></div>' };
    const t = timer('g' + v.n, v.endsIn), h = v.haunt;
    const list = (v.others || []).map((o) => `<div class="zs-hrow ${h && h.to === o.id ? 'on ' + h.mode : ''}"><span class="nm">${esc(o.avatar)} ${esc(o.name)}${o.status === 'bitten' ? ' 🦷' : o.status === 'hurt' ? ' 🤕' : ''}</span><button data-h="bless" data-to="${esc(o.id)}">🍀</button><button data-h="curse" data-to="${esc(o.id)}">🕯️</button></div>`).join('');
    return {
      html: `<div class="zs-pcard ghost"><div class="zs-pbig">👻</div><h3>You’re a ghost. Haunt someone!</h3><p>🍀 <b>Bless</b> a survivor: a scrape becomes a clean escape. <b>+30</b> if they make it.<br>🕯️ <b>Curse</b> one: two ghosts cursing the same survivor trip them up. <b>+50</b> if they get hurt, bitten or fall.</p><div class="zs-step">${h ? '✅ Haunting locked in.' : 'Pick one survivor.'} ${t}</div></div><div class="zs-hlist">${list || '<p class="muted">Nobody left to haunt…</p>'}</div>`,
      bind: (el) => { for (const b of el.querySelectorAll('[data-h]')) b.onclick = async () => { const r = await ctx.act({ op: 'haunt', to: b.dataset.to, mode: b.dataset.h }); if (r && r.ok) { ctx.haptic(b.dataset.h === 'curse' ? 'buzz' : 'select'); ctx.sfx(b.dataset.h === 'curse' ? 'wail' : 'chime'); ctx.redraw(); } }; },
    };
  }
  function revealed(v, outer) { const m = v.mine, at0 = outer && outer._at ? outer._at : Date.now(), into = (v.outMs || 0) - v.endsIn + (Date.now() - at0); return into >= (m.feverAt && m.fate !== 'dead' ? Math.max(m.at, m.feverAt) : m.at); }
  function resultPhone(v, ctx, outer) {
    const m = v.mine, at0 = outer && outer._at ? outer._at : Date.now();
    const into = (v.outMs || 0) - v.endsIn + (Date.now() - at0);
    if (v.phase === 'outcome' && m) {
      const revealAt = m.feverAt && m.fate !== 'dead' ? Math.max(m.at, m.feverAt) : m.at;
      if (into < revealAt) {
        clearTimeout(P.revealT); P.revealT = setTimeout(() => ctx.redraw(), Math.min(4000, revealAt - into + 30));
        return `<div class="zs-pcard zs-suspense"><div class="zs-pbig">${m.icon}</div><h3>${esc(m.label)}</h3><p>${m.froze ? '❄️ You froze! A random choice was made for you…' : 'You made your choice…'}</p><p class="zs-pulse">📺 Watch the TV!</p></div>`;
      }
    }
    let html = '';
    if (m) {
      const f = m.fate === 'turned' ? 'turned' : m.cured && m.fate === 'safe' ? 'cured' : m.fate;
      const F = FATE[f] || FATE.safe;
      const msg = { safe: m.lucky ? 'By sheer luck, you made it!' : 'You made it through!', hurt: 'You got hurt. Careful: hurt again and you fall.', bitten: 'You got BITTEN! Get a 🩹 medkit before the end of the next scene or you turn.', dead: 'You fell… but you’re a ghost now! Haunt the living for points.', turned: 'The bite took hold. You turned! Now haunt the living as a ghost.', cured: m.cureHow === '💉' ? 'Dr. Okafor’s shot kicked in. The bite didn’t take!' : 'The medkit cured your bite. Phew!' }[f];
      html += `<div class="zs-pcard zs-fcard ${F.cls}"><div class="zs-pbig">${F.icon}</div><h2>${F.word}</h2><p>${msg}</p>${m.got ? `<div class="zs-got">🎒 Found: <b>${esc(m.got)}</b>${m.dropped ? ` <small>(dropped ${esc(m.dropped)}: backpack full)</small>` : ''}</div>` : ''}${m.used ? `<div class="zs-got">Used your ${m.used}</div>` : ''}${m.healed ? '<div class="zs-got">💚 Your injury healed</div>' : ''}${m.why && (m.saved || m.doomed) ? `<div class="zs-pwhy ${m.saved ? 'good' : 'bad'}">${m.why.icon} ${m.saved ? 'Your past paid off: ' : 'Your past caught up with you: '}${esc(m.why.text)}</div>` : ''}${m.flags && m.flags.length ? `<div class="zs-got">📜 The story will remember: ${m.flags.map((x) => `<span class="zs-badge ${x.bad ? 'bad' : ''}">${x.icon} ${esc(x.label)}</span>`).join(' ')}</div>` : ''}<p class="zs-line">“${esc(m.line)}”</p></div>`;
      const fk = v.n + f;
      if (P.felt !== fk) { P.felt = fk; ctx.haptic(f === 'dead' || f === 'turned' ? 'big' : f === 'bitten' ? 'warn' : f === 'hurt' ? 'error' : v.scene && v.scene.final ? 'win' : 'success'); ctx.sfx(f === 'dead' || f === 'turned' ? 'lose' : f === 'bitten' ? 'heartbeat' : f === 'hurt' ? 'hit' : 'chime'); }
    } else if (v.me && !v.me.alive) html += '<div class="zs-pcard ghost"><div class="zs-pbig">👻</div><h3>Watch what happens to the living…</h3></div>';
    if (v.myHaunt && (v.phase === 'board' || into >= v.myHaunt.at)) html += `<div class="zs-pcard ghost small"><p>👻 You ${v.myHaunt.mode === 'bless' ? '🍀 blessed' : '🕯️ cursed'} <b>${esc(v.myHaunt.to)}</b>: ${v.myHaunt.hit ? `<b class="ok">called it! +${v.myHaunt.pts}</b>` : 'no luck this time.'}</p></div>`;
    if (v.phase === 'board') html += `<div class="zs-pcard small"><p>🏆 You’re <b>#${v.rank}</b> of ${v.of} · ⭐ ${v.me.pts} points</p><p class="muted">Next scene ${timer('b' + v.n, v.endsIn)}</p></div>`;
    return html;
  }
  function endPhone(v, ctx) {
    const E = v.end || {};
    if (P.felt !== 'end') { P.felt = 'end'; ctx.haptic(E.rescued ? 'win' : 'success'); }
    return `<div class="zs-pcard zs-fcard ${E.rescued ? 'safe' : 'dead'}"><div class="zs-pbig">${E.rescued ? '🚁' : '👻'}</div><h2>${E.rescued ? 'RESCUED!' : E.wipe ? 'NOBODY MADE IT' : 'THE END'}</h2>${E.reach ? `<div class="zs-reachbig">${esc(E.reach)}</div>` : ''}<p class="zs-line">${esc(E.line || '')}</p><p>🏆 You finished <b>#${v.rank}</b> of ${v.of} with ⭐ ${v.me.pts} points</p>${(E.awards || []).map((a) => `<div class="zs-got">${a.icon} <b>${esc(a.title)}</b></div>`).join('')}</div>
      <div class="zs-pcard"><h3>Who got furthest</h3>${(E.standings || []).map((r, i) => `<div class="zs-row ${r.alive ? '' : 'ghost'}"><span class="n">${i + 1}</span><span class="av">${esc(r.avatar)}</span><span class="nm">${esc(r.name)}<small class="zs-rch">${esc(r.reach || '')}</small></span><b>${r.pts}</b></div>`).join('')}</div>`;
  }

  BOX.games.zombie = {
    name: 'Zombie Survival', icon: '🧟',
    about: 'A zombie apocalypse in six days. Pick what you do in each scene (the medkit, the pistol or the rope?), then watch the TV to see who makes it. Your choices and what you carry decide your fate, and something from day one can save you on the last night.',
    how: [
      'Each scene the TV shows what’s happening. Pick one of the 3–5 options on your phone. No dice: the same choice with the same gear and history always ends the same way.',
      'Your choices and what you carry decide your fate. A 🔦 gets you through the dark, a 🪢 up the wall, a 🩹 cures a bite. Bullets and swings run out!',
      'The story remembers. Things you did earlier show as 📜 badges on your phone, and something from day one can save you (or doom you) on the last night.',
      'Some choices depend on the group: the door only holds if enough people hold it, and one decoy keeps everyone else safer.',
      'Bitten? Find a 🩹 medkit by the end of the next scene or you turn. Fall, and you’re a ghost: bless 🍀 or curse 🕯️ the living.',
      'Points for every scene and every new day you survive, for gear and past choices that save you, +500 for the rescue. Whoever gets furthest wins.',
    ],
    fx: { chapter: 'thunder', scene: 'groan', allin: 'chime', gift: 'chime', win: 'win', wipe: 'lose' },
    lobbyTv,
    tv(el, s) {
      if (!s) return;
      const z = mountTv(el);
      onState(s);
      z.root.dataset.phase = s.phase;
    },
    phone,
  };
})();
