'use strict';
// Hot Take Trivia screens. TV: a neon quiz studio. The question card and four colour-coded
// answers, a burning fuse for the clock, contestants lighting up as they lock in, then the
// reveal: the right answer glows, everyone's pick hangs under their answer with their bet
// (🧊 1×, 🌶️ 2×, 🔥 3×) and the points fly. Hot Seat and All In get their own spotlights.
// Phone: a 1× / 2× / 3× bet selector and four big answer buttons; RIGHT/WRONG calls for the
// Hot Seat; wager buttons for All In.
(function () {
  const { esc, mmss } = BOX;
  const LET = ['A', 'B', 'C', 'D'], SHAPE = ['▲', '◆', '●', '■'];
  const BET = { 1: { n: '1×', l: 'Hunch', e: '🧊' }, 2: { n: '2×', l: 'Sure', e: '🌶️' }, 3: { n: '3×', l: 'HOT TAKE', e: '🔥' } };
  const WAGERS = [0, 25, 50, 75, 100];
  // Phone-side state that must survive re-renders.
  let bet = 1, betKey = '', felt = {}, warned = '';
  // A countdown whose end stays fixed for one phase, so identical renders can be skipped.
  const ends = {}, full = {}, from = {};
  function clock(key, endsIn, total) {
    if (!endsIn) return '';
    if (!ends[key]) { ends[key] = Date.now() + endsIn; full[key] = Math.max(endsIn, total || endsIn); from[key] = endsIn / full[key]; }
    const st = `--ms:${Math.round(full[key] * from[key])}ms;--from:${from[key].toFixed(3)}`;
    return `<div class="tt-clock"><div class="tt-fuse"><i style="${st}"></i><b class="tt-spark" style="${st}">🔥</b></div><span class="timer tt-secs" data-ends="${ends[key]}">${mmss(ends[key] - Date.now())}</span></div>`;
  }
  const av = (x) => esc((x && x.avatar) || '🙂');
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const sign = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '±0');
  const catChip = (c) => (c ? `<span class="tt-cat" style="--c:${esc(c.color)}">${esc(c.icon)} ${esc(c.label)}</span>` : '');
  const kindBadge = (s) => (s.kind === 'hot' ? '<span class="tt-badge hot">🔥 HOT SEAT</span>' : s.kind === 'allin' ? '<span class="tt-badge allin">💰 ALL IN</span>' : '');
  const betChip = (b) => (b && BET[b] ? `<em class="tt-bchip b${b}">${BET[b].e}${BET[b].n}</em>` : '');
  // Update in place (BOX.morph). Each phase of each question gets its own root, so entrance
  // animations play once per phase while re-renders within it never restart them.
  function paint(el, html, key) {
    const fresh = el._ttKey !== key;
    el._ttKey = key;
    if (!fresh && el._ttHtml === html) return false;
    el._ttHtml = html;
    BOX.morph(el, `<div class="tt-root" id="tt-${esc(key)}">${html}</div>`);
    return fresh;
  }
  function countUp(el) {
    for (const n of el.querySelectorAll('[data-count]')) {
      const to = Number(n.dataset.count), wait = Number(n.dataset.delay || 0), dur = 800, pre = n.dataset.pre || '';
      n.textContent = pre + '0';
      setTimeout(() => { const t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / dur); const v = Math.round(to * (1 - Math.pow(1 - k, 3))); n.textContent = n.dataset.plain ? String(v) : (v > 0 ? '+' : v < 0 ? '−' : pre) + Math.abs(v); if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }, wait);
    }
  }
  function haptic(ctx, kind) { try { if (ctx.haptic) ctx.haptic(kind); else if (ctx.vibrate) ctx.vibrate(kind === 'tap' ? 10 : 40); } catch { /* no vibration */ } }
  const feel = (ctx, chan, key, kind) => { if (felt[chan] === key) return; felt[chan] = key; haptic(ctx, kind); };

  const AWARDS = {
    better: ['🎲', 'Big Better'], coward: ['🐔', 'Coward'], comeback: ['📈', 'Comeback Kid'], fire: ['🔥', 'On Fire'], speed: ['⚡', 'Speed Demon'],
    brain: ['🧠', 'Know-It-All'], hot: ['🌶️', 'Hot Take Hero'], burned: ['💥', 'Crash & Burn'], oracle: ['🔮', 'Mind Reader'],
  };
  const awardsHtml = (list, cls = '') => `<div class="tt-awards ${cls}">${list.map((a, i) => { const [ic, lb] = AWARDS[a.k] || ['🏅', a.k]; return `<div class="tt-award k-${esc(a.k)}" style="animation-delay:${(0.5 + i * 0.25).toFixed(2)}s"><div class="ic">${ic}</div><div class="lb">${esc(lb)}</div><div class="nm">${a.names.map(esc).join(', ')}${a.more ? ` +${a.more}` : ''}</div><div class="tx">${esc(a.text)}</div></div>`; }).join('')}</div>`;

  // ---------- TV ----------
  function board(s) {
    const rows = s.standings || [];
    return `<aside class="tt-board"><h3>🔥 Leaderboard</h3>${rows.map((r, i) => `<div class="tt-brow ${i === 0 && r.points > 0 ? 'lead' : ''}" style="--c:${esc(r.color)}"><span class="n">${i + 1}</span><span class="a">${av(r)}</span><span class="nm">${esc(r.name)}</span>${r.streak >= 2 ? `<span class="st">🔥${r.streak}</span>` : ''}<b>${r.points}</b></div>`).join('') || '<div class="muted">No scores yet</div>'}</aside>`;
  }
  function top(s) {
    return `<header class="tt-top"><span class="tt-qn">Question <b>${s.n}</b> of ${s.total}</span>${catChip(s.cat)}${kindBadge(s)}${s.family ? '<span class="tt-fam">🧸 Family</span>' : ''}</header>`;
  }
  function locks(s) {
    if (!s.roster) return `<div class="tt-locks"><span class="tt-lcount">${s.locked} / ${s.of} locked in</span></div>`;
    return `<div class="tt-locks">${s.roster.map((p) => `<span class="tt-lock ${p.in ? 'in' : ''} ${p.seat ? 'seat' : ''}" style="--c:${esc(p.color)}"><i>${av(p)}</i><b>${esc(p.name)}</b></span>`).join('')}<span class="tt-lcount">${s.locked}/${s.of}</span></div>`;
  }
  function answersTv(s, res) {
    return `<div class="tt-answers">${(s.answers || []).map((t, i) => {
      const st = s.correct == null ? '' : s.correct === i ? 'right' : 'wrong';
      const who = res ? res.picks[i] || [] : [];
      return `<div class="tt-ans a${i} ${st}" style="animation-delay:${(0.15 + i * 0.12).toFixed(2)}s"><i class="tt-let">${SHAPE[i]}<b>${LET[i]}</b></i><span class="tt-at">${esc(t)}</span>${st === 'right' ? '<span class="tt-tick">✔</span>' : ''}
        ${res ? `<div class="tt-pickers">${who.map((p, k) => `<span class="tt-picker" style="--c:${esc(p.color)};animation-delay:${(0.9 + k * 0.06).toFixed(2)}s">${av(p)}<b>${esc(p.name)}</b>${p.stake != null ? `<em class="tt-bchip stake">${p.stake}</em>` : betChip(p.bet)}</span>`).join('')}${res.more[i] ? `<span class="tt-picker more">+${res.more[i]}</span>` : ''}</div>` : ''}</div>`;
    }).join('')}</div>`;
  }
  function gainsTv(s, res) {
    if (s.kind === 'hot' && res.hot) {
      const seat = s.seat || { name: '?' }, h = res.hot;
      const col = (ok) => res.hot.preds.filter((p) => p.right === ok).map((p) => `<span class="tt-pred ${p.ok ? 'ok' : 'bad'}" style="--c:${esc(p.color)}">${av(p)} ${esc(p.name)} ${betChip(p.bet)}<b>${sign(p.gained)}</b></span>`).join('') || '<span class="muted">nobody</span>';
      const row = res.rows[0];
      return `<div class="tt-hotres ${h.seatRight ? 'yes' : 'no'}"><div class="tt-seatline">${av(seat)} <b>${esc(seat.name)}</b> ${h.answered ? (h.seatRight ? 'got it <span class="ok">RIGHT</span>!' : 'got it <span class="bad">WRONG</span>!') : 'ran out of time!'} ${row ? `<span class="tt-big ${row.gained >= 0 ? 'up' : 'down'}" data-count="${row.gained}" data-delay="900">${sign(row.gained)}</span>` : ''}</div>
        <div class="tt-hotcols"><div><h4>✅ Said they’d get it (${h.yes})</h4>${col(true)}</div><div><h4>❌ Doubted them (${h.no})</h4>${col(false)}</div></div></div>`;
    }
    const rows = res.rows.slice(0, 8);
    const head = res.answered ? `${res.rights} of ${res.answered} got it right${res.fastest ? ` · ⚡ fastest: <b>${esc(res.fastest.name)}</b> (${res.fastest.s}s)` : ''}` : 'Nobody answered! 🦗';
    return `<div class="tt-gains"><div class="tt-ghead">${head}</div><div class="tt-grows">${rows.map((r, i) => `<div class="tt-grow ${r.right ? 'ok' : r.a == null ? 'none' : 'bad'}" style="--c:${esc(r.color)};animation-delay:${(1 + i * 0.1).toFixed(2)}s"><span class="a">${av(r)}</span><span class="nm">${esc(r.name)}</span>
      <span class="why">${s.kind === 'allin' ? (r.a == null ? 'no answer' : `💰${r.stake} · ${r.pct}%`) : r.a == null ? 'no answer' : `${betChip(r.bet)}${r.speed ? ` ⚡${r.speed}` : ''}${r.streakBonus ? ` 🔥+${r.streakBonus}` : ''}`}</span><b class="${r.gained > 0 ? 'up' : r.gained < 0 ? 'down' : ''}">${sign(r.gained)}</b></div>`).join('')}</div></div>`;
  }
  function tvIntro(s) {
    if (s.kind === 'hot') {
      const seat = s.seat || {};
      return `<div class="tt-intro hot"><div class="tt-flare">🔥 HOT SEAT 🔥</div><div class="tt-seat" style="--c:${esc(seat.color || '#ff8a00')}"><div class="tt-seatav">${av(seat)}</div><div class="tt-seatnm">${esc(seat.name || '')}</div></div>
        <p class="tt-rule"><b>${esc(seat.name || '')}</b> answers alone for <b>DOUBLE</b> points.<br>Everyone else: bet on whether they’ll get it right!</p>${catChip(s.cat)}</div>`;
    }
    if (s.kind === 'allin') return `<div class="tt-intro allin"><div class="tt-flare">💰 ALL IN 💰</div><div class="tt-catbig" style="--c:${esc(s.cat.color)}"><span>${esc(s.cat.icon)}</span>${esc(s.cat.label)}</div><p class="tt-rule">The final question! You’ll see the category first, then <b>bet any share of your points</b>.</p></div>`;
    return `<div class="tt-intro"><div class="tt-qbig">Question ${s.n}</div><div class="tt-catbig" style="--c:${esc(s.cat.color)}"><span>${esc(s.cat.icon)}</span>${esc(s.cat.label)}</div><div class="tt-ready">Pick your answer <b>and</b> how sure you are: 🧊 1× · 🌶️ 2× · 🔥 3×</div></div>`;
  }

  // ---------- phone ----------
  function head(v) {
    return `<div class="tt-me"><span>🏅 <b>${v.points}</b> pts · #${v.rank || '-'}</span>${v.streak >= 2 ? `<span class="tt-mystreak">🔥 ${v.streak} in a row</span>` : ''}<span class="muted">${v.kind === 'allin' ? '💰 Final' : `Q${v.n}/${v.total}`}</span></div>`;
  }
  function betPicker(cur) {
    return `<div class="tt-betcap">How sure are you?</div><div class="tt-bets">${[1, 2, 3].map((b) => `<button class="tt-bet b${b} ${cur === b ? 'on' : ''}" data-bet="${b}"><b>${BET[b].e} ${BET[b].n}</b><small>${BET[b].l}</small></button>`).join('')}</div>`;
  }
  function bindBets(el, ctx) { for (const b of el.querySelectorAll('[data-bet]')) b.onclick = () => { bet = Number(b.dataset.bet); haptic(ctx, bet === 3 ? 'buzz' : 'tap'); ctx.redraw(); }; }
  function phoneAsk(v, ctx) {
    const key = v.n + ':ask', t = clock('p' + key, v.endsIn, v.seconds * 1000);
    if (betKey !== String(v.n)) { betKey = String(v.n); bet = 1; }
    const q = `<div class="tt-pq">${catChip(v.cat)}<div>${esc(v.text)}</div></div>`;
    if (!v.inRound) return { html: `${q}<div class="tt-wait">You’re in from the next question! 🎟️</div>` };
    if (v.kind === 'hot' && !v.isSeat) {
      const seat = v.seat || { name: '?' };
      if (v.myPred) return { html: `${q}<div class="tt-locked"><div class="tt-lk">🔒</div><div>You said <b>${esc(seat.name)}</b> will get it <b class="${v.myPred.right ? 'ok' : 'bad'}">${v.myPred.right ? 'RIGHT' : 'WRONG'}</b> ${betChip(v.myPred.bet)}</div><p class="muted">Watch the Hot Seat… ${t}</p></div>` };
      return {
        html: `${q}<div class="tt-step">🔥 Will <b>${av(seat)} ${esc(seat.name)}</b> get it right? ${t}</div>${betPicker(bet)}
          <div class="tt-yn"><button class="tt-y" data-right="1">✅ RIGHT</button><button class="tt-n" data-right="0">❌ WRONG</button></div>`,
        bind: (el) => { bindBets(el, ctx); for (const b of el.querySelectorAll('[data-right]')) b.onclick = async () => { const r = await ctx.act({ op: 'predict', right: b.dataset.right === '1', bet }); if (r && r.ok) { haptic(ctx, 'success'); ctx.sfx('pop'); ctx.redraw(); } }; },
      };
    }
    if (v.myAnswer) {
      const a = v.myAnswer;
      return { html: `${q}<div class="tt-locked a${a.a}"><div class="tt-lk">🔒</div><div class="tt-lkans"><i>${SHAPE[a.a]}</i> ${esc(v.answers[a.a])}</div><div>${v.kind === 'allin' ? `💰 Stake: <b>${v.myStake || 0}</b>` : `Bet: ${betChip(a.bet)}`}</div><p class="muted">Locked in! ${t}</p></div>` };
    }
    const top = v.kind === 'allin' ? `<div class="tt-step">💰 Stake: <b>${v.myStake || 0}</b> points ${t}</div>` : v.isSeat ? `<div class="tt-step hot">🔥 You’re in the HOT SEAT: double points! ${t}</div>${betPicker(bet)}` : `<div class="tt-step">${t}</div>${betPicker(bet)}`;
    return {
      html: `${q}${top}<div class="tt-pans">${v.answers.map((x, i) => `<button class="tt-pan a${i}" data-a="${i}"><i>${SHAPE[i]}</i><span>${esc(x)}</span></button>`).join('')}</div>`,
      bind: (el) => { bindBets(el, ctx); for (const b of el.querySelectorAll('[data-a]')) b.onclick = async () => { const r = await ctx.act({ op: 'answer', a: Number(b.dataset.a), bet }); if (r && r.ok) { haptic(ctx, bet === 3 ? 'big' : 'success'); ctx.sfx('pop'); ctx.redraw(); } }; },
    };
  }
  function phoneWager(v, ctx) {
    const t = clock('pw' + v.n, v.endsIn, 15000), base = v.stakeBase;
    return {
      html: `<div class="tt-pq">${catChip(v.cat)}<div>💰 ALL IN: the final question!</div></div><div class="tt-step">How much of your points do you bet? ${t}</div>
        ${v.points < 100 ? '<p class="muted tt-note">Under 100 points? You can still bet up to 100. Comeback time!</p>' : ''}
        <div class="tt-wagers">${WAGERS.map((p) => `<button class="tt-wg ${v.myWager === p ? 'on' : ''} ${p === 100 ? 'all' : ''}" data-pct="${p}"><b>${p === 100 ? '🔥 ALL IN' : p === 0 ? '🙈 Nothing' : p + '%'}</b><small>${Math.round((p / 100) * base)} pts</small></button>`).join('')}</div>
        <p class="muted tt-note">${v.myWager == null ? 'No bet yet: you’ll play for 0.' : 'You can change it until the question appears.'}</p>`,
      bind: (el) => { for (const b of el.querySelectorAll('[data-pct]')) b.onclick = async () => { const r = await ctx.act({ op: 'wager', pct: Number(b.dataset.pct) }); if (r && r.ok) { haptic(ctx, Number(b.dataset.pct) === 100 ? 'big' : 'select'); ctx.sfx('pop'); ctx.redraw(); } }; },
    };
  }
  function phoneReveal(v, ctx) {
    const m = v.mine, ans = v.answers ? v.answers[v.correct] : '';
    const right = `<div class="tt-rightans a${v.correct}"><i>${SHAPE[v.correct]}</i> ${esc(ans)}</div>`;
    if (!m) return { html: `<div class="tt-res none"><div class="tt-resic">👀</div><h3>The answer was</h3>${right}</div>` };
    if (m.kind === 'pred') {
      const k = String(v.n); if (felt.res !== k) { felt.res = k; haptic(ctx, m.ok ? 'success' : 'error'); }
      return { html: `<div class="tt-res ${m.ok ? 'ok' : 'bad'}"><div class="tt-resic">${m.ok ? '🔮' : '🙃'}</div><h3>${m.ok ? 'You called it!' : 'Wrong call!'}</h3><p>${esc(v.seat ? v.seat.name : '')} got it ${m.seatRight ? 'right' : 'wrong'}.</p>${right}<div class="tt-gain ${m.gained >= 0 ? 'up' : 'down'}">${sign(m.gained)}</div></div>` };
    }
    const k = String(v.n);
    if (felt.res !== k) { felt.res = k; haptic(ctx, m.right ? (m.streak >= 3 || m.bet === 3 ? 'big' : 'success') : 'error'); if (m.right) ctx.sfx('chime'); }
    const bits = [];
    if (m.right && v.kind !== 'allin') { bits.push(`${m.bet} × 100${v.isSeat ? ' × 2 (Hot Seat)' : ''}`); if (m.speed) bits.push(`⚡ speed +${m.speed}`); if (m.streakBonus) bits.push(`🔥 streak +${m.streakBonus}`); }
    const title = m.a == null ? '⏰ Too slow!' : m.right ? (m.bet === 3 ? '🔥 HOT TAKE PAID OFF!' : '✅ Right!') : m.bet === 3 ? '💥 Burned!' : '❌ Wrong!';
    return { html: `<div class="tt-res ${m.right ? 'ok' : 'bad'}"><h3>${title}</h3>${m.right ? '' : `<p>The answer was</p>${right}`}<div class="tt-gain ${m.gained > 0 ? 'up' : m.gained < 0 ? 'down' : 'zero'}">${sign(m.gained)}</div>${m.a != null && v.kind !== 'allin' ? `<p class="tt-mine">You said <b>${LET[m.a]}</b> at ${betChip(m.bet)}${!m.right && !m.gained && !v.family ? ' · nothing to lose yet!' : ''}</p>` : ''}${bits.length ? `<p class="tt-bits">${bits.join(' · ')}</p>` : ''}${m.streak >= 2 ? `<p class="tt-mystreak">🔥 ${m.streak} in a row!</p>` : ''}</div>` };
  }

  // ---------- TV lobby: the studio control desk ----------
  const DESK = {
    questions: { lab: 'Questions', sub: 'how long the show runs', opts: { 8: '8', 12: '12', 16: '16' } },
    seconds: { lab: 'Answer Clock', sub: 'seconds per question', opts: { 10: '⚡ 10s', 15: '15s', 20: '🐢 20s' } },
    cats: { lab: 'Categories', sub: 'what gets asked', opts: { all: '🎲 Everything', brainy: '🧠 Brainy', fun: '🎉 Fun', general: '💡 General', science: '🔬 Science', geography: '🌍 Places', food: '🍕 Food', animals: '🐾 Animals', pop: '🎬 Pop', sports: '🏅 Sports', history: '🏛️ History', weird: '🤯 Weird', holiday: '🎄 Holidays', office: '💼 Office', classics: '📜 Classics', travel: '✈️ Travel' } },
    family: { lab: 'Heat Level', sub: 'family friendly?', opts: { false: '🌶️ Full heat', true: '🧸 Family' } },
    showIntro: { lab: 'Opening Show', sub: 'the studio intro', opts: { true: '🎬 On', false: '⏩ Skip' } },
  };
  function lobbyTv(el, L) {
    el.__L = L;
    if (!el.__ttl) {
      el.__ttl = true;
      el.innerHTML = `<div class="ttl"><div class="ttl-bg"><i></i><i></i><i></i><i></i></div>
        <header class="ttl-logo"><span class="h">HOT TAKE</span><span class="t">TRIVIA</span><small>Know it? Bet on it.</small></header>
        <section class="ttl-desk"><div class="ttl-dh"><b>🎛️ Control Desk</b><span>Tap to change</span></div><div id="ttl-lines"></div><div id="settings" class="ttl-sr"></div>
          <div class="ttl-how"><span>🧊 1× hunch</span><span>🌶️ 2× sure</span><span>🔥 3× HOT TAKE</span><span>💺 Hot Seat</span><span>💰 All In finale</span></div></section>
        <aside class="ttl-pass"><div class="ttl-pt">Join on your phone</div><img id="qr" alt="QR code to join"><div class="ttl-url" id="ttl-url"></div>
          <div class="ttl-cc">ROOM CODE</div><div class="ttl-code" id="code"></div><div class="ttl-vip" id="ttl-vip"></div><div class="err" id="lobby-err"></div>
          <button class="ttl-start" id="start">🔥 Start the show</button>
          <div class="ttl-links"><button id="add-bots">+ 5 test bots</button><button id="rm-bots">remove bots</button><button id="ttl-pick">🎮 Other game</button></div></aside>
        <section class="ttl-floor"><div class="ttl-tally" id="ttl-tally"></div><div class="ttl-pods" id="roster"></div></section>
        <div class="ttl-party" id="ttl-party"></div></div>`;
      const $ = (s) => el.querySelector(s);
      $('#start').onclick = async () => { const r = await el.__L.start(); $('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      $('#add-bots').onclick = () => el.__L.bots(5);
      $('#rm-bots').onclick = () => el.__L.removeBots();
      $('#ttl-pick').onclick = () => el.__L.pick();
      el.addEventListener('click', (e) => {
        const k = e.target.closest('[data-k]');
        if (k) {
          for (const b of k.parentNode.querySelectorAll('.ttl-opt')) b.classList.toggle('on', b === k);
          const s = el.querySelector(`select[data-set="${k.dataset.k}"]`); if (s) s.value = k.dataset.v;
          el.__L.set(k.dataset.k, k.dataset.v); BOX.sfx('click'); return;
        }
        const c = e.target.closest('[data-kick]');
        if (c && confirm('Remove this player?')) el.__L.kick(c.dataset.kick);
      });
    }
    const $ = (s) => el.querySelector(s);
    if ($('#code').textContent !== L.code) $('#code').textContent = L.code;
    if ($('#qr').dataset.u !== L.joinUrl) { $('#qr').src = L.qr; $('#qr').dataset.u = L.joinUrl; }
    $('#ttl-url').textContent = String(L.joinUrl || '').replace(/^https?:\/\//, '');
    const n = L.players.length;
    $('#start').disabled = n < L.min;
    const vip = L.vip ? `👑 <b>${esc(L.vip)}</b> can start from their phone` : n < L.min ? `${L.min - n} more contestant${L.min - n === 1 ? '' : 's'} needed…` : 'The first to join hosts 👑';
    if ($('#ttl-vip').innerHTML !== vip) $('#ttl-vip').innerHTML = vip;
    BOX.morph($('#ttl-tally'), `<b>${n}</b><small>CONTESTANT${n === 1 ? '' : 'S'}</small>`);
    const html = L.fields.map((f) => {
      const P = DESK[f.key] || { lab: f.label, opts: {} }, cur = String(L.settings[f.key]);
      return `<div class="ttl-line k-${esc(f.key)}"><div class="ttl-lab">${esc(P.lab)}${P.sub ? `<small>${esc(P.sub)}</small>` : ''}</div>
        <div class="ttl-opts">${f.options.map((o) => `<button class="ttl-opt ${String(o.value) === cur ? 'on' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}" title="${esc(o.label)}">${esc(P.opts[String(o.value)] || o.label)}</button>`).join('')}</div></div>`;
    }).join('');
    const lines = $('#ttl-lines'); if (lines.__h !== html) { lines.__h = html; BOX.morph(lines, html); }
    const box = $('#settings'), sig = L.fields.map((f) => f.key + ':' + f.options.map((o) => o.value).join('|')).join(';');
    if (box.__sig !== sig) { box.__sig = sig; box.innerHTML = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}">${esc(o.label)}</option>`).join('')}</select></label>`).join(''); }
    for (const s of box.querySelectorAll('select[data-set]')) {
      if (document.activeElement !== s) s.value = String(L.settings[s.dataset.set]);
      s.onchange = () => { s.blur(); el.__L.set(s.dataset.set, s.value); };
    }
    const r = $('#roster');
    r.classList.toggle('many', n > 10);
    const rh = n ? L.players.map((p, i) => `<span class="chip ttl-pod ${p.online ? '' : 'off'}" data-kick="${esc(p.id)}" title="Click to remove" style="--c:${esc(p.color || '#ff8a00')};--d:${((i * 0.29) % 2.2).toFixed(2)}s"><span class="bz"></span><span class="f">${esc(p.avatar || '🙂')}</span><b>${esc(p.name)}</b></span>`).join('')
      : '<div class="ttl-empty">The buzzers are waiting… scan the code! 📱</div>';
    if (r.__h !== rh) { r.__h = rh; BOX.morph(r, rh); }
    const lp = $('#ttl-party'), lh = L.lineupHtml || ''; if (lp.__h !== lh) { lp.__h = lh; lp.innerHTML = lh; }
  }

  BOX.games.trivia = {
    name: 'Hot Take Trivia', icon: '🧠', lobbyTv,
    about: 'Fast trivia where you bet on how sure you are. 1× hunch, 2× sure, 3× HOT TAKE. Big bets, big swings.',
    how: [
      'A question and four answers go up on the TV.',
      'On your phone, pick how sure you are (🧊 1×, 🌶️ 2× or 🔥 3× HOT TAKE), then tap your answer.',
      'Right: 100 × your bet, plus a speed bonus. Three right in a row starts a 🔥 streak bonus.',
      'Wrong: you lose 50 × your bet (Family mode: wrong answers are free).',
      '💺 Hot Seat: one player answers for double points while everyone else bets on whether they’ll get it right.',
      '💰 All In: the final question. See the category, bet any share of your points, then answer!',
      'Awards at the end: Big Better, Coward, Comeback Kid, Speed Demon and more.',
    ],
    // Soundtrack cue per phase (public/box/scores/trivia.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => (s.phase === 'over' ? 'finale' : s.phase === 'reveal' ? 'reveal' : s.phase === 'drum' ? 'tense' : s.phase === 'ask' ? (s.kind === 'allin' || s.kind === 'hot' ? 'tense' : 'think') : s.phase === 'wager' ? 'tense' : 'play'),
    fx: { question: 'whoosh', hot: 'sting', allin: 'swell', wager: 'tick', open: 'pop', allIn: 'chime', lock: 'drum', reveal: 'reveal', nobody: 'shrug', seatRight: 'cheer', seatWrong: 'gasp', win: 'win' },

    tv(el, s) {
      if (!s) return;
      if (s.phase === 'over' && s.final) {
        const f = s.final, st = f.standings, w = st[0] || { name: '?' };
        const pod = [st[1], st[0], st[2]].map((r, i) => (r ? `<div class="tt-pod p${[2, 1, 3][i]}" style="--c:${esc(r.color)}"><div class="tt-poda">${av(r)}</div><div class="tt-podn">${esc(r.name)}</div><div class="tt-podp" data-plain="1" data-count="${r.points}" data-delay="${600 + i * 200}">${r.points}</div><div class="tt-podb">${[2, 1, 3][i]}</div></div>` : '<div></div>')).join('');
        const fresh = paint(el, `<div class="tt-over"><h1 class="tt-wins">🏆 ${av(w)} ${esc(w.name)} wins!</h1><div class="tt-podium">${pod}</div>
          ${awardsHtml(f.awards.slice(0, 6))}${st.length > 3 ? `<div class="tt-rest">${st.slice(3).map((r, i) => `<span>${i + 4}. ${av(r)} ${esc(r.name)} <b>${r.points}</b></span>`).join('')}</div>` : ''}</div>`, 'over');
        if (fresh) countUp(el);
        return;
      }
      const key = s.n + ':' + s.phase;
      let main;
      if (s.phase === 'intro') main = tvIntro(s);
      else if (s.phase === 'wager') {
        main = `<div class="tt-intro allin"><div class="tt-flare">💰 PLACE YOUR WAGERS 💰</div><div class="tt-catbig" style="--c:${esc(s.cat.color)}"><span>${esc(s.cat.icon)}</span>${esc(s.cat.label)}</div>
          <p class="tt-rule">Bet any share of your points on your phone. Under 100? You can still bet 100.</p>${clock('t' + key, s.endsIn, 15000)}${locks(s)}</div>`;
      } else {
        const res = s.phase === 'reveal' ? s.result : null;
        const seat = s.kind === 'hot' && s.seat ? `<div class="tt-seatbar" style="--c:${esc(s.seat.color)}">🔥 <span>${av(s.seat)}</span> <b>${esc(s.seat.name)}</b> is in the HOT SEAT · double points</div>` : '';
        const card = `<div class="tt-qcard ${s.phase}"><div class="tt-qtext">${esc(s.text)}</div></div>`;
        let foot = '';
        if (s.phase === 'ask') foot = `${clock('t' + key, s.endsIn, s.seconds * 1000)}${locks(s)}`;
        else if (s.phase === 'drum') foot = '<div class="tt-drum">🔒 Answers locked… <span>🥁</span></div>';
        else if (res) foot = gainsTv(s, res);
        main = `${seat}${card}${answersTv(s, res)}${foot}`;
      }
      const fresh = paint(el, `<div class="tt-tv ph-${s.phase} k-${s.kind}"><section class="tt-main">${top(s)}${main}</section>${board(s)}</div>`, key);
      if (fresh && s.phase === 'reveal') countUp(el);
    },

    phone(el, v, ctx) {
      if (!v) return;
      if (v.phase === 'over' && v.final) {
        const mineAw = v.final.awards.filter((a) => a.names.includes(v.myName));
        feel(ctx, 'over', 1, v.rank === 1 ? 'win' : 'success');
        paint(el, `<div class="tt-res ok"><div class="tt-resic">${v.rank === 1 ? '🏆' : v.rank === 2 ? '🥈' : v.rank === 3 ? '🥉' : '🔥'}</div><h3>You finished #${v.rank} of ${v.of}</h3><div class="tt-gain up">${v.points} pts</div></div>
          ${mineAw.length ? awardsHtml(mineAw, 'mine') : ''}${awardsHtml(v.final.awards.filter((a) => !a.names.includes(v.myName)), 'phone')}<div class="card-box">${BOX.board(v.final.standings, (r) => r.points, ' pts')}</div>`, 'over');
        return;
      }
      if (felt.over) felt = {}; // a new game started
      if (v.phase === 'intro') feel(ctx, 'q', v.n, v.isSeat ? 'turn' : v.kind === 'allin' ? 'big' : 'select');
      if (v.phase === 'ask' && v.endsIn && v.endsIn < 3500 && warned !== v.n + '' && !v.myAnswer && !v.myPred && v.inRound) { warned = v.n + ''; haptic(ctx, 'warn'); }
      let out;
      if (v.phase === 'intro') {
        const msg = v.kind === 'hot' ? (v.isSeat ? '🔥 You’re in the HOT SEAT! Double points.' : `🔥 Hot Seat: <b>${esc(v.seat ? v.seat.name : '')}</b>. Get ready to bet on them!`) : v.kind === 'allin' ? '💰 ALL IN! Get ready to wager.' : 'Get ready…';
        out = { html: `<div class="tt-pintro k-${v.kind}"><div class="tt-pcat" style="--c:${esc(v.cat.color)}"><span>${esc(v.cat.icon)}</span>${esc(v.cat.label)}</div><div class="tt-pmsg">${msg}</div></div>` };
      } else if (v.phase === 'wager') out = v.inRound ? phoneWager(v, ctx) : { html: '<div class="tt-wait">You’re in from the next game! 🎟️</div>' };
      else if (v.phase === 'ask') out = phoneAsk(v, ctx);
      else if (v.phase === 'drum') { feel(ctx, 'drum', v.n, 'tap'); out = { html: '<div class="tt-wait"><div class="tt-resic">🥁</div>Answers locked…<br><small class="muted">Eyes on the TV!</small></div>' }; }
      else if (v.phase === 'reveal') out = phoneReveal(v, ctx);
      else out = { html: '<div class="tt-wait">Next question coming…</div>' };
      paint(el, `<div class="tt-phone">${head(v)}${out.html}</div>`, v.n + '-' + v.phase);
      if (out.bind) out.bind(el);
    },
  };
})();
