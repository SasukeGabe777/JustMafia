'use strict';
// JustFunny screens. TV: the video full size with a live laugh meter, floating reactions, the
// queue of who's up next, a final vote on thumbnails and a best-of reel that replays each top
// video from its biggest laugh. Phone: find (search, or paste a link) and line up your video,
// rate it, throw reactions, vote to skip, and vote for the funniest at the end.
(function () {
  const { esc, timer } = BOX;
  const morph = (el, html) => { if (el) BOX.morph(el, html); };

  // ---------- TV: one YouTube player that stays on the page ----------
  // The player is rebuilt whenever the TV page redraws the game area (Play again, Back to
  // lobby): a player whose frame left the page is thrown away, never reused.
  // yt.want = what should be on screen now: { key, id, start, report } (report: tell the server
  // when it plays/ends/fails; the best-of reel doesn't).
  const yt = { player: null, stage: null, ready: false, want: null, loaded: null, host: null, loading: false, failed: false, vol: 80, muted: false };
  // Videos start by themselves with sound. Browsers allow that because the TV page was
  // opened by a click on the title screen. If a browser still refuses (e.g. the TV page
  // was refreshed), the video plays muted and a small corner note offers sound; nothing
  // ever waits for a click.
  const sound = { blocked: false };
  // The watchdog for whatever is loading: started? ended? stuck?
  let watch = { key: null };
  const freshWatch = (key) => ({ key, since: Date.now(), started: false, ended: false, failed: false, nudged: false, muteTry: false });
  function loadApi() {
    if (window.YT && window.YT.Player) return makePlayer();
    if (yt.loading) return; yt.loading = true;
    window.onYouTubeIframeAPIReady = makePlayer;
    const s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    s.onerror = () => { yt.failed = true; yt.loading = false; }; // offline: the TV says so and moves on
    document.head.appendChild(s);
  }
  function stale() { return yt.player && (!yt.stage || !yt.stage.isConnected); }
  function dropPlayer() { try { yt.player.destroy(); } catch { /* already gone */ } yt.player = null; yt.stage = null; yt.ready = false; yt.loaded = null; if (watch.key) watch = freshWatch(watch.key); }
  const vidOf = () => { try { const d = yt.player.getVideoData && yt.player.getVideoData(); return d && d.video_id; } catch { return null; } };
  const mine = () => yt.want && yt.loaded === yt.want.key && watch.key === yt.want.key && (!vidOf() || vidOf() === yt.want.id);
  function makePlayer() {
    if (stale()) dropPlayer();
    const el = document.getElementById('fn-player'); if (!el || yt.player || !(window.YT && window.YT.Player)) return;
    try {
      yt.stage = document.getElementById('fn-stage');
      yt.player = new window.YT.Player('fn-player', {
        width: '100%', height: '100%', playerVars: { autoplay: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3, fs: 0, disablekb: 1 },
        events: {
          onReady: () => { yt.ready = true; applyVolume(); sync(); },
          onStateChange: (e) => {
            if (!mine()) return;
            if (e.data === 1 && !watch.started) { watch.started = true; let dur = 0; try { dur = yt.player.getDuration(); } catch { /* */ } report('playing', { dur }); }
            if (e.data === 0 && watch.started && !watch.ended) { watch.ended = true; report('ended'); }
          },
          onError: (e) => { if (mine()) fail(e && e.data); },
          onAutoplayBlocked: () => mutedFallback(),
        },
      });
    } catch { yt.player = null; yt.stage = null; }
  }
  function report(ev, extra = {}) { const w = yt.want; if (w && w.report && yt.host) yt.host('video', { ev, id: w.id, ...extra }); }
  function fail(code) { if (watch.failed) return; watch.failed = true; report('error', { code: code == null ? '' : code }); }
  function mutedFallback() {
    sound.blocked = true;
    try { yt.player.mute(); yt.player.playVideo(); } catch { /* */ }
    soundHint();
  }
  function applyVolume() {
    if (!yt.ready || !yt.player) return;
    try {
      yt.player.setVolume(yt.vol);
      if (yt.muted || yt.vol === 0 || sound.blocked) yt.player.mute(); else yt.player.unMute();
    } catch { /* */ }
  }
  function sync() {
    if (stale()) { dropPlayer(); makePlayer(); return; }
    if (!yt.ready || !yt.player) return;
    try {
      const w = yt.want;
      if (w && w.key !== yt.loaded) { yt.loaded = w.key; applyVolume(); yt.player.loadVideoById({ videoId: w.id, startSeconds: w.start || 0 }); }
      else if (!w && yt.loaded) { yt.loaded = null; yt.player.stopVideo(); }
    } catch (e) { /* player not ready */ }
  }
  function want(w) {
    yt.want = w;
    const key = w ? w.key : null;
    if (watch.key !== key) watch = freshWatch(key);
    sync();
  }
  // Twice a second: nudge a video that won't start, play muted if sound is what's blocking it,
  // give up on one that never starts, and catch an ending the player didn't announce.
  setInterval(() => {
    const w = yt.want;
    if (w && watch.key === w.key && !watch.failed) {
      const age = Date.now() - watch.since;
      let st = null; try { st = yt.ready && yt.loaded === w.key ? yt.player.getPlayerState() : null; } catch { /* */ }
      if (!watch.started) {
        if (yt.failed && age > 2500) fail('offline');
        else if (st === 1 && mine()) { watch.started = true; let dur = 0; try { dur = yt.player.getDuration(); } catch { /* */ } report('playing', { dur }); }
        else {
          if (age > 2500 && !watch.nudged && (st === -1 || st === 5)) { watch.nudged = true; try { yt.player.playVideo(); } catch { /* */ } }
          if (age > 5000 && !watch.muteTry && (st === -1 || st === 5)) { watch.muteTry = true; mutedFallback(); }
          if ((age > 20000 && st !== 3) || age > 35000) fail('stall');
        }
      } else if (!watch.ended && st === 0 && mine()) { watch.ended = true; report('ended'); }
    }
    tiktokWatch();
    laughTick();
  }, 500);
  function soundHint() { const h = document.getElementById('fn-sound'); if (h) h.hidden = !sound.blocked; }
  // Any click or key press on the TV page lifts the browser's block for good.
  function unlock() {
    if (!sound.blocked) return; sound.blocked = false; soundHint();
    applyVolume();
    try { if (yt.player && yt.loaded) yt.player.playVideo(); } catch { /* */ }
    tiktok('unMute');
  }
  // For tests and troubleshooting: what the TV player is doing right now.
  window.__fnState = () => { const p = yt.player; let state = null, muted = null; try { state = p && p.getPlayerState ? p.getPlayerState() : null; muted = p && p.isMuted ? p.isMuted() : null; } catch { /* */ } return { ready: yt.ready, state, muted, blocked: sound.blocked, loaded: yt.loaded, started: !!watch.started, failed: !!watch.failed, heat: Math.round(laugh.level) }; };
  document.addEventListener('pointerdown', unlock, true);
  document.addEventListener('keydown', unlock, true);

  // ---------- TikTok and Instagram embeds ----------
  // TikTok's player takes simple commands by message and tells us when it plays and ends.
  function tiktok(type, value) { const f = document.querySelector('#fn-alt iframe[data-tt]'); if (f && f.contentWindow) try { f.contentWindow.postMessage({ 'x-tiktok-player': true, type, value }, '*'); } catch { /* */ } }
  const SRC_ICON = { youtube: '▶️', tiktok: '🎵', instagram: '📸' };
  const SRC_NAME = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };
  const pic = (v, cls = '') => (v && v.thumb ? `<img class="${cls}" src="${esc(v.thumb)}" alt="">` : `<div class="fn-noimg ${cls} src-${esc((v && v.src) || 'x')}"><span>${SRC_ICON[(v && v.src)] || '🎬'}</span>${SRC_NAME[(v && v.src)] || 'Video'}</div>`);
  const alt = { key: null, box: null, report: false, since: 0, heard: false, started: false, ended: false, failed: false, dur: 0, id: null };
  function altPlayer(el, c, key, report) {
    const box = el.querySelector('#fn-alt'); if (!box) return;
    key = c && c.src !== 'youtube' ? key : null;
    if (key === alt.key && box === alt.box) return;
    Object.assign(alt, { key, box, report: !!report, since: Date.now(), heard: false, started: false, ended: false, failed: false, dur: 0, id: c ? c.id : null, src: c ? c.src : null });
    box.innerHTML = !key ? '' : c.src === 'tiktok'
      ? `<iframe data-tt src="https://www.tiktok.com/player/v1/${encodeURIComponent(c.id)}?autoplay=1&music_info=0&description=0&rel=0&controls=1&progress_bar=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`
      // Instagram's player is a whole post (name, likes, caption). Crop it to just the video.
      : `<div class="fn-ig"><div class="fn-ig-crop"><iframe src="https://www.instagram.com/reel/${encodeURIComponent(c.id)}/embed/" allow="autoplay; encrypted-media" scrolling="no"></iframe></div></div>
         <div class="fn-ig-hint"><span>👆</span><b>Click the video to play</b><small>Instagram needs one click on the TV. When it’s done, the host taps <b>It’s over</b>.</small></div>`;
    box.hidden = !key;
    const tt = box.querySelector('iframe[data-tt]');
    if (tt) tt.onload = () => { setTimeout(() => { tiktok('play'); tiktok(sound.blocked || yt.muted ? 'mute' : 'unMute'); }, 600); };
    fitIg(box);
  }
  function altReport(ev, extra = {}) { if (alt.report && alt.id && yt.host) yt.host('video', { ev, id: alt.id, ...extra }); }
  // A TikTok that never says a word (blocked network, removed video) is given up on.
  function tiktokWatch() {
    if (alt.src !== 'tiktok' || !alt.key || alt.failed || alt.started) return;
    if (!alt.heard && Date.now() - alt.since > 25000) { alt.failed = true; altReport('error', { code: 'stall' }); }
  }
  window.addEventListener('message', (e) => {
    let d; try { d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
    if (!d || !d['x-tiktok-player'] || alt.src !== 'tiktok' || !alt.key) return;
    alt.heard = true;
    if (d.type === 'onCurrentTime' && d.value && d.value.duration > 0) alt.dur = Number(d.value.duration) || 0;
    if (d.type === 'onStateChange' && d.value === 1 && !alt.started) { alt.started = true; altReport('playing', alt.dur ? { dur: alt.dur } : {}); }
    if (d.type === 'onStateChange' && d.value === 0 && !alt.ended) { alt.ended = true; altReport('ended'); }
    if (d.type === 'onError' && !alt.failed) { alt.failed = true; altReport('error', { code: 'tiktok' }); }
  });
  // Scale the cropped Instagram video to fill the stage height.
  function fitIg(box) {
    const crop = box.querySelector('.fn-ig-crop'); if (!crop) return;
    const H = box.clientHeight || 600, sc = H / 666;
    crop.style.transform = `scale(${sc})`; crop.parentElement.style.width = `${525 * sc}px`; crop.parentElement.style.height = `${H}px`;
  }
  window.addEventListener('resize', () => { const b = document.getElementById('fn-alt'); if (b) fitIg(b); });
  // A click into the video moves focus into its frame: hide the "click to play" prompt.
  window.addEventListener('blur', () => { setTimeout(() => { const a2 = document.activeElement; if (a2 && a2.tagName === 'IFRAME') { const h = document.querySelector('.fn-ig-hint'); if (h) h.hidden = true; } }, 0); });

  // ---------- the laugh meter ----------
  // The server sends how hard the room is laughing; every reaction bumps it; it cools off by itself.
  const laugh = { level: 0, target: 0, at: 0, hotAt: 0 };
  const LEVELS = [[90, '💀', 'DEAD'], [75, '🤣', 'HOWLING'], [55, '😂', 'LOL'], [35, '😄', 'Giggles'], [15, '🙂', 'Chuckles'], [0, '😐', 'Tough crowd']];
  const levelOf = (x) => LEVELS.find((l) => x >= l[0]);
  function laughTick() {
    const m = document.getElementById('fn-laugh'); if (!m) return;
    const cooled = Math.max(0, laugh.target - ((Date.now() - laugh.at) / 1000) * 9);
    laugh.level = Math.max(cooled, laugh.level * 0.93);
    const L = levelOf(laugh.level);
    m.style.setProperty('--lv', laugh.level.toFixed(1));
    const face = m.querySelector('.fn-lm-face'), word = m.querySelector('.fn-lm-word');
    if (face && face.textContent !== L[1]) face.textContent = L[1];
    if (word && word.textContent !== L[2]) word.textContent = L[2];
    const hot = laugh.level >= 75, st = document.getElementById('fn-stage');
    if (st) st.classList.toggle('hot', hot);
    const co = document.getElementById('fn-couch'); if (co) { co.classList.toggle('lol', laugh.level >= 45); co.classList.toggle('howl', hot); }
    if (hot && Date.now() - laugh.hotAt > 12000) { laugh.hotAt = Date.now(); BOX.sfx('laugh'); }
  }
  function float(el, text) {
    const f = document.createElement('div'); f.className = 'fn-float'; f.textContent = text;
    f.style.left = 6 + Math.random() * 84 + '%'; f.style.setProperty('--dx', (Math.random() * 80 - 40).toFixed(0) + 'px');
    el.appendChild(f); setTimeout(() => f.remove(), 2600);
  }
  const meter = (pct, cls) => `<div class="fn-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></i></div>`;
  const emojiFor = (avg) => ['😐', '😐', '🙂', '😄', '😂', '🤣'][Math.round(avg)] || '😐';
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const WHY = { skipped: '⏭ Skipped!', ended: '🎉 Watched to the end!', time: '⏱ Time’s up!' };
  const medal = (r) => ['🥇', '🥈', '🥉'][r - 1] || '#' + r;
  const queueHtml = (q, title = 'Up next') => (q && q.list.length ? `<div class="fn-queue"><h4>${title}</h4>${q.list.map((u) => `<div class="fn-q ${u.ready ? 'ready' : ''} ${u.now ? 'now' : ''}"><span>${u.now ? '📱' : u.ready ? '✅' : '⏳'}</span><b>${esc(u.name)}</b><small>${u.now ? 'picking' : u.ready ? 'ready' : 'still looking'}</small></div>`).join('')}${q.more ? `<div class="fn-q more">+${q.more} more</div>` : ''}</div>` : '');

  // ---------- phone state ----------
  let q = '', results = null, paste = '', busy = false, msg = '', shortsOnly = false;
  const IDEAS = ['dogs being dramatic', 'cats vs cucumbers', 'unexpected endings', 'animals that sound like people', 'try not to laugh', 'sports bloopers', 'goats yelling', 'talking parrots', 'babies laughing', 'news bloopers', 'fails compilation', 'dad jokes'];

  function tvRender(el, s, ctx) {
    if (!s) return;
    yt.host = ctx && ctx.host;
    if (!el.querySelector('#fn-stage')) {
      el.innerHTML = `<div class="fn-wrap fn2"><div class="fn-tvset" id="fn-tvset"><i class="fn-ant" aria-hidden="true"></i><div class="fn-stage" id="fn-stage"><div class="fn-video" id="fn-video"><div id="fn-player"></div><div class="fn-alt" id="fn-alt" hidden></div><div class="fn-cover" id="fn-cover"></div></div><div class="fn-sound" id="fn-sound" hidden>🔇 This browser blocked sound: click the TV once</div><div class="fn-react" id="fn-react"></div><div class="fn-top" id="fn-top"></div><div class="fn-bottom" id="fn-bottom"></div></div><div class="fn-brand" aria-hidden="true"><b>JustFunny</b><i></i><i></i></div></div>
        <aside class="fn-side" id="fn-side"><div class="fn-lm" id="fn-laugh"><div class="fn-lm-face">😐</div><div class="fn-lm-tube"><i></i></div><div class="fn-lm-word">Tough crowd</div><small>LAUGH METER</small></div><div id="fn-sideq"></div></aside>
        <div class="fn-board" id="fn-board"></div><div class="fn-couch" id="fn-couch"></div></div>`;
      loadApi();
    }
    const stage = el.querySelector('#fn-stage'), board = el.querySelector('#fn-board'), cover = el.querySelector('#fn-cover'), side = el.querySelector('#fn-side');
    const top = el.querySelector('#fn-top'), bottom = el.querySelector('#fn-bottom');
    const showBoard = s.phase === 'final' || s.phase === 'over';
    stage.hidden = showBoard; el.querySelector('#fn-tvset').hidden = showBoard; board.hidden = !showBoard; side.hidden = showBoard || s.phase === 'reel';
    el.querySelector('.fn-wrap').classList.toggle('full', showBoard || s.phase === 'reel');
    if (s.vol != null && (s.vol !== yt.vol || !!s.muted !== yt.muted)) { yt.vol = s.vol; yt.muted = !!s.muted; applyVolume(); tiktok(yt.muted ? 'mute' : 'unMute'); }
    soundHint();
    couch(el.querySelector('#fn-couch'), ctx && ctx.players, s, showBoard);

    // What should be playing right now.
    const c = s.phase === 'play' ? s.cur : null, clip = s.phase === 'reel' && s.reel ? s.reel.clip : null;
    if (c && c.src === 'youtube') want({ key: `play:${s.n}:${c.id}`, id: c.id, start: c.start || 0, report: true });
    else if (clip && clip.src === 'youtube') want({ key: `reel:${s.reel.at}:${clip.id}`, id: clip.id, start: clip.from || 0, report: false });
    else want(null);
    if (c) altPlayer(el, c, `play:${s.n}:${c.src}:${c.id}`, true);
    else if (clip) altPlayer(el, clip.src === 'tiktok' ? clip : null, `reel:${s.reel.at}:${clip.id}`, false);
    else altPlayer(el, null, null, false);
    el.querySelector('#fn-video').classList.toggle('vertical', !!((c && c.vertical) || (clip && clip.vertical)));
    if (c) { laugh.target = c.heat || 0; laugh.at = Date.now(); } else if (s.phase !== 'play') { laugh.target = 0; }
    morph(el.querySelector('#fn-sideq'), s.phase === 'reel' ? '' : queueHtml(s.queue, s.phase === 'pick' ? 'The queue' : 'Up next'));

    if (c) {
      const offline = c.src === 'youtube' && (yt.failed || watch.failed);
      const loading = c.src === 'youtube' && !watch.started && !offline && !c.playing;
      cover.hidden = !(offline || loading);
      morph(cover, offline ? `<div class="fn-wait">${pic(c, 'fn-thumb')}<h2>Can’t play this one on the TV</h2><p class="muted">Moving on…</p></div>`
        : loading ? `<div class="fn-wait fn-intro"><div class="fn-chan">NOW SHOWING</div>${pic(c, 'fn-thumb')}<div class="fn-intro-by">🎬 <b>${esc(c.by)}</b>’s pick</div><h2>${esc(c.title)}</h2><p class="muted">Loading…</p></div>` : '');
      morph(top, `<div class="fn-pill">${SRC_ICON[c.src] || '🎬'} <b>${esc(c.by)}</b>’s pick · ${esc(c.title)}</div><div class="fn-pill small">Video ${s.n} of ${s.of}</div>`);
      morph(bottom, `<div class="fn-meter"><span class="big">${emojiFor(c.avg)}</span><div><b>Funny ${c.avg ? c.avg.toFixed(1) : '–'}</b> <span class="muted">(${plural(c.votes, 'rating')})</span>${meter((c.avg / 5) * 100, 'funny')}</div></div>
          <div class="fn-meter"><span class="big">⏭</span><div><b>Skip ${c.skips}/${c.need}</b>${meter((c.skips / c.need) * 100, 'skip')}</div></div>
          <div class="fn-meter time"><span class="big">⏱</span><div>${timer(s.endsIn)}${meter((c.elapsed / c.max) * 100, 'time')}</div></div>`);
      return;
    }
    if (s.phase === 'reel' && s.reel) {
      const r = s.reel, k = r.clip;
      if (!k) {
        cover.hidden = false; morph(top, ''); morph(bottom, '');
        morph(cover, `<div class="fn-wait fn-reel-intro"><div class="fn-big">🎞️</div><h2>The best of tonight</h2><p>Counting down the top ${r.of}… from the moment you laughed hardest.</p></div>`);
        return;
      }
      const card = k.src === 'instagram' || (k.src === 'youtube' && (yt.failed || watch.failed));
      cover.hidden = !card;
      morph(cover, card ? `<div class="fn-wait">${pic(k, 'fn-thumb')}<h2>${esc(k.title)}</h2></div>` : '');
      morph(top, `<div class="fn-pill">🎞️ Best of tonight</div><div class="fn-pill small">${r.at + 1} / ${r.of}</div>`);
      morph(bottom, `<div class="fn-reelcap ${k.rank === 1 ? 'win' : ''}"><span class="fn-rank">${medal(k.rank)}</span><div><b>${esc(k.title)}</b><small>picked by ${esc(k.by)} · ${plural(k.final || 0, 'vote')} · ${emojiFor(k.avg)} ${k.avg || '–'}${k.peakN > 1 ? ' · from the biggest laugh' : ''}</small></div></div>${k.rank === 1 ? confetti() : ''}`);
      return;
    }
    if (!showBoard) {
      cover.hidden = false; morph(top, ''); morph(bottom, '');
      if (s.phase === 'pick') {
        morph(cover, `<div class="fn-wait fn-picking"><div class="fn-chan">CH ${s.n}</div><div class="fn-big">📱</div><h2><b>${esc(s.picker || '')}</b> is picking a video…</h2>${s.cantPlay ? `<p class="fn-cant">That last one couldn’t play: ${esc(s.cantPlay.why)}. ${esc(s.cantPlay.name)} is picking another.</p>` : ''}<p class="muted">${timer(s.endsIn)} · video ${s.n} of ${s.of}</p><p class="fn-tip">Everyone else: line up your video now and it plays the moment your turn comes.</p></div>`);
      } else if (s.phase === 'score' && s.last) {
        const l = s.last, nx = s.queue && s.queue.list[0];
        morph(cover, `<div class="fn-wait fn-result"><div class="fn-chan">CH ${l.n}</div>${pic(l, 'fn-thumb')}<h2>${WHY[l.why] || '🎉 Done!'}</h2><p class="fn-score">${emojiFor(l.avg)} ${l.avg ? l.avg.toFixed(1) : '–'} funny · ${plural(l.reacts || 0, 'reaction')} · ${esc(l.by)} +${l.pts} pts</p>${nx ? `<p class="fn-next">Up next: <b>${esc(nx.name)}</b> ${nx.ready ? '✅ ready' : '📱 picking'}</p>` : '<p class="fn-next">Last one! Final vote coming up…</p>'}</div>`);
      }
      return;
    }
    // The final vote and the end of the night.
    const over = s.phase === 'over';
    if (!over) {
      morph(board, `<div class="banner">🗳️ Vote for the funniest video on your phone! ${timer(s.endsIn)}</div>
        <div class="fn-grid">${s.videos.map((v) => `<div class="fn-card">${pic(v)}<span class="fn-num">${v.n}</span><b>${esc(v.title)}</b><small>${esc(v.by)} · ${emojiFor(v.avg)} ${v.avg || '–'} · ${plural(v.reacts || 0, 'reaction')}</small></div>`).join('')}</div>
        <div class="fn-voted"><b>${s.finalVoted}</b> of ${s.voters} voted${s.waiting.length ? ` · waiting for ${s.waiting.map((n) => `<span class="fn-chip">${esc(n)}</span>`).join(' ')}` : ''}</div>`);
      return;
    }
    const champ = s.videos[0];
    morph(board, `<div class="banner">🏆 Funniest video of the night</div>
      ${champ ? `<div class="fn-champ">${pic(champ)}<div><h2>${esc(champ.title)}</h2><p>picked by <b>${esc(champ.by)}</b> · ${plural(champ.final || 0, 'vote')} · ${emojiFor(champ.avg)} ${champ.avg || '–'}</p></div></div>` : '<p class="muted" style="text-align:center">No videos played tonight.</p>'}
      ${s.awards.length ? `<div class="fn-awards">${s.awards.map((a, i) => `<div class="fn-award" style="--i:${i}"><span>${a.icon}</span><div><small>${esc(a.title)}</small><b>${esc(a.name)}</b><em>${esc(a.detail)}</em></div></div>`).join('')}</div>` : ''}
      <div class="fn-endgrid"><div class="fn-grid">${s.videos.slice(1).map((v, i) => `<div class="fn-card" style="--i:${i}">${pic(v)}<span class="fn-num">${medal(i + 2)}</span><b>${esc(v.title)}</b><small>${esc(v.by)} · ${plural(v.final || 0, 'vote')} · ${emojiFor(v.avg)} ${v.avg || '–'}</small></div>`).join('')}</div>
      <div class="panel"><h3 style="margin-top:0">Points</h3>${BOX.board(s.standings, (r) => r.points, ' pts')}</div></div>`);
  }
  const confetti = () => `<div class="fn-confetti" aria-hidden="true">${Array.from({ length: 30 }, (_, i) => `<i style="--x:${(i * 37) % 100};--d:${((i % 7) * 0.17).toFixed(2)}s;--c:${['#ffd23f', '#ff4f9a', '#3ee6ff', '#8bd346', '#ff8c42'][i % 5]}"></i>`).join('')}</div>`;

  // ---------- phone ----------
  function phoneRender(el, v, ctx, room) {
    // JustGold gear: this game's phone theme, a frame and badge over your screen (public/shared/gear.js).
    if (window.MT_GEAR) window.MT_GEAR.phoneTheme(el, room, 'funny');
    if (!v) return;
    const isHost = !!(room && room.vip);
    phoneHaptics(v, ctx);
    const head = `<div class="bl-me fn-me"><span>😂 ${v.points} pts · #${v.rank || '-'}</span><span class="muted">${v.phase === 'final' || v.phase === 'reel' || v.phase === 'over' ? plural(v.played, 'video') + ' tonight' : `video ${Math.min(v.n, v.of)} of ${v.of}`}</span></div>`;
    let html = '';
    if (v.phase === 'over') {
      html = `${head}${v.awards.length ? `<div class="card-box fn-myaward">${v.awards.map((a) => `<div class="fn-award mine"><span>${a.icon}</span><div><b>${esc(a.title)}</b><small>${esc(a.detail)}</small></div></div>`).join('')}</div>` : ''}
        <div class="card-box"><h3>🏆 Funniest videos</h3>${v.videos.slice(0, 5).map((x, i) => `<div class="fn-row">${pic(x)}<div><b>${medal(i + 1)} ${esc(x.title)}</b><small>${x.mine ? 'your pick' : esc(x.by)} · ${plural(x.final || 0, 'vote')}</small></div></div>`).join('') || '<p class="muted">No videos tonight.</p>'}</div>
        <div class="card-box">${BOX.board(v.final, (r) => r.points, ' pts')}</div>`;
    } else if (v.phase === 'reel') {
      const k = v.reel && v.reel.clip;
      html = `${head}<div class="card-box fn-center"><div class="fn-bigicon">🎞️</div><h3>Best-of reel on the TV!</h3>${k ? `<p>${medal(k.rank)} <b>${esc(k.title)}</b><br><small class="muted">picked by ${esc(k.by)}</small></p>` : '<p>Counting down the funniest videos of the night…</p>'}${isHost ? '<button class="btn ghost small" data-fn="skipReel">Skip to the results ⏩</button>' : ''}</div>`;
    } else if (v.phase === 'final') {
      const can = v.videos.some((x) => !x.mine);
      html = `${head}<div class="bl-pickinfo">🗳️ Which video was the funniest? ${timer(v.endsIn)}</div>
        ${can ? '' : '<p class="muted fn-center">Every video was yours, so sit back for this one!</p>'}
        <div class="fn-vote">${v.videos.map((x) => `<button class="fn-vcard ${v.myFinal === x.n ? 'sel' : ''}" data-n="${x.n}" ${x.mine ? 'disabled' : ''}>${pic(x)}<b>${esc(x.title)}</b><small>${x.mine ? 'your video' : esc(x.by)} · ${emojiFor(x.avg)} ${x.avg || '–'}</small>${v.myFinal === x.n ? '<i class="fn-tick">✅</i>' : ''}</button>`).join('')}</div>
        <p class="muted fn-center">${v.myFinal ? 'Vote in! Tap another to change it. ' : ''}${v.finalVoted} of ${v.voters} voted</p>`;
    } else if (v.phase === 'play' && v.cur) {
      const c = v.cur;
      const controls = c.mine || isHost ? `<div class="fn-host"><button class="btn green small" data-fn="done">✅ It’s over: next video</button>${volRow(v)}</div>` : '';
      if (c.mine) {
        html = `${head}<div class="card-box fn-center fn-mine"><h3>🎬 Your video is on!</h3><p>${esc(c.title)}</p>
          <div class="fn-live"><div><span>${emojiFor(c.avg)}</span><b>${c.avg ? c.avg.toFixed(1) : '–'}</b><small>funny</small></div><div><span>🔥</span><b>${c.reacts || 0}</b><small>reactions</small></div><div><span>⏭</span><b>${c.skips}/${c.need}</b><small>skips</small></div></div>${controls}</div>${picker(v, true)}`;
      } else {
        html = `${head}<div class="fn-now">🎬 <b>${esc(c.by)}</b>: ${esc(c.title)}</div>
          <div class="bl-pickinfo">How funny is it?</div><div class="fn-rate">${v.rate.map((e, i) => `<button class="${c.myRating === i + 1 ? 'sel' : ''}" data-r="${i + 1}">${e}</button>`).join('')}</div>
          <div class="fn-reacts">${v.reacts.map((e, i) => `<button data-x="${i}" aria-label="React ${e}">${e}</button>`).join('')}</div>
          <button class="fn-skip ${c.mySkip ? 'on' : ''}" id="fn-skip">${c.mySkip ? '⏭ You voted to skip (tap to undo)' : '⏭ Boring! Skip it'}<small>${c.skips}/${c.need} to skip</small></button>${isHost ? `<div class="card-box fn-hostbox"><small class="muted">👑 Host controls</small>${controls}</div>` : ''}${picker(v, true)}`;
      }
    } else if (v.phase === 'score' && v.last) {
      const l = v.last;
      html = `${head}<div class="card-box fn-center"><h3>${WHY[l.why] || '🎉 Done'}</h3><p>${esc(l.title)}</p><p class="fn-score">${emojiFor(l.avg)} ${l.avg || '–'} funny${l.mine ? ` · you got +${l.pts} pts` : ''}</p></div>${picker(v, true)}`;
    } else {
      // pick phase
      const top = v.myTurn
        ? `<div class="card-box fn-yourturn"><h3>📱 Your turn! Pick a video ${timer(v.endsIn)}</h3>${v.cantPlay ? `<p>That one couldn’t play on the TV (${esc(v.cantPlay)}). Pick another!</p>` : '<p class="muted">It plays on the TV the moment you choose.</p>'}</div>`
        : `<div class="fn-now">📱 ${esc(v.picker || '')} is picking… ${timer(v.endsIn)}</div>${v.jumped ? '<p class="fn-note">⏩ Someone else’s video was ready, so it’s playing first. <b>You’re next!</b></p>' : ''}`;
      html = `${head}${top}${picker(v, !v.myTurn)}`;
    }
    morph(el, `<div class="fn-root">${html}</div>`);
    bind(el, v, ctx);
  }
  const volRow = (v) => `<div class="fn-vol"><span>TV volume</span><button class="btn small" data-vol="-1">🔉</button><b>${v.muted ? '🔇' : v.vol + '%'}</b><button class="btn small" data-vol="1">🔊</button><button class="btn small ghost" data-mute>${v.muted ? 'Unmute' : 'Mute'}</button></div>`;

  // Search / paste box. When it isn't your turn it lines your video up for later.
  function picker(v, ahead) {
    if (v.turnsAway == null) return '';
    const when = v.turnsAway === 1 ? 'you’re next' : v.turnsAway ? `your turn in ${v.turnsAway}` : '';
    if (v.queued && ahead) return `<div class="card-box fn-queued">${pic(v.queued)}<div><b>✅ Ready for your turn${when ? ` (${when})` : ''}</b><small>${esc(v.queued.title)}</small><button class="link" id="fn-change">Change</button></div></div>`;
    const ideas = `<div class="fn-ideas"><small class="muted">Need ideas?</small>${ideaSet().map((x) => `<button class="fn-idea" data-idea="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
    return `<div class="card-box fn-picker"><h3>${ahead ? `🎬 Line up your video${when ? ` (${when})` : ''}` : '🔎 Find a funny video'}</h3>
      ${v.search ? `<div class="fn-search"><input id="fn-q" class="dk-select" placeholder="Search YouTube…" value="${esc(q)}" maxlength="80" enterkeyhint="search"><button class="btn" id="fn-go" ${busy ? 'disabled' : ''}>🔎</button></div><label class="fn-shorts"><input type="checkbox" id="fn-sh" ${shortsOnly ? 'checked' : ''}> ⚡ Shorts only</label>
        ${results ? `<div class="fn-results">${results.length ? results.map((r) => `<button class="fn-row ${r.played ? 'played' : ''}" data-id="${esc(r.id)}" ${r.played || busy ? 'disabled' : ''}><img src="${esc(r.thumb)}" alt=""><div><b>${esc(r.title)}</b><small>${r.played ? 'already played tonight' : esc(r.channel)}</small></div></button>`).join('') : '<p class="muted">No results. Try other words.</p>'}</div>` : ideas}
        <p class="muted small">TikTok or Instagram? Copy the link in the app and paste it below.</p>`
      : `<div class="fn-search"><input id="fn-q" class="dk-select" placeholder="What’s funny? (e.g. cats falling)" value="${esc(q)}" maxlength="80"></div><div class="fn-plat"><button class="btn small" data-plat="youtube">▶️ YouTube</button><button class="btn small" data-plat="shorts">⚡ Shorts</button><button class="btn small" data-plat="tiktok">🎵 TikTok</button><button class="btn small" data-plat="instagram">📸 Reels</button></div>
        ${ideas}<ol class="fn-steps"><li>Find a video in the app</li><li>Tap <b>Share → Copy link</b></li><li>Come back and paste it here</li></ol>`}
      <div class="fn-search"><input id="fn-paste" class="dk-select" placeholder="Paste a YouTube, Shorts, TikTok or Reel link" value="${esc(paste)}" autocomplete="off"><button class="btn green" id="fn-use" ${busy ? 'disabled' : ''}>${busy ? 'Checking…' : 'Use it'}</button></div>
      ${canClip() ? '<button class="link" id="fn-clip">📋 Paste from clipboard</button>' : ''}
      ${msg ? `<p class="err fn-err">⚠️ ${esc(msg)}</p>` : ''}</div>`;
  }
  const canClip = () => !!(window.isSecureContext && navigator.clipboard && navigator.clipboard.readText);
  const looksLikeLink = (s) => /https?:\/\/|youtu\.?be|tiktok\.com|instagram\.com/i.test(s || '');
  const URLS = { youtube: 'https://www.youtube.com/results?search_query=', shorts: 'https://www.youtube.com/results?sp=EgIYAQ%253D%253D&search_query=', tiktok: 'https://www.tiktok.com/search?q=', instagram: 'https://www.instagram.com/explore/search/keyword/?q=' };

  // Six ideas at a time, a fresh set every few minutes.
  const ideaSet = () => { const k = Math.floor(Date.now() / 180000) % IDEAS.length; return [...IDEAS.slice(k), ...IDEAS.slice(0, k)].slice(0, 6); };
  function bind(el, v, ctx) {
    const $ = (s) => el.querySelector(s);
    const on = (sel, fn) => { for (const b of el.querySelectorAll(sel)) b.onclick = () => fn(b); };
    // Watching
    on('[data-r]', (b) => { ctx.act({ op: 'rate', v: Number(b.dataset.r) }); ctx.haptic('select'); });
    on('[data-x]', (b) => { ctx.act({ op: 'react', e: Number(b.dataset.x) }); ctx.haptic('tap'); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); });
    const sk = $('#fn-skip'); if (sk && v.cur) sk.onclick = () => { ctx.act({ op: 'skip', on: !v.cur.mySkip }); ctx.haptic(v.cur.mySkip ? 'tap' : 'warn'); };
    on('[data-vol]', (b) => ctx.act({ op: 'vol', d: Number(b.dataset.vol) }));
    on('[data-mute]', () => ctx.act({ op: 'vol', mute: !v.muted }));
    on('[data-fn="done"]', () => { ctx.act({ op: 'done' }); ctx.haptic('success'); });
    on('[data-fn="skipReel"]', () => ctx.act({ op: 'skipReel' }));
    on('[data-n]', (b) => { ctx.act({ op: 'final', n: Number(b.dataset.n) }); ctx.haptic('select'); ctx.sfx('click'); });
    // Picking
    const qi = $('#fn-q'); if (qi) { qi.oninput = () => { q = qi.value; }; qi.onkeydown = (e) => { if (e.key === 'Enter') { const g = $('#fn-go') || $('[data-plat="youtube"]'); if (g) g.click(); } }; }
    const pi = $('#fn-paste');
    if (pi) {
      pi.oninput = () => { paste = pi.value; if (msg) { msg = ''; } };
      pi.onkeydown = (e) => { if (e.key === 'Enter') { const u = $('#fn-use'); if (u) u.click(); } };
      // Pasting a link is enough: no need to press the button too.
      pi.onpaste = () => setTimeout(() => { paste = pi.value; if (looksLikeLink(paste) && !busy) { pi.blur(); pick({ url: paste.trim() }); } }, 30);
    }
    const search = async () => { busy = true; msg = ''; ctx.redraw(); const r = await ctx.actAsync({ op: 'search', q, shorts: shortsOnly }); busy = false; if (r.ok) results = r.results; else msg = r.error || ''; ctx.redraw(); };
    const go = $('#fn-go'); if (go) go.onclick = () => { if (qi) q = qi.value; if (q.trim()) search(); };
    const sh = $('#fn-sh'); if (sh) sh.onchange = () => { shortsOnly = sh.checked; };
    on('[data-idea]', (b) => { q = b.dataset.idea; if ($('#fn-go')) search(); else ctx.redraw(); });
    on('[data-plat]', (b) => { if (qi) q = qi.value; window.open(URLS[b.dataset.plat] + encodeURIComponent(q || 'funny'), '_blank'); });
    async function pick(payload) {
      if (busy) return;
      busy = true; msg = ''; ctx.redraw();
      const r = await ctx.actAsync({ op: 'pick', ...payload });
      busy = false;
      if (r.ok) { paste = ''; results = null; q = ''; ctx.toast(r.queued ? '✅ Lined up for your turn!' : '🎬 On the big screen!'); ctx.sfx('chime'); ctx.haptic('success'); }
      else { msg = r.error || 'That didn’t work.'; ctx.haptic('error'); }
      ctx.redraw();
    }
    const use = $('#fn-use'); if (use) use.onclick = () => { if (pi) paste = pi.value; if (!paste.trim()) { msg = 'Paste a video link first.'; ctx.redraw(); return; } pick({ url: paste.trim() }); };
    const clip = $('#fn-clip'); if (clip) clip.onclick = async () => { try { const t = await navigator.clipboard.readText(); paste = String(t || '').slice(0, 600); if (looksLikeLink(paste)) pick({ url: paste.trim() }); else { msg = 'There’s no link on your clipboard. In the app, tap Share → Copy link first.'; ctx.redraw(); } } catch { msg = 'Couldn’t read the clipboard. Long-press the box and choose Paste.'; ctx.redraw(); } };
    on('.fn-results [data-id]', (b) => pick({ id: b.dataset.id }));
    const ch = $('#fn-change'); if (ch) ch.onclick = () => { ctx.act({ op: 'unqueue' }); };
  }


  // ---------- the couch under the TV: the friends, seen from behind, reacting ----------
  const hashStr = (x) => { let h = 2166136261; for (const c of String(x)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
  const HAIRS = ['#2b1a12', '#e0a03a', '#7a2f1c', '#1d1d2a', '#c45a9a', '#3a2418', '#e8e4dc', '#5b3a8a'];
  function couch(el, players, s, hide) {
    if (!el) return;
    el.hidden = !!hide; if (hide) return;
    const all = players || [], list = all.slice(0, 14), more = all.length - list.length;
    const up = s.phase === 'play' && s.cur ? s.cur.by : s.phase === 'pick' ? s.picker : null;
    const html = `<div class="fn-sofa"><div class="fn-sofa-back"></div><div class="fn-pals">${list.map((p) => { const h = hashStr(p.id); return `<div class="fn-pal ${up && p.name === up ? 'up' : ''}" data-pid="${esc(p.id)}" style="--c:${esc(p.color || '#ff6b8b')};--h:${HAIRS[h % HAIRS.length]};--d:${((h % 7) * 0.13).toFixed(2)}s"><span class="fn-bub"></span><i class="fn-head s${h % 4}"></i><i class="fn-body"></i><b>${esc(p.avatar || '')} ${esc(p.name)}</b></div>`; }).join('')}${more > 0 ? `<div class="fn-pal more"><b>+${more} more</b></div>` : ''}</div><div class="fn-sofa-arm l"></div><div class="fn-sofa-arm r"></div></div>`;
    if (el.dataset.h !== html) { el.dataset.h = html; BOX.morph(el, html); }
  }
  function palPop(pid, e) {
    let p = null; for (const x of document.querySelectorAll('.fn-pal[data-pid]')) if (x.dataset.pid === String(pid)) p = x;
    if (!p) return;
    const b = p.querySelector('.fn-bub'); if (b) b.textContent = e;
    p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop');
  }

  // ---------- phone haptics: each big moment buzzes once ----------
  const fbz = new Set(); let fEpoch = 0, fLast = null;
  function fb(ctx, key, kind) { const k = fEpoch + ':' + key; if (fbz.has(k)) return; fbz.add(k); if (fbz.size > 300) fbz.clear(); try { ctx.haptic && ctx.haptic(kind); } catch { /* none */ } }
  function phoneHaptics(v, ctx) {
    if (fLast === 'over' && v.phase !== 'over') fEpoch++;
    fLast = v.phase;
    if (v.phase === 'pick' && v.myTurn) { fb(ctx, 'turn' + v.n, 'turn'); if (v.endsIn && v.endsIn < 12000) fb(ctx, 'hurry' + v.n, 'warn'); }
    if (v.phase === 'play' && v.cur) fb(ctx, 'on' + v.n, v.cur.mine ? 'big' : 'select');
    if (v.phase === 'score' && v.last) fb(ctx, 'sc' + v.last.n, v.last.why === 'skipped' ? (v.last.mine ? 'error' : 'buzz') : v.last.mine ? 'success' : 'tap');
    if (v.phase === 'final') fb(ctx, 'final', 'turn');
    if (v.phase === 'over') fb(ctx, 'over', v.rank === 1 ? 'win' : 'success');
  }

  // ---------- TV lobby: the living room ----------
  // Each setting is a thing in the room (a clock, the remote, the TV guide…) whose drawing
  // shows its value; the friends sit on the couch as they join; the join code is on the TV.
  let lob = null;
  const INKC = '#1b1424';
  const optIdx = (f, v) => Math.max(0, f.options.findIndex((o) => String(o.value) === String(v)));
  const L1 = (d, w = 4, c = INKC) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  function art(key, v) {
    const n = Number(v);
    if (key === 'maxSeconds') { // a wall clock: the coloured slice is how long a video may run
      const k = Math.min(1, n / 180), a = -Math.PI / 2 + k * Math.PI * 2, big = k > 0.5 ? 1 : 0;
      return `<circle cx="60" cy="62" r="44" fill="#fff4e0" stroke="${INKC}" stroke-width="6"/><path d="M60 62 L60 18 A44 44 0 ${big} 1 ${(60 + Math.cos(a) * 44).toFixed(1)} ${(62 + Math.sin(a) * 44).toFixed(1)} Z" fill="#ff4f6d" opacity="0.75"/>${[0, 1, 2, 3].map((i) => L1(`M${60 + Math.cos(i * Math.PI / 2) * 36} ${62 + Math.sin(i * Math.PI / 2) * 36} L${60 + Math.cos(i * Math.PI / 2) * 42} ${62 + Math.sin(i * Math.PI / 2) * 42}`, 4)).join('')}<g class="fnl-hand">${L1('M60 62 L60 30', 5)}</g>${L1('M60 62 L80 62', 5)}<circle cx="60" cy="62" r="5" fill="${INKC}"/>`;
    }
    if (key === 'pickSeconds') { // an egg timer
      const k = Math.min(1, n / 90);
      return `<g class="fnl-flip"><rect x="30" y="12" width="60" height="10" rx="4" fill="#c98b3c" stroke="${INKC}" stroke-width="4"/><rect x="30" y="98" width="60" height="10" rx="4" fill="#c98b3c" stroke="${INKC}" stroke-width="4"/><path d="M38 22 Q38 50 58 60 Q38 70 38 98 L82 98 Q82 70 62 60 Q82 50 82 22 Z" fill="#dff6ff" stroke="${INKC}" stroke-width="4"/><path d="M${44 - k * 2} ${36 - k * 8} L${76 + k * 2} ${36 - k * 8} Q72 52 60 58 Q48 52 ${44 - k * 2} ${36 - k * 8} Z" fill="#ffd23f"/><path d="M42 96 Q60 ${80 - k * 10} 78 96 Z" fill="#ffd23f"/></g>`;
    }
    if (key === 'skip') { // the remote, its big skip button
      return `<g transform="rotate(-14 60 60)"><rect x="36" y="8" width="48" height="104" rx="18" fill="#2c2440" stroke="${INKC}" stroke-width="5"/><circle cx="60" cy="26" r="6" fill="#ff4f6d"/><circle cx="60" cy="56" r="17" fill="#ffd23f" stroke="${INKC}" stroke-width="4"/><path d="M52 48 L60 56 L52 64 Z M60 48 L68 56 L60 64 Z" fill="${INKC}"/>${[0, 1, 2].map((i) => `<circle cx="${48 + i * 12}" cy="86" r="4.5" fill="#7fe3ff"/><circle cx="${48 + i * 12}" cy="99" r="4.5" fill="#7fe3ff"/>`).join('')}</g><text x="96" y="30" font-family="Luckiest Guy, cursive" font-size="22" fill="#ff4f6d" text-anchor="middle">${n <= 0.4 ? '⅓' : n <= 0.5 ? '½' : '⅔'}</text>`;
    }
    if (key === 'maxVideos') { // the TV guide
      return `<g transform="rotate(6 60 60)"><rect x="22" y="10" width="76" height="100" rx="5" fill="#ffd23f" stroke="${INKC}" stroke-width="5"/><rect x="22" y="10" width="76" height="22" fill="#ff4f6d" stroke="${INKC}" stroke-width="5"/><text x="60" y="28" font-family="Luckiest Guy, cursive" font-size="17" fill="#fff" text-anchor="middle">TV GUIDE</text><text x="60" y="82" font-family="Luckiest Guy, cursive" font-size="44" fill="${INKC}" text-anchor="middle">${n}</text><text x="60" y="100" font-family="Fredoka, sans-serif" font-size="12" fill="${INKC}" text-anchor="middle">TONIGHT</text></g>`;
    }
    if (key === 'turns') { // a stack of tapes, one each
      let o = ''; for (let i = 0; i < n; i++) o += `<g transform="translate(${18 + (i % 2) * 6} ${80 - i * 26}) rotate(${i % 2 ? 3 : -3})"><rect width="80" height="24" rx="4" fill="${['#2c2440', '#3fb6ff', '#ff6b8b'][i % 3]}" stroke="${INKC}" stroke-width="4"/><rect x="12" y="6" width="56" height="12" rx="3" fill="#fff4e0"/><circle cx="28" cy="12" r="3.5" fill="${INKC}"/><circle cx="52" cy="12" r="3.5" fill="${INKC}"/></g>`;
      return o;
    }
    if (key === 'reel') { // the film reel: spinning when there is a best-of reel
      const off = n === 0;
      return `<g class="${off ? '' : 'fnl-spin'}"><circle cx="54" cy="56" r="40" fill="#b9bcc8" stroke="${INKC}" stroke-width="5"/>${[0, 1, 2, 3, 4].map((i) => `<circle cx="${(54 + Math.cos(i * 1.2566) * 22).toFixed(1)}" cy="${(56 + Math.sin(i * 1.2566) * 22).toFixed(1)}" r="9" fill="#2c2440"/>`).join('')}<circle cx="54" cy="56" r="6" fill="${INKC}"/></g><path d="M86 74 Q104 88 98 112" fill="none" stroke="${INKC}" stroke-width="12"/><path d="M86 74 Q104 88 98 112" fill="none" stroke="#7a6a50" stroke-width="7" stroke-dasharray="4 4"/>${off ? L1('M14 16 L104 104', 8, '#ff4f6d') : `<text x="100" y="28" font-family="Luckiest Guy, cursive" font-size="24" fill="#ffd23f" text-anchor="middle" stroke="${INKC}" stroke-width="1.5">${n}</text>`}`;
    }
    if (key === 'safe') { // a padlock, locked when safe search is on
      const on = v === true || v === 'true';
      return `<path d="M38 56 L38 ${on ? 36 : 22} Q38 ${on ? 12 : -2} 60 ${on ? 12 : -2} Q82 ${on ? 12 : -2} 82 ${on ? 36 : 22} L82 ${on ? 56 : 40}" fill="none" stroke="#b9bcc8" stroke-width="11" transform="${on ? '' : 'translate(14 0)'}"/><rect x="26" y="54" width="68" height="56" rx="10" fill="${on ? '#2ee6a6' : '#ffd23f'}" stroke="${INKC}" stroke-width="5"/><circle cx="60" cy="78" r="7" fill="${INKC}"/><path d="M57 80 L55 96 L65 96 L63 80 Z" fill="${INKC}"/>`;
    }
    // anything else: a clapperboard
    return `<rect x="16" y="46" width="88" height="62" rx="6" fill="#2c2440" stroke="${INKC}" stroke-width="5"/><g transform="rotate(-14 16 46)"><rect x="16" y="26" width="88" height="20" fill="#fff4e0" stroke="${INKC}" stroke-width="5"/>${[0, 1, 2, 3].map((i) => `<path d="M${26 + i * 22} 26 L${38 + i * 22} 46 L${46 + i * 22} 46 L${34 + i * 22} 26 Z" fill="${INKC}"/>`).join('')}</g><text x="60" y="88" font-family="Luckiest Guy, cursive" font-size="20" fill="#ffd23f" text-anchor="middle">${esc(String(v) === 'true' ? 'ON' : String(v) === 'false' ? 'OFF' : String(v)).slice(0, 6)}</text>`;
  }
  const SLOT = (i) => (i < 4 ? { c: 1 + (i % 2), r: 1 + Math.floor(i / 2) } : i < 8 ? { c: 4 + (i % 2), r: 1 + Math.floor((i - 4) / 2) } : { c: i % 2 ? 5 : 1, r: 3 });
  function itemsHtml(L) {
    return L.fields.map((f, i) => {
      const v = L.settings[f.key], o = f.options[optIdx(f, v)] || { label: '' }, at = SLOT(i);
      return `<div class="fnl-item" data-k="${esc(f.key)}" style="grid-column:${at.c};grid-row:${at.r};--i:${i}">
        <svg class="fnl-art" viewBox="0 0 120 120" aria-hidden="true">${art(f.key, v)}</svg>
        <div class="fnl-tag"><small>${esc(f.label)}</small>
          <div class="fnl-val"><button class="fnl-arr" data-step="-1" aria-label="Previous">‹</button><span class="fnl-cur">${esc(o.label)}<select data-set="${esc(f.key)}" aria-label="${esc(f.label)}">${f.options.map((x) => `<option value="${esc(String(x.value))}" ${String(v) === String(x.value) ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></span><button class="fnl-arr" data-step="1" aria-label="Next">›</button></div></div>
      </div>`;
    }).join('');
  }
  const BULBS = Array.from({ length: 22 }, (_, i) => { const u = i / 21, sw = (u * 2) % 1; return { x: u * 100, y: 18 + Math.sin(sw * Math.PI) * 36, c: ['#ffd23f', '#ff6b8b', '#7fe3ff', '#7ee081', '#ffb347'][i % 5] }; });
  function lobbyTv(el, L) {
    lob = L;
    if (!el.querySelector('.fnl')) {
      el.innerHTML = `<div class="fnl">
        <svg class="fnl-lights" viewBox="0 0 100 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 18 ${BULBS.map((b) => `L${b.x} ${b.y}`).join(' ')}" fill="none" stroke="#120a1c" stroke-width="0.5" vector-effect="non-scaling-stroke"/></svg>
        <div class="fnl-bulbs" aria-hidden="true">${BULBS.map((b, i) => `<i style="left:${b.x}%;top:${b.y * 1.2}px;--c:${b.c};--d:${(i % 5) * 0.4}s"></i>`).join('')}</div>
        <div class="fnl-curtain l" aria-hidden="true"></div><div class="fnl-curtain r" aria-hidden="true"></div>
        <div class="fnl-lamp l" aria-hidden="true"></div><div class="fnl-lamp r" aria-hidden="true"></div>
        <div class="fnl-room">
          <div class="settings fnl-set" id="settings"></div>
          <div class="fnl-tv"><div class="fnl-screen">
            <div class="fnl-logo"><span class="a">Just</span><span class="b">Funny</span></div>
            <div class="fnl-join"><img id="qr" alt="QR code to join"><div class="fnl-jtxt"><div class="fnl-scan">Grab your phone and scan, or go to</div><b class="fnl-url" id="fnl-url"></b><div class="fnl-codelab">ROOM CODE</div><div class="fnl-code" id="code"></div></div></div>
            <div class="fnl-steps"><span><b>1</b> Find a funny video</span><span><b>2</b> It plays right here</span><span><b>3</b> Rate it, react or skip!</span></div>
          </div><div class="fnl-knobs"><i></i><i></i><b>JustFunny</b></div></div>
          <div class="fnl-stand">
            <button class="fnl-start" id="start">▶ Start the watch party</button>
            <div class="err fnl-err" id="lobby-err"></div>
            <div class="fnl-vip"></div>
            <div class="fnl-links"><button id="add-bots">+ 5 test bots</button><button id="rm-bots">remove bots</button><button id="fnl-pick">other game</button></div>
            <div class="fnl-lineup"></div>
          </div>
        </div>
        <div class="fnl-couch"><div class="fnl-sofa-back"></div><div class="roster fnl-roster" id="roster"></div><div class="fnl-seat"></div><div class="fnl-arm l"></div><div class="fnl-arm r"></div>
          <div class="fnl-popcorn" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div>
      </div>`;
      el.querySelector('#start').onclick = async () => { const r = await lob.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || 'Could not start.'; };
      el.querySelector('#add-bots').onclick = () => lob.bots(5);
      el.querySelector('#rm-bots').onclick = () => lob.removeBots();
      el.querySelector('#fnl-pick').onclick = () => lob.pick();
    }
    const qr = el.querySelector('#qr'); if (qr.dataset.u !== L.joinUrl) { qr.src = L.qr; qr.dataset.u = L.joinUrl; }
    const code = el.querySelector('#code'); if (code.textContent !== L.code) code.textContent = L.code;
    el.querySelector('#fnl-url').textContent = L.joinUrl.replace(/^https?:\/\//, '');
    const n = L.players.length, st = el.querySelector('#start');
    st.disabled = n < L.min; st.textContent = n < L.min ? `Waiting for ${L.min - n} more friend${L.min - n === 1 ? '' : 's'}…` : '▶ Start the watch party';
    BOX.morph(el.querySelector('.fnl-vip'), L.vip ? `👑 <b>${esc(L.vip)}</b> has the remote and can start from their phone` : 'The first friend to join gets the remote 👑');
    BOX.morph(el.querySelector('.fnl-lineup'), L.lineupHtml || '');
    const box = el.querySelector('#settings');
    if (!box.contains(document.activeElement)) BOX.morph(box, itemsHtml(L));
    for (const it of box.querySelectorAll('.fnl-item')) {
      const f = L.fields.find((x) => x.key === it.dataset.k); if (!f) continue;
      const sel = it.querySelector('select');
      sel.onchange = () => { sel.blur(); lob.set(f.key, sel.value); BOX.sfx('click'); };
      for (const b of it.querySelectorAll('[data-step]')) b.onclick = () => {
        const nx = f.options[(optIdx(f, lob.settings[f.key]) + Number(b.dataset.step) + f.options.length) % f.options.length];
        lob.set(f.key, String(nx.value)); BOX.sfx('pop');
        it.classList.remove('bump'); void it.offsetWidth; it.classList.add('bump');
      };
    }
    // The friends take their seats on the couch (click one to remove them).
    const ro = el.querySelector('#roster');
    BOX.morph(ro, L.players.map((p) => `<div class="chip fnl-pal ${p.online ? '' : 'off'}" data-kick="${esc(p.id)}" title="Click to remove" style="--c:${esc(p.color || '#ff6b8b')};--d:${((hashStr(p.id) % 9) * 0.21).toFixed(2)}s"><span class="fnl-face">${esc(p.avatar || '🙂')}</span><i class="fnl-body"></i><b>${esc(p.name)}</b></div>`).join('') || '<div class="fnl-empty">Saving these seats for you…</div>');
    ro.classList.toggle('many', n > 10); ro.classList.toggle('lots', n > 20);
    for (const c of ro.querySelectorAll('[data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) lob.kick(c.dataset.kick); };
  }

  // Phone lobby extra: a TV-guide card while waiting.
  const lobbyPhone = () => `<div class="fn-pguide"><div class="fn-pguide-h">Tonight on JustFunny</div><ol><li><b>Find</b> a funny YouTube, Short, TikTok or Reel</li><li><b>Paste</b> the link: it plays on the big TV</li><li><b>Rate</b>, throw reactions, or vote to skip the duds</li></ol><p>Tip: line your video up early. It plays the moment your turn comes.</p></div>`;

  BOX.games.funny = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => { const m = { pick: 'think', play: null, reel: null, score: 'reveal', final: 'finale', over: 'finale' }; return s.phase in m ? m[s.phase] : 'play'; },
    name: 'JustFunny', icon: '😂',
    about: 'A watch party. Take turns putting funny videos on the big screen. React live, fill the laugh meter, skip the duds, crown the funniest.',
    how: [
      'Everyone gets a turn, in a random order. Find a YouTube, Shorts, TikTok or Instagram Reel video on your phone and it plays on the big screen.',
      'Line up your video early: it plays the moment your turn comes. Ready videos never wait for a slow picker.',
      'While it plays, rate it (😐 to 🤣) and spam reactions: they float up the TV and fill the laugh meter.',
      'Bored? Vote to skip. Enough skips and the next video starts.',
      'At the end, vote for the funniest video. The best-of reel replays the winners from their biggest laugh.',
    ],
    fx: { start: 'start', boo: 'boo', cheer: 'cheer', chime: 'chime', gavel: 'gavel', win: 'win', shrug: 'shrug', ballot: 'ballot', drum: 'drum', reveal: 'reveal' },
    onFx(f) {
      if (f.kind !== 'react') return;
      const o = document.getElementById('fn-react'); if (o) float(o, f.e);
      if (f.pid) palPop(f.pid, f.e);
      laugh.level = Math.min(100, laugh.level + 3);
    },
    tv: tvRender,
    phone: phoneRender,
    lobbyTv, lobby: lobbyPhone,
  };
})();
