/* Party Mode setup + shuffle (main menu). */
'use strict';
// Party Mode on the JustGameBox main menu: pick how many players, how long and what kinds
// of games, then a deck of game cards is shuffled and dealt into a slot-machine lineup.
// Start opens /box/tv?game=<first>&party=<k1,k2,…>&minutes=<n>.
// Works with mouse, touch and keyboard / TV remote (arrows + Enter, Esc to go back).
(function () {
  const openBtn = document.getElementById('party-open');
  if (!openBtn) return;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sfx = (n) => { try { window.SFX && window.SFX.play(n); } catch { /* no audio */ } };
  const rnd = (n) => Math.floor(Math.random() * n);
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- The games (JustMafia joins as a big game: the party hands over to /mafia and comes back) ----
  // Categories come from public/categories.js and each small game joins the one its main-menu tile
  // names (data-type), so every game with a tile is in Party Mode automatically.
  const CATS = window.GAME_CATS || [{ k: 'create', name: 'Games', icon: '🎲', c: '#ff7134' }];
  const TYPES = CATS.map((c) => ({ ...c, games: [] }));
  for (const tile of document.querySelectorAll('.tiles.small .tile[data-game]')) {
    const t = TYPES.find((x) => x.k === tile.dataset.type) || TYPES[TYPES.length - 1];
    t.games.push(tile.dataset.game);
  }
  TYPES.push({ k: 'big', name: 'Big games', icon: '🏰', games: ['ducks', 'kingdoms', 'mafia'], c: '#f5b400', big: true });
  // Locked games (public/unlocks.js) join the shuffle once this TV has unlocked them.
  for (const t of TYPES) t.games = t.games.filter((k) => !window.UNLOCKS || window.UNLOCKS.has(k));
  for (let i = TYPES.length - 1; i >= 0; i--) if (!TYPES[i].games.length) TYPES.splice(i, 1);
  // Used only if a tile is missing: icon, name, min players, max players, average minutes.
  const FALLBACK = {
    president: ['👑', 'President', 3, 100, 22], blanks: ['🃏', 'JustBlanks', 3, 100, 22], blackjack: ['🃏', 'Blackjack Night', 1, 100, 17],
    bid: ['📦', 'JustBid', 1, 100, 22], price: ['💸', 'Price Panic', 1, 100, 15], emoji: ['😜', 'Emoji Charades', 3, 100, 17],
    truths: ['🤥', 'Two Truths & a Lie', 3, 100, 17], likely: ['👑', 'Most Likely To…', 3, 100, 10], whosaid: ['🕵️', 'Who Said It?', 3, 100, 15],
    spectrum: ['🧭', 'Where Do You Stand?', 3, 100, 15], sketch: ['✏️', 'JustSketch Relay', 3, 100, 15], funny: ['😂', 'JustFunny', 2, 100, 30],
    zombie: ['🧟', 'Zombie Survival', 2, 100, 20], marble: ["🔮", "JustMarble", 1, 12, 12], debate: ["🗣️", "Debate Club", 2, 100, 15], actout: ["🎭", "Act It Out", 2, 100, 15], tune: ["🎵", "Tune Buzz", 2, 100, 15], alien: ["🛸", "Alien Abduction", 2, 100, 15], bomb: ["💣", "Bomb Squad", 2, 100, 15], quickdraw: ["⚡", "Quick Draw", 2, 100, 15], summon: ["⚔️", "JustSummon", 2, 100, 15], letters: ["🔤", "Letter Rush", 2, 100, 15], memes: ["🖼️", "Meme Maker", 2, 100, 15], colormatch: ["🎨", "Color Match", 2, 100, 15], trivia: ["🧠", "Hot Take Trivia", 2, 16, 8], plinko: ["🎯", "JustDrop", 1, 100, 12], ducks: ['🦆', 'JustRaiseDucks', 1, 100, 27], kingdoms: ['🏰', 'JustKingdoms', 2, 100, 40],
    mafia: ['🔪', 'JustMafia', 5, 100, 40],
  };
  const range = (txt) => { const m = txt && txt.match(/(\d+)\s*[–-]\s*(\d+)/); return m ? [Number(m[1]), Number(m[2])] : null; };
  const GAMES = {};
  for (const t of TYPES) for (const k of t.games) {
    const f = FALLBACK[k] || ['🎲', k, 2, 100, 15], tile = document.querySelector(`.tile[data-game="${k}"]`);
    const g = { key: k, type: t.k, big: !!t.big, color: t.c, icon: f[0], name: f[1], min: f[2], max: f[3], avg: f[4] };
    if (tile) {
      const ic = tile.querySelector('.icon'), h = tile.querySelector('h2'), meta = [...tile.querySelectorAll('.meta span')].map((s) => s.textContent);
      if (ic) g.icon = ic.textContent.trim();
      if (h) g.name = h.textContent.trim();
      const pl = range(meta.find((m) => m.includes('👥')) || meta[0]);
      if (pl) { g.min = pl[0]; g.max = pl[1]; }
      // The ideal crowd for the game (data-best="4-10" on its tile).
      const bs = (tile.dataset.best || '').split('-').map(Number); if (bs.length === 2 && bs.every((x) => x > 0)) g.best = bs;
      const tm = range(meta.find((m) => m.includes('⏱')) || meta[1]);
      if (tm) g.avg = Math.round((tm[0] + tm[1]) / 2);
    }
    if (!g.best) g.best = [Math.max(g.min, 2), Math.min(g.max, 12)];
    GAMES[k] = g;
  }
  const typeOf = (k) => TYPES.find((t) => t.k === GAMES[k].type);

  const PLAYERS = [
    { label: '2–3', n: 3, sub: 'Just a few', icon: '👫' },
    { label: '4–8', n: 4, sub: 'A good crowd', icon: '👨‍👩‍👧‍👦' },
    { label: '9–20', n: 9, sub: 'A big party', icon: '🎊' },
    { label: '21+', n: 21, sub: 'The whole room', icon: '🏟️' },
  ];
  const TIMES = [
    { label: '30 min', m: 30, sub: 'A quick round' },
    { label: '1 hour', m: 60, sub: 'A proper party' },
    { label: '1½ hours', m: 90, sub: 'Settle in' },
    { label: '2 hours+', m: 120, sub: 'All night long' },
  ];
  const MOODS = [
    { k: 'all', label: 'Everything', icon: '✨', sub: 'Any game, big ones maybe' },
    { k: 'small', label: 'Small games only', icon: '🎈', sub: 'Quick ones, lots of them' },
    { k: 'big', label: 'Include the big games', icon: '🏰', sub: 'A big game as the finale' },
  ];

  // ---- Options ----
  const opt = { flow: 'auto', p: 1, t: 1, mood: 'all', types: new Set(TYPES.filter((t) => !t.big).map((t) => t.k)), big: 'maybe' };
  try { // start from the main menu's "How many of you?" choice
    const on = document.querySelector('#count .on'), n = on && Number(on.dataset.n);
    if (n) opt.p = n <= 3 ? 0 : n <= 8 ? 1 : n <= 20 ? 2 : 3;
  } catch { /* fine */ }
  const players = () => PLAYERS[opt.p].n;
  const fits = (k) => GAMES[k].min <= players() && GAMES[k].max >= players();
  // How well a game suits the group: the share of the group's size range inside the game's best range.
  const GROUP = [[2, 3], [4, 8], [9, 20], [21, 100]];
  const fitScore = (k) => { const [lo, hi] = GROUP[opt.p], [blo, bhi] = GAMES[k].best; return Math.max(0, Math.min(hi, bhi) - Math.max(lo, blo) + 1) / (hi - lo + 1); };
  // Best-suited games first; games that suit the group equally well stay shuffled.
  const rank = (keys) => shuffle(keys).map((k, i) => [k, fitScore(k) + i * 1e-6]).sort((a, b) => b[1] - a[1]).map((x) => x[0]);
  function setMood(m) {
    opt.mood = m;
    opt.types = new Set(TYPES.filter((t) => !t.big).map((t) => t.k));
    opt.big = m === 'all' ? 'maybe' : m === 'small' ? 'no' : 'yes';
  }
  function poolOf(big) {
    const out = [];
    for (const t of TYPES) {
      if (!!t.big !== big) continue;
      if (big ? opt.big === 'no' : !opt.types.has(t.k)) continue;
      for (const k of t.games) if (fits(k)) out.push(k);
    }
    return out;
  }

  // ---- Building a lineup: fill the time, big games last, no two of a kind in a row ----
  function arrange(keys) {
    const out = [], rest = [...keys];
    while (rest.length) {
      const last = out.length ? GAMES[out[out.length - 1]].type : null;
      let i = rest.findIndex((k) => GAMES[k].type !== last); if (i < 0) i = 0;
      out.push(rest.splice(i, 1)[0]);
    }
    return out;
  }
  function build() {
    const minutes = TIMES[opt.t].m;
    const small = rank(poolOf(false)), bigs = rank(poolOf(true));
    let want = 0;
    if (opt.big === 'yes') want = minutes >= 120 && small.length < 3 ? 2 : 1;
    else if (opt.big === 'maybe') want = minutes >= 60 && Math.random() < 0.5 ? 1 : 0;
    if (!small.length && bigs.length) want = Math.max(want, minutes >= 90 ? 2 : 1);
    let budget = minutes;
    const finale = [];
    // Prefer a big game that fits the time; otherwise the shortest one.
    const bigOrder = [...bigs.filter((k) => GAMES[k].avg <= minutes), ...bigs.filter((k) => GAMES[k].avg > minutes).sort((a, b) => GAMES[a].avg - GAMES[b].avg)];
    for (const k of bigOrder) if (finale.length < want && (finale.length === 0 || GAMES[k].avg <= budget)) { finale.push(k); budget -= GAMES[k].avg; }
    const chosen = [];
    for (const k of small) {
      if (budget <= 3) break;
      if (chosen.length + finale.length && GAMES[k].avg * 0.6 > budget) continue;
      chosen.push(k); budget -= GAMES[k].avg;
    }
    if (!chosen.length && !finale.length && small.length) chosen.push(small[0]);
    return [...arrange(chosen), ...finale.sort((a, b) => GAMES[a].avg - GAMES[b].avg)].slice(0, 20);
  }
  const totalMin = (l) => l.reduce((s, k) => s + GAMES[k].avg, 0);
  const fmtMin = (m) => { m = Math.round(m / 5) * 5; const h = Math.floor(m / 60), r = m % 60; return h ? `${h} h${r ? ' ' + r + ' min' : ''}` : `${r} min`; };

  // ---- The overlay ----
  let root = null, mode = 'closed', lineup = [], runId = 0, skipping = false, lastFocus = null;
  function open() {
    if (root) return;
    lastFocus = document.activeElement;
    root = document.createElement('div');
    root.className = 'pm'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Party Mode');
    root.innerHTML = `<div class="pm-bg" aria-hidden="true"><div class="pm-rays"></div>${Array.from({ length: 14 }, (_, i) => `<i class="pm-dot" style="--x:${(i * 73) % 100}%;--d:${6 + (i * 37) % 9}s;--s:${0.5 + ((i * 29) % 10) / 10};--h:${(i * 47) % 360}deg;--dl:-${(i * 13) % 9}s"></i>`).join('')}</div><div class="pm-body" id="pm-body"></div>`;
    document.body.appendChild(root);
    document.body.classList.add('pm-open');
    sfx('start');
    setup();
    requestAnimationFrame(() => root && root.classList.add('in'));
  }
  function close() {
    if (!root) return;
    runId++;
    const r = root; root = null; mode = 'closed';
    try { if (window.BOX && BOX.audio) BOX.audio.music('title', 'menu'); } catch { /* no audio */ }
    r.classList.remove('in'); r.classList.add('out');
    document.body.classList.remove('pm-open');
    setTimeout(() => r.remove(), 260);
    sfx('whoosh');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  const body = () => root && root.querySelector('#pm-body');
  const focusId = (id) => { const el = root && root.querySelector(`[data-id="${id}"]`); if (el) el.focus({ preventScroll: true }); };

  // ---- Step 1: setup ----
  function setup(focus) {
    mode = 'setup'; runId++; skipping = false;
    const b = body(); if (!b) return;
    const was = focus || (document.activeElement && root.contains(document.activeElement) && document.activeElement.dataset.id) || `p${opt.p}`;
    const small = poolOf(false), big = poolOf(true);
    const can = small.length + big.length > 0;
    const typeCard = (t) => {
      const on = t.big ? opt.big !== 'no' : opt.types.has(t.k);
      const ok = t.games.some(fits);
      const state = t.big ? (opt.big === 'yes' ? 'As the finale' : opt.big === 'maybe' ? 'Maybe, if time allows' : 'Off') : (on ? 'On' : 'Off');
      return `<button class="pm-type pm-f ${on ? 'on' : ''} ${ok ? '' : 'nofit'} ${t.big ? 'big' : ''} ${t.big && opt.big === 'maybe' ? 'maybe' : ''}" data-id="t-${t.k}" data-type="${t.k}" style="--c:${t.c}" aria-pressed="${on}">
        <span class="pm-tick" aria-hidden="true">${on && !(t.big && opt.big === 'maybe') ? '✓' : ''}</span>
        <span class="pm-ticon">${t.icon}</span><b>${esc(t.name)}</b>
        <span class="pm-tgames">${t.games.map((k) => `<span class="${fits(k) ? '' : 'x'}" title="${esc(GAMES[k].name)}">${GAMES[k].icon}</span>`).join('')}</span>
        <small>${ok ? esc(state) : 'Needs more players'}</small></button>`;
    };
    b.innerHTML = `<section class="pm-setup">
      <header class="pm-head"><h1><span class="pm-pop">🎉</span> Party Mode</h1><p>Tell us about tonight and we'll shuffle up a game night, with a points race all the way to the finale.</p></header>
      <div class="pm-q"><h2><span class="pm-num">1</span> How many of you?</h2>
        <div class="pm-opts four">${PLAYERS.map((p, i) => `<button class="pm-opt pm-f ${opt.p === i ? 'on' : ''}" data-id="p${i}" data-p="${i}" aria-pressed="${opt.p === i}"><span class="pm-oi">${p.icon}</span><b>${p.label}</b><small>${p.sub}</small></button>`).join('')}</div></div>
      <div class="pm-q"><h2><span class="pm-num">2</span> How much time have you got?</h2>
        <div class="pm-opts four">${TIMES.map((t, i) => `<button class="pm-opt pm-f ${opt.t === i ? 'on' : ''}" data-id="m${i}" data-t="${i}" aria-pressed="${opt.t === i}"><span class="pm-oi">${['⏱️', '🕐', '🕜', '🌙'][i]}</span><b>${t.label}</b><small>${t.sub}</small></button>`).join('')}</div></div>
      <div class="pm-q"><h2><span class="pm-num">3</span> Which games?</h2>
        <div class="pm-opts three">${MOODS.map((m) => `<button class="pm-opt pm-mood pm-f ${opt.mood === m.k ? 'on' : ''}" data-id="o-${m.k}" data-mood="${m.k}" aria-pressed="${opt.mood === m.k}"><span class="pm-oi">${m.icon}</span><b>${m.label}</b><small>${m.sub}</small></button>`).join('')}</div>
        <div class="pm-types">${TYPES.map(typeCard).join('')}</div></div>
      <div class="pm-q"><h2><span class="pm-num">4</span> Between games</h2>
        <div class="pm-opts two">${[['auto', '⏩', 'Keep it flowing', 'Each game starts right after the standings'], ['lobby', '⚙️', 'Let the host adjust', 'Stop at each game’s settings first']].map(([k, ic, l, sub]) => `<button class="pm-opt pm-f ${opt.flow === k ? 'on' : ''}" data-id="f-${k}" data-flow="${k}" aria-pressed="${opt.flow === k}"><span class="pm-oi">${ic}</span><b>${l}</b><small>${sub}</small></button>`).join('')}</div></div>
      <footer class="pm-foot">
        <button class="pm-btn ghost pm-f" data-id="back" data-act="close">◀ Back</button>
        <div class="pm-sum">${can ? `<b>${small.length + big.length}</b> games in the hat · about <b>${esc(TIMES[opt.t].label)}</b>` : '<b class="pm-warn">Pick at least one kind of game</b>'}</div>
        <button class="pm-btn go pm-f" data-id="go" data-act="go" ${can ? '' : 'disabled'}>🎲 Shuffle the games!</button>
      </footer>
      <p class="pm-keys">Arrow keys to move · Enter to choose · Esc to go back</p>
    </section>`;
    focusId(was);
  }
  function onSetupClick(el) {
    if (el.dataset.p != null) { opt.p = Number(el.dataset.p); sfx('pop'); return setup(el.dataset.id); }
    if (el.dataset.t != null) { opt.t = Number(el.dataset.t); sfx('pop'); return setup(el.dataset.id); }
    if (el.dataset.flow) { opt.flow = el.dataset.flow === 'lobby' ? 'lobby' : 'auto'; sfx('pop'); return setup(el.dataset.id); }
    if (el.dataset.mood) { setMood(el.dataset.mood); sfx('pop'); return setup(el.dataset.id); }
    if (el.dataset.type) {
      const t = TYPES.find((x) => x.k === el.dataset.type);
      if (t.big) opt.big = opt.big === 'no' ? 'yes' : opt.big === 'yes' ? 'no' : 'no';
      else if (opt.types.has(t.k)) opt.types.delete(t.k); else opt.types.add(t.k);
      const allSmall = TYPES.every((x) => x.big || opt.types.has(x.k));
      opt.mood = allSmall && opt.big === 'maybe' ? 'all' : allSmall && opt.big === 'no' ? 'small' : allSmall && opt.big === 'yes' ? 'big' : 'custom';
      sfx(el.classList.contains('on') ? 'click' : 'pop'); return setup(el.dataset.id);
    }
    if (el.dataset.act === 'close') return close();
    if (el.dataset.act === 'go') { lineup = build(); if (!lineup.length) return sfx('shrug'); return shuffleShow(false); }
  }

  // ---- Step 2: the shuffle ----
  const sleep = (ms) => new Promise((r) => (skipping || reduced ? r() : setTimeout(r, ms)));
  const cardFace = (k) => { const g = GAMES[k]; return `<div class="pm-face" style="--c:${g.color}"><span class="pm-ci">${g.icon}</span><b>${esc(g.name)}</b></div><div class="pm-back"><span>?</span></div>`; };
  function anim(el, frames, o) { if (!el.animate || reduced || skipping) { const last = frames[frames.length - 1]; for (const k in last) if (k !== 'offset' && k !== 'easing') el.style[k] = last[k]; return Promise.resolve(); } const a = el.animate(frames, { fill: 'forwards', ...o }); return a.finished.catch(() => {}); }

  function stageHtml() {
    return `<section class="pm-show">
      <header class="pm-shead"><h1 id="pm-title">Shuffling the games…</h1><p id="pm-sub">${esc(PLAYERS[opt.p].label)} players · ${esc(TIMES[opt.t].label)}</p></header>
      <div class="pm-table" id="pm-table"></div>
      <div class="pm-slots" id="pm-slots"></div>
      <footer class="pm-actions" id="pm-actions"><button class="pm-btn ghost small pm-f" data-id="skip" data-act="skip">Skip ⏩</button></footer>
    </section>`;
  }
  // Card and slot sizes that fit the screen.
  function slotSize(n) {
    const W = innerWidth, H = innerHeight;
    const rows = n > 6 ? 2 : 1, per = Math.ceil(n / rows), gap = Math.max(10, W * 0.012);
    let w = Math.min(250, (W * 0.92 - gap * (per - 1)) / per);
    w = Math.min(w, ((H * (rows > 1 ? 0.6 : 0.5)) - gap * (rows - 1)) / rows / 1.38);
    return { w: Math.max(96, Math.floor(w)), gap };
  }
  function slotHtml(i, n) {
    const finale = GAMES[lineup[i]].big;
    return `<div class="pm-slot empty ${finale ? 'finale' : ''}" data-slot="${i}">
      <div class="pm-slot-in">
        <div class="pm-slot-n">${finale ? '🏆 Grand finale' : 'Game ' + (i + 1)}</div>
        <div class="pm-reel"><div class="pm-strip"><span>❔</span></div></div>
        <div class="pm-slot-name">&nbsp;</div>
        <div class="pm-slot-meta">&nbsp;</div>
      </div>
      <button class="pm-re pm-f" data-id="re${i}" data-re="${i}" title="Re-roll this game" aria-label="Re-roll game ${i + 1}">🔀</button>
    </div>`;
  }
  function fillSlot(slot, k) {
    const g = GAMES[k], i = Number(slot.dataset.slot);
    slot.style.setProperty('--c', g.color);
    slot.classList.toggle('finale', g.big);
    slot.querySelector('.pm-slot-n').textContent = g.big ? '🏆 Grand finale' : 'Game ' + (i + 1);
    slot.querySelector('.pm-slot-name').textContent = g.name;
    slot.querySelector('.pm-slot-meta').textContent = `⏱ ~${g.avg} min · ${typeOf(k).name}${opt.p === 0 && g.min > 2 ? ' · 3+ players' : ''}`;
  }

  // Spin one slot's reel and land it on its game.
  function spin(slot, k, ms) {
    return new Promise((resolve) => {
      const strip = slot.querySelector('.pm-strip'), reel = slot.querySelector('.pm-reel');
      const icons = Object.keys(GAMES).map((x) => GAMES[x].icon);
      const m = 16 + rnd(5);
      const seq = Array.from({ length: m }, (_, i) => icons[(rnd(icons.length) + i) % icons.length]);
      seq.push(GAMES[k].icon);
      strip.innerHTML = seq.map((c) => `<span>${c}</span>`).join('');
      slot.classList.remove('empty', 'landed'); slot.classList.add('spinning');
      slot.style.setProperty('--c', GAMES[k].color);
      const h = reel.clientHeight || 100;
      const done = () => {
        strip.style.transform = `translateY(${-m * h}px)`;
        slot.classList.remove('spinning'); slot.classList.add('landed');
        fillSlot(slot, k);
        if (!skipping) { sfx(GAMES[k].big ? 'reveal' : 'flip'); burst(slot, GAMES[k].big ? 26 : 14); }
        resolve();
      };
      if (skipping || reduced) return done();
      const t0 = performance.now(); let last = -1;
      const step = (now) => {
        if (!root || skipping) return done();
        const t = Math.min(1, (now - t0) / ms), p = 1 - Math.pow(1 - t, 3.2);
        const y = p * m * h;
        strip.style.transform = `translateY(${-y}px)`;
        const idx = Math.floor(p * m + 0.5);
        if (idx !== last) { last = idx; if (idx % 2 === 0 || t > 0.6) sfx('tick'); }
        if (t < 1) requestAnimationFrame(step); else done();
      };
      requestAnimationFrame(step);
    });
  }
  // A little burst of confetti from an element.
  function burst(el, n) {
    if (!root || reduced) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * 0.4;
    const cols = ['#ffd23f', '#ff4f9a', '#3ee6ff', '#2ee6a6', '#ff7134', '#b388ff', '#fff'];
    for (let i = 0; i < n; i++) {
      const p = document.createElement('i'); p.className = 'pm-conf';
      p.style.left = cx + 'px'; p.style.top = cy + 'px'; p.style.background = cols[i % cols.length];
      root.appendChild(p);
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * (r.width * 0.9), rot = rnd(720) - 360;
      p.animate([{ transform: 'translate(-50%,-50%) rotate(0deg) scale(1)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 30}px)) rotate(${rot}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.15}px), calc(-50% + ${Math.sin(a) * d + 90}px)) rotate(${rot * 1.6}deg) scale(0.6)`, opacity: 0 }],
      { duration: 900 + rnd(500), easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(() => p.remove(), () => p.remove());
    }
  }

  async function shuffleShow(quick) {
    mode = 'shuffle'; skipping = false;
    try { if (window.BOX && BOX.audio) BOX.audio.music('shuffle', 'party'); } catch { /* no audio */ }
    const id = ++runId, alive = () => id === runId && root;
    const b = body(); b.innerHTML = stageHtml();
    focusId('skip');
    const table = b.querySelector('#pm-table'), slotsEl = b.querySelector('#pm-slots');
    const n = lineup.length, { w, gap } = slotSize(n);
    slotsEl.style.setProperty('--w', w + 'px'); slotsEl.style.setProperty('--gap', gap + 'px');
    slotsEl.style.maxWidth = (Math.ceil(n / (n > 6 ? 2 : 1)) * (w + gap)) + 'px';
    slotsEl.innerHTML = lineup.map((_, i) => slotHtml(i, n)).join('');
    const slots = [...slotsEl.querySelectorAll('.pm-slot')];
    for (const s of slots) s.classList.add('hide');

    // 1. Every game in the hat flies in and fans out.
    const hat = shuffle([...new Set([...poolOf(false), ...poolOf(true), ...lineup])]);
    const deckN = Math.max(hat.length, 8), cw = Math.min(170, innerWidth * 0.11);
    table.style.setProperty('--cw', cw + 'px');
    const cards = Array.from({ length: deckN }, (_, i) => {
      const c = document.createElement('div'); c.className = 'pm-card';
      c.innerHTML = `<div class="pm-card-in">${cardFace(hat[i % hat.length])}</div>`;
      table.appendChild(c); return c;
    });
    const mid = (deckN - 1) / 2, spread = Math.min(9, 110 / deckN);
    const fan = (i) => { const a = (i - mid) * spread * Math.PI / 180, R = cw * 2.6; return `translate(calc(-50% + ${Math.sin(a) * R}px), calc(-50% + ${(1 - Math.cos(a)) * R - cw * 0.2}px)) rotate(${(i - mid) * spread}deg)`; };
    if (!quick) {
      sfx('whoosh');
      await Promise.all(cards.map((c, i) => {
        const a = Math.random() * Math.PI * 2, R = Math.max(innerWidth, innerHeight);
        return anim(c, [{ transform: `translate(calc(-50% + ${Math.cos(a) * R}px), calc(-50% + ${Math.sin(a) * R}px)) rotate(${rnd(720) - 360}deg)` }, { transform: fan(i) }],
          { duration: 700, delay: i * 45, easing: 'cubic-bezier(.2,.9,.25,1.15)' });
      }));
      if (!alive()) return;
      sfx('pop');
      await sleep(550);
    } else cards.forEach((c, i) => anim(c, [{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 }, { transform: fan(i), opacity: 1 }], { duration: 300, delay: i * 15 }));
    if (!alive()) return;

    // 2. Flip them face down, gather into a deck and riffle shuffle.
    cards.forEach((c, i) => setTimeout(() => c.classList.add('down'), skipping ? 0 : i * 25));
    sfx('flip');
    await sleep(380 + deckN * 25);
    const stack = (i) => `translate(calc(-50% + ${(i - mid) * 0.6}px), calc(-50% - ${i * 0.8}px)) rotate(${(i % 3 - 1) * 1.5}deg)`;
    await Promise.all(cards.map((c, i) => anim(c, [{ transform: fan(i) }, { transform: stack(i) }], { duration: 380, easing: 'cubic-bezier(.4,0,.2,1)' })));
    if (!alive()) return;
    let order = cards.map((_, i) => i);
    for (let r = 0; r < (quick ? 2 : 3); r++) {
      sfx('shuffle');
      const off = cw * 0.85;
      await Promise.all(cards.map((c, i) => {
        const left = order.indexOf(i) < deckN / 2;
        return anim(c, [{ transform: stack(order.indexOf(i)) }, { transform: `translate(calc(-50% + ${left ? -off : off}px), calc(-50% - ${(order.indexOf(i) % (deckN / 2 | 0)) * 1.4}px)) rotate(${left ? -10 : 10}deg)` }],
          { duration: 230, easing: 'cubic-bezier(.3,0,.3,1)' });
      }));
      order = shuffle(order);
      cards.forEach((c, i) => { c.style.zIndex = String(order.indexOf(i)); });
      await Promise.all(cards.map((c, i) => anim(c, [{ transform: `translate(calc(-50% + ${order.indexOf(i) % 2 ? cw * 0.85 : -cw * 0.85}px), -50%) rotate(${order.indexOf(i) % 2 ? 10 : -10}deg)` }, { transform: stack(order.indexOf(i)) }],
        { duration: 260, delay: order.indexOf(i) * 12, easing: 'cubic-bezier(.3,0,.2,1.2)' })));
      if (!alive()) return;
    }

    // 3. Deal one card to each slot of the lineup.
    const title = b.querySelector('#pm-title');
    title.textContent = 'Dealing tonight\'s lineup…';
    table.classList.add('up');
    await sleep(480);
    if (!alive()) return;
    const tr = table.getBoundingClientRect(), tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
    let k = 1; try { k = new DOMMatrix(getComputedStyle(table).transform).a || 1; } catch { /* no DOMMatrix */ }
    const top = [...cards].sort((a, c) => Number(c.style.zIndex) - Number(a.style.zIndex));
    await Promise.all(slots.map((s, i) => new Promise((res) => setTimeout(() => {
      if (!alive()) return res();
      const c = top[i % top.length], r = s.getBoundingClientRect();
      const dx = (r.left + r.width / 2 - tx) / k, dy = (r.top + r.height / 2 - ty) / k, sc = r.width / cw / k;
      sfx('deal');
      anim(c, [{ transform: stack(Number(c.style.zIndex) || 0) }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${rnd(20) - 10}deg) scale(${sc})`, opacity: 1, offset: 0.85 }, { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(0deg) scale(${sc})`, opacity: 0 }],
        { duration: 420, easing: 'cubic-bezier(.3,.7,.3,1)' }).then(() => { s.classList.remove('hide'); s.classList.add('dealt'); c.style.visibility = 'hidden'; res(); });
    }, skipping ? 0 : i * 140))));
    if (!alive()) return;
    table.classList.add('gone');

    // 4. The reels: one game at a time.
    const per = n > 6 ? 850 : 1150;
    const spins = [];
    for (let i = 0; i < n; i++) {
      if (!alive()) return;
      const fin = GAMES[lineup[i]].big;
      title.textContent = fin ? '…and the grand finale!' : `Game ${i + 1}…`;
      if (fin && !skipping) { sfx('drum'); await sleep(700); }
      spins.push(spin(slots[i], lineup[i], fin ? per * 1.6 : per));
      await sleep(fin ? per * 1.6 : per * 0.62);
    }
    await Promise.all(spins);
    if (!alive()) return;
    await sleep(250);
    reveal();
  }

  // ---- Step 3: tonight's lineup ----
  function reveal(focus) {
    mode = 'reveal'; skipping = false;
    const b = body(); if (!b) return;
    const slots = [...b.querySelectorAll('.pm-slot')];
    slots.forEach((s, i) => { s.classList.remove('hide', 'empty', 'spinning'); s.classList.add('landed'); fillSlot(s, lineup[i]); const strip = s.querySelector('.pm-strip'); strip.style.transform = ''; strip.innerHTML = `<span>${GAMES[lineup[i]].icon}</span>`; });
    const t = b.querySelector('#pm-table'); if (t) t.classList.add('gone');
    b.querySelector('#pm-title').innerHTML = '🎉 Tonight\'s lineup!';
    sumLine();
    b.querySelector('.pm-show').classList.add('revealed');
    b.querySelector('#pm-actions').innerHTML = `<button class="pm-btn ghost pm-f" data-id="opts" data-act="opts">◀ Change options</button>
      <button class="pm-btn pink pm-f" data-id="reroll" data-act="reroll">🔀 Re-roll</button>
      <button class="pm-btn go pm-f" data-id="start" data-act="start">▶ Start the party</button>`;
    if (!focus) { sfx('chime'); burst(b.querySelector('#pm-title'), 30); }
    focusId(focus || 'start');
  }
  function sumLine() {
    const sub = body().querySelector('#pm-sub');
    const tot = totalMin(lineup);
    sub.innerHTML = `<b>${lineup.length}</b> game${lineup.length === 1 ? '' : 's'} · about <b>${fmtMin(tot)}</b> · ${esc(PLAYERS[opt.p].label)} players · party points all the way to the finale`;
  }
  async function rerollOne(i) {
    const k = lineup[i], big = GAMES[k].big;
    const pool = poolOf(big).filter((x) => !lineup.includes(x));
    const slot = body().querySelector(`.pm-slot[data-slot="${i}"]`);
    if (!pool.length) { sfx('shrug'); slot.classList.remove('nope'); void slot.offsetWidth; slot.classList.add('nope'); return; }
    const prev = lineup[i - 1] && GAMES[lineup[i - 1]].type, next = lineup[i + 1] && GAMES[lineup[i + 1]].type;
    const nice = pool.filter((x) => GAMES[x].type !== prev && GAMES[x].type !== next);
    const pick = (nice.length ? nice : pool)[rnd((nice.length ? nice : pool).length)];
    lineup[i] = pick;
    mode = 'spin1';
    sfx('shuffle');
    await spin(slot, pick, 1000);
    if (!root) return;
    mode = 'reveal'; sumLine();
    focusId('re' + i);
  }
  function onShowClick(el) {
    const a = el.dataset.act;
    if (a === 'skip') { skipping = true; return; }
    if (mode !== 'reveal') return;
    if (el.dataset.re != null) return rerollOne(Number(el.dataset.re));
    if (a === 'opts') { sfx('pop'); return setup('go'); }
    if (a === 'reroll') { lineup = build(); return shuffleShow(true); }
    if (a === 'start') {
      sfx('start');
      root.classList.add('launch');
      // A party needs a box game to start in; a lone JustMafia is just a game of JustMafia.
      const url = lineup.length === 1 && lineup[0] === 'mafia' ? '/mafia' : `/box/tv?game=${encodeURIComponent(lineup[0])}&party=${lineup.map(encodeURIComponent).join(',')}&minutes=${TIMES[opt.t].m}${opt.flow === 'lobby' ? '&flow=lobby' : ''}`;
      try { localStorage.setItem('box.recent', lineup[0]); } catch { /* private */ }
      setTimeout(() => { location.href = url; }, 600);
    }
  }

  // ---- Input: mouse / touch / keyboard ----
  document.addEventListener('click', (e) => {
    if (!root) return;
    const el = e.target.closest('.pm-f, [data-act]');
    if (!el || !root.contains(el) || el.disabled) return;
    e.preventDefault();
    if (mode === 'setup') onSetupClick(el); else onShowClick(el);
  });
  openBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(); }, true);
  // Arrow keys move to the nearest control in that direction.
  function nearest(from, dx, dy) {
    const all = [...root.querySelectorAll('.pm-f')].filter((x) => !x.disabled && x.offsetParent !== null && getComputedStyle(x).visibility !== 'hidden');
    if (!from || !all.includes(from)) return all[0];
    const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bestD = Infinity;
    for (const t of all) {
      if (t === from) continue;
      const b = t.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      const along = (bx - ax) * dx + (by - ay) * dy; if (along <= 4) continue;
      const across = Math.abs((bx - ax) * dy) + Math.abs((by - ay) * dx);
      const d = along + across * 2.2;
      if (d < bestD) { bestD = d; best = t; }
    }
    return best;
  }
  window.addEventListener('keydown', (e) => {
    if (!root) return;
    e.stopPropagation(); // the main menu's own arrow keys wait while Party Mode is open
    const dir = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
    if (dir) {
      e.preventDefault();
      const n = nearest(document.activeElement, dir[0], dir[1]);
      if (n) { n.focus(); n.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); sfx('tick'); }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const f = document.activeElement;
      if (mode === 'shuffle') { skipping = true; return; }
      if (f && root.contains(f) && f.classList.contains('pm-f')) f.click();
    } else if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'BrowserBack' || e.key === 'GoBack') {
      e.preventDefault();
      if (mode === 'setup') close(); else if (mode === 'reveal' || mode === 'shuffle') setup('go');
    }
  }, true);
  // Hovering a control moves the keyboard focus there too, so mouse and remote agree.
  document.addEventListener('mouseover', (e) => { if (!root) return; const el = e.target.closest && e.target.closest('.pm-f'); if (el && root.contains(el) && document.activeElement !== el && !el.disabled) el.focus({ preventScroll: true }); });

  // A link straight into Party Mode: /?party=1 or /#party
  if (/[?&]party=1/.test(location.search) || location.hash === '#party') setTimeout(open, 100);
})();
