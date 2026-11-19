'use strict';
// JustUndercover: TV and phone screens. The agency's briefing room at night: Director Grey (drawn
// with the intro's own character, BOX.intros.undercover.host) briefs the agents from his desk, the
// case board pins every agent's photo (BOX.face) with their clues, the shared Sketch Line drawing
// grows stroke by stroke in each agent's colour, and votes end with a dossier stamp: MOLE or AGENT.
// Phones: your agency ID card (hold to peek at your password; hidden by default), the clue box,
// a drawing pad on your turn, the vote, and the caught mole's last guess.
(function () {
  const { esc, timer } = BOX;
  const fc = (x, n = 40, o) => (x && BOX.face ? BOX.face(x, n, { cls: 'uc-fc', ...(o || {}) }) : `<span class="uc-emo">${esc((x && x.avatar) || '🙂')}</span>`);
  const photo = (x, n = 120) => (x && BOX.face && (!BOX.hasLook || BOX.hasLook(x)) ? BOX.face(x, n, { fill: true }) : `<span class="uc-emo fill">${esc((x && x.avatar) || '🙂')}</span>`);
  const fig = (x, h = 220) => (x && BOX.body && BOX.hasLook && BOX.hasLook(x) ? BOX.body(x, h) : `<span class="uc-emo huge">${esc((x && x.avatar) || '🙂')}</span>`);
  const tilt = (s, k = 3) => { let h = 7; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return ((h % 1000) / 1000 - 0.5) * 2 * k; };
  const CODENAMES = ['Night Heron', 'Silver Fox', 'Paper Moon', 'Quiet Thunder', 'Velvet Glove', 'Blue Lantern', 'Iron Teacup', 'Glass Owl', 'Midnight Kite', 'Crimson Key', 'Hollow Oak', 'Golden Sparrow', 'Black Tulip', 'Copper Wolf', 'Lucky Clover', 'Frozen Comet'];
  const codename = (n, mode) => CODENAMES[(n * 7 + String(mode).length * 3) % CODENAMES.length];
  const RULE = {
    words: 'Everyone has a password. The mole’s is slightly different, and nobody knows who they are. One word each!',
    sketch: 'Everyone knows the word except the faker, who only knows the file. Add ONE line each to the drawing.',
    blank: 'One of you has no password at all, only the file. Bluff, blank agent!',
    double: 'Two moles this time, both with a slightly different password.',
    rival: 'No mole: two teams, two passwords. Find out who shares yours.',
    speed: 'Eight seconds a clue. No hesitating!',
    picture: 'Draw a tiny doodle of your password. The mole’s password is slightly different.',
  };
  const STAMP = (role) => (role === 'mole' ? '<div class="uc-stamp mole">MOLE</div>' : role === 'agent' ? '<div class="uc-stamp agent">AGENT</div>' : '');

  // ---------------- drawings (0..1000 coordinates, each stroke in its agent's colour) ----------------
  function fit(cv) {
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return cv.getContext('2d');
  }
  function line(g, p, col, W, lw, frac = 1) {
    const n = p.length / 2, upto = Math.max(1, Math.ceil(n * frac));
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(p[0] * W / 1000, p[1] * W / 1000);
    if (n === 1 || (n === 2 && p[0] === p[2] && p[1] === p[3])) { g.lineTo(p[0] * W / 1000 + 0.1, p[1] * W / 1000); }
    for (let i = 1; i < upto; i++) g.lineTo(p[i * 2] * W / 1000, p[i * 2 + 1] * W / 1000);
    g.stroke();
  }
  function paint(cv, strokes, o = {}) {
    if (!cv) return; const g = fit(cv), W = cv.width;
    g.clearRect(0, 0, W, cv.height);
    for (const s of strokes || []) line(g, s.p, s.color || o.color || '#222', W, W * (o.lw || 0.014));
  }
  // The TV draws new strokes as if the pen were moving.
  function animate(cv, strokes, from, o = {}) {
    const id = (cv._a = (cv._a || 0) + 1), t0 = performance.now(), per = 650;
    const step = (t) => {
      if (cv._a !== id || !cv.isConnected) return;
      const g = fit(cv), W = cv.width; g.clearRect(0, 0, W, cv.height);
      const k = (t - t0) / per;
      strokes.forEach((s, i) => { const f = i < from ? 1 : Math.max(0, Math.min(1, k - (i - from))); if (f > 0) line(g, s.p, s.color, W, W * (o.lw || 0.014), f); });
      if (k < strokes.length - from) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------------- phone ----------------
  const PH = { peek: false, v: null, ctx: null, el: null, pad: null, padKey: null, picks: new Set(), pickKey: null, lastPhase: '', sending: false };
  const bar = (v) => `<div class="uc-bar"><span>${v.c ? `${esc(v.c.modeIcon)} Case ${v.caseNo}/${v.of}` : 'JustUndercover'}</span>${v.endsIn && v.phase !== 'case' ? `<span class="uc-t">${timer(v.endsIn)}</span>` : '<span></span>'}<b>⭐ ${v.points}</b></div>`;
  // Your agency ID: the password only shows while you hold it (and only on your phone).
  function idCard(v, big) {
    const k = v.card || {}, me = (v.c && v.c.cards.find((x) => x.id === v.me)) || { id: v.me };
    const secret = k.faker ? `<div class="uc-pw fake">YOU’RE THE FAKER</div><div class="uc-pw-sub">You don’t know the word. The file: <b>${esc(k.catIcon)} ${esc(k.cat)}</b>. Draw like you know it!</div>`
      : k.blank ? `<div class="uc-pw fake">NO PASSWORD</div><div class="uc-pw-sub">You’re the blank agent. The file: <b>${esc(k.catIcon)} ${esc(k.cat)}</b>. Blend in!</div>`
        : k.word ? `<div class="uc-pw">${esc(k.word)}</div><div class="uc-pw-sub">File: ${esc(k.catIcon)} ${esc(k.cat)}${v.c && v.c.kind === 'rival' ? ' · find who shares it' : ''}</div>` : '';
    return `<div class="uc-id ${big ? 'big' : ''} ${PH.peek ? 'peek' : ''}" id="uc-peek">
      <div class="uc-id-h"><span>AGENCY ID</span><span class="uc-cls">CLASSIFIED</span></div>
      <div class="uc-id-b"><div class="uc-id-ph">${photo(me, 96)}</div>
        <div class="uc-id-s">${PH.peek ? secret : `<div class="uc-hold">🔒 <b>Hold to peek</b><small>at your password. Hide it from your neighbours!</small></div>`}</div></div></div>`;
  }
  function bindPeek(el) {
    const b = el.querySelector('#uc-peek'); if (!b) return;
    const set = (on) => { if (PH.peek === on) return; PH.peek = on; if (on && PH.ctx) PH.ctx.haptic('select'); rerender(); };
    b.onpointerdown = (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { /* fine */ } set(true); };
    b.onpointerup = b.onpointercancel = b.onlostpointercapture = () => set(false);
  }
  const rerender = () => { if (PH.el && PH.v) phone(PH.el, PH.v, PH.ctx, true); };
  const cardsBy = (v) => (v.c ? v.c.cards : []);
  const nameOf = (v, id) => { const x = cardsBy(v).find((c) => c.id === id); return x ? x.name : ''; };
  function cluesHtml(v, o = {}) {
    const c = v.c; if (!c) return '';
    const rows = c.cards.filter((x) => !o.alive || !x.out).map((x) => `<div class="uc-crow ${x.out ? 'out' : ''} ${x.turn ? 'turn' : ''} ${o.pick ? 'pickable' : ''} ${o.sel && o.sel(x) ? 'sel' : ''}" ${o.pick && o.can(x) ? `data-pick="${esc(x.id)}"` : ''} style="--c:${esc(x.color)}">
      ${fc(x, 34)}<b>${esc(x.name)}${x.id === v.me ? ' <small>(you)</small>' : ''}</b>
      <span class="uc-chips">${x.clues.filter((k) => !k.line).map((k) => (k.doodle ? `<span class="uc-mini" data-keep data-dd='${esc(JSON.stringify(k.doodle))}' data-col="${esc(x.color)}"><canvas></canvas></span>` : `<i class="${k.miss ? 'miss' : ''}">${k.miss ? '…' : esc(k.text)}</i>`)).join('')}</span>
      ${x.out ? STAMP(x.outRole) : ''}${o.sel && o.sel(x) ? '<em class="uc-sel">✓</em>' : ''}</div>`).join('');
    return `<div class="uc-clist">${rows}</div>`;
  }
  const paintMinis = (el) => { for (const b of el.querySelectorAll('[data-dd]')) { const cv = b.querySelector('canvas'); if (!cv || cv._k === b.dataset.dd) continue; cv._k = b.dataset.dd; try { paint(cv, JSON.parse(b.dataset.dd).map((p) => ({ p, color: b.dataset.col })), { lw: 0.045 }); } catch { /* bad */ } } };

  // The drawing pad: Sketch Line (one line over everyone else's) or a Picture Clue doodle.
  function padHtml(v, kind) {
    const one = kind === 'line';
    return `<div class="uc-padbox ${one ? 'line' : 'doodle'}"><div class="uc-pad" id="uc-pad" data-keep><canvas></canvas></div>
      <div class="uc-padtools"><button class="uc-btn ghost" id="uc-undo">${one ? '↺ Redraw' : '↶ Undo'}</button>${one ? '' : '<button class="uc-btn ghost" id="uc-clear">🗑 Clear</button>'}<button class="uc-btn go" id="uc-send">${one ? '✓ Send my line' : '✓ Send doodle'}</button></div></div>`;
  }
  function bindPad(el, v, kind) {
    const box = el.querySelector('#uc-pad'), cv = box && box.querySelector('canvas'); if (!cv) return;
    const key = kind + ':' + v.caseNo + ':' + v.c.cycle + ':' + v.c.lap + ':' + (v.c.strokes ? v.c.strokes.length : 0);
    if (PH.padKey !== key) { PH.padKey = key; PH.pad = { strokes: [], cur: null }; }
    const pad = PH.pad, mine = (v.c.cards.find((x) => x.id === v.me) || {}).color || '#ff4f6d';
    const base = kind === 'line' ? (v.c.strokes || []) : [];
    const draw = () => { paint(cv, [...base.map((s) => ({ ...s, color: s.color })), ...pad.strokes.map((p) => ({ p, color: mine }))], { lw: kind === 'line' ? 0.014 : 0.022 }); };
    const at = (e) => { const r = cv.getBoundingClientRect(); return [Math.round(Math.max(0, Math.min(1000, ((e.clientX - r.left) / r.width) * 1000))), Math.round(Math.max(0, Math.min(1000, ((e.clientY - r.top) / r.height) * 1000)))]; };
    cv.onpointerdown = (e) => {
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch { /* fine */ }
      if (kind === 'line') pad.strokes = []; // one line: a new touch starts it again
      const total = pad.strokes.reduce((n, s) => n + s.length / 2, 0);
      if (kind !== 'line' && (pad.strokes.length >= 14 || total > 640)) { PH.ctx.toast('Your doodle is full. Send it!'); return; }
      pad.cur = at(e); pad.strokes.push(pad.cur); draw();
    };
    cv.onpointermove = (e) => {
      if (!pad.cur) return; const [x, y] = at(e), n = pad.cur.length;
      if (Math.hypot(x - pad.cur[n - 2], y - pad.cur[n - 1]) < 7) return;
      if (pad.cur.length >= (kind === 'line' ? 430 : 260)) return;
      pad.cur.push(x, y); draw();
    };
    cv.onpointerup = cv.onpointercancel = () => { pad.cur = null; };
    el.querySelector('#uc-undo').onclick = () => { if (kind === 'line') pad.strokes = []; else pad.strokes.pop(); PH.ctx.haptic('tap'); draw(); };
    const clr = el.querySelector('#uc-clear'); if (clr) clr.onclick = () => { pad.strokes = []; PH.ctx.haptic('warn'); draw(); };
    el.querySelector('#uc-send').onclick = async () => {
      if (!pad.strokes.length) { PH.ctx.toast(kind === 'line' ? 'Draw your line first.' : 'Draw something first.'); return; }
      const r = await PH.ctx.act(kind === 'line' ? { op: 'line', stroke: { p: pad.strokes[0] } } : { op: 'doodle', strokes: pad.strokes.map((p) => ({ p })) });
      if (r && r.ok) { PH.ctx.haptic('success'); pad.strokes = []; }
    };
    requestAnimationFrame(draw);
  }

  function phone(el, v, ctx, local) {
    if (!v) return;
    PH.v = v; PH.ctx = ctx; PH.el = el;
    const key = v.phase + ':' + v.caseNo + ':' + (v.c ? v.c.cycle + ':' + v.c.turnId : '');
    if (!local && key !== PH.lastPhase) {
      const was = PH.lastPhase; PH.lastPhase = key;
      if (v.myTurn) ctx.haptic('turn');
      else if (v.phase === 'brief' && !was.startsWith('brief')) ctx.haptic('big');
      else if (v.phase === 'vote' || v.phase === 'pick') ctx.haptic('turn');
      else if (v.phase === 'eject' && v.c && v.c.eject && v.c.eject.id === v.me) ctx.haptic('buzz');
      else if (v.phase === 'guess' && v.guessing) ctx.haptic('warn');
      else if (v.phase === 'case' && v.mine) ctx.haptic(v.mine.gain > 0 ? 'success' : 'error');
      else if (v.phase === 'over') ctx.haptic(v.rank === 1 ? 'win' : 'success');
    }
    const c = v.c;
    if (v.phase === 'over') {
      const F = v.final || {}, mine = (F.awards || []).filter((a) => a.id === v.me);
      return BOX.morph(el, `<div class="uc-ph"><div class="uc-sheet end"><div class="uc-tag">MISSION DEBRIEF</div><h2>${v.rank === 1 ? '🏆 Top agent of the night!' : `#${v.rank} of ${v.ranked}`}</h2><p class="uc-bign">⭐ ${v.points}</p>
        ${mine.map((a) => `<div class="uc-aw">${esc(a.icon)} <b>${esc(a.title)}</b> <small>${esc(a.text)}</small></div>`).join('')}<p class="muted">Director Grey thanks you for your service.</p></div></div>`);
    }
    if (!c) return BOX.morph(el, `<div class="uc-ph"><div class="uc-sheet"><h2>🕵️ Stand by, agent…</h2></div></div>`);
    if (v.spectator) return BOX.morph(el, `<div class="uc-ph">${bar(v)}<div class="uc-sheet"><div class="uc-tag">OBSERVER</div><h2>👀 You’re watching this case</h2><p>You’ll get your own card when the next case opens.</p></div>${cluesHtml(v)}</div>`), paintMinis(el);
    let body = '';
    if (v.phase === 'brief') {
      body = `${idCard(v, true)}<div class="uc-sheet"><div class="uc-tag">${esc(c.modeIcon)} ${esc(c.modeName)}</div><p>${esc(RULE[c.mode] || '')}</p></div>`;
    } else if (v.phase === 'case') {
      const m = v.mine || {}, r = c.result || {}, w = c.words || {};
      const won = r.winner === 'rival' ? m.gain > 0 : (r.winner === 'agents') === (m.role === 'agent');
      body = `<div class="uc-sheet res ${won ? 'won' : 'lost'}"><div class="uc-tag">CASE ${v.caseNo} CLOSED</div>
        <h2>${r.winner === 'rival' ? '⚔️ Teams revealed' : r.winner === 'agents' ? '✅ The agents caught the mole' : '🕶️ The mole got away'}</h2>
        <p>You were ${m.role === 'mole' ? '<b class="red">the MOLE</b>' : r.winner === 'rival' ? `on <b>team ${esc((m.team || '').toUpperCase())}</b>` : 'an <b>agent</b>'}.</p>
        ${r.winner === 'rival' ? `<div class="uc-words"><span>A: <b>${esc(w.a)}</b></span><span>B: <b>${esc(w.b)}</b></span></div>` : `<div class="uc-words"><span>Agents: <b>${esc(w.agents)}</b></span><span>Mole: <b>${w.moles ? esc(w.moles) : c.kind === 'sketch' ? 'just the file' : 'no word'}</b></span></div>`}
        <p class="uc-gain">${m.gain > 0 ? '+' : ''}${m.gain || 0}</p></div>`;
    } else if (v.guessing && v.phase === 'guess' && !v.guessing.done) {
      body = `<div class="uc-sheet guess"><div class="uc-tag red">CAUGHT!</div><h2>🔐 Last chance</h2><p>${c.kind === 'sketch' || c.blank ? 'Name the password and you still win the case!' : 'You were the mole! Name the agents’ password for a bonus.'}</p>
        <div class="uc-in"><input id="uc-guess" maxlength="40" autocomplete="off" autocapitalize="off" placeholder="The password is…"><button class="uc-btn go" id="uc-gsend">Guess</button></div></div>`;
    } else if (v.out && (v.phase !== 'eject' || !(c.eject && c.eject.id === v.me))) {
      body = `${idCard(v)}<div class="uc-sheet out"><div class="uc-tag">BENCHED</div><h2>You’re out of this case</h2><p>You were ${v.outRole === 'mole' ? '<b class="red">the mole</b>' : 'an <b>agent</b>'}. Watch the TV, and no hints!</p></div>${cluesHtml(v, { alive: true })}`;
    } else if (v.phase === 'clue') {
      const who = c.turnId ? nameOf(v, c.turnId) : '';
      if (v.myTurn && c.kind === 'sketch') body = `<div class="uc-turn">✏️ <b>Your turn!</b> Add <u>one line</u> to the drawing.${c.laps > 1 ? ` <small>Lap ${c.lap}/${c.laps}</small>` : ''}</div>${idCard(v)}${padHtml(v, 'line')}`;
      else if (v.myTurn && c.picture) body = `<div class="uc-turn">🖼️ <b>Doodle your password!</b> Small and quick. No letters!</div>${idCard(v)}${padHtml(v, 'doodle')}`;
      else if (v.myTurn) body = `<div class="uc-turn">🎙️ <b>Your turn!</b> One word that fits your password.</div>${idCard(v)}
        <div class="uc-in"><input id="uc-clue" maxlength="24" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="One word…"><button class="uc-btn go" id="uc-csend">Send</button></div>${cluesHtml(v)}`;
      else if (c.kind === 'sketch') body = `<div class="uc-wait">✏️ ${who ? `<b>${esc(who)}</b> is drawing…` : 'Next artist…'}</div>${idCard(v)}<div class="uc-padbox view"><div class="uc-pad" id="uc-view" data-keep><canvas></canvas></div></div>`;
      else body = `<div class="uc-wait">${c.sim ? '✅ Sent! Waiting for the others…' : `🎙️ ${who ? `<b>${esc(who)}</b> is giving a clue…` : 'Next agent…'}`}</div>${idCard(v)}${cluesHtml(v)}`;
    } else if (v.phase === 'talk') {
      body = `<div class="uc-turn talk">🗣️ <b>Discuss out loud!</b> Who sounds like a bluffer?</div>${idCard(v)}${cluesHtml(v)}
        <button class="uc-btn go wide" id="uc-ready" ${v.ready ? 'disabled' : ''}>${v.ready ? '✓ Ready, waiting for the others' : '🗳️ I’m ready to vote'}</button>`;
    } else if (v.phase === 'vote') {
      body = `<div class="uc-turn vote">🗳️ <b>Who is the mole?</b> Tap to vote${v.myVote ? ` <small>(you can change it)</small>` : ''}</div>${cluesHtml(v, { alive: true, pick: true, can: (x) => x.id !== v.me && !x.out, sel: (x) => x.id === v.myVote })}${idCard(v)}`;
    } else if (v.phase === 'pick') {
      const pk = v.caseNo + ':pick'; if (PH.pickKey !== pk) { PH.pickKey = pk; PH.picks = new Set(v.myPicks || []); }
      body = `<div class="uc-turn vote">🤝 <b>Who shares your password?</b> Tap your teammates.</div>${cluesHtml(v, { pick: true, can: (x) => x.id !== v.me, sel: (x) => PH.picks.has(x.id) })}
        <button class="uc-btn go wide" id="uc-lock" ${PH.picks.size ? '' : 'disabled'}>${v.myPicks ? '✓ Locked in (tap to update)' : `🔒 Lock in ${PH.picks.size || ''} teammate${PH.picks.size === 1 ? '' : 's'}`}</button>${idCard(v)}`;
    } else if (v.phase === 'eject' || v.phase === 'guess') {
      const e = c.eject || {}, g = c.guess;
      const msg = e.tie ? '⚖️ A split vote: nobody leaves.' : e.id === v.me ? (e.mole ? '😱 You were caught! You were the MOLE.' : '😬 They voted you out… you were an innocent agent.') : `${esc(nameOf(v, e.id))} was ${e.mole ? '<b class="red">the MOLE!</b>' : 'an <b>innocent agent</b>.'}`;
      const gl = g && g.right != null ? (g.right ? '🔓 The password was cracked!' : '🔒 Wrong password!') : g ? '🔐 The mole is guessing the password…' : '';
      body = `<div class="uc-sheet"><div class="uc-tag">VERDICT</div><h2>${msg}</h2>${gl ? `<p>${gl}</p>` : ''}</div>${idCard(v)}`;
    }
    BOX.morph(el, `<div class="uc-ph ph-${v.phase}">${bar(v)}${body}</div>`);
    bindPeek(el); paintMinis(el);
    const send = async (inpSel, op) => { const inp = el.querySelector(inpSel); const t = inp ? inp.value.trim() : ''; if (!t || PH.sending) return; PH.sending = true; const r = await ctx.act({ op, text: t }); PH.sending = false; if (r && r.ok) { inp.value = ''; inp.blur(); ctx.haptic('success'); } };
    const cs = el.querySelector('#uc-csend'); if (cs) { cs.onclick = () => send('#uc-clue', 'clue'); const i = el.querySelector('#uc-clue'); i.onkeydown = (e) => { if (e.key === 'Enter') send('#uc-clue', 'clue'); }; }
    const gs = el.querySelector('#uc-gsend'); if (gs) { gs.onclick = () => send('#uc-guess', 'guess'); const i = el.querySelector('#uc-guess'); i.onkeydown = (e) => { if (e.key === 'Enter') send('#uc-guess', 'guess'); }; }
    const rd = el.querySelector('#uc-ready'); if (rd) rd.onclick = async () => { const r = await ctx.act({ op: 'ready' }); if (r && r.ok) ctx.haptic('select'); };
    if (v.phase === 'vote') for (const b of el.querySelectorAll('[data-pick]')) b.onclick = async () => { const r = await ctx.act({ op: 'vote', target: b.dataset.pick }); if (r && r.ok) ctx.haptic('select'); };
    if (v.phase === 'pick') {
      for (const b of el.querySelectorAll('[data-pick]')) b.onclick = () => { const id = b.dataset.pick; if (PH.picks.has(id)) PH.picks.delete(id); else PH.picks.add(id); ctx.haptic('tap'); rerender(); };
      const lk = el.querySelector('#uc-lock'); if (lk) lk.onclick = async () => { const r = await ctx.act({ op: 'pick', ids: [...PH.picks] }); if (r && r.ok) ctx.haptic('success'); };
    }
    if (v.myTurn && v.phase === 'clue' && (c.kind === 'sketch' || c.picture)) bindPad(el, v, c.kind === 'sketch' ? 'line' : 'doodle');
    const vw = el.querySelector('#uc-view canvas'); if (vw) requestAnimationFrame(() => paint(vw, c.strokes || []));
  }

  // ---------------- TV ----------------
  const TV = { said: null, cv: null, raf: 0, host: null, anim: null, sayUntil: 0, sk: { key: '', n: 0 } };
  const greySpec = () => { const I = BOX.intros && BOX.intros.undercover; return I && I.host ? I.host : null; };
  function speak(text, spec) {
    try { if (BOX.voice && BOX.voice.speak) BOX.voice.speak(text, spec || {}); } catch { /* no voice */ }
    const ms = Math.max(1500, text.length * 62); TV.sayUntil = Date.now() + ms; if (TV.anim) TV.anim.talk(performance.now(), ms);
  }
  // Director Grey at his desk, drawn with the intro's character.
  function greyLoop() {
    TV.raf = requestAnimationFrame(greyLoop);
    const cv = TV.cv; if (!cv || !cv.isConnected) return;
    const H = greySpec(); if (!H || !BOX.studio) return;
    if (!TV.host) { try { TV.host = H.draw ? H.draw.bind(H) : BOX.studio.makeHost(H.look || {}); TV.anim = new BOX.studio.HostAnim(H); } catch { return; } }
    const g = fit(cv); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    const sc = cv.height / 480; g.translate(cv.width / 2, cv.height * 1.0); g.scale(sc, sc);
    if (Date.now() < TV.sayUntil && TV.anim.talkUntil < performance.now()) TV.anim.talk(performance.now(), TV.sayUntil - Date.now());
    try { TV.host(g, TV.anim.frame(performance.now())); } catch { /* drawing */ }
  }
  function mountGrey(el) {
    const box = el.querySelector('#uc-grey'); if (!box) return;
    if (!box.querySelector('canvas')) box.innerHTML = '<canvas></canvas>';
    TV.cv = box.querySelector('canvas');
    if (BOX.studio && BOX.studio.need) BOX.studio.need('undercover', () => {});
    if (!TV.raf) TV.raf = requestAnimationFrame(greyLoop);
  }
  function room(inner, s, cls = '') {
    const c = s.c, G = s.grey;
    return `<div class="uc-tv ${cls}"><div class="uc-room"><i class="uc-blinds"></i><i class="uc-map"></i><i class="uc-lamp"></i></div>
      <div class="uc-top">${c ? `<div class="uc-plate"><small>CASE</small><b>${s.caseNo}<span>/${s.of}</span></b></div>
        <div class="uc-chip">${esc(c.modeIcon)} ${esc(c.modeName)}</div><div class="uc-chip file">${esc(c.cat.icon)} File: ${esc(c.cat.name)}</div>
        ${c.kind === 'words' && c.maxCycles > 1 && s.phase !== 'brief' && s.phase !== 'case' ? `<div class="uc-chip dim">Interrogation ${c.cycle}/${c.maxCycles}</div>` : ''}${c.moles ? `<div class="uc-chip red">🕵️ ${c.moles} mole${c.moles === 1 ? '' : 's'}</div>` : ''}` : '<div class="uc-plate"><small>THE</small><b>AGENCY</b></div>'}
        <div class="uc-clock ${s.endsIn && s.endsIn < 10000 && (s.phase === 'clue' || s.phase === 'vote' || s.phase === 'talk') ? 'low' : ''}">${s.endsIn && s.phase !== 'over' ? timer(s.endsIn) : ''}</div></div>
      <div class="uc-desk"><div class="uc-grey" id="uc-grey" data-keep></div><div class="uc-deskfront"><span>DIRECTOR GREY</span></div></div>
      ${G ? `<div class="uc-bub" id="uc-bub-${G.key}"><p>${esc(G.text)}</p></div>` : ''}
      <div class="uc-main">${inner}</div></div>`;
  }
  // The case board: every agent's photo with their clues.
  function board(s, o = {}) {
    const c = s.c, n = c.cards.length, cols = n <= 4 ? n : n <= 6 ? 3 : n <= 8 ? 4 : n <= 10 ? 5 : n <= 15 ? 5 : n <= 24 ? 8 : 10;
    const rows = Math.ceil(n / cols), big = '';
    const cards = c.cards.map((x) => {
      const clues = x.clues.filter((k) => !k.line).map((k, i) => (k.doodle ? `<span class="uc-dood" data-keep data-dd='${esc(JSON.stringify(k.doodle))}' data-col="${esc(x.color)}"><canvas></canvas></span>` : `<span class="uc-clue ${k.miss ? 'miss' : ''}" style="--r:${tilt(x.id + i, 3).toFixed(1)}deg">${k.miss ? '…' : esc(k.text)}</span>`)).join('');
      return `<div class="uc-card ${x.turn ? 'turn' : ''} ${x.out ? 'out' : ''} ${x.here ? '' : 'away'} ${o.mark && o.mark(x) ? 'mark' : ''}${big}" style="--c:${esc(x.color)};--r:${tilt(x.id, 2).toFixed(1)}deg">
        <i class="uc-pin"></i><div class="uc-photo">${photo(x, 140)}</div><div class="uc-nm">${esc(x.name)}</div>
        <div class="uc-cl">${clues || (x.turn ? '<span class="uc-typing"><b></b><b></b><b></b></span>' : '')}</div>
        ${x.out ? STAMP(x.outRole) : x.role && s.phase === 'case' ? STAMP(x.role) : ''}${x.voted || x.ready || x.done ? '<em class="uc-tick">✓</em>' : ''}</div>`;
    }).join('');
    return `<div class="uc-board ${c.picture ? 'pic' : ''}" style="--cols:${cols};--rows:${rows}">${cards}</div>`;
  }
  const paintDoodles = (el) => { for (const b of el.querySelectorAll('[data-dd]')) { const cv = b.querySelector('canvas'); if (!cv || cv._k === b.dataset.dd + cv.clientWidth) continue; cv._k = b.dataset.dd + cv.clientWidth; try { paint(cv, JSON.parse(b.dataset.dd).map((p) => ({ p, color: b.dataset.col })), { lw: 0.03 }); } catch { /* bad */ } } };
  function sketchArea(s) {
    const c = s.c, cards = c.cards;
    const artists = cards.map((x) => `<div class="uc-artist ${x.turn ? 'turn' : ''} ${x.voted ? 'voted' : ''}" style="--c:${esc(x.color)}">${fc(x, 40)}<b>${esc(x.name)}</b><i>${x.clues.filter((k) => k.line).length ? '✏️'.repeat(x.clues.filter((k) => k.line).length) : x.clues.some((k) => k.miss) ? '…' : ''}</i>${x.voted || x.ready ? '<em class="uc-tick">✓</em>' : ''}${x.role && s.phase === 'case' ? STAMP(x.role) : ''}</div>`).join('');
    return `<div class="uc-sketch"><div class="uc-paper"><div class="uc-paperclip"></div><div class="uc-canvas" id="uc-canvas" data-keep><canvas></canvas></div><div class="uc-paperlab">${esc(c.cat.icon)} ${esc(c.cat.name)} · Lap ${c.lap}/${c.laps}</div></div>
      <div class="uc-artists">${artists}</div></div>`;
  }
  function paintSketch(el, s) {
    const cv = el.querySelector('#uc-canvas canvas'); if (!cv) return;
    const st = s.c.strokes || [], key = s.caseNo + ':' + s.c.mode;
    if (TV.sk.key !== key) TV.sk = { key, n: 0 };
    if (st.length > TV.sk.n && s.phase === 'clue') { const from = TV.sk.n; TV.sk.n = st.length; animate(cv, st, from); }
    else { TV.sk.n = st.length; if (!cv._a || cv._k !== st.length + ':' + cv.clientWidth) { cv._k = st.length + ':' + cv.clientWidth; requestAnimationFrame(() => paint(cv, st)); } }
  }
  function headline(s) {
    const c = s.c, turn = c.turnId && c.cards.find((x) => x.id === c.turnId);
    const waiting = (f) => c.cards.filter((x) => !x.out && x.here && !f(x)).length;
    if (s.phase === 'clue') {
      if (c.sim) return c.picture ? `🖼️ Everyone is doodling their password… <small>${c.cards.filter((x) => x.done).length}/${c.cards.filter((x) => !x.out).length} sent</small>` : `🎙️ Everyone types a clue… <small>${c.cards.filter((x) => x.done).length}/${c.cards.filter((x) => !x.out).length}</small>`;
      return turn ? `${c.kind === 'sketch' ? '✏️' : '🎙️'} ${fc(turn, 44)} <b>${esc(turn.name)}</b> ${c.kind === 'sketch' ? 'adds a line' : 'gives a clue'}${c.laps > 1 ? ` <small>lap ${c.lap}/${c.laps}</small>` : ''}` : '…';
    }
    if (s.phase === 'talk') return `🗣️ <b>Discuss!</b> Who is bluffing? <small>${waiting((x) => x.ready)} not ready</small>`;
    if (s.phase === 'vote') return `🗳️ <b>Vote on your phones!</b> <small>${c.cards.filter((x) => x.voted).length}/${c.cards.filter((x) => !x.out).length} voted</small>`;
    if (s.phase === 'pick') return `🤝 <b>Pick your teammates</b> on your phones <small>${c.cards.filter((x) => x.voted).length}/${c.cards.length}</small>`;
    return '';
  }
  function tvBrief(el, s) {
    const c = s.c;
    BOX.morph(el, room(`<div class="uc-folder" id="uc-f-${c.n}"><div class="uc-tab">TOP SECRET</div>
      <div class="uc-fhead"><small>CASE FILE #${String(c.n).padStart(3, '0')}</small><h1>Operation ${esc(codename(c.n, c.mode))}</h1></div>
      <div class="uc-fbody"><div class="uc-fmode"><span>${esc(c.modeIcon)}</span><div><b>${esc(c.modeName)}</b><p>${esc(RULE[c.mode] || '')}</p></div></div>
        <div class="uc-ffile">${esc(c.cat.icon)} <span>File:</span> <b>${esc(c.cat.name)}</b></div>
        <div class="uc-fphone">📱 <b>Check your phone</b>: hold your ID card to peek at your password. Don’t let your neighbours see!</div>
        <div class="uc-fagents">${c.cards.map((x) => `<span style="--c:${esc(x.color)}">${fc(x, 54)}</span>`).join('')}</div></div>
      <div class="uc-fstamp">CLASSIFIED</div></div>`, s, 'ph-brief'));
    mountGrey(el);
  }
  function tvPlay(el, s) {
    const c = s.c, sk = c.kind === 'sketch';
    BOX.morph(el, room(`<div class="uc-head">${headline(s)}</div>${sk ? sketchArea(s) : board(s)}`, s, 'ph-' + s.phase + (sk ? ' sk' : '')));
    mountGrey(el);
    if (sk) paintSketch(el, s); else paintDoodles(el);
  }
  function tvEject(el, s) {
    const c = s.c, e = c.eject || {}, g = c.guess, x = e.id && c.cards.find((k) => k.id === e.id);
    const tally = (e.tally || []).map((t) => { const y = c.cards.find((k) => k.id === t.id); return y ? `<div class="uc-tal ${t.id === e.id ? 'top' : ''}">${fc(y, 40)}<b>${esc(y.name)}</b><span>${t.by.map((id) => { const v = c.cards.find((k) => k.id === id); return v ? fc(v, 26) : ''; }).join('')}</span><em>${t.n}</em></div>` : ''; }).join('');
    const guess = g ? `<div class="uc-guess ${g.right == null ? 'wait' : g.right ? 'yes' : 'no'}">${g.right == null ? '🔐 Last chance: the mole names the password…' : g.text ? `🔐 “${esc(g.text)}” ${g.right ? '<b>CORRECT!</b>' : '<b>WRONG!</b>'}` : g.right ? '🔓 The mole cracked the password!' : '🔒 Wrong password!'}</div>` : '';
    const inner = e.tie || !x ? `<div class="uc-verdict tie"><h1>⚖️ SPLIT VOTE</h1><p>Nobody leaves the room${c.kind === 'sketch' ? ', so the faker slips away.' : '.'}</p><div class="uc-tally">${tally}</div></div>`
      : `<div class="uc-verdict" id="uc-v-${c.n}-${c.cycle}"><div class="uc-dossier"><div class="uc-tab">DOSSIER</div><div class="uc-dphoto">${photo(x, 260)}</div><h2>${esc(x.name)}</h2>
          <div class="uc-slam ${e.mole ? 'mole' : 'agent'}">${e.mole ? 'MOLE' : 'AGENT'}</div></div>
        <div class="uc-vside"><h1 class="${e.mole ? 'red' : 'blue'}">${e.mole ? (c.kind === 'sketch' ? 'The faker is caught!' : 'Caught! The mole!') : 'Innocent!'}</h1><p>${e.mole ? '' : c.kind === 'sketch' ? 'The faker slips away…' : 'That was one of ours.'}</p>${guess}<div class="uc-tally">${tally}</div></div></div>`;
    BOX.morph(el, room(inner, s, 'ph-eject'));
    mountGrey(el);
  }
  function tvCase(el, s) {
    const c = s.c, r = c.result || {}, w = c.words || {};
    const moles = c.cards.filter((x) => x.role === 'mole'), gains = r.gains || [];
    const title = r.winner === 'rival' ? '⚔️ TEAMS REVEALED' : r.winner === 'agents' ? '✅ CASE CLOSED' : c.kind === 'sketch' ? '🕶️ THE FAKER GOT AWAY' : '🕶️ THE MOLE GOT AWAY';
    const why = { caught: 'The agents caught every mole.', cracked: 'Caught, but the password was cracked!', tie: 'A split vote let the faker escape.', wrong: 'The wrong agent was accused.', outnumber: 'The moles now match the agents left.', escaped: 'The interrogations ran out.', teams: 'Who found their partners?' }[r.why] || '';
    const team = (t) => c.cards.filter((x) => x.team === t).map((x) => `<span>${fc(x, 44)}${esc(x.name)}</span>`).join('');
    const words = r.winner === 'rival'
      ? `<div class="uc-pwf a"><small>TEAM A</small><b>${esc(w.a)}</b><div class="uc-team">${team('a')}</div></div><div class="uc-pwf b"><small>TEAM B</small><b>${esc(w.b)}</b><div class="uc-team">${team('b')}</div></div>`
      : `<div class="uc-pwf a"><small>AGENTS’ PASSWORD</small><b>${esc(w.agents)}</b></div><div class="uc-pwf b"><small>${c.kind === 'sketch' ? 'THE FAKER KNEW' : 'MOLE’S PASSWORD'}</small><b>${w.moles ? esc(w.moles) : c.kind === 'sketch' ? esc(c.cat.name) : '— none —'}</b><div class="uc-team">${moles.map((x) => `<span>${fc(x, 44)}${esc(x.name)}</span>`).join('')}</div></div>`;
    const sketch = c.kind === 'sketch' ? `<div class="uc-mini-paper"><div class="uc-canvas" id="uc-canvas" data-keep><canvas></canvas></div></div>` : '';
    BOX.morph(el, room(`<div class="uc-case ${r.winner === 'moles' ? 'moles' : 'agents'}" id="uc-case-${c.n}"><h1>${title}</h1><p class="uc-why">${esc(why)}</p>
      <div class="uc-pws">${words}${sketch}</div>
      <div class="uc-gains">${gains.filter((x) => x.gain).slice(0, 14).map((x) => `<span>${fc(x, 32)} ${esc(x.name)} <b>+${x.gain}</b></span>`).join('')}</div>
      <div class="uc-lb">${(s.standings || []).slice(0, 8).map((x, i) => `<span><i>${i + 1}</i>${fc(x, 26)}${esc(x.name)}<b>${x.points}</b></span>`).join('')}</div></div>`, s, 'ph-case'));
    mountGrey(el);
    if (c.kind === 'sketch') { const cv = el.querySelector('#uc-canvas canvas'); if (cv) requestAnimationFrame(() => paint(cv, c.strokes || [])); }
  }
  function tvOver(el, s) {
    const F = s.final || {}, st = F.standings || s.standings || [], pod = st.slice(0, 3), order = [1, 0, 2].filter((i) => pod[i]);
    BOX.morph(el, room(`<div class="uc-over"><h1>MISSION DEBRIEF</h1><h2>🏆 ${esc((st[0] || {}).name || '')} is the agency’s top agent!</h2>
      <div class="uc-podium">${order.map((i) => `<div class="uc-pod p${i + 1}"><div class="uc-pfig">${fig(pod[i], i === 0 ? 230 : 180)}</div><b>${esc(pod[i].name)}</b><span>⭐ ${pod[i].points}</span><div class="uc-step">${i + 1}</div></div>`).join('')}</div>
      <div class="uc-awards">${(F.awards || []).map((a) => `<div class="uc-award"><i>${esc(a.icon)}</i><b>${esc(a.title)}</b><span>${fc(a, 30)} ${esc(a.name)}</span><small>${esc(a.text)}</small></div>`).join('')}</div>
      <div class="uc-rest">${st.slice(3, 12).map((r, i) => `<span>${i + 4}. ${fc(r, 24)} ${esc(r.name)} <b>${r.points}</b></span>`).join('')}</div></div>`, { ...s, c: null }, 'ph-over'));
    mountGrey(el);
  }

  function lobbyTv(el, L) {
    if (!el.querySelector('.uc-lobby')) {
      el.innerHTML = `<div class="uc-lobby"><div class="uc-room"><i class="uc-blinds"></i><i class="uc-map"></i><i class="uc-lamp"></i></div>
        <div class="uc-l-head"><div class="uc-logo">Just<b>Undercover</b></div><p>A mole has slipped into the agency. Give clues, read the room, and vote them out.</p></div>
        <div class="uc-l-main">
          <div class="uc-l-file"><div class="uc-tab">MISSION SETUP</div><div class="uc-l-set" id="settings"></div><div class="uc-l-err" id="lobby-err"></div>
            <button class="uc-l-start" id="start">🕵️ Open the case files</button><div class="uc-l-links"><button class="link" id="add-bots">+ 5 test bots</button> <button class="link" id="pick">🎮 Another game</button></div></div>
          <div class="uc-l-badge"><div class="uc-l-clip"></div><div class="uc-l-bh">VISITOR PASS</div><img id="qr" alt="QR code to join"><div class="uc-l-cl">Room code</div><div class="uc-l-code" id="code"></div></div>
        </div>
        <div class="uc-l-rail"><div class="uc-l-roster" id="roster"></div></div></div>`;
      el.querySelector('#start').onclick = async () => { const r = await L.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      el.querySelector('#add-bots').onclick = () => L.bots(5);
      el.querySelector('#pick').onclick = () => L.pick();
    }
    el.querySelector('#code').textContent = L.code;
    const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
    const set = el.querySelector('#settings'), sig = JSON.stringify(L.settings);
    if (set.dataset.sig !== sig && !set.contains(document.activeElement)) {
      set.dataset.sig = sig;
      set.innerHTML = L.fields.map((f) => `<label class="uc-l-f"><span>${esc(f.label)}</span><select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
      for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => L.set(s.dataset.set, s.value);
    }
    BOX.morph(el.querySelector('#roster'), L.players.map((p, i) => `<span class="chip uc-l-agent" style="--c:${esc(p.color || '#5ff2ff')};--r:${tilt(p.name, 3).toFixed(1)}deg">${fc(p, 44)}<span><small>AGENT ${String(i + 1).padStart(3, '0')}</small>${esc(p.name)}</span></span>`).join('') || '<span class="uc-l-empty">Scan the pass to join the agency. 4–10 agents is perfect (3–20 works).</span>');
  }

  BOX.games.undercover = {
    name: 'JustUndercover', icon: '🕵️',
    about: 'Everyone gets a secret password, except the mole. Give clues, draw lines, read the room and vote the mole out.',
    how: [
      'Every case, your phone holds your agency ID: hold it to peek at your secret password. The mole’s is different (or missing)!',
      'Word Clues: in turns, type ONE word that fits your password. Too obvious and the mole learns it; too vague and you look guilty.',
      'Sketch Line: everyone except the faker knows the word. Add one line each to the drawing on the TV, two laps.',
      'Discuss out loud, then vote. The most votes is ejected: MOLE or AGENT? A caught mole can still win by naming the password.',
      'Modes: Mixed, Blank Agent (no word at all), Double Agents, Rival Words (find your teammates), Speed Round, Picture Clue.',
      'Agents score for catching moles; moles score for surviving. Most points after the last case wins.',
    ],
    fx: { start: 'start', case: 'swell', clues: 'whoosh', turn: 'click', clue: 'pop', stroke: 'pop', talk: 'pop', vote: 'ballot', voted: 'click', caught: 'triumph', innocent: 'wail', tie: 'shrug', guess: 'heartbeat', cracked: 'sting', wrong: 'buzz', casewin: 'chime', molewin: 'sting', win: 'win' },
    music: (s) => (s.phase === 'brief' ? 'play' : s.phase === 'clue' || s.phase === 'talk' ? 'think' : s.phase === 'vote' || s.phase === 'pick' || s.phase === 'guess' ? 'tense' : s.phase === 'eject' || s.phase === 'case' ? 'reveal' : s.phase === 'over' ? 'finale' : undefined),
    lobbyTv,
    paint, // shared drawing (tests and the title screen)
    tv(el, s) {
      if (!s) return;
      if (BOX.voice && BOX.voice.preload && !TV.pre) { TV.pre = true; try { BOX.voice.preload('undercover'); } catch { /* no */ } }
      if (s.grey && TV.said !== s.grey.key) { TV.said = s.grey.key; speak(s.grey.text, (greySpec() || {}).voice); }
      if (s.phase === 'over') return tvOver(el, s);
      if (!s.c) return BOX.morph(el, room('', s));
      if (s.phase === 'brief') return tvBrief(el, s);
      if (s.phase === 'eject' || s.phase === 'guess') return tvEject(el, s);
      if (s.phase === 'case') return tvCase(el, s);
      return tvPlay(el, s);
    },
    phone,
  };
})();
