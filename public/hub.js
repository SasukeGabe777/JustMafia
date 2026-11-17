'use strict';
// JustGameBox title screen: pick a game with the mouse, touch, or a TV remote / keyboard.
// Arrow keys move to the nearest tile in that direction (big row on top, small row below).
(function () {
  const tiles = [...document.querySelectorAll('.tile')];
  let sel = 0;
  const sfx = (n) => { try { window.SFX && window.SFX.play(n); } catch { /* no audio */ } };

  function select(i, sound = true) {
    sel = Math.max(0, Math.min(tiles.length - 1, i));
    tiles.forEach((t, k) => t.classList.toggle('sel', k === sel));
    tiles[sel].focus({ preventScroll: false });
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
      t.insertAdjacentHTML('beforeend', `<div class="lock-ov"><span class="lk">🔒</span><b>Locked</b><small>${L.how || 'Keep playing to unlock it.'}</small></div>`);
    } else if (fresh.includes(key)) {
      // First visit since it was unlocked: the lock breaks off and the tile lights up.
      t.classList.add('unlocking');
      t.insertAdjacentHTML('beforeend', '<div class="lock-ov opening"><span class="lk">🔓</span><b>Unlocked!</b></div><span class="new-badge">NEW!</span>');
      setTimeout(() => { sfx('win'); }, 600);
      setTimeout(() => { const o = t.querySelector('.lock-ov'); if (o) o.remove(); t.classList.remove('unlocking'); U.seen(key); }, 3200);
    }
  }
  // ⚙ Settings (top right): unlock or re-lock every unlockable game, for testing.
  const gear = document.getElementById('gear'), gm = document.getElementById('gear-menu');
  if (gear && gm) {
    const setOpen = (on) => { gm.hidden = !on; gear.setAttribute('aria-expanded', on ? 'true' : 'false'); };
    gear.addEventListener('click', (e) => { e.stopPropagation(); setOpen(gm.hidden); sfx('pop'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !gm.hidden) setOpen(false); });
    document.addEventListener('click', (e) => { if (!gm.hidden && !gm.contains(e.target)) setOpen(false); });
    document.getElementById('unlock-all').addEventListener('click', () => { if (U) { U.unlockAll(); location.reload(); } });
    document.getElementById('lock-all').addEventListener('click', () => { if (U) { U.lockAll(); location.reload(); } });
  }
  function open(t) {
    if (t.classList.contains('locked')) {
      sfx('shrug'); t.classList.remove('shake'); void t.offsetWidth; t.classList.add('shake');
      return;
    }
    if (t.classList.contains('live')) {
      sfx('start');
      try { localStorage.setItem('box.recent', t.dataset.game); } catch { /* private */ }
      setTimeout(() => { location.href = t.getAttribute('href'); }, 250);
    } else sfx('shrug');
  }

  // ---- Find a game: how many of you are there? ----
  // Each tile's "👥 3–100" chip gives the player range.
  const range = (t) => { const m = (t.querySelector('.meta span') || {}).textContent; const r = m && m.match(/(\d+)\s*[–-]\s*(\d+)/); return r ? [Number(r[1]), Number(r[2])] : [1, 100]; };
  let group = 0;
  const fits = (t) => { if (!group) return true; const [lo, hi] = range(t); return group >= lo && group <= hi; };
  function filter() {
    for (const t of tiles) t.classList.toggle('dim', !fits(t));
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
  // The last game opened gets a badge; a room that may still be running gets a Continue button.
  try {
    const recent = localStorage.getItem('box.recent');
    const rt = tiles.find((t) => t.dataset.game === recent);
    if (rt) { const b = document.createElement('span'); b.className = 'recent'; b.textContent = '↺ Last played'; rt.appendChild(b); }
    const h = JSON.parse(localStorage.getItem('box.host') || 'null');
    const ct = h && h.code && tiles.find((t) => t.dataset.game === h.game);
    const c = document.getElementById('continue');
    if (ct && c) { c.hidden = false; c.href = ct.getAttribute('href') + (ct.getAttribute('href').includes('?') ? '&' : '?') + 'resume=1'; c.textContent = `▶ Continue room ${h.code} (${ct.querySelector('h2').textContent})`; }
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

  tiles.forEach((t, i) => {
    t.addEventListener('mouseenter', () => { if (sel !== i) select(i); });
    t.addEventListener('click', (e) => { e.preventDefault(); select(i, false); open(t); });
  });
  document.addEventListener('keydown', (e) => {
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (dir) { e.preventDefault(); const n = nearest(dir[0], dir[1]); if (n >= 0) select(n); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(tiles[sel]); }
  });
  select(0, false);

  // Show the real join address (the LAN or public URL), so players know where to go.
  fetch('/api/info').then((r) => r.json()).then((i) => { if (i.baseUrl) document.getElementById('join-url').textContent = i.baseUrl.replace(/^https?:\/\//, '') + '/play'; }).catch(() => {});
})();
