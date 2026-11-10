(function () {
  const O = window.MT_OPTIONS, C = window.MT_COSMETICS;
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  function owned(profile, field, value) { const item = C.CATALOG.find((i) => i.field === field && i.value === value); return !item || item.free || profile && profile.owned.includes(item.id); }
  window.MT_CREATOR = { render({ avatar, profile, paint, change, buy, theme = 'smalltown' }) {
    const $ = (s) => document.querySelector(s);
    const openDetails = new Map([...document.querySelectorAll('#opt-details details,#shop-body details')].map((d) => [d.querySelector('summary').textContent,d.open]));
    for (const [container, list, field] of [['#opt-colors', O.colors, 'color'], ['#opt-skins', O.skins, 'skin']]) {
      const box = $(container); box.innerHTML = '';
      for (const value of list) {
        const b = document.createElement('button'); b.className = 'swatch' + (avatar[field] === value ? ' sel' : ''); b.style.background = value;
        b.title = O.label(value); b.setAttribute('aria-label', O.label(value)); b.onclick = () => change({ [field]: value }); box.appendChild(b);
      }
    }
    const hats = $('#opt-hats'); hats.innerHTML = '';
    O.hats.filter((h) => owned(profile, 'hat', h)).forEach((hat) => {
      const b = document.createElement('button'); b.className = 'hat' + (avatar.hat === hat ? ' sel' : ''); b.title = O.label(hat); b.setAttribute('aria-label', O.label(hat));
      const cv = document.createElement('canvas'); b.appendChild(cv); hats.appendChild(b); b.onclick = () => change({ hat }); requestAnimationFrame(() => paint(cv, { ...avatar, hat }));
    });
    // Home: twelve building styles drawn by the same renderer as the TV town, plus wall paint.
    const T = window.MT_THEMES, W = window.MT_WORLD;
    const palette = T && T.THEMES[theme] ? T.THEMES[theme].palette : T ? T.THEMES.smalltown.palette : null;
    function paintHome(cv, style) {
      const dpr = Math.min(window.devicePixelRatio || 1, 3), w = cv.clientWidth || 80, h = cv.clientHeight || 64;
      cv.width = w * dpr; cv.height = h * dpr; const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = palette.grass; ctx.fillRect(0, 0, w, h); ctx.fillStyle = palette.grassDark; ctx.fillRect(0, h * .86, w, h * .14);
      W.building(ctx, w / 2, h * .9, O.houseStyle.indexOf(style), palette, { style, wall: avatar.houseColor, scale: h / 130, theme, lit: true, time: performance.now() / 1000 });
    }
    const homes = $('#opt-homes');
    if (homes && W && palette) {
      homes.innerHTML = '';
      O.houseStyle.forEach((style) => {
        const b = document.createElement('button'); b.className = 'hat' + (avatar.houseStyle === style ? ' sel' : ''); b.title = O.label(style); b.setAttribute('aria-label', O.label(style) + ' home');
        const cv = document.createElement('canvas'), label = document.createElement('span'); label.textContent = O.label(style);
        b.append(cv, label); homes.appendChild(b); b.onclick = () => change({ houseStyle: style }); requestAnimationFrame(() => paintHome(cv, style));
      });
      $('#home-name').textContent = avatar.houseStyle ? '· ' + O.label(avatar.houseColor) + ' ' + O.label(avatar.houseStyle) : '';
    }
    const homeColors = $('#opt-home-colors');
    if (homeColors) {
      homeColors.innerHTML = '';
      for (const value of O.houseColor) {
        const b = document.createElement('button'); b.className = 'swatch' + (avatar.houseColor === value ? ' sel' : ''); b.style.background = value;
        b.title = O.label(value); b.setAttribute('aria-label', O.label(value) + ' home color'); b.onclick = () => change({ houseColor: value }); homeColors.appendChild(b);
      }
    }
    const groups = { Appearance: { hair:'Hairstyle', hairColor:'Hair color', facialHair:'Facial hair', eyes:'Eye color', face:'Face shape', expression:'Expression', features:'Face markings' }, Wardrobe: { outfit:'Outfit', pants:'Pants color', shoeStyle:'Footwear', shoes:'Shoe color', accessory:'Accessory' }, Identity: { nameColor:'Name color', nameplate:'Nameplate', houseDecor:'Home decoration', effect:'Cosmetic effect' } };
    const lists = { shoeStyle:'shoeStyles' };
    $('#opt-details').innerHTML = Object.entries(groups).map(([group, fields]) => `<details ${group === 'Appearance' ? 'open' : ''}><summary>${group}</summary><div class="creator-fields">${Object.entries(fields).map(([field, label]) => `<label>${label}<select data-look="${field}">${O[lists[field] || field].filter((v) => owned(profile, field, v)).map((v) => `<option value="${v}" ${v === (avatar[field] || O[lists[field] || field][0]) ? 'selected' : ''}>${esc(O.label(v))}</option>`).join('')}</select></label>`).join('')}</div></details>`).join('');
    $('#opt-details').querySelectorAll('[data-look]').forEach((el) => el.onchange = () => change({ [el.dataset.look]: el.value }));
    $('#random-character').onclick = () => {
      const next = {}; for (const [field, list] of Object.entries({ color:'colors', skin:'skins', hat:'hats', hair:'hair', hairColor:'hairColor', facialHair:'facialHair', eyes:'eyes', face:'face', features:'features', expression:'expression', outfit:'outfit', pants:'pants', shoeStyle:'shoeStyles', shoes:'shoes', accessory:'accessory', nameColor:'nameColor' })) { const valid = O[list].filter((v) => owned(profile, field, v)); next[field] = valid[Math.floor(Math.random() * valid.length)]; }
      change(next);
    };
    const shop = $('#shop-body');
    shop.innerHTML = `<p><b>${profile ? profile.coins : 0} coins</b> · ${profile ? esc(profile.storage) : 'Connecting profile…'}</p><p class="small muted">Coins reward completed human games and verified outcomes. Test games do not award coins. Keep this browser's site data to retain your profile key.</p>${Object.entries(C.FIELDS).map(([field]) => `<details><summary>${esc(O.label(field))}</summary><div class="shop-grid">${C.CATALOG.filter((i) => i.field === field).map((i) => { const own = owned(profile, field, i.value), unlocked = !i.achievement || profile && profile.achievements.includes(i.achievement); return `<article class="shop-item"><canvas data-item="${i.id}"></canvas><b>${esc(i.name)}</b><small>${own ? 'Owned' : i.achievement ? esc(C.ACHIEVEMENTS[i.achievement].label) : i.cost + ' coins'}</small><button class="btn small ghost" data-buy="${i.id}" ${own || !profile || !unlocked || profile.coins < i.cost ? 'disabled' : ''}>${own ? 'Unlocked' : unlocked ? 'Unlock' : 'Achievement locked'}</button></article>`; }).join('')}</div></details>`).join('')}`;
    shop.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => buy(b.dataset.buy));
    function previews() {
      shop.querySelectorAll('canvas').forEach((cv) => { if (!cv.getClientRects().length) return; const item = C.CATALOG.find((i) => i.id === cv.dataset.item); paint(cv,{ ...avatar,[item.field]:item.value }); const ctx = cv.getContext('2d'); if (item.field === 'nameplate') { ctx.fillStyle = '#b79867'; ctx.fillRect(2,cv.height-12,cv.width-4,11); } if (item.field === 'houseDecor' || item.field === 'effect') { ctx.fillStyle = '#b79867'; ctx.font = '10px monospace'; ctx.fillText(item.name.slice(0,12),2,12); } });
    }
    document.querySelectorAll('#opt-details details,#shop-body details').forEach((d) => { const label = d.querySelector('summary').textContent; if (openDetails.has(label)) d.open = openDetails.get(label); });
    $('#shop').ontoggle = previews; shop.querySelectorAll('details').forEach((d) => { d.ontoggle = previews; });
    requestAnimationFrame(previews);
    requestAnimationFrame(() => paint($('#preview'), avatar));
  } };
})();
