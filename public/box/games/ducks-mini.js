'use strict';
// JustRaiseDucks phone training mini-games (20 seconds each), drawn in a full-screen overlay
// outside the re-rendered page. Easy to pick up, hard to master:
//  - every clean action scores; mistakes only break your combo (no lost points, except bees)
//  - combos (×2 from 8, ×3 from 16) and PERFECT timing reward skilled players
//  - each run gets faster in three stages, with new things appearing as it goes
// Games: Hurdle Dash (Run), Paddle Power (Swim), Sky Rings (Fly), Cliff Climb (Climb), Bug Snack (Stamina),
// Lily Path (Smarts: watch the frog's path across the lily pads, then hop it from memory).
// DUCK_MINI.stop() ends a game at once (the race is starting): the score so far is sent as usual.
// Every run plays at one normal pace. A Risk it! round (opts.goal) plays the very hard pace: faster,
// tighter windows, more hazards, with its goal on the HUD.
// Every hit test uses the same numbers the drawing uses (DUCK_ART.duckBox for the duck, and
// each object's drawn size), so what you see is what counts. Add ?dkdebug=1 to the page URL
// to draw the hitboxes on top.
(function () {
  const A = () => window.DUCK_ART;
  const TIPS = {
    hurdles: 'Tap to jump (tap again in the air to double-jump). Jump hurdles, grab corn, but stay low under birds!',
    paddle: 'Tap LEFT, RIGHT, LEFT, RIGHT… Strokes when the gold ring meets the duck count double!',
    rings: 'Hold to fly up, let go to glide down. Fly through the middle of the rings for PERFECT. Dodge storm clouds!',
    climb: 'Tap when your wing is over the GREEN hold (the middle stripe is PERFECT). Crystals are worth more. Never grab a red loose rock!',
    bugs: 'Tap bugs fast for PERFECT. Golden beetles are worth 3. Don’t tap the bees!',
    maze: 'Watch the frog hop across the lily pads, then tap the same pads in the same order. Each path is one hop longer. Quick taps are PERFECT!',
  };
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* none */ } };
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const DEBUG = (() => { try { return /[?&]dkdebug=1\b/.test(location.search) || localStorage.getItem('dk.debug') === '1'; } catch { return false; } })();
  // circle vs. rectangle overlap
  const circRect = (cx, cy, r, b) => { const dx = cx - clamp(cx, b.l, b.r), dy = cy - clamp(cy, b.t, b.b); return dx * dx + dy * dy < r * r; };
  function rrect(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // ---------- Lily Path (Smarts): the rules, without any drawing ----------
  // A frog hops a path across the lily pads; then the duck repeats it, pad by pad. Each right pad
  // scores (PERFECT when tapped quickly after the last one), a cleared path pays a bonus and the next
  // path is one hop longer; a wrong pad is a splash: the combo is lost and the frog shows the same
  // path again. The play() overlay draws it; tools/test-box-ducks.js plays it headless.
  //   hooks.good(pad, perfect), hooks.clear(len), hooks.bad(pad), hooks.turn(), hooks.show()
  //   mode: 'normal' (3×4 pads) or 'risk' (the Risk it! round: 4×4 pads, a faster frog)
  function lilyPath(mode = 'normal', rng = Math.random, hooks = {}) {
    const risk = mode === 'risk', cols = risk ? 4 : 3, rows = 4, n = cols * rows;
    const L = { cols, rows, n, len: 3, path: [], phase: 'wait', idx: 0, cleared: 0, frog: -1, frogU: 0, lit: [], hopT: risk ? 0.42 : 0.5, at: 0, lastTap: 0, quick: risk ? 0.45 : 0.5 };
    const nb = (i) => { const c = i % cols, r = Math.floor(i / cols), out = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const c2 = c + dc, r2 = r + dr; if (c2 >= 0 && c2 < cols && r2 >= 0 && r2 < rows) out.push(r2 * cols + c2); } return out; };
    L.newPath = () => {
      // a walk from the bottom row (next to the duck's bank), never back onto a pad it already used
      let p = (rows - 1) * cols + Math.floor(rng() * cols); const path = [p];
      while (path.length < L.len) { const opts = nb(p).filter((q) => !path.includes(q)); const pool = opts.length ? opts : nb(p).filter((q) => q !== p); p = pool[Math.floor(rng() * pool.length)]; path.push(p); }
      L.path = path;
    };
    L.start = (el) => { L.newPath(); L.phase = 'show'; L.at = el + 0.6; L.lit = []; L.frog = -1; if (hooks.show) hooks.show(); };
    // speed: the game's pace (difficulty and the run's stage)
    L.update = (el, speed = 1) => {
      const hop = L.hopT / speed;
      if (L.phase === 'show') {
        const k = (el - L.at) / hop;
        if (k < 0) { L.frog = -1; return; }
        L.frog = Math.min(L.len - 1, Math.floor(k)); L.frogU = Math.min(1, (k - Math.floor(k)) / 0.55);
        L.lit = L.path.slice(0, L.frog + 1);
        if (k >= L.len + 0.35) { L.phase = 'input'; L.idx = 0; L.lit = []; L.frog = -1; L.lastTap = el; if (hooks.turn) hooks.turn(); }
      } else if ((L.phase === 'oops' || L.phase === 'clear') && el >= L.at) {
        if (L.phase === 'clear') { L.len = Math.min(L.len + 1, Math.min(9, n - 2)); L.newPath(); }
        L.phase = 'show'; L.at = el + 0.25; L.lit = []; if (hooks.show) hooks.show();
      }
    };
    // A tap on pad i (or -1: on the water). -> 'wait' (not your turn), 'ok', 'clear' or 'wrong'.
    L.tap = (i, el) => {
      if (L.phase !== 'input') return 'wait';
      if (i === L.path[L.idx]) {
        const perfect = el - L.lastTap <= L.quick; L.idx++; L.lastTap = el; L.lit = L.path.slice(0, L.idx);
        if (hooks.good) hooks.good(i, perfect);
        if (L.idx >= L.len) { L.cleared++; L.phase = 'clear'; L.at = el + 0.75; if (hooks.clear) hooks.clear(L.len); return 'clear'; }
        return 'ok';
      }
      L.phase = 'oops'; L.at = el + 0.95; L.idx = 0; if (hooks.bad) hooks.bad(i);
      return 'wrong';
    };
    return L;
  }
  // ---------- Bug Snack (Stamina): its pacing ----------
  // Normal: bugs stay up a long while, few bees (a bee only breaks your combo), bugs only start
  // walking in the final stretch, a big fingertip slop. Risk it!: the old hard pace (short-lived,
  // walking bugs, lots of bees that cost a point, a tight slop). life/spawn are seconds at the start
  // (they shrink a little over the run); the game's speed and stage divide them.
  function bugRules(mode = 'normal') {
    return mode === 'risk'
      ? { life: 1.15, lifeMin: 0.5, spawn: 0.62, spawnMin: 0.22, bee: 0.2, beeLose: 1, moveFrom: 1, move: 0.8, twin: 0.5, perfect: 0.4, slop: 5 }
      : { life: 1.7, lifeMin: 0.95, spawn: 0.72, spawnMin: 0.36, bee: 0.12, beeLose: 0, moveFrom: 2, move: 0.4, twin: 0.3, perfect: 0.55, slop: 15 };
  }
  // The score rules every mini-game uses (play() below): a clean action scores base (+1 PERFECT), ×2
  // from a combo of 8, ×3 from 16; a mistake breaks the combo. Exported so tests can score a run.
  function scorer() {
    const S = { score: 0, combo: 0 };
    S.good = (base = 1, perfect = false, noMult = false) => { S.combo++; const m = noMult ? 1 : S.combo >= 16 ? 3 : S.combo >= 8 ? 2 : 1, pts = (base + (perfect ? 1 : 0)) * m; S.score += pts; return pts; };
    S.bad = (lose = 0) => { S.combo = 0; S.score = Math.max(0, S.score - lose); };
    return S;
  }

  // ---------- Risk it!: the result ----------
  // win: the duck leaps and sparkles (XP doubled); fall: it runs, trips and tumbles over, dizzy (keeps
  // half); kept: the race stopped the round first (nothing changes).
  function riskScene(cv, duck, kind) {
    const g = cv.getContext('2d'), ART = A(), W = cv.width, H = cv.height, t0 = performance.now();
    const step = () => {
      if (!document.body.contains(cv)) return;
      const t = (performance.now() - t0) / 1000;
      const sk = g.createLinearGradient(0, 0, 0, H); sk.addColorStop(0, kind === 'win' ? '#ffcf5a' : kind === 'fall' ? '#8fb6d8' : '#a8d8ff'); sk.addColorStop(1, kind === 'win' ? '#ffefb0' : '#e3f1fb'); g.fillStyle = sk; g.fillRect(0, 0, W, H);
      g.fillStyle = '#6cc26a'; g.fillRect(0, H * 0.78, W, H); g.fillStyle = '#5aa64f'; g.fillRect(0, H * 0.78, W, 6);
      const gy = H * 0.78, s = 2.6;
      g.save();
      if (kind === 'win') {
        const hop = Math.abs(Math.sin(t * 4.2)) * 46; // happy jumps
        ART.drawDuck(g, W / 2, gy - 18 * s - hop, s, duck.color, duck.hat, t, hop > 6 ? 'fly' : 'stand', false, duck.stage);
        for (let k = 0; k < 8; k++) { const a = t * 2 + (k * Math.PI) / 4, r = 70 + Math.sin(t * 3 + k) * 12; ART.drawIcon(g, k % 2 ? 'star' : 'sparkle', W / 2 + Math.cos(a) * r * 1.4, gy - 70 - hop * 0.5 + Math.sin(a) * r * 0.6, 26, t); }
      } else if (kind === 'fall') {
        // run in (0-0.8 s), trip (0.8-1.3 s: up and over), lie flat and spin stars
        const runX = Math.min(1, t / 0.8), x = W * 0.18 + (W * 0.32) * runX;
        if (t < 0.8) ART.drawDuck(g, x, gy - 18 * s, s, duck.color, duck.hat, t * 2, 'run', false, duck.stage);
        else {
          const u = Math.min(1, (t - 0.8) / 0.5), bounce = t < 1.3 ? Math.sin(u * Math.PI) * 40 : Math.max(0, Math.sin((t - 1.3) * 9) * 10 * Math.exp(-(t - 1.3) * 4));
          g.translate(x + u * 30, gy - 10 * s - bounce); g.rotate(u * Math.PI * 0.62 + (t > 1.3 ? Math.sin(t * 2) * 0.03 : 0));
          ART.drawDuck(g, 0, -8 * s, s, duck.color, duck.hat, 0, 'stand', false, duck.stage);
          g.setTransform(1, 0, 0, 1, 0, 0);
          if (t > 1.1) ART.drawIcon(g, 'dizzy', x + 40, gy - 80, 56, t);
          if (t < 1.6) { g.globalAlpha = Math.max(0, 1 - (t - 0.8) / 0.8); g.fillStyle = '#d9b98a'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(x + 20 + k * 14, gy - 4 - Math.sin(k + t * 9) * 8, 8, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; }
        }
      } else ART.drawDuck(g, W / 2, gy - 18 * s, s, duck.color, duck.hat, t, 'stand', false, duck.stage);
      g.restore();
      requestAnimationFrame(step);
    };
    step();
  }
  function riskCard(card, r, line, SK, close, duck, opts, stopReason) {
    const pr = r.progress, bar = pr ? `<div class="dk-xpbar"><span>${SK[r.stat]} Lv ${pr.level}</span><div class="bar"><i style="width:${Math.round(((pr.have - pr.gained) / pr.need) * 100)}%"></i><i class="gain" style="width:${Math.round((pr.gained / pr.need) * 100)}%"></i></div><small>${pr.need - pr.have} XP to Lv ${pr.level + 1}</small></div>` : '';
    const nm = BOX.esc(duck.name || 'Your duck'), napLine = r.nap ? `<p class="dk-napnote">😴 ${nm} is worn out: nap time!</p>` : '';
    const head = r.risk === 'win' ? '<div class="dk-badge good">🎲 YOU DID IT!</div>' : r.risk === 'fall' ? `<div class="dk-badge bad">💥 ${nm} FELL!</div>` : `<div class="dk-badge">${BOX.esc(stopReason || 'Stopped for the race')}</div>`;
    const gain = r.risk === 'win' ? `<p class="dk-gain"><b>+${r.xp}</b> bonus XP · your XP is <b>doubled</b>!</p>`
      : r.risk === 'fall' ? `<p class="dk-loss"><b>−${-r.xp}</b> XP · ${nm} keeps half (+${r.base + r.xp} of ${r.base})</p>`
      : '<p class="muted">The race started before the goal: you keep all your XP.</p>';
    card.className = 'dk-result risk ' + r.risk;
    card.innerHTML = `${head}<canvas class="dk-riskcv" width="520" height="220"></canvas><h2>${r.score} / 🎯 ${r.goal}</h2>${line}${gain}${r.levelUp ? `<p class="lvup">LEVEL UP! ${SK[r.stat]} is now level ${r.levelUp} 🎉</p>` : ''}${r.levelDown != null ? `<p class="dk-loss">${SK[r.stat]} slipped back to level ${r.levelDown}</p>` : ''}${bar}${napLine}<div class="dk-resbtns"><button class="btn big">Back to my farm</button></div>`;
    riskScene(card.querySelector('canvas'), duck, r.risk);
    BOX.sfx(r.risk === 'win' ? 'win' : r.risk === 'fall' ? 'boo' : 'chime'); buzz(r.risk === 'win' ? [40, 40, 80] : r.risk === 'fall' ? [120, 60, 200] : 30);
    card.querySelector('button').onclick = close;
  }

  // The game on screen right now (DUCK_MINI.stop / active).
  let current = null;
  function play(kind, seconds, duck, done, opts = {}) {
    // GOAL: a Risk it! round (the very hard pace); else the normal game with its ⭐ TARGET.
    const SP = opts.speed || 1, GOAL = opts.goal || 0, TARGET = GOAL ? 0 : opts.target || 0, MODE = GOAL ? 'risk' : 'normal';
    const pick = (o) => (o[MODE] != null ? o[MODE] : o.normal);
    const seenKey = 'dk.seen.' + kind; let first = false;
    try { first = !localStorage.getItem(seenKey); localStorage.setItem(seenKey, '1'); } catch { /* private mode */ }
    const ov = document.createElement('div'); ov.className = 'dk-over';
    ov.innerHTML = `<div class="dk-hud"><b class="sc">0</b><span class="mid">${GOAL ? `🎲 RISK IT · 🎯 <b class="gl">0/${GOAL}</b>` : `${TARGET ? `⭐ ${TARGET}` : ''}${opts.best ? ` · best ${opts.best}` : ''}`}</span><span class="tm">${seconds}</span></div>
      <div class="dk-combo" hidden></div><div class="dk-banner" hidden></div>
      <canvas></canvas>${kind === 'paddle' ? '<div class="dk-pads"><button data-pad="L">LEFT</button><button data-pad="R">RIGHT</button></div>' : ''}
      <div class="dk-tip ${first ? 'first' : ''} ${GOAL ? 'risk' : ''}">${GOAL ? `<b>🎲 RISK IT!</b>Score <b>🎯 ${GOAL}</b> in ${seconds} seconds. Everything is faster and trickier!<br>` : first ? '<b>How to play</b>' : ''}${TIPS[kind]}</div><div class="dk-ready">3</div>${GOAL ? '<div class="dk-goalbar"><i></i></div>' : ''}`;
    if (GOAL) ov.classList.add('risk');
    document.body.appendChild(ov); document.body.classList.add('dk-lock');
    const close = () => { ov.remove(); document.body.classList.remove('dk-lock'); if (window.DUCK_MINI.dbg && window.DUCK_MINI.dbg.ov === ov) window.DUCK_MINI.dbg = null; if (current && current.ov === ov) current = null; };
    // iPhones start selecting text / show the magnifier on a held finger: stop that here.
    ov.addEventListener('touchstart', (e) => { if (!e.target.closest('button')) e.preventDefault(); }, { passive: false });
    const cv = ov.querySelector('canvas'), g = cv.getContext('2d');
    const DPR = Math.min(2, window.devicePixelRatio || 1), W = ov.clientWidth, H = ov.clientHeight - (kind === 'paddle' ? 130 : 0);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px'; cv.style.flex = 'none'; g.setTransform(DPR, 0, 0, DPR, 0, 0);
    // All game coordinates are CSS pixels (the DPR transform above maps them to the backing
    // store), and sizes scale with U so a big phone gets a proportionally bigger course.
    const U = clamp(Math.min(W / 390, H / 740), 0.8, 1.6);
    const ART = A(), drawDuck = ART.drawDuck, stageOf = (el) => (el < seconds / 3 ? 0 : el < (seconds * 2) / 3 ? 1 : 2);
    const SM = [1, 1.15, 1.32]; // speed per stage
    let score = 0, combo = 0, bestCombo = 0, t0 = 0, last = 0, over = false, holding = false, started = false, stage = 0;
    const stats = { ok: 0, perfect: 0, miss: 0 }, log = []; // log: what went wrong (debug only)
    const fx = { floats: [], parts: [], shake: 0 };
    const hud = () => {
      const el = ov.querySelector('.sc'); el.textContent = score;
      if (TARGET && score >= TARGET && !el.classList.contains('star')) { el.classList.add('star'); BOX.sfx('chime'); banner('⭐ Target hit!'); }
      if (GOAL) {
        const gl = ov.querySelector('.gl'), gb = ov.querySelector('.dk-goalbar i'); gl.textContent = `${Math.min(score, GOAL)}/${GOAL}`; if (gb) gb.style.width = Math.min(100, (score / GOAL) * 100) + '%';
        if (score >= GOAL && !ov.classList.contains('made')) { ov.classList.add('made'); BOX.sfx('win'); buzz([40, 30, 40]); banner('🎯 GOAL! Keep going!'); }
      }
      const c = ov.querySelector('.dk-combo'); const mult = combo >= 16 ? 3 : combo >= 8 ? 2 : 1;
      c.hidden = combo < 3; c.textContent = `Combo ${combo}${mult > 1 ? ` · ×${mult}` : ''}`; c.className = 'dk-combo m' + mult;
    };
    function banner(text) { const b = ov.querySelector('.dk-banner'); b.textContent = text; b.hidden = false; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); clearTimeout(b._t); b._t = setTimeout(() => { b.hidden = true; }, 1100); }
    function float(x, y, text, color = '#fff', size = 22) { fx.floats.push({ x, y, text, color, size, age: 0 }); }
    function burst(x, y, color, n = 8) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = 60 + Math.random() * 140; fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, color, age: 0 }); } }
    // A clean action: points (bigger with a combo), a pop-up and a sparkle.
    function good(x, y, base = 1, perfect = false, label = '', noMult = false) {
      combo++; bestCombo = Math.max(bestCombo, combo);
      const mult = noMult ? 1 : combo >= 16 ? 3 : combo >= 8 ? 2 : 1, pts = (base + (perfect ? 1 : 0)) * mult;
      score += pts; stats.ok++; if (perfect) { stats.perfect++; buzz(12); }
      float(x, y, `${label || (perfect ? 'PERFECT' : '')} +${pts}`.trim(), perfect ? '#ffd23f' : base > 1 ? '#7fe0ff' : '#ffffff', perfect ? 26 : 22);
      burst(x, y, perfect ? '#ffd23f' : '#ffffff', perfect ? 12 : 6);
      BOX.sfx(perfect ? 'chime' : 'pop');
      if (!noMult && (combo === 8 || combo === 16)) banner(`Combo ×${combo === 8 ? 2 : 3}!`);
      hud();
    }
    // A mistake: only the combo is lost (and a little shake).
    function bad(x, y, text = 'Oops!', lose = 0) {
      if (combo >= 5) float(x, y - 26, 'Combo lost', '#ffb3b3', 18);
      combo = 0; stats.miss++; score = Math.max(0, score - lose); if (DEBUG) log.push(text);
      float(x, y, lose ? `${text} −${lose}` : text, '#ff8a8a', 22); fx.shake = 10; BOX.sfx('boo'); buzz(60); hud();
    }
    const quietMiss = (why = 'miss') => { combo = 0; hud(); if (DEBUG) log.push(why); };
    // debug drawing helpers (only with ?dkdebug=1)
    const dbgRect = (b, c = '#ff00ff') => { g.strokeStyle = c; g.lineWidth = 1.5; g.strokeRect(b.l, b.t, b.r - b.l, b.b - b.t); };
    const dbgCirc = (x, y, r, c = '#00e5ff') => { g.strokeStyle = c; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, Math.max(0.5, r), 0, TAU); g.stroke(); };
    const dbgText = (x, y, t, c = '#fff') => { g.font = '600 11px monospace'; g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x - 2, y - 10, g.measureText(t).width + 4, 13); g.fillStyle = c; g.fillText(t, x, y); };
    const sky = (top, bottom, h = H) => { const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, top); s.addColorStop(1, bottom); g.fillStyle = s; g.fillRect(0, 0, W, h); };
    function puffCloud(x, y, s, col) { g.fillStyle = col; for (const [dx, dy, r] of [[0, 0, 22], [24, -8, 18], [46, 0, 20], [22, 6, 18]]) { g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); g.fill(); } }

    // ---- the five games ----
    const S = { items: [], spawn: 0.6, stun: 0, t: 0 };
    const GAMES = {
      // ---------------- Hurdle Dash ----------------
      // Ground line S.surf; the duck's feet stand on it. Hurdles are hit against the duck's
      // feet zone (legs + belly), birds and corn against its body box.
      hurdles: {
        init() {
          S.surf = Math.round(H * 0.74); S.h = 0; S.vy = 0; S.jumps = 0; S.scroll = 0; S.buf = 0;
          S.ds = 1.7 * U; S.dx = Math.round(W * 0.26);
          S.ss = ART.duckBox(0, 0, S.ds, 'stand', 0, duck.stage).ss;
          S.G = 2600 * U; S.V1 = Math.sqrt(2 * S.G * 150 * U); S.V2 = S.V1 * 0.75; // a 150 px jump, ~0.68 s in the air (clears a hurdle with ~0.2 s to spare)
          S.bs = 1.15 * U; S.birdR = 11 * S.bs; // bird body (hit) radius
          S.birdH = 39 * S.ds + 14 * U + S.birdR; // above a grown duck's head, with room to spare
          S.slack = pick({ normal: 2, risk: 0 }) * U;
        },
        mode() { return S.stun > 0 ? 'stand' : S.h > 0.5 ? 'fly' : 'run'; },
        y() { return S.surf - S.h - 18 * S.ss; },
        box(el) { return ART.duckBox(S.dx, this.y(), S.ds, this.mode(), el, duck.stage); },
        hurdleRect(it) { const hh = (it.tall ? 62 : 42) * U; return { l: it.x - 15 * U, r: it.x + 15 * U, t: S.surf - hh, b: S.surf + 4 * U }; },
        press() { if (S.jumps < 2) { S.vy = -(S.jumps ? S.V2 : S.V1); S.jumps++; S.buf = 0; BOX.sfx('pop'); } else S.buf = 0.15; }, // a tap just before landing still jumps
        update(dt, el) {
          const spd = 185 * U * SP * SM[stage] * (S.stun > 0 ? 0.5 : 1);
          if (S.h > 0 || S.vy < 0) { S.vy += S.G * dt; S.h -= S.vy * dt; if (S.h <= 0) { S.h = 0; S.vy = 0; S.jumps = 0; if (S.buf > 0) this.press(); } }
          S.buf = Math.max(0, S.buf - dt);
          S.scroll += spd * dt; S.stun -= dt;
          S.spawn -= dt;
          if (S.spawn <= 0) {
            const lastIt = S.items[S.items.length - 1], room = !lastIt || lastIt.x < W - 170 * U; // never a bird right on top of a hurdle
            const r = Math.random(), birdRate = stage >= 1 ? 0.22 : 0, x = W + 40 * U;
            if (r < birdRate && room) S.items.push({ k: 'bird', x, y: S.surf - S.birdH, ph: Math.random() * TAU });
            else if (r < 0.42) S.items.push({ k: 'corn', x, y: S.surf - [30, 95, 150][Math.floor(Math.random() * 3)] * U, ph: Math.random() * TAU });
            else S.items.push({ k: 'hurdle', x, tall: stage === 2 && Math.random() < 0.35, clear: Infinity });
            S.spawn = (0.8 + Math.random() * 0.55) / (SP * SM[stage]);
          }
          const b = this.box(el), fb = b.feet, f = S.slack;
          for (const it of S.items) {
            it.x -= spd * dt * (it.k === 'bird' ? 1.2 : 1);
            if (it.k === 'hurdle') {
              if (it.hit || it.done) continue;
              const hr = this.hurdleRect(it);
              if (fb.r > hr.l + f && fb.l < hr.r - f) { // over the hurdle right now
                const gap = hr.t - fb.b;
                if (gap < -f) { it.hit = true; it.fall = 0; S.stun = 0.6; bad(S.dx, S.surf - 70 * U, 'Trip!'); }
                else it.clear = Math.min(it.clear, gap);
              } else if (hr.r < fb.l) { it.done = true; good(S.dx, S.surf - 80 * U, it.tall ? 2 : 1, it.clear < 20 * U); }
            } else if (it.k === 'corn') {
              if (!it.done && circRect(it.x, it.y + Math.sin(el * 6 + it.ph) * 4 * U, 12 * U, b)) { it.done = true; good(it.x, it.y, 1, false, 'Corn'); }
            } else if (it.k === 'bird') {
              const by = it.y + Math.sin(el * 5 + it.ph) * 3 * U;
              if (!it.done && circRect(it.x, by, S.birdR, { l: b.l + f, r: b.r - f, t: b.t + f, b: b.b - f })) { it.done = true; it.hit = true; S.stun = 0.5; bad(S.dx, S.surf - 90 * U, 'Bonk!'); }
              if (!it.done && it.x + S.birdR < b.l) { it.done = true; good(S.dx, S.surf - 80 * U, 1, false, 'Dodge'); }
            }
          }
          for (const it of S.items) if (it.fall != null) it.fall = Math.min(1, it.fall + dt * 6);
          S.items = S.items.filter((i) => i.x > -60 * U && !(i.k === 'corn' && i.done));
        },
        draw(el) {
          const gr = S.surf;
          sky('#7cc8ff', '#d8f1ff', gr);
          g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(W * 0.82, H * 0.14, 26 * U, 0, TAU); g.fill();
          for (let i = 0; i < 4; i++) { const x = ((i * 160 - S.scroll * 0.12) % (W + 160) + W + 160) % (W + 160) - 80; puffCloud(x, H * 0.1 + (i % 2) * 60 * U, 0.8 * U, 'rgba(255,255,255,.85)'); }
          g.fillStyle = '#9fd39a'; g.beginPath(); g.moveTo(0, gr); for (let x = 0; x <= W; x += 16) g.lineTo(x, gr - 60 * U - Math.sin((x + S.scroll * 0.3) / 70) * 18 * U); g.lineTo(W, gr); g.fill();
          g.fillStyle = '#86c97f'; g.beginPath(); g.moveTo(0, gr); for (let x = 0; x <= W; x += 16) g.lineTo(x, gr - 26 * U - Math.sin((x + S.scroll * 0.6) / 45) * 9 * U); g.lineTo(W, gr); g.fill();
          // the running path and the grass below (everything under the sky is repainted each frame)
          g.fillStyle = '#d9a86c'; g.fillRect(0, gr - 4 * U, W, 18 * U);
          g.fillStyle = 'rgba(120,80,40,.35)'; for (let x = -(S.scroll % 40); x < W; x += 40) g.fillRect(x, gr + 4 * U, 16 * U, 3 * U);
          g.fillStyle = '#6cc26a'; g.fillRect(0, gr + 14 * U, W, H);
          g.fillStyle = '#5db35b'; for (let x = -(S.scroll % 60); x < W; x += 60) for (let r = 0; r < 4; r++) g.fillRect(x + r * 23 % 60, gr + 30 * U + r * 38 * U, 26 * U, 5 * U);
          // the duck's shadow (smaller the higher it jumps)
          const sh = clamp(1 - S.h / (220 * U), 0.3, 1);
          g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(S.dx, gr + 2 * U, 20 * S.ss * sh, 4 * U * sh, 0, 0, TAU); g.fill();
          for (const it of S.items) {
            if (it.k === 'hurdle') {
              const hr = this.hurdleRect(it), hh = gr - hr.t;
              g.save(); g.translate(it.x, gr);
              if (it.fall != null) g.rotate(it.fall * 1.35); // knocked over
              g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(-15 * U, 2 * U, 30 * U, 3 * U);
              g.fillStyle = '#f4f4f4'; g.strokeStyle = 'rgba(60,40,30,.45)'; g.lineWidth = 1;
              for (const px of [-12, 8]) { g.fillRect(px * U, -hh, 4 * U, hh + 4 * U); g.strokeRect(px * U, -hh, 4 * U, hh + 4 * U); g.fillRect((px - 2) * U, 0, 8 * U, 4 * U); }
              g.fillStyle = it.tall ? '#ff8c42' : '#e63946'; g.fillRect(-15 * U, -hh, 30 * U, 9 * U);
              g.fillStyle = '#fff'; for (const sx of [-8, 3]) g.fillRect(sx * U, -hh, 5 * U, 9 * U);
              g.strokeStyle = 'rgba(60,20,20,.55)'; g.strokeRect(-15 * U, -hh, 30 * U, 9 * U);
              g.restore();
            } else if (it.k === 'corn') {
              const cy = it.y + Math.sin(el * 6 + it.ph) * 4 * U;
              g.fillStyle = 'rgba(255,230,120,.35)'; g.beginPath(); g.arc(it.x, cy, 16 * U, 0, TAU); g.fill();
              ART.drawIcon(g, 'corn', it.x, cy, 30 * U, el);
            } else if (it.k === 'bird') ART.drawBird(g, it.x, it.y + Math.sin(el * 5 + it.ph) * 3 * U, S.bs * (it.hit ? 0.9 : 1), el + it.ph);
          }
          drawDuck(g, S.dx, this.y(), S.ds, duck.color, duck.hat, el, this.mode(), false, duck.stage);
          if (S.stun > 0) ART.drawIcon(g, 'dizzy', S.dx + 6 * U, this.y() - 30 * S.ss, 30 * U, el);
        },
        debug(el) {
          const b = this.box(el); dbgRect(b, '#ff00ff'); dbgRect(b.feet, '#00e5ff');
          g.strokeStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(0, S.surf); g.lineTo(W, S.surf); g.stroke();
          for (const it of S.items) {
            if (it.k === 'hurdle') { dbgRect(this.hurdleRect(it), it.hit ? '#ff4040' : '#ffff00'); if (it.clear < Infinity) dbgText(it.x - 14, this.hurdleRect(it).t - 6, 'gap ' + Math.round(it.clear)); }
            else if (it.k === 'corn') dbgCirc(it.x, it.y + Math.sin(el * 6 + it.ph) * 4 * U, 12 * U, '#7cff7c');
            else dbgCirc(it.x, it.y + Math.sin(el * 5 + it.ph) * 3 * U, S.birdR, '#ff4040');
          }
        },
      },
      // ---------------- Paddle Power ----------------
      // A beat clock (S.prev / S.next = the last and the coming beat). The gold ring closes on
      // the duck exactly at each beat; a stroke within the window of a beat is "on the beat".
      paddle: {
        init() {
          S.side = null; S.strokes = 0; S.x = 0; S.lastStroke = 0; S.lastCount = -1; S.lastBeat = -1; S.flash = 0; S.rip = [];
          S.beatT = pick({ normal: 0.42, risk: 0.36 }); S.win = pick({ normal: 0.1, risk: 0.075 }); S.per = 5;
          S.prev = 0; S.next = S.beatT; S.beatI = 0; S.ds = 2.2 * U; S.cy = H * 0.56;
        },
        tick(el) { while (el >= S.next) { S.prev = S.next; S.beatI++; S.next = S.prev + S.beatT / SM[stageOf(S.prev)]; } },
        setNext(sd) { for (const b of ov.querySelectorAll('[data-pad]')) b.classList.toggle('next', !!sd && b.dataset.pad !== sd); },
        pad(sd, el) {
          this.tick(el);
          if (sd === S.side) { S.stun = 0.35; S.x -= 0.4; bad(W * 0.5, H * 0.4, 'Splash!'); return; }
          S.side = sd; S.lastStroke = el; this.setNext(sd);
          S.rip.push({ sd, age: 0 });
          const B = S.next - S.prev, dPrev = el - S.prev, dNext = S.next - el, near = dPrev <= dNext ? S.beatI : S.beatI + 1, off = Math.min(dPrev, dNext);
          const onBeat = off < S.win && near !== S.lastBeat; // one on-beat stroke per beat
          if (onBeat) { S.lastBeat = near; S.flash = 0.22; }
          if (!onBeat && el - S.lastCount < B * 0.45) { S.x += 0.3; return; } // too fast: find the rhythm
          S.lastCount = el;
          S.strokes += onBeat ? 2 : 1; S.x += onBeat ? 1.6 : 1;
          const px = W * (sd === 'L' ? 0.28 : 0.72);
          if (onBeat) float(px, H * 0.78, '♪', '#ffd23f', 26);
          else if (off < S.win * 2.6) float(px, H * 0.78, dPrev <= dNext ? 'late' : 'early', '#ffffffcc', 16);
          BOX.sfx('step');
          while (S.strokes >= S.per) { S.strokes -= S.per; good(W * 0.5, H * 0.36, 1, false, onBeat ? '♪' : '', true); }
        },
        update(dt, el) {
          this.tick(el); S.stun -= dt; S.flash -= dt;
          for (const r of S.rip) r.age += dt; S.rip = S.rip.filter((r) => r.age < 0.6);
          // from stage 2 the river pushes back if you stop paddling
          if (stage >= 1 && el - S.lastStroke > 0.7) { S.x -= dt * 1.5; if (S.strokes > 0 && Math.random() < dt * 2) S.strokes = Math.max(0, S.strokes - 1); }
        },
        ringR(el) { return (40 + clamp((S.next - el) / (S.next - S.prev), 0, 1) * 70) * U; },
        draw(el) {
          g.fillStyle = '#4fb3ff'; g.fillRect(0, 0, W, H);
          g.fillStyle = '#7cc96f'; g.fillRect(0, 0, 26 * U, H); g.fillRect(W - 26 * U, 0, 26 * U, H); // the banks
          g.fillStyle = '#5aa64f'; for (let i = 0; i < 12; i++) { const yy = (((i * 90 + S.x * 22) % (H + 90)) + H + 90) % (H + 90) - 45; g.beginPath(); g.arc(i % 2 ? W - 12 * U : 12 * U, yy, 14 * U, 0, TAU); g.fill(); }
          g.fillStyle = 'rgba(255,255,255,.35)';
          for (let i = 0; i < 14; i++) { const yy = (i * 61) % H, xx = ((i * 97 - S.x * 14) % (W + 80) + W + 80) % (W + 80) - 40; g.fillRect(xx, yy, 40 * U, 3 * U); }
          for (let i = 0; i < 6; i++) { const xx = ((i * 173 - S.x * 22) % (W + 120) + W + 120) % (W + 120) - 60, yy = H * 0.15 + (i % 3) * 30 * U; g.fillStyle = '#4caf50'; g.beginPath(); g.ellipse(xx, yy, 22 * U, 9 * U, 0, 0.35, TAU); g.lineTo(xx, yy); g.fill(); if (i % 3 === 1) { g.fillStyle = '#ff9ccf'; g.beginPath(); g.arc(xx + 6 * U, yy - 3 * U, 4 * U, 0, TAU); g.fill(); } }
          if (stage >= 1) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; for (let i = 0; i < 5; i++) { const yy = H * 0.3 + i * 40 * U, xx = W - ((el * 160 + i * 90) % (W + 100)); g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + 40 * U, yy); g.stroke(); } }
          const cx = W * 0.5, cy = S.cy;
          for (const r of S.rip) { g.strokeStyle = `rgba(255,255,255,${0.8 * (1 - r.age / 0.6)})`; g.lineWidth = 3; g.beginPath(); g.ellipse(cx + (r.sd === 'L' ? -1 : 1) * 34 * U, cy + 18 * U, (8 + r.age * 50) * U, (3 + r.age * 16) * U, 0, 0, TAU); g.stroke(); }
          // the beat: a gold ring that closes on the duck; the white ring is "now"
          if (S.flash > 0) { g.fillStyle = `rgba(255,210,63,${S.flash * 2})`; g.beginPath(); g.arc(cx, cy, 52 * U, 0, TAU); g.fill(); }
          g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 40 * U, 0, TAU); g.stroke();
          g.strokeStyle = 'rgba(255,210,63,.95)'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy, this.ringR(el), 0, TAU); g.stroke();
          drawDuck(g, cx, cy, S.ds, duck.color, duck.hat, el * (1 + S.x * 0.02), 'swim', false, duck.stage);
          // the stroke meter: S.per pips, filled with this lap's strokes
          const pw = 18 * U, gap = 6 * U, x0 = cx - (S.per * (pw + gap) - gap) / 2;
          for (let i = 0; i < S.per; i++) { g.fillStyle = i < S.strokes ? '#ffd23f' : 'rgba(255,255,255,.35)'; rrect(g, x0 + i * (pw + gap), H * 0.86, pw, 10 * U, 4 * U); g.fill(); }
          g.fillStyle = '#fff'; g.font = `bold ${Math.round(17 * U)}px Fredoka, sans-serif`; g.textAlign = 'center';
          g.fillText(S.stun > 0 ? 'Splash! Alternate LEFT and RIGHT!' : 'Stroke when the gold ring meets the white one', W / 2, H * 0.94); g.textAlign = 'left';
        },
        debug(el) {
          const B = S.next - S.prev, k = (S.win / B) * 70 * U; // the on-beat window, in ring radius
          dbgCirc(W / 2, S.cy, 40 * U + k, '#7cff7c'); dbgText(8, 90, `beat ${B.toFixed(2)}s win ±${S.win}s next in ${(S.next - el).toFixed(2)}`);
        },
      },
      // ---------------- Sky Rings ----------------
      // The duck's hit circle is DUCK_ART.duckBox(...).rad (body + head), turned with the tilt.
      // A ring's opening (inner edge of the rim) is `open`; the rim is S.rim thick. A ring is
      // judged once, when the duck's centre crosses the ring's plane:
      //   off <= open − rad  → through the hole (PERFECT if off <= perfect radius)
      //   off <  open + rim + rad → clipped the rim;  else missed.
      rings: {
        init() {
          S.ds = 1.75 * U; S.dx = Math.round(W * 0.28); S.y = H * 0.5; S.vy = 0; S.gust = 0; S.gustT = 4; S.tilt = 0; S.ft = 0;
          S.VMAX = 360 * U; S.top = 66; S.bot = H - 8;
          S.R = ART.duckBox(0, 0, S.ds, 'fly', 0, duck.stage).rad;
          S.margin = pick({ normal: 30, risk: 21 }) * U; S.rim = 8 * U;
          S.cloudK = pick({ normal: 0.82, risk: 0.9 }); S.gustK = pick({ normal: 1, risk: 1.25 });
          S.lastRing = null; S.lastCloud = null; S.gap = 1;
        },
        // the duck's hit circle right now (same t, tilt and scale as the drawing)
        hit() {
          const b = ART.duckBox(0, 0, S.ds, 'fly', S.ft, duck.stage), c = Math.cos(S.tilt), s = Math.sin(S.tilt);
          return { x: S.dx + b.cx * c - b.cy * s, y: S.y + b.cx * s + b.cy * c, r: b.rad, oy: b.cy };
        },
        perfR(it) { return Math.max(5 * U, (it.open - S.R) * 0.4); },
        update(dt, el) {
          const tgt = holding ? -S.VMAX : S.VMAX * 0.8, turning = holding ? S.vy > 0 : S.vy < 0;
          S.vy += (tgt - S.vy) * Math.min(1, dt * (turning ? 10 : 5)); // reversing snaps quickly: responsive
          if (stage >= 1) { S.gustT -= dt; if (S.gustT <= 0) { S.gust = (Math.random() < 0.5 ? -1 : 1) * 150 * U * S.gustK; /* well under top speed: you can always fight it */ S.gustT = 3 + Math.random() * 2; banner(S.gust < 0 ? '💨 Updraft!' : '💨 Downdraft!'); } S.gust *= Math.pow(0.4, dt); }
          S.y += (S.vy + S.gust) * dt; S.ft += dt * (holding ? 1.8 : 0.8);
          S.tilt = clamp(S.vy / S.VMAX, -1, 1) * 0.28;
          const h0 = this.hit(), lo = S.top + S.R - (h0.y - S.y), hi = S.bot - S.R - (h0.y - S.y); // keep the hit circle on screen
          if (S.y < lo) { S.y = lo; if (S.vy < 0) S.vy = 0; } if (S.y > hi) { S.y = hi; if (S.vy > 0) S.vy = 0; }
          const spd = 165 * U * SP * SM[stage];
          S.spawn -= dt;
          if (S.spawn <= 0) {
            const recent = (o, d) => o && o.x > W - d * U;
            if (S.lastRing && Math.random() < 0.22 * SP) {
              const cs = (1 + Math.random() * 0.25) * U, puffs = [[0, 0, 20], [18, -8, 16], [-18, -5, 15], [8, 9, 15], [-9, 9, 14]].map(([x, y, r]) => [x * cs, y * cs, r * cs]);
              let y = 0; for (let k = 0; k < 10; k++) { y = S.top + 40 * U + Math.random() * (S.bot - S.top - 80 * U); if (!recent(S.lastRing, 230) || Math.abs(y - S.lastRing.y) > S.lastRing.open + 70 * U) break; }
              const it = { cloud: true, x: W + 50 * U, y, puffs, ph: Math.random() * 10 }; S.items.push(it); S.lastCloud = it;
            } else {
              const gold = Math.random() < 0.15, open = S.R + S.margin * (gold ? 0.75 : 1), m = open + S.rim + 4 * U;
              const reach = S.VMAX * 0.65 * S.gap;
              let y = S.lastRing ? S.lastRing.y + (Math.random() * 2 - 1) * reach : H * 0.5;
              if (recent(S.lastCloud, 170) && Math.abs(y - S.lastCloud.y) < open + 60 * U) y = S.lastCloud.y + Math.sign(y - S.lastCloud.y || 1) * (open + 60 * U);
              y = clamp(y, S.top + m, S.bot - m);
              const it = { x: W + 40 * U, y, dy: S.lastRing ? y - S.lastRing.y : 0, gold, open, wob: stage === 2 && Math.random() < 0.6 ? Math.random() * TAU : null, age: 0 };
              S.items.push(it); S.lastRing = it;
            }
            S.gap = (0.95 + Math.random() * 0.35) / (SP * SM[stage]); S.spawn = S.gap;
          }
          const h = this.hit();
          for (const it of S.items) {
            const px = it.x; it.x -= spd * dt; it.age = (it.age || 0) + dt; if (it.shake > 0) it.shake -= dt;
            if (it.cloud) {
              if (!it.done) for (const [ox, oy, r] of it.puffs) if (Math.hypot(it.x + ox - h.x, it.y + oy - h.y) < r * S.cloudK + h.r) { it.done = true; S.vy = S.VMAX * 0.7; bad(h.x, h.y - 34 * U, 'Zap!'); break; }
              continue;
            }
            if (it.wob != null) it.y = clamp(it.y + Math.sin(el * 2.6 + it.wob) * 50 * U * dt, S.top + it.open + S.rim, S.bot - it.open - S.rim);
            if (!it.done && px > h.x && it.x <= h.x) { // the duck crosses the ring's plane right now
              const off = Math.abs(it.y - h.y); it.done = true; it.off = off; it.at = el; if (DEBUG) log.push('ring off ' + Math.round(off) + ' hole ' + Math.round(it.open - h.r) + ' dy ' + Math.round(it.dy || 0) + (it.wob != null ? ' wob' : '') + ' gust ' + Math.round(S.gust));
              if (off <= it.open - h.r) { it.pass = true; good(h.x, h.y - 40 * U, it.gold ? 2 : 1, off <= this.perfR(it)); }
              else if (off < it.open + S.rim + h.r) { it.clip = true; it.shake = 0.4; bad(h.x, h.y - 40 * U, 'Clipped!'); }
              else { it.missed = true; quietMiss('ring missed'); }
            }
          }
          S.items = S.items.filter((i) => i.x > -80 * U);
        },
        // half: 'back' (left side, behind the duck) or 'front' (right side, over the duck)
        drawRing(it, half, el) {
          const ry = it.open + S.rim / 2, rx = ry * 0.34, x = it.x + (it.shake > 0 ? Math.sin(el * 70) * 4 * U * it.shake : 0), y = it.y;
          const a0 = half === 'back' ? Math.PI / 2 : -Math.PI / 2, a1 = a0 + Math.PI;
          const col = it.gold ? ['#c99a00', '#ffcc00', '#fff1a0'] : ['#c2306e', '#ff4f9a', '#ffc0dc'];
          g.globalAlpha = it.missed || it.clip ? 0.35 : it.pass ? Math.max(0.25, 1 - (el - it.at) * 1.5) : 1;
          if (half === 'back' && !it.done) { const gl = g.createRadialGradient(x, y, 0, x, y, this.perfR(it) * 1.6); gl.addColorStop(0, 'rgba(255,255,255,.75)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.beginPath(); g.ellipse(x, y, this.perfR(it) * 0.6, this.perfR(it) * 1.6, 0, 0, TAU); g.fill(); }
          g.lineCap = 'butt';
          g.strokeStyle = half === 'back' ? col[0] : col[1]; g.lineWidth = S.rim; g.beginPath(); g.ellipse(x, y, rx, ry, 0, a0, a1); g.stroke();
          if (half === 'front') { g.strokeStyle = col[2]; g.lineWidth = S.rim * 0.28; g.beginPath(); g.ellipse(x + S.rim * 0.12, y, rx, ry - S.rim * 0.22, 0, a0 + 0.25, a1 - 0.25); g.stroke(); }
          if (it.gold && half === 'front' && !it.done) ART.drawIcon(g, 'sparkle', x + rx, y - ry, 16 * U, el);
          g.globalAlpha = 1;
        },
        drawCloud(it, el) {
          for (const [ox, oy, r] of it.puffs) { g.fillStyle = '#5b6474'; g.beginPath(); g.arc(it.x + ox, it.y + oy, r, 0, TAU); g.fill(); }
          for (const [ox, oy, r] of it.puffs) if (oy < 2) { g.fillStyle = '#7d8798'; g.beginPath(); g.arc(it.x + ox - r * 0.15, it.y + oy - r * 0.2, r * 0.7, 0, TAU); g.fill(); }
          const flick = Math.sin(el * 13 + it.ph) > 0.2;
          if (flick) ART.drawIcon(g, 'bolt', it.x + 2 * U, it.y + 26 * U, 22 * U, el);
          g.fillStyle = '#fff'; for (const ex of [-7, 7]) { g.beginPath(); g.arc(it.x + ex * U, it.y + 1 * U, 3 * U, 0, TAU); g.fill(); }
          g.strokeStyle = '#2b3240'; g.lineWidth = 2 * U; g.beginPath(); g.moveTo(it.x - 12 * U, it.y - 6 * U); g.lineTo(it.x - 3 * U, it.y - 3 * U); g.moveTo(it.x + 12 * U, it.y - 6 * U); g.lineTo(it.x + 3 * U, it.y - 3 * U); g.stroke();
        },
        draw(el) {
          sky('#8fd4ff', '#e8f7ff');
          for (let i = 0; i < 6; i++) { const x = ((i * 170 - el * 40) % (W + 140) + W + 140) % (W + 140) - 70; puffCloud(x, 80 * U + ((i * 137) % Math.max(1, H - 160 * U)), 0.7 * U, 'rgba(255,255,255,.7)'); }
          for (const it of S.items) if (it.cloud) this.drawCloud(it, el);
          for (const it of S.items) if (!it.cloud) this.drawRing(it, 'back', el);
          if (Math.abs(S.gust) > 20) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { const x = (i * 77 + el * 200) % W, y = (i * 113) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + (S.gust > 0 ? 24 : -24)); g.stroke(); } }
          g.save(); g.translate(S.dx, S.y); g.rotate(S.tilt); drawDuck(g, 0, 0, S.ds, duck.color, duck.hat, S.ft, 'fly', false, duck.stage); g.restore();
          for (const it of S.items) if (!it.cloud) this.drawRing(it, 'front', el);
        },
        debug() {
          const h = this.hit(); dbgCirc(h.x, h.y, h.r, '#00e5ff'); g.fillStyle = '#00e5ff'; g.fillRect(h.x - 1.5, h.y - 1.5, 3, 3);
          g.strokeStyle = 'rgba(0,229,255,.5)'; g.beginPath(); g.moveTo(h.x, 0); g.lineTo(h.x, H); g.stroke();
          for (const it of S.items) {
            if (it.cloud) { for (const [ox, oy, r] of it.puffs) dbgCirc(it.x + ox, it.y + oy, r * S.cloudK, '#ff4040'); continue; }
            g.lineWidth = 3; g.strokeStyle = '#7cff7c'; g.beginPath(); g.moveTo(it.x, it.y - it.open); g.lineTo(it.x, it.y + it.open); g.stroke();
            g.strokeStyle = '#ff4040'; g.beginPath(); g.moveTo(it.x, it.y - it.open - S.rim); g.lineTo(it.x, it.y - it.open); g.moveTo(it.x, it.y + it.open); g.lineTo(it.x, it.y + it.open + S.rim); g.stroke();
            g.strokeStyle = '#ffff00'; g.beginPath(); g.moveTo(it.x, it.y - this.perfR(it)); g.lineTo(it.x, it.y + this.perfR(it)); g.stroke();
            if (it.done) dbgText(it.x + 8, it.y, `${it.pass ? 'PASS' : it.clip ? 'CLIP' : 'MISS'} off ${Math.round(it.off)}/${Math.round(it.open - S.R)}`, it.pass ? '#7cff7c' : '#ff8080');
          }
        },
      },
      // ---------------- Cliff Climb ----------------
      // The wing swings across the wall; its grab point (the white dot) must be over the hold.
      climb: {
        init() { S.hand = 0; S.sp = 2.3; S.lastEl = 0; S.height = 0; S.shown = 0; S.rowY = Math.round(H * 0.34); S.tol = pick({ normal: 4, risk: 1 }) * U; S.ds = 2 * U; this.next(0); },
        // the grab point, as a fraction of the width (extrapolated to the tap's exact time)
        handAt(el) { return 0.05 + 0.9 * (Math.sin(S.hand + Math.max(0, el - S.lastEl) * S.sp) + 1) / 2; },
        next(el) {
          const w = Math.max(0.09, (0.3 - el * 0.007) / SP), c = 0.1 + Math.random() * (0.8 - w);
          S.hold = { c, w, crystal: Math.random() < 0.18, drift: stage >= 1 ? (Math.random() < 0.5 ? -1 : 1) * 0.08 * SM[stage] : 0 };
          S.rock = null;
          if (stage === 2 && Math.random() < 0.6) { // a loose rock, never on top of the hold
            const rw = 0.1, left = c - 0.08 - rw, right = c + w + 0.08, opts2 = [];
            if (left >= 0.05) opts2.push(0.05 + Math.random() * (left - 0.05)); if (right + rw <= 0.95) opts2.push(right + Math.random() * (0.95 - rw - right));
            if (opts2.length) S.rock = { c: opts2[Math.floor(Math.random() * opts2.length)], w: rw };
          }
        },
        press(x, y, el) {
          if (S.stun > 0) return;
          const hand = this.handAt(el), h = S.hold, r = S.rock, tol = S.tol / W, hx = W * hand;
          if (r && hand >= r.c && hand <= r.c + r.w) { S.stun = 0.6; S.height = Math.max(0, S.height - 1); bad(hx, S.rowY, 'Loose rock!'); return; }
          if (hand >= h.c - tol && hand <= h.c + h.w + tol) {
            const mid = Math.abs(hand - (h.c + h.w / 2)) < h.w * 0.18;
            S.height += 1; good(hx, S.rowY - 34 * U, h.crystal ? 2 : 1, mid, h.crystal ? 'Crystal' : ''); this.next(el);
          } else { S.stun = 0.5; S.height = Math.max(0, S.height - 0.5); bad(hx, S.rowY, 'Slip!'); }
        },
        update(dt, el) {
          S.stun -= dt; S.sp = (2.3 + el * 0.06) * SP * SM[stage]; S.hand += dt * S.sp; S.lastEl = el;
          S.shown += (S.height - S.shown) * Math.min(1, dt * 8);
          const h = S.hold;
          if (h.drift) {
            h.c += h.drift * dt;
            const r = S.rock, hitsRock = r && h.c < r.c + r.w + 0.04 && h.c + h.w > r.c - 0.04;
            if (h.c < 0.05 || h.c + h.w > 0.95 || hitsRock) { h.c -= h.drift * dt; h.drift *= -1; }
          }
        },
        draw(el) {
          const wall = g.createLinearGradient(0, 0, W, 0); wall.addColorStop(0, '#7f746b'); wall.addColorStop(0.5, '#93877d'); wall.addColorStop(1, '#7a6f66'); g.fillStyle = wall; g.fillRect(0, 0, W, H);
          const off = (S.shown * 70 * U) % (140 * U);
          for (let r = -2; r < H / (70 * U) + 1; r++) for (let c = 0; c < 5; c++) { const bx = ((c * 97 + r * 41) % W), by = r * 70 * U + off; g.fillStyle = '#6f655d'; rrect(g, bx, by, 34 * U, 16 * U, 6 * U); g.fill(); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(bx + 4 * U, by + 2 * U, 24 * U, 3 * U); }
          const rowY = S.rowY, h = S.hold, x0 = W * h.c, w0 = W * h.w;
          // the hold (green ledge, or a blue crystal ledge); the light middle band is PERFECT
          g.fillStyle = 'rgba(0,0,0,.25)'; rrect(g, x0 + 2 * U, rowY - 14 * U, w0, 34 * U, 10 * U); g.fill();
          g.fillStyle = h.crystal ? '#5fc8f5' : '#2ecf8f'; rrect(g, x0, rowY - 17 * U, w0, 34 * U, 10 * U); g.fill();
          g.fillStyle = h.crystal ? '#8fe0ff' : '#5ff0b5'; rrect(g, x0 + 3 * U, rowY - 15 * U, w0 - 6 * U, 9 * U, 5 * U); g.fill();
          g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(x0 + w0 * 0.32, rowY - 17 * U, w0 * 0.36, 34 * U);
          g.strokeStyle = h.crystal ? '#1f6fb0' : '#167a52'; g.lineWidth = 2; rrect(g, x0, rowY - 17 * U, w0, 34 * U, 10 * U); g.stroke();
          if (h.crystal) ART.drawIcon(g, 'crystal', x0 + w0 / 2, rowY, 30 * U, el);
          if (S.rock) { // the loose rock: the red zone is exactly what you must not grab
            const rx = W * S.rock.c, rw = W * S.rock.w;
            g.fillStyle = 'rgba(224,90,79,.35)'; rrect(g, rx, rowY - 17 * U, rw, 34 * U, 8 * U); g.fill();
            ART.drawIcon(g, 'rock', rx + rw / 2, rowY + Math.sin(el * 30) * 0.8 * U, Math.max(26 * U, rw * 0.95), el);
            g.fillStyle = 'rgba(110,35,24,.6)'; for (let i = 0; i < 3; i++) { const fy = (el * 60 + i * 13) % 40; g.fillRect(rx + rw * (0.3 + i * 0.2), rowY + 18 * U + fy * U, 2 * U, 2 * U); }
          }
          // the duck below, its wing reaching up to the grab point
          const dx = W * 0.5, dy = rowY + 190 * U + (S.stun > 0 ? Math.sin(el * 40) * 4 : 0), hx = W * this.handAt(el), wing = (ART.PAL[duck.color] || ART.PAL.sunny)[1];
          g.strokeStyle = wing; g.lineWidth = 9 * U; g.lineCap = 'round'; g.beginPath(); g.moveTo(dx + 2 * U, dy - 24 * U); g.quadraticCurveTo(dx + (hx - dx) * 0.2, rowY + 90 * U, hx, rowY + 22 * U); g.stroke();
          g.fillStyle = wing; for (const a of [-0.5, 0, 0.5]) { g.save(); g.translate(hx, rowY + 18 * U); g.rotate(a); g.beginPath(); g.ellipse(0, -10 * U, 5 * U, 12 * U, 0, 0, TAU); g.fill(); g.restore(); }
          g.lineCap = 'butt';
          g.fillStyle = '#fff'; g.strokeStyle = '#1b1b2b'; g.lineWidth = 2; g.beginPath(); g.arc(hx, rowY, 6 * U, 0, TAU); g.fill(); g.stroke();
          if (S.stun > 0) ART.drawIcon(g, 'dizzy', hx, rowY - 26 * U, 34 * U, el);
          drawDuck(g, dx, dy, S.ds, duck.color, duck.hat, el, 'climb', false, duck.stage);
          g.fillStyle = '#fff'; g.font = `bold ${Math.round(20 * U)}px Fredoka, sans-serif`; g.textAlign = 'center'; g.fillText(`Height: ${Math.floor(S.height * 2)} m`, W / 2, H * 0.93); g.textAlign = 'left';
        },
        debug(el) {
          const h = S.hold, rowY = S.rowY;
          dbgRect({ l: W * h.c - S.tol, r: W * (h.c + h.w) + S.tol, t: rowY - 20 * U, b: rowY + 20 * U }, '#7cff7c');
          dbgRect({ l: W * (h.c + h.w / 2 - h.w * 0.18), r: W * (h.c + h.w / 2 + h.w * 0.18), t: rowY - 18 * U, b: rowY + 18 * U }, '#ffff00');
          if (S.rock) dbgRect({ l: W * S.rock.c, r: W * (S.rock.c + S.rock.w), t: rowY - 20 * U, b: rowY + 20 * U }, '#ff4040');
          const hx = W * this.handAt(el); g.strokeStyle = '#00e5ff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(hx, rowY - 30 * U); g.lineTo(hx, rowY + 30 * U); g.stroke();
        },
      },
      // ---------------- Lily Path (Smarts) ----------------
      // The rules are lilyPath() above. Pads sit in a grid over the pond; a tap counts on the
      // nearest pad within its drawn radius (+ a fingertip's slop per difficulty). The duck hops to
      // each pad you tap (a wrong one: splash!). ?dkdebug=1 shows the hit circles and the next pad.
      // Pads score without the combo multiplier: a good memory and quick taps already score fast here,
      // so Lily Path pays about what the other five games pay (it used to pay up to three times more).
      maze: {
        init() {
          const hk = {
            good: (i, perfect) => { const p = this.pad(i); this.hopTo(i); good(p.x, p.y - p.r * 0.9, 1, perfect, perfect ? 'QUICK' : '', true); },
            clear: (len) => { const p = this.pad(S.L.path[len - 1]); good(p.x, p.y - p.r * 1.8, len - 1, false, 'Path clear!', true); banner(len >= 6 ? `🧠 ${len} hops! Genius!` : `🐸 ${len} hops: next one is longer!`); S.party = 0.8; },
            bad: (i) => { const p = i >= 0 ? this.pad(i) : { x: S.tapX, y: S.tapY }; this.hopTo(i, true); bad(p.x, p.y - 30 * U, 'Splash! Watch again'); },
            turn: () => { banner('Your turn!'); BOX.sfx('tick'); },
            show: () => { S.duckHop = null; S.duck = -1; },
          };
          S.L = lilyPath(MODE, Math.random, hk);
          S.top = 118 * U; S.bank = H - 96 * U;
          const cw = W / S.L.cols, ch = (S.bank - S.top) / S.L.rows;
          S.cw = cw; S.ch = ch; S.pr = Math.min(cw, ch) * 0.36; S.slop = pick({ normal: 8, risk: 4 }) * U;
          S.duck = -1; S.duckHop = null; S.splash = 0; S.party = 0; S.ds = clamp(S.pr / 22, 1.2, 2.1);
          S.started = false;
        },
        // pad i: its centre and drawn radius (the pads bob a little from the second stage on)
        pad(i) { const c = i % S.L.cols, r = Math.floor(i / S.L.cols), x = (c + 0.5) * S.cw, y = S.top + (r + 0.5) * S.ch; return { x, y, r: S.pr }; },
        bankSpot() { return { x: W * 0.5, y: S.bank + 42 * U }; },
        hopTo(i, wet = false) { const from = S.duck >= 0 ? this.pad(S.duck) : this.bankSpot(), to = i >= 0 ? this.pad(i) : { x: S.tapX, y: S.tapY }; S.duckHop = { x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: 0, wet }; S.duck = wet ? -1 : i; if (wet) S.splash = 0.9; BOX.sfx(wet ? 'boo' : 'step'); },
        press(x, y, el) {
          if (S.L.phase === 'show') { if (!S.watchSaid || el - S.watchSaid > 1.5) { S.watchSaid = el; float(W / 2, S.top - 20 * U, 'Watch the frog!', '#ffffffcc', 18); } return; }
          let best = -1, bd = 1e9;
          for (let i = 0; i < S.L.n; i++) { const p = this.pad(i), d = Math.hypot(p.x - x, p.y - y); if (d < p.r * 1.15 + S.slop && d < bd) { bd = d; best = i; } }
          S.tapX = x; S.tapY = y;
          if (best < 0) { if (S.L.phase === 'input') quietMiss('tapped the water'); return; } // the water: nothing happens
          S.L.tap(best, el);
        },
        update(dt, el) {
          if (!S.started) { S.started = true; S.L.start(el + (first ? 0.9 : 0)); } // (a first-timer gets a moment after the tip)
          S.L.update(el, SP * SM[stage]);
          if (S.duckHop) { S.duckHop.t = Math.min(1, S.duckHop.t + dt / 0.24); if (S.duckHop.t >= 1 && !S.duckHop.wet) S.duckHop = null; }
          S.splash = Math.max(0, S.splash - dt); S.party = Math.max(0, S.party - dt);
        },
        drawPad(p, i, el, lit, num) {
          const bob = stage >= 1 ? Math.sin(el * 2 + i) * 1.5 * U : 0, x = p.x, y = p.y + bob, r = p.r;
          g.fillStyle = 'rgba(0,30,60,.22)'; g.beginPath(); g.ellipse(x + 3 * U, y + 5 * U, r, r * 0.8, 0, 0, TAU); g.fill();
          if (lit) { g.fillStyle = lit === 'gold' ? 'rgba(255,215,64,.55)' : 'rgba(140,255,140,.5)'; g.beginPath(); g.ellipse(x, y, r * 1.28, r * 1.05, 0, 0, TAU); g.fill(); }
          g.fillStyle = '#3f9e4a'; g.beginPath(); g.moveTo(x, y); g.ellipse(x, y, r, r * 0.8, 0, -1.25, 4.6); g.closePath(); g.fill();
          g.fillStyle = '#5fbf5a'; g.beginPath(); g.moveTo(x, y); g.ellipse(x, y - r * 0.06, r * 0.86, r * 0.66, 0, -1.25, 4.6); g.closePath(); g.fill();
          g.strokeStyle = 'rgba(30,90,40,.6)'; g.lineWidth = 1.5; for (const a of [0.2, 1.3, 2.4, 3.5]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.58); g.stroke(); }
          if ((i * 7) % 5 === 1) { g.fillStyle = '#ff9ccf'; for (let k = 0; k < 5; k++) { const a = k * 1.256 + 0.3; g.beginPath(); g.arc(x + r * 0.42 + Math.cos(a) * 5 * U, y - r * 0.2 + Math.sin(a) * 5 * U, 4 * U, 0, TAU); g.fill(); } g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(x + r * 0.42, y - r * 0.2, 3 * U, 0, TAU); g.fill(); }
          if (num) { g.font = `800 ${Math.round(r * 0.75)}px Fredoka, sans-serif`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(num, x, y + r * 0.26); g.fillStyle = lit === 'gold' ? '#ffe14d' : '#fff'; g.fillText(num, x, y + r * 0.26); g.textAlign = 'left'; }
        },
        drawFrog(x, y, s, el, air) {
          g.save(); g.translate(x, y); g.scale(s, s);
          g.fillStyle = 'rgba(0,30,60,.2)'; g.beginPath(); g.ellipse(0, 14 + air * 0.4, 16, 4, 0, 0, TAU); g.fill();
          g.translate(0, -air);
          g.fillStyle = '#3f9e3a'; // legs: tucked when sitting, stretched when hopping
          if (air > 2) { g.beginPath(); g.ellipse(-14, 12, 12, 4, 0.5, 0, TAU); g.ellipse(14, 12, 12, 4, -0.5, 0, TAU); g.fill(); }
          else { g.beginPath(); g.ellipse(-13, 8, 8, 6, 0, 0, TAU); g.ellipse(13, 8, 8, 6, 0, 0, TAU); g.fill(); }
          g.fillStyle = '#5ccf4a'; g.beginPath(); g.ellipse(0, 2, 16, 12, 0, 0, TAU); g.fill();
          g.fillStyle = '#c8f2a8'; g.beginPath(); g.ellipse(0, 7, 10, 6, 0, 0, TAU); g.fill();
          for (const ex of [-7, 7]) { g.fillStyle = '#5ccf4a'; g.beginPath(); g.arc(ex, -8, 6, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, -8, 4.2, 0, TAU); g.fill(); g.fillStyle = '#1b1b2b'; g.beginPath(); g.arc(ex + 0.8, -8, 2.2, 0, TAU); g.fill(); }
          g.strokeStyle = '#1f5a1a'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, 7, 0.3, Math.PI - 0.3); g.stroke();
          g.fillStyle = '#e63946'; g.beginPath(); g.moveTo(-6, -15); g.lineTo(6, -15); g.lineTo(4, -21); g.lineTo(-4, -21); g.fill(); // a tiny guide's cap
          g.restore();
        },
        draw(el) {
          const wg = g.createLinearGradient(0, 0, 0, H); wg.addColorStop(0, '#3b9ee0'); wg.addColorStop(1, '#2a78bf'); g.fillStyle = wg; g.fillRect(0, 0, W, H);
          g.fillStyle = 'rgba(255,255,255,.22)'; for (let i = 0; i < 16; i++) { const x = ((i * 97 + el * 12) % (W + 60)) - 30, y = (i * 71) % H; g.fillRect(x, y, 30 * U, 2.5 * U); }
          // the frog's rock (top) and the duck's bank (bottom)
          g.fillStyle = '#8a7f76'; g.beginPath(); g.ellipse(46 * U, S.top - 34 * U, 40 * U, 18 * U, 0, 0, TAU); g.fill(); g.fillStyle = '#a2978d'; g.beginPath(); g.ellipse(42 * U, S.top - 40 * U, 30 * U, 9 * U, 0, 0, TAU); g.fill();
          g.fillStyle = '#6cc26a'; g.fillRect(0, S.bank + 18 * U, W, H); g.fillStyle = '#5aa64f'; g.beginPath(); g.moveTo(0, S.bank + 22 * U); for (let x = 0; x <= W; x += 20) g.lineTo(x, S.bank + 14 * U + Math.sin(x * 0.07) * 5 * U); g.lineTo(W, S.bank + 30 * U); g.lineTo(0, S.bank + 30 * U); g.fill();
          g.strokeStyle = '#3d8b37'; g.lineWidth = 3; for (let i = 0; i < 8; i++) { const x = 14 * U + i * 9 * U; g.beginPath(); g.moveTo(x, S.bank + 24 * U); g.quadraticCurveTo(x + 4, S.bank - 6 * U, x + Math.sin(el + i) * 3, S.bank - 24 * U); g.stroke(); }
          const L = S.L;
          for (let i = 0; i < L.n; i++) {
            const shown = L.phase === 'show' ? L.lit.indexOf(i) : -1, done = L.phase !== 'show' ? L.lit.indexOf(i) : -1;
            this.drawPad(this.pad(i), i, el, shown >= 0 ? 'gold' : done >= 0 ? 'green' : null, shown >= 0 ? String(shown + 1) : done >= 0 ? String(done + 1) : '');
          }
          // the frog: on its rock, or hopping the path
          if (L.phase === 'show' && L.frog >= 0) {
            const to = this.pad(L.path[L.frog]), from = L.frog > 0 ? this.pad(L.path[L.frog - 1]) : { x: 46 * U, y: S.top - 40 * U }, u = L.frogU;
            this.drawFrog(from.x + (to.x - from.x) * u, from.y + (to.y - from.y) * u - 6 * U, 1.15 * U, el, Math.sin(u * Math.PI) * 34);
            if (u >= 1 && L.frog === L.lit.length - 1 && S.lastRibbit !== L.frog + ':' + L.path.join()) { S.lastRibbit = L.frog + ':' + L.path.join(); BOX.sfx('pop'); }
          } else this.drawFrog(46 * U, S.top - 46 * U, 1.15 * U, el, L.phase === 'clear' ? Math.abs(Math.sin(el * 10)) * 12 : 0);
          // the duck: on the bank, on its pad, hopping, or splashing
          const home = S.duck >= 0 ? this.pad(S.duck) : this.bankSpot();
          let dx = home.x, dy = home.y - 10 * U, air = 0, mode = 'stand';
          if (S.duckHop && S.duckHop.t < 1) { const h = S.duckHop, u = h.t; dx = h.x0 + (h.x1 - h.x0) * u; dy = h.y0 + (h.y1 - h.y0) * u - 10 * U; air = Math.sin(u * Math.PI) * 40 * U; mode = 'fly'; }
          else if (S.splash > 0) { const h = S.duckHop || { x1: S.tapX, y1: S.tapY }; dx = h.x1; dy = h.y1; mode = 'swim'; }
          if (S.splash > 0 && mode === 'swim') { g.strokeStyle = `rgba(255,255,255,${S.splash})`; g.lineWidth = 3; g.beginPath(); g.ellipse(dx, dy + 10 * U, (30 - S.splash * 14) * U, (9 - S.splash * 4) * U, 0, 0, TAU); g.stroke(); }
          drawDuck(g, dx, dy - air, S.ds, duck.color, duck.hat, el, mode, !!(mode === 'fly' && S.duckHop.x1 < S.duckHop.x0), duck.stage);
          if (S.splash > 0.4 && mode === 'swim') ART.drawIcon(g, 'dizzy', dx, dy - 34 * U, 28 * U, el);
          if (S.party > 0) for (let k = 0; k < 6; k++) { const a = el * 4 + k; ART.drawIcon(g, 'sparkle', dx + Math.cos(a) * 34 * U, dy - 30 * U + Math.sin(a) * 18 * U, 18 * U, el); }
          // what to do now
          g.font = `800 ${Math.round(20 * U)}px Fredoka, sans-serif`; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,30,60,.55)';
          const msg = L.phase === 'show' ? `🐸 Watch the frog… (${L.len} hops)` : L.phase === 'input' ? `Your turn: hop ${L.idx + 1} of ${L.len}` : L.phase === 'oops' ? 'Splash! Watch again' : '🎉 Path clear!';
          g.strokeText(msg, W / 2 + 24 * U, S.top - 30 * U); g.fillStyle = L.phase === 'input' ? '#ffe14d' : '#fff'; g.fillText(msg, W / 2 + 24 * U, S.top - 30 * U); g.textAlign = 'left';
        },
        debug(el) {
          for (let i = 0; i < S.L.n; i++) { const p = this.pad(i); dbgCirc(p.x, p.y, p.r * 1.15 + S.slop, '#7cff7c'); dbgCirc(p.x, p.y, p.r, '#ffff00'); }
          if (S.L.phase === 'input') { const p = this.pad(S.L.path[S.L.idx]); dbgCirc(p.x, p.y, p.r * 0.3, '#ff00ff'); }
          dbgText(8, 90, `${S.L.phase} len ${S.L.len} idx ${S.L.idx} path ${S.L.path.join(',')}`);
        },
      },
      // ---------------- Bug Snack ----------------
      // Each bug is drawn with body radius b.r. A tap counts on a bug within b.r·1.1 + slop (a
      // fingertip's worth); a bee only stings when the tap is right on it (b.r·0.85).
      bugs: {
        init() { S.cols = 3; S.rows = 4; S.top = 70; S.R = bugRules(MODE); S.slop = S.R.slop * U; },
        cell(i, j) { const cw = W / S.cols, ch = (H - S.top) / S.rows; return { x: i * cw + cw / 2, y: S.top + j * ch + ch / 2, cw, ch }; },
        press(x, y, el) {
          let best = null, bd = 1e9, bee = null;
          for (const b of S.items) {
            if (b.hit) continue; const d = Math.hypot(b.x - x, b.y - y);
            if (b.bee) { if (d < b.r * 0.85) bee = b; } else if (d < b.r * 1.1 + S.slop && d - b.r < bd) { bd = d - b.r; best = b; }
          }
          if (bee && !(best && bd <= 0)) best = bee; // right on a bee (and not right on a bug): ouch (normal: the combo only)
          if (!best) { if (combo) { float(x, y, 'miss', '#ffffffaa', 16); quietMiss('empty tap'); } return; } // empty taps only break the combo
          best.hit = true; best.ttl = 0.3;
          if (best.bee) bad(best.x, best.y, 'Ouch!', S.R.beeLose);
          else good(best.x, best.y - best.r, best.gold ? 3 : 1, best.age < best.life * S.R.perfect, best.gold ? 'Gold' : '');
        },
        update(dt, el) {
          S.spawn -= dt;
          if (S.spawn <= 0) {
            const R = S.R, n = stage === 2 && Math.random() < R.twin ? 2 : 1;
            for (let k = 0; k < n; k++) {
              const i = Math.floor(Math.random() * S.cols), j = Math.floor(Math.random() * S.rows);
              if (S.items.some((b) => b.i === i && b.j === j && !b.hit)) continue;
              const c = this.cell(i, j), r = Math.random(), life = Math.max(R.lifeMin, (R.life - el * 0.02) / (SP * SM[stage]));
              const gold = r < 0.08, bee = !gold && r < 0.08 + R.bee * SP * (stage === 2 ? 1.3 : 1);
              S.items.push({ i, j, x: c.x, y: c.y, r: Math.min(c.cw, c.ch) * 0.24, life: gold ? life * 0.6 : life, ttl: gold ? life * 0.6 : life, age: 0, gold, bee, kind: bee ? 'bee' : gold ? 'beetle' : ['caterpillar', 'cricket', 'ladybug'][(i + j) % 3], vx: stage >= R.moveFrom ? (Math.random() - 0.5) * c.cw * R.move : 0 });
            }
            S.spawn = Math.max(R.spawnMin, (R.spawn - el * 0.012) / (SP * SM[stage]));
          }
          for (const b of S.items) {
            b.ttl -= dt; b.age += dt;
            if (!b.hit) { b.x += b.vx * dt; if (b.x < b.r * 1.2 || b.x > W - b.r * 1.2) { b.vx *= -1; b.x = clamp(b.x, b.r * 1.2, W - b.r * 1.2); } }
            if (!b.hit && !b.bee && b.ttl <= 0) quietMiss('bug escaped');
          }
          S.items = S.items.filter((b) => b.ttl > 0);
        },
        draw(el) {
          g.fillStyle = '#7bc96f'; g.fillRect(0, 0, W, H);
          g.fillStyle = '#6fbd63'; for (let i = 0; i < 40; i++) { const x = (i * 97) % W, y = (i * 211) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3, y - 9); g.lineTo(x + 6, y); g.fill(); }
          for (let i = 0; i < S.cols; i++) for (let j = 0; j < S.rows; j++) { const c = this.cell(i, j); g.fillStyle = '#8a6a43'; g.beginPath(); g.ellipse(c.x, c.y + 22 * U, c.cw * 0.3, 12 * U, 0, 0, TAU); g.fill(); g.fillStyle = '#5c4426'; g.beginPath(); g.ellipse(c.x, c.y + 23 * U, c.cw * 0.22, 7 * U, 0, 0, TAU); g.fill(); }
          for (const b of S.items) {
            if (b.hit) { // squished / shooed: a quick puff
              const k = 1 - b.ttl / 0.3; g.globalAlpha = Math.max(0, 1 - k); g.fillStyle = b.bee ? '#ffe9a0' : '#fff';
              for (let q = 0; q < 6; q++) { const a = (q * TAU) / 6; g.beginPath(); g.arc(b.x + Math.cos(a) * b.r * (0.5 + k), b.y + Math.sin(a) * b.r * (0.5 + k), b.r * 0.25 * (1 - k * 0.5), 0, TAU); g.fill(); }
              g.globalAlpha = 1; continue;
            }
            const pop = Math.min(1, b.age * 8), leave = Math.min(1, b.ttl * 6), s = pop * leave;
            if (b.gold) { g.fillStyle = 'rgba(255,215,64,.35)'; g.beginPath(); g.arc(b.x, b.y, b.r * 1.5, 0, TAU); g.fill(); }
            if (!b.bee && b.age < b.life * S.R.perfect) { const k = b.age / (b.life * S.R.perfect); g.strokeStyle = `rgba(255,210,63,${0.9 - k * 0.5})`; g.lineWidth = 3; g.beginPath(); g.arc(b.x, b.y, b.r * (1.6 - k * 0.45), 0, TAU); g.stroke(); } // PERFECT while this ring shows
            ART.drawBug(g, b.kind, b.x, b.y, b.r * s, el + b.i);
            g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(b.x - b.r, b.y + b.r + 8 * U, b.r * 2, 4); g.fillStyle = b.bee ? '#ff8a8a' : '#fff'; g.fillRect(b.x - b.r, b.y + b.r + 8 * U, b.r * 2 * Math.max(0, b.ttl / b.life), 4);
          }
        },
        debug() { for (const b of S.items) if (!b.hit) { if (b.bee) dbgCirc(b.x, b.y, b.r * 0.85, '#ff4040'); else { dbgCirc(b.x, b.y, b.r, '#ffff00'); dbgCirc(b.x, b.y, b.r * 1.1 + S.slop, '#7cff7c'); } } },
      },
    };
    const G = GAMES[kind]; G.init();
    g.save(); G.draw(0); g.restore(); // the course is visible behind the countdown
    if (DEBUG) window.DUCK_MINI.dbg = { ov, S, G, kind, W, H, U, log, get holding() { return holding; }, get el() { return started ? (performance.now() - t0) / 1000 : 0; } };

    // ---- input ----
    const press = (e) => {
      e.preventDefault(); if (!started || over) return; holding = true;
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
      if (G.press) G.press.call(G, x, y, (performance.now() - t0) / 1000);
    };
    const release = () => { holding = false; };
    if (kind !== 'paddle') { cv.addEventListener('pointerdown', press); window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release); }
    else for (const b of ov.querySelectorAll('[data-pad]')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (started && !over) G.pad(b.dataset.pad, (performance.now() - t0) / 1000); });

    // ---- 3, 2, 1, GO! ----
    const ready = ov.querySelector('.dk-ready');
    let n = 3; BOX.sfx(GOAL ? 'drum' : 'tick'); const STEP = GOAL ? 900 : first ? 1000 : 520; // a Risk it! round: a slower, tense countdown
    // Stop at once (the race is starting): during the countdown the run is cancelled; once it is going,
    // it finishes right here with the score so far.
    let stopReason = null, beat = 0;
    current = { ov, active: () => !over, stop(reason) { if (over) return; if (!started) { over = true; clearInterval(countdown); close(); if (opts.cancel) opts.cancel(); return; } stopReason = reason || 'Training stopped.'; finish(); } };
    const countdown = setInterval(() => {
      n--;
      if (n > 0) { ready.textContent = n; BOX.sfx('tick'); if (GOAL) buzz(30); return; }
      clearInterval(countdown); ready.textContent = 'GO!'; BOX.sfx('start'); started = true; t0 = last = performance.now();
      setTimeout(() => ready.remove(), 400); requestAnimationFrame(frame);
      setTimeout(() => { const tp = ov.querySelector('.dk-tip'); if (tp) tp.classList.add('fade'); }, kind === 'maze' ? 1200 : GOAL ? 1600 : first ? 4000 : 2500); // Lily Path: the tip must not hide the frog
    }, STEP);

    function frame(now) {
      if (over) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const el = (now - t0) / 1000, left = Math.max(0, seconds - el);
      ov.querySelector('.tm').textContent = Math.ceil(left);
      // Risk it!: the last five seconds without the goal tick like a heartbeat
      if (GOAL && score < GOAL && left <= 5 && left > 0 && Math.ceil(left) !== beat) { beat = Math.ceil(left); BOX.sfx('tick'); buzz(25); ov.classList.remove('pulse'); void ov.offsetWidth; ov.classList.add('pulse'); }
      const st = stageOf(el); if (st !== stage) { stage = st; banner(stage === 1 ? '⚡ SPEED UP!' : '🔥 FINAL STRETCH!'); BOX.sfx('gavel'); }
      G.update(dt, el);
      g.save();
      if (fx.shake > 0) { g.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake); fx.shake = Math.max(0, fx.shake - dt * 40); }
      G.draw(el);
      if (DEBUG && G.debug) { g.save(); G.debug(el); g.restore(); }
      // sparkles and floating score text
      for (const p of fx.parts) { p.age += dt; p.vy += 300 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.globalAlpha = Math.max(0, 1 - p.age / 0.7); g.fillStyle = p.color; g.fillRect(p.x - 2, p.y - 2, 4, 4); }
      fx.parts = fx.parts.filter((p) => p.age < 0.7);
      g.textAlign = 'center';
      for (const f of fx.floats) { f.age += dt; g.globalAlpha = Math.max(0, 1 - f.age / 0.9); g.font = `800 ${f.size}px Fredoka, sans-serif`; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.45)'; g.strokeText(f.text, f.x, f.y - f.age * 50); g.fillStyle = f.color; g.fillText(f.text, f.x, f.y - f.age * 50); }
      fx.floats = fx.floats.filter((f) => f.age < 0.9);
      g.globalAlpha = 1; g.textAlign = 'left';
      g.restore();
      // the time bar
      g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, W, 5); g.fillStyle = left < 5 ? '#ff6a5c' : '#ffd23f'; g.fillRect(0, 0, W * (left / seconds), 5);
      if (left <= 0) return finish();
      requestAnimationFrame(frame);
    }
    function finish() {
      over = true; holding = false; window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release);
      const tip = ov.querySelector('.dk-tip'); if (tip) tip.remove();
      const card = document.createElement('div'); card.className = 'dk-result'; card.innerHTML = `${stopReason ? `<div class="dk-badge">${BOX.esc(stopReason)}</div>` : ''}<h2>${stopReason ? 'Stopped' : 'Time'}! Score: ${score}</h2><p class="muted">Saving…</p>`;
      ov.appendChild(card);
      const line = `<p class="dk-stats">✅ ${stats.ok} · ✨ ${stats.perfect} perfect · 🔗 best combo ${bestCombo}${stats.miss ? ` · 💥 ${stats.miss}` : ''}</p>`;
      done(score, (r) => {
        const SK = { run: 'Run', swim: 'Swim', fly: 'Fly', climb: 'Climb', stamina: 'Stamina', smarts: 'Smarts' };
        if (r && r.ok && r.risk && typeof r.risk === 'string') return riskCard(card, r, line, SK, close, duck, opts, stopReason);
        const cut = stopReason ? `<div class="dk-badge">${BOX.esc(stopReason)}</div><p class="muted">Training stopped for the race. Your points so far still count.</p>` : '';
        const napLine = r && r.nap ? `<p class="dk-napnote">😴 ${BOX.esc(duck.name || 'Your duck')} is worn out: nap time!</p>` : '';
        const pr = r && r.progress, bar = pr ? `<div class="dk-xpbar"><span>${SK[r.stat]} Lv ${pr.level}</span><div class="bar"><i style="width:${Math.round(((pr.have - pr.gained) / pr.need) * 100)}%"></i><i class="gain" style="width:${Math.round((pr.gained / pr.need) * 100)}%"></i></div><small>${pr.need - pr.have} XP to Lv ${pr.level + 1}</small></div>` : '';
        const offer = r && r.ok && r.risk && opts.riskIt ? r.risk : null;
        const again = opts.again && !stopReason && !(r && r.nap) && !offer ? '<button class="btn ghost dk-again">↻ Again</button>' : '';
        // Risk it?: one very hard round for double the XP, or keep what you have.
        const riskBox = offer ? `<div class="dk-riskoffer"><div class="dk-riskh">🎲 Risk it?</div><p>One <b>very hard</b> ${offer.seconds}-second round. Score <b class="goal">🎯 ${offer.goal}</b> to <b class="win">double it: +${offer.win} XP</b>. Miss and your duck falls: <b class="lose">−${offer.lose} XP</b>.</p><div class="dk-riskbtns"><button class="btn big dk-riskgo">🎲 Risk it!</button><button class="btn big ghost dk-keep">✅ Keep it</button></div><div class="dk-risktime"><i></i></div></div>` : r && r.riskNo ? `<p class="muted">${BOX.esc(r.riskNo)}</p>` : '';
        if (r && r.practice) card.innerHTML = `<div class="dk-badge good">🎮 PRACTICE</div><h2>Score ${score}</h2>${line}<p class="muted">In the game a run like this earns XP and coins for your duck.</p><div class="dk-resbtns"><button class="btn big">Done</button>${again}</div>`;
        else card.innerHTML = r && r.ok ? `${cut}${r.star ? '<div class="dk-badge good">⭐ TARGET HIT</div>' : ''}<h2>Score ${r.score}</h2>${line}<p class="dk-gain"><b>+${r.xp}</b> XP · <b>+${r.coins}</b> 🪙</p>${napLine}${r.newBest ? '<p class="lvup">🏅 New personal best!</p>' : ''}${r.streak > 1 ? `<p>🔥 Streak ×${r.streak} (+${Math.min(6, r.streak) * 5}% XP)</p>` : ''}${r.levelUp ? `<p class="lvup">LEVEL UP! ${SK[r.stat]} is now level ${r.levelUp} 🎉</p>` : ''}${bar}${offer ? riskBox : `${riskBox}<div class="dk-resbtns"><button class="btn big">Back to my farm</button>${again}</div>`}`
          : `<h2>Score ${score}</h2>${line}<p>${BOX.esc((r && r.error) || 'Not saved.')}</p><button class="btn big">Back</button>`;
        BOX.sfx(r && (r.levelUp || r.newBest) ? 'win' : 'chime');
        if (offer) {
          card.classList.add('offer');
          let gone = false; const t0o = performance.now(), ms = 30000, bar2 = card.querySelector('.dk-risktime i');
          const keep = () => { if (gone) return; gone = true; close(); if (opts.keep) opts.keep(); };
          card.querySelector('.dk-riskgo').onclick = () => { if (gone) return; gone = true; BOX.sfx('drum'); buzz(60); close(); opts.riskIt(); };
          card.querySelector('.dk-keep').onclick = keep;
          // the offer runs out (30 s): you keep it
          const tick = () => { if (gone || !document.body.contains(card)) return; const k = 1 - (performance.now() - t0o) / ms; if (bar2) bar2.style.width = Math.max(0, k * 100) + '%'; if (k <= 0) return keep(); requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        } else card.querySelector('button').onclick = close;
        const ag = card.querySelector('.dk-again'); if (ag) ag.onclick = () => { close(); opts.again(); };
        if (r && r.levelUp) buzz([30, 40, 60]);
      });
    }
    return ov;
  }
  window.DUCK_MINI = { play, debug: DEBUG, lilyPath, bugRules, scorer, active: () => !!(current && current.active()), stop: (reason) => { if (current) current.stop(reason); } };
})();
