// Big-screen controller: connects to the server, feeds the Town renderer,
// shows the HUD/narration, and provides host controls.
(function () {
  const $ = (s) => document.querySelector(s);
  const RR = window.MT_ROLES;
  const ROLES = RR.ROLES;
  const socket = io();
  const town = new window.Town($('#town'));
  if (/[?&]debug\b/.test(location.search)) window.__town = town; // tests/inspection only

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
    draft: 'Choosing the roles',
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
    draftTv.render(st); // the role draft overlay (deck, card vote, deal)
    renderUnlock(st);
    renderCredits(st);
  });

  // Game over → "You just unlocked!" (after the victory celebration). One card at a time:
  // it floats up face down, flips to show the new role, then flies into the deck, which
  // counts up. Every new card then lines up below, and Play again lights up.
  // The new roles join the deck from the next game. Shown once per unlock.
  const VICTORY_MS = 11000; // the victory scenes run ~9.5–10.6 s
  let unlockShown = 0, unlockTimers = [];
  const later = (ms, fn) => unlockTimers.push(setTimeout(fn, ms));
  function renderUnlock(st) {
    const u = st.unlock, box = $('#unlock');
    if (!u || st.phase !== 'gameover') { box.hidden = true; return; }
    if (unlockShown === u.id) return;
    unlockShown = u.id;
    unlockTimers.forEach(clearTimeout); unlockTimers = [];
    later(VICTORY_MS, () => {
      if (!state || state.phase !== 'gameover') return;
      const roles = u.roles, beat = roles.length > 8 ? 1700 : roles.length > 4 ? 2100 : 2600; // big jumps go a bit quicker; each card is readable for ≥1 s
      $('#unlock-sub').textContent = `Tier ${u.tier} of ${u.maxTier} · ${roles.length} new role${roles.length === 1 ? '' : 's'} for your deck`;
      $('#unlock-name').textContent = '';
      const spot = $('#unlock-spot'), deck = $('#unlock-deck'), list = $('#unlock-cards'), count = $('#unlock-count');
      spot.innerHTML = ''; list.innerHTML = '';
      list.style.setProperty('--cw', `min(130px, ${Math.floor(88 / Math.max(5, roles.length))}vw)`);
      let n = u.deckBefore || 0; count.textContent = n;
      $('#unlock-actions').classList.remove('ready');
      box.classList.remove('done'); box.hidden = false; SFX.play('saved');
      roles.forEach((k, i) => {
        const t0 = 900 + i * beat;
        later(t0, () => { // float up, face down
          spot.innerHTML = '';
          const c = MT_DRAFT.cardEl(k, st.theme, { full: false }); c.classList.add('unlock-card'); spot.appendChild(c);
        });
        later(t0 + 450, () => { // flip
          const c = spot.querySelector('.dcard'); if (!c) return;
          c.classList.add('up'); SFX.play('flip');
          $('#unlock-name').textContent = `${(ROLES[k] || {}).emoji || ''} ${MT_THEMES.roleName(st.theme, k, (ROLES[k] || {}).name || k)}`;
        });
        later(t0 + beat - 500, () => { // into the deck
          const c = spot.querySelector('.dcard'); if (!c) return;
          c.classList.add('to-deck');
          deck.classList.remove('bump'); void deck.offsetWidth; deck.classList.add('bump');
          count.textContent = ++n;
          const mini = MT_DRAFT.cardEl(k, st.theme, { full: false, up: true }); mini.classList.add('unlock-mini'); list.appendChild(mini);
        });
      });
      later(900 + roles.length * beat, () => { // all in: Play again
        spot.innerHTML = ''; $('#unlock-name').textContent = 'They’re in the deck. Ready for the next game?';
        box.classList.add('done'); $('#unlock-actions').classList.add('ready'); SFX.play('saved');
      });
    });
  }
  $('#unlock-again').addEventListener('click', () => { $('#unlock').hidden = true; act('lobby'); });
  $('#unlock-close').addEventListener('click', () => { $('#unlock').hidden = true; });
  const draftTv = MT_DRAFT.TV($('#draft'));

  // ---------- game over: highlight replays, then the movie credits ----------
  // Starts once per game, after the victory scene (and the unlock reveal, if any).
  let creditsFor = null, creditsTimer = null, replaying = false;
  function renderCredits(st) {
    if (st.phase !== 'gameover' || !st.credits) { if (st.phase !== 'gameover') { $('#credits').hidden = true; $('#replay-banner').hidden = true; creditsFor = null; clearTimeout(creditsTimer); } return; }
    const key = st.credits.title + st.credits.cast.map((c) => c.id).join();
    if (creditsFor === key) return;
    creditsFor = key; clearTimeout(creditsTimer);
    const roles = st.unlock ? st.unlock.roles.length : 0, beat = roles > 8 ? 1700 : roles > 4 ? 2100 : 2600;
    const delay = VICTORY_MS + (roles ? 900 + roles * beat + 5000 : 1500);
    creditsTimer = setTimeout(() => playHighlights(st.credits), delay);
  }
  function playHighlights(cr) {
    if (!state || state.phase !== 'gameover') return;
    $('#unlock').hidden = true;
    const list = (cr.highlights || []).filter((h) => town.chars.get(h.targetId));
    const next = (i) => {
      if (!state || state.phase !== 'gameover') return;
      if (i >= list.length || !town.cinema) { $('#replay-banner').hidden = true; replaying = false; rollCredits(cr); return; }
      const h = list[i]; replaying = true; renderGameOver();
      $('#replay-title').textContent = h.title; $('#replay-banner').hidden = false;
      town.cinema.play('murder', { victimId: h.targetId, outcome: h.type === 'saved' ? 'protected' : 'kill' }, {});
      const wait = () => { if (town.cinema && town.cinema.active) setTimeout(wait, 400); else next(i + 1); };
      setTimeout(wait, 1500);
    };
    next(0);
  }
  function rollCredits(cr) {
    if (!state || state.phase !== 'gameover') return;
    const esc2 = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const roll = $('#cr-roll');
    roll.innerHTML = `<p class="cr-pre">${esc2(cr.town)} presents</p><h1 class="cr-title">${esc2(cr.title)}</h1>
      <h2>The Cast</h2><div class="cr-cast">${cr.cast.map((c) => `<div class="cr-actor team-${c.team}${c.alive ? '' : ' fallen'}"><canvas data-cr-av="${esc2(c.id)}" width="120" height="150"></canvas><div><b>${esc2(c.name)}</b><span class="cr-role">as the ${esc2(c.roleName)}</span><span class="cr-fate">${c.alive ? '✓ ' : '✝ '}${esc2(c.fate)}</span></div></div>`).join('')}</div>
      ${cr.awards.length ? `<h2>Awards</h2><div class="cr-awards">${cr.awards.map((a) => `<div class="cr-award"><span class="cr-trophy">${a.emoji}</span><b>${esc2(a.label)}</b><span>${esc2(a.name)}</span><small>${esc2(a.detail)}</small></div>`).join('')}</div>` : ''}
      <h2>By the numbers</h2><ul class="cr-stats">${cr.stats.map((s) => `<li>${esc2(s)}</li>`).join('')}</ul>
      <p class="cr-end">Thanks for playing</p>`;
    roll.querySelectorAll('[data-cr-av]').forEach((cv) => {
      const c = cr.cast.find((x) => x.id === cv.dataset.crAv); if (!c) return;
      const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
      MTArt.drawCharacter(g, 60, 140, c.avatar, { scale: 1.6, t: 0, theme: state.theme, expression: c.alive ? undefined : 'sad' });
    });
    $('#credits').hidden = false; renderGameOver();
    roll.style.animation = 'none'; void roll.offsetHeight;
    const secs = Math.max(30, Math.round(roll.scrollHeight / 55));
    roll.style.animation = `crRoll ${secs}s linear forwards`;
    SFX.music('triumph', 110, state.theme);
  }
  $('#cr-skip').addEventListener('click', () => { $('#credits').hidden = true; renderGameOver(); });
  $('#cr-again').addEventListener('click', () => { $('#credits').hidden = true; act('lobby'); });

  socket.on('host:haunt', (evt) => town.haunt(evt));
  socket.on('host:chill', (evt) => town.chill(evt));
  socket.on('host:react', (r) => town.react(r.playerId, r.emoji));

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

  // Create a town. If the server doesn't answer (it's down, or an online server is still
  // waking up), say so instead of doing nothing.
  $('#create').addEventListener('click', () => {
    SFX.unlock();
    const btn = $('#create'), label = btn.textContent;
    if (btn.disabled) return;
    btn.disabled = true; btn.textContent = socket.connected ? 'Creating…' : 'Connecting…';
    socket.timeout(30000).emit('host:create', {}, (err, r) => {
      btn.disabled = false; btn.textContent = label;
      if (err) return toast('Can’t reach the game server. If this is the online version, it may still be waking up: wait a minute and try again.');
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
    // Big moments land with the music: a deep hit on deaths and verdicts, a swell for a win.
    if (/^(kill|multiKill|eliminated|hhStrike|hhExecute|crafterStrike)/.test(n.key || '')) SFX.play('boom');
    else if (/Win$/.test(n.key || '')) SFX.play('swell');
    speak(n.text);
  }

  // Each world has its own narrator: a preferred voice (by name/accent, falling back to any
  // English voice), a pitch and a pace. The classic look keeps the original narrator.
  const VOICES = {
    classic: { prefer: [/en-GB/i, /male|daniel|george|ryan/i], rate: 0.92, pitch: 0.85 },
    noir: { prefer: [/en-US/i, /male|guy|david|mark|christopher/i], rate: 0.84, pitch: 0.7 },
    tabletop: { prefer: [/en-GB/i, /male|george|ryan|thomas/i], rate: 0.95, pitch: 0.95 },
    space: { prefer: [/en-US/i, /zira|aria|female|jenny/i], rate: 1.02, pitch: 1.15 },
    fantasy: { prefer: [/en-GB/i, /female|libby|sonia|hazel/i], rate: 0.9, pitch: 1.1 },
    dragons: { prefer: [/en-GB/i, /male|ryan|george/i], rate: 0.86, pitch: 0.65 },
    dungeon: { prefer: [/en/i, /male/i], rate: 0.82, pitch: 0.6 },
    spies: { prefer: [/en-GB/i, /male|daniel|ryan/i], rate: 0.98, pitch: 0.9 },
    fbi: { prefer: [/en-US/i, /male|guy|david/i], rate: 1.0, pitch: 0.9 },
    snow: { prefer: [/en/i, /female|aria|libby|sonia/i], rate: 0.88, pitch: 1.05 },
    blocky: { prefer: [/en-US/i, /.*/], rate: 1.05, pitch: 1.3 },
    realistic: { prefer: [/en-US/i, /natural|neural|online/i], rate: 0.94, pitch: 1.0 },
  };
  const voiceCache = {};
  function voiceFor(theme) {
    const key = VOICES[theme] ? theme : 'classic';
    if (voiceCache[key] !== undefined) return { v: voiceCache[key], p: VOICES[key] };
    const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [], [lang, name] = VOICES[key].prefer;
    const v = vs.find((x) => lang.test(x.lang) && name.test(x.name) && /natural|neural|online|google/i.test(x.name))
      || vs.find((x) => lang.test(x.lang) && name.test(x.name)) || vs.find((x) => /^en/i.test(x.lang)) || null;
    if (vs.length) voiceCache[key] = v;
    return { v, p: VOICES[key] };
  }
  if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { for (const k of Object.keys(voiceCache)) delete voiceCache[k]; };

  // Spoken sentence by sentence, with a dramatic pause between them.
  let speakToken = 0;
  // Scene captions (the narrator's story beats) are read aloud too, when the voice is on.
  window.addEventListener('mt-caption', (e) => speak(e.detail));
  function speak(text) {
    if (state && state.narratorMode === 'human') return;
    if (!prefs.voice || !window.speechSynthesis) return;
    speechSynthesis.cancel();
    const token = ++speakToken;
    const style = state && state.settings.narratorStyle, { v: voice, p: vp } = voiceFor(state && state.theme);
    const parts = String(text).match(/[^.!?…]+[.!?…]*\s*/g) || [text];
    SFX.duck(true); // the music steps back while the narrator speaks
    const next = (i) => {
      if (token !== speakToken) return;
      if (i >= parts.length) { SFX.duck(false); return; }
      const u = new SpeechSynthesisUtterance(parts[i].trim());
      if (voice) u.voice = voice;
      u.rate = vp.rate * (style === 'comedy' ? 1.1 : 1);
      u.pitch = vp.pitch;
      u.onend = () => setTimeout(() => next(i + 1), /[.…]$/.test(parts[i].trim()) ? 650 : 350);
      u.onerror = () => SFX.duck(false);
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
    // New player help: one plain line about what everyone should be doing now.
    const helpLine = window.MT_HELP && MT_HELP.tvLine(state);
    $('#hud-help').hidden = !helpLine; $('#hud-help').textContent = helpLine || '';
    const how = $('#lobby-how');
    how.hidden = !state.help;
    if (state.help && !how.children.length) how.innerHTML = MT_HELP.LOBBY_STEPS.map((s) => `<li>${s}</li>`).join('');
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
    if (!show) { $('#attract').hidden = true; return; }
    $('#attract').hidden = state.players.length > 0; // empty lobby: the title over a slow flyover
    $('#attract-title').textContent = state.townName || 'Mafia Town';
    const hof = state.hallOfFame || [];
    $('#hof').hidden = !hof.length;
    if (hof.length) $('#hof').innerHTML = `<h3>🏛 Hall of Fame</h3><ol>${hof.map((h, i) => `<li><span>${['🥇', '🥈', '🥉'][i] || '·'} <b>${h.name.replace(/[<>&]/g, '')}</b>${h.title ? ` <small>${h.title}</small>` : ''}</span><span>${h.wins}W · ${h.games}G${h.mvps ? ` · 🏆${h.mvps}` : ''}</span></li>`).join('')}</ol>`;
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

  // ---------- graphics: HD (sharp) or Retro (chunky low-res + palette filter) ----------
  {
    const get = () => { try { return localStorage.getItem('mt.gfx') === 'retro' ? 'retro' : 'hd'; } catch { return 'hd'; } };
    const btn = $('#btn-gfx');
    if (btn) {
      btn.textContent = `🎨 Graphics: ${get() === 'retro' ? 'Retro' : 'HD'}`;
      btn.addEventListener('click', () => { try { localStorage.setItem('mt.gfx', get() === 'retro' ? 'hd' : 'retro'); } catch { /* private mode */ } location.reload(); });
    }
  }

  // ---------- game over ----------
  // The panel waits for the victory celebration to finish, so it doesn't cover the square.
  let goRetry = null;
  function renderGameOver() {
    const celebrating = (town.cinema && town.cinema.scene && /^victory/.test(town.cinema.scene.id)) || replaying || !$('#credits').hidden; // victory, replays and credits own the screen
    if (celebrating && state.phase === 'gameover') { clearTimeout(goRetry); goRetry = setTimeout(renderGameOver, 400); }
    const show = state.phase === 'gameover' && state.winner && !celebrating;
    $('#gameover').hidden = !show;
    if (state.phase !== 'gameover') $('#rundown').hidden = true;
    if (!show) return;
    const t = $('#go-title');
    const W = RR.WINNERS[state.winner] || RR.WINNERS.draw;
    const themedTeam = state.winner === 'mafia' ? MT_THEMES.teamName(state.theme, 'mafia', W.name) : W.name;
    t.textContent = state.winner === 'draw' ? '🤝 A Draw!' : `${W.emoji} ${themedTeam} ${state.winner === 'mafia' && themedTeam === W.name ? 'Win' : 'Wins'}!`;
    t.className = state.winner === 'town' ? 'town' : 'mafia';
    const evil = state.players.filter((p) => p.role && ROLES[p.role] && ROLES[p.role].team !== 'town')
      .map((p) => `${ROLES[p.role].emoji} ${p.name}${MT_THEMES.THEMES[state.theme] && MT_THEMES.THEMES[state.theme].roleNames ? ` (${MT_THEMES.roleName(state.theme, p.role, ROLES[p.role].name)})` : ''}`);
    $('#go-sub').textContent = (evil.length ? `Not on the town's side: ${evil.join(', ')}` : '') + (state.campaign ? `  ·  📖 Chapter ${state.campaign.chapter}/${state.campaign.total}: Town ${state.campaign.town} – Mafia ${state.campaign.mafia}${state.campaign.done ? ' (final)' : ''}` : '');
  }
  $('#go-again').addEventListener('click', () => act('lobby'));
  // Optional after-game story (only shown when someone clicks it).
  const showRundown = (rd) => { $('#rd-headline').textContent = `Rundown · ${rd.headline}`; $('#rd-body').innerHTML = MT_RUNDOWN.html(rd); $('#rd-body').scrollTop = 0; $('#rundown').hidden = false; };
  $('#go-rundown').addEventListener('click', () => socket.emit('room:rundown', {}, (r) => {
    if (!r || !r.ok) return toast((r && r.error) || 'The rundown is not available.');
    showRundown(r.rundown);
  }));
  socket.on('host:rundown', (m) => { if (m && m.show && m.rundown) showRundown(m.rundown); else $('#rundown').hidden = true; });
  $('#rd-close').addEventListener('click', () => { $('#rundown').hidden = true; });

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
