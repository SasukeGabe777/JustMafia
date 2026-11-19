'use strict';
// JustGameBox title screen: helping new people in.
//  1. "How it works": a one-minute animated explainer on the big screen, the first time this TV opens
//     the title screen (localStorage box.hiw); replay it from the "How it works" link. Skip button or
//     any key closes it; a click moves to the next scene. Narrated when a voice is available.
//  2. "New here? Start with these 5": easy games (only unlocked ones: a locked pick is replaced by the
//     next beginner game), plus "Just pick for us": a ~30 minute Party Mode of easy games for the
//     group size, with practice rounds for games this TV hasn't played.
//  3. Locked games: "Play games to unlock more: N/33 unlocked" with what to play next; a locked tile
//     says what unlocks it (with a button to go play that); "What's new" when something unlocked.
// Reads the tiles on the page (hub.html) for names, art and player counts, so renamed games follow.
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sfx = (n) => { try { window.SFX && window.SFX.play(n); } catch { /* no audio */ } };
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
  const doneList = () => { try { const v = JSON.parse(get('box.done') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const U = window.UNLOCKS;
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const narrow = () => window.innerWidth < 760;

  // ---------- the tiles ----------
  const tileOf = (k) => document.querySelector(`.tile[data-game="${k}"]`);
  const isLocked = (t) => !!(t && t.classList.contains('locked'));
  const nums = (txt) => { const m = txt && txt.match(/(\d+)\s*[–-]\s*(\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
  function info(k) {
    const t = tileOf(k); if (!t) return null;
    const spans = [...t.querySelectorAll('.meta span')].map((s) => s.textContent);
    const name = (($('h2', t) || {}).textContent || k).trim();
    return { key: k, t, name, blurb: (($('.info p', t) || {}).textContent || '').trim(), icon: (($('.icon', t) || {}).textContent || '🎮').trim(),
      art: ($('.art-img', t) || {}).src || `/art/tiles/${k}.svg`, href: t.getAttribute('href'), players: nums(spans.find((x) => x.includes('👥'))) || [1, 100],
      mins: nums(spans.find((x) => x.includes('⏱'))) || [10, 20], best: t.dataset.best ? t.dataset.best.split('-').map(Number) : null, type: t.dataset.type || '' };
  }

  // ======================================================================================
  // 2. New here? Start with these 5
  // ======================================================================================
  // In order of how easy they are to pick up; the first five unlocked ones are shown.
  const BEGINNER = ['likely', 'pizza', 'emoji', 'snap', 'quickdraw', 'price', 'blackjack', 'spectrum', 'whosaid', 'colormatch', 'truths', 'sketch', 'blanks'];
  const WHY = { likely: 'Just vote: no skills needed', pizza: 'Look, remember, build', emoji: 'Say it with emojis', snap: 'Run around with your camera', quickdraw: 'Wait for it… DRAW!',
    price: 'Guess the price', blackjack: 'Hit or stand', spectrum: 'Where do you stand?', whosaid: 'Guess who wrote it', colormatch: 'Mix the colour', truths: 'Spot the lie', sketch: 'Draw, guess, pass', blanks: 'Funniest card wins' };
  const beginners = () => BEGINNER.map((k) => tileOf(k)).filter((t) => t && !isLocked(t)).map((t) => t.dataset.game);
  const HIDE_NEW = 'box.newHereHidden';
  const GROUPS = [{ n: 3, label: '2–3', icon: '👫' }, { n: 6, label: '4–8', icon: '👨‍👩‍👧‍👦' }, { n: 12, label: '9+', icon: '🎊' }];
  let group = 6;
  function newHere() {
    const el = $('#new-here'); if (!el) return;
    const keys = beginners().slice(0, 5);
    const show = keys.length && get(HIDE_NEW) !== '1' && doneList().length < 3;
    el.hidden = !show; document.body.classList.toggle('has-new-here', !!show);
    if (!show) { el.innerHTML = ''; return; }
    const cards = keys.map(info).filter(Boolean);
    el.innerHTML = `<header class="nh-head"><div><h2><span class="nh-wave" aria-hidden="true">👋</span> New here? Start with these ${cards.length}</h2>
        <p>Easy to learn, quick to play, fun with any crowd. Each one starts with a practice round that doesn’t count.</p></div>
        <button class="nh-hide" id="nh-hide" title="Hide this row">Got it, hide this ✕</button></header>
      <div class="nh-row">
        ${cards.map((g, i) => `<a class="nh-card live" href="${esc(g.href)}" data-game="${esc(g.key)}" data-best="${g.best ? g.best.join('-') : ''}" style="--i:${i}">
          <span class="nh-art"><img src="${esc(g.art)}" alt="" onerror="this.remove()"><span class="nh-icon">${esc(g.icon)}</span><span class="nh-easy">⭐ Easy</span></span>
          <span class="nh-info"><b>${esc(g.name)}</b><span class="nh-why">${esc(WHY[g.key] || g.blurb)}</span>
          <span class="meta"><span>👥 ${g.players[0]}–${g.players[1]}</span><span>⏱ ${g.mins[0]}–${g.mins[1]} min</span></span></span></a>`).join('')}
        <div class="nh-pick">
          <div class="nh-pick-top"><span class="nh-dice" aria-hidden="true">🎲</span><div><b>Just pick for us</b><small>About 30 minutes of easy games in a row, with a points race. We pick, you play.</small></div></div>
          <div class="nh-seg" role="group" aria-label="How many of you?">${GROUPS.map((g) => `<button data-nh-n="${g.n}" class="${g.n === group ? 'on' : ''}"><span>${g.icon}</span>${g.label}</button>`).join('')}</div>
          <button class="nh-go" id="nh-go">🎉 Start a 30-minute party</button>
        </div>
      </div>`;
    $('#nh-hide', el).onclick = () => { set(HIDE_NEW, '1'); sfx('pop'); el.classList.add('out'); setTimeout(() => { newHere(); if (window.HUB_NAV) window.HUB_NAV.refresh(); }, 260); };
    for (const b of el.querySelectorAll('[data-nh-n]')) b.onclick = () => { group = Number(b.dataset.nhN); for (const x of el.querySelectorAll('[data-nh-n]')) x.classList.toggle('on', x === b); sfx('pop'); };
    $('#nh-go', el).onclick = () => justPick();
    if (window.HUB_NAV) window.HUB_NAV.refresh();
  }
  // "Just pick for us": a short Party Mode of beginner games that suit the group.
  function lineupFor(n) {
    const pool = beginners().map(info).filter((g) => g && g.players[0] <= n && g.players[1] >= Math.min(n, 12));
    const fit = (g) => (g.best ? Math.max(0, Math.min(n + 2, g.best[1]) - Math.max(n - 2, g.best[0]) + 1) : 0);
    // The easiest first, but games that suit this crowd move up; then no two of a kind in a row.
    const ranked = pool.map((g, i) => ({ g, s: fit(g) * 2 - i })).sort((a, b) => b.s - a.s).map((x) => x.g).slice(0, 4);
    const out = [];
    while (ranked.length) { const last = out.length ? out[out.length - 1].type : null; let i = ranked.findIndex((g) => g.type !== last); if (i < 0) i = 0; out.push(ranked.splice(i, 1)[0]); }
    return out.map((g) => g.key);
  }
  function justPick() {
    const games = lineupFor(group); if (!games.length) return sfx('shrug');
    sfx('start');
    const plan = Object.fromEntries(games.map((k) => [k, 5]));
    const party = { games, minutes: 30, flow: 'auto', intros: 'play', each: 'quick', plan, players: group, practice: 'new', seen: doneList() };
    try { localStorage.setItem('box.recent', games[0]); } catch { /* private */ }
    const H = window.HUB_ROOM;
    if (H && H.live()) return void H.pick(games[0], party);
    const url = `/box/tv?game=${encodeURIComponent(games[0])}&party=${games.map(encodeURIComponent).join(',')}&minutes=30&intros=play&each=quick&plan=${games.map((k) => k + ':' + plan[k]).join(',')}&players=${group}&practice=new`;
    setTimeout(() => { location.href = url; }, 250);
  }

  // ======================================================================================
  // 3. Locked games
  // ======================================================================================
  const HIDE_UL = 'box.unlockTipHidden';
  function unlockTip() {
    const el = $('#unlock-tip'); if (!el || !U) return;
    const all = [...document.querySelectorAll('.tile[data-game]')], locked = all.filter(isLocked);
    if (!locked.length || get(HIDE_UL) === '1') { el.hidden = true; return; }
    const open = all.length - locked.length, pct = Math.round((100 * open) / all.length);
    // What to play next: locked games whose unlocking game is open, easy ones first.
    const next = locked.map((t) => { const k = t.dataset.lock || t.dataset.game, L = U.LIST[k] || {}; return { k, L, from: L.from }; })
      .filter((x) => x.from === 'party' || (tileOf(x.from) && !isLocked(tileOf(x.from))))
      .sort((a, b) => (BEGINNER.indexOf(a.from) < 0 ? 99 : BEGINNER.indexOf(a.from)) - (BEGINNER.indexOf(b.from) < 0 ? 99 : BEGINNER.indexOf(b.from)) || (a.from === 'party') - (b.from === 'party'))
      .slice(0, 3);
    const nm = (k) => (info(k) || { name: k }).name;
    el.hidden = false;
    el.innerHTML = `<span class="ul-ic" aria-hidden="true">🔓</span><div class="ul-main"><div class="ul-top"><b>Play games to unlock more</b><span class="ul-n"><b>${open}</b>/${all.length} unlocked</span></div>
      <div class="ul-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${all.length}" aria-valuenow="${open}"><i style="width:${pct}%"></i></div>
      ${next.length ? `<div class="ul-next">${next.map((x) => `<button class="ul-chip" data-ul-from="${esc(x.from)}"><span>${x.from === 'party' ? '🎉 Finish a Party Mode' : `▶ Finish <b>${esc(nm(x.from))}</b>`}</span><i>→</i><span>${esc(x.L.icon || '🎁')} ${esc(x.L.title || x.k)}</span></button>`).join('')}</div>` : ''}</div>
      <button class="ul-x" id="ul-x" title="Hide this">✕</button>`;
    $('#ul-x', el).onclick = () => { set(HIDE_UL, '1'); sfx('pop'); el.hidden = true; };
    for (const b of el.querySelectorAll('[data-ul-from]')) b.onclick = () => playFrom(b.dataset.ulFrom);
  }
  // Go play the game that unlocks something (or open Party Mode).
  function playFrom(k) {
    if (k === 'party') { const b = $('#party-open'); if (b) b.click(); return; }
    const t = tileOf(k); if (!t || !window.HUB_NAV) return;
    window.HUB_NAV.select(t); t.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    setTimeout(() => window.HUB_NAV.open(t), 500);
  }
  // A locked tile was picked: what unlocks it, and a button to go play that.
  let lockOv = null;
  function lockedCard(t) {
    if (!U) return;
    closeLocked();
    const k = t.dataset.lock || t.dataset.game, L = U.LIST[k] || {}, g = info(k) || {}, from = L.from, ft = from && from !== 'party' ? tileOf(from) : null;
    const fromName = ft ? (($('h2', ft) || {}).textContent || from).trim() : null;
    lockOv = document.createElement('div'); lockOv.className = 'lk-ov';
    lockOv.innerHTML = `<div class="lk-card" role="dialog" aria-label="${esc(g.name || L.title)} is locked">
      <div class="lk-art"><img src="${esc(g.art || '')}" alt="" onerror="this.remove()"><span class="lk-pad">🔒</span></div>
      <h2>${esc(g.name || L.title)} is locked</h2>
      <p>${from === 'party' ? 'Finish a whole <b>Party Mode</b> to unlock it.' : fromName ? `Finish a game of <b>${esc(fromName)}</b> to unlock it.` : esc(L.how || 'Keep playing to unlock it.')}</p>
      <small>Unlocked games stay unlocked on this TV.</small>
      <div class="lk-btns">${from === 'party' ? '<button class="lk-go" data-lk="party">🎉 Start a Party Mode</button>' : ft && !isLocked(ft) ? `<button class="lk-go" data-lk="${esc(from)}">▶ Play ${esc(fromName)}</button>` : ''}<button class="lk-ok" data-lk="ok">OK</button></div></div>`;
    document.body.appendChild(lockOv);
    lockOv.onclick = (e) => { if (e.target === lockOv) closeLocked(); };
    for (const b of lockOv.querySelectorAll('[data-lk]')) b.onclick = () => { const v = b.dataset.lk; closeLocked(); if (v !== 'ok') playFrom(v); };
    const f = $('.lk-go', lockOv) || $('.lk-ok', lockOv); if (f) f.focus({ preventScroll: true });
  }
  function closeLocked() { if (lockOv) { lockOv.remove(); lockOv = null; } }
  // What's new: games unlocked since the last visit (hub.js plays the lock-breaking on the tile).
  function whatsNew() {
    const el = $('#whats-new'); if (!el || !U) return;
    const fresh = U.fresh().filter((k) => tileOf(k));
    if (!fresh.length) { el.hidden = true; return; }
    const cats = window.GAME_CATS || [];
    const shelf = (k) => { const s = tileOf(k).closest('.shelf'), c = s && cats.find((x) => x.k === s.dataset.shelf); return c ? `${c.icon} ${c.name}` : ''; };
    el.hidden = false;
    el.innerHTML = `<span class="wn-ic" aria-hidden="true">🎉</span><div class="wn-main"><small>WHAT’S NEW</small><b>${fresh.length === 1 ? `${esc(info(fresh[0]).name)} is unlocked!` : `${fresh.length} new games unlocked!`}</b>
      <span>${fresh.map((k) => `${esc(info(k).name)}${shelf(k) ? ` <em>on the ${esc(shelf(k))} shelf</em>` : ''}`).join(' · ')}</span></div>
      <button class="wn-go" data-wn="${esc(fresh[0])}">▶ Play ${esc(info(fresh[0]).name)}</button><button class="wn-x" title="Close">✕</button>`;
    $('.wn-go', el).onclick = () => { el.hidden = true; playFrom(fresh[0]); };
    $('.wn-x', el).onclick = () => { el.hidden = true; };
    if (!reduced) confetti(el, 40);
  }
  function confetti(el, n) {
    const r = el.getBoundingClientRect(), cols = ['#ffd23f', '#ff4f9a', '#3ee6ff', '#2ee6a6', '#ff7134', '#b388ff'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i'); p.className = 'ob-conf'; p.style.left = r.left + r.width * Math.random() + 'px'; p.style.top = r.top + r.height / 2 + 'px'; p.style.background = cols[i % cols.length];
      document.body.appendChild(p);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, d = 80 + Math.random() * 160;
      p.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 160}px) rotate(${Math.random() * 720}deg)`, opacity: 0 }], { duration: 1200 + Math.random() * 600, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(() => p.remove(), () => p.remove());
    }
  }

  // ======================================================================================
  // 1. How it works (about a minute)
  // ======================================================================================
  const HIW = 'box.hiw';
  let host = location.host;
  fetch('/api/info').then((r) => r.json()).then((i) => { if (i && i.baseUrl) host = i.baseUrl.replace(/^https?:\/\//, ''); }).catch(() => {});
  // The cast: made-up characters (portrait.js draws them like bots); emoji if the art isn't there.
  const CAST = [
    { id: 'hiw-ana', name: 'Ana', color: '#ff4f9a', avatar: '🦊' }, { id: 'hiw-ben', name: 'Ben', color: '#3ee6ff', avatar: '🐼' }, { id: 'hiw-cy', name: 'Cy', color: '#ffd23f', avatar: '🦄' },
    { id: 'hiw-dee', name: 'Dee', color: '#2ee6a6', avatar: '🐸' }, { id: 'hiw-eli', name: 'Eli', color: '#b388ff', avatar: '🐯' },
  ];
  const who = (i) => ({ ...CAST[i % CAST.length], bot: true });
  const body = (p, h, o = {}) => (window.BOX && window.BOX.body ? window.BOX.body(p, h, o) : `<span class="hiw-emo" style="font-size:${Math.round(h * 0.6)}px">${esc(p.avatar || '🙂')}</span>`);
  const ME = { body: 'female', skin: '#f3c9a0', hair: 'ponytail', hairColor: '#543626', color: '#ff4f9a', outfit: 'jacket', expression: 'grin', eyes: '#416f91', pants: '#355879', shoes: '#33251d', hat: 'none', accessory: 'none', face: 'round' };
  const OUTFITS = [{}, { hat: 'cowboy', outfit: 'denim', color: '#c0662a' }, { hat: 'top', outfit: 'tux', color: '#2b2b3a' }, { hat: 'wizardHat', outfit: 'wizard', color: '#7b61ff' }, { hat: 'chef', outfit: 'shirt', color: '#ffffff' }, { hat: 'crown', outfit: 'royal', color: '#c9302c' }];
  const PRICES = ['Your character', '🤠 Cowboy hat · 120 JG', '🎩 Top hat & tux · 300 JG', '🧙 Wizard robes · 450 JG', '👨‍🍳 Chef’s hat · 80 JG', '👑 Royal crown · 900 JG'];
  const phone = (inner, cls = '') => `<div class="hiw-phone ${cls}"><div class="hiw-notch"></div><div class="hiw-screen">${inner}</div></div>`;
  const tv = (inner, cls = '') => `<div class="hiw-tv ${cls}"><div class="hiw-tv-screen">${inner}</div><div class="hiw-tv-foot"></div></div>`;
  const qrSrc = () => `/api/qr?text=${encodeURIComponent(location.origin + '/join')}`;
  const tileArt = (k) => { const g = info(k); return g ? `<span class="hiw-tile"><img src="${esc(g.art)}" alt="" onerror="this.remove()"><b>${esc(g.name)}</b></span>` : ''; };

  // Each scene: its caption (also the narration), how long it plays, and its picture.
  const SCENES = [
    { ms: 8000, kicker: 'Welcome!', title: 'This is JustGameBox', say: 'Welcome to JustGameBox: party games for the big screen, and everyone plays from their phone.',
      text: 'Party games for the big screen. Everyone plays from their phone.',
      art: () => `<div class="hiw-logo"><span class="j">Just</span><span class="g">Game</span><span class="b">Box</span></div>
        <div class="hiw-cast">${CAST.map((p, i) => `<span class="hiw-walk" style="--i:${i}">${body(who(i), 220, { mood: i % 2 ? 'grin' : 'smile' })}<i class="hiw-hand">👋</i></span>`).join('')}</div>` },
    { ms: 10000, kicker: 'Step 1', title: 'Your phone is the controller', say: () => `Join with your phone: scan the QR code on the TV, or go to ${host} slash join and type the room code.`,
      text: () => `Scan the QR code on the TV, or go to <b>${esc(host)}/join</b> and type the room code. No app to install.`,
      art: () => `<div class="hiw-join">${tv(`<div class="hiw-lobby"><b>Join on your phone!</b><img class="hiw-qr" src="${qrSrc()}" alt=""><small>Room code</small><span class="hiw-code">PLAY</span></div>`)}
        <div class="hiw-beam" aria-hidden="true"><i></i><i></i><i></i></div>
        ${phone(`<div class="hiw-ph-join"><b class="hiw-ph-logo">Just<span>Game</span><em>Box</em></b><label>Room code</label><span class="hiw-in hiw-type" style="--n:4">PLAY</span><label>Your name</label><span class="hiw-in hiw-type d2" style="--n:3">Ana</span><span class="hiw-btn hiw-tap">Join</span></div>`, 'tilt')}</div>` },
    { ms: 8500, kicker: 'Step 2', title: 'The first to join is the host 👑', say: 'The first person to join is the host. They start the game from their phone. No remote needed.',
      text: 'They start the game from their phone, pick the next game and can skip ahead. No remote needed.',
      art: () => `<div class="hiw-host"><span class="hiw-crowned">${body(who(0), 300, { mood: 'grin' })}<i class="hiw-crown">👑</i></span>
        ${phone(`<div class="hiw-ph-host"><span class="hiw-vip">👑 You’re the host</span><p>Everyone’s in?</p><span class="hiw-btn big hiw-press">Start game ▶</span></div>`)}
        <div class="hiw-friends">${[1, 2, 3].map((i) => `<span style="--i:${i}">${body(who(i), 150)}</span>`).join('')}</div></div>` },
    { ms: 9000, kicker: 'Step 3', title: 'Everything happens on the TV', say: 'Everything happens on the TV. Look up for the action, and down at your phone for your moves, your votes and your secrets.',
      text: 'Look up for the action. Look down at your phone for your moves, your votes and your secrets.',
      art: () => `<div class="hiw-play">${tv(`<div class="hiw-q"><small>MOST LIKELY TO…</small><b>…survive a zombie apocalypse?</b><div class="hiw-votes">${[0, 1, 2, 3].map((i) => `<span style="--i:${i}">${body(who(i), 96)}<i class="hiw-bar" style="--w:${[80, 35, 55, 20][i]}%"></i></span>`).join('')}</div></div>`)}
        <div class="hiw-phones">${[0, 1, 2].map((i) => phone(`<div class="hiw-ph-vote"><small>Who fits best?</small>${[1, 2, 3].map((j) => `<span class="hiw-opt ${j === [1, 3, 1][i] ? 'on' : ''}">${esc(CAST[j].name)}</span>`).join('')}</div>`, 'small d' + i)).join('')}</div></div>` },
    { ms: 9500, kicker: 'Your stuff', title: 'One character, every game', say: 'Every game pays JustGold. Spend it in the shop on outfits and gear. Your character plays in every game.',
      text: 'Every game pays <b>JustGold</b>. Spend it in the shop on outfits and gear: your character plays in every game.',
      art: () => `<div class="hiw-shop"><div class="hiw-coins" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i}">🪙</i>`).join('')}</div>
        <div class="hiw-dress">${OUTFITS.map((o, i) => `<span class="hiw-look" style="--i:${i}">${body({ id: 'hiw-me-' + i, name: 'You', look: { ...ME, ...o } }, 340)}</span>`).join('')}</div>
        <div class="hiw-tags">${PRICES.map((p, i) => `<span class="hiw-tag" style="--i:${i}">${esc(p)}</span>`).join('')}</div>
        <div class="hiw-jg"><span>🪙</span><b class="hiw-count">+15 JG</b><small>for finishing a game</small></div></div>` },
    { ms: 8500, kicker: 'Can’t choose?', title: '🎉 Party Mode', say: 'Can’t decide? Party Mode deals a whole night of games, with a points race all the way to the grand finale.',
      text: 'It deals a whole night of games for your group, with a points race all the way to the grand finale.',
      art: () => { const ks = beginners().slice(0, 4); return `<div class="hiw-party"><div class="hiw-slots">${ks.map((k, i) => `<div class="hiw-slot" style="--i:${i}"><small>Game ${i + 1}</small><div class="hiw-reel"><div class="hiw-strip">${['🎲', '🃏', '🎯', '🧠', '🍕', '📸'].map((e) => `<span>${e}</span>`).join('')}${tileArt(k)}</div></div></div>`).join('')}</div>
        <div class="hiw-race">${[0, 1, 2].map((i) => `<span class="hiw-runner" style="--i:${i}">${body(who(i + 1), 110)}<b>${[42, 37, 30][i]} pts</b></span>`).join('')}</div></div>`; } },
    { ms: 7500, kicker: 'You’re ready!', title: 'Pick a game and play', say: 'That’s it! Pick a game, scan the code and play. New here? Start with the five easy ones.',
      text: 'New here? Start with the five easy ones. Every game starts with a quick practice round that doesn’t count.',
      art: () => `<div class="hiw-end"><div class="hiw-cast big">${CAST.map((p, i) => `<span class="hiw-jump" style="--i:${i}">${body(who(i), 200, { mood: 'grin' })}</span>`).join('')}</div>
        <div class="hiw-end-btns"><button class="hiw-cta" data-hiw="start">👋 Show me the easy ones</button><button class="hiw-again" data-hiw="again">↺ Watch again</button></div></div>` },
  ];
  const TOTAL = SCENES.reduce((s, x) => s + x.ms, 0);
  const val = (v) => (typeof v === 'function' ? v() : v);

  let ov = null, idx = -1, timer = 0, startAt = 0, sceneAt = 0, raf = 0, muted = false;
  function speak(line) {
    if (muted) return;
    try { const A = window.BOX && window.BOX.audio; if (A && A.settings && (A.settings.mute || A.settings.master === 0)) return; } catch { /* fine */ }
    try {
      const V = window.BOX && window.BOX.voice;
      if (V && V.speak && V.clipMs && V.clipMs(line) > 0) { V.speak(line); return; } // a pre-rendered narrator clip
      if (window.speechSynthesis) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(line); u.rate = 1.04; u.pitch = 1.02; speechSynthesis.speak(u); }
    } catch { /* no voice: the captions carry it */ }
  }
  function hush() { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch { /* none */ } try { const V = window.BOX && window.BOX.voice; if (V && V.stop) V.stop(); } catch { /* none */ } }
  function openHiw(auto) {
    if (ov) return;
    ov = document.createElement('div'); ov.className = 'hiw'; ov.id = 'hiw'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'How JustGameBox works');
    ov.innerHTML = `<div class="hiw-bg" aria-hidden="true"><div class="hiw-rays"></div></div>
      <div class="hiw-prog">${SCENES.map(() => '<span><i></i></span>').join('')}</div>
      <div class="hiw-stage" id="hiw-stage"></div>
      <div class="hiw-cap" id="hiw-cap" aria-live="polite"></div>
      <div class="hiw-ctrl"><button class="hiw-mute" id="hiw-mute" title="Narration">🔊</button><span class="hiw-hint">${auto ? 'First time here? This takes a minute.' : ''} Any key skips</span><button class="hiw-next" id="hiw-next">Next ▶</button><button class="hiw-skip" id="hiw-skip">Skip ✕</button></div>`;
    document.body.appendChild(ov); document.body.classList.add('hiw-open');
    $('#hiw-skip', ov).onclick = (e) => { e.stopPropagation(); closeHiw(); };
    $('#hiw-next', ov).onclick = (e) => { e.stopPropagation(); scene(idx + 1); };
    $('#hiw-mute', ov).onclick = (e) => { e.stopPropagation(); muted = !muted; e.currentTarget.textContent = muted ? '🔇' : '🔊'; if (muted) hush(); else speak(val(SCENES[idx].say)); };
    ov.addEventListener('click', (e) => { const b = e.target.closest('[data-hiw]'); if (b) { e.stopPropagation(); if (b.dataset.hiw === 'again') return scene(0); closeHiw(true); return; } if (!e.target.closest('.hiw-ctrl')) scene(idx + 1); });
    set(HIW, '1'); // seen once is enough: it never opens by itself again
    startAt = Date.now();
    requestAnimationFrame(() => ov && ov.classList.add('in'));
    scene(0);
    try { if (window.BOX && window.BOX.audio) window.BOX.audio.music('title', 'menu'); } catch { /* no audio */ }
  }
  function scene(i) {
    if (!ov) return;
    if (i >= SCENES.length) return closeHiw(true);
    clearTimeout(timer); idx = i; sceneAt = Date.now();
    const S = SCENES[i];
    const st = $('#hiw-stage', ov), cap = $('#hiw-cap', ov);
    st.innerHTML = `<div class="hiw-scene s${i}">${S.art()}</div>`;
    cap.innerHTML = `<small>${esc(S.kicker)}</small><h2>${esc(S.title)}</h2><p>${val(S.text)}</p>`;
    cap.classList.remove('pop'); void cap.offsetWidth; cap.classList.add('pop');
    [...ov.querySelectorAll('.hiw-prog span')].forEach((s, k) => { s.className = k < i ? 'past' : k === i ? 'on' : ''; const b = s.querySelector('i'); b.style.animationDuration = S.ms + 'ms'; });
    $('#hiw-next', ov).textContent = i === SCENES.length - 1 ? 'Let’s play! ▶' : 'Next ▶';
    sfx(i ? 'whoosh' : 'start');
    speak(val(S.say));
    if (i < SCENES.length - 1) timer = setTimeout(() => scene(i + 1), S.ms);
    else timer = setTimeout(() => closeHiw(true), S.ms + 6000); // the last scene waits a little for a choice
  }
  // toEasy: land on the "New here?" row.
  function closeHiw(toEasy) {
    if (!ov) return;
    clearTimeout(timer); cancelAnimationFrame(raf); hush();
    const o = ov; ov = null; idx = -1;
    o.classList.add('out'); document.body.classList.remove('hiw-open');
    setTimeout(() => o.remove(), 420);
    sfx('pop');
    if (toEasy) {
      const nh = $('#new-here');
      if (nh && nh.hidden && get(HIDE_NEW) === '1') { try { localStorage.removeItem(HIDE_NEW); } catch { /* private */ } newHere(); }
      const first = $('#new-here:not([hidden]) .nh-card');
      if (first && window.HUB_NAV) { window.HUB_NAV.select(first); first.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }); }
    }
  }
  // Any key skips; Esc too. (The menu's own keys wait while it's open.)
  window.addEventListener('keydown', (e) => {
    if (lockOv) {
      if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); closeLocked(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const f = document.activeElement; if (f && lockOv.contains(f)) f.click(); else closeLocked(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const bs = [...lockOv.querySelectorAll('button')], i = bs.indexOf(document.activeElement); const n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; if (n) n.focus(); }
      e.stopImmediatePropagation(); return;
    }
    if (!ov) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.key === 'ArrowRight') scene(idx + 1); else if (e.key === 'ArrowLeft') scene(Math.max(0, idx - 1)); else closeHiw(e.key === 'Enter' && idx === SCENES.length - 1);
  }, true);

  // ---------- start ----------
  window.HUB_ONBOARD = { locked: lockedCard, howItWorks: () => openHiw(false), newHere, lineupFor, justPick, TOTAL };
  newHere();
  unlockTip();
  whatsNew();
  const link = $('#hiw-open'); if (link) link.onclick = (e) => { e.preventDefault(); e.stopPropagation(); openHiw(false); };
  // The first time this TV opens the title screen (not on a phone, not via a Party Mode link).
  const q = new URLSearchParams(location.search);
  if (q.has('hiw')) setTimeout(() => openHiw(false), 300);
  else if (get(HIW) !== '1' && !narrow() && !q.has('party') && location.hash !== '#party' && !q.has('nohiw')) setTimeout(() => openHiw(true), 700);
})();
