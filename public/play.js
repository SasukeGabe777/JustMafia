// Phone controller: join, customize, see your secret role, act at night, vote, haunt.
(function () {
  const params = new URLSearchParams(location.search);
  // ?slot=N gives each test phone (see /test) its own saved session.
  const SLOT = (params.get('slot') || '').replace(/[^\w-]/g, '').slice(0, 12);
  const key = (k) => (SLOT ? `${k}.${SLOT}` : k);
  const $ = (s) => document.querySelector(s);
  const OPT = window.MT_OPTIONS;
  const RR = window.MT_ROLES;
  const ROLES = RR.ROLES;
  const socket = io();

  let session = load('mt.player');
  let view = null;
  let profileReady = false;
  let lastKey = '';
  let clockOffset = 0;
  let roleShown = false;
  let editing = false;
  let prevPhase = null;
  let tpMsg = 'suspect';
  let tpTarget = '';
  let abilityDraft = {};
  let avatar = load('mt.avatar') || {
    color: pick(OPT.colors), skin: pick(OPT.skins), hat: 'none', hair:'short', outfit:'traveler', shoeStyle:'simple',
  };
  // Saved characters from before homes existed get a random starting home.
  if (!OPT.houseStyle.includes(avatar.houseStyle)) avatar.houseStyle = pick(OPT.houseStyle);
  if (!OPT.houseColor.includes(avatar.houseColor)) avatar.houseColor = pick(OPT.houseColor);

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function load(k) { try { return JSON.parse(localStorage.getItem(key(k)) || 'null'); } catch { return null; } }
  function save(k, v) { try { localStorage.setItem(key(k), JSON.stringify(v)); } catch { /* ignore */ } }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  const PHASE_LABEL = {
    accusation: 'Accusation', defense: 'Defense', emergencyIntro: 'Emergency vote', lobby: 'Lobby', roleReveal: 'Roles assigned', night: 'Night {d}', dawn: 'Night {d}', morning: 'Day {d}',
    discussion: 'Day {d} · Discuss', voting: 'Day {d} · Vote', verdict: 'Day {d} · Verdict', execution: 'Day {d} · Verdict', gameover: 'Game over',
  };

  // ---------- screens ----------
  function show(id) {
    for (const s of ['#screen-join', '#screen-game', '#screen-msg']) $(s).hidden = s !== id;
  }

  function showJoin(errorText) {
    editing = false;
    $('#code-wrap').hidden = false;
    $('#j-code').value = (params.get('room') || (session && session.code) || '').toUpperCase();
    $('#j-name').value = load('mt.name') || '';
    $('#j-name').disabled = false;
    $('#j-go').textContent = 'Join game';
    $('#j-go').disabled = !profileReady;
    $('#j-err').textContent = errorText || '';
    show('#screen-join');
    buildPicker();
    // ?autojoin=1&name=... joins straight away (used by the /test page).
    if (profileReady && params.get('autojoin') && params.get('name') && !autoJoined && $('#j-code').value) {
      autoJoined = true;
      $('#j-name').value = params.get('name').slice(0, 14);
      $('#j-go').click();
    }
  }
  let autoJoined = false;

  function showEdit() {
    editing = true;
    $('#code-wrap').hidden = true;
    $('#j-name').value = view.you.name;
    $('#j-name').disabled = view.phase !== 'lobby';
    $('#j-go').textContent = 'Save';
    $('#j-err').textContent = '';
    avatar = { ...view.you.avatar };
    show('#screen-join');
    buildPicker();
  }

  function showMsg(title, text) {
    $('#m-title').textContent = title;
    $('#m-text').textContent = text;
    show('#screen-msg');
  }
  $('#m-btn').addEventListener('click', () => showJoin());

  // ---------- avatar drawing ----------
  function paint(canvas, av, { scale = 1, ghost = false, feet = 0.93 } = {}) {
    if (typeof photo !== 'undefined' && (canvas.id === 'preview' || canvas.id === 'me')) av = photo.decorate(av);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = canvas.clientWidth || 48, h = canvas.clientHeight || 48;
    canvas.width = w * dpr; canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = (h / 76) * scale;
    if (ghost) MTArt.drawGhost(ctx, w / 2, h * feet, av, { scale: s, t: performance.now() / 1000 });
    else MTArt.drawCharacter(ctx, w / 2, h * feet, av, { scale: s, theme: view && view.theme });
  }

  let profile = null;
  const photo = MT_PHOTO_UI((match) => { avatar = { ...avatar, ...match }; buildPicker(); }, () => paint($('#preview'), avatar));
  function buildPicker() {
    MT_CREATOR.render({ avatar, profile, paint, theme: view && view.theme, change: (next) => { avatar = { ...avatar, ...next }; buildPicker(); }, buy: (itemId) => socket.emit('profile:buy', { itemId }, (r) => { if (r && r.ok) { profile = r.profile; buildPicker(); } else abilityReply(r); }) });
  }

  // ---------- join ----------
  $('#j-go').addEventListener('click', () => {
    if (!profileReady) return;
    const name = $('#j-name').value.trim();
    save('mt.avatar', avatar);
    if (editing) {
      socket.emit('player:profile', { name, avatar });
      editing = false;
      lastKey = '';
      show('#screen-game');
      render();
      return;
    }
    const code = $('#j-code').value.trim().toUpperCase();
    if (code.length !== 4) return void ($('#j-err').textContent = 'Enter the 4-letter room code from the big screen.');
    if (!name) return void ($('#j-err').textContent = 'Enter your name.');
    save('mt.name', name);
    $('#j-go').disabled = true;
    socket.emit('player:join', { code, name, avatar }, (r) => {
      $('#j-go').disabled = false;
      if (!r || !r.ok) return void ($('#j-err').textContent = (r && r.error) || 'Could not join.');
      session = { code: r.code, token: r.token };
      save('mt.player', session);
      keepAwake();
      show('#screen-game');
      lastKey = '';
      render();
    });
  });
  $('#j-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });

  // ---------- connection ----------
  socket.on('profile:state', (p) => { profile = p; if (!$('#screen-join').hidden) buildPicker(); });
  socket.on('connect', () => {
    const creds = load('mt.profile');
    const ready = (r) => {
      if (!r || !r.ok) { $('#j-err').textContent = 'Profile connection failed. Reload to reconnect.'; return; }
      profile = r.profile; profileReady = true; $('#j-go').disabled = false;
      if (r.token) save('mt.profile',{ id:r.id,token:r.token });
      if (!$('#screen-join').hidden) {
        buildPicker();
        if (!editing && params.get('autojoin') && params.get('name') && !autoJoined && $('#j-code').value) { autoJoined = true; $('#j-name').value = params.get('name').slice(0,14); $('#j-go').click(); }
      }
    };
    if (creds) socket.emit('profile:resume', creds, (r) => r && r.ok ? ready(r) : socket.emit('profile:create', {}, ready));
    else socket.emit('profile:create', {}, ready);
    const urlRoom = (params.get('room') || '').toUpperCase();
    if (session && (!urlRoom || urlRoom === session.code)) {
      socket.emit('player:resume', session, (r) => {
        if (r && r.ok) { keepAwake(); show('#screen-game'); lastKey = ''; render(); } else { session = null; save('mt.player', null); showJoin(); }
      });
    } else if (!view) showJoin();
  });

  socket.on('player:kicked', () => {
    session = null;
    save('mt.player', null);
    view = null;
    showMsg('You were removed', 'The host removed you from this game. You can join again if you like.');
  });

  socket.on('player:state', (v) => {
    clockOffset = v.serverNow - Date.now();
    const phaseChanged = prevPhase !== v.phase;
    if (phaseChanged) {
      abilityDraft = {};
      if (v.phase === 'roleReveal' || v.phase === 'lobby') roleShown = false;
      if ((v.phase === 'night' && v.action) || (v.phase === 'voting' && v.voting)) buzz();
      prevPhase = v.phase;
    }
    view = v;
    if (editing && v.phase !== 'lobby') { editing = false; show('#screen-game'); }
    if (!$('#screen-game').hidden) render();
  });

  function buzz() { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); }

  let wakeLock = null;
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { /* ignore */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && session) keepAwake(); });

  // ---------- timer ----------
  function updateTimer() {
    const el = $('#g-timer');
    if (!view) return;
    if (view.paused) { el.textContent = '⏸'; el.classList.remove('urgent'); return; }
    if (!view.endsAt || !['night', 'discussion', 'voting', 'accusation', 'defense', 'emergencyIntro'].includes(view.phase)) { el.textContent = ''; return; }
    const s = Math.max(0, Math.ceil((view.endsAt - (Date.now() + clockOffset)) / 1000));
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    el.classList.toggle('urgent', s <= 10);
  }
  setInterval(updateTimer, 250);

  // ---------- rendering ----------
  const byId = (id) => view.players.find((p) => p.id === id);

  function render() {
    if (!view) return;
    const key = JSON.stringify({ ...view, serverNow: 0, endsAt: 0, remainingMs: 0, roleShown });
    if (key === lastKey) return;
    lastKey = key;

    $('#g-name').textContent = view.you.name;
    $('#g-name').style.color = view.you.avatar.nameColor || '#ffffff';
    $('#g-phase').textContent = (PHASE_LABEL[view.phase] || '').replace('{d}', view.day) + (view.you.alive || view.phase === 'lobby' ? '' : ' · 👻');
    paint($('#me'), view.you.avatar, { ghost: !view.you.alive && view.phase !== 'lobby' && !view.you.spectator });
    updateTimer();

    const body = $('#g-body');
    const focus = document.activeElement && document.activeElement.dataset.draft;
    const caret = focus ? document.activeElement.selectionStart : null;
    body.innerHTML = bodyHtml();
    wire(body);
    renderSettings();
    renderAbility();
    renderPrivateScene();
    if (view.progression) profile = view.progression;
    MT_STORY_UI(view, socket, $('#g-body'), { esc, paint, reply: abilityReply, votingHtml });
    if (focus) { const input = [...body.querySelectorAll('[data-draft]')].find((el) => el.dataset.draft === focus); if (input) { input.focus(); if (caret != null) input.setSelectionRange(caret,caret); } }
  }

  function renderSettings() {
    const g = view.governance, box = $('#governance');
    if (!g) return;
    box.innerHTML = `<p>${esc(g.announcement || 'Judge selection is managed before the game.')}</p>
      <p>${g.approvals}/${g.required} approvals to remove Judge (${g.eligible} connected humans; includes ghosts).</p>
      ${view.isJudge && session ? `<a class="btn" href="/judge#${session.code}.player.${session.token}" target="_blank" rel="noopener">Open my Judge console</a>` : ''}
      ${g.canVote ? `<button class="btn danger" id="remove-judge" ${g.supported ? 'disabled' : ''}>${g.supported ? 'Removal supported' : 'Vote to Remove Judge'}</button>` : ''}
      ${g.canVolunteer && !g.volunteered ? '<button class="btn ghost" id="volunteer-judge">Volunteer as replacement Judge</button><p class="small muted">Becoming Judge ends your player participation in this game and gives you access to secrets.</p>' : ''}`;
    const rm = $('#remove-judge');
    if (rm) rm.addEventListener('click', () => { if (confirm('Support removing the Judge? This vote is separate from elimination voting.')) socket.emit('player:removeJudge', {}, abilityReply); });
    const vol = $('#volunteer-judge');
    if (vol) vol.addEventListener('click', () => { if (confirm('Volunteer as Judge? If selected, you forfeit your player seat for this game and can see hidden information.')) socket.emit('player:volunteerJudge', { confirmed: true }, abilityReply); });
  }
  function abilityReply(r) { if (r && !r.ok && r.error) alert(r.error); }
  function renderAbility() {
    const a = view.ability;
    if (!a || ['lobby', 'gameover'].includes(view.phase) || view.you.spectator) return;
    const box = document.createElement('div'); box.className = 'card';
    if (a.kind === 'ghostwriter') {
      const words = ['', ...a.words, ...view.players.map((p) => `PLAYER ${p.house + 1}`)];
      box.innerHTML = `<h3>WRITE A CLUE</h3><p class="muted small">Up to three approved words, once per day. Publishes at the next discussion or voting opening.</p>${a.canUse ? [0, 1, 2].map(() => `<select data-word>${words.map((w) => `<option>${esc(w)}</option>`).join('')}</select>`).join('') + '<button class="btn" data-use>Send clue</button>' : `<p>${a.pending ? 'Clue queued.' : 'Your writing is quiet right now.'}</p>`}`;
    } else if (a.kind === 'puppetMaster') {
      const targets = view.players.filter((p) => p.alive);
      const options = targets.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
      box.innerHTML = `<h3>Puppet Master</h3><p>${a.left} uses left.</p>${a.canUse ? `<label>Force this voter<select id="puppet-victim">${options}</select></label><label>Toward this target<select id="puppet-target">${options}</select></label><button class="btn" data-use>Redirect vote secretly</button>` : '<p class="muted">Available during public voting.</p>'}`;
    } else if (a.kind === 'glitch') {
      box.innerHTML = `<h3>The Glitch</h3><p>${a.left} uses left. Corrupt the public display for 30 seconds.</p><button class="btn" data-use ${a.canUse ? '' : 'disabled'}>CORRUPT</button>`;
    } else if (a.kind === 'conductor') {
      const o = a.objective;
      box.innerHTML = `<h3>Secret harmony objective</h3><p>${o ? `Get ${o.voters.map((id) => esc((byId(id) || {}).name || '?')).join(' and ')} to vote for the same living player.` : 'Your objective arrives at discussion.'}</p><p>${a.harmony}/${a.goal} Harmony toward your next blessing.</p>`;
    } else if (a.kind === 'paparazzi') box.innerHTML = `<h3>Photo journal</h3><p>${a.photos}/${a.goal} published photos. Survive until game end to win.</p>`;
    $('#g-body').appendChild(box);
    box.querySelectorAll('[data-word]').forEach((el, i) => { el.value = (abilityDraft.words || [])[i] || ''; el.addEventListener('change', () => { abilityDraft.words = [...box.querySelectorAll('[data-word]')].map((w) => w.value); }); });
    for (const id of ['puppet-victim', 'puppet-target']) {
      const el = box.querySelector('#' + id);
      if (el) { if ([...el.options].some((o) => o.value === abilityDraft[id])) el.value = abilityDraft[id]; el.addEventListener('change', () => { abilityDraft[id] = el.value; }); }
    }
    const use = box.querySelector('[data-use]');
    if (use) use.addEventListener('click', () => {
      const msg = a.kind === 'ghostwriter' ? { tokens: [...box.querySelectorAll('[data-word]')].map((el) => el.value).filter(Boolean) }
        : a.kind === 'puppetMaster' ? { victimId: $('#puppet-victim').value, targetId: $('#puppet-target').value } : {};
      socket.emit('player:ability', msg, abilityReply);
    });
  }

  let privateSceneId = '', privateStarted = 0;
  function renderPrivateScene() {
    const sc = view.privateScene;
    if (!sc || sc.night !== view.day || !['dawn', 'morning', 'discussion'].includes(view.phase) || view.you.spectator) return;
    if (privateSceneId !== sc.id) { privateSceneId = sc.id; privateStarted = performance.now(); }
    const card = document.createElement('div'); card.className = 'card private-investigation';
    card.innerHTML = `<h3>Private ${sc.scene === 'planting' ? 'fuse planting' : sc.scene === 'watcher' ? 'surveillance' : 'investigation'}</h3><canvas class="private-scene" aria-label="Your character approaches the selected house"></canvas><p data-private-result></p><button class="btn ghost" data-replay>Replay investigation</button>`;
    $('#g-body').prepend(card);
    const result = (view.investigations || []).find((i) => i.night === sc.night && i.targetId === sc.targetId);
    const draw = () => {
      if (!card.isConnected) return;
      const t = Math.min(6, (performance.now() - privateStarted) / 1000), cv = card.querySelector('canvas'), ctx = cv.getContext('2d');
      cv.width = 360; cv.height = 190;
      ctx.fillStyle = '#20273e'; ctx.fillRect(0, 0, 360, 190);
      ctx.fillStyle = '#56714c'; ctx.fillRect(0, 140, 360, 50);
      ctx.fillStyle = '#d4bea2'; ctx.fillRect(230, 76, 88, 72);
      ctx.fillStyle = '#836051'; ctx.beginPath(); ctx.moveTo(219, 78); ctx.lineTo(274, 42); ctx.lineTo(329, 78); ctx.fill();
      ctx.fillStyle = t > 3 ? '#ffe6a1' : '#526c88'; ctx.fillRect(282, 93, 22, 20);
      ctx.fillStyle = '#503c35'; ctx.fillRect(242, 106, 22, 42);
      MTArt.drawCharacter(ctx, 35 + Math.min(1, t / 3) * 177, 154, view.you.avatar, { t, walking: t < 3, facing: 1, scale: 1.1, theme: view.theme });
      if (t > 3 && t < 5.6) { ctx.strokeStyle = '#b8ddff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(235, 103, 12 + Math.sin(t * 8) * 4, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.font = '16px monospace'; ctx.fillText((byId(sc.targetId) || {}).name || 'House', 235, 175);
      card.querySelector('[data-private-result]').textContent = t < 5.6 ? sc.scene === 'planting' ? 'Preparing the fuse…' : 'Observing…' : sc.scene === 'planting' ? 'Fuse planted. The server tracks the delay.' : !result ? 'Observation complete.' : result.reveal === 'role' && ROLES[result.result] ? ROLES[result.result].name : result.blocked ? 'Your investigation was blocked.' : result.clue || (result.result ? (result.reveal === 'killer' ? 'Dangerous' : 'Mafia') : (result.reveal === 'killer' ? 'Not dangerous' : 'Not Mafia'));
      document.querySelectorAll('[data-investigation-result]').forEach((el) => { el.hidden = t < 5.6; });
      if (t < 6) requestAnimationFrame(draw);
    };
    card.querySelector('[data-replay]').addEventListener('click', () => { privateStarted = performance.now(); draw(); });
    draw();
  }

  function bodyHtml() {
    const v = view;
    if (v.isJudge && session) return `<div class="card center"><h2>You are the Judge</h2><p>You control the story of ${esc(v.townName)}. Keep your console private.</p><a class="btn" href="/judge#${session.code}.player.${session.token}" target="_blank" rel="noopener">Open my Judge console</a><p class="muted small">Your normal player seat is closed for this game.</p></div>`;
    if (v.phase === 'lobby') {
      return `<div class="card center">
        <div class="big-emoji">🎉</div>
        <h2>You're in!</h2>
        <p>Find yourself on the big screen.</p>
        <p class="muted">${v.lobbyCount} in town${v.lobbyCount < v.minPlayers ? ` · need ${v.minPlayers - v.lobbyCount} more` : ''}. Waiting for the host to start…</p>
      </div>
      <button class="btn ghost" data-edit>Change my look</button>`;
    }
    if (v.you.spectator) {
      return `<div class="card center"><div class="big-emoji">🍿</div><h2>Game in progress</h2>
        <p>You'll be dealt in next round. Enjoy the show on the big screen!</p></div>`;
    }
    if (v.phase === 'gameover') return gameOverHtml();

    const narr = v.narration ? `<div class="card"><p class="narr">“${esc(v.narration.text)}”</p></div>` : '';
    if (!v.you.alive) return ghostHtml() + narr;
    return notesHtml() + phaseHtml(narr) + telepathHtml();
  }

  function notesHtml() {
    const notes = (view.notes || []).filter((n) => n.day === view.day);
    if (!notes.length || ['lobby', 'roleReveal'].includes(view.phase)) return '';
    return notes.map((n) => `<div class="card note">⚠️ ${esc(n.text)}</div>`).join('');
  }

  function phaseHtml(narr) {
    const v = view;
    switch (v.phase) {
      case 'roleReveal':
        return `<p class="center muted">Your secret role (tap the card). Don't let anyone see!</p>${roleCard(true)}`;
      case 'night':
        return nightHtml();
      case 'dawn':
        return `<div class="card center"><div class="big-emoji">🌙</div><h2>Something stirs in the dark…</h2><p class="muted">Watch the big screen.</p></div>${latestInvestigation()}${roleCard()}`;
      case 'morning':
      case 'discussion':
        return `${narr}<div class="card center"><div class="big-emoji">🗣️</div><h2>Discuss!</h2><p class="muted">Who's acting suspicious? Make your case out loud.</p></div>${latestInvestigation()}${roleCard()}`;
      case 'voting':
        return votingHtml();
      case 'verdict':
      case 'execution':
        return `${narr}<div class="card center"><div class="big-emoji">⚖️</div><h2>The verdict</h2><p class="muted">Eyes on the big screen…</p></div>${roleCard()}`;
      default:
        return narr + roleCard();
    }
  }

  function roleExtras() {
    const v = view;
    let html = '';
    if (v.teammates) {
      html += `<div class="extra"><b>Your team:</b> ${v.teammates.length ? v.teammates.map((t) => `${esc(t.name)}${ROLES[t.role] && t.role !== 'mafia' ? ` (${ROLES[t.role].name})` : ''}${t.alive ? '' : ' 👻'}`).join(', ') : 'Just you. Good luck!'}</div>`;
    }
    if (v.investigations && v.investigations.length) {
      html += `<div class="extra"><b>Your notebook</b><ul class="list">${v.investigations.map((i) => `<li><span>Night ${i.night}: ${esc(i.name)}</span>${verdictTag(i)}</li>`).join('')}</ul></div>`;
    }
    if (v.role === 'vigilante') html += `<div class="extra">🎯 Bullets left: <b>${v.shotsLeft}</b></div>`;
    if (v.telepath && v.telepath.partner) html += `<div class="extra">🔮 Your fellow Telepath: <b>${esc(v.telepath.partner.name)}</b>${v.telepath.partner.alive ? '' : ' 👻'}</div>`;
    return html;
  }

  function roleCard(big) {
    const r = ROLES[view.role];
    if (!r) return '';
    const shown = roleShown;
    return `<div class="rolecard ${view.role} ${shown ? 'show' : ''}" data-role style="--rc:${r.color}">
      <div class="rc-hidden">🔒 ${big ? 'Tap to reveal your role' : 'Tap to peek at your role'}</div>
      <div class="rc-shown">
        <div class="big-emoji">${r.emoji}</div>
        <div class="rc-name">${r.name}</div>
        <div class="rc-blurb">${esc(view.roleBlurb || r.blurb)}</div>
        ${roleExtras()}
        <div class="small" style="margin-top:8px;opacity:.8">Tap to hide</div>
      </div>
    </div>`;
  }

  function verdictTag(i, big) {
    const st = big ? ' style="font-size:20px"' : '';
    if (i.blocked) return `<span class="tag"${st}>Blocked</span>`;
    if (i.reveal === 'role' && ROLES[i.result]) return `<span class="tag">${esc(ROLES[i.result].name)}</span>`;
    if (i.clue) return `<span class="tag"${st}>${esc(i.clue)}</span>`;
    const word = i.reveal === 'killer' ? (i.result ? 'DANGEROUS' : 'Not dangerous') : (i.result ? 'MAFIA' : 'NOT Mafia');
    return `<span class="tag ${i.result ? 'bad' : 'good'}"${st}>${word}</span>`;
  }

  function latestInvestigation() {
    const list = view.investigations || [];
    const inv = list[list.length - 1];
    if (!inv || inv.night !== view.day) return '';
    if (inv.clue) return `<div class="card center" data-investigation-result><p>At ${esc(inv.name)}'s house:</p><h2>${esc(inv.clue)}</h2></div>`;
    if (inv.blocked) return `<div class="card center"><p class="muted">Someone distracted you. You learned nothing about ${esc(inv.name)} tonight.</p></div>`;
    return `<div class="card center" data-investigation-result><p class="muted">Your investigation tonight:</p>
      <h2>${esc(inv.name)} is ${verdictTag(inv, true)}</h2></div>`;
  }

  function targetButton(p, selected, attr, extra = '') {
    return `<button class="target ${selected ? 'sel' : ''}" ${attr}="${p.id}"><canvas data-av="${p.id}"></canvas><span>${esc(p.name)}</span>${extra}</button>`;
  }

  function nightHtml() {
    const v = view;
    const a = v.action;
    if (!a || a.kind === 'interrupt' || v.mafia && a.kind === 'kill' && v.role !== 'serialKiller') return roleCard();
    const last = a.blocked ? `You picked ${esc((byId(a.blocked) || {}).name || 'them')} last night, so not them again.` : '';
    const prompts = {
      bomb: ['Plant an explosive', 'The server counts phase transitions. The house explodes during daytime, even if its owner has died.'],
      silence: ['Silence a player', 'They lose digital voting, nomination and whisper access next day.'],
      hustle: ['Shorten tomorrow’s discussion', 'Select any target to activate. One use by default.'],
      midas: ['Use the Midas potion', 'If this player is eliminated next day, a supported active ability passes to the Mafia.'],
      volatile: ['Use the Volatile potion', 'Return a fallen Mafia teammate for one day. They turn to ash afterward.'],
      interrupt: ['Town Square Interruption', 'Use the emergency vote control below.'],
      spy: ['Spy on a house', 'Observe real visitors and departures. Your clue stays private.'],
      photo: ['Photograph a player', 'If they act successfully, publish an anonymous activity clue at dawn.'],
      kill: v.role === 'serialKiller' ? ['🗡️ Who dies tonight?', 'Only a Doctor or Bodyguard can stop you.']
        : ['🔪 Choose your target', v.role === 'godfather' ? 'You have the final say for the family.' : "The Mafia must agree (the Godfather's pick wins). You can see your team's picks."],
      block: ['🚫 Who will you distract?', 'Their night ability will fail.'],
      investigate: ['🔍 Who will you investigate?', v.action && v.action.reveal === 'role' ? "You'll learn their exact role." : v.role === 'sheriff' ? "You'll learn if they are dangerous." : "You'll learn if they're Mafia."],
      heal: ['💉 Who will you protect?', last || 'You can protect yourself.'],
      guard: ['🛡️ Who will you guard?', last || 'If they are attacked, you die in their place.'],
      shoot: ['🎯 Shoot someone?', `${v.shotsLeft} bullet${v.shotsLeft === 1 ? '' : 's'} left. Only shoot if you're sure.`],
      dummy: ['🤔 Who do you suspect?', 'Pick whoever seems most suspicious.'],
    };
    const [title, sub] = prompts[a.dummy ? 'dummy' : a.kind] || prompts.dummy;
    const picksFor = {};
    (a.teamPicks || []).forEach((tp) => {
      const mate = (v.teammates || []).find((t) => t.id === tp.id);
      (picksFor[tp.targetId] = picksFor[tp.targetId] || []).push(mate ? mate.name : '?');
    });
    const buttons = a.targets.map((id) => byId(id)).filter(Boolean)
      .map((p) => targetButton(p, a.choice === p.id, 'data-night', picksFor[p.id] ? `<span class="picks">${picksFor[p.id].map(esc).join(', ')}</span>` : ''))
      .join('');
    const locked = a.choice === 'pass' ? '<div class="locked">✓ Holding fire tonight</div>'
      : a.choice ? `<div class="locked">✓ ${esc((byId(a.choice) || {}).name || '')} — tap someone else to change</div>` : '';
    const pass = a.optional ? `<button class="btn ghost skip ${a.choice === 'pass' ? 'sel' : ''}" data-night="pass">Hold fire</button>` : '';
    return `<div class="card">
        <div class="prompt">${title}</div>
        <p class="muted small">${sub} Keep your screen hidden!</p>
        <div class="grid">${buttons}</div>
        ${pass}${locked}
      </div>${roleCard()}`;
  }

  function votingHtml() {
    const v = view;
    const vt = v.voting;
    if (!vt) return roleCard();
    const buttons = vt.targets.map((id) => byId(id)).filter(Boolean).map((p) => targetButton(p, vt.choice === p.id, 'data-vote')).join('');
    return `<div class="card">
      <div class="prompt">🗳️ Vote to eliminate</div>
      <p class="muted small">${vt.voted}/${vt.total} have voted. You can change your vote until ${v.manualVoting ? 'the Judge closes voting' : 'time runs out'}.</p>
      <div class="grid">${buttons}</div>
      ${vt.canSkip ? `<button class="btn ghost skip ${vt.choice === 'skip' ? 'sel' : ''}" data-vote="skip">${vt.choice === 'skip' ? '✓ ' : ''}Skip (no elimination)</button>` : ''}
      ${vt.choice && vt.choice !== 'skip' ? `<div class="locked">✓ You voted for ${esc((byId(vt.choice) || {}).name || '')}</div>` : ''}
    </div>${roleCard()}`;
  }

  function telepathHtml() {
    const tp = view.telepath;
    if (!tp || !tp.partner || ['roleReveal', 'gameover'].includes(view.phase)) return '';
    const others = view.players.filter((p) => p.id !== view.you.id);
    if (!tpTarget || !others.some((p) => p.id === tpTarget)) tpTarget = (others.find((p) => p.alive) || others[0] || {}).id || '';
    const def = RR.TELEPATH_MESSAGES.find((m) => m.id === tpMsg) || RR.TELEPATH_MESSAGES[0];
    const nameOf = (id) => (view.players.find((p) => p.id === id) || {}).name || '?';
    const log = tp.log.slice(-8).reverse().map((m) => `<li><span><b>${m.fromId === view.you.id ? 'You' : esc(nameOf(m.fromId))}:</b> ${esc(m.text)}</span><span class="muted small">D${m.day}</span></li>`).join('');
    return `<div class="card telepath">
      <div class="prompt">🔮 Psychic link</div>
      <p class="muted small">Only ${esc(tp.partner.name)} sees these.${tp.canSend ? '' : ' The link is quiet right now.'}</p>
      ${tp.canSend ? `<select id="tp-msg">${RR.TELEPATH_MESSAGES.map((m) => `<option value="${m.id}" ${m.id === tpMsg ? 'selected' : ''}>${esc(m.text.replace('{player}', '…'))}</option>`).join('')}</select>
      ${def.player ? `<select id="tp-target">${others.map((p) => `<option value="${p.id}" ${p.id === tpTarget ? 'selected' : ''}>${esc(p.name)}${p.alive ? '' : ' 👻'}</option>`).join('')}</select>` : ''}
      <button class="btn" data-tp>Send</button>` : ''}
      ${log ? `<ul class="list">${log}</ul>` : ''}
    </div>`;
  }

  function ghostHtml() {
    const v = view;
    const alive = v.players.filter((p) => p.alive);
    const cooling = (v.hauntReadyAt || 0) - (Date.now() + clockOffset) > 0;
    const r = ROLES[v.role];
    return `<div class="card ghostcard center">
      <div class="big-emoji">👻</div>
      <h2>You're a ghost</h2>
      <p class="muted">Your living ability is finished. Use the ghost controls below when enabled, and keep secrets away from living players.</p>
      ${r ? `<p class="small">You were ${r.emoji} <b>${r.name}</b></p>` : ''}
      ${v.hauntReadyAt == null ? '<p class="muted small">Haunting is turned off for this game.</p>' : `<div class="haunts">
        <button class="btn" data-haunt="spin" ${cooling ? 'disabled' : ''}>🌀 Spin</button>
        <button class="btn" data-haunt="wail" ${cooling ? 'disabled' : ''}>😱 Wail</button>
      </div>`}
    </div>
    ${v.hauntReadyAt == null ? '' : `<div class="card">
      <div class="prompt">👻 Boo someone</div>
      <p class="muted small">Float over and spook a living player.</p>
      <div class="grid">${alive.map((p) => targetButton(p, false, 'data-boo')).join('')}</div>
    </div>`}`;
  }

  function gameOverHtml() {
    const v = view;
    const won = !!v.won;
    const order = { mafia: 0, neutral: 1, town: 2 };
    const teamOf = (p) => (ROLES[p.role] ? ROLES[p.role].team : 'town');
    const rows = v.players.slice().sort((a, b) => order[teamOf(a)] - order[teamOf(b)])
      .map((p) => { const r = ROLES[p.role] || {}; return `<li><span>${p.won ? '🏆 ' : ''}${esc(p.name)}${p.alive ? '' : ' 👻'}</span><span class="tag" style="background:${r.color};color:${r.darkText ? '#2a2200' : '#fff'}">${r.emoji || ''} ${r.name || '?'}</span></li>`; })
      .join('');
    const W = RR.WINNERS[v.winner] || RR.WINNERS.draw;
    return `<div class="card center">
      <div class="big-emoji">${W.emoji}</div>
      <div class="result ${won ? 'win' : 'lose'}">${won ? 'You won!' : 'You lost'}</div>
      <p>${v.winner === 'draw' ? "It's a draw." : `${W.name} wins.`}</p>
      <p class="muted small">Waiting for the host to start another round…</p>
    </div>
    <div class="card"><h3>Everyone's roles</h3><ul class="list">${rows}</ul></div>`;
  }

  function wire(body) {
    body.querySelectorAll('canvas[data-av]').forEach((cv) => {
      const p = byId(cv.dataset.av);
      if (p) paint(cv, p.avatar);
    });
    const rc = body.querySelector('[data-role]');
    if (rc) rc.addEventListener('click', () => { roleShown = !roleShown; rc.classList.toggle('show', roleShown); lastKey = ''; });
    body.querySelectorAll('[data-night]').forEach((b) => b.addEventListener('click', () => socket.emit('player:night', { targetId: b.dataset.night, delay: Number((document.querySelector('#bomb-delay') || {}).value) || 3 })));
    body.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', () => socket.emit('player:vote', { targetId: b.dataset.vote })));
    body.querySelectorAll('[data-boo]').forEach((b) => b.addEventListener('click', () => haunt('boo', b.dataset.boo)));
    body.querySelectorAll('[data-haunt]').forEach((b) => b.addEventListener('click', () => haunt(b.dataset.haunt)));
    const tm = body.querySelector('#tp-msg');
    if (tm) tm.addEventListener('change', () => { tpMsg = tm.value; lastKey = ''; render(); });
    const tt = body.querySelector('#tp-target');
    if (tt) tt.addEventListener('change', () => { tpTarget = tt.value; });
    const tb = body.querySelector('[data-tp]');
    if (tb) tb.addEventListener('click', () => {
      tb.disabled = true;
      socket.emit('player:telepath', { msgId: tpMsg, targetId: tpTarget }, (res) => {
        tb.disabled = false;
        if (res && !res.ok && res.error) { tb.textContent = res.error; setTimeout(() => { tb.textContent = 'Send'; }, 1500); }
      });
    });
    const ed = body.querySelector('[data-edit]');
    if (ed) ed.addEventListener('click', showEdit);
  }

  let hauntLocalUntil = 0;
  function haunt(kind, targetId) {
    if (Date.now() < hauntLocalUntil) return;
    hauntLocalUntil = Date.now() + 4000;
    socket.emit('player:haunt', { kind, targetId });
    if (navigator.vibrate) navigator.vibrate(40);
    body().querySelectorAll('[data-haunt],[data-boo]').forEach((b) => { b.disabled = true; });
    setTimeout(() => { lastKey = ''; render(); }, 4100);
  }
  const body = () => $('#g-body');

  if (!session) showJoin();
})();
