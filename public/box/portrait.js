'use strict';
// BOX.portrait: a player's JustGold character as a little head-and-shoulders picture, so people
// "see what they look like" everywhere in the box (TV lobby, party standings, phone header, shop).
// Needs /avatar.js (MTArt) loaded first. Players without a saved look keep their emoji.
//   BOX.portrait.url(look, size = 96)        -> cached data-URL PNG (transparent background)
//   BOX.portrait.html(player, size, opts)    -> '<img class="bx-face">' or '<span class="bx-emo">🦊</span>'
//     opts.fill: the image fills its parent (e.g. the party board's round avatar)
(function () {
  const root = window.BOX = window.BOX || {};
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cache = new Map(), MAX = 200;
  const hasLook = (look) => !!(look && typeof look === 'object' && !Array.isArray(look) && (look.skin || look.outfit || look.hair || look.color));
  function url(look, size = 96) {
    if (!hasLook(look) || !window.MTArt || typeof document === 'undefined') return '';
    size = Math.max(16, Math.min(512, Math.round(Number(size) || 96)));
    const px = Math.round(size * Math.min(2, Math.max(1, window.devicePixelRatio || 1)));
    // Only the look fields feed the key (and the picture), in a fixed order.
    const keys = ['color', 'skin', 'hat', 'hair', 'hairColor', 'facialHair', 'eyes', 'face', 'features', 'expression', 'outfit', 'accessory', 'pants', 'shoes', 'shoeStyle'];
    const clean = {}; for (const k of keys) if (typeof look[k] === 'string') clean[k] = look[k].slice(0, 40);
    const key = px + '|' + keys.map((k) => clean[k] || '').join('|');
    if (cache.has(key)) return cache.get(key);
    let out = '';
    try {
      const cv = document.createElement('canvas'); cv.width = px; cv.height = px;
      const g = cv.getContext('2d');
      // Character units: the head is centred near y = -44 and hats reach about y = -80.
      // Show y -78 … -20 (hat to chest), x centred.
      const s = px / 58;
      window.MTArt.drawCharacter(g, px / 2, px + 20 * s, clean, { scale: s, t: 0.4 });
      out = cv.toDataURL('image/png');
    } catch (e) { out = ''; }
    if (cache.size >= MAX) cache.delete(cache.keys().next().value);
    cache.set(key, out);
    return out;
  }
  function html(player, size = 32, opts = {}) {
    const p = player || {}, src = p.look ? url(p.look, size) : '';
    if (src) {
      const dim = opts.fill ? 'width:100%;height:100%' : `width:${Math.round(size)}px;height:${Math.round(size)}px`;
      return `<img class="bx-face" src="${src}" alt="" draggable="false" style="${dim}">`;
    }
    return `<span class="bx-emo">${esc(p.avatar || '🙂')}</span>`;
  }
  // A few shared styles (no stylesheet edits needed on the pages that use it).
  if (typeof document !== 'undefined' && !document.getElementById('bx-face-css')) {
    const st = document.createElement('style'); st.id = 'bx-face-css';
    st.textContent = '.bx-face{display:inline-block;vertical-align:middle;border-radius:50%;object-fit:contain;flex:none;user-select:none}.chip .av .bx-face{margin:-4px 0;background:rgba(255,255,255,.14)}.pb-av .bx-face{border-radius:50%}.h-me .bx-face,#h-av .bx-face{background:rgba(255,255,255,.14)}';
    (document.head || document.documentElement).appendChild(st);
  }
  root.portrait = { url, html, hasLook };
})();
