'use strict';
// JustSketch Relay screens. Phone: a full-screen sketchpad overlay (outside the re-rendered body,
// so redraws never wipe a drawing), guess box, voting. TV: relay progress, then a book-by-book
// reveal with stroke-by-stroke replays, votes, awards and a gallery of every book.
(function () {
  const { esc } = BOX;
  const PALETTE = ['#1d1b26', '#e63946', '#ff8c1a', '#ffd23f', '#2bb673', '#2f7bff', '#8e44ff', '#8b5a2b'];
  const NAMES = ['Black', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Brown'];
  const PAPER = '#fffdf7', SIZES = [6, 14, 32], ERASER = 8, MAX_STROKES = 400, MAX_POINTS = 8000;
  const colorOf = (c) => (c === ERASER ? PAPER : PALETTE[c] || '#000');

  // ---------- drawing helpers (phones and TV) ----------
  const countPts = (strokes) => strokes.reduce((n, s) => n + s.p.length / 2, 0);
  function fit(cv) {
    const css = cv.clientWidth || 240, dpr = Math.min(2, window.devicePixelRatio || 1), px = Math.max(60, Math.round(css * dpr));
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    return px;
  }
  // Paint strokes on a square canvas; frac < 1 draws only the first part (for replays).
  function paint(cv, strokes, frac = 1) {
    const W = fit(cv), g = cv.getContext('2d'), k = W / 1000;
    g.fillStyle = PAPER; g.fillRect(0, 0, W, W);
    g.lineCap = 'round'; g.lineJoin = 'round';
    let left = frac >= 1 ? Infinity : Math.floor(countPts(strokes || []) * frac);
    for (const s of strokes || []) {
      if (left <= 0) break;
      const n = Math.min(s.p.length / 2, left); left -= n;
      g.strokeStyle = g.fillStyle = colorOf(s.c); g.lineWidth = Math.max(1, SIZES[s.s] * k);
      if (n === 1) { g.beginPath(); g.arc(s.p[0] * k, s.p[1] * k, g.lineWidth / 2, 0, Math.PI * 2); g.fill(); continue; }
      g.beginPath(); g.moveTo(s.p[0] * k, s.p[1] * k);
      for (let i = 1; i < n; i++) g.lineTo(s.p[i * 2] * k, s.p[i * 2 + 1] * k);
      g.stroke();
    }
  }
  // Replay a drawing stroke by stroke (TV reveal).
  function replay(cv, strokes, ms = 1800) {
    const t0 = performance.now(), id = (cv._rp = (cv._rp || 0) + 1);
    const step = () => {
      if (cv._rp !== id || !document.body.contains(cv)) return;
      const f = Math.min(1, (performance.now() - t0) / ms); paint(cv, strokes, f);
      if (f < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const paintAll = (root, list) => { for (const cv of root.querySelectorAll('canvas[data-d]')) { const d = list[Number(cv.dataset.d)]; if (d) paint(cv, d); } };

  // Stable countdowns (so a body that hasn't changed isn't rebuilt every second).
  const deadlines = {};
  function deadline(key, endsIn) {
    const d = Date.now() + (endsIn || 0), c = deadlines[key];
    if (c && Math.abs(c - d) < 1500) return c;
    deadlines[key] = d; return d;
  }
  const tspan = (d) => `<span class="timer sk-timer" data-ends="${d}">${BOX.mmss(d - Date.now())}</span>`;
  // Rebuild a screen only when its signature changes; returns true when rebuilt.
  function put(el, sig, html) {
    const w = el.firstElementChild;
    if (w && w.classList.contains('sk-root') && w.dataset.sig === sig && el.children.length === 1) return false;
    el.innerHTML = `<div class="sk-root" data-sig="${esc(sig)}">${html}</div>`;
    return true;
  }

  // ---------- the phone sketchpad (full-screen overlay) ----------
  const pad = { ov: null, key: null, strokes: [], cleared: null, color: 0, size: 1, eraser: false, cur: null, deadline: 0, sending: false, tick: 0, ctx: null };
  function closePad() {
    if (pad.ov) { pad.ov.remove(); pad.ov = null; }
    clearInterval(pad.tick); pad.tick = 0; pad.key = null; pad.cur = null; pad.sending = false;
    window.removeEventListener('resize', layoutPad);
  }
  function layoutPad() {
    if (!pad.ov) return;
    const ov = pad.ov, cv = ov.querySelector('.sk-pad');
    const used = ov.querySelector('.sk-padhead').offsetHeight + ov.querySelector('.sk-tools').offsetHeight + ov.querySelector('.sk-padfoot').offsetHeight + 34;
    const side = Math.max(160, Math.floor(Math.min(ov.clientWidth - 20, ov.clientHeight - used, 720)));
    cv.style.width = cv.style.height = side + 'px';
    paint(cv, pad.strokes);
  }
  function toolsHtml() {
    return `<div class="sk-colors">${PALETTE.map((c, i) => `<button class="sk-sw ${!pad.eraser && pad.color === i ? 'on' : ''}" data-col="${i}" style="background:${c}" aria-label="${NAMES[i]}"></button>`).join('')}</div>
      <div class="sk-tool-row">${SIZES.map((s, i) => `<button class="sk-size ${pad.size === i ? 'on' : ''}" data-size="${i}" aria-label="Brush ${i + 1}"><i style="width:${6 + i * 7}px;height:${6 + i * 7}px;background:${pad.eraser ? '#999' : PALETTE[pad.color]}"></i></button>`).join('')}
        <button class="sk-tool ${pad.eraser ? 'on' : ''}" data-tool="eraser">🧽<span>Eraser</span></button>
        <button class="sk-tool" data-tool="undo">↩️<span>Undo</span></button>
        <button class="sk-tool" data-tool="clear">🗑️<span>Clear</span></button></div>`;
  }
  function bindTools() {
    const ov = pad.ov, box = ov.querySelector('.sk-tools');
    box.innerHTML = toolsHtml();
    for (const b of box.querySelectorAll('[data-col]')) b.onclick = () => { pad.color = Number(b.dataset.col); pad.eraser = false; bindTools(); };
    for (const b of box.querySelectorAll('[data-size]')) b.onclick = () => { pad.size = Number(b.dataset.size); bindTools(); };
    for (const b of box.querySelectorAll('[data-tool]')) b.onclick = () => {
      const t = b.dataset.tool, cv = ov.querySelector('.sk-pad');
      if (t === 'eraser') { pad.eraser = !pad.eraser; bindTools(); return; }
      if (t === 'undo') { if (pad.strokes.length) pad.strokes.pop(); else if (pad.cleared) { pad.strokes = pad.cleared; pad.cleared = null; } paint(cv, pad.strokes); BOX.sfx('click'); return; }
      if (t === 'clear' && pad.strokes.length) { pad.cleared = pad.strokes; pad.strokes = []; paint(cv, pad.strokes); BOX.sfx('poof'); }
    };
  }
  function openPad(task, endsIn, ctx) {
    closePad();
    pad.key = task.key; pad.strokes = []; pad.cleared = null; pad.eraser = false; pad.ctx = ctx; pad.deadline = Date.now() + endsIn;
    const ov = document.createElement('div'); ov.className = 'sk-over';
    ov.innerHTML = `<div class="sk-padhead"><div class="sk-padlabel">${task.first ? (task.own ? '✏️ Draw your prompt' : '🤫 Your secret prompt — draw it!') : '✏️ Draw this guess'}</div>
        <div class="sk-padprompt"></div><div class="sk-padtime">⏱ <span class="timer" data-ends="${pad.deadline}">${BOX.mmss(endsIn)}</span></div></div>
      <div class="sk-padwrap"><canvas class="sk-pad"></canvas></div>
      <div class="sk-tools"></div>
      <div class="sk-padfoot"><button class="btn ghost small sk-reroll" hidden>🎲 New prompt</button><button class="btn big green sk-done">Done ✓</button></div>`;
    document.body.appendChild(ov); pad.ov = ov;
    updatePad(task, endsIn);
    bindTools();
    const cv = ov.querySelector('.sk-pad'); cv.style.touchAction = 'none';
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1000, Math.round(((e.clientX - r.left) / r.width) * 1000))), Math.max(0, Math.min(1000, Math.round(((e.clientY - r.top) / r.height) * 1000)))]; };
    const seg = (s, x0, y0, x1, y1) => {
      const g = cv.getContext('2d'), k = cv.width / 1000;
      g.strokeStyle = g.fillStyle = colorOf(s.c); g.lineWidth = Math.max(1, SIZES[s.s] * k); g.lineCap = 'round'; g.lineJoin = 'round';
      if (x0 === x1 && y0 === y1) { g.beginPath(); g.arc(x0 * k, y0 * k, g.lineWidth / 2, 0, Math.PI * 2); g.fill(); return; }
      g.beginPath(); g.moveTo(x0 * k, y0 * k); g.lineTo(x1 * k, y1 * k); g.stroke();
    };
    let full = false;
    const isFull = () => pad.strokes.length >= MAX_STROKES || countPts(pad.strokes) >= MAX_POINTS - 2;
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (pad.sending) return;
      if (isFull()) { if (!full) { full = true; ctx.toast('The page is full! Press Done.'); } return; }
      try { cv.setPointerCapture(e.pointerId); } catch { /* old browser */ }
      const [x, y] = pt(e);
      pad.cur = { c: pad.eraser ? ERASER : pad.color, s: pad.size, p: [x, y] }; pad.strokes.push(pad.cur); pad.cleared = null;
      seg(pad.cur, x, y, x, y);
    });
    cv.addEventListener('pointermove', (e) => {
      if (!pad.cur) return; e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) {
        const s = pad.cur, [x, y] = pt(ev), lx = s.p[s.p.length - 2], ly = s.p[s.p.length - 1];
        if (Math.hypot(x - lx, y - ly) < 4) continue;
        if (countPts(pad.strokes) >= MAX_POINTS - 2) { pad.cur = null; ctx.toast('The page is full! Press Done.'); return; }
        s.p.push(x, y); seg(s, lx, ly, x, y);
      }
    });
    const up = () => { pad.cur = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
    ov.querySelector('.sk-done').onclick = () => {
      if (!pad.strokes.length && !confirm('Send a blank page?')) return;
      sendPad(false);
    };
    ov.querySelector('.sk-reroll').onclick = async () => { const r = await ctx.act({ op: 'reroll' }); if (r.ok) { ctx.sfx('shuffle'); ctx.toast('🎲 New prompt!'); } };
    window.addEventListener('resize', layoutPad);
    requestAnimationFrame(layoutPad);
    // Time's nearly up: send whatever is on the page so the drawing isn't lost.
    pad.tick = setInterval(() => {
      if (!pad.ov) return;
      const left = pad.deadline - Date.now();
      pad.ov.classList.toggle('hurry', left < 10000);
      if (left < 900 && !pad.sending) sendPad(true);
      if (left < -6000) closePad();
    }, 200);
  }
  function updatePad(task, endsIn) {
    const ov = pad.ov; if (!ov) return;
    const p = ov.querySelector('.sk-padprompt'); if (p.textContent !== task.text) { p.textContent = task.text; p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
    ov.querySelector('.sk-reroll').hidden = !task.canReroll;
    const d = Date.now() + endsIn;
    if (Math.abs(d - pad.deadline) > 1500) { pad.deadline = d; const t = ov.querySelector('.sk-padtime .timer'); t.dataset.ends = d; }
  }
  async function sendPad(auto) {
    if (!pad.ov || pad.sending) return;
    pad.sending = true; pad.cur = null;
    const ctx = pad.ctx, key = pad.key;
    pad.ov.querySelector('.sk-done').textContent = auto ? '⏰ Sending…' : 'Sending…';
    const r = await ctx.act({ op: 'draw', strokes: pad.strokes });
    if (pad.key !== key) return;
    if (r.ok) { closePad(); ctx.sfx('pop'); ctx.vibrate(30); if (auto) ctx.toast('⏰ Time! Your drawing was sent.'); }
    else if (auto) closePad();
    else { pad.sending = false; pad.ov.querySelector('.sk-done').textContent = 'Done ✓'; }
  }

  // ---------- phone ----------
  const drafts = {}; // typed text per task (survives re-renders)
  let promptDraft = '';
  const head = (v) => `<div class="sk-me"><span>🏅 ${v.points} pts${v.rank ? ` · #${v.rank} of ${v.players}` : ''}</span>${v.phase === 'step' || v.phase === 'pass' ? `<span class="muted">step ${Math.min(v.step, v.steps)}/${v.steps}</span>` : v.n ? `<span class="muted">book ${v.n}/${v.of}</span>` : ''}</div>`;
  const entryCard = (e, i, d, opts = {}) => {
    const body = e.kind === 'draw' ? `<canvas class="sk-thumb" data-d="${d}"></canvas>${e.auto ? '<div class="sk-ink">(ran out of ink)</div>' : ''}` : `<div class="sk-say ${e.kind === 'prompt' ? 'prompt' : ''}">${e.kind === 'prompt' ? '🎯 ' : '💬 '}${esc(e.text)}</div>`;
    return `<${opts.button ? 'button' : 'div'} class="sk-entry ${e.kind} ${opts.cls || ''}" ${opts.attrs || ''}><span class="sk-num">${i}</span>${body}<div class="sk-by">${e.kind === 'prompt' ? 'prompt' : e.kind === 'draw' ? '✏️ ' : '🤔 '}${e.kind === 'prompt' ? '' : esc(e.by)}${opts.extra || ''}</div></${opts.button ? 'button' : 'div'}>`;
  };

  function phone(el, v, ctx) {
    if (!v) return;
    const t = v.task;
    if (v.phase === 'step' && t && t.kind === 'draw' && !t.done) {
      if (pad.key !== t.key || !pad.ov) openPad(t, v.endsIn, ctx); else updatePad(t, v.endsIn);
    } else if (pad.ov && !pad.sending) closePad();
    else if (pad.ov && v.phase !== 'step') closePad();

    if (v.phase === 'over') {
      const aw = v.awards.map((a) => `<div class="sk-award mine"><span class="ic">${a.icon}</span><div><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></div></div>`).join('');
      put(el, 'over:' + v.points + ':' + v.rank, `${head(v)}<div class="card-box sk-center"><div class="sk-bigicon">🏁</div><h3>That’s a wrap!</h3><p>You finished <b>#${v.rank}</b> with <b>${v.points}</b> points.</p></div>
        ${aw ? `<div class="card-box"><h3>🏆 You won</h3>${aw}</div>` : ''}
        ${v.myBook ? `<div class="card-box"><h3>📖 Your book</h3><div class="sk-chain"><div class="sk-say prompt">🎯 ${esc(v.myBook.prompt)}</div><div class="sk-arrow">⬇</div><div class="sk-say">💬 ${esc(v.myBook.final || '…')}</div></div><p class="sk-center">${v.myBook.survived ? '✅ It survived the whole ring!' : '🌀 Total chaos.'}</p></div>` : ''}
        <div class="card-box">${BOX.board(v.final, (r) => r.points, '')}</div>`);
      return;
    }
    if (v.phase === 'write') {
      if (v.wrote) { put(el, 'wrote:' + v.wrote, `${head(v)}<div class="card-box sk-center"><div class="sk-bigicon">✅</div><h3>Prompt locked in</h3><div class="sk-say prompt">🎯 ${esc(v.wrote)}</div><p class="muted">Keep it secret! Waiting for everyone… ${tspan(deadline('w', v.endsIn))}</p></div>`); return; }
      if (!v.inGame) { put(el, 'watchw', `${head(v)}<div class="card-box sk-center"><h3>👀 You joined mid-game</h3><p>You’ll get to vote on the books when they’re revealed!</p></div>`); return; }
      const d = deadline('w', v.endsIn);
      if (put(el, 'write:' + d, `${head(v)}<div class="card-box"><h3>✍️ Write a prompt ${tspan(d)}</h3><p class="muted">Something fun for the next player to draw. Keep it short!</p>
          <input id="sk-pin" class="sk-input" maxlength="60" placeholder="a walrus in a hot tub" value="${esc(promptDraft)}" autocomplete="off">
          <button class="btn big green sk-wide" id="sk-psend">Lock it in</button></div>`)) {
        const inp = el.querySelector('#sk-pin');
        inp.oninput = () => { promptDraft = inp.value; };
        const go = async () => { promptDraft = inp.value; const r = await ctx.act({ op: 'prompt', text: promptDraft }); if (r.ok) { ctx.sfx('chime'); promptDraft = ''; inp.blur(); } };
        el.querySelector('#sk-psend').onclick = go;
        inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
      }
      return;
    }
    if (v.phase === 'step' || v.phase === 'pass') {
      if (v.phase === 'pass') { put(el, 'pass:' + v.step, `${head(v)}<div class="sk-passbox"><div class="sk-book">📖</div><h3>Passing the books…</h3><p>Next up: <b>${v.nextKind === 'draw' ? '✏️ DRAW' : '🤔 GUESS'}</b></p></div>`); return; }
      if (!t) {
        put(el, 'idle:' + v.step + ':' + v.inGame, `${head(v)}<div class="card-box sk-center">${v.inGame ? '<div class="sk-bigicon">🎉</div><h3>Your ring is finished!</h3><p>The other rings are still going. Watch the big screen.</p>' : '<div class="sk-bigicon">👀</div><h3>You joined mid-game</h3><p>Hang tight: you’ll vote for the funniest entries when the books are revealed!</p>'}</div>`);
        return;
      }
      if (t.done) {
        put(el, 'done:' + t.key + ':' + (v.total - v.done), `${head(v)}<div class="card-box sk-center"><div class="sk-bigicon">${t.kind === 'draw' ? '🖼️' : '💌'}</div><h3>Sent!</h3><p>Waiting for ${v.total - v.done} more player${v.total - v.done === 1 ? '' : 's'}…</p><p class="muted">Next: ${v.nextKind === 'draw' ? '✏️ you’ll draw someone’s guess' : '🤔 you’ll guess someone’s drawing'}</p></div>`);
        return;
      }
      if (t.kind === 'draw') { put(el, 'drawing:' + t.key, `${head(v)}<div class="card-box sk-center"><div class="sk-bigicon">✏️</div><h3>Your sketchpad is open</h3><p>Draw, then press <b>Done</b>.</p></div>`); return; }
      // Guess: the drawing and a text box (draft kept in module state).
      const d = deadline(t.key, v.endsIn);
      if (put(el, 'guess:' + t.key + ':' + d, `${head(v)}<div class="sk-guess"><div class="sk-padlabel">🤔 What is this? ${tspan(d)}</div>
          <div class="sk-guesswrap"><canvas class="sk-guesscv"></canvas>${t.blank ? '<div class="sk-ink big">(they ran out of ink!)<br><small>Make something up 😅</small></div>' : ''}</div>
          <input id="sk-gin" class="sk-input" maxlength="60" placeholder="Type your guess" value="${esc(drafts[t.key] || '')}" autocomplete="off" enterkeyhint="send">
          <button class="btn big green sk-wide" id="sk-gsend">Send guess</button></div>`)) {
        paint(el.querySelector('.sk-guesscv'), t.strokes);
        const inp = el.querySelector('#sk-gin');
        inp.oninput = () => { drafts[t.key] = inp.value; };
        const go = async () => {
          drafts[t.key] = inp.value;
          if (!inp.value.trim()) return ctx.toast('Type your guess first.');
          const r = await ctx.act({ op: 'guess', text: inp.value });
          if (r.ok) { ctx.sfx('pop'); ctx.vibrate(25); inp.blur(); }
        };
        el.querySelector('#sk-gsend').onclick = go;
        inp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
        // Time nearly up with something typed: send it.
        clearTimeout(phone.autoT);
        phone.autoT = setTimeout(() => { const cur = drafts[t.key]; if (cur && cur.trim() && document.body.contains(inp)) ctx.act({ op: 'guess', text: cur }); }, Math.max(0, d - Date.now() - 900));
      }
      return;
    }
    // The reveal.
    const who = v.mine ? 'your book' : `${esc(v.owner)}’s book`;
    if (v.phase === 'show' || v.phase === 'final') {
      put(el, 'show:' + v.n + ':' + v.phase, `${head(v)}<div class="card-box sk-center"><div class="sk-bigicon">📺</div><h3>Look at the TV!</h3><p>Book ${v.n} of ${v.of}: <b>${who}</b></p>${v.phase === 'final' ? `<p class="sk-verdict ${v.survived ? 'ok' : ''}">${v.survived ? '✅ The chain survived! +50 to everyone in it' : '🌀 Total chaos!'}</p>` : v.inBook ? '<p class="muted">You’re in this one… 😬</p>' : ''}<p class="muted">Get ready to vote for the funniest entry.</p></div>`);
      return;
    }
    if (v.phase === 'vote') {
      const list = v.book.entries.map((e) => (e && e.strokes) || null);
      const d = deadline('v' + v.n, v.endsIn);
      if (put(el, `vote:${v.n}:${v.myVote}:${d}`, `${head(v)}<div class="sk-padlabel">🗳️ Tap the funniest entry in ${who} ${tspan(d)}</div>
          <div class="sk-vote">${v.book.entries.map((e, i) => (i === 0 ? '' : entryCard(e, i, i, { button: true, cls: `${v.can.includes(i) ? '' : 'no'} ${v.myVote === i ? 'sel' : ''}`, attrs: `data-v="${i}" ${v.can.includes(i) ? '' : 'disabled'}`, extra: e.byId === undefined ? '' : v.can.includes(i) ? '' : e.auto ? '' : ' (you)' }))).join('')}</div>
          ${v.myVote != null ? '<p class="muted sk-center">Vote cast ✅ tap another to change it</p>' : ''}`)) {
        paintAll(el, list);
        for (const b of el.querySelectorAll('[data-v]')) b.onclick = () => { ctx.act({ op: 'vote', entry: Number(b.dataset.v) }); ctx.vibrate(20); ctx.sfx('click'); };
      }
      return;
    }
    if (v.phase === 'results') {
      put(el, 'res:' + v.n + ':' + v.gain, `${head(v)}<div class="card-box sk-center">${v.gain ? `<div class="sk-bigicon">🎉</div><h3>+${v.gain * 100} points!</h3><p>${v.gain} vote${v.gain === 1 ? '' : 's'} for you in ${who}.</p>` : '<div class="sk-bigicon">🍿</div><h3>The votes are in</h3><p>See who won on the TV!</p>'}</div>`);
    }
  }

  // ---------- TV ----------
  const tvs = { gallery: null, open: null };
  const KIND = { draw: { icon: '✏️', word: 'DRAW', tip: 'Draw what your phone tells you!' }, guess: { icon: '🤔', word: 'GUESS', tip: 'What on earth is that drawing?' } };
  const doodles = () => `<div class="sk-doodles" aria-hidden="true">${['✏️', '🖍️', '🎨', '🖌️', '📖', '❓', '💡', '🌀'].map((x, i) => `<span style="--i:${i};top:${10 + ((i * 37) % 70)}%">${x}</span>`).join('')}</div>`;
  const stageEntry = (e) => {
    if (e.kind === 'prompt') return `<div class="sk-stage-card prompt"><div class="sk-tag">🎯 The prompt</div><div class="sk-stage-text">${esc(e.text)}</div></div>`;
    if (e.kind === 'guess') return `<div class="sk-stage-card guess"><div class="sk-tag">🤔 ${esc(e.by)} guessed</div><div class="sk-stage-text ${e.auto ? 'auto' : ''}">${esc(e.text)}</div></div>`;
    return `<div class="sk-stage-card draw"><div class="sk-tag">✏️ ${esc(e.by)} drew</div><div class="sk-paper"><canvas class="sk-stagecv"></canvas>${e.auto ? '<div class="sk-ink big">(ran out of ink)</div>' : ''}</div></div>`;
  };
  const mini = (e, i, cls = '') => `<div class="sk-mini ${e.kind} ${cls}">${e.kind === 'draw' ? `<canvas data-d="${i}"></canvas>` : `<span>${e.kind === 'prompt' ? '🎯' : '💬'} ${esc(e.text)}</span>`}</div>`;

  function tv(el, s, ctx) {
    if (!s) return;
    if (s.phase === 'over') return tvOver(el, s, ctx);
    tvs.gallery = null;
    const side = `<aside class="panel sk-side"><h3>Scores</h3>${BOX.board(s.standings, (r) => r.points, '')}</aside>`;
    if (s.phase === 'write') {
      put(el, 'write:' + s.done + ':' + s.waiting.join(','), `<div class="sk-wrap"><section class="sk-relay">${doodles()}<div class="sk-bigword">✍️ WRITE</div><p class="sk-lead">Everyone: write a secret prompt on your phone!</p>
        <div class="sk-count">${s.done} / ${s.of} ready · ${tspan(deadline('tvw', s.endsIn))}</div>${waitHtml(s)}</section></div>`);
      return;
    }
    if (s.phase === 'step' || s.phase === 'pass') {
      const K = KIND[s.phase === 'pass' ? s.nextKind : s.kind];
      const pct = s.of ? Math.round((s.done / s.of) * 100) : 0;
      if (s.phase === 'pass') { put(el, 'pass:' + s.step, `<div class="sk-wrap"><section class="sk-relay sk-pass"><div class="sk-books">${Array.from('📕📗📘📙').map((b, i) => `<span style="--i:${i}">${b}</span>`).join('')}</div><div class="sk-bigword">PASS!</div><p class="sk-lead">The books move one seat along… next you ${K.word === 'DRAW' ? '✏️ draw' : '🤔 guess'}.</p></section>${side}</div>`); return; }
      const dl = deadline('tv' + s.step, s.endsIn);
      if (put(el, `step:${s.step}:${dl}`, `<div class="sk-wrap"><section class="sk-relay ${s.kind}">${doodles()}<div class="sk-stepno">Step ${s.step} of ${s.steps}${s.rings > 1 ? ` · ${s.rings} rings` : ''}</div>
          <div class="sk-bigword">${K.icon} ${K.word}!</div><p class="sk-lead">${K.tip}</p>
          <div class="sk-bar"><i style="width:0%"></i></div><div class="sk-count"><span class="sk-done">0 / 0</span> done · ${tspan(dl)}</div><div class="sk-wait"></div></section>${side}</div>`)) { /* built */ }
      el.querySelector('.sk-bar i').style.width = pct + '%';
      el.querySelector('.sk-done').textContent = `${s.done} / ${s.of}`;
      el.querySelector('.sk-wait').innerHTML = waitHtml(s);
      return;
    }
    const b = s.book; if (!b) return;
    const title = `<div class="sk-bookhead"><span class="sk-bookno">📖 Book ${s.n} of ${s.of}</span><b>${esc(b.owner)}’s book</b></div>`;
    if (s.phase === 'show') {
      const e = b.entries[s.entry];
      if (put(el, `show:${b.id}:${s.entry}`, `<div class="sk-reveal">${title}<div class="sk-strip">${b.entries.slice(0, s.entry).map((x, i) => mini(x, i)).join('')}</div><div class="sk-stage">${stageEntry(e)}</div><div class="sk-dots">${Array.from({ length: b.total }, (_, i) => `<i class="${i <= s.entry ? 'on' : ''}"></i>`).join('')}</div></div>`)) {
        paintAll(el, b.entries.map((x) => x && x.strokes));
        const cv = el.querySelector('.sk-stagecv'); if (cv) replay(cv, e.strokes, Math.min(2600, 700 + e.strokes.length * 120));
      }
      return;
    }
    if (s.phase === 'final') {
      const first = b.entries[0], last = b.entries[b.entries.length - 1];
      if (put(el, `final:${b.id}`, `<div class="sk-reveal">${title}<div class="sk-versus ${s.survived ? 'ok' : 'chaos'}">
          <div class="sk-vs-card prompt"><div class="sk-tag">🎯 Started as</div><div class="sk-stage-text">${esc(first.text)}</div></div>
          <div class="sk-vs-arrow">➜</div>
          <div class="sk-vs-card guess"><div class="sk-tag">💬 Ended as</div><div class="sk-stage-text">${esc(last.text)}</div></div></div>
          <div class="sk-verdict big ${s.survived ? 'ok' : ''}">${s.survived ? '✅ THE CHAIN SURVIVED! +50 to everyone in it' : '🌀 TOTAL CHAOS!'}</div>
          ${s.survived ? confetti() : ''}</div>`)) { /* built */ }
      return;
    }
    // vote / results: the whole book as a grid.
    const res = s.phase === 'results';
    if (put(el, `${s.phase}:${b.id}`, `<div class="sk-reveal">${title}<div class="sk-status">${res ? '🏆 The funniest entry' : `🗳️ Vote on your phone for the funniest entry! <span class="sk-voted"></span> ${tspan(deadline('tvv' + b.id, s.endsIn))}`}</div>
        <div class="sk-grid" style="--cols:${Math.ceil(b.entries.length / 2)};max-width:${Math.ceil(b.entries.length / 2) * 30}vh">${b.entries.map((e, i) => {
          const top = res && s.top && s.top.includes(i), n = res && s.tally ? s.tally[i] : 0;
          return `<div class="sk-cell ${e.kind} ${top ? 'top' : ''} ${res && !top ? 'dim' : ''}"><span class="sk-num">${i || '🎯'}</span>${e.kind === 'draw' ? `<div class="sk-paper"><canvas data-d="${i}"></canvas>${e.auto ? '<div class="sk-ink">(ran out of ink)</div>' : ''}</div>` : `<div class="sk-cell-text">${esc(e.text)}</div>`}
            <div class="sk-by">${i ? esc(e.by) : esc(b.owner) + '’s prompt'}</div>${res && i ? `<div class="sk-votes ${n ? '' : 'zero'}">${n ? `${'🗳️'.repeat(Math.min(n, 5))}${n > 5 ? '+' + (n - 5) : ''} ${n}` : '–'}</div>` : ''}${top ? '<div class="sk-crown">👑</div>' : ''}</div>`;
        }).join('')}</div>${res ? `<div class="sk-side-row">${BOX.board(s.standings.slice(0, 5), (r) => r.points, ' pts')}</div>` : ''}</div>`)) paintAll(el, b.entries.map((x) => x && x.strokes));
    const vt = el.querySelector('.sk-voted'); if (vt) vt.textContent = `${s.voted} voted`;
  }
  function waitHtml(s) {
    if (!s.waiting || !s.waiting.length) return '<div class="sk-waitlist all">Everyone’s done! 🎉</div>';
    return `<div class="sk-waitlist"><span class="muted">Waiting for</span> ${s.waiting.map((n) => `<span class="sk-chip">${esc(n)}</span>`).join('')}${s.more ? `<span class="sk-chip">+${s.more}</span>` : ''}</div>`;
  }
  const confetti = () => `<div class="sk-confetti" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="--x:${(i * 37) % 100};--d:${(i % 7) * 0.15}s;--c:${PALETTE[i % 8]}"></i>`).join('')}</div>`;

  function tvOver(el, s, ctx) {
    const w = s.standings[0];
    const sig = 'over:' + s.standings.map((r) => r.id + r.points).join(',');
    if (put(el, sig, `<div class="sk-over-tv"><div class="final sk-final"><div class="crown">🎨</div><div class="muted">Relay champion</div><h2>${esc(w ? w.name : '')}</h2></div>
        <div class="sk-awards">${s.awards.map((a, i) => `<div class="sk-award" style="--i:${i}"><span class="ic">${a.icon}</span><div><small>${esc(a.title)}</small><b>${esc(a.name)}</b><em>${esc(a.detail)}</em></div></div>`).join('') || '<p class="muted">No awards this time.</p>'}</div>
        <div class="sk-endgrid"><div class="panel"><h3>Final scores</h3>${BOX.board(s.standings, (r) => r.points, ' pts')}</div>
        <div class="panel"><h3>📚 The gallery <span class="muted">(click a book)</span></h3><div class="sk-gallery">${s.gallery.map((g) => `<button class="sk-gbook ${g.survived ? 'ok' : ''}" data-book="${g.id}"><b>${esc(g.owner)}</b><span>🎯 ${esc(g.prompt)}</span><span>💬 ${esc(g.final)}</span><i>${g.survived ? '✅' : '🌀'}</i></button>`).join('')}</div></div></div>
        <div class="sk-modal" hidden></div></div>`)) {
      for (const btn of el.querySelectorAll('[data-book]')) btn.onclick = () => openBook(el, Number(btn.dataset.book), ctx);
    }
  }
  async function openBook(el, id, ctx) {
    const m = el.querySelector('.sk-modal'); if (!m || !ctx || !ctx.host) return;
    m.hidden = false; m.innerHTML = '<div class="sk-modal-in"><p>Opening the book…</p></div>';
    const r = await ctx.host('sketchBook', { book: id });
    if (!r || !r.ok) { m.innerHTML = `<div class="sk-modal-in"><p>${esc((r && r.error) || 'Could not open that book.')}</p></div>`; return; }
    const b = r.book;
    m.innerHTML = `<div class="sk-modal-in"><button class="sk-x" aria-label="Close">✕</button><h2>📖 ${esc(b.owner)}’s book ${b.survived ? '✅' : '🌀'}</h2>
      <div class="sk-chainrow">${b.entries.map((e, i) => `${i ? '<span class="sk-arrow">➜</span>' : ''}<div class="sk-cell ${e.kind}">${e.kind === 'draw' ? `<div class="sk-paper"><canvas data-d="${i}"></canvas></div>` : `<div class="sk-cell-text">${esc(e.text)}</div>`}<div class="sk-by">${i ? esc(e.by) : 'prompt'}</div></div>`).join('')}</div></div>`;
    paintAll(m, b.entries.map((x) => x && x.strokes));
    BOX.sfx('flip');
    const close = () => { m.hidden = true; m.innerHTML = ''; };
    m.querySelector('.sk-x').onclick = close; m.onclick = (e) => { if (e.target === m) close(); };
  }

  BOX.games.sketch = {
    name: 'JustSketch Relay', icon: '🎨',
    about: 'Draw it, guess it, pass it on! Watch a prompt mutate around the ring, then vote for the funniest moment.',
    how: [
      'Everyone gets a secret prompt (or writes one) and draws it on their phone.',
      'Books pass around your ring: the next player sees only the drawing and guesses what it is…',
      '…the next sees only that guess and draws it. Draw, guess, draw, guess, all the way round.',
      'Then the big screen reveals every book, step by step. Watch “a cat on a skateboard” become something else entirely!',
      'Vote for the funniest entry: 100 points per vote. If the final guess still matches the prompt, everyone in that book gets +50.',
    ],
    fx: { draw: 'start', guess: 'chime', hurry: 'tension', pass: 'whoosh', book: 'reveal', flip: 'flip', guessIn: 'pop', survived: 'cheer', chaos: 'laugh', vote: 'ballot', results: 'drum', shrug: 'shrug', win: 'win' },
    tv, phone,
  };
})();
