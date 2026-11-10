// Big-screen controller: connects to the server, feeds the Town renderer,
// shows the HUD/narration, and provides host controls.
(function () {
  const $ = (s) => document.querySelector(s);
  const RR = window.MT_ROLES;
  const ROLES = RR.ROLES;
  const socket = io();
  const town = new window.Town($('#town'));

  let state = null;
  let clockOffset = 0;
  let baseUrl = location.origin;
  let lastNarrationId = 0;
  let lastCineId = 0;
  let lastGlitchUntil = 0;
  let lastTickSecond = null;
  let qrFor = null;

  const PHASES = {
    accusation:'The accusation', defense:'The defense', emergencyIntro:'Emergency town vote',
    lobby: 'Waiting for players',
    roleReveal: 'Check your phones!',
    night: 'Night {d}',
    dawn: 'Night {d}',
    morning: 'Day {d}',
    discussion: 'Day {d} · Discussion',
    voting: 'Day {d} · Voting',
    verdict: 'Day {d} · The Verdict',
    execution: 'Day {d} · The Verdict',
    gameover: 'Game over',
  };

  // ---------- prefs & session ----------
  const prefs = (() => {
    try { return Object.assign({ voice: true, sfx: true }, JSON.parse(localStorage.getItem('mt.hostPrefs') || '{}')); } catch { return { voice: true, sfx: true }; }
  })();
  const savePrefs = () => { try { localStorage.setItem('mt.hostPrefs', JSON.stringify(prefs)); } catch { /* ignore */ } };
  const getSession = () => { try { return JSON.parse(localStorage.getItem('mt.host') || 'null'); } catch { return null; } };
  const setSession = (s) => { try { localStorage.setItem('mt.host', JSON.stringify(s)); } catch { /* ignore */ } };
  SFX.enabled = prefs.sfx;

  fetch('/api/info').then((r) => r.json()).then((info) => { baseUrl = info.baseUrl; renderLobby(); }).catch(() => {});

  // ---------- connection ----------
  socket.on('connect', () => {
    const s = getSession();
    if (s) socket.emit('host:resume', s, (r) => (r && r.ok ? enterGame() : showTitle()));
    else showTitle();
  });

  socket.on('host:state', (st) => {
    clockOffset = st.serverNow - Date.now();
    if (document.documentElement.dataset.theme !== st.theme) document.documentElement.dataset.theme = st.theme || ''; // themed menus (CSS)
    const phaseChanged = !state || state.phase !== st.phase;
    state = st;
    if (st.narratorMode === 'human') { speakToken++; if (window.speechSynthesis) speechSynthesis.cancel(); }
    const g = st.governance;
    $('#judge-announcement').hidden = !(g && g.announcement);
    $('#judge-announcement').textContent = g && g.announcement || '';
    const p = st.presentation || {};
    if (p.glitchUntil && p.glitchUntil !== lastGlitchUntil) SFX.play('glitch');
    lastGlitchUntil = p.glitchUntil || 0;
    $('#hud-harmony').hidden = !((st.composition || {}).conductor);
    $('#hud-harmony').textContent = `Harmony: ${p.harmony || 0} objectives · ${p.harmonyGoal || 2} per blessing`;
    $('#go-town').textContent = st.townName;
    town.applyState(st);
    if (st.cinematic && st.cinematic.id !== lastCineId) {
      lastCineId = st.cinematic.id;
      town.playCinematic(st.cinematic);
    }
    if (st.narration && st.narration.id !== lastNarrationId) {
      lastNarrationId = st.narration.id;
      showNarration(st.narration);
    }
    if (st.phase === 'lobby' || (st.narratorMode === 'human' && !(st.narration && st.narration.custom))) { if (st.phase === 'lobby') lastNarrationId = 0; if (!st.narration) $('#narration').hidden = true; }
    if (phaseChanged) lastTickSecond = null;
    renderHud();
    renderLobby();
    renderGameOver();
    renderDrawer();
  });

  socket.on('host:haunt', (evt) => town.haunt(evt));

  // Judge scene controls (presentation only).
  const houseOfPlayer = (house) => (house == null ? undefined : house);
  socket.on('host:scene', (m) => {
    if (!town.cinema) return;
    const owner = m.house != null ? town.ownerOf(m.house) : null;
    town.cinema.play(m.scene, { house: houseOfPlayer(m.house), victimId: owner ? owner.id : undefined, outcome: m.outcome, title: m.scene === 'introduction' ? state.townName : m.title || 'The End', mood: 'triumph' }, { manual: true });
  });
  socket.on('host:camera', (m) => {
    if (town.cinema && town.cinema.active) return; // a scene is driving the camera
    if (m.spot) town.focusSpot(m.spot, 1.6);
    else town.focusHouse(m.house, 1.6, m.zoom);
  });
  socket.on('host:music', (m) => { if (town.cinema) town.cinema.judgeMood = m.mood; SFX.music(m.mood, town.cinema ? town.cinema.kit().root : 110, town.themeId); });
  socket.on('host:stop', () => { if (town.cinema) town.cinema.stop(); town.focusSpot('overview', 1.2); });
  socket.on('host:narration', (m) => { if (m.skip) { speakToken++; if (window.speechSynthesis) speechSynthesis.cancel(); $('#narration').hidden = true; } });

  function showTitle() {
    $('#title').hidden = false;
    $('#hud').hidden = true;
    $('#lobby').hidden = true;
  }

  function enterGame() {
    $('#title').hidden = true;
    $('#hud').hidden = false;
  }

  $('#create').addEventListener('click', () => {
    SFX.unlock();
    socket.emit('host:create', {}, (r) => {
      if (!r || !r.ok) return toast('Could not create a room.');
      setSession({ code: r.code, hostKey: r.hostKey });
      enterGame();
    });
  });

  // Browsers need a user gesture before audio can play.
  window.addEventListener('pointerdown', () => SFX.unlock(), { once: true });

  function act(type, extra = {}) {
    if (displayOnly()) return toast('Use the selected Judge’s private console to control this game.');
    socket.emit('host:action', { type, ...extra }, (r) => { if (r && r.ok === false && r.error) toast(r.error); });
  }

  // ---------- narration ----------
  function showNarration(n) {
    const box = $('#narration');
    const el = $('#narration-text');
    box.hidden = false;
    el.textContent = n.text;
    el.classList.remove('enter');
    void el.offsetWidth;
    el.classList.add('enter');
    speak(n.text);
  }

  let voice = null;
  function pickVoice() {
    const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    voice = vs.find((v) => /en-GB/i.test(v.lang) && /male|daniel|george|ryan/i.test(v.name))
      || vs.find((v) => /en-(US|GB)/i.test(v.lang) && /natural|google/i.test(v.name))
      || vs.find((v) => /^en/i.test(v.lang)) || null;
  }
  if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

  // Spoken sentence by sentence, with a dramatic pause between them.
  let speakToken = 0;
  function speak(text) {
    if (state && state.narratorMode === 'human') return;
    if (!prefs.voice || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const token = ++speakToken;
    const style = state && state.settings.narratorStyle;
    const parts = String(text).match(/[^.!?…]+[.!?…]*\s*/g) || [text];
    const next = (i) => {
      if (token !== speakToken || i >= parts.length) return;
      const u = new SpeechSynthesisUtterance(parts[i].trim());
      if (voice) u.voice = voice;
      u.rate = style === 'comedy' ? 1.05 : 0.92;
      u.pitch = style === 'classic' ? 0.85 : 1;
      u.onend = () => setTimeout(() => next(i + 1), /[.…]$/.test(parts[i].trim()) ? 650 : 350);
      speechSynthesis.speak(u);
    };
    next(0);
  }

  // ---------- HUD ----------
  function remainingMs() {
    if (!state) return null;
    if (state.paused) return state.remainingMs;
    if (!state.endsAt) return null;
    return Math.max(0, state.endsAt - (Date.now() + clockOffset));
  }

  function renderHud() {
    if (!state) return;
    $('#hud-town').textContent = state.townName;
    $('#hud-phase').textContent = (PHASES[state.phase] || state.phase).replace('{d}', state.day);
    const active = state.players.filter((p) => !p.spectator);
    const alive = active.filter((p) => p.alive && !p.left).length;
    const dead = active.length - alive;
    $('#hud-counts').textContent = state.phase === 'lobby' ? `👥 ${active.length}` : `🧍 ${alive} alive${dead ? ` · 👻 ${dead}` : ''}`;

    const comp = state.composition;
    const showComp = comp && state.phase !== 'lobby';
    $('#composition').hidden = !showComp;
    if (showComp) {
      $('#composition').textContent = RR.ROLE_ORDER.filter((r) => comp[r])
        .map((r) => `${ROLES[r].emoji} ${comp[r] > 1 || ['mafia', 'villager'].includes(r) ? comp[r] + ' ' : ''}${MT_THEMES.roleName(state.theme, r, ROLES[r].name)}${comp[r] > 1 && r !== 'mafia' && !(MT_THEMES.THEMES[state.theme] || {}).roleNames ? 's' : ''}`)
        .join('  ·  ');
    }
    $('#btn-pause').textContent = state.paused ? '▶ Resume' : '⏸ Pause';
    updateTimer();
  }

  function updateTimer() {
    const el = $('#hud-timer');
    if (!state) return;
    const timed = ['night', 'discussion', 'voting', 'accusation', 'defense', 'emergencyIntro'].includes(state.phase);
    if (state.paused) { el.hidden = false; el.textContent = '⏸ Paused'; el.classList.remove('urgent'); return; }
    const ms = remainingMs();
    if (!timed || ms == null) {
      el.hidden = !(timed && !state.settings.autoAdvance && state.phase !== 'night');
      if (!el.hidden) { el.textContent = state.phase === 'voting' ? 'Voting open' : 'Judge: press N'; el.classList.remove('urgent'); }
      return;
    }
    const s = Math.ceil(ms / 1000);
    el.hidden = false;
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    const urgent = s <= 10 && state.phase !== 'night';
    el.classList.toggle('urgent', urgent);
    if (urgent && s > 0 && s !== lastTickSecond) { lastTickSecond = s; SFX.play('tick'); }
  }
  setInterval(updateTimer, 200);

  // ---------- lobby ----------
  function joinUrl() {
    const base = (state && state.joinBase) || baseUrl;
    return `${base}/play?room=${state ? state.code : ''}`;
  }

  function renderLobby() {
    if (!state) return;
    const show = state.phase === 'lobby';
    $('#lobby').hidden = !show;
    if (!show) return;
    const url = joinUrl();
    if (qrFor !== url) { qrFor = url; $('#qr').src = `/api/qr?text=${encodeURIComponent(url)}`; }
    $('#room-code').textContent = state.code;
    $('#join-url').textContent = url.replace(/^https?:\/\//, '');
    const n = state.players.filter((p) => !p.spectator && !p.left).length;
    const need = state.minPlayers - n;
    $('#lobby-count').textContent = need > 0 ? `${n} joined · need ${need} more` : `${n} player${n === 1 ? '' : 's'} ready`;
    $('#lobby-start').disabled = displayOnly() || need > 0 || !!state.setupError;
    $('#lobby-bots').disabled = displayOnly();
    $('#lobby-error').textContent = need > 0 ? '' : state.setupError || '';
  }

  $('#lobby-start').addEventListener('click', () => { SFX.unlock(); act('start'); });
  $('#lobby-bots').addEventListener('click', () => act('addBots', { count: 5 }));

  // ---------- game over ----------
  function renderGameOver() {
    const show = state.phase === 'gameover' && state.winner;
    $('#gameover').hidden = !show;
    if (!show) return;
    const t = $('#go-title');
    const W = RR.WINNERS[state.winner] || RR.WINNERS.draw;
    const themedTeam = state.winner === 'mafia' ? MT_THEMES.teamName(state.theme, 'mafia', W.name) : W.name;
    t.textContent = state.winner === 'draw' ? '🤝 A Draw!' : `${W.emoji} ${themedTeam} ${state.winner === 'mafia' && themedTeam === W.name ? 'Win' : 'Wins'}!`;
    t.className = state.winner === 'town' ? 'town' : 'mafia';
    const evil = state.players.filter((p) => p.role && ROLES[p.role] && ROLES[p.role].team !== 'town')
      .map((p) => `${ROLES[p.role].emoji} ${p.name}${MT_THEMES.THEMES[state.theme] && MT_THEMES.THEMES[state.theme].roleNames ? ` (${MT_THEMES.roleName(state.theme, p.role, ROLES[p.role].name)})` : ''}`);
    $('#go-sub').textContent = evil.length ? `Not on the town's side: ${evil.join(', ')}` : '';
  }
  $('#go-again').addEventListener('click', () => act('lobby'));

  // ---------- drawer ----------
  const drawer = $('#drawer');
  const toggleDrawer = (open) => { drawer.classList.toggle('closed', open === undefined ? !drawer.classList.contains('closed') : !open); renderDrawer(); };
  $('#gear').addEventListener('click', () => toggleDrawer());
  $('#drawer-close').addEventListener('click', () => toggleDrawer(false));

  drawer.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
    const a = b.dataset.act;
    if (a === 'lobby' && state && !['lobby', 'gameover'].includes(state.phase) && !confirmInline(b)) return;
    act(a, a === 'extend' ? { seconds: 30 } : {});
  }));
  $('#judge-open').addEventListener('click', () => window.open('/judge', 'mafia-judge'));
  $('#judge-qr-btn').addEventListener('click', (e) => {
    const img = $('#judge-qr');
    if (!img.hidden) { img.hidden = true; e.target.textContent = 'Phone QR'; return; }
    if (!e.target.dataset.armed) { e.target.dataset.armed = '1'; e.target.textContent = 'Secret! Click again'; setTimeout(() => { delete e.target.dataset.armed; if (img.hidden) e.target.textContent = 'Phone QR'; }, 3000); return; }
    delete e.target.dataset.armed;
    const s = getSession();
    if (!s) return;
    const base = (state && state.joinBase) || baseUrl;
    img.src = `/api/qr?text=${encodeURIComponent(`${base}/judge#${s.code}.${s.hostKey}`)}`;
    img.hidden = false;
    e.target.textContent = 'Hide QR';
  });
  $('#btn-pause').addEventListener('click', () => act(state && state.paused ? 'resume' : 'pause'));
  $('#btn-full').addEventListener('click', toggleFullscreen);

  // Two-click confirm without using blocking browser dialogs.
  function confirmInline(btn) {
    if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = '⟲ Back to lobby'; return true; }
    btn.dataset.armed = '1';
    btn.textContent = 'Click again to end game';
    setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = '⟲ Back to lobby'; } }, 3000);
    return false;
  }


  $('#pref-voice').checked = prefs.voice;
  $('#pref-sfx').checked = prefs.sfx;
  $('#pref-voice').addEventListener('change', (e) => { prefs.voice = e.target.checked; savePrefs(); if (!prefs.voice && window.speechSynthesis) speechSynthesis.cancel(); });
  $('#pref-sfx').addEventListener('change', (e) => { prefs.sfx = e.target.checked; SFX.enabled = prefs.sfx; savePrefs(); });
  $('#join-base').addEventListener('change', (e) => act('joinBase', { url: e.target.value }));

  function renderDrawer() {
    if (!state || drawer.classList.contains('closed')) return;
    const jb = $('#join-base');
    if (document.activeElement !== jb) { jb.value = state.joinBase || ''; jb.placeholder = baseUrl; }
    const lobby = state.phase === 'lobby';
    const managed = displayOnly();
    drawer.querySelectorAll('[data-act]').forEach((b) => { b.disabled = managed; });
    $('#btn-pause').disabled = managed; $('#judge-open').disabled = managed; $('#judge-qr-btn').disabled = managed; jb.disabled = managed;
    if (managed) $('#judge-qr').hidden = true;
    drawer.querySelector('[data-act="start"]').disabled = managed || !lobby;
    drawer.querySelector('[data-act="openVoting"]').disabled = managed || state.phase !== 'discussion';
    drawer.querySelector('[data-act="closeVoting"]').disabled = managed || state.phase !== 'voting';

    $('#drawer-count').textContent = `(${state.players.length})`;
    const ul = $('#player-list');
    ul.innerHTML = '';
    for (const p of state.players) {
      const li = document.createElement('li');
      const status = p.left ? 'left' : p.spectator ? 'next round' : !p.alive ? 'ghost' : p.isBot ? 'bot' : '';
      li.innerHTML = `<span class="dot ${p.connected ? '' : 'off'}"></span><span class="nm"></span><span class="tag">${status}</span>${p.left ? '' : '<button>Remove</button>'}`;
      li.querySelector('.nm').textContent = p.name;
      const btn = li.querySelector('button');
      if (btn) btn.disabled = managed;
      if (btn) btn.addEventListener('click', () => act('kick', { id: p.id }));
      ul.appendChild(li);
    }
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  function displayOnly() { return !!(state && state.governance && (state.governance.judgeId || state.governance.vacant)); }

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (!state) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); act(state.paused ? 'resume' : 'pause'); }
    else if (k === 'n') act('skip');
    else if (k === 'h') toggleDrawer();
    else if (k === 'f') toggleFullscreen();
  });

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
  }
})();
