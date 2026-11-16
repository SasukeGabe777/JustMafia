'use strict';
// Price Panic screens. TV: the product on a shelf-tag card, who's locked in, then the big price
// line where everyone's guesses slide in and the real price drops. Phone: a friendly price
// slider (log-ish for wide ranges) + fine-tune buttons + a typed box, power-ups, lock in.
(function () {
  const { esc, timer } = BOX;
  const seen = new Set(); // animations that already played (the TV re-renders often)
  const rkey = (s) => s.round + '|' + s.items.map((i) => i.name).join(',');
  const once = (k) => (seen.has(k) ? false : (seen.add(k), true));
  let st = { key: null, guess: 0, double: false, shield: false }; // the phone's guess survives re-renders

  const fmt = (v) => (v == null ? '' : '$' + (v < 100 && Math.round(v * 100) % 100 !== 0 ? Number(v).toFixed(2) : Math.round(v).toLocaleString('en-US')));
  const fmtStep = (s) => (s < 1 ? '$' + s.toFixed(2).replace(/^0/, '') : '$' + s.toLocaleString('en-US'));
  // Slider mapping: wide ranges use a power curve so small prices still get fine control.
  const curve = (max) => (max >= 200 ? 2.5 : 1);
  const toVal = (t, max) => max * Math.pow(Math.max(0, Math.min(1, t)), curve(max));
  const toT = (v, max) => Math.pow(Math.max(0, Math.min(1, v / max)), 1 / curve(max));
  const snap = (v) => { v = Math.max(0, v); if (v < 100) return Math.round(v * 100) / 100; if (v < 2000) return Math.round(v); if (v < 20000) return Math.round(v / 10) * 10; return Math.round(v / 100) * 100; };
  const steps = (max) => { const s = [0.1, 1, 10, 100, 1000, 10000].filter((x) => x <= max / 4).slice(-3); return s.length ? s : [0.1]; };
  const KIND = {
    guess: { icon: '🏷️', title: 'Guess the price!' },
    hilo: { icon: '⬆️⬇️', title: 'Higher or Lower?', sub: 'Is the real price higher or lower? Tap fast: speed bonus!' },
    spree: { icon: '🛒', title: 'Shopping Spree!', sub: 'Three items. Guess the TOTAL. Last round, go big!' },
  };

  const priceTag = (it, k) => {
    if (it.price == null) return '<div class="pp-tag"><span class="pp-hole"></span>$ ? ? ?</div>';
    return `<div class="pp-tag real ${once('tag:' + k) ? 'pp-drop' : ''}"><span class="pp-hole"></span>${fmt(it.price)}</div>`;
  };
  const card = (it, size, k) => `<div class="pp-card ${size || ''}"><div class="pp-ribbon">${esc(it.catIcon)} ${esc(it.cat)}</div>
    <div class="pp-photo"><span>${esc(it.emoji)}</span></div><div class="pp-name">${esc(it.name)}</div><div class="pp-desc">${esc(it.desc)}</div>${size === 'mini' ? '' : priceTag(it, k)}</div>`;
  const cards = (s, size) => `<div class="pp-cards n${s.items.length}">${s.items.map((it, i) => card(it, size, rkey(s) + ':' + i)).join('')}</div>`;

  // The big price line: guesses as markers, then the real price drops in.
  function line(s) {
    const ax = s.axis || 1, pos = (v) => Math.max(0, Math.min(100, (v / ax) * 100));
    const slide = once('slide:' + rkey(s)), drop = s.dropped && once('pin:' + rkey(s));
    const marks = s.marks.filter((m) => m.guess != null).sort((a, b) => a.guess - b.guess);
    const labelAll = marks.length <= 14, top = new Set(s.top || []);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => `<span class="pp-tick" style="left:${f * 100}%">${fmt(ax * f)}</span>`).join('');
    const ms = marks.map((m, i) => {
      const cls = ['pp-mark'];
      if (slide) cls.push('pp-slide');
      if (s.dropped) { if (top.has(m.id)) cls.push('top'); if (m.bust) cls.push('bust'); if (m.bull) cls.push('bull'); }
      const label = labelAll || (s.dropped && top.has(m.id));
      const off = m.guess > ax ? ' ➜' : '';
      return `<div class="${cls.join(' ')}" style="left:${pos(m.guess)}%;--c:${esc(m.color)};--d:${(i % 20) * 45}ms"><i>${s.dropped && m.bust ? '💥' : ''}</i>${label ? `<span class="pp-lab ${i % 2 ? 'dn' : 'up'}">${s.dropped && top.has(m.id) ? (s.top[0] === m.id ? '👑 ' : '⭐ ') : ''}${esc(m.name)} <b>${fmt(m.guess)}${off}</b></span>` : ''}</div>`;
    }).join('');
    const pin = s.dropped ? `<div class="pp-pin ${drop ? 'pp-pin-drop' : ''}" style="left:${pos(s.price)}%"><b>${fmt(s.price)}</b></div>` : '';
    return `<div class="pp-line ${labelAll ? '' : 'crowd'}"><div class="pp-axis"></div>${ticks}${ms}${pin}</div>`;
  }
  const mathRows = (math) => `<table class="pp-math">${math.map((r) => `<tr><td>${esc(r.label)}</td><td>${esc(r.val)}</td></tr>`).join('')}</table>`;

  function tvReveal(s) {
    if (s.kind === 'hilo') {
      const up = s.dropped && s.price > s.hiloPrice;
      const higher = s.marks.filter((m) => m.pick === 'higher').length, lower = s.marks.filter((m) => m.pick === 'lower').length;
      const fast = s.dropped ? s.marks.filter((m) => m.right).sort((a, b) => b.pts - a.pts).slice(0, 3) : [];
      return `${cards(s, '')}<div class="pp-hilo-res">
        <div class="pp-hl-col ${s.dropped ? (up ? 'win' : 'lose') : ''}">⬆️ HIGHER<b>${higher}</b></div>
        <div class="pp-hl-mid">${s.dropped ? `It’s <b>${fmt(s.price)}</b><br><span class="muted">vs ${fmt(s.hiloPrice)}</span>` : `🥁 Was it more than <b>${fmt(s.hiloPrice)}</b>?`}</div>
        <div class="pp-hl-col ${s.dropped ? (!up ? 'win' : 'lose') : ''}">⬇️ LOWER<b>${lower}</b></div></div>
        ${fast.length ? `<div class="pp-fast">⚡ Fastest right: ${fast.map((m) => `<span class="pp-chip" style="--c:${esc(m.color)}">${esc(m.name)} +${m.pts}</span>`).join('')}</div>` : s.dropped ? '<div class="pp-fast">Nobody got it! 😬</div>' : ''}`;
    }
    const sm = s.summary;
    const best = s.dropped ? (s.top || []).map((id) => s.marks.find((m) => m.id === id)).filter(Boolean) : [];
    return `${cards(s, s.items.length > 1 ? 'mini' : 'slim')}
      ${s.kind === 'spree' && s.dropped ? `<div class="pp-total">Total: <b>${fmt(s.price)}</b></div>` : ''}
      ${s.marks.length ? line(s) : '<div class="big-status">Nobody guessed! 🙈</div>'}
      ${s.dropped ? `<div class="pp-sum">${sm.exact ? `<span>💰 ${sm.exact} JACKPOT!</span>` : ''}<span>🎯 ${sm.bulls} bullseye${sm.bulls === 1 ? '' : 's'}</span><span>💥 ${sm.busts} bust${sm.busts === 1 ? '' : 's'}</span></div>
        <div class="pp-best">${best.map((m, i) => `<div class="pp-bestcard ${i === 0 ? 'first' : ''}" style="--c:${esc(m.color)}"><h4>${i === 0 ? '👑' : '⭐'} ${esc(m.name)} <span>${fmt(m.guess)}</span></h4>${mathRows(m.math)}<div class="pp-tot">+${m.pts}</div></div>`).join('')}</div>`
      : '<div class="big-status pp-drum">🥁 And the actual price is…</div>'}`;
  }

  function tvOver(s) {
    const w = s.standings[0];
    return `<div class="final"><div class="crown">🛍️</div><div class="muted">Shopping champion</div><h2>${esc(w ? w.name : '')}</h2>
      <div class="pp-awards">${(s.awards || []).map((a) => `<div class="pp-award"><div class="ic">${a.icon}</div><b>${esc(a.title)}</b><div>${esc(a.name)}</div><small class="muted">${esc(a.why)}</small></div>`).join('')}</div>
      <div class="pp-finalboard">${BOX.board(s.standings, (r) => r.points.toLocaleString('en-US'), ' pts')}</div></div>`;
  }

  BOX.games.price = {
    name: 'Price Panic', icon: '🏷️',
    about: 'A product hits the shelf. Guess its price on your phone. Close is good, exact is a jackpot, and going over is a bust!',
    how: [
      'A product appears on the big screen. Slide, tap or type your guess on your phone, then lock it in.',
      'Up to 1000 points for being close. Go OVER the real price and your points are halved: bust!',
      'Within 5% without going over is a Bullseye (+500). The exact price is a Jackpot (+1000). Three close rounds in a row: Hot Streak (+300).',
      'Power-ups, once each per game: 🎯 Double Down (×2), 🛡️ Bust Shield, 👀 Peek at the room’s average.',
      'Every 4th round is Higher or Lower (be fast!), and the last round is a Shopping Spree: guess the total of three items.',
    ],
    fx: { item: 'whoosh', lock: 'click', drum: 'drum', drop: 'reveal', bull: 'cheer', jackpot: 'win', bust: 'poof', hilo: 'sting', spree: 'swell', over: 'win' },

    tv(el, s) {
      if (!s) return;
      if (s.phase === 'over') { el.innerHTML = tvOver(s); return; }
      const k = KIND[s.kind] || KIND.guess;
      let main = '';
      if (s.phase === 'intro') {
        main = `<div class="pp-intro ${once('intro:' + rkey(s)) ? 'pp-pop' : ''}"><div class="pp-intro-ic">${k.icon}</div><h2>${esc(k.title)}</h2><p>${esc(k.sub || '')}</p></div>`;
      } else if (s.phase === 'guess') {
        const fresh = once('item:' + rkey(s));
        const ask = s.kind === 'hilo' ? `<div class="pp-ask">Is the real price <b>HIGHER</b> or <b>LOWER</b> than<div class="pp-tag big hilo"><span class="pp-hole"></span>${fmt(s.hiloPrice)}</div></div>`
          : `<div class="pp-ask">${s.kind === 'spree' ? '🛒 Guess the <b>TOTAL</b> for all three!' : '📱 What does it cost? Guess on your phone!'}</div>`;
        const chips = s.lockers.map((p) => `<span class="pp-chip ${p.in ? 'in' : ''}" style="--c:${esc(p.color)}">${p.in ? '🔒 ' : ''}${esc(p.name)}</span>`).join('');
        main = `<div class="${fresh ? 'pp-enter' : ''}">${cards(s, s.items.length > 1 ? '' : 'hero')}</div>${ask}
          <div class="pp-status"><span>${s.locked} / ${s.total} locked in</span><span class="pp-clock">⏱ ${timer(s.endsIn)}</span></div>
          <div class="pp-chips">${chips}${s.total > s.lockers.length ? `<span class="pp-chip">+${s.total - s.lockers.length} more</span>` : ''}</div>`;
      } else if (s.phase === 'reveal') main = tvReveal(s);
      const label = s.kind === 'guess' ? `Round ${s.round} of ${s.rounds}` : `${k.icon} ${k.title} · Round ${s.round} of ${s.rounds}`;
      el.innerHTML = `<div class="pp-wrap"><section class="pp-stage"><div class="pp-top"><span class="pp-logo">🏷️ Price Panic</span><span class="pp-round">${esc(label)}</span></div>${main}<div class="pp-note">${esc(s.note)}</div></section>
        <aside class="panel"><h3 style="margin-top:0">Leaderboard</h3>${BOX.board(s.standings, (r) => r.points.toLocaleString('en-US'), '')}</aside></div>`;
    },

    phone(el, v, ctx) {
      if (!v) return;
      if (v.phase === 'over') {
        el.innerHTML = `<div class="card-box" style="text-align:center"><h3>Game over!</h3><p>You finished <b>#${v.rank}</b> with ${v.points.toLocaleString('en-US')} points.</p>
          ${v.awards.map((a) => `<div class="pp-myaward">${a.icon} <b>${esc(a.title)}</b><br><small class="muted">${esc(a.why)}</small></div>`).join('')}</div>
          <div class="card-box">${BOX.board(v.final, (r) => r.points.toLocaleString('en-US'), '')}</div>`; return;
      }
      const k = KIND[v.kind] || KIND.guess;
      const head = `<div class="bl-me"><span>🏅 ${v.points.toLocaleString('en-US')} pts · #${v.rank || '-'}${v.streak >= 2 ? ` · 🔥${v.streak}` : ''}</span><span class="muted">Round ${v.round}/${v.rounds}</span></div>`;
      const mini = `<div class="pp-cards n${v.items.length}">${v.items.map((it) => card(it, 'mini')).join('')}</div>`;
      if (v.phase === 'intro') { el.innerHTML = `${head}<div class="pp-intro small"><div class="pp-intro-ic">${k.icon}</div><h2>${esc(k.title)}</h2><p>${esc(k.sub || '')}</p></div>`; return; }

      if (v.phase === 'guess' && v.kind === 'hilo') {
        if (v.mine) { el.innerHTML = `${head}${mini}<div class="big-status">You said ${v.mine.pick === 'higher' ? '⬆️ HIGHER' : '⬇️ LOWER'} 🔒</div><p class="muted" style="text-align:center">Than ${fmt(v.hiloPrice)} · ${timer(v.endsIn)}</p>`; return; }
        el.innerHTML = `${head}${mini}<div class="pp-ask small">Higher or lower than <b>${fmt(v.hiloPrice)}</b>? ${timer(v.endsIn)}</div>
          <div class="pp-hl-btns"><button class="pp-hl up" data-h="higher">⬆️<b>HIGHER</b></button><button class="pp-hl down" data-h="lower">⬇️<b>LOWER</b></button></div>`;
        for (const b of el.querySelectorAll('[data-h]')) b.onclick = async () => { const r = await ctx.act({ op: 'hilo', pick: b.dataset.h }); if (r.ok) { ctx.sfx('click'); ctx.vibrate(30); } };
        return;
      }

      if (v.phase === 'guess') {
        if (v.mine) {
          const pw = [v.mine.double ? '🎯 Double Down' : '', v.mine.shield ? '🛡️ Bust Shield' : ''].filter(Boolean).join(' + ');
          el.innerHTML = `${head}${mini}<div class="pp-locked"><div class="muted">Locked in at</div><div class="pp-amt">${fmt(v.mine.guess)}</div>${pw ? `<div>${pw} active!</div>` : ''}</div><p class="muted" style="text-align:center">Waiting for everyone… ${timer(v.endsIn)}</p>`;
          return;
        }
        const max = v.sliderMax, key = v.round + '|' + v.items.map((i) => i.name).join(',');
        if (st.key !== key) st = { key, guess: snap(toVal(0.35, max)), double: false, shield: false };
        const used = new Set(v.used);
        if (used.has('double')) st.double = false; if (used.has('shield')) st.shield = false;
        const stp = steps(max);
        const pow = (p, ic, name, sub) => `<button class="pp-pow ${st[p] ? 'on' : ''}" data-p="${p}" ${used.has(p) ? 'disabled' : ''}>${ic}<b>${name}</b><small>${used.has(p) ? 'used' : sub}</small></button>`;
        const peekUsed = used.has('peek') && !v.peek;
        el.innerHTML = `${head}${mini}${v.kind === 'spree' ? '<div class="pp-ask small">🛒 Guess the <b>TOTAL</b> of all three!</div>' : ''}
          <div class="pp-guess"><div class="pp-amt" id="pp-amt">${fmt(st.guess)}</div>
          <input type="range" class="pp-range" id="pp-range" min="0" max="1000" step="1" value="${Math.round(toT(st.guess, max) * 1000)}" aria-label="Your price guess">
          <div class="pp-scale"><span>$0</span><span>${timer(v.endsIn)}</span><span>${fmt(max)}+</span></div>
          <div class="pp-tune">${stp.slice().reverse().map((x) => `<button data-d="${-x}">−${fmtStep(x)}</button>`).join('')}${stp.map((x) => `<button data-d="${x}">+${fmtStep(x)}</button>`).join('')}</div>
          <div class="pp-type"><span>$</span><input id="pp-typed" type="number" inputmode="decimal" step="any" min="0" placeholder="or type an exact price"><button class="btn small ghost" id="pp-set">Set</button></div></div>
          <div class="pp-powers">${pow('double', '🎯', 'Double Down', '×2 this round')}${pow('shield', '🛡️', 'Bust Shield', 'going over is OK')}
            <button class="pp-pow ${v.peek ? 'on' : ''}" id="pp-peek" ${peekUsed || v.peek || !v.peekReady ? 'disabled' : ''}>👀<b>Peek</b><small>${v.peek ? 'peeking!' : peekUsed ? 'used' : v.peekReady ? 'see the average' : 'at half time'}</small></button></div>
          ${v.peek ? `<div class="pp-peek">👀 Room average so far: <b>${v.peek.avg != null ? fmt(v.peek.avg) : 'nobody yet'}</b> <span class="muted">(${v.peek.n} locked in)</span></div>` : ''}
          <button class="btn big green pp-lockbtn" id="pp-lock">🔒 Lock in <span id="pp-lockamt">${fmt(st.guess)}</span></button>`;
        const range = el.querySelector('#pp-range'), typed = el.querySelector('#pp-typed');
        const paint = (fromRange) => {
          el.querySelector('#pp-amt').textContent = fmt(st.guess); el.querySelector('#pp-lockamt').textContent = fmt(st.guess);
          if (!fromRange) range.value = String(Math.round(toT(st.guess, max) * 1000));
        };
        const set = (g) => { if (!Number.isFinite(g)) return; st.guess = snap(Math.min(Math.max(0, g), max * 20)); paint(false); };
        range.oninput = () => { st.guess = snap(toVal(Number(range.value) / 1000, max)); paint(true); };
        range.onchange = () => range.blur(); // let the shell redraw again once the drag ends
        for (const b of el.querySelectorAll('[data-d]')) b.onclick = () => { set(st.guess + Number(b.dataset.d)); ctx.vibrate(8); };
        const applyTyped = () => { const n = parseFloat(String(typed.value).replace(/[$,\s]/g, '')); if (Number.isFinite(n)) set(n); typed.value = ''; typed.blur(); };
        typed.onkeydown = (e) => { if (e.key === 'Enter') applyTyped(); };
        typed.onchange = applyTyped;
        el.querySelector('#pp-set').onclick = applyTyped;
        for (const b of el.querySelectorAll('[data-p]')) b.onclick = () => { st[b.dataset.p] = !st[b.dataset.p]; b.classList.toggle('on', st[b.dataset.p]); ctx.vibrate(15); };
        const pk = el.querySelector('#pp-peek'); pk.onclick = async () => { const r = await ctx.act({ op: 'peek' }); if (r.ok) ctx.sfx('chime'); };
        el.querySelector('#pp-lock').onclick = async () => {
          if (typed.value) applyTyped();
          const r = await ctx.act({ op: 'lock', guess: st.guess, double: st.double, shield: st.shield });
          if (r.ok) { ctx.sfx('click'); ctx.vibrate(40); }
        };
        return;
      }

      if (v.phase === 'reveal') {
        if (!v.dropped) { el.innerHTML = `${head}${mini}<div class="big-status pp-drum">🥁 Look at the TV!</div>${v.mine && v.mine.guess != null ? `<p style="text-align:center">You guessed <b>${fmt(v.mine.guess)}</b></p>` : ''}`; return; }
        const r = v.result;
        const real = v.kind === 'hilo' ? `It was <b>${fmt(v.price)}</b> (${v.price > v.hiloPrice ? 'higher' : 'lower'} than ${fmt(v.hiloPrice)})` : `Real price: <b>${fmt(v.price)}</b>`;
        let body;
        if (!r) body = `<h3>You sat this one out</h3>${v.kind === 'hilo' ? '' : '<p class="muted">No guess, no points (and no streak).</p>'}`;
        else {
          const big = r.exact ? '💰 JACKPOT!' : r.bull ? '🎯 Bullseye!' : r.bust ? '💥 Bust!' : v.kind === 'hilo' ? (r.right ? '✅ Right!' : '❌ Nope!') : r.pct <= 15 ? '👏 So close!' : r.pct <= 40 ? '👍 Not bad' : '😅 Way off';
          body = `<h3 class="pp-big ${r.bust || r.right === false ? 'bad' : 'good'}">${big}</h3>${r.guess != null ? `<p>You guessed <b>${fmt(r.guess)}</b></p>` : ''}${mathRows(r.math)}<div class="pp-tot">+${r.pts}</div>`;
          const mark = v.round + ':' + v.kind;
          if (el.dataset.res !== mark) { el.dataset.res = mark; if (r.exact || r.bull || r.right) { ctx.sfx(r.exact ? 'win' : 'cheer'); ctx.vibrate(120); } else if (r.bust) ctx.vibrate([60, 40, 60]); }
        }
        el.innerHTML = `${head}${mini}<div class="card-box pp-result" style="text-align:center"><p>${real}</p>${body}</div>`;
        return;
      }
      el.innerHTML = `${head}<div class="big-status">Next item coming…</div>`;
    },
  };
})();
