// DLC 1, part 2 on the phone: the Mathematician's problem, the Gamer's arcade (Night Flight, an
// original tap-to-fly game), the Zombie horde's picks, the bitten player's fever and the Priest.
// The server decides everything; this file only shows choices and sends them.
(function () {
  const drafts = { a: '', b: '', answer: '', target: '' };
  let flight = null; // the running Night Flight game (lives outside the re-rendered page)
  // What a Night Flight score earns (the server checks the same numbers).
  const REWARDS = [
    { need: 5, icon: '🛡', name: 'Shield', text: 'protect one player (or yourself) from one attack tonight' },
    { need: 12, icon: '🔍', name: 'Scan', text: 'learn whether one player is Mafia' },
    { need: 25, icon: '🏆', name: 'High Score', text: 'learn one player’s exact role' },
  ];
  const rewardTable = (esc, score) => `<table class="gamer-rewards"><tr><th>Score</th><th>Reward</th></tr>${REWARDS.map((r) => `<tr class="${score != null && score >= r.need ? 'won' : ''}"><td>${r.need}+</td><td>${r.icon} <b>${esc(r.name)}</b>: ${esc(r.text)}</td></tr>`).join('')}<tr class="${score != null && score < 5 ? 'won' : ''}"><td>0–4</td><td>No power tonight</td></tr></table><p class="small muted">Higher scores keep the lower rewards too: pick any one you reached.</p>`;

  window.MT_DLC2_UI = function (v, socket, body, { esc, reply }) {
    if (!v || v.isJudge || !v.you || v.you.spectator || v.phase === 'lobby') return;
    const emit = (data, cb) => socket.emit('player:dlc2', data, (r) => { reply(r); if (cb) cb(r); });
    const card = (cls, html) => { const el = document.createElement('section'); el.className = 'card dlc2 ' + cls; el.innerHTML = html; body.appendChild(el); return el; };
    const options = (list, sel, blank) => `<option value="">${blank}</option>` + list.map((p) => `<option value="${esc(p.id)}" ${sel === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    const nameOf = (id, list) => ((list || []).find((p) => p.id === id) || {}).name || '?';

    // Bitten: the fever banner.
    if (v.infected) card('fever', `<h3>🤒 You were bitten</h3><p>You feel feverish. Unless the <b>Priest</b> blesses you tonight, you will <b>turn into a Zombie</b> when this coming night ends. Tell the town… or don’t.</p>`);

    // The Mathematician.
    const m = v.math;
    if (m) {
      if (m.solved) card('math', `<h3>🧮 Proof submitted</h3><p>${m.pair ? `${esc(nameOf(m.pair[0], m.players))} and ${esc(nameOf(m.pair[1], m.players))}: ` : ''}your answer was right. At dawn you’ll learn how many of them are a threat (0, 1 or 2).</p>`);
      else if (!m.problem) card('math', `<h3>🧮 No proof tonight</h3><p>Both tries are used up${m.last ? ` (your last answer to <b>${esc(m.last.q)}</b> was ${esc(m.last.wrong)})` : ''}. The numbers tell you nothing tonight.</p>`);
      else {
        const el = card('math', `<h3>🧮 Tonight’s problem <small>level ${m.level} · ${m.tries} ${m.tries === 1 ? 'try' : 'tries'} left</small></h3>
          <p class="small muted">Pick two players. Solve it, and at dawn you learn how many of the two are a threat to the Town.</p>
          <div class="math-pair"><select data-math="a">${options(m.players, drafts.a, 'First player…')}</select><select data-math="b">${options(m.players, drafts.b, 'Second player…')}</select></div>
          <div class="math-q">${esc(m.problem)} = ?</div>
          ${m.last ? `<p class="small bad">Wrong: ${esc(m.last.q)} isn’t ${esc(m.last.wrong)}. Here’s a new one.</p>` : ''}
          <div class="math-answer"><input inputmode="numeric" pattern="-?[0-9]*" placeholder="Answer" data-draft="math-answer" value="${esc(drafts.answer)}" maxlength="8"><button class="btn" data-math-go>Submit proof</button></div>`);
        el.querySelectorAll('[data-math]').forEach((s) => { s.onchange = () => { drafts[s.dataset.math] = s.value; }; });
        const input = el.querySelector('[data-draft="math-answer"]');
        input.oninput = () => { drafts.answer = input.value; };
        const go = () => {
          if (!drafts.a || !drafts.b || drafts.a === drafts.b) return reply({ ok: false, error: 'Pick two different players first.' });
          emit({ op: 'solve', a: drafts.a, b: drafts.b, answer: drafts.answer }, (r) => { if (r && r.ok) drafts.answer = ''; if (r && r.ok && !r.correct && navigator.vibrate) navigator.vibrate(80); }); // a wrong answer shows on the card (no pop-up)
        };
        el.querySelector('[data-math-go]').onclick = go;
        input.onkeydown = (e) => { if (e.key === 'Enter') go(); };
      }
    }

    // The Gamer.
    const g = v.gamer;
    if (g) {
      if (!g.played) {
        const el = card('gamer', `<h3>🎮 Night Flight</h3><p class="small">Tap to flap. Fly your lantern-bat through the chimney gaps: every gap is a point. <b>One run per night.</b></p>${rewardTable(esc, null)}<button class="btn btn-big" data-flight>${g.running ? '▶ Back to your run' : '▶ Play tonight’s run'}</button>`);
        el.querySelector('[data-flight]').onclick = () => {
          if (flight) return flight.show();
          if (g.running) return reply({ ok: false, error: 'Your run already started.' });
          emit({ op: 'start' }, (r) => { if (r && r.ok) startFlight((score) => emit({ op: 'score', score })); });
        };
      } else {
        const open = g.powers.filter((p) => p.open);
        const el = card('gamer', `<h3>🎮 Score: ${g.score}</h3>
          ${open.length ? `${g.power ? `<p>Power set: <b>${esc((g.powers.find((p) => p.id === g.power) || {}).label || g.power)}</b> on <b>${esc(nameOf(g.target, g.players.concat([g.self])))}</b>. You can change it until dawn.</p>` : '<p class="small">Pick a power and a player.</p>'}
            <div class="gamer-powers">${g.powers.map((p) => `<button class="btn small ${p.open ? '' : 'ghost'}" data-power="${p.id}" ${p.open ? '' : 'disabled'}>${p.open ? '' : '🔒 '}${esc(p.label)} <small>(${p.need}+)</small></button>`).join('')}</div>
            <select data-gamer-target>${options(g.players.concat([g.self]), drafts.target || g.target, 'Pick a player…')}</select>`
            : '<p>Game over before 5. No power tonight. Better luck tomorrow!</p>'}
          <details><summary class="small">Score rewards</summary>${rewardTable(esc, g.score)}</details>`);
        const sel = el.querySelector('[data-gamer-target]'); if (sel) sel.onchange = () => { drafts.target = sel.value; };
        el.querySelectorAll('[data-power]').forEach((b) => { b.onclick = () => { const t = drafts.target || g.target; if (!t) return reply({ ok: false, error: 'Pick a player first.' }); emit({ op: 'power', power: b.dataset.power, targetId: t }); }; });
      }
    } else if (flight && v.phase !== 'night') flight.finish(); // the night ended mid-run

    // The horde.
    if (v.horde) card('horde', `<h3>🧟 The horde <small>${v.horde.members.length} · ${v.horde.bites} bite${v.horde.bites === 1 ? '' : 's'} tonight</small></h3><p class="small muted">More Zombies, more bites: 2 bites from 3 Zombies, 3 from 5. Each bite breaks into a house; the town only sees a window break somewhere.</p><p class="small">${v.horde.members.map((z) => esc(z.name) + (z.me ? ' (you)' : '')).join(', ')}</p>${v.horde.picks.length ? `<ul class="small">${v.horde.picks.map((p) => `<li>${esc(p.name)} → ${esc(p.target)}</li>`).join('')}</ul>` : '<p class="small muted">No picks yet. The horde bites whoever most of you pick.</p>'}`);
  };

  // ---------- Night Flight: an original tap-to-fly arcade game ----------
  // A little bat carries a lantern over the rooftops; fly through the gaps between chimneys.
  function startFlight(done) {
    const wrap = document.createElement('div'); wrap.className = 'flight';
    wrap.innerHTML = '<canvas></canvas><div class="flight-hud"><b class="flight-score">0</b><span class="flight-hint">Tap to flap · 5 = 🛡 Shield · 12 = 🔍 Scan · 25 = 🏆 High Score</span></div>';
    document.body.appendChild(wrap);
    const cv = wrap.querySelector('canvas'), ctx = cv.getContext('2d'), scoreEl = wrap.querySelector('.flight-score'), hint = wrap.querySelector('.flight-hint');
    let W = 0, H = 0;
    const fit = () => { W = cv.width = Math.min(window.innerWidth, 520); H = cv.height = window.innerHeight; };
    fit(); window.addEventListener('resize', fit);
    const bat = { x: 0, y: 0, vy: 0 }, chimneys = [], stars = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random() * 0.6, s: Math.random() * 1.5 + 0.5 }));
    let score = 0, started = false, over = false, t0 = performance.now(), last = t0, spawn = 0, raf = 0;
    bat.x = W * 0.3; bat.y = H * 0.45;
    const flap = (e) => { if (e) e.preventDefault(); if (over) return; if (!started) hint.textContent = 'Next: 🛡 Shield at 5'; started = true; bat.vy = -H * 0.95; };
    wrap.addEventListener('pointerdown', flap);
    const finish = () => {
      if (over && !wrap.isConnected) return;
      over = true; cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      const got = REWARDS.filter((r) => r.need <= score).pop();
      hint.textContent = `Game over! Score ${score}: ${got ? `${got.icon} ${got.name} unlocked` : 'no power tonight'}`;
      if (navigator.vibrate) navigator.vibrate(120);
      setTimeout(() => { wrap.remove(); flight = null; }, 1200);
      done(score);
    };
    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      const speed = W * (0.42 + Math.min(score, 30) * 0.008); // a little faster as you go
      const gap = H * Math.max(0.24, 0.34 - score * 0.004); // and the gaps get tighter
      if (started) {
        bat.vy += H * 2.6 * dt; bat.y += bat.vy * dt;
        spawn -= dt;
        if (spawn <= 0) { spawn = 1.45; const top = H * 0.12 + Math.random() * (H * 0.62 - gap); chimneys.push({ x: W + 40, top, gap, passed: false }); }
        for (const c of chimneys) {
          c.x -= speed * dt;
          if (!c.passed && c.x + 34 < bat.x) { c.passed = true; score++; scoreEl.textContent = score; const next = REWARDS.find((r) => r.need > score), got = REWARDS.filter((r) => r.need <= score).pop(); hint.textContent = (got ? `${got.icon} ${got.name} unlocked!` : '') + (next ? `  Next: ${next.icon} ${next.name} at ${next.need}` : '  Max reward!'); }
          const hitX = bat.x + 12 > c.x && bat.x - 12 < c.x + 34;
          if (hitX && (bat.y - 10 < c.top || bat.y + 10 > c.top + c.gap)) return finish();
        }
        while (chimneys.length && chimneys[0].x < -60) chimneys.shift();
        if (bat.y < 14) { bat.y = 14; bat.vy = Math.max(0, bat.vy); } // the sky is a ceiling, not a wall
        if (bat.y > H * 0.9) return finish(); // the rooftops are
      } else bat.y = H * 0.45 + Math.sin((now - t0) / 300) * 8;
      draw(now);
      raf = requestAnimationFrame(frame);
    }
    function draw(now) {
      const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1b1440'); sky.addColorStop(1, '#3d2a63');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; for (const s of stars) { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(now / 500 + s.x * 20); ctx.fillRect(s.x * W, s.y * H, s.s, s.s); } ctx.globalAlpha = 1;
      ctx.fillStyle = '#f6e7b0'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.13, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1b1440'; ctx.beginPath(); ctx.arc(W * 0.8 + 10, H * 0.13 - 6, 22, 0, Math.PI * 2); ctx.fill();
      // Rooftops.
      ctx.fillStyle = '#120c2a'; for (let i = 0; i < 8; i++) { const x = ((i * 90 - (now / 25) % 90) + W) % (W + 90) - 60; ctx.fillRect(x, H * 0.86 - (i % 3) * 14, 70, H); }
      // Chimneys: brick stacks from the top and the bottom, with a smoke puff.
      for (const c of chimneys) {
        for (const [y0, h] of [[0, c.top], [c.top + c.gap, H - c.top - c.gap]]) {
          ctx.fillStyle = '#7a3b2e'; ctx.fillRect(c.x, y0, 34, h);
          ctx.fillStyle = '#5c2b22'; for (let y = y0 + 6; y < y0 + h; y += 12) ctx.fillRect(c.x + ((y / 12) % 2 ? 0 : 17), y, 17, 2);
          ctx.fillStyle = '#9a4d3c'; ctx.fillRect(c.x - 4, y0 === 0 ? c.top - 10 : y0, 42, 10);
        }
        ctx.fillStyle = 'rgba(220,220,235,0.25)'; ctx.beginPath(); ctx.arc(c.x + 17, c.top + c.gap + (H - c.top - c.gap) - 2 - 18, 9, 0, Math.PI * 2); ctx.fill();
      }
      // The lantern-bat.
      const flapUp = Math.sin(now / 70) > 0;
      ctx.save(); ctx.translate(bat.x, bat.y); ctx.rotate(Math.max(-0.5, Math.min(0.6, bat.vy / (H * 1.6))));
      ctx.fillStyle = 'rgba(255,210,120,0.25)'; ctx.beginPath(); ctx.arc(0, 16, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcf6a'; ctx.fillRect(-4, 10, 8, 10); ctx.fillStyle = '#6b4a22'; ctx.fillRect(-1, 5, 2, 6);
      ctx.fillStyle = '#2a2135';
      ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-22, flapUp ? -12 : 6); ctx.lineTo(-12, 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(22, flapUp ? -12 : 6); ctx.lineTo(12, 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff6b6b'; ctx.fillRect(-4, -3, 2, 2); ctx.fillRect(2, -3, 2, 2);
      ctx.restore();
    }
    raf = requestAnimationFrame(frame);
    flight = { show() { wrap.style.display = ''; }, finish };
  }
})();
