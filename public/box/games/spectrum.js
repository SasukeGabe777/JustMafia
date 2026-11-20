'use strict';
// Where Do You Stand? screens. TV: the spectrum card, a "locked in" counter, then every dot slides
// onto one big line (clusters, extremes, the room average); in Read-a-Friend rounds the guesses land
// first and the spotlight's own dot drops in last. End: everyone's twin tonight, the most alike
// pair crowned, and awards. Phone: a big drag slider between the two ends, then your own twin and
// opposite at the end ("Go find Sam — your opposite!").
(function () {
  const { esc, mmss } = BOX;
  // The game's own stylesheet (prefixed sp-), loaded once on whichever page shows the game.
  if (!document.querySelector('link[data-sp-css]')) {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/box/games/spectrum.css'; l.dataset.spCss = '1';
    document.head.appendChild(l);
  }
  // Phone-side state that must survive the shell re-rendering (~6×/s).
  let val = 50, valKey = '', dragging = false, celebrated = '', editKey = '';
  // A countdown whose end time stays fixed for one phase, so identical renders can be skipped.
  const ends = {};
  const timer = (key, endsIn) => { if (!endsIn) return ''; if (!ends[key]) ends[key] = Date.now() + endsIn; return `<span class="timer sp-timer" data-ends="${ends[key]}">${mmss(ends[key] - Date.now())}</span>`; };
  const dot = (c) => `<i class="sp-cdot" style="background:${esc(c || '#888')}"></i>`;
  // Players as their JustGameBox character (public/box/portrait.js), or their emoji without one.
  const has = (x) => !!(x && BOX.hasLook && BOX.hasLook(x));
  const face = (x, n, o) => (BOX.face ? BOX.face(x, n, o) : esc((x && x.avatar) || '🙂'));
  const av = (x, n = 28) => (x && (x.avatar || has(x)) ? face(x, n, { cls: 'sp-af' }) + ' ' : '');
  const fboard = (rows, val, label = '') => `<div class="board">${rows.map((r, i) => `<div class="row"><span class="n">${i + 1}</span><span>${av(r, 30)}${esc(r.name)}</span><b>${esc(val(r))}${label}</b></div>`).join('')}</div>`;
  // A head on the hills (lobby and in-game): their face fills the round marker.
  const hd = (p) => (has(p) ? `<span class="hd has-face">${face(p, 64, { fill: true, cls: 'sp-hf' })}</span>` : `<span class="hd">${esc(p.avatar || '🙂')}</span>`);
  const who = (x) => (x && x.name ? `${dot(x.color)}<b>${av(x)}${esc(x.name)}</b>` : `${dot(x && x.color)}<b>someone</b>`);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const clampPct = (x) => Math.max(0, Math.min(100, x));
  // Haptics (ctx.haptic on new phones; a plain vibration otherwise). feel() buzzes once per moment.
  function haptic(ctx, kind) { try { if (ctx.haptic) ctx.haptic(kind); else ctx.vibrate(kind === 'tap' ? 8 : 40); } catch { /* no vibration */ } }
  let felt = {};
  const feel = (ctx, chan, key, kind) => { if (felt[chan] === key) return; felt[chan] = key; haptic(ctx, kind); };
  // Update in place (BOX.morph). Each phase of each round gets its own root id, so its entrance
  // animations play once and re-renders within the phase never restart them.
  function paint(el, html, key) {
    if (el._spKey === key && el._spHtml === html) return false;
    el._spKey = key; el._spHtml = html;
    BOX.morph(el, `<div class="sp-root" id="sp-${esc(key)}">${html}</div>`);
    return true;
  }
  const specLine = (sp) => `${sp.t ? esc(sp.t) + ': ' : ''}${esc(sp.l)} ↔ ${esc(sp.r)}`;
  function card(sp, cls = '') {
    if (!sp) return '';
    return `<div class="sp-card ${cls}">${sp.t ? `<div class="sp-title">${esc(sp.t)}</div>` : ''}
      <div class="sp-ends-row"><div class="sp-end l"><span class="sp-emo">${esc(sp.le)}</span><span class="sp-lab">${esc(sp.l)}</span></div>
      <div class="sp-arrow">↔</div><div class="sp-end r"><span class="sp-lab">${esc(sp.r)}</span><span class="sp-emo">${esc(sp.re)}</span></div></div></div>`;
  }
  const endsBar = (sp) => `<div class="sp-endsbar"><span>${esc(sp.le)} ${esc(sp.l)}</span><span>${esc(sp.r)} ${esc(sp.re)}</span></div>`;
  const mood = (sp, x) => (x <= 10 ? `All the way: ${esc(sp.l)} ${esc(sp.le)}` : x <= 38 ? `Leaning ${esc(sp.l)} ${esc(sp.le)}` : x < 62 ? 'Right in the middle 🤷' : x < 90 ? `Leaning ${esc(sp.r)} ${esc(sp.re)}` : `All the way: ${esc(sp.r)} ${esc(sp.re)}`);

  // ---------- the big line on the TV ----------
  // Stack dots into rows so names never overlap. With names: up to 7 rows, else fall back to dots.
  function stack(dots, labelled) {
    const maxRows = labelled ? 7 : 14, rowEnd = [], out = [];
    for (const d of dots.slice().sort((a, b) => a.pos - b.pos)) {
      const w = labelled ? Math.min(17, 3.2 + String(d.name || '').length * 0.95) : 1.9;
      let row = rowEnd.findIndex((e) => e <= d.pos - w / 2);
      if (row < 0) {
        if (rowEnd.length < maxRows) row = rowEnd.length;
        else if (labelled) return null;
        else row = rowEnd.indexOf(Math.min(...rowEnd));
      }
      rowEnd[row] = d.pos + w / 2; out.push({ ...d, row });
    }
    return { out, rows: Math.max(1, rowEnd.length) };
  }
  // Recorded sound effects (public/audio/sfx/spectrum/, CC0, see credits.json there): a soft woodblock
  // tock as each dot lands on the line (pitched and panned by where it lands), a snare roll for Read a
  // Friend and a small cheer for a cluster. warm() decodes them once (silently) as soon as audio is
  // unlocked so the first one is on time.
  const REC = ['tock', 'drumroll', 'cheer'];
  let recWarm = false, drops = [];
  const rec = (f, o) => !!(BOX.audio && BOX.audio.clip && BOX.audio.clip('spectrum/' + f + '.ogg', o));
  const warm = () => { if (!recWarm && rec(REC[0], { vol: 0, gap: 0 })) { recWarm = true; for (const f of REC.slice(1)) rec(f, { vol: 0, gap: 0 }); } };
  function tocks() {
    const every = Math.ceil(drops.length / 14); // at most ~14 taps, however big the room
    drops.forEach(([t, pos], i) => { if (i % every === 0) rec('tock', { vol: 0.12, delay: t / 1000 + 0.38, rate: 0.8 + pos / 200, pan: (pos - 50) / 70, gap: 0 }); }); // spSlide lands ~0.38 s in
  }
  function field(dots, { names, start = 300, spread = 2200 }) {
    let labelled = names && dots.length <= 30 && dots.every((d) => d.name);
    let st = labelled ? stack(dots, true) : null;
    if (!st) { labelled = false; st = stack(dots, false); }
    const rowH = labelled ? 36 : 20, step = dots.length ? Math.min(140, spread / dots.length) : 0;
    drops = st.out.map((d, i) => [Math.round(start + i * step), d.pos]); // when each dot lands, for its sound
    const html = st.out.map((d, i) => {
      const delay = Math.round(start + i * step), style = `left:${d.pos}%;bottom:${d.row * rowH + 4}px;--c:${esc(d.color)};animation-delay:${delay}ms`;
      return labelled ? `<div class="sp-pin ${has(d) ? 'has-face' : ''}" style="${style}">${has(d) ? face(d, 28, { cls: 'sp-pf' }) : '<i></i>'}<span>${esc(d.name)}</span></div>` : `<div class="sp-pip" style="${style}"></div>`;
    }).join('');
    return { html, height: Math.max(90, st.rows * rowH + 18), done: start + dots.length * step + 600 };
  }

  function revealNormal(s) {
    const res = s.result, sp = s.spec, f = field(res.dots, { names: s.names });
    const after = f.done;
    const c = res.cluster;
    const splitLine = res.split ? `<div class="sp-split" style="left:${res.split.at}%;animation-delay:${after + 200}ms"><span>⚔️</span></div>` : '';
    const band = c ? `<div class="sp-band" style="left:${clampPct(c.from - 2)}%;width:${Math.min(100, c.to - c.from + 4)}%;animation-delay:${after}ms"><span>🤝 ${c.all ? `All ${res.count} of you, together!` : c.side ? `${c.count} on Team ${esc(c.side)}!` : `${c.count} of you, right in the middle!`}</span></div>` : '';
    const avg = res.avg != null ? `<div class="sp-avg" style="left:${res.avg}%;animation-delay:${after + 500}ms"><span>Room average · ${res.avg}</span></div>` : '';
    const ext = [];
    if (res.lo) ext.push(`<div class="sp-ext lo" style="left:${res.lo.pos}%;animation-delay:${after + 900}ms">⬅️ Most “${esc(sp.l)}”: ${who(res.lo)}</div>`);
    if (res.hi) ext.push(`<div class="sp-ext hi" style="left:${res.hi.pos}%;animation-delay:${after + 1100}ms">Most “${esc(sp.r)}”: ${who(res.hi)} ➡️</div>`);
    const notes = [];
    if (res.dozed) notes.push('😴 The spotlight dozed off, so everyone got to play this one!');
    if (res.left) notes.push('👋 The spotlight had to leave, so everyone got to play this one!');
    if (!res.count) notes.push('🤷 Nobody placed a dot this time. Mysterious bunch!');
    if (res.pair) notes.push(`🧲 Nearest neighbours: ${res.pair.a ? `<b>${esc(res.pair.a)}</b> &amp; <b>${esc(res.pair.b)}</b>` : 'two of you'} ${res.pair.gap === 0 ? '— the exact same spot! 🤯' : `— just ${res.pair.gap} apart!`} <span class="muted">(+25 each)</span>`);
    if (res.count >= 2) notes.push(`🎯 ${res.nearAvg} ${res.nearAvg === 1 ? 'person' : 'people'} within 10 of the room average <span class="muted">(+50 · “you get this room”)</span>`);
    if (res.split) notes.unshift(`⚔️ <b>Split room!</b> ${res.split.left} lean “${esc(sp.l)}”, ${res.split.right} lean “${esc(sp.r)}”. Discuss!`);
    if (res.hotTake) notes.unshift(`🌶️ <b>Hot take!</b> ${who(res.hotTake)} stands alone at ${res.hotTake.pos}, ${res.hotTake.gap} away from anyone else.`);
    if (res.whisperers) notes.push(`🔮 ${plural(res.whisperers, 'Crowd Whisperer')} guessed the room average within 5 <span class="muted">(+75)</span>`);
    else if (res.count >= 3 && s.n <= 3) notes.push('<span class="muted">🔮 Tip: after you lock in, guess where the room average lands for +75.</span>');
    return `${card(sp, 'small')}
      <div class="sp-stage"><div class="sp-rail">${band}${splitLine}${avg}<div class="sp-field" style="height:${f.height}px">${f.html}</div><div class="sp-line"></div><div class="sp-under">${ext.join('')}</div></div>${endsBar(sp)}</div>
      <div class="sp-notes" style="animation-delay:${after + 1300}ms">${notes.map((n) => `<div>${n}</div>`).join('')}</div>`;
  }
  function revealRead(s) {
    const res = s.result, sp = s.spec, spot = s.spot || { name: '?', color: '#888' };
    const f = field(res.guesses, { names: s.names, start: 200, spread: 1600 });
    const drop = Math.max(2900, f.done + 200);
    const zone = `<div class="sp-zone" style="left:${clampPct(res.target - 15)}%;width:${clampPct(res.target + 15) - clampPct(res.target - 15)}%;animation-delay:${drop + 400}ms"><span>📖 open-book zone</span></div>`;
    const target = `<div class="sp-target" style="left:${res.target}%;--c:${esc(spot.color)};animation-delay:${drop}ms"><span>🔦 ${esc(spot.name)} · ${res.target}</span>${has(spot) ? `<i class="has-face">${face(spot, 64, { fill: true, cls: 'sp-hf', mood: 'grin' })}</i>` : '<i></i>'}</div>`;
    const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
    const podium = res.top.length ? res.top.map((g, i) => `<div class="sp-prow" style="animation-delay:${drop + 900 + i * 250}ms">${medals[i]} ${who(g)} <span class="muted">guessed ${g.pos} · off by ${g.err}</span> <b>+${g.pts}</b>${g.bull ? ' <span class="sp-bull">🎯 BULLSEYE</span>' : ''}</div>`).join('') : '<div class="muted">Nobody guessed! 🤷</div>';
    return `${card(sp, 'small')}
      <div class="sp-readhead">Where does ${who(spot)} stand? <span class="sp-ans" style="animation-delay:${drop}ms">→ <b>${res.target}</b> ${esc(res.target < 50 ? sp.le : res.target > 50 ? sp.re : '🤷')}</span></div>
      <div class="sp-stage"><div class="sp-drum" style="animation-delay:${drop - 300}ms">🥁</div><div class="sp-rail">${zone}<div class="sp-field" style="height:${f.height + 30}px">${f.html}${target}</div><div class="sp-line"></div><div class="sp-under"></div></div>${endsBar(sp)}</div>
      <div class="sp-readfoot" style="animation-delay:${drop + 700}ms"><div class="sp-podium">${podium}</div>
        <div class="sp-book">📖 ${plural(res.readers, 'person')} read ${esc(spot.name)} within 15${res.readers ? ` <b>+${res.readers * 50}</b>` : ''}${res.avgGuess != null ? `<div class="muted">The room guessed ${res.avgGuess} on average</div>` : ''}</div></div>`;
  }

  // ---------- the end: twins ----------
  function finalTv(s) {
    const f = s.final;
    if (!f) return '';
    const [crown, ...rest] = f.pairs;
    const pairCard = (p, i) => `<div class="sp-pair ${p.mutual ? 'mutual' : ''}" style="animation-delay:${1.6 + i * 0.12}s;--a:${esc(p.a.color)};--b:${esc(p.b.color)}">
      <div class="sp-pn">${dot(p.a.color)}${esc(p.a.name)}</div><div class="sp-link">🔗 <b>${p.pct}%</b> alike${p.mutual ? ' 💞' : ''}</div><div class="sp-pn">${dot(p.b.color)}${esc(p.b.name)}</div></div>`;
    const awards = [];
    if (f.unique) awards.push(['🦄', 'Most Unique', who(f.unique), `only ${f.unique.pct}% like the average person here`]);
    if (f.mind) awards.push(['🔮', 'Mind Reader', who(f.mind), `off by just ${f.mind.err} on average`]);
    if (f.book) awards.push(['📖', 'Open Book', who(f.book), `${f.book.readers} of ${f.book.of} read them right`]);
    if (f.whisper) awards.push(['🔮', 'Crowd Whisperer', who(f.whisper), `guessed the room average ${plural(f.whisper.hits, 'time')}`]);
    return `<div class="sp-over"><h1 class="sp-h">🔗 Tonight’s Twins</h1>
      ${crown ? `<div class="sp-crown"><div class="sp-crown-ic">👑</div><div class="muted">The most alike pair in the room</div>${has(crown.a) || has(crown.b) ? `<div class="sp-twins">${BOX.body(crown.a, 170, { mood: 'grin' })}<span>🔗</span>${BOX.body(crown.b, 170, { mood: 'grin', flip: true })}</div>` : ''}
        <div class="sp-crown-names">${who(crown.a)} <span class="sp-heart">🔗</span> ${who(crown.b)}</div><div class="sp-crown-pct">${crown.pct}% alike</div>
        ${crown.about ? `<div class="muted">They agreed the most on “${esc(crown.about)}”</div>` : ''}</div>` : '<div class="big-status">Play a few rounds to find your twins!</div>'}
      ${rest.length ? `<div class="sp-pairs">${rest.map(pairCard).join('')}</div>` : ''}${f.more ? `<div class="muted sp-more">+${f.more} more twin pairs: check your phones!</div>` : ''}
      ${awards.length ? `<div class="sp-awards">${awards.map(([ic, t, nm, txt], i) => `<div class="sp-award" style="animation-delay:${2.4 + i * 0.35}s"><div class="ic">${ic}</div><div class="t">${t}</div><div class="nm">${nm}</div><div class="muted">${txt}</div></div>`).join('')}</div>` : ''}
      <div class="sp-final-board"><h3>Points</h3>${fboard(s.standings, (r) => r.points, ' pts')}</div></div>`;
  }

  // Everyone standing on the hills during a round; a check pops up once they lock in.
  function horizon(s, ctx) {
    const all = (ctx && ctx.players) || [];
    if (!all.length || s.phase === 'reveal' || s.phase === 'over') return '';
    const n = all.length, wait = s.waiting ? new Set(s.waiting) : null, spot = s.spot && s.spot.name;
    return `<div class="sp-horizon"><div class="spl-htrack"></div><div class="spl-people ingame ${n > 12 ? (n > 28 ? 'lots' : 'many') : ''}">${all.map((p, i) => `<span class="chip ${wait && !wait.has(p.name) ? 'in' : ''} ${spot === p.name ? 'spot' : ''}" style="left:${(((i + 0.5) / n) * 100).toFixed(2)}%;--c:${esc(p.color || '#ff7a59')};--d:${((i * 0.37) % 2.6).toFixed(2)}s">${hd(p)}<b>${esc(p.name)}</b></span>`).join('')}</div></div>`;
  }

  // ---------- phone ----------
  const moodFor = (op, sp, x) => (op === 'avg' ? `🔮 Room average lands at <b>${x}</b>` : mood(sp, x));
  const lockText = (op, locked, done) => (op === 'avg' ? (locked ? 'Guess saved 🔮' : done != null ? 'Update my guess 🔮' : 'Save my guess 🔮') : locked ? 'Locked in ✅' : done != null ? 'Update my answer 🔒' : 'Lock it in 🔒');
  function slider(sp, op, color, done, hint) {
    const locked = done != null && done === val;
    return `<div class="sp-slider ${op === 'avg' ? 'avg' : ''}" id="sp-sl" data-op="${op}" style="--c:${esc(color)}">
      <div class="sp-mood" id="sp-mood">${moodFor(op, sp, val)}</div>
      <div class="sp-track" id="sp-track"><div class="sp-groove"></div><div class="sp-knob" id="sp-knob" style="left:${val}%"><span id="sp-val">${val}</span></div></div>
      <div class="sp-pends"><span><em>${esc(sp.le)}</em>${esc(sp.l)}</span><span><em>${esc(sp.re)}</em>${esc(sp.r)}</span></div></div>
      <div class="sp-nudge"><button class="btn ghost small" data-nudge="-5">◀ 5</button><button class="btn ghost small" data-nudge="-1">◀</button><button class="btn ghost small" data-nudge="1">▶</button><button class="btn ghost small" data-nudge="5">5 ▶</button></div>
      <button class="btn big ${op === 'avg' ? 'cyan' : 'green'} sp-lock ${locked ? 'done' : ''}" id="sp-lock">${lockText(op, locked, done)}</button>
      ${hint ? `<div class="muted sp-hint">${hint}</div>` : ''}`;
  }
  function bindSlider(el, v, ctx, sp, done) {
    const track = el.querySelector('#sp-track'); if (!track) return;
    const op = el.querySelector('#sp-sl').dataset.op;
    const knob = el.querySelector('#sp-knob'), num = el.querySelector('#sp-val'), md = el.querySelector('#sp-mood'), lock = el.querySelector('#sp-lock');
    const show = () => {
      knob.style.left = val + '%'; num.textContent = val; md.innerHTML = moodFor(op, sp, val);
      const locked = done != null && done === val;
      lock.classList.toggle('done', locked); lock.textContent = lockText(op, locked, done);
    };
    const at = (e) => { const r = track.getBoundingClientRect(); const x = Math.round(((e.clientX - r.left) / Math.max(1, r.width)) * 100); const was = val; val = Math.max(0, Math.min(100, x)); if (Math.floor(was / 10) !== Math.floor(val / 10) || (val !== was && (val === 0 || val === 100))) haptic(ctx, 'tap'); show(); };
    track.onpointerdown = (e) => { dragging = true; try { track.setPointerCapture(e.pointerId); } catch { /* old browser */ } at(e); e.preventDefault(); };
    track.onpointermove = (e) => { if (dragging) at(e); };
    const stop = () => { if (!dragging) return; dragging = false; haptic(ctx, 'select'); };
    track.onpointerup = stop; track.onpointercancel = stop; track.onlostpointercapture = stop;
    for (const b of el.querySelectorAll('[data-nudge]')) b.onclick = () => { val = Math.max(0, Math.min(100, val + Number(b.dataset.nudge))); show(); haptic(ctx, 'tap'); };
    lock.onclick = async () => {
      if (done != null && done === val) return;
      const r = await ctx.act({ op, pos: val });
      if (r && r.ok) { haptic(ctx, 'success'); ctx.sfx(op === 'avg' ? 'chime' : 'pop'); if (op === 'place') editKey = ''; ctx.redraw(); }
    };
  }
  // A small private line on the phone: my dot, the room average, and the rest as faint pips.
  function miniLine(sp, marks) {
    return `<div class="sp-mini"><div class="sp-mini-line">${marks.map((m) => `<div class="sp-mm ${m.cls || ''}" style="left:${m.pos}%;--c:${esc(m.color || '#fff')}">${m.label ? `<span>${m.label}</span>` : ''}</div>`).join('')}</div>${endsBar(sp)}</div>`;
  }

  // ---------- TV lobby: every setting is a little scale on the sky ----------
  // Tap a stop and the knob slides there. Players stand along the big horizon slider.
  // The real <select>s stay in #settings (visually hidden).
  const SCALE = {
    pack: { ic: '🎒', lab: 'Spectrum pack', wide: true, opts: { icebreaker: '🧊 Icebreaker', friends: '🍕 Friends', family: '🏡 Family', deep: '🌌 Deep thoughts', mix: '🎲 Mix' } },
    rounds: { ic: '🔁', lab: 'Rounds', opts: { 8: '8', 12: '12', 16: '16' } },
    seconds: { ic: '⏱️', lab: 'Time to place', opts: { 15: '15s', 20: '20s', 30: '30s' } },
    names: { ic: '🏷️', lab: 'Names on dots', opts: { on: '🏷️ Show names', off: '🙈 Shy mode' } },
    showIntro: { ic: '🌅', lab: 'Sunrise intro', opts: { true: '🎬 On', false: '⏩ Skip' } },
  };
  function lobbyTv(el, L) {
    el.__L = L;
    if (!el.__spl) {
      el.__spl = true;
      el.innerHTML = `<div class="spl">
        <div class="spl-logo"><span class="a">Where Do You</span><span class="b">Stand?</span><span class="spl-sl"><i></i></span></div>
        <section class="spl-scales" id="spl-scales"></section><div id="settings" class="spl-sr"></div>
        <aside class="spl-join"><div class="spl-jt">📱 Join on your phone!</div><img id="qr" alt="QR code to join"><div class="spl-url" id="spl-url"></div>
          <div class="spl-codecap">ROOM CODE</div><div class="spl-code" id="code"></div><div class="spl-vip" id="spl-vip"></div><div class="err" id="lobby-err"></div>
          <button class="spl-start" id="start">🧭 Find your spot</button>
          <div class="spl-links"><button id="add-bots">+ 5 test bots</button><button id="rm-bots">remove bots</button><button id="spl-pick">🎮 Other game</button></div></aside>
        <section class="spl-horizon"><div class="spl-htrack"></div><div class="spl-people" id="roster"></div><span class="spl-hend l">☀️ Morning person</span><span class="spl-count" id="spl-count"></span><span class="spl-hend r">Night owl 🦉</span></section>
        <div class="spl-party" id="spl-party"></div></div>`;
      const $ = (s) => el.querySelector(s);
      $('#start').onclick = async () => { const r = await el.__L.start(); $('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      $('#add-bots').onclick = () => el.__L.bots(5);
      $('#rm-bots').onclick = () => el.__L.removeBots();
      $('#spl-pick').onclick = () => el.__L.pick();
      el.addEventListener('click', (e) => {
        const k = e.target.closest('[data-k]');
        if (k) {
          const tr = k.parentNode, kn = tr.querySelector('.spl-knob'); if (kn) kn.style.left = k.style.left;
          for (const b of tr.querySelectorAll('.spl-stop')) b.classList.toggle('on', b === k);
          const s = el.querySelector(`select[data-set="${k.dataset.k}"]`); if (s) s.value = k.dataset.v;
          el.__L.set(k.dataset.k, k.dataset.v); if (!rec('tock', { vol: 0.3, rate: 1.1 })) BOX.sfx('pop'); return;
        }
        const c = e.target.closest('[data-kick]');
        if (c && confirm('Remove this player?')) el.__L.kick(c.dataset.kick);
      });
    }
    const $ = (s) => el.querySelector(s);
    if ($('#code').textContent !== L.code) $('#code').textContent = L.code;
    if ($('#qr').dataset.u !== L.joinUrl) { $('#qr').src = L.qr; $('#qr').dataset.u = L.joinUrl; }
    $('#spl-url').textContent = L.joinUrl.replace(/^https?:\/\//, '');
    const n = L.players.length;
    $('#start').disabled = n < L.min;
    $('#spl-vip').innerHTML = L.vip ? `👑 <b>${esc(L.vip)}</b> can start from their phone` : n < L.min ? `Need ${L.min - n} more player${L.min - n === 1 ? '' : 's'}…` : 'The first to join is the host 👑';
    $('#spl-count').textContent = n ? `${n} on the scale` : 'Nobody on the scale yet';
    const html = L.fields.map((f) => {
      const S = SCALE[f.key] || { ic: '⚙️', lab: f.label, opts: {} }, cur = String(L.settings[f.key]), m = f.options.length;
      const at = (i) => (m > 1 ? (i / (m - 1)) * 100 : 50), ci = Math.max(0, f.options.findIndex((o) => String(o.value) === cur));
      const curLab = f.options[ci] ? S.opts[String(f.options[ci].value)] || f.options[ci].label : '';
      return `<div class="spl-scale ${S.wide ? 'wide' : ''}"><div class="spl-lab"><span class="ic">${S.ic}</span>${esc(S.lab)}<span class="now">${esc(curLab)}</span></div>
        <div class="spl-track">${f.options.map((o, i) => `<button class="spl-stop ${i === ci ? 'on' : ''} ${i === m - 1 && m > 1 ? 'last' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}" title="${esc(o.label)}" style="left:${at(i)}%"><span>${esc(S.opts[String(o.value)] || o.label)}</span></button>`).join('')}<b class="spl-knob" style="left:${at(ci)}%"></b></div></div>`;
    }).join('');
    const sc = $('#spl-scales'); if (sc.__h !== html) { sc.__h = html; BOX.morph(sc, html); }
    const box = $('#settings'), sig = L.fields.map((f) => f.key + ':' + f.options.map((o) => o.value).join('|')).join(';');
    if (box.__sig !== sig) { box.__sig = sig; box.innerHTML = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}">${esc(o.label)}</option>`).join('')}</select></label>`).join(''); }
    for (const s of box.querySelectorAll('select[data-set]')) {
      if (document.activeElement !== s) s.value = String(L.settings[s.dataset.set]);
      s.onchange = () => { s.blur(); el.__L.set(s.dataset.set, s.value); };
    }
    // Everyone stands along the horizon, spread evenly; a newcomer makes room by sliding everyone over.
    const r = $('#roster');
    r.classList.toggle('many', n > 12 && n <= 28); r.classList.toggle('lots', n > 28);
    const rh = n ? L.players.map((p, i) => `<span class="chip ${p.online ? '' : 'off'} ${p.name === L.vip ? 'vip' : ''}" id="spl-p-${esc(p.id)}" data-kick="${esc(p.id)}" title="Click to remove" style="left:${(((i + 0.5) / n) * 100).toFixed(2)}%;--c:${esc(p.color || '#ff7a59')};--d:${((i * 0.37) % 2.6).toFixed(2)}s">${hd(p)}<b>${esc(p.name)}</b></span>`).join('')
      : '<div class="spl-empty">Scan the code and take your spot on the scale! 👇</div>';
    if (r.__h !== rh) { r.__h = rh; BOX.morph(r, rh); }
    const lp = $('#spl-party'), lh = L.lineupHtml || ''; if (lp.__h !== lh) { lp.__h = lh; lp.innerHTML = lh; }
  }

  BOX.games.spectrum = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => ({ intro: 'think', spot: 'think', place: 'play', guess: 'play', reveal: 'reveal', over: 'finale' }[s.phase] || 'play'),
    name: 'Where Do You Stand?', icon: '🧭', lobbyTv,
    about: 'Drag a marker to where YOU stand: morning person or night owl? Beach or mountains? See where everyone lands, read your friends, and meet your twin tonight.',
    how: [
      'A spectrum goes up on the big screen, like 🌅 Morning person ↔ Night owl 🌙.',
      'Drag the marker on your phone to where YOU stand, then lock it in. Nobody sees it until the reveal.',
      'Everyone’s dots slide onto one big line. +50 if you land within 10 of the room average, +25 for the closest pair.',
      'Every 3rd round is 🔦 READ A FRIEND: one person places themselves, everyone else guesses where. Closest guesses win big (300 / 200 / 100, +150 for a bullseye).',
      'At the end: meet your 🔗 twin tonight (the person most like you) and your 🧲 opposite. Go say hi!',
    ],
    // cluster / drum play recorded sounds instead (onFx below).
    fx: { round: 'whoosh', bonus: 'sting', spot: 'heartbeat', open: 'tick', lock: 'pop', allin: 'chime', reveal: 'reveal', drop: 'gasp', bullseye: 'cheer', dozed: 'shrug', win: 'win' },
    onFx(f) {
      if (f.kind === 'reveal' || f.kind === 'drum') tocks(); // the dots (or the guesses) slide onto the line
      // Read a Friend: a snare roll under the 🥁 that peaks as the spotlight's marker drops (~3.25 s).
      if (f.kind === 'drum') rec('drumroll', { vol: 0.2, delay: 0.45 });
      if (f.kind === 'cluster') rec('cheer', { vol: 0.15 }); // "All of you, together!"
    },

    tv(el, s, ctx) {
      if (!s) return;
      warm(); drops = [];
      if (s.phase === 'over') { paint(el, finalTv(s), 'over'); return; }
      const key = s.n + ':' + s.phase, t = timer('t' + key, s.endsIn), read = s.kind === 'read';
      const spot = s.spot ? who(s.spot) : '';
      const progress = (label) => { const pct = s.of ? Math.round((s.locked / s.of) * 100) : 0; return `<div class="sp-progress"><div class="fill" style="width:${pct}%"></div><span>${s.locked} / ${s.of} ${label}</span></div>${s.waiting && s.waiting.length ? `<div class="sp-waiting">Still deciding: ${s.waiting.map(esc).join(', ')}</div>` : s.waiting ? '<div class="sp-waiting">Everyone’s in! 🎉</div>' : ''}`; };
      let main = '';
      if (s.phase === 'intro') {
        main = read ? `<div class="sp-sweep">🔦 READ A FRIEND 🔦</div>${card(s.spec, 'in')}<div class="sp-status">Spotlight on ${spot}! They place themselves first… then everyone guesses where. ${t}</div>`
          : `${card(s.spec, 'in')}<div class="sp-status">Where do <b>you</b> stand? Get your phones ready… ${t}</div>`;
      } else if (s.phase === 'place') {
        main = `${card(s.spec)}<div class="sp-status">🎯 Drag your marker on your phone and lock it in! ${t}</div>${progress('locked in')}`;
      } else if (s.phase === 'spot') {
        main = `${card(s.spec)}<div class="sp-spotlight" style="--c:${esc(s.spot ? s.spot.color : '#fff')}">🔦</div>${has(s.spot) ? `<div class="sp-spotfig">${BOX.body(s.spot, 180, { mood: 'smirk' })}</div>` : ''}<div class="sp-status">${spot} is secretly placing themselves… everyone else, get ready to guess! ${t}</div>`;
      } else if (s.phase === 'guess') {
        main = `${card(s.spec)}<div class="sp-status">🤔 Where did ${spot} put themselves? Guess on your phone! ${t}</div>${progress('guesses in')}`;
      } else if (s.phase === 'reveal' && s.result) {
        main = (s.result.kind === 'read' ? revealRead(s) : revealNormal(s)) + (s.nextRead ? '<div class="sp-next">Next up: 🔦 Read a Friend!</div>' : '');
      }
      paint(el, `<div class="sp-wrap"><section class="sp-main"><div class="sp-top"><span>Round <b>${s.n}</b> of ${s.total}${read ? ' · 🔦 Read a Friend' : ''}</span><span class="muted">${s.names ? '🏷️ Names on dots' : '🙈 Shy mode: dots only'}</span></div>${main}</section>
        <aside class="panel sp-side"><h3>Points</h3>${s.standings.map((r, i) => `<div class="sp-srow"><span class="n">${i + 1}</span>${dot(r.color)}<span class="nm">${av(r)}${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</aside></div>${horizon(s, ctx)}`, key);
    },

    phone(el, v, ctx, full) {
      // JustGold gear: this game's phone theme, a frame and badge over your screen (public/shared/gear.js).
      if (window.MT_GEAR) window.MT_GEAR.phoneTheme(el, full, 'spectrum');
      if (!v || dragging) return; // never repaint under a finger
      const color = (full && full.me && full.me.color) || '#ffd23f', sp = v.spec;
      const head = `<div class="sp-me"><span>🏅 ${v.points} pts · #${v.rank || '-'}</span><span class="muted">Round ${v.n}/${v.total}</span></div>`;
      if (v.phase === 'over' && v.final) {
        const f = v.final, tw = f.twin, op = f.opp;
        const aboutTwin = tw && tw.about ? `<p class="muted">You were closest on <b>${specLine(tw.about)}</b>: you ${tw.about.me}, them ${tw.about.them}.</p>` : '';
        const aboutOpp = op && op.about ? `<p>Ask them about <b>${specLine(op.about)}</b>. You said ${op.about.me}, they said ${op.about.them}! 😄</p>` : '';
        paint(el, `<div class="sp-twin" style="--c:${esc(tw ? tw.color : '#888')}"><div class="sp-tw-lab">🔗 Your twin tonight</div>
            ${tw ? `<div class="sp-tw-name">${av(tw)}${esc(tw.name)}</div><div class="sp-tw-pct">${tw.pct}% alike${tw.mutual ? ' · 💞 and you’re theirs too!' : ''}</div>${aboutTwin}` : '<p>Play a couple of rounds to find your twin!</p>'}</div>
          ${op ? `<div class="sp-opp" style="--c:${esc(op.color)}"><div class="sp-tw-lab">🧲 Your opposite</div><div class="sp-tw-name">${av(op)}${esc(op.name)}</div><div class="sp-tw-pct">only ${op.pct}% alike</div>${aboutOpp}<div class="sp-go">Go find ${esc(op.name)} — your opposite! 👋</div></div>` : ''}
          ${f.awards.length ? `<div class="card-box sp-myaw">${f.awards.map((a) => `<div>${a.icon} <b>${esc(a.title)}</b></div>`).join('')}</div>` : ''}
          <div class="card-box" style="text-align:center">You finished <b>#${v.rank}</b> with ${v.points} points.</div><div class="card-box">${fboard(f.standings, (r) => r.points, ' pts')}</div>`, 'over');
        if (celebrated !== 'over') { celebrated = 'over'; ctx.sfx('chime'); haptic(ctx, tw ? 'win' : 'success'); }
        return;
      }
      if (celebrated === 'over') celebrated = ''; // a new game started
      if (v.isSpot && (v.phase === 'intro' || v.phase === 'spot')) feel(ctx, 'spot', v.n, 'turn');
      else if (v.phase === 'place' || v.phase === 'guess') feel(ctx, 'go', v.n + v.phase, 'select');
      const key = v.n + ':' + v.phase, t = timer('p' + key, v.endsIn);
      // In a normal round, once you've placed you may guess the room average while you wait.
      const avgStep = v.phase === 'place' && v.inRound && v.myPos != null && editKey !== key;
      const step = key + (avgStep ? ':avg' : '');
      if (valKey !== step) { valKey = step; val = avgStep ? (v.myAvg != null ? v.myAvg : 50) : v.phase === 'guess' ? (v.myGuess != null ? v.myGuess : 50) : (v.myPos != null ? v.myPos : 50); }
      const spotName = v.spot ? esc(v.spot.name) : 'the spotlight';
      let html = '', bind = null;
      if (!v.inRound && v.phase !== 'reveal') html = `${head}${card(sp, 'phone')}<div class="big-status">You’re in from the next round! 🎟️</div>`;
      else if (v.phase === 'intro') html = `${head}${card(sp, 'phone in')}<div class="big-status">${v.isSpot ? '🔦 You’re in the SPOTLIGHT! Place yourself honestly… everyone will try to guess.' : v.kind === 'read' ? `🔦 Spotlight on ${spotName}! Get ready to guess.` : 'Where do you stand? Get ready…'}</div>`;
      else if (v.phase === 'place' && avgStep) {
        html = `${head}<div class="sp-locked">✅ You’re at <b>${v.myPos}</b> · ${mood(sp, v.myPos)} <button class="sp-chg" id="sp-edit">change</button></div>
          <div class="sp-q">⏳ While you wait… where will the <b>room average</b> land? <span class="muted">(+${v.whisper} within 5)</span> ${t}</div>${slider(sp, 'avg', '#3ec1ff', v.myAvg, v.myAvg != null && v.myAvg === val ? 'Saved! Slide again to change it.' : 'Optional bonus. Think about this crowd…')}`;
        bind = (e) => { bindSlider(e, v, ctx, sp, v.myAvg); const ed = e.querySelector('#sp-edit'); if (ed) ed.onclick = () => { editKey = key; ctx.redraw(); }; };
      } else if (v.phase === 'place') {
        html = `${head}<div class="sp-q">Where do <b>you</b> stand? ${t}</div>${slider(sp, 'place', color, v.myPos, v.myPos != null && v.myPos === val ? `Waiting for the others… you can still change it.` : 'Drag the marker, then lock it in. Nobody sees it until the reveal.')}`;
        bind = (e) => bindSlider(e, v, ctx, sp, v.myPos);
      } else if (v.phase === 'spot') {
        if (v.isSpot) { html = `${head}<div class="sp-q">🔦 Where do <b>you</b> stand? Everyone will guess! ${t}</div>${slider(sp, 'place', color, v.myPos, 'Be honest… the more readable you are, the more points you get.')}`; bind = (e) => bindSlider(e, v, ctx, sp, v.myPos); }
        else html = `${head}${card(sp, 'phone')}<div class="big-status sp-pulse">🔦 ${spotName} is placing themselves…<br><span class="muted">Think: where would they stand?</span></div>`;
      } else if (v.phase === 'guess') {
        if (v.isSpot) html = `${head}${card(sp, 'phone')}<div class="big-status">😌 Poker face! Everyone is guessing where you stand.</div><p class="muted" style="text-align:center">You put yourself at <b>${v.myPos}</b>. ${t}</p>`;
        else { html = `${head}<div class="sp-q">🤔 Where did <b>${spotName}</b> put themselves? ${t}</div>${slider(sp, 'guess', v.spot ? v.spot.color : color, v.myGuess, 'Closest guesses win 300 / 200 / 100 · within 5 = +150 bullseye!')}`; bind = (e) => bindSlider(e, v, ctx, sp, v.myGuess); }
      } else if (v.phase === 'reveal' && v.result) {
        const r = v.result, lines = [];
        if (r.kind === 'read') {
          if (r.isSpot) {
            lines.push(miniLine(sp, [{ pos: r.target, color, cls: 'me', label: 'you' }].concat(r.avgGuess != null ? [{ pos: r.avgGuess, cls: 'avg', label: 'room’s guess' }] : [])));
            lines.push(`<p>You stand at <b>${r.target}</b>. ${r.count ? `${plural(r.readers, 'person')} of ${r.count} read you within 15.` : 'Nobody guessed!'}</p>`);
            if (r.readers) lines.push(`<div class="sp-gain">+${r.readers * 50} You’re an open book 📖</div>`); else if (r.count) lines.push('<p class="muted">A total mystery! 🕵️</p>');
          } else {
            lines.push(miniLine(sp, [{ pos: r.target, color: v.spot ? v.spot.color : '#fff', cls: 'target', label: esc(v.spot ? v.spot.name : '') }].concat(r.guess != null ? [{ pos: r.guess, color, cls: 'me', label: 'you' }] : [])));
            lines.push(`<p>${spotName} stands at <b>${r.target}</b>.${r.guess != null ? ` You guessed ${r.guess}: off by ${r.err}.` : ''}</p>`);
            if (r.pts) lines.push(`<div class="sp-gain">+${r.pts} ${['🥇 Closest guess!', '🥈 Second closest!', '🥉 Third closest!'][r.rank - 1] || 'Tied for a medal!'}</div>`);
            if (r.bull) lines.push('<div class="sp-gain">+150 🎯 BULLSEYE!</div>');
            if (r.guess == null) lines.push('<p class="muted">You didn’t guess this time.</p>');
            else if (!r.pts && !r.bull) lines.push(`<p class="muted">${r.err <= 15 ? 'So close! 🤏' : 'They surprised you! 😮'}</p>`);
          }
        } else {
          const marks = [];
          if (r.lo != null) marks.push({ pos: r.lo, cls: 'faint' }); if (r.hi != null) marks.push({ pos: r.hi, cls: 'faint' });
          if (r.avg != null) marks.push({ pos: r.avg, cls: 'avg', label: 'avg' });
          if (r.avgPred != null) marks.push({ pos: r.avgPred, cls: 'pred', label: '🔮' });
          if (r.pos != null) marks.push({ pos: r.pos, color, cls: 'me', label: 'you' });
          lines.push(miniLine(sp, marks));
          if (r.pos == null) lines.push('<p class="muted">You sat this one out.</p>');
          else {
            lines.push(`<p>You: <b>${r.pos}</b>${r.avg != null ? ` · Room average: <b>${r.avg}</b>` : ''}</p>`);
            if (r.pos === r.lo && r.lo !== r.hi) lines.push(`<p>👑 The most “${esc(sp.l)}” person in the room!</p>`);
            if (r.pos === r.hi && r.lo !== r.hi) lines.push(`<p>👑 The most “${esc(sp.r)}” person in the room!</p>`);
            if (r.hotTake) lines.push('<p>🌶️ <b>Hot take!</b> You stood alone out there. Explain yourself!</p>');
            if (r.nearAvg) lines.push('<div class="sp-gain">+50 You get this room 🎯</div>');
            if (r.whisper) lines.push(`<div class="sp-gain">+75 Crowd Whisperer 🔮 <small>(you said ${r.avgPred})</small></div>`);
            else if (r.avgPred != null && r.avg != null) lines.push(`<p class="muted">🔮 You guessed the average at ${r.avgPred}: off by ${Math.abs(r.avgPred - r.avg)}</p>`);
            if (r.neighbour) lines.push(`<div class="sp-gain">+25 Nearest neighbours${r.neighbour.name ? ` with ${esc(r.neighbour.name)}` : ''} 🧲</div>`);
            if (r.closest && !r.neighbour) lines.push(`<p class="muted">Closest to you: ${r.closest.name ? `${dot(r.closest.color)}<b>${esc(r.closest.name)}</b>` : 'someone'} (${r.closest.gap === 0 ? 'the exact same spot!' : `${r.closest.gap} apart`})</p>`);
          }
        }
        html = `${head}${card(sp, 'phone small')}<div class="card-box sp-result">${lines.join('')}${r.gained ? `<div class="sp-total">+${r.gained} this round</div>` : ''}</div>${v.nextRead ? '<div class="muted" style="text-align:center">Next up: 🔦 Read a Friend!</div>' : ''}`;
        if (celebrated !== key) { celebrated = key; if (r.gained >= 200) { ctx.sfx('cheer'); haptic(ctx, 'win'); } else if (r.gained) { ctx.sfx('chime'); haptic(ctx, 'success'); } else haptic(ctx, 'tap'); }
      } else html = `${head}<div class="big-status">Next spectrum coming…</div>`;
      paint(el, html, step);
      if (bind) bind(el);
    },
  };
})();
