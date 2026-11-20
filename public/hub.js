'use strict';
// JustGameBox title screen: pick a game with the mouse, touch, or a TV remote / keyboard.
// The three big games sit on top; the small games are sorted onto labelled shelves by type
// (see the note at the top of hub.html). Arrow keys move to the nearest tile in that direction.
(function () {
  let tiles = [...document.querySelectorAll('.tile')];
  let sel = 0;
  const sfx = (n) => { try { window.SFX && window.SFX.play(n); } catch { /* no audio */ } };

  function select(i, sound = true, scroll = true) {
    sel = Math.max(0, Math.min(tiles.length - 1, i));
    tiles.forEach((t, k) => t.classList.toggle('sel', k === sel));
    const t = tiles[sel];
    t.focus({ preventScroll: true });
    // Big games: show the whole top of the page; small games: keep the card (and its shelf label) in view.
    if (!scroll) { /* the mouse is already on it */ } else if (t.closest('.tiles.big')) { if (window.scrollY > 0 && t.getBoundingClientRect().top < 0) window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else {
      const r = t.getBoundingClientRect(), pad = 70;
      if (r.top < pad || r.bottom > window.innerHeight - 20) window.scrollBy({ top: r.top < pad ? r.top - pad : r.bottom - window.innerHeight + 40, behavior: 'smooth' });
    }
    if (sound) sfx('pop');
  }
  // ---- Unlockable games (public/unlocks.js): locked tiles show how to open them ----
  const U = window.UNLOCKS;
  const fresh = U ? U.fresh() : [];
  for (const t of tiles) {
    const key = t.dataset.lock; if (!key || !U) continue;
    const L = U.LIST[key] || {};
    if (!U.has(key)) {
      t.classList.add('locked');
      // A lock over the picture, and what to do written under the description.
      const art = t.querySelector('.art'); if (art) art.insertAdjacentHTML('beforeend', '<div class="lock-art"><span class="lk">🔒</span><b>LOCKED</b></div>');
      const desc = t.querySelector('.info p'); const how = `<p class="lock-how">🔒 ${L.how || 'Keep playing to unlock it.'}</p>`;
      if (desc) desc.insertAdjacentHTML('afterend', how); else t.insertAdjacentHTML('beforeend', how);
    } else if (fresh.includes(key)) {
      // First visit since it was unlocked: the lock breaks off and the tile lights up.
      t.classList.add('unlocking');
      t.insertAdjacentHTML('beforeend', '<div class="lock-ov opening"><span class="lk">🔓</span><b>Unlocked!</b></div><span class="new-badge">NEW!</span>');
      setTimeout(() => { sfx('win'); }, 600);
      setTimeout(() => { const o = t.querySelector('.lock-ov'); if (o) o.remove(); t.classList.remove('unlocking'); U.seen(key); }, 3200);
    }
  }
  // ---- Shelves: small games grouped by category ----
  // The categories live in public/categories.js (Party Mode uses the same list). Each tile says
  // its category with data-type; locked games stay on their shelf, after the playable ones.
  const SHELVES = (window.GAME_CATS || []).concat([{ k: 'other', name: 'More', icon: '✨', c: '#c9bfe6' }]);
  const shelfOf = (t) => { const d = t.dataset.type; return d && SHELVES.some((s) => s.k === d) ? d : 'other'; };
  const small = document.querySelector('.tiles.small');
  if (small) {
    const smallTiles = [...small.querySelectorAll('.tile')];
    const wrap = document.createElement('div'); wrap.className = 'shelves';
    for (const s of SHELVES) {
      const all = smallTiles.filter((t) => shelfOf(t) === s.k); if (!all.length) continue;
      const mine = [...all.filter((t) => !t.classList.contains('locked')), ...all.filter((t) => t.classList.contains('locked'))];
      const shelf = document.createElement('div');
      shelf.className = 'shelf shelf-' + s.k; shelf.dataset.shelf = s.k; shelf.style.setProperty('--c', s.c);
      shelf.innerHTML = `<h3 class="shelf-head"><span class="sh-ic" aria-hidden="true">${s.icon}</span>${s.name}${s.sub ? `<small class="sh-sub">${s.sub}</small>` : ''}<span class="sh-n">${mine.length}</span></h3><div class="shelf-row"></div>`;
      const row = shelf.querySelector('.shelf-row');
      for (const t of mine) { row.appendChild(t); const p = t.querySelector('.info p'); if (p && !t.title) t.title = p.textContent; }
      wrap.appendChild(shelf);
    }
    small.appendChild(wrap);
    const n = document.getElementById('more-count'); if (n) n.textContent = smallTiles.length + ' games';
    tiles = [...document.querySelectorAll('.tile')];
  }
  // ⚙ Settings (top right): unlock or re-lock every unlockable game, for testing.
  const gear = document.getElementById('gear'), gm = document.getElementById('gear-menu');
  if (gear && gm) {
    // Quiet recorded UI sounds (public/audio/sfx/ui/, BOX.audio.ui); the old synth pop if they can't play.
    const ui = (kind, fb) => { let ok = false; try { ok = !!(window.BOX && window.BOX.audio && window.BOX.audio.ui(kind)); } catch { /* no audio */ } if (!ok && fb) sfx(fb); };
    const setOpen = (on) => { if (gm.hidden === on) ui(on ? 'open' : 'close', on ? 'pop' : null); gm.hidden = !on; gear.setAttribute('aria-expanded', on ? 'true' : 'false'); };
    gear.addEventListener('click', (e) => { e.stopPropagation(); setOpen(gm.hidden); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !gm.hidden) setOpen(false); });
    document.addEventListener('click', (e) => { if (!gm.hidden && !gm.contains(e.target)) setOpen(false); });
    document.getElementById('unlock-all').addEventListener('click', () => { if (U) { U.unlockAll(); location.reload(); } });
    document.getElementById('lock-all').addEventListener('click', () => { if (U) { U.lockAll(); location.reload(); } });
    // Music and effects volume (public/box/audio.js remembers them for every screen).
    const A = window.BOX && window.BOX.audio;
    for (const [id, kind] of [['master-vol', 'master'], ['music-vol', 'music'], ['sfx-vol', 'sfx']]) {
      const r = document.getElementById(id), o = document.getElementById(id + '-o'); if (!r || !A) { if (r) r.closest('label').hidden = true; continue; }
      const show = () => { if (o) o.textContent = r.value + '%'; };
      r.value = Math.round(A.settings[kind] * 100); show();
      r.addEventListener('input', () => { A.set(kind, r.value / 100); show(); ui('tick', kind === 'sfx' ? 'pop' : null); });
    }
    // Mute everything (music and effects, on every screen of this TV).
    const mb = document.getElementById('mute-all');
    if (mb && A) { const paint = () => { const m = A.settings.mute; mb.textContent = m ? '🔇 Muted: tap to unmute' : '🔇 Mute everything'; mb.classList.toggle('on', m); }; paint(); mb.addEventListener('click', () => { const was = A.settings.mute; if (!was) ui('toggle'); A.mute(!was); if (was) ui('toggle'); paint(); }); }
    else if (mb) mb.hidden = true;
  }
  // The main-menu theme (public/box/scores/menu.js) starts with the first click or key press.
  try { if (window.BOX && window.BOX.audio) window.BOX.audio.music('title', 'menu'); } catch { /* no audio */ }
  function open(t) {
    if (t.classList.contains('locked')) {
      sfx('shrug'); t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake');
      if (window.HUB_ONBOARD) window.HUB_ONBOARD.locked(t); // what unlocks it, with a button to go play that
      return;
    }
    if (t.classList.contains('live')) {
      sfx('start');
      try { localStorage.setItem('box.recent', t.dataset.game); } catch { /* private */ }
      // This TV's room is still open: switch it to this game (same code, every phone follows).
      if (ROOM.live) return void pickLive(t.dataset.game);
      setTimeout(() => { location.href = t.getAttribute('href'); }, 250);
    } else sfx('shrug');
  }

  // ---- One code for the night ----
  // The room this TV opened (box.host, or JustMafia's mt.host) is checked on the server with its
  // host key. While it is open, picking any game (a tile, Party Mode, the game finder) switches
  // that room: the code and QR stay the same and every phone follows. "New room" forgets it.
  const ROOM = { live: null, busy: false };
  const store = {
    get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private */ } },
    del: (k) => { try { localStorage.removeItem(k); } catch { /* private */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  const creds = () => ({ box: store.get('box.host'), mafia: store.get('mt.host') });
  const liveEl = document.getElementById('room-live'), contEl = document.getElementById('continue'), newEl = document.getElementById('new-room');
  function paintRoom(err) {
    const L = ROOM.live;
    if (liveEl) {
      liveEl.hidden = !L && !err; liveEl.classList.toggle('err', !!err);
      if (err) liveEl.textContent = err;
      else if (L) liveEl.innerHTML = `📺 Room <b>${esc(L.code)}</b> is open${L.players ? ` · ${L.players} player${L.players === 1 ? '' : 's'}` : ''} · now in ${esc(L.away ? L.away.title : L.title)}. Pick any game and everyone comes along with the same code.`;
    }
    if (contEl) { contEl.hidden = !L; if (L) { contEl.href = L.tv; contEl.textContent = `▶ Back to room ${L.code} (${L.away ? L.away.title : L.title})`; } }
    if (newEl) newEl.hidden = !L;
  }
  // Remember the room's keys so the game's TV page picks it straight back up.
  function remember(r) {
    if (r.box) store.set('box.host', r.box);
    if (r.mafia) store.set('mt.host', r.mafia);
  }
  if (contEl) contEl.addEventListener('click', (e) => { if (ROOM.live) { e.preventDefault(); remember(ROOM.live); sfx('start'); setTimeout(() => { location.href = ROOM.live.tv; }, 200); } });
  if (newEl) newEl.addEventListener('click', () => { store.del('box.host'); store.del('mt.host'); ROOM.live = null; paintRoom(); sfx('pop'); });
  function checkRoom() {
    const c = creds();
    if (!(c.box && c.box.code) && !(c.mafia && c.mafia.code)) return Promise.resolve(null);
    return post('/api/host/room', c).then((r) => {
      ROOM.live = r && r.ok ? r : null;
      if (r && !r.ok && r.gone && c.box) store.del('box.host'); // closed: the next pick makes a new room
      paintRoom(); return ROOM.live;
    }).catch(() => null);
  }
  // key: the game; party: { games, minutes, flow } to start a Party Mode in this room.
  function pickLive(key, party) {
    if (ROOM.busy) return Promise.resolve(false);
    ROOM.busy = true;
    const unlocks = window.UNLOCKS ? window.UNLOCKS.all() : [];
    return post('/api/host/pick', { ...creds(), game: key, party: party || null, unlocks }).then((r) => {
      ROOM.busy = false;
      if (!r || !r.ok) {
        if (r && r.gone) { ROOM.live = null; store.del('box.host'); paintRoom('That room has closed. Pick the game again for a new room.'); }
        else paintRoom((r && r.error) || 'Could not switch the room.');
        sfx('shrug'); return false;
      }
      remember(r);
      setTimeout(() => { location.href = r.tv; }, 250);
      return true;
    }).catch(() => { ROOM.busy = false; paintRoom('Could not reach the server.'); return false; });
  }
  // For Party Mode (party/party.js) and the game finder (hub-pick.js).
  window.HUB_ROOM = { live: () => ROOM.live, pick: pickLive, check: checkRoom };
  checkRoom();

  // ---- Find a game: how many of you are there? ----
  // Each tile's "👥 3–100" chip gives the player range.
  const range = (t) => { const m = (t.querySelector('.meta span') || {}).textContent; const r = m && m.match(/(\d+)\s*[–-]\s*(\d+)/); return r ? [Number(r[1]), Number(r[2])] : [1, 100]; };
  let group = 0;
  const fits = (t) => { if (!group) return true; const [lo, hi] = range(t); return group >= lo && group <= hi; };
  // The group size as a range (the buttons: 2–3, 4–8, 9–20, 21+) and each game's ideal crowd (data-best).
  const GROUP = { 2: [2, 3], 6: [4, 8], 14: [9, 20], 40: [21, 100] };
  const bestFit = (t) => { if (!group || !t.dataset.best) return false; const [lo, hi] = GROUP[group] || [group, group], [blo, bhi] = t.dataset.best.split('-').map(Number); return Math.max(0, Math.min(hi, bhi) - Math.max(lo, blo) + 1) / (hi - lo + 1) >= 0.5; };
  function filter() {
    for (const t of tiles) { t.classList.toggle('dim', !fits(t)); t.classList.toggle('best-fit', fits(t) && bestFit(t)); }
  }
  for (const b of document.querySelectorAll('#count [data-n]')) b.addEventListener('click', () => {
    group = Number(b.dataset.n);
    for (const x of document.querySelectorAll('#count [data-n]')) x.classList.toggle('on', x === b);
    filter(); sfx('pop');
  });
  // Surprise me: a random small game that fits the group.
  const surprise = document.getElementById('surprise');
  if (surprise) surprise.addEventListener('click', () => {
    const pool = tiles.filter((t) => t.closest('.tiles.small') && t.classList.contains('live') && !t.classList.contains('locked') && fits(t));
    if (!pool.length) return sfx('shrug');
    const t = pool[Math.floor(Math.random() * pool.length)], i = tiles.indexOf(t);
    select(i); t.scrollIntoView({ block: 'center', behavior: 'smooth' });
    t.classList.remove('pick'); void t.offsetWidth; t.classList.add('pick');
    sfx('shuffle');
    setTimeout(() => open(t), 1600);
  });
  // The last game opened gets a badge. (A room that is still open gets "Back to room": below.)
  try {
    const recent = localStorage.getItem('box.recent');
    const rt = tiles.find((t) => t.dataset.game === recent);
    if (rt) { const b = document.createElement('span'); b.className = 'recent'; b.textContent = '↺ Last played'; rt.appendChild(b); }
  } catch { /* private mode */ }
  function nearest(dx, dy) {
    const a = tiles[sel].getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = -1, bestD = Infinity;
    tiles.forEach((t, i) => {
      if (i === sel) return;
      const b = t.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const along = (bx - ax) * dx + (by - ay) * dy; if (along <= 4) return;
      const across = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
      const d = along + across * 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  // Every tile (and the "New here?" cards, public/hub-onboard.js) takes the mouse and the remote.
  function bindTile(t) {
    if (t.dataset.nav) return; t.dataset.nav = '1';
    t.addEventListener('mouseenter', () => { const i = tiles.indexOf(t); if (i >= 0 && sel !== i) select(i, true, false); });
    t.addEventListener('click', (e) => { e.preventDefault(); const i = tiles.indexOf(t); if (i >= 0) select(i, false, false); open(t); });
  }
  tiles.forEach(bindTile);
  window.HUB_NAV = {
    refresh() { const cur = tiles[sel]; tiles = [...document.querySelectorAll('.nh-card, .tile')]; tiles.forEach(bindTile); sel = Math.max(0, tiles.indexOf(cur)); },
    select: (t) => { const i = tiles.indexOf(t); if (i >= 0) select(i, false); },
    open: (t) => open(t),
  };
  document.addEventListener('keydown', (e) => {
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (dir) { e.preventDefault(); const n = nearest(dir[0], dir[1]); if (n >= 0) select(n); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(tiles[sel]); }
  });
  select(0, false);

  // Show the real join address (the LAN or public URL), so players know where to go.
  fetch('/api/info').then((r) => r.json()).then((i) => { if (i.baseUrl) document.getElementById('join-url').textContent = i.baseUrl.replace(/^https?:\/\//, '') + '/join'; }).catch(() => {});
})();
