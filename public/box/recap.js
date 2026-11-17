'use strict';
// End-of-night recap (data from box/recap.js, in tvState.recap / playerState.recap).
//   TV:    BOX.recapReel(el, recap, { host, close }) plays the reel: the night in numbers, the
//          games and their winners, top moments, everyone's awards, the champion, then
//          "📸 Save the night". Called on every update with the same element.
//   Image: BOX.recapImage(recap) → a PNG data URL (canvas), BOX.saveImage(url, name) downloads it.
//   Phone: BOX.recapCard(card, me) → HTML; BOX.recapCardImage(card, me) → PNG data URL.
(function () {
  const B = window.BOX; if (!B) return;
  const esc = B.esc, ft = (s) => (B.filterText ? B.filterText(s) : s);
  const icon = (k) => (B.games[k] && B.games[k].icon) || '🎮';
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dateText = (t) => { try { return new Date(t || Date.now()).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }); } catch { return ''; } };
  const av = (r, cls = '') => `<span class="rc-av ${cls}" style="--pc:${esc(r.color || '#7b61ff')}">${esc(r.avatar || '🙂')}</span>`;

  // ---- the slides ----
  function slides(rc) {
    const out = [];
    const games = rc.played.length;
    out.push({ k: 'intro', ms: 4200, html: `<div class="rc-intro"><div class="rc-kicker">🎬 Tonight on JustGameBox</div><h1>What a night!</h1><p class="rc-date">${esc(dateText(rc.at))}</p>
      <div class="rc-nums"><div><b>${games}</b><span>game${games === 1 ? '' : 's'}</span></div><div><b>${rc.players}</b><span>players</span></div>${rc.minutes ? `<div><b>${rc.minutes}</b><span>minutes</span></div>` : ''}${rc.audience ? `<div><b>${rc.audience}</b><span>watching</span></div>` : ''}</div></div>` });
    const list = rc.played.slice(-12);
    out.push({ k: 'games', ms: 3000 + list.length * 600, html: `<div class="rc-games"><h2>🎮 The games</h2><ol>${list.map((g, i) => `<li style="--j:${i}"><span class="rc-gi">${icon(g.game)}</span><span class="rc-gt">${esc(g.title)}</span>${g.winner ? `<span class="rc-gw">${g.top && g.top[0] ? av(g.top[0], 'sm') : ''}🏆 ${esc(ft(g.winner))}</span>` : '<span class="rc-gw muted">no winner</span>'}${g.fav ? `<span class="rc-fav">📣 ${esc(ft(g.fav.name))}</span>` : ''}</li>`).join('')}</ol>${rc.played.length > 12 ? `<p class="muted">…and ${rc.played.length - 12} more</p>` : ''}</div>` });
    if (rc.moments.length) out.push({ k: 'moments', ms: 3000 + rc.moments.length * 1500, html: `<div class="rc-moments"><h2>⚡ Top moments</h2><div class="rc-mlist">${rc.moments.map((m, i) => `<div class="rc-moment" style="--j:${i}"><span class="rc-mi">${esc(m.icon)}</span><div><small>${esc(m.title)}</small><b>${esc(ft(m.text))}</b></div><span class="rc-mg">${icon(m.game)}</span></div>`).join('')}</div></div>` });
    const per = 12;
    for (let i = 0; i < rc.awards.length; i += per) {
      const page = rc.awards.slice(i, i + per);
      out.push({ k: 'awards', ms: 3500 + page.length * 500, html: `<div class="rc-awards"><h2>🏅 Awards${rc.awards.length > per ? ` <small>${i / per + 1}/${Math.ceil(rc.awards.length / per)}</small>` : ''}</h2><div class="rc-agrid">${page.map((a, j) => `<div class="rc-award" style="--j:${j};--pc:${esc(a.color || '#ffd23f')}"><span class="rc-ai">${esc(a.icon)}</span>${av(a, 'sm')}<div><b>${esc(a.title)}</b><span>${esc(ft(a.name))}</span><small>${esc(a.desc || '')}</small></div></div>`).join('')}</div></div>` });
    }
    const [p1, p2, p3] = rc.board;
    const step = (r, place) => (r ? `<div class="rc-pod p${place}" style="--pc:${esc(r.color || '#7b61ff')}">${place === 1 ? '<span class="rc-crown">👑</span>' : ''}${av(r, place === 1 ? 'xl' : 'lg')}<b>${esc(ft(r.name))}</b><span>${r.pts} pts${r.wins ? ` · ⭐${r.wins}` : ''}</span><div class="rc-block">${place}</div></div>` : '');
    if (p1) out.push({ k: 'champ', ms: 7500, html: `<div class="rc-champ"><div class="rc-kicker">${rc.party ? '🎉 Party champion' : '👑 Tonight’s champion'}</div><h1>${esc(ft(p1.name))}!</h1><div class="rc-podium">${step(p2, 2)}${step(p1, 1)}${step(p3, 3)}</div></div>` });
    out.push({ k: 'end', ms: 0, html: `<div class="rc-end"><h2>📸 Save the night</h2><p>Download a picture of tonight to share with everyone.</p><img class="rc-preview" alt="Night summary"><div class="rc-endbtns"><button class="btn big" data-rc="save">📸 Save the night</button><button class="btn ghost" data-rc="again">🔁 Watch again</button><button class="btn ghost" data-rc="close">✕ Close</button></div><p class="muted small">Phones have their own recap card with a save button too.</p></div>` });
    return out;
  }

  B.recapReel = function (el, rc, ctx = {}) {
    if (!el || !rc) return;
    let s = el._rc;
    if (!s || s.id !== rc.id) {
      if (s) clearTimeout(s.timer);
      s = el._rc = { id: rc.id, i: 0, paused: false, timer: 0, list: slides(rc), rc };
      el.innerHTML = `<div class="rc"><div class="rc-sky" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="--x:${(i * 37 + 11) % 100}%;--h:${(i * 71) % 360}deg;--d:${9 + (i * 5) % 7}s;--dl:-${(i * 3) % 9}s"></i>`).join('')}</div>
        <div class="rc-stage"></div>
        <div class="rc-bar"><div class="rc-dots"></div><div class="rc-ctl"><button data-rc="prev" title="Back">◀</button><button data-rc="pause" title="Pause">⏸</button><button data-rc="next" title="Next">▶</button><button data-rc="save" title="Save the night">📸</button><button data-rc="close" title="Close the recap">✕</button></div></div></div>`;
      el.onclick = (e) => {
        const b = e.target.closest('[data-rc]'); if (!b) return;
        const a = b.dataset.rc; B.sfx('pop');
        if (a === 'prev') go(s.i - 1); else if (a === 'next') go(s.i + 1);
        else if (a === 'pause') { s.paused = !s.paused; b.textContent = s.paused ? '▶' : '⏸'; if (!s.paused) go(s.i); else clearTimeout(s.timer); }
        else if (a === 'again') go(0);
        else if (a === 'save') B.saveImage(B.recapImage(s.rc), 'justgamebox-night.png');
        else if (a === 'close') { clearTimeout(s.timer); if (ctx.close) ctx.close(); }
      };
      const go = (i) => {
        clearTimeout(s.timer);
        s.i = Math.max(0, Math.min(s.list.length - 1, i));
        const sl = s.list[s.i], stage = el.querySelector('.rc-stage');
        stage.innerHTML = `<div class="rc-slide rc-${sl.k}">${sl.html}</div>`;
        el.querySelector('.rc-dots').innerHTML = s.list.map((x, k) => `<i class="${k === s.i ? 'on' : k < s.i ? 'done' : ''}"></i>`).join('');
        if (sl.k === 'end') { const img = stage.querySelector('.rc-preview'); if (img) setTimeout(() => { try { img.src = B.recapImage(s.rc); } catch (e) { console.error(e); } }, 60); }
        B.sfx(sl.k === 'champ' ? 'win' : sl.k === 'intro' ? 'swell' : 'whoosh');
        if (sl.k === 'champ') B.sfx('cheer');
        if (sl.ms && !s.paused) s.timer = setTimeout(() => { if (el.isConnected && el._rc === s) go(s.i + 1); }, reduced ? Math.max(2500, sl.ms) : sl.ms);
      };
      s.go = go; go(0);
    }
    s.ctx = ctx;
  };

  // ---- the shareable picture (canvas → PNG) ----
  const FONT = (w, px) => `${w} ${px}px Fredoka, 'Segoe UI', system-ui, sans-serif`;
  function bg(cx, W, H, c1 = '#1b1240', c2 = '#4a1677') {
    const g = cx.createLinearGradient(0, 0, W, H); g.addColorStop(0, c1); g.addColorStop(1, c2); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    // confetti dots
    const C = ['#ffd23f', '#ff4f9a', '#3ee6ff', '#2ee6a6', '#ff7134', '#b388ff'];
    for (let i = 0; i < 70; i++) { cx.fillStyle = C[i % C.length]; cx.globalAlpha = 0.18 + ((i * 7) % 10) / 40; const x = (i * 197) % W, y = (i * 113) % H; cx.save(); cx.translate(x, y); cx.rotate(i); cx.fillRect(-6, -3, 12, 6); cx.restore(); }
    cx.globalAlpha = 1;
  }
  function rrect(cx, x, y, w, h, r, fill) { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); cx.fillStyle = fill; cx.fill(); }
  function fit(cx, text, max) { text = String(text || ''); if (cx.measureText(text).width <= max) return text; while (text.length > 1 && cx.measureText(text + '…').width > max) text = text.slice(0, -1); return text + '…'; }
  function logo(cx, W, y) {
    cx.textAlign = 'center'; cx.font = FONT(700, 44);
    const parts = [['Just', '#fff8ef'], ['Game', '#ff4f9a'], ['Box', '#ffd23f']];
    const total = parts.reduce((n, [t]) => n + cx.measureText(t).width, 0); let x = (W - total) / 2;
    cx.textAlign = 'left'; for (const [t, c] of parts) { cx.fillStyle = c; cx.fillText(t, x, y); x += cx.measureText(t).width; }
  }
  B.recapImage = function (rc) {
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d'); bg(cx, W, H);
    logo(cx, W, 80);
    cx.textAlign = 'center'; cx.fillStyle = '#c9bfe6'; cx.font = FONT(600, 28); cx.fillText(`Night recap · ${dateText(rc.at)}`, W / 2, 124);
    // champion
    const c = rc.champion;
    rrect(cx, 60, 156, W - 120, 280, 36, 'rgba(255,255,255,0.10)');
    if (c) {
      cx.fillStyle = '#ffffff'; cx.font = FONT(400, 54); cx.fillText('👑', W / 2, 212); cx.font = FONT(400, 110); cx.fillText(c.avatar || '🙂', W / 2, 318);
      cx.font = FONT(700, 54); cx.fillStyle = '#ffd23f'; cx.fillText(fit(cx, `${ft(c.name)} wins the night!`, W - 180), W / 2, 382);
      cx.font = FONT(600, 26); cx.fillStyle = '#fff8ef'; cx.fillText(`${c.pts} party points · ${c.wins} win${c.wins === 1 ? '' : 's'} · ${rc.played.length} game${rc.played.length === 1 ? '' : 's'} · ${rc.players} players`, W / 2, 418);
    }
    // standings (left) and games (right)
    const top = 462; cx.textAlign = 'left';
    rrect(cx, 60, top, 470, 500, 30, 'rgba(0,0,0,0.25)'); rrect(cx, 550, top, 470, 500, 30, 'rgba(0,0,0,0.25)');
    cx.fillStyle = '#ffd23f'; cx.font = FONT(700, 32); cx.fillText('🏆 Standings', 88, top + 52); cx.fillText('🎮 Games', 578, top + 52);
    rc.board.slice(0, 8).forEach((r, i) => {
      const y = top + 104 + i * 49;
      cx.fillStyle = i === 0 ? '#ffd23f' : '#c9bfe6'; cx.font = FONT(700, 26); cx.fillText(`${i + 1}.`, 88, y);
      cx.font = FONT(400, 30); cx.fillText(r.avatar || '🙂', 126, y + 2);
      cx.fillStyle = '#fff8ef'; cx.font = FONT(600, 28); cx.fillText(fit(cx, ft(r.name), 230), 172, y);
      cx.textAlign = 'right'; cx.fillStyle = '#3ee6ff'; cx.font = FONT(700, 28); cx.fillText(String(r.pts), 500, y); cx.textAlign = 'left';
    });
    rc.played.slice(-8).forEach((g, i) => {
      const y = top + 104 + i * 49;
      cx.font = FONT(400, 30); cx.fillStyle = '#fff'; cx.fillText(icon(g.game), 578, y + 2);
      cx.font = FONT(600, 24); cx.fillStyle = '#fff8ef'; cx.fillText(fit(cx, g.title, 200), 626, y - 4);
      cx.font = FONT(600, 20); cx.fillStyle = '#2ee6a6'; cx.fillText(fit(cx, g.winner ? '🏆 ' + ft(g.winner) : '—', 360), 626, y + 20);
    });
    // awards
    const ay = 988; rrect(cx, 60, ay, W - 120, 280, 30, 'rgba(255,255,255,0.08)');
    cx.fillStyle = '#ffd23f'; cx.font = FONT(700, 32); cx.fillText('🏅 Awards', 88, ay + 50);
    rc.awards.slice(0, 6).forEach((a, i) => {
      const x = 88 + (i % 2) * 470, y = ay + 104 + Math.floor(i / 2) * 58;
      cx.font = FONT(400, 32); cx.fillStyle = '#fff'; cx.fillText(a.icon || '🏅', x, y + 4);
      cx.font = FONT(700, 24); cx.fillStyle = '#fff8ef'; cx.fillText(fit(cx, a.title, 380), x + 50, y - 6);
      cx.font = FONT(600, 20); cx.fillStyle = '#c9bfe6'; cx.fillText(fit(cx, `${a.avatar || ''} ${ft(a.name)}`, 380), x + 50, y + 20);
    });
    cx.textAlign = 'center'; cx.fillStyle = 'rgba(255,255,255,0.55)'; cx.font = FONT(600, 22); cx.fillText('Party games for the big screen · everyone plays from their phone', W / 2, H - 30);
    return cv.toDataURL('image/png');
  };
  B.saveImage = function (url, name) {
    const a = document.createElement('a'); a.href = url; a.download = name || 'justgamebox.png'; document.body.appendChild(a); a.click(); a.remove();
  };

  // ---- the phone's personal card ----
  B.recapCard = function (c, me) {
    if (!c) return '';
    const place = c.rank ? (c.rank === 1 ? '👑' : '#' + c.rank) : '–';
    return `<div class="card-box rc-card">
      <div class="rc-ckick">🎬 Your night</div>
      <div class="rc-cav" style="--pc:${esc(me.color || '#7b61ff')}">${esc(me.avatar || '🙂')}</div>
      <h3>${c.me ? 'You won the night!' : c.rank ? `You finished ${ordinal(c.rank)} of ${c.of}` : 'Thanks for playing!'}</h3>
      <div class="rc-cstats"><div><b>${place}</b><span>place</span></div><div><b>${c.pts}</b><span>party pts</span></div><div><b>${c.wins}</b><span>win${c.wins === 1 ? '' : 's'}</span></div><div><b>${c.games}</b><span>of ${c.played} games</span></div></div>
      ${c.best ? `<p class="rc-cbest">Best finish: <b>${ordinal(c.best.place)}</b> in ${icon(c.best.game)} ${esc(c.best.title)}</p>` : ''}
      ${c.awards.length ? `<div class="rc-caw">${c.awards.map((a) => `<div><span>${esc(a.icon)}</span><b>${esc(a.title)}</b><small>${esc(a.desc || '')}</small></div>`).join('')}</div>` : ''}
      ${c.trophies && c.trophies.length ? `<p class="rc-ctro">New trophies tonight: ${c.trophies.map((t) => `<span title="${esc(t.name)}">${esc(t.icon)} ${esc(t.name)}</span>`).join(' ')}</p>` : ''}
      ${c.champion && !c.me ? `<p class="muted">👑 Champion: <b>${esc(c.champion)}</b></p>` : ''}
      <button class="btn big green" id="rc-save">📸 Save my recap</button></div>`;
  };
  B.recapCardImage = function (c, me) {
    const W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d'); bg(cx, W, H, '#1b1240', '#14506b');
    logo(cx, W, 90);
    cx.textAlign = 'center'; cx.fillStyle = '#c9bfe6'; cx.font = FONT(600, 30); cx.fillText(`My night · ${dateText()}`, W / 2, 138);
    rrect(cx, 90, 180, W - 180, 520, 40, 'rgba(255,255,255,0.10)');
    cx.font = FONT(400, 170); cx.fillStyle = '#ffffff'; cx.fillText(me.avatar || '🙂', W / 2, 390);
    cx.font = FONT(700, 64); cx.fillStyle = '#fff8ef'; cx.fillText(fit(cx, me.name || '', W - 260), W / 2, 480);
    cx.font = FONT(700, 46); cx.fillStyle = '#ffd23f'; cx.fillText(c.me ? '👑 Won the night!' : c.rank ? `${ordinal(c.rank)} of ${c.of}` : 'Thanks for playing!', W / 2, 560);
    const stats = [[c.pts, 'party points'], [c.wins, c.wins === 1 ? 'win' : 'wins'], [c.games, 'games']];
    stats.forEach(([v, l], i) => { const x = 250 + i * 290; cx.font = FONT(700, 64); cx.fillStyle = '#3ee6ff'; cx.fillText(String(v), x, 650); cx.font = FONT(600, 24); cx.fillStyle = '#c9bfe6'; cx.fillText(l, x, 684); });
    let y = 780; cx.textAlign = 'left';
    if (c.best) { cx.font = FONT(600, 34); cx.fillStyle = '#fff8ef'; cx.fillText(fit(cx, `Best finish: ${ordinal(c.best.place)} in ${icon(c.best.game)} ${c.best.title}`, W - 200), 110, y); y += 70; }
    for (const a of c.awards.slice(0, 4)) { cx.font = FONT(400, 48); cx.fillText(a.icon || '🏅', 110, y + 6); cx.font = FONT(700, 34); cx.fillStyle = '#ffd23f'; cx.fillText(fit(cx, a.title, W - 320), 180, y - 6); cx.font = FONT(600, 24); cx.fillStyle = '#c9bfe6'; cx.fillText(fit(cx, a.desc || '', W - 320), 180, y + 26); cx.fillStyle = '#fff8ef'; y += 86; }
    if (c.trophies && c.trophies.length && y < H - 140) { cx.font = FONT(600, 30); cx.fillStyle = '#2ee6a6'; cx.fillText(fit(cx, '🏆 New trophies: ' + c.trophies.map((t) => t.icon + ' ' + t.name).join('  '), W - 200), 110, y + 10); }
    cx.textAlign = 'center'; cx.fillStyle = 'rgba(255,255,255,0.55)'; cx.font = FONT(600, 24); cx.fillText(c.champion && !c.me ? `👑 Champion of the night: ${c.champion}` : 'JustGameBox · party games for the big screen', W / 2, H - 40);
    return cv.toDataURL('image/png');
  };
})();
