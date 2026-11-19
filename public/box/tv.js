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
  if (G.external) { location.replace(G.href || '/'); return; } // JustMafia lives at /mafia
  const STAND = !!G.standalone && !params.get('game');
  document.title = STAND ? G.name : G.name + ' · JustGameBox';
  $('#tv-title').textContent = G.icon + ' ' + G.name;
  if (STAND) { document.body.classList.add('standalone', 'g-' + gameKey); document.querySelector('.tv-bar').hidden = true; }
  else if (!G.standalone) document.body.classList.add('g-' + gameKey); // every game styles its own screens (public/box/games/<key>.css)

  const socket = io('/box', { transports: ['websocket', 'polling'] });
  let state = null, baseUrl = location.origin, lastFx = 0, rendered = '', stateAt = 0;
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
  // …&intros=play|break|skip&each=quick|standard|long|auto&plan=pizza:10,trivia:5&players=4 (the server checks them).
  const planParam = () => { const o = {}; for (const kv of (params.get('plan') || '').split(',')) { const [k, m] = kv.split(':'); if (k && Number(m) > 0) o[k] = Number(m); } return o; };
  const partyParam = params.get('party') ? { games: params.get('party').split(',').filter(Boolean).slice(0, 20), minutes: Number(params.get('minutes')) || 60, flow: params.get('flow') === 'lobby' ? 'lobby' : 'auto',
    intros: params.get('intros') || 'play', each: params.get('each') || 'auto', plan: planParam(), players: Number(params.get('players')) || 0 } : null;
  let partyUsed = false;
  const myUnlocks = () => (window.UNLOCKS ? window.UNLOCKS.all() : []);
  // Streamer options (⚙ host menu, remembered on this TV): hide the code, filter player text,
  // a short delay before a new room code shows.
  const STREAM_KEY = 'box.streamer', DELAY_MS = 8000;
  const streamer = (() => { try { return { hide: false, filter: false, delay: false, ...JSON.parse(localStorage.getItem(STREAM_KEY) || '{}') }; } catch { return { hide: false, filter: false, delay: false }; } })();
  const saveStreamer = () => { try { localStorage.setItem(STREAM_KEY, JSON.stringify(streamer)); } catch { /* private mode */ } };
  const isLockedHere = (key) => !!(window.UNLOCKS && window.UNLOCKS.isLockable(key) && !window.UNLOCKS.has(key));
  // A locked game opened directly: say how to unlock it.
  function lockedScreen() {
    onTitle = true; rendered = 'locked'; state = null; if (AU) AU.stop();
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
    music();
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
    if (BOX.setRoster && s && s.players) BOX.setRoster(s.players); // every player's character + gear (BOX.face)
    if (s.away) return goAway(s);
    if (s.game && s.game !== gameKey) return switchTo(s);
    state = s; stateAt = Date.now(); render(); playFx(s.fx || []); music(); platform();
  });
  socket.on('aud', (a) => { if (!state || !a) return; state.audience = { count: a.audience, poll: a.poll }; lastPoll = a.lastPoll || null; audienceUi(); });
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
    if (AU) AU.use(gameKey);
    state = s; stateAt = Date.now(); render(); playFx(s.fx || []); music(); platform();
  }
  // The room went to a game outside the box (JustMafia): this TV opens it, signed in as its
  // big screen. The box room waits; JustMafia sends everyone back here afterwards.
  let leaving = false;
  function goAway(s) {
    if (leaving || s.away.game !== 'mafia' || !s.away.hostKey) return;
    leaving = true;
    try { localStorage.setItem('mt.host', JSON.stringify({ code: s.away.code, hostKey: s.away.hostKey })); } catch { /* private mode */ }
    $('#tv-main').innerHTML = '<div class="final"><h2>🔪 Off to JustMafia…</h2><p class="muted">Phones follow by themselves.</p></div>';
    setTimeout(() => { location.href = '/mafia?resume=1'; }, 600);
  }
  // Emoji reactions from phones float up the screen with the sender's name.
  socket.on('react', (r) => {
    if (onTitle || !r) return;
    let o = $('#reacts'); if (!o) { o = document.createElement('div'); o.id = 'reacts'; o.className = 'reacts'; document.body.appendChild(o); }
    if (o.children.length > 40) return;
    const el = document.createElement('div'); el.className = 'react-f';
    el.style.left = 4 + Math.random() * 88 + '%';
    if (r.audience) el.classList.add('aud');
    el.innerHTML = `<span class="e">${esc(r.e)}</span><small style="border:2px solid ${esc(r.color || '#fff')}">${r.audience ? '👀 ' : ''}${esc(r.avatar || '')} ${esc(BOX.filterText(r.name))}</small>`;
    o.appendChild(el); setTimeout(() => el.remove(), 3300);
  });
  // Pick the next game from the TV (the host's phone can do the same).
  const SWITCHABLE = ['president', 'blanks', 'blackjack', 'bid', 'price', 'emoji', 'truths', 'likely', 'whosaid', 'spectrum', 'sketch', 'funny', 'zombie', 'pizza', 'escape', 'marble', 'debate', 'actout', 'tune', 'alien', 'bomb', 'quickdraw', 'summon', 'letters', 'memes', 'colormatch', 'trivia', 'plinko', 'ducks', 'kingdoms', 'mafia'];
  function tvPicker() {
    let o = $('#tv-pick'); if (o) o.remove();
    o = document.createElement('div'); o.id = 'tv-pick'; o.className = 'tv-pick';
    o.innerHTML = `<div class="panel"><h2>🎮 Pick the next game</h2><p class="muted">Everyone stays in with the same code. Party points carry on.</p><div class="pick-games">${SWITCHABLE.filter((k) => BOX.games[k] && k !== gameKey).map((k) => { const lk = state && state.unlocks ? window.UNLOCKS && window.UNLOCKS.isLockable(k) && !state.unlocks.includes(k) : isLockedHere(k); return `<button data-game="${k}" ${lk ? 'disabled class="locked" title="Locked"' : ''}><span>${lk ? '🔒' : BOX.games[k].icon}</span><b>${esc(BOX.games[k].name)}</b></button>`; }).join('')}</div><button class="btn ghost small" data-close>Cancel</button></div>`;
    document.body.appendChild(o);
    o.onclick = (e) => { if (e.target === o || e.target.closest('[data-close]')) o.remove(); };
    for (const b of o.querySelectorAll('[data-game]')) b.onclick = async () => { o.remove(); const r = await host('switch', { game: b.dataset.game }); if (!r.ok && r.error) alert(r.error); };
  }
  const partyHtml = () => (state && state.played && state.played.length ? `<div class="party-strip">🎉 <b>Party points</b> ${state.party.slice(0, 5).map((r, i) => `<span>${['👑', '2.', '3.', '4.', '5.'][i]} ${esc(r.avatar || '')} ${esc(r.name)} <b>${r.pts}</b></span>`).join('')}<span class="muted">${state.played.length} game${state.played.length === 1 ? '' : 's'} tonight</span></div>` : '');

  // ---- Music: public/box/audio.js plays public/box/scores/<key>.js ----
  // title -> 'title', lobby -> 'lobby', intro cutscene -> 'intro' (ducked under the host),
  // Party Mode board / finale -> the 'party' score, in game -> the game's music(s) (or its
  // score's phaseCue(s)), default 'play', game over 'finale'. The last 10 s of a timed
  // 'think' phase (or a cue in the score's tenseFrom list) turn 'tense'.
  const AU = BOX.audio;
  let tenseTimer = 0;
  function music() {
    if (!AU) return;
    clearTimeout(tenseTimer);
    if (onTitle) { if (rendered !== 'locked') AU.music('title', gameKey); return; }
    if (!state) return;
    const pm = state.partyMode;
    if (pm && pm.phase === 'board' && pm.preview) return AU.music('intro', pm.preview.game); // the next game's intro, in the break
    if (pm && (pm.phase === 'board' || pm.phase === 'done')) return AU.music(pm.phase === 'done' ? 'finale' : 'board', 'party');
    if (state.phase === 'lobby') return AU.music('lobby', gameKey);
    if (state.phase === 'show') return AU.music('intro', gameKey);
    const s = state.state || {}, sc = BOX.scores && BOX.scores[gameKey];
    let cue = s.phase === 'over' ? 'finale' : 'play';
    const pick = G.music || (sc && sc.phaseCue);
    if (pick) { try { const c = pick(s); if (c !== undefined) cue = c; } catch (e) { console.error(e); } }
    if ((cue === 'think' || (sc && sc.tenseFrom && sc.tenseFrom.includes(cue))) && s.endsIn > 0) {
      const left = s.endsIn - (Date.now() - stateAt);
      if (left <= 10000) cue = 'tense'; else tenseTimer = setTimeout(music, left - 10000 + 30);
    }
    AU.music(cue, gameKey);
  }
  if (AU) {
    AU.use(gameKey); AU.need(gameKey, music);
    if (partyParam) AU.need('party');
    if (!STAND) { const b = AU.button(); b.classList.add('tv-sound'); document.querySelector('.tv-bar').appendChild(b); }
  }

  // Sound: browsers need one click on the page first.
  document.addEventListener('pointerdown', () => { try { SFX.unlock(); } catch { /* none */ } $('#sound-hint').hidden = true; }, { once: true });
  function playFx(list) {
    for (const f of list) if (f.id > lastFx && lastFx && f.kind === 'unlock') celebrate(() => celebrateUnlock(f), 6500);
    for (const f of list) if (f.id > lastFx && lastFx) {
      if (f.kind === 'trophy') celebrate(() => tvToast(`<span class="tt-i">${esc(f.icon || '🏆')}</span><div><small>TROPHY UNLOCKED</small><b>${esc(f.avatar || '')} ${esc(BOX.filterText(f.name))}</b><span>${esc(f.trophy)}</span></div>`, 'trophy'), 2600);
      else if (f.kind === 'audFav') { tvToast(`<span class="tt-i">📣</span><div><small>AUDIENCE FAVOURITE</small><b>${esc(f.avatar || '')} ${esc(BOX.filterText(f.name))}</b><span>+${f.bonus} party points</span></div>`, 'fav'); BOX.sfx('cheer'); }
      else if (f.kind === 'audJoin') tvToast(`<span class="tt-i">👀</span><div><small>FROM THE AUDIENCE</small><b>${f.n} new player${f.n === 1 ? '' : 's'}</b><span>joined for this game</span></div>`, 'aud');
    }
    for (const f of list) if (f.id > lastFx) {
      if (lastFx && G.onFx) { try { G.onFx(f); } catch (e) { console.error(e); } }
      // The game's score can play its own styled stinger for this fx (score.fx); otherwise the SFX name.
      if (lastFx && !(AU && AU.fx(gameKey, f.kind))) { const snd = (G.fx && G.fx[f.kind]) || { start: 'start', win: 'win', shuffle: 'shuffle', deal: 'deal' }[f.kind]; if (snd) BOX.sfx(snd); }
    }
    if (list.length) lastFx = Math.max(lastFx, list[list.length - 1].id);
  }

  // One QR for the whole night: /j/CODE sends each phone to wherever this room is playing now
  // (this game, the next one, or JustMafia), so the code never changes between games.
  const joinUrl = () => `${baseUrl}/j/${state.code}`;
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
    const over = state.state && state.state.phase === 'over', inParty = partyRunning();
    const html = `${over && inParty ? `<button data-h="partyBoardNow">⏩ Show standings now</button><button data-h="partyPause">${state.partyMode.paused ? '▶ Resume' : '⏸ Wait'}</button>` : over ? '<button data-h="again">▶ Play again</button><button data-h="pick">🎮 Another game</button>' : '<button data-h="next">⏩ Skip ahead</button>'}${inParty ? `<button data-h="intros">🎬 Intros: ${esc(INTRO_LABEL[state.partyMode.intros] || 'Play each')}</button>` : ''}<button data-h="lobby">↩ Back to the lobby</button><button data-h="bots">🤖 Add 5 bots</button>${AU ? '<button data-h="sound">🔊 Music & sound</button>' : ''}<button data-h="recap">🎬 Night recap</button><button data-h="streamer">🎥 Streamer options</button><button data-h="quit">🚪 Quit to title</button>`;
    const m = c.querySelector('.cm');
    if (m.dataset.html !== html) {
      m.innerHTML = html; m.dataset.html = html;
      for (const b of m.querySelectorAll('[data-h]')) b.onclick = () => {
        const h = b.dataset.h; m.hidden = true;
        if (h === 'pick') return tvPicker();
        if (h === 'recap') return startRecap();
        if (h === 'streamer') return hostMenu(true);
        if (h === 'sound') return AU.panel(c.querySelector('.cg'));
        if (h === 'quit') { if (confirm('Quit this game and go back to the title screen?')) quitToTitle(); return; }
        if (h === 'intros') { const order = Object.keys(INTRO_LABEL), cur = state.partyMode && state.partyMode.intros; return host('partyIntros', { mode: order[(order.indexOf(cur) + 1) % order.length] }); }
        if (h === 'lobby' && !over && !confirm('End this game and go back to the lobby?')) return;
        host(h === 'bots' ? 'addBots' : h, { count: 5 });
      };
    }
    c.hidden = state.phase === 'lobby';
  }

  // ---------- platform: ⚙ host menu, streamer options, audience, recap ----------
  let lastPoll = null, toastN = 0, delayUntil = 0, delayCode = '', revealT = 0, filterSent = null;
  // Celebrations (unlocks, trophies) never pile onto the end of a game: they wait while an
  // intro or tutorial plays, while a game's end screen is fresh (10 s), and while Party Mode
  // counts down to the standings, then play one at a time.
  const celebQ = []; let celebNext = 0, overSince = 0;
  function celebQuiet() {
    if (!state) return false;
    if (state.phase === 'show') return true;
    const pm = state.partyMode; if (pm && (pm.phase === 'ending' || (pm.phase === 'board' && pm.preview))) return true; // nor over an intro in the break
    const over = state.state && state.state.phase === 'over';
    if (over && !overSince) overSince = Date.now(); if (!over) overSince = 0;
    return over && Date.now() - overSince < 10000;
  }
  function celebrate(fn, gap) { celebQ.push({ fn, gap }); }
  setInterval(() => {
    if (!celebQ.length || Date.now() < celebNext || celebQuiet()) return;
    const c = celebQ.shift(); celebNext = Date.now() + c.gap;
    try { c.fn(); } catch (e) { console.error(e); }
  }, 400);
  function tvToast(html, kind) {
    let box = $('#tv-toasts'); if (!box) { box = document.createElement('div'); box.id = 'tv-toasts'; box.className = 'tv-toasts'; document.body.appendChild(box); }
    if (box.children.length > 4) box.firstChild.remove();
    const t = document.createElement('div'); t.className = 'tv-toast ' + (kind || ''); t.innerHTML = html; t.dataset.n = ++toastN;
    box.appendChild(t); setTimeout(() => t.classList.add('out'), 5200); setTimeout(() => t.remove(), 5800);
  }
  function startRecap() {
    if (!state || !state.played || !state.played.length) return tvToast('<span class="tt-i">🎬</span><div><small>NIGHT RECAP</small><b>Play a game first!</b><span>Then there is a night to recap.</span></div>');
    host('recap').then((r) => { if (r && !r.ok && r.error) tvToast(`<span class="tt-i">🎬</span><div><b>${esc(r.error)}</b></div>`); });
  }
  // The ⚙ host menu (small games: in the top bar; big games: their corner ⚙ opens it too).
  function hostMenu(streamOnly) {
    let o = $('#host-menu'); if (o) o.remove();
    o = document.createElement('div'); o.id = 'host-menu'; o.className = 'tv-pick host-menu-ov';
    const tog = (k, label, sub) => `<button class="hm-tog ${streamer[k] ? 'on' : ''}" data-st="${k}"><span class="hm-sw"><i></i></span><span><b>${label}</b><small>${sub}</small></span></button>`;
    const played = state && state.played ? state.played.length : 0;
    o.innerHTML = `<div class="panel hm-panel"><h2>⚙ Host menu</h2>
      ${streamOnly ? '' : `<div class="hm-row"><button class="btn" data-hm="recap" ${played ? '' : 'disabled'}>🎬 Night recap</button><button class="btn ghost" data-hm="lock">${state && state.locked ? '🔓 Unlock the room' : '🔒 Lock the room'}</button></div>
      <p class="muted small">${played ? `${played} game${played === 1 ? '' : 's'} played tonight.` : 'The recap is ready after the first game.'} ${state && state.locked ? 'The room is locked: new people can only watch.' : 'Lock the room and new people join the audience.'}</p>`}
      ${streamOnly || !state || !(state.players || []).length ? '' : `<h3>👥 Players</h3><div class="hm-kick">${state.players.map((p) => `<button class="chip" data-hk="${esc(p.id)}" data-name="${esc(p.name)}" title="Remove ${esc(p.name)}"><span class="av">${BOX.portrait ? BOX.portrait.html(p, 24) : esc(p.avatar || '')}</span>${esc(p.name)} <b>✕</b></button>`).join('')}</div><p class="muted small">Click a player to remove them from the room. They can't rejoin from the same phone.</p>`}
      ${streamOnly || !partyRunning() ? '' : `<h3>🎉 Party Mode · 🎬 Intros</h3><div class="hm-row">${Object.entries(INTRO_LABEL).map(([k, l]) => `<button class="btn ${state.partyMode.intros === k ? '' : 'ghost'} small" data-hi="${k}">${esc(l)}</button>`).join('')}</div><p class="muted small">In the break: the next game's intro plays during the standings. Skip: a quick title card, then straight in.</p>`}
      <h3>🎥 Streamer options</h3>
      <div class="hm-togs">${tog('hide', 'Hide room code', 'Blur the code and QR code. Tap them to peek.')}${tog('filter', 'Filter player text', 'Cover swear words and slurs in names and answers.')}${tog('delay', 'Streamer delay', 'Wait a few seconds before a new room code shows.')}</div>
      <button class="btn ghost small" data-close>Done</button></div>`;
    document.body.appendChild(o);
    o.onclick = (e) => { if (e.target === o || e.target.closest('[data-close]')) o.remove(); };
    for (const b of o.querySelectorAll('[data-st]')) b.onclick = () => { const k = b.dataset.st; streamer[k] = !streamer[k]; saveStreamer(); b.classList.toggle('on', streamer[k]); BOX.sfx('pop'); if (k === 'delay' && streamer.delay) delayCode = ''; platform(); };
    for (const b of o.querySelectorAll('[data-hk]')) b.onclick = () => { if (!confirm(`Remove ${b.dataset.name} from the room?`)) return; host('kick', { id: b.dataset.hk }).then((r) => { if (r && r.ok) { b.remove(); tvToast(`<span class="tt-i">👋</span><div><b>${esc(b.dataset.name)} was removed</b></div>`); } }); };
    for (const b of o.querySelectorAll('[data-hi]')) b.onclick = () => host('partyIntros', { mode: b.dataset.hi }).then((r) => { if (r && r.ok) { for (const x of o.querySelectorAll('[data-hi]')) x.classList.toggle('ghost', x !== b); BOX.sfx('pop'); } });
    for (const b of o.querySelectorAll('[data-hm]')) b.onclick = () => { o.remove(); if (b.dataset.hm === 'recap') startRecap(); else host('lockRoom', { on: !(state && state.locked) }); };
  }
  function gearButton() {
    if (STAND || $('#tv-gear')) return;
    const b = document.createElement('button'); b.id = 'tv-gear'; b.className = 'btn ghost small tv-gear'; b.title = 'Host menu'; b.textContent = '⚙'; b.onclick = () => hostMenu(false);
    document.querySelector('.tv-bar').appendChild(b);
  }
  // Everything on screen that shows the room code or its QR code.
  function codeEls() {
    const list = [...document.querySelectorAll('#code, #url, #tv-code, .corner .cc, .corner .cq, img[src*="/api/qr"]')];
    if (state && state.code) for (const el of document.querySelectorAll('#tv-main *')) if (!el.children.length && el.textContent.trim() === state.code) list.push(el);
    return list;
  }
  // Swear words and slurs in what the screen shows (every game, without each renderer knowing).
  function filterDom(root) {
    if (!root || !BOX.filter.on || !window.BOX_FILTER) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) { const v = n.nodeValue; if (v && /[A-Za-z0-9@$]{2}/.test(v)) { const c = BOX.filterText(v); if (c !== v) n.nodeValue = c; } }
  }
  function audienceUi() {
    if (!state) return;
    const A = state.audience || {}, n = A.count || 0, P = A.poll;
    let pill = $('#aud-pill'); if (!pill) { pill = document.createElement('div'); pill.id = 'aud-pill'; pill.className = 'aud-pill'; document.body.appendChild(pill); }
    const busy = state.locked || state.phase === 'show' || (state.phase === 'game' && !(state.state && state.state.phase === 'over'));
    const ph = n ? `👀 <b>${n}</b> watching` : busy ? '👀 Late? Scan to watch' : '';
    if (pill.dataset.h !== ph) { pill.innerHTML = ph; pill.dataset.h = ph; pill.classList.remove('bump'); void pill.offsetWidth; pill.classList.add('bump'); }
    pill.hidden = !ph || !!state.recap || rendered === 'title';
    let pv = $('#aud-poll');
    if (!P && lastPoll && lastPoll.winner) {
      if (!pv) { pv = document.createElement('div'); pv.id = 'aud-poll'; pv.className = 'aud-poll'; document.body.appendChild(pv); }
      const h = `<div class="ap-q">📣 ${esc(lastPoll.q)}</div><div class="ap-win">${esc(lastPoll.winner.avatar || '')} <b>${esc(BOX.filterText(lastPoll.winner.label))}</b> wins the crowd!</div><small>${lastPoll.votes} vote${lastPoll.votes === 1 ? '' : 's'}</small>`;
      if (pv.dataset.h !== h) { pv.innerHTML = h; pv.dataset.h = h; }
      pv.hidden = !!state.recap; return;
    }
    if (!P) { if (pv) pv.remove(); return; }
    if (!pv) { pv = document.createElement('div'); pv.id = 'aud-poll'; pv.className = 'aud-poll'; document.body.appendChild(pv); }
    const max = Math.max(1, ...Object.values(P.counts));
    const rows = P.options.map((o) => ({ o, c: P.counts[o.id] || 0 })).sort((a, b) => b.c - a.c).slice(0, 6);
    const h = `<div class="ap-q">📣 ${esc(P.q)}</div><div class="ap-rows">${rows.map(({ o, c }) => `<div class="ap-row"><span class="ap-n">${esc(o.avatar || '')} ${esc(BOX.filterText(o.label))}</span><span class="ap-bar"><i style="width:${Math.round((100 * c) / max)}%;background:${esc(o.color || '#ffd23f')}"></i></span><b>${c}</b></div>`).join('')}</div><small>${P.votes} vote${P.votes === 1 ? '' : 's'} · the audience votes on their phones · ${BOX.timer(P.endsIn)}</small>`;
    if (pv.dataset.h !== h.replace(/data-ends="\d+"/, '')) { pv.innerHTML = h; pv.dataset.h = h.replace(/data-ends="\d+"/, ''); }
    pv.hidden = !!state.recap;
  }
  function recapUi() {
    let ov = $('#recap-ov');
    if (!state || !state.recap || !BOX.recapReel) { if (ov) ov.remove(); document.body.classList.remove('recap-on'); return; }
    if (!ov) { ov = document.createElement('div'); ov.id = 'recap-ov'; ov.className = 'recap-ov'; document.body.appendChild(ov); }
    document.body.classList.add('recap-on');
    BOX.recapReel(ov, state.recap, { host, close: () => host('recapClose') });
  }
  // Party Mode: the lineup is still going (no "play again" until it's done).
  const partyRunning = () => !!(state && state.partyMode && state.partyMode.phase !== 'done');
  // Party Mode, after a game: its end screen stays up, with a countdown bar to the standings.
  let pe = { at: 0, tick: -1, raf: 0 };
  function partyEndingUi() {
    const pm = state && state.partyMode;
    let bar = $('#pe-bar');
    const on = pm && pm.phase === 'ending' && state.phase === 'game' && !state.recap;
    if (!on) { if (bar) { bar.classList.add('out'); setTimeout(() => bar.remove(), 400); bar.id = ''; } cancelAnimationFrame(pe.raf); pe.raf = 0; return; }
    const last = pm.index >= (pm.games || []).length - 1, nx = pm.next && BOX.games[pm.next];
    const nextHtml = last ? '🏆 Then the grand finale!' : nx ? `Next up: <b>${nx.icon} ${esc(nx.name)}</b>` : '';
    if (!bar) { bar = document.createElement('div'); bar.id = 'pe-bar'; bar.className = 'pe-bar'; bar.innerHTML = '<div class="pe-fill"></div><span class="pe-main"></span><span class="pe-next"></span>'; document.body.appendChild(bar); }
    bar.querySelector('.pe-next').innerHTML = nextHtml;
    pe.at = Date.now() + (pm.in || 0); pe.paused = !!pm.paused; pe.total = Math.max(pe.total || 0, pm.in || 0);
    if (pe.key !== pm.index + ':' + pm.phase) { pe.key = pm.index + ':' + pm.phase; pe.total = pm.in || 12000; pe.tick = -1; }
    if (!pe.raf) {
      const f = () => {
        const b = $('#pe-bar'); if (!b) { pe.raf = 0; return; }
        const left = Math.max(0, pe.at - Date.now()), sec = Math.ceil(left / 1000);
        b.classList.toggle('paused', pe.paused);
        b.querySelector('.pe-main').innerHTML = pe.paused ? '⏸ The host is holding the party standings' : `🎉 Party standings in <b>${sec}</b>…`;
        b.querySelector('.pe-fill').style.width = pe.paused ? '100%' : (100 * left) / (pe.total || 12000) + '%';
        if (!pe.paused && sec !== pe.tick) { pe.tick = sec; if (sec > 0 && sec <= 3) BOX.sfx('tick'); }
        pe.raf = requestAnimationFrame(f);
      };
      pe.raf = requestAnimationFrame(f);
    }
  }
  function platform() {
    if (!state) return;
    partyEndingUi();
    gearButton();
    // Text filter: on with the streamer option; the room filters typed text too.
    BOX.filter.on = !!streamer.filter;
    if (state.filterOn !== streamer.filter && filterSent !== streamer.filter) { filterSent = streamer.filter; host('streamer', { filter: streamer.filter }).then(() => { filterSent = null; }); }
    filterDom($('#tv-main'));
    // Streamer: hide the code (tap to peek) and a delay before a new code shows.
    if (streamer.delay && state.code !== delayCode) { delayCode = state.code; delayUntil = Date.now() + DELAY_MS; tickDelay(); }
    const waiting = streamer.delay && Date.now() < delayUntil;
    document.body.classList.toggle('st-hide', !!streamer.hide || waiting);
    document.body.classList.toggle('st-waiting', waiting);
    for (const el of codeEls()) if (!el.classList.contains('st-code')) { el.classList.add('st-code'); el.addEventListener('click', peek); }
    audienceUi(); recapUi();
  }
  function peek(e) {
    if (!document.body.classList.contains('st-hide') || document.body.classList.contains('st-waiting')) return;
    e.preventDefault(); e.stopPropagation();
    document.body.classList.add('st-reveal'); clearTimeout(revealT); revealT = setTimeout(() => document.body.classList.remove('st-reveal'), 6000);
  }
  function tickDelay() {
    let b = $('#st-delay'); if (!b) { b = document.createElement('div'); b.id = 'st-delay'; b.className = 'st-delay'; document.body.appendChild(b); }
    const left = delayUntil - Date.now();
    if (left <= 0 || !streamer.delay) { b.remove(); platform(); return; }
    b.innerHTML = `🎥 Streamer delay · the room code shows in <b>${Math.ceil(left / 1000)}</b>`;
    setTimeout(tickDelay, 250);
  }

  // ---- Party Mode: what's next, its settings, and the intros ----
  // The ⚙ menu cycles the party's intros: play each → in the break → skip.
  const INTRO_LABEL = { play: 'Play each', break: 'In the break', skip: 'Skip' };
  const fitLine = (info) => (info && info.summary && info.summary.length ? info.summary.map((x) => `<span>${esc(x)}</span>`).join('') : '');
  // A small "Game 2 of 5 · 5 orders · 45 seconds" tag over an intro played in a party.
  const partyBadge = (info) => (info ? `<div class="pv-badge">🎉 Game ${info.n} of ${info.of}${info.last ? ' · the finale' : ''}${fitLine(info) ? ` · <span class="pv-fit">${fitLine(info)}</span>` : ''}</div>` : '');
  // "Skip intros": the game's title card (icon, name, where it is in the lineup, its settings).
  function titleCard(sh) {
    const g = BOX.games[sh.game] || {}, info = sh.info || null;
    return `<div class="pc-card" style="--pc:${esc(g.color || '#ffd23f')}">
      ${info ? `<div class="pc-kicker">🎉 Game ${info.n} of ${info.of}${info.last ? ' · the finale!' : ''}</div>` : ''}
      <div class="pc-icon">${esc(g.icon || '🎮')}</div>
      <h1 class="pc-title">${esc(sh.title)}</h1>
      ${fitLine(info) ? `<div class="pc-fit">${fitLine(info)}</div>` : ''}
      <p class="pc-go">Get ready! Look at your phone 📱</p>
      <div class="pc-bar"><i style="animation-duration:${Math.max(500, sh.endsIn || 4500)}ms"></i></div>
    </div>`;
  }
  // The strip over an intro playing in the standings break.
  function previewBar(pm) {
    const bar = $('#pv-bar'); if (!bar) return;
    const u = pm.upNext || {};
    const h = `<div class="pv-up"><span class="pv-k">🍿 Up next${u.n ? ` · Game ${u.n} of ${u.of}` : ''}</span><b>${esc(u.title || '')}</b>${fitLine(u) ? `<span class="pv-fit">${fitLine(u)}</span>` : ''}</div>
      <div class="pv-btns"><button class="pb-btn go" data-pv="partyNext">⏭ Start now</button><button class="pb-btn ghost" data-pv="partyPause">${pm.paused ? '▶ Resume' : '⏸ Wait'}</button></div>`;
    if (bar.dataset.html === h) return;
    bar.innerHTML = h; bar.dataset.html = h;
    for (const b of bar.querySelectorAll('[data-pv]')) b.onclick = () => host(b.dataset.pv);
  }

  function render() {
    if (!state) return;
    if (STAND) corner();
    const code = $('#tv-code');
    code.hidden = state.phase === 'lobby' || STAND;
    const codeHtml = `<span>Join: <b>${esc(state.code)}</b></span><img src="${qr()}" alt="QR code to join">`;
    if (code.dataset.code !== state.code + baseUrl) { code.innerHTML = codeHtml; code.dataset.code = state.code + baseUrl; }
    const main = $('#tv-main');
    // Party Mode: the standings board between games, and the finale (drawn by partyboard.js).
    // After a game played elsewhere (pm.ext) the room sits in a lobby, but the board shows.
    const pm = state.partyMode;
    if (state.phase === 'lobby' && !(pm && pm.ext && (pm.phase === 'board' || pm.phase === 'done'))) return lobby();
    if (pm && (pm.phase === 'board' || pm.phase === 'done') && BOX.partyBoard) {
      // Intros "in the break": the next game's cutscene takes over the standings until it starts.
      if (pm.phase === 'board' && (pm.preview || rendered === 'preview') && BOX.showIntro) {
        if (pm.preview) {
          if (rendered !== 'preview') { main.innerHTML = '<div id="show-area" class="show-area"></div><div class="pv-bar" id="pv-bar"></div>'; rendered = 'preview'; }
          BOX.showIntro($('#show-area'), pm.preview, { players: state.players, host });
        }
        previewBar(pm);
        return;
      }
      if (rendered !== 'board') { main.innerHTML = '<div id="pb-area" class="pb-area"></div>'; rendered = 'board'; }
      BOX.partyBoard($('#pb-area'), state, { host });
      return;
    }
    // Game-show opening (studio, audience, host, contestants): full screen, drawn by show.js.
    if (state.phase === 'show' && state.show) {
      // Party Mode "Skip intros": just the next game's title card for a moment.
      if (state.show.mode === 'card') {
        const h = titleCard(state.show);
        if (rendered !== 'card') { main.innerHTML = '<div id="card-area" class="show-area pc-area"></div><button class="show-skip" id="show-skip" data-h="next">Start now ⏩</button>'; rendered = 'card'; $('#show-skip').onclick = () => host('next'); BOX.sfx('whoosh'); }
        const ca = $('#card-area'); if (ca.dataset.html !== h) { ca.innerHTML = h; ca.dataset.html = h; }
        return;
      }
      // How to play (after the intro): its own full-screen tutorial (howto.js).
      if (state.show.step === 'howto' && BOX.showHowto) {
        if (rendered !== 'howto') {
          main.innerHTML = '<div id="howto-area" class="show-area"></div><button class="show-skip" id="show-skip" data-h="next">Start the game ⏩</button>';
          rendered = 'howto';
          $('#show-skip').onclick = () => host('next');
        }
        BOX.showHowto($('#howto-area'), state.show, { players: state.players, host });
        return;
      }
      if (rendered !== 'show') {
        main.innerHTML = `<div id="show-area" class="show-area"></div>${partyBadge(state.show.info)}<button class="show-skip" id="show-skip" data-h="next">Skip intro ⏩</button>`;
        rendered = 'show';
        $('#show-skip').onclick = () => host('next');
      }
      if (BOX.showIntro) BOX.showIntro($('#show-area'), state.show, { players: state.players, host });
      else $('#show-area').innerHTML = `<div class="final"><h2>🎤 ${esc(state.show.title)}</h2><p>${state.show.step === 'facts' ? `Tell the host a funny fact on your phone! ${state.show.submitted}/${state.show.of}` : 'Meet the contestants!'}</p></div>`;
      return;
    }
    if (rendered !== 'game') { main.innerHTML = '<div id="g-area"></div><div class="host-row" id="host-row"></div>'; rendered = 'game'; }
    G.tv($('#g-area'), state.state, { players: state.players, settings: state.settings, host, filterText: BOX.filterText });
    if (STAND) { $('#host-row').hidden = true; return; }
    const over = state.state && state.state.phase === 'over';
    const inParty = partyRunning();
    const hr = `${over && inParty ? `<button class="btn" data-h="partyBoardNow">⏩ Show standings now</button> <button class="btn ghost" data-h="partyPause">${state.partyMode.paused ? '▶ Resume' : '⏸ Wait'}</button>` : over ? '<button class="btn" data-h="again">▶ Play again</button> <button class="btn cyan" data-h="pick">🎮 Another game</button>' : '<button class="btn ghost small" data-h="next">Skip ahead ▶</button>'} <button class="btn ghost small" data-h="lobby">Back to lobby</button> <button class="btn ghost small" data-h="bots">+ 5 bots</button>${over ? ' <button class="btn ghost small" data-h="recap">🎬 Night recap</button>' + partyHtml() : ''}`;
    if ($('#host-row').dataset.html === hr) return;
    $('#host-row').innerHTML = hr; $('#host-row').dataset.html = hr;
    for (const b of document.querySelectorAll('#host-row [data-h]')) b.onclick = () => { const h = b.dataset.h; if (h === 'pick') return tvPicker(); if (h === 'recap') return startRecap(); if (h === 'lobby' && !over && !confirm('End this game and go back to the lobby?')) return; host(h === 'bots' ? 'addBots' : h, { count: 5 }); };
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
      code: state.code, joinUrl: joinUrl(), qr: qr(), players: state.players, vip: state.vip, min: state.min, max: state.max, audience: (state.audience && state.audience.count) || 0,
      fields: state.fields, settings: state.settings, partyMode: state.partyMode || null,
      lineupHtml: state.partyMode && BOX.partyLineup ? BOX.partyLineup(state) : '',
      set: (key, value) => host('settings', { settings: { [key]: value } }),
      start: () => host('start'), bots: (n = 5) => host('addBots', { count: n }), removeBots: () => host('removeBots'),
      kick: (id) => host('kick', { id }), pick: () => tvPicker(), back: () => { location.href = '/'; },
    };
  }
  // JustGold faces in the designed lobbies: each game draws its roster with the player's emoji; where
  // a player has a character, that emoji (in their chip, or a unique emoji in #roster) shows their face.
  function faceRoster(root) {
    if (!BOX.portrait || !root) return;
    const roster = root.querySelector('#roster') || root;
    const leafOf = (scope, emo) => [...scope.querySelectorAll('span, div, i, b, em')].find((e) => !e.children.length && e.textContent.trim() === emo);
    for (const p of state.players) {
      if (!p.look || !p.avatar) continue;
      const chip = root.querySelector(`[data-kick="${CSS.escape(String(p.id))}"]`);
      const unique = state.players.filter((q) => q.avatar === p.avatar).length === 1;
      const leaf = chip ? leafOf(chip, p.avatar) : unique ? leafOf(roster, p.avatar) : null;
      if (!leaf) continue;
      const size = Math.max(22, Math.min(120, Math.round(parseFloat(getComputedStyle(leaf).fontSize || '24') * 1.75)));
      leaf.innerHTML = BOX.portrait.html(p, size);
    }
  }
  function lobby() {
    const main = $('#tv-main');
    if (G.lobbyTv && !state.live) {
      if (rendered !== 'custom-lobby') { main.innerHTML = '<div id="lobby-area" class="lobby-area"></div>'; rendered = 'custom-lobby'; }
      try { G.lobbyTv($('#lobby-area'), lobbyApi()); } catch (e) { console.error(e); }
      try { faceRoster($('#lobby-area')); } catch (e) { /* the emoji stays */ }
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
  const partyFace = (r) => (BOX.face && BOX.hasLook(r) ? BOX.face(r, 24, { plain: true }) : esc(r.avatar || ''));
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
    $('#roster').innerHTML = state.players.map((p) => `<span class="chip ${p.online ? '' : 'off'}" data-kick="${esc(p.id)}" title="Click to remove"><i style="background:${esc(p.color)}"></i><span class="av">${BOX.portrait ? BOX.portrait.html(p, 30) : esc(p.avatar || '')}</span>${esc(p.name)}${p.title ? `<em class="ptitle">${esc(p.title)}</em>` : ''}</span>`).join('') || '<span class="muted">Scan the QR code to join.</span>';
    const lu = $('#lineup'); if (lu) { const lh = state.partyMode && BOX.partyLineup ? BOX.partyLineup(state) : ''; if (lu.dataset.html !== lh) { lu.innerHTML = lh; lu.dataset.html = lh; } }
    const pp = $('#party');
    if (pp) { const ph = state.played && state.played.length ? `<h3>🎉 Party points · ${state.played.length} game${state.played.length === 1 ? '' : 's'} tonight</h3><div class="board">${state.party.slice(0, 8).map((r, i) => `<div class="row"><span class="n">${i + 1}</span><span class="av">${partyFace(r)}</span><span>${esc(r.name)}${r.wins ? ' ' + '🏆'.repeat(Math.min(3, r.wins)) : ''}</span><b>${r.pts}</b></div>`).join('')}</div><div class="played">${state.played.slice(-6).map((g) => `${esc(g.title)}${g.winner ? ': ' + esc(g.winner) : ''}`).join(' · ')}</div>` : ''; if (pp.dataset.html !== ph) { pp.innerHTML = ph; pp.dataset.html = ph; } }
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
