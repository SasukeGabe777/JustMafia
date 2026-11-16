'use strict';
// JustGameBox big screen: creates (or resumes) a room for the chosen game, shows the
// QR code + room code and the game's settings in the lobby, then hands the screen to the
// game's own renderer. Works the same for every box game.
(function () {
  const $ = (s) => document.querySelector(s);
  const { esc } = BOX;
  const params = new URLSearchParams(location.search);
  const gameKey = params.get('game');
  const G = BOX.games[gameKey];
  if (!G) { $('#tv-main').innerHTML = '<p>Unknown game. <a href="/">Back to the games</a></p>'; return; }
  document.title = G.name + ' · JustGameBox';
  $('#tv-title').textContent = G.icon + ' ' + G.name;

  const socket = io('/box', { transports: ['websocket', 'polling'] });
  let state = null, baseUrl = location.origin, lastFx = 0, rendered = '';
  const KEY = 'box.host';
  const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };
  const host = (type, extra = {}) => new Promise((res) => socket.emit('host:action', { type, ...extra }, (r) => res(r || { ok: false })));

  fetch('/api/info').then((r) => r.json()).then((i) => { if (i.baseUrl) { baseUrl = i.baseUrl; render(); } }).catch(() => {});

  function create() {
    socket.emit('host:create', { game: gameKey }, (r) => {
      if (!r || !r.ok) { $('#tv-main').innerHTML = `<p class="err">${esc((r && r.error) || 'Could not create a room.')}</p>`; return; }
      save({ code: r.code, hostKey: r.hostKey, game: gameKey });
    });
  }
  socket.on('connect', () => {
    const s = saved();
    if (s && s.game === gameKey && !params.has('new')) socket.emit('host:resume', s, (r) => { if (!r || !r.ok) create(); });
    else create();
    if (params.has('new')) history.replaceState(null, '', location.pathname + '?game=' + gameKey);
  });
  socket.on('tv', (s) => { state = s; render(); playFx(s.fx || []); });

  // Sound: browsers need one click on the page first.
  document.addEventListener('pointerdown', () => { try { SFX.unlock(); } catch { /* none */ } $('#sound-hint').hidden = true; }, { once: true });
  function playFx(list) {
    for (const f of list) if (f.id > lastFx) { if (lastFx && G.onFx) { try { G.onFx(f); } catch (e) { console.error(e); } } if (lastFx) { const snd = (G.fx && G.fx[f.kind]) || { start: 'start', win: 'win', shuffle: 'shuffle', deal: 'deal' }[f.kind]; if (snd) BOX.sfx(snd); } }
    if (list.length) lastFx = Math.max(lastFx, list[list.length - 1].id);
  }

  const joinUrl = () => `${baseUrl}/box/play?room=${state.code}`;
  const qr = () => `/api/qr?text=${encodeURIComponent(joinUrl())}`;

  function render() {
    if (!state) return;
    const code = $('#tv-code');
    code.hidden = state.phase === 'lobby';
    const codeHtml = `<span>Join: <b>${esc(state.code)}</b></span><img src="${qr()}" alt="QR code to join">`;
    if (code.dataset.code !== state.code + baseUrl) { code.innerHTML = codeHtml; code.dataset.code = state.code + baseUrl; }
    if (state.phase === 'lobby') return lobby();
    const main = $('#tv-main');
    if (rendered !== 'game') { main.innerHTML = '<div id="g-area"></div><div class="host-row" id="host-row"></div>'; rendered = 'game'; }
    G.tv($('#g-area'), state.state, { players: state.players, settings: state.settings, host });
    const over = state.state && state.state.phase === 'over';
    $('#host-row').innerHTML = `${over ? '<button class="btn" data-h="again">▶ Play again</button>' : '<button class="btn ghost small" data-h="next">Skip ahead ▶</button>'} <button class="btn ghost small" data-h="lobby">Back to lobby</button> <button class="btn ghost small" data-h="bots">+ 5 bots</button>`;
    for (const b of document.querySelectorAll('[data-h]')) b.onclick = () => { const h = b.dataset.h; if (h === 'lobby' && !over && !confirm('End this game and go back to the lobby?')) return; host(h === 'bots' ? 'addBots' : h, { count: 5 }); };
  }

  const joinPanel = () => `
          <h2 style="margin:0">Join on your phone!</h2>
          <img id="qr" alt="QR code to join">
          <div class="muted">Room code</div>
          <div class="codebig" id="code"></div>
          <div class="url" id="url"></div>
          <div class="count" id="count"></div>
          <div class="vip" id="vip"></div>
          <div class="err" id="lobby-err"></div>
          <button class="btn big" id="start">Start game</button>
          <div><button class="link" id="add-bots">+ add 5 test bots</button> <button class="link" id="rm-bots">remove bots</button></div>
          <a class="link" href="?game=${esc(gameKey)}&new=1">New room</a>`;
  function lobby() {
    const main = $('#tv-main');
    // Live-lobby games (JustRaiseDucks) show their world right away; the join panel sits beside it.
    if (state.live) {
      if (rendered !== 'live') {
        main.innerHTML = `<div class="live-wrap"><div id="g-area"></div><aside class="panel join live-join">${joinPanel()}
          <details class="live-set"><summary>⚙ Settings</summary><div class="settings" id="settings"></div></details>
          <div class="roster" id="roster" hidden></div><span id="roster-title" hidden></span></aside></div>`;
        rendered = 'live'; bindJoin();
      }
      G.tv($('#g-area'), state.state, { players: state.players, settings: state.settings, host, lobby: true });
      return updateJoin();
    }
    if (rendered !== 'lobby') {
      main.innerHTML = `<div class="lobby">
        <section>
          <h1>${G.icon} ${esc(G.name)}</h1>
          <p class="about">${esc(G.about)}</p>
          <ol class="how">${G.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ol>
          <h3>Settings</h3>
          <div class="settings" id="settings"></div>
          <h3 id="roster-title">Players</h3>
          <div class="roster" id="roster"></div>
        </section>
        <aside class="panel join">${joinPanel()}
        </aside></div>`;
      rendered = 'lobby'; bindJoin();
    }
    updateJoin();
  }
  function bindJoin() {
    $('#start').onclick = async () => { const r = await host('start'); $('#lobby-err').textContent = r.ok ? '' : r.error || ''; };
    $('#add-bots').onclick = () => host('addBots', { count: 5 });
    $('#rm-bots').onclick = () => host('removeBots');
  }
  function updateJoin() {
    const url = joinUrl();
    $('#vip').innerHTML = state.vip ? `👑 <b>${esc(state.vip)}</b> is the host and can start from their phone` : 'The first person to join becomes the host 👑';
    if ($('#qr').dataset.url !== url) { $('#qr').src = qr(); $('#qr').dataset.url = url; }
    $('#code').textContent = state.code;
    $('#url').textContent = url.replace(/^https?:\/\//, '');
    const n = state.players.length;
    $('#count').textContent = n ? `${n} player${n > 1 ? 's' : ''} in` : 'Waiting for players…';
    $('#roster-title').textContent = `Players (${n}/${state.max})`;
    $('#start').disabled = n < state.min;
    $('#roster').innerHTML = state.players.map((p) => `<span class="chip ${p.online ? '' : 'off'}" data-kick="${esc(p.id)}" title="Click to remove"><i style="background:${esc(p.color)}"></i>${esc(p.name)}</span>`).join('') || '<span class="muted">Scan the QR code to join.</span>';
    for (const c of document.querySelectorAll('[data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) host('kick', { id: c.dataset.kick }); };
    // Settings form (keeps focus while the host is choosing).
    const box = $('#settings');
    const sig = JSON.stringify(state.settings);
    if (box.dataset.sig !== sig && !box.contains(document.activeElement)) {
      box.dataset.sig = sig;
      box.innerHTML = state.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}" ${String(state.settings[f.key]) === String(o.value) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`).join('');
      for (const s of box.querySelectorAll('[data-set]')) s.onchange = () => { s.blur(); host('settings', { settings: { [s.dataset.set]: s.value } }); };
    }
  }
})();
