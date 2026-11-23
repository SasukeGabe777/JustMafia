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
  // Lifetime profile (box/profiles.js): { id, token } on this phone; the server keeps the stats.
  const PROF_KEY = 'box.profile';
  const getProf = () => { try { const p = JSON.parse(localStorage.getItem(PROF_KEY) || 'null'); return p && p.id && p.token ? p : null; } catch { return null; } };
  const setProf = (p) => { try { if (p) localStorage.setItem(PROF_KEY, JSON.stringify({ id: p.id, token: p.token })); else localStorage.removeItem(PROF_KEY); } catch { /* private mode */ } };
  let audience = null; // { id, name, avatar, playNext } while watching; the shared state is in audState
  let audState = null; const myVotes = {};

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

  // Phone sound volume (the TV has its own in its ⚙ / 🔊 menus). Remembered on this phone.
  const phoneVol = () => { try { const v = Number(localStorage.getItem('box.phoneVol')); return Number.isFinite(v) && localStorage.getItem('box.phoneVol') != null ? Math.max(0, Math.min(1, v)) : 1; } catch { return 1; } };
  const setPhoneVol = (v) => { try { localStorage.setItem('box.phoneVol', String(v)); } catch { /* private */ } try { window.SFX && SFX.setVolume && SFX.setVolume(v); } catch { /* none */ } };
  try { window.SFX && SFX.setVolume && SFX.setVolume(phoneVol()); } catch { /* none */ }

  // ---------- 🛍️ the JustGold shop (/shop): on the join screen, in the lobby and between games ----------
  // The shop opens on this game's section (the game being played, or the one the typed code is for).
  let checkedGame = null;
  const shopUrl = () => { const g = gameKey || checkedGame; return '/shop?back=' + encodeURIComponent(location.pathname + location.search) + (g ? '&game=' + encodeURIComponent(g) : ''); };
  function shopButtons() {
    let hb = $('#h-shop');
    if (!hb && $('#h-prof')) { hb = document.createElement('button'); hb.className = 'hbtn'; hb.id = 'h-shop'; hb.title = 'Shop & character'; hb.textContent = '🛍️'; hb.onclick = () => { location.href = shopUrl(); }; $('#h-prof').before(hb); }
    let jb = $('#j-shop');
    if (!jb && $('#j-watch2')) { jb = document.createElement('a'); jb.className = 'btn ghost'; jb.id = 'j-shop'; jb.style.cssText = 'display:block;text-align:center;text-decoration:none'; jb.textContent = '🛍️ Shop & character'; $('#j-watch2').after(jb); }
    if (jb) jb.href = shopUrl();
    // Never while a game is running: the shop waits for the lobby or the end of the game.
    const running = !!view && !audience && (view.phase === 'show' || (view.phase === 'game' && !(view.state && view.state.phase === 'over')));
    if (hb) hb.hidden = running;
  }

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
    shopButtons();
    joinAccount();
    busyChoice(null);
    if ($('#j-code').value.length === 4) socket.emit('room:check', { code: $('#j-code').value }, (r) => { if (goElsewhere(r)) return; $('#j-game').textContent = r && r.ok ? 'Joining ' + (r.away ? r.away.title : r.title) : ''; if (r && r.ok) { checkedGame = r.away ? 'mafia' : r.game; const jb = $('#j-shop'); if (jb) jb.href = shopUrl(); theme(r.game); busyChoice(r.busy, r); } });
  }
  // One code for every game: a JustMafia town's code opens JustMafia's own join page.
  function goElsewhere(r) {
    if (!r || r.ok || !r.url || typeof r.url !== 'string' || !/^\/[a-z]/.test(r.url) || socket.leaving) return false;
    socket.leaving = true; location.replace(r.url); return true;
  }
  // A game is running (or the room is full / locked): play next game, or watch as audience.
  function busyChoice(busy, info) {
    const box = $('#j-busy'); if (!box) return;
    box.hidden = !busy; $('#j-go').hidden = !!busy; $('#j-watch2').hidden = !!busy;
    if (!busy) return;
    $('#j-busy-msg').innerHTML = busy === 'running' ? `🎬 <b>${esc((info && info.title) || 'A game')}</b> is in full swing!` : busy === 'full' ? '🙀 This room is full.' : '🔒 The host locked this room.';
    $('#j-next').hidden = busy === 'full';
  }
  function setGame(key) {
    if (key === gameKey) return;
    gameKey = key; G = BOX.games[key] || null; theme(key);
    if (me) history.replaceState(null, '', (G && G.standalone ? '/' + key + '/play' : '/box/play') + '?room=' + me.code);
    $('#h-game').textContent = G ? G.icon : ''; $('#h-game').title = G ? G.name : '';
    $('#g-body').innerHTML = ''; window.scrollTo(0, 0);
  }
  function join(code, name, token, mode) {
    socket.emit('player:join', { code, name, token, avatar, mode, profile: getProf() }, (r) => {
      if (!token && goElsewhere(r)) return;
      if (r && !r.ok && r.busy && !token) { showJoin(); busyChoice(r.busy, { title: $('#j-game').textContent.replace(/^Joining /, '') }); return; }
      if (!r || !r.ok) { if (token) { try { localStorage.removeItem(tokenKey(code)); } catch { /* */ } return showJoin(); } return showJoin(r && r.error); }
      me = { code: r.code, id: r.id, token: r.token, name: name || (load(r.code) || {}).name };
      store(r.code, { token: r.token, name: me.name });
      ensureProfile();
      if (r.audience) { enterAudience(r); return; }
      audience = null; audState = null;
      gameKey = null; setGame(r.game);
      $('#join').hidden = true; $('#game').hidden = false;
      try { SFX.unlock(); } catch { /* */ }
    });
  }
  const joinWith = (mode) => {
    const code = $('#j-code').value.trim().toUpperCase(), name = $('#j-name').value.trim();
    if (code.length !== 4) return void ($('#j-err').textContent = 'Enter the 4-letter code from the big screen.');
    if (!name) return void ($('#j-err').textContent = 'Type your name.');
    join(code, name, null, mode);
  };
  $('#j-go').onclick = () => joinWith();
  $('#j-next').onclick = () => joinWith('next');
  $('#j-watch').onclick = () => joinWith('watch');
  $('#j-watch2').onclick = () => joinWith('watch');
  $('#j-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); if (e.target.value.length === 4) showJoin(); });
  $('#j-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#j-go').click(); });
  const leaveGame = () => { if (!confirm('Leave this game?')) return; socket.emit('player:leave', {}, () => { try { localStorage.removeItem(tokenKey(me.code)); } catch { /* */ } me = null; audience = null; audState = null; document.body.classList.remove('is-audience'); showJoin(); }); };

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
    const pv = Math.round(phoneVol() * 100), snd = `<h3>🔈 Phone sounds</h3><label class="ph-vol"><input type="range" id="pvol" min="0" max="100" value="${pv}"><output id="pvol-o">${pv}%</output></label>`;
    const hz = window.HAPTIC && window.HAPTIC.supported ? `<h3>📳 Vibration</h3><button class="btn ${window.HAPTIC.enabled ? 'green' : 'ghost'}" id="hz">${window.HAPTIC.enabled ? 'On: tap to turn off' : 'Off: tap to turn on'}</button>` : '';
    sheet(`<button class="btn ghost prof-link" id="to-prof">🏆 My profile</button><h2>Pick your avatar</h2><div class="j-av big">${AVATARS.map((a) => `<button class="${view && view.me.avatar === a ? 'on' : ''}" data-av="${a}">${a}</button>`).join('')}</div>${snd}${hz}<button class="btn ghost sheet-leave" id="h-leave">🚪 Leave this game</button>`, (s, close) => {
      s.querySelector('#h-leave').onclick = () => { close(); leaveGame(); };
      s.querySelector('#to-prof').onclick = () => { close(); profileSheet(); };
      const pr = s.querySelector('#pvol'); if (pr) pr.oninput = () => { setPhoneVol(pr.value / 100); s.querySelector('#pvol-o').textContent = pr.value + '%'; BOX.sfx('pop'); };
      const hb = s.querySelector('#hz'); if (hb) hb.onclick = () => { window.HAPTIC.set(!window.HAPTIC.enabled); close(); toast(window.HAPTIC.enabled ? '📳 Vibration on' : 'Vibration off'); };
      for (const b of s.querySelectorAll('[data-av]')) b.onclick = () => { avatar = b.dataset.av; try { localStorage.setItem('box.avatar', avatar); } catch { /* */ } socket.emit('player:avatar', { avatar }, () => {}); close(); };
    });
  };
  // Games the room can switch to (the ones this page knows how to draw).
  const SWITCHABLE = ['president', 'blanks', 'blackjack', 'bid', 'price', 'emoji', 'truths', 'likely', 'whosaid', 'spectrum', 'sketch', 'funny', 'zombie', 'king', 'undercover', 'snap', 'pizza', 'escape', 'marble', 'debate', 'actout', 'tune', 'alien', 'bomb', 'quickdraw', 'summon', 'letters', 'memes', 'colormatch', 'trivia', 'plinko', 'ducks', 'kingdoms', 'mafia'];
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
      <button class="btn ghost" data-do="bots">🤖 Add 5 bots</button><button class="btn ghost" data-do="nobots">Remove bots</button></div>
      ${(view.kickList || []).length ? `<h3>👥 Players</h3><div class="kick-list">${view.kickList.map((x) => `<div class="kick-row${x.online ? '' : ' off'}"><span>${esc(x.avatar || '')} ${esc(x.name)}${x.online ? '' : ' <small class="muted">(offline)</small>'}</span><button class="btn ghost small" data-kick="${esc(x.id)}" data-name="${esc(x.name)}">Remove</button></div>`).join('')}</div>` : ''}`, (s, close) => {
      for (const b of s.querySelectorAll('[data-kick]')) b.onclick = async () => {
        if (!confirm(`Remove ${b.dataset.name} from the room?`)) return;
        const r = await hostDo('kick', { id: b.dataset.kick }); if (r.ok) { toast('👋 ' + b.dataset.name + ' was removed.'); b.closest('.kick-row').remove(); }
      };
      for (const b of s.querySelectorAll('[data-do]')) b.onclick = () => {
        const d = b.dataset.do; close();
        if (d === 'pick') return gamePicker();
        if (d === 'lobby' && !confirm('End this game for everyone and go back to the lobby?')) return;
        hostDo(d);
      };
    });
  };
  // ---------- 🏆 My profile: lifetime stats, trophy case, titles, "Save your stuff" ----------
  const pemit = (ev, msg) => new Promise((res) => socket.emit(ev, msg, (r) => res(r || { ok: false, error: 'No answer from the server.' })));
  // "Save your stuff" (public/account-ui.js): name + password keeps the account (JustGold,
  // character, items, stats); signing in on this phone switches it to the saved account.
  const acct = window.JGAccount ? JGAccount.create({ socket, toast, haptic, name: () => (view && view.me && view.me.name) || (me && me.name) || '', onChange: async (kind) => {
    // (profile:login re-links the room seat itself; after signing out the seat gets a fresh guest account)
    if (kind === 'signout' && me) await ensureProfile();
    if (kind === 'signin') { try { $('#j-name').value = localStorage.getItem('box.name') || $('#j-name').value; } catch { /* private */ } }
    if (!$('#join').hidden) joinAccount();
  } }) : null;
  const joinAccount = () => {
    if (!acct || $('#join').hidden) return;
    let el = $('#j-acct'); if (!el) { el = document.createElement('div'); el.id = 'j-acct'; $('#j-err').after(el); }
    acct.banner(el, { join: true });
  };
  let profBusy = null; // the profile:create in flight (callers wait for the same one)
  function ensureProfile() {
    if (getProf()) return Promise.resolve();
    if (!profBusy) profBusy = pemit('profile:create', { name: me && me.name }).then((r) => { profBusy = null; if (r.ok) setProf(r); });
    return profBusy;
  }
  const gname = (k) => (BOX.games[k] ? BOX.games[k].icon + ' ' + BOX.games[k].name : k);
  // ⭐ Progress (public/progress-ui.js, box/progress.js): level, today's 3, this week's 5, the event
  // and its season pass. They live on the account's wallet: linked here the first time.
  async function progressFill(el) {
    if (!el || !window.JGProgress) return;
    JGProgress.render(el, null);
    const auth = getProf();
    let r = auth ? await pemit('progress:get', { auth }) : { ok: false };
    if (!r.ok && r.noWallet && acct) { await acct.linkWallet(); r = await pemit('progress:get', { auth }); }
    if (!r.ok) { el.innerHTML = `<p class="muted">${esc(r.error || 'Your progress isn’t available here.')}</p>`; return; }
    const lv = document.querySelector('.pf-head .pf-lv'); if (lv) lv.innerHTML = JGProgress.badge(r.progress.level);
    JGProgress.render(el, r.progress, { toast, reroll: (period, id) => pemit('progress:reroll', { auth: getProf(), period, id }), premium: () => pemit('progress:premium', { auth: getProf() }).then((x) => { if (x.ok) haptic('win'); return x; }) });
  }
  async function profileSheet(tab = 'progress') {
    let auth = getProf();
    if (!auth) { await ensureProfile(); auth = getProf(); }
    let r = auth ? await pemit('profile:get', { auth }) : { ok: false };
    if (!r.ok && auth) { setProf(null); await ensureProfile(); auth = getProf(); r = auth ? await pemit('profile:get', { auth }) : r; }
    if (!r.ok) return toast(r.error || 'Profiles are not available here.');
    const P = r.profile, S = P.stats, earned = P.trophies.filter((t) => t.earned);
    const nm = P.name || (view && view.me.name) || (me && me.name) || 'Player';
    const tabs = `<div class="pf-tabs">${[['progress', '⭐', 'Progress'], ['stats', '📊', 'Stats'], ['trophies', `🏆 <small>${earned.length}/${P.trophies.length}</small>`, 'Trophies'], ['account', P.claimed ? '✅' : '💾', P.claimed ? 'Saved' : 'Save']].map(([k, i, l]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}"><span>${i}</span>${l}</button>`).join('')}</div>`;
    let body = '';
    if (tab === 'progress') {
      body = '<div id="pf-prog"></div>';
    } else if (tab === 'stats') {
      body = `<div class="pf-tiles"><div><b>${S.nights}</b><span>nights</span></div><div><b>${S.games}</b><span>games</span></div><div><b>${S.wins}</b><span>wins</span></div><div><b>${S.partyPts}</b><span>party pts</span></div></div>
        <div class="pf-tiles small"><div><b>${S.bestPlace ? '#' + S.bestPlace : '–'}</b><span>best finish</span></div><div><b>${S.podiums}</b><span>top-3s</span></div><div><b>${S.partyWins}</b><span>party wins</span></div><div><b>${S.audienceFavs}</b><span>crowd favs</span></div></div>
        <h3>🎮 By game</h3>${S.byGame.length ? `<div class="pf-games">${S.byGame.map((g) => `<div><span>${esc(gname(g.game))}</span><small>${g.played} played</small><b>${g.won ? '🏆 ' + g.won : '–'}</b></div>`).join('')}</div>` : '<p class="muted">Finish a game and it shows up here.</p>'}
        ${P.nights.length ? `<h3>🌙 Recent nights</h3><div class="pf-nights">${P.nights.slice(0, 5).map((n) => `<div><span>${esc(new Date(n.at).toLocaleDateString())}</span><small>${n.games} game${n.games === 1 ? '' : 's'} · ${n.wins} win${n.wins === 1 ? '' : 's'}${n.place ? ' · party #' + n.place : ''}</small><b>${n.pts} pts</b></div>`).join('')}</div>` : ''}`;
    } else if (tab === 'trophies') {
      body = `<p class="muted small">Tap a trophy you’ve earned to wear its title next to your name.</p><div class="pf-case">${P.trophies.map((t) => `<button class="pf-tro ${t.earned ? 'got' : ''} ${P.title === t.id ? 'worn' : ''}" data-tro="${t.id}" ${t.earned ? '' : 'disabled'}><span class="pf-ti">${t.earned ? esc(t.icon) : '🔒'}</span><b>${esc(t.name)}</b><small>${esc(t.earned ? '“' + t.title + '”' : t.how)}</small>${P.title === t.id ? '<em>WORN</em>' : ''}</button>`).join('')}</div>
        ${(P.levelTitles || []).length ? `<h3>⭐ Level &amp; season titles</h3><div class="pf-case">${P.levelTitles.map((t) => `<button class="pf-tro got ${P.title === t.id ? 'worn' : ''}" data-tro="${esc(t.id)}"><span class="pf-ti">⭐</span><b>${esc(t.text)}</b><small>“${esc(t.text)}”</small>${P.title === t.id ? '<em>WORN</em>' : ''}</button>`).join('')}</div>` : ''}
        ${P.title ? '<button class="btn ghost small" data-tro="">Take off my title</button>' : ''}`;
    } else {
      // "Save your stuff" (public/account-ui.js): name + password, sign in, change password, sign out.
      body = `<div id="pf-acct"></div><p class="muted small">${esc(P.storage)}. Without a password your stuff lives on this phone only.</p>`;
    }
    sheet(`<div class="pf-head"><span class="pf-av">${esc((view && view.me.avatar) || avatar)}</span><div><h2>${esc(nm)}<span class="pf-lv">${view && view.me.level && window.JGProgress ? JGProgress.badge(view.me.level) : ''}</span></h2>${P.titleText ? `<span class="pf-title">${esc(P.titleText)}</span>` : '<span class="muted small">No title yet: earn trophies!</span>'}</div></div>${tabs}<div class="pf-body">${body}</div>`, (sh, close) => {
      for (const b of sh.querySelectorAll('[data-tab]')) b.onclick = () => profileSheet(b.dataset.tab);
      for (const b of sh.querySelectorAll('[data-tro]')) b.onclick = async () => { const x = await pemit('profile:title', { auth: getProf(), title: b.dataset.tro || null }); if (!x.ok) return toast(x.error); haptic('success'); toast(b.dataset.tro ? '🏆 New title on!' : 'Title off'); profileSheet('trophies'); };
      const pa = sh.querySelector('#pf-acct'); if (pa && acct) acct.panel(pa, 'auto', (kind) => profileSheet(kind === 'signin' ? 'progress' : 'account'));
      progressFill(sh.querySelector('#pf-prog'));
    });
  }
  $('#h-prof').onclick = () => profileSheet();
  // The host removed this phone from the room.
  socket.on('kicked', (m) => {
    const code = (m && m.room) || (me && me.code);
    try { if (code) localStorage.removeItem(tokenKey(code)); } catch { /* private */ }
    me = null; audience = null; audState = null; document.body.classList.remove('is-audience');
    showJoin('👋 The host removed you from this room.'); haptic('error');
  });
  socket.on('trophy', (list) => {
    for (const t of list || []) { toast(`🏆 Trophy unlocked: ${t.icon} ${t.name}!`); }
    haptic('win'); BOX.sfx('win');
  });

  // ---------- the audience: watch, react, vote, then play next ----------
  function enterAudience(r) {
    audience = { id: r.id, name: r.name, avatar: r.avatar, playNext: r.playNext };
    audState = r.state || audState; view = null;
    document.body.classList.add('is-audience');
    $('#join').hidden = true; $('#game').hidden = false;
    gameKey = null; setGame(r.game);
    $('#h-name').textContent = r.name; $('#h-av').textContent = r.avatar || '';
    audienceDraw();
  }
  socket.on('aud', (st) => { if (!audience) return; const g0 = audState && audState.game; audState = st; if (st.game !== g0) setGame(st.game); audienceDraw(); });
  socket.on('promoted', (m) => { if (!audience || !me) return; toast('🎮 You’re in! Joining the game…'); haptic('big'); const code = me.code; audience = null; document.body.classList.remove('is-audience'); join(code, m.name || me.name, m.token); });
  function audienceDraw() {
    const st = audState; if (!audience || !st) return;
    const g = BOX.games[st.game], P = st.poll, mine = P ? myVotes[P.id] : null;
    const phase = st.phase === 'lobby' ? 'In the lobby' : st.phase === 'show' ? 'The intro is on' : st.phase === 'over' ? 'Game over!' : 'Playing now';
    const max = P ? Math.max(1, ...Object.values(P.counts)) : 1;
    const poll = P ? `<div class="card-box au-poll"><div class="au-q">📣 ${esc(P.q)}</div><div class="au-opts">${P.options.map((o) => `<button class="au-opt ${mine === o.id ? 'on' : ''}" data-vote="${esc(o.id)}" style="--pc:${esc(o.color || '#ffd23f')}"><span class="au-oa">${esc(o.avatar || '⭐')}</span><b>${esc(o.label)}</b><i style="width:${Math.round((100 * (P.counts[o.id] || 0)) / max)}%"></i><em>${P.counts[o.id] || 0}</em></button>`).join('')}</div><small class="muted">${mine ? 'Vote counted! You can change it.' : 'Tap your favourite.'} ${P.votes} vote${P.votes === 1 ? '' : 's'} · ${BOX.timer(P.endsIn)}</small></div>`
      : st.lastPoll && st.lastPoll.winner ? `<div class="card-box au-poll done"><div class="au-q">📣 ${esc(st.lastPoll.q)}</div><p><b>${esc(st.lastPoll.winner.avatar || '')} ${esc(st.lastPoll.winner.label)}</b> wins the crowd!</p></div>` : '';
    const recap = st.recap ? `<div class="card-box au-recap"><h3>🎬 Night recap on the TV</h3>${st.recap.champion ? `<p>👑 Champion: <b>${esc(st.recap.champion.avatar || '')} ${esc(st.recap.champion.name)}</b></p>` : ''}<ol>${st.recap.played.slice(-8).map((x) => `<li>${esc(BOX.games[x.game] ? BOX.games[x.game].icon : '🎮')} ${esc(x.title)}${x.winner ? `: 🏆 ${esc(x.winner)}` : ''}</li>`).join('')}</ol></div>` : '';
    BOX.morph($('#g-body'), `<div class="card-box au-card"><div class="au-badge">👀 AUDIENCE</div>
        <div class="au-now"><span class="au-gi">${esc(g ? g.icon : '🎮')}</span><div><small>${esc(phase)}</small><b>${esc(st.title)}</b></div></div>
        <div class="au-counts"><span>🎮 <b>${st.players}</b> playing</span><span>👀 <b>${st.audience}</b> watching</span></div>
        <button class="btn ${audience.playNext ? 'green' : 'ghost'} au-next" id="au-next">${audience.playNext ? '✅ You’ll join the next game' : '🎮 Play next game'}</button>
        ${audience.playNext && st.locked ? '<small class="muted">The host locked the room for now.</small>' : ''}</div>
      ${poll}${recap}
      <div class="card-box au-react"><h3>React on the big screen</h3><div class="au-rgrid">${REACTIONS.map((e) => `<button data-ar="${e}">${e}</button>`).join('')}</div></div>
      ${st.top && st.top.length ? `<div class="card-box au-top"><h3>🎉 Party points</h3><div class="board">${st.top.map((r, i) => `<div class="row"><span class="n">${i + 1}</span><span>${esc(r.avatar || '')} ${esc(r.name)}</span><b>${r.pts}</b></div>`).join('')}</div></div>` : ''}`);
    const nb = $('#au-next'); if (nb) nb.onclick = () => socket.emit('audience:next', { on: !audience.playNext }, (r) => { if (r && r.ok) { audience.playNext = r.playNext; haptic('success'); audienceDraw(); } });
    for (const b of document.querySelectorAll('[data-vote]')) b.onclick = () => socket.emit('audience:vote', { option: b.dataset.vote }, (r) => { if (r && r.ok) { myVotes[r.poll] = b.dataset.vote; haptic('select'); audienceDraw(); } else if (r && r.error) toast(r.error); });
    for (const b of document.querySelectorAll('[data-ar]')) b.onclick = () => { socket.emit('player:react', { e: b.dataset.ar }, () => {}); vibrate(12); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); };
  }

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
    if (s && s.token) join(code, s.name, s.token);
    else if (!me && code && params.get('auto') && params.get('name')) autoJoin(code, params.get('name'), 0);
    else if (!me) showJoin();
  });
  // Sent here by another game (JustMafia's "Play another game"): ?room=CODE&name=NAME&auto=1
  // joins straight away with that name. A taken name gets a number; anything else shows the form.
  function autoJoin(code, name, tries) {
    const clean = String(name).replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, tries ? 12 : 14);
    if (!clean) return showJoin();
    const nm = tries ? clean + ' ' + (tries + 1) : clean;
    socket.emit('player:join', { code, name: nm, avatar, profile: getProf() }, (r) => { // (with the account, so the character and JustGold follow)
      if (r && r.ok) {
        me = { code: r.code, id: r.id, token: r.token, name: nm }; store(r.code, { token: r.token, name: nm });
        gameKey = null; setGame(r.game); $('#join').hidden = true; $('#game').hidden = false;
        return;
      }
      if (r && /already has that name/.test(r.error || '') && tries < 5) return autoJoin(code, name, tries + 1);
      $('#j-name').value = nm; showJoin(r && r.error);
    });
  }
  // ---------- 🪙 JustGold: the chest after every game, the balance in the header ----------
  let chestSeen = null, jgShown = null, jgHold = false, jgRaf = 0, coinAt = 0;
  const phoneSound = (k) => {
    if (k === 'coin') { const now = Date.now(); if (now - coinAt < 70) return; coinAt = now; }
    BOX.sfx({ coin: 'coin', rattle: 'rattle', open: 'chestOpen', fanfare: 'chestOpen', done: 'saved' }[k] || k);
    if (k === 'fanfare') setTimeout(() => BOX.sfx('win'), 350);
  };
  // Returns true while this game's chest is (about to be) on screen.
  function chestPhone(v) {
    if (!window.JGChest) return false;
    const c = v.chest, a = JGChest.active();
    if (!c || c.skipped) {
      // A guest's chest stays up with its "Save your stuff" button after its time (they close it),
      // until the next game starts.
      const keep = a && a.guest && !(c && c.skipped) && (v.phase === 'lobby' || (v.state && v.state.phase === 'over'));
      if (a && a.where === 'phone' && !keep) JGChest.close();
      return false;
    }
    if (chestSeen === c.id) return true;
    chestSeen = c.id; jgHold = true;
    JGChest.phone(c, { vip: !!v.vip, haptic, sound: phoneSound, skip: () => hostDo('chestSkip'), save: () => { if (acct) acct.open('save'); },
      onDone: (after, how) => {
        jgHold = false; if (view) goldPill(view);
        // Closed without saving: the usual "Save your stuff" reminder, once.
        if (how && how.guest && !how.saving && acct) setTimeout(() => acct.nudge(document.body, { earned: c.n }), 600);
      } });
    return true;
  }
  const COIN_SVG = '<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="17" r="13" fill="#a8620a"/><circle cx="16" cy="15" r="13" fill="#ffcc33"/><circle cx="16" cy="15" r="9.5" fill="none" stroke="#a8620a" stroke-width="2"/><text x="16" y="20.5" text-anchor="middle" font-family="Fredoka,system-ui,sans-serif" font-weight="900" font-size="14" fill="#a8620a">J</text></svg>';
  // The balance: held while the chest plays, then it ticks up to the new number.
  function goldPill(v) {
    if (!v || !v.me) return;
    let b = $('#h-jg');
    if (!b) {
      b = document.createElement('button'); b.className = 'h-jg'; b.id = 'h-jg'; b.title = 'Your JustGold'; b.innerHTML = COIN_SVG + '<b>0</b><small hidden></small>';
      $('#h-me').after(b);
      b.onclick = () => {
        const vv = view; if (!vv) return;
        if (vv.me.gold == null) { if (acct) acct.open('save'); return; }
        const running = vv.phase === 'show' || (vv.phase === 'game' && !(vv.state && vv.state.phase === 'over'));
        if (running) toast(`🪙 You have ${vv.me.gold} JG. Spend it in the 🛍️ shop between games.`); else location.href = shopUrl();
      };
    }
    const unsaved = v.me.gold == null, target = unsaved ? v.me.pending || 0 : v.me.gold;
    b.classList.toggle('unsaved', unsaved); b.title = unsaved ? 'JustGold you earned: tap to save it' : 'Your JustGold';
    const sm = b.querySelector('small'); sm.hidden = !unsaved; sm.textContent = unsaved ? 'save' : '';
    if (jgHold) return;
    if (jgShown == null || Math.abs(target - jgShown) > 5000) { jgShown = target; b.querySelector('b').textContent = target; return; }
    if (target === jgShown) return;
    const from = jgShown, t0 = performance.now(), dur = Math.min(1400, 500 + Math.abs(target - from) * 8); jgShown = target;
    cancelAnimationFrame(jgRaf); b.classList.add('tick');
    const step = (now) => { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); b.querySelector('b').textContent = Math.round(from + (target - from) * e); if (k < 1) jgRaf = requestAnimationFrame(step); else b.classList.remove('tick'); };
    jgRaf = requestAnimationFrame(step);
    if (target > from) { try { BOX.sfx('coin'); } catch { /* */ } }
  }
  socket.on('disconnect', () => { $('#offline').hidden = false; });
  socket.on('me', (v) => {
    // The room went to a game outside the box (JustMafia): follow it, joined with my name.
    if (v.away && v.away.url && v.away.url.charAt(0) === '/') { if (!socket.leaving) { socket.leaving = true; toast('🔪 Off to JustMafia!'); setTimeout(() => { location.href = v.away.url; }, 500); } return; }
    const view0 = view; view = v; v._at = Date.now();
    if (BOX.setRoster) { if (v.roster) BOX.setRoster(v.roster); if (v.me) BOX.setRoster([{ ...v.me, bot: false }]); } // characters for BOX.face
    if (view0 && v.unlocks && view0.unlocks && v.unlocks.length > view0.unlocks.length) { const k = v.unlocks.find((x) => !view0.unlocks.includes(x)); const g = BOX.games[k]; toast(`🔓 New game unlocked: ${g ? g.icon + ' ' + g.name : k}!`); haptic('win'); }
    if (v.phase !== (view0 && view0.phase) && v.phase === 'show') haptic('big');
    if (v.game !== gameKey) { setGame(v.game); haptic('success'); toast(`${G ? G.icon + ' ' : ''}Next game: ${v.title}!`); vibrate(80); }
    const hn = esc(v.me.name) + (v.me.level && window.JGProgress ? JGProgress.badge(v.me.level) : '') + (v.me.title ? ' · ' + esc(v.me.title) : '');
    if ($('#h-name').dataset.html !== hn) { $('#h-name').innerHTML = hn; $('#h-name').dataset.html = hn; }
    const hav = BOX.portrait ? BOX.portrait.html(v.me, 28) : esc(v.me.avatar || ''); if ($('#h-av').dataset.html !== hav) { $('#h-av').innerHTML = hav; $('#h-av').dataset.html = hav; }
    // The JustGold chest (public/box/chest.js) after a game, and the balance in the header.
    const chestNow = chestPhone(v);
    goldPill(v);
    // JustGold paid at the end of a game (or why it wasn't): the chest shows it; a toast otherwise.
    if (v.jg && v.jg.at && view0 && (!view0.jg || view0.jg.at !== v.jg.at) && !chestNow) {
      if (v.jg.n > 0) { toast(`🪙 +${v.jg.n} JustGold!${v.jg.set ? ` (${v.jg.set.icon} ${v.jg.set.name} set +${v.jg.set.extra})` : ''}${v.jg.total != null ? ` You have ${v.jg.total} JG.` : ''}`); haptic('win'); } else if (v.jg.why) toast(`🪙 ${v.jg.why}`);
    }
    // Gold earned before this phone had an account, saved now (box/room.js claimPending).
    if (v.jgClaim && view0 && (!view0.jgClaim || view0.jgClaim.at !== v.jgClaim.at)) { toast(`💾 Saved! +${v.jgClaim.n} JG are yours now. You have ${v.jgClaim.total} JG.`); haptic('win'); BOX.sfx('saved'); }
    // Progress from that game: XP, finished challenges, level ups (after the JustGold toast, or the chest).
    if (v.prog && v.prog.at && view0 && (!view0.prog || view0.prog.at !== v.prog.at) && window.JGProgress) {
      const lines = JGProgress.news(v.prog).slice(-4); // (the level up comes last: keep it)
      const after = chestNow && v.chest ? (v.chest.left || 0) + 600 : 0;
      lines.forEach((l, i) => setTimeout(() => { toast(l); if (/Level|done/.test(l)) { haptic('win'); BOX.sfx('win'); } }, after + 2800 * (i + (v.jg && v.jg.n && !chestNow ? 1 : 0))));
    }
    // After a game: once, if this phone has unsaved JustGold or stats, offer "Save your stuff".
    // Never before this phone has finished a real game (a practice round doesn't count): then on
    // the game-over screen, with the JustGold just earned.
    const overNow = v.state && v.state.phase === 'over', over0 = view0 && view0.state && view0.state.phase === 'over';
    if (acct && view0 && overNow && !over0 && !v.practice && v.phase === 'game') {
      acct.markPlayed();
      // (a guest's chest has its own "Save your stuff" button: no second prompt over it)
      if (!(v.chest && v.chest.guest)) setTimeout(() => acct.nudge(document.body, { earned: view && view.jg && view.jg.n > 0 && Date.now() - (view._at || 0) < 60000 ? view.jg.n : 0 }), v.chest ? (v.chest.left || 0) + 800 : 3500);
    }
    practiceNews(view0, v);
    if (!tourDone() && !$('#game').hidden && (v.phase === 'lobby' || overNow)) setTimeout(tour, 700);
    shopButtons();
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
    const PM = view.partyMode, PR = view.practice;
    if (PR && view.phase === 'game') {
      // Practice round: everyone sees it doesn't count; the host can skip it.
      const html = `<span class="pr-strip">🎓 <b>Practice round</b> · it doesn’t count</span>${view.vip ? `<button class="btn ${PR.phase === 'over' ? 'green' : 'ghost small'}" data-vip="practiceSkip">${PR.phase === 'over' ? 'Start for real ⏩' : 'Skip practice ⏭'}</button>` : ''}`;
      if (vb.dataset.html !== html) { vb.innerHTML = html; vb.dataset.html = html; for (const b of vb.querySelectorAll('[data-vip]')) b.onclick = () => hostDo(b.dataset.vip); }
      vb.hidden = false;
    } else if (view.vip && PM && over && PM.phase !== 'done') {
      // Party Mode: the lineup carries on by itself; the host can hurry it or hold it. While the
      // game's end screen is up ('ending') the next step is the standings; on the board, the next game.
      const html = PM.phase === 'ending' ? `<span>👑 Party host</span><button class="btn green" data-vip="partyBoardNow">⏩ Standings now</button><button class="btn ghost small" data-vip="partyPause">${PM.paused ? '▶ Resume' : '⏸ Wait'}</button>`
        : `<span>👑 Party host</span><button class="btn green" data-vip="partyNext">⏩ Next game now</button><button class="btn ghost small" data-vip="partyPause">${PM.paused ? '▶ Resume' : '⏸ Wait'}</button>`;
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
    } else if (PM && PM.phase === 'ending' && over) {
      const html = `<span class="pe-strip">🎉 Party standings coming up…${PM.paused ? ' (the host is holding them)' : ''}</span>`;
      if (vb.dataset.html !== html) { vb.innerHTML = html; vb.dataset.html = html; }
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
    if (view.recap && BOX.recapCard && !recapSeen[view.recap.id]) { recapPhone(view.recap); return; }
    if (view.phase === 'show' && view.show) { showPhone(view.show); return; }
    if (view.practice && view.practice.phase === 'over' && view.phase === 'game') { practiceOverPhone(view.practice); return; }
    if (view.partyMode && (view.partyMode.phase === 'board' || view.partyMode.phase === 'done')) { partyPhone(view); return; }
    if (view.phase === 'lobby' && view.live && view.state) { G.phone($('#g-body'), view.state, ctx, view); return; }
    if (view.phase === 'lobby') {
      BOX.morph($('#g-body'), `<div class="card-box ph-lobby"><div class="big-av">${view.me.look && BOX.portrait ? BOX.portrait.html(view.me, 88) : esc(view.me.avatar || '🙂')}</div><h3>You’re in! 🎉</h3><p>${view.vip ? 'You’re the host! Press <b>Start game</b> when everyone is in.' : `Waiting for ${view.vipName ? '<b>' + esc(view.vipName) + '</b> (the host)' : 'the host'} to start <b>${esc(view.title)}</b>.`}</p><p class="muted">${view.count} player${view.count === 1 ? '' : 's'} so far. Watch the big screen.</p><div class="lob-acts"><button class="btn ghost small" id="lob-how">❓ How to play ${esc(G.name)}</button><a class="btn ghost small" id="lob-shop" href="${esc(shopUrl())}">🛍️ ${view.me.look ? 'Shop & character' : 'Make your character'}</a></div></div>${G.lobby ? G.lobby(view, ctx) : ''}`);
      const lh = $('#lob-how'); if (lh) lh.onclick = () => $('#h-help').click();
      if (G.lobbyBind) G.lobbyBind($('#g-body'), view, ctx);
      return;
    }
    G.phone($('#g-body'), view.state, ctx, view);
  }
  // ---------- the night recap: my card, with a picture to save ----------
  const recapSeen = {};
  function recapPhone(c) {
    BOX.morph($('#g-body'), BOX.recapCard(c, view.me) + '<button class="btn ghost small rc-back" id="rc-back">Back to the game</button>');
    const sv = $('#rc-save'); if (sv) sv.onclick = () => { try { BOX.saveImage(BOX.recapCardImage(c, view.me), 'my-justgamebox-night.png'); haptic('success'); } catch (e) { toast('Could not make the picture.'); } };
    const bk = $('#rc-back'); if (bk) bk.onclick = () => { recapSeen[c.id] = true; ctx.redraw(); };
    if (recapPhone.last !== c.id) { recapPhone.last = c.id; haptic('win'); }
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
      <p class="muted">${done ? `${P.played} games played tonight. What a party! 🎉` : nx ? `Up next: <b>${nx.icon} ${esc(nx.name)}</b>${PM.paused ? ' (the host is holding it)' : ` in ${BOX.timer(PM.in)}`}${PM.upNext && PM.upNext.summary && PM.upNext.summary.length ? `<br><small>${esc(PM.upNext.summary.join(' · '))}</small>` : ''}${PM.intros === 'break' ? '<br><small>🍿 Its intro is on the big screen</small>' : ''}` : ''}</p></div>`);
    if (!partyPhone.seen || partyPhone.seen !== PM.phase + PM.index) { partyPhone.seen = PM.phase + PM.index; haptic(done && P.rank === 1 ? 'win' : 'success'); }
  }
  // ---------- game-show opening: you're a contestant! ----------
  const STARTERS = ['My secret talent is…', 'I’m weirdly scared of…', 'I once got lost in…', 'My most useless skill:', 'I could eat ___ every day', 'Nobody knows I…'];
  let factDraft = '', factEdit = false;
  // The tutorial steps live in the game's intro file: load it on the phone too.
  const introLoaded = new Set();
  function loadIntro(key) {
    if (!key || introLoaded.has(key) || (BOX.intros && BOX.intros[key])) return;
    introLoaded.add(key); const sc = document.createElement('script'); sc.src = `/box/intros/${key}.js`; sc.onload = () => ctx.redraw(); document.head.appendChild(sc);
  }
  function howtoPhone(sh) {
    const body = $('#g-body');
    loadIntro(sh.game);
    try { const I = BOX.intros && BOX.intros[sh.game]; if (I && I.onShow) I.onShow(sh); } catch { /* the default steps */ } // e.g. YesChef: the kitchen's own steps
    const steps = BOX.howtoSteps ? BOX.howtoSteps(sh.game) : [];
    const { i, done } = BOX.howtoStepAt ? BOX.howtoStepAt(sh, steps, view._at) : { i: 0, done: false };
    const s = steps[i] || {};
    BOX.morph(body, `<div class="card-box ph-ht">
      <div class="muted small">HOW TO PLAY · step ${Math.min(i + 1, steps.length)} of ${steps.length}</div>
      ${done ? '<div class="ph-ht-icon">🎮</div><h3>That’s it. Let’s play!</h3>' : `<div class="ph-ht-icon">${esc(s.icon || '👉')}</div><h3>${esc(s.title || '')}</h3><p class="ph-ht-text">${esc(s.text || '')}</p>${s.phone ? `<div class="ph-ht-do">📱 ${esc(s.phone)}</div>` : ''}`}
      <div class="ph-ht-dots">${steps.map((_, k) => `<i class="${k <= i ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn big ${sh.gotIt ? 'ghost' : 'green'}" id="ht-got" ${sh.gotIt ? 'disabled' : ''}>${sh.gotIt ? '✓ Got it! Waiting for the others…' : '✓ Got it'}</button>
      <p class="muted small">When everyone taps Got it, the game starts.</p></div>`);
    const gb = $('#ht-got'); if (gb) gb.onclick = async () => { const r = await act({ op: 'gotit' }); if (r.ok) { haptic('success'); ctx.redraw(); } };
    if (howtoPhone.last !== i) { howtoPhone.last = i; if (!done) haptic('tap'); }
  }
  function showPhone(sh) {
    const body = $('#g-body');
    if (sh.step === 'howto') return howtoPhone(sh);
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
      <h3>${now ? 'That’s you on the TV! Wave! 👋' : sh.mode !== 'facts' ? 'Get ready: ' + esc(sh.title) + ' is starting!' : 'Meet the contestants!'}</h3>
      ${sh.myFact ? `<p class="sh-fact">“${esc(sh.myFact)}”</p>` : ''}
      <p class="muted">${sh.mode === 'card' ? (sh.info && sh.info.summary && sh.info.summary.length ? esc(sh.info.summary.join(' · ')) + '. ' : '') + 'Tap ❓ any time for how to play.' : sh.mode === 'cast' ? 'Watch the big screen for the intro.' : sh.featured ? (left > 0 ? 'The host will introduce you in a moment…' : 'You’ve been introduced!') : 'Watch the big screen. The game starts in a moment.'}</p></div>`);
    if (now && !showPhone.buzzed) { showPhone.buzzed = true; vibrate([60, 40, 60]); }
    if (!now) showPhone.buzzed = false;
  }
  // ---------- practice round: tips from the game's how-to steps at the right moments ----------
  // A tip pops up when the game moves to a new phase (a new thing to do), or after a quiet spell;
  // the steps are the intro's tutorial (BOX.howtoSteps), the same ones the how-to showed.
  const hint = { i: 0, phase: null, at: 0, on: false, timer: 0 };
  function practiceNews(v0, v) {
    const P = v.practice;
    if (!P || v.phase !== 'game' || P.phase !== 'playing') {
      if (P && P.phase === 'over' && !(v0 && v0.practice && v0.practice.phase === 'over')) { hideHint(); haptic('big'); BOX.sfx('win'); }
      if (!P) { hideHint(); hint.on = false; }
      return;
    }
    loadIntro(v.game);
    if (!hint.on) { hint.on = true; hint.i = 0; hint.phase = null; hint.at = 0; }
    const ph = v.state && typeof v.state.phase === 'string' ? v.state.phase : '';
    if (ph !== hint.phase && Date.now() - hint.at > 6000) { hint.phase = ph; showHint(); }
  }
  setInterval(() => { if (view && view.practice && view.practice.phase === 'playing' && hint.on && Date.now() - hint.at > 16000) showHint(); }, 2000);
  function hideHint() { const h = $('#pr-hint'); if (h) { h.classList.add('out'); h.id = ''; setTimeout(() => h.remove(), 300); } clearTimeout(hint.timer); }
  function showHint() {
    const steps = BOX.howtoSteps && gameKey ? BOX.howtoSteps(gameKey) : [];
    if (!steps.length || hint.i > steps.length) return;
    hint.at = Date.now();
    const last = hint.i === steps.length, s = last ? { icon: '👍', title: 'You’ve got it!', text: 'Keep going: the real game starts after this warm-up.' } : steps[hint.i];
    hint.i++;
    hideHint();
    const h = document.createElement('div'); h.id = 'pr-hint'; h.className = 'pr-hint'; h.setAttribute('role', 'status');
    h.innerHTML = `<span class="prh-i">${esc(s.icon || '💡')}</span><div class="prh-t"><small>🎓 PRACTICE TIP${last ? '' : ` ${hint.i} of ${steps.length}`}</small><b>${esc(s.title || '')}</b><span>${esc(s.text || '')}</span>${s.phone ? `<em>📱 ${esc(s.phone)}</em>` : ''}</div><button class="prh-x" aria-label="Got it">Got it</button>`;
    document.body.appendChild(h);
    h.querySelector('.prh-x').onclick = () => { haptic('select'); hideHint(); };
    haptic('tap');
    hint.timer = setTimeout(hideHint, 9000);
  }
  function practiceOverPhone(P) {
    BOX.morph($('#g-body'), `<div class="card-box pr-ph-over"><div class="pr-ph-icon">🎬</div><small>${P.why === 'time' ? 'WARM-UP TIME IS UP' : 'PRACTICE OVER'}</small><h3>Now for real!</h3><p>Same game, fresh scores. This one counts.</p><p class="muted small">Starting in ${BOX.timer(P.endsIn || 0)}</p></div>`);
  }

  // ---------- the first time a phone joins: what the buttons in the header do (~20 s) ----------
  const TOUR_KEY = 'box.tour';
  const tourDone = () => { try { return localStorage.getItem(TOUR_KEY) === '1' || params.has('notour'); } catch { return true; } };
  let touring = false;
  function tour() {
    if (touring || tourDone() || !view || $('#game').hidden) return;
    touring = true;
    const steps = [
      ['#h-me', '👤', 'This is you', 'Tap here to change your avatar, phone sounds and vibration, or to leave the game.'],
      ['#h-react', '😀', 'React', 'Send an emoji. It floats up on the big screen with your name.'],
      ['#h-shop', '🛍️', 'Character & shop', 'Dress up your character and spend JustGold between games.'],
      ['#h-jg', '🪙', 'Your JustGold', 'Every game you finish opens a chest of JustGold. Your balance is here: spend it in the shop between games.'],
      ['#h-prof', '🏆', 'Your profile', 'Your stats, trophies and titles, across every game.'],
      ['#h-help', '❓', 'How to play', 'The rules of the game you’re in, any time.'],
      ['#h-menu', '👑', 'You’re the host', 'You start the game. Skip ahead, add bots or pick the next game here.'],
      [null, '📺', 'Eyes on the big screen', 'The game happens on the TV. Your phone is your controller. Have fun!'],
    ].filter((s) => !s[0] || ($(s[0]) && !$(s[0]).hidden));
    const o = document.createElement('div'); o.className = 'ph-tour'; o.id = 'ph-tour';
    o.innerHTML = '<div class="pt-ring"></div><div class="pt-card"><span class="pt-i"></span><b class="pt-h"></b><p class="pt-p"></p><div class="pt-foot"><span class="pt-dots"></span><button class="pt-skip">Skip</button><button class="pt-next">Next ▶</button></div></div>';
    document.body.appendChild(o);
    let i = -1, t = 0;
    const end = () => { clearTimeout(t); try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* private */ } o.classList.add('out'); setTimeout(() => o.remove(), 300); touring = false; };
    const go = () => {
      clearTimeout(t); i++;
      if (i >= steps.length || !document.body.contains(o)) return end();
      const [sel, icon, title, text] = steps[i], el = sel && $(sel), ring = o.querySelector('.pt-ring'), card = o.querySelector('.pt-card');
      if (el) { const r = el.getBoundingClientRect(), pad = 6; Object.assign(ring.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' }); ring.hidden = false; card.style.top = Math.min(innerHeight - 220, r.bottom + 18) + 'px'; card.classList.remove('mid'); }
      else { ring.hidden = true; card.style.top = ''; card.classList.add('mid'); }
      o.querySelector('.pt-i').textContent = icon; o.querySelector('.pt-h').textContent = title; o.querySelector('.pt-p').textContent = text;
      o.querySelector('.pt-dots').innerHTML = steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
      o.querySelector('.pt-next').textContent = i === steps.length - 1 ? 'Let’s play!' : 'Next ▶';
      card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
      haptic('tap');
      t = setTimeout(go, i === steps.length - 1 ? 3600 : 2900);
    };
    o.querySelector('.pt-skip').onclick = (e) => { e.stopPropagation(); end(); };
    o.querySelector('.pt-next').onclick = (e) => { e.stopPropagation(); go(); };
    o.onclick = () => go();
    go();
  }
  window.BOX_TOUR = { start: () => { try { localStorage.removeItem(TOUR_KEY); } catch { /* private */ } tour(); } };

  setInterval(() => { if (view && view.phase === 'show') queue(); }, 500); // intros run on the clock
  ctx.redraw = () => { lastRender = 0; draw(); };
})();
