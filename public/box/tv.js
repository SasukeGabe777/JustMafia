'use strict';
// JustGameBox big screen: creates (or resumes) a room for the chosen game, shows the
// QR code + room code and the game's settings in the lobby, then hands the screen to the
// game's own renderer. Works the same for every box game.
(function () {
  const $ = (s) => document.querySelector(s);
  const { esc } = BOX;
  const params = new URLSearchParams(location.search);
  // Big games have their own address (/ducks) and open like a game of their own: own title
  // screen, own look, no JustGameBox bar. Small games use /box/tv?game=<key>.
  const pathGame = location.pathname.replace(/\/+$/, '').split('/')[1];
  let gameKey = params.get('game') || pathGame;
  let G = BOX.games[gameKey];
  if (!G) { $('#tv-main').innerHTML = '<p>Unknown game. <a href="/">Back to the games</a></p>'; return; }
  const STAND = !!G.standalone && !params.get('game');
  document.title = STAND ? G.name : G.name + ' · JustGameBox';
  $('#tv-title').textContent = G.icon + ' ' + G.name;
  if (STAND) { document.body.classList.add('standalone', 'g-' + gameKey); document.querySelector('.tv-bar').hidden = true; }
  else if (!G.standalone) document.body.classList.add('g-' + gameKey); // every game styles its own screens (public/box/games/<key>.css)

  const socket = io('/box', { transports: ['websocket', 'polling'] });
  let state = null, baseUrl = location.origin, lastFx = 0, rendered = '';
  const KEY = 'box.host';
  const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };
  const host = (type, extra = {}) => new Promise((res) => socket.emit('host:action', { type, ...extra }, (r) => res(r || { ok: false })));

  fetch('/api/info').then((r) => r.json()).then((i) => { if (i.baseUrl) { baseUrl = i.baseUrl; render(); } }).catch(() => {});

  let onTitle = false;
  // Every game opens on its own title screen: big games draw theirs (G.title), small games
  // register one in BOX.titles (public/box/titles/<key>.js).
  const hasTitle = () => STAND || !!(BOX.titles && BOX.titles[gameKey] && BOX.titles[gameKey].draw);
  const showBar = () => { if (!STAND) document.querySelector('.tv-bar').hidden = false; };
  // Party Mode from the main menu: /box/tv?game=<first>&party=<k1,k2,…>&minutes=60
  const partyParam = params.get('party') ? { games: params.get('party').split(',').filter(Boolean).slice(0, 20), minutes: Number(params.get('minutes')) || 60 } : null;
  let partyUsed = false;
  const myUnlocks = () => (window.UNLOCKS ? window.UNLOCKS.all() : []);
  const isLockedHere = (key) => !!(window.UNLOCKS && window.UNLOCKS.isLockable(key) && !window.UNLOCKS.has(key));
  // A locked game opened directly: say how to unlock it.
  function lockedScreen() {
    onTitle = true; rendered = 'locked'; state = null;
    const L = (window.UNLOCKS && window.UNLOCKS.LIST[gameKey]) || {};
    document.querySelector('.tv-bar').hidden = true;
    $('#tv-main').innerHTML = `<div class="locked-screen"><div class="lk-icon">${esc(L.icon || G.icon)}</div><div class="lk-lock">🔒</div><h1>${esc(L.title || G.name)} is locked</h1><p>${esc(L.how || 'Keep playing to unlock it.')}</p><a class="btn big" href="/">◀ Pick a game</a></div>`;
  }
  // Unlocked mid-party: remember it on this TV and celebrate.
  function celebrateUnlock(f) {
    if (!window.UNLOCKS) return;
    window.UNLOCKS.add(f.key);
    const L = window.UNLOCKS.LIST[f.key] || { title: f.title, icon: '🎁' };
    const o = document.createElement('div'); o.className = 'unlock-pop';
    o.innerHTML = `<div class="up-card"><div class="up-burst"></div><div class="up-lock">🔓</div><div class="up-icon">${esc(L.icon)}</div><small>NEW GAME UNLOCKED</small><h2>${esc(L.title)}</h2><p>Find it on the main menu, or pick it as the next game!</p></div>`;
    document.body.appendChild(o); BOX.sfx('win');
    setTimeout(() => o.classList.add('out'), 5200); setTimeout(() => o.remove(), 6000);
  }
  function create() {
    onTitle = false; showBar();
    const party = partyParam && !partyUsed ? partyParam : null; partyUsed = true;
    socket.emit('host:create', { game: gameKey, party, unlocks: myUnlocks() }, (r) => {
      if (r && r.locked) return lockedScreen();
      if (!r || !r.ok) { $('#tv-main').innerHTML = `<p class="err">${esc((r && r.error) || 'Could not create a room.')}</p>`; return; }
      save({ code: r.code, hostKey: r.hostKey, game: gameKey });
    });
  }
  // The game's own title screen (big games): nothing is created until the host presses start.
  function showTitle() {
    state = null; rendered = 'title'; onTitle = true;
    const c = $('#corner'); if (c) c.remove();
    if (!STAND) { document.querySelector('.tv-bar').hidden = true; $('#tv-code').hidden = true; }
    const s = saved(), mine = s && s.game === gameKey;
    const draw = STAND ? G.title : (el, o) => BOX.showTitle(el, gameKey, o);
    draw($('#tv-main'), {
      start: () => { create(); BOX.sfx('start'); },
      back: () => { location.href = '/'; },
      // A valley that is still running can be picked up again from the title screen.
      code: mine ? s.code : null,
      resume: mine ? () => socket.emit('host:resume', { ...s, unlocks: myUnlocks() }, (r) => {
        if (r && r.ok) { onTitle = false; showBar(); BOX.sfx('start'); }
        else { try { localStorage.removeItem(KEY); } catch { /* */ } showTitle(); }
      }) : null,
    });
  }
  function quitToTitle() { try { localStorage.removeItem(KEY); } catch { /* */ } showTitle(); }
  let firstConnect = true;
  socket.on('connect', () => {
    // Read the address fresh: ?new / ?resume are dropped from it after the first connect.
    const q = new URLSearchParams(location.search);
    const s = saved(), mine = s && s.game === gameKey && !q.has('new');
    const resumeOr = (fallback) => socket.emit('host:resume', { ...s, unlocks: myUnlocks() }, (r) => { if (r && r.ok) { onTitle = false; showBar(); } else fallback(); });
    if (firstConnect) {
      // ?resume: straight back into a running room (after a game switch, or Continue on the
      // main menu). ?new: a fresh room, no title. Otherwise every game opens on its title.
      if (q.has('resume') && mine) { onTitle = false; resumeOr(hasTitle() ? showTitle : create); }
      else if (!STAND && (q.has('new') || q.has('party'))) create();
      else if (isLockedHere(gameKey)) lockedScreen();
      else if (hasTitle()) showTitle();
      else if (mine) resumeOr(create);
      else create();
    } else if (!onTitle) {
      // A reconnect mid-game picks the room back up.
      if (mine) resumeOr(hasTitle() ? showTitle : create); else if (!STAND) create();
    }
    firstConnect = false;
    if (q.has('new') || q.has('resume') || q.has('party')) history.replaceState(null, '', STAND ? location.pathname : location.pathname + '?game=' + gameKey);
  });
  socket.on('tv', (s) => {
    if (onTitle) return;
    if (s.game && s.game !== gameKey) return switchTo(s);
    state = s; render(); playFx(s.fx || []);
  });
  // The host picked another game: same room, same players. Small games swap in place (the
  // page keeps its sound permission); big games have their own page.
  function switchTo(s) {
    const next = BOX.games[s.game]; if (!next) return;
    const prev = saved() || {};
    save({ code: s.code, hostKey: prev.hostKey, game: s.game });
    if (next.standalone || STAND) { location.href = next.standalone ? '/' + s.game + '?resume=1' : '/box/tv?game=' + s.game + '&resume=1'; return; }
    document.body.classList.remove('g-' + gameKey); gameKey = s.game; G = next; rendered = ''; showBar(); document.body.classList.add('g-' + gameKey);
    document.title = G.name + ' · JustGameBox'; $('#tv-title').textContent = G.icon + ' ' + G.name;
    history.replaceState(null, '', location.pathname + '?game=' + gameKey);
    state = s; render(); playFx(s.fx || []);
  }
  // Emoji reactions from phones float up the screen with the sender's name.
  socket.on('react', (r) => {
    if (onTitle || !r) return;
    let o = $('#reacts'); if (!o) { o = document.createElement('div'); o.id = 'reacts'; o.className = 'reacts'; document.body.appendChild(o); }
    if (o.children.length > 40) return;
    const el = document.createElement('div'); el.className = 'react-f';
    el.style.left = 4 + Math.random() * 88 + '%';
    el.innerHTML = `<span class="e">${esc(r.e)}</span><small style="border:2px solid ${esc(r.color || '#fff')}">${esc(r.avatar || '')} ${esc(r.name)}</small>`;
    o.appendChild(el); setTimeout(() => el.remove(), 3300);
  });
  // Pick the next game from the TV (the host's phone can do the same).
  const SWITCHABLE = ['president', 'blanks', 'blackjack', 'bid', 'price', 'emoji', 'truths', 'likely', 'whosaid', 'spectrum', 'sketch', 'funny', 'zombie', 'ducks', 'kingdoms'];
  function tvPicker() {
    let o = $('#tv-pick'); if (o) o.remove();
    o = document.createElement('div'); o.id = 'tv-pick'; o.className = 'tv-pick';
    o.innerHTML = `<div class="panel"><h2>🎮 Pick the next game</h2><p class="muted">Everyone stays in with the same code. Party points carry on.</p><div class="pick-games">${SWITCHABLE.filter((k) => BOX.games[k] && k !== gameKey).map((k) => { const lk = state && state.unlocks ? window.UNLOCKS && window.UNLOCKS.isLockable(k) && !state.unlocks.includes(k) : isLockedHere(k); return `<button data-game="${k}" ${lk ? 'disabled class="locked" title="Locked"' : ''}><span>${lk ? '🔒' : BOX.games[k].icon}</span><b>${esc(BOX.games[k].name)}</b></button>`; }).join('')}</div><button class="btn ghost small" data-close>Cancel</button></div>`;
    document.body.appendChild(o);
    o.onclick = (e) => { if (e.target === o || e.target.closest('[data-close]')) o.remove(); };
    for (const b of o.querySelectorAll('[data-game]')) b.onclick = async () => { o.remove(); const r = await host('switch', { game: b.dataset.game }); if (!r.ok && r.error) alert(r.error); };
  }
  const partyHtml = () => (state && state.played && state.played.length ? `<div class="party-strip">🎉 <b>Party points</b> ${state.party.slice(0, 5).map((r, i) => `<span>${['👑', '2.', '3.', '4.', '5.'][i]} ${esc(r.avatar || '')} ${esc(r.name)} <b>${r.pts}</b></span>`).join('')}<span class="muted">${state.played.length} game${state.played.length === 1 ? '' : 's'} tonight</span></div>` : '');

  // Sound: browsers need one click on the page first.
  document.addEventListener('pointerdown', () => { try { SFX.unlock(); } catch { /* none */ } $('#sound-hint').hidden = true; }, { once: true });
  function playFx(list) {
    for (const f of list) if (f.id > lastFx && lastFx && f.kind === 'unlock') celebrateUnlock(f);
    for (const f of list) if (f.id > lastFx) { if (lastFx && G.onFx) { try { G.onFx(f); } catch (e) { console.error(e); } } if (lastFx) { const snd = (G.fx && G.fx[f.kind]) || { start: 'start', win: 'win', shuffle: 'shuffle', deal: 'deal' }[f.kind]; if (snd) BOX.sfx(snd); } }
    if (list.length) lastFx = Math.max(lastFx, list[list.length - 1].id);
  }

  const joinUrl = () => (STAND ? `${baseUrl}/${gameKey}/play?room=${state.code}` : `${baseUrl}/box/play?room=${state.code}`);
  const qr = () => `/api/qr?text=${encodeURIComponent(joinUrl())}`;

  // Big games: a small corner badge (code + QR for late joiners) and a ⚙ host menu.
  function corner() {
    let c = $('#corner');
    if (!c) {
      c = document.createElement('div'); c.id = 'corner'; c.className = 'corner';
      c.innerHTML = '<div class="cj"><span class="cl">Join</span><b class="cc"></b></div><img class="cq" alt="QR code to join"><button class="cg" title="Host menu">⚙</button><div class="cm" hidden></div>';
      document.body.appendChild(c);
      c.querySelector('.cg').onclick = () => { const m = c.querySelector('.cm'); m.hidden = !m.hidden; };
    }
    c.querySelector('.cc').textContent = state.code;
    const q = c.querySelector('.cq'); if (q.dataset.u !== joinUrl()) { q.src = qr(); q.dataset.u = joinUrl(); }
    const over = state.state && state.state.phase === 'over';
    const html = `${over ? '<button data-h="again">▶ Play again</button><button data-h="pick">🎮 Another game</button>' : '<button data-h="next">⏩ Skip ahead</button>'}<button data-h="lobby">↩ Back to the lobby</button><button data-h="bots">🤖 Add 5 bots</button><button data-h="quit">🚪 Quit to title</button>`;
    const m = c.querySelector('.cm');
    if (m.dataset.html !== html) {
      m.innerHTML = html; m.dataset.html = html;
      for (const b of m.querySelectorAll('[data-h]')) b.onclick = () => {
        const h = b.dataset.h; m.hidden = true;
        if (h === 'pick') return tvPicker();
        if (h === 'quit') { if (confirm('Quit this game and go back to the title screen?')) quitToTitle(); return; }
        if (h === 'lobby' && !over && !confirm('End this game and go back to the lobby?')) return;
        host(h === 'bots' ? 'addBots' : h, { count: 5 });
      };
    }
    c.hidden = state.phase === 'lobby';
  }

  function render() {
    if (!state) return;
    if (STAND) corner();
    const code = $('#tv-code');
    code.hidden = state.phase === 'lobby' || STAND;
    const codeHtml = `<span>Join: <b>${esc(state.code)}</b></span><img src="${qr()}" alt="QR code to join">`;
    if (code.dataset.code !== state.code + baseUrl) { code.innerHTML = codeHtml; code.dataset.code = state.code + baseUrl; }
    if (state.phase === 'lobby') return lobby();
    const main = $('#tv-main');
    // Party Mode: the standings board between games, and the finale (drawn by partyboard.js).
    const pm = state.partyMode;
    if (pm && (pm.phase === 'board' || pm.phase === 'done') && BOX.partyBoard) {
      if (rendered !== 'board') { main.innerHTML = '<div id="pb-area" class="pb-area"></div>'; rendered = 'board'; }
      BOX.partyBoard($('#pb-area'), state, { host });
      return;
    }
    // Game-show opening (studio, audience, host, contestants): full screen, drawn by show.js.
    if (state.phase === 'show' && state.show) {
      if (rendered !== 'show') {
        main.innerHTML = '<div id="show-area" class="show-area"></div><button class="show-skip" id="show-skip" data-h="next">Skip intro ⏩</button>';
        rendered = 'show';
        $('#show-skip').onclick = () => host('next');
      }
      if (BOX.showIntro) BOX.showIntro($('#show-area'), state.show, { players: state.players, host });
      else $('#show-area').innerHTML = `<div class="final"><h2>🎤 ${esc(state.show.title)}</h2><p>${state.show.step === 'facts' ? `Tell the host a funny fact on your phone! ${state.show.submitted}/${state.show.of}` : 'Meet the contestants!'}</p></div>`;
      return;
    }
    if (rendered !== 'game') { main.innerHTML = '<div id="g-area"></div><div class="host-row" id="host-row"></div>'; rendered = 'game'; }
    G.tv($('#g-area'), state.state, { players: state.players, settings: state.settings, host });
    if (STAND) { $('#host-row').hidden = true; return; }
    const over = state.state && state.state.phase === 'over';
    const hr = `${over ? '<button class="btn" data-h="again">▶ Play again</button> <button class="btn cyan" data-h="pick">🎮 Another game</button>' : '<button class="btn ghost small" data-h="next">Skip ahead ▶</button>'} <button class="btn ghost small" data-h="lobby">Back to lobby</button> <button class="btn ghost small" data-h="bots">+ 5 bots</button>${over ? partyHtml() : ''}`;
    if ($('#host-row').dataset.html === hr) return;
    $('#host-row').innerHTML = hr; $('#host-row').dataset.html = hr;
    for (const b of document.querySelectorAll('#host-row [data-h]')) b.onclick = () => { const h = b.dataset.h; if (h === 'pick') return tvPicker(); if (h === 'lobby' && !over && !confirm('End this game and go back to the lobby?')) return; host(h === 'bots' ? 'addBots' : h, { count: 5 }); };
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
          <button class="link" id="tv-switch">🎮 Play a different game (same room)</button>
          ${STAND ? '<button class="link" id="quit-title">Quit to title</button>' : `<a class="link" href="?game=${esc(gameKey)}&new=1">New room</a>`}`;
  // A game can draw its own lobby (its settings as part of the game's world):
  //   BOX.games.<key>.lobbyTv(el, lobby) is called on every update with the same element.
  //   lobby = { code, joinUrl, qr (image URL), players:[{id,name,avatar,color,bot,online}], vip, min, max,
  //     fields:[{key,label,options:[{value,label}]}], settings, partyMode, lineupHtml,
  //     set(key, value), start() → Promise<{ok,error}>, bots(n), removeBots(), kick(id), pick(), back() }
  function lobbyApi() {
    return {
      code: state.code, joinUrl: joinUrl(), qr: qr(), players: state.players, vip: state.vip, min: state.min, max: state.max,
      fields: state.fields, settings: state.settings, partyMode: state.partyMode || null,
      lineupHtml: state.partyMode && BOX.partyLineup ? BOX.partyLineup(state) : '',
      set: (key, value) => host('settings', { settings: { [key]: value } }),
      start: () => host('start'), bots: (n = 5) => host('addBots', { count: n }), removeBots: () => host('removeBots'),
      kick: (id) => host('kick', { id }), pick: () => tvPicker(), back: () => { location.href = '/'; },
    };
  }
  function lobby() {
    const main = $('#tv-main');
    if (G.lobbyTv && !state.live) {
      if (rendered !== 'custom-lobby') { main.innerHTML = '<div id="lobby-area" class="lobby-area"></div>'; rendered = 'custom-lobby'; }
      try { G.lobbyTv($('#lobby-area'), lobbyApi()); } catch (e) { console.error(e); }
      return;
    }
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
          <div class="party-panel" id="party"></div>
          <div id="lineup"></div>
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
    $('#tv-switch').onclick = tvPicker;
    const q = $('#quit-title'); if (q) q.onclick = () => { if (confirm('Close this valley and go back to the title screen?')) quitToTitle(); };
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
    $('#roster').innerHTML = state.players.map((p) => `<span class="chip ${p.online ? '' : 'off'}" data-kick="${esc(p.id)}" title="Click to remove"><i style="background:${esc(p.color)}"></i><span class="av">${esc(p.avatar || '')}</span>${esc(p.name)}</span>`).join('') || '<span class="muted">Scan the QR code to join.</span>';
    const lu = $('#lineup'); if (lu) { const lh = state.partyMode && BOX.partyLineup ? BOX.partyLineup(state) : ''; if (lu.dataset.html !== lh) { lu.innerHTML = lh; lu.dataset.html = lh; } }
    const pp = $('#party');
    if (pp) { const ph = state.played && state.played.length ? `<h3>🎉 Party points · ${state.played.length} game${state.played.length === 1 ? '' : 's'} tonight</h3><div class="board">${state.party.slice(0, 8).map((r, i) => `<div class="row"><span class="n">${i + 1}</span><span class="av">${esc(r.avatar || '')}</span><span>${esc(r.name)}${r.wins ? ' ' + '🏆'.repeat(Math.min(3, r.wins)) : ''}</span><b>${r.pts}</b></div>`).join('')}</div><div class="played">${state.played.slice(-6).map((g) => `${esc(g.title)}${g.winner ? ': ' + esc(g.winner) : ''}`).join(' · ')}</div>` : ''; if (pp.dataset.html !== ph) { pp.innerHTML = ph; pp.dataset.html = ph; } }
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
