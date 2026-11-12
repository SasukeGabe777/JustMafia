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
  // A reaction pack shows its six emojis (two rows of three).
  function drawReactionPack(g, value, x, y, size) {
    const pack = (O.REACTION_PACKS || {})[value] || [];
    g.save(); g.font = `${Math.round(size)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    pack.forEach((e, i) => g.fillText(e, x + ((i % 3) - 1) * size * 1.15, y + (Math.floor(i / 3) - 0.5) * size * 1.15));
    g.restore();
  }
  function paintItem(cv, item, ctx) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3), w = cv.clientWidth || 72, h = cv.clientHeight || 72;
    cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, w, h);
    const look = lookWith(item, ctx);
    if (item.field === 'deathAnim' && window.MT_FAREWELL) { window.MT_FAREWELL.preview(g, item.value, w, h, 1.4, ctx.avatar); return; } // a farewell: show it playing
    if (item.field === 'reactions') { drawReactionPack(g, item.value, w / 2, h / 2, Math.min(w, h) / 4.2); return; }
    if (item.field === 'ghostSkin') { g.fillStyle = '#1d2236'; g.fillRect(0, 0, w, h); MTArt.drawGhost(g, w / 2, h * 0.9, look.avatar, { scale: h / 92, t: 1.2, glow: true }); return; } // a ghost look
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
  // The shopkeeper: a jointed pixel body (torso, head, two-part arms) posed per mood.
  //   idle   breathing, blinking, polishing the counter, a wave now and then
  //   show   holds the selected item up high, the other hand presenting it
  //   buy    arms up, a hop and a shower of coins (then back to showing it off)
  //   poor   a shrug, palms up, eyebrows sad
  //   locked a wagging finger and a head shake
  const keeper = { mood: 'idle', t0: 0 };
  function setKeeper(mood) { keeper.mood = mood; keeper.t0 = performance.now() / 1000; }
  const lerpA = (a, b, k) => a + (b - a) * k;
  function keeperPose(mood, t, since) {
    // angles in radians: shoulder (0 = arm hanging down, negative = raised forward/up), elbow bend
    const breathe = Math.sin(t * 2) * 1, blink = Math.sin(t * 1.7) > 0.97;
    const p = { body: breathe, head: 0, tilt: 0, lS: 0.25, lE: -0.5, rS: -0.25, rE: 0.5, brow: 0, mouth: 'smile', eyes: blink ? 'shut' : 'open', hop: 0, holds: false };
    if (mood === 'idle') {
      const wave = (t % 7) < 1.6, polish = !wave;
      if (wave) { p.rS = -2.6; p.rE = Math.sin(t * 12) * 0.5 - 0.3; p.mouth = 'grin'; }
      if (polish) { p.lS = 0.9 + Math.sin(t * 4) * 0.25; p.lE = -1.3; }
    } else if (mood === 'show') {
      const k = Math.min(1, since / 0.35);
      p.rS = lerpA(-0.25, -2.75, k); p.rE = lerpA(0.5, 0.15, k); p.lS = lerpA(0.25, -1.1, k); p.lE = lerpA(-0.5, -0.6, k) + Math.sin(t * 3) * 0.08;
      p.brow = 1; p.mouth = 'grin'; p.holds = k > 0.6; p.head = -2 * k; p.tilt = 0.08 * k;
    } else if (mood === 'buy') {
      const j = Math.abs(Math.sin(since * 9)) * (since < 1.4 ? 1 : 0);
      p.rS = -2.9; p.lS = 2.9; p.rE = 0.3; p.lE = -0.3; p.hop = j * 6; p.eyes = 'happy'; p.mouth = 'open'; p.brow = 1; p.holds = true;
    } else if (mood === 'poor') {
      const k = Math.min(1, since / 0.3);
      p.rS = lerpA(-0.25, -0.5, k); p.rE = lerpA(0.5, 1.9, k); p.lS = lerpA(0.25, 0.5, k); p.lE = lerpA(-0.5, -1.9, k);
      p.tilt = 0.18 * k; p.brow = -1; p.mouth = 'flat'; p.body += -2 * k;
    } else if (mood === 'locked') {
      p.rS = -1.7; p.rE = 1.2 + Math.sin(t * 14) * 0.45; p.tilt = Math.sin(t * 7) * 0.12; p.brow = -1; p.mouth = 'flat'; p.lS = 0.6; p.lE = -1.6;
    }
    return p;
  }
  // Draws the keeper with the waist at (x, y) (hidden behind the counter); returns where the
  // raised hand is so the shop can put the item in it.
  function drawKeeper(g, x, y, u, t, mood, since, rsp, over) {
    const P = Object.assign(keeperPose(mood, t, since), over || {}), s = u * 2.3;
    const r = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(Math.round(a * s), Math.round(b * s), Math.ceil(w * s), Math.ceil(h * s)); };
    const coat = rsp ? '#1f4fa8' : '#7a4a2a', coatD = rsp ? '#163a7a' : '#5e3820', skin = '#d9a273', skinD = '#b8845a', apron = rsp ? '#ffd21f' : '#efe6d6';
    let hand = null;
    g.save(); g.translate(x, y - P.hop * u - P.body * u);
    // an arm: upper arm from the shoulder, forearm from the elbow; returns the hand position (canvas space)
    const arm = (side, sh, el) => {
      g.save(); g.translate(side * 13 * s, -38 * s); g.rotate(sh); // negative raises the right arm, positive the left
      r('#2a1a10', -3.5, -1, 7, 15); r(coat, -3, -1, 6, 14);
      g.translate(0, 13 * s); g.rotate(el);
      r('#2a1a10', -3, -1, 6, 13); r(coat, -2.5, -1, 5, 11); r(skin, -3, 10, 6, 5); r(skinD, -3, 14, 6, 1);
      const m = g.getTransform(); g.restore();
      return { x: m.e + m.c * 13 * s, y: m.f + m.d * 13 * s };
    };
    // back arm first (left), then torso, head, front arm (right) so it overlaps the body
    const left = arm(-1, P.lS, P.lE);
    r('#2a1a10', -14, -42, 28, 44); r(coat, -13, -41, 26, 43); r(coatD, 6, -41, 7, 43);
    r(apron, -9, -30, 18, 32); r(rsp ? '#e0b800' : '#d8ccb2', -9, -30, 18, 2); r('#c9a24a', -1, -36, 2, 2); r('#c9a24a', -1, -32, 2, 2); // apron + buttons
    // head (bald, moustache, monocle) with brows and mouth that follow the mood
    g.save(); g.translate(0, (-44 + P.head) * s); g.rotate(P.tilt);
    r('#2a1a10', -12, -24, 24, 25); r(skin, -11, -23, 22, 23); r(skinD, 6, -23, 5, 23); r('#f4d7b0', -7, -22, 6, 3); // head + shine
    r(skin, -13, -14, 3, 6); r(skin, 10, -14, 3, 6); // ears
    const by = P.brow > 0 ? -16 : P.brow < 0 ? -13 : -15, bt = P.brow < 0 ? 1 : 0;
    r('#3a2414', -8, by + bt, 6, 2); r('#3a2414', 2, by - bt, 6, 2);
    if (P.eyes === 'shut') { r('#2a1a10', -7, -11, 4, 1); r('#2a1a10', 3, -11, 4, 1); }
    else if (P.eyes === 'happy') { r('#2a1a10', -7, -11, 4, 1); r('#2a1a10', -8, -10, 1, 1); r('#2a1a10', -3, -10, 1, 1); r('#2a1a10', 3, -11, 4, 1); r('#2a1a10', 2, -10, 1, 1); r('#2a1a10', 7, -10, 1, 1); }
    else { r('#2a1a10', -7, -12, 4, 4); r('#2a1a10', 3, -12, 4, 4); r('#fff', -6, -12, 1, 1); r('#fff', 4, -12, 1, 1); }
    g.strokeStyle = '#d6af53'; g.lineWidth = Math.max(1, s * 0.8); g.beginPath(); g.arc(5 * s, -10 * s, 4 * s, 0, Math.PI * 2); g.stroke(); r('#d6af53', 9, -9, 1, 9); // monocle
    r('#5a3a20', -9, -6, 8, 3); r('#5a3a20', 1, -6, 8, 3); r('#5a3a20', -11, -5, 3, 2); r('#5a3a20', 8, -5, 3, 2); // moustache
    if (P.mouth === 'open') { r('#4a1a1a', -3, -3, 6, 4); r('#c4555a', -2, -1, 4, 2); }
    else if (P.mouth === 'grin') { r('#4a1a1a', -4, -3, 8, 2); r('#f4ecdc', -3, -3, 6, 1); }
    else if (P.mouth === 'flat') r('#4a1a1a', -3, -2, 6, 1);
    else r('#4a1a1a', -3, -2, 6, 1);
    g.restore();
    const right = arm(1, P.rS, P.rE);
    g.restore();
    hand = P.holds ? right : null;
    return { hand, left };
  }
  // When you pick an item he fetches it: walks to its shelf, reaches up, takes it down,
  // carries it to the pedestal, sets it down so you can see it, steps back and presents it.
  const FETCH = { walk: 0.5, reach: 0.4, carry: 0.65, place: 0.35, back: 0.4 };
  const FETCH_DONE = FETCH.walk + FETCH.reach + FETCH.carry + FETCH.place + FETCH.back;
  const ease = (k) => (k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  function fetchPlan(since, t, home, shelfX, pedX, high, u) {
    const F = FETCH, walkBob = (k) => ({ body: Math.abs(Math.sin(t * 14)) * 2.2 * (k < 1 ? 1 : 0) });
    const stand = pedX - 48 * u, present = { rS: -1.35 + Math.sin(t * 2.2) * 0.07, rE: -0.25, lS: 0.35, lE: -0.7, mouth: 'grin', brow: 1, holds: false };
    let s0 = since;
    if (s0 < F.walk) { const k = s0 / F.walk; return { x: home + (shelfX - home) * ease(k), pose: { ...walkBob(k), rS: -0.25, lS: 0.25, mouth: 'smile' }, hide: false, placed: false }; }
    s0 -= F.walk;
    if (s0 < F.reach) { const k = s0 / F.reach; return { x: shelfX, pose: { rS: -0.25 - 2.8 * ease(k), rE: 0, hop: (high ? 16 : 6) * Math.sin(k * Math.PI / 2), mouth: 'flat', holds: k > 0.75 }, hide: k > 0.75, placed: false }; }
    s0 -= F.reach;
    if (s0 < F.carry) { const k = s0 / F.carry; return { x: shelfX + (stand - shelfX) * ease(k), pose: { ...walkBob(k), rS: -1.9, rE: -0.15, lS: 0.3, mouth: 'grin', holds: true }, hide: true, placed: false }; }
    s0 -= F.carry;
    if (s0 < F.place) { const k = s0 / F.place; return { x: stand, pose: { rS: -1.9 + 0.65 * k, rE: -0.15 - 0.4 * k, mouth: 'grin', holds: k < 0.85 }, hide: true, placed: k >= 0.85, placedAt: since - s0 + F.place * 0.85 }; }
    s0 -= F.place;
    if (s0 < F.back) { const k = s0 / F.back; return { x: stand - 26 * u * ease(k), pose: { ...present, rS: -1.15 - 0.2 * k }, hide: true, placed: true }; }
    return { x: stand - 26 * u, pose: present, hide: true, placed: true };
  }
  let scene = { raf: 0, coins: [] };
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
      // Where everything is: the shopkeeper's spot, the pedestal, and the picked item's shelf slot.
      const home = w * .27, ped = w * .66, pedY = h * .74, sel = st.selected;
      const slot = sel ? (st.shelf || []).findIndex((i) => i.id === sel.id) : -1;
      const shelfX = slot >= 0 && slot < 12 ? w * ((slot % 6) + .5) / 6 : w * .12, high = slot >= 0 && slot < 6;
      let mood = keeper.mood, since = t - keeper.t0;
      if (mood === 'buy' && since > 2.2) { mood = 'fetch'; since = FETCH_DONE + 1; }
      if ((mood === 'poor' || mood === 'locked') && since > 2.6) mood = sel ? 'fetch' : 'idle';
      if ((mood === 'fetch' && (!sel || keeper.item !== sel.id)) || (mood !== 'fetch' && mood !== 'buy' && mood !== 'locked' && mood !== 'poor' && sel)) { mood = sel ? 'fetch' : 'idle'; if (sel && keeper.item !== sel.id) { keeper.item = sel.id; keeper.t0 = t; since = 0; } }
      const plan = sel && mood === 'fetch' ? fetchPlan(since, t, home, Math.max(w * .1, Math.min(w * .9, shelfX)), ped, high, u)
        : sel && mood === 'buy' ? { x: ped - 74 * u, pose: null, hide: true, placed: true } : { x: home, pose: null, hide: false, placed: false };
      (st.shelf || []).forEach((item, i) => {
        const col = i % 6, row = Math.floor(i / 6); if (row > 1) return;
        if (sel && item.id === sel.id && plan.hide) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(w * (col + .5) / 6 - 12 * u, (row ? 104 : 52) * u - 3 * u, 24 * u, 3 * u); return; } // an empty spot
        const x = w * (col + .5) / 6, y = (row ? 104 : 52) * u;
        const look = lookWith(item, st);
        if (look.home) window.MT_WORLD.building(g, x, y, Math.max(0, O.houseStyle.indexOf(look.home.style)), (window.MT_THEMES.THEMES[st.theme] || window.MT_THEMES.THEMES.smalltown).palette, { ...window.MT_WORLD.lookOptions(look.home), scale: .22 * u, theme: st.theme, lit: true });
        else if (item.field === 'ghostSkin') MTArt.drawGhost(g, x, y, look.avatar, { scale: .5 * u, t: t + i, glow: true });
        else MTArt.drawCharacter(g, x, y, look.avatar, { scale: .5 * u, theme: st.theme });
        if (item.field === 'deathAnim' && window.MT_FAREWELL) window.MT_FAREWELL.draw(g, item.value, x, y, .5 * u, t + i, { avatar: st.avatar });
        if (sel && sel.id === item.id) { g.strokeStyle = '#ffe066'; g.lineWidth = 2; g.strokeRect(x - 16 * u, y - 44 * u, 32 * u, 46 * u); }
      });
      // the shopkeeper behind the counter: a rigged body that fetches, presents and reacts
      const k = drawKeeper(g, plan.x, h * 1.02, u, t, mood, since, rsp, plan.pose);
      if (mood === 'buy' && since < 1.6 && Math.random() < 0.5) scene.coins.push({ x: plan.x + (Math.random() - .5) * 60 * u, y: h * .3, vx: (Math.random() - .5) * 120 * u, vy: -140 * u - Math.random() * 80 * u, t: 0 });
      g.fillStyle = rsp ? '#0f2a63' : '#4a2e18'; g.fillRect(0, h * .74, w, h * .26);
      g.fillStyle = rsp ? '#ffd21f' : '#8f5e34'; g.fillRect(0, h * .74, w, 6 * u);
      g.fillStyle = 'rgba(0,0,0,.2)'; for (let x = 0; x < w; x += 30 * u) g.fillRect(x, h * .78, 2 * u, h * .22);
      // the pedestal on the counter (velvet top, gold trim)
      g.fillStyle = '#3a2414'; g.fillRect(ped - 30 * u, pedY - 10 * u, 60 * u, 10 * u); g.fillStyle = '#a8323a'; g.fillRect(ped - 34 * u, pedY - 14 * u, 68 * u, 6 * u); g.fillStyle = '#d2a64a'; g.fillRect(ped - 34 * u, pedY - 14 * u, 68 * u, 1.5 * u); g.fillRect(ped - 30 * u, pedY - 4 * u, 60 * u, 1.5 * u);
      const dpr0 = Math.min(window.devicePixelRatio || 1, 3);
      // in his hand while he carries it
      if (sel && k.hand) {
        const look = lookWith(sel, st), hx = k.hand.x / dpr0, hy = k.hand.y / dpr0;
        if (look.home) window.MT_WORLD.building(g, hx, hy + 4 * u, Math.max(0, O.houseStyle.indexOf(look.home.style)), (window.MT_THEMES.THEMES[st.theme] || window.MT_THEMES.THEMES.smalltown).palette, { ...window.MT_WORLD.lookOptions(look.home), scale: .28 * u, theme: st.theme, lit: true });
        else if (sel.field === 'ghostSkin') MTArt.drawGhost(g, hx, hy + 2 * u, look.avatar, { scale: .8 * u, t, glow: true });
        else MTArt.drawCharacter(g, hx, hy + 2 * u, look.avatar, { scale: .8 * u, theme: st.theme, t });
      }
      scene.coins = scene.coins.filter((c) => c.t < 1.4);
      for (const c of scene.coins) { c.t += 1 / 60; c.vy += 420 * u / 60; c.x += c.vx / 60; c.y += c.vy / 60; drawCoin(g, c.x, c.y, u * .8, t + c.t * 3); }
      // on the pedestal, big and turning a little, so you can really see it
      if (sel && plan.placed) {
        const look = lookWith(sel, st), cy = pedY - 14 * u, land = plan.placedAt != null ? Math.max(0, 1 - (since - plan.placedAt) / 0.3) : 0;
        const drop = -Math.abs(Math.sin(land * Math.PI)) * 8 * u, bob = Math.sin(t * 2.4) * 1.5 * u;
        const glow = g.createRadialGradient(ped, cy - 40 * u, 4, ped, cy - 40 * u, 70 * u); glow.addColorStop(0, 'rgba(255,230,140,.45)'); glow.addColorStop(1, 'rgba(255,230,140,0)');
        g.fillStyle = glow; g.fillRect(ped - 70 * u, cy - 110 * u, 140 * u, 120 * u);
        if (sel.field === 'reactions') drawReactionPack(g, sel.value, ped, cy - 40 * u + drop + bob, 24 * u);
        else if (look.home) window.MT_WORLD.building(g, ped, cy + drop + bob, Math.max(0, O.houseStyle.indexOf(look.home.style)), (window.MT_THEMES.THEMES[st.theme] || window.MT_THEMES.THEMES.smalltown).palette, { ...window.MT_WORLD.lookOptions(look.home), scale: .5 * u, theme: st.theme, lit: true });
        else if (sel.field === 'ghostSkin') MTArt.drawGhost(g, ped, cy + drop + bob, look.avatar, { scale: 1.45 * u, t, glow: true });
        else MTArt.drawCharacter(g, ped, cy + drop + bob, look.avatar, { scale: 1.45 * u, theme: st.theme, t, facing: Math.sin(t * 0.9) > 0.6 ? 1 : Math.sin(t * 0.9) < -0.6 ? -1 : 0 });
        if (sel.field === 'deathAnim' && window.MT_FAREWELL) window.MT_FAREWELL.draw(g, sel.value, ped, cy, 1.45 * u, t, { avatar: st.avatar }); // the farewell, looping
        for (let i = 0; i < 4; i++) { const a = t * 1.6 + i * 1.57; g.fillStyle = '#fff6c0'; g.fillRect(ped + Math.cos(a) * 44 * u, cy - 50 * u + Math.sin(a) * 26 * u, 2 * u, 2 * u); } // sparkles
        // price tag hanging off the pedestal
        const owned = st.owned(sel), tag = owned ? 'OWNED' : String(sel.cost);
        g.fillStyle = '#f6ecd0'; g.fillRect(ped + 36 * u, pedY - 30 * u, 44 * u, 18 * u); g.fillStyle = '#3a2414'; g.fillRect(ped + 36 * u, pedY - 30 * u, 44 * u, 2 * u);
        if (!owned) drawCoin(g, ped + 44 * u, pedY - 21 * u, u * .9, t);
        g.fillStyle = '#3a2414'; g.font = `700 ${Math.round(11 * u)}px 'Pixelify Sans', monospace`; g.fillText(tag, ped + (owned ? 58 : 64) * u, pedY - 20 * u);
      }
      cv.dataset.selected = st.selected ? st.selected.id : ''; cv.dataset.placed = sel && plan.placed ? sel.id : ''; // on the pedestal
      scene.raf = requestAnimationFrame(frame);
    };
    scene.raf = requestAnimationFrame(frame);
  }

  // ---------- the sales pitch ----------
  // He talks about how it looks and why it's a good buy (stable per item, so it reads like his opinion).
  const PITCH = {
    outfit: ['Feel that fabric! The {name} sits just right on the shoulders.', 'Look at the cut on the {name}. Walk into the square in this and every head turns.', 'The {name}: sturdy stitching, sharp colors. It says "trust me" without saying a word.'],
    hat: ['The {name} frames the face beautifully. Very mysterious. Very hard to accuse.', 'Try the {name}. The silhouette alone wins arguments.', 'A {name}! Tip it at your neighbors at dawn; they will never suspect a thing.'],
    hair: ['The {name}. Fresh, bold, unforgettable. The town will know you by it.', 'With the {name} you look like you have nothing to hide. Very useful.'],
    shoeStyle: ['The {name}: quiet on the cobbles, quick on the run home at night.', 'Good shoes save lives in this town. The {name} are the best I have.'],
    accessory: ['The {name} is the finishing touch. Small thing, big difference.', 'Nobody forgets a {name}. Wear it and you are the talk of the tavern.'],
    nameplate: ['Your name in {name} style on the big screen. Everyone will read it twice.', 'The {name} nameplate: when the votes come in, they will spell your name right.'],
    houseStyle: ['The {name}! Look at those walls. The neighbors will be so jealous.', 'A {name} on your plot. Solid, handsome, and the windows lock. Mostly.'],
    houseDecor: ['A little {name} makes any house a home. And a home is harder to break into.', 'Add {name} to your house: the whole street will stop and look.'],
    effect: ['{name}! Watch it shimmer around you. Pure magic, guaranteed by me.', 'With {name} you glow in every crowd. Nobody can ignore you now.'],
    ghostSkin: ['When your time comes, haunt in style: the {name}. The living will never sleep again.', 'The {name}! Float over the graveyard in this and every ghost will be jealous.'],
    deathAnim: ['If the worst happens, go out in style: {name}. People will talk about it for days.', 'A farewell to remember: {name}. Even the Mafia will feel bad. Maybe.'],
  };
  const DEAL = ['A bargain at {cost} gold!', 'Only {cost} gold, and worth twice that.', 'For you, friend? {cost} gold. Practically a gift.', '{cost} gold. You will not find a better price in town.'];
  const pickStable = (list, id) => { let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return list[h % list.length]; };
  function pitch(i, gold) {
    const fill = (tpl) => tpl.replace('{name}', i.name).replace('{cost}', i.cost);
    const desc = C.DESCRIPTIONS[i.id] ? ' ' + C.DESCRIPTIONS[i.id] : '';
    const deal = gold != null && gold < i.cost ? `It's ${i.cost} gold. You have ${gold}: a couple more games and it's yours!` : fill(pickStable(DEAL, i.id + 'deal'));
    return `${fill(pickStable(PITCH[i.field] || PITCH.accessory, i.id))}${desc} ${deal}`;
  }

  // ---------- screen ----------
  let state = { tab: C.CATEGORIES[0].id, selectedId: null, say: '' };
  const SAY = {
    hello: 'Welcome, welcome! Have a look around.',
    pick: (i, gold) => pitch(i, gold),
    fetching: (i) => `The ${i.name}? Excellent eye! One moment, let me get it down for you…`,
    owned: (i) => `The ${i.name}? You already own it. Wear it in good health!`,
    poor: (i, gold) => `The ${i.name} is ${i.cost} gold, friend. You have ${gold}. Come back after a few more games!`,
    locked: (i) => i.requires ? `The ${i.name} is High Roller tier ${i.ladderTier}. Own the ${(C.CATALOG.find((x) => x.id === i.requires) || {}).name} first.` : `The ${i.name} isn't for sale. You earn it: ${C.ACHIEVEMENTS[i.achievement].label}.`,
    bought: (i) => `Thank you! The ${i.name} is yours. Equip it from your inventory.`,
  };
  function render(opts) {
    const { profile, avatar, home, theme, buy, equip } = opts;
    const owned = (i) => i.free || !!profile && profile.owned.includes(i.id);
    // On the shelves: what this player has unlocked for purchase (plus what they own and
    // achievement rewards). Season and world rewards live in their own tabs.
    const stocked = (i) => !!profile && (profile.stock || []).includes(i.id);
    // The Ghosts tab also shows what you earn (achievements); High Roller tiers show in their own tabs (hats, flair), locked until the tier below is owned.
    const goals = (cat) => !!(C.CATEGORIES.find((c) => c.id === cat) || {}).goals;
    const forSale = (cat) => C.CATALOG.filter((i) => i.category === cat && !i.free && !owned(i) && !i.pass && !i.world && (goals(cat) ? (i.achievement || i.requires || stocked(i)) : i.ladderTier || !i.achievement && stocked(i))).sort((a, b) => (a.ladderTier || 0) - (b.ladderTier || 0));
    const needs = (i) => i.requires && !(profile && profile.owned.includes(i.requires)) ? C.CATALOG.find((x) => x.id === i.requires) : null;
    const hidden = C.STOCKABLE.filter((i) => !stocked(i) && !owned(i));
    $('#s-title').textContent = theme === 'rsp' ? 'RSP Supply Store' : 'Town Shop';
    $('#s-pouch-wrap').innerHTML = pouchButton(profile, 's-pouch');
    $('#s-pouch').onclick = () => { const pop = $('#s-pouch-pop'); pop.hidden = !pop.hidden; pop.innerHTML = pouchDetails(profile); };
    const tabs = [{ id: 'season', label: 'Season', icon: '🎟' }, { id: 'worlds', label: 'Worlds', icon: '🗺' }, { id: 'fate', label: 'Fate', icon: '✦' }, ...C.CATEGORIES.filter((c) => forSale(c.id).length), ...(hidden.length ? [{ id: 'locked', label: `Locked (${hidden.length})`, icon: '🔒' }] : []), { id: 'inventory', label: 'Inventory', icon: '🎒' }];
    if (!tabs.some((t) => t.id === state.tab)) state.tab = tabs[0].id;
    $('#s-tabs').style.gridTemplateColumns = `repeat(${tabs.length > 6 ? Math.ceil(tabs.length / 2) : tabs.length}, minmax(0,1fr))`; // two rows when there are many tabs, so labels stay readable
    $('#s-tabs').innerHTML = tabs.map((t) => `<button role="tab" class="cas-tab${t.id === state.tab ? ' sel' : ''}" data-shop-tab="${t.id}" aria-selected="${t.id === state.tab}"><span aria-hidden="true">${t.icon}</span>${esc(t.label)}</button>`).join('');
    $('#s-tabs').querySelectorAll('[data-shop-tab]').forEach((b) => { b.onclick = () => { state.tab = b.dataset.shopTab; state.selectedId = null; render(opts); }; });
    if (state.tab === 'season') { renderSeason(opts); paintPouches(); return; }
    if (state.tab === 'worlds') { renderWorlds(opts); paintPouches(); return; }
    if (state.tab === 'fate') { renderFate(opts); paintPouches(); return; }
    if (state.tab === 'locked') { renderLocked(opts, hidden); paintPouches(); return; }
    const inv = state.tab === 'inventory';
    const items = inv ? (profile ? profile.inventory : []).map((x) => C.CATALOG.find((i) => i.id === x.id)).filter(Boolean) : forSale(state.tab);
    // A just-bought item leaves the shelf but stays on the pedestal (with Equip) until you pick another.
    const selected = items.find((i) => i.id === state.selectedId) || (state.selectedId && C.CATALOG.find((i) => i.id === state.selectedId && owned(i))) || null;
    const gold = profile ? profile.coins : 0;
    $('#s-grid').innerHTML = items.length ? `<div class="cas-tiles shop-tiles">${items.map((i) => {
      const own = owned(i), equipped = inv && (profile.inventory.find((x) => x.id === i.id) || {}).equipped;
      const badge = equipped ? '<em class="badge eq">Equipped</em>' : own ? '<em class="badge own">Owned</em>' : i.pass ? `<em class="badge lock">🎟 T${i.passTier}</em>` : i.world ? `<em class="badge lock">${worldEmoji(i.world)} ${i.worldGames}</em>` : i.achievement ? '<em class="badge lock">🔒</em>' : needs(i) ? `<em class="badge lock">🔒 T${i.ladderTier}</em>` : `<em class="badge price${gold < i.cost ? ' poor' : ''}">${i.cost}g</em>`;
      return `<button class="cas-tile shop-tile${i.id === state.selectedId ? ' sel' : ''}" data-item="${esc(i.id)}" aria-pressed="${i.id === state.selectedId}"><canvas></canvas><span>${esc(i.name)}</span>${badge}</button>`;
    }).join('')}</div>` : `<p class="muted">${inv ? 'Your inventory is empty. Buy something from the shop tabs!' : 'Nothing for sale here yet.'}</p>`;
    $('#s-grid').querySelectorAll('[data-item]').forEach((b) => { b.onclick = () => {
      state.selectedId = b.dataset.item; const i = C.CATALOG.find((x) => x.id === state.selectedId);
      keeper.item = null; setKeeper('fetch'); keeper.item = i.id;
      clearTimeout(state.pitchTimer);
      state.pitchTimer = setTimeout(() => { if (state.selectedId === i.id) { state.say = owned(i) ? SAY.owned(i) : SAY.pick(i, (profile || {}).coins || 0); const el = $('#s-say'); if (el) el.textContent = state.say; } }, (FETCH_DONE - 0.3) * 1000);
      state.say = owned(i) ? 'Ah, one of yours! Let me bring it out so you can admire it.' : SAY.fetching(i);
      render(opts);
    }; });
    const ctx = { avatar, home, theme };
    requestAnimationFrame(() => $('#s-grid').querySelectorAll('[data-item]').forEach((b) => paintItem(b.querySelector('canvas'), C.CATALOG.find((x) => x.id === b.dataset.item), ctx)));
    // detail panel: name, description, price, and the one action that applies
    const d = $('#s-detail');
    if (!selected) d.innerHTML = `<p class="muted">${inv ? 'Tap an item to equip or unequip it.' : 'Tap an item to see it up close.'}</p>`;
    else {
      const own = owned(selected), invEntry = profile && profile.inventory.find((x) => x.id === selected.id);
      const lockedBy = selected.pass ? `Season pass tier ${selected.passTier}` : selected.world ? `finish ${selected.worldGames === 1 ? 'a game' : selected.worldGames + ' games'} in ${C.WORLD_NAMES[selected.world]}` : selected.achievement && !(profile && profile.achievements.includes(selected.achievement)) ? C.ACHIEVEMENTS[selected.achievement].label : needs(selected) ? `own the ${needs(selected).name} (High Roller tier ${selected.ladderTier - 1}) first` : null;
      const cant = !own && (lockedBy ? 'Unlock: ' + lockedBy : gold < selected.cost ? `Need ${selected.cost - gold} more gold` : '');
      const action = own
        ? `<button class="btn" data-equip="${invEntry && invEntry.equipped ? 'off' : 'on'}">${invEntry && invEntry.equipped ? 'Unequip' : 'Equip'}</button>`
        : `<button class="btn" data-buy ${cant || !profile ? 'disabled' : ''}>${lockedBy ? '🔒 Locked' : `Buy for ${selected.cost} gold`}</button>`;
      d.innerHTML = `<h3>${esc(selected.name)}</h3><p>${esc(selected.description)}</p>
        <p class="small"><b>Price:</b> ${selected.achievement ? 'Achievement reward' : selected.cost + ' gold'} · <b>Your gold:</b> <span data-gold>${gold}</span></p>
        ${cant ? `<p class="err" data-cant>${esc(cant)}</p>` : ''}${action}<p class="err" data-shop-err></p>`;
      const b = d.querySelector('[data-buy]');
      if (b) b.onclick = () => buy(selected.id, (r) => { if (r && r.ok) { state.say = SAY.bought(selected); setKeeper('buy'); render({ ...opts, profile: r.profile }); } else d.querySelector('[data-shop-err]').textContent = (r && r.error) || 'Could not buy.'; });
      const e = d.querySelector('[data-equip]');
      if (e) e.onclick = () => equip(selected.id, e.dataset.equip === 'on', (r) => { if (!r || !r.ok) d.querySelector('[data-shop-err]').textContent = (r && r.error) || 'Could not equip.'; });
    }
    $('#s-say').textContent = state.say || SAY.hello;
    const shelf = (inv ? items : forSale(state.tab)).slice(0, 12);
    startScene(() => ({ theme, avatar, home, shelf, selected, owned }));
    paintPouches();
  }
  // ---------- Fate: tokens and one-time Fate Cards ----------
  function renderFate(opts) {
    const { profile, theme, avatar } = opts, F = C.FATE;
    if (!profile || typeof profile.fate !== 'number') { $('#s-grid').innerHTML = '<p class="muted">Connecting…</p>'; $('#s-detail').innerHTML = ''; return; }
    const owned = profile.fateCards || {};
    $('#s-grid').innerHTML = `<div class="fate-head"><h3>✦ Fate Tokens: <b>${profile.fate}</b></h3>
        <p class="small">A second currency, just for Fate Cards: one-time tricks that bend which role you get. Earn tokens by winning (+${F.perWin}), finishing a weekly challenge (+${F.perChallenge}) and visiting a new world (+${F.perNewWorld}).</p>
        <button class="btn ghost small" data-fate-exchange ${profile.coins < F.exchangeGold ? 'disabled' : ''}>Trade ${F.exchangeGold} gold for 1 token</button><p class="err small" data-fate-err></p></div>
      <div class="fate-cards">${Object.entries(F.cards).map(([id, c]) => `<div class="fate-card"><div class="fc-face"><span class="fc-icon">${c.icon}</span><b>${esc(c.name)}</b><small>${esc(c.text)}</small></div>
        <div class="fc-foot"><span>You have <b>${owned[id] || 0}</b></span><button class="btn small" data-fate-buy="${id}" ${profile.fate < c.cost ? 'disabled' : ''}>Buy · ✦${c.cost}</button></div></div>`).join('')}</div>`;
    $('#s-detail').innerHTML = '<p class="small">How to use them: wishes are made on your phone in the lobby before the game starts. Reroll appears while you look at your dealt role. A wish is only spent if it comes true.</p>';
    const err = (r) => { const el = $('#s-grid').querySelector('[data-fate-err]'); if (el) el.textContent = (r && r.error) || ''; };
    $('#s-grid').querySelectorAll('[data-fate-buy]').forEach((b) => { b.onclick = () => opts.fateBuy && opts.fateBuy(b.dataset.fateBuy, (r) => { if (r && r.ok) { state.say = `A ${F.cards[b.dataset.fateBuy].name}! Fate smiles on you, friend.`; setKeeper('buy'); render({ ...opts, profile: r.profile }); } else err(r); }); });
    const ex = $('#s-grid').querySelector('[data-fate-exchange]'); if (ex) ex.onclick = () => opts.fateExchange && opts.fateExchange((r) => { if (r && r.ok) render({ ...opts, profile: r.profile }); else err(r); });
    $('#s-say').textContent = state.say || 'Fate Cards… rare stuff. Not for wearing. For changing your destiny.';
    startScene(() => ({ theme, avatar, home: opts.home, shelf: [], selected: null, owned: () => false }));
  }
  // ---------- Locked: how to put more on the shelves ----------
  function renderLocked(opts, hidden) {
    const { profile, avatar, theme } = opts;
    const S = C.STOCK, next = C.nextStock((profile && profile.stock) || [], 3).map((id) => C.CATALOG.find((i) => i.id === id)).filter(Boolean);
    const byCat = C.CATEGORIES.map((c) => ({ c, n: hidden.filter((i) => i.category === c.id).length })).filter((x) => x.n);
    $('#s-grid').innerHTML = `<div class="locked-head"><h3>🔒 ${hidden.length} items waiting in the back room</h3>
        <p class="small">The shopkeeper brings out new stock as you play. Unlocked items appear in their tab, ready to buy with gold.</p></div>
      <ul class="unlock-rules">
        <li><span>✅ Finish any game</span><b>+${S.finished} new item</b></li>
        <li><span>🏆 Win a game</span><b>+${S.won} more</b></li>
        <li><span>🗺 Your first game in a new world</span><b>+${S.newWorld} more</b></li>
        <li><span>🎟 Season pass tiers · 🗺 World gear · 🏅 Achievements</span><b>their own rewards</b></li>
      </ul>
      <h4 class="locked-sub">Coming out next</h4>
      <div class="cas-tiles shop-tiles locked-tiles">${next.map((i) => `<div class="cas-tile shop-tile mystery"><canvas data-mystery="${esc(i.id)}"></canvas><span>???</span><em class="badge lock">${esc((C.CATEGORIES.find((c) => c.id === i.category) || {}).label || '')}</em></div>`).join('')}</div>
      <h4 class="locked-sub">Still hidden</h4>
      <ul class="unlock-rules">${byCat.map(({ c, n }) => `<li><span>${c.icon} ${esc(c.label)}</span><b>${n} hidden</b></li>`).join('')}</ul>`;
    $('#s-detail').innerHTML = '<p class="small">Tip: winning and trying new worlds fills the shop fastest.</p>';
    requestAnimationFrame(() => $('#s-grid').querySelectorAll('[data-mystery]').forEach((cv) => paintItem(cv, C.CATALOG.find((x) => x.id === cv.dataset.mystery), { avatar, home: opts.home, theme })));
    if (keeper.mood !== 'locked') setKeeper('locked');
    $('#s-say').textContent = state.say || "Ah ah ah! Those are still in the back. Play a few more games and I'll bring them out.";
    startScene(() => ({ theme, avatar, home: opts.home, shelf: [], selected: null, owned: () => false }));
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
  window.MT_SHOP = { render, open() { state.say = ''; state.selectedId = null; setKeeper('idle'); }, setKeeper, drawPouch, drawCoin, pouchButton, pouchDetails, paintPouches };
})();
