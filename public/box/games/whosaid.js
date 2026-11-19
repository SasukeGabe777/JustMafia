'use strict';
// Who Said It? screens, dressed as the title screen's hushed night: a starry indigo sky, a
// sleepy crescent moon, pastel speech bubbles and a crowd of silhouettes that light up mint.
// TV: the lobby (each setting is a whispered speech bubble, players are silhouettes that light
// up as they join), the question from the moon with the crowd typing, each anonymous answer
// floating up with the suspects underneath, the reveal (the author lights up: "!"), the wall
// of everything else, the awards. Phone: whisper your answer, guess who said it (Double Down
// once a game), keep a poker face when it's yours.
(function () {
  const { esc, timer } = BOX;
  // The game's own stylesheet, loaded once on whichever page shows the game.
  if (!document.querySelector('link[data-ws-css]') && !document.querySelector('link[href$="/games/whosaid.css"]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/box/games/whosaid.css'; l.dataset.wsCss = '1';
    document.head.appendChild(l);
  }
  // Phone drafts survive re-renders (kept here, not in the DOM).
  let draft = '', draftKey = '', editing = false, qdraft = '', ddOn = false, ddKey = '', lobbyErr = '';
  const seen = new Set();
  const once = (k) => { if (seen.has(k)) return false; seen.add(k); if (seen.size > 400) seen.clear(); return true; };
  const BUB = ['#fff3b0', '#c8f7e8', '#ffd6ec', '#e3d6ff', '#cfe9ff', '#ffe0c2'];
  const RIM = ['#9b7bff', '#7ef3d0', '#ff7ac8', '#ffd36e', '#6ec8ff'];
  const hash = (s) => { let h = 7; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) >>> 0; return h; };
  const bub = (k) => BUB[hash(k) % BUB.length];
  const rim = (k) => RIM[hash(k) % RIM.length];
  const tilt = (k, amp = 2) => (((hash(k) % 100) / 100) * 2 - 1) * amp;
  const nm = (o, n = 28) => (o ? (BOX.face ? BOX.face(o, n, { cls: 'wx-nmf' }) : o.av ? esc(o.av) : '') + ' ' + esc(o.name) : '');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const dots = '<span class="wx-dots"><i></i><i></i><i></i></span>';
  // A silhouette in the crowd: rim colour, their avatar as the face (lit = mint glow).
  // With a JustGameBox character (public/box/portrait.js) their face fills the head instead.
  const face = (o, n, opt) => (BOX.face ? BOX.face(o, n, opt) : esc((o && (o.av || o.avatar)) || '🙂'));
  const sil = (name, av, o = {}) => {
    const who = { id: o.pid, name, avatar: av }, big = /\bbig\b/.test(o.cls || '');
    const f = BOX.face && BOX.hasLook && BOX.hasLook(who) ? BOX.face(who, big ? 128 : 72, { fill: true, cls: 'wx-sface', mood: o.mood }) : '';
    return `<div class="wx-sil ${f ? 'has-face' : ''} ${o.cls || ''}" ${o.id ? `id="${esc(o.id)}"` : ''} style="--rim:${rim(name)};--s:${(o.s || 1).toFixed(2)};--d:${(o.d || 0).toFixed(2)}s">${o.over ? `<div class="wx-ohead">${o.over}</div>` : ''}<div class="wx-shead">${f || `<span>${esc(av || '🙂')}</span>`}</div><div class="wx-sbody"></div>${o.label !== false ? `<div class="wx-sname">${o.label || esc(name)}</div>` : ''}</div>`;
  };
  const scoreboard = (list) => `<aside class="wx-score"><h3>Who knows who</h3><div class="wx-rows">${(list || []).map((r, i) => `<div class="wx-row ${i === 0 && r.points > 0 ? 'lead' : ''}" style="--rim:${rim(r.name)}"><span class="wx-rk">${i + 1}</span><span class="wx-av">${face(r, 32, i === 0 && r.points > 0 ? { mood: 'grin' } : {})}</span><span class="wx-nm">${esc(r.name)}${r.fire ? ' 🔥' : ''}</span><b>${r.points}</b></div>`).join('')}</div></aside>`;
  const mood = (r) => (r.bluff ? `🎭 <b>BLUFF BADGE!</b> Nobody guessed ${esc(r.name)}!` : r.voted === 0 ? `Nobody guessed. It was ${esc(r.name)}!`
    : r.right > r.fooled ? `📖 ${plural(r.right, 'person')} saw right through ${esc(r.name)}!` : `🕵️ ${esc(r.name)} fooled ${r.fooled}!`);
  const moon = '<div class="wx-moon"><i></i><span>shhh…</span></div>';

  // ---------- TV lobby: whispered settings, the crowd lights up as people join ----------
  function lobbyTv(el, L) {
    const n = L.players.length, need = Math.max(0, L.min - n), F = L.fields || [];
    const bubbles = F.map((f, i) => {
      const cur = f.options.find((o) => String(o.value) === String(L.settings[f.key])) || f.options[0];
      return `<div role="button" tabindex="0" class="wx-set" data-cycle="${esc(f.key)}" style="--bg:${BUB[i % BUB.length]};--d:${(i * 0.7) % 3}s;--i:${i};--tl:${tilt(f.key, 2.5).toFixed(1)}deg">
        <span class="wx-setl">${esc(f.label)}</span><span class="wx-setv" id="wxv-${esc(f.key)}-${esc(String(cur.value))}">${esc(cur.label)}</span><span class="wx-seth">tap to change</span>
        <select data-set="${esc(f.key)}" tabindex="-1" aria-label="${esc(f.label)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`;
    }).join('');
    const shown = L.players.slice(0, 16);
    BOX.morph(el, `<div class="wx wx-lobby">
      <section class="wx-joinb">
        <div class="wx-qrwrap"><img id="qr" alt="QR code to join" src="${esc(L.qr)}"></div>
        <div class="wx-psst">psst… the room code is</div>
        <div class="wx-code" id="code">${esc(L.code)}</div>
        <div class="wx-url">${esc(L.joinUrl.replace(/^https?:\/\//, ''))}</div>
        <div class="wx-vip">${L.vip ? `👑 <b>${esc(L.vip)}</b> is the host` : 'The first to join is the host 👑'}</div>
      </section>
      <section class="wx-right">
        <div class="wx-logo"><span class="a">Who Said</span> <span class="b">It<span class="q">?</span></span></div>
        <div class="wx-tag">Everyone answers in secret. Then guess who said what.</div>
        <div class="wx-sets" id="settings">${bubbles}</div>
        <div class="wx-go"><button class="wx-start" id="start" ${need ? 'disabled' : ''}>🤫 Start whispering</button>
          <div class="wx-err" id="lobby-err">${esc(lobbyErr)}</div>
          <div class="wx-need">${need ? `Need ${need} more whisperer${need === 1 ? '' : 's'}` : `${plural(n, 'player')} in · the host can start from their phone`}</div>
          <div class="wx-links"><button class="wx-link" id="add-bots">+ add 5 test bots</button><button class="wx-link" id="rm-bots">remove bots</button><button class="wx-link" id="tv-switch">🎮 other game</button></div></div>
      </section>
      <section class="wx-crowdbar"><div class="wx-crowdl">The crowd <b>${n}</b></div>
        <div class="wx-roster" id="roster">${shown.map((p, i) => `<span class="chip wx-chip ${p.online ? '' : 'off'}" id="wxc-${esc(p.id)}" data-kick="${esc(p.id)}" title="Click to remove">${sil(p.name, p.avatar, { pid: p.id, cls: 'lit join', s: 0.92 + (hash(p.id) % 16) / 100 })}</span>`).join('') || '<div class="wx-empty">It’s quiet… too quiet. Scan the code to join the whispers.</div>'}${n > shown.length ? `<span class="wx-more">+${n - shown.length}</span>` : ''}</div>
        ${L.lineupHtml ? `<div class="wx-party">${L.lineupHtml}</div>` : ''}</section>
    </div>${moon}`);
    for (const s of el.querySelectorAll('select[data-set]')) { s.onchange = () => L.set(s.dataset.set, s.value); s.onclick = (e) => e.stopPropagation(); }
    for (const b of el.querySelectorAll('[data-cycle]')) b.onclick = () => { const s = b.querySelector('select'); s.selectedIndex = (s.selectedIndex + 1) % s.options.length; BOX.sfx('pop'); s.onchange(); };
    el.querySelector('#start').onclick = async () => { const r = await L.start(); lobbyErr = r && !r.ok ? r.error || 'Could not start.' : ''; const e = el.querySelector('#lobby-err'); if (e) e.textContent = lobbyErr; };
    el.querySelector('#add-bots').onclick = () => L.bots(5);
    el.querySelector('#rm-bots').onclick = () => L.removeBots();
    el.querySelector('#tv-switch').onclick = () => L.pick();
    for (const c of el.querySelectorAll('[data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) L.kick(c.dataset.kick); };
  }

  // ---------- TV ----------
  function suspects(sp, key) {
    const r = sp.result, voted = r ? Math.max(1, r.voted) : 1;
    return `<div class="ws-names wx-names n${sp.names.length} ${r ? 'done' : ''}" id="wsn-${key}-${r ? 'r' : 'q'}">${sp.names.map((n, i) => {
      const t = r ? r.tally[i] : 0, au = r && i === r.author;
      const over = r ? (au ? '<b class="wx-bang">!</b>' : `<span class="wx-tally">${t}</span>`) : '<b class="wx-q">?</b>';
      return `<div class="ws-chip wx-cand ${r ? (au ? 'author' : 'other') : ''}" style="--pct:${r ? Math.round((t / voted) * 100) : 0}%">${sil(n, (sp.avs || [])[i] || '', { pid: (sp.ids || [])[i], cls: au ? 'lit' : '', label: `<span class="wx-k">${'ABCD'[i]}</span>${esc(n)}`, over, s: 1.1 })}${au ? '<span class="ws-stamp wx-wrote">WROTE IT!</span>' : ''}${r && !au ? `<span class="wx-vbar"><i></i></span>` : ''}</div>`;
    }).join('')}</div>`;
  }

  function tvOver(el, s) {
    const w = s.standings[0], h = s.highlights || {};
    const awards = (s.awards || []).map((x, i) => `<div class="wx-award" style="--bg:${BUB[i % BUB.length]};--d:${0.9 + i * 0.3}s;--tl:${tilt(x.title, 3).toFixed(1)}deg"><div class="ic">${x.icon}</div><div class="t">${esc(x.title)}</div><div class="n">${nm(x)}</div><div class="v">${esc(x.value)}</div></div>`).join('');
    const hl = [h.bluff ? ['🎭 Best bluff', h.bluff, `fooled ${h.bluff.fooled} of ${h.bluff.voted}`] : null, h.easy ? ['📖 Dead giveaway', h.easy, `${h.easy.right} of ${h.easy.voted} knew it`] : null].filter(Boolean)
      .map(([t, x, v], i) => `<div class="wx-hl" style="--bg:${BUB[(i + 2) % BUB.length]}"><div class="wx-hlt">${t}</div><div class="wx-hlq">“${esc(x.text)}”</div><div class="wx-hln">${nm(x)} · ${v}</div></div>`).join('');
    BOX.morph(el, `<div class="wx wx-tv wx-over" data-phase="over"><section class="wx-overmain">
      <div class="wx-champ">${w ? sil(w.name, w.av, { pid: w.id, cls: 'lit big', over: '<b class="wx-bang">!</b>', label: false, mood: 'grin' }) : ''}<div><div class="wx-champl">They know you best…</div><h2>${w ? esc(w.name) : ''}</h2>${w ? `<div class="wx-pts">${w.points} pts</div>` : ''}</div></div>
      ${hl ? `<div class="wx-hls">${hl}</div>` : ''}${awards ? `<div class="wx-awards">${awards}</div>` : ''}
    </section>${scoreboard(s.standings)}</div>${moon}`);
  }

  function tv(el, s) {
    if (!s) return;
    if (s.phase === 'over') return tvOver(el, s);
    const top = `<header class="wx-top"><span class="wx-pill">Round ${s.round} of ${s.rounds}</span>${s.custom ? `<span class="wx-pill gold">👑 Asked by ${esc(s.host || 'the host')}</span>` : ''}${s.endsIn ? `<span class="wx-pill clock">${timer(s.endsIn)}</span>` : ''}</header>`;
    let main = '';
    if (s.phase === 'custom') {
      main = `<div class="wx-center"><div class="wx-bigq wx-in" id="wxc-${s.round}"><div class="wx-ql">Final round</div><div class="wx-qt">${esc(s.host || 'The host')} is writing a question just for this room ${dots}</div></div></div>`;
    } else if (s.phase === 'answer') {
      const done = new Set(s.waiting || []);
      main = `<div class="wx-center"><div class="wx-bigq wx-in" id="wsq-${s.round}-${esc(s.question || '').length}"><div class="wx-ql">Question ${s.round}</div><div class="wx-qt">${esc(s.question)}</div></div>
        <div class="wx-status">📱 Whisper your answer on your phone · <b>${s.answered}</b> / ${s.of}</div>
        <div class="wx-crowd">${(s.waiting || []).slice(0, 18).map((nme) => sil(nme, '', { over: `<span class="wx-typing">${dots}</span>`, id: `wxw-${nme}` })).join('')}${s.answered ? `<div class="wx-donebub" id="wxd-${s.answered}">🤫 ${plural(s.answered, 'secret')} in</div>` : ''}${(s.waiting || []).length > 18 ? `<span class="wx-more">+${s.waiting.length - 18}</span>` : ''}${!done.size ? '<div class="wx-allin">Everyone’s whispered! 🎉</div>' : ''}</div></div>`;
    } else if (s.spot) {
      const sp = s.spot, r = sp.result, key = `${s.round}:${sp.n}`;
      const status = r
        ? `<div class="ws-after wx-after" id="wsx-${key}-r"><div class="wx-banner ${r.bluff ? 'bluff' : ''}">${mood(r)}${r.authorPts ? ` <span class="wx-plus">+${r.authorPts}</span>` : ''}</div>
            <div class="wx-got">${r.first.length ? `✅ Got it: ${r.first.map(esc).join(', ')}${r.right > r.first.length ? ` +${r.right - r.first.length}` : ''}` : ''}${r.fires.length ? ` · 🔥 On fire: ${r.fires.map(esc).join(', ')}` : ''}</div></div>`
        : `<div class="wx-status">🗳️ Who said it? <b>${sp.voted}</b> / ${sp.of} guessed${s.notGuessed && s.notGuessed.length && sp.voted ? `<small>Still deciding: ${s.notGuessed.map(esc).join(', ')}</small>` : ''}</div>`;
      main = `<div class="wx-center"><div class="wx-qsmall">${esc(s.question)}</div>
        <div class="wx-spotn">Whisper ${sp.n} of ${sp.total}</div>
        <div class="ws-answer wx-answer ${r ? 'shown' : ''}" id="wsa-${key}" style="--bg:${bub(sp.text)}">${esc(sp.text)}</div>
        ${suspects(sp, key)}${status}</div>`;
    } else if (s.phase === 'wall') {
      const notes = s.wall.map((w, i) => `<div class="wx-note" style="--bg:${bub(w.text + i)};--tl:${tilt(w.text + i, 3).toFixed(1)}deg;--d:${(Math.min(i, 30) * 0.07).toFixed(2)}s"><div class="wx-nt">${esc(w.text)}</div><div class="wx-nn">— ${nm(w, 26)}</div></div>`).join('');
      main = `<div class="wx-center"><div class="wx-qsmall">${esc(s.question)}</div>
        ${s.wall.length ? `<h2 class="wx-wallh">Everything else that was whispered…</h2><div class="wx-wall" id="wsw-${s.round}">${notes}</div>${s.wallMore ? `<p class="wx-muted">…and ${s.wallMore} more whispers</p>` : ''}`
          : `<div class="wx-bigq wx-in"><div class="wx-ql">Round ${s.round} complete!</div><div class="wx-qt">${s.round >= s.rounds ? 'Final results coming up…' : 'Next question coming up…'}</div></div>`}</div>`;
    }
    BOX.morph(el, `<div class="wx wx-tv" data-phase="${esc(s.phase)}"><section class="wx-main">${top}<div class="wx-stage">${main}</div></section>${scoreboard(s.standings)}</div>${moon}`);
  }

  // ---------- phone ----------
  function phone(el, v, ctx) {
    if (!v) return;
    if (v.phase === 'over') {
      const st = v.stats || {};
      BOX.morph(el, `<div class="wx wx-ph" data-phase="over"><div class="wx-pcard wx-centered"><div class="wx-rank">#${v.rank}</div><h3>${v.rank === 1 ? 'You know them best!' : 'Game over!'}</h3><p class="wx-big">${v.points} points</p>
        ${(v.awards || []).map((a) => `<div class="wx-myaward">${a.icon} <b>${esc(a.title)}</b><small>${esc(a.value)}</small></div>`).join('')}
        <div class="wx-stats"><span>✅ ${st.correct}/${st.guesses} right</span><span>🕵️ fooled ${st.fooled}</span><span>🎭 ${plural(st.bluffs, 'bluff')}</span><span>🔥 best streak ${st.best}</span></div></div>
        <div class="wx-pcard">${(v.final || []).map((r, i) => `<div class="wx-row ${i === 0 ? 'lead' : ''}" style="--rim:${rim(r.name)}"><span class="wx-rk">${i + 1}</span><span class="wx-av">${face(r, 30)}</span><span class="wx-nm">${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</div></div>`);
      if (once('over:' + v.rank)) ctx.haptic(v.rank === 1 ? 'win' : 'big');
      return;
    }
    const head = `<div class="wx-me"><span class="wx-mypts">${v.points} pts <small>#${v.rank || '-'}</small></span>${v.streak >= 2 ? `<span class="wx-streak">🔥 ${v.streak} in a row</span>` : ''}<span class="wx-rnd">Round ${v.round}/${v.rounds}</span></div>`;
    const wrap = (phase, html) => `<div class="wx wx-ph" data-phase="${phase}">${head}${html}</div>`;

    if (v.phase === 'custom') {
      if (!v.isHost) { BOX.morph(el, wrap('waitask', `<div class="wx-qph"><div class="wx-ql">Final round</div>👑 ${esc(v.host || 'The host')} is writing the last question ${dots}</div><p class="wx-muted wx-centered">${timer(v.endsIn)}</p>`)); return; }
      if (once('ask:' + v.round)) ctx.haptic('turn');
      BOX.morph(el, wrap('ask', `<div class="wx-pcard"><h3>👑 You ask the final question! ${timer(v.endsIn)}</h3><p class="wx-muted">Everyone will answer it, then guess who said what.</p>
        <input id="ws-q" class="wx-input" maxlength="${v.qmax}" placeholder="What’s something you’ve never told this group?" value="${esc(qdraft)}">
        <button class="wx-btn big" id="ws-ask">Ask it!</button><button class="wx-btn ghost" id="ws-surprise">🎲 Surprise me (random question)</button></div>`));
      const q = el.querySelector('#ws-q'); q.oninput = () => { qdraft = q.value; };
      el.querySelector('#ws-ask').onclick = async () => { const r = await ctx.act({ op: 'question', text: q.value }); if (r.ok) { qdraft = ''; ctx.sfx('chime'); ctx.haptic('success'); } };
      el.querySelector('#ws-surprise').onclick = () => { ctx.act({ op: 'surprise' }); ctx.haptic('select'); };
      return;
    }

    if (v.phase === 'answer') {
      const k = v.round + ':' + v.question;
      if (draftKey !== k) { draftKey = k; draft = ''; editing = false; }
      if (once('q:' + k)) ctx.haptic('turn');
      const qcard = `<div class="wx-qph"><div class="wx-ql">Question ${v.round}</div>${esc(v.question)}</div>`;
      if (v.answered && !editing) {
        BOX.morph(el, wrap('locked', `${qcard}<div class="wx-mine" style="--bg:${bub(v.myAnswer || '')}"><div class="wx-ml">your secret 🤫</div>“${esc(v.myAnswer)}”</div><div class="wx-lock">Locked in! ✅</div>
          <p class="wx-muted wx-centered">Keep it secret… ${timer(v.endsIn)}</p><button class="wx-btn ghost" id="ws-edit">✏️ Change my answer</button>`));
        el.querySelector('#ws-edit').onclick = () => { editing = true; draft = v.myAnswer; ctx.redraw(); };
        return;
      }
      BOX.morph(el, wrap('answer', `${qcard}<div class="wx-whisper"><div class="wx-row2"><b>Whisper your answer</b>${timer(v.endsIn)}</div>
        <input id="ws-a" class="wx-input" maxlength="${v.max}" placeholder="Be honest… or be sneaky" value="${esc(draft)}" autocomplete="off">
        <div class="wx-row2"><small>🤫 Nobody will see your name.</small><small class="ws-count">${draft.length}/${v.max}</small></div>
        <button class="wx-btn big" id="ws-send">Whisper it 🤫</button></div>`));
      const a = el.querySelector('#ws-a'), cnt = el.querySelector('.ws-count');
      a.oninput = () => { draft = a.value; cnt.textContent = `${draft.length}/${v.max}`; };
      a.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.querySelector('#ws-send').click(); } };
      el.querySelector('#ws-send').onclick = async () => {
        draft = a.value; if (!draft.trim()) { ctx.haptic('error'); return ctx.toast('Type an answer first.'); }
        const r = await ctx.act({ op: 'answer', text: draft });
        if (r.ok) { editing = false; ctx.sfx('pop'); ctx.haptic('success'); a.blur(); ctx.redraw(); }
      };
      return;
    }

    if (v.spot) {
      const sp = v.spot, key = v.round + ':' + sp.n;
      if (ddKey !== key) { ddKey = key; ddOn = false; }
      const ans = `<div class="wx-ansph" style="--bg:${bub(sp.text)}"><div class="wx-ml">whisper ${sp.n} of ${sp.total}</div>“${esc(sp.text)}”</div>`;
      if (v.phase === 'reveal' && sp.result) {
        const r = sp.result, g = sp.gain;
        let card, good;
        if (sp.mine) { good = r.fooled > 0; card = `${sil(v.me ? v.me.name : 'me', '', { cls: good ? 'lit big' : 'big', label: false, over: good ? '<b class="wx-bang">!</b>' : '<b class="wx-q">?</b>' })}<h3>${r.bluff ? '🎭 Bluff badge! Nobody guessed you!' : r.fooled ? `😈 You fooled ${r.fooled}!` : '📖 They know you too well!'}</h3>${r.authorPts ? `<div class="wx-gain plus">+${r.authorPts}</div>` : ''}`; }
        else if (!g) { good = null; card = `<h3>⏰ You didn’t guess</h3><p>It was <b>${esc(r.name)}</b></p>`; }
        else { good = g.right; card = `<div class="wx-verdict ${g.right ? 'ok' : 'no'}">${g.right ? '🎯 You got it!' : '😵 Fooled!'}</div><p>It was <b>${esc(r.name)}</b></p>
          <div class="wx-gain ${g.pts > 0 ? 'plus' : g.pts < 0 ? 'minus' : ''}">${g.pts > 0 ? '+' : ''}${g.pts}</div>
          <div class="wx-tags">${g.speed ? '<span>⚡ speed bonus</span>' : ''}${g.dd ? `<span>🎲 double down${g.right ? '' : ' (−50)'}</span>` : ''}${g.fire ? '<span>🔥 3 in a row! +50</span>' : ''}</div>`; }
        BOX.morph(el, wrap('result', `${ans}<div class="wx-pcard wx-centered wx-result" id="wsr-${key}">${card}</div>`));
        if (once('ps:' + key)) { ctx.sfx(good ? 'chime' : 'shrug'); ctx.haptic(sp.mine ? (r.bluff ? 'win' : good ? 'success' : 'buzz') : good == null ? 'warn' : good ? (g.fire ? 'win' : 'success') : 'error'); }
        return;
      }
      if (sp.mine) {
        if (once('mine:' + key)) ctx.haptic('buzz');
        BOX.morph(el, wrap('poker', `${ans}<div class="wx-pcard wx-centered wx-poker"><div class="wx-pokerface">😐</div><h3>That’s yours! Keep a poker face…</h3><p class="wx-muted">${sp.voted}/${sp.of} guessed ${timer(v.endsIn)}</p></div>`));
        return;
      }
      if (sp.myPick != null) {
        BOX.morph(el, wrap('guessed', `${ans}<div class="wx-pcard wx-centered"><div class="wx-picked">${sil(sp.names[sp.myPick], (sp.avs || [])[sp.myPick] || '', { pid: (sp.ids || [])[sp.myPick], cls: 'lit', label: false, over: '<b class="wx-q">?</b>' })}</div><h3>You think: ${esc(sp.names[sp.myPick])}</h3>${sp.myDd ? '<p class="wx-dd-on">🎲 Doubled down!</p>' : ''}<p class="wx-muted">${sp.voted}/${sp.of} guessed ${timer(v.endsIn)}</p></div>`));
        return;
      }
      if (once('spot:' + key)) ctx.haptic('tap');
      BOX.morph(el, wrap('guess', `${ans}<div class="wx-row2 wx-who"><b>Who said it?</b>${timer(v.endsIn)}</div>
        ${v.canDd ? `<button class="wx-dd ${ddOn ? 'on' : ''}" id="ws-dd">🎲 Double Down ${ddOn ? 'ON: 2× points, −50 if wrong' : '(once per game)'}</button>` : ''}
        <div class="wx-picks n${sp.names.length}">${sp.names.map((n, i) => `<button class="wx-pick" data-k="${i}" style="--rim:${rim(n)}">${sil(n, (sp.avs || [])[i] || '', { pid: (sp.ids || [])[i], label: false })}<span class="wx-pn"><span class="wx-k">${'ABCD'[i]}</span>${esc(n)}</span></button>`).join('')}</div>`));
      const dd = el.querySelector('#ws-dd'); if (dd) dd.onclick = () => { ddOn = !ddOn; ctx.haptic(ddOn ? 'warn' : 'tap'); ctx.redraw(); };
      for (const b of el.querySelectorAll('[data-k]')) b.onclick = async () => {
        for (const x of el.querySelectorAll('[data-k]')) x.disabled = true;
        b.classList.add('sel'); ctx.haptic('select');
        const r = await ctx.act({ op: 'guess', pick: Number(b.dataset.k), dd: ddOn && v.canDd });
        if (r.ok) ctx.sfx(ddOn ? 'unlock' : 'click'); else ctx.redraw();
      };
      return;
    }

    if (v.phase === 'wall') {
      BOX.morph(el, wrap('wall', `<div class="wx-pcard wx-centered"><h3>Round ${v.round} done!</h3><p>You’re <b>#${v.rank}</b> of ${v.of}. ${v.round >= v.rounds ? 'Final results next…' : 'Next question coming…'}</p></div>${v.myAnswer ? `<div class="wx-mine" style="--bg:${bub(v.myAnswer)}"><div class="wx-ml">you whispered</div>“${esc(v.myAnswer)}”</div>` : ''}`));
      return;
    }
    BOX.morph(el, wrap('watch', `<div class="wx-pcard wx-centered"><h3>👀 Watch the big screen…</h3></div>`));
  }

  BOX.games.whosaid = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => ({ custom: 'think', answer: 'think', spot: 'play', reveal: 'reveal', wall: 'reveal', over: 'finale' }[s.phase] || 'play'),
    name: 'Who Said It?', icon: '🗣️',
    about: 'Everyone answers a question anonymously. Then guess who wrote each answer. How well do you really know each other?',
    how: [
      'A question goes up on the big screen. Everyone types an answer on their phone. Nobody sees whose is whose.',
      'Answers go into the spotlight one at a time. Pick who you think wrote it from the names on your phone.',
      'Right guess: +100 (+50 if you were one of the fastest). Three right in a row: 🔥 +50.',
      'Wrote it? Keep a poker face! You get +50 for everyone you fool, and a 🎭 Bluff badge if nobody guesses you.',
      'Once a game you can 🎲 Double Down: double points if you’re right, −50 if you’re wrong.',
    ],
    fx: { round: 'swell', in: 'pop', spot: 'whoosh', drum: 'drum', wall: 'chime', unlock: 'unlock', win: 'win' },
    onFx(f) { if (f.kind === 'drum') setTimeout(() => BOX.sfx(f.bluff ? 'gasp' : f.crowd ? 'cheer' : 'laugh'), 1400); },
    lobbyTv,
    lobby: () => `<div class="wx wx-phlobby"><div class="wx-qph"><div class="wx-ql">psst…</div>Get ready to whisper. Nobody will know it was you ${dots}</div></div>`,
    tv,
    // JustGold gear: this game's phone theme, a frame and badge over your screen (public/shared/gear.js).
    phone(el, v, ctx, view) { if (window.MT_GEAR) window.MT_GEAR.phoneTheme(el, view, 'whosaid'); if (view && view.me && v) v.me = view.me; phone(el, v, ctx); },
  };
})();
