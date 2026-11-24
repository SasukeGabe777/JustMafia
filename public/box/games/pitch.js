'use strict';
// JustPitch screens: a late-night keynote stage (navy hall, coral + teal lights, a big projection
// screen, a podium, and a dark BACKSTAGE feed on the side). See public/box/titles/pitch.js for the look.
// TV: lobby (speaker lineup + agenda cards + conference badge), matchup card, backstage prep, the
// presenter's spotlight, the live pitch (the slide the saboteur drew builds itself stroke by stroke,
// cue cards fly in and land in the backstage feed, reactions float up), the vote, the result, the
// bracket, and the awards. Phone: the presenter's cue-card prompter, the saboteur's control desk
// (next slide, a hand of cards, write-your-own), the audience's reactions / panelist lines /
// press questions, voting (stars in Buy My Book), and JustSketch's sketchpad for the slides.
(function () {
  const { esc } = BOX;
  const KIT = () => BOX.sketchKit || null; // public/box/games/sketch.js (loaded before this file)
  const KIND = {
    cue: { i: '🎬', t: 'Cue card', how: 'Do it now!' }, script: { i: '📜', t: 'Read this out', how: 'Read it to the panel, word for word:' },
    steer: { i: '🧭', t: 'Steer the panel', how: 'Take the conversation there:' }, panel: { i: '🙋', t: 'Panelist', how: 'A panelist is about to shout this. Deal with it!' },
    quote: { i: '📖', t: 'From your book', how: 'Read this quote aloud, then defend it:' }, question: { i: '🗞️', t: 'Reporter', how: 'Answer the question:' },
    demo: { i: '🔧', t: 'Demo time', how: 'Demonstrate it, live:' }, caller: { i: '📞', t: 'Caller on line 1', how: 'A caller says this. React!' },
    price: { i: '🏷️', t: 'New price', how: 'The price just changed. Justify it!' },
  };
  const kindOf = (k) => KIND[k] || KIND.cue;
  const fc = (who, px = 40, o = {}) => (who && BOX.face ? BOX.face(who, px, { cls: 'pt-fc', ...o }) : esc((who && who.avatar) || '🙂'));
  const bd = (who, h = 200, o = {}) => (who && BOX.body ? BOX.body(who, h, o) : `<span class="pt-emo" style="font-size:${Math.round(h / 2)}px">${esc((who && who.avatar) || '🙂')}</span>`);
  const nm = (s) => esc(BOX.filterText ? BOX.filterText(String(s || '')) : String(s || ''));
  const MIC = '<svg class="pt-mic" viewBox="0 0 40 64" aria-hidden="true"><rect x="10" y="2" width="20" height="30" rx="10" fill="#d8dee9" stroke="#1a1f3a" stroke-width="3"/><path d="M13 10h14M13 16h14M13 22h14" stroke="#8a93a8" stroke-width="2"/><path d="M5 26a15 15 0 0 0 30 0" fill="none" stroke="#1a1f3a" stroke-width="3" stroke-linecap="round"/><path d="M20 41v14M11 59h18" stroke="#1a1f3a" stroke-width="4" stroke-linecap="round"/></svg>';

  // Stable countdowns: re-render only when the deadline really moves.
  const deadlines = {};
  function deadline(key, endsIn) { const d = Date.now() + (endsIn || 0), c = deadlines[key]; if (c && Math.abs(c - d) < 1500) return c; deadlines[key] = d; return d; }
  const tspan = (d, cls = '') => `<span class="timer pt-timer ${cls}" data-ends="${d}">${BOX.mmss(d - Date.now())}</span>`;
  // TV: rebuild a screen only when its signature changes; returns true when rebuilt.
  function put(el, sig, html) {
    const w = el.firstElementChild;
    if (w && w.classList.contains('pt-root') && w.dataset.sig === sig && el.children.length === 1) return false;
    el.innerHTML = `<div class="pt-root pt-tv" data-sig="${esc(sig)}">${html}</div>`;
    return true;
  }
  const setHtml = (node, html) => { if (node && node.dataset.h !== html) { node.dataset.h = html; node.innerHTML = html; } };

  // Recorded sound effects (public/audio/sfx/pitch/, see credits.json there), quiet, on the TV.
  const rec = (f, o) => !!(BOX.audio && BOX.audio.clip && BOX.audio.clip('pitch/' + f + '.ogg', o));
  let warmed = false;
  const warm = () => { if (!warmed && rec('ding', { vol: 0, gap: 0 })) { warmed = true; for (const f of ['mic', 'slide', 'ooh', 'applause']) rec(f, { vol: 0, gap: 0 }); } };

  // ---------- drawings ----------
  function paintCv(cv, strokes, key, animate) {
    const k = KIT(); if (!cv || !k) return;
    if (cv._pk === key) return; cv._pk = key;
    if (animate && strokes && strokes.length) k.replay(cv, strokes, Math.min(2600, 700 + strokes.length * 110)); else k.paint(cv, strokes || []);
  }

  // ---------- the phone sketchpad: draw the other player's slides ----------
  const pad = { ov: null, key: null, slides: [[]], cur: 0, redo: [], color: 0, size: 1, tool: 'pen', stroke: null, deadline: 0, sending: false, tick: 0, ctx: null, task: null, warned: false };
  function closePad() { if (pad.ov) { pad.ov.remove(); pad.ov = null; } clearInterval(pad.tick); pad.tick = 0; pad.key = null; pad.stroke = null; pad.sending = false; window.removeEventListener('resize', layoutPad); }
  function layoutPad() {
    if (!pad.ov) return; const k = KIT(); const ov = pad.ov, cv = ov.querySelector('.pt-pad');
    const used = ov.querySelector('.pt-padhead').offsetHeight + ov.querySelector('.pt-tools').offsetHeight + ov.querySelector('.pt-padfoot').offsetHeight + 40;
    const side = Math.max(150, Math.floor(Math.min(ov.clientWidth - 24, ov.clientHeight - used, 700)));
    cv.style.width = cv.style.height = side + 'px'; if (k) k.paint(cv, pad.slides[pad.cur]);
  }
  function toolsHtml() {
    const k = KIT(); if (!k) return '';
    const sw = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10].map((i) => `<button class="pt-sw ${pad.tool !== 'eraser' && pad.color === i ? 'on' : ''}" data-col="${i}" style="--sw:${k.INK[i]}" aria-label="${k.NAMES[i]}"></button>`).join('');
    const sizes = [1, 2, 3].map((i) => `<button class="pt-size ${pad.size === i ? 'on' : ''}" data-size="${i}" aria-label="Brush ${i}"><i style="width:${6 + i * 6}px;height:${6 + i * 6}px"></i></button>`).join('');
    const t = (key, label, dis) => `<button class="pt-tool ${pad.tool === key ? 'on' : ''}" data-tool="${key}" ${dis ? 'disabled' : ''}>${k.TOOL_ART[key]}<span>${label}</span></button>`;
    const s = pad.slides[pad.cur];
    return `<div class="pt-colors">${sw}</div><div class="pt-toolrow">${sizes}${t('pen', 'Pen')}${t('fill', 'Fill')}${t('eraser', 'Eraser')}${t('undo', 'Undo', !s.length)}${t('clear', 'Clear', !s.length)}</div>`;
  }
  function bindTools() {
    const ov = pad.ov; if (!ov) return; const k = KIT();
    const box = ov.querySelector('.pt-tools'); box.innerHTML = toolsHtml();
    const hap = (x) => { try { pad.ctx.haptic(x); } catch { /* none */ } };
    for (const b of box.querySelectorAll('[data-col]')) b.onclick = () => { pad.color = Number(b.dataset.col); if (pad.tool === 'eraser') pad.tool = 'pen'; hap('select'); bindTools(); };
    for (const b of box.querySelectorAll('[data-size]')) b.onclick = () => { pad.size = Number(b.dataset.size); if (pad.tool === 'fill') pad.tool = 'pen'; hap('select'); bindTools(); };
    for (const b of box.querySelectorAll('[data-tool]')) b.onclick = () => {
      const t = b.dataset.tool, cv = ov.querySelector('.pt-pad'), s = pad.slides[pad.cur];
      if (t === 'pen' || t === 'fill' || t === 'eraser') { pad.tool = t; hap('select'); }
      if (t === 'undo' && s.length) { s.pop(); k.paint(cv, s); BOX.sfx('click'); }
      if (t === 'clear' && s.length) { pad.slides[pad.cur] = []; k.paint(cv, []); BOX.sfx('poof'); hap('warn'); }
      bindTools();
    };
  }
  function tabsHtml() {
    const T = pad.task; if (!T || T.heads.length < 2) return `<div class="pt-padslide">${esc(T ? T.heads[0] : '')}</div>`;
    return `<div class="pt-tabs">${T.heads.map((h, i) => `<button class="pt-tab ${i === pad.cur ? 'on' : ''} ${pad.slides[i].length ? 'has' : ''}" data-tab="${i}"><b>${i + 1}</b><span>${esc(h)}</span></button>`).join('')}</div>`;
  }
  function bindTabs() {
    const ov = pad.ov; if (!ov) return;
    setHtml(ov.querySelector('.pt-tabwrap'), tabsHtml());
    for (const b of ov.querySelectorAll('[data-tab]')) b.onclick = () => { pad.cur = Number(b.dataset.tab); pad.stroke = null; KIT().paint(ov.querySelector('.pt-pad'), pad.slides[pad.cur]); bindTabs(); bindTools(); try { pad.ctx.haptic('select'); } catch { /* none */ } };
    const last = pad.cur >= pad.task.heads.length - 1, done = ov.querySelector('.pt-done');
    done.textContent = last ? 'Send slides ✓' : `Next: slide ${pad.cur + 2} ▶`;
  }
  function openPad(task, endsIn, ctx) {
    closePad(); const k = KIT(); if (!k) return;
    Object.assign(pad, { key: task.key, task, slides: task.heads.map(() => []), cur: 0, tool: 'pen', ctx, deadline: Date.now() + endsIn, warned: false, sending: false });
    const ov = document.createElement('div'); ov.className = 'pt-over';
    ov.innerHTML = `<div class="pt-padhead"><div class="pt-padlab">✏️ Draw ${esc(task.opp.name)}’s ${task.heads.length > 1 ? 'slides' : esc(task.heads[0].toLowerCase())} <span class="timer" data-ends="${pad.deadline}">${BOX.mmss(endsIn)}</span></div>
        <div class="pt-padtopic"><b>${esc(task.oppTopic.n)}</b> <span>${esc(task.oppTopic.l)}</span></div><div class="pt-tabwrap"></div>
        <div class="pt-padtip">They’ll see it for the first time on the TV. Make it hard to explain 😈</div></div>
      <div class="pt-padwrap"><canvas class="pt-pad"></canvas></div><div class="pt-tools"></div>
      <div class="pt-padfoot"><button class="pt-done">Send ✓</button></div>`;
    document.body.appendChild(ov); pad.ov = ov;
    bindTools(); bindTabs();
    const cv = ov.querySelector('.pt-pad'); cv.style.touchAction = 'none';
    const pt = (e) => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1000, Math.round(((e.clientX - r.left) / r.width) * 1000))), Math.max(0, Math.min(1000, Math.round(((e.clientY - r.top) / r.height) * 1000)))]; };
    const pts = (list) => list.reduce((n, s) => n + s.p.length / 2, 0);
    const seg = (s, x0, y0, x1, y1) => {
      const g = cv.getContext('2d'), kk = cv.width / 1000;
      g.strokeStyle = g.fillStyle = k.colorOf(s.c); g.lineWidth = Math.max(1, k.SIZES[s.s] * kk); g.lineCap = 'round'; g.lineJoin = 'round';
      if (x0 === x1 && y0 === y1) { g.beginPath(); g.arc(x0 * kk, y0 * kk, g.lineWidth / 2, 0, Math.PI * 2); g.fill(); return; }
      g.beginPath(); g.moveTo(x0 * kk, y0 * kk); g.lineTo(x1 * kk, y1 * kk); g.stroke();
    };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); if (pad.sending) return;
      const s = pad.slides[pad.cur]; if (s.length >= 300 || pts(s) > 3900) { ctx.toast('This slide is full! Try the next one.'); return; }
      const [x, y] = pt(e);
      if (pad.tool === 'fill') {
        if (s.filter((q) => q.f).length >= 30) { ctx.toast('That’s a lot of paint!'); return; }
        const st = { c: pad.color, s: 0, f: 1, p: [x, y] }; s.push(st); k.floodFill(cv.getContext('2d'), cv.width, x * cv.width / 1000, y * cv.width / 1000, k.colorOf(st.c)); ctx.haptic('tap'); if (s.length === 1) bindTools(); bindTabs(); return;
      }
      try { cv.setPointerCapture(e.pointerId); } catch { /* old browser */ }
      pad.stroke = { c: pad.tool === 'eraser' ? k.ERASER : pad.color, s: pad.size, p: [x, y] }; s.push(pad.stroke); seg(pad.stroke, x, y, x, y);
      if (s.length === 1) { bindTools(); bindTabs(); }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!pad.stroke) return; e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs.length ? evs : [e]) {
        const s = pad.stroke, [x, y] = pt(ev), lx = s.p[s.p.length - 2], ly = s.p[s.p.length - 1];
        if (Math.hypot(x - lx, y - ly) < 5) continue;
        if (pts(pad.slides[pad.cur]) > 3990) { pad.stroke = null; return; }
        s.p.push(x, y); seg(s, lx, ly, x, y);
      }
    });
    const up = () => { pad.stroke = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', up);
    ov.querySelector('.pt-done').onclick = () => {
      if (pad.cur < pad.task.heads.length - 1) { pad.cur++; pad.stroke = null; k.paint(cv, pad.slides[pad.cur]); bindTabs(); bindTools(); ctx.haptic('select'); return; }
      if (!pad.slides.some((s) => s.length) && !confirm('Send blank slides? (They’ll have to explain those too!)')) return;
      sendPad(false);
    };
    window.addEventListener('resize', layoutPad); requestAnimationFrame(layoutPad);
    pad.tick = setInterval(() => {
      if (!pad.ov) return; const left = pad.deadline - Date.now();
      pad.ov.classList.toggle('hurry', left < 8000);
      if (left < 8000 && !pad.warned) { pad.warned = true; try { ctx.haptic('warn'); } catch { /* none */ } }
      if (left < 900 && !pad.sending) sendPad(true);
      if (left < -6000) closePad();
    }, 200);
  }
  async function sendPad(auto) {
    if (!pad.ov || pad.sending) return; pad.sending = true; pad.stroke = null;
    const ctx = pad.ctx, key = pad.key; pad.ov.querySelector('.pt-done').textContent = 'Sending…';
    const r = await ctx.act({ op: 'slides', strokes: pad.slides });
    if (pad.key !== key) return;
    if (r.ok) { closePad(); ctx.sfx('pop'); ctx.haptic('success'); if (auto) ctx.toast('⏰ Time! Your slides were sent.'); }
    else if (auto) closePad(); else { pad.sending = false; bindTabs(); }
  }

  // ---------- phone ----------
  const buzzed = new Set(); let epoch = 0, lastPh = null;
  const buzz = (ctx, key, kind) => { const k = epoch + ':' + key; if (buzzed.has(k)) return; buzzed.add(k); if (buzzed.size > 400) buzzed.clear(); try { ctx.haptic(kind); } catch { /* none */ } };
  let customDraft = '', askDraft = '';
  const head = (v) => `<div class="pt-me"><span><b>${v.points}</b> pts${v.rank ? ` · #${v.rank} of ${v.players}` : ''}</span>${v.n ? `<span class="pt-chip">${v.round ? esc(v.round) + ' · ' : ''}match ${v.n}${v.of ? '/' + v.of : ''}</span>` : ''}</div>`;
  const modeBadge = (md) => (md ? `<div class="pt-mode m-${md.key}"><span class="pt-mi">${md.icon}</span><b>${esc(md.name)}</b><small>${esc(md.short)}</small></div>` : '');
  const topicCard = (t, cls = '') => (t ? `<div class="pt-topic ${cls}"><b>${esc(t.n)}</b><span>${esc(t.l)}</span></div>` : '');
  function phone(el, v, ctx) {
    if (!v) return;
    if (lastPh === 'over' && v.phase !== 'over') epoch++;
    lastPh = v.phase;
    // The sketchpad: during prep, until the slides are sent.
    if (v.phase === 'prep' && v.task && !v.task.sent) { if (pad.key !== v.task.key || !pad.ov) { openPad(v.task, v.endsIn, ctx); buzz(ctx, 'pad:' + v.task.key, 'turn'); } }
    else if (pad.ov && !pad.sending) closePad();
    haptics(v, ctx);
    BOX.morph(el, `<div class="pt-root pt-phone">${screen(v)}</div>`);
    bind(el, v, ctx);
  }
  function haptics(v, ctx) {
    if (v.phase === 'match' && v.side >= 0) buzz(ctx, 'up:' + v.n, 'turn');
    if (v.phase === 'ready' && v.role === 'pres') buzz(ctx, 'on:' + v.n + ':' + v.half, 'big');
    if (v.phase === 'pitch' && v.role === 'pres' && v.cue) buzz(ctx, 'cue:' + v.cue.id, 'buzz');
    if (v.phase === 'pitch' && v.panel) buzz(ctx, 'panel:' + v.panel.id, 'big');
    if (v.phase === 'vote' && v.canVote) buzz(ctx, 'vote:' + v.n, 'turn');
    if (v.phase === 'result' && v.won) buzz(ctx, 'won:' + v.n, 'win');
    if (v.phase === 'result' && v.lost) buzz(ctx, 'lost:' + v.n, 'error');
    if (v.phase === 'over') buzz(ctx, 'over', v.rank === 1 ? 'win' : 'success');
  }
  function screen(v) {
    const H = head(v);
    if (v.phase === 'over') {
      const aw = (v.awards || []).map((a) => `<div class="pt-award"><span>${a.icon}</span><div><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></div></div>`).join('');
      return `${H}<div class="pt-card pt-hero"><div class="pt-big">#${v.rank}</div><h3>${v.rank === 1 ? 'Champion of the pitch!' : 'That’s a wrap!'}</h3><p>${v.wins} match win${v.wins === 1 ? '' : 's'} · <b>${v.points}</b> points</p></div>
        ${aw ? `<div class="pt-card"><h3>Your awards</h3>${aw}</div>` : ''}<div class="pt-card"><h3>Final scores</h3>${BOX.board(v.final, (r) => r.points, '')}</div>`;
    }
    if (!v.mode) return `${H}<div class="pt-card pt-hero">${MIC}<h3>${v.phase === 'bracket' ? 'The bracket moves on…' : 'Places, everyone!'}</h3><p>${v.bye ? 'You have a <b>bye</b>: straight through to the next round!' : v.alive ? 'You’re still in the running. Watch the TV.' : 'Watch the TV.'}</p></div>`;
    const me = v.side >= 0, opp = v.side === 0 ? v.b : v.a;
    if (v.phase === 'match') {
      return `${H}${modeBadge(v.mode)}<div class="pt-card pt-hero">${me ? `<h3>You’re up!</h3><p>vs <b>${nm(opp.name)}</b></p><p class="muted">First you draw ${nm(opp.name)}’s ${v.mode.visuals > 1 ? 'slides' : esc(v.mode.visual.toLowerCase())}, then you pitch.</p>` : `<h3>Next match</h3><div class="pt-vs">${fc(v.a, 52)}<b>${nm(v.a.name)}</b><i>vs</i><b>${nm(v.b.name)}</b>${fc(v.b, 52)}</div>`}</div>`;
    }
    if (v.phase === 'prep') {
      if (me) return `${H}<div class="pt-card pt-hero"><h3>Slides sent ✓</h3><p class="muted">Now get ready for <b>your</b> pitch:</p>${topicCard(v.myTopic)}<p class="muted">You’ll see the slides ${nm(opp.name)} drew for you on the TV, for the first time, live.</p></div>`;
      return `${H}${modeBadge(v.mode)}<div class="pt-card pt-hero"><h3>Backstage…</h3><p><b>${nm(v.a.name)}</b> and <b>${nm(v.b.name)}</b> are drawing each other’s ${v.mode.visuals > 1 ? 'slides' : esc(v.mode.visual.toLowerCase())}.</p></div>${askBox(v)}`;
    }
    if (v.phase === 'ready' || v.phase === 'pitch') {
      if (v.role === 'pres') return H + presenter(v);
      if (v.role === 'sab') return H + saboteur(v);
      return H + audience(v);
    }
    if (v.phase === 'vote') {
      if (!v.canVote) return `${H}<div class="pt-card pt-hero"><h3>The room is voting…</h3><p>No voting in your own match. Fingers crossed! 🤞</p></div>`;
      const book = v.mode.key === 'book';
      const opt = (i) => { const p = i ? v.b : v.a, t = v.topics[i]; return book
        ? `<div class="pt-rate"><div class="pt-ropt">${fc(p, 40)}<div><b>${esc(t.n)}</b><small>by ${nm(p.name)}</small></div></div><div class="pt-stars">${[1, 2, 3, 4, 5].map((n) => `<button class="pt-star ${v.myStars[i] >= n ? 'on' : ''}" data-star="${i}:${n}" aria-label="${n} stars">★</button>`).join('')}</div></div>`
        : `<button class="pt-vopt ${v.myVote === i ? 'sel' : ''}" data-vote="${i}">${fc(p, 56)}<div><b>${nm(p.name)}</b><small>${esc(t.n)}</small></div>${v.myVote === i ? '<i>✓</i>' : ''}</button>`; };
      return `${H}<div class="pt-vq">${esc(v.mode.vote)} ${tspan(deadline('v' + v.n, v.endsIn))}</div>${opt(0)}${opt(1)}
        <div class="pt-nasty"><span>😈 Nastiest saboteur?</span><button class="${v.myNasty === 1 ? 'sel' : ''}" data-nasty="1">${nm(v.b.name)}</button><button class="${v.myNasty === 0 ? 'sel' : ''}" data-nasty="0">${nm(v.a.name)}</button></div>
        <p class="muted pt-center">${book ? 'Give both books 1–5 stars. Stars count as votes.' : 'Tap who sold it better. You can change your mind.'}</p>`;
    }
    if (v.phase === 'result') {
      return `${H}<div class="pt-card pt-hero ${v.won ? 'win' : ''}">${v.won ? '<div class="pt-big">🏆</div><h3>You won the match!</h3>' : v.lost ? '<h3>So close!</h3><p>' + nm(v.winner ? v.winner.name : '') + ' takes it.</p>' : `<h3>${v.winner ? nm(v.winner.name) + ' wins!' : 'The votes are in'}</h3>`}${v.walkover ? '<p class="muted">(by walkover)</p>' : ''}${v.gain ? `<p class="pt-gain">+${v.gain} points</p>` : ''}</div>`;
    }
    return H;
  }
  function presenter(v) {
    if (v.phase === 'ready') return `<div class="pt-card pt-hero pt-on"><div class="pt-onair">ON AIR</div><h3>You’re on! Step up to the TV.</h3>${topicCard(v.topic, 'big')}<p class="muted">You are the ${esc(v.mode.role)}. ${esc(v.mode.key === 'deck' ? 'Explain every slide like you meant it.' : '')}</p></div>`;
    const c = v.cue, K = c ? kindOf(c.kind) : null;
    return `${topicCard(v.topic)}<div class="pt-prompter ${c ? 'k-' + c.kind : ''} ${c && !c.acked ? 'fresh' : ''}" data-cue="${c ? c.id : 0}">${c ? `<div class="pt-pk">${K.i} ${esc(K.t)}</div><div class="pt-ph">${esc(K.how)}</div><div class="pt-ptext">${esc(c.text)}</div>${c.by && c.by !== 'custom' ? `<div class="pt-pby">from ${nm(c.by)}</div>` : ''}
        ${c.acked ? '<div class="pt-pdone">✓ Nailed it</div>' : '<button class="pt-btn pt-ack" data-ack="' + c.id + '">Done it ✓</button>'}` : `<div class="pt-pk">🎤 You’re pitching</div><div class="pt-ptext small">Talk to the room! Cue cards from backstage will flash up here. Do what they say.</div>`}</div>
      <div class="pt-row">${v.slide ? `<span class="pt-chip">Slide ${v.slide.i + 1}/${v.slide.of} on screen</span>` : '<span class="pt-chip">Title slide on screen</span>'}<button class="pt-link" data-end ${v.canEnd ? '' : 'disabled'}>End my pitch</button></div>`;
  }
  function saboteur(v) {
    if (v.phase === 'ready') return `<div class="pt-card pt-hero pt-dark"><h3>You’re backstage 😈</h3><p><b>${nm(v.pres.name)}</b> is about to pitch:</p>${topicCard(v.topic)}<p class="muted">Get your cue cards ready…</p></div>`;
    const cool = v.coolIn > 0, d = cool ? deadline('cool' + v.sent, v.coolIn) : 0;
    const cards = v.hand.map((c, i) => { const K = kindOf(c.kind); return `<button class="pt-hcard k-${c.kind}" data-card="${i}" ${cool ? 'disabled' : ''}><span class="pt-hk">${K.i} ${esc(K.t)}</span><span class="pt-ht">${esc(c.text)}</span></button>`; }).join('');
    const asks = v.asks.length ? `<div class="pt-asks"><div class="pt-lab">🗞️ From the press (the audience)</div>${v.asks.map((q, i) => `<button class="pt-ask" data-ask="${i}" ${cool ? 'disabled' : ''}><b>${nm(q.name)}:</b> ${nm(q.text)}</button>`).join('')}</div>` : '';
    const nextBtn = v.slidesLeft > 0 ? `<button class="pt-btn pt-next" data-next>▶ Show ${v.slidesOf > 1 ? `slide ${v.slideNo + 1}: ${esc(v.heads[v.slideNo] || '')}` : esc(v.heads[0])}</button>` : v.slidesOf ? `<div class="pt-chip pt-allshown">${v.slidesOf > 1 ? 'All slides shown' : esc(v.heads[0]) + ' is on screen'} ✓</div>` : '';
    return `<div class="pt-desk"><div class="pt-desktop"><span>😈 Backstage: sabotage <b>${nm(v.pres.name)}</b></span>${cool ? `<span class="pt-cool">next card in ${tspan(d)}</span>` : '<span class="pt-rdy">ready!</span>'}</div>
      ${nextBtn}${asks}<div class="pt-hand ${cool ? 'cool' : ''}">${cards}</div>
      <div class="pt-custom"><input id="pt-cin" maxlength="80" placeholder="${esc(v.customKind === 'question' ? 'Ask your own question…' : v.customKind === 'quote' ? 'Write a quote from their book…' : 'Write your own cue…')}" value="${esc(customDraft)}" autocomplete="off" enterkeyhint="send"><button class="pt-btn small" data-custom ${cool ? 'disabled' : ''}>Send</button></div>
      <button class="pt-link" data-redeal>🔄 New cards</button></div>`;
  }
  function askBox(v) {
    if (!v.mode || v.mode.key !== 'press') return '';
    if (!v.canAsk) return `<div class="pt-card"><p class="muted pt-center">🗞️ Your question is with the saboteur. Will they ask it?</p></div>`;
    return `<div class="pt-card pt-askbox"><div class="pt-lab">🗞️ You’re the press! Send in a question:</div><input id="pt-ain" maxlength="80" placeholder="Is it true about the goose?" value="${esc(askDraft)}" autocomplete="off" enterkeyhint="send"><button class="pt-btn small" data-asksend>Send to backstage</button></div>`;
  }
  function audience(v) {
    if (v.phase === 'ready') return `<div class="pt-card pt-hero">${MIC}<h3>Up next</h3><p><b>${nm(v.pres.name)}</b>, the ${esc(v.mode.role)}:</p>${topicCard(v.topic)}<p class="muted">Backstage: ${nm(v.sab.name)} 😈</p></div>${askBox(v)}`;
    const panel = v.panel ? `<div class="pt-panelcall"><div class="pt-pk">🙋 You’re a panelist!</div><p>Shout this out, loud:</p><div class="pt-ptext">“${esc(v.panel.text)}”</div><button class="pt-btn" data-said="${v.panel.id}">I said it! ✓</button></div>` : '';
    return `${panel}<div class="pt-card pt-center"><p><b>${nm(v.pres.name)}</b> is pitching <b>${esc(v.topic.n)}</b></p><p class="muted">React live on the big screen:</p>
      <div class="pt-reacts">${v.reacts.map((e) => `<button data-rx="${e}" aria-label="React ${e}">${e}</button>`).join('')}</div></div>${askBox(v)}`;
  }
  function bind(el, v, ctx) {
    const on = (sel, fn) => { for (const b of el.querySelectorAll(sel)) b.onclick = (e) => fn(b, e); };
    on('[data-rx]', (b) => { ctx.act({ op: 'react', e: b.dataset.rx }); ctx.haptic('tap'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); });
    on('[data-ack]', async (b) => { const r = await ctx.act({ op: 'ack', id: Number(b.dataset.ack) }); if (r.ok) { ctx.haptic('success'); ctx.sfx('pop'); } });
    on('[data-end]', async () => { if (!confirm('End your pitch now?')) return; const r = await ctx.act({ op: 'end' }); if (r.ok) ctx.haptic('select'); });
    on('[data-next]', async () => { const r = await ctx.act({ op: 'next' }); if (r.ok) { ctx.haptic('select'); ctx.sfx('click'); } });
    on('[data-card]', async (b) => { const r = await ctx.act({ op: 'cue', i: Number(b.dataset.card) }); if (r.ok) { ctx.haptic('success'); ctx.sfx('pop'); } });
    on('[data-ask]', async (b) => { const r = await ctx.act({ op: 'cue', ask: Number(b.dataset.ask) }); if (r.ok) { ctx.haptic('success'); ctx.sfx('pop'); } });
    on('[data-redeal]', async () => { const r = await ctx.act({ op: 'redeal' }); if (r.ok) { ctx.sfx('shuffle'); ctx.haptic('select'); } });
    on('[data-said]', async (b) => { const r = await ctx.act({ op: 'said', id: Number(b.dataset.said) }); if (r.ok) { ctx.haptic('success'); ctx.sfx('chime'); } });
    on('[data-vote]', (b) => { ctx.act({ op: 'vote', side: Number(b.dataset.vote) }); ctx.haptic('select'); ctx.sfx('click'); });
    on('[data-nasty]', (b) => { ctx.act({ op: 'nasty', side: Number(b.dataset.nasty) }); ctx.haptic('select'); });
    on('[data-star]', (b) => { const [side, n] = b.dataset.star.split(':').map(Number); ctx.act({ op: 'stars', side, n }); ctx.haptic('select'); ctx.sfx('click'); });
    const cin = el.querySelector('#pt-cin');
    if (cin) {
      cin.oninput = () => { customDraft = cin.value; };
      const go = async () => { customDraft = cin.value; const r = await ctx.act({ op: 'custom', text: customDraft }); if (r.ok) { customDraft = ''; cin.value = ''; cin.blur(); ctx.haptic('success'); ctx.sfx('pop'); } };
      on('[data-custom]', go); cin.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    }
    const ain = el.querySelector('#pt-ain');
    if (ain) {
      ain.oninput = () => { askDraft = ain.value; };
      const go = async () => { askDraft = ain.value; const r = await ctx.act({ op: 'ask', text: askDraft }); if (r.ok) { askDraft = ''; ain.blur(); ctx.haptic('success'); ctx.toast('🗞️ Sent backstage!'); } };
      on('[data-asksend]', go); ain.onkeydown = (e) => { if (e.key === 'Enter') go(); };
    }
  }
  const lobbyPhone = () => `<div class="pt-card pt-lobbynote">${MIC}<b>Warm up your pitch voice!</b><p>You’ll present to the room while a rival sabotages you from their phone, then swap.</p></div>`;

  // ---------- TV ----------
  const LIGHTS = `<div class="pt-hall" aria-hidden="true"><i class="pt-beam a"></i><i class="pt-beam b"></i><i class="pt-beam c"></i><div class="pt-curtain l"></div><div class="pt-curtain r"></div><div class="pt-floor"></div></div>`;
  const topbar = (s, extra = '') => `<header class="pt-top">${s.mode ? `<span class="pt-modechip m-${s.mode.key}">${s.mode.icon} ${esc(s.mode.name)}</span>` : ''}<span class="pt-roundchip">${s.round ? esc(s.round) + ' · ' : ''}Match ${s.n}${s.of ? ' of ' + s.of : ''}</span>${extra}</header>`;
  function slideInner(h, mode, cvCls = 'pt-slidecv') {
    const t = h.topic || { n: '', l: '' };
    if (!h.slide) { // the title slide (nothing drawn shown yet)
      if (mode === 'book') return `<div class="pt-cover title"><div class="pt-cv-title">${esc(t.n)}</div><div class="pt-cv-sub">${esc(t.l)}</div><div class="pt-cv-auth">by ${nm(h.pres.name)}</div></div>`;
      if (mode === 'press') return `<div class="pt-presswall"><div class="pt-seal">PRESS<br>BRIEFING</div><div class="pt-pr-who">${esc(t.n)}</div><div class="pt-pr-what">Statement on: ${esc(t.l)}</div></div>`;
      if (mode === 'tv') return `<div class="pt-infotitle"><div class="pt-asseen">AS SEEN ON LATE-NIGHT TV</div><div class="pt-it-name">${esc(t.n)}</div><div class="pt-it-sub">${esc(t.l)}</div></div>`;
      if (mode === 'focus') return `<div class="pt-wb"><div class="pt-wb-lab">FOCUS GROUP · CONFIDENTIAL</div><div class="pt-wb-name">${esc(t.n)}</div><div class="pt-wb-sub">${esc(t.l)}</div></div>`;
      return `<div class="pt-deck title"><div class="pt-dk-logo">${MIC}</div><div class="pt-dk-name">${esc(t.n)}</div><div class="pt-dk-sub">${esc(t.l)}</div><div class="pt-dk-by">${nm(h.pres.name)}, Founder &amp; CEO</div></div>`;
    }
    const blank = !h.slide.strokes || !h.slide.strokes.length;
    const art = `<div class="pt-art"><canvas class="${cvCls}"></canvas>${blank ? '<div class="pt-blank">(this one is blank. Explain it anyway!)</div>' : ''}</div>`;
    if (mode === 'deck') return `<div class="pt-deck"><div class="pt-dk-head"><b>${h.slide.i + 1}</b>${esc(h.slide.head)}</div>${art}<div class="pt-dk-foot">${esc(t.n)} · confidential</div></div>`;
    if (mode === 'book') return `<div class="pt-cover"><div class="pt-cv-title">${esc(t.n)}</div>${art}<div class="pt-cv-auth">by ${nm(h.pres.name)}</div></div>`;
    if (mode === 'press') return `<div class="pt-exhibit"><div class="pt-ex-tag">EXHIBIT A</div><div class="pt-polaroid">${art}</div><i class="pt-tape a"></i><i class="pt-tape b"></i></div>`;
    if (mode === 'tv') return `<div class="pt-infoshot"><div class="pt-asseen">${esc(t.n)}</div>${art}<div class="pt-call">CALL NOW · OPERATORS ARE STANDING BY</div></div>`;
    return `<div class="pt-wb proto"><div class="pt-wb-lab">THE PROTOTYPE</div>${art}</div>`;
  }
  // The cue card that flies in over the screen when the saboteur sends one (then lands in the feed).
  let flashT = 0, seenCue = 0, seenPanel = 0, lastSlideKey = '';
  function flashCue(root, c, panel) {
    const f = root.querySelector('.pt-flash'); if (!f) return;
    const K = kindOf(c.kind);
    f.className = `pt-flash on k-${c.kind}`;
    f.innerHTML = c.kind === 'caller' ? `<div class="pt-fl-k">📞 CALLER ON LINE 1</div><div class="pt-fl-t">“${esc(c.text)}”</div>`
      : c.kind === 'question' ? `<div class="pt-fl-k">🗞️ ${c.by && c.by !== 'custom' ? 'QUESTION FROM ' + nm(c.by).toUpperCase() : 'REPORTER'}</div><div class="pt-fl-t">${esc(c.text)}</div>`
      : c.kind === 'panel' ? `<div class="pt-fl-k">🙋 PANELIST${panel ? ' ' + nm(panel.name).toUpperCase() : ''}</div><div class="pt-fl-t">“${esc(c.text)}”</div>`
      : `<div class="pt-fl-k">${K.i} ${esc(K.t.toUpperCase())}</div><div class="pt-fl-t">${esc(c.text)}</div>`;
    clearTimeout(flashT); flashT = setTimeout(() => { f.className = 'pt-flash'; }, 5200);
  }
  const feedHtml = (h) => (h.feed.length ? h.feed.slice().reverse().map((c, i) => { const K = kindOf(c.kind); return `<li class="k-${c.kind} ${i === 0 ? 'new' : ''} ${c.acked ? 'ok' : ''}"><span class="pt-fk">${K.i} ${esc(K.t)}</span><span class="pt-ft">${esc(c.text)}</span>${c.acked ? '<em>✓ done</em>' : ''}</li>`; }).join('') : '<li class="pt-empty">Nothing sent… yet.</li>');

  function tv(el, s, ctx) {
    if (!s) return; warm();
    if (s.phase === 'over') return tvOver(el, s);
    if (s.phase === 'bracket') { put(el, 'bracket:' + JSON.stringify(s.bracket), `${LIGHTS}<div class="pt-brwrap"><h1 class="pt-h1">The bracket</h1>${bracketHtml(s.bracket)}<p class="pt-sub">Next round coming up…</p></div>`); return; }
    if (!s.mode) return;
    const A = s.a, B = s.b, md = s.mode;
    if (s.phase === 'match') {
      put(el, 'match:' + s.n, `${LIGHTS}${topbar(s)}<div class="pt-matchup"><div class="pt-mu-mode m-${md.key}"><span>${md.icon}</span><b>${esc(md.name)}</b><small>${esc(md.short)}</small></div>
        <div class="pt-mu-row"><div class="pt-mu-p l">${bd(A, 300, { mood: 'grin' })}<b>${nm(A.name)}</b></div><div class="pt-mu-vs">VS</div><div class="pt-mu-p r">${bd(B, 300, { mood: 'grin', flip: true })}<b>${nm(B.name)}</b></div></div>
        <p class="pt-sub">Each pitches once while the other sabotages from backstage. Then the room votes.</p></div>`);
      return;
    }
    if (s.phase === 'prep') {
      const desk = (p, other, done) => `<div class="pt-desk-tv ${done ? 'done' : ''}">${fc(p, 120)}<b>${nm(p.name)}</b><span>${done ? '✓ Slides ready' : `✏️ drawing ${nm(other.name)}’s ${md.visuals > 1 ? 'slides' : esc(md.visual.toLowerCase())}…`}</span></div>`;
      put(el, `prep:${s.n}:${s.drawn.join()}`, `${LIGHTS}${topbar(s, `<span class="pt-tr">${tspan(deadline('prep' + s.n, s.endsIn))}</span>`)}<div class="pt-prep"><h1 class="pt-h1">BACKSTAGE</h1><p class="pt-sub">They’re drawing each other’s ${md.visuals > 1 ? md.visuals + ' slides' : esc(md.visual.toLowerCase())}. Nobody sees them until they’re on stage.</p>
        <div class="pt-desks">${desk(A, B, s.drawn[1])}<div class="pt-swapico">⇄</div>${desk(B, A, s.drawn[0])}</div>${md.key === 'press' ? '<p class="pt-tip">🗞️ Everyone else: you’re the press. Send in your questions from your phone!</p>' : ''}</div>`);
      return;
    }
    const h = s.h; if (!h) return voteOrResult(el, s);
    if (s.phase === 'ready') {
      put(el, `ready:${s.n}:${s.half}`, `${LIGHTS}${topbar(s)}<div class="pt-ready ${s.half ? 'swap' : ''}">${s.half ? '<div class="pt-swapbanner">SWAP!</div>' : ''}<div class="pt-spot"></div>
        <div class="pt-rd-body">${bd(h.pres, 380, { mood: 'grin' })}</div><div class="pt-rd-txt"><small>Now presenting: the ${esc(md.role)}</small><h2>${nm(h.pres.name)}</h2>${topicCard(h.topic, 'ontv')}<div class="pt-rd-sab">${fc(h.sab, 44)}<span>Backstage: <b>${nm(h.sab.name)}</b> 😈</span></div></div></div>`);
      return;
    }
    // ---- the live pitch ----
    const sig = `pitch:${s.n}:${s.half}`;
    if (put(el, sig, `${LIGHTS}${topbar(s, `<span class="pt-tr">${tspan(deadline('p' + s.n + ':' + s.half, s.endsIn), 'big')}</span>`)}
      <main class="pt-stage m-${md.key}"><section class="pt-left"><div class="pt-screen m-${md.key}"><div class="pt-slide"></div><div class="pt-pricetag" hidden></div><div class="pt-flash"></div><div class="pt-panelb" hidden></div></div>
        <div class="pt-podrow"><div class="pt-pres">${bd(h.pres, 230, { mood: 'grin' })}<div class="pt-bubble" hidden></div></div><div class="pt-podium">${MIC}<b>${nm(h.pres.name)}</b><span>${esc(h.topic.n)}</span></div>
        <div class="pt-meter"><small>Crowd</small><div class="pt-mbar"><i></i></div><span class="pt-cheers"></span></div></div></section>
        <aside class="pt-back"><div class="pt-bk-h">BACKSTAGE <i class="pt-live">● LIVE</i></div><div class="pt-bk-sab">${fc(h.sab, 64)}<div><b>${nm(h.sab.name)}</b><small>is pulling the strings</small></div></div><ol class="pt-feed"></ol><div class="pt-bk-foot">React on your phone! 👏 😂 😬 🔥 🍅</div></aside></main>`)) { lastSlideKey = ''; seenCue = h.cue ? h.cue.id : 0; seenPanel = 0; }
    const root = el.firstElementChild;
    const sk = `${s.n}:${s.half}:${h.slide ? h.slide.i : 't'}`;
    if (sk !== lastSlideKey) {
      const first = !lastSlideKey; lastSlideKey = sk;
      const sl = root.querySelector('.pt-slide'); sl.innerHTML = slideInner(h, md.key); sl.classList.remove('in'); void sl.offsetWidth; sl.classList.add('in');
      if (h.slide) paintCv(sl.querySelector('canvas'), h.slide.strokes, sk, !first);
    }
    const pt = root.querySelector('.pt-pricetag'); pt.hidden = !h.price; if (h.price) setHtml(pt, `<span>${esc(h.price)}</span>`);
    setHtml(root.querySelector('.pt-feed'), feedHtml(h));
    const bb = root.querySelector('.pt-bubble'); bb.hidden = !h.bubble; if (h.bubble) setHtml(bb, esc(h.bubble.text));
    const pb = root.querySelector('.pt-panelb'); pb.hidden = !h.panel;
    if (h.panel) setHtml(pb, `${fc({ id: h.panel.to, name: h.panel.name }, 40)}<span>🙋 Panelist <b>${nm(h.panel.name)}</b> ${h.panel.said ? 'said: “' + esc(h.panel.text) + '”' : 'has something to say…'}</span>`);
    if (h.panel && h.panel.id !== seenPanel) { seenPanel = h.panel.id; pb.classList.remove('pop'); void pb.offsetWidth; pb.classList.add('pop'); }
    if (h.cue && h.cue.id !== seenCue) { seenCue = h.cue.id; flashCue(root, h.cue, h.panel); }
    const meter = Math.max(0, Math.min(100, 50 + h.meter * 2.5));
    root.querySelector('.pt-mbar i').style.width = meter + '%';
    root.querySelector('.pt-cheers').textContent = h.cheers ? `👏 ${h.cheers}` : '';
  }
  function voteOrResult(el, s) {
    const md = s.mode, book = md.key === 'book', res = s.phase === 'result' ? s.result : null;
    const card = (i) => {
      const p = i ? s.b : s.a, t = s.topics[i], won = res && res.winner === i, n = res ? res.tally[i] : 0;
      return `<div class="pt-vcard ${won ? 'won' : res ? 'lost' : ''}" style="--i:${i}"><div class="pt-vthumb m-${md.key}"><canvas data-cover="${i}"></canvas></div>${fc(p, 84)}<b class="pt-vname">${nm(p.name)}</b><div class="pt-vtopic">${esc(t.n)}</div>
        ${res ? `<div class="pt-vtally">${book ? `${n} ★${res.avg && res.avg[i] ? ` <small>(avg ${res.avg[i]})</small>` : ''}` : `${n} vote${n === 1 ? '' : 's'}`}</div>${res.nasty[1 - i] ? `<div class="pt-vnasty">😈 ${res.nasty[1 - i]} nasty vote${res.nasty[1 - i] === 1 ? '' : 's'} for sabotaging</div>` : ''}<div class="pt-vgain">+${(res.gains || [])[i] || 0}</div>${won ? '<div class="pt-crown">🏆</div>' : ''}` : ''}</div>`;
    };
    const sig = `${s.phase}:${s.n}`;
    if (put(el, sig, `${LIGHTS}${topbar(s, res ? '' : `<span class="pt-tr">${tspan(deadline('vote' + s.n, s.endsIn), 'big')}</span>`)}<div class="pt-vote"><h1 class="pt-h1">${res ? (res.walkover ? 'Walkover!' : `${nm((res.winner ? s.b : s.a).name)} wins!`) : esc(md.vote)}</h1>
      <div class="pt-vrow">${card(0)}<div class="pt-vs2">VS</div>${card(1)}</div><p class="pt-sub pt-vstat">${res ? (res.tie === 'crowd' ? 'A tie on votes: the crowd meter decides!' : res.tie === 'coin' ? 'Dead even… a coin flip decides!' : '') : ''}</p>${res && !res.walkover ? '<div class="pt-confetti" aria-hidden="true">' + Array.from({ length: 30 }, (_, i) => `<i style="--x:${(i * 37) % 100};--d:${(i % 7) * 0.15}s;--c:${['#ff5a3c', '#18d4c8', '#ffc83d', '#fff'][i % 4]}"></i>`).join('') + '</div>' : ''}</div>`)) {
      const k = KIT(); for (const cv of el.querySelectorAll('canvas[data-cover]')) if (k) k.paint(cv, s.covers[Number(cv.dataset.cover)] || []);
    }
    if (!res) { const st = el.querySelector('.pt-vstat'); if (st) st.textContent = `${s.voted} / ${s.voters} voted${book ? ' (stars for both books)' : ''} · watchers can vote too`; }
  }
  function bracketHtml(B) {
    if (!B || !B.length) return '';
    const who = (x, w) => (x ? `<span class="pt-bn ${w === x.id ? 'w' : w ? 'l' : ''} ${x.here ? '' : 'gone'}">${fc(x, 30)}${nm(x.name)}</span>` : '<span class="pt-bn tbd">?</span>');
    return `<div class="pt-bracket">${B.map((R) => `<div class="pt-bcol"><h4>${esc(R.name || '')}</h4>${R.pairs.map((m) => `<div class="pt-bm ${m.live ? 'live' : ''}">${who(m.a, m.w)}${who(m.b, m.w)}${m.walkover ? '<small>walkover</small>' : ''}</div>`).join('')}${R.bye ? `<div class="pt-bm bye">${who(R.bye, R.bye.id)}<small>bye</small></div>` : ''}</div>`).join('')}</div>`;
  }
  function tvOver(el, s) {
    const c = s.champion;
    put(el, 'over:' + s.standings.map((r) => r.id + r.points).join(','), `${LIGHTS}<div class="pt-over-tv"><div class="pt-champ"><div class="pt-rays" aria-hidden="true"></div><small>Champion of the pitch</small>${c ? `<div class="pt-champfig">${bd(c, 300, { mood: 'grin' })}<span class="pt-trophy">🏆</span></div><h2>${nm(c.name)}</h2>` : ''}</div>
      <div class="pt-endgrid"><div class="pt-panel"><h3>Awards</h3>${(s.awards || []).map((a) => `<div class="pt-award onstage"><span>${a.icon}</span><div><small>${esc(a.title)}</small><b>${nm(a.name)}</b><em>${esc(a.detail)}</em></div></div>`).join('') || '<p class="muted">No awards this time.</p>'}</div>
      <div class="pt-panel"><h3>Final scores</h3>${BOX.board(s.standings, (r) => r.points, ' pts')}</div>
      <div class="pt-panel">${s.bracket ? `<h3>The bracket</h3>${bracketHtml(s.bracket)}` : `<h3>The matches</h3>${(s.history || []).map((x) => `<div class="pt-hist"><b>${nm(x.w ? x.w.name : '—')}</b> beat ${nm((x.w && x.w.id === x.a.id ? x.b : x.a).name)}<small>${esc(x.topics[0])} vs ${esc(x.topics[1])}</small></div>`).join('')}`}</div></div></div>`);
  }

  // ---------- TV lobby: the keynote hall ----------
  let lob = null;
  const optIdx = (f, v) => Math.max(0, f.options.findIndex((o) => String(o.value) === String(v)));
  const AGENDA_ICON = { mode: '🎭', format: '🏆', pitchSeconds: '⏱️', prepSeconds: '✏️', pack: '🍿', practice: '🎓', showIntro: '🎬' };
  function lobbyTv(el, L) {
    lob = L;
    if (!el.querySelector('.ptl')) {
      el.innerHTML = `<div class="ptl pt-root">${LIGHTS}
        <section class="ptl-left"><h1 class="ptl-logo"><span>Just</span>Pitch ${MIC}</h1><p class="ptl-tag">Sell it. Survive the sabotage. Win the room.</p>
          <div class="ptl-how"><div><b>1</b>🎤 Pitch to the room</div><div><b>2</b>😈 A rival drew your slides and sends cue cards</div><div><b>3</b>⇄ Swap, then the room votes</div></div>
          <h2 class="ptl-h">Tonight’s agenda <small>click a card to change it</small></h2><div class="settings ptl-agenda" id="settings"></div>
          <h2 class="ptl-h">Speakers <small class="ptl-count"></small></h2><div class="roster ptl-roster" id="roster"></div></section>
        <aside class="ptl-right"><div class="ptl-badge"><div class="ptl-lanyard"></div><div class="ptl-bh">SPEAKER PASS</div><img id="qr" alt="QR code to join"><div class="ptl-or">or go to <b id="ptl-url"></b></div><div class="ptl-codelab">room code</div><div class="ptl-code" id="code"></div></div>
          <div class="ptl-vip"></div><div class="ptl-lineup"></div><button class="ptl-start" id="start">🎤 <span>Start the show</span></button><div class="err ptl-err" id="lobby-err"></div>
          <div class="ptl-links"><button id="add-bots">+ 5 test bots</button><button id="rm-bots">remove bots</button><button id="ptl-pick">other game</button></div></aside></div>`;
      el.querySelector('#start').onclick = async () => { const r = await lob.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || 'Could not start.'; };
      el.querySelector('#add-bots').onclick = () => lob.bots(5);
      el.querySelector('#rm-bots').onclick = () => lob.removeBots && lob.removeBots();
      el.querySelector('#ptl-pick').onclick = () => lob.pick();
    }
    const qr = el.querySelector('#qr'); if (qr.dataset.u !== L.joinUrl) { qr.src = L.qr; qr.dataset.u = L.joinUrl; }
    const code = el.querySelector('#code'); if (code.textContent !== L.code) code.textContent = L.code;
    el.querySelector('#ptl-url').textContent = String(L.joinUrl || '').replace(/^https?:\/\//, '');
    const n = L.players.length;
    el.querySelector('.ptl-count').textContent = n ? `${n} in` : '';
    const st = el.querySelector('#start'); st.disabled = n < L.min;
    st.querySelector('span').textContent = n < L.min ? `Need ${L.min - n} more speaker${L.min - n === 1 ? '' : 's'}` : 'Start the show';
    BOX.morph(el.querySelector('.ptl-vip'), L.vip ? `<b>${esc(L.vip)}</b> is the host and can start from their phone` : 'The first person to join becomes the host');
    BOX.morph(el.querySelector('.ptl-lineup'), L.lineupHtml || '');
    const box = el.querySelector('#settings');
    if (!box.contains(document.activeElement)) {
      BOX.morph(box, L.fields.map((f, i) => { const v = L.settings[f.key], o = f.options[optIdx(f, v)] || { label: '' };
        return `<div class="ptl-item" data-k="${esc(f.key)}" style="--i:${i}"><span class="ptl-ico">${AGENDA_ICON[f.key] || '•'}</span><div class="ptl-lab">${esc(f.label)}</div><div class="ptl-val"><button class="ptl-arr" data-step="-1" aria-label="Previous">‹</button><span class="ptl-cur">${esc(o.label)}<select data-set="${esc(f.key)}" aria-label="${esc(f.label)}">${f.options.map((x) => `<option value="${esc(String(x.value))}" ${String(v) === String(x.value) ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></span><button class="ptl-arr" data-step="1" aria-label="Next">›</button></div></div>`; }).join(''));
    }
    for (const it of box.querySelectorAll('.ptl-item')) {
      const f = L.fields.find((x) => x.key === it.dataset.k); if (!f) continue;
      const sel = it.querySelector('select'); sel.onchange = () => { sel.blur(); lob.set(f.key, sel.value); BOX.sfx('click'); };
      for (const b of it.querySelectorAll('[data-step]')) b.onclick = (e) => { e.stopPropagation(); const cur = optIdx(f, lob.settings[f.key]), nx = f.options[(cur + Number(b.dataset.step) + f.options.length) % f.options.length]; lob.set(f.key, String(nx.value)); if (!rec('slide', { vol: 0.25 })) BOX.sfx('click'); };
    }
    BOX.morph(el.querySelector('#roster'), L.players.map((p) => `<div class="chip ptl-spk ${p.online ? '' : 'off'}" data-kick="${esc(p.id)}" title="Click to remove">${fc(p, 64)}<b>${esc(p.name)}</b></div>`).join('') || '<div class="ptl-empty">Scan the badge to join the lineup!</div>');
    for (const c of el.querySelectorAll('#roster [data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) lob.kick(c.dataset.kick); };
  }

  // Floating reactions over the stage.
  function floats() { let f = document.getElementById('pt-floats'); if (!f) { f = document.createElement('div'); f.id = 'pt-floats'; f.className = 'pt-floats'; document.body.appendChild(f); } return f; }

  BOX.games.pitch = {
    name: 'JustPitch', icon: '🎤',
    about: 'Pitch a ridiculous product, book or scandal to the room while a rival sabotages you from backstage: they drew your slides! Then swap. The room votes.',
    how: [
      'Each match puts two players on stage. One presents out loud to the room; the other is backstage on their phone, sabotaging.',
      'First you both draw on your phones: the slides (or book cover, product shot, Exhibit A) for the OTHER player’s pitch.',
      'Presenting? The TV is your screen. Explain each slide when it pops up, and do whatever the cue cards on your phone say.',
      'Backstage? Flip to the next slide, send cue cards, write your own. Then you swap and it’s your turn on stage.',
      'Everyone else is the audience: react live, shout panelist lines, send press questions, then vote. Most votes wins the match.',
      'Five modes: Focus Group, The Big Presentation, Buy My Book (rate with stars), Press Conference and Late-Night Infomercial. Big groups play a bracket.',
    ],
    music: (s) => ({ match: 'reveal', prep: 'think', ready: 'reveal', pitch: 'play', vote: 'tense', result: 'reveal', bracket: 'reveal', over: 'finale' }[s.phase] || 'play'),
    fx: { match: 'reveal', prep: 'start', ready: 'whoosh', swap: 'whoosh', vote: 'ballot', winner: 'cheer', walkover: 'shrug', bracket: 'drum', win: 'win', said: 'pop', ack: 'chime' },
    onFx(f) {
      // Each has a synth fallback if the recording is missing.
      if (f.kind === 'mic' && !rec('mic', { vol: 0.32 })) BOX.sfx('pop');
      if (f.kind === 'slide' && !rec('slide', { vol: 0.3 })) BOX.sfx('click');
      if (f.kind === 'cue' && !rec('ding', { vol: 0.26 })) BOX.sfx('chime');
      if (f.kind === 'panel') rec('ooh', { vol: 0.18 });
      if (f.kind === 'winner') { rec('applause', { vol: 0.3 }); rec('ooh', { vol: 0.14, delay: 0.2 }); }
      if (f.kind !== 'react') return;
      const e = document.createElement('div'); e.className = 'pt-float'; e.textContent = f.e;
      e.style.left = 6 + Math.random() * 60 + '%'; e.style.setProperty('--dx', (Math.random() * 80 - 40).toFixed(0) + 'px');
      floats().appendChild(e); setTimeout(() => e.remove(), 2600);
    },
    tv, phone, lobbyTv, lobby: lobbyPhone,
  };
})();
