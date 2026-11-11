// In-game shop (Zelda-style counter shop), gold pouch and inventory.
// Prices, ownership and gold are enforced by the server (profiles.js); this file
// only displays them. Items come from MT_COSMETICS.CATALOG, so new catalog
// entries appear here without changes.
(function () {
  const O = window.MT_OPTIONS, C = window.MT_COSMETICS, TAU = Math.PI * 2;
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s) => document.querySelector(s);

  // ---------- pixel gold pouch + coin (also used by the end-of-game reward scene) ----------
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
    return `<button class="pouch" id="${id}" aria-label="Gold pouch: ${gold} gold"><canvas width="28" height="28" aria-hidden="true"></canvas><b>${gold}</b><span>gold</span></button>`;
  }
  function paintPouches() {
    document.querySelectorAll('.pouch canvas').forEach((cv) => { const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, 28, 28); drawPouch(ctx, 14, 27, 1.2); });
  }
  function pouchDetails(profile) {
    const p = profile || { coins: 0, goldEarned: 0, goldSpent: 0, ledger: [] };
    const rows = (p.ledger || []).slice(0, 6).map((e) => `<li><span>${esc(e.reason)}</span><b class="${e.delta >= 0 ? 'plus' : 'minus'}">${e.delta >= 0 ? '+' : ''}${e.delta}</b></li>`).join('');
    return `<div class="pouch-stats"><div><small>Balance</small><b data-gold-balance>${p.coins}</b></div><div><small>Earned</small><b>${p.goldEarned || 0}</b></div><div><small>Spent</small><b>${p.goldSpent || 0}</b></div></div>
      ${rows ? `<ul class="list ledger">${rows}</ul>` : '<p class="small muted">No gold yet. Finish games to earn gold.</p>'}`;
  }

  // ---------- previews ----------
  function lookWith(item, ctx) {
    const slot = C.slotOf(item.field);
    return slot.target === 'home' ? { home: { ...ctx.home, [slot.key]: item.value } } : { avatar: { ...ctx.avatar, [slot.key]: item.value } };
  }
  function paintItem(cv, item, ctx) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3), w = cv.clientWidth || 72, h = cv.clientHeight || 72;
    cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, w, h);
    const look = lookWith(item, ctx);
    if (item.field === 'deathAnim' && window.MT_FAREWELL) { window.MT_FAREWELL.preview(g, item.value, w, h, 1.4, ctx.avatar); return; } // a farewell: show it playing
    if (look.home) {
      const T = window.MT_THEMES, pal = (T.THEMES[ctx.theme] || T.THEMES.smalltown).palette;
      g.fillStyle = pal.grass; g.fillRect(0, 0, w, h);
      window.MT_WORLD.building(g, w / 2, h * .92, Math.max(0, O.houseStyle.indexOf(look.home.style)), pal, { ...window.MT_WORLD.lookOptions(look.home), scale: h / 135, theme: ctx.theme, lit: true });
    } else {
      const head = ['hat', 'hair'].includes(item.field), feet = item.field === 'shoeStyle';
      const s = head ? h / 42 : feet ? h / 26 : h / 80, cy = head ? 52 : feet ? 8 : 34;
      MTArt.drawCharacter(g, w / 2, h / 2 + cy * s, look.avatar, { scale: s, theme: ctx.theme });
    }
  }

  // ---------- the shop interior (canvas) ----------
  const KEEPER = { color: '#7a4a2a', skin: '#d9a273', hair: 'bald', hairColor: '#543626', facialHair: 'moustache', eyes: '#342b25', face: 'round', expression: 'grin', outfit: 'merchant', pants: '#2d2f3a', hat: 'none', accessory: 'monocle' };
  let scene = { raf: 0 };
  function startScene(getState) {
    cancelAnimationFrame(scene.raf);
    const frame = (now) => {
      const cv = $('#s-scene');
      if (!cv || $('#screen-shop').hidden) return;
      const st = getState(), t = now / 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, 3), w = cv.clientWidth || 360, h = cv.clientHeight || 220;
      if (cv.width !== Math.round(w * dpr)) { cv.width = w * dpr; cv.height = h * dpr; }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false;
      const u = h / 220, rsp = st.theme === 'rsp';
      // back wall planks, shelves with the current tab's wares, a hanging sign
      g.fillStyle = rsp ? '#1f3f86' : '#6b4426'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 22 * u) { g.fillStyle = rsp ? '#24489a' : '#78502e'; g.fillRect(x, 0, 2 * u, h * .62); }
      for (const sy of [52, 104]) { g.fillStyle = rsp ? '#ffd21f' : '#4a2e18'; g.fillRect(0, sy * u, w, 6 * u); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, (sy + 6) * u, w, 4 * u); }
      g.fillStyle = rsp ? '#0f2a63' : '#3a2414'; g.fillRect(w / 2 - 70 * u, 6 * u, 140 * u, 24 * u);
      g.fillStyle = rsp ? '#ffd21f' : '#f0d29a'; g.font = `700 ${Math.round(14 * u)}px 'Pixelify Sans', monospace`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(rsp ? 'RSP SUPPLY STORE' : 'TOWN SHOP', w / 2, 18 * u);
      (st.shelf || []).forEach((item, i) => {
        const col = i % 6, row = Math.floor(i / 6); if (row > 1) return;
        const x = w * (col + .5) / 6, y = (row ? 104 : 52) * u;
        const look = lookWith(item, st);
        if (look.home) window.MT_WORLD.building(g, x, y, Math.max(0, O.houseStyle.indexOf(look.home.style)), (window.MT_THEMES.THEMES[st.theme] || window.MT_THEMES.THEMES.smalltown).palette, { ...window.MT_WORLD.lookOptions(look.home), scale: .22 * u, theme: st.theme, lit: true });
        else MTArt.drawCharacter(g, x, y, look.avatar, { scale: .5 * u, theme: st.theme });
        if (item.field === 'deathAnim' && window.MT_FAREWELL) window.MT_FAREWELL.draw(g, item.value, x, y, .5 * u, t + i, { avatar: st.avatar });
        if (st.selected && st.selected.id === item.id) { g.strokeStyle = '#ffe066'; g.lineWidth = 2; g.strokeRect(x - 16 * u, y - 44 * u, 32 * u, 46 * u); }
      });
      // shopkeeper behind the counter (bobs, blinks), counter, selected item on a cushion
      MTArt.drawCharacter(g, w * .3, h * .9, KEEPER, { scale: 1.5 * u, t, seed: 3, theme: st.theme === 'rsp' ? 'rsp' : undefined });
      g.fillStyle = rsp ? '#0f2a63' : '#4a2e18'; g.fillRect(0, h * .74, w, h * .26);
      g.fillStyle = rsp ? '#ffd21f' : '#8f5e34'; g.fillRect(0, h * .74, w, 6 * u);
      g.fillStyle = 'rgba(0,0,0,.2)'; for (let x = 0; x < w; x += 30 * u) g.fillRect(x, h * .78, 2 * u, h * .22);
      if (st.selected) {
        const sel = st.selected, look = lookWith(sel, st), cx = w * .62, cy = h * .74;
        g.fillStyle = '#a8323a'; g.fillRect(cx - 34 * u, cy - 4 * u, 68 * u, 6 * u); g.fillStyle = '#d2a64a'; g.fillRect(cx - 34 * u, cy - 4 * u, 68 * u, 1 * u);
        const bob = Math.sin(t * 3) * 2 * u;
        if (look.home) window.MT_WORLD.building(g, cx, cy - 4 * u + bob, Math.max(0, O.houseStyle.indexOf(look.home.style)), (window.MT_THEMES.THEMES[st.theme] || window.MT_THEMES.THEMES.smalltown).palette, { ...window.MT_WORLD.lookOptions(look.home), scale: .55 * u, theme: st.theme, lit: true, time: t });
        else MTArt.drawCharacter(g, cx, cy - 4 * u + bob, look.avatar, { scale: 1.1 * u, theme: st.theme, t });
        if (sel.field === 'deathAnim' && window.MT_FAREWELL) window.MT_FAREWELL.draw(g, sel.value, cx, cy - 4 * u, 1.1 * u, t, { avatar: st.avatar }); // the farewell, looping
        // price tag
        const owned = st.owned(sel), tag = sel.achievement && !owned ? 'LOCKED' : owned ? 'OWNED' : String(sel.cost);
        g.fillStyle = '#f6ecd0'; g.fillRect(cx + 26 * u, cy - 60 * u, 44 * u, 18 * u); g.fillStyle = '#3a2414'; g.fillRect(cx + 26 * u, cy - 60 * u, 44 * u, 2 * u);
        if (!owned && !sel.achievement) drawCoin(g, cx + 34 * u, cy - 51 * u, u * .9, t);
        g.fillStyle = '#3a2414'; g.font = `700 ${Math.round(11 * u)}px 'Pixelify Sans', monospace`; g.fillText(tag, cx + (owned || sel.achievement ? 48 : 54) * u, cy - 50 * u);
      }
      cv.dataset.selected = st.selected ? st.selected.id : '';
      scene.raf = requestAnimationFrame(frame);
    };
    scene.raf = requestAnimationFrame(frame);
  }

  // ---------- screen ----------
  let state = { tab: C.CATEGORIES[0].id, selectedId: null, say: '' };
  const SAY = {
    hello: 'Welcome, welcome! Have a look around.',
    pick: (i) => `Ah, the ${i.name}! That'll be ${i.cost} gold.`,
    owned: (i) => `The ${i.name}? You already own it. Wear it in good health!`,
    poor: (i, gold) => `The ${i.name} is ${i.cost} gold, friend. You have ${gold}. Come back after a few more games!`,
    locked: (i) => `The ${i.name} isn't for sale. You earn it: ${C.ACHIEVEMENTS[i.achievement].label}.`,
    bought: (i) => `Thank you! The ${i.name} is yours. Equip it from your inventory.`,
  };
  function render(opts) {
    const { profile, avatar, home, theme, buy, equip } = opts;
    const owned = (i) => i.free || !!profile && profile.owned.includes(i.id);
    const forSale = (cat) => C.CATALOG.filter((i) => i.category === cat && !i.free);
    $('#s-title').textContent = theme === 'rsp' ? 'RSP Supply Store' : 'Town Shop';
    $('#s-pouch-wrap').innerHTML = pouchButton(profile, 's-pouch');
    $('#s-pouch').onclick = () => { const pop = $('#s-pouch-pop'); pop.hidden = !pop.hidden; pop.innerHTML = pouchDetails(profile); };
    const tabs = [{ id: 'season', label: 'Season', icon: '🎟' }, { id: 'worlds', label: 'Worlds', icon: '🗺' }, ...C.CATEGORIES.filter((c) => forSale(c.id).length), { id: 'inventory', label: 'Inventory', icon: '🎒' }];
    if (!tabs.some((t) => t.id === state.tab)) state.tab = tabs[0].id;
    $('#s-tabs').style.gridTemplateColumns = `repeat(${tabs.length > 6 ? Math.ceil(tabs.length / 2) : tabs.length}, minmax(0,1fr))`; // two rows when there are many tabs, so labels stay readable
    $('#s-tabs').innerHTML = tabs.map((t) => `<button role="tab" class="cas-tab${t.id === state.tab ? ' sel' : ''}" data-shop-tab="${t.id}" aria-selected="${t.id === state.tab}"><span aria-hidden="true">${t.icon}</span>${esc(t.label)}</button>`).join('');
    $('#s-tabs').querySelectorAll('[data-shop-tab]').forEach((b) => { b.onclick = () => { state.tab = b.dataset.shopTab; state.selectedId = null; render(opts); }; });
    if (state.tab === 'season') { renderSeason(opts); paintPouches(); return; }
    if (state.tab === 'worlds') { renderWorlds(opts); paintPouches(); return; }
    const inv = state.tab === 'inventory';
    const items = inv ? (profile ? profile.inventory : []).map((x) => C.CATALOG.find((i) => i.id === x.id)).filter(Boolean) : forSale(state.tab);
    const selected = items.find((i) => i.id === state.selectedId) || null;
    const gold = profile ? profile.coins : 0;
    $('#s-grid').innerHTML = items.length ? `<div class="cas-tiles shop-tiles">${items.map((i) => {
      const own = owned(i), equipped = inv && (profile.inventory.find((x) => x.id === i.id) || {}).equipped;
      const badge = equipped ? '<em class="badge eq">Equipped</em>' : own ? '<em class="badge own">Owned</em>' : i.pass ? `<em class="badge lock">🎟 T${i.passTier}</em>` : i.world ? `<em class="badge lock">${worldEmoji(i.world)} ${i.worldGames}</em>` : i.achievement ? '<em class="badge lock">🔒</em>' : `<em class="badge price${gold < i.cost ? ' poor' : ''}">${i.cost}g</em>`;
      return `<button class="cas-tile shop-tile${i.id === state.selectedId ? ' sel' : ''}" data-item="${esc(i.id)}" aria-pressed="${i.id === state.selectedId}"><canvas></canvas><span>${esc(i.name)}</span>${badge}</button>`;
    }).join('')}</div>` : `<p class="muted">${inv ? 'Your inventory is empty. Buy something from the shop tabs!' : 'Nothing for sale here yet.'}</p>`;
    $('#s-grid').querySelectorAll('[data-item]').forEach((b) => { b.onclick = () => {
      state.selectedId = b.dataset.item; const i = C.CATALOG.find((x) => x.id === state.selectedId);
      state.say = owned(i) ? SAY.owned(i) : i.pass ? `The ${i.name}? Not for sale. It's a Season pass reward at tier ${i.passTier}.` : i.world ? `Can't sell you that one. Explore ${C.WORLD_NAMES[i.world]} and it's yours.` : i.achievement && !(profile && profile.achievements.includes(i.achievement)) ? SAY.locked(i) : gold < i.cost ? SAY.poor(i, gold) : SAY.pick(i);
      render(opts);
    }; });
    const ctx = { avatar, home, theme };
    requestAnimationFrame(() => $('#s-grid').querySelectorAll('[data-item]').forEach((b) => paintItem(b.querySelector('canvas'), C.CATALOG.find((x) => x.id === b.dataset.item), ctx)));
    // detail panel: name, description, price, and the one action that applies
    const d = $('#s-detail');
    if (!selected) d.innerHTML = `<p class="muted">${inv ? 'Tap an item to equip or unequip it.' : 'Tap an item to see it up close.'}</p>`;
    else {
      const own = owned(selected), invEntry = profile && profile.inventory.find((x) => x.id === selected.id);
      const lockedBy = selected.pass ? `Season pass tier ${selected.passTier}` : selected.world ? `finish ${selected.worldGames === 1 ? 'a game' : selected.worldGames + ' games'} in ${C.WORLD_NAMES[selected.world]}` : selected.achievement && !(profile && profile.achievements.includes(selected.achievement)) ? C.ACHIEVEMENTS[selected.achievement].label : null;
      const cant = !own && (lockedBy ? 'Unlock: ' + lockedBy : gold < selected.cost ? `Need ${selected.cost - gold} more gold` : '');
      const action = own
        ? `<button class="btn" data-equip="${invEntry && invEntry.equipped ? 'off' : 'on'}">${invEntry && invEntry.equipped ? 'Unequip' : 'Equip'}</button>`
        : `<button class="btn" data-buy ${cant || !profile ? 'disabled' : ''}>${lockedBy ? '🔒 Locked' : `Buy for ${selected.cost} gold`}</button>`;
      d.innerHTML = `<h3>${esc(selected.name)}</h3><p>${esc(selected.description)}</p>
        <p class="small"><b>Price:</b> ${selected.achievement ? 'Achievement reward' : selected.cost + ' gold'} · <b>Your gold:</b> <span data-gold>${gold}</span></p>
        ${cant ? `<p class="err" data-cant>${esc(cant)}</p>` : ''}${action}<p class="err" data-shop-err></p>`;
      const b = d.querySelector('[data-buy]');
      if (b) b.onclick = () => buy(selected.id, (r) => { if (r && r.ok) { state.say = SAY.bought(selected); render({ ...opts, profile: r.profile }); } else d.querySelector('[data-shop-err]').textContent = (r && r.error) || 'Could not buy.'; });
      const e = d.querySelector('[data-equip]');
      if (e) e.onclick = () => equip(selected.id, e.dataset.equip === 'on', (r) => { if (!r || !r.ok) d.querySelector('[data-shop-err]').textContent = (r && r.error) || 'Could not equip.'; });
    }
    $('#s-say').textContent = state.say || SAY.hello;
    const shelf = (inv ? items : forSale(state.tab)).slice(0, 12);
    startScene(() => ({ theme, avatar, home, shelf, selected, owned }));
    paintPouches();
  }
  // ---------- Worlds: explore every theme to earn its cosmetics ----------
  const worldEmoji = (id) => (window.MT_THEMES && MT_THEMES.THEMES[id] || {}).emoji || '🗺';
  function renderWorlds(opts) {
    const { profile, avatar, theme } = opts;
    const worlds = profile && profile.worlds;
    if (!worlds) { $('#s-grid').innerHTML = '<p class="muted">Connecting…</p>'; $('#s-detail').innerHTML = ''; return; }
    const T = window.MT_THEMES ? MT_THEMES.THEMES : {};
    const explored = worlds.filter((w) => w.games > 0).length, items = worlds.reduce((n, w) => n + w.rewards.filter((r) => r.owned).length, 0), total = worlds.reduce((n, w) => n + w.rewards.length, 0);
    $('#s-grid').innerHTML = `<div class="worlds-head"><h3>🗺 Worlds</h3><p class="small">Every world has its own map, roles, weapons and narrator. Finish games there to earn its gear. The Judge picks the world in Setup → Theme.</p>
      <p class="small"><b>${explored}</b> of ${worlds.length} worlds explored · <b>${items}</b> of ${total} rewards found</p></div>
      <div class="worlds-grid">${worlds.map((w) => {
        const th = T[w.id] || {}, pal = th.palette || {}, here = w.id === theme, next = w.rewards.find((r) => !r.owned);
        const pct = next ? Math.min(100, Math.round((w.games / next.games) * 100)) : 100;
        return `<div class="world-card${here ? ' here' : ''}${w.games ? '' : ' unexplored'}" style="--wa:${pal.grass || '#7cbf5a'};--wb:${pal.grassDark || '#5c9443'};--wr:${(pal.roofs || ['#c0392b'])[0]};--ww:${pal.water || '#4aa3d9'}">
          <div class="world-map" aria-hidden="true"><i class="wm-pond"></i><i class="wm-house a"></i><i class="wm-house b"></i><i class="wm-house c"></i><span class="wm-emoji">${th.emoji || '🗺'}</span></div>
          <div class="world-body"><b>${esc(w.name)}</b><span class="small muted">${esc(th.townName || '')}</span>
            ${here ? '<span class="world-here">📍 You are here</span>' : ''}
            <div class="world-bar"><i style="width:${pct}%"></i></div>
            <span class="small">${w.games} game${w.games === 1 ? '' : 's'} played${next ? ` · next reward at ${next.games}` : ' · all found ✓'}</span>
            <div class="world-rewards">${w.rewards.map((r) => { const it = C.CATALOG.find((x) => x.id === r.item); return `<div class="world-reward${r.owned ? ' got' : ''}" title="${esc(it ? it.name : r.item)}"><canvas data-world-item="${esc(r.item)}"></canvas><span>${r.owned ? '✓' : '🔒 ' + r.games}</span></div>`; }).join('')}</div>
          </div></div>`;
      }).join('')}</div>`;
    const cur = worlds.find((w) => w.id === theme);
    $('#s-detail').innerHTML = cur ? `<h3>${worldEmoji(cur.id)} ${esc(cur.name)}</h3><p class="small">You are playing in this world. Finish this game to count it toward ${esc(cur.name)}’s rewards.</p>` : '<p class="small muted">This town uses a classic look. Ask the Judge to pick one of these worlds to start exploring.</p>';
    requestAnimationFrame(() => $('#s-grid').querySelectorAll('[data-world-item]').forEach((cv) => paintItem(cv, C.CATALOG.find((x) => x.id === cv.dataset.worldItem), { avatar, home: opts.home, theme })));
    $('#s-say').textContent = state.say || 'Every world hides its own treasures. Go see them all!';
    startScene(() => ({ theme, avatar, home: opts.home, shelf: C.CATALOG.filter((i) => i.world), selected: null, owned: () => false }));
  }
  // ---------- Season pass + weekly challenges ----------
  function renderSeason(opts) {
    const { profile, avatar, theme } = opts, s = profile && profile.season;
    if (!s) { $('#s-grid').innerHTML = '<p class="muted">Connecting…</p>'; $('#s-detail').innerHTML = ''; return; }
    const pct = Math.min(100, Math.round(((s.xp % s.xpPerTier) / s.xpPerTier) * 100)), gold = profile.coins;
    const tierCell = (n) => {
      const r = s.rewards[n] || {}, item = r.item && C.CATALOG.find((i) => i.id === r.item);
      const state = s.granted.includes(n) ? 'got' : n <= s.tier ? (s.owned ? 'got' : 'ready') : n === s.tier + 1 ? 'next' : 'locked';
      return `<div class="pass-tier ${state}" data-tier="${n}"><b>${n}</b>${item ? `<canvas data-pass-item="${esc(item.id)}"></canvas><span>${esc(item.name)}</span>` : `<span class="pass-gold">🪙 ${r.gold}</span>`}</div>`;
    };
    $('#s-grid').innerHTML = `<div class="pass-head">
        <h3>🌕 ${esc(s.name)}</h3>
        <p class="small">Every game earns season XP. ${s.owned ? 'Your pass is active: each tier pays out automatically.' : `Get the pass for <b>${s.cost} gold</b> to collect every tier you reach (even ones you already passed).`}</p>
        <div class="pass-xp"><span>Tier <b>${s.tier}</b> / ${s.tiers}</span><div class="bar"><i style="width:${s.tier >= s.tiers ? 100 : pct}%"></i></div><span class="small muted">${s.tier >= s.tiers ? 'Complete!' : `${s.xp % s.xpPerTier}/${s.xpPerTier} XP to tier ${s.tier + 1}`}</span></div>
        ${s.owned ? '<p class="pass-owned">✓ Pass active</p>' : `<button class="btn" data-buy-pass ${gold < s.cost ? 'disabled' : ''}>🎟 Get the pass for ${s.cost} gold</button>${gold < s.cost ? `<p class="err small">Need ${s.cost - gold} more gold.</p>` : ''}<p class="err" data-pass-err></p>`}
      </div>
      <div class="pass-track">${Array.from({ length: s.tiers }, (_, i) => tierCell(i + 1)).join('')}</div>`;
    $('#s-detail').innerHTML = `<h3>📅 Weekly challenges</h3><ul class="challenges">${s.challenges.map((c) => `<li class="${c.done ? 'done' : ''}"><span>${c.done ? '✅' : '⬜'} ${esc(c.label)}</span><span class="small">${c.progress}/${c.count} · 🪙 ${c.gold}</span></li>`).join('')}</ul><p class="small muted">New challenges every week. Each one also gives bonus season XP.</p>`;
    const b = $('#s-grid').querySelector('[data-buy-pass]');
    if (b) b.onclick = () => opts.buyPass((r) => { if (r && r.ok) { state.say = 'A fine choice! The Blood Moon rewards are yours as you climb.'; render({ ...opts, profile: r.profile }); } else $('#s-grid').querySelector('[data-pass-err]').textContent = (r && r.error) || 'Could not buy the pass.'; });
    requestAnimationFrame(() => $('#s-grid').querySelectorAll('[data-pass-item]').forEach((cv) => paintItem(cv, C.CATALOG.find((x) => x.id === cv.dataset.passItem), { avatar, home: opts.home, theme })));
    $('#s-say').textContent = state.say || 'The Blood Moon season is here! Play games to climb the tiers.';
    startScene(() => ({ theme, avatar, home: opts.home, shelf: C.CATALOG.filter((i) => i.pass), selected: null, owned: () => false }));
  }
  window.MT_SHOP = { render, open() { state.say = ''; state.selectedId = null; }, drawPouch, drawCoin, pouchButton, pouchDetails, paintPouches };
})();
