'use strict';
// JustGameBox phone: join with the room code (from the QR link) and a name, then the
// game's own phone renderer takes over. Reconnects with a saved token after a refresh.
(function () {
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  // Big games have their own look on the phone too (/ducks/play, or once we know the game).
  const theme = (key) => { if (key && BOX.games[key] && BOX.games[key].standalone) { document.body.classList.add('g-' + key); const b = document.querySelector('.ph-join h1'); if (b) b.textContent = BOX.games[key].icon + ' ' + BOX.games[key].name; document.title = BOX.games[key].name; } };
  theme(location.pathname.split('/')[1]);
  const socket = io('/box', { transports: ['websocket', 'polling'] });
  let me = null, view = null, G = null, toastT = 0, renderQueued = false, lastRender = 0;
  const tokenKey = (code) => 'box.p.' + code;
  const load = (code) => { try { return JSON.parse(localStorage.getItem(tokenKey(code)) || 'null'); } catch { return null; } };
  const store = (code, v) => { try { localStorage.setItem(tokenKey(code), JSON.stringify(v)); localStorage.setItem('box.name', v.name); } catch { /* private */ } };

  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }
  const act = (msg) => new Promise((res) => socket.emit('player:act', msg, (r) => { r = r || { ok: false, error: 'No answer from the server.' }; if (!r.ok && r.error) toast(r.error); res(r); }));
  // Moves that take a moment (search, picking a video): no toast here, the game shows its own message.
  const actAsync = (msg) => new Promise((res) => socket.emit('player:async', msg, (r) => res(r || { ok: false, error: 'No answer from the server.' })));
  // Long-press must not open the copy/save menu or select the page (mini-games use holds).
  document.addEventListener('contextmenu', (e) => { if (!(e.target.closest && e.target.closest('input, textarea'))) e.preventDefault(); });
  const ctx = { act, actAsync, toast, sfx: BOX.sfx, vibrate: (ms) => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* no */ } } };

  function showJoin(err) {
    $('#join').hidden = false; $('#game').hidden = true;
    const code = (params.get('room') || '').toUpperCase();
    if (code && !$('#j-code').value) $('#j-code').value = code;
    try { if (!$('#j-name').value) $('#j-name').value = localStorage.getItem('box.name') || ''; } catch { /* private */ }
    $('#j-err').textContent = err || '';
    if ($('#j-code').value.length === 4) socket.emit('room:check', { code: $('#j-code').value }, (r) => { $('#j-game').textContent = r && r.ok ? 'Joining ' + r.title : ''; if (r && r.ok) theme(r.game); });
  }
  function join(code, name, token) {
    socket.emit('player:join', { code, name, token }, (r) => {
      if (!r || !r.ok) { if (token) { try { localStorage.removeItem(tokenKey(code)); } catch { /* */ } return showJoin(); } return showJoin(r && r.error); }
      me = { code: r.code, id: r.id, token: r.token, game: r.game, name: name || (load(r.code) || {}).name };
      store(r.code, { token: r.token, name: me.name });
      G = BOX.games[r.game]; theme(r.game);
      history.replaceState(null, '', (G && G.standalone ? '/' + r.game + '/play' : '/box/play') + '?room=' + r.code);
      $('#join').hidden = true; $('#game').hidden = false;
      $('#h-game').textContent = G ? G.icon + ' ' + G.name + ' ·' : '';
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

  socket.on('connect', () => {
    $('#offline').hidden = true;
    const code = (me && me.code) || (params.get('room') || '').toUpperCase();
    const s = code && load(code);
    if (s && s.token) join(code, s.name, s.token); else if (!me) showJoin();
  });
  socket.on('disconnect', () => { $('#offline').hidden = false; });
  socket.on('me', (v) => { view = v; $('#h-name').textContent = v.me.name; queue(); });

  // Draw at most ~6 times a second, and never while the player is typing.
  function queue() {
    if (renderQueued) return; renderQueued = true;
    const wait = Math.max(0, 160 - (Date.now() - lastRender));
    setTimeout(() => { renderQueued = false; draw(); }, wait);
  }
  function draw() {
    if (!view || !G) return;
    const a = document.activeElement;
    if (a && a.tagName === 'INPUT' && $('#g-body').contains(a)) { setTimeout(queue, 400); return; }
    lastRender = Date.now();
    // Jackbox-style host bar: the first player to join starts the game from their phone.
    const vb = $('#vip-bar'), over = view.state && view.state.phase === 'over';
    if (view.vip && (view.phase === 'lobby' || over)) {
      const can = view.count >= view.min;
      const html = view.phase === 'lobby'
        ? `<span>👑 You’re the host</span><button class="btn green" data-vip="start" ${can ? '' : 'disabled'}>Start game ▶</button>${can ? '' : `<small>Needs ${view.min}+ players</small>`}`
        : '<span>👑 You’re the host</span><button class="btn green" data-vip="again">Play again ▶</button><button class="btn ghost small" data-vip="lobby">Lobby</button>';
      if (vb.dataset.html !== html) { vb.innerHTML = html; vb.dataset.html = html; for (const b of vb.querySelectorAll('[data-vip]')) b.onclick = () => socket.emit('player:host', { type: b.dataset.vip }, (r) => { if (r && !r.ok && r.error) toast(r.error); }); }
      vb.hidden = false;
    } else vb.hidden = true;
    if (view.phase === 'lobby' && view.live && view.state) { G.phone($('#g-body'), view.state, ctx, view); return; }
    if (view.phase === 'lobby') { $('#g-body').innerHTML = `<div class="card-box" style="text-align:center"><h3>You’re in! 🎉</h3><p>${view.vip ? 'You’re the host! Press <b>Start game</b> when everyone is in.' : `Waiting for ${view.vipName ? '<b>' + BOX.esc(view.vipName) + '</b> (the host)' : 'the host'} to start <b>${BOX.esc(view.title)}</b>.`}</p><p class="muted">${view.count} player${view.count === 1 ? '' : 's'} so far. Watch the big screen.</p></div>${G.lobby ? G.lobby(view, ctx) : ''}`; if (G.lobbyBind) G.lobbyBind($('#g-body'), view, ctx); return; }
    G.phone($('#g-body'), view.state, ctx, view);
  }
  ctx.redraw = () => { lastRender = 0; draw(); };
})();
