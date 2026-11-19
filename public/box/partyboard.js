/* Party Mode standings board (TV). */
'use strict';
// Party Mode on the TV: the standings show between games (BOX.partyBoard while
// partyMode.phase is 'board'), the champion finale ('done'), and the lineup strip in the
// lobby (BOX.partyLineup). tv.js calls partyBoard on every state update with the same
// element: the scene is built once per board and animated on the client clock.
(function () {
  const B = window.BOX; if (!B) return;
  const esc = B.esc;
  const sfx = (n) => B.sfx(n);
  const icon = (k) => (B.games[k] && B.games[k].icon) || '🎮';
  const gname = (k, t) => t || (B.games[k] && B.games[k].name) || k;
  const COLORS = ['#ffd23f', '#ff4f9a', '#3ee6ff', '#2ee6a6', '#ff7134', '#b388ff', '#ffffff'];
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- The lineup strip in the lobby ----
  B.partyLineup = function (state) {
    const pm = state && state.partyMode; if (!pm || !pm.games || !pm.games.length) return '';
    const n = pm.games.length, cur = Math.min(pm.index, n - 1);
    const doneUpTo = pm.phase === 'playing' ? cur : cur + 1; // games before this one are finished
    return `<div class="pl-strip"><div class="pl-head">🎉 <b>Party lineup</b><span>Game ${cur + 1} of ${n}${pm.minutes ? ` · ${pm.minutes >= 120 ? '2 h+' : pm.minutes >= 60 ? (pm.minutes / 60) + ' h' : pm.minutes + ' min'} party` : ''}</span></div>
      <ol class="pl-games">${pm.games.map((k, i) => `<li class="${i < doneUpTo ? 'done' : i === cur ? 'cur' : ''}${i === n - 1 ? ' fin' : ''}"><span class="pl-i">${icon(k)}</span><span class="pl-n">${esc(gname(k, pm.titles && pm.titles[i]))}</span>${i < doneUpTo ? '<span class="pl-ok">✓</span>' : i === cur ? '<span class="pl-now">NOW</span>' : ''}</li>`).join('')}</ol></div>`;
  };

  // ---- Shared bits ----
  const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const stars = (w) => (w ? `<span class="pb-stars">${w > 4 ? '⭐×' + w : '⭐'.repeat(w)}</span>` : '');
  // Board stars: the star won in the last game pops in with the points.
  const starsNew = (r) => { const won = r.gain === 10 && r.wins > 0, old = r.wins - (won ? 1 : 0); if (!r.wins) return ''; return `<span class="pb-stars">${old > 3 ? '⭐×' + old : '⭐'.repeat(old)}${won ? '<span class="pb-nstar">⭐</span>' : ''}</span>`; };
  // A JustGold character face when the player has one (standings rows get it from the room's players).
  let looks = new Map();
  const av = (p) => { const look = p.look || looks.get(p.id); return `<span class="pb-av" style="--pc:${esc(p.color || '#7b61ff')}">${look && BOX.portrait ? BOX.portrait.html({ ...p, look }, 96, { fill: true }) : `<span>${esc(p.avatar || '🙂')}</span>`}</span>`; };
  function sky(extra) {
    return `<div class="pb-sky" aria-hidden="true"><div class="pb-rays"></div>
      <div class="pb-lights">${Array.from({ length: 22 }, (_, i) => `<i style="--h:${(i * 57) % 360}deg;--d:${(i % 4) * 0.35}s"></i>`).join('')}</div>
      ${Array.from({ length: 9 }, (_, i) => `<i class="pb-ball" style="--x:${(i * 41 + 7) % 100}%;--h:${(i * 83) % 360}deg;--d:${11 + (i * 7) % 8}s;--dl:-${(i * 5) % 11}s;--s:${0.6 + ((i * 3) % 5) / 10}"></i>`).join('')}${extra || ''}</div>`;
  }
  function track(pm, played) {
    const n = pm.games.length;
    return `<div class="pb-track">${pm.games.map((k, i) => `<span class="pb-step ${i <= pm.index ? 'done' : ''} ${i === pm.index + 1 ? 'next' : ''} ${i === n - 1 ? 'fin' : ''}" title="${esc(gname(k, pm.titles[i]))}"><span>${icon(k)}</span>${i <= pm.index ? '<b>✓</b>' : ''}</span>${i < n - 1 ? `<i class="pb-path ${i < pm.index ? 'done' : ''}"></i>` : ''}`).join('')}</div>`;
  }
  const lastLine = (played) => {
    const g = played && played[played.length - 1]; if (!g) return '';
    return g.winner ? `<span class="pb-gi">${icon(g.game)}</span> <b>${esc(g.winner)}</b> won <b>${esc(g.title)}</b>!` : `<span class="pb-gi">${icon(g.game)}</span> <b>${esc(g.title)}</b> is done!`;
  };

  // A confetti canvas that runs until its element leaves the page.
  function confetti(canvas) {
    const cx = canvas.getContext('2d'); const parts = [];
    let W = 0, H = 0, dpr = Math.min(1.5, window.devicePixelRatio || 1), rain = 0;
    const size = () => { W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = W * dpr; canvas.height = H * dpr; };
    size();
    const add = (x, y, n, power) => { for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, v = power * (0.5 + Math.random()); parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, w: 8 + Math.random() * 8, h: 5 + Math.random() * 6, c: COLORS[i % COLORS.length], t: 0 }); } };
    let last = performance.now();
    const frame = (now) => {
      if (!canvas.isConnected) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (canvas.clientWidth !== W || canvas.clientHeight !== H) size();
      if (rain > 0 && parts.length < 260 && Math.random() < rain) parts.push({ x: Math.random() * W, y: -20, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 80, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.2, w: 8 + Math.random() * 6, h: 5 + Math.random() * 5, c: COLORS[(Math.random() * COLORS.length) | 0], t: 0 });
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += dt;
        p.vy += 520 * dt; p.vx *= 0.985; p.vy = Math.min(p.vy, 260); p.x += p.vx * dt + Math.sin(p.t * 3 + i) * 0.6; p.y += p.vy * dt; p.r += p.vr;
        if (p.y > H + 30) { parts.splice(i, 1); continue; }
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.scale(1, Math.abs(Math.cos(p.t * 4 + i)) + 0.15);
        cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    return { burst: (fx, fy, n = 140, power = 900) => add(fx * W, fy * H, n, power), rain: (r) => { rain = r; } };
  }
  // Count a number up on the client clock.
  function countUp(el, from, to, ms) {
    if (reduced || from === to) { el.textContent = to; return; }
    const t0 = performance.now();
    const f = (now) => { if (!el.isConnected) return; const t = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - t, 3); el.textContent = Math.round(from + (to - from) * e); if (t < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }

  // ---- The standings board between games ----
  const TOP = 8;
  function buildBoard(el, state, s) {
    const pm = state.partyMode, rows = state.party || [], n = pm.games.length;
    const top = rows.slice(0, TOP), rest = rows.slice(TOP);
    const max = Math.max(1, ...rows.map((r) => r.pts));
    // Where each player stood before the last game (players new to the board come last).
    const before = [...top].sort((a, b) => (a.prevRank || 999) - (b.prevRank || 999) || rows.indexOf(a) - rows.indexOf(b));
    s.top = top; s.before = before;
    const k = top.length;
    const cols = top.map((r, i) => {
      const old = r.pts - (r.gain || 0), climb = r.prevRank ? r.prevRank - (i + 1) : 0;
      return `<div class="pb-col ${i === 0 ? 'lead' : ''}" data-id="${esc(r.id)}" style="--pc:${esc(r.color || '#7b61ff')};--i:${before.indexOf(r)};left:${(before.indexOf(r) * 100) / k}%;width:${100 / k}%">
        <div class="pb-who">
          <span class="pb-crown" aria-hidden="true">👑</span>
          ${av(r)}
          <span class="pb-name">${esc(r.name)}</span>
          ${starsNew(r)}
        </div>
        <div class="pb-bar" style="height:${14 + 70 * (old / max)}%" data-h="${14 + 70 * (r.pts / max)}">
          <span class="pb-gain ${r.gain ? '' : 'zero'}">+${r.gain || 0}</span>
          <span class="pb-pts" data-from="${old}" data-to="${r.pts}">${old}</span>
          <span class="pb-rank">${ordinal(i + 1)}</span>
          ${climb ? `<span class="pb-arrow ${climb > 0 ? 'up' : 'down'}">${climb > 0 ? '▲' : '▼'}${Math.abs(climb)}</span>` : ''}
        </div>
      </div>`;
    }).join('');
    const restHtml = rest.map((r, j) => {
      const i = TOP + j + 1, climb = r.prevRank ? r.prevRank - i : 0;
      return `<div class="pb-row" style="--pc:${esc(r.color || '#7b61ff')};--j:${j}"><span class="pb-rn">${i}</span><span class="pb-ra">${esc(r.avatar || '🙂')}</span><span class="pb-rname">${esc(r.name)}</span>${r.wins ? `<span class="pb-rs">⭐${r.wins > 1 ? r.wins : ''}</span>` : ''}<b>${r.pts}</b>${r.gain ? `<span class="pb-rg">+${r.gain}</span>` : ''}${climb ? `<span class="pb-arrow sm ${climb > 0 ? 'up' : 'down'}">${climb > 0 ? '▲' : '▼'}${Math.abs(climb)}</span>` : ''}</div>`;
    }).join('');
    el.innerHTML = `<div class="pb pb-board ${rest.length ? 'many' : ''} ${k <= 3 ? 'few' : ''}">
      ${sky()}
      <header class="pb-top">
        <div class="pb-brand"><span class="pb-party">🎉</span> Party Standings</div>
        ${track(pm, state.played)}
        <div class="pb-of">Game <b>${pm.index + 1}</b> of <b>${n}</b></div>
      </header>
      <div class="pb-headline">${lastLine(state.played)}</div>
      <div class="pb-main">
        <div class="pb-stage">
          <div class="pb-cols" style="--k:${k}">${cols || '<p class="pb-empty">No points yet. Play on!</p>'}</div>
          <div class="pb-floor" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<i style="--h:${(i * 47) % 360}deg"></i>`).join('')}</div>
        </div>
        <aside class="pb-side">
          <div class="pb-next">
            <div class="pb-nlabel">Up next</div>
            <div class="pb-nicon"><span>${pm.next ? icon(pm.next) : '🏁'}</span></div>
            <div class="pb-nname">${pm.next ? esc(gname(pm.next, pm.titles[pm.index + 1])) : 'The finale'}</div>
            ${pm.next && pm.index + 1 === n - 1 ? '<div class="pb-nfin">🏆 The last game!</div>' : ''}
            <div class="pb-clock"><svg viewBox="0 0 100 100"><circle class="pb-ring-bg" cx="50" cy="50" r="44"/><circle class="pb-ring" cx="50" cy="50" r="44" pathLength="100"/></svg><span class="pb-secs">–</span></div>
            <div class="pb-wait">Starting soon…</div>
          </div>
          <div class="pb-host">
            <button class="pb-btn go" data-pb="next">⏭ Next game now</button>
            <button class="pb-btn ghost" data-pb="pause">⏸ Wait</button>
          </div>
        </aside>
      </div>
      ${rest.length ? `<div class="pb-rest">${restHtml}</div>` : ''}
    </div>`;
    bindButtons(el, s);

    // The show: rise, count up the points, then everyone shuffles into their new places.
    const at = (ms, fn) => setTimeout(() => { if (el.isConnected && el._pb === s) fn(); }, reduced ? 0 : ms);
    sfx('swell');
    at(1100, () => {
      const gains = el.querySelectorAll('.pb-col');
      gains.forEach((c, i) => setTimeout(() => { if (!c.isConnected) return; c.classList.add('gained'); }, i * 90));
      sfx('pop'); setTimeout(() => sfx('pop'), 180); setTimeout(() => sfx('pop'), 360);
      for (const b of el.querySelectorAll('.pb-bar')) b.style.height = b.dataset.h + '%';
      for (const p of el.querySelectorAll('.pb-pts')) countUp(p, Number(p.dataset.from), Number(p.dataset.to), 1100);
    });
    at(2600, () => {
      const moved = top.some((r, i) => before.indexOf(r) !== i);
      el.querySelectorAll('.pb-col').forEach((c, i) => { c.style.left = (i * 100) / k + '%'; c.style.setProperty('--i', i); });
      if (moved) sfx('whoosh');
      el.querySelector('.pb-board').classList.add('sorted');
    });
    at(3500, () => { el.querySelector('.pb-board').classList.add('crowned'); sfx('chime'); });
  }

  function bindButtons(el, s) {
    for (const b of el.querySelectorAll('[data-pb]')) b.onclick = async () => {
      const a = b.dataset.pb; b.disabled = true; sfx('pop');
      if (a === 'next') await s.ctx.host('partyNext');
      else if (a === 'pause') await s.ctx.host('partyPause');
      else if (a === 'again') { const r = await s.ctx.host('partyAgain'); if (r && r.ok === false && r.error) alert(r.error); }
      else if (a === 'menu') { location.href = '/'; return; }
      else if (a === 'recap') await s.ctx.host('recap');
      b.disabled = false;
    };
  }

  // Live bits: countdown ring and pause.
  function updateBoard(el, state, s) {
    const pm = state.partyMode;
    const paused = !!pm.paused;
    const now = performance.now();
    if (!paused) {
      const dl = now + (pm.in || 0);
      if (s.deadline == null || s.paused || Math.abs(dl - s.deadline) > 700) { s.deadline = dl; s.total = Math.max(pm.in || 0, Math.min(pm.boardMs || 15000, pm.in > 6000 ? pm.boardMs || 15000 : 5000)); }
    }
    s.paused = paused;
    const board = el.querySelector('.pb-board'); if (!board) return;
    board.classList.toggle('paused', paused);
    const pb = el.querySelector('[data-pb="pause"]'); if (pb) pb.textContent = paused ? '▶ Resume' : '⏸ Wait';
    el.querySelector('.pb-wait').textContent = paused ? '⏸ Paused by the host' : 'Starting soon…';
    if (!s.loop) {
      s.loop = true;
      let lastSec = -1;
      const ring = el.querySelector('.pb-ring'), secs = el.querySelector('.pb-secs');
      const f = () => {
        if (!el.isConnected || el._pb !== s) return;
        if (s.paused) { secs.textContent = '⏸'; ring.style.strokeDashoffset = '0'; }
        else {
          const left = Math.max(0, s.deadline - performance.now()), sec = Math.ceil(left / 1000);
          ring.style.strokeDashoffset = String(100 - (100 * left) / (s.total || 15000));
          if (sec !== lastSec) { lastSec = sec; secs.textContent = sec > 0 ? sec : 'GO!'; if (sec > 0 && sec <= 3) sfx('tick'); }
        }
        requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    }
  }

  // ---- The finale ----
  function awards(rows, played) {
    const out = [];
    const nGames = played.length;
    const names = (list) => { const a = list.slice(0, 3).map((r) => esc(r.name)); return a.join(a.length > 2 ? ', ' : ' & ') + (list.length > 3 ? ` +${list.length - 3}` : ''); };
    const maxW = Math.max(0, ...rows.map((r) => r.wins));
    if (maxW > 0) { const w = rows.filter((r) => r.wins === maxW); out.push({ i: '⭐', t: 'Star Collector', who: names(w), d: `${maxW} game win${maxW > 1 ? 's' : ''}`, c: w[0].color }); }
    const climbs = rows.map((r, i) => ({ r, c: r.prevRank ? r.prevRank - (i + 1) : 0 })).filter((x) => x.c > 0).sort((a, b) => b.c - a.c);
    if (climbs.length) out.push({ i: '🚀', t: 'Comeback Kid', who: esc(climbs[0].r.name), d: `Climbed ${climbs[0].c} place${climbs[0].c > 1 ? 's' : ''} in the last game`, c: climbs[0].r.color });
    if (nGames >= 2) {
      const every = rows.filter((r) => r.games >= nGames);
      if (every.length && every.length === rows.length && rows.length > 1) out.push({ i: '🎯', t: 'Mr/Ms Consistent', who: 'Everyone!', d: `All ${nGames} games, nobody sat out` });
      else if (every.length) out.push({ i: '🎯', t: 'Mr/Ms Consistent', who: names(every), d: `Played all ${nGames} games`, c: every[0].color });
    }
    if (rows.length >= 2) {
      const gap = rows[0].pts - rows[1].pts;
      if (gap <= 5) out.push({ i: '😅', t: 'Photo Finish', who: esc(rows[1].name), d: gap ? `Just ${gap} point${gap > 1 ? 's' : ''} behind` : 'Tied on points!', c: rows[1].color });
      else out.push({ i: '💨', t: 'Runaway Winner', who: esc(rows[0].name), d: `Won by ${gap} points`, c: rows[0].color });
    }
    if (rows.length >= 4) { const l = rows[rows.length - 1]; out.push({ i: '🤗', t: 'Good Sport', who: esc(l.name), d: 'Smiled all the way to the end', c: l.color }); }
    return out.slice(0, 4);
  }
  function buildFinale(el, state, s) {
    const rows = state.party || [], played = state.played || [];
    const [p1, p2, p3] = rows;
    const step = (r, place) => (r ? `<div class="pb-step-p p${place}" style="--pc:${esc(r.color || '#7b61ff')}">
        <div class="pb-pwho">${place === 1 ? '<span class="pb-crown big">👑</span>' : ''}${av(r)}<span class="pb-name">${esc(r.name)}</span><span class="pb-ppts"><b>${r.pts}</b> pts ${stars(r.wins)}</span></div>
        <div class="pb-block"><span>${place}</span></div></div>` : `<div class="pb-step-p p${place} empty"><div class="pb-block"><span>${place}</span></div></div>`);
    const aw = awards(rows, played);
    el.innerHTML = `<div class="pb pb-final">
      ${sky('<div class="pb-spots"><i></i><i></i><i></i></div>')}
      <canvas class="pb-confetti"></canvas>
      <header class="pb-ftop"><div class="pb-fkicker">🎉 Party over · ${played.length} game${played.length === 1 ? '' : 's'} played</div>
        <h1 class="pb-ftitle"><span class="pb-drum">And tonight's champion is…</span><span class="pb-champ">${p1 ? `${esc(p1.name)} wins the party!` : 'What a party!'}</span></h1></header>
      <div class="pb-fmain">
        <div class="pb-podium">${step(p2, 2)}${step(p1, 1)}${step(p3, 3)}</div>
        <aside class="pb-fside">
          ${aw.length ? `<h3>🏅 Awards</h3><div class="pb-awards">${aw.map((a, i) => `<div class="pb-award" style="--j:${i};--pc:${esc(a.c || '#ffd23f')}"><span class="pb-ai">${a.i}</span><div><b>${a.t}</b><span class="pb-aw">${a.who}</span><small>${esc(a.d)}</small></div></div>`).join('')}</div>` : ''}
          ${played.length ? `<h3>🎮 Tonight's games</h3><ol class="pb-played">${played.slice(-10).map((g) => `<li><span>${icon(g.game)}</span><b>${esc(g.title)}</b>${g.winner ? `<em>🏆 ${esc(g.winner)}</em>` : ''}</li>`).join('')}</ol>` : ''}
        </aside>
      </div>
      ${rows.length > 3 ? `<div class="pb-frest">${rows.slice(3, 15).map((r, j) => `<span style="--pc:${esc(r.color || '#7b61ff')}"><i>${j + 4}</i>${esc(r.avatar || '')} ${esc(r.name)} <b>${r.pts}</b></span>`).join('')}${rows.length > 15 ? `<span class="more">+${rows.length - 15} more</span>` : ''}</div>` : ''}
      <footer class="pb-fbtns"><button class="pb-btn go" data-pb="recap">🎬 Night recap</button><button class="pb-btn ghost" data-pb="again">🔁 Party again</button><button class="pb-btn ghost" data-pb="menu">🏠 Main menu</button></footer>
    </div>`;
    bindButtons(el, s);
    const fin = el.querySelector('.pb-final');
    const conf = confetti(el.querySelector('.pb-confetti'));
    const at = (ms, fn) => setTimeout(() => { if (el.isConnected && el._pb === s) fn(); }, reduced ? 0 : ms);
    sfx('drum');
    at(1300, () => { fin.classList.add('s3'); sfx('pop'); });
    at(2200, () => { fin.classList.add('s2'); sfx('pop'); });
    at(2900, () => sfx('drum'));
    at(4100, () => { fin.classList.add('s1'); sfx('win'); sfx('cheer'); conf.burst(0.5, 0.55, 180, 1000); conf.burst(0.2, 0.9, 80, 900); conf.burst(0.8, 0.9, 80, 900); conf.rain(0.35); });
    at(5000, () => { fin.classList.add('s4'); const b = el.querySelector('[data-pb="again"]'); if (b) b.focus({ preventScroll: true }); });
    at(12000, () => conf.rain(0.12));
  }

  B.partyBoard = function (el, state, ctx) {
    const pm = state && state.partyMode; if (!el || !pm) return;
    looks = new Map((state.players || []).filter((p) => p && p.look).map((p) => [p.id, p.look]));
    const key = `${pm.phase}:${pm.index}:${(state.played || []).length}`;
    let s = el._pb;
    if (!s || s.key !== key) {
      s = el._pb = { key, ctx };
      if (pm.phase === 'done') buildFinale(el, state, s); else buildBoard(el, state, s);
    }
    s.ctx = ctx;
    if (pm.phase !== 'done') updateBoard(el, state, s);
  };
})();
