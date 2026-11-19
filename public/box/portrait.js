'use strict';
// Your JustGameBox character everywhere in the box: the same character you design in the shop
// (/shop) and in JustMafia (MTArt.drawCharacter = drawSmooth in /avatar.js), wearing that game's
// gear (public/shared/gear.js wearables, drawn by /wear-art.js). Load after /avatar.js,
// /wear-art.js and /shared/gear.js. Players with no saved look keep their emoji; bots get a
// made-up character (seeded by their id) so a room never mixes styles.
//
//   who = a player object ({ id, name, avatar, look?, gear? }) or a player id. Game states that
//   only carry id/name/avatar are fine: the look and gear come from the room roster, which
//   tv.js / play.js keep current with BOX.setRoster(players).
//
//   BOX.face(who, size = 32, opts)  -> '<img class="bx-face">' head-and-shoulders, or the emoji
//   BOX.body(who, h = 96, opts)     -> '<img class="bx-body">' full figure (width ≈ 0.72 h), or the emoji
//   BOX.faceUrl / BOX.bodyUrl(who, size, opts) -> cached data-URL PNG, '' without a look
//   BOX.drawChar(ctx, x, y, who, o) -> draws the animated character on a canvas, feet at (x, y)
//                                      (o: the MTArt.drawCharacter options: scale, t, walking,
//                                      facing, jump, expression…). false when there is no look.
//   BOX.lookOf(who) -> { look, gear } or null;  BOX.hasLook(who)
//   opts / o: game (default: the game on screen), mood (an expression: 'grin', 'sad'…),
//             plain (no game wearables), fill (img fills its parent), cls (extra classes),
//             flip (face left)
//   BOX.portrait.url(look, size) / .html(player, size, opts): the older API (same pictures).
(function () {
  const root = window.BOX = window.BOX || {};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEYS = ['body', 'color', 'skin', 'hat', 'hair', 'hairColor', 'facialHair', 'eyes', 'face', 'features', 'expression', 'outfit', 'accessory', 'pants', 'shoes', 'shoeStyle', 'effect'];
  const hasLookObj = (look) => !!(look && typeof look === 'object' && !Array.isArray(look) && (look.skin || look.outfit || look.hair || look.color));

  // ---- the room roster (id -> { look, gear, name, avatar, bot }) ----
  const roster = new Map(), byName = new Map();
  root.setRoster = function (list) {
    if (!Array.isArray(list)) return;
    for (const p of list) {
      if (!p || typeof p.id !== 'string') continue;
      const old = roster.get(p.id) || {};
      const e = { id: p.id, name: p.name || old.name, avatar: p.avatar || old.avatar, bot: p.bot != null ? !!p.bot : !!old.bot, color: p.color || old.color,
        look: 'look' in p ? p.look : old.look, gear: 'gear' in p ? p.gear : old.gear };
      roster.set(p.id, e); if (e.name) byName.set(String(e.name), e.id);
    }
  };
  // A made-up character for bots (stable per id), so they look like everyone else.
  const SKINS = ['#ffe0c4', '#f3c9a0', '#d9a273', '#b07a4f', '#8a5634', '#5c3a21'], HAIRC = ['#241b18', '#543626', '#976332', '#e5c16e', '#ba593c', '#713f95', '#b33b38'];
  const COLORS = ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#2c5fd6', '#9b59b6', '#e84393'];
  const OUTF = ['shirt', 'jacket', 'overalls', 'shirt', 'jacket', 'dress'], MOODS = ['smile', 'grin', 'smirk', 'wink', 'smile'];
  function hash(s) { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; }
  function botLook(id, color) {
    const h = hash(id), r = (n, k) => hash(id + ':' + k) % n, fem = (h & 1) === 1;
    const hair = fem ? ['long', 'bob', 'ponytail', 'wavy', 'bun', 'curly'][r(6, 1)] : ['short', 'sidePart', 'messy', 'curly', 'buzzCut', 'afro'][r(6, 1)];
    const outfit = OUTF[r(fem ? 6 : 5, 2)];
    return { body: fem ? 'female' : 'male', skin: SKINS[r(6, 3)], hair, hairColor: HAIRC[r(7, 4)], color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : COLORS[r(9, 5)], outfit,
      expression: MOODS[r(5, 6)], eyes: ['#342b25', '#416f91', '#477849'][r(3, 7)], pants: ['#2d2f3a', '#355879', '#765439'][r(3, 8)], shoes: '#33251d', hat: 'none', accessory: 'none', face: 'round' };
  }
  function resolve(who) {
    if (who == null) return null;
    const p = typeof who === 'string' ? { id: who } : who;
    const r = (p.id && roster.get(p.id)) || (p.name && byName.has(String(p.name)) ? roster.get(byName.get(String(p.name))) : null) || null;
    let look = hasLookObj(p.look) ? p.look : r && hasLookObj(r.look) ? r.look : null;
    const bot = p.bot || (r && r.bot);
    if (!look && bot) look = botLook(p.id || p.name || 'bot', p.color || (r && r.color));
    // Roster gear is { game: { slot } }; a game's own p.gear is usually just { slot } for that game.
    const gear = (r && r.gear) || (p.gear && typeof p.gear === 'object' ? p.gear : null);
    return { look, gear, avatar: p.avatar || (r && r.avatar) || '🙂', name: p.name || (r && r.name) || '' };
  }
  const gameOnScreen = () => { const m = typeof document !== 'undefined' && document.body && / ?g-([a-z0-9]+)/.exec(document.body.className); return m ? m[1] : ''; };
  function wearFor(res, o) {
    if (o.plain || !res.gear || !window.MT_GEAR) return [];
    const game = o.game || gameOnScreen(); if (!game) return [];
    return window.MT_GEAR.wearOf(game, res.gear);
  }
  root.lookOf = (who) => { const r = resolve(who); return r && r.look ? { look: r.look, gear: r.gear } : null; };
  root.hasLook = (who) => !!(window.MTArt && root.lookOf(who));

  // ---- pictures (cached data URLs) ----
  const cache = new Map(), MAX = 400;
  const dpr = () => Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  function cleanLook(look) { const c = {}; for (const k of KEYS) if (typeof look[k] === 'string') c[k] = look[k].slice(0, 40); return c; }
  // frame 'face': head and shoulders (y -72…-25); 'body': the whole figure (y -82…+3, x ±30).
  function picture(look, wear, frame, size, o) {
    if (!window.MTArt || typeof document === 'undefined') return '';
    const clean = cleanLook(look); if (o.mood) clean.expression = String(o.mood).slice(0, 20);
    if (frame === 'face') delete clean.effect;
    const w = frame === 'face' ? size : Math.round(size * 0.72), h = size;
    const key = frame + '|' + size + '|' + JSON.stringify(clean) + '|' + wear.map((x) => x.id || x.shape).join(',') + (o.flip ? '|f' : '');
    if (cache.has(key)) return cache.get(key);
    let out = '';
    try {
      const k = dpr(), cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      const g = cv.getContext('2d'); g.scale(k, k);
      if (o.flip) { g.translate(w, 0); g.scale(-1, 1); }
      if (frame === 'face') { const s = h / 47; window.MTArt.drawCharacter(g, w / 2, 72 * s, clean, { scale: s, t: 0.4, wear }); }
      else { const s = h / 85; window.MTArt.drawCharacter(g, w / 2, 82 * s, clean, { scale: s, t: 0.4, wear }); }
      out = cv.toDataURL('image/png');
    } catch (e) { out = ''; }
    if (cache.size >= MAX) cache.delete(cache.keys().next().value);
    cache.set(key, out);
    return out;
  }
  const clampSize = (n, d) => Math.max(12, Math.min(640, Math.round(Number(n) || d)));
  root.faceUrl = (who, size = 64, o = {}) => { const r = resolve(who); return r && r.look ? picture(r.look, wearFor(r, o), 'face', clampSize(size, 64), o) : ''; };
  root.bodyUrl = (who, h = 120, o = {}) => { const r = resolve(who); return r && r.look ? picture(r.look, wearFor(r, o), 'body', clampSize(h, 120), o) : ''; };
  root.face = function (who, size = 32, o = {}) {
    size = clampSize(size, 32);
    const r = resolve(who), src = r && r.look ? picture(r.look, wearFor(r, o), 'face', size, o) : '';
    const dim = o.fill ? 'width:100%;height:100%' : `width:${size}px;height:${size}px`;
    if (src) return `<img class="bx-face${o.cls ? ' ' + esc(o.cls) : ''}" src="${src}" alt="${esc(r.name)}" draggable="false" style="${dim}">`;
    return `<span class="bx-emo${o.cls ? ' ' + esc(o.cls) : ''}" style="${o.fill ? '' : `width:${size}px;height:${size}px;font-size:${Math.round(size * 0.78)}px;line-height:${size}px`}">${esc((r && r.avatar) || (who && who.avatar) || '🙂')}</span>`;
  };
  root.body = function (who, h = 96, o = {}) {
    h = clampSize(h, 96);
    const r = resolve(who), src = r && r.look ? picture(r.look, wearFor(r, o), 'body', h, o) : '';
    if (src) return `<img class="bx-body${o.cls ? ' ' + esc(o.cls) : ''}" src="${src}" alt="${esc(r.name)}" draggable="false" style="width:${Math.round(h * 0.72)}px;height:${h}px">`;
    return `<span class="bx-emo bx-emo-body${o.cls ? ' ' + esc(o.cls) : ''}" style="width:${Math.round(h * 0.72)}px;height:${h}px;font-size:${Math.round(h * 0.55)}px;line-height:${h}px">${esc((r && r.avatar) || (who && who.avatar) || '🙂')}</span>`;
  };
  root.drawChar = function (ctx, x, y, who, o = {}) {
    if (!ctx || !window.MTArt) return false;
    const r = resolve(who); if (!r || !r.look) return false;
    const look = o.mood ? { ...r.look, expression: o.mood } : r.look;
    window.MTArt.drawCharacter(ctx, x, y, look, { t: 0, ...o, wear: o.wear || wearFor(r, o) });
    return true;
  };

  // The older API, kept for the lobby roster, party board and phone header.
  function url(look, size = 96) { return hasLookObj(look) ? picture(look, [], 'face', clampSize(size, 96), {}) : ''; }
  function html(player, size = 32, opts = {}) { return root.face(player, size, opts); }
  // A few shared styles (no stylesheet edits needed on the pages that use it).
  if (typeof document !== 'undefined' && !document.getElementById('bx-face-css')) {
    const st = document.createElement('style'); st.id = 'bx-face-css';
    st.textContent = '.bx-face{display:inline-block;vertical-align:middle;border-radius:50%;object-fit:contain;flex:none;user-select:none}.bx-body{display:inline-block;vertical-align:bottom;object-fit:contain;flex:none;user-select:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))}.bx-emo{display:inline-block;vertical-align:middle;text-align:center;flex:none}.chip .av .bx-face{margin:-4px 0;background:rgba(255,255,255,.14)}.pb-av .bx-face{border-radius:50%}.h-me .bx-face,#h-av .bx-face{background:rgba(255,255,255,.14)}';
    (document.head || document.documentElement).appendChild(st);
  }
  root.portrait = { url, html, hasLook: hasLookObj };
})();
