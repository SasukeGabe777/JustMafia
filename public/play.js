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
  let draftPhone = null;
  let roleShown = false;
  let voteErr = '', voteErrPhase = null; // why the last vote tap was refused (cleared each new vote)
  let editing = false;
  let prevPhase = null;
  let tpMsg = 'suspect';
  let tpTarget = '';
  let abilityDraft = {};
  let avatar = load('mt.avatar') || {
    color: pick(OPT.colors), skin: pick(OPT.skins), hat: 'none', hair:'short', outfit:'traveler', shoeStyle:'simple',
  };
  // House design (separate from the character). Older saves kept it on the avatar.
  let home = load('mt.home') || {};
  for (const [k, old] of Object.entries(OPT.LEGACY_HOME)) if (home[k] == null && avatar[old] != null) home[k] = avatar[old];
  if (!OPT.houseStyle.includes(home.style)) home.style = pick(OPT.houseStyle.slice(0, OPT.FREE_HOUSE_STYLES));
  if (!OPT.houseColor.includes(home.wall)) home.wall = pick(OPT.houseColor);
  for (const [k, list] of Object.entries(OPT.HOME_FIELDS)) if (!OPT[list].includes(home[k])) home[k] = OPT[list][0];
  let savedHome = { ...home }, homeTab = 'style', homeMode = null, pendingClaim = false;
  // Creator state: `avatar` is the live draft shown in previews; `savedAvatar` is
  // what was last saved (device + server profile). Revert returns to it.
  let savedAvatar = { ...avatar };
  let creatorMode = null; // 'join' | 'edit'
  let creatorTab = 'body';

  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  // Role names shown to players follow the theme (e.g. RSP Supply Associate); rules use role ids.
  function roleLabel(id) { return window.MT_THEMES ? MT_THEMES.roleName(view && view.theme, id, (ROLES[id] || {}).name || id) : (ROLES[id] || {}).name || id; }
  function load(k) { try { return JSON.parse(localStorage.getItem(key(k)) || 'null'); } catch { return null; } }
  function save(k, v) { try { localStorage.setItem(key(k), JSON.stringify(v)); } catch { /* ignore */ } }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  const PHASE_LABEL = {
    accusation: 'Accusation', defense: 'Defense', emergencyIntro: 'Emergency vote', lobby: 'Lobby', draft: 'Choosing the roles', roleReveal: 'Roles assigned', night: 'Night {d}', dawn: 'Night {d}', morning: 'Day {d}',
    discussion: 'Day {d} · Discuss', voting: 'Day {d} · Vote', verdict: 'Day {d} · Verdict', execution: 'Day {d} · Verdict', gameover: 'Game over',
  };

  // ---------- screens ----------
  function show(id) {
    for (const s of ['#screen-join', '#screen-creator', '#screen-home', '#screen-shop', '#screen-game', '#screen-msg']) $(s).hidden = s !== id;
    if (id === '#screen-creator') startStage();
    if (id === '#screen-home') startHouseStage();
    if (id !== '#screen-home') homeMode = null;
  }

  // Step 1: room code. A QR/link with ?room= skips straight to the creator.
  function showJoin(errorText) {
    editing = false; creatorMode = null;
    $('#j-code').value = (params.get('room') || (session && session.code) || '').toUpperCase();
    $('#j-err').textContent = errorText || '';
    show('#screen-join');
    if (tryAutoJoin()) return;
    if (params.get('room') && !params.get('autojoin') && !autoOpened && !errorText) { autoOpened = true; goNext(); }
  }
  let autoJoined = false, autoOpened = false, roomHelp = true;
  // ?autojoin=1&name=... joins straight away with the saved look (used by the /test page).
  function tryAutoJoin() {
    if (!profileReady || !params.get('autojoin') || !params.get('name') || autoJoined || !$('#j-code').value) return false;
    autoJoined = true; doJoin($('#j-code').value, params.get('name').slice(0, 14)); return true;
  }
  function goNext() {
    const code = $('#j-code').value.trim().toUpperCase();
    if (code.length !== 4) return void ($('#j-err').textContent = 'Enter the 4-letter room code from the big screen.');
    $('#j-next').disabled = true;
    socket.emit('room:check', { code }, (r) => {
      $('#j-next').disabled = false;
      if (!r || !r.ok) return void ($('#j-err').textContent = (r && r.error) || 'Room not found.');
      roomHelp = r.help !== false; // the room's "New player help" setting (Quick join on the creator)
      MT_CREATOR.setParty(!!r.party); // party mode: every cosmetic is unlocked in this room
      $('#j-err').textContent = ''; openCreator('join');
    });
  }
  $('#j-next').addEventListener('click', goNext);

  // Step 2: the character creator (also used to edit your look in the lobby).
  function openCreator(mode) {
    creatorMode = mode; editing = mode === 'edit';
    $('#c-title').textContent = mode === 'edit' ? 'Edit your townsfolk' : 'Create your townsfolk';
    $('#j-name').value = mode === 'edit' ? view.you.name : load('mt.name') || '';
    $('#j-name').disabled = mode === 'edit' && view.phase !== 'lobby';
    $('#j-go').textContent = mode === 'edit' ? 'Save' : 'Join the game ▶';
    $('#j-go').disabled = !profileReady;
    $('#c-save').hidden = mode === 'edit';
    $('#quick-join').hidden = mode === 'edit' || !roomHelp;
    $('#q-name').value = load('mt.name') || '';
    $('#c-shop').hidden = mode !== 'edit'; // first join: one clear path; the shop is in the lobby
    $('#c-err').textContent = '';
    avatar = { ...savedAvatar };
    show('#screen-creator');
    buildPicker();
  }

  function showEdit() {
    savedAvatar = { ...view.you.avatar };
    openCreator('edit');
  }

  function showMsg(title, text) {
    $('#m-title').textContent = title;
    $('#m-text').textContent = text;
    show('#screen-msg');
  }
  $('#m-btn').addEventListener('click', () => showJoin());

  // ---------- avatar drawing ----------
  function paint(canvas, av, { scale = 1, ghost = false, feet = 0.93, t } = {}) {
    if (typeof photo !== 'undefined' && (canvas.id === 'preview' || canvas.id === 'me')) av = photo.decorate(av);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = canvas.clientWidth || 48, h = canvas.clientHeight || 48;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = w * dpr; canvas.height = h * dpr; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const s = (h / 76) * scale;
    if (ghost) MTArt.drawGhost(ctx, w / 2, h * feet, av, { scale: s, t: performance.now() / 1000 });
    else MTArt.drawCharacter(ctx, w / 2, h * feet, av, { scale: s, theme: view && view.theme, t: t || 0 });
    return ctx;
  }

  // Creator stage: the draft idles (breathing, blinking) with its name tag while the creator is open.
  let stageRunning = false;
  function startStage() {
    if (stageRunning) return; stageRunning = true;
    const frame = (now) => {
      const cv = $('#preview');
      if ($('#screen-creator').hidden || !cv) { stageRunning = false; return; }
      const ctx = paint(cv, avatar, { scale: 0.78, feet: 0.82, t: now / 1000 });
      const look = JSON.stringify(Object.keys(OPT.AVATAR_FIELDS).map((k) => avatar[k])); if (cv.dataset.look !== look) cv.dataset.look = look; // what the stage is drawing (used by tests)
      const w = cv.clientWidth, h = cv.clientHeight, name = ($('#j-name').value.trim() || 'Your name').slice(0, 14);
      ctx.font = `600 ${Math.round(h / 13)}px 'Pixelify Sans', monospace`; ctx.textAlign = 'center';
      const tw = ctx.measureText(name).width + 14;
      ctx.fillStyle = 'rgba(42,26,18,.75)'; ctx.fillRect((w - tw) / 2, h * .87, tw, h / 10);
      ctx.fillStyle = avatar.nameColor || '#ffffff'; ctx.fillText(name, w / 2, h * .87 + h / 13);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  let profile = null;
  const photo = MT_PHOTO_UI((match) => change(match), () => {});
  const sameLook = (a, b) => Object.keys(OPT.AVATAR_FIELDS).every((k) => (a[k] == null ? null : a[k]) === (b[k] == null ? null : b[k]));
  function change(next) { avatar = { ...avatar, ...next }; buildPicker(); }
  function buildPicker() {
    if (!creatorMode) return;
    MT_CREATOR.render({ avatar, profile, paint, theme: view && view.theme, tab: creatorTab,
      setTab: (id) => { creatorTab = id; buildPicker(); }, change,
      buy: (itemId) => socket.emit('profile:buy', { itemId }, (r) => { if (r && r.ok) { profile = r.profile; buildPicker(); } else abilityReply(r); }) });
    const dirty = !sameLook(avatar, savedAvatar);
    $('#c-dirty').hidden = !dirty; $('#c-revert').disabled = !dirty;
  }
  $('#random-character').addEventListener('click', () => change(MT_CREATOR.randomize(profile)));
  $('#c-revert').addEventListener('click', () => { avatar = { ...savedAvatar }; buildPicker(); });
  $('#c-back').addEventListener('click', () => {
    if (creatorMode === 'edit') { editing = false; creatorMode = null; lastKey = ''; show('#screen-game'); render(); } else showJoin();
  });
  // Saving: this device keeps the look, and the server profile keeps it for rejoining.
  function commitLook() { savedAvatar = { ...avatar }; save('mt.avatar', savedAvatar); buildPicker(); }
  $('#c-save').addEventListener('click', () => {
    if (!profileReady) return;
    commitLook();
    socket.emit('profile:avatar', { avatar: savedAvatar }, (r) => { if (r && r.ok) profile = r.profile; $('#c-err').textContent = r && r.ok ? '' : (r && r.error) || 'Could not save.'; });
  });

  // ---------- your house ----------
  // Claiming (where you live) applies immediately; the design is a draft until Save.
  // ---------- end-of-game reward scene ----------
  // Plays once per game automatically (remembered on this phone); replay from the results card.
  function showReward(force) {
    if (!view || view.phase !== 'gameover' || !view.reward) return;
    let seen = null; try { seen = localStorage.getItem(key('mt.rewardSeen')); } catch { /* private mode */ }
    if (!force && seen === view.reward.gameId) return;
    try { localStorage.setItem(key('mt.rewardSeen'), view.reward.gameId); } catch { /* private mode */ }
    MT_REWARD.show(view.reward, { avatar: view.you.avatar, theme: view.theme, onClose: () => { if (view.progression) profile = view.progression; updatePouch(); } });
  }

  // ---------- move-in requests (setup only) ----------
  const secsLeft = (at) => Math.max(0, Math.ceil((at - (Date.now() + clockOffset)) / 1000));
  // The owner's yes/no card, shown on top of any lobby screen with a 20s countdown.
  function renderMoveAsk() {
    const box = $('#move-ask'), ask = view && view.phase === 'lobby' && (view.moveAsks || []).find((a) => secsLeft(a.expiresAt) > 0);
    if (!ask) { box.hidden = true; box.dataset.from = ''; return; }
    const s = secsLeft(ask.expiresAt);
    if (box.dataset.from !== ask.fromId) {
      box.dataset.from = ask.fromId;
      box.innerHTML = `<p class="move-ask-title">🏠 <b>${esc(ask.fromName)}</b> wants to move in with you!</p>
        <p class="small">You'll share your house and sign on the big screen. It doesn't change the game.</p>
        <div class="move-timer"><i></i></div><p class="small" data-secs></p>
        <div class="move-buttons"><button class="btn" data-move-yes>Yes, move in</button><button class="btn ghost" data-move-no>No thanks</button></div>`;
      const answer = (accept) => socket.emit('player:moveReply', { fromId: ask.fromId, accept }, () => {});
      box.querySelector('[data-move-yes]').onclick = () => answer(true);
      box.querySelector('[data-move-no]').onclick = () => answer(false);
      if (navigator.vibrate) navigator.vibrate(60);
    }
    box.hidden = false;
    box.querySelector('[data-secs]').textContent = `${s}s to answer`;
    box.querySelector('.move-timer i').style.width = `${Math.min(100, (s / 20) * 100)}%`;
  }
  // The asker's status: waiting (with countdown + cancel), or the answer for a few seconds.
  function moveStatusText() {
    const st = view && view.you && view.you.moveStatus; if (!st) return null;
    const recent = Date.now() + clockOffset - st.at < 8000;
    if (st.state === 'pending' && secsLeft(st.expiresAt) > 0) return { text: `⏳ Asked ${st.toName} to move in… ${secsLeft(st.expiresAt)}s`, pending: true };
    if (!recent) return null;
    const text = { accepted: `🎉 ${st.toName} said yes! You live together now.`, declined: st.reason ? `${st.toName} said yes, but: ${st.reason}` : `${st.toName} said no thanks.`, expired: `${st.toName} didn't answer in time.`, cancelled: 'Request cancelled.' }[st.state];
    return text ? { text } : null;
  }
  function renderMoveStatus() {
    const el = $('#h-move-status'); if (!el) return;
    const st = moveStatusText();
    el.hidden = !st; if (!st) return;
    if (el.dataset.text !== st.text) { el.dataset.text = st.text; el.innerHTML = `<span>${esc(st.text)}</span>${st.pending ? '<button class="btn ghost small" data-move-cancel>Cancel</button>' : ''}`; const c = el.querySelector('[data-move-cancel]'); if (c) c.onclick = () => socket.emit('player:home', { claim: { cancel: true } }, () => {}); }
  }
  setInterval(() => { if (view) { renderMoveAsk(); renderMoveStatus(); } }, 250);

  function homeStatus() {
    if (!view || !view.you) return '';
    const host = view.you.livesWith && byId(view.you.livesWith);
    if (host) return `Staying at ${host.name}'s house (plot ${host.house + 1})`;
    const st = view.you.moveStatus;
    if (st && st.state === 'pending' && secsLeft(st.expiresAt) > 0) return `Asked ${st.toName} to move in… waiting for an answer`;
    const guests = view.players.filter((p) => p.livesWith === view.you.id).map((p) => p.name);
    return `Your own house · plot ${view.you.house + 1}${guests.length ? ' · with ' + guests.join(', ') : ''}`;
  }
  function openHome(mode = 'edit') {
    if (!view || view.phase !== 'lobby') return;
    homeMode = mode;
    savedHome = { ...savedHome, ...(view.you.homeLook || {}) }; home = { ...savedHome };
    $('#h-title').textContent = mode === 'claim' ? 'Claim your house' : 'Your house';
    $('#h-save').textContent = mode === 'claim' ? 'Move in!' : 'Save house';
    $('#h-err').textContent = ''; $('#h-claim-err').textContent = '';
    show('#screen-home'); buildHome();
  }
  function buildHome() {
    if (!homeMode || !view) return;
    MT_CREATOR.renderHome({ look: home, profile, theme: view.theme, tab: homeTab, setTab: (id) => { homeTab = id; buildHome(); }, change: (next) => { home = { ...home, ...next }; buildHome(); } });
    const dirty = Object.keys(OPT.HOME_FIELDS).some((k) => home[k] !== savedHome[k]);
    $('#h-dirty').hidden = !dirty; $('#h-revert').disabled = !dirty;
    const guest = view.you.livesWith && byId(view.you.livesWith);
    $('#h-where').textContent = guest ? `You're staying at ${guest.name}'s house. Your own design is saved for when you live in your own house.` : homeStatus();
    // Where you live: your own plot, an empty plot, or moving in with an owner who has room.
    const owners = view.players.filter((p) => !p.livesWith && p.id !== view.you.id);
    const count = (id) => view.players.filter((p) => p.livesWith === id).length + 1;
    const asking = (id) => { const st = view.you.moveStatus; return !!st && st.state === 'pending' && st.toId === id && secsLeft(st.expiresAt) > 0; };
    const opts = [{ key: 'own', label: `🏠 My own house · plot ${view.you.house + 1}`, sel: !view.you.livesWith, claim: { own: true } }]
      .concat((view.freePlots || []).slice(0, 4).map((n) => ({ key: 'plot' + n, label: `📍 Move to empty plot ${n + 1}`, sel: false, claim: { plot: n } })))
      .concat(owners.map((o) => ({ key: 'with' + o.id, label: `🤝 ${view.you.livesWith === o.id ? 'Living with' : asking(o.id) ? 'Asked' : 'Ask to live with'} ${o.name} · plot ${o.house + 1} (${count(o.id)}/${OPT.MAX_RESIDENTS})`, sel: view.you.livesWith === o.id || asking(o.id), full: count(o.id) >= OPT.MAX_RESIDENTS && view.you.livesWith !== o.id, claim: { with: o.id } })));
    $('#h-claims').innerHTML = opts.map((o, i) => `<button class="claim${o.sel ? ' sel' : ''}" data-claim="${i}" aria-pressed="${o.sel}" ${o.full ? 'disabled' : ''}>${esc(o.label)}${o.full ? ' · full' : ''}</button>`).join('');
    $('#h-claims').querySelectorAll('[data-claim]').forEach((b) => { b.onclick = () => {
      socket.emit('player:home', { claim: opts[+b.dataset.claim].claim }, (r) => { $('#h-claim-err').textContent = r && r.ok ? '' : (r && r.error) || 'Could not move.'; });
    }; });
  }
  // The house preview shows your design with its sign (you + anyone staying with you).
  let houseStageRunning = false;
  function startHouseStage() {
    if (houseStageRunning) return; houseStageRunning = true;
    const frame = (now) => {
      const cv = $('#h-preview');
      if ($('#screen-home').hidden || !cv || !window.MT_WORLD || !view) { houseStageRunning = false; return; }
      const dpr = Math.min(window.devicePixelRatio || 1, 3), w = cv.clientWidth || 300, h = cv.clientHeight || 220;
      if (cv.width !== Math.round(w * dpr)) { cv.width = w * dpr; cv.height = h * dpr; }
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.imageSmoothingEnabled = false;
      const T = window.MT_THEMES, pal = (T.THEMES[view.theme] || T.THEMES.smalltown).palette, s = h / 150;
      ctx.fillStyle = pal.grass; ctx.fillRect(0, 0, w, h); ctx.fillStyle = pal.grassDark; ctx.fillRect(0, h * .8, w, h * .2);
      ctx.fillStyle = pal.road; ctx.fillRect(w * .3, h * .86, w * .4, h * .14);
      MT_WORLD.building(ctx, w * .42, h * .82, Math.max(0, OPT.houseStyle.indexOf(home.style)), pal, { ...MT_WORLD.lookOptions(home), scale: s, theme: view.theme, lit: true, time: now / 1000 });
      const me = { name: view.you.name, house: view.you.house }, guests = view.players.filter((p) => p.livesWith === view.you.id);
      MT_WORLD.sign(ctx, w * .42 + 62 * s, h * .82 + 4 * s, s, MT_WORLD.signLines(me, [me, ...guests]), ['#2a1a12', '#5a3a22']);
      const look = JSON.stringify(Object.keys(OPT.HOME_FIELDS).map((k) => home[k])); if (cv.dataset.look !== look) cv.dataset.look = look; // for tests
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  $('#h-revert').addEventListener('click', () => { home = { ...savedHome }; buildHome(); });
  $('#h-back').addEventListener('click', () => { lastKey = ''; show('#screen-game'); render(); });
  $('#h-save').addEventListener('click', () => {
    savedHome = { ...home }; save('mt.home', savedHome);
    socket.emit('player:home', { look: savedHome }, (r) => {
      if (!r || !r.ok) return void ($('#h-err').textContent = (r && r.error) || 'Could not save.');
      lastKey = ''; show('#screen-game'); render();
    });
  });

  // ---------- shop, gold pouch, inventory ----------
  // The server owns gold and ownership; the shop screen shows them and sends requests.
  let shopReturn = '#screen-game';
  function shopLook() { return view && view.you && view.phase === 'lobby' ? { avatar: view.you.avatar, home: view.you.homeLook || savedHome } : { avatar: savedAvatar, home: savedHome }; }
  function renderShop() {
    if ($('#screen-shop').hidden) return;
    const look = shopLook();
    MT_SHOP.render({ profile, avatar: look.avatar, home: look.home, theme: view && view.theme,
      buy: (itemId, cb) => socket.emit('profile:buy', { itemId }, (r) => { if (r && r.ok) { profile = r.profile; updatePouch(); } cb(r); }),
      buyPass: (cb) => socket.emit('profile:buyPass', {}, (r) => { if (r && r.ok) { profile = r.profile; updatePouch(); } cb(r); }),
      fateBuy: (card, cb) => socket.emit('profile:fateBuy', { card }, (r) => { if (r && r.ok) { profile = r.profile; updatePouch(); } cb(r); }),
      fateExchange: (cb) => socket.emit('profile:fateExchange', {}, (r) => { if (r && r.ok) { profile = r.profile; updatePouch(); } cb(r); }),
      equip: (itemId, on, cb) => socket.emit('profile:equip', { itemId, on }, (r) => {
        if (r && r.ok) {
          profile = r.profile;
          // Keep this device's saved look in step with what was equipped.
          if (r.target === 'home') { savedHome = { ...savedHome, [r.key]: r.value }; save('mt.home', savedHome); }
          else { savedAvatar = { ...savedAvatar, [r.key]: r.value }; save('mt.avatar', savedAvatar); }
          renderShop(); updatePouch();
        }
        cb(r);
      }) });
  }
  function openShop() {
    if (!profileReady || !lobbyOpen()) return;
    shopReturn = ['#screen-creator', '#screen-game'].find((s) => !$(s).hidden) || '#screen-game';
    MT_SHOP.open(); show('#screen-shop'); $('#s-pouch-pop').hidden = true; renderShop();
  }
  $('#s-back').addEventListener('click', () => { if (shopReturn === '#screen-creator') { avatar = { ...avatar }; show('#screen-creator'); buildPicker(); } else { lastKey = ''; show('#screen-game'); render(); } });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-open-shop]')) openShop(); if (e.target.closest('[data-open-stats]')) openStats(); });
  // ---------- My stats: career, mastery, rivalries, recent games ----------
  function openStats() {
    const c = profile && profile.career;
    let m = $('#stats-modal');
    if (!m) { m = document.createElement('div'); m.id = 'stats-modal'; m.className = 'stats-modal'; document.body.appendChild(m); m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close-stats]')) m.hidden = true; }); }
    const T = window.MT_THEMES, rn = (k) => (ROLES[k] || {}).name || k;
    const pct = (w, g) => (g ? Math.round((w / g) * 100) + '%' : '—');
    const rival = (x, f, label, emoji) => x ? `<li>${emoji} <b>${esc(x.name)}</b> ${label.replace('{n}', x[f])}</li>` : '';
    m.innerHTML = `<div class="stats-card"><button class="stats-x" data-close-stats aria-label="Close">✕</button><h2>📊 My stats</h2>
      ${!c || !c.games ? '<p class="muted">Finish a game to start your career. Every game counts, even practice games with bots.</p>' : `
      <div class="stats-big"><div><b>${c.games}</b><small>games</small></div><div><b>${c.wins}</b><small>wins</small></div><div><b>${pct(c.wins, c.games)}</b><small>win rate</small></div><div><b>${c.survived}</b><small>survived</small></div></div>
      <p class="small">As Town: ${pct((c.teams.town || {}).wins || 0, (c.teams.town || {}).games || 0)} · As Mafia: ${pct((c.teams.mafia || {}).wins || 0, (c.teams.mafia || {}).games || 0)}${(c.teams.neutral || {}).games ? ` · As Neutral: ${pct(c.teams.neutral.wins, c.teams.neutral.games)}` : ''}</p>
      ${c.titles.length ? `<p class="stats-titles">${c.titles.map((t) => `<span>⭐ ${esc(t)}</span>`).join('')}</p>` : ''}
      <h3>🎭 Role mastery</h3><ul class="stats-roles">${c.roles.slice(0, 8).map((r) => `<li><span>${(ROLES[r.role] || {}).emoji || ''} ${esc(rn(r.role))}${r.title ? ` <em>${r.title}</em>` : ''}</span><span>${r.games}G · ${pct(r.wins, r.games)}</span><i style="width:${Math.min(100, r.games / 30 * 100)}%"></i></li>`).join('')}</ul>
      <p class="small muted">5 games as a role: Apprentice · 15: Expert · 30: Master.</p>
      <h3>⚔️ Rivalries</h3><ul class="stats-rivals">${rival(c.rivals.nemesis, 'killedMe', 'took you out {n}×', '😈')}${rival(c.rivals.prey, 'iKilled', 'fell to you {n}×', '🎯')}${rival(c.rivals.critic, 'votedMe', 'voted against you {n}×', '🗳')}</ul>
      ${Object.keys(c.awards).length ? `<h3>🏆 Awards</h3><p class="stats-awards">${Object.entries(c.awards).map(([a, n]) => `<span>${esc(a)} ×${n}</span>`).join('')}</p>` : ''}
      <h3>🕰 Recent games</h3><ul class="stats-history">${c.history.slice(0, 8).map((h) => `<li><span>${h.won ? '🏆' : '·'} ${esc(rn(h.role))}${T && T.THEMES[h.theme] ? ` <small>${T.THEMES[h.theme].emoji}</small>` : ''}</span><span>${h.won ? 'Won' : 'Lost'}${h.alive ? '' : ' · died'}</span></li>`).join('')}</ul>`}
      </div>`;
    m.hidden = false;
  }
  // Gold pouch in the game header: tap for balance, earned, spent and recent entries.
  // Customizing and shopping are lobby-only; during a game the phone is purely the game.
  const lobbyOpen = () => !view || view.phase === 'lobby';
  // While this game's reward is waiting to be shown (or playing), the header pouch keeps
  // the old balance so the coins can fly into it; it updates when the scene closes.
  function rewardHeld() {
    if (!view || view.phase !== 'gameover' || !view.reward || !view.reward.eligible) return false;
    if (!$('#reward-scene').hidden) return true;
    try { return localStorage.getItem(key('mt.rewardSeen')) !== view.reward.gameId; } catch { return false; }
  }
  function updatePouch() {
    const wrap = $('#g-pouch-wrap'); if (!wrap) return;
    const shown = rewardHeld() ? { ...(profile || {}), coins: view.reward.before } : profile;
    wrap.innerHTML = MT_SHOP.pouchButton(shown, 'g-pouch');
    const pouchHtml = () => MT_SHOP.pouchDetails(shown) +(lobbyOpen() ? '<button class="btn ghost" data-open-shop>🛒 Visit the shop</button>' : '<p class="small muted" data-shop-closed>The shop opens between games, back in the lobby.</p>');
    $('#g-pouch').onclick = () => { const pop = $('#g-pouch-pop'); pop.hidden = !pop.hidden; pop.innerHTML = pouchHtml(); };
    if (!$('#g-pouch-pop').hidden) $('#g-pouch-pop').innerHTML = pouchHtml();
    MT_SHOP.paintPouches();
  }

  // ---------- join ----------
  $('#j-go').addEventListener('click', () => {
    if (!profileReady) return;
    const name = $('#j-name').value.trim();
    if (editing) {
      commitLook();
      socket.emit('player:profile', { name, avatar: savedAvatar });
      editing = false; creatorMode = null;
      lastKey = '';
      show('#screen-game');
      render();
      return;
    }
    if (!name) return void ($('#c-err').textContent = 'Enter your name.');
    commitLook();
    doJoin($('#j-code').value, name);
  });
  // Quick join: just a name. A first-time phone gets a random look; the house is assigned
  // automatically (no claim step). Everything can be changed later in the lobby.
  $('#q-go').addEventListener('click', () => {
    if (!profileReady) return;
    const name = $('#q-name').value.trim();
    if (!name) return void ($('#c-err').textContent = 'Type your name first.');
    if (!load('mt.avatar') && !(profile && profile.lookSaved)) avatar = { ...avatar, ...MT_CREATOR.randomize(profile) };
    commitLook();
    doJoin($('#j-code').value, name, { quick: true });
  });
  function doJoin(rawCode, name, opts = {}) {
    const code = String(rawCode || '').trim().toUpperCase(), err = (t) => { $(creatorMode ? '#c-err' : '#j-err').textContent = t; };
    if (code.length !== 4) return err('Enter the 4-letter room code from the big screen.');
    save('mt.name', name);
    $('#j-go').disabled = true;
    const fromCreator = !!creatorMode;
    socket.emit('player:join', { code, name, avatar: savedAvatar, home: savedHome }, (r) => {
      $('#j-go').disabled = false;
      if (!r || !r.ok) return err((r && r.error) || 'Could not join.');
      session = { code: r.code, token: r.token };
      save('mt.player', session);
      creatorMode = null;
      keepAwake();
      show('#screen-game');
      lastKey = '';
      // Joining from the creator continues to claiming a house (skipped by /test auto-join).
      if (fromCreator && !opts.quick) pendingClaim = true;
      render();
    });
  }
  $('#j-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });

  // ---------- connection ----------
  socket.on('profile:state', (p) => { profile = p; if (!$('#screen-creator').hidden) buildPicker(); renderShop(); updatePouch(); });
  socket.on('connect', () => {
    const creds = load('mt.profile');
    const ready = (r) => {
      if (!r || !r.ok) { $('#j-err').textContent = 'Profile connection failed. Reload to reconnect.'; return; }
      profile = r.profile; profileReady = true; $('#j-go').disabled = false;
      if (r.token) save('mt.profile',{ id:r.id,token:r.token });
      // No look saved on this device yet, but the profile has one: restore it.
      if (!load('mt.avatar') && profile && profile.lookSaved && profile.avatar) { savedAvatar = { ...savedAvatar, ...profile.avatar }; if (!creatorMode) avatar = { ...savedAvatar }; }
      if (!load('mt.home') && profile && profile.home && Object.keys(profile.home).length) { savedHome = { ...savedHome, ...profile.home }; if (!homeMode) home = { ...savedHome }; }
      if (!$('#screen-creator').hidden) buildPicker();
      updatePouch();
      if (!$('#screen-join').hidden) tryAutoJoin();
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
    if (document.documentElement.dataset.theme !== v.theme) document.documentElement.dataset.theme = v.theme || ''; // themed menus (CSS)
    const phaseChanged = prevPhase !== v.phase;
    if (phaseChanged) {
      abilityDraft = {};
      if (v.phase === 'roleReveal' || v.phase === 'lobby') roleShown = false;
      if ((v.phase === 'night' && v.action) || (v.phase === 'voting' && v.voting)) buzz();
      prevPhase = v.phase;
    }
    // Haptics: you died (a long double pulse); something happened to you overnight (a tap).
    if (navigator.vibrate && view && view.you && v.you) {
      if (view.you.alive && v.you.alive === false) navigator.vibrate([300, 120, 300]);
      else if ((v.notes || []).length > (view.notes || []).length) navigator.vibrate(120);
    }
    view = v;
    if (window.MT_CREATOR) MT_CREATOR.setParty(!!v.party);
    if (editing && v.phase !== 'lobby') { editing = false; creatorMode = null; show('#screen-game'); }
    if (pendingClaim && v.phase === 'lobby' && !v.isJudge && !$('#screen-game').hidden) { pendingClaim = false; openHome('claim'); }
    if (!$('#screen-home').hidden) { if (v.phase !== 'lobby') show('#screen-game'); else buildHome(); }
    renderMoveAsk(); renderMoveStatus();
    if (v.phase === 'gameover' && v.reward) setTimeout(() => showReward(false), 2500); // after the results settle
    if (v.phase !== 'gameover' && !$('#reward-scene').hidden) $('#reward-scene').hidden = true;
    // The game started: close the shop and switch to the game, and refresh the pouch menu.
    if (v.phase !== 'lobby' && !$('#screen-shop').hidden) { lastKey = ''; show('#screen-game'); }
    if (phaseChanged) updatePouch();
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

  // Live reactions: one small round button in the corner; tap it for a row of six emojis.
  // Hidden in the lobby and at night so it never gets in the way of the game.
  function renderReactFab() {
    let fab = $('#react-fab');
    if (!fab) {
      fab = document.createElement('div'); fab.id = 'react-fab'; fab.className = 'react-fab';
      fab.innerHTML = '<div class="react-row" hidden></div><button class="react-btn" aria-label="React">😀</button>';
      document.body.appendChild(fab);
      fab.querySelector('.react-btn').onclick = () => { const row = fab.querySelector('.react-row'); row.hidden = !row.hidden; };
    }
    const on = view && !view.you.spectator && ['dawn', 'morning', 'discussion', 'voting', 'verdict', 'execution', 'accusation', 'defense', 'gameover'].includes(view.phase) && !$('#screen-game').hidden;
    fab.hidden = !on; if (!on) { fab.querySelector('.react-row').hidden = true; return; }
    const O = window.MT_OPTIONS, packs = O.REACTION_PACKS, pack = packs[(view.you.avatar || {}).reactions] || packs.rxClassic;
    const row = fab.querySelector('.react-row'), key = pack.join('');
    if (row.dataset.key !== key) {
      row.dataset.key = key;
      row.innerHTML = pack.map((e) => `<button data-react="${e}">${e}</button>`).join('');
      row.querySelectorAll('[data-react]').forEach((b) => b.onclick = () => {
        socket.emit('player:react', { emoji: b.dataset.react }, (r) => { if (r && r.ok) { b.classList.remove('sent'); void b.offsetWidth; b.classList.add('sent'); if (navigator.vibrate) navigator.vibrate(15); } });
        setTimeout(() => { row.hidden = true; }, 350);
      });
    }
  }

  function render() {
    if (!view) return;
    const key = JSON.stringify({ ...view, serverNow: 0, endsAt: 0, remainingMs: 0, roleShown });
    if (key === lastKey) return;
    lastKey = key;

    $('#g-name').textContent = view.you.name;
    if (!$('#g-pouch')) updatePouch();
    $('#g-name').style.color = view.you.avatar.nameColor || '#ffffff';
    $('#g-phase').textContent = (PHASE_LABEL[view.phase] || '').replace('{d}', view.day) + (view.you.alive || view.phase === 'lobby' ? '' : ' · 👻');
    paint($('#me'), view.you.avatar, { ghost: !view.you.alive && view.phase !== 'lobby' && !view.you.spectator });
    updateTimer();

    const body = $('#g-body');
    renderHelp();
    // Role draft (vote on the cards, then flip your dealt card) owns the screen while it runs.
    draftPhone = draftPhone || (window.MT_DRAFT && MT_DRAFT.Phone());
    if (draftPhone && draftPhone.render(body, view, {
      socket, clockOffset: () => clockOffset, mine: () => (view.draft && view.draft.mine) || [],
      toast: (m) => alert(m), extrasHtml: () => roleExtras(),
    })) { renderSettings(); return; }
    const focus = document.activeElement && document.activeElement.dataset.draft;
    const caret = focus ? document.activeElement.selectionStart : null;
    body.innerHTML = bodyHtml();
    wire(body);
    renderSettings();
    renderAbility();
    renderPrivateScene();
    if (view.progression) { profile = view.progression; updatePouch(); }
    MT_STORY_UI(view, socket, $('#g-body'), { esc, paint, reply: abilityReply, votingHtml });
    renderReactFab();
    if (focus) { const input = [...body.querySelectorAll('[data-draft]')].find((el) => el.dataset.draft === focus); if (input) { input.focus(); if (caret != null) input.setSelectionRange(caret,caret); } }
  }

  // ---------- new player help (Judge setting; on by default) ----------
  let tipsSeen = load('mt.tips') || [], tipTimer = null, roleHelpOpen = false;
  function renderHelp() {
    const on = !!(view && view.help);
    $('#g-help').hidden = !on;
    // What to do right now (from this phone's own view only).
    const h = on && window.MT_HELP && MT_HELP.phoneHint(view);
    $('#g-hint').hidden = !h;
    if (h) $('#g-hint').innerHTML = `<span class="hint-icon">${h.icon}</span><span>${esc(h.text)}</span>`;
    // A one-time tip the first time something new happens on this device.
    const tip = on && $('#g-tip').hidden && MT_HELP.nextTip(view, tipsSeen);
    if (tip) {
      tipsSeen = tipsSeen.concat(tip.id); save('mt.tips', tipsSeen);
      $('#g-tip').innerHTML = `<p>💡 ${esc(tip.text)}</p><button class="btn small" data-tip-ok>Got it</button>`;
      $('#g-tip').hidden = false;
      const close = () => { $('#g-tip').hidden = true; clearTimeout(tipTimer); };
      $('#g-tip').querySelector('[data-tip-ok]').onclick = close;
      clearTimeout(tipTimer); tipTimer = setTimeout(close, 14000);
    }
    if (!on) { $('#g-tip').hidden = true; $('#howto').hidden = true; }
  }
  $('#g-help').addEventListener('click', () => {
    if (!view) return;
    $('#howto').innerHTML = MT_HELP.howToHtml(view, roleLabel);
    $('#howto').hidden = false;
    $('#howto').querySelectorAll('[data-howto-close]').forEach((b) => b.addEventListener('click', () => { $('#howto').hidden = true; }));
  });
  $('#howto').addEventListener('click', (e) => { if (e.target.id === 'howto') $('#howto').hidden = true; });

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
      card.querySelector('[data-private-result]').textContent = t < 5.6 ? sc.scene === 'planting' ? 'Preparing the fuse…' : 'Observing…' : sc.scene === 'planting' ? 'Fuse planted. The server tracks the delay.' : !result ? 'Observation complete.' : result.reveal === 'role' && result.options ? result.options.map((k) => (ROLES[k] || {}).name || k).join(' or ') : result.reveal === 'role' && ROLES[result.result] ? ROLES[result.result].name : result.blocked ? 'Your investigation was blocked.' : result.clue || (result.result ? (result.reveal === 'killedTonight' ? 'They killed last night' : 'Mafia') : (result.reveal === 'killedTonight' ? 'They stayed clean' : 'Not Mafia'));
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
        <p data-home-status>🏠 ${esc(homeStatus())}</p>
      </div>
      <div class="cas-bar lobby-actions"><button class="btn ghost" data-edit>Change my look</button><button class="btn ghost" data-house>Your house</button></div>
      <div class="cas-bar lobby-actions"><button class="btn" data-open-shop>🛒 Shop</button><button class="btn ghost" data-open-stats>📊 My stats</button></div>`;
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
        return `${narr}${verdictHtml()}${roleCard()}`;
      case 'execution':
        return `${narr}<div class="card center"><div class="big-emoji">⚖️</div><h2>The verdict</h2><p class="muted">Eyes on the big screen…</p></div>${roleCard()}`;
      default:
        return narr + roleCard();
    }
  }

  // Verdict window: only this phone's own options (the server decides what each player may do).
  function verdictHtml() {
    const o = view.verdict;
    if (!o) return `<div class="card center"><div class="big-emoji">⚖️</div><h2>The verdict</h2><p class="muted">Eyes on the big screen…</p></div>`;
    if (o.isCondemned) {
      const lw = o.lastWords, ch = lw && lw.chosen;
      return `<div class="card center verdict-card"><div class="big-emoji">🪢</div><h2>The town has chosen you.</h2><p class="muted">You're being taken to the gallows.</p>
        ${lw ? `<div class="last-words"><p><b>Last words</b> (shown after the scene, if you die). Pick a name and/or a word:</p>
          <div class="lw-row">${lw.names.map((n) => `<button class="chip${ch && ch.nameId === n.id ? ' sel' : ''}" data-lw-name="${esc(n.id)}">${esc(n.name)}</button>`).join('')}</div>
          <div class="lw-row">${lw.words.map((w) => `<button class="chip${ch && ch.word === w ? ' sel' : ''}" data-lw-word="${esc(w)}">${esc(w)}</button>`).join('')}</div>
          ${ch ? `<p class="lw-chosen">“${esc([ch.name, ch.word].filter(Boolean).join(' … '))}”</p>` : ''}</div>` : ''}</div>`;
    }
    const sel = (k) => o.chose === k ? ' sel' : '';
    return `<div class="card center verdict-card"><div class="big-emoji">⚖️</div><h2>${esc(o.condemnedName)} is condemned</h2>
      <p class="muted">The crowd is gathering at the gallows…</p>
      ${o.canInterrupt ? `<button class="btn${sel('interrupt')}" data-intervene="interrupt">🛑 Interrupt the execution <small>(secretly, once per game)</small></button>` : ''}
      ${o.canProtect ? `<button class="btn${sel('protect')}" data-intervene="protect">🛡 Take their place <small>(you die instead, once per game)</small></button>` : ''}
      ${o.canSacrifice ? `<button class="btn${sel('sacrifice')}" data-intervene="sacrifice">🪓 Reveal yourself as the Executioner <small>(die in their place; everyone will see, once per game)</small></button>` : ''}
      ${o.chose ? '<button class="btn ghost" data-intervene="cancel">Change my mind</button>' : ''}
      ${o.canDefend ? `<button class="btn ghost${o.defended ? ' sel' : ''}" data-intervene="${o.defended ? 'cancel' : 'defend'}">${o.defended ? '🙅 You are defending them (tap to stop)' : '🙅 Defend them <small>(everyone will see you try)</small>'}</button>` : ''}
    </div>`;
  }

  function roleExtras() {
    const v = view;
    let html = '';
    if (v.teammates) {
      html += `<div class="extra"><b>Your team:</b> ${v.teammates.length ? v.teammates.map((t) => `${esc(t.name)}${ROLES[t.role] && t.role !== 'mafia' ? ` (${esc(roleLabel(t.role))})` : ''}${t.alive ? '' : ' 👻'}`).join(', ') : 'Just you. Good luck!'}</div>`;
    }
    if (v.investigations && v.investigations.length) {
      html += `<div class="extra"><b>Your notebook</b><ul class="list">${v.investigations.map((i) => `<li><span>Night ${i.night}: ${esc(i.name)}</span>${verdictTag(i)}</li>`).join('')}</ul></div>`;
    }
    if (v.role === 'vigilante') html += `<div class="extra">🎯 Bullets left: <b>${v.shotsLeft}</b></div>`;
    if (v.telepath && v.telepath.partner) html += `<div class="extra">🔮 Your fellow Telepath: <b>${esc(v.telepath.partner.name)}</b>${v.telepath.partner.alive ? '' : ' 👻'}</div>`;
    // New player help: what this role does, when, and how it wins (from the role bank).
    if (v.help && v.role && window.MT_HELP) html += MT_HELP.roleHelpHtml(v.role).replace('<details class="role-help">', `<details class="role-help"${roleHelpOpen ? ' open' : ''}>`);
    return html;
  }

  function roleCard(big) {
    const r = ROLES[view.role];
    if (!r) return '';
    const shown = roleShown;
    return `<div class="rolecard ${view.role} ${shown ? 'show' : ''}${big ? ' rc-big' : ''}" data-role style="--rc:${r.color}">
      <div class="rc-hidden">🔒 Tap to reveal your role</div>
      <div class="rc-shown">
        <div class="big-emoji">${r.emoji}</div>
        <div class="rc-name">${esc(roleLabel(view.role))}</div>
        <div class="rc-blurb">${esc(view.roleBlurb || r.blurb)}</div>
        ${roleExtras()}
        <div class="small" style="margin-top:8px;opacity:.8">Tap to hide</div>
      </div>
    </div>`;
  }

  function verdictTag(i, big) {
    const st = big ? ' style="font-size:20px"' : '';
    if (i.blocked) return `<span class="tag"${st}>Blocked</span>`;
    if (i.reveal === 'role' && i.options && i.options.every((k) => ROLES[k])) return `<span class="tag"${st}>${i.options.map((k) => esc(ROLES[k].name)).join(' or ')}</span>`;
    if (i.reveal === 'role' && ROLES[i.result]) return `<span class="tag">${esc(ROLES[i.result].name)}</span>`;
    if (i.reveal === 'killedTonight') return `<span class="tag ${i.result ? 'bad' : 'good'}"${st}>${i.result ? 'KILLED last night' : 'Stayed clean'}</span>`;
    if (i.clue) return `<span class="tag"${st}>${esc(i.clue)}</span>`;
    const word = i.result ? 'MAFIA' : 'NOT Mafia';
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
      seance: ['🕯 Whose spirit will you call?', 'You’ll learn the exact role of one fallen player.'],
      watch: ['👀 Who will you watch?', 'At dawn you’ll learn everyone who visited them with an ability.'],
      alert: ['🎖 Go on alert tonight?', 'Attacks on you fail, and anyone who visits you dies. Tap yourself to stand guard, or hold fire.'],
      trap: ['🪤 Where will you set your trap?', 'It protects that house tonight, and you’ll learn who attacks it.'],
      link: ['💘 Who will you bind yourself to?', 'Once per game. If either of you dies, the other dies of a broken heart.'],
      frame: ['🖼 Who will you frame?', 'Tonight, every investigation sees them as Mafia.'],
      clean: ['🧹 Clean up after tonight’s kill?', 'Once per game: if this player dies tonight, their role stays hidden and only you learn it.'],
      mark: ['🎯 Who do you want dead?', 'Mark them. If they die tonight or at the gallows, you level up. The Mafia will see your mark as a vote from one of their own.'],
      investigate: [v.role === 'hunter' ? '🏹 Who will you hunt?' : '🔍 Who will you investigate?', v.role === 'hunter' ? "You'll learn their exact role, and so will your whole family." : v.role === 'sorcerer' ? "You'll see two roles: one of them is theirs." : v.action && v.action.reveal === 'role' ? "You'll learn their exact role." : v.role === 'sheriff' ? "You'll learn whether they went out killing tonight." : "You'll learn if they're Mafia."],
      heal: ['💉 Who will you protect?', last || 'You can protect yourself.'],
      guard: ['🛡️ Who will you guard?', last || 'If they are attacked, you die in their place.'],
      shoot: ['🎯 Shoot someone?', `${v.shotsLeft} bullet${v.shotsLeft === 1 ? '' : 's'} left. Only shoot if you're sure.`],
      dummy: ['🤔 Who do you suspect?', 'Pick whoever seems most suspicious.'],
      craft: ['🔨 Whose house will you visit?', 'Using a Pickaxe? Pick it in your workshop below. Otherwise tap anyone to blend in.'],
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
    const voteKey = `${v.day}:${(v.nomination || {}).targetId || ''}`;
    if (voteErrPhase !== voteKey) { voteErrPhase = voteKey; voteErr = ''; }
    const buttons = vt.targets.map((id) => byId(id)).filter(Boolean).map((p) => targetButton(p, vt.choice === p.id, 'data-vote')).join('');
    return `<div class="card${v.paused ? ' is-paused' : ''}">
      <div class="prompt">🗳️ Vote to eliminate</div>
      <p class="muted small">${vt.voted}/${vt.total} have voted. You can change your vote until ${v.manualVoting ? 'the Judge closes voting' : 'time runs out'}.</p>
      ${v.paused ? '<p class="err small">⏸ The game is paused. Voting opens again when it resumes.</p>' : ''}
      <p class="err small" data-vote-err>${esc(voteErr)}</p>
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
      <p class="muted">No more hints to the living! But you can still haunt them for fun.</p>
      ${r ? `<p class="small">You were ${r.emoji} <b>${esc(roleLabel(v.role))}</b></p>` : ''}
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
      .map((p) => { const r = ROLES[p.role] || {}; return `<li><span>${p.won ? '🏆 ' : ''}${esc(p.name)}${p.alive ? '' : ' 👻'}</span><span class="tag" style="background:${r.color};color:${r.darkText ? '#2a2200' : '#fff'}">${r.emoji || ''} ${esc(p.role ? roleLabel(p.role) : '?')}</span></li>`; })
      .join('');
    const W = RR.WINNERS[v.winner] || RR.WINNERS.draw;
    return `<div class="card center">
      <div class="big-emoji">${W.emoji}</div>
      <div class="result ${won ? 'win' : 'lose'}">${won ? 'You won!' : 'You lost'}</div>
      <p>${v.winner === 'draw' ? "It's a draw." : `${esc(v.winner === 'mafia' ? MT_THEMES.teamName(v.theme, 'mafia', W.name) : W.name)} wins.`}</p>
      <p class="muted small">Waiting for the host to start another round…</p>
      ${v.reward ? `<button class="btn" data-reward-replay>🪙 ${v.reward.eligible ? `See my reward (+${v.reward.coins} gold)` : 'Why no gold this time?'}</button>` : ''}
    </div>
    ${v.credits && v.credits.awards.some((a) => a.id === v.you.id) ? `<div class="card center unlock-phone"><h3>🏆 Your awards</h3><p class="ul-roles">${v.credits.awards.filter((a) => a.id === v.you.id).map((a, i) => `<span class="ul-role" style="animation-delay:${(0.4 + i * 0.5).toFixed(1)}s">${a.emoji} <b>${esc(a.label)}</b> <small>${esc(a.detail)}</small></span>`).join('')}</p><p class="small muted">Watch the credits on the big screen.</p></div>` : ''}
    ${v.reward && v.reward.stock && v.reward.stock.length ? `<div class="card center unlock-phone"><h3>🛒 New in the shop!</h3><p class="ul-roles">${v.reward.stock.map((id, i) => `<span class="ul-role" style="animation-delay:${(0.6 + i * 0.5).toFixed(1)}s">${esc((MT_COSMETICS.CATALOG.find((x) => x.id === id) || {}).name || id)}</span>`).join('')}</p><p class="small muted">The shopkeeper just put ${v.reward.stock.length === 1 ? 'it' : 'them'} on the shelves. Spend your gold in the 🛒 shop.</p></div>` : ''}
    ${v.reward && v.reward.world && v.reward.world.items.length ? `<div class="card center unlock-phone"><h3>🗺 New gear from ${esc(v.reward.world.name)}!</h3><p class="ul-roles">${v.reward.world.items.map((id, i) => `<span class="ul-role" style="animation-delay:${(0.6 + i * 0.5).toFixed(1)}s">${esc((MT_COSMETICS.CATALOG.find((x) => x.id === id) || {}).name || id)}</span>`).join('')}</p><p class="small muted">It’s in your inventory. Open the 🛒 shop → 🗺 Worlds to see what else this world hides.</p></div>` : ''}
    ${v.unlock ? `<div class="card center unlock-phone"><h3>✨ Just unlocked</h3><p class="ul-roles">${v.unlock.roles.map((k, i) => `<span class="ul-role" style="animation-delay:${(0.6 + i * 0.5).toFixed(1)}s">${(ROLES[k] || {}).emoji || ''} <b>${esc(roleLabel(k))}</b></span>`).join('')}</p><p class="small muted">New roles join the deck next game (tier ${v.unlock.tier} of ${v.unlock.maxTier}).</p></div>` : ''}
    <div class="card"><h3>Everyone's roles</h3><ul class="list">${rows}</ul></div>`;
  }

  function wire(body) {
    body.querySelectorAll('canvas[data-av]').forEach((cv) => {
      const p = byId(cv.dataset.av);
      if (p) paint(cv, p.avatar);
    });
    const rc = body.querySelector('[data-role]');
    // Tap the role card to reveal it, tap again to hide it.
    if (rc) rc.addEventListener('click', (e) => {
      if (e.target.closest('.role-help')) return;
      roleShown = !roleShown; rc.classList.toggle('show', roleShown); lastKey = '';
      if (roleShown && navigator.vibrate) navigator.vibrate(10);
    });
    // Tapping the role explainer opens it without hiding the card; it stays open across updates.
    body.querySelectorAll('.role-help').forEach((d) => { d.addEventListener('click', (e) => e.stopPropagation()); d.addEventListener('toggle', () => { roleHelpOpen = d.open; }); });
    body.querySelectorAll('[data-night]').forEach((b) => b.addEventListener('click', () => navigator.vibrate && navigator.vibrate(20)));
    body.querySelectorAll('[data-night]').forEach((b) => b.addEventListener('click', () => socket.emit('player:night', { targetId: b.dataset.night, delay: Number((document.querySelector('#bomb-delay') || {}).value) || 3 })));
    body.querySelectorAll('[data-vote]').forEach((b) => b.addEventListener('click', () => socket.timeout(5000).emit('player:vote', { targetId: b.dataset.vote }, (err, r) => {
      voteErr = err ? 'No answer from the game. Check your connection and tap again.' : r && !r.ok ? r.error || 'Vote not counted.' : '';
      const el = document.querySelector('[data-vote-err]'); if (el) el.textContent = voteErr;
    })));
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
    body.querySelectorAll('[data-intervene]').forEach((b) => b.addEventListener('click', () => socket.emit('player:intervene', { kind: b.dataset.intervene }, abilityReply)));
    body.querySelectorAll('[data-lw-name],[data-lw-word]').forEach((b) => b.addEventListener('click', () => {
      const cur = (view.verdict && view.verdict.lastWords && view.verdict.lastWords.chosen) || {};
      const next = b.dataset.lwName ? { nameId: cur.nameId === b.dataset.lwName ? null : b.dataset.lwName, word: cur.word } : { nameId: cur.nameId, word: cur.word === b.dataset.lwWord ? null : b.dataset.lwWord };
      socket.emit('player:lastWords', next, abilityReply);
    }));
    const rb = body.querySelector('[data-reward-replay]');
    if (rb) rb.addEventListener('click', () => showReward(true));
    const hb = body.querySelector('[data-house]');
    if (hb) hb.addEventListener('click', () => openHome());
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
