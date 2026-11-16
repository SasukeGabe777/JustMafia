'use strict';
// JustRaiseDucks phone training mini-games (20 seconds each), drawn in a full-screen overlay
// outside the re-rendered page. Easy to pick up, hard to master:
//  - every clean action scores; mistakes only break your combo (no lost points, except bees)
//  - combos (×2 from 8, ×3 from 16) and PERFECT timing reward skilled players
//  - each run gets faster in three stages, with new things appearing as it goes
// Games: Hurdle Dash (Run), Paddle Power (Swim), Sky Rings (Fly), Cliff Climb (Climb), Bug Snack (Stamina).
(function () {
  const A = () => window.DUCK_ART;
  const TIPS = {
    hurdles: 'Tap to jump (tap again in the air to double-jump). Jump hurdles, grab corn 🌽, but stay low under birds!',
    paddle: 'Tap LEFT, RIGHT, LEFT, RIGHT… Strokes right on the beat ⭕ count double!',
    rings: 'Hold to fly up, let go to glide down. Fly through the middle of the rings for PERFECT. Dodge storm clouds!',
    climb: 'Tap when your hand is over the GREEN hold. Blue crystals are worth more. Never grab a red loose rock!',
    bugs: 'Tap bugs fast for PERFECT. Golden beetles are worth 3. Don’t tap the bees!',
  };
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* none */ } };
  const TAU = Math.PI * 2;

  function play(kind, seconds, duck, done, opts = {}) {
    const SP = opts.speed || 1, TARGET = opts.target || 0, DIFF = opts.diff || 'medium';
    const DL = { easy: '🌱 Easy', medium: '⚡ Medium', hard: '🔥 Hard' }[DIFF] || '';
    const ov = document.createElement('div'); ov.className = 'dk-over';
    ov.innerHTML = `<div class="dk-hud"><b class="sc">0</b><span class="mid">${DL}${TARGET ? ` · ⭐ ${TARGET}` : ''}${opts.best ? ` · best ${opts.best}` : ''}</span><span class="tm">${seconds}</span></div>
      <div class="dk-combo" hidden></div><div class="dk-banner" hidden></div>
      <canvas></canvas>${kind === 'paddle' ? '<div class="dk-pads"><button data-pad="L">LEFT</button><button data-pad="R">RIGHT</button></div>' : ''}
      <div class="dk-tip">${TIPS[kind]}</div><div class="dk-ready">3</div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector('canvas'), g = cv.getContext('2d');
    cv.width = ov.clientWidth; cv.height = ov.clientHeight - (kind === 'paddle' ? 130 : 0);
    const W = cv.width, H = cv.height, drawDuck = A().drawDuck, stageOf = (el) => (el < seconds / 3 ? 0 : el < (seconds * 2) / 3 ? 1 : 2);
    const SM = [1, 1.15, 1.32]; // speed per stage
    let score = 0, combo = 0, bestCombo = 0, t0 = 0, last = 0, over = false, holding = false, started = false, stage = 0;
    const stats = { ok: 0, perfect: 0, miss: 0 };
    const fx = { floats: [], parts: [], shake: 0 };
    const hud = () => {
      const el = ov.querySelector('.sc'); el.textContent = score;
      if (TARGET && score >= TARGET && !el.classList.contains('star')) { el.classList.add('star'); BOX.sfx('chime'); banner('⭐ Target hit!'); }
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
      score += pts; stats.ok++; if (perfect) stats.perfect++;
      float(x, y, `${label || (perfect ? 'PERFECT' : '')} +${pts}`.trim(), perfect ? '#ffd23f' : base > 1 ? '#7fe0ff' : '#ffffff', perfect ? 26 : 22);
      burst(x, y, perfect ? '#ffd23f' : '#ffffff', perfect ? 12 : 6);
      BOX.sfx(perfect ? 'chime' : 'pop');
      if (!noMult && (combo === 8 || combo === 16)) banner(`Combo ×${combo === 8 ? 2 : 3}!`);
      hud();
    }
    // A mistake: only the combo is lost (and a little shake).
    function bad(x, y, text = 'Oops!', lose = 0) {
      if (combo >= 5) float(x, y - 26, 'Combo lost', '#ffb3b3', 18);
      combo = 0; stats.miss++; score = Math.max(0, score - lose);
      float(x, y, lose ? `${text} −${lose}` : text, '#ff8a8a', 22); fx.shake = 10; BOX.sfx('boo'); buzz(60); hud();
    }
    const quietMiss = () => { combo = 0; hud(); };

    // ---- the five games ----
    const S = { items: [], spawn: 0.6, stun: 0, t: 0 };
    const GAMES = {
      hurdles: {
        init() { S.ground = H * 0.72; S.y = S.ground; S.vy = 0; S.jumps = 0; S.scroll = 0; },
        press() { if (S.jumps < 2) { S.vy = -H * (S.jumps ? 1.2 : 1.55); S.jumps++; BOX.sfx('pop'); } },
        update(dt, el) {
          const spd = W * 0.46 * SP * SM[stage] * (S.stun > 0 ? 0.45 : 1);
          S.vy += H * 4.2 * dt; S.y = Math.min(S.ground, S.y + S.vy * dt); if (S.y >= S.ground) { S.vy = 0; S.jumps = 0; }
          S.scroll += spd * dt; S.stun -= dt;
          S.spawn -= dt;
          if (S.spawn <= 0) {
            const r = Math.random(), birdRate = DIFF === 'easy' ? (stage === 2 ? 0.14 : 0) : stage >= 1 ? 0.22 : 0;
            if (r < birdRate) S.items.push({ k: 'bird', x: W + 30, y: S.ground - H * 0.2 });
            else if (r < 0.42) S.items.push({ k: 'corn', x: W + 30, y: S.ground - H * (0.16 + Math.random() * 0.12) });
            else S.items.push({ k: 'hurdle', x: W + 30, tall: stage === 2 && Math.random() < 0.35 });
            S.spawn = (0.8 + Math.random() * 0.55) / (SP * SM[stage]);
          }
          const dx = W * 0.25;
          for (const it of S.items) {
            it.x -= spd * dt * (it.k === 'bird' ? 1.35 : 1);
            const near = Math.abs(it.x - dx) < 22;
            if (it.k === 'hurdle') {
              const top = S.ground - (it.tall ? 52 : 34);
              if (near && !it.hit) { if (S.y > top + 6) { it.hit = true; S.stun = 0.6; bad(dx, S.ground - 60, 'Trip!'); } else it.clear = Math.min(it.clear == null ? 1e9 : it.clear, top - S.y); }
              if (!it.done && !it.hit && it.x < dx - 24) { it.done = true; good(dx, S.ground - 70, it.tall ? 2 : 1, it.clear < 30); }
            } else if (it.k === 'corn') {
              if (!it.done && near && Math.abs(S.y - 20 - it.y) < 30) { it.done = true; good(it.x, it.y, 1, false, '🌽'); }
            } else if (it.k === 'bird') {
              if (!it.done && Math.abs(it.x - dx) < 26 && Math.abs(S.y - 20 - it.y) < 28) { it.done = true; S.stun = 0.5; bad(dx, S.ground - 80, 'Bonk!'); }
              if (!it.done && it.x < dx - 30) { it.done = true; good(dx, S.ground - 70, 1, false, 'Dodge'); }
            }
          }
          S.items = S.items.filter((i) => i.x > -60 && !(i.k === 'corn' && i.done));
        },
        draw(el) {
          const gr = S.ground;
          const sky = g.createLinearGradient(0, 0, 0, gr); sky.addColorStop(0, '#7cc8ff'); sky.addColorStop(1, '#d8f1ff'); g.fillStyle = sky; g.fillRect(0, 0, W, gr);
          g.fillStyle = '#9fd39a'; g.beginPath(); g.moveTo(0, gr); for (let x = 0; x <= W; x += 16) g.lineTo(x, gr - 50 - Math.sin((x + S.scroll * 0.3) / 70) * 18); g.lineTo(W, gr); g.fill();
          g.fillStyle = '#6cc26a'; g.fillRect(0, gr + 18, W, H); g.fillStyle = '#d9a86c'; g.fillRect(0, gr + 12, W, 10);
          g.fillStyle = 'rgba(120,80,40,.35)'; for (let x = -((S.scroll) % 40); x < W; x += 40) g.fillRect(x, gr + 15, 16, 3);
          for (const it of S.items) {
            if (it.k === 'hurdle') { const h = it.tall ? 52 : 34; g.fillStyle = '#fff'; g.fillRect(it.x - 12, gr - h + 2, 5, h + 12); g.fillRect(it.x + 8, gr - h + 2, 5, h + 12); g.fillStyle = it.tall ? '#ff8c42' : '#e63946'; g.fillRect(it.x - 15, gr - h, 31, 8); }
            else if (it.k === 'corn') { g.font = '30px sans-serif'; g.textAlign = 'center'; g.fillText('🌽', it.x, it.y + Math.sin(el * 6 + it.x) * 4); g.textAlign = 'left'; }
            else if (it.k === 'bird') { g.font = '34px sans-serif'; g.textAlign = 'center'; g.save(); g.translate(it.x, it.y); g.scale(-1, 1); g.fillText('🐦', 0, 10 + Math.sin(el * 10) * 4); g.restore(); g.textAlign = 'left'; }
          }
          const air = S.y < S.ground - 2;
          drawDuck(g, W * 0.25, S.y - 4, 1.6, duck.color, duck.hat, el, S.stun > 0 ? 'stand' : air ? 'fly' : 'run', false, duck.stage);
        },
      },
      paddle: {
        init() { S.side = null; S.strokes = 0; S.x = 0; S.beatT = DIFF === 'easy' ? 0.5 : DIFF === 'hard' ? 0.36 : 0.42; S.win = DIFF === 'easy' ? 0.13 : DIFF === 'hard' ? 0.07 : 0.1; S.per = DIFF === 'easy' ? 4 : DIFF === 'hard' ? 6 : 5; S.drift = 0; S.lastStroke = 0; S.lastCount = -1; },
        pad(sd, el) {
          if (sd === S.side) { S.stun = 0.35; S.x -= 0.4; bad(W * 0.5, H * 0.4, 'Splash!'); S.side = sd; return; }
          S.side = sd; S.lastStroke = el;
          const beat = S.beatT / SM[stage], ph = (el % beat), off = Math.min(ph, beat - ph), bi = Math.round(el / beat), onBeat = off < S.win && bi !== S.lastBeat; // one on-beat stroke per beat
          if (onBeat) S.lastBeat = bi;
          if (!onBeat && el - S.lastCount < beat * 0.45) { S.x += 0.3; return; } // too fast: find the rhythm
          S.lastCount = el;
          S.strokes += onBeat ? 2 : 1; S.x += onBeat ? 1.6 : 1;
          if (onBeat) float(W * (sd === 'L' ? 0.3 : 0.7), H * 0.75, '♪', '#ffd23f', 26);
          BOX.sfx('step');
          while (S.strokes >= S.per) { S.strokes -= S.per; good(W * 0.5, H * 0.38, 1, false, onBeat ? '♪' : '', true); }
        },
        update(dt, el) {
          S.stun -= dt;
          // from stage 2 the river pushes back if you stop paddling
          if (stage >= 1 && el - S.lastStroke > 0.7) { S.x -= dt * 1.5; if (S.strokes > 0 && Math.random() < dt * 2) S.strokes = Math.max(0, S.strokes - 1); }
        },
        draw(el) {
          g.fillStyle = '#4fb3ff'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.35)';
          for (let i = 0; i < 14; i++) { const yy = (i * 61) % H, xx = ((i * 97 - S.x * 14) % (W + 80) + W + 80) % (W + 80) - 40; g.fillRect(xx, yy, 40, 3); }
          g.fillStyle = '#5fd3a0'; for (let i = 0; i < 6; i++) { const xx = ((i * 173 - S.x * 22) % (W + 120) + W + 120) % (W + 120) - 60; g.beginPath(); g.ellipse(xx, H * 0.15 + (i % 3) * 30, 22, 9, 0, 0, TAU); g.fill(); }
          if (stage >= 1) { g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; for (let i = 0; i < 5; i++) { const yy = H * 0.3 + i * 40, xx = W - ((el * 160 + i * 90) % (W + 100)); g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + 40, yy); g.stroke(); } }
          // the beat: a ring that closes in on the duck
          const beat = S.beatT / SM[stage], ph = (el % beat) / beat, cx = W * 0.5, cy = H * 0.55;
          g.strokeStyle = 'rgba(255,210,63,.9)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 40 + (1 - ph) * 70, 0, TAU); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, 40, 0, TAU); g.stroke();
          drawDuck(g, cx, cy, 2.2, duck.color, duck.hat, el * (1 + S.x * 0.02), 'swim', false, duck.stage);
          g.fillStyle = '#fff'; g.font = 'bold 18px Fredoka, sans-serif'; g.textAlign = 'center';
          g.fillText(S.stun > 0 ? 'Splash! Alternate!' : `Stroke on the beat ⭕ · ${S.per - S.strokes} more for +1`, W / 2, H * 0.9); g.textAlign = 'left';
        },
      },
      rings: {
        init() { S.y = H * 0.5; S.vy = 0; S.gust = 0; S.gustT = 4; },
        update(dt, el) {
          S.vy += (holding ? -H * 2.2 : H * 1.6) * dt; S.vy = Math.max(-H * 0.7, Math.min(H * 0.7, S.vy));
          if (stage >= 1) { S.gustT -= dt; if (S.gustT <= 0) { S.gust = (Math.random() < 0.5 ? -1 : 1) * H * 0.35; S.gustT = 3 + Math.random() * 2; banner(S.gust < 0 ? '💨 Updraft!' : '💨 Downdraft!'); } S.gust *= Math.pow(0.4, dt); }
          S.y = Math.max(24, Math.min(H - 24, S.y + (S.vy + S.gust) * dt));
          S.spawn -= dt;
          if (S.spawn <= 0) {
            const cloud = Math.random() < 0.22 * SP;
            S.items.push({ x: W + 30, y: H * (0.15 + Math.random() * 0.7), gold: !cloud && Math.random() < 0.15, cloud, wob: stage === 2 && !cloud && Math.random() < 0.6 ? Math.random() * TAU : null });
            S.spawn = (0.8 + Math.random() * 0.4) / (SP * SM[stage]);
          }
          const dx = W * 0.3;
          for (const it of S.items) {
            it.x -= W * 0.42 * SP * SM[stage] * dt;
            if (it.wob != null) it.y += Math.sin(el * 3 + it.wob) * 60 * dt;
            if (it.done || Math.abs(it.x - dx) > 12) continue;
            if (it.cloud) { if (Math.abs(it.y - S.y) < 30) { it.done = true; S.vy = H * 0.4; bad(dx, S.y - 30, 'Bonk!'); } }
            else if (Math.abs(it.y - S.y) < 28) { it.done = true; good(dx, S.y - 34, it.gold ? 2 : 1, Math.abs(it.y - S.y) < 10); }
          }
          for (const it of S.items) if (!it.done && !it.cloud && it.x < dx - 20) { it.done = true; it.missed = true; quietMiss(); }
          S.items = S.items.filter((i) => i.x > -50);
        },
        draw(el) {
          const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#9fdcff'); sky.addColorStop(1, '#e8f7ff'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
          g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 6; i++) { const x = ((i * 170 - el * 40) % (W + 120) + W + 120) % (W + 120) - 60; g.beginPath(); g.arc(x, 40 + i * 70 % H, 22, 0, TAU); g.arc(x + 24, 34 + i * 70 % H, 18, 0, TAU); g.fill(); }
          for (const it of S.items) {
            if (it.cloud) { g.fillStyle = '#6b7280'; for (const [dx, dy, r] of [[0, 0, 18], [16, -6, 14], [-16, -4, 13], [6, 8, 13]]) { g.beginPath(); g.arc(it.x + dx, it.y + dy, r, 0, TAU); g.fill(); } g.fillStyle = '#ffd23f'; g.font = '16px sans-serif'; g.fillText('⚡', it.x - 6, it.y + 22); }
            else if (!it.done || !it.missed) { g.globalAlpha = it.done ? 0.3 : 1; g.strokeStyle = it.gold ? '#ffcc00' : '#ff4f9a'; g.lineWidth = 6; g.beginPath(); g.ellipse(it.x, it.y, 12, 30, 0, 0, TAU); g.stroke(); g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(it.x, it.y, 3, 0, TAU); g.fill(); g.globalAlpha = 1; }
          }
          if (Math.abs(S.gust) > 20) { g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { const x = (i * 77 + el * 200) % W, y = (i * 113) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + (S.gust > 0 ? 24 : -24)); g.stroke(); } }
          drawDuck(g, W * 0.3, S.y, 1.5, duck.color, duck.hat, el, 'fly', false, duck.stage);
        },
      },
      climb: {
        init() { S.hand = 0; S.height = 0; this.next(0); },
        next(el) {
          const w = Math.max(0.09, (0.3 - el * 0.007) / SP), c = 0.12 + Math.random() * (0.76 - w);
          S.hold = { c, w, crystal: Math.random() < 0.18, drift: stage >= 1 ? (Math.random() < 0.5 ? -1 : 1) * 0.08 * SM[stage] : 0 };
          S.rock = stage === 2 && Math.random() < 0.6 ? { c: (c + 0.35 + Math.random() * 0.2) % 0.8 + 0.05, w: 0.1 } : null;
        },
        press(x, y, el) {
          if (S.stun > 0) return;
          const hand = (Math.sin(S.hand) + 1) / 2, h = S.hold, r = S.rock;
          if (r && hand >= r.c && hand <= r.c + r.w) { S.stun = 0.6; S.height = Math.max(0, S.height - 1); bad(W * hand, H * 0.32, 'Loose rock!'); return; }
          if (hand >= h.c && hand <= h.c + h.w) {
            const mid = Math.abs(hand - (h.c + h.w / 2)) < h.w * 0.18;
            S.height += 1; good(W * hand, H * 0.28, h.crystal ? 2 : 1, mid, h.crystal ? '💎' : ''); this.next(el);
          } else { S.stun = 0.5; S.height = Math.max(0, S.height - 0.5); bad(W * hand, H * 0.32, 'Slip!'); }
        },
        update(dt, el) {
          S.stun -= dt; S.hand += dt * (2.3 + el * 0.06) * SP * SM[stage];
          if (S.hold.drift) { S.hold.c += S.hold.drift * dt; if (S.hold.c < 0.05 || S.hold.c + S.hold.w > 0.95) S.hold.drift *= -1; }
        },
        draw(el) {
          g.fillStyle = '#8a7f76'; g.fillRect(0, 0, W, H);
          const off = (S.height * 70) % 140;
          g.fillStyle = '#7a7068'; for (let r = -1; r < H / 70 + 1; r++) for (let c = 0; c < 5; c++) g.fillRect(((c * 97 + r * 41) % W), r * 70 + off, 30, 14);
          const rowY = H * 0.32, h = S.hold;
          g.fillStyle = h.crystal ? '#7fe0ff' : '#2ee6a6'; g.fillRect(W * h.c, rowY - 16, W * h.w, 32);
          g.fillStyle = h.crystal ? '#2f8fe0' : '#1b6f55'; g.fillRect(W * h.c + 6, rowY - 7, W * h.w - 12, 14);
          g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(W * (h.c + h.w / 2) - 2, rowY - 16, 4, 32);
          if (S.rock) { g.fillStyle = '#e05a4f'; g.fillRect(W * S.rock.c, rowY - 14, W * S.rock.w, 28); g.fillStyle = '#7f2a22'; g.fillRect(W * S.rock.c + 4, rowY - 4, W * S.rock.w - 8, 8); }
          const hx = W * ((Math.sin(S.hand) + 1) / 2);
          g.font = '44px sans-serif'; g.textAlign = 'center'; g.fillText(S.stun > 0 ? '💥' : '✋', hx, rowY + 16); g.textAlign = 'left';
          drawDuck(g, W * 0.5, H * 0.7 + (S.stun > 0 ? Math.sin(el * 40) * 4 : 0), 2, duck.color, duck.hat, el, 'climb', false, duck.stage);
          g.fillStyle = '#fff'; g.font = 'bold 20px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText(`Height: ${Math.floor(S.height * 2)} m`, W / 2, H * 0.93); g.textAlign = 'left';
        },
      },
      bugs: {
        init() { S.cols = 3; S.rows = 4; },
        press(x, y, el) {
          let best = null, bd = 1e9;
          for (const b of S.items) if (!b.hit) { const d = Math.hypot(b.x - x, b.y - y); if (d < b.r * 1.6 && d < bd) { bd = d; best = b; } }
          if (!best) { if (combo) { float(x, y, 'miss', '#ffffffaa', 16); quietMiss(); } return; } // empty taps only break the combo
          best.hit = true; best.ttl = 0.3;
          if (best.bee) bad(best.x, best.y, 'Ouch!', 1);
          else good(best.x, best.y, best.gold ? 3 : 1, best.age < best.life * 0.4, best.gold ? '✨' : '');
        },
        update(dt, el) {
          const cw = W / S.cols, ch = H / S.rows;
          S.spawn -= dt;
          if (S.spawn <= 0) {
            const n = stage === 2 && Math.random() < 0.5 ? 2 : 1;
            for (let k = 0; k < n; k++) {
              const i = Math.floor(Math.random() * S.cols), j = Math.floor(Math.random() * S.rows);
              if (S.items.some((b) => b.i === i && b.j === j && !b.hit)) continue;
              const r = Math.random(), life = Math.max(0.5, (1.15 - el * 0.02) / (SP * SM[stage]));
              S.items.push({ i, j, x: i * cw + cw / 2, y: j * ch + ch / 2, r: Math.min(cw, ch) * 0.22, life: r < 0.08 ? life * 0.6 : life, ttl: r < 0.08 ? life * 0.6 : life, age: 0, gold: r < 0.08, bee: r >= 0.08 && r < 0.08 + 0.2 * SP * (stage === 2 ? 1.3 : 1), vx: stage >= 1 ? (Math.random() - 0.5) * cw * 0.8 : 0 });
            }
            S.spawn = Math.max(0.22, (0.62 - el * 0.012) / (SP * SM[stage]));
          }
          for (const b of S.items) { b.ttl -= dt; b.age += dt; if (!b.hit) b.x += b.vx * dt; if (!b.hit && !b.bee && b.ttl <= 0) quietMiss(); }
          S.items = S.items.filter((b) => b.ttl > 0);
        },
        draw() {
          g.fillStyle = '#7bc96f'; g.fillRect(0, 0, W, H);
          const cw = W / S.cols, ch = H / S.rows;
          g.fillStyle = '#5aa64f'; for (let i = 0; i < S.cols; i++) for (let j = 0; j < S.rows; j++) { g.beginPath(); g.ellipse(i * cw + cw / 2, j * ch + ch / 2 + 18, cw * 0.32, 14, 0, 0, TAU); g.fill(); }
          g.textAlign = 'center'; g.textBaseline = 'middle';
          for (const b of S.items) {
            if (b.hit) continue;
            const pop = Math.min(1, b.age * 8), s = b.r * 1.8 * pop;
            if (b.gold) { g.fillStyle = 'rgba(255,215,64,.35)'; g.beginPath(); g.arc(b.x, b.y, b.r * 1.5, 0, TAU); g.fill(); }
            g.font = `${s}px sans-serif`; g.fillText(b.bee ? '🐝' : b.gold ? '🪲' : ['🐛', '🦗', '🐞'][(b.i + b.j) % 3], b.x, b.y);
            g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(b.x - b.r, b.y + b.r + 6, b.r * 2, 4); g.fillStyle = b.bee ? '#ff8a8a' : '#fff'; g.fillRect(b.x - b.r, b.y + b.r + 6, b.r * 2 * Math.max(0, b.ttl / b.life), 4);
          }
          g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        },
      },
    };
    const G = GAMES[kind]; G.init();

    // ---- input ----
    const press = (e) => {
      e.preventDefault(); if (!started || over) return; holding = true;
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
      if (G.press) G.press.call(G, x, y, (performance.now() - t0) / 1000);
    };
    const release = () => { holding = false; };
    if (kind !== 'paddle') { cv.addEventListener('pointerdown', press); window.addEventListener('pointerup', release); }
    else for (const b of ov.querySelectorAll('[data-pad]')) b.addEventListener('pointerdown', (e) => { e.preventDefault(); if (started && !over) G.pad(b.dataset.pad, (performance.now() - t0) / 1000); });

    // ---- 3, 2, 1, GO! ----
    const ready = ov.querySelector('.dk-ready');
    let n = 3; BOX.sfx('tick');
    const countdown = setInterval(() => {
      n--;
      if (n > 0) { ready.textContent = n; BOX.sfx('tick'); return; }
      clearInterval(countdown); ready.textContent = 'GO!'; BOX.sfx('start'); started = true; t0 = last = performance.now();
      setTimeout(() => ready.remove(), 450); requestAnimationFrame(frame);
    }, 450);

    function frame(now) {
      if (over) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const el = (now - t0) / 1000, left = Math.max(0, seconds - el);
      ov.querySelector('.tm').textContent = Math.ceil(left);
      const st = stageOf(el); if (st !== stage) { stage = st; banner(stage === 1 ? '⚡ SPEED UP!' : '🔥 FINAL STRETCH!'); BOX.sfx('gavel'); }
      G.update(dt, el);
      g.save();
      if (fx.shake > 0) { g.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake); fx.shake = Math.max(0, fx.shake - dt * 40); }
      G.draw(el);
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
      over = true; window.removeEventListener('pointerup', release);
      const tip = ov.querySelector('.dk-tip'); if (tip) tip.remove();
      const card = document.createElement('div'); card.className = 'dk-result'; card.innerHTML = `<h2>Time! Score: ${score}</h2><p class="muted">Saving…</p>`;
      ov.appendChild(card);
      const line = `<p class="dk-stats">✅ ${stats.ok} · ✨ ${stats.perfect} perfect · 🔗 best combo ${bestCombo}${stats.miss ? ` · 💥 ${stats.miss}` : ''}</p>`;
      done(score, (r) => {
        const SK = { run: 'Run', swim: 'Swim', fly: 'Fly', climb: 'Climb', stamina: 'Stamina' };
        card.innerHTML = r && r.ok ? `${r.wipeout ? '<div class="dk-badge bad">💥 WIPEOUT</div>' : r.star ? '<div class="dk-badge good">⭐ TARGET HIT</div>' : ''}<h2>Score ${r.score}</h2>${line}<p class="dk-gain"><b>+${r.xp}</b> XP · <b>+${r.coins}</b> 🪙</p>${r.newBest ? '<p class="lvup">🏅 New personal best!</p>' : ''}${r.streak > 1 ? `<p>🔥 Streak ×${r.streak} (+${Math.min(6, r.streak) * 5}% XP)</p>` : ''}${r.levelUp ? `<p class="lvup">LEVEL UP! ${SK[r.stat]} is now level ${r.levelUp} 🎉</p>` : ''}<button class="btn big">Back to my farm</button>`
          : `<h2>Score ${score}</h2>${line}<p>${BOX.esc((r && r.error) || 'Not saved.')}</p><button class="btn big">Back</button>`;
        BOX.sfx(r && r.wipeout ? 'boo' : r && (r.levelUp || r.newBest) ? 'win' : 'chime');
        card.querySelector('button').onclick = () => ov.remove();
      });
    }
    return ov;
  }
  window.DUCK_MINI = { play };
})();
