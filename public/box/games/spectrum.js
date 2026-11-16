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
  let val = 50, valKey = '', dragging = false, celebrated = '';
  // A countdown whose end time stays fixed for one phase, so identical renders can be skipped.
  const ends = {};
  const timer = (key, endsIn) => { if (!endsIn) return ''; if (!ends[key]) ends[key] = Date.now() + endsIn; return `<span class="timer sp-timer" data-ends="${ends[key]}">${mmss(ends[key] - Date.now())}</span>`; };
  const dot = (c) => `<i class="sp-cdot" style="background:${esc(c || '#888')}"></i>`;
  const who = (x) => (x && x.name ? `${dot(x.color)}<b>${esc(x.name)}</b>` : `${dot(x && x.color)}<b>someone</b>`);
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const clampPct = (x) => Math.max(0, Math.min(100, x));
  // Swap the HTML only when it changed (keeps animations from restarting on every sync).
  function paint(el, html) {
    const root = el.firstElementChild;
    if (root && root.classList.contains('sp-root') && el._spHtml === html) return false;
    el._spHtml = html; el.innerHTML = `<div class="sp-root">${html}</div>`;
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
  function field(dots, { names, start = 300, spread = 2200 }) {
    let labelled = names && dots.length <= 30 && dots.every((d) => d.name);
    let st = labelled ? stack(dots, true) : null;
    if (!st) { labelled = false; st = stack(dots, false); }
    const rowH = labelled ? 36 : 20, step = dots.length ? Math.min(140, spread / dots.length) : 0;
    const html = st.out.map((d, i) => {
      const delay = Math.round(start + i * step), style = `left:${d.pos}%;bottom:${d.row * rowH + 4}px;--c:${esc(d.color)};animation-delay:${delay}ms`;
      return labelled ? `<div class="sp-pin" style="${style}"><i></i><span>${esc(d.name)}</span></div>` : `<div class="sp-pip" style="${style}"></div>`;
    }).join('');
    return { html, height: Math.max(90, st.rows * rowH + 18), done: start + dots.length * step + 600 };
  }

  function revealNormal(s) {
    const res = s.result, sp = s.spec, f = field(res.dots, { names: s.names });
    const after = f.done;
    const c = res.cluster;
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
    if (res.count >= 2) notes.push(`🎯 ${plural(res.nearAvg, 'person')} within 10 of the room average <span class="muted">(+50 · “you get this room”)</span>`);
    return `${card(sp, 'small')}
      <div class="sp-stage"><div class="sp-rail">${band}${avg}<div class="sp-field" style="height:${f.height}px">${f.html}</div><div class="sp-line"></div><div class="sp-under">${ext.join('')}</div></div>${endsBar(sp)}</div>
      <div class="sp-notes" style="animation-delay:${after + 1300}ms">${notes.map((n) => `<div>${n}</div>`).join('')}</div>`;
  }
  function revealRead(s) {
    const res = s.result, sp = s.spec, spot = s.spot || { name: '?', color: '#888' };
    const f = field(res.guesses, { names: s.names, start: 200, spread: 1600 });
    const drop = Math.max(2900, f.done + 200);
    const zone = `<div class="sp-zone" style="left:${clampPct(res.target - 15)}%;width:${clampPct(res.target + 15) - clampPct(res.target - 15)}%;animation-delay:${drop + 400}ms"><span>📖 open-book zone</span></div>`;
    const target = `<div class="sp-target" style="left:${res.target}%;--c:${esc(spot.color)};animation-delay:${drop}ms"><span>🔦 ${esc(spot.name)} · ${res.target}</span><i></i></div>`;
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
    return `<div class="sp-over"><h1 class="sp-h">🔗 Tonight’s Twins</h1>
      ${crown ? `<div class="sp-crown"><div class="sp-crown-ic">👑</div><div class="muted">The most alike pair in the room</div>
        <div class="sp-crown-names">${who(crown.a)} <span class="sp-heart">🔗</span> ${who(crown.b)}</div><div class="sp-crown-pct">${crown.pct}% alike</div>
        ${crown.about ? `<div class="muted">They agreed the most on “${esc(crown.about)}”</div>` : ''}</div>` : '<div class="big-status">Play a few rounds to find your twins!</div>'}
      ${rest.length ? `<div class="sp-pairs">${rest.map(pairCard).join('')}</div>` : ''}${f.more ? `<div class="muted sp-more">+${f.more} more twin pairs: check your phones!</div>` : ''}
      ${awards.length ? `<div class="sp-awards">${awards.map(([ic, t, nm, txt], i) => `<div class="sp-award" style="animation-delay:${2.4 + i * 0.35}s"><div class="ic">${ic}</div><div class="t">${t}</div><div class="nm">${nm}</div><div class="muted">${txt}</div></div>`).join('')}</div>` : ''}
      <div class="sp-final-board"><h3>Points</h3>${BOX.board(s.standings, (r) => r.points, ' pts')}</div></div>`;
  }

  // ---------- phone ----------
  function slider(sp, op, color, done, hint) {
    const locked = done != null && done === val;
    return `<div class="sp-slider" id="sp-sl" data-op="${op}" style="--c:${esc(color)}">
      <div class="sp-mood" id="sp-mood">${mood(sp, val)}</div>
      <div class="sp-track" id="sp-track"><div class="sp-groove"></div><div class="sp-knob" id="sp-knob" style="left:${val}%"><span id="sp-val">${val}</span></div></div>
      <div class="sp-pends"><span><em>${esc(sp.le)}</em>${esc(sp.l)}</span><span><em>${esc(sp.re)}</em>${esc(sp.r)}</span></div></div>
      <div class="sp-nudge"><button class="btn ghost small" data-nudge="-5">◀ 5</button><button class="btn ghost small" data-nudge="-1">◀</button><button class="btn ghost small" data-nudge="1">▶</button><button class="btn ghost small" data-nudge="5">5 ▶</button></div>
      <button class="btn big green sp-lock ${locked ? 'done' : ''}" id="sp-lock">${locked ? 'Locked in ✅' : done != null ? 'Update my answer 🔒' : 'Lock it in 🔒'}</button>
      ${hint ? `<div class="muted sp-hint">${hint}</div>` : ''}`;
  }
  function bindSlider(el, v, ctx, sp, done) {
    const track = el.querySelector('#sp-track'); if (!track) return;
    const op = el.querySelector('#sp-sl').dataset.op;
    const knob = el.querySelector('#sp-knob'), num = el.querySelector('#sp-val'), md = el.querySelector('#sp-mood'), lock = el.querySelector('#sp-lock');
    const show = () => {
      knob.style.left = val + '%'; num.textContent = val; md.innerHTML = mood(sp, val);
      const locked = done != null && done === val;
      lock.classList.toggle('done', locked); lock.textContent = locked ? 'Locked in ✅' : done != null ? 'Update my answer 🔒' : 'Lock it in 🔒';
    };
    const at = (e) => { const r = track.getBoundingClientRect(); const x = Math.round(((e.clientX - r.left) / Math.max(1, r.width)) * 100); val = Math.max(0, Math.min(100, x)); show(); };
    track.onpointerdown = (e) => { dragging = true; try { track.setPointerCapture(e.pointerId); } catch { /* old browser */ } at(e); e.preventDefault(); };
    track.onpointermove = (e) => { if (dragging) at(e); };
    const stop = () => { if (!dragging) return; dragging = false; ctx.vibrate(8); };
    track.onpointerup = stop; track.onpointercancel = stop; track.onlostpointercapture = stop;
    for (const b of el.querySelectorAll('[data-nudge]')) b.onclick = () => { val = Math.max(0, Math.min(100, val + Number(b.dataset.nudge))); show(); ctx.vibrate(5); };
    lock.onclick = async () => {
      if (done != null && done === val) return;
      const r = await ctx.act({ op, pos: val });
      if (r && r.ok) { ctx.vibrate(30); ctx.sfx('pop'); ctx.redraw(); }
    };
  }
  // A small private line on the phone: my dot, the room average, and the rest as faint pips.
  function miniLine(sp, marks) {
    return `<div class="sp-mini"><div class="sp-mini-line">${marks.map((m) => `<div class="sp-mm ${m.cls || ''}" style="left:${m.pos}%;--c:${esc(m.color || '#fff')}">${m.label ? `<span>${m.label}</span>` : ''}</div>`).join('')}</div>${endsBar(sp)}</div>`;
  }

  BOX.games.spectrum = {
    name: 'Where Do You Stand?', icon: '🧭',
    about: 'Drag a marker to where YOU stand: morning person or night owl? Beach or mountains? See where everyone lands, read your friends, and meet your twin tonight.',
    how: [
      'A spectrum goes up on the big screen, like 🌅 Morning person ↔ Night owl 🌙.',
      'Drag the marker on your phone to where YOU stand, then lock it in. Nobody sees it until the reveal.',
      'Everyone’s dots slide onto one big line. +50 if you land within 10 of the room average, +25 for the closest pair.',
      'Every 3rd round is 🔦 READ A FRIEND: one person places themselves, everyone else guesses where. Closest guesses win big (300 / 200 / 100, +150 for a bullseye).',
      'At the end: meet your 🔗 twin tonight (the person most like you) and your 🧲 opposite. Go say hi!',
    ],
    fx: { round: 'whoosh', bonus: 'sting', spot: 'heartbeat', open: 'tick', lock: 'pop', allin: 'chime', reveal: 'reveal', cluster: 'cheer', drum: 'drum', drop: 'gasp', bullseye: 'cheer', dozed: 'shrug', win: 'win' },

    tv(el, s) {
      if (!s) return;
      if (s.phase === 'over') { paint(el, finalTv(s)); return; }
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
        main = `${card(s.spec)}<div class="sp-spotlight" style="--c:${esc(s.spot ? s.spot.color : '#fff')}">🔦</div><div class="sp-status">${spot} is secretly placing themselves… everyone else, get ready to guess! ${t}</div>`;
      } else if (s.phase === 'guess') {
        main = `${card(s.spec)}<div class="sp-status">🤔 Where did ${spot} put themselves? Guess on your phone! ${t}</div>${progress('guesses in')}`;
      } else if (s.phase === 'reveal' && s.result) {
        main = (s.result.kind === 'read' ? revealRead(s) : revealNormal(s)) + (s.nextRead ? '<div class="sp-next">Next up: 🔦 Read a Friend!</div>' : '');
      }
      paint(el, `<div class="sp-wrap"><section class="sp-main"><div class="sp-top"><span>Round <b>${s.n}</b> of ${s.total}${read ? ' · 🔦 Read a Friend' : ''}</span><span class="muted">${s.names ? '🏷️ Names on dots' : '🙈 Shy mode: dots only'}</span></div>${main}</section>
        <aside class="panel sp-side"><h3>Points</h3>${s.standings.map((r, i) => `<div class="sp-srow"><span class="n">${i + 1}</span>${dot(r.color)}<span class="nm">${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</aside></div>`);
    },

    phone(el, v, ctx, full) {
      if (!v || dragging) return; // never repaint under a finger
      const color = (full && full.me && full.me.color) || '#ffd23f', sp = v.spec;
      const head = `<div class="sp-me"><span>🏅 ${v.points} pts · #${v.rank || '-'}</span><span class="muted">Round ${v.n}/${v.total}</span></div>`;
      if (v.phase === 'over' && v.final) {
        const f = v.final, tw = f.twin, op = f.opp;
        const aboutTwin = tw && tw.about ? `<p class="muted">You were closest on <b>${specLine(tw.about)}</b>: you ${tw.about.me}, them ${tw.about.them}.</p>` : '';
        const aboutOpp = op && op.about ? `<p>Ask them about <b>${specLine(op.about)}</b>. You said ${op.about.me}, they said ${op.about.them}! 😄</p>` : '';
        paint(el, `<div class="sp-twin" style="--c:${esc(tw ? tw.color : '#888')}"><div class="sp-tw-lab">🔗 Your twin tonight</div>
            ${tw ? `<div class="sp-tw-name">${esc(tw.name)}</div><div class="sp-tw-pct">${tw.pct}% alike${tw.mutual ? ' · 💞 and you’re theirs too!' : ''}</div>${aboutTwin}` : '<p>Play a couple of rounds to find your twin!</p>'}</div>
          ${op ? `<div class="sp-opp" style="--c:${esc(op.color)}"><div class="sp-tw-lab">🧲 Your opposite</div><div class="sp-tw-name">${esc(op.name)}</div><div class="sp-tw-pct">only ${op.pct}% alike</div>${aboutOpp}<div class="sp-go">Go find ${esc(op.name)} — your opposite! 👋</div></div>` : ''}
          ${f.awards.length ? `<div class="card-box sp-myaw">${f.awards.map((a) => `<div>${a.icon} <b>${esc(a.title)}</b></div>`).join('')}</div>` : ''}
          <div class="card-box" style="text-align:center">You finished <b>#${v.rank}</b> with ${v.points} points.</div><div class="card-box">${BOX.board(f.standings, (r) => r.points, ' pts')}</div>`);
        if (celebrated !== 'over') { celebrated = 'over'; ctx.sfx('chime'); ctx.vibrate(80); }
        return;
      }
      const key = v.n + ':' + v.phase, t = timer('p' + key, v.endsIn);
      if (valKey !== key) { valKey = key; val = v.phase === 'guess' ? (v.myGuess != null ? v.myGuess : 50) : (v.myPos != null ? v.myPos : 50); }
      const spotName = v.spot ? esc(v.spot.name) : 'the spotlight';
      let html = '', bind = null;
      if (!v.inRound && v.phase !== 'reveal') html = `${head}${card(sp, 'phone')}<div class="big-status">You’re in from the next round! 🎟️</div>`;
      else if (v.phase === 'intro') html = `${head}${card(sp, 'phone in')}<div class="big-status">${v.isSpot ? '🔦 You’re in the SPOTLIGHT! Place yourself honestly… everyone will try to guess.' : v.kind === 'read' ? `🔦 Spotlight on ${spotName}! Get ready to guess.` : 'Where do you stand? Get ready…'}</div>`;
      else if (v.phase === 'place') {
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
          if (r.pos != null) marks.push({ pos: r.pos, color, cls: 'me', label: 'you' });
          lines.push(miniLine(sp, marks));
          if (r.pos == null) lines.push('<p class="muted">You sat this one out.</p>');
          else {
            lines.push(`<p>You: <b>${r.pos}</b>${r.avg != null ? ` · Room average: <b>${r.avg}</b>` : ''}</p>`);
            if (r.pos === r.lo && r.lo !== r.hi) lines.push(`<p>👑 The most “${esc(sp.l)}” person in the room!</p>`);
            if (r.pos === r.hi && r.lo !== r.hi) lines.push(`<p>👑 The most “${esc(sp.r)}” person in the room!</p>`);
            if (r.nearAvg) lines.push('<div class="sp-gain">+50 You get this room 🎯</div>');
            if (r.neighbour) lines.push(`<div class="sp-gain">+25 Nearest neighbours${r.neighbour.name ? ` with ${esc(r.neighbour.name)}` : ''} 🧲</div>`);
            if (r.closest && !r.neighbour) lines.push(`<p class="muted">Closest to you: ${r.closest.name ? `${dot(r.closest.color)}<b>${esc(r.closest.name)}</b>` : 'someone'} (${r.closest.gap === 0 ? 'the exact same spot!' : `${r.closest.gap} apart`})</p>`);
          }
        }
        html = `${head}${card(sp, 'phone small')}<div class="card-box sp-result">${lines.join('')}${r.gained ? `<div class="sp-total">+${r.gained} this round</div>` : ''}</div>${v.nextRead ? '<div class="muted" style="text-align:center">Next up: 🔦 Read a Friend!</div>' : ''}`;
        if (celebrated !== key) { celebrated = key; if (r.gained >= 200) { ctx.sfx('cheer'); ctx.vibrate(120); } else if (r.gained) { ctx.sfx('chime'); ctx.vibrate(40); } }
      } else html = `${head}<div class="big-status">Next spectrum coming…</div>`;
      if (paint(el, html) && bind) bind(el);
    },
  };
})();
