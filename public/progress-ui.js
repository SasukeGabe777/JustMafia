// The profile progress view (level, today's / this week's challenges, the seasonal event and its
// season pass), shared by the box phone (🏆 My profile → ⭐ Progress), JustMafia's phone
// (🏆 Season & unlocks → ⭐ Progress) and the shop header strip. The server (box/progress.js) owns
// every number; this file only draws what it sends.
//
//   JGProgress.render(el, view, { reroll(period, id) -> Promise<{ ok, progress, error }>,
//                                 premium() -> Promise<{ ok, progress, error }>, toast(msg) })
//   JGProgress.badge(level, opts)      -> '<span class="jgp-badge">…</span>' (next to a name)
//   JGProgress.banner(season, opts)    -> the event banner (title screen, TV lobby, phones)
//   JGProgress.news(prog)              -> toast lines for level ups and finished challenges
//   JGProgress.theme(el, season)       -> paints the season colours on an element (CSS vars)
// Elements with [data-season-banner] (title screen, TV lobby) and [data-progress-strip] (the shop
// header) fill themselves when the page loads.
(function () {
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const X = () => window.MT_CHALLENGES || null, S = () => window.MT_SEASONS || null;
  // The stylesheet comes with the script.
  if (!document.querySelector('link[data-jgp-css]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/progress.css'; l.dataset.jgpCss = '1'; document.head.appendChild(l); }

  const BADGES = [[1, '#c98b4f', 'Bronze'], [10, '#b8c4d6', 'Silver'], [20, '#ffcf3f', 'Gold'], [30, '#7fe3d6', 'Platinum'], [50, '#8ab8ff', 'Diamond'], [75, '#d58bff', 'Mythic'], [100, '#ff7a59', 'Legend']];
  const band = (level) => BADGES.filter((b) => level >= b[0]).pop() || BADGES[0];
  function badge(level, opts = {}) {
    const n = Math.max(1, Number(level) || 1), b = band(n);
    return `<span class="jgp-badge${opts.big ? ' big' : ''}${opts.cls ? ' ' + opts.cls : ''}" style="--c:${b[1]}" title="Level ${n} · ${b[2]}"><i aria-hidden="true">★</i>${n}</span>`;
  }
  const left = (ms) => {
    ms = Math.max(0, ms); const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
  };
  const themeVars = (s) => (s && s.theme ? `--ea:${s.theme.a};--eb:${s.theme.b};--ec:${s.theme.c};` : '');
  function theme(el, s) { if (!el || !s || !s.theme) return; el.style.setProperty('--ea', s.theme.a); el.style.setProperty('--eb', s.theme.b); el.style.setProperty('--ec', s.theme.c); }
  const daysText = (n) => (n <= 0 ? 'Ends today' : n === 1 ? 'Event ends tomorrow' : `Event ends in ${n} days`);
  // The event banner: the running event, or the next one ("coming soon").
  function banner(season, opts = {}) {
    const sz = S();
    if (!season && sz) season = sz.currentSeason();
    if (season && season.end && season.daysLeft == null && sz) season = { ...season, daysLeft: sz.daysLeft(season) };
    if (!season) {
      const nx = opts.next || (sz && sz.nextSeason());
      if (!nx || opts.currentOnly) return '';
      const inDays = nx.inDays != null ? nx.inDays : Math.max(0, Math.ceil((Date.parse(nx.start + 'T00:00:00Z') - Date.now()) / 86400000));
      return `<div class="jgp-banner soon${opts.compact ? ' compact' : ''}" style="${themeVars(nx)}"><span class="jgp-bi">${esc(nx.icon)}</span><div><small>NEXT EVENT</small><b>${esc(nx.name)}</b><span>Starts in ${inDays} day${inDays === 1 ? '' : 's'}</span></div></div>`;
    }
    if (opts.pill) return `<span class="jgp-pill" style="${themeVars(season)}" title="${esc(season.blurb || '')}"><b>${esc(season.icon)} ${esc(season.name)}</b><em>${esc(daysText(season.daysLeft))}</em></span>`;
    return `<div class="jgp-banner${opts.compact ? ' compact' : ''}${opts.tv ? ' tv' : ''}" style="${themeVars(season)}"><span class="jgp-bi">${esc(season.icon)}</span><div><small>SEASONAL EVENT</small><b>${esc(season.name)}</b>${opts.compact ? '' : `<span class="jgp-blurb">${esc(season.blurb || '')}</span>`}</div><em class="jgp-days">⏳ ${esc(daysText(season.daysLeft))}</em></div>`;
  }

  const ITEM_ICON = { hat: '🎩', outfit: '👕', effect: '✨', nameplate: '🏷️', accessory: '🕶️', reactions: '😀', hair: '💇', shoeStyle: '👟', houseStyle: '🏠', houseDecor: '🪴', deathAnim: '💀', ghostSkin: '👻', gear: '🎒' };
  const reward = (r) => {
    if (!r) return '<span class="jgp-none">·</span>';
    if (r.item) return `<span class="jgp-item" title="${esc(r.name || r.item)}"><i>${ITEM_ICON[String(r.item).split(':')[0]] || '🎁'}</i>${esc(r.name || 'Item')}</span>`;
    if (r.title) return `<span class="jgp-item title" title="Title: ${esc(r.title)}"><i>🏅</i>${esc(r.title)}</span>`;
    if (r.gold) return `<span class="jgp-gold">🪙 ${r.gold}</span>`;
    return '<span class="jgp-none">·</span>';
  };
  const row = (c, can) => {
    const pct = Math.round((c.progress / Math.max(1, c.count)) * 100);
    return `<li class="jgp-ch${c.done ? ' done' : ''}"><span class="jgp-ci">${c.done ? '✅' : esc(c.icon)}</span><div class="jgp-cb"><b>${esc(c.label)}</b>
      <div class="jgp-cbar"><i style="width:${pct}%"></i><span>${c.progress}/${c.count}</span></div>
      <small class="jgp-rw">+${c.xp} XP · 🪙 ${c.gold}</small></div>${can && !c.done ? `<button class="jgp-reroll" data-jgp-reroll="${esc(c.period)}|${esc(c.id)}" title="Swap this challenge (1 free a day)">🎲</button>` : ''}</li>`;
  };

  function render(el, v, h = {}) {
    if (!el) return;
    if (!v) { el.innerHTML = '<p class="jgp-muted">Loading your profile…</p>'; return; }
    const now = Date.now(), s = v.season, lvlPct = Math.round((v.into / Math.max(1, v.need)) * 100), nr = v.nextReward || {};
    const can = v.rerolls && v.rerolls.left > 0;
    let html = `<div class="jgp" style="${themeVars(s || v.next)}">
      <div class="jgp-level">${badge(v.level, { big: true })}<div class="jgp-lv-body"><div class="jgp-lv-top"><b>Level ${v.level}</b><small>${esc((v.badge && v.badge.name) || band(v.level)[2])} · ${v.xp.toLocaleString()} XP</small></div>
        <div class="jgp-bar"><i style="width:${lvlPct}%"></i></div>
        <small class="jgp-muted">${v.into}/${v.need} XP to level ${v.level + 1} · next: 🪙 ${nr.gold || 0}${nr.item ? ' + an item' : ''}${nr.title ? ` + the “${esc(nr.title)}” title` : ''}</small></div></div>
      ${s ? banner(s) : banner(null, { next: v.next })}
      <div class="jgp-sec"><h3>☀️ Today <small>new in ${left(v.daily.endsAt - now)}</small><span class="jgp-rr${can ? '' : ' used'}">🎲 ${can ? `${v.rerolls.left} free reroll` : 'reroll used'}</span></h3><ul class="jgp-list">${v.daily.list.map((c) => row(c, can)).join('')}</ul></div>
      <div class="jgp-sec"><h3>📅 This week <small>new in ${left(v.weekly.endsAt - now)}</small></h3><ul class="jgp-list">${v.weekly.list.map((c) => row(c, can)).join('')}</ul></div>`;
    if (s) {
      const into = s.tier >= s.tiers ? s.xpPerTier : s.xp - s.tier * s.xpPerTier, tp = Math.round((into / s.xpPerTier) * 100);
      html += `<div class="jgp-sec"><h3>${esc(s.icon)} ${esc(s.name)} challenges <small>${esc(daysText(s.daysLeft))}</small></h3><ul class="jgp-list event">${s.challenges.map((c) => row(c, false)).join('')}</ul></div>
      <div class="jgp-sec jgp-pass"><h3>🎟️ Season pass <small>Tier <b>${s.tier}</b>/${s.tiers}</small></h3>
        <div class="jgp-bar pass"><i style="width:${s.tier >= s.tiers ? 100 : tp}%"></i></div>
        <small class="jgp-muted">${s.tier >= s.tiers ? 'Every tier reached!' : `${into}/${s.xpPerTier} XP to tier ${s.tier + 1}. Every game you play counts.`}</small>
        <div class="jgp-track" role="list"><div class="jgp-rowlbl"><span>Free</span><span></span><span>⭐ Premium</span></div>${s.track.map((t) => `<div class="jgp-tier${t.tier <= s.tier ? ' reached' : ''}${t.tier === s.tier + 1 ? ' next' : ''}" role="listitem">
          <div class="jgp-cell${t.freeGot ? ' got' : ''}">${reward(t.free)}</div><span class="jgp-tn">${t.tier}</span><div class="jgp-cell prem${t.premGot ? ' got' : ''}${s.premium ? '' : ' locked'}">${reward(t.premium)}</div></div>`).join('')}</div>
        ${s.premium ? `<p class="jgp-owned">⭐ Premium track unlocked${s.fromCredit ? ' (your old JustMafia season pass carried over)' : ''}: every tier pays both rewards.</p>` : `<button class="jgp-buy" data-jgp-premium>⭐ Unlock the premium track · ${s.cost} JG</button><small class="jgp-muted">Pays every tier you already reached, plus the event’s limited items.</small>`}
      </div>`;
    }
    if (v.credit) html += `<p class="jgp-owned">🎟️ You have ${v.credit} free premium pass${v.credit === 1 ? '' : 'es'} from JustMafia’s old season pass: it unlocks automatically when the next event starts.</p>`;
    html += '</div>';
    el.innerHTML = html;
    const again = (r) => { if (r && r.ok && r.progress) render(el, r.progress, h); else if (r && r.error && h.toast) h.toast(r.error); return r; };
    for (const b of el.querySelectorAll('[data-jgp-reroll]')) b.onclick = async () => { if (!h.reroll) return; b.disabled = true; const [period, id] = b.dataset.jgpReroll.split('|'); const r = again(await h.reroll(period, id)); if (r && r.ok && h.toast) h.toast('🎲 New challenge!'); b.disabled = false; };
    const pb = el.querySelector('[data-jgp-premium]'); if (pb) pb.onclick = async () => { if (!h.premium) return; pb.disabled = true; const r = again(await h.premium()); if (r && r.ok && h.toast) h.toast('⭐ Premium pass unlocked!'); pb.disabled = false; };
    // Scroll the pass track to the next tier.
    const nx = el.querySelector('.jgp-tier.next') || el.querySelector('.jgp-tier.reached:last-of-type'), tr = el.querySelector('.jgp-track');
    if (nx && tr) tr.scrollLeft = Math.max(0, nx.offsetLeft - tr.clientWidth / 2);
  }

  // Toast lines for a finished game's progress news ({ xp, levelUps, completed } from the room).
  function news(p) {
    if (!p) return [];
    const out = [];
    for (const c of p.completed || []) out.push(`${c.period === 'daily' ? '☀️ Daily' : c.period === 'weekly' ? '📅 Weekly' : '🎪 Event'} challenge done: ${c.icon} ${c.label} · +${c.xp} XP, +${c.gold} JG`);
    // Several level ups at once: one toast for the highest (with everything they paid).
    const ups = p.levelUps || [];
    if (ups.length) {
      const top = ups[ups.length - 1], gold = ups.reduce((n, u) => n + (u.gold || 0), 0), items = ups.filter((u) => u.item).length, title = ups.map((u) => u.title).filter(Boolean).pop();
      out.push(`⭐ Level ${top.level}!${ups.length > 1 ? ` (+${ups.length} levels)` : ''} +${gold} JG${items ? ` and ${items === 1 ? 'a new item' : items + ' new items'}` : ''}${title ? ` · new title “${title}”` : ''}`);
    }
    if (!out.length && p.xp) out.push(`⭐ +${p.xp} XP${p.level ? ` · level ${p.level}` : ''}`);
    return out;
  }

  // ---------- auto-mount: banners and the shop strip ----------
  function mountBanners() {
    for (const el of document.querySelectorAll('[data-season-banner]')) {
      const mode = el.dataset.seasonBanner || '';
      el.innerHTML = banner(null, { compact: /compact/.test(mode), tv: /tv/.test(mode), pill: /pill/.test(mode), currentOnly: /current/.test(mode) });
      el.hidden = !el.innerHTML;
    }
  }
  function mountStrip() {
    const el = document.querySelector('[data-progress-strip]'); if (!el || !window.io) return;
    let auth = null; try { const p = JSON.parse(localStorage.getItem('box.profile') || 'null'); if (p && p.id && p.token) auth = { id: p.id, token: p.token }; } catch (e) { auth = null; }
    const sz = S(), s = sz && sz.currentSeason();
    const draw = (v) => {
      const se = v && v.season ? v.season : s ? { ...s, daysLeft: sz.daysLeft(s) } : null;
      el.innerHTML = `${v ? badge(v.level) : ''}${se ? `<span class="jgp-strip-ev" style="${themeVars(se)}">${esc(se.icon)} ${esc(se.name)} · ${se.daysLeft}d${v && v.season ? ` · tier ${v.season.tier}` : ''}</span>` : ''}`;
      el.hidden = !el.innerHTML;
      el.title = v ? `Level ${v.level}: see your challenges in 🏆 My profile` : '';
    };
    draw(null);
    if (!auth) return;
    try {
      const sock = window.io('/box', { transports: ['websocket', 'polling'] });
      sock.emit('progress:get', { auth }, (r) => { if (r && r.ok) draw(r.progress); sock.close(); });
      setTimeout(() => { try { sock.close(); } catch (e) { /* closed */ } }, 8000);
    } catch (e) { /* offline */ }
  }
  const boot = () => { mountBanners(); mountStrip(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);

  window.JGProgress = { render, badge, banner, news, theme, left, mountBanners };
})();
