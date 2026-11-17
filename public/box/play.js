'use strict';
// JustGameBox phone: join with the room code (from the QR link), a name and an avatar, then
// the game's own phone renderer takes over. Reconnects with a saved token after a refresh.
// The same room lasts the whole night: when the host picks another game, this page simply
// switches renderer. The header has reactions (they float up on the TV), How to play, and
// for the host a menu (skip ahead, end the game, bots, pick the next game).
(function () {
  const $ = (s) => document.querySelector(s);
  const { esc } = BOX;
  const params = new URLSearchParams(location.search);
  const AVATARS = ['🦊', '🐸', '🐼', '🐙', '🦄', '🐯', '🐵', '🐧', '🦉', '🐢', '🦁', '🐨', '🐷', '🐰', '🐻', '🦖', '👽', '👻', '🎃', '🌵', '🍕', '🍩', '⭐', '🔥'];
  const REACTIONS = ['😂', '😮', '😍', '👏', '🔥', '😱', '💀', '🤔', '👎', '🎉'];
  // Big games have their own look on the phone too (/ducks/play, or once we know the game).
  const theme = (key) => {
    document.body.className = document.body.className.replace(/\bg-[a-z]+\b/g, '').trim();
    const g = key && BOX.games[key];
    if (g) document.body.classList.add('g-' + key); // every game styles its own phone screens
    if (g && g.standalone) document.title = g.name; else document.title = g ? g.name + ' · JustGameBox' : 'JustGameBox';
    const h = document.querySelector('.ph-join h1'); if (h && g && g.standalone) h.textContent = g.icon + ' ' + g.name;
  };
  theme(location.pathname.split('/')[1]);
  const socket = io('/box', { transports: ['websocket', 'polling'] });
  let me = null, view = null, G = null, gameKey = null, toastT = 0, renderQueued = false, lastRender = 0;
  const tokenKey = (code) => 'box.p.' + code;
  const load = (code) => { try { return JSON.parse(localStorage.getItem(tokenKey(code)) || 'null'); } catch { return null; } };
  const store = (code, v) => { try { localStorage.setItem(tokenKey(code), JSON.stringify(v)); localStorage.setItem('box.name', v.name); } catch { /* private */ } };
  const getAv = () => { try { return localStorage.getItem('box.avatar'); } catch { return null; } };
  let avatar = AVATARS.includes(getAv()) ? getAv() : AVATARS[Math.floor(Math.random() * AVATARS.length)];

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
  const act = (msg) => new Promise((res) => socket.emit('player:act', msg, (r) => { r = r || { ok: false, error: 'No answer from the server.' }; if (!r.ok && r.error) { toast(r.error); haptic('error'); } res(r); }));
  // Moves that take a moment (search, picking a video): no toast here, the game shows its own message.
  const actAsync = (msg) => new Promise((res) => socket.emit('player:async', msg, (r) => res(r || { ok: false, error: 'No answer from the server.' })));
  const vibrate = (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* no */ } };
  // ctx.haptic('success' | 'error' | 'turn' | 'win' | 'select' | 'buzz' | …): see /haptics.js.
  const haptic = (kind) => { try { window.HAPTIC && window.HAPTIC.play(kind); } catch { /* none */ } };
  const ctx = { act, actAsync, toast, sfx: BOX.sfx, vibrate, haptic };
  const hostDo = (type, extra = {}) => new Promise((res) => socket.emit('player:host', { type, ...extra }, (r) => { if (r && !r.ok && r.error) toast(r.error); res(r || { ok: false }); }));
  // Long-press must not open the copy/save menu or select the page (mini-games use holds).
  document.addEventListener('contextmenu', (e) => { if (!(e.target.closest && e.target.closest('input, textarea'))) e.preventDefault(); });

  // ---------- join ----------
  function avatarPicker() {
    const box = $('#j-av');
    box.innerHTML = AVATARS.map((a) => `<button type="button" class="${a === avatar ? 'on' : ''}" data-av="${a}">${a}</button>`).join('');
    for (const b of box.querySelectorAll('[data-av]')) b.onclick = () => { avatar = b.dataset.av; try { localStorage.setItem('box.avatar', avatar); } catch { /* */ } avatarPicker(); };
  }
  function showJoin(err) {
    $('#join').hidden = false; $('#game').hidden = true;
    const code = (params.get('room') || '').toUpperCase();
    if (code && !$('#j-code').value) $('#j-code').value = code;
    try { if (!$('#j-name').value) $('#j-name').value = localStorage.getItem('box.name') || ''; } catch { /* private */ }
    $('#j-err').textContent = err || '';
    avatarPicker();
    if ($('#j-code').value.length === 4) socket.emit('room:check', { code: $('#j-code').value }, (r) => { $('#j-game').textContent = r && r.ok ? 'Joining ' + r.title : ''; if (r && r.ok) theme(r.game); });
  }
  function setGame(key) {
    if (key === gameKey) return;
    gameKey = key; G = BOX.games[key] || null; theme(key);
    if (me) history.replaceState(null, '', (G && G.standalone ? '/' + key + '/play' : '/box/play') + '?room=' + me.code);
    $('#h-game').textContent = G ? G.icon : ''; $('#h-game').title = G ? G.name : '';
    $('#g-body').innerHTML = ''; window.scrollTo(0, 0);
  }
  function join(code, name, token) {
    socket.emit('player:join', { code, name, token, avatar }, (r) => {
      if (!r || !r.ok) { if (token) { try { localStorage.removeItem(tokenKey(code)); } catch { /* */ } return showJoin(); } return showJoin(r && r.error); }
      me = { code: r.code, id: r.id, token: r.token, name: name || (load(r.code) || {}).name };
      store(r.code, { token: r.token, name: me.name });
      gameKey = null; setGame(r.game);
      $('#join').hidden = true; $('#game').hidden = false;
      try { SFX.unlock(); } catch { /* */ }
    });
  }
  $('#j-go').onclick = () => {
    const code = $('#j-code').value.trim().toUpperCase(), name = $('#j-name').value.trim();
    if (code.length !== 4) return void ($('#j-err').textContent = 'Enter the 4-letter code from the big screen.');
    if (!name) return void ($('#j-err').textContent = 'Type your name.');
    join(code, name, null);
  };
  $('#j-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); if (e.target.value.length === 4) showJoin(); });
  $('#j-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#j-go').click(); });
  $('#h-leave').onclick = () => { if (!confirm('Leave this game?')) return; socket.emit('player:leave', {}, () => { try { localStorage.removeItem(tokenKey(me.code)); } catch { /* */ } me = null; showJoin(); }); };

  // ---------- sheets: How to play, host menu, avatar, next game ----------
  function sheet(html, bind) {
    const s = $('#ph-sheet'), bg = $('#sheet-bg');
    s.innerHTML = `<button class="sheet-x" data-x>✕</button>${html}`; s.hidden = false; bg.hidden = false;
    const close = () => { s.hidden = true; bg.hidden = true; };
    bg.onclick = close; for (const x of s.querySelectorAll('[data-x]')) x.onclick = close;
    if (bind) bind(s, close);
  }
  $('#h-help').onclick = () => {
    if (!G) return;
    sheet(`<h2>${G.icon} How to play ${esc(G.name)}</h2><p class="muted">${esc(G.about || '')}</p><ol class="how">${(G.how || []).map((h) => `<li>${esc(h)}</li>`).join('')}</ol>`);
  };
  $('#h-me').onclick = () => {
    const hz = window.HAPTIC && window.HAPTIC.supported ? `<h3>📳 Vibration</h3><button class="btn ${window.HAPTIC.enabled ? 'green' : 'ghost'}" id="hz">${window.HAPTIC.enabled ? 'On: tap to turn off' : 'Off: tap to turn on'}</button>` : '';
    sheet(`<h2>Pick your avatar</h2><div class="j-av big">${AVATARS.map((a) => `<button class="${view && view.me.avatar === a ? 'on' : ''}" data-av="${a}">${a}</button>`).join('')}</div>${hz}`, (s, close) => {
      const hb = s.querySelector('#hz'); if (hb) hb.onclick = () => { window.HAPTIC.set(!window.HAPTIC.enabled); close(); toast(window.HAPTIC.enabled ? '📳 Vibration on' : 'Vibration off'); };
      for (const b of s.querySelectorAll('[data-av]')) b.onclick = () => { avatar = b.dataset.av; try { localStorage.setItem('box.avatar', avatar); } catch { /* */ } socket.emit('player:avatar', { avatar }, () => {}); close(); };
    });
  };
  // Games the room can switch to (the ones this page knows how to draw).
  const SWITCHABLE = ['president', 'blanks', 'blackjack', 'bid', 'price', 'emoji', 'truths', 'likely', 'whosaid', 'spectrum', 'sketch', 'funny', 'zombie', 'ducks', 'kingdoms'];
  const LOCKABLE = { zombie: 'Finish a Party Mode to unlock it.' };
  function gamePicker() {
    const list = SWITCHABLE.filter((k) => BOX.games[k] && k !== gameKey);
    sheet(`<h2>🎮 Pick the next game</h2><p class="muted">Everyone stays in. Same code, party points carry on.</p><div class="pick-games">${list.map((k) => { const lk = LOCKABLE[k] && !((view && view.unlocks) || []).includes(k); return `<button data-game="${k}" ${lk ? 'disabled class="locked"' : ''}><span>${lk ? '🔒' : BOX.games[k].icon}</span><b>${esc(BOX.games[k].name)}</b>${lk ? `<small>${esc(LOCKABLE[k])}</small>` : ''}</button>`; }).join('')}</div>`, (s, close) => {
      for (const b of s.querySelectorAll('[data-game]')) b.onclick = async () => { close(); const r = await hostDo('switch', { game: b.dataset.game }); if (r.ok) BOX.sfx('start'); };
    });
  }
  $('#h-menu').onclick = () => {
    if (!view || !view.vip) return;
    const running = view.phase === 'show' || (view.phase === 'game' && !(view.state && view.state.phase === 'over'));
    sheet(`<h2>👑 Host menu</h2><div class="host-menu">
      ${running ? '<button class="btn ghost" data-do="next">⏩ Skip ahead</button><button class="btn ghost" data-do="lobby">⏹ End this game</button>' : ''}
      ${!running ? '<button class="btn" data-do="pick">🎮 Pick another game</button>' : ''}
      <button class="btn ghost" data-do="bots">🤖 Add 5 bots</button><button class="btn ghost" data-do="nobots">Remove bots</button></div>`, (s, close) => {
      for (const b of s.querySelectorAll('[data-do]')) b.onclick = () => {
        const d = b.dataset.do; close();
        if (d === 'pick') return gamePicker();
        if (d === 'lobby' && !confirm('End this game for everyone and go back to the lobby?')) return;
        hostDo(d);
      };
    });
  };
  // Reactions: a small tray under the header; each tap floats up on the TV.
  $('#h-react').onclick = () => {
    const t = $('#react-tray'); t.hidden = !t.hidden;
    if (!t.hidden && !t.dataset.built) {
      t.dataset.built = '1';
      t.innerHTML = REACTIONS.map((e) => `<button data-r="${e}">${e}</button>`).join('');
      for (const b of t.querySelectorAll('[data-r]')) b.onclick = () => { socket.emit('player:react', { e: b.dataset.r }, () => {}); vibrate(12); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); };
    }
  };

  socket.on('connect', () => {
    $('#offline').hidden = true;
    const code = (me && me.code) || (params.get('room') || '').toUpperCase();
    const s = code && load(code);
    if (s && s.token) join(code, s.name, s.token); else if (!me) showJoin();
  });
  socket.on('disconnect', () => { $('#offline').hidden = false; });
  socket.on('me', (v) => {
    const view0 = view; view = v; v._at = Date.now();
    if (view0 && v.unlocks && view0.unlocks && v.unlocks.length > view0.unlocks.length) { const k = v.unlocks.find((x) => !view0.unlocks.includes(x)); const g = BOX.games[k]; toast(`🔓 New game unlocked: ${g ? g.icon + ' ' + g.name : k}!`); haptic('win'); }
    if (v.phase !== (view0 && view0.phase) && v.phase === 'show') haptic('big');
    if (v.game !== gameKey) { setGame(v.game); haptic('success'); toast(`${G ? G.icon + ' ' : ''}Next game: ${v.title}!`); vibrate(80); }
    $('#h-name').textContent = v.me.name; $('#h-av').textContent = v.me.avatar || '';
    queue();
  });

  // Draw at most ~6 times a second, and never while the player is typing.
  function queue() {
    if (renderQueued) return; renderQueued = true;
    const wait = Math.max(0, 160 - (Date.now() - lastRender));
    setTimeout(() => { renderQueued = false; draw(); }, wait);
  }
  function bars() {
    // Jackbox-style host bar: the first player to join starts the game from their phone.
    const vb = $('#vip-bar'), over = view.state && view.state.phase === 'over';
    $('#h-menu').hidden = !view.vip;
    const PM = view.partyMode;
    if (view.vip && PM && over && PM.phase !== 'done') {
      // Party Mode: the lineup carries on by itself; the host can hurry it or hold it.
      const html = `<span>👑 Party host</span><button class="btn green" data-vip="partyNext">⏩ Next game now</button><button class="btn ghost small" data-vip="partyPause">${PM.paused ? '▶ Resume' : '⏸ Wait'}</button>`;
      if (vb.dataset.html !== html) { vb.innerHTML = html; vb.dataset.html = html; for (const b of vb.querySelectorAll('[data-vip]')) b.onclick = () => hostDo(b.dataset.vip); }
      vb.hidden = false;
    } else if (view.vip && PM && PM.phase === 'done') {
      const html = '<span>👑 Party host</span><button class="btn green" data-vip="partyAgain">🔁 Party again</button><button class="btn small" data-vip="pick">🎮 Pick a game</button>';
      if (vb.dataset.html !== html) { vb.innerHTML = html; vb.dataset.html = html; for (const b of vb.querySelectorAll('[data-vip]')) b.onclick = () => (b.dataset.vip === 'pick' ? gamePicker() : hostDo(b.dataset.vip)); }
      vb.hidden = false;
    } else if (view.vip && (view.phase === 'lobby' || over)) {
      const can = view.count >= view.min;
      const html = view.phase === 'lobby'
        ? `<span>👑 You’re the host</span><button class="btn green" data-vip="start" ${can ? '' : 'disabled'}>Start game ▶</button><button class="btn ghost small" data-vip="pick">🎮 Other game</button>${can ? '' : `<small>Needs ${view.min}+ players (add bots in ⚙️)</small>`}`
        : '<span>👑 You’re the host</span><button class="btn green" data-vip="again">Play again ▶</button><button class="btn small" data-vip="pick">🎮 Next game</button><button class="btn ghost small" data-vip="lobby">Lobby</button>';
      if (vb.dataset.html !== html) {
        vb.innerHTML = html; vb.dataset.html = html;
        for (const b of vb.querySelectorAll('[data-vip]')) b.onclick = () => (b.dataset.vip === 'pick' ? gamePicker() : hostDo(b.dataset.vip));
      }
      vb.hidden = false;
    } else vb.hidden = true;
    // Party points across the night (once at least one game has finished).
    const pb = $('#party-bar'), P = view.party;
    if (P && P.played && P.of && (view.phase === 'lobby' || over)) {
      const html = `<span>🎉 Party points</span><b>${P.pts}</b><span class="muted">#${P.rank || '-'} of ${P.of} · ${P.played} game${P.played === 1 ? '' : 's'}</span>${P.top && P.top[0] ? `<span class="lead">👑 ${esc(P.top[0].avatar || '')} ${esc(P.top[0].name)} ${P.top[0].pts}</span>` : ''}`;
      if (pb.dataset.html !== html) { pb.innerHTML = html; pb.dataset.html = html; }
      pb.hidden = false;
    } else pb.hidden = true;
  }
  function draw() {
    if (!view || !G) return;
    const a = document.activeElement;
    if (a && a.tagName === 'INPUT' && $('#g-body').contains(a)) { setTimeout(queue, 400); return; }
    lastRender = Date.now();
    bars();
    if (view.phase === 'show' && view.show) { showPhone(view.show); return; }
    if (view.partyMode && (view.partyMode.phase === 'board' || view.partyMode.phase === 'done')) { partyPhone(view); return; }
    if (view.phase === 'lobby' && view.live && view.state) { G.phone($('#g-body'), view.state, ctx, view); return; }
    if (view.phase === 'lobby') {
      BOX.morph($('#g-body'), `<div class="card-box ph-lobby"><div class="big-av">${esc(view.me.avatar || '🙂')}</div><h3>You’re in! 🎉</h3><p>${view.vip ? 'You’re the host! Press <b>Start game</b> when everyone is in.' : `Waiting for ${view.vipName ? '<b>' + esc(view.vipName) + '</b> (the host)' : 'the host'} to start <b>${esc(view.title)}</b>.`}</p><p class="muted">${view.count} player${view.count === 1 ? '' : 's'} so far. Watch the big screen.</p><button class="btn ghost small" id="lob-how">❓ How to play ${esc(G.name)}</button></div>${G.lobby ? G.lobby(view, ctx) : ''}`);
      const lh = $('#lob-how'); if (lh) lh.onclick = () => $('#h-help').click();
      if (G.lobbyBind) G.lobbyBind($('#g-body'), view, ctx);
      return;
    }
    G.phone($('#g-body'), view.state, ctx, view);
  }
  // ---------- Party Mode: the standings between games ----------
  function partyPhone(v) {
    const P = v.party, PM = v.partyMode, done = PM.phase === 'done';
    const nextKey = PM.next, nx = nextKey && BOX.games[nextKey];
    BOX.morph($('#g-body'), `<div class="card-box pp-card ${done ? 'pp-done' : ''}">
      <div class="pp-rank">${done && P.rank === 1 ? '👑' : '#' + (P.rank || '-')}</div>
      <h3>${done ? (P.rank === 1 ? 'You’re the party champion!' : `You finished #${P.rank} of ${P.of}`) : `You’re #${P.rank || '-'} of ${P.of}`}</h3>
      <p class="pp-pts"><b>${P.pts}</b> party points${P.gain && !done ? ` <span class="pp-gain">+${P.gain}</span>` : ''} · ⭐ ${P.wins || 0} win${P.wins === 1 ? '' : 's'}</p>
      <div class="board">${(P.top || []).map((r, i) => `<div class="row ${r.id === v.me.id ? 'me' : ''}"><span class="n">${i + 1}</span><span>${esc(r.avatar || '')} ${esc(r.name)}</span><b>${r.pts}</b></div>`).join('')}</div>
      <p class="muted">${done ? `${P.played} games played tonight. What a party! 🎉` : nx ? `Up next: <b>${nx.icon} ${esc(nx.name)}</b>${PM.paused ? ' (the host is holding it)' : ` in ${BOX.timer(PM.in)}`}` : ''}</p></div>`);
    if (!partyPhone.seen || partyPhone.seen !== PM.phase + PM.index) { partyPhone.seen = PM.phase + PM.index; haptic(done && P.rank === 1 ? 'win' : 'success'); }
  }
  // ---------- game-show opening: you're a contestant! ----------
  const STARTERS = ['My secret talent is…', 'I’m weirdly scared of…', 'I once got lost in…', 'My most useless skill:', 'I could eat ___ every day', 'Nobody knows I…'];
  let factDraft = '', factEdit = false;
  function showPhone(sh) {
    const body = $('#g-body');
    if (sh.step === 'facts' && (!sh.myFact || factEdit)) {
      BOX.morph(body, `<div class="card-box sh-card"><div class="sh-mic">🎤</div><h3>You’re a contestant on <b>${esc(sh.title)}</b>!</h3>
        <p>Tell the host a funny fact about you. It goes up on the big screen when they introduce you.</p>
        <input id="sh-fact" class="sh-input" maxlength="90" placeholder="e.g. I once won a hot-dog contest" value="${esc(factDraft)}" autocomplete="off">
        <div class="sh-ideas">${STARTERS.map((s) => `<button class="chip" data-start="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        <button class="btn big green" id="sh-send">Send to the host 🎤</button>
        <p class="muted small">${sh.submitted} of ${sh.of} contestants ready · ${BOX.timer(sh.endsIn)}</p></div>`);
      const inp = $('#sh-fact'); inp.oninput = () => { factDraft = inp.value; };
      inp.onkeydown = (e) => { if (e.key === 'Enter') $('#sh-send').click(); };
      for (const b of body.querySelectorAll('[data-start]')) b.onclick = () => { factDraft = b.dataset.start.replace('…', ' ').replace('___', '').replace(':', ': '); inp.value = factDraft; inp.focus(); inp.setSelectionRange(factDraft.length, factDraft.length); };
      $('#sh-send').onclick = async () => { const t = inp.value.trim(); if (!t) return toast('Type a funny fact first!'); const r = await act({ op: 'fact', text: t }); if (r.ok) { factEdit = false; inp.blur(); vibrate(30); BOX.sfx('chime'); ctx.redraw(); } };
      return;
    }
    if (sh.step === 'facts') {
      BOX.morph(body, `<div class="card-box sh-card"><div class="sh-mic">✅</div><h3>The host has your fact!</h3><p class="sh-fact">“${esc(sh.myFact)}”</p>
        <button class="btn ghost small" id="sh-edit">✏️ Change it</button><p class="muted small">${sh.submitted} of ${sh.of} contestants ready. Watch the big screen!</p></div>`);
      $('#sh-edit').onclick = () => { factEdit = true; factDraft = sh.myFact; ctx.redraw(); };
      return;
    }
    const left = sh.introIn == null ? null : sh.introIn - (Date.now() - view._at);
    const now = left != null && left <= 0 && left > -(sh.perMs || 5200) * (sh.mode === 'cast' ? 3 : 1);
    BOX.morph(body, `<div class="card-box sh-card ${now ? 'sh-now' : ''}"><div class="sh-mic">${now ? '🌟' : '📺'}</div>
      <h3>${now ? 'That’s you on the TV! Wave! 👋' : sh.mode === 'cast' ? 'Get ready: ' + esc(sh.title) + ' is starting!' : 'Meet the contestants!'}</h3>
      ${sh.myFact ? `<p class="sh-fact">“${esc(sh.myFact)}”</p>` : ''}
      <p class="muted">${sh.mode === 'cast' ? 'Watch the big screen for the intro.' : sh.featured ? (left > 0 ? 'The host will introduce you in a moment…' : 'You’ve been introduced!') : 'Watch the big screen. The game starts in a moment.'}</p></div>`);
    if (now && !showPhone.buzzed) { showPhone.buzzed = true; vibrate([60, 40, 60]); }
    if (!now) showPhone.buzzed = false;
  }
  setInterval(() => { if (view && view.phase === 'show') queue(); }, 500); // intros run on the clock
  ctx.redraw = () => { lastRender = 0; draw(); };
})();
