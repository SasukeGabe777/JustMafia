'use strict';
// JustFunny screens. TV: the YouTube video full size, with live funny and skip meters and
// floating reactions; the final vote uses each video's thumbnail. Phone: search (or paste a
// link) to pick your video, rate how funny it is, vote to skip, and vote for the funniest.
(function () {
  const { esc, timer } = BOX;
  // ---------- TV: one YouTube player that stays on the page ----------
  const yt = { player: null, ready: false, want: null, loaded: null, host: null, loading: false };
  function loadApi() {
    if (window.YT && window.YT.Player) return makePlayer();
    if (yt.loading) return; yt.loading = true;
    window.onYouTubeIframeAPIReady = makePlayer;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = () => { yt.failed = true; }; // offline: the TV shows the title and thumbnail instead
    document.head.appendChild(s);
  }
  function makePlayer() {
    const el = document.getElementById('fn-player'); if (!el || yt.player) return;
    yt.player = new window.YT.Player('fn-player', {
      width: '100%', height: '100%', playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady: () => { yt.ready = true; sync(); },
        onStateChange: (e) => { if (e.data === 0 && yt.loaded && yt.host) yt.host('video', { ev: 'ended', id: yt.loaded }); },
        onError: () => { if (yt.loaded && yt.host) yt.host('video', { ev: 'error', id: yt.loaded }); },
      },
    });
  }
  function sync() {
    if (!yt.ready || !yt.player) return;
    try {
      if (yt.want && yt.want !== yt.loaded) { yt.loaded = yt.want; yt.player.loadVideoById(yt.want); }
      else if (!yt.want && yt.loaded) { yt.loaded = null; yt.player.stopVideo(); }
    } catch (e) { /* player not ready */ }
  }
  function float(el, text) {
    const f = document.createElement('div'); f.className = 'fn-float'; f.textContent = text;
    f.style.left = 8 + Math.random() * 84 + '%'; el.appendChild(f); setTimeout(() => f.remove(), 2600);
  }
  const SRC_ICON = { youtube: '▶️', tiktok: '🎵', instagram: '📸' };
  const SRC_NAME = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };
  const pic = (v, cls = '') => (v && v.thumb ? `<img class="${cls}" src="${esc(v.thumb)}" alt="">` : `<div class="fn-noimg ${cls} src-${esc((v && v.src) || 'x')}"><span>${SRC_ICON[(v && v.src)] || '🎬'}</span>${SRC_NAME[(v && v.src)] || 'Video'}</div>`);
  // TikTok and Instagram play in their own embed (YouTube uses the YouTube player above).
  const alt = { key: null };
  function altPlayer(el, c) {
    const box = el.querySelector('#fn-alt'); if (!box) return;
    const key = c && c.src !== 'youtube' ? c.src + ':' + c.id : null;
    if (key === alt.key) return; alt.key = key;
    box.innerHTML = !key ? '' : c.src === 'tiktok'
      ? `<iframe src="https://www.tiktok.com/player/v1/${encodeURIComponent(c.id)}?autoplay=1&music_info=0&description=0&rel=0&controls=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`
      : `<iframe src="https://www.instagram.com/reel/${encodeURIComponent(c.id)}/embed/" allow="autoplay; encrypted-media" scrolling="no"></iframe>`;
    box.hidden = !key;
  }
  // TikTok's player tells the page when a video ends.
  window.addEventListener('message', (e) => { try { const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; if (d && d['x-tiktok-player'] && d.type === 'onStateChange' && d.value === 0 && alt.key && yt.host) yt.host('video', { ev: 'ended', id: alt.key.split(':')[1] }); } catch { /* not ours */ } });
  const meter = (pct, cls) => `<div class="fn-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
  const emojiFor = (avg) => ['😐', '😐', '🙂', '😄', '😂', '🤣'][Math.round(avg)] || '😐';

  // ---------- phone state ----------
  let q = '', results = null, paste = '', busy = false, msg = '', shortsOnly = false;

  BOX.games.funny = {
    name: 'JustFunny', icon: '😂',
    about: 'A watch party. Take turns putting funny YouTube videos on the big screen. Boring? Vote to skip!',
    how: [
      'Everyone gets a turn, in a random order. Find a YouTube video on your phone and it plays on the big screen.',
      'Line up your video before your turn: it plays the moment your turn comes.',
      'While it plays, rate how funny it is (😐 to 🤣) on your phone.',
      'Bored? Vote to skip. Enough skips and the next person’s video starts.',
      'At the end, everyone votes for the funniest video of the night.',
    ],
    fx: { start: 'start', boo: 'boo', cheer: 'cheer', chime: 'chime', gavel: 'gavel', win: 'win' },
    onFx(f) { if (f.kind === 'react') { const o = document.getElementById('fn-react'); if (o) float(o, f.e); } },

    tv(el, s, ctx) {
      if (!s) return;
      yt.host = ctx && ctx.host;
      if (!el.querySelector('#fn-stage')) {
        el.innerHTML = `<div class="fn-wrap"><div class="fn-stage" id="fn-stage"><div class="fn-video" id="fn-video"><div id="fn-player"></div><div class="fn-alt" id="fn-alt" hidden></div><div class="fn-cover" id="fn-cover"></div></div><div class="fn-react" id="fn-react"></div><div class="fn-top" id="fn-top"></div><div class="fn-bottom" id="fn-bottom"></div></div><div class="fn-board" id="fn-board"></div></div>`;
        loadApi();
      }
      const stage = el.querySelector('#fn-stage'), board = el.querySelector('#fn-board'), cover = el.querySelector('#fn-cover');
      const showBoard = s.phase === 'final' || s.phase === 'over';
      stage.hidden = showBoard; board.hidden = !showBoard;
      yt.want = s.phase === 'play' && s.cur && s.cur.src === 'youtube' ? s.cur.id : null; sync();
      altPlayer(el, s.phase === 'play' ? s.cur : null);
      el.querySelector('#fn-video').classList.toggle('vertical', !!(s.phase === 'play' && s.cur && s.cur.vertical));
      if (s.phase === 'play' && s.cur) {
        const c = s.cur;
        const offline = c.src === 'youtube' && yt.failed; cover.hidden = !offline; cover.innerHTML = offline ? `${pic(c)}<p>${esc(c.title)}</p>` : '';
        el.querySelector('#fn-top').innerHTML = `<div class="fn-pill">${SRC_ICON[c.src] || '🎬'} <b>${esc(c.by)}</b>’s pick · ${esc(c.title)}</div><div class="fn-pill small">Video ${s.n} of ${s.of}</div>`;
        el.querySelector('#fn-bottom').innerHTML = `<div class="fn-meter"><span class="big">${emojiFor(c.avg)}</span><div><b>Funny ${c.avg ? c.avg.toFixed(1) : '–'}</b> <span class="muted">(${c.votes} rating${c.votes === 1 ? '' : 's'})</span>${meter((c.avg / 5) * 100, 'funny')}</div></div>
          <div class="fn-meter"><span class="big">⏭</span><div><b>Skip ${c.skips}/${c.need}</b>${meter((c.skips / c.need) * 100, 'skip')}</div></div>
          <div class="fn-meter time"><span class="big">⏱</span><div>${timer(s.endsIn)}${meter((c.elapsed / c.max) * 100, 'time')}</div></div>`;
      } else if (!showBoard) {
        cover.hidden = false;
        el.querySelector('#fn-top').innerHTML = '';
        if (s.phase === 'pick') cover.innerHTML = `<div class="fn-wait"><div class="fn-big">📱</div><h2>${esc(s.picker || '')} is picking a video…</h2>${s.cantPlay ? `<p>That one couldn’t play on the TV. ${esc(s.cantPlay)} is picking another.</p>` : ''}<p class="muted">${timer(s.endsIn)} · video ${s.n} of ${s.of}</p>${s.upNext.length ? `<p class="fn-next">Up next: ${s.upNext.map((u) => `${esc(u.name)}${u.ready ? ' ✅' : ''}`).join(' · ')}</p>` : ''}</div>`;
        else if (s.phase === 'score' && s.last) { const l = s.last; cover.innerHTML = `<div class="fn-wait">${pic(l, 'fn-thumb')}<h2>${l.why === 'skipped' ? '⏭ Skipped!' : l.why === 'ended' ? '🎉 Watched to the end!' : '⏱ Time’s up!'}</h2><p class="fn-score">${emojiFor(l.avg)} ${l.avg ? l.avg.toFixed(1) : '–'} funny · ${esc(l.by)} +${l.pts} pts</p></div>`; }
        el.querySelector('#fn-bottom').innerHTML = '';
      }
      if (showBoard) {
        const over = s.phase === 'over', top = s.videos[0];
        board.innerHTML = `<div class="banner">${over ? '🏆 Funniest video of the night' : '🗳️ Vote for the funniest video on your phone! ' + timer(s.endsIn)}</div>
          ${over && top ? `<div class="fn-champ">${pic(top)}<div><h2>${esc(top.title)}</h2><p>picked by <b>${esc(top.by)}</b> · ${top.final} vote${top.final === 1 ? '' : 's'} · ${emojiFor(top.avg)} ${top.avg}</p></div></div>` : ''}
          <div class="fn-grid">${s.videos.slice(over ? 1 : 0).map((v, i) => `<div class="fn-card">${pic(v)}<span class="fn-num">${over ? '#' + (i + 2) : v.n}</span><b>${esc(v.title)}</b><small>${esc(v.by)} · ${emojiFor(v.avg)} ${v.avg || '–'}${over ? ` · ${v.final} vote${v.final === 1 ? '' : 's'}` : ''}</small></div>`).join('')}</div>
          ${over ? `<div class="panel" style="max-width:520px;margin:16px auto"><h3 style="margin-top:0">Points</h3>${BOX.board(s.standings, (r) => r.points, ' pts')}</div>` : `<p class="muted" style="text-align:center">${s.finalVoted} voted</p>`}`;
      }
    },

    phone(el, v, ctx) {
      if (!v) return;
      const head = `<div class="bl-me"><span>😂 ${v.points} pts · #${v.rank || '-'}</span><span class="muted">video ${Math.min(v.n, v.of)} of ${v.of}</span></div>`;
      if (v.phase === 'over') {
        el.innerHTML = `${head}<div class="card-box"><h3>🏆 Funniest videos</h3>${v.videos.slice(0, 5).map((x, i) => `<div class="fn-row">${pic(x)}<div><b>${i + 1}. ${esc(x.title)}</b><small>${esc(x.by)} · ${x.final} vote${x.final === 1 ? '' : 's'}</small></div></div>`).join('')}</div><div class="card-box">${BOX.board(v.final, (r) => r.points, ' pts')}</div>`; return;
      }
      if (v.phase === 'final') {
        el.innerHTML = `${head}<div class="bl-pickinfo">🗳️ Which video was the funniest? ${timer(v.endsIn)}</div><div class="fn-vote">${v.videos.map((x) => `<button class="fn-vcard ${v.myFinal === x.n ? 'sel' : ''}" data-n="${x.n}" ${x.mine ? 'disabled' : ''}>${pic(x)}<b>${esc(x.title)}</b><small>${x.mine ? 'your video' : esc(x.by)}</small></button>`).join('')}</div>`;
        for (const b of el.querySelectorAll('[data-n]')) b.onclick = () => { ctx.act({ op: 'final', n: Number(b.dataset.n) }); ctx.vibrate(20); };
        return;
      }
      if (v.phase === 'play' && v.cur) {
        const c = v.cur;
        if (c.mine) { el.innerHTML = `${head}<div class="card-box" style="text-align:center"><h3>🎬 Your video is on!</h3><p>${esc(c.title)}</p><p class="fn-score">${emojiFor(c.avg)} ${c.avg || '–'} funny · ⏭ ${c.skips}/${c.need} skips</p></div>${picker(v, true)}`; bindPicker(el, v, ctx); return; }
        el.innerHTML = `${head}<div class="fn-now">🎬 <b>${esc(c.by)}</b>: ${esc(c.title)}</div>
          <div class="bl-pickinfo">How funny is it?</div><div class="fn-rate">${v.rate.map((e, i) => `<button class="${c.myRating === i + 1 ? 'sel' : ''}" data-r="${i + 1}">${e}</button>`).join('')}</div>
          <button class="fn-skip ${c.mySkip ? 'on' : ''}" id="fn-skip">${c.mySkip ? '⏭ You voted to skip (tap to undo)' : '⏭ Boring! Skip it'}<small>${c.skips}/${c.need} to skip</small></button>${picker(v, true)}`;
        for (const b of el.querySelectorAll('[data-r]')) b.onclick = () => { ctx.act({ op: 'rate', v: Number(b.dataset.r) }); ctx.vibrate(15); };
        el.querySelector('#fn-skip').onclick = () => { ctx.act({ op: 'skip', on: !c.mySkip }); ctx.vibrate(25); };
        bindPicker(el, v, ctx); return;
      }
      if (v.phase === 'score' && v.last) {
        const l = v.last;
        el.innerHTML = `${head}<div class="card-box" style="text-align:center"><h3>${l.why === 'skipped' ? '⏭ Skipped' : '🎉 Done'}</h3><p>${esc(l.title)}</p><p class="fn-score">${emojiFor(l.avg)} ${l.avg || '–'} funny${l.mine ? ` · you got +${l.pts} pts` : ''}</p></div>${picker(v, true)}`;
        bindPicker(el, v, ctx); return;
      }
      // pick phase
      el.innerHTML = `${head}${v.myTurn ? `<div class="card-box fn-yourturn"><h3>📱 Your turn! Pick a video ${timer(v.endsIn)}</h3>${v.cantPlay ? '<p>That one couldn’t play on the TV. Pick another!</p>' : ''}</div>` : `<div class="fn-now">📱 ${esc(v.picker || '')} is picking… ${timer(v.endsIn)}</div>`}${picker(v, !v.myTurn)}`;
      bindPicker(el, v, ctx);
    },
  };

  // Search / paste box. When it isn't your turn it lines your video up for later.
  function picker(v, ahead) {
    if (v.turnsAway == null) return '';
    if (v.queued && ahead) return `<div class="card-box fn-queued">${pic(v.queued)}<div><b>✅ Ready for your turn${v.turnsAway ? ` (in ${v.turnsAway})` : ''}</b><small>${esc(v.queued.title)}</small><button class="link" id="fn-change">Change</button></div></div>`;
    return `<div class="card-box fn-picker"><h3>${ahead ? `🎬 Line up your video${v.turnsAway ? ` (your turn in ${v.turnsAway})` : ''}` : '🔎 Find a funny video'}</h3>
      ${v.search ? `<div class="fn-search"><input id="fn-q" class="dk-select" placeholder="Search YouTube…" value="${esc(q)}" maxlength="80"><button class="btn" id="fn-go">🔎</button></div><label class="fn-shorts"><input type="checkbox" id="fn-sh" ${shortsOnly ? 'checked' : ''}> ⚡ Shorts only</label><p class="muted small">TikTok or Instagram? Paste the link below.</p>
        ${results ? `<div class="fn-results">${results.length ? results.map((r) => `<button class="fn-row" data-id="${esc(r.id)}"><img src="${esc(r.thumb)}" alt=""><div><b>${esc(r.title)}</b><small>${esc(r.channel)}</small></div></button>`).join('') : '<p class="muted">No results.</p>'}</div>` : ''}`
      : `<div class="fn-search"><input id="fn-q" class="dk-select" placeholder="What’s funny? (e.g. cats falling)" value="${esc(q)}" maxlength="80"></div><div class="fn-plat"><button class="btn small" data-plat="youtube">▶️ YouTube</button><button class="btn small" data-plat="shorts">⚡ Shorts</button><button class="btn small" data-plat="tiktok">🎵 TikTok</button><button class="btn small" data-plat="instagram">📸 Reels</button></div>
        <p class="muted small">Find a video in the app, tap <b>Share → Copy link</b>, then paste it here:</p>`}
      <div class="fn-search"><input id="fn-paste" class="dk-select" placeholder="Paste a YouTube, Shorts, TikTok or Reel link" value="${esc(paste)}"><button class="btn green" id="fn-use" ${busy ? 'disabled' : ''}>${busy ? '…' : 'Use it'}</button></div>
      ${msg ? `<p class="err">${esc(msg)}</p>` : ''}</div>`;
  }
  function bindPicker(el, v, ctx) {
    const qi = el.querySelector('#fn-q'); if (qi) { qi.oninput = () => { q = qi.value; }; qi.onkeydown = (e) => { if (e.key === 'Enter') { const g = el.querySelector('#fn-go') || el.querySelector('[data-plat="youtube"]'); if (g) g.click(); } }; }
    const pi = el.querySelector('#fn-paste'); if (pi) pi.oninput = () => { paste = pi.value; };
    const go = el.querySelector('#fn-go'); if (go) go.onclick = async () => { q = el.querySelector('#fn-q').value; busy = true; msg = ''; ctx.redraw(); const r = await ctx.actAsync({ op: 'search', q, shorts: shortsOnly }); busy = false; if (r.ok) results = r.results; else msg = r.error || ''; ctx.redraw(); };
    const sh = el.querySelector('#fn-sh'); if (sh) sh.onchange = () => { shortsOnly = sh.checked; };
    const URLS = { youtube: 'https://www.youtube.com/results?search_query=', shorts: 'https://www.youtube.com/results?sp=EgIYAQ%253D%253D&search_query=', tiktok: 'https://www.tiktok.com/search?q=', instagram: 'https://www.instagram.com/explore/search/keyword/?q=' };
    for (const b of el.querySelectorAll('[data-plat]')) b.onclick = () => { q = el.querySelector('#fn-q').value; window.open(URLS[b.dataset.plat] + encodeURIComponent(q || 'funny'), '_blank'); };
    const pick = async (payload) => { busy = true; msg = ''; ctx.redraw(); const r = await ctx.actAsync({ op: 'pick', ...payload }); busy = false; if (r.ok) { paste = ''; results = null; q = ''; ctx.toast(r.queued ? '✅ Lined up for your turn!' : '🎬 On the big screen!'); ctx.sfx('chime'); } else msg = r.error || 'That didn’t work.'; ctx.redraw(); };
    const use = el.querySelector('#fn-use'); if (use) use.onclick = () => { paste = el.querySelector('#fn-paste').value; if (paste.trim()) pick({ url: paste.trim() }); };
    for (const b of el.querySelectorAll('.fn-results [data-id]')) b.onclick = () => pick({ id: b.dataset.id });
    const ch = el.querySelector('#fn-change'); if (ch) ch.onclick = () => { ctx.act({ op: 'unqueue' }); };
  }
})();
