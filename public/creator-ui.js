// Character creator panel: category tabs and visual choices, driven by
// MT_CREATOR_CONFIG. It only edits the draft through change(); play.js owns
// the draft/saved state, the animated stage and the save buttons.
(function () {
  const O = window.MT_OPTIONS, C = window.MT_COSMETICS, CFG = window.MT_CREATOR_CONFIG;
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const listOf = (field, s) => O[s && s.list || O.AVATAR_FIELDS[field]] || [];
  function owned(profile, field, value) { const item = C.CATALOG.find((i) => i.field === field && i.value === value); return !item || item.free || profile && profile.owned.includes(item.id); }
  const choices = (profile, field, s) => listOf(field, s).filter((v) => owned(profile, s && s.catalog || field, v));

  // Tile camera: draw the character (or home) with one option changed, framed on the part it affects.
  function paintTile(cv, av, focus, theme) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3), w = cv.clientWidth || 64, h = cv.clientHeight || 64;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h); ctx.imageSmoothingEnabled = false;
    if (focus === 'house') {
      const T = window.MT_THEMES, W = window.MT_WORLD; if (!T || !W) return;
      const pal = (T.THEMES[theme] || T.THEMES.smalltown).palette;
      ctx.fillStyle = pal.grass; ctx.fillRect(0, 0, w, h); ctx.fillStyle = pal.grassDark; ctx.fillRect(0, h * .86, w, h * .14);
      W.building(ctx, w / 2, h * .9, Math.max(0, O.houseStyle.indexOf(av.style)), pal, { ...W.lookOptions(av), scale: h / 130, theme, lit: true });
      return;
    }
    // [scale, local y to center]: head = face close-up, hat = head plus tall hats/hair.
    const cam = { head: [h / 28, 43], hat: [h / 42, 52], feet: [h / 26, 8], body: [h / 80, 34] }[focus] || [h / 80, 34];
    MTArt.drawCharacter(ctx, w / 2, h / 2 + cam[1] * cam[0], av, { scale: cam[0], theme, t: 0 });
  }

  window.MT_CREATOR = {
    tabs: () => CFG.TABS,
    // Random look from every section marked random:true, limited to owned items.
    randomize(profile) {
      const next = {};
      for (const tab of CFG.TABS) for (const s of tab.sections) if (s.random) { const valid = choices(profile, s.field); next[s.field] = valid[Math.floor(Math.random() * valid.length)]; }
      return next;
    },
    paintTile,
    // House designer: same tabs/tiles, editing a home look (MT_OPTIONS.HOME_FIELDS).
    renderHome({ look, profile, theme = 'smalltown', tab, setTab, change }) {
      renderTabs({ tabsEl: document.querySelector('#h-tabs'), panelEl: document.querySelector('#h-panel'), tabs: CFG.HOME_TABS, look, profile, theme, tab, setTab, change });
    },
    render({ avatar, profile, theme = 'smalltown', tab, setTab, change, buy, paint }) {
      const $ = (s) => document.querySelector(s);
      renderTabs({ tabsEl: $('#c-tabs'), panelEl: $('#c-panel'), tabs: CFG.TABS, look: avatar, profile, theme, tab, setTab, change });
      // The shop moved to its own screen (shop-ui.js); the creator links to it.
    },
  };

  // Tabs + a panel of swatches/tiles for one config. Each tile previews the look with that choice.
  function renderTabs({ tabsEl, panelEl, tabs: TABS, look, profile, theme, tab, setTab, change }) {
      const avatar = look, tabs = tabsEl, panel = panelEl;
      const active = TABS.find((t) => t.id === tab) || TABS[0];
      tabs.innerHTML = TABS.map((t) => `<button role="tab" class="cas-tab${t === active ? ' sel' : ''}" aria-selected="${t === active}" data-tab="${t.id}"><span aria-hidden="true">${t.icon}</span>${esc(t.label)}</button>`).join('');
      tabs.style.gridTemplateColumns = `repeat(${TABS.length}, minmax(0,1fr))`;
      tabs.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => setTab(b.dataset.tab); });

      panel.innerHTML = active.sections.map((s) => {
        const list = choices(profile, s.field, s), current = avatar[s.field] == null ? list[0] : avatar[s.field];
        const locked = listOf(s.field, s).length - list.length;
        const head = `<div class="cas-label">${esc(s.label)} <b>${esc(O.label(current))}</b></div>`;
        const more = locked ? `<p class="small muted">${locked} more to unlock in the 🛒 shop.</p>` : '';
        if (s.kind === 'swatch') return `<section class="cas-section">${head}<div class="swatches">${list.map((v) => `<button class="swatch${v === current ? ' sel' : ''}" style="background:${esc(v)}" title="${esc(O.label(v))}" aria-label="${esc(s.label)}: ${esc(O.label(v))}" aria-pressed="${v === current}" data-field="${s.field}" data-value="${esc(v)}"></button>`).join('')}</div>${more}</section>`;
        return `<section class="cas-section">${head}<div class="cas-tiles${s.focus === 'house' ? ' wide' : ''}">${list.map((v) => `<button class="cas-tile${v === current ? ' sel' : ''}" aria-pressed="${v === current}" data-field="${s.field}" data-value="${esc(v)}" data-focus="${s.focus || 'body'}"><canvas></canvas><span>${esc(O.label(v))}</span></button>`).join('')}</div>${more}</section>`;
      }).join('');
      panel.querySelectorAll('[data-field]').forEach((b) => { b.onclick = () => change({ [b.dataset.field]: b.dataset.value }); });
      requestAnimationFrame(() => panel.querySelectorAll('.cas-tile').forEach((b) => paintTile(b.querySelector('canvas'), { ...avatar, [b.dataset.field]: b.dataset.value }, b.dataset.focus, theme)));
  }

})();
