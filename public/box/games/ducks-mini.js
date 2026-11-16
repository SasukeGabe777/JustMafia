'use strict';
// JustRaiseDucks phone training mini-games (20 seconds each), shown in a full-screen overlay
// outside the re-rendered page: Hurdle Dash (Run), Paddle Power (Swim), Sky Rings (Fly),
// Cliff Climb (Climb) and Bug Snack (Stamina).
(function () {
  const A = () => window.DUCK_ART;
  const TIPS = {
    hurdles: 'Tap to jump the hurdles. Don’t trip!',
    paddle: 'Tap LEFT, RIGHT, LEFT, RIGHT… as fast as you can.',
    rings: 'Hold to fly up, let go to glide down. Fly through the rings (gold = 2). Dodge the storm clouds.',
    climb: 'Tap when the hand is over a GREEN hold to grab it. Miss and you slip!',
    bugs: 'Tap the bugs before they hide. Not the bees!',
  };
  const buzz = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* none */ } };

  function play(kind, seconds, duck, done) {
    const ov = document.createElement('div'); ov.className = 'dk-over';
    ov.innerHTML = `<div class="dk-hud"><b class="sc">0</b><span class="tm">${seconds}</span></div><canvas></canvas>${kind === 'paddle' ? '<div class="dk-pads"><button data-pad="L">LEFT</button><button data-pad="R">RIGHT</button></div>' : ''}<div class="dk-tip">${TIPS[kind]}</div><div class="dk-ready">Ready…</div>`;
    document.body.appendChild(ov);
    const cv = ov.querySelector('canvas'), g = cv.getContext('2d');
    cv.width = ov.clientWidth; cv.height = ov.clientHeight - (kind === 'paddle' ? 130 : 0);
    const W = cv.width, H = cv.height;
    const drawDuck = A().drawDuck;
    let score = 0, t0 = 0, last = 0, over = false, holding = false, started = false;
    const S = { y: H * 0.6, vy: 0, items: [], spawn: 0, stun: 0, x: 0, side: null, strokes: 0, height: 0, hand: 0, holds: [] };
    const add = (n) => { score = Math.max(0, score + n); ov.querySelector('.sc').textContent = score; };
    // A 1.5 s "Ready… GO!" so the clock doesn't start before you're looking.
    setTimeout(() => { const r = ov.querySelector('.dk-ready'); r.textContent = 'GO!'; started = true; t0 = last = performance.now(); setTimeout(() => r.remove(), 500); requestAnimationFrame(frame); }, 1300);

    const press = (e) => {
      e.preventDefault(); if (!started || over) return; holding = true;
      if (kind === 'hurdles' && S.y >= H * 0.7 - 1) { S.vy = -H * 1.55; BOX.sfx('pop'); }
      if (kind === 'bugs') tapBug(e);
      if (kind === 'climb') grab();
    };
    const release = () => { holding = false; };
    if (kind !== 'paddle') { cv.addEventListener('pointerdown', press); window.addEventListener('pointerup', release); }
    else for (const b of ov.querySelectorAll('[data-pad]')) b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (!started || over) return;
      const sd = b.dataset.pad;
      if (sd !== S.side) { S.strokes++; S.x += 1; if (S.strokes % 4 === 0) add(1); BOX.sfx('step'); } else { S.x -= 0.3; S.stun = 0.35; buzz(30); }
      S.side = sd;
    });
    function tapBug(e) {
      const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width), y = (e.clientY - r.top) * (H / r.height);
      for (const b of S.items) if (!b.hit && Math.hypot(b.x - x, b.y - y) < b.r * 1.5) { b.hit = true; b.ttl = 0.3; if (b.bee) { add(-2); BOX.sfx('boo'); buzz(80); } else { add(1); BOX.sfx('pop'); } return; }
    }
    // Climb: a hand swings left-right; holds sit at random spots on the next row.
    function nextHold(el) { const w = Math.max(0.12, 0.3 - el * 0.008); S.holds = [{ c: 0.15 + Math.random() * (0.7 - w), w }]; }
    function grab() {
      if (S.stun > 0) return;
      const h = S.holds[0], hand = (Math.sin(S.hand) + 1) / 2;
      if (h && hand >= h.c && hand <= h.c + h.w) { add(1); S.height += 1; BOX.sfx('pop'); nextHold((performance.now() - t0) / 1000); }
      else { S.stun = 0.6; S.height = Math.max(0, S.height - 0.5); BOX.sfx('boo'); buzz(60); }
    }
    nextHold(0);

    function frame(now) {
      if (over) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const el = (now - t0) / 1000, left = Math.max(0, seconds - el);
      ov.querySelector('.tm').textContent = Math.ceil(left);
      g.clearRect(0, 0, W, H);
      if (kind === 'hurdles') {
        const ground = H * 0.7, speed = W * (0.45 + el * 0.02);
        g.fillStyle = '#9fdcff'; g.fillRect(0, 0, W, ground); g.fillStyle = '#6cc26a'; g.fillRect(0, ground + 18, W, H); g.fillStyle = '#d9a86c'; g.fillRect(0, ground + 14, W, 8);
        S.vy += H * 4.2 * dt; S.y = Math.min(ground, S.y + S.vy * dt); if (S.y >= ground) S.vy = 0;
        S.spawn -= dt; if (S.spawn <= 0) { S.items.push({ x: W + 20 }); S.spawn = 0.85 + Math.random() * 0.6; }
        for (const it of S.items) {
          it.x -= speed * dt * (S.stun > 0 ? 0.4 : 1);
          g.fillStyle = '#fff'; g.fillRect(it.x, ground - 22, 6, 36); g.fillRect(it.x + 18, ground - 22, 6, 36); g.fillStyle = '#e63946'; g.fillRect(it.x - 2, ground - 24, 30, 7);
          if (!it.passed && !it.hit && it.x < W * 0.25 + 14 && it.x + 24 > W * 0.25 - 14 && S.y > ground - 26) { it.hit = true; S.stun = 0.7; BOX.sfx('boo'); buzz(60); }
          if (!it.passed && !it.hit && it.x + 24 < W * 0.25 - 14) { it.passed = true; add(1); }
        }
        S.items = S.items.filter((i) => i.x > -40); S.stun -= dt;
        drawDuck(g, W * 0.25, S.y - 4, 1.6, duck.color, duck.hat, el, S.stun > 0 ? 'stand' : 'run');
      } else if (kind === 'paddle') {
        g.fillStyle = '#4fb3ff'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,.35)';
        for (let i = 0; i < 12; i++) { const yy = (i * 61) % H, xx = ((i * 97 - S.x * 14) % (W + 80) + W + 80) % (W + 80) - 40; g.fillRect(xx, yy, 40, 3); }
        g.fillStyle = '#5fd3a0'; for (let i = 0; i < 6; i++) { const xx = ((i * 173 - S.x * 22) % (W + 120) + W + 120) % (W + 120) - 60; g.beginPath(); g.ellipse(xx, H * 0.15 + (i % 3) * 30, 22, 9, 0, 0, Math.PI * 2); g.fill(); }
        S.stun -= dt;
        drawDuck(g, W * 0.45, H * 0.55, 2.2, duck.color, duck.hat, el * (1 + S.strokes * 0.05), 'swim');
        g.fillStyle = '#fff'; g.font = 'bold 20px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText(S.stun > 0 ? 'Splash! Alternate!' : `Strokes: ${S.strokes}`, W / 2, H * 0.85); g.textAlign = 'left';
      } else if (kind === 'rings') {
        g.fillStyle = '#bfe6ff'; g.fillRect(0, 0, W, H);
        S.vy += (holding ? -H * 2.2 : H * 1.6) * dt; S.vy = Math.max(-H * 0.7, Math.min(H * 0.7, S.vy)); S.y = Math.max(20, Math.min(H - 20, S.y + S.vy * dt));
        S.spawn -= dt; if (S.spawn <= 0) { const cloud = Math.random() < 0.25; S.items.push({ x: W + 30, y: H * (0.15 + Math.random() * 0.7), gold: !cloud && Math.random() < 0.18, cloud }); S.spawn = 0.75 + Math.random() * 0.4; }
        for (const it of S.items) {
          it.x -= W * 0.42 * dt;
          if (it.cloud) { g.fillStyle = '#6b7280'; for (const [dx, dy, r] of [[0, 0, 18], [16, -6, 14], [-16, -4, 13], [6, 8, 13]]) { g.beginPath(); g.arc(it.x + dx, it.y + dy, r, 0, Math.PI * 2); g.fill(); } }
          else { g.strokeStyle = it.gold ? '#ffcc00' : '#ff4f9a'; g.lineWidth = 6; g.beginPath(); g.ellipse(it.x, it.y, 12, 30, 0, 0, Math.PI * 2); g.stroke(); }
          if (!it.done && Math.abs(it.x - W * 0.3) < 14) {
            if (it.cloud) { if (Math.abs(it.y - S.y) < 28) { it.done = true; S.vy = H * 0.4; BOX.sfx('boo'); buzz(50); } }
            else if (Math.abs(it.y - S.y) < 26) { it.done = true; add(it.gold ? 2 : 1); BOX.sfx('pop'); }
          }
        }
        S.items = S.items.filter((i) => i.x > -50);
        drawDuck(g, W * 0.3, S.y, 1.5, duck.color, duck.hat, el, 'fly');
      } else if (kind === 'climb') {
        // Rock wall scrolling down as the duck climbs.
        g.fillStyle = '#8a7f76'; g.fillRect(0, 0, W, H);
        const off = (S.height * 70) % 140;
        g.fillStyle = '#7a7068'; for (let r = -1; r < H / 70 + 1; r++) for (let c = 0; c < 5; c++) g.fillRect(((c * 97 + r * 41) % W), r * 70 + off, 30, 14);
        S.stun -= dt; S.hand += dt * (2.4 + el * 0.08);
        const rowY = H * 0.32, h = S.holds[0];
        g.fillStyle = '#2ee6a6'; g.fillRect(W * h.c, rowY - 14, W * h.w, 28);
        g.fillStyle = '#1b6f55'; g.fillRect(W * h.c + 6, rowY - 6, W * h.w - 12, 12);
        const hx = W * ((Math.sin(S.hand) + 1) / 2);
        g.font = '42px sans-serif'; g.textAlign = 'center'; g.fillText(S.stun > 0 ? '💥' : '✋', hx, rowY + 14); g.textAlign = 'left';
        drawDuck(g, W * 0.5, H * 0.7 + (S.stun > 0 ? Math.sin(el * 40) * 4 : 0), 2, duck.color, duck.hat, el, 'climb');
        g.fillStyle = '#fff'; g.font = 'bold 20px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText(`Height: ${Math.floor(S.height * 2)} m`, W / 2, H * 0.92); g.textAlign = 'left';
      } else if (kind === 'bugs') {
        g.fillStyle = '#7bc96f'; g.fillRect(0, 0, W, H);
        const cols = 3, rows = 4, cw = W / cols, ch = H / rows;
        g.fillStyle = '#5aa64f'; for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { g.beginPath(); g.ellipse(i * cw + cw / 2, j * ch + ch / 2 + 18, cw * 0.32, 14, 0, 0, Math.PI * 2); g.fill(); }
        S.spawn -= dt; if (S.spawn <= 0) { const i = Math.floor(Math.random() * cols), j = Math.floor(Math.random() * rows); if (!S.items.some((b) => b.i === i && b.j === j)) S.items.push({ i, j, x: i * cw + cw / 2, y: j * ch + ch / 2, r: Math.min(cw, ch) * 0.22, ttl: Math.max(0.55, 1.1 - el * 0.025), bee: Math.random() < 0.22 }); S.spawn = Math.max(0.28, 0.6 - el * 0.012); }
        for (const b of S.items) {
          b.ttl -= dt;
          g.textAlign = 'center'; g.textBaseline = 'middle';
          if (b.hit) { g.fillStyle = 'rgba(255,255,255,.8)'; g.font = `bold ${b.r}px sans-serif`; g.fillText(b.bee ? '−2' : '+1', b.x, b.y); }
          else { g.font = `${b.r * 1.8}px sans-serif`; g.fillText(b.bee ? '🐝' : ['🐛', '🪲', '🦗'][(b.i + b.j) % 3], b.x, b.y); }
          g.textAlign = 'left'; g.textBaseline = 'alphabetic';
        }
        S.items = S.items.filter((b) => b.ttl > 0);
      }
      if (left <= 0) return finish();
      requestAnimationFrame(frame);
    }
    function finish() {
      over = true; window.removeEventListener('pointerup', release);
      const tip = ov.querySelector('.dk-tip'); if (tip) tip.remove();
      const card = document.createElement('div'); card.className = 'dk-result'; card.innerHTML = `<h2>Time! Score: ${score}</h2><p class="muted">Saving…</p>`;
      ov.appendChild(card);
      done(score, (r) => {
        const SK = { run: 'Run', swim: 'Swim', fly: 'Fly', climb: 'Climb', stamina: 'Stamina' };
        card.innerHTML = r && r.ok ? `<h2>Score ${r.score}</h2><p>+${r.xp} XP · +${r.coins} 🪙</p>${r.levelUp ? `<p class="lvup">LEVEL UP! ${SK[r.stat]} is now level ${r.levelUp} 🎉</p>` : ''}<button class="btn big">Back to my farm</button>` : `<h2>Score ${score}</h2><p>${BOX.esc((r && r.error) || 'Not saved.')}</p><button class="btn big">Back</button>`;
        BOX.sfx(r && r.levelUp ? 'win' : 'chime');
        card.querySelector('button').onclick = () => ov.remove();
      });
    }
    return ov;
  }
  window.DUCK_MINI = { play };
})();
