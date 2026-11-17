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
  const OUT = { intro: 2400, group: 3600, reveal: 1500, fever: 3400 };
  const tag = (o) => [o.need ? `<i class="zs-t need">needs ${o.need}</i>` : '', o.help ? `<i class="zs-t help">better with ${o.help}</i>` : '', o.gain ? `<i class="zs-t gain">find ${o.gain}</i>` : '', o.heal ? '<i class="zs-t heal">heals</i>' : '', o.cure ? '<i class="zs-t cure">cures bites</i>' : '', o.hero ? '<i class="zs-t hero">🦸 hero</i>' : ''].join('');
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
    for (const fn of [...loops]) { try { if (fn(now) === false) loops.delete(fn); } catch (e) { console.error(e); loops.delete(fn); } }
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
  function drawTv(z, now) {
    const s = T.s; if (!s) return;
    const Z = A(); if (!Z) return;
    const { w, h, d } = fit(z.cv), g = z.cv.getContext('2d'), t = now / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#0a0612'; g.fillRect(0, 0, z.cv.width, z.cv.height);
    Z.cover(g, w, h, d);
    const u = elapsed();
    const loc = s.phase === 'over' ? (s.epilogue && s.epilogue.wipe ? 'streets' : 'rescue') : s.chapter.loc;
    if (s.phase === 'chapter') drawChapter(g, s, t, u, loc);
    else if (s.phase === 'choose') drawChoose(g, s, t, loc);
    else if (s.phase === 'outcome' && s.outcome) drawOutcome(g, s, t, u, loc);
    else if (s.phase === 'board') drawBoard(g, s, t, loc);
    else if (s.phase === 'over') drawOver(g, s, t, u);
    else Z.backdrop(g, loc, t, { dark: 0.3 });
    Z.vignette(g, 0.5);
    // the HUD follows the timeline (4× a second is plenty)
    if (!z._h || now - z._h > 240) { z._h = now; const html = hud(s, u); if (html !== T.hud) { T.hud = html; BOX.morph(z.hud, html); } }
  }
  function shamblers(g, t, n, y, s, o = {}) {
    const Z = A();
    for (let i = 0; i < n; i++) {
      const span = 2400, sp = 26 + (i % 3) * 7, dir = i % 2 ? 1 : -1;
      const x = dir > 0 ? ((t * sp + i * 530) % span) - 240 : W0 - (((t * sp + i * 530) % span) - 240);
      Z.zombie(g, x, y + (i % 3) * 14, s * (0.9 + (i % 3) * 0.08), t, { seed: i + 3, dir, alpha: o.alpha, speed: 2.4 });
    }
  }
  const W0 = 1920;
  function crowd(g, list, t, o = {}) {
    const Z = A(), n = Math.min(list.length, o.max || 36);
    const per = n <= 8 ? n : n <= 20 ? Math.ceil(n / 2) : Math.ceil(n / 3), rows = Math.ceil(n / Math.max(1, per));
    const sc = (o.scale || 1) * (n <= 4 ? 1.05 : n <= 8 ? 0.9 : n <= 20 ? 0.72 : 0.58);
    for (let row = rows - 1; row >= 0; row--) {
      const items = list.slice(row * per, Math.min(n, (row + 1) * per)), cnt = items.length, gap = Math.min((o.wide ? 300 : 210) * sc, (o.wide ? 1640 : 1600) / Math.max(1, cnt));
      items.forEach((p, i) => {
        const x = 960 + (i - (cnt - 1) / 2) * gap + (row % 2 ? gap / 2 : 0), y = (o.y || 1040) - row * (o.rowGap || 62) * sc, s2 = sc * (1 - row * 0.08);
        Z.survivor(g, x, y, s2, t, { avatar: p.avatar, color: p.color, pose: o.pose || 'idle', ph: i * 1.7, tint: p.status === 'bitten' ? 'sick' : null, dir: i % 2 ? -1 : 1 });
        if (p.status === 'bitten') Z.glow(g, x, y - 120 * s2, 90 * s2, 'rgba(140,255,90,A)', 0.25 + 0.15 * Math.sin(t * 4 + i));
        if (o.names && n <= 12) { Z.text(g, p.name, x, y + 28, 26 * Math.max(0.8, s2), '#fff', { font: A().BODY, stroke: '#120d1c', lw: 6, max: gap * 0.95 }); }
        if (o.badges) { const b = p.status === 'hurt' ? '🩹' : p.status === 'bitten' ? '🦷' : null; if (b) Z.emoji(g, b, x + 38 * s2, y - 190 * s2, 40 * s2 + 10); if (p.items && n <= 16) Z.text(g, p.items, x, y + 62, 30 * s2 + 4, '#fff', { font: '"Segoe UI Emoji", sans-serif' }); }
      });
    }
    if (list.length > n) Z.text(g, `+${list.length - n} more`, 1800, (o.y || 1040) - 30, 34, '#fff', { stroke: '#120d1c', lw: 8 });
  }
  function ghosts(g, list, t, o = {}) {
    const Z = A(), n = Math.min(list.length, 16);
    for (let i = 0; i < n; i++) {
      const p = list[i], x = (o.x0 || 120) + ((i * 263 + t * 14 * (i % 2 ? 1 : -1)) % (o.span || 1700) + (o.span || 1700)) % (o.span || 1700), y = (o.y || 170) + (i % 3) * 70;
      Z.ghost(g, x, y, o.s || 0.75, t, { avatar: p.avatar, ph: i, alpha: 0.55 });
    }
  }
  function drawChapter(g, s, t, u, loc) {
    const Z = A(), k = Math.min(1, u / 6000);
    g.save(); g.translate(960, 540); g.scale(1.08 - 0.08 * k, 1.08 - 0.08 * k); g.translate(-960, -540);
    Z.backdrop(g, loc, t, { dark: 0.15 }); shamblers(g, t, 4, 900, 0.55, { alpha: 0.85 }); Z.fog(g, t, 0.2);
    g.restore();
    g.fillStyle = `rgba(0,0,0,${0.75 * (1 - Z.util.clamp(u / 900))})`; g.fillRect(-200, -200, 2400, 1500);
  }
  function drawChoose(g, s, t, loc) {
    const Z = A();
    Z.backdrop(g, loc, t, { dark: 0.42 });
    shamblers(g, t, 4, 860, 0.5, { alpha: 0.7 });
    Z.fog(g, t, 0.16, 930);
    if (s.ghosts) ghosts(g, s.ghostList || [], t, { y: 660, s: 0.5 });
    crowd(g, s.people || [], t, { y: 990, scale: 0.85 });
  }
  function drawBoard(g, s, t, loc) {
    const Z = A();
    Z.backdrop(g, loc, t, { dark: 0.5 });
    Z.fog(g, t, 0.18, 960);
    ghosts(g, s.ghostList || [], t, { y: 330, s: 0.8, x0: 80, span: 1250 });
    crowd(g, s.people || [], t, { y: 930, names: true, badges: true, pose: 'idle', scale: 1.0, wide: true, rowGap: 105 });
  }
  // ---------- the outcome: each group acts out its choice ----------
  function layout(n) {
    const per = n <= 6 ? n : n <= 14 ? Math.ceil(n / 2) : Math.ceil(n / 3), rows = Math.ceil(n / Math.max(1, per));
    const sc = n <= 3 ? 1.35 : n <= 6 ? 1.15 : n <= 14 ? 0.92 : 0.72, out = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / per), cnt = Math.min(per, n - row * per), col = i % per, gap = Math.min(250 * sc, 1180 / Math.max(1, cnt - 1 || 1));
      out.push({ x: 900 + (col - (cnt - 1) / 2) * gap + (row % 2 ? gap * 0.4 : 0), y: 950 - row * 76 * sc, s: sc * (1 - row * 0.1), row });
    }
    return out;
  }
  function fateAt(G, i) { return G.at + OUT.reveal + Math.min(i, 24) * 90; }
  function drawGroup(g, s, G, u, t) {
    const Z = A(), { clamp, easeOut, lerp, back } = Z.util, v = u - G.at, ppl = G.people, L = layout(ppl.length), anim = G.anim;
    const zn = Math.max(2, Math.min(6, Math.ceil(G.total / 2) + 1)), approach = easeOut(clamp(v / 1400));
    // props behind the group
    if (anim === 'climb') { g.fillStyle = '#5a4a3a'; g.fillRect(260, 620, 1400, 26); g.strokeStyle = '#c9a36b'; g.lineWidth = 6; for (const p of L) { g.beginPath(); g.moveTo(p.x, 640); g.lineTo(p.x + 6, 1020); g.stroke(); } }
    if (anim === 'search') { for (const x of [250, 760, 1270]) { g.fillStyle = '#2e2420'; g.fillRect(x, 560, 420, 330); g.fillStyle = '#5a4030'; g.fillRect(x - 10, 550, 440, 18); for (const y of [650, 760, 870]) g.fillRect(x - 10, y, 440, 16); g.fillRect(x - 10, 550, 18, 340); g.fillRect(x + 412, 550, 18, 340); } for (let i = 0; i < 18; i++) Z.emoji(g, ['🥫', '📦', '🧴', '🔋', '🧃', '🧻'][i % 6], 300 + (i % 6) * 250 + (i % 2) * 40, 618 + Math.floor(i / 6) * 110, 50); }
    if (anim === 'hold' && G.role === 'hold') {
      const open = s.outcome.groupOk === false && v > 1300, shake = open ? 0 : Math.sin(t * 40) * 6 * (v < 1400 ? 1 : 0.4);
      g.save(); g.translate(1640 + shake, 1010); if (open) g.rotate(-Math.min(1.3, (v - 1300) / 300));
      g.fillStyle = '#6a4a2e'; g.strokeStyle = '#120d1c'; g.lineWidth = 8; Z.rr(g, 0, -380, 190, 380, 8); g.fill(); g.stroke();
      g.strokeStyle = '#4a321e'; g.lineWidth = 14; g.beginPath(); g.moveTo(10, -330); g.lineTo(180, -60); g.stroke(); g.restore();
      if (!open) for (let i = 0; i < 3; i++) { g.save(); g.translate(1840, 760 + i * 70 + Math.sin(t * 6 + i) * 10); g.strokeStyle = '#9ccf7a'; g.lineWidth = 16; g.lineCap = 'round'; g.beginPath(); g.moveTo(40, 0); g.lineTo(-30 - Math.sin(t * 5 + i) * 20, 0); g.stroke(); g.restore(); }
    }
    if (anim === 'rest' && v > 200) { g.fillStyle = '#5a3a1a'; g.fillRect(900, 1010, 120, 14); Z.glow(g, 960, 980, 160, 'rgba(255,160,60,A)', 0.4 + 0.1 * Math.sin(t * 9)); Z.emoji(g, '🔥', 960, 980, 70); }
    if (anim === 'swim') { g.fillStyle = 'rgba(40,90,170,0.75)'; g.fillRect(-200, 900, 2400, 300); g.strokeStyle = 'rgba(200,230,255,0.6)'; g.lineWidth = 5; g.beginPath(); for (let x = -200; x < 2200; x += 40) g.lineTo(x, 900 + Math.sin(x / 50 + t * 4) * 8); g.stroke(); }
    // the choice, faded behind the action
    g.globalAlpha = 0.16; Z.emoji(g, G.icon, 960, 520, 300); g.globalAlpha = 1;
    // zombies close in
    for (let i = 0; i < zn; i++) {
      const fromLeft = anim === 'run' || anim === 'decoy' || anim === 'sneak' ? true : anim === 'hide' ? i % 2 === 0 : anim === 'fight' ? false : i % 2 === 0;
      let x;
      if (anim === 'hide') { x = fromLeft ? lerp(-200, 2100, clamp(v / 3400)) - i * 160 : lerp(2100, -200, clamp(v / 3400)) + i * 160; }
      else if (anim === 'decoy') x = lerp(-300, 1500, clamp((v - 300) / 3000)) - i * 140;
      else if (anim === 'fight') { const hit = clamp((v - 900 - i * 120) / 500); x = lerp(2150, 1500 + i * 70, approach) + hit * 260 * (G.counts.safe ? 1 : 0); }
      else if (anim === 'hold' && G.role === 'hold') x = -9999;
      else x = fromLeft ? lerp(-260 - i * 120, 160 + i * 90, approach) : lerp(2180 + i * 120, 1700 - i * 90, approach);
      if (x > -400 && x < 2400) Z.zombie(g, x, 975 - (i % 2) * 26, 0.9, t, { seed: i + G.k.length, dir: anim === 'hide' ? (fromLeft ? 1 : -1) : fromLeft ? 1 : -1, speed: 3 });
    }
    // the survivors (back rows first)
    const order = ppl.map((p, i) => i).sort((a, b) => L[b].row - L[a].row);
    for (const i of order) {
      const p = ppl[i], P = L[i], rv = u - fateAt(G, i), F = rv >= 0 ? p.fate : null;
      let x = P.x, y = P.y, pose = anim === 'decoy' ? 'run' : anim, lean = 0, alpha = 1, crouch = 0, dir = 1;
      if (anim === 'run' || anim === 'decoy' || anim === 'sneak') x = lerp(-300 - i * 70, P.x * 0.8 + (anim === 'decoy' ? 330 : 180), easeOut(clamp(v / (anim === 'sneak' ? 1700 : 1200))));
      if (anim === 'drive') x = lerp(-500, P.x, easeOut(clamp(v / 1300)));
      if (anim === 'swim') { x = lerp(-200 - i * 60, P.x, easeOut(clamp(v / 1600))); y = 960 + Math.sin(t * 3 + i) * 6; }
      if (anim === 'climb') y = lerp(P.y, 650, easeOut(clamp((v - 200) / 1300))) ;
      if (anim === 'hold' && G.role === 'hold') { x = 1180 + (P.x - 900) * 0.35; dir = 1; } else if (anim === 'hold') pose = 'idle';
      if (anim === 'run' && v > 1200 && v < 1500) pose = 'idle';
      if (F === 'safe' && rv < 600) y -= Math.sin(clamp(rv / 600) * Math.PI) * 50 * P.s;
      if (F === 'hurt' || F === 'bitten') x += Math.sin(t * 40) * 4 * clamp(1 - rv / 600);
      let fallK = 0;
      if (F === 'dead') { fallK = clamp((rv - 300) / 450); lean = -1.45 * back(fallK); alpha = 1 - clamp((rv - 900) / 600); }
      if (anim === 'drive' && alpha > 0) { Z.emoji(g, p.avatar || '🙂', x, 850 + Math.sin(t * 8 + i) * 4, 70 * P.s, F === 'bitten' ? 'sick' : null); if (i === ppl.length - 1 || ppl.length > 6) A().car(g, x + 60, 985, 0.85, ['#c94a4a', '#3d6f8f', '#7a6a2a'][i % 3]); }
      else if (alpha > 0) {
        if (F === 'dead') { g.save(); g.translate(x, y); g.rotate(lean); g.translate(-x, -y); }
        Z.survivor(g, x, y, P.s, t, { avatar: p.avatar, color: p.color, pose: F ? (F === 'safe' && anim !== 'swim' ? 'cheer' : pose === 'swim' ? 'swim' : 'idle') : pose, ph: i * 1.3, tint: F === 'bitten' ? 'sick' : null, crouch, alpha, dir, item: p.used || (anim === 'fight' && !F ? '👊' : null) });
        if (F === 'dead') g.restore();
      }
      if (F === 'bitten') Z.glow(g, x, y - 120 * P.s, 110 * P.s, 'rgba(140,255,90,A)', 0.35);
      // a ghost rises from the fallen
      if (F === 'dead' && rv > 800) { const gk = clamp((rv - 800) / 1400); Z.ghost(g, x, y - 120 - gk * 260, P.s * 0.8, t, { avatar: p.avatar, alpha: 0.85 * (1 - clamp((rv - 2600) / 600)) }); }
      // the stamp and name
      if (F) {
        const f = FATE[F], sk = back(clamp(rv / 260)), ty = anim === 'drive' ? 760 : y - 230 * P.s;
        g.save(); g.translate(x, ty); g.scale(sk, sk); g.rotate(-0.06);
        g.font = `${Math.round(30 * Math.max(0.8, P.s))}px ${A().FONT}`; const tw = g.measureText(f.word).width + 64;
        g.fillStyle = 'rgba(14,8,24,0.88)'; A().rr(g, -tw / 2, -26, tw, 52, 26); g.fill(); g.strokeStyle = f.col; g.lineWidth = 4; g.stroke();
        Z.emoji(g, f.icon, -tw / 2 + 26, 0, 30); Z.text(g, f.word, 14, 2, Math.round(30 * Math.max(0.8, P.s)), f.col);
        g.restore();
        if (p.got && F !== 'dead') { const gk = clamp((rv - 200) / 900); g.globalAlpha = 1 - clamp((rv - 1600) / 400); Z.text(g, '+', x - 34, ty - 60 - gk * 50, 44, '#fff', { stroke: '#120d1c', lw: 8 }); Z.emoji(g, p.got, x + 10, ty - 60 - gk * 50, 56); g.globalAlpha = 1; }
      }
      if ((ppl.length <= 6 || P.row === 0) && ppl.length <= 21 && alpha > 0.3 && anim !== 'drive') Z.text(g, p.name, x, (anim === 'swim' ? 1000 : y + 30), 26 * Math.max(0.8, P.s), '#fff', { font: A().BODY, stroke: '#120d1c', lw: 6, max: 230 });
      if (p.froze && !F) Z.text(g, '❄️ froze!', x, y - 250 * P.s, 26, '#9fe8ff', { stroke: '#120d1c', lw: 6 });
    }
    // comic bursts in fights
    if (anim === 'fight' && v > 800 && v < 1700) { const k = clamp((v - 800) / 200); A().burst(g, 1450, 760, 110, ppl.some((p) => p.used === '🔫') ? 'BANG!' : 'POW!', '#ffd34a', '#120d1c', A().util.back(k)); }
    if (anim === 'decoy' && v > 300 && v < 2600) A().burst(g, lerp(500, 1600, clamp(v / 2600)), 640, 90, '!!!', '#ff7ab8', '#120d1c', 1);
    if (anim === 'hide') for (let i = 0; i < ppl.length; i++) { const P = L[i], rv = u - fateAt(G, i); if (rv > 0) continue; const x = P.x; g.fillStyle = i % 2 ? '#6a4a2e' : '#2f5a32'; g.strokeStyle = '#120d1c'; g.lineWidth = 6; if (i % 2) { Z.rr(g, x - 95 * P.s, P.y - 120 * P.s, 190 * P.s, 124 * P.s, 8); g.fill(); g.stroke(); g.beginPath(); g.moveTo(x - 95 * P.s, P.y - 120 * P.s); g.lineTo(x + 95 * P.s, P.y); g.stroke(); } else { g.beginPath(); g.arc(x - 50 * P.s, P.y - 50 * P.s, 70 * P.s, 0, Math.PI * 2); g.arc(x + 50 * P.s, P.y - 60 * P.s, 76 * P.s, 0, Math.PI * 2); g.arc(x, P.y - 100 * P.s, 70 * P.s, 0, Math.PI * 2); g.fill(); } }
    if (G.more) Z.text(g, `+${G.more} more`, 1780, 1000, 34, '#fff', { stroke: '#120d1c', lw: 8 });
  }
  function drawFever(g, s, F, u, t) {
    const Z = A(), { clamp, back } = Z.util, v = u - F.at, n = Math.min(F.people.length, 12), L = layout(n);
    g.fillStyle = 'rgba(20,60,10,0.35)'; g.fillRect(-200, -200, 2400, 1500);
    for (let i = 0; i < n; i++) {
      const p = F.people[i], P = L[i], rv = v - OUT.reveal - i * 140, done = rv >= 0;
      if (done && p.fate === 'turned') {
        Z.zombie(g, P.x, P.y, P.s * 0.95, t, { seed: i + 7, dir: i % 2 ? -1 : 1 });
        Z.emoji(g, p.avatar, P.x + 4 * P.s * (i % 2 ? -1 : 1), P.y - 188 * P.s, 74 * P.s, 'sick');
      } else {
        Z.survivor(g, P.x, P.y + Math.sin(t * 20) * (done ? 0 : 2), P.s, t, { avatar: p.avatar, color: p.color, pose: done ? 'cheer' : 'idle', ph: i, tint: done ? null : 'sick' });
        if (!done) Z.glow(g, P.x, P.y - 130 * P.s, 120 * P.s, 'rgba(140,255,90,A)', 0.3 + 0.2 * Math.sin(t * 6));
        if (done) { const k = clamp(rv / 700); Z.emoji(g, '🩹', P.x + 50, P.y - 200 * P.s - k * 40, 60); Z.glow(g, P.x, P.y - 120 * P.s, 160, 'rgba(255,255,200,A)', 0.4 * (1 - k)); }
      }
      if (done) { const f = FATE[p.fate === 'turned' ? 'turned' : 'cured'], sk = back(clamp(rv / 260)); g.save(); g.translate(P.x, P.y - 250 * P.s); g.scale(sk, sk); Z.text(g, `${f.icon} ${f.word}`, 0, 0, 36, f.col, { stroke: '#120d1c', lw: 8 }); g.restore(); }
      Z.text(g, p.name, P.x, P.y + 32, 28, '#fff', { font: A().BODY, stroke: '#120d1c', lw: 6, max: 230 });
    }
  }
  function drawOutcome(g, s, t, u, loc) {
    const Z = A(), O = s.outcome, groups = O.groups;
    const cur = groups.filter((G) => u >= G.at && u < G.at + OUT.group).pop();
    const fever = O.fever && u >= O.fever.at && u < O.fever.at + OUT.fever ? O.fever : null;
    const dark = cur || fever ? 0.35 : 0.5;
    // a slow push in for each group
    const seg = cur ? (u - cur.at) / OUT.group : 0, zoom = 1 + 0.05 * seg;
    g.save(); g.translate(960, 600); g.scale(zoom, zoom); g.translate(-960, -600);
    Z.backdrop(g, loc, t, { dark });
    if (cur) drawGroup(g, s, cur, u, t);
    else if (fever) drawFever(g, s, fever, u, t);
    else if (u < OUT.intro) { shamblers(g, t, 7, 970, 0.85); Z.fog(g, t, 0.25); }
    else drawSummary(g, s, t, u);
    g.restore();
    // sound + voice cues on the timeline
    cue('intro', 0, u, () => { BOX.sfx('groan'); if (O.groupLine) say(s, O.groupLine, 2300); });
    groups.forEach((G, gi) => {
      cue('g' + gi, G.at, u, () => { BOX.sfx(ANIM_SFX[G.anim] || 'whoosh'); if (G.people.some((p) => p.used === '🔫')) setTimeout(() => BOX.sfx('shot'), 900); });
      cue('r' + gi, G.at + OUT.reveal, u, () => {
        const c = G.counts; BOX.sfx(c.dead ? 'fall' : c.bitten ? 'groan' : c.hurt ? 'hit' : 'saved');
        if (c.dead) setTimeout(() => BOX.sfx('spirit'), 900);
        say(s, G.line, OUT.group - OUT.reveal + 400);
      });
    });
    if (O.fever) { cue('fv', O.fever.at, u, () => { BOX.sfx('heartbeat'); say(s, O.fever.line, OUT.fever); }); cue('fv2', O.fever.at + OUT.reveal, u, () => BOX.sfx(O.fever.people.some((p) => p.fate === 'turned') ? 'groan' : 'shield')); }
    cue('end', O.endAt, u, () => BOX.sfx(O.final ? 'win' : 'reveal'));
    if (O.final) cue('chop', O.endAt, u, () => setTimeout(() => BOX.sfx('whoosh'), 300));
  }
  function drawSummary(g, s, t, u) {
    const Z = A(), O = s.outcome, v = u - O.endAt;
    const alive = []; for (const G of O.groups) for (const p of G.people) if (p.fate !== 'dead') alive.push(p);
    if (O.fever) for (const p of O.fever.people) { const i = alive.findIndex((x) => x.id === p.id); if (p.fate === 'turned' && i >= 0) alive.splice(i, 1); }
    if (O.final) {
      // the chopper lifts everyone out
      const k = Z.util.clamp(v / 4200), x = 960 + k * 1400 - 200, y = 330 - k * 260;
      Z.chopper(g, x, y, 0.85, t, { faces: alive.map((p) => p.avatar), ladder: 200 * (1 - k), light: true, lightX: -100 });
      crowd(g, alive.slice(0, Math.max(0, Math.round(alive.length * (1 - k * 1.6)))), t, { y: 980, pose: 'cheer' });
      return;
    }
    crowd(g, alive, t, { y: 960, pose: 'idle', names: alive.length <= 12 });
    shamblers(g, t, 3, 860, 0.5, { alpha: 0.6 });
  }
  function drawOver(g, s, t, u) {
    const Z = A(), E = s.epilogue || { rescued: [], wipe: true };
    if (E.wipe) { Z.backdrop(g, 'streets', t, { dark: 0.6 }); shamblers(g, t, 9, 1030, 0.9); Z.fog(g, t, 0.3); return; }
    Z.backdrop(g, 'rescue', t, { dark: 0.15 });
    const k = ((u / 1000) % 14) / 14, x = -400 + k * 2800, y = 260 + Math.sin(t * 0.8) * 20;
    Z.chopper(g, x, y, 0.7, t, { faces: E.rescued.map((p) => p.avatar), tilt: -0.08 });
  }

  // ---------- the HUD ----------
  function topBar(s, right = '') {
    return `<div class="zs-top"><span class="zs-day">DAY ${s.chapter.day}</span><span class="zs-loc">${esc(s.chapter.name)}</span><span class="zs-n">Scene ${s.n} of ${s.total}</span><span class="zs-sp"></span>${right}<span class="zs-pop">🧍 ${s.alive}${s.ghosts || s.dead ? ` · 👻 ${s.dead}` : ''}</span></div>`;
  }
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
      const O = s.outcome, cur = O.groups.filter((G) => u >= G.at && u < G.at + OUT.group).pop();
      const fever = O.fever && u >= O.fever.at && u < O.fever.at + OUT.fever;
      let mid = '', sub = '';
      if (u < OUT.intro) mid = `<div class="zs-big" id="zsb-i-${s.n}">${O.groupLine ? `<span class="${O.groupOk === false ? 'bad' : 'good'}">${esc(O.groupLine)}</span>` : `<span>${esc(s.scene ? s.scene.title : '')}…</span><small>Let’s see what happened.</small>`}</div>`;
      else if (cur) {
        const i = O.groups.indexOf(cur);
        mid = `<div class="zs-banner" id="zsb-${s.n}-${i}"><span class="zs-bi">${cur.icon}</span><b>${esc(cur.label)}</b><small>${plural(cur.total, 'survivor')}</small></div>`;
        if (u >= cur.at + OUT.reveal) sub = `<div class="zs-sub" id="zss-${s.n}-${i}">${esc(cur.line)}</div>`;
      } else if (fever) {
        mid = `<div class="zs-banner fever" id="zsb-${s.n}-f"><span class="zs-bi">🌡️</span><b>The fever</b><small>bites from last time</small></div>`;
        if (u >= O.fever.at + OUT.reveal) sub = `<div class="zs-sub" id="zss-${s.n}-f">${esc(O.fever.line)}</div>`;
      } else {
        const tl = O.tally;
        mid = `<div class="zs-tally" id="zst-${s.n}">${O.final ? `<div class="zs-rescued">🚁 ${plural(tl.made, 'survivor')} made the last flight!</div>` : ''}<span class="ok">✅ ${tl.made} still standing</span>${tl.hurt ? `<span class="hu">🤕 ${tl.hurt} hurt</span>` : ''}${tl.bitten ? `<span class="bi">🦷 ${tl.bitten} bitten</span>` : ''}${tl.fell ? `<span class="de">💀 ${tl.fell} fell</span>` : ''}</div>`;
      }
      return `${topBar(s)}${mid}${sub}`;
    }
    if (s.phase === 'board') {
      return `${topBar(s, `<span class="zs-clock">Next scene ${timer('b' + s.n, s.endsIn)}</span>`)}
        <div class="zs-board"><h2 id="zsbh-${s.n}">${plural(s.alive, 'survivor')} still standing${s.dead ? ` · ${plural(s.dead, 'ghost')}` : ''}</h2>
        <aside class="zs-lead"><h3>🏆 Longest survivors</h3>${s.standings.slice(0, 8).map((r, i) => `<div class="zs-row ${r.alive ? '' : 'ghost'}"><span class="n">${i + 1}</span><span class="av">${r.alive ? esc(r.avatar) : '👻'}</span><span class="nm">${esc(r.name)}</span>${r.alive ? `<span class="st">${STATUS[r.status] ? STATUS[r.status][0] : ''}</span>` : ''}<b>${r.pts}</b></div>`).join('')}
        ${s.haunts && s.haunts.length ? `<h3>👻 Hauntings</h3>${s.haunts.slice(0, 5).map((h) => `<div class="zs-haunt">${esc(h.from)} ${h.mode === 'bless' ? '🍀 blessed' : '🕯️ cursed'} ${esc(h.to)} ${h.hit ? '<b>✓</b>' : ''}</div>`).join('')}` : ''}</aside></div>`;
    }
    if (s.phase === 'over' && s.epilogue) {
      const E = s.epilogue, st = s.standings;
      return `<div class="zs-end" id="zse"><div class="zs-endhead">${E.wipe ? '<h1 class="zs-wipe">NOBODY MADE IT</h1><p>The city belongs to the shamblers now… but what a story.</p>' : `<h1>THE END</h1><p>${plural(E.rescued.length, 'survivor')} made it out: ${E.rescued.slice(0, 10).map((p) => `${esc(p.avatar)} ${esc(p.name)}`).join(' · ')}${E.rescued.length > 10 ? ` +${E.rescued.length - 10}` : ''}</p>`}</div>
        <div class="zs-endgrid"><section class="zs-fates"><h3>📜 What happened to everyone</h3><div class="zs-roll"><div class="zs-rollin" style="--n:${E.fates.length}">${E.fates.map((f) => `<div class="zs-fate ${f.rescued ? 'r' : f.alive ? '' : 'd'}"><span>${f.rescued ? '🚁' : f.alive ? '🧍' : '👻'}</span><span class="av">${esc(f.avatar)}</span><span>${esc(f.line)}</span></div>`).join('')}</div></div></section>
        <section class="zs-awards">${E.awards.map((a, i) => `<div class="zs-award" style="--d:${0.6 + i * 0.25}s"><span class="ic">${a.icon}</span><b>${esc(a.title)}</b><span>${a.names.map(esc).join(', ')}</span><small>${esc(a.text)}</small></div>`).join('')}
          <div class="zs-final-board"><h3>🏆 Final scores</h3>${st.slice(0, 6).map((r, i) => `<div class="zs-row ${r.alive ? '' : 'ghost'}"><span class="n">${i === 0 ? '👑' : i + 1}</span><span class="av">${esc(r.avatar)}</span><span class="nm">${esc(r.name)}</span><b>${r.pts}</b></div>`).join('')}</div></section></div></div>`;
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
    return `<div class="zs-phead"><span class="zs-stat ${me.alive ? me.status : 'ghost'}">${ic} ${word}</span><span class="zs-pts">⭐ ${me.pts || 0}</span><span class="zs-scn">Day ${v.chapter.day} · ${v.n}/${v.total}</span></div>${me.alive ? `<div class="zs-pack"><span class="lb">🎒</span>${slots}</div>` : ''}`;
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
    const alert = me.status === 'bitten' ? `<div class="zs-alert bite">🦷 <b>You’re bitten!</b> ${me.items.some((i) => i.k === 'medkit') ? 'Your 🩹 medkit will cure it at the end of this scene.' : me.bittenNow ? 'Get a 🩹 medkit from a friend before this scene ends, or you turn!' : 'Find a 🩹 medkit by the end of the NEXT scene, or you turn.'}</div>` : me.status === 'hurt' ? '<div class="zs-alert hurt">🤕 You’re hurt: risky moves are riskier. Rest or patch up to heal.</div>' : '';
    const opts = sc.options.map((o) => {
      const lock = v.locked.includes(o.k), sel = v.pick === o.k, boost = v.boost.includes(o.k);
      return `<button class="zs-po ${sel ? 'sel' : ''} ${lock ? 'lock' : ''}" data-k="${esc(o.k)}" ${lock ? 'disabled' : ''}><span class="ic">${o.icon}</span><span class="tx"><b>${esc(o.label)}</b><span class="zs-tags">${lock ? `<i class="zs-t need">🔒 needs ${o.need}</i>` : ''}${boost ? '<i class="zs-t boost">⭐ your gear helps</i>' : ''}${o.gain ? `<i class="zs-t gain">find ${o.gain}</i>` : ''}${o.heal ? '<i class="zs-t heal">heals</i>' : ''}${o.cure ? '<i class="zs-t cure">cures bites</i>' : ''}${o.hero ? '<i class="zs-t hero">🦸 hero</i>' : ''}</span></span>${sel ? '<em>✓</em>' : ''}</button>`;
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
      html: `<div class="zs-pcard ghost"><div class="zs-pbig">👻</div><h3>You’re a ghost. Haunt someone!</h3><p>🍀 <b>Bless</b> a survivor: luck nudged their way, <b>+30</b> if they make it.<br>🕯️ <b>Curse</b> one: a little bad luck, <b>+50</b> if they get hurt, bitten or fall.</p><div class="zs-step">${h ? '✅ Haunting locked in.' : 'Pick one survivor.'} ${t}</div></div><div class="zs-hlist">${list || '<p class="muted">Nobody left to haunt…</p>'}</div>`,
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
      const msg = { safe: m.lucky ? 'By sheer luck, you made it!' : 'You made it through!', hurt: 'You got hurt. Careful: hurt again and you fall.', bitten: 'You got BITTEN! Get a 🩹 medkit before the end of the next scene or you turn.', dead: 'You fell… but you’re a ghost now! Haunt the living for points.', turned: 'The bite took hold. You turned! Now haunt the living as a ghost.', cured: 'The medkit cured your bite. Phew!' }[f];
      html += `<div class="zs-pcard zs-fcard ${F.cls}"><div class="zs-pbig">${F.icon}</div><h2>${F.word}</h2><p>${msg}</p>${m.got ? `<div class="zs-got">🎒 Found: <b>${esc(m.got)}</b>${m.dropped ? ` <small>(dropped ${esc(m.dropped)}: backpack full)</small>` : ''}</div>` : ''}${m.used ? `<div class="zs-got">Used your ${m.used}</div>` : ''}${m.healed ? '<div class="zs-got">💚 Your injury healed</div>' : ''}<p class="zs-line">“${esc(m.line)}”</p></div>`;
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
    return `<div class="zs-pcard zs-fcard ${E.rescued ? 'safe' : 'dead'}"><div class="zs-pbig">${E.rescued ? '🚁' : '👻'}</div><h2>${E.rescued ? 'RESCUED!' : E.wipe ? 'NOBODY MADE IT' : 'THE END'}</h2><p class="zs-line">${esc(E.line || '')}</p><p>🏆 You finished <b>#${v.rank}</b> of ${v.of} with ⭐ ${v.me.pts} points</p>${(E.awards || []).map((a) => `<div class="zs-got">${a.icon} <b>${esc(a.title)}</b></div>`).join('')}</div>
      <div class="zs-pcard"><h3>Final scores</h3>${(E.standings || []).map((r, i) => `<div class="zs-row ${r.alive ? '' : 'ghost'}"><span class="n">${i + 1}</span><span class="av">${esc(r.avatar)}</span><span class="nm">${esc(r.name)}</span><b>${r.pts}</b></div>`).join('')}</div>`;
  }

  BOX.games.zombie = {
    name: 'Zombie Survival', icon: '🧟',
    about: 'A zombie apocalypse in six days. Pick what you do in each scene (the medkit, the pistol or the rope?), then watch the TV to see who makes it. Last one standing wins.',
    how: [
      'Each scene the TV shows what’s happening. Pick one of the 3–5 options on your phone.',
      'Items help: a 🔫 makes a fight safer, a 🪢 helps you climb, a 🩹 cures a bite. Bullets run out!',
      'Some choices depend on the group: the door only holds if enough people hold it, and one decoy keeps everyone else safer.',
      'Bitten? Find a 🩹 medkit before the end of the next scene or you turn. Friends can give you theirs.',
      'If you fall, you’re a ghost: bless 🍀 or curse 🕯️ a survivor each scene and score if you call it.',
      '+100 for every scene you survive, +500 if you make the rescue. The longest survivor wins.',
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
