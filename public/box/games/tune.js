'use strict';
// Tune Buzz (key `tune`): TV and phone screens, the designed lobby, haptics, and the clip player.
// Look: a neon late-night radio studio (see public/box/titles/tune.js): deep violet, hot pink,
// cyan and gold, Monoton + Bungee, a live equaliser on the big screen.
//
// The songs are the players' own: phones search (box/songs.js, through ctx.actAsync), hear the
// 30-second preview and pick which few seconds the room hears. The TV plays each clip with an
// <audio> element on the server's schedule (listen 1, 2, 3, each longer), then more of the song
// at the reveal, and ducks the game's soundtrack while it plays.
(function () {
  const { esc, mmss } = BOX;
  const TAU = Math.PI * 2;

  // =========================================================================== AUDIO
  // Plays [start, start + secs] of a preview on an <audio> element, then fades it out.
  function seekPlay(au, start, secs, { fade = 0.25, volume = 1, onBlocked = null, onEnd = null } = {}) {
    clearTimeout(au.__stopT); clearInterval(au.__fadeT);
    const go = () => {
      try { au.currentTime = Math.max(0, start); } catch { /* not seekable yet */ }
      au.volume = volume;
      const pr = au.play();
      if (pr && pr.catch) pr.catch((e) => { if (e && e.name === 'NotAllowedError' && onBlocked) onBlocked(); });
      au.__stopT = setTimeout(() => fadeOut(au, fade, onEnd), Math.max(0, secs * 1000 - fade * 1000));
    };
    if (au.readyState >= 1) go();
    else { const f = () => { au.removeEventListener('loadedmetadata', f); go(); }; au.addEventListener('loadedmetadata', f); try { au.load(); } catch { /* fine */ } }
  }
  function fadeOut(au, secs, onEnd) {
    clearTimeout(au.__stopT); clearInterval(au.__fadeT);
    if (au.paused || secs <= 0) { au.pause(); if (onEnd) onEnd(); return; }
    const v0 = au.volume, steps = Math.max(1, Math.round(secs * 20)); let k = 0;
    au.__fadeT = setInterval(() => { k++; au.volume = Math.max(0, v0 * (1 - k / steps)); if (k >= steps) { clearInterval(au.__fadeT); au.pause(); au.volume = v0; if (onEnd) onEnd(); } }, 50);
  }

  // The TV's clip player. `live` drives the equaliser (local performance.now() times).
  const live = { start: 0, end: 0, worthAt: 0, t0: 0, tEnd: 0, listens: [] };
  const TVP = { au: null, src: '', key: '', timers: [], blocked: null, rerender: null };
  const tvAudio = () => { if (!TVP.au) { TVP.au = new Audio(); TVP.au.preload = 'auto'; } return TVP.au; };
  const tvVolume = () => { const s = BOX.audio && BOX.audio.settings; return s ? (s.mute ? 0 : Math.max(0, Math.min(1, s.master == null ? 0.9 : s.master))) : 0.9; };
  const duck = (on) => { try { BOX.audio && BOX.audio.duck(on); } catch { /* no engine */ } };
  function tvLoad(src) { const au = tvAudio(); if (src && TVP.src !== src) { TVP.src = src; au.src = src; try { au.load(); } catch { /* fine */ } } }
  function tvClear() { for (const h of TVP.timers) clearTimeout(h); TVP.timers = []; }
  function tvStop(fade = 0.6) { tvClear(); TVP.blocked = null; if (TVP.au && !TVP.au.paused) fadeOut(TVP.au, fade, () => duck(false)); else duck(false); live.end = 0; }
  function tvPlay(start, secs, fade) {
    const au = tvAudio(), now = performance.now();
    live.start = now; live.end = now + secs * 1000;
    duck(true);
    seekPlay(au, start, secs, { fade, volume: tvVolume(), onEnd: () => duck(false),
      onBlocked: () => { TVP.blocked = { start, secs, fade, until: now + secs * 1000 }; if (TVP.rerender) TVP.rerender(); } });
  }
  // A tap on the TV when the browser blocked the sound: play what should be playing now.
  function tvUnblock() {
    const b = TVP.blocked; TVP.blocked = null;
    const au = tvAudio(); try { au.play().then(() => au.pause()).catch(() => {}); } catch { /* fine */ }
    if (b) { const left = (b.until - performance.now()) / 1000; if (left > 0.5) tvPlay(b.start + (b.secs - left), left, b.fade); }
    if (TVP.rerender) TVP.rerender();
  }
  // Schedules what the TV should play for this state (each step once).
  function tvSchedule(s) {
    if (s.phase === 'submit' || s.phase === 'over') { if (TVP.key) { TVP.key = ''; tvStop(); } return; }
    if (s.preview) tvLoad(s.preview);
    const ci = s.clipInfo;
    if (s.phase === 'card') { if (TVP.key !== s.n + 'c') { TVP.key = s.n + 'c'; tvStop(0.4); } return; }
    if (s.phase === 'guess' && ci && ci.play) {
      const key = s.n + 'g'; if (TVP.key === key) return;
      TVP.key = key; tvClear(); tvLoad(ci.play.preview);
      const now = performance.now();
      live.t0 = now + ci.t0In; live.tEnd = now + ci.endIn; live.listens = ci.listens.map((l) => ({ at: now + l.atIn, len: l.len }));
      for (const l of ci.listens) {
        if (l.atIn + l.len < 300) continue; // already over (the TV reconnected)
        const late = Math.max(0, -l.atIn);
        TVP.timers.push(setTimeout(() => tvPlay(ci.play.start + late / 1000, (l.len - late) / 1000, 0.2), Math.max(0, l.atIn)));
      }
      return;
    }
    if (s.phase === 'reveal') {
      const key = s.n + 'r'; if (TVP.key === key) return;
      TVP.key = key; tvClear(); tvLoad(s.preview);
      const into = (s.shownFor || 0) / 1000, len = Math.max(0, Math.min(14, 29.5 - s.start) - into);
      if (len > 1) tvPlay(s.start + into, len, 1.5);
      return;
    }
    if (s.phase === 'score') { if (TVP.key !== s.n + 's') { TVP.key = s.n + 's'; tvStop(1.2); } }
  }

  // =========================================================================== TV
  function eqLoop(cv) {
    if (cv.__run) return; cv.__run = true;
    const bars = 48, hts = new Float32Array(bars), peaks = new Float32Array(bars);
    const step = () => {
      if (!document.body.contains(cv)) { cv.__run = false; return; }
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const now = performance.now(), t = now / 1000;
      const on = now >= live.start && now <= live.end && !(TVP.au && TVP.au.paused), beat = (t * 2) % 1, pulse = on ? Math.pow(1 - beat, 3) : 0;
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1a0638'); gr.addColorStop(0.65, '#0c0322'); gr.addColorStop(1, '#05010f'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (const [k, c] of [[0, '255,61,139'], [1, '56,232,255'], [2, '255,210,63']]) {
        const x = W * (0.5 + 0.42 * Math.sin(t * (0.3 + k * 0.07) + k * 2.1)), a = 0.08 + (on ? 0.1 * pulse + 0.05 : 0);
        gr = g.createLinearGradient(x, 0, W / 2, H); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 30, 0); g.lineTo(x + 30, 0); g.lineTo(W / 2 + W * 0.35, H); g.lineTo(W / 2 - W * 0.35, H); g.closePath(); g.fill();
      }
      g.strokeStyle = 'rgba(255,61,139,0.16)'; g.lineWidth = 1.5; const hz = H * 0.78;
      for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(W / 2 + i * 30, hz); g.lineTo(W / 2 + i * W * 0.12, H); g.stroke(); }
      for (let k = 0; k < 7; k++) { const y = hz + (H - hz) * Math.pow(k / 6, 1.7) + ((t * 30) % 12) * (k / 6); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      const bw = W * 0.86 / bars, x0 = W * 0.07, base = hz;
      for (let i = 0; i < bars; i++) {
        const f = i / bars, shape = 0.55 + 0.45 * Math.sin(f * 5.3 + 1) * Math.sin(f * 2.1 + t * 0.7);
        const noise = 0.5 + 0.5 * Math.sin(t * (6 + (i % 7)) + i * 1.7) * Math.sin(t * (3.1 + (i % 5) * 0.6) + i);
        const target = on ? (0.2 + 0.5 * shape * noise + 0.25 * pulse * (1 - Math.abs(f - 0.3))) : 0.04 + 0.03 * (0.5 + 0.5 * Math.sin(t * 1.5 + i * 0.5));
        hts[i] += (target - hts[i]) * (target > hts[i] ? 0.45 : 0.12);
        peaks[i] = Math.max(peaks[i] - 0.006, hts[i]);
        const h = hts[i] * H * 0.5, x = x0 + i * bw, hue = 320 - f * 150, segs = Math.max(1, Math.floor(h / 10));
        for (let sg = 0; sg < segs; sg++) { g.fillStyle = `hsla(${hue - sg * 1.5},100%,${55 + sg * 0.6}%,0.9)`; g.fillRect(x + 2, base - (sg + 1) * 10 + 2, bw - 4, 7); }
        g.fillStyle = `hsla(${hue},100%,80%,0.95)`; g.fillRect(x + 2, base - peaks[i] * H * 0.5 - 6, bw - 4, 3);
        g.fillStyle = `hsla(${hue},100%,60%,0.14)`; g.fillRect(x + 2, base + 4, bw - 4, h * 0.35);
      }
      // Guessing: light the listen that's playing and tick the points down.
      const root = cv.closest('.tb-stage');
      if (root && live.listens.length) {
        let cur = -1; live.listens.forEach((l, i) => { if (now >= l.at) cur = i; });
        for (const el of root.querySelectorAll('[data-ls]')) { const i = Number(el.dataset.ls); el.classList.toggle('on', i === cur && now <= live.listens[i].at + live.listens[i].len); el.classList.toggle('done', i < cur || (i === cur && now > live.listens[i].at + live.listens[i].len)); }
        const w = root.querySelector('#tb-worth');
        if (w && live.tEnd > live.t0) { const fr = Math.max(0, Math.min(1, (now - live.t0) / (live.tEnd - live.t0))), v = String(Math.round((300 - 200 * fr) / 10) * 10); if (w.textContent !== v) w.textContent = v; }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const ends = {};
  const timer = (key, endsIn) => { if (!endsIn) return ''; if (!ends[key] || Math.abs(ends[key] - (Date.now() + endsIn)) > 1500) ends[key] = Date.now() + endsIn; return `<span class="timer" data-ends="${ends[key]}">${mmss(ends[key] - Date.now())}</span>`; };
  const av = (x) => esc((x && x.avatar) || '🙂');
  // Gear (JustGold shop): a player's buzzer paint ({ a, b, pattern, icon, glow }) or null. On the TV the
  // avatar dot of their chip becomes their buzzer; on the phone it's the Guess button.
  const buzzPaint = (x) => (x && x.gear && window.MT_GEAR ? window.MT_GEAR.paint('tune', 'buzzer', x.gear) : null);
  const buzzBg = (pt) => (pt.pattern === 'swirl' ? `repeating-radial-gradient(circle, ${pt.a} 0 3px, #333 3px 5px), ${pt.a}` : `radial-gradient(circle at 35% 30%, #ffffffaa, ${pt.a} 45%, ${pt.b})`);
  const buzzDot = (x) => { const pt = buzzPaint(x); return pt ? ` style="background:${buzzBg(pt)};box-shadow:0 0 0 3px ${pt.b}${pt.glow ? ', 0 0 16px ' + pt.a : ''}"` : ''; };
  const chip = (x, extra = '', cls = '') => `<span class="tb-chip ${cls}" style="--c:${esc(x.color || '#ff3d8b')}"><i${buzzDot(x)}>${av(x)}</i>${esc(x.name)}${extra}</span>`;
  const secs = (ms) => (ms / 1000).toFixed(1) + ' s';
  const RATES = [{ n: 1, icon: '🍼', label: 'Too easy' }, { n: 2, icon: '🙂', label: 'Easy' }, { n: 3, icon: '🤔', label: 'Tricky' }, { n: 4, icon: '😰', label: 'Hard' }, { n: 5, icon: '🔥', label: 'Impossible' }];
  const rateOf = (d) => RATES[Math.max(0, Math.min(4, Math.round(d) - 1))];
  const art = (song, cls = '') => (song && song.art ? `<img class="tb-art ${cls}" src="${esc(song.art)}" alt="" referrerpolicy="no-referrer">` : `<div class="tb-art tb-noart ${cls}">♪</div>`);
  const VERDICT = {
    sweet: { icon: '🎯', title: 'SWEET SPOT!', text: 'Some got it, not everyone' },
    easy: { icon: '🍼', title: 'Too easy', text: 'Everyone got it' },
    nobody: { icon: '🧱', title: 'Nobody got it', text: 'Too hard pays nothing' },
  };
  const SCORING = `<div class="tb-how"><h3>🎚️ How points work</h3>
    <p><b>Guess fast:</b> 300 points at the first note, down to 100 at the buzzer.</p>
    <p><b>× Difficulty:</b> after each song everyone rates it 1 🍼 to 5 🔥. Your points are multiplied by the room's average.</p>
    <p><b>Your songs:</b> some (not all) got it 🎯 150 × difficulty. Everyone got it: 50 ×. Nobody: 0.</p>
    <p><b>Name the artist too:</b> +50.</p></div>`;

  function tvSubmit(s) {
    const P = s.players || [];
    return `<div class="tb-head"><span class="tb-live">☎ REQUEST LINE OPEN</span><h2>Add ${s.quota} song${s.quota === 1 ? '' : 's'} on your phone</h2>
      <div class="tb-sub">Search for anything. Then pick the ${s.clip} seconds we’ll hear first. Fun-hard wins, impossible doesn’t!</div></div>
      <div class="tb-reqs">${P.map((p, i) => `<div class="tb-req ${p.n >= s.quota ? 'done' : ''} ${p.online ? '' : 'off'}" style="--c:${esc(p.color)};animation-delay:${(i * 0.04).toFixed(2)}s"><span class="av">${av(p)}</span><span class="nm">${esc(p.name)}</span><span class="recs">${Array.from({ length: s.quota }, (_, k) => `<i class="${k < p.n ? 'on' : ''}"></i>`).join('')}</span></div>`).join('')}</div>
      <div class="tb-crate">📦 <b>${s.total}</b> song${s.total === 1 ? '' : 's'} in the crate · ${timer('sub', s.endsIn)}</div>`;
  }
  function tvGuess(s) {
    const ci = s.clipInfo || { listens: [] };
    const listens = ci.listens.map((l, i) => `<span class="tb-ls" data-ls="${i}">LISTEN ${i + 1}<small>${Math.round(l.len / 1000)} s</small></span>`).join('');
    const got = s.got.map((g, i) => chip(g, ` <b>✓ ${secs(g.ms)}</b>`, 'got' + (i === 0 ? ' first' : ''))).join('');
    const guessing = s.guessing.map((g) => chip(g, `<em class="dots">${'•'.repeat(g.tries)}</em>${g.artist ? ' 🎤' : ''}`, 'wait')).join('');
    return `<div class="tb-head"><span class="tb-live">● ON AIR</span><h2>Name that tune!</h2><div class="tb-sub">${chip(s.by, '', 'by')} picked this one</div></div>
      <div class="tb-listens">${listens}</div>
      <div class="tb-worth"><span>WORTH</span><b id="tb-worth">${ci.worth || 300}</b><span>× difficulty</span></div>
      <div class="tb-gets">${got || '<span class="tb-none-yet">Nobody’s got it yet…</span>'}</div>
      ${guessing ? `<div class="tb-guessing"><span class="lab">Still guessing ${timer('g' + s.n, s.endsIn)}</span>${guessing}</div>` : ''}
      ${TVP.blocked ? '<button class="tb-tap" id="tb-tap">🔈 Tap to play the clip</button>' : ''}`;
  }
  function tvSong(s, small) {
    const so = s.song;
    return `<div class="tb-song ${small ? 'small' : ''}">${art(so, 'spin')}<div class="tb-meta"><span class="tb-badge">IT WAS…</span><h2 class="tb-title">${esc(so.title)}</h2><div class="tb-artist">${esc(so.artist)}${so.album ? ` <small>· ${esc(so.album)}</small>` : ''}</div><div class="tb-sub">${chip(s.by, '', 'by')}’s pick</div></div></div>`;
  }
  function tvReveal(s) {
    const got = s.got.length ? s.got.map((g) => chip(g, ` <b>+${g.base}</b> <small>${secs(g.ms)}</small>`, 'got')).join('') : '<span class="tb-none">Nobody got it! 😱</span>';
    return `${tvSong(s)}
      <div class="tb-gets">${got}</div>
      ${s.close && s.close.length ? `<div class="tb-close"><span class="lab">Close calls:</span>${s.close.map((c) => `<span class="q">“${esc(c.text)}” <small>${esc(c.name)}</small></span>`).join('')}</div>` : ''}
      <div class="tb-rate"><div class="q">How hard was it? <b>Rate it on your phone</b> · ${s.rated}/${s.raters}</div><div class="scale">${RATES.map((r) => `<span><i>${r.icon}</i>${r.label}</span>`).join('')}</div></div>
      ${TVP.blocked ? '<button class="tb-tap" id="tb-tap">🔈 Tap to hear the song</button>' : ''}`;
  }
  function tvScore(s) {
    const R = s.result, r = rateOf(R.d), pct = ((R.d - 1) / 4) * 100, V = VERDICT[R.dj.kind];
    return `${tvSong(s, true)}
      <div class="tb-meter"><div class="lab">DIFFICULTY ${R.auto ? '<small>(nobody rated: it follows how many got it)</small>' : `<small>${R.votes} vote${R.votes === 1 ? '' : 's'}</small>`}</div>
        <div class="bar"><span class="fill" style="width:${pct}%"></span><span class="needle" style="left:${pct}%"><i>${r.icon}</i></span>${RATES.map((x) => `<em style="left:${((x.n - 1) / 4) * 100}%">${x.icon}</em>`).join('')}</div>
        <div class="val">×${R.d.toFixed(1)} <small>${esc(r.label)}</small></div></div>
      <div class="tb-tally">${R.rows.length ? R.rows.map((x, i) => `<div class="tb-trow" style="--c:${esc(x.color)};animation-delay:${0.3 + i * 0.12}s"><span class="nm">${av(x)} ${esc(x.name)}</span><span class="calc">${x.base} × ${R.d.toFixed(1)}</span><b>+${x.total}</b></div>`).join('') : ''}
        <div class="tb-trow dj ${R.dj.kind}" style="--c:${esc(R.dj.color)};animation-delay:${0.4 + R.rows.length * 0.12}s"><span class="nm">${V.icon} ${av(R.dj)} ${esc(R.dj.name)} <small>${V.title} ${V.text}</small></span><span class="calc">${R.dj.mult ? `${R.dj.mult} × ${R.d.toFixed(1)}` : ''}</span><b>+${R.dj.pts}</b></div></div>
      ${s.n < s.of ? `<div class="tb-next">Up next: song ${s.n + 1} of ${s.of}</div>` : '<div class="tb-next">That was the last one!</div>'}`;
  }
  function tvOver(s) {
    const f = s.final || { standings: s.standings, awards: {} }, st = f.standings, pod = [st[1], st[0], st[2]], A = f.awards || {};
    const aw = [];
    if (A.ear) aw.push(['👂', 'Golden Ear', A.ear.names.join(', '), `named ${A.ear.value} song${A.ear.value === 1 ? '' : 's'}`]);
    if (A.fast) aw.push(['⚡', 'Quickest Ear', A.fast.names.join(', '), `named one in ${secs(A.fast.value)}`]);
    if (A.dj) aw.push(['🎯', 'Sweet Spot DJ', A.dj.names.join(', '), `${A.dj.value} points from their picks`]);
    if (A.deep) aw.push(['🔥', 'Deepest Cut', A.deep.name, `“${A.deep.title}” · difficulty ${A.deep.d}`]);
    if (f.empty) return `<div class="tb-over"><h1 class="tb-win">📭 <span>No songs came in tonight!</span></h1><p class="tb-sub">Play again and add a song or two from your phone.</p></div>`;
    return `<div class="tb-over"><h1 class="tb-win">🏆 ${st[0] ? `${av(st[0])} ${esc(st[0].name)}` : ''} <span>tops the charts!</span></h1>
      <div class="tb-podium">${pod.map((r, i) => (r ? `<div class="tb-pod p${[2, 1, 3][i]}" style="--c:${esc(r.color)}"><div class="av">${av(r)}</div><div class="nm">${esc(r.name)}</div><div class="pts">${r.points}</div><div class="blk">${[2, 1, 3][i]}</div></div>` : '<div></div>')).join('')}</div>
      <div class="tb-awards">${aw.map(([ic, lab, nm, txt], i) => `<div class="tb-award" style="animation-delay:${0.5 + i * 0.3}s"><div class="ic">${ic}</div><div class="lb">${lab}</div><div class="nm">${esc(nm)}</div><div class="muted">${esc(txt)}</div></div>`).join('')}</div>
      <div class="tb-final-board">${BOX.board(st.slice(0, 10).map((r) => ({ ...r, name: (r.avatar ? r.avatar + ' ' : '') + r.name })), (r) => r.points, ' pts')}</div></div>`;
  }
  let lastTv = null;
  function tv(el, s) {
    if (!s) return;
    lastTv = { el, s }; TVP.rerender = () => lastTv && tv(lastTv.el, lastTv.s);
    if (!el.__tbTap) { el.__tbTap = true; document.addEventListener('pointerdown', () => { if (TVP.blocked) tvUnblock(); }, true); }
    tvSchedule(s);
    if (s.phase === 'over') { BOX.morph(el, `<div class="tb-root over" id="tb-over">${tvOver(s)}</div>`); return; }
    if (s.phase !== 'guess') live.listens = [];
    const top = `<div class="tb-top"><span class="tb-round">${s.phase === 'submit' ? 'TAKING REQUESTS' : `SONG <b>${s.n}</b> / ${s.of}`}</span><span class="tb-type">🎵 TUNE BUZZ FM</span></div>`;
    let over = '';
    if (s.phase === 'submit') over = tvSubmit(s);
    else if (s.phase === 'card') over = `<div class="tb-card"><div class="tb-card-ic">💿</div><div class="tb-card-n">SONG ${s.n} OF ${s.of}</div><h1>${av(s.by)} ${esc(s.by.name)}’s pick</h1><p>Type the title on your phone. Fast = more points!</p><p class="tb-hint">🎧 Each listen is longer… and worth a little less.</p></div>`;
    else if (s.phase === 'guess') over = tvGuess(s);
    else if (s.phase === 'reveal' && s.song) over = tvReveal(s);
    else if (s.phase === 'score' && s.result) over = tvScore(s);
    const side = s.phase === 'submit' ? `<aside class="tb-side">${SCORING}</aside>`
      : `<aside class="tb-side"><h3>📻 The Charts</h3>${s.standings.map((r, i) => `<div class="tb-srow ${i === 0 && r.points ? 'top' : ''}"><span class="n">${i + 1}</span><span class="nm">${av(r)} ${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</aside>`;
    BOX.morph(el, `<div class="tb-root" id="tb-game">${top}<div class="tb-main"><section class="tb-stage"><canvas class="tb-eq" data-keep></canvas><div class="tb-o ph-${s.phase}" id="tb-o-${s.n}-${s.phase}">${over}</div></section>${side}</div></div>`);
    const cv = el.querySelector('.tb-eq'); if (cv) eqLoop(cv);
  }

  // =========================================================================== LOBBY
  const DESK = {
    songs: { lab: 'REQUESTS', ic: '💿', opts: { 1: '1', 2: '2', 3: '3' }, sub: 'songs each' },
    clip: { lab: 'FIRST LISTEN', ic: '⏱️', opts: { 2: '2s', 4: '4s', 6: '6s' }, sub: 'then longer' },
    time: { lab: 'GUESS TIME', ic: '⏰', opts: { 20: '20s', 30: '30s', 45: '45s' }, sub: 'per song' },
    showIntro: { lab: 'THE OPENING', ic: '🎬', opts: { true: 'Play it', false: 'Skip it' }, sub: 'intro cutscene' },
  };
  function lobbyTv(el, L) {
    el.__L = L;
    if (!el.__tbl) {
      el.__tbl = true;
      el.innerHTML = `<div class="tbl">
        <canvas class="tbl-cv"></canvas>
        <header class="tbl-head"><div class="tbl-onair">● ON AIR</div><div class="tbl-logo"><span class="a">TUNE</span><span class="b">BUZZ</span></div><div class="tbl-tag">Bring your songs. Name theirs. A few seconds is all you get.</div></header>
        <section class="tbl-desk"><div class="tbl-dh">🎛️ MIXING DESK <small>tap to change</small></div><div id="tbl-faders" class="tbl-faders"></div><div id="settings" class="tbl-sr"></div></section>
        <aside class="tbl-join"><div class="tbl-jt">🎧 CALL IN ON YOUR PHONE</div><img id="qr" alt="QR code to join"><div class="tbl-url" id="tbl-url"></div>
          <div class="tbl-cc">ROOM CODE</div><div class="tbl-code" id="code"></div><div class="tbl-vip" id="tbl-vip"></div><div class="err" id="lobby-err"></div>
          <button class="tbl-start" id="start">🔴 Go on air</button>
          <div class="tbl-links"><button id="add-bots">+ 5 test bots</button><button id="tbl-rm">remove bots</button><button id="tbl-pick">🎮 Other game</button></div></aside>
        <section class="tbl-crowd"><div class="tbl-ch"><b id="tbl-n">0</b> CALLERS ON THE LINE</div><div class="tbl-roster" id="roster"></div></section>
        <div class="tbl-party" id="tbl-party"></div></div>`;
      const $ = (q) => el.querySelector(q);
      $('#start').onclick = async () => { const r = await el.__L.start(); $('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      $('#add-bots').onclick = () => el.__L.bots(5);
      $('#tbl-rm').onclick = () => el.__L.removeBots && el.__L.removeBots();
      $('#tbl-pick').onclick = () => el.__L.pick();
      el.addEventListener('click', (e) => {
        const k = e.target.closest('[data-k]');
        if (k) { const s = el.querySelector(`select[data-set="${k.dataset.k}"]`); if (s) s.value = k.dataset.v; el.__L.set(k.dataset.k, k.dataset.v); BOX.sfx('pop'); return; }
        const c = e.target.closest('[data-kick]'); if (c && el.__L.kick && confirm('Remove this player?')) el.__L.kick(c.dataset.kick);
      });
      lobbyScene($('.tbl-cv'));
    }
    const $ = (q) => el.querySelector(q);
    if ($('#code').textContent !== L.code) $('#code').textContent = L.code;
    const ju = L.joinUrl || L.qr;
    if ($('#qr').dataset.u !== ju) { $('#qr').src = L.qr; $('#qr').dataset.u = ju; }
    $('#tbl-url').textContent = (L.joinUrl || '').replace(/^https?:\/\//, '');
    const n = L.players.length;
    $('#start').disabled = n < L.min;
    $('#tbl-n').textContent = n;
    $('#tbl-vip').innerHTML = L.vip ? `👑 <b>${esc(L.vip)}</b> can start from their phone` : n < L.min ? `${L.min - n} more caller${L.min - n === 1 ? '' : 's'} needed…` : 'The first caller hosts 👑';
    const fh = L.fields.map((f) => {
      const D = DESK[f.key] || { lab: f.label.toUpperCase(), ic: '🎚️', opts: {} }, cur = String(L.settings[f.key]);
      const i = Math.max(0, f.options.findIndex((o) => String(o.value) === cur)), pct = f.options.length > 1 ? (i / (f.options.length - 1)) * 100 : 50;
      return `<div class="tbl-ch-strip"><div class="tbl-fl">${D.ic} ${esc(D.lab)}</div><div class="tbl-rail"><span class="tbl-knob" style="left:${pct}%"></span></div>
        <div class="tbl-opts">${f.options.map((o) => `<button class="tbl-opt ${String(o.value) === cur ? 'on' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}" title="${esc(o.label)}">${esc(D.opts[String(o.value)] || o.label)}</button>`).join('')}</div>${D.sub ? `<div class="tbl-sub">${esc(D.sub)}</div>` : ''}</div>`;
    }).join('');
    const fd = $('#tbl-faders'); if (fd.__h !== fh) { fd.__h = fh; BOX.morph(fd, fh); }
    const box = $('#settings'), sig = L.fields.map((f) => f.key + ':' + f.options.map((o) => o.value).join('|')).join(';');
    if (box.__sig !== sig) { box.__sig = sig; box.innerHTML = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}">${esc(o.label)}</option>`).join('')}</select></label>`).join(''); }
    for (const s of box.querySelectorAll('select[data-set]')) { if (document.activeElement !== s) s.value = String(L.settings[s.dataset.set]); s.onchange = () => { s.blur(); el.__L.set(s.dataset.set, s.value); }; }
    const rh = n ? L.players.map((p, i) => `<span class="chip ${p.online ? '' : 'off'} ${p.name === L.vip ? 'vip' : ''}" data-kick="${esc(p.id)}" title="Click to remove" style="--c:${esc(p.color || '#ff3d8b')};--d:${((i * 0.17) % 1.6).toFixed(2)}s"><span class="vin"><span class="lbl">${esc(p.avatar || '🙂')}</span></span><b>${esc(p.name)}</b></span>`).join('')
      : '<div class="tbl-empty">📞 The lines are open… scan the code to call in!</div>';
    const r = $('#roster'); r.classList.toggle('many', n > 12); if (r.__h !== rh) { r.__h = rh; BOX.morph(r, rh); }
    const lp = $('#tbl-party'), lh = L.lineupHtml || ''; if (lp.__h !== lh) { lp.__h = lh; lp.innerHTML = lh; }
  }
  // The lobby backdrop: a slow equaliser skyline and drifting notes.
  function lobbyScene(cv) {
    const notes = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.04, e: ['🎵', '🎶', '🎧', '🎤', '🎸', '🥁'][Math.floor(Math.random() * 6)], s: 18 + Math.random() * 22 }));
    const f = () => {
      if (!document.body.contains(cv)) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const g = cv.getContext('2d'), t = performance.now() / 1000; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1b0640'); gr.addColorStop(1, '#07021a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const n = 64, bw = W / n;
      for (let i = 0; i < n; i++) { const h = H * (0.08 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 0.45) * Math.sin(t * 0.7 + i * 0.13))); g.fillStyle = `hsla(${320 - (i / n) * 150},100%,60%,0.22)`; g.fillRect(i * bw + 1, H - h, bw - 2, h); }
      g.textAlign = 'center';
      for (const p of notes) { p.y -= p.v / 60; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); } g.globalAlpha = 0.28; g.font = `${p.s}px serif`; g.fillText(p.e, p.x * W + Math.sin(t + p.y * 9) * 14, p.y * H); }
      g.globalAlpha = 1;
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }

  // =========================================================================== PHONE
  let felt = {};
  const feel = (ctx, key, kind) => { if (felt[key]) return; felt[key] = true; try { ctx.haptic(kind); } catch { /* none */ } };
  // Song picking (local to this phone until it's added).
  const SP = { q: '', results: null, busy: false, msg: '', draft: null, start: 8, playing: false, spotify: false };
  let PV = null; // the phone's preview player
  const pv = () => { if (!PV) { PV = new Audio(); PV.preload = 'auto'; } return PV; };
  function stopPreview() { if (PV && !PV.paused) fadeOut(PV, 0.15); SP.playing = false; }
  function hear(ctx, from, len) {
    const au = pv(), d = SP.draft; if (!d) return;
    if (au.src !== d.preview) { au.src = d.preview; }
    SP.playing = true; ctx.redraw();
    seekPlay(au, from, len, { fade: 0.15, onEnd: () => { SP.playing = false; ctx.redraw(); }, onBlocked: () => { SP.playing = false; ctx.toast('Tap ▶ again to listen'); ctx.redraw(); } });
  }
  // The guess box keeps the last answer's feedback for this song.
  const GF = { n: 0, text: '', kind: '', t0: 0, end: 0 };
  // The points on offer tick down on the phone too.
  setInterval(() => { for (const b of document.querySelectorAll('[data-wt0]')) { const t0 = Number(b.dataset.wt0), end = Number(b.dataset.wend), fr = Math.max(0, Math.min(1, (Date.now() - t0) / Math.max(1, end - t0))), w = String(Math.round((300 - 200 * fr) / 10) * 10); if (b.textContent !== w) b.textContent = w; } }, 250);

  function phSubmit(v, ctx, paint) {
    const need = v.quota - v.mine.length, d = SP.draft;
    if (d) {
      const max = v.maxStart, st = Math.min(SP.start, max), a = (st / 30) * 100, w = (v.clip / 30) * 100;
      paint(`<div class="tbp-card tbp-draft">${art(d, 'tbp-art')}<h2>${esc(d.title)}</h2><p class="muted">${esc(d.artist)}${d.explicit ? ' 🅴' : ''}</p></div>
        <div class="tbp-card tbp-pickpart"><div class="tbp-pt">✂️ Pick the ${v.clip} seconds they’ll hear first</div>
          <div class="tbp-tl"><span class="win ${SP.playing ? 'on' : ''}" style="left:${a}%;width:${w}%"></span></div>
          <input type="range" id="tbp-start" min="0" max="${max}" step="0.5" value="${st}" aria-label="Clip start">
          <div class="tbp-tlab"><span>0:00</span><b>starts at 0:${String(Math.floor(st)).padStart(2, '0')}</b><span>0:30</span></div>
          <div class="tbp-row"><button class="tbp-btn ghost" id="tbp-hear">${SP.playing ? '⏹ Stop' : `▶ Hear the ${v.clip} s`}</button><button class="tbp-btn ghost" id="tbp-more">🎧 Hear more</button></div>
          <p class="tbp-tip">Make it fun-hard: skip the chorus, start mid-riff. If nobody gets it, you get nothing!</p></div>
        <div class="tbp-row"><button class="tbp-btn ghost" id="tbp-back">↩ Pick another</button><button class="tbp-btn big" id="tbp-add">✅ Add this song</button></div>`, 'draft');
      const r = document.getElementById('tbp-start');
      if (r) { r.oninput = () => { SP.start = Number(r.value); stopPreview(); const win = document.querySelector('.tbp-tl .win'); if (win) win.style.left = (SP.start / 30) * 100 + '%'; const b = document.querySelector('.tbp-tlab b'); if (b) b.textContent = 'starts at 0:' + String(Math.floor(SP.start)).padStart(2, '0'); }; r.onchange = () => { ctx.haptic('select'); hear(ctx, SP.start, v.clip); }; }
      const on = (id, fn) => { const b = document.getElementById(id); if (b) b.onclick = fn; };
      on('tbp-hear', () => { if (SP.playing) { stopPreview(); ctx.redraw(); } else { ctx.haptic('tap'); hear(ctx, SP.start, v.clip); } });
      on('tbp-more', () => { ctx.haptic('tap'); hear(ctx, SP.start, Math.min(12, 30 - SP.start)); });
      on('tbp-back', () => { stopPreview(); SP.draft = null; ctx.redraw(); });
      on('tbp-add', async () => {
        const r2 = await ctx.act({ op: 'add', id: d.id, start: Math.min(SP.start, max) });
        if (r2 && r2.ok) { stopPreview(); SP.draft = null; SP.results = null; SP.q = ''; ctx.haptic('success'); ctx.sfx && ctx.sfx('chime'); ctx.redraw(); }
      });
      return;
    }
    const mine = v.mine.length ? `<div class="tbp-mine">${v.mine.map((m) => `<div class="tbp-ms">${art(m, 'tbp-thumb')}<span class="t"><b>${esc(m.title)}</b><small>${esc(m.artist)} · from 0:${String(Math.floor(m.start)).padStart(2, '0')}</small></span><button class="tbp-x" data-rm="${esc(m.key)}" aria-label="Remove">✕</button></div>`).join('')}</div>` : '';
    if (need <= 0) {
      feel(ctx, 'allset', 'success');
      paint(`<div class="tbp-card tbp-done"><div class="tbp-ic">✅</div><h2>You’re all set!</h2><p class="muted">${v.ready} of ${v.players} ready · ${timer('ps', v.endsIn)}</p></div>${mine}<p class="tbp-hint">Changed your mind? Remove one and pick another.</p>`, 'set');
    } else {
      feel(ctx, 'submit', 'turn');
      const res = SP.results ? (SP.results.length ? SP.results.map((r) => `<button class="tbp-res" data-pick="${esc(r.id)}">${art(r, 'tbp-thumb')}<span class="t"><b>${esc(r.title)}</b><small>${esc(r.artist)}${r.explicit ? ' · 🅴' : ''}</small></span><span class="go">›</span></button>`).join('') : '<p class="tbp-hint">No songs found. Try other words.</p>') : '';
      paint(`<div class="tbp-card tbp-sub"><div class="tbp-rn">REQUEST LINE · ${timer('ps', v.endsIn)}</div><h2>Add ${need} more song${need === 1 ? '' : 's'}</h2>
          <p class="muted">Something the room might know… but not instantly.</p></div>
        <form class="tbp-search" id="tbp-sf"><input id="tbp-q" type="search" maxlength="300" autocomplete="off" enterkeyhint="search" placeholder="Song, artist, or a Spotify link" value="${esc(SP.q)}"><button class="tbp-btn" ${SP.busy ? 'disabled' : ''}>${SP.busy ? '…' : '🔎'}</button></form>
        <div class="tbp-src">${v.spotify ? 'Search songs (Spotify)' : 'Search songs'} · paste a Spotify link to add it directly</div>
        ${SP.msg ? `<p class="tbp-msg">${esc(SP.msg)}</p>` : ''}<div class="tbp-results">${res}</div>${mine}`, 'search');
      const f = document.getElementById('tbp-sf'), q = document.getElementById('tbp-q');
      if (q) q.oninput = () => { SP.q = q.value; };
      if (f) f.onsubmit = async (e) => {
        e.preventDefault(); if (SP.busy) return;
        SP.q = q.value.trim(); if (SP.q.length < 2) { SP.msg = 'Type a song or an artist.'; ctx.redraw(); return; }
        q.blur(); SP.busy = true; SP.msg = ''; ctx.redraw();
        const r = await ctx.actAsync({ op: 'search', q: SP.q });
        SP.busy = false;
        if (r && r.ok) { SP.results = r.results; SP.msg = r.note || ''; } else { SP.msg = (r && r.error) || 'Search failed. Try again.'; ctx.haptic('error'); }
        ctx.redraw();
      };
      for (const b of document.querySelectorAll('[data-pick]')) b.onclick = async () => {
        if (SP.busy) return; ctx.haptic('select'); SP.busy = true; SP.msg = ''; ctx.redraw();
        const r = await ctx.actAsync({ op: 'pick', id: b.dataset.pick });
        SP.busy = false;
        if (r && r.ok) { SP.draft = r.song; SP.start = Math.min(8, v.maxStart); pv().src = r.song.preview; } else { SP.msg = (r && r.error) || 'Couldn’t load that one.'; ctx.haptic('error'); }
        ctx.redraw();
      };
    }
    for (const b of document.querySelectorAll('[data-rm]')) b.onclick = async () => { const r = await ctx.act({ op: 'remove', key: b.dataset.rm }); if (r && r.ok) { ctx.haptic('tap'); felt.allset = false; } };
  }
  function phGuess(v, ctx, paint) {
    const m = v.my, ci = v.clipInfo || { listens: [] };
    if (GF.n !== v.n || (!GF.t0 && ci.t0In != null)) { GF.n = v.n; GF.text = ''; GF.kind = ''; GF.t0 = ci.t0In != null ? Date.now() + ci.t0In : 0; GF.end = ci.endIn != null ? Date.now() + ci.endIn : 0; }
    if (v.isMine) {
      feel(ctx, 'mine' + v.n, 'big');
      paint(`<div class="tbp-card tbp-minecard">${art(v.song, 'tbp-art')}<h2>Your song is on!</h2><p><b>${esc(v.song.title)}</b><br><span class="muted">${esc(v.song.artist)}</span></p>
        <p class="tbp-big">${v.gotCount}<small> of ${v.eligible} got it</small></p><p class="muted">Sweet spot = some, not all. Fingers crossed! 🤞</p></div>`, 'mine');
      return;
    }
    const singerOpen = !m.artist && (m.singerLeft == null || m.singerLeft > 0);
    const singerRow = (withBtn) => m.artist ? '<div class="tbp-singer done">🎤 Singer ✓ <b>+50</b></div>'
      : singerOpen ? `<label class="tbp-singer"><span>🎤 Singer <small>bonus +50 · ${m.singerLeft == null ? 3 : m.singerLeft} tries</small></span><span class="tbp-srow"><input id="tbp-s" type="text" maxlength="80" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="Who sings it? (optional)">${withBtn ? '<button class="tbp-btn" id="tbp-sgo" type="button">Check</button>' : ''}</span></label>` : '';
    const feedback = (r, text, singer) => {
      if (r.artist) { GF.text = r.right ? '🎤 Singer right too! +50' : '🎤 Right singer! +50'; GF.kind = 'artist'; ctx.haptic('select'); }
      else if (r.right) GF.text = '';
      else if (text) { GF.text = `✖ “${text.slice(0, 40)}” isn’t it${r.singerWrong ? ' (and not the singer)' : ''}`; GF.kind = 'no'; ctx.haptic('error'); }
      else if (r.singerWrong) { GF.text = `✖ Not “${singer.slice(0, 30)}”`; GF.kind = 'no'; ctx.haptic('error'); }
    };
    if (m.got) {
      feel(ctx, 'got' + v.n, 'success');
      paint(`<div class="tbp-card tbp-res good"><div class="tbp-ic">🎉</div><h2>You got it!</h2><p class="tbp-big">+${m.base}</p><p class="muted">× the difficulty, once everyone rates it</p><p>${m.order === 1 ? '<span class="tbp-gold">⚡ FIRST!</span>' : `#${m.order} to get it`}</p></div>
        ${singerRow(true)}${GF.text && GF.kind !== 'no-title' ? `<div class="tbp-fb ${esc(GF.kind)}">${esc(GF.text)}</div>` : ''}`, 'got' + (m.artist ? 'a' : '') + (m.singerLeft || 0));
      const sb = document.getElementById('tbp-sgo'), si = document.getElementById('tbp-s');
      const go = async () => { const singer = si.value.trim(); if (!singer) return; const r = await ctx.act({ op: 'guess', singer }); if (!r || !r.ok) return; si.value = ''; feedback(r, '', singer); ctx.redraw(); };
      if (sb) sb.onclick = go; if (si) si.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
      return;
    }
    if (m.left <= 0) {
      feel(ctx, 'out' + v.n, 'warn');
      paint(`<div class="tbp-card tbp-res bad"><div class="tbp-ic">🙊</div><h2>Out of guesses</h2><p class="muted">Listen for it at the reveal…</p></div>`, 'out');
      return;
    }
    feel(ctx, 'guess' + v.n, 'turn');
    paint(`<div class="tbp-gh"><span>${chipLite(v.by)}’s pick</span><span>⏰ ${timer('pg' + v.n, v.endsIn)}</span></div>
      <div class="tbp-worth">Worth <b ${GF.t0 ? `data-wt0="${GF.t0}" data-wend="${GF.end}"` : ''}>${ci.worth || 300}</b> × difficulty</div>
      <form class="tbp-guess" id="tbp-gf"><label class="tbp-tl">🎵 Song title</label><input id="tbp-g" type="text" maxlength="80" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="Just the name of the song">${singerRow(false)}<button class="tbp-btn big"${(() => { const pt = buzzPaint(v); return pt ? ` style="background:${buzzBg(pt)};box-shadow:0 4px 0 ${pt.b}${pt.glow ? ', 0 0 18px ' + pt.a : ''};text-shadow:0 2px 3px #000a"` : ''; })()}>${(buzzPaint(v) || {}).icon ? esc(buzzPaint(v).icon) + ' ' : ''}Guess</button></form>
      ${GF.text ? `<div class="tbp-fb ${esc(GF.kind)}">${esc(GF.text)}</div>` : ''}
      <div class="tbp-tries">${'●'.repeat(m.left)}${'○'.repeat(Math.max(0, m.tries))} <small>${m.left} guess${m.left === 1 ? '' : 'es'} left</small></div>
      <p class="tbp-hint">Just the song’s name: typos, capitals, punctuation (’ . ! ?), brackets, “feat.” and “the” don’t matter.</p>`, 'guess');
    const f = document.getElementById('tbp-gf'), inp = document.getElementById('tbp-g');
    if (f) f.onsubmit = async (e) => {
      e.preventDefault(); const si = document.getElementById('tbp-s'), text = inp.value.trim(), singer = si ? si.value.trim() : '';
      if (!text && !singer) return;
      const r = await ctx.act({ op: 'guess', text, singer });
      if (!r || !r.ok) return;
      inp.value = ''; if (si && (r.artist || r.singerWrong)) si.value = '';
      if (r.right) { ctx.haptic('success'); ctx.sfx && ctx.sfx('chime'); inp.blur(); }
      feedback(r, text, singer);
      ctx.redraw();
    };
  }
  const chipLite = (x) => `<span class="tbp-who" style="--c:${esc(x.color || '#ff3d8b')}">${av(x)} ${esc(x.name)}</span>`;
  function phReveal(v, ctx, paint) {
    const m = v.my, so = v.song;
    const head = `<div class="tbp-card tbp-songcard">${art(so, 'tbp-art')}<h2>${esc(so.title)}</h2><p class="muted">${esc(so.artist)} · ${chipLite(v.by)}’s pick</p>
      ${v.isMine ? `<p>${v.gotCount} of ${v.eligible} got it</p>` : m.got ? `<p class="tbp-gold">✓ You got it: +${m.base} × difficulty</p>` : '<p class="muted">You didn’t get this one.</p>'}</div>`;
    if (v.isMine) {
      feel(ctx, 'rv' + v.n, v.gotCount && v.gotCount < v.eligible ? 'success' : 'select');
      paint(`${head}<div class="tbp-card"><h2>They’re rating your song…</h2><p class="muted">The harder they say it was, the more everyone scores. Nobody got it? Then you get 0.</p></div>`, 'rv-mine');
      return;
    }
    feel(ctx, 'rv' + v.n, m.got ? 'success' : 'error');
    paint(`${head}<div class="tbp-rq">${m.rating ? 'Thanks! Change your mind?' : 'How hard was it to guess?'}</div>
      <div class="tbp-rates">${v.rates.map((r) => `<button class="tbp-rate ${m.rating === r.n ? 'sel' : ''}" data-rate="${r.n}"><i>${r.icon}</i><b>${r.n}</b><span>${esc(r.label)}</span></button>`).join('')}</div>`, 'rv');
    for (const b of document.querySelectorAll('[data-rate]')) b.onclick = async () => { const r = await ctx.act({ op: 'rate', n: Number(b.dataset.rate) }); if (r && r.ok) ctx.haptic('select'); };
  }
  function phScore(v, ctx, paint) {
    const R = v.result, r = rateOf(R.d);
    let body;
    if (R.dj) { const V = VERDICT[R.dj.kind]; body = `<div class="tbp-ic">${V.icon}</div><h2>${V.title}</h2><p class="muted">${V.text}</p><p class="tbp-big">+${R.dj.pts}</p>${R.dj.mult ? `<p class="muted">${R.dj.mult} × ${R.d.toFixed(1)} difficulty</p>` : ''}`; feel(ctx, 'sc' + v.n, R.dj.kind === 'sweet' ? 'big' : R.dj.pts ? 'select' : 'error'); }
    else if (R.mine) { body = `<div class="tbp-ic">🎉</div><h2>+${R.mine}</h2><p class="muted">${R.base} × ${R.d.toFixed(1)} difficulty</p>`; feel(ctx, 'sc' + v.n, 'success'); }
    else { body = `<div class="tbp-ic">🎧</div><h2>+0 this time</h2><p class="muted">Next song coming up!</p>`; feel(ctx, 'sc' + v.n, 'tap'); }
    paint(`<div class="tbp-card tbp-res ${R.mine || (R.dj && R.dj.pts) ? 'good' : 'bad'}">${body}</div><div class="tbp-diff">Difficulty <b>${R.d.toFixed(1)}</b> ${r.icon} ${esc(r.label)}</div>`, 'score');
  }
  function phone(el, v, ctx, full) {
    if (!v) return;
    const head = `<div class="tbp-head"><span>🎧 <b>${v.points}</b> pts${v.rank ? ` · #${v.rank}` : ''}</span><span>${v.phase === 'submit' ? 'Requests' : `Song ${v.n}/${v.of}`}</span></div>`;
    const paint = (html, key) => BOX.morph(el, `<div class="tbp" id="tbp-${esc(key)}">${head}${html}</div>`);
    if (v.phase !== 'submit' && (SP.draft || SP.playing)) { stopPreview(); SP.draft = null; }
    if (v.phase === 'over') {
      const f = v.final || { awards: {}, standings: [] }, A = f.awards || {}, me = full && full.me ? full.me.name : '';
      feel(ctx, 'over', v.rank === 1 ? 'win' : 'success');
      const mine = [[A.ear, '👂 Golden Ear'], [A.fast, '⚡ Quickest Ear'], [A.dj, '🎯 Sweet Spot DJ']].filter(([a]) => a && a.names.includes(me)).map(([, l]) => l);
      if (A.deep && A.deep.name === me) mine.push('🔥 Deepest Cut');
      paint(`<div class="tbp-card tbp-end"><div class="tbp-place">${v.rank === 1 ? '🏆' : v.rank === 2 ? '🥈' : v.rank === 3 ? '🥉' : '🎧'}</div><h2>#${v.rank} of ${v.ofPlayers}</h2><p class="tbp-big">${v.points} points</p>${mine.length ? `<div class="tbp-awards">${mine.map((m) => `<span>${m}</span>`).join('')}</div>` : ''}</div>
        <div class="tbp-card">${BOX.board((f.standings || []).slice(0, 8), (r) => r.points, ' pts')}</div>`, 'over');
      return;
    }
    if (felt.over) felt = {};
    if (v.phase === 'submit') return phSubmit(v, ctx, paint);
    if (v.phase === 'card') {
      feel(ctx, 'card' + v.n, v.isMine ? 'big' : 'turn');
      paint(`<div class="tbp-card tbp-intro"><div class="tbp-ic">💿</div><div class="tbp-rn">SONG ${v.n} OF ${v.of}</div><h2>${v.isMine ? 'It’s YOUR song!' : `${esc(v.by.name)}’s pick`}</h2>
        <p class="tbp-tip">${v.isMine ? '🎧 You sit this one out. Watch them squirm!' : '⌨️ Get ready to type the title. Fast = more points!'}</p></div>`, 'card');
      return;
    }
    if (v.phase === 'guess') return phGuess(v, ctx, paint);
    if (v.phase === 'reveal' && v.song) return phReveal(v, ctx, paint);
    if (v.phase === 'score' && v.result) return phScore(v, ctx, paint);
    paint('<div class="tbp-card"><h2>Next track coming up…</h2></div>', 'wait');
  }

  BOX.games.tune = {
    name: 'Tune Buzz', icon: '🎵', lobbyTv,
    // Music: a soft groove while songs come in; silence while a song plays (it IS the music).
    music: (s) => { const m = { submit: 'think', card: null, guess: null, reveal: null, score: 'reveal', over: 'finale' }; return s.phase in m ? m[s.phase] : 'play'; },
    about: 'Name that tune, with songs you bring! Everyone adds songs from their phone and picks a few tricky seconds. Guess fast, then rate how hard it was: harder songs pay more.',
    how: [
      'Add songs from your phone: search for anything (or paste a Spotify link), then pick the few seconds everyone hears first.',
      'Each song: the TV plays your clip. Each listen is a bit longer. Type the title on your phone: typos are fine.',
      'Fast is worth more: 300 points at the first note, down to 100 at the buzzer. Naming the artist too is +50.',
      'Then everyone rates how hard it was: 1 🍼 Too easy to 5 🔥 Impossible. Guessers’ points are multiplied by the average.',
      'Your own songs: you sit out. If some (not all) got it you score 150 × difficulty. Everyone got it: 50 ×. Nobody: 0.',
      'Pick songs that are fun-hard, not impossible. Top of the charts wins!',
    ],
    fx: { round: 'pop', clip: 'tick', right: 'chime', artist: 'pop', reveal: 'reveal', nobody: 'shrug', score: 'pop', sweet: 'win', added: 'pop', win: 'win' },
    tv, phone,
    _test: { seekPlay, rateOf },
  };
})();
