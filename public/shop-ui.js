// JustMafia's "Season & unlocks" screen, plus the pixel JustGold pouch and coin.
// Items are bought in the shared JustGold shop (/shop, docs/justgold.md); this screen keeps
// JustMafia's own progression: the season pass (bought here), weekly challenges, worlds,
// Fate, what's still locked, achievements, and what each game unlocked. The server
// (profiles.js) owns JustGold, the pass and Fate; this file only displays them.
(function () {
  const O = window.MT_OPTIONS, C = window.MT_COSMETICS;
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s) => document.querySelector(s);
  const item = (id) => C.CATALOG.find((x) => x.id === id);

  // ---------- pixel JustGold pouch + coin (also used by the end-of-game reward scene) ----------
  function drawPouch(ctx, x, y, s, fill = 1) {
    const r = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x + a * s), Math.round(y + b * s), Math.ceil(w * s), Math.ceil(h * s)); };
    r('#3a2414', -9, -14, 18, 16); r('#7a4a22', -8, -13, 16, 14); r('#9a6230', -7, -12, 6, 10); // bag
    r('#3a2414', -6, -18, 12, 5); r('#b07a3a', -5, -17, 10, 3); r('#e0b048', -7, -14, 14, 2); // neck + string
    if (fill > 0) { r('#ffd23f', -4, -21, 8, 3); r('#fff1a0', -3, -21, 2, 1); } // coins peeking out
    r('#ffd23f', -2, -8, 4, 4); r('#b08020', -1, -7, 2, 2); // clasp
  }
  function drawCoin(ctx, x, y, s, t = 0) {
    const w = Math.max(1, Math.abs(Math.cos(t * 6)) * 6 * s);
    ctx.fillStyle = '#8a5a10'; ctx.fillRect(x - w / 2 - s, y - 4 * s, w + 2 * s, 8 * s);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - w / 2, y - 3 * s, w, 6 * s);
    ctx.fillStyle = '#fff1a0'; ctx.fillRect(x - w / 2, y - 3 * s, Math.max(1, w / 3), 2 * s);
  }
  function pouchButton(profile, id) {
    const gold = profile ? profile.coins : 0;
    return `<button class="pouch" id="${id}" aria-label="JustGold pouch: ${gold} JG"><canvas width="28" height="28" aria-hidden="true"></canvas><b>${gold}</b><span>JG</span></button>`;
  }
  function paintPouches() {
    document.querySelectorAll('.pouch canvas').forEach((cv) => { const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, 28, 28); drawPouch(ctx, 14, 27, 1.2); });
  }
  function pouchDetails(profile) {
    const p = profile || { coins: 0, goldEarned: 0, goldSpent: 0, ledger: [] };
    const rows = (p.ledger || []).slice(0, 6).map((e) => `<li><span>${esc(e.reason)}</span><b class="${e.delta >= 0 ? 'plus' : 'minus'}">${e.delta >= 0 ? '+' : ''}${e.delta}</b></li>`).join('');
    return `<h3 class="pouch-title">🪙 JustGold</h3><div class="pouch-stats"><div><small>Balance</small><b data-gold-balance>${p.coins}</b></div><div><small>Earned</small><b>${p.goldEarned || 0}</b></div><div><small>Spent</small><b>${p.goldSpent || 0}</b></div></div>
      ${rows ? `<ul class="list ledger">${rows}</ul>` : '<p class="small muted">No JustGold yet. Finish games to earn some.</p>'}`;
  }

  // ---------- item previews (pass tiers, world gear, unlocks) ----------
  function lookWith(it, ctx) {
    const slot = C.slotOf(it.field);
    return slot.target === 'home' ? { home: { ...ctx.home, [slot.key]: it.value } } : { avatar: { ...ctx.avatar, [slot.key]: it.value } };
  }
  // A reaction pack shows its six emojis (two rows of three).
  function drawReactionPack(g, value, x, y, size) {
    const pack = (O.REACTION_PACKS || {})[value] || [];
    g.save(); g.font = `${Math.round(size)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    pack.forEach((e, i) => g.fillText(e, x + ((i % 3) - 1) * size * 1.15, y + (Math.floor(i / 3) - 0.5) * size * 1.15));
    g.restore();
  }
  function paintItem(cv, it, ctx) {
    if (!cv || !it) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3), w = cv.clientWidth || 72, h = cv.clientHeight || 72;
    cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, w, h);
    const look = lookWith(it, ctx);
    if (it.field === 'deathAnim' && window.MT_FAREWELL) { window.MT_FAREWELL.preview(g, it.value, w, h, 1.4, ctx.avatar); return; } // a farewell: show it playing
    if (it.field === 'reactions') { drawReactionPack(g, it.value, w / 2, h / 2, Math.min(w, h) / 4.2); return; }
    if (it.field === 'ghostSkin') { g.fillStyle = '#1d2236'; g.fillRect(0, 0, w, h); MTArt.drawGhost(g, w / 2, h * 0.9, look.avatar, { scale: h / 92, t: 1.2, glow: true }); return; } // a ghost look
    if (look.home) {
      const T = window.MT_THEMES, pal = (T.THEMES[ctx.theme] || T.THEMES.smalltown).palette;
      g.fillStyle = pal.grass; g.fillRect(0, 0, w, h);
      window.MT_WORLD.building(g, w / 2, h * .92, Math.max(0, O.houseStyle.indexOf(look.home.style)), pal, { ...window.MT_WORLD.lookOptions(look.home), scale: h / 135, theme: ctx.theme, lit: true });
    } else {
      const head = ['hat', 'hair'].includes(it.field), feet = it.field === 'shoeStyle';
      const s = head ? h / 42 : feet ? h / 26 : h / 80, cy = head ? 52 : feet ? 8 : 34;
      MTArt.drawCharacter(g, w / 2, h / 2 + cy * s, look.avatar, { scale: s, theme: ctx.theme });
    }
  }
  // Paints every <canvas data-paint-item="id"> in the panel.
  function paintAll(opts) {
    const ctx = { avatar: opts.avatar, home: opts.home, theme: opts.theme };
    requestAnimationFrame(() => document.querySelectorAll('#s-grid canvas[data-paint-item]').forEach((cv) => paintItem(cv, item(cv.dataset.paintItem), ctx)));
  }
  const worldEmoji = (id) => (window.MT_THEMES && MT_THEMES.THEMES[id] || {}).emoji || '🗺';

  // ---------- screen ----------
  const TABS = [
    { id: 'season', label: 'Season', icon: '🎟' },
    { id: 'weekly', label: 'Weekly', icon: '📅' },
    { id: 'unlocked', label: 'Unlocked', icon: '🎁' },
    { id: 'worlds', label: 'Worlds', icon: '🗺' },
    { id: 'fate', label: 'Fate', icon: '✦' },
    { id: 'locked', label: 'Locked', icon: '🔒' },
  ];
  let state = { tab: 'season' };
  function render(opts) {
    const { profile } = opts;
    $('#s-pouch-wrap').innerHTML = pouchButton(profile, 's-pouch');
    $('#s-pouch').onclick = () => { const pop = $('#s-pouch-pop'); pop.hidden = !pop.hidden; pop.innerHTML = pouchDetails(profile); };
    if (!TABS.some((t) => t.id === state.tab)) state.tab = TABS[0].id;
    const tabs = $('#s-tabs');
    tabs.style.gridTemplateColumns = `repeat(${TABS.length}, minmax(0,1fr))`;
    tabs.innerHTML = TABS.map((t) => `<button role="tab" class="cas-tab${t.id === state.tab ? ' sel' : ''}" data-season-tab="${t.id}" aria-selected="${t.id === state.tab}"><span aria-hidden="true">${t.icon}</span>${esc(t.label)}</button>`).join('');
    tabs.querySelectorAll('[data-season-tab]').forEach((b) => { b.onclick = () => { state.tab = b.dataset.seasonTab; render(opts); }; });
    const grid = $('#s-grid');
    if (!profile) grid.innerHTML = '<p class="muted">Connecting…</p>';
    else ({ season: renderSeason, weekly: renderWeekly, unlocked: renderUnlocked, worlds: renderWorlds, fate: renderFate, locked: renderLocked })[state.tab](opts, grid);
    paintAll(opts);
    paintPouches();
  }

  // ---------- Season pass (bought here with JustGold: it's a JustMafia mechanic) ----------
  function renderSeason(opts, grid) {
    const { profile } = opts, s = profile.season;
    if (!s) { grid.innerHTML = '<p class="muted">Connecting…</p>'; return; }
    const pct = Math.min(100, Math.round(((s.xp % s.xpPerTier) / s.xpPerTier) * 100)), gold = profile.coins;
    const tierCell = (n) => {
      const r = s.rewards[n] || {}, it = r.item && item(r.item);
      const st = s.granted.includes(n) ? 'got' : n <= s.tier ? (s.owned ? 'got' : 'ready') : n === s.tier + 1 ? 'next' : 'locked';
      return `<div class="pass-tier ${st}" data-tier="${n}"><b>${n}</b>${it ? `<canvas data-paint-item="${esc(it.id)}"></canvas><span>${esc(it.name)}</span>` : `<span class="pass-gold">🪙 ${r.gold} JG</span>`}</div>`;
    };
    grid.innerHTML = `<div class="pass-head">
        <h3>🌕 ${esc(s.name)}</h3>
        <p class="small">Every JustMafia game earns season XP. ${s.owned ? 'Your pass is active: each tier pays out automatically.' : `Get the pass for <b>${s.cost} JG</b> to collect every tier you reach (even ones you already passed).`}</p>
        <div class="pass-xp"><span>Tier <b>${s.tier}</b> / ${s.tiers}</span><div class="bar"><i style="width:${s.tier >= s.tiers ? 100 : pct}%"></i></div><span class="small muted">${s.tier >= s.tiers ? 'Complete!' : `${s.xp % s.xpPerTier}/${s.xpPerTier} XP to tier ${s.tier + 1}`}</span></div>
        ${s.owned ? '<p class="pass-owned">✓ Pass active</p>' : `<button class="btn" data-buy-pass ${gold < s.cost ? 'disabled' : ''}>🎟 Get the pass for ${s.cost} JG</button>${gold < s.cost ? `<p class="err small">You need ${s.cost - gold} more JustGold.</p>` : ''}<p class="err" data-pass-err></p>`}
      </div>
      <div class="pass-track">${Array.from({ length: s.tiers }, (_, i) => tierCell(i + 1)).join('')}</div>`;
    const b = grid.querySelector('[data-buy-pass]');
    if (b) b.onclick = () => opts.buyPass((r) => { if (r && r.ok) render({ ...opts, profile: r.profile }); else grid.querySelector('[data-pass-err]').textContent = (r && r.error) || 'Could not buy the pass.'; });
  }

  // ---------- Weekly challenges ----------
  function renderWeekly(opts, grid) {
    const s = opts.profile.season;
    if (!s) { grid.innerHTML = '<p class="muted">Connecting…</p>'; return; }
    grid.innerHTML = `<h3>📅 Weekly challenges</h3><ul class="challenges">${s.challenges.map((c) => `<li class="${c.done ? 'done' : ''}" data-challenge="${esc(c.id)}"><span>${c.done ? '✅' : '⬜'} ${esc(c.label)}</span><span class="small">${c.progress}/${c.count} · 🪙 ${c.gold} JG</span></li>`).join('')}</ul>
      <p class="small muted">New challenges every week. Each one pays JustGold, a Fate Token and bonus season XP.</p>`;
  }

  // ---------- Unlocked in JustMafia: what each game unlocked, and everything so far ----------
  function renderUnlocked(opts, grid) {
    const { profile } = opts, owned = (i) => i.free || profile.owned.includes(i.id);
    const starter = new Set(C.STARTER_STOCK || []);
    const badge = (i) => (owned(i) ? '<em class="badge own">Owned</em>' : `<em class="badge price">${i.cost} JG</em>`);
    const source = (i) => (i.pass ? `<em class="badge lock">🎟 T${i.passTier}</em>` : i.world ? `<em class="badge lock">${worldEmoji(i.world)}</em>` : i.achievement ? '<em class="badge lock">🏅</em>' : '<em class="badge own">✓</em>');
    const tiles = (list, b) => `<div class="cas-tiles shop-tiles">${list.map((i) => `<div class="cas-tile shop-tile unlock-tile" data-unlock="${esc(i.id)}"><canvas data-paint-item="${esc(i.id)}"></canvas><span>${esc(i.name)}</span>${b(i)}</div>`).join('')}</div>`;
    // The last game: new JustGold-shop stock, world gear, pass items, achievements, Fate.
    const last = profile.lastReward, parts = [];
    if (last) {
      const stock = (last.stock || []).map(item).filter(Boolean), world = ((last.world && last.world.items) || []).map(item).filter(Boolean), pass = ((last.season && last.season.items) || []).map(item).filter(Boolean);
      const ach = (last.lines || []).filter((l) => l.key === 'achievement').map((l) => l.label.replace(/^Achievement: /, ''));
      if (stock.length) parts.push(`<p class="small"><b>New in the JustGold shop</b> (buy them there):</p>${tiles(stock, badge)}`);
      if (world.length || pass.length) parts.push(`<p class="small"><b>Earned</b> (already yours):</p>${tiles([...world, ...pass], source)}`);
      if (ach.length) parts.push(`<p class="small">🏅 Achievement${ach.length === 1 ? '' : 's'}: <b>${ach.map(esc).join(', ')}</b></p>`);
      if (last.fate) parts.push(`<p class="small">✦ +${last.fate} Fate Token${last.fate === 1 ? '' : 's'}</p>`);
      if (last.coins) parts.push(`<p class="small">🪙 +${last.coins} JG</p>`);
    }
    const fromPlay = (profile.stock || []).filter((id) => !starter.has(id)).reverse().map(item).filter(Boolean);
    const earned = profile.owned.map(item).filter((i) => i && (i.pass || i.world || i.achievement));
    grid.innerHTML = `<div class="unlocked-head"><h3>🎁 Unlocked in JustMafia</h3>
        <p class="small">Every JustMafia game unlocks something: new items for the JustGold shop, world gear, season rewards and achievements. Spend JustGold and change your look in the JustGold shop (link above).</p></div>
      <h4 class="locked-sub">Last game</h4>${last ? (parts.join('') || '<p class="small muted">Nothing new last game. Keep playing!</p>') : '<p class="small muted">Finish a JustMafia game to see what it unlocks.</p>'}
      <h4 class="locked-sub">Unlocked for the JustGold shop (${fromPlay.length})</h4>${fromPlay.length ? tiles(fromPlay, badge) : '<p class="small muted">Every finished game puts a new item in the JustGold shop.</p>'}
      <h4 class="locked-sub">Earned rewards (${earned.length})</h4>${earned.length ? tiles(earned, source) : '<p class="small muted">Season tiers, worlds and achievements give items you don’t buy.</p>'}`;
  }

  // ---------- Fate: tokens and one-time Fate Cards ----------
  function renderFate(opts, grid) {
    const { profile } = opts, F = C.FATE;
    if (typeof profile.fate !== 'number') { grid.innerHTML = '<p class="muted">Connecting…</p>'; return; }
    const owned = profile.fateCards || {};
    grid.innerHTML = `<div class="fate-head"><h3>✦ Fate Tokens: <b>${profile.fate}</b></h3>
        <p class="small">A second currency, just for Fate Cards: one-time tricks that bend which role you get. Earn tokens by winning (+${F.perWin}), finishing a weekly challenge (+${F.perChallenge}) and visiting a new world (+${F.perNewWorld}).</p>
        <button class="btn ghost small" data-fate-exchange ${profile.coins < F.exchangeGold ? 'disabled' : ''}>Trade ${F.exchangeGold} JG for 1 token</button><p class="err small" data-fate-err></p></div>
      <div class="fate-cards">${Object.entries(F.cards).map(([id, c]) => `<div class="fate-card"><div class="fc-face"><span class="fc-icon">${c.icon}</span><b>${esc(c.name)}</b><small>${esc(c.text)}</small></div>
        <div class="fc-foot"><span>You have <b>${owned[id] || 0}</b></span><button class="btn small" data-fate-buy="${id}" ${profile.fate < c.cost ? 'disabled' : ''}>Buy · ✦${c.cost}</button></div></div>`).join('')}</div>
      <p class="small muted">How to use them: wishes are made on your phone in the lobby before the game starts. Reroll appears while you look at your dealt role. A wish is only spent if it comes true.</p>`;
    const err = (r) => { const el = grid.querySelector('[data-fate-err]'); if (el) el.textContent = (r && r.error) || ''; };
    grid.querySelectorAll('[data-fate-buy]').forEach((b) => { b.onclick = () => opts.fateBuy && opts.fateBuy(b.dataset.fateBuy, (r) => { if (r && r.ok) render({ ...opts, profile: r.profile }); else err(r); }); });
    const ex = grid.querySelector('[data-fate-exchange]'); if (ex) ex.onclick = () => opts.fateExchange && opts.fateExchange((r) => { if (r && r.ok) render({ ...opts, profile: r.profile }); else err(r); });
  }

  // ---------- Locked: what playing JustMafia unlocks next, and achievements ----------
  function renderLocked(opts, grid) {
    const { profile } = opts, owned = (i) => i.free || profile.owned.includes(i.id);
    const stocked = (i) => (profile.stock || []).includes(i.id);
    const hidden = C.STOCKABLE.filter((i) => !stocked(i) && !owned(i));
    const S = C.STOCK, next = C.nextStock(profile.stock || [], 3).map(item).filter(Boolean);
    const byCat = C.CATEGORIES.map((c) => ({ c, n: hidden.filter((i) => i.category === c.id).length })).filter((x) => x.n);
    const stats = profile.stats || {};
    const ach = Object.entries(C.ACHIEVEMENTS).map(([key, a]) => ({ key, a, done: (profile.achievements || []).includes(key), reward: C.CATALOG.find((i) => i.achievement === key) }));
    grid.innerHTML = `<div class="locked-head"><h3>🔒 ${hidden.length} items still locked</h3>
        <p class="small">Playing JustMafia unlocks new items for the JustGold shop, where you buy them with JustGold.</p></div>
      <ul class="unlock-rules">
        <li><span>✅ Finish any game</span><b>+${S.finished} new item</b></li>
        <li><span>🏆 Win a game</span><b>+${S.won} more</b></li>
        <li><span>🗺 Your first game in a new world</span><b>+${S.newWorld} more</b></li>
        <li><span>🎟 Season pass tiers · 🗺 World gear · 🏅 Achievements</span><b>their own rewards</b></li>
      </ul>
      ${next.length ? `<h4 class="locked-sub">Coming next</h4>
      <div class="cas-tiles shop-tiles locked-tiles">${next.map((i) => `<div class="cas-tile shop-tile mystery"><canvas data-paint-item="${esc(i.id)}"></canvas><span>???</span><em class="badge lock">${esc((C.CATEGORIES.find((c) => c.id === i.category) || {}).label || '')}</em></div>`).join('')}</div>` : ''}
      ${byCat.length ? `<h4 class="locked-sub">Still hidden</h4><ul class="unlock-rules">${byCat.map(({ c, n }) => `<li><span>${c.icon} ${esc(c.label)}</span><b>${n} hidden</b></li>`).join('')}</ul>` : ''}
      <h4 class="locked-sub">🏅 Achievements (${ach.filter((x) => x.done).length}/${ach.length})</h4>
      <ul class="unlock-rules achievements">${ach.map(({ key, a, done, reward }) => `<li class="${done ? 'done' : ''}" data-achievement="${esc(key)}"><span>${done ? '✅' : '⬜'} ${esc(a.label)}${reward ? `<small class="muted"> · ${esc(reward.name)}</small>` : ''}</span><b>${done ? 'Done' : `${Math.min(a.count, stats[a.stat] || 0)}/${a.count}`}</b></li>`).join('')}</ul>`;
  }

  // ---------- Worlds: explore every theme to earn its cosmetics ----------
  function renderWorlds(opts, grid) {
    const { profile, theme } = opts, worlds = profile.worlds;
    if (!worlds) { grid.innerHTML = '<p class="muted">Connecting…</p>'; return; }
    const T = window.MT_THEMES ? MT_THEMES.THEMES : {};
    const explored = worlds.filter((w) => w.games > 0).length, found = worlds.reduce((n, w) => n + w.rewards.filter((r) => r.owned).length, 0), total = worlds.reduce((n, w) => n + w.rewards.length, 0);
    const cur = worlds.find((w) => w.id === theme);
    grid.innerHTML = `<div class="worlds-head"><h3>🗺 Worlds</h3><p class="small">Every world has its own map, roles, weapons and narrator. Finish games there to earn its gear. The Judge picks the world in Setup → Theme.</p>
      <p class="small"><b>${explored}</b> of ${worlds.length} worlds explored · <b>${found}</b> of ${total} rewards found</p>
      ${cur ? `<p class="small">${worldEmoji(cur.id)} You are playing in <b>${esc(cur.name)}</b>: finish this game to count it toward its rewards.</p>` : ''}</div>
      <div class="worlds-grid">${worlds.map((w) => {
        const th = T[w.id] || {}, pal = th.palette || {}, here = w.id === theme, next = w.rewards.find((r) => !r.owned);
        const pct = next ? Math.min(100, Math.round((w.games / next.games) * 100)) : 100;
        return `<div class="world-card${here ? ' here' : ''}${w.games ? '' : ' unexplored'}" style="--wa:${pal.grass || '#7cbf5a'};--wb:${pal.grassDark || '#5c9443'};--wr:${(pal.roofs || ['#c0392b'])[0]};--ww:${pal.water || '#4aa3d9'}">
          <div class="world-map" aria-hidden="true"><i class="wm-pond"></i><i class="wm-house a"></i><i class="wm-house b"></i><i class="wm-house c"></i><span class="wm-emoji">${th.emoji || '🗺'}</span></div>
          <div class="world-body"><b>${esc(w.name)}</b><span class="small muted">${esc(th.townName || '')}</span>
            ${here ? '<span class="world-here">📍 You are here</span>' : ''}
            <div class="world-bar"><i style="width:${pct}%"></i></div>
            <span class="small">${w.games} game${w.games === 1 ? '' : 's'} played${next ? ` · next reward at ${next.games}` : ' · all found ✓'}</span>
            <div class="world-rewards">${w.rewards.map((r) => { const it = item(r.item); return `<div class="world-reward${r.owned ? ' got' : ''}" title="${esc(it ? it.name : r.item)}"><canvas data-paint-item="${esc(r.item)}"></canvas><span>${r.owned ? '✓' : '🔒 ' + r.games}</span></div>`; }).join('')}</div>
          </div></div>`;
      }).join('')}</div>`;
  }

  window.MT_SHOP = { render, open(tab) { state.tab = tab || state.tab || 'season'; }, drawPouch, drawCoin, pouchButton, pouchDetails, paintPouches };
})();
