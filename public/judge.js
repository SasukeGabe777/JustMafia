// Judge console: the private dashboard for whoever runs the game.
// It sees everything (roles, night actions, live votes), so it lives on
// its own page/device, never on the big screen.
(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const RR = window.MT_ROLES;
  const ROLES = RR.ROLES;
  const THEMES = window.MT_THEMES;
  const socket = io();
  let st = null;
  let clockOffset = 0;
  // Tabs: Play, Setup, Players, Scenes, More (the grimoire, test mode and log live under More).
  let tab = ({ grimoire: 'more', test: 'more', log: 'more' })[load('mt.judgeTab')] || load('mt.judgeTab') || 'game';
  if (!['game', 'setup', 'players', 'scenes', 'more'].includes(tab)) tab = 'game';

  function load(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  const nameOf = (id) => (id === 'skip' ? 'Skip' : id === 'pass' ? 'Hold fire' : ((st && st.allPlayers.find((p) => p.id === id)) || {}).name || '—');
  const roleTag = (role) => {
    const r = ROLES[role];
    return r ? `<span class="tag ${r.darkText ? 'dark' : ''}" style="--rc:${r.color}">${r.emoji} ${r.name}</span>` : '<span class="muted">—</span>';
  };

  // ---------- auth ----------
  function credentials() {
    const h = location.hash.replace('#', '');
    if (h.includes('.player.')) { const [code, , token] = h.split('.'); return { code, token }; }
    if (h.includes('.')) { const [code, hostKey] = h.split('.'); return { code, hostKey }; }
    return load('mt.judge') || load('mt.host');
  }
  function connect(creds) {
    socket.emit('judge:attach', creds, (r) => {
      if (r && r.ok) {
        save('mt.judge', creds);
        if (location.hash) history.replaceState(null, '', location.pathname); // don't leave the key in the address bar
        $('#auth').hidden = true; $('#app').hidden = false;
      } else {
        $('#app').hidden = true; $('#auth').hidden = false;
        $('#a-err').textContent = creds ? 'That room is gone or the key is wrong. Create a town on the big screen first.' : '';
      }
    });
  }
  socket.on('connect', () => connect(credentials() || load('mt.judge')));
  socket.on('judge:revoked', () => { st = null; $('#app').hidden = true; $('#auth').hidden = false; $('#a-err').textContent = 'Judge access was revoked. Return to your phone Settings.'; });
  $('#a-go').addEventListener('click', () => connect({ code: $('#a-code').value.trim().toUpperCase(), hostKey: $('#a-key').value.trim() }));

  function act(type, extra = {}, okMsg) {
    socket.emit('host:action', { type, ...extra }, (r) => {
      if (r && r.ok === false && r.error) toast(r.error);
      else if (okMsg) toast(okMsg, true);
    });
  }

  // ---------- tabs ----------
  function showTab(t) {
    tab = t; save('mt.judgeTab', t);
    $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    $$('main[data-panel]').forEach((m) => { m.hidden = m.dataset.panel !== t; });
    render();
  }
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ---------- static setup UI ----------
  $('#s-theme').innerHTML = THEMES.THEME_ORDER.map((k) => `<option value="${k}">${THEMES.THEMES[k].emoji} ${esc(THEMES.THEMES[k].name)}</option>`).join('');
  // Roles grouped into packs (Core, Expansion, DLC 1...); a pack filter keeps the list short.
  const packOf = (k) => (Object.entries(RR.ROLE_PACKS || {}).find(([, p]) => p.roles.includes(k)) || ['core'])[0];
  $('#s-roles').innerHTML = RR.ROLE_ORDER.filter((k) => k !== 'villager').map((k) => {
    const r = ROLES[k];
    const sub = k === 'mafia' ? 'Mafia team' : r.team === 'mafia' ? 'Mafia team' : r.team === 'neutral' ? 'Neutral' : 'Town';
    return `<div class="role" data-pack="${packOf(k)}" style="--rc:${r.color}" title="${esc(r.blurb)}"><span>${r.emoji}</span><span class="nm">${r.name}<small>${sub}</small></span><input type="number" min="0" max="${k === 'telepath' ? 2 : r.max || 50}" step="${k === 'telepath' ? 2 : 1}" data-role="${k}"></div>`;
  }).join('');
  let pack = load('mt.judgePack') || 'core';
  const showPack = (p) => {
    pack = p; save('mt.judgePack', p);
    $$('#s-packs button').forEach((b) => b.classList.toggle('on', b.dataset.pack === p));
    $$('#s-roles .role').forEach((el) => { el.hidden = p !== 'all' && el.dataset.pack !== p; });
  };
  $('#s-packs').innerHTML = Object.entries(RR.ROLE_PACKS || { core: { label: 'Core' } }).map(([k, p]) => `<button class="pack" data-pack="${k}">${esc(p.label)}</button>`).join('') + '<button class="pack" data-pack="all">All</button>';
  $$('#s-packs button').forEach((b) => b.addEventListener('click', () => showPack(b.dataset.pack)));
  showPack(pack);
  $$('[data-role]').forEach((inp) => inp.addEventListener('change', () => {
    const counts = {};
    $$('[data-role]').forEach((i) => { counts[i.dataset.role] = Number(i.value) || 0; });
    act('settings', { settings: { roleCounts: counts } });
  }));

  $$('[data-set]').forEach((el) => el.addEventListener('change', () => {
    const key = el.dataset.set;
    act('settings', { settings: { [key]: el.type === 'checkbox' ? el.checked : el.value } });
  }));
  $$('[data-act]').forEach((b) => b.addEventListener('click', () => act(b.dataset.act, b.dataset.act === 'extend' ? { seconds: 30 } : {})));
  $('#g-pause').addEventListener('click', () => act(st && st.paused ? 'resume' : 'pause'));
  $('#g-lobby').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (st && !['lobby', 'gameover'].includes(st.phase) && !b.dataset.armed) {
      b.dataset.armed = '1'; b.textContent = 'Click again to end the game';
      setTimeout(() => { delete b.dataset.armed; b.textContent = '⟲ Back to lobby'; }, 3000);
      return;
    }
    delete b.dataset.armed; b.textContent = '⟲ Back to lobby';
    act('lobby');
  });

  // Saved setups live in this browser.
  const SAVE_KEYS = ['theme', 'townName', 'narratorStyle', 'narratorMode', 'revealMode', 'minPlayers', 'maxPlayers', 'autoMafia', 'roleCounts', 'vigilanteShots', 'doctorSelfProtect', 'nightSeconds', 'discussionSeconds', 'votingSeconds', 'autoAdvance', 'revealRoleOnDeath', 'allowSkip', 'tieRule', 'majority', 'anonymousVotes', 'mafiaWinAt', 'telepathWhen', 'ghostHaunts', 'botChatter'];
  SAVE_KEYS.push('puppetUses', 'glitchUses', 'harmonyGoal', 'paparazziGoal', 'roleSelection', 'draftSeconds', 'newPlayerHelp', 'draftPool', 'partyMode', 'event');
  SAVE_KEYS.push(...Object.keys(window.MT_CONFIG.DEFAULTS));
  $('#s-save').addEventListener('click', () => {
    const name = $('#s-save-name').value.trim();
    if (!name || !st) return toast('Give the setup a name first.');
    const all = load('mt.judgeSetups') || {};
    all[name] = Object.fromEntries(SAVE_KEYS.map((k) => [k, st.settings[k]]));
    save('mt.judgeSetups', all);
    $('#s-save-name').value = '';
    renderSaved();
    toast(`Saved "${name}"`, true);
  });
  function renderSaved() {
    const all = load('mt.judgeSetups') || {};
    const box = $('#s-saved');
    box.innerHTML = Object.keys(all).map((n) => `<span><button class="btn ghost" data-load="${esc(n)}">📂 ${esc(n)}</button><button class="btn small ghost" data-del="${esc(n)}" title="Delete">✕</button></span>`).join('');
    box.querySelectorAll('[data-load]').forEach((b) => b.addEventListener('click', () => act('settings', { settings: all[b.dataset.load] }, `Loaded "${b.dataset.load}"`)));
    box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { delete all[b.dataset.del]; save('mt.judgeSetups', all); renderSaved(); }));
  }
  renderSaved();

  // ---------- test mode ----------
  $('#t-add').addEventListener('click', () => act('addBots', { count: Number($('#t-n').value) || 1, personality: $('#t-pers').value || undefined }));
  $('#t-remove').addEventListener('click', () => act('removeBots'));
  let simResult = null;
  $('#sim-run').addEventListener('click', () => {
    const b = $('#sim-run');
    const sizes = $('#sim-sizes').value.split(/[^0-9]+/).map(Number).filter((n) => n >= 3 && n <= 100);
    if (!sizes.length) return toast('Enter player counts between 3 and 100.');
    b.disabled = true; b.textContent = '⏳ Running…';
    $('#sim-out').innerHTML = '<p class="muted">Simulating…</p>';
    socket.emit('judge:simulate', { games: Number($('#sim-games').value) || 100, players: sizes, personality: $('#sim-pers').value || undefined }, (r) => {
      b.disabled = false; b.textContent = '▶ Run';
      if (!r || !r.ok) { $('#sim-out').innerHTML = `<p class="err">${esc((r && r.error) || 'Failed')}</p>`; return; }
      simResult = r.result;
      renderSim();
    });
  });

  // ---------- narrator ----------
  $('#g-say-go').addEventListener('click', () => {
    const text = $('#g-say').value.trim();
    if (!text) return;
    act('say', { text }, 'Shown on the big screen');
    $('#g-say').value = '';
  });
  $('#g-say').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#g-say-go').click(); });
  $('#g-skip-narr').addEventListener('click', () => socket.emit('judge:narration', { skip: true }));

  // ---------- role reference ----------
  let disasterConfirmation = null;
  const clearDisaster = () => { disasterConfirmation = null; $('#disaster-confirm').hidden = true; };
  $('#disaster-player').addEventListener('change', clearDisaster);
  $('#disaster-kind').addEventListener('change', clearDisaster);
  $('#disaster-preview').addEventListener('click', () => {
    if (!st) return;
    const request = { type: 'disaster', id: $('#disaster-player').value, disaster: $('#disaster-kind').value, preview: true };
    socket.emit('host:action', request, (r) => {
      if (!r || !r.ok) return toast(r && r.error || 'Preview failed.');
      disasterConfirmation = { id: request.id, disaster: request.disaster, confirmation: r.confirmation };
      $('#disaster-confirm').hidden = false;
      $('#disaster-confirm').textContent = `Confirm ${r.disaster}: eliminate ${r.name}`;
      $('#disaster-status').textContent = `Ready to eliminate ${r.name}. Preview expires in 60 seconds or at the next phase.`;
      const p = st.players.find((p) => p.id === request.id);
      const url = `/preview?scene=${request.disaster}&theme=${encodeURIComponent(st.theme)}&players=${Math.max(4, ...st.players.map((p) => p.house + 1))}&house=${p.house}&autoplay=1`;
      $('#disaster-status').insertAdjacentHTML('beforeend', ` <a href="${url}" target="_blank" rel="noopener">Open scene preview</a>`);
      window.open(url, '_blank', 'noopener');
    });
  });
  $('#disaster-confirm').addEventListener('click', () => {
    if (!disasterConfirmation || !confirm('Eliminate this player through a Judge intervention? This changes the game and is recorded in the log.')) return;
    act('disaster', disasterConfirmation); clearDisaster();
  });

  $('#ref-list').innerHTML = RR.ROLE_ORDER.map((k) => {
    const r = RR.reference(k);
    return `<div class="refrole" style="--rc:${r.color}">
      <div class="rh"><span class="em">${r.emoji}</span><b>${esc(r.name)}</b><span class="tag ${ROLES[k].darkText ? 'dark' : ''}" style="--rc:${r.color}">${esc(r.teamName)}</span><span class="muted small">${esc(r.when)}</span></div>
      <p>${esc(r.ability)}</p>
      ${r.restrictions.length ? `<ul>${r.restrictions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <p class="win">🏆 ${esc(r.win)}</p>
    </div>`;
  }).join('');
  $('#h-ref').addEventListener('click', () => { $('#ref').hidden = false; });
  $('#ref-close').addEventListener('click', () => { $('#ref').hidden = true; });
  $('#ref').addEventListener('click', (e) => { if (e.target.id === 'ref') $('#ref').hidden = true; });

  // ---------- scenes (presentation only) ----------
  const SC = window.MT_SCENES || {};
  const LAY = window.MT_LAYOUT;
  let selHouse = null;
  const SCENE_ICONS = { murder: '🔪', investigation: '🔍', watcher: '👁', peek: '👀', flee: '🏃', visitor: '🚪', emptyHouse: '🏚', graveyard: '🪦', square: '⛲', quietNight: '🌙' };
  $('#sc-scenes').innerHTML = (window.MT_SCENE_MANUAL || []).map((id) => `<button class="btn ghost" data-scene="${id}">${SCENE_ICONS[id] || '🎬'} ${esc((SC[id] || {}).name || id)}</button>`).join('');
  const relay = (ev, data) => socket.emit(ev, data, (r) => { if (r && r.ok === false) toast(r.error || 'Failed'); });
  $$('[data-scene]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.scene;
    if (SC[id] && SC[id].needsHouse && selHouse == null) return toast('Tap a house on the map first.');
    relay('judge:scene', { scene: id, house: selHouse, outcome: id === 'murder' ? $('#sc-outcome').value : undefined });
  }));
  $$('[data-spot]').forEach((b) => b.addEventListener('click', () => relay('judge:camera', { spot: b.dataset.spot })));
  $$('[data-mood]').forEach((b) => b.addEventListener('click', () => relay('judge:music', { mood: b.dataset.mood || null })));
  $('#sc-zoom').addEventListener('click', () => (selHouse == null ? toast('Tap a house on the map first.') : relay('judge:camera', { house: selHouse })));
  $('#sc-stop').addEventListener('click', () => relay('judge:stop', {}));

  function mapHouses() {
    const active = (st ? st.players : []).filter((p) => !p.spectator);
    const n = Math.max(0, ...active.map((p) => p.house + 1));
    // Only plots with a house (owners); guests living elsewhere have no house of their own.
    return { houses: LAY.houses(n), owners: new Map(active.filter((p) => !p.livesWith).map((p) => [p.house, p])) };
  }
  $('#sc-map').addEventListener('click', (e) => {
    const c = e.currentTarget, rect = c.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * LAY.W, y = ((e.clientY - rect.top) / rect.height) * LAY.H;
    const { houses } = mapHouses();
    let best = null, bd = 90;
    houses.forEach((h, i) => { const d = Math.hypot(h.x - x, h.y - 25 * h.s - y); if (d < bd) { bd = d; best = i; } });
    selHouse = best;
    renderScenes();
  });

  function renderScenes() {
    const c = $('#sc-map'), g = c.getContext('2d');
    const k = c.width / LAY.W;
    g.setTransform(k, 0, 0, k, 0, 0);
    if (LAY.applyVariant) LAY.applyVariant(window.MT_THEME_WORLD ? window.MT_THEME_WORLD.variant(st.theme) : null); // the world's pond/graveyard spots
    const th = (THEMES.THEMES[st.theme] || THEMES.THEMES.smalltown).palette;
    g.fillStyle = th.grass; g.fillRect(0, 0, LAY.W, LAY.H);
    g.strokeStyle = th.road; g.lineWidth = 36;
    g.beginPath(); g.ellipse(LAY.CX, LAY.CY, LAY.ROAD.rx, LAY.ROAD.ry, 0, 0, Math.PI * 2); g.stroke();
    g.fillStyle = th.plaza; g.beginPath(); g.arc(LAY.CX, LAY.CY, LAY.SQUARE_R, 0, Math.PI * 2); g.fill();
    g.fillStyle = th.water; g.beginPath(); g.ellipse(LAY.POND.x, LAY.POND.y, LAY.POND.rx, LAY.POND.ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#5e7d47'; g.fillRect(LAY.CEM.x, LAY.CEM.y, LAY.CEM.w, LAY.CEM.h);
    const { houses, owners } = mapHouses();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    houses.forEach((h, i) => {
      const o = owners.get(i);
      const sel = i === selHouse;
      g.fillStyle = sel ? '#ffe066' : o ? (o.alive ? th.walls[i % th.walls.length] : '#6b6f7a') : 'rgba(255,255,255,0.35)';
      g.fillRect(h.x - 32 * h.s, h.y - 44 * h.s, 64 * h.s, 44 * h.s);
      g.fillStyle = th.roofs[i % th.roofs.length];
      g.beginPath(); g.moveTo(h.x - 40 * h.s, h.y - 40 * h.s); g.lineTo(h.x, h.y - 74 * h.s); g.lineTo(h.x + 40 * h.s, h.y - 40 * h.s); g.fill();
      if (sel) { g.strokeStyle = '#ff3a3a'; g.lineWidth = 6; g.strokeRect(h.x - 40 * h.s, h.y - 80 * h.s, 80 * h.s, 84 * h.s); }
      g.font = "700 26px 'Pixelify Sans', monospace";
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.6)';
      const label = o ? `${o.alive ? '' : '👻 '}${o.name}` : `#${i + 1}`;
      g.strokeText(label, h.x, h.y + 22); g.fillStyle = '#fff'; g.fillText(label, h.x, h.y + 22);
    });
    const o = selHouse != null ? owners.get(selHouse) : null;
    $('#sc-sel').textContent = selHouse == null ? 'No house selected' : `House #${selHouse + 1}${o ? ` · ${o.name}${o.alive ? '' : ' (dead)'}` : ' · empty'}`;
  }

  function renderReveal() {
    const R2 = st.reveal;
    $('#g-reveal').hidden = !R2;
    if (!R2) return;
    const label = (e) => (['kill', 'multiKill'].includes(e.type) ? `🔪 ${esc(nameOf(e.targetId))} is killed`
      : e.type === 'guarded' ? `🛡️ A protector saves ${esc(nameOf(e.targetId))}${e.guardDied ? ' and dies' : ''}`
        : `💉 ${esc(nameOf(e.targetId))} is attacked but survives`);
    // Each kill: pick how it plays on the TV (tell your own story), then Play.
    const PLACES = [['home', '🛏 In their bed'], ['lake', '🌊 At the lake'], ['hearth', '🔥 By the hearth'], ['tavern', '🍺 Outside the tavern'], ['field', '🌾 In the field'], ['chase', '🏃 Chased home']];
    const pick = (e, i) => (['kill', 'multiKill'].includes(e.type) ? `<select class="small" data-rev-place="${i}" title="How this death plays out on the TV">${PLACES.map(([k, l]) => `<option value="${k}"${(e.place || 'home') === k ? ' selected' : ''}>${l}</option>`).join('')}</select>` : '');
    const rows = R2.events.map((e, i) => `<li><span>${label(e)}</span>${pick(e, i)}<button class="btn small ${e.played ? 'ghost' : ''}" data-rev="${i}">${e.played ? '↻ Replay' : '▶ Play'}</button></li>`);
    if (!R2.events.length) rows.push(`<li><span>🌙 A quiet night: nobody was attacked</span><button class="btn small ${R2.quietPlayed ? 'ghost' : ''}" data-rev-quiet>${R2.quietPlayed ? '↻ Replay' : '▶ Play'}</button></li>`);
    const blocked = R2.blocked.map((e, i) => `<li><span>⚠ Attack on ${esc(nameOf(e.targetId))} was blocked <span class="muted small">(reveals extra info)</span></span><button class="btn small ghost" data-rev-blocked="${i}">${e.played ? '↻ Replay' : '▶ Play'}</button></li>`);
    $('#g-reveal-list').innerHTML = `<ul class="list">${rows.join('')}</ul>`
      + (R2.events.length > 1 ? '<button class="btn" id="rev-all">▶ Play all in order</button>' : '')
      + (blocked.length ? `<h4>Optional</h4><ul class="list">${blocked.join('')}</ul>` : '');
    $$('[data-rev]').forEach((b) => b.addEventListener('click', () => act('reveal', { index: Number(b.dataset.rev) })));
    $$('[data-rev-place]').forEach((s) => s.addEventListener('change', () => act('reveal', { index: Number(s.dataset.revPlace), place: s.value, setPlace: true })));
    $$('[data-rev-blocked]').forEach((b) => b.addEventListener('click', () => act('reveal', { which: 'blocked', index: Number(b.dataset.revBlocked) })));
    const q = $('[data-rev-quiet]'); if (q) q.addEventListener('click', () => act('reveal', { which: 'quiet' }));
    const all = $('#rev-all'); if (all) all.addEventListener('click', () => act('reveal', { all: true }));
  }

  // ---------- rendering ----------
  socket.on('judge:state', (s) => {
    clockOffset = s.serverNow - Date.now();
    if (document.documentElement.dataset.theme !== s.theme) document.documentElement.dataset.theme = s.theme || ''; // themed menus (CSS)
    const first = !st;
    st = s;
    if (first) {
      const opts = Object.entries(s.personalities).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
      $('#t-pers').insertAdjacentHTML('beforeend', opts);
      $('#sim-pers').insertAdjacentHTML('beforeend', opts);
      $('#s-presets').innerHTML = Object.entries(s.presets).map(([k, v]) => `<button class="btn ghost" data-preset="${k}" title="${esc(v.desc)}">${esc(v.label)}</button>`).join('');
      $$('[data-preset]').forEach((b) => b.addEventListener('click', () => act('preset', { id: b.dataset.preset }, `Loaded ${b.textContent}`)));
      showTab(tab);
    }
    render();
  });

  const PHASES = { lobby: 'Lobby', draft: 'Role draft', roleReveal: 'Role reveal', night: 'Night {d}', dawn: 'Dawn {d}', morning: 'Morning {d}', discussion: 'Day {d} · Discussion', voting: 'Day {d} · Voting', verdict: 'Day {d} · Verdict', execution: 'Day {d} · Verdict', gameover: 'Game over' };

  function render() {
    if (!st) return;
    $('#judge-governance').textContent = st.governance.announcement || 'This console currently holds Judge authority.';
    $('[data-act="randomJudge"]').disabled = st.phase !== 'lobby';
    const ds = $('#disaster-player'), selected = ds.value;
    ds.innerHTML = st.players.filter((p) => p.alive && !p.spectator && !p.left).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    if ([...ds.options].some((o) => o.value === selected)) ds.value = selected;
    $('#disaster-preview').disabled = ['lobby', 'gameover'].includes(st.phase);
    $('#h-code').textContent = st.code;
    $('#h-town').textContent = `${st.townName} · ${(THEMES.THEMES[st.theme] || {}).name || ''}`;
    $('#h-phase').textContent = (PHASES[st.phase] || st.phase).replace('{d}', st.day) + (st.paused ? ' · ⏸ paused' : '');
    $('#g-pause').textContent = st.paused ? '▶ Resume' : '⏸ Pause';
    const lobby = st.phase === 'lobby';
    $('[data-act="start"]').disabled = !lobby;
    const over = st.phase === 'gameover';
    for (const id of ['#rd-view', '#rd-tv', '#rd-tv-off']) $(id).disabled = !over;
    if (!over) $('#rd-out').hidden = true;
    $('[data-act="openVoting"]').disabled = st.phase !== 'discussion';
    $('[data-act="closeVoting"]').disabled = st.phase !== 'voting';
    $('#g-hint').textContent = st.settings.autoAdvance ? 'Phases advance automatically. Turn off "Automatic phases" in Setup to open and close voting yourself.'
      : 'Manual mode: discussion lasts until you open voting, and voting stays open until you close it.';
    if (tab === 'game') renderGame();
    if (tab === 'setup') renderSetup();
    if (tab === 'scenes') renderScenes();
    if (tab === 'players') renderPlayers();
    if (tab === 'more') { renderTest(); renderLog(); MT_GRIMOIRE.render(st, act); }
    renderStatus();
  }

  // The headline at the top of Play: what's happening and what (if anything) you should do.
  function renderStatus() {
    const P = st.phase, inGame = st.players.filter((p) => !p.spectator && !p.left), alive = inGame.filter((p) => p.alive).length;
    const pr = st.progress, d = st.draft;
    const line = {
      lobby: () => `👥 ${inGame.length} in the lobby${st.setupError ? ` · ⚠ ${st.setupError}` : ''}. ${inGame.length >= st.minPlayers ? 'Press ▶ Start when everyone’s in.' : `Waiting for ${st.minPlayers - inGame.length} more.`}`,
      draft: () => (d && d.stage === 'vote' ? `🗳 Players are voting on role cards: ${d.ready}/${d.total} locked in.` : '🂠 The role draft is running on the TV.'),
      roleReveal: () => '🤫 Everyone is looking at their secret role.',
      night: () => (pr ? `🌙 Night ${st.day}: ${pr.done}/${pr.total} night actions in.` : `🌙 Night ${st.day}.`),
      dawn: () => (st.reveal ? '🌅 Dawn is waiting for you: play each event below, then press ⏭ Next.' : '🌅 Dawn is playing on the TV.'),
      morning: () => `☀️ Morning: ${alive} still alive.`,
      discussion: () => (st.settings.autoAdvance ? `🗣 Discussion: ${alive} alive.` : '🗣 Discussion: press “Open voting” (More game controls) when ready.'),
      voting: () => (pr ? `🗳 Voting: ${pr.done}/${pr.total} votes in.` : '🗳 Voting.'),
      verdict: () => '⚖️ The verdict is on the TV.',
      execution: () => '⚖️ The verdict is on the TV.',
      gameover: () => `🏁 Game over: ${st.winner ? (RR.WINNERS[st.winner] || {}).name || st.winner : 'nobody'} won. Show the Rundown or press ⟲ for a new game.`,
    }[P];
    $('#g-status').textContent = line ? line() : '';
    // Only show cards that matter right now.
    $('#rundown-card').hidden = P !== 'gameover';
    $('#g-progress-card').hidden = !(pr || st.tally);
    $('#g-pending-card').hidden = !st.pending;
  }

  function tick() {
    if (!st) return;
    const el = $('#h-timer');
    if (st.paused) { el.textContent = `⏸ ${Math.ceil((st.remainingMs || 0) / 1000)}s left`; return; }
    if (!st.endsAt) { el.textContent = st.phase === 'lobby' ? `${st.players.length} in the lobby` : 'Waiting for the Judge'; return; }
    const s = Math.max(0, Math.ceil((st.endsAt - (Date.now() + clockOffset)) / 1000));
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} left`;
  }
  setInterval(tick, 250);

  function renderGame() {
    const pr = st.progress;
    if (pr) {
      const pct = pr.total ? Math.round((100 * pr.done) / pr.total) : 100;
      $('#g-progress').innerHTML = `${pr.kind === 'night' ? 'Night actions' : 'Votes'}: <b>${pr.done}/${pr.total}</b><div class="bar"><div style="width:${pct}%"></div></div>`
        + (pr.kind === 'night' ? `<ul class="list">${st.allPlayers.filter((p) => p.actsAtNight).map((p) => `<li><span>${roleTag(p.role)} ${esc(p.name)}</span><span>${p.action ? '→ ' + esc(nameOf(p.action)) : '<span class="muted">waiting…</span>'}</span></li>`).join('')}</ul>` : '');
    } else $('#g-progress').textContent = 'Nothing to wait for.';
    if (st.tally) {
      const rows = Object.entries(st.tally).sort((a, b) => b[1] - a[1]).map(([id, n]) => `<li><span>${esc(nameOf(id))}</span><b>${n}</b></li>`).join('');
      $('#g-tally').innerHTML = rows ? `<h3 style="margin-top:10px">Live tally</h3><ul class="list">${rows}</ul>` : '';
    } else $('#g-tally').innerHTML = '';
    const pend = st.pending;
    if (pend && pend.events) {
      $('#g-pending').innerHTML = pend.events.length ? `<ul class="list">${pend.events.map((e) => `<li>${e.type === 'kill' ? '🔪 ' + esc(nameOf(e.targetId)) + ' dies'
        : e.type === 'guarded' ? `🛡️ ${esc(nameOf(e.guardId))} guards ${esc(nameOf(e.targetId))}${e.guardDied ? ' and dies' : ''}`
          : `💉 ${esc(nameOf(e.targetId))} survives${e.immune ? ' (night immune)' : ''}`}</li>`).join('')}</ul>` : 'A quiet night: nobody was attacked.';
    } else if (pend && 'eliminatedId' in pend) {
      $('#g-pending').textContent = pend.eliminatedId ? `⚖️ ${nameOf(pend.eliminatedId)} will be eliminated.` : pend.tie ? '⚖️ Tie: nobody is eliminated.' : '⚖️ Nobody is eliminated.';
    } else $('#g-pending').textContent = 'Resolved when night ends.';
    const human = st.settings.narratorMode === 'human';
    $('#g-narr-mode').textContent = human ? '🎙 Human Judge mode: read this aloud in your own words. Only you see it.' : '🤖 AI narrator: the big screen shows and speaks this.';
    $('#g-narr').textContent = st.narration ? `${st.narration.suggestion ? '💡 ' : ''}“${st.narration.text}”` : '…';
    renderReveal();
    $('#g-tele').innerHTML = (st.telepathLog || []).slice(-15).reverse().map((m) => `<li><span><b>${esc(nameOf(m.fromId))}:</b> ${esc(m.text)}</span><span class="muted small">Day ${m.day}</span></li>`).join('') || '<li class="muted">No messages yet.</li>';
  }

  function renderSetup() {
    MT_GRIMOIRE.setup(st, act);
    const lobby = st.phase === 'lobby';
    $$('[data-set]').forEach((el) => {
      if (document.activeElement === el) return;
      const v = st.settings[el.dataset.set];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    });
    $$('main[data-panel="setup"] [data-set="minPlayers"], main[data-panel="setup"] [data-set="maxPlayers"], main[data-panel="setup"] [data-set="vigilanteShots"], [data-set="roleSelection"], [data-set="draftSeconds"], [data-set="draftPool"]').forEach((el) => { el.disabled = !lobby; });
    $('#s-roles').classList.toggle('muted-off', st.settings.roleSelection !== 'manual');
    $$('[data-role]').forEach((el) => {
      el.disabled = !lobby || (el.dataset.role === 'mafia' && st.settings.autoMafia);
      if (el.dataset.role === 'mafia' && st.settings.autoMafia) { el.value = (st.setup.roles.filter((r) => r === 'mafia').length); return; }
      if (document.activeElement !== el) el.value = st.settings.roleCounts[el.dataset.role] || 0;
    });
    $$('[data-preset]').forEach((b) => { b.disabled = !lobby; });
    $('#s-theme').disabled = !lobby;
    $('#s-theme').title = lobby ? '' : 'The theme is locked once the game starts.';
    const setup = st.setup;
    $('#s-count').textContent = `for ${setup.count} player${setup.count === 1 ? '' : 's'}${lobby ? ' in the lobby' : ''}`;
    const counts = {};
    for (const r of setup.roles) counts[r] = (counts[r] || 0) + 1;
    $('#s-comp').innerHTML = RR.ROLE_ORDER.filter((r) => counts[r]).map((r) => `<span class="chip ${ROLES[r].darkText ? 'dark' : ''}" style="--rc:${ROLES[r].color}">${ROLES[r].emoji} ${counts[r]} ${ROLES[r].name}</span>`).join('');
    $('#s-errors').innerHTML = setup.errors.map((e) => `<div class="msg error">⛔ ${esc(e)}</div>`).join('') + setup.warnings.map((w) => `<div class="msg warn">⚠️ ${esc(w)}</div>`).join('');
  }

  function renderPlayers() {
    if (document.activeElement && document.activeElement.closest('#p-table')) return; // don't yank a dropdown
    const lobby = st.phase === 'lobby';
    const alive = st.allPlayers.filter((p) => p.alive && p.role);
    $('#p-count').textContent = `${st.allPlayers.length} total${lobby ? '' : ` · ${alive.length} alive`}`;
    const roleOpts = (sel, blank) => (blank ? `<option value="">${blank}</option>` : '') + RR.ROLE_ORDER.map((k) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${ROLES[k].emoji} ${ROLES[k].name}</option>`).join('');
    const targetOpts = (sel, extra) => `<option value="">—</option>${extra || ''}${alive.map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}`;
    const head = `<tr><th>Player</th><th>${lobby ? 'Force role' : 'Role'}</th><th>Status</th>${st.phase === 'night' ? '<th>Night action</th>' : ''}${st.phase === 'voting' ? '<th>Vote</th>' : ''}<th>Bot style</th><th>Info</th><th></th></tr>`;
    const rows = st.allPlayers.map((p) => {
      const pers = p.isBot ? `<select data-pers="${p.id}">${Object.entries(st.personalities).map(([k, v]) => `<option value="${k}" ${k === p.personality ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>` : '<span class="muted">human</span>';
      const status = !p.role ? 'lobby' : p.alive ? 'alive' : `👻 day ${p.diedDay} (${p.deathCause})`;
      const info = [
        ...(p.investigations || []).map((i) => `N${i.night}: ${i.name} ${i.blocked ? 'blocked' : i.clue || (i.result ? 'GUILTY' : 'clean')}`),
        p.ability ? p.ability.kind === 'conductor' ? `Harmony ${p.ability.harmony}/${p.ability.goal}; objective: ${p.ability.objective ? p.ability.objective.voters.map(nameOf).join(' + ') : 'waiting'}` : p.ability.kind === 'paparazzi' ? `${p.ability.photos}/${p.ability.goal} photos` : p.ability.left != null ? `${p.ability.left} ability uses left` : p.ability.pending ? 'Clue queued' : '' : '',
        p.role === 'vigilante' ? `${p.shotsLeft} bullet(s)` : '',
        p.originalRole && p.originalRole !== p.role ? `was ${ROLES[p.originalRole].name}` : '',
      ].filter(Boolean).join(' · ');
      return `<tr class="${p.role && !p.alive ? 'dead' : ''}">
        <td>${esc(p.name)}</td>
        <td>${p.spectator ? '—' : lobby ? `<select data-force="${p.id}">${roleOpts(p.forcedRole, 'Random')}</select>` : `<select data-setrole="${p.id}" title="Change role">${roleOpts(p.role)}</select>`}</td>
        <td>${p.isJudge ? 'Judge' : p.spectator ? 'Observer' : status}</td>
        ${st.phase === 'night' ? `<td>${p.actsAtNight ? `<select data-action="${p.id}">${targetOpts(p.action, ROLES[p.role].night && ROLES[p.role].night.optional ? `<option value="pass" ${p.action === 'pass' ? 'selected' : ''}>Hold fire</option>` : '')}</select>` : '<span class="muted">—</span>'}</td>` : ''}
        ${st.phase === 'voting' ? `<td>${p.alive && !p.spectator ? `<select data-vote="${p.id}">${targetOpts(p.vote, st.settings.allowSkip ? `<option value="skip" ${p.vote === 'skip' ? 'selected' : ''}>Skip</option>` : '')}</select>` : ''}</td>` : ''}
        <td>${pers}</td>
        <td class="muted small" style="white-space:normal;min-width:140px">${esc(info)}</td>
        <td>${p.spectator ? '' : !p.role ? `<button class="btn small ghost" data-kick="${p.id}">Remove</button>` : p.alive ? `<button class="btn small ghost" data-kill="${p.id}">Eliminate</button>` : `<button class="btn small ghost" data-revive="${p.id}">Revive</button>`}</td>
      </tr>`;
    }).join('');
    const t = $('#p-table');
    t.innerHTML = head + rows;
    t.querySelectorAll('[data-force]').forEach((s) => s.addEventListener('change', () => act('override', { op: 'setRole', id: s.dataset.force, role: s.value || null })));
    t.querySelectorAll('[data-setrole]').forEach((s) => s.addEventListener('change', () => act('override', { op: 'setRole', id: s.dataset.setrole, role: s.value }, 'Role changed')));
    t.querySelectorAll('[data-action]').forEach((s) => s.addEventListener('change', () => { if (s.value) act('override', { op: 'setAction', id: s.dataset.action, targetId: s.value }); }));
    t.querySelectorAll('[data-vote]').forEach((s) => s.addEventListener('change', () => act('override', { op: 'setVote', id: s.dataset.vote, targetId: s.value || null })));
    t.querySelectorAll('[data-pers]').forEach((s) => s.addEventListener('change', () => act('personality', { id: s.dataset.pers, personality: s.value })));
    t.querySelectorAll('[data-kick]').forEach((b) => b.addEventListener('click', () => act('kick', { id: b.dataset.kick })));
    t.querySelectorAll('[data-kill]').forEach((b) => b.addEventListener('click', () => act('override', { op: 'kill', id: b.dataset.kill })));
    t.querySelectorAll('[data-revive]').forEach((b) => b.addEventListener('click', () => act('override', { op: 'revive', id: b.dataset.revive })));
  }

  function renderTest() {
    $$('main[data-panel="test"] [data-set]').forEach((el) => {
      if (document.activeElement === el) return;
      const v = st.settings[el.dataset.set];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = String(v);
    });
    const lobby = st.phase === 'lobby';
    $('#t-add').disabled = !lobby;
    $('#t-remove').disabled = !lobby;
  }

  const WIN_COLORS = { town: '#3aa0ff', mafia: '#e74c3c', serialKiller: '#5d6d7e', jester: '#ff6fb5', draw: '#777' };
  function winBar(rates) {
    return `<div class="winbar">${Object.entries(rates).sort((a, b) => b[1] - a[1]).map(([w, p]) => `<div style="width:${p}%;background:${WIN_COLORS[w] || '#888'}" title="${esc((RR.WINNERS[w] || {}).name || w)} ${p}%">${p >= 8 ? `${(RR.WINNERS[w] || {}).name || w} ${p}%` : ''}</div>`).join('')}</div>`;
  }

  function renderSim() {
    const r = simResult;
    if (!r) return;
    const roles = Object.entries(r.roles).sort((a, b) => b[1].count - a[1].count);
    const eff = r.effectiveness;
    const el = r.eliminations;
    $('#sim-out').innerHTML = `<div class="stats">
      <p><b>${r.games}</b> games in ${(r.elapsedMs / 1000).toFixed(1)}s · avg <b>${r.avgDays}</b> days (≈ ${r.avgMinutes} min at real speed)
        ${r.errors.length ? `<br><span class="err">${r.errors.length} problem(s): ${esc(r.errors.join('; '))}</span>` : ''}</p>
      <h4>Win rate</h4>${winBar(r.winRates)}
      <h4>By player count</h4>
      <table><tr><th>Players</th><th>Games</th><th>Avg days</th>${Object.keys(RR.WINNERS).map((w) => `<th>${RR.WINNERS[w].name}</th>`).join('')}</tr>
      ${Object.entries(r.byPlayerCount).map(([n, s]) => `<tr><td>${n}</td><td>${s.games}</td><td>${s.avgDays}</td>${Object.keys(RR.WINNERS).map((w) => `<td>${s.wins[w] != null ? s.wins[w] + '%' : '–'}</td>`).join('')}</tr>`).join('')}</table>
      <h4>Roles</h4>
      <table><tr><th>Role</th><th>Played</th><th>Survived</th><th>Won</th><th>Main cause of death</th></tr>
      ${roles.map(([k, s]) => { const top = Object.entries(s.deaths).sort((a, b) => b[1] - a[1])[0]; return `<tr><td>${roleTag(k)}</td><td>${s.count}</td><td>${s.survivalRate}%</td><td>${s.winRate}%</td><td>${top ? `${esc(top[0])} (${Math.round((100 * top[1]) / s.count)}%)` : '–'}</td></tr>`; }).join('')}</table>
      <h4>Eliminations &amp; voting</h4>
      <table>
        <tr><td>Day eliminations that hit a non-Town player</td><td>${el.lynchAccuracy}%</td></tr>
        <tr><td>Days with no elimination</td><td>${el.noLynchDayRate}%</td></tr>
        <tr><td>Days that ended in a tie</td><td>${el.tieRate}%</td></tr>
        <tr><td>Skip votes</td><td>${el.skipVoteRate}%</td></tr>
        <tr><td>Voted out, by team</td><td>${esc(Object.entries(el.lynchedTeams).map(([k, v]) => `${k} ${v}`).join(' · '))}</td></tr>
        <tr><td>Killed at night, by team</td><td>${esc(Object.entries(el.nightVictimTeams).map(([k, v]) => `${k} ${v}`).join(' · '))}</td></tr>
      </table>
      <h4>Role effectiveness (per game)</h4>
      <table>
        <tr><td>Doctor saves</td><td>${eff.doctorSavesPerGame}</td></tr>
        <tr><td>Bodyguard saves</td><td>${eff.bodyguardSavesPerGame}</td></tr>
        <tr><td>Serial Killer survived attacks</td><td>${eff.nightImmuneSavesPerGame}</td></tr>
        <tr><td>Roleblocks</td><td>${eff.blocksPerGame}</td></tr>
        <tr><td>Vigilante shots / friendly fire</td><td>${eff.vigilanteShotsPerGame} / ${eff.vigilanteFriendlyFire}%</td></tr>
        ${Object.entries(eff.investigatorHitRate).map(([k, v]) => `<tr><td>${esc(ROLES[k].name)} checks that found someone guilty</td><td>${v}%</td></tr>`).join('')}
      </table>
      <p><button class="btn ghost" id="sim-dl">⬇ Download JSON</button></p>
    </div>`;
    $('#sim-dl').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }));
      a.download = `mafia-sim-${Date.now()}.json`;
      a.click();
    });
  }

  function renderLog() {
    $('#l-list').innerHTML = (st.log || []).slice().reverse().map((e) => `<li class="${e.hidden ? 'hidden' : ''}"><span class="d">${e.day ? `Day ${e.day}` : ''}</span><span>${e.hidden ? '🔒 ' : ''}${esc(e.text)}</span></li>`).join('') || '<li class="muted">Nothing yet.</li>';
  }

  // Optional after-game rundown: view it here, and/or put it up on the TV.
  const rundown = (toTv) => socket.emit('room:rundown', toTv == null ? {} : { toTv }, (r) => {
    if (!r || !r.ok) return toast((r && r.error) || 'The rundown is not available.');
    if (toTv === false) return toast('Rundown hidden from the TV.', true);
    $('#rd-out').innerHTML = `<h3>${esc(r.rundown.headline)}</h3>` + MT_RUNDOWN.html(r.rundown); $('#rd-out').hidden = false;
    if (toTv) toast('Rundown is up on the TV.', true);
  });
  $('#rd-view').addEventListener('click', () => rundown());
  $('#rd-tv').addEventListener('click', () => rundown(true));
  $('#rd-tv-off').addEventListener('click', () => rundown(false));

  let toastTimer = null;
  function toast(msg, ok) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = ok ? 'ok' : '';
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }
})();
